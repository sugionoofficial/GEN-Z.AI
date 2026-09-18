/* =========================================================
   GEN-Z.AI
   MODELS MODULE LOADER
   ---------------------------------------------------------
   Tanggung jawab:
   - Memuat seluruh module Models
   - Menjamin urutan dependency
   - Menunggu global module tersedia
   - Menjalankan GENZModelsInit
   ---------------------------------------------------------
   File:
   admin-control/models/models-loader.js
   ========================================================= */

(function () {
    "use strict";

    const BASE_PATH = "./models/";

    /*
     * Urutan sangat penting.
     *
     * 1. Data
     * 2. Provider
     * 3. Function modules
     * 4. Search coordinator
     * 5. Form / Price / UI
     * 6. Init terakhir
     */

    const MODULES = [
    "models-data.js",
    "models-provider.js",

    "functions/model-search-dropdown.js",
    "functions/model-search-render.js",
    "functions/model-search-select.js",
    "functions/model-search-events.js",
    "models-search.js",

    "functions/model-provider-dropdown.js",

    "functions/model-form-create.js",
    "functions/model-form-edit.js",
    "functions/model-form-delete.js",
    "functions/model-form-coordinator.js",
    "functions/model-form-events.js",

    "functions/model-price-calculation.js",
    "models-price.js",

    "functions/model-table.js",
    "functions/model-table-events.js",

    "models-form.js",
    "models-ui.js",
    "models-init.js"
];

    const loadedModules =
        new Map();

    let loadingPromise = null;

    /* =====================================================
       LOG
    ===================================================== */

    function log() {
        console.log.apply(
            console,
            [
                "[GEN-Z Models]",
                ...arguments
            ]
        );
    }

    function warn() {
        console.warn.apply(
            console,
            [
                "[GEN-Z Models]",
                ...arguments
            ]
        );
    }

    function error() {
        console.error.apply(
            console,
            [
                "[GEN-Z Models]",
                ...arguments
            ]
        );
    }

    /* =====================================================
       SCRIPT ELEMENT
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
                        script
                            .getAttribute(
                                "src"
                            );

                    if (!current) {
                        return false;
                    }

                    return (
                        current === src ||
                        current.endsWith(
                            src
                        )
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

            case "models-data.js":
                return !!(
                    window.GENZModelsData
                );

            case "models-provider.js":
                return !!(
                    window.GENZModelsProvider
                );

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

            case "functions/model-provider-dropdown.js":
                return !!(
                    window.GENZModelProviderDropdown
                );

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

            case "functions/model-price-calculation.js":
                return !!(
                    window.GENZModelPriceCalculation
                );

            case "models-price.js":
                return !!(
                    window.GENZModelsPrice
                );

            case "functions/model-table.js":
                return !!(
                    window.GENZModelTable
                );

            case "models-form.js":
                return !!(
                    window.GENZModelsForm
                );

            case "models-ui.js":
                return !!(
                    window.GENZModelsUI
                );

            case "models-init.js":
                return !!(
                    window.GENZModelsInit
                );

            default:
                return true;
        }
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
            BASE_PATH + module;

        const existing =
            getScript(src);

        /*
         * Script sudah ada di HTML.
         */
        if (existing) {

            const promise =
                new Promise(
                    function (
                        resolve,
                        reject
                    ) {

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

                        let finished =
                            false;

                        const finish =
                            function () {

                                if (
                                    finished
                                ) {
                                    return;
                                }

                                finished =
                                    true;

                                if (
                                    moduleGlobalReady(
                                        module
                                    )
                                ) {
                                    resolve(
                                        module
                                    );
                                } else {
                                    reject(
                                        new Error(
                                            "Global module tidak tersedia setelah load: " +
                                            module
                                        )
                                    );
                                }
                            };

                        existing.addEventListener(
                            "load",
                            finish,
                            {
                                once: true
                            }
                        );

                        existing.addEventListener(
                            "error",
                            function () {

                                if (
                                    finished
                                ) {
                                    return;
                                }

                                finished =
                                    true;

                                reject(
                                    new Error(
                                        "Gagal memuat: " +
                                        module
                                    )
                                );
                            },
                            {
                                once: true
                            }
                        );

                        /*
                         * Fallback untuk script yang
                         * sudah selesai load sebelum
                         * listener dipasang.
                         */
                        window.setTimeout(
                            finish,
                            50
                        );
                    }
                );

            loadedModules.set(
                module,
                promise
            );

            return promise;
        }

        /*
         * Buat script baru.
         */

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

                    script.async =
                        false;

                    script.dataset.genzModule =
                        module;

                    script.onload =
                        function () {

                            if (
                                !moduleGlobalReady(
                                    module
                                )
                            ) {
                                reject(
                                    new Error(
                                        "Global module tidak tersedia setelah load: " +
                                        module
                                    )
                                );

                                return;
                            }

                            resolve(
                                module
                            );
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
                function (loadError) {

                    error(
                        loadError
                    );

                    showLoaderError(
                        loadError
                    );

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
                    window.GENZModelsInit
                        .initialize !==
                    "function"
            ) {
                throw new Error(
                    "GENZModelsInit.initialize() belum tersedia."
                );
            }

            await window.GENZModelsInit
                .initialize();

            log(
                "Models berhasil diinisialisasi."
            );

        } catch (startError) {

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

        console.error(
            "[GEN-Z Models]",
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
