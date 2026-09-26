/* =========================================================
   GEN-Z.AI
   GENERATE POLLING MODULE
   ---------------------------------------------------------
   File:
   generate/assets/js/generate-polling.js

   Tanggung jawab:
   - Polling status task ke /api/generate-status
   - Mengambil access token Supabase
   - Menentukan status processing / completed /
     cancelled / failed
   - Mengambil result URL dari backend
   - Memastikan generation_history sudah tersinkron sebelum
     polling terminal dianggap benar-benar selesai
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
   history_updated === true
          ↓
   result_urls
          ↓
   selesai

   CANCEL:

   Admin Dashboard
          ↓
   generation_history.status = cancelled
          ↓
   /api/generate-status
          ↓
   cancelled
          ↓
   polling terminal
          ↓
   TIDAK dianggap failed

   CATATAN:
   - /api/generate-status membutuhkan task_id + model_id
   - Module ini tidak membuat row generation_history
   - Backend tetap menjadi pemilik sinkronisasi History
   - Polling TIDAK boleh berhenti sebelum terminal task
     sudah direkonsiliasi oleh backend
   - cancelled berbeda dari failed
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


/*
 * Setelah provider sudah completed tetapi History belum
 * tersinkron, kita tetap meminta backend melakukan
 * reconciliation pada polling berikutnya.
 *
 * Nilai ini tidak membatasi jumlah polling task.
 * Hanya digunakan sebagai diagnostic counter.
 */

const HISTORY_RECONCILIATION_LOG_INTERVAL =
    3;


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
            /[\s-]+/g,
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

                            item.download_url ||

                            item.downloadUrl ||

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

                value.download_url ||

                value.downloadUrl ||

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

        data?.data?.resultJson?.result_urls,

        data?.resultJson?.data?.resultUrls,

        data?.resultJson?.data?.result_urls,

        data?.data?.resultJson?.data?.resultUrls,

        data?.data?.resultJson?.data?.result_urls

    ];


    const urls =
        [];


    for (
        const candidate
        of candidates
    ) {

        const extracted =
            normalizeResultUrls(
                candidate
            );


        for (
            const url
            of extracted
        ) {

            if (
                url &&
                !urls.includes(
                    url
                )
            ) {

                urls.push(
                    url
                );
            }
        }

    }


    return urls;
}


/* =========================================================
   BOOLEAN FLAG
========================================================= */

function findBooleanFlag(
    data,
    keys
) {

    const objects = [

        data,

        data?.data,

        data?.task,

        data?.result,

        data?.data?.task,

        data?.data?.result

    ];


    for (
        const object
        of objects
    ) {

        if (
            !object ||
            typeof object !==
                "object"
        ) {

            continue;
        }


        for (
            const key
            of keys
        ) {

            if (
                object?.[key] === true
            ) {

                return true;
            }

        }
    }


    return false;
}


/* =========================================================
   HISTORY SYNC STATE
   ---------------------------------------------------------
   Backend /api/generate-status mengembalikan:

     history_updated
     history_status
     history_reason

   Kita harus mempertahankan informasi ini.
========================================================= */

function extractHistoryUpdated(
    data
) {

    return (

        data?.history_updated === true ||

        data?.historyUpdated === true ||

        data?.data?.history_updated === true ||

        data?.data?.historyUpdated === true ||

        data?.task?.history_updated === true ||

        data?.task?.historyUpdated === true

    );
}


function extractHistoryStatus(
    data
) {

    return normalizeTaskState(

        data?.history_status ||

        data?.historyStatus ||

        data?.data?.history_status ||

        data?.data?.historyStatus ||

        data?.task?.history_status ||

        data?.task?.historyStatus ||

        ""

    );
}


function extractHistoryReason(
    data
) {

    return normalizeString(

        data?.history_reason ||

        data?.historyReason ||

        data?.data?.history_reason ||

        data?.data?.historyReason ||

        data?.task?.history_reason ||

        data?.task?.historyReason ||

        ""

    );
}


/* =========================================================
   CANCELLATION DETECTION
   ---------------------------------------------------------
   Cancellation memiliki prioritas lebih tinggi daripada
   failed/completed.

   Sumber cancellation dapat berasal dari:
   - state
   - status
   - cancellation
   - cancelled
   - canceled
   - history_status
   - history_reason
========================================================= */

function isCancellationState(
    value
) {

    const normalized =
        normalizeTaskState(
            value
        );


    return (
        normalized ===
            "cancelled" ||
        normalized ===
            "canceled"
    );
}


function extractCancellation(
    data,
    state,
    historyStatus,
    historyReason
) {

    const explicitCancellation =
        findBooleanFlag(
            data,
            [
                "cancelled",
                "canceled",
                "cancellation"
            ]
        );


    const stateCancelled =
        isCancellationState(
            state
        );


    const historyCancelled =
        isCancellationState(
            historyStatus
        );


    const reasonCancelled =
        isCancellationState(
            historyReason
        ) ||
        normalizeString(
            historyReason
        )
            .toLowerCase()
            .includes(
                "generation_cancelled"
            ) ||
        normalizeString(
            historyReason
        )
            .toLowerCase()
            .includes(
                "generation-cancelled"
            );


    return (
        explicitCancellation ||
        stateCancelled ||
        historyCancelled ||
        reasonCancelled
    );
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


    /*
     * Backend generate-status sudah melakukan normalisasi.
     *
     * Kita tetap membaca flag dari beberapa kemungkinan
     * bentuk response agar module ini tidak rapuh.
     */

    const explicitCompleted =
        findBooleanFlag(
            data,
            [
                "completed",
                "complete",
                "finished",
                "success"
            ]
        );


    const explicitFailed =
        findBooleanFlag(
            data,
            [
                "failed",
                "failure"
            ]
        );


    const explicitProcessing =
        findBooleanFlag(
            data,
            [
                "processing",
                "running",
                "generating"
            ]
        );


    const completedStates =
        new Set([
            "success",
            "succeeded",
            "successful",
            "completed",
            "complete",
            "done",
            "finished",
            "finish",
            "successfully_completed",
            "successfully_completed"
        ]);


    const failedStates =
        new Set([
            "fail",
            "failed",
            "failure",
            "error",
            "rejected",
            "terminated",
            "aborted"
        ]);


    const cancelledStates =
        new Set([
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
            "created",
            "submitted",
            "starting",
            "started"
        ]);


    /*
     * =====================================================
     * HISTORY INFORMATION
     * =====================================================
     */

    const historyUpdated =
        extractHistoryUpdated(
            data
        );


    const historyStatus =
        extractHistoryStatus(
            data
        );


    const historyReason =
        extractHistoryReason(
            data
        );


    /*
     * =====================================================
     * CANCELLATION
     * =====================================================
     *
     * Harus dihitung SEBELUM failed.
     */

    const cancelled =
        extractCancellation(
            data,
            state,
            historyStatus,
            historyReason
        );


    /*
     * =====================================================
     * STATUS PRIORITY
     * =====================================================
     *
     * CANCELLED
     *     ↓
     * FAILED
     *     ↓
     * COMPLETED
     *     ↓
     * PROCESSING
     *
     * Cancellation selalu memiliki prioritas tertinggi.
     */

    const hasResult =
        resultUrls.length > 0;


    const processingState =
        explicitProcessing ||
        waitingStates.has(
            state
        );


    const failed =
        !cancelled &&
        (
            explicitFailed ||
            failedStates.has(
                state
            )
        );


    const completed =
        !cancelled &&
        !failed &&
        !processingState &&
        (
            explicitCompleted ||
            completedStates.has(
                state
            )
        );


    const processing =
        !cancelled &&
        !failed &&
        !completed;


    let normalizedState =
        state;


    if (
        cancelled
    ) {

        normalizedState =
            "cancelled";

    } else if (
        failed
    ) {

        normalizedState =
            "failed";

    } else if (
        completed
    ) {

        normalizedState =
            "completed";

    } else {

        normalizedState =
            "processing";
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

        provider_state:
            state,

        processing,

        completed,

        failed,

        cancelled,

        cancellation:
            cancelled,

        has_result:
            hasResult,

        hasResult:
            hasResult,

        result_urls:
            resultUrls,

        resultUrls:
            resultUrls,

        /*
         * History synchronization state.
         */

        history_updated:
            historyUpdated,

        historyUpdated:
            historyUpdated,

        history_status:
            historyStatus,

        historyStatus:
            historyStatus,

        history_reason:
            historyReason,

        historyReason:
            historyReason

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
                            "application/json",

                        "Cache-Control":
                            "no-cache"

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
   HISTORY RECONCILIATION CHECK
========================================================= */

function isHistorySynchronized(
    result
) {

    /*
     * Cancellation tidak membutuhkan
     * reconciliation completed.
     */

    if (
        result?.cancelled === true ||
        result?.cancellation === true
    ) {

        return true;
    }


    /*
     * Backend adalah sumber kebenaran.
     *
     * history_updated === true
     * berarti PATCH generation_history berhasil.
     */

    if (
        result?.history_updated === true
    ) {

        return true;
    }


    /*
     * Beberapa backend lama mungkin hanya mengembalikan
     * history_status.
     *
     * Tetap izinkan completed jika backend secara eksplisit
     * menyatakan History sudah completed.
     */

    if (
        normalizeTaskState(
            result?.history_status
        ) ===
        "completed"
    ) {

        /*
         * Jangan langsung menganggap ini true bila
         * history_updated tersedia dan bernilai false.
         */

        if (
            result?.history_updated === false
        ) {

            return false;
        }


        return true;
    }


    return false;
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


    let historyReconciliationCount =
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

                            history_reconciliation_count:
                                historyReconciliationCount,

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


        /* =================================================
           CANCELLED
           -------------------------------------------------
           Cancellation HARUS diperiksa sebelum failed.
        ================================================= */

        if (
            result.cancelled === true ||
            result.cancellation === true ||
            isCancellationState(
                result.state
            ) ||
            isCancellationState(
                result.provider_state
            ) ||
            isCancellationState(
                result.history_status
            )
        ) {

            /*
             * Cancellation adalah terminal state.
             *
             * Jangan throw GeneratePollingError karena
             * generate-app.js dapat menganggap exception
             * sebagai failure.
             */

            return {

                ...result,

                state:
                    "cancelled",

                processing:
                    false,

                completed:
                    false,

                failed:
                    false,

                cancelled:
                    true,

                cancellation:
                    true

            };
        }


        /* =================================================
           FAILED
        ================================================= */

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


        /* =================================================
           COMPLETED
           + HISTORY SYNCHRONIZATION
        ================================================= */

        if (
            result.completed
        ) {

            const historySynchronized =
                isHistorySynchronized(
                    result
                );


            /*
             * =================================================
             * CASE 1:
             * Provider completed + History completed
             *
             * Ini kondisi terminal sebenarnya.
             * =================================================
             */

            if (
                historySynchronized
            ) {

                return result;
            }


            /*
             * =================================================
             * CASE 2:
             * Provider completed tetapi History belum update.
             *
             * JANGAN langsung return.
             *
             * Kita panggil /api/generate-status lagi sehingga
             * backend memiliki kesempatan melakukan PATCH ulang.
             * =================================================
             */

            historyReconciliationCount += 1;


            if (
                historyReconciliationCount === 1 ||
                historyReconciliationCount %
                    HISTORY_RECONCILIATION_LOG_INTERVAL ===
                    0
            ) {

                console.warn(
                    "[GEN-Z.AI] Task sudah completed tetapi generation_history belum tersinkron. Reconciliation ulang...",
                    {

                        task_id:
                            normalizedTaskId,

                        model_id:
                            polling.modelId,

                        poll_count:
                            pollCount,

                        history_reconciliation_count:
                            historyReconciliationCount,

                        history_updated:
                            result.history_updated,

                        history_status:
                            result.history_status,

                        history_reason:
                            result.history_reason,

                        result_count:
                            Array.isArray(
                                result.result_urls
                            )
                                ? result.result_urls.length
                                : 0

                    }
                );
            }


            /*
             * Jangan sleep terlalu lama ketika provider sudah
             * selesai. Backend perlu segera mendapat request
             * berikutnya untuk reconciliation.
             */

            await sleep(
                Math.min(
                    polling.interval,
                    2000
                )
            );


            continue;
        }


        /* =================================================
           PROCESSING
        ================================================= */

        /*
         * Selama belum completed / failed / cancelled,
         * task tetap dipolling.
         *
         * Result URL saja tidak mengakhiri polling.
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
