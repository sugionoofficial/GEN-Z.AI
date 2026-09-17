// ========================================
// GEN-Z.AI
// PROVIDERS - UI COMPATIBILITY MODULE
// File: admin-control/providers/ui.js
// ========================================

(function () {
    "use strict";

    if (window.GENZProviderUI) {
        return;
    }

    // ========================================
    // MENU
    // ========================================

    function openMenu() {
        const sidebar =
            document.getElementById("sidebar");

        const overlay =
            document.getElementById("menuOverlay");

        const button =
            document.getElementById("menuButton");

        if (sidebar) {
            sidebar.classList.add("show");
        }

        if (overlay) {
            overlay.classList.add("show");
        }

        if (button) {
            button.classList.add("active");
            button.setAttribute(
                "aria-expanded",
                "true"
            );
        }

        document.body.classList.add(
            "menu-open"
        );
    }

    function closeMenu() {
        const sidebar =
            document.getElementById("sidebar");

        const overlay =
            document.getElementById("menuOverlay");

        const button =
            document.getElementById("menuButton");

        if (sidebar) {
            sidebar.classList.remove("show");
        }

        if (overlay) {
            overlay.classList.remove("show");
        }

        if (button) {
            button.classList.remove("active");
            button.setAttribute(
                "aria-expanded",
                "false"
            );
        }

        document.body.classList.remove(
            "menu-open"
        );
    }

    // ========================================
    // PROVIDER MODAL
    // ========================================

    function openProviderModal() {
        const form =
            window.GENZProviderForm;

        if (
            form &&
            typeof form.openCreate === "function"
        ) {
            form.openCreate();
            return;
        }

        console.error(
            "[GEN-Z.AI] Provider Form belum siap."
        );
    }

    function closeProviderModal() {
        const form =
            window.GENZProviderForm;

        if (
            form &&
            typeof form.close === "function"
        ) {
            form.close();
            return;
        }

        const modal =
            document.getElementById(
                "providerModal"
            );

        if (modal) {
            modal.classList.remove("show");
            modal.style.display = "none";
        }
    }

    function handleModalBackdrop(event) {
        if (
            event.target &&
            event.target.id ===
                "providerModal"
        ) {
            closeProviderModal();
        }
    }

    // ========================================
    // API KEY VISIBILITY
    // ========================================

    function toggleApiKey() {
        const input =
            document.getElementById(
                "providerApiKey"
            );

        if (!input) {
            return;
        }

        const eye =
            document.getElementById(
                "apiEye"
            );

        if (input.type === "password") {

            input.type = "text";

            if (eye) {
                eye.innerHTML = `
                    <path
                        d="M3 3l18 18"
                    ></path>

                    <path
                        d="M10.6 10.6a2 2 0 0 0 2.8 2.8"
                    ></path>

                    <path
                        d="M9.9 4.3A10.7 10.7 0 0 1 12 4c6.5 0 10 8 10 8a18.4 18.4 0 0 1-3.1 4.3"
                    ></path>

                    <path
                        d="M6.6 6.6C3.7 8.4 2 12 2 12s3.5 8 10 8a10.8 10.8 0 0 0 4.1-.8"
                    ></path>
                `;
            }

        } else {

            input.type = "password";

            if (eye) {
                eye.innerHTML = `
                    <path
                        d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"
                    ></path>

                    <circle
                        cx="12"
                        cy="12"
                        r="2.5"
                    ></circle>
                `;
            }
        }
    }

    // ========================================
    // LOGOUT
    // ========================================

    async function logout() {

        const confirmed =
            window.confirm(
                "Keluar dari akun GEN-Z.AI?"
            );

        if (!confirmed) {
            return;
        }

        try {

            const supabaseModule =
                window.GENZProviderSupabase;

            if (
                supabaseModule &&
                supabaseModule.client
            ) {
                await supabaseModule.client.auth.signOut();
            }

        } catch (error) {

            console.error(
                "[GEN-Z.AI] Logout error:",
                error
            );

        } finally {

            window.location.href =
                "../index.html";
        }
    }

    // ========================================
    // GLOBAL COMPATIBILITY
    // ========================================
    //
    // providers.html masih menggunakan
    // onclick="..." untuk beberapa tombol.
    //
    // Fungsi dibuat global agar HTML lama
    // tetap kompatibel dengan arsitektur
    // provider modular baru.
    //
    // ========================================

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

    window.toggleApiKey =
        toggleApiKey;

    window.logout =
        logout;

    // ========================================
    // CLOSE MENU WITH ESC
    // ========================================

    document.addEventListener(
        "keydown",
        function (event) {

            if (
                event.key === "Escape"
            ) {
                closeMenu();
            }
        }
    );

    // ========================================
    // CLOSE MENU WHEN NAVIGATION CLICKED
    // ========================================

    document.addEventListener(
        "click",
        function (event) {

            const link =
                event.target.closest(
                    ".sidebar a"
                );

            if (link) {
                closeMenu();
            }
        }
    );

    // ========================================
    // PUBLIC MODULE
    // ========================================

    window.GENZProviderUI = {

        ready: true,

        openMenu,

        closeMenu,

        openProviderModal,

        closeProviderModal,

        handleModalBackdrop,

        toggleApiKey,

        logout
    };

    console.log(
        "[GEN-Z.AI] Provider UI module siap."
    );

})();
