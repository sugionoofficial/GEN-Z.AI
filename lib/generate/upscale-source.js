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
 * =========================================================
 */

export const UPLOAD_BUCKET = "user-uploads";
export const LEGACY_PUBLIC_BUCKET = "dashboard-videos";

const LEGACY_PREFIX = `/storage/v1/object/public/${LEGACY_PUBLIC_BUCKET}/`;
const SIGNED_PREFIX = `/storage/v1/object/sign/${UPLOAD_BUCKET}/`;
const AUTHENTICATED_PREFIX = `/storage/v1/object/authenticated/${UPLOAD_BUCKET}/`;

function fail(message) {
    const error = new Error(message);
    error.status = 400;
    return error;
}

function escapeRegExp(value) {
    return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildUpscaleInputPathRegex(userId) {
    const safeUserId = escapeRegExp(userId);
    return new RegExp(
        `^upscale-videos/inputs/${safeUserId}/[0-9]+-[a-z0-9]{8}\\.(mp4|webm|mov|m4v)$`,
        "i"
    );
}

/**
 * Validasi URL video sumber upscale dan kembalikan lokasi objek.
 *
 * @returns {{ bucket: string, objectPath: string, signed: boolean }}
 */
export function resolveUploadedUpscaleVideoSource({ sourceUrl, userId, supabaseUrl }) {
    const raw = String(sourceUrl || "").trim();

    if (!raw) {
        throw fail("URL video sumber wajib diisi.");
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
        throw fail("URL video tidak valid.");
    }

    if (
        parsedUrl.protocol !== "https:" ||
        parsedUrl.origin !== supabaseOrigin ||
        parsedUrl.username ||
        parsedUrl.password ||
        parsedUrl.hash
    ) {
        throw fail("URL video sumber tidak diizinkan.");
    }

    let bucket = "";
    let objectPath = "";
    let signed = false;

    if (parsedUrl.pathname.startsWith(SIGNED_PREFIX) || parsedUrl.pathname.startsWith(AUTHENTICATED_PREFIX)) {
        const prefix = parsedUrl.pathname.startsWith(SIGNED_PREFIX) ? SIGNED_PREFIX : AUTHENTICATED_PREFIX;

        // Signed URL membawa ?token=… — query lain tidak diizinkan.
        const token = parsedUrl.searchParams.get("token");
        if (!token) {
            throw fail("URL video sumber tidak diizinkan.");
        }
        if ([...parsedUrl.searchParams.keys()].some(key => key !== "token")) {
            throw fail("URL video sumber tidak diizinkan.");
        }

        try {
            objectPath = decodeURIComponent(parsedUrl.pathname.slice(prefix.length));
        } catch {
            throw fail("Path video sumber tidak valid.");
        }

        bucket = UPLOAD_BUCKET;
        signed = true;
    } else if (parsedUrl.pathname.startsWith(LEGACY_PREFIX)) {
        if (parsedUrl.search) {
            throw fail("URL video sumber tidak diizinkan.");
        }

        try {
            objectPath = decodeURIComponent(parsedUrl.pathname.slice(LEGACY_PREFIX.length));
        } catch {
            throw fail("Path video sumber tidak valid.");
        }

        bucket = LEGACY_PUBLIC_BUCKET;
    } else {
        throw fail("Video harus diunggah melalui Upscale Studio.");
    }

    if (!buildUpscaleInputPathRegex(userId).test(objectPath)) {
        throw fail("Video sumber tidak cocok dengan akun yang login.");
    }

    return { bucket, objectPath, signed };
}
