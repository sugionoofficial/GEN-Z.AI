(function () {
    "use strict";

    const IMAGE_EXTENSIONS = new Set([
        "avif",
        "bmp",
        "gif",
        "jpeg",
        "jpg",
        "png",
        "webp"
    ]);
    const VIDEO_EXTENSIONS = new Set([
        "m4v",
        "mov",
        "mp4",
        "mpeg",
        "mpg",
        "webm"
    ]);
    const AUDIO_EXTENSIONS = new Set([
        "aac",
        "flac",
        "m4a",
        "mp3",
        "ogg",
        "opus",
        "wav"
    ]);
    const TEXT_EXPORT_EXTENSIONS = new Set([
        "srt",
        "txt",
        "vtt"
    ]);

    function isAllowedExtension(ext) {
        return (
            IMAGE_EXTENSIONS.has(ext) ||
            VIDEO_EXTENSIONS.has(ext) ||
            AUDIO_EXTENSIONS.has(ext) ||
            TEXT_EXPORT_EXTENSIONS.has(ext)
        );
    }

    function getRandomNumber() {
        const values = new Uint32Array(1);

        if (window.crypto?.getRandomValues) {
            window.crypto.getRandomValues(values);
        } else {
            values[0] = Math.floor(Math.random() * 0x100000000);
        }

        return String(values[0] % 10000000000).padStart(10, "0");
    }

    function getExtension(url) {
        if (!url) {
            return "";
        }

        try {
            const parsedUrl = new URL(
                url,
                window.location?.href || "https://genzai.local/"
            );
            const match = parsedUrl.pathname.match(/\.([a-z0-9]+)$/i);
            return match ? match[1].toLowerCase() : "";
        } catch {
            return "";
        }
    }

    function create(url, fallbackExtension = "mp4") {
        const cleanFallback = String(fallbackExtension || "mp4").toLowerCase();
        const urlExt = getExtension(url);
        const extension = isAllowedExtension(urlExt)
            ? urlExt
            : isAllowedExtension(cleanFallback)
                ? cleanFallback
                : "mp4";

        return `GEN-Z.AI-${getRandomNumber()}.${extension}`;
    }

    window.GENZGeneratedFileName = Object.freeze({ create });
})();
