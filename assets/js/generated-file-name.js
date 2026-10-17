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
        const requestedExtension =
            getExtension(url) ||
            String(fallbackExtension).toLowerCase();
        const extension = IMAGE_EXTENSIONS.has(requestedExtension) ||
            VIDEO_EXTENSIONS.has(requestedExtension)
            ? requestedExtension
            : "mp4";

        return `GEN-Z.AI-${getRandomNumber()}.${extension}`;
    }

    window.GENZGeneratedFileName = Object.freeze({ create });
})();
