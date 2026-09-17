(function () {
    "use strict";

    // =========================================================
    // GEN-Z.AI - PROVIDER EDIT
    // Khusus menangani aksi EDIT provider.
    // Tidak mengubah providers-form.js
    // =========================================================

    async function edit(providerId) {
        try {
            if (!providerId) {
                throw new Error(
                    "ID provider tidak ditemukan."
                );
            }

            // -------------------------------------------------
            // Pastikan Data Module tersedia
            // -------------------------------------------------

            if (!window.GENZProvidersData) {
                throw new Error(
                    "GENZProvidersData belum dimuat."
                );
            }

            const data =
                window.GENZProvidersData;

            // -------------------------------------------------
            // Ambil provider berdasarkan database UUID
            // -------------------------------------------------

            const provider =
                await data.getProviderById(
                    providerId
                );

            if (!provider) {
                throw new Error(
                    "Provider tidak ditemukan."
                );
            }

            // -------------------------------------------------
            // Pastikan Form Module tersedia
            // -------------------------------------------------

            if (!window.GENZProvidersForm) {
                throw new Error(
                    "GENZProvidersForm belum dimuat."
                );
            }

            const form =
                window.GENZProvidersForm;

            // -------------------------------------------------
            // Buka mode EDIT melalui form yang sudah ada.
            // Tidak membuat form/modal baru.
            // -------------------------------------------------

            if (
                typeof form.openForm ===
                "function"
            ) {
                form.openForm(provider);
            } else if (
                typeof form.editProvider ===
                "function"
            ) {
                form.editProvider(provider);
            } else {
                throw new Error(
                    "Fungsi edit provider pada form tidak tersedia."
                );
            }

            // -------------------------------------------------
            // Buka modal jika initializer menyediakan fungsi.
            // -------------------------------------------------

            if (
                window.GENZProvidersInit &&
                typeof window
                    .GENZProvidersInit
                    .openProviderModal ===
                    "function"
            ) {
                window.GENZProvidersInit
                    .openProviderModal(
                        provider
                    );
            } else {
                // Fallback langsung ke modal.
                openModalFallback();
            }

        } catch (error) {

            console.error(
                "[GEN-Z.AI] Provider Edit:",
                error
            );

            showError(
                error.message ||
                "Gagal membuka provider."
            );
        }
    }

    // =========================================================
    // FALLBACK MODAL
    // =========================================================

    function openModalFallback() {

        const modal =
            document.getElementById(
                "providerModal"
            );

        if (!modal) {
            return;
        }

        modal.style.display =
            "flex";

        modal.classList.add(
            "active"
        );

        modal.removeAttribute(
            "hidden"
        );

        modal.setAttribute(
            "aria-hidden",
            "false"
        );
    }

    // =========================================================
    // ERROR MESSAGE
    // =========================================================

    function showError(message) {

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
                    "error"
                );

            return;
        }

        console.error(
            "[GEN-Z.AI]",
            message
        );

        alert(
            "Error: " +
            message
        );
    }

    // =========================================================
    // PUBLIC API
    // =========================================================

    window.GENZProviderEdit = {

        edit: edit,

        open: edit

    };

})();
