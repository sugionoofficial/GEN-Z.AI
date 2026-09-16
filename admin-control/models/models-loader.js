/* =========================================================
   GEN-Z.AI
   ADMIN MODEL MANAGEMENT
   MODULE LOADER

   File:
   admin-control/models/models-loader.js

   Fungsi:
   - Memuat seluruh module Model Management
   - Menjaga urutan dependency
   - Mencegah initialization ganda
   - Menunggu semua module siap
   - Menjalankan initializer utama satu kali
   - Tidak mengubah UI utama
   - Tidak mengakses API key
========================================================= */

(function () {
    "use strict";

    /*
     * Tandai bahwa loader sedang mengendalikan
     * initialization Model Management.
     *
     * Module lain dapat membaca flag ini
     * jika diperlukan.
     */
    window.GENZ_MODELS_LOADER_ACTIVE = true;

    const BASE_PATH = "./models/";

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

                if (
                    loaded.has(filename)
                ) {
                    resolve();
                    return;
                }

                const existing =
                    document.querySelector(
                        `script[data-genz-model-module="${filename}"]`
                    );

                if (existing) {

                    if (
                        existing.dataset
                            .genzModelLoaded ===
                        "true"
                    ) {
                        loaded.add(filename);
                        resolve();
                        return;
                    }

                    existing.addEventListener(
                        "load",
                        () => {
                            loaded.add(filename);

                            existing.dataset
                                .genzModelLoaded =
                                "true";

                            resolve();
                        },
                        {
                            once: true
                        }
                    );

                    existing.addEventListener(
                        "error",
                        () => {
                            reject(
                                new Error(
                                    "Gagal memuat module: " +
                                        filename
                                )
                            );
                        },
                        {
                            once: true
                        }
                    );

                    return;
                }

                const script =
                    document.createElement(
                        "script"
                    );

                script.src =
                    BASE_PATH +
                    filename;

                /*
                 * Module harus dijalankan
                 * sesuai urutan dependency.
                 */
                script.async = false;

                script.defer = false;

                script.dataset
                    .genzModelModule =
                    filename;

                script.onload = () => {

                    loaded.add(
                        filename
                    );

                    script.dataset
                        .genzModelLoaded =
                        "true";

                    resolve();
                };

                script.onerror = () => {

                    reject(
                        new Error(
                            "Gagal memuat module: " +
                                filename
                        )
                    );
                };

                /*
                 * Masukkan ke HEAD agar module
                 * tidak mengganggu struktur UI.
                 */
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
                        missing.length === 0
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
                                    missing.join(
                                        ", "
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
       INITIALIZE
    ===================================================== */

    async function initialize() {

        if (initialized) {
            return true;
        }

        try {

            /*
             * Pastikan semua file module
             * sudah tersedia.
             */
            await loadModules();

            /*
             * Tunggu object global benar-benar
             * tersedia sebelum menjalankan init.
             */
            await waitForModules();

            /*
             * Hanya models-init.js yang menjadi
             * initializer utama.
             */
            const initializer =
                window.GENZModelsInit;

            if (
                !initializer ||
                typeof initializer.initialize !==
                    "function"
            ) {
                throw new Error(
                    "GENZModelsInit.initialize() tidak tersedia."
                );
            }

            /*
             * Jalankan initializer utama.
             */
            await initializer.initialize();

            initialized = true;

            console.info(
                "[GEN-Z.AI] Model Management berhasil diinisialisasi melalui loader."
            );

            window.dispatchEvent(
                new CustomEvent(
                    "genz-models-loader-ready"
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
            getLoadedModules
        });

    /* =====================================================
       START
    ===================================================== */

    function start() {

        /*
         * Loader menjadi satu pintu
         * untuk Model Management.
         */
        initialize()
            .catch(error => {

                console.error(
                    "[GEN-Z.AI] Model Management gagal dimulai:",
                    error
                );

            });
    }

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
