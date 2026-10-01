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
   - Menyesuaikan preview-stage dengan rasio media asli
   - Menjaga media tidak terdistorsi
   - Mengelola Object URL
   - Menampilkan / menyembunyikan elemen preview

   RULE:
   - Tidak menggunakan rasio 16:9 secara paksa
   - Tidak menggunakan tinggi tetap
   - Tidak menggunakan min-height untuk media aktif
   - Rasio mengikuti ukuran media sebenarnya
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


    /*
       Jika elemen sebelumnya menggunakan
       display:none melalui CSS/class,
       gunakan block/flex sesuai jenis elemen.
    */

    if (
        element.tagName === "VIDEO" ||
        element.tagName === "IMG"
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
   GET PREVIEW STAGE
========================================================= */

function getPreviewStage() {

    return (
        elements?.previewStage ||
        document.getElementById(
            "metadata-preview-stage"
        )
    );

}


/* =========================================================
   GET ORIGINAL MEDIA ELEMENT
========================================================= */

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


/* =========================================================
   GET CLEAN MEDIA ELEMENT
========================================================= */

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


/* =========================================================
   RESET STAGE
   ---------------------------------------------------------
   Menghapus semua ukuran paksa yang pernah diberikan
   kepada preview stage.
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

}


/* =========================================================
   APPLY EXACT MEDIA RATIO
   ---------------------------------------------------------
   Contoh:

   1080 × 1920
   → 9:16

   1920 × 1080
   → 16:9

   1080 × 1080
   → 1:1

   4000 × 3000
   → 4:3
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


    let width =
        Number(
            media.naturalWidth ||
            media.videoWidth ||
            media.width ||
            0
        );


    let height =
        Number(
            media.naturalHeight ||
            media.videoHeight ||
            media.height ||
            0
        );


    /*
       Untuk image/video yang belum memberikan
       intrinsic dimensions, jangan membuat rasio palsu.
    */

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
       Hapus tinggi paksa lebih dahulu.
    */

    stage.style.removeProperty(
        "height"
    );


    stage.style.removeProperty(
        "min-height"
    );


    stage.style.removeProperty(
        "max-height"
    );


    /*
       Stage mengikuti rasio asli media.
    */

    stage.style.width =
        "100%";


    stage.style.aspectRatio =
        `${width} / ${height}`;


    /*
       Jangan membiarkan CSS lama memberi
       minimum height yang merusak rasio.
    */

    stage.style.minHeight =
        "0";


    stage.style.maxHeight =
        "none";


    /*
       Pastikan browser menghitung tinggi berdasarkan
       width + aspect-ratio.
    */

    stage.style.height =
        "auto";


    /*
       Simpan informasi aktual untuk debugging.
    */

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
   MEDIA BASE STYLE
   ---------------------------------------------------------
   Media mengikuti kotak preview tetapi tidak distorsi.
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


    media.style.objectFit =
        "contain";


    media.style.objectPosition =
        "center";


    media.style.margin =
        "0";


    media.style.padding =
        "0";


    media.style.boxSizing =
        "border-box";

}


/* =========================================================
   IMAGE LOAD
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

function handleVideoMetadataLoaded(
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
   RENDER ORIGINAL IMAGE
========================================================= */

export function renderImagePreview(
    src
) {

    const image =
        getOriginalImage();


    const video =
        getOriginalVideo();


    const empty =
        elements?.previewEmpty ||
        document.getElementById(
            "metadata-preview-empty"
        );


    if (
        !image
    ) {

        console.error(
            "[GEN-Z.AI] metadata-image-preview tidak ditemukan."
        );

        return;

    }


    if (
        video
    ) {

        video.pause?.();


        video.removeAttribute(
            "src"
        );


        video.load?.();


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


    /*
       Reset stage dahulu agar tidak membawa
       rasio file sebelumnya.
    */

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
                "[GEN-Z.AI] Gagal memuat image preview:",
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


    /*
       Jika browser sudah memiliki intrinsic dimensions,
       langsung terapkan.
    */

    if (
        image.complete &&
        image.naturalWidth > 0 &&
        image.naturalHeight > 0
    ) {

        handleImageLoaded(
            image
        );

    }

}


/* =========================================================
   RENDER ORIGINAL VIDEO
========================================================= */

export function renderVideoPreview(
    src
) {

    const image =
        getOriginalImage();


    const video =
        getOriginalVideo();


    const empty =
        elements?.previewEmpty ||
        document.getElementById(
            "metadata-preview-empty"
        );


    if (
        !video
    ) {

        console.error(
            "[GEN-Z.AI] metadata-video-preview tidak ditemukan."
        );

        return;

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

            handleVideoMetadataLoaded(
                video
            );

        };


    video.onerror =
        function (error) {

            console.error(
                "[GEN-Z.AI] Gagal memuat video preview:",
                error
            );

        };


    video.pause?.();


    video.removeAttribute(
        "src"
    );


    video.load();


    video.src =
        String(
            src || ""
        );


    video.load();


    showElement(
        video
    );


    /*
       Fallback jika metadata sudah tersedia.
    */

    if (
        video.videoWidth > 0 &&
        video.videoHeight > 0
    ) {

        handleVideoMetadataLoaded(
            video
        );

    }

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

        return;

    }


    /*
       Jangan membuat URL baru jika file tidak valid.
    */

    if (
        !(
            file instanceof File ||
            file instanceof Blob
        )
    ) {

        console.error(
            "[GEN-Z.AI] File preview tidak valid."
        );

        return;

    }


    /*
       Hapus URL preview lama.
    */

    if (
        state.originalPreviewUrl
    ) {

        try {

            URL.revokeObjectURL(
                state.originalPreviewUrl
            );

        } catch (
            error
        ) {

            console.warn(
                "[GEN-Z.AI] Gagal revoke original preview URL:",
                error
            );

        }

    }


    const url =
        URL.createObjectURL(
            file
        );


    state.originalPreviewUrl =
        url;


    const type =
        String(
            file.type || ""
        ).toLowerCase();


    if (
        type.startsWith(
            "image/"
        )
    ) {

        renderImagePreview(
            url
        );

    }


    else if (
        type.startsWith(
            "video/"
        )
    ) {

        renderVideoPreview(
            url
        );

    }


    else {

        console.warn(
            "[GEN-Z.AI] Format preview tidak didukung:",
            file.type
        );

        clearOriginalPreview();

    }

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


        video.load?.();


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
                "[GEN-Z.AI] Gagal memuat cleaned image:",
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
                "[GEN-Z.AI] Gagal memuat cleaned video:",
                error
            );

        };


    video.pause?.();


    video.removeAttribute(
        "src"
    );


    video.load();


    video.src =
        String(
            src || ""
        );


    video.load();


    showElement(
        video
    );


    return true;

}


/* =========================================================
   RENDER CLEANED PREVIEW
   ---------------------------------------------------------
   Menerima:

   1. Blob
   2. File

   Fungsi ini membuat Object URL sendiri.
========================================================= */

export function renderCleanedPreview(
    blob
) {

    if (
        !blob
    ) {

        console.error(
            "[GEN-Z.AI] Cleaned preview gagal: Blob kosong."
        );

        return false;

    }


    if (
        !(
            blob instanceof Blob
        )
    ) {

        console.error(
            "[GEN-Z.AI] Cleaned preview membutuhkan Blob/File.",
            blob
        );

        return false;

    }


    /*
       Hapus preview cleaned lama.
    */

    clearCleanedPreview();


    /*
       Buat URL baru.
    */

    const url =
        URL.createObjectURL(
            blob
        );


    state.cleanedPreviewUrl =
        url;


    /*
       Jika state utama menggunakan cleanedURL,
       sinkronkan.
    */

    state.cleanedURL =
        url;


    const type =
        String(
            blob.type || ""
        ).toLowerCase();


    if (
        type.startsWith(
            "image/"
        )
    ) {

        return renderCleanedImage(
            url
        );

    }


    if (
        type.startsWith(
            "video/"
        )
    ) {

        return renderCleanedVideo(
            url
        );

    }


    console.error(
        "[GEN-Z.AI] Format cleaned preview tidak didukung:",
        blob.type
    );


    /*
       Jika tipe Blob tidak dikenal,
       bersihkan URL agar tidak bocor.
    */

    try {

        URL.revokeObjectURL(
            url
        );

    } catch (
        error
    ) {

        console.warn(
            "[GEN-Z.AI] Gagal revoke unsupported cleaned URL:",
            error
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
        elements?.previewEmpty ||
        document.getElementById(
            "metadata-preview-empty"
        );


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

        try {

            URL.revokeObjectURL(
                state.originalPreviewUrl
            );

        } catch (
            error
        ) {

            console.warn(
                "[GEN-Z.AI] Gagal revoke original preview URL:",
                error
            );

        }

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


    /*
       Jangan revoke URL dua kali jika kedua state
       menunjuk URL yang sama.
    */

    const cleanedUrl =
        state.cleanedURL;


    const previewUrl =
        state.cleanedPreviewUrl;


    if (
        cleanedUrl
    ) {

        try {

            URL.revokeObjectURL(
                cleanedUrl
            );

        } catch (
            error
        ) {

            console.warn(
                "[GEN-Z.AI] Gagal revoke cleaned URL:",
                error
            );

        }

    }


    if (
        previewUrl &&
        previewUrl !== cleanedUrl
    ) {

        try {

            URL.revokeObjectURL(
                previewUrl
            );

        } catch (
            error
        ) {

            console.warn(
                "[GEN-Z.AI] Gagal revoke cleaned preview URL:",
                error
            );

        }

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
   RESIZE HANDLER
   ---------------------------------------------------------
   Ketika viewport berubah, rasio tetap mengikuti
   intrinsic dimensions media.
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
