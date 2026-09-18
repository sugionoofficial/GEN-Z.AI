/* =========================================================
   GEN-Z.AI
   MODELS INITIALIZATION MODULE

   File:
   admin-control/models/models-init.js

   TUGAS:
   - Menjadi lifecycle owner halaman Models
   - Menunggu seluruh module tersedia
   - Initialize Provider
   - Initialize Provider Dropdown
   - Initialize UI
   - Initialize Search
   - Initialize Form Events
   - Initialize Table Events
   - Sinkronisasi catalog Model
   - Sinkronisasi Provider
   - Tidak melakukan query Supabase langsung

   FIX:
   - Semua module wajib diverifikasi sebelum initialize
   - Initialization concurrent menggunakan Promise
   - Tidak ada initialize ganda
   - Tidak mengubah CRUD
   - Tidak mengubah pricing
   - Tidak mengubah search logic
   - Tidak mengubah provider logic
   - Tidak mengubah HTML
   - Reset tetap dapat digunakan
========================================================= */

(function () {
    "use strict";

    let initialized = false;

    /*
     * Menyimpan Promise initialization yang sedang berjalan.
     *
     * Dengan cara ini jika initialize() dipanggil dua kali
     * secara bersamaan, keduanya menunggu proses yang sama.
     *
     * Bukan:
     *     return false
     *
     * lagi.
     */
    let initializingPromise = null;


    /* =====================================================
       MODULE HELPERS
    ===================================================== */

    function getModules() {

        return {

            data:
                window.GENZModelsData || null,

            provider:
                window.GENZModelsProvider || null,

            providerDropdown:
                window.GENZModelProviderDropdown || null,

            search:
                window.GENZModelsSearch || null,

            searchEvents:
                window.GENZModelSearchEvents || null,

            form:
                window.GENZModelsForm || null,

            formEvents:
                window.GENZModelFormEvents || null,

            formCoordinator:
                window.GENZModelFormCoordinator || null,

            price:
                window.GENZModelsPrice || null,

            priceCalculation:
                window.GENZModelPriceCalculation || null,

            table:
                window.GENZModelTable || null,

            tableEvents:
                window.GENZModelTableEvents || null,

            ui:
                window.GENZModelsUI || null
        };
    }


    /* =====================================================
       REQUIRED MODULE CHECK
    ===================================================== */

    function modulesReady() {

        const modules =
            getModules();

        /*
         * Semua module yang didaftarkan oleh
         * models-loader.js harus tersedia sebelum
         * lifecycle utama dijalankan.
         *
         * Ini mencegah kondisi:
         *
         * Provider sudah ada
         * tetapi Search Events belum ada
         * lalu initialization tetap berjalan.
         */

        return (

            !!modules.data &&

            !!modules.provider &&

            !!modules.providerDropdown &&

            !!modules.search &&

            !!modules.searchEvents &&

            !!modules.form &&

            !!modules.formEvents &&

            !!modules.formCoordinator &&

            !!modules.price &&

            !!modules.priceCalculation &&

            !!modules.table &&

            !!modules.tableEvents &&

            !!modules.ui
        );
    }


    /* =====================================================
       WAIT FOR MODULES
    ===================================================== */

    function waitForModules(
        timeout = 15000
    ) {

        return new Promise(
            function (resolve, reject) {

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

                        const modules =
                            getModules();

                        const missing = [];

                        if (!modules.data) {
                            missing.push(
                                "GENZModelsData"
                            );
                        }

                        if (!modules.provider) {
                            missing.push(
                                "GENZModelsProvider"
                            );
                        }

                        if (
                            !modules.providerDropdown
                        ) {
                            missing.push(
                                "GENZModelProviderDropdown"
                            );
                        }

                        if (!modules.search) {
                            missing.push(
                                "GENZModelsSearch"
                            );
                        }

                        if (
                            !modules.searchEvents
                        ) {
                            missing.push(
                                "GENZModelSearchEvents"
                            );
                        }

                        if (!modules.form) {
                            missing.push(
                                "GENZModelsForm"
                            );
                        }

                        if (
                            !modules.formEvents
                        ) {
                            missing.push(
                                "GENZModelFormEvents"
                            );
                        }

                        if (
                            !modules.formCoordinator
                        ) {
                            missing.push(
                                "GENZModelFormCoordinator"
                            );
                        }

                        if (!modules.price) {
                            missing.push(
                                "GENZModelsPrice"
                            );
                        }

                        if (
                            !modules.priceCalculation
                        ) {
                            missing.push(
                                "GENZModelPriceCalculation"
                            );
                        }

                        if (!modules.table) {
                            missing.push(
                                "GENZModelTable"
                            );
                        }

                        if (
                            !modules.tableEvents
                        ) {
                            missing.push(
                                "GENZModelTableEvents"
                            );
                        }

                        if (!modules.ui) {
                            missing.push(
                                "GENZModelsUI"
                            );
                        }

                        const message =
                            missing.length
                                ? (
                                    "Module halaman Models belum lengkap: " +
                                    missing.join(", ")
                                )
                                : (
                                    "Module halaman Models belum lengkap."
                                );

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
    ===================================================== */

    async function initializeProvider() {

        const provider =
            window.GENZModelsProvider;

        if (!provider) {

            throw new Error(
                "GENZModelsProvider belum tersedia."
            );
        }

        /*
         * Provider adalah owner utama
         * data Provider.
         */

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
            "Fungsi Provider initialize/loadProviders tidak tersedia."
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

        /*
         * model-provider-dropdown.js memiliki:
         *
         * initialize()
         * render()
         * setProviders()
         * getProviders()
         * getSelected()
         * setValue()
         * clear()
         * refresh()
         * destroy()
         *
         * Tidak memiliki bind().
         */

        if (
            typeof dropdown.initialize ===
            "function"
        ) {

            try {

                const result =
                    await dropdown.initialize();

                console.log(
                    "[GEN-Z.AI] Provider dropdown initialized."
                );

                return result !== false;

            } catch (error) {

                console.error(
                    "[GEN-Z.AI] Provider dropdown initialize gagal:",
                    error
                );

                throw error;
            }
        }


        /*
         * Fallback:
         * Jika module hanya menyediakan
         * render/setProviders.
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

            try {

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

            } catch (error) {

                console.error(
                    "[GEN-Z.AI] Provider dropdown fallback gagal:",
                    error
                );

                throw error;
            }
        }

        throw new Error(
            "Provider Dropdown tidak memiliki initialize() atau fallback yang valid."
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

        return await ui.initialize();
    }


    /* =====================================================
       FORM EVENTS
    ===================================================== */

    function initializeFormEvents() {

        const formEvents =
            window.GENZModelFormEvents;

        if (!formEvents) {

            throw new Error(
                "GENZModelFormEvents belum tersedia."
            );
        }

        if (
            typeof formEvents.bind !==
            "function"
        ) {

            throw new Error(
                "GENZModelFormEvents.bind() tidak tersedia."
            );
        }

        try {

            const result =
                formEvents.bind();

            console.log(
                "[GEN-Z.AI] Model form events initialized."
            );

            return result !== false;

        } catch (error) {

            console.error(
                "[GEN-Z.AI] Model form events gagal:",
                error
            );

            throw error;
        }
    }


    /* =====================================================
       TABLE EVENTS
    ===================================================== */

    function initializeTableEvents() {

        const tableEvents =
            window.GENZModelTableEvents;

        if (!tableEvents) {

            throw new Error(
                "GENZModelTableEvents belum tersedia."
            );
        }

        if (
            typeof tableEvents.bind !==
            "function"
        ) {

            throw new Error(
                "GENZModelTableEvents.bind() tidak tersedia."
            );
        }

        try {

            const result =
                tableEvents.bind();

            console.log(
                "[GEN-Z.AI] Model table events initialized."
            );

            return result !== false;

        } catch (error) {

            console.error(
                "[GEN-Z.AI] Model table events gagal:",
                error
            );

            throw error;
        }
    }


    /* =====================================================
       SEARCH SYNC
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

            const cached =
                data.getCachedModels();

            if (
                Array.isArray(
                    cached
                )
            ) {

                search.setModels(
                    cached
                );

                console.log(
                    "[GEN-Z.AI] Search catalog synchronized:",
                    cached.length
                );

                return true;
            }

        } catch (error) {

            console.warn(
                "[GEN-Z.AI] Search model sync gagal:",
                error
            );
        }

        return false;
    }


    /* =====================================================
       SEARCH INITIALIZATION
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

        try {

            const result =
                search.initialize();

            console.log(
                "[GEN-Z.AI] Model search initialized."
            );

            return result !== false;

        } catch (error) {

            console.error(
                "[GEN-Z.AI] Model search gagal:",
                error
            );

            throw error;
        }
    }


    /* =====================================================
       PROVIDER SYNC
    ===================================================== */

    function syncProviderAfterUI() {

        const provider =
            window.GENZModelsProvider;

        const dropdown =
            window.GENZModelProviderDropdown;

        const ui =
            window.GENZModelsUI;

        if (!provider) {

            return false;
        }

        const providers =
            typeof provider.getProviders ===
            "function"
                ? provider.getProviders()
                : [];

        const providerList =
            Array.isArray(
                providers
            )
                ? providers
                : [];


        /*
         * PRIORITAS UTAMA:
         *
         * Provider Dropdown module.
         */

        if (
            dropdown &&
            typeof dropdown.setProviders ===
            "function"
        ) {

            try {

                dropdown.setProviders(
                    providerList
                );

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI] Provider dropdown sync gagal:",
                    error
                );
            }
        }


        /*
         * Compatibility untuk UI lama.
         *
         * Hanya digunakan jika Provider Dropdown
         * module tidak tersedia.
         */

        if (
            !dropdown &&
            ui &&
            typeof ui.populateProviderSelect ===
            "function"
        ) {

            try {

                ui.populateProviderSelect(
                    providerList
                );

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI] Legacy provider select sync gagal:",
                    error
                );
            }
        }


        /*
         * models-ui.js saat ini tidak memiliki
         * setProviders().
         *
         * Karena itu jangan memanggil API
         * yang tidak tersedia.
         */

        if (
            ui &&
            typeof ui.setProviders ===
            "function"
        ) {

            try {

                ui.setProviders(
                    providerList
                );

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI] UI provider state sync gagal:",
                    error
                );
            }
        }

        return true;
    }


    /* =====================================================
       MAIN INITIALIZE
    ===================================================== */

    async function initialize() {

        /*
         * Sudah selesai.
         */

        if (initialized) {

            return true;
        }


        /*
         * Initialization sedang berjalan.
         *
         * Kembalikan Promise yang sama.
         *
         * Ini penting agar models-loader,
         * models-init, atau caller lain tidak
         * menjalankan lifecycle kedua.
         */

        if (initializingPromise) {

            return await initializingPromise;
        }


        initializingPromise =
            (async function () {

                try {

                    /* =============================================
                       STEP 1
                       Tunggu SEMUA module.
                    ============================================= */

                    await waitForModules();


                    /* =============================================
                       STEP 2
                       Initialize Provider.
                    ============================================= */

                    await initializeProvider();


                    /* =============================================
                       STEP 3
                       Initialize Provider Dropdown.
                    ============================================= */

                    await initializeProviderDropdown();


                    /* =============================================
                       STEP 4
                       Initialize UI.
                    ============================================= */

                    await initializeUI();


                    /* =============================================
                       STEP 5
                       Sinkronisasi catalog Model.
                    ============================================= */

                    syncSearchWithModels();


                    /* =============================================
                       STEP 6
                       Initialize Search.
                    ============================================= */

                    initializeSearch();


                    /* =============================================
                       STEP 7
                       Initialize Form Events.
                    ============================================= */

                    initializeFormEvents();


                    /* =============================================
                       STEP 8
                       Initialize Table Events.
                    ============================================= */

                    initializeTableEvents();


                    /* =============================================
                       STEP 9
                       Final Provider Sync.
                    ============================================= */

                    syncProviderAfterUI();


                    /* =============================================
                       STEP 10
                       Tandai READY.
                    ============================================= */

                    initialized = true;


                    document.dispatchEvent(
                        new CustomEvent(
                            "genz-models-initialized"
                        )
                    );


                    console.log(
                        "[GEN-Z.AI] Models initialization complete."
                    );


                    return true;

                } catch (error) {

                    initialized = false;


                    console.error(
                        "[GEN-Z.AI] Models initialization failed:",
                        error
                    );


                    const alertBox =
                        document.getElementById(
                            "alertBox"
                        );


                    if (alertBox) {

                        alertBox.textContent =
                            "Gagal memuat halaman Models: " +
                            (
                                error?.message ||
                                "Unknown error"
                            );

                        alertBox.className =
                            "alert alert-error show";
                    }


                    /*
                     * Error tetap dilempar agar
                     * models-loader mengetahui bahwa
                     * initialization benar-benar gagal.
                     */

                    throw error;

                } finally {

                    /*
                     * Promise dibersihkan setelah
                     * proses selesai.
                     */

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
         * Jika initialization masih berjalan,
         * jangan mengubah state di tengah proses.
         */

        if (initializingPromise) {

            console.warn(
                "[GEN-Z.AI] Reset diabaikan karena initialization masih berjalan."
            );

            return false;
        }


        /*
         * Unbind Form Events.
         */

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


        /*
         * Unbind Table Events.
         */

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


        /*
         * Search events.
         */

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


        /*
         * Provider Dropdown tidak dihancurkan
         * ketika reset biasa.
         *
         * Data Provider tetap dimiliki
         * GENZModelsProvider.
         */

        initialized = false;


        console.log(
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

            initializeFormEvents,

            initializeTableEvents,

            initializeSearch,

            waitForModules,

            syncProviderAfterUI,

            syncSearchWithModels,

            isInitialized,

            isInitializing,

            reset
        });


    console.log(
        "[GEN-Z.AI] GENZModelsInit loaded."
    );

})();
