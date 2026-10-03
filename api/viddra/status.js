/* =========================================================
   GEN-Z.AI
   VIDDRA GENERATION STATUS
   ---------------------------------------------------------
   File:
   api/viddra/status.js

   Fungsi:
   - Auth user GEN-Z.AI
   - Validasi task berdasarkan user_id
   - Query status generation VidDra
   - Normalize status VidDra
   - Update generation_history yang sudah ada
   - Menjaga status cancelled
   - Tidak menggunakan KIE
   - Tidak membuat History baru
   - Tidak mengekspos VIDDRA_API_KEY
========================================================= */

const SUPABASE_URL =
    process.env.SUPABASE_URL ||
    "";

const SUPABASE_SERVICE_ROLE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "";

const VIDDRA_API_KEY =
    process.env.VIDDRA_API_KEY ||
    "";

const VIDDRA_API_BASE =
    "https://api.viddra.com/v1";


/* =========================================================
   RESPONSE
========================================================= */

function json(
    res,
    status,
    payload
) {

    res.status(status);

    res.setHeader(
        "Content-Type",
        "application/json; charset=utf-8"
    );

    return res.json(
        payload
    );
}


/* =========================================================
   STRING HELPERS
========================================================= */

function cleanString(
    value
) {

    if (
        value ===
        undefined ||
        value ===
        null
    ) {
        return "";
    }

    return String(
        value
    ).trim();
}


function lower(
    value
) {

    return cleanString(
        value
    ).toLowerCase();
}


/* =========================================================
   FIRST DEFINED
========================================================= */

function firstDefined(
    ...values
) {

    for (
        const value of values
    ) {

        if (
            value !==
                undefined &&
            value !==
                null
        ) {

            return value;
        }
    }

    return null;
}


/* =========================================================
   ERROR SERIALIZER
========================================================= */

function serializeError(
    error
) {

    if (
        !error
    ) {

        return {
            message:
                null,

            status:
                null,

            code:
                null,

            details:
                null,

            hint:
                null,

            data:
                null
        };
    }

    return {

        message:
            error.message ||
            String(
                error
            ),

        status:
            error.status ??
            null,

        code:
            error.code ||
            null,

        details:
            error.details ||
            null,

        hint:
            error.hint ||
            null,

        data:
            error.data ??
            null
    };
}


/* =========================================================
   SUPABASE REQUEST
========================================================= */

async function supabaseRequest(
    path,
    options = {}
) {

    if (
        !SUPABASE_URL ||
        !SUPABASE_SERVICE_ROLE_KEY
    ) {

        const error =
            new Error(
                "Konfigurasi Supabase server belum lengkap."
            );

        error.status =
            500;

        throw error;
    }


    const response =
        await fetch(
            `${SUPABASE_URL}${path}`,
            {
                ...options,

                headers: {

                    apikey:
                        SUPABASE_SERVICE_ROLE_KEY,

                    Authorization:
                        `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,

                    "Content-Type":
                        "application/json",

                    ...(options.headers ||
                        {})
                }
            }
        );


    const text =
        await response.text();


    let data =
        null;


    try {

        data =
            text
                ? JSON.parse(
                    text
                )
                : null;

    } catch {

        data =
            text ||
            null;
    }


    if (
        !response.ok
    ) {

        const error =
            new Error(
                data?.message ||
                data?.error_description ||
                data?.error ||
                `Supabase request gagal (${response.status}).`
            );

        error.status =
            response.status;

        error.data =
            data;

        throw error;
    }


    return data;
}


/* =========================================================
   AUTH USER GEN-Z.AI
========================================================= */

async function authenticateUser(
    req
) {

    const authorization =
        cleanString(
            req.headers?.authorization
        );


    if (
        !authorization
    ) {

        const error =
            new Error(
                "Authorization token tidak ditemukan."
            );

        error.status =
            401;

        error.code =
            "AUTHORIZATION_MISSING";

        throw error;
    }


    const match =
        authorization.match(
            /^Bearer\s+(.+)$/i
        );


    if (
        !match
    ) {

        const error =
            new Error(
                "Authorization token tidak valid."
            );

        error.status =
            401;

        error.code =
            "AUTHORIZATION_INVALID";

        throw error;
    }


    const accessToken =
        cleanString(
            match[1]
        );


    if (
        !accessToken
    ) {

        const error =
            new Error(
                "Access token kosong."
            );

        error.status =
            401;

        error.code =
            "ACCESS_TOKEN_EMPTY";

        throw error;
    }


    const response =
        await fetch(
            `${SUPABASE_URL}/auth/v1/user`,
            {
                method:
                    "GET",

                headers: {

                    apikey:
                        SUPABASE_SERVICE_ROLE_KEY,

                    Authorization:
                        `Bearer ${accessToken}`
                }
            }
        );


    const text =
        await response.text();


    let data =
        null;


    try {

        data =
            text
                ? JSON.parse(
                    text
                )
                : null;

    } catch {

        data =
            null;
    }


    if (
        !response.ok ||
        !data?.id
    ) {

        const error =
            new Error(
                data?.message ||
                data?.error_description ||
                "Session GEN-Z.AI tidak valid."
            );

        error.status =
            response.status === 401
                ? 401
                : 403;

        error.code =
            "GENZ_AUTH_INVALID";

        error.data =
            data;

        throw error;
    }


    return data;
}


/* =========================================================
   REQUEST BODY
========================================================= */

function getRequestBody(
    req
) {

    if (
        req.body &&
        typeof req.body ===
            "object"
    ) {

        return req.body;
    }


    return {};
}


/* =========================================================
   FIND GENERATION HISTORY
========================================================= */

async function findGenerationHistory(
    userId,
    taskId
) {

    const encodedUser =
        encodeURIComponent(
            userId
        );

    const encodedTask =
        encodeURIComponent(
            taskId
        );


    const path =
        `/rest/v1/generation_history` +
        `?user_id=eq.${encodedUser}` +
        `&task_id=eq.${encodedTask}` +
        `&select=*` +
        `&limit=1`;


    const rows =
        await supabaseRequest(
            path,
            {
                method:
                    "GET"
            }
        );


    if (
        !Array.isArray(
            rows
        ) ||
        rows.length ===
            0
    ) {

        return null;
    }


    return rows[0];
}


/* =========================================================
   VIDDRA STATUS RESPONSE EXTRACTION
========================================================= */

function extractVidDraStatus(
    data
) {

    return cleanString(
        firstDefined(

            data?.status,

            data?.state,

            data?.generation?.status,

            data?.generation?.state,

            data?.data?.status,

            data?.data?.state,

            data?.data?.generation?.status,

            data?.data?.generation?.state
        )
    );
}


/* =========================================================
   VIDDRA RESULT URL
========================================================= */

function extractResultUrl(
    data
) {

    const candidates = [

        data?.video_url,

        data?.result_url,

        data?.output_url,

        data?.url,

        data?.generation?.video_url,

        data?.generation?.result_url,

        data?.generation?.output_url,

        data?.generation?.url,

        data?.data?.video_url,

        data?.data?.result_url,

        data?.data?.output_url,

        data?.data?.url,

        data?.data?.generation?.video_url,

        data?.data?.generation?.result_url,

        data?.data?.generation?.output_url,

        data?.data?.generation?.url
    ];


    for (
        const value of
            candidates
    ) {

        const url =
            cleanString(
                value
            );

        if (
            url
        ) {

            return url;
        }
    }


    return "";
}


/* =========================================================
   VIDDRA ERROR
========================================================= */

function extractProviderError(
    data
) {

    const value =
        firstDefined(

            data?.error,

            data?.error_message,

            data?.message,

            data?.generation?.error,

            data?.generation?.error_message,

            data?.data?.error,

            data?.data?.error_message,

            data?.data?.message,

            data?.data?.generation?.error,

            data?.data?.generation?.error_message
        );


    if (
        typeof value ===
            "string"
    ) {

        return cleanString(
            value
        );
    }


    if (
        value &&
        typeof value ===
            "object"
    ) {

        return cleanString(
            firstDefined(

                value.message,

                value.detail,

                value.error,

                value.code
            )
        );
    }


    return "";
}


/* =========================================================
   NORMALIZE VIDDRA STATUS
========================================================= */

function normalizeVidDraStatus(
    data,
    taskId
) {

    const providerState =
        lower(
            extractVidDraStatus(
                data
            )
        );


    const resultUrl =
        extractResultUrl(
            data
        );


    const providerError =
        extractProviderError(
            data
        );


    let state =
        "processing";


    let processing =
        true;


    let completed =
        false;


    let failed =
        false;


    /*
     * -------------------------------------------------------
     * QUEUED
     * -------------------------------------------------------
     */

    if (
        providerState ===
            "queued" ||
        providerState ===
            "pending" ||
        providerState ===
            "created" ||
        providerState ===
            "submitted"
    ) {

        state =
            "processing";

        processing =
            true;
    }


    /*
     * -------------------------------------------------------
     * RUNNING
     * -------------------------------------------------------
     */

    else if (
        providerState ===
            "running" ||
        providerState ===
            "processing" ||
        providerState ===
            "in_progress" ||
        providerState ===
            "in-progress"
    ) {

        state =
            "processing";

        processing =
            true;
    }


    /*
     * -------------------------------------------------------
     * SUCCESS
     * -------------------------------------------------------
     */

    else if (
        providerState ===
            "succeeded" ||
        providerState ===
            "success" ||
        providerState ===
            "completed" ||
        providerState ===
            "complete" ||
        providerState ===
            "done"
    ) {

        state =
            "completed";

        processing =
            false;

        completed =
            true;
    }


    /*
     * -------------------------------------------------------
     * FAILED
     * -------------------------------------------------------
     */

    else if (
        providerState ===
            "failed" ||
        providerState ===
            "failure" ||
        providerState ===
            "error" ||
        providerState ===
            "cancelled" ||
        providerState ===
            "canceled"
    ) {

        state =
            "failed";

        processing =
            false;

        failed =
            true;
    }


    /*
     * -------------------------------------------------------
     * UNKNOWN
     * -------------------------------------------------------
     *
     * Jangan menganggap unknown sebagai success.
     * Provider masih mungkin memproses task.
     */

    else {

        state =
            "processing";

        processing =
            true;
    }


    /*
     * Jika provider mengatakan completed
     * tetapi belum mengembalikan URL,
     * jangan membuat URL palsu.
     */

    return {

        task_id:
            taskId,

        state,

        provider_state:
            providerState ||
            null,

        processing,

        completed,

        failed,

        result_urls:
            resultUrl
                ? [
                    resultUrl
                ]
                : [],

        result_url:
            resultUrl ||
            null,

        error_message:
            providerError ||
            null,

        raw:
            data
    };
}


/* =========================================================
   UPDATE GENERATION HISTORY
========================================================= */

async function updateGenerationHistory(
    history,
    normalized
) {

    const patch = {};


    if (
        normalized.completed
    ) {

        patch.status =
            "success";

        patch.result_url =
            normalized.result_url ||
            null;

        patch.error_message =
            null;

        patch.completed_at =
            new Date()
                .toISOString();
    }


    else if (
        normalized.failed
    ) {

        patch.status =
            "failed";

        patch.error_message =
            normalized.error_message ||
            "Generation VidDra gagal.";

        patch.result_url =
            null;

        patch.completed_at =
            new Date()
                .toISOString();
    }


    else {

        /*
         * Jangan mengubah processing menjadi
         * status lain hanya karena provider belum selesai.
         */

        return {

            strategy:
                "no_update_processing",

            rows:
                [],

            payload:
                null
        };
    }


    const path =
        `/rest/v1/generation_history` +
        `?id=eq.${encodeURIComponent(
            history.id
        )}` +
        `&user_id=eq.${encodeURIComponent(
            history.user_id
        )}`;


    const rows =
        await supabaseRequest(
            path,
            {
                method:
                    "PATCH",

                headers: {

                    Prefer:
                        "return=representation"
                },

                body:
                    JSON.stringify(
                        patch
                    )
            }
        );


    return {

        strategy:
            "history_id_user_id",

        rows:
            Array.isArray(
                rows
            )
                ? rows
                : [],

        payload:
            patch
    };
}


/* =========================================================
   VERIFY GENERATION HISTORY
========================================================= */

async function verifyGenerationHistory(
    history
) {

    const refreshed =
        await findGenerationHistory(
            history.user_id,
            history.task_id
        );


    if (
        !refreshed
    ) {

        return {

            status:
                null,

            result_url:
                null,

            completed_at:
                null
        };
    }


    return {

        status:
            refreshed.status ||
            null,

        result_url:
            refreshed.result_url ||
            null,

        completed_at:
            refreshed.completed_at ||
            null
    };
}


/* =========================================================
   SYNC HISTORY
========================================================= */

async function syncGenerationHistory(
    userId,
    taskId,
    normalized
) {

    const history =
        await findGenerationHistory(
            userId,
            taskId
        );


    /*
     * -------------------------------------------------------
     * HISTORY NOT FOUND
     * -------------------------------------------------------
     */

    if (
        !history
    ) {

        return {

            history_updated:
                false,

            history_matched:
                false,

            history_status:
                null,

            history_reason:
                "history_not_found",

            history_row_id:
                null,

            history_database_status:
                null,

            history_result_url:
                null,

            history_completed_at:
                null,

            history_update_strategy:
                null,

            history_update_rows:
                0,

            history_retry:
                false,

            history_error:
                null,

            history_error_status:
                null,

            history_error_code:
                null,

            history_error_details:
                null,

            history_error_hint:
                null,

            history_error_data:
                null,

            history_update_payload:
                null
        };
    }


    /*
     * -------------------------------------------------------
     * CANCELLED
     * -------------------------------------------------------
     */

    if (
        lower(
            history.status
        ) ===
            "cancelled"
    ) {

        return {

            history_updated:
                false,

            history_matched:
                true,

            history_status:
                "cancelled",

            history_reason:
                "history_already_cancelled",

            history_row_id:
                history.id,

            history_database_status:
                "cancelled",

            history_result_url:
                history.result_url ||
                null,

            history_completed_at:
                history.completed_at ||
                null,

            history_update_strategy:
                null,

            history_update_rows:
                0,

            history_retry:
                false,

            history_error:
                null,

            history_error_status:
                null,

            history_error_code:
                null,

            history_error_details:
                null,

            history_error_hint:
                null,

            history_error_data:
                null,

            history_update_payload:
                null
        };
    }


    /*
     * -------------------------------------------------------
     * PROCESSING
     * -------------------------------------------------------
     */

    if (
        normalized.processing &&
        !normalized.completed &&
        !normalized.failed
    ) {

        return {

            history_updated:
                false,

            history_matched:
                true,

            history_status:
                history.status ||
                null,

            history_reason:
                "task_still_processing",

            history_row_id:
                history.id,

            history_database_status:
                history.status ||
                null,

            history_result_url:
                history.result_url ||
                null,

            history_completed_at:
                history.completed_at ||
                null,

            history_update_strategy:
                null,

            history_update_rows:
                0,

            history_retry:
                false,

            history_error:
                null,

            history_error_status:
                null,

            history_error_code:
                null,

            history_error_details:
                null,

            history_error_hint:
                null,

            history_error_data:
                null,

            history_update_payload:
                null
        };
    }


    /*
     * -------------------------------------------------------
     * UPDATE
     * -------------------------------------------------------
     */

    let updateResult;


    try {

        updateResult =
            await updateGenerationHistory(
                history,
                normalized
            );

    } catch (
        error
    ) {

        const serialized =
            serializeError(
                error
            );


        return {

            history_updated:
                false,

            history_matched:
                true,

            history_status:
                history.status ||
                null,

            history_reason:
                "history_update_exception",

            history_row_id:
                history.id,

            history_database_status:
                history.status ||
                null,

            history_result_url:
                history.result_url ||
                null,

            history_completed_at:
                history.completed_at ||
                null,

            history_update_strategy:
                null,

            history_update_rows:
                0,

            history_retry:
                true,

            history_error:
                serialized.message,

            history_error_status:
                serialized.status,

            history_error_code:
                serialized.code,

            history_error_details:
                serialized.details,

            history_error_hint:
                serialized.hint,

            history_error_data:
                serialized.data,

            history_update_payload:
                null
        };
    }


    /*
     * -------------------------------------------------------
     * VERIFY
     * -------------------------------------------------------
     */

    let verified;


    try {

        verified =
            await verifyGenerationHistory(
                history
            );

    } catch (
        error
    ) {

        const serialized =
            serializeError(
                error
            );


        return {

            history_updated:
                false,

            history_matched:
                true,

            history_status:
                history.status ||
                null,

            history_reason:
                "history_verify_exception",

            history_row_id:
                history.id,

            history_database_status:
                history.status ||
                null,

            history_result_url:
                history.result_url ||
                null,

            history_completed_at:
                history.completed_at ||
                null,

            history_update_strategy:
                updateResult?.strategy ||
                null,

            history_update_rows:
                Array.isArray(
                    updateResult?.rows
                )
                    ? updateResult.rows.length
                    : 0,

            history_retry:
                false,

            history_error:
                serialized.message,

            history_error_status:
                serialized.status,

            history_error_code:
                serialized.code,

            history_error_details:
                serialized.details,

            history_error_hint:
                serialized.hint,

            history_error_data:
                serialized.data,

            history_update_payload:
                updateResult?.payload ||
                null
        };
    }


    const expectedStatus =
        normalized.completed
            ? "success"
            : normalized.failed
                ? "failed"
                : "processing";


    const actualStatus =
        lower(
            verified?.status
        );


    const historyUpdated =
        actualStatus ===
        lower(
            expectedStatus
        );


    return {

        history_updated:
            historyUpdated,

        history_matched:
            true,

        history_status:
            verified?.status ||
            actualStatus ||
            null,

        history_reason:
            historyUpdated
                ? null
                : "history_status_not_changed_after_patch",

        history_row_id:
            history.id,

        history_database_status:
            verified?.status ||
            null,

        history_result_url:
            verified?.result_url ||
            null,

        history_completed_at:
            verified?.completed_at ||
            null,

        history_retry:
            false,

        history_update_payload:
            updateResult?.payload ||
            null,

        history_update_strategy:
            updateResult?.strategy ||
            null,

        history_update_rows:
            Array.isArray(
                updateResult?.rows
            )
                ? updateResult.rows.length
                : 0,

        history_error:
            null,

        history_error_status:
            null,

        history_error_code:
            null,

        history_error_details:
            null,

        history_error_hint:
            null,

        history_error_data:
            null
    };
}


/* =========================================================
   HISTORY RETRY
========================================================= */

async function syncGenerationHistoryWithRetry(
    userId,
    taskId,
    normalized
) {

    let result =
        await syncGenerationHistory(
            userId,
            taskId,
            normalized
        );


    if (
        (
            normalized.completed ||
            normalized.failed
        ) &&
        !result.history_updated
    ) {

        await new Promise(
            resolve =>
                setTimeout(
                    resolve,
                    150
                )
        );


        const retryResult =
            await syncGenerationHistory(
                userId,
                taskId,
                normalized
            );


        result = {

            ...retryResult,

            history_retry:
                true,

            history_first_attempt:
                result.history_updated
                    ? null
                    : {

                        history_reason:
                            result.history_reason ||
                            null,

                        history_error:
                            result.history_error ||
                            null,

                        history_error_status:
                            result.history_error_status ??
                            null,

                        history_error_code:
                            result.history_error_code ||
                            null,

                        history_error_details:
                            result.history_error_details ||
                            null
                    }
        };

    } else {

        result = {

            ...result,

            history_retry:
                false
        };
    }


    return result;
}


/* =========================================================
   QUERY VIDDRA
========================================================= */

async function queryVidDraTask(
    taskId
) {

    if (
        !VIDDRA_API_KEY
    ) {

        const error =
            new Error(
                "VIDDRA_API_KEY belum dikonfigurasi."
            );

        error.status =
            500;

        error.code =
            "VIDDRA_API_KEY_MISSING";

        throw error;
    }


    const response =
        await fetch(
            `${VIDDRA_API_BASE}/video/generations/${encodeURIComponent(
                taskId
            )}`,
            {
                method:
                    "GET",

                headers: {

                    Authorization:
                        `Bearer ${VIDDRA_API_KEY}`,

                    Accept:
                        "application/json"
                }
            }
        );


    const text =
        await response.text();


    let data =
        null;


    try {

        data =
            text
                ? JSON.parse(
                    text
                )
                : null;

    } catch {

        data =
            text ||
            null;
    }


    if (
        !response.ok
    ) {

        const error =
            new Error(
                data?.message ||
                data?.error ||
                `VidDra mengembalikan HTTP ${response.status}.`
            );

        error.status =
            response.status;

        error.code =
            "VIDDRA_STATUS_REQUEST_FAILED";

        error.data =
            data;

        throw error;
    }


    return data;
}


/* =========================================================
   MAIN HANDLER
========================================================= */

export default async function handler(
    req,
    res
) {

    /*
     * -------------------------------------------------------
     * METHOD
     * -------------------------------------------------------
     */

    if (
        req.method !==
        "POST"
    ) {

        res.setHeader(
            "Allow",
            "POST"
        );


        return json(
            res,
            405,
            {

                success:
                    false,

                error:
                    "Method tidak diizinkan."
            }
        );
    }


    /*
     * -------------------------------------------------------
     * ENVIRONMENT
     * -------------------------------------------------------
     */

    if (
        !SUPABASE_URL ||
        !SUPABASE_SERVICE_ROLE_KEY
    ) {

        return json(
            res,
            500,
            {

                success:
                    false,

                error:
                    "Konfigurasi Supabase server belum lengkap."
            }
        );
    }


    try {

        /*
         * ---------------------------------------------------
         * AUTH
         * ---------------------------------------------------
         */

        const user =
            await authenticateUser(
                req
            );


        /*
         * ---------------------------------------------------
         * BODY
         * ---------------------------------------------------
         */

        const body =
            getRequestBody(
                req
            );


        const taskId =
            cleanString(
                firstDefined(
                    body.task_id,
                    body.taskId,
                    body.id
                )
            );


        const modelId =
            cleanString(
                firstDefined(
                    body.model_id,
                    body.modelId,
                    "hailuo-2.3"
                )
            );


        if (
            !taskId
        ) {

            return json(
                res,
                400,
                {

                    success:
                        false,

                    error:
                        "task_id wajib diisi."
                }
            );
        }


        /*
         * ---------------------------------------------------
         * LOCAL HISTORY
         * ---------------------------------------------------
         */

        const existingHistory =
            await findGenerationHistory(
                user.id,
                taskId
            );


        if (
            !existingHistory
        ) {

            return json(
                res,
                404,
                {

                    success:
                        false,

                    error:
                        "Generation History untuk task ini tidak ditemukan.",

                    task_id:
                        taskId,

                    history_matched:
                        false
                }
            );
        }


        /*
         * ---------------------------------------------------
         * CANCELLATION
         * ---------------------------------------------------
         */

        if (
            lower(
                existingHistory.status
            ) ===
                "cancelled"
        ) {

            return json(
                res,
                200,
                {

                    success:
                        true,

                    user_id:
                        user.id,

                    model_id:
                        modelId,

                    task_id:
                        taskId,

                    taskId:
                        taskId,

                    state:
                        "cancelled",

                    provider_state:
                        "cancelled",

                    processing:
                        false,

                    completed:
                        false,

                    failed:
                        false,

                    has_result:
                        Boolean(
                            existingHistory.result_url
                        ),

                    hasResult:
                        Boolean(
                            existingHistory.result_url
                        ),

                    result_urls:
                        existingHistory.result_url
                            ? [
                                existingHistory.result_url
                            ]
                            : [],

                    resultUrls:
                        existingHistory.result_url
                            ? [
                                existingHistory.result_url
                            ]
                            : [],

                    result:
                        existingHistory.result_url
                            ? {
                                resultUrls: [
                                    existingHistory.result_url
                                ]
                            }
                            : null,

                    history_updated:
                        false,

                    history_matched:
                        true,

                    history_status:
                        "cancelled",

                    history_reason:
                        "generation_cancelled",

                    history_row_id:
                        existingHistory.id,

                    history_database_status:
                        "cancelled",

                    history_result_url:
                        existingHistory.result_url ||
                        null,

                    history_completed_at:
                        existingHistory.completed_at ||
                        null,

                    adapter_found:
                        false,

                    credential_resolved:
                        false,

                    cancellation:
                        true
                }
            );
        }


        /*
         * ---------------------------------------------------
         * QUERY VIDDRA
         * ---------------------------------------------------
         */

        let providerRaw;


        try {

            providerRaw =
                await queryVidDraTask(
                    taskId
                );

        } catch (
            error
        ) {

            console.error(
                "[viddra/status] Provider query failed:",
                serializeError(
                    error
                )
            );


            const serialized =
                serializeError(
                    error
                );


            return json(
                res,
                serialized.status >= 400 &&
                serialized.status < 600
                    ? serialized.status
                    : 502,
                {

                    success:
                        false,

                    error:
                        serialized.message ||
                        "Gagal mengambil status generation VidDra.",

                    model_id:
                        modelId,

                    provider_id:
                        "viddra",

                    provider:
                        "VidDra",

                    task_id:
                        taskId,

                    history_matched:
                        true,

                    credential_resolved:
                        Boolean(
                            VIDDRA_API_KEY
                        )
                }
            );
        }


        /*
         * ---------------------------------------------------
         * NORMALIZE
         * ---------------------------------------------------
         */

        const normalized =
            normalizeVidDraStatus(
                providerRaw,
                taskId
            );


        /*
         * ---------------------------------------------------
         * HISTORY
         * ---------------------------------------------------
         */

        const history =
            await syncGenerationHistoryWithRetry(
                user.id,
                taskId,
                normalized
            );


        /*
         * ---------------------------------------------------
         * RESPONSE
         * ---------------------------------------------------
         */

        return json(
            res,
            200,
            {

                success:
                    true,

                user_id:
                    user.id,

                model_id:
                    modelId,

                model_name:
                    "Hailuo 2.3",

                provider_id:
                    "viddra",

                provider:
                    "VidDra",

                task_id:
                    normalized.task_id ||
                    taskId,

                taskId:
                    normalized.task_id ||
                    taskId,

                /*
                 * Provider status.
                 */

                state:
                    normalized.state,

                provider_state:
                    normalized.provider_state,

                processing:
                    normalized.processing,

                completed:
                    normalized.completed,

                failed:
                    normalized.failed,

                /*
                 * Result.
                 */

                has_result:
                    normalized.result_urls.length >
                    0,

                hasResult:
                    normalized.result_urls.length >
                    0,

                result_urls:
                    normalized.result_urls,

                resultUrls:
                    normalized.result_urls,

                result:
                    normalized.result_urls.length
                        ? {
                            resultUrls:
                                normalized.result_urls
                        }
                        : null,

                /*
                 * History.
                 */

                history_updated:
                    history.history_updated,

                history_matched:
                    history.history_matched,

                history_status:
                    history.history_status,

                history_reason:
                    history.history_reason,

                history_row_id:
                    history.history_row_id,

                history_database_status:
                    history.history_database_status ||
                    null,

                history_result_url:
                    history.history_result_url ||
                    null,

                history_completed_at:
                    history.history_completed_at ||
                    null,

                history_retry:
                    history.history_retry ||
                    false,

                history_update_strategy:
                    history.history_update_strategy ||
                    null,

                history_update_rows:
                    history.history_update_rows ||
                    0,

                history_update_payload:
                    history.history_update_payload ||
                    null,

                /*
                 * Diagnostics.
                 */

                history_error:
                    history.history_error ||
                    null,

                history_error_status:
                    history.history_error_status ??
                    null,

                history_error_code:
                    history.history_error_code ||
                    null,

                history_error_details:
                    history.history_error_details ||
                    null,

                history_error_hint:
                    history.history_error_hint ||
                    null,

                history_error_data:
                    history.history_error_data ??
                    null,

                /*
                 * Provider credential diagnostic.
                 *
                 * API key tidak pernah dikirim ke client.
                 */

                credential_provider_id:
                    "viddra",

                credential_resolved:
                    Boolean(
                        VIDDRA_API_KEY
                    ),

                adapter_found:
                    true
            }
        );

    } catch (
        error
    ) {

        console.error(
            "[viddra/status]",
            serializeError(
                error
            )
        );


        const serialized =
            serializeError(
                error
            );


        return json(
            res,
            serialized.status >= 400 &&
            serialized.status < 600
                ? serialized.status
                : 500,
            {

                success:
                    false,

                error:
                    serialized.message ||
                    "Gagal memproses status generation VidDra.",

                details:
                    serialized.data ||
                    null,

                error_code:
                    serialized.code ||
                    null,

                error_details:
                    serialized.details ||
                    null,

                error_hint:
                    serialized.hint ||
                    null
            }
        );
    }
}
