// ========================================
// GEN-Z.AI
// PROVIDERS - API KEY MODULE
// File: admin-control/providers/api-key.js
// ========================================

(function () {
    "use strict";

    // Jangan inisialisasi dua kali
    if (window.GENZProviderApiKey) {
        return;
    }

    const API_ENDPOINT =
        "/api/admin-provider-credentials";

    // ========================================
    // INTERNAL HELPER
    // ========================================

    function getSupabaseModule() {
        const module =
            window.GENZProviderSupabase;

        if (!module || !module.ready) {
            throw new Error(
                module?.error ||
                "Modul Supabase belum siap."
            );
        }

        return module;
    }

    // ========================================
    // VALIDASI PROVIDER ID
    // ========================================

    function normalizeProviderId(providerId) {
        return String(
            providerId || ""
        )
            .trim()
            .toLowerCase();
    }

    function validateProviderId(providerId) {
        const value =
            normalizeProviderId(providerId);

        if (!value) {
            throw new Error(
                "Provider ID wajib diisi."
            );
        }

        if (
            !/^[a-z0-9_-]+$/.test(value)
        ) {
            throw new Error(
                "Provider ID tidak valid."
            );
        }

        return value;
    }

    // ========================================
    // VALIDASI API KEY
    // ========================================

    function validateApiKey(apiKey) {
        const value =
            String(apiKey || "").trim();

        if (!value) {
            throw new Error(
                "API Key wajib diisi."
            );
        }

        return value;
    }

    // ========================================
    // SAVE API KEY
    // ========================================

    async function save(providerId, apiKey) {

        const normalizedProviderId =
            validateProviderId(
                providerId
            );

        const normalizedApiKey =
            validateApiKey(
                apiKey
            );

        const supabaseModule =
            getSupabaseModule();

        // Ambil session aktif
        const session =
            await supabaseModule.requireSession();

        if (
            !session ||
            !session.access_token
        ) {
            throw new Error(
                "Session login tidak ditemukan."
            );
        }

        // ====================================
        // REQUEST KE BACKEND
        // ====================================

        let response;

        try {

            response = await fetch(
                API_ENDPOINT,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",

                        Authorization:
                            `Bearer ${session.access_token}`
                    },

                    body:
                        JSON.stringify({
                            provider_id:
                                normalizedProviderId,

                            api_key:
                                normalizedApiKey
                        })
                }
            );

        } catch (error) {

            console.error(
                "[GEN-Z.AI] API Key network error:",
                error
            );

            throw new Error(
                "Tidak dapat terhubung ke server."
            );
        }

        // ====================================
        // BACA RESPONSE
        // ====================================

        let data = null;

        try {
            data = await response.json();
        } catch {
            data = null;
        }

        // ====================================
        // ERROR
        // ====================================

        if (!response.ok) {

            const message =
                data?.error ||
                `Gagal menyimpan API Key. HTTP ${response.status}`;

            throw new Error(
                message
            );
        }

        // ====================================
        // VALIDASI RESPONSE
        // ====================================

        if (
            data &&
            data.success === false
        ) {
            throw new Error(
                data.error ||
                "API Key gagal disimpan."
            );
        }

        // ====================================
        // JANGAN PERNAH KEMBALIKAN API KEY
        // ====================================

        return {
            success: true,

            provider_id:
                data?.provider_id ||
                normalizedProviderId,

            saved: true
        };
    }

    // ========================================
    // SAVE OPTIONAL
    // ========================================
    //
    // Digunakan ketika form boleh disimpan
    // tanpa API Key.
    //
    // Jika kosong:
    // tidak melakukan request.
    //
    // ========================================

    async function saveIfProvided(
        providerId,
        apiKey
    ) {

        const value =
            String(
                apiKey || ""
            ).trim();

        if (!value) {
            return {
                success: true,
                skipped: true,
                provider_id:
                    normalizeProviderId(
                        providerId
                    )
            };
        }

        return save(
            providerId,
            value
        );
    }

    // ========================================
    // API KEY STATUS
    // ========================================
    //
    // Backend tidak menyediakan GET API Key.
    // Karena itu modul TIDAK mencoba membaca
    // secret dari server.
    //
    // Status hanya berdasarkan hasil save
    // pada sesi halaman ini.
    //
    // ========================================

    const savedProviders =
        new Set();

    function markSaved(providerId) {

        const id =
            normalizeProviderId(
                providerId
            );

        if (id) {
            savedProviders.add(id);
        }
    }

    function isSaved(providerId) {

        const id =
            normalizeProviderId(
                providerId
            );

        return savedProviders.has(id);
    }

    // ========================================
    // CLEAR LOCAL STATUS
    // ========================================

    function clearStatus(providerId) {

        const id =
            normalizeProviderId(
                providerId
            );

        if (id) {
            savedProviders.delete(id);
        }
    }

    // ========================================
    // PUBLIC MODULE
    // ========================================

    window.GENZProviderApiKey = {

        ready: true,

        save: async function (
            providerId,
            apiKey
        ) {

            const result =
                await save(
                    providerId,
                    apiKey
                );

            markSaved(
                result.provider_id
            );

            return result;
        },

        saveIfProvided:
            async function (
                providerId,
                apiKey
            ) {

                const result =
                    await saveIfProvided(
                        providerId,
                        apiKey
                    );

                if (
                    result.provider_id &&
                    result.saved
                ) {
                    markSaved(
                        result.provider_id
                    );
                }

                return result;
            },

        isSaved,

        markSaved,

        clearStatus
    };

    console.log(
        "[GEN-Z.AI] Provider API Key module siap."
    );

})();
