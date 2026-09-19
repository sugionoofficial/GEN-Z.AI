/* =========================================================
   GEN-Z.AI
   ADMIN MODEL MANAGEMENT
   DATA MODULE
   ---------------------------------------------------------
   File:
   admin-control/models/models-data.js

   OWNER:
   - Model catalog data access
   - Provider catalog data access
   - Model cache
   - Provider cache
   - Data normalization
   - Basic data lookup

   BUKAN OWNER:
   - Model dropdown UI
   - Search UI
   - Search rendering
   - Form
   - Table
   - Pricing UI

   DATA FLOW MODEL:
   
   PRIMARY:
   /api/kie-config
          ↓
      models[]

   FALLBACK:
   Supabase
      ↓
   kie_models

   CATATAN:
   - public.kie_models menggunakan kolom "provider"
   - public.providers menggunakan "provider_id"
   - provider.id adalah UUID database
========================================================= */

(function () {

    "use strict";


    /* =====================================================
       CONSTANT
    ===================================================== */

    const MODEL_TABLE =
        "kie_models";

    const PROVIDER_TABLE =
        "providers";

    const KIE_CONFIG_ENDPOINT =
        "/api/kie-config";


    /* =====================================================
       CACHE
    ===================================================== */

    let modelCache = [];

    let providerCache = [];


    let modelCacheLoaded =
        false;

    let providerCacheLoaded =
        false;


    let modelLoadingPromise =
        null;

    let providerLoadingPromise =
        null;


    /* =====================================================
       SUPABASE
    ===================================================== */

    function getSupabase() {

        if (
            window.GENZ_SUPABASE
        ) {

            return window.GENZ_SUPABASE;
        }


        if (
            window.supabaseClient
        ) {

            return window.supabaseClient;
        }


        throw new Error(
            "Supabase client belum tersedia."
        );
    }


    /* =====================================================
       STRING HELPER
    ===================================================== */

    function normalizeString(
        value
    ) {

        return String(
            value ?? ""
        )
            .trim()
            .toLowerCase();
    }


    /* =====================================================
       MODEL NORMALIZATION
    ===================================================== */

    function normalizeModel(
        model
    ) {

        if (
            !model ||
            typeof model !== "object"
        ) {

            return null;
        }


        const providerValue =
            String(
                model.provider ??
                model.provider_id ??
                model.provider_code ??
                ""
            ).trim();


        const modelId =
            String(
                model.model_id ??
                model.modelId ??
                model.id ??
                ""
            ).trim();


        const modelName =
            String(
                model.model_name ??
                model.modelName ??
                model.name ??
                modelId ??
                ""
            ).trim();


        const modelFamily =
            String(
                model.model_family ??
                model.modelFamily ??
                model.family ??
                ""
            ).trim();


        return {

            ...model,

            provider:
                providerValue,

            provider_id:
                String(
                    model.provider_id ??
                    providerValue
                ).trim(),

            model_id:
                modelId,

            model_name:
                modelName,

            model_family:
                modelFamily

        };
    }


    function normalizeModels(
        data
    ) {

        if (
            !Array.isArray(data)
        ) {

            return [];
        }


        return data
            .map(
                normalizeModel
            )
            .filter(
                Boolean
            );
    }


    /* =====================================================
       PROVIDER NORMALIZATION
    ===================================================== */

    function normalizeProvider(
        provider
    ) {

        if (
            !provider ||
            typeof provider !== "object"
        ) {

            return null;
        }


        const databaseId =
            String(
                provider.id ??
                ""
            ).trim();


        const providerCode =
            String(
                provider.provider_id ??
                provider.provider ??
                ""
            ).trim();


        const providerName =
            String(
                provider.provider_name ??
                provider.name ??
                providerCode ??
                databaseId
            ).trim();


        if (
            !databaseId &&
            !providerCode
        ) {

            return null;
        }


        return {

            ...provider,

            id:
                databaseId ||
                provider.id ||
                null,

            provider_id:
                providerCode ||
                databaseId,

            provider_name:
                providerName

        };
    }


    function normalizeProviders(
        data
    ) {

        if (
            !Array.isArray(data)
        ) {

            return [];
        }


        const result = [];

        const seen = new Set();


        data.forEach(
            function (item) {

                const provider =
                    normalizeProvider(
                        item
                    );


                if (!provider) {

                    return;
                }


                const key =
                    normalizeString(
                        provider.id ||
                        provider.provider_id
                    );


                if (!key) {

                    return;
                }


                if (
                    seen.has(key)
                ) {

                    return;
                }


                seen.add(key);

                result.push(
                    provider
                );

            }
        );


        return result;
    }


    /* =====================================================
       STATUS
    ===================================================== */

    function isActiveStatus(
        value
    ) {

        const status =
            normalizeString(
                value
            );


        /*
         * Data lama kadang menggunakan status kosong.
         * Status kosong tidak kita buang supaya katalog
         * tidak tiba-tiba menjadi 0.
         */

        if (!status) {

            return true;
        }


        return (

            status === "active" ||
            status === "enabled" ||
            status === "published" ||
            status === "live" ||
            status === "ready"

        );
    }


    function isActiveModel(
        model
    ) {

        return isActiveStatus(
            model?.status
        );
    }


    function isActiveProvider(
        provider
    ) {

        return isActiveStatus(
            provider?.status
        );
    }


    /* =====================================================
       SESSION ACCESS TOKEN
    ===================================================== */

    async function getAccessToken() {

        try {

            const supabase =
                getSupabase();


            if (
                !supabase?.auth ||
                typeof supabase.auth.getSession !== "function"
            ) {

                return "";
            }


            const result =
                await supabase.auth.getSession();


            const session =
                result?.data?.session;


            return (
                session?.access_token ||
                ""
            );

        } catch (error) {

            console.warn(
                "[models-data] Tidak dapat mengambil access token:",
                error
            );

            return "";
        }
    }


    /* =====================================================
       API RESPONSE NORMALIZATION
    ===================================================== */

    function extractModelsFromApiResponse(
        data
    ) {

        if (
            Array.isArray(data)
        ) {

            return normalizeModels(
                data
            );
        }


        if (
            Array.isArray(
                data?.models
            )
        ) {

            return normalizeModels(
                data.models
            );
        }


        if (
            Array.isArray(
                data?.data?.models
            )
        ) {

            return normalizeModels(
                data.data.models
            );
        }


        if (
            Array.isArray(
                data?.data
            )
        ) {

            return normalizeModels(
                data.data
            );
        }


        return [];
    }


    /* =====================================================
       LOAD MODELS FROM API
    ===================================================== */

    async function loadModelsFromApi(
        options = {}
    ) {

        const {
            modelId = ""
        } = options;


        const token =
            await getAccessToken();


        if (!token) {

            throw new Error(
                "Session Supabase tidak tersedia untuk API KIE."
            );
        }


        let url =
            KIE_CONFIG_ENDPOINT;


        if (modelId) {

            url +=
                `?model_id=${encodeURIComponent(
                    modelId
                )}`;

        }


        console.info(
            "[models-data] Mengambil katalog model dari:",
            url
        );


        const response =
            await fetch(
                url,
                {

                    method: "GET",

                    headers: {

                        "Accept":
                            "application/json",

                        "Authorization":
                            `Bearer ${token}`

                    },

                    credentials:
                        "same-origin"

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

                data = {

                    raw:
                        text

                };

            }

        }


        if (
            !response.ok
        ) {

            const message =
                data?.error ||
                data?.message ||
                `API KIE gagal (${response.status})`;


            throw new Error(
                message
            );
        }


        const models =
            extractModelsFromApiResponse(
                data
            );


        console.info(
            "[models-data] API KIE mengembalikan:",
            models.length,
            "model"
        );


        return models;
    }


    /* =====================================================
       LOAD MODELS DIRECT SUPABASE
       FALLBACK
    ===================================================== */

    async function loadModelsFromSupabase() {

        const supabase =
            getSupabase();


        console.warn(
            "[models-data] Fallback: membaca kie_models langsung dari Supabase."
        );


        const {
            data,
            error
        } =
            await supabase
                .from(
                    MODEL_TABLE
                )
                .select(`
                    id,
                    provider,
                    model_family,
                    model_id,
                    model_name,
                    status,
                    documentation_url,
                    metadata,
                    created_at,
                    updated_at
                `)
                .order(
                    "model_name",
                    {
                        ascending:
                            true
                    }
                );


        if (
            error
        ) {

            console.error(
                "[models-data] Gagal mengambil kie_models:",
                error
            );


            throw error;
        }


        return normalizeModels(
            data
        );
    }


    /* =====================================================
       LOAD MODELS
    ===================================================== */

    async function loadKieModels(
        options = {}
    ) {

        const {
            force = false,
            activeOnly = false
        } = options;


        /* =================================================
           CACHE
        ================================================= */

        if (
            !force &&
            modelCacheLoaded
        ) {

            const cached =
                [
                    ...modelCache
                ];


            if (
                activeOnly
            ) {

                return cached.filter(
                    isActiveModel
                );
            }


            return cached;
        }


        /* =================================================
           REQUEST YANG SEDANG BERJALAN
        ================================================= */

        if (
            modelLoadingPromise &&
            !force
        ) {

            const result =
                await modelLoadingPromise;


            if (
                activeOnly
            ) {

                return result.filter(
                    isActiveModel
                );
            }


            return [
                ...result
            ];
        }


        /* =================================================
           PRIMARY API
        ================================================= */

        modelLoadingPromise =
            (async function () {

                let models = [];

                let apiError =
                    null;


                /*
                 * STEP 1
                 *
                 * Gunakan /api/kie-config.
                 */

                try {

                    models =
                        await loadModelsFromApi();


                    /*
                     * API berhasil tetapi mengembalikan
                     * array kosong.
                     *
                     * Jangan langsung menganggap API rusak.
                     * Namun untuk Admin Model dropdown,
                     * fallback Supabase tetap dicoba agar
                     * katalog tidak kosong karena masalah
                     * konfigurasi API.
                     */

                    if (
                        !models.length
                    ) {

                        console.warn(
                            "[models-data] API KIE berhasil tetapi models[] kosong."
                        );

                    }

                } catch (error) {

                    apiError =
                        error;


                    console.error(
                        "[models-data] API KIE gagal:",
                        error
                    );

                }


                /*
                 * STEP 2
                 *
                 * Fallback ke Supabase langsung jika API
                 * gagal atau tidak memberikan model.
                 */

                if (
                    !models.length
                ) {

                    try {

                        models =
                            await loadModelsFromSupabase();

                    } catch (fallbackError) {

                        console.error(
                            "[models-data] Fallback Supabase juga gagal:",
                            fallbackError
                        );


                        /*
                         * Kalau API dan fallback sama-sama
                         * gagal, lempar error yang paling
                         * informatif.
                         */

                        throw (
                            fallbackError ||
                            apiError ||
                            new Error(
                                "Gagal mengambil katalog Model."
                            )
                        );
                    }

                }


                /* =================================================
                   NORMALISASI FINAL
                ================================================= */

                models =
                    normalizeModels(
                        models
                    );


                /* =================================================
                   CACHE
                ================================================= */

                modelCache =
                    models;


                modelCacheLoaded =
                    true;


                console.info(
                    "[models-data] Model catalog loaded:",
                    modelCache.length
                );


                /*
                 * Debug detail.
                 */

                if (
                    modelCache.length
                ) {

                    console.info(
                        "[models-data] Model pertama:",
                        modelCache[0]
                    );

                } else {

                    console.warn(
                        "[models-data] KATALOG MODEL MASIH KOSONG."
                    );

                }


                return [
                    ...modelCache
                ];

            })();


        try {

            const result =
                await modelLoadingPromise;


            if (
                activeOnly
            ) {

                return result.filter(
                    isActiveModel
                );
            }


            return [
                ...result
            ];

        } finally {

            modelLoadingPromise =
                null;
        }
    }


    /* =====================================================
       SEARCH MODELS
       COMPATIBILITY API
    ===================================================== */

    async function searchKieModels(
        keyword = "",
        options = {}
    ) {

        const {
            activeOnly = true,
            force = false
        } = options;


        const models =
            await loadKieModels({

                activeOnly,

                force

            });


        const term =
            normalizeString(
                keyword
            );


        if (!term) {

            return [
                ...models
            ];
        }


        return models.filter(
            function (model) {

                const modelId =
                    normalizeString(
                        model.model_id
                    );


                const modelName =
                    normalizeString(
                        model.model_name
                    );


                const family =
                    normalizeString(
                        model.model_family
                    );


                const provider =
                    normalizeString(
                        model.provider_id ||
                        model.provider
                    );


                return (

                    modelId.includes(
                        term
                    ) ||

                    modelName.includes(
                        term
                    ) ||

                    family.includes(
                        term
                    ) ||

                    provider.includes(
                        term
                    )

                );

            }
        );
    }


    /* =====================================================
       FIND MODEL
    ===================================================== */

    function findModelById(
        modelId
    ) {

        const id =
            normalizeString(
                modelId
            );


        if (!id) {

            return null;
        }


        return (

            modelCache.find(
                function (model) {

                    return (

                        normalizeString(
                            model.model_id
                        ) === id

                    );

                }
            ) ||

            null

        );
    }


    /* =====================================================
       LOAD PROVIDERS
    ===================================================== */

    async function loadProviders(
        options = {}
    ) {

        const {
            force = false,
            activeOnly = true
        } = options;


        /* =================================================
           CACHE
        ================================================= */

        if (
            !force &&
            providerCacheLoaded
        ) {

            const cached =
                [
                    ...providerCache
                ];


            if (
                activeOnly
            ) {

                return cached.filter(
                    isActiveProvider
                );
            }


            return cached;
        }


        /* =================================================
           REQUEST SEDANG BERJALAN
        ================================================= */

        if (
            providerLoadingPromise &&
            !force
        ) {

            const result =
                await providerLoadingPromise;


            if (
                activeOnly
            ) {

                return result.filter(
                    isActiveProvider
                );
            }


            return [
                ...result
            ];
        }


        const supabase =
            getSupabase();


        providerLoadingPromise =
            (async function () {

                const {
                    data,
                    error
                } =
                    await supabase
                        .from(
                            PROVIDER_TABLE
                        )
                        .select(`
                            id,
                            provider_id,
                            provider_name,
                            description,
                            status,
                            is_default,
                            created_at,
                            updated_at
                        `)
                        .order(
                            "provider_name",
                            {
                                ascending:
                                    true
                            }
                        );


                if (
                    error
                ) {

                    console.error(
                        "[models-data] Gagal mengambil providers:",
                        error
                    );


                    throw error;
                }


                const normalized =
                    normalizeProviders(
                        data
                    );


                providerCache =
                    normalized;


                providerCacheLoaded =
                    true;


                console.info(
                    "[models-data] Provider catalog loaded:",
                    providerCache.length
                );


                return [
                    ...providerCache
                ];

            })();


        try {

            const result =
                await providerLoadingPromise;


            if (
                activeOnly
            ) {

                return result.filter(
                    isActiveProvider
                );
            }


            return [
                ...result
            ];

        } finally {

            providerLoadingPromise =
                null;
        }
    }


    /* =====================================================
       PROVIDER MATCH
    ===================================================== */

    function providerMatchesValue(
        provider,
        value
    ) {

        const target =
            normalizeString(
                value
            );


        if (
            !provider ||
            !target
        ) {

            return false;
        }


        const values = [

            provider.id,

            provider.provider_id,

            provider.provider,

            provider.provider_name,

            provider.name

        ]
            .map(
                normalizeString
            )
            .filter(Boolean);


        return values.includes(
            target
        );
    }


    /* =====================================================
       FIND PROVIDER
    ===================================================== */

    function findProviderById(
        providerId,
        options = {}
    ) {

        const {
            activeOnly = false
        } = options;


        const target =
            normalizeString(
                providerId
            );


        if (!target) {

            return null;
        }


        const found =
            providerCache.find(
                function (provider) {

                    if (
                        !providerMatchesValue(
                            provider,
                            target
                        )
                    ) {

                        return false;
                    }


                    if (
                        !activeOnly
                    ) {

                        return true;
                    }


                    return isActiveProvider(
                        provider
                    );

                }
            );


        return found || null;
    }


    /* =====================================================
       SEARCH PROVIDERS
    ===================================================== */

    async function searchProviders(
        keyword = "",
        options = {}
    ) {

        const {
            activeOnly = true,
            force = false
        } = options;


        const providers =
            await loadProviders({

                activeOnly,

                force

            });


        const term =
            normalizeString(
                keyword
            );


        if (!term) {

            return [
                ...providers
            ];
        }


        return providers.filter(
            function (provider) {

                const providerId =
                    normalizeString(
                        provider.provider_id
                    );


                const providerName =
                    normalizeString(
                        provider.provider_name
                    );


                const description =
                    normalizeString(
                        provider.description
                    );


                return (

                    providerId.includes(
                        term
                    ) ||

                    providerName.includes(
                        term
                    ) ||

                    description.includes(
                        term
                    )

                );

            }
        );
    }


    /* =====================================================
       CLEAR CACHE
    ===================================================== */

    function clearCache() {

        modelCache =
            [];

        providerCache =
            [];

        modelCacheLoaded =
            false;

        providerCacheLoaded =
            false;

        modelLoadingPromise =
            null;

        providerLoadingPromise =
            null;


        console.info(
            "[models-data] Cache cleared."
        );


        return true;
    }


    /* =====================================================
       CACHE ACCESS
    ===================================================== */

    function getCachedModels() {

        return [
            ...modelCache
        ];
    }


    function getCachedProviders() {

        return [
            ...providerCache
        ];
    }


    function isModelCacheLoaded() {

        return (
            modelCacheLoaded
        );
    }


    function isProviderCacheLoaded() {

        return (
            providerCacheLoaded
        );
    }


    /* =====================================================
       DEBUG
    ===================================================== */

    function getDebugInfo() {

        return {

            modelTable:
                MODEL_TABLE,

            providerTable:
                PROVIDER_TABLE,

            kieConfigEndpoint:
                KIE_CONFIG_ENDPOINT,

            modelCacheLoaded:
                modelCacheLoaded,

            providerCacheLoaded:
                providerCacheLoaded,

            modelLoading:
                Boolean(
                    modelLoadingPromise
                ),

            providerLoading:
                Boolean(
                    providerLoadingPromise
                ),

            modelCacheCount:
                modelCache.length,

            providerCacheCount:
                providerCache.length,

            models:
                [
                    ...modelCache
                ],

            providers:
                [
                    ...providerCache
                ]

        };
    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    window.GENZModelsData =
        Object.freeze({

            /* ---------------------------------------------
               Model
            --------------------------------------------- */

            loadKieModels,

            searchKieModels,

            findModelById,


            /* ---------------------------------------------
               Provider
            --------------------------------------------- */

            loadProviders,

            findProviderById,

            searchProviders,


            /* ---------------------------------------------
               Cache
            --------------------------------------------- */

            clearCache,

            getCachedModels,

            getCachedProviders,

            isModelCacheLoaded,

            isProviderCacheLoaded,


            /* ---------------------------------------------
               Debug
            --------------------------------------------- */

            getDebugInfo

        });


    console.info(
        "[GEN-Z.AI] GENZModelsData loaded."
    );

})();
