/* =========================================================
   GEN-Z.AI
   ADMIN MODEL MANAGEMENT
   MODULE LOADER

   File:
   admin-control/models/models-loader.js

   ARCHITECTURE:
   Data
   ↓
   Provider
   ↓
   Search
   ↓
   Form
   ↓
   Price
   ↓
   UI
   ↓
   Init

   FIX:
   - models-provider.js wajib dimuat
   - Module dimuat secara berurutan
   - Tidak menjalankan module sebelum dependency tersedia
   - Aman terhadap module yang terlambat
========================================================= */

(function () {
    "use strict";

    const MODULES = [
        "models-data.js",
        "models-provider.js",
        "models-search.js",
        "models-form.js",
        "models-price.js",
        "models-ui.js",
        "models-init.js"
    ];

    const BASE_PATH =
        "./models/";

    const loadedModules =
        new Set();

    let loadingPromise = null;

    /* =====================================================
       EXPECTED GLOBALS
    ===================================================== */

    const REQUIRED_GLOBALS = [
        "GENZModelsData",
        "GENZModelsProvider",
        "GENZModelsSearch",
        "GENZModelsForm",
        "GENZModelsPrice",
        "GENZModelsUI",
        "GENZModelsInit"
    ];

    /* =====================================================
       SCRIPT FINDER
    ===================================================== */

    function findExistingScript(
        src
    ) {

        const scripts =
            Array.from(
                document.scripts
            );

        return scripts.find(
            script => {

                const value =
                    String(
                        script.src || ""
                    );

                return (
                    value.endsWith(
                        src
                    ) ||
                    value.includes(
                        src
                    )
                );
            }
        );
    }

    /* =====================================================
       LOAD SCRIPT
    ===================================================== */

    function loadScript(
        filename
    ) {

        if (
            loadedModules.has(
                filename
            )
        ) {

            return Promise.resolve();

        }

        const existing =
            findExistingScript(
                filename
            );

        if (existing) {

            loadedModules.add(
                filename
            );

            return Promise.resolve();

        }

        return new Promise(
            (
                resolve,
                reject
            ) => {

                const script =
                    document.createElement(
                        "script"
                    );

                script.src =
                    BASE_PATH +
                    filename;

                script.async =
                    false;

                script.defer =
                    false;

                script.dataset
                    .genzModule =
                    filename;

                script.onload =
                    () => {

                        loadedModules.add(
                            filename
                        );

                        console.info(
                            "[models-loader] Loaded:",
                            filename
                        );

                        resolve();

                    };

                script.onerror =
                    error => {

                        console.error(
                            "[models-loader] Failed:",
                            filename,
                            error
                        );

                        reject(
                            new Error(
                                "Gagal memuat module: " +
                                filename
                            )
                        );

                    };

                document.head.appendChild(
                    script
                );
            }
        );
    }

    /* =====================================================
       VERIFY GLOBAL
    ===================================================== */

    function isGlobalReady(
        name
    ) {

        return Boolean(
            window[name]
        );
    }

    function getMissingModules() {

        return REQUIRED_GLOBALS.filter(
            name =>
                !isGlobalReady(
                    name
                )
        );
    }

    /* =====================================================
       WAIT FOR GLOBAL
    ===================================================== */

    function waitForGlobal(
        name,
        timeout = 10000
    ) {

        if (
            isGlobalReady(
                name
            )
        ) {

            return Promise.resolve(
                true
            );

        }

        return new Promise(
            (
                resolve,
                reject
            ) => {

                const started =
                    Date.now();

                const timer =
                    window.setInterval(
                        () => {

                            if (
                                isGlobalReady(
                                    name
                                )
                            ) {

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

                                reject(
                                    new Error(
                                        "Module global tidak tersedia: " +
                                        name
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
       LOAD ALL MODULES
    ===================================================== */

    async function loadAll() {

        if (loadingPromise) {
            return loadingPromise;
        }

        loadingPromise =
            (async () => {

                console.info(
                    "[models-loader] Memulai module loading..."
                );

                /*
                 * Load satu per satu.
                 *
                 * Jangan Promise.all().
                 *
                 * Karena urutan dependency penting.
                 */

                for (
                    const moduleName of
                    MODULES
                ) {

                    await loadScript(
                        moduleName
                    );

                    /*
                     * Beri browser kesempatan
                     * menjalankan script.
                     */
                    await new Promise(
                        resolve =>
                            setTimeout(
                                resolve,
                                0
                            )
                    );
                }

                /*
                 * Pastikan semua global
                 * benar-benar tersedia.
                 */
                for (
                    const globalName of
                    REQUIRED_GLOBALS
                ) {

                    await waitForGlobal(
                        globalName
                    );
                }

                console.info(
                    "[models-loader] Semua module tersedia."
                );

                console.info(
                    "[models-loader] Globals:",
                    REQUIRED_GLOBALS
                );

                /*
                 * Setelah seluruh module tersedia,
                 * jalankan initialization.
                 */
                if (
                    window.GENZModelsInit &&
                    typeof
                        window.GENZModelsInit
                            .initialize ===
                        "function"
                ) {

                    await window.GENZModelsInit.initialize();

                }

                return true;

            })()
                .catch(error => {

                    console.error(
                        "[models-loader] Initialization gagal:",
                        error
                    );

                    loadingPromise =
                        null;

                    throw error;

                });

        return loadingPromise;
    }

    /* =====================================================
       STATUS
    ===================================================== */

    function getLoadedModules() {

        return [
            ...loadedModules
        ];
    }

    function getStatus() {

        const missing =
            getMissingModules();

        return {
            modules:
                getLoadedModules(),

            required:
                [...MODULES],

            missing,

            ready:
                missing.length === 0
        };
    }

    /* =====================================================
       AUTO START
    ===================================================== */

    function autoStart() {

        if (
            document.readyState ===
            "loading"
        ) {

            document.addEventListener(
                "DOMContentLoaded",
                () => {

                    loadAll().catch(
                        error => {

                            console.error(
                                "[models-loader] Auto-start error:",
                                error
                            );

                        }
                    );

                },
                {
                    once: true
                }
            );

            return;
        }

        loadAll().catch(
            error => {

                console.error(
                    "[models-loader] Auto-start error:",
                    error
                );

            }
        );
    }

    /* =====================================================
       PUBLIC API
    ===================================================== */

    window.GENZModelsLoader =
        Object.freeze({

            loadAll,

            loadScript,

            waitForGlobal,

            getLoadedModules,

            getMissingModules,

            getStatus

        });

    /*
     * Jalankan loader.
     */
    autoStart();

})();
