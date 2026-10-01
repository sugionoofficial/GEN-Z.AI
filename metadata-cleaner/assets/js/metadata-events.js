/* =========================================================
   GEN-Z.AI
   AI METADATA CLEANER
   ---------------------------------------------------------
   File:
   metadata-cleaner/assets/js/metadata-events.js

   Tanggung jawab:
   - Binding seluruh event UI Metadata Cleaner
   - File input
   - File picker
   - Drag & Drop
   - CHECK
   - CLEAN
   - DOWNLOAD
   - Keyboard dropzone

   Catatan:
   - File aktif ditentukan dari state, bukan dari
     input.files karena metadata-file.js mereset
     input.value setelah file diproses.
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
   EVENT HANDLERS
========================================================= */


/* =========================================================
   ENABLE CHECK
========================================================= */

export function enableCheckButton() {

    const button =
        elements?.checkButton;


    if (
        !button
    ) {

        console.warn(
            "[GEN-Z.AI] CHECK button tidak ditemukan."
        );

        return false;
    }


    button.disabled =
        false;


    button.removeAttribute(
        "aria-disabled"
    );


    button.setAttribute(
        "aria-busy",
        "false"
    );


    button.classList.remove(
        "is-disabled"
    );


    console.info(
        "[GEN-Z.AI] CHECK button ENABLED."
    );


    return true;

}


/* =========================================================
   DISABLE CHECK
========================================================= */

export function disableCheckButton() {

    const button =
        elements?.checkButton;


    if (
        !button
    ) {

        return false;
    }


    button.disabled =
        true;


    button.setAttribute(
        "aria-disabled",
        "true"
    );


    button.setAttribute(
        "aria-busy",
        "false"
    );


    return true;

}


/* =========================================================
   FILE INPUT
========================================================= */

async function handleFileInput(
    event
) {

    console.info(
        "[GEN-Z.AI] metadata-events: FILE INPUT EVENT."
    );


    const callback =
        currentCallbacks?.handleFileInput;


    if (
        typeof callback !==
        "function"
    ) {

        console.error(
            "[GEN-Z.AI] handleFileInput callback tidak tersedia.",
            currentCallbacks
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
            "[GEN-Z.AI] handleFileInput error:",
            error
        );

    }


    /*
     * Jangan memeriksa input.files di sini.
     *
     * metadata-file.js sengaja melakukan:
     *
     * input.value = "";
     *
     * sehingga input.files dapat menjadi kosong
     * walaupun state.file masih valid.
     *
     * Cukup baca state aplikasi.
     */

    const activeFile =
        window?.GENZMetadataCleaner?.state?.file ||
        null;


    if (
        activeFile
    ) {

        enableCheckButton();

    }

}


/* =========================================================
   OPEN FILE PICKER
========================================================= */

function handleOpenFilePicker(
    event
) {

    event?.preventDefault?.();


    const callback =
        currentCallbacks?.openFilePicker;


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
   CHANGE FILE BUTTON
========================================================= */

function handleChangeFile(
    event
) {

    event?.preventDefault?.();


    handleOpenFilePicker(
        event
    );

}


/* =========================================================
   DRAG OVER
========================================================= */

function handleDragOver(
    event
) {

    const callback =
        currentCallbacks?.handleDragOver;


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
            "[GEN-Z.AI] handleDragOver error:",
            error
        );

    }

}


/* =========================================================
   DRAG LEAVE
========================================================= */

function handleDragLeave(
    event
) {

    const callback =
        currentCallbacks?.handleDragLeave;


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
            "[GEN-Z.AI] handleDragLeave error:",
            error
        );

    }

}


/* =========================================================
   DROP
========================================================= */

async function handleDrop(
    event
) {

    console.info(
        "[GEN-Z.AI] metadata-events: DROP EVENT."
    );


    const callback =
        currentCallbacks?.handleDrop;


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
            "[GEN-Z.AI] handleDrop error:",
            error
        );

    }


    /*
     * Untuk DROP, state.file adalah sumber kebenaran.
     */

    const activeFile =
        window?.GENZMetadataCleaner?.state?.file ||
        null;


    if (
        activeFile
    ) {

        enableCheckButton();

    }

}


/* =========================================================
   CHECK CLICK
========================================================= */

async function handleCheckClick(
    event
) {

    event?.preventDefault?.();
    event?.stopPropagation?.();


    console.info(
        "[GEN-Z.AI] CHECK CLICK."
    );


    const button =
        elements?.checkButton;


    if (
        !button
    ) {

        console.error(
            "[GEN-Z.AI] #metadata-check-button tidak ditemukan."
        );

        return;

    }


    /*
     * Jangan menggunakan input.files sebagai
     * validasi file aktif.
     *
     * metadata-file.js mereset input.value.
     */


    const callback =
        currentCallbacks?.checkMetadata;


    if (
        typeof callback !==
        "function"
    ) {

        console.error(
            "[GEN-Z.AI] checkMetadata callback tidak tersedia.",
            currentCallbacks
        );

        return;

    }


    /*
     * Tombol disabled tidak boleh diproses.
     *
     * Tetapi status disabled diperiksa SETELAH
     * memastikan callback tersedia.
     */

    if (
        button.disabled
    ) {

        console.warn(
            "[GEN-Z.AI] CHECK CLICK diabaikan karena button disabled."
        );

        return;

    }


    /*
     * Kunci tombol selama pemeriksaan.
     */

    button.disabled =
        true;


    button.setAttribute(
        "aria-busy",
        "true"
    );


    button.setAttribute(
        "aria-disabled",
        "true"
    );


    try {

        await callback();


        console.info(
            "[GEN-Z.AI] CHECK metadata selesai."
        );


    } catch (
        error
    ) {

        console.error(
            "[GEN-Z.AI] CHECK metadata error:",
            error
        );


    } finally {

        /*
         * metadata-check.js sendiri juga mengatur
         * tombol pada finally.
         *
         * Di sini kita tidak memaksa enabled.
         * Biarkan module CHECK menjadi sumber
         * kebenaran status tombol.
         */

        button.removeAttribute(
            "aria-busy"
        );

        button.removeAttribute(
            "aria-disabled"
        );

    }

}


/* =========================================================
   CLEAN CLICK
========================================================= */

async function handleCleanClick(
    event
) {

    event?.preventDefault?.();
    event?.stopPropagation?.();


    const button =
        elements?.cleanButton;


    if (
        !button
    ) {

        return;

    }


    if (
        button.disabled
    ) {

        console.warn(
            "[GEN-Z.AI] CLEAN CLICK diabaikan karena button disabled."
        );

        return;

    }


    const callback =
        currentCallbacks?.cleanMetadata;


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
            "[GEN-Z.AI] CLEAN error:",
            error
        );

    } finally {

        button.removeAttribute(
            "aria-busy"
        );

    }

}


/* =========================================================
   DOWNLOAD CLICK
========================================================= */

function handleDownloadClick(
    event
) {

    event?.preventDefault?.();
    event?.stopPropagation?.();


    const button =
        elements?.downloadButton;


    if (
        !button
    ) {

        return;

    }


    if (
        button.disabled
    ) {

        return;

    }


    const callback =
        currentCallbacks?.downloadCleanedFile;


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

        callback(
            event
        );

    } catch (
        error
    ) {

        console.error(
            "[GEN-Z.AI] DOWNLOAD error:",
            error
        );

    }

}


/* =========================================================
   DROPZONE KEYBOARD
========================================================= */

function handleDropzoneKeydown(
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


    handleOpenFilePicker(
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


    console.info(
        "[GEN-Z.AI] Binding Metadata Cleaner events.",
        Object.keys(
            currentCallbacks
        )
    );


    /*
     * -----------------------------------------------------
     * FILE INPUT
     * -----------------------------------------------------
     */

    if (
        elements?.fileInput
    ) {

        elements.fileInput.addEventListener(
            "change",
            handleFileInput
        );

    } else {

        console.error(
            "[GEN-Z.AI] File input tidak ditemukan."
        );

    }


    /*
     * -----------------------------------------------------
     * DROPZONE CLICK
     * -----------------------------------------------------
     */

    if (
        elements?.dropzone
    ) {

        elements.dropzone.addEventListener(
            "click",
            handleOpenFilePicker
        );


        elements.dropzone.addEventListener(
            "keydown",
            handleDropzoneKeydown
        );


        elements.dropzone.addEventListener(
            "dragover",
            handleDragOver
        );


        elements.dropzone.addEventListener(
            "dragleave",
            handleDragLeave
        );


        elements.dropzone.addEventListener(
            "drop",
            handleDrop
        );

    } else {

        console.error(
            "[GEN-Z.AI] Dropzone tidak ditemukan."
        );

    }


    /*
     * -----------------------------------------------------
     * CHANGE BUTTON
     * -----------------------------------------------------
     */

    if (
        elements?.changeButton
    ) {

        elements.changeButton.addEventListener(
            "click",
            handleChangeFile
        );

    }


    /*
     * -----------------------------------------------------
     * CHECK BUTTON
     * -----------------------------------------------------
     */

    if (
        elements?.checkButton
    ) {

        /*
         * Pastikan listener lama tidak menumpuk
         * jika module diinisialisasi ulang.
         */

        elements.checkButton.removeEventListener(
            "click",
            handleCheckClick
        );


        elements.checkButton.addEventListener(
            "click",
            handleCheckClick
        );


        /*
         * Keyboard accessibility.
         *
         * Browser normalnya sudah meneruskan Enter/Space
         * ke click event button, jadi tidak perlu listener
         * keyboard tambahan yang berpotensi double-trigger.
         */

        console.info(
            "[GEN-Z.AI] CHECK listener terpasang."
        );

    } else {

        console.error(
            "[GEN-Z.AI] CHECK button tidak ditemukan saat binding."
        );

    }


    /*
     * -----------------------------------------------------
     * CLEAN BUTTON
     * -----------------------------------------------------
     */

    if (
        elements?.cleanButton
    ) {

        elements.cleanButton.addEventListener(
            "click",
            handleCleanClick
        );

    }


    /*
     * -----------------------------------------------------
     * DOWNLOAD BUTTON
     * -----------------------------------------------------
     */

    if (
        elements?.downloadButton
    ) {

        elements.downloadButton.addEventListener(
            "click",
            handleDownloadClick
        );

    }


    /*
     * -----------------------------------------------------
     * INITIAL CHECK STATE
     * -----------------------------------------------------
     */

    disableCheckButton();


    console.info(
        "[GEN-Z.AI] Metadata Cleaner events READY."
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
