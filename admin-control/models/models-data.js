/* =========================================================
   GEN-Z.AI
   ADMIN MODEL MANAGEMENT
   DATA MODULE
   ---------------------------------------------------------
   File:
   admin-control/models/models-data.js

   OWNER:
   - Supabase data access
   - Model catalog cache
   - Provider catalog cache
   - Data normalization
   - Basic data lookup

   BUKAN OWNER:
   - Model search UI
   - Dropdown
   - Search rendering
   - Form
   - Table
   - Pricing UI

   COMPATIBILITY:
   Public API lama tetap dipertahankan:
   - loadKieModels()
   - searchKieModels()
   - findModelById()
   - loadProviders()
   - findProviderById()
   - searchProviders()
   - clearCache()
   - getCachedModels()
   - getCachedProviders()
   - getDebugInfo()

   CATATAN DATABASE:
   - public.kie_models menggunakan kolom "provider"
   - public.providers menggunakan "provider_id"
   - provider.id adalah UUID database
   - kie_models tidak diasumsikan mempunyai provider_id
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


    /* =====================================================
       CACHE
    ===================================================== */

    let modelCache = [];

    let providerCache = [];


    /*
     * Status cache dipisahkan dari panjang array.
     *
     * Ini penting karena:
     *
     * [] setelah query berhasil
     *
     * berbeda dengan:
     *
     * [] karena belum pernah query.
     */
    let modelCacheLoaded =
        false;

    let providerCacheLoaded =
        false;


    /*
     * Promise terpisah mencegah dua module melakukan
     * query yang sama secara bersamaan.
     */
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


        /*
         * Struktur aktual kie_models:
         *
         * provider
         * model_family
         * model_id
         * model_name
         * status
         * documentation_url
         * metadata
         *
         * Jangan menghapus field lain yang mungkin
         * ditambahkan database.
         */

        const providerValue =
            String(
                model.provider ??
                ""
            ).trim();


        const modelId =
            String(
                model.model_id ??
                model.modelId ??
                ""
            ).trim();


        const modelName =
            String(
                model.model_name ??
                model.modelName ??
                model.name ??
                ""
            ).trim();


        const modelFamily =
            String(
                model.model_family ??
                model.modelFamily ??
                model.family ??
                ""
            ).trim();


        /*
         * provider_id hanya alias kompatibilitas.
         *
         * Jangan mengubah field database "provider".
         */
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


        /*
         * UUID database.
         */
        const databaseId =
            String(
                provider.id ??
                ""
            ).trim();


        /*
         * Kode Provider.
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


                /*
                 * Gunakan UUID sebagai identitas utama
                 * jika tersedia.
                 */
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

        return (
            normalizeString(
                value
            ) ===
            "active"
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
         * Cache tersedia.
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
         * Jika request sedang berjalan dan bukan force,
         * ikut request yang sama.
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


        const supabase =
            getSupabase();


        modelLoadingPromise =
            (async function () {

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


                const normalized =
                    normalizeModels(
                        data
                    );


                /*
                 * Cache SELALU menyimpan seluruh Model.
                 *
                 * activeOnly hanya berlaku pada hasil return.
                 *
                 * Ini penting agar:
                 *
                 * loadKieModels({
                 *     activeOnly: true
                 * })
                 *
                 * tidak menghancurkan katalog Model
                 * yang inactive.
                 */
                modelCache =
                    normalized;


                modelCacheLoaded =
                    true;


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
       
       COMPATIBILITY API ONLY.
       
       Search UI utama dimiliki:
       GENZModelsSearch
       
       Fungsi ini tetap tersedia karena kemungkinan
       dipanggil module lama / external compatibility.
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


        /*
         * Cache sudah pernah berhasil dimuat.
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
         * Request sedang berjalan.
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


                /*
                 * Cache seluruh Provider.
                 *
                 * Filter active hanya dilakukan pada
                 * hasil return.
                 */
                providerCache =
                    normalized;


                providerCacheLoaded =
                    true;


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
       
       Support:
       - UUID database
       - provider_id
       - provider
       - provider_name
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
       
       COMPATIBILITY API ONLY.
       
       Provider lifecycle tetap dimiliki:
       GENZModelsProvider
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
