/* =========================================================
   GEN-Z.AI
   AI METADATA CLEANER
   ---------------------------------------------------------
   File:
   metadata-cleaner/assets/js/metadata-events.js

   Tanggung jawab:
   - Bind seluruh event Metadata Cleaner
   - Native file input
   - Drag & Drop
   - File selection
   - Check metadata
   - Clean metadata
   - Reset
   - Tidak membuka file picker secara manual dari dropzone

   IMPORTANT:
   Native file input sekarang menutupi seluruh
   area #metadata-dropzone melalui CSS.

   Karena itu:
   - Jangan memanggil fileInput.click()
     dari event click dropzone.
   - Browser native input menangani klik.
   - Event "change" menangani file terpilih.
========================================================= */


/* =========================================================
   IMPORT
========================================================= */

import {
    elements
} from "./metadata-dom.js";


/* =========================================================
   OPTIONAL APP FUNCTIONS
   ---------------------------------------------------------
   Fungsi callback diambil dari window agar modul events
   tidak membuat circular dependency dengan metadata-app.js.
========================================================= */

function getAppFunction(name) {

    const fn =
        window?.GENZ_METADATA_APP?.[name];

    return typeof fn === "function"
        ? fn
        : null;
}


/* =========================================================
   OPEN FILE PICKER
   ---------------------------------------------------------
   Dipertahankan sebagai helper kompatibilitas.

   IMPORTANT:
   Fungsi ini TIDAK dipanggil oleh event click dropzone.
   Native input sekarang menerima klik secara langsung.
========================================================= */

export function openFilePicker() {

    const input =
        elements?.fileInput;

    if (!input) {
        return;
    }

    input.click();
}


/* =========================================================
   FILE INPUT CHANGE
========================================================= */

async function handleFileInput(event) {

    const input =
        event?.currentTarget ||
        elements?.fileInput;

    if (!input) {
        return;
    }

    const files =
        Array.from(
            input.files || []
        );

    if (
        files.length === 0
    ) {
        return;
    }

    const handleFiles =
        getAppFunction(
            "handleFiles"
        );

    if (handleFiles) {

        await handleFiles(
            files
        );

        return;
    }


    /* =====================================================
       COMPATIBILITY FALLBACK
    ===================================================== */

    const handleFile =
        getAppFunction(
            "handleFile"
        );

    if (handleFile) {

        await handleFile(
            files[0]
        );
    }
}


/* =========================================================
   DRAG ENTER
========================================================= */

function handleDragEnter(event) {

    event.preventDefault();
    event.stopPropagation();

    elements?.dropzone
        ?.classList
        ?.add("dragover");
}


/* =========================================================
   DRAG OVER
========================================================= */

function handleDragOver(event) {

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
        ?.add("dragover");
}


/* =========================================================
   DRAG LEAVE
========================================================= */

function handleDragLeave(event) {

    event.preventDefault();
    event.stopPropagation();

    const dropzone =
        elements?.dropzone;

    if (!dropzone) {
        return;
    }


    /*
       Jika pointer masih berada di dalam
       child element, jangan menghapus state.
    */

    if (
        event.relatedTarget &&
        dropzone.contains(
            event.relatedTarget
        )
    ) {
        return;
    }

    dropzone
        .classList
        .remove("dragover");
}


/* =========================================================
   DROP
========================================================= */

async function handleDrop(event) {

    event.preventDefault();
    event.stopPropagation();

    const dropzone =
        elements?.dropzone;

    dropzone
        ?.classList
        ?.remove("dragover");

    const files =
        Array.from(
            event?.dataTransfer?.files || []
        );

    if (
        files.length === 0
    ) {
        return;
    }


    const handleFiles =
        getAppFunction(
            "handleFiles"
        );

    if (handleFiles) {

        await handleFiles(
            files
        );

        return;
    }


    /* =====================================================
       COMPATIBILITY FALLBACK
    ===================================================== */

    const handleFile =
        getAppFunction(
            "handleFile"
        );

    if (handleFile) {

        await handleFile(
            files[0]
        );
    }
}


/* =========================================================
   DROPZONE CLICK
   ---------------------------------------------------------
   IMPORTANT:

   JANGAN melakukan:

       openFilePicker();

   di sini.

   Native input sekarang berada di atas dropzone
   dan menerima klik secara langsung.

   Event click hanya dicegah agar tidak terjadi
   double-trigger pada browser tertentu.
========================================================= */

function handleDropzoneClick(event) {

    /*
       Jika target adalah native input,
       biarkan browser menjalankan native picker.

       Jika target adalah elemen visual di bawah input,
       input seharusnya sudah menerima pointer karena
       z-index native input lebih tinggi.
    */

    if (
        event?.target ===
        elements?.fileInput
    ) {
        return;
    }

    /*
       Jangan memanggil:
           elements.fileInput.click()

       dan jangan memanggil:
           openFilePicker()

       dari sini.
    */

    return;
}


/* =========================================================
   DROPZONE KEYBOARD
   ---------------------------------------------------------
   Accessibility fallback.

   Enter / Space tetap bisa membuka picker ketika
   dropzone mendapatkan keyboard focus.

   Mouse click tetap ditangani native input.
========================================================= */

function handleDropzoneKeydown(event) {

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
   CHECK METADATA
========================================================= */

async function handleCheckClick(event) {

    event?.preventDefault();

    const fn =
        getAppFunction(
            "checkMetadata"
        );

    if (!fn) {
        return;
    }

    await fn();
}


/* =========================================================
   CLEAN METADATA
========================================================= */

async function handleCleanClick(event) {

    event?.preventDefault();

    const fn =
        getAppFunction(
            "cleanMetadata"
        );

    if (!fn) {
        return;
    }

    await fn();
}


/* =========================================================
   RESET
========================================================= */

function handleResetClick(event) {

    event?.preventDefault();

    const fn =
        getAppFunction(
            "reset"
        );

    if (!fn) {
        return;
    }

    fn();
}


/* =========================================================
   PREVENT DEFAULT DOCUMENT DROP
   ---------------------------------------------------------
   Mencegah browser membuka file langsung ketika file
   dilepas di luar dropzone.
========================================================= */

function preventDocumentDrop(event) {

    event.preventDefault();
}


/* =========================================================
   BIND EVENTS
========================================================= */

export function bindEvents() {

    const {
        fileInput,
        dropzone,
        checkButton,
        cleanButton,
        resetButton
    } =
        elements || {};


    /* =====================================================
       FILE INPUT
    ===================================================== */

    if (fileInput) {

        fileInput.addEventListener(
            "change",
            handleFileInput
        );
    }


    /* =====================================================
       DROPZONE MOUSE CLICK
       -----------------------------------------------------
       Tidak membuka picker secara manual.
    ===================================================== */

    if (dropzone) {

        dropzone.addEventListener(
            "click",
            handleDropzoneClick
        );


        /* =================================================
           KEYBOARD ACCESSIBILITY
        ================================================= */

        dropzone.addEventListener(
            "keydown",
            handleDropzoneKeydown
        );


        /* =================================================
           DRAG & DROP
        ================================================= */

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
       CHECK BUTTON
    ===================================================== */

    if (checkButton) {

        checkButton.addEventListener(
            "click",
            handleCheckClick
        );
    }


    /* =====================================================
       CLEAN BUTTON
    ===================================================== */

    if (cleanButton) {

        cleanButton.addEventListener(
            "click",
            handleCleanClick
        );
    }


    /* =====================================================
       RESET BUTTON
    ===================================================== */

    if (resetButton) {

        resetButton.addEventListener(
            "click",
            handleResetClick
        );
    }


    /* =====================================================
       DOCUMENT DROP PROTECTION
    ===================================================== */

    document.addEventListener(
        "dragover",
        preventDocumentDrop
    );

    document.addEventListener(
        "drop",
        preventDocumentDrop
    );
}


/* =========================================================
   UNBIND EVENTS
   ---------------------------------------------------------
   Disediakan untuk kompatibilitas / lifecycle module.

   Karena listener di atas menggunakan function reference,
   listener dapat dilepas dengan aman.
========================================================= */

export function unbindEvents() {

    const {
        fileInput,
        dropzone,
        checkButton,
        cleanButton,
        resetButton
    } =
        elements || {};


    if (fileInput) {

        fileInput.removeEventListener(
            "change",
            handleFileInput
        );
    }


    if (dropzone) {

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


    if (checkButton) {

        checkButton.removeEventListener(
            "click",
            handleCheckClick
        );
    }


    if (cleanButton) {

        cleanButton.removeEventListener(
            "click",
            handleCleanClick
        );
    }


    if (resetButton) {

        resetButton.removeEventListener(
            "click",
            handleResetClick
        );
    }


    document.removeEventListener(
        "dragover",
        preventDocumentDrop
    );

    document.removeEventListener(
        "drop",
        preventDocumentDrop
    );
}


/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default {

    bindEvents,
    unbindEvents,
    openFilePicker
};
