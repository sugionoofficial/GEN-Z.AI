/* =========================================================
   GEN-Z.AI
   METADATA RESET MODULE
   ---------------------------------------------------------
   File:
   metadata-cleaner/assets/js/metadata-reset.js

   Fungsi:
   - Reset state ketika file baru dipilih
   - Reset seluruh aplikasi
   - Membersihkan object URL
   - Membersihkan preview
   - Reset status metadata
   - Tidak mengubah file asli
========================================================= */


import {
    state
} from "./metadata-state.js";


import {
    elements
} from "./metadata-dom.js";


import {
    clearOriginalPreview,
    clearCleanedPreview,
    setPreviewStatus
} from "./metadata-preview.js";


import {
    renderMetadata,
    setStatus
} from "./metadata-status.js";


/* =========================================================
   OBJECT URL
========================================================= */

function revokeObjectURL(
    url
) {

    if (
        !url
    ) {

        return;
    }


    if (
        typeof url !==
        "string"
    ) {

        return;
    }


    if (
        !url.startsWith(
            "blob:"
        )
    ) {

        return;
    }


    try {

        URL.revokeObjectURL(
            url
        );

    } catch (error) {

        console.warn(
            "[GEN-Z.AI] revokeObjectURL gagal:",
            error
        );
    }
}


/* =========================================================
   DOM HELPERS
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
   RESET FOR NEW FILE
========================================================= */

function resetForNewFile() {

    state.checked =
        false;


    state.metadata =
        [];


    state.aiIndicators =
        [];


    state.provenance =
        null;


    state.cleanedBlob =
        null;


    state.cleanedFile =
        null;


    if (
        state.originalURL
    ) {

        revokeObjectURL(
            state.originalURL
        );


        state.originalURL =
            null;
    }


    if (
        state.cleanedURL
    ) {

        revokeObjectURL(
            state.cleanedURL
        );


        state.cleanedURL =
            null;
    }


    clearOriginalPreview();


    clearCleanedPreview();


    hideElement(
        elements.cleanResult
    );


    if (
        elements.downloadButton
    ) {

        elements.downloadButton.disabled =
            true;
    }


    renderMetadata();


    hideElement(
        elements.aiOverlay
    );


    elements.statusIndicator?.classList.remove(
        "is-detected",
        "is-clear",
        "is-unknown"
    );
}


/* =========================================================
   RESET APPLICATION
========================================================= */

function resetApplication() {

    resetForNewFile();


    state.file =
        null;


    state.fileType =
        null;


    state.provenance =
        null;


    if (
        state.originalURL
    ) {

        revokeObjectURL(
            state.originalURL
        );


        state.originalURL =
            null;
    }


    if (
        state.cleanedURL
    ) {

        revokeObjectURL(
            state.cleanedURL
        );


        state.cleanedURL =
            null;
    }


    if (
        elements.fileInput
    ) {

        elements.fileInput.value =
            "";
    }


    elements.fileInfo?.classList.add(
        "hidden"
    );


    clearOriginalPreview();


    clearCleanedPreview();


    showElement(
        elements.previewEmpty
    );


    if (
        elements.checkButton
    ) {

        elements.checkButton.disabled =
            true;
    }


    if (
        elements.cleanButton
    ) {

        elements.cleanButton.disabled =
            true;
    }


    if (
        elements.downloadButton
    ) {

        elements.downloadButton.disabled =
            true;
    }


    setStatus(
        "UNKNOWN",
        "BELUM DIPERIKSA",
        "Tekan CHECK untuk membaca metadata media."
    );


    setPreviewStatus(
        "BELUM ADA MEDIA"
    );
}


/* =========================================================
   PUBLIC API
========================================================= */

export {
    resetForNewFile,
    resetApplication,
    revokeObjectURL
};


window.GENZMetadataReset = {

    resetForNewFile,
    resetApplication,
    revokeObjectURL

};
