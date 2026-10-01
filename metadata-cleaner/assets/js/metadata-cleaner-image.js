/* =========================================================
   GEN-Z.AI
   AI METADATA CLEANER
   ---------------------------------------------------------
   File:
   metadata-cleaner/assets/js/metadata-cleaner-image.js

   Fungsi:
   - Clean image metadata locally
   - Re-render image through Canvas
   - Create a new image Blob
   - Original image remains untouched
========================================================= */


/* =========================================================
   CLEAN IMAGE
========================================================= */

export async function cleanImage(
    file
) {

    if (
        !file
    ) {

        throw new Error(
            "File gambar tidak tersedia."
        );
    }


    const image =
        await loadImage(
            file
        );


    const canvas =
        document.createElement(
            "canvas"
        );


    canvas.width =
        image.naturalWidth;


    canvas.height =
        image.naturalHeight;


    const context =
        canvas.getContext(
            "2d",
            {
                alpha: true
            }
        );


    if (
        !context
    ) {

        throw new Error(
            "Canvas browser tidak tersedia."
        );
    }


    context.drawImage(
        image,
        0,
        0
    );


    const outputType =
        getImageOutputType(
            file
        );


    const blob =
        await canvasToBlob(
            canvas,
            outputType,
            outputType === "image/jpeg"
                ? 0.94
                : undefined
        );


    return {

        blob,

        type:
            outputType

    };
}


/* =========================================================
   IMAGE LOADER
========================================================= */

function loadImage(
    file
) {

    return new Promise(
        (
            resolve,
            reject
        ) => {

            const image =
                new Image();


            const url =
                URL.createObjectURL(
                    file
                );


            image.onload = () => {

                URL.revokeObjectURL(
                    url
                );


                resolve(
                    image
                );
            };


            image.onerror = () => {

                URL.revokeObjectURL(
                    url
                );


                reject(
                    new Error(
                        "Gambar tidak dapat dibaca."
                    )
                );
            };


            image.src =
                url;
        }
    );
}


/* =========================================================
   IMAGE OUTPUT TYPE
========================================================= */

function getImageOutputType(
    file
) {

    /*
     * PNG tetap PNG.
     */

    if (
        file.type === "image/png"
    ) {

        return "image/png";
    }


    /*
     * WebP tetap WebP.
     */

    if (
        file.type === "image/webp"
    ) {

        return "image/webp";
    }


    /*
     * Format lain dirender menjadi JPEG.
     */

    return "image/jpeg";
}


/* =========================================================
   CANVAS TO BLOB
========================================================= */

function canvasToBlob(
    canvas,
    type,
    quality
) {

    return new Promise(
        (
            resolve,
            reject
        ) => {

            canvas.toBlob(
                blob => {

                    if (
                        !blob
                    ) {

                        reject(
                            new Error(
                                "Browser gagal membuat file hasil."
                            )
                        );


                        return;
                    }


                    resolve(
                        blob
                    );
                },
                type,
                quality
            );
        }
    );
}
