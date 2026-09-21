/**
 * =========================================================
 * GEN-Z.AI
 * GENERATE API
 * ---------------------------------------------------------
 * File:
 *   api/generate.js
 *
 * Endpoint:
 *   POST /api/generate
 *
 * =========================================================
 *
 * ARSITEKTUR
 *
 *   Frontend
 *      ↓
 *   POST /api/generate
 *      ↓
 *   Supabase Auth
 *      ↓
 *   MODEL REGISTRY
 *      ↓
 *   models/<model-folder>
 *      ├── config.js
 *      ├── parameters.js
 *      ├── create-task.js
 *      └── query-task.js
 *      ↓
 *   Optional Supabase admin config
 *      ↓
 *   Provider
 *      ↓
 *   provider_credentials
 *      ↓
 *   Provider API
 *      ↓
 *   taskId
 *
 *
 * MODEL SOURCE OF TRUTH
 *
 *   Repository model folder
 *
 *
 * ADMIN CONFIG SOURCE
 *
 *   Supabase models
 *
 *
 * PROVIDER SOURCE
 *
 *   Supabase providers
 *
 *
 * CREDENTIAL SOURCE
 *
 *   Supabase provider_credentials
 *
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
   SANITIZE PROVIDER RESPONSE
   ---------------------------------------------------------
   Response KIE.AI boleh dikirim sebagai diagnostic,
   tetapi credential rahasia WAJIB dihapus.
   ========================================================= */

function sanitizeProviderResponse(
    value,
    depth = 0
) {

    if (
        depth > 8
    ) {

        return "[MAX_DEPTH]";

    }


    const secretKeys =
        new Set([

            "apiKey",
            "api_key",
            "apikey",

            "authorization",
            "Authorization",

            "access_token",
            "accessToken",

            "token",

            "secret",

            "password",

            "credential",
            "credentials",

            "api_key_ciphertext",
            "api_key_iv",
            "api_key_tag",

            "SUPABASE_SERVICE_ROLE_KEY",
            "PROVIDER_CREDENTIAL_ENCRYPTION_KEY"

        ]);


    if (
        Array.isArray(
            value
        )
    ) {

        return value.map(
            item =>
                sanitizeProviderResponse(
                    item,
                    depth + 1
                )
        );

    }


    if (
        value &&
        typeof value ===
            "object"
    ) {

        const output = {};


        for (
            const [key, item]
            of Object.entries(
                value
            )
        ) {

            if (
                secretKeys.has(
                    key
                )
            ) {

                output[key] =
                    "[REDACTED]";

                continue;

            }


            output[key] =
                sanitizeProviderResponse(
                    item,
                    depth + 1
                );

        }


        return output;

    }


    if (
        typeof value ===
            "string"
    ) {

        return value
            .replace(
                /Bearer\s+[^\s"']+/gi,
                "Bearer [REDACTED]"
            )
            .replace(
                /sk-[A-Za-z0-9._-]+/g,
                "[REDACTED]"
            );

    }


    return value;

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
   GET PARAMETERS
   ========================================================= */

function getParameters(
    body
) {

    if (
        body &&
        body.parameters &&
        typeof body.parameters ===
            "object" &&
        !Array.isArray(
            body.parameters
        )
    ) {

        return {
            ...body.parameters
        };

    }


    const parameters = {};


    const allowedKeys = [

        "image_urls",

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
   MODEL REGISTRY LOOKUP
   ========================================================= */

function getModelAdapter(
    modelId
) {

    if (!modelId) {

        return null;

    }


    const normalizedId =
        String(
            modelId
        ).trim();


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
   LOAD OPTIONAL DATABASE MODEL
   ========================================================= */

async function loadDatabaseModel(
    modelId
) {

    if (
        !SUPABASE_URL ||
        !SUPABASE_SERVICE_ROLE_KEY
    ) {

        return null;

    }


    if (!modelId) {

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
            "[generate] Failed loading optional admin model config:",
            error
        );


        return null;

    }

}


/* =========================================================
   PROVIDER LOOKUP BY DATABASE ID
   ========================================================= */

async function loadProviderByDatabaseId(
    providerDatabaseId
) {

    if (
        !providerDatabaseId
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
   PROVIDER LOOKUP BY PROVIDER CODE
   ========================================================= */

async function loadProviderByCode(
    providerCode
) {

    if (!providerCode) {

        return null;

    }


    const normalizedCode =
        String(
            providerCode
        ).trim();


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

            return {
                provider,
                error:
                    null
            };

        }

    }


    const registryProviderId =
        String(
            adapter?.config?.providerId ||
            ""
        ).trim();


    if (
        registryProviderId
    ) {

        const provider =
            await loadProviderByCode(
                registryProviderId
            );


        if (provider) {

            return {
                provider,
                error:
                    null
            };

        }


        return {

            provider:
                null,

            error:
                "Provider not found",

            details: {

                provider_id:
                    registryProviderId

            }

        };

    }


    return {

        provider:
            null,

        error:
            "Model provider is not configured"

    };

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
         * fallback
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
             * fallback
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
         * fallback
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
   LOAD PROVIDER API KEY
   ---------------------------------------------------------
   SOURCE OF TRUTH:
       public.provider_credentials

   EXACT SCHEMA:
       provider_id
       api_key_ciphertext
       api_key_iv
       api_key_tag

   SECURITY:
   - API key hanya dibaca server-side
   - API key didekripsi server-side
   - API key tidak pernah dikirim ke frontend
   - Tidak menggunakan kolom api_key lama
   ========================================================= */

async function loadProviderApiKey(
    providerCode
) {

    const normalizedProviderCode =
        String(
            providerCode || ""
        ).trim();


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
            "api_key_tag"
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
            "[generate] Failed reading provider_credentials:",
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
        String(
            credential.api_key_ciphertext ||
            ""
        ).trim();


    const iv =
        String(
            credential.api_key_iv ||
            ""
        ).trim();


    const authTag =
        String(
            credential.api_key_tag ||
            ""
        ).trim();


    if (
        !ciphertext
    ) {

        throw new Error(
            `Provider credential ciphertext is empty for ${normalizedProviderCode}`
        );

    }


    if (
        !iv
    ) {

        throw new Error(
            `Provider credential IV is empty for ${normalizedProviderCode}`
        );

    }


    if (
        !authTag
    ) {

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
            "[generate] Failed decoding provider credential:",
            error
        );


        throw new Error(
            `Invalid encrypted provider credential format for ${normalizedProviderCode}`
        );

    }


    if (
        !ivBuffer
    ) {

        throw new Error(
            `Provider credential IV could not be decoded for ${normalizedProviderCode}`
        );

    }


    if (
        !authTagBuffer
    ) {

        throw new Error(
            `Provider credential authentication tag could not be decoded for ${normalizedProviderCode}`
        );

    }


    if (
        !ciphertextBuffer
    ) {

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
            "[generate] Provider credential decryption failed:",
            error
        );


        throw new Error(
            `Unable to decrypt provider API credential for ${normalizedProviderCode}`
        );

    }


    const normalizedApiKey =
        String(
            apiKey || ""
        ).trim();


    if (
        !normalizedApiKey
    ) {

        throw new Error(
            `Decrypted provider API key is empty for ${normalizedProviderCode}`
        );

    }


    console.debug(
        "[generate] Provider API credential resolved successfully:",
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
   ARRAY NORMALIZER
   ========================================================= */

function normalizeArray(
    value
) {

    if (
        Array.isArray(
            value
        )
    ) {

        return [
            ...new Set(
                value
                    .map(
                        item =>
                            String(
                                item ?? ""
                            ).trim()
                    )
                    .filter(Boolean)
            )
        ];

    }


    if (
        value === null ||
        value === undefined
    ) {

        return [];

    }


    if (
        typeof value ===
        "string"
    ) {

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
                trimmed
                    .slice(
                        1,
                        -1
                    )
                    .trim();


            if (!content) {

                return [];

            }


            return [
                ...new Set(
                    content
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
                        .filter(Boolean)
                )
            ];

        }


        /*
         * JSON array.
         */

        if (
            trimmed.startsWith("[") &&
            trimmed.endsWith("]")
        ) {

            try {

                const parsed =
                    JSON.parse(
                        trimmed
                    );


                if (
                    Array.isArray(
                        parsed
                    )
                ) {

                    return normalizeArray(
                        parsed
                    );

                }

            } catch {

                /*
                 * fallback
                 */

            }

        }


        /*
         * CSV.
         */

        return [
            ...new Set(
                trimmed
                    .split(",")
                    .map(
                        item =>
                            item.trim()
                    )
                    .filter(Boolean)
            )
        ];

    }


    return [];

}


/* =========================================================
   DATABASE PARAMETER RESTRICTION
   ========================================================= */

function validateDatabaseRestrictions(
    model,
    parameters
) {

    const errors = [];


    if (!model) {

        return errors;

    }


    /*
     * =====================================================
     * DURATION
     * =====================================================
     *
     * Database duration values are optional restrictions.
     *
     * Value:
     *
     *   > 0  = valid restriction
     *   0    = not configured
     *   < 0  = not configured
     *
     * IMPORTANT:
     *
     * max_duration = 0 MUST NOT mean:
     *
     *     duration must be at most 0 seconds
     *
     * KIE/model registry remains the source of truth
     * for the actual model capability.
     *
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
            Number(
                parameters.duration
            );


        if (
            !Number.isFinite(
                duration
            )
        ) {

            errors.push(
                "duration must be a valid number"
            );

        } else {

            const rawMin =
                Number(
                    model.min_duration
                );


            const rawMax =
                Number(
                    model.max_duration
                );


            /*
             * Only positive values are treated
             * as actual database restrictions.
             */

            const min =
                Number.isFinite(
                    rawMin
                ) &&
                rawMin > 0
                    ? rawMin
                    : null;


            const max =
                Number.isFinite(
                    rawMax
                ) &&
                rawMax > 0
                    ? rawMax
                    : null;


            /*
             * Minimum duration.
             */

            if (
                min !== null &&
                duration < min
            ) {

                errors.push(
                    `duration must be at least ${min} seconds`
                );

            }


            /*
             * Maximum duration.
             */

            if (
                max !== null &&
                duration > max
            ) {

                errors.push(
                    `duration must be at most ${max} seconds`
                );

            }

        }

    }


    /* =====================================================
       RATIO
       ===================================================== */

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


    /* =====================================================
       RESOLUTION
       ===================================================== */

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
        Array.isArray(
            result
        )
    ) {

        return result.map(
            item =>
                String(
                    item
                )
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
                    String(
                        item
                    )
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


        if (
            result.valid ===
            false
        ) {

            return [
                "Invalid model parameters"
            ];

        }

    }


    return [];

}


/* =========================================================
   SANITIZE PARAMETERS
   ---------------------------------------------------------
   task_id SENGAJA tidak termasuk.
   task_id adalah hasil createTask.
   ========================================================= */

function sanitizeParameters(
    parameters
) {

    const allowedKeys = [

        "image_urls",

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
     * MODEL REGISTRY
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


    /*
     * =====================================================
     * MODEL CONFIG
     * =====================================================
     */

    const modelConfig =
        adapter.config ||
        {};


    const adapterModelId =
        String(
            modelConfig.id ||
            ""
        ).trim();


    if (
        !adapterModelId
    ) {

        return failure(
            res,
            500,
            "Model configuration is invalid",
            {

                model_id:
                    modelId

            }
        );

    }


    if (
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
     * OPTIONAL ADMIN CONFIG
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
            "[generate] Optional admin model config unavailable:",
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
     * PARAMETERS
     * =====================================================
     */

    const rawParameters =
        getParameters(
            body
        );


    const parameters =
        sanitizeParameters(
            rawParameters
        );


    /*
     * =====================================================
     * DATABASE RESTRICTIONS
     * =====================================================
     */

    const databaseErrors =
        validateDatabaseRestrictions(
            databaseModel,
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
     * =====================================================
     * ADAPTER VALIDATION
     * =====================================================
     */

    let adapterErrors;


    try {

        adapterErrors =
            validateAdapterInput(
                adapter,
                parameters
            );

    } catch (error) {

        console.error(
            "[generate] Model validation failed:",
            error
        );


        return failure(
            res,
            422,
            "Invalid model parameters",
            {

                errors: [

                    error.message ||
                        "Invalid model parameters"

                ]

            }
        );

    }


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
     * =====================================================
     * PROVIDER
     * =====================================================
     */

    let providerResult;


    try {

        providerResult =
            await resolveProvider(
                adapter,
                databaseModel
            );

    } catch (error) {

        console.error(
            "[generate] Provider lookup failed:",
            error
        );


        return failure(
            res,
            500,
            "Failed to load provider configuration",
            {

                code:
                    "PROVIDER_LOOKUP_FAILED",

                details:
                    sanitizeProviderResponse(
                        error?.data ||
                        error?.message ||
                        null
                    )

            }
        );

    }


    if (
        providerResult.error
    ) {

        const providerError =
            providerResult.error;


        const statusCode =
            providerError ===
                "Provider is not active"

                ? 409

                : 404;


        return failure(
            res,
            statusCode,
            providerError,
            providerResult.details ||
                {}
        );

    }


    const provider =
        providerResult.provider;


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
            "Provider ID is missing",
            {

                code:
                    "PROVIDER_ID_MISSING"

            }
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
            "[generate] Provider credential error:",
            error.message
        );


        return failure(
            res,
            500,
            "Provider API credential is unavailable",
            {

                provider_id:
                    providerCode,

                code:
                    "PROVIDER_CREDENTIAL_UNAVAILABLE",

                details: {

                    message:
                        error.message

                }

            }
        );

    }


    /*
     * =====================================================
     * CREATE TASK
     * =====================================================
     *
     * API key hanya berada di server.
     *
     * Tidak pernah dikirim ke browser.
     *
     */

    let task;


    try {

        task =
            await adapter.createTask(
                parameters,
                providerApiKey
            );

    } catch (error) {

        console.error(
            "[generate] Adapter createTask failed:",
            error
        );


        /*
         * Provider adapter dapat mengirim:
         *
         * error.status
         * error.code
         * error.data
         * error.response
         * error.body
         *
         * Semua akan dibuat aman sebelum dikirim
         * ke frontend.
         */

        const providerStatus =
            Number(
                error?.status ||
                error?.statusCode ||
                error?.response?.status ||
                error?.response?.statusCode
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


        const providerResponse =
            error?.data ||
            error?.response?.data ||
            error?.response?.body ||
            error?.body ||
            error?.response ||
            null;


        return failure(
            res,
            statusCode,
            error?.message ||
                "Failed to create generation task",
            {

                code:
                    error?.code ||
                    "KIE_CREATE_TASK_FAILED",

                provider:
                    providerCode,

                provider_status:
                    providerStatus ||
                    null,

                provider_response:
                    sanitizeProviderResponse(
                        providerResponse
                    )

            }
        );

    }


    /*
     * =====================================================
     * NORMALIZE TASK RESPONSE
     * =====================================================
     */

    const safeTask =
        sanitizeProviderResponse(
            task
        );


    /*
     * =====================================================
     * TASK ID
     * =====================================================
     */

    const taskId =

        task?.taskId ||

        task?.task_id ||

        task?.data?.taskId ||

        task?.data?.task_id ||

        task?.data?.task?.taskId ||

        task?.data?.task?.task_id ||

        task?.jobId ||

        task?.job_id ||

        null;


    if (!taskId) {

        console.error(
            "[generate] Provider response has no taskId:",
            safeTask
        );


        return failure(
            res,
            502,
            "Provider did not return a task ID",
            {

                code:
                    "TASK_ID_MISSING",

                provider:
                    providerCode,

                provider_response:
                    safeTask

            }
        );

    }


    /*
     * =====================================================
     * RESPONSE
     * =====================================================
     *
     * Response frontend tidak mengandung credential.
     *
     * Provider response tetap diberikan sebagai
     * diagnostic agar error KIE.AI dapat dilihat.
     *
     */

    return success(
        res,
        {

            user_id:
                user.id,


            /*
             * Model.
             */

            model:
                modelConfig.id,

            model_id:
                modelConfig.id,

            model_name:
                modelConfig.name ||
                modelConfig.id,


            /*
             * Provider.
             */

            provider:
                provider.provider_name ||
                provider.name ||
                providerCode,

            provider_id:
                providerCode,


            /*
             * Task.
             */

            taskId,

            task_id:
                taskId,

            jobId:
                taskId,


            /*
             * Provider response diagnostic.
             *
             * Credential sudah disanitasi.
             */

            provider_response:
                safeTask,


            /*
             * Database config ID jika ada.
             */

            model_database_id:
                databaseModel?.id ||
                null

        }
    );

}
