/**
 * =========================================================
 * GEN-Z.AI
 * MODELS DATA MODULE
 * ---------------------------------------------------------
 * File:
 * admin-control/models/models-data.js
 *
 * Tanggung jawab:
 * - Membaca data models dari Supabase
 * - Membaca data providers dari Supabase
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

const MODEL_TABLE = "models";
const PROVIDER_TABLE = "providers";

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

    if (value === null || value === undefined) {
        return [];
    }

    if (typeof value === "string") {

        const trimmed = value.trim();

        if (!trimmed) {
            return [];
        }

        /*
         * PostgreSQL array:
         * {16:9,9:16}
         */
        if (
            trimmed.startsWith("{") &&
            trimmed.endsWith("}")
        ) {
            return trimmed
                .slice(1, -1)
                .split(",")
                .map(value => value.trim())
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
            /* bukan JSON */
        }

        /*
         * CSV / comma separated
         */
        if (trimmed.includes(",")) {
            return trimmed
                .split(",")
                .map(value => value.trim())
                .filter(Boolean);
        }

        return [trimmed];
    }

    return [value];
}


/*
 * Compatibility export.
 *
 * Module lain menggunakan normalizeArrayValue.
 */
const normalizeArrayValue =
    normalizeArray;


function normalizeNumber(value, fallback = 0) {

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
 * CACHE
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


/* =========================================================
 * PROVIDERS
 * ========================================================= */

async function loadProviders(options = {}) {

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

    if (providersLoadingPromise) {
        return providersLoadingPromise;
    }

    providersLoadingPromise =
        (async function () {

            const supabase =
                getSupabaseClient();

            let query =
                supabase
                    .from(PROVIDER_TABLE)
                    .select("*")
                    .order(
                        "provider_name",
                        {
                            ascending: true
                        }
                    );

            if (!includeInactive) {
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

            providersLoaded = true;

            return providerCache.slice();

        })();

    try {

        return await providersLoadingPromise;

    } finally {

        providersLoadingPromise = null;
    }
}


async function getProviderById(providerId) {

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
                String(provider.id) ===
                String(providerId)
        ) || null
    );
}


async function getProviderByCode(providerCode) {

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
                String(provider.provider_id) ===
                String(providerCode)
        ) || null
    );
}


/* =========================================================
 * MODEL NORMALIZATION
 * ========================================================= */

function normalizeModel(
    model,
    providers = providerCache
) {

    if (!model) {
        return null;
    }

    const provider =
        providers.find(
            item =>
                String(item.id) ===
                String(model.provider_id)
        ) || null;

    const supportedRatios =
        normalizeArray(
            model.supported_ratios
        );

    const supportedResolutions =
        normalizeArray(
            model.supported_resolutions
        );

    const minDuration =
        normalizeNumber(
            model.min_duration,
            0
        );

    const maxDuration =
        normalizeNumber(
            model.max_duration,
            minDuration
        );

    const creditCost =
        normalizeNumber(
            model.credit_cost,
            0
        );

    const discountPercent =
        normalizeNumber(
            model.discount_percent,
            0
        );

    const calculatedFinal =
        creditCost -
        (
            creditCost *
            discountPercent /
            100
        );

    const creditFinal =
        model.credit_final !== null &&
        model.credit_final !== undefined
            ? normalizeNumber(
                model.credit_final,
                calculatedFinal
            )
            : calculatedFinal;

    return {
        ...model,

        id:
            model.id ?? null,

        provider_id:
            model.provider_id ?? null,

        model_id:
            model.model_id ?? "",

        model_name:
            model.model_name ?? "",

        description:
            model.description ?? "",

        credit_cost:
            creditCost,

        discount_percent:
            discountPercent,

        credit_final:
            creditFinal,

        min_duration:
            minDuration,

        max_duration:
            maxDuration,

        supported_ratios:
            supportedRatios,

        supported_resolutions:
            supportedResolutions,

        status:
            model.status || "inactive",

        provider: provider
            ? {
                id: provider.id,
                provider_id:
                    provider.provider_id,
                provider_name:
                    provider.provider_name,
                status:
                    provider.status
            }
            : null
    };
}


/* =========================================================
 * MODELS
 * ========================================================= */

async function loadModels(options = {}) {

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

    if (modelsLoadingPromise) {
        return modelsLoadingPromise;
    }

    modelsLoadingPromise =
        (async function () {

            const supabase =
                getSupabaseClient();

            const providers =
                await loadProviders({
                    force,
                    includeInactive: true
                });

            let query =
                supabase
                    .from(MODEL_TABLE)
                    .select("*")
                    .order(
                        "model_name",
                        {
                            ascending: true
                        }
                    );

            if (!includeInactive) {
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
                    `Gagal memuat models: ${error.message}`
                );
            }

            let models =
                Array.isArray(data)
                    ? data
                    : [];

            models =
                models
                    .map(
                        model =>
                            normalizeModel(
                                model,
                                providers
                            )
                    )
                    .filter(Boolean);

            if (activeProviderOnly) {

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

            modelsLoaded = true;

            return modelCache.slice();

        })();

    try {

        return await modelsLoadingPromise;

    } finally {

        modelsLoadingPromise = null;
    }
}


/* =========================================================
 * MODEL LOOKUP
 * ========================================================= */

async function getModelById(id) {

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
                String(model.id) ===
                String(id)
        ) || null
    );
}


async function getModelByModelId(modelId) {

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
                String(model.model_id) ===
                String(modelId)
        ) || null
    );
}


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
                String(model.provider_id) !==
                String(providerId)
            ) {
                return false;
            }

            if (
                providerCode &&
                (
                    !model.provider ||
                    String(
                        model.provider.provider_id
                    ) !==
                    String(providerCode)
                )
            ) {
                return false;
            }

            if (
                status &&
                String(model.status) !==
                String(status)
            ) {
                return false;
            }

            if (normalizedSearch) {

                const haystack =
                    [
                        model.model_id,
                        model.model_name,
                        model.description,
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

function formatDuration(model) {

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


function formatCredit(value) {

    const number =
        normalizeNumber(
            value,
            0
        );

    return number.toLocaleString(
        "id-ID"
    );
}


function formatDiscount(value) {

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

function isActiveModel(model) {

    return Boolean(
        model &&
        model.status === "active"
    );
}


function isUsableModel(model) {

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
 * GLOBAL COMPATIBILITY
 * ========================================================= */

const ModelData = {

    MODEL_TABLE,
    PROVIDER_TABLE,

    getSupabaseClient,

    normalizeArray,
    normalizeArrayValue,
    normalizeNumber,
    normalizeModel,

    clearProviderCache,
    clearModelCache,

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
    getCachedProviders
};


/*
 * ---------------------------------------------------------
 * IMPORTANT
 * ---------------------------------------------------------
 *
 * Hanya SATU default export di file ini.
 *
 * Jangan menambahkan:
 *
 * export default ModelData;
 * export { ModelData as default };
 *
 * secara bersamaan.
 * ---------------------------------------------------------
 */

export {
    normalizeArray,
    normalizeArrayValue,
    normalizeNumber,
    normalizeModel,

    clearProviderCache,
    clearModelCache,

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
