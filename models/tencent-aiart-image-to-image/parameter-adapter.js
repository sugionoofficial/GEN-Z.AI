/* =========================================================
   GEN-Z.AI
   TENCENT AI ART
   IMAGE TO IMAGE (FOTO → GAMBAR ANIME)
   ---------------------------------------------------------
   File:
     models/tencent-aiart-image-to-image/parameter-adapter.js

   Fungsi:
   - Normalisasi parameter dari body request
   - Sanitasi (whitelist field)
   - Susun payload Tencent `ImageToImage`
========================================================= */

import {
    validate,
    normalizeString,
    normalizeUrlArray,
    findPreset,
    STYLE_PRESETS,
    SIMILARITY_PRESETS
} from "./parameters.js";


/* =========================================================
   ALLOWED FIELDS
========================================================= */

const ALLOWED_FIELDS =
    Object.freeze([
        "image_urls",
        "prompt",
        "negative_prompt",
        "gaya",
        "kemiripan"
    ]);


const DEFAULT_STYLE_CODE =
    "201";


const DEFAULT_STRENGTH =
    0.65;


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
        body.parameters &&
        !Array.isArray(
            body.parameters
        )
    ) {

        return body.parameters;

    }


    return body && typeof body === "object"
        ? body
        : {};

}


/* =========================================================
   GET PARAMETERS
========================================================= */

function getParameters(
    body = {}
) {

    return sanitizeParameters(
        getSource(
            body
        )
    );

}


/* =========================================================
   SANITIZE
========================================================= */

function sanitizeParameters(
    source = {}
) {

    const input =
        source && typeof source === "object"
            ? source
            : {};


    const result = {};


    for (
        const field
        of ALLOWED_FIELDS
    ) {

        if (
            input[field] !==
            undefined
        ) {

            result[field] =
                input[field];

        }

    }


    const imageUrls =
        normalizeUrlArray(
            result.image_urls
        );


    if (
        imageUrls.length
    ) {

        result.image_urls =
            imageUrls;

    } else {

        delete result.image_urls;

    }


    const prompt =
        normalizeString(
            String(
                result.prompt ??
                ""
            )
        );


    if (
        prompt
    ) {

        result.prompt =
            prompt;

    } else {

        delete result.prompt;

    }


    const negativePrompt =
        normalizeString(
            String(
                result.negative_prompt ??
                ""
            )
        );


    if (
        negativePrompt
    ) {

        result.negative_prompt =
            negativePrompt;

    } else {

        delete result.negative_prompt;

    }


    const style =
        findPreset(
            STYLE_PRESETS,
            result.gaya
        );


    if (
        style
    ) {

        result.gaya =
            style.value;

    } else {

        delete result.gaya;

    }


    const similarity =
        findPreset(
            SIMILARITY_PRESETS,
            result.kemiripan
        );


    if (
        similarity
    ) {

        result.kemiripan =
            similarity.value;

    } else {

        delete result.kemiripan;

    }


    return result;

}


/* =========================================================
   RESOLVE STYLE / STRENGTH
========================================================= */

function resolveStyleCode(
    value
) {

    const preset =
        findPreset(
            STYLE_PRESETS,
            value
        );


    return preset
        ? preset.code
        : DEFAULT_STYLE_CODE;

}


function resolveStrength(
    value
) {

    const preset =
        findPreset(
            SIMILARITY_PRESETS,
            value
        );


    return preset
        ? preset.strength
        : DEFAULT_STRENGTH;

}


/* =========================================================
   BUILD PAYLOAD (Tencent ImageToImage)
========================================================= */

/**
 * Susun body `ImageToImage` Tencent.
 *
 * @param {object} input hasil sanitizeParameters
 * @returns {object|null} payload, atau null kalau foto belum ada
 */
function buildPayload(
    input = {}
) {

    const imageUrls =
        normalizeUrlArray(
            input.image_urls
        );


    if (
        !imageUrls.length
    ) {

        return null;

    }


    const payload = {

        InputUrl:
            imageUrls[0],

        Styles: [
            resolveStyleCode(
                input.gaya
            )
        ],

        Strength:
            resolveStrength(
                input.kemiripan
            ),

        /*
         * Tanpa watermark "AI generated" bawaan Tencent.
         */
        LogoAdd:
            0,

        /*
         * base64 dipakai supaya gambar tidak bergantung pada
         * URL Tencent yang hanya berlaku 1 jam. Hasil base64
         * langsung disalin ke Supabase Storage oleh
         * api/generate.js.
         */
        RspImgType:
            "base64"

    };


    if (
        input.prompt
    ) {

        payload.Prompt =
            input.prompt;

    }


    if (
        input.negative_prompt
    ) {

        payload.NegativePrompt =
            input.negative_prompt;

    }


    return payload;

}


/* =========================================================
   VALIDATE PARAMETERS
========================================================= */

function validateParameters(
    body = {}
) {

    return validate(
        getParameters(
            body
        )
    );

}


/* =========================================================
   EXPORTS
========================================================= */

export {
    ALLOWED_FIELDS,
    getSource,
    getParameters,
    sanitizeParameters,
    resolveStyleCode,
    resolveStrength,
    buildPayload,
    validateParameters
};


export default {
    getSource,
    getParameters,
    sanitizeParameters,
    resolveStyleCode,
    resolveStrength,
    buildPayload,
    validateParameters
};
