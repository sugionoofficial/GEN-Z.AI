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
 * ARSITEKTUR:
 *
 *   Supabase:
 *       models
 *          ↓
 *       model_id
 *          ↓
 *       MODEL_REGISTRY
 *          ↓
 *       adapter model
 *
 *   Supabase:
 *       models.provider_id
 *          ↓
 *       providers.id
 *          ↓
 *       provider configuration
 *
 * MODEL SOURCE OF TRUTH:
 * - Supabase models
 *
 * PROVIDER SOURCE OF TRUTH:
 * - Supabase providers
 *
 * ADAPTER SOURCE OF TRUTH:
 * - models/<model-folder>/index.js
 *
 * MODEL_REGISTRY HANYA DIGUNAKAN UNTUK:
 * - memetakan model_id ke adapter
 * - parameters
 * - validation
 * - createTask
 * - queryTask
 * - API metadata
 *
 * TIDAK DIGUNAKAN UNTUK:
 * - daftar model
 * - model name administratif
 * - provider database
 * - pricing administratif
 * - status administratif
 *
 * =========================================================
 */

import grokImagineImageToVideo from "../models/grok-imagine-image-to-video/index.js";


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
   Registry ini BUKAN daftar model yang tersedia.
 *
   Registry hanya memetakan:
 *
   model_id
      ↓
   adapter
 *
   Model yang boleh tampil tetap berasal dari:
 *
   Supabase -> models
 *
   Untuk model baru:
 *
   import model2 from "../models/model-folder/index.js";
 *
   lalu:
 *
   "model-2/id": model2
 *
   ========================================================= */

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
         * PostgreSQL array:
         *
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
                 * Fallback ke comma separated.
                 */

            }

        }


        /*
         * Comma separated.
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

    if (
        !parameters
    ) {

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
   SUPABASE MODELS ADALAH SOURCE OF TRUTH.
 *
   Tidak ada fallback ke model folder.
 *
   Jika model tidak ada di tabel models,
   model dianggap tidak tersedia.
 *
   ========================================================= */

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
   Semua model Generate berasal dari Supabase.
 *
   MODEL_REGISTRY hanya digunakan untuk mencari adapter.
 *
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
   Identity administratif berasal dari Supabase.
 *
   Technical adapter data berasal dari model folder.
 *
   ========================================================= */

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
     * -------------------------------------------------------
     * MODEL ID
     * -------------------------------------------------------
     *
     * SUPABASE ADALAH SOURCE OF TRUTH.
     */

    const modelId =
        String(
            databaseModel?.model_id ||
            ""
        ).trim();


    /*
     * -------------------------------------------------------
     * MODEL NAME
     * -------------------------------------------------------
     */

    const modelName =
        String(
            databaseModel?.model_name ||
            config.name ||
            modelId
        ).trim();


    /*
     * -------------------------------------------------------
     * PROVIDER
     * -------------------------------------------------------
     *
     * Provider berasal dari Supabase.
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
     * -------------------------------------------------------
     * PARAMETER TEKNIS
     * -------------------------------------------------------
     *
     * Adapter tetap menjadi sumber parameter
     * teknis yang diperlukan engine.
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
     * -------------------------------------------------------
     * DATABASE PARAMETER
     * -------------------------------------------------------
     *
     * Jika kolom tersedia di models,
     * gunakan data tersebut.
     *
     * Jika kosong, gunakan parameter adapter.
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
     * -------------------------------------------------------
     * DURATION
     * -------------------------------------------------------
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
     * -------------------------------------------------------
     * PRICING
     * -------------------------------------------------------
     *
     * Pricing administratif berasal dari Supabase.
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
     * -------------------------------------------------------
     * STATUS MODEL
     * -------------------------------------------------------
     */

    const modelStatus =
        String(
            databaseModel?.status ||
            ""
        )
            .trim()
            .toLowerCase();


    /*
     * -------------------------------------------------------
     * TYPE
     * -------------------------------------------------------
     *
     * Preferensi:
     * Supabase -> adapter config
     */

    const modelType =
        String(
            databaseModel?.type ||
            config.type ||
            "unknown"
        ).trim();


    return {

        /*
         * Database primary key.
         */

        id:
            databaseModel?.id ||
            null,


        /*
         * ---------------------------------------------------
         * MODEL IDENTITY
         * ---------------------------------------------------
         */

        model_id:
            modelId,

        model_name:
            modelName,


        description:
            String(
                databaseModel?.description ||
                ""
            ).trim(),


        type:
            modelType,


        /*
         * ---------------------------------------------------
         * PROVIDER
         * ---------------------------------------------------
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
         * ---------------------------------------------------
         * PRICING
         * ---------------------------------------------------
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
         * ---------------------------------------------------
         * DURATION
         * ---------------------------------------------------
         */

        duration: {

            min:
                minDuration,

            max:
                maxDuration

        },


        /*
         * ---------------------------------------------------
         * SUPPORTED RATIOS
         * ---------------------------------------------------
         */

        supported_ratios:
            finalRatios,


        /*
         * ---------------------------------------------------
         * SUPPORTED RESOLUTIONS
         * ---------------------------------------------------
         */

        supported_resolutions:
            finalResolutions,


        /*
         * ---------------------------------------------------
         * STATUS
         * ---------------------------------------------------
         */

        status:
            modelStatus,


        /*
         * ---------------------------------------------------
         * SOURCE
         * ---------------------------------------------------
         */

        source:
            "supabase",


        /*
         * ---------------------------------------------------
         * PARAMETERS
         * ---------------------------------------------------
         *
         * Function validate tidak dikirim.
         */

        parameters:
            serializeParameters(
                parameters
            ),


        /*
         * ---------------------------------------------------
         * API METADATA
         * ---------------------------------------------------
         *
         * Ini hanya metadata adapter.
         * Bukan endpoint provider credential.
         */

        api: {

            createTask:
                config.api?.createTask ||
                null,

            queryTask:
                config.api?.queryTask ||
                null

        }

    };

}


/* =========================================================
   RESOLVE ONE MODEL
   ========================================================= */

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
     * -------------------------------------------------------
     * 1. MODEL HARUS ADA DI SUPABASE
     * -------------------------------------------------------
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
     * -------------------------------------------------------
     * 2. MODEL HARUS ACTIVE
     * -------------------------------------------------------
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
     * -------------------------------------------------------
     * 3. ADAPTER HARUS TERSEDIA
     * -------------------------------------------------------
     *
     * Supabase menentukan MODEL APA yang tersedia.
     *
     * Registry menentukan BAGAIMANA model tersebut
     * dijalankan.
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
                    modelId

            }

        };

    }


    /*
     * -------------------------------------------------------
     * 4. PROVIDER WAJIB MENGIKUTI models.provider_id
     * -------------------------------------------------------
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
     * -------------------------------------------------------
     * 5. PROVIDER HARUS ACTIVE
     * -------------------------------------------------------
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
     * -------------------------------------------------------
     * 6. VALIDASI ADAPTER ID
     * -------------------------------------------------------
     *
     * Adapter boleh mendeskripsikan ID teknisnya,
     * tetapi tidak boleh menggantikan model_id Supabase.
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
     * -------------------------------------------------------
     * 7. BUILD FINAL CONFIG
     * -------------------------------------------------------
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
   LOAD ALL MODELS
   ---------------------------------------------------------
   PENTING:
 *
 * Jangan iterasi MODEL_REGISTRY.
 *
 * MODEL_REGISTRY bukan daftar model.
 *
 * Daftar model harus berasal dari Supabase.
 *
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
         * Hanya model active yang boleh
         * masuk ke Generate.
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


        try {

            const resolved =
                await resolveModel(
                    modelId
                );


            if (
                resolved?.model
            ) {

                result.push(
                    resolved.model
                );

            } else {

                console.warn(
                    `[model-config] Model skipped: ${modelId}`,
                    resolved?.error ||
                    "Unknown error"
                );

            }

        } catch (err) {

            console.error(
                `[model-config] Failed resolving ${modelId}:`,
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
     * -------------------------------------------------------
     * METHOD
     * -------------------------------------------------------
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
     * -------------------------------------------------------
     * AUTH
     * -------------------------------------------------------
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
     * -------------------------------------------------------
     * REQUESTED MODEL
     * -------------------------------------------------------
     */

    const requestedModelId =
        getQueryModelId(
            req
        );


    /*
     * -------------------------------------------------------
     * SINGLE MODEL
     * -------------------------------------------------------
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

                let status = 404;


                if (
                    resolved.error ===
                    "Model is not active"
                ) {

                    status = 409;

                }


                if (
                    resolved.error ===
                    "Model provider is not active"
                ) {

                    status = 409;

                }


                if (
                    resolved.error ===
                    "Model provider is not configured"
                ) {

                    status = 409;

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
     * -------------------------------------------------------
     * ALL ACTIVE MODELS
     * -------------------------------------------------------
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
