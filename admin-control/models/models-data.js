/* =========================================================
   GEN-Z.AI
   ADMIN MODEL MANAGEMENT
   DATA MODULE
   File: admin-control/models/models-data.js
========================================================= */

(function () {
    "use strict";

    const MODEL_TABLE = "kie_models";
    const PROVIDER_TABLE = "providers";

    let modelCache = [];
    let providerCache = [];

    function getSupabase() {
        if (window.GENZ_SUPABASE) {
            return window.GENZ_SUPABASE;
        }

        if (window.supabaseClient) {
            return window.supabaseClient;
        }

        throw new Error("Supabase client belum tersedia.");
    }

    async function loadKieModels(options = {}) {
        const {
            force = false,
            activeOnly = false
        } = options;

        if (!force && modelCache.length > 0) {
            if (activeOnly) {
                return modelCache.filter(
                    model =>
                        String(model.status || "")
                            .trim()
                            .toUpperCase() === "ACTIVE"
                );
            }

            return [...modelCache];
        }

        const supabase = getSupabase();

        let query = supabase
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
            .order("model_name", {
                ascending: true
            });

        if (activeOnly) {
            query = query.eq(
                "status",
                "ACTIVE"
            );
        }

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

        if (force || modelCache.length === 0) {
            modelCache = Array.isArray(data)
                ? data
                : [];
        }

        return Array.isArray(data)
            ? [...data]
            : [];
    }

    async function searchKieModels(
        keyword = "",
        options = {}
    ) {
        const {
            activeOnly = true
        } = options;

        const models = await loadKieModels({
            activeOnly
        });

        const term = String(
            keyword || ""
        )
            .trim()
            .toLowerCase();

        if (!term) {
            return models;
        }

        return models.filter(
            model => {
                const modelId = String(
                    model.model_id || ""
                ).toLowerCase();

                const modelName = String(
                    model.model_name || ""
                ).toLowerCase();

                const family = String(
                    model.model_family || ""
                ).toLowerCase();

                const provider = String(
                    model.provider || ""
                ).toLowerCase();

                return (
                    modelId.includes(term) ||
                    modelName.includes(term) ||
                    family.includes(term) ||
                    provider.includes(term)
                );
            }
        );
    }

    function findModelById(modelId) {
        const id = String(
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
                        model.model_id || ""
                    )
                        .trim()
                        .toLowerCase() === id
            ) || null
        );
    }

    async function loadProviders(options = {}) {
        const {
            force = false,
            activeOnly = true
        } = options;

        if (!force && providerCache.length > 0) {
            if (activeOnly) {
                return providerCache.filter(
                    provider =>
                        String(provider.status || "")
                            .trim()
                            .toLowerCase() === "active"
                );
            }

            return [...providerCache];
        }

        const supabase = getSupabase();

        let query = supabase
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
            .order("provider_name", {
                ascending: true
            });

        if (activeOnly) {
            query = query.eq(
                "status",
                "active"
            );
        }

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

        if (force || providerCache.length === 0) {
            providerCache = Array.isArray(data)
                ? data
                : [];
        }

        return Array.isArray(data)
            ? [...data]
            : [];
    }

    function findProviderById(
        providerId,
        options = {}
    ) {
        const {
            activeOnly = false
        } = options;

        const id = String(
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
                    const providerIdValue = String(
                        provider.provider_id || ""
                    )
                        .trim()
                        .toLowerCase();

                    if (providerIdValue !== id) {
                        return false;
                    }

                    if (!activeOnly) {
                        return true;
                    }

                    return (
                        String(
                            provider.status || ""
                        )
                            .trim()
                            .toLowerCase() === "active"
                    );
                }
            ) || null
        );
    }

    async function searchProviders(
        keyword = "",
        options = {}
    ) {
        const {
            activeOnly = true
        } = options;

        const providers = await loadProviders({
            activeOnly
        });

        const term = String(
            keyword || ""
        )
            .trim()
            .toLowerCase();

        if (!term) {
            return providers;
        }

        return providers.filter(
            provider => {
                const providerId = String(
                    provider.provider_id || ""
                ).toLowerCase();

                const providerName = String(
                    provider.provider_name || ""
                ).toLowerCase();

                const description = String(
                    provider.description || ""
                ).toLowerCase();

                return (
                    providerId.includes(term) ||
                    providerName.includes(term) ||
                    description.includes(term)
                );
            }
        );
    }

    function clearCache() {
        modelCache = [];
        providerCache = [];
    }

    function getCachedModels() {
        return [...modelCache];
    }

    function getCachedProviders() {
        return [...providerCache];
    }

    window.GENZModelsData = Object.freeze({
        loadKieModels,
        searchKieModels,
        findModelById,
        loadProviders,
        findProviderById,
        searchProviders,
        clearCache,
        getCachedModels,
        getCachedProviders
    });
})();
