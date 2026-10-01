/* =========================================================
   GEN-Z.AI
   METADATA UTILS MODULE
   ---------------------------------------------------------
   File:
   metadata-cleaner/assets/js/metadata-utils.js

   Fungsi:
   - Format ukuran file
   - Ambil extension file
   - Hitung aspect ratio
   - Greatest common divisor
========================================================= */


/* =========================================================
   FORMAT BYTES
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
   GET EXTENSION
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
   CALCULATE ASPECT RATIO
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


/* =========================================================
   GREATEST COMMON DIVISOR
========================================================= */

function greatestCommonDivisor(
    a,
    b
) {

    a =
        Math.abs(
            Math.round(a)
        );


    b =
        Math.abs(
            Math.round(b)
        );


    while (
        b !== 0
    ) {

        const temp =
            b;


        b =
            a %
            b;


        a =
            temp;
    }


    return a || 1;
}


/* =========================================================
   PUBLIC API
========================================================= */

export {

    formatBytes,

    getExtension,

    calculateAspectRatio,

    greatestCommonDivisor

};


window.GENZMetadataUtils = {

    formatBytes,

    getExtension,

    calculateAspectRatio,

    greatestCommonDivisor

};
