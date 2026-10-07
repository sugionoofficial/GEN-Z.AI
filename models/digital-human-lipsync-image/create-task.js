/* =========================================================
   GEN-Z.AI
   MOTIONGEN-AI
   DIGITAL HUMAN - LIPSYNC IMAGE
   ---------------------------------------------------------
   File:
     models/digital-human-lipsync-image/create-task.js

   Fungsi:
   - Validasi parameter
   - Build payload Motiongen
   - Submit generation job
   - Mengembalikan job ID
   - Tidak menggunakan KIE.AI

   PROVIDER:
     motiongen

   MODEL:
     digital-human-lipsync-image

   CREDIT:
     3.5 Credit / PER_VIDEO
========================================================= */

import {
    createGeneration
} from "../../provider/motiongen-ai/client.js";


import config
    from "./config.js";


import {
    validate
} from "./parameters.js";


import {
    getSource,
    sanitizeParameters,
    buildPayload
} from "./parameter-adapter.js";


/* =========================================================
   BUILD INPUT
========================================================= */

function buildInput(
    body = {}
) {

    const source =
        getSource(
            body
        );


    return sanitizeParameters(
        source
    );

}


/* =========================================================
   BUILD MOTIONGEN PAYLOAD
========================================================= */

function buildMotiongenPayload(
    body = {}
) {

    const input =
        buildInput(
            body
        );


    return buildPayload(
        input,
        config.id
    );

}


/* =========================================================
   VALIDATE REQUIRED INPUT
========================================================= */

function validateRequiredInput(
    input
) {

    const errors = [];


    /* =====================================================
       PROMPT
    ===================================================== */

    if (
        typeof input.prompt !==
            "string" ||
        !input.prompt.trim()
    ) {

        errors.push(
            "Prompt wajib diisi."
        );

    }


    /* =====================================================
       IMAGE
    ===================================================== */

    if (
        !Array.isArray(
            input.image_urls
        ) ||
        input.image_urls.length !==
            1
    ) {

        errors.push(
            "Motiongen-AI membutuhkan tepat 1 image."
        );

    }


    /* =====================================================
       AUDIO
    ===================================================== */

    if (
        typeof input.audio_url !==
            "string" ||
        !input.audio_url.trim()
    ) {

        errors.push(
            "Audio wajib diisi."
        );

    }


    return errors;

}


/* =========================================================
   CREATE TASK
========================================================= */

async function createTask(
    body = {},
    apiKey
) {

    /*
     * -----------------------------------------------------
     * BUILD INPUT
     * -----------------------------------------------------
     */

    const input =
        buildInput(
            body
        );


    /*
     * -----------------------------------------------------
     * MODEL VALIDATION
     * -----------------------------------------------------
     */

    const validation =
        validate(
            input
        );


    if (
        !validation.valid
    ) {

        const error =
            new Error(
                validation.errors.join(
                    " "
                )
            );


        error.code =
            "INVALID_MODEL_INPUT";


        error.provider =
            config.providerId;


        error.model =
            config.id;


        error.validationErrors =
            validation.errors;


        throw error;

    }


    /*
     * -----------------------------------------------------
     * HARD REQUIRED VALIDATION
     * -----------------------------------------------------
     *
     * Jangan pernah membiarkan request tanpa:
     *
     * - prompt
     * - 1 image
     * - audio
     */

    const requiredErrors =
        validateRequiredInput(
            input
        );


    if (
        requiredErrors.length
    ) {

        const error =
            new Error(
                requiredErrors.join(
                    " "
                )
            );


        error.code =
            "INVALID_MODEL_INPUT";


        error.provider =
            config.providerId;


        error.model =
            config.id;


        error.validationErrors =
            requiredErrors;


        throw error;

    }


    /*
     * -----------------------------------------------------
     * BUILD PAYLOAD
     * -----------------------------------------------------
     */

    const payload =
        buildMotiongenPayload(
            input
        );


    /*
     * -----------------------------------------------------
     * FINAL PAYLOAD SAFETY CHECK
     * -----------------------------------------------------
     */

    if (
        !payload ||
        payload.model !==
            config.id
    ) {

        const error =
            new Error(
                "Motiongen-AI model payload is invalid."
            );


        error.code =
            "INVALID_PAYLOAD";


        error.provider =
            config.providerId;


        error.model =
            config.id;


        throw error;

    }


    if (
        !Array.isArray(
            payload.image_urls
        ) ||
        payload.image_urls.length !==
            1
    ) {

        const error =
            new Error(
                "Motiongen-AI requires exactly one image."
            );


        error.code =
            "INVALID_MODEL_INPUT";


        error.provider =
            config.providerId;


        error.model =
            config.id;


        throw error;

    }


    if (
        typeof payload.audio_url !==
            "string" ||
        !payload.audio_url.trim()
    ) {

        const error =
            new Error(
                "Motiongen-AI requires an audio URL."
            );


        error.code =
            "INVALID_MODEL_INPUT";


        error.provider =
            config.providerId;


        error.model =
            config.id;


        throw error;

    }


    /*
     * -----------------------------------------------------
     * SUBMIT TO MOTIONGEN
     * -----------------------------------------------------
     *
     * apiKey diberikan dari server.
     *
     * Tidak ada:
     *
     * - KIE client
     * - KIE API key
     * - fallback provider
     */

    const response =
        await createGeneration(
            payload,
            apiKey
        );


    /*
     * -----------------------------------------------------
     * EXTRACT JOB ID
     * -----------------------------------------------------
     */

    const jobId =

        response?.jobId ||

        response?.job_id ||

        response?.taskId ||

        response?.task_id ||

        null;


    if (
        !jobId
    ) {

        const error =
            new Error(
                "Motiongen-AI tidak mengembalikan job_id."
            );


        error.code =
            "MISSING_JOB_ID";


        error.provider =
            config.providerId;


        error.model =
            config.id;


        error.providerResponse =
            response;


        throw error;

    }


    /*
     * -----------------------------------------------------
     * RESULT
     * -----------------------------------------------------
     */

    return {

        ...response,

        success:
            response?.success !== false,

        provider:
            config.providerId,

        providerName:
            config.providerName,

        model:
            config.id,

        taskId:
            jobId,

        task_id:
            jobId,

        jobId,

        job_id:
            jobId,

        status:
            response?.status ||
            "QUEUED"

    };

}


/* =========================================================
   EXPORTS
========================================================= */

export {

    buildInput,

    buildMotiongenPayload,

    createTask

};


export default createTask;
