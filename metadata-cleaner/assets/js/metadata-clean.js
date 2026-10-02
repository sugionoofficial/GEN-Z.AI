/* =========================================================
   GEN-Z.AI
   AI METADATA CLEANER
   ---------------------------------------------------------
   File:
   metadata-cleaner/assets/js/metadata-clean.js

   Fungsi:
   - Membersihkan metadata image / video
   - Menyimpan hasil sebagai Blob baru
   - Menampilkan preview hasil cleaning
   - Menampilkan result panel
   - Mengaktifkan DOWNLOAD
   - Loading state
   - Race protection
   - Error handling

   CATATAN:
   - File asli tidak diubah
   - Cleaner berjalan lokal
   - metadata-preview.js menerima Blob/File
   - Module ini TIDAK membuat Object URL sendiri

   PENTING:
   - cleanImage berasal dari metadata-cleaner-image.js
   - cleanVideo berasal dari metadata-cleaner-video.js
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
   CHECK ERROR HELPER
========================================================= */

import {
    getReadableError
} from "./metadata-check.js";


/* =========================================================
   LOCAL HELPERS
========================================================= */

function setPreviewStatus(
    message
) {

    const element =
        document.getElementById(
            "metadata-preview-status"
        );


    if (
        !element
    ) {

        return;

    }


    element.textContent =
        String(
            message || ""
        );


    element.hidden =
        false;


    element.removeAttribute(
        "hidden"
    );


    element.classList.remove(
        "hidden"
    );


    element.style.removeProperty(
        "display"
    );


    element.style.setProperty(
        "visibility",
        "visible",
        "important"
    );


    element.style.setProperty(
        "opacity",
        "1",
        "important"
    );

}


/* =========================================================
   CLEANING LOADING STATE
========================================================= */

function setCleaningLoading(
    active
) {

    const button =
        elements?.cleanButton ||
        document.getElementById(
            "metadata-clean-button"
        );


    if (
        !button
    ) {

        return;

    }


    if (
        active
    ) {

        button.disabled =
            true;


        button.setAttribute(
            "disabled",
            "disabled"
        );


        button.setAttribute(
            "aria-busy",
            "true"
        );


        button.setAttribute(
            "aria-disabled",
            "true"
        );


        button.classList.add(
            "loading",
            "is-loading",
            "processing"
        );


        /*
           Jangan mengganti innerHTML tombol.
           Spinner / label asli tetap dipertahankan.
        */

        return;

    }


    button.classList.remove(
        "loading",
        "is-loading",
        "processing"
    );


    button.removeAttribute(
        "aria-busy"
    );


    button.setAttribute(
        "aria-disabled",
        "false"
    );

}


/* =========================================================
   HIDE CLEAN RESULT
========================================================= */

function hideCleanResult() {

    const result =
        elements?.cleanResult ||
        document.getElementById(
            "metadata-clean-result"
        );


    if (
        !result
    ) {

        return;

    }


    result.hidden =
        true;


    result.setAttribute(
        "hidden",
        "hidden"
    );


    result.classList.add(
        "hidden"
    );


    result.style.setProperty(
        "display",
        "none",
        "important"
    );


    result.style.setProperty(
        "visibility",
        "hidden",
        "important"
    );


    result.style.setProperty(
        "opacity",
        "0",
        "important"
    );

}


/* =========================================================
   SHOW CLEAN RESULT
========================================================= */

function showCleanResult() {

    const result =
        elements?.cleanResult ||
        document.getElementById(
            "metadata-clean-result"
        );


    if (
        !result
    ) {

        console.error(
            "[GEN-Z.AI][CLEAN] #metadata-clean-result tidak ditemukan."
        );


        return false;

    }


    /*
       Lepaskan SEMUA mekanisme hidden.
    */

    result.hidden =
        false;


    result.removeAttribute(
        "hidden"
    );


    result.classList.remove(
        "hidden"
    );


    result.style.removeProperty(
        "display"
    );


    result.style.removeProperty(
        "visibility"
    );


    result.style.removeProperty(
        "opacity"
    );


    result.style.setProperty(
        "display",
        "block",
        "important"
    );


    result.style.setProperty(
        "visibility",
        "visible",
        "important"
    );


    result.style.setProperty(
        "opacity",
        "1",
        "important"
    );


    console.info(
        "[GEN-Z.AI][CLEAN] Clean result ditampilkan.",
        {
            hidden:
                result.hidden,

            hiddenClass:
                result.classList.contains(
                    "hidden"
                ),

            display:
                getComputedStyle(
                    result
                ).display,

            visibility:
                getComputedStyle(
                    result
                ).visibility,

            opacity:
                getComputedStyle(
                    result
                ).opacity
        }
    );


    return true;

}


/* =========================================================
   DISABLE DOWNLOAD
========================================================= */

function disableDownload() {

    const button =
        elements?.downloadButton ||
        document.getElementById(
            "metadata-download-button"
        );


    if (
        !button
    ) {

        return;

    }


    button.disabled =
        true;


    button.setAttribute(
        "disabled",
        "disabled"
    );


    button.hidden =
        false;


    button.removeAttribute(
        "hidden"
    );


    button.classList.remove(
        "hidden"
    );


    button.setAttribute(
        "aria-disabled",
        "true"
    );


    /*
       Download row tetap boleh ada.
       Hanya tombolnya yang disabled.
    */

}


/* =========================================================
   ENABLE DOWNLOAD
========================================================= */

function enableDownload() {

    const button =
        elements?.downloadButton ||
        document.getElementById(
            "metadata-download-button"
        );


    if (
        !button
    ) {

        console.error(
            "[GEN-Z.AI][CLEAN] #metadata-download-button tidak ditemukan."
        );


        return false;

    }


    button.disabled =
        false;


    button.removeAttribute(
        "disabled"
    );


    button.hidden =
        false;


    button.removeAttribute(
        "hidden"
    );


    button.classList.remove(
        "hidden",
        "disabled"
    );


    button.style.removeProperty(
        "display"
    );


    button.style.removeProperty(
        "visibility"
    );


    button.style.removeProperty(
        "opacity"
    );


    button.style.setProperty(
        "display",
        "inline-flex",
        "important"
    );


    button.style.setProperty(
        "visibility",
        "visible",
        "important"
    );


    button.style.setProperty(
        "opacity",
        "1",
        "important"
    );


    button.setAttribute(
        "aria-disabled",
        "false"
    );


    console.info(
        "[GEN-Z.AI][CLEAN] DOWNLOAD aktif.",
        {
            disabled:
                button.disabled,

            hidden:
                button.hidden,

            hiddenClass:
                button.classList.contains(
                    "hidden"
                ),

            display:
                getComputedStyle(
                    button
                ).display
        }
    );


    return true;

}


/* =========================================================
   RESET CLEAN PREVIEW ELEMENTS
========================================================= */

function resetCleanPreviewElements() {

    const image =
        elements?.cleanImagePreview ||
        document.getElementById(
            "metadata-clean-image-preview"
        );


    const video =
        elements?.cleanVideoPreview ||
        document.getElementById(
            "metadata-clean-video-preview"
        );


    if (
        image
    ) {

        image.onload =
            null;


        image.onerror =
            null;


        image.removeAttribute(
            "src"
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

            /* ignore */

        }


        video.removeAttribute(
            "src"
        );


        try {

            video.load();

        } catch (
            error
        ) {

            /* ignore */

        }


        hideElement(
            video
        );

    }

}


/* =========================================================
   NORMALIZE CLEAN RESULT
========================================================= */

function normalizeCleanResult(
    result
) {

    if (
        result instanceof Blob
    ) {

        return result;

    }


    if (
        result &&
        result.blob instanceof Blob
    ) {

        return result.blob;

    }


    if (
        result &&
        result.file instanceof Blob
    ) {

        return result.file;

    }


    if (
        result &&
        result.output instanceof Blob
    ) {

        return result.output;

    }


    return null;

}


/* =========================================================
   VALIDATE CLEANED BLOB
========================================================= */

function validateCleanedBlob(
    blob
) {

    if (
        !(blob instanceof Blob)
    ) {

        throw new Error(
            "Cleaner tidak menghasilkan Blob."
        );

    }


    if (
        !blob.size ||
        blob.size <= 0
    ) {

        throw new Error(
            "File hasil cleaning kosong."
        );

    }


    return true;

}


/* =========================================================
   CLEAN METADATA
========================================================= */

export async function cleanMetadata() {

    /*
       Pastikan state dan element tersedia.
    */

    const sourceFile =
        state?.file;


    if (
        !sourceFile
    ) {

        setPreviewStatus(
            "BELUM ADA MEDIA."
        );


        return false;

    }


    if (
        state.cleaning
    ) {

        console.warn(
            "[GEN-Z.AI][CLEAN] Cleaning masih berjalan."
        );


        return false;

    }


    const sourceType =
        String(
            sourceFile.type ||
            state.fileType ||
            ""
        ).toLowerCase();


    const isImage =
        sourceType.startsWith(
            "image/"
        );


    const isVideo =
        sourceType.startsWith(
            "video/"
        );


    if (
        !isImage &&
        !isVideo
    ) {

        setPreviewStatus(
            "FORMAT MEDIA TIDAK DIDUKUNG."
        );


        return false;

    }


    /*
       Simpan referensi file untuk race protection.
    */

    const cleaningFile =
        sourceFile;


    state.cleaning =
        true;


    /*
       Bersihkan hasil lama.
    */

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
                "[GEN-Z.AI][CLEAN] Gagal revoke cleaned URL lama.",
                error
            );

        }

    }


    state.cleanedURL =
        null;


    state.cleanedPreviewUrl =
        null;


    resetCleanPreviewElements();


    hideCleanResult();


    disableDownload();


    setCleaningLoading(
        true
    );


    setPreviewStatus(
        "MEMBERSIHKAN METADATA SECARA LOKAL..."
    );


    console.info(
        "[GEN-Z.AI][CLEAN] Cleaning dimulai:",
        {
            name:
                cleaningFile.name,

            type:
                cleaningFile.type,

            size:
                cleaningFile.size,

            mode:
                isImage
                    ? "IMAGE"
                    : "VIDEO"
        }
    );


    try {

        let rawResult;


        /* =====================================================
           IMAGE CLEANER
        ===================================================== */

        if (
            isImage
        ) {

            rawResult =
                await cleanImage(
                    cleaningFile
                );

        }


        /* =====================================================
           VIDEO CLEANER
        ===================================================== */

        else {

            rawResult =
                await cleanVideo(
                    cleaningFile
                );

        }


        console.info(
            "[GEN-Z.AI][CLEAN] Raw cleaner result:",
            rawResult
        );


        /*
           Pastikan user belum mengganti file
           ketika proses berlangsung.
        */

        if (
            state.file !==
            cleaningFile
        ) {

            console.warn(
                "[GEN-Z.AI][CLEAN] File berubah selama cleaning. Hasil dibuang."
            );


            return false;

        }


        const cleanedBlob =
            normalizeCleanResult(
                rawResult
            );


        validateCleanedBlob(
            cleanedBlob
        );


        /*
           Simpan Blob hasil.
        */

        state.cleanedBlob =
            cleanedBlob;


        /*
           PENTING:
           Jangan membuat Object URL di module ini.

           renderCleanedPreview() yang bertanggung
           jawab membuat dan menyimpan Object URL.
        */

        const previewRendered =
            await renderCleanedPreview(
                cleanedBlob
            );


        /*
           Race protection kedua.
        */

        if (
            state.file !==
            cleaningFile
        ) {

            console.warn(
                "[GEN-Z.AI][CLEAN] File berubah setelah preview. Hasil dibuang."
            );


            return false;

        }


        if (
            previewRendered === false
        ) {

            throw new Error(
                "Preview hasil cleaning gagal ditampilkan."
            );

        }


        /*
           Tampilkan result panel.
        */

        if (
            !showCleanResult()
        ) {

            throw new Error(
                "Panel hasil cleaning tidak ditemukan."
            );

        }


        /*
           Aktifkan download.
        */

        if (
            !enableDownload()
        ) {

            throw new Error(
                "Tombol download tidak ditemukan."
            );

        }


        /*
           Status sukses.
        */

        setPreviewStatus(
            "METADATA CLEANING SELESAI. HASIL ADALAH FILE BARU."
        );


        console.info(
            "[GEN-Z.AI][CLEAN] METADATA CLEANING SELESAI.",
            {
                originalName:
                    cleaningFile.name,

                originalType:
                    cleaningFile.type,

                originalSize:
                    cleaningFile.size,

                cleanedType:
                    cleanedBlob.type,

                cleanedSize:
                    cleanedBlob.size,

                previewURL:
                    state.cleanedURL ||
                    state.cleanedPreviewUrl ||
                    null
            }
        );


        return true;

    } catch (
        error
    ) {

        console.error(
            "[GEN-Z.AI][CLEAN] Cleaning gagal:",
            error
        );


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
                revokeError
            ) {

                console.warn(
                    "[GEN-Z.AI][CLEAN] Revoke URL gagal.",
                    revokeError
                );

            }

        }


        state.cleanedURL =
            null;


        state.cleanedPreviewUrl =
            null;


        resetCleanPreviewElements();


        hideCleanResult();


        disableDownload();


        const readable =
            getReadableError(
                error
            );


        setPreviewStatus(
            `CLEANING GAGAL: ${readable}`
        );


        return false;

    } finally {

        state.cleaning =
            false;


        setCleaningLoading(
            false
        );


        /*
           Jangan mengaktifkan CLEAN di sini
           secara membabi buta.

           Hanya aktif jika file masih sama.
        */

        if (
            state.file ===
            cleaningFile
        ) {

            const cleanButton =
                elements?.cleanButton ||
                document.getElementById(
                    "metadata-clean-button"
                );


            if (
                cleanButton
            ) {

                cleanButton.disabled =
                    false;


                cleanButton.removeAttribute(
                    "disabled"
                );


                cleanButton.setAttribute(
                    "aria-disabled",
                    "false"
                );

            }

        }

    }

}


/* =========================================================
   PUBLIC API
========================================================= */

export {
    setCleaningLoading,
    showCleanResult,
    hideCleanResult,
    enableDownload,
    disableDownload
};
