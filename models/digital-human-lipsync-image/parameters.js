/* =========================================================
   GEN-Z.AI
   MOTIONGEN-AI
   DIGITAL HUMAN - LIPSYNC IMAGE
   ---------------------------------------------------------
   File:
     models/digital-human-lipsync-image/parameters.js

   Fungsi:
   - Definisi parameter model
   - Validasi parameter
   - Provider-specific parameter rules

   MODEL:
     digital-human-lipsync-image

   PROVIDER:
     motiongen

   CREDIT:
     3.5 Credit / PER_VIDEO

   IMPORTANT:
   - image_urls WAJIB, tepat 1 image
   - audio_url WAJIB
   - prompt WAJIB (untuk UX, walau API opsional)
   - duration DIKIRIM ke Motiongen API sebagai STRING
     Pilihan: "10", "15", "20", "25", "30"
   - aspect_ratio DIKIRIM ke Motiongen API
   - resolution DIKIRIM ke Motiongen API
     Pilihan: "576p", "720p"
   - resolution juga dipakai GEN-Z.AI untuk hitung credit
   - credit TIDAK didefinisikan di sini
   - nsfw_checker TIDAK digunakan

   API CONTRACT (motiongen.pro):
   {
       "model": "digital-human-lipsync-image-s3",
       "prompt": "...",
       "duration": "10",
       "resolution": "576p",
       "image_urls": ["..."],
       "audio_url": "..."
   }
========================================================= */


/* =========================================================
   PARAMETER DEFINITIONS
========================================================= */

const parameters = [

    /* =====================================================
       PROMPT
       -----------------------------------------------------
       Wajib di UI (untuk UX).
       API motiongen menerima sebagai field opsional.
    ===================================================== */

    {
        name:
            "prompt",

        type:
            "string",

        required:
            true,

        maxLength:
            30000,

        description:
            "Prompt untuk Digital Human LipSync."
    },


    /* =====================================================
       IMAGE
       -----------------------------------------------------
       Motiongen API: image_urls (array).
       Saat ini API hanya mendukung 1 image.
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
            "Satu URL publik JPG atau PNG sebagai sumber wajah Digital Human."
    },


    /* =====================================================
       AUDIO
       -----------------------------------------------------
       Wajib. Dikirim ke Motiongen sebagai audio_url.
    ===================================================== */

    {
        name:
            "audio_url",

        type:
            "string",

        required:
            true,

        description:
            "URL publik file audio MP3 atau WAV untuk proses LipSync."
    },


    /* =====================================================
       ASPECT RATIO
       -----------------------------------------------------
       Provider-owned parameter.
       Dikirim ke Motiongen sebagai aspect_ratio.
    ===================================================== */

    {
        name:
            "aspect_ratio",

        type:
            "string",

        required:
            false,

        enum: [
            "16:9",
            "9:16",
            "1:1"
        ],

        default:
            "16:9",

        description:
            "Aspect ratio video yang didukung Motiongen-AI."
    },


    /* =====================================================
       DURATION
       -----------------------------------------------------
       Dikirim ke Motiongen sebagai STRING (bukan number).
       Contoh: "10", bukan 10.

       Values di enum sudah dalam bentuk STRING supaya
       payload ke API langsung valid tanpa konversi.
    ===================================================== */

    {
        name:
            "duration",

        type:
            "string",

        required:
            false,

        enum: [
            "10",
            "15",
            "20",
            "25",
            "30"
        ],

        default:
            "10",

        description:
            "Durasi video dalam detik yang didukung Motiongen-AI."
    },


    /* =====================================================
       RESOLUTION
       -----------------------------------------------------
       Dikirim ke Motiongen API.

       Pilihan: "576p", "720p"

       Resolution juga dipakai GEN-Z.AI untuk menentukan
       credit:
       - 576p -> credit_480p (fallback)
       - 720p -> credit_720p
    ===================================================== */

    {
        name:
            "resolution",

        type:
            "string",

        required:
            true,

        enum: [
            "576p",
            "720p"
        ],

        default:
            "720p",

        description:
            "Resolusi video (dikirim ke Motiongen-AI) dan dipakai untuk menghitung kredit GEN-Z.AI."
    },


    /* =====================================================
       WEBHOOK
       -----------------------------------------------------
       Parameter internal.
       Sudah otomatis dibuang oleh generate-form-data.js
       sebelum request dikirim dari browser.
    ===================================================== */

    {
        name:
            "webhook_url",

        type:
            "string",

        required:
            false,

        description:
            "URL webhook opsional untuk menerima status job Motiongen-AI."
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
   NORMALIZE STRING
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


/* =========================================================
   NORMALIZE IMAGE URLS
========================================================= */

function normalizeImageUrls(
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


    if (!prompt) {

        errors.push(
            "Prompt wajib diisi."
        );

    } else {

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
        normalizeImageUrls(
            input.image_urls
        );


    if (
        imageUrls.length ===
            0
    ) {

        errors.push(
            "Satu image wajib diupload atau diberikan sebagai URL."
        );

    }


    if (
        imageUrls.length >
            1
    ) {

        errors.push(
            "Motiongen-AI hanya mendukung 1 image."
        );

    }


    /* =====================================================
       AUDIO
    ===================================================== */

    const audioUrl =
        normalizeString(
            input.audio_url
        );


    if (!audioUrl) {

        errors.push(
            "Audio wajib diupload atau diberikan sebagai URL MP3/WAV."
        );

    }


    /* =====================================================
       RESOLUTION
    ===================================================== */

    const resolution =
        input.resolution == null

            ? "720p"

            : String(
                input.resolution
            )
                .trim()
                .toLowerCase();


    const resolutionDefinition =
        getParameter(
            "resolution"
        );


    if (
        resolutionDefinition &&
        Array.isArray(
            resolutionDefinition.enum
        ) &&
        !resolutionDefinition.enum.includes(
            resolution
        )
    ) {

        errors.push(
            `Resolution tidak valid. Gunakan: ${resolutionDefinition.enum.join(", ")}.`
        );

    }


    /* =====================================================
       ASPECT RATIO
    ===================================================== */

    const aspectRatio =
        input.aspect_ratio == null

            ? "16:9"

            : String(
                input.aspect_ratio
            ).trim();


    const aspectRatioDefinition =
        getParameter(
            "aspect_ratio"
        );


    if (
        aspectRatioDefinition &&
        Array.isArray(
            aspectRatioDefinition.enum
        ) &&
        !aspectRatioDefinition.enum.includes(
            aspectRatio
        )
    ) {

        errors.push(
            `Aspect ratio tidak valid. Gunakan: ${aspectRatioDefinition.enum.join(", ")}.`
        );

    }


    /* =====================================================
       DURATION
       -----------------------------------------------------
       Sekarang String, bukan Number.
       Validasi: harus ada di enum.
    ===================================================== */

    const duration =
        input.duration == null

            ? "10"

            : String(
                input.duration
            ).trim();


    const durationDefinition =
        getParameter(
            "duration"
        );


    if (
        durationDefinition &&
        Array.isArray(
            durationDefinition.enum
        ) &&
        !durationDefinition.enum.includes(
            duration
        )
    ) {

        errors.push(
            `Duration tidak valid. Gunakan: ${durationDefinition.enum.join(", ")} detik.`
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

    validate

};


export default parameters;
