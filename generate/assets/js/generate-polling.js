/* =========================================================
   GEN-Z.AI
   GENERATE POLLING MODULE
   ---------------------------------------------------------
   File:
   generate/assets/js/generate-polling.js

   Tanggung jawab:
   - Polling status task ke /api/generate-status
   - Mengambil access token Supabase
   - Menentukan status processing / completed / failed
   - Mengambil result URL dari backend
   - Timeout polling
   - Menyediakan callback/event untuk module lain

   Tidak bertanggung jawab:
   - Membuat task
   - Menentukan provider
   - API key provider
   - Query Supabase langsung
   - Render UI
   - Render video
   - Credit calculation
   - Menentukan model

   Alur:

   generate-request.js
          ↓
      task_id
          ↓
   generate-polling.js
          ↓
   /api/generate-status
          ↓
   processing
          ↓
   completed
          ↓
   result_urls
========================================================= */


import {
    getAccessToken
} from "./generate-auth.js";


/* =========================================================
   CONFIG
========================================================= */

const STATUS_ENDPOINT =
    "/api/generate-status";


const DEFAULT_INTERVAL =
    3000;


const DEFAULT_TIMEOUT =
    10 * 60 * 1000;


/* =========================================================
   ERROR CLASS
========================================================= */

export class GeneratePollingError
    extends Error {

    constructor(
        message,
        options = {}
    ) {

        super(
            message
        );

        this.name =
            "GeneratePollingError";

        this.status =
            Number(
                options.status
            ) || 0;

        this.code =
            options.code ||
            null;

        this.details =
            options.details ||
            null;

        this.response =
            options.response ||
            null;
    }
}


/* =========================================================
   SAFE NUMBER
========================================================= */

function normalizeNumber(
    value,
    fallback
) {

    const number =
        Number(
            value
        );

    if (
        !Number.isFinite(
            number
        )
    ) {

        return fallback;
    }

    return number;
}


/* =========================================================
   NORMALIZE STRING
========================================================= */

function normalizeString(
    value,
    fallback = ""
) {

    if (
        value === null ||
        value === undefined
    ) {

        return fallback;
    }

    const result =
        String(
            value
        ).trim();

    return result ||
        fallback;
}


/* =========================================================
   PARSE RESPONSE
========================================================= */

async function parseResponseJson(
    response
) {

    const contentType =
        String(
            response.headers.get(
                "content-type"
            ) || ""
        ).toLowerCase();


    if (
        contentType.includes(
            "application/json"
        )
    ) {

        try {

            return await response.json();

        } catch (
            error
        ) {

            throw new GeneratePollingError(
                "Response status task tidak dapat dibaca sebagai JSON.",
                {
                    status:
                        response.status,

                    code:
                        "INVALID_JSON",

                    details:
                        error
                }
            );
        }
    }


    const text =
        await response.text();


    if (!text) {

        return {};
    }


    try {

        return JSON.parse(
            text
        );

    } catch {

        return {

            success:
                response.ok,

            message:
                text
        };
    }
}


/* =========================================================
   ERROR MESSAGE
========================================================= */

function extractErrorMessage(
    data,
    fallback
) {

    if (!data) {

        return fallback;
    }


    if (
        typeof data.error ===
            "string" &&
        data.error.trim()
    ) {

        return data.error.trim();
    }


    if (
        typeof data.message ===
            "string" &&
        data.message.trim()
    ) {

        return data.message.trim();
    }


    if (
        Array.isArray(
            data.errors
        ) &&
        data.errors.length
    ) {

        return data.errors
            .map(
                item => {

                    if (
                        typeof item ===
                            "string"
                    ) {

                        return item;
                    }


                    if (
                        item &&
                        typeof item ===
                            "object"
                    ) {

                        return (
                            item.message ||
                            item.error ||
                            JSON.stringify(
                                item
                            )
                        );
                    }


                    return String(
                        item
                    );
                }
            )
            .filter(
                Boolean
            )
            .join(
                " "
            );
    }


    if (
        data.data &&
        typeof data.data ===
            "object"
    ) {

        if (
            typeof data.data.error ===
                "string"
        ) {

            return data.data.error;
        }


        if (
            typeof data.data.message ===
                "string"
        ) {

            return data.data.message;
        }
    }


    return fallback;
}


/* =========================================================
   ERROR CODE
========================================================= */

function extractErrorCode(
    data
) {

    if (!data) {

        return null;
    }


    return (
        data.code ||
        data.error_code ||
        data.errorCode ||
        data.data?.code ||
        null
    );
}


/* =========================================================
   TASK ID
========================================================= */

function extractTaskId(
    data
) {

    return normalizeString(
        data?.task_id ||
        data?.taskId ||
        data?.job_id ||
        data?.jobId ||
        data?.task?.task_id ||
        data?.task?.taskId ||
        data?.task?.job_id ||
        data?.task?.jobId ||
        ""
    );
}


/* =========================================================
   STATE
========================================================= */

function normalizeTaskState(
    value
) {

    return normalizeString(
        value
    ).toLowerCase();
}


/* =========================================================
   RESULT URLS
========================================================= */

function normalizeResultUrls(
    value
) {

    if (
        !Array.isArray(
            value
        )
    ) {

        return [];
    }


    return value
        .map(
            item => {

                if (
                    typeof item ===
                        "string"
                ) {

                    return item.trim();
                }

                return "";
            }
        )
        .filter(
            Boolean
        );
}


/* =========================================================
   EXTRACT RESULT URLS
========================================================= */

function extractResultUrls(
    data
) {

    const candidates = [

        data?.result_urls,

        data?.resultUrls,

        data?.result?.result_urls,

        data?.result?.resultUrls,

        data?.result?.urls,

        data?.result?.video_urls,

        data?.result?.videoUrls,

        data?.task?.result_urls,

        data?.task?.resultUrls,

        data?.task?.result?.result_urls,

        data?.task?.result?.resultUrls,

        data?.task?.result?.urls,

        data?.resultJson?.resultUrls,

        data?.resultJson?.result_urls

    ];


    for (
        const candidate
        of candidates
    ) {

        const urls =
            normalizeResultUrls(
                candidate
            );


        if (
            urls.length
        ) {

            return urls;
        }
    }


    return [];
}


/* =========================================================
   NORMALIZE STATUS RESPONSE
========================================================= */

export function normalizePollingResult(
    data = {}
) {

    const taskId =
        extractTaskId(
            data
        );


    const state =
        normalizeTaskState(
            data.state ||
            data.status ||
            data.task?.state ||
            data.task?.status
        );


    const resultUrls =
        extractResultUrls(
            data
        );


    const explicitCompleted =
        data.completed === true;


    const explicitFailed =
        data.failed === true;


    const explicitProcessing =
        data.processing === true;


    const completedStates =
        new Set([
            "success",
            "succeeded",
            "completed",
            "complete",
            "done",
            "finished"
        ]);


    const failedStates =
        new Set([
            "fail",
            "failed",
            "error",
            "cancelled",
            "canceled"
        ]);


    const waitingStates =
        new Set([
            "waiting",
            "pending",
            "queued",
            "queue",
            "processing",
            "running",
            "generating",
            "in_progress",
            "in-progress"
        ]);


    /*
     * Jika backend sudah memberikan result URL,
     * anggap task selesai meskipun state dari provider
     * tidak menggunakan nama "success".
     *
     * Ini penting untuk KIE karena hasil akhirnya
     * dapat berupa resultUrls.
     */

    const completed =
        explicitCompleted ||
        completedStates.has(
            state
        ) ||
        resultUrls.length > 0;


    const failed =
        explicitFailed ||
        failedStates.has(
            state
        );


    const processing =
        !completed &&
        !failed &&
        (
            explicitProcessing ||
            waitingStates.has(
                state
            )
        );


    return {

        ...data,

        task_id:
            taskId,

        taskId:
            taskId,

        state:

            state ||

            (
                completed
                    ? "success"
                    : failed
                        ? "failed"
                        : "processing"
            ),

        processing,

        completed,

        failed,

        result_urls:
            resultUrls,

        resultUrls:
            resultUrls
    };
}


/* =========================================================
   REQUEST STATUS
   ---------------------------------------------------------
   PERBAIKAN:
   /api/generate-status membutuhkan:
      task_id
      model_id

   Sebelumnya module ini hanya mengirim task_id.
========================================================= */

export async function requestTaskStatus(
    taskId,
    modelId
) {

    const normalizedTaskId =
        normalizeString(
            taskId
        );


    const normalizedModelId =
        normalizeString(
            modelId
        );


    if (!normalizedTaskId) {

        throw new GeneratePollingError(
            "Task ID wajib diisi.",
            {
                code:
                    "TASK_ID_REQUIRED"
            }
        );
    }


    if (!normalizedModelId) {

        throw new GeneratePollingError(
            "Model ID wajib diisi untuk mengambil status task.",
            {
                code:
                    "MODEL_ID_REQUIRED"
            }
        );
    }


    const accessToken =
        await getAccessToken();


    if (!accessToken) {

        throw new GeneratePollingError(
            "Sesi login tidak ditemukan. Silakan login kembali.",
            {
                status:
                    401,

                code:
                    "AUTH_REQUIRED"
            }
        );
    }


    let response;


    try {

        response =
            await fetch(
                STATUS_ENDPOINT,
                {
                    method:
                        "POST",

                    headers: {

                        "Content-Type":
                            "application/json",

                        "Authorization":
                            `Bearer ${accessToken}`
                    },

                    body:
                        JSON.stringify({

                            task_id:
                                normalizedTaskId,

                            model_id:
                                normalizedModelId
                        })
                }
            );

    } catch (
        error
    ) {

        throw new GeneratePollingError(
            "Tidak dapat terhubung ke server status task.",
            {
                code:
                    "NETWORK_ERROR",

                details:
                    error
            }
        );
    }


    const data =
        await parseResponseJson(
            response
        );


    if (
        !response.ok
    ) {

        const message =
            extractErrorMessage(
                data,
                `Status task gagal dengan status ${response.status}.`
            );


        throw new GeneratePollingError(
            message,
            {
                status:
                    response.status,

                code:
                    extractErrorCode(
                        data
                    ),

                details:
                    data,

                response
            }
        );
    }


    if (
        data &&
        data.success === false
    ) {

        throw new GeneratePollingError(
            extractErrorMessage(
                data,
                "Gagal mengambil status task."
            ),
            {
                status:
                    response.status,

                code:
                    extractErrorCode(
                        data
                    ),

                details:
                    data,

                response
            }
        );
    }


    return normalizePollingResult(
        data
    );
}


/* =========================================================
   SLEEP
========================================================= */

function sleep(
    milliseconds
) {

    return new Promise(
        resolve =>
            setTimeout(
                resolve,
                milliseconds
            )
    );
}


/* =========================================================
   POLLING OPTIONS
========================================================= */

function normalizePollingOptions(
    options = {}
) {

    const interval =
        Math.max(
            1000,
            normalizeNumber(
                options.interval,
                DEFAULT_INTERVAL
            )
        );


    const timeout =
        Math.max(
            interval,
            normalizeNumber(
                options.timeout,
                DEFAULT_TIMEOUT
            )
        );


    /*
     * modelId dapat dikirim sebagai:
     *
     * options.modelId
     *
     * atau:
     *
     * options.model_id
     *
     * untuk menjaga kompatibilitas dengan
     * struktur data backend.
     */

    const modelId =
        normalizeString(
            options.modelId ||
            options.model_id ||
            ""
        );


    return {

        interval,

        timeout,

        modelId,

        signal:
            options.signal ||
            null,

        onUpdate:
            typeof options.onUpdate ===
                "function"
                ? options.onUpdate
                : null
    };
}


/* =========================================================
   ABORT CHECK
========================================================= */

function checkAbort(
    signal
) {

    if (
        signal?.aborted
    ) {

        throw new GeneratePollingError(
            "Polling dibatalkan.",
            {
                code:
                    "POLLING_ABORTED"
            }
        );
    }
}


/* =========================================================
   POLL TASK
========================================================= */

export async function pollTask(
    taskId,
    options = {}
) {

    const normalizedTaskId =
        normalizeString(
            taskId
        );


    if (!normalizedTaskId) {

        throw new GeneratePollingError(
            "Task ID wajib diisi.",
            {
                code:
                    "TASK_ID_REQUIRED"
            }
        );
    }


    const polling =
        normalizePollingOptions(
            options
        );


    /*
     * /api/generate-status membutuhkan model_id.
     *
     * Jangan melakukan polling tanpa model ID karena
     * backend memang membutuhkan ID tersebut untuk
     * menentukan adapter/provider yang digunakan.
     */

    if (!polling.modelId) {

        throw new GeneratePollingError(
            "Model ID wajib diisi untuk polling task.",
            {
                code:
                    "MODEL_ID_REQUIRED",

                details:
                    {
                        task_id:
                            normalizedTaskId
                    }
            }
        );
    }


    const startedAt =
        Date.now();


    let lastResult =
        null;


    while (true) {

        checkAbort(
            polling.signal
        );


        const elapsed =
            Date.now() -
            startedAt;


        if (
            elapsed >=
            polling.timeout
        ) {

            throw new GeneratePollingError(
                "Waktu tunggu generate telah habis.",
                {
                    code:
                        "POLLING_TIMEOUT",

                    details:
                        {
                            task_id:
                                normalizedTaskId,

                            model_id:
                                polling.modelId,

                            elapsed,

                            last_result:
                                lastResult
                        }
                }
            );
        }


        const result =
            await requestTaskStatus(

                normalizedTaskId,

                polling.modelId

            );


        lastResult =
            result;


        if (
            polling.onUpdate
        ) {

            try {

                polling.onUpdate(
                    result
                );

            } catch (
                callbackError
            ) {

                /*
                 * Callback UI tidak boleh
                 * menghentikan polling.
                 */

                console.warn(
                    "[GEN-Z.AI] Polling onUpdate callback error:",
                    callbackError
                );
            }
        }


        /*
         * KIE sudah selesai.
         *
         * Jika resultUrls tersedia, normalizePollingResult()
         * juga akan menandai completed=true.
         */

        if (
            result.completed
        ) {

            return result;
        }


        if (
            result.failed
        ) {

            throw new GeneratePollingError(
                extractErrorMessage(
                    result,
                    "Task generate gagal."
                ),
                {
                    code:
                        extractErrorCode(
                            result
                        ) ||
                        "TASK_FAILED",

                    details:
                        result
                }
            );
        }


        await sleep(
            polling.interval
        );
    }
}


/* =========================================================
   CONVENIENCE ALIAS
========================================================= */

export async function pollGenerateTask(
    taskId,
    options = {}
) {

    return pollTask(
        taskId,
        options
    );
}


/* =========================================================
   ENDPOINT
========================================================= */

export function getStatusEndpoint() {

    return STATUS_ENDPOINT;
}


/* =========================================================
   PUBLIC API
========================================================= */

export const generatePolling =
    Object.freeze({

        requestTaskStatus,

        normalizePollingResult,

        pollTask,

        pollGenerateTask,

        getStatusEndpoint,

        GeneratePollingError

    });


export default generatePolling;
