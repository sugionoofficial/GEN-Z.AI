/*
 * =========================================================
 * GEN-Z.AI
 * UPSCALE SOURCE (bucket privat)
 * ---------------------------------------------------------
 * File: lib/generate/upscale-source.js
 * ---------------------------------------------------------
 *
 * Upload user sekarang masuk ke bucket PRIVAT `user-uploads`.
 * Supabase memberi signed URL `?token=…` yang tetap bisa
 * diunduh GitHub Actions / provider, tapi tidak bisa ditebak
 * publik.
 *
 * Path LEGACY (/object/public/dashboard-videos/…) tetap
 * diterima supaya job lama / file yang belum termigrasi masih
 * bisa diproses.
 *
 * Dipakai untuk dua jenis sumber:
 *   - video  → upscale-videos/inputs/<uid>/<ts>-<rand>.<mp4|webm|mov|m4v>
 *   - foto   → upscale-photos/inputs/<uid>/<ts>-<rand>.<jpg|jpeg|png|webp>
 * =========================================================
 */

export const UPLOAD_BUCKET = "user-uploads";
export const LEGACY_PUBLIC_BUCKET = "dashboard-videos";

const LEGACY_PREFIX = `/storage/v1/object/public/${LEGACY_PUBLIC_BUCKET}/`;
const SIGNED_PREFIX = `/storage/v1/object/sign/${UPLOAD_BUCKET}/`;
const AUTHENTICATED_PREFIX = `/storage/v1/object/authenticated/${UPLOAD_BUCKET}/`;

const SOURCE_KINDS = {
    video: {
        folder: "upscale-videos/inputs",
        extensions: "mp4|webm|mov|m4v",
        label: "Video"
    },
    photo: {
        folder: "upscale-photos/inputs",
        extensions: "jpg|jpeg|png|webp",
        label: "Foto"
    }
};

function fail(message) {
    const error = new Error(message);
    error.status = 400;
    return error;
}

function escapeRegExp(value) {
    return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getKind(kind) {
    const config = SOURCE_KINDS[kind || "video"];

    if (!config) {
        throw new Error(`Unknown upscale source kind: ${kind}`);
    }

    return config;
}

export function buildUpscaleInputPathRegex(userId, kind = "video") {
    const { folder, extensions } = getKind(kind);
    const safeUserId = escapeRegExp(userId);

    return new RegExp(
        `^${folder}/${safeUserId}/[0-9]+-[a-z0-9]{8}\\.(${extensions})$`,
        "i"
    );
}

/**
 * Validasi URL sumber (video/foto) upscale dan kembalikan lokasi objek.
 *
 * @returns {{ bucket: string, objectPath: string, signed: boolean }}
 */
function resolveUploadedUpscaleSource({ sourceUrl, userId, supabaseUrl, kind }) {
    const { label } = getKind(kind);
    const labelLower = label.toLowerCase();
    const raw = String(sourceUrl || "").trim();

    if (!raw) {
        throw fail(`URL ${labelLower} sumber wajib diisi.`);
    }

    if (!supabaseUrl) {
        throw fail("SUPABASE_URL is not configured");
    }

    let parsedUrl;
    let supabaseOrigin;

    try {
        parsedUrl = new URL(raw);
        supabaseOrigin = new URL(supabaseUrl).origin;
    } catch {
        throw fail(`URL ${labelLower} tidak valid.`);
    }

    if (
        parsedUrl.protocol !== "https:" ||
        parsedUrl.origin !== supabaseOrigin ||
        parsedUrl.username ||
        parsedUrl.password ||
        parsedUrl.hash
    ) {
        throw fail(`URL ${labelLower} sumber tidak diizinkan.`);
    }

    let bucket = "";
    let objectPath = "";
    let signed = false;

    if (parsedUrl.pathname.startsWith(SIGNED_PREFIX) || parsedUrl.pathname.startsWith(AUTHENTICATED_PREFIX)) {
        const prefix = parsedUrl.pathname.startsWith(SIGNED_PREFIX) ? SIGNED_PREFIX : AUTHENTICATED_PREFIX;

        // Signed URL membawa ?token=… — query lain tidak diizinkan.
        const token = parsedUrl.searchParams.get("token");
        if (!token) {
            throw fail(`URL ${labelLower} sumber tidak diizinkan.`);
        }
        if ([...parsedUrl.searchParams.keys()].some(key => key !== "token")) {
            throw fail(`URL ${labelLower} sumber tidak diizinkan.`);
        }

        try {
            objectPath = decodeURIComponent(parsedUrl.pathname.slice(prefix.length));
        } catch {
            throw fail(`Path ${labelLower} sumber tidak valid.`);
        }

        bucket = UPLOAD_BUCKET;
        signed = true;
    } else if (parsedUrl.pathname.startsWith(LEGACY_PREFIX)) {
        if (parsedUrl.search) {
            throw fail(`URL ${labelLower} sumber tidak diizinkan.`);
        }

        try {
            objectPath = decodeURIComponent(parsedUrl.pathname.slice(LEGACY_PREFIX.length));
        } catch {
            throw fail(`Path ${labelLower} sumber tidak valid.`);
        }

        bucket = LEGACY_PUBLIC_BUCKET;
    } else {
        throw fail(`${label} harus diunggah melalui Upscale Studio.`);
    }

    if (!buildUpscaleInputPathRegex(userId, kind).test(objectPath)) {
        throw fail(`${label} sumber tidak cocok dengan akun yang login.`);
    }

    return { bucket, objectPath, signed };
}

export function resolveUploadedUpscaleVideoSource(params) {
    return resolveUploadedUpscaleSource({ ...params, kind: "video" });
}

export function resolveUploadedUpscalePhotoSource(params) {
    return resolveUploadedUpscaleSource({ ...params, kind: "photo" });
}
