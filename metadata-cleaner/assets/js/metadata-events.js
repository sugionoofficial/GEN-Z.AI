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

   CHECK BUTTON FIX:
   - CHECK tidak dikunci menggunakan disabled saat idle.
   - Status kesiapan menggunakan aria-disabled.
   - disabled hanya digunakan ketika CHECK sedang diproses.
   - Mencegah tombol terlihat aktif tetapi native browser
     menolak click event.
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


    if (!button) {

        console.error(
            "[GEN-Z.AI] CHECK button tidak ditemukan."
        );

        return;
    }


    /*
       CHECK idle harus tetap clickable.
       Jangan menggunakan disabled di sini.
    */

    button.disabled =
        false;


    button.setAttribute(
        "aria-disabled",
        "false"
    );


    button.removeAttribute(
        "aria-busy"
    );


    console.info(
        "[GEN-Z.AI] CHECK button ENABLED."
    );

}


export function disableCheckButton() {

    const button =
        elements.checkButton;


    if (!button) {
        return;
    }


    /*
       Idle disabled hanya menggunakan aria-disabled.
       Native disabled sengaja tidak digunakan.
    */

    button.disabled =
        false;


    button.setAttribute(
        "aria-disabled",
        "true"
    );


    button.removeAttribute(
        "aria-busy"
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


    if (!button) {

        console.error(
            "[GEN-Z.AI] #metadata-check-button TIDAK ADA."
        );

        return;
    }


    /*
       Jika CHECK sedang busy, abaikan klik kedua.
    */

    if (
        button.getAttribute(
            "aria-busy"
        ) === "true"
    ) {

        console.warn(
            "[GEN-Z.AI] CHECK masih berjalan."
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
       Periksa status readiness tanpa menggunakan
       native disabled.
    */

    const ariaDisabled =
        button.getAttribute(
            "aria-disabled"
        );


    if (
        ariaDisabled === "true"
    ) {

        console.warn(
            "[GEN-Z.AI] CHECK belum siap."
        );

        return;
    }


    console.log(
        "[GEN-Z.AI] Menjalankan checkMetadata()..."
    );


    /*
       Sekarang native disabled digunakan hanya selama
       proses async berlangsung.
    */

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

        button.disabled =
            false;


        button.removeAttribute(
            "aria-busy"
        );


        /*
           Jika callback gagal dan tidak ada file,
           kembali ke idle disabled secara visual,
           tetapi tombol tetap secara teknis clickable.
        */

        if (
            !currentCallbacks ||
            typeof currentCallbacks.checkMetadata !==
                "function"
        ) {

            button.setAttribute(
                "aria-disabled",
                "true"
            );

        }

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


    if (!button) {

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


    if (!button) {
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

    if (!event) {
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
           Jangan membuat CHECK native-disabled saat binding.
           Gunakan aria-disabled.
        */

        elements.checkButton.disabled =
            false;


        elements.checkButton.setAttribute(
            "aria-disabled",
            "true"
        );


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


/* =========================================================
   DEPLOYMENT TRIGGER
========================================================= */

// GEN-Z.AI DEPLOY TRIGGER: 2026-10-01-CHECK-FIX
