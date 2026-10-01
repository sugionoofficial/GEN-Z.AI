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
   - Semua callback async ditangani dengan benar.
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


    console.info(
        "[GEN-Z.AI] metadata-events: callbacks registered.",
        Object.keys(
            callbacks
        )
    );

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

        return false;
    }


    try {

        input.click();

        return true;

    } catch (error) {

        console.error(
            "[GEN-Z.AI] metadata-events: gagal membuka file picker.",
            error
        );

        return false;

    }

}


/* =========================================================
   FILE INPUT CHANGE
   ---------------------------------------------------------
   LANGSUNG memproses file.

   event
      ↓
   processSelectedFile()
========================================================= */

async function handleFileInput(
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


    const file =
        files[0];


    try {

        console.info(
            "[GEN-Z.AI] metadata-events: memproses file:",
            file.name
        );


        await processSelectedFile(
            file
        );


        console.info(
            "[GEN-Z.AI] metadata-events: file berhasil diproses:",
            file.name
        );

    } catch (error) {

        console.error(
            "[GEN-Z.AI] metadata-events: processSelectedFile gagal:",
            error
        );

    } finally {

        /*
           Reset value setelah processor selesai.

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

}


/* =========================================================
   DRAG ENTER
========================================================= */

function handleDragEnter(
    event
) {

    event.preventDefault();
    event.stopPropagation();


    const dropzone =
        elements?.dropzone;


    if (
        dropzone
    ) {

        dropzone.classList.add(
            "dragover"
        );

        dropzone.classList.add(
            "is-dragging"
        );

    }

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


    const dropzone =
        elements?.dropzone;


    if (
        dropzone
    ) {

        dropzone.classList.add(
            "dragover"
        );

        dropzone.classList.add(
            "is-dragging"
        );

    }


    /*
       Callback drag-over tetap dipertahankan
       untuk kompatibilitas dengan coordinator.
    */

    const handler =
        callbacks?.handleDragOver;


    if (
        typeof handler === "function"
    ) {

        try {

            handler(
                event
            );

        } catch (error) {

            console.error(
                "[GEN-Z.AI] metadata-events: handleDragOver callback gagal:",
                error
            );

        }

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
       jika pointer masih berada di dalam dropzone.
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

        try {

            handler(
                event
            );

        } catch (error) {

            console.error(
                "[GEN-Z.AI] metadata-events: handleDragLeave callback gagal:",
                error
            );

        }

    }

}


/* =========================================================
   DROP
   ---------------------------------------------------------
   LANGSUNG memproses file.

   Tidak bergantung pada callback coordinator
   untuk upload.
========================================================= */

async function handleDrop(
    event
) {

    event.preventDefault();
    event.stopPropagation();


    const dropzone =
        elements?.dropzone;


    if (
        dropzone
    ) {

        dropzone.classList.remove(
            "dragover"
        );

        dropzone.classList.remove(
            "is-dragging"
        );

    }


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


    const file =
        files[0];


    try {

        console.info(
            "[GEN-Z.AI] metadata-events: memproses dropped file:",
            file.name
        );


        await processSelectedFile(
            file
        );


        console.info(
            "[GEN-Z.AI] metadata-events: dropped file berhasil diproses:",
            file.name
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

   Jangan memanggil input.click() dari click
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
   ---------------------------------------------------------
   Jalur:

       click
         ↓
       handleCheckClick
         ↓
       callbacks.checkMetadata
         ↓
       metadata-check.js
========================================================= */

async function handleCheckClick(
    event
) {

    event?.preventDefault();
    event?.stopPropagation();


    console.info(
        "[GEN-Z.AI] CHECK button clicked."
    );


    const button =
        elements?.checkButton;


    if (
        !button
    ) {

        console.error(
            "[GEN-Z.AI] metadata-events: #metadata-check-button tidak ditemukan."
        );

        return;
    }


    const handler =
        callbacks?.checkMetadata;


    if (
        typeof handler !== "function"
    ) {

        console.error(
            "[GEN-Z.AI] metadata-events: checkMetadata callback tidak tersedia."
        );

        console.error(
            "[GEN-Z.AI] metadata-events: callbacks tersedia:",
            Object.keys(
                callbacks || {}
            )
        );

        return;
    }


    try {

        /*
           Pastikan browser tidak menganggap
           klik CHECK sebagai submit form.
        */

        button.setAttribute(
            "data-processing",
            "true"
        );


        console.info(
            "[GEN-Z.AI] CHECK → checkMetadata()"
        );


        await handler(
            event
        );


        console.info(
            "[GEN-Z.AI] CHECK → checkMetadata() selesai."
        );

    } catch (error) {

        console.error(
            "[GEN-Z.AI] metadata-events: checkMetadata gagal:",
            error
        );

    } finally {

        button.removeAttribute(
            "data-processing"
        );

    }

}


/* =========================================================
   CLEAN
========================================================= */

async function handleCleanClick(
    event
) {

    event?.preventDefault();
    event?.stopPropagation();


    console.info(
        "[GEN-Z.AI] CLEAN button clicked."
    );


    const button =
        elements?.cleanButton;


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

        if (
            button
        ) {

            button.setAttribute(
                "data-processing",
                "true"
            );

        }


        console.info(
            "[GEN-Z.AI] CLEAN → cleanMetadata()"
        );


        await handler(
            event
        );


        console.info(
            "[GEN-Z.AI] CLEAN → cleanMetadata() selesai."
        );

    } catch (error) {

        console.error(
            "[GEN-Z.AI] metadata-events: cleanMetadata gagal:",
            error
        );

    } finally {

        if (
            button
        ) {

            button.removeAttribute(
                "data-processing"
            );

        }

    }

}


/* =========================================================
   DOWNLOAD
========================================================= */

async function handleDownloadClick(
    event
) {

    event?.preventDefault();
    event?.stopPropagation();


    console.info(
        "[GEN-Z.AI] DOWNLOAD button clicked."
    );


    const button =
        elements?.downloadButton;


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

        if (
            button
        ) {

            button.setAttribute(
                "data-processing",
                "true"
            );

        }


        await handler(
            event
        );


        console.info(
            "[GEN-Z.AI] DOWNLOAD selesai."
        );

    } catch (error) {

        console.error(
            "[GEN-Z.AI] metadata-events: download gagal:",
            error
        );

    } finally {

        if (
            button
        ) {

            button.removeAttribute(
                "data-processing"
            );

        }

    }

}


/* =========================================================
   RESET
========================================================= */

async function handleResetClick(
    event
) {

    event?.preventDefault();
    event?.stopPropagation();


    console.info(
        "[GEN-Z.AI] RESET button clicked."
    );


    const handler =
        callbacks?.reset;


    if (
        typeof handler !== "function"
    ) {

        console.warn(
            "[GEN-Z.AI] metadata-events: reset callback tidak tersedia."
        );

        return;
    }


    try {

        await handler(
            event
        );

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
    event?.stopPropagation();


    console.info(
        "[GEN-Z.AI] CHANGE FILE clicked."
    );


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

        fileInput.removeEventListener(
            "change",
            handleFileInput
        );


        fileInput.addEventListener(
            "change",
            handleFileInput
        );


        console.info(
            "[GEN-Z.AI] metadata-events: file input bound."
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


        console.info(
            "[GEN-Z.AI] metadata-events: dropzone bound."
        );

    } else {

        console.warn(
            "[GEN-Z.AI] metadata-events: dropzone tidak ditemukan."
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


        console.info(
            "[GEN-Z.AI] metadata-events: CHECK bound.",
            {
                id: checkButton.id,
                disabled: checkButton.disabled
            }
        );

    } else {

        console.error(
            "[GEN-Z.AI] metadata-events: #metadata-check-button TIDAK DITEMUKAN."
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


        console.info(
            "[GEN-Z.AI] metadata-events: CLEAN bound."
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


        console.info(
            "[GEN-Z.AI] metadata-events: DOWNLOAD bound."
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


        console.info(
            "[GEN-Z.AI] metadata-events: RESET bound."
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


        console.info(
            "[GEN-Z.AI] metadata-events: CHANGE FILE bound."
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


    /* =====================================================
       CLEAR CALLBACKS
    ===================================================== */

    callbacks = {};


    console.info(
        "[GEN-Z.AI] Metadata events unbound."
    );

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
