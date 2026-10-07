/* =========================================================
   GEN-Z.AI
   MOTIONGEN-AI PROVIDER CLIENT
   ---------------------------------------------------------
   File:
     provider/motiongen-ai/client.js

   Fungsi:
   - HTTP client untuk Motiongen-AI
   - Create generation job
   - Query generation job
   - Authorization Bearer
   - Normalisasi response
   - Normalisasi error

   Provider:
     motiongen

   API:
     https://app.motiongenai.pro

   IMPORTANT:
   - API key TIDAK disimpan di file ini.
   - API key diberikan dari server melalui parameter apiKey.
   - Tidak ada fallback ke KIE.AI.
========================================================= */

const DEFAULT_BASE_URL =
    "https://app.motiongenai.pro";


const PROVIDER_ID =
    "motiongen";


const PROVIDER_NAME =
    "Motiongen-AI";


const CREATE_ENDPOINT =
    "/api/v1/generate";


const JOB_ENDPOINT =
    "/api/v1/jobs";


/* =========================================================
   BASE URL
========================================================= */

function getBaseUrl() {

    return (
        DEFAULT_BASE_URL
    )
        .trim()
        .replace(
            /\/+$/,
            ""
        );

}


/* =========================================================
   API KEY
========================================================= */

function normalizeApiKey(
    apiKey
) {

    const value =
        String(
            apiKey || ""
        ).trim();


    if (!value) {

        const error =
            new Error(
                "Motiongen-AI API key is missing"
            );


        error.code =
            "MISSING_API_KEY";


        error.provider =
            PROVIDER_ID;


        error.status =
            401;


        throw error;

    }


    return value;

}


/* =========================================================
   JSON PARSER
========================================================= */

async function parseResponseBody(
    response
) {

    const text =
        await response.text();


    if (!text) {

        return null;

    }


    try {

        return JSON.parse(
            text
        );

    } catch {

        return text;

    }

}


/* =========================================================
   ERROR MESSAGE
========================================================= */

function extractErrorMessage(
    data,
    status
) {

    if (
        data &&
        typeof data ===
            "object"
    ) {

        return (

            data.message ||

            data.error?.message ||

            data.error ||

            data.detail ||

            data.details ||

            `Motiongen-AI request failed with status ${status}`

        );

    }


    if (
        typeof data ===
            "string" &&
        data.trim()
    ) {

        return data.trim();

    }


    return (
        `Motiongen-AI request failed with status ${status}`
    );

}


/* =========================================================
   ERROR NORMALIZATION
========================================================= */

function createProviderError(
    response,
    data
) {

    const status =
        Number(
            response?.status || 0
        );


    const message =
        extractErrorMessage(
            data,
            status
        );


    const error =
        new Error(
            message
        );


    error.provider =
        PROVIDER_ID;


    error.providerName =
        PROVIDER_NAME;


    error.status =
        status || null;


    error.statusCode =
        status || null;


    error.data =
        data;


    /*
     * Motiongen documented error codes:
     *
     * 401
     * MISSING_API_KEY
     * INVALID_API_KEY
     *
     * 403
     * DEVELOPER_NOT_APPROVED
     *
     * 402
     * INSUFFICIENT_CREDITS
     *
     * 400
     * INVALID_PAYLOAD
     * INVALID_MODEL_INPUT
     *
     * 404
     * JOB_NOT_FOUND
     * MODEL_NOT_FOUND
     *
     * 503
     * MODEL_MAINTENANCE
     *
     * 500
     * INTERNAL_SERVER_ERROR
     */

    if (
        data &&
        typeof data ===
            "object"
    ) {

        error.code =
            data.code ||
            data.error?.code ||
            null;

    }


    if (
        !error.code
    ) {

        switch (
            status
        ) {

            case 400:

                error.code =
                    "INVALID_PAYLOAD";

                break;


            case 401:

                error.code =
                    "INVALID_API_KEY";

                break;


            case 402:

                error.code =
                    "INSUFFICIENT_CREDITS";

                break;


            case 403:

                error.code =
                    "DEVELOPER_NOT_APPROVED";

                break;


            case 404:

                error.code =
                    "JOB_NOT_FOUND";

                break;


            case 503:

                error.code =
                    "MODEL_MAINTENANCE";

                break;


            case 500:

                error.code =
                    "INTERNAL_SERVER_ERROR";

                break;


            default:

                error.code =
                    "MOTIONGEN_REQUEST_FAILED";

        }

    }


    return error;

}


/* =========================================================
   GENERIC REQUEST
========================================================= */

async function request(
    path,
    options = {},
    apiKey
) {

    const normalizedApiKey =
        normalizeApiKey(
            apiKey
        );


    const baseUrl =
        getBaseUrl();


    const endpoint =
        String(
            path || ""
        )
            .trim();


    if (!endpoint) {

        throw new Error(
            "Motiongen-AI endpoint is missing"
        );

    }


    const url =
        `${baseUrl}${endpoint}`;


    const method =
        String(
            options.method ||
            "GET"
        )
            .trim()
            .toUpperCase();


    const headers = {

        Authorization:
            `Bearer ${normalizedApiKey}`,

        Accept:
            "application/json",

        ...(options.headers || {})

    };


    const requestOptions = {

        ...options,

        method,

        headers

    };


    const response =
        await fetch(
            url,
            requestOptions
        );


    const data =
        await parseResponseBody(
            response
        );


    if (
        !response.ok
    ) {

        throw createProviderError(
            response,
            data
        );

    }


    return data;

}


/* =========================================================
   CREATE GENERATION
========================================================= */

async function createGeneration(
    payload,
    apiKey
) {

    if (
        !payload ||
        typeof payload !==
            "object" ||
        Array.isArray(
            payload
        )
    ) {

        throw new Error(
            "Motiongen-AI generation payload must be an object"
        );

    }


    const response =
        await request(
            CREATE_ENDPOINT,
            {

                method:
                    "POST",

                headers: {

                    "Content-Type":
                        "application/json"

                },

                body:
                    JSON.stringify(
                        payload
                    )

            },
            apiKey
        );


    const jobId =

        response?.job_id ||

        response?.jobId ||

        response?.data?.job_id ||

        response?.data?.jobId ||

        response?.data?.id ||

        null;


    const status =

        response?.status ||

        response?.data?.status ||

        "QUEUED";


    const creditsHeld =

        response?.credits_held ??

        response?.data?.credits_held ??

        null;


    return {

        success:
            response?.success !== false,

        provider:
            PROVIDER_ID,

        providerName:
            PROVIDER_NAME,

        jobId,

        job_id:
            jobId,

        taskId:
            jobId,

        task_id:
            jobId,

        status,

        creditsHeld,

        credits_held:
            creditsHeld,

        raw:
            response

    };

}


/* =========================================================
   GET JOB
========================================================= */

async function getJob(
    jobId,
    apiKey
) {

    const normalizedJobId =
        String(
            jobId || ""
        ).trim();


    if (
        !normalizedJobId
    ) {

        const error =
            new Error(
                "Motiongen-AI job ID is required"
            );


        error.code =
            "JOB_ID_MISSING";


        error.provider =
            PROVIDER_ID;


        throw error;

    }


    const response =
        await request(
            `${JOB_ENDPOINT}/${encodeURIComponent(normalizedJobId)}`,
            {

                method:
                    "GET"

            },
            apiKey
        );


    const data =
        response?.data &&
        typeof response.data ===
            "object"

            ? response.data

            : response;


    const id =

        data?.id ||

        data?.job_id ||

        data?.jobId ||

        normalizedJobId;


    const status =
        String(
            data?.status ||
            ""
        )
            .trim()
            .toUpperCase();


    const outputUrls =

        Array.isArray(
            data?.output_urls
        )

            ? data.output_urls

            : Array.isArray(
                data?.outputUrls
            )

                ? data.outputUrls

                : [];


    const errorMessage =

        data?.error_message ||

        data?.error?.message ||

        data?.error ||

        null;


    return {

        success:
            response?.success !== false,

        provider:
            PROVIDER_ID,

        providerName:
            PROVIDER_NAME,

        id,

        jobId:
            id,

        job_id:
            id,

        taskId:
            id,

        task_id:
            id,

        status,

        kind:
            data?.kind ||
            null,

        model:
            data?.model ||
            null,

        creditCost:
            data?.credit_cost ??
            null,

        credit_cost:
            data?.credit_cost ??
            null,

        outputUrls,

        output_urls:
            outputUrls,

        errorMessage,

        error_message:
            errorMessage,

        raw:
            response

    };

}


/* =========================================================
   EXPORTS
========================================================= */

export {

    PROVIDER_ID,

    PROVIDER_NAME,

    DEFAULT_BASE_URL,

    CREATE_ENDPOINT,

    JOB_ENDPOINT,

    request,

    createGeneration,

    getJob

};


export default {

    providerId:
        PROVIDER_ID,

    providerName:
        PROVIDER_NAME,

    baseUrl:
        DEFAULT_BASE_URL,

    createGeneration,

    getJob,

    request

};
