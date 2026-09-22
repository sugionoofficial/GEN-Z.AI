/**
 * =========================================================
 * GEN-Z.AI
 * GENERATE STATUS API
 * ---------------------------------------------------------
 * File:
 *   api/generate-status.js
 *
 * Endpoint:
 *   POST /api/generate-status
 *
 * Tanggung jawab:
 * - Authenticate user
 * - Validasi model_id
 * - Validasi task_id
 * - Resolve model dari repository
 * - Resolve provider
 * - Mengambil credential provider secara server-side
 * - Memanggil adapter.queryTask()
 * - Sinkronisasi generation_history
 * - Mengembalikan status task dan result
 *
 * Tidak bertanggung jawab:
 * - Membuat task baru
 * - Menyimpan API key ke browser
 * - Render UI
 * - Polling di browser
 * - Menentukan parameter generation
 * - Membuat row generation_history baru
 * - Mengurangi / mengembalikan credit
 *
 * =========================================================
 *
 * FLOW
 *
 *   Frontend
 *      ↓
 *   POST /api/generate-status
 *      ↓
 *   Supabase Auth
 *      ↓
 *   MODEL REGISTRY
 *      ↓
 *   models/<model-folder>
 *      ↓
 *   queryTask()
 *      ↓
 *   KIE API
 *      ↓
 *   normalize status/result
 *      ↓
 *   UPDATE generation_history
 *      ↓
 *   return status to frontend
 *
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
        "terminated"
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
   RESPONSE
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
        "no-store"
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
   SAFE STRING
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
   NORMALIZE STATE
========================================================= */

function normalizeState(
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
            typeof data ===
                "object"
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
        typeof req.body ===
            "object"
    ) {

        return req.body;
    }


    let body =
        "";


    for await (
        const chunk of req
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
   MODEL LOOKUP
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
            adapter => {

                const adapterId =
                    normalizeString(
                        adapter?.config?.id
                    );


                return (
                    adapterId ===
                    normalizedId
                );
            }
        ) ||
        null
    );
}


/* =========================================================
   LOAD DATABASE MODEL
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


        if (
            !Array.isArray(
                rows
            ) ||
            !rows.length
        ) {

            return null;
        }


        return rows[0];

    } catch (error) {

        console.warn(
            "[generate-status] Optional model config unavailable:",
            error
        );


        return null;
    }
}


/* =========================================================
   LOAD PROVIDER BY DATABASE ID
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


    if (
        !Array.isArray(
            providers
        ) ||
        !providers.length
    ) {

        return null;
    }


    return providers[0];
}


/* =========================================================
   LOAD PROVIDER BY CODE
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
        Array.isArray(
            providers
        ) &&
        providers.length
    ) {

        return providers[0];
    }


    /*
     * Compatibility:
     * provider_name
     */

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


    if (
        Array.isArray(
            namedProviders
        ) &&
        namedProviders.length
    ) {

        return namedProviders[0];
    }


    return null;
}


/* =========================================================
   RESOLVE PROVIDER
========================================================= */

async function resolveProvider(
    adapter,
    databaseModel
) {

    /*
     * Prioritas 1:
     *
     * models.provider_id
     */

    const databaseProviderId =
        databaseModel?.provider_id ||
        null;


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


    /*
     * Prioritas 2:
     *
     * adapter.config.providerId
     */

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


    /*
     * 64 hex chars = 32 bytes.
     */

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


    /*
     * Base64 32 bytes.
     */

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
         * Continue to SHA-256 fallback.
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


    /*
     * Hex.
     */

    if (
        /^[0-9a-fA-F]+$/.test(
            text
        ) &&
        text.length % 2 ===
            0
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


    /*
     * Base64.
     */

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
   AES-256-GCM DECRYPTION
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
   DECRYPT CREDENTIAL
========================================================= */

function decryptCredential(
    value
) {

    if (
        value === null ||
        value === undefined
    ) {

        return null;
    }


    const text =
        normalizeString(
            value
        );


    if (!text) {

        return null;
    }


    /*
     * JSON encrypted format.
     */

    if (
        text.startsWith("{") &&
        text.endsWith("}")
    ) {

        try {

            const parsed =
                JSON.parse(
                    text
                );


            const iv =
                decodeBuffer(
                    parsed.iv
                );


            const authTag =
                decodeBuffer(
                    parsed.authTag ||
                    parsed.auth_tag ||
                    parsed.tag
                );


            const ciphertext =
                decodeBuffer(
                    parsed.ciphertext ||
                    parsed.data ||
                    parsed.encrypted
                );


            if (
                iv &&
                authTag &&
                ciphertext
            ) {

                return decryptAesGcm(
                    iv,
                    authTag,
                    ciphertext
                );
            }

        } catch {
            /*
             * Continue to colon format.
             */
        }
    }


    /*
     * Colon separated:
     *
     * iv:authTag:ciphertext
     */

    const parts =
        text.split(":");


    if (
        parts.length ===
        3
    ) {

        const iv =
            decodeBuffer(
                parts[0]
            );


        const authTag =
            decodeBuffer(
                parts[1]
            );


        const ciphertext =
            decodeBuffer(
                parts[2]
            );


        if (
            iv &&
            authTag &&
            ciphertext
        ) {

            try {

                return decryptAesGcm(
                    iv,
                    authTag,
                    ciphertext
                );

            } catch {
                /*
                 * Treat as plaintext.
                 */
            }
        }
    }


    /*
     * Plaintext fallback.
     */

    return text;
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


    if (
        !normalizedProviderCode
    ) {

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


    let credentials;


    try {

        credentials =
            await supabaseRequest(
                `/rest/v1/provider_credentials?${params.toString()}`,
                {
                    method:
                        "GET"
                }
            );

    } catch (error) {

        console.error(
            "[generate-status] Failed reading provider_credentials:",
            error
        );


        throw new Error(
            `Failed to read provider credential for ${normalizedProviderCode}`
        );
    }


    if (
        !Array.isArray(
            credentials
        ) ||
        !credentials.length
    ) {

        throw new Error(
            `No provider credential found for ${normalizedProviderCode}`
        );
    }


    const credential =
        credentials[0];


    if (
        !credential ||
        typeof credential !==
            "object"
    ) {

        throw new Error(
            `Invalid provider credential for ${normalizedProviderCode}`
        );
    }


    const ciphertext =
        normalizeString(
            credential.api_key_ciphertext
        );


    const iv =
        normalizeString(
            credential.api_key_iv
        );


    const authTag =
        normalizeString(
            credential.api_key_tag
        );


    if (!ciphertext) {

        throw new Error(
            `Provider credential ciphertext is empty for ${normalizedProviderCode}`
        );
    }


    if (!iv) {

        throw new Error(
            `Provider credential IV is empty for ${normalizedProviderCode}`
        );
    }


    if (!authTag) {

        throw new Error(
            `Provider credential authentication tag is empty for ${normalizedProviderCode}`
        );
    }


    let ivBuffer;
    let authTagBuffer;
    let ciphertextBuffer;


    try {

        ivBuffer =
            decodeBuffer(
                iv
            );


        authTagBuffer =
            decodeBuffer(
                authTag
            );


        ciphertextBuffer =
            decodeBuffer(
                ciphertext
            );

    } catch (error) {

        console.error(
            "[generate-status] Failed decoding provider credential:",
            error
        );


        throw new Error(
            `Invalid encrypted provider credential format for ${normalizedProviderCode}`
        );
    }


    if (!ivBuffer) {

        throw new Error(
            `Provider credential IV could not be decoded for ${normalizedProviderCode}`
        );
    }


    if (!authTagBuffer) {

        throw new Error(
            `Provider credential authentication tag could not be decoded for ${normalizedProviderCode}`
        );
    }


    if (!ciphertextBuffer) {

        throw new Error(
            `Provider credential ciphertext could not be decoded for ${normalizedProviderCode}`
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


    /*
     * Jangan pernah log API key.
     */

    console.debug(
        "[generate-status] Provider API credential resolved successfully:",
        {
            provider_id:
                normalizedProviderCode,

            credential_id:
                credential.id,

            has_api_key:
                true
        }
    );


    return normalizedApiKey;
}


/* =========================================================
   RESPONSE OBJECT HELPERS
========================================================= */

/*
 * Ambil nilai dari beberapa object yang umum digunakan
 * oleh adapter/provider.
 */

function firstDefined(
    ...values
) {

    for (
        const value
        of values
    ) {

        if (
            value !==
                undefined &&
            value !==
                null &&
            String(
                value
            ).trim() !==
                ""
        ) {

            return value;
        }
    }


    return null;
}


/* =========================================================
   FIND STATE
========================================================= */

function extractTaskState(
    response
) {

    const candidates = [

        response?.state,

        response?.status,

        response?.task_state,

        response?.taskStatus,

        response?.task?.state,

        response?.task?.status,

        response?.task?.task_state,

        response?.task?.taskStatus,

        response?.data?.state,

        response?.data?.status,

        response?.data?.task_state,

        response?.data?.taskStatus,

        response?.data?.task?.state,

        response?.data?.task?.status,

        response?.data?.task?.task_state,

        response?.data?.task?.taskStatus,

        response?.result?.state,

        response?.result?.status,

        response?.result?.task_state,

        response?.result?.taskStatus,

        response?.result?.task?.state,

        response?.result?.task?.status,

        response?.result?.task?.task_state,

        response?.result?.task?.taskStatus,

        response?.resultJson?.state,

        response?.resultJson?.status,

        response?.resultJson?.task_state,

        response?.resultJson?.taskStatus

    ];


    for (
        const candidate
        of candidates
    ) {

        const state =
            normalizeState(
                candidate
            );


        if (state) {

            return state;
        }
    }


    return "";
}


/* =========================================================
   FIND BOOLEAN FLAG
========================================================= */

function findBooleanFlag(
    response,
    keys
) {

    const objects = [

        response,

        response?.data,

        response?.task,

        response?.result,

        response?.data?.task,

        response?.data?.result,

        response?.task?.result,

        response?.data?.task?.result

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
                object[key] ===
                    true
            ) {

                return true;
            }


            if (
                object[key] ===
                    false
            ) {

                return false;
            }
        }
    }


    return null;
}


/* =========================================================
   NORMALIZE RESULT URL
========================================================= */

function normalizeResultUrlValue(
    value
) {

    if (
        typeof value ===
            "string"
    ) {

        return normalizeString(
            value
        );
    }


    if (
        value &&
        typeof value ===
            "object"
    ) {

        return normalizeString(

            value.url ||

            value.result_url ||

            value.resultUrl ||

            value.video_url ||

            value.videoUrl ||

            value.file_url ||

            value.fileUrl ||

            ""

        );
    }


    return "";
}


/* =========================================================
   COLLECT RESULT URLS
========================================================= */

function collectResultUrls(
    response
) {

    const values = [

        response?.resultUrls,

        response?.result_urls,

        response?.urls,

        response?.videoUrls,

        response?.video_urls,

        response?.result?.resultUrls,

        response?.result?.result_urls,

        response?.result?.urls,

        response?.result?.videoUrls,

        response?.result?.video_urls,

        response?.data?.resultUrls,

        response?.data?.result_urls,

        response?.data?.urls,

        response?.data?.videoUrls,

        response?.data?.video_urls,

        response?.task?.resultUrls,

        response?.task?.result_urls,

        response?.task?.urls,

        response?.task?.videoUrls,

        response?.task?.video_urls,

        response?.data?.task?.resultUrls,

        response?.data?.task?.result_urls,

        response?.data?.task?.urls,

        response?.data?.task?.videoUrls,

        response?.data?.task?.video_urls,

        response?.task?.result?.resultUrls,

        response?.task?.result?.result_urls,

        response?.task?.result?.urls,

        response?.task?.result?.videoUrls,

        response?.task?.result?.video_urls,

        response?.data?.task?.result?.resultUrls,

        response?.data?.task?.result?.result_urls,

        response?.data?.task?.result?.urls,

        response?.data?.task?.result?.videoUrls,

        response?.data?.task?.result?.video_urls,

        response?.resultJson?.resultUrls,

        response?.resultJson?.result_urls,

        response?.resultJson?.urls,

        response?.data?.resultJson?.resultUrls,

        response?.data?.resultJson?.result_urls,

        response?.data?.resultJson?.urls,

        response?.task?.resultJson?.resultUrls,

        response?.task?.resultJson?.result_urls,

        response?.data?.task?.resultJson?.resultUrls,

        response?.data?.task?.resultJson?.result_urls

    ];


    const resultUrls =
        [];


    for (
        const value
        of values
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

                const url =
                    normalizeResultUrlValue(
                        item
                    );


                if (url) {

                    resultUrls.push(
                        url
                    );
                }
            }

        } else {

            const url =
                normalizeResultUrlValue(
                    value
                );


            if (url) {

                resultUrls.push(
                    url
                );
            }
        }
    }


    return [
        ...new Set(
            resultUrls
        )
    ];
}


/* =========================================================
   FIND RESULT JSON
========================================================= */

function extractResultJson(
    response
) {

    const rawResult =
        firstDefined(

            response?.resultJson,

            response?.result_json,

            response?.result,

            response?.data?.resultJson,

            response?.data?.result_json,

            response?.data?.result,

            response?.task?.resultJson,

            response?.task?.result_json,

            response?.task?.result,

            response?.data?.task?.resultJson,

            response?.data?.task?.result_json,

            response?.data?.task?.result

        );


    if (
        rawResult ===
            null
    ) {

        return null;
    }


    if (
        typeof rawResult !==
            "string"
    ) {

        return rawResult;
    }


    const text =
        rawResult.trim();


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
   GET TASK ID FROM RESPONSE
========================================================= */

function extractResponseTaskId(
    response,
    requestedTaskId
) {

    return normalizeString(

        response?.taskId ||

        response?.task_id ||

        response?.jobId ||

        response?.job_id ||

        response?.data?.taskId ||

        response?.data?.task_id ||

        response?.data?.jobId ||

        response?.data?.job_id ||

        response?.task?.taskId ||

        response?.task?.task_id ||

        response?.task?.jobId ||

        response?.task?.job_id ||

        response?.data?.task?.taskId ||

        response?.data?.task?.task_id ||

        response?.data?.task?.jobId ||

        response?.data?.task?.job_id ||

        requestedTaskId

    );
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
        typeof response ===
            "object"
            ? response
            : {};


    const state =
        extractTaskState(
            raw
        );


    const taskId =
        extractResponseTaskId(
            raw,
            requestedTaskId
        );


    const resultJson =
        extractResultJson(
            raw
        );


    /*
     * Result URL dapat berada di resultJson yang
     * sebelumnya sudah diparse.
     */

    const mergedResponse = {

        ...raw,

        resultJson

    };


    const resultUrls =
        collectResultUrls(
            mergedResponse
        );


    /*
     * =====================================================
     * EXPLICIT FLAGS
     * =====================================================
     */

    const completedFlag =
        findBooleanFlag(
            raw,
            [
                "completed",
                "complete",
                "finished"
            ]
        );


    const failedFlag =
        findBooleanFlag(
            raw,
            [
                "failed",
                "failure"
            ]
        );


    const processingFlag =
        findBooleanFlag(
            raw,
            [
                "processing",
                "running",
                "generating"
            ]
        );


    /*
     * =====================================================
     * STATE CLASSIFICATION
     * =====================================================
     */

    const stateIsCompleted =
        COMPLETED_STATES.has(
            state
        );


    const stateIsFailed =
        FAILED_STATES.has(
            state
        );


    const stateIsProcessing =
        PROCESSING_STATES.has(
            state
        );


    /*
     * =====================================================
     * IMPORTANT
     * =====================================================
     *
     * Prioritas:
     *
     * FAILED
     *   ↓
     * PROCESSING
     *   ↓
     * COMPLETED
     *
     * Jika provider secara eksplisit mengatakan
     * processing, result URL tidak boleh memaksa
     * completed.
     *
     * Tetapi jika provider memberikan:
     *
     * - state success/completed/done
     * - completed=true
     *
     * maka task dianggap completed walaupun format
     * result URL berbeda.
     */


    const failed =
        failedFlag === true ||
        stateIsFailed;


    const explicitlyProcessing =
        processingFlag === true ||
        stateIsProcessing;


    const completed =
        !failed &&
        !explicitlyProcessing &&
        (
            completedFlag === true ||
            stateIsCompleted
        );


    const processing =
        !failed &&
        !completed;


    let normalizedState =
        state;


    if (failed) {

        normalizedState =
            "failed";

    } else if (completed) {

        normalizedState =
            "completed";

    } else {

        normalizedState =
            "processing";
    }


    /*
     * =====================================================
     * RESULT DATA
     * =====================================================
     *
     * URL tidak menentukan status.
     *
     * URL hanya data hasil.
     */

    return {

        taskId,

        task_id:
            taskId,

        state:
            normalizedState,

        success:
            completed,

        completed,

        failed,

        processing,

        hasResult:
            resultUrls.length >
            0,

        has_result:
            resultUrls.length >
            0,

        resultJson,

        resultUrls,

        result_urls:
            resultUrls,

        raw

    };
}


/* =========================================================
   EXTRACT HISTORY ERROR MESSAGE
========================================================= */

function getHistoryErrorMessage(
    result
) {

    const raw =
        result?.raw ||
        {};


    const resultJson =
        result?.resultJson ||
        null;


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

        raw?.task?.error,

        raw?.data?.task?.error_message,

        raw?.data?.task?.errorMessage,

        raw?.data?.task?.message,

        raw?.data?.task?.error,

        resultJson?.error_message,

        resultJson?.errorMessage,

        resultJson?.message,

        resultJson?.error

    ];


    for (
        const candidate
        of candidates
    ) {

        if (
            typeof candidate ===
            "string"
        ) {

            const message =
                candidate.trim();


            if (message) {

                return message;
            }
        }


        if (
            candidate &&
            typeof candidate ===
                "object"
        ) {

            try {

                const serialized =
                    JSON.stringify(
                        candidate
                    );


                if (
                    serialized &&
                    serialized !==
                        "{}"
                ) {

                    return serialized;
                }

            } catch {
                /*
                 * Ignore.
                 */
            }
        }
    }


    return (
        result?.state &&
        result.state !==
            "unknown"
    )
        ? `Generation task failed with state: ${result.state}`
        : "Generation task failed";
}


/* =========================================================
   UPDATE GENERATION HISTORY
   ---------------------------------------------------------
   History dibuat oleh:
       /api/generate.js
 *
   Endpoint ini TIDAK membuat row baru.
 *
   MATCH:
       user_id
       task_id
 *
   STATUS:
       processing -> completed
       processing -> failed
 *
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


    /*
     * =====================================================
     * PROCESSING
     * =====================================================
     *
     * Jangan PATCH selama task masih berjalan.
     */

    if (
        result?.processing
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


    /*
     * =====================================================
     * MATCH ROW
     * =====================================================
     *
     * HANYA row milik user yang sedang login.
     */

    const params =
        new URLSearchParams();


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


    /*
     * =====================================================
     * COMPLETED
     * ===================================================== */

    if (
        result?.completed
    ) {

        const resultUrl =
            Array.isArray(
                result.resultUrls
            ) &&
            result.resultUrls.length
                ? normalizeString(
                    result.resultUrls[0]
                )
                : null;


        /*
         * Jangan menulis completed tanpa hasil URL
         * apabila adapter sudah menyatakan completed.
         *
         * Tetap izinkan completed karena beberapa provider
         * dapat memberikan hasil melalui struktur lain.
         */

        const payload = {

            status:
                "completed",

            result_url:
                resultUrl,

            error_message:
                null,

            completed_at:
                new Date().toISOString()

        };


        const rows =
            await supabaseRequest(
                `/rest/v1/generation_history?${params.toString()}`,
                {
                    method:
                        "PATCH",

                    headers: {

                        Prefer:
                            "return=representation"

                    },

                    body:
                        JSON.stringify(
                            payload
                        )
                }
            );


        const updated =
            Array.isArray(
                rows
            )
                ? rows.length >
                    0
                : false;


        return {

            updated,

            matched:
                updated,

            status:
                "completed",

            result_url:
                resultUrl

        };
    }


    /*
     * =====================================================
     * FAILED
     * ===================================================== */

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


        const rows =
            await supabaseRequest(
                `/rest/v1/generation_history?${params.toString()}`,
                {
                    method:
                        "PATCH",

                    headers: {

                        Prefer:
                            "return=representation"

                    },

                    body:
                        JSON.stringify(
                            payload
                        )
                }
            );


        const updated =
            Array.isArray(
                rows
            )
                ? rows.length >
                    0
                : false;


        return {

            updated,

            matched:
                updated,

            status:
                "failed",

            error_message:
                errorMessage

        };
    }


    /*
     * =====================================================
     * UNKNOWN
     * =====================================================
     */

    return {

        updated:
            false,

        matched:
            false,

        status:
            result?.state ||
            "unknown",

        reason:
            "no_terminal_state"

    };
}


/* =========================================================
   HISTORY DIAGNOSTIC
   ---------------------------------------------------------
   Tidak mengandung credential.
========================================================= */

function createHistoryDiagnostic(
    result,
    historyResult
) {

    return {

        task_state:
            result?.state ||
            "unknown",

        provider_completed:
            Boolean(
                result?.completed
            ),

        provider_failed:
            Boolean(
                result?.failed
            ),

        provider_processing:
            Boolean(
                result?.processing
            ),

        has_result:
            Boolean(
                result?.hasResult
            ),

        result_count:
            Array.isArray(
                result?.resultUrls
            )
                ? result.resultUrls.length
                : 0,

        history_updated:
            Boolean(
                historyResult?.updated
            ),

        history_status:
            historyResult?.status ||
            "unknown"

    };
}


/* =========================================================
   HANDLER
========================================================= */

export default async function handler(
    req,
    res
) {

    /*
     * =====================================================
     * METHOD
     * =====================================================
     */

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


    /*
     * =====================================================
     * SERVER CONFIG
     * =====================================================
     */

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


    /*
     * =====================================================
     * AUTH
     * =====================================================
     */

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


    /*
     * =====================================================
     * BODY
     * =====================================================
     */

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


    /*
     * =====================================================
     * MODEL ID
     * =====================================================
     */

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


    /*
     * =====================================================
     * TASK ID
     * =====================================================
     */

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


    /*
     * =====================================================
     * MODEL ADAPTER
     * =====================================================
     */

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


    /*
     * =====================================================
     * OPTIONAL DATABASE MODEL
     * =====================================================
     */

    let databaseModel =
        null;


    try {

        databaseModel =
            await loadDatabaseModel(
                modelId
            );

    } catch (error) {

        console.warn(
            "[generate-status] Database model config unavailable:",
            error
        );
    }


    /*
     * =====================================================
     * MODEL STATUS
     * =====================================================
     */

    if (
        databaseModel
    ) {

        const status =
            normalizeString(
                databaseModel.status
            ).toLowerCase();


        if (
            status &&
            status !==
                "active"
        ) {

            return failure(
                res,
                409,
                "Model is not active",
                {
                    model_id:
                        modelId,

                    status:
                        databaseModel.status
                }
            );
        }
    }


    /*
     * =====================================================
     * PROVIDER
     * =====================================================
     */

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


    /*
     * =====================================================
     * PROVIDER CODE
     * =====================================================
     */

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


    /*
     * =====================================================
     * PROVIDER API KEY
     * =====================================================
     */

    let providerApiKey;


    try {

        providerApiKey =
            await loadProviderApiKey(
                providerCode
            );

    } catch (error) {

        console.error(
            "[generate-status] Provider credential error:",
            error.message
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


    /*
     * =====================================================
     * QUERY TASK
     * =====================================================
     */

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
            error
        );


        const providerStatus =
            Number(
                error?.status
            );


        let statusCode =
            502;


        if (
            providerStatus >= 400 &&
            providerStatus <= 599
        ) {

            statusCode =
                providerStatus;
        }


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


    /*
     * =====================================================
     * NORMALIZE PROVIDER RESPONSE
     * =====================================================
     */

    const result =
        normalizeTaskResponse(
            taskResponse,
            taskId
        );


    /*
     * =====================================================
     * GENERATION HISTORY
     * =====================================================
     *
     * HANYA UPDATE.
     *
     * Tidak pernah INSERT.
     *
     * MATCH:
     *
     * user_id + task_id
     *
     * Dengan demikian task user lain tidak dapat
     * mengubah History user ini.
     */

    let historyUpdated =
        false;


    let historyStatus =
        result.processing
            ? "processing"
            : result.completed
                ? "completed"
                : result.failed
                    ? "failed"
                    : "unknown";


    let historyResult =
        null;


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


        /*
         * =================================================
         * LOG TERMINAL UPDATE
         * =================================================
         */

        if (
            result.completed ||
            result.failed
        ) {

            const diagnostic =
                createHistoryDiagnostic(
                    result,
                    historyResult
                );


            if (
                historyUpdated
            ) {

                console.info(
                    "[generate-status] generation_history synchronized:",
                    {
                        user_id:
                            user.id,

                        task_id:
                            taskId,

                        status:
                            historyStatus,

                        diagnostic
                    }
                );

            } else {

                console.warn(
                    "[generate-status] Terminal task detected but generation_history row was not updated:",
                    {
                        user_id:
                            user.id,

                        task_id:
                            taskId,

                        status:
                            historyStatus,

                        diagnostic
                    }
                );
            }
        }

    } catch (historyError) {

        /*
         * Jangan membuat status provider gagal hanya
         * karena database History gagal di-update.
         *
         * Browser tetap harus mendapatkan status task.
         */

        console.error(
            "[generate-status] generation_history synchronization failed:",
            historyError
        );
    }


    /*
     * =====================================================
     * RESPONSE
     * =====================================================
     *
     * API key / credential TIDAK PERNAH dikirim.
     */

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
                historyStatus

        }
    );
}
