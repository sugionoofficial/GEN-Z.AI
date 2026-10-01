/* =========================================================
   GEN-Z.AI
   METADATA DOWNLOAD MODULE
   ---------------------------------------------------------
   File:
   metadata-cleaner/assets/js/metadata-download.js

   Fungsi:
   - Download file hasil cleaning
   - Menentukan nama file hasil
   - Tidak mengubah state cleaning
   - Tidak mengubah file asli
========================================================= */


import {
    state
} from "./metadata-state.js";


/* =========================================================
   DOWNLOAD CLEANED FILE
========================================================= */

function downloadCleanedFile() {

    if (
        !state.cleanedBlob ||
        !state.cleanedURL
    ) {

        return;
    }


    const anchor =
        document.createElement(
            "a"
        );


    anchor.href =
        state.cleanedURL;


    anchor.download =
        state.cleanedFile?.name ||
        createCleanedFilename(
            state.file?.name ||
            "media"
        );


    anchor.style.display =
        "none";


    document.body.appendChild(
        anchor
    );


    anchor.click();


    anchor.remove();
}


/* =========================================================
   CREATE CLEANED FILENAME
========================================================= */

function createCleanedFilename(
    originalName
) {

    const safeName =
        String(
            originalName ||
            "media"
        );


    const dot =
        safeName.lastIndexOf(
            "."
        );


    if (
        dot <= 0
    ) {

        return `${safeName}_cleaned`;
    }


    const base =
        safeName.slice(
            0,
            dot
        );


    const extension =
        safeName.slice(
            dot + 1
        );


    return `${base}_cleaned.${extension}`;
}


/* =========================================================
   PUBLIC API
========================================================= */

export {

    downloadCleanedFile,

    createCleanedFilename

};


window.GENZMetadataDownload = {

    downloadCleanedFile,

    createCleanedFilename

};
