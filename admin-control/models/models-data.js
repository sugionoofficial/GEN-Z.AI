/**
 * =========================================================
 * GEN-Z.AI
 * MODELS DATA MODULE
 * ---------------------------------------------------------
 * File:
 * admin-control/models/models-data.js
 *
 * ARSITEKTUR
 *
 * MODEL SOURCE OF TRUTH
 *   models/<model-folder>/
 *          |
 *          +-- config.js
 *          +-- parameters.js
 *          +-- index.js
 *
 * SUPABASE
 *   providers
 *          |
 *          +-- provider connection/status
 *
 *   models
 *          |
 *          +-- optional admin configuration
 *          +-- display name
 *          +-- description
 *          +-- status
 *          +-- discount
 *          +-- credit configuration
 *
 * =========================================================
 *
 * PENTING
 *
 * model_id:
 *   SELALU berasal dari config.js
 *   IMMUTABLE
 *
 * parameter teknis:
 *   SELALU berasal dari parameters.js
 *
 * Supabase TIDAK menentukan apakah model tersedia.
 *
 * Model hanya dianggap tersedia jika model tersebut
 * terdaftar di MODEL_REGISTRY.
 *
 * =========================================================
 */

import grokConfig
    from "../../models/grok-imagine-image-to-video/config.js";

import grokParameters
    from "../../models/grok-imagine-image-to-video/parameters.js";


/* =========================================================
   CONSTANT
========================================================= */

const MODEL_TABLE = "models";

const PROVIDER_TABLE = "providers";


/* =========================================================
   MODEL REGISTRY
   ---------------------------------------------------------
   Sumber utama model yang tersedia di GEN-Z.AI.

   Untuk menambahkan model berikutnya:

   1. Buat folder:
      models/nama-model/

   2. Buat:
      config.js
      parameters.js
      index.js

   3. Import config + parameters di sini.

   4. Tambahkan ke MODEL_REGISTRY.

   Tidak perlu membuat model dari Supabase.
========================================================= */

const MODEL_REGISTRY = [

    {
        folder:
            "models/grok-imagine-image-to-video",

        config:
            grokConfig,

        parameters:
            grokParameters
    }

];


/* =========================================================
   CACHE
========================================================= */

let modelCache = [];

let providerCache = [];

let modelsLoaded = false;

let providersLoaded = false;

let modelsLoadingPromise = null;

let providersLoadingPromise = null;


/* =========================================================
   SUPABASE CLIENT
========================================================= */

function getSupabaseClient() {

    if (
        typeof window !== "undefined" &&
        window.GENZ_SUPABASE &&
        typeof window.GENZ_SUPABASE.from === "function"
    ) {

        return window.GENZ_SUPABASE;

    }


    if (
        typeof window !== "undefined" &&
        window.supabaseClient &&
        typeof window.supabaseClient.from === "function"
    ) {

        return window.supabaseClient;

    }


    if (
        typeof window !== "undefined" &&
        window.supabase &&
        typeof window.supabase.from === "function"
    ) {

        return window.supabase;

    }


    return null;
}


/* =========================================================
   ARRAY NORMALIZER
========================================================= */

function normalizeArray(value) {

    if (Array.isArray(value)) {

        return value.slice();

    }


    if (
        value === null ||
        value === undefined
    ) {

        return [];

    }


    if (
        typeof value === "string"
    ) {

        const trimmed =
            value.trim();


        if (!trimmed) {

            return [];

        }


        /*
         * PostgreSQL ARRAY
         *
         * {16:9,9:16}
         */

        if (
            trimmed.startsWith("{") &&
            trimmed.endsWith("}")
        ) {

            return trimmed
                .slice(1, -1)
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
                .filter(Boolean);

        }


        /*
         * JSON ARRAY
         */

        try {

            const parsed =
                JSON.parse(trimmed);


            if (
                Array.isArray(parsed)
            ) {

                return parsed;

            }

        } catch (_) {

            /* bukan JSON */

        }


        /*
         * CSV
         */

        if (
            trimmed.includes(",")
        ) {

            return trimmed
                .split(",")
                .map(
                    item =>
                        item.trim()
                )
                .filter(Boolean);

        }


        return [
            trimmed
        ];

    }


    return [
        value
    ];

}


/*
 * Compatibility alias
 */

const normalizeArrayValue =
    normalizeArray;


/* =========================================================
   NUMBER NORMALIZER
========================================================= */

function normalizeNumber(
    value,
    fallback = 0
) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return fallback;

    }


    const number =
        Number(value);


    return Number.isFinite(number)
        ? number
        : fallback;

}


/* =========================================================
   CACHE CONTROL
========================================================= */

function clearProviderCache() {

    providerCache = [];

    providersLoaded = false;

    providersLoadingPromise = null;

    return true;

}


function clearModelCache() {

    modelCache = [];

    modelsLoaded = false;

    modelsLoadingPromise = null;

    return true;

}


function clearCache() {

    clearModelCache();

    clearProviderCache();

    return true;

}


/* =========================================================
   LOAD PROVIDERS
   ---------------------------------------------------------
   Provider memang berasal dari Supabase.
========================================================= */

async function loadProviders(
    options = {}
) {

    const {
        force = false,
        includeInactive = true
    } = options;


    if (
        providersLoaded &&
        !force
    ) {

        let result =
            providerCache.slice();


        if (
            !includeInactive
        ) {

            result =
                result.filter(
                    provider =>
                        String(
                            provider?.status || ""
                        ).toLowerCase() ===
                        "active"
                );

        }


        return result;

    }


    if (
        providersLoadingPromise
    ) {

        return providersLoadingPromise;

    }


    const supabase =
        getSupabaseClient();


    /*
     * Provider bukan source of truth model.
     *
     * Jika Supabase belum tersedia,
     * kembalikan array kosong.
     *
     * Model tetap dapat dimuat dari registry.
     */

    if (!supabase) {

        providerCache = [];

        providersLoaded = true;

        return [];

    }


    providersLoadingPromise =
        (async function () {

            let query =
                supabase
                    .from(
                        PROVIDER_TABLE
                    )
                    .select("*")
                    .order(
                        "provider_name",
                        {
                            ascending: true
                        }
                    );


            if (
                !includeInactive
            ) {

                query =
                    query.eq(
                        "status",
                        "active"
                    );

            }


            const {
                data,
                error
            } = await query;


            if (error) {

                /*
                 * Provider gagal dibaca tidak boleh
                 * membuat registry model hilang.
                 */

                console.warn(
                    "GEN-Z.AI: gagal membaca providers:",
                    error.message
                );

                providerCache = [];

                providersLoaded = true;

                return [];

            }


            providerCache =
                Array.isArray(data)
                    ? data.slice()
                    : [];


            providersLoaded =
                true;


            return providerCache.slice();

        })();


    try {

        return await
            providersLoadingPromise;

    } finally {

        providersLoadingPromise =
            null;

    }

}


/* =========================================================
   PROVIDER LOOKUP
========================================================= */

async function getProviderById(
    providerId
) {

    if (
        providerId === null ||
        providerId === undefined ||
        providerId === ""
    ) {

        return null;

    }


    const providers =
        await loadProviders();


    return (
        providers.find(
            provider =>
                String(
                    provider?.id || ""
                ) ===
                String(
                    providerId
                )
        ) || null
    );

}


async function getProviderByCode(
    providerCode
) {

    if (
        providerCode === null ||
        providerCode === undefined ||
        providerCode === ""
    ) {

        return null;

    }


    const providers =
        await loadProviders();


    return (
        providers.find(
            provider =>
                String(
                    provider?.provider_id || ""
                ) ===
                String(
                    providerCode
                )
        ) || null
    );

}


/* =========================================================
   PARAMETER HELPERS
========================================================= */

function getParameterDefinition(
    parameters,
    key
) {

    if (
        !parameters ||
        typeof parameters !== "object"
    ) {

        return null;

    }


    return (
        parameters[key] ||
        null
    );

}


function getParameterEnum(
    parameters,
    key
) {

    const definition =
        getParameterDefinition(
            parameters,
            key
        );


    if (
        !definition ||
        !Array.isArray(
            definition.enum
        )
    ) {

        return [];

    }


    return definition.enum.slice();

}


function getParameterDefault(
    parameters,
    key
) {

    const definition =
        getParameterDefinition(
            parameters,
            key
        );


    if (!definition) {

        return undefined;

    }


    return definition.default;

}


/* =========================================================
   DURATION
========================================================= */

function getDurationRange(
    parameters
) {

    const definition =
        getParameterDefinition(
            parameters,
            "duration"
        );


    if (!definition) {

        return {
            min: 0,
            max: 0
        };

    }


    const min =
        normalizeNumber(
            definition.min,
            0
        );


    const max =
        normalizeNumber(
            definition.max,
            min
        );


    return {
        min,
        max
    };

}


/* =========================================================
   REGISTRY MODEL NORMALIZER
========================================================= */

function normalizeRegistryModel(
    registryEntry,
    providerMap = [],
    persistedModel = null
) {

    if (
        !registryEntry ||
        !registryEntry.config
    ) {

        return null;

    }


    const config =
        registryEntry.config;


    const parameters =
        registryEntry.parameters || {};


    /* =====================================================
       MODEL ID
       -----------------------------------------------------
       WAJIB berasal dari config.js.
       Tidak boleh diganti dari Supabase.
    ===================================================== */

    const modelId =
        String(
            config.id || ""
        ).trim();


    if (!modelId) {

        return null;

    }


    /* =====================================================
       PROVIDER
    ===================================================== */

    const providerCode =
        String(
            config.providerId || ""
        ).trim();


    const provider =
        providerMap.find(
            item =>
                String(
                    item?.provider_id || ""
                ) ===
                providerCode
        ) || null;


    /* =====================================================
       TECHNICAL PARAMETERS
       -----------------------------------------------------
       SEMUANYA berasal dari parameters.js.
    ===================================================== */

    const supportedRatios =
        getParameterEnum(
            parameters,
            "aspect_ratio"
        );


    const supportedResolutions =
        getParameterEnum(
            parameters,
            "resolution"
        );


    const durationRange =
        getDurationRange(
            parameters
        );


    /* =====================================================
       OPTIONAL SUPABASE CONFIG
    ===================================================== */

    const persisted =
        persistedModel || null;


    /* =====================================================
       DISPLAY NAME
       -----------------------------------------------------
       Supabase boleh override nama tampilan.
       Jika belum ada, gunakan config.js.
    ===================================================== */

    const modelName =
        String(
            persisted?.model_name ||
            config.name ||
            modelId
        ).trim();


    /* =====================================================
       DESCRIPTION
    ===================================================== */

    const description =
        persisted?.description ??
        config.description ??
        "";


    /* =====================================================
       STATUS
       -----------------------------------------------------
       Default active jika belum ada konfigurasi admin.
    ===================================================== */

    const status =
        String(
            persisted?.status ||
            "active"
        )
            .trim()
            .toLowerCase();


    /* =====================================================
       CREDIT SYSTEM
       -----------------------------------------------------
       credit_cost TETAP credit.

       JANGAN dianggap USD.
    ===================================================== */

    const creditCost =
        persisted &&
        persisted.credit_cost !== null &&
        persisted.credit_cost !== undefined

            ? normalizeNumber(
                persisted.credit_cost,
                0
            )

            : 0;


    const discountPercent =
        persisted &&
        persisted.discount_percent !== null &&
        persisted.discount_percent !== undefined

            ? normalizeNumber(
                persisted.discount_percent,
                0
            )

            : 0;


    const safeDiscount =
        Math.min(
            100,
            Math.max(
                0,
                discountPercent
            )
        );


    const calculatedCreditFinal =
        creditCost *
        (
            1 -
            safeDiscount / 100
        );


    const creditFinal =
        persisted &&
        persisted.credit_final !== null &&
        persisted.credit_final !== undefined

            ? normalizeNumber(
                persisted.credit_final,
                calculatedCreditFinal
            )

            : calculatedCreditFinal;


    /* =====================================================
       PROVIDER OBJECT
    ===================================================== */

    const providerData =
        provider

            ? {

                id:
                    provider.id,

                provider_id:
                    provider.provider_id,

                provider_name:
                    provider.provider_name ||
                    config.providerName ||
                    providerCode,

                status:
                    provider.status

            }

            : {

                id:
                    null,

                provider_id:
                    providerCode,

                provider_name:
                    config.providerName ||
                    providerCode,

                status:
                    "unknown"

            };


    /* =====================================================
       FINAL MODEL
    ===================================================== */

    return {

        /*
         * Supabase UUID.
         * Boleh null jika belum ada row.
         */

        id:
            persisted?.id ??
            null,


        /*
         * MODEL ID
         *
         * IMMUTABLE
         */

        model_id:
            modelId,


        /*
         * DISPLAY NAME
         */

        model_name:
            modelName,


        /*
         * DESCRIPTION
         */

        description:
            description,


        /*
         * PROVIDER UUID
         */

        provider_id:
            provider?.id ??
            persisted?.provider_id ??
            null,


        /*
         * PROVIDER CODE
         */

        provider_code:
            providerCode,


        /*
         * PROVIDER OBJECT
         */

        provider:
            providerData,


        /*
         * MODEL TYPE
         */

        type:
            config.type ||
            "",


        /*
         * API
         */

        api:
            config.api
                ? {
                    ...config.api
                }
                : {},


        /*
         * FULL PARAMETERS
         */

        parameters:
            parameters,


        /*
         * TECHNICAL PARAMETERS
         *
         * SOURCE:
         * parameters.js
         */

        supported_ratios:
            supportedRatios,

        supported_resolutions:
            supportedResolutions,

        min_duration:
            durationRange.min,

        max_duration:
            durationRange.max,


        /*
         * CREDIT
         */

        credit_cost:
            creditCost,

        discount_percent:
            safeDiscount,

        credit_final:
            creditFinal,


        /*
         * STATUS
         */

        status:
            status,


        /*
         * SOURCE
         */

        source:
            "model-folder",

        source_folder:
            registryEntry.folder || "",

        registry:
            true

    };

}


/* =========================================================
   LOAD PERSISTED ADMIN CONFIG
   ---------------------------------------------------------
   Ini hanya konfigurasi tambahan.

   Jika gagal:
   registry tetap berjalan.
========================================================= */

async function loadPersistedModels() {

    const supabase =
        getSupabaseClient();


    if (!supabase) {

        return [];

    }


    try {

        const {
            data,
            error
        } = await supabase
            .from(
                MODEL_TABLE
            )
            .select("*");


        if (error) {

            console.warn(
                "GEN-Z.AI: konfigurasi models tidak dapat dibaca:",
                error.message
            );

            return [];

        }


        return Array.isArray(data)
            ? data
            : [];

    } catch (error) {

        console.warn(
            "GEN-Z.AI: error membaca konfigurasi models:",
            error
        );

        return [];

    }

}


/* =========================================================
   LOAD REGISTRY MODELS
   ---------------------------------------------------------
   FUNGSI INI TIDAK MEMBUTUHKAN SUPABASE.

   Ini yang digunakan halaman Edit Model jika
   hanya membutuhkan model dari repository.
========================================================= */

function loadRegistryModels() {

    const models =
        MODEL_REGISTRY
            .map(
                registryEntry =>
                    normalizeRegistryModel(
                        registryEntry,
                        [],
                        null
                    )
            )
            .filter(Boolean);


    return models.slice();

}


/* =========================================================
   GET REGISTRY MODEL
========================================================= */

function getRegistryModel(
    modelId
) {

    const id =
        String(
            modelId || ""
        ).trim();


    if (!id) {

        return null;

    }


    const entry =
        MODEL_REGISTRY.find(
            item =>
                String(
                    item?.config?.id || ""
                ).trim() ===
                id
        );


    if (!entry) {

        return null;

    }


    return normalizeRegistryModel(
        entry,
        [],
        null
    );

}


/* =========================================================
   LOAD MODELS
   ---------------------------------------------------------
   Model selalu berasal dari MODEL_REGISTRY.

   Supabase hanya melakukan merge konfigurasi admin.
========================================================= */

async function loadModels(
    options = {}
) {

    const {
        force = false,
        includeInactive = true,
        activeProviderOnly = false
    } = options;


    if (
        modelsLoaded &&
        !force
    ) {

        let result =
            modelCache.slice();


        if (
            !includeInactive
        ) {

            result =
                result.filter(
                    model =>
                        model.status ===
                        "active"
                );

        }


        if (
            activeProviderOnly
        ) {

            result =
                result.filter(
                    model =>
                        model.provider?.status ===
                        "active"
                );

        }


        return result;

    }


    if (
        modelsLoadingPromise
    ) {

        return modelsLoadingPromise;

    }


    modelsLoadingPromise =
        (async function () {

            /*
             * Provider adalah optional metadata.
             */

            const providers =
                await loadProviders({
                    force,
                    includeInactive: true
                });


            /*
             * Supabase admin configuration.
             */

            const persistedModels =
                await loadPersistedModels();


            /*
             * Map berdasarkan model_id.
             */

            const persistedMap =
                new Map();


            for (
                const persisted
                of persistedModels
            ) {

                const key =
                    String(
                        persisted?.model_id || ""
                    ).trim();


                if (key) {

                    persistedMap.set(
                        key,
                        persisted
                    );

                }

            }


            /*
             * =================================================
             * IMPORTANT
             *
             * HANYA MODEL DI MODEL_REGISTRY
             * YANG BOLEH MASUK.
             * =================================================
             */

            let models =
                MODEL_REGISTRY
                    .map(
                        registryEntry => {

                            const modelId =
                                String(
                                    registryEntry
                                        ?.config
                                        ?.id ||
                                    ""
                                ).trim();


                            return normalizeRegistryModel(
                                registryEntry,
                                providers,
                                persistedMap.get(
                                    modelId
                                ) || null
                            );

                        }
                    )
                    .filter(Boolean);


            /*
             * Cache lengkap.
             */

            modelCache =
                models.slice();

            modelsLoaded =
                true;


            /*
             * Filter status.
             */

            if (
                !includeInactive
            ) {

                models =
                    models.filter(
                        model =>
                            model.status ===
                            "active"
                    );

            }


            /*
             * Filter provider aktif.
             */

            if (
                activeProviderOnly
            ) {

                models =
                    models.filter(
                        model =>
                            model.provider?.status ===
                            "active"
                    );

            }


            return models.slice();

        })();


    try {

        return await
            modelsLoadingPromise;

    } finally {

        modelsLoadingPromise =
            null;

    }

}


/* =========================================================
   MODEL LOOKUP BY SUPABASE UUID
========================================================= */

async function getModelById(
    id
) {

    if (
        id === null ||
        id === undefined ||
        id === ""
    ) {

        return null;

    }


    const models =
        await loadModels();


    return (
        models.find(
            model =>
                String(
                    model.id
                ) ===
                String(id)
        ) || null
    );

}


/* =========================================================
   MODEL LOOKUP BY MODEL ID
========================================================= */

async function getModelByModelId(
    modelId
) {

    if (
        modelId === null ||
        modelId === undefined ||
        modelId === ""
    ) {

        return null;

    }


    const id =
        String(
            modelId
        ).trim();


    /*
     * Gunakan registry sebagai fallback utama.
     */

    const registryModel =
        getRegistryModel(id);


    if (registryModel) {

        /*
         * Jika membutuhkan konfigurasi admin,
         * loadModels() akan melakukan merge.
         */

        const models =
            await loadModels();


        return (
            models.find(
                model =>
                    String(
                        model.model_id
                    ) ===
                    id
            ) ||
            registryModel
        );

    }


    return null;

}


/* =========================================================
   FILTER MODELS
========================================================= */

function filterModels(
    models,
    filters = {}
) {

    const source =
        Array.isArray(models)
            ? models
            : [];


    const {
        providerId,
        providerCode,
        status,
        search
    } = filters;


    const normalizedSearch =
        typeof search === "string"
            ? search
                .trim()
                .toLowerCase()
            : "";


    return source.filter(
        model => {

            /*
             * Provider UUID
             */

            if (
                providerId !== undefined &&
                providerId !== null &&
                providerId !== ""
            ) {

                if (
                    String(
                        model.provider_id
                    ) !==
                    String(
                        providerId
                    )
                ) {

                    return false;

                }

            }


            /*
             * Provider code
             */

            if (
                providerCode
            ) {

                if (
                    String(
                        model.provider_code
                    ) !==
                    String(
                        providerCode
                    )
                ) {

                    return false;

                }

            }


            /*
             * Status
             */

            if (
                status &&
                status !== "all"
            ) {

                if (
                    String(
                        model.status
                    ) !==
                    String(
                        status
                    )
                ) {

                    return false;

                }

            }


            /*
             * Search
             */

            if (
                normalizedSearch
            ) {

                const haystack =
                    [

                        model.model_id,

                        model.model_name,

                        model.description,

                        model.provider_code,

                        model.provider?.provider_id,

                        model.provider?.provider_name,

                        model.type

                    ]
                        .filter(Boolean)
                        .join(" ")
                        .toLowerCase();


                if (
                    !haystack.includes(
                        normalizedSearch
                    )
                ) {

                    return false;

                }

            }


            return true;

        }
    );

}


/* =========================================================
   FORMAT DURATION
========================================================= */

function formatDuration(
    model
) {

    if (!model) {

        return "";

    }


    const min =
        normalizeNumber(
            model.min_duration,
            0
        );


    const max =
        normalizeNumber(
            model.max_duration,
            min
        );


    if (
        min === max
    ) {

        return `${min}s`;

    }


    return `${min}s - ${max}s`;

}


/* =========================================================
   FORMAT CREDIT
========================================================= */

function formatCredit(
    value
) {

    const number =
        normalizeNumber(
            value,
            0
        );


    return number.toLocaleString(
        "id-ID"
    );

}


/* =========================================================
   FORMAT DISCOUNT
========================================================= */

function formatDiscount(
    value
) {

    const number =
        normalizeNumber(
            value,
            0
        );


    return `${number}%`;

}


/* =========================================================
   STATUS
========================================================= */

function isActiveModel(
    model
) {

    return Boolean(
        model &&
        model.status ===
        "active"
    );

}


/* =========================================================
   USABLE MODEL
========================================================= */

function isUsableModel(
    model
) {

    return Boolean(

        model &&

        model.status ===
        "active" &&

        model.provider &&

        model.provider.status ===
        "active"

    );

}


/* =========================================================
   CACHE GETTERS
========================================================= */

function getCachedModels() {

    return modelCache.slice();

}


function getCachedProviders() {

    return providerCache.slice();

}


/* =========================================================
   REGISTRY ACCESS
========================================================= */

function getModelRegistry() {

    return MODEL_REGISTRY.slice();

}


/* =========================================================
   MODEL CONFIG
========================================================= */

function getModelConfig(
    modelId
) {

    const id =
        String(
            modelId || ""
        ).trim();


    if (!id) {

        return null;

    }


    const entry =
        MODEL_REGISTRY.find(
            item =>
                String(
                    item?.config?.id || ""
                ).trim() ===
                id
        );


    if (!entry) {

        return null;

    }


    return {
        ...entry.config
    };

}


/* =========================================================
   MODEL PARAMETERS
========================================================= */

function getModelParameters(
    modelId
) {

    const id =
        String(
            modelId || ""
        ).trim();


    if (!id) {

        return null;

    }


    const entry =
        MODEL_REGISTRY.find(
            item =>
                String(
                    item?.config?.id || ""
                ).trim() ===
                id
        );


    if (!entry) {

        return null;

    }


    return {
        ...(entry.parameters || {})
    };

}


/* =========================================================
   GLOBAL OBJECT
========================================================= */

const ModelData = {

    MODEL_TABLE,

    PROVIDER_TABLE,

    MODEL_REGISTRY,


    getSupabaseClient,


    normalizeArray,

    normalizeArrayValue,

    normalizeNumber,


    normalizeRegistryModel,


    clearProviderCache,

    clearModelCache,

    clearCache,


    loadProviders,

    getProviderById,

    getProviderByCode,


    /*
     * REGISTRY ONLY
     */

    loadRegistryModels,

    getRegistryModel,


    /*
     * MERGED MODEL DATA
     */

    loadModels,

    getModelById,

    getModelByModelId,


    filterModels,


    formatDuration,

    formatCredit,

    formatDiscount,


    isActiveModel,

    isUsableModel,


    getCachedModels,

    getCachedProviders,


    getModelRegistry,

    getModelConfig,

    getModelParameters,


    getParameterDefinition,

    getParameterEnum,

    getParameterDefault

};


/* =========================================================
   EXPORTS
========================================================= */

export {

    normalizeArray,

    normalizeArrayValue,

    normalizeNumber,

    normalizeRegistryModel,


    clearProviderCache,

    clearModelCache,

    clearCache,


    loadProviders,

    getProviderById,

    getProviderByCode,


    /*
     * REGISTRY
     */

    loadRegistryModels,

    getRegistryModel,


    /*
     * MODELS
     */

    loadModels,

    getModelById,

    getModelByModelId,


    filterModels,


    formatDuration,

    formatCredit,

    formatDiscount,


    isActiveModel,

    isUsableModel,


    getCachedModels,

    getCachedProviders,


    getModelRegistry,

    getModelConfig,

    getModelParameters,


    getParameterDefinition,

    getParameterEnum,

    getParameterDefault,


    getSupabaseClient

};


export default ModelData;


/* =========================================================
   BROWSER GLOBAL
========================================================= */

if (
    typeof window !== "undefined"
) {

    window.GENZModelsData =
        ModelData;

}
