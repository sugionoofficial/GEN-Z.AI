(function () {
    "use strict";

    let initialized = false;

    function getDataModule() {
        return window.GENZProvidersData || null;
    }

    function getFormModule() {
        return window.GENZProvidersForm || null;
    }

    function getUiModule() {
        return window.GENZProvidersUI || null;
    }

    function showMessage(message) {
        const element =
            document.getElementById("message");

        if (!element) {
            console.log(message);
            return;
        }

        element.textContent =
            String(message || "");

        element.classList.add("show");

        clearTimeout(
            showMessage.timer
        );

        showMessage.timer =
            setTimeout(() => {
                element.classList.remove(
                    "show"
                );
            }, 3200);
    }

    function openMenu() {
        const overlay =
            document.querySelector(
                ".menu-overlay"
            );

        const sidebar =
            document.querySelector(
                ".sidebar"
            );

        const button =
            document.querySelector(
                ".menu-button"
            );

        if (overlay) {
            overlay.classList.add("show");
        }

        if (sidebar) {
            sidebar.classList.add("show");
        }

        if (button) {
            button.classList.add("active");
        }

        document.body.classList.add(
            "menu-open"
        );
    }

    function closeMenu() {
        const overlay =
            document.querySelector(
                ".menu-overlay"
            );

        const sidebar =
            document.querySelector(
                ".sidebar"
            );

        const button =
            document.querySelector(
                ".menu-button"
            );

        if (overlay) {
            overlay.classList.remove(
                "show"
            );
        }

        if (sidebar) {
            sidebar.classList.remove(
                "show"
            );
        }

        if (button) {
            button.classList.remove(
                "active"
            );
        }

        document.body.classList.remove(
            "menu-open"
        );
    }

    function openProviderModal() {
        const backdrop =
            document.getElementById(
                "providerModal"
            );

        if (!backdrop) {
            return;
        }

        const form =
            getFormModule();

        if (
            form &&
            typeof form.resetForm ===
                "function"
        ) {
            form.resetForm();
        }

        backdrop.classList.add(
            "show"
        );

        document.body.classList.add(
            "menu-open"
        );

        const providerName =
            document.getElementById(
                "providerName"
            );

        if (providerName) {
            setTimeout(() => {
                providerName.focus();
            }, 80);
        }
    }

    function closeProviderModal() {
        const backdrop =
            document.getElementById(
                "providerModal"
            );

        if (!backdrop) {
            return;
        }

        backdrop.classList.remove(
            "show"
        );

        document.body.classList.remove(
            "menu-open"
        );

        const form =
            getFormModule();

        if (
            form &&
            typeof form.resetForm ===
                "function"
        ) {
            form.resetForm();
        }
    }

    function handleModalBackdrop(event) {
        const backdrop =
            document.getElementById(
                "providerModal"
            );

        if (!backdrop) {
            return;
        }

        if (
            event.target ===
            backdrop
        ) {
            closeProviderModal();
        }
    }

    async function loadProviders() {
        const data =
            getDataModule();

        const ui =
            getUiModule();

        if (!data) {
            showMessage(
                "Module provider data belum dimuat."
            );

            return [];
        }

        if (!ui) {
            showMessage(
                "Module provider UI belum dimuat."
            );

            return [];
        }

        try {
            const providers =
                await data.loadProviders();

            ui.renderProviderRegistry();

            return providers;

        } catch (error) {
            console.error(
                "Gagal memuat provider:",
                error
            );

            showMessage(
                error?.message ||
                "Gagal memuat daftar provider."
            );

            return [];
        }
    }

    async function loadCurrentUser() {
        const data =
            getDataModule();

        if (!data) {
            return null;
        }

        const supabaseClient =
            data.getSupabase();

        if (!supabaseClient) {
            return null;
        }

        try {
            const {
                data: userData,
                error
            } =
                await supabaseClient.auth.getUser();

            if (error) {
                throw error;
            }

            const user =
                userData?.user || null;

            if (!user) {
                return null;
            }

            const email =
                user.email ||
                "Administrator";

            const metadata =
                user.user_metadata ||
                {};

            const displayName =
                metadata.full_name ||
                metadata.name ||
                email
                    .split("@")[0] ||
                "Administrator";

            const nameElements =
                document.querySelectorAll(
                    "[data-user-name]"
                );

            nameElements.forEach(
                element => {
                    element.textContent =
                        displayName;
                }
            );

            const emailElements =
                document.querySelectorAll(
                    "[data-user-email]"
                );

            emailElements.forEach(
                element => {
                    element.textContent =
                        email;
                }
            );

            const fallbackName =
                document.getElementById(
                    "adminName"
                );

            if (fallbackName) {
                fallbackName.textContent =
                    displayName;
            }

            const fallbackEmail =
                document.getElementById(
                    "adminEmail"
                );

            if (fallbackEmail) {
                fallbackEmail.textContent =
                    email;
            }

            return user;

        } catch (error) {
            console.error(
                "Gagal memuat user:",
                error
            );

            return null;
        }
    }

    async function logout() {
        const data =
            getDataModule();

        if (!data) {
            return;
        }

        const supabaseClient =
            data.getSupabase();

        if (!supabaseClient) {
            return;
        }

        try {
            const {
                error
            } =
                await supabaseClient.auth.signOut({
                    scope: "local"
                });

            if (error) {
                throw error;
            }

            window.location.href =
                "../login.html";

        } catch (error) {
            console.error(
                "Gagal logout:",
                error
            );

            showMessage(
                error?.message ||
                "Gagal keluar dari akun."
            );
        }
    }

    function bindMenuEvents() {
        const menuButton =
            document.querySelector(
                ".menu-button"
            );

        const overlay =
            document.querySelector(
                ".menu-overlay"
            );

        if (menuButton) {
            menuButton.addEventListener(
                "click",
                () => {
                    const sidebar =
                        document.querySelector(
                            ".sidebar"
                        );

                    if (
                        sidebar &&
                        sidebar.classList.contains(
                            "show"
                        )
                    ) {
                        closeMenu();
                    } else {
                        openMenu();
                    }
                }
            );
        }

        if (overlay) {
            overlay.addEventListener(
                "click",
                closeMenu
            );
        }

        document
            .querySelectorAll(
                ".sidebar a"
            )
            .forEach(link => {
                link.addEventListener(
                    "click",
                    () => {
                        closeMenu();
                    }
                );
            });
    }

    function bindModalEvents() {
        const backdrop =
            document.getElementById(
                "providerModal"
            );

        if (backdrop) {
            backdrop.addEventListener(
                "click",
                handleModalBackdrop
            );
        }

        const closeButtons =
            document.querySelectorAll(
                "[data-close-provider-modal]"
            );

        closeButtons.forEach(
            button => {
                button.addEventListener(
                    "click",
                    closeProviderModal
                );
            }
        );
    }

    function bindEscapeKey() {
        document.addEventListener(
            "keydown",
            event => {
                if (
                    event.key !==
                    "Escape"
                ) {
                    return;
                }

                const modal =
                    document.getElementById(
                        "providerModal"
                    );

                if (
                    modal &&
                    modal.classList.contains(
                        "show"
                    )
                ) {
                    closeProviderModal();
                    return;
                }

                const sidebar =
                    document.querySelector(
                        ".sidebar"
                    );

                if (
                    sidebar &&
                    sidebar.classList.contains(
                        "show"
                    )
                ) {
                    closeMenu();
                }
            }
        );
    }

    function bindGlobalButtons() {
        document
            .querySelectorAll(
                "[data-open-provider-modal]"
            )
            .forEach(button => {
                button.addEventListener(
                    "click",
                    openProviderModal
                );
            });

        document
            .querySelectorAll(
                "[data-close-provider-modal]"
            )
            .forEach(button => {
                button.addEventListener(
                    "click",
                    closeProviderModal
                );
            });

        document
            .querySelectorAll(
                "[data-provider-logout]"
            )
            .forEach(button => {
                button.addEventListener(
                    "click",
                    logout
                );
            });
    }

    async function initialize() {
        if (initialized) {
            return;
        }

        initialized = true;

        const data =
            getDataModule();

        const form =
            getFormModule();

        if (!data) {
            console.error(
                "GENZProvidersData belum tersedia."
            );

            return;
        }

        const supabaseReady =
            data.initSupabase();

        if (!supabaseReady) {
            showMessage(
                "Supabase gagal diinisialisasi."
            );

            return;
        }

        if (form) {
            form.initForm();
        }

        bindMenuEvents();
        bindModalEvents();
        bindEscapeKey();
        bindGlobalButtons();

        await loadCurrentUser();

        await loadProviders();
    }

    window.GENZProvidersInit =
        Object.freeze({
            initialize,
            loadProviders,
            loadCurrentUser,
            logout,
            openMenu,
            closeMenu,
            openProviderModal,
            closeProviderModal,
            handleModalBackdrop,
            showMessage
        });

    /*
     * Compatibility layer.
     *
     * providers.html versi lama masih memanggil
     * fungsi-fungsi global ini.
     */

    window.loadProviders =
        loadProviders;

    window.loadCurrentUser =
        loadCurrentUser;

    window.logout =
        logout;

    window.openMenu =
        openMenu;

    window.closeMenu =
        closeMenu;

    window.openProviderModal =
        openProviderModal;

    window.closeProviderModal =
        closeProviderModal;

    window.handleModalBackdrop =
        handleModalBackdrop;

    window.showMessage =
        showMessage;

    /*
     * Inisialisasi hanya jika DOM sudah siap.
     */

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

})();
