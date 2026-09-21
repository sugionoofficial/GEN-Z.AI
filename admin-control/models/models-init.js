/* =========================================================
   GEN-Z.AI
   MODELS INITIALIZATION MODULE
   ---------------------------------------------------------
   File:
   admin-control/models/models-init.js

   Tanggung jawab:
   - Lifecycle halaman Models
   - Menunggu seluruh module siap
   - Initialize module sesuai dependency
   - Sinkronisasi state antar module
   - Reset lifecycle

   SUMBER DATA:
   ---------------------------------------------------------
   Models:
       models

   Providers:
       providers

   Pricing:
       models.credit_480p
       models.credit_720p
       models.credit_1080p
       models.discount_percent

   CREDIT FINAL:
   ---------------------------------------------------------
   Tidak disimpan sebagai kolom database.

   Credit final dihitung runtime:

       final =
           credit -
           (
               credit *
               discount_percent /
               100
           )

   RELATION:
       models.provider_id
            ↓
       providers.id

   TIDAK MENGGUNAKAN:
       kie_models
       kie_workflows
       kie_workflow_variants
       kie_parameters
       kie_constraints
       kie_dependencies
       kie_pricing

   CATATAN:
   ---------------------------------------------------------
   GENZModelsForm legacy tidak menjadi dependency.
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

            pageSearch:
                window.GENZModelPageSearch ||
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
       REQUIRED MODULES
    ===================================================== */

    const REQUIRED_MODULES = [

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


    /* =====================================================
       REQUIRED MODULE CHECK
       ===================================================== */

    function modulesReady() {

        const modules =
            getModules();


        return REQUIRED_MODULES.every(
            function (item) {

                return Boolean(
                    modules[item[0]]
                );

            }
        );

    }


    /* =====================================================
       MISSING MODULES
       ===================================================== */

    function getMissingModules() {

        const modules =
            getModules();


        return REQUIRED_MODULES
            .filter(
                function (item) {

                    return !modules[
                        item[0]
                    ];

                }
            )
            .map(
                function (item) {

                    return item[1];

                }
            );

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

                const startedAt =
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
                        startedAt >=
                        timeout
                    ) {

                        const missing =
                            getMissingModules();


                        reject(
                            new Error(
                                missing.length

                                    ?

                                    (
                                        "Module halaman Models belum lengkap: " +
                                        missing.join(
                                            ", "
                                        )
                                    )

                                    :

                                    "Module halaman Models belum lengkap."
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
       ===================================================== */

    async function initializeProvider() {

        const provider =
            window.GENZModelsProvider;


        if (!provider) {

            throw new Error(
                "GENZModelsProvider belum tersedia."
            );

        }


        if (
            typeof provider.initialize ===
            "function"
        ) {

            const result =
                await provider.initialize();


            if (
                result === false
            ) {

                throw new Error(
                    "GENZModelsProvider.initialize() gagal."
                );

            }


            return true;

        }


        if (
            typeof provider.loadProviders ===
            "function"
        ) {

            const result =
                await provider.loadProviders();


            if (
                result === false
            ) {

                throw new Error(
                    "GENZModelsProvider.loadProviders() gagal."
                );

            }


            return true;

        }


        throw new Error(
            "GENZModelsProvider tidak memiliki lifecycle yang valid."
        );

    }


    /* =====================================================
       PROVIDER DROPDOWN
       ===================================================== */

    async function initializeProviderDropdown() {

        const dropdown =
            window.GENZModelProviderDropdown;


        if (!dropdown) {

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


            if (
                result === false
            ) {

                throw new Error(
                    "GENZModelProviderDropdown.initialize() gagal."
                );

            }


            return true;

        }


        /*
         * Compatibility fallback.
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
            "GENZModelProviderDropdown tidak memiliki lifecycle yang valid."
        );

    }


    /* =====================================================
       UI
       ===================================================== */

    async function initializeUI() {

        const ui =
            window.GENZModelsUI;


        if (!ui) {

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


        const result =
            await ui.initialize();


        if (
            result === false
        ) {

            throw new Error(
                "GENZModelsUI.initialize() gagal."
            );

        }


        return true;

    }


    /* =====================================================
       FORM LAYOUT
       -----------------------------------------------------
       Layout TIDAK mempunyai lifecycle global.

       Render/attach dilakukan ketika modal form dibuat.
       ===================================================== */

    function initializeFormLayout() {

        const layout =
            window.GENZModelFormLayout;


        if (!layout) {

            throw new Error(
                "GENZModelFormLayout belum tersedia."
            );

        }


        const requiredFunctions = [

            "renderModelForm",

            "collectModelFormData",

            "validateModelFormData",

            "normalizeModelSubmission"

        ];


        const missing =
            requiredFunctions.filter(
                function (name) {

                    return (
                        typeof layout[name] !==
                        "function"
                    );

                }
            );


        if (
            missing.length
        ) {

            throw new Error(
                "GENZModelFormLayout API belum lengkap: " +
                missing.join(
                    ", "
                )
            );

        }


        return true;

    }


    /* =====================================================
       PRICE DATA
       -----------------------------------------------------
       Pricing berasal dari Models Data.

       Field aktif:
           credit_480p
           credit_720p
           credit_1080p
           discount_percent

       credit_final TIDAK dibaca dari database.
       ===================================================== */

    async function initializePrice() {

        const price =
            window.GENZModelsPrice;


        if (!price) {

            throw new Error(
                "GENZModelsPrice belum tersedia."
            );

        }


        if (
            typeof price.initialize ===
            "function"
        ) {

            try {

                const result =
                    await price.initialize();


                if (
                    result === false
                ) {

                    console.warn(
                        "[GEN-Z.AI] Pricing initialize mengembalikan false."
                    );

                }

            } catch (
                error
            ) {

                /*
                 * Pricing bukan alasan halaman Models
                 * harus gagal total.
                 */

                console.warn(
                    "[GEN-Z.AI] Pricing cache initialization dilewati:",
                    error
                );

            }

        }


        return true;

    }


    /* =====================================================
       PRICE CALCULATION
       ===================================================== */

    function initializePriceCalculation() {

        const calculation =
            window.GENZModelPriceCalculation;


        if (!calculation) {

            throw new Error(
                "GENZModelPriceCalculation belum tersedia."
            );

        }


        /*
         * Form dapat dibuat ulang secara dinamis.
         *
         * Module kalkulasi menangani binding
         * berdasarkan element yang tersedia.
         */

        if (
            typeof calculation.bind ===
            "function"
        ) {

            const result =
                calculation.bind();


            if (
                result === false
            ) {

                throw new Error(
                    "GENZModelPriceCalculation.bind() gagal."
                );

            }


            return true;

        }


        if (
            typeof calculation.initialize ===
            "function"
        ) {

            const result =
                calculation.initialize();


            if (
                result === false
            ) {

                throw new Error(
                    "GENZModelPriceCalculation.initialize() gagal."
                );

            }


            return true;

        }


        throw new Error(
            "GENZModelPriceCalculation tidak memiliki bind() atau initialize()."
        );

    }


    /* =====================================================
       SEARCH CATALOG SYNC
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
            typeof search.setModels !==
            "function"
        ) {

            return false;

        }


        let models = [];


        if (
            typeof data.getCachedModels ===
            "function"
        ) {

            try {

                const cached =
                    data.getCachedModels();


                if (
                    Array.isArray(
                        cached
                    )
                ) {

                    models =
                        cached;

                }

            } catch (
                error
            ) {

                console.warn(
                    "[GEN-Z.AI] Model cache tidak dapat dibaca untuk search:",
                    error
                );

            }

        }


        /*
         * Jangan pernah membuat catalog manual.
         */

        search.setModels(
            Array.isArray(
                models
            )
                ? models
                : []
        );


        return true;

    }


    /* =====================================================
       SEARCH
       ===================================================== */

    function initializeSearch() {

        const search =
            window.GENZModelsSearch;


        if (!search) {

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


        if (
            result === false
        ) {

            throw new Error(
                "GENZModelsSearch.initialize() gagal."
            );

        }


        return true;

    }


    /* =====================================================
       SEARCH EVENTS
       ===================================================== */

    function initializeSearchEvents() {

        const events =
            window.GENZModelSearchEvents;


        if (!events) {

            throw new Error(
                "GENZModelSearchEvents belum tersedia."
            );

        }


        if (
            typeof events.bind ===
            "function"
        ) {

            const result =
                events.bind();


            if (
                result === false
            ) {

                throw new Error(
                    "GENZModelSearchEvents.bind() gagal."
                );

            }


            return true;

        }


        if (
            typeof events.initialize ===
            "function"
        ) {

            const result =
                events.initialize();


            if (
                result === false
            ) {

                throw new Error(
                    "GENZModelSearchEvents.initialize() gagal."
                );

            }


            return true;

        }


        throw new Error(
            "GENZModelSearchEvents tidak memiliki bind() atau initialize()."
        );

    }


    /* =====================================================
       PAGE SEARCH
       ===================================================== */

    function initializePageSearch() {

        const pageSearch =
            window.GENZModelPageSearch;


        if (!pageSearch) {

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


        if (
            result === false
        ) {

            throw new Error(
                "GENZModelPageSearch.initialize() gagal."
            );

        }


        return true;

    }


    /* =====================================================
       FORM EVENTS
       ===================================================== */

    function initializeFormEvents() {

        const events =
            window.GENZModelFormEvents;


        if (!events) {

            throw new Error(
                "GENZModelFormEvents belum tersedia."
            );

        }


        if (
            typeof events.bind ===
            "function"
        ) {

            const result =
                events.bind();


            if (
                result === false
            ) {

                throw new Error(
                    "GENZModelFormEvents.bind() gagal."
                );

            }


            return true;

        }


        if (
            typeof events.initialize ===
            "function"
        ) {

            const result =
                events.initialize();


            if (
                result === false
            ) {

                throw new Error(
                    "GENZModelFormEvents.initialize() gagal."
                );

            }


            return true;

        }


        throw new Error(
            "GENZModelFormEvents tidak memiliki bind() atau initialize()."
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
            typeof table.setModels !==
            "function"
        ) {

            return false;

        }


        let models = [];


        if (
            typeof data.getCachedModels ===
            "function"
        ) {

            try {

                const cached =
                    data.getCachedModels();


                if (
                    Array.isArray(
                        cached
                    )
                ) {

                    models =
                        cached;

                }

            } catch (
                error
            ) {

                console.warn(
                    "[GEN-Z.AI] Model cache tidak dapat dibaca untuk table:",
                    error
                );

            }

        }


        table.setModels(
            Array.isArray(
                models
            )
                ? models
                : []
        );


        if (
            typeof table.render ===
            "function"
        ) {

            table.render();

        }


        return true;

    }


    /* =====================================================
       TABLE EVENTS
       ===================================================== */

    function initializeTableEvents() {

        const events =
            window.GENZModelTableEvents;


        if (!events) {

            throw new Error(
                "GENZModelTableEvents belum tersedia."
            );

        }


        if (
            typeof events.bind ===
            "function"
        ) {

            const result =
                events.bind();


            if (
                result === false
            ) {

                throw new Error(
                    "GENZModelTableEvents.bind() gagal."
                );

            }


            return true;

        }


        if (
            typeof events.initialize ===
            "function"
        ) {

            const result =
                events.initialize();


            if (
                result === false
            ) {

                throw new Error(
                    "GENZModelTableEvents.initialize() gagal."
                );

            }


            return true;

        }


        throw new Error(
            "GENZModelTableEvents tidak memiliki bind() atau initialize()."
        );

    }


    /* =====================================================
       PROVIDER STATE
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
                ? [
                    ...providers
                ]
                : [];

        } catch (
            error
        ) {

            console.warn(
                "[GEN-Z.AI] Provider state sync gagal:",
                error
            );


            return [];

        }

    }


    /* =====================================================
       DATA STATE
       ===================================================== */

    function getModelsFromData() {

        const data =
            window.GENZModelsData;


        if (
            !data ||
            typeof data.getCachedModels !==
            "function"
        ) {

            return [];

        }


        try {

            const models =
                data.getCachedModels();


            return Array.isArray(
                models
            )
                ? [
                    ...models
                ]
                : [];

        } catch (
            error
        ) {

            console.warn(
                "[GEN-Z.AI] Model state tidak dapat dibaca:",
                error
            );


            return [];

        }

    }


    /* =====================================================
       FINAL STATE SYNC
       ===================================================== */

    function syncFinalState() {

        const models =
            getModelsFromData();


        const providers =
            syncProviderState();


        /*
         * Search catalog.
         */

        const search =
            window.GENZModelsSearch;


        if (
            search &&
            typeof search.setModels ===
            "function"
        ) {

            try {

                search.setModels(
                    models
                );

            } catch (
                error
            ) {

                console.warn(
                    "[GEN-Z.AI] Final search sync gagal:",
                    error
                );

            }

        }


        /*
         * Table.
         */

        const table =
            window.GENZModelTable;


        if (
            table &&
            typeof table.setModels ===
            "function"
        ) {

            try {

                table.setModels(
                    models
                );


                if (
                    typeof table.render ===
                    "function"
                ) {

                    table.render();

                }

            } catch (
                error
            ) {

                console.warn(
                    "[GEN-Z.AI] Final table sync gagal:",
                    error
                );

            }

        }


        /*
         * Provider dropdown.
         */

        const dropdown =
            window.GENZModelProviderDropdown;


        if (
            dropdown &&
            typeof dropdown.setProviders ===
            "function"
        ) {

            try {

                dropdown.setProviders(
                    providers
                );

            } catch (
                error
            ) {

                console.warn(
                    "[GEN-Z.AI] Final provider dropdown sync gagal:",
                    error
                );

            }

        }


        /*
         * Pricing cache.
         *
         * Hanya sinkronisasi dari Models Data.
         * Tidak membuat pricing manual.
         */

        const price =
            window.GENZModelsPrice;


        if (
            price &&
            typeof price.syncFromModels ===
            "function"
        ) {

            try {

                price.syncFromModels(
                    models
                );

            } catch (
                error
            ) {

                console.warn(
                    "[GEN-Z.AI] Final pricing sync gagal:",
                    error
                );

            }

        }


        return {

            models,

            providers

        };

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

                    /* =====================================
                       1. WAIT ALL MODULES
                    ===================================== */

                    await waitForModules();


                    /* =====================================
                       2. PROVIDER DATA
                    ===================================== */

                    await initializeProvider();


                    /* =====================================
                       3. PROVIDER DROPDOWN
                    ===================================== */

                    await initializeProviderDropdown();


                    /* =====================================
                       4. UI / MODEL DATA
                    ===================================== */

                    await initializeUI();


                    /* =====================================
                       5. FORM LAYOUT API
                    ===================================== */

                    initializeFormLayout();


                    /* =====================================
                       6. PRICE DATA
                    ===================================== */

                    await initializePrice();


                    /* =====================================
                       7. PRICE CALCULATION
                    ===================================== */

                    initializePriceCalculation();


                    /* =====================================
                       8. SEARCH CATALOG
                    ===================================== */

                    syncSearchWithModels();


                    /* =====================================
                       9. FORM MODEL SEARCH
                    ===================================== */

                    initializeSearch();


                    /* =====================================
                       10. SEARCH EVENTS
                    ===================================== */

                    initializeSearchEvents();


                    /* =====================================
                       11. FORM EVENTS
                    ===================================== */

                    initializeFormEvents();


                    /* =====================================
                       12. TABLE DATA
                    ===================================== */

                    syncTableWithModels();


                    /* =====================================
                       13. TABLE EVENTS
                    ===================================== */

                    initializeTableEvents();


                    /* =====================================
                       14. PAGE SEARCH
                    ===================================== */

                    initializePageSearch();


                    /* =====================================
                       15. FINAL SYNC
                    ===================================== */

                    const state =
                        syncFinalState();


                    /* =====================================
                       16. READY
                    ===================================== */

                    initialized =
                        true;


                    try {

                        document.dispatchEvent(
                            new CustomEvent(
                                "genz-models-initialized",
                                {
                                    detail: {

                                        models:
                                            state.models.length,

                                        providers:
                                            state.providers.length

                                    }
                                }
                            )
                        );

                    } catch (
                        eventError
                    ) {

                        console.warn(
                            "[GEN-Z.AI] Models initialized event gagal:",
                            eventError
                        );

                    }


                    console.info(
                        "[GEN-Z.AI] Models initialization complete."
                    );


                    return true;

                } catch (
                    error
                ) {

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


        /*
         * FORM EVENTS
         */

        const formEvents =
            window.GENZModelFormEvents;


        if (
            formEvents
        ) {

            try {

                if (
                    typeof formEvents.unbind ===
                    "function"
                ) {

                    formEvents.unbind();

                } else if (
                    typeof formEvents.destroy ===
                    "function"
                ) {

                    formEvents.destroy();

                }

            } catch (
                error
            ) {

                console.warn(
                    "[GEN-Z.AI] Form events reset gagal:",
                    error
                );

            }

        }


        /*
         * TABLE EVENTS
         */

        const tableEvents =
            window.GENZModelTableEvents;


        if (
            tableEvents
        ) {

            try {

                if (
                    typeof tableEvents.unbind ===
                    "function"
                ) {

                    tableEvents.unbind();

                } else if (
                    typeof tableEvents.destroy ===
                    "function"
                ) {

                    tableEvents.destroy();

                }

            } catch (
                error
            ) {

                console.warn(
                    "[GEN-Z.AI] Table events reset gagal:",
                    error
                );

            }

        }


        /*
         * MODEL SEARCH EVENTS
         */

        const searchEvents =
            window.GENZModelSearchEvents;


        if (
            searchEvents
        ) {

            try {

                if (
                    typeof searchEvents.unbind ===
                    "function"
                ) {

                    searchEvents.unbind();

                } else if (
                    typeof searchEvents.destroy ===
                    "function"
                ) {

                    searchEvents.destroy();

                }

            } catch (
                error
            ) {

                console.warn(
                    "[GEN-Z.AI] Search events reset gagal:",
                    error
                );

            }

        }


        /*
         * PAGE SEARCH
         */

        const pageSearch =
            window.GENZModelPageSearch;


        if (
            pageSearch
        ) {

            try {

                if (
                    typeof pageSearch.unbind ===
                    "function"
                ) {

                    pageSearch.unbind();

                } else if (
                    typeof pageSearch.destroy ===
                    "function"
                ) {

                    pageSearch.destroy();

                }

            } catch (
                error
            ) {

                console.warn(
                    "[GEN-Z.AI] Page search reset gagal:",
                    error
                );

            }

        }


        /*
         * PRICE CALCULATION
         */

        const priceCalculation =
            window.GENZModelPriceCalculation;


        if (
            priceCalculation
        ) {

            try {

                if (
                    typeof priceCalculation.unbind ===
                    "function"
                ) {

                    priceCalculation.unbind();

                } else if (
                    typeof priceCalculation.destroy ===
                    "function"
                ) {

                    priceCalculation.destroy();

                }

            } catch (
                error
            ) {

                console.warn(
                    "[GEN-Z.AI] Price calculation reset gagal:",
                    error
                );

            }

        }


        /*
         * PRICE CACHE
         *
         * Tidak wajib, tetapi jika tersedia
         * kita bersihkan agar lifecycle berikutnya
         * membaca state terbaru dari Models Data.
         */

        const price =
            window.GENZModelsPrice;


        if (
            price &&
            typeof price.clearCache ===
            "function"
        ) {

            try {

                price.clearCache();

            } catch (
                error
            ) {

                console.warn(
                    "[GEN-Z.AI] Pricing cache reset gagal:",
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

        return initialized;

    }


    function isInitializing() {

        return Boolean(
            initializingPromise
        );

    }


    /* =====================================================
       GET STATE
       ===================================================== */

    function getState() {

        const state =
            syncFinalState();


        return {

            initialized,

            initializing:
                Boolean(
                    initializingPromise
                ),

            modelsCount:
                state.models.length,

            providersCount:
                state.providers.length

        };

    }


    /* =====================================================
       PUBLIC API
       ===================================================== */

    window.GENZModelsInit =
        Object.freeze({

            initialize,

            reset,

            waitForModules,

            initializeProvider,

            initializeProviderDropdown,

            initializeUI,

            initializeFormLayout,

            initializePrice,

            initializePriceCalculation,

            initializeSearch,

            initializeSearchEvents,

            initializePageSearch,

            initializeFormEvents,

            initializeTableEvents,

            syncSearchWithModels,

            syncTableWithModels,

            syncProviderState,

            syncFinalState,

            getState,

            isInitialized,

            isInitializing

        });


    console.info(
        "[GEN-Z.AI] GENZModelsInit loaded."
    );


})();
