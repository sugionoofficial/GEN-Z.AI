/* =========================================================
   GEN-Z.AI
   ADMIN MODEL MANAGEMENT
   MODEL INITIALIZATION MODULE
   ---------------------------------------------------------
   File:
   admin-control/models/models-init.js

   TANGGUNG JAWAB:
   - Bootstrap seluruh module Models
   - Memastikan dependency tersedia
   - Menjalankan lifecycle initialization
   - Sinkronisasi antar module
   - Menjaga state Models tetap konsisten

   PRICING:
       models.credit_480p
       models.credit_720p
       models.credit_1080p
       models.discount_percent

   CREDIT FINAL:
       Dihitung runtime oleh GENZModelsPrice.
       Tidak dibaca sebagai kolom database.

   TIDAK MENANGANI:
   - Query Supabase langsung
   - Provider CRUD
   - Model CRUD
   - KIE API
   - Perhitungan pricing sendiri
   - Render UI secara langsung
========================================================= */

(function () {

    "use strict";


    /* =====================================================
       STATE
    ===================================================== */

    let initialized =
        false;

    let initializing =
        false;

    let initializationPromise =
        null;


    /* =====================================================
       REQUIRED MODULES
       ===================================================== */

    const REQUIRED_MODULES = Object.freeze([

        "GENZModelsData",

        "GENZModelsProvider",

        "GENZModelProviderDropdown",

        "GENZModelsSearch",

        "GENZModelsSearchEvents",

        "GENZModelsPageSearch",

        "GENZModelsFormEvents",

        "GENZModelFormCoordinator",

        "GENZModelsFormLayout",

        "GENZModelsFormCreate",

        "GENZModelsFormEdit",

        "GENZModelsFormDelete",

        "GENZModelsPrice",

        "GENZModelPriceCalculation",

        "GENZModelsTable",

        "GENZModelsTableEvents",

        "GENZModelsUI"

    ]);


    /* =====================================================
       OPTIONAL MODULES
       ===================================================== */

    const OPTIONAL_MODULES = Object.freeze([

        /*
         * Tidak semua deployment membutuhkan
         * module tambahan ini.
         */

        "GENZModelsLoader"

    ]);


    /* =====================================================
       UTILITY
       ===================================================== */

    function getGlobal(
        name
    ) {

        if (
            !name
        ) {

            return null;

        }


        return (
            window[name] ||
            null
        );

    }


    function hasFunction(
        object,
        method
    ) {

        return (
            object &&
            typeof object[method] ===
            "function"
        );

    }


    function getModuleStatus() {

        const required = {};

        const optional = {};


        REQUIRED_MODULES.forEach(
            function (
                name
            ) {

                required[name] =
                    Boolean(
                        getGlobal(
                            name
                        )
                    );

            }
        );


        OPTIONAL_MODULES.forEach(
            function (
                name
            ) {

                optional[name] =
                    Boolean(
                        getGlobal(
                            name
                        )
                    );

            }
        );


        return {

            required,

            optional

        };

    }


    /* =====================================================
       VERIFY REQUIRED MODULES
       ===================================================== */

    function verifyRequiredModules() {

        const missing = [];


        REQUIRED_MODULES.forEach(
            function (
                name
            ) {

                if (
                    !getGlobal(
                        name
                    )
                ) {

                    missing.push(
                        name
                    );

                }

            }
        );


        if (
            missing.length > 0
        ) {

            throw new Error(
                "[GEN-Z.AI] Module Models belum tersedia: " +
                missing.join(
                    ", "
                )
            );

        }


        return true;

    }


    /* =====================================================
       MODULE ACCESSORS
       ===================================================== */

    function getDataModule() {

        return getGlobal(
            "GENZModelsData"
        );

    }


    function getProviderModule() {

        return getGlobal(
            "GENZModelsProvider"
        );

    }


    function getProviderDropdownModule() {

        return getGlobal(
            "GENZModelProviderDropdown"
        );

    }


    function getSearchModule() {

        return getGlobal(
            "GENZModelsSearch"
        );

    }


    function getSearchEventsModule() {

        return getGlobal(
            "GENZModelsSearchEvents"
        );

    }


    function getPageSearchModule() {

        return getGlobal(
            "GENZModelsPageSearch"
        );

    }


    function getFormEventsModule() {

        return getGlobal(
            "GENZModelsFormEvents"
        );

    }


    function getFormCoordinatorModule() {

        return getGlobal(
            "GENZModelFormCoordinator"
        );

    }


    function getFormLayoutModule() {

        return getGlobal(
            "GENZModelsFormLayout"
        );

    }


    function getFormCreateModule() {

        return getGlobal(
            "GENZModelsFormCreate"
        );

    }


    function getFormEditModule() {

        return getGlobal(
            "GENZModelsFormEdit"
        );

    }


    function getFormDeleteModule() {

        return getGlobal(
            "GENZModelsFormDelete"
        );

    }


    function getPriceModule() {

        return getGlobal(
            "GENZModelsPrice"
        );

    }


    function getPriceCalculationModule() {

        return getGlobal(
            "GENZModelPriceCalculation"
        );

    }


    function getTableModule() {

        return getGlobal(
            "GENZModelsTable"
        );

    }


    function getTableEventsModule() {

        return getGlobal(
            "GENZModelsTableEvents"
        );

    }


    function getUIModule() {

        return getGlobal(
            "GENZModelsUI"
        );

    }


    /* =====================================================
       INITIALIZE DATA
       ===================================================== */

    async function initializeData() {

        const data =
            getDataModule();


        if (
            !data
        ) {

            throw new Error(
                "[GEN-Z.AI] GENZModelsData tidak tersedia."
            );

        }


        if (
            hasFunction(
                data,
                "initialize"
            )
        ) {

            return await data.initialize();

        }


        if (
            hasFunction(
                data,
                "loadModels"
            )
        ) {

            return await data.loadModels(
                {
                    force:
                        false
                }
            );

        }


        return [];

    }


    /* =====================================================
       INITIALIZE PROVIDER
       ===================================================== */

    async function initializeProvider() {

        const provider =
            getProviderModule();


        if (
            !provider
        ) {

            return null;

        }


        if (
            hasFunction(
                provider,
                "initialize"
            )
        ) {

            return await provider.initialize();

        }


        if (
            hasFunction(
                provider,
                "loadProviders"
            )
        ) {

            return await provider.loadProviders();

        }


        return null;

    }


    /* =====================================================
       INITIALIZE PROVIDER DROPDOWN
       ===================================================== */

    async function initializeProviderDropdown() {

        const dropdown =
            getProviderDropdownModule();


        if (
            !dropdown
        ) {

            return null;

        }


        if (
            hasFunction(
                dropdown,
                "initialize"
            )
        ) {

            return await dropdown.initialize();

        }


        return null;

    }


    /* =====================================================
       INITIALIZE UI
       ===================================================== */

    async function initializeUI() {

        const ui =
            getUIModule();


        if (
            !ui
        ) {

            return null;

        }


        if (
            hasFunction(
                ui,
                "initialize"
            )
        ) {

            return await ui.initialize();

        }


        return null;

    }


    /* =====================================================
       INITIALIZE FORM LAYOUT
       ===================================================== */

    async function initializeFormLayout() {

        const layout =
            getFormLayoutModule();


        if (
            !layout
        ) {

            return null;

        }


        if (
            hasFunction(
                layout,
                "initialize"
            )
        ) {

            return await layout.initialize();

        }


        return null;

    }


    /* =====================================================
       INITIALIZE PRICE
       -----------------------------------------------------
       GENZModelsPrice bertanggung jawab penuh terhadap
       pricing.

       Init TIDAK menghitung credit sendiri.
       ===================================================== */

    async function initializePrice() {

        const price =
            getPriceModule();


        if (
            !price
        ) {

            return null;

        }


        if (
            hasFunction(
                price,
                "initialize"
            )
        ) {

            try {

                return await price.initialize();

            } catch (
                error
            ) {

                /*
                 * Pricing bukan alasan halaman Models
                 * harus gagal total.
                 */

                console.warn(
                    "[GEN-Z.AI] Pricing initialization dilewati:",
                    error
                );


                return [];

            }

        }


        return null;

    }


    /* =====================================================
       INITIALIZE PRICE CALCULATION
       ===================================================== */

    async function initializePriceCalculation() {

        const priceCalculation =
            getPriceCalculationModule();


        if (
            !priceCalculation
        ) {

            return null;

        }


        if (
            hasFunction(
                priceCalculation,
                "bind"
            )
        ) {

            return await priceCalculation.bind();

        }


        if (
            hasFunction(
                priceCalculation,
                "initialize"
            )
        ) {

            return await priceCalculation.initialize();

        }


        return null;

    }


    /* =====================================================
       INITIALIZE SEARCH
       ===================================================== */

    async function initializeSearch() {

        const search =
            getSearchModule();


        if (
            !search
        ) {

            return null;

        }


        if (
            hasFunction(
                search,
                "initialize"
            )
        ) {

            return await search.initialize();

        }


        return null;

    }


    /* =====================================================
       INITIALIZE SEARCH EVENTS
       ===================================================== */

    async function initializeSearchEvents() {

        const searchEvents =
            getSearchEventsModule();


        if (
            !searchEvents
        ) {

            return null;

        }


        if (
            hasFunction(
                searchEvents,
                "bind"
            )
        ) {

            return await searchEvents.bind();

        }


        if (
            hasFunction(
                searchEvents,
                "initialize"
            )
        ) {

            return await searchEvents.initialize();

        }


        return null;

    }


    /* =====================================================
       INITIALIZE FORM EVENTS
       ===================================================== */

    async function initializeFormEvents() {

        const formEvents =
            getFormEventsModule();


        if (
            !formEvents
        ) {

            return null;

        }


        if (
            hasFunction(
                formEvents,
                "bind"
            )
        ) {

            return await formEvents.bind();

        }


        if (
            hasFunction(
                formEvents,
                "initialize"
            )
        ) {

            return await formEvents.initialize();

        }


        return null;

    }


    /* =====================================================
       INITIALIZE TABLE EVENTS
       ===================================================== */

    async function initializeTableEvents() {

        const tableEvents =
            getTableEventsModule();


        if (
            !tableEvents
        ) {

            return null;

        }


        if (
            hasFunction(
                tableEvents,
                "bind"
            )
        ) {

            return await tableEvents.bind();

        }


        if (
            hasFunction(
                tableEvents,
                "initialize"
            )
        ) {

            return await tableEvents.initialize();

        }


        return null;

    }


    /* =====================================================
       INITIALIZE PAGE SEARCH
       ===================================================== */

    async function initializePageSearch() {

        const pageSearch =
            getPageSearchModule();


        if (
            !pageSearch
        ) {

            return null;

        }


        if (
            hasFunction(
                pageSearch,
                "initialize"
            )
        ) {

            return await pageSearch.initialize();

        }


        if (
            hasFunction(
                pageSearch,
                "bind"
            )
        ) {

            return await pageSearch.bind();

        }


        return null;

    }


    /* =====================================================
       SYNC SEARCH WITH MODELS
       ===================================================== */

    function syncSearchWithModels(
        models
    ) {

        const search =
            getSearchModule();


        if (
            !search
        ) {

            return;

        }


        if (
            hasFunction(
                search,
                "setModels"
            )
        ) {

            search.setModels(
                Array.isArray(
                    models
                )
                    ? models
                    : []
            );

        }


        if (
            hasFunction(
                search,
                "syncModels"
            )
        ) {

            search.syncModels(
                Array.isArray(
                    models
                )
                    ? models
                    : []
            );

        }

    }


    /* =====================================================
       SYNC TABLE WITH MODELS
       ===================================================== */

    function syncTableWithModels(
        models
    ) {

        const table =
            getTableModule();


        if (
            !table
        ) {

            return;

        }


        if (
            hasFunction(
                table,
                "setModels"
            )
        ) {

            table.setModels(
                Array.isArray(
                    models
                )
                    ? models
                    : []
            );

        }


        if (
            hasFunction(
                table,
                "setData"
            )
        ) {

            table.setData(
                Array.isArray(
                    models
                )
                    ? models
                    : []
            );

        }


        if (
            hasFunction(
                table,
                "render"
            )
        ) {

            table.render();

        }

    }


    /* =====================================================
       SYNC PRICING WITH MODELS
       -----------------------------------------------------
       Pricing hanya melakukan normalisasi/cache.

       Tidak ada perhitungan harga di init.
       ===================================================== */

    function syncPriceWithModels(
        models
    ) {

        const price =
            getPriceModule();


        if (
            !price
        ) {

            return [];

        }


        if (
            hasFunction(
                price,
                "syncFromModels"
            )
        ) {

            try {

                return price.syncFromModels(
                    Array.isArray(
                        models
                    )
                        ? models
                        : []
                );

            } catch (
                error
            ) {

                console.warn(
                    "[GEN-Z.AI] Sinkronisasi pricing dilewati:",
                    error
                );

                return [];

            }

        }


        return [];

    }


    /* =====================================================
       SYNC PROVIDERS
       ===================================================== */

    function syncProviderDropdown(
        providers
    ) {

        const dropdown =
            getProviderDropdownModule();


        if (
            !dropdown
        ) {

            return;

        }


        const providerList =
            Array.isArray(
                providers
            )
                ? providers
                : [];


        if (
            hasFunction(
                dropdown,
                "setProviders"
            )
        ) {

            dropdown.setProviders(
                providerList
            );

        }


        if (
            hasFunction(
                dropdown,
                "syncProviders"
            )
        ) {

            dropdown.syncProviders(
                providerList
            );

        }


        if (
            hasFunction(
                dropdown,
                "render"
            )
        ) {

            dropdown.render();

        }

    }


    /* =====================================================
       GET CACHED MODELS
       ===================================================== */

    function getCachedModels() {

        const data =
            getDataModule();


        if (
            !data
        ) {

            return [];

        }


        if (
            hasFunction(
                data,
                "getCachedModels"
            )
        ) {

            const models =
                data.getCachedModels();


            return Array.isArray(
                models
            )
                ? models
                : [];

        }


        return [];

    }


    /* =====================================================
       GET CACHED PROVIDERS
       ===================================================== */

    function getCachedProviders() {

        const provider =
            getProviderModule();


        if (
            !provider
        ) {

            return [];

        }


        if (
            hasFunction(
                provider,
                "getCachedProviders"
            )
        ) {

            const providers =
                provider.getCachedProviders();


            return Array.isArray(
                providers
            )
                ? providers
                : [];

        }


        return [];

    }


    /* =====================================================
       SYNC FINAL STATE
       ===================================================== */

    function syncFinalState(
        models = null,
        providers = null
    ) {

        const finalModels =
            Array.isArray(
                models
            )
                ? models
                : getCachedModels();


        const finalProviders =
            Array.isArray(
                providers
            )
                ? providers
                : getCachedProviders();


        /*
         * Pricing sync dilakukan lebih dahulu
         * agar UI/table yang membutuhkan pricing
         * membaca cache terbaru.
         */

        syncPriceWithModels(
            finalModels
        );


        /*
         * Search.
         */

        syncSearchWithModels(
            finalModels
        );


        /*
         * Table.
         */

        syncTableWithModels(
            finalModels
        );


        /*
         * Provider dropdown.
         */

        syncProviderDropdown(
            finalProviders
        );


        return {

            models:
                finalModels,

            providers:
                finalProviders

        };

    }


    /* =====================================================
       INITIALIZE CORE LIFECYCLE
       ===================================================== */

    async function initializeCore() {

        verifyRequiredModules();


        /*
         * 1. Data
         *
         * Source of model configuration.
         */

        const models =
            await initializeData();


        /*
         * 2. Provider
         *
         * Provider lifecycle tetap berada
         * di provider module.
         */

        const providers =
            await initializeProvider();


        /*
         * 3. Provider dropdown.
         */

        await initializeProviderDropdown();


        /*
         * 4. UI.
         */

        await initializeUI();


        /*
         * 5. Form layout.
         */

        await initializeFormLayout();


        /*
         * 6. Pricing.
         *
         * Tidak menghitung pricing di sini.
         * GENZModelsPrice yang bertanggung jawab.
         */

        await initializePrice();


        /*
         * 7. Price calculation events.
         */

        await initializePriceCalculation();


        /*
         * 8. Search.
         */

        await initializeSearch();

        await initializeSearchEvents();


        /*
         * 9. Form events.
         */

        await initializeFormEvents();


        /*
         * 10. Table events.
         */

        await initializeTableEvents();


        /*
         * 11. Page search.
         */

        await initializePageSearch();


        /*
         * 12. Final synchronization.
         */

        const finalState =
            syncFinalState(
                Array.isArray(
                    models
                )
                    ? models
                    : null,

                Array.isArray(
                    providers
                )
                    ? providers
                    : null
            );


        return finalState;

    }


    /* =====================================================
       INITIALIZE
       ===================================================== */

    async function initialize() {

        if (
            initialized
        ) {

            /*
             * Jangan bootstrap ulang.
             *
             * Hanya sinkronisasi ringan agar cache
             * pricing mengikuti ModelData terbaru.
             */

            const models =
                getCachedModels();


            const providers =
                getCachedProviders();


            syncFinalState(
                models,
                providers
            );


            return {

                initialized:
                    true,

                models,

                providers

            };

        }


        if (
            initializing &&
            initializationPromise
        ) {

            return await initializationPromise;

        }


        initializing =
            true;


        initializationPromise =
            (async function () {

                try {

                    const result =
                        await initializeCore();


                    initialized =
                        true;


                    console.info(
                        "[GEN-Z.AI] Models lifecycle initialized."
                    );


                    return {

                        initialized:
                            true,

                        models:
                            result.models,

                        providers:
                            result.providers

                    };

                } catch (
                    error
                ) {

                    initialized =
                        false;


                    console.error(
                        "[GEN-Z.AI] Models initialization gagal:",
                        error
                    );


                    throw error;

                } finally {

                    initializing =
                        false;

                    initializationPromise =
                        null;

                }

            })();


        return await initializationPromise;

    }


    /* =====================================================
       RESET PRICE
       ===================================================== */

    function resetPrice() {

        const price =
            getPriceModule();


        if (
            price &&
            hasFunction(
                price,
                "reset"
            )
        ) {

            price.reset();

        }

    }


    /* =====================================================
       RESET PRICE CALCULATION
       ===================================================== */

    function resetPriceCalculation() {

        const priceCalculation =
            getPriceCalculationModule();


        if (
            !priceCalculation
        ) {

            return;

        }


        if (
            hasFunction(
                priceCalculation,
                "destroy"
            )
        ) {

            priceCalculation.destroy();

            return;

        }


        if (
            hasFunction(
                priceCalculation,
                "unbind"
            )
        ) {

            priceCalculation.unbind();

        }

    }


    /* =====================================================
       RESET SEARCH EVENTS
       ===================================================== */

    function resetSearchEvents() {

        const searchEvents =
            getSearchEventsModule();


        if (
            !searchEvents
        ) {

            return;

        }


        if (
            hasFunction(
                searchEvents,
                "destroy"
            )
        ) {

            searchEvents.destroy();

            return;

        }


        if (
            hasFunction(
                searchEvents,
                "unbind"
            )
        ) {

            searchEvents.unbind();

        }

    }


    /* =====================================================
       RESET PAGE SEARCH
       ===================================================== */

    function resetPageSearch() {

        const pageSearch =
            getPageSearchModule();


        if (
            !pageSearch
        ) {

            return;

        }


        if (
            hasFunction(
                pageSearch,
                "destroy"
            )
        ) {

            pageSearch.destroy();

            return;

        }


        if (
            hasFunction(
                pageSearch,
                "unbind"
            )
        ) {

            pageSearch.unbind();

        }

    }


    /* =====================================================
       RESET FORM EVENTS
       ===================================================== */

    function resetFormEvents() {

        const formEvents =
            getFormEventsModule();


        if (
            !formEvents
        ) {

            return;

        }


        if (
            hasFunction(
                formEvents,
                "destroy"
            )
        ) {

            formEvents.destroy();

            return;

        }


        if (
            hasFunction(
                formEvents,
                "unbind"
            )
        ) {

            formEvents.unbind();

        }

    }


    /* =====================================================
       RESET TABLE EVENTS
       ===================================================== */

    function resetTableEvents() {

        const tableEvents =
            getTableEventsModule();


        if (
            !tableEvents
        ) {

            return;

        }


        if (
            hasFunction(
                tableEvents,
                "destroy"
            )
        ) {

            tableEvents.destroy();

            return;

        }


        if (
            hasFunction(
                tableEvents,
                "unbind"
            )
        ) {

            tableEvents.unbind();

        }

    }


    /* =====================================================
       RESET
       ===================================================== */

    function reset() {

        /*
         * Lepaskan event listeners lebih dahulu.
         */

        resetFormEvents();

        resetTableEvents();

        resetSearchEvents();

        resetPageSearch();

        resetPriceCalculation();


        /*
         * Reset pricing cache.
         */

        resetPrice();


        /*
         * State init.
         */

        initialized =
            false;

        initializing =
            false;

        initializationPromise =
            null;


        console.info(
            "[GEN-Z.AI] Models lifecycle reset."
        );

    }


    /* =====================================================
       STATUS
       ===================================================== */

    function getStatus() {

        const data =
            getDataModule();

        const provider =
            getProviderModule();

        const price =
            getPriceModule();

        const models =
            getCachedModels();

        const providers =
            getCachedProviders();


        return {

            initialized,

            initializing,

            modules:
                getModuleStatus(),

            dataReady:
                Boolean(
                    data
                ),

            providerReady:
                Boolean(
                    provider
                ),

            pricingReady:
                Boolean(
                    price
                ),

            modelCount:
                models.length,

            providerCount:
                providers.length,

            pricingCount:
                price &&
                hasFunction(
                    price,
                    "getCachedPricing"
                )
                    ? price
                        .getCachedPricing()
                        .length
                    : 0

        };

    }


    /* =====================================================
       GET STATE
       ===================================================== */

    function getState() {

        return {

            initialized,

            initializing,

            status:
                getStatus(),

            models:
                getCachedModels(),

            providers:
                getCachedProviders()

        };

    }


    /* =====================================================
       PUBLIC API
       ===================================================== */

    window.GENZModelsInit =
        Object.freeze({

            /*
             * Lifecycle
             */

            initialize,

            reset,


            /*
             * Initialization helpers
             */

            initializeData,

            initializeProvider,

            initializeProviderDropdown,

            initializeUI,

            initializeFormLayout,

            initializePrice,

            initializePriceCalculation,

            initializeSearch,

            initializeSearchEvents,

            initializeFormEvents,

            initializeTableEvents,

            initializePageSearch,


            /*
             * Synchronization
             */

            syncSearchWithModels,

            syncTableWithModels,

            syncPriceWithModels,

            syncProviderDropdown,

            syncFinalState,


            /*
             * State
             */

            getCachedModels,

            getCachedProviders,

            getStatus,

            getState,


            /*
             * Verification
             */

            verifyRequiredModules,

            getModuleStatus

        });


    console.info(
        "[GEN-Z.AI] GENZModelsInit loaded."
    );

})();
