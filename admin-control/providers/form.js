// ========================================
// GEN-Z.AI
// PROVIDERS - FORM MODULE
// File: admin-control/providers/form.js
// ========================================

(function () {
    "use strict";

    if (window.GENZProviderForm) {
        return;
    }

    let modal = null;
    let form = null;
    let mode = "create";
    let editingProvider = null;
    let eventsBound = false;
    let submitting = false;

    // ========================================
    // MODULE HELPERS
    // ========================================

    function getListModule() {
        const module = window.GENZProviderList;

        if (!module || !module.ready) {
            throw new Error(
                "Modul Provider List belum siap."
            );
        }

        return module;
    }

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

    function getApiKeyModule() {
        const module =
            window.GENZProviderApiKey;

        if (!module || !module.ready) {
            throw new Error(
                "Modul API Key belum siap."
            );
        }

        return module;
    }

    // ========================================
    // NORMALIZE
    // ========================================

    function normalizeProviderId(value) {
        return String(value || "")
            .trim()
            .toLowerCase();
    }

    function normalizeStatus(value) {
        const status =
            String(value || "")
                .trim()
                .toLowerCase();

        if (status === "inactive") {
            return "inactive";
        }

        if (status === "maintenance") {
            return "maintenance";
        }

        return "active";
    }

    // ========================================
    // VALIDATE PROVIDER ID
    // ========================================

    function validateProviderId(value) {
        const providerId =
            normalizeProviderId(value);

        if (!providerId) {
            throw new Error(
                "Provider ID wajib diisi."
            );
        }

        if (
            !/^[a-z0-9_-]+$/.test(
                providerId
            )
        ) {
            throw new Error(
                "Provider ID hanya boleh menggunakan huruf kecil, angka, garis bawah (_) atau tanda hubung (-)."
            );
        }

        if (providerId.length < 2) {
            throw new Error(
                "Provider ID minimal 2 karakter."
            );
        }

        if (providerId.length > 100) {
            throw new Error(
                "Provider ID terlalu panjang."
            );
        }

        return providerId;
    }

    // ========================================
    // VALIDATE NAME
    // ========================================

    function validateProviderName(value) {
        const name =
            String(value || "").trim();

        if (!name) {
            throw new Error(
                "Nama Provider wajib diisi."
            );
        }

        if (name.length > 150) {
            throw new Error(
                "Nama Provider terlalu panjang."
            );
        }

        return name;
    }

    // ========================================
    // VALIDATE DESCRIPTION
    // ========================================

    function normalizeDescription(value) {
        const description =
            String(value || "").trim();

        if (description.length > 1000) {
            throw new Error(
                "Deskripsi terlalu panjang."
            );
        }

        return description || null;
    }

    // ========================================
    // CREATE / FIND MODAL
    // ========================================

    function createModal() {
        /*
         * Modal sudah ada di providers.html.
         * Masalah sebelumnya:
         *
         * jika modal ditemukan, function langsung
         * return sehingga bindEvents() tidak pernah
         * dipanggil.
         *
         * Sekarang event tetap dipasang.
         */

        modal =
            document.getElementById(
                "providerModal"
            );

        if (modal) {
            form =
                modal.querySelector(
                    "#providerForm"
                );

            if (!form) {
                throw new Error(
                    "Form provider (#providerForm) tidak ditemukan."
                );
            }

            bindEvents();

            return modal;
        }

        // ====================================
        // FALLBACK
        // ====================================
        // Jika suatu saat modal tidak ada di HTML,
        // buat modal sederhana secara otomatis.
        // ====================================

        modal =
            document.createElement(
                "div"
            );

        modal.id =
            "providerModal";

        modal.className =
            "modal-backdrop";

        modal.innerHTML = `
            <div class="modal">

                <div class="modal-header">

                    <div>
                        <h2
                            class="modal-title"
                            id="providerFormTitle"
                        >
                            Tambah Provider
                        </h2>

                        <p class="modal-subtitle">
                            Konfigurasi provider AI.
                        </p>
                    </div>

                    <button
                        class="modal-close"
                        type="button"
                        data-provider-form-action="close"
                    >
                        ×
                    </button>

                </div>

                <div class="modal-body">

                    <form
                        id="providerForm"
                        autocomplete="off"
                    >

                        <div class="form-grid">

                            <div class="form-group">

                                <label
                                    class="form-label"
                                    for="providerName"
                                >
                                    Nama Provider
                                </label>

                                <input
                                    class="form-input"
                                    id="providerName"
                                    name="providerName"
                                    type="text"
                                    required
                                >

                            </div>

                            <div class="form-group">

                                <label
                                    class="form-label"
                                    for="providerId"
                                >
                                    Provider ID
                                </label>

                                <input
                                    class="form-input"
                                    id="providerId"
                                    name="providerId"
                                    type="text"
                                    required
                                >

                            </div>

                            <div class="form-group full">

                                <label
                                    class="form-label"
                                    for="providerApiKey"
                                >
                                    API Key
                                </label>

                                <input
                                    class="form-input"
                                    id="providerApiKey"
                                    name="apiKey"
                                    type="password"
                                    autocomplete="new-password"
                                >

                            </div>

                            <div class="form-group">

                                <label
                                    class="form-label"
                                    for="providerStatus"
                                >
                                    Status
                                </label>

                                <select
                                    class="form-select"
                                    id="providerStatus"
                                    name="status"
                                >
                                    <option value="active">
                                        Aktif
                                    </option>

                                    <option value="inactive">
                                        Nonaktif
                                    </option>
                                </select>

                            </div>

                            <div class="form-group">

                                <label
                                    class="form-label"
                                    for="providerDescription"
                                >
                                    Keterangan
                                </label>

                                <input
                                    class="form-input"
                                    id="providerDescription"
                                    name="description"
                                    type="text"
                                >

                            </div>

                            <div class="form-group full">

                                <label
                                    style="
                                        display:flex;
                                        align-items:center;
                                        gap:8px;
                                        cursor:pointer;
                                    "
                                >
                                    <input
                                        id="providerDefault"
                                        name="isDefault"
                                        type="checkbox"
                                    >

                                    Jadikan provider default
                                </label>

                            </div>

                        </div>

                        <div
                            id="providerFormMessage"
                            role="alert"
                            style="
                                display:none;
                                margin-top:15px;
                                padding:11px 13px;
                                border-radius:10px;
                                font-size:12px;
                                line-height:1.5;
                            "
                        ></div>

                        <div class="modal-footer">

                            <button
                                class="button-secondary"
                                type="button"
                                data-provider-form-action="close"
                            >
                                Batal
                            </button>

                            <button
                                class="button-primary"
                                id="providerFormSubmit"
                                type="submit"
                            >
                                Simpan Provider
                            </button>

                        </div>

                    </form>

                </div>

            </div>
        `;

        document.body.appendChild(
            modal
        );

        form =
            modal.querySelector(
                "#providerForm"
            );

        bindEvents();

        return modal;
    }

    // ========================================
    // FORM MESSAGE
    // ========================================

    function showMessage(
        message,
        type = "error"
    ) {
        let element =
            document.getElementById(
                "providerFormMessage"
            );

        /*
         * Jika HTML utama tidak menyediakan
         * message element, buat otomatis.
         */

        if (!element && form) {
            element =
                document.createElement(
                    "div"
                );

            element.id =
                "providerFormMessage";

            element.setAttribute(
                "role",
                "alert"
            );

            element.style.cssText = `
                display:block;
                margin-top:15px;
                padding:11px 13px;
                border-radius:10px;
                font-size:12px;
                line-height:1.5;
            `;

            const footer =
                form.querySelector(
                    ".modal-footer"
                );

            if (footer) {
                footer.parentNode.insertBefore(
                    element,
                    footer
                );
            } else {
                form.appendChild(
                    element
                );
            }
        }

        if (!element) {
            /*
             * Fallback terakhir supaya error tidak
             * hilang begitu saja.
             */
            console.error(
                "[GEN-Z.AI] Provider Form:",
                message
            );

            return;
        }

        element.textContent =
            String(
                message ||
                "Terjadi kesalahan."
            );

        element.style.display =
            "block";

        if (type === "success") {
            element.style.background =
                "rgba(34,197,94,.12)";

            element.style.border =
                "1px solid rgba(34,197,94,.28)";

            element.style.color =
                "#86efac";
        } else {
            element.style.background =
                "rgba(239,68,68,.12)";

            element.style.border =
                "1px solid rgba(239,68,68,.28)";

            element.style.color =
                "#fca5a5";
        }
    }

    function hideMessage() {
        const element =
            document.getElementById(
                "providerFormMessage"
            );

        if (!element) {
            return;
        }

        element.textContent =
            "";

        element.style.display =
            "none";
    }

    // ========================================
    // BUTTON STATE
    // ========================================

    function setSubmitting(
        state
    ) {
        submitting =
            Boolean(state);

        const button =
            document.getElementById(
                "providerFormSubmit"
            );

        if (!button) {
            return;
        }

        if (state) {
            button.disabled =
                true;

            button.dataset.originalText =
                button.textContent;

            button.textContent =
                "Menyimpan...";

            button.style.opacity =
                ".6";

            button.style.cursor =
                "wait";
        } else {
            button.disabled =
                false;

            button.textContent =
                button.dataset.originalText ||
                "Simpan Provider";

            button.style.opacity =
                "1";

            button.style.cursor =
                "pointer";
        }
    }

    // ========================================
    // RESET FORM
    // ========================================

    function resetForm() {
        if (!form) {
            return;
        }

        form.reset();

        const providerId =
            document.getElementById(
                "providerId"
            );

        const providerStatus =
            document.getElementById(
                "providerStatus"
            );

        const apiKey =
            document.getElementById(
                "providerApiKey"
            );

        if (providerId) {
            providerId.disabled =
                false;

            providerId.style.opacity =
                "1";
        }

        if (providerStatus) {
            providerStatus.value =
                "active";
        }

        if (apiKey) {
            apiKey.value =
                "";

            apiKey.type =
                "password";
        }

        hideMessage();
    }

    // ========================================
    // OPEN CREATE
    // ========================================

    function openCreate() {
        createModal();

        mode =
            "create";

        editingProvider =
            null;

        resetForm();

        const title =
            document.getElementById(
                "providerFormTitle"
            );

        if (title) {
            title.textContent =
                "Tambah Provider";
        }

        const submit =
            document.getElementById(
                "providerFormSubmit"
            );

        if (submit) {
            submit.textContent =
                "Simpan Provider";
        }

        const providerId =
            document.getElementById(
                "providerId"
            );

        if (providerId) {
            providerId.disabled =
                false;

            providerId.style.opacity =
                "1";
        }

        const apiKeyHint =
            document.getElementById(
                "providerApiKeyHint"
            );

        if (apiKeyHint) {
            apiKeyHint.textContent =
                "API Key wajib diisi saat menambahkan provider baru.";
        }

        if (modal) {
            modal.classList.add(
                "show"
            );

            modal.style.display =
                "flex";
        }

        setTimeout(
            function () {
                providerId?.focus();
            },
            50
        );
    }

    // ========================================
    // OPEN EDIT
    // ========================================

    function openEdit(
        provider
    ) {
        if (!provider) {
            throw new Error(
                "Provider tidak ditemukan."
            );
        }

        createModal();

        mode =
            "edit";

        editingProvider =
            provider;

        resetForm();

        const providerId =
            document.getElementById(
                "providerId"
            );

        const providerName =
            document.getElementById(
                "providerName"
            );

        const description =
            document.getElementById(
                "providerDescription"
            );

        const status =
            document.getElementById(
                "providerStatus"
            );

        const defaultCheckbox =
            document.getElementById(
                "providerDefault"
            );

        const apiKey =
            document.getElementById(
                "providerApiKey"
            );

        if (providerId) {
            providerId.value =
                provider.provider_id ||
                "";

            providerId.disabled =
                true;

            providerId.style.opacity =
                ".55";
        }

        if (providerName) {
            providerName.value =
                provider.provider_name ||
                "";
        }

        if (description) {
            description.value =
                provider.description ||
                "";
        }

        if (status) {
            status.value =
                normalizeStatus(
                    provider.status
                );
        }

        if (defaultCheckbox) {
            defaultCheckbox.checked =
                Boolean(
                    provider.is_default
                );
        }

        /*
         * Jangan pernah memasukkan API Key lama
         * ke dalam input.
         */
        if (apiKey) {
            apiKey.value =
                "";

            apiKey.type =
                "password";
        }

        const title =
            document.getElementById(
                "providerFormTitle"
            );

        if (title) {
            title.textContent =
                "Edit Provider";
        }

        const submit =
            document.getElementById(
                "providerFormSubmit"
            );

        if (submit) {
            submit.textContent =
                "Simpan Perubahan";
        }

        const apiKeyHint =
            document.getElementById(
                "providerApiKeyHint"
            );

        if (apiKeyHint) {
            apiKeyHint.textContent =
                "Kosongkan jika tidak ingin mengganti API Key yang tersimpan.";
        }

        hideMessage();

        if (modal) {
            modal.classList.add(
                "show"
            );

            modal.style.display =
                "flex";
        }

        setTimeout(
            function () {
                providerName?.focus();
            },
            50
        );
    }

    // ========================================
    // CLOSE
    // ========================================

    function close() {
        if (!modal) {
            modal =
                document.getElementById(
                    "providerModal"
                );
        }

        if (!modal) {
            return;
        }

        if (submitting) {
            return;
        }

        modal.classList.remove(
            "show"
        );

        modal.style.display =
            "none";

        editingProvider =
            null;

        mode =
            "create";

        hideMessage();
    }

    // ========================================
    // CREATE PROVIDER
    // ========================================

    async function createProvider(
        data
    ) {
        const supabaseModule =
            getSupabaseModule();

        const apiKeyModule =
            getApiKeyModule();

        const supabase =
            supabaseModule.client;

        await supabaseModule
            .requireSession();

        /*
         * Pastikan RPC menerima tipe parameter
         * yang sesuai:
         *
         * admin_create_provider(
         *   text,
         *   text,
         *   text,
         *   text,
         *   boolean
         * )
         */

        const result =
            await supabase.rpc(
                "admin_create_provider",
                {
                    p_provider_id:
                        data.providerId,

                    p_provider_name:
                        data.providerName,

                    p_description:
                        data.description,

                    p_status:
                        data.status,

                    p_is_default:
                        data.isDefault
                }
            );

        if (result.error) {
            throw result.error;
        }

        /*
         * Provider berhasil dibuat.
         * Sekarang simpan API Key.
         */

        try {
            await apiKeyModule.save(
                data.providerId,
                data.apiKey
            );
        } catch (apiKeyError) {
            /*
             * Provider sudah masuk database,
             * tetapi credential gagal disimpan.
             *
             * Berikan error yang jelas.
             */
            throw new Error(
                "Provider berhasil dibuat, tetapi API Key gagal disimpan: " +
                (
                    apiKeyError?.message ||
                    "Unknown error"
                )
            );
        }

        return result.data;
    }

    // ========================================
    // UPDATE PROVIDER
    // ========================================

    async function updateProvider(
        data
    ) {
        const supabaseModule =
            getSupabaseModule();

        const apiKeyModule =
            getApiKeyModule();

        const supabase =
            supabaseModule.client;

        await supabaseModule
            .requireSession();

        const databaseId =
            editingProvider?.id ||
            editingProvider?.uuid;

        if (!databaseId) {
            throw new Error(
                "ID database provider tidak ditemukan."
            );
        }

        const providerId =
            normalizeProviderId(
                editingProvider.provider_id
            );

        if (!providerId) {
            throw new Error(
                "Provider ID lama tidak ditemukan."
            );
        }

        const result =
            await supabase.rpc(
                "admin_update_provider",
                {
                    p_id:
                        databaseId,

                    p_provider_id:
                        providerId,

                    p_provider_name:
                        data.providerName,

                    p_description:
                        data.description,

                    p_status:
                        data.status,

                    p_is_default:
                        data.isDefault
                }
            );

        if (result.error) {
            throw result.error;
        }

        /*
         * API Key hanya diperbarui jika user
         * benar-benar mengisi field API Key.
         */
        if (data.apiKey) {
            await apiKeyModule.save(
                providerId,
                data.apiKey
            );
        }

        return result.data;
    }

    // ========================================
    // SUBMIT
    // ========================================

    async function submit() {
        if (submitting) {
            return;
        }

        if (!form) {
            createModal();
        }

        if (!form) {
            throw new Error(
                "Form provider tidak ditemukan."
            );
        }

        hideMessage();

        /*
         * Browser validation
         */
        if (
            !form.checkValidity()
        ) {
            form.reportValidity();

            return;
        }

        const providerIdInput =
            document.getElementById(
                "providerId"
            );

        const providerNameInput =
            document.getElementById(
                "providerName"
            );

        const descriptionInput =
            document.getElementById(
                "providerDescription"
            );

        const statusInput =
            document.getElementById(
                "providerStatus"
            );

        const defaultInput =
            document.getElementById(
                "providerDefault"
            );

        const apiKeyInput =
            document.getElementById(
                "providerApiKey"
            );

        const providerId =
            validateProviderId(
                providerIdInput?.value
            );

        const providerName =
            validateProviderName(
                providerNameInput?.value
            );

        const description =
            normalizeDescription(
                descriptionInput?.value
            );

        const status =
            normalizeStatus(
                statusInput?.value
            );

        const isDefault =
            Boolean(
                defaultInput?.checked
            );

        const apiKey =
            String(
                apiKeyInput?.value ||
                ""
            ).trim();

        /*
         * API Key wajib ketika CREATE.
         * Saat EDIT boleh kosong.
         */
        if (
            mode === "create" &&
            !apiKey
        ) {
            throw new Error(
                "API Key wajib diisi saat menambahkan provider baru."
            );
        }

        const data = {
            providerId,
            providerName,
            description,
            status,
            isDefault,
            apiKey
        };

        setSubmitting(
            true
        );

        try {
            if (
                mode === "create"
            ) {
                await createProvider(
                    data
                );
            } else {
                await updateProvider(
                    data
                );
            }

            showMessage(
                mode === "create"
                    ? "Provider berhasil ditambahkan."
                    : "Provider berhasil diperbarui.",
                "success"
            );

            /*
             * Refresh list sebelum menutup modal.
             */
            const list =
                getListModule();

            await list.refresh();

            /*
             * Beri sedikit waktu agar user melihat
             * pesan sukses, kemudian tutup.
             */
            setTimeout(
                function () {
                    close();
                },
                500
            );

        } catch (error) {
            console.error(
                "[GEN-Z.AI] Provider form submit error:",
                error
            );

            let message =
                error?.message ||
                "Gagal menyimpan provider.";

            /*
             * Supabase RPC kadang memberikan object
             * error dengan message/detail/hint.
             */
            if (
                error &&
                typeof error === "object"
            ) {
                if (
                    error.message
                ) {
                    message =
                        error.message;
                } else if (
                    error.details
                ) {
                    message =
                        error.details;
                } else if (
                    error.hint
                ) {
                    message =
                        error.hint;
                }
            }

            showMessage(
                message,
                "error"
            );

            /*
             * Lempar lagi supaya caller lain juga
             * mengetahui bahwa operasi gagal.
             */
            throw error;

        } finally {
            setSubmitting(
                false
            );
        }
    }

    // ========================================
    // BIND EVENTS
    // ========================================

    function bindEvents() {
        if (
            !form ||
            eventsBound
        ) {
            return;
        }

        /*
         * SUBMIT FORM
         *
         * Ini bagian penting yang sebelumnya tidak
         * terpasang ketika modal berasal dari HTML.
         */
        form.addEventListener(
            "submit",
            async function (event) {
                event.preventDefault();
                event.stopPropagation();

                try {
                    await submit();
                } catch (error) {
                    /*
                     * Error sudah ditampilkan oleh submit().
                     * Jangan biarkan menjadi unhandled rejection.
                     */
                    console.error(
                        "[GEN-Z.AI] Submit handler:",
                        error
                    );
                }
            }
        );

        /*
         * TOMBOL CLOSE
         */
        modal.addEventListener(
            "click",
            function (event) {
                const closeButton =
                    event.target.closest(
                        "[data-provider-form-action='close']"
                    );

                if (closeButton) {
                    event.preventDefault();
                    close();
                    return;
                }

                /*
                 * Klik backdrop menutup modal.
                 */
                if (
                    event.target ===
                    modal
                ) {
                    close();
                }
            }
        );

        eventsBound =
            true;
    }

    // ========================================
    // INITIALIZE
    // ========================================

    function initialize() {
        try {
            createModal();
        } catch (error) {
            console.error(
                "[GEN-Z.AI] Provider Form initialize error:",
                error
            );
        }
    }

    // ========================================
    // INITIALIZE AFTER DOM READY
    // ========================================

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            initialize,
            {
                once: true
            }
        );
    } else {
        initialize();
    }

    // ========================================
    // PUBLIC MODULE
    // ========================================

    window.GENZProviderForm = {
        ready: true,

        createModal,

        openCreate,

        openEdit,

        close,

        submit,

        getMode:
            function () {
                return mode;
            },

        getEditingProvider:
            function () {
                return editingProvider;
            }
    };

    console.log(
        "[GEN-Z.AI] Provider Form module siap."
    );

})();
