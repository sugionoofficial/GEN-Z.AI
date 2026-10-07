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
   - prompt WAJIB
   - duration mengikuti parameter Motiongen
   - aspect_ratio mengikuti parameter Motiongen
   - resolution TIDAK didefinisikan di sini
   - credit TIDAK didefinisikan di sini
   - nsfw_checker TIDAK digunakan
========================================================= */


/* =========================================================
   PARAMETER DEFINITIONS
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
            true,

        maxLength:
            30000,

        description:
            "Prompt untuk Digital Human LipSync."

    },


    /* =====================================================
       IMAGE
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
       Provider-owned parameter
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
       Provider-owned parameter
    ===================================================== */

    {

        name:
            "duration",

        type:
            "number",

        required:
            false,

        enum: [

            10,

            15,

            20,

            25,

            30

        ],

        default:
            10,

        description:
            "Durasi video dalam detik yang didukung Motiongen-AI."

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
       HARD REQUIRED
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
    ===================================================== */

    const duration =
        input.duration == null

            ? 10

            : Number(
                input.duration
            );


    const durationDefinition =
        getParameter(
            "duration"
        );


    if (
        !Number.isFinite(
            duration
        )
    ) {

        errors.push(
            "Duration harus berupa angka."
        );

    } else if (

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
