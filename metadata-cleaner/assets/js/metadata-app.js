/* =========================================================
   GEN-Z.AI
   AI METADATA CLEANER
   ---------------------------------------------------------
   File:
   metadata-cleaner/assets/js/metadata-app.js

   Fungsi:
   - Inisialisasi aplikasi
   - Menangani file input / drag & drop
   - Koordinasi pembacaan metadata
   - Koordinasi AI detection
   - Menghubungkan module cleaning
   - Menyediakan public API

   Architecture:
   - metadata-state.js
   - metadata-dom.js
   - metadata-events.js
   - metadata-normalizer.js
   - metadata-detector.js
   - metadata-status.js
   - metadata-image.js
   - metadata-video.js
   - metadata-file.js
   - metadata-preview.js
   - metadata-download.js
   - metadata-reset.js
   - metadata-clean.js
   - metadata-cleaner-image.js
   - metadata-cleaner-video.js

   Catatan:
   - File ini hanya menjadi coordinator.
   - Implementasi fungsi tidak diduplikasi.
   - File asli user tidak pernah dimodifikasi.
========================================================= */


/* =========================================================
   STATE
========================================================= */

import {
    state
} from "./metadata-state.js";


/* =========================================================
   DOM
========================================================= */

import {
    elements,
    cacheElements
} from "./metadata-dom.js";


/* =========================================================
   EVENTS
========================================================= */

import {
    bindMetadataEvents
} from "./metadata-events.js";


/* =========================================================
   NORMALIZER
========================================================= */

import {
    normalizeMetadata
} from "./metadata-normalizer.js";


/* =========================================================
   DETECTOR
========================================================= */

import {
    detectAIIndicators
} from "./metadata-detector.js";


/* =========================================================
   STATUS
========================================================= */

import {
    renderDetectionResult,
    renderMetadata,
    setStatus
} from "./metadata-status.js";


/* =========================================================
   IMAGE METADATA
========================================================= */

import {
    readImageMetadata
} from "./metadata-image.js";


/* =========================================================
   VIDEO METADATA
========================================================= */

import {
    readVideoMetadata
} from "./metadata-video.js";


/* =========================================================
   FILE
========================================================= */

import {
    isSupportedMedia,
    detectMediaType,
    updateFileInfo
} from "./metadata-file.js";


/* =========================================================
   PREVIEW
========================================================= */

import {
    renderOriginalPreview,
    setPreviewStatus
} from "./metadata-preview.js";


/* =========================================================
   DOWNLOAD
========================================================= */

import {
    downloadCleanedFile
} from "./metadata-download.js";


/* =========================================================
   RESET
========================================================= */

import {
    resetForNewFile,
    resetApplication
} from "./metadata-reset.js";


/* =========================================================
   CLEAN
========================================================= */

import {
    cleanMetadata
} from "./metadata-clean.js";


/* =========================================================
   INIT
========================================================= */

function init() {

    /*
       Cache seluruh DOM terlebih dahulu.
    */

    cacheElements();


    /*
       Bind seluruh event aplikasi.

       Event handler berasal dari coordinator
       atau module yang sudah dipisahkan.
    */

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


    /*
       Kembalikan aplikasi ke kondisi awal.
    */

    resetApplication();


    console.info(
        "[GEN-Z.AI] AI Metadata Cleaner initialized."
    );

}


/* =========================================================
   FILE PICKER
========================================================= */

function openFilePicker() {

    elements.fileInput?.click();

}


/* =========================================================
   FILE INPUT
========================================================= */

function handleFileInput(
    event
) {

    const files =
        Array.from(
            event.target?.files || []
        );


    if (
        !files.length
    ) {

        return;
    }


    processSelectedFile(
        files[0]
    );

}


/* =========================================================
   DRAG OVER
========================================================= */

function handleDragOver(
    event
) {

    event.preventDefault();


    elements.dropzone?.classList.add(
        "is-dragging"
    );

}


/* =========================================================
   DRAG LEAVE
========================================================= */

function handleDragLeave(
    event
) {

    event.preventDefault();


    elements.dropzone?.classList.remove(
        "is-dragging"
    );

}


/* =========================================================
   DROP
========================================================= */

function handleDrop(
    event
) {

    event.preventDefault();


    elements.dropzone?.classList.remove(
        "is-dragging"
    );


    const files =
        Array.from(
            event.dataTransfer?.files || []
        );


    if (
        !files.length
    ) {

        return;
    }


    processSelectedFile(
        files[0]
    );

}


/* =========================================================
   FILE PROCESSING
========================================================= */

function processSelectedFile(
    file
) {

    if (
        !file
    ) {

        return;
    }


    /*
       Pastikan file merupakan media
       yang didukung aplikasi.
    */

    if (
        !isSupportedMedia(
            file
        )
    ) {

        setStatus(
            "UNKNOWN",
            "FORMAT TIDAK DIDUKUNG",
            "Pilih file foto atau video yang dapat diproses oleh browser."
        );


        return;
    }


    /*
       Bersihkan file sebelumnya
       sebelum memasukkan file baru.
    */

    resetForNewFile();


    /*
       Simpan file aktif.
    */

    state.file =
        file;


    /*
       Tentukan image / video.
    */

    state.fileType =
        detectMediaType(
            file
        );


    /*
       Buat object URL untuk preview
       file asli.

       File asli tidak disentuh.
    */

    state.originalURL =
        URL.createObjectURL(
            file
        );


    /*
       Update informasi file.
    */

    updateFileInfo();


    /*
       Render preview file asli.
    */

    renderOriginalPreview();


    /*
       CHECK aktif karena file sudah tersedia.
    */

    elements.checkButton.disabled =
        false;


    /*
       CLEAN belum boleh digunakan
       sebelum metadata diperiksa.
    */

    elements.cleanButton.disabled =
        true;


    /*
       DOWNLOAD belum tersedia.
    */

    elements.downloadButton.disabled =
        true;


    /*
       Status preview.
    */

    setPreviewStatus(
        "MEDIA SIAP. TEKAN CHECK UNTUK MEMBACA METADATA."
    );


    /*
       Status detection.
    */

    setStatus(
        "UNKNOWN",
        "BELUM DIPERIKSA",
        "Tekan CHECK untuk membaca metadata media."
    );

}


/* =========================================================
   CHECK METADATA
   ---------------------------------------------------------
   Coordinator metadata.

   Urutan:
   1. Read metadata
   2. Normalize
   3. Detect AI indicators
   4. Render metadata
   5. Render detection
   6. Enable cleaning
========================================================= */

async function checkMetadata() {

    /*
       Tidak ada file.
    */

    if (
        !state.file
    ) {

        return;
    }


    /*
       Jangan membaca ulang metadata
       jika sudah berhasil diperiksa.
    */

    if (
        state.checked
    ) {

        return;
    }


    /*
       Disable CHECK selama proses.
    */

    elements.checkButton.disabled =
        true;


    setStatus(
        "UNKNOWN",
        "MEMBACA METADATA...",
        "Metadata sedang diperiksa secara lokal di browser."
    );


    setPreviewStatus(
        "MEMBACA METADATA..."
    );


    try {

        let metadata;


        /* =================================================
           IMAGE
        ================================================= */

        if (
            state.fileType === "image"
        ) {

            metadata =
                await readImageMetadata(
                    state.file
                );

        }


        /* =================================================
           VIDEO
        ================================================= */

        else {

            metadata =
                await readVideoMetadata(
                    state.file
                );

        }


        /* =================================================
           NORMALIZE
        ================================================= */

        state.metadata =
            normalizeMetadata(
                metadata
            );


        /* =================================================
           AI DETECTION
        ================================================= */

        state.aiIndicators =
            detectAIIndicators(
                state.metadata
            );


        /*
           Metadata berhasil diperiksa.
        */

        state.checked =
            true;


        /* =================================================
           RENDER METADATA
        ================================================= */

        renderMetadata();


        /* =================================================
           RENDER AI DETECTION
        ================================================= */

        renderDetectionResult();


        /*
           Cleaning baru tersedia
           setelah pemeriksaan metadata.
        */

        elements.cleanButton.disabled =
            false;


        /*
           Preview status.
        */

        setPreviewStatus(

            state.aiIndicators.length

                ? "INDIKATOR AI DITEMUKAN PADA METADATA."

                : "PEMERIKSAAN METADATA SELESAI."

        );

    } catch (
        error
    ) {

        console.error(
            "[GEN-Z.AI] Metadata check failed:",
            error
        );


        /*
           Jika pembacaan gagal,
           jangan menyimpan metadata parsial.
        */

        state.metadata =
            [];


        state.aiIndicators =
            [];


        /*
           Render kondisi metadata kosong.
        */

        renderMetadata();


        /*
           Jangan menandai pemeriksaan sebagai
           berhasil apabila terjadi error.
        */

        state.checked =
            false;


        setStatus(
            "UNKNOWN",
            "METADATA TIDAK DAPAT DIBACA SEPENUHNYA",
            getReadableError(
                error
            )
        );


        setPreviewStatus(
            "PEMERIKSAAN SELESAI DENGAN KETERBATASAN."
        );

    } finally {

        /*
           CHECK kembali aktif.

           Jika metadata berhasil, state.checked
           mencegah pemeriksaan ulang.
        */

        elements.checkButton.disabled =
            false;

    }

}


/* =========================================================
   ERROR MESSAGE
========================================================= */

function getReadableError(
    error
) {

    if (
        !error
    ) {

        return "Terjadi kesalahan yang tidak diketahui.";
    }


    if (
        error instanceof Error
    ) {

        return error.message;
    }


    return String(
        error
    );

}


/* =========================================================
   PUBLIC API
   ---------------------------------------------------------
   API lama tetap dipertahankan agar kode lain
   yang menggunakan GENZMetadataCleaner tidak rusak.
========================================================= */

window.GENZMetadataCleaner =
    Object.freeze({

        getState() {

            return state;

        },


        reset() {

            resetApplication();

        }

    });


/* =========================================================
   START APPLICATION
========================================================= */

if (
    document.readyState === "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        init,
        {
            once: true
        }
    );

} else {

    init();

}
