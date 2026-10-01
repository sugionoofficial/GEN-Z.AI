/* =========================================================
   GEN-Z.AI
   METADATA CLEANER
   ---------------------------------------------------------
   File:
   metadata-cleaner/assets/js/metadata-preview.js

   Tanggung jawab:
   - Original image preview
   - Original video preview
   - Cleaned image preview
   - Cleaned video preview
   - Preview visibility
   - Preview status
   - Video source cleanup
   - Tidak membaca metadata
   - Tidak melakukan cleaning
   - Tidak melakukan download
========================================================= */

import {
    state
} from "./metadata-state.js";


import {
    elements
} from "./metadata-dom.js";


/* =========================================================
   CONSTANTS
========================================================= */

const PREVIEW_MAX_HEIGHT =
    "540px";


const ORIGINAL_IMAGE_READY_STATUS =
    "IMAGE SIAP. TEKAN CHECK UNTUK MEMBACA METADATA.";


const ORIGINAL_VIDEO_READY_STATUS =
    "VIDEO SIAP. TEKAN CHECK UNTUK MEMBACA METADATA.";


/* =========================================================
   GENERIC VISIBILITY
========================================================= */

function showElement(
    element
) {

    if (
        !element
    ) {

        return;
    }


    element.hidden =
        false;


    element.removeAttribute(
        "hidden"
    );


    element.classList.remove(
        "hidden"
    );
}


function hideElement(
    element
) {

    if (
        !element
    ) {

        return;
    }


    element.hidden =
        true;


    element.setAttribute(
        "hidden",
        ""
    );


    element.classList.add(
        "hidden"
    );
}


/* =========================================================
   FORCE PREVIEW VISIBLE
========================================================= */

function showPreview(
    element
) {

    if (
        !element
    ) {

        return;
    }


    element.hidden =
        false;


    element.removeAttribute(
        "hidden"
    );


    element.classList.remove(
        "hidden"
    );


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


/* =========================================================
   FORCE PREVIEW HIDDEN
========================================================= */

function hidePreview(
    element
) {

    if (
        !element
    ) {

        return;
    }


    element.hidden =
        true;


    element.setAttribute(
        "hidden",
        ""
    );


    element.classList.add(
        "hidden"
    );


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


/* =========================================================
   CLEAR VIDEO SOURCES
========================================================= */

function clearVideoSources(
    video
) {

    if (
        !video
    ) {

        return;
    }


    const sources =
        Array.from(
            video.querySelectorAll(
                "source"
            )
        );


    for (
        const source of sources
    ) {

        source.removeAttribute(
            "src"
        );


        source.remove();
    }
}


/* =========================================================
   RESET VIDEO
========================================================= */

function resetVideo(
    video
) {

    if (
        !video
    ) {

        return;
    }


    try {

        video.pause();

    } catch (error) {

        console.warn(
            "[GEN-Z.AI] Preview video pause gagal:",
            error
        );
    }


    video.onloadedmetadata =
        null;


    video.onloadeddata =
        null;


    video.onloadstart =
        null;


    video.oncanplay =
        null;


    video.onerror =
        null;


    video.removeAttribute(
        "src"
    );


    clearVideoSources(
        video
    );


    try {

        video.load();

    } catch (error) {

        console.warn(
            "[GEN-Z.AI] Preview video reset gagal:",
            error
        );
    }
}


/* =========================================================
   CLEAR IMAGE
========================================================= */

function resetImage(
    image
) {

    if (
        !image
    ) {

        return;
    }


    image.onload =
        null;


    image.onerror =
        null;


    image.removeAttribute(
        "src"
    );
}


/* =========================================================
   EMPTY PREVIEW
========================================================= */

function showEmptyPreview() {

    showElement(
        elements?.previewEmpty
    );
}


function hideEmptyPreview() {

    hideElement(
        elements?.previewEmpty
    );
}


/* =========================================================
   PREVIEW STATUS
========================================================= */

function setPreviewStatus(
    text
) {

    const status =
        elements?.previewStatus;


    if (
        !status
    ) {

        return;
    }


    if (
        text === undefined ||
        text === null ||
        String(
            text
        ).trim() === ""
    ) {

        status.textContent =
            "";


        hideElement(
            status
        );


        return;
    }


    status.textContent =
        String(
            text
        );


    showElement(
        status
    );
}


/* =========================================================
   PREVIEW STAGE
========================================================= */

function ensurePreviewStageVisible() {

    const stage =
        elements?.previewStage;


    if (
        !stage
    ) {

        return;
    }


    stage.style.setProperty(
        "display",
        "flex",
        "important"
    );


    stage.style.setProperty(
        "visibility",
        "visible",
        "important"
    );


    stage.style.setProperty(
        "opacity",
        "1",
        "important"
    );
}


/* =========================================================
   HIDE ALL ORIGINAL PREVIEW
========================================================= */

function hideOriginalPreview() {

    hidePreview(
        elements?.imagePreview
    );


    hidePreview(
        elements?.videoPreview
    );
}


/* =========================================================
   HIDE ALL CLEANED PREVIEW
========================================================= */

function hideCleanedPreview() {

    hidePreview(
        elements?.cleanImagePreview
    );


    hidePreview(
        elements?.cleanVideoPreview
    );
}


/* =========================================================
   HIDE ALL MEDIA PREVIEW
========================================================= */

function hideAllMediaPreview() {

    hideOriginalPreview();


    hideCleanedPreview();


    hideElement(
        elements?.aiOverlay
    );
}


/* =========================================================
   ORIGINAL IMAGE
========================================================= */

function renderOriginalImagePreview(
    image,
    file,
    url
) {

    if (
        !image
    ) {

        console.error(
            "[GEN-Z.AI] Original image preview element tidak tersedia."
        );


        setPreviewStatus(
            "IMAGE PREVIEW ELEMENT TIDAK TERSEDIA."
        );


        return;
    }


    resetImage(
        image
    );


    image.alt =
        file?.name ||
        "Image preview";


    image.decoding =
        "async";


    image.loading =
        "eager";


    showPreview(
        image
    );


    image.onload =
        () => {

            if (
                state.file !== file
            ) {

                return;
            }


            showPreview(
                image
            );


            hideEmptyPreview();


            setPreviewStatus(
                ORIGINAL_IMAGE_READY_STATUS
            );
        };


    image.onerror =
        () => {

            console.error(
                "[GEN-Z.AI] Original image preview gagal:",
                {
                    fileName:
                        file?.name ||
                        "",

                    fileType:
                        file?.type ||
                        "",

                    fileSize:
                        file?.size ||
                        0,

                    url
                }
            );


            hidePreview(
                image
            );


            showEmptyPreview();


            setPreviewStatus(
                "IMAGE TIDAK DAPAT DITAMPILKAN OLEH BROWSER."
            );
        };


    try {

        image.src =
            url;

    } catch (error) {

        console.error(
            "[GEN-Z.AI] Original image src gagal:",
            error
        );


        hidePreview(
            image
        );


        showEmptyPreview();


        setPreviewStatus(
            "IMAGE PREVIEW GAGAL DIMUAT."
        );


        return;
    }


    showPreview(
        image
    );


    if (
        image.complete &&
        image.naturalWidth > 0
    ) {

        showPreview(
            image
        );


        hideEmptyPreview();


        setPreviewStatus(
            ORIGINAL_IMAGE_READY_STATUS
        );
    }
}


/* =========================================================
   ORIGINAL IMAGE FILEREADER FALLBACK
========================================================= */

function renderImageWithFileReader(
    image,
    file
) {

    if (
        !image ||
        !file
    ) {

        return;
    }


    if (
        typeof FileReader ===
        "undefined"
    ) {

        setPreviewStatus(
            "BROWSER TIDAK MENDUKUNG IMAGE PREVIEW."
        );


        return;
    }


    const reader =
        new FileReader();


    reader.onload =
        () => {

            const result =
                reader.result;


            if (
                typeof result !==
                "string"
            ) {

                setPreviewStatus(
                    "IMAGE PREVIEW GAGAL."
                );


                return;
            }


            image.onload =
                () => {

                    if (
                        state.file !== file
                    ) {

                        return;
                    }


                    showPreview(
                        image
                    );


                    hideEmptyPreview();


                    setPreviewStatus(
                        ORIGINAL_IMAGE_READY_STATUS
                    );
                };


            image.onerror =
                () => {

                    hidePreview(
                        image
                    );


                    showEmptyPreview();


                    setPreviewStatus(
                        "IMAGE TIDAK DAPAT DITAMPILKAN OLEH BROWSER."
                    );
                };


            try {

                image.src =
                    result;

            } catch (error) {

                console.error(
                    "[GEN-Z.AI] FileReader image src gagal:",
                    error
                );


                setPreviewStatus(
                    "IMAGE PREVIEW GAGAL."
                );


                return;
            }


            showPreview(
                image
            );
        };


    reader.onerror =
        (error) => {

            console.error(
                "[GEN-Z.AI] FileReader image preview gagal:",
                error
            );


            setPreviewStatus(
                "IMAGE PREVIEW GAGAL DIBACA."
            );
        };


    try {

        reader.readAsDataURL(
            file
        );

    } catch (error) {

        console.error(
            "[GEN-Z.AI] FileReader readAsDataURL gagal:",
            error
        );


        setPreviewStatus(
            "IMAGE PREVIEW GAGAL DIBACA."
        );
    }
}


/* =========================================================
   ORIGINAL VIDEO
========================================================= */

function renderOriginalVideoPreview(
    video,
    file,
    url
) {

    if (
        !video
    ) {

        console.error(
            "[GEN-Z.AI] Original video preview element tidak tersedia."
        );


        setPreviewStatus(
            "VIDEO PREVIEW ELEMENT TIDAK TERSEDIA."
        );


        return;
    }


    resetVideo(
        video
    );


    video.controls =
        true;


    video.playsInline =
        true;


    video.setAttribute(
        "playsinline",
        ""
    );


    video.preload =
        "metadata";


    video.autoplay =
        false;


    video.loop =
        false;


    video.muted =
        false;


    showPreview(
        video
    );


    video.onloadstart =
        () => {

            if (
                state.file === file
            ) {

                showPreview(
                    video
                );
            }
        };


    video.onloadedmetadata =
        () => {

            if (
                state.file !== file
            ) {

                return;
            }


            showPreview(
                video
            );


            hideEmptyPreview();


            setPreviewStatus(
                "VIDEO SIAP DIPUTAR."
            );
        };


    video.onloadeddata =
        () => {

            if (
                state.file !== file
            ) {

                return;
            }


            showPreview(
                video
            );


            hideEmptyPreview();


            setPreviewStatus(
                ORIGINAL_VIDEO_READY_STATUS
            );
        };


    video.oncanplay =
        () => {

            if (
                state.file === file
            ) {

                showPreview(
                    video
                );
            }
        };


    video.onerror =
        () => {

            const mediaError =
                video.error;


            console.error(
                "[GEN-Z.AI] Original video preview gagal:",
                {
                    code:
                        mediaError?.code ||
                        null,

                    message:
                        mediaError?.message ||
                        null,

                    fileName:
                        file?.name ||
                        null,

                    fileType:
                        file?.type ||
                        null,

                    fileSize:
                        file?.size ||
                        0,

                    url,

                    currentSrc:
                        video.currentSrc ||
                        "",

                    networkState:
                        video.networkState,

                    readyState:
                        video.readyState
                }
            );


            hidePreview(
                video
            );


            showEmptyPreview();


            setPreviewStatus(
                "VIDEO TIDAK DAPAT DIPUTAR OLEH BROWSER. FORMAT ATAU CODEC MUNGKIN TIDAK DIDUKUNG."
            );
        };


    try {

        video.src =
            url;

    } catch (error) {

        console.error(
            "[GEN-Z.AI] Original video src gagal:",
            error
        );


        setPreviewStatus(
            "VIDEO PREVIEW GAGAL DIMUAT."
        );


        return;
    }


    showPreview(
        video
    );


    try {

        video.load();

    } catch (error) {

        console.error(
            "[GEN-Z.AI] Original video load() gagal:",
            error
        );


        setPreviewStatus(
            "VIDEO PREVIEW GAGAL DIMUAT."
        );


        return;
    }


    showPreview(
        video
    );
}


/* =========================================================
   CLEANED IMAGE
========================================================= */

function renderCleanedImagePreview(
    image,
    file,
    url
) {

    if (
        !image
    ) {

        console.warn(
            "[GEN-Z.AI] Cleaned image preview element tidak tersedia."
        );


        return;
    }


    resetImage(
        image
    );


    image.alt =
        file?.name ||
        "Cleaned image preview";


    image.decoding =
        "async";


    image.loading =
        "eager";


    showPreview(
        image
    );


    image.onload =
        () => {

            showPreview(
                image
            );


            hideEmptyPreview();


            setPreviewStatus(
                "IMAGE CLEANED SIAP."
            );
        };


    image.onerror =
        () => {

            console.error(
                "[GEN-Z.AI] Cleaned image preview gagal:",
                {
                    fileName:
                        file?.name ||
                        null,

                    url
                }
            );


            hidePreview(
                image
            );


            setPreviewStatus(
                "IMAGE CLEANED TIDAK DAPAT DITAMPILKAN."
            );
        };


    try {

        image.src =
            url;

    } catch (error) {

        console.error(
            "[GEN-Z.AI] Cleaned image src gagal:",
            error
        );


        setPreviewStatus(
            "IMAGE CLEANED GAGAL DIMUAT."
        );


        return;
    }


    showPreview(
        image
    );


    if (
        image.complete &&
        image.naturalWidth > 0
    ) {

        showPreview(
            image
        );


        hideEmptyPreview();


        setPreviewStatus(
            "IMAGE CLEANED SIAP."
        );
    }
}


/* =========================================================
   CLEANED VIDEO
========================================================= */

function renderCleanedVideoPreview(
    video,
    file,
    url
) {

    if (
        !video
    ) {

        console.warn(
            "[GEN-Z.AI] Cleaned video preview element tidak tersedia."
        );


        return;
    }


    resetVideo(
        video
    );


    video.controls =
        true;


    video.playsInline =
        true;


    video.setAttribute(
        "playsinline",
        ""
    );


    video.preload =
        "metadata";


    video.autoplay =
        false;


    video.loop =
        false;


    video.muted =
        false;


    showPreview(
        video
    );


    video.onloadedmetadata =
        () => {

            showPreview(
                video
            );


            hideEmptyPreview();


            setPreviewStatus(
                "VIDEO CLEANED SIAP DIPUTAR."
            );
        };


    video.onloadeddata =
        () => {

            showPreview(
                video
            );


            hideEmptyPreview();
        };


    video.oncanplay =
        () => {

            showPreview(
                video
            );
        };


    video.onerror =
        () => {

            const mediaError =
                video.error;


            console.error(
                "[GEN-Z.AI] Cleaned video preview gagal:",
                {
                    code:
                        mediaError?.code ||
                        null,

                    message:
                        mediaError?.message ||
                        null,

                    fileName:
                        file?.name ||
                        null,

                    url,

                    currentSrc:
                        video.currentSrc ||
                        "",

                    networkState:
                        video.networkState,

                    readyState:
                        video.readyState
                }
            );


            hidePreview(
                video
            );


            setPreviewStatus(
                "VIDEO CLEANED TIDAK DAPAT DIPUTAR OLEH BROWSER."
            );
        };


    try {

        video.src =
            url;

    } catch (error) {

        console.error(
            "[GEN-Z.AI] Cleaned video src gagal:",
            error
        );


        setPreviewStatus(
            "VIDEO CLEANED GAGAL DIMUAT."
        );


        return;
    }


    showPreview(
        video
    );


    try {

        video.load();

    } catch (error) {

        console.error(
            "[GEN-Z.AI] Cleaned video load() gagal:",
            error
        );


        setPreviewStatus(
            "VIDEO CLEANED GAGAL DIMUAT."
        );


        return;
    }


    showPreview(
        video
    );
}


/* =========================================================
   ORIGINAL PREVIEW ENTRY
========================================================= */

function renderOriginalPreview() {

    ensurePreviewStageVisible();


    hideCleanedPreview();


    hideOriginalPreview();


    hideElement(
        elements?.aiOverlay
    );


    if (
        !state.file
    ) {

        showEmptyPreview();


        setPreviewStatus(
            "BELUM ADA MEDIA"
        );


        return;
    }


    if (
        !state.originalURL
    ) {

        showEmptyPreview();


        setPreviewStatus(
            "PREVIEW TIDAK DAPAT DIBUAT."
        );


        return;
    }


    hideEmptyPreview();


    if (
        state.fileType ===
        "image"
    ) {

        renderOriginalImagePreview(
            elements?.imagePreview,
            state.file,
            state.originalURL
        );


        return;
    }


    if (
        state.fileType ===
        "video"
    ) {

        renderOriginalVideoPreview(
            elements?.videoPreview,
            state.file,
            state.originalURL
        );


        return;
    }


    showEmptyPreview();
}


/* =========================================================
   CLEANED PREVIEW ENTRY
========================================================= */

function renderCleanedPreview(
    url,
    file = null
) {

    ensurePreviewStageVisible();


    hideOriginalPreview();


    hideCleanedPreview();


    hideElement(
        elements?.aiOverlay
    );


    if (
        !url
    ) {

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


    const cleanedFile =
        file ||
        state.cleanedFile;


    hideEmptyPreview();


    if (
        state.fileType ===
        "image"
    ) {

        renderCleanedImagePreview(
            elements?.cleanImagePreview,
            cleanedFile,
            url
        );


        return;
    }


    if (
        state.fileType ===
        "video"
    ) {

        renderCleanedVideoPreview(
            elements?.cleanVideoPreview,
            cleanedFile,
            url
        );


        return;
    }


    showEmptyPreview();
}


/* =========================================================
   CLEAR ORIGINAL PREVIEW
========================================================= */

function clearOriginalPreview() {

    const image =
        elements?.imagePreview;


    const video =
        elements?.videoPreview;


    resetImage(
        image
    );


    resetVideo(
        video
    );


    hidePreview(
        image
    );


    hidePreview(
        video
    );
}


/* =========================================================
   CLEAR CLEANED PREVIEW
========================================================= */

function clearCleanedPreview() {

    const image =
        elements?.cleanImagePreview;


    const video =
        elements?.cleanVideoPreview;


    resetImage(
        image
    );


    resetVideo(
        video
    );


    hidePreview(
        image
    );


    hidePreview(
        video
    );
}


/* =========================================================
   CLEAR ALL PREVIEW
========================================================= */

function clearAllPreview() {

    clearOriginalPreview();


    clearCleanedPreview();


    showEmptyPreview();
}


/* =========================================================
   EXPORT
========================================================= */

export {

    renderOriginalPreview,

    renderCleanedPreview,

    clearOriginalPreview,

    clearCleanedPreview,

    clearAllPreview,

    setPreviewStatus,

    showElement,

    hideElement,

    showPreview,

    hidePreview,

    resetVideo,

    clearVideoSources,

    renderOriginalImagePreview,

    renderOriginalVideoPreview,

    renderCleanedImagePreview,

    renderCleanedVideoPreview,

    renderImageWithFileReader

};


/* =========================================================
   GLOBAL COMPATIBILITY API
========================================================= */

window.GENZMetadataPreview =
    Object.freeze({

        renderOriginalPreview,

        renderCleanedPreview,

        clearOriginalPreview,

        clearCleanedPreview,

        clearAllPreview,

        setPreviewStatus,

        showElement,

        hideElement,

        showPreview,

        hidePreview,

        resetVideo,

        clearVideoSources

    });
