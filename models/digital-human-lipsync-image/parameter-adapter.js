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
   - duration dari parameters.js
   - aspect_ratio dari parameters.js
   - resolution tidak dikirim dari adapter
   - credit tidak dikirim dari adapter
   - nsfw_checker tidak digunakan
   - Tidak ada KIE fallback
========================================================= */

import {
    validate
} from "./parameters.js";


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

        return 10;

    }


    const duration =
        Number(
            value
        );


    return Number.isFinite(
        duration
    )

        ? duration

        : value;

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

        aspect_ratio:
            source.aspect_ratio == null

                ? "16:9"

                : normalizeString(
                    source.aspect_ratio
                ),

        duration:
            normalizeDuration(
                source.duration
            )

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


    /*
     * -----------------------------------------------------
     * PROVIDER DEFAULTS
     * -----------------------------------------------------
     */

    if (
        !parameters.aspect_ratio
    ) {

        parameters.aspect_ratio =
            "16:9";

    }


    if (
        parameters.duration ===
            undefined ||
        parameters.duration ===
            null
    ) {

        parameters.duration =
            10;

    }


    /*
     * -----------------------------------------------------
     * IMPORTANT
     * -----------------------------------------------------
     *
     * Jangan menambahkan:
     *
     * - resolution
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
        "digital-human-lipsync-image";


    return {

        model,

        ...parameters

    };

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
