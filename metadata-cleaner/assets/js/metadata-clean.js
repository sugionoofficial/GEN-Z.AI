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
    hideElement
} from "./metadata-preview.js";


/* =========================================================
   CLEAN METADATA
   ---------------------------------------------------------
   Membuat file hasil baru secara lokal.

   File asli tidak pernah dimodifikasi.
========================================================= */

export async function cleanMetadata() {

    /* -------------------------------------------------------
       VALIDASI FILE
    ------------------------------------------------------- */

    if (
        !state.file
    ) {

        console.warn(
            "[GEN-Z.AI] Cleaning dibatalkan: tidak ada file aktif."
        );

        return;
    }


    /* -------------------------------------------------------
       CEGAH CLEANING GANDA
    ------------------------------------------------------- */

    if (
        state.cleaning
    ) {

        console.warn(
            "[GEN-Z.AI] Cleaning sedang berjalan."
        );

        return;
    }


    /* -------------------------------------------------------
       SIMPAN REFERENSI FILE AKTIF
       ------------------------------------------------------
       Sangat penting untuk proses asynchronous.

       Jika user mengganti file ketika cleaning berjalan,
       hasil file lama tidak boleh ditempel ke file baru.
    ------------------------------------------------------- */

    const sourceFile =
        state.file;


    const sourceFileType =
        state.fileType;


    /* -------------------------------------------------------
       LOCK CLEANING
    ------------------------------------------------------- */

    state.cleaning =
        true;


    /* -------------------------------------------------------
       LOCK BUTTON
    ------------------------------------------------------- */

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


    /* -------------------------------------------------------
       HAPUS HASIL CLEANING LAMA
    ------------------------------------------------------- */

    state.cleanedBlob =
        null;


    if (
        state.cleanedURL
    ) {

        try {

            URL.revokeObjectURL(
                state.cleanedURL
            );

        } catch (
            error
        ) {

            console.warn(
                "[GEN-Z.AI] Gagal revoke cleaned URL:",
                error
            );

        }


        state.cleanedURL =
            null;

    }


    /* -------------------------------------------------------
       HIDE CLEAN RESULT
    ------------------------------------------------------- */

    if (
        elements.cleanResult
    ) {

        hideElement(
            elements.cleanResult
        );

    }


    /* -------------------------------------------------------
       RESET CLEAN IMAGE PREVIEW
    ------------------------------------------------------- */

    if (
        elements.cleanImagePreview
    ) {

        elements.cleanImagePreview.removeAttribute(
            "src"
        );

        elements.cleanImagePreview.removeAttribute(
            "srcset"
        );

    }


    /* -------------------------------------------------------
       RESET CLEAN VIDEO PREVIEW
    ------------------------------------------------------- */

    if (
        elements.cleanVideoPreview
    ) {

        try {

            elements.cleanVideoPreview.pause();

        } catch (
            error
        ) {

            console.warn(
                "[GEN-Z.AI] Gagal pause clean video:",
                error
            );

        }


        elements.cleanVideoPreview.removeAttribute(
            "src"
        );


        /*
         * Jangan memanggil load() jika elemen video
         * belum memiliki source sebelumnya.
         *
         * Tetapi jika tersedia, tetap reset agar browser
         * benar-benar membuang media lama.
         */

        try {

            elements.cleanVideoPreview.load();

        } catch (
            error
        ) {

            console.warn(
                "[GEN-Z.AI] Gagal reset clean video:",
                error
            );

        }

    }


    /* -------------------------------------------------------
       STATUS
    ------------------------------------------------------- */

    setPreviewStatus(
        "MEMBERSIHKAN METADATA SECARA LOKAL..."
    );


    /* =======================================================
       PROCESS
    ======================================================= */

    try {

        let result = null;


        /* ---------------------------------------------------
           IMAGE
        --------------------------------------------------- */

        if (
            sourceFileType === "image"
        ) {

            result =
                await cleanImage(
                    sourceFile
                );

        }


        /* ---------------------------------------------------
           VIDEO
        --------------------------------------------------- */

        else if (
            sourceFileType === "video"
        ) {

            result =
                await cleanVideo(
                    sourceFile
                );

        }


        /* ---------------------------------------------------
           UNKNOWN FILE TYPE
        --------------------------------------------------- */

        else {

            throw new Error(
                "Jenis file tidak dikenali."
            );

        }


        /* ===================================================
           FILE CHANGE GUARD
           ---------------------------------------------------
           User mungkin mengganti file ketika proses async
           masih berjalan.
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
           Mendukung dua bentuk:

           A. Blob langsung
              cleanImage() -> Blob

           B. Object
              cleanImage() -> { blob: Blob }
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


        /* ---------------------------------------------------
           VALIDASI HASIL
        --------------------------------------------------- */

        if (
            !cleanedBlob
        ) {

            throw new Error(
                "File hasil cleaning tidak tersedia atau bukan Blob."
            );

        }


        /* ===================================================
           SECOND FILE CHANGE GUARD
           ---------------------------------------------------
           Perlindungan tambahan setelah normalisasi result.
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
           HAPUS CLEANED URL LAMA
        =================================================== */

        if (
            state.cleanedURL
        ) {

            try {

                URL.revokeObjectURL(
                    state.cleanedURL
                );

            } catch (
                error
            ) {

                console.warn(
                    "[GEN-Z.AI] Gagal revoke cleaned URL lama:",
                    error
                );

            }


            state.cleanedURL =
                null;

        }


        /* ===================================================
           CREATE OBJECT URL
        =================================================== */

        state.cleanedURL =
            URL.createObjectURL(
                state.cleanedBlob
            );


        /* ===================================================
           VALIDASI OBJECT URL
        =================================================== */

        if (
            !state.cleanedURL
        ) {

            throw new Error(
                "Object URL hasil cleaning gagal dibuat."
            );

        }


        /* ===================================================
           RENDER CLEANED PREVIEW
        =================================================== */

        renderCleanedPreview(
            state.cleanedURL
        );


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


        console.info(
            "[GEN-Z.AI] Metadata cleaning berhasil.",
            {
                type: sourceFileType,
                originalName: sourceFile.name,
                originalSize: sourceFile.size,
                cleanedSize: state.cleanedBlob.size,
                cleanedType: state.cleanedBlob.type
            }
        );


    } catch (
        error
    ) {

        /* ===================================================
           FILE CHANGE GUARD
           ---------------------------------------------------
           Error dari proses file lama tidak boleh mengubah
           UI file baru.
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


        /* ---------------------------------------------------
           REVOKE CLEANED URL
        --------------------------------------------------- */

        if (
            state.cleanedURL
        ) {

            try {

                URL.revokeObjectURL(
                    state.cleanedURL
                );

            } catch (
                revokeError
            ) {

                console.warn(
                    "[GEN-Z.AI] Gagal revoke cleaned URL setelah error:",
                    revokeError
                );

            }


            state.cleanedURL =
                null;

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
       -------------------------------------------------------
       Hanya reset state jika file yang sedang diproses
       masih merupakan file aktif.

       Jika user sudah memilih file baru, file baru memiliki
       lifecycle sendiri dan tidak boleh disentuh proses lama.
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

            }

        }

    }

}


/* =========================================================
   PREVIEW STATUS
   ---------------------------------------------------------
   Lokal di modul ini agar metadata-app.js tidak perlu
   membawa implementasi cleaning tambahan.
========================================================= */

function setPreviewStatus(
    text
) {

    if (
        !elements.previewStatus
    ) {

        return;

    }


    elements.previewStatus.textContent =
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

        /*
         * Beberapa library mengembalikan:
         *
         * { message: "..." }
         *
         * atau:
         *
         * { error: "..." }
         */

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
