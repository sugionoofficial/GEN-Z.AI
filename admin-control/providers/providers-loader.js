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

    // =========================================================
    // FIX CSS + NAVIGATION
    // =========================================================

    function installPageFixes() {

        if (
            document.getElementById(
                "genz-provider-page-fixes"
            )
        ) {
            return;
        }

        const style =
            document.createElement("style");

        style.id =
            "genz-provider-page-fixes";

        style.textContent = `

            /* =================================================
               PROVIDER CONTAINER
               ================================================= */

            .provider-panel {
                position: relative !important;
                z-index: 1 !important;
            }

            #providerList,
            #providersList,
            #providerPanel {
                position: relative !important;
                z-index: 2 !important;
                width: 100% !important;
                pointer-events: auto !important;
            }


            /* =================================================
               PROVIDER ACTION BUTTONS
               ================================================= */

            .provider-actions {
                position: relative !important;
                z-index: 20 !important;

                display: flex !important;
                flex-wrap: wrap !important;
                gap: 8px !important;

                margin-top: 18px !important;

                pointer-events: auto !important;
            }

            .provider-action-btn {
                position: relative !important;
                z-index: 21 !important;

                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;

                min-height: 38px !important;
                padding: 8px 14px !important;

                border-radius: 10px !important;

                cursor: pointer !important;
                pointer-events: auto !important;

                opacity: 1 !important;
                visibility: visible !important;
            }

            .provider-btn-edit {
                background: rgba(99,102,241,.18) !important;
                border: 1px solid rgba(99,102,241,.45) !important;
                color: #ffffff !important;
            }

            .provider-btn-success {
                background: rgba(34,197,94,.18) !important;
                border: 1px solid rgba(34,197,94,.45) !important;
                color: #ffffff !important;
            }

            .provider-btn-warning {
                background: rgba(245,158,11,.18) !important;
                border: 1px solid rgba(245,158,11,.45) !important;
                color: #ffffff !important;
            }

            .provider-btn-delete {
                background: rgba(239,68,68,.18) !important;
                border: 1px solid rgba(239,68,68,.45) !important;
                color: #ffffff !important;
            }


            /* =================================================
               TOP NAVIGATION
               ================================================= */

            .topbar {
                position: fixed !important;
                z-index: 3000 !important;
                pointer-events: auto !important;
            }

            .topbar-left,
            .topbar-right {
                position: relative !important;
                z-index: 3001 !important;
                pointer-events: auto !important;
            }

            .topbar a,
            .topbar button {
                position: relative !important;
                z-index: 3002 !important;
                pointer-events: auto !important;
                cursor: pointer !important;
            }

            .menu-button {
                position: relative !important;
                z-index: 3003 !important;
                pointer-events: auto !important;
                cursor: pointer !important;
            }


            /* =================================================
               SIDEBAR
               ================================================= */

            .sidebar {
                position: fixed !important;
                z-index: 3000 !important;
                pointer-events: auto !important;
            }

            .sidebar *,
            .sidebar a,
            .sidebar button {
                pointer-events: auto !important;
            }

            .sidebar a,
            .sidebar button {
                position: relative !important;
                z-index: 3002 !important;
                cursor: pointer !important;
            }


            /* =================================================
               MENU OVERLAY
               ================================================= */

            .menu-overlay {
                z-index: 2900 !important;
            }


            /* =================================================
               MODAL
               ================================================= */

            .modal-backdrop {
                z-index: 2000 !important;
            }

            .modal-backdrop .modal,
            .modal-backdrop .modal-card,
            .modal-backdrop .provider-modal {
                position: relative !important;
                z-index: 2001 !important;
            }

            .modal-backdrop button,
            .modal-backdrop input,
            .modal-backdrop select,
            .modal-backdrop textarea {
                pointer-events: auto !important;
            }

        `;

        document.head.appendChild(style);
    }


    // =========================================================
    // PREPARE PROVIDER PAGE
    // =========================================================

    function prepareProviderPage() {

        installPageFixes();

        /*
         * Cari container yang sudah ada.
         */

        let container =
            document.getElementById(
                "providerList"
            ) ||
            document.getElementById(
                "providersList"
            ) ||
            document.getElementById(
                "providerPanel"
            );

        if (container) {
            return container;
        }

        /*
         * HTML GEN-Z.AI menggunakan:
         *
         * <section class="provider-panel">
         *
         * Jadi kita gunakan panel tersebut
         * sebagai container provider.
         */

        const panel =
            document.querySelector(
                ".provider-panel"
            );

        if (!panel) {

            console.warn(
                "[GEN-Z.AI] .provider-panel tidak ditemukan."
            );

            return null;
        }

        /*
         * Cari provider-empty.
         */

        container =
            panel.querySelector(
                ".provider-empty"
            );

        /*
         * Jika belum ada,
         * buat container baru.
         */

        if (!container) {

            container =
                document.createElement(
                    "div"
                );

            container.className =
                "provider-empty";

            panel.appendChild(
                container
            );
        }

        /*
         * Beri ID agar providers-ui.js
         * dapat menemukannya.
         */

        container.id =
            "providerList";

        container.style.width =
            "100%";

        container.style.position =
            "relative";

        container.style.zIndex =
            "2";

        return container;
    }


    // =========================================================
    // LOAD SCRIPT
    // =========================================================

    function loadScript(src) {

        return new Promise(
            function (resolve, reject) {

                const existing =
                    document.querySelector(
                        `script[data-genz-provider-module="${src}"]`
                    );

                /*
                 * Jika sudah dimuat,
                 * jangan load ulang.
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
                        function () {

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
                 * Buat script.
                 */

                const script =
                    document.createElement(
                        "script"
                    );

                script.src =
                    BASE_PATH + src;

                script.async =
                    false;

                script.dataset
                    .genzProviderModule =
                    src;


                script.addEventListener(
                    "load",
                    function () {

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
                    function () {

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
            }
        );
    }


    // =========================================================
    // LOAD ALL MODULES
    // =========================================================

    async function loadModules() {

        if (loadingPromise) {
            return loadingPromise;
        }

        loadingPromise =
            (async function () {

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

            loadingPromise =
                null;

            console.error(
                "[GEN-Z.AI] Provider modules gagal dimuat:",
                error
            );

            throw error;
        }
    }


    // =========================================================
    // INITIALIZE
    // =========================================================

    async function initialize() {

        /*
         * Pastikan DOM provider
         * disiapkan terlebih dahulu.
         */

        prepareProviderPage();


        /*
         * Load semua module.
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
         * Jalankan sistem provider.
         */

        return init.initialize();
    }


    // =========================================================
    // PUBLIC API
    // =========================================================

    window.GENZProvidersLoader =
        Object.freeze({

            loadModules,

            initialize

        });


    // =========================================================
    // AUTO INITIALIZE
    // =========================================================

    initialize()
        .catch(
            function (error) {

                console.error(
                    "[GEN-Z.AI] Gagal menginisialisasi Provider Control:",
                    error
                );

            }
        );

})();
