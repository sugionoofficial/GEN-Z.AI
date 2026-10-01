/* =========================================================
   GEN-Z.AI
   AI METADATA CLEANER
   ---------------------------------------------------------
   File:
   metadata-cleaner/assets/js/metadata-reset.js

   Fungsi:
   - Reset file sebelumnya
   - Membersihkan preview
   - Membersihkan metadata
   - Membersihkan AI detection
   - Membersihkan Sightengine detection
   - Membersihkan hasil cleaning
   - Reset seluruh aplikasi

   Catatan:
   - Tidak mengubah struktur state
   - Tidak mengubah proses cleaning
   - Tidak mengubah proses metadata detection
   - Object URL selalu direvoke sebelum state dikosongkan
   - Tidak mereset state FFmpeg
========================================================= */


import {
    state
} from "./metadata-state.js";


import {
    elements
} from "./metadata-dom.js";


/* =========================================================
   RESET FOR NEW FILE
========================================================= */

export function resetForNewFile() {

    /* =====================================================
       REVOKE ORIGINAL OBJECT URL
    ===================================================== */

    if (
        state.originalURL
    ) {

        URL.revokeObjectURL(
            state.originalURL
        );

    }


    /* =====================================================
       REVOKE CLEANED OBJECT URL
    ===================================================== */

    if (
        state.cleanedURL
    ) {

        URL.revokeObjectURL(
            state.cleanedURL
        );

    }


    /* =====================================================
       RESET URL STATE
    ===================================================== */

    state.originalURL =
        null;


    state.cleanedURL =
        null;


    /* =====================================================
       RESET CLEANED BLOB
    ===================================================== */

    state.cleanedBlob =
        null;


    /* =====================================================
       RESET METADATA
    ===================================================== */

    state.metadata =
        [];


    /* =====================================================
       RESET LOCAL AI INDICATORS
    ===================================================== */

    state.aiIndicators =
        [];


    /* =====================================================
       RESET SIGHTENGINE DETECTION
       -----------------------------------------------------
       Penting:
       Hasil visual AI detection dari file sebelumnya
       tidak boleh terbawa ke file baru.
    ===================================================== */

    if (
        Object.prototype.hasOwnProperty.call(
            state,
            "sightengineDetection"
        )
    ) {

        state.sightengineDetection =
            null;

    }


    /* =====================================================
       RESET CHECK STATUS
    ===================================================== */

    state.checked =
        false;


    /* =====================================================
       RESET CLEANING STATUS
    ===================================================== */

    state.cleaning =
        false;


    /* =====================================================
       ORIGINAL IMAGE PREVIEW
    ===================================================== */

    if (
        elements.imagePreview
    ) {

        elements.imagePreview.src =
            "";

    }


    /* =====================================================
       ORIGINAL VIDEO PREVIEW
    ===================================================== */

    if (
        elements.videoPreview
    ) {

        elements.videoPreview.pause();

        elements.videoPreview.removeAttribute(
            "src"
        );

        elements.videoPreview.load();

    }


    /* =====================================================
       CLEANED IMAGE PREVIEW
    ===================================================== */

    if (
        elements.cleanImagePreview
    ) {

        elements.cleanImagePreview.src =
            "";

    }


    /* =====================================================
       CLEANED VIDEO PREVIEW
    ===================================================== */

    if (
        elements.cleanVideoPreview
    ) {

        elements.cleanVideoPreview.pause();

        elements.cleanVideoPreview.removeAttribute(
            "src"
        );

        elements.cleanVideoPreview.load();

    }


    /* =====================================================
       AI DETECTION OVERLAY
    ===================================================== */

    if (
        elements.aiOverlay
    ) {

        elements.aiOverlay.textContent =
            "";

    }


    /* =====================================================
       METADATA TABLE
    ===================================================== */

    if (
        elements.metadataTableBody
    ) {

        elements.metadataTableBody.innerHTML =
            "";

    }


    /* =====================================================
       METADATA COUNT
    ===================================================== */

    if (
        elements.metadataCount
    ) {

        elements.metadataCount.textContent =
            "0";

    }


    /* =====================================================
       CLEAN RESULT
    ===================================================== */

    if (
        elements.cleanResult
    ) {

        elements.cleanResult.classList.add(
            "hidden"
        );

    }


    /* =====================================================
       RESET BUTTONS
    ===================================================== */

    if (
        elements.checkButton
    ) {

        elements.checkButton.disabled =
            true;

    }


    if (
        elements.cleanButton
    ) {

        elements.cleanButton.disabled =
            true;

    }


    if (
        elements.downloadButton
    ) {

        elements.downloadButton.disabled =
            true;

    }


    /* =====================================================
       RESET FILE INFO
    ===================================================== */

    if (
        elements.fileInfo
    ) {

        elements.fileInfo.classList.add(
            "hidden"
        );

    }


    /* =====================================================
       RESET ORIGINAL PREVIEW VISIBILITY
    ===================================================== */

    if (
        elements.previewEmpty
    ) {

        elements.previewEmpty.classList.remove(
            "hidden"
        );

    }


    if (
        elements.imagePreview
    ) {

        elements.imagePreview.classList.add(
            "hidden"
        );

    }


    if (
        elements.videoPreview
    ) {

        elements.videoPreview.classList.add(
            "hidden"
        );

    }


    /* =====================================================
       RESET CLEANED PREVIEW VISIBILITY
    ===================================================== */

    if (
        elements.cleanImagePreview
    ) {

        elements.cleanImagePreview.classList.add(
            "hidden"
        );

    }


    if (
        elements.cleanVideoPreview
    ) {

        elements.cleanVideoPreview.classList.add(
            "hidden"
        );

    }


    /* =====================================================
       RESET AI OVERLAY VISIBILITY
    ===================================================== */

    if (
        elements.aiOverlay
    ) {

        elements.aiOverlay.classList.add(
            "hidden"
        );

    }


    /* =====================================================
       RESET STATUS INDICATOR
    ===================================================== */

    if (
        elements.statusIndicator
    ) {

        elements.statusIndicator.classList.remove(
            "is-detected",
            "is-clear",
            "is-unknown"
        );

    }


    /* =====================================================
       RESET DETECTION STATUS CLASSES
    ===================================================== */

    if (
        elements.detectionStatus
    ) {

        elements.detectionStatus.classList.remove(
            "success",
            "error",
            "warning",
            "info"
        );

    }


    /* =====================================================
       RESET STATUS TITLE
    ===================================================== */

    if (
        elements.statusTitle
    ) {

        elements.statusTitle.textContent =
            "";

    }


    /* =====================================================
       RESET STATUS DESCRIPTION
    ===================================================== */

    if (
        elements.statusDescription
    ) {

        elements.statusDescription.textContent =
            "";

    }


    /* =====================================================
       RESET PREVIEW STATUS
    ===================================================== */

    if (
        elements.previewStatus
    ) {

        elements.previewStatus.textContent =
            "";

    }

}


/* =========================================================
   RESET APPLICATION
========================================================= */

export function resetApplication() {

    /* =====================================================
       RESET ACTIVE FILE DATA
    ===================================================== */

    resetForNewFile();


    /* =====================================================
       CLEAR ACTIVE FILE
    ===================================================== */

    state.file =
        null;


    state.fileType =
        null;


    /*
       Jangan reset FFmpeg di sini.

       FFmpeg merupakan resource aplikasi yang dapat
       digunakan kembali untuk proses video berikutnya.

       Reset file/aplikasi tidak boleh memaksa FFmpeg
       melakukan loading ulang.
    */


    /* =====================================================
       RESET FILE INPUT
    ===================================================== */

    if (
        elements.fileInput
    ) {

        elements.fileInput.value =
            "";

    }


    /* =====================================================
       RESET FILE TYPE TEXT
    ===================================================== */

    if (
        elements.fileType
    ) {

        elements.fileType.textContent =
            "";

    }


    /* =====================================================
       RESET FILE NAME TEXT
    ===================================================== */

    if (
        elements.fileName
    ) {

        elements.fileName.textContent =
            "";

    }


    /* =====================================================
       RESET FILE SIZE TEXT
    ===================================================== */

    if (
        elements.fileSize
    ) {

        elements.fileSize.textContent =
            "";

    }


    /* =====================================================
       RESET METADATA TABLE
    ===================================================== */

    if (
        elements.metadataTableBody
    ) {

        elements.metadataTableBody.innerHTML =
            "";

    }


    if (
        elements.metadataCount
    ) {

        elements.metadataCount.textContent =
            "0";

    }


    /* =====================================================
       RESET LOCAL AI INDICATORS
    ===================================================== */

    state.aiIndicators =
        [];


    /* =====================================================
       RESET SIGHTENGINE DETECTION
       -----------------------------------------------------
       Pastikan resetApplication() juga membersihkan
       hasil visual detection dari file sebelumnya.
    ===================================================== */

    if (
        Object.prototype.hasOwnProperty.call(
            state,
            "sightengineDetection"
        )
    ) {

        state.sightengineDetection =
            null;

    }


    /* =====================================================
       RESET DETECTION STATUS
    ===================================================== */

    if (
        elements.detectionStatus
    ) {

        elements.detectionStatus.classList.remove(
            "success",
            "error",
            "warning",
            "info"
        );

    }


    if (
        elements.statusIndicator
    ) {

        elements.statusIndicator.classList.remove(
            "is-detected",
            "is-clear",
            "is-unknown"
        );

    }


    /* =====================================================
       RESET STATUS TITLE
    ===================================================== */

    if (
        elements.statusTitle
    ) {

        elements.statusTitle.textContent =
            "";

    }


    /* =====================================================
       RESET STATUS DESCRIPTION
    ===================================================== */

    if (
        elements.statusDescription
    ) {

        elements.statusDescription.textContent =
            "";

    }


    /* =====================================================
       RESET BUTTONS
    ===================================================== */

    if (
        elements.checkButton
    ) {

        elements.checkButton.disabled =
            true;

    }


    if (
        elements.cleanButton
    ) {

        elements.cleanButton.disabled =
            true;

    }


    if (
        elements.downloadButton
    ) {

        elements.downloadButton.disabled =
            true;

    }


    /* =====================================================
       RESET PREVIEW STATUS
    ===================================================== */

    if (
        elements.previewStatus
    ) {

        elements.previewStatus.textContent =
            "BELUM ADA MEDIA";

    }


    /* =====================================================
       RESET ORIGINAL PREVIEW
    ===================================================== */

    if (
        elements.previewEmpty
    ) {

        elements.previewEmpty.classList.remove(
            "hidden"
        );

    }


    if (
        elements.imagePreview
    ) {

        elements.imagePreview.classList.add(
            "hidden"
        );

    }


    if (
        elements.videoPreview
    ) {

        elements.videoPreview.classList.add(
            "hidden"
        );

    }


    /* =====================================================
       RESET CLEANED PREVIEW
    ===================================================== */

    if (
        elements.cleanImagePreview
    ) {

        elements.cleanImagePreview.classList.add(
            "hidden"
        );

    }


    if (
        elements.cleanVideoPreview
    ) {

        elements.cleanVideoPreview.classList.add(
            "hidden"
        );

    }


    /* =====================================================
       RESET AI OVERLAY
    ===================================================== */

    if (
        elements.aiOverlay
    ) {

        elements.aiOverlay.classList.add(
            "hidden"
        );

        elements.aiOverlay.textContent =
            "";

    }


    /* =====================================================
       RESET CLEAN RESULT
    ===================================================== */

    if (
        elements.cleanResult
    ) {

        elements.cleanResult.classList.add(
            "hidden"
        );

    }


    /* =====================================================
       RESET FILE INFO
    ===================================================== */

    if (
        elements.fileInfo
    ) {

        elements.fileInfo.classList.add(
            "hidden"
        );

    }

}
