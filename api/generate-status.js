/* =========================================================
   GEN-Z.AI
   GENERATE STATUS API
   ---------------------------------------------------------
   File:
   api/generate-status.js

   Tanggung jawab:
   - Auth user
   - Resolve model/provider
   - Query task ke provider adapter
   - Normalize task status
   - Sinkronisasi generation_history
   - Return hasil status generation

   PATCH INI:
   - Tetap menggunakan service-role Supabase
   - Cari history berdasarkan user_id + task_id
   - Update history berdasarkan PRIMARY KEY id
   - Verifikasi ulang langsung dari database
   - Retry update bila database belum berubah
   - Tidak mengubah alur KIE/provider
   ========================================================= */

import crypto from "crypto";
import { grokImagineImageToVideo } from "../models/grok-imagine-image-to-video/index.js";

/* =========================================================
   MODEL REGISTRY
   ========================================================= */

const MODEL_REGISTRY = [
    grokImagineImageToVideo
];

/* =========================================================
   STATUS SETS
   ========================================================= */

const COMPLETED_STATES = new Set([
    "success",
    "successful",
    "succeeded",
    "completed",
    "complete",
    "done",
    "finished",
    "finish",
    "successfully_completed",
    "successfully-completed"
]);

const FAILED_STATES = new Set([
    "fail",
    "failed",
    "failure",
    "error",
    "cancelled",
    "canceled",
    "rejected",
    "terminated",
    "aborted"
]);

const PROCESSING_STATES = new Set([
    "processing",
    "running",
    "generating",
    "in_progress",
    "in-progress",
    "pending",
    "queued",
    "queue",
    "waiting",
    "created",
    "submitted",
    "starting",
    "started"
]);

/* =========================================================
   ENV
   ========================================================= */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

const PROVIDER_CREDENTIAL_ENCRYPTION_KEY =
    process.env.PROVIDER_CREDENTIAL_ENCRYPTION_KEY;

/* =========================================================
   BASIC HELPERS
   ========================================================= */

function normalizeString(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value).trim();
}

function normalizeState(value) {
    return normalizeString(value)
        .toLowerCase()
        .replace(/\s+/g, "_");
}

function encodeQueryValue(value) {
    return encodeURIComponent(String(value));
}

function safeJsonParse(value) {
    if (typeof value !== "string") {
        return value;
    }

    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
}

function isObject(value) {
    return value !== null && typeof value === "object";
}

/* =========================================================
   SUPABASE REQUEST
   ========================================================= */

async function supabaseRequest(path, options = {}) {
    if (!SUPABASE_URL) {
        throw new Error("SUPABASE_URL belum dikonfigurasi.");
    }

    if (!SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error(
            "SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi."
        );
    }

    const response = await fetch(
        `${SUPABASE_URL}${path}`,
        {
            ...options,
            headers: {
                apikey: SUPABASE_SERVICE_ROLE_KEY,
                Authorization:
                    `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                "Content-Type": "application/json",
                ...(options.headers || {})
            }
        }
    );

    const rawText = await response.text();

    let data = null;

    if (rawText) {
        try {
            data = JSON.parse(rawText);
        } catch {
            data = rawText;
        }
    }

    if (!response.ok) {
        const errorMessage =
            typeof data === "string"
                ? data
                : data?.message ||
                  data?.error_description ||
                  data?.error ||
                  `Supabase request gagal (${response.status}).`;

        const error = new Error(errorMessage);

        error.status = response.status;
        error.data = data;

        throw error;
    }

    return {
        status: response.status,
        data
    };
}

/* =========================================================
   AUTH
   ========================================================= */

async function getAuthenticatedUser(accessToken) {
    if (!accessToken) {
        throw new Error("Access token tidak ditemukan.");
    }

    const result = await supabaseRequest(
        "/auth/v1/user",
        {
            method: "GET",
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        }
    );

    return result.data;
}

/* =========================================================
   MODEL
   ========================================================= */

async function loadModel(modelId) {
    const encodedModelId =
        encodeQueryValue(modelId);

    const result = await supabaseRequest(
        `/rest/v1/models?select=*&model_id=eq.${encodedModelId}&limit=1`,
        {
            method: "GET"
        }
    );

    const rows = Array.isArray(result.data)
        ? result.data
        : [];

    return rows[0] || null;
}

/* =========================================================
   PROVIDER RESOLUTION
   ========================================================= */

function resolveProviderId(model, adapter) {
    return normalizeString(
        model?.provider_id ||
        adapter?.providerId ||
        adapter?.provider_id
    );
}

/* =========================================================
   CREDENTIAL DECRYPTION
   ========================================================= */

function deriveEncryptionKey(secret) {
    if (!secret) {
        throw new Error(
            "PROVIDER_CREDENTIAL_ENCRYPTION_KEY belum dikonfigurasi."
        );
    }

    return crypto
        .createHash("sha256")
        .update(secret)
        .digest();
}

function decryptCredential(encryptedValue) {
    if (!encryptedValue) {
        throw new Error(
            "Credential provider tidak ditemukan."
        );
    }

    /*
     * Format yang didukung:
     *
     * iv:authTag:ciphertext
     *
     * atau
     *
     * {
     *   iv,
     *   authTag,
     *   ciphertext
     * }
     */

    const key =
        deriveEncryptionKey(
            PROVIDER_CREDENTIAL_ENCRYPTION_KEY
        );

    let iv;
    let authTag;
    let ciphertext;

    const parsed =
        safeJsonParse(encryptedValue);

    if (
        isObject(parsed) &&
        parsed.iv &&
        parsed.authTag &&
        parsed.ciphertext
    ) {
        iv = Buffer.from(parsed.iv, "base64");
        authTag = Buffer.from(
            parsed.authTag,
            "base64"
        );
        ciphertext = Buffer.from(
            parsed.ciphertext,
            "base64"
        );
    } else {
        const parts =
            String(encryptedValue).split(":");

        if (parts.length !== 3) {
            throw new Error(
                "Format credential terenkripsi tidak valid."
            );
        }

        iv = Buffer.from(parts[0], "base64");
        authTag = Buffer.from(parts[1], "base64");
        ciphertext = Buffer.from(
            parts[2],
            "base64"
        );
    }

    const decipher =
        crypto.createDecipheriv(
            "aes-256-gcm",
            key,
            iv
        );

    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final()
    ]);

    return decrypted.toString("utf8");
}

/* =========================================================
   PROVIDER CREDENTIAL
   ========================================================= */

async function loadProviderCredential(providerId) {
    const encodedProviderId =
        encodeQueryValue(providerId);

    const result = await supabaseRequest(
        `/rest/v1/provider_credentials?select=*&provider_id=eq.${encodedProviderId}&limit=1`,
        {
            method: "GET"
        }
    );

    const rows = Array.isArray(result.data)
        ? result.data
        : [];

    const row = rows[0];

    if (!row) {
        throw new Error(
            `Credential provider "${providerId}" tidak ditemukan.`
        );
    }

    const encrypted =
        row.encrypted_api_key ||
        row.encrypted_credential ||
        row.credential_encrypted ||
        row.api_key_encrypted ||
        row.encrypted_value;

    if (!encrypted) {
        throw new Error(
            `Credential provider "${providerId}" tidak memiliki data terenkripsi.`
        );
    }

    return decryptCredential(encrypted);
}

/* =========================================================
   ADAPTER
   ========================================================= */

function findAdapter(modelId) {
    const normalized =
        normalizeString(modelId);

    return MODEL_REGISTRY.find(
        adapter => {
            const candidates = [
                adapter?.modelId,
                adapter?.model_id,
                adapter?.id,
                ...(Array.isArray(adapter?.modelIds)
                    ? adapter.modelIds
                    : []),
                ...(Array.isArray(adapter?.model_ids)
                    ? adapter.model_ids
                    : [])
            ];

            return candidates.some(
                value =>
                    normalizeString(value) ===
                    normalized
            );
        }
    );
}

/* =========================================================
   RECURSIVE OBJECT COLLECTION
   ========================================================= */

function collectObjects(value, output = []) {
    if (!value) {
        return output;
    }

    if (Array.isArray(value)) {
        for (const item of value) {
            collectObjects(item, output);
        }

        return output;
    }

    if (!isObject(value)) {
        return output;
    }

    output.push(value);

    for (const key of Object.keys(value)) {
        const child = value[key];

        if (
            isObject(child) ||
            Array.isArray(child)
        ) {
            collectObjects(child, output);
        }
    }

    return output;
}

/* =========================================================
   RESULT URL EXTRACTION
   ========================================================= */

function extractResultUrls(value) {
    const urls = [];

    function visit(node) {
        if (!node) {
            return;
        }

        if (typeof node === "string") {
            if (
                /^https?:\/\//i.test(node) &&
                /\.(mp4|mov|webm|png|jpg|jpeg|webp|gif)(\?|$)/i.test(
                    node
                )
            ) {
                urls.push(node);
            }

            return;
        }

        if (Array.isArray(node)) {
            for (const item of node) {
                visit(item);
            }

            return;
        }

        if (!isObject(node)) {
            return;
        }

        for (const [key, child] of Object.entries(node)) {
            const lower =
                key.toLowerCase();

            if (
                lower.includes("url") ||
                lower.includes("video") ||
                lower.includes("result") ||
                lower.includes("output")
            ) {
                visit(child);
            }

            if (
                isObject(child) ||
                Array.isArray(child)
            ) {
                visit(child);
            }
        }
    }

    visit(value);

    return [
        ...new Set(
            urls.filter(Boolean)
        )
    ];
}

/* =========================================================
   TASK NORMALIZER
   ========================================================= */

function normalizeTaskResponse(taskResponse, taskId) {
    const objects =
        collectObjects(taskResponse);

    let state = "";

    for (const object of objects) {
        const candidates = [
            object.state,
            object.status,
            object.task_status,
            object.taskState,
            object.task_status_name
        ];

        for (const candidate of candidates) {
            if (candidate) {
                state =
                    normalizeState(candidate);

                if (state) {
                    break;
                }
            }
        }

        if (state) {
            break;
        }
    }

    let resultUrls =
        extractResultUrls(taskResponse);

    const taskIdCandidates = [];

    for (const object of objects) {
        taskIdCandidates.push(
            object.taskId,
            object.task_id,
            object.id,
            object.taskID
        );
    }

    const resolvedTaskId =
        taskIdCandidates.find(Boolean) ||
        taskId;

    let explicitCompleted = false;
    let explicitFailed = false;
    let explicitProcessing = false;

    for (const object of objects) {
        if (object.completed === true) {
            explicitCompleted = true;
        }

        if (object.failed === true) {
            explicitFailed = true;
        }

        if (object.processing === true) {
            explicitProcessing = true;
        }

        if (object.success === true) {
            explicitCompleted = true;
        }

        if (object.success === false) {
            if (
                state &&
                FAILED_STATES.has(state)
            ) {
                explicitFailed = true;
            }
        }
    }

    const completed =
        explicitCompleted ||
        COMPLETED_STATES.has(state) ||
        resultUrls.length > 0;

    const failed =
        !completed &&
        (
            explicitFailed ||
            FAILED_STATES.has(state)
        );

    const processing =
        !completed &&
        !failed &&
        (
            explicitProcessing ||
            PROCESSING_STATES.has(state) ||
            !state
        );

    return {
        taskId: resolvedTaskId,
        state,
        completed,
        failed,
        processing,
        hasResult:
            resultUrls.length > 0,
        resultUrls,
        result:
            taskResponse
    };
}

/* =========================================================
   QUERY TASK
   ========================================================= */

async function queryProviderTask(
    adapter,
    taskId,
    providerApiKey
) {
    if (
        !adapter ||
        typeof adapter.queryTask !== "function"
    ) {
        throw new Error(
            "Adapter model tidak memiliki queryTask()."
        );
    }

    return adapter.queryTask(
        taskId,
        providerApiKey
    );
}

/* =========================================================
   GENERATION HISTORY
   ========================================================= */

async function findGenerationHistory(
    userId,
    taskId
) {
    const encodedUserId =
        encodeQueryValue(userId);

    const encodedTaskId =
        encodeQueryValue(taskId);

    const path =
        `/rest/v1/generation_history` +
        `?select=id,user_id,task_id,status,result_url,error_message,completed_at` +
        `&user_id=eq.${encodedUserId}` +
        `&task_id=eq.${encodedTaskId}` +
        `&limit=1`;

    const result =
        await supabaseRequest(
            path,
            {
                method: "GET"
            }
        );

    const rows =
        Array.isArray(result.data)
            ? result.data
            : [];

    return rows[0] || null;
}

/* =========================================================
   FIND HISTORY DIRECTLY BY PRIMARY KEY
   ========================================================= */

async function findGenerationHistoryById(
    rowId
) {
    const encodedId =
        encodeQueryValue(rowId);

    const result =
        await supabaseRequest(
            `/rest/v1/generation_history?select=id,user_id,task_id,status,result_url,error_message,completed_at&id=eq.${encodedId}&limit=1`,
            {
                method: "GET"
            }
        );

    const rows =
        Array.isArray(result.data)
            ? result.data
            : [];

    return rows[0] || null;
}

/* =========================================================
   PATCH HISTORY BY PRIMARY KEY
   ========================================================= */

async function patchGenerationHistoryRow(
    rowId,
    payload
) {
    const encodedId =
        encodeQueryValue(rowId);

    return supabaseRequest(
        `/rest/v1/generation_history?id=eq.${encodedId}`,
        {
            method: "PATCH",

            headers: {
                /*
                 * Jangan hanya mengandalkan response
                 * kosong/non-kosong.
                 *
                 * return=representation membuat PostgREST
                 * mengembalikan row hasil PATCH.
                 */
                Prefer: "return=representation"
            },

            body: JSON.stringify(payload)
        }
    );
}

/* =========================================================
   VERIFY HISTORY
   ========================================================= */

async function verifyHistoryTerminalState(
    rowId,
    expectedStatus
) {
    const row =
        await findGenerationHistoryById(
            rowId
        );

    if (!row) {
        return {
            exists: false,
            matched: false,
            row: null,
            status: null
        };
    }

    return {
        exists: true,
        matched:
            normalizeString(row.status)
                .toLowerCase() ===
            normalizeString(expectedStatus)
                .toLowerCase(),

        row,
        status:
            normalizeString(row.status)
                .toLowerCase()
    };
}

/* =========================================================
   UPDATE HISTORY
   ========================================================= */

async function updateGenerationHistory({
    userId,
    taskId,
    normalizedTask
}) {
    /*
     * TASK MASIH BERJALAN
     */
    if (
        normalizedTask.processing &&
        !normalizedTask.completed &&
        !normalizedTask.failed
    ) {
        return {
            updated: false,
            status: "processing",
            reason: "task_still_processing",
            matched: false,
            rowId: null,
            databaseStatus: null
        };
    }

    let historyRow;

    try {
        historyRow =
            await findGenerationHistory(
                userId,
                taskId
            );
    } catch (error) {
        return {
            updated: false,
            status: null,
            reason: "history_lookup_exception",
            matched: false,
            rowId: null,
            databaseStatus: null,
            error: error.message
        };
    }

    if (!historyRow) {
        return {
            updated: false,
            status: normalizedTask.completed
                ? "completed"
                : "failed",

            reason:
                "generation_history_row_not_found",

            matched: false,
            rowId: null,
            databaseStatus: null
        };
    }

    const rowId =
        historyRow.id;

    const currentStatus =
        normalizeString(
            historyRow.status
        ).toLowerCase();

    /*
     * =====================================================
     * COMPLETED
     * =====================================================
     */

    if (normalizedTask.completed) {
        /*
         * Jika sudah completed, tidak perlu PATCH lagi.
         */
        if (currentStatus === "completed") {
            return {
                updated: true,
                status: "completed",
                reason: "history_already_completed",
                matched: true,
                rowId,
                databaseStatus: currentStatus
            };
        }

        const resultUrl =
            normalizedTask.resultUrls?.[0] ||
            null;

        const payload = {
            status: "completed",
            result_url: resultUrl,
            error_message: null,
            completed_at:
                new Date().toISOString()
        };

        let patchResult;

        try {
            patchResult =
                await patchGenerationHistoryRow(
                    rowId,
                    payload
                );
        } catch (error) {
            /*
             * Jangan langsung menyerah.
             *
             * Bisa saja DB sudah berubah tetapi response
             * PATCH gagal/tidak terbaca.
             */
            const verifiedAfterError =
                await verifyHistoryTerminalState(
                    rowId,
                    "completed"
                ).catch(
                    () => null
                );

            if (
                verifiedAfterError?.matched
            ) {
                return {
                    updated: true,
                    status: "completed",
                    reason:
                        "history_updated_verified_after_patch_error",
                    matched: true,
                    rowId,
                    databaseStatus:
                        verifiedAfterError.status
                };
            }

            return {
                updated: false,
                status: "completed",
                reason:
                    "history_update_exception",
                matched: true,
                rowId,
                databaseStatus:
                    verifiedAfterError?.status ||
                    currentStatus,
                error: error.message,
                errorStatus:
                    error.status || null,
                errorData:
                    error.data || null
            };
        }

        /*
         * Verifikasi langsung ke DB.
         */
        let verified =
            await verifyHistoryTerminalState(
                rowId,
                "completed"
            );

        if (verified.matched) {
            return {
                updated: true,
                status: "completed",
                reason:
                    "history_updated_and_verified",
                matched: true,
                rowId,
                databaseStatus:
                    verified.status,
                patchResponse:
                    patchResult?.data || null
            };
        }

        /*
         * =================================================
         * RETRY
         * =================================================
         *
         * Jika PATCH pertama tidak mengubah row,
         * ulangi sekali.
         */
        try {
            await patchGenerationHistoryRow(
                rowId,
                payload
            );
        } catch (error) {
            const verifiedAfterRetryError =
                await verifyHistoryTerminalState(
                    rowId,
                    "completed"
                ).catch(
                    () => null
                );

            if (
                verifiedAfterRetryError?.matched
            ) {
                return {
                    updated: true,
                    status: "completed",
                    reason:
                        "history_updated_on_retry",
                    matched: true,
                    rowId,
                    databaseStatus:
                        verifiedAfterRetryError.status
                };
            }

            return {
                updated: false,
                status: "completed",
                reason:
                    "history_retry_exception",
                matched: true,
                rowId,
                databaseStatus:
                    verifiedAfterRetryError?.status ||
                    verified.status ||
                    currentStatus,
                error: error.message,
                errorStatus:
                    error.status || null,
                errorData:
                    error.data || null
            };
        }

        /*
         * Verifikasi kedua.
         */
        verified =
            await verifyHistoryTerminalState(
                rowId,
                "completed"
            );

        if (verified.matched) {
            return {
                updated: true,
                status: "completed",
                reason:
                    "history_updated_on_retry",
                matched: true,
                rowId,
                databaseStatus:
                    verified.status
            };
        }

        /*
         * PATCH sudah dipanggil tetapi DB tetap
         * tidak berubah.
         */
        return {
            updated: false,
            status: "completed",
            reason:
                verified.exists
                    ? "history_status_not_changed_after_patch"
                    : "history_row_missing_after_patch",

            matched: true,
            rowId,

            databaseStatus:
                verified.status || null,

            databaseRow:
                verified.row || null
        };
    }

    /*
     * =====================================================
     * FAILED
     * =====================================================
     */

    if (normalizedTask.failed) {
        if (currentStatus === "failed") {
            return {
                updated: true,
                status: "failed",
                reason:
                    "history_already_failed",
                matched: true,
                rowId,
                databaseStatus: currentStatus
            };
        }

        const payload = {
            status: "failed",
            result_url: null,
            error_message:
                "Provider generation gagal.",
            completed_at:
                new Date().toISOString()
        };

        try {
            await patchGenerationHistoryRow(
                rowId,
                payload
            );
        } catch (error) {
            const verifiedAfterError =
                await verifyHistoryTerminalState(
                    rowId,
                    "failed"
                ).catch(
                    () => null
                );

            if (
                verifiedAfterError?.matched
            ) {
                return {
                    updated: true,
                    status: "failed",
                    reason:
                        "history_failed_verified_after_patch_error",
                    matched: true,
                    rowId,
                    databaseStatus:
                        verifiedAfterError.status
                };
            }

            return {
                updated: false,
                status: "failed",
                reason:
                    "history_update_exception",
                matched: true,
                rowId,
                databaseStatus:
                    verifiedAfterError?.status ||
                    currentStatus,
                error: error.message,
                errorStatus:
                    error.status || null,
                errorData:
                    error.data || null
            };
        }

        let verified =
            await verifyHistoryTerminalState(
                rowId,
                "failed"
            );

        if (verified.matched) {
            return {
                updated: true,
                status: "failed",
                reason:
                    "history_updated_and_verified",
                matched: true,
                rowId,
                databaseStatus:
                    verified.status
            };
        }

        /*
         * Retry.
         */
        try {
            await patchGenerationHistoryRow(
                rowId,
                payload
            );
        } catch (error) {
            const verifiedAfterRetryError =
                await verifyHistoryTerminalState(
                    rowId,
                    "failed"
                ).catch(
                    () => null
                );

            if (
                verifiedAfterRetryError?.matched
            ) {
                return {
                    updated: true,
                    status: "failed",
                    reason:
                        "history_failed_on_retry",
                    matched: true,
                    rowId,
                    databaseStatus:
                        verifiedAfterRetryError.status
                };
            }

            return {
                updated: false,
                status: "failed",
                reason:
                    "history_retry_exception",
                matched: true,
                rowId,
                databaseStatus:
                    verifiedAfterRetryError?.status ||
                    verified.status ||
                    currentStatus,
                error: error.message,
                errorStatus:
                    error.status || null,
                errorData:
                    error.data || null
            };
        }

        verified =
            await verifyHistoryTerminalState(
                rowId,
                "failed"
            );

        if (verified.matched) {
            return {
                updated: true,
                status: "failed",
                reason:
                    "history_updated_on_retry",
                matched: true,
                rowId,
                databaseStatus:
                    verified.status
            };
        }

        return {
            updated: false,
            status: "failed",
            reason:
                verified.exists
                    ? "history_status_not_changed_after_patch"
                    : "history_row_missing_after_patch",

            matched: true,
            rowId,

            databaseStatus:
                verified.status || null,

            databaseRow:
                verified.row || null
        };
    }

    /*
     * Tidak completed dan tidak failed.
     */
    return {
        updated: false,
        status: "processing",
        reason: "task_state_not_terminal",
        matched: true,
        rowId,
        databaseStatus: currentStatus
    };
}

/* =========================================================
   REQUEST BODY
   ========================================================= */

async function readRequestBody(req) {
    if (req.body) {
        if (typeof req.body === "string") {
            return safeJsonParse(req.body);
        }

        return req.body;
    }

    return {};
}

/* =========================================================
   MAIN HANDLER
   ========================================================= */

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({
            success: false,
            error: "Method not allowed."
        });
    }

    try {
        const body =
            await readRequestBody(req);

        const taskId =
            normalizeString(
                body.task_id ||
                body.taskId
            );

        const modelId =
            normalizeString(
                body.model_id ||
                body.modelId
            );

        const accessToken =
            normalizeString(
                body.access_token ||
                body.accessToken ||
                req.headers?.authorization
                    ?.replace(/^Bearer\s+/i, "")
            );

        if (!taskId) {
            return res.status(400).json({
                success: false,
                error:
                    "task_id wajib dikirim."
            });
        }

        if (!modelId) {
            return res.status(400).json({
                success: false,
                error:
                    "model_id wajib dikirim."
            });
        }

        /*
         * =================================================
         * AUTH
         * =================================================
         */

        const user =
            await getAuthenticatedUser(
                accessToken
            );

        const userId =
            normalizeString(user?.id);

        if (!userId) {
            throw new Error(
                "User ID tidak ditemukan."
            );
        }

        /*
         * =================================================
         * MODEL
         * =================================================
         */

        const model =
            await loadModel(modelId);

        if (!model) {
            return res.status(404).json({
                success: false,
                error:
                    `Model "${modelId}" tidak ditemukan.`
            });
        }

        /*
         * =================================================
         * ADAPTER
         * =================================================
         */

        const adapter =
            findAdapter(modelId);

        if (!adapter) {
            return res.status(404).json({
                success: false,
                error:
                    `Adapter untuk model "${modelId}" tidak ditemukan.`
            });
        }

        /*
         * =================================================
         * PROVIDER
         * =================================================
         */

        const providerId =
            resolveProviderId(
                model,
                adapter
            );

        if (!providerId) {
            throw new Error(
                "Provider model tidak ditemukan."
            );
        }

        /*
         * =================================================
         * CREDENTIAL
         * =================================================
         */

        const providerApiKey =
            await loadProviderCredential(
                providerId
            );

        /*
         * =================================================
         * QUERY KIE
         * =================================================
         */

        const providerResponse =
            await queryProviderTask(
                adapter,
                taskId,
                providerApiKey
            );

        /*
         * =================================================
         * NORMALIZE
         * =================================================
         */

        const normalizedTask =
            normalizeTaskResponse(
                providerResponse,
                taskId
            );

        /*
         * =================================================
         * HISTORY SYNC
         * =================================================
         */

        const history =
            await updateGenerationHistory({
                userId,
                taskId,
                normalizedTask
            });

        /*
         * =================================================
         * RESPONSE
         * =================================================
         */

        const resultUrls =
            normalizedTask.resultUrls || [];

        const result =
            normalizedTask.result || null;

        return res.status(200).json({
            success: true,

            user_id: userId,

            model_id: modelId,
            model_name:
                model.model_name ||
                model.name ||
                null,

            provider_id: providerId,
            provider:
                model.provider_name ||
                model.provider ||
                null,

            task_id: taskId,
            taskId: taskId,

            state:
                normalizedTask.completed
                    ? "completed"
                    : normalizedTask.failed
                        ? "failed"
                        : normalizedTask.state,

            provider_state:
                normalizedTask.state,

            processing:
                normalizedTask.processing,

            completed:
                normalizedTask.completed,

            failed:
                normalizedTask.failed,

            has_result:
                normalizedTask.hasResult,

            hasResult:
                normalizedTask.hasResult,

            result_urls:
                resultUrls,

            resultUrls:
                resultUrls,

            result,

            /*
             * HISTORY DIAGNOSTICS
             */
            history_updated:
                history.updated,

            history_status:
                history.status,

            history_reason:
                history.reason,

            history_matched:
                history.matched,

            history_row_id:
                history.rowId,

            history_database_status:
                history.databaseStatus,

            /*
             * Error diagnostics hanya muncul
             * bila memang ada.
             */
            ...(history.error
                ? {
                    history_error:
                        history.error
                }
                : {}),

            ...(history.errorStatus
                ? {
                    history_error_status:
                        history.errorStatus
                }
                : {}),

            ...(history.errorData
                ? {
                    history_error_data:
                        history.errorData
                }
                : {}),

            ...(history.databaseRow
                ? {
                    history_database_row:
                        history.databaseRow
                }
                : {}),

            modelId
        });

    } catch (error) {
        console.error(
            "[generate-status] error:",
            error
        );

        return res.status(
            error?.status >= 400 &&
            error?.status < 600
                ? error.status
                : 500
        ).json({
            success: false,

            error:
                error?.message ||
                "Gagal mengambil status generation.",

            details:
                error?.data || null
        });
    }
}
