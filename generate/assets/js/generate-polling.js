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

   ALUR:

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

   CATATAN:
   - /api/generate-status membutuhkan task_id + model_id
   - Module ini tidak membuat row generation_history
   - Status History harus direkonsiliasi oleh backend
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
        typeof data.msg ===
            "string" &&
        data.msg.trim()
    ) {

        return data.msg.trim();
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


    const nestedObjects = [

        data.data,

        data.task,

        data.result,

        data.data?.task,

        data.data?.result

    ];


    for (
        const nested
        of nestedObjects
    ) {

        if (
            !nested ||
            typeof nested !==
                "object"
        ) {

            continue;
        }


        if (
            typeof nested.error ===
                "string" &&
            nested.error.trim()
        ) {

            return nested.error.trim();
        }


        if (
            typeof nested.message ===
                "string" &&
            nested.message.trim()
        ) {

            return nested.message.trim();
        }


        if (
            typeof nested.msg ===
                "string" &&
            nested.msg.trim()
        ) {

            return nested.msg.trim();
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

        data.data?.error_code ||

        data.data?.errorCode ||

        data.task?.code ||

        data.result?.code ||

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

        data?.data?.task_id ||

        data?.data?.taskId ||

        data?.data?.job_id ||

        data?.data?.jobId ||

        data?.task?.task_id ||

        data?.task?.taskId ||

        data?.task?.job_id ||

        data?.task?.jobId ||

        data?.data?.task?.task_id ||

        data?.data?.task?.taskId ||

        data?.data?.task?.job_id ||

        data?.data?.task?.jobId ||

        ""
    );
}


/* =========================================================
   MODEL ID
========================================================= */

function extractModelId(
    data
) {

    return normalizeString(

        data?.model_id ||

        data?.modelId ||

        data?.data?.model_id ||

        data?.data?.modelId ||

        data?.task?.model_id ||

        data?.task?.modelId ||

        data?.data?.task?.model_id ||

        data?.data?.task?.modelId ||

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
    )
        .toLowerCase()
        .replace(
            /\s+/g,
            "_"
        );
}


/* =========================================================
   EXTRACT TASK STATE
========================================================= */

function extractTaskState(
    data
) {

    return normalizeTaskState(

        data?.state ||

        data?.status ||

        data?.task_state ||

        data?.taskStatus ||

        data?.data?.state ||

        data?.data?.status ||

        data?.data?.task_state ||

        data?.data?.taskStatus ||

        data?.task?.state ||

        data?.task?.status ||

        data?.task?.task_state ||

        data?.task?.taskStatus ||

        data?.data?.task?.state ||

        data?.data?.task?.status ||

        data?.data?.task?.task_state ||

        data?.data?.task?.taskStatus ||

        data?.result?.state ||

        data?.result?.status ||

        data?.data?.result?.state ||

        data?.data?.result?.status ||

        ""
    );
}


/* =========================================================
   RESULT URLS
========================================================= */

function normalizeResultUrls(
    value
) {

    if (
        Array.isArray(
            value
        )
    ) {

        return value
            .map(
                item => {

                    if (
                        typeof item ===
                            "string"
                    ) {

                        return item.trim();
                    }


                    if (
                        item &&
                        typeof item ===
                            "object"
                    ) {

                        return normalizeString(

                            item.url ||

                            item.result_url ||

                            item.resultUrl ||

                            item.video_url ||

                            item.videoUrl ||

                            item.file_url ||

                            item.fileUrl ||

                            ""

                        );
                    }


                    return "";
                }
            )
            .filter(
                Boolean
            );
    }


    if (
        typeof value ===
            "string"
    ) {

        const normalized =
            value.trim();


        if (!normalized) {

            return [];
        }


        return [
            normalized
        ];
    }


    if (
        value &&
        typeof value ===
            "object"
    ) {

        const singleUrl =
            normalizeString(

                value.url ||

                value.result_url ||

                value.resultUrl ||

                value.video_url ||

                value.videoUrl ||

                value.file_url ||

                value.fileUrl ||

                ""

            );


        return singleUrl
            ? [singleUrl]
            : [];
    }


    return [];
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

        data?.urls,

        data?.video_urls,

        data?.videoUrls,

        data?.data?.result_urls,

        data?.data?.resultUrls,

        data?.data?.urls,

        data?.data?.video_urls,

        data?.data?.videoUrls,

        data?.result?.result_urls,

        data?.result?.resultUrls,

        data?.result?.urls,

        data?.result?.video_urls,

        data?.result?.videoUrls,

        data?.data?.result?.result_urls,

        data?.data?.result?.resultUrls,

        data?.data?.result?.urls,

        data?.data?.result?.video_urls,

        data?.data?.result?.videoUrls,

        data?.task?.result_urls,

        data?.task?.resultUrls,

        data?.task?.urls,

        data?.task?.video_urls,

        data?.task?.videoUrls,

        data?.task?.result?.result_urls,

        data?.task?.result?.resultUrls,

        data?.task?.result?.urls,

        data?.task?.result?.video_urls,

        data?.task?.result?.videoUrls,

        data?.data?.task?.result_urls,

        data?.data?.task?.resultUrls,

        data?.data?.task?.urls,

        data?.data?.task?.video_urls,

        data?.data?.task?.videoUrls,

        data?.data?.task?.result?.result_urls,

        data?.data?.task?.result?.resultUrls,

        data?.data?.task?.result?.urls,

        data?.data?.task?.result?.video_urls,

        data?.data?.task?.result?.videoUrls,

        data?.resultJson?.resultUrls,

        data?.resultJson?.result_urls,

        data?.data?.resultJson?.resultUrls,

        data?.data?.resultJson?.result_urls

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

    if (
        !data ||
        typeof data !==
            "object"
    ) {

        data = {};
    }


    const taskId =
        extractTaskId(
            data
        );


    const modelId =
        extractModelId(
            data
        );


    const state =
        extractTaskState(
            data
        );


    const resultUrls =
        extractResultUrls(
            data
        );


    const explicitCompleted =
        data.completed === true ||
        data.data?.completed === true ||
        data.task?.completed === true ||
        data.data?.task?.completed === true;


    const explicitFailed =
        data.failed === true ||
        data.data?.failed === true ||
        data.task?.failed === true ||
        data.data?.task?.failed === true;


    const explicitProcessing =
        data.processing === true ||
        data.data?.processing === true ||
        data.task?.processing === true ||
        data.data?.task?.processing === true;


    const completedStates =
        new Set([
            "success",
            "succeeded",
            "successful",
            "completed",
            "complete",
            "done",
            "finished",
            "successfully_completed"
        ]);


    const failedStates =
        new Set([
            "fail",
            "failed",
            "failure",
            "error",
            "cancelled",
            "canceled",
            "rejected",
            "terminated"
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
            "in-progress",
            "created",
            "submitted",
            "starting",
            "started"
        ]);


    /*
     * Hasil URL adalah indikator kuat bahwa backend
     * sudah menerima hasil akhir.
     *
     * Jangan hanya bergantung pada nama state KIE,
     * karena adapter/backend dapat menggunakan
     * struktur response yang berbeda.
     */

    const hasResult =
        resultUrls.length > 0;


    const completed =
        explicitCompleted ||
        completedStates.has(
            state
        ) ||
        hasResult;


    const failed =
        !completed &&
        (
            explicitFailed ||
            failedStates.has(
                state
            )
        );


    const processing =
        !completed &&
        !failed &&
        (
            explicitProcessing ||
            waitingStates.has(
                state
            ) ||
            !state
        );


    let normalizedState =
        state;


    if (!normalizedState) {

        normalizedState =
            completed
                ? "success"
                : failed
                    ? "failed"
                    : "processing";
    }


    return {

        ...data,

        task_id:
            taskId,

        taskId:
            taskId,

        model_id:
            modelId,

        modelId:
            modelId,

        state:
            normalizedState,

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
   /api/generate-status membutuhkan:
      task_id
      model_id
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
                            `Bearer ${accessToken}`,

                        "Accept":
                            "application/json"

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


    const modelId =
        normalizeString(

            options.modelId ||

            options.model_id ||

            options.model?.model_id ||

            options.model?.modelId ||

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
     * Jangan melakukan polling tanpa model ID.
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


    let pollCount =
        0;


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

                            poll_count:
                                pollCount,

                            last_result:
                                lastResult

                        }
                }
            );
        }


        pollCount += 1;


        let result;


        try {

            result =
                await requestTaskStatus(

                    normalizedTaskId,

                    polling.modelId

                );

        } catch (
            error
        ) {

            /*
             * Error request status tetap diteruskan.
             *
             * Jangan menganggap error sebagai completed.
             * Jika backend gagal menjawab, History tidak boleh
             * dipalsukan menjadi completed.
             */

            throw error;
        }


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
         * FAILED harus diperiksa sebelum COMPLETED.
         *
         * Normalizer sudah mencegah state failed
         * menjadi completed kecuali terdapat result URL.
         */

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


        /*
         * COMPLETED hanya dikembalikan jika backend
         * benar-benar memberikan status selesai atau
         * result URL.
         */

        if (
            result.completed
        ) {

            return result;
        }


        /*
         * Selama belum completed / failed,
         * task tetap dipolling.
         */

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
