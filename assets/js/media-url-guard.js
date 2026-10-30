/* =========================================================
   GEN-Z.AI — DIRECT MEDIA URL GUARD
   ---------------------------------------------------------
   Browser-safe & Worker-safe helper untuk memvalidasi input
   "By URL" pada halaman Generate agar link halaman web
   (Facebook, TikTok, Instagram, YouTube, X/Twitter, Pinterest,
   Google Drive preview, dll.) ditolak lebih awal dengan pesan
   Bahasa Indonesia yang jelas sebelum memotong credit.
========================================================= */

const WEB_PLATFORM_RULES = Object.freeze([
    {
        label: "Facebook",
        matchHost: host =>
            host === "facebook.com" ||
            host.endsWith(".facebook.com") ||
            host === "fb.com" ||
            host.endsWith(".fb.com") ||
            host === "fb.watch"
    },
    {
        label: "TikTok",
        matchHost: host =>
            host === "tiktok.com" ||
            host.endsWith(".tiktok.com")
    },
    {
        label: "Instagram",
        matchHost: host =>
            host === "instagram.com" ||
            host.endsWith(".instagram.com") ||
            host === "instagr.am"
    },
    {
        label: "YouTube",
        matchHost: host =>
            host === "youtube.com" ||
            host.endsWith(".youtube.com") ||
            host === "youtu.be"
    },
    {
        label: "X / Twitter",
        matchHost: host =>
            host === "twitter.com" ||
            host.endsWith(".twitter.com") ||
            host === "x.com" ||
            host.endsWith(".x.com") ||
            host === "t.co"
    },
    {
        label: "Threads",
        matchHost: host =>
            host === "threads.net" ||
            host.endsWith(".threads.net")
    },
    {
        label: "Pinterest",
        matchHost: host =>
            host === "pinterest.com" ||
            host.endsWith(".pinterest.com") ||
            host === "pin.it"
    },
    {
        label: "Google Drive / Docs",
        matchHost: (host, pathname) =>
            host === "docs.google.com" ||
            (host === "drive.google.com" && /^\/(file|drive|open)\b/i.test(pathname))
    },
    {
        label: "Dropbox",
        matchHost: (host, _pathname, parsed) =>
            (host === "dropbox.com" || host === "www.dropbox.com") &&
            parsed?.searchParams?.get("dl") !== "1" &&
            parsed?.searchParams?.get("raw") !== "1"
    },
    {
        label: "Canva",
        matchHost: (host, pathname) =>
            (host === "canva.com" || host === "www.canva.com") &&
            /^\/design\b/i.test(pathname)
    }
]);

const MEDIA_PARAMETER_KEYS = new Set([
    "image_url",
    "image_urls",
    "first_frame_url",
    "last_frame_url",
    "end_image_url",
    "reference_image_url",
    "reference_image_urls",
    "video_url",
    "video_urls",
    "reference_video_url",
    "reference_video_urls",
    "audio_url",
    "audio_urls",
    "reference_audio_url",
    "reference_audio_urls"
]);

export function isMediaUrlParameterName(name) {
    const key = String(name || "").trim().toLowerCase();
    return MEDIA_PARAMETER_KEYS.has(key);
}

export function inspectReferenceMediaUrl(rawUrl) {
    const value = String(rawUrl || "").trim();
    if (!value) {
        return { valid: true };
    }

    if (
        value.startsWith("supabase-private://") ||
        /^data:(image|video|audio)\//i.test(value)
    ) {
        return { valid: true };
    }

    let parsed;
    try {
        parsed = new URL(value);
    } catch {
        return {
            valid: false,
            code: "INVALID_MEDIA_URL",
            message:
                "Format URL media tidak valid. Gunakan link file langsung (https://...) atau unggah file melalui tombol Upload."
        };
    }

    const protocol = String(parsed.protocol || "").toLowerCase();
    if (protocol !== "https:" && protocol !== "http:") {
        return {
            valid: false,
            code: "INVALID_MEDIA_URL_PROTOCOL",
            message:
                "URL media harus menggunakan protokol https:// atau http://, atau unggah file melalui tombol Upload."
        };
    }

    const host = String(parsed.hostname || "").trim().toLowerCase();
    const pathname = String(parsed.pathname || "/");

    for (const rule of WEB_PLATFORM_RULES) {
        if (rule.matchHost(host, pathname, parsed)) {
            return {
                valid: false,
                code: "NON_DIRECT_MEDIA_URL",
                platform: rule.label,
                message:
                    `Link halaman ${rule.label} tidak bisa dipakai di mode By URL karena mengarah ke halaman web, bukan file gambar/video langsung. Silakan download foto/videonya terlebih dahulu lalu gunakan menu Upload.`
            };
        }
    }

    return { valid: true };
}

export function validateParametersMediaUrls(parameters = {}) {
    if (!parameters || typeof parameters !== "object" || Array.isArray(parameters)) {
        return [];
    }

    const errors = [];

    for (const [key, rawVal] of Object.entries(parameters)) {
        if (!isMediaUrlParameterName(key)) {
            continue;
        }
        const values = Array.isArray(rawVal) ? rawVal : [rawVal];
        for (const entry of values) {
            if (typeof entry !== "string" || !entry.trim()) {
                continue;
            }
            const result = inspectReferenceMediaUrl(entry);
            if (!result.valid && result.message) {
                errors.push(result.message);
            }
        }
    }

    return [...new Set(errors)];
}

export function isNonMediaHttpPayload(contentType = "", bytes = null) {
    const normalizedType = String(contentType || "")
        .split(";")[0]
        .trim()
        .toLowerCase();

    if (
        normalizedType === "text/html" ||
        normalizedType === "application/xhtml+xml" ||
        normalizedType === "application/json" ||
        normalizedType === "text/plain" ||
        normalizedType === "text/xml" ||
        normalizedType === "application/xml"
    ) {
        return true;
    }

    if (bytes instanceof Uint8Array && bytes.byteLength > 0) {
        const sampleLength = Math.min(bytes.byteLength, 96);
        let ascii = "";
        for (let i = 0; i < sampleLength; i += 1) {
            const code = bytes[i];
            if (code >= 9 && code <= 126) {
                ascii += String.fromCharCode(code);
            }
        }
        const trimmed = ascii.trimStart().toLowerCase();
        if (
            trimmed.startsWith("<!doctype html") ||
            trimmed.startsWith("<html") ||
            trimmed.startsWith("<?xml")
        ) {
            return true;
        }
    }

    return false;
}
