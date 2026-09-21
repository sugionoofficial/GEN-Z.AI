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
   ---------------------------------------------------------
   Registry adalah daftar model yang tersedia di repository.
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

    /*
     * Vercel biasanya sudah mem-parsing req.body.
     */

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

    /*
     * Format utama:
     *
     * {
     *   model_id: "...",
     *   parameters: {...}
     * }
     */

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


    /*
     * Compatibility fallback.
     *
     * Parameter tetap dibatasi.
     */

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
   ---------------------------------------------------------
   Supabase models BUKAN source of truth model.
   Row ini hanya konfigurasi administratif.
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

        /*
         * Admin config gagal dibaca tidak boleh
         * mengubah model repository menjadi
         * "Model not found".
         */

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
   ---------------------------------------------------------
   Digunakan ketika model belum mempunyai row
   administratif di tabel models.
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


    /*
     * Primary lookup:
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
     * Compatibility fallback:
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
   ---------------------------------------------------------
   Prioritas:
 *
 *   1. models.provider_id
 *   2. model config providerId
 *
 * Model folder tetap menjadi fallback agar
 * model repository bisa berjalan walaupun row
 * models belum dibuat.
 * ========================================================= */

async function resolveProvider(
    adapter,
    databaseModel
) {

    /*
     * =====================================================
     * PRIORITAS 1
     * Supabase models.provider_id
     * =====================================================
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

            return {
                provider,
                error:
                    null
            };

        }

    }


    /*
     * =====================================================
     * PRIORITAS 2
     * Model folder config.js
     * =====================================================
     */

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
         * fallback
         */

    }


    /*
     * Deterministic SHA-256 fallback.
     */

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
             * fallback
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
                 * Bukan encrypted format.
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
   ---------------------------------------------------------
   SOURCE OF TRUTH:
       public.provider_credentials

   SCHEMA:
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


    /* =====================================================
       QUERY CREDENTIAL
       ===================================================== */

    const params =
        new URLSearchParams();


    /*
     * Jangan menggunakan select=*.
     *
     * Hanya ambil field credential yang memang
     * diperlukan server.
     */

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
            "[generate] Failed reading provider_credentials:",
            error
        );

        throw new Error(
            `Failed to read provider credential for ${normalizedProviderCode}`
        );

    }


    /* =====================================================
       VALIDATE ROW
       ===================================================== */

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


    /* =====================================================
       READ ENCRYPTED FIELDS
       ===================================================== */

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


    /* =====================================================
       VALIDATE ENCRYPTED DATA
       ===================================================== */

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


    /* =====================================================
       DECODE
       ===================================================== */

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


    /* =====================================================
       DECRYPT
       ===================================================== */

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


    /* =====================================================
       VALIDATE PLAINTEXT
       ===================================================== */

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


    /*
     * Jangan pernah console.log API key.
     */

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
         *
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
   ---------------------------------------------------------
   Supabase hanya boleh memberikan restriction tambahan.
   Technical source tetap parameters.js.
   ========================================================= */

function validateDatabaseRestrictions(
    model,
    parameters
) {

    const errors = [];


    /*
     * Jika tidak ada row admin,
     * tidak ada restriction database.
     */

    if (!model) {

        return errors;

    }


    /*
     * Duration.
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

            const min =
                Number(
                    model.min_duration
                );


            const max =
                Number(
                    model.max_duration
                );


            if (
                Number.isFinite(
                    min
                ) &&
                duration < min
            ) {

                errors.push(
                    `duration must be at least ${min} seconds`
                );

            }


            if (
                Number.isFinite(
                    max
                ) &&
                duration > max
            ) {

                errors.push(
                    `duration must be at most ${max} seconds`
                );

            }

        }

    }


    /*
     * Ratio.
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
     * Resolution.
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
   task_id adalah hasil createTask, bukan input user.
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
     *
     * INI TITIK PENTING.
     *
     * Model dicari dari repository,
     * bukan dari Supabase models.
     *
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
     *
     * Tidak wajib.
     *
     * Model repo tetap valid tanpa row database.
     *
     */

    let databaseModel =
        null;


    try {

        databaseModel =
            await loadDatabaseModel(
                modelId
            );

    } catch (error) {

        /*
         * Jangan gagal hanya karena konfigurasi
         * administratif tidak tersedia.
         */

        console.warn(
            "[generate] Optional admin model config unavailable:",
            error
        );

    }


    /*
     * =====================================================
     * MODEL STATUS
     * =====================================================
     *
     * Tanpa row:
     *
     *   active
     *
     * Dengan row:
     *
     *   status database dihormati.
     *
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
     *
     * Prioritas:
     *
     *   models.provider_id
     *
     * atau:
     *
     *   config.providerId
     *
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
            "Failed to load provider configuration"
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
            "[generate] Provider credential error:",
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
     * CREATE TASK
     * =====================================================
     *
     * Server only.
     *
     * API key tidak pernah dikirim
     * ke browser.
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


        const providerStatus =
            Number(
                error.status
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
            error.message ||
                "Failed to create generation task",
            {

                code:
                    error.code ||
                    "GENERATION_CREATE_FAILED"

            }
        );

    }


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

        null;


    if (!taskId) {

        console.error(
            "[generate] Provider response has no taskId"
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
     * =====================================================
     * RESPONSE
     * =====================================================
     *
     * Jangan kirim credential.
     */

    return success(
        res,
        {

            user_id:
                user.id,


            /*
             * Model identity.
             *
             * Source:
             * repository config.js
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
             * Database config ID jika ada.
             */

            model_database_id:
                databaseModel?.id ||
                null

        }
    );

}
