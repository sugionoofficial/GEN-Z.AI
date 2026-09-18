/* =========================================================
   GEN-Z.AI
   MODELS MODULE LOADER

   File:
   admin-control/models/models-loader.js

   TANGGUNG JAWAB:
   - Memuat seluruh module Models
   - Menjamin dependency order
   - Mencegah duplicate script
   - Memverifikasi global module
   - Menjalankan GENZModelsInit

   CATATAN:
   models-loader.js hanya bertugas sebagai LOADER.
   Tidak boleh mengandung logic Provider,
   Search, Form, Pricing, atau Table.
========================================================= */

(function () {
    "use strict";

    /* =====================================================
       CONFIG
    ===================================================== */

    const BASE_PATH =
        "./models/";

    const FUNCTION_PATH =
        "./models/functions/";

    /*
     * Urutan sangat penting.
     *
     * Pricing harus dimuat sebelum
     * model-form-layout.js karena layout
     * menggunakan GENZModelsPrice.
     */
    const MODULES = [
        /*
         * DATA
         */
        {
            src:
                BASE_PATH +
                "models-data.js",

            global:
                "GENZModelsData"
        },

        /*
         * PROVIDER
         */
        {
            src:
                BASE_PATH +
                "models-provider.js",

            global:
                "GENZModelsProvider"
        },

        /*
         * PRICE
         *
         * Harus sebelum form layout.
         */
        {
            src:
                BASE_PATH +
                "models-price.js",

            global:
                "GENZModelsPrice"
        },

        {
            src:
                FUNCTION_PATH +
                "model-price-calculation.js",

            global:
                "GENZModelPriceCalculation"
        },

        /*
         * PROVIDER DROPDOWN
         */
        {
            src:
                FUNCTION_PATH +
                "model-provider-dropdown.js",

            global:
                "GENZModelProviderDropdown"
        },

        /*
         * MODEL FORM LAYOUT
         */
        {
            src:
                FUNCTION_PATH +
                "model-form-layout.js",

            global:
                "GENZModelFormLayout"
        },

        /*
         * FORM CRUD
         */
        {
            src:
                FUNCTION_PATH +
                "model-form-create.js",

            global:
                "GENZModelFormCreate"
        },

        {
            src:
                FUNCTION_PATH +
                "model-form-edit.js",

            global:
                "GENZModelFormEdit"
        },

        {
            src:
                FUNCTION_PATH +
                "model-form-delete.js",

            global:
                "GENZModelFormDelete"
        },

        {
            src:
                FUNCTION_PATH +
                "model-form-coordinator.js",

            global:
                "GENZModelFormCoordinator"
        },

        {
            src:
                FUNCTION_PATH +
                "model-form-events.js",

            global:
                "GENZModelFormEvents"
        },

        /*
         * SEARCH
         */
        {
            src:
                FUNCTION_PATH +
                "model-search-dropdown.js",

            global:
                "GENZModelSearchDropdown"
        },

        {
            src:
                FUNCTION_PATH +
                "model-search-render.js",

            global:
                "GENZModelSearchRender"
        },

        {
            src:
                FUNCTION_PATH +
                "model-search-select.js",

            global:
                "GENZModelSearchSelect"
        },

        {
            src:
                FUNCTION_PATH +
                "model-search-events.js",

            global:
                "GENZModelSearchEvents"
        },

        {
            src:
                BASE_PATH +
                "models-search.js",

            global:
                "GENZModelsSearch"
        },

        /*
         * TABLE
         */
        {
            src:
                FUNCTION_PATH +
                "model-table.js",

            global:
                "GENZModelTable"
        },

        {
            src:
                FUNCTION_PATH +
                "model-table-events.js",

            global:
                "GENZModelTableEvents"
        },

        /*
         * FORM COORDINATOR
         */
        {
            src:
                BASE_PATH +
                "models-form.js",

            global:
                "GENZModelsForm"
        },

        /*
         * UI
         */
        {
            src:
                BASE_PATH +
                "models-ui.js",

            global:
                "GENZModelsUI"
        },

        /*
         * LIFECYCLE
         */
        {
            src:
                BASE_PATH +
                "models-init.js",

            global:
                "GENZModelsInit"
        }
    ];

    const loaded =
        new Map();

    let started = false;

    /* =====================================================
       UTIL
    ===================================================== */

    function getGlobal(name) {
        if (!name) {
            return null;
        }

        return (
            window[name] ||
            null
        );
    }

    function hasGlobal(name) {
        return Boolean(
            getGlobal(name)
        );
    }

    function findExistingScript(src) {
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
            ) ||
            null
        );
    }

    /* =====================================================
       LOAD SCRIPT
    ===================================================== */

    function loadScript(module) {
        if (!module) {
            return Promise.reject(
                new Error(
                    "Module kosong."
                )
            );
        }

        /*
         * Jika global sudah tersedia,
         * tidak perlu memuat ulang.
         */
        if (
            module.global &&
            hasGlobal(module.global)
        ) {
            return Promise.resolve(
                module
            );
        }

        /*
         * Jika script sudah ada di DOM,
         * tunggu sampai global tersedia.
         */
        const existing =
            findExistingScript(
                module.src
            );

        if (existing) {
            return waitForGlobal(
                module,
                10000
            );
        }

        return new Promise(
            function (
                resolve,
                reject
            ) {
                const script =
                    document.createElement(
                        "script"
                    );

                script.src =
                    module.src;

                script.async = false;

                script.dataset
                    .genzModelsModule =
                    "true";

                script.onload =
                    function () {
                        waitForGlobal(
                            module,
                            10000
                        )
                            .then(resolve)
                            .catch(reject);
                    };

                script.onerror =
                    function () {
                        reject(
                            new Error(
                                "Gagal memuat module Models: " +
                                module.src
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
                        !module.global ||
                        hasGlobal(
                            module.global
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
                                module.global +
                                " dari " +
                                module.src
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
       LOAD ONE MODULE
    ===================================================== */

    async function loadModule(
        module
    ) {
        const key =
            module.src;

        if (
            loaded.has(key)
        ) {
            return loaded.get(
                key
            );
        }

        const promise =
            loadScript(
                module
            );

        loaded.set(
            key,
            promise
        );

        try {
            await promise;

            console.info(
                "[GEN-Z.AI] Models module loaded:",
                module.src
            );

            return module;

        } catch (error) {
            loaded.delete(
                key
            );

            console.error(
                "[GEN-Z.AI] Models module failed:",
                module.src,
                error
            );

            throw error;
        }
    }

    /* =====================================================
       LOAD ALL
    ===================================================== */

    async function loadAll() {
        if (started) {
            return true;
        }

        started = true;

        try {
            /*
             * Sequential loading.
             *
             * Jangan Promise.all().
             * Dependency antar module memang
             * membutuhkan urutan.
             */
            for (
                const module
                of MODULES
            ) {
                await loadModule(
                    module
                );
            }

            /*
             * Semua module tersedia.
             */
            console.info(
                "[GEN-Z.AI] Semua Models module berhasil dimuat."
            );

            /*
             * Jalankan lifecycle.
             */
            const init =
                window.GENZModelsInit;

            if (
                init &&
                typeof init.initialize ===
                    "function"
            ) {
                await init.initialize();
            }

            return true;

        } catch (error) {
            console.error(
                "[GEN-Z.AI] Models loader error:",
                error
            );

            started = false;

            return false;
        }
    }

    /* =====================================================
       STATUS
    ===================================================== */

    function getModules() {
        return MODULES.map(
            function (module) {
                return {
                    src:
                        module.src,

                    global:
                        module.global,

                    loaded:
                        hasGlobal(
                            module.global
                        )
                };
            }
        );
    }

    function isLoaded(
        src
    ) {
        const module =
            MODULES.find(
                function (item) {
                    return (
                        item.src ===
                        src
                    );
                }
            );

        if (!module) {
            return false;
        }

        return hasGlobal(
            module.global
        );
    }

    function isStarted() {
        return started;
    }

    /* =====================================================
       PUBLIC API
    ===================================================== */

    window.GENZModelsLoader =
        Object.freeze({
            loadAll,
            loadModule,
            getModules,
            isLoaded,
            isStarted
        });

    /* =====================================================
       AUTO START
    ===================================================== */

    function boot() {
        loadAll();
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
