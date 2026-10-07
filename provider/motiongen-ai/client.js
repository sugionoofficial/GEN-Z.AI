/**
 * =========================================================
 * GEN-Z.AI
 * MOTIONGEN-AI GENERIC CLIENT
 * ---------------------------------------------------------
 * File:
 * provider/motiongen-ai/client.js
 *
 * Tanggung jawab:
 * - HTTP request ke Motiongen-AI
 * - createGeneration()
 * - getJob()
 * - normalisasi response
 * - normalisasi error
 *
 * Tidak bertanggung jawab:
 * - konfigurasi model
 * - parameter model
 * - pricing
 * - credit user
 * - Supabase
 * - provider_credentials
 * - workflow Generate
 * - fallback provider
 * - KIE.AI
 *
 * API:
 * POST /api/v1/generate
 * GET  /api/v1/jobs/{job_id}
 * =========================================================
 */


/**
 * =========================================================
 * DEFAULT CONFIGURATION
 * =========================================================
 */

const DEFAULT_BASE_URL =
    "https://app.motiongenai.pro";

const GENERATE_PATH =
    "/api/v1/generate";

const JOB_PATH =
    "/api/v1/jobs";


/**
 * =========================================================
 * NORMALIZE BASE URL
 * =========================================================
 */

function normalizeBaseUrl(value) {

    const url =
        String(
            value ||
            DEFAULT_BASE_URL
        ).trim();

    return url.replace(
        /\/+$/,
        ""
    );

}


/**
 * =========================================================
 * BUILD URL
 * =========================================================
 */

function buildUrl(path) {

    const normalizedPath =
        String(
            path || ""
        ).startsWith("/")
            ? String(path)
            : `/${String(path)}`;

    return (
        normalizeBaseUrl(
            DEFAULT_BASE_URL
        ) +
        normalizedPath
    );

}


/**
 * =========================================================
 * VALIDATE API KEY
 * =========================================================
 *
 * API key SELALU diberikan oleh caller.
 *
 * Provider client tidak mengambil:
 *
 * - process.env.KIE_API_KEY
 * - process.env.MOTIONGEN_API_KEY
 * - frontend
 * - Supabase
 *
 * Credential tetap menjadi tanggung jawab:
 *
 * api/generate.js
 *        ↓
 * provider_credentials
 *        ↓
 * createGeneration(payload, apiKey)
 *
 * =========================================================
 */

function normalizeApiKey(apiKey) {

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
 * PARSE RESPONSE
 * =========================================================
 */

async function parseResponse(response) {

    const contentType =
        response.headers.get(
            "content-type"
        ) || "";

    if (
        contentType
            .toLowerCase()
            .includes("application/json")
    ) {

        try {

            return await response.json();

        } catch {

            return null;

        }

    }

    const text =
        await response.text();

    if (!text) {

        return null;

    }

    try {

        return JSON.parse(text);

    } catch {

        return {
            raw: text
        };

    }

}


/**
 * =========================================================
 * EXTRACT ERROR CODE
 * =========================================================
 */

function extractErrorCode(data) {

    if (
        data &&
        typeof data === "object"
    ) {

        return (
            data.code ||
            data.error_code ||
            data?.error?.code ||
            data?.data?.code ||
            data?.data?.error_code ||
            null
        );

    }

    return null;

}


/**
 * =========================================================
 * EXTRACT ERROR MESSAGE
 * =========================================================
 */

function extractErrorMessage(
    data,
    fallback
) {

    if (!data) {

        return fallback;

    }

    if (
        typeof data === "string"
    ) {

        return data;

    }

    return (

        data.message ||

        data.msg ||

        data.error ||

        data.error_message ||

        data.error_description ||

        data?.error?.message ||

        data?.data?.message ||

        data?.data?.msg ||

        data?.data?.error ||

        data?.data?.error_message ||

        fallback

    );

}


/**
 * =========================================================
 * SUCCESS CHECK
 * =========================================================
 *
 * Motiongen:
 *
 * HTTP 2xx
 * +
 * success !== false
 *
 * dianggap berhasil.
 *
 * Business error seperti:
 *
 * 401 MISSING_API_KEY
 * 401 INVALID_API_KEY
 * 403 DEVELOPER_NOT_APPROVED
 * 402 INSUFFICIENT_CREDITS
 * 400 INVALID_PAYLOAD
 * 400 INVALID_MODEL_INPUT
 * 404 JOB_NOT_FOUND
 * 404 MODEL_NOT_FOUND
 * 503 MODEL_MAINTENANCE
 * 500 INTERNAL_SERVER_ERROR
 *
 * tetap diproses sebagai error.
 *
 * =========================================================
 */

function isSuccessfulResponse(
    response,
    data
) {

    if (!response.ok) {

        return false;

    }

    if (
        data &&
        typeof data === "object"
    ) {

        if (
            data.success === false
        ) {

            return false;

        }

    }

    return true;

}


/**
 * =========================================================
 * BUILD ERROR
 * =========================================================
 */

function createApiError(
    response,
    data
) {

    const message =
        extractErrorMessage(
            data,
            `Motiongen-AI request gagal (${response.status}).`
        );

    const error =
        new Error(message);

    error.status =
        response.status;

    error.code =
        extractErrorCode(data) ||
        `HTTP_${response.status}`;

    error.provider =
        "motiongen";

    error.providerName =
        "Motiongen-AI";

    error.response =
        data;

    return error;

}


/**
 * =========================================================
 * GENERIC REQUEST
 * =========================================================
 */

async function request(
    path,
    options = {}
) {

    const method =
        String(
            options.method ||
            "GET"
        ).toUpperCase();

    const apiKey =
        normalizeApiKey(
            options.apiKey
        );

    const headers = {

        Accept:
            "application/json",

        Authorization:
            `Bearer ${apiKey}`,

        ...(options.headers || {})

    };


    if (
        options.body !== undefined &&
        !headers["Content-Type"] &&
        !headers["content-type"]
    ) {

        headers["Content-Type"] =
            "application/json";

    }


    const requestOptions = {

        method,

        headers

    };


    if (
        options.body !== undefined
    ) {

        requestOptions.body =

            typeof options.body === "string"

                ? options.body

                : JSON.stringify(
                    options.body
                );

    }


    let response;

    try {

        response =
            await fetch(
                buildUrl(path),
                requestOptions
            );

    } catch (error) {

        const networkError =
            new Error(
                `Gagal terhubung ke Motiongen-AI: ${error.message}`
            );

        networkError.code =
            "MOTIONGEN_NETWORK_ERROR";

        networkError.provider =
            "motiongen";

        networkError.cause =
            error;

        throw networkError;

    }


    const data =
        await parseResponse(
            response
        );


    if (
        !isSuccessfulResponse(
            response,
            data
        )
    ) {

        throw createApiError(
            response,
            data
        );

    }


    return data;

}


/**
 * =========================================================
 * NORMALIZE CREATE RESPONSE
 * =========================================================
 *
 * Expected:
 *
 * {
 *   success: true,
 *   job_id: "...",
 *   status: "QUEUED",
 *   credits_held: 3.5
 * }
 *
 * =========================================================
 */

function normalizeCreateResponse(
    data
) {

    const jobId =
        data?.job_id ||
        data?.jobId ||
        data?.data?.job_id ||
        data?.data?.jobId ||
        null;

    if (!jobId) {

        const error =
            new Error(
                "Motiongen-AI tidak mengembalikan job_id."
            );

        error.code =
            "MOTIONGEN_JOB_ID_MISSING";

        error.provider =
            "motiongen";

        error.response =
            data;

        throw error;

    }


    return {

        success:
            data?.success !== false,

        jobId:
            String(jobId),

        job_id:
            String(jobId),

        taskId:
            String(jobId),

        task_id:
            String(jobId),

        status:
            data?.status ||
            data?.data?.status ||
            "QUEUED",

        creditsHeld:
            data?.credits_held ??
            data?.data?.credits_held ??
            null,

        credits_held:
            data?.credits_held ??
            data?.data?.credits_held ??
            null,

        raw:
            data

    };

}


/**
 * =========================================================
 * CREATE GENERATION
 * =========================================================
 *
 * Payload diteruskan apa adanya dari model adapter.
 *
 * Client TIDAK:
 *
 * - menambah prompt
 * - mengubah image
 * - mengubah audio
 * - menghitung credit
 * - mengubah duration
 * - mengubah aspect ratio
 * - menambahkan resolution
 * - menambahkan nsfw_checker
 * - melakukan fallback
 *
 * =========================================================
 */

async function createGeneration(
    payload,
    apiKey
) {

    if (
        !payload ||
        typeof payload !== "object" ||
        Array.isArray(payload)
    ) {

        const error =
            new Error(
                "Payload Motiongen-AI harus berupa object."
            );

        error.code =
            "INVALID_MOTIONGEN_PAYLOAD";

        error.provider =
            "motiongen";

        throw error;

    }


    const data =
        await request(
            GENERATE_PATH,
            {

                method:
                    "POST",

                apiKey,

                body:
                    payload

            }
        );


    return normalizeCreateResponse(
        data
    );

}


/**
 * =========================================================
 * NORMALIZE JOB RESPONSE
 * =========================================================
 */

function normalizeJobResponse(
    data
) {

    const source =
        data?.data &&
        typeof data.data === "object"

            ? data.data

            : data;


    const jobId =
        source?.id ||
        source?.job_id ||
        source?.jobId ||
        null;


    const status =
        String(
            source?.status ||
            source?.state ||
            "UNKNOWN"
        ).toUpperCase();


    let outputUrls = [];


    if (
        Array.isArray(
            source?.output_urls
        )
    ) {

        outputUrls =
            source.output_urls
                .filter(Boolean)
                .map(
                    url =>
                        String(url)
                );

    }


    if (
        !outputUrls.length &&
        Array.isArray(
            source?.outputUrls
        )
    ) {

        outputUrls =
            source.outputUrls
                .filter(Boolean)
                .map(
                    url =>
                        String(url)
                );

    }


    if (
        !outputUrls.length &&
        typeof source?.output_url === "string"
    ) {

        outputUrls = [
            source.output_url
        ];

    }


    if (
        !outputUrls.length &&
        typeof source?.outputUrl === "string"
    ) {

        outputUrls = [
            source.outputUrl
        ];

    }


    return {

        success:
            data?.success !== false,

        jobId:
            jobId
                ? String(jobId)
                : null,

        job_id:
            jobId
                ? String(jobId)
                : null,

        taskId:
            jobId
                ? String(jobId)
                : null,

        task_id:
            jobId
                ? String(jobId)
                : null,

        status,

        kind:
            source?.kind ||
            null,

        model:
            source?.model ||
            null,

        creditCost:
            source?.credit_cost ??
            null,

        credit_cost:
            source?.credit_cost ??
            null,

        outputUrls,

        output_urls:
            outputUrls,

        raw:
            data

    };

}


/**
 * =========================================================
 * GET JOB
 * =========================================================
 */

async function getJob(
    jobId,
    apiKey
) {

    const normalizedJobId =
        String(
            jobId || ""
        ).trim();


    if (!normalizedJobId) {

        const error =
            new Error(
                "job_id Motiongen-AI wajib diisi."
            );

        error.code =
            "MOTIONGEN_JOB_ID_MISSING";

        error.provider =
            "motiongen";

        throw error;

    }


    const path =
        `${JOB_PATH}/${encodeURIComponent(normalizedJobId)}`;


    const data =
        await request(
            path,
            {

                method:
                    "GET",

                apiKey

            }
        );


    return normalizeJobResponse(
        data
    );

}


/**
 * =========================================================
 * EXPORT
 * =========================================================
 */

export {

    createGeneration,

    getJob,

    request

};

export default {

    createGeneration,

    getJob,

    request

};
