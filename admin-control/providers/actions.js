// ========================================
// GEN-Z.AI
// PROVIDERS - ACTIONS MODULE
// File: admin-control/providers/actions.js
// ========================================

(function () {
    "use strict";

    if (window.GENZProviderActions) {
        return;
    }

    let busy = false;

    // ========================================
    // GET MODULE
    // ========================================

    function getList() {
        const module =
            window.GENZProviderList;

        if (!module || !module.ready) {
            throw new Error(
                "Modul Provider List belum siap."
            );
        }

        return module;
    }

    function getForm() {
        const module =
            window.GENZProviderForm;

        if (!module || !module.ready) {
            throw new Error(
                "Modul Provider Form belum siap."
            );
        }

        return module;
    }

    function getSupabase() {
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
    // MESSAGE
    // ========================================

    function showPageMessage(
        message,
        type = "error"
    ) {
        let element =
            document.getElementById(
                "providerActionMessage"
            );

        if (!element) {
            element =
                document.createElement(
                    "div"
                );

            element.id =
                "providerActionMessage";

            element.style.cssText = `
                position:fixed;
                top:80px;
                right:20px;
                z-index:100000;
                max-width:360px;
                padding:13px 16px;
                border-radius:10px;
                font-size:13px;
                line-height:1.5;
                box-shadow:0 12px 35px rgba(0,0,0,.35);
                display:none;
            `;

            document.body.appendChild(
                element
            );
        }

        element.textContent =
            String(message || "");

        element.style.display =
            "block";

        if (type === "success") {
            element.style.background =
                "rgba(30,160,90,.95)";

            element.style.color =
                "#fff";
        } else {
            element.style.background =
                "rgba(190,45,45,.95)";

            element.style.color =
                "#fff";
        }

        clearTimeout(
            element._hideTimer
        );

        element._hideTimer =
            setTimeout(
                function () {
                    element.style.display =
                        "none";
                },
                3500
            );
    }

    // ========================================
    // BUTTON STATE
    // ========================================

    function setButtonBusy(
        button,
        busyState
    ) {
        if (!button) {
            return;
        }

        if (busyState) {
            if (
                !button.dataset.originalText
            ) {
                button.dataset.originalText =
                    button.textContent;
            }

            button.disabled = true;

            button.style.opacity =
                ".55";

            button.style.cursor =
                "wait";

            button.textContent =
                "Memproses...";
        } else {
            button.disabled = false;

            button.style.opacity =
                "1";

            button.style.cursor =
                "pointer";

            if (
                button.dataset.originalText
            ) {
                button.textContent =
                    button.dataset.originalText;
            }
        }
    }

    // ========================================
    // FIND PROVIDER
    // ========================================

    function findProvider(
        databaseId
    ) {
        return getList().getById(
            databaseId
        );
    }

    // ========================================
    // GET PROVIDER REFERENCE ID
    // ========================================
    //
    // PENTING:
    // Relasi provider dan credential
    // menggunakan provider_id yang sama.
    //
    // providers.provider_id
    // =
    // provider_credentials.provider_id
    //
    // Jangan gunakan provider.id untuk
    // menghapus credential.
    // ========================================

    function getProviderReferenceId(
        provider
    ) {
        const providerId =
            String(
                provider?.provider_id || ""
            ).trim();

        if (!providerId) {
            throw new Error(
                "Provider ID tidak ditemukan."
            );
        }

        return providerId;
    }

    // ========================================
    // EDIT
    // ========================================

    function editProvider(
        databaseId
    ) {
        const provider =
            findProvider(
                databaseId
            );

        if (!provider) {
            throw new Error(
                "Provider tidak ditemukan."
            );
        }

        getForm().openEdit(
            provider
        );
    }

    // ========================================
    // TOGGLE
    // ========================================

    async function toggleProvider(
        databaseId,
        button
    ) {
        const provider =
            findProvider(
                databaseId
            );

        if (!provider) {
            throw new Error(
                "Provider tidak ditemukan."
            );
        }

        const supabaseModule =
            getSupabase();

        const supabase =
            supabaseModule.client;

        await supabaseModule
            .requireSession();

        const currentStatus =
            String(
                provider.status || ""
            )
                .trim()
                .toLowerCase();

        const nextStatus =
            currentStatus === "active"
                ? "inactive"
                : "active";

        setButtonBusy(
            button,
            true
        );

        try {
            const result =
                await supabase.rpc(
                    "admin_update_provider",
                    {
                        p_id:
                            provider.id ||
                            provider.uuid,

                        p_provider_id:
                            provider.provider_id,

                        p_provider_name:
                            provider.provider_name,

                        p_description:
                            provider.description ||
                            null,

                        p_status:
                            nextStatus,

                        p_is_default:
                            Boolean(
                                provider.is_default
                            )
                    }
                );

            if (result.error) {
                throw result.error;
            }

            showPageMessage(
                nextStatus === "active"
                    ? "Provider berhasil diaktifkan."
                    : "Provider berhasil dinonaktifkan.",
                "success"
            );

            await getList()
                .refresh();

        } finally {
            setButtonBusy(
                button,
                false
            );
        }
    }

    // ========================================
    // DELETE API KEY / CREDENTIAL
    // ========================================
    //
    // Credential dihapus berdasarkan:
    //
    // provider_credentials.provider_id
    // =
    // providers.provider_id
    //
    // BUKAN berdasarkan providers.id.
    // ========================================

    async function deleteProviderCredential(
        providerId
    ) {
        const providerReferenceId =
            String(
                providerId || ""
            ).trim();

        if (!providerReferenceId) {
            throw new Error(
                "Provider ID untuk API key tidak ditemukan."
            );
        }

        const supabaseModule =
            getSupabase();

        const token =
            await supabaseModule
                .getAccessToken();

        if (!token) {
            throw new Error(
                "Session admin tidak ditemukan."
            );
        }

        const response =
            await fetch(
                "/api/admin-provider-credentials",
                {
                    method: "DELETE",

                    headers: {
                        "Content-Type":
                            "application/json",

                        Authorization:
                            `Bearer ${token}`
                    },

                    body:
                        JSON.stringify({
                            provider_id:
                                providerReferenceId
                        })
                }
            );

        let data = null;

        try {
            data =
                await response.json();
        } catch {
            data = null;
        }

        if (!response.ok) {
            throw new Error(
                data?.error ||
                "Gagal menghapus API key provider."
            );
        }

        return data;
    }

    // ========================================
    // DELETE PROVIDER
    // ========================================
    //
    // URUTAN:
    //
    // 1. Ambil providers.provider_id
    // 2. Hapus credential dengan provider_id
    // 3. Hapus provider dengan provider_id
    //
    // Tidak menggunakan provider.id sebagai
    // referensi hubungan credential.
    // ========================================

    async function deleteProvider(
        databaseId,
        button
    ) {
        const provider =
            findProvider(
                databaseId
            );

        if (!provider) {
            throw new Error(
                "Provider tidak ditemukan."
            );
        }

        // ====================================
        // SATU-SATUNYA REFERENSI RELASI
        // ====================================

        const providerReferenceId =
            getProviderReferenceId(
                provider
            );

        const providerName =
            provider.provider_name ||
            providerReferenceId ||
            "provider ini";

        const confirmed =
            window.confirm(
                `Hapus ${providerName}?\n\n` +
                "Provider dan API key yang tersimpan akan dihapus permanen."
            );

        if (!confirmed) {
            return;
        }

        const supabaseModule =
            getSupabase();

        const supabase =
            supabaseModule.client;

        await supabaseModule
            .requireSession();

        setButtonBusy(
            button,
            true
        );

        try {

            // ====================================
            // STEP 1
            // HAPUS CREDENTIAL
            // ====================================
            //
            // providers.provider_id
            // =
            // provider_credentials.provider_id
            //
            // Nilai providerReferenceId yang sama
            // dikirim ke endpoint credential.
            // ====================================

            const credentialResult =
                await deleteProviderCredential(
                    providerReferenceId
                );

            const deletedCredentialCount =
                Number(
                    credentialResult?.deleted_count || 0
                );

            console.log(
                "[GEN-Z.AI] Credential provider dihapus:",
                {
                    provider_id:
                        providerReferenceId,

                    deleted_count:
                        deletedCredentialCount
                }
            );

            // ====================================
            // STEP 2
            // HAPUS PROVIDER
            // ====================================
            //
            // PENTING:
            // Penghapusan provider juga memakai
            // provider_id yang sama.
            //
            // RPC yang dipakai:
            //
            // admin_delete_provider
            //
            // dengan:
            //
            // p_provider_id
            //
            // ====================================

            const result =
                await supabase.rpc(
                    "admin_delete_provider",
                    {
                        p_provider_id:
                            providerReferenceId
                    }
                );

            if (result.error) {
                throw result.error;
            }

            // ====================================
            // STEP 3
            // BERSIHKAN STATUS SESSION
            // ====================================

            const apiKeyModule =
                window.GENZProviderApiKey;

            if (
                apiKeyModule &&
                typeof apiKeyModule.clearStatus ===
                    "function"
            ) {
                apiKeyModule.clearStatus(
                    providerReferenceId
                );
            }

            // ====================================
            // STEP 4
            // REFRESH LIST
            // ====================================

            await getList()
                .refresh();

            // ====================================
            // STEP 5
            // SUCCESS MESSAGE
            // ====================================

            showPageMessage(
                deletedCredentialCount > 0
                    ? `Provider berhasil dihapus. ${deletedCredentialCount} API key/credential ikut dihapus.`
                    : "Provider berhasil dihapus. Tidak ada credential yang tersisa.",
                "success"
            );

        } finally {
            setButtonBusy(
                button,
                false
            );
        }
    }

    // ========================================
    // CLICK HANDLER
    // ========================================

    async function handleAction(
        button
    ) {
        if (!button) {
            return;
        }

        if (busy) {
            return;
        }

        const action =
            button.dataset
                .providerAction;

        const databaseId =
            button.dataset
                .providerId;

        if (!action) {
            return;
        }

        if (!databaseId) {
            showPageMessage(
                "ID provider tidak ditemukan."
            );

            return;
        }

        busy = true;

        try {

            switch (action) {

                case "edit":

                    editProvider(
                        databaseId
                    );

                    break;

                case "toggle":

                    await toggleProvider(
                        databaseId,
                        button
                    );

                    break;

                case "delete":

                    await deleteProvider(
                        databaseId,
                        button
                    );

                    break;

                default:

                    console.warn(
                        "[GEN-Z.AI] Provider action tidak dikenal:",
                        action
                    );
            }

        } catch (error) {

            console.error(
                "[GEN-Z.AI] Provider action error:",
                error
            );

            showPageMessage(
                error?.message ||
                "Operasi provider gagal."
            );

        } finally {

            busy = false;
        }
    }

    // ========================================
    // DOCUMENT DELEGATION
    // ========================================

    document.addEventListener(
        "click",
        function (event) {

            const button =
                event.target.closest(
                    "[data-provider-action]"
                );

            if (!button) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();

            handleAction(
                button
            );
        },
        true
    );

    // ========================================
    // PUBLIC MODULE
    // ========================================

    window.GENZProviderActions = {

        ready: true,

        edit:
            editProvider,

        toggle:
            toggleProvider,

        delete:
            deleteProvider,

        handle:
            handleAction
    };

    console.log(
        "[GEN-Z.AI] Provider Actions module siap."
    );

})();
