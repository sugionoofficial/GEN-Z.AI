// =========================================================
// GEN-Z.AI
// MODEL CONFIGURATION API
// ---------------------------------------------------------
// File:
// api/model-config.js
//
// Tanggung jawab:
// - Authentication user
// - Mengambil model aktif dari Supabase
// - Mengambil provider berdasarkan models.provider_id
// - Memuat adapter model
// - Mengembalikan konfigurasi model + parameter
//
// Tidak bertanggung jawab:
// - Generate task
// - Query task
// - Credit deduction
// - Generation history
// - Provider API key
//
// Arsitektur:
//
// GET /api/model-config
//        ↓
// profiles/session
//        ↓
// models
//        ↓
// providers
//        ↓
// model adapter
//        ↓
// parameters.js
// =========================================================

import grokImagineImageToVideo
    from "../models/grok-imagine-image-to-video/index.js";


// =========================================================
// ENVIRONMENT
// =========================================================

const SUPABASE_URL =
    process.env.SUPABASE_URL;

const SUPABASE_SERVICE_ROLE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

const SUPABASE_ANON_KEY =
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_KEY;


// =========================================================
// MODEL REGISTRY
// =========================================================
//
// Jangan dynamic import berdasarkan input user.
//
// Slash pada model_id tidak boleh dijadikan
// path filesystem.
//

const MODEL_REGISTRY = {

    "grok-imagine/image-to-video":
        grokImagineImageToVideo

};


// =========================================================
// JSON RESPONSE
// =========================================================

function json(
    res,
    status,
    data
) {

    return res
        .status(status)
        .json(data);

}


// =========================================================
// BEARER TOKEN
// =========================================================

function getBearerToken(
    req
) {

    const authorization =
        req.headers?.authorization ||
        "";

    if (
        typeof authorization !==
        "string"
    ) {

        return null;

    }

    if (
        !authorization
            .toLowerCase()
            .startsWith("bearer ")
    ) {

        return null;

    }

    const token =
        authorization
            .slice(7)
            .trim();

    return token || null;

}


// =========================================================
// SUPABASE REQUEST
// =========================================================

async function supabaseRequest(
    path,
    options = {}
) {

    if (
        !SUPABASE_URL
    ) {

        throw new Error(
            "SUPABASE_URL belum dikonfigurasi."
        );

    }

    const response =
        await fetch(
            `${SUPABASE_URL}${path}`,
            options
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

            data = {
                raw: text
            };

        }

    }

    return {
        response,
        data
    };

}


// =========================================================
// AUTHENTICATED USER
// =========================================================

async function getAuthenticatedUser(
    req
) {

    const token =
        getBearerToken(
            req
        );

    if (
        !token
    ) {

        return null;

    }

    if (
        !SUPABASE_URL ||
        !SUPABASE_ANON_KEY
    ) {

        throw new Error(
            "Konfigurasi Supabase authentication belum lengkap."
        );

    }

    const result =
        await supabaseRequest(
            "/auth/v1/user",
            {

                method:
                    "GET",

                headers: {

                    apikey:
                        SUPABASE_ANON_KEY,

                    Authorization:
                        `Bearer ${token}`,

                    Accept:
                        "application/json"

                }

            }
        );

    if (
        !result.response.ok ||
        !result.data?.id
    ) {

        return null;

    }

    return result.data;

}


// =========================================================
// DATABASE QUERY
// =========================================================

async function supabaseQuery(
    table,
    params = {}
) {

    if (
        !SUPABASE_URL ||
        !SUPABASE_SERVICE_ROLE_KEY
    ) {

        throw new Error(
            "Konfigurasi Supabase server belum lengkap."
        );

    }

    const url =
        new URL(
            `${SUPABASE_URL}/rest/v1/${table}`
        );

    for (
        const [
            key,
            value
        ]
        of Object.entries(params)
    ) {

        if (
            value === undefined ||
            value === null
        ) {

            continue;

        }

        url.searchParams.set(
            key,
            String(value)
        );

    }

    const response =
        await fetch(
            url,
            {

                method:
                    "GET",

                headers: {

                    apikey:
                        SUPABASE_SERVICE_ROLE_KEY,

                    Authorization:
                        `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,

                    Accept:
                        "application/json"

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

            data = null;

        }

    }

    if (
        !response.ok
    ) {

        const message =
            data?.message ||
            data?.details ||
            data?.hint ||
            data?.error ||
            `Supabase query gagal (${response.status}).`;

        throw new Error(
            message
        );

    }

    return Array.isArray(data)
        ? data
        : [];

}


// =========================================================
// MODEL
// =========================================================

async function loadModels(
    requestedModelId = ""
) {

    const params = {

        select:
            [
                "id",
                "provider_id",
                "model_id",
                "model_name",
                "description",
                "credit_cost",
                "discount_percent",
                "credit_final",
                "min_duration",
                "max_duration",
                "supported_ratios",
                "supported_resolutions",
                "status",
                "created_at",
                "updated_at"
            ].join(","),

        status:
            "eq.active",

        order:
            "created_at.asc"

    };

    if (
        requestedModelId
    ) {

        params.model_id =
            `eq.${encodeURIComponent(
                requestedModelId
            )}`;

        params.limit =
            "1";

    }

    return supabaseQuery(
        "models",
        params
    );

}


// =========================================================
// PROVIDER
// =========================================================
//
// models.provider_id
//         ↓
// providers.id
//

async function loadProvider(
    providerDatabaseId
) {

    if (
        !providerDatabaseId
    ) {

        return null;

    }

    const rows =
        await supabaseQuery(
            "providers",
            {

                select:
                    [
                        "id",
                        "provider_id",
                        "provider_name",
                        "description",
                        "status",
                        "is_default"
                    ].join(","),

                id:
                    `eq.${encodeURIComponent(
                        providerDatabaseId
                    )}`,

                limit:
                    "1"

            }
        );

    return rows[0] || null;

}


// =========================================================
// NORMALIZE ARRAY
// =========================================================

function normalizeArray(
    value
) {

    if (
        Array.isArray(value)
    ) {

        return value;

    }

    if (
        typeof value === "string"
    ) {

        const text =
            value.trim();

        if (
            !text
        ) {

            return [];

        }

        try {

            const parsed =
                JSON.parse(
                    text
                );

            if (
                Array.isArray(parsed)
            ) {

                return parsed;

            }

        } catch {

            return text
                .split(",")
                .map(
                    item =>
                        item.trim()
                )
                .filter(Boolean);

        }

    }

    return [];

}


// =========================================================
// CLEAN PARAMETER FOR FRONTEND
// =========================================================
//
// Parameter object dari adapter boleh mempunyai
// fungsi validate. Fungsi tersebut tidak boleh
// dikirim ke browser.
//
// Kita hanya mengirim metadata.
//

function serializeParameters(
    parameters
) {

    if (
        !parameters ||
        typeof parameters !==
            "object"
    ) {

        return {};

    }

    const result = {};

    for (
        const [
            name,
            definition
        ]
        of Object.entries(
            parameters
        )
    ) {

        if (
            !definition ||
            typeof definition !==
                "object"
        ) {

            continue;

        }

        const item = {

            name,

            type:
                definition.type ||
                "string",

            required:
                Boolean(
                    definition.required
                )

        };

        if (
            definition.enum
        ) {

            item.enum =
                Array.isArray(
                    definition.enum
                )
                    ? [
                        ...definition.enum
                    ]
                    : [];

        }

        if (
            definition.default !==
            undefined
        ) {

            item.default =
                definition.default;

        }

        if (
            definition.min !==
            undefined
        ) {

            item.min =
                definition.min;

        }

        if (
            definition.max !==
            undefined
        ) {

            item.max =
                definition.max;

        }

        if (
            definition.maxItems !==
            undefined
        ) {

            item.maxItems =
                definition.maxItems;

        }

        if (
            definition.description
        ) {

            item.description =
                definition.description;

        }

        result[name] =
            item;

    }

    return result;

}


// =========================================================
// ADAPTER
// =========================================================

function getAdapter(
    modelId
) {

    const adapter =
        MODEL_REGISTRY[
            modelId
        ];

    if (
        !adapter
    ) {

        const error =
            new Error(
                `Adapter model "${modelId}" belum tersedia.`
            );

        error.code =
            "MODEL_ADAPTER_NOT_FOUND";

        throw error;

    }

    return adapter;

}


// =========================================================
// BUILD MODEL RESPONSE
// =========================================================

function buildModelResponse(
    model,
    provider,
    adapter
) {

    const adapterProviderId =
        String(
            adapter?.config?.providerId ||
            ""
        ).trim();

    const databaseProviderId =
        String(
            provider?.provider_id ||
            ""
        ).trim();

    if (
        adapterProviderId &&
        databaseProviderId &&
        adapterProviderId !==
            databaseProviderId
    ) {

        const error =
            new Error(
                "Provider model tidak sesuai dengan provider database."
            );

        error.code =
            "MODEL_PROVIDER_MISMATCH";

        throw error;

    }

    return {

        id:
            model.id,

        model_id:
            model.model_id,

        model_name:
            model.model_name,

        description:
            model.description,

        provider: {

            id:
                provider?.id ||
                null,

            provider_id:
                provider?.provider_id ||
                null,

            provider_name:
                provider?.provider_name ||
                null,

            status:
                provider?.status ||
                null

        },

        pricing: {

            credit_cost:
                model.credit_cost,

            discount_percent:
                model.discount_percent,

            credit_final:
                model.credit_final

        },

        duration: {

            min:
                model.min_duration,

            max:
                model.max_duration

        },

        supported_ratios:
            normalizeArray(
                model.supported_ratios
            ),

        supported_resolutions:
            normalizeArray(
                model.supported_resolutions
            ),

        status:
            model.status,

        parameters:
            serializeParameters(
                adapter?.parameters
            )

    };

}


// =========================================================
// HANDLER
// =========================================================

export default async function handler(
    req,
    res
) {

    // =====================================================
    // CORS
    // =====================================================

    res.setHeader(
        "Access-Control-Allow-Origin",
        "*"
    );

    res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization"
    );

    res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, OPTIONS"
    );

    res.setHeader(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, proxy-revalidate"
    );


    // =====================================================
    // OPTIONS
    // =====================================================

    if (
        req.method === "OPTIONS"
    ) {

        return res
            .status(204)
            .end();

    }


    // =====================================================
    // METHOD
    // =====================================================

    if (
        req.method !== "GET"
    ) {

        return json(
            res,
            405,
            {

                success:
                    false,

                error:
                    "Method tidak didukung."

            }
        );

    }


    // =====================================================
    // ENVIRONMENT
    // =====================================================

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


    if (
        !SUPABASE_ANON_KEY
    ) {

        return json(
            res,
            500,
            {

                success:
                    false,

                error:
                    "SUPABASE_ANON_KEY atau SUPABASE_KEY belum dikonfigurasi."

            }
        );

    }


    // =====================================================
    // AUTH
    // =====================================================

    let user;

    try {

        user =
            await getAuthenticatedUser(
                req
            );

    } catch (error) {

        console.error(
            "[model-config] authentication error:",
            error.message
        );

        return json(
            res,
            500,
            {

                success:
                    false,

                error:
                    "Gagal memverifikasi session."

            }
        );

    }


    if (
        !user?.id
    ) {

        return json(
            res,
            401,
            {

                success:
                    false,

                error:
                    "Session tidak ditemukan atau sudah kedaluwarsa."

            }
        );

    }


    // =====================================================
    // QUERY MODEL
    // =====================================================

    const requestedModelId =
        String(
            req.query?.model_id ||
            req.query?.model ||
            ""
        ).trim();


    let models;

    try {

        models =
            await loadModels(
                requestedModelId
            );

    } catch (error) {

        console.error(
            "[model-config] model query error:",
            error.message
        );

        return json(
            res,
            500,
            {

                success:
                    false,

                error:
                    "Gagal mengambil konfigurasi model."

            }
        );

    }


    if (
        !models.length
    ) {

        return json(
            res,
            404,
            {

                success:
                    false,

                error:
                    requestedModelId
                        ? `Model "${requestedModelId}" tidak ditemukan atau tidak aktif.`
                        : "Belum ada model aktif."

            }
        );

    }


    // =====================================================
    // BUILD MODELS
    // =====================================================

    const result =
        [];

    for (
        const model
        of models
    ) {

        try {

            const provider =
                await loadProvider(
                    model.provider_id
                );

            if (
                !provider
            ) {

                console.error(
                    "[model-config] provider tidak ditemukan:",
                    model.model_id
                );

                continue;

            }

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

                continue;

            }

            const adapter =
                getAdapter(
                    model.model_id
                );

            result.push(
                buildModelResponse(
                    model,
                    provider,
                    adapter
                )
            );

        } catch (error) {

            console.error(
                "[model-config] model error:",
                model.model_id,
                error.message
            );

            if (
                requestedModelId
            ) {

                return json(
                    res,
                    409,
                    {

                        success:
                            false,

                        error:
                            error.message ||
                            "Konfigurasi model tidak valid."

                    }
                );

            }

        }

    }


    if (
        !result.length
    ) {

        return json(
            res,
            404,
            {

                success:
                    false,

                error:
                    "Tidak ada model aktif yang memiliki provider dan adapter valid."

            }
        );

    }


    // =====================================================
    // RESPONSE
    // =====================================================

    return json(
        res,
        200,
        {

            success:
                true,

            models:
                result,

            model:
                result[0] ||

                null,

            count:
                result.length

        }
    );

}
