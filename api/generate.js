/**

 * =========================================================
 * GEN-Z.AI
 * GENERATE API
 * ---------------------------------------------------------
 * Endpoint:
 *   POST /api/generate
 *
 * ARCHITECTURE
 *
 *   Request
 *      ↓
 *   Supabase Auth
 *      ↓
 *   Model Registry
 *      ↓
 *   Model Folder
 *      ↓
 *   Model Config
 *      ↓
 *   Provider
 *      ↓
 *   Provider Credential
 *      ↓
 *   Model Adapter
 *      ↓
 *   KIE.AI
 *      ↓
 *   taskId
 *
 * MODEL SOURCE OF TRUTH:
 *   models/<model-folder>/
 *
 * SUPABASE:
 *   - providers
 *   - provider_credentials
 *   - optional models administrative data
 *
 * Tidak menggunakan:
 *   - kie_models
 *   - kie_workflows
 *   - kie_workflow_variants
 *   - kie_parameters
 *   - kie_constraints
 *   - kie_dependencies
 *   - kie_pricing
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
   Model berikutnya cukup ditambahkan di sini.
   ========================================================= */

const MODEL_REGISTRY = Object.freeze({

    "grok-imagine/image-to-video":
        grokImagineImageToVideo

});


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

        const error =
            new Error(
                "Authorization header is required"
            );


        error.status =
            401;


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


        error.status =
            401;


        throw error;

    }


    const accessToken =
        match[1].trim();


    if (!accessToken) {

        const error =
            new Error(
                "Access token is missing"
            );


        error.status =
            401;


        throw error;

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

        const error =
            new Error(
                "Invalid or expired session"
            );


        error.status =
            401;


        throw error;

    }


    return user;

}


/* =========================================================
   REQUEST BODY
   ========================================================= */

async function readBody(
    req
) {

    /*
     * Vercel biasanya sudah
     * mem-parsing req.body.
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

        const error =
            new Error(
                "Request body must be valid JSON"
            );


        error.status =
            400;


        throw error;

    }

}


/* =========================================================
   MODEL ID
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
   PARAMETERS
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
     * Kompatibilitas dengan
     * frontend lama yang mungkin
     * mengirim parameter langsung.
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
   MODEL LOOKUP
   ========================================================= */

function getModelAdapter(
    modelId
) {

    if (!modelId) {

        return null;

    }


    return (

        MODEL_REGISTRY[
            modelId
        ] ||

        null

    );

}


/* =========================================================
   OPTIONAL DATABASE MODEL
   ---------------------------------------------------------
   Row models boleh ada atau tidak ada.
   Model folder tetap menjadi sumber utama.
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


    const params =
        new URLSearchParams();


    params.set(
        "select",
        "*"
    );


    /*
     * Jangan menggunakan encodeURIComponent()
     * di sini.
     *
     * URLSearchParams sudah melakukan
     * encoding sendiri.
     */

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
         * models adalah data administratif.
         *
         * Jangan menggagalkan generation
         * hanya karena row models belum ada.
         */

        console.warn(
            "[generate] Optional models row unavailable:",
            error.message
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
   PROVIDER RESOLUTION
   ========================================================= */

async function resolveProvider(
    adapter,
    databaseModel
) {

    const folderProviderCode =
        String(
            adapter?.config?.providerId ||
            ""
        ).trim();


    let provider = null;


    /*
     * Prioritas pertama:
     *
     * models.provider_id
     * ->
     * providers.id
     */

    if (
        databaseModel?.provider_id
    ) {

        provider =
            await loadProviderByDatabaseId(
                databaseModel.provider_id
            );

    }


    /*
     * Jika models row belum ada,
     * cari provider menggunakan
     * provider_id dari config model.
     */

    if (
        !provider &&
        folderProviderCode
    ) {

        provider =
            await loadProviderByCode(
                folderProviderCode
            );

    }


    if (!provider) {

        return {

            provider:
                null,

            error:
                "Provider not found"

        };

    }


    /*
     * Pastikan provider di DB
     * sesuai dengan provider yang
     * didefinisikan model folder.
     */

    const databaseProviderCode =
        String(
            provider.provider_id ||
            ""
        ).trim();


    if (
        folderProviderCode &&
        databaseProviderCode &&
        folderProviderCode !==
            databaseProviderCode
    ) {

        return {

            provider:
                null,

            error:
                "Model provider configuration mismatch",

            details: {

                model_provider:
                    folderProviderCode,

                database_provider:
                    databaseProviderCode

            }

        };

    }


    /*
     * Provider wajib active.
     */

    const providerStatus =
        String(
            provider.status ||
            ""
        )
            .trim()
            .toLowerCase();


    if (
        providerStatus !==
        "active"
    ) {

        return {

            provider:
                null,

            error:
                "Provider is not active",

            details: {

                provider_id:
                    databaseProviderCode,

                status:
                    provider.status ||
                    null

            }

        };

    }


    return {

        provider,

        error:
            null

    };

}


/* =========================================================
   CREDENTIAL KEY
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
        /* fallback */
    }


    /*
     * Fallback deterministic
     * SHA-256.
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
            /* fallback */
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
        /* fallback */
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
            /* fallback */
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
     * Fallback plaintext.
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


    /*
     * PENTING:
     *
     * provider_credentials.provider_id
     * menggunakan:
     *
     * providers.provider_id
     *
     * BUKAN:
     *
     * providers.id
     */

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


    /*
     * Cari field API key.
     *
     * Tidak mengirim credential
     * ke client.
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
            `Unable to resolve provider API key for ${providerCode}`
        );

    }


    return apiKey.trim();

}


/* =========================================================
   DATABASE PARAMETER RESTRICTION
   ========================================================= */

function validateDatabaseRestrictions(
    model,
    parameters
) {

    const errors = [];


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
     *
     * Hanya dibatasi jika row models
     * memang memiliki daftar ratio.
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
     * ENVIRONMENT
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
     * -------------------------------------------------------
     * BODY
     * -------------------------------------------------------
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
     * -------------------------------------------------------
     * MODEL ID
     * -------------------------------------------------------
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
     * -------------------------------------------------------
     * MODEL ADAPTER
     * -------------------------------------------------------
     */

    const adapter =
        getModelAdapter(
            modelId
        );


    if (!adapter) {

        return failure(
            res,
            404,
            "Model is not registered",
            {
                model_id:
                    modelId
            }
        );

    }


    /*
     * -------------------------------------------------------
     * MODEL FOLDER CONFIG
     * -------------------------------------------------------
     */

    const modelConfig =
        adapter.config ||
        {};


    /*
     * Pastikan ID adapter benar.
     */

    const adapterModelId =
        String(
            modelConfig.id ||
            ""
        ).trim();


    if (
        adapterModelId &&
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
     * -------------------------------------------------------
     * PARAMETERS
     * -------------------------------------------------------
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
     * -------------------------------------------------------
     * OPTIONAL SUPABASE MODEL
     * -------------------------------------------------------
     */

    let databaseModel = null;


    try {

        databaseModel =
            await loadDatabaseModel(
                modelId
            );

    } catch (error) {

        console.warn(
            "[generate] Could not load optional model row:",
            error.message
        );

    }


    /*
     * -------------------------------------------------------
     * DATABASE RESTRICTIONS
     * -------------------------------------------------------
     *
     * Hanya dilakukan jika row models
     * tersedia.
     */

    if (
        databaseModel
    ) {

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
         * Jika status DB secara eksplisit
         * bukan active, jangan generate.
         */

        const databaseStatus =
            String(
                databaseModel.status ||
                ""
            )
                .trim()
                .toLowerCase();


        if (
            databaseStatus &&
            databaseStatus !==
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
     * -------------------------------------------------------
     * ADAPTER VALIDATION
     * -------------------------------------------------------
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
     * -------------------------------------------------------
     * PROVIDER
     * -------------------------------------------------------
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

        return failure(
            res,
            providerResult.error ===
                "Provider is not active"
                ? 409
                : 404,

            providerResult.error,

            providerResult.details ||
                {}
        );

    }


    const provider =
        providerResult.provider;


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
     * -------------------------------------------------------
     * PROVIDER API KEY
     * -------------------------------------------------------
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
     * -------------------------------------------------------
     * CREATE TASK
     * -------------------------------------------------------
     *
     * Adapter model menangani:
     *
     * - buildInput()
     * - buildPayload()
     * - validation
     * - provider request
     *
     * Jadi generate.js tidak perlu tahu
     * struktur payload KIE secara detail.
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
     * -------------------------------------------------------
     * RESPONSE
     * -------------------------------------------------------
     */

    return success(
        res,
        {

            /*
             * User.
             */

            user_id:
                user.id,


            /*
             * Model.
             */

            model:
                modelId,

            model_id:
                modelId,

            model_name:
                modelConfig.name ||
                modelId,


            /*
             * Provider.
             */

            provider:
                provider.provider_name ||
                provider.name ||
                modelConfig.providerName ||
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
             * Optional DB model ID.
             */

            model_database_id:
                databaseModel?.id ||
                null

        }
    );

}
