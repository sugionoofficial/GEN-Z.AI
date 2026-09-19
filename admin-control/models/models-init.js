/* =========================================================
   GEN-Z.AI
   MODELS INITIALIZATION MODULE
   ---------------------------------------------------------
   File:
   admin-control/models/models-init.js

   Tanggung jawab:
   - Lifecycle halaman Models
   - Menunggu module yang diperlukan
   - Initialize module sesuai dependency
   - Bind event modules
   - Sinkronisasi catalog
   - Reset lifecycle

   Tidak bertanggung jawab:
   - Provider CRUD
   - Provider dropdown rendering
   - Search logic
   - Form CRUD
   - Table rendering
   - Table CRUD
   - Price calculation logic
   - API / Supabase

   CATATAN ARSITEKTUR:
   GENZModelsForm legacy TIDAK lagi menjadi dependency
   wajib lifecycle.

   SEARCH:
   - GENZModelsSearch
       = pencarian Model ID di Form Tambah/Edit

   - GENZModelPageSearch
       = pencarian utama pada halaman Models
         (#searchInput + #statusFilter)

   PRICE:
   - GENZModelFormLayout
       = layout/form UI termasuk converter harga KIE

   - GENZModelPriceCalculation
       = kalkulasi Credit / Credit Final

   INIT:
   models-init.js hanya menjalankan lifecycle module.
   ========================================================= */

(function () {

    "use strict";


    /* =====================================================
       STATE
    ===================================================== */

    let initialized = false;

    let initializingPromise = null;


    /* =====================================================
       MODULE ACCESS
    ===================================================== */

    function getModules() {

        return {

            data:
                window.GENZModelsData ||
                null,

            provider:
                window.GENZModelsProvider ||
                null,

            providerDropdown:
                window.GENZModelProviderDropdown ||
                null,

            /*
             * Search Model ID pada Form.
             */
            search:
                window.GENZModelsSearch ||
                null,

            searchEvents:
                window.GENZModelSearchEvents ||
                null,

            /*
             * Search utama halaman Models.
             *
             * Target:
             * #searchInput
             * #statusFilter
             */
            pageSearch:
                window.GENZModelPageSearch ||
                null,

            /*
             * Form legacy sengaja TIDAK digunakan.
             *
             * Module form baru:
             * - formCreate
             * - formEdit
             * - formLayout
             * - formEvents
             * - formCoordinator
             */

            formEvents:
                window.GENZModelFormEvents ||
                null,

            formCoordinator:
                window.GENZModelFormCoordinator ||
                null,

            formLayout:
                window.GENZModelFormLayout ||
                null,

            formCreate:
                window.GENZModelFormCreate ||
                null,

            formEdit:
                window.GENZModelFormEdit ||
                null,

            formDelete:
                window.GENZModelFormDelete ||
                null,

            price:
                window.GENZModelsPrice ||
                null,

            priceCalculation:
                window.GENZModelPriceCalculation ||
                null,

            table:
                window.GENZModelTable ||
                null,

            tableEvents:
                window.GENZModelTableEvents ||
                null,

            ui:
                window.GENZModelsUI ||
                null

        };

    }


    /* =====================================================
       REQUIRED MODULE CHECK
    ===================================================== */

    function modulesReady() {

        const modules =
            getModules();


        /*
         * Module inti yang memang diperlukan
         * oleh halaman Models.
         *
         * GENZModelsForm legacy TIDAK termasuk.
         */

        return (

            !!modules.data &&

            !!modules.provider &&

            !!modules.providerDropdown &&

            /*
             * Search Model ID Form
             */
            !!modules.search &&

            !!modules.searchEvents &&

            /*
             * Search utama halaman Models
             */
            !!modules.pageSearch &&

            !!modules.formEvents &&

            !!modules.formCoordinator &&

            !!modules.formLayout &&

            !!modules.formCreate &&

            !!modules.formEdit &&

            !!modules.formDelete &&

            !!modules.price &&

            !!modules.priceCalculation &&

            !!modules.table &&

            !!modules.tableEvents &&

            !!modules.ui

        );

    }


    /* =====================================================
       GET MISSING MODULES
    ===================================================== */

    function getMissingModules() {

        const modules =
            getModules();

        const missing = [];


        const required = [

            [
                "data",
                "GENZModelsData"
            ],

            [
                "provider",
                "GENZModelsProvider"
            ],

            [
                "providerDropdown",
                "GENZModelProviderDropdown"
            ],

            /*
             * Search Model ID pada Form.
             */
            [
                "search",
                "GENZModelsSearch"
            ],

            [
                "searchEvents",
                "GENZModelSearchEvents"
            ],

            /*
             * Search utama halaman Models.
             */
            [
                "pageSearch",
                "GENZModelPageSearch"
            ],

            [
                "formEvents",
                "GENZModelFormEvents"
            ],

            [
                "formCoordinator",
                "GENZModelFormCoordinator"
            ],

            [
                "formLayout",
                "GENZModelFormLayout"
            ],

            [
                "formCreate",
                "GENZModelFormCreate"
            ],

            [
                "formEdit",
                "GENZModelFormEdit"
            ],

            [
                "formDelete",
                "GENZModelFormDelete"
            ],

            [
                "price",
                "GENZModelsPrice"
            ],

            [
                "priceCalculation",
                "GENZModelPriceCalculation"
            ],

            [
                "table",
                "GENZModelTable"
            ],

            [
                "tableEvents",
                "GENZModelTableEvents"
            ],

            [
                "ui",
                "GENZModelsUI"
            ]

        ];


        for (
            const item of required
        ) {

            const key =
                item[0];

            const name =
                item[1];


            if (
                !modules[key]
            ) {

                missing.push(
                    name
                );

            }

        }


        return missing;

    }


    /* =====================================================
       WAIT FOR MODULES
    ===================================================== */

    function waitForModules(
        timeout = 15000
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
                        modulesReady()
                    ) {

                        resolve(
                            getModules()
                        );

                        return;

                    }


                    if (
                        Date.now() -
                        start >=
                        timeout
                    ) {

                        const missing =
                            getMissingModules();


                        const message =
                            missing.length

                                ?

                                (
                                    "Module halaman Models belum lengkap: " +
                                    missing.join(
                                        ", "
                                    )
                                )

                                :

                                "Module halaman Models belum lengkap.";


                        reject(
                            new Error(
                                message
                            )
                        );


                        return;

                    }


                    window.setTimeout(
                        check,
                        50
                    );

                }


                check();

            }
        );

    }


    /* =====================================================
       PROVIDER
       -----------------------------------------------------
       Provider module adalah owner Provider.
       Init hanya menjalankan lifecycle.
       ===================================================== */

    async function initializeProvider() {

        const provider =
            window.GENZModelsProvider;


        if (
            !provider
        ) {

            throw new Error(
                "GENZModelsProvider belum tersedia."
            );

        }


        if (
            typeof provider.initialize ===
            "function"
        ) {

            return await provider.initialize();

        }


        if (
            typeof provider.loadProviders ===
            "function"
        ) {

            return await provider.loadProviders();

        }


        throw new Error(
            "GENZModelsProvider tidak memiliki initialize() atau loadProviders()."
        );

    }


    /* =====================================================
       PROVIDER DROPDOWN
       -----------------------------------------------------
       Dropdown module adalah owner rendering.
       ===================================================== */

    async function initializeProviderDropdown() {

        const dropdown =
            window.GENZModelProviderDropdown;


        if (
            !dropdown
        ) {

            throw new Error(
                "GENZModelProviderDropdown belum tersedia."
            );

        }


        if (
            typeof dropdown.initialize ===
            "function"
        ) {

            const result =
                await dropdown.initialize();


            console.info(
                "[GEN-Z.AI] Provider dropdown initialized."
            );


            return (
                result !== false
            );

        }


        /*
         * Compatibility fallback.
         *
         * Hanya dipakai jika module dropdown
         * tidak mempunyai initialize().
         */

        const provider =
            window.GENZModelsProvider;


        if (
            provider &&
            typeof provider.getProviders ===
            "function" &&
            typeof dropdown.setProviders ===
            "function"
        ) {

            const providers =
                provider.getProviders();


            dropdown.setProviders(
                Array.isArray(
                    providers
                )
                    ? providers
                    : []
            );


            return true;

        }


        throw new Error(
            "Provider Dropdown tidak memiliki lifecycle yang valid."
        );

    }


    /* =====================================================
       UI
       -----------------------------------------------------
       UI hanya orchestrator tampilan/state.
       ===================================================== */

    async function initializeUI() {

        const ui =
            window.GENZModelsUI;


        if (
            !ui
        ) {

            throw new Error(
                "GENZModelsUI belum tersedia."
            );

        }


        if (
            typeof ui.initialize !==
            "function"
        ) {

            throw new Error(
                "GENZModelsUI.initialize() tidak tersedia."
            );

        }


        return await ui.initialize();

    }


    /* =====================================================
       FORM LAYOUT
       -----------------------------------------------------
       Owner:
       GENZModelFormLayout

       Termasuk:
       - layout form
       - binding converter harga KIE
       - preview USD
       - preview kurs
       - preview IDR

       Init hanya menjalankan lifecycle module.
       ===================================================== */

    async function initializeFormLayout() {

        const layout =
            window.GENZModelFormLayout;


        if (
            !layout
        ) {

            throw new Error(
                "GENZModelFormLayout belum tersedia."
            );

        }


        if (
            typeof layout.initialize !==
            "function"
        ) {

            throw new Error(
                "GENZModelFormLayout.initialize() tidak tersedia."
            );

        }


        const result =
            await layout.initialize();


        console.info(
            "[GEN-Z.AI] Model form layout initialized."
        );


        return (
            result !== false
        );

    }


    /* =====================================================
       PRICE CALCULATION
       -----------------------------------------------------
       Owner:
       GENZModelPriceCalculation

       Tanggung jawab module:
       - Credit
       - Diskon
       - Credit Final
       - event kalkulasi harga

       Init hanya menjalankan bind lifecycle.
       ===================================================== */

    function initializePriceCalculation() {

        const calculation =
            window.GENZModelPriceCalculation;


        if (
            !calculation
        ) {

            throw new Error(
                "GENZModelPriceCalculation belum tersedia."
            );

        }


        if (
            typeof calculation.bind !==
            "function"
        ) {

            throw new Error(
                "GENZModelPriceCalculation.bind() tidak tersedia."
            );

        }


        const result =
            calculation.bind();


        console.info(
            "[GEN-Z.AI] Model price calculation initialized."
        );


        return (
            result !== false
        );

    }


    /* =====================================================
       SEARCH
       -----------------------------------------------------
       Search Model ID pada Form Tambah/Edit.
       ===================================================== */

    function syncSearchWithModels() {

        const data =
            window.GENZModelsData;

        const search =
            window.GENZModelsSearch;


        if (
            !data ||
            !search
        ) {

            return false;

        }


        if (
            typeof data.getCachedModels !==
            "function" ||
            typeof search.setModels !==
            "function"
        ) {

            return false;

        }


        try {

            const models =
                data.getCachedModels();


            if (
                !Array.isArray(
                    models
                )
            ) {

                return false;

            }


            search.setModels(
                models
            );


            console.info(
                "[GEN-Z.AI] Search catalog synchronized:",
                models.length
            );


            return true;

        } catch (error) {

            console.warn(
                "[GEN-Z.AI] Search catalog sync gagal:",
                error
            );


            return false;

        }

    }


    function initializeSearch() {

        const search =
            window.GENZModelsSearch;


        if (
            !search
        ) {

            throw new Error(
                "GENZModelsSearch belum tersedia."
            );

        }


        if (
            typeof search.initialize !==
            "function"
        ) {

            throw new Error(
                "GENZModelsSearch.initialize() tidak tersedia."
            );

        }


        const result =
            search.initialize();


        console.info(
            "[GEN-Z.AI] Model ID form search initialized."
        );


        return (
            result !== false
        );

    }


    /* =====================================================
       SEARCH EVENTS
       ===================================================== */

    function initializeSearchEvents() {

        const events =
            window.GENZModelSearchEvents;


        if (
            !events
        ) {

            throw new Error(
                "GENZModelSearchEvents belum tersedia."
            );

        }


        if (
            typeof events.bind !==
            "function"
        ) {

            throw new Error(
                "GENZModelSearchEvents.bind() tidak tersedia."
            );

        }


        const result =
            events.bind();


        console.info(
            "[GEN-Z.AI] Model ID form search events initialized."
        );


        return (
            result !== false
        );

    }


    /* =====================================================
       PAGE SEARCH
       -----------------------------------------------------
       Search utama halaman Models.

       Target:
           #searchInput

       Filter:
           #statusFilter

       TIDAK menyentuh:
           #modelCodeSearch
       ===================================================== */

    function initializePageSearch() {

        const pageSearch =
            window.GENZModelPageSearch;


        if (
            !pageSearch
        ) {

            throw new Error(
                "GENZModelPageSearch belum tersedia."
            );

        }


        if (
            typeof pageSearch.initialize !==
            "function"
        ) {

            throw new Error(
                "GENZModelPageSearch.initialize() tidak tersedia."
            );

        }


        const result =
            pageSearch.initialize();


        console.info(
            "[GEN-Z.AI] Model page search initialized."
        );


        return (
            result !== false
        );

    }


    /* =====================================================
       FORM EVENTS
    ===================================================== */

    function initializeFormEvents() {

        const events =
            window.GENZModelFormEvents;


        if (
            !events
        ) {

            throw new Error(
                "GENZModelFormEvents belum tersedia."
            );

        }


        if (
            typeof events.bind !==
            "function"
        ) {

            throw new Error(
                "GENZModelFormEvents.bind() tidak tersedia."
            );

        }


        const result =
            events.bind();


        console.info(
            "[GEN-Z.AI] Model form events initialized."
        );


        return (
            result !== false
        );

    }


    /* =====================================================
       TABLE
    ===================================================== */

    function syncTableWithModels() {

        const data =
            window.GENZModelsData;

        const table =
            window.GENZModelTable;


        if (
            !data ||
            !table
        ) {

            return false;

        }


        if (
            typeof data.getCachedModels !==
            "function" ||
            typeof table.setModels !==
            "function"
        ) {

            return false;

        }


        try {

            const models =
                data.getCachedModels();


            if (
                !Array.isArray(
                    models
                )
            ) {

                return false;

            }


            table.setModels(
                models
            );


            if (
                typeof table.render ===
                "function"
            ) {

                table.render();

            }


            console.info(
                "[GEN-Z.AI] Model table synchronized:",
                models.length
            );


            return true;

        } catch (error) {

            console.warn(
                "[GEN-Z.AI] Model table sync gagal:",
                error
            );


            return false;

        }

    }


    function initializeTableEvents() {

        const events =
            window.GENZModelTableEvents;


        if (
            !events
        ) {

            throw new Error(
                "GENZModelTableEvents belum tersedia."
            );

        }


        if (
            typeof events.bind !==
            "function"
        ) {

            throw new Error(
                "GENZModelTableEvents.bind() tidak tersedia."
            );

        }


        const result =
            events.bind();


        console.info(
            "[GEN-Z.AI] Model table events initialized."
        );


        return (
            result !== false
        );

    }


    /* =====================================================
       FINAL PROVIDER STATE
       -----------------------------------------------------
       Hanya membaca state.
       Tidak render ulang dropdown.
       ===================================================== */

    function syncProviderState() {

        const provider =
            window.GENZModelsProvider;


        if (
            !provider
        ) {

            return [];

        }


        if (
            typeof provider.getProviders !==
            "function"
        ) {

            return [];

        }


        try {

            const providers =
                provider.getProviders();


            return Array.isArray(
                providers
            )
                ? providers
                : [];

        } catch (error) {

            console.warn(
                "[GEN-Z.AI] Provider state sync gagal:",
                error
            );


            return [];

        }

    }


    /* =====================================================
       INITIALIZE
    ===================================================== */

    async function initialize() {

        if (
            initialized
        ) {

            return true;

        }


        if (
            initializingPromise
        ) {

            return await initializingPromise;

        }


        initializingPromise =
            (async function () {

                try {

                    /* =========================================
                       1. WAIT REQUIRED MODULES
                       -----------------------------------------
                       GENZModelsForm legacy tidak diperlukan.
                    ========================================= */

                    await waitForModules();


                    /* =========================================
                       2. PROVIDER
                    ========================================= */

                    await initializeProvider();


                    /* =========================================
                       3. PROVIDER DROPDOWN
                    ========================================= */

                    await initializeProviderDropdown();


                    /* =========================================
                       4. UI
                    ========================================= */

                    await initializeUI();


                    /* =========================================
                       5. FORM LAYOUT
                       -----------------------------------------
                       WAJIB dijalankan agar:
                       - converter USD -> IDR aktif
                       - preview harga KIE aktif
                       - event harga KIE terpasang
                    ========================================= */

                    await initializeFormLayout();


                    /* =========================================
                       6. PRICE CALCULATION
                       -----------------------------------------
                       WAJIB bind agar:
                       - Credit aktif
                       - Diskon aktif
                       - Credit Final aktif
                    ========================================= */

                    initializePriceCalculation();


                    /* =========================================
                       7. SEARCH CATALOG SYNC
                       -----------------------------------------
                       Untuk Search Model ID pada Form.
                    ========================================= */

                    syncSearchWithModels();


                    /* =========================================
                       8. SEARCH MODEL ID FORM
                    ========================================= */

                    initializeSearch();


                    /* =========================================
                       9. SEARCH EVENTS
                    ========================================= */

                    initializeSearchEvents();


                    /* =========================================
                       10. FORM EVENTS
                    ========================================= */

                    initializeFormEvents();


                    /* =========================================
                       11. TABLE
                    ========================================= */

                    syncTableWithModels();


                    /* =========================================
                       12. TABLE EVENTS
                    ========================================= */

                    initializeTableEvents();


                    /* =========================================
                       13. PAGE SEARCH
                       -----------------------------------------
                       Search utama halaman Models.

                       Target:
                           #searchInput

                       BUKAN:
                           #modelCodeSearch
                    ========================================= */

                    initializePageSearch();


                    /* =========================================
                       14. PROVIDER STATE
                       -----------------------------------------
                       Hanya membaca state.
                       Tidak render dropdown ulang.
                    ========================================= */

                    const providers =
                        syncProviderState();


                    console.info(
                        "[GEN-Z.AI] Provider state:",
                        providers.length
                    );


                    /* =========================================
                       15. READY
                    ========================================= */

                    initialized =
                        true;


                    try {

                        document.dispatchEvent(
                            new CustomEvent(
                                "genz-models-initialized"
                            )
                        );

                    } catch (eventError) {

                        console.warn(
                            "[GEN-Z.AI] Ready event gagal:",
                            eventError
                        );

                    }


                    console.info(
                        "[GEN-Z.AI] Models initialization complete."
                    );


                    return true;

                } catch (error) {

                    initialized =
                        false;


                    console.error(
                        "[GEN-Z.AI] Models initialization failed:",
                        error
                    );


                    const alertBox =
                        document.getElementById(
                            "alertBox"
                        );


                    if (
                        alertBox
                    ) {

                        alertBox.textContent =
                            "Gagal memuat halaman Models: " +
                            (
                                error?.message ||
                                "Unknown error"
                            );


                        alertBox.className =
                            "alert alert-error show";

                    }


                    try {

                        document.dispatchEvent(
                            new CustomEvent(
                                "genz-models-error",
                                {
                                    detail:
                                        error
                                }
                            )
                        );

                    } catch (
                        eventError
                    ) {

                        console.warn(
                            "[GEN-Z.AI] Error event gagal:",
                            eventError
                        );

                    }


                    throw error;

                } finally {

                    initializingPromise =
                        null;

                }

            })();


        return await initializingPromise;

    }


    /* =====================================================
       RESET
    ===================================================== */

    function reset() {

        /*
         * Jangan reset di tengah initialization.
         */

        if (
            initializingPromise
        ) {

            console.warn(
                "[GEN-Z.AI] Reset diabaikan karena initialization masih berjalan."
            );


            return false;

        }


        /* ================================================
           FORM EVENTS
        ================================================ */

        const formEvents =
            window.GENZModelFormEvents;


        if (
            formEvents &&
            typeof formEvents.unbind ===
            "function"
        ) {

            try {

                formEvents.unbind();

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI] Form events reset gagal:",
                    error
                );

            }

        }


        /* ================================================
           TABLE EVENTS
        ================================================ */

        const tableEvents =
            window.GENZModelTableEvents;


        if (
            tableEvents &&
            typeof tableEvents.unbind ===
            "function"
        ) {

            try {

                tableEvents.unbind();

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI] Table events reset gagal:",
                    error
                );

            }

        }


        /* ================================================
           SEARCH EVENTS
           -----------------------------------------------
           Search Model ID pada Form.
        ================================================ */

        const searchEvents =
            window.GENZModelSearchEvents;


        if (
            searchEvents &&
            typeof searchEvents.unbind ===
            "function"
        ) {

            try {

                searchEvents.unbind();

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI] Search events reset gagal:",
                    error
                );

            }

        }


        /* ================================================
           PAGE SEARCH
           -----------------------------------------------
           Search utama halaman Models.
        ================================================ */

        const pageSearch =
            window.GENZModelPageSearch;


        if (
            pageSearch &&
            typeof pageSearch.unbind ===
            "function"
        ) {

            try {

                pageSearch.unbind();

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI] Page search reset gagal:",
                    error
                );

            }

        }


        /* ================================================
           FORM LAYOUT
           -----------------------------------------------
           Reset event/layout converter jika module
           menyediakan lifecycle unbind/destroy.
        ================================================ */

        const formLayout =
            window.GENZModelFormLayout;


        if (
            formLayout &&
            typeof formLayout.unbind ===
            "function"
        ) {

            try {

                formLayout.unbind();

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI] Form layout reset gagal:",
                    error
                );

            }

        }


        /* ================================================
           PRICE CALCULATION
           -----------------------------------------------
           Lepas binding kalkulasi jika module
           menyediakan unbind().
        ================================================ */

        const priceCalculation =
            window.GENZModelPriceCalculation;


        if (
            priceCalculation &&
            typeof priceCalculation.unbind ===
            "function"
        ) {

            try {

                priceCalculation.unbind();

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI] Price calculation reset gagal:",
                    error
                );

            }

        }


        /*
         * Provider tidak dihancurkan.
         *
         * Provider adalah state owner.
         * Reset lifecycle tidak berarti menghapus
         * data Provider.
         */


        initialized =
            false;


        console.info(
            "[GEN-Z.AI] Models initialization reset."
        );


        return true;

    }


    /* =====================================================
       STATUS
    ===================================================== */

    function isInitialized() {

        return initialized;

    }


    function isInitializing() {

        return !!initializingPromise;

    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    window.GENZModelsInit =
        Object.freeze({

            initialize,

            initializeProvider,

            initializeProviderDropdown,

            initializeUI,

            initializeFormLayout,

            initializePriceCalculation,

            initializeSearch,

            initializeSearchEvents,

            initializePageSearch,

            initializeFormEvents,

            initializeTableEvents,

            waitForModules,

            syncProviderState,

            syncSearchWithModels,

            syncTableWithModels,

            isInitialized,

            isInitializing,

            reset

        });


    console.info(
        "[GEN-Z.AI] GENZModelsInit loaded."
    );

})();
