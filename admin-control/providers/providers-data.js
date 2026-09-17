// ============================================================
// GEN-Z.AI - PROVIDER DATA MANAGER
// SUPABASE + CRUD + STATUS MANAGEMENT
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
            !window.supabase ||
            typeof window.supabase.createClient !==
                "function"
        ) {
            throw new Error(
                "Supabase library belum dimuat."
            );
        }

        // ======================================================
        // GUNAKAN CONFIG YANG BENAR
        // ======================================================

        const config =
            window.GENZ_CONFIG || {};

        const supabaseUrl =
            config.SUPABASE_URL ||
            window.SUPABASE_URL ||
            window.supabaseUrl;

        const supabaseKey =
            config.SUPABASE_KEY ||
            config.SUPABASE_ANON_KEY ||
            window.SUPABASE_KEY ||
            window.SUPABASE_ANON_KEY ||
            window.supabaseAnonKey;

        if (
            !supabaseUrl ||
            !supabaseKey
        ) {
            throw new Error(
                "Konfigurasi Supabase tidak ditemukan."
            );
        }

        supabaseClient =
            window.supabase.createClient(
                supabaseUrl,
                supabaseKey
            );

        return supabaseClient;
    }

    // ----------------------------------------------------------
    // GET SUPABASE
    // ----------------------------------------------------------

    function getSupabase() {

        if (!supabaseClient) {
            initSupabase();
        }

        return supabaseClient;
    }

    // ----------------------------------------------------------
    // SESSION
    // ----------------------------------------------------------

    async function getSession() {

        const supabase =
            getSupabase();

        const {
            data,
            error
        } =
            await supabase.auth.getSession();

        if (error) {
            throw error;
        }

        if (
            !data ||
            !data.session
        ) {
            throw new Error(
                "Session Supabase tidak ditemukan. Silakan login kembali."
            );
        }

        return data.session;
    }

    // ----------------------------------------------------------
    // HELPERS
    // ----------------------------------------------------------

    function normalizeProviderId(
        value
    ) {
        return String(
            value || ""
        )
            .trim()
            .toLowerCase()
            .replace(
                /\s+/g,
                "-"
            );
    }

    function normalizeStatus(
        value
    ) {

        const status =
            String(
                value || ""
            )
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

    function getProviderId(
        provider
    ) {

        if (!provider) {
            return null;
        }

        return (
            provider.id ||
            provider.uuid ||
            null
        );
    }

    function getProviderPublicId(
        provider
    ) {

        if (!provider) {
            return null;
        }

        return normalizeProviderId(
            provider.provider_id
        );
    }

    function providerIdExists(
        providerId,
        excludeId = null
    ) {

        const normalized =
            normalizeProviderId(
                providerId
            );

        return providersCache.some(
            function (provider) {

                const currentDatabaseId =
                    getProviderId(
                        provider
                    );

                if (
                    excludeId &&
                    String(
                        currentDatabaseId
                    ) ===
                    String(
                        excludeId
                    )
                ) {
                    return false;
                }

                return (
                    getProviderPublicId(
                        provider
                    ) ===
                    normalized
                );
            }
        );
    }

    // ----------------------------------------------------------
    // GET PROVIDERS
    // ----------------------------------------------------------

    async function getProviders(
        options = {}
    ) {

        const supabase =
            getSupabase();

        let query =
            supabase
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
                .order(
                    "created_at",
                    {
                        ascending: true
                    }
                );

        if (
            options.status
        ) {

            query =
                query.eq(
                    "status",
                    normalizeStatus(
                        options.status
                    )
                );
        }

        const {
            data,
            error
        } =
            await query;

        if (error) {

            console.error(
                "[GEN-Z.AI] getProviders error:",
                error
            );

            throw error;
        }

        providersCache =
            Array.isArray(data)
                ? data
                : [];

        return [
            ...providersCache
        ];
    }

    // ----------------------------------------------------------
    // GET SINGLE PROVIDER
    // ----------------------------------------------------------

    function getProviderById(
        providerId
    ) {

        if (!providerId) {
            return null;
        }

        const searchId =
            String(
                providerId
            );

        return (
            providersCache.find(
                function (
                    provider
                ) {

                    return (
                        String(
                            getProviderId(
                                provider
                            )
                        ) ===
                        searchId
                    );
                }
            ) ||
            null
        );
    }

    // ----------------------------------------------------------
    // GET SINGLE PROVIDER BY PROVIDER_ID
    // ----------------------------------------------------------

    function getProviderByProviderId(
        providerId
    ) {

        const normalized =
            normalizeProviderId(
                providerId
            );

        return (
            providersCache.find(
                function (
                    provider
                ) {

                    return (
                        getProviderPublicId(
                            provider
                        ) ===
                        normalized
                    );
                }
            ) ||
            null
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

        const supabase =
            getSupabase();

        await getSession();

        const normalizedProviderId =
            normalizeProviderId(
                providerId
            );

        const cleanProviderName =
            String(
                providerName || ""
            ).trim();

        const cleanDescription =
            String(
                description || ""
            ).trim();

        const cleanStatus =
            normalizeStatus(
                status
            );

        if (
            !normalizedProviderId
        ) {
            throw new Error(
                "Provider ID wajib diisi."
            );
        }

        if (
            !/^[a-zA-Z0-9._-]+$/.test(
                normalizedProviderId
            )
        ) {
            throw new Error(
                "Provider ID tidak valid."
            );
        }

        if (
            !cleanProviderName
        ) {
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

        const {
            data,
            error
        } =
            await supabase.rpc(
                "admin_create_provider",
                {
                    p_provider_id:
                        normalizedProviderId,

                    p_provider_name:
                        cleanProviderName,

                    p_description:
                        cleanDescription ||
                        null,

                    p_status:
                        cleanStatus,

                    p_is_default:
                        Boolean(
                            isDefault
                        )
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

        const supabase =
            getSupabase();

        await getSession();

        const provider =
            getProviderById(
                providerId
            );

        if (!provider) {
            throw new Error(
                "Provider tidak ditemukan."
            );
        }

        const databaseId =
            getProviderId(
                provider
            );

        const cleanProviderId =
            getProviderPublicId(
                provider
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

        if (
            !cleanProviderName
        ) {
            throw new Error(
                "Nama provider wajib diisi."
            );
        }

        if (!databaseId) {
            throw new Error(
                "ID database provider tidak ditemukan."
            );
        }

        if (!cleanProviderId) {
            throw new Error(
                "Provider ID tidak ditemukan."
            );
        }

        const {
            data,
            error
        } =
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
                        cleanDescription ||
                        null,

                    p_status:
                        cleanStatus,

                    p_is_default:
                        Boolean(
                            isDefault
                        )
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
    // TOGGLE
    // ----------------------------------------------------------

    async function toggleProvider(
        providerId
    ) {

        const provider =
            getProviderById(
                providerId
            );

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
    // ACTIVATE
    // ----------------------------------------------------------

    async function activateProvider(
        providerId
    ) {

        const provider =
            getProviderById(
                providerId
            );

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

                status:
                    "active",

                isDefault:
                    Boolean(
                        provider.is_default
                    )
            }
        );
    }

    // ----------------------------------------------------------
    // DEACTIVATE
    // ----------------------------------------------------------

    async function deactivateProvider(
        providerId
    ) {

        const provider =
            getProviderById(
                providerId
            );

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

                status:
                    "inactive",

                isDefault:
                    Boolean(
                        provider.is_default
                    )
            }
        );
    }

    // ----------------------------------------------------------
    // DELETE
    // ----------------------------------------------------------

    async function deleteProvider(
        providerId
    ) {

        const supabase =
            getSupabase();

        await getSession();

        const provider =
            getProviderById(
                providerId
            );

        if (!provider) {
            throw new Error(
                "Provider tidak ditemukan."
            );
        }

        const databaseId =
            getProviderId(
                provider
            );

        if (!databaseId) {
            throw new Error(
                "ID database provider tidak ditemukan."
            );
        }

        // ======================================================
        // HAPUS CREDENTIAL TERLEBIH DAHULU
        // ======================================================
        //
        // Credential menggunakan provider_id seperti:
        // "bytedance"
        //
        // Provider utama menggunakan UUID database.
        //
        // Backend/RPC delete provider seharusnya menangani
        // relasi credential. Kita tetap panggil RPC utama.
        // ======================================================

        const {
            data,
            error
        } =
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

        return getProviders(
            options
        );
    }

    // ----------------------------------------------------------
    // STATISTICS
    // ----------------------------------------------------------

    function getProviderStats() {

        const providers =
            Array.isArray(
                providersCache
            )
                ? providersCache
                : [];

        const total =
            providers.length;

        const active =
            providers.filter(
                function (
                    provider
                ) {
                    return (
                        normalizeStatus(
                            provider.status
                        ) ===
                        "active"
                    );
                }
            ).length;

        const inactive =
            total - active;

        const defaults =
            providers.filter(
                function (
                    provider
                ) {
                    return Boolean(
                        provider.is_default
                    );
                }
            ).length;

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

        getSession,

        getProviders,

        getProviderById,

        getProviderByProviderId,

        normalizeProviderId,

        normalizeStatus,

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
