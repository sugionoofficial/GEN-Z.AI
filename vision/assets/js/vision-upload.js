/* =========================================================
   GEN-Z.AI VISION
   ---------------------------------------------------------
   File:
   vision/assets/js/vision-upload.js

   Fungsi:
   - Validasi file gambar
   - Membaca file sebagai Data URL
   - Validasi ukuran file
   - Validasi MIME type
   - Validasi dimensi gambar
   - Menyimpan file ke GENZVisionState
   - Tidak melakukan API call
   - Tidak melakukan credit
   - Tidak melakukan history
   - Tidak melakukan analysis
========================================================= */


/* =========================================================
   CONFIGURATION
========================================================= */

const VISION_UPLOAD_CONFIG = Object.freeze({

    /* Maksimum file: 20 MB */
    maxFileSize:
        20 * 1024 * 1024,

    /* Dimensi maksimum gambar */
    maxWidth:
        12000,

    maxHeight:
        12000,

    /* Dimensi minimum */
    minWidth:
        32,

    minHeight:
        32,

    /* MIME type yang diperbolehkan */
    allowedTypes:
        Object.freeze([

            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif"

        ]),

    /* Extension fallback */
    allowedExtensions:
        Object.freeze([

            ".jpg",
            ".jpeg",
            ".png",
            ".webp",
            ".gif"

        ])

});


/* =========================================================
   INTERNAL HELPERS
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


function getDOM() {

    if (
        !window.GENZVisionDOM
    ) {

        throw new Error(
            "GENZVisionDOM belum tersedia."
        );

    }


    return window.GENZVisionDOM.getDOM();

}


/* =========================================================
   ERROR FACTORY
========================================================= */

function createUploadError(
    code,
    message
) {

    const error =
        new Error(message);

    error.name =
        "VisionUploadError";

    error.code =
        code;

    return error;

}


/* =========================================================
   FORMAT FILE SIZE
========================================================= */

function formatFileSize(
    bytes
) {

    const value =
        Number(bytes);


    if (
        !Number.isFinite(value) ||
        value <= 0
    ) {

        return "0 B";

    }


    const units = [

        "B",
        "KB",
        "MB",
        "GB"

    ];


    let size =
        value;

    let index =
        0;


    while (
        size >= 1024 &&
        index <
            units.length - 1
    ) {

        size /=
            1024;

        index++;

    }


    const decimals =
        index === 0
            ? 0
            : size >= 10
                ? 1
                : 2;


    return (
        size.toFixed(
            decimals
        ) +
        " " +
        units[index]
    );

}


/* =========================================================
   GET FILE EXTENSION
========================================================= */

function getFileExtension(
    fileName
) {

    if (
        typeof fileName !== "string"
    ) {

        return "";

    }


    const normalized =
        fileName
            .trim()
            .toLowerCase();


    const lastDot =
        normalized.lastIndexOf(".");


    if (
        lastDot === -1
    ) {

        return "";

    }


    return normalized.slice(
        lastDot
    );

}


/* =========================================================
   TYPE VALIDATION
========================================================= */

function isAllowedMimeType(
    file
) {

    if (!file) {

        return false;

    }


    return VISION_UPLOAD_CONFIG
        .allowedTypes
        .includes(
            file.type
        );

}


/* =========================================================
   EXTENSION VALIDATION
========================================================= */

function isAllowedExtension(
    file
) {

    if (!file) {

        return false;

    }


    const extension =
        getFileExtension(
            file.name
        );


    return VISION_UPLOAD_CONFIG
        .allowedExtensions
        .includes(
            extension
        );

}


/* =========================================================
   IMAGE FILE VALIDATION
========================================================= */

function validateFileType(
    file
) {

    if (!file) {

        throw createUploadError(
            "NO_FILE",
            "Tidak ada file gambar yang dipilih."
        );

    }


    const mimeValid =
        isAllowedMimeType(
            file
        );


    const extensionValid =
        isAllowedExtension(
            file
        );


    if (
        !mimeValid &&
        !extensionValid
    ) {

        throw createUploadError(
            "INVALID_TYPE",
            "Format gambar tidak didukung. Gunakan JPG, PNG, WEBP, atau GIF."
        );

    }


    return true;

}


/* =========================================================
   FILE SIZE VALIDATION
========================================================= */

function validateFileSize(
    file
) {

    if (!file) {

        throw createUploadError(
            "NO_FILE",
            "Tidak ada file gambar yang dipilih."
        );

    }


    const size =
        Number(file.size);


    if (
        !Number.isFinite(size)
    ) {

        throw createUploadError(
            "INVALID_SIZE",
            "Ukuran file tidak dapat dibaca."
        );

    }


    if (
        size <= 0
    ) {

        throw createUploadError(
            "EMPTY_FILE",
            "File gambar kosong."
        );

    }


    if (
        size >
        VISION_UPLOAD_CONFIG.maxFileSize
    ) {

        throw createUploadError(
            "FILE_TOO_LARGE",
            `Ukuran gambar terlalu besar. Maksimum ${formatFileSize(
                VISION_UPLOAD_CONFIG.maxFileSize
            )}.`
        );

    }


    return true;

}


/* =========================================================
   READ FILE
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


            reader.onload =
                () => {

                    const result =
                        reader.result;


                    if (
                        typeof result !==
                        "string"
                    ) {

                        reject(
                            createUploadError(
                                "READ_FAILED",
                                "File gambar gagal dibaca."
                            )
                        );

                        return;

                    }


                    resolve(
                        result
                    );

                };


            reader.onerror =
                () => {

                    reject(
                        createUploadError(
                            "READ_FAILED",
                            "Terjadi kesalahan saat membaca file gambar."
                        )
                    );

                };


            reader.onabort =
                () => {

                    reject(
                        createUploadError(
                            "READ_ABORTED",
                            "Pembacaan file gambar dibatalkan."
                        )
                    );

                };


            try {

                reader.readAsDataURL(
                    file
                );

            } catch (error) {

                reject(
                    createUploadError(
                        "READ_FAILED",
                        error?.message ||
                        "File gambar gagal dibaca."
                    )
                );

            }

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


            image.onload =
                () => {

                    resolve(
                        image
                    );

                };


            image.onerror =
                () => {

                    reject(
                        createUploadError(
                            "INVALID_IMAGE",
                            "File tidak dapat dibaca sebagai gambar."
                        )
                    );

                };


            image.src =
                dataUrl;

        }
    );

}


/* =========================================================
   IMAGE DIMENSION VALIDATION
========================================================= */

function validateImageDimensions(
    image
) {

    if (!image) {

        throw createUploadError(
            "INVALID_IMAGE",
            "Data gambar tidak valid."
        );

    }


    const width =
        Number(
            image.naturalWidth ||
            image.width
        );


    const height =
        Number(
            image.naturalHeight ||
            image.height
        );


    if (
        !width ||
        !height
    ) {

        throw createUploadError(
            "INVALID_DIMENSIONS",
            "Dimensi gambar tidak dapat dibaca."
        );

    }


    if (
        width <
        VISION_UPLOAD_CONFIG.minWidth ||
        height <
        VISION_UPLOAD_CONFIG.minHeight
    ) {

        throw createUploadError(
            "IMAGE_TOO_SMALL",
            `Resolusi gambar terlalu kecil. Minimum ${VISION_UPLOAD_CONFIG.minWidth} × ${VISION_UPLOAD_CONFIG.minHeight} piksel.`
        );

    }


    if (
        width >
        VISION_UPLOAD_CONFIG.maxWidth ||
        height >
        VISION_UPLOAD_CONFIG.maxHeight
    ) {

        throw createUploadError(
            "IMAGE_TOO_LARGE",
            `Resolusi gambar terlalu besar. Maksimum ${VISION_UPLOAD_CONFIG.maxWidth} × ${VISION_UPLOAD_CONFIG.maxHeight} piksel.`
        );

    }


    return {

        width,
        height

    };

}


/* =========================================================
   VALIDATE FILE
========================================================= */

function validateFile(
    file
) {

    validateFileType(
        file
    );

    validateFileSize(
        file
    );


    return true;

}


/* =========================================================
   PROCESS FILE
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


    const mimeType =
        file.type ||
        "image/jpeg";


    const extension =
        getFileExtension(
            file.name
        );


    const fileData = {

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


    getState().setFile(
        fileData
    );


    return fileData;

}


/* =========================================================
   HANDLE FILE INPUT
========================================================= */

async function handleFileInput(
    event
) {

    const file =
        event?.target
            ?.files?.[0] ||
        null;


    if (!file) {

        return null;

    }


    return processFile(
        file
    );

}


/* =========================================================
   HANDLE DROP
========================================================= */

async function handleDrop(
    event
) {

    event?.preventDefault?.();
    event?.stopPropagation?.();


    const files =
        Array.from(
            event?.dataTransfer
                ?.files ||
            []
        );


    if (
        files.length === 0
    ) {

        throw createUploadError(
            "NO_FILE",
            "Tidak ada file gambar yang dilepas."
        );

    }


    const file =
        files[0];


    return processFile(
        file
    );

}


/* =========================================================
   OPEN FILE PICKER
========================================================= */

function openFilePicker() {

    const dom =
        getDOM();


    if (
        !dom.fileInput
    ) {

        throw new Error(
            "Input file Vision tidak ditemukan."
        );

    }


    dom.fileInput.click();

}


/* =========================================================
   RESET FILE INPUT
========================================================= */

function resetFileInput() {

    const dom =
        getDOM();


    if (
        !dom.fileInput
    ) {

        return;

    }


    try {

        dom.fileInput.value =
            "";

    } catch {

        /* Tidak perlu menghentikan proses reset state. */

    }

}


/* =========================================================
   CLEAR FILE
========================================================= */

function clearFile() {

    getState().clearFile();

    resetFileInput();

}


/* =========================================================
   GET CURRENT FILE
========================================================= */

function getCurrentFile() {

    return getState().get(
        "file",
        null
    );

}


/* =========================================================
   HAS FILE
========================================================= */

function hasFile() {

    return getState().hasFile();

}


/* =========================================================
   GET CONFIG
========================================================= */

function getUploadConfig() {

    return VISION_UPLOAD_CONFIG;

}


/* =========================================================
   PUBLIC API
========================================================= */

const GENZVisionUpload = Object.freeze({

    CONFIG:
        VISION_UPLOAD_CONFIG,

    formatFileSize,

    getFileExtension,

    isAllowedMimeType,

    isAllowedExtension,

    validateFileType,

    validateFileSize,

    validateImageDimensions,

    validateFile,

    readFileAsDataURL,

    loadImage,

    processFile,

    handleFileInput,

    handleDrop,

    openFilePicker,

    resetFileInput,

    clearFile,

    getCurrentFile,

    hasFile,

    getUploadConfig

});


/* =========================================================
   GLOBAL EXPORT
========================================================= */

window.GENZVisionUpload =
    GENZVisionUpload;
