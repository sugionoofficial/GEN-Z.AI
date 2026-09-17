(function () {
    "use strict";

    // =========================================================
    // GEN-Z.AI - PROVIDERS INITIALIZER
    // CRUD CONTROLLER
    // =========================================================

    let initialized = false;
    let busy = false;

    // ---------------------------------------------------------
    // HELPERS
    // ---------------------------------------------------------

    function getElement(id) {
        return document.getElementById(id);
    }

    function getData() {
        if (
            !window.GENZProvidersData
        ) {
            throw new Error(
                "GENZProvidersData belum dimuat."
            );
        }

        return window.GENZProvidersData;
    }

    function getUI() {
        if (
            !window.GENZProvidersUI
        ) {
            throw new Error(
                "GENZProvidersUI belum dimuat."
            );
        }

        return window.GENZProvidersUI;
    }

    function getForm() {
        return (
            window.GENZProvidersForm ||
            null
        );
    }

    function showMessage(
        message,
        type = "success"
    ) {
        console.log(
            `[GEN-Z.AI][${type}]`,
            message
        );

        const existing =
            getElement(
                "providerMessage"
            );

        if (existing) {
            existing.textContent =
                message;

            existing.className =
                `provider-message ${type}`;

            existing.style.display =
                "block";

            setTimeout(
                function () {
                    existing.style.display =
                        "none";
                },
                4000
            );

            return;
        }

        // Fallback sederhana
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
    // LOAD PROVIDERS
    // ---------------------------------------------------------

    async function loadProviders() {
        const data =
            getData();

        const ui =
            getUI();

        try {
            const providers =
                await data.loadProviders();

            ui.renderProviders(
                providers
            );

            return providers;

        } catch (error) {
            console.error(
                "[GEN-Z.AI] Gagal memuat provider:",
                error
            );

            showMessage(
                error.message ||
                "Gagal memuat provider.",
                "error"
            );

            return [];
        }
    }

    // ---------------------------------------------------------
    // OPEN PROVIDER MODAL
    // ---------------------------------------------------------

    function openProviderModal(
        provider = null
    ) {
        const form =
            getForm();

        // Jika providers-form.js
        // memiliki fungsi openForm,
        // gunakan fungsi tersebut.
        if (
            form &&
            typeof form.openForm ===
                "function"
        ) {
            form.openForm(
                provider
            );

            showModal();

            return;
        }

        // Jika hanya tersedia
        // resetForm, kita isi manual.
        if (form) {
            if (
                provider &&
                typeof form.editProvider ===
                    "function"
            ) {
                form.editProvider(
                    provider
                );
            } else if (
                typeof form.resetForm ===
                    "function"
            ) {
                form.resetForm();
            }
        }

        // -----------------------------------------------------
        // Fallback form population
        // -----------------------------------------------------

        if (provider) {
            fillProviderForm(
                provider
            );
        } else {
            clearProviderForm();
        }

        showModal();

        updateModalTitle(
            Boolean(provider)
        );
    }

    // ---------------------------------------------------------
    // FILL EDIT FORM
    // ---------------------------------------------------------

    function fillProviderForm(
        provider
    ) {
        setValue(
            [
                "providerName",
                "provider_name"
            ],
            provider.provider_name
        );

        setValue(
            [
                "providerId",
                "provider_id"
            ],
            provider.provider_id
        );

        setValue(
            [
                "providerDescription",
                "provider_description"
            ],
            provider.description || ""
        );

        setValue(
            [
                "providerStatus",
                "provider_status"
            ],
            provider.status || "active"
        );

        setValue(
            [
                "providerNotes",
                "provider_notes"
            ],
            provider.notes || ""
        );

        setValue(
            [
                "providerApiKey",
                "provider_api_key"
            ],
            ""
        );

        // ID jangan diganti
        // saat edit.
        const idInput =
            getElement(
                "providerId"
            );

        if (idInput) {
            idInput.readOnly =
                true;

            idInput.dataset.editing =
                "true";
        }

        // Simpan ID database
        const formElement =
            getElement(
                "providerForm"
            );

        if (formElement) {
            formElement.dataset.editingId =
                provider.id ||
                provider.uuid ||
                "";
        }
    }

    // ---------------------------------------------------------
    // CLEAR FORM
    // ---------------------------------------------------------

    function clearProviderForm() {
        const form =
            getForm();

        if (
            form &&
            typeof form.resetForm ===
                "function"
        ) {
            try {
                form.resetForm();
            } catch (error) {
                console.warn(
                    "[GEN-Z.AI] resetForm:",
                    error
                );
            }
        }

        const formElement =
            getElement(
                "providerForm"
            );

        if (formElement) {
            delete formElement.dataset
                .editingId;
        }

        const idInput =
            getElement(
                "providerId"
            );

        if (idInput) {
            idInput.readOnly =
                false;

            delete idInput.dataset.editing;
        }

        [
            "providerName",
            "providerId",
            "providerDescription",
            "providerNotes",
            "providerApiKey"
        ].forEach(
            function (id) {
                const input =
                    getElement(id);

                if (input) {
                    input.value =
                        "";
                }
            }
        );

        const status =
            getElement(
                "providerStatus"
            );

        if (status) {
            status.value =
                "active";
        }
    }

    // ---------------------------------------------------------
    // FORM VALUE HELPER
    // ---------------------------------------------------------

    function setValue(
        ids,
        value
    ) {
        for (
            let i = 0;
            i < ids.length;
            i++
        ) {
            const element =
                getElement(ids[i]);

            if (element) {
                element.value =
                    value ?? "";

                return;
            }
        }
    }

    // ---------------------------------------------------------
    // MODAL
    // ---------------------------------------------------------

    function getModal() {
        return (
            getElement(
                "providerModal"
            ) ||
            getElement(
                "providerEditorModal"
            ) ||
            document.querySelector(
                ".provider-modal"
            )
        );
    }

    function showModal() {
        const modal =
            getModal();

        if (!modal) {
            return;
        }

        modal.style.display =
            "flex";

        modal.classList.add(
            "active",
            "open"
        );

        modal.setAttribute(
            "aria-hidden",
            "false"
        );
    }

    function closeProviderModal() {
        const modal =
            getModal();

        if (!modal) {
            return;
        }

        modal.classList.remove(
            "active",
            "open"
        );

        modal.style.display =
            "none";

        modal.setAttribute(
            "aria-hidden",
            "true"
        );

        const idInput =
            getElement(
                "providerId"
            );

        if (idInput) {
            idInput.readOnly =
                false;
        }
    }

    function updateModalTitle(
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

    function handleModalBackdrop(
        event
    ) {
        const modal =
            getModal();

        if (
            modal &&
            event.target === modal
        ) {
            closeProviderModal();
        }
    }

    // ---------------------------------------------------------
    // EDIT
    // ---------------------------------------------------------

    async function editProvider(
        providerId
    ) {
        const data =
            getData();

        const provider =
            data.getProviderById(
                providerId
            );

        if (!provider) {
            showMessage(
                "Provider tidak ditemukan.",
                "error"
            );

            return;
        }

        openProviderModal(
            provider
        );
    }

    // ---------------------------------------------------------
    // TOGGLE STATUS
    // ---------------------------------------------------------

    async function toggleProvider(
        providerId
    ) {
        if (busy) {
            return;
        }

        busy = true;

        try {
            const data =
                getData();

            const provider =
                data.getProviderById(
                    providerId
                );

            if (!provider) {
                throw new Error(
                    "Provider tidak ditemukan."
                );
            }

            const current =
                String(
                    provider.status || ""
                ).toLowerCase();

            const next =
                current === "active"
                    ? "inactive"
                    : "active";

            const label =
                next === "active"
                    ? "mengaktifkan"
                    : "menonaktifkan";

            const confirmed =
                window.confirm(
                    `Yakin ingin ${label} provider "${provider.provider_name}"?`
                );

            if (!confirmed) {
                return;
            }

            await data.toggleProvider(
                providerId
            );

            await loadProviders();

            showMessage(
                next === "active"
                    ? "Provider berhasil diaktifkan."
                    : "Provider berhasil dinonaktifkan."
            );

        } catch (error) {
            console.error(
                "[GEN-Z.AI] Toggle provider:",
                error
            );

            showMessage(
                error.message ||
                "Gagal mengubah status provider.",
                "error"
            );

        } finally {
            busy = false;
        }
    }

    // ---------------------------------------------------------
    // DELETE
    // ---------------------------------------------------------

    async function deleteProvider(
        providerId
    ) {
        if (busy) {
            return;
        }

        busy = true;

        try {
            const data =
                getData();

            const provider =
                data.getProviderById(
                    providerId
                );

            if (!provider) {
                throw new Error(
                    "Provider tidak ditemukan."
                );
            }

            const confirmed =
                window.confirm(
                    `Hapus provider "${provider.provider_name}"?\n\nTindakan ini tidak dapat dibatalkan.`
                );

            if (!confirmed) {
                return;
            }

            await data.deleteProvider(
                providerId
            );

            await loadProviders();

            showMessage(
                "Provider berhasil dihapus."
            );

        } catch (error) {
            console.error(
                "[GEN-Z.AI] Delete provider:",
                error
            );

            showMessage(
                error.message ||
                "Gagal menghapus provider.",
                "error"
            );

        } finally {
            busy = false;
        }
    }

    // ---------------------------------------------------------
    // ACTION EVENT DELEGATION
    // ---------------------------------------------------------

    function bindProviderActions() {
        const containers = [
            getElement(
                "providerList"
            ),
            getElement(
                "providersList"
            ),
            getElement(
                "providerPanel"
            )
        ].filter(Boolean);

        containers.forEach(
            function (container) {
                if (
                    container.dataset
                        .providerActionsBound ===
                    "true"
                ) {
                    return;
                }

                container.dataset
                    .providerActionsBound =
                    "true";

                container.addEventListener(
                    "click",
                    async function (
                        event
                    ) {
                        const button =
                            event.target.closest(
                                "[data-provider-action]"
                            );

                        if (!button) {
                            return;
                        }

                        event.preventDefault();
                        event.stopPropagation();

                        const action =
                            button.dataset
                                .providerAction;

                        const providerId =
                            button.dataset
                                .providerId;

                        if (!providerId) {
                            showMessage(
                                "ID provider tidak ditemukan.",
                                "error"
                            );

                            return;
                        }

                        if (
                            action ===
                            "edit"
                        ) {
                            await editProvider(
                                providerId
                            );

                            return;
                        }

                        if (
                            action ===
                            "toggle"
                        ) {
                            await toggleProvider(
                                providerId
                            );

                            return;
                        }

                        if (
                            action ===
                            "delete"
                        ) {
                            await deleteProvider(
                                providerId
                            );

                            return;
                        }
                    }
                );
            }
        );
    }

    // ---------------------------------------------------------
    // MENU
    // ---------------------------------------------------------

    function openMenu() {
        const menu =
            getElement(
                "adminMenu"
            ) ||
            document.querySelector(
                ".admin-menu"
            );

        if (menu) {
            menu.classList.add(
                "active",
                "open"
            );
        }
    }

    function closeMenu() {
        const menu =
            getElement(
                "adminMenu"
            ) ||
            document.querySelector(
                ".admin-menu"
            );

        if (menu) {
            menu.classList.remove(
                "active",
                "open"
            );
        }
    }

    // ---------------------------------------------------------
    // CURRENT USER
    // ---------------------------------------------------------

    async function loadCurrentUser() {
        try {
            const data =
                getData();

            const supabase =
                data.getSupabase();

            const {
                data: result,
                error
            } =
                await supabase.auth
                    .getUser();

            if (error) {
                console.warn(
                    "[GEN-Z.AI] User:",
                    error
                );

                return null;
            }

            const user =
                result?.user ||
                null;

            const emailElements =
                document.querySelectorAll(
                    "[data-user-email], #userEmail"
                );

            emailElements.forEach(
                function (element) {
                    element.textContent =
                        user?.email ||
                        "";
                }
            );

            return user;

        } catch (error) {
            console.warn(
                "[GEN-Z.AI] loadCurrentUser:",
                error
            );

            return null;
        }
    }

    // ---------------------------------------------------------
    // LOGOUT
    // ---------------------------------------------------------

    async function logout() {
        try {
            const data =
                getData();

            const supabase =
                data.getSupabase();

            await supabase.auth.signOut();

            window.location.href =
                "/login.html";

        } catch (error) {
            console.error(
                "[GEN-Z.AI] Logout:",
                error
            );

            showMessage(
                "Gagal logout.",
                "error"
            );
        }
    }

    // ---------------------------------------------------------
    // GLOBAL EVENTS
    // ---------------------------------------------------------

    function bindGlobalEvents() {
        // Add Provider
        const addButtons =
            document.querySelectorAll(
                [
                    "#addProviderBtn",
                    "#addProvider",
                    "[data-action='add-provider']"
                ].join(",")
            );

        addButtons.forEach(
            function (button) {
                if (
                    button.dataset
                        .providerBound ===
                    "true"
                ) {
                    return;
                }

                button.dataset
                    .providerBound =
                    "true";

                button.addEventListener(
                    "click",
                    function (event) {
                        event.preventDefault();

                        openProviderModal();
                    }
                );
            }
        );

        // Close buttons
        const closeButtons =
            document.querySelectorAll(
                [
                    "#closeProviderModal",
                    "#cancelProvider",
                    "[data-action='close-provider']"
                ].join(",")
            );

        closeButtons.forEach(
            function (button) {
                button.addEventListener(
                    "click",
                    function (event) {
                        event.preventDefault();

                        closeProviderModal();
                    }
                );
            }
        );

        // Refresh
        const refreshButtons =
            document.querySelectorAll(
                [
                    "#refreshProviders",
                    "#refreshProvider",
                    "[data-action='refresh-providers']"
                ].join(",")
            );

        refreshButtons.forEach(
            function (button) {
                button.addEventListener(
                    "click",
                    async function (
                        event
                    ) {
                        event.preventDefault();

                        await loadProviders();
                    }
                );
            }
        );

        // Logout
        const logoutButtons =
            document.querySelectorAll(
                [
                    "#logoutBtn",
                    "#logout",
                    "[data-action='logout']"
                ].join(",")
            );

        logoutButtons.forEach(
            function (button) {
                button.addEventListener(
                    "click",
                    function (event) {
                        event.preventDefault();

                        logout();
                    }
                );
            }
        );

        // Modal backdrop
        const modal =
            getModal();

        if (modal) {
            modal.addEventListener(
                "click",
                handleModalBackdrop
            );
        }

        // Escape
        document.addEventListener(
            "keydown",
            function (event) {
                if (
                    event.key ===
                    "Escape"
                ) {
                    closeProviderModal();
                    closeMenu();
                }
            }
        );
    }

    // ---------------------------------------------------------
    // INIT
    // ---------------------------------------------------------

    async function initialize() {
        if (initialized) {
            return;
        }

        try {
            const data =
                getData();

            data.initSupabase();

            bindGlobalEvents();

            // Penting:
            // event delegation provider
            // harus dipasang setelah DOM ada.
            bindProviderActions();

            await loadCurrentUser();

            await loadProviders();

            initialized = true;

            console.log(
                "[GEN-Z.AI] Provider manager siap."
            );

        } catch (error) {
            console.error(
                "[GEN-Z.AI] Provider initialization gagal:",
                error
            );

            showMessage(
                error.message ||
                "Provider manager gagal dimuat.",
                "error"
            );
        }
    }

    // ---------------------------------------------------------
    // DOM READY
    // ---------------------------------------------------------

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            initialize
        );
    } else {
        initialize();
    }

    // ---------------------------------------------------------
    // PUBLIC API
    // ---------------------------------------------------------

    window.GENZProvidersInit = {
        initialize,
        loadProviders,
        loadCurrentUser,
        logout,

        openMenu,
        closeMenu,

        openProviderModal,
        closeProviderModal,

        handleModalBackdrop,

        editProvider,
        toggleProvider,
        deleteProvider,

        showMessage
    };

})();
