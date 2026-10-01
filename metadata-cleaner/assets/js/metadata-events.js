 /* =========================================================
   GEN-Z.AI
   AI METADATA CLEANER
   ---------------------------------------------------------
   File:
   metadata-cleaner/assets/js/metadata-events.js

   Fungsi:
   - Register application event listeners
   - Menangani file input
   - Menangani upload click
   - Menangani drag & drop
   - Menangani CHECK
   - Menangani CLEAN
   - Menangani DOWNLOAD

   Upload architecture:
   - Native file input menjadi sumber upload utama
   - Dropzone hanya menjadi trigger UI
   - Tidak bergantung pada default <label>
   - Tidak membuka picker dua kali
   - Tidak mengubah proses metadata
   - Tidak mengubah Sightengine
   - Tidak mengubah cleaning
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
       -----------------------------------------------------
       Ini adalah sumber event upload yang sebenarnya.

       Browser akan mengirim event "change" setelah user
       memilih file dari native file picker.
    ===================================================== */

    if (
        elements.fileInput &&
        typeof handleFileInput === "function"
    ) {

        elements.fileInput.addEventListener(
            "change",
            handleFileInput
        );

    }


    /* =====================================================
       DROPZONE CLICK
       -----------------------------------------------------
       Dropzone pada HTML saat ini berupa <label> yang
       membungkus input file.

       Kita tidak menggunakan default activation dari
       <label>. Picker dibuka secara eksplisit.

       preventDefault():
       - mencegah label menjalankan activation otomatis

       stopPropagation():
       - mencegah handler lain ikut memproses click

       input.click():
       - membuka native file picker tepat satu kali
    ===================================================== */

    if (
        elements.dropzone
    ) {

        elements.dropzone.addEventListener(
            "click",
            event => {

                event.preventDefault();
                event.stopPropagation();


                /*
                   Jika target adalah input file itu sendiri,
                   jangan menjalankan picker kedua.
                */

                if (
                    event.target === elements.fileInput
                ) {

                    return;

                }


                /*
                   Pastikan fungsi picker memang tersedia.
                */

                if (
                    typeof openFilePicker === "function"
                ) {

                    openFilePicker();

                }

            }
        );

    }


    /* =====================================================
       CHANGE FILE BUTTON
    ===================================================== */

    if (
        elements.changeButton
    ) {

        elements.changeButton.addEventListener(
            "click",
            event => {

                event.preventDefault();
                event.stopPropagation();


                if (
                    typeof openFilePicker === "function"
                ) {

                    openFilePicker();

                }

            }
        );

    }


    /* =====================================================
       CHECK BUTTON
    ===================================================== */

    if (
        elements.checkButton &&
        typeof checkMetadata === "function"
    ) {

        elements.checkButton.addEventListener(
            "click",
            checkMetadata
        );

    }


    /* =====================================================
       CLEAN BUTTON
    ===================================================== */

    if (
        elements.cleanButton &&
        typeof cleanMetadata === "function"
    ) {

        elements.cleanButton.addEventListener(
            "click",
            cleanMetadata
        );

    }


    /* =====================================================
       DOWNLOAD BUTTON
    ===================================================== */

    if (
        elements.downloadButton &&
        typeof downloadCleanedFile === "function"
    ) {

        elements.downloadButton.addEventListener(
            "click",
            downloadCleanedFile
        );

    }


    /* =====================================================
       DRAG OVER
    ===================================================== */

    if (
        elements.dropzone &&
        typeof handleDragOver === "function"
    ) {

        elements.dropzone.addEventListener(
            "dragover",
            handleDragOver
        );

    }


    /* =====================================================
       DRAG LEAVE
    ===================================================== */

    if (
        elements.dropzone &&
        typeof handleDragLeave === "function"
    ) {

        elements.dropzone.addEventListener(
            "dragleave",
            handleDragLeave
        );

    }


    /* =====================================================
       DROP
    ===================================================== */

    if (
        elements.dropzone &&
        typeof handleDrop === "function"
    ) {

        elements.dropzone.addEventListener(
            "drop",
            handleDrop
        );

    }


    /* =====================================================
       DIAGNOSTIC
       -----------------------------------------------------
       Tidak mengubah fungsi aplikasi.

       Hanya memastikan semua elemen dan handler utama
       berhasil ditemukan ketika module dijalankan.
    ===================================================== */

    console.info(
        "[GEN-Z.AI] Metadata Cleaner event binding:",
        {
            fileInput: Boolean(
                elements.fileInput
            ),

            dropzone: Boolean(
                elements.dropzone
            ),

            changeButton: Boolean(
                elements.changeButton
            ),

            checkButton: Boolean(
                elements.checkButton
            ),

            cleanButton: Boolean(
                elements.cleanButton
            ),

            downloadButton: Boolean(
                elements.downloadButton
            ),

            handleFileInput:
                typeof handleFileInput === "function",

            openFilePicker:
                typeof openFilePicker === "function",

            checkMetadata:
                typeof checkMetadata === "function",

            cleanMetadata:
                typeof cleanMetadata === "function",

            downloadCleanedFile:
                typeof downloadCleanedFile === "function",

            handleDragOver:
                typeof handleDragOver === "function",

            handleDragLeave:
                typeof handleDragLeave === "function",

            handleDrop:
                typeof handleDrop === "function"
        }
    );

}
