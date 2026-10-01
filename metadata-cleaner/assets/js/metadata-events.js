/* =========================================================
   GEN-Z.AI
   AI METADATA CLEANER
   ---------------------------------------------------------
   File:
   metadata-cleaner/assets/js/metadata-events.js

   Tanggung jawab:
   - Native file input
   - Drag & Drop
   - File selection
   - Check metadata
   - Clean metadata
   - Download cleaned file
   - Reset
   - Change file

   IMPORTANT:
   - Jalur upload/file input langsung menggunakan
     processSelectedFile().
   - Tidak bergantung pada callback metadata-app.js
     untuk proses upload.
   - Jalur CHECK / CLEAN / DOWNLOAD tetap menggunakan
     callback coordinator.
========================================================= */


/* =========================================================
   DOM
========================================================= */

import {
    elements
} from "./metadata-dom.js";


/* =========================================================
   FILE PROCESSOR
========================================================= */

import {
    processSelectedFile
} from "./metadata-file.js";


/* =========================================================
   CALLBACKS
========================================================= */

let callbacks = {};


/* =========================================================
   SET CALLBACKS
========================================================= */

function setCallbacks(
    providedCallbacks = {}
) {

    callbacks = {
        ...providedCallbacks
    };

}


/* =========================================================
   OPEN FILE PICKER
========================================================= */

export function openFilePicker() {

    const input =
        elements?.fileInput;


    if (
        !input
    ) {

        console.error(
            "[GEN-Z.AI] metadata-events: #metadata-file-input tidak ditemukan."
        );

        return;
    }


    try {

        input.click();

    } catch (error) {

        console.error(
            "[GEN-Z.AI] metadata-events: gagal membuka file picker.",
            error
        );

    }

}


/* =========================================================
   FILE INPUT CHANGE
   ---------------------------------------------------------
   LANGSUNG diproses di sini.

   Tidak lagi:

       event
         ↓
       callback
         ↓
       metadata-app
         ↓
       metadata-file

   Sekarang:

       event
         ↓
       processSelectedFile()
========================================================= */

function handleFileInput(
    event
) {

    const input =
        event?.target;


    if (
        !input
    ) {

        console.error(
            "[GEN-Z.AI] metadata-events: file input target tidak tersedia."
        );

        return;
    }


    const files =
        Array.from(
            input.files || []
        );


    console.info(
        "[GEN-Z.AI] Native file input:",
        files.length
    );


    if (
        files.length === 0
    ) {

        return;
    }


    try {

        processSelectedFile(
            files[0]
        );

    } catch (error) {

        console.error(
            "[GEN-Z.AI] metadata-events: processSelectedFile gagal:",
            error
        );

    }


    /*
       Reset value setelah file berhasil
       diserahkan ke processor.

       Ini memungkinkan file yang sama dipilih
       kembali pada percobaan berikutnya.
    */

    try {

        input.value =
            "";

    } catch (error) {

        console.warn(
            "[GEN-Z.AI] metadata-events: gagal reset input value.",
            error
        );

    }

}


/* =========================================================
   DRAG ENTER
========================================================= */

function handleDragEnter(
    event
) {

    event.preventDefault();
    event.stopPropagation();


    elements?.dropzone
        ?.classList
        ?.add(
            "dragover"
        );

}


/* =========================================================
   DRAG OVER
========================================================= */

function handleDragOver(
    event
) {

    event.preventDefault();
    event.stopPropagation();


    if (
        event.dataTransfer
    ) {

        event.dataTransfer.dropEffect =
            "copy";

    }


    elements?.dropzone
        ?.classList
        ?.add(
            "dragover"
        );


    const handler =
        callbacks?.handleDragOver;


    if (
        typeof handler === "function"
    ) {

        handler(
            event
        );

    }

}


/* =========================================================
   DRAG LEAVE
========================================================= */

function handleDragLeave(
    event
) {

    event.preventDefault();
    event.stopPropagation();


    const dropzone =
        elements?.dropzone;


    if (
        !dropzone
    ) {

        return;
    }


    /*
       Jangan menghapus visual drag state
       jika pointer masih berada di dalam
       dropzone.
    */

    if (
        event.relatedTarget &&
        dropzone.contains(
            event.relatedTarget
        )
    ) {

        return;
    }


    dropzone.classList.remove(
        "dragover"
    );


    dropzone.classList.remove(
        "is-dragging"
    );


    const handler =
        callbacks?.handleDragLeave;


    if (
        typeof handler === "function"
    ) {

        handler(
            event
        );

    }

}


/* =========================================================
   DROP
   ---------------------------------------------------------
   LANGSUNG memproses file.

   Tidak bergantung pada callback coordinator
   untuk upload.
========================================================= */

function handleDrop(
    event
) {

    event.preventDefault();
    event.stopPropagation();


    elements?.dropzone
        ?.classList
        ?.remove(
            "dragover"
        );


    elements?.dropzone
        ?.classList
        ?.remove(
            "is-dragging"
        );


    const files =
        Array.from(
            event?.dataTransfer?.files || []
        );


    console.info(
        "[GEN-Z.AI] Drop files:",
        files.length
    );


    if (
        files.length === 0
    ) {

        return;
    }


    try {

        processSelectedFile(
            files[0]
        );

    } catch (error) {

        console.error(
            "[GEN-Z.AI] metadata-events: dropped file gagal diproses:",
            error
        );

    }

}


/* =========================================================
   DROPZONE CLICK
   ---------------------------------------------------------
   Native input menutupi seluruh area dropzone.

   Jangan memanggil input.click() lagi dari click
   karena dapat membuka file picker dua kali.
========================================================= */

function handleDropzoneClick(
    event
) {

    if (
        event?.target ===
        elements?.fileInput
    ) {

        return;
    }


    /*
       Native input menangani klik.
    */

}


/* =========================================================
   DROPZONE KEYBOARD
========================================================= */

function handleDropzoneKeydown(
    event
) {

    const key =
        event?.key;


    if (
        key !== "Enter" &&
        key !== " "
    ) {

        return;
    }


    event.preventDefault();


    openFilePicker();

}


/* =========================================================
   CHECK
========================================================= */

function handleCheckClick(
    event
) {

    event?.preventDefault();


    const handler =
        callbacks?.checkMetadata;


    if (
        typeof handler !== "function"
    ) {

        console.error(
            "[GEN-Z.AI] metadata-events: checkMetadata callback tidak tersedia."
        );

        return;
    }


    try {

        handler();

    } catch (error) {

        console.error(
            "[GEN-Z.AI] metadata-events: checkMetadata gagal:",
            error
        );

    }

}


/* =========================================================
   CLEAN
========================================================= */

function handleCleanClick(
    event
) {

    event?.preventDefault();


    const handler =
        callbacks?.cleanMetadata;


    if (
        typeof handler !== "function"
    ) {

        console.error(
            "[GEN-Z.AI] metadata-events: cleanMetadata callback tidak tersedia."
        );

        return;
    }


    try {

        handler();

    } catch (error) {

        console.error(
            "[GEN-Z.AI] metadata-events: cleanMetadata gagal:",
            error
        );

    }

}


/* =========================================================
   DOWNLOAD
========================================================= */

function handleDownloadClick(
    event
) {

    event?.preventDefault();


    const handler =
        callbacks?.downloadCleanedFile;


    if (
        typeof handler !== "function"
    ) {

        console.error(
            "[GEN-Z.AI] metadata-events: downloadCleanedFile callback tidak tersedia."
        );

        return;
    }


    try {

        handler();

    } catch (error) {

        console.error(
            "[GEN-Z.AI] metadata-events: download gagal:",
            error
        );

    }

}


/* =========================================================
   RESET
========================================================= */

function handleResetClick(
    event
) {

    event?.preventDefault();


    const handler =
        callbacks?.reset;


    if (
        typeof handler !== "function"
    ) {

        return;
    }


    try {

        handler();

    } catch (error) {

        console.error(
            "[GEN-Z.AI] metadata-events: reset gagal:",
            error
        );

    }

}


/* =========================================================
   CHANGE FILE
========================================================= */

function handleChangeClick(
    event
) {

    event?.preventDefault();


    openFilePicker();

}


/* =========================================================
   DOCUMENT DRAGOVER
========================================================= */

function preventDocumentDragOver(
    event
) {

    event.preventDefault();

}


/* =========================================================
   DOCUMENT DROP
========================================================= */

function preventDocumentDrop(
    event
) {

    /*
       Jangan mencegah drop yang memang terjadi
       di dalam dropzone.

       Kalau drop terjadi di luar dropzone,
       browser tidak boleh membuka file tersebut.
    */

    const dropzone =
        elements?.dropzone;


    if (
        dropzone &&
        event.target &&
        dropzone.contains(
            event.target
        )
    ) {

        return;
    }


    event.preventDefault();

}


/* =========================================================
   BIND EVENTS
========================================================= */

export function bindMetadataEvents(
    providedCallbacks = {}
) {

    setCallbacks(
        providedCallbacks
    );


    const {
        fileInput,
        dropzone,
        checkButton,
        cleanButton,
        downloadButton,
        resetButton,
        changeButton
    } =
        elements || {};


    /* =====================================================
       FILE INPUT
    ===================================================== */

    if (
        fileInput
    ) {

        /*
           Pastikan tidak terjadi binding ganda
           jika init terpanggil lebih dari sekali.
        */

        fileInput.removeEventListener(
            "change",
            handleFileInput
        );


        fileInput.addEventListener(
            "change",
            handleFileInput
        );

    } else {

        console.error(
            "[GEN-Z.AI] metadata-events: #metadata-file-input TIDAK DITEMUKAN."
        );

    }


    /* =====================================================
       DROPZONE
    ===================================================== */

    if (
        dropzone
    ) {

        dropzone.removeEventListener(
            "click",
            handleDropzoneClick
        );


        dropzone.removeEventListener(
            "keydown",
            handleDropzoneKeydown
        );


        dropzone.removeEventListener(
            "dragenter",
            handleDragEnter
        );


        dropzone.removeEventListener(
            "dragover",
            handleDragOver
        );


        dropzone.removeEventListener(
            "dragleave",
            handleDragLeave
        );


        dropzone.removeEventListener(
            "drop",
            handleDrop
        );


        dropzone.addEventListener(
            "click",
            handleDropzoneClick
        );


        dropzone.addEventListener(
            "keydown",
            handleDropzoneKeydown
        );


        dropzone.addEventListener(
            "dragenter",
            handleDragEnter
        );


        dropzone.addEventListener(
            "dragover",
            handleDragOver
        );


        dropzone.addEventListener(
            "dragleave",
            handleDragLeave
        );


        dropzone.addEventListener(
            "drop",
            handleDrop
        );

    }


    /* =====================================================
       CHECK
    ===================================================== */

    if (
        checkButton
    ) {

        checkButton.removeEventListener(
            "click",
            handleCheckClick
        );


        checkButton.addEventListener(
            "click",
            handleCheckClick
        );

    }


    /* =====================================================
       CLEAN
    ===================================================== */

    if (
        cleanButton
    ) {

        cleanButton.removeEventListener(
            "click",
            handleCleanClick
        );


        cleanButton.addEventListener(
            "click",
            handleCleanClick
        );

    }


    /* =====================================================
       DOWNLOAD
    ===================================================== */

    if (
        downloadButton
    ) {

        downloadButton.removeEventListener(
            "click",
            handleDownloadClick
        );


        downloadButton.addEventListener(
            "click",
            handleDownloadClick
        );

    }


    /* =====================================================
       RESET
    ===================================================== */

    if (
        resetButton
    ) {

        resetButton.removeEventListener(
            "click",
            handleResetClick
        );


        resetButton.addEventListener(
            "click",
            handleResetClick
        );

    }


    /* =====================================================
       CHANGE FILE
    ===================================================== */

    if (
        changeButton
    ) {

        changeButton.removeEventListener(
            "click",
            handleChangeClick
        );


        changeButton.addEventListener(
            "click",
            handleChangeClick
        );

    }


    /* =====================================================
       DOCUMENT PROTECTION
    ===================================================== */

    document.removeEventListener(
        "dragover",
        preventDocumentDragOver
    );


    document.removeEventListener(
        "drop",
        preventDocumentDrop
    );


    document.addEventListener(
        "dragover",
        preventDocumentDragOver
    );


    document.addEventListener(
        "drop",
        preventDocumentDrop
    );


    console.info(
        "[GEN-Z.AI] Metadata events bound."
    );

}


/* =========================================================
   COMPATIBILITY ALIAS
========================================================= */

export function bindEvents(
    providedCallbacks = {}
) {

    bindMetadataEvents(
        providedCallbacks
    );

}


/* =========================================================
   UNBIND
========================================================= */

export function unbindEvents() {

    const {
        fileInput,
        dropzone,
        checkButton,
        cleanButton,
        downloadButton,
        resetButton,
        changeButton
    } =
        elements || {};


    if (
        fileInput
    ) {

        fileInput.removeEventListener(
            "change",
            handleFileInput
        );

    }


    if (
        dropzone
    ) {

        dropzone.removeEventListener(
            "click",
            handleDropzoneClick
        );


        dropzone.removeEventListener(
            "keydown",
            handleDropzoneKeydown
        );


        dropzone.removeEventListener(
            "dragenter",
            handleDragEnter
        );


        dropzone.removeEventListener(
            "dragover",
            handleDragOver
        );


        dropzone.removeEventListener(
            "dragleave",
            handleDragLeave
        );


        dropzone.removeEventListener(
            "drop",
            handleDrop
        );

    }


    if (
        checkButton
    ) {

        checkButton.removeEventListener(
            "click",
            handleCheckClick
        );

    }


    if (
        cleanButton
    ) {

        cleanButton.removeEventListener(
            "click",
            handleCleanClick
        );

    }


    if (
        downloadButton
    ) {

        downloadButton.removeEventListener(
            "click",
            handleDownloadClick
        );

    }


    if (
        resetButton
    ) {

        resetButton.removeEventListener(
            "click",
            handleResetClick
        );

    }


    if (
        changeButton
    ) {

        changeButton.removeEventListener(
            "click",
            handleChangeClick
        );

    }


    document.removeEventListener(
        "dragover",
        preventDocumentDragOver
    );


    document.removeEventListener(
        "drop",
        preventDocumentDrop
    );


    callbacks = {};

}


/* =========================================================
   PUBLIC API
========================================================= */

export default {

    bindMetadataEvents,
    bindEvents,
    unbindEvents,
    openFilePicker

};
