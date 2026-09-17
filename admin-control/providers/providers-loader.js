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

    // Versi cache.
    // Setiap perubahan angka akan memaksa browser
    // mengambil JavaScript terbaru.
    const VERSION = "20260917-02";

    // =========================================================
    // CSS + NAVIGATION
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
            .provider-panel {
                position: relative !important;
                z-index: 1 !important;
                overflow: visible !important;
            }

            #providerList,
            #providersList,
            #providerPanel {
                position: relative !important;
                z-index: 2 !important;
                width: 100% !important;
                pointer-events: auto !important;
                overflow: visible !important;
            }

            .provider-card {
                position: relative !important;
                z-index: 3 !important;
                overflow: visible !important;
            }

            .provider-actions {
                position: relative !important;
                z-index: 20 !important;
                display: flex !important;
                flex-wrap: wrap !important;
                gap: 8px !important;
                margin-top: 18px !important;
                padding-top: 14px !important;
                pointer-events: auto !important;
                visibility: visible !important;
                opacity: 1 !important;
            }

            .provider-action-btn {
                position: relative !important;
                z-index: 21 !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                min-height: 40px !important;
                padding: 8px 14px !important;
                border-radius: 10px !important;
                cursor: pointer !important;
                pointer-events: auto !important;
                visibility: visible !important;
                opacity: 1 !important;
            }

            .provider-btn-edit {
                background: rgba(99,102,241,.25) !important;
                border: 1px solid rgba(99,102,241,.65) !important;
                color: #ffffff !important;
            }

            .provider-btn-success {
                background: rgba(34,197,94,.25) !important;
                border: 1px solid rgba(34,197,94,.65) !important;
                color: #ffffff !important;
            }

            .provider-btn-warning {
                background: rgba(245,158,11,.25) !important;
                border: 1px solid rgba(245,158,11,.65) !important;
                color: #ffffff !important;
            }

            .provider-btn-delete {
                background: rgba(239,68,68,.25) !important;
                border: 1px solid rgba(239,68,68,.65) !important;
                color: #ffffff !important;
            }

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

            .menu-overlay {
                z-index: 2900 !important;
            }

            .modal-backdrop {
                z-index: 2000 !important;
            }

            .modal-backdrop .modal,
            .modal-backdrop .modal-card,
            .modal-backdrop .provider-modal {
                position: relative !important;
                z-index: 2001 !important;
            }
        `;

        document.head.appendChild(style);
    }

    // =========================================================
    // PREPARE PAGE
    // =========================================================

    function prepareProviderPage() {
        installPageFixes();

        let container =
            document.getElementById("providerList") ||
            document.getElementById("providersList") ||
            document.getElementById("providerPanel");

        if (container) {
            return container;
        }

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

        container =
            panel.querySelector(
                ".provider-empty"
            );

        if (!container) {
            container =
                document.createElement("div");

            container.className =
                "provider-empty";

            panel.appendChild(container);
        }

        container.id =
            "providerList";

        container.style.width =
            "100%";

        container.style.position =
            "relative";

        container.style.zIndex =
            "2";

        container.style.overflow =
            "visible";

        return container;
    }

    // =========================================================
    // LOAD SCRIPT DENGAN CACHE BUSTING
    // =========================================================

    function loadScript(src) {
        return new Promise(
            function (resolve, reject) {

                const selector =
                    `script[data-genz-provider-module="${src}"]`;

                const existing =
                    document.querySelector(
                        selector
                    );

                if (existing) {
                    existing.remove();
                }

                const script =
                    document.createElement(
                        "script"
                    );

                /*
                 * Cache busting.
                 *
                 * Contoh:
                 * providers-ui.js?v=20260917-02
                 */
                script.src =
                    BASE_PATH +
                    src +
                    "?v=" +
                    VERSION;

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

                        console.log(
                            "[GEN-Z.AI] Module loaded:",
                            src
                        );

                        resolve();

                    },
                    {
                        once: true
                    }
                );

                script.addEventListener(
                    "error",
                    function () {

                        console.error(
                            "[GEN-Z.AI] Module gagal:",
                            src
                        );

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

        prepareProviderPage();

        await loadModules();

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
