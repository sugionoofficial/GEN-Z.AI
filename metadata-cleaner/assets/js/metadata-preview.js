/* =========================================================
   GEN-Z.AI
   AI METADATA CLEANER
   ---------------------------------------------------------
   File:
   metadata-cleaner/assets/js/metadata-preview.js

   Fungsi:
   - Render preview file asli
   - Render preview hasil cleaning
   - Mengatur status preview
   - Helper show / hide element

   Catatan:
   - Tidak mengubah state file
   - Tidak mengubah proses metadata
   - Tidak mengubah proses cleaning
   - Tidak membuat object URL baru
   - Menggunakan nama element yang sama dengan metadata-dom.js
========================================================= */


import {
    state
} from "./metadata-state.js";


import {
    elements
} from "./metadata-dom.js";


/* =========================================================
   ORIGINAL PREVIEW
========================================================= */

export function renderOriginalPreview() {

    /*
       Pastikan semua area preview
       berada dalam kondisi bersih
    */

    hideElement(
        elements.previewEmpty
    );


    hideElement(
        elements.imagePreview
    );


    hideElement(
        elements.videoPreview
    );


    hideElement(
        elements.aiOverlay
    );


    /*
       Tidak ada file
    */

    if (
        !state.file ||
        !state.originalURL
    ) {

        showElement(
            elements.previewEmpty
        );

        return;
    }


    /*
       IMAGE
    */

    if (
        state.fileType === "image"
    ) {

        if (
            elements.imagePreview
        ) {

            elements.imagePreview.src =
                state.originalURL;

        }


        showElement(
            elements.imagePreview
        );

        return;
    }


    /*
       VIDEO
    */

    if (
        state.fileType === "video"
    ) {

        if (
            elements.videoPreview
        ) {

            elements.videoPreview.src =
                state.originalURL;

        }


        showElement(
            elements.videoPreview
        );

        return;
    }


    /*
       Fallback
    */

    showElement(
        elements.previewEmpty
    );

}


/* =========================================================
   CLEANED PREVIEW
========================================================= */

export function renderCleanedPreview(
    url
) {

    /*
       Bersihkan preview hasil sebelumnya.
    */

    hideElement(
        elements.cleanImagePreview
    );


    hideElement(
        elements.cleanVideoPreview
    );


    /*
       Tidak ada URL hasil cleaning.
    */

    if (
        !url
    ) {

        return;
    }


    /*
       IMAGE
    */

    if (
        state.fileType === "image"
    ) {

        if (
            elements.cleanImagePreview
        ) {

            elements.cleanImagePreview.src =
                url;

        }


        showElement(
            elements.cleanImagePreview
        );

        return;
    }


    /*
       VIDEO
    */

    if (
        state.fileType === "video"
    ) {

        if (
            elements.cleanVideoPreview
        ) {

            elements.cleanVideoPreview.src =
                url;

        }


        showElement(
            elements.cleanVideoPreview
        );

        return;
    }

}


/* =========================================================
   PREVIEW STATUS
========================================================= */

export function setPreviewStatus(
    text
) {

    if (
        !elements.previewStatus
    ) {

        return;
    }


    elements.previewStatus.textContent =
        text || "";

}


/* =========================================================
   SHOW ELEMENT
========================================================= */

export function showElement(
    element
) {

    element?.classList.remove(
        "hidden"
    );

}


/* =========================================================
   HIDE ELEMENT
========================================================= */

export function hideElement(
    element
) {

    element?.classList.add(
        "hidden"
    );

}
