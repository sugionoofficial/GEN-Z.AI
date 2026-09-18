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
   ========================================================= */

(function () {
    "use strict";

    let initialized = false;
    let initializing = false;

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
        const modules = getModules();

        return (
            !!modules.data &&
            !!modules.provider &&
            !!modules.search &&
            !!modules.form &&
            !!modules.price &&
            !!modules.ui
        );
    }

    /* =====================================================
       WAIT FOR MODULES
    ===================================================== */

    function waitForModules(timeout = 15000) {
        return new Promise(function (resolve, reject) {

            const start = Date.now();

            function check() {

                if (modulesReady()) {
                    resolve(getModules());
                    return;
                }

                if (
                    Date.now() - start >=
                    timeout
                ) {
                    reject(
                        new Error(
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
        });
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
            console.warn(
                "[GEN-Z.AI] GENZModelProviderDropdown belum tersedia."
            );

            return false;
        }

        /*
         * PENTING:
         *
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

                return false;
            }
        }

        /*
         * Fallback:
         * Jika module hanya menyediakan render/setProviders.
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
                    Array.isArray(providers)
                        ? providers
                        : []
                );

                return true;

            } catch (error) {

                console.error(
                    "[GEN-Z.AI] Provider dropdown fallback gagal:",
                    error
                );

                return false;
            }
        }

        return false;
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
            console.warn(
                "[GEN-Z.AI] GENZModelFormEvents belum tersedia."
            );

            return false;
        }

        if (
            typeof formEvents.bind !==
            "function"
        ) {
            console.warn(
                "[GEN-Z.AI] GENZModelFormEvents.bind() tidak tersedia."
            );

            return false;
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

            return false;
        }
    }

    /* =====================================================
       TABLE EVENTS
    ===================================================== */

    function initializeTableEvents() {

        const tableEvents =
            window.GENZModelTableEvents;

        if (!tableEvents) {
            console.warn(
                "[GEN-Z.AI] GENZModelTableEvents belum tersedia."
            );

            return false;
        }

        if (
            typeof tableEvents.bind !==
            "function"
        ) {
            console.warn(
                "[GEN-Z.AI] GENZModelTableEvents.bind() tidak tersedia."
            );

            return false;
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

            return false;
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
                Array.isArray(cached)
            ) {
                search.setModels(
                    cached
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
            console.warn(
                "[GEN-Z.AI] GENZModelsSearch belum tersedia."
            );

            return false;
        }

        if (
            typeof search.initialize !==
            "function"
        ) {
            console.warn(
                "[GEN-Z.AI] GENZModelsSearch.initialize() tidak tersedia."
            );

            return false;
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

            return false;
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
            Array.isArray(providers)
                ? providers
                : [];

        /*
         * PRIORITAS UTAMA:
         *
         * Provider Dropdown module.
         *
         * Ini harus dilakukan sebelum
         * compatibility UI sync.
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
         * Jika models-ui.js masih memiliki
         * populateProviderSelect(), gunakan
         * hanya jika dropdown module tidak
         * tersedia.
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
         * Sinkronisasi state Provider pada UI.
         *
         * Tidak menyentuh DOM dropdown jika
         * module dropdown sudah tersedia.
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

        if (initialized) {
            return true;
        }

        if (initializing) {
            return false;
        }

        initializing = true;

        try {

            /* =============================================
               STEP 1
               Tunggu module utama.
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
               Selesai.
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

            return false;

        } finally {

            initializing = false;
        }
    }

    /* =====================================================
       RESET
    ===================================================== */

    function reset() {

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
         * Provider Dropdown tidak perlu
         * dihancurkan ketika reset biasa.
         *
         * Data Provider tetap dimiliki
         * GENZModelsProvider.
         */

        initialized = false;
        initializing = false;

        console.log(
            "[GEN-Z.AI] Models initialization reset."
        );
    }

    /* =====================================================
       STATUS
    ===================================================== */

    function isInitialized() {
        return initialized;
    }

    function isInitializing() {
        return initializing;
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
