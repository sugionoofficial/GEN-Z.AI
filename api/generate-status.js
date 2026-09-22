/**
 * =========================================================
 * GEN-Z.AI
 * GENERATE STATUS API
 * ---------------------------------------------------------
 * File:
 *   api/generate-status.js
 *
 * Tanggung jawab:
 * - Authenticate user
 * - Validasi model_id
 * - Validasi task_id
 * - Resolve model
 * - Resolve provider
 * - Load provider credential
 * - Query adapter task
 * - Normalize task status
 * - Synchronize generation_history
 *
 * Tidak bertanggung jawab:
 * - Create task
 * - Browser polling
 * - Render UI
 * - Credit
 * - API key management
 * - Generation parameter
 * =========================================================
 */

import crypto from "crypto";

import grokImagineImageToVideo
    from "../models/grok-imagine-image-to-video/index.js";


/* =========================================================
   ENVIRONMENT
========================================================= */

const SUPABASE_URL =
    String(
        process.env.SUPABASE_URL || ""
    )
        .trim()
        .replace(
            /\/+$/,
            ""
        );

const SUPABASE_SERVICE_ROLE_KEY =
    String(
        process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    ).trim();

const PROVIDER_CREDENTIAL_ENCRYPTION_KEY =
    String(
        process.env.PROVIDER_CREDENTIAL_ENCRYPTION_KEY || ""
    ).trim();


/* =========================================================
   MODEL REGISTRY
========================================================= */

const MODEL_REGISTRY = Object.freeze([
    grokImagineImageToVideo
]);


/* =========================================================
   STATUS SETS
========================================================= */

const COMPLETED_STATES =
    new Set([
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

const FAILED_STATES =
    new Set([
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

const PROCESSING_STATES =
    new Set([
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
   JSON RESPONSE
========================================================= */

function json(
    res,
    statusCode,
    data
) {

    res.statusCode =
        statusCode;

    res.setHeader(
        "Content-Type",
        "application/json; charset=utf-8"
    );

    res.setHeader(
        "Cache-Control",
        "no-store, no-cache, must-revalidate"
    );

    return res.end(
        JSON.stringify(
            data
        )
    );

}


function success(
    res,
    data = {}
) {

    return json(
        res,
        200,
        {
            success: true,
            ...data
        }
    );

}


function failure(
    res,
    statusCode,
    message,
    extra = {}
) {

    return json(
        res,
        statusCode,
        {
            success: false,
            error: message,
            ...extra
        }
    );

}


/* =========================================================
   STRING
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
   STATE
========================================================= */

function normalizeState(
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
   SUPABASE REQUEST
========================================================= */

async function supabaseRequest(
    path,
    options = {}
) {

    if (!SUPABASE_URL) {

        throw new Error(
            "SUPABASE_URL is not configured"
        );

    }

    if (!SUPABASE_SERVICE_ROLE_KEY) {

        throw new Error(
            "SUPABASE_SERVICE_ROLE_KEY is not configured"
        );

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

                    ...(options.headers || {})

                }

            }
        );

    const text =
        await response.text();

    let data =
        null;

    if (text) {

        try {

            data =
                JSON.parse(
                    text
                );

        } catch {

            data =
                text;

        }

    }

    if (!response.ok) {

        let message =
            `Supabase request failed with status ${response.status}`;

        if (
            data &&
            typeof data === "object"
        ) {

            message =
                data.message ||
                data.error_description ||
                data.error ||
                message;

        }

        const error =
            new Error(
                message
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
   AUTHENTICATE USER
========================================================= */

async function authenticateUser(
    req
) {

    const authorization =
        String(
            req.headers?.authorization ||
            req.headers?.Authorization ||
            ""
        ).trim();

    if (!authorization) {

        throw Object.assign(
            new Error(
                "Authorization header is required"
            ),
            {
                status: 401
            }
        );

    }

    const match =
        authorization.match(
            /^Bearer\s+(.+)$/i
        );

    if (!match) {

        throw Object.assign(
            new Error(
                "Invalid Authorization header"
            ),
            {
                status: 401
            }
        );

    }

    const accessToken =
        match[1].trim();

    if (!accessToken) {

        throw Object.assign(
            new Error(
                "Access token is missing"
            ),
            {
                status: 401
            }
        );

    }

    const user =
        await supabaseRequest(
            "/auth/v1/user",
            {

                method:
                    "GET",

                headers: {

                    Authorization:
                        `Bearer ${accessToken}`,

                    apikey:
                        SUPABASE_SERVICE_ROLE_KEY

                }

            }
        );

    if (
        !user ||
        !user.id
    ) {

        throw Object.assign(
            new Error(
                "Invalid or expired session"
            ),
            {
                status: 401
            }
        );

    }

    return user;

}


/* =========================================================
   READ BODY
========================================================= */

async function readBody(
    req
) {

    if (
        req.body &&
        typeof req.body === "object"
    ) {

        return req.body;

    }

    let body =
        "";

    for await (
        const chunk
        of req
    ) {

        body += chunk;

    }

    if (
        !body.trim()
    ) {

        return {};

    }

    try {

        return JSON.parse(
            body
        );

    } catch {

        throw Object.assign(
            new Error(
                "Request body must be valid JSON"
            ),
            {
                status: 400
            }
        );

    }

}


/* =========================================================
   GET MODEL ID
========================================================= */

function getModelId(
    body
) {

    return normalizeString(

        body?.model_id ||

        body?.modelId ||

        body?.model ||

        ""

    );

}


/* =========================================================
   GET TASK ID
========================================================= */

function getTaskId(
    body
) {

    return normalizeString(

        body?.task_id ||

        body?.taskId ||

        body?.jobId ||

        body?.job_id ||

        ""

    );

}


/* =========================================================
   MODEL ADAPTER
========================================================= */

function getModelAdapter(
    modelId
) {

    const normalizedId =
        normalizeString(
            modelId
        );

    if (!normalizedId) {

        return null;

    }

    return (
        MODEL_REGISTRY.find(
            adapter =>
                normalizeString(
                    adapter?.config?.id
                ) ===
                normalizedId
        ) ||
        null
    );

}


/* =========================================================
   DATABASE MODEL
========================================================= */

async function loadDatabaseModel(
    modelId
) {

    if (
        !modelId ||
        !SUPABASE_URL ||
        !SUPABASE_SERVICE_ROLE_KEY
    ) {

        return null;

    }

    const params =
        new URLSearchParams();

    params.set(
        "select",
        "*"
    );

    params.set(
        "model_id",
        `eq.${modelId}`
    );

    params.set(
        "limit",
        "1"
    );

    try {

        const rows =
            await supabaseRequest(
                `/rest/v1/models?${params.toString()}`,
                {
                    method:
                        "GET"
                }
            );

        return (
            Array.isArray(rows) &&
            rows.length
                ? rows[0]
                : null
        );

    } catch (error) {

        console.warn(
            "[generate-status] Optional model lookup failed:",
            error?.message ||
            error
        );

        return null;

    }

}


/* =========================================================
   PROVIDER BY DATABASE ID
========================================================= */

async function loadProviderByDatabaseId(
    providerDatabaseId
) {

    if (!providerDatabaseId) {

        return null;

    }

    const params =
        new URLSearchParams();

    params.set(
        "select",
        "*"
    );

    params.set(
        "id",
        `eq.${providerDatabaseId}`
    );

    params.set(
        "limit",
        "1"
    );

    const providers =
        await supabaseRequest(
            `/rest/v1/providers?${params.toString()}`,
            {
                method:
                    "GET"
            }
        );

    return (
        Array.isArray(providers) &&
        providers.length
            ? providers[0]
            : null
    );

}


/* =========================================================
   PROVIDER BY CODE
========================================================= */

async function loadProviderByCode(
    providerCode
) {

    const normalizedCode =
        normalizeString(
            providerCode
        );

    if (!normalizedCode) {

        return null;

    }

    const params =
        new URLSearchParams();

    params.set(
        "select",
        "*"
    );

    params.set(
        "provider_id",
        `eq.${normalizedCode}`
    );

    params.set(
        "limit",
        "1"
    );

    const providers =
        await supabaseRequest(
            `/rest/v1/providers?${params.toString()}`,
            {
                method:
                    "GET"
            }
        );

    if (
        Array.isArray(providers) &&
        providers.length
    ) {

        return providers[0];

    }

    const nameParams =
        new URLSearchParams();

    nameParams.set(
        "select",
        "*"
    );

    nameParams.set(
        "provider_name",
        `eq.${normalizedCode}`
    );

    nameParams.set(
        "limit",
        "1"
    );

    const namedProviders =
        await supabaseRequest(
            `/rest/v1/providers?${nameParams.toString()}`,
            {
                method:
                    "GET"
            }
        );

    return (
        Array.isArray(namedProviders) &&
        namedProviders.length
            ? namedProviders[0]
            : null
    );

}


/* =========================================================
   RESOLVE PROVIDER
========================================================= */

async function resolveProvider(
    adapter,
    databaseModel
) {

    const databaseProviderId =
        normalizeString(
            databaseModel?.provider_id
        );

    if (
        databaseProviderId
    ) {

        const provider =
            await loadProviderByDatabaseId(
                databaseProviderId
            );

        if (provider) {

            return provider;

        }

    }

    const registryProviderId =
        normalizeString(
            adapter?.config?.providerId
        );

    if (
        registryProviderId
    ) {

        return loadProviderByCode(
            registryProviderId
        );

    }

    return null;

}


/* =========================================================
   ENCRYPTION KEY
========================================================= */

function getEncryptionKey() {

    if (
        !PROVIDER_CREDENTIAL_ENCRYPTION_KEY
    ) {

        throw new Error(
            "PROVIDER_CREDENTIAL_ENCRYPTION_KEY is not configured"
        );

    }

    if (
        /^[0-9a-fA-F]{64}$/.test(
            PROVIDER_CREDENTIAL_ENCRYPTION_KEY
        )
    ) {

        return Buffer.from(
            PROVIDER_CREDENTIAL_ENCRYPTION_KEY,
            "hex"
        );

    }

    try {

        const buffer =
            Buffer.from(
                PROVIDER_CREDENTIAL_ENCRYPTION_KEY,
                "base64"
            );

        if (
            buffer.length ===
            32
        ) {

            return buffer;

        }

    } catch {
        /*
         * Continue.
         */
    }

    return crypto
        .createHash(
            "sha256"
        )
        .update(
            PROVIDER_CREDENTIAL_ENCRYPTION_KEY
        )
        .digest();

}


/* =========================================================
   BUFFER DECODER
========================================================= */

function decodeBuffer(
    value
) {

    const text =
        normalizeString(
            value
        );

    if (!text) {

        return null;

    }

    if (
        /^[0-9a-fA-F]+$/.test(text) &&
        text.length % 2 === 0
    ) {

        try {

            return Buffer.from(
                text,
                "hex"
            );

        } catch {
            /*
             * Continue.
             */
        }

    }

    try {

        const buffer =
            Buffer.from(
                text,
                "base64"
            );

        if (
            buffer.length > 0
        ) {

            return buffer;

        }

    } catch {
        /*
         * Continue.
         */
    }

    return null;

}


/* =========================================================
   AES GCM
========================================================= */

function decryptAesGcm(
    iv,
    authTag,
    ciphertext
) {

    const key =
        getEncryptionKey();

    if (
        key.length !==
        32
    ) {

        throw new Error(
            "Encryption key must be 32 bytes"
        );

    }

    const decipher =
        crypto.createDecipheriv(
            "aes-256-gcm",
            key,
            iv
        );

    decipher.setAuthTag(
        authTag
    );

    const decrypted =
        Buffer.concat([

            decipher.update(
                ciphertext
            ),

            decipher.final()

        ]);

    return decrypted.toString(
        "utf8"
    );

}


/* =========================================================
   LOAD PROVIDER API KEY
========================================================= */

async function loadProviderApiKey(
    providerCode
) {

    const normalizedProviderCode =
        normalizeString(
            providerCode
        );

    if (!normalizedProviderCode) {

        throw new Error(
            "Provider ID is missing"
        );

    }

    const params =
        new URLSearchParams();

    params.set(
        "select",
        [
            "id",
            "provider_id",
            "api_key_ciphertext",
            "api_key_iv",
            "api_key_tag",
            "created_at",
            "updated_at"
        ].join(",")
    );

    params.set(
        "provider_id",
        `eq.${normalizedProviderCode}`
    );

    params.set(
        "limit",
        "1"
    );

    const credentials =
        await supabaseRequest(
            `/rest/v1/provider_credentials?${params.toString()}`,
            {
                method:
                    "GET"
            }
        );

    if (
        !Array.isArray(credentials) ||
        !credentials.length
    ) {

        throw new Error(
            `No provider credential found for ${normalizedProviderCode}`
        );

    }

    const credential =
        credentials[0];

    const ciphertext =
        normalizeString(
            credential?.api_key_ciphertext
        );

    const iv =
        normalizeString(
            credential?.api_key_iv
        );

    const authTag =
        normalizeString(
            credential?.api_key_tag
        );

    if (
        !ciphertext ||
        !iv ||
        !authTag
    ) {

        throw new Error(
            `Incomplete provider credential for ${normalizedProviderCode}`
        );

    }

    const ivBuffer =
        decodeBuffer(
            iv
        );

    const authTagBuffer =
        decodeBuffer(
            authTag
        );

    const ciphertextBuffer =
        decodeBuffer(
            ciphertext
        );

    if (
        !ivBuffer ||
        !authTagBuffer ||
        !ciphertextBuffer
    ) {

        throw new Error(
            `Invalid encrypted provider credential for ${normalizedProviderCode}`
        );

    }

    let apiKey;

    try {

        apiKey =
            decryptAesGcm(
                ivBuffer,
                authTagBuffer,
                ciphertextBuffer
            );

    } catch (error) {

        console.error(
            "[generate-status] Provider credential decryption failed:",
            error?.message ||
            error
        );

        throw new Error(
            `Unable to decrypt provider API credential for ${normalizedProviderCode}`
        );

    }

    const normalizedApiKey =
        normalizeString(
            apiKey
        );

    if (!normalizedApiKey) {

        throw new Error(
            `Decrypted provider API key is empty for ${normalizedProviderCode}`
        );

    }

    return normalizedApiKey;

}


/* =========================================================
   GENERIC VALUE
========================================================= */

function firstDefined(
    ...values
) {

    for (
        const value
        of values
    ) {

        if (
            value !== undefined &&
            value !== null &&
            String(
                value
            ).trim() !== ""
        ) {

            return value;

        }

    }

    return null;

}


/* =========================================================
   RECURSIVE OBJECT COLLECTION
========================================================= */

function collectObjects(
    root,
    maxDepth = 8
) {

    const objects =
        [];

    const visited =
        new Set();

    function walk(
        value,
        depth
    ) {

        if (
            depth >
            maxDepth
        ) {

            return;

        }

        if (
            !value ||
            typeof value !== "object"
        ) {

            return;

        }

        if (
            visited.has(
                value
            )
        ) {

            return;

        }

        visited.add(
            value
        );

        objects.push(
            value
        );

        if (
            Array.isArray(
                value
            )
        ) {

            for (
                const item
                of value
            ) {

                walk(
                    item,
                    depth + 1
                );

            }

            return;

        }

        for (
            const key
            of Object.keys(
                value
            )
        ) {

            const child =
                value[key];

            if (
                child &&
                typeof child === "object"
            ) {

                walk(
                    child,
                    depth + 1
                );

            }

        }

    }

    walk(
        root,
        0
    );

    return objects;

}


/* =========================================================
   EXTRACT STATE
========================================================= */

function extractTaskState(
    response
) {

    const objects =
        collectObjects(
            response
        );

    const keys = [

        "state",

        "status",

        "task_state",

        "taskStatus",

        "task_status"

    ];

    for (
        const object
        of objects
    ) {

        for (
            const key
            of keys
        ) {

            const state =
                normalizeState(
                    object?.[key]
                );

            if (state) {

                return state;

            }

        }

    }

    return "";

}


/* =========================================================
   EXTRACT TASK ID
========================================================= */

function extractTaskId(
    response,
    fallbackTaskId
) {

    const objects =
        collectObjects(
            response
        );

    const keys = [

        "taskId",

        "task_id",

        "taskID",

        "jobId",

        "job_id"

    ];

    for (
        const object
        of objects
    ) {

        for (
            const key
            of keys
        ) {

            const value =
                normalizeString(
                    object?.[key]
                );

            if (value) {

                return value;

            }

        }

    }

    return normalizeString(
        fallbackTaskId
    );

}


/* =========================================================
   PARSE JSON VALUE
========================================================= */

function parseJsonValue(
    value
) {

    if (
        value === null ||
        value === undefined
    ) {

        return null;

    }

    if (
        typeof value === "object"
    ) {

        return value;

    }

    if (
        typeof value !== "string"
    ) {

        return null;

    }

    const text =
        value.trim();

    if (!text) {

        return null;

    }

    try {

        return JSON.parse(
            text
        );

    } catch {

        return null;

    }

}


/* =========================================================
   EXTRACT RESULT JSON
========================================================= */

function extractResultJson(
    response
) {

    const objects =
        collectObjects(
            response
        );

    for (
        const object
        of objects
    ) {

        const value =
            firstDefined(

                object?.resultJson,

                object?.result_json

            );

        if (
            value !== null &&
            value !== undefined
        ) {

            return parseJsonValue(
                value
            );

        }

    }

    return null;

}


/* =========================================================
   NORMALIZE RESULT URL
========================================================= */

function normalizeResultUrl(
    value
) {

    if (
        typeof value === "string"
    ) {

        return normalizeString(
            value
        );

    }

    if (
        value &&
        typeof value === "object"
    ) {

        return normalizeString(

            value.url ||

            value.resultUrl ||

            value.result_url ||

            value.videoUrl ||

            value.video_url ||

            value.fileUrl ||

            value.file_url ||

            value.downloadUrl ||

            value.download_url ||

            ""

        );

    }

    return "";

}


/* =========================================================
   COLLECT RESULT URLS
========================================================= */

function collectResultUrls(
    response,
    resultJson = null
) {

    const urls =
        [];

    function add(
        value
    ) {

        if (
            Array.isArray(
                value
            )
        ) {

            for (
                const item
                of value
            ) {

                add(
                    item
                );

            }

            return;

        }

        const url =
            normalizeResultUrl(
                value
            );

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

    const objects =
        collectObjects(
            response
        );

    for (
        const object
        of objects
    ) {

        add(
            object?.resultUrls
        );

        add(
            object?.result_urls
        );

        add(
            object?.urls
        );

        add(
            object?.videoUrls
        );

        add(
            object?.video_urls
        );

        add(
            object?.resultUrl
        );

        add(
            object?.result_url
        );

        add(
            object?.videoUrl
        );

        add(
            object?.video_url
        );

    }

    if (
        resultJson &&
        typeof resultJson === "object"
    ) {

        const resultObjects =
            collectObjects(
                resultJson
            );

        for (
            const object
            of resultObjects
        ) {

            add(
                object?.resultUrls
            );

            add(
                object?.result_urls
            );

            add(
                object?.urls
            );

            add(
                object?.videoUrls
            );

            add(
                object?.video_urls
            );

            add(
                object?.resultUrl
            );

            add(
                object?.result_url
            );

            add(
                object?.videoUrl
            );

            add(
                object?.video_url
            );

        }

    }

    return urls;

}


/* =========================================================
   BOOLEAN FLAG
========================================================= */

function getBooleanFlag(
    response,
    keys
) {

    const objects =
        collectObjects(
            response
        );

    for (
        const object
        of objects
    ) {

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
   NORMALIZE TASK RESPONSE
========================================================= */

function normalizeTaskResponse(
    response,
    requestedTaskId
) {

    const raw =
        response &&
        typeof response === "object"
            ? response
            : {};

    const state =
        extractTaskState(
            raw
        );

    const taskId =
        extractTaskId(
            raw,
            requestedTaskId
        );

    const resultJson =
        extractResultJson(
            raw
        );

    const resultUrls =
        collectResultUrls(
            raw,
            resultJson
        );


    /* =====================================================
       EXPLICIT FLAGS
    ===================================================== */

    const explicitCompleted =
        getBooleanFlag(
            raw,
            [
                "completed",
                "complete",
                "finished",
                "success",
                "succeeded",
                "successful"
            ]
        );

    const explicitFailed =
        getBooleanFlag(
            raw,
            [
                "failed",
                "failure",
                "error"
            ]
        );

    const explicitProcessing =
        getBooleanFlag(
            raw,
            [
                "processing",
                "running",
                "generating"
            ]
        );


    /* =====================================================
       PROVIDER STATE
    ===================================================== */

    const stateCompleted =
        COMPLETED_STATES.has(
            state
        );

    const stateFailed =
        FAILED_STATES.has(
            state
        );

    const stateProcessing =
        PROCESSING_STATES.has(
            state
        );


    /* =====================================================
       TERMINAL DECISION
    ===================================================== */

    const failed =
        explicitFailed ||
        stateFailed;

    const completed =
        !failed &&
        (
            stateCompleted ||
            explicitCompleted
        );

    const processing =
        !failed &&
        !completed &&
        (
            explicitProcessing ||
            stateProcessing ||
            !state
        );


    let normalizedState;

    if (failed) {

        normalizedState =
            "failed";

    } else if (completed) {

        normalizedState =
            "completed";

    } else {

        normalizedState =
            state ||
            "processing";

    }


    return {

        taskId,

        task_id:
            taskId,

        state:
            normalizedState,

        provider_state:
            state,

        success:
            completed,

        completed,

        failed,

        processing,

        hasResult:
            resultUrls.length > 0,

        has_result:
            resultUrls.length > 0,

        resultJson,

        resultUrls,

        result_urls:
            resultUrls,

        raw

    };

}


/* =========================================================
   HISTORY ERROR
========================================================= */

function getHistoryErrorMessage(
    result
) {

    const raw =
        result?.raw ||
        {};

    const candidates = [

        raw?.error_message,

        raw?.errorMessage,

        raw?.message,

        raw?.error,

        raw?.data?.error_message,

        raw?.data?.errorMessage,

        raw?.data?.message,

        raw?.data?.error,

        raw?.task?.error_message,

        raw?.task?.errorMessage,

        raw?.task?.message,

        raw?.task?.error

    ];

    for (
        const candidate
        of candidates
    ) {

        if (
            typeof candidate ===
            "string"
        ) {

            const value =
                candidate.trim();

            if (value) {

                return value;

            }

        }

    }

    return (
        result?.state
            ? `Generation task failed with state: ${result.state}`
            : "Generation task failed"
    );

}


/* =========================================================
   FIND HISTORY ROW
========================================================= */

async function findGenerationHistory(
    userId,
    taskId
) {

    const normalizedUserId =
        normalizeString(
            userId
        );

    const normalizedTaskId =
        normalizeString(
            taskId
        );

    if (
        !normalizedUserId ||
        !normalizedTaskId
    ) {

        return null;

    }

    const params =
        new URLSearchParams();

    params.set(
        "select",
        "id,user_id,task_id,status,result_url,error_message,completed_at"
    );

    params.set(
        "user_id",
        `eq.${normalizedUserId}`
    );

    params.set(
        "task_id",
        `eq.${normalizedTaskId}`
    );

    params.set(
        "limit",
        "1"
    );

    const rows =
        await supabaseRequest(
            `/rest/v1/generation_history?${params.toString()}`,
            {
                method:
                    "GET"
            }
        );

    if (
        !Array.isArray(rows)
    ) {

        return null;

    }

    return rows.length
        ? rows[0]
        : null;

}


/* =========================================================
   FIND HISTORY ROW BY ID
   ---------------------------------------------------------
   Setelah row ditemukan melalui user_id + task_id,
   seluruh operasi berikutnya menggunakan primary key.
========================================================= */

async function findGenerationHistoryById(
    rowId
) {

    const normalizedRowId =
        normalizeString(
            rowId
        );

    if (!normalizedRowId) {

        return null;

    }

    const params =
        new URLSearchParams();

    params.set(
        "select",
        "id,user_id,task_id,status,result_url,error_message,completed_at"
    );

    params.set(
        "id",
        `eq.${normalizedRowId}`
    );

    params.set(
        "limit",
        "1"
    );

    const rows =
        await supabaseRequest(
            `/rest/v1/generation_history?${params.toString()}`,
            {
                method:
                    "GET"
            }
        );

    if (
        !Array.isArray(rows) ||
        !rows.length
    ) {

        return null;

    }

    return rows[0];

}


/* =========================================================
   PATCH HISTORY ROW
   ---------------------------------------------------------
   Update hanya berdasarkan primary key.
   Tidak lagi mengandalkan user_id pada PATCH.
========================================================= */

async function patchGenerationHistoryRow(
    rowId,
    payload
) {

    const normalizedRowId =
        normalizeString(
            rowId
        );

    if (!normalizedRowId) {

        throw new Error(
            "generation_history row id is missing"
        );

    }

    const params =
        new URLSearchParams();

    params.set(
        "id",
        `eq.${normalizedRowId}`
    );

    return supabaseRequest(
        `/rest/v1/generation_history?${params.toString()}`,
        {

            method:
                "PATCH",

            headers: {

                /*
                 * Representation diminta untuk
                 * debugging dan verifikasi.
                 *
                 * Namun hasil PATCH TIDAK dijadikan
                 * sumber kebenaran utama.
                 */

                Prefer:
                    "return=representation"

            },

            body:
                JSON.stringify(
                    payload
                )

        }
    );

}


/* =========================================================
   VERIFY HISTORY TERMINAL STATUS
========================================================= */

async function verifyHistoryTerminalState(
    rowId,
    expectedStatus
) {

    const normalizedRowId =
        normalizeString(
            rowId
        );

    const normalizedExpectedStatus =
        normalizeState(
            expectedStatus
        );

    if (
        !normalizedRowId ||
        !normalizedExpectedStatus
    ) {

        return {

            verified:
                false,

            row:
                null

        };

    }

    const row =
        await findGenerationHistoryById(
            normalizedRowId
        );

    if (!row) {

        return {

            verified:
                false,

            row:
                null

        };

    }

    const actualStatus =
        normalizeState(
            row.status
        );

    return {

        verified:
            actualStatus ===
            normalizedExpectedStatus,

        row

    };

}


/* =========================================================
   UPDATE HISTORY
========================================================= */

async function updateGenerationHistory({
    userId,
    taskId,
    result
}) {

    const normalizedUserId =
        normalizeString(
            userId
        );

    const normalizedTaskId =
        normalizeString(
            taskId
        );

    if (
        !normalizedUserId ||
        !normalizedTaskId
    ) {

        throw new Error(
            "History update requires user_id and task_id"
        );

    }


    /* =====================================================
       PROCESSING
    ===================================================== */

    if (
        result?.processing &&
        !result?.completed &&
        !result?.failed
    ) {

        return {

            updated:
                false,

            matched:
                false,

            status:
                "processing",

            reason:
                "task_still_processing"

        };

    }


    /* =====================================================
       FIND EXISTING ROW
    ===================================================== */

    let existingRow;

    try {

        existingRow =
            await findGenerationHistory(
                normalizedUserId,
                normalizedTaskId
            );

    } catch (error) {

        const diagnostic =
            new Error(
                "Failed to query generation_history"
            );

        diagnostic.status =
            error?.status || 500;

        diagnostic.data =
            error?.data || null;

        diagnostic.cause =
            error;

        throw diagnostic;

    }


    /* =====================================================
       ROW NOT FOUND
    ===================================================== */

    if (!existingRow) {

        return {

            updated:
                false,

            matched:
                false,

            status:
                result?.failed
                    ? "failed"
                    : "completed",

            reason:
                "generation_history_row_not_found",

            user_id:
                normalizedUserId,

            task_id:
                normalizedTaskId

        };

    }


    const rowId =
        normalizeString(
            existingRow.id
        );

    if (!rowId) {

        throw new Error(
            "generation_history row does not contain an id"
        );

    }


    /* =====================================================
       ALREADY COMPLETED
       -----------------------------------------------------
       Jika sebelumnya sudah selesai, jangan menganggap
       response PATCH sebagai satu-satunya sumber kebenaran.
    ===================================================== */

    const existingStatus =
        normalizeState(
            existingRow.status
        );

    if (
        result?.completed &&
        existingStatus ===
            "completed"
    ) {

        return {

            updated:
                true,

            matched:
                true,

            status:
                "completed",

            result_url:
                normalizeString(
                    existingRow.result_url
                ) || null,

            row_id:
                rowId,

            reason:
                "history_already_completed"

        };

    }

    if (
        result?.failed &&
        existingStatus ===
            "failed"
    ) {

        return {

            updated:
                true,

            matched:
                true,

            status:
                "failed",

            error_message:
                existingRow.error_message ||
                null,

            row_id:
                rowId,

            reason:
                "history_already_failed"

        };

    }


    /* =====================================================
       COMPLETED
    ===================================================== */

    if (
        result?.completed
    ) {

        const resultUrl =
            Array.isArray(
                result?.resultUrls
            ) &&
            result.resultUrls.length > 0
                ? normalizeString(
                    result.resultUrls[0]
                )
                : null;

        const completedAt =
            new Date().toISOString();

        const payload = {

            status:
                "completed",

            result_url:
                resultUrl,

            error_message:
                null,

            completed_at:
                completedAt

        };


        /*
         * -------------------------------------------------
         * FIRST PATCH
         * -------------------------------------------------
         */

        let patchResponse;

        try {

            patchResponse =
                await patchGenerationHistoryRow(
                    rowId,
                    payload
                );

        } catch (error) {

            const diagnostic =
                new Error(
                    "Failed to update completed generation_history row"
                );

            diagnostic.status =
                error?.status || 500;

            diagnostic.data =
                error?.data || null;

            diagnostic.cause =
                error;

            throw diagnostic;

        }


        /*
         * -------------------------------------------------
         * FIRST VERIFICATION
         * -------------------------------------------------
         *
         * Jangan percaya begitu saja pada response PATCH.
         * Supabase/PostgREST dapat mengembalikan response
         * kosong tergantung Prefer/header/schema.
         */

        let verification;

        try {

            verification =
                await verifyHistoryTerminalState(
                    rowId,
                    "completed"
                );

        } catch (error) {

            const diagnostic =
                new Error(
                    "Failed to verify completed generation_history row"
                );

            diagnostic.status =
                error?.status || 500;

            diagnostic.data =
                error?.data || null;

            diagnostic.cause =
                error;

            throw diagnostic;

        }


        if (
            verification?.verified
        ) {

            return {

                updated:
                    true,

                matched:
                    true,

                status:
                    "completed",

                result_url:
                    normalizeString(
                        verification.row?.result_url,
                        resultUrl || ""
                    ) || null,

                row_id:
                    rowId,

                reason:
                    "history_verified_after_patch"

            };

        }


        /*
         * -------------------------------------------------
         * RETRY PATCH
         * -------------------------------------------------
         *
         * Jika PATCH pertama tidak menghasilkan perubahan
         * yang terlihat ketika diverifikasi, ulangi sekali.
         *
         * Ini menangani kemungkinan request transient,
         * response representation kosong, atau race kecil
         * antara write dan read.
         */

        let retryResponse;

        try {

            retryResponse =
                await patchGenerationHistoryRow(
                    rowId,
                    payload
                );

        } catch (error) {

            console.error(
                "[generate-status] History retry PATCH failed:",
                {

                    message:
                        error?.message ||
                        String(
                            error
                        ),

                    status:
                        error?.status ||
                        null,

                    data:
                        error?.data ||
                        null,

                    row_id:
                        rowId,

                    task_id:
                        normalizedTaskId

                }
            );

            retryResponse =
                null;

        }


        /*
         * -------------------------------------------------
         * SECOND VERIFICATION
         * -------------------------------------------------
         */

        let retryVerification;

        try {

            retryVerification =
                await verifyHistoryTerminalState(
                    rowId,
                    "completed"
                );

        } catch (error) {

            const diagnostic =
                new Error(
                    "Failed to verify completed generation_history row after retry"
                );

            diagnostic.status =
                error?.status || 500;

            diagnostic.data =
                error?.data || null;

            diagnostic.cause =
                error;

            throw diagnostic;

        }


        if (
            retryVerification?.verified
        ) {

            return {

                updated:
                    true,

                matched:
                    true,

                status:
                    "completed",

                result_url:
                    normalizeString(
                        retryVerification.row?.result_url,
                        resultUrl || ""
                    ) || null,

                row_id:
                    rowId,

                reason:
                    "history_verified_after_retry"

            };

        }


        /*
         * -------------------------------------------------
         * FINAL DIAGNOSTIC
         * -------------------------------------------------
         */

        const verifiedRow =
            retryVerification?.row ||
            verification?.row ||
            null;

        return {

            updated:
                false,

            matched:
                true,

            status:
                "completed",

            result_url:
                resultUrl,

            row_id:
                rowId,

            database_status:
                normalizeString(
                    verifiedRow?.status
                ) || null,

            patch_response_type:
                Array.isArray(
                    retryResponse ||
                    patchResponse
                )
                    ? "array"
                    : typeof (
                        retryResponse ||
                        patchResponse
                    ),

            reason:
                verifiedRow
                    ? "history_status_not_changed_after_patch"
                    : "history_row_missing_after_patch"

        };

    }


    /* =====================================================
       FAILED
    ===================================================== */

    if (
        result?.failed
    ) {

        const errorMessage =
            getHistoryErrorMessage(
                result
            );

        const payload = {

            status:
                "failed",

            result_url:
                null,

            error_message:
                errorMessage,

            completed_at:
                new Date().toISOString()

        };


        /*
         * -------------------------------------------------
         * FIRST PATCH
         * -------------------------------------------------
         */

        let patchResponse;

        try {

            patchResponse =
                await patchGenerationHistoryRow(
                    rowId,
                    payload
                );

        } catch (error) {

            const diagnostic =
                new Error(
                    "Failed to update failed generation_history row"
                );

            diagnostic.status =
                error?.status || 500;

            diagnostic.data =
                error?.data || null;

            diagnostic.cause =
                error;

            throw diagnostic;

        }


        /*
         * -------------------------------------------------
         * FIRST VERIFICATION
         * -------------------------------------------------
         */

        let verification;

        try {

            verification =
                await verifyHistoryTerminalState(
                    rowId,
                    "failed"
                );

        } catch (error) {

            const diagnostic =
                new Error(
                    "Failed to verify failed generation_history row"
                );

            diagnostic.status =
                error?.status || 500;

            diagnostic.data =
                error?.data || null;

            diagnostic.cause =
                error;

            throw diagnostic;

        }


        if (
            verification?.verified
        ) {

            return {

                updated:
                    true,

                matched:
                    true,

                status:
                    "failed",

                error_message:
                    verification.row?.error_message ||
                    errorMessage,

                row_id:
                    rowId,

                reason:
                    "history_verified_after_patch"

            };

        }


        /*
         * -------------------------------------------------
         * RETRY PATCH
         * -------------------------------------------------
         */

        let retryResponse;

        try {

            retryResponse =
                await patchGenerationHistoryRow(
                    rowId,
                    payload
                );

        } catch (error) {

            console.error(
                "[generate-status] Failed history retry PATCH:",
                {

                    message:
                        error?.message ||
                        String(
                            error
                        ),

                    status:
                        error?.status ||
                        null,

                    data:
                        error?.data ||
                        null,

                    row_id:
                        rowId,

                    task_id:
                        normalizedTaskId

                }
            );

            retryResponse =
                null;

        }


        /*
         * -------------------------------------------------
         * SECOND VERIFICATION
         * -------------------------------------------------
         */

        let retryVerification;

        try {

            retryVerification =
                await verifyHistoryTerminalState(
                    rowId,
                    "failed"
                );

        } catch (error) {

            const diagnostic =
                new Error(
                    "Failed to verify failed generation_history row after retry"
                );

            diagnostic.status =
                error?.status || 500;

            diagnostic.data =
                error?.data || null;

            diagnostic.cause =
                error;

            throw diagnostic;

        }


        if (
            retryVerification?.verified
        ) {

            return {

                updated:
                    true,

                matched:
                    true,

                status:
                    "failed",

                error_message:
                    retryVerification.row?.error_message ||
                    errorMessage,

                row_id:
                    rowId,

                reason:
                    "history_verified_after_retry"

            };

        }


        const verifiedRow =
            retryVerification?.row ||
            verification?.row ||
            null;

        return {

            updated:
                false,

            matched:
                true,

            status:
                "failed",

            error_message:
                errorMessage,

            row_id:
                rowId,

            database_status:
                normalizeString(
                    verifiedRow?.status
                ) || null,

            patch_response_type:
                Array.isArray(
                    retryResponse ||
                    patchResponse
                )
                    ? "array"
                    : typeof (
                        retryResponse ||
                        patchResponse
                    ),

            reason:
                verifiedRow
                    ? "history_status_not_changed_after_patch"
                    : "history_row_missing_after_patch"

        };

    }


    /* =====================================================
       NO TERMINAL STATE
    ===================================================== */

    return {

        updated:
            false,

        matched:
            true,

        status:
            result?.state ||
            "unknown",

        reason:
            "no_terminal_state",

        row_id:
            rowId

    };

}


/* =========================================================
   HANDLER
========================================================= */

export default async function handler(
    req,
    res
) {

    /* =====================================================
       METHOD
    ===================================================== */

    if (
        req.method !==
        "POST"
    ) {

        res.setHeader(
            "Allow",
            "POST"
        );

        return failure(
            res,
            405,
            "Method not allowed"
        );

    }


    /* =====================================================
       CONFIG
    ===================================================== */

    if (
        !SUPABASE_URL ||
        !SUPABASE_SERVICE_ROLE_KEY
    ) {

        return failure(
            res,
            500,
            "Server configuration is incomplete"
        );

    }


    /* =====================================================
       AUTH
    ===================================================== */

    let user;

    try {

        user =
            await authenticateUser(
                req
            );

    } catch (error) {

        return failure(
            res,
            error.status ||
                401,
            error.message ||
                "Unauthorized"
        );

    }


    /* =====================================================
       BODY
    ===================================================== */

    let body;

    try {

        body =
            await readBody(
                req
            );

    } catch (error) {

        return failure(
            res,
            error.status ||
                400,
            error.message ||
                "Invalid request body"
        );

    }


    /* =====================================================
       MODEL
    ===================================================== */

    const modelId =
        getModelId(
            body
        );

    if (!modelId) {

        return failure(
            res,
            400,
            "model_id is required"
        );

    }


    /* =====================================================
       TASK
    ===================================================== */

    const taskId =
        getTaskId(
            body
        );

    if (!taskId) {

        return failure(
            res,
            400,
            "task_id is required"
        );

    }


    /* =====================================================
       ADAPTER
    ===================================================== */

    const adapter =
        getModelAdapter(
            modelId
        );

    if (!adapter) {

        return failure(
            res,
            404,
            "Model not found",
            {

                model_id:
                    modelId,

                source:
                    "repository"

            }
        );

    }


    const modelConfig =
        adapter.config ||
        {};

    const adapterModelId =
        normalizeString(
            modelConfig.id
        );

    if (
        !adapterModelId ||
        adapterModelId !==
            modelId
    ) {

        return failure(
            res,
            500,
            "Model adapter ID mismatch",
            {

                requested_model:
                    modelId,

                adapter_model:
                    adapterModelId

            }
        );

    }


    /* =====================================================
       DATABASE MODEL
    ===================================================== */

    let databaseModel =
        null;

    try {

        databaseModel =
            await loadDatabaseModel(
                modelId
            );

    } catch (error) {

        console.warn(
            "[generate-status] Database model lookup failed:",
            error?.message ||
            error
        );

    }


    /* =====================================================
       PROVIDER
    ===================================================== */

    let provider;

    try {

        provider =
            await resolveProvider(
                adapter,
                databaseModel
            );

    } catch (error) {

        console.error(
            "[generate-status] Provider lookup failed:",
            error?.message ||
            error
        );

        return failure(
            res,
            500,
            "Failed to load provider configuration"
        );

    }


    if (!provider) {

        return failure(
            res,
            404,
            "Provider not found"
        );

    }


    const providerCode =
        normalizeString(

            provider.provider_id ||

            modelConfig.providerId ||

            ""

        );


    if (!providerCode) {

        return failure(
            res,
            500,
            "Provider ID is missing"
        );

    }


    /* =====================================================
       PROVIDER API KEY
    ===================================================== */

    let providerApiKey;

    try {

        providerApiKey =
            await loadProviderApiKey(
                providerCode
            );

    } catch (error) {

        console.error(
            "[generate-status] Provider credential error:",
            error?.message ||
            error
        );

        return failure(
            res,
            500,
            "Provider API credential is unavailable",
            {

                provider_id:
                    providerCode

            }
        );

    }


    /* =====================================================
       QUERY TASK
    ===================================================== */

    let taskResponse;

    try {

        if (
            typeof adapter.queryTask !==
            "function"
        ) {

            return failure(
                res,
                500,
                "Model does not support task status queries"
            );

        }

        taskResponse =
            await adapter.queryTask(
                taskId,
                providerApiKey
            );

    } catch (error) {

        console.error(
            "[generate-status] queryTask failed:",
            error?.message ||
            error
        );

        const providerStatus =
            Number(
                error?.status
            );

        const statusCode =
            providerStatus >= 400 &&
            providerStatus <= 599
                ? providerStatus
                : 502;

        return failure(
            res,
            statusCode,
            error?.message ||
                "Failed to query generation task",
            {

                code:
                    error?.code ||
                    "GENERATION_STATUS_FAILED"

            }
        );

    }


    /* =====================================================
       NORMALIZE
    ===================================================== */

    const result =
        normalizeTaskResponse(
            taskResponse,
            taskId
        );


    /* =====================================================
       DIAGNOSTIC LOG
    ===================================================== */

    console.info(
        "[generate-status] Task normalized:",
        {

            requested_task_id:
                taskId,

            returned_task_id:
                result.taskId,

            provider_state:
                result.provider_state,

            normalized_state:
                result.state,

            completed:
                result.completed,

            failed:
                result.failed,

            processing:
                result.processing,

            has_result:
                result.hasResult,

            result_count:
                result.resultUrls.length

        }
    );


    /* =====================================================
       UPDATE HISTORY
    ===================================================== */

    let historyResult =
        null;

    let historyUpdated =
        false;

    let historyStatus =
        result.completed
            ? "completed"
            : result.failed
                ? "failed"
                : "processing";


    try {

        historyResult =
            await updateGenerationHistory({

                userId:
                    user.id,

                taskId:
                    taskId,

                result

            });


        historyUpdated =
            Boolean(
                historyResult?.updated
            );


        historyStatus =
            historyResult?.status ||
            historyStatus;


    } catch (historyError) {

        console.error(
            "[generate-status] generation_history update FAILED:",
            {

                message:
                    historyError?.message ||
                    String(
                        historyError
                    ),

                status:
                    historyError?.status ||
                    null,

                data:
                    historyError?.data ||
                    null,

                user_id:
                    user.id,

                task_id:
                    taskId,

                provider_state:
                    result.provider_state,

                normalized_state:
                    result.state,

                completed:
                    result.completed,

                failed:
                    result.failed

            }
        );


        historyResult = {

            updated:
                false,

            matched:
                false,

            status:
                historyStatus,

            reason:
                "history_update_exception",

            error:
                historyError?.message ||
                "History update failed"

        };

    }


    /* =====================================================
       FINAL DIAGNOSTIC
    ===================================================== */

    console.info(
        "[generate-status] History synchronization:",
        {

            task_id:
                taskId,

            state:
                result.state,

            provider_state:
                result.provider_state,

            completed:
                result.completed,

            failed:
                result.failed,

            processing:
                result.processing,

            history_updated:
                historyUpdated,

            history_matched:
                Boolean(
                    historyResult?.matched
                ),

            history_status:
                historyStatus,

            history_reason:
                historyResult?.reason ||
                null,

            history_row_id:
                historyResult?.row_id ||
                null,

            history_database_status:
                historyResult?.database_status ||
                null

        }
    );


    /* =====================================================
       RESPONSE
    ===================================================== */

    return success(
        res,
        {

            user_id:
                user.id,

            model_id:
                modelConfig.id,

            model_name:
                modelConfig.name ||
                modelConfig.id,

            provider_id:
                providerCode,

            provider:
                provider.provider_name ||
                provider.name ||
                providerCode,

            task_id:
                result.taskId ||
                taskId,

            taskId:
                result.taskId ||
                taskId,

            state:
                result.state,

            provider_state:
                result.provider_state,

            processing:
                result.processing,

            completed:
                result.completed,

            failed:
                result.failed,

            has_result:
                result.hasResult,

            hasResult:
                result.hasResult,

            result_urls:
                result.resultUrls,

            resultUrls:
                result.resultUrls,

            result:
                result.resultJson,

            history_updated:
                historyUpdated,

            history_status:
                historyStatus,

            history_reason:
                historyResult?.reason ||
                null,

            history_matched:
                Boolean(
                    historyResult?.matched
                ),

            history_row_id:
                historyResult?.row_id ||
                null,

            history_database_status:
                historyResult?.database_status ||
                null

        }
    );

}
