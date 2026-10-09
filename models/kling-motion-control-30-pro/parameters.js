/* =========================================================
   GEN-Z.AI
   MOTIONGEN-AI
   KLING MOTION CONTROL 3.0 PRO (30s)
   ---------------------------------------------------------
   File:
     models/kling-motion-control-30-pro/parameters.js

   Parameter:
   - prompt         (opsional)
   - image_urls     (wajib, 1 gambar)
   - video_urls     (wajib, 1 video referensi)
   - aspect_ratio   (opsional, default 9:16)
   - webhook_url    (opsional)

   Credit:
     Flat 6 (bukan per-resolution)
========================================================= */


const parameters = [

    /* =====================================================
       PROMPT
    ===================================================== */

    {
        name:
            "prompt",

        type:
            "string",

        required:
            false,

        maxLength:
            30000,

        description:
            "Deskripsi adegan (opsional untuk model ini)."
    },


    /* =====================================================
       IMAGE REFERENCE
    ===================================================== */

    {
        name:
            "image_urls",

        type:
            "array",

        required:
            true,

        minItems:
            1,

        maxItems:
            1,

        description:
            "Satu URL gambar referensi (JPG/PNG/WEBP)."
    },


    /* =====================================================
       VIDEO REFERENCE
    ===================================================== */

    {
        name:
            "video_urls",

        type:
            "array",

        required:
            true,

        minItems:
            1,

        maxItems:
            1,

        description:
            "Satu URL video referensi (MP4/WebM) untuk sumber gerakan."
    },


    /* =====================================================
       ASPECT RATIO
    ===================================================== */

    {
        name:
            "aspect_ratio",

        type:
            "string",

        required:
            false,

        enum: [
            "9:16",
            "16:9"
        ],

        default:
            "9:16",

        description:
            "Aspect ratio video yang didukung Motiongen-AI."
    },


    /* =====================================================
       WEBHOOK
    ===================================================== */

    {
        name:
            "webhook_url",

        type:
            "string",

        required:
            false,

        description:
            "URL webhook opsional untuk menerima callback status job."
    }

];


/* =========================================================
   PARAMETER LOOKUP
========================================================= */

function getParameter(
    name
) {

    return parameters.find(
        parameter =>
            parameter &&
            parameter.name === name
    ) || null;

}


/* =========================================================
   NORMALIZE HELPERS
========================================================= */

function normalizeString(
    value
) {

    if (
        typeof value !==
        "string"
    ) {

        return "";

    }

    return value.trim();

}


function normalizeUrlArray(
    value
) {

    if (
        !Array.isArray(
            value
        )
    ) {

        return [];

    }

    return value
        .map(
            item =>
                normalizeString(
                    item
                )
        )
        .filter(
            Boolean
        )
        .slice(
            0,
            1
        );

}


/* =========================================================
   VALIDATE
========================================================= */

function validate(
    input = {}
) {

    const errors = [];


    if (
        !input ||
        typeof input !==
            "object" ||
        Array.isArray(
            input
        )
    ) {

        return {
            valid:
                false,

            errors: [
                "Parameter input harus berupa object."
            ]
        };

    }


    /* =====================================================
       PROMPT
    ===================================================== */

    const prompt =
        normalizeString(
            input.prompt
        );

    if (prompt) {

        const definition =
            getParameter(
                "prompt"
            );

        if (
            definition &&
            definition.maxLength &&
            prompt.length >
                definition.maxLength
        ) {

            errors.push(
                `Prompt maksimal ${definition.maxLength} karakter.`
            );

        }

    }


    /* =====================================================
       IMAGE
    ===================================================== */

    const imageUrls =
        normalizeUrlArray(
            input.image_urls
        );

    if (
        imageUrls.length ===
            0
    ) {

        errors.push(
            "Satu gambar referensi wajib diupload."
        );

    }


    /* =====================================================
       VIDEO
    ===================================================== */

    const videoUrls =
        normalizeUrlArray(
            input.video_urls
        );

    if (
        videoUrls.length ===
            0
    ) {

        errors.push(
            "Satu video referensi wajib diupload."
        );

    }


    /* =====================================================
       ASPECT RATIO
    ===================================================== */

    const aspectRatio =
        input.aspect_ratio == null

            ? "9:16"

            : String(
                input.aspect_ratio
            ).trim();

    const arDefinition =
        getParameter(
            "aspect_ratio"
        );

    if (
        arDefinition &&
        Array.isArray(
            arDefinition.enum
        ) &&
        !arDefinition.enum.includes(
            aspectRatio
        )
    ) {

        errors.push(
            `Aspect ratio tidak valid. Gunakan: ${arDefinition.enum.join(", ")}.`
        );

    }


    /* =====================================================
       WEBHOOK
    ===================================================== */

    if (
        input.webhook_url != null &&
        normalizeString(
            input.webhook_url
        ) === ""
    ) {

        errors.push(
            "Webhook URL tidak boleh kosong jika dikirim."
        );

    }


    /* =====================================================
       RESULT
    ===================================================== */

    return {
        valid:
            errors.length === 0,
        errors
    };

}


/* =========================================================
   EXPORTS
========================================================= */

export {
    parameters,
    getParameter,
    validate,
    normalizeString,
    normalizeUrlArray
};

export default parameters;
