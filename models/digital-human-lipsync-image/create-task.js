/**
 * =========================================================
 * GEN-Z.AI
 * DIGITAL HUMAN - LIPSYNC IMAGE
 * ---------------------------------------------------------
 * File:
 * models/digital-human-lipsync-image/create-task.js
 *
 * Fungsi:
 * - Validasi parameter model
 * - Build payload Motiongen
 * - Submit generation ke Motiongen-AI
 *
 * Provider:
 * Motiongen-AI
 *
 * IMPORTANT:
 * - Tidak menggunakan KIE
 * - Tidak ada KIE fallback
 * - audio_url WAJIB
 * - image_urls WAJIB tepat 1
 * - duration mengikuti parameters.js
 * - aspect_ratio mengikuti parameters.js
 * - resolution tidak dikirim ke provider
 * =========================================================
 */

import {
    createGeneration
} from "../../provider/motiongen-ai/client.js";

import config from "./config.js";

import {
    validate
} from "./parameters.js";

import {
    getSource,
    sanitizeParameters,
    buildPayload
} from "./parameter-adapter.js";


/**
 * =========================================================
 * BUILD INPUT
 * =========================================================
 *
 * Mengambil parameter model dari request Generate.
 *
 * Tidak memasukkan:
 *
 * - resolution
 * - credit
 * - provider
 * - nsfw_checker
 * - KIE fields
 * =========================================================
 */

function buildInput(
    input = {}
) {

    const source =
        getSource(input);

    const parameters =
        sanitizeParameters(
            source
        );


    return parameters;

}


/**
 * =========================================================
 * BUILD PAYLOAD
 * =========================================================
 */

function buildMotiongenPayload(
    input = {}
) {

    const payload =
        buildPayload(
            input,
            config.id
        );


    return payload;

}


/**
 * =========================================================
 * EXTRACT API KEY
 * =========================================================
 *
 * api/generate.js sudah bertanggung jawab mengambil
 * credential dari provider_credentials.
 *
 * File ini hanya menerima apiKey dari caller.
 * =========================================================
 */

function normalizeApiKey(
    apiKey
) {

    const normalized =
        String(
            apiKey || ""
        ).trim();


    if (!normalized) {

        const error =
            new Error(
                "API key Motiongen-AI tidak tersedia."
            );

        error.code =
            "MOTIONGEN_API_KEY_MISSING";

        throw error;

    }


    return normalized;

}


/**
 * =========================================================
 * VALIDATE INPUT
 * =========================================================
 */

function validateInput(
    input
) {

    const source =
        getSource(input);


    const validation =
        validate(
            source
        );


    if (
        !validation.valid
    ) {

        const error =
            new Error(
                validation.errors.join(" ")
            );


        error.code =
            "INVALID_MOTIONGEN_MODEL_INPUT";


        error.provider =
            "motiongen";


        error.model =
            config.id;


        error.validationErrors =
            validation.errors;


        throw error;

    }


    return source;

}


/**
 * =========================================================
 * CREATE TASK
 * =========================================================
 *
 * API:
 *
 * POST https://app.motiongenai.pro/api/v1/generate
 *
 * =========================================================
 */

async function createTask(
    input = {},
    apiKey
) {

    /**
     * -----------------------------------------------------
     * API KEY
     * -----------------------------------------------------
     */

    const normalizedApiKey =
        normalizeApiKey(
            apiKey
        );


    /**
     * -----------------------------------------------------
     * VALIDATE MODEL INPUT
     * -----------------------------------------------------
     */

    const source =
        validateInput(
            input
        );


    /**
     * -----------------------------------------------------
     * BUILD PAYLOAD
     * -----------------------------------------------------
     */

    const payload =
        buildMotiongenPayload(
            source
        );


    /**
     * -----------------------------------------------------
     * FINAL SAFETY CHECK
     * -----------------------------------------------------
     *
     * Jangan biarkan audio hilang sebelum request.
     *
     * Ini sengaja dilakukan lagi di boundary provider.
     * Karena satu validasi saja terlalu optimistis untuk
     * software produksi.
     * -----------------------------------------------------
     */

    if (
        !Array.isArray(
            payload.image_urls
        ) ||
        payload.image_urls.length !== 1
    ) {

        const error =
            new Error(
                "Motiongen membutuhkan tepat 1 image."
            );

        error.code =
            "MOTIONGEN_IMAGE_REQUIRED";

        error.provider =
            "motiongen";

        throw error;

    }


    if (
        typeof payload.audio_url !== "string" ||
        !payload.audio_url.trim()
    ) {

        const error =
            new Error(
                "Motiongen membutuhkan audio."
            );

        error.code =
            "MOTIONGEN_AUDIO_REQUIRED";

        error.provider =
            "motiongen";

        throw error;

    }


    if (
        typeof payload.prompt !== "string" ||
        !payload.prompt.trim()
    ) {

        const error =
            new Error(
                "Prompt Motiongen wajib diisi."
            );

        error.code =
            "MOTIONGEN_PROMPT_REQUIRED";

        error.provider =
            "motiongen";

        throw error;

    }


    /**
     * -----------------------------------------------------
     * SEND TO MOTIONGEN
     * -----------------------------------------------------
     */

    const response =
        await createGeneration(
            payload,
            normalizedApiKey
        );


    /**
     * -----------------------------------------------------
     * NORMALIZED RESULT
     * -----------------------------------------------------
     */

    return {

        ...response,

        provider:
            "motiongen",

        providerId:
            "motiongen",

        providerName:
            "Motiongen-AI",

        model:
            config.id,

        modelId:
            config.id,

        payload

    };

}


/**
 * =========================================================
 * EXPORT
 * =========================================================
 */

export {

    buildInput,

    buildMotiongenPayload,

    validateInput,

    createTask

};


export default {

    buildInput,

    buildMotiongenPayload,

    validateInput,

    createTask

};
