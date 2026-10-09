/* =========================================================
   GEN-Z.AI
   MOTIONGEN-AI
   KLING MOTION CONTROL 3.0 PRO (30s)
   ---------------------------------------------------------
   File:
     models/kling-motion-control-30-pro/create-task.js
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


function resolveMotiongenModelId() {

    const slug =
        String(
            config.motiongenModelId ||
            config.id ||
            ""
        ).trim();

    return (
        slug ||
        "kling-mc-30-pro-s6"
    );

}


function buildMotiongenPayload(
    body = {}
) {

    const input =
        buildInput(
            body
        );

    return buildPayload(
        input,
        resolveMotiongenModelId()
    );

}


function validateRequiredInput(
    input
) {

    const errors = [];


    if (
        !Array.isArray(
            input.image_urls
        ) ||
        input.image_urls.length !==
            1
    ) {

        errors.push(
            "Kling Motion Control membutuhkan tepat 1 gambar referensi."
        );

    }


    if (
        !Array.isArray(
            input.video_urls
        ) ||
        input.video_urls.length !==
            1
    ) {

        errors.push(
            "Kling Motion Control membutuhkan tepat 1 video referensi."
        );

    }


    return errors;

}


async function createTask(
    body = {},
    apiKey
) {

    const input =
        buildInput(
            body
        );


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


    const payload =
        buildMotiongenPayload(
            input
        );


    const expectedModelId =
        resolveMotiongenModelId();


    if (
        !payload ||
        payload.model !==
            expectedModelId
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

        error.expected =
            expectedModelId;

        error.actual =
            payload?.model;

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
                "Kling requires exactly one reference image."
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
        !Array.isArray(
            payload.video_urls
        ) ||
        payload.video_urls.length !==
            1
    ) {

        const error =
            new Error(
                "Kling requires exactly one reference video."
            );

        error.code =
            "INVALID_MODEL_INPUT";

        error.provider =
            config.providerId;

        error.model =
            config.id;

        throw error;

    }


    const response =
        await createGeneration(
            payload,
            apiKey
        );


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

        motiongen_model:
            expectedModelId,

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


export {

    buildInput,

    buildMotiongenPayload,

    createTask

};


export default createTask;
