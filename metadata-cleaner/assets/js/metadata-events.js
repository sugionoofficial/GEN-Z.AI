/* =========================================================
   GEN-Z.AI
   AI METADATA CLEANER
   ---------------------------------------------------------
   File:
   metadata-cleaner/assets/js/metadata-events.js

   Fungsi:
   - Register application event listeners
========================================================= */

import {
    elements
} from "./metadata-dom.js";


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

    elements.fileInput?.addEventListener(
        "change",
        handleFileInput
    );


    elements.changeButton?.addEventListener(
        "click",
        openFilePicker
    );


    elements.checkButton?.addEventListener(
        "click",
        checkMetadata
    );


    elements.cleanButton?.addEventListener(
        "click",
        cleanMetadata
    );


    elements.downloadButton?.addEventListener(
        "click",
        downloadCleanedFile
    );


    elements.dropzone?.addEventListener(
        "dragover",
        handleDragOver
    );


    elements.dropzone?.addEventListener(
        "dragleave",
        handleDragLeave
    );


    elements.dropzone?.addEventListener(
        "drop",
        handleDrop
    );
}
