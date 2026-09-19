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
   - Sinkronisasi state antar module
   - Reset lifecycle

   Tidak bertanggung jawab:
   - Query Supabase langsung
   - Provider CRUD
   - Model CRUD
   - Search logic
   - Form CRUD
   - Table rendering
   - Price calculation logic
   - API provider
   - KIE workflow

   ARSITEKTUR:
       models-data
            ↓
       providers / models
            ↓
       UI / Form / Search / Table

   Sumber Model:
       models

   Sumber Provider:
       providers

   Sumber Pricing:
       models.credit_cost
       models.discount_percent
       models.credit_final

   Tidak menggunakan:
       kie_models
       kie_workflows
       kie_workflow_variants
       kie_parameters
       kie_constraints
       kie_dependencies
       kie_pricing

   LEGACY:
       GENZModelsForm tidak menjadi dependency lifecycle.
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
             */
            pageSearch:
                window.GENZModelPageSearch ||
                null,

            /*
             * Form architecture baru.
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

            /*
             * Pricing.
             */
            price:
                window.GENZModelsPrice ||
                null,

            priceCalculation:
                window.GENZModelPriceCalculation ||
                null,

            /*
             * Table.
             */
            table:
                window.GENZModelTable ||
                null,

            tableEvents:
                window.GENZModelTableEvents ||
                null,

            /*
             * UI orchestrator.
             */
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
            function (
                item
            ) {

                return !!modules[
                    item[0]
                ];

            }
        );

    }


    /* =====================================================
       GET MISSING MODULES
    ===================================================== */

    function getMissingModules() {

        const modules =
            getModules();


        return REQUIRED_MODULES
            .filter(
                function (
                    item
                ) {

                    return !modules[
                        item[0]
                    ];

                }
            )
            .map(
                function (
                    item
                ) {

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


                    const elapsed =
                        Date.now() -
                        start;


                    if (
                        elapsed >=
                        timeout
                    ) {

                        const missing =
                            getMissingModules();


                        reject(
                            new Error(
                                missing.length
                                    ? (
                                        "Module halaman Models belum lengkap: " +
                                        missing.join(
                                            ", "
                                        )
                                    )
                                    : (
                                        "Module halaman Models belum lengkap."
                                    )
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
            "GENZModelsProvider tidak memiliki lifecycle yang valid."
        );

    }


    /* =====================================================
       PROVIDER DROPDOWN
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


            return (
                result !== false
            );

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
       -----------------------------------------------------
       UI adalah orchestrator tampilan/state.
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


        const result =
            await ui.initialize();


        return (
            result !== false
        );

    }


    /* =====================================================
       FORM LAYOUT
       -----------------------------------------------------
       Layout hanya mengurus UI form.

       Tidak ada query database dari initializer.
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
            typeof layout.initialize ===
            "function"
        ) {

            const result =
                await layout.initialize();


            return (
                result !== false
            );

        }


        /*
         * Layout tidak wajib memiliki initialize().
         *
         * Jika API render/attach tersedia,
         * lifecycle tetap dapat berjalan.
         */

        if (
            typeof layout.attachModelFormEvents ===
            "function"
        ) {

            return (
                layout.attachModelFormEvents() !==
                false
            );

        }


        return true;

    }


    /* =====================================================
       PRICE
       -----------------------------------------------------
       GENZModelsPrice:
           membaca pricing dari models.

       GENZModelPriceCalculation:
           menghitung Credit Final pada form.
    ===================================================== */

    async function initializePrice() {

        const price =
            window.GENZModelsPrice;


        if (
            !price
        ) {

            throw new Error(
                "GENZModelsPrice belum tersedia."
            );

        }


        if (
            typeof price.initialize ===
            "function"
        ) {

            try {

                await price.initialize();

            } catch (
                error
            ) {

                /*
                 * Pricing tidak boleh membuat
                 * seluruh halaman Models mati.
                 *
                 * Data model tetap bisa digunakan.
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


        if (
            !calculation
        ) {

            throw new Error(
                "GENZModelPriceCalculation belum tersedia."
            );

        }


        /*
         * bind() adalah lifecycle utama module
         * kalkulasi harga.
         */

        if (
            typeof calculation.bind ===
            "function"
        ) {

            const result =
                calculation.bind();


            return (
                result !== false
            );

        }


        /*
         * Compatibility jika module menyediakan
         * initialize() tetapi tidak bind().
         */

        if (
            typeof calculation.initialize ===
            "function"
        ) {

            const result =
                calculation.initialize();


            return (
                result !== false
            );

        }


        throw new Error(
            "GENZModelPriceCalculation tidak memiliki bind() atau initialize()."
        );

    }


    /* =====================================================
       SEARCH CATALOG
       -----------------------------------------------------
       Search Model ID Form menggunakan catalog Models.
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


        /*
         * Prioritas:
         * getCachedModels()
         */

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
                    "[GEN-Z.AI] Cached Models tidak dapat dibaca:",
                    error
                );

            }

        }


        /*
         * Jika cache kosong, jangan mengarang
         * catalog Model ID.
         *
         * Search module sendiri dapat melakukan
         * refresh catalog.
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
       -----------------------------------------------------
       Search Model ID pada form.
    ===================================================== */

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
            typeof events.bind ===
            "function"
        ) {

            const result =
                events.bind();


            return (
                result !== false
            );

        }


        if (
            typeof events.initialize ===
            "function"
        ) {

            const result =
                events.initialize();


            return (
                result !== false
            );

        }


        throw new Error(
            "GENZModelSearchEvents tidak memiliki bind() atau initialize()."
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

       Berbeda dengan Search Model ID Form.
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
            typeof events.bind ===
            "function"
        ) {

            const result =
                events.bind();


            return (
                result !== false
            );

        }


        if (
            typeof events.initialize ===
            "function"
        ) {

            const result =
                events.initialize();


            return (
                result !== false
            );

        }


        throw new Error(
            "GENZModelFormEvents tidak memiliki bind() atau initialize()."
        );

    }


    /* =====================================================
       TABLE
       -----------------------------------------------------
       Table menggunakan data Models yang sudah dimuat
       oleh Models UI / Models Data.
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
            models
        );


        /*
         * Render hanya jika API tersedia.
         */

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


        if (
            !events
        ) {

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


            return (
                result !== false
            );

        }


        if (
            typeof events.initialize ===
            "function"
        ) {

            const result =
                events.initialize();


            return (
                result !== false
            );

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
            !data
        ) {

            return [];

        }


        if (
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


        return {

            models,

            providers

        };

    }


    /* =====================================================
       INITIALIZE
       ===================================================== */

    async function initialize() {

        /*
         * Jangan menjalankan lifecycle dua kali.
         */

        if (
            initialized
        ) {

            return true;

        }


        /*
         * Jika initialization sedang berjalan,
         * caller kedua menunggu promise yang sama.
         */

        if (
            initializingPromise
        ) {

            return await initializingPromise;

        }


        initializingPromise =
            (async function () {

                try {

                    /* =====================================
                       1. WAIT MODULES
                    ===================================== */

                    await waitForModules();


                    /* =====================================
                       2. PROVIDER
                       -------------------------------------
                       Provider harus siap sebelum form
                       karena form memakai provider_id.
                    ===================================== */

                    await initializeProvider();


                    /* =====================================
                       3. PROVIDER DROPDOWN
                    ===================================== */

                    await initializeProviderDropdown();


                    /* =====================================
                       4. UI
                       -------------------------------------
                       UI memuat Models dari Models Data.
                    ===================================== */

                    await initializeUI();


                    /* =====================================
                       5. FORM LAYOUT
                       -------------------------------------
                       Pastikan layout siap sebelum form
                       events dipasang.
                    ===================================== */

                    await initializeFormLayout();


                    /* =====================================
                       6. PRICE DATA
                       -------------------------------------
                       Pricing berasal dari models.
                    ===================================== */

                    await initializePrice();


                    /* =====================================
                       7. PRICE CALCULATION
                       -------------------------------------
                       Credit / Diskon / Credit Final.
                    ===================================== */

                    initializePriceCalculation();


                    /* =====================================
                       8. SEARCH CATALOG SYNC
                    ===================================== */

                    syncSearchWithModels();


                    /* =====================================
                       9. SEARCH MODEL ID
                       -------------------------------------
                       Search pada form.
                    ===================================== */

                    initializeSearch();


                    /* =====================================
                       10. SEARCH EVENTS
                    ===================================== */

                    initializeSearchEvents();


                    /* =====================================
                       11. FORM EVENTS
                       -------------------------------------
                       Setelah layout dan pricing siap.
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
                       -------------------------------------
                       Search utama halaman.
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
                                    detail:
                                        {
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
                            "[GEN-Z.AI] Models ready event gagal:",
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


                    /*
                     * Tampilkan error jika alertBox tersedia.
                     */

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

        /*
         * Jangan reset saat initialization berjalan.
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


        /* ================================================
           TABLE EVENTS
        ================================================ */

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


        /* ================================================
           SEARCH EVENTS
           -----------------------------------------------
           Search Model ID pada Form.
        ================================================ */

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


        /* ================================================
           PAGE SEARCH
        ================================================ */

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


        /* ================================================
           FORM LAYOUT
        ================================================ */

        const formLayout =
            window.GENZModelFormLayout;


        if (
            formLayout
        ) {

            try {

                if (
                    typeof formLayout.unbind ===
                    "function"
                ) {

                    formLayout.unbind();

                } else if (
                    typeof formLayout.destroy ===
                    "function"
                ) {

                    formLayout.destroy();

                }

            } catch (
                error
            ) {

                console.warn(
                    "[GEN-Z.AI] Form layout reset gagal:",
                    error
                );

            }

        }


        /* ================================================
           PRICE CALCULATION
        ================================================ */

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
         * Price cache tidak dihapus otomatis.
         *
         * Cache merupakan data layer,
         * bukan event lifecycle.
         */


        /*
         * Provider juga tidak dihancurkan.
         *
         * Provider adalah state/data owner.
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
       GET STATE
    ===================================================== */

    function getState() {

        const state =
            syncFinalState();


        return {

            initialized,

            initializing:
                !!initializingPromise,

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
