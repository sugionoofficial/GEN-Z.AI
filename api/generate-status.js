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


/*
 * HARUS sama dengan generate.js.
 */
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
   UPDATE GENERATION HISTORY
   ---------------------------------------------------------
   Tanggung jawab:
   - Update row History terminal
   - Simpan result URL
   - Simpan completed_at
   - Simpan error_message jika gagal
   - Menggunakan id + user_id + task_id
   - Fallback payload jika schema menolak field tertentu
   - Mengembalikan error database asli
   ========================================================= */

async function updateGenerationHistory(
    history,
    normalized
) {
    if (
        !history?.id
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
     * BUILD PAYLOAD
     * -------------------------------------------------------
     */

    let payload =
        {};


    if (
        normalized.completed
    ) {
        payload = {
            status:
                "completed",

            result_url:
                normalized.result_urls &&
                normalized.result_urls.length
                    ? normalized.result_urls[0]
                    : null,

            completed_at:
                new Date().toISOString(),

            error_message:
                null
        };
    }


    else if (
        normalized.failed
    ) {
        const providerError =
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


        payload = {
            status:
                "failed",

            error_message:
                cleanString(
                    providerError
                ),

            completed_at:
                new Date().toISOString()
        };
    }


    else {
        payload = {
            status:
                "processing"
        };
    }


    /*
     * -------------------------------------------------------
     * PRIMARY FILTER
     * -------------------------------------------------------
     *
     * id selalu wajib.
     *
     * user_id + task_id ditambahkan bila tersedia supaya
     * update tidak pernah mengenai History milik user/task lain.
     * -------------------------------------------------------
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
     * PRIMARY PATCH
     * -------------------------------------------------------
     */

    try {
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
                            payload
                        )
                }
            );


        /*
         * Kalau Supabase mengembalikan array kosong,
         * berarti tidak ada row yang benar-benar ter-update.
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


            throw error;
        }


        return {
            payload,

            rows:
                Array.isArray(rows)
                    ? rows
                    : [],

            strategy:
                "primary"
        };
    } catch (primaryError) {
        console.error(
            "[generate-status] Primary generation_history PATCH failed:",
            {
                message:
                    primaryError?.message,

                status:
                    primaryError?.status,

                code:
                    primaryError?.code,

                details:
                    primaryError?.details,

                hint:
                    primaryError?.hint,

                data:
                    primaryError?.data
            }
        );


        /*
         * ---------------------------------------------------
         * FALLBACK #1
         * ---------------------------------------------------
         *
         * Jangan menyertakan error_message:null.
         *
         * Ini berguna jika ada schema/trigger/constraint
         * yang bermasalah pada kolom error_message.
         * ---------------------------------------------------
         */

        if (
            normalized.completed
        ) {
            const fallbackPayload = {
                status:
                    "completed",

                result_url:
                    normalized.result_urls &&
                    normalized.result_urls.length
                        ? normalized.result_urls[0]
                        : null,

                completed_at:
                    new Date().toISOString()
            };


            try {
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
                                    fallbackPayload
                                )
                        }
                    );


                if (
                    Array.isArray(rows) &&
                    rows.length === 0
                ) {
                    const error =
                        new Error(
                            "Fallback PATCH diterima tetapi tidak ada generation_history yang berubah."
                        );


                    error.status =
                        200;


                    error.code =
                        "NO_ROWS_UPDATED";


                    error.data =
                        rows;


                    throw error;
                }


                return {
                    payload:
                        fallbackPayload,

                    rows:
                        Array.isArray(rows)
                            ? rows
                            : [],

                    strategy:
                        "fallback_without_error_message",

                    primary_error: {
                        message:
                            primaryError?.message ||
                            null,

                        status:
                            primaryError?.status ||
                            null,

                        code:
                            primaryError?.code ||
                            null,

                        details:
                            primaryError?.details ||
                            null,

                        hint:
                            primaryError?.hint ||
                            null,

                        data:
                            primaryError?.data ||
                            null
                    }
                };
            } catch (fallbackError) {
                console.error(
                    "[generate-status] Fallback generation_history PATCH failed:",
                    {
                        message:
                            fallbackError?.message,

                        status:
                            fallbackError?.status,

                        code:
                            fallbackError?.code,

                        details:
                            fallbackError?.details,

                        hint:
                            fallbackError?.hint,

                        data:
                            fallbackError?.data
                    }
                );


                /*
                 * ------------------------------------------------
                 * FALLBACK #2
                 * ------------------------------------------------
                 *
                 * Hanya status + result_url.
                 *
                 * Jika ini berhasil, berarti masalahnya
                 * kemungkinan berada di completed_at.
                 * ------------------------------------------------
                 */

                const minimalPayload = {
                    status:
                        "completed",

                    result_url:
                        normalized.result_urls &&
                        normalized.result_urls.length
                            ? normalized.result_urls[0]
                            : null
                };


                try {
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
                                        minimalPayload
                                    )
                            }
                        );


                    if (
                        Array.isArray(rows) &&
                        rows.length === 0
                    ) {
                        const error =
                            new Error(
                                "Minimal PATCH diterima tetapi tidak ada generation_history yang berubah."
                            );


                        error.status =
                            200;


                        error.code =
                            "NO_ROWS_UPDATED";


                        error.data =
                            rows;


                        throw error;
                    }


                    return {
                        payload:
                            minimalPayload,

                        rows:
                            Array.isArray(rows)
                                ? rows
                                : [],

                        strategy:
                            "fallback_minimal",

                        primary_error: {
                            message:
                                primaryError?.message ||
                                null,

                            status:
                                primaryError?.status ||
                                null,

                            code:
                                primaryError?.code ||
                                null,

                            details:
                                primaryError?.details ||
                                null,

                            hint:
                                primaryError?.hint ||
                                null,

                            data:
                                primaryError?.data ||
                                null
                        },

                        fallback_error: {
                            message:
                                fallbackError?.message ||
                                null,

                            status:
                                fallbackError?.status ||
                                null,

                            code:
                                fallbackError?.code ||
                                null,

                            details:
                                fallbackError?.details ||
                                null,

                            hint:
                                fallbackError?.hint ||
                                null,

                            data:
                                fallbackError?.data ||
                                null
                        }
                    };
                } catch (minimalError) {
                    /*
                     * Semua strategi gagal.
                     *
                     * Lempar error dengan seluruh informasi
                     * supaya syncGenerationHistory()
                     * dapat mengembalikannya ke browser.
                     */

                    const error =
                        new Error(
                            minimalError?.message ||
                            fallbackError?.message ||
                            primaryError?.message ||
                            "Gagal memperbarui generation_history."
                        );


                    error.status =
                        minimalError?.status ||
                        fallbackError?.status ||
                        primaryError?.status ||
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
                            primaryError?.data ||
                            null,

                        fallback:
                            fallbackError?.data ||
                            null,

                        minimal:
                            minimalError?.data ||
                            null
                    };


                    error.diagnostics = {
                        primary: {
                            message:
                                primaryError?.message ||
                                null,

                            status:
                                primaryError?.status ||
                                null,

                            code:
                                primaryError?.code ||
                                null,

                            details:
                                primaryError?.details ||
                                null,

                            hint:
                                primaryError?.hint ||
                                null
                        },

                        fallback: {
                            message:
                                fallbackError?.message ||
                                null,

                            status:
                                fallbackError?.status ||
                                null,

                            code:
                                fallbackError?.code ||
                                null,

                            details:
                                fallbackError?.details ||
                                null,

                            hint:
                                fallbackError?.hint ||
                                null
                        },

                        minimal: {
                            message:
                                minimalError?.message ||
                                null,

                            status:
                                minimalError?.status ||
                                null,

                            code:
                                minimalError?.code ||
                                null,

                            details:
                                minimalError?.details ||
                                null,

                            hint:
                                minimalError?.hint ||
                                null
                        }
                    };


                    throw error;
                }
            }
        }


        /*
         * Jika task failed, coba payload minimal failed.
         */
        if (
            normalized.failed
        ) {
            const fallbackPayload = {
                status:
                    "failed",

                error_message:
                    cleanString(
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
                        )
                    )
            };


            try {
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
                                    fallbackPayload
                                )
                        }
                    );


                return {
                    payload:
                        fallbackPayload,

                    rows:
                        Array.isArray(rows)
                            ? rows
                            : [],

                    strategy:
                        "fallback_failed"
                };
            } catch (fallbackError) {
                const error =
                    new Error(
                        fallbackError?.message ||
                        primaryError?.message ||
                        "Gagal memperbarui generation_history."
                    );


                error.status =
                    fallbackError?.status ||
                    primaryError?.status ||
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
                        primaryError?.data ||
                        null,

                    fallback:
                        fallbackError?.data ||
                        null
                };


                throw error;
            }
        }


        /*
         * Processing tidak perlu masuk fallback.
         */
        throw primaryError;
    }
}


/* =========================================================
   FILTER HELPER
   ========================================================= */

function eqFilter(
    value
) {
    return encodeURIComponent(
        `eq.${value}`
    );
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
   ---------------------------------------------------------
   Contoh:
     provider_id = kie
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
    /*
     * Prioritas utama:
     *
     * models.provider_id
     *
     * Untuk model saat ini:
     *
     *   provider_id = kie
     */
    const databaseProviderReference =
        firstDefined(
            model?.provider_id,
            model?.providerId
        );


    if (
        databaseProviderReference
    ) {
        /*
         * Coba sebagai database UUID / id.
         */
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


        /*
         * Coba sebagai provider code.
         *
         * Contoh:
         *   kie
         */
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


    /*
     * Fallback ke adapter config.
     *
     * Grok adapter biasanya:
     *
     * config.providerId
     */
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
   ---------------------------------------------------------
   PENTING:

   generate.js menggunakan:

     provider_credentials.provider_id
       = providerCode

   Contoh:

     provider_id = kie

   JANGAN menggunakan:

     provider_name = GEN-Z.AI

   sebagai kunci credential.
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
     * 32-byte base64.
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
     * Sama seperti generate.js:
     * hash secret menjadi 32 byte.
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
     *
     * index.js menggunakan:
     *
     * export default model;
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


    /*
     * Boolean terminal flags.
     */
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
     * Result URL adalah bukti kuat
     * bahwa task sudah menghasilkan output.
     *
     * Ini penting karena KIE bisa memberikan
     * result URL dengan struktur response
     * yang tidak selalu sama.
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


    /*
     * Jika provider tidak mengembalikan
     * state yang dikenali dan belum ada
     * result/failure, pertahankan polling.
     */
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
   ========================================================= */

async function updateGenerationHistory(
    historyId,
    normalized
) {
    if (
        !historyId
    ) {
        throw new Error(
            "generation_history.id tidak ditemukan."
        );
    }


    const payload =
        {};


    if (
        normalized.completed
    ) {
        payload.status =
            "completed";


        if (
            normalized.result_urls &&
            normalized.result_urls.length
        ) {
            payload.result_url =
                normalized.result_urls[0];
        }


        payload.error_message =
            null;


        payload.completed_at =
            new Date().toISOString();
    }


    else if (
        normalized.failed
    ) {
        payload.status =
            "failed";


        const providerError =
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


        payload.error_message =
            cleanString(
                providerError
            );


        payload.completed_at =
            new Date().toISOString();
    }


    else {
        payload.status =
            "processing";
    }


    const params =
        new URLSearchParams();


    params.set(
        "id",
        `eq.${historyId}`
    );


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


    return {
        payload,

        rows:
            Array.isArray(
                rows
            )
                ? rows
                : []
    };
}


/* =========================================================
   VERIFY GENERATION HISTORY
   ========================================================= */

async function verifyGenerationHistory(
    historyId
) {
    const params =
        new URLSearchParams();


    params.set(
        "id",
        `eq.${historyId}`
    );


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
                null
        };
    }


    /*
     * Task masih berjalan.
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
                history.id
        };
    }


    let updateResult;


    try {
        updateResult =
            await updateGenerationHistory(
                history.id,
                normalized
            );
    } catch (error) {
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

            history_error:
                error?.message ||
                String(
                    error
                ),

            history_error_status:
                error?.status ||
                null,

            history_error_data:
                error?.data ||
                null
        };
    }


    /*
     * Baca kembali database.
     */
    let verified;


    try {
        verified =
            await verifyGenerationHistory(
                history.id
            );
    } catch (error) {
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

            history_error:
                error?.message ||
                String(
                    error
                )
        };
    }


    const expectedStatus =
        normalized.completed
            ? "completed"
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

        history_update_payload:
            updateResult?.payload ||
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
     * Jika task sudah terminal tetapi PATCH
     * belum terverifikasi, coba sekali lagi.
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


        result = {
            ...retryResult,

            history_retry:
                true
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
         *
         * Cari adapter SEBELUM credential.
         * Dengan demikian error adapter dan credential
         * tidak saling menutupi.
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
         * PENTING:
         *
         * Credential menggunakan:
         *
         *   provider_credentials.provider_id
         *
         * Jadi gunakan:
         *
         *   provider.provider_id
         *
         * bukan:
         *
         *   provider.provider_name
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
         *
         * Sekarang HARUS mencari:
         *
         * provider_credentials.provider_id
         *       =
         * providerCode
         *
         * Contoh:
         *
         * providerCode = kie
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
                error
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
         * QUERY KIE
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
                error
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
         * NORMALIZE KIE RESPONSE
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
                 * History diagnostics.
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

                /*
                 * Adapter diagnostics.
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
                 * Credential diagnostics.
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
            error
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
                    null
            }
        );
    }
}
