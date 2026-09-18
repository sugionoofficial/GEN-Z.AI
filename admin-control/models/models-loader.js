/* =========================================================
   GEN-Z.AI
   ADMIN MODEL MANAGEMENT
   MODULE LOADER

   File:
   admin-control/models/models-loader.js

   Fungsi:
   - Memuat seluruh module Model Management
   - Menjaga urutan dependency
   - Cache busting
   - Mencegah initialization ganda
   - Menunggu semua module siap
   - Menjalankan initializer utama satu kali
========================================================= */

(function () {
    "use strict";

    window.GENZ_MODELS_LOADER_ACTIVE = true;

    const BASE_PATH = "./models/";

    /*
     * NAIKKAN VERSION setiap ada perubahan module.
     */
    const CACHE_VERSION = "20260918-04";

    const MODULES = [
        "models-data.js",
        "models-search.js",
        "models-form.js",
        "models-price.js",
        "models-ui.js",
        "models-init.js"
    ];

    const loaded = new Set();

    let loadingPromise = null;
    let initialized = false;

    /* =====================================================
       LOAD SINGLE SCRIPT
    ===================================================== */

    function loadScript(filename) {

        return new Promise(
            (resolve, reject) => {

                if (loaded.has(filename)) {
                    resolve();
                    return;
                }

                /*
                 * Cari script module yang sudah ada.
                 */
                const existing =
                    document.querySelector(
                        `script[data-genz-model-module="${filename}"]`
                    );

                if (existing) {

                    /*
                     * Pastikan script tersebut
                     * berasal dari version terbaru.
                     */
                    const existingVersion =
                        existing.dataset
                            .genzModelVersion || "";

                    /*
                     * Jika sudah version terbaru
                     * dan sudah loaded, gunakan.
                     */
                    if (
                        existingVersion ===
                            CACHE_VERSION &&
                        existing.dataset
                            .genzModelLoaded ===
                            "true"
                    ) {

                        loaded.add(filename);

                        resolve();

                        return;
                    }

                    /*
                     * Jika script lama ditemukan,
                     * hapus agar browser memuat
                     * versi baru.
                     */
                    existing.remove();
                }

                /* =================================================
                   CREATE SCRIPT
                ================================================= */

                const script =
                    document.createElement(
                        "script"
                    );

                script.src =
                    BASE_PATH +
                    filename +
                    "?v=" +
                    encodeURIComponent(
                        CACHE_VERSION
                    );

                /*
                 * Dependency harus berurutan.
                 */
                script.async = false;
                script.defer = false;

                script.dataset
                    .genzModelModule =
                    filename;

                script.dataset
                    .genzModelVersion =
                    CACHE_VERSION;

                /* =================================================
                   LOAD
                ================================================= */

                script.onload = () => {

                    loaded.add(
                        filename
                    );

                    script.dataset
                        .genzModelLoaded =
                        "true";

                    console.info(
                        "[GEN-Z.AI] Module loaded:",
                        filename,
                        "version:",
                        CACHE_VERSION
                    );

                    resolve();
                };

                /* =================================================
                   ERROR
                ================================================= */

                script.onerror = () => {

                    console.error(
                        "[GEN-Z.AI] Module gagal dimuat:",
                        filename
                    );

                    reject(
                        new Error(
                            "Gagal memuat module: " +
                            filename
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
       LOAD ALL MODULES
    ===================================================== */

    async function loadModules() {

        if (loadingPromise) {
            return loadingPromise;
        }

        loadingPromise =
            (async () => {

                for (
                    const module
                    of MODULES
                ) {

                    await loadScript(
                        module
                    );
                }

                return true;
            })();

        try {

            return await loadingPromise;

        } catch (error) {

            loadingPromise = null;

            throw error;
        }
    }

    /* =====================================================
       CHECK MODULES
    ===================================================== */

    function getMissingModules() {

        const required = [

            "GENZModelsData",
            "GENZModelsSearch",
            "GENZModelsForm",
            "GENZModelsPrice",
            "GENZModelsUI",
            "GENZModelsInit"

        ];

        return required.filter(
            name =>
                !window[name]
        );
    }

    /* =====================================================
       WAIT FOR MODULES
    ===================================================== */

    function waitForModules(
        timeout = 10000
    ) {

        return new Promise(
            (resolve, reject) => {

                const startedAt =
                    Date.now();

                function check() {

                    const missing =
                        getMissingModules();

                    if (
                        missing.length ===
                        0
                    ) {

                        resolve();

                        return;
                    }

                    if (
                        Date.now() -
                            startedAt >=
                        timeout
                    ) {

                        reject(
                            new Error(
                                "Module Model Management belum tersedia: " +
                                missing.join(", ")
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
       INITIALIZE
    ===================================================== */

    async function initialize() {

        if (initialized) {
            return true;
        }

        try {

            /*
             * Load semua module berurutan.
             */
            await loadModules();

            /*
             * Pastikan semua global tersedia.
             */
            await waitForModules();

            const initializer =
                window.GENZModelsInit;

            if (
                !initializer ||
                typeof
                    initializer.initialize !==
                    "function"
            ) {

                throw new Error(
                    "GENZModelsInit.initialize() tidak tersedia."
                );
            }

            /*
             * Jalankan Model Management.
             */
            await initializer.initialize();

            initialized = true;

            console.info(
                "[GEN-Z.AI] Model Management berhasil diinisialisasi."
            );

            console.info(
                "[GEN-Z.AI] Module version:",
                CACHE_VERSION
            );

            /*
             * READY EVENT
             */
            window.dispatchEvent(
                new CustomEvent(
                    "genz-models-loader-ready",
                    {
                        detail: {
                            version:
                                CACHE_VERSION,
                            modules:
                                getLoadedModules()
                        }
                    }
                )
            );

            return true;

        } catch (error) {

            console.error(
                "[GEN-Z.AI] Model Management loader initialization error:",
                error
            );

            window.dispatchEvent(
                new CustomEvent(
                    "genz-models-loader-error",
                    {
                        detail: error
                    }
                )
            );

            throw error;
        }
    }

    /* =====================================================
       STATUS
    ===================================================== */

    function isLoaded(
        filename
    ) {

        return loaded.has(
            filename
        );
    }

    function isInitialized() {

        return initialized;
    }

    function getLoadedModules() {

        return [
            ...loaded
        ];
    }

    function getVersion() {

        return CACHE_VERSION;
    }

    /* =====================================================
       PUBLIC API
    ===================================================== */

    window.GENZModelsLoader =
        Object.freeze({

            loadModules,

            initialize,

            waitForModules,

            getMissingModules,

            isLoaded,

            isInitialized,

            getLoadedModules,

            getVersion

        });

    /* =====================================================
       START
    ===================================================== */

    function start() {

        initialize()
            .catch(
                error => {

                    console.error(
                        "[GEN-Z.AI] Model Management gagal dimulai:",
                        error
                    );

                }
            );
    }

    /* =====================================================
       DOM READY
    ===================================================== */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            start,
            {
                once: true
            }
        );

    } else {

        start();
    }

})();
