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
 *          +-- admin configuration
 *          +-- display name
 *          +-- description
 *          +-- status
 *          +-- discount
 *          +-- credit configuration
 *
 * IDENTITAS MODEL
 *   model_id
 *      |
 *      +-- SELALU berasal dari config.js
 *      +-- TIDAK BOLEH diedit admin
 *
 * PARAMETER MODEL
 *   duration
 *   aspect_ratio
 *   resolution
 *      |
 *      +-- SELALU berasal dari parameters.js
 *
 * TIDAK MENGGUNAKAN:
 *   kie_models
 *   kie_workflows
 *   kie_workflow_variants
 *   kie_constraints
 *   kie_dependencies
 *   kie_parameters
 *   kie_pricing
 *
 * Tanggung jawab:
 * - Membaca model dari registry/folder
 * - Membaca provider dari Supabase
 * - Membaca konfigurasi admin dari Supabase
 * - Menggabungkan data
 * - Normalisasi data
 * - Cache
 * - Lookup
 *
 * Tidak bertanggung jawab:
 * - Render UI
 * - Event DOM
 * - Form
 * - Modal
 * - Generate task
 * =========================================================
 */

import grokConfig
    from "../../models/grok-imagine-image-to-video/config.js";

import grokParameters
    from "../../models/grok-imagine-image-to-video/parameters.js";


/* =========================================================
 * CONSTANT
 * ========================================================= */

const MODEL_TABLE = "models";

const PROVIDER_TABLE = "providers";


/* =========================================================
 * MODEL REGISTRY
 * ---------------------------------------------------------
 * Untuk sekarang hanya satu model.
 *
 * Model berikutnya cukup ditambahkan ke registry.
 *
 * Jangan membuat definisi model ulang di:
 * - models.html
 * - model-edit.html
 * - generate
 * - API
 *
 * Registry adalah sumber model yang tersedia.
 * ========================================================= */

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
 * CACHE
 * ========================================================= */

let modelCache = [];

let providerCache = [];

let modelsLoaded = false;

let providersLoaded = false;

let modelsLoadingPromise = null;

let providersLoadingPromise = null;


/* =========================================================
 * SUPABASE
 * ========================================================= */

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


    throw new Error(
        "Supabase client belum tersedia. " +
        "Pastikan supabase.js sudah dimuat sebelum " +
        "Models Data Module."
    );
}


/* =========================================================
 * NORMALIZE ARRAY
 * ========================================================= */

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

            /*
             * Bukan JSON.
             */
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
 * Compatibility alias.
 */

const normalizeArrayValue =
    normalizeArray;


/* =========================================================
 * NORMALIZE NUMBER
 * ========================================================= */

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
 * CACHE CONTROL
 * ========================================================= */

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
 * LOAD PROVIDERS
 * ========================================================= */

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

        return providerCache.slice();
    }


    if (
        providersLoadingPromise
    ) {

        return providersLoadingPromise;
    }


    providersLoadingPromise =
        (async function () {

            const supabase =
                getSupabaseClient();


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

                throw new Error(
                    `Gagal memuat providers: ${error.message}`
                );
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
 * PROVIDER LOOKUP
 * ========================================================= */

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
                    provider.id
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
                    provider.provider_id
                ) ===
                String(
                    providerCode
                )
        ) || null
    );
}


/* =========================================================
 * PARAMETER HELPERS
 * ========================================================= */

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


    if (
        !definition
    ) {

        return undefined;
    }


    return definition.default;
}


/* =========================================================
 * PARAMETER RANGE
 * ========================================================= */

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
 * NORMALIZE REGISTRY MODEL
 * ========================================================= */

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


    /*
     * =====================================================
     * MODEL ID
     * =====================================================
     *
     * Ini adalah IDENTITAS UTAMA model.
     *
     * Selalu berasal dari config.js.
     *
     * Tidak pernah diambil dari input admin.
     */

    const modelId =
        String(
            config.id || ""
        ).trim();


    if (!modelId) {

        return null;
    }


    /*
     * =====================================================
     * PROVIDER
     * =====================================================
     */

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


    /*
     * =====================================================
     * PARAMETERS.JS
     * =====================================================
     *
     * Parameter teknis model TIDAK berasal
     * dari Supabase models.
     *
     * Sumber:
     *
     * models/<folder>/parameters.js
     */

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


    /*
     * =====================================================
     * PERSISTED ADMIN DATA
     * =====================================================
     */

    const persisted =
        persistedModel || null;


    /*
     * =====================================================
     * MODEL NAME
     * =====================================================
     *
     * Prioritas:
     *
     * 1. Nama admin di Supabase
     * 2. Nama config.js
     * 3. model_id
     *
     * Jadi perubahan nama melalui Edit Model
     * benar-benar terlihat di Models page.
     */

    const modelName =
        String(
            persisted?.model_name ||
            config.name ||
            modelId
        ).trim();


    /*
     * =====================================================
     * DESCRIPTION
     * =====================================================
     */

    const description =
        persisted?.description ??
        config.description ??
        "";


    /*
     * =====================================================
     * STATUS
     * =====================================================
     *
     * Status adalah konfigurasi admin.
     */

    const status =
        String(
            persisted?.status ||
            "active"
        ).trim().toLowerCase();


    /*
     * =====================================================
     * CREDIT
     * =====================================================
     *
     * PENTING:
     *
     * credit_cost tetap diperlakukan sebagai
     * credit system.
     *
     * Tidak dianggap sebagai USD.
     *
     * Pricing USD/IDR akan dipisahkan
     * setelah schema pricing resmi tersedia.
     */

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


    /*
     * =====================================================
     * PROVIDER OBJECT
     * =====================================================
     */

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


    /*
     * =====================================================
     * FINAL MODEL OBJECT
     * ===================================================== */

    return {

        /*
         * Supabase UUID.
         *
         * Boleh null jika row belum ada.
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
         *
         * Editable melalui admin.
         */

        model_name:
            modelName,


        description:


            description,


        /*
         * Provider UUID dari Supabase.
         */

        provider_id:
            provider?.id ??
            persisted?.provider_id ??
            null,


        /*
         * Provider code dari config.
         */

        provider_code:
            providerCode,


        /*
         * Provider lengkap.
         */

        provider:
            providerData,


        /*
         * Model type dari config.
         */

        type:
            config.type ||
            "",


        /*
         * API configuration dari config.
         */

        api:
            config.api
                ? {
                    ...config.api
                }
                : {},


        /*
         * parameters.js lengkap.
         */

        parameters:
            parameters,


        /*
         * =================================================
         * TECHNICAL PARAMETERS
         * =================================================
         *
         * SEMUANYA dari parameters.js.
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
         * =================================================
         * CREDIT
         * =================================================
         */

        credit_cost:
            creditCost,


        discount_percent:
            safeDiscount,


        credit_final:
            creditFinal,


        /*
         * =================================================
         * STATUS
         * =================================================
         */

        status:
            status,


        /*
         * =================================================
         * SOURCE METADATA
         * =================================================
         */

        source:
            "model-folder",


        source_folder:
            registryEntry.folder ||
            "",


        registry:
            true
    };
}


/* =========================================================
 * LOAD PERSISTED MODELS
 * ========================================================= */

async function loadPersistedModels() {

    const supabase =
        getSupabaseClient();


    const {
        data,
        error
    } = await supabase
        .from(
            MODEL_TABLE
        )
        .select("*");


    if (error) {

        /*
         * Jika tabel belum tersedia,
         * registry model tetap dapat digunakan.
         */

        if (
            error.code === "42P01" ||
            error.code === "PGRST205"
        ) {

            return [];
        }


        throw new Error(
            `Gagal membaca konfigurasi models: ${error.message}`
        );
    }


    return Array.isArray(data)
        ? data
        : [];
}


/* =========================================================
 * LOAD MODELS
 * ========================================================= */

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
             * Provider berasal dari Supabase.
             */

            const providers =
                await loadProviders({
                    force,
                    includeInactive: true
                });


            /*
             * models table bersifat konfigurasi
             * tambahan, bukan registry model.
             */

            const persistedModels =
                await loadPersistedModels();


            /*
             * Lookup berdasarkan model_id.
             */

            const persistedMap =
                new Map();


            for (
                const persisted
                of persistedModels
            ) {

                const key =
                    String(
                        persisted?.model_id ||
                        ""
                    ).trim();


                if (key) {

                    persistedMap.set(
                        key,
                        persisted
                    );
                }
            }


            /*
             * Hanya model yang ada di registry
             * yang boleh muncul.
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
             * Simpan cache lengkap terlebih dahulu.
             */

            modelCache =
                models.slice();


            modelsLoaded =
                true;


            /*
             * Filter hasil.
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
 * MODEL LOOKUP BY UUID
 * ========================================================= */

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
 * MODEL LOOKUP BY MODEL ID
 * ========================================================= */

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


    const models =
        await loadModels();


    return (
        models.find(
            model =>
                String(
                    model.model_id
                ) ===
                String(modelId)
        ) || null
    );
}


/* =========================================================
 * FILTER MODELS
 * ========================================================= */

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
 * FORMAT DURATION
 * ========================================================= */

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
 * FORMAT CREDIT
 * ========================================================= */

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
 * FORMAT DISCOUNT
 * ========================================================= */

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
 * STATUS
 * ========================================================= */

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
 * USABLE MODEL
 * ========================================================= */

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
 * CACHE GETTERS
 * ========================================================= */

function getCachedModels() {

    return modelCache.slice();
}


function getCachedProviders() {

    return providerCache.slice();
}


/* =========================================================
 * REGISTRY ACCESS
 * ========================================================= */

function getModelRegistry() {

    return MODEL_REGISTRY.slice();
}


/* =========================================================
 * GET MODEL CONFIG
 * ========================================================= */

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
                    item?.config?.id ||
                    ""
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
 * GET MODEL PARAMETERS
 * ========================================================= */

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
                    item?.config?.id ||
                    ""
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
 * GLOBAL OBJECT
 * ========================================================= */

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
 * EXPORTS
 * ========================================================= */

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
 * BROWSER GLOBAL
 * ========================================================= */

if (
    typeof window !== "undefined"
) {

    window.GENZModelsData =
        ModelData;
}
