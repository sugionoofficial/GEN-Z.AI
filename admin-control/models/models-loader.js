/* =========================================================
   GEN-Z.AI
   MODELS MODULE LOADER
   ---------------------------------------------------------
   File:
   admin-control/models/models-loader.js

   Tanggung jawab:
   - Memuat seluruh module Models
   - Menjamin dependency order
   - Mencegah duplicate module
   - Mendukung ES Module
   - Menunggu global module tersedia
   - Menjalankan GENZModelsInit setelah semua module siap

   CATATAN:
   - Module baru menggunakan import/export.
   - Loader ini memuat module sebagai type="module".
   - Module tetap wajib mendaftarkan public API ke window
     apabila module tersebut dibutuhkan oleh lifecycle lama.

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

    const BASE_PATH = "./models/";
    const FUNCTION_PATH = "./models/functions/";


    /* =====================================================
       MODULE DEFINITIONS
       -----------------------------------------------------
       Urutan mengikuti dependency.
    ===================================================== */

    const MODULES = [

        /* =================================================
           DATA
        ================================================= */

        {
            id: "models-data",
            src: BASE_PATH + "models-data.js",
            global: "GENZModelsData"
        },


        /* =================================================
           PROVIDER
        ================================================= */

        {
            id: "models-provider",
            src: BASE_PATH + "models-provider.js",
            global: "GENZModelsProvider"
        },


        /* =================================================
           PRICE CATALOG
        ================================================= */

        {
            id: "models-price",
            src: BASE_PATH + "models-price.js",
            global: "GENZModelsPrice"
        },


        /* =================================================
           PRICE CALCULATION
        ================================================= */

        {
            id: "model-price-calculation",
            src:
                FUNCTION_PATH +
                "model-price-calculation.js",
            global: "GENZModelPriceCalculation"
        },


        /* =================================================
           PROVIDER DROPDOWN
        ================================================= */

        {
            id: "model-provider-dropdown",
            src:
                FUNCTION_PATH +
                "model-provider-dropdown.js",
            global: "GENZModelProviderDropdown"
        },


        /* =================================================
           FORM LAYOUT
        ================================================= */

        {
            id: "model-form-layout",
            src:
                FUNCTION_PATH +
                "model-form-layout.js",
            global: "GENZModelFormLayout"
        },


        /* =================================================
           FORM CREATE
        ================================================= */

        {
            id: "model-form-create",
            src:
                FUNCTION_PATH +
                "model-form-create.js",
            global: "GENZModelFormCreate"
        },


        /* =================================================
           FORM EDIT
        ================================================= */

        {
            id: "model-form-edit",
            src:
                FUNCTION_PATH +
                "model-form-edit.js",
            global: "GENZModelFormEdit"
        },


        /* =================================================
           FORM DELETE
        ================================================= */

        {
            id: "model-form-delete",
            src:
                FUNCTION_PATH +
                "model-form-delete.js",
            global: "GENZModelFormDelete"
        },


        /* =================================================
           FORM COORDINATOR
        ================================================= */

        {
            id: "model-form-coordinator",
            src:
                FUNCTION_PATH +
                "model-form-coordinator.js",
            global: "GENZModelFormCoordinator"
        },


        /* =================================================
           FORM EVENTS
        ================================================= */

        {
            id: "model-form-events",
            src:
                FUNCTION_PATH +
                "model-form-events.js",
            global: "GENZModelFormEvents"
        },


        /* =================================================
           SEARCH DROPDOWN
        ================================================= */

        {
            id: "model-search-dropdown",
            src:
                FUNCTION_PATH +
                "model-search-dropdown.js",
            global: "GENZModelSearchDropdown"
        },


        /* =================================================
           SEARCH RENDER
        ================================================= */

        {
            id: "model-search-render",
            src:
                FUNCTION_PATH +
                "model-search-render.js",
            global: "GENZModelSearchRender"
        },


        /* =================================================
           SEARCH SELECT
        ================================================= */

        {
            id: "model-search-select",
            src:
                FUNCTION_PATH +
                "model-search-select.js",
            global: "GENZModelSearchSelect"
        },


        /* =================================================
           SEARCH EVENTS
        ================================================= */

        {
            id: "model-search-events",
            src:
                FUNCTION_PATH +
                "model-search-events.js",
            global: "GENZModelSearchEvents"
        },


        /* =================================================
           SEARCH COORDINATOR
        ================================================= */

        {
            id: "models-search",
            src:
                BASE_PATH +
                "models-search.js",
            global: "GENZModelsSearch"
        },


        /* =================================================
           TABLE
        ================================================= */

        {
            id: "model-table",
            src:
                FUNCTION_PATH +
                "model-table.js",
            global: "GENZModelTable"
        },


        /* =================================================
           TABLE EVENTS
        ================================================= */

        {
            id: "model-table-events",
            src:
                FUNCTION_PATH +
                "model-table-events.js",
            global: "GENZModelTableEvents"
        },


        /* =================================================
           PAGE SEARCH
        ================================================= */

        {
            id: "model-page-search",
            src:
                FUNCTION_PATH +
                "model-page-search.js",
            global: "GENZModelPageSearch"
        },


        /* =================================================
           UI
        ================================================= */

        {
            id: "models-ui",
            src:
                BASE_PATH +
                "models-ui.js",
            global: "GENZModelsUI"
        },


        /* =================================================
           INIT
        ================================================= */

        {
            id: "models-init",
            src:
                BASE_PATH +
                "models-init.js",
            global: "GENZModelsInit"
        }

    ];


    /* =====================================================
       STATE
    ===================================================== */

    const loadedModules = new Map();

    let loadingPromise = null;
    let initialized = false;


    /* =====================================================
       GLOBAL HELPERS
    ===================================================== */

    function getGlobal(name) {

        if (!name) {
            return null;
        }

        return window[name] || null;

    }


    function hasGlobal(name) {

        return Boolean(
            getGlobal(name)
        );

    }


    /* =====================================================
       SCRIPT NORMALIZATION
    ===================================================== */

    function normalizeSource(src) {

        if (!src) {
            return "";
        }

        return String(src)
            .split("?")[0]
            .split("#")[0];

    }


    /* =====================================================
       FIND EXISTING SCRIPT
    ===================================================== */

    function findExistingScript(src) {

        const normalized =
            normalizeSource(src);

        const scripts =
            Array.from(
                document.scripts
            );

        return (
            scripts.find(
                function (script) {

                    const current =
                        script.getAttribute("src");

                    if (!current) {
                        return false;
                    }

                    return (
                        normalizeSource(current) ===
                        normalized
                    );

                }
            ) || null
        );

    }


    /* =====================================================
       WAIT FOR GLOBAL
    ===================================================== */

    function waitForGlobal(
        module,
        timeout = 15000
    ) {

        if (
            !module ||
            !module.global
        ) {

            return Promise.resolve(
                module
            );

        }


        if (
            hasGlobal(
                module.global
            )
        ) {

            return Promise.resolve(
                module
            );

        }


        return new Promise(
            function (
                resolve,
                reject
            ) {

                const startedAt =
                    Date.now();


                function check() {

                    if (
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
                        startedAt >=
                        timeout
                    ) {

                        reject(
                            new Error(
                                "Module Models tidak mendaftarkan global '" +
                                module.global +
                                "': " +
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
       LOAD ES MODULE
       -----------------------------------------------------
       Module baru menggunakan import/export.

       Script dibuat:
           type="module"

       async=false pada module script tidak memberikan
       semantik sequencing seperti script klasik.

       Karena itu sequencing dikontrol oleh Promise
       onload + waitForGlobal.
    ===================================================== */

    function loadModuleScript(module) {

        if (!module) {

            return Promise.reject(
                new Error(
                    "Module Models tidak valid."
                )
            );

        }


        if (
            module.global &&
            hasGlobal(
                module.global
            )
        ) {

            return Promise.resolve(
                module
            );

        }


        const existing =
            findExistingScript(
                module.src
            );


        if (existing) {

            return waitForGlobal(
                module
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


                script.type =
                    "module";

                script.src =
                    module.src;

                script.dataset
                    .genzModelsModule =
                    "true";

                script.dataset
                    .genzModelsModuleId =
                    module.id;


                let settled =
                    false;


                function fail(error) {

                    if (settled) {
                        return;
                    }

                    settled = true;

                    reject(
                        error instanceof Error
                            ? error
                            : new Error(
                                String(error)
                            )
                    );

                }


                function success() {

                    if (settled) {
                        return;
                    }


                    waitForGlobal(
                        module
                    )
                        .then(
                            function () {

                                if (
                                    settled
                                ) {
                                    return;
                                }

                                settled =
                                    true;

                                resolve(
                                    module
                                );

                            }
                        )
                        .catch(
                            fail
                        );

                }


                script.onload =
                    success;


                script.onerror =
                    function () {

                        fail(
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
       LOAD ONE MODULE
    ===================================================== */

    async function loadModule(module) {

        if (!module) {

            throw new Error(
                "Module Models tidak valid."
            );

        }


        const key =
            module.id ||
            module.src;


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
            loadModuleScript(
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

            console.error(
                "[GEN-Z.AI] Models module failed:",
                module.id,
                error
            );

            throw error;

        }

    }


    /* =====================================================
       LOAD ALL
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
                     * Sequential.
                     *
                     * Jangan Promise.all().
                     *
                     * Walaupun ES Module punya dependency graph,
                     * module Models juga memakai global API untuk
                     * kompatibilitas antar-file.
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
                     * Pastikan semua global benar-benar ada.
                     */

                    const missing =
                        getMissingModules();


                    if (
                        missing.length
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


                    /*
                     * Jalankan lifecycle satu kali.
                     */

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


                    try {

                        document.dispatchEvent(
                            new CustomEvent(
                                "genz-models-loader-ready"
                            )
                        );

                    } catch (eventError) {

                        console.warn(
                            "[GEN-Z.AI] Loader ready event gagal:",
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
       LOADER ERROR
    ===================================================== */

    function showLoaderError(error) {

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
       MODULE STATUS
    ===================================================== */

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
       -----------------------------------------------------
       Reset hanya lifecycle state loader.

       Tidak menghapus script dari DOM.
       Tidak menghapus cache browser.
       Tidak menghancurkan data Models.
    ===================================================== */

    async function reset() {

        if (
            loadingPromise
        ) {

            console.warn(
                "[GEN-Z.AI] Loader reset diabaikan karena loading masih berjalan."
            );

            return false;

        }


        initialized =
            false;


        /*
         * Reset module lifecycle jika tersedia.
         */

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

            getModules,

            getModule,

            getMissingModules,

            isModuleLoaded,

            isInitialized,

            isLoading,

            reset

        });


    /* =====================================================
       BOOT
       -----------------------------------------------------
       Loader hanya boot satu kali dari DOM lifecycle.
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
