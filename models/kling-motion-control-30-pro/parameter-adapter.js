/* =========================================================
   GEN-Z.AI
   MOTIONGEN-AI
   KLING MOTION CONTROL 3.0 PRO (30s)
   ---------------------------------------------------------
   File:
     models/kling-motion-control-30-pro/parameter-adapter.js

   Fungsi:
   - Normalisasi parameter
   - Sanitasi payload
   - Whitelist field ke Motiongen
========================================================= */

import {
    validate
} from "./parameters.js";


/* =========================================================
   ALLOWED FIELDS — sesuai spec Motiongen
========================================================= */

const KLING_ALLOWED_FIELDS = new Set([
    "model",
    "prompt",
    "aspect_ratio",
    "image_urls",
    "video_urls",
    "webhook_url"
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
            normalizeUrlArray(
                source.image_urls
            ),

        video_urls:
            normalizeUrlArray(
                source.video_urls
            ),

        aspect_ratio:
            source.aspect_ratio == null

                ? "9:16"

                : normalizeString(
                    source.aspect_ratio
                )

    };


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

    const parameters =
        getParameters(
            body
        );


    parameters.prompt =
        normalizeString(
            parameters.prompt
        );


    parameters.image_urls =
        normalizeUrlArray(
            parameters.image_urls
        );


    parameters.video_urls =
        normalizeUrlArray(
            parameters.video_urls
        );


    if (
        !parameters.aspect_ratio
    ) {

        parameters.aspect_ratio =
            "9:16";

    }


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
        "kling-mc-30-pro-s6";


    const payload = {

        model,

        ...parameters

    };


    for (
        const key of
        Object.keys(
            payload
        )
    ) {

        if (
            !KLING_ALLOWED_FIELDS.has(
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
