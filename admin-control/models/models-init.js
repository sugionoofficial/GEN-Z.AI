/* =========================================================
   GEN-Z.AI - MODELS INITIALIZATION MODULE
   File:
   admin-control/models/models-init.js

   Tugas:
   - Menjadi satu-satunya lifecycle owner halaman Models
   - Menunggu seluruh module tersedia
   - Initialize Provider terlebih dahulu
   - Initialize UI
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

            search:
                window.GENZModelsSearch || null,

            form:
                window.GENZModelsForm || null,

            price:
                window.GENZModelsPrice || null,

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
         * Provider harus selesai lebih dahulu.
         *
         * Ini memastikan #providerId sudah memiliki
         * daftar provider sebelum UI dan Search bekerja.
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
         * UI boleh menerima data Provider,
         * tetapi Provider tetap menjadi pemilik
         * dropdown #providerId.
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

        /*
         * Jika UI memiliki state provider,
         * beri tahu data Provider terbaru.
         */
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
            /*
             * STEP 1
             * Tunggu seluruh module loader.
             */
            await waitForModules();

            /*
             * STEP 2
             * Provider harus dimuat lebih dahulu.
             */
            await initializeProvider();

            /*
             * STEP 3
             * Initialize UI.
             *
             * UI akan memuat catalog model dan
             * module Search.
             */
            await initializeUI();

            /*
             * STEP 4
             * Pastikan cache model diteruskan
             * ke Search.
             */
            syncSearchWithModels();

            /*
             * STEP 5
             * Search initialize.
             *
             * Aman dipanggil karena module Search
             * memiliki guard initialized.
             */
            initializeSearch();

            /*
             * STEP 6
             * Sinkronisasi akhir Provider.
             *
             * Ini hanya sinkronisasi data,
             * bukan mengambil alih lifecycle.
             */
            syncProviderAfterUI();

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

            /*
             * Jangan menampilkan error kosong.
             */
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
            initializeUI,
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
