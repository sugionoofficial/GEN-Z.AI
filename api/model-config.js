/**
 * =========================================================
 * GEN-Z.AI
 * MODEL CONFIG API
 * ---------------------------------------------------------
 * File:
 *   api/model-config.js
 *
 * Endpoint:
 *   GET /api/model-config
 *   GET /api/model-config?model_id=grok-imagine/image-to-video
 *
 * =========================================================
 *
 * ARSITEKTUR
 *
 * MODEL SOURCE OF TRUTH
 *
 *   Admin Models
 *        |
 *        v
 *   Supabase: models
 *        |
 *        +-- model_id
 *        +-- model_name
 *        +-- provider_id
 *        +-- description
 *        +-- status
 *        +-- credit
 *        +-- duration
 *        +-- ratios
 *        +-- resolutions
 *
 *
 * PROVIDER SOURCE OF TRUTH
 *
 *   Supabase: providers
 *        |
 *        +-- provider_id
 *        +-- provider_name
 *        +-- status
 *
 *
 * ADAPTER SOURCE OF TRUTH
 *
 *   models/<model-folder>/index.js
 *
 *
 * MODEL_REGISTRY
 *
 *   BUKAN daftar model.
 *
 *   Hanya digunakan untuk:
 *
 *   model_id
 *        |
 *        v
 *   adapter
 *
 *
 * API KEY / CREDENTIAL
 *
 *   TIDAK PERNAH dikirim ke frontend.
 *
 * =========================================================
 */


/* =========================================================
   MODEL ADAPTER IMPORTS
   ========================================================= */

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


/* =========================================================
   MODEL ADAPTER REGISTRY
   ---------------------------------------------------------
   PENTING:
 *
 * Registry ini BUKAN daftar model.
 *
 * Daftar model berasal dari:
 *
 *   Supabase -> models
 *
 * Registry hanya memetakan:
 *
 *   model_id
 *       ↓
 *   adapter
 *
 * Untuk menambahkan adapter:
 *
 *   import modelAdapter
 *       from "../models/model-folder/index.js";
 *
 * lalu:
 *
 *   "model-id": modelAdapter
 *
 * ========================================================= */

const MODEL_REGISTRY = Object.freeze({

    "grok-imagine/image-to-video":
        grokImagineImageToVideo

});


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


function error(
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

        const message =

            typeof data ===
                "object" &&
            data !== null

                ? (
                    data.message ||
                    data.error_description ||
                    data.error ||
                    `Supabase request failed with status ${response.status}`
                )

                : `Supabase request failed with status ${response.status}`;


        const err =
            new Error(
                message
            );


        err.status =
            response.status;


        err.data =
            data;


        throw err;

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
   QUERY PARAMETER
   ========================================================= */

function getQueryModelId(
    req
) {

    const url =
        new URL(
            req.url ||
                "/api/model-config",

            "http://localhost"
        );


    const modelId =
        url.searchParams.get(
            "model_id"
        );


    if (!modelId) {

        return null;

    }


    return modelId.trim();

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
         * PostgreSQL array
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
         * JSON array
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
                 * fallback CSV
                 */

            }

        }


        /*
         * CSV
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
   NUMBER NORMALIZER
   ========================================================= */

function normalizeNumber(
    value,
    fallback = null
) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return fallback;

    }


    const number =
        Number(
            value
        );


    return Number.isFinite(
        number
    )
        ? number
        : fallback;

}


/* =========================================================
   PARAMETER SERIALIZER
   ---------------------------------------------------------
   Function seperti validate() tidak boleh dikirim
   ke browser.
   ========================================================= */

function serializeParameters(
    parameters
) {

    if (!parameters) {

        return {};

    }


    if (
        Array.isArray(
            parameters
        )
    ) {

        return parameters.map(
            parameter => {

                if (
                    !parameter ||
                    typeof parameter !==
                        "object"
                ) {

                    return parameter;

                }


                const output = {};


                for (
                    const [
                        key,
                        value
                    ]
                    of Object.entries(
                        parameter
                    )
                ) {

                    if (
                        typeof value ===
                        "function"
                    ) {

                        continue;

                    }


                    if (
                        key ===
                        "validate"
                    ) {

                        continue;

                    }


                    output[key] =
                        value;

                }


                return output;

            }
        );

    }


    if (
        typeof parameters ===
        "object"
    ) {

        const output = {};


        for (
            const [
                key,
                value
            ]
            of Object.entries(
                parameters
            )
        ) {

            if (
                typeof value ===
                "function"
            ) {

                continue;

            }


            if (
                value &&
                typeof value ===
                    "object" &&
                !Array.isArray(
                    value
                )
            ) {

                const item = {};


                for (
                    const [
                        subKey,
                        subValue
                    ]
                    of Object.entries(
                        value
                    )
                ) {

                    if (
                        typeof subValue ===
                        "function"
                    ) {

                        continue;

                    }


                    if (
                        subKey ===
                        "validate"
                    ) {

                        continue;

                    }


                    item[subKey] =
                        subValue;

                }


                output[key] =
                    item;


                continue;

            }


            output[key] =
                value;

        }


        return output;

    }


    return {};

}


/* =========================================================
   MODEL ADAPTER LOOKUP
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
   LOAD MODEL FROM SUPABASE
   ---------------------------------------------------------
   MODEL SOURCE OF TRUTH:
 *
 *   Supabase -> models
 *
 * Tidak ada fallback ke registry.
 * ========================================================= */

async function loadDatabaseModel(
    modelId
) {

    if (
        !SUPABASE_URL ||
        !SUPABASE_SERVICE_ROLE_KEY
    ) {

        throw new Error(
            "Supabase configuration is not available"
        );

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


    const rows =
        await supabaseRequest(
            `/rest/v1/models?${params.toString()}`,
            {
                method: "GET"
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

}


/* =========================================================
   LOAD ALL DATABASE MODELS
   ---------------------------------------------------------
   SEMUA MODEL BERASAL DARI ADMIN MODELS.
   ========================================================= */

async function loadDatabaseModels() {

    if (
        !SUPABASE_URL ||
        !SUPABASE_SERVICE_ROLE_KEY
    ) {

        throw new Error(
            "Supabase configuration is not available"
        );

    }


    const params =
        new URLSearchParams();


    params.set(
        "select",
        "*"
    );


    params.set(
        "order",
        "created_at.asc"
    );


    const rows =
        await supabaseRequest(
            `/rest/v1/models?${params.toString()}`,
            {
                method: "GET"
            }
        );


    if (
        !Array.isArray(
            rows
        )
    ) {

        return [];

    }


    return rows;

}


/* =========================================================
   LOAD PROVIDER BY DATABASE ID
   ---------------------------------------------------------
   models.provider_id
          ↓
   providers.id
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
                method: "GET"
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
   BUILD MODEL CONFIG
   ---------------------------------------------------------
   Identity administratif:
 *
 *   Supabase models
 *
 * Provider:
 *
 *   Supabase providers
 *
 * Technical adapter:
 *
 *   model folder
 *
 * ========================================================= */

function buildModelConfig(
    adapter,
    databaseModel,
    provider
) {

    const config =
        adapter?.config ||
        {};


    const parameters =
        adapter?.parameters ||
        {};


    /*
     * MODEL ID
     *
     * SOURCE OF TRUTH:
     * Supabase models
     */

    const modelId =
        String(
            databaseModel?.model_id ||
            ""
        ).trim();


    /*
     * MODEL NAME
     */

    const modelName =
        String(
            databaseModel?.model_name ||
            config.name ||
            modelId
        ).trim();


    /*
     * PROVIDER
     */

    const providerId =
        String(
            provider?.provider_id ||
            ""
        ).trim();


    const providerName =
        String(
            provider?.provider_name ||
            provider?.name ||
            ""
        ).trim();


    /*
     * PARAMETERS DARI ADAPTER
     */

    const ratioParameter =
        parameters.aspect_ratio ||
        null;


    const resolutionParameter =
        parameters.resolution ||
        null;


    const durationParameter =
        parameters.duration ||
        null;


    const folderRatios =
        normalizeArray(
            ratioParameter?.enum
        );


    const folderResolutions =
        normalizeArray(
            resolutionParameter?.enum
        );


    /*
     * PARAMETER DARI ADMIN MODELS
     */

    const databaseRatios =
        normalizeArray(
            databaseModel?.supported_ratios
        );


    const databaseResolutions =
        normalizeArray(
            databaseModel?.supported_resolutions
        );


    const finalRatios =
        databaseRatios.length
            ? databaseRatios
            : folderRatios;


    const finalResolutions =
        databaseResolutions.length
            ? databaseResolutions
            : folderResolutions;


    /*
     * DURATION
     */

    const folderMinDuration =
        normalizeNumber(
            durationParameter?.min
        );


    const folderMaxDuration =
        normalizeNumber(
            durationParameter?.max
        );


    const databaseMinDuration =
        normalizeNumber(
            databaseModel?.min_duration
        );


    const databaseMaxDuration =
        normalizeNumber(
            databaseModel?.max_duration
        );


    const minDuration =
        databaseMinDuration !== null
            ? databaseMinDuration
            : folderMinDuration;


    const maxDuration =
        databaseMaxDuration !== null
            ? databaseMaxDuration
            : folderMaxDuration;


    /*
     * CREDIT
     */

    const creditCost =
        normalizeNumber(
            databaseModel?.credit_cost,
            0
        );


    const discountPercent =
        normalizeNumber(
            databaseModel?.discount_percent,
            0
        );


    let creditFinal =
        normalizeNumber(
            databaseModel?.credit_final
        );


    if (
        creditFinal === null
    ) {

        creditFinal =
            discountPercent > 0

                ? creditCost -
                    (
                        creditCost *
                        discountPercent /
                        100
                    )

                : creditCost;

    }


    /*
     * STATUS
     */

    const modelStatus =
        String(
            databaseModel?.status ||
            ""
        )
            .trim()
            .toLowerCase();


    /*
     * TYPE
     */

    const modelType =
        String(
            databaseModel?.type ||
            databaseModel?.model_type ||
            config.type ||
            "unknown"
        ).trim();


    /*
     * FINAL OBJECT
     */

    return {

        id:
            databaseModel?.id ||
            null,


        /*
         * MODEL ID
         */

        model_id:
            modelId,


        /*
         * MODEL NAME
         */

        model_name:
            modelName,


        /*
         * DESCRIPTION
         */

        description:
            String(
                databaseModel?.description ||
                ""
            ).trim(),


        /*
         * TYPE
         */

        type:
            modelType,


        /*
         * PROVIDER
         */

        provider: {

            id:
                provider?.id ||
                null,

            provider_id:
                providerId,

            provider_name:
                providerName,

            status:
                String(
                    provider?.status ||
                    ""
                )
                    .trim()
                    .toLowerCase()

        },


        /*
         * COMPATIBILITY FIELD
         */

        provider_id:
            provider?.id ||
            databaseModel?.provider_id ||
            null,


        provider_code:
            providerId,


        /*
         * PRICING
         */

        pricing: {

            credit_cost:
                creditCost,

            discount_percent:
                discountPercent,

            credit_final:
                creditFinal

        },


        /*
         * COMPATIBILITY PRICING FIELDS
         */

        credit_cost:
            creditCost,

        discount_percent:
            discountPercent,

        credit_final:
            creditFinal,


        /*
         * DURATION
         */

        duration: {

            min:
                minDuration,

            max:
                maxDuration

        },


        /*
         * COMPATIBILITY DURATION FIELDS
         */

        min_duration:
            minDuration,

        max_duration:
            maxDuration,


        /*
         * SUPPORTED RATIOS
         */

        supported_ratios:
            finalRatios,


        /*
         * SUPPORTED RESOLUTIONS
         */

        supported_resolutions:
            finalResolutions,


        /*
         * STATUS
         */

        status:
            modelStatus,


        /*
         * SOURCE
         */

        source:
            "admin-model",


        /*
         * PARAMETERS
         *
         * Adapter boleh null untuk model yang belum
         * mempunyai adapter.
         */

        parameters:
            serializeParameters(
                parameters
            ),


        /*
         * API
         */

        api: {

            createTask:
                config.api?.createTask ||
                null,

            queryTask:
                config.api?.queryTask ||
                null

        },


        /*
         * ADAPTER STATUS
         */

        adapter_available:
            Boolean(
                adapter
            )

    };

}


/* =========================================================
   RESOLVE ONE MODEL
   ---------------------------------------------------------
   resolveModel() digunakan untuk request:
 *
 *   /api/model-config?model_id=...
 *
 * Untuk single model, adapter WAJIB tersedia karena
 * model tersebut akan digunakan untuk execution.
 * ========================================================= */

async function resolveModel(
    modelId
) {

    if (!modelId) {

        return {

            error:
                "Model ID is required"

        };

    }


    /*
     * 1.
     * MODEL HARUS ADA DI ADMIN MODELS
     */

    const databaseModel =
        await loadDatabaseModel(
            modelId
        );


    if (!databaseModel) {

        return {

            error:
                "Model not found",

            details: {

                model_id:
                    modelId

            }

        };

    }


    /*
     * 2.
     * MODEL HARUS ACTIVE
     */

    const modelStatus =
        String(
            databaseModel.status ||
            ""
        )
            .trim()
            .toLowerCase();


    if (
        modelStatus !==
        "active"
    ) {

        return {

            error:
                "Model is not active",

            details: {

                model_id:
                    modelId,

                status:
                    databaseModel.status ||
                    null

            }

        };

    }


    /*
     * 3.
     * ADAPTER
     */

    const adapter =
        getModelAdapter(
            modelId
        );


    if (!adapter) {

        return {

            error:
                "Model adapter is not registered",

            details: {

                model_id:
                    modelId,

                adapter_available:
                    false

            }

        };

    }


    /*
     * 4.
     * PROVIDER ID
     */

    if (
        !databaseModel.provider_id
    ) {

        return {

            error:
                "Model provider is not configured",

            details: {

                model_id:
                    modelId

            }

        };

    }


    /*
     * 5.
     * PROVIDER
     */

    const provider =
        await loadProviderByDatabaseId(
            databaseModel.provider_id
        );


    if (!provider) {

        return {

            error:
                "Provider not found",

            details: {

                model_id:
                    modelId,

                provider_database_id:
                    databaseModel.provider_id

            }

        };

    }


    /*
     * 6.
     * PROVIDER ACTIVE
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

            error:
                "Model provider is not active",

            details: {

                model_id:
                    modelId,

                provider_id:
                    provider.provider_id ||
                    null,

                provider_name:
                    provider.provider_name ||
                    provider.name ||
                    null,

                provider_status:
                    provider.status ||
                    null

            }

        };

    }


    /*
     * 7.
     * VALIDASI ADAPTER ID
     */

    const adapterModelId =
        String(
            adapter?.config?.id ||
            ""
        ).trim();


    if (
        adapterModelId &&
        adapterModelId !==
            modelId
    ) {

        return {

            error:
                "Model adapter configuration mismatch",

            details: {

                model_id:
                    modelId,

                adapter_model_id:
                    adapterModelId

            }

        };

    }


    /*
     * 8.
     * BUILD
     */

    return {

        model:
            buildModelConfig(
                adapter,
                databaseModel,
                provider
            )

    };

}


/* =========================================================
   LOAD ALL ACTIVE MODELS
   ---------------------------------------------------------
   PENTING:
 *
 * JANGAN ITERASI MODEL_REGISTRY.
 *
 * Semua model berasal dari Admin Models.
 *
 * Model tanpa adapter TETAP masuk ke daftar.
 *
 * Tujuannya:
 *
 *   Admin Models
 *        ↓
 *   Generate model selector
 *
 * Adapter hanya diperlukan saat execution.
 * ========================================================= */

async function loadAllModels() {

    const databaseModels =
        await loadDatabaseModels();


    const result = [];


    for (
        const databaseModel
        of databaseModels
    ) {

        const modelId =
            String(
                databaseModel?.model_id ||
                ""
            ).trim();


        if (!modelId) {

            console.warn(
                "[model-config] Model row skipped because model_id is empty"
            );


            continue;

        }


        /*
         * HANYA MODEL ACTIVE
         */

        const modelStatus =
            String(
                databaseModel?.status ||
                ""
            )
                .trim()
                .toLowerCase();


        if (
            modelStatus !==
            "active"
        ) {

            continue;

        }


        /*
         * PROVIDER HARUS TERHUBUNG
         */

        if (
            !databaseModel.provider_id
        ) {

            console.warn(
                `[model-config] Model skipped because provider_id is missing: ${modelId}`
            );


            continue;

        }


        try {

            const provider =
                await loadProviderByDatabaseId(
                    databaseModel.provider_id
                );


            if (!provider) {

                console.warn(
                    `[model-config] Model skipped because provider was not found: ${modelId}`
                );


                continue;

            }


            /*
             * Provider inactive tidak boleh
             * menjadi model yang bisa digunakan.
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

                console.warn(
                    `[model-config] Model skipped because provider is inactive: ${modelId}`
                );


                continue;

            }


            /*
             * ADAPTER OPTIONAL UNTUK LIST.
             *
             * Ini inti perbaikannya.
             */

            const adapter =
                getModelAdapter(
                    modelId
                );


            /*
             * Jika adapter belum tersedia,
             * model tetap masuk response.
             *
             * adapter_available = false
             */

            const model =
                buildModelConfig(
                    adapter,
                    databaseModel,
                    provider
                );


            result.push(
                model
            );


        } catch (err) {

            /*
             * Satu model error tidak boleh
             * menghentikan seluruh daftar model.
             */

            console.error(
                `[model-config] Failed loading model ${modelId}:`,
                err
            );

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
     * METHOD
     */

    if (
        req.method !==
        "GET"
    ) {

        res.setHeader(
            "Allow",
            "GET"
        );


        return error(
            res,
            405,
            "Method not allowed"
        );

    }


    /*
     * AUTHENTICATION
     */

    try {

        await authenticateUser(
            req
        );

    } catch (err) {

        return error(
            res,
            err.status ||
                401,

            err.message ||
                "Unauthorized"
        );

    }


    /*
     * REQUESTED MODEL
     */

    const requestedModelId =
        getQueryModelId(
            req
        );


    /*
     * =====================================================
     * SINGLE MODEL
     * =====================================================
     */

    if (
        requestedModelId
    ) {

        try {

            const resolved =
                await resolveModel(
                    requestedModelId
                );


            if (
                resolved?.error
            ) {

                let status =
                    404;


                if (
                    resolved.error ===
                    "Model is not active"
                ) {

                    status =
                        409;

                }


                if (
                    resolved.error ===
                    "Model provider is not active"
                ) {

                    status =
                        409;

                }


                if (
                    resolved.error ===
                    "Model provider is not configured"
                ) {

                    status =
                        409;

                }


                if (
                    resolved.error ===
                    "Model adapter is not registered"
                ) {

                    status =
                        409;

                }


                return error(
                    res,
                    status,
                    resolved.error,
                    resolved.details ||
                        {}
                );

            }


            return success(
                res,
                {

                    model:
                        resolved.model

                }
            );

        } catch (err) {

            console.error(
                "[model-config] Failed loading requested model:",
                err
            );


            return error(
                res,
                500,
                "Failed to load model configuration"
            );

        }

    }


    /*
     * =====================================================
     * ALL ACTIVE MODELS
     * =====================================================
     *
     * INI YANG DIPAKAI GENERATE MODEL SELECTOR.
     *
     * Source:
     *
     *   Admin Models
     *       ↓
     *   Supabase models
     *
     * BUKAN:
     *
     *   MODEL_REGISTRY
     */

    try {

        const models =
            await loadAllModels();


        return success(
            res,
            {

                models

            }
        );

    } catch (err) {

        console.error(
            "[model-config] Failed loading models:",
            err
        );


        return error(
            res,
            500,
            "Failed to load model configurations"
        );

    }

}
