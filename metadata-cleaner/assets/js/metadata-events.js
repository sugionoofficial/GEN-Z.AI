/* =========================================================
   GEN-Z.AI
   AI METADATA CLEANER
   ---------------------------------------------------------
   File:
   metadata-cleaner/assets/js/metadata-events.js

   Fungsi:
   - Register application event listeners
   - Menangani click upload secara eksplisit
   - Menangani file input
   - Menangani drag & drop

   Catatan:
   - Tidak mengubah proses metadata
   - Tidak mengubah Sightengine
   - Tidak mengubah cleaning
   - Dropzone tetap menggunakan input file yang sama
========================================================= */


/* =========================================================
   DOM
========================================================= */

import {
    elements
} from "./metadata-dom.js";


/* =========================================================
   BIND EVENTS
========================================================= */

export function bindMetadataEvents({

    handleFileInput,
    openFilePicker,
    checkMetadata,
    cleanMetadata,
    downloadCleanedFile,
    handleDragOver,
    handleDragLeave,
    handleDrop

}) {


    /* =====================================================
       FILE INPUT
    ===================================================== */

    elements.fileInput?.addEventListener(
        "change",
        handleFileInput
    );


    /* =====================================================
       DROPZONE CLICK
       -----------------------------------------------------
       Jangan hanya mengandalkan <label for="...">.

       Click handler eksplisit memastikan area upload
       tetap membuka native file picker meskipun ada
       CSS / event global lain pada halaman.
    ===================================================== */

    elements.dropzone?.addEventListener(
        "click",
        event => {

            /*
               Jika user benar-benar mengklik input,
               browser sudah menangani file picker sendiri.

               Jangan membuka picker kedua.
            */

            if (
                event.target === elements.fileInput
            ) {

                return;

            }


            /*
               Hentikan propagasi agar event global
               dari navigation / page handler tidak
               mengganggu upload.
            */

            event.stopPropagation();


            /*
               Buka native file picker.
            */

            openFilePicker();

        }
    );


    /* =====================================================
       CHANGE FILE BUTTON
    ===================================================== */

    elements.changeButton?.addEventListener(
        "click",
        event => {

            event.stopPropagation();

            openFilePicker();

        }
    );


    /* =====================================================
       CHECK
    ===================================================== */

    elements.checkButton?.addEventListener(
        "click",
        checkMetadata
    );


    /* =====================================================
       CLEAN
    ===================================================== */

    elements.cleanButton?.addEventListener(
        "click",
        cleanMetadata
    );


    /* =====================================================
       DOWNLOAD
    ===================================================== */

    elements.downloadButton?.addEventListener(
        "click",
        downloadCleanedFile
    );


    /* =====================================================
       DRAG OVER
    ===================================================== */

    elements.dropzone?.addEventListener(
        "dragover",
        handleDragOver
    );


    /* =====================================================
       DRAG LEAVE
    ===================================================== */

    elements.dropzone?.addEventListener(
        "dragleave",
        handleDragLeave
    );


    /* =====================================================
       DROP
    ===================================================== */

    elements.dropzone?.addEventListener(
        "drop",
        handleDrop
    );

}
