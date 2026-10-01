/* =========================================================
   GEN-Z.AI
   METADATA CLEANER
   ---------------------------------------------------------
   File:
   metadata-cleaner/assets/js/metadata-preview.js

   Tanggung jawab:
   - Render original image preview
   - Render original video preview
   - Render cleaned media preview
   - Mengontrol visibility preview
   - Mengontrol preview status
   - Tidak menangani:
       * file selection
       * metadata extraction
       * AI detection
       * cleaning
       * download
       * upload
       * state mutation
========================================================= */

import { state } from "./metadata-state.js";
import { elements } from "./metadata-dom.js";


/* =========================================================
   INTERNAL CONSTANTS
========================================================= */

const PREVIEW_MAX_HEIGHT = "540px";


/* =========================================================
   INTERNAL HELPERS
========================================================= */

/**
 * Memastikan elemen preview benar-benar terlihat.
 *
 * Penting:
 * metadata-app.js sebelumnya pernah memberikan inline:
 *
 * display:none !important
 * visibility:hidden !important
 * opacity:0 !important
 *
 * Menghapus class .hidden saja TIDAK cukup.
 *
 * Karena itu semua inline visibility state dibersihkan
 * dan kemudian dipaksa visible.
 */
function showPreview(element) {

    if (!element) {
        return;
    }

    element.hidden = false;

    element.removeAttribute("hidden");

    element.classList.remove("hidden");

    element.style.setProperty(
        "display",
        "block",
        "important"
    );

    element.style.setProperty(
        "visibility",
        "visible",
        "important"
    );

    element.style.setProperty(
        "opacity",
        "1",
        "important"
    );

    element.style.setProperty(
        "max-width",
        "100%",
        "important"
    );

    element.style.setProperty(
        "max-height",
        PREVIEW_MAX_HEIGHT,
        "important"
    );

    element.style.setProperty(
        "width",
        "auto",
        "important"
    );

    element.style.setProperty(
        "height",
        "auto",
        "important"
    );

    element.style.setProperty(
        "object-fit",
        "contain",
        "important"
    );

    element.style.setProperty(
        "position",
        "relative",
        "important"
    );

    element.style.setProperty(
        "z-index",
        "2",
        "important"
    );

    element.style.setProperty(
        "flex-shrink",
        "0",
        "important"
    );
}


/**
 * Menyembunyikan elemen preview secara konsisten.
 */
function hidePreview(element) {

    if (!element) {
        return;
    }

    element.hidden = true;

    element.setAttribute(
        "hidden",
        ""
    );

    element.classList.add("hidden");

    element.style.setProperty(
        "display",
        "none",
        "important"
    );

    element.style.setProperty(
        "visibility",
        "hidden",
        "important"
    );

    element.style.setProperty(
        "opacity",
        "0",
        "important"
    );
}


/**
 * Membersihkan sumber video lama.
 *
 * Ini mencegah <source> lama tetap aktif ketika preview
 * berpindah file.
 */
function clearVideoSources(video) {

    if (!video) {
        return;
    }

    const sources =
        video.querySelectorAll("source");

    sources.forEach(
        (source) => {

            source.removeAttribute("src");

            source.remove();
        }
    );
}


/**
 * Membersihkan src video tanpa menghapus elemen video.
 */
function resetVideo(video) {

    if (!video) {
        return;
    }

    try {

        video.pause();

    } catch (error) {

        /* noop */

    }

    video.removeAttribute("src");

    clearVideoSources(video);

    try {

        video.load();

    } catch (error) {

        /* noop */

    }
}


/**
 * Menampilkan preview kosong.
 */
function showEmptyPreview() {

    showElement(
        elements?.previewEmpty
    );
}


/**
 * Menyembunyikan preview kosong.
 */
function hideEmptyPreview() {

    hideElement(
        elements?.previewEmpty
    );
}


/* =========================================================
   ORIGINAL PREVIEW
========================================================= */

export function renderOriginalPreview() {

    const image =
        elements?.imagePreview;

    const video =
        elements?.videoPreview;

    const empty =
        elements?.previewEmpty;

    const overlay =
        elements?.aiOverlay;


    /* -----------------------------------------------------
       RESET VISUAL STATE
    ----------------------------------------------------- */

    hidePreview(image);

    hidePreview(video);

    hideElement(overlay);


    /* -----------------------------------------------------
       NO FILE
    ----------------------------------------------------- */

    if (
        !state.file ||
        !state.originalURL
    ) {

        showEmptyPreview();

        return;
    }


    /* -----------------------------------------------------
       FILE EXISTS
    ----------------------------------------------------- */

    hideEmptyPreview();


    /* =====================================================
       IMAGE
    ===================================================== */

    if (
        state.fileType === "image"
    ) {

        if (!image) {
            return;
        }


        /* ---------------------------------------------
           Reset old handlers
        --------------------------------------------- */

        image.onload = null;

        image.onerror = null;


        /* ---------------------------------------------
           Configure image
        --------------------------------------------- */

        image.removeAttribute("hidden");

        image.classList.remove(
            "hidden"
        );

        image.alt =
            state.file?.name ||
            "Image preview";

        image.decoding = "async";

        image.loading = "eager";


        /* ---------------------------------------------
           Clear previous source
        --------------------------------------------- */

        image.removeAttribute(
            "src"
        );


        /* ---------------------------------------------
           Force visible BEFORE src
        --------------------------------------------- */

        showPreview(image);


        /* ---------------------------------------------
           Load image
        --------------------------------------------- */

        image.onload = () => {

            if (
                state.file &&
                state.fileType === "image" &&
                state.originalURL
            ) {

                showPreview(image);

                hideEmptyPreview();
            }
        };


        image.onerror = () => {

            hidePreview(image);

            showEmptyPreview();

            setPreviewStatus(
                "Gagal menampilkan preview gambar."
            );
        };


        image.src =
            state.originalURL;


        /* ---------------------------------------------
           Cached image safety
        --------------------------------------------- */

        if (
            image.complete &&
            image.naturalWidth > 0
        ) {

            showPreview(image);

            hideEmptyPreview();
        }


        return;
    }


    /* =====================================================
       VIDEO
    ===================================================== */

    if (
        state.fileType === "video"
    ) {

        if (!video) {
            return;
        }


        /* ---------------------------------------------
           Reset video
        --------------------------------------------- */

        resetVideo(video);


        video.controls = true;

        video.playsInline = true;

        video.preload = "metadata";

        video.autoplay = false;

        video.loop = false;


        /* ---------------------------------------------
           Remove hidden state
        --------------------------------------------- */

        video.removeAttribute(
            "hidden"
        );

        video.classList.remove(
            "hidden"
        );


        /* ---------------------------------------------
           Event handlers
        --------------------------------------------- */

        video.onloadedmetadata = () => {

            showPreview(video);

            hideEmptyPreview();
        };


        video.onloadeddata = () => {

            showPreview(video);

            hideEmptyPreview();
        };


        video.oncanplay = () => {

            showPreview(video);

            hideEmptyPreview();
        };


        video.onerror = () => {

            hidePreview(video);

            showEmptyPreview();

            setPreviewStatus(
                "Format video tidak dapat ditampilkan browser."
            );
        };


        /* ---------------------------------------------
           Force visible BEFORE assigning src
        --------------------------------------------- */

        showPreview(video);


        /* ---------------------------------------------
           Assign object URL
        --------------------------------------------- */

        video.src =
            state.originalURL;


        /* ---------------------------------------------
           Force browser to reload media
        --------------------------------------------- */

        try {

            video.load();

        } catch (error) {

            /* noop */

        }


        return;
    }


    /* =====================================================
       UNKNOWN FILE TYPE
    ===================================================== */

    showEmptyPreview();
}


/* =========================================================
   CLEANED PREVIEW
========================================================= */

export function renderCleanedPreview(
    url
) {

    const image =
        elements?.imagePreview;

    const video =
        elements?.videoPreview;

    const empty =
        elements?.previewEmpty;

    const overlay =
        elements?.aiOverlay;


    /* -----------------------------------------------------
       RESET
    ----------------------------------------------------- */

    hidePreview(image);

    hidePreview(video);

    hideElement(overlay);


    /* -----------------------------------------------------
       No cleaned URL
    ----------------------------------------------------- */

    if (!url) {

        if (
            state.file &&
            state.originalURL
        ) {

            renderOriginalPreview();

            return;
        }

        showEmptyPreview();

        return;
    }


    /* -----------------------------------------------------
       Hide empty state
    ----------------------------------------------------- */

    hideEmptyPreview();


    /* =====================================================
       CLEANED IMAGE
    ===================================================== */

    if (
        state.fileType === "image"
    ) {

        if (!image) {
            return;
        }


        image.onload = null;

        image.onerror = null;


        image.removeAttribute(
            "hidden"
        );

        image.classList.remove(
            "hidden"
        );


        image.alt =
            state.file?.name ||
            "Cleaned image preview";

        image.decoding = "async";

        image.loading = "eager";


        image.removeAttribute(
            "src"
        );


        showPreview(image);


        image.onload = () => {

            showPreview(image);

            hideEmptyPreview();
        };


        image.onerror = () => {

            hidePreview(image);

            showEmptyPreview();

            setPreviewStatus(
                "Gagal menampilkan preview hasil."
            );
        };


        image.src = url;


        if (
            image.complete &&
            image.naturalWidth > 0
        ) {

            showPreview(image);

            hideEmptyPreview();
        }


        return;
    }


    /* =====================================================
       CLEANED VIDEO
    ===================================================== */

    if (
        state.fileType === "video"
    ) {

        if (!video) {
            return;
        }


        resetVideo(video);


        video.controls = true;

        video.playsInline = true;

        video.preload = "metadata";

        video.autoplay = false;

        video.loop = false;


        video.removeAttribute(
            "hidden"
        );

        video.classList.remove(
            "hidden"
        );


        video.onloadedmetadata = () => {

            showPreview(video);

            hideEmptyPreview();
        };


        video.onloadeddata = () => {

            showPreview(video);

            hideEmptyPreview();
        };


        video.oncanplay = () => {

            showPreview(video);

            hideEmptyPreview();
        };


        video.onerror = () => {

            hidePreview(video);

            showEmptyPreview();

            setPreviewStatus(
                "Gagal menampilkan preview hasil video."
            );
        };


        showPreview(video);


        video.src = url;


        try {

            video.load();

        } catch (error) {

            /* noop */

        }


        return;
    }


    /* -----------------------------------------------------
       Unknown cleaned media
    ----------------------------------------------------- */

    showEmptyPreview();
}


/* =========================================================
   PREVIEW STATUS
========================================================= */

export function setPreviewStatus(
    text
) {

    const status =
        elements?.previewStatus;

    if (!status) {
        return;
    }


    if (
        text === undefined ||
        text === null ||
        String(text).trim() === ""
    ) {

        status.textContent = "";

        hideElement(status);

        return;
    }


    status.textContent =
        String(text);

    showElement(status);
}


/* =========================================================
   GENERIC SHOW
========================================================= */

export function showElement(
    element
) {

    if (!element) {
        return;
    }


    element.hidden = false;

    element.removeAttribute(
        "hidden"
    );

    element.classList.remove(
        "hidden"
    );


    /*
     * Untuk elemen preview media, gunakan
     * showPreview() agar inline style lama
     * juga dibersihkan.
     */
}


/* =========================================================
   GENERIC HIDE
========================================================= */

export function hideElement(
    element
) {

    if (!element) {
        return;
    }


    element.hidden = true;

    element.setAttribute(
        "hidden",
        ""
    );

    element.classList.add(
        "hidden"
    );
}


/* =========================================================
   EXPORT INTERNAL PREVIEW HELPERS
   ---------------------------------------------------------
   Tidak digunakan oleh module lain secara normal,
   tetapi disediakan agar tidak perlu membuat implementasi
   visibility kedua di file lain.
========================================================= */

export {
    showPreview,
    hidePreview,
    resetVideo,
    clearVideoSources
};
