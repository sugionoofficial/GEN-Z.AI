/* =========================================================
   GEN-Z.AI
   AI METADATA CLEANER
   ---------------------------------------------------------
   File:
   metadata-cleaner/assets/js/metadata-file.js

   Tanggung jawab:
   - File picker
   - File input
   - Drag & drop
   - Validasi format media
   - Deteksi tipe media
   - Menyimpan file aktif ke state
   - Membuat original object URL
   - Menampilkan informasi file
   - Memulai original preview

   Tidak menangani:
   - Pembacaan metadata
   - AI detection
   - Cleaning
   - Download
   - Reset aplikasi penuh
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
   STATUS
========================================================= */

import {
    setStatus
} from "./metadata-status.js";


/* =========================================================
   RESET
========================================================= */

import {
    resetForNewFile
} from "./metadata-reset.js";


/* =========================================================
   PREVIEW
========================================================= */

import {
    renderOriginalPreview,
    setPreviewStatus
} from "./metadata-preview.js";


/* =========================================================
   FILE PICKER
========================================================= */

export function openFilePicker() {

    if (
        !elements.fileInput
    ) {

        console.warn(
            "[GEN-Z.AI] File input tidak ditemukan."
        );


        return;
    }


    try {

        elements.fileInput.click();

    } catch (error) {

        console.error(
            "[GEN-Z.AI] File picker gagal dibuka:",
            error
        );

    }

}


/* =========================================================
   FILE INPUT
========================================================= */

export function handleFileInput(
    event
) {

    const files =
        Array.from(
            event?.target?.files || []
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

export function handleDragOver(
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

export function handleDragLeave(
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

export function handleDrop(
    event
) {

    event.preventDefault();


    elements.dropzone?.classList.remove(
        "is-dragging"
    );


    const files =
        Array.from(
            event?.dataTransfer?.files || []
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
   PROCESS SELECTED FILE
========================================================= */

export function processSelectedFile(
    file
) {

    if (
        !file
    ) {

        return;
    }


    /* =====================================================
       VALIDASI FORMAT
    ===================================================== */

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


    /* =====================================================
       RESET FILE SEBELUMNYA
    ===================================================== */

    resetForNewFile();


    /* =====================================================
       SIMPAN FILE AKTIF
    ===================================================== */

    state.file =
        file;


    state.fileType =
        detectMediaType(
            file
        );


    /* =====================================================
       OBJECT URL
       -----------------------------------------------------
       resetForNewFile() sudah merevoke URL lama.
       Di sini kita hanya membuat URL baru.
    ===================================================== */

    state.originalURL =
        null;


    try {

        state.originalURL =
            URL.createObjectURL(
                file
            );

    } catch (error) {

        console.error(
            "[GEN-Z.AI] Object URL creation failed:",
            error
        );


        state.originalURL =
            null;

    }


    /* =====================================================
       FILE INFORMATION
    ===================================================== */

    updateFileInfo();


    /* =====================================================
       ORIGINAL PREVIEW
    ===================================================== */

    renderOriginalPreview();


    /* =====================================================
       BUTTON STATE
    ===================================================== */

    if (
        elements.checkButton
    ) {

        elements.checkButton.disabled =
            false;

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


    /* =====================================================
       PREVIEW STATUS
    ===================================================== */

    setPreviewStatus(
        "MEDIA SIAP. TEKAN CHECK UNTUK MEMBACA METADATA."
    );


    /* =====================================================
       APPLICATION STATUS
    ===================================================== */

    setStatus(
        "UNKNOWN",
        "BELUM DIPERIKSA",
        "Tekan CHECK untuk membaca metadata media."
    );

}


/* =========================================================
   SUPPORTED MEDIA
========================================================= */

export function isSupportedMedia(
    file
) {

    if (
        !file
    ) {

        return false;
    }


    /* =====================================================
       MIME TYPE
    ===================================================== */

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


    /* =====================================================
       EXTENSION FALLBACK
    ===================================================== */

    const extension =
        getExtension(
            file.name
        );


    return [

        /* IMAGE */

        "jpg",
        "jpeg",
        "png",
        "webp",
        "gif",
        "bmp",
        "tif",
        "tiff",
        "avif",

        /* VIDEO */

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

export function detectMediaType(
    file
) {

    if (
        file?.type?.startsWith(
            "image/"
        )
    ) {

        return "image";
    }


    if (
        file?.type?.startsWith(
            "video/"
        )
    ) {

        return "video";
    }


    const extension =
        getExtension(
            file?.name
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

export function updateFileInfo() {

    if (
        !state.file
    ) {

        return;
    }


    elements.fileInfo?.classList.remove(
        "hidden"
    );


    /* =====================================================
       FILE TYPE
    ===================================================== */

    if (
        elements.fileType
    ) {

        elements.fileType.textContent =
            state.fileType === "image"
                ? "IMAGE"
                : "VIDEO";

    }


    /* =====================================================
       FILE NAME
    ===================================================== */

    if (
        elements.fileName
    ) {

        elements.fileName.textContent =
            state.file.name ||
            "";

    }


    /* =====================================================
       FILE SIZE
    ===================================================== */

    if (
        elements.fileSize
    ) {

        elements.fileSize.textContent =
            formatBytes(
                state.file.size
            );

    }

}


/* =========================================================
   FORMAT BYTES
========================================================= */

export function formatBytes(
    bytes
) {

    if (
        !Number.isFinite(
            bytes
        ) ||
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
            Math.log(
                bytes
            ) /
            Math.log(
                1024
            )
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

export function getExtension(
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
   REVOKE OBJECT URL
   ---------------------------------------------------------
   Diekspor untuk kompatibilitas dengan modul lain yang
   masih membutuhkan helper ini selama proses pemecahan
   metadata-app.js.
========================================================= */

export function revokeObjectURL(
    url
) {

    if (
        !url
    ) {

        return;
    }


    try {

        URL.revokeObjectURL(
            url
        );

    } catch (error) {

        console.warn(
            "[GEN-Z.AI] Object URL revoke gagal:",
            error
        );

    }

}


/* =========================================================
   PUBLIC API
========================================================= */

export default {

    openFilePicker,

    handleFileInput,

    handleDragOver,

    handleDragLeave,

    handleDrop,

    processSelectedFile,

    isSupportedMedia,

    detectMediaType,

    updateFileInfo,

    formatBytes,

    getExtension,

    revokeObjectURL

};
