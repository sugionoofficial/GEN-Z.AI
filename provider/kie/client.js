/**
 * =========================================================
 * GEN-Z.AI
 * KIE.AI GENERIC CLIENT
 * ---------------------------------------------------------
 * File:
 * provider/kie/client.js
 *
 * Tanggung jawab:
 * - HTTP request ke KIE.AI
 * - createTask()
 * - getTask()
 * - waitForTask()
 *
 * Tidak bertanggung jawab:
 * - konfigurasi model
 * - parameter model
 * - workflow
 * - variant
 * - pricing
 * - constraint
 * - dependency
 *
 * API:
 * POST /api/v1/jobs/createTask
 * GET  /api/v1/jobs/recordInfo?taskId=...
 * =========================================================
 */


/**
 * =========================================================
 * DEFAULT CONFIGURATION
 * =========================================================
 */

const DEFAULT_BASE_URL =
    "https://api.kie.ai";

const CREATE_TASK_PATH =
    "/api/v1/jobs/createTask";

const TASK_INFO_PATH =
    "/api/v1/jobs/recordInfo";


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
 * API KEY
 * =========================================================
 *
 * Prioritas:
 *
 * 1. apiKey yang dikirim oleh caller
 * 2. KIE_API_KEY
 *
 * Client tidak mengetahui dari mana API key berasal.
 * Ini penting supaya provider_credentials tetap bisa
 * dikelola oleh layer di atasnya.
 * =========================================================
 */

function getApiKey() {

    const apiKey =
        process.env.KIE_API_KEY;

    if (!apiKey) {

        throw new Error(
            "KIE_API_KEY belum dikonfigurasi."
        );

    }

    const normalized =
        String(apiKey).trim();

    if (!normalized) {

        throw new Error(
            "KIE_API_KEY kosong."
        );

    }

    return normalized;

}


/**
 * =========================================================
 * BASE URL
 * =========================================================
 */

function getBaseUrl() {

    return normalizeBaseUrl(

        process.env.KIE_API_ENDPOINT ||

        process.env.KIE_API_BASE_URL ||

        DEFAULT_BASE_URL

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
        getBaseUrl() +
        normalizedPath
    );

}


/**
 * =========================================================
 * RESPONSE PARSER
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

        return response.json();

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
 * ERROR MESSAGE
 * =========================================================
 */

function extractMessage(
    data,
    fallback
) {

    if (!data) {

        return fallback;

    }

    return (

        data.msg ||

        data.message ||

        data.error ||

        data.error_message ||

        data.error_description ||

        data?.data?.msg ||

        data?.data?.message ||

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
 * HTTP 2xx dianggap berhasil kecuali API response
 * secara eksplisit memberikan business code error.
 *
 * CATATAN KIE.AI:
 *
 * Endpoint recordInfo dapat menggunakan business code
 * 505 walaupun HTTP response tetap 2xx dan data task
 * valid. Code 505 tersebut harus diterima sebagai
 * respons task yang valid.
 *
 * Business code 505 HANYA diizinkan melalui opsi
 * acceptedBusinessCodes dari caller.
 * =========================================================
 */

function isSuccessfulResponse(
    response,
    data,
    options = {}
) {

    if (!response.ok) {

        return false;

    }

    if (
        data &&
        typeof data === "object"
    ) {

        const acceptedBusinessCodes =
            Array.isArray(
                options.acceptedBusinessCodes
            )
                ? options.acceptedBusinessCodes
                : [];

        const businessCode =
            typeof data.code === "number"
                ? data.code
                : null;

        if (
            businessCode !== null &&
            businessCode >= 400 &&
            !acceptedBusinessCodes.includes(
                businessCode
            )
        ) {

            return false;

        }

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
        options.apiKey
            ? String(
                options.apiKey
            ).trim()
            : getApiKey();

    if (!apiKey) {

        throw new Error(
            "API key KIE.AI tidak tersedia."
        );

    }


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
                `Gagal terhubung ke KIE.AI: ${error.message}`
            );

        networkError.code =
            "KIE_NETWORK_ERROR";

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
            data,
            options
        )
    ) {

        const message =
            extractMessage(
                data,
                `KIE.AI request gagal (${response.status}).`
            );

        const error =
            new Error(message);

        error.status =
            response.status;

        error.code =
            data?.code ||
            `HTTP_${response.status}`;

        error.response =
            data;

        throw error;

    }


    return data;

}


/**
 * =========================================================
 * CREATE TASK
 * =========================================================
 *
 * Payload:
 *
 * {
 *   model: "...",
 *   input: {...}
 * }
 *
 * Optional:
 *
 * {
 *   callBackUrl: "..."
 * }
 * =========================================================
 */

async function createTask(
    payload,
    apiKey = null
) {

    if (
        !payload ||
        typeof payload !== "object" ||
        Array.isArray(payload)
    ) {

        const error =
            new Error(
                "Payload KIE.AI harus berupa object."
            );

        error.code =
            "INVALID_KIE_PAYLOAD";

        throw error;

    }


    if (
        !payload.model ||
        typeof payload.model !== "string"
    ) {

        const error =
            new Error(
                "Model KIE.AI wajib diisi."
            );

        error.code =
            "KIE_MODEL_REQUIRED";

        throw error;

    }


    if (
        !payload.input ||
        typeof payload.input !== "object" ||
        Array.isArray(payload.input)
    ) {

        const error =
            new Error(
                "Input KIE.AI harus berupa object."
            );

        error.code =
            "KIE_INPUT_REQUIRED";

        throw error;

    }


    const data =
        await request(
            CREATE_TASK_PATH,
            {

                method:
                    "POST",

                body:
                    payload,

                apiKey

            }
        );


    const taskId =

        data?.data?.taskId ||

        data?.data?.task_id ||

        data?.taskId ||

        data?.task_id ||

        null;


    return {

        ...data,

        taskId

    };

}


/**
 * =========================================================
 * GET TASK
 * =========================================================
 *
 * GET:
 *
 * /api/v1/jobs/recordInfo?taskId=...
 *
 * KIE recordInfo dapat menggunakan business code 505
 * pada HTTP 2xx ketika detail task berhasil dikembalikan.
 *
 * Code 505 tersebut TIDAK boleh dianggap sebagai
 * HTTP error.
 * =========================================================
 */

async function getTask(
    taskId,
    apiKey = null
) {

    const normalizedTaskId =
        String(
            taskId || ""
        ).trim();


    if (!normalizedTaskId) {

        const error =
            new Error(
                "taskId KIE.AI wajib diisi."
            );

        error.code =
            "KIE_TASK_ID_REQUIRED";

        throw error;

    }


    const query =
        new URLSearchParams();

    query.set(
        "taskId",
        normalizedTaskId
    );


    const data =
        await request(

            `${TASK_INFO_PATH}?${query.toString()}`,

            {

                method:
                    "GET",

                apiKey,

                /*
                 * KIE recordInfo:
                 * business code 505 dapat tetap membawa
                 * data task yang valid.
                 */
                acceptedBusinessCodes:
                    [505]

            }

        );


    const task =
        data?.data ||
        data;


    return {

        ...data,

        task

    };

}


/**
 * =========================================================
 * EXTRACT RESULT URLS
 * =========================================================
 *
 * KIE:
 *
 * resultJson:
 * {
 *   "resultUrls": [...]
 * }
 *
 * resultJson kadang dikirim sebagai string JSON.
 * =========================================================
 */

function extractResultUrls(
    task
) {

    if (
        !task ||
        typeof task !== "object"
    ) {

        return [];

    }


    let result =
        task.resultJson;


    if (
        typeof result === "string"
    ) {

        try {

            result =
                JSON.parse(
                    result
                );

        } catch {

            return [];

        }

    }


    if (
        Array.isArray(
            result?.resultUrls
        )
    ) {

        return result.resultUrls;

    }


    if (
        Array.isArray(
            result?.result_urls
        )
    ) {

        return result.result_urls;

    }


    return [];

}


/**
 * =========================================================
 * NORMALIZE TASK STATE
 * =========================================================
 */

function normalizeTaskState(
    task
) {

    return String(

        task?.state ||

        task?.status ||

        ""

    )
        .trim()
        .toLowerCase();

}


/**
 * =========================================================
 * WAIT FOR TASK
 * =========================================================
 *
 * Dipakai bila server memang perlu menunggu sampai
 * task selesai.
 *
 * Default:
 * - polling setiap 3 detik
 * - timeout 15 menit
 *
 * Catatan:
 * API generate utama nantinya bisa memilih apakah
 * menggunakan polling atau menyimpan taskId untuk
 * diproses asynchronous.
 * =========================================================
 */

async function waitForTask(
    taskId,
    options = {}
) {

    const intervalMs =
        Number(
            options.intervalMs ||
            3000
        );

    const timeoutMs =
        Number(
            options.timeoutMs ||
            15 * 60 * 1000
        );

    const apiKey =
        options.apiKey ||
        null;

    const startedAt =
        Date.now();


    const terminalStates =
        new Set([

            "success",

            "fail",

            "failed",

            "error",

            "cancelled",

            "canceled"

        ]);


    while (true) {

        const result =
            await getTask(
                taskId,
                apiKey
            );


        const task =
            result?.task ||
            {};


        const state =
            normalizeTaskState(
                task
            );


        if (
            terminalStates.has(
                state
            )
        ) {

            return {

                ...result,

                task,

                state,

                resultUrls:
                    extractResultUrls(
                        task
                    )

            };

        }


        if (
            Date.now() -
            startedAt >=
            timeoutMs
        ) {

            const error =
                new Error(
                    "Timeout menunggu task KIE.AI."
                );

            error.code =
                "KIE_TASK_TIMEOUT";

            error.taskId =
                taskId;

            error.response =
                result;

            throw error;

        }


        await new Promise(
            resolve =>
                setTimeout(
                    resolve,
                    intervalMs
                )
        );

    }

}


/**
 * =========================================================
 * CLIENT EXPORT
 * =========================================================
 */

const client = {

    request,

    createTask,

    getTask,

    waitForTask,

    extractResultUrls,

    normalizeTaskState,

    getApiKey,

    getBaseUrl,

    buildUrl

};


export {

    DEFAULT_BASE_URL,

    CREATE_TASK_PATH,

    TASK_INFO_PATH,

    normalizeBaseUrl,

    getApiKey,

    getBaseUrl,

    buildUrl,

    request,

    createTask,

    getTask,

    waitForTask,

    extractResultUrls,

    normalizeTaskState

};


export default client;
