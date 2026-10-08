/* =========================================================
   GEN-Z.AI
   MOTIONGEN-AI
   DIGITAL HUMAN - LIPSYNC IMAGE
   ---------------------------------------------------------
   File:
     models/digital-human-lipsync-image/parameter-adapter.js

   Fungsi:
   - Mengambil source parameter
   - Normalisasi parameter
   - Sanitasi parameter
   - Menjaga payload tetap sesuai API Motiongen

   IMPORTANT:
   - image_urls WAJIB
   - audio_url WAJIB
   - prompt WAJIB
   - duration dari parameters.js (dikirim sebagai STRING)
   - aspect_ratio TIDAK dikirim (tidak didukung Motiongen)
   - resolution TIDAK dikirim (provider pakai default)
   - credit TIDAK dikirim
   - nsfw_checker TIDAK digunakan
   - Tidak ada KIE fallback

   PATCH (2026-10-08):
   - HAPUS `aspect_ratio` dari payload Motiongen.
     Motiongen strict schema — field ilegal menyebabkan
     job FAILED setelah queue atau 500 di initiate.
   - duration dikirim sebagai STRING ("10","15","20","25","30")
     sesuai spec Motiongen, bukan number.
   - Tambah whitelist field (MOTIONGEN_ALLOWED_FIELDS)
     sebagai safety net di buildPayload.
========================================================= */

import {
    validate
} from "./parameters.js";


/* =========================================================
   ALLOWED FIELDS — sesuai spec Motiongen
   https://app.motiongenai.pro/api/v1/generate
========================================================= */

const MOTIONGEN_ALLOWED_FIELDS = new Set([
    "model",
    "prompt",
    "duration",
    "resolution",
    "image_urls",
    "audio_url",
    "webhook_url"
]);


/* =========================================================
   DURATION — nilai valid menurut Motiongen
========================================================= */

const MOTIONGEN_DURATION_VALUES = new Set([
    "10",
    "15",
    "20",
    "25",
    "30"
]);


/* =========================================================
   GET SOURCE
========================================================= */

function getSource(
    body = {}
) {

    if (
        body &&
        typeof body.parameters ===
            "object" &&
        !Array.isArray(
            body.parameters
        )
    ) {

        return body.parameters;

    }


    if (
        body &&
        typeof body ===
            "object" &&
        !Array.isArray(
            body
        )
    ) {

        return body;

    }


    return {};

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
   NORMALIZE DURATION
   ---------------------------------------------------------
   Motiongen menerima string: "10","15","20","25","30".
   Nilai di luar daftar akan fallback ke "10".
========================================================= */

function normalizeDuration(
    value
) {

    if (
        value ===
            undefined ||
        value ===
            null ||
        value ===
            ""
    ) {

        return "10";

    }


    const str =
        String(
            value
        ).trim();


    if (
        MOTIONGEN_DURATION_VALUES.has(
            str
        )
    ) {

        return str;

    }


    /*
     * Kalau user kirim "30.0" atau number 30,
     * parseInt dulu sebelum cek.
     */

    const parsed =
        Number.parseInt(
            str,
            10
        );


    if (
        Number.isFinite(
            parsed
        )
    ) {

        const parsedStr =
            String(
                parsed
            );


        if (
            MOTIONGEN_DURATION_VALUES.has(
                parsedStr
            )
        ) {

            return parsedStr;

        }

    }


    return "10";

}


/* =========================================================
   GET PARAMETERS
========================================================= */

function getParameters(
    body = {}
) {

    const source =
        getSource(
            body
        );


    const parameters = {

        prompt:
            normalizeString(
                source.prompt
            ),

        image_urls:
            normalizeImageUrls(
                source.image_urls
            ),

        audio_url:
            normalizeString(
                source.audio_url
            ),

        duration:
            normalizeDuration(
                source.duration
            )

        /*
         * NOTE:
         * aspect_ratio SENGAJA TIDAK dimasukkan.
         * Motiongen model digital-human-lipsync-image-s3
         * tidak mendukung field aspect_ratio.
         * Rasio output ditentukan oleh gambar input.
         */

    };


    /*
     * -----------------------------------------------------
     * WEBHOOK
     * -----------------------------------------------------
     *
     * Support:
     *
     * webhook_url
     * webhook
     *
     * Canonical output:
     * webhook_url
     */

    const webhookUrl =
        normalizeString(
            source.webhook_url ||
            source.webhook
        );


    if (
        webhookUrl
    ) {

        parameters.webhook_url =
            webhookUrl;

    }


    return parameters;

}


/* =========================================================
   SANITIZE PARAMETERS
========================================================= */

function sanitizeParameters(
    body = {}
) {

    const source =
        getSource(
            body
        );


    const parameters =
        getParameters(
            source
        );


    /*
     * -----------------------------------------------------
     * HARD REQUIREMENTS
     * -----------------------------------------------------
     */

    parameters.prompt =
        normalizeString(
            parameters.prompt
        );


    parameters.image_urls =
        normalizeImageUrls(
            parameters.image_urls
        );


    parameters.audio_url =
        normalizeString(
            parameters.audio_url
        );


    parameters.duration =
        normalizeDuration(
            parameters.duration
        );


    /*
     * -----------------------------------------------------
     * IMPORTANT
     * -----------------------------------------------------
     *
     * Jangan menambahkan:
     *
     * - aspect_ratio     (tidak didukung Motiongen)
     * - resolution       (provider pakai default)
     * - credit
     * - credit_final
     * - credit_480p
     * - credit_720p
     * - credit_1080p
     * - discount_percent
     * - nsfw_checker
     * - provider_id
     * - provider
     * - model_name
     *
     * Field tersebut bukan payload Motiongen.
     */


    return parameters;

}


/* =========================================================
   BUILD PAYLOAD
========================================================= */

function buildPayload(
    body = {},
    modelId
) {

    const parameters =
        sanitizeParameters(
            body
        );


    const model =
        normalizeString(
            modelId
        ) ||
        "digital-human-lipsync-image-s3";


    const payload = {

        model,

        ...parameters

    };


    /*
     * -----------------------------------------------------
     * SAFETY NET
     * -----------------------------------------------------
     * Buang semua field yang tidak ada di whitelist.
     * Mencegah field liar lolos ke Motiongen.
     */

    for (
        const key of
        Object.keys(
            payload
        )
    ) {

        if (
            !MOTIONGEN_ALLOWED_FIELDS.has(
                key
            )
        ) {

            delete payload[
                key
            ];

        }

    }


    return payload;

}


/* =========================================================
   VALIDATE PARAMETERS
========================================================= */

function validateParameters(
    body = {}
) {

    const parameters =
        sanitizeParameters(
            body
        );


    return validate(
        parameters
    );

}


/* =========================================================
   EXPORTS
========================================================= */

export {

    getSource,

    getParameters,

    sanitizeParameters,

    buildPayload,

    validateParameters

};


export default {

    getSource,

    getParameters,

    sanitizeParameters,

    buildPayload,

    validateParameters

};
