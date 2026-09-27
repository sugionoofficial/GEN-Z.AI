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
 * REGISTRY
 *   Registry hanya menyediakan:
 *   - adapter
 *   - model metadata
 *   - technical parameters
 *
 *   Registry TIDAK membuat Provider palsu.
 *   Provider tetap harus berasal dari Supabase.
 *
 * =========================================================
 */

import grokConfig
    from "../../models/grok-imagine-image-to-video/config.js";

import grokParameters
    from "../../models/grok-imagine-image-to-video/parameters.js";

import seedanceConfig
    from "../../models/seedance-2-5/config.js";

import seedanceParameters
    from "../../models/seedance-2-5/parameters.js";


/* =========================================================
   CONSTANT
========================================================= */

const MODEL_TABLE =
    "models";

const PROVIDER_TABLE =
    "providers";


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
    },

    {
        folder:
            "models/seedance-2-5",

        config:
            seedanceConfig,

        parameters:
            seedanceParameters
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

        }
        catch (_) {

            /* bukan JSON */

        }


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

    providerCache =
        [];

    providersLoaded =
        false;

    providersLoadingPromise =
        null;

    return true;

}


function clearModelCache() {

    modelCache =
        [];

    modelsLoaded =
        false;

    modelsLoadingPromise =
        null;

    return true;

}


function clearCache() {

    clearModelCache();

    clearProviderCache();

    return true;

}


/* =========================================================
   PROVIDER IDENTITY
   ---------------------------------------------------------
   Supabase provider dapat memiliki field:

       id
       provider_id
       provider_name
       status

   Tetapi resolver juga mendukung variasi nama field
   agar registry tidak bergantung pada satu bentuk object.
========================================================= */

function normalizeProviderIdentity(
    provider
) {

    if (
        !provider ||
        typeof provider !== "object"
    ) {

        return null;

    }


    const databaseId =
        provider.id ??
        provider.uuid ??
        provider.provider_uuid ??
        provider.providerUuid ??
        null;


    const providerCode =
        provider.provider_id ??
        provider.providerId ??
        provider.provider_code ??
        provider.providerCode ??
        provider.provider ??
        provider.code ??
        "";


    const providerName =
        provider.provider_name ??
        provider.providerName ??
        provider.name ??
        provider.display_name ??
        provider.displayName ??
        providerCode ??
        databaseId ??
        "";


    const status =
        provider.status ??
        provider.state ??
        "unknown";


    return {

        databaseId,

        providerCode:
            String(
                providerCode
            ).trim(),

        providerName:
            String(
                providerName
            ).trim(),

        status:
            String(
                status
            ).trim()

    };

}


/* =========================================================
   PROVIDER TOKEN NORMALIZER
========================================================= */

function normalizeProviderToken(
    value
) {

    return String(
        value ?? ""
    )
        .trim()
        .toLowerCase();

}


/* =========================================================
   PROVIDER ALIAS
   ---------------------------------------------------------
   Registry dapat menggunakan:

       kie
       kie_ai

   Database GEN-Z.AI menggunakan:

       provider_id = kie

   Keduanya menunjuk provider Supabase yang sama.
========================================================= */

function isKieProviderCode(
    value
) {

    const token =
        normalizeProviderToken(
            value
        );


    return (
        token === "kie" ||
        token === "kie_ai" ||
        token === "kie.ai" ||
        token === "kie a.i."
    );

}


/* =========================================================
   PROVIDER MATCH
========================================================= */

function providerMatchesCode(
    provider,
    requestedCode
) {

    const identity =
        normalizeProviderIdentity(
            provider
        );


    if (!identity) {

        return false;

    }


    const requested =
        normalizeProviderToken(
            requestedCode
        );


    if (!requested) {

        return false;

    }


    const providerCode =
        normalizeProviderToken(
            identity.providerCode
        );


    const providerId =
        normalizeProviderToken(
            identity.databaseId
        );


    const providerName =
        normalizeProviderToken(
            identity.providerName
        );


    /*
     * Exact provider code.
     */

    if (
        providerCode ===
        requested
    ) {

        return true;

    }


    /*
     * Exact database UUID.
     */

    if (
        providerId ===
        requested
    ) {

        return true;

    }


    /*
     * Exact provider name.
     */

    if (
        providerName ===
        requested
    ) {

        return true;

    }


    /*
     * KIE alias.
     *
     * Registry:
     *     kie_ai
     *
     * Supabase:
     *     kie
     *
     * Jangan membuat provider baru.
     */

    if (
        isKieProviderCode(
            requested
        )
    ) {

        if (
            providerCode === "kie" ||
            providerCode === "kie_ai"
        ) {

            return true;

        }

    }


    return false;

}


/* =========================================================
   PROVIDER FILTER
========================================================= */

function filterActiveProviders(
    providers
) {

    const source =
        Array.isArray(providers)
            ? providers
            : [];


    return source.filter(
        provider =>
            String(
                provider?.status || ""
            )
                .trim()
                .toLowerCase() ===
            "active"
    );

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

        const result =
            providerCache.slice();


        if (
            !includeInactive
        ) {

            return filterActiveProviders(
                result
            );

        }


        return result;

    }


    if (
        providersLoadingPromise
    ) {

        const result =
            await providersLoadingPromise;


        if (
            !includeInactive
        ) {

            return filterActiveProviders(
                result
            );

        }


        return result;

    }


    const supabase =
        getSupabaseClient();


    if (!supabase) {

        return [];

    }


    providersLoadingPromise =
        (async function () {

            try {

                const {
                    data,
                    error
                } = await supabase
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
                    error
                ) {

                    console.warn(
                        "GEN-Z.AI: gagal membaca providers:",
                        error.message
                    );


                    return [];

                }


                /*
                 * Normalisasi provider tanpa menghapus
                 * field asli dari Supabase.
                 *
                 * Ini penting agar modul lain tetap
                 * mendapatkan object provider lengkap.
                 */

                const normalized =
                    Array.isArray(data)

                        ? data.map(
                            provider => {

                                const identity =
                                    normalizeProviderIdentity(
                                        provider
                                    );


                                if (!identity) {

                                    return provider;

                                }


                                return {

                                    ...provider,

                                    id:
                                        provider.id ??
                                        identity.databaseId ??
                                        null,

                                    provider_id:
                                        provider.provider_id ??
                                        identity.providerCode ??
                                        null,

                                    provider_name:
                                        provider.provider_name ??
                                        identity.providerName ??
                                        null,

                                    status:
                                        provider.status ??
                                        identity.status ??
                                        null

                                };

                            }
                        )

                        : [];


                providerCache =
                    normalized;


                providersLoaded =
                    true;


                /*
                 * Debug internal provider.
                 *
                 * Tidak membuat provider baru.
                 */

                console.info(
                    "[GEN-Z.AI] Supabase providers:",
                    providerCache.map(
                        provider => ({

                            id:
                                provider?.id ??
                                null,

                            provider_id:
                                provider?.provider_id ??
                                null,

                            provider_name:
                                provider?.provider_name ??
                                null,

                            status:
                                provider?.status ??
                                null

                        })
                    )
                );


                return providerCache.slice();

            }
            catch (
                error
            ) {

                console.warn(
                    "GEN-Z.AI: error membaca providers:",
                    error
                );


                return [];

            }

        })();


    try {

        const result =
            await providersLoadingPromise;


        if (
            !includeInactive
        ) {

            return filterActiveProviders(
                result
            );

        }


        return result;

    }
    finally {

        providersLoadingPromise =
            null;

    }

}


/* =========================================================
   PROVIDER MATCH HELPER
   ---------------------------------------------------------
   Registry provider dapat menggunakan:

       kie
       kie_ai

   Supabase provider internal:

       id            = UUID
       provider_id   = kie
       provider_name = GEN-Z.AI

   Keduanya harus menunjuk ke provider Supabase
   yang sama.

   Registry TIDAK membuat provider baru.
========================================================= */

function findRegistryProvider(
    providerCode,
    providerMap,
    providerName = ""
) {

    const code =
        normalizeProviderToken(
            providerCode
        );


    const name =
        normalizeProviderToken(
            providerName
        );


    if (
        !Array.isArray(providerMap) ||
        !providerMap.length
    ) {

        return null;

    }


    /*
     * =====================================================
     * 1. EXACT / NORMALIZED MATCH
     *
     * Mencocokkan:
     *
     * - provider_id
     * - provider_code
     * - providerCode
     * - code
     * - UUID
     * - provider_name
     *
     * =====================================================
     */

    if (code) {

        const exactMatch =
            providerMap.find(
                provider =>
                    providerMatchesCode(
                        provider,
                        code
                    )
            );


        if (exactMatch) {

            return exactMatch;

        }

    }


    /*
     * =====================================================
     * 2. PROVIDER NAME
     *
     * Contoh:
     *
     * registry providerName:
     *     GEN-Z.AI
     *
     * database:
     *     provider_name = GEN-Z.AI
     *
     * =====================================================
     */

    if (name) {

        const byProviderName =
            providerMap.find(
                provider => {

                    const identity =
                        normalizeProviderIdentity(
                            provider
                        );


                    if (!identity) {

                        return false;

                    }


                    return (
                        normalizeProviderToken(
                            identity.providerName
                        ) ===
                        name
                    );

                }
            );


        if (byProviderName) {

            return byProviderName;

        }

    }


    /*
     * =====================================================
     * 3. KIE ALIAS
     *
     * Registry lama:
     *
     *     kie_ai
     *
     * Database:
     *
     *     kie
     *
     * Jika exact match gagal, cari provider
     * internal dengan provider_id "kie".
     * =====================================================
     */

    if (
        isKieProviderCode(
            code
        )
    ) {

        const kieProvider =
            providerMap.find(
                provider => {

                    const identity =
                        normalizeProviderIdentity(
                            provider
                        );


                    if (!identity) {

                        return false;

                    }


                    const candidate =
                        normalizeProviderToken(
                            identity.providerCode
                        );


                    return (
                        candidate === "kie" ||
                        candidate === "kie_ai"
                    );

                }
            );


        if (kieProvider) {

            return kieProvider;

        }

    }


    /*
     * =====================================================
     * 4. KIE NAME ALIAS
     *
     * Jika registry masih membawa:
     *
     *     KIE.AI
     *
     * tetapi database menggunakan:
     *
     *     GEN-Z.AI
     *
     * tetap gunakan provider dengan code "kie".
     * =====================================================
     */

    if (
        name === "kie.ai" ||
        name === "kie a.i." ||
        name === "kie"
    ) {

        const kieProvider =
            providerMap.find(
                provider => {

                    const identity =
                        normalizeProviderIdentity(
                            provider
                        );


                    if (!identity) {

                        return false;

                    }


                    return (
                        normalizeProviderToken(
                            identity.providerCode
                        ) === "kie"
                    );

                }
            );


        if (kieProvider) {

            return kieProvider;

        }

    }


    return null;

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
            provider => {

                const identity =
                    normalizeProviderIdentity(
                        provider
                    );


                return (
                    String(
                        identity?.databaseId ??
                        ""
                    ) ===
                    String(
                        providerId
                    )
                );

            }
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


    /*
     * Gunakan resolver yang sama dengan registry.
     *
     * Ini memastikan:
     *
     * kie
     * kie_ai
     *
     * dapat menunjuk provider Supabase yang sama.
     */

    return findRegistryProvider(
        providerCode,
        providers,
        ""
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
        registryEntry.parameters ||
        {};


    const modelId =
        String(
            config.id || ""
        ).trim();


    if (!modelId) {

        return null;

    }


    /*
     * Registry provider code.
     *
     * Seedance:
     *
     *     kie
     *
     * Grok:
     *
     *     kie_ai
     *
     */

    const providerCode =
        String(
            config.providerId ||
            config.provider_id ||
            config.providerCode ||
            config.provider_code ||
            ""
        ).trim();


    /*
     * Registry provider name.
     */

    const providerName =
        String(
            config.providerName ||
            config.provider_name ||
            ""
        ).trim();


    /*
     * Cari provider AKTUAL dari Supabase.
     *
     * Tidak membuat provider baru.
     */

    const provider =
        findRegistryProvider(
            providerCode,
            providerMap,
            providerName
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


    const durationRange =
        getDurationRange(
            parameters
        );


    const persisted =
        persistedModel ||
        null;


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


    /*
     * =====================================================
     * PROVIDER IDENTITY AKTUAL
     *
     * Jika provider ditemukan dari Supabase:
     *
     * id            = UUID providers.id
     * provider_id   = providers.provider_id
     * provider_name = providers.provider_name
     * status        = providers.status
     *
     * =====================================================
     */

    const providerIdentity =
        normalizeProviderIdentity(
            provider
        );


    /*
     * =====================================================
     * PROVIDER DATA
     * =====================================================
     */

    const providerData =
        providerIdentity

            ? {

                id:
                    providerIdentity.databaseId ??
                    null,

                provider_id:
                    providerIdentity.providerCode ||
                    providerCode,

                provider_name:
                    providerIdentity.providerName ||
                    providerName ||
                    providerCode,

                status:
                    providerIdentity.status ||
                    "unknown"

            }

            : {

                /*
                 * Registry tidak boleh membuat UUID.
                 */

                id:
                    persisted?.provider_id ??
                    null,

                provider_id:
                    providerCode,

                provider_name:
                    providerName ||
                    providerCode,

                status:
                    "unknown"

            };


    /*
     * =====================================================
     * PROVIDER UUID
     *
     * Model table menggunakan:
     *
     *     providers.id
     *
     * bukan:
     *
     *     providers.provider_id
     *
     * Jadi untuk provider "kie":
     *
     * provider_id:
     *     UUID Supabase
     *
     * provider_code:
     *     kie
     *
     * =====================================================
     */

    const providerUuid =
        providerIdentity?.databaseId ??
        persisted?.provider_id ??
        null;


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


        /*
         * FK DATABASE:
         *
         * providers.id
         */

        provider_id:
            providerUuid,


        /*
         * PROVIDER CODE:
         *
         * providers.provider_id
         *
         * Contoh:
         *
         * kie
         */

        provider_code:
            providerData.provider_id,


        /*
         * DISPLAY NAME:
         *
         * GEN-Z.AI
         */

        provider_name:
            providerData.provider_name,


        provider_uuid:
            providerUuid,


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


        discount_percent:
            safeDiscount,


        credit_480p:
            credit480p,


        credit_720p:
            credit720p,


        credit_1080p:
            credit1080p,


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
            registryEntry.folder ||
            "",


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

        const error =
            new Error(
                "SUPABASE_NOT_READY"
            );

        error.code =
            "SUPABASE_NOT_READY";

        throw error;

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

            const databaseError =
                new Error(
                    error.message ||
                    "MODEL_QUERY_FAILED"
                );

            databaseError.code =
                "MODEL_QUERY_FAILED";

            databaseError.details =
                error;

            throw databaseError;

        }


        return Array.isArray(data)
            ? data
            : [];

    }
    catch (
        error
    ) {

        console.warn(
            "GEN-Z.AI: error membaca Admin Models:",
            error
        );


        throw error;

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


    const persistedProviderId =
        persistedModel.provider_id ??
        null;


    /*
     * Provider Supabase berdasarkan UUID.
     */

    const provider =
        Array.isArray(providerMap)

            ? (
                providerMap.find(
                    item =>
                        String(
                            item?.id || ""
                        ) ===
                        String(
                            persistedProviderId ||
                            ""
                        )
                ) || null
            )

            : null;


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


    const safeDiscount =
        normalizeDiscount(
            persistedModel.discount_percent
        );


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


    const providerIdentity =
        normalizeProviderIdentity(
            provider
        );


    const providerCode =
        String(
            providerIdentity?.providerCode ||
            persistedModel.provider_code ||
            registryConfig?.providerId ||
            registryConfig?.provider_id ||
            ""
        ).trim();


    const providerName =
        String(
            providerIdentity?.providerName ||
            persistedModel.provider_name ||
            registryConfig?.providerName ||
            registryConfig?.provider_name ||
            providerCode ||
            ""
        ).trim();


    const providerStatus =
        String(
            providerIdentity?.status ||
            "unknown"
        )
            .trim()
            .toLowerCase();


    const providerData =
        providerIdentity

            ? {

                id:
                    providerIdentity.databaseId,

                provider_id:
                    providerIdentity.providerCode ||
                    providerCode,

                provider_name:
                    providerIdentity.providerName ||
                    providerName,

                status:
                    providerIdentity.status

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


    const status =
        String(
            persistedModel.status ||
            "inactive"
        )
            .trim()
            .toLowerCase();


    const modelType =
        String(
            persistedModel.type ||
            persistedModel.model_type ||
            registryConfig?.type ||
            ""
        ).trim();


    return {

        id:
            persistedModel.id ??
            null,

        model_id:
            modelId,

        model_name:
            String(
                persistedModel.model_name ||
                registryConfig?.name ||
                modelId
            ).trim(),

        description:
            persistedModel.description ??
            registryConfig?.description ??
            "",

        provider_id:
            persistedProviderId,

        provider_code:
            providerCode,

        provider_name:
            providerName,

        provider_uuid:
            persistedProviderId,

        provider:
            providerData,

        type:
            modelType,

        api:
            registryConfig?.api
                ? {
                    ...registryConfig.api
                }
                : {},

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

        discount_percent:
            safeDiscount,

        credit_480p:
            credit480p,

        credit_720p:
            credit720p,

        credit_1080p:
            credit1080p,

        credit480p:
            credit480p,

        credit720p:
            credit720p,

        credit1080p:
            credit1080p,

        status:
            status,

        source:
            "admin-model",

        source_folder:
            registryEntry?.folder ||
            "",

        registry:
            Boolean(
                registryEntry
            ),

        adapter_available:
            Boolean(
                registryEntry
            )

    };

}


/* =========================================================
   LOAD REGISTRY MODELS
========================================================= */

function loadRegistryModels(
    options = {}
) {

    const providerMap =
        Array.isArray(options)
            ? options
            : (
                Array.isArray(
                    options.providers
                )
                    ? options.providers
                    : []
            );


    const models =
        MODEL_REGISTRY
            .map(
                registryEntry =>
                    normalizeRegistryModel(
                        registryEntry,
                        providerMap,
                        null
                    )
            )
            .filter(Boolean);


    /*
     * Debug registry.
     */

    console.info(
        "[GEN-Z.AI] Registry model catalog:",
        models.map(
            model => ({

                model_id:
                    model.model_id,

                provider_id:
                    model.provider_id,

                provider_code:
                    model.provider_code,

                provider_name:
                    model.provider_name

            })
        )
    );


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
        providerCache,
        null
    );

}


/* =========================================================
   MODEL RESULT FILTER
========================================================= */

function filterLoadedModels(
    models,
    options = {}
) {

    const {
        includeInactive = true,
        activeProviderOnly = false
    } = options;


    let result =
        Array.isArray(models)
            ? models.slice()
            : [];


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


    if (
        modelsLoaded &&
        !force
    ) {

        return filterLoadedModels(
            modelCache,
            {
                includeInactive,
                activeProviderOnly
            }
        );

    }


    if (
        modelsLoadingPromise
    ) {

        const result =
            await modelsLoadingPromise;


        return filterLoadedModels(
            result,
            {
                includeInactive,
                activeProviderOnly
            }
        );

    }


    modelsLoadingPromise =
        (async function () {

            const supabase =
                getSupabaseClient();


            if (!supabase) {

                const error =
                    new Error(
                        "SUPABASE_NOT_READY"
                    );

                error.code =
                    "SUPABASE_NOT_READY";

                throw error;

            }


            const providers =
                await loadProviders({

                    force,

                    includeInactive:
                        true

                });


            const persistedModels =
                await loadPersistedModels();


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


            modelCache =
                models.slice();


            modelsLoaded =
                true;


            return models.slice();

        })();


    try {

        const loadedModels =
            await modelsLoadingPromise;


        return filterLoadedModels(
            loadedModels,
            {
                includeInactive,
                activeProviderOnly
            }
        );

    }
    catch (
        error
    ) {

        console.warn(
            "GEN-Z.AI: loadModels gagal:",
            error
        );


        throw error;

    }
    finally {

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
   GET RESOLUTION CREDIT
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


    return 0;

}


/* =========================================================
   GET MODEL PRICING CONFIG
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


    normalizeProviderIdentity,

    normalizeProviderToken,

    providerMatchesCode,

    findRegistryProvider,


    normalizeRegistryModel,

    normalizePersistedModel,


    clearProviderCache,

    clearModelCache,

    clearCache,


    loadProviders,

    getProviderById,

    getProviderByCode,


    loadRegistryModels,

    getRegistryModel,


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


    normalizeProviderIdentity,

    normalizeProviderToken,

    providerMatchesCode,

    findRegistryProvider,


    normalizeRegistryModel,

    normalizePersistedModel,


    clearProviderCache,

    clearModelCache,

    clearCache,


    loadProviders,

    getProviderById,

    getProviderByCode,


    loadRegistryModels,

    getRegistryModel,


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
