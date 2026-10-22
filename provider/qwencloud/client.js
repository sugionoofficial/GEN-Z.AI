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


/* =========================================================
   PESAN ERROR (BAHASA INDONESIA)
   ---------------------------------------------------------
   Kode internal → pesan siap tampil di halaman Generate /
   History. Teks provider asli tetap disimpan di
   `providerMessage` untuk troubleshooting.
========================================================= */

const PROVIDER_ERROR_MESSAGES =
    Object.freeze({

        FREE_QUOTA_EXHAUSTED:
            "Kuota gratis model ini sudah habis. Pilih model lain atau aktifkan penagihan pay-as-you-go di QwenCloud.",

        INSUFFICIENT_BALANCE:
            "Saldo QwenCloud tidak mencukupi atau ada tagihan tertunggak. Semua panggilan model diblokir sampai pembayaran diselesaikan.",

        INVALID_API_KEY:
            "API key QwenCloud tidak valid atau bukan untuk region Singapore. Periksa kembali key di Admin Panel → Providers.",

        ACCESS_DENIED:
            "API key tidak punya akses ke model ini. Pastikan model sudah aktif di akun QwenCloud.",

        MODEL_NOT_FOUND:
            "Model tidak ditemukan di akun QwenCloud. Periksa nama model atau region endpoint.",

        RATE_LIMITED:
            "Permintaan terlalu cepat. Tunggu beberapa saat lalu coba lagi.",

        CONTENT_BLOCKED:
            "Prompt atau media ditolak oleh filter konten QwenCloud. Ubah prompt/gambar lalu coba lagi.",

        INVALID_PAYLOAD:
            "Parameter tidak diterima QwenCloud. Periksa prompt, durasi, dan resolusi.",

        PROVIDER_TIMEOUT:
            "QwenCloud tidak merespons tepat waktu. Coba lagi beberapa saat.",

        PROVIDER_NETWORK_ERROR:
            "Tidak dapat menghubungi QwenCloud. Periksa koneksi lalu coba lagi.",

        PROVIDER_UNAVAILABLE:
            "Layanan QwenCloud sedang bermasalah. Coba lagi beberapa saat.",

        TASK_NOT_FOUND:
            "Task tidak ditemukan di QwenCloud — hasil hanya tersimpan 24 jam.",

        QWENCLOUD_REQUEST_FAILED:
            "Permintaan ke QwenCloud gagal."

    });


/* =========================================================
   ERROR CODE MAPPER
   ---------------------------------------------------------
   Dipakai untuk error HTTP (create task) maupun error
   tingkat task (output.code saat task FAILED).
========================================================= */

function mapProviderCode(
    providerCode,
    status = 0
) {

    const normalized =
        String(
            providerCode ||
            ""
        ).trim();


    const mapped =
        DASHSCOPE_ERROR_CODES[
            normalized
        ];


    if (mapped) {

        return mapped;

    }


    /*
     * DashScope kadang memakai prefix atau suffix pada code,
     * contoh: "AllocationQuota.FreeTierOnly:xxx".
     */

    for (
        const [
            key,
            value
        ] of Object.entries(
            DASHSCOPE_ERROR_CODES
        )
    ) {

        if (
            normalized
                .toLowerCase()
                .includes(
                    key.toLowerCase()
                )
        ) {

            return value;

        }

    }


    switch (Number(status) || 0) {

        case 400:
            return "INVALID_PAYLOAD";

        case 401:
            return "INVALID_API_KEY";

        case 402:
            return "INSUFFICIENT_BALANCE";

        case 403:
            return "ACCESS_DENIED";

        case 404:
            return "TASK_NOT_FOUND";

        case 429:
            return "RATE_LIMITED";

        case 500:
        case 502:
        case 503:
            return "PROVIDER_UNAVAILABLE";

        default:
            return "QWENCLOUD_REQUEST_FAILED";

    }

}


/* =========================================================
   PESAN ERROR BAHASA INDONESIA
========================================================= */

function getProviderErrorMessage(
    code
) {

    return (
        PROVIDER_ERROR_MESSAGES[
            String(
                code ||
                ""
            ).trim()
        ] ||
        PROVIDER_ERROR_MESSAGES.QWENCLOUD_REQUEST_FAILED
    );

}


/* =========================================================
   TASK-LEVEL ERROR
   ---------------------------------------------------------
   HTTP 200 + output.task_status = FAILED tetap membawa
   output.code (mis. AllocationQuota.FreeTierOnly).
   Tanpa normalisasi, user hanya melihat pesan Inggris
   mentah dari provider.
========================================================= */

function normalizeTaskError(
    output = {},
    data = {}
) {

    const providerCode =
        String(
            output?.code ||
            output?.error_code ||
            data?.code ||
            ""
        ).trim();


    const providerMessage =
        String(
            output?.message ||
            output?.error_message ||
            data?.message ||
            ""
        ).trim();


    if (
        !providerCode &&
        !providerMessage
    ) {

        return {

            errorCode:
                null,

            errorMessage:
                null,

            providerCode:
                null,

            providerMessage:
                null

        };

    }


    const errorCode =
        mapProviderCode(
            providerCode,
            0
        );


    const genericMessage =
        PROVIDER_ERROR_MESSAGES.QWENCLOUD_REQUEST_FAILED;


    const friendly =
        PROVIDER_ERROR_MESSAGES[
            errorCode
        ] ||
        null;


    /*
     * Kode yang dikenali → pesan Indonesia siap tampil.
     * Kode asing → pesan Indonesia umum + detail provider
     * agar tetap bisa ditindaklanjuti.
     */

    let errorMessage;


    if (
        friendly &&
        errorCode !==
            "QWENCLOUD_REQUEST_FAILED"
    ) {

        errorMessage =
            friendly;

    } else if (
        providerMessage
    ) {

        errorMessage =
            `${genericMessage} Detail: ${providerMessage}`;

    } else {

        errorMessage =
            friendly ||
            "Task QwenCloud gagal diproses.";

    }


    return {

        errorCode,

        errorMessage,

        providerCode:
            providerCode ||
            null,

        providerMessage:
            providerMessage ||
            null

    };

}


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


    const code =
        mapProviderCode(
            providerCode,
            status
        );


    const providerMessage =
        extractErrorMessage(
            data,
            status
        );


    const error =
        new Error(
            getProviderErrorMessage(
                code
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


    error.code =
        code;


    error.providerCode =
        providerCode ||
        null;


    /*
     * Pesan asli provider tetap disimpan untuk log/troubleshooting,
     * sedangkan error.message sudah berbahasa Indonesia.
     */

    error.providerMessage =
        providerMessage ||
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

    PROVIDER_ERROR_MESSAGES,

    createProviderError,
    createVideoTask,
    getBaseUrl,
    getProviderErrorMessage,
    getTask,
    mapProviderCode,
    normalizeOutputUrls,
    normalizeStatus,
    normalizeTaskError,
    redactSecrets
};


export default Object.freeze({

    createVideoTask,
    getTask,
    normalizeStatus,
    normalizeTaskError,
    normalizeOutputUrls,
    getBaseUrl,
    getProviderErrorMessage,
    mapProviderCode,
    redactSecrets,
    PROVIDER_ID,
    PROVIDER_NAME

});
