/* =========================================================
   GEN-Z.AI
   MODELS MODULE LOADER

   File:
   admin-control/models/models-loader.js

   Tanggung jawab:
   - Memuat seluruh module Models
   - Menjamin urutan dependency
   - Menunggu global module tersedia
   - Menjalankan GENZModelsInit
   - Mencegah module berjalan sebelum dependency siap
========================================================= */

(function () {
    "use strict";

    const BASE_PATH = "./models/";

    /* =====================================================
       MODULE ORDER

       Urutan dependency:

       1. Data
       2. Provider

       3. Search function modules
       4. Search coordinator

       5. Provider function

       6. Form function modules
       7. Form events

       8. Price
       9. Table
       10. Table events

       11. Legacy compatibility modules
       12. UI
       13. Init
    ===================================================== */

    const MODULES = [
        "models-data.js",
        "models-provider.js",

        /* SEARCH */
        "functions/model-search-dropdown.js",
        "functions/model-search-render.js",
        "functions/model-search-select.js",
        "functions/model-search-events.js",
        "models-search.js",

        /* PROVIDER */
        "functions/model-provider-dropdown.js",

        /* FORM */
        "functions/model-form-create.js",
        "functions/model-form-edit.js",
        "functions/model-form-delete.js",
        "functions/model-form-coordinator.js",
        "functions/model-form-events.js",

        /* PRICE */
        "functions/model-price-calculation.js",
        "models-price.js",

        /* TABLE */
        "functions/model-table.js",
        "functions/model-table-events.js",

        /* COMPATIBILITY / COORDINATION */
        "models-form.js",
        "models-ui.js",
        "models-init.js"
    ];

    const loadedModules =
        new Map();

    let loadingPromise = null;

    /* =====================================================
       LOGGING
    ===================================================== */

    function log() {
        console.log(
            "[GEN-Z Models]",
            ...arguments
        );
    }

    function warn() {
        console.warn(
            "[GEN-Z Models]",
            ...arguments
        );
    }

    function error() {
        console.error(
            "[GEN-Z Models]",
            ...arguments
        );
    }

    /* =====================================================
       SCRIPT LOOKUP
    ===================================================== */

    function getScript(src) {
        const scripts =
            Array.from(
                document.scripts
            );

        return (
            scripts.find(
                function (script) {
                    const current =
                        script.getAttribute(
                            "src"
                        );

                    if (!current) {
                        return false;
                    }

                    return (
                        current === src ||
                        current.endsWith(src)
                    );
                }
            ) || null
        );
    }

    /* =====================================================
       GLOBAL MODULE CHECK
    ===================================================== */

    function moduleGlobalReady(
        module
    ) {
        switch (module) {

            /* =============================================
               DATA
            ============================================= */

            case "models-data.js":
                return !!(
                    window.GENZModelsData
                );

            /* =============================================
               PROVIDER
            ============================================= */

            case "models-provider.js":
                return !!(
                    window.GENZModelsProvider
                );

            case "functions/model-provider-dropdown.js":
                return !!(
                    window.GENZModelProviderDropdown
                );

            /* =============================================
               SEARCH
            ============================================= */

            case "functions/model-search-dropdown.js":
                return !!(
                    window.GENZModelSearchDropdown
                );

            case "functions/model-search-render.js":
                return !!(
                    window.GENZModelSearchRender
                );

            case "functions/model-search-select.js":
                return !!(
                    window.GENZModelSearchSelect
                );

            case "functions/model-search-events.js":
                return !!(
                    window.GENZModelSearchEvents
                );

            case "models-search.js":
                return !!(
                    window.GENZModelsSearch
                );

            /* =============================================
               FORM
            ============================================= */

            case "functions/model-form-create.js":
                return !!(
                    window.GENZModelFormCreate
                );

            case "functions/model-form-edit.js":
                return !!(
                    window.GENZModelFormEdit
                );

            case "functions/model-form-delete.js":
                return !!(
                    window.GENZModelFormDelete
                );

            case "functions/model-form-coordinator.js":
                return !!(
                    window.GENZModelFormCoordinator
                );

            case "functions/model-form-events.js":
                return !!(
                    window.GENZModelFormEvents
                );

            case "models-form.js":
                return !!(
                    window.GENZModelsForm
                );

            /* =============================================
               PRICE
            ============================================= */

            case "functions/model-price-calculation.js":
                return !!(
                    window.GENZModelPriceCalculation
                );

            case "models-price.js":
                return !!(
                    window.GENZModelsPrice
                );

            /* =============================================
               TABLE
            ============================================= */

            case "functions/model-table.js":
                return !!(
                    window.GENZModelTable
                );

            case "functions/model-table-events.js":
                return !!(
                    window.GENZModelTableEvents
                );

            /* =============================================
               UI
            ============================================= */

            case "models-ui.js":
                return !!(
                    window.GENZModelsUI
                );

            /* =============================================
               INIT
            ============================================= */

            case "models-init.js":
                return !!(
                    window.GENZModelsInit
                );

            default:
                return false;
        }
    }

    /* =====================================================
       WAIT FOR GLOBAL
    ===================================================== */

    function waitForGlobal(
        module,
        timeout = 10000
    ) {
        return new Promise(
            function (
                resolve,
                reject
            ) {
                const start =
                    Date.now();

                function check() {

                    if (
                        moduleGlobalReady(
                            module
                        )
                    ) {
                        resolve(
                            module
                        );

                        return;
                    }

                    if (
                        Date.now() -
                            start >=
                        timeout
                    ) {
                        reject(
                            new Error(
                                "Global module tidak tersedia: " +
                                module
                            )
                        );

                        return;
                    }

                    window.setTimeout(
                        check,
                        25
                    );
                }

                check();
            }
        );
    }

    /* =====================================================
       LOAD ONE SCRIPT
    ===================================================== */

    function loadScript(
        module
    ) {
        if (
            loadedModules.has(
                module
            )
        ) {
            return loadedModules.get(
                module
            );
        }

        const src =
            BASE_PATH +
            module;

        const existing =
            getScript(src);

        /* =============================================
           SCRIPT SUDAH ADA
        ============================================= */

        if (existing) {

            const promise =
                (async function () {

                    /*
                     * Jika global sudah tersedia,
                     * tidak perlu menunggu event load.
                     */
                    if (
                        moduleGlobalReady(
                            module
                        )
                    ) {
                        return module;
                    }

                    /*
                     * Tunggu script load.
                     */
                    await new Promise(
                        function (
                            resolve,
                            reject
                        ) {
                            let finished =
                                false;

                            function finish() {
                                if (
                                    finished
                                ) {
                                    return;
                                }

                                finished =
                                    true;

                                resolve();
                            }

                            function fail(
                                event
                            ) {
                                if (
                                    finished
                                ) {
                                    return;
                                }

                                finished =
                                    true;

                                reject(
                                    new Error(
                                        "Gagal memuat module: " +
                                        module
                                    )
                                );
                            }

                            existing.addEventListener(
                                "load",
                                finish,
                                {
                                    once: true
                                }
                            );

                            existing.addEventListener(
                                "error",
                                fail,
                                {
                                    once: true
                                }
                            );

                            /*
                             * Script mungkin sudah selesai
                             * sebelum listener dipasang.
                             */
                            window.setTimeout(
                                function () {
                                    if (
                                        moduleGlobalReady(
                                            module
                                        )
                                    ) {
                                        finish();
                                    }
                                },
                                50
                            );
                        }
                    );

                    /*
                     * Jangan percaya event load saja.
                     * Pastikan global benar-benar ada.
                     */
                    await waitForGlobal(
                        module
                    );

                    return module;

                })();

            loadedModules.set(
                module,
                promise
            );

            return promise;
        }

        /* =============================================
           CREATE SCRIPT
        ============================================= */

        const promise =
            new Promise(
                function (
                    resolve,
                    reject
                ) {
                    const script =
                        document.createElement(
                            "script"
                        );

                    script.src =
                        src;

                    /*
                     * Tetap serial.
                     * Loader sendiri menentukan urutan.
                     */
                    script.async =
                        false;

                    script.dataset.genzModule =
                        module;

                    script.onload =
                        async function () {

                            try {

                                await waitForGlobal(
                                    module
                                );

                                resolve(
                                    module
                                );

                            } catch (
                                loadError
                            ) {

                                reject(
                                    loadError
                                );
                            }
                        };

                    script.onerror =
                        function () {

                            reject(
                                new Error(
                                    "Gagal memuat module: " +
                                    module
                                )
                            );
                        };

                    document.head.appendChild(
                        script
                    );
                }
            );

        loadedModules.set(
            module,
            promise
        );

        return promise;
    }

    /* =====================================================
       LOAD ALL
    ===================================================== */

    async function loadAll() {

        if (loadingPromise) {
            return loadingPromise;
        }

        loadingPromise =
            (async function () {

                log(
                    "Memulai module loader..."
                );

                for (
                    const module
                    of MODULES
                ) {

                    log(
                        "Loading:",
                        module
                    );

                    await loadScript(
                        module
                    );

                    log(
                        "Loaded:",
                        module
                    );
                }

                log(
                    "Semua module berhasil dimuat."
                );

                return true;

            })()
            .catch(
                function (
                    loadError
                ) {

                    error(
                        loadError
                    );

                    showLoaderError(
                        loadError
                    );

                    /*
                     * Agar bisa dicoba kembali
                     * setelah error.
                     */
                    loadingPromise =
                        null;

                    throw loadError;
                }
            );

        return loadingPromise;
    }

    /* =====================================================
       START APPLICATION
    ===================================================== */

    async function start() {

        try {

            await loadAll();

            if (
                !window.GENZModelsInit
            ) {
                throw new Error(
                    "GENZModelsInit belum tersedia."
                );
            }

            if (
                typeof
                    window
                        .GENZModelsInit
                        .initialize !==
                    "function"
            ) {
                throw new Error(
                    "GENZModelsInit.initialize() belum tersedia."
                );
            }

            await window
                .GENZModelsInit
                .initialize();

            log(
                "Models berhasil diinisialisasi."
            );

        } catch (
            startError
        ) {

            error(
                "Models gagal diinisialisasi:",
                startError
            );

            showLoaderError(
                startError
            );
        }
    }

    /* =====================================================
       ERROR UI
    ===================================================== */

    function showLoaderError(
        loadError
    ) {

        const message =
            loadError?.message ||
            "Gagal memuat Models.";

        const alertBox =
            document.getElementById(
                "alertBox"
            );

        if (alertBox) {

            alertBox.textContent =
                message;

            alertBox.className =
                "alert error";

            alertBox.style.display =
                "block";

            return;
        }

        error(
            message
        );
    }

    /* =====================================================
       PUBLIC API
    ===================================================== */

    window.GENZModelsLoader =
        Object.freeze({

            loadAll,

            start,

            getLoadedModules:
                function () {
                    return Array.from(
                        loadedModules.keys()
                    );
                },

            isModuleLoaded:
                function (
                    module
                ) {
                    return (
                        loadedModules.has(
                            module
                        ) &&
                        moduleGlobalReady(
                            module
                        )
                    );
                },

            getModules:
                function () {
                    return [
                        ...MODULES
                    ];
                }
        });

    /* =====================================================
       DOM READY
    ===================================================== */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            start,
            {
                once: true
            }
        );

    } else {

        start();

    }

})();
