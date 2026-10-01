/* =========================================================
   GEN-Z.AI
   AI METADATA CLEANER
   ---------------------------------------------------------
   File:
   metadata-cleaner/assets/js/metadata-events.js

   Fungsi:
   - Register application event listeners
   - Menangani file input
   - Menangani click upload
   - Menangani drag & drop
   - Menangani tombol CHECK
   - Menangani tombol CLEAN
   - Menangani tombol DOWNLOAD

   Catatan:
   - Tidak mengubah proses metadata
   - Tidak mengubah Sightengine
   - Tidak mengubah cleaning
   - Tidak mengubah state
   - Dropzone tetap menggunakan input file yang sama
   - Upload menggunakan input.click() secara eksplisit
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
       Ini adalah event utama ketika user benar-benar
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
       Jangan mengandalkan default behavior <label>.

       HTML menggunakan:

       <label id="metadata-dropzone">
           <input
               id="metadata-file-input"
               type="file"
               hidden
           >
       </label>

       Karena input berada di dalam label, browser dapat
       menjalankan label activation secara otomatis.

       Di sini default action dimatikan lalu picker dibuka
       secara eksplisit satu kali.
    ===================================================== */

    if (
        elements.dropzone
    ) {

        elements.dropzone.addEventListener(
            "click",
            event => {

                /*
                   Jangan biarkan browser menjalankan
                   default activation dari <label>.
                */

                event.preventDefault();


                /*
                   Hentikan event agar tidak diteruskan
                   ke handler global lain.
                */

                event.stopPropagation();


                /*
                   Jika browser mengirim event click
                   langsung pada input, jangan panggil
                   input.click() kembali.
                */

                if (
                    event.target === elements.fileInput
                ) {

                    return;

                }


                /*
                   Gunakan fungsi picker milik coordinator.
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
       -----------------------------------------------------
       Tombol GANTI menggunakan picker yang sama.
    ===================================================== */

    if (
        elements.changeButton
    ) {

        elements.changeButton.addEventListener(
            "click",
            event => {

                /*
                   Tombol berada di area aplikasi sendiri.
                   Jangan biarkan event naik ke parent.
                */

                event.preventDefault();
                event.stopPropagation();


                /*
                   Buka picker.
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
       CHECK
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
       CLEAN
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
       DOWNLOAD
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
       DEBUG
       -----------------------------------------------------
       Tidak memproses file.

       Hanya memastikan event binding memang terjadi.
    ===================================================== */

    console.info(
        "[GEN-Z.AI] Metadata Cleaner events bound.",
        {
            fileInput: Boolean(elements.fileInput),
            dropzone: Boolean(elements.dropzone),
            changeButton: Boolean(elements.changeButton),
            checkButton: Boolean(elements.checkButton),
            cleanButton: Boolean(elements.cleanButton),
            downloadButton: Boolean(elements.downloadButton)
        }
    );

}
