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
   - Download cleaned file
   - Reset

   IMPORTANT:
   - metadata-app.js adalah coordinator.
   - Callback dikirim langsung melalui bindMetadataEvents().
   - Tidak menggunakan window.GENZ_METADATA_APP.
   - Tidak membuat circular dependency.
   - Native file input menangani klik pada area upload.
========================================================= */


/* =========================================================
   IMPORT
========================================================= */

import {
    elements
} from "./metadata-dom.js";


/* =========================================================
   CALLBACKS
   ---------------------------------------------------------
   Callback berasal langsung dari metadata-app.js.

   Contoh:

       bindMetadataEvents({
           handleFileInput,
           openFilePicker,
           checkMetadata,
           cleanMetadata,
           downloadCleanedFile,
           handleDragOver,
           handleDragLeave,
           handleDrop
       });

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

        return;
    }


    input.click();

}


/* =========================================================
   FILE INPUT CHANGE
   ---------------------------------------------------------
   File input diserahkan langsung ke coordinator.

   metadata-app.js:
       handleFileInput(event)

   akan:
       - membaca FileList
       - mengambil file pertama
       - memvalidasi media
       - reset state
       - membuat object URL
       - render preview
========================================================= */

function handleFileInput(
    event
) {

    const handler =
        callbacks?.handleFileInput;

    if (
        typeof handler !== "function"
    ) {

        console.error(
            "[GEN-Z.AI] metadata-events: handleFileInput callback tidak tersedia."
        );

        return;
    }


    handler(
        event
    );

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


    /*
       Jalankan callback coordinator
       jika tersedia.
    */

    const handler =
        callbacks?.handleDragOver;

    if (
        typeof handler === "function"
    ) {

        handler(
            event
        );

    } else {

        elements?.dropzone
            ?.classList
            ?.add(
                "dragover"
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
       Jangan menghapus status drag
       apabila pointer masih berada
       di dalam dropzone.
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
        .remove(
            "dragover"
        );


    /*
       Jalankan callback coordinator
       jika tersedia.
    */

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


    /*
       Serahkan event langsung ke
       coordinator.

       metadata-app.js akan mengambil:
           event.dataTransfer.files
       lalu memproses file melalui
           processSelectedFile().
    */

    const handler =
        callbacks?.handleDrop;

    if (
        typeof handler !== "function"
    ) {

        console.error(
            "[GEN-Z.AI] metadata-events: handleDrop callback tidak tersedia."
        );

        return;
    }


    handler(
        event
    );

}


/* =========================================================
   DROPZONE CLICK
   ---------------------------------------------------------
   Native file input sekarang menutupi
   seluruh area dropzone melalui CSS.

   Karena itu JANGAN memanggil:
       openFilePicker()

   dari event mouse click.

   Kalau dipanggil lagi, beberapa browser dapat
   membuka picker dua kali atau menghasilkan
   perilaku aneh.
========================================================= */

function handleDropzoneClick(
    event
) {

    /*
       Bila yang diklik adalah native input,
       biarkan browser menangani sendiri.
    */

    if (
        event?.target ===
        elements?.fileInput
    ) {

        return;
    }


    /*
       Tidak melakukan apa pun.

       Native input berada di atas area
       visual dropzone.
    */

}


/* =========================================================
   DROPZONE KEYBOARD
   ---------------------------------------------------------
   Untuk akses keyboard.

   Mouse:
       Native input.

   Keyboard:
       Enter / Space → file picker.
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


    const handler =
        callbacks?.openFilePicker;


    if (
        typeof handler === "function"
    ) {

        handler();

        return;
    }


    /*
       Fallback langsung ke input.
    */

    openFilePicker();

}


/* =========================================================
   CHECK BUTTON
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


    handler();

}


/* =========================================================
   CLEAN BUTTON
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


    handler();

}


/* =========================================================
   DOWNLOAD BUTTON
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


    handler();

}


/* =========================================================
   RESET BUTTON
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

        /*
           Reset bukan callback wajib
           pada metadata-app.js versi saat ini.

           Jangan error jika memang tidak
           diberikan oleh coordinator.
        */

        return;
    }


    handler();

}


/* =========================================================
   CHANGE BUTTON
   ---------------------------------------------------------
   Tombol "Ganti File" juga membuka
   native file picker.
========================================================= */

function handleChangeClick(
    event
) {

    event?.preventDefault();


    const handler =
        callbacks?.openFilePicker;


    if (
        typeof handler === "function"
    ) {

        handler();

        return;
    }


    openFilePicker();

}


/* =========================================================
   PREVENT DEFAULT DOCUMENT DROP
   ---------------------------------------------------------
   Mencegah browser membuka file secara langsung
   ketika file dilepas di luar dropzone.
========================================================= */

function preventDocumentDragOver(
    event
) {

    event.preventDefault();

}


function preventDocumentDrop(
    event
) {

    event.preventDefault();

}


/* =========================================================
   BIND METADATA EVENTS
   ---------------------------------------------------------
   Ini adalah nama export yang digunakan
   metadata-app.js:

       import {
           bindMetadataEvents
       } from "./metadata-events.js";

   Kemudian:

       bindMetadataEvents({...});
========================================================= */

export function bindMetadataEvents(
    providedCallbacks = {}
) {

    /*
       Simpan seluruh callback dari coordinator.
    */

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

        fileInput.addEventListener(
            "change",
            handleFileInput
        );

    }


    /* =====================================================
       DROPZONE
    ===================================================== */

    if (
        dropzone
    ) {

        /*
           Mouse click sengaja tidak membuka
           picker secara manual.
        */

        dropzone.addEventListener(
            "click",
            handleDropzoneClick
        );


        /*
           Keyboard accessibility.
        */

        dropzone.addEventListener(
            "keydown",
            handleDropzoneKeydown
        );


        /*
           Drag & Drop.
        */

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

        changeButton.addEventListener(
            "click",
            handleChangeClick
        );

    }


    /* =====================================================
       DOCUMENT DROP PROTECTION
    ===================================================== */

    document.addEventListener(
        "dragover",
        preventDocumentDragOver
    );


    document.addEventListener(
        "drop",
        preventDocumentDrop
    );

}


/* =========================================================
   COMPATIBILITY ALIAS
   ---------------------------------------------------------
   Beberapa bagian lama mungkin masih memanggil
   bindEvents().

   Alias ini dipertahankan agar tidak mematahkan
   kode lain.

   Untuk aplikasi utama gunakan:
       bindMetadataEvents(...)
========================================================= */

export function bindEvents(
    providedCallbacks = {}
) {

    bindMetadataEvents(
        providedCallbacks
    );

}


/* =========================================================
   UNBIND EVENTS
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


    /* =====================================================
       FILE INPUT
    ===================================================== */

    if (
        fileInput
    ) {

        fileInput.removeEventListener(
            "change",
            handleFileInput
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

    }


    /* =====================================================
       DOCUMENT
    ===================================================== */

    document.removeEventListener(
        "dragover",
        preventDocumentDragOver
    );


    document.removeEventListener(
        "drop",
        preventDocumentDrop
    );


    /*
       Bersihkan reference callback.
    */

    callbacks = {};

}


/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default {

    bindMetadataEvents,
    bindEvents,
    unbindEvents,
    openFilePicker

};
