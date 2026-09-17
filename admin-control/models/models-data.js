/* =========================================================
   GEN-Z.AI
   ADMIN MODEL MANAGEMENT
   DATA MODULE

   File:
   admin-control/models/models-data.js

   Fungsi:
   - Load model dari public.kie_models
   - Load provider dari public.providers
   - Search model
   - Search provider
   - Normalisasi provider -> provider_id
   - Case-insensitive status handling
   - Cache management

   CATATAN:
   - Tabel kie_models menggunakan kolom "provider"
   - Tabel providers menggunakan kolom "provider_id"
   - Tidak mengasumsikan kie_models memiliki provider_id
========================================================= */

(function () {
    "use strict";

    const MODEL_TABLE = "kie_models";
    const PROVIDER_TABLE = "providers";

    let modelCache = [];
    let providerCache = [];

    /* =====================================================
       SUPABASE
    ===================================================== */

    function getSupabase() {
        if (window.GENZ_SUPABASE) {
            return window.GENZ_SUPABASE;
        }

        if (window.supabaseClient) {
            return window.supabaseClient;
        }

        throw new Error(
            "Supabase client belum tersedia."
        );
    }

    /* =====================================================
       NORMALIZE MODEL
    ===================================================== */

    function normalizeModel(model) {
        if (!model || typeof model !== "object") {
            return null;
        }

        /*
         * kie_models menggunakan kolom "provider".
         *
         * Untuk kompatibilitas dengan form/search,
         * kita expose juga sebagai provider_id.
         *
         * Tidak melakukan query kolom provider_id
         * yang belum tentu ada di database.
         */

        const providerValue = String(
            model.provider || ""
        ).trim();

        return {
            ...model,

            provider:
                providerValue,

            provider_id:
                providerValue
        };
    }

    function normalizeModels(data) {
        if (!Array.isArray(data)) {
            return [];
        }

        return data
            .map(normalizeModel)
            .filter(Boolean);
    }

    /* =====================================================
       MODEL STATUS
    ===================================================== */

    function isActiveModel(model) {
        return (
            String(
                model?.status || ""
            )
                .trim()
                .toLowerCase() === "active"
        );
    }

    /* =====================================================
       LOAD KIE MODELS
    ===================================================== */

    async function loadKieModels(options = {}) {
        const {
            force = false,
            activeOnly = false
        } = options;

        /*
         * Gunakan cache hanya jika memang tersedia.
         */

        if (
            !force &&
            modelCache.length > 0
        ) {
            const cached =
                [...modelCache];

            if (activeOnly) {
                return cached.filter(
                    isActiveModel
                );
            }

            return cached;
        }

        const supabase =
            getSupabase();

        let query =
            supabase
                .from(MODEL_TABLE)
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
                        ascending: true
                    }
                );

        /*
         * JANGAN menggunakan:
         *
         * .eq("status", "ACTIVE")
         *
         * karena data lama bisa saja menggunakan:
         * active
         * Active
         * ACTIVE
         *
         * Kita filter case-insensitive
         * setelah data diterima.
         */

        const {
            data,
            error
        } = await query;

        if (error) {
            console.error(
                "[models-data] Gagal mengambil kie_models:",
                error
            );

            throw error;
        }

        const normalized =
            normalizeModels(data);

        modelCache =
            normalized;

        if (activeOnly) {
            return normalized.filter(
                isActiveModel
            );
        }

        return [
            ...normalized
        ];
    }

    /* =====================================================
       SEARCH KIE MODELS
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
            String(
                keyword || ""
            )
                .trim()
                .toLowerCase();

        /*
         * Tidak ada keyword:
         * kembalikan semua model.
         */

        if (!term) {
            return [
                ...models
            ];
        }

        return models.filter(
            model => {

                const modelId =
                    String(
                        model.model_id ||
                        ""
                    )
                        .trim()
                        .toLowerCase();

                const modelName =
                    String(
                        model.model_name ||
                        ""
                    )
                        .trim()
                        .toLowerCase();

                const family =
                    String(
                        model.model_family ||
                        ""
                    )
                        .trim()
                        .toLowerCase();

                const provider =
                    String(
                        model.provider ||
                        model.provider_id ||
                        ""
                    )
                        .trim()
                        .toLowerCase();

                return (
                    modelId.includes(term) ||
                    modelName.includes(term) ||
                    family.includes(term) ||
                    provider.includes(term)
                );
            }
        );
    }

    /* =====================================================
       FIND MODEL BY ID
    ===================================================== */

    function findModelById(
        modelId
    ) {
        const id =
            String(
                modelId || ""
            )
                .trim()
                .toLowerCase();

        if (!id) {
            return null;
        }

        return (
            modelCache.find(
                model =>
                    String(
                        model.model_id ||
                        ""
                    )
                        .trim()
                        .toLowerCase() ===
                    id
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
         * Gunakan cache.
         */

        if (
            !force &&
            providerCache.length > 0
        ) {
            if (activeOnly) {
                return providerCache.filter(
                    provider =>
                        String(
                            provider.status ||
                            ""
                        )
                            .trim()
                            .toLowerCase() ===
                        "active"
                );
            }

            return [
                ...providerCache
            ];
        }

        const supabase =
            getSupabase();

        let query =
            supabase
                .from(PROVIDER_TABLE)
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
                        ascending: true
                    }
                );

        /*
         * Sama seperti model:
         * jangan bergantung pada kapitalisasi
         * status di database.
         *
         * Jadi kita ambil semua provider,
         * kemudian filter active di JS.
         */

        const {
            data,
            error
        } = await query;

        if (error) {
            console.error(
                "[models-data] Gagal mengambil providers:",
                error
            );

            throw error;
        }

        providerCache =
            Array.isArray(data)
                ? data
                : [];

        if (activeOnly) {
            return providerCache.filter(
                provider =>
                    String(
                        provider.status ||
                        ""
                    )
                        .trim()
                        .toLowerCase() ===
                    "active"
            );
        }

        return [
            ...providerCache
        ];
    }

    /* =====================================================
       FIND PROVIDER BY ID
    ===================================================== */

    function findProviderById(
        providerId,
        options = {}
    ) {
        const {
            activeOnly = false
        } = options;

        const id =
            String(
                providerId || ""
            )
                .trim()
                .toLowerCase();

        if (!id) {
            return null;
        }

        return (
            providerCache.find(
                provider => {

                    const providerIdValue =
                        String(
                            provider.provider_id ||
                            ""
                        )
                            .trim()
                            .toLowerCase();

                    if (
                        providerIdValue !==
                        id
                    ) {
                        return false;
                    }

                    if (
                        !activeOnly
                    ) {
                        return true;
                    }

                    return (
                        String(
                            provider.status ||
                            ""
                        )
                            .trim()
                            .toLowerCase() ===
                        "active"
                    );
                }
            ) ||
            null
        );
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
            String(
                keyword || ""
            )
                .trim()
                .toLowerCase();

        if (!term) {
            return [
                ...providers
            ];
        }

        return providers.filter(
            provider => {

                const providerId =
                    String(
                        provider.provider_id ||
                        ""
                    )
                        .trim()
                        .toLowerCase();

                const providerName =
                    String(
                        provider.provider_name ||
                        ""
                    )
                        .trim()
                        .toLowerCase();

                const description =
                    String(
                        provider.description ||
                        ""
                    )
                        .trim()
                        .toLowerCase();

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
        modelCache = [];
        providerCache = [];
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

    /* =====================================================
       DEBUG
    ===================================================== */

    function getDebugInfo() {
        return {
            modelTable:
                MODEL_TABLE,

            providerTable:
                PROVIDER_TABLE,

            modelCacheCount:
                modelCache.length,

            providerCacheCount:
                providerCache.length,

            models:
                [...modelCache],

            providers:
                [...providerCache]
        };
    }

    /* =====================================================
       PUBLIC API
    ===================================================== */

    window.GENZModelsData =
        Object.freeze({

            loadKieModels,

            searchKieModels,

            findModelById,

            loadProviders,

            findProviderById,

            searchProviders,

            clearCache,

            getCachedModels,

            getCachedProviders,

            getDebugInfo
        });

})();
