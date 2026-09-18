/* =========================================================
   GEN-Z.AI
   ADMIN MODEL MANAGEMENT
   INITIALIZATION MODULE

   File:
   admin-control/models/models-init.js

   URUTAN:
   1. Data
   2. Provider
   3. UI
   4. Form
   5. Search
   6. Price

   FIX:
   - Provider diinisialisasi secara eksplisit
   - Provider siap sebelum UI
   - UI tidak mengambil alih Provider
   - Search menerima catalog setelah model selesai dimuat
   - Aman jika module datang terlambat
   - Tidak initialize berkali-kali
========================================================= */

(function () {
    "use strict";

    let initialized =
        false;

    let initializing =
        null;

    /* =====================================================
       MODULE ACCESS
    ===================================================== */

    function getData() {
        return window.GENZModelsData || null;
    }

    function getProvider() {
        return window.GENZModelsProvider || null;
    }

    function getSearch() {
        return window.GENZModelsSearch || null;
    }

    function getForm() {
        return window.GENZModelsForm || null;
    }

    function getPrice() {
        return window.GENZModelsPrice || null;
    }

    function getUI() {
        return window.GENZModelsUI || null;
    }

    /* =====================================================
       WAIT FOR MODULES
    ===================================================== */

    function waitForModules(
        timeout = 15000
    ) {

        const started =
            Date.now();

        return new Promise(
            (
                resolve,
                reject
            ) => {

                const timer =
                    window.setInterval(
                        () => {

                            const ready =
                                Boolean(
                                    getData() &&
                                    getProvider() &&
                                    getSearch() &&
                                    getForm() &&
                                    getPrice() &&
                                    getUI()
                                );

                            if (ready) {

                                window.clearInterval(
                                    timer
                                );

                                resolve(
                                    true
                                );

                                return;
                            }

                            if (
                                Date.now() -
                                    started >=
                                timeout
                            ) {

                                window.clearInterval(
                                    timer
                                );

                                const missing =
                                    [];

                                if (!getData()) {
                                    missing.push(
                                        "GENZModelsData"
                                    );
                                }

                                if (!getProvider()) {
                                    missing.push(
                                        "GENZModelsProvider"
                                    );
                                }

                                if (!getSearch()) {
                                    missing.push(
                                        "GENZModelsSearch"
                                    );
                                }

                                if (!getForm()) {
                                    missing.push(
                                        "GENZModelsForm"
                                    );
                                }

                                if (!getPrice()) {
                                    missing.push(
                                        "GENZModelsPrice"
                                    );
                                }

                                if (!getUI()) {
                                    missing.push(
                                        "GENZModelsUI"
                                    );
                                }

                                reject(
                                    new Error(
                                        "Module belum siap: " +
                                        missing.join(
                                            ", "
                                        )
                                    )
                                );
                            }

                        },
                        50
                    );
            }
        );
    }

    /* =====================================================
       INITIALIZE PROVIDER
    ===================================================== */

    async function initializeProvider() {

        const provider =
            getProvider();

        if (
            !provider
        ) {

            throw new Error(
                "GENZModelsProvider belum tersedia."
            );

        }

        console.info(
            "[models-init] Provider initialization..."
        );

        /*
         * Provider module wajib initialize
         * sebelum UI.
         */
        if (
            typeof provider.initialize ===
                "function"
        ) {

            await provider.initialize();

        } else if (
            typeof provider.loadProviders ===
                "function"
        ) {

            await provider.loadProviders({
                force: false,
                activeOnly: true
            });

        } else {

            throw new Error(
                "GENZModelsProvider tidak memiliki initialize/loadProviders."
            );

        }

        console.info(
            "[models-init] Provider READY."
        );

        return true;
    }

    /* =====================================================
       INITIALIZE UI
    ===================================================== */

    async function initializeUI() {

        const ui =
            getUI();

        if (
            !ui ||
            typeof ui.initialize !==
                "function"
        ) {

            throw new Error(
                "GENZModelsUI belum tersedia."
            );

        }

        console.info(
            "[models-init] UI initialization..."
        );

        await ui.initialize();

        console.info(
            "[models-init] UI READY."
        );

        return true;
    }

    /* =====================================================
       FULL INITIALIZATION
    ===================================================== */

    async function initialize() {

        if (initialized) {
            return true;
        }

        if (initializing) {
            return initializing;
        }

        initializing =
            (async () => {

                try {

                    console.info(
                        "[models-init] Menunggu semua module..."
                    );

                    await waitForModules();

                    console.info(
                        "[models-init] Semua module tersedia."
                    );

                    /* =========================================
                       STEP 1
                       PROVIDER
                    ========================================= */

                    await initializeProvider();

                    /* =========================================
                       STEP 2
                       UI
                    ========================================= */

                    await initializeUI();

                    /*
                     * Provider harus tetap sinkron
                     * setelah UI selesai.
                     */
                    const provider =
                        getProvider();

                    const ui =
                        getUI();

                    if (
                        provider &&
                        ui
                    ) {

                        if (
                            typeof provider.getProviders ===
                                "function" &&
                            typeof ui.populateProviderSelect ===
                                "function"
                        ) {

                            const providers =
                                provider.getProviders();

                            if (
                                Array.isArray(
                                    providers
                                )
                            ) {

                                ui.populateProviderSelect(
                                    providers
                                );

                            }
                        }
                    }

                    initialized =
                        true;

                    console.info(
                        "[models-init] GEN-Z.AI Models READY."
                    );

                    window.dispatchEvent(
                        new CustomEvent(
                            "genz-models-init-ready"
                        )
                    );

                    return true;

                } catch (error) {

                    initialized =
                        false;

                    console.error(
                        "[models-init] Initialization error:",
                        error
                    );

                    window.dispatchEvent(
                        new CustomEvent(
                            "genz-models-init-error",
                            {
                                detail:
                                    error
                            }
                        )
                    );

                    throw error;

                } finally {

                    initializing =
                        null;

                }

            })();

        return initializing;
    }

    /* =====================================================
       STATUS
    ===================================================== */

    function isInitialized() {

        return initialized;
    }

    /* =====================================================
       PUBLIC API
    ===================================================== */

    window.GENZModelsInit =
        Object.freeze({

            initialize,

            initializeProvider,

            initializeUI,

            waitForModules,

            isInitialized

        });

})();
