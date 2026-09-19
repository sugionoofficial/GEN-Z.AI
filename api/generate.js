/**
 * =========================================================
 * GEN-Z.AI
 * GENERATE API
 * ---------------------------------------------------------
 * Endpoint:
 *   POST /api/generate
 *
 * Flow:
 *
 * User
 *   ↓
 * Authenticate Supabase
 *   ↓
 * models
 *   ↓
 * providers
 *   ↓
 * provider_credentials
 *   ↓
 * model adapter
 *   ↓
 * KIE.AI
 *   ↓
 * taskId
 *
 * =========================================================
 *
 * IMPORTANT:
 * - Tidak menggunakan tabel kie_*
 * - models.provider_id -> providers.id
 * - provider_credentials.provider_id
 *   -> providers.provider_id
 *
 * =========================================================
 */

import crypto from "crypto";

import grokImagineImageToVideo
    from "../models/grok-imagine-image-to-video/index.js";

import { createTask } from "../provider/kie/client.js";

/* =========================================================
   ENVIRONMENT
========================================================= */

const SUPABASE_URL = String(
    process.env.SUPABASE_URL || ""
)
    .trim()
    .replace(/\/+$/, "");

const SUPABASE_SERVICE_ROLE_KEY = String(
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
).trim();

const PROVIDER_CREDENTIAL_ENCRYPTION_KEY = String(
    process.env.PROVIDER_CREDENTIAL_ENCRYPTION_KEY || ""
).trim();

/* =========================================================
   MODEL REGISTRY
========================================================= */

const MODEL_REGISTRY = {
    "grok-imagine/image-to-video":
        grokImagineImageToVideo
};

/* =========================================================
   RESPONSE HELPERS
========================================================= */

function json(res, statusCode, data) {
    res.statusCode = statusCode;

    res.setHeader(
        "Content-Type",
        "application/json; charset=utf-8"
    );

    res.setHeader(
        "Cache-Control",
        "no-store"
    );

    return res.end(
        JSON.stringify(data)
    );
}

function success(res, data = {}) {
    return json(res, 200, {
        success: true,
        ...data
    });
}

function failure(
    res,
    statusCode,
    message,
    extra = {}
) {
    return json(res, statusCode, {
        success: false,
        error: message,
        ...extra
    });
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

    const response = await fetch(
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
            data = JSON.parse(text);
        } catch {
            data = text;
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
            new Error(message);

        error.status =
            response.status;

        error.data = data;

        throw error;
    }

    return data;
}

/* =========================================================
   AUTHENTICATE USER
========================================================= */

async function authenticateUser(req) {
    const authorization =
        String(
            req.headers?.authorization ||
            req.headers?.Authorization ||
            ""
        ).trim();

    if (!authorization) {
        const error =
            new Error(
                "Authorization header is required"
            );

        error.status = 401;

        throw error;
    }

    const match =
        authorization.match(
            /^Bearer\s+(.+)$/i
        );

    if (!match) {
        const error =
            new Error(
                "Invalid Authorization header"
            );

        error.status = 401;

        throw error;
    }

    const accessToken =
        match[1].trim();

    if (!accessToken) {
        const error =
            new Error(
                "Access token is missing"
            );

        error.status = 401;

        throw error;
    }

    const user =
        await supabaseRequest(
            "/auth/v1/user",
            {
                method: "GET",

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
        const error =
            new Error(
                "Invalid or expired session"
            );

        error.status = 401;

        throw error;
    }

    return user;
}

/* =========================================================
   REQUEST BODY
========================================================= */

async function readBody(req) {
    if (
        req.body &&
        typeof req.body === "object"
    ) {
        return req.body;
    }

    let body = "";

    for await (
        const chunk of req
    ) {
        body += chunk;
    }

    if (!body.trim()) {
        return {};
    }

    try {
        return JSON.parse(body);
    } catch {
        const error =
            new Error(
                "Request body must be valid JSON"
            );

        error.status = 400;

        throw error;
    }
}

/* =========================================================
   ARRAY NORMALIZER
========================================================= */

function normalizeArray(value) {
    if (Array.isArray(value)) {
        return value;
    }

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return [];
    }

    if (typeof value === "string") {
        const trimmed =
            value.trim();

        if (!trimmed) {
            return [];
        }

        /*
         * PostgreSQL array:
         * {"2:3","9:16"}
         */
        if (
            trimmed.startsWith("{") &&
            trimmed.endsWith("}")
        ) {
            const content =
                trimmed.slice(
                    1,
                    -1
                ).trim();

            if (!content) {
                return [];
            }

            return content
                .split(",")
                .map(
                    item =>
                        item
                            .trim()
                            .replace(
                                /^"(.*)"$/,
                                "$1"
                            )
                )
                .filter(Boolean);
        }

        /*
         * JSON array
         */
        if (
            trimmed.startsWith("[") &&
            trimmed.endsWith("]")
        ) {
            try {
                const parsed =
                    JSON.parse(trimmed);

                if (
                    Array.isArray(
                        parsed
                    )
                ) {
                    return parsed;
                }
            } catch {
                // lanjut
            }
        }

        /*
         * Comma separated
         */
        return trimmed
            .split(",")
            .map(
                item =>
                    item.trim()
            )
            .filter(Boolean);
    }

    return [];
}

/* =========================================================
   NUMBER
========================================================= */

function toNumber(value) {
    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return null;
    }

    const number =
        Number(value);

    return Number.isFinite(number)
        ? number
        : null;
}

/* =========================================================
   NORMALIZE MODEL INPUT
========================================================= */

function getModelId(body) {
    return String(
        body?.model_id ||
        body?.modelId ||
        body?.model ||
        ""
    ).trim();
}

function getParameters(body) {
    if (
        body &&
        body.parameters &&
        typeof body.parameters === "object" &&
        !Array.isArray(
            body.parameters
        )
    ) {
        return {
            ...body.parameters
        };
    }

    /*
     * Kompatibilitas dengan client
     * yang mengirim parameter langsung.
     */
    const parameters = {};

    const allowedKeys = [
        "image_urls",
        "task_id",
        "index",
        "prompt",
        "mode",
        "aspect_ratio",
        "duration",
        "resolution",
        "nsfw_checker"
    ];

    for (
        const key of allowedKeys
    ) {
        if (
            Object.prototype.hasOwnProperty.call(
                body || {},
                key
            )
        ) {
            parameters[key] =
                body[key];
        }
    }

    return parameters;
}

/* =========================================================
   LOAD MODEL
========================================================= */

async function loadModel(modelId) {
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

    const models =
        await supabaseRequest(
            `/rest/v1/models?${params.toString()}`,
            {
                method: "GET"
            }
        );

    if (
        !Array.isArray(models) ||
        models.length === 0
    ) {
        return null;
    }

    return models[0];
}

/* =========================================================
   LOAD PROVIDER
========================================================= */

async function loadProvider(
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
                method: "GET"
            }
        );

    if (
        !Array.isArray(
            providers
        ) ||
        providers.length === 0
    ) {
        return null;
    }

    return providers[0];
}

/* =========================================================
   ENCRYPTED CREDENTIAL DECRYPTION
========================================================= */

/*
 * Credential format yang didukung:
 *
 * 1. plaintext
 * 2. encrypted format:
 *
 *    iv:authTag:ciphertext
 *
 *    atau
 *
 *    iv:tag:data
 *
 * Encoding:
 * - hex
 * - base64
 *
 * AES-256-GCM
 */

function getEncryptionKey() {
    if (
        !PROVIDER_CREDENTIAL_ENCRYPTION_KEY
    ) {
        throw new Error(
            "PROVIDER_CREDENTIAL_ENCRYPTION_KEY is not configured"
        );
    }

    /*
     * Jika key berupa 64 karakter hex,
     * gunakan langsung sebagai 32-byte key.
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
     * Jika key base64 menghasilkan
     * tepat 32 byte.
     */
    try {
        const base64 =
            Buffer.from(
                PROVIDER_CREDENTIAL_ENCRYPTION_KEY,
                "base64"
            );

        if (
            base64.length === 32
        ) {
            return base64;
        }
    } catch {
        // lanjut
    }

    /*
     * Fallback deterministic.
     *
     * Ini menjaga kompatibilitas jika
     * environment berisi string biasa.
     */
    return crypto
        .createHash("sha256")
        .update(
            PROVIDER_CREDENTIAL_ENCRYPTION_KEY
        )
        .digest();
}

function decodeBuffer(
    value
) {
    const text =
        String(value || "").trim();

    if (!text) {
        return null;
    }

    /*
     * Hex
     */
    if (
        /^[0-9a-fA-F]+$/.test(
            text
        ) &&
        text.length % 2 === 0
    ) {
        try {
            return Buffer.from(
                text,
                "hex"
            );
        } catch {
            // lanjut
        }
    }

    /*
     * Base64
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
        // lanjut
    }

    return null;
}

function decryptCredential(
    encryptedValue
) {
    if (
        encryptedValue === null ||
        encryptedValue === undefined
    ) {
        return null;
    }

    const value =
        String(
            encryptedValue
        ).trim();

    if (!value) {
        return null;
    }

    /*
     * JSON encrypted object.
     */
    if (
        value.startsWith("{") &&
        value.endsWith("}")
    ) {
        try {
            const parsed =
                JSON.parse(value);

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
            // lanjut
        }
    }

    /*
     * Colon separated:
     *
     * iv:tag:ciphertext
     */
    const parts =
        value.split(":");

    if (
        parts.length === 3
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
                // mungkin plaintext
            }
        }
    }

    /*
     * Jika bukan encrypted format,
     * anggap sebagai plaintext.
     *
     * Ini berguna untuk kompatibilitas
     * credential lama.
     */
    return value;
}

function decryptAesGcm(
    iv,
    authTag,
    ciphertext
) {
    const key =
        getEncryptionKey();

    if (
        key.length !== 32
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

/*
 * IMPORTANT:
 *
 * provider_credentials.provider_id
 * menggunakan providers.provider_id
 *
 * BUKAN providers.id.
 */
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
                method: "GET"
            }
        );

    if (
        !Array.isArray(
            credentials
        ) ||
        credentials.length === 0
    ) {
        throw new Error(
            `No provider credential found for ${providerCode}`
        );
    }

    /*
     * Pilih credential aktif terlebih dahulu.
     */
    const activeCredential =
        credentials.find(
            credential =>
                credential.status ===
                    "active" ||
                credential.is_active ===
                    true ||
                credential.active ===
                    true
        );

    const credential =
        activeCredential ||
        credentials[0];

    /*
     * Berbagai kemungkinan nama
     * kolom credential.
     */
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
            `Unable to decrypt provider API key for ${providerCode}`
        );
    }

    return apiKey.trim();
}

/* =========================================================
   MODEL DB VALIDATION
========================================================= */

function validateDatabaseRestrictions(
    model,
    parameters
) {
    const errors = [];

    /*
     * -------------------------------------------------------
     * DURATION
     * -------------------------------------------------------
     */

    if (
        parameters.duration !==
            undefined &&
        parameters.duration !==
            null &&
        parameters.duration !==
            ""
    ) {
        const duration =
            toNumber(
                parameters.duration
            );

        if (
            duration === null
        ) {
            errors.push(
                "duration must be a valid number"
            );
        } else {
            const minDuration =
                toNumber(
                    model.min_duration
                );

            const maxDuration =
                toNumber(
                    model.max_duration
                );

            if (
                minDuration !==
                    null &&
                duration <
                    minDuration
            ) {
                errors.push(
                    `duration must be at least ${minDuration} seconds`
                );
            }

            if (
                maxDuration !==
                    null &&
                duration >
                    maxDuration
            ) {
                errors.push(
                    `duration must be at most ${maxDuration} seconds`
                );
            }
        }
    }

    /*
     * -------------------------------------------------------
     * ASPECT RATIO
     * -------------------------------------------------------
     */

    if (
        parameters.aspect_ratio !==
            undefined &&
        parameters.aspect_ratio !==
            null &&
        parameters.aspect_ratio !==
            ""
    ) {
        const ratios =
            normalizeArray(
                model.supported_ratios
            );

        if (
            ratios.length > 0 &&
            !ratios.includes(
                String(
                    parameters.aspect_ratio
                )
            )
        ) {
            errors.push(
                `aspect_ratio is not supported. Allowed: ${ratios.join(", ")}`
            );
        }
    }

    /*
     * -------------------------------------------------------
     * RESOLUTION
     * -------------------------------------------------------
     */

    if (
        parameters.resolution !==
            undefined &&
        parameters.resolution !==
            null &&
        parameters.resolution !==
            ""
    ) {
        const resolutions =
            normalizeArray(
                model.supported_resolutions
            );

        if (
            resolutions.length > 0 &&
            !resolutions.includes(
                String(
                    parameters.resolution
                )
            )
        ) {
            errors.push(
                `resolution is not supported. Allowed: ${resolutions.join(", ")}`
            );
        }
    }

    return errors;
}

/* =========================================================
   ADAPTER VALIDATION
========================================================= */

function validateAdapterInput(
    adapter,
    parameters
) {
    if (
        !adapter ||
        typeof adapter.validate !==
            "function"
    ) {
        return [];
    }

    try {
        const result =
            adapter.validate(
                parameters
            );

        if (
            result === true ||
            result === undefined ||
            result === null
        ) {
            return [];
        }

        if (
            Array.isArray(result)
        ) {
            return result.map(
                item =>
                    String(item)
            );
        }

        if (
            typeof result ===
                "string"
        ) {
            return [
                result
            ];
        }

        if (
            result &&
            typeof result ===
                "object"
        ) {
            if (
                Array.isArray(
                    result.errors
                )
            ) {
                return result.errors.map(
                    item =>
                        String(item)
                );
            }

            if (
                result.error
            ) {
                return [
                    String(
                        result.error
                    )
                ];
            }
        }

        return [];
    } catch (err) {
        return [
            err.message ||
                "Invalid model parameters"
        ];
    }
}

/* =========================================================
   BUILD MODEL INPUT
========================================================= */

function sanitizeParameters(
    parameters
) {
    const allowedKeys = [
        "image_urls",
        "task_id",
        "index",
        "prompt",
        "mode",
        "aspect_ratio",
        "duration",
        "resolution",
        "nsfw_checker"
    ];

    const result = {};

    for (
        const key of allowedKeys
    ) {
        if (
            Object.prototype.hasOwnProperty.call(
                parameters,
                key
            )
        ) {
            result[key] =
                parameters[key];
        }
    }

    return result;
}

/* =========================================================
   HANDLER
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

        return failure(
            res,
            405,
            "Method not allowed"
        );
    }

    /*
     * -------------------------------------------------------
     * ENV CHECK
     * -------------------------------------------------------
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
     * -------------------------------------------------------
     * AUTH
     * -------------------------------------------------------
     */

    let user;

    try {
        user =
            await authenticateUser(
                req
            );
    } catch (err) {
        return failure(
            res,
            err.status || 401,
            err.message ||
                "Unauthorized"
        );
    }

    /*
     * -------------------------------------------------------
     * BODY
     * -------------------------------------------------------
     */

    let body;

    try {
        body =
            await readBody(req);
    } catch (err) {
        return failure(
            res,
            err.status || 400,
            err.message ||
                "Invalid request body"
        );
    }

    /*
     * -------------------------------------------------------
     * MODEL ID
     * -------------------------------------------------------
     */

    const modelId =
        getModelId(body);

    if (!modelId) {
        return failure(
            res,
            400,
            "model_id is required"
        );
    }

    /*
     * -------------------------------------------------------
     * PARAMETERS
     * -------------------------------------------------------
     */

    const rawParameters =
        getParameters(body);

    const parameters =
        sanitizeParameters(
            rawParameters
        );

    /*
     * -------------------------------------------------------
     * LOAD MODEL
     * -------------------------------------------------------
     */

    let model;

    try {
        model =
            await loadModel(
                modelId
            );
    } catch (err) {
        console.error(
            "[generate] Failed loading model:",
            err
        );

        return failure(
            res,
            500,
            "Failed to load model configuration"
        );
    }

    if (!model) {
        return failure(
            res,
            404,
            "Active model not found",
            {
                model_id:
                    modelId
            }
        );
    }

    /*
     * Double check status.
     */
    if (
        String(
            model.status || ""
        ).toLowerCase() !==
        "active"
    ) {
        return failure(
            res,
            409,
            "Model is not active"
        );
    }

    /*
     * -------------------------------------------------------
     * LOAD ADAPTER
     * -------------------------------------------------------
     */

    const adapter =
        MODEL_REGISTRY[
            model.model_id
        ];

    if (!adapter) {
        return failure(
            res,
            500,
            "Model adapter is not registered",
            {
                model_id:
                    model.model_id
            }
        );
    }

    /*
     * -------------------------------------------------------
     * DATABASE RESTRICTIONS
     * -------------------------------------------------------
     */

    const databaseErrors =
        validateDatabaseRestrictions(
            model,
            parameters
        );

    if (
        databaseErrors.length > 0
    ) {
        return failure(
            res,
            422,
            "Invalid model parameters",
            {
                errors:
                    databaseErrors
            }
        );
    }

    /*
     * -------------------------------------------------------
     * ADAPTER VALIDATION
     * -------------------------------------------------------
     */

    const adapterErrors =
        validateAdapterInput(
            adapter,
            parameters
        );

    if (
        adapterErrors.length > 0
    ) {
        return failure(
            res,
            422,
            "Invalid model parameters",
            {
                errors:
                    adapterErrors
            }
        );
    }

    /*
     * -------------------------------------------------------
     * PROVIDER
     * -------------------------------------------------------
     */

    let provider;

    try {
        provider =
            await loadProvider(
                model.provider_id
            );
    } catch (err) {
        console.error(
            "[generate] Failed loading provider:",
            err
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
            "Provider not found",
            {
                model_id:
                    model.model_id
            }
        );
    }

    /*
     * Provider harus aktif.
     */
    if (
        String(
            provider.status || ""
        ).toLowerCase() !==
        "active"
    ) {
        return failure(
            res,
            409,
            "Provider is not active",
            {
                provider_id:
                    provider.provider_id ||
                    null
            }
        );
    }

    /*
     * -------------------------------------------------------
     * PROVIDER MATCH
     * -------------------------------------------------------
     */

    const databaseProviderId =
        String(
            provider.provider_id ||
            ""
        ).trim();

    const adapterProviderId =
        String(
            adapter.config?.providerId ||
            ""
        ).trim();

    if (
        adapterProviderId &&
        databaseProviderId &&
        adapterProviderId !==
            databaseProviderId
    ) {
        return failure(
            res,
            409,
            "Model provider configuration mismatch",
            {
                database_provider_id:
                    databaseProviderId,

                adapter_provider_id:
                    adapterProviderId
            }
        );
    }

    /*
     * -------------------------------------------------------
     * PROVIDER API KEY
     * -------------------------------------------------------
     */

    let providerApiKey;

    try {
        providerApiKey =
            await loadProviderApiKey(
                databaseProviderId
            );
    } catch (err) {
        console.error(
            "[generate] Provider credential error:",
            err
        );

        return failure(
            res,
            500,
            "Provider API credential is unavailable"
        );
    }

    /*
     * -------------------------------------------------------
     * CREATE TASK
     * -------------------------------------------------------
     */

    let task;

    try {
        /*
         * Adapter menangani payload model.
         */
        task =
            await adapter.createTask(
                parameters,
                providerApiKey
            );
    } catch (adapterError) {
        console.error(
            "[generate] Adapter create task failed:",
            adapterError
        );

        /*
         * KIE client error status jika ada.
         */
        const providerStatus =
            Number(
                adapterError.status
            );

        let statusCode = 502;

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
            adapterError.message ||
                "Failed to create generation task",
            {
                code:
                    adapterError.code ||
                    "GENERATION_CREATE_FAILED"
            }
        );
    }

    /*
     * -------------------------------------------------------
     * TASK ID
     * -------------------------------------------------------
     */

    const taskId =
        task?.taskId ||
        task?.task_id ||
        task?.data?.taskId ||
        task?.data?.task_id ||
        null;

    if (!taskId) {
        console.error(
            "[generate] Provider response did not contain taskId"
        );

        return failure(
            res,
            502,
            "Provider did not return a task ID",
            {
                code:
                    "TASK_ID_MISSING"
            }
        );
    }

    /*
     * -------------------------------------------------------
     * RESPONSE
     * -------------------------------------------------------
     */

    return success(
        res,
        {
            model:
                model.model_id,

            model_id:
                model.model_id,

            model_name:
                model.model_name ||
                adapter.config?.name ||
                model.model_id,

            provider:
                provider.provider_name ||
                provider.name ||
                adapter.config?.providerName ||
                "",

            provider_id:
                databaseProviderId,

            taskId,

            task_id:
                taskId,

            jobId:
                taskId
        }
    );
}
