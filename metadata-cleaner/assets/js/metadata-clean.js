/* =========================================================
   GEN-Z.AI
   AI METADATA CLEANER
   ---------------------------------------------------------
   File:
   metadata-cleaner/assets/js/metadata-clean.js

   Fungsi:
   - Membersihkan metadata image
   - Membersihkan metadata video
   - Membuat cleaned Blob
   - Membuat cleaned Object URL
   - Render preview hasil cleaning
   - Menjaga hasil async agar tidak menimpa file baru

   Catatan:
   - File asli tidak pernah dimodifikasi
   - Image cleaning tetap menggunakan cleanImage()
   - Video cleaning tetap menggunakan cleanVideo()
   - Tidak menghitung ulang metadata
   - Tidak mengubah state file aktif
   - Mendukung hasil cleaner berupa:
       1. Blob langsung
       2. { blob: Blob }

   IMPORTANT:
   - renderCleanedPreview() menerima Blob.
   - Object URL cleaned dibuat dan disimpan di state.cleanedURL.
   - Tidak mengirim Object URL ke renderCleanedPreview().
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
   ---------------------------------------------------------
   Membuat file hasil baru secara lokal.

   File asli tidak pernah dimodifikasi.
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
       SIMPAN REFERENSI FILE AKTIF
       -------------------------------------------------------
       Sangat penting untuk proses asynchronous.
    ======================================================= */

    const sourceFile =
        state.file;


    const sourceFileType =
        String(
            state.fileType || ""
        ).toLowerCase();


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
       cleanedURL adalah nama state yang digunakan
       oleh modul cleaning/download.
    */

    revokeCleanedUrl();


    /*
       Jika preview module menyediakan helper,
       gunakan helper tersebut untuk membersihkan
       preview lama.
    */

    try {

        if (
            typeof clearCleanedPreview === "function"
        ) {

            clearCleanedPreview();

        } else {

            resetCleanPreviewElements();

        }

    } catch (
        error
    ) {

        console.warn(
            "[GEN-Z.AI] Gagal membersihkan preview hasil lama:",
            error
        );

        resetCleanPreviewElements();

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
        "[GEN-Z.AI] Metadata cleaning dimulai.",
        {
            name: sourceFile.name,
            type: sourceFileType,
            size: sourceFile.size
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
                "[GEN-Z.AI] Cleaning image..."
            );


            result =
                await cleanImage(
                    sourceFile
                );

        }


        /* ===================================================
           VIDEO
        =================================================== */

        else if (
            sourceFileType === "video"
        ) {

            console.info(
                "[GEN-Z.AI] Cleaning video..."
            );


            result =
                await cleanVideo(
                    sourceFile
                );

        }


        /* ===================================================
           UNKNOWN FILE TYPE
        =================================================== */

        else {

            throw new Error(
                "Jenis file tidak dikenali."
            );

        }


        /* ===================================================
           FILE CHANGE GUARD
        =================================================== */

        if (
            state.file !== sourceFile
        ) {

            console.info(
                "[GEN-Z.AI] Cleaning lama diabaikan karena file telah berubah."
            );

            return;

        }


        /* ===================================================
           NORMALIZE CLEANER RESULT
           ---------------------------------------------------
           Bentuk yang didukung:

           1. Blob

              cleanImage()
              → Blob

           2. Object

              cleanImage()
              → { blob: Blob }
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
           VALIDASI HASIL
        =================================================== */

        if (
            !cleanedBlob
        ) {

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
           SECOND FILE CHANGE GUARD
        =================================================== */

        if (
            state.file !== sourceFile
        ) {

            console.info(
                "[GEN-Z.AI] Hasil cleaning diabaikan karena file telah berubah."
            );

            return;

        }


        /* ===================================================
           SIMPAN CLEANED BLOB
        =================================================== */

        state.cleanedBlob =
            cleanedBlob;


        /* ===================================================
           BUAT OBJECT URL
        =================================================== */

        state.cleanedURL =
            URL.createObjectURL(
                cleanedBlob
            );


        if (
            !state.cleanedURL
        ) {

            throw new Error(
                "Object URL hasil cleaning gagal dibuat."
            );

        }


        /* ===================================================
           SYNC ALIAS
           ---------------------------------------------------
           Jika metadata-preview / modul lain menggunakan
           cleanedPreviewUrl, sinkronkan juga.
        =================================================== */

        if (
            Object.prototype.hasOwnProperty.call(
                state,
                "cleanedPreviewUrl"
            )
        ) {

            state.cleanedPreviewUrl =
                state.cleanedURL;

        }


        /* ===================================================
           THIRD FILE CHANGE GUARD
        =================================================== */

        if (
            state.file !== sourceFile
        ) {

            /*
               File berubah setelah URL dibuat.
               Jangan biarkan URL menggantung.
            */

            revokeCleanedUrl();

            state.cleanedBlob =
                null;

            return;

        }


        /* ===================================================
           RENDER CLEANED PREVIEW
           ---------------------------------------------------
           IMPORTANT:

           renderCleanedPreview() menerima Blob,
           BUKAN Object URL.

           Jangan gunakan:

               renderCleanedPreview(state.cleanedURL)

           Gunakan:

               renderCleanedPreview(cleanedBlob)
        =================================================== */

        const rendered =
            renderCleanedPreview(
                cleanedBlob,
                sourceFileType === "image"
                    ? "image"
                    : "video"
            );


        if (
            rendered === false
        ) {

            throw new Error(
                "Preview hasil cleaning gagal ditampilkan."
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
            elements.downloadButton
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
                    state.cleanedURL
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
                "[GEN-Z.AI] Error cleaning lama diabaikan karena file telah berubah."
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
           RESET CLEANED STATE
        =================================================== */

        state.cleanedBlob =
            null;


        revokeCleanedUrl();


        /* ===================================================
           HIDE CLEAN RESULT
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
       -------------------------------------------------------
       Hanya reset lifecycle jika file yang diproses
       masih merupakan file aktif.
    ======================================================= */

    finally {

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
   REVOKE CLEANED URL
========================================================= */

function revokeCleanedUrl() {

    /*
       cleanedURL adalah URL utama yang digunakan
       metadata-clean.js / metadata-download.js.
    */

    const url =
        state?.cleanedURL;


    if (
        url
    ) {

        try {

            URL.revokeObjectURL(
                url
            );

        } catch (
            error
        ) {

            console.warn(
                "[GEN-Z.AI] Gagal revoke cleaned URL:",
                error
            );

        }

    }


    /*
       Jika terdapat alias berbeda,
       jangan revoke URL yang sama dua kali.
    */

    const previewUrl =
        state?.cleanedPreviewUrl;


    if (
        previewUrl &&
        previewUrl !== url
    ) {

        try {

            URL.revokeObjectURL(
                previewUrl
            );

        } catch (
            error
        ) {

            console.warn(
                "[GEN-Z.AI] Gagal revoke cleaned preview URL:",
                error
            );

        }

    }


    if (
        state
    ) {

        state.cleanedURL =
            null;


        if (
            Object.prototype.hasOwnProperty.call(
                state,
                "cleanedPreviewUrl"
            )
        ) {

            state.cleanedPreviewUrl =
                null;

        }

    }

}


/* =========================================================
   RESET CLEAN PREVIEW ELEMENTS
   ---------------------------------------------------------
   Fallback jika helper preview tidak tersedia.
========================================================= */

function resetCleanPreviewElements() {

    const image =
        elements?.cleanImagePreview;


    const video =
        elements?.cleanVideoPreview;


    if (
        image
    ) {

        image.removeAttribute(
            "src"
        );


        image.removeAttribute(
            "srcset"
        );


        image.style.removeProperty(
            "width"
        );


        image.style.removeProperty(
            "height"
        );


        hideElement(
            image
        );

    }


    if (
        video
    ) {

        try {

            video.pause();

        } catch (
            error
        ) {

            console.warn(
                "[GEN-Z.AI] Gagal pause cleaned video:",
                error
            );

        }


        video.removeAttribute(
            "src"
        );


        try {

            video.load();

        } catch (
            error
        ) {

            console.warn(
                "[GEN-Z.AI] Gagal reset cleaned video:",
                error
            );

        }


        video.style.removeProperty(
            "width"
        );


        video.style.removeProperty(
            "height"
        );


        hideElement(
            video
        );

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


    /*
       Jangan memaksa display di sini.
       metadata-preview.js yang mengontrol
       visibility status secara global.
    */

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
