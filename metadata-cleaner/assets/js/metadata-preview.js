/* =========================================================
   GEN-Z.AI
   AI METADATA CLEANER
   ---------------------------------------------------------
   File:
   metadata-cleaner/assets/js/metadata-preview.js

   Tanggung jawab:
   - Preview image asli
   - Preview video asli
   - Preview hasil cleaning
   - Menyesuaikan rasio media
   - Mengelola Object URL
   - Mencegah createObjectURL() menerima string
   - Mendukung:
       1. Blob
       2. File
       3. Object URL string
========================================================= */


/* =========================================================
   STATE
========================================================= */

import {
    state
} from "./metadata-state.js";


/* =========================================================
   DOM
========================================================= */

import {
    elements
} from "./metadata-dom.js";


/* =========================================================
   ELEMENT HELPERS
========================================================= */

export function showElement(
    element
) {

    if (
        !element
    ) {

        return;

    }


    element.hidden =
        false;


    element.style.removeProperty(
        "display"
    );


    if (
        element.tagName === "IMG" ||
        element.tagName === "VIDEO"
    ) {

        element.style.display =
            "block";

    }

}


export function hideElement(
    element
) {

    if (
        !element
    ) {

        return;

    }


    element.hidden =
        true;


    element.style.display =
        "none";

}


/* =========================================================
   DOM LOOKUP
========================================================= */

function getPreviewStage() {

    return (
        elements?.previewStage ||
        document.getElementById(
            "metadata-preview-stage"
        )
    );

}


function getOriginalImage() {

    return (
        elements?.imagePreview ||
        document.getElementById(
            "metadata-image-preview"
        )
    );

}


function getOriginalVideo() {

    return (
        elements?.videoPreview ||
        document.getElementById(
            "metadata-video-preview"
        )
    );

}


function getCleanImage() {

    return (
        elements?.cleanImagePreview ||
        document.getElementById(
            "metadata-clean-image-preview"
        )
    );

}


function getCleanVideo() {

    return (
        elements?.cleanVideoPreview ||
        document.getElementById(
            "metadata-clean-video-preview"
        )
    );

}


function getPreviewEmpty() {

    return (
        elements?.previewEmpty ||
        document.getElementById(
            "metadata-preview-empty"
        )
    );

}


/* =========================================================
   SAFE OBJECT URL CHECK
========================================================= */

function isObjectUrl(
    value
) {

    return (
        typeof value === "string" &&
        (
            value.startsWith("blob:") ||
            value.startsWith("data:")
        )
    );

}


/* =========================================================
   SAFE BLOB CHECK
========================================================= */

function isBlob(
    value
) {

    return (
        value instanceof Blob
    );

}


/* =========================================================
   CREATE PREVIEW URL
   ---------------------------------------------------------
   IMPORTANT:

   String:
       gunakan langsung

   Blob/File:
       baru buat Object URL

   Object lain:
       JANGAN dikirim ke URL.createObjectURL()
========================================================= */

function createPreviewUrl(
    source
) {

    if (
        typeof source === "string"
    ) {

        if (
            isObjectUrl(
                source
            )
        ) {

            return {
                url: source,
                owned: false
            };

        }


        console.error(
            "[GEN-Z.AI] Preview source string bukan Object URL:",
            source
        );


        return null;

    }


    if (
        isBlob(
            source
        )
    ) {

        try {

            const url =
                URL.createObjectURL(
                    source
                );


            return {
                url,
                owned: true
            };

        } catch (
            error
        ) {

            console.error(
                "[GEN-Z.AI] createObjectURL gagal:",
                error,
                source
            );


            return null;

        }

    }


    console.error(
        "[GEN-Z.AI] Preview source harus Blob/File atau Object URL.",
        source
    );


    return null;

}


/* =========================================================
   SAFE REVOKE
========================================================= */

function revokeUrl(
    url
) {

    if (
        !isObjectUrl(
            url
        )
    ) {

        return;

    }


    /*
       data: URL tidak perlu direvoke.
    */

    if (
        url.startsWith(
            "data:"
        )
    ) {

        return;

    }


    try {

        URL.revokeObjectURL(
            url
        );

    } catch (
        error
    ) {

        console.warn(
            "[GEN-Z.AI] Gagal revoke Object URL:",
            error
        );

    }

}


/* =========================================================
   RESET PREVIEW STAGE
========================================================= */

function resetPreviewStage() {

    const stage =
        getPreviewStage();


    if (
        !stage
    ) {

        return;

    }


    stage.style.removeProperty(
        "aspect-ratio"
    );


    stage.style.removeProperty(
        "height"
    );


    stage.style.removeProperty(
        "min-height"
    );


    stage.style.removeProperty(
        "max-height"
    );


    stage.style.removeProperty(
        "width"
    );


    stage.style.removeProperty(
        "min-width"
    );


    stage.style.removeProperty(
        "max-width"
    );


    stage.style.removeProperty(
        "padding-top"
    );


    stage.style.removeProperty(
        "padding-bottom"
    );


    stage.style.removeProperty(
        "padding-left"
    );


    stage.style.removeProperty(
        "padding-right"
    );


    delete stage.dataset.previewWidth;
    delete stage.dataset.previewHeight;
    delete stage.dataset.previewRatio;

}


/* =========================================================
   APPLY MEDIA RATIO
========================================================= */

function applyMediaRatio(
    media
) {

    const stage =
        getPreviewStage();


    if (
        !stage ||
        !media
    ) {

        return false;

    }


    const width =
        Number(
            media.naturalWidth ||
            media.videoWidth ||
            0
        );


    const height =
        Number(
            media.naturalHeight ||
            media.videoHeight ||
            0
        );


    if (
        !Number.isFinite(width) ||
        !Number.isFinite(height) ||
        width <= 0 ||
        height <= 0
    ) {

        return false;

    }


    const ratio =
        width / height;


    if (
        !Number.isFinite(ratio) ||
        ratio <= 0
    ) {

        return false;

    }


    /*
       Hapus constraint lama.
    */

    stage.style.removeProperty(
        "height"
    );


    stage.style.removeProperty(
        "max-height"
    );


    /*
       Preview mengikuti lebar container.
    */

    stage.style.width =
        "100%";


    stage.style.minHeight =
        "0";


    stage.style.height =
        "auto";


    stage.style.aspectRatio =
        `${width} / ${height}`;


    stage.dataset.previewWidth =
        String(
            width
        );


    stage.dataset.previewHeight =
        String(
            height
        );


    stage.dataset.previewRatio =
        String(
            ratio
        );


    return true;

}


/* =========================================================
   APPLY MEDIA STYLE
========================================================= */

function applyMediaStyle(
    media
) {

    if (
        !media
    ) {

        return;

    }


    media.style.display =
        "block";


    media.style.width =
        "100%";


    media.style.height =
        "100%";


    media.style.maxWidth =
        "100%";


    media.style.maxHeight =
        "100%";


    media.style.minWidth =
        "0";


    media.style.minHeight =
        "0";


    media.style.margin =
        "0";


    media.style.padding =
        "0";


    media.style.objectFit =
        "contain";


    media.style.objectPosition =
        "center";


    media.style.boxSizing =
        "border-box";

}


/* =========================================================
   IMAGE LOADED
========================================================= */

function handleImageLoaded(
    image
) {

    if (
        !image
    ) {

        return;

    }


    applyMediaRatio(
        image
    );


    applyMediaStyle(
        image
    );

}


/* =========================================================
   VIDEO METADATA LOADED
========================================================= */

function handleVideoLoaded(
    video
) {

    if (
        !video
    ) {

        return;

    }


    applyMediaRatio(
        video
    );


    applyMediaStyle(
        video
    );

}


/* =========================================================
   RENDER IMAGE PREVIEW
========================================================= */

export function renderImagePreview(
    src
) {

    const image =
        getOriginalImage();


    const video =
        getOriginalVideo();


    const empty =
        getPreviewEmpty();


    if (
        !image
    ) {

        console.error(
            "[GEN-Z.AI] metadata-image-preview tidak ditemukan."
        );

        return false;

    }


    if (
        video
    ) {

        video.pause?.();


        video.removeAttribute(
            "src"
        );


        try {

            video.load();

        } catch (
            error
        ) {

            console.warn(
                "[GEN-Z.AI] Gagal reset video:",
                error
            );

        }


        hideElement(
            video
        );

    }


    if (
        empty
    ) {

        hideElement(
            empty
        );

    }


    resetPreviewStage();


    image.onload =
        function () {

            handleImageLoaded(
                image
            );

        };


    image.onerror =
        function (error) {

            console.error(
                "[GEN-Z.AI] Image preview gagal dimuat:",
                error
            );

        };


    image.removeAttribute(
        "srcset"
    );


    image.src =
        String(
            src || ""
        );


    showElement(
        image
    );


    if (
        image.complete &&
        image.naturalWidth > 0
    ) {

        handleImageLoaded(
            image
        );

    }


    return true;

}


/* =========================================================
   RENDER VIDEO PREVIEW
========================================================= */

export function renderVideoPreview(
    src
) {

    const image =
        getOriginalImage();


    const video =
        getOriginalVideo();


    const empty =
        getPreviewEmpty();


    if (
        !video
    ) {

        console.error(
            "[GEN-Z.AI] metadata-video-preview tidak ditemukan."
        );

        return false;

    }


    if (
        image
    ) {

        image.removeAttribute(
            "src"
        );


        image.removeAttribute(
            "srcset"
        );


        hideElement(
            image
        );

    }


    if (
        empty
    ) {

        hideElement(
            empty
        );

    }


    resetPreviewStage();


    video.onloadedmetadata =
        function () {

            handleVideoLoaded(
                video
            );

        };


    video.onerror =
        function (error) {

            console.error(
                "[GEN-Z.AI] Video preview gagal dimuat:",
                error
            );

        };


    video.pause?.();


    video.removeAttribute(
        "src"
    );


    try {

        video.load();

    } catch (
        error
    ) {

        console.warn(
            "[GEN-Z.AI] Gagal reset video:",
            error
        );

    }


    video.src =
        String(
            src || ""
        );


    try {

        video.load();

    } catch (
        error
    ) {

        console.warn(
            "[GEN-Z.AI] Gagal load video:",
            error
        );

    }


    showElement(
        video
    );


    if (
        video.videoWidth > 0 &&
        video.videoHeight > 0
    ) {

        handleVideoLoaded(
            video
        );

    }


    return true;

}


/* =========================================================
   RENDER ORIGINAL FILE
========================================================= */

export function renderOriginalPreview(
    file
) {

    if (
        !file
    ) {

        clearOriginalPreview();

        return false;

    }


    if (
        !isBlob(
            file
        )
    ) {

        console.error(
            "[GEN-Z.AI] File original bukan Blob/File:",
            file
        );

        return false;

    }


    /*
       Hapus URL lama.
    */

    if (
        state.originalPreviewUrl
    ) {

        revokeUrl(
            state.originalPreviewUrl
        );

    }


    const preview =
        createPreviewUrl(
            file
        );


    if (
        !preview
    ) {

        return false;

    }


    state.originalPreviewUrl =
        preview.url;


    const type =
        String(
            file.type || ""
        ).toLowerCase();


    if (
        type.startsWith(
            "image/"
        )
    ) {

        return renderImagePreview(
            preview.url
        );

    }


    if (
        type.startsWith(
            "video/"
        )
    ) {

        return renderVideoPreview(
            preview.url
        );

    }


    console.error(
        "[GEN-Z.AI] Format preview tidak didukung:",
        file.type
    );


    clearOriginalPreview();


    return false;

}


/* =========================================================
   RENDER CLEANED IMAGE
========================================================= */

function renderCleanedImage(
    src
) {

    const image =
        getCleanImage();


    const video =
        getCleanVideo();


    if (
        !image
    ) {

        console.error(
            "[GEN-Z.AI] metadata-clean-image-preview tidak ditemukan."
        );

        return false;

    }


    if (
        video
    ) {

        video.pause?.();


        video.removeAttribute(
            "src"
        );


        try {

            video.load();

        } catch (
            error
        ) {

            console.warn(
                "[GEN-Z.AI] Gagal reset cleaned video:",
                error
            );

        }


        hideElement(
            video
        );

    }


    image.onload =
        function () {

            applyMediaStyle(
                image
            );

        };


    image.onerror =
        function (error) {

            console.error(
                "[GEN-Z.AI] Cleaned image gagal dimuat:",
                error
            );

        };


    image.removeAttribute(
        "srcset"
    );


    image.src =
        String(
            src || ""
        );


    showElement(
        image
    );


    return true;

}


/* =========================================================
   RENDER CLEANED VIDEO
========================================================= */

function renderCleanedVideo(
    src
) {

    const image =
        getCleanImage();


    const video =
        getCleanVideo();


    if (
        !video
    ) {

        console.error(
            "[GEN-Z.AI] metadata-clean-video-preview tidak ditemukan."
        );

        return false;

    }


    if (
        image
    ) {

        image.removeAttribute(
            "src"
        );


        image.removeAttribute(
            "srcset"
        );


        hideElement(
            image
        );

    }


    video.onloadedmetadata =
        function () {

            applyMediaStyle(
                video
            );

        };


    video.onerror =
        function (error) {

            console.error(
                "[GEN-Z.AI] Cleaned video gagal dimuat:",
                error
            );

        };


    video.pause?.();


    video.removeAttribute(
        "src"
    );


    try {

        video.load();

    } catch (
        error
    ) {

        console.warn(
            "[GEN-Z.AI] Gagal reset cleaned video:",
            error
        );

    }


    video.src =
        String(
            src || ""
        );


    try {

        video.load();

    } catch (
        error
    ) {

        console.warn(
            "[GEN-Z.AI] Gagal load cleaned video:",
            error
        );

    }


    showElement(
        video
    );


    return true;

}


/* =========================================================
   RENDER CLEANED PREVIEW
   ---------------------------------------------------------
   Dapat menerima:

   Blob:
       renderCleanedPreview(blob)

   Object URL:
       renderCleanedPreview("blob:...")

   Keduanya aman.

   Tidak pernah memanggil createObjectURL()
   terhadap string.
========================================================= */

export function renderCleanedPreview(
    source
) {

    if (
        !source
    ) {

        console.error(
            "[GEN-Z.AI] Cleaned preview source kosong."
        );

        return false;

    }


    /*
       Hapus cleaned preview sebelumnya.

       clearCleanedPreview() akan melepaskan URL
       yang memang dimiliki state.
    */

    clearCleanedPreview();


    /*
       Tentukan apakah source:
       - Blob/File
       - Object URL
    */

    const preview =
        createPreviewUrl(
            source
        );


    if (
        !preview
    ) {

        console.error(
            "[GEN-Z.AI] Cleaned preview tidak dapat dibuat."
        );

        return false;

    }


    /*
       Simpan URL agar download module dan lifecycle
       dapat menggunakannya.
    */

    state.cleanedPreviewUrl =
        preview.url;


    state.cleanedURL =
        preview.url;


    /*
       Jika Blob, type berasal dari Blob.
       Jika URL string, type tidak diketahui dari URL.

       Untuk string, coba tentukan dari state.fileType.
    */

    let type =
        "";


    if (
        isBlob(
            source
        )
    ) {

        type =
            String(
                source.type || ""
            ).toLowerCase();

    }


    if (
        !type
    ) {

        type =
            String(
                state.fileType || ""
            ).toLowerCase();

    }


    /*
       IMAGE
    */

    if (
        type === "image" ||
        type.startsWith(
            "image/"
        )
    ) {

        return renderCleanedImage(
            preview.url
        );

    }


    /*
       VIDEO
    */

    if (
        type === "video" ||
        type.startsWith(
            "video/"
        )
    ) {

        return renderCleanedVideo(
            preview.url
        );

    }


    /*
       Jika type Blob kosong tetapi source merupakan
       URL blob, coba gunakan file aktif.
    */

    const activeType =
        String(
            state.file?.type || ""
        ).toLowerCase();


    if (
        activeType.startsWith(
            "image/"
        )
    ) {

        return renderCleanedImage(
            preview.url
        );

    }


    if (
        activeType.startsWith(
            "video/"
        )
    ) {

        return renderCleanedVideo(
            preview.url
        );

    }


    console.error(
        "[GEN-Z.AI] Jenis cleaned preview tidak dapat ditentukan.",
        {
            sourceType:
                typeof source,

            blobType:
                source?.type || null,

            stateFileType:
                state.fileType || null,

            activeFileType:
                state.file?.type || null
        }
    );


    /*
       Jangan biarkan URL menggantung jika
       format tidak dapat ditentukan.
    */

    if (
        preview.owned
    ) {

        revokeUrl(
            preview.url
        );

    }


    state.cleanedPreviewUrl =
        null;


    state.cleanedURL =
        null;


    return false;

}


/* =========================================================
   CLEAR ORIGINAL PREVIEW
========================================================= */

export function clearOriginalPreview() {

    const image =
        getOriginalImage();


    const video =
        getOriginalVideo();


    const empty =
        getPreviewEmpty();


    if (
        image
    ) {

        image.onload =
            null;


        image.onerror =
            null;


        image.removeAttribute(
            "src"
        );


        image.removeAttribute(
            "srcset"
        );


        hideElement(
            image
        );

    }


    if (
        video
    ) {

        video.onloadedmetadata =
            null;


        video.onerror =
            null;


        try {

            video.pause();

        } catch (
            error
        ) {

            console.warn(
                "[GEN-Z.AI] Gagal pause original video:",
                error
            );

        }


        video.removeAttribute(
            "src"
        );


        try {

            video.load();

        } catch (
            error
        ) {

            console.warn(
                "[GEN-Z.AI] Gagal reset original video:",
                error
            );

        }


        hideElement(
            video
        );

    }


    if (
        empty
    ) {

        showElement(
            empty
        );

    }


    if (
        state.originalPreviewUrl
    ) {

        revokeUrl(
            state.originalPreviewUrl
        );

    }


    state.originalPreviewUrl =
        null;


    resetPreviewStage();

}


/* =========================================================
   CLEAR CLEANED PREVIEW
========================================================= */

export function clearCleanedPreview() {

    const image =
        getCleanImage();


    const video =
        getCleanVideo();


    const cleanedUrl =
        state.cleanedURL;


    const previewUrl =
        state.cleanedPreviewUrl;


    /*
       Jangan revoke URL dua kali.
    */

    if (
        cleanedUrl
    ) {

        revokeUrl(
            cleanedUrl
        );

    }


    if (
        previewUrl &&
        previewUrl !== cleanedUrl
    ) {

        revokeUrl(
            previewUrl
        );

    }


    if (
        image
    ) {

        image.onload =
            null;


        image.onerror =
            null;


        image.removeAttribute(
            "src"
        );


        image.removeAttribute(
            "srcset"
        );


        hideElement(
            image
        );

    }


    if (
        video
    ) {

        video.onloadedmetadata =
            null;


        video.onerror =
            null;


        try {

            video.pause();

        } catch (
            error
        ) {

            console.warn(
                "[GEN-Z.AI] Gagal pause cleaned video:",
                error
            );

        }


        video.removeAttribute(
            "src"
        );


        try {

            video.load();

        } catch (
            error
        ) {

            console.warn(
                "[GEN-Z.AI] Gagal reset cleaned video:",
                error
            );

        }


        hideElement(
            video
        );

    }


    state.cleanedURL =
        null;


    if (
        Object.prototype.hasOwnProperty.call(
            state,
            "cleanedPreviewUrl"
        )
    ) {

        state.cleanedPreviewUrl =
            null;

    }

}


/* =========================================================
   PREVIEW STATUS
========================================================= */

export function setPreviewStatus(
    text
) {

    const status =
        elements?.previewStatus ||
        document.getElementById(
            "metadata-preview-status"
        );


    if (
        !status
    ) {

        return;

    }


    status.textContent =
        String(
            text ?? ""
        );

}


/* =========================================================
   RESET PREVIEW
========================================================= */

export function resetPreview() {

    clearOriginalPreview();

    clearCleanedPreview();

    resetPreviewStage();

}


/* =========================================================
   REFRESH ACTIVE RATIO
========================================================= */

function refreshActivePreviewRatio() {

    const image =
        getOriginalImage();


    const video =
        getOriginalVideo();


    if (
        image &&
        !image.hidden &&
        image.naturalWidth > 0 &&
        image.naturalHeight > 0
    ) {

        applyMediaRatio(
            image
        );

        return;

    }


    if (
        video &&
        !video.hidden &&
        video.videoWidth > 0 &&
        video.videoHeight > 0
    ) {

        applyMediaRatio(
            video
        );

    }

}


/* =========================================================
   RESIZE
========================================================= */

let resizeTimer =
    null;


window.addEventListener(
    "resize",
    function () {

        clearTimeout(
            resizeTimer
        );


        resizeTimer =
            setTimeout(
                refreshActivePreviewRatio,
                100
            );

    },
    {
        passive: true
    }
);


/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default {

    showElement,

    hideElement,

    renderImagePreview,

    renderVideoPreview,

    renderOriginalPreview,

    renderCleanedPreview,

    clearOriginalPreview,

    clearCleanedPreview,

    setPreviewStatus,

    resetPreview

};
