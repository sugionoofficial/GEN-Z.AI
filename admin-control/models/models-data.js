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


    /*
     * Identitas Provider KIE.
     *
     * Ini hanya untuk katalog yang memang berasal
     * dari /api/kie-config atau tabel kie_models.
     */
    const KIE_PROVIDER_ID =
        "kie_ai";

    const KIE_PROVIDER_NAME =
        "KIE.AI";


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
       BOOLEAN HELPER
    ===================================================== */

    function normalizeBoolean(
        value
    ) {

        if (
            typeof value === "boolean"
        ) {

            return value;
        }


        if (
            typeof value === "number"
        ) {

            if (
                value === 1
            ) {

                return true;
            }

            if (
                value === 0
            ) {

                return false;
            }
        }


        const normalized =
            normalizeString(
                value
            );


        if (
            normalized === "true" ||
            normalized === "1" ||
            normalized === "yes" ||
            normalized === "on" ||
            normalized === "active" ||
            normalized === "enabled"
        ) {

            return true;
        }


        if (
            normalized === "false" ||
            normalized === "0" ||
            normalized === "no" ||
            normalized === "off" ||
            normalized === "inactive" ||
            normalized === "disabled"
        ) {

            return false;
        }


        return null;
    }


    /* =====================================================
       KIE PROVIDER IDENTITY
    ===================================================== */

    function applyKieProvider(
        model
    ) {

        if (
            !model ||
            typeof model !== "object"
        ) {

            return null;
        }


        return {

            ...model,

            provider:
                KIE_PROVIDER_ID,

            provider_id:
                KIE_PROVIDER_ID,

            provider_name:
                KIE_PROVIDER_NAME

        };
    }


    /* =====================================================
       MODEL NORMALIZATION
    ===================================================== */

    function normalizeModel(
        model,
        options = {}
    ) {

        if (
            !model ||
            typeof model !== "object"
        ) {

            return null;
        }


        const {
            forceKieProvider = false
        } = options;


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


        const providerValue =
            String(
                model.provider_id ??
                model.provider_code ??
                model.provider ??
                ""
            ).trim();


        const providerName =
            String(
                model.provider_name ??
                model.providerName ??
                ""
            ).trim();


        const normalized = {

            ...model,

            model_id:
                modelId,

            model_name:
                modelName,

            model_family:
                modelFamily,

            provider:
                providerValue,

            provider_id:
                providerValue,

            provider_name:
                providerName

        };


        if (
            forceKieProvider
        ) {

            return applyKieProvider(
                normalized
            );
        }


        return normalized;
    }


    /* =====================================================
       NORMALIZE MODELS
    ===================================================== */

    function normalizeModels(
        data,
        options = {}
    ) {

        if (
            !Array.isArray(data)
        ) {

            return [];
        }


        return data
            .map(
                model =>
                    normalizeModel(
                        model,
                        options
                    )
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


        /*
         * ID database.
         *
         * Jangan menggantinya dengan provider_id.
         */
        const databaseId =
            String(
                provider.id ??
                ""
            ).trim();


        /*
         * Provider ID / kode Provider.
         */
        const providerCode =
            String(
                provider.provider_id ??
                provider.provider ??
                ""
            ).trim();


        /*
         * Nama Provider.
         */
        const providerName =
            String(
                provider.provider_name ??
                provider.name ??
                providerCode ??
                ""
            ).trim();


        if (
            !databaseId &&
            !providerCode
        ) {

            return null;
        }


        /*
         * Pertahankan semua field asli
         * dari Supabase.
         *
         * Termasuk:
         * - is_active
         * - active
         * - enabled
         * - status
         * - is_default
         *
         * Tidak dihapus atau ditimpa.
         */
        return {

            ...provider,

            id:
                databaseId ||
                null,

            provider_id:
                providerCode,

            provider_name:
                providerName

        };
    }


    /* =====================================================
       NORMALIZE PROVIDERS
    ===================================================== */

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


                if (
                    !provider
                ) {

                    return;
                }


                /*
                 * Prioritas identitas:
                 *
                 * 1. database UUID
                 * 2. provider_id
                 *
                 * provider_name TIDAK dipakai
                 * sebagai unique key.
                 */
                const key =
                    normalizeString(
                        provider.id ||
                        provider.provider_id
                    );


                if (
                    !key
                ) {

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
         * Status kosong tetap kompatibel
         * dengan data lama.
         */
        if (
            !status
        ) {

            return true;
        }


        return (

            status === "active" ||
            status === "enabled" ||
            status === "enable" ||
            status === "published" ||
            status === "live" ||
            status === "ready" ||
            status === "on" ||
            status === "true" ||
            status === "1"

        );
    }


    /* =====================================================
       ACTIVE PROVIDER
    ===================================================== */

    function isActiveProvider(
        provider
    ) {

        if (
            !provider ||
            typeof provider !== "object"
        ) {

            return false;
        }


        /*
         * PENTING:
         *
         * Jika Supabase menyediakan is_active,
         * field tersebut menjadi sumber utama.
         *
         * Jadi:
         *
         * is_active = true
         *     => aktif
         *
         * is_active = false
         *     => nonaktif
         *
         * Tidak boleh ditimpa oleh status.
         */
        if (
            Object.prototype.hasOwnProperty.call(
                provider,
                "is_active"
            )
        ) {

            const active =
                normalizeBoolean(
                    provider.is_active
                );


            if (
                active !== null
            ) {

                return active;
            }
        }


        /*
         * Kompatibilitas apabila schema lama
         * menggunakan active / enabled.
         */
        if (
            Object.prototype.hasOwnProperty.call(
                provider,
                "active"
            )
        ) {

            const active =
                normalizeBoolean(
                    provider.active
                );


            if (
                active !== null
            ) {

                return active;
            }
        }


        if (
            Object.prototype.hasOwnProperty.call(
                provider,
                "enabled"
            )
        ) {

            const enabled =
                normalizeBoolean(
                    provider.enabled
                );


            if (
                enabled !== null
            ) {

                return enabled;
            }
        }


        /*
         * Fallback terakhir ke status.
         */
        return isActiveStatus(
            provider.status
        );
    }


    /* =====================================================
       ACTIVE MODEL
    ===================================================== */

    function isActiveModel(
        model
    ) {

        return isActiveStatus(
            model?.status
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

        } catch (
            error
        ) {

            console.warn(
                "[models-data] Tidak dapat mengambil access token:",
                error
            );


            return "";
        }
    }


    /* =====================================================
       API RESPONSE EXTRACTION
    ===================================================== */

    function extractRawModelsFromApiResponse(
        data
    ) {

        if (
            Array.isArray(data)
        ) {

            return data;
        }


        if (
            Array.isArray(
                data?.models
            )
        ) {

            return data.models;
        }


        if (
            Array.isArray(
                data?.data?.models
            )
        ) {

            return data.data.models;
        }


        if (
            Array.isArray(
                data?.data
            )
        ) {

            return data.data;
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


        if (
            !token
        ) {

            throw new Error(
                "Session Supabase tidak tersedia untuk API KIE."
            );
        }


        let url =
            KIE_CONFIG_ENDPOINT;


        if (
            modelId
        ) {

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

                    method:
                        "GET",

                    headers:
                        {

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


        if (
            text
        ) {

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


        const rawModels =
            extractRawModelsFromApiResponse(
                data
            );


        /*
         * Semua record dari endpoint ini
         * dianggap sebagai katalog KIE.
         */
        const models =
            normalizeModels(
                rawModels,
                {

                    forceKieProvider:
                        true

                }
            );


        console.info(
            "[models-data] API KIE mengembalikan:",
            models.length,
            "model"
        );


        if (
            models.length
        ) {

            console.info(
                "[models-data] Provider KIE:",
                {

                    provider_id:
                        models[0].provider_id,

                    provider_name:
                        models[0].provider_name,

                    model_id:
                        models[0].model_id,

                    model_name:
                        models[0].model_name

                }
            );
        }


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
            data,
            {

                forceKieProvider:
                    true

            }
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


        /*
         * CACHE
         */
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


        /*
         * REQUEST SEDANG BERJALAN
         */
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


        modelLoadingPromise =
            (async function () {

                let models =
                    [];

                let apiError =
                    null;


                /*
                 * PRIMARY:
                 * /api/kie-config
                 */
                try {

                    models =
                        await loadModelsFromApi();


                    if (
                        !models.length
                    ) {

                        console.warn(
                            "[models-data] API KIE berhasil tetapi models[] kosong."
                        );
                    }

                } catch (
                    error
                ) {

                    apiError =
                        error;


                    console.error(
                        "[models-data] API KIE gagal:",
                        error
                    );
                }


                /*
                 * FALLBACK:
                 * Supabase kie_models
                 */
                if (
                    !models.length
                ) {

                    try {

                        models =
                            await loadModelsFromSupabase();

                    } catch (
                        fallbackError
                    ) {

                        console.error(
                            "[models-data] Fallback Supabase juga gagal:",
                            fallbackError
                        );


                        throw (
                            fallbackError ||
                            apiError ||
                            new Error(
                                "Gagal mengambil katalog Model."
                            )
                        );
                    }
                }


                /*
                 * NORMALISASI FINAL
                 */
                models =
                    normalizeModels(
                        models,
                        {

                            forceKieProvider:
                                true

                        }
                    );


                modelCache =
                    models;


                modelCacheLoaded =
                    true;


                console.info(
                    "[models-data] Model catalog loaded:",
                    modelCache.length
                );


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
            await loadKieModels(
                {

                    activeOnly,

                    force

                }
            );


        const term =
            normalizeString(
                keyword
            );


        if (
            !term
        ) {

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


                const providerId =
                    normalizeString(
                        model.provider_id
                    );


                const providerName =
                    normalizeString(
                        model.provider_name
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

                    providerId.includes(
                        term
                    ) ||

                    providerName.includes(
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


        if (
            !id
        ) {

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


        /*
         * CACHE
         */
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


        /*
         * REQUEST SEDANG BERJALAN
         */
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
                            is_active,
                            active,
                            enabled,
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


                /*
                 * Debug informasi Provider.
                 *
                 * Tidak mengubah data.
                 */
                console.info(
                    "[models-data] Provider status:",
                    providerCache.map(
                        function (provider) {

                            return {

                                id:
                                    provider.id,

                                provider_id:
                                    provider.provider_id,

                                provider_name:
                                    provider.provider_name,

                                is_active:
                                    provider.is_active,

                                active:
                                    provider.active,

                                enabled:
                                    provider.enabled,

                                status:
                                    provider.status

                            };
                        }
                    )
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
            .filter(
                Boolean
            );


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


        if (
            !target
        ) {

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
            await loadProviders(
                {

                    activeOnly,

                    force

                }
            );


        const term =
            normalizeString(
                keyword
            );


        if (
            !term
        ) {

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

            kieProviderId:
                KIE_PROVIDER_ID,

            kieProviderName:
                KIE_PROVIDER_NAME,

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

            /*
             * Model
             */
            loadKieModels,

            searchKieModels,

            findModelById,


            /*
             * Provider
             */
            loadProviders,

            findProviderById,

            searchProviders,


            /*
             * Cache
             */
            clearCache,

            getCachedModels,

            getCachedProviders,

            isModelCacheLoaded,

            isProviderCacheLoaded,


            /*
             * Debug
             */
            getDebugInfo

        });


    console.info(
        "[GEN-Z.AI] GENZModelsData loaded."
    );

})();
