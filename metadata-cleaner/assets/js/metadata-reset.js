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


/* =========================================================
   STATE
========================================================= */

import {
    state,
    createEmptySightengineDetection
} from "./metadata-state.js";


/* =========================================================
   DOM
========================================================= */

import {
    elements
} from "./metadata-dom.js";


/* =========================================================
   RESET SIGHTENGINE STATE
   ---------------------------------------------------------
   Semua state Sightengine dikembalikan ke kondisi
   sebelum detection dijalankan.
========================================================= */

function resetSightengineState() {

    state.sightengineDetection =
        createEmptySightengineDetection();


    state.sightengineLoading =
        false;


    state.sightengineError =
        null;


    state.sightengineChecked =
        false;

}


/* =========================================================
   RESET DETECTION STATE
========================================================= */

function resetDetectionState() {

    state.aiIndicators =
        [];


    state.detectionStatus =
        "idle";


    state.detectionMessage =
        "";


    resetSightengineState();

}


/* =========================================================
   RESET CLEANING STATE
========================================================= */

function resetCleaningState() {

    state.cleanedBlob =
        null;


    state.cleaned =
        false;


    state.cleaning =
        false;


    state.cleaningError =
        null;


    state.downloadReady =
        false;


    state.downloadUrl =
        null;


    state.downloadName =
        "";

}


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
       RESET CLEANING
    ===================================================== */

    resetCleaningState();


    /* =====================================================
       RESET METADATA
    ===================================================== */

    state.metadata =
        [];


    state.metadataCount =
        0;


    state.originalMetadata =
        [];


    state.originalMetadataCount =
        0;


    state.cleanedMetadata =
        [];


    state.cleanedMetadataCount =
        0;


    /* =====================================================
       RESET DETECTION
    ===================================================== */

    resetDetectionState();


    /* =====================================================
       RESET CHECK STATUS
    ===================================================== */

    state.checked =
        false;


    /* =====================================================
       RESET ORIGINAL IMAGE PREVIEW
    ===================================================== */

    if (
        elements.imagePreview
    ) {

        elements.imagePreview.src =
            "";

    }


    /* =====================================================
       RESET ORIGINAL VIDEO PREVIEW
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
       RESET CLEANED IMAGE PREVIEW
    ===================================================== */

    if (
        elements.cleanImagePreview
    ) {

        elements.cleanImagePreview.src =
            "";

    }


    /* =====================================================
       RESET CLEANED VIDEO PREVIEW
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
       RESET AI DETECTION OVERLAY
       -----------------------------------------------------
       Jangan menghapus child DOM dengan textContent.

       metadata-status.js bertanggung jawab membuat /
       memperbarui stamp ketika detection baru tersedia.

       Di sini kita hanya menyembunyikan overlay.
    ===================================================== */

    if (
        elements.aiOverlay
    ) {

        elements.aiOverlay.classList.add(
            "hidden"
        );


        elements.aiOverlay.setAttribute(
            "aria-hidden",
            "true"
        );


        elements.aiOverlay.hidden =
            true;


        elements.aiOverlay.style.visibility =
            "hidden";


        elements.aiOverlay.style.opacity =
            "0";


        const model =
            elements.aiOverlay.querySelector(
                ".metadata-ai-detect-model"
            );


        if (
            model
        ) {

            model.remove();

        }

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


    /* =====================================================
       RESET METADATA COUNT
    ===================================================== */

    if (
        elements.metadataCount
    ) {

        elements.metadataCount.textContent =
            "0";

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


    state.fileName =
        "";


    state.fileSize =
        0;


    state.mediaType =
        null;


    state.isImage =
        false;


    state.isVideo =
        false;


    /* =====================================================
       RESET PREVIEW STATE
    ===================================================== */

    state.previewUrl =
        null;


    state.previewObjectUrl =
        null;


    /* =====================================================
       RESET PROCESSING STATE
       -----------------------------------------------------
       FFmpeg resource tidak disentuh.
    ===================================================== */

    state.processing =
        false;


    state.processingStage =
        "";


    state.processingProgress =
        0;


    /* =====================================================
       RESET APPLICATION STATUS
    ===================================================== */

    state.error =
        null;


    state.status =
        "idle";


    state.statusMessage =
        "";


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
       RESET DETECTION STATE
    ===================================================== */

    resetDetectionState();


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


        elements.aiOverlay.setAttribute(
            "aria-hidden",
            "true"
        );


        elements.aiOverlay.hidden =
            true;


        elements.aiOverlay.style.visibility =
            "hidden";


        elements.aiOverlay.style.opacity =
            "0";


        const model =
            elements.aiOverlay.querySelector(
                ".metadata-ai-detect-model"
            );


        if (
            model
        ) {

            model.remove();

        }

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
