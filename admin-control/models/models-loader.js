/* =========================================================
   GEN-Z.AI
   MODELS MODULE LOADER
   ---------------------------------------------------------
   File:
   admin-control/models/models-loader.js

   Tanggung jawab:
   - Memuat seluruh module Models
   - Menjamin dependency order
   - Mendukung ES Module import/export
   - Menghubungkan default export ke window global
     untuk compatibility module lama
   - Menjalankan GENZModelsInit setelah semua module siap
   - Mencegah duplicate loading

   Tidak bertanggung jawab:
   - Query Supabase
   - Provider CRUD
   - Form CRUD
   - Search logic
   - Table rendering
   - Pricing logic
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
       MODULE DEFINITIONS
       -----------------------------------------------------
       Urutan dipertahankan karena beberapa module memakai
       public API melalui window.
    ===================================================== */

    const MODULES = [

        /* =================================================
           DATA
        ================================================= */

        {
            id: "models-data",
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
            id: "models-provider",
            src:
                BASE_PATH +
                "models-provider.js",
            global:
                "GENZModelsProvider"
        },


        /* =================================================
           PRICE
        ================================================= */

        {
            id: "models-price",
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
            id:
                "model-price-calculation",

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
            id:
                "model-provider-dropdown",

            src:
                FUNCTION_PATH +
                "model-provider-dropdown.js",

            global:
                "GENZModelProviderDropdown"
        },


        /* =================================================
           FORM LAYOUT
        ================================================= */

        {
            id:
                "model-form-layout",

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
            id:
                "model-form-create",

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
            id:
                "model-form-edit",

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
            id:
                "model-form-delete",

            src:
                FUNCTION_PATH +
                "model-form-delete.js",

            global:
                "GENZModelFormDelete"
        },


        /* =================================================
           FORM COORDINATOR
        ================================================= */

        {
            id:
                "model-form-coordinator",

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
            id:
                "model-form-events",

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
            id:
                "model-search-dropdown",

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
            id:
                "model-search-render",

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
            id:
                "model-search-select",

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
            id:
                "model-search-events",

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
            id:
                "models-search",

            src:
                BASE_PATH +
                "models-search.js",

            global:
                "GENZModelsSearch"
        },


        /* =================================================
           TABLE
        ================================================= */

        {
            id:
                "model-table",

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
            id:
                "model-table-events",

            src:
                FUNCTION_PATH +
                "model-table-events.js",

            global:
                "GENZModelTableEvents"
        },


        /* =================================================
           PAGE SEARCH
        ================================================= */

        {
            id:
                "model-page-search",

            src:
                FUNCTION_PATH +
                "model-page-search.js",

            global:
                "GENZModelPageSearch"
        },


        /* =================================================
           UI
        ================================================= */

        {
            id:
                "models-ui",

            src:
                BASE_PATH +
                "models-ui.js",

            global:
                "GENZModelsUI"
        },


        /* =================================================
           INIT
        ================================================= */

        {
            id:
                "models-init",

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

    const loadedModules =
        new Map();

    const moduleNamespaces =
        new Map();

    let loadingPromise =
        null;

    let initialized =
        false;


    /* =====================================================
       GLOBAL HELPERS
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


    /* =====================================================
       URL HELPERS
    ===================================================== */

    function resolveModuleUrl(src) {

        if (!src) {

            throw new Error(
                "Source module Models kosong."
            );

        }

        return new URL(
            src,
            document.baseURI
        ).href;

    }


    /* =====================================================
       LOAD ES MODULE
       -----------------------------------------------------
       Ini adalah bagian terpenting.

       Jangan menggunakan:

           script.onload
           lalu menunggu window.global

       untuk module ES.

       ES Module export tidak otomatis menjadi:
           window.GENZModelsData

       Karena itu kita menggunakan:

           import(url)

       lalu mengambil:

           namespace.default

       dan menghubungkannya ke global yang diperlukan.
    ===================================================== */

    async function importModule(
        module
    ) {

        if (!module) {

            throw new Error(
                "Module Models tidak valid."
            );

        }


        /*
         * Jika global sudah ada, module dianggap
         * sudah siap.
         */
        if (
            module.global &&
            hasGlobal(
                module.global
            )
        ) {

            return {
                module,
                namespace:
                    getGlobal(
                        module.global
                    )
            };

        }


        const url =
            resolveModuleUrl(
                module.src
            );


        /*
         * Cek namespace yang sudah pernah
         * di-import.
         */
        if (
            moduleNamespaces.has(
                module.id
            )
        ) {

            const namespace =
                moduleNamespaces.get(
                    module.id
                );

            registerGlobal(
                module,
                namespace
            );

            return {
                module,
                namespace
            };

        }


        let namespace;


        try {

            namespace =
                await import(
                    url
                );

        } catch (error) {

            console.error(
                "[GEN-Z.AI] Gagal import Models module:",
                module.id,
                module.src,
                error
            );

            throw new Error(
                "Gagal memuat module Models '" +
                module.id +
                "': " +
                (
                    error &&
                    error.message
                        ? error.message
                        : String(error)
                )
            );

        }


        moduleNamespaces.set(
            module.id,
            namespace
        );


        /*
         * Hubungkan module ES ke global.
         */
        registerGlobal(
            module,
            namespace
        );


        return {
            module,
            namespace
        };

    }


    /* =====================================================
       REGISTER GLOBAL
    ===================================================== */

    function registerGlobal(
        module,
        namespace
    ) {

        if (
            !module ||
            !module.global
        ) {

            return;

        }


        /*
         * Jika module sudah mendaftarkan
         * global sendiri, jangan ditimpa.
         */
        if (
            hasGlobal(
                module.global
            )
        ) {

            return;

        }


        let exported;


        /*
         * Prioritas:
         *
         * 1. default export
         * 2. namespace object
         */
        if (
            namespace &&
            namespace.default !==
                undefined
        ) {

            exported =
                namespace.default;

        } else {

            exported =
                namespace;

        }


        if (
            exported !==
                undefined &&
            exported !==
                null
        ) {

            window[
                module.global
            ] =
                exported;

        }


        /*
         * Validasi final.
         */
        if (
            !hasGlobal(
                module.global
            )
        ) {

            throw new Error(
                "Module Models tidak mendaftarkan global '" +
                module.global +
                "': " +
                module.src
            );

        }

    }


    /* =====================================================
       LOAD ONE MODULE
    ===================================================== */

    async function loadModule(
        module
    ) {

        if (!module) {

            throw new Error(
                "Module Models tidak valid."
            );

        }


        const key =
            module.id ||
            module.src;


        /*
         * Jangan import dua kali.
         */
        if (
            loadedModules.has(
                key
            )
        ) {

            return await loadedModules.get(
                key
            );

        }


        const promise =
            importModule(
                module
            );


        loadedModules.set(
            key,
            promise
        );


        try {

            const result =
                await promise;


            console.info(
                "[GEN-Z.AI] Models module loaded:",
                module.id
            );


            return result;

        } catch (error) {

            loadedModules.delete(
                key
            );

            throw error;

        }

    }


    /* =====================================================
       LOAD ALL MODULES
    ===================================================== */

    async function loadAll() {

        if (
            initialized
        ) {

            return true;

        }


        if (
            loadingPromise
        ) {

            return await loadingPromise;

        }


        loadingPromise =
            (async function () {

                try {

                    console.info(
                        "[GEN-Z.AI] Memulai Models module loader..."
                    );


                    /*
                     * Sequential loading.
                     *
                     * Ini sengaja tidak memakai Promise.all().
                     * Beberapa module memakai public API global
                     * dari module sebelumnya.
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
                     * Verifikasi seluruh global.
                     */

                    const missing =
                        getMissingModules();


                    if (
                        missing.length >
                        0
                    ) {

                        throw new Error(
                            "Module Models belum lengkap: " +
                            missing.join(
                                ", "
                            )
                        );

                    }


                    console.info(
                        "[GEN-Z.AI] Semua Models module berhasil dimuat."
                    );


                    /* =====================================
                       INITIALIZE
                    ===================================== */

                    const init =
                        window.GENZModelsInit;


                    if (
                        init &&
                        typeof init.initialize ===
                        "function"
                    ) {

                        const result =
                            await init.initialize();


                        if (
                            result === false
                        ) {

                            throw new Error(
                                "GENZModelsInit.initialize() mengembalikan false."
                            );

                        }

                    }


                    initialized =
                        true;


                    /* =====================================
                       READY EVENT
                    ===================================== */

                    try {

                        document.dispatchEvent(
                            new CustomEvent(
                                "genz-models-loader-ready"
                            )
                        );

                    } catch (eventError) {

                        console.warn(
                            "[GEN-Z.AI] Event Models ready gagal:",
                            eventError
                        );

                    }


                    console.info(
                        "[GEN-Z.AI] Models loader selesai."
                    );


                    return true;

                } catch (error) {

                    initialized =
                        false;

                    console.error(
                        "[GEN-Z.AI] Models loader error:",
                        error
                    );


                    showLoaderError(
                        error
                    );


                    return false;

                } finally {

                    loadingPromise =
                        null;

                }

            })();


        return await loadingPromise;

    }


    /* =====================================================
       MISSING MODULE CHECK
    ===================================================== */

    function getMissingModules() {

        const missing = [];


        MODULES.forEach(
            function (module) {

                if (
                    module.global &&
                    !hasGlobal(
                        module.global
                    )
                ) {

                    missing.push(
                        module.global
                    );

                }

            }
        );


        return missing;

    }


    /* =====================================================
       FIND MODULE
    ===================================================== */

    function getModule(
        id
    ) {

        return (
            MODULES.find(
                function (module) {

                    return (
                        module.id ===
                        id
                    );

                }
            ) || null
        );

    }


    /* =====================================================
       MODULE STATUS
    ===================================================== */

    function isModuleLoaded(
        id
    ) {

        const module =
            getModule(id);


        if (!module) {
            return false;
        }


        if (
            !module.global
        ) {

            return true;

        }


        return hasGlobal(
            module.global
        );

    }


    function getModules() {

        return MODULES.map(
            function (module) {

                return {

                    id:
                        module.id,

                    src:
                        module.src,

                    global:
                        module.global,

                    loaded:
                        module.global
                            ? hasGlobal(
                                module.global
                            )
                            : true

                };

            }
        );

    }


    /* =====================================================
       ERROR UI
    ===================================================== */

    function showLoaderError(
        error
    ) {

        const message =
            error &&
            error.message
                ? error.message
                : "Unknown error";


        const alertBox =
            document.getElementById(
                "alertBox"
            );


        if (
            alertBox
        ) {

            alertBox.textContent =
                "Gagal memuat halaman Models: " +
                message;

            alertBox.className =
                "alert alert-error show";

        }

    }


    /* =====================================================
       PUBLIC STATUS
    ===================================================== */

    function isInitialized() {

        return initialized;

    }


    function isLoading() {

        return Boolean(
            loadingPromise
        );

    }


    /* =====================================================
       RESET
    ===================================================== */

    async function reset() {

        if (
            loadingPromise
        ) {

            console.warn(
                "[GEN-Z.AI] Reset loader diabaikan karena loading masih berjalan."
            );

            return false;

        }


        initialized =
            false;


        const init =
            window.GENZModelsInit;


        if (
            init &&
            typeof init.reset ===
            "function"
        ) {

            try {

                init.reset();

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI] Models init reset gagal:",
                    error
                );

            }

        }


        console.info(
            "[GEN-Z.AI] Models loader reset."
        );


        return true;

    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    window.GENZModelsLoader =
        Object.freeze({

            loadAll,

            loadModule,

            getModule,

            getModules,

            getMissingModules,

            isModuleLoaded,

            isInitialized,

            isLoading,

            reset

        });


    /* =====================================================
       BOOT
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
