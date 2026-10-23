/*
 * =========================================================
 * GEN-Z.AI
 * PRIVATE MEDIA REFERENCE
 * ---------------------------------------------------------
 * File: lib/generate/private-media.js
 * ---------------------------------------------------------
 *
 * Output upscale sekarang disimpan di bucket PRIVAT
 * `user-uploads`. Database tidak boleh menyimpan URL publik,
 * tapi juga tidak boleh menyimpan signed URL (kedaluwarsa
 * ±1 jam padahal file hidup 24 jam).
 *
 * Solusi: simpan referensi stabil
 *
 *     supabase-private://user-uploads/<object-path>
 *
 * lalu tukar menjadi signed URL saat dibaca:
 *   - API (api/generate.js, api/generate-status.js) menukar
 *     otomatis di `json()` sebelum response dikirim;
 *   - halaman riwayat menukar lewat Supabase client (RLS
 *     hanya mengizinkan folder milik user).
 *
 * URL publik lama (dashboard-videos / dashboard-upscales)
 * TIDAK diubah supaya baris lama tetap bisa dibuka.
 * =========================================================
 */

export const PRIVATE_MEDIA_SCHEME = "supabase-private";

const SIGNED_PATH_TTL_SECONDS = 30 * 60;
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_SAFETY_MS = 60 * 1000;

/**
 * Bangun referensi penyimpanan privat.
 *
 * @returns {string} `supabase-private://<bucket>/<object-path>`
 */
export function buildPrivateMediaRef({ bucket, objectPath }) {
    const safeBucket = String(bucket || "").trim();
    const safePath = String(objectPath || "").trim().replace(/^\/+/, "");

    if (!safeBucket || !safePath) {
        return "";
    }

    return `${PRIVATE_MEDIA_SCHEME}://${safeBucket}/${safePath}`;
}

export function isPrivateMediaRef(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .startsWith(`${PRIVATE_MEDIA_SCHEME}://`);
}

/**
 * @returns {{ bucket: string, objectPath: string } | null}
 */
export function parsePrivateMediaRef(value) {
    const raw = String(value || "").trim();

    if (!isPrivateMediaRef(raw)) {
        return null;
    }

    const rest = raw.slice(PRIVATE_MEDIA_SCHEME.length + 3);
    const slash = rest.indexOf("/");

    if (slash <= 0) {
        return null;
    }

    const bucket = rest.slice(0, slash).trim();
    const objectPath = rest.slice(slash + 1).trim();

    if (
        !bucket ||
        !objectPath ||
        objectPath.includes("..") ||
        objectPath.startsWith("/")
    ) {
        return null;
    }

    return { bucket, objectPath };
}

function encodeObjectPath(objectPath) {
    return String(objectPath || "")
        .split("/")
        .map(segment => encodeURIComponent(segment))
        .join("/");
}

/**
 * Tukar referensi privat menjadi signed URL.
 * Melempar error kalau gagal — pemanggil yang memutuskan fallback.
 */
export async function signPrivateMediaRef({
    ref,
    supabaseUrl,
    serviceKey,
    ttlSeconds = SIGNED_PATH_TTL_SECONDS,
    fetchImpl = globalThis.fetch
}) {
    const parsed = parsePrivateMediaRef(ref);

    if (!parsed) {
        return String(ref || "");
    }

    const base = String(supabaseUrl || "").replace(/\/+$/, "");

    if (!base || !serviceKey) {
        throw new Error("Supabase service credentials tidak tersedia");
    }

    if (typeof fetchImpl !== "function") {
        throw new Error("fetch tidak tersedia");
    }

    const response = await fetchImpl(
        `${base}/storage/v1/object/sign/${parsed.bucket}/${encodeObjectPath(parsed.objectPath)}`,
        {
            method: "POST",
            headers: {
                apikey: serviceKey,
                Authorization: `Bearer ${serviceKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ expiresIn: ttlSeconds })
        }
    );

    if (!response?.ok) {
        const detail = await response?.text?.().catch(() => "");
        throw new Error(
            `Gagal membuat signed URL (${response?.status || 0}): ${String(detail || "").slice(0, 200)}`
        );
    }

    const data = await response.json().catch(() => null);
    const signed = String(data?.signedURL || data?.signedUrl || "").trim();

    if (!signed) {
        throw new Error("Signed URL kosong dari Supabase");
    }

    if (/^https?:\/\//i.test(signed)) {
        return signed;
    }

    return `${base}/storage/v1${signed.startsWith("/") ? signed : `/${signed}`}`;
}

/**
 * Signer dengan cache + deep-walk.
 *
 * Dipakai api/generate.js & api/generate-status.js: satu tempat
 * (`json()`) menukar semua referensi privat di response.
 */
export function createPrivateMediaSigner({
    supabaseUrl,
    serviceKey,
    ttlSeconds = SIGNED_PATH_TTL_SECONDS,
    fetchImpl = globalThis.fetch,
    now = Date.now,
    cacheTtlMs = CACHE_TTL_MS,
    logger = console
} = {}) {
    const cache = new Map();

    /*
     * Dedupe request yang berjalan bersamaan: satu response
     * status bisa memuat referensi yang sama beberapa kali
     * (result_url, result_urls, history_result_url).
     */
    const pending = new Map();

    function signOne(ref) {
        const key = String(ref);
        const cached = cache.get(key);

        if (cached && cached.expiresAt > now()) {
            return Promise.resolve(cached.url);
        }

        const running = pending.get(key);

        if (running) {
            return running;
        }

        const task = signPrivateMediaRef({
            ref: key,
            supabaseUrl,
            serviceKey,
            ttlSeconds,
            fetchImpl
        })
            .then(url => {
                cache.set(key, {
                    url,
                    expiresAt: now() + Math.max(cacheTtlMs, 0)
                });

                return url;
            })
            .catch(err => {
                logger?.warn?.(
                    "[private-media] Gagal sign:",
                    key,
                    err?.message || err
                );

                /*
                 * Biarkan referensi asli supaya UI tahu file ada,
                 * tapi tidak menampilkan URL publik apa pun.
                 */
                return key;
            })
            .finally(() => {
                pending.delete(key);
            });

        pending.set(key, task);

        return task;
    }

    async function signDeep(value, depth = 0) {
        if (depth > 8 || value === null || value === undefined) {
            return value;
        }

        if (typeof value === "string") {
            return isPrivateMediaRef(value) ? signOne(value) : value;
        }

        if (Array.isArray(value)) {
            return Promise.all(value.map(item => signDeep(item, depth + 1)));
        }

        if (typeof value === "object") {
            const entries = await Promise.all(
                Object.entries(value).map(async ([key, item]) => [
                    key,
                    await signDeep(item, depth + 1)
                ])
            );

            return Object.fromEntries(entries);
        }

        return value;
    }

    return {
        signOne,
        signDeep,
        clear() {
            cache.clear();
        }
    };
}
