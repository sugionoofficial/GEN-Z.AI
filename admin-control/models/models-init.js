/* =========================================================
   GEN-Z.AI
   MODELS INITIALIZATION MODULE
   ---------------------------------------------------------
   File:
   admin-control/models/models-init.js

   TANGGUNG JAWAB:
   - Lifecycle halaman Models
   - Menunggu module tersedia
   - Menjalankan initialization sesuai dependency
   - Menghubungkan module melalui public API
   - Bind event modules
   - Reset lifecycle

   TIDAK BERTANGGUNG JAWAB:
   - Provider CRUD
   - Provider dropdown rendering
   - Model API / Supabase
   - Search logic
   - Form CRUD
   - Form layout
   - Table rendering
   - Table CRUD
   - Price calculation
   - UI rendering

   PRINSIP:
   Satu fungsi hanya mempunyai satu owner.

   Provider:
   GENZModelsProvider

   Provider Dropdown:
   GENZModelProviderDropdown

   Model Catalog:
   GENZModelsData

   Search:
   GENZModelsSearch

   Search Events:
   GENZModelSearchEvents

   Form:
   GENZModelsForm

   Form Events:
   GENZModelFormEvents

   Form Coordinator:
   GENZModelFormCoordinator

   Form Layout:
   GENZModelFormLayout

   Form Create:
   GENZModelFormCreate

   Form Edit:
   GENZModelFormEdit

   Form Delete:
   GENZModelFormDelete

   Pricing:
   GENZModelsPrice

   Credit Calculation:
   GENZModelPriceCalculation

   Table:
   GENZModelTable

   Table Events:
   GENZModelTableEvents

   UI:
   GENZModelsUI
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

            search:
                window.GENZModelsSearch ||
                null,

            searchEvents:
                window.GENZModelSearchEvents ||
                null,

            form:
                window.GENZModelsForm ||
                null,

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
       -----------------------------------------------------
       Hanya module yang benar-benar dibutuhkan oleh
       lifecycle utama yang dijadikan REQUIRED.

       Module tambahan tetap diperiksa melalui
       dependency masing-masing ketika diperlukan.
    ===================================================== */

    function modulesReady() {

        const modules =
            getModules();


        return (

            !!modules.data &&

            !!modules.provider &&

            !!modules.providerDropdown &&

            !!modules.search &&

            !!modules.searchEvents &&

            !!modules.form &&

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

            [
                "search",
                "GENZModelsSearch"
            ],

            [
                "searchEvents",
                "GENZModelSearchEvents"
            ],

            [
                "form",
                "GENZModelsForm"
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
                            missing.length > 0

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
       VALIDATE MODULE FUNCTION
    ===================================================== */

    function requireFunction(
        module,
        moduleName,
        functionName
    ) {

        if (
            !module
        ) {

            throw new Error(
                moduleName +
                " belum tersedia."
            );

        }


        if (
            typeof module[
                functionName
            ] !==
            "function"
        ) {

            throw new Error(
                moduleName +
                "." +
                functionName +
                "() tidak tersedia."
            );

        }


        return module[
            functionName
        ];

    }


    /* =====================================================
       PROVIDER
       -----------------------------------------------------
       Provider module adalah owner Provider lifecycle.
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

       Init hanya memanggil initialize().
       Tidak memanggil setProviders() lagi apabila
       initialize() tersedia.
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
         * Jalur ini hanya dipakai jika module
         * dropdown belum mempunyai initialize().
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


            console.info(
                "[GEN-Z.AI] Provider dropdown initialized through compatibility fallback."
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
       UI menangani state/tampilan umum.

       UI tidak menangani lifecycle module lain.
    ===================================================== */

    async function initializeUI() {

        const ui =
            window.GENZModelsUI;


        requireFunction(
            ui,
            "GENZModelsUI",
            "initialize"
        );


        return await ui.initialize();

    }


    /* =====================================================
       SEARCH
    ===================================================== */

    function initializeSearch() {

        const search =
            window.GENZModelsSearch;


        requireFunction(
            search,
            "GENZModelsSearch",
            "initialize"
        );


        const result =
            search.initialize();


        console.info(
            "[GEN-Z.AI] Model search initialized."
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


        requireFunction(
            events,
            "GENZModelSearchEvents",
            "bind"
        );


        const result =
            events.bind();


        console.info(
            "[GEN-Z.AI] Model search events initialized."
        );


        return (
            result !== false
        );

    }


    /* =====================================================
       FORM
       -----------------------------------------------------
       Form module utama diberi kesempatan initialize
       sebelum Form Events dipasang.

       CRUD module tidak diinitialize di sini karena
       coordinator yang menjadi penghubung CRUD.
    ===================================================== */

    async function initializeForm() {

        const form =
            window.GENZModelsForm;


        if (
            !form
        ) {

            throw new Error(
                "GENZModelsForm belum tersedia."
            );

        }


        if (
            typeof form.initialize ===
            "function"
        ) {

            const result =
                await form.initialize();


            console.info(
                "[GEN-Z.AI] Model form initialized."
            );


            return (
                result !== false
            );

        }


        console.info(
            "[GEN-Z.AI] GENZModelsForm tidak memiliki initialize(); menggunakan lifecycle coordinator."
        );


        return true;

    }


    /* =====================================================
       FORM EVENTS
    ===================================================== */

    function initializeFormEvents() {

        const events =
            window.GENZModelFormEvents;


        requireFunction(
            events,
            "GENZModelFormEvents",
            "bind"
        );


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
       -----------------------------------------------------
       Table renderer adalah owner Table.

       Init hanya melakukan initialization dan
       memastikan catalog sudah tersinkron.
    ===================================================== */

    function initializeTable() {

        const table =
            window.GENZModelTable;


        if (
            !table
        ) {

            throw new Error(
                "GENZModelTable belum tersedia."
            );

        }


        if (
            typeof table.initialize ===
            "function"
        ) {

            const result =
                table.initialize();


            console.info(
                "[GEN-Z.AI] Model table initialized."
            );


            return (
                result !== false
            );

        }


        return true;

    }


    /* =====================================================
       TABLE EVENTS
    ===================================================== */

    function initializeTableEvents() {

        const events =
            window.GENZModelTableEvents;


        requireFunction(
            events,
            "GENZModelTableEvents",
            "bind"
        );


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
       Read-only.
       Tidak merender dropdown.
    ===================================================== */

    function syncProviderState() {

        const provider =
            window.GENZModelsProvider;


        if (
            !provider ||
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
       -----------------------------------------------------
       Dependency order:

       1. Wait modules
       2. Provider
       3. Provider dropdown
       4. UI
       5. Form
       6. Search
       7. Search events
       8. Form events
       9. Table
       10. Table events
       11. Final provider state
       12. Ready

       Catatan:
       UI melakukan catalog synchronization.

       Init TIDAK mengulang:
       - search.setModels()
       - table.setModels()
       - table.render()
       - provider.setProviders()

       supaya tidak ada double owner.
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

                    console.info(
                        "[GEN-Z.AI] Models initialization mulai..."
                    );


                    /* =========================================
                       1. WAIT MODULES
                    ========================================= */

                    await waitForModules();


                    console.info(
                        "[GEN-Z.AI] Semua Models module tersedia."
                    );


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
                       5. FORM
                    ========================================= */

                    await initializeForm();


                    /* =========================================
                       6. SEARCH
                    ========================================= */

                    initializeSearch();


                    /* =========================================
                       7. SEARCH EVENTS
                    ========================================= */

                    initializeSearchEvents();


                    /* =========================================
                       8. FORM EVENTS
                    ========================================= */

                    initializeFormEvents();


                    /* =========================================
                       9. TABLE
                    ========================================= */

                    initializeTable();


                    /* =========================================
                       10. TABLE EVENTS
                    ========================================= */

                    initializeTableEvents();


                    /* =========================================
                       11. PROVIDER STATE
                       -----------------------------------------
                       READ ONLY.
                       Tidak render dropdown.
                    ========================================= */

                    const providers =
                        syncProviderState();


                    console.info(
                        "[GEN-Z.AI] Provider state:",
                        providers.length
                    );


                    /* =========================================
                       12. READY
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
                            "[GEN-Z.AI] Models initialized event gagal:",
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

                    } catch (eventError) {

                        console.warn(
                            "[GEN-Z.AI] Models error event gagal:",
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
       -----------------------------------------------------
       Reset event listeners saja.

       State owner tidak dihancurkan.
       ===================================================== */

    function reset() {

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
           SEARCH EVENTS
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

        return (
            initialized
        );

    }


    function isInitializing() {

        return (
            !!initializingPromise
        );

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

            initializeForm,

            initializeSearch,

            initializeSearchEvents,

            initializeFormEvents,

            initializeTable,

            initializeTableEvents,

            waitForModules,

            syncProviderState,

            isInitialized,

            isInitializing,

            reset

        });


    console.info(
        "[GEN-Z.AI] GENZModelsInit loaded."
    );

})();
