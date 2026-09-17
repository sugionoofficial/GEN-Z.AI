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

    // ========================================
    // HELPERS
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

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function normalizeProviderId(value) {
        return String(value || "")
            .trim()
            .toLowerCase();
    }

    // ========================================
    // CREATE MODAL
    // ========================================

    function createModal() {

        if (modal && document.body.contains(modal)) {
            return modal;
        }

        modal =
            document.getElementById(
                "providerModal"
            );

        if (modal) {
            form =
                modal.querySelector(
                    "#providerForm"
                );

            return modal;
        }

        modal =
            document.createElement(
                "div"
            );

        modal.id =
            "providerModal";

        modal.style.cssText = `
            position:fixed;
            inset:0;
            z-index:99999;
            display:none;
            align-items:center;
            justify-content:center;
            padding:20px;
            background:rgba(0,0,0,.72);
            backdrop-filter:blur(5px);
        `;

        modal.innerHTML = `
            <div
                class="provider-modal-box"
                style="
                    width:min(560px,100%);
                    max-height:90vh;
                    overflow:auto;
                    border-radius:16px;
                    padding:24px;
                    background:#151515;
                    border:1px solid rgba(255,255,255,.12);
                    box-shadow:0 20px 70px rgba(0,0,0,.5);
                "
            >

                <div
                    style="
                        display:flex;
                        align-items:center;
                        justify-content:space-between;
                        gap:12px;
                        margin-bottom:20px;
                    "
                >

                    <div>
                        <h2
                            id="providerFormTitle"
                            style="
                                margin:0;
                                font-size:20px;
                            "
                        >
                            Tambah Provider
                        </h2>

                        <div
                            style="
                                margin-top:5px;
                                font-size:12px;
                                opacity:.6;
                            "
                        >
                            Kelola konfigurasi provider AI.
                        </div>
                    </div>

                    <button
                        type="button"
                        data-provider-form-action="close"
                        style="
                            width:36px;
                            height:36px;
                            border:0;
                            border-radius:8px;
                            background:rgba(255,255,255,.08);
                            color:inherit;
                            cursor:pointer;
                            font-size:18px;
                        "
                    >
                        ×
                    </button>

                </div>

                <form
                    id="providerForm"
                    autocomplete="off"
                >

                    <!-- PROVIDER ID -->

                    <div style="margin-bottom:16px;">

                        <label
                            for="providerId"
                            style="
                                display:block;
                                margin-bottom:7px;
                                font-size:13px;
                                font-weight:600;
                            "
                        >
                            Provider ID
                        </label>

                        <input
                            id="providerId"
                            name="providerId"
                            type="text"
                            placeholder="contoh: kieai"
                            autocomplete="off"
                            required
                            style="
                                width:100%;
                                box-sizing:border-box;
                                padding:11px 12px;
                                border-radius:9px;
                                border:1px solid rgba(255,255,255,.14);
                                background:rgba(255,255,255,.05);
                                color:inherit;
                                outline:none;
                            "
                        />

                        <div
                            style="
                                margin-top:6px;
                                font-size:11px;
                                opacity:.55;
                            "
                        >
                            ID unik provider. Gunakan huruf kecil,
                            angka, titik, garis bawah, atau tanda hubung.
                        </div>

                    </div>

                    <!-- PROVIDER NAME -->

                    <div style="margin-bottom:16px;">

                        <label
                            for="providerName"
                            style="
                                display:block;
                                margin-bottom:7px;
                                font-size:13px;
                                font-weight:600;
                            "
                        >
                            Nama Provider
                        </label>

                        <input
                            id="providerName"
                            name="providerName"
                            type="text"
                            placeholder="Contoh: KIE AI"
                            autocomplete="off"
                            required
                            style="
                                width:100%;
                                box-sizing:border-box;
                                padding:11px 12px;
                                border-radius:9px;
                                border:1px solid rgba(255,255,255,.14);
                                background:rgba(255,255,255,.05);
                                color:inherit;
                                outline:none;
                            "
                        />

                    </div>

                    <!-- DESCRIPTION -->

                    <div style="margin-bottom:16px;">

                        <label
                            for="providerDescription"
                            style="
                                display:block;
                                margin-bottom:7px;
                                font-size:13px;
                                font-weight:600;
                            "
                        >
                            Deskripsi
                        </label>

                        <textarea
                            id="providerDescription"
                            name="description"
                            rows="3"
                            placeholder="Deskripsi provider..."
                            autocomplete="off"
                            style="
                                width:100%;
                                box-sizing:border-box;
                                resize:vertical;
                                padding:11px 12px;
                                border-radius:9px;
                                border:1px solid rgba(255,255,255,.14);
                                background:rgba(255,255,255,.05);
                                color:inherit;
                                outline:none;
                            "
                        ></textarea>

                    </div>

                    <!-- STATUS -->

                    <div style="margin-bottom:16px;">

                        <label
                            for="providerStatus"
                            style="
                                display:block;
                                margin-bottom:7px;
                                font-size:13px;
                                font-weight:600;
                            "
                        >
                            Status
                        </label>

                        <select
                            id="providerStatus"
                            name="status"
                            style="
                                width:100%;
                                box-sizing:border-box;
                                padding:11px 12px;
                                border-radius:9px;
                                border:1px solid rgba(255,255,255,.14);
                                background:#151515;
                                color:inherit;
                                outline:none;
                            "
                        >
                            <option value="active">
                                Aktif
                            </option>

                            <option value="inactive">
                                Nonaktif
                            </option>
                        </select>

                    </div>

                    <!-- DEFAULT -->

                    <label
                        style="
                            display:flex;
                            align-items:center;
                            gap:9px;
                            margin-bottom:16px;
                            font-size:13px;
                            cursor:pointer;
                        "
                    >

                        <input
                            id="providerDefault"
                            name="isDefault"
                            type="checkbox"
                        />

                        Jadikan provider default

                    </label>

                    <!-- API KEY -->

                    <div
                        style="
                            margin-bottom:20px;
                            padding:14px;
                            border-radius:10px;
                            border:1px solid rgba(255,255,255,.08);
                            background:rgba(255,255,255,.025);
                        "
                    >

                        <label
                            for="providerApiKey"
                            style="
                                display:block;
                                margin-bottom:7px;
                                font-size:13px;
                                font-weight:600;
                            "
                        >
                            API Key
                        </label>

                        <input
                            id="providerApiKey"
                            name="apiKey"
                            type="password"
                            placeholder="Masukkan API Key"
                            autocomplete="new-password"
                            style="
                                width:100%;
                                box-sizing:border-box;
                                padding:11px 12px;
                                border-radius:9px;
                                border:1px solid rgba(255,255,255,.14);
                                background:rgba(255,255,255,.05);
                                color:inherit;
                                outline:none;
                            "
                        />

                        <div
                            id="providerApiKeyHint"
                            style="
                                margin-top:7px;
                                font-size:11px;
                                line-height:1.5;
                                opacity:.6;
                            "
                        >
                            API Key disimpan secara aman melalui backend.
                            Saat edit, API Key lama tidak ditampilkan.
                        </div>

                    </div>

                    <!-- MESSAGE -->

                    <div
                        id="providerFormMessage"
                        role="alert"
                        style="
                            display:none;
                            margin-bottom:15px;
                            padding:10px 12px;
                            border-radius:8px;
                            font-size:12px;
                        "
                    ></div>

                    <!-- BUTTONS -->

                    <div
                        style="
                            display:flex;
                            justify-content:flex-end;
                            gap:9px;
                        "
                    >

                        <button
                            type="button"
                            data-provider-form-action="close"
                            style="
                                padding:10px 16px;
                                border:1px solid rgba(255,255,255,.12);
                                border-radius:8px;
                                background:rgba(255,255,255,.05);
                                color:inherit;
                                cursor:pointer;
                                font-weight:600;
                            "
                        >
                            Batal
                        </button>

                        <button
                            id="providerFormSubmit"
                            type="submit"
                            style="
                                padding:10px 18px;
                                border:0;
                                border-radius:8px;
                                background:#fff;
                                color:#111;
                                cursor:pointer;
                                font-weight:700;
                            "
                        >
                            Simpan Provider
                        </button>

                    </div>

                </form>

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
    // MESSAGE
    // ========================================

    function showMessage(
        message,
        type = "error"
    ) {

        const element =
            document.getElementById(
                "providerFormMessage"
            );

        if (!element) {
            return;
        }

        element.textContent =
            String(message || "");

        element.style.display =
            "block";

        if (type === "success") {
            element.style.background =
                "rgba(40,200,120,.12)";

            element.style.border =
                "1px solid rgba(40,200,120,.25)";
        } else {
            element.style.background =
                "rgba(255,70,70,.10)";

            element.style.border =
                "1px solid rgba(255,70,70,.25)";
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

        const hint =
            document.getElementById(
                "providerApiKeyHint"
            );

        if (hint) {
            hint.textContent =
                "API Key disimpan secara aman melalui backend.";
        }

        hideMessage();

        modal.style.display =
            "flex";

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
                provider.provider_id || "";

            // Provider ID tidak boleh diganti
            // saat edit karena merupakan identifier
            // publik yang digunakan credential.
            providerId.disabled =
                true;

            providerId.style.opacity =
                ".55";
        }

        if (providerName) {
            providerName.value =
                provider.provider_name || "";
        }

        if (description) {
            description.value =
                provider.description || "";
        }

        if (status) {
            const currentStatus =
                String(
                    provider.status || "active"
                ).toLowerCase();

            status.value =
                currentStatus === "inactive"
                    ? "inactive"
                    : "active";
        }

        if (defaultCheckbox) {
            defaultCheckbox.checked =
                Boolean(
                    provider.is_default
                );
        }

        // Jangan pernah mengisi API Key lama.
        if (apiKey) {
            apiKey.value =
                "";
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

        const hint =
            document.getElementById(
                "providerApiKeyHint"
            );

        if (hint) {
            hint.textContent =
                "API Key lama tidak ditampilkan. Isi hanya jika ingin mengganti API Key.";
        }

        hideMessage();

        modal.style.display =
            "flex";

        setTimeout(
            function () {
                providerName?.focus();
            },
            50
        );
    }

    // ========================================
    // RESET
    // ========================================

    function resetForm() {

        if (!form) {
            return;
        }

        form.reset();

        const status =
            document.getElementById(
                "providerStatus"
            );

        if (status) {
            status.value =
                "active";
        }

        const apiKey =
            document.getElementById(
                "providerApiKey"
            );

        if (apiKey) {
            apiKey.value =
                "";
        }
    }

    // ========================================
    // CLOSE
    // ========================================

    function close() {

        if (!modal) {
            return;
        }

        modal.style.display =
            "none";

        hideMessage();

        editingProvider =
            null;
    }

    // ========================================
    // COLLECT FORM
    // ========================================

    function collectForm() {

        const providerId =
            document.getElementById(
                "providerId"
            )?.value || "";

        const providerName =
            document.getElementById(
                "providerName"
            )?.value || "";

        const description =
            document.getElementById(
                "providerDescription"
            )?.value || "";

        const status =
            document.getElementById(
                "providerStatus"
            )?.value || "active";

        const isDefault =
            document.getElementById(
                "providerDefault"
            )?.checked || false;

        const apiKey =
            document.getElementById(
                "providerApiKey"
            )?.value || "";

        return {
            providerId:
                normalizeProviderId(
                    providerId
                ),

            providerName:
                String(
                    providerName
                ).trim(),

            description:
                String(
                    description
                ).trim(),

            status:
                status === "inactive"
                    ? "inactive"
                    : "active",

            isDefault:
                Boolean(
                    isDefault
                ),

            apiKey:
                String(
                    apiKey
                ).trim()
        };
    }

    // ========================================
    // VALIDATE
    // ========================================

    function validate(data) {

        if (!data.providerId) {
            throw new Error(
                "Provider ID wajib diisi."
            );
        }

        if (
            !/^[a-z0-9._-]+$/.test(
                data.providerId
            )
        ) {
            throw new Error(
                "Provider ID hanya boleh berisi huruf kecil, angka, titik, garis bawah, dan tanda hubung."
            );
        }

        if (!data.providerName) {
            throw new Error(
                "Nama provider wajib diisi."
            );
        }

        if (
            mode === "create" &&
            !data.apiKey
        ) {
            throw new Error(
                "API Key wajib diisi untuk provider baru."
            );
        }
    }

    // ========================================
    // SET SUBMIT STATE
    // ========================================

    function setSubmitting(
        submitting
    ) {

        const button =
            document.getElementById(
                "providerFormSubmit"
            );

        if (!button) {
            return;
        }

        button.disabled =
            Boolean(submitting);

        button.style.opacity =
            submitting
                ? ".55"
                : "1";

        button.style.cursor =
            submitting
                ? "wait"
                : "pointer";

        if (submitting) {
            button.textContent =
                "Menyimpan...";
        } else {
            button.textContent =
                mode === "edit"
                    ? "Simpan Perubahan"
                    : "Simpan Provider";
        }
    }

    // ========================================
    // CREATE
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

        // Cek ID provider di database
        const existing =
            await supabase
                .from("providers")
                .select("id")
                .eq(
                    "provider_id",
                    data.providerId
                )
                .maybeSingle();

        if (existing.error) {
            throw existing.error;
        }

        if (existing.data) {
            throw new Error(
                "Provider ID sudah digunakan."
            );
        }

        const result =
            await supabase.rpc(
                "admin_create_provider",
                {
                    p_provider_id:
                        data.providerId,

                    p_provider_name:
                        data.providerName,

                    p_description:
                        data.description ||
                        null,

                    p_status:
                        data.status,

                    p_is_default:
                        data.isDefault
                }
            );

        if (result.error) {
            throw result.error;
        }

        // API Key disimpan setelah provider
        // berhasil dibuat.
        await apiKeyModule.save(
            data.providerId,
            data.apiKey
        );

        return result.data;
    }

    // ========================================
    // UPDATE
    // ========================================

    async function updateProvider(
        data
    ) {

        if (!editingProvider) {
            throw new Error(
                "Provider yang diedit tidak ditemukan."
            );
        }

        const supabaseModule =
            getSupabaseModule();

        const apiKeyModule =
            getApiKeyModule();

        const supabase =
            supabaseModule.client;

        await supabaseModule
            .requireSession();

        const databaseId =
            editingProvider.id ||
            editingProvider.uuid;

        if (!databaseId) {
            throw new Error(
                "ID database provider tidak ditemukan."
            );
        }

        const providerId =
            normalizeProviderId(
                editingProvider.provider_id
            );

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
                        data.description ||
                        null,

                    p_status:
                        data.status,

                    p_is_default:
                        data.isDefault
                }
            );

        if (result.error) {
            throw result.error;
        }

        // API Key hanya diganti jika user
        // benar-benar memasukkan key baru.
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

        const data =
            collectForm();

        validate(data);

        setSubmitting(
            true
        );

        hideMessage();

        try {

            if (
                mode === "create"
            ) {

                await createProvider(
                    data
                );

                showMessage(
                    "Provider berhasil dibuat.",
                    "success"
                );

            } else {

                await updateProvider(
                    data
                );

                showMessage(
                    "Provider berhasil diperbarui.",
                    "success"
                );
            }

            // Refresh daftar.
            const list =
                getListModule();

            await list.refresh();

            // Beri waktu agar pesan sukses
            // terlihat sebelum modal ditutup.
            setTimeout(
                function () {
                    close();
                },
                500
            );

        } catch (error) {

            console.error(
                "[GEN-Z.AI] Provider form error:",
                error
            );

            showMessage(
                error?.message ||
                "Gagal menyimpan provider."
            );

        } finally {

            setSubmitting(
                false
            );
        }
    }

    // ========================================
    // EVENTS
    // ========================================

    function bindEvents() {

        if (!modal) {
            return;
        }

        form?.addEventListener(
            "submit",
            function (event) {
                event.preventDefault();

                submit();
            }
        );

        modal.addEventListener(
            "click",
            function (event) {

                // Klik backdrop
                if (
                    event.target === modal
                ) {
                    close();
                    return;
                }

                const button =
                    event.target.closest(
                        "[data-provider-form-action]"
                    );

                if (!button) {
                    return;
                }

                const action =
                    button.dataset
                        .providerFormAction;

                if (
                    action === "close"
                ) {
                    close();
                }
            }
        );

        document.addEventListener(
            "keydown",
            function (event) {

                if (
                    event.key === "Escape" &&
                    modal.style.display === "flex"
                ) {
                    close();
                }
            }
        );
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
