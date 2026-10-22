/* =========================================================
   GEN-Z.AI
   QWENCLOUD (ALIBABA CLOUD MODEL STUDIO / DASHSCOPE)
   PROVIDER CLIENT
   ---------------------------------------------------------
   File:
     provider/qwencloud/client.js

   Fungsi:
   - HTTP client untuk DashScope Video Synthesis
   - Create task (async)
   - Query task (polling)
   - Normalisasi response + status
   - Normalisasi error (kode DashScope → kode internal)
   - Redact secret sebelum log

   Provider:
     qwencloud

   API DOCS:
     https://www.alibabacloud.com/help/en/model-studio/
     legacy-wan-text-to-video-api-reference

   ENDPOINT DEFAULT (Singapore / Internasional):
     https://dashscope-intl.aliyuncs.com/api/v1

   Bisa dioverride tanpa ubah kode:
     DASHSCOPE_BASE_URL=https://{WorkspaceId}.ap-southeast-1.maas.aliyuncs.com/api/v1

   PENTING:
   - API key TIDAK disimpan di file ini.
   - API key diberikan dari server lewat parameter apiKey
     (diambil dari Supabase provider_credentials).
   - Semua panggilan WAJIB async:
     header X-DashScope-Async: enable.
========================================================= */

const DEFAULT_BASE_URL =
    "https://dashscope-intl.aliyuncs.com/api/v1";


const PROVIDER_ID =
    "qwencloud";


const PROVIDER_NAME =
    "QwenCloud";


/* =========================================================
   ENDPOINT
   ---------------------------------------------------------
   t2v / i2v / r2v  → aigc/video-generation/video-synthesis
   kf2v / animate   → aigc/image2video/video-synthesis
========================================================= */

const VIDEO_GENERATION_ENDPOINT =
    "/services/aigc/video-generation/video-synthesis";


const IMAGE2VIDEO_ENDPOINT =
    "/services/aigc/image2video/video-synthesis";


const TASK_ENDPOINT_PREFIX =
    "/tasks";


const CREATE_TIMEOUT_MS =
    60_000;


const QUERY_TIMEOUT_MS =
    30_000;


/* =========================================================
   BASE URL
========================================================= */

function getBaseUrl() {

    const configured =
        String(
            process.env.DASHSCOPE_BASE_URL ||
            process.env.QWENCLOUD_BASE_URL ||
            ""
        ).trim();


    return (
        configured ||
        DEFAULT_BASE_URL
    )
        .replace(
            /\/+$/,
            ""
        );

}


/* =========================================================
   ENDPOINT RESOLVER
========================================================= */

function resolveCreateEndpoint(
    endpoint
) {

    const value =
        String(
            endpoint || ""
        ).trim();


    if (!value) {

        return VIDEO_GENERATION_ENDPOINT;

    }


    if (
        /^https?:\/\//i.test(
            value
        )
    ) {

        return value;

    }


    return value.startsWith(
        "/"
    )
        ? value
        : `/${value}`;

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
                "QwenCloud API key is missing"
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
   REDACT SENSITIVE
========================================================= */

function redactSecrets(
    value
) {

    if (
        value === null ||
        value === undefined
    ) {

        return value;

    }


    if (
        typeof value ===
            "string"
    ) {

        return value
            .replace(
                /Bearer\s+[A-Za-z0-9._\-]+/gi,
                "Bearer [REDACTED]"
            )
            .replace(
                /\bsk-[A-Za-z0-9]{6,}\b/gi,
                "sk-[REDACTED]"
            );

    }


    if (
        Array.isArray(
            value
        )
    ) {

        return value.map(
            redactSecrets
        );

    }


    if (
        typeof value ===
            "object"
    ) {

        const out = {};


        for (
            const [
                key,
                item
            ] of Object.entries(
                value
            )
        ) {

            const lower =
                String(
                    key
                ).toLowerCase();


            const isSecret =
                lower.includes(
                    "api_key"
                ) ||
                lower.includes(
                    "apikey"
                ) ||
                lower === "authorization" ||
                lower.includes(
                    "access_token"
                ) ||
                lower === "token" ||
                lower === "secret" ||
                lower.includes(
                    "password"
                );


            out[key] =
                isSecret
                    ? "[REDACTED]"
                    : redactSecrets(
                        item
                    );

        }


        return out;

    }


    return value;

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
            data.output?.message ||
            data.code ||
            `QwenCloud request failed with status ${status}`
        );

    }


    if (
        typeof data === "string" &&
        data.trim()
    ) {

        return data.trim();

    }


    return (
        `QwenCloud request failed with status ${status}`
    );

}


/* =========================================================
   ERROR NORMALIZATION
   ---------------------------------------------------------
   DashScope mengembalikan `code` berupa string
   (InvalidApiKey, Throttling, DataInspectionFailed, ...).
========================================================= */

const DASHSCOPE_ERROR_CODES =
    Object.freeze({

        InvalidApiKey:
            "INVALID_API_KEY",

        Unauthorized:
            "INVALID_API_KEY",

        AccessDenied:
            "ACCESS_DENIED",

        Throttling:
            "RATE_LIMITED",

        ThrottlingRush:
            "RATE_LIMITED",

        ModelNotFound:
            "MODEL_NOT_FOUND",

        InvalidParameter:
            "INVALID_PAYLOAD",

        DataInspectionFailed:
            "CONTENT_BLOCKED",

        "AllocationQuota.FreeTierOnly":
            "FREE_QUOTA_EXHAUSTED",

        "AllocationQuota.FreeTierExhausted":
            "FREE_QUOTA_EXHAUSTED",

        Arrearage:
            "INSUFFICIENT_BALANCE",

        InternalError:
            "INTERNAL_SERVER_ERROR"

    });


function createProviderError(
    response,
    data
) {

    const status =
        Number(
            response?.status || 0
        );


    const providerCode =
        String(
            data?.code ||
            data?.error?.code ||
            ""
        ).trim();


    const error =
        new Error(
            extractErrorMessage(
                data,
                status
            )
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


    let code =
        DASHSCOPE_ERROR_CODES[providerCode] ||
        null;


    if (!code) {

        switch (status) {

            case 400:
                code = "INVALID_PAYLOAD";
                break;

            case 401:
                code = "INVALID_API_KEY";
                break;

            case 402:
                code = "INSUFFICIENT_BALANCE";
                break;

            case 403:
                code = "ACCESS_DENIED";
                break;

            case 404:
                code = "TASK_NOT_FOUND";
                break;

            case 429:
                code = "RATE_LIMITED";
                break;

            case 500:
            case 502:
            case 503:
                code = "PROVIDER_UNAVAILABLE";
                break;

            default:
                code = "QWENCLOUD_REQUEST_FAILED";

        }

    }


    error.code =
        code;


    error.providerCode =
        providerCode ||
        null;


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


    const endpoint =
        resolveCreateEndpoint(
            path
        );


    const isAbsolute =
        /^https?:\/\//i.test(
            endpoint
        );


    const url =
        isAbsolute
            ? endpoint
            : `${getBaseUrl()}${endpoint}`;


    const method =
        String(
            options.method ||
            "GET"
        )
            .trim()
            .toUpperCase();


    const timeoutMs =
        options.timeoutMs ||
        (method === "POST"
            ? CREATE_TIMEOUT_MS
            : QUERY_TIMEOUT_MS);


    const controller =
        new AbortController();


    const timer =
        setTimeout(
            () => controller.abort(),
            timeoutMs
        );


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

        headers,

        signal:
            controller.signal

    };


    delete requestOptions.timeoutMs;


    let response;


    try {

        response =
            await fetch(
                url,
                requestOptions
            );

    } catch (error) {

        clearTimeout(
            timer
        );


        const isAbort =
            error?.name ===
            "AbortError";


        const wrapped =
            new Error(
                isAbort
                    ? `QwenCloud request timed out after ${Math.round(timeoutMs / 1000)}s`
                    : `QwenCloud network error: ${error?.message || "unknown"}`
            );


        wrapped.code =
            isAbort
                ? "PROVIDER_TIMEOUT"
                : "PROVIDER_NETWORK_ERROR";


        wrapped.provider =
            PROVIDER_ID;


        throw wrapped;

    }


    clearTimeout(
        timer
    );


    const data =
        await parseResponseBody(
            response
        );


    if (!response.ok) {

        console.error(
            "[QWENCLOUD] Request failed:",
            JSON.stringify(
                {

                    url,

                    method,

                    status:
                        response.status,

                    payload:
                        redactSecrets(
                            safeParseJson(
                                requestOptions.body
                            )
                        ),

                    response:
                        redactSecrets(
                            data
                        )

                },
                null,
                2
            )
        );


        throw createProviderError(
            response,
            data
        );

    }


    return data;

}


/* =========================================================
   SAFE JSON PARSE (untuk log)
========================================================= */

function safeParseJson(
    value
) {

    if (
        typeof value !==
        "string"
    ) {

        return value ?? null;

    }


    try {

        return JSON.parse(
            value
        );

    } catch {

        return "[unparsable body]";

    }

}


/* =========================================================
   CREATE VIDEO TASK
========================================================= */

async function createVideoTask(
    payload,
    apiKey,
    options = {}
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
            "QwenCloud payload must be an object"
        );

    }


    const endpoint =
        options.endpoint ||
        VIDEO_GENERATION_ENDPOINT;


    const data =
        await request(
            endpoint,
            {

                method:
                    "POST",

                headers: {

                    "Content-Type":
                        "application/json",

                    "X-DashScope-Async":
                        "enable"

                },

                body:
                    JSON.stringify(
                        payload
                    )

            },
            apiKey
        );


    const taskId =
        data?.output?.task_id ||
        data?.task_id ||
        data?.output?.taskId ||
        null;


    const status =
        data?.output?.task_status ||
        data?.task_status ||
        "PENDING";


    return {

        success:
            data?.code === undefined ||
            data?.code === null,

        provider:
            PROVIDER_ID,

        providerName:
            PROVIDER_NAME,

        taskId,

        task_id:
            taskId,

        jobId:
            taskId,

        job_id:
            taskId,

        status,

        requestId:
            data?.request_id ||
            null,

        request_id:
            data?.request_id ||
            null,

        model:
            payload.model ||
            null,

        raw:
            data

    };

}


/* =========================================================
   QUERY TASK
========================================================= */

async function getTask(
    taskId,
    apiKey
) {

    const normalizedId =
        String(
            taskId || ""
        ).trim();


    if (!normalizedId) {

        const error =
            new Error(
                "QwenCloud task ID is required."
            );


        error.code =
            "TASK_ID_MISSING";


        error.provider =
            PROVIDER_ID;


        throw error;

    }


    return await request(
        `${TASK_ENDPOINT_PREFIX}/${encodeURIComponent(normalizedId)}`,
        {

            method:
                "GET"

        },
        apiKey
    );

}


/* =========================================================
   STATUS NORMALIZATION
   ---------------------------------------------------------
   DashScope : PENDING | RUNNING | SUCCEEDED | FAILED |
               CANCELED | UNKNOWN
   Internal  : QUEUED | PROCESSING | COMPLETED | FAILED
========================================================= */

function normalizeStatus(
    status
) {

    const value =
        String(
            status || ""
        )
            .trim()
            .toUpperCase();


    switch (value) {

        case "PENDING":
        case "QUEUED":
        case "WAITING":
            return "QUEUED";

        case "RUNNING":
        case "PROCESSING":
            return "PROCESSING";

        case "SUCCEEDED":
        case "SUCCESS":
        case "COMPLETED":
            return "COMPLETED";

        case "FAILED":
        case "FAILURE":
        case "ERROR":
            return "FAILED";

        case "CANCELED":
        case "CANCELLED":
            return "CANCELED";

        default:
            return "UNKNOWN";

    }

}


/* =========================================================
   OUTPUT URLS
========================================================= */

function normalizeOutputUrls(
    data
) {

    const output =
        data?.output ||
        data?.data?.output ||
        {};


    const candidates = [

        output.video_url,

        output.videoUrl,

        output.video_urls,

        data?.video_url,

        data?.videoUrl

    ];


    const urls = [];


    for (
        const candidate
        of candidates
    ) {

        if (
            typeof candidate ===
                "string" &&
            candidate.trim()
        ) {

            urls.push(
                candidate.trim()
            );

        }


        if (
            Array.isArray(
                candidate
            )
        ) {

            for (
                const item
                of candidate
            ) {

                if (
                    typeof item ===
                        "string" &&
                    item.trim()
                ) {

                    urls.push(
                        item.trim()
                    );

                }

            }

        }

    }


    return [
        ...new Set(
            urls
        )
    ];

}


/* =========================================================
   EXPORT
========================================================= */

export {

    DEFAULT_BASE_URL,
    PROVIDER_ID,
    PROVIDER_NAME,
    VIDEO_GENERATION_ENDPOINT,
    IMAGE2VIDEO_ENDPOINT,

    createProviderError,
    createVideoTask,
    getBaseUrl,
    getTask,
    normalizeOutputUrls,
    normalizeStatus,
    redactSecrets
};


export default Object.freeze({

    createVideoTask,
    getTask,
    normalizeStatus,
    normalizeOutputUrls,
    getBaseUrl,
    redactSecrets,
    PROVIDER_ID,
    PROVIDER_NAME

});
