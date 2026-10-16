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

    if (!state.cleanedBlob) {

        console.error(
            "[GEN-Z.AI][DOWNLOAD] Blob hasil cleaning tidak tersedia."
        );

        return false;
    }


    let downloadURL;

    try {

        downloadURL =
            URL.createObjectURL(
                state.cleanedBlob
            );

        const anchor =
            document.createElement(
                "a"
            );

        anchor.href =
            downloadURL;


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

        setTimeout(
            () => URL.revokeObjectURL(downloadURL),
            1000
        );

        return true;

    } catch (error) {

        if (downloadURL) {

            URL.revokeObjectURL(
                downloadURL
            );
        }

        console.error(
            "[GEN-Z.AI][DOWNLOAD] Gagal mengunduh file hasil cleaning.",
            error
        );

        return false;
    }
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
