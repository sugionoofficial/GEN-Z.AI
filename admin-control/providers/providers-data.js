// ============================================================
// GEN-Z.AI - PROVIDER DATA MANAGER
// CRUD + STATUS MANAGEMENT
// ============================================================

(function () {
    "use strict";

    let supabaseClient = null;
    let providersCache = [];

    // ----------------------------------------------------------
    // SUPABASE INIT
    // ----------------------------------------------------------

    function initSupabase() {
        if (supabaseClient) {
            return supabaseClient;
        }

        if (
            typeof window.supabase === "undefined" ||
            typeof window.supabase.createClient !== "function"
        ) {
            throw new Error("Supabase library belum dimuat.");
        }

        const config = window.GENZConfig || {};

        const supabaseUrl =
            config.SUPABASE_URL ||
            window.SUPABASE_URL ||
            window.supabaseUrl;

        const supabaseAnonKey =
            config.SUPABASE_ANON_KEY ||
            window.SUPABASE_ANON_KEY ||
            window.supabaseAnonKey;

        if (!supabaseUrl || !supabaseAnonKey) {
            throw new Error(
                "Konfigurasi Supabase tidak ditemukan."
            );
        }

        supabaseClient = window.supabase.createClient(
            supabaseUrl,
            supabaseAnonKey
        );

        return supabaseClient;
    }

    function getSupabase() {
        if (!supabaseClient) {
            initSupabase();
        }

        return supabaseClient;
    }

    // ----------------------------------------------------------
    // HELPERS
    // ----------------------------------------------------------

    function normalizeProviderId(value) {
        return String(value || "")
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "-");
    }

    function normalizeStatus(value) {
        const status = String(value || "")
            .trim()
            .toLowerCase();

        if (
            status === "inactive" ||
            status === "disabled" ||
            status === "off" ||
            status === "nonaktif"
        ) {
            return "inactive";
        }

        return "active";
    }

    function getProviderId(provider) {
        if (!provider) {
            return null;
        }

        return provider.id || provider.uuid || null;
    }

    function providerIdExists(providerId, excludeId = null) {
        const normalized = normalizeProviderId(providerId);

        return providersCache.some(function (provider) {
            const currentId = getProviderId(provider);

            if (
                excludeId &&
                String(currentId) === String(excludeId)
            ) {
                return false;
            }

            return (
                normalizeProviderId(provider.provider_id) ===
                normalized
            );
        });
    }

    // ----------------------------------------------------------
    // GET PROVIDERS
    // ----------------------------------------------------------

    async function getProviders(options = {}) {
        const supabase = getSupabase();

        let query = supabase
            .from("providers")
            .select(
                [
                    "id",
                    "provider_id",
                    "provider_name",
                    "description",
                    "status",
                    "is_default",
                    "created_at",
                    "updated_at"
                ].join(",")
            )
            .order("created_at", {
                ascending: true
            });

        if (options.status) {
            query = query.eq(
                "status",
                normalizeStatus(options.status)
            );
        }

        const { data, error } = await query;

        if (error) {
            console.error(
                "[GEN-Z.AI] getProviders error:",
                error
            );

            throw error;
        }

        providersCache = Array.isArray(data)
            ? data
            : [];

        return providersCache;
    }

    // ----------------------------------------------------------
    // GET SINGLE PROVIDER
    // ----------------------------------------------------------

    function getProviderById(providerId) {
        if (!providerId) {
            return null;
        }

        return (
            providersCache.find(function (provider) {
                return (
                    String(getProviderId(provider)) ===
                    String(providerId)
                );
            }) || null
        );
    }

    // ----------------------------------------------------------
    // CREATE PROVIDER
    // ----------------------------------------------------------

    async function createProvider({
        providerId,
        providerName,
        description,
        status = "active",
        isDefault = false
    }) {
        const supabase = getSupabase();

        const normalizedProviderId =
            normalizeProviderId(providerId);

        const cleanProviderName =
            String(providerName || "").trim();

        const cleanDescription =
            String(description || "").trim();

        const cleanStatus =
            normalizeStatus(status);

        if (!normalizedProviderId) {
            throw new Error(
                "Provider ID wajib diisi."
            );
        }

        if (!cleanProviderName) {
            throw new Error(
                "Nama provider wajib diisi."
            );
        }

        if (
            providerIdExists(
                normalizedProviderId
            )
        ) {
            throw new Error(
                "Provider ID sudah digunakan."
            );
        }

        const { data, error } =
            await supabase.rpc(
                "admin_create_provider",
                {
                    p_provider_id:
                        normalizedProviderId,

                    p_provider_name:
                        cleanProviderName,

                    p_description:
                        cleanDescription || null,

                    p_status:
                        cleanStatus,

                    p_is_default:
                        Boolean(isDefault)
                }
            );

        if (error) {
            console.error(
                "[GEN-Z.AI] createProvider error:",
                error
            );

            throw error;
        }

        await getProviders();

        return data;
    }

    // ----------------------------------------------------------
    // UPDATE PROVIDER
    // ----------------------------------------------------------

    async function updateProvider(
        providerId,
        {
            providerName,
            description,
            status = "active",
            isDefault = false
        } = {}
    ) {
        const supabase = getSupabase();

        const provider =
            getProviderById(providerId);

        if (!provider) {
            throw new Error(
                "Provider tidak ditemukan."
            );
        }

        const databaseId =
            getProviderId(provider);

        const cleanProviderId =
            normalizeProviderId(
                provider.provider_id
            );

        const cleanProviderName =
            String(
                providerName ??
                provider.provider_name ??
                ""
            ).trim();

        const cleanDescription =
            String(
                description ??
                provider.description ??
                ""
            ).trim();

        const cleanStatus =
            normalizeStatus(
                status ??
                provider.status
            );

        if (!cleanProviderName) {
            throw new Error(
                "Nama provider wajib diisi."
            );
        }

        const { data, error } =
            await supabase.rpc(
                "admin_update_provider",
                {
                    p_id:
                        databaseId,

                    p_provider_id:
                        cleanProviderId,

                    p_provider_name:
                        cleanProviderName,

                    p_description:
                        cleanDescription || null,

                    p_status:
                        cleanStatus,

                    p_is_default:
                        Boolean(isDefault)
                }
            );

        if (error) {
            console.error(
                "[GEN-Z.AI] updateProvider error:",
                error
            );

            throw error;
        }

        await getProviders();

        return data;
    }

    // ----------------------------------------------------------
    // TOGGLE ACTIVE / INACTIVE
    // ----------------------------------------------------------

    async function toggleProvider(
        providerId
    ) {
        const provider =
            getProviderById(providerId);

        if (!provider) {
            throw new Error(
                "Provider tidak ditemukan."
            );
        }

        const currentStatus =
            normalizeStatus(
                provider.status
            );

        const nextStatus =
            currentStatus === "active"
                ? "inactive"
                : "active";

        return updateProvider(
            providerId,
            {
                providerName:
                    provider.provider_name,

                description:
                    provider.description,

                status:
                    nextStatus,

                isDefault:
                    Boolean(
                        provider.is_default
                    )
            }
        );
    }

    // ----------------------------------------------------------
    // ACTIVATE PROVIDER
    // ----------------------------------------------------------

    async function activateProvider(
        providerId
    ) {
        const provider =
            getProviderById(providerId);

        if (!provider) {
            throw new Error(
                "Provider tidak ditemukan."
            );
        }

        return updateProvider(
            providerId,
            {
                providerName:
                    provider.provider_name,

                description:
                    provider.description,

                status: "active",

                isDefault:
                    Boolean(
                        provider.is_default
                    )
            }
        );
    }

    // ----------------------------------------------------------
    // DEACTIVATE PROVIDER
    // ----------------------------------------------------------

    async function deactivateProvider(
        providerId
    ) {
        const provider =
            getProviderById(providerId);

        if (!provider) {
            throw new Error(
                "Provider tidak ditemukan."
            );
        }

        return updateProvider(
            providerId,
            {
                providerName:
                    provider.provider_name,

                description:
                    provider.description,

                status: "inactive",

                isDefault:
                    Boolean(
                        provider.is_default
                    )
            }
        );
    }

    // ----------------------------------------------------------
    // DELETE PROVIDER
    // ----------------------------------------------------------

    async function deleteProvider(
        providerId
    ) {
        const supabase = getSupabase();

        const provider =
            getProviderById(providerId);

        if (!provider) {
            throw new Error(
                "Provider tidak ditemukan."
            );
        }

        const databaseId =
            getProviderId(provider);

        const { data, error } =
            await supabase.rpc(
                "admin_delete_provider",
                {
                    p_id:
                        databaseId
                }
            );

        if (error) {
            console.error(
                "[GEN-Z.AI] deleteProvider error:",
                error
            );

            throw error;
        }

        await getProviders();

        return data;
    }

    // ----------------------------------------------------------
    // REFRESH
    // ----------------------------------------------------------

    async function loadProviders(
        options = {}
    ) {
        return getProviders(options);
    }

    // ----------------------------------------------------------
    // PROVIDER STATISTICS
    // ----------------------------------------------------------

    function getProviderStats() {
        const providers =
            Array.isArray(providersCache)
                ? providersCache
                : [];

        const total =
            providers.length;

        const active =
            providers.filter(function (provider) {
                return (
                    normalizeStatus(
                        provider.status
                    ) === "active"
                );
            }).length;

        const inactive =
            total - active;

        const defaults =
            providers.filter(function (provider) {
                return Boolean(
                    provider.is_default
                );
            }).length;

        return {
            total,
            active,
            inactive,
            defaults
        };
    }

    // ----------------------------------------------------------
    // CLEAR CACHE
    // ----------------------------------------------------------

    function clearProviders() {
        providersCache = [];
    }

    // ----------------------------------------------------------
    // EXPORT
    // ----------------------------------------------------------

    window.GENZProvidersData = {
        initSupabase,
        getSupabase,

        getProviders,
        getProviderById,

        normalizeProviderId,
        providerIdExists,

        createProvider,
        updateProvider,

        toggleProvider,
        activateProvider,
        deactivateProvider,

        deleteProvider,

        loadProviders,
        getProviderStats,
        clearProviders
    };

})();
