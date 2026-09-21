/**
 * =========================================================
 * GEN-Z.AI
 * MODELS DATA MODULE
 * ---------------------------------------------------------
 * File:
 * admin-control/models/models-data.js
 *
 * TANGGUNG JAWAB
 * - Membaca Admin Models dari Supabase
 * - Membaca Providers dari Supabase
 * - Normalisasi model
 * - Registry adapter / parameter metadata
 * - Cache model/provider
 * - Lookup dan filtering model
 * - Helper credit resolution
 *
 * MODEL SOURCE OF TRUTH
 *   Admin Models
 *        |
 *        +-- Supabase: models
 *        +-- model_id
 *        +-- model_name
 *        +-- provider_id
 *        +-- description
 *        +-- status
 *        +-- discount_percent
 *        +-- credit_480p
 *        +-- credit_720p
 *        +-- credit_1080p
 *        +-- duration
 *        +-- ratios
 *        +-- resolutions
 *
 * CREDIT ARCHITECTURE
 *
 *   models.credit_480p
 *   models.credit_720p
 *   models.credit_1080p
 *        |
 *        +-- credit dasar sesuai resolution
 *        |
 *        +-- discount_percent
 *        |
 *        +-- Credit final dihitung runtime
 *
 * RUMUS RUNTIME:
 *
 *   final =
 *       credit -
 *       (credit * discount_percent / 100)
 *
 * PENTING
 *
 * Pricing database aktif hanya:
 *
 *   credit_480p
 *   credit_720p
 *   credit_1080p
 *   discount_percent
 *
 * Module ini TIDAK membaca:
 *
 *   credit_cost
 *   credit_final
 *
 * Credit final bukan kolom database yang menjadi
 * source of truth.
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
   Registry hanya menyimpan adapter / technical metadata.
   Registry TIDAK menjadi source pricing.
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

function normalizeArray(
    value
) {

    if (
        Array.isArray(value)
    ) {

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
                JSON.parse(
                    trimmed
                );


            if (
                Array.isArray(parsed)
            ) {

                return parsed.slice();

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
 * Compatibility alias.
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
   DISCOUNT NORMALIZER
========================================================= */

function normalizeDiscount(
    value
) {

    const discount =
        normalizeNumber(
            value,
            0
        );


    /*
     * Discount selalu dibatasi 0-100.
     */

    return Math.min(
        100,
        Math.max(
            0,
            discount
        )
    );

}


/* =========================================================
   RESOLUTION CREDIT NORMALIZER
   ---------------------------------------------------------
   Source:
 *
 *   models.credit_480p
 *   models.credit_720p
 *   models.credit_1080p
 *
 * Compatibility:
 *
 *   credit480p
 *   credit720p
 *   credit1080p
 *
 * PENTING:
 *   Nilai 0 dianggap VALID.
 *
 * Tidak menggunakan field pricing legacy.
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

            const normalized =
                normalizeNumber(
                    value,
                    fallback
                );


            if (
                Number.isFinite(
                    normalized
                )
            ) {

                return normalized;

            }

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


    /*
     * CACHE
     */

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
                        )
                            .trim()
                            .toLowerCase() ===
                        "active"
                );

        }


        return result;

    }


    /*
     * Hindari duplicate request.
     */

    if (
        providersLoadingPromise
    ) {

        const result =
            await providersLoadingPromise;


        if (
            !includeInactive
        ) {

            return result.filter(
                provider =>
                    String(
                        provider?.status || ""
                    )
                        .trim()
                        .toLowerCase() ===
                    "active"
            );

        }


        return result;

    }


    const supabase =
        getSupabaseClient();


    /*
     * Supabase belum tersedia.
     *
     * Jangan membuat provider palsu.
     */

    if (!supabase) {

        providerCache = [];

        providersLoaded = true;

        return [];

    }


    providersLoadingPromise =
        (async function () {

            try {

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


                if (
                    error
                ) {

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

            } catch (
                error
            ) {

                console.warn(
                    "GEN-Z.AI: error membaca providers:",
                    error
                );


                providerCache = [];

                providersLoaded = true;

                return [];

            }

        })();


    try {

        const result =
            await providersLoadingPromise;


        return result;

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

        max:
            Math.max(
                min,
                max
            )

    };

}


/* =========================================================
   REGISTRY MODEL NORMALIZER
   ---------------------------------------------------------
   Registry hanya adapter metadata.
   Tidak boleh menjadi source pricing.
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
        Array.isArray(providerMap)

            ? (
                providerMap.find(
                    item =>
                        String(
                            item?.provider_id || ""
                        ) ===
                        providerCode
                ) || null
            )

            : null;


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


    /*
     * =====================================================
     * RESOLUTION CREDIT
     * =====================================================
     *
     * Registry tidak menentukan harga.
     *
     * Jika persisted model tersedia,
     * gunakan credit dari persisted model.
     *
     * Jika tidak tersedia, nilainya 0.
     *
     * Tidak ada fallback ke harga lama.
     */

    const credit480p =
        readResolutionCredit(
            persisted,
            null,
            "credit_480p",
            "credit480p",
            0
        );


    const credit720p =
        readResolutionCredit(
            persisted,
            null,
            "credit_720p",
            "credit720p",
            0
        );


    const credit1080p =
        readResolutionCredit(
            persisted,
            null,
            "credit_1080p",
            "credit1080p",
            0
        );


    const safeDiscount =
        normalizeDiscount(
            persisted?.discount_percent
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


        /*
         * =================================================
         * ACTIVE PRICING CONFIGURATION
         * =================================================
         */

        discount_percent:
            safeDiscount,


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


        if (
            error
        ) {

            console.warn(
                "GEN-Z.AI: konfigurasi Admin Models tidak dapat dibaca:",
                error.message
            );


            return [];

        }


        return Array.isArray(data)
            ? data
            : [];

    } catch (
        error
    ) {

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
   ---------------------------------------------------------
   Supabase models adalah source of truth untuk model
   yang benar-benar digunakan Admin Models.
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
     * Provider ditentukan oleh provider_id
     * dari Admin Models.
     */

    const persistedProviderId =
        persistedModel.provider_id ??
        null;


    const provider =
        Array.isArray(providerMap)

            ? (
                providerMap.find(
                    item =>
                        String(
                            item?.id || ""
                        ) ===
                        String(
                            persistedProviderId || ""
                        )
                ) || null
            )

            : null;


    /*
     * Registry OPTIONAL.
     *
     * Registry hanya dipakai untuk metadata adapter
     * dan capability fallback.
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
     * =====================================================
     * TECHNICAL PARAMETERS
     * =====================================================
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
       CREDIT CONFIGURATION
    ===================================================== */

    const safeDiscount =
        normalizeDiscount(
            persistedModel.discount_percent
        );


    /* =====================================================
       RESOLUTION-SPECIFIC CREDIT
       -----------------------------------------------------
       Source utama:
       - credit_480p
       - credit_720p
       - credit_1080p
       
       Tidak memakai field pricing legacy.
       
       Nilai 0 tetap valid.
    ===================================================== */

    const credit480p =
        readResolutionCredit(
            persistedModel,
            null,
            "credit_480p",
            "credit480p",
            0
        );


    const credit720p =
        readResolutionCredit(
            persistedModel,
            null,
            "credit_720p",
            "credit720p",
            0
        );


    const credit1080p =
        readResolutionCredit(
            persistedModel,
            null,
            "credit_1080p",
            "credit1080p",
            0
        );


    /* =====================================================
       PROVIDER CODE
    ===================================================== */

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


    /* =====================================================
       STATUS
    ===================================================== */

    const status =
        String(
            persistedModel.status ||
            "inactive"
        )
            .trim()
            .toLowerCase();


    /* =====================================================
       MODEL TYPE
    ===================================================== */

    const modelType =
        String(
            persistedModel.type ||
            persistedModel.model_type ||
            registryConfig?.type ||
            ""
        ).trim();


    /* =====================================================
       FINAL NORMALIZED MODEL
    ===================================================== */

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
         * ACTIVE CREDIT CONFIGURATION
         * =================================================
         */

        discount_percent:
            safeDiscount,


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
         * Apakah model mempunyai registry entry.
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
   ---------------------------------------------------------
   Registry model hanya metadata.
   Tidak dianggap sebagai model aktif Admin Models.
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
     * =====================================================
     * CACHE
     * =====================================================
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
                        )
                            .trim()
                            .toLowerCase() ===
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
                        )
                            .trim()
                            .toLowerCase() ===
                        "active"
                );

        }


        return result;

    }


    /*
     * =====================================================
     * DUPLICATE REQUEST PROTECTION
     * =====================================================
     */

    if (
        modelsLoadingPromise
    ) {

        const result =
            await modelsLoadingPromise;


        let filtered =
            Array.isArray(result)
                ? result.slice()
                : [];


        if (
            !includeInactive
        ) {

            filtered =
                filtered.filter(
                    model =>
                        String(
                            model?.status || ""
                        )
                            .trim()
                            .toLowerCase() ===
                        "active"
                );

        }


        if (
            activeProviderOnly
        ) {

            filtered =
                filtered.filter(
                    model =>
                        String(
                            model?.provider?.status || ""
                        )
                            .trim()
                            .toLowerCase() ===
                        "active"
                );

        }


        return filtered;

    }


    modelsLoadingPromise =
        (async function () {

            /*
             * =================================================
             * PROVIDERS
             * =================================================
             */

            const providers =
                await loadProviders({
                    force,
                    includeInactive: true
                });


            /*
             * =================================================
             * ADMIN MODELS
             * =================================================
             */

            const persistedModels =
                await loadPersistedModels();


            /*
             * =================================================
             * NORMALIZE
             * =================================================
             *
             * Semua model berasal dari Supabase.
             *
             * Registry hanya memperkaya metadata.
             */

            const models =
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


            return models.slice();

        })();


    try {

        const loadedModels =
            await modelsLoadingPromise;


        let result =
            loadedModels.slice();


        /*
         * Filter status Admin Models.
         */

        if (
            !includeInactive
        ) {

            result =
                result.filter(
                    model =>
                        String(
                            model?.status || ""
                        )
                            .trim()
                            .toLowerCase() ===
                        "active"
                );

        }


        /*
         * Filter provider aktif.
         */

        if (
            activeProviderOnly
        ) {

            result =
                result.filter(
                    model =>
                        String(
                            model?.provider?.status || ""
                        )
                            .trim()
                            .toLowerCase() ===
                        "active"
                );

        }


        return result;

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
     * Cari hanya dari Admin Models.
     *
     * Registry tidak boleh membuat model palsu.
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
                    ).toLowerCase() !==
                    String(
                        providerCode
                    ).toLowerCase()
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
                    ).toLowerCase() !==
                    String(
                        status
                    ).toLowerCase()
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
                        .filter(
                            value =>
                                value !== null &&
                                value !== undefined &&
                                value !== ""
                        )
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
   Source:
 *
 *   credit_480p
 *   credit_720p
 *   credit_1080p
 *
 * Tidak menghitung discount.
 *
 * Discount dan credit final dihitung oleh layer
 * pricing/runtime yang memang bertanggung jawab.
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
            model.credit480p,
            0
        );

    }


    if (
        normalizedResolution === "720p"
    ) {

        return normalizeNumber(
            model.credit_720p ??
            model.credit720p,
            0
        );

    }


    if (
        normalizedResolution === "1080p"
    ) {

        return normalizeNumber(
            model.credit_1080p ??
            model.credit1080p,
            0
        );

    }


    /*
     * Resolution tidak dikenal.
     *
     * Jangan mengarang harga.
     */

    return 0;

}


/* =========================================================
   GET MODEL PRICING CONFIG
   ---------------------------------------------------------
   Helper ringan untuk module lain.
   Tidak menghitung credit final.
========================================================= */

function getModelPricingConfig(
    model
) {

    if (
        !model ||
        typeof model !== "object"
    ) {

        return {

            discount_percent:
                0,

            credit_480p:
                0,

            credit_720p:
                0,

            credit_1080p:
                0

        };

    }


    return {

        discount_percent:
            normalizeDiscount(
                model.discount_percent
            ),

        credit_480p:
            getResolutionCredit(
                model,
                "480p"
            ),

        credit_720p:
            getResolutionCredit(
                model,
                "720p"
            ),

        credit_1080p:
            getResolutionCredit(
                model,
                "1080p"
            )

    };

}


/* =========================================================
   FORMAT DISCOUNT
========================================================= */

function formatDiscount(
    value
) {

    const number =
        normalizeDiscount(
            value
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
        )
            .trim()
            .toLowerCase() ===
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
        )
            .trim()
            .toLowerCase() ===
        "active" &&

        model.provider &&

        String(
            model.provider.status || ""
        )
            .trim()
            .toLowerCase() ===
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

    normalizeDiscount,

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

    getModelPricingConfig,

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

    normalizeDiscount,

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

    getModelPricingConfig,

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
