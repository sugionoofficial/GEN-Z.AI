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
========================================================= */


import {
    state
} from "./metadata-state.js";


import {
    elements
} from "./metadata-dom.js";


import {
    cleanImage
} from "./metadata-cleaner-image.js";


import {
    cleanVideo
} from "./metadata-cleaner-video.js";


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

    if (
        !state.file ||
        state.cleaning
    ) {

        return;
    }


    /*
     * Simpan referensi file yang sedang diproses.
     *
     * Ini penting apabila user mengganti file
     * ketika proses cleaning masih berjalan.
     */

    const sourceFile =
        state.file;


    state.cleaning =
        true;


    elements.cleanButton.disabled =
        true;


    elements.downloadButton.disabled =
        true;


    /*
     * Hapus hasil cleaning sebelumnya sebelum
     * memulai proses baru.
     */

    state.cleanedBlob =
        null;


    if (
        state.cleanedURL
    ) {

        URL.revokeObjectURL(
            state.cleanedURL
        );


        state.cleanedURL =
            null;
    }


    hideElement(
        elements.cleanResult
    );


    if (
        elements.cleanImagePreview
    ) {

        elements.cleanImagePreview.src =
            "";
    }


    if (
        elements.cleanVideoPreview
    ) {

        elements.cleanVideoPreview.pause();


        elements.cleanVideoPreview.removeAttribute(
            "src"
        );


        elements.cleanVideoPreview.load();

    }


    setPreviewStatus(
        "MEMBERSIHKAN METADATA SECARA LOKAL..."
    );


    try {

        let result;


        /*
         * Image
         */

        if (
            state.fileType === "image"
        ) {

            result =
                await cleanImage(
                    sourceFile
                );

        }


        /*
         * Video
         */

        else {

            result =
                await cleanVideo(
                    sourceFile
                );

        }


        /*
         * User mungkin sudah memilih file baru
         * ketika proses asynchronous masih berjalan.
         *
         * Jangan pernah menempelkan hasil file lama
         * ke file baru.
         */

        if (
            state.file !== sourceFile
        ) {

            return;
        }


        /*
         * Pastikan hasil cleaning benar-benar
         * menghasilkan Blob.
         */

        if (
            !result ||
            !result.blob
        ) {

            throw new Error(
                "File hasil cleaning tidak tersedia."
            );
        }


        state.cleanedBlob =
            result.blob;


        /*
         * Pastikan object URL lama benar-benar
         * sudah dilepas sebelum membuat yang baru.
         */

        if (
            state.cleanedURL
        ) {

            URL.revokeObjectURL(
                state.cleanedURL
            );


            state.cleanedURL =
                null;
        }


        /*
         * Buat Object URL hasil cleaning.
         */

        state.cleanedURL =
            URL.createObjectURL(
                state.cleanedBlob
            );


        /*
         * Tampilkan hasil cleaning.
         */

        renderCleanedPreview(
            state.cleanedURL
        );


        showElement(
            elements.cleanResult
        );


        /*
         * Hasil sudah tersedia,
         * DOWNLOAD sekarang boleh digunakan.
         */

        elements.downloadButton.disabled =
            false;


        setPreviewStatus(
            "METADATA CLEANING SELESAI. HASIL ADALAH FILE BARU."
        );

    } catch (
        error
    ) {

        /*
         * Jika user sudah mengganti file,
         * jangan menimpa status file baru
         * dengan error dari proses lama.
         */

        if (
            state.file !== sourceFile
        ) {

            return;
        }


        console.error(
            "[GEN-Z.AI] Metadata cleaning failed:",
            error
        );


        state.cleanedBlob =
            null;


        if (
            state.cleanedURL
        ) {

            URL.revokeObjectURL(
                state.cleanedURL
            );


            state.cleanedURL =
                null;
        }


        hideElement(
            elements.cleanResult
        );


        elements.downloadButton.disabled =
            true;


        setPreviewStatus(
            `CLEANING GAGAL: ${getReadableError(error)}`
        );

    } finally {

        /*
         * Hanya ubah state tombol jika proses ini
         * masih merupakan file yang aktif.
         */

        if (
            state.file === sourceFile
        ) {

            state.cleaning =
                false;


            elements.cleanButton.disabled =
                false;

        }

    }

}


/* =========================================================
   PREVIEW STATUS
   ---------------------------------------------------------
   Dipertahankan lokal di modul ini agar coordinator
   metadata-app.js tidak perlu membawa implementasi
   cleaning tambahan.
========================================================= */

function setPreviewStatus(
    text
) {

    if (
        elements.previewStatus
    ) {

        elements.previewStatus.textContent =
            text;
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
