/* =========================================================
   GEN-Z.AI
   ADMIN MODEL MANAGEMENT
   DATA MODULE
   File: admin-control/models/models-data.js
========================================================= */

(function () {
    "use strict";

    const TABLE = "kie_models";

    let cache = [];

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

        if (!force && cache.length > 0) {
            return [...cache];
        }

        const supabase = getSupabase();

        let query = supabase
            .from(TABLE)
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

        cache = Array.isArray(data)
            ? data
            : [];

        return [...cache];
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
            cache.find(
                model =>
                    String(
                        model.model_id || ""
                    )
                        .trim()
                        .toLowerCase() === id
            ) || null
        );
    }

    function clearCache() {
        cache = [];
    }

    function getCachedModels() {
        return [...cache];
    }

    window.GENZModelsData = Object.freeze({
        loadKieModels,
        searchKieModels,
        findModelById,
        clearCache,
        getCachedModels
    });
})();
