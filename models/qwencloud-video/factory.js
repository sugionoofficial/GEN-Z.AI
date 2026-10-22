/* =========================================================
   GEN-Z.AI
   QWENCLOUD VIDEO — ADAPTER FACTORY
   ---------------------------------------------------------
   File:
     models/qwencloud-video/factory.js

   Factory ini menghasilkan adapter model lengkap dari satu
   spec di specs.js. Bentuk adapter mengikuti kontrak repo:

     config
     parameters
     getParameters
     sanitizeParameters
     validate
     buildPayload
     createTask
     queryTask
     isCompleted / isFailed / isProcessing
     normalizeStatus / normalizeOutputUrls

   PAYLOAD PER JENIS MODEL (DashScope)

   t2v     → services/aigc/video-generation/video-synthesis
             input: prompt, negative_prompt, audio_url
             parameters: size, duration, prompt_extend,
                         shot_type

   i2v     → services/aigc/video-generation/video-synthesis
             input: img_url, prompt, negative_prompt
             parameters: resolution, duration, prompt_extend

   r2v     → services/aigc/video-generation/video-synthesis
             input: reference_urls[], prompt
             parameters: size, duration, audio, shot_type

   kf2v    → services/aigc/image2video/video-synthesis
             input: first_frame_url, last_frame_url, prompt
             parameters: resolution, duration, prompt_extend

   animate → services/aigc/image2video/video-synthesis
             input: image_url, video_url
             parameters: mode
========================================================= */

import {
    IMAGE2VIDEO_ENDPOINT,
    PROVIDER_ID,
    PROVIDER_NAME,
    VIDEO_GENERATION_ENDPOINT,
    createVideoTask,
    getTask,
    normalizeOutputUrls,
    normalizeStatus
} from "../../provider/qwencloud/client.js";

import {
    resolveSize
} from "./specs.js";


/* =========================================================
   NORMALIZER
========================================================= */

function normalizeString(
    value
) {

    return value === null ||
        value === undefined
        ? ""
        : String(
            value
        ).trim();

}


function normalizeUrls(
    value
) {

    const values =
        Array.isArray(
            value
        )
            ? value
            : typeof value === "string" && value.trim()
                ? value.split(
                    /[\s,]+/
                )
                : [];


    return values
        .map(
            normalizeString
        )
        .filter(
            Boolean
        );

}


function normalizeBoolean(
    value,
    fallback = true
) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return fallback;

    }


    if (
        typeof value === "boolean"
    ) {

        return value;

    }


    const text =
        String(
            value
        )
            .trim()
            .toLowerCase();


    if (
        ["true", "1", "yes", "on", "ya"].includes(
            text
        )
    ) {

        return true;

    }


    if (
        ["false", "0", "no", "off", "tidak"].includes(
            text
        )
    ) {

        return false;

    }


    return fallback;

}


function getSource(
    body = {}
) {

    if (
        body &&
        typeof body === "object" &&
        !Array.isArray(
            body
        ) &&
        body.parameters &&
        typeof body.parameters === "object" &&
        !Array.isArray(
            body.parameters
        )
    ) {

        return body.parameters;

    }


    return body &&
        typeof body === "object" &&
        !Array.isArray(
            body
        )
            ? body
            : {};

}


function isHttpUrl(
    value
) {

    try {

        const url =
            new URL(
                value
            );


        return (
            url.protocol === "http:" ||
            url.protocol === "https:"
        );

    } catch {

        return false;

    }

}


/* =========================================================
   PARAMETER DEFINITIONS
========================================================= */

function buildParameters(
    spec
) {

    const parameters = [];


    const promptDefinition = {

        name:
            "prompt",

        type:
            "string",

        required:
            spec.kind === "t2v" ||
            spec.kind === "r2v",

        maxLength:
            spec.maxPrompt || 2000,

        description:
            "Deskripsi adegan yang ingin dibuat."

    };


    const negativeDefinition = {

        name:
            "negative_prompt",

        type:
            "string",

        required:
            false,

        maxLength:
            500,

        description:
            "Hal yang tidak ingin muncul di video."

    };


    const ratioDefinition = {
        name: "aspect_ratio",
        type: "string",
        required: false,
        enum: spec.ratios,
        default: spec.ratios[0],
        description: "Rasio aspek video."
    };


    const resolutionDefinition = {
        name: "resolution",
        type: "string",
        required: false,
        enum: spec.resolutions,
        default: spec.resolutions[0],
        description: "Resolusi output video."
    };


    const durationDefinition = {
        name: "duration",
        type: "string",
        required: false,
        enum: spec.durations,
        default: spec.defaultDuration,
        description: "Durasi video dalam detik."
    };


    const promptExtendDefinition = {
        name: "prompt_extend",
        type: "boolean",
        required: false,
        default: true,
        description: "Biarkan QwenCloud memperkaya prompt secara otomatis."
    };


    switch (spec.kind) {

        case "t2v":

            parameters.push(
                promptDefinition
            );


            if (spec.negativePrompt) {

                parameters.push(
                    negativeDefinition
                );

            }


            parameters.push(
                ratioDefinition,
                resolutionDefinition,
                durationDefinition
            );


            if (spec.audioTrack) {

                parameters.push({

                    name:
                        "audio_url",

                    type:
                        "audio_url",

                    required:
                        false,

                    description:
                        "URL audio publik (MP3/WAV) untuk musik atau dialog."

                });

            }


            parameters.push(
                promptExtendDefinition
            );

            break;


        case "i2v":

            parameters.push({

                name:
                    "image_url",

                type:
                    "image_url",

                required:
                    true,

                accept:
                    "image/jpeg,image/png,image/webp",

                description:
                    "URL publik gambar frame pertama."

            });


            parameters.push(
                promptDefinition
            );


            if (spec.negativePrompt) {

                parameters.push(
                    negativeDefinition
                );

            }


            parameters.push(
                resolutionDefinition,
                durationDefinition
            );


            if (spec.audioTrack) {

                parameters.push({

                    name:
                        "audio_url",

                    type:
                        "audio_url",

                    required:
                        false,

                    description:
                        "URL audio publik untuk musik atau dialog."

                });

            }


            parameters.push(
                promptExtendDefinition
            );

            break;


        case "kf2v":

            parameters.push({

                name:
                    "first_frame_url",

                type:
                    "image_url",

                required:
                    true,

                accept:
                    "image/jpeg,image/png,image/webp",

                description:
                    "URL publik gambar frame awal."

            });


            parameters.push({

                name:
                    "last_frame_url",

                type:
                    "image_url",

                required:
                    true,

                accept:
                    "image/jpeg,image/png,image/webp",

                description:
                    "URL publik gambar frame akhir."

            });


            parameters.push(
                promptDefinition
            );


            if (spec.negativePrompt) {

                parameters.push(
                    negativeDefinition
                );

            }


            parameters.push(
                resolutionDefinition,
                promptExtendDefinition
            );

            break;


        case "r2v":

            parameters.push({

                name:
                    "image_urls",

                type:
                    "image_urls",

                required:
                    false,

                maxItems:
                    5,

                accept:
                    "image/jpeg,image/png,image/webp",

                description:
                    "Hingga 5 gambar referensi (karakter, objek, atau latar)."

            });


            parameters.push({

                name:
                    "video_urls",

                type:
                    "video_urls",

                required:
                    false,

                maxItems:
                    1,

                accept:
                    "video/mp4,video/webm",

                description:
                    "Maksimal 1 video referensi (gerak/suara karakter)."

            });


            parameters.push(
                promptDefinition,
                ratioDefinition,
                resolutionDefinition,
                durationDefinition,
                promptExtendDefinition
            );

            break;


        case "animate":

            parameters.push({

                name:
                    "image_url",

                type:
                    "image_url",

                required:
                    true,

                accept:
                    "image/jpeg,image/png,image/webp",

                description:
                    "URL publik gambar karakter yang akan dianimasikan."

            });


            parameters.push({

                name:
                    "video_url",

                type:
                    "video_url",

                required:
                    true,

                accept:
                    "video/mp4,video/webm",

                description:
                    "URL publik video referensi gerakan."

            });


            parameters.push(
                promptDefinition
            );


            parameters.push({

                name:
                    "mode",

                type:
                    "string",

                required:
                    false,

                enum:
                    spec.modes,

                default:
                    spec.defaultMode,

                description:
                    "wan-std lebih cepat & murah, wan-pro lebih halus."

            });

            break;

        default:

            break;

    }


    return parameters;

}


/* =========================================================
   FACTORY
========================================================= */

function createQwenCloudVideoModel(
    spec
) {

    if (
        !spec ||
        !spec.id ||
        !spec.dashscopeModel
    ) {

        throw new Error(
            "QwenCloud model spec is invalid"
        );

    }


    const parameters =
        buildParameters(
            spec
        );


    const definitions =
        new Map(
            parameters.map(
                parameter => [
                    parameter.name,
                    parameter
                ]
            )
        );


    const endpoint =
        spec.kind === "kf2v" ||
        spec.kind === "animate"
            ? IMAGE2VIDEO_ENDPOINT
            : VIDEO_GENERATION_ENDPOINT;


    /* =====================================================
       CONFIG
    ===================================================== */

    const config = {

        id:
            spec.id,

        dashscopeModel:
            spec.dashscopeModel,

        qwencloudModelId:
            spec.dashscopeModel,

        name:
            spec.name,

        providerId:
            PROVIDER_ID,

        providerName:
            PROVIDER_NAME,

        logo:
            "wan.svg",

        type:
            spec.type,

        kind:
            spec.kind,

        adminEditor: {

            hideParameterSummary:
                true,

            ...(spec.resolutions.length
                ? {
                    resolutionOptions:
                        spec.resolutions.map(
                            value => ({
                                value:
                                    value.toLowerCase(),

                                label:
                                    value
                            })
                        )
                }
                : {})

        },

        api: {

            createTask:
                endpoint,

            queryTask:
                "/tasks/{task_id}"

        }

    };


    /* =====================================================
       GET PARAMETERS
    ===================================================== */

    function getParameters(
        body = {}
    ) {

        const source =
            getSource(
                body
            );


        const result = {

            prompt:
                normalizeString(
                    source.prompt
                )

        };


        if (definitions.has("negative_prompt")) {

            result.negative_prompt =
                normalizeString(
                    source.negative_prompt
                );

        }


        if (definitions.has("aspect_ratio")) {

            result.aspect_ratio =
                normalizeString(
                    source.aspect_ratio
                ) ||
                spec.ratios[0];

        }


        if (definitions.has("resolution")) {

            result.resolution =
                normalizeString(
                    source.resolution
                ).toUpperCase() ||
                spec.resolutions[0];

        }


        if (definitions.has("duration")) {

            result.duration =
                normalizeString(
                    source.duration
                ) ||
                spec.defaultDuration;

        }


        if (definitions.has("prompt_extend")) {

            result.prompt_extend =
                normalizeBoolean(
                    source.prompt_extend,
                    true
                );

        }


        if (definitions.has("image_url")) {

            result.image_url =
                normalizeString(
                    source.image_url ||
                    source.img_url
                );

        }


        if (definitions.has("first_frame_url")) {

            result.first_frame_url =
                normalizeString(
                    source.first_frame_url
                );


            result.last_frame_url =
                normalizeString(
                    source.last_frame_url
                );

        }


        if (definitions.has("image_urls")) {

            result.image_urls =
                normalizeUrls(
                    source.image_urls
                );

        }


        if (definitions.has("video_urls")) {

            result.video_urls =
                normalizeUrls(
                    source.video_urls
                );

        }


        if (definitions.has("video_url")) {

            result.video_url =
                normalizeString(
                    source.video_url
                );

        }


        if (definitions.has("audio_url")) {

            result.audio_url =
                normalizeString(
                    source.audio_url
                );

        }


        if (definitions.has("mode")) {

            result.mode =
                normalizeString(
                    source.mode
                ) ||
                spec.defaultMode;

        }


        return result;

    }


    function sanitizeParameters(
        body = {}
    ) {

        return getParameters(
            body
        );

    }


    /* =====================================================
       VALIDATE
    ===================================================== */

    function validate(
        input = {}
    ) {

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


        const errors = [];


        const prompt =
            normalizeString(
                input.prompt
            );


        const promptDefinition =
            definitions.get(
                "prompt"
            );


        if (
            promptDefinition &&
            promptDefinition.required &&
            !prompt
        ) {

            errors.push(
                "Prompt wajib diisi untuk model ini."
            );

        }


        if (
            promptDefinition &&
            prompt.length > promptDefinition.maxLength
        ) {

            errors.push(
                `Prompt maksimal ${promptDefinition.maxLength} karakter.`
            );

        }


        /* ---------- media wajib ---------- */

        const requiredUrlFields =
            parameters
                .filter(
                    parameter =>
                        parameter.required &&
                        (parameter.type === "image_url" ||
                            parameter.type === "video_url")
                )
                .map(
                    parameter => parameter.name
                );


        for (
            const name
            of requiredUrlFields
        ) {

            const value =
                normalizeString(
                    input[name]
                );


            if (!value) {

                errors.push(
                    `${name} wajib diisi.`
                );

                continue;

            }


            if (!isHttpUrl(value)) {

                errors.push(
                    `${name} harus berupa URL HTTP atau HTTPS yang valid.`
                );

            }

        }


        /* ---------- media opsional ---------- */

        for (
            const name
            of [
                "audio_url"
            ]
        ) {

            const value =
                normalizeString(
                    input[name]
                );


            if (
                value &&
                !isHttpUrl(value)
            ) {

                errors.push(
                    `${name} harus berupa URL HTTP atau HTTPS yang valid.`
                );

            }

        }


        const imageUrls =
            normalizeUrls(
                input.image_urls
            );


        const videoUrls =
            normalizeUrls(
                input.video_urls
            );


        if (
            definitions.has("image_urls") &&
            imageUrls.length > 5
        ) {

            errors.push(
                "Maksimal 5 gambar referensi."
            );

        }


        if (
            definitions.has("video_urls") &&
            videoUrls.length > 1
        ) {

            errors.push(
                "Maksimal 1 video referensi."
            );

        }


        for (
            const url
            of [
                ...imageUrls,
                ...videoUrls
            ]
        ) {

            if (!isHttpUrl(url)) {

                errors.push(
                    "Gambar dan video referensi harus berupa URL HTTP atau HTTPS yang valid."
                );

                break;

            }

        }


        if (
            spec.kind === "r2v" &&
            imageUrls.length === 0 &&
            videoUrls.length === 0
        ) {

            errors.push(
                "Model referensi membutuhkan minimal 1 gambar atau 1 video referensi."
            );

        }


        /* ---------- enum ---------- */

        for (
            const name
            of [
                "aspect_ratio",
                "resolution",
                "duration",
                "mode"
            ]
        ) {

            const definition =
                definitions.get(
                    name
                );


            if (
                !definition ||
                !Array.isArray(
                    definition.enum
                )
            ) {

                continue;

            }


            const raw =
                input[name];


            const value =
                raw === null ||
                raw === undefined ||
                raw === ""
                    ? definition.default
                    : String(
                        raw
                    ).trim();


            const normalized =
                name === "resolution"
                    ? value.toUpperCase()
                    : value;


            if (
                !definition.enum.includes(
                    normalized
                )
            ) {

                errors.push(
                    `${name} tidak valid. Pilihan: ${definition.enum.join(", ")}.`
                );

            }

        }


        /* ---------- negative prompt ---------- */

        const negative =
            normalizeString(
                input.negative_prompt
            );


        if (
            negative.length > 500
        ) {

            errors.push(
                "Negative prompt maksimal 500 karakter."
            );

        }


        return {

            valid:
                errors.length === 0,

            errors

        };

    }


    /* =====================================================
       BUILD PAYLOAD
    ===================================================== */

    function buildPayload(
        body = {}
    ) {

        const values =
            getParameters(
                body
            );


        const input = {};

        const parametersOut = {};


        if (values.prompt) {

            input.prompt =
                values.prompt;

        }


        if (
            definitions.has("negative_prompt") &&
            values.negative_prompt
        ) {

            input.negative_prompt =
                values.negative_prompt;

        }


        if (
            definitions.has("audio_url") &&
            values.audio_url
        ) {

            input.audio_url =
                values.audio_url;

        }


        switch (spec.kind) {

            case "t2v": {

                parametersOut.size =
                    resolveSize(
                        values.resolution,
                        values.aspect_ratio
                    );


                parametersOut.duration =
                    Number(
                        values.duration ||
                        spec.defaultDuration ||
                        5
                    );


                parametersOut.prompt_extend =
                    values.prompt_extend !== false;


                if (spec.shotType) {

                    parametersOut.shot_type =
                        "single";

                }

                break;

            }


            case "i2v": {

                input.img_url =
                    values.image_url;


                parametersOut.resolution =
                    values.resolution;


                parametersOut.duration =
                    Number(
                        values.duration ||
                        spec.defaultDuration ||
                        5
                    );


                parametersOut.prompt_extend =
                    values.prompt_extend !== false;

                break;

            }


            case "r2v": {

                const references = [
                    ...(values.image_urls || []),
                    ...(values.video_urls || [])
                ];


                if (references.length) {

                    input.reference_urls =
                        references;

                }


                parametersOut.size =
                    resolveSize(
                        values.resolution,
                        values.aspect_ratio
                    );


                parametersOut.duration =
                    Number(
                        values.duration ||
                        spec.defaultDuration ||
                        5
                    );


                parametersOut.audio =
                    false;


                if (spec.shotType) {

                    parametersOut.shot_type =
                        "single";

                }

                break;

            }


            case "kf2v": {

                input.first_frame_url =
                    values.first_frame_url;


                input.last_frame_url =
                    values.last_frame_url;


                parametersOut.resolution =
                    values.resolution;


                parametersOut.duration =
                    Number(
                        values.duration ||
                        spec.defaultDuration ||
                        5
                    );


                parametersOut.prompt_extend =
                    values.prompt_extend !== false;

                break;

            }


            case "animate": {

                input.image_url =
                    values.image_url;


                input.video_url =
                    values.video_url;


                parametersOut.mode =
                    values.mode ||
                    spec.defaultMode;

                break;

            }


            default:
                break;

        }


        return {

            model:
                spec.dashscopeModel,

            input,

            parameters:
                parametersOut

        };

    }


    /* =====================================================
       CREATE TASK
    ===================================================== */

    async function createTask(
        body = {},
        apiKey
    ) {

        const validation =
            validate(
                body
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
                PROVIDER_ID;


            error.model =
                spec.id;


            error.validationErrors =
                validation.errors;


            throw error;

        }


        const payload =
            buildPayload(
                body
            );


        const response =
            await createVideoTask(
                payload,
                apiKey,
                {
                    endpoint
                }
            );


        if (
            !response?.taskId
        ) {

            const error =
                new Error(
                    "QwenCloud tidak mengembalikan task_id."
                );


            error.code =
                "MISSING_TASK_ID";


            error.provider =
                PROVIDER_ID;


            error.model =
                spec.id;


            error.providerResponse =
                response?.raw ||
                response;


            throw error;

        }


        return {

            ...response,

            success:
                response.success !== false,

            provider:
                PROVIDER_ID,

            providerName:
                PROVIDER_NAME,

            model:
                spec.id,

            dashscope_model:
                spec.dashscopeModel,

            taskId:
                response.taskId,

            task_id:
                response.taskId,

            jobId:
                response.taskId,

            job_id:
                response.taskId,

            payload

        };

    }


    /* =====================================================
       QUERY TASK
    ===================================================== */

    async function queryTask(
        taskId,
        apiKey
    ) {

        const normalizedId =
            normalizeString(
                taskId
            );


        if (!normalizedId) {

            const error =
                new Error(
                    "QwenCloud task ID is required."
                );


            error.code =
                "TASK_ID_MISSING";


            error.provider =
                PROVIDER_ID;


            error.model =
                spec.id;


            throw error;

        }


        const data =
            await getTask(
                normalizedId,
                apiKey
            );


        const output =
            data?.output ||
            {};


        const outputUrls =
            normalizeOutputUrls(
                data
            );


        const status =
            normalizeStatus(
                output.task_status ||
                data?.task_status
            );


        return {

            success:
                true,

            provider:
                PROVIDER_ID,

            providerName:
                PROVIDER_NAME,

            model:
                spec.id,

            id:
                output.task_id ||
                normalizedId,

            taskId:
                normalizedId,

            task_id:
                normalizedId,

            jobId:
                normalizedId,

            job_id:
                normalizedId,

            status,

            outputUrls,

            output_urls:
                outputUrls,

            outputUrl:
                outputUrls[0] ||
                null,

            usage:
                data?.usage ||
                null,

            errorMessage:
                output.message ||
                data?.message ||
                null,

            error_message:
                output.message ||
                data?.message ||
                null,

            raw:
                data

        };

    }


    /* =====================================================
       STATUS HELPERS
    ===================================================== */

    const isCompleted = result =>
        normalizeStatus(
            result?.status
        ) === "COMPLETED";


    const isFailed = result =>
        normalizeStatus(
            result?.status
        ) === "FAILED";


    const isProcessing = result =>
        ["QUEUED", "PROCESSING"].includes(
            normalizeStatus(
                result?.status
            )
        );


    return {

        config,

        parameters,

        validate,

        getParameters,

        sanitizeParameters,

        buildPayload,

        createTask,

        queryTask,

        isCompleted,

        isFailed,

        isProcessing,

        normalizeOutputUrls,

        normalizeStatus

    };

}


export {
    buildParameters,
    createQwenCloudVideoModel,
    getSource,
    normalizeBoolean,
    normalizeString,
    normalizeUrls
};


export default createQwenCloudVideoModel;
