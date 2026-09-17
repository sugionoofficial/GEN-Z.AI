(function () {
    "use strict";

    // =========================================================
    // GEN-Z.AI - PROVIDER FORM
    // CREATE + EDIT
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

    function value(id) {
        const element = getElement(id);

        return element
            ? String(element.value || "").trim()
            : "";
    }

    function setValue(id, value) {
        const element = getElement(id);

        if (element) {
            element.value = value ?? "";
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

    function validateForm(values) {
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

    // ---------------------------------------------------------
    // SAVE PROVIDER
    // ---------------------------------------------------------

    async function saveProvider(event) {
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

            validateForm(values);

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

                // API key hanya dikirim
                // jika user benar-benar
                // mengisi API key baru.
                if (
                    values.providerApiKey
                ) {
                    await saveApiKey(
                        editingProviderId,
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

                // Ambil provider baru
                // setelah create.
                await data.loadProviders();

                let createdProvider =
                    data.getProviders
                        ? data.getProviders()
                            .find(function (
                                provider
                            ) {
                                return (
                                    data.normalizeProviderId(
                                        provider.provider_id
                                    ) ===
                                    normalizedId
                                );
                            })
                        : null;

                // Fallback jika RPC
                // mengembalikan object.
                if (
                    !createdProvider &&
                    result &&
                    typeof result ===
                        "object"
                ) {
                    createdProvider =
                        result;
                }

                if (
                    values.providerApiKey &&
                    createdProvider
                ) {
                    const createdId =
                        createdProvider.id ||
                        createdProvider.uuid;

                    if (createdId) {
                        await saveApiKey(
                            createdId,
                            values.providerApiKey
                        );
                    }
                }

                showMessage(
                    "Provider berhasil ditambahkan."
                );
            }

            resetForm();

            // Tutup modal melalui
            // initializer jika tersedia.
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

            // Refresh list.
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

    // ---------------------------------------------------------
    // SAVE API KEY
    // ---------------------------------------------------------

    async function saveApiKey(
        providerId,
        apiKey
    ) {
        const key =
            String(apiKey || "").trim();

        if (!key) {
            return null;
        }

        try {
            const response =
                await fetch(
                    "/api/admin-provider-credentials",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({
                            provider_id:
                                providerId,

                            api_key:
                                key
                        })
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

            return result;

        } catch (error) {
            console.error(
                "[GEN-Z.AI] API key:",
                error
            );

            throw error;
        }
    }

    // ---------------------------------------------------------
    // EDIT PROVIDER
    // ---------------------------------------------------------

    function editProvider(provider) {
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
            provider.description || ""
        );

        setValue(
            "providerStatus",
            provider.status ||
            "active"
        );

        setValue(
            "providerNotes",
            provider.notes || ""
        );

        // API key sengaja dikosongkan.
        // Jangan pernah menampilkan
        // API key lama ke halaman.
        setValue(
            "providerApiKey",
            ""
        );

        // Provider ID tidak boleh
        // berubah saat edit.
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

        updateFormMode(true);
    }

    // ---------------------------------------------------------
    // CREATE MODE
    // ---------------------------------------------------------

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

        updateFormMode(false);
    }

    // ---------------------------------------------------------
    // FORM MODE
    // ---------------------------------------------------------

    function updateFormMode(editing) {
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

    // ---------------------------------------------------------
    // RESET
    // ---------------------------------------------------------

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

        updateFormMode(false);
    }

    // ---------------------------------------------------------
    // API KEY VISIBILITY
    // ---------------------------------------------------------

    function toggleApiKey() {
        const input =
            getElement(
                "providerApiKey"
            );

        if (!input) {
            return;
        }

        input.type =
            input.type === "password"
                ? "text"
                : "password";
    }

    // ---------------------------------------------------------
    // MESSAGE
    // ---------------------------------------------------------

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

    // ---------------------------------------------------------
    // FORM INIT
    // ---------------------------------------------------------

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
                function (event) {
                    event.preventDefault();

                    toggleApiKey();
                }
            );
        }

        initialized = true;
    }

    // ---------------------------------------------------------
    // PUBLIC API
    // ---------------------------------------------------------

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
            function (provider) {
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

    // ---------------------------------------------------------
    // AUTO INIT
    // ---------------------------------------------------------

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
