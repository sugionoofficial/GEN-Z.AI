/* =========================================================
   GEN-Z.AI
   AI METADATA CLEANER
   ---------------------------------------------------------
   File:
   metadata-cleaner/assets/js/metadata-file.js

   Fungsi:
   - Validasi format media
   - Deteksi tipe media
   - Menampilkan informasi file
   - Helper extension / ukuran file

   Catatan:
   - Tidak mengubah file asli
   - Tidak mengubah struktur state
   - Tidak mengubah daftar format yang didukung
========================================================= */

import {
    state
} from "./metadata-state.js";

import {
    elements
} from "./metadata-dom.js";


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


    if (
        elements.fileType
    ) {

        elements.fileType.textContent =
            state.fileType === "image"
                ? "IMAGE"
                : "VIDEO";

    }


    if (
        elements.fileName
    ) {

        elements.fileName.textContent =
            state.file.name;

    }


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
