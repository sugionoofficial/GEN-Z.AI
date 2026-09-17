(function () {
    "use strict";

    const BASE_PATH = "providers/";

    const MODULES = [
        "providers-data.js",
        "providers-form.js",
        "providers-ui.js",
        "providers-init.js"
    ];

    let loadingPromise = null;

    /*
     * =========================================================
     * FIX PROVIDER PAGE
     * =========================================================
     */
    function installPageFixes() {
        if (document.getElementById("genz-provider-page-fixes")) {
            return;
        }

        const style = document.createElement("style");
        style.id = "genz-provider-page-fixes";

        style.textContent = `
            /*
             * PROVIDER LIST
             */
            .provider-panel > .provider-empty {
                min-height: 80px;
            }

            #providerList,
            #providersList,
            #providerPanel {
                position: relative;
                z-index: 1;
                width: 100%;
            }

            /*
             * =================================================
             * NAVIGATION
             * =================================================
             *
             * Navigation harus berada DI ATAS modal backdrop.
             * Kalau tidak, overlay modal akan menangkap klik.
             */

            .topbar {
                position: fixed !important;
                z-index: 3000 !important;
                pointer-events: auto !important;
            }

            .topbar-left,
            .topbar-right,
            .topbar a,
            .topbar button {
                position: relative;
                z-index: 3002 !important;
                pointer-events: auto !important;
            }

            .menu-button {
                position: relative;
                z-index: 3003 !important;
                pointer-events: auto !important;
            }

            .sidebar {
                position: fixed !important;
                z-index: 3000 !important;
                pointer-events: auto !important;
            }

            .sidebar .nav,
            .sidebar .nav a,
            .sidebar .nav button {
                position: relative;
                z-index: 3002 !important;
                pointer-events: auto !important;
            }

            /*
             * Overlay menu tetap di bawah sidebar.
             */
            .menu-overlay {
                z-index: 2900 !important;
            }

            /*
             * =================================================
             * MODAL
             * =================================================
             *
             * Modal tetap bisa digunakan, tetapi tidak boleh
             * menutup navigation.
             */

            .modal-backdrop {
                z-index: 2000 !important;
            }

            .modal-backdrop .modal,
            .modal-backdrop .modal-card,
            .modal-backdrop .provider-modal {
                position: relative;
                z-index: 2001 !important;
            }

            /*
             * Tombol close/modal tetap bisa diklik.
             */
            .modal-backdrop button,
            .modal-backdrop input,
            .modal-backdrop select,
            .modal-backdrop textarea {
                pointer-events: auto;
            }

            /*
             * =================================================
             * PROVIDER ACTION BUTTON
             * =================================================
             */

            .provider-actions {
                position: relative;
                z-index: 10;
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
            }

            .provider-action-btn {
                position: relative;
                z-index: 11;
                pointer-events: auto !important;
                cursor: pointer !important;
            }
        `;

        document.head.appendChild(style);
    }

    /*
     * =========================================================
     * PREPARE PROVIDER PAGE
     * =========================================================
     */
    function prepareProviderPage() {
        installPageFixes();

        /*
         * Cari container yang sudah ada.
         */
        const existing =
            document.getElementById("providerList") ||
            document.getElementById("providersList") ||
            document.getElementById("providerPanel");

        if (existing) {
            return existing;
        }

        /*
         * Kalau tidak ada, gunakan provider-empty
         * sebagai container render provider.
         */
        const panel =
            document.querySelector(".provider-panel");

        if (!panel) {
            console.warn(
                "GEN-Z.AI: .provider-panel tidak ditemukan."
            );

            return null;
        }

        let empty =
            panel.querySelector(".provider-empty");

        if (!empty) {
            empty =
                document.createElement("div");

            empty.className =
                "provider-empty";

            panel.appendChild(empty);
        }

        empty.id = "providerList";

        return empty;
    }

    /*
     * =========================================================
     * LOAD SCRIPT
     * =========================================================
     */
    function loadScript(src) {
        return new Promise((resolve, reject) => {

            const existing =
                document.querySelector(
                    `script[data-genz-provider-module="${src}"]`
                );

            /*
             * Script sudah pernah dimuat.
             */
            if (existing) {

                if (
                    existing.dataset.loaded ===
                    "true"
                ) {
                    resolve();
                    return;
                }

                existing.addEventListener(
                    "load",
                    resolve,
                    {
                        once: true
                    }
                );

                existing.addEventListener(
                    "error",
                    () => {
                        reject(
                            new Error(
                                `Gagal memuat module: ${src}`
                            )
                        );
                    },
                    {
                        once: true
                    }
                );

                return;
            }

            /*
             * Buat script baru.
             */
            const script =
                document.createElement(
                    "script"
                );

            script.src =
                BASE_PATH + src;

            script.async = false;

            script.dataset.genzProviderModule =
                src;

            script.addEventListener(
                "load",
                () => {

                    script.dataset.loaded =
                        "true";

                    resolve();
                },
                {
                    once: true
                }
            );

            script.addEventListener(
                "error",
                () => {

                    reject(
                        new Error(
                            `Gagal memuat module: ${src}`
                        )
                    );
                },
                {
                    once: true
                }
            );

            document.head.appendChild(
                script
            );
        });
    }

    /*
     * =========================================================
     * LOAD ALL PROVIDER MODULES
     * =========================================================
     */
    async function loadModules() {

        if (loadingPromise) {
            return loadingPromise;
        }

        loadingPromise =
            (async () => {

                for (
                    const moduleName
                    of MODULES
                ) {

                    await loadScript(
                        moduleName
                    );
                }

                return true;
            })();

        try {

            return await loadingPromise;

        } catch (error) {

            loadingPromise = null;

            console.error(
                "Provider modules gagal dimuat:",
                error
            );

            throw error;
        }
    }

    /*
     * =========================================================
     * INITIALIZE PROVIDER CONTROL
     * =========================================================
     */
    async function initialize() {

        /*
         * Siapkan DOM dan CSS terlebih dahulu.
         */
        prepareProviderPage();

        /*
         * Load semua module provider.
         */
        await loadModules();

        /*
         * Ambil initializer.
         */
        const init =
            window.GENZProvidersInit;

        if (
            !init ||
            typeof init.initialize !==
                "function"
        ) {

            throw new Error(
                "GENZProvidersInit tidak tersedia."
            );
        }

        /*
         * Jalankan provider system.
         */
        return init.initialize();
    }

    /*
     * =========================================================
     * PUBLIC API
     * =========================================================
     */
    window.GENZProvidersLoader =
        Object.freeze({
            loadModules,
            initialize
        });

    /*
     * =========================================================
     * AUTO INITIALIZE
     * =========================================================
     */
    initialize()
        .catch(error => {

            console.error(
                "Gagal menginisialisasi Provider Control:",
                error
            );

        });

})();
