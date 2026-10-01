/* =========================================================
   GEN-Z.AI
   AI METADATA CLEANER
   ---------------------------------------------------------
   File:
   metadata-cleaner/assets/js/metadata-preview.js

   Tanggung jawab:
   - Original image preview
   - Original video preview
   - Cleaned image preview
   - Cleaned video preview
   - Preview status
   - Preview visibility
   - Aspect ratio preview
   - Clear preview
   - Safe preview rendering

   IMPORTANT:
   - Preview mengikuti aspect ratio media asli.
   - Tidak menggunakan object-fit: cover.
   - Tidak memotong foto/video.
   - Tidak memaksakan min-height pada media aktif.
   - Export showElement / hideElement dipertahankan
     untuk kompatibilitas metadata-clean.js.
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
   INTERNAL
========================================================= */

let activePreviewObjectUrl = null;


/* =========================================================
   SHOW ELEMENT
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
       Beberapa elemen GEN-Z.AI menggunakan
       class hidden / is-hidden.
    */

    element.classList.remove(
        "hidden"
    );


    element.classList.remove(
        "is-hidden"
    );

}


/* =========================================================
   HIDE ELEMENT
========================================================= */

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


    element.classList.add(
        "hidden"
    );

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
   RESET STAGE RATIO
========================================================= */

function resetPreviewStageRatio() {

    const stage =
        getPreviewStage();


    if (
        !stage
    ) {

        return;
    }


    /*
       Jangan memberikan aspect-ratio
       ketika belum ada media.

       Dengan begitu stage dapat mengikuti
       layout empty-state normal.
    */

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
        "max-width"
    );

}


/* =========================================================
   SET STAGE RATIO
   ---------------------------------------------------------
   width / height
========================================================= */

function setPreviewStageRatio(
    width,
    height
) {

    const stage =
        getPreviewStage();


    if (
        !stage
    ) {

        return;
    }


    const numericWidth =
        Number(
            width
        );


    const numericHeight =
        Number(
            height
        );


    if (
        !Number.isFinite(
            numericWidth
        ) ||
        !Number.isFinite(
            numericHeight
        ) ||
        numericWidth <= 0 ||
        numericHeight <= 0
    ) {

        resetPreviewStageRatio();

        return;
    }


    /*
       Aspect ratio CSS menggunakan:

           width / height

       Contoh:

           1920 / 1080
           1080 / 1920
           1 / 1
           4 / 3
    */

    stage.style.aspectRatio =
        `${numericWidth} / ${numericHeight}`;


    stage.style.height =
        "auto";


    stage.style.minHeight =
        "0";


    stage.style.maxHeight =
        "none";


    stage.style.width =
        "100%";


    stage.style.maxWidth =
        "100%";


    stage.style.boxSizing =
        "border-box";


    stage.style.overflow =
        "hidden";


    stage.style.display =
        "flex";


    stage.style.alignItems =
        "center";


    stage.style.justifyContent =
        "center";

}


/* =========================================================
   APPLY MEDIA DIMENSIONS
========================================================= */

function applyMediaDimensions(
    media
) {

    if (
        !media
    ) {

        return;
    }


    let width =
        Number(
            media.naturalWidth
        );


    let height =
        Number(
            media.naturalHeight
        );


    /*
       Video tidak mempunyai naturalWidth /
       naturalHeight seperti image.

       Gunakan videoWidth / videoHeight.
    */

    if (
        width <= 0 ||
        height <= 0
    ) {

        width =
            Number(
                media.videoWidth
            );


        height =
            Number(
                media.videoHeight
            );

    }


    if (
        width <= 0 ||
        height <= 0
    ) {

        return;
    }


    setPreviewStageRatio(
        width,
        height
    );


    /*
       Media tidak boleh dipaksa menjadi
       ukuran aspect ratio lain.

       contain memastikan seluruh media
       tetap terlihat.
    */

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


    media.style.objectFit =
        "contain";


    media.style.objectPosition =
        "center center";


    media.style.margin =
        "0";


    media.style.flex =
        "0 0 auto";


    media.style.boxSizing =
        "border-box";

}


/* =========================================================
   IMAGE LOAD HANDLER
========================================================= */

function handleImageLoaded(
    image
) {

    if (
        !image
    ) {

        return;
    }


    applyMediaDimensions(
        image
    );

}


/* =========================================================
   VIDEO METADATA HANDLER
========================================================= */

function handleVideoMetadataLoaded(
    video
) {

    if (
        !video
    ) {

        return;
    }


    applyMediaDimensions(
        video
    );

}


/* =========================================================
   BIND IMAGE DIMENSION HANDLER
========================================================= */

function bindImageDimensionHandler(
    image
) {

    if (
        !image
    ) {

        return;
    }


    image.addEventListener(
        "load",
        () => {

            handleImageLoaded(
                image
            );

        },
        {
            once: false
        }
    );


    /*
       Jika image sudah selesai loading
       sebelum handler dipasang.
    */

    if (
        image.complete
    ) {

        requestAnimationFrame(
            () => {

                handleImageLoaded(
                    image
                );

            }
        );

    }

}


/* =========================================================
   BIND VIDEO DIMENSION HANDLER
========================================================= */

function bindVideoDimensionHandler(
    video
) {

    if (
        !video
    ) {

        return;
    }


    video.addEventListener(
        "loadedmetadata",
        () => {

            handleVideoMetadataLoaded(
                video
            );

        },
        {
            once: false
        }
    );


    /*
       Jika metadata video sudah tersedia.
    */

    if (
        video.videoWidth > 0 &&
        video.videoHeight > 0
    ) {

        requestAnimationFrame(
            () => {

                handleVideoMetadataLoaded(
                    video
                );

            }
        );

    }

}


/* =========================================================
   RENDER IMAGE PREVIEW
========================================================= */

export function renderImagePreview(
    src
) {

    const image =
        elements?.imagePreview;


    const video =
        elements?.videoPreview;


    const empty =
        elements?.previewEmpty;


    const stage =
        getPreviewStage();


    if (
        !image
    ) {

        console.error(
            "[GEN-Z.AI] metadata-preview: image preview element tidak ditemukan."
        );

        return false;
    }


    if (
        !src
    ) {

        console.warn(
            "[GEN-Z.AI] metadata-preview: image source kosong."
        );

        return false;
    }


    /*
       Bersihkan video.
    */

    if (
        video
    ) {

        try {

            video.pause();

        } catch (
            error
        ) {

            console.warn(
                "[GEN-Z.AI] metadata-preview: video pause gagal.",
                error
            );

        }


        video.removeAttribute(
            "src"
        );


        video.load();


        hideElement(
            video
        );

    }


    /*
       Empty state disembunyikan.
    */

    if (
        empty
    ) {

        hideElement(
            empty
        );

    }


    /*
       Set source image.
    */

    image.src =
        src;


    image.alt =
        "Preview media";


    image.decoding =
        "async";


    image.loading =
        "eager";


    image.style.display =
        "block";


    image.style.objectFit =
        "contain";


    image.style.objectPosition =
        "center center";


    image.style.width =
        "100%";


    image.style.height =
        "100%";


    image.style.maxWidth =
        "100%";


    image.style.maxHeight =
        "100%";


    image.style.margin =
        "0";


    image.style.boxSizing =
        "border-box";


    /*
       Stage sementara tidak dipaksa ratio
       sebelum dimensi image diketahui.
    */

    if (
        stage
    ) {

        stage.style.overflow =
            "hidden";

    }


    showElement(
        image
    );


    bindImageDimensionHandler(
        image
    );


    /*
       Jika ukuran sudah tersedia sekarang,
       langsung terapkan.
    */

    if (
        image.naturalWidth > 0 &&
        image.naturalHeight > 0
    ) {

        applyMediaDimensions(
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

    const video =
        elements?.videoPreview;


    const image =
        elements?.imagePreview;


    const empty =
        elements?.previewEmpty;


    const stage =
        getPreviewStage();


    if (
        !video
    ) {

        console.error(
            "[GEN-Z.AI] metadata-preview: video preview element tidak ditemukan."
        );

        return false;
    }


    if (
        !src
    ) {

        console.warn(
            "[GEN-Z.AI] metadata-preview: video source kosong."
        );

        return false;
    }


    /*
       Sembunyikan image.
    */

    if (
        image
    ) {

        hideElement(
            image
        );

        image.removeAttribute(
            "src"
        );

    }


    /*
       Sembunyikan empty state.
    */

    if (
        empty
    ) {

        hideElement(
            empty
        );

    }


    /*
       Set video source.
    */

    video.src =
        src;


    video.controls =
        true;


    video.playsInline =
        true;


    video.preload =
        "metadata";


    video.style.display =
        "block";


    video.style.objectFit =
        "contain";


    video.style.objectPosition =
        "center center";


    video.style.width =
        "100%";


    video.style.height =
        "100%";


    video.style.maxWidth =
        "100%";


    video.style.maxHeight =
        "100%";


    video.style.margin =
        "0";


    video.style.boxSizing =
        "border-box";


    if (
        stage
    ) {

        stage.style.overflow =
            "hidden";

    }


    showElement(
        video
    );


    bindVideoDimensionHandler(
        video
    );


    /*
       Browser akan menentukan
       videoWidth / videoHeight setelah
       metadata tersedia.
    */

    try {

        video.load();

    } catch (
        error
    ) {

        console.warn(
            "[GEN-Z.AI] metadata-preview: video.load() gagal.",
            error
        );

    }


    return true;

}


/* =========================================================
   RENDER ORIGINAL PREVIEW
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


    const type =
        String(
            file.type || ""
        ).toLowerCase();


    /*
       Image
    */

    if (
        type.startsWith(
            "image/"
        )
    ) {

        const url =
            URL.createObjectURL(
                file
            );


        /*
           Revoke URL lama.
        */

        if (
            activePreviewObjectUrl
        ) {

            try {

                URL.revokeObjectURL(
                    activePreviewObjectUrl
                );

            } catch (
                error
            ) {

                console.warn(
                    "[GEN-Z.AI] metadata-preview: revoke URL gagal.",
                    error
                );

            }

        }


        activePreviewObjectUrl =
            url;


        if (
            state
        ) {

            state.originalPreviewUrl =
                url;

        }


        return renderImagePreview(
            url
        );

    }


    /*
       Video
    */

    if (
        type.startsWith(
            "video/"
        )
    ) {

        const url =
            URL.createObjectURL(
                file
            );


        if (
            activePreviewObjectUrl
        ) {

            try {

                URL.revokeObjectURL(
                    activePreviewObjectUrl
                );

            } catch (
                error
            ) {

                console.warn(
                    "[GEN-Z.AI] metadata-preview: revoke video URL gagal.",
                    error
                );

            }

        }


        activePreviewObjectUrl =
            url;


        if (
            state
        ) {

            state.originalPreviewUrl =
                url;

        }


        return renderVideoPreview(
            url
        );

    }


    console.warn(
        "[GEN-Z.AI] metadata-preview: tipe file tidak didukung:",
        file.type
    );


    return false;

}


/* =========================================================
   RENDER CLEANED IMAGE PREVIEW
========================================================= */

export function renderCleanedImagePreview(
    src
) {

    const image =
        elements?.cleanImagePreview;


    const video =
        elements?.cleanVideoPreview;


    if (
        !image
    ) {

        console.error(
            "[GEN-Z.AI] metadata-preview: cleaned image preview element tidak ditemukan."
        );

        return false;
    }


    if (
        video
    ) {

        hideElement(
            video
        );

        video.removeAttribute(
            "src"
        );

    }


    if (
        !src
    ) {

        hideElement(
            image
        );

        return false;
    }


    image.src =
        src;


    image.alt =
        "Cleaned media preview";


    image.decoding =
        "async";


    image.loading =
        "eager";


    image.style.display =
        "block";


    image.style.width =
        "100%";


    image.style.height =
        "100%";


    image.style.maxWidth =
        "100%";


    image.style.maxHeight =
        "100%";


    image.style.objectFit =
        "contain";


    image.style.objectPosition =
        "center center";


    image.style.margin =
        "0";


    image.style.boxSizing =
        "border-box";


    showElement(
        image
    );


    image.addEventListener(
        "load",
        () => {

            /*
               Cleaned preview berada di area
               result sendiri. Jangan mengubah
               original preview stage.
            */

            image.style.objectFit =
                "contain";

        },
        {
            once: false
        }
    );


    return true;

}


/* =========================================================
   RENDER CLEANED VIDEO PREVIEW
========================================================= */

export function renderCleanedVideoPreview(
    src
) {

    const video =
        elements?.cleanVideoPreview;


    const image =
        elements?.cleanImagePreview;


    if (
        !video
    ) {

        console.error(
            "[GEN-Z.AI] metadata-preview: cleaned video preview element tidak ditemukan."
        );

        return false;
    }


    if (
        image
    ) {

        hideElement(
            image
        );

        image.removeAttribute(
            "src"
        );

    }


    if (
        !src
    ) {

        hideElement(
            video
        );

        return false;
    }


    video.src =
        src;


    video.controls =
        true;


    video.playsInline =
        true;


    video.preload =
        "metadata";


    video.style.display =
        "block";


    video.style.width =
        "100%";


    video.style.height =
        "100%";


    video.style.maxWidth =
        "100%";


    video.style.maxHeight =
        "100%";


    video.style.objectFit =
        "contain";


    video.style.objectPosition =
        "center center";


    video.style.margin =
        "0";


    video.style.boxSizing =
        "border-box";


    showElement(
        video
    );


    try {

        video.load();

    } catch (
        error
    ) {

        console.warn(
            "[GEN-Z.AI] metadata-preview: cleaned video load gagal.",
            error
        );

    }


    return true;

}


/* =========================================================
   RENDER CLEANED PREVIEW
========================================================= */

export function renderCleanedPreview(
    blob,
    fileType = ""
) {

    if (
        !blob
    ) {

        console.warn(
            "[GEN-Z.AI] metadata-preview: cleaned blob kosong."
        );

        return false;
    }


    const type =
        String(
            fileType ||
            blob.type ||
            ""
        ).toLowerCase();


    const url =
        URL.createObjectURL(
            blob
        );


    /*
       Simpan URL cleaned.
    */

    if (
        state
    ) {

        /*
           Revoke URL lama terlebih dahulu.
        */

        if (
            state.cleanedPreviewUrl
        ) {

            try {

                URL.revokeObjectURL(
                    state.cleanedPreviewUrl
                );

            } catch (
                error
            ) {

                console.warn(
                    "[GEN-Z.AI] metadata-preview: revoke cleaned URL gagal.",
                    error
                );

            }

        }


        state.cleanedPreviewUrl =
            url;

    }


    /*
       Image
    */

    if (
        type.startsWith(
            "image/"
        )
    ) {

        return renderCleanedImagePreview(
            url
        );

    }


    /*
       Video
    */

    if (
        type.startsWith(
            "video/"
        )
    ) {

        return renderCleanedVideoPreview(
            url
        );

    }


    URL.revokeObjectURL(
        url
    );


    console.warn(
        "[GEN-Z.AI] metadata-preview: cleaned media type tidak didukung:",
        type
    );


    return false;

}


/* =========================================================
   RENDER IMAGE FROM DATA URL
========================================================= */

export function renderImagePreviewFromDataUrl(
    dataUrl
) {

    if (
        !dataUrl
    ) {

        return false;
    }


    return renderImagePreview(
        dataUrl
    );

}


/* =========================================================
   READ IMAGE AS DATA URL
========================================================= */

export function readImageAsDataUrl(
    file
) {

    return new Promise(
        (
            resolve,
            reject
        ) => {

            if (
                !file
            ) {

                reject(
                    new Error(
                        "File gambar tidak tersedia."
                    )
                );

                return;
            }


            const reader =
                new FileReader();


            reader.onload =
                () => {

                    resolve(
                        reader.result
                    );

                };


            reader.onerror =
                () => {

                    reject(
                        reader.error ||
                        new Error(
                            "Gagal membaca file gambar."
                        )
                    );

                };


            reader.readAsDataURL(
                file
            );

        }
    );

}


/* =========================================================
   RENDER ORIGINAL PREVIEW SAFE
========================================================= */

export function renderOriginalPreviewSafe(
    file
) {

    try {

        return renderOriginalPreview(
            file
        );

    } catch (
        error
    ) {

        console.error(
            "[GEN-Z.AI] metadata-preview: renderOriginalPreviewSafe gagal:",
            error
        );

        return false;

    }

}


/* =========================================================
   CLEAR ORIGINAL PREVIEW
========================================================= */

export function clearOriginalPreview() {

    const image =
        elements?.imagePreview;


    const video =
        elements?.videoPreview;


    const empty =
        elements?.previewEmpty;


    if (
        image
    ) {

        image.removeAttribute(
            "src"
        );


        image.style.removeProperty(
            "width"
        );


        image.style.removeProperty(
            "height"
        );


        image.style.removeProperty(
            "max-width"
        );


        image.style.removeProperty(
            "max-height"
        );


        image.style.removeProperty(
            "object-fit"
        );


        hideElement(
            image
        );

    }


    if (
        video
    ) {

        try {

            video.pause();

        } catch (
            error
        ) {

            console.warn(
                "[GEN-Z.AI] metadata-preview: gagal pause video.",
                error
            );

        }


        video.removeAttribute(
            "src"
        );


        video.load();


        hideElement(
            video
        );

    }


    if (
        activePreviewObjectUrl
    ) {

        try {

            URL.revokeObjectURL(
                activePreviewObjectUrl
            );

        } catch (
            error
        ) {

            console.warn(
                "[GEN-Z.AI] metadata-preview: gagal revoke original URL.",
                error
            );

        }

        activePreviewObjectUrl =
            null;

    }


    if (
        state
    ) {

        state.originalPreviewUrl =
            null;

    }


    resetPreviewStageRatio();


    if (
        empty
    ) {

        showElement(
            empty
        );

    }

}


/* =========================================================
   CLEAR CLEANED PREVIEW
========================================================= */

export function clearCleanedPreview() {

    const image =
        elements?.cleanImagePreview;


    const video =
        elements?.cleanVideoPreview;


    if (
        image
    ) {

        image.removeAttribute(
            "src"
        );


        image.style.removeProperty(
            "width"
        );


        image.style.removeProperty(
            "height"
        );


        image.style.removeProperty(
            "object-fit"
        );


        hideElement(
            image
        );

    }


    if (
        video
    ) {

        try {

            video.pause();

        } catch (
            error
        ) {

            console.warn(
                "[GEN-Z.AI] metadata-preview: cleaned video pause gagal.",
                error
            );

        }


        video.removeAttribute(
            "src"
        );


        video.load();


        video.style.removeProperty(
            "width"
        );


        video.style.removeProperty(
            "height"
        );


        video.style.removeProperty(
            "object-fit"
        );


        hideElement(
            video
        );

    }


    if (
        state?.cleanedPreviewUrl
    ) {

        try {

            URL.revokeObjectURL(
                state.cleanedPreviewUrl
            );

        } catch (
            error
        ) {

            console.warn(
                "[GEN-Z.AI] metadata-preview: cleaned URL revoke gagal.",
                error
            );

        }

    }


    if (
        state
    ) {

        state.cleanedPreviewUrl =
            null;

    }

}


/* =========================================================
   SET PREVIEW STATUS
========================================================= */

export function setPreviewStatus(
    message = "",
    type = "idle"
) {

    const status =
        elements?.previewStatus;


    if (
        !status
    ) {

        return;
    }


    const normalizedType =
        String(
            type ||
            "idle"
        ).toLowerCase();


    status.textContent =
        message || "";


    status.dataset.status =
        normalizedType;


    if (
        message
    ) {

        showElement(
            status
        );

    } else {

        hideElement(
            status
        );

    }

}


/* =========================================================
   RESET PREVIEW
========================================================= */

export function resetPreview() {

    clearOriginalPreview();

    clearCleanedPreview();

    setPreviewStatus(
        "",
        "idle"
    );


    const aiOverlay =
        elements?.aiOverlay;


    if (
        aiOverlay
    ) {

        hideElement(
            aiOverlay
        );

    }


    resetPreviewStageRatio();

}


/* =========================================================
   WINDOW RESIZE
   ---------------------------------------------------------
   Pastikan stage tetap mengikuti ratio media.
========================================================= */

function refreshActivePreviewRatio() {

    const image =
        elements?.imagePreview;


    const video =
        elements?.videoPreview;


    if (
        image &&
        !image.hidden &&
        image.naturalWidth > 0 &&
        image.naturalHeight > 0
    ) {

        applyMediaDimensions(
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

        applyMediaDimensions(
            video
        );

    }

}


if (
    typeof window !== "undefined"
) {

    window.addEventListener(
        "resize",
        refreshActivePreviewRatio,
        {
            passive: true
        }
    );

}


/* =========================================================
   PUBLIC API
========================================================= */

export default {

    showElement,
    hideElement,

    renderImagePreview,
    renderVideoPreview,
    renderOriginalPreview,

    renderCleanedImagePreview,
    renderCleanedVideoPreview,
    renderCleanedPreview,

    renderImagePreviewFromDataUrl,
    readImageAsDataUrl,

    renderOriginalPreviewSafe,

    clearOriginalPreview,
    clearCleanedPreview,

    setPreviewStatus,

    resetPreview

};
