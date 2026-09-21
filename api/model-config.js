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
 *   models/
 *      └── <model>/
 *             ├── index.js
 *             ├── config.js
 *             ├── parameters.js
 *             ├── create-task.js
 *             └── query-task.js
 *
 *
 * SUPABASE
 *
 *   models
 *      ├── description
 *      ├── credit_cost
 *      ├── discount_percent
 *      ├── credit_final
 *      ├── status
 *      ├── provider_id
 *      └── optional admin overrides
 *
 *
 * PENTING
 *
 *   MODEL TECHNICAL PARAMETERS
 *      ↓
 *   repository model
 *
 *   PRICING
 *      ↓
 *   Supabase models
 *
 *   DURATION
 *      ↓
 *   repository model
 *      ↓
 *   optional valid Supabase override
 *
 *   CREDIT TIDAK DIPENGARUHI DURATION
 *
 * =========================================================
 */


/* =========================================================
   MODEL ADAPTER IMPORTS
   ========================================================= */

import grokImagineImageToVideo
    from "../models/grok-imagine-image-to-video/index.js";


/* =========================================================
   MODEL REGISTRY
   ========================================================= */

const MODEL_REGISTRY = Object.freeze([

    grokImagineImageToVideo

]);


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

                /* fallback CSV */

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
   MODEL REGISTRY LOOKUP
   ========================================================= */

function getRegistryModel(
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
   GET ALL REGISTRY MODELS
   ========================================================= */

function getRegistryModels() {

    return [
        ...MODEL_REGISTRY
    ];

}


/* =========================================================
   LOAD DATABASE MODEL
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


    try {

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

    } catch (err) {

        console.warn(
            `[model-config] Failed loading database model ${modelId}:`,
            err
        );


        return null;

    }

}


/* =========================================================
   LOAD ALL DATABASE MODELS
   ========================================================= */

async function loadDatabaseModels() {

    if (
        !SUPABASE_URL ||
        !SUPABASE_SERVICE_ROLE_KEY
    ) {

        return [];

    }


    try {

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

    } catch (err) {

        console.warn(
            "[model-config] Failed loading database models:",
            err
        );


        return [];

    }

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


    if (
        !SUPABASE_URL ||
        !SUPABASE_SERVICE_ROLE_KEY
    ) {

        return null;

    }


    try {

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

    } catch (err) {

        console.warn(
            `[model-config] Failed loading provider ${providerDatabaseId}:`,
            err
        );


        return null;

    }

}


/* =========================================================
   LOAD PROVIDER BY PROVIDER CODE
   ========================================================= */

async function loadProviderByCode(
    providerCode
) {

    if (
        !providerCode
    ) {

        return null;

    }


    if (
        !SUPABASE_URL ||
        !SUPABASE_SERVICE_ROLE_KEY
    ) {

        return null;

    }


    const normalizedCode =
        String(
            providerCode
        ).trim();


    if (!normalizedCode) {

        return null;

    }


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


        let providers =
            await supabaseRequest(
                `/rest/v1/providers?${params.toString()}`,
                {
                    method: "GET"
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
         * Fallback provider_name.
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


        providers =
            await supabaseRequest(
                `/rest/v1/providers?${nameParams.toString()}`,
                {
                    method: "GET"
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


        return null;

    } catch (err) {

        console.warn(
            `[model-config] Failed loading provider by code ${normalizedCode}:`,
            err
        );


        return null;

    }

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

            return provider;

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

        return await loadProviderByCode(
            registryProviderId
        );

    }


    return null;

}


/* =========================================================
   BUILD MODEL CONFIG
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


    /* =====================================================
       MODEL ID
       ===================================================== */

    const registryModelId =
        String(
            config.id ||
            ""
        ).trim();


    const databaseModelId =
        String(
            databaseModel?.model_id ||
            ""
        ).trim();


    const modelId =
        registryModelId ||
        databaseModelId;


    /* =====================================================
       MODEL NAME
       ===================================================== */

    const registryModelName =
        String(
            config.name ||
            modelId
        ).trim();


    const databaseModelName =
        String(
            databaseModel?.model_name ||
            ""
        ).trim();


    const modelName =
        databaseModelName ||
        registryModelName ||
        modelId;


    /* =====================================================
       PROVIDER
       ===================================================== */

    const providerId =
        String(
            provider?.provider_id ||
            config.providerId ||
            ""
        ).trim();


    const providerName =
        String(
            provider?.provider_name ||
            provider?.name ||
            config.providerName ||
            providerId ||
            ""
        ).trim();


    const providerStatus =
        String(
            provider?.status ||
            ""
        )
            .trim()
            .toLowerCase();


    /* =====================================================
       TYPE
       ===================================================== */

    const modelType =
        String(
            config.type ||
            databaseModel?.type ||
            databaseModel?.model_type ||
            "unknown"
        ).trim();


    /* =====================================================
       MODEL PARAMETERS
       ===================================================== */

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


    /* =====================================================
       ADMIN CAPABILITY OVERRIDES
       ===================================================== */

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


    /* =====================================================
       DURATION
       -----------------------------------------------------
       DURATION TIDAK TERHUBUNG DENGAN CREDIT.
       ===================================================== */

    const folderMinDuration =
        normalizeNumber(
            durationParameter?.min
        );


    const folderMaxDuration =
        normalizeNumber(
            durationParameter?.max
        );


    /*
     * Nilai duration dari database hanya dianggap
     * sebagai override jika nilainya valid.
     *
     * 0 / negatif = tidak valid sebagai batas
     * duration video.
     */

    const databaseMinDurationRaw =
        normalizeNumber(
            databaseModel?.min_duration
        );


    const databaseMaxDurationRaw =
        normalizeNumber(
            databaseModel?.max_duration
        );


    const databaseMinDuration =
        databaseMinDurationRaw !== null &&
        databaseMinDurationRaw > 0

            ? databaseMinDurationRaw

            : null;


    const databaseMaxDuration =
        databaseMaxDurationRaw !== null &&
        databaseMaxDurationRaw > 0

            ? databaseMaxDurationRaw

            : null;


    /*
     * Repository menjadi fallback/source
     * ketika database tidak mempunyai
     * override duration yang valid.
     */

    const minDuration =
        databaseMinDuration !== null

            ? databaseMinDuration

            : folderMinDuration;


    const maxDuration =
        databaseMaxDuration !== null

            ? databaseMaxDuration

            : folderMaxDuration;


    /* =====================================================
       CREDIT
       -----------------------------------------------------
       CREDIT SEPENUHNYA TERPISAH DARI DURATION.
       ===================================================== */

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


    /*
     * credit_final hanya dihitung dari:
     *
     *   credit_cost
     *   discount_percent
     *
     * duration TIDAK masuk ke kalkulasi ini.
     */

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


    /* =====================================================
       STATUS
       ===================================================== */

    const databaseStatus =
        String(
            databaseModel?.status ||
            ""
        )
            .trim()
            .toLowerCase();


    const modelStatus =
        databaseModel

            ? (
                databaseStatus ||
                "inactive"
            )

            : "active";


    /* =====================================================
       SOURCE
       ===================================================== */

    const source =
        "repository";


    /* =====================================================
       FINAL OBJECT
       ===================================================== */

    return {

        id:
            databaseModel?.id ||
            null,


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


        provider: {

            id:
                provider?.id ||
                null,

            provider_id:
                providerId,

            provider_name:
                providerName,

            status:
                providerStatus

        },


        provider_id:
            provider?.id ||
            databaseModel?.provider_id ||
            null,


        provider_code:
            providerId,


        /* =================================================
           PRICING
           ================================================= */

        pricing: {

            /*
             * Hanya credit configuration.
             *
             * duration tidak digunakan.
             */

            credit_cost:
                creditCost,

            discount_percent:
                discountPercent,

            credit_final:
                creditFinal

        },


        credit_cost:
            creditCost,


        discount_percent:
            discountPercent,


        credit_final:
            creditFinal,


        /* =================================================
           DURATION
           ================================================= */

        duration: {

            min:
                minDuration,

            max:
                maxDuration

        },


        min_duration:
            minDuration,


        max_duration:
            maxDuration,


        /* =================================================
           CAPABILITIES
           ================================================= */

        supported_ratios:
            finalRatios,


        supported_resolutions:
            finalResolutions,


        /* =================================================
           STATUS
           ================================================= */

        status:
            modelStatus,


        source:
            source,


        /* =================================================
           REPOSITORY
           ================================================= */

        repository: {

            model_id:
                registryModelId,

            model_name:
                registryModelName,

            provider_id:
                String(
                    config.providerId ||
                    ""
                ).trim(),

            provider_name:
                String(
                    config.providerName ||
                    ""
                ).trim(),

            type:
                modelType

        },


        /* =================================================
           PARAMETERS
           ================================================= */

        parameters:
            serializeParameters(
                parameters
            ),


        /* =================================================
           API
           ================================================= */

        api: {

            createTask:
                config.api?.createTask ||
                null,

            queryTask:
                config.api?.queryTask ||
                null

        },


        /* =================================================
           ADAPTER
           ================================================= */

        adapter_available:
            Boolean(
                adapter
            )

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


    /* =====================================================
       MODEL REPOSITORY
       ===================================================== */

    const adapter =
        getRegistryModel(
            modelId
        );


    if (!adapter) {

        return {

            error:
                "Model not found",

            details: {

                model_id:
                    modelId,

                source:
                    "repository"

            }

        };

    }


    /* =====================================================
       DATABASE MODEL
       ===================================================== */

    const databaseModel =
        await loadDatabaseModel(
            modelId
        );


    /* =====================================================
       STATUS
       ===================================================== */

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

            return {

                error:
                    "Model is not active",

                details: {

                    model_id:
                        modelId,

                    status:
                        databaseModel.status

                }

            };

        }

    }


    /* =====================================================
       PROVIDER
       ===================================================== */

    const provider =
        await resolveProvider(
            adapter,
            databaseModel
        );


    if (!provider) {

        return {

            model:
                buildModelConfig(
                    adapter,
                    databaseModel,
                    null
                ),

            warning:
                "Provider is not configured"

        };

    }


    /* =====================================================
       PROVIDER STATUS
       ===================================================== */

    const providerStatus =
        String(
            provider.status ||
            ""
        )
            .trim()
            .toLowerCase();


    if (
        providerStatus &&
        providerStatus !==
            "active"
    ) {

        return {

            model:
                buildModelConfig(
                    adapter,
                    databaseModel,
                    provider
                ),

            warning:
                "Model provider is not active"

        };

    }


    /* =====================================================
       ADAPTER MODEL ID VALIDATION
       ===================================================== */

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


    /* =====================================================
       BUILD
       ===================================================== */

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
   ========================================================= */

async function loadAllModels() {

    const databaseModels =
        await loadDatabaseModels();


    const databaseMap =
        new Map();


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

            continue;

        }


        databaseMap.set(
            modelId,
            databaseModel
        );

    }


    const result = [];


    for (
        const adapter
        of getRegistryModels()
    ) {

        const modelId =
            String(
                adapter?.config?.id ||
                ""
            ).trim();


        if (!modelId) {

            console.warn(
                "[model-config] Registry model skipped because config.id is empty"
            );

            continue;

        }


        const databaseModel =
            databaseMap.get(
                modelId
            ) ||
            null;


        /* =================================================
           STATUS
           ================================================= */

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

                continue;

            }

        }


        /* =================================================
           PROVIDER
           ================================================= */

        let provider =
            null;


        try {

            provider =
                await resolveProvider(
                    adapter,
                    databaseModel
                );

        } catch (err) {

            console.warn(
                `[model-config] Failed resolving provider for ${modelId}:`,
                err
            );

        }


        /* =================================================
           PROVIDER NOT FOUND
           ================================================= */

        if (!provider) {

            result.push(
                buildModelConfig(
                    adapter,
                    databaseModel,
                    null
                )
            );

            continue;

        }


        /* =================================================
           PROVIDER STATUS
           ================================================= */

        const providerStatus =
            String(
                provider.status ||
                ""
            )
                .trim()
                .toLowerCase();


        if (
            providerStatus &&
            providerStatus !==
                "active"
        ) {

            continue;

        }


        /* =================================================
           BUILD
           ================================================= */

        result.push(
            buildModelConfig(
                adapter,
                databaseModel,
                provider
            )
        );

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

    /* =====================================================
       METHOD
       ===================================================== */

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


    /* =====================================================
       AUTHENTICATION
       ===================================================== */

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


    /* =====================================================
       REQUESTED MODEL
       ===================================================== */

    const requestedModelId =
        getQueryModelId(
            req
        );


    /* =====================================================
       SINGLE MODEL
       ===================================================== */

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
                    "Model adapter configuration mismatch"
                ) {

                    status =
                        500;

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
                        resolved.model,

                    warning:
                        resolved.warning ||
                        null

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


    /* =====================================================
       ALL ACTIVE MODELS
       ===================================================== */

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
