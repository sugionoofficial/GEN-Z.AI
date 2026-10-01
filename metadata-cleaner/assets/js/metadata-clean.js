/* =========================================================
   GEN-Z.AI
   AI METADATA CLEANER
   ---------------------------------------------------------
   File:
   metadata-cleaner/assets/js/metadata-clean.js

   Tanggung jawab:
   - Menjalankan proses cleaning metadata
   - Menampilkan loading/status
   - Menyimpan cleaned Blob
   - Menampilkan preview hasil
   - Menampilkan tombol download
   - Menangani error cleaning
   - Tidak menghitung ulang credit
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
    clearCleanedPreview,
    showElement,
    hideElement,
    setPreviewStatus
} from "./metadata-preview.js";


/* =========================================================
   LOCAL STATUS HELPERS
========================================================= */

function setCleaningStatus(
    title,
    description
) {

    const indicator =
        elements?.statusIndicator ||
        document.getElementById(
            "metadata-status-indicator"
        );


    const statusTitle =
        elements?.statusTitle ||
        document.getElementById(
            "metadata-status-title"
        );


    const statusDescription =
        elements?.statusDescription ||
        document.getElementById(
            "metadata-status-description"
        );


    if (
        statusTitle
    ) {

        statusTitle.textContent =
            String(
                title || ""
            );

    }


    if (
        statusDescription
    ) {

        statusDescription.textContent =
            String(
                description || ""
            );

    }


    if (
        indicator
    ) {

        indicator.classList.remove(
            "success",
            "error",
            "warning",
            "processing",
            "active"
        );


        if (
            /gagal|error/i.test(
                String(
                    title || ""
                )
            )
        ) {

            indicator.classList.add(
                "error"
            );

        } else if (
            /selesai|berhasil|dibersihkan/i.test(
                String(
                    title || ""
                )
            )
        ) {

            indicator.classList.add(
                "success"
            );

        } else {

            indicator.classList.add(
                "processing"
            );

        }

    }

}


/* =========================================================
   DISABLE / ENABLE BUTTONS
========================================================= */

function setCleaningButtons(
    cleaning
) {

    const cleanButton =
        elements?.cleanButton ||
        document.getElementById(
            "metadata-clean-button"
        );


    const checkButton =
        elements?.checkButton ||
        document.getElementById(
            "metadata-check-button"
        );


    const downloadButton =
        elements?.downloadButton ||
        document.getElementById(
            "metadata-download-button"
        );


    if (
        cleanButton
    ) {

        cleanButton.disabled =
            Boolean(
                cleaning
            );


        if (
            cleaning
        ) {

            cleanButton.setAttribute(
                "aria-busy",
                "true"
            );

        } else {

            cleanButton.removeAttribute(
                "aria-busy"
            );

        }

    }


    if (
        checkButton
    ) {

        checkButton.disabled =
            Boolean(
                cleaning
            );

    }


    /*
       Download hanya aktif kalau cleanedBlob
       benar-benar tersedia.
    */

    if (
        downloadButton &&
        !state.cleanedBlob
    ) {

        downloadButton.disabled =
            true;

    }

}


/* =========================================================
   LOADING UI
   ---------------------------------------------------------
   Menggunakan loading yang sudah ada di halaman.
========================================================= */

function setCleaningLoading(
    active
) {

    const cleanButton =
        elements?.cleanButton ||
        document.getElementById(
            "metadata-clean-button"
        );


    if (
        !cleanButton
    ) {

        return;

    }


    if (
        active
    ) {

        cleanButton.classList.add(
            "loading",
            "is-loading",
            "processing"
        );


        cleanButton.setAttribute(
            "aria-busy",
            "true"
        );


        /*
           Jangan menghapus isi HTML button.
           Kalau button sudah memiliki spinner bawaan,
           spinner tersebut tetap digunakan.
        */

        cleanButton.dataset.cleaning =
            "true";

    } else {

        cleanButton.classList.remove(
            "loading",
            "is-loading",
            "processing"
        );


        cleanButton.removeAttribute(
            "aria-busy"
        );


        delete cleanButton.dataset.cleaning;

    }

}


/* =========================================================
   SHOW / HIDE CLEAN RESULT
========================================================= */

function showCleanResult() {

    const result =
        elements?.cleanResult ||
        document.getElementById(
            "metadata-clean-result"
        );


    if (
        result
    ) {

        result.hidden =
            false;


        result.style.removeProperty(
            "display"
        );


        /*
           Jika CSS menggunakan flex/block,
           biarkan CSS menentukan display.
        */

    }

}


function hideCleanResult() {

    const result =
        elements?.cleanResult ||
        document.getElementById(
            "metadata-clean-result"
        );


    if (
        result
    ) {

        result.hidden =
            true;


        result.style.display =
            "none";

    }

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

        console.warn(
            "[GEN-Z.AI] Tombol download tidak ditemukan."
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


    button.style.removeProperty(
        "display"
    );


    button.classList.remove(
        "disabled"
    );


    button.setAttribute(
        "aria-disabled",
        "false"
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


    button.setAttribute(
        "aria-disabled",
        "true"
    );

}


/* =========================================================
   NORMALIZE CLEAN RESULT
========================================================= */

function normalizeCleanResult(
    result
) {

    /*
       CASE 1
       cleanImage / cleanVideo langsung
       mengembalikan Blob.
    */

    if (
        result instanceof Blob
    ) {

        return result;

    }


    /*
       CASE 2
       Module mengembalikan:
       {
           blob: Blob
       }
    */

    if (
        result &&
        result.blob instanceof Blob
    ) {

        return result.blob;

    }


    /*
       CASE 3
       Module mungkin mengembalikan:
       {
           file: Blob
       }
    */

    if (
        result &&
        result.file instanceof Blob
    ) {

        return result.file;

    }


    /*
       CASE 4
       Module mungkin mengembalikan:
       {
           output: Blob
       }
    */

    if (
        result &&
        result.output instanceof Blob
    ) {

        return result.output;

    }


    return null;

}


/* =========================================================
   GET FILE TYPE
========================================================= */

function getSourceType(
    file
) {

    const type =
        String(
            file?.type ||
            state.fileType ||
            ""
        ).toLowerCase();


    if (
        type.startsWith(
            "image/"
        )
    ) {

        return "image";

    }


    if (
        type.startsWith(
            "video/"
        )
    ) {

        return "video";

    }


    return "";

}


/* =========================================================
   FILE STILL ACTIVE?
========================================================= */

function isSameFile(
    file
) {

    return (
        state.file === file
    );

}


/* =========================================================
   MAIN CLEAN FUNCTION
========================================================= */

export async function cleanMetadata() {

    console.log(
        "[GEN-Z.AI][CLEAN] cleanMetadata() dipanggil."
    );


    /* =====================================================
       FILE CHECK
    ===================================================== */

    if (
        !state.file
    ) {

        console.warn(
            "[GEN-Z.AI][CLEAN] Tidak ada file."
        );


        setCleaningStatus(
            "PILIH FILE TERLEBIH DAHULU.",
            "Silakan pilih foto atau video sebelum membersihkan metadata."
        );


        return false;

    }


    /* =====================================================
       PREVENT DOUBLE PROCESS
    ===================================================== */

    if (
        state.cleaning
    ) {

        console.warn(
            "[GEN-Z.AI][CLEAN] Cleaning sedang berjalan."
        );


        return false;

    }


    const sourceFile =
        state.file;


    const sourceType =
        getSourceType(
            sourceFile
        );


    console.log(
        "[GEN-Z.AI][CLEAN] Source:",
        {
            name:
                sourceFile.name,

            type:
                sourceFile.type,

            size:
                sourceFile.size,

            sourceType
        }
    );


    /* =====================================================
       TYPE CHECK
    ===================================================== */

    if (
        sourceType !== "image" &&
        sourceType !== "video"
    ) {

        setCleaningStatus(
            "FORMAT TIDAK DIDUKUNG.",
            "File harus berupa foto atau video."
        );


        return false;

    }


    /* =====================================================
       START CLEANING
    ===================================================== */

    state.cleaning =
        true;


    state.cleanedBlob =
        null;


    /*
       Bersihkan preview hasil lama.
    */

    clearCleanedPreview();


    hideCleanResult();


    disableDownload();


    setCleaningLoading(
        true
    );


    setCleaningButtons(
        true
    );


    setPreviewStatus(
        "Membersihkan metadata..."
    );


    setCleaningStatus(
        "MEMBERSIHKAN METADATA...",
        "File sedang diproses secara lokal. Jangan tutup halaman."
    );


    console.log(
        "[GEN-Z.AI][CLEAN] Cleaning dimulai:",
        sourceType
    );


    try {

        /* =================================================
           EXECUTE CLEANER
        ================================================= */

        let result;


        if (
            sourceType === "image"
        ) {

            console.log(
                "[GEN-Z.AI][CLEAN] Menjalankan image cleaner..."
            );


            result =
                await cleanImage(
                    sourceFile
                );

        } else {

            console.log(
                "[GEN-Z.AI][CLEAN] Menjalankan video cleaner..."
            );


            result =
                await cleanVideo(
                    sourceFile
                );

        }


        /* =================================================
           FILE CHANGE GUARD
        ================================================= */

        if (
            !isSameFile(
                sourceFile
            )
        ) {

            console.warn(
                "[GEN-Z.AI][CLEAN] File berubah selama cleaning. Hasil diabaikan."
            );


            return false;

        }


        /* =================================================
           DEBUG CLEAN RESULT
        ================================================= */

        console.log(
            "[GEN-Z.AI][CLEAN] Raw cleaner result:",
            result
        );


        console.log(
            "[GEN-Z.AI][CLEAN] Result info:",
            {
                constructor:
                    result?.constructor?.name ||
                    null,

                isBlob:
                    result instanceof Blob,

                type:
                    result?.type ||
                    null,

                size:
                    result?.size ||
                    null,

                hasBlob:
                    result?.blob instanceof Blob,

                hasFile:
                    result?.file instanceof Blob,

                hasOutput:
                    result?.output instanceof Blob
            }
        );


        /* =================================================
           NORMALIZE
        ================================================= */

        const cleanedBlob =
            normalizeCleanResult(
                result
            );


        if (
            !cleanedBlob
        ) {

            throw new Error(
                "Cleaner tidak mengembalikan Blob hasil."
            );

        }


        if (
            cleanedBlob.size <= 0
        ) {

            throw new Error(
                "File hasil cleaning kosong."
            );

        }


        console.log(
            "[GEN-Z.AI][CLEAN] Cleaned Blob berhasil:",
            {
                type:
                    cleanedBlob.type,

                size:
                    cleanedBlob.size
            }
        );


        /* =================================================
           STORE RESULT
        ================================================= */

        state.cleanedBlob =
            cleanedBlob;


        /*
           Pastikan file type tetap diketahui.
        */

        if (
            !state.fileType
        ) {

            state.fileType =
                sourceType;

        }


        /* =================================================
           RENDER CLEANED PREVIEW
        ================================================= */

        console.log(
            "[GEN-Z.AI][CLEAN] Render cleaned preview..."
        );


        const previewRendered =
            renderCleanedPreview(
                cleanedBlob
            );


        console.log(
            "[GEN-Z.AI][CLEAN] Preview result:",
            previewRendered
        );


        if (
            previewRendered === false
        ) {

            throw new Error(
                "Preview file hasil gagal ditampilkan."
            );

        }


        /* =================================================
           FILE STILL ACTIVE CHECK
        ================================================= */

        if (
            !isSameFile(
                sourceFile
            )
        ) {

            console.warn(
                "[GEN-Z.AI][CLEAN] File berubah setelah preview."
            );


            return false;

        }


        /* =================================================
           SHOW RESULT
        ================================================= */

        showCleanResult();


        /* =================================================
           DOWNLOAD ENABLE
        ================================================= */

        const downloadReady =
            enableDownload();


        if (
            !downloadReady
        ) {

            console.warn(
                "[GEN-Z.AI][CLEAN] Download button tidak ditemukan."
            );

        }


        /* =================================================
           STATUS SUCCESS
        ================================================= */

        setPreviewStatus(
            "Metadata berhasil dibersihkan."
        );


        setCleaningStatus(
            "METADATA CLEANING SELESAI.",
            "Hasil adalah file baru yang sudah dibersihkan dari metadata."
        );


        console.log(
            "%c[GEN-Z.AI][CLEAN] CLEANING SELESAI.",
            "font-weight:bold;"
        );


        console.log(
            "[GEN-Z.AI][CLEAN] Hasil siap:",
            {
                blob:
                    state.cleanedBlob,

                previewURL:
                    state.cleanedPreviewUrl ||
                    state.cleanedURL,

                downloadReady
            }
        );


        return true;

    } catch (
        error
    ) {

        /*
           Jika file sudah berubah, jangan menimpa UI
           milik file baru.
        */

        if (
            !isSameFile(
                sourceFile
            )
        ) {

            console.warn(
                "[GEN-Z.AI][CLEAN] Error berasal dari file lama. Diabaikan."
            );


            return false;

        }


        console.error(
            "%c[GEN-Z.AI][CLEAN] CLEANING GAGAL",
            "font-weight:bold;color:red;",
            error
        );


        state.cleanedBlob =
            null;


        clearCleanedPreview();


        hideCleanResult();


        disableDownload();


        setPreviewStatus(
            "Cleaning gagal."
        );


        setCleaningStatus(
            "CLEANING GAGAL.",
            getReadableError(
                error
            )
        );


        return false;

    } finally {

        if (
            isSameFile(
                sourceFile
            )
        ) {

            state.cleaning =
                false;


            setCleaningLoading(
                false
            );


            setCleaningButtons(
                false
            );


            /*
               Jika tidak ada hasil, download tetap disabled.
            */

            if (
                !state.cleanedBlob
            ) {

                disableDownload();

            }

        }

    }

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

        return "Terjadi kesalahan saat membersihkan metadata.";

    }


    if (
        typeof error === "string"
    ) {

        return error;

    }


    if (
        error.message
    ) {

        return String(
            error.message
        );

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


/* =========================================================
   GLOBAL DEBUG
========================================================= */

window.GENZMetadataClean =
    {
        cleanMetadata
    };
