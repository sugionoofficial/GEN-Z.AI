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
 *   Admin Models
 *        |
 *        +-- Supabase: models
 *        |
 *        +-- model_id
 *        +-- model_name
 *        +-- provider_id
 *        +-- description
 *        +-- status
 *        +-- credit configuration
 *        +-- credit_480p
 *        +-- credit_720p
 *        +-- credit_1080p
 *        +-- credit_final
 *        +-- duration
 *        +-- ratios
 *        +-- resolutions
 *
 * MODEL REGISTRY
 *   models/<model-folder>/
 *        |
 *        +-- config.js
 *        +-- parameters.js
 *        +-- index.js
 *
 *   Registry TIDAK menentukan model yang tersedia.
 *
 *   Registry hanya menyediakan:
 *        - adapter/API metadata
 *        - parameter fallback
 *        - folder mapping
 *
 * SUPABASE
 *   providers
 *        |
 *        +-- provider connection/status
 *
 *   models
 *        |
 *        +-- HASIL KONFIGURASI ADMIN MODELS
 *
 * =========================================================
 *
 * PENTING
 *
 * model_id:
 *   berasal dari konfigurasi Admin Models.
 *
 * Registry hanya digunakan untuk mencari adapter
 * berdasarkan model_id yang sudah dipilih admin.
 *
 * Model tersedia:
 *   ditentukan oleh row pada tabel models.
 *
 * Model aktif:
 *   ditentukan oleh models.status = active.
 *
 * Provider:
 *   ditentukan oleh providers.status.
 *
 * API KEY:
 *   TIDAK PERNAH dibaca oleh module ini.
 *
 * =========================================================
 *
 * CREDIT RESOLUTION
 *
 * credit_480p
 * credit_720p
 * credit_1080p
 *
 * Ketiga field tersebut merupakan credit aktual
 * berdasarkan resolution yang dipilih user.
 *
 * credit_final tetap dipertahankan untuk:
 *   - backward compatibility
 *   - legacy model
 *   - fallback sistem lama
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
   RESOLUTION CREDIT NORMALIZER
   ---------------------------------------------------------
   Membaca credit resolution tanpa menghilangkan nilai
   yang berasal langsung dari Supabase.

   Prioritas:
   1. snake_case dari Supabase
   2. camelCase compatibility
   3. normalized value
   4. fallback

   PENTING:
   Nilai 0 dianggap VALID.
   Hanya null / undefined / string kosong yang
   dianggap tidak tersedia.
========================================================= */

function readResolutionCredit(
    persistedModel,
    normalizedModel,
    snakeCaseKey,
    camelCaseKey,
    fallback = 0
) {

    const candidates = [

        persistedModel?.[snakeCaseKey],

        persistedModel?.[camelCaseKey],

        normalizedModel?.[snakeCaseKey],

        normalizedModel?.[camelCaseKey]

    ];


    for (
        const value of candidates
    ) {

        if (
            value !== null &&
            value !== undefined &&
            value !== ""
        ) {

            return normalizeNumber(
                value,
                fallback
            );

        }

    }


    return normalizeNumber(
        fallback,
        0
    );

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
     * Provider merupakan dependency Admin Models.
     *
     * Jika Supabase belum tersedia, tidak ada
     * provider yang dapat dianggap aktif.
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


    const modelId =
        String(
            config.id || ""
        ).trim();


    if (!modelId) {

        return null;

    }


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


    const persisted =
        persistedModel || null;


    const modelName =
        String(
            persisted?.model_name ||
            config.name ||
            modelId
        ).trim();


    const description =
        persisted?.description ??
        config.description ??
        "";


    const status =
        String(
            persisted?.status ||
            "active"
        )
            .trim()
            .toLowerCase();


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
     * RESOLUTION CREDIT
     *
     * Jika field tersedia di persisted model,
     * gunakan nilai tersebut.
     *
     * Jika belum tersedia karena model lama,
     * fallback ke credit_final.
     *
     * Nilai 0 yang tersimpan tetap dipertahankan.
     */

    const credit480p =
        readResolutionCredit(
            persisted,
            null,
            "credit_480p",
            "credit480p",
            creditFinal
        );


    const credit720p =
        readResolutionCredit(
            persisted,
            null,
            "credit_720p",
            "credit720p",
            creditFinal
        );


    const credit1080p =
        readResolutionCredit(
            persisted,
            null,
            "credit_1080p",
            "credit1080p",
            creditFinal
        );


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
                    persisted?.provider_id ??
                    null,

                provider_id:
                    providerCode,

                provider_name:
                    config.providerName ||
                    providerCode,

                status:
                    "unknown"

            };


    return {

        id:
            persisted?.id ??
            null,


        model_id:
            modelId,


        model_name:
            modelName,


        description:
            description,


        provider_id:
            provider?.id ??
            persisted?.provider_id ??
            null,


        provider_code:
            providerCode,


        provider:
            providerData,


        type:
            config.type ||
            "",


        api:
            config.api
                ? {
                    ...config.api
                }
                : {},


        parameters:
            parameters,


        supported_ratios:
            supportedRatios,


        supported_resolutions:
            supportedResolutions,


        min_duration:
            durationRange.min,


        max_duration:
            durationRange.max,


        credit_cost:
            creditCost,


        discount_percent:
            safeDiscount,


        /*
         * Legacy credit.
         */

        credit_final:
            creditFinal,


        /*
         * Resolution-specific credit.
         */

        credit_480p:
            credit480p,

        credit_720p:
            credit720p,

        credit_1080p:
            credit1080p,


        /*
         * CamelCase compatibility.
         *
         * Tidak menggantikan snake_case.
         * Hanya memudahkan module frontend lain.
         */

        credit480p:
            credit480p,

        credit720p:
            credit720p,

        credit1080p:
            credit1080p,


        status:
            status,


        source:
            "model-folder",


        source_folder:
            registryEntry.folder || "",


        registry:
            true,


        adapter_available:
            true

    };

}


/* =========================================================
   LOAD PERSISTED ADMIN MODELS
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
            .select("*")
            .order(
                "created_at",
                {
                    ascending: true
                }
            );


        if (error) {

            console.warn(
                "GEN-Z.AI: konfigurasi Admin Models tidak dapat dibaca:",
                error.message
            );

            return [];

        }


        return Array.isArray(data)
            ? data
            : [];

    } catch (error) {

        console.warn(
            "GEN-Z.AI: error membaca Admin Models:",
            error
        );

        return [];

    }

}


/* =========================================================
   FIND REGISTRY ENTRY
========================================================= */

function getRegistryEntryByModelId(
    modelId
) {

    const id =
        String(
            modelId || ""
        ).trim();


    if (!id) {

        return null;

    }


    return (
        MODEL_REGISTRY.find(
            entry =>
                String(
                    entry?.config?.id || ""
                ).trim() ===
                id
        ) || null
    );

}


/* =========================================================
   PERSISTED ADMIN MODEL NORMALIZER
========================================================= */

function normalizePersistedModel(
    persistedModel,
    providerMap = []
) {

    if (
        !persistedModel ||
        typeof persistedModel !== "object"
    ) {

        return null;

    }


    const modelId =
        String(
            persistedModel.model_id || ""
        ).trim();


    if (!modelId) {

        return null;

    }


    /*
     * Provider ditentukan oleh provider_id dari
     * Admin Models.
     */

    const persistedProviderId =
        persistedModel.provider_id ??
        null;


    const provider =
        providerMap.find(
            item =>
                String(
                    item?.id || ""
                ) ===
                String(
                    persistedProviderId || ""
                )
        ) || null;


    /*
     * Registry OPTIONAL.
     */

    const registryEntry =
        getRegistryEntryByModelId(
            modelId
        );


    const registryConfig =
        registryEntry?.config ||
        null;


    const registryParameters =
        registryEntry?.parameters ||
        null;


    /*
     * Technical parameters dari Admin Models
     * diprioritaskan.
     */

    const persistedRatios =
        normalizeArray(
            persistedModel.supported_ratios
        );


    const persistedResolutions =
        normalizeArray(
            persistedModel.supported_resolutions
        );


    const registryRatios =
        registryParameters
            ? getParameterEnum(
                registryParameters,
                "aspect_ratio"
            )
            : [];


    const registryResolutions =
        registryParameters
            ? getParameterEnum(
                registryParameters,
                "resolution"
            )
            : [];


    const registryDuration =
        registryParameters
            ? getDurationRange(
                registryParameters
            )
            : {
                min: 0,
                max: 0
            };


    const hasMinDuration =
        persistedModel.min_duration !== null &&
        persistedModel.min_duration !== undefined &&
        persistedModel.min_duration !== "";


    const hasMaxDuration =
        persistedModel.max_duration !== null &&
        persistedModel.max_duration !== undefined &&
        persistedModel.max_duration !== "";


    const minDuration =
        hasMinDuration
            ? normalizeNumber(
                persistedModel.min_duration,
                0
            )
            : registryDuration.min;


    const maxDuration =
        hasMaxDuration
            ? normalizeNumber(
                persistedModel.max_duration,
                minDuration
            )
            : registryDuration.max;


    const supportedRatios =
        persistedRatios.length
            ? persistedRatios
            : registryRatios;


    const supportedResolutions =
        persistedResolutions.length
            ? persistedResolutions
            : registryResolutions;


    /* =====================================================
       CREDIT
    ===================================================== */

    const creditCost =
        normalizeNumber(
            persistedModel.credit_cost,
            0
        );


    const discountPercent =
        normalizeNumber(
            persistedModel.discount_percent,
            0
        );


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
        persistedModel.credit_final !== null &&
        persistedModel.credit_final !== undefined &&
        persistedModel.credit_final !== ""
            ? normalizeNumber(
                persistedModel.credit_final,
                calculatedCreditFinal
            )
            : calculatedCreditFinal;


    /*
     * =====================================================
     * RESOLUTION-SPECIFIC CREDIT
     * =====================================================
     *
     * Sumber utama:
     *
     *   models.credit_480p
     *   models.credit_720p
     *   models.credit_1080p
     *
     * Untuk model lama yang belum memiliki nilai,
     * credit_final digunakan sebagai fallback.
     *
     * PENTING:
     *
     * Jika Supabase menyimpan 0, maka 0 dipertahankan.
     * Jangan diganti otomatis dengan credit_final.
     */

    const credit480p =
        readResolutionCredit(
            persistedModel,
            null,
            "credit_480p",
            "credit480p",
            creditFinal
        );


    const credit720p =
        readResolutionCredit(
            persistedModel,
            null,
            "credit_720p",
            "credit720p",
            creditFinal
        );


    const credit1080p =
        readResolutionCredit(
            persistedModel,
            null,
            "credit_1080p",
            "credit1080p",
            creditFinal
        );


    /*
     * Provider code
     *
     * Prioritas:
     *
     * 1. providers.provider_id
     * 2. data persisted provider
     * 3. registry config
     */

    const providerCode =
        String(
            provider?.provider_id ||
            persistedModel.provider_code ||
            registryConfig?.providerId ||
            ""
        ).trim();


    const providerName =
        String(
            provider?.provider_name ||
            persistedModel.provider_name ||
            registryConfig?.providerName ||
            providerCode ||
            ""
        ).trim();


    const providerStatus =
        String(
            provider?.status ||
            "unknown"
        )
            .trim()
            .toLowerCase();


    const providerData =
        provider

            ? {

                id:
                    provider.id,

                provider_id:
                    provider.provider_id,

                provider_name:
                    provider.provider_name ||
                    providerCode,

                status:
                    provider.status

            }

            : {

                id:
                    persistedProviderId,

                provider_id:
                    providerCode,

                provider_name:
                    providerName,

                status:
                    providerStatus

            };


    /*
     * STATUS
     */

    const status =
        String(
            persistedModel.status ||
            "inactive"
        )
            .trim()
            .toLowerCase();


    /*
     * MODEL TYPE
     */

    const modelType =
        String(
            persistedModel.type ||
            persistedModel.model_type ||
            registryConfig?.type ||
            ""
        ).trim();


    /*
     * FINAL NORMALIZED MODEL
     */

    return {

        /*
         * Supabase UUID.
         */

        id:
            persistedModel.id ??
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
            String(
                persistedModel.model_name ||
                registryConfig?.name ||
                modelId
            ).trim(),


        /*
         * DESCRIPTION
         */

        description:
            persistedModel.description ??
            registryConfig?.description ??
            "",


        /*
         * PROVIDER UUID
         */

        provider_id:
            persistedProviderId,


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
            modelType,


        /*
         * API / ADAPTER CONFIG
         */

        api:
            registryConfig?.api
                ? {
                    ...registryConfig.api
                }
                : {},


        /*
         * TECHNICAL PARAMETERS
         */

        parameters:
            registryParameters
                ? {
                    ...registryParameters
                }
                : {},


        supported_ratios:
            supportedRatios,


        supported_resolutions:
            supportedResolutions,


        min_duration:
            minDuration,


        max_duration:
            maxDuration,


        /*
         * =================================================
         * CREDIT CONFIGURATION
         * =================================================
         */

        credit_cost:
            creditCost,


        discount_percent:
            safeDiscount,


        /*
         * Legacy credit.
         */

        credit_final:
            creditFinal,


        /*
         * Resolution-specific credits.
         *
         * Ini yang akan digunakan oleh Generate
         * berdasarkan resolution yang dipilih.
         */

        credit_480p:
            credit480p,

        credit_720p:
            credit720p,

        credit_1080p:
            credit1080p,


        /*
         * CamelCase compatibility.
         */

        credit480p:
            credit480p,

        credit720p:
            credit720p,

        credit1080p:
            credit1080p,


        /*
         * STATUS ADMIN MODEL
         */

        status:
            status,


        /*
         * SOURCE
         */

        source:
            "admin-model",


        /*
         * Registry folder hanya metadata adapter.
         */

        source_folder:
            registryEntry?.folder ||
            "",


        /*
         * Apakah model mempunyai entry registry.
         */

        registry:
            Boolean(
                registryEntry
            ),


        /*
         * Apakah adapter teknis tersedia.
         */

        adapter_available:
            Boolean(
                registryEntry
            )

    };

}


/* =========================================================
   LOAD REGISTRY MODELS
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
        getRegistryEntryByModelId(
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
========================================================= */

async function loadModels(
    options = {}
) {

    const {
        force = false,
        includeInactive = true,
        activeProviderOnly = false
    } = options;


    /*
     * CACHE
     */

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
                        String(
                            model?.status || ""
                        ).toLowerCase() ===
                        "active"
                );

        }


        if (
            activeProviderOnly
        ) {

            result =
                result.filter(
                    model =>
                        String(
                            model?.provider?.status || ""
                        ).toLowerCase() ===
                        "active"
                );

        }


        return result;

    }


    /*
     * Hindari duplicate request.
     */

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
             * Model berasal dari hasil Admin Models.
             */

            const persistedModels =
                await loadPersistedModels();


            /*
             * NORMALIZE SEMUA MODEL ADMIN.
             *
             * Tidak ada filter registry di sini.
             */

            let models =
                persistedModels
                    .map(
                        persistedModel =>
                            normalizePersistedModel(
                                persistedModel,
                                providers
                            )
                    )
                    .filter(Boolean);


            /*
             * Cache model lengkap.
             */

            modelCache =
                models.slice();

            modelsLoaded =
                true;


            /*
             * Filter status Admin Models.
             */

            if (
                !includeInactive
            ) {

                models =
                    models.filter(
                        model =>
                            String(
                                model?.status || ""
                            ).toLowerCase() ===
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
                            String(
                                model?.provider?.status || ""
                            ).toLowerCase() ===
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
                    model?.id || ""
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


    if (!id) {

        return null;

    }


    /*
     * Cari dari Admin Models.
     */

    const models =
        await loadModels();


    const model =
        models.find(
            item =>
                String(
                    item?.model_id || ""
                ).trim() ===
                id
        );


    /*
     * JANGAN membuat model palsu dari registry.
     */

    return model || null;

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
                        model?.provider_id || ""
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
                        model?.provider_code || ""
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
                        model?.status || ""
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

                        model?.model_id,

                        model?.model_name,

                        model?.description,

                        model?.provider_code,

                        model?.provider?.provider_id,

                        model?.provider?.provider_name,

                        model?.type

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
   FORMAT RESOLUTION CREDIT
   ---------------------------------------------------------
   Compatibility helper.
========================================================= */

function getResolutionCredit(
    model,
    resolution
) {

    if (!model) {

        return 0;

    }


    const normalizedResolution =
        String(
            resolution || ""
        )
            .trim()
            .toLowerCase();


    if (
        normalizedResolution === "480p"
    ) {

        return normalizeNumber(
            model.credit_480p ??
            model.credit480p ??
            model.credit_final,
            0
        );

    }


    if (
        normalizedResolution === "720p"
    ) {

        return normalizeNumber(
            model.credit_720p ??
            model.credit720p ??
            model.credit_final,
            0
        );

    }


    if (
        normalizedResolution === "1080p"
    ) {

        return normalizeNumber(
            model.credit_1080p ??
            model.credit1080p ??
            model.credit_final,
            0
        );

    }


    /*
     * Resolution lain:
     *
     * Jangan mengarang harga baru.
     * Gunakan legacy credit_final sebagai fallback.
     */

    return normalizeNumber(
        model.credit_final,
        0
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

        String(
            model.status || ""
        ).toLowerCase() ===
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

        String(
            model.status || ""
        ).toLowerCase() ===
        "active" &&

        model.provider &&

        String(
            model.provider.status || ""
        ).toLowerCase() ===
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
        getRegistryEntryByModelId(
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
        getRegistryEntryByModelId(
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

    readResolutionCredit,


    normalizeRegistryModel,

    normalizePersistedModel,


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
     * ADMIN MODELS
     */

    loadModels,

    getModelById,

    getModelByModelId,


    filterModels,


    formatDuration,

    formatCredit,

    getResolutionCredit,

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

    readResolutionCredit,

    normalizeRegistryModel,

    normalizePersistedModel,


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
     * ADMIN MODELS
     */

    loadModels,

    getModelById,

    getModelByModelId,


    filterModels,


    formatDuration,

    formatCredit,

    getResolutionCredit,

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
