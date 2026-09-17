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
    // PREPARE PROVIDER PAGE
    // =========================================================

    function prepareProviderPage() {
        /*
         * providers-ui.js mencari container:
         * - providerList
         * - providersList
         * - providerPanel
         *
         * providers.html saat ini menggunakan:
         * .provider-panel
         * .provider-empty
         *
         * Kita gunakan elemen yang sudah ada.
         */

        const list =
            document.getElementById("providerList") ||
            document.getElementById("providersList") ||
            document.getElementById("providerPanel");

        if (!list) {
            const emptyState =
                document.querySelector(
                    ".provider-panel .provider-empty"
                );

            if (emptyState) {
                emptyState.id = "providerList";
            }
        }

        // =====================================================
        // NAVIGATION FIX
        // =====================================================
        /*
         * Modal provider menggunakan z-index 1000.
         * Sidebar sebelumnya berada di bawah modal.
         *
         * Naikkan navigasi supaya tetap bisa diklik.
         */

        if (
            !document.getElementById(
                "genz-provider-navigation-fix"
            )
        ) {
            const style =
                document.createElement("style");

            style.id =
                "genz-provider-navigation-fix";

            style.textContent = `
                /* ==============================
                   PROVIDER NAVIGATION FIX
                   ============================== */

                .topbar {
                    z-index: 1200 !important;
                }

                .sidebar {
                    z-index: 1200 !important;
                }

                .menu-button,
                .back-button,
                .nav a,
                .nav button {
                    position: relative;
                    z-index: 1201 !important;
                }

                /* Pastikan sidebar tidak tertutup
                   backdrop modal */
                .sidebar.show {
                    z-index: 1200 !important;
                }

                /* Tombol menu tetap aktif */
                .menu-button {
                    pointer-events: auto !important;
                }

                /* Link navigasi tetap aktif */
                .nav a {
                    pointer-events: auto !important;
                    cursor: pointer !important;
                }

                /* Tombol navigasi tetap aktif */
                .nav button {
                    pointer-events: auto !important;
                    cursor: pointer !important;
                }
            `;

            document.head.appendChild(style);
        }
    }

    // =========================================================
    // LOAD SCRIPT
    // =========================================================

    function loadScript(src) {
        return new Promise(
            (resolve, reject) => {
                const existing =
                    document.querySelector(
                        `script[data-genz-provider-module="${src}"]`
                    );

                /*
                 * Jika module sudah ada
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
                 * Buat script module
                 */
                const script =
                    document.createElement(
                        "script"
                    );

                script.src =
                    BASE_PATH + src;

                script.async = false;

                script.dataset
                    .genzProviderModule =
                    src;

                /*
                 * Berhasil dimuat
                 */
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

                /*
                 * Gagal dimuat
                 */
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

    // =========================================================
    // INITIALIZE
    // =========================================================

    async function initialize() {

        /*
         * Siapkan halaman terlebih dahulu
         */
        prepareProviderPage();

        /*
         * Load seluruh module provider
         */
        await loadModules();

        /*
         * Ambil initializer
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
         * Jalankan provider system
         */
        return init.initialize();
    }

    // =========================================================
    // GLOBAL API
    // =========================================================

    window.GENZProvidersLoader =
        Object.freeze({
            loadModules,
            initialize
        });

    // =========================================================
    // AUTO INITIALIZE
    // =========================================================

    initialize().catch(
        error => {
            console.error(
                "Gagal menginisialisasi Provider Control:",
                error
            );
        }
    );

})();
