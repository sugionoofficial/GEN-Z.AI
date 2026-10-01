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
   - Empty preview state
   - Preview status
   - Object URL / FileReader fallback
   - Tidak menangani upload
   - Tidak menangani metadata
   - Tidak menangani cleaning
========================================================= */

import { state } from "./metadata-state.js";
import { elements } from "./metadata-dom.js";


/* =========================================================
   CONSTANTS
========================================================= */

const PREVIEW_MAX_HEIGHT = "540px";

const ORIGINAL_IMAGE_READY_STATUS =
    "IMAGE SIAP. TEKAN CHECK UNTUK MEMBACA METADATA.";

const ORIGINAL_VIDEO_READY_STATUS =
    "VIDEO SIAP. TEKAN CHECK UNTUK MEMBACA METADATA.";


/* =========================================================
   BASIC DOM HELPERS
========================================================= */

function showElement(element) {

    if (!element) {
        return;
    }

    try {

        element.hidden = false;

        element.classList.remove(
            "hidden",
            "d-none"
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

    } catch (error) {

        console.warn(
            "[GEN-Z.AI] Failed to show preview element:",
            error
        );

    }
}


function hideElement(element) {

    if (!element) {
        return;
    }

    try {

        element.hidden = true;

        element.classList.add("hidden");

        element.style.setProperty(
            "display",
            "none",
            "important"
        );

    } catch (error) {

        console.warn(
            "[GEN-Z.AI] Failed to hide preview element:",
            error
        );

    }
}


/* =========================================================
   PREVIEW VISIBILITY
========================================================= */

function showPreview(element) {

    if (!element) {
        return;
    }

    showElement(element);

    try {

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

    } catch (error) {

        console.warn(
            "[GEN-Z.AI] Failed to apply preview styles:",
            error
        );

    }
}


function hidePreview(element) {

    if (!element) {
        return;
    }

    hideElement(element);
}


/* =========================================================
   VIDEO RESET
========================================================= */

function clearVideoSources(video) {

    if (!video) {
        return;
    }

    try {

        video.pause();

    } catch (error) {
        /* Ignore */
    }

    try {

        video.removeAttribute("src");

        while (video.firstChild) {
            video.removeChild(video.firstChild);
        }

        video.load();

    } catch (error) {

        console.warn(
            "[GEN-Z.AI] Failed to clear video source:",
            error
        );

    }
}


function resetVideo(video) {

    if (!video) {
        return;
    }

    try {

        video.pause();

    } catch (error) {
        /* Ignore */
    }

    try {

        video.removeAttribute("src");

        while (video.firstChild) {
            video.removeChild(video.firstChild);
        }

        video.removeAttribute("poster");

        video.controls = true;
        video.playsInline = true;
        video.preload = "metadata";

        video.load();

    } catch (error) {

        console.warn(
            "[GEN-Z.AI] Failed to reset video:",
            error
        );

    }

    hidePreview(video);
}


/* =========================================================
   IMAGE RESET
========================================================= */

function resetImage(image) {

    if (!image) {
        return;
    }

    try {

        image.removeAttribute("src");

        image.alt = "";

        image.onload = null;
        image.onerror = null;

    } catch (error) {

        console.warn(
            "[GEN-Z.AI] Failed to reset image:",
            error
        );

    }

    hidePreview(image);
}


/* =========================================================
   EMPTY PREVIEW
========================================================= */

function showEmptyPreview() {

    if (!elements.previewEmpty) {
        return;
    }

    showElement(elements.previewEmpty);

}


function hideEmptyPreview() {

    if (!elements.previewEmpty) {
        return;
    }

    hideElement(elements.previewEmpty);

}


/* =========================================================
   PREVIEW STATUS
========================================================= */

function setPreviewStatus(message) {

    if (!elements.previewStatus) {
        return;
    }

    elements.previewStatus.textContent =
        message || "";

    if (message) {

        showElement(
            elements.previewStatus
        );

    } else {

        hideElement(
            elements.previewStatus
        );

    }

}


/* =========================================================
   ENSURE PREVIEW STAGE
========================================================= */

function ensurePreviewStageVisible() {

    const candidates = [

        elements.previewEmpty,
        elements.imagePreview,
        elements.videoPreview,
        elements.previewStatus

    ];

    for (const element of candidates) {

        if (!element) {
            continue;
        }

        const parent = element.parentElement;

        if (!parent) {
            continue;
        }

        try {

            parent.style.setProperty(
                "visibility",
                "visible",
                "important"
            );

            parent.style.setProperty(
                "opacity",
                "1",
                "important"
            );

        } catch (error) {

            console.warn(
                "[GEN-Z.AI] Failed to reveal preview parent:",
                error
            );

        }

    }

}


/* =========================================================
   HIDE ORIGINAL PREVIEW
========================================================= */

function hideOriginalPreview() {

    resetImage(
        elements.imagePreview
    );

    resetVideo(
        elements.videoPreview
    );

}


/* =========================================================
   HIDE CLEANED PREVIEW
========================================================= */

function hideCleanedPreview() {

    resetImage(
        elements.cleanImagePreview
    );

    resetVideo(
        elements.cleanVideoPreview
    );

}


/* =========================================================
   HIDE ALL MEDIA PREVIEW
========================================================= */

function hideAllMediaPreview() {

    hideOriginalPreview();

    hideCleanedPreview();

}


/* =========================================================
   ORIGINAL IMAGE PREVIEW
========================================================= */

function renderOriginalImagePreview(
    image,
    file,
    url
) {

    if (!image || !file) {
        return;
    }


    resetImage(image);


    image.alt =
        file.name || "Uploaded image";

    image.decoding =
        "async";

    image.loading =
        "eager";


    showPreview(image);

    hideEmptyPreview();

    ensurePreviewStageVisible();


    /* -----------------------------------------------------
       IMAGE LOAD SUCCESS
    ----------------------------------------------------- */

    image.onload = () => {

        if (
            state.file &&
            state.file !== file
        ) {
            return;
        }


        showPreview(image);

        hideEmptyPreview();

        ensurePreviewStageVisible();

        setPreviewStatus(
            ORIGINAL_IMAGE_READY_STATUS
        );

        console.info(
            "[GEN-Z.AI] Original image preview loaded:",
            file.name
        );

    };


    /* -----------------------------------------------------
       IMAGE OBJECT URL FAILED
       FALLBACK TO FILEREADER
    ----------------------------------------------------- */

    image.onerror = () => {

        if (
            state.file &&
            state.file !== file
        ) {
            return;
        }


        console.warn(
            "[GEN-Z.AI] Object URL image preview failed. Trying FileReader fallback."
        );


        renderImageWithFileReader(
            image,
            file
        );

    };


    /* -----------------------------------------------------
       SET SOURCE
    ----------------------------------------------------- */

    try {

        image.src = url;

    } catch (error) {

        console.error(
            "[GEN-Z.AI] Failed to assign image Object URL:",
            error
        );


        renderImageWithFileReader(
            image,
            file
        );

        return;
    }


    /* -----------------------------------------------------
       HANDLE ALREADY-CACHED IMAGE
    ----------------------------------------------------- */

    try {

        if (
            image.complete &&
            image.naturalWidth > 0
        ) {

            showPreview(image);

            hideEmptyPreview();

            ensurePreviewStageVisible();

            setPreviewStatus(
                ORIGINAL_IMAGE_READY_STATUS
            );

        }

    } catch (error) {

        console.warn(
            "[GEN-Z.AI] Failed to inspect image dimensions:",
            error
        );

    }

}


/* =========================================================
   FILEREADER IMAGE FALLBACK
========================================================= */

function renderImageWithFileReader(
    image,
    file
) {

    if (!image || !file) {
        return;
    }


    if (
        state.file &&
        state.file !== file
    ) {
        return;
    }


    if (
        typeof FileReader === "undefined"
    ) {

        console.error(
            "[GEN-Z.AI] FileReader is not available."
        );

        hidePreview(image);

        showEmptyPreview();

        setPreviewStatus(
            "IMAGE TIDAK DAPAT DITAMPILKAN OLEH BROWSER."
        );

        return;
    }


    const reader =
        new FileReader();


    reader.onload = () => {

        if (
            state.file &&
            state.file !== file
        ) {
            return;
        }


        const result =
            reader.result;


        if (
            typeof result !== "string" ||
            !result
        ) {

            console.error(
                "[GEN-Z.AI] FileReader returned an invalid image source."
            );

            hidePreview(image);

            showEmptyPreview();

            setPreviewStatus(
                "IMAGE TIDAK DAPAT DITAMPILKAN."
            );

            return;
        }


        image.onload = () => {

            if (
                state.file &&
                state.file !== file
            ) {
                return;
            }


            showPreview(image);

            hideEmptyPreview();

            ensurePreviewStageVisible();

            setPreviewStatus(
                ORIGINAL_IMAGE_READY_STATUS
            );

            console.info(
                "[GEN-Z.AI] Original image preview loaded through FileReader:",
                file.name
            );

        };


        image.onerror = () => {

            console.error(
                "[GEN-Z.AI] FileReader image preview failed:",
                file.name
            );


            hidePreview(image);

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
                "[GEN-Z.AI] Failed to assign FileReader image source:",
                error
            );


            hidePreview(image);

            showEmptyPreview();

            setPreviewStatus(
                "IMAGE TIDAK DAPAT DITAMPILKAN."
            );

        }

    };


    reader.onerror = () => {

        console.error(
            "[GEN-Z.AI] FileReader failed:",
            reader.error
        );


        hidePreview(image);

        showEmptyPreview();

        setPreviewStatus(
            "IMAGE TIDAK DAPAT DITAMPILKAN."
        );

    };


    reader.onabort = () => {

        console.warn(
            "[GEN-Z.AI] FileReader aborted."
        );


        hidePreview(image);

        showEmptyPreview();

        setPreviewStatus(
            "PEMBACAAN IMAGE DIBATALKAN."
        );

    };


    try {

        reader.readAsDataURL(file);

    } catch (error) {

        console.error(
            "[GEN-Z.AI] Failed to read image file:",
            error
        );


        hidePreview(image);

        showEmptyPreview();

        setPreviewStatus(
            "IMAGE GAGAL DIBACA."
        );

    }

}


/* =========================================================
   ORIGINAL VIDEO PREVIEW
========================================================= */

function renderOriginalVideoPreview(
    video,
    file,
    url
) {

    if (!video || !file) {
        return;
    }


    resetVideo(video);


    video.controls =
        true;

    video.playsInline =
        true;

    video.preload =
        "metadata";

    video.muted =
        false;


    showPreview(video);

    hideEmptyPreview();

    ensurePreviewStageVisible();


    /* -----------------------------------------------------
       METADATA LOADED
    ----------------------------------------------------- */

    video.onloadedmetadata = () => {

        if (
            state.file &&
            state.file !== file
        ) {
            return;
        }


        showPreview(video);

        hideEmptyPreview();

        ensurePreviewStageVisible();

        setPreviewStatus(
            ORIGINAL_VIDEO_READY_STATUS
        );

        console.info(
            "[GEN-Z.AI] Original video metadata loaded:",
            file.name
        );

    };


    /* -----------------------------------------------------
       VIDEO DATA LOADED
    ----------------------------------------------------- */

    video.onloadeddata = () => {

        if (
            state.file &&
            state.file !== file
        ) {
            return;
        }


        showPreview(video);

        hideEmptyPreview();

        ensurePreviewStageVisible();

    };


    /* -----------------------------------------------------
       CAN PLAY
    ----------------------------------------------------- */

    video.oncanplay = () => {

        if (
            state.file &&
            state.file !== file
        ) {
            return;
        }


        showPreview(video);

        hideEmptyPreview();

        ensurePreviewStageVisible();

    };


    /* -----------------------------------------------------
       VIDEO ERROR
    ----------------------------------------------------- */

    video.onerror = () => {

        if (
            state.file &&
            state.file !== file
        ) {
            return;
        }


        const mediaError =
            video.error;

        console.error(
            "[GEN-Z.AI] Original video preview failed:",
            mediaError
        );


        hidePreview(video);

        showEmptyPreview();

        setPreviewStatus(
            "VIDEO TIDAK DAPAT DITAMPILKAN OLEH BROWSER."
        );

    };


    /* -----------------------------------------------------
       ASSIGN OBJECT URL
    ----------------------------------------------------- */

    try {

        video.src =
            url;

        video.load();

        showPreview(video);

    } catch (error) {

        console.error(
            "[GEN-Z.AI] Failed to assign video Object URL:",
            error
        );


        hidePreview(video);

        showEmptyPreview();

        setPreviewStatus(
            "VIDEO GAGAL DITAMPILKAN."
        );

    }

}


/* =========================================================
   CLEANED IMAGE PREVIEW
========================================================= */

function renderCleanedImagePreview(
    image,
    url
) {

    if (!image || !url) {
        return;
    }


    resetImage(image);


    image.alt =
        "Cleaned image";

    image.decoding =
        "async";

    image.loading =
        "eager";


    showPreview(image);


    image.onload = () => {

        showPreview(image);

        console.info(
            "[GEN-Z.AI] Cleaned image preview loaded."
        );

    };


    image.onerror = () => {

        console.error(
            "[GEN-Z.AI] Cleaned image preview failed."
        );

        hidePreview(image);

    };


    try {

        image.src =
            url;

    } catch (error) {

        console.error(
            "[GEN-Z.AI] Failed to assign cleaned image URL:",
            error
        );

        hidePreview(image);

    }

}


/* =========================================================
   CLEANED VIDEO PREVIEW
========================================================= */

function renderCleanedVideoPreview(
    video,
    url
) {

    if (!video || !url) {
        return;
    }


    resetVideo(video);


    video.controls =
        true;

    video.playsInline =
        true;

    video.preload =
        "metadata";


    showPreview(video);


    video.onloadedmetadata = () => {

        showPreview(video);

    };


    video.onloadeddata = () => {

        showPreview(video);

    };


    video.oncanplay = () => {

        showPreview(video);

    };


    video.onerror = () => {

        console.error(
            "[GEN-Z.AI] Cleaned video preview failed."
        );

        hidePreview(video);

    };


    try {

        video.src =
            url;

        video.load();

        showPreview(video);

    } catch (error) {

        console.error(
            "[GEN-Z.AI] Failed to assign cleaned video URL:",
            error
        );

        hidePreview(video);

    }

}


/* =========================================================
   ORIGINAL PREVIEW ROUTER
========================================================= */

function renderOriginalPreview() {

    const file =
        state.file;

    const fileType =
        state.fileType;

    const url =
        state.originalURL;


    if (!file) {

        hideOriginalPreview();

        showEmptyPreview();

        return;

    }


    if (!url) {

        console.error(
            "[GEN-Z.AI] Original preview URL is missing."
        );

        hideOriginalPreview();

        showEmptyPreview();

        setPreviewStatus(
            "FILE TERPILIH, TETAPI PREVIEW URL TIDAK TERSEDIA."
        );

        return;

    }


    ensurePreviewStageVisible();


    /* -----------------------------------------------------
       IMAGE
    ----------------------------------------------------- */

    if (
        fileType === "image"
    ) {

        hidePreview(
            elements.videoPreview
        );

        renderOriginalImagePreview(
            elements.imagePreview,
            file,
            url
        );

        return;

    }


    /* -----------------------------------------------------
       VIDEO
    ----------------------------------------------------- */

    if (
        fileType === "video"
    ) {

        hidePreview(
            elements.imagePreview
        );

        renderOriginalVideoPreview(
            elements.videoPreview,
            file,
            url
        );

        return;

    }


    /* -----------------------------------------------------
       UNKNOWN TYPE
    ----------------------------------------------------- */

    console.warn(
        "[GEN-Z.AI] Unsupported preview type:",
        fileType
    );


    hideOriginalPreview();

    showEmptyPreview();

    setPreviewStatus(
        "FORMAT MEDIA TIDAK DIDUKUNG UNTUK PREVIEW."
    );

}


/* =========================================================
   CLEANED PREVIEW ROUTER
========================================================= */

function renderCleanedPreview(
    fileType,
    url
) {

    if (!url) {
        return;
    }


    /* -----------------------------------------------------
       IMAGE
    ----------------------------------------------------- */

    if (
        fileType === "image"
    ) {

        hidePreview(
            elements.cleanVideoPreview
        );

        renderCleanedImagePreview(
            elements.cleanImagePreview,
            url
        );

        return;

    }


    /* -----------------------------------------------------
       VIDEO
    ----------------------------------------------------- */

    if (
        fileType === "video"
    ) {

        hidePreview(
            elements.cleanImagePreview
        );

        renderCleanedVideoPreview(
            elements.cleanVideoPreview,
            url
        );

        return;

    }


    console.warn(
        "[GEN-Z.AI] Unsupported cleaned preview type:",
        fileType
    );

}


/* =========================================================
   CLEAR ORIGINAL PREVIEW
========================================================= */

function clearOriginalPreview() {

    resetImage(
        elements.imagePreview
    );

    resetVideo(
        elements.videoPreview
    );

}


/* =========================================================
   CLEAR CLEANED PREVIEW
========================================================= */

function clearCleanedPreview() {

    resetImage(
        elements.cleanImagePreview
    );

    resetVideo(
        elements.cleanVideoPreview
    );

}


/* =========================================================
   CLEAR ALL PREVIEW
========================================================= */

function clearAllPreview() {

    clearOriginalPreview();

    clearCleanedPreview();

    showEmptyPreview();

    setPreviewStatus("");

}


/* =========================================================
   GLOBAL API
========================================================= */

window.GENZMetadataPreview = {

    renderOriginalPreview,
    renderOriginalImagePreview,
    renderOriginalVideoPreview,

    renderCleanedPreview,
    renderCleanedImagePreview,
    renderCleanedVideoPreview,

    renderImageWithFileReader,

    clearOriginalPreview,
    clearCleanedPreview,
    clearAllPreview,

    hideOriginalPreview,
    hideCleanedPreview,
    hideAllMediaPreview,

    showEmptyPreview,
    hideEmptyPreview,

    setPreviewStatus,

    showPreview,
    hidePreview,

    ensurePreviewStageVisible

};


/* =========================================================
   EXPORTS
========================================================= */

export {

    renderOriginalPreview,
    renderOriginalImagePreview,
    renderOriginalVideoPreview,

    renderCleanedPreview,
    renderCleanedImagePreview,
    renderCleanedVideoPreview,

    renderImageWithFileReader,

    clearOriginalPreview,
    clearCleanedPreview,
    clearAllPreview,

    hideOriginalPreview,
    hideCleanedPreview,
    hideAllMediaPreview,

    showEmptyPreview,
    hideEmptyPreview,

    setPreviewStatus,

    showPreview,
    hidePreview,

    ensurePreviewStageVisible

};
