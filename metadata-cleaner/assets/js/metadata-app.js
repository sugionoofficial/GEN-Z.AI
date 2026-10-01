/* =========================================================
   GEN-Z.AI
   AI METADATA CLEANER
   ---------------------------------------------------------
   File:
   metadata-cleaner/assets/js/metadata-app.js

   Fungsi:
   - Upload image / video
   - Preview media
   - Read image metadata
   - Read basic video/container metadata
   - Detect AI-related metadata indicators
   - Show AI DETECT overlay
   - Coordinate image/video metadata cleaning
   - Download cleaned copy
   - Original file remains untouched

   Architecture:
   - metadata-state.js
   - metadata-dom.js
   - metadata-events.js
   - metadata-normalizer.js
   - metadata-detector.js
   - metadata-status.js
   - metadata-image.js
   - metadata-video.js
   - metadata-cleaner-image.js
   - metadata-cleaner-video.js
========================================================= */

import {
    APP,
    state
} from "./metadata-state.js";

import {
    elements,
    cacheElements
} from "./metadata-dom.js";

import {
    bindMetadataEvents
} from "./metadata-events.js";

import {
    normalizeMetadata,
    appendObjectMetadata
} from "./metadata-normalizer.js";

import {
    detectAIIndicators
} from "./metadata-detector.js";

import {
    renderDetectionResult,
    renderMetadata,
    setStatus
} from "./metadata-status.js";

import {
    readImageMetadata
} from "./metadata-image.js";

import {
    readVideoMetadata
} from "./metadata-video.js";

import {
    cleanImage
} from "./metadata-cleaner-image.js";

import {
    cleanVideo
} from "./metadata-cleaner-video.js";


/* =========================================================
   INIT
========================================================= */

function init() {

    cacheElements();


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


    resetForNewFile();


    state.file =
        file;


    state.fileType =
        detectMediaType(
            file
        );


    state.originalURL =
        URL.createObjectURL(
            file
        );


    updateFileInfo();


    renderOriginalPreview();


    elements.checkButton.disabled =
        false;


    elements.cleanButton.disabled =
        true;


    elements.downloadButton.disabled =
        true;


    setPreviewStatus(
        "MEDIA SIAP. TEKAN CHECK UNTUK MEMBACA METADATA."
    );


    setStatus(
        "UNKNOWN",
        "BELUM DIPERIKSA",
        "Tekan CHECK untuk membaca metadata media."
    );

}


/* =========================================================
   TYPE DETECTION
========================================================= */

function isSupportedMedia(
    file
) {

    if (
        !file
    ) {

        return false;
    }


    if (
        file.type &&
        (
            file.type.startsWith(
                "image/"
            ) ||
            file.type.startsWith(
                "video/"
            )
        )
    ) {

        return true;
    }


    const extension =
        getExtension(
            file.name
        );


    return [

        "jpg",
        "jpeg",
        "png",
        "webp",
        "gif",
        "bmp",
        "tif",
        "tiff",
        "avif",

        "mp4",
        "mov",
        "m4v",
        "webm",
        "mkv",
        "avi",
        "mpeg",
        "mpg",
        "3gp",
        "ogv"

    ].includes(
        extension
    );

}


/* =========================================================
   MEDIA TYPE
========================================================= */

function detectMediaType(
    file
) {

    if (
        file.type?.startsWith(
            "image/"
        )
    ) {

        return "image";
    }


    if (
        file.type?.startsWith(
            "video/"
        )
    ) {

        return "video";
    }


    const extension =
        getExtension(
            file.name
        );


    if (
        [
            "jpg",
            "jpeg",
            "png",
            "webp",
            "gif",
            "bmp",
            "tif",
            "tiff",
            "avif"
        ].includes(
            extension
        )
    ) {

        return "image";
    }


    return "video";

}


/* =========================================================
   FILE INFO
========================================================= */

function updateFileInfo() {

    elements.fileInfo?.classList.remove(
        "hidden"
    );


    elements.fileType.textContent =
        state.fileType === "image"
            ? "IMAGE"
            : "VIDEO";


    elements.fileName.textContent =
        state.file.name;


    elements.fileSize.textContent =
        formatBytes(
            state.file.size
        );

}


/* =========================================================
   ORIGINAL PREVIEW
========================================================= */

function renderOriginalPreview() {

    hideElement(
        elements.previewEmpty
    );


    hideElement(
        elements.imagePreview
    );


    hideElement(
        elements.videoPreview
    );


    hideElement(
        elements.aiOverlay
    );


    if (
        state.fileType === "image"
    ) {

        elements.imagePreview.src =
            state.originalURL;


        showElement(
            elements.imagePreview
        );


        return;
    }


    elements.videoPreview.src =
        state.originalURL;


    showElement(
        elements.videoPreview
    );

}


/* =========================================================
   CHECK METADATA
========================================================= */

async function checkMetadata() {

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

        const metadata =
            state.fileType === "image"

                ? await readImageMetadata(
                    state.file
                )

                : await readVideoMetadata(
                    state.file
                );


        state.metadata =
            normalizeMetadata(
                metadata
            );


        state.aiIndicators =
            detectAIIndicators(
                state.metadata
            );


        state.checked =
            true;


        renderMetadata();


        renderDetectionResult();


        elements.cleanButton.disabled =
            false;


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


        state.metadata =
            [];


        state.aiIndicators =
            [];


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

        elements.checkButton.disabled =
            false;

    }

}


/* =========================================================
   CLEAN
   ---------------------------------------------------------
   Membuat file hasil baru secara lokal.

   File asli tidak pernah dimodifikasi.
========================================================= */

async function cleanMetadata() {

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


        if (
            state.fileType === "image"
        ) {

            result =
                await cleanImage(
                    sourceFile
                );

        } else {

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


        state.cleanedURL =
            URL.createObjectURL(
                state.cleanedBlob
            );


        renderCleanedPreview(
            state.cleanedURL
        );


        showElement(
            elements.cleanResult
        );


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
   CLEANED PREVIEW
========================================================= */

function renderCleanedPreview(
    url
) {

    hideElement(
        elements.cleanImagePreview
    );


    hideElement(
        elements.cleanVideoPreview
    );


    if (
        state.fileType === "image"
    ) {

        elements.cleanImagePreview.src =
            url;


        showElement(
            elements.cleanImagePreview
        );


        return;
    }


    elements.cleanVideoPreview.src =
        url;


    showElement(
        elements.cleanVideoPreview
    );

}


/* =========================================================
   DOWNLOAD
========================================================= */

function downloadCleanedFile() {

    if (
        !state.cleanedBlob ||
        !state.cleanedURL
    ) {

        return;
    }


    const anchor =
        document.createElement(
            "a"
        );


    anchor.href =
        state.cleanedURL;


    anchor.download =
        createCleanedFilename(
            state.file.name
        );


    document.body.appendChild(
        anchor
    );


    anchor.click();


    anchor.remove();

}


/* =========================================================
   CLEANED FILENAME
========================================================= */

function createCleanedFilename(
    originalName
) {

    const dot =
        originalName.lastIndexOf(
            "."
        );


    if (
        dot <= 0
    ) {

        return `${originalName}_cleaned`;
    }


    const base =
        originalName.slice(
            0,
            dot
        );


    const extension =
        originalName.slice(
            dot + 1
        );


    return `${base}_cleaned.${extension}`;

}


/* =========================================================
   RESET FOR NEW FILE
   ---------------------------------------------------------
   Membersihkan seluruh state hasil file sebelumnya.

   - revoke original object URL
   - revoke cleaned object URL
   - hapus hasil cleaning
   - hapus metadata
   - hapus AI DETECT
   - nonaktifkan DOWNLOAD
   - reset status pemeriksaan
========================================================= */

function resetForNewFile() {

    state.checked =
        false;


    state.metadata =
        [];


    state.aiIndicators =
        [];


    state.cleanedBlob =
        null;


    /*
     * File sebelumnya tidak boleh meninggalkan
     * object URL di memory.
     */

    if (
        state.originalURL
    ) {

        URL.revokeObjectURL(
            state.originalURL
        );


        state.originalURL =
            null;
    }


    /*
     * Hasil cleaning sebelumnya juga harus
     * dilepas sebelum file baru diproses.
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
     * Hentikan referensi preview hasil lama.
     */

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


    /*
     * Sembunyikan hasil cleaning lama.
     */

    hideElement(
        elements.cleanResult
    );


    /*
     * DOWNLOAD hanya boleh aktif jika
     * cleanedBlob + cleanedURL benar-benar ada.
     */

    elements.downloadButton.disabled =
        true;


    /*
     * Bersihkan tabel metadata.
     */

    renderMetadata();


    /*
     * Hilangkan AI DETECT dari file sebelumnya.
     */

    hideElement(
        elements.aiOverlay
    );


    /*
     * Reset indikator status.
     */

    elements.statusIndicator.classList.remove(
        "is-detected",
        "is-clear",
        "is-unknown"
    );

}


/* =========================================================
   RESET APPLICATION
========================================================= */

function resetApplication() {

    resetForNewFile();


    state.file =
        null;


    state.fileType =
        null;


    if (
        state.originalURL
    ) {

        URL.revokeObjectURL(
            state.originalURL
        );


        state.originalURL =
            null;
    }


    if (
        elements.fileInput
    ) {

        elements.fileInput.value =
            "";

    }


    elements.fileInfo?.classList.add(
        "hidden"
    );


    hideElement(
        elements.imagePreview
    );


    hideElement(
        elements.videoPreview
    );


    showElement(
        elements.previewEmpty
    );


    elements.checkButton.disabled =
        true;


    elements.cleanButton.disabled =
        true;


    elements.downloadButton.disabled =
        true;


    setStatus(
        "UNKNOWN",
        "BELUM DIPERIKSA",
        "Tekan CHECK untuk membaca metadata media."
    );


    setPreviewStatus(
        "BELUM ADA MEDIA"
    );

}


/* =========================================================
   PREVIEW STATUS
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
   DOM HELPERS
========================================================= */

function showElement(
    element
) {

    element?.classList.remove(
        "hidden"
    );

}


function hideElement(
    element
) {

    element?.classList.add(
        "hidden"
    );

}


/* =========================================================
   FORMAT HELPERS
========================================================= */

function formatBytes(
    bytes
) {

    if (
        !Number.isFinite(bytes) ||
        bytes <= 0
    ) {

        return "0 B";
    }


    const units = [
        "B",
        "KB",
        "MB",
        "GB",
        "TB"
    ];


    const index =
        Math.floor(
            Math.log(bytes) /
            Math.log(1024)
        );


    const safeIndex =
        Math.min(
            index,
            units.length - 1
        );


    const value =
        bytes /
        Math.pow(
            1024,
            safeIndex
        );


    return `${value.toFixed(
        safeIndex === 0
            ? 0
            : 2
    )} ${units[safeIndex]}`;

}


/* =========================================================
   EXTENSION
========================================================= */

function getExtension(
    filename
) {

    const clean =
        String(
            filename || ""
        )
        .split("?")[0]
        .split("#")[0];


    const dot =
        clean.lastIndexOf(
            "."
        );


    if (
        dot < 0
    ) {

        return "";
    }


    return clean
        .slice(
            dot + 1
        )
        .toLowerCase();

}


/* =========================================================
   ASPECT RATIO
   ---------------------------------------------------------
   Dipertahankan sebagai helper lokal karena masih
   digunakan oleh metadata-app.js / kompatibilitas.
========================================================= */

function calculateAspectRatio(
    width,
    height
) {

    if (
        !width ||
        !height
    ) {

        return "Unknown";
    }


    const divisor =
        greatestCommonDivisor(
            width,
            height
        );


    return `${width / divisor}:${height / divisor}`;

}


function greatestCommonDivisor(
    a,
    b
) {

    a =
        Math.abs(
            Math.round(
                a
            )
        );


    b =
        Math.abs(
            Math.round(
                b
            )
        );


    while (
        b !== 0
    ) {

        const temp =
            b;


        b =
            a % b;


        a =
            temp;

    }


    return a || 1;

}


/* =========================================================
   ERROR
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
   PUBLIC APP
========================================================= */

window.GENZMetadataCleaner =
    Object.freeze({

        getState() {

            return {

                file:
                    state.file,

                fileType:
                    state.fileType,

                metadata:
                    [
                        ...state.metadata
                    ],

                aiIndicators:
                    [
                        ...state.aiIndicators
                    ],

                checked:
                    state.checked,

                cleaned:
                    Boolean(
                        state.cleanedBlob
                    )

            };

        },


        reset() {

            resetApplication();

        }

    });


/* =========================================================
   START
========================================================= */

if (
    document.readyState ===
    "loading"
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
