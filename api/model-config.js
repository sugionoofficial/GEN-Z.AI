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
 *   models/<model-folder>/
 *          ↓
 *       index.js
 *          ↓
 *       config.js
 *       parameters.js
 *       create-task.js
 *       query-task.js
 *
 *   Supabase:
 *       providers
 *       models
 *
 * MODEL FOLDER ADALAH SOURCE OF TRUTH UNTUK:
 * - model_id
 * - model_name
 * - providerId
 * - providerName
 * - type
 * - API adapter
 * - parameters
 * - validation
 * - createTask
 * - queryTask
 *
 * SUPABASE DIGUNAKAN UNTUK:
 * - models.id
 * - provider database
 * - status administratif
 * - pricing
 * - description
 * - konfigurasi admin lainnya
 *
 * Tidak menggunakan:
 * - kie_models
 * - kie_workflows
 * - kie_workflow_variants
 * - kie_parameters
 * - kie_constraints
 * - kie_dependencies
 * - kie_pricing
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
   MODEL REGISTRY
   ---------------------------------------------------------
   Satu tempat untuk mendaftarkan adapter model.

   Untuk menambah model berikutnya:

   import model2 from "../models/model-folder/index.js";

   lalu:

   "model-2/id": model2

   Jangan mengembalikan arsitektur lama.
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
                                item ??
                                ""
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
         * PostgreSQL array.
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

                /* fallback ke comma separated */

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
   MODEL REGISTRY LOOKUP
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
   LOAD OPTIONAL DATABASE MODEL
   ---------------------------------------------------------
   Model folder tetap valid walaupun row models belum
   tersedia.

   Jika row ada:
   - pricing dipakai
   - description dipakai
   - status dipakai
   - provider_id dipakai

   Jika row belum ada:
   - identity tetap berasal dari folder
   - parameter tetap berasal dari folder
   - provider tetap berasal dari config model
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
     * URLSearchParams melakukan encoding
     * sendiri.
     *
     * Jangan encodeURIComponent() lagi.
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

        /*
         * Model folder tidak boleh mati hanya
         * karena konfigurasi administratif DB
         * belum tersedia.
         */

        console.warn(
            "[model-config] Optional database model load failed:",
            err
        );


        return null;

    }

}


/* =========================================================
   LOAD PROVIDER
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
   LOAD PROVIDER BY PROVIDER CODE
   ---------------------------------------------------------
   Fallback ketika models row belum ada.
   ========================================================= */

async function loadProviderByCode(
    providerCode
) {

    if (
        !providerCode
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
   ========================================================= */

function buildModelConfig(
    adapter,
    databaseModel = null,
    provider = null
) {

    const config =
        adapter?.config ||
        {};


    const parameters =
        adapter?.parameters ||
        {};


    const modelId =
        String(
            config.id ||
            databaseModel?.model_id ||
            ""
        ).trim();


    const modelName =
        String(
            config.name ||
            databaseModel?.model_name ||
            modelId
        ).trim();


    const providerId =
        String(
            config.providerId ||
            provider?.provider_id ||
            ""
        ).trim();


    const providerName =
        String(
            config.providerName ||
            provider?.provider_name ||
            provider?.name ||
            providerId ||
            ""
        ).trim();


    /*
     * Parameter enum dari model folder.
     *
     * Ini menjadi source of truth untuk
     * ratio dan resolution.
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
     * Jika Supabase memiliki override administratif,
     * gunakan data DB.
     *
     * Namun jika kosong, gunakan parameter folder.
     */

    const supportedRatios =
        normalizeArray(
            databaseModel?.supported_ratios
        );


    const supportedResolutions =
        normalizeArray(
            databaseModel?.supported_resolutions
        );


    const finalRatios =
        supportedRatios.length
            ? supportedRatios
            : folderRatios;


    const finalResolutions =
        supportedResolutions.length
            ? supportedResolutions
            : folderResolutions;


    /*
     * Duration:
     *
     * Model folder:
     * min = 6
     * max = 30
     *
     * Supabase dapat melengkapi/override
     * jika memang sudah dikonfigurasi.
     */

    const folderMinDuration =
        normalizeNumber(
            durationParameter?.min
        );


    const folderMaxDuration =
        normalizeNumber(
            durationParameter?.max
        );


    const dbMinDuration =
        normalizeNumber(
            databaseModel?.min_duration
        );


    const dbMaxDuration =
        normalizeNumber(
            databaseModel?.max_duration
        );


    const minDuration =
        dbMinDuration !== null
            ? dbMinDuration
            : folderMinDuration;


    const maxDuration =
        dbMaxDuration !== null
            ? dbMaxDuration
            : folderMaxDuration;


    /*
     * Pricing hanya berasal dari Supabase.
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
     * Status:
     *
     * Jika belum ada row DB,
     * adapter dianggap tersedia.
     *
     * Status provider tetap harus active
     * jika provider DB ditemukan.
     */

    const modelStatus =
        String(
            databaseModel?.status ||
            "active"
        )
            .trim()
            .toLowerCase();


    return {

        /*
         * Database ID boleh null.
         */

        id:
            databaseModel?.id ||
            null,


        /*
         * Model identity.
         */

        model_id:
            modelId,

        model_name:
            modelName,


        description:
            String(
                databaseModel?.description ||
                config.description ||
                ""
            ).trim(),


        /*
         * Provider.
         */

        provider: {

            id:
                provider?.id ||
                databaseModel?.provider_id ||
                null,

            provider_id:
                providerId,

            provider_name:
                providerName,

            status:
                String(
                    provider?.status ||
                    "active"
                )
                    .trim()
                    .toLowerCase()

        },


        /*
         * Pricing.
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
         * Duration.
         */

        duration: {

            min:
                minDuration,

            max:
                maxDuration

        },


        /*
         * Parameter support.
         */

        supported_ratios:
            finalRatios,

        supported_resolutions:
            finalResolutions,


        /*
         * Model type.
         */

        type:
            config.type ||
            "unknown",


        /*
         * Status.
         */

        status:
            modelStatus,


        /*
         * Model folder.
         */

        source:
            "model-folder",


        /*
         * Parameter definitions.
         *
         * Ini yang dipakai generation UI.
         */

        parameters:
            serializeParameters(
                parameters
            ),


        /*
         * Adapter API metadata.
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
   LOAD ONE MODEL
   ========================================================= */

async function resolveModel(
    modelId
) {

    const adapter =
        getModelAdapter(
            modelId
        );


    if (!adapter) {

        return {

            error:
                "Model adapter is not registered"

        };

    }


    const config =
        adapter.config ||
        {};


    /*
     * Ambil konfigurasi administratif
     * dari Supabase bila tersedia.
     */

    const databaseModel =
        await loadDatabaseModel(
            modelId
        );


    /*
     * Provider code dari model folder
     * adalah sumber utama.
     */

    const adapterProviderCode =
        String(
            config.providerId ||
            ""
        ).trim();


    let provider =
        null;


    /*
     * Jika row models sudah ada,
     * gunakan provider_id FK.
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
     * Jika belum ditemukan,
     * gunakan provider code dari model folder.
     */

    if (
        !provider &&
        adapterProviderCode
    ) {

        provider =
            await loadProviderByCode(
                adapterProviderCode
            );

    }


    /*
     * Jika provider tersedia di Supabase,
     * pastikan provider cocok.
     */

    if (
        provider &&
        provider.provider_id &&
        adapterProviderCode &&
        provider.provider_id !==
            adapterProviderCode
    ) {

        return {

            error:
                "Model provider configuration mismatch",

            details: {

                model_id:
                    modelId,

                model_folder_provider:
                    adapterProviderCode,

                database_provider:
                    provider.provider_id

            }

        };

    }


    /*
     * Provider wajib ada untuk model yang
     * akan digunakan.
     */

    if (!provider) {

        return {

            error:
                "Provider not found",

            details: {

                model_id:
                    modelId,

                provider_id:
                    adapterProviderCode ||
                    null

            }

        };

    }


    /*
     * Provider harus active.
     */

    if (
        String(
            provider.status ||
            ""
        )
            .trim()
            .toLowerCase() !==
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

                provider_status:
                    provider.status ||
                    null

            }

        };

    }


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
   LOAD ALL REGISTERED MODELS
   ========================================================= */

async function loadAllModels() {

    const result = [];


    for (
        const [
            modelId,
            adapter
        ]
        of Object.entries(
            MODEL_REGISTRY
        )
    ) {

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

        const resolved =
            await resolveModel(
                requestedModelId
            );


        if (
            resolved?.error
        ) {

            const status =
                resolved.error ===
                    "Model adapter is not registered"

                    ? 404

                    : resolved.error ===
                        "Model provider is not active"

                        ? 409

                        : 404;


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

    }


    /*
     * -------------------------------------------------------
     * ALL REGISTERED MODELS
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
