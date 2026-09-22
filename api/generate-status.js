/* =========================================================
   GEN-Z.AI
   GENERATE STATUS API
   ---------------------------------------------------------
   File:
   api/generate-status.js

   Tanggung jawab:
   - Auth user
   - Load model
   - Resolve provider
   - Resolve provider code
   - Load encrypted provider credential
   - Decrypt provider credential
   - Resolve model adapter
   - Query provider task
   - Normalize provider response
   - Update generation_history
   - Verify update
   - Return status + diagnostics

   PENTING:
   - Adapter Grok menggunakan DEFAULT EXPORT.
   - Credential provider mengikuti pola generate.js.
   - provider_credentials dicari menggunakan provider_id.
   - Tidak menggunakan provider_name sebagai provider credential key.

   STATUS:
   - KIE/provider terminal state : completed
   - generation_history status  : success

   Status database yang valid:
   - queued
   - processing
   - success
   - failed
   - cancelled
   ========================================================= */

import crypto from "crypto";

import grokImagineImageToVideo
    from "../models/grok-imagine-image-to-video/index.js";


/* =========================================================
   CONSTANTS
   ========================================================= */

const MODEL_REGISTRY = [
    grokImagineImageToVideo
];


const COMPLETED_STATES = new Set([
    "completed",
    "complete",
    "success",
    "succeeded",
    "finished",
    "done"
]);


const FAILED_STATES = new Set([
    "failed",
    "failure",
    "error",
    "cancelled",
    "canceled",
    "rejected",
    "timeout",
    "timed_out"
]);


const PROCESSING_STATES = new Set([
    "processing",
    "running",
    "queued",
    "queue",
    "waiting",
    "pending",
    "submitted",
    "created",
    "in_progress",
    "in-progress"
]);


/* =========================================================
   ENVIRONMENT
   ========================================================= */

const SUPABASE_URL =
    String(
        process.env.SUPABASE_URL ||
        ""
    )
        .trim()
        .replace(
            /\/+$/,
            ""
        );


const SUPABASE_SERVICE_ROLE_KEY =
    String(
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        ""
    ).trim();


const SUPABASE_ANON_KEY =
    String(
        process.env.SUPABASE_ANON_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        ""
    ).trim();


const PROVIDER_CREDENTIAL_ENCRYPTION_KEY =
    String(
        process.env.PROVIDER_CREDENTIAL_ENCRYPTION_KEY ||
        ""
    ).trim();


/* =========================================================
   RESPONSE HELPERS
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


/* =========================================================
   BASIC HELPERS
   ========================================================= */

function cleanString(
    value
) {
    if (
        value === null ||
        value === undefined
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
            cleanString(value) !== ""
        ) {
            return value;
        }
    }

    return null;
}


function normalizeIdentifier(
    value
) {
    return lower(
        value
    )
        .replace(
            /^["']|["']$/g,
            ""
        )
        .replace(
            /\s+/g,
            ""
        )
        .replace(
            /\\/g,
            ""
        )
        .replace(
            /\/+/g,
            "/"
        );
}


function safeJson(
    value
) {
    try {
        return JSON.stringify(
            value
        );
    } catch {
        return "[unserializable]";
    }
}


/* =========================================================
   SUPABASE REQUEST
   ---------------------------------------------------------
   PENTING:
   - Empty response body dianggap valid.
   - Error Supabase dipertahankan lengkap.
   - Tidak pernah mengembalikan API key.
   ========================================================= */

async function supabaseRequest(
    path,
    options = {}
) {
    if (
        !SUPABASE_URL
    ) {
        throw new Error(
            "SUPABASE_URL is not configured"
        );
    }


    if (
        !SUPABASE_SERVICE_ROLE_KEY
    ) {
        throw new Error(
            "SUPABASE_SERVICE_ROLE_KEY is not configured"
        );
    }


    const method =
        String(
            options.method ||
            "GET"
        ).toUpperCase();


    const url =
        `${SUPABASE_URL}${path}`;


    const headers = {
        apikey:
            SUPABASE_SERVICE_ROLE_KEY,

        Authorization:
            `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,

        ...(
            options.headers ||
            {}
        )
    };


    if (
        options.body !== undefined &&
        options.body !== null &&
        !headers["Content-Type"] &&
        !headers["content-type"]
    ) {
        headers["Content-Type"] =
            "application/json";
    }


    let response;


    try {
        response =
            await fetch(
                url,
                {
                    ...options,

                    method,

                    headers
                }
            );
    } catch (networkError) {
        const error =
            new Error(
                networkError?.message ||
                "Supabase network request failed."
            );


        error.status =
            null;

        error.code =
            "SUPABASE_NETWORK_ERROR";

        error.details =
            null;

        error.hint =
            null;

        error.data =
            null;

        error.path =
            path;

        error.method =
            method;

        error.body =
            options.body ||
            null;


        throw error;
    }


    const responseText =
        await response.text();


    let responseData =
        null;


    /*
     * Empty body adalah response yang valid.
     */
    if (
        responseText &&
        responseText.trim()
    ) {
        try {
            responseData =
                JSON.parse(
                    responseText
                );
        } catch {
            responseData =
                responseText;
        }
    }


    if (
        !response.ok
    ) {
        const providerError =
            responseData &&
            typeof responseData ===
                "object"
                ? responseData
                : {};


        const errorMessage =
            firstDefined(
                providerError?.message,
                providerError?.error_description,
                providerError?.error,
                responseText,
                `Supabase request failed with status ${response.status}`
            );


        const error =
            new Error(
                cleanString(
                    errorMessage
                )
            );


        error.status =
            response.status;


        error.code =
            firstDefined(
                providerError?.code,
                providerError?.error_code,
                null
            );


        error.details =
            firstDefined(
                providerError?.details,
                null
            );


        error.hint =
            firstDefined(
                providerError?.hint,
                null
            );


        error.data =
            responseData;


        error.path =
            path;


        error.method =
            method;


        error.body =
            options.body ||
            null;


        console.error(
            "[generate-status] Supabase request failed:",
            {
                method,
                path,
                status:
                    error.status,
                code:
                    error.code,
                message:
                    error.message,
                details:
                    error.details,
                hint:
                    error.hint,
                data:
                    error.data
            }
        );


        throw error;
    }


    return responseData;
}


/* =========================================================
   ERROR DIAGNOSTICS
   ========================================================= */

function serializeError(
    error
) {
    if (
        !error
    ) {
        return null;
    }


    return {
        message:
            error?.message ||
            null,

        status:
            error?.status ??
            null,

        code:
            error?.code ||
            null,

        details:
            error?.details ||
            null,

        hint:
            error?.hint ||
            null,

        data:
            error?.data ??
            null,

        path:
            error?.path ||
            null,

        method:
            error?.method ||
            null,

        body:
            error?.body ??
            null,

        diagnostics:
            error?.diagnostics ??
            null
    };
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


    if (
        !authorization
    ) {
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


    if (
        !match
    ) {
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


    if (
        !accessToken
    ) {
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
                        SUPABASE_SERVICE_ROLE_KEY ||
                        SUPABASE_ANON_KEY
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


    return {
        id:
            user.id,

        email:
            user.email ||
            null,

        accessToken
    };
}


/* =========================================================
   LOAD MODEL
   ========================================================= */

async function loadModel(
    modelId
) {
    const normalizedModelId =
        cleanString(
            modelId
        );


    if (
        !normalizedModelId
    ) {
        throw new Error(
            "model_id wajib diisi."
        );
    }


    const params =
        new URLSearchParams();


    params.set(
        "model_id",
        `eq.${normalizedModelId}`
    );


    params.set(
        "select",
        "*"
    );


    params.set(
        "limit",
        "1"
    );


    const models =
        await supabaseRequest(
            `/rest/v1/models?${params.toString()}`,
            {
                method:
                    "GET"
            }
        );


    if (
        !Array.isArray(
            models
        ) ||
        !models.length
    ) {
        throw new Error(
            `Model "${normalizedModelId}" tidak ditemukan di database.`
        );
    }


    return models[0];
}


/* =========================================================
   LOAD PROVIDER BY DATABASE ID
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


    try {
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
    } catch {
        /*
         * Fallback ke provider_id.
         */
    }


    return null;
}


/* =========================================================
   LOAD PROVIDER BY CODE
   ========================================================= */

async function loadProviderByCode(
    providerCode
) {
    const normalizedCode =
        cleanString(
            providerCode
        );


    if (
        !normalizedCode
    ) {
        return null;
    }


    /*
     * PRIMARY:
     * providers.provider_id
     */
    try {
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
    } catch {
        /*
         * Lanjut fallback.
         */
    }


    /*
     * SECONDARY:
     * providers.provider_name
     */
    try {
        const params =
            new URLSearchParams();


        params.set(
            "select",
            "*"
        );


        params.set(
            "provider_name",
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
    } catch {
        /*
         * Tidak ditemukan.
         */
    }


    return null;
}


/* =========================================================
   RESOLVE PROVIDER
   ========================================================= */

async function resolveProvider(
    model,
    adapter
) {
    const databaseProviderReference =
        firstDefined(
            model?.provider_id,
            model?.providerId
        );


    if (
        databaseProviderReference
    ) {
        const providerById =
            await loadProviderByDatabaseId(
                databaseProviderReference
            );


        if (
            providerById
        ) {
            return {
                provider:
                    providerById,

                providerCode:
                    firstDefined(
                        providerById?.provider_id,
                        databaseProviderReference
                    ),

                source:
                    "database_id"
            };
        }


        const providerByCode =
            await loadProviderByCode(
                databaseProviderReference
            );


        if (
            providerByCode
        ) {
            return {
                provider:
                    providerByCode,

                providerCode:
                    firstDefined(
                        providerByCode?.provider_id,
                        databaseProviderReference
                    ),

                source:
                    "database_provider_code"
            };
        }
    }


    const registryProviderCode =
        cleanString(
            adapter?.config?.providerId
        );


    if (
        registryProviderCode
    ) {
        const provider =
            await loadProviderByCode(
                registryProviderCode
            );


        if (
            provider
        ) {
            return {
                provider,

                providerCode:
                    firstDefined(
                        provider?.provider_id,
                        registryProviderCode
                    ),

                source:
                    "adapter_config"
            };
        }


        return {
            provider:
                null,

            providerCode:
                registryProviderCode,

            source:
                "adapter_config",

            error:
                "Provider not found"
        };
    }


    return {
        provider:
            null,

        providerCode:
            null,

        source:
            null,

        error:
            "Model provider is not configured"
    };
}


/* =========================================================
   LOAD PROVIDER CREDENTIAL
   ========================================================= */

async function loadProviderCredential(
    providerCode
) {
    const normalizedProviderCode =
        cleanString(
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
            "[generate-status] Failed reading provider_credentials:",
            serializeError(
                error
            )
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
            "[generate-status] Provider credential decryption failed:",
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
   BUFFER DECODER
   ========================================================= */

function decodeBuffer(
    value
) {
    const text =
        String(
            value || ""
        ).trim();


    if (
        !text
    ) {
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
             * fallback base64
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
         * invalid
         */
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
   ADAPTER CANDIDATES
   ========================================================= */

function getAdapterCandidates(
    adapter
) {
    if (
        !adapter
    ) {
        return [];
    }


    const config =
        adapter.config ||
        {};


    const values = [
        adapter.modelId,
        adapter.model_id,
        adapter.id,
        adapter.name,
        adapter.modelName,
        adapter.model_name,
        adapter.slug,
        adapter.modelSlug,
        adapter.model_slug,

        config.modelId,
        config.model_id,
        config.id,
        config.name,
        config.modelName,
        config.model_name,
        config.slug,
        config.modelSlug,
        config.model_slug
    ];


    if (
        Array.isArray(
            adapter.modelIds
        )
    ) {
        values.push(
            ...adapter.modelIds
        );
    }


    if (
        Array.isArray(
            adapter.model_ids
        )
    ) {
        values.push(
            ...adapter.model_ids
        );
    }


    if (
        Array.isArray(
            config.modelIds
        )
    ) {
        values.push(
            ...config.modelIds
        );
    }


    if (
        Array.isArray(
            config.model_ids
        )
    ) {
        values.push(
            ...config.model_ids
        );
    }


    return values
        .filter(
            value =>
                value !==
                    undefined &&
                value !==
                    null &&
                cleanString(
                    value
                ) !== ""
        )
        .map(
            cleanString
        );
}


/* =========================================================
   FIND ADAPTER
   ========================================================= */

function findAdapter(
    modelId
) {
    const target =
        normalizeIdentifier(
            modelId
        );


    if (
        !target
    ) {
        return null;
    }


    /*
     * Direct match.
     */
    for (
        const adapter
        of MODEL_REGISTRY
    ) {
        if (
            !adapter ||
            typeof adapter.queryTask !==
                "function"
        ) {
            continue;
        }


        const candidates =
            getAdapterCandidates(
                adapter
            );


        if (
            candidates.some(
                candidate =>
                    normalizeIdentifier(
                        candidate
                    ) ===
                    target
            )
        ) {
            return adapter;
        }
    }


    /*
     * Explicit Grok mapping.
     */
    if (
        target ===
        normalizeIdentifier(
            "grok-imagine/image-to-video"
        )
    ) {
        if (
            grokImagineImageToVideo &&
            typeof grokImagineImageToVideo.queryTask ===
                "function"
        ) {
            return grokImagineImageToVideo;
        }
    }


    /*
     * Compact fallback.
     */
    const compactTarget =
        target.replace(
            /[^a-z0-9]/g,
            ""
        );


    for (
        const adapter
        of MODEL_REGISTRY
    ) {
        if (
            !adapter ||
            typeof adapter.queryTask !==
                "function"
        ) {
            continue;
        }


        const candidates =
            getAdapterCandidates(
                adapter
            );


        for (
            const candidate
            of candidates
        ) {
            const compactCandidate =
                normalizeIdentifier(
                    candidate
                ).replace(
                    /[^a-z0-9]/g,
                    ""
                );


            if (
                compactCandidate &&
                compactCandidate ===
                    compactTarget
            ) {
                return adapter;
            }
        }
    }


    return null;
}


/* =========================================================
   ADAPTER DIAGNOSTICS
   ========================================================= */

function getAdapterDiagnostics() {
    return MODEL_REGISTRY.map(
        adapter => ({
            modelId:
                adapter?.modelId ||
                null,

            model_id:
                adapter?.model_id ||
                null,

            id:
                adapter?.id ||
                null,

            name:
                adapter?.name ||
                null,

            modelName:
                adapter?.modelName ||
                null,

            config_id:
                adapter?.config?.id ||
                null,

            config_model_id:
                adapter?.config?.modelId ||
                adapter?.config?.model_id ||
                null,

            config_provider_id:
                adapter?.config?.providerId ||
                null,

            has_queryTask:
                typeof adapter?.queryTask ===
                    "function",

            has_createTask:
                typeof adapter?.createTask ===
                    "function"
        })
    );
}


/* =========================================================
   QUERY PROVIDER TASK
   ========================================================= */

async function queryProviderTask(
    adapter,
    taskId,
    providerApiKey
) {
    if (
        !adapter
    ) {
        throw new Error(
            "Adapter tidak tersedia."
        );
    }


    if (
        typeof adapter.queryTask !==
            "function"
    ) {
        throw new Error(
            "Adapter queryTask tidak tersedia."
        );
    }


    return await adapter.queryTask(
        taskId,
        providerApiKey
    );
}


/* =========================================================
   DEEP VALUE FINDER
   ========================================================= */

function findDeepValue(
    value,
    keys,
    depth = 0
) {
    if (
        depth > 10 ||
        value === null ||
        value === undefined
    ) {
        return null;
    }


    if (
        typeof value !==
        "object"
    ) {
        return null;
    }


    const wanted =
        new Set(
            keys.map(
                lower
            )
        );


    for (
        const [
            key,
            child
        ]
        of Object.entries(
            value
        )
    ) {
        if (
            wanted.has(
                lower(
                    key
                )
            )
        ) {
            if (
                child !==
                    undefined &&
                child !==
                    null
            ) {
                return child;
            }
        }
    }


    for (
        const child
        of Object.values(
            value
        )
    ) {
        const found =
            findDeepValue(
                child,
                keys,
                depth + 1
            );


        if (
            found !==
                null &&
            found !==
                undefined
        ) {
            return found;
        }
    }


    return null;
}


/* =========================================================
   RESULT URL EXTRACTION
   ========================================================= */

function collectUrls(
    value,
    output = [],
    depth = 0
) {
    if (
        depth > 10 ||
        value === null ||
        value === undefined
    ) {
        return output;
    }


    if (
        typeof value ===
        "string"
    ) {
        const text =
            value.trim();


        if (
            /^https?:\/\//i.test(
                text
            )
        ) {
            output.push(
                text
            );
        }


        return output;
    }


    if (
        Array.isArray(
            value
        )
    ) {
        for (
            const item
            of value
        ) {
            collectUrls(
                item,
                output,
                depth + 1
            );
        }


        return output;
    }


    if (
        typeof value ===
        "object"
    ) {
        for (
            const [
                key,
                child
            ]
            of Object.entries(
                value
            )
        ) {
            const keyName =
                lower(
                    key
                );


            if (
                keyName.includes(
                    "url"
                ) ||
                keyName.includes(
                    "result"
                ) ||
                keyName.includes(
                    "output"
                ) ||
                keyName.includes(
                    "video"
                ) ||
                keyName.includes(
                    "image"
                )
            ) {
                collectUrls(
                    child,
                    output,
                    depth + 1
                );
            } else if (
                depth < 6
            ) {
                collectUrls(
                    child,
                    output,
                    depth + 1
                );
            }
        }
    }


    return output;
}


/* =========================================================
   UNIQUE URLS
   ========================================================= */

function uniqueUrls(
    urls
) {
    return Array.from(
        new Set(
            urls
                .map(
                    cleanString
                )
                .filter(
                    url =>
                        /^https?:\/\//i.test(
                            url
                        )
                )
        )
    );
}


/* =========================================================
   NORMALIZE PROVIDER RESULT
   ---------------------------------------------------------
   INTERNAL STATUS:
   - completed
   - failed
   - processing

   Catatan:
   "completed" di sini adalah status provider/KIE.
   Saat disimpan ke generation_history akan dipetakan
   menjadi "success".
   ========================================================= */

function normalizeProviderResult(
    raw,
    taskId
) {
    const providerState =
        firstDefined(
            findDeepValue(
                raw,
                [
                    "provider_state",
                    "providerState",
                    "state",
                    "status"
                ]
            ),
            ""
        );


    const state =
        lower(
            providerState
        );


    const explicitCompleted =
        findDeepValue(
            raw,
            [
                "completed",
                "is_completed",
                "isCompleted",
                "success",
                "succeeded"
            ]
        );


    const explicitFailed =
        findDeepValue(
            raw,
            [
                "failed",
                "is_failed",
                "isFailed"
            ]
        );


    const explicitProcessing =
        findDeepValue(
            raw,
            [
                "processing",
                "is_processing",
                "isProcessing",
                "pending",
                "waiting"
            ]
        );


    const resultUrls =
        uniqueUrls(
            collectUrls(
                raw
            )
        );


    let completed =
        COMPLETED_STATES.has(
            state
        );


    let failed =
        FAILED_STATES.has(
            state
        );


    let processing =
        PROCESSING_STATES.has(
            state
        );


    if (
        explicitCompleted ===
        true
    ) {
        completed =
            true;

        failed =
            false;

        processing =
            false;
    }


    if (
        explicitFailed ===
        true
    ) {
        failed =
            true;

        completed =
            false;

        processing =
            false;
    }


    if (
        explicitProcessing ===
        true &&
        !completed &&
        !failed
    ) {
        processing =
            true;
    }


    /*
     * Result URL adalah bukti terminal completed.
     */
    if (
        resultUrls.length > 0 &&
        !failed
    ) {
        completed =
            true;

        processing =
            false;
    }


    if (
        !completed &&
        !failed &&
        !processing
    ) {
        processing =
            true;
    }


    let normalizedState =
        "processing";


    if (
        completed
    ) {
        normalizedState =
            "completed";
    } else if (
        failed
    ) {
        normalizedState =
            "failed";
    }


    const resolvedTaskId =
        firstDefined(
            findDeepValue(
                raw,
                [
                    "task_id",
                    "taskId",
                    "id"
                ]
            ),
            taskId
        );


    const resultJson =
        firstDefined(
            findDeepValue(
                raw,
                [
                    "resultJson",
                    "result_json"
                ]
            ),
            findDeepValue(
                raw,
                [
                    "result"
                ]
            )
        );


    return {
        raw,

        state:
            normalizedState,

        provider_state:
            providerState ||
            null,

        task_id:
            cleanString(
                resolvedTaskId
            ),

        resultJson:
            resultJson ||
            null,

        result_urls:
            resultUrls,

        processing,

        completed,

        failed
    };
}


/* =========================================================
   FIND GENERATION HISTORY
   ========================================================= */

async function findGenerationHistory(
    userId,
    taskId
) {
    const params =
        new URLSearchParams();


    params.set(
        "user_id",
        `eq.${userId}`
    );


    params.set(
        "task_id",
        `eq.${taskId}`
    );


    params.set(
        "select",
        "*"
    );


    params.set(
        "order",
        "created_at.desc"
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
        !Array.isArray(
            rows
        )
    ) {
        return null;
    }


    return rows[0] ||
        null;
}


/* =========================================================
   UPDATE GENERATION HISTORY
   ---------------------------------------------------------
   DATABASE STATUS YANG VALID:

       queued
       processing
       success
       failed
       cancelled

   PENTING:
   normalized.completed = true
   TIDAK berarti payload status = "completed".

   Mapping:
       provider completed
              ↓
       database success
   ========================================================= */

async function updateGenerationHistory(
    history,
    normalized
) {
    if (
        !history ||
        !history.id
    ) {
        throw new Error(
            "generation_history.id tidak ditemukan."
        );
    }


    const historyId =
        cleanString(
            history.id
        );


    const userId =
        cleanString(
            history.user_id
        );


    const taskId =
        cleanString(
            history.task_id
        );


    if (
        !historyId
    ) {
        throw new Error(
            "generation_history.id kosong."
        );
    }


    /*
     * -------------------------------------------------------
     * RESULT URL
     * -------------------------------------------------------
     */

    const resultUrl =
        normalized.result_urls &&
        normalized.result_urls.length
            ? normalized.result_urls[0]
            : null;


    /*
     * -------------------------------------------------------
     * BUILD PAYLOAD
     * -------------------------------------------------------
     */

    let payload;


    /*
     * PROVIDER COMPLETED
     *
     * Database harus menggunakan "success".
     */
    if (
        normalized.completed
    ) {
        payload = {
            status:
                "success",

            result_url:
                resultUrl,

            completed_at:
                new Date().toISOString(),

            error_message:
                null
        };
    }


    /*
     * PROVIDER FAILED
     */
    else if (
        normalized.failed
    ) {
        const providerErrorRaw =
            firstDefined(
                findDeepValue(
                    normalized.raw,
                    [
                        "error_message",
                        "errorMessage",
                        "message",
                        "error"
                    ]
                ),
                "Provider gagal memproses task."
            );


        /*
         * Hindari [object Object].
         */
        let providerError;


        if (
            typeof providerErrorRaw ===
                "string"
        ) {
            providerError =
                cleanString(
                    providerErrorRaw
                );
        } else {
            providerError =
                safeJson(
                    providerErrorRaw
                );
        }


        payload = {
            status:
                "failed",

            error_message:
                providerError ||
                "Provider gagal memproses task.",

            completed_at:
                new Date().toISOString()
        };
    }


    /*
     * TASK MASIH PROCESSING
     */
    else {
        payload = {
            status:
                "processing"
        };
    }


    /*
     * -------------------------------------------------------
     * FILTER
     * -------------------------------------------------------
     *
     * Gunakan:
     * - id
     * - user_id
     * - task_id
     *
     * Ini mencegah update row milik user/task lain.
     */

    const filters =
        new URLSearchParams();


    filters.set(
        "id",
        `eq.${historyId}`
    );


    if (
        userId
    ) {
        filters.set(
            "user_id",
            `eq.${userId}`
        );
    }


    if (
        taskId
    ) {
        filters.set(
            "task_id",
            `eq.${taskId}`
        );
    }


    const endpoint =
        `/rest/v1/generation_history?${filters.toString()}`;


    /*
     * -------------------------------------------------------
     * PATCH HELPER
     * -------------------------------------------------------
     */

    async function patchHistory(
        patchPayload,
        strategy
    ) {
        const rows =
            await supabaseRequest(
                endpoint,
                {
                    method:
                        "PATCH",

                    headers: {
                        Prefer:
                            "return=representation"
                    },

                    body:
                        JSON.stringify(
                            patchPayload
                        )
                }
            );


        /*
         * Supabase dapat mengembalikan:
         *
         * []
         *
         * jika tidak ada row yang cocok.
         */
        if (
            Array.isArray(rows) &&
            rows.length === 0
        ) {
            const error =
                new Error(
                    "Supabase menerima PATCH tetapi tidak ada generation_history yang berubah."
                );


            error.status =
                200;


            error.code =
                "NO_ROWS_UPDATED";


            error.data =
                rows;


            error.path =
                endpoint;


            error.method =
                "PATCH";


            error.body =
                JSON.stringify(
                    patchPayload
                );


            throw error;
        }


        /*
         * Empty response bukan otomatis gagal.
         *
         * Verifikasi database dilakukan setelah ini.
         */
        return {
            payload:
                patchPayload,

            rows:
                Array.isArray(rows)
                    ? rows
                    : [],

            strategy
        };
    }


    /*
     * -------------------------------------------------------
     * PRIMARY PATCH
     * -------------------------------------------------------
     */

    try {
        return await patchHistory(
            payload,
            "primary"
        );
    } catch (primaryError) {
        console.error(
            "[generate-status] Primary generation_history PATCH failed:",
            serializeError(
                primaryError
            )
        );


        /*
         * ---------------------------------------------------
         * COMPLETED FALLBACK #1
         * ---------------------------------------------------
         *
         * Tanpa error_message:null.
         *
         * STATUS TETAP "success".
         */

        if (
            normalized.completed
        ) {
            const fallbackPayload = {
                status:
                    "success",

                result_url:
                    resultUrl,

                completed_at:
                    new Date().toISOString()
            };


            try {
                return {
                    ...(
                        await patchHistory(
                            fallbackPayload,
                            "fallback_without_error_message"
                        )
                    ),

                    primary_error:
                        serializeError(
                            primaryError
                        )
                };
            } catch (fallbackError) {
                console.error(
                    "[generate-status] Success fallback PATCH failed:",
                    serializeError(
                        fallbackError
                    )
                );


                /*
                 * ------------------------------------------------
                 * COMPLETED FALLBACK #2
                 * ------------------------------------------------
                 *
                 * Hanya status + result_url.
                 */

                const minimalPayload = {
                    status:
                        "success",

                    result_url:
                        resultUrl
                };


                try {
                    return {
                        ...(
                            await patchHistory(
                                minimalPayload,
                                "fallback_minimal"
                            )
                        ),

                        primary_error:
                            serializeError(
                                primaryError
                            ),

                        fallback_error:
                            serializeError(
                                fallbackError
                            )
                    };
                } catch (minimalError) {
                    console.error(
                        "[generate-status] Minimal success PATCH failed:",
                        serializeError(
                            minimalError
                        )
                    );


                    const error =
                        new Error(
                            minimalError?.message ||
                            fallbackError?.message ||
                            primaryError?.message ||
                            "Gagal memperbarui generation_history."
                        );


                    error.status =
                        minimalError?.status ??
                        fallbackError?.status ??
                        primaryError?.status ??
                        null;


                    error.code =
                        minimalError?.code ||
                        fallbackError?.code ||
                        primaryError?.code ||
                        null;


                    error.details =
                        minimalError?.details ||
                        fallbackError?.details ||
                        primaryError?.details ||
                        null;


                    error.hint =
                        minimalError?.hint ||
                        fallbackError?.hint ||
                        primaryError?.hint ||
                        null;


                    error.data = {
                        primary:
                            primaryError?.data ??
                            null,

                        fallback:
                            fallbackError?.data ??
                            null,

                        minimal:
                            minimalError?.data ??
                            null
                    };


                    error.path =
                        minimalError?.path ||
                        fallbackError?.path ||
                        primaryError?.path ||
                        endpoint;


                    error.method =
                        "PATCH";


                    error.body = {
                        primary:
                            payload,

                        fallback:
                            fallbackPayload,

                        minimal:
                            minimalPayload
                    };


                    error.diagnostics = {
                        primary:
                            serializeError(
                                primaryError
                            ),

                        fallback:
                            serializeError(
                                fallbackError
                            ),

                        minimal:
                            serializeError(
                                minimalError
                            )
                    };


                    throw error;
                }
            }
        }


        /*
         * ---------------------------------------------------
         * FAILED FALLBACK
         * ---------------------------------------------------
         */

        if (
            normalized.failed
        ) {
            const providerErrorRaw =
                firstDefined(
                    findDeepValue(
                        normalized.raw,
                        [
                            "error_message",
                            "errorMessage",
                            "message",
                            "error"
                        ]
                    ),
                    "Provider gagal memproses task."
                );


            const providerError =
                typeof providerErrorRaw ===
                    "string"
                    ? cleanString(
                        providerErrorRaw
                    )
                    : safeJson(
                        providerErrorRaw
                    );


            const fallbackPayload = {
                status:
                    "failed",

                error_message:
                    providerError ||
                    "Provider gagal memproses task."
            };


            try {
                const result =
                    await patchHistory(
                        fallbackPayload,
                        "fallback_failed"
                    );


                return {
                    ...result,

                    primary_error:
                        serializeError(
                            primaryError
                        )
                };
            } catch (fallbackError) {
                const error =
                    new Error(
                        fallbackError?.message ||
                        primaryError?.message ||
                        "Gagal memperbarui generation_history."
                    );


                error.status =
                    fallbackError?.status ??
                    primaryError?.status ??
                    null;


                error.code =
                    fallbackError?.code ||
                    primaryError?.code ||
                    null;


                error.details =
                    fallbackError?.details ||
                    primaryError?.details ||
                    null;


                error.hint =
                    fallbackError?.hint ||
                    primaryError?.hint ||
                    null;


                error.data = {
                    primary:
                        primaryError?.data ??
                        null,

                    fallback:
                        fallbackError?.data ??
                        null
                };


                error.path =
                    fallbackError?.path ||
                    primaryError?.path ||
                    endpoint;


                error.method =
                    "PATCH";


                error.body = {
                    primary:
                        payload,

                    fallback:
                        fallbackPayload
                };


                error.diagnostics = {
                    primary:
                        serializeError(
                            primaryError
                        ),

                    fallback:
                        serializeError(
                            fallbackError
                        )
                };


                throw error;
            }
        }


        /*
         * Processing tidak membutuhkan fallback.
         */
        throw primaryError;
    }
}


/* =========================================================
   VERIFY GENERATION HISTORY
   ========================================================= */

async function verifyGenerationHistory(
    history
) {
    const historyId =
        cleanString(
            typeof history ===
                "object"
                ? history?.id
                : history
        );


    const userId =
        cleanString(
            typeof history ===
                "object"
                ? history?.user_id
                : ""
        );


    const taskId =
        cleanString(
            typeof history ===
                "object"
                ? history?.task_id
                : ""
        );


    if (
        !historyId
    ) {
        return null;
    }


    const params =
        new URLSearchParams();


    params.set(
        "id",
        `eq.${historyId}`
    );


    if (
        userId
    ) {
        params.set(
            "user_id",
            `eq.${userId}`
        );
    }


    if (
        taskId
    ) {
        params.set(
            "task_id",
            `eq.${taskId}`
        );
    }


    params.set(
        "select",
        "*"
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
        !Array.isArray(
            rows
        )
    ) {
        return null;
    }


    return rows[0] ||
        null;
}


/* =========================================================
   SYNC GENERATION HISTORY
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

            history_error_diagnostics:
                null,

            history_error_path:
                null,

            history_error_method:
                null,

            history_error_body:
                null,

            history_update_payload:
                null
        };
    }


    /*
     * -------------------------------------------------------
     * TASK MASIH BERJALAN
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

            history_error_diagnostics:
                null,

            history_error_path:
                null,

            history_error_method:
                null,

            history_error_body:
                null,

            history_update_payload:
                null
        };
    }


    let updateResult;


    /*
     * -------------------------------------------------------
     * UPDATE
     * -------------------------------------------------------
     */

    try {
        updateResult =
            await updateGenerationHistory(
                history,
                normalized
            );
    } catch (error) {
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
                serialized?.message ||
                String(
                    error
                ),

            history_error_status:
                serialized?.status ??
                null,

            history_error_code:
                serialized?.code ||
                null,

            history_error_details:
                serialized?.details ||
                null,

            history_error_hint:
                serialized?.hint ||
                null,

            history_error_data:
                serialized?.data ??
                null,

            history_error_diagnostics:
                serialized?.diagnostics ??
                null,

            history_error_path:
                serialized?.path ||
                null,

            history_error_method:
                serialized?.method ||
                null,

            history_error_body:
                serialized?.body ??
                null,

            history_update_payload:
                null
        };
    }


    /*
     * -------------------------------------------------------
     * VERIFY DATABASE
     * -------------------------------------------------------
     */

    let verified;


    try {
        verified =
            await verifyGenerationHistory(
                history
            );
    } catch (error) {
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
                serialized?.message ||
                String(
                    error
                ),

            history_error_status:
                serialized?.status ??
                null,

            history_error_code:
                serialized?.code ||
                null,

            history_error_details:
                serialized?.details ||
                null,

            history_error_hint:
                serialized?.hint ||
                null,

            history_error_data:
                serialized?.data ??
                null,

            history_error_diagnostics:
                serialized?.diagnostics ??
                null,

            history_error_path:
                serialized?.path ||
                null,

            history_error_method:
                serialized?.method ||
                null,

            history_error_body:
                serialized?.body ??
                null,

            history_update_payload:
                updateResult?.payload ||
                null
        };
    }


    /*
     * -------------------------------------------------------
     * EXPECTED DATABASE STATUS
     * -------------------------------------------------------
     *
     * IMPORTANT:
     *
     * Provider:
     *     completed
     *
     * Database:
     *     success
     */

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


    /*
     * -------------------------------------------------------
     * RESULT URL VERIFICATION
     * -------------------------------------------------------
     */

    const verifiedResultUrl =
        cleanString(
            verified?.result_url
        );


    const verifiedCompletedAt =
        cleanString(
            verified?.completed_at
        );


    /*
     * -------------------------------------------------------
     * RESULT
     * -------------------------------------------------------
     */

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
            verifiedResultUrl ||
            null,

        history_completed_at:
            verifiedCompletedAt ||
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
            null,

        history_error_diagnostics:
            null,

        history_error_path:
            null,

        history_error_method:
            null,

        history_error_body:
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


    /*
     * Jika task sudah terminal tetapi update
     * belum berhasil/terverifikasi, retry sekali.
     */

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


        /*
         * Jangan kehilangan diagnostik dari percobaan pertama.
         */
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
                    body.taskId
                )
            );


        const modelId =
            cleanString(
                firstDefined(
                    body.model_id,
                    body.modelId,
                    body.model
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


        if (
            !modelId
        ) {
            return json(
                res,
                400,
                {
                    success:
                        false,

                    error:
                        "model_id wajib diisi."
                }
            );
        }


        /*
         * ---------------------------------------------------
         * MODEL
         * ---------------------------------------------------
         */

        const model =
            await loadModel(
                modelId
            );


        /*
         * ---------------------------------------------------
         * ADAPTER
         * ---------------------------------------------------
         */

        const adapter =
            findAdapter(
                modelId
            );


        if (
            !adapter
        ) {
            return json(
                res,
                500,
                {
                    success:
                        false,

                    error:
                        `Adapter untuk model "${modelId}" tidak ditemukan.`,

                    model_id:
                        modelId,

                    registered_adapters:
                        getAdapterDiagnostics()
                }
            );
        }


        /*
         * ---------------------------------------------------
         * PROVIDER
         * ---------------------------------------------------
         */

        const providerResult =
            await resolveProvider(
                model,
                adapter
            );


        if (
            providerResult.error
        ) {
            return json(
                res,
                404,
                {
                    success:
                        false,

                    error:
                        providerResult.error,

                    model_id:
                        modelId,

                    provider_id:
                        providerResult.providerCode ||
                        null,

                    provider:
                        providerResult.provider
                            ?.provider_name ||
                        providerResult.provider
                            ?.name ||
                        null
                }
            );
        }


        const provider =
            providerResult.provider;


        /*
         * ---------------------------------------------------
         * PROVIDER CODE
         * ---------------------------------------------------
         *
         * HARUS:
         *
         *     provider.provider_id
         *
         * Contoh:
         *
         *     kie
         *
         * BUKAN:
         *
         *     GEN-Z.AI
         * ---------------------------------------------------
         */

        const providerCode =
            cleanString(
                firstDefined(
                    providerResult.providerCode,
                    provider?.provider_id,
                    adapter?.config?.providerId
                )
            );


        if (
            !providerCode
        ) {
            return json(
                res,
                500,
                {
                    success:
                        false,

                    error:
                        "Provider ID is missing.",

                    model_id:
                        modelId,

                    provider:
                        provider?.provider_name ||
                        provider?.name ||
                        null
                }
            );
        }


        /*
         * ---------------------------------------------------
         * PROVIDER CREDENTIAL
         * ---------------------------------------------------
         */

        let providerApiKey;


        try {
            providerApiKey =
                await loadProviderCredential(
                    providerCode
                );
        } catch (error) {
            console.error(
                "[generate-status] Provider credential error:",
                serializeError(
                    error
                )
            );


            return json(
                res,
                500,
                {
                    success:
                        false,

                    error:
                        `Credential provider "${providerCode}" tidak ditemukan.`,

                    model_id:
                        modelId,

                    provider_id:
                        providerCode,

                    provider:
                        provider?.provider_name ||
                        provider?.name ||
                        null,

                    details: {
                        message:
                            error?.message ||
                            null
                    }
                }
            );
        }


        /*
         * ---------------------------------------------------
         * QUERY PROVIDER
         * ---------------------------------------------------
         */

        let providerRaw;


        try {
            providerRaw =
                await queryProviderTask(
                    adapter,
                    taskId,
                    providerApiKey
                );
        } catch (error) {
            console.error(
                "[generate-status] Provider query failed:",
                serializeError(
                    error
                )
            );


            return json(
                res,
                502,
                {
                    success:
                        false,

                    error:
                        error?.message ||
                        "Gagal query status task ke provider.",

                    model_id:
                        modelId,

                    model_name:
                        model?.model_name ||
                        model?.name ||
                        null,

                    provider_id:
                        providerCode,

                    provider:
                        provider?.provider_name ||
                        provider?.name ||
                        null,

                    task_id:
                        taskId,

                    adapter_found:
                        true,

                    adapter_has_queryTask:
                        typeof adapter?.queryTask ===
                            "function",

                    adapter_has_createTask:
                        typeof adapter?.createTask ===
                            "function"
                }
            );
        }


        /*
         * ---------------------------------------------------
         * NORMALIZE PROVIDER RESPONSE
         * ---------------------------------------------------
         */

        const normalized =
            normalizeProviderResult(
                providerRaw,
                taskId
            );


        /*
         * ---------------------------------------------------
         * UPDATE HISTORY
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
                    firstDefined(
                        model?.model_name,
                        model?.modelName,
                        model?.name
                    ),

                provider_id:
                    providerCode,

                provider:
                    firstDefined(
                        provider?.provider_name,
                        provider?.providerName,
                        provider?.name
                    ),

                task_id:
                    normalized.task_id ||
                    taskId,

                taskId:
                    normalized.task_id ||
                    taskId,

                /*
                 * Provider/KIE status.
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
                    normalized.resultJson ||
                    (
                        normalized.result_urls.length
                            ? {
                                resultUrls:
                                    normalized.result_urls
                            }
                            : null
                    ),

                /*
                 * ------------------------------------------------
                 * HISTORY
                 * ------------------------------------------------
                 */

                history_updated:
                    history.history_updated,

                history_matched:
                    history.history_matched,

                /*
                 * Ini adalah status DATABASE.
                 *
                 * completed provider
                 * akan menghasilkan:
                 *
                 * success database
                 */
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
                 * ------------------------------------------------
                 * HISTORY ERROR DIAGNOSTICS
                 * ------------------------------------------------
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

                history_error_diagnostics:
                    history.history_error_diagnostics ??
                    null,

                history_error_path:
                    history.history_error_path ||
                    null,

                history_error_method:
                    history.history_error_method ||
                    null,

                history_error_body:
                    history.history_error_body ??
                    null,

                /*
                 * First attempt diagnostics jika retry
                 * diperlukan.
                 */
                history_first_attempt:
                    history.history_first_attempt ||
                    null,

                /*
                 * ------------------------------------------------
                 * ADAPTER
                 * ------------------------------------------------
                 */

                adapter_found:
                    true,

                adapter_has_queryTask:
                    typeof adapter?.queryTask ===
                        "function",

                adapter_has_createTask:
                    typeof adapter?.createTask ===
                        "function",

                /*
                 * ------------------------------------------------
                 * CREDENTIAL DIAGNOSTICS
                 * ------------------------------------------------
                 *
                 * Tidak pernah mengembalikan API key.
                 */

                credential_provider_id:
                    providerCode,

                credential_resolved:
                    true,

                modelId:
                    modelId
            }
        );
    } catch (error) {
        console.error(
            "[generate-status]",
            serializeError(
                error
            )
        );


        return json(
            res,
            error?.status >= 400 &&
            error?.status < 600
                ? error.status
                : 500,
            {
                success:
                    false,

                error:
                    error?.message ||
                    "Gagal memproses status generation.",

                details:
                    error?.data ||
                    null,

                error_code:
                    error?.code ||
                    null,

                error_details:
                    error?.details ||
                    null,

                error_hint:
                    error?.hint ||
                    null,

                error_diagnostics:
                    error?.diagnostics ||
                    null,

                error_path:
                    error?.path ||
                    null,

                error_method:
                    error?.method ||
                    null
            }
        );
    }
}
