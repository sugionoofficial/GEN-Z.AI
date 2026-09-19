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

   ARSITEKTUR:
   - Satu module satu owner
   - Legacy GENZModelsForm tidak lagi dimuat
   - Form menggunakan module modular:
       model-form-layout.js
       model-form-create.js
       model-form-edit.js
       model-form-delete.js
       model-form-coordinator.js
       model-form-events.js
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


    /* =====================================================
       MODULE ORDER
       =====================================================

       Urutan sangat penting.

       Jangan menggunakan Promise.all()
       karena beberapa module mempunyai
       dependency terhadap global module
       yang dimuat sebelumnya.

       Dependency utama:

       DATA
         ↓
       PROVIDER
         ↓
       PRICE
         ↓
       PRICE CALCULATION
         ↓
       PROVIDER DROPDOWN
         ↓
       FORM LAYOUT
         ↓
       FORM CRUD
         ↓
       SEARCH
         ↓
       TABLE
         ↓
       UI
         ↓
       INIT
    ===================================================== */

    const MODULES = [

        /* =================================================
           DATA
        ================================================= */

        {
            src:
                BASE_PATH +
                "models-data.js",

            global:
                "GENZModelsData"
        },


        /* =================================================
           PROVIDER
        ================================================= */

        {
            src:
                BASE_PATH +
                "models-provider.js",

            global:
                "GENZModelsProvider"
        },


        /* =================================================
           PRICE CATALOG
           -------------------------------------------------
           Harus tersedia sebelum Form Layout.
        ================================================= */

        {
            src:
                BASE_PATH +
                "models-price.js",

            global:
                "GENZModelsPrice"
        },


        /* =================================================
           PRICE CALCULATION
        ================================================= */

        {
            src:
                FUNCTION_PATH +
                "model-price-calculation.js",

            global:
                "GENZModelPriceCalculation"
        },


        /* =================================================
           PROVIDER DROPDOWN
        ================================================= */

        {
            src:
                FUNCTION_PATH +
                "model-provider-dropdown.js",

            global:
                "GENZModelProviderDropdown"
        },


        /* =================================================
           MODEL FORM LAYOUT
        ================================================= */

        {
            src:
                FUNCTION_PATH +
                "model-form-layout.js",

            global:
                "GENZModelFormLayout"
        },


        /* =================================================
           FORM CREATE
        ================================================= */

        {
            src:
                FUNCTION_PATH +
                "model-form-create.js",

            global:
                "GENZModelFormCreate"
        },


        /* =================================================
           FORM EDIT
        ================================================= */

        {
            src:
                FUNCTION_PATH +
                "model-form-edit.js",

            global:
                "GENZModelFormEdit"
        },


        /* =================================================
           FORM DELETE
        ================================================= */

        {
            src:
                FUNCTION_PATH +
                "model-form-delete.js",

            global:
                "GENZModelFormDelete"
        },


        /* =================================================
           FORM CRUD COORDINATOR
        ================================================= */

        {
            src:
                FUNCTION_PATH +
                "model-form-coordinator.js",

            global:
                "GENZModelFormCoordinator"
        },


        /* =================================================
           FORM EVENTS
        ================================================= */

        {
            src:
                FUNCTION_PATH +
                "model-form-events.js",

            global:
                "GENZModelFormEvents"
        },


        /* =================================================
           SEARCH DROPDOWN
        ================================================= */

        {
            src:
                FUNCTION_PATH +
                "model-search-dropdown.js",

            global:
                "GENZModelSearchDropdown"
        },


        /* =================================================
           SEARCH RENDER
        ================================================= */

        {
            src:
                FUNCTION_PATH +
                "model-search-render.js",

            global:
                "GENZModelSearchRender"
        },


        /* =================================================
           SEARCH SELECT
        ================================================= */

        {
            src:
                FUNCTION_PATH +
                "model-search-select.js",

            global:
                "GENZModelSearchSelect"
        },


        /* =================================================
           SEARCH EVENTS
        ================================================= */

        {
            src:
                FUNCTION_PATH +
                "model-search-events.js",

            global:
                "GENZModelSearchEvents"
        },


        /* =================================================
           SEARCH COORDINATOR
        ================================================= */

        {
            src:
                BASE_PATH +
                "models-search.js",

            global:
                "GENZModelsSearch"
        },


        /* =================================================
           TABLE RENDER
        ================================================= */

        {
            src:
                FUNCTION_PATH +
                "model-table.js",

            global:
                "GENZModelTable"
        },


        /* =================================================
           TABLE EVENTS
        ================================================= */

        {
            src:
                FUNCTION_PATH +
                "model-table-events.js",

            global:
                "GENZModelTableEvents"
        },


        /* =================================================
           UI
           -------------------------------------------------
           UI hanya orchestrator.
           Tidak lagi membutuhkan GENZModelsForm legacy.
        ================================================= */

        {
            src:
                BASE_PATH +
                "models-ui.js",

            global:
                "GENZModelsUI"
        },


        /* =================================================
           LIFECYCLE
           -------------------------------------------------
           Harus menjadi module terakhir.
        ================================================= */

        {
            src:
                BASE_PATH +
                "models-init.js",

            global:
                "GENZModelsInit"
        }

    ];


    /* =====================================================
       STATE
    ===================================================== */

    const loaded =
        new Map();

    let started = false;


    /* =====================================================
       GET GLOBAL
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


    /* =====================================================
       CHECK GLOBAL
    ===================================================== */

    function hasGlobal(name) {

        return Boolean(
            getGlobal(name)
        );

    }


    /* =====================================================
       FIND EXISTING SCRIPT
    ===================================================== */

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


        /* =================================================
           GLOBAL SUDAH TERSEDIA
        ================================================= */

        if (
            module.global &&
            hasGlobal(module.global)
        ) {

            return Promise.resolve(
                module
            );

        }


        /* =================================================
           SCRIPT SUDAH ADA DI DOM
        ================================================= */

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


        /* =================================================
           BUAT SCRIPT BARU
        ================================================= */

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


                /*
                 * Module dimuat secara berurutan
                 * oleh loadAll().
                 */
                script.async = false;


                script.dataset
                    .genzModelsModule =
                    "true";


                /* =========================================
                   SUCCESS
                ========================================= */

                script.onload =
                    function () {

                        waitForGlobal(
                            module,
                            10000
                        )
                            .then(
                                resolve
                            )
                            .catch(
                                reject
                            );

                    };


                /* =========================================
                   ERROR
                ========================================= */

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

                    /*
                     * Module tanpa global requirement
                     * langsung dianggap selesai.
                     */
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


                    /*
                     * Timeout.
                     */
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

        if (!module) {

            throw new Error(
                "Module tidak valid."
            );

        }


        const key =
            module.src;


        /*
         * Jangan load dua kali.
         */
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

            /*
             * Jika gagal, hapus dari cache
             * agar dapat dicoba kembali.
             */
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
       LOAD ALL MODULES
    ===================================================== */

    async function loadAll() {

        /*
         * Sudah berjalan.
         */
        if (started) {

            return true;

        }


        started = true;


        try {

            /* =============================================
               SEQUENTIAL LOADING
               =============================================

               Sengaja tidak Promise.all().

               Provider harus selesai sebelum
               Provider Dropdown.

               Price harus selesai sebelum
               Form Layout.

               Form module harus selesai sebelum
               Form Events.

               Search function harus selesai sebelum
               Search Coordinator.

               Table harus selesai sebelum
               Table Events.

               Semua harus selesai sebelum
               UI dan Init.
            ============================================= */

            for (
                const module
                of MODULES
            ) {

                await loadModule(
                    module
                );

            }


            /* =============================================
               SEMUA MODULE TERSEDIA
            ============================================= */

            console.info(
                "[GEN-Z.AI] Semua Models module berhasil dimuat."
            );


            /* =============================================
               JALANKAN LIFECYCLE
            ============================================= */

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


            /*
             * Izinkan retry setelah kegagalan.
             */
            started = false;


            return false;

        }

    }


    /* =====================================================
       GET MODULE LIST
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


    /* =====================================================
       CHECK MODULE LOADED
    ===================================================== */

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


    /* =====================================================
       CHECK STARTED
    ===================================================== */

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


    /* =====================================================
       DOM READY
    ===================================================== */

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
