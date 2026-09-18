/* =========================================================
   GEN-Z.AI - MODELS MODULE LOADER
   File:
   admin-control/models/models-loader.js

   Tugas:
   - Memuat seluruh module Models secara berurutan
   - Menjamin dependency tersedia sebelum module berikutnya
   - Menjalankan GENZModelsInit sebagai lifecycle owner
   - Tidak memuat module dua kali
   ========================================================= */

(function () {
    "use strict";

    const BASE_PATH =
        "./models/";

    const MODULES = [
    "models-data.js",

    "models-provider.js",

    "functions/model-search-dropdown.js",
    "functions/model-search-render.js",
    "functions/model-search-select.js",
    "functions/model-search-events.js",

    "models-search.js",

    "models-form.js",
    "models-price.js",
    "models-ui.js",
    "models-init.js"
];

    const loadedModules =
        new Set();

    let loading =
        false;

    let initialized =
        false;

    /* =====================================================
       LOG
       ===================================================== */

    function log(...args) {
        console.log(
            "[GEN-Z.AI][ModelsLoader]",
            ...args
        );
    }

    function warn(...args) {
        console.warn(
            "[GEN-Z.AI][ModelsLoader]",
            ...args
        );
    }

    function error(...args) {
        console.error(
            "[GEN-Z.AI][ModelsLoader]",
            ...args
        );
    }

    /* =====================================================
       SCRIPT DETECTION
       ===================================================== */

    function getScriptUrl(
        file
    ) {
        return new URL(
            BASE_PATH + file,
            document.baseURI
        ).href;
    }

    function scriptAlreadyExists(
        url
    ) {
        const scripts =
            Array.from(
                document.scripts
            );

        return scripts.some(
            function (script) {
                try {
                    return (
                        new URL(
                            script.src,
                            document.baseURI
                        ).href ===
                        url
                    );
                } catch (
                    e
                ) {
                    return false;
                }
            }
        );
    }

    /* =====================================================
       LOAD SCRIPT
       ===================================================== */

    function loadScript(
        file
    ) {
        return new Promise(
            function (resolve, reject) {
                if (
                    loadedModules.has(
                        file
                    )
                ) {
                    resolve();
                    return;
                }

                const url =
                    getScriptUrl(
                        file
                    );

                /*
                 * Cari script yang sudah ada.
                 *
                 * Jika script sudah dibuat oleh loader,
                 * tunggu event load/error.
                 */
                const existing =
                    Array.from(
                        document.scripts
                    ).find(
                        function (script) {
                            try {
                                return (
                                    new URL(
                                        script.src,
                                        document.baseURI
                                    ).href ===
                                    url
                                );
                            } catch (
                                e
                            ) {
                                return false;
                            }
                        }
                    );

                if (existing) {
                    /*
                     * Script existing bisa saja masih loading.
                     * Jangan langsung menganggap selesai.
                     */
                    if (
                        existing.dataset
                            .genzLoaded ===
                        "true"
                    ) {
                        loadedModules.add(
                            file
                        );

                        resolve();
                        return;
                    }

                    let settled =
                        false;

                    const cleanup =
                        function () {
                            existing.removeEventListener(
                                "load",
                                onLoad
                            );

                            existing.removeEventListener(
                                "error",
                                onError
                            );
                        };

                    const onLoad =
                        function () {
                            if (
                                settled
                            ) {
                                return;
                            }

                            settled =
                                true;

                            cleanup();

                            existing.dataset
                                .genzLoaded =
                                "true";

                            loadedModules.add(
                                file
                            );

                            resolve();
                        };

                    const onError =
                        function () {
                            if (
                                settled
                            ) {
                                return;
                            }

                            settled =
                                true;

                            cleanup();

                            reject(
                                new Error(
                                    "Gagal memuat " +
                                    file
                                )
                            );
                        };

                    existing.addEventListener(
                        "load",
                        onLoad,
                        {
                            once: true
                        }
                    );

                    existing.addEventListener(
                        "error",
                        onError,
                        {
                            once: true
                        }
                    );

                    /*
                     * Jika script sudah selesai tetapi event
                     * sudah lewat sebelum listener terpasang,
                     * cek global setelah delay singkat.
                     */
                    setTimeout(
                        function () {
                            if (
                                settled
                            ) {
                                return;
                            }

                            if (
                                moduleGlobalReady(
                                    file
                                )
                            ) {
                                settled =
                                    true;

                                cleanup();

                                existing.dataset
                                    .genzLoaded =
                                    "true";

                                loadedModules.add(
                                    file
                                );

                                resolve();
                            }
                        },
                        100
                    );

                    return;
                }

                /*
                 * Buat script baru.
                 */
                const script =
                    document.createElement(
                        "script"
                    );

                script.src =
                    url;

                script.async =
                    false;

                script.dataset
                    .genzModule =
                    file;

                script.onload =
                    function () {
                        script.dataset
                            .genzLoaded =
                            "true";

                        loadedModules.add(
                            file
                        );

                        log(
                            "Loaded:",
                            file
                        );

                        resolve();
                    };

                script.onerror =
                    function () {
                        error(
                            "Failed:",
                            file
                        );

                        reject(
                            new Error(
                                "Gagal memuat module: " +
                                file
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
       GLOBAL CHECK
       ===================================================== */

    function moduleGlobalReady(
        file
    ) {
        switch (
            file
        ) {
            case "models-data.js":
                return !!(
                    window.GENZModelsData
                );

            case "models-provider.js":
                return !!(
                    window.GENZModelsProvider
                );

            case "models-search.js":
                return !!(
                    window.GENZModelsSearch
                );

            case "models-form.js":
                return !!(
                    window.GENZModelsForm
                );

            case "models-price.js":
                return !!(
                    window.GENZModelsPrice
                );

            case "models-ui.js":
                return !!(
                    window.GENZModelsUI
                );

            case "models-init.js":
                return !!(
                    window.GENZModelsInit
                );

            default:
                return false;
        }
    }

    /* =====================================================
       WAIT FOR GLOBAL
       ===================================================== */

    function waitForGlobal(
        file,
        timeout = 10000
    ) {
        return new Promise(
            function (resolve, reject) {
                const start =
                    Date.now();

                function check() {
                    if (
                        moduleGlobalReady(
                            file
                        )
                    ) {
                        resolve();
                        return;
                    }

                    if (
                        Date.now() -
                            start >=
                        timeout
                    ) {
                        reject(
                            new Error(
                                "Global module tidak tersedia setelah load: " +
                                file
                            )
                        );

                        return;
                    }

                    setTimeout(
                        check,
                        25
                    );
                }

                check();
            }
        );
    }

    /* =====================================================
       LOAD ALL MODULES
       ===================================================== */

    async function loadModules() {
        if (loading) {
            return false;
        }

        loading =
            true;

        try {
            for (
                const file
                of MODULES
            ) {
                log(
                    "Loading:",
                    file
                );

                await loadScript(
                    file
                );

                await waitForGlobal(
                    file
                );
            }

            log(
                "All Models modules loaded."
            );

            return true;

        } catch (
            err
        ) {
            error(
                "Module loading failed:",
                err
            );

            throw err;

        } finally {
            loading =
                false;
        }
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

        try {
            await loadModules();

            if (
                !window.GENZModelsInit
            ) {
                throw new Error(
                    "GENZModelsInit tidak tersedia."
                );
            }

            if (
                typeof
                    window.GENZModelsInit
                        .initialize !==
                "function"
            ) {
                throw new Error(
                    "GENZModelsInit.initialize() tidak tersedia."
                );
            }

            const result =
                await window.GENZModelsInit
                    .initialize();

            if (
                result === false
            ) {
                throw new Error(
                    "Models initialization gagal."
                );
            }

            initialized =
                true;

            log(
                "GEN-Z.AI Models ready."
            );

            return true;

        } catch (
            err
        ) {
            error(
                "Models initialization failed:",
                err
            );

            const alertBox =
                document.getElementById(
                    "alertBox"
                );

            if (alertBox) {
                alertBox.textContent =
                    "Gagal memuat Models: " +
                    (
                        err?.message ||
                        "Unknown error"
                    );

                alertBox.className =
                    "alert alert-error show";
            }

            return false;
        }
    }

    /* =====================================================
       STATUS
       ===================================================== */

    function isLoaded(
        file
    ) {
        return loadedModules.has(
            file
        );
    }

    function isInitialized() {
        return initialized;
    }

    function getLoadedModules() {
        return [
            ...loadedModules
        ];
    }

    /* =====================================================
       PUBLIC API
       ===================================================== */

    window.GENZModelsLoader =
        Object.freeze({
            loadScript,
            loadModules,
            initialize,

            isLoaded,
            isInitialized,

            getLoadedModules
        });

    /* =====================================================
       DOM READY
       ===================================================== */

    function start() {
        /*
         * Hindari start dua kali.
         */
        if (
            initialized ||
            loading
        ) {
            return;
        }

        initialize();
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
