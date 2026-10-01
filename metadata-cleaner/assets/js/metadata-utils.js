/* =========================================================
   GEN-Z.AI
   AI METADATA CLEANER
   ---------------------------------------------------------
   File:
   metadata-cleaner/assets/js/metadata-utils.js

   Tanggung jawab:
   - Helper umum seluruh Metadata Cleaner
   - Format ukuran file
   - Ekstensi file
   - Aspect ratio
   - Greatest common divisor
   - Object URL helper
   - Async helper
   - DOM visibility helper
   - Error message helper

   Tidak menangani:
   - State aplikasi
   - File picker
   - Metadata reader
   - AI detection
   - Cleaning
   - Download
   - Preview khusus
========================================================= */


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
   GET EXTENSION
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
   ASPECT RATIO
========================================================= */

export function calculateAspectRatio(
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

export function greatestCommonDivisor(
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
            a % b;


        a =
            temp;
    }


    return a || 1;

}


/* =========================================================
   REVOKE OBJECT URL
   ---------------------------------------------------------
   Hanya revoke blob URL.
   URL biasa tidak disentuh.
========================================================= */

export function revokeObjectURL(
    url
) {

    if (
        !url
    ) {

        return;
    }


    if (
        typeof url !==
        "string"
    ) {

        return;
    }


    if (
        !url.startsWith(
            "blob:"
        )
    ) {

        return;
    }


    try {

        URL.revokeObjectURL(
            url
        );

    } catch (
        error
    ) {

        console.warn(
            "[GEN-Z.AI] revokeObjectURL gagal:",
            error
        );

    }

}


/* =========================================================
   WAIT
========================================================= */

export function wait(
    milliseconds
) {

    const duration =
        Number.isFinite(
            Number(
                milliseconds
            )
        )

            ? Math.max(
                0,
                Number(
                    milliseconds
                )
            )

            : 0;


    return new Promise(
        resolve => {

            setTimeout(
                resolve,
                duration
            );

        }
    );

}


/* =========================================================
   YIELD TO BROWSER
========================================================= */

export async function yieldToBrowser() {

    await new Promise(
        resolve => {

            setTimeout(
                resolve,
                0
            );

        }
    );

}


/* =========================================================
   SHOW ELEMENT
========================================================= */

export function showElement(
    element
) {

    if (
        !element
    ) {

        return;
    }


    element.classList.remove(
        "hidden"
    );

}


/* =========================================================
   HIDE ELEMENT
========================================================= */

export function hideElement(
    element
) {

    if (
        !element
    ) {

        return;
    }


    element.classList.add(
        "hidden"
    );

}


/* =========================================================
   GET READABLE ERROR
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
        typeof error ===
        "string"
    ) {

        return error;
    }


    /*
     * Beberapa library/browser API dapat mengembalikan
     * object error.
     */

    try {

        if (
            error.message
        ) {

            return String(
                error.message
            );

        }


        const serialized =
            JSON.stringify(
                error
            );


        if (
            serialized &&
            serialized !==
                "{}"
        ) {

            return serialized;
        }

    } catch (
        serializationError
    ) {

        console.warn(
            "[GEN-Z.AI] Error serialization failed:",
            serializationError
        );

    }


    return String(
        error
    );

}


/* =========================================================
   PUBLIC API
========================================================= */

export default {

    formatBytes,

    getExtension,

    calculateAspectRatio,

    greatestCommonDivisor,

    revokeObjectURL,

    wait,

    yieldToBrowser,

    showElement,

    hideElement,

    getReadableError

};
