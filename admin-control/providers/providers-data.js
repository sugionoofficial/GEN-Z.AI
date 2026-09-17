(function () {
    "use strict";

    let supabaseClient = null;
    let providers = [];

    function initSupabase() {
        try {
            if (
                typeof supabase === "undefined" ||
                !window.GENZ_CONFIG
            ) {
                console.error(
                    "Supabase library atau GENZ_CONFIG tidak tersedia."
                );

                return false;
            }

            supabaseClient = supabase.createClient(
                GENZ_CONFIG.SUPABASE_URL,
                GENZ_CONFIG.SUPABASE_KEY
            );

            return true;
        } catch (error) {
            console.error(
                "Gagal menginisialisasi Supabase:",
                error
            );

            return false;
        }
    }

    function getSupabase() {
        return supabaseClient;
    }

    function getProviders() {
        return Array.isArray(providers)
            ? [...providers]
            : [];
    }

    function getProviderById(providerId) {
        const normalizedId = String(providerId || "")
            .trim()
            .toLowerCase();

        return providers.find(
            provider =>
                String(provider.provider_id || "")
                    .trim()
                    .toLowerCase() === normalizedId
        ) || null;
    }

    function normalizeProviderId(value) {
        return String(value || "")
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9_-]/g, "");
    }

    async function providerIdExists(providerId) {
        if (!supabaseClient) {
            throw new Error(
                "Supabase belum diinisialisasi."
            );
        }

        const normalizedId =
            normalizeProviderId(providerId);

        if (!normalizedId) {
            return false;
        }

        const {
            data,
            error
        } = await supabaseClient
            .from("providers")
            .select("id, provider_id")
            .eq("provider_id", normalizedId)
            .maybeSingle();

        if (error) {
            throw error;
        }

        return Boolean(data);
    }

    async function createProvider({
        providerId,
        providerName,
        description,
        status = "active",
        isDefault = false
    }) {
        if (!supabaseClient) {
            throw new Error(
                "Supabase belum diinisialisasi."
            );
        }

        const normalizedId =
            normalizeProviderId(providerId);

        const name =
            String(providerName || "").trim();

        const providerDescription =
            String(description || "").trim();

        const normalizedStatus =
            String(status || "active")
                .trim()
                .toLowerCase();

        if (!normalizedId) {
            throw new Error(
                "Provider ID wajib diisi."
            );
        }

        if (!name) {
            throw new Error(
                "Nama provider wajib diisi."
            );
        }

        const allowedStatuses = [
            "active",
            "inactive",
            "maintenance"
        ];

        if (!allowedStatuses.includes(normalizedStatus)) {
            throw new Error(
                "Status provider tidak valid."
            );
        }

        const exists =
            await providerIdExists(normalizedId);

        if (exists) {
            const error =
                new Error(
                    `Provider ID "${normalizedId}" sudah terdaftar.`
                );

            error.code = "PROVIDER_EXISTS";

            throw error;
        }

        /*
         * Jangan menggunakan:
         *
         * supabaseClient
         *     .from("providers")
         *     .insert(...)
         *
         * karena tabel providers dilindungi RLS.
         *
         * Provider dibuat melalui SECURITY DEFINER RPC:
         * admin_create_provider(...)
         */

        const {
            data,
            error
        } = await supabaseClient.rpc(
            "admin_create_provider",
            {
                p_provider_id:
                    normalizedId,

                p_provider_name:
                    name,

                p_description:
                    providerDescription || null,

                p_status:
                    normalizedStatus,

                p_is_default:
                    Boolean(isDefault)
            }
        );

        if (error) {
            throw error;
        }

        return data;
    }

    async function loadProviders() {
        if (!supabaseClient) {
            throw new Error(
                "Supabase belum diinisialisasi."
            );
        }

        const {
            data,
            error
        } = await supabaseClient
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
                ].join(", ")
            )
            .order(
                "created_at",
                {
                    ascending: false
                }
            );

        if (error) {
            throw error;
        }

        providers =
            Array.isArray(data)
                ? data
                : [];

        return getProviders();
    }

    function getProviderStats() {
        const total =
            providers.length;

        const active =
            providers.filter(
                provider =>
                    String(provider.status || "")
                        .toLowerCase() === "active"
            ).length;

        const inactive =
            providers.filter(
                provider =>
                    String(provider.status || "")
                        .toLowerCase() === "inactive"
            ).length;

        const maintenance =
            providers.filter(
                provider =>
                    String(provider.status || "")
                        .toLowerCase() === "maintenance"
            ).length;

        return {
            total,
            active,
            inactive,
            maintenance
        };
    }

    function clearProviders() {
        providers = [];
    }

    window.GENZProvidersData =
        Object.freeze({
            initSupabase,
            getSupabase,
            getProviders,
            getProviderById,
            normalizeProviderId,
            providerIdExists,
            createProvider,
            loadProviders,
            getProviderStats,
            clearProviders
        });
})();
