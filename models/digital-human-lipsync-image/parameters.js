/**
 * =========================================================
 * GEN-Z.AI
 * DIGITAL HUMAN - LIPSYNC IMAGE
 * ---------------------------------------------------------
 * File:
 * models/digital-human-lipsync-image/parameters.js
 *
 * Provider:
 * Motiongen-AI
 *
 * Model:
 * digital-human-lipsync-image
 *
 * Credit:
 * 3.5 credit / video
 *
 * IMPORTANT:
 * - audio_url WAJIB
 * - image_urls WAJIB
 * - duration berasal dari file ini
 * - aspect_ratio berasal dari file ini
 * - resolution TIDAK dikirim ke Motiongen API
 * - resolution merupakan parameter bisnis GEN-Z.AI
 *   yang dikelola melalui Edit Model
 * =========================================================
 */


/**
 * =========================================================
 * PARAMETER DEFINITIONS
 * =========================================================
 */

const parameters = [

    /**
     * =====================================================
     * PROMPT
     * =====================================================
     */

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
            "Instruksi untuk menghasilkan video lip-sync."

    },


    /**
     * =====================================================
     * IMAGE URLS
     * =====================================================
     *
     * Tepat 1 gambar.
     *
     * Public JPG / PNG.
     * =====================================================
     */

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
            "Satu URL gambar publik JPG atau PNG."

    },


    /**
     * =====================================================
     * AUDIO URL
     * =====================================================
     *
     * WAJIB.
     *
     * Public MP3 / WAV.
     *
     * Tidak boleh optional.
     * =====================================================
     */

    {

        name:
            "audio_url",

        type:
            "string",

        required:
            true,

        description:
            "Satu URL audio publik MP3 atau WAV."

    },


    /**
     * =====================================================
     * ASPECT RATIO
     * =====================================================
     *
     * Dikelola oleh parameters.js.
     *
     * Tidak ditampilkan sebagai field Edit Model.
     * =====================================================
     */

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
            "Aspect ratio video."

    },


    /**
     * =====================================================
     * DURATION
     * =====================================================
     *
     * Dikelola oleh parameters.js.
     *
     * Tidak ditampilkan sebagai field Edit Model.
     *
     * Supported:
     *
     * 10
     * 15
     * 20
     * 25
     * 30
     * =====================================================
     */

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
            "Durasi video dalam detik."

    },


    /**
     * =====================================================
     * WEBHOOK URL
     * =====================================================
     *
     * Optional.
     *
     * Alias webhook ditangani oleh parameter-adapter.
     * =====================================================
     */

    {

        name:
            "webhook_url",

        type:
            "string",

        required:
            false,

        description:
            "URL webhook untuk menerima status job."

    }

];


/**
 * =========================================================
 * VALIDATE
 * =========================================================
 */

function validate(input = {}) {

    const errors = [];


    /**
     * =====================================================
     * PROMPT
     * =====================================================
     */

    if (
        typeof input.prompt !== "string" ||
        !input.prompt.trim()
    ) {

        errors.push(
            "Prompt wajib diisi."
        );

    } else if (
        input.prompt.length > 30000
    ) {

        errors.push(
            "Prompt maksimal 30000 karakter."
        );

    }


    /**
     * =====================================================
     * IMAGE
     * =====================================================
     */

    if (
        !Array.isArray(
            input.image_urls
        )
    ) {

        errors.push(
            "image_urls wajib berupa array."
        );

    } else if (
        input.image_urls.length !== 1
    ) {

        errors.push(
            "Wajib menyertakan tepat 1 image."
        );

    } else if (
        typeof input.image_urls[0] !== "string" ||
        !input.image_urls[0].trim()
    ) {

        errors.push(
            "image_urls harus berisi URL gambar yang valid."
        );

    }


    /**
     * =====================================================
     * AUDIO
     * =====================================================
     *
     * HARD REQUIRED.
     * =====================================================
     */

    if (
        typeof input.audio_url !== "string" ||
        !input.audio_url.trim()
    ) {

        errors.push(
            "Audio wajib diupload atau menggunakan URL audio."
        );

    }


    /**
     * =====================================================
     * ASPECT RATIO
     * =====================================================
     */

    if (
        input.aspect_ratio !== undefined &&
        input.aspect_ratio !== null &&
        input.aspect_ratio !== ""
    ) {

        if (
            !parameters
                .find(
                    parameter =>
                        parameter.name ===
                        "aspect_ratio"
                )
                .enum
                .includes(
                    input.aspect_ratio
                )
        ) {

            errors.push(
                "Aspect ratio tidak didukung."
            );

        }

    }


    /**
     * =====================================================
     * DURATION
     * =====================================================
     */

    if (
        input.duration !== undefined &&
        input.duration !== null &&
        input.duration !== ""
    ) {

        const duration =
            Number(
                input.duration
            );

        const supportedDurations =
            parameters
                .find(
                    parameter =>
                        parameter.name ===
                        "duration"
                )
                .enum;


        if (
            !supportedDurations.includes(
                duration
            )
        ) {

            errors.push(
                "Duration harus 10, 15, 20, 25, atau 30 detik."
            );

        }

    }


    /**
     * =====================================================
     * WEBHOOK
     * =====================================================
     */

    if (
        input.webhook_url !== undefined &&
        input.webhook_url !== null &&
        input.webhook_url !== ""
    ) {

        if (
            typeof input.webhook_url !==
            "string"
        ) {

            errors.push(
                "webhook_url harus berupa string."
            );

        }

    }


    /**
     * =====================================================
     * RESULT
     * =====================================================
     */

    return {

        valid:
            errors.length === 0,

        errors

    };

}


export {

    parameters,

    validate

};

export default parameters;
