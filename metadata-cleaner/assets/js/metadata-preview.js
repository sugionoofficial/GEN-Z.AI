/* =========================================================
   GEN-Z.AI
   METADATA PREVIEW MODULE
   ---------------------------------------------------------
   File:
   metadata-cleaner/assets/js/metadata-preview.js

   Tanggung jawab:
   - Original image preview
   - Original video preview
   - Cleaned image preview
   - Cleaned video preview
   - Preview status
   - Object URL management
   - Element visibility helpers
========================================================= */

import {
    state
} from "./metadata-state.js";

import {
    elements
} from "./metadata-dom.js";


/* =========================================================
   ELEMENT VISIBILITY
========================================================= */

export function showElement(
    element
) {

    if (
        !element
    ) {

        return;

    }


    element.classList.remove(
        "hidden",
        "d-none"
    );


    element.hidden =
        false;


    element.style.removeProperty(
        "display"
    );


    element.style.removeProperty(
        "visibility"
    );


    element.style.removeProperty(
        "opacity"
    );

}


export function hideElement(
    element
) {

    if (
        !element
    ) {

        return;

    }


    element.classList.add(
        "hidden"
    );


    element.hidden =
        true;


    element.style.display =
        "none";


    element.style.visibility =
        "hidden";


    element.style.opacity =
        "0";

}


/* =========================================================
   FORCE VISIBLE
========================================================= */

function forceVisible(
    element
) {

    if (
        !element
    ) {

        return;

    }


    element.classList.remove(
        "hidden",
        "d-none"
    );


    element.hidden =
        false;


    element.style.display =
        "block";


    element.style.visibility =
        "visible";


    element.style.opacity =
        "1";

}


/* =========================================================
   FORCE MEDIA VISIBLE
========================================================= */

function forceMediaVisible(
    element
) {

    if (
        !element
    ) {

        return;

    }


    element.classList.remove(
        "hidden",
        "d-none"
    );


    element.hidden =
        false;


    element.style.display =
        "block";


    element.style.visibility =
        "visible";


    element.style.opacity =
        "1";


    element.style.maxWidth =
        "100%";


    element.style.maxHeight =
        "100%";


    element.style.width =
        "auto";


    element.style.height =
        "auto";

}


/* =========================================================
   HIDE MEDIA
========================================================= */

function hideMedia(
    element
) {

    if (
        !element
    ) {

        return;

    }


    element.pause?.();


    element.removeAttribute(
        "src"
    );


    element.removeAttribute(
        "poster"
    );


    element.load?.();


    hideElement(
        element
    );

}


/* =========================================================
   CLEAR IMAGE
========================================================= */

function clearImageElement(
    element
) {

    if (
        !element
    ) {

        return;

    }


    element.removeAttribute(
        "src"
    );


    element.removeAttribute(
        "srcset"
    );


    element.alt =
        "";


    hideElement(
        element
    );

}


/* =========================================================
   CLEAR ORIGINAL PREVIEW
========================================================= */

export function clearOriginalPreview() {

    clearImageElement(
        elements.imagePreview
    );


    hideMedia(
        elements.videoPreview
    );


    if (
        elements.previewEmpty
    ) {

        showElement(
            elements.previewEmpty
        );

    }


    if (
        elements.previewStatus
    ) {

        elements.previewStatus.textContent =
            "";

        hideElement(
            elements.previewStatus
        );

    }


    if (
        elements.aiOverlay
    ) {

        hideElement(
            elements.aiOverlay
        );

    }

}


/* =========================================================
   CLEAR CLEANED PREVIEW
========================================================= */

export function clearCleanedPreview() {

    clearImageElement(
        elements.cleanImagePreview
    );


    hideMedia(
        elements.cleanVideoPreview
    );

}


/* =========================================================
   REVOKE ORIGINAL URL
========================================================= */

export function revokeOriginalPreviewUrl() {

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


        state.originalPreviewUrl =
            null;

    }

}


/* =========================================================
   REVOKE CLEANED URL
========================================================= */

export function revokeCleanedPreviewUrl() {

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
                "[GEN-Z.AI] Gagal revoke cleaned preview URL:",
                error
            );

        }


        state.cleanedPreviewUrl =
            null;

    }

}


/* =========================================================
   SET PREVIEW STATUS
========================================================= */

export function setPreviewStatus(
    message = "",
    type = ""
) {

    const status =
        elements.previewStatus;


    if (
        !status
    ) {

        return;

    }


    status.textContent =
        message || "";


    status.classList.remove(
        "is-loading",
        "is-success",
        "is-error",
        "is-warning",
        "is-info"
    );


    if (
        type
    ) {

        status.classList.add(
            `is-${type}`
        );

    }


    if (
        !message
    ) {

        hideElement(
            status
        );


        return;

    }


    showElement(
        status
    );

}


/* =========================================================
   SHOW EMPTY PREVIEW
========================================================= */

export function showPreviewEmpty() {

    if (
        elements.previewEmpty
    ) {

        showElement(
            elements.previewEmpty
        );

    }


    if (
        elements.imagePreview
    ) {

        hideElement(
            elements.imagePreview
        );

    }


    if (
        elements.videoPreview
    ) {

        hideElement(
            elements.videoPreview
        );

    }

}


/* =========================================================
   HIDE EMPTY PREVIEW
========================================================= */

export function hidePreviewEmpty() {

    if (
        elements.previewEmpty
    ) {

        hideElement(
            elements.previewEmpty
        );

    }

}


/* =========================================================
   IMAGE PREVIEW
========================================================= */

export function renderImagePreview(
    source
) {

    const image =
        elements.imagePreview;


    if (
        !image
    ) {

        console.warn(
            "[GEN-Z.AI] Image preview element tidak ditemukan."
        );


        return false;

    }


    if (
        !source
    ) {

        return false;

    }


    if (
        elements.videoPreview
    ) {

        hideElement(
            elements.videoPreview
        );


        elements.videoPreview.pause?.();

    }


    hidePreviewEmpty();


    image.onload =
        () => {

            forceMediaVisible(
                image
            );

        };


    image.onerror =
        () => {

            console.error(
                "[GEN-Z.AI] Gagal menampilkan image preview."
            );

        };


    image.src =
        source;


    forceMediaVisible(
        image
    );


    return true;

}


/* =========================================================
   VIDEO PREVIEW
========================================================= */

export function renderVideoPreview(
    source
) {

    const video =
        elements.videoPreview;


    if (
        !video
    ) {

        console.warn(
            "[GEN-Z.AI] Video preview element tidak ditemukan."
        );


        return false;

    }


    if (
        !source
    ) {

        return false;

    }


    if (
        elements.imagePreview
    ) {

        hideElement(
            elements.imagePreview
        );


        elements.imagePreview.removeAttribute(
            "src"
        );

    }


    hidePreviewEmpty();


    video.onloadedmetadata =
        () => {

            forceMediaVisible(
                video
            );

        };


    video.onerror =
        () => {

            console.error(
                "[GEN-Z.AI] Gagal menampilkan video preview."
            );

        };


    video.src =
        source;


    video.muted =
        true;


    video.playsInline =
        true;


    video.controls =
        true;


    forceMediaVisible(
        video
    );


    try {

        video.load();

    } catch (
        error
    ) {

        console.warn(
            "[GEN-Z.AI] Video load warning:",
            error
        );

    }


    return true;

}


/* =========================================================
   FILE PREVIEW
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


    revokeOriginalPreviewUrl();


    let objectUrl =
        "";


    try {

        objectUrl =
            URL.createObjectURL(
                file
            );

    } catch (
        error
    ) {

        console.error(
            "[GEN-Z.AI] Tidak dapat membuat preview URL:",
            error
        );


        return false;

    }


    state.originalPreviewUrl =
        objectUrl;


    const type =
        String(
            file.type ||
            ""
        )
            .toLowerCase();


    const isImage =
        type.startsWith(
            "image/"
        );


    const isVideo =
        type.startsWith(
            "video/"
        );


    if (
        isImage
    ) {

        return renderImagePreview(
            objectUrl
        );

    }


    if (
        isVideo
    ) {

        return renderVideoPreview(
            objectUrl
        );

    }


    URL.revokeObjectURL(
        objectUrl
    );


    state.originalPreviewUrl =
        null;


    clearOriginalPreview();


    return false;

}


/* =========================================================
   CLEANED IMAGE PREVIEW
========================================================= */

export function renderCleanedImagePreview(
    source
) {

    const image =
        elements.cleanImagePreview;


    if (
        !image
    ) {

        return false;

    }


    if (
        elements.cleanVideoPreview
    ) {

        hideElement(
            elements.cleanVideoPreview
        );


        elements.cleanVideoPreview.pause?.();

    }


    image.onload =
        () => {

            forceMediaVisible(
                image
            );

        };


    image.onerror =
        () => {

            console.error(
                "[GEN-Z.AI] Gagal menampilkan cleaned image preview."
            );

        };


    image.src =
        source;


    forceMediaVisible(
        image
    );


    return true;

}


/* =========================================================
   CLEANED VIDEO PREVIEW
========================================================= */

export function renderCleanedVideoPreview(
    source
) {

    const video =
        elements.cleanVideoPreview;


    if (
        !video
    ) {

        return false;

    }


    if (
        elements.cleanImagePreview
    ) {

        hideElement(
            elements.cleanImagePreview
        );


        elements.cleanImagePreview.removeAttribute(
            "src"
        );

    }


    video.onloadedmetadata =
        () => {

            forceMediaVisible(
                video
            );

        };


    video.onerror =
        () => {

            console.error(
                "[GEN-Z.AI] Gagal menampilkan cleaned video preview."
            );

        };


    video.src =
        source;


    video.muted =
        true;


    video.playsInline =
        true;


    video.controls =
        true;


    forceMediaVisible(
        video
    );


    try {

        video.load();

    } catch (
        error
    ) {

        console.warn(
            "[GEN-Z.AI] Cleaned video load warning:",
            error
        );

    }


    return true;

}


/* =========================================================
   CLEANED FILE PREVIEW
========================================================= */

export function renderCleanedPreview(
    file
) {

    if (
        !file
    ) {

        clearCleanedPreview();

        return false;

    }


    revokeCleanedPreviewUrl();


    let objectUrl =
        "";


    try {

        objectUrl =
            URL.createObjectURL(
                file
            );

    } catch (
        error
    ) {

        console.error(
            "[GEN-Z.AI] Tidak dapat membuat cleaned preview URL:",
            error
        );


        return false;

    }


    state.cleanedPreviewUrl =
        objectUrl;


    const type =
        String(
            file.type ||
            ""
        )
            .toLowerCase();


    if (
        type.startsWith(
            "image/"
        )
    ) {

        return renderCleanedImagePreview(
            objectUrl
        );

    }


    if (
        type.startsWith(
            "video/"
        )
    ) {

        return renderCleanedVideoPreview(
            objectUrl
        );

    }


    URL.revokeObjectURL(
        objectUrl
    );


    state.cleanedPreviewUrl =
        null;


    clearCleanedPreview();


    return false;

}


/* =========================================================
   FILE READER IMAGE FALLBACK
========================================================= */

export function renderImagePreviewFromDataUrl(
    dataUrl
) {

    if (
        !dataUrl
    ) {

        return false;

    }


    if (
        elements.videoPreview
    ) {

        hideElement(
            elements.videoPreview
        );

    }


    hidePreviewEmpty();


    if (
        !elements.imagePreview
    ) {

        return false;

    }


    elements.imagePreview.onload =
        () => {

            forceMediaVisible(
                elements.imagePreview
            );

        };


    elements.imagePreview.src =
        dataUrl;


    forceMediaVisible(
        elements.imagePreview
    );


    return true;

}


/* =========================================================
   FILE READER
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
                        "File tidak tersedia."
                    )
                );


                return;

            }


            const reader =
                new FileReader();


            reader.onload =
                event => {

                    const result =
                        event.target?.result;


                    if (
                        typeof result !== "string"
                    ) {

                        reject(
                            new Error(
                                "Data URL image tidak valid."
                            )
                        );


                        return;

                    }


                    resolve(
                        result
                    );

                };


            reader.onerror =
                () => {

                    reject(
                        reader.error ||
                        new Error(
                            "Gagal membaca image."
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
   ORIGINAL PREVIEW WITH FALLBACK
========================================================= */

export async function renderOriginalPreviewSafe(
    file
) {

    if (
        !file
    ) {

        clearOriginalPreview();

        return false;

    }


    const rendered =
        renderOriginalPreview(
            file
        );


    if (
        rendered
    ) {

        return true;

    }


    const type =
        String(
            file.type ||
            ""
        )
            .toLowerCase();


    if (
        !type.startsWith(
            "image/"
        )
    ) {

        return false;

    }


    try {

        const dataUrl =
            await readImageAsDataUrl(
                file
            );


        return renderImagePreviewFromDataUrl(
            dataUrl
        );

    } catch (
        error
    ) {

        console.error(
            "[GEN-Z.AI] Image preview fallback gagal:",
            error
        );


        return false;

    }

}


/* =========================================================
   RESET PREVIEW
========================================================= */

export function resetPreview() {

    revokeOriginalPreviewUrl();

    revokeCleanedPreviewUrl();

    clearOriginalPreview();

    clearCleanedPreview();

    setPreviewStatus(
        ""
    );

}


/* =========================================================
   PUBLIC API
========================================================= */

export {
    forceVisible,
    forceMediaVisible,
    hideMedia,
    clearImageElement
};
