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


    /*
       Bersihkan preview image asli
    */

    if (
        elements.imagePreview
    ) {

        elements.imagePreview.src =
            "";

    }


    /*
       Bersihkan preview video asli
    */

    if (
        elements.videoPreview
    ) {

        elements.videoPreview.removeAttribute(
            "src"
        );

        elements.videoPreview.load();

    }


    /*
       Bersihkan preview image hasil cleaning
    */

    if (
        elements.cleanedImagePreview
    ) {

        elements.cleanedImagePreview.src =
            "";

    }


    /*
       Bersihkan preview video hasil cleaning
    */

    if (
        elements.cleanedVideoPreview
    ) {

        elements.cleanedVideoPreview.removeAttribute(
            "src"
        );

        elements.cleanedVideoPreview.load();

    }


    /*
       Bersihkan overlay AI
    */

    if (
        elements.aiOverlay
    ) {

        elements.aiOverlay.textContent =
            "";

    }


    /*
       Bersihkan metadata container
    */

    if (
        elements.metadataContent
    ) {

        elements.metadataContent.textContent =
            "";

    }


    /*
       Sembunyikan hasil cleaning
    */

    elements.cleanedResult?.classList.add(
        "hidden"
    );


    /*
       Reset tombol
    */

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


    /*
       Reset file info
    */

    elements.fileInfo?.classList.add(
        "hidden"
    );


    /*
       Reset preview
    */

    elements.previewEmpty?.classList.remove(
        "hidden"
    );


    elements.imagePreview?.classList.add(
        "hidden"
    );


    elements.videoPreview?.classList.add(
        "hidden"
    );


    elements.cleanedImagePreview?.classList.add(
        "hidden"
    );


    elements.cleanedVideoPreview?.classList.add(
        "hidden"
    );


    elements.aiOverlay?.classList.add(
        "hidden"
    );


    /*
       Reset status classes
    */

    elements.status?.classList.remove(
        "success",
        "error",
        "warning",
        "info"
    );


    /*
       Bersihkan status text
    */

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


    /*
       Reset preview status
    */

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
       Reset object URL dan state file
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
       seperti kondisi awal.
    */

    state.ffmpeg =
        null;


    state.ffmpegLoaded =
        false;


    state.ffmpegLoading =
        false;


    state.ffmpegScriptsLoaded =
        false;


    /*
       Reset input file
    */

    if (
        elements.fileInput
    ) {

        elements.fileInput.value =
            "";

    }


    /*
       Reset file info
    */

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


    /*
       Reset metadata container
    */

    if (
        elements.metadataContent
    ) {

        elements.metadataContent.innerHTML =
            "";

    }


    /*
       Reset status
    */

    if (
        elements.status
    ) {

        elements.status.classList.remove(
            "success",
            "error",
            "warning",
            "info"
        );

    }


    /*
       Pastikan tombol kembali ke kondisi awal
    */

    elements.checkButton?.setAttribute(
        "disabled",
        ""
    );


    elements.cleanButton?.setAttribute(
        "disabled",
        ""
    );


    elements.downloadButton?.setAttribute(
        "disabled",
        ""
    );

}
