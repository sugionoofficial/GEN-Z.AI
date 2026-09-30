/* =========================================================
   GEN-Z.AI
   AI METADATA CLEANER
   ---------------------------------------------------------
   File:
   metadata-cleaner/assets/js/metadata-dom.js

   Fungsi:
   - Cache seluruh DOM element
========================================================= */

export const elements = {};


export function cacheElements() {

    elements.fileInput =
        document.getElementById(
            "metadata-file-input"
        );


    elements.dropzone =
        document.getElementById(
            "metadata-dropzone"
        );


    elements.fileInfo =
        document.getElementById(
            "metadata-file-info"
        );


    elements.fileType =
        document.getElementById(
            "metadata-file-type"
        );


    elements.fileName =
        document.getElementById(
            "metadata-file-name"
        );


    elements.fileSize =
        document.getElementById(
            "metadata-file-size"
        );


    elements.changeButton =
        document.getElementById(
            "metadata-change-button"
        );


    elements.previewEmpty =
        document.getElementById(
            "metadata-preview-empty"
        );


    elements.imagePreview =
        document.getElementById(
            "metadata-image-preview"
        );


    elements.videoPreview =
        document.getElementById(
            "metadata-video-preview"
        );


    elements.aiOverlay =
        document.getElementById(
            "metadata-ai-detect-overlay"
        );


    elements.previewStatus =
        document.getElementById(
            "metadata-preview-status"
        );


    elements.checkButton =
        document.getElementById(
            "metadata-check-button"
        );


    elements.detectionStatus =
        document.getElementById(
            "metadata-detection-status"
        );


    elements.statusIndicator =
        document.getElementById(
            "metadata-status-indicator"
        );


    elements.statusTitle =
        document.getElementById(
            "metadata-status-title"
        );


    elements.statusDescription =
        document.getElementById(
            "metadata-status-description"
        );


    elements.metadataCount =
        document.getElementById(
            "metadata-count"
        );


    elements.metadataTableBody =
        document.getElementById(
            "metadata-table-body"
        );


    elements.cleanButton =
        document.getElementById(
            "metadata-clean-button"
        );


    elements.cleanResult =
        document.getElementById(
            "metadata-clean-result"
        );


    elements.cleanImagePreview =
        document.getElementById(
            "metadata-clean-image-preview"
        );


    elements.cleanVideoPreview =
        document.getElementById(
            "metadata-clean-video-preview"
        );


    elements.downloadButton =
        document.getElementById(
            "metadata-download-button"
        );


    return elements;
}
