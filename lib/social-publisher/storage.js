import { BUILTIN_STORY_SONGS, findBuiltinStorySong } from "./quotes.js";

export const SOCIAL_REFERENCE_STORAGE_BUCKET = "social-character-references";
export const SOCIAL_STORY_AUDIO_BUCKET = "social-story-audio";
const MAX_ERROR_LENGTH = 500;

function encodedObjectPath(key) {
    const segments = String(key || "").split("/");
    if (segments.length < 3 || segments.some(segment => !segment || segment === "." || segment === "..")) {
        throw new Error("Invalid reference object path.");
    }
    return segments.map(segment => encodeURIComponent(segment)).join("/");
}

async function storageRequest(config, path, options = {}) {
    if (!config?.url || !config?.serviceRoleKey) {
        throw new Error("Supabase Storage server configuration is missing.");
    }
    const response = await fetch(`${String(config.url).replace(/\/+$/, "")}${path}`, {
        ...options,
        headers: {
            apikey: config.serviceRoleKey,
            Authorization: `Bearer ${config.serviceRoleKey}`,
            ...(options.headers || {})
        }
    });
    if (!response.ok) {
        const text = await response.text();
        let data = null;
        if (text) {
            try { data = JSON.parse(text); } catch { data = { message: text }; }
        }
        const message = String(data?.message || data?.error || data?.statusCode || `Supabase Storage request failed (HTTP ${response.status}).`)
            .slice(0, MAX_ERROR_LENGTH);
        const error = new Error(message);
        error.status = response.status;
        throw error;
    }
    return response;
}

export async function isPrivateReferenceBucket(config) {
    try {
        const response = await storageRequest(
            config,
            `/storage/v1/bucket/${encodeURIComponent(SOCIAL_REFERENCE_STORAGE_BUCKET)}`
        );
        const bucket = await response.json();
        return bucket?.id === SOCIAL_REFERENCE_STORAGE_BUCKET && bucket?.public === false;
    } catch {
        return false;
    }
}

export async function uploadReferenceObject(config, key, bytes, mimeType) {
    const path = encodedObjectPath(key);
    await storageRequest(
        config,
        `/storage/v1/object/${encodeURIComponent(SOCIAL_REFERENCE_STORAGE_BUCKET)}/${path}`,
        {
            method: "POST",
            headers: {
                "Content-Type": mimeType,
                "x-upsert": "false"
            },
            body: bytes
        }
    );
}

export async function downloadReferenceObject(config, key) {
    const path = encodedObjectPath(key);
    const response = await storageRequest(
        config,
        `/storage/v1/object/authenticated/${encodeURIComponent(SOCIAL_REFERENCE_STORAGE_BUCKET)}/${path}`
    );
    return new Uint8Array(await response.arrayBuffer());
}

export async function createSignedReferenceUrl(config, key, expiresInSeconds = 600) {
    const path = encodedObjectPath(key);
    const response = await storageRequest(
        config,
        `/storage/v1/object/sign/${encodeURIComponent(SOCIAL_REFERENCE_STORAGE_BUCKET)}/${path}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ expiresIn: expiresInSeconds })
        }
    );
    const data = await response.json();
    const signedPath = String(data?.signedURL || "");
    if (!signedPath) throw new Error("Supabase Storage did not return a signed reference URL.");
    const storagePath = signedPath.startsWith("/object/")
        ? `/storage/v1${signedPath}`
        : signedPath;
    const url = new URL(storagePath, `${String(config.url).replace(/\/+$/, "")}/`);
    if (url.origin !== new URL(config.url).origin) {
        throw new Error("Supabase Storage returned a signed URL for an unexpected origin.");
    }
    return url.toString();
}

/**
 * Ambil foto referensi yang sudah diperkecil oleh Supabase (image
 * transformations) supaya Worker tidak perlu men-decode gambar besar.
 *
 * Decode JPEG/PNG 4–12 MP di dalam Worker memakan puluhan MB memori: foto
 * referensi 928 KB + outfit 752 KB cukup untuk menembus batas 128 MB dan
 * memunculkan Error 1102 "Worker exceeded resource limits". Endpoint render
 * Supabase mengembalikan JPEG yang sisi terpanjangnya <= maxSide, jadi jalur
 * normal tidak lagi menyentuh decoder sama sekali.
 *
 * Mengembalikan `null` bila transformasi tidak tersedia/ditolak (mis. fitur
 * Image Transformations belum aktif), agar pemanggil bisa jatuh ke unduhan
 * biasa.
 */
export async function downloadDownscaledReference(config, key, { maxSide = 512, expiresInSeconds = 600 } = {}) {
    const signedUrl = await createSignedReferenceUrl(config, key, expiresInSeconds);
    const url = new URL(signedUrl);
    if (!url.pathname.includes("/storage/v1/object/sign/")) return null;
    url.pathname = url.pathname.replace("/storage/v1/object/sign/", "/storage/v1/render/image/sign/");
    url.searchParams.set("width", String(maxSide));
    url.searchParams.set("height", String(maxSide));
    url.searchParams.set("resize", "contain");
    const response = await fetch(url.toString(), { method: "GET" });
    if (!response.ok) {
        console.warn(`[Social Publisher] Transformasi gambar Supabase tidak tersedia (HTTP ${response.status}); memakai unduhan biasa.`);
        return null;
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.length) return null;
    const mimeType = String(response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!/^image\/(jpeg|png)$/.test(mimeType)) return null;
    return { bytes, mimeType, source: "supabase-transform" };
}

/**
 * Unduh referensi untuk model gambar: coba versi yang sudah diperkecil dulu,
 * baru unduh aslinya bila transformasi tidak tersedia.
 */
export async function downloadModelReference(config, key, { maxSide = 512 } = {}) {
    try {
        const transformed = await downloadDownscaledReference(config, key, { maxSide });
        if (transformed) return transformed;
    } catch (error) {
        console.warn("[Social Publisher] Gagal meminta gambar diperkecil:", error?.message || "unknown error");
    }
    const bytes = await downloadReferenceObject(config, key);
    return { bytes, mimeType: "", source: "original" };
}

export async function deleteReferenceObject(config, key) {
    encodedObjectPath(key);
    await storageRequest(
        config,
        `/storage/v1/object/${encodeURIComponent(SOCIAL_REFERENCE_STORAGE_BUCKET)}`,
        {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prefixes: [key] })
        }
    );
}

function encodedStoryAudioPath(key) {
    const segments = String(key || "").split("/");
    if (segments.length < 2 || segments.some(segment => !segment || segment === "." || segment === "..")) {
        throw new Error("Invalid story audio object path.");
    }
    return segments.map(segment => encodeURIComponent(segment)).join("/");
}

export async function uploadStoryAudioObject(config, key, bytes, mimeType) {
    const path = encodedStoryAudioPath(key);
    await storageRequest(
        config,
        `/storage/v1/object/${encodeURIComponent(SOCIAL_STORY_AUDIO_BUCKET)}/${path}`,
        {
            method: "POST",
            headers: {
                "Content-Type": mimeType || "audio/mp4",
                "x-upsert": "true"
            },
            body: bytes
        }
    );
}

export async function downloadStoryAudioObject(config, key) {
    const path = encodedStoryAudioPath(key);
    const response = await storageRequest(
        config,
        `/storage/v1/object/authenticated/${encodeURIComponent(SOCIAL_STORY_AUDIO_BUCKET)}/${path}`
    );
    return new Uint8Array(await response.arrayBuffer());
}

export async function deleteStoryAudioObject(config, key) {
    if (!key || String(key).startsWith("builtin:")) return;
    encodedStoryAudioPath(key);
    await storageRequest(
        config,
        `/storage/v1/object/${encodeURIComponent(SOCIAL_STORY_AUDIO_BUCKET)}`,
        {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prefixes: [key] })
        }
    );
}

export async function loadBuiltinStoryAudio(env, keyOrSlug) {
    const builtin = findBuiltinStorySong(keyOrSlug) || BUILTIN_STORY_SONGS[0];
    if (!builtin?.asset_path) return null;

    if (typeof env?.ASSETS?.fetch === "function") {
        try {
            const assetRes = await env.ASSETS.fetch(new Request(`https://assets.local${builtin.asset_path}`));
            if (assetRes?.ok) {
                const bytes = new Uint8Array(await assetRes.arrayBuffer());
                if (bytes.byteLength > 64) return bytes;
            }
        } catch {
            // Fall through to Node fs fallback when running outside Cloudflare Workers.
        }
    }

    try {
        const [{ readFile }, pathMod, urlMod] = await Promise.all([
            import("node:fs/promises"),
            import("node:path"),
            import("node:url")
        ]);
        const dir = pathMod.dirname(urlMod.fileURLToPath(import.meta.url));
        const filePath = pathMod.resolve(dir, "../..", builtin.asset_path.replace(/^\/+/, ""));
        const buf = await readFile(filePath);
        return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    } catch {
        return null;
    }
}

export async function resolveStorySongAudioBytes(env, config, song) {
    const key = String(song?.audio_object_key || "").trim();
    if (key && !key.startsWith("builtin:")) {
        try {
            const uploaded = await downloadStoryAudioObject(config, key);
            if (uploaded?.byteLength > 64) return uploaded;
        } catch (error) {
            console.warn("[Social Publisher] Custom song audio download failed, falling back to built-in track:", error?.message || "unknown");
        }
    }
    return await loadBuiltinStoryAudio(env, key || song?.builtin_slug || BUILTIN_STORY_SONGS[0].audio_object_key);
}

