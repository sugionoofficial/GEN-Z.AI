/* =========================================================
   GEN-Z.AI
   AI METADATA CLEANER
   ---------------------------------------------------------
   File:
   metadata-cleaner/assets/js/metadata-events.js

   Tanggung jawab:
   - Binding event UI
   - File input
   - File picker
   - Drag & Drop
   - CHECK
   - CLEAN
   - DOWNLOAD

   CATATAN:
   - Tidak membaca window state.
   - Tidak membaca input.files untuk menentukan
     apakah file aktif.
   - State file sepenuhnya dikelola metadata-state.js.
========================================================= */


/* =========================================================
   DOM
========================================================= */

import {
    elements
} from "./metadata-dom.js";


/* =========================================================
   CALLBACKS
========================================================= */

let currentCallbacks = {};


/* =========================================================
   CHECK BUTTON
========================================================= */

export function enableCheckButton() {

    const button =
        elements.checkButton;


    if (
        !button
    ) {

        console.error(
            "[GEN-Z.AI] CHECK button tidak ditemukan."
        );

        return;

    }


    button.disabled =
        false;


    button.removeAttribute(
        "aria-disabled"
    );


    console.info(
        "[GEN-Z.AI] CHECK button ENABLED."
    );

}


export function disableCheckButton() {

    const button =
        elements.checkButton;


    if (
        !button
    ) {

        return;

    }


    button.disabled =
        true;


    button.setAttribute(
        "aria-disabled",
        "true"
    );

}


/* =========================================================
   FILE INPUT
========================================================= */

async function onFileInput(
    event
) {

    console.info(
        "[GEN-Z.AI] FILE INPUT CHANGE."
    );


    const callback =
        currentCallbacks.handleFileInput;


    if (
        typeof callback !==
        "function"
    ) {

        console.error(
            "[GEN-Z.AI] handleFileInput callback tidak tersedia."
        );

        return;

    }


    try {

        await callback(
            event
        );

    } catch (
        error
    ) {

        console.error(
            "[GEN-Z.AI] File input error:",
            error
        );

    }

}


/* =========================================================
   FILE PICKER
========================================================= */

function onOpenFilePicker(
    event
) {

    event?.preventDefault?.();


    const callback =
        currentCallbacks.openFilePicker;


    if (
        typeof callback !==
        "function"
    ) {

        console.error(
            "[GEN-Z.AI] openFilePicker callback tidak tersedia."
        );

        return;

    }


    try {

        callback(
            event
        );

    } catch (
        error
    ) {

        console.error(
            "[GEN-Z.AI] openFilePicker error:",
            error
        );

    }

}


/* =========================================================
   CHANGE FILE
========================================================= */

function onChangeFile(
    event
) {

    event?.preventDefault?.();


    onOpenFilePicker(
        event
    );

}


/* =========================================================
   DRAG OVER
========================================================= */

function onDragOver(
    event
) {

    const callback =
        currentCallbacks.handleDragOver;


    if (
        typeof callback !==
        "function"
    ) {

        return;

    }


    try {

        callback(
            event
        );

    } catch (
        error
    ) {

        console.error(
            "[GEN-Z.AI] Drag over error:",
            error
        );

    }

}


/* =========================================================
   DRAG LEAVE
========================================================= */

function onDragLeave(
    event
) {

    const callback =
        currentCallbacks.handleDragLeave;


    if (
        typeof callback !==
        "function"
    ) {

        return;

    }


    try {

        callback(
            event
        );

    } catch (
        error
    ) {

        console.error(
            "[GEN-Z.AI] Drag leave error:",
            error
        );

    }

}


/* =========================================================
   DROP
========================================================= */

async function onDrop(
    event
) {

    console.info(
        "[GEN-Z.AI] DROP EVENT."
    );


    const callback =
        currentCallbacks.handleDrop;


    if (
        typeof callback !==
        "function"
    ) {

        console.error(
            "[GEN-Z.AI] handleDrop callback tidak tersedia."
        );

        return;

    }


    try {

        await callback(
            event
        );

    } catch (
        error
    ) {

        console.error(
            "[GEN-Z.AI] Drop error:",
            error
        );

    }

}


/* =========================================================
   CHECK
   ---------------------------------------------------------
   INI SATU-SATUNYA HANDLER CHECK.
========================================================= */

async function onCheck(
    event
) {

    event?.preventDefault?.();
    event?.stopPropagation?.();


    console.log(
        "[GEN-Z.AI] ============================="
    );

    console.log(
        "[GEN-Z.AI] CHECK BUTTON CLICKED"
    );

    console.log(
        "[GEN-Z.AI] ============================="
    );


    const button =
        elements.checkButton;


    if (
        !button
    ) {

        console.error(
            "[GEN-Z.AI] #metadata-check-button TIDAK ADA."
        );

        return;

    }


    const callback =
        currentCallbacks.checkMetadata;


    if (
        typeof callback !==
        "function"
    ) {

        console.error(
            "[GEN-Z.AI] checkMetadata callback TIDAK ADA.",
            currentCallbacks
        );

        return;

    }


    /*
     * Jangan melakukan validasi:
     *
     * input.files
     * window state
     * global state
     *
     * karena metadata-check.js sendiri sudah
     * memeriksa state.file.
     */


    console.log(
        "[GEN-Z.AI] Menjalankan checkMetadata()..."
    );


    button.disabled =
        true;


    button.setAttribute(
        "aria-busy",
        "true"
    );


    try {

        await callback();


        console.log(
            "[GEN-Z.AI] checkMetadata() selesai."
        );


    } catch (
        error
    ) {

        console.error(
            "[GEN-Z.AI] checkMetadata() ERROR:",
            error
        );

    } finally {

        button.removeAttribute(
            "aria-busy"
        );


        /*
         * checkMetadata() sendiri bertanggung jawab
         * mengembalikan tombol ke enabled state.
         *
         * Jangan mengubah disabled di sini.
         */

    }

}


/* =========================================================
   CLEAN
========================================================= */

async function onClean(
    event
) {

    event?.preventDefault?.();
    event?.stopPropagation?.();


    const button =
        elements.cleanButton;


    if (
        !button
    ) {

        console.error(
            "[GEN-Z.AI] CLEAN button tidak ditemukan."
        );

        return;

    }


    if (
        button.disabled
    ) {

        console.warn(
            "[GEN-Z.AI] CLEAN masih disabled."
        );

        return;

    }


    const callback =
        currentCallbacks.cleanMetadata;


    if (
        typeof callback !==
        "function"
    ) {

        console.error(
            "[GEN-Z.AI] cleanMetadata callback tidak tersedia."
        );

        return;

    }


    button.disabled =
        true;


    button.setAttribute(
        "aria-busy",
        "true"
    );


    try {

        await callback();

    } catch (
        error
    ) {

        console.error(
            "[GEN-Z.AI] cleanMetadata error:",
            error
        );

    } finally {

        button.removeAttribute(
            "aria-busy"
        );

    }

}


/* =========================================================
   DOWNLOAD
========================================================= */

function onDownload(
    event
) {

    event?.preventDefault?.();
    event?.stopPropagation?.();


    const button =
        elements.downloadButton;


    if (
        !button
    ) {

        return;

    }


    if (
        button.disabled
    ) {

        console.warn(
            "[GEN-Z.AI] DOWNLOAD masih disabled."
        );

        return;

    }


    const callback =
        currentCallbacks.downloadCleanedFile;


    if (
        typeof callback !==
        "function"
    ) {

        console.error(
            "[GEN-Z.AI] downloadCleanedFile callback tidak tersedia."
        );

        return;

    }


    try {

        callback();

    } catch (
        error
    ) {

        console.error(
            "[GEN-Z.AI] Download error:",
            error
        );

    }

}


/* =========================================================
   DROPZONE KEYBOARD
========================================================= */

function onDropzoneKeydown(
    event
) {

    if (
        !event
    ) {

        return;

    }


    if (
        event.key !== "Enter" &&
        event.key !== " "
    ) {

        return;

    }


    event.preventDefault();


    onOpenFilePicker(
        event
    );

}


/* =========================================================
   BIND EVENTS
========================================================= */

export function bindMetadataEvents(
    callbacks = {}
) {

    currentCallbacks =
        callbacks || {};


    console.log(
        "[GEN-Z.AI] Metadata events binding..."
    );


    console.log(
        "[GEN-Z.AI] callbacks:",
        Object.keys(
            currentCallbacks
        )
    );


    /* =====================================================
       FILE INPUT
    ===================================================== */

    if (
        elements.fileInput
    ) {

        elements.fileInput.addEventListener(
            "change",
            onFileInput
        );


        console.log(
            "[GEN-Z.AI] FILE INPUT listener OK."
        );

    } else {

        console.error(
            "[GEN-Z.AI] FILE INPUT tidak ditemukan."
        );

    }


    /* =====================================================
       DROPZONE
    ===================================================== */

    if (
        elements.dropzone
    ) {

        elements.dropzone.addEventListener(
            "click",
            onOpenFilePicker
        );


        elements.dropzone.addEventListener(
            "keydown",
            onDropzoneKeydown
        );


        elements.dropzone.addEventListener(
            "dragover",
            onDragOver
        );


        elements.dropzone.addEventListener(
            "dragleave",
            onDragLeave
        );


        elements.dropzone.addEventListener(
            "drop",
            onDrop
        );


        console.log(
            "[GEN-Z.AI] DROPZONE listeners OK."
        );

    } else {

        console.error(
            "[GEN-Z.AI] DROPZONE tidak ditemukan."
        );

    }


    /* =====================================================
       CHANGE BUTTON
    ===================================================== */

    if (
        elements.changeButton
    ) {

        elements.changeButton.addEventListener(
            "click",
            onChangeFile
        );

    }


    /* =====================================================
       CHECK BUTTON
    ===================================================== */

    if (
        elements.checkButton
    ) {

        /*
         * Pastikan kondisi awal disabled.
         *
         * metadata-file.js akan mengaktifkannya setelah
         * file berhasil diproses.
         */

        elements.checkButton.disabled =
            true;


        elements.checkButton.addEventListener(
            "click",
            onCheck
        );


        console.log(
            "[GEN-Z.AI] CHECK listener OK."
        );


    } else {

        console.error(
            "[GEN-Z.AI] CHECK BUTTON TIDAK DITEMUKAN."
        );

    }


    /* =====================================================
       CLEAN BUTTON
    ===================================================== */

    if (
        elements.cleanButton
    ) {

        elements.cleanButton.addEventListener(
            "click",
            onClean
        );

    }


    /* =====================================================
       DOWNLOAD BUTTON
    ===================================================== */

    if (
        elements.downloadButton
    ) {

        elements.downloadButton.addEventListener(
            "click",
            onDownload
        );

    }


    console.log(
        "[GEN-Z.AI] Metadata events READY."
    );

}


/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default {

    bindMetadataEvents,

    enableCheckButton,

    disableCheckButton

};
