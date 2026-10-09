/* =========================================================
   GEN-Z.AI VISION
   ---------------------------------------------------------
   File:
   vision/assets/js/vision-upload.js

   Fungsi:
   - Validasi image reference
   - Validasi replacement character
   - Membaca file sebagai Data URL (DENGAN KOMPRESI)
   - Membaca dimensi image
   - Menyimpan metadata file
   - Menyimpan reference image ke state
   - Menyimpan replacement character ke state

   Tidak menangani:
   - DOM
   - Preview rendering
   - API
   - Credit
   - History
   - Analysis
   - Prompt generation

   PATCH (2026-10-09):
   - Kompres gambar via canvas sebelum base64.
   - Fix 413 Payload Too Large ke OpenKey.
   - Resize max 1280px, JPEG quality 0.75.
   - Hasil: ~200-500 KB per gambar (dari 3-20 MB asli).
   - Fallback ke base64 asli kalau compress gagal.
========================================================= */


/* =========================================================
   CONFIG
========================================================= */

const VISION_UPLOAD_CONFIG = Object.freeze({

    maxFileSize:
        20 * 1024 * 1024,

    minWidth:
        64,

    minHeight:
        64,

    maxWidth:
        16384,

    maxHeight:
        16384,

    acceptedMimeTypes:
        Object.freeze([
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif"
        ]),

    acceptedExtensions:
        Object.freeze([
            "jpg",
            "jpeg",
            "png",
            "webp",
            "gif"
        ])

});


/* =========================================================
   COMPRESSION CONFIG
   ---------------------------------------------------------
   Kompresi di sisi client untuk menghindari payload
   terlalu besar ke OpenKey (limit ~5 MB).

   - Resize: sisi terpanjang max 1280px
   - Format output: JPEG quality 0.75
   - Hasil tipikal: 200-500 KB per gambar
========================================================= */

const VISION_COMPRESSION_CONFIG = Object.freeze({

    maxDimension:
        1280,

    quality:
        0.75,

    outputType:
        "image/jpeg"

});


/* =========================================================
   STATE ACCESS
========================================================= */

function getState() {

    if (
        !window.GENZVisionState
    ) {

        throw new Error(
            "GENZVisionState belum tersedia."
        );

    }


    return window.GENZVisionState;

}


/* =========================================================
   VALIDATE FILE OBJECT
========================================================= */

function validateFileObject(
    file
) {

    if (
        !file ||
        typeof file !== "object"
    ) {

        throw new Error(
            "File image tidak valid."
        );

    }


    if (
        typeof file.size !== "number" ||
        file.size <= 0
    ) {

        throw new Error(
            "File image kosong atau tidak valid."
        );

    }

}


/* =========================================================
   GET EXTENSION
========================================================= */

function getFileExtension(
    fileName
) {

    if (
        typeof fileName !== "string"
    ) {

        return "";

    }


    const cleanName =
        fileName
            .split("?")[0]
            .split("#")[0];


    const parts =
        cleanName
            .split(".")
            .filter(Boolean);


    if (
        parts.length < 2
    ) {

        return "";

    }


    return String(
        parts[parts.length - 1]
    ).toLowerCase();

}


/* =========================================================
   VALIDATE MIME
========================================================= */

function validateMimeType(
    file
) {

    const mimeType =
        String(
            file.type ||
            ""
        ).toLowerCase();


    const extension =
        getFileExtension(
            file.name
        );


    const mimeValid =
        VISION_UPLOAD_CONFIG
            .acceptedMimeTypes
            .includes(
                mimeType
            );


    const extensionValid =
        VISION_UPLOAD_CONFIG
            .acceptedExtensions
            .includes(
                extension
            );


    if (
        !mimeValid &&
        !extensionValid
    ) {

        throw new Error(
            "Format image tidak didukung. Gunakan JPG, PNG, WEBP, atau GIF."
        );

    }


    return true;

}


/* =========================================================
   VALIDATE SIZE
========================================================= */

function validateFileSize(
    file
) {

    if (
        file.size >
        VISION_UPLOAD_CONFIG.maxFileSize
    ) {

        const maxMB =
            VISION_UPLOAD_CONFIG.maxFileSize /
            1024 /
            1024;


        throw new Error(
            `Ukuran image terlalu besar. Maksimal ${maxMB} MB.`
        );

    }


    return true;

}


/* =========================================================
   VALIDATE FILE
========================================================= */

function validateFile(
    file
) {

    validateFileObject(
        file
    );

    validateMimeType(
        file
    );

    validateFileSize(
        file
    );


    return true;

}


/* =========================================================
   COMPRESS IMAGE VIA CANVAS
   ---------------------------------------------------------
   Menerima base64 data URL, mengembalikan base64 JPEG
   yang sudah di-resize dan dikompres.
========================================================= */

function compressDataUrl(
    dataUrl
) {

    return new Promise(
        resolve => {

            const img =
                new Image();


            img.onload = () => {

                try {

                    const canvas =
                        document.createElement(
                            "canvas"
                        );


                    let width =
                        img.naturalWidth ||
                        img.width;


                    let height =
                        img.naturalHeight ||
                        img.height;


                    const maxDim =
                        VISION_COMPRESSION_CONFIG
                            .maxDimension;


                    if (
                        width > maxDim ||
                        height > maxDim
                    ) {

                        if (
                            width > height
                        ) {

                            height =
                                Math.round(
                                    (height * maxDim) /
                                    width
                                );

                            width =
                                maxDim;

                        }
                        else {

                            width =
                                Math.round(
                                    (width * maxDim) /
                                    height
                                );

                            height =
                                maxDim;

                        }

                    }


                    canvas.width =
                        width;

                    canvas.height =
                        height;


                    const ctx =
                        canvas.getContext(
                            "2d"
                        );


                    if (!ctx) {

                        resolve(
                            dataUrl
                        );

                        return;

                    }


                    ctx.drawImage(
                        img,
                        0,
                        0,
                        width,
                        height
                    );


                    const compressed =
                        canvas.toDataURL(
                            VISION_COMPRESSION_CONFIG.outputType,
                            VISION_COMPRESSION_CONFIG.quality
                        );


                    resolve(
                        compressed
                    );

                }
                catch (
                    compressError
                ) {

                    console.warn(
                        "[Vision Upload] Compress gagal, pakai asli:",
                        compressError
                    );


                    resolve(
                        dataUrl
                    );

                }

            };


            img.onerror = () => {

                console.warn(
                    "[Vision Upload] Load image gagal, pakai asli."
                );


                resolve(
                    dataUrl
                );

            };


            img.src =
                dataUrl;

        }
    );

}


/* =========================================================
   READ FILE AS DATA URL (DENGAN KOMPRESI)
   ---------------------------------------------------------
   Baca file sebagai base64, lalu kompres via canvas.
   Hasil lebih kecil ~80-90% dari asli.
========================================================= */

function readFileAsDataURL(
    file
) {

    return new Promise(
        (
            resolve,
            reject
        ) => {

            const reader =
                new FileReader();


            reader.onload = async () => {

                const original =
                    reader.result;


                if (
                    typeof original !==
                    "string" ||
                    !original
                ) {

                    reject(
                        new Error(
                            "Image gagal dibaca."
                        )
                    );

                    return;

                }


                try {

                    const compressed =
                        await compressDataUrl(
                            original
                        );


                    /* ---------------------------------
                       LOG DIAGNOSTIC
                    --------------------------------- */

                    const originalSizeKB =
                        Math.round(
                            file.size /
                            1024
                        );

                    const compressedSizeKB =
                        Math.round(
                            (compressed.length *
                                0.75) /
                            1024
                        );

                    const reduction =
                        originalSizeKB > 0
                            ? Math.round(
                                (1 -
                                    compressedSizeKB /
                                        originalSizeKB) *
                                100
                            )
                            : 0;


                    console.info(
                        "[Vision Upload] Compression:",
                        {

                            file:
                                file.name,

                            original:
                                originalSizeKB +
                                " KB",

                            compressed:
                                compressedSizeKB +
                                " KB",

                            reduction:
                                reduction +
                                "%"

                        }
                    );


                    resolve(
                        compressed
                    );

                }
                catch (
                    compressError
                ) {

                    console.warn(
                        "[Vision Upload] Compress error, fallback ke base64 asli:",
                        compressError
                    );


                    resolve(
                        original
                    );

                }

            };


            reader.onerror = () => {

                reject(
                    new Error(
                        "Gagal membaca file image."
                    )
                );

            };


            reader.onabort = () => {

                reject(
                    new Error(
                        "Pembacaan file image dibatalkan."
                    )
                );

            };


            reader.readAsDataURL(
                file
            );

        }
    );

}


/* =========================================================
   LOAD IMAGE
========================================================= */

function loadImage(
    dataUrl
) {

    return new Promise(
        (
            resolve,
            reject
        ) => {

            const image =
                new Image();


            image.onload = () => {

                resolve(
                    image
                );

            };


            image.onerror = () => {

                reject(
                    new Error(
                        "Image tidak dapat diproses oleh browser."
                    )
                );

            };


            image.src =
                dataUrl;

        }
    );

}


/* =========================================================
   VALIDATE IMAGE DIMENSIONS
========================================================= */

function validateImageDimensions(
    image
) {

    const width =
        Number(
            image?.naturalWidth ||
            image?.width ||
            0
        );


    const height =
        Number(
            image?.naturalHeight ||
            image?.height ||
            0
        );


    if (
        !width ||
        !height
    ) {

        throw new Error(
            "Dimensi image tidak dapat dibaca."
        );

    }


    if (
        width <
        VISION_UPLOAD_CONFIG.minWidth ||
        height <
        VISION_UPLOAD_CONFIG.minHeight
    ) {

        throw new Error(
            `Resolusi image terlalu kecil. Minimal ${VISION_UPLOAD_CONFIG.minWidth} × ${VISION_UPLOAD_CONFIG.minHeight}px.`
        );

    }


    if (
        width >
        VISION_UPLOAD_CONFIG.maxWidth ||
        height >
        VISION_UPLOAD_CONFIG.maxHeight
    ) {

        throw new Error(
            `Resolusi image terlalu besar. Maksimal ${VISION_UPLOAD_CONFIG.maxWidth} × ${VISION_UPLOAD_CONFIG.maxHeight}px.`
        );

    }


    return {

        width,

        height

    };

}


/* =========================================================
   CREATE FILE DATA
========================================================= */

function createFileData(
    file,
    dataUrl,
    dimensions
) {

    const mimeType =
        file.type ||
        "image/jpeg";


    const extension =
        getFileExtension(
            file.name
        );


    return {

        original:
            file,

        name:
            file.name ||
            "reference-image",

        size:
            file.size,

        type:
            file.type ||
            mimeType,

        dataUrl,

        mimeType,

        extension,

        width:
            dimensions.width,

        height:
            dimensions.height

    };

}


/* =========================================================
   PROCESS REFERENCE IMAGE
========================================================= */

async function processFile(
    file
) {

    validateFile(
        file
    );


    const dataUrl =
        await readFileAsDataURL(
            file
        );


    const image =
        await loadImage(
            dataUrl
        );


    const dimensions =
        validateImageDimensions(
            image
        );


    const fileData =
        createFileData(
            file,
            dataUrl,
            dimensions
        );


    getState().setFile(
        fileData
    );


    return fileData;

}


/* =========================================================
   PROCESS REPLACEMENT CHARACTER
========================================================= */

async function processReplacementCharacter(
    file
) {

    validateFile(
        file
    );


    const dataUrl =
        await readFileAsDataURL(
            file
        );


    const image =
        await loadImage(
            dataUrl
        );


    const dimensions =
        validateImageDimensions(
            image
        );


    const fileData =
        createFileData(
            file,
            dataUrl,
            dimensions
        );


    getState()
        .setReplacementCharacter(
            fileData
        );


    return fileData;

}


/* =========================================================
   HANDLE REFERENCE FILE INPUT
========================================================= */

async function handleFileInput(
    event
) {

    const input =
        event?.target;


    const files =
        Array.from(
            input?.files ||
            []
        );


    if (
        files.length === 0
    ) {

        return null;

    }


    return processFile(
        files[0]
    );

}


/* =========================================================
   HANDLE REFERENCE DROP
========================================================= */

async function handleDrop(
    event
) {

    const files =
        Array.from(
            event?.dataTransfer?.files ||
            []
        );


    if (
        files.length === 0
    ) {

        return null;

    }


    return processFile(
        files[0]
    );

}


/* =========================================================
   HANDLE REPLACEMENT CHARACTER INPUT
========================================================= */

async function handleReplacementCharacterInput(
    event
) {

    const input =
        event?.target;


    const files =
        Array.from(
            input?.files ||
            []
        );


    if (
        files.length === 0
    ) {

        return null;

    }


    return processReplacementCharacter(
        files[0]
    );

}


/* =========================================================
   HANDLE REPLACEMENT CHARACTER DROP
========================================================= */

async function handleReplacementCharacterDrop(
    event
) {

    const files =
        Array.from(
            event?.dataTransfer?.files ||
            []
        );


    if (
        files.length === 0
    ) {

        return null;

    }


    return processReplacementCharacter(
        files[0]
    );

}


/* =========================================================
   REMOVE REFERENCE IMAGE
========================================================= */

function removeFile() {

    return getState()
        .clearFile();

}


/* =========================================================
   REMOVE REPLACEMENT CHARACTER
========================================================= */

function removeReplacementCharacter() {

    return getState()
        .clearReplacementCharacter();

}


/* =========================================================
   GET REFERENCE IMAGE
========================================================= */

function getFile() {

    return getState()
        .getFile();

}


/* =========================================================
   GET REPLACEMENT CHARACTER
========================================================= */

function getReplacementCharacter() {

    return getState()
        .getReplacementCharacter();

}


/* =========================================================
   CHECK REFERENCE IMAGE
========================================================= */

function hasFile() {

    return getState()
        .hasFile();

}


/* =========================================================
   CHECK REPLACEMENT CHARACTER
========================================================= */

function hasReplacementCharacter() {

    return getState()
        .hasReplacementCharacter();

}


/* =========================================================
   GET CONFIG
========================================================= */

function getConfig() {

    return VISION_UPLOAD_CONFIG;

}


/* =========================================================
   PUBLIC API
========================================================= */

const GENZVisionUpload =
    Object.freeze({

        /* -------------------------------------------------
           CONFIG
        ------------------------------------------------- */

        config:
            VISION_UPLOAD_CONFIG,

        compressionConfig:
            VISION_COMPRESSION_CONFIG,

        getConfig,


        /* -------------------------------------------------
           VALIDATION
        ------------------------------------------------- */

        validateFile,

        validateMimeType,

        validateFileSize,

        validateImageDimensions,


        /* -------------------------------------------------
           FILE HELPERS
        ------------------------------------------------- */

        getFileExtension,

        readFileAsDataURL,

        compressDataUrl,

        loadImage,

        createFileData,


        /* -------------------------------------------------
           REFERENCE IMAGE
        ------------------------------------------------- */

        processFile,

        handleFileInput,

        handleDrop,

        removeFile,

        getFile,

        hasFile,


        /* -------------------------------------------------
           REPLACEMENT CHARACTER
        ------------------------------------------------- */

        processReplacementCharacter,

        handleReplacementCharacterInput,

        handleReplacementCharacterDrop,

        removeReplacementCharacter,

        getReplacementCharacter,

        hasReplacementCharacter

    });


/* =========================================================
   GLOBAL EXPORT
========================================================= */

window.GENZVisionUpload =
    GENZVisionUpload;
