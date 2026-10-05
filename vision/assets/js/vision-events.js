/* =========================================================
   GEN-Z.AI
   VISION EVENTS MODULE
   ---------------------------------------------------------
   File:
   vision/assets/js/vision-events.js

   Fungsi:
   - Event Reference Image
   - Event Replacement Character
   - Drag & Drop
   - Browse / File Input
   - Remove Reference Image
   - Remove Replacement Character
   - Sinkronisasi form ke state
   - Inisialisasi event
   - Tidak mengubah API / Analysis / Prompt
========================================================= */

import { getState } from "./vision-state.js";
import { getDOM } from "./vision-dom.js";
import { getUpload } from "./vision-upload.js";
import { getPreview } from "./vision-preview.js";
import { getUI } from "./vision-ui.js";


/* =========================================================
   ERROR NORMALIZER
========================================================= */

function normalizeError(error) {

    if (!error) {
        return "Terjadi kesalahan.";
    }

    if (
        typeof error === "string" &&
        error.trim()
    ) {
        return error.trim();
    }

    if (
        typeof error.message === "string" &&
        error.message.trim()
    ) {
        return error.message.trim();
    }

    return "Terjadi kesalahan saat memproses gambar.";

}


/* =========================================================
   REFERENCE IMAGE
========================================================= */

async function handleNewImage(file) {

    if (!file) {
        return null;
    }

    const ui = getUI();

    try {

        ui.setProcessing(false);

        ui.resetResult();

        const fileData =
            await getUpload().processFile(file);

        getPreview().renderPreview(
            fileData
        );

        ui.setStatus(
            "ready",
            "Image siap dianalisis."
        );

        return fileData;

    } catch (error) {

        const message =
            normalizeError(error);

        getState().setProcessError(
            message
        );

        ui.setStatus(
            "error",
            message
        );

        return null;
    }

}


/* =========================================================
   REPLACEMENT CHARACTER
========================================================= */

async function handleNewReplacementCharacter(file) {

    if (!file) {
        return null;
    }

    const ui = getUI();

    try {

        const fileData =
            await getUpload()
                .processReplacementCharacter(
                    file
                );

        getPreview()
            .renderCharacterPreview(
                fileData
            );

        /*
         * Jangan reset hasil analysis/prompt di sini.
         *
         * Reference Image tetap merupakan sumber
         * analisis utama. Character image adalah input
         * tambahan untuk proses replacement.
         */

        ui.setStatus(
            "ready",
            "Replacement character siap digunakan."
        );

        return fileData;

    } catch (error) {

        const message =
            normalizeError(error);

        getState().setProcessError(
            message
        );

        ui.setStatus(
            "error",
            message
        );

        return null;
    }

}


/* =========================================================
   REFERENCE FILE INPUT
========================================================= */

async function handleFileInput(event) {

    const input = event?.target;

    const files =
        Array.from(
            input?.files || []
        );

    if (files.length === 0) {
        return;
    }

    await handleNewImage(
        files[0]
    );

}


/* =========================================================
   REPLACEMENT CHARACTER FILE INPUT
========================================================= */

async function handleReplacementCharacterInput(event) {

    const input = event?.target;

    const files =
        Array.from(
            input?.files || []
        );

    if (files.length === 0) {
        return;
    }

    await handleNewReplacementCharacter(
        files[0]
    );

}


/* =========================================================
   REFERENCE DROP
========================================================= */

async function handleDrop(event) {

    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    const files =
        Array.from(
            event?.dataTransfer?.files || []
        );

    if (files.length === 0) {
        return;
    }

    await handleNewImage(
        files[0]
    );

}


/* =========================================================
   REPLACEMENT CHARACTER DROP
========================================================= */

async function handleReplacementCharacterDrop(event) {

    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    const files =
        Array.from(
            event?.dataTransfer?.files || []
        );

    if (files.length === 0) {
        return;
    }

    await handleNewReplacementCharacter(
        files[0]
    );

}


/* =========================================================
   DRAG OVER
========================================================= */

function handleDragOver(event) {

    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    const dropzone =
        event?.currentTarget;

    if (dropzone) {

        dropzone.classList.add(
            "is-dragover"
        );
    }

}


/* =========================================================
   DRAG LEAVE
========================================================= */

function handleDragLeave(event) {

    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    const dropzone =
        event?.currentTarget;

    if (dropzone) {

        dropzone.classList.remove(
            "is-dragover"
        );
    }

}


/* =========================================================
   DROP WRAPPER
========================================================= */

async function handleReferenceDrop(event) {

    const dropzone =
        event?.currentTarget;

    if (dropzone) {

        dropzone.classList.remove(
            "is-dragover"
        );
    }

    await handleDrop(
        event
    );

}


async function handleCharacterDrop(event) {

    const dropzone =
        event?.currentTarget;

    if (dropzone) {

        dropzone.classList.remove(
            "is-dragover"
        );
    }

    await handleReplacementCharacterDrop(
        event
    );

}


/* =========================================================
   REMOVE REFERENCE IMAGE
========================================================= */

function removeFile() {

    try {

        getUpload().removeFile();

    } catch (error) {

        /*
         * Fallback agar state tetap bersih apabila
         * implementasi upload berubah.
         */

        getState().clearFile();
    }

    getPreview()
        .clearPreview();

    getUI().resetResult();

    getUI().setStatus(
        "idle",
        "Upload reference image."
    );

}


/* =========================================================
   REMOVE REPLACEMENT CHARACTER
========================================================= */

function removeReplacementCharacter() {

    try {

        getUpload()
            .removeReplacementCharacter();

    } catch (error) {

        getState()
            .clearReplacementCharacter();
    }

    getPreview()
        .clearCharacterPreview();

    /*
     * Jangan menghapus hasil analysis reference image.
     * Character image adalah input tambahan.
     */

    getUI().setStatus(
        "ready",
        "Replacement character dihapus."
    );

}


/* =========================================================
   FORM → STATE
========================================================= */

function syncFormToState() {

    const dom = getDOM();
    const state = getState();

    if (dom.model) {

        state.setModel({
            id: dom.model.value || ""
        });

    }

    if (dom.detail) {

        state.setSettings({
            detail: dom.detail.value || ""
        });

    }

    if (dom.purpose) {

        state.setSettings({
            purpose: dom.purpose.value || ""
        });

    }

    if (dom.instruction) {

        state.setSettings({
            instruction:
                dom.instruction.value || ""
        });

    }

}


/* =========================================================
   FORM FIELD EVENTS
========================================================= */

function handleModelChange(event) {

    const state = getState();

    state.setModel({
        id: event?.target?.value || ""
    });

}


function handleDetailChange(event) {

    const state = getState();

    state.setSettings({
        detail:
            event?.target?.value || ""
    });

}


function handlePurposeChange(event) {

    const state = getState();

    state.setSettings({
        purpose:
            event?.target?.value || ""
    });

}


function handleInstructionInput(event) {

    const state = getState();

    state.setSettings({
        instruction:
            event?.target?.value || ""
    });

}


/* =========================================================
   SAFE EVENT BINDING
========================================================= */

function bindEvent(
    element,
    eventName,
    handler
) {

    if (!element) {
        return false;
    }

    element.addEventListener(
        eventName,
        handler
    );

    return true;

}


/* =========================================================
   BIND EVENTS
========================================================= */

function bindEvents() {

    const dom = getDOM();


    /* -----------------------------------------------------
       REFERENCE IMAGE
    ----------------------------------------------------- */

    bindEvent(
        dom.fileInput,
        "change",
        handleFileInput
    );

    bindEvent(
        dom.dropzone,
        "dragover",
        handleDragOver
    );

    bindEvent(
        dom.dropzone,
        "dragleave",
        handleDragLeave
    );

    bindEvent(
        dom.dropzone,
        "drop",
        handleReferenceDrop
    );

    bindEvent(
        dom.browseButton,
        "click",
        () => {

            if (dom.fileInput) {

                dom.fileInput.click();

            }

        }
    );

    bindEvent(
        dom.removeButton,
        "click",
        removeFile
    );


    /* -----------------------------------------------------
       REPLACEMENT CHARACTER
    ----------------------------------------------------- */

    bindEvent(
        dom.characterFileInput,
        "change",
        handleReplacementCharacterInput
    );

    bindEvent(
        dom.characterDropzone,
        "dragover",
        handleDragOver
    );

    bindEvent(
        dom.characterDropzone,
        "dragleave",
        handleDragLeave
    );

    bindEvent(
        dom.characterDropzone,
        "drop",
        handleCharacterDrop
    );

    bindEvent(
        dom.characterBrowseButton,
        "click",
        () => {

            if (
                dom.characterFileInput
            ) {

                dom.characterFileInput.click();

            }

        }
    );

    bindEvent(
        dom.characterRemoveButton,
        "click",
        removeReplacementCharacter
    );


    /* -----------------------------------------------------
       SETTINGS
    ----------------------------------------------------- */

    bindEvent(
        dom.model,
        "change",
        handleModelChange
    );

    bindEvent(
        dom.detail,
        "change",
        handleDetailChange
    );

    bindEvent(
        dom.purpose,
        "change",
        handlePurposeChange
    );

    bindEvent(
        dom.instruction,
        "input",
        handleInstructionInput
    );

}


/* =========================================================
   INITIALIZE
========================================================= */

function initialize() {

    bindEvents();

    syncFormToState();

    getPreview()
        .renderFromState();

}


/* =========================================================
   PUBLIC API
========================================================= */

const GENZVisionEvents = {

    handleNewImage,
    handleNewReplacementCharacter,

    handleFileInput,
    handleReplacementCharacterInput,

    handleDrop,
    handleReplacementCharacterDrop,

    handleDragOver,
    handleDragLeave,

    handleReferenceDrop,
    handleCharacterDrop,

    removeFile,
    removeReplacementCharacter,

    syncFormToState,
    bindEvents,
    initialize

};


export {

    handleNewImage,
    handleNewReplacementCharacter,

    handleFileInput,
    handleReplacementCharacterInput,

    handleDrop,
    handleReplacementCharacterDrop,

    handleDragOver,
    handleDragLeave,

    handleReferenceDrop,
    handleCharacterDrop,

    removeFile,
    removeReplacementCharacter,

    syncFormToState,
    bindEvents,
    initialize

};


if (
    typeof window !== "undefined"
) {

    window.GENZVisionEvents =
        GENZVisionEvents;

}
