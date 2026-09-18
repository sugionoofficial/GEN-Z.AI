/* =========================================================
   GEN-Z.AI
   MODELS MODULE LOADER

   File:
   admin-control/models/models-loader.js

   TANGGUNG JAWAB:
   - Memuat seluruh module Models
   - Menjamin urutan dependency
   - Mencegah duplicate script
   - Memverifikasi global module
   - Menjalankan GENZModelsInit
   - Menjadi satu-satunya entry point Models
   ========================================================= */

(function () {
    "use strict";

    /* =====================================================
       CONFIG
    ===================================================== */

    const BASE_PATH = "./models/";

    const MODULES = [

        /* =================================================
           1. DATA
        ================================================= */

        "models-data.js",

        /* =================================================
           2. PROVIDER CORE
        ================================================= */

        "models-provider.js",

        /* =================================================
           3. MODEL SEARCH FUNCTIONS
        ================================================= */

        "functions/model-search-dropdown.js",
        "functions/model-search-render.js",
        "functions/model-search-select.js",
        "functions/model-search-events.js",

        /* =================================================
           4. MODEL SEARCH COORDINATOR
        ================================================= */

        "models-search.js",

        /* =================================================
           5. PROVIDER DROPDOWN
        ================================================= */

        "functions/model-provider-dropdown.js",

        /* =================================================
           6. FORM FUNCTIONS
        ================================================= */

        "functions/model-form-create.js",
        "functions/model-form-edit.js",
        "functions/model-form-delete.js",
        "functions/model-form-coordinator.js",
        "functions/model-form-events.js",

        /* =================================================
           7. PRICE
        ================================================= */

        "functions/model-price-calculation.js",
        "models-price.js",

        /* =================================================
           8. TABLE
        ================================================= */

        "functions/model-table.js",
        "functions/model-table-events.js",

        /* =================================================
           9. FORM COORDINATOR
        ================================================= */

        "models-form.js",

        /* =================================================
           10. UI
        ================================================= */

        "models-ui.js",

        /* =================================================
           11. INITIALIZATION
        ================================================= */

        "models-init.js"
    ];

    /* =====================================================
       STATE
    ===================================================== */

    const loadedModules = new Map();

    let loadingPromise = null;

    let started = false;

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

    function moduleGlobalReady(module) {

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
       WAIT GLOBAL
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
       LOAD EXISTING SCRIPT
    ===================================================== */

    function waitExistingScript(
        script,
        module
    ) {

        return new Promise(
            function (
                resolve,
                reject
            ) {

                let finished =
                    false;

                function finish() {

                    if (finished) {
                        return;
                    }

                    finished = true;

                    resolve(
                        module
                    );
                }

                function fail() {

                    if (finished) {
                        return;
                    }

                    finished = true;

                    reject(
                        new Error(
                            "Gagal memuat module: " +
                            module
                        )
                    );
                }

                /*
                 * Jika global sudah tersedia,
                 * script sebenarnya sudah selesai.
                 */

                if (
                    moduleGlobalReady(
                        module
                    )
                ) {

                    finish();

                    return;
                }

                script.addEventListener(
                    "load",
                    function () {

                        waitForGlobal(
                            module
                        )
                            .then(
                                finish
                            )
                            .catch(
                                reject
                            );
                    },
                    {
                        once: true
                    }
                );

                script.addEventListener(
                    "error",
                    fail,
                    {
                        once: true
                    }
                );

                /*
                 * Fallback untuk script yang
                 * sudah selesai sebelum listener
                 * dipasang.
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
                    100
                );
            }
        );
    }

    /* =====================================================
       LOAD ONE SCRIPT
    ===================================================== */

    function loadScript(module) {

        /*
         * Sudah dimuat oleh loader.
         */

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

        /*
         * Cek apakah script sudah ada
         * di HTML.
         */

        const existing =
            getScript(src);

        if (existing) {

            const promise =
                waitExistingScript(
                    existing,
                    module
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

                    /*
                     * Loader sendiri mengatur
                     * urutan sehingga tidak perlu
                     * async.
                     */

                    script.async =
                        false;

                    script.dataset.genzModule =
                        module;

                    script.onload =
                        function () {

                            waitForGlobal(
                                module
                            )
                                .then(
                                    function () {

                                        resolve(
                                            module
                                        );
                                    }
                                )
                                .catch(
                                    reject
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
       LOAD ALL MODULES
    ===================================================== */

    async function loadAll() {

        if (loadingPromise) {

            return loadingPromise;
        }

        loadingPromise =
            (async function () {

                log(
                    "========================================"
                );

                log(
                    "Memulai Models Module Loader"
                );

                log(
                    "Total module:",
                    MODULES.length
                );

                log(
                    "========================================"
                );

                for (
                    let index = 0;
                    index < MODULES.length;
                    index++
                ) {

                    const module =
                        MODULES[index];

                    log(
                        "[" +
                        (index + 1) +
                        "/" +
                        MODULES.length +
                        "] Loading:",
                        module
                    );

                    await loadScript(
                        module
                    );

                    /*
                     * Validasi akhir.
                     */

                    if (
                        !moduleGlobalReady(
                            module
                        )
                    ) {

                        throw new Error(
                            "Module loaded tetapi global tidak tersedia: " +
                            module
                        );
                    }

                    log(
                        "[" +
                        (index + 1) +
                        "/" +
                        MODULES.length +
                        "] Loaded:",
                        module
                    );
                }

                log(
                    "========================================"
                );

                log(
                    "Semua Models module berhasil dimuat."
                );

                log(
                    "========================================"
                );

                return true;

            })()
                .catch(
                    function (
                        loadError
                    ) {

                        error(
                            "Models module loader gagal:",
                            loadError
                        );

                        showLoaderError(
                            loadError
                        );

                        /*
                         * Izinkan retry.
                         */

                        loadingPromise =
                            null;

                        throw loadError;
                    }
                );

        return loadingPromise;
    }

    /* =====================================================
       START
    ===================================================== */

    async function start() {

        /*
         * Jangan start dua kali.
         */

        if (started) {

            warn(
                "Models loader sudah dijalankan."
            );

            return true;
        }

        started = true;

        try {

            /* =============================================
               STEP 1
               Load semua module.
            ============================================= */

            await loadAll();

            /* =============================================
               STEP 2
               Pastikan Init tersedia.
            ============================================= */

            const init =
                window.GENZModelsInit;

            if (!init) {

                throw new Error(
                    "GENZModelsInit belum tersedia."
                );
            }

            if (
                typeof init.initialize !==
                "function"
            ) {

                throw new Error(
                    "GENZModelsInit.initialize() belum tersedia."
                );
            }

            /* =============================================
               STEP 3
               Jalankan lifecycle Models.
            ============================================= */

            const result =
                await init.initialize();

            if (result === false) {

                throw new Error(
                    "GENZModelsInit.initialize() gagal."
                );
            }

            log(
                "========================================"
            );

            log(
                "GEN-Z.AI Models berhasil dijalankan."
            );

            log(
                "========================================"
            );

            return true;

        } catch (startError) {

            error(
                "Models gagal dijalankan:",
                startError
            );

            showLoaderError(
                startError
            );

            started = false;

            return false;
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
            "Gagal memuat halaman Models.";

        const alertBox =
            document.getElementById(
                "alertBox"
            );

        if (alertBox) {

            alertBox.textContent =
                message;

            alertBox.className =
                "alert alert-error show";

            alertBox.style.display =
                "block";

            return;
        }

        error(
            message
        );
    }

    /* =====================================================
       RESET
    ===================================================== */

    function reset() {

        started = false;

        loadingPromise = null;

        loadedModules.clear();

        if (
            window.GENZModelsInit &&
            typeof
                window.GENZModelsInit.reset ===
                "function"
        ) {

            try {

                window.GENZModelsInit.reset();

            } catch (resetError) {

                warn(
                    "Models Init reset gagal:",
                    resetError
                );
            }
        }

        log(
            "Models loader reset."
        );
    }

    /* =====================================================
       PUBLIC API
    ===================================================== */

    window.GENZModelsLoader =
        Object.freeze({

            loadAll,

            start,

            reset,

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
                },

            isStarted:
                function () {

                    return started;
                },

            isLoading:
                function () {

                    return (
                        !!loadingPromise
                    );
                }
        });

    /* =====================================================
       DOM READY
    ===================================================== */

    function boot() {

        start();
    }

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            boot,
            {
                once: true
            }
        );

    } else {

        boot();
    }

})();
