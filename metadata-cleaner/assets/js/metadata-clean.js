/* =========================================================
   GEN-Z.AI
   AI METADATA CLEANER
   ---------------------------------------------------------
   File:
   metadata-cleaner/assets/js/metadata-clean.js

   Fungsi:
   - Membersihkan metadata image
   - Membersihkan metadata video
   - Menghasilkan cleaned Blob
   - Mengirim Blob ke preview renderer
   - Menjaga proses async agar tidak menimpa file baru

   IMPORTANT:
   - Object URL HANYA dibuat oleh metadata-preview.js
   - Modul ini TIDAK memanggil URL.createObjectURL()
   - File asli tidak pernah dimodifikasi
========================================================= */


/* =========================================================
   STATE
========================================================= */

import {
    state
} from "./metadata-state.js";


/* =========================================================
   DOM ELEMENTS
========================================================= */

import {
    elements
} from "./metadata-dom.js";


/* =========================================================
   IMAGE CLEANER
========================================================= */

import {
    cleanImage
} from "./metadata-cleaner-image.js";


/* =========================================================
   VIDEO CLEANER
========================================================= */

import {
    cleanVideo
} from "./metadata-cleaner-video.js";


/* =========================================================
   PREVIEW
========================================================= */

import {
    renderCleanedPreview,
    showElement,
    hideElement,
    clearCleanedPreview
} from "./metadata-preview.js";


/* =========================================================
   CLEAN METADATA
========================================================= */

export async function cleanMetadata() {

    /* =======================================================
       VALIDASI FILE
    ======================================================= */

    if (
        !state.file
    ) {

        console.warn(
            "[GEN-Z.AI] Cleaning dibatalkan: tidak ada file aktif."
        );

        setPreviewStatus(
            "PILIH FILE TERLEBIH DAHULU."
        );

        return;

    }


    /* =======================================================
       CEGAH CLEANING GANDA
    ======================================================= */

    if (
        state.cleaning
    ) {

        console.warn(
            "[GEN-Z.AI] Cleaning sedang berjalan."
        );

        return;

    }


    /* =======================================================
       SIMPAN REFERENSI FILE
       -------------------------------------------------------
       Digunakan untuk menjaga keamanan proses async.
    ======================================================= */

    const sourceFile =
        state.file;


    const sourceFileType =
        String(
            state.fileType || ""
        ).toLowerCase();


    /* =======================================================
       VALIDASI TYPE
    ======================================================= */

    if (
        sourceFileType !== "image" &&
        sourceFileType !== "video"
    ) {

        console.error(
            "[GEN-Z.AI] Jenis file tidak valid:",
            sourceFileType
        );

        setPreviewStatus(
            "CLEANING GAGAL: JENIS FILE TIDAK DIDUKUNG."
        );

        return;

    }


    /* =======================================================
       LOCK CLEANING
    ======================================================= */

    state.cleaning =
        true;


    /* =======================================================
       LOCK BUTTON
    ======================================================= */

    if (
        elements.cleanButton
    ) {

        elements.cleanButton.disabled =
            true;

        elements.cleanButton.setAttribute(
            "data-processing",
            "true"
        );

    }


    if (
        elements.downloadButton
    ) {

        elements.downloadButton.disabled =
            true;

    }


    /* =======================================================
       HAPUS HASIL CLEANING LAMA
    ======================================================= */

    state.cleanedBlob =
        null;


    /*
       Jangan membuat Object URL di sini.

       metadata-preview.js bertanggung jawab penuh
       terhadap cleaned Object URL.
    */

    try {

        clearCleanedPreview();

    } catch (
        error
    ) {

        console.warn(
            "[GEN-Z.AI] Gagal membersihkan preview lama:",
            error
        );

    }


    /* =======================================================
       HIDE CLEAN RESULT
    ======================================================= */

    if (
        elements.cleanResult
    ) {

        hideElement(
            elements.cleanResult
        );

    }


    /* =======================================================
       STATUS
    ======================================================= */

    setPreviewStatus(
        "MEMBERSIHKAN METADATA SECARA LOKAL..."
    );


    console.info(
        "[GEN-Z.AI] Cleaning dimulai.",
        {
            fileName:
                sourceFile.name,

            fileType:
                sourceFileType,

            fileSize:
                sourceFile.size
        }
    );


    /* =======================================================
       PROCESS
    ======================================================= */

    try {

        let result =
            null;


        /* ===================================================
           IMAGE
        =================================================== */

        if (
            sourceFileType === "image"
        ) {

            console.info(
                "[GEN-Z.AI] Menjalankan cleanImage()..."
            );


            result =
                await cleanImage(
                    sourceFile
                );

        }


        /* ===================================================
           VIDEO
        =================================================== */

        else {

            console.info(
                "[GEN-Z.AI] Menjalankan cleanVideo()..."
            );


            result =
                await cleanVideo(
                    sourceFile
                );

        }


        /* ===================================================
           FILE CHANGE GUARD
        =================================================== */

        if (
            state.file !== sourceFile
        ) {

            console.info(
                "[GEN-Z.AI] Hasil cleaning lama diabaikan karena file telah berubah."
            );

            return;

        }


        /* ===================================================
           NORMALIZE RESULT
           ---------------------------------------------------
           Dukungan:

           A. Blob langsung

           B. { blob: Blob }
        =================================================== */

        let cleanedBlob =
            null;


        if (
            result instanceof Blob
        ) {

            cleanedBlob =
                result;

        }


        else if (
            result &&
            result.blob instanceof Blob
        ) {

            cleanedBlob =
                result.blob;

        }


        /* ===================================================
           VALIDASI RESULT
        =================================================== */

        if (
            !cleanedBlob
        ) {

            console.error(
                "[GEN-Z.AI] Cleaner mengembalikan hasil tidak valid:",
                result
            );

            throw new Error(
                "File hasil cleaning tidak tersedia atau bukan Blob."
            );

        }


        if (
            cleanedBlob.size <= 0
        ) {

            throw new Error(
                "File hasil cleaning kosong."
            );

        }


        /* ===================================================
           FILE CHANGE GUARD
        =================================================== */

        if (
            state.file !== sourceFile
        ) {

            console.info(
                "[GEN-Z.AI] Hasil cleaning dibatalkan karena file telah berubah."
            );

            return;

        }


        /* ===================================================
           SIMPAN BLOB
        =================================================== */

        state.cleanedBlob =
            cleanedBlob;


        console.info(
            "[GEN-Z.AI] Cleaned Blob berhasil dibuat.",
            {
                size:
                    cleanedBlob.size,

                type:
                    cleanedBlob.type
            }
        );


        /* ===================================================
           RENDER CLEANED PREVIEW
           ---------------------------------------------------
           IMPORTANT:

           HANYA kirim Blob.

           Jangan:

               URL.createObjectURL()

           di sini.

           metadata-preview.js akan membuat Object URL
           dan menyimpannya ke state.cleanedURL.
        =================================================== */

        const previewResult =
            renderCleanedPreview(
                cleanedBlob
            );


        /* ===================================================
           VALIDASI PREVIEW
        =================================================== */

        if (
            previewResult === false
        ) {

            throw new Error(
                "Preview hasil cleaning gagal ditampilkan."
            );

        }


        /* ===================================================
           FILE CHANGE GUARD
        =================================================== */

        if (
            state.file !== sourceFile
        ) {

            console.info(
                "[GEN-Z.AI] Preview cleaning lama diabaikan karena file telah berubah."
            );

            return;

        }


        /* ===================================================
           VALIDASI CLEANED URL
           ---------------------------------------------------
           URL seharusnya sekarang dibuat oleh
           metadata-preview.js.
        =================================================== */

        if (
            !state.cleanedURL
        ) {

            console.warn(
                "[GEN-Z.AI] Cleaned Blob tersedia tetapi cleanedURL belum tersedia."
            );

        }


        /* ===================================================
           SHOW CLEAN RESULT
        =================================================== */

        if (
            elements.cleanResult
        ) {

            showElement(
                elements.cleanResult
            );

        }


        /* ===================================================
           ENABLE DOWNLOAD
        =================================================== */

        if (
            elements.downloadButton &&
            state.cleanedBlob
        ) {

            elements.downloadButton.disabled =
                false;

        }


        /* ===================================================
           SUCCESS STATUS
        =================================================== */

        setPreviewStatus(
            "METADATA CLEANING SELESAI. HASIL ADALAH FILE BARU."
        );


        /* ===================================================
           SUCCESS LOG
        =================================================== */

        console.info(
            "[GEN-Z.AI] Metadata cleaning berhasil.",
            {
                type:
                    sourceFileType,

                originalName:
                    sourceFile.name,

                originalSize:
                    sourceFile.size,

                cleanedSize:
                    cleanedBlob.size,

                cleanedType:
                    cleanedBlob.type,

                cleanedURL:
                    state.cleanedURL || null
            }
        );


    } catch (
        error
    ) {

        /* ===================================================
           FILE CHANGE GUARD
        =================================================== */

        if (
            state.file !== sourceFile
        ) {

            console.info(
                "[GEN-Z.AI] Error cleaning file lama diabaikan karena file telah berubah."
            );

            return;

        }


        /* ===================================================
           LOG ERROR
        =================================================== */

        console.error(
            "[GEN-Z.AI] Metadata cleaning failed:",
            error
        );


        /* ===================================================
           RESET STATE
        =================================================== */

        state.cleanedBlob =
            null;


        try {

            clearCleanedPreview();

        } catch (
            clearError
        ) {

            console.warn(
                "[GEN-Z.AI] Gagal membersihkan preview setelah error:",
                clearError
            );

        }


        /* ===================================================
           HIDE RESULT
        =================================================== */

        if (
            elements.cleanResult
        ) {

            hideElement(
                elements.cleanResult
            );

        }


        /* ===================================================
           DISABLE DOWNLOAD
        =================================================== */

        if (
            elements.downloadButton
        ) {

            elements.downloadButton.disabled =
                true;

        }


        /* ===================================================
           ERROR STATUS
        =================================================== */

        setPreviewStatus(
            `CLEANING GAGAL: ${getReadableError(error)}`
        );

    }


    /* =======================================================
       FINALLY
    ======================================================= */

    finally {

        /*
           Jangan menyentuh lifecycle file baru.
        */

        if (
            state.file === sourceFile
        ) {

            state.cleaning =
                false;


            if (
                elements.cleanButton
            ) {

                elements.cleanButton.disabled =
                    false;


                elements.cleanButton.removeAttribute(
                    "data-processing"
                );

            }

        }

    }

}


/* =========================================================
   PREVIEW STATUS
========================================================= */

function setPreviewStatus(
    text
) {

    const status =
        elements?.previewStatus;


    if (
        !status
    ) {

        return;

    }


    status.textContent =
        String(
            text ?? ""
        );

}


/* =========================================================
   READABLE ERROR
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

        return (
            error.message ||
            "Terjadi kesalahan yang tidak diketahui."
        );

    }


    if (
        typeof error === "object"
    ) {

        if (
            typeof error.message === "string" &&
            error.message.trim()
        ) {

            return error.message;

        }


        if (
            typeof error.error === "string" &&
            error.error.trim()
        ) {

            return error.error;

        }


        if (
            typeof error.details === "string" &&
            error.details.trim()
        ) {

            return error.details;

        }


        try {

            return JSON.stringify(
                error
            );

        } catch (
            stringifyError
        ) {

            return "Terjadi kesalahan yang tidak diketahui.";

        }

    }


    return String(
        error
    );

}
