/**
 * GEN-Z.AI
 * KIE.AI GENERIC CLIENT
 *
 * File:
 * provider/kie/client.js
 *
 * Fungsi:
 * - createTask()
 * - getTask()
 * - request()
 *
 * Client ini TIDAK mengetahui model,
 * workflow, variant, parameter, pricing,
 * atau constraint tertentu.
 *
 * Semua konfigurasi model tetap berasal
 * dari Supabase.
 */

const DEFAULT_BASE_URL = "https://api.kie.ai";

const CREATE_TASK_PATH = "/api/v1/jobs/createTask";

const TASK_INFO_PATH = "/api/v1/jobs/recordInfo";


function normalizeBaseUrl(value) {

    const url =
        String(
            value ||
            DEFAULT_BASE_URL
        ).trim();

    return url.replace(/\/+$/, "");
}


function getApiKey() {

    const apiKey =
        process.env.KIE_API_KEY;

    if (!apiKey) {

        throw new Error(
            "KIE_API_KEY belum dikonfigurasi."
        );

    }

    return apiKey.trim();
}


function getBaseUrl() {

    return normalizeBaseUrl(
        process.env.KIE_API_ENDPOINT ||
        process.env.KIE_API_BASE_URL ||
        DEFAULT_BASE_URL
    );

}


function buildUrl(path) {

    return (
        getBaseUrl() +
        path
    );

}


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


function extractMessage(data, fallback) {

    if (!data) {

        return fallback;

    }

    return (
        data.msg ||
        data.message ||
        data.error ||
        data?.data?.msg ||
        data?.data?.message ||
        fallback
    );

}


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
            typeof data.code === "number" &&
            data.code >= 400
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
 * Generic KIE HTTP request.
 */
async function request(
    path,
    options = {}
) {

    const method =
        options.method ||
        "GET";

    const headers = {
        Accept:
            "application/json",
        Authorization:
            `Bearer ${getApiKey()}`,
        ...(options.headers || {})
    };

    if (
        options.body !== undefined &&
        !headers["Content-Type"]
    ) {

        headers["Content-Type"] =
            "application/json";

    }

    const response =
        await fetch(
            buildUrl(path),
            {
                method,
                headers,
                body:
                    options.body === undefined
                        ? undefined
                        : typeof options.body === "string"
                            ? options.body
                            : JSON.stringify(
                                options.body
                            )
            }
        );

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

        const message =
            extractMessage(
                data,
                `KIE.AI request gagal (${response.status}).`
            );

        const error =
            new Error(message);

        error.status =
            response.status;

        error.response =
            data;

        throw error;

    }

    return data;

}


/**
 * Create KIE task.
 *
 * payload:
 * {
 *   model: "...",
 *   input: {...},
 *   callBackUrl?: "..."
 * }
 */
async function createTask(
    payload
) {

    if (
        !payload ||
        typeof payload !== "object"
    ) {

        throw new Error(
            "Payload KIE.AI tidak valid."
        );

    }

    if (
        !payload.model ||
        typeof payload.model !== "string"
    ) {

        throw new Error(
            "Model KIE.AI wajib diisi."
        );

    }

    if (
        !payload.input ||
        typeof payload.input !== "object"
    ) {

        throw new Error(
            "Input model KIE.AI wajib berupa object."
        );

    }

    const data =
        await request(
            CREATE_TASK_PATH,
            {
                method: "POST",
                body: payload
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
 * Get task information.
 *
 * KIE endpoint:
 * GET /api/v1/jobs/recordInfo?taskId=...
 */
async function getTask(
    taskId
) {

    const normalizedTaskId =
        String(
            taskId || ""
        ).trim();

    if (!normalizedTaskId) {

        throw new Error(
            "taskId KIE.AI wajib diisi."
        );

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
                method: "GET"
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
 * Convenience helper.
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
                taskId
            );

        const task =
            result?.task ||
            {};

        const state =
            String(
                task.state ||
                task.status ||
                ""
            ).toLowerCase();

        if (
            terminalStates.has(
                state
            )
        ) {

            return result;

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


const client = {

    request,

    createTask,

    getTask,

    waitForTask,

    getBaseUrl

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

    waitForTask

};


export default client;
