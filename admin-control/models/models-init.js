 /* =========================================================
   GEN-Z.AI - MODELS INITIALIZATION MODULE

   File:
   admin-control/models/models-init.js

   TUGAS:
   - Menjadi satu-satunya lifecycle owner halaman Models
   - Menunggu seluruh module tersedia
   - Initialize Provider terlebih dahulu
   - Initialize UI
   - Initialize Form Events
   - Initialize Table Events
   - Memastikan Search mendapatkan catalog model
   - Menjaga Provider tidak hilang / tertimpa
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

    function modulesReady() {
        const modules =
            getModules();

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
                        reject(
                            new Error(
                                "Module halaman Models belum lengkap."
                            )
                        );

                        return;
                    }

                    setTimeout(
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
         * Provider tetap menjadi pemilik utama
         * data provider.
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
       PROVIDER DROPDOWN FUNCTION MODULE
    ===================================================== */

    function initializeProviderDropdown() {

        const dropdown =
            window.GENZModelProviderDropdown;

        if (!dropdown) {
            return false;
        }

        /*
         * Module ini tidak wajib menjadi lifecycle
         * utama karena models-provider.js masih
         * menjadi compatibility layer.
         *
         * Kita hanya memastikan module tersedia.
         */

        if (
            typeof dropdown.bind ===
            "function"
        ) {
            try {
                dropdown.bind();
            } catch (
                error
            ) {
                console.warn(
                    "[GEN-Z.AI] Provider dropdown bind gagal:",
                    error
                );
            }
        }

        return true;
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

        } catch (
            error
        ) {

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

        } catch (
            error
        ) {

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
            return;
        }

        if (
            typeof data.getCachedModels !==
            "function" ||
            typeof search.setModels !==
            "function"
        ) {
            return;
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
            }

        } catch (
            error
        ) {

            console.warn(
                "[GEN-Z.AI] Search model sync gagal:",
                error
            );
        }
    }

    /* =====================================================
       SEARCH INITIALIZATION
    ===================================================== */

    function initializeSearch() {

        const search =
            window.GENZModelsSearch;

        if (!search) {
            return false;
        }

        if (
            typeof search.initialize !==
            "function"
        ) {
            return false;
        }

        return search.initialize();
    }

    /* =====================================================
       FINAL PROVIDER SYNC
    ===================================================== */

    function syncProviderAfterUI() {

        const provider =
            window.GENZModelsProvider;

        const ui =
            window.GENZModelsUI;

        if (!provider) {
            return;
        }

        const providers =
            typeof provider.getProviders ===
            "function"
                ? provider.getProviders()
                : [];

        /*
         * Compatibility sync.
         *
         * Provider tetap sumber data utama.
         */

        if (
            ui &&
            typeof ui.populateProviderSelect ===
            "function"
        ) {
            try {

                ui.populateProviderSelect(
                    providers
                );

            } catch (
                error
            ) {

                console.warn(
                    "[GEN-Z.AI] Final provider sync gagal:",
                    error
                );
            }
        }

        if (
            ui &&
            typeof ui.setProviders ===
            "function"
        ) {
            try {

                ui.setProviders(
                    providers
                );

            } catch (
                error
            ) {

                console.warn(
                    "[GEN-Z.AI] UI provider state sync gagal:",
                    error
                );
            }
        }
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

        initializing =
            true;

        try {

            /* =============================================
               STEP 1
               Tunggu semua module.
            ============================================= */

            await waitForModules();

            /* =============================================
               STEP 2
               Provider dahulu.
            ============================================= */

            await initializeProvider();

            /* =============================================
               STEP 3
               Provider dropdown module.
            ============================================= */

            initializeProviderDropdown();

            /* =============================================
               STEP 4
               UI.
            ============================================= */

            await initializeUI();

            /* =============================================
               STEP 5
               Search catalog.
            ============================================= */

            syncSearchWithModels();

            /* =============================================
               STEP 6
               Search event.
            ============================================= */

            initializeSearch();

            /* =============================================
               STEP 7
               Form Events.
            ============================================= */

            initializeFormEvents();

            /* =============================================
               STEP 8
               Table Events.

               Catatan:
               Jika UI lama masih melakukan bind
               event tabel, module ini memakai guard
               sendiri. Pada tahap migrasi berikutnya
               bind lama akan dilepas dari models-ui.js.
            ============================================= */

            initializeTableEvents();

            /* =============================================
               STEP 9
               Final Provider sync.
            ============================================= */

            syncProviderAfterUI();

            /* =============================================
               SELESAI
            ============================================= */

            initialized =
                true;

            document.dispatchEvent(
                new CustomEvent(
                    "genz-models-initialized"
                )
            );

            console.log(
                "[GEN-Z.AI] Models initialization complete."
            );

            return true;

        } catch (
            error
        ) {

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

            initializing =
                false;
        }
    }

    /* =====================================================
       RESET
    ===================================================== */

    function reset() {

        /*
         * Unbind module events ketika reset.
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
            } catch (
                error
            ) {
                console.warn(
                    "[GEN-Z.AI] Form events reset gagal:",
                    error
                );
            }
        }

        const tableEvents =
            window.GENZModelTableEvents;

        if (
            tableEvents &&
            typeof tableEvents.unbind ===
            "function"
        ) {
            try {
                tableEvents.unbind();
            } catch (
                error
            ) {
                console.warn(
                    "[GEN-Z.AI] Table events reset gagal:",
                    error
                );
            }
        }

        initialized =
            false;

        initializing =
            false;
    }

    /* =====================================================
       STATUS
    ===================================================== */

    function isInitialized() {
        return initialized;
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

            reset
        });

    console.log(
        "[GEN-Z.AI] GENZModelsInit loaded."
    );

})();
