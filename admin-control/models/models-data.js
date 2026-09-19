/**
 * =========================================================
 * GEN-Z.AI
 * MODELS DATA MODULE
 * ---------------------------------------------------------
 * File:
 * admin-control/models/models-data.js
 *
 * Arsitektur:
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
 * Optional:
 *   models
 *          |
 *          +-- data admin/persisted jika tersedia
 *
 * Tidak menggunakan:
 *   kie_models
 *   kie_workflows
 *   kie_workflow_variants
 *   kie_constraints
 *   kie_dependencies
 *   kie_parameters
 *   kie_pricing
 *
 * Tanggung jawab:
 * - Membaca model dari model registry/folder
 * - Membaca provider dari Supabase
 * - Menggabungkan konfigurasi admin jika tersedia
 * - Normalisasi data
 * - Cache data
 * - Lookup model/provider
 *
 * Tidak bertanggung jawab:
 * - Render UI
 * - Event DOM
 * - Form
 * - Modal
 * - Query KIE
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
 * Untuk sekarang hanya ada SATU model.
 *
 * Jika nanti ingin menambah model:
 *
 * 1. buat folder model baru
 * 2. buat config.js
 * 3. buat parameters.js
 * 4. tambahkan entry registry di sini
 *
 * Jangan membuat ulang model di banyak tempat.
 * ========================================================= */

const MODEL_REGISTRY = [
    {
        config: grokConfig,
        parameters: grokParameters
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

    throw new Error(
        "Supabase client belum tersedia. " +
        "Pastikan config.js dan supabase.js dimuat " +
        "sebelum Models module."
    );
}


/* =========================================================
 * NORMALIZATION
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

    if (typeof value === "string") {

        const trimmed =
            value.trim();

        if (!trimmed) {
            return [];
        }

        /*
         * PostgreSQL array:
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
                            .replace(/^"(.*)"$/, "$1")
                )
                .filter(Boolean);
        }

        /*
         * JSON array
         */
        try {

            const parsed =
                JSON.parse(trimmed);

            if (Array.isArray(parsed)) {
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
 * Compatibility export.
 *
 * Modul lain menggunakan:
 *
 * normalizeArrayValue()
 */
const normalizeArrayValue =
    normalizeArray;


/* =========================================================
 * NUMBER
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
 * PROVIDERS
 * ---------------------------------------------------------
 * Provider tetap berasal dari Supabase.
 *
 * Ini penting karena:
 *
 * providers.id
 *     |
 *     +-- models.provider_id
 *
 * sedangkan credential:
 *
 * providers.provider_id
 *     |
 *     +-- provider_credentials.provider_id
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
 * MODEL PARAMETER HELPERS
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
 * MODEL NORMALIZATION
 * ========================================================= */

function normalizeRegistryModel(
    registryEntry,
    providerMap = providerCache,
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

    const modelId =
        String(
            config.id || ""
        ).trim();

    if (!modelId) {
        return null;
    }

    /*
     * Provider code berasal dari config model.
     *
     * Contoh:
     *
     * kie_ai
     */
    const providerCode =
        String(
            config.providerId || ""
        ).trim();

    /*
     * Cari provider berdasarkan:
     *
     * providers.provider_id
     *
     * BUKAN providers.id.
     */
    const provider =
        providerMap.find(
            item =>
                String(
                    item.provider_id
                ) ===
                providerCode
        ) || null;

    /*
     * Parameter model adalah sumber
     * kebenaran untuk ratio/resolution.
     */
    const aspectRatioParameter =
        getParameterDefinition(
            parameters,
            "aspect_ratio"
        );

    const resolutionParameter =
        getParameterDefinition(
            parameters,
            "resolution"
        );

    const durationParameter =
        getParameterDefinition(
            parameters,
            "duration"
        );

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

    const parameterMinDuration =
        normalizeNumber(
            durationParameter?.min,
            0
        );

    const parameterMaxDuration =
        normalizeNumber(
            durationParameter?.max,
            parameterMinDuration
        );

    /*
     * Jika ada data persisted di Supabase,
     * gunakan sebagai data admin tambahan.
     *
     * Tetapi identitas model tetap berasal
     * dari config.js.
     */
    const persisted =
        persistedModel || null;

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

    const calculatedFinal =
        creditCost -
        (
            creditCost *
            discountPercent /
            100
        );

    const creditFinal =
        persisted &&
        persisted.credit_final !== null &&
        persisted.credit_final !== undefined
            ? normalizeNumber(
                persisted.credit_final,
                calculatedFinal
            )
            : calculatedFinal;

    /*
     * Persisted duration hanya digunakan
     * bila tersedia.
     *
     * Jika tidak ada:
     * gunakan parameter model.
     */
    const minDuration =
        persisted &&
        persisted.min_duration !== null &&
        persisted.min_duration !== undefined
            ? normalizeNumber(
                persisted.min_duration,
                parameterMinDuration
            )
            : parameterMinDuration;

    const maxDuration =
        persisted &&
        persisted.max_duration !== null &&
        persisted.max_duration !== undefined
            ? normalizeNumber(
                persisted.max_duration,
                parameterMaxDuration
            )
            : parameterMaxDuration;

    /*
     * Ratio/resolution:
     *
     * PRIORITAS:
     * 1. parameters.js
     * 2. persisted hanya sebagai fallback
     *
     * Dengan demikian UI tidak dapat
     * mengarang ratio/resolution.
     */
    const persistedRatios =
        normalizeArray(
            persisted?.supported_ratios
        );

    const persistedResolutions =
        normalizeArray(
            persisted?.supported_resolutions
        );

    const finalRatios =
        supportedRatios.length > 0
            ? supportedRatios
            : persistedRatios;

    const finalResolutions =
        supportedResolutions.length > 0
            ? supportedResolutions
            : persistedResolutions;

    /*
     * Status.
     *
     * Model folder tidak mempunyai status
     * operasional.
     *
     * Jika ada row Supabase gunakan statusnya.
     * Jika belum ada row, gunakan active
     * agar model folder dapat ditampilkan
     * dan diuji.
     */
    const status =
        persisted?.status ||
        "active";

    return {

        /*
         * Database ID hanya ada jika
         * terdapat persisted row.
         */
        id:
            persisted?.id ??
            null,

        /*
         * SOURCE OF TRUTH
         */
        model_id:
            modelId,

        model_name:
            config.name ||
            modelId,

        description:
            persisted?.description ||
            config.description ||
            "",

        provider_id:
            provider?.id ??
            persisted?.provider_id ??
            null,

        provider_code:
            providerCode,

        provider:
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
                },

        type:
            config.type ||
            "",

        api:
            config.api
                ? {
                    ...config.api
                }
                : {},

        /*
         * Model parameter schema.
         *
         * Jangan hilangkan.
         */
        parameters,

        /*
         * Convenience fields untuk UI.
         */
        supported_ratios:
            finalRatios,

        supported_resolutions:
            finalResolutions,

        min_duration:
            minDuration,

        max_duration:
            maxDuration,

        /*
         * Pricing dari Supabase jika tersedia.
         */
        credit_cost:
            creditCost,

        discount_percent:
            discountPercent,

        credit_final:
            creditFinal,

        status,

        /*
         * Penanda internal.
         */
        source:
            "model-folder",

        source_folder:
            "models/grok-imagine-image-to-video",

        registry:
            true
    };
}


/* =========================================================
 * LOAD PERSISTED MODEL CONFIG
 * ---------------------------------------------------------
 * Supabase models TIDAK wajib berisi model.
 *
 * Jika kosong:
 * model tetap berasal dari folder.
 *
 * Jika ada row:
 * row tersebut hanya menjadi konfigurasi admin.
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
         * Jangan membuat Models page gagal
         * hanya karena tabel models kosong
         * atau belum siap.
         *
         * Tetapi error jaringan/schema yang
         * nyata tetap tidak boleh disamarkan.
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
 * MODELS
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
        return modelCache.slice();
    }

    if (
        modelsLoadingPromise
    ) {
        return modelsLoadingPromise;
    }

    modelsLoadingPromise =
        (async function () {

            /*
             * Provider tetap dibaca dari
             * Supabase karena credential/
             * provider connection bersifat
             * admin data.
             */
            const providers =
                await loadProviders({
                    force,
                    includeInactive: true
                });

            /*
             * Row models bersifat optional.
             */
            const persistedModels =
                await loadPersistedModels();

            /*
             * Buat lookup berdasarkan model_id.
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
             * MODEL REGISTRY
             *
             * Hanya model yang benar-benar
             * ada di folder yang akan muncul.
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
             * Filter inactive jika diminta.
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
                            model.provider &&
                            model.provider.status ===
                            "active"
                    );
            }

            modelCache =
                models.slice();

            modelsLoaded =
                true;

            return modelCache.slice();

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
 * MODEL LOOKUP
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
 * FILTER
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

            if (
                providerId !== undefined &&
                providerId !== null &&
                String(
                    model.provider_id
                ) !==
                String(providerId)
            ) {
                return false;
            }

            if (
                providerCode &&
                String(
                    model.provider_code
                ) !==
                String(providerCode)
            ) {
                return false;
            }

            if (
                status &&
                String(
                    model.status
                ) !==
                String(status)
            ) {
                return false;
            }

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
                        model.provider?.provider_name
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
 * FORMATTERS
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
 * STATUS / USABILITY
 * ========================================================= */

function isActiveModel(
    model
) {

    return Boolean(
        model &&
        model.status === "active"
    );
}


function isUsableModel(
    model
) {

    return Boolean(
        model &&
        model.status === "active" &&
        model.provider &&
        model.provider.status === "active"
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
                ).trim() === id
        );

    if (!entry) {
        return null;
    }

    return {
        ...entry.config
    };
}


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
                ).trim() === id
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
