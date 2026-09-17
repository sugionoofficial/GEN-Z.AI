(function () {
    "use strict";

    function getElement(id) {
        return document.getElementById(id);
    }

    function getFormValues() {
        const providerName =
            getElement("providerName");

        const providerId =
            getElement("providerId");

        const providerStatus =
            getElement("providerStatus");

        const providerDescription =
            getElement("providerDescription");

        const providerNotes =
            getElement("providerNotes");

        const providerApiKey =
    getElement("providerApiKey");

        return {
            name:
                providerName
                    ? providerName.value.trim()
                    : "",

            rawId:
                providerId
                    ? providerId.value.trim()
                    : "",

            status:
                providerStatus
                    ? providerStatus.value
                        .trim()
                        .toLowerCase()
                    : "active",

            description:
                providerDescription
                    ? providerDescription.value.trim()
                    : "",

            notes:
    providerNotes
        ? providerNotes.value.trim()
        : "",

apiKey:
    providerApiKey
        ? providerApiKey.value.trim()
        : ""
        };
    }

    function setSubmitState(disabled, text) {
        const button =
            document.querySelector(
                "#providerForm .button-primary"
            );

        if (!button) {
            return;
        }

        if (
            typeof button.dataset.originalText ===
            "undefined"
        ) {
            button.dataset.originalText =
                button.textContent.trim();
        }

        button.disabled = Boolean(disabled);

        if (text) {
            button.textContent = text;
        } else {
            button.textContent =
                button.dataset.originalText ||
                "Simpan Provider";
        }
    }

    function validateForm(values) {
        const providerData =
            window.GENZProvidersData;

        if (!providerData) {
            return {
                valid: false,
                message:
                    "Module provider belum dimuat."
            };
        }

        const providerId =
            providerData.normalizeProviderId(
                values.rawId
            );

        if (!values.name) {
            return {
                valid: false,
                message:
                    "Nama provider wajib diisi."
            };
        }

        if (!providerId) {
            return {
                valid: false,
                message:
                    "Provider ID wajib diisi."
            };
        }

        const allowedStatuses = [
            "active",
            "inactive",
            "maintenance"
        ];

        if (
            !allowedStatuses.includes(
                values.status
            )
        ) {
            return {
                valid: false,
                message:
                    "Status provider tidak valid."
            };
        }

        return {
            valid: true,
            providerId
        };
    }

    function showFormMessage(message) {
        if (
            typeof window.showMessage ===
            "function"
        ) {
            window.showMessage(message);
            return;
        }

        console.error(message);
    }

    async function saveProvider(event) {
        event.preventDefault();

        const providerData =
            window.GENZProvidersData;

        if (!providerData) {
            showFormMessage(
                "Module provider belum dimuat."
            );

            return;
        }

        const supabaseClient =
            providerData.getSupabase();

        if (!supabaseClient) {
            showFormMessage(
                "Supabase belum terhubung."
            );

            return;
        }

        const values =
            getFormValues();

        const validation =
            validateForm(values);

        if (!validation.valid) {
            showFormMessage(
                validation.message
            );

            return;
        }

        const providerId =
            validation.providerId;

        /*
         * API key tidak diproses di module ini.
         *
         * API key provider tidak boleh dikirim
         * ke tabel public.providers.
         *
         * Penyimpanan credential akan ditangani
         * melalui mekanisme server-side tersendiri.
         */

        setSubmitState(
            true,
            "Menyimpan..."
        );

        try {
            const exists =
                await providerData.providerIdExists(
                    providerId
                );

            if (exists) {
                showFormMessage(
                    `Provider ID "${providerId}" sudah terdaftar.`
                );

                return;
            }

            await providerData.createProvider({
                providerId,
                providerName:
                    values.name,
                description:
                    values.description,
                status:
                    values.status,
                isDefault:
                    false
            });

            console.log(
                "Provider berhasil disimpan:",
                providerId
            );

            showFormMessage(
                `Provider "${values.name}" berhasil ditambahkan.`
            );

            if (
                typeof window.closeProviderModal ===
                "function"
            ) {
                window.closeProviderModal();
            }

            if (
                typeof window.loadProviders ===
                "function"
            ) {
                await window.loadProviders();
            }

        } catch (error) {
            console.error(
                "Gagal menyimpan provider:",
                error
            );

            let message =
                "Gagal menyimpan provider.";

            if (
                error?.code ===
                "23505"
            ) {
                message =
                    "Provider ID sudah digunakan.";
            } else if (
                error?.code ===
                "PROVIDER_EXISTS"
            ) {
                message =
                    error.message;
            } else if (
                error?.message
            ) {
                message =
                    error.message;
            }

            showFormMessage(message);

        } finally {
            setSubmitState(
                false
            );
        }
    }

    function toggleApiKey() {
        const input =
            getElement(
                "providerApiKey"
            );

        const eye =
            getElement(
                "apiEye"
            );

        if (!input || !eye) {
            return;
        }

        if (
            input.type ===
            "password"
        ) {
            input.type =
                "text";

            eye.innerHTML = `
                <path d="M3 3l18 18"></path>
                <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"></path>
                <path d="M9.9 4.3A10.6 10.6 0 0 1 12 4c6.5 0 10 8 10 8a18.5 18.5 0 0 1-3.1 4.5"></path>
                <path d="M6.6 6.6C3.7 8.5 2 12 2 12s3.5 8 10 8c1.5 0 2.9-.4 4.1-1"></path>
            `;

            return;
        }

        input.type =
            "password";

        eye.innerHTML = `
            <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"></path>
            <circle
                cx="12"
                cy="12"
                r="2.5"
            ></circle>
        `;
    }

    function resetForm() {
        const form =
            getElement(
                "providerForm"
            );

        if (form) {
            form.reset();
        }

        const apiKey =
            getElement(
                "providerApiKey"
            );

        if (apiKey) {
            apiKey.type =
                "password";
        }

        const eye =
            getElement(
                "apiEye"
            );

        if (eye) {
            eye.innerHTML = `
                <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"></path>
                <circle
                    cx="12"
                    cy="12"
                    r="2.5"
                ></circle>
            `;
        }

        setSubmitState(
            false
        );
    }

    function initForm() {
        const form =
            getElement(
                "providerForm"
            );

        if (!form) {
            return;
        }

        form.addEventListener(
            "submit",
            saveProvider
        );

        /*
         * Hapus inline onsubmit agar event
         * tidak dipasang dua kali ketika nanti
         * providers.html sudah dimodularisasi.
         */
        form.removeAttribute(
            "onsubmit"
        );
    }

    window.GENZProvidersForm =
        Object.freeze({
            initForm,
            getFormValues,
            validateForm,
            saveProvider,
            toggleApiKey,
            resetForm
        });

    /*
     * Compatibility layer.
     *
     * providers.html lama masih menggunakan
     * fungsi global. Fungsi ini akan tetap tersedia
     * sampai HTML utama selesai dipindahkan
     * ke sistem loader/module baru.
     */

    window.saveProvider =
        saveProvider;

    window.toggleApiKey =
        toggleApiKey;

    window.resetProviderForm =
        resetForm;

})();
