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
   - Membersihkan hasil cleaning
   - Reset seluruh aplikasi

   Catatan:
   - Tidak mengubah struktur state
   - Tidak mengubah proses cleaning
   - Tidak mengubah proses metadata detection
   - Object URL selalu direvoke sebelum state dikosongkan
   - Menggunakan elements.cleanResult sesuai metadata-dom.js
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

    /*
       Lepaskan Object URL file asli
    */

    if (
        state.originalURL
    ) {

        URL.revokeObjectURL(
            state.originalURL
        );

    }


    /*
       Lepaskan Object URL hasil cleaning
    */

    if (
        state.cleanedURL
    ) {

        URL.revokeObjectURL(
            state.cleanedURL
        );

    }


    /*
       Bersihkan URL dari state
    */

    state.originalURL =
        null;


    state.cleanedURL =
        null;


    /*
       Bersihkan blob hasil cleaning
    */

    state.cleanedBlob =
        null;


    /*
       Bersihkan metadata
    */

    state.metadata =
        [];


    /*
       Bersihkan hasil AI detection
    */

    state.aiIndicators =
        [];


    /*
       Reset status pemeriksaan
    */

    state.checked =
        false;


    /*
       Reset status cleaning
    */

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
       AI DETECT OVERLAY
    ===================================================== */

    if (
        elements.aiOverlay
    ) {

        elements.aiOverlay.textContent =
            "";

    }


    /* =====================================================
       METADATA CONTENT
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
       -----------------------------------------------------
       Nama element yang benar adalah:
       elements.cleanResult

       Bukan:
       elements.cleanedResult
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
       RESET STATUS CLASSES
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
        elements.statusTitle
    ) {

        elements.statusTitle.textContent =
            "";

    }


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

    /*
       Reset seluruh data file aktif
    */

    resetForNewFile();


    /*
       Bersihkan file utama
    */

    state.file =
        null;


    state.fileType =
        null;


    /*
       Reset FFmpeg state aplikasi.

       Instance FFmpeg tidak dihancurkan di sini.
       Hanya status penggunaan aplikasi yang dikembalikan
       ke kondisi awal.
    */

    state.ffmpeg =
        null;


    state.ffmpegLoaded =
        false;


    state.ffmpegLoading =
        false;


    state.ffmpegScriptsLoaded =
        false;


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
       RESET FILE INFO TEXT
    ===================================================== */

    if (
        elements.fileType
    ) {

        elements.fileType.textContent =
            "";

    }


    if (
        elements.fileName
    ) {

        elements.fileName.textContent =
            "";

    }


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
       RESET STATUS TEXT
    ===================================================== */

    if (
        elements.statusTitle
    ) {

        elements.statusTitle.textContent =
            "";

    }


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
       RESET PREVIEW VISIBILITY
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


    if (
        elements.aiOverlay
    ) {

        elements.aiOverlay.classList.add(
            "hidden"
        );

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
