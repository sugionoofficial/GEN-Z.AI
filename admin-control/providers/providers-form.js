(function () {
    "use strict";

    // =========================================================
    // GEN-Z.AI - PROVIDER FORM
    // CREATE + EDIT
    // SUPABASE API KEY PERSISTENCE
    // =========================================================

    let editingProviderId = null;
    let initialized = false;
    let saving = false;

    // ---------------------------------------------------------
    // HELPERS
    // ---------------------------------------------------------

    function getElement(id) {
        return document.getElementById(id);
    }

    function getData() {
        if (!window.GENZProvidersData) {
            throw new Error(
                "GENZProvidersData belum dimuat."
            );
        }

        return window.GENZProvidersData;
    }

    // ---------------------------------------------------------
    // SUPABASE CLIENT
    // ---------------------------------------------------------

    function getSupabaseClient() {
        if (
            window.GENZProvidersData &&
            typeof window.GENZProvidersData.getSupabase ===
                "function"
        ) {
            const client =
                window.GENZProvidersData.getSupabase();

            if (client) {
                return client;
            }
        }

        if (window.supabaseClient) {
            return window.supabaseClient;
        }

        if (
            window.supabase &&
            typeof window.supabase.createClient ===
                "function" &&
            window.GENZ_CONFIG &&
            GENZ_CONFIG.SUPABASE_URL &&
            GENZ_CONFIG.SUPABASE_KEY
        ) {
            return window.supabase.createClient(
                GENZ_CONFIG.SUPABASE_URL,
                GENZ_CONFIG.SUPABASE_KEY
            );
        }

        throw new Error(
            "Supabase client belum tersedia."
        );
    }

    // ---------------------------------------------------------
    // GET CURRENT SUPABASE SESSION
    // ---------------------------------------------------------

    async function getCurrentSession() {
        const supabase =
            getSupabaseClient();

        const result =
            await supabase.auth.getSession();

        if (
            result &&
            result.error
        ) {
            throw new Error(
                "Gagal membaca session Supabase: " +
                result.error.message
            );
        }

        const session =
            result &&
            result.data
                ? result.data.session
                : null;

        if (
            !session ||
            !session.access_token
        ) {
            throw new Error(
                "Session Supabase tidak ditemukan. Silakan login kembali."
            );
        }

        return session;
    }

    // ---------------------------------------------------------
    // FORM VALUE
    // ---------------------------------------------------------

    function value(id) {
        const element =
            getElement(id);

        return element
            ? String(
                element.value || ""
            ).trim()
            : "";
    }

    function setValue(
        id,
        newValue
    ) {
        const element =
            getElement(id);

        if (element) {
            element.value =
                newValue ?? "";
        }
    }

    // ---------------------------------------------------------
    // FORM VALUES
    // ---------------------------------------------------------

    function getFormValues() {
        return {
            providerName:
                value("providerName"),

            providerId:
                value("providerId"),

            providerStatus:
                value("providerStatus") ||
                "active",

            providerDescription:
                value(
                    "providerDescription"
                ),

            providerNotes:
                value("providerNotes"),

            providerApiKey:
                value("providerApiKey")
        };
    }

    // ---------------------------------------------------------
    // VALIDATION
    // ---------------------------------------------------------

    function validateForm(
        values
    ) {
        if (!values.providerName) {
            throw new Error(
                "Nama provider wajib diisi."
            );
        }

        if (!values.providerId) {
            throw new Error(
                "Provider ID wajib diisi."
            );
        }

        if (
            !/^[a-zA-Z0-9._-]+$/.test(
                values.providerId
            )
        ) {
            throw new Error(
                "Provider ID hanya boleh menggunakan huruf, angka, titik, underscore, dan tanda minus."
            );
        }

        return true;
    }

    // =========================================================
    // SAVE PROVIDER
    // =========================================================

    async function saveProvider(
        event
    ) {
        if (event) {
            event.preventDefault();
        }

        if (saving) {
            return;
        }

        saving = true;

        try {
            const data =
                getData();

            const values =
                getFormValues();

            validateForm(
                values
            );

            // =================================================
            // EDIT MODE
            // =================================================

            if (editingProviderId) {
                const provider =
                    data.getProviderById(
                        editingProviderId
                    );

                if (!provider) {
                    throw new Error(
                        "Provider yang akan diedit tidak ditemukan."
                    );
                }

                await data.updateProvider(
                    editingProviderId,
                    {
                        providerName:
                            values.providerName,

                        description:
                            values.providerDescription,

                        status:
                            values.providerStatus,

                        isDefault:
                            Boolean(
                                provider.is_default
                            )
                    }
                );

                // =================================================
                // API KEY BARU
                // =================================================
                // PENTING:
                // Kirim provider.provider_id
                // BUKAN provider.id / UUID database.

                if (
                    values.providerApiKey
                ) {
                    await saveApiKey(
                        provider.provider_id,
                        values.providerApiKey
                    );
                }

                showMessage(
                    "Provider berhasil diperbarui."
                );

            // =================================================
            // CREATE MODE
            // =================================================

            } else {
                const normalizedId =
                    data.normalizeProviderId(
                        values.providerId
                    );

                if (
                    data.providerIdExists(
                        normalizedId
                    )
                ) {
                    throw new Error(
                        "Provider ID sudah digunakan."
                    );
                }

                const result =
                    await data.createProvider(
                        {
                            providerId:
                                normalizedId,

                            providerName:
                                values.providerName,

                            description:
                                values.providerDescription,

                            status:
                                values.providerStatus,

                            isDefault:
                                false
                        }
                    );

                // Refresh data setelah provider dibuat.
                await data.loadProviders();

                let createdProvider =
                    null;

                if (
                    typeof data.getProviders ===
                    "function"
                ) {
                    createdProvider =
                        data
                            .getProviders()
                            .find(
                                function (
                                    provider
                                ) {
                                    return (
                                        data.normalizeProviderId(
                                            provider.provider_id
                                        ) ===
                                        normalizedId
                                    );
                                }
                            );
                }

                // Fallback jika RPC mengembalikan object.
                if (
                    !createdProvider &&
                    result &&
                    typeof result ===
                        "object"
                ) {
                    createdProvider =
                        result;
                }

                // =================================================
                // SIMPAN API KEY
                // =================================================
                // PENTING:
                // Gunakan provider_id seperti "bytedance",
                // bukan UUID database.

                if (
                    values.providerApiKey &&
                    createdProvider &&
                    createdProvider.provider_id
                ) {
                    await saveApiKey(
                        createdProvider.provider_id,
                        values.providerApiKey
                    );
                }

                showMessage(
                    "Provider berhasil ditambahkan."
                );
            }

            resetForm();

            // -------------------------------------------------
            // CLOSE MODAL
            // -------------------------------------------------

            if (
                window.GENZProvidersInit &&
                typeof window
                    .GENZProvidersInit
                    .closeProviderModal ===
                    "function"
            ) {
                window.GENZProvidersInit
                    .closeProviderModal();
            }

            // -------------------------------------------------
            // REFRESH PROVIDER LIST
            // -------------------------------------------------

            if (
                window.GENZProvidersInit &&
                typeof window
                    .GENZProvidersInit
                    .loadProviders ===
                    "function"
            ) {
                await window.GENZProvidersInit
                    .loadProviders();
            }

        } catch (error) {
            console.error(
                "[GEN-Z.AI] Save provider:",
                error
            );

            showMessage(
                error.message ||
                "Gagal menyimpan provider.",
                "error"
            );

        } finally {
            saving = false;
        }
    }

    // =========================================================
    // SAVE API KEY
    // =========================================================

    async function saveApiKey(
        providerId,
        apiKey
    ) {
        const key =
            String(
                apiKey || ""
            ).trim();

        if (!key) {
            return null;
        }

        // =====================================================
        // NORMALISASI PROVIDER ID
        // =====================================================

        const normalizedProviderId =
            String(
                providerId || ""
            )
                .trim()
                .toLowerCase();

        if (!normalizedProviderId) {
            throw new Error(
                "Provider ID untuk API key tidak ditemukan."
            );
        }

        try {
            // -------------------------------------------------
            // AMBIL SESSION SUPABASE
            // -------------------------------------------------

            const session =
                await getCurrentSession();

            // -------------------------------------------------
            // KIRIM API KEY KE BACKEND
            // -------------------------------------------------

            const response =
                await fetch(
                    "/api/admin-provider-credentials",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json",

                            "Authorization":
                                "Bearer " +
                                session.access_token
                        },

                        body:
                            JSON.stringify(
                                {
                                    provider_id:
                                        normalizedProviderId,

                                    api_key:
                                        key
                                }
                            )
                    }
                );

            const result =
                await response
                    .json()
                    .catch(
                        function () {
                            return {};
                        }
                    );

            if (!response.ok) {
                throw new Error(
                    result.error ||
                    "Gagal menyimpan API key."
                );
            }

            if (
                result &&
                result.success === false
            ) {
                throw new Error(
                    result.error ||
                    "Gagal menyimpan API key."
                );
            }

            console.log(
                "[GEN-Z.AI] API key berhasil disimpan ke Supabase.",
                {
                    provider_id:
                        normalizedProviderId
                }
            );

            return result;

        } catch (error) {
            console.error(
                "[GEN-Z.AI] API key:",
                error
            );

            throw error;
        }
    }

    // =========================================================
    // EDIT PROVIDER
    // =========================================================

    function editProvider(
        provider
    ) {
        if (!provider) {
            throw new Error(
                "Provider tidak ditemukan."
            );
        }

        editingProviderId =
            provider.id ||
            provider.uuid ||
            null;

        if (!editingProviderId) {
            throw new Error(
                "ID database provider tidak ditemukan."
            );
        }

        setValue(
            "providerName",
            provider.provider_name
        );

        setValue(
            "providerId",
            provider.provider_id
        );

        setValue(
            "providerDescription",
            provider.description ||
            ""
        );

        setValue(
            "providerStatus",
            provider.status ||
            "active"
        );

        setValue(
            "providerNotes",
            provider.notes ||
            ""
        );

        // =====================================================
        // KEAMANAN API KEY
        // =====================================================
        // API key lama TIDAK pernah ditampilkan.

        setValue(
            "providerApiKey",
            ""
        );

        // Provider ID tidak boleh berubah ketika edit.
        const providerIdInput =
            getElement(
                "providerId"
            );

        if (providerIdInput) {
            providerIdInput.readOnly =
                true;

            providerIdInput.style.opacity =
                "0.65";
        }

        updateFormMode(
            true
        );
    }

    // =========================================================
    // CREATE MODE
    // =========================================================

    function startCreateMode() {
        editingProviderId =
            null;

        resetForm();

        const providerIdInput =
            getElement(
                "providerId"
            );

        if (providerIdInput) {
            providerIdInput.readOnly =
                false;

            providerIdInput.style.opacity =
                "1";
        }

        updateFormMode(
            false
        );
    }

    // =========================================================
    // FORM MODE
    // =========================================================

    function updateFormMode(
        editing
    ) {
        const title =
            document.querySelector(
                "#providerModal h2, " +
                "#providerModal h3, " +
                ".provider-modal h2, " +
                ".provider-modal h3"
            );

        if (title) {
            title.textContent =
                editing
                    ? "Edit Provider"
                    : "Tambah Provider";
        }

        const submit =
            document.querySelector(
                "#providerModal button[type='submit'], " +
                ".provider-modal button[type='submit']"
            );

        if (submit) {
            submit.textContent =
                editing
                    ? "Simpan Perubahan"
                    : "Simpan Provider";
        }
    }

    // =========================================================
    // RESET FORM
    // =========================================================

    function resetForm() {
        editingProviderId =
            null;

        const form =
            getElement(
                "providerForm"
            );

        if (form) {
            form.reset();
        }

        setValue(
            "providerStatus",
            "active"
        );

        // Jangan pernah mempertahankan API key.
        setValue(
            "providerApiKey",
            ""
        );

        const providerIdInput =
            getElement(
                "providerId"
            );

        if (providerIdInput) {
            providerIdInput.readOnly =
                false;

            providerIdInput.style.opacity =
                "1";
        }

        updateFormMode(
            false
        );
    }

    // =========================================================
    // API KEY VISIBILITY
    // =========================================================

    function toggleApiKey() {
        const input =
            getElement(
                "providerApiKey"
            );

        if (!input) {
            return;
        }

        input.type =
            input.type ===
            "password"
                ? "text"
                : "password";
    }

    // =========================================================
    // MESSAGE
    // =========================================================

    function showMessage(
        message,
        type = "success"
    ) {
        if (
            window.GENZProvidersInit &&
            typeof window
                .GENZProvidersInit
                .showMessage ===
                "function"
        ) {
            window.GENZProvidersInit
                .showMessage(
                    message,
                    type
                );

            return;
        }

        console.log(
            `[GEN-Z.AI][${type}]`,
            message
        );

        if (
            type === "error"
        ) {
            alert(
                "Error: " +
                message
            );
        }
    }

    // =========================================================
    // FORM INIT
    // =========================================================

    function initForm() {
        if (initialized) {
            return;
        }

        const form =
            getElement(
                "providerForm"
            );

        if (form) {
            form.addEventListener(
                "submit",
                saveProvider
            );
        }

        const apiKeyToggle =
            document.querySelector(
                "[data-action='toggle-api-key'], " +
                "#toggleApiKey"
            );

        if (apiKeyToggle) {
            apiKeyToggle.addEventListener(
                "click",
                function (
                    event
                ) {
                    event.preventDefault();

                    toggleApiKey();
                }
            );
        }

        initialized = true;
    }

    // =========================================================
    // PUBLIC API
    // =========================================================

    window.GENZProvidersForm = {
        initForm,

        getFormValues,

        validateForm,

        saveProvider,

        editProvider,

        startCreateMode,

        resetForm,

        toggleApiKey,

        openForm:
            function (
                provider
            ) {
                if (provider) {
                    editProvider(
                        provider
                    );
                } else {
                    startCreateMode();
                }
            },

        isEditing:
            function () {
                return Boolean(
                    editingProviderId
                );
            },

        getEditingProviderId:
            function () {
                return editingProviderId;
            }
    };

    // =========================================================
    // AUTO INIT
    // =========================================================

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            initForm
        );
    } else {
        initForm();
    }

})();
