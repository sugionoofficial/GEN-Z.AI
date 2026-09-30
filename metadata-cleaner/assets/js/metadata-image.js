/* =========================================================
   GEN-Z.AI
   AI METADATA CLEANER
   ---------------------------------------------------------
   File:
   metadata-cleaner/assets/js/metadata-image.js

   Fungsi:
   - Read image metadata
   - Read image dimensions
   - Load EXIF reader
========================================================= */

import {
    appendObjectMetadata
} from "./metadata-normalizer.js";


/* =========================================================
   IMAGE METADATA
========================================================= */

export async function readImageMetadata(
    file
) {

    const result = [];


    result.push({

        field:
            "File Name",

        value:
            file.name,

        source:
            "File"

    });


    result.push({

        field:
            "File Type",

        value:
            file.type ||
            "Unknown",

        source:
            "File"

    });


    result.push({

        field:
            "File Size",

        value:
            formatBytes(
                file.size
            ),

        source:
            "File"

    });


    result.push({

        field:
            "Last Modified",

        value:
            new Date(
                file.lastModified
            ).toISOString(),

        source:
            "File"

    });


    const dimensions =
        await getImageDimensions(
            file
        );


    if (
        dimensions
    ) {

        result.push({

            field:
                "Width",

            value:
                `${dimensions.width} px`,

            source:
                "Image"

        });


        result.push({

            field:
                "Height",

            value:
                `${dimensions.height} px`,

            source:
                "Image"

        });


        result.push({

            field:
                "Aspect Ratio",

            value:
                calculateAspectRatio(
                    dimensions.width,
                    dimensions.height
                ),

            source:
                "Image"

        });
    }


    try {

        const exifr =
            await loadExifReader();


        if (
            exifr
        ) {

            const parsed =
                await exifr.parse(
                    file,
                    {
                        tiff: true,
                        ifd0: true,
                        exif: true,
                        gps: true,
                        xmp: true,
                        icc: true,
                        iptc: true,
                        jfif: true,
                        ihdr: true
                    }
                );


            appendObjectMetadata(
                result,
                parsed,
                "EXIF"
            );
        }

    } catch (
        error
    ) {

        console.warn(
            "[GEN-Z.AI] EXIF reader unavailable:",
            error
        );


        result.push({

            field:
                "EXIF Reader",

            value:
                "Tidak tersedia pada browser/session ini.",

            source:
                "Reader"

        });
    }


    return result;
}


/* =========================================================
   EXIF LOADER
========================================================= */

let exifReaderPromise =
    null;


export function loadExifReader() {

    if (
        exifReaderPromise
    ) {

        return exifReaderPromise;
    }


    exifReaderPromise =
        import(
            "https://cdn.jsdelivr.net/npm/exifr@7.1.3/dist/full.esm.mjs"
        )
        .then(
            module =>
                module.default ||
                module
        )
        .catch(
            error => {

                exifReaderPromise =
                    null;

                throw error;
            }
        );


    return exifReaderPromise;
}


/* =========================================================
   IMAGE DIMENSIONS
========================================================= */

export function getImageDimensions(
    file
) {

    return new Promise(
        resolve => {

            const image =
                new Image();


            const url =
                URL.createObjectURL(
                    file
                );


            image.onload = () => {

                const result = {

                    width:
                        image.naturalWidth,

                    height:
                        image.naturalHeight

                };


                URL.revokeObjectURL(
                    url
                );


                resolve(
                    result
                );
            };


            image.onerror = () => {

                URL.revokeObjectURL(
                    url
                );


                resolve(
                    null
                );
            };


            image.src =
                url;
        }
    );
}


/* =========================================================
   ASPECT RATIO
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


    return (
        `${width / divisor}:${height / divisor}`
    );
}


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
            a % b;

        a =
            temp;
    }


    return a || 1;
}


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
