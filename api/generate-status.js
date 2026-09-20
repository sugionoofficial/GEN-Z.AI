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
 * - Mengembalikan status task dan result
 *
 * Tidak bertanggung jawab:
 * - Membuat task baru
 * - Menyimpan API key ke browser
 * - Render UI
 * - Polling di browser
 * - Menentukan parameter generation
 * - Menulis generation_history
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
 *   status / result
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

    let data = null;

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

    let body = "";

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

    return String(
        body?.model_id ||
        body?.modelId ||
        body?.model ||
        ""
    ).trim();
}


/* =========================================================
   GET TASK ID
========================================================= */

function getTaskId(
    body
) {

    return String(
        body?.task_id ||
        body?.taskId ||
        body?.jobId ||
        body?.job_id ||
        ""
    ).trim();
}


/* =========================================================
   MODEL LOOKUP
========================================================= */

function getModelAdapter(
    modelId
) {

    const normalizedId =
        String(
            modelId || ""
        ).trim();

    if (!normalizedId) {
        return null;
    }

    return (
        MODEL_REGISTRY.find(
            adapter => {

                const adapterId =
                    String(
                        adapter?.config?.id ||
                        ""
                    ).trim();

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
   ---------------------------------------------------------
   Database model hanya konfigurasi administratif.
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
        String(
            providerCode || ""
        ).trim();

    if (!normalizedCode) {
        return null;
    }

    /*
     * Primary:
     *
     * providers.provider_id
     */

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
     *
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
     * config.providerId
     */

    const registryProviderId =
        String(
            adapter?.config?.providerId ||
            ""
        ).trim();

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
        String(
            value || ""
        ).trim();

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
        String(
            value
        ).trim();

    if (!text) {
        return null;
    }

    /*
     * JSON encrypted format:
     *
     * {
     *   iv,
     *   authTag,
     *   ciphertext
     * }
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

    if (!providerCode) {

        throw new Error(
            "Provider ID is missing"
        );
    }

    const params =
        new URLSearchParams();

    params.set(
        "select",
        "*"
    );

    params.set(
        "provider_id",
        `eq.${providerCode}`
    );

    params.set(
        "limit",
        "20"
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
        !Array.isArray(
            credentials
        ) ||
        !credentials.length
    ) {

        throw new Error(
            `No provider credential found for ${providerCode}`
        );
    }

    /*
     * Prioritas credential aktif.
     */

    const credential =
        credentials.find(
            item => {

                const status =
                    String(
                        item.status ||
                        ""
                    )
                        .trim()
                        .toLowerCase();

                return (
                    status ===
                        "active" ||

                    item.is_active ===
                        true ||

                    item.active ===
                        true
                );
            }
        ) ||
        credentials[0];

    const encryptedApiKey =

        credential.api_key ||

        credential.encrypted_api_key ||

        credential.credential ||

        credential.secret ||

        credential.value;

    if (
        !encryptedApiKey
    ) {

        throw new Error(
            `Provider credential exists but API key is empty for ${providerCode}`
        );
    }

    const apiKey =
        decryptCredential(
            encryptedApiKey
        );

    if (!apiKey) {

        throw new Error(
            `Unable to resolve provider API key for ${providerCode}`
        );
    }

    return apiKey.trim();
}


/* =========================================================
   NORMALIZE TASK RESPONSE
========================================================= */

function normalizeTaskResponse(
    response,
    requestedTaskId
) {

    const task =
        response?.task ||
        response?.data ||
        response ||
        {};

    const state =
        String(
            response?.state ||
            task?.state ||
            ""
        )
            .trim()
            .toLowerCase();

    const taskId =
        String(
            response?.taskId ||
            task?.taskId ||
            task?.task_id ||
            requestedTaskId ||
            ""
        ).trim();

    const resultJson =
        response?.resultJson ??
        task?.resultJson ??
        null;

    let parsedResult =
        resultJson;

    if (
        typeof resultJson ===
        "string"
    ) {

        try {

            parsedResult =
                JSON.parse(
                    resultJson
                );

        } catch {
            parsedResult =
                null;
        }
    }

    const resultUrls = [];

    /*
     * KIE format:
     *
     * resultJson:
     * {
     *   resultUrls: [...]
     * }
     */

    if (
        Array.isArray(
            response?.resultUrls
        )
    ) {

        resultUrls.push(
            ...response.resultUrls
        );
    }

    if (
        Array.isArray(
            task?.resultUrls
        )
    ) {

        resultUrls.push(
            ...task.resultUrls
        );
    }

    if (
        Array.isArray(
            parsedResult?.resultUrls
        )
    ) {

        resultUrls.push(
            ...parsedResult.resultUrls
        );
    }

    if (
        Array.isArray(
            parsedResult?.result_urls
        )
    ) {

        resultUrls.push(
            ...parsedResult.result_urls
        );
    }

    const uniqueResultUrls =
        [
            ...new Set(
                resultUrls
                    .filter(
                        url =>
                            typeof url ===
                                "string"
                    )
                    .map(
                        url =>
                            url.trim()
                    )
                    .filter(Boolean)
            )
        ];

    const normalizedState =
        state;

    const isSuccess =
        normalizedState ===
            "success" ||
        normalizedState ===
            "succeeded" ||
        normalizedState ===
            "completed" ||
        uniqueResultUrls.length >
            0;

    const isFailed =
        normalizedState ===
            "fail" ||
        normalizedState ===
            "failed" ||
        normalizedState ===
            "error" ||
        normalizedState ===
            "cancelled" ||
        normalizedState ===
            "canceled";

    const isProcessing =
        !isSuccess &&
        !isFailed;

    return {

        taskId,

        state:
            normalizedState ||
            "unknown",

        success:
            isSuccess,

        failed:
            isFailed,

        processing:
            isProcessing,

        resultJson:
            parsedResult,

        resultUrls:
            uniqueResultUrls,

        raw:
            response
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
     * MODEL
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
        String(
            modelConfig.id ||
            ""
        ).trim();

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
            String(
                databaseModel.status ||
                ""
            )
                .trim()
                .toLowerCase();

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
        String(
            provider.provider_id ||
            modelConfig.providerId ||
            ""
        ).trim();

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
     *
     * API key hanya digunakan server-side.
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
     * NORMALIZE
     * =====================================================
     */

    const result =
        normalizeTaskResponse(
            taskResponse,
            taskId
        );


    /*
     * =====================================================
     * SECURITY
     * =====================================================
     *
     * Jangan pernah mengembalikan:
     *
     * - providerApiKey
     * - credential
     * - encrypted credential
     * - provider_credentials row
     *
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
                result.taskId,

            taskId:
                result.taskId,

            state:
                result.state,

            processing:
                result.processing,

            completed:
                result.success,

            failed:
                result.failed,

            result_urls:
                result.resultUrls,

            resultUrls:
                result.resultUrls,

            result:
                result.resultJson
        }
    );
}
