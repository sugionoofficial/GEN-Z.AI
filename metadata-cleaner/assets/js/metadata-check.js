/* =========================================================
   GEN-Z.AI
   AI METADATA CLEANER
   ---------------------------------------------------------
   File:
   metadata-cleaner/assets/js/metadata-check.js

   Tanggung jawab:
   - CHECK metadata
   - Read image metadata
   - Read video metadata
   - Normalize metadata
   - Detect AI metadata indicators
   - Inspect C2PA / Content Credentials
   - Render metadata
   - Render AI detection result
   - Mengatur status CHECK / CLEAN

   Tidak menangani:
   - Upload file
   - Drag & drop
   - Cleaning
   - Download
   - Reset aplikasi
   - Preview media utama
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
   NORMALIZER
========================================================= */

import {
    normalizeMetadata
} from "./metadata-normalizer.js";


/* =========================================================
   AI DETECTOR
========================================================= */

import {
    detectAIIndicators
} from "./metadata-detector.js";


/* =========================================================
   STATUS RENDERER
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
   PROVENANCE
========================================================= */

import {
    inspectProvenance
} from "./metadata-provenance.js";


/* =========================================================
   PREVIEW STATUS
========================================================= */

import {
    setPreviewStatus
} from "./metadata-preview.js";


/* =========================================================
   CHECK METADATA
========================================================= */

export async function checkMetadata() {

    if (
        !state.file
    ) {

        return;
    }


    if (
        state.checked
    ) {

        return;
    }


    /*
     * Simpan referensi file yang sedang diperiksa.
     *
     * Jika user mengganti file ketika proses async
     * masih berjalan, hasil file lama tidak boleh
     * diterapkan ke file baru.
     */

    const sourceFile =
        state.file;


    if (
        elements.checkButton
    ) {

        elements.checkButton.disabled =
            true;

    }


    setStatus(
        "UNKNOWN",
        "MEMBACA METADATA...",
        "GEN-Z.AI Sedang memeriksa METADATA..."
    );


    setPreviewStatus(
        "MEMBACA METADATA..."
    );


    try {

        /* =================================================
           STEP 1
           READ NORMAL METADATA
        ================================================= */

        const metadata =
            state.fileType === "image"

                ? await readImageMetadata(
                    sourceFile
                )

                : await readVideoMetadata(
                    sourceFile
                );


        /*
         * User mungkin sudah memilih file baru
         * ketika pembacaan metadata masih berjalan.
         */

        if (
            state.file !== sourceFile
        ) {

            return;
        }


        state.metadata =
            normalizeMetadata(
                metadata
            );


        /* =================================================
           STEP 2
           DETECT AI METADATA INDICATORS
        ================================================= */

        state.aiIndicators =
            detectAIIndicators(
                state.metadata
            );


        /* =================================================
           STEP 3
           C2PA / CONTENT CREDENTIALS
        ================================================= */

        state.provenance =
            await inspectFileProvenance(
                sourceFile
            );


        /*
         * Jangan menempelkan hasil provenance
         * file lama ke file baru.
         */

        if (
            state.file !== sourceFile
        ) {

            return;
        }


        /* =================================================
           STEP 4
           MARK CHECKED
        ================================================= */

        state.checked =
            true;


        /* =================================================
           STEP 5
           RENDER ALL
        ================================================= */

        renderMetadata();


        renderDetectionResult();


        if (
            elements.cleanButton
        ) {

            elements.cleanButton.disabled =
                false;

        }


        /* =================================================
           PREVIEW STATUS
        ================================================= */

        const hasAIIndicators =
            Array.isArray(
                state.aiIndicators
            ) &&
            state.aiIndicators.length > 0;


        const hasProvenance =
            Boolean(
                state.provenance?.detected
            );


        if (
            hasAIIndicators &&
            hasProvenance
        ) {

            setPreviewStatus(
                "INDIKATOR AI DAN CONTENT PROVENANCE DITEMUKAN."
            );

        } else if (
            hasAIIndicators
        ) {

            setPreviewStatus(
                "INDIKATOR AI DITEMUKAN PADA METADATA."
            );

        } else if (
            hasProvenance
        ) {

            setPreviewStatus(
                "CONTENT PROVENANCE / C2PA DITEMUKAN."
            );

        } else {

            setPreviewStatus(
                "PEMERIKSAAN METADATA SELESAI."
            );

        }


    } catch (
        error
    ) {

        console.error(
            "[GEN-Z.AI] Metadata check failed:",
            error
        );


        /*
         * Jangan mempertahankan hasil parsial
         * sebagai hasil CHECK yang valid.
         */

        state.metadata =
            [];


        state.aiIndicators =
            [];


        state.provenance =
            null;


        renderMetadata();


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
         * Hanya mengubah tombol jika file yang
         * diperiksa masih merupakan file aktif.
         */

        if (
            state.file === sourceFile
        ) {

            if (
                elements.checkButton
            ) {

                elements.checkButton.disabled =
                    false;

            }

        }

    }

}


/* =========================================================
   INSPECT PROVENANCE
   ---------------------------------------------------------
   Prioritas:
   1. Direct imported module
   2. Global compatibility API
   3. null
========================================================= */

export async function inspectFileProvenance(
    file
) {

    if (
        !file
    ) {

        return null;
    }


    /* =====================================================
       DIRECT MODULE
    ===================================================== */

    try {

        if (
            typeof inspectProvenance ===
            "function"
        ) {

            const result =
                await inspectProvenance(
                    file
                );


            return result || null;

        }

    } catch (
        error
    ) {

        console.warn(
            "[GEN-Z.AI] Direct provenance inspection failed:",
            error
        );

    }


    /* =====================================================
       GLOBAL FALLBACK
       -----------------------------------------------------
       Dipertahankan untuk deployment lama yang masih
       mengekspos GENZMetadataProvenance.
    ===================================================== */

    const provenanceAPI =
        window.GENZMetadataProvenance;


    if (
        provenanceAPI &&
        typeof provenanceAPI.inspectProvenance ===
            "function"
    ) {

        try {

            const result =
                await provenanceAPI.inspectProvenance(
                    file
                );


            return result || null;

        } catch (
            error
        ) {

            console.warn(
                "[GEN-Z.AI] Global provenance inspection failed:",
                error
            );

        }

    }


    return null;

}


/* =========================================================
   ERROR MESSAGE
========================================================= */

export function getReadableError(
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
        typeof error === "string"
    ) {

        return error;
    }


    /*
     * Beberapa library mengembalikan object error.
     */

    try {

        if (
            error.message
        ) {

            return String(
                error.message
            );

        }


        return JSON.stringify(
            error
        );

    } catch (
        serializationError
    ) {

        console.warn(
            "[GEN-Z.AI] Error serialization failed:",
            serializationError
        );


        return String(
            error
        );

    }

}


/* =========================================================
   PUBLIC API
========================================================= */

export default {

    checkMetadata,

    inspectFileProvenance,

    getReadableError

};
