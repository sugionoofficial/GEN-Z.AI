// vision-video/assets/js/vision-video-loader.js?v=20261006-7

/* =========================================================
   GEN-Z.AI VISION VIDEO
   ---------------------------------------------------------
   File:
   vision-video/assets/js/vision-video-loader.js

   Fungsi:
   - Entry point Vision Video
   - Memuat seluruh module secara berurutan
   - Memastikan dependency tersedia
   - Menjalankan initialization
   - Memuat credit module
   - Memuat model catalog Vision Video
   - Memuat history module
   - Menangani initialization error
   - Tidak berisi logic upload / API / analysis

   CATATAN:
   - Tidak menyentuh Vision Image
   - Credit Vision Video = 1 per generate
   - History menggunakan vision-video-history.js
   - Model menggunakan vision-video-models.js
   - Character Upload dimuat langsung dari index.html
========================================================= */

(function () {

    "use strict";


    /* =====================================================
       DOUBLE INITIALIZATION PROTECTION
    ===================================================== */

    if (
        window.__GENZ_VISION_VIDEO_LOADER_STARTED
    ) {

        console.warn(
            "[GEN-Z.AI Vision Video] Loader already started."
        );

        return;
    }


    window.__GENZ_VISION_VIDEO_LOADER_STARTED =
        true;


    /* =====================================================
       CONFIGURATION
    ===================================================== */

    const CONFIG = Object.freeze({

        /*
         * -------------------------------------------------
         * Cache bust seluruh module Vision Video.
         *
         * Penting karena module dimuat secara dinamis
         * oleh loader dan bukan langsung dari index.html.
         * -------------------------------------------------
         */

        cacheBust:
            "20261006-7",


        modules: [

            /* =================================================
               STATE
            ================================================= */

            {
                name:
                    "state",

                path:
                    "./assets/js/vision-video-state.js",

                ready:
                    "GENZVisionVideoStateReady"
            },


            /* =================================================
               DOM
            ================================================= */

            {
                name:
                    "dom",

                path:
                    "./assets/js/vision-video-dom.js",

                ready:
                    "GENZVisionVideoDOMReady"
            },


            /* =================================================
               CREDIT
               -------------------------------------------------
               Credit membutuhkan State + DOM.
            ================================================= */

            {
                name:
                    "credit",

                path:
                    "./assets/js/vision-video-credit.js",

                ready:
                    "GENZVisionVideoCreditReady"
            },


            /* =================================================
               HISTORY
               -------------------------------------------------
               History membutuhkan State.
            ================================================= */

            {
                name:
                    "history",

                path:
                    "./assets/js/vision-video-history.js",

                ready:
                    "GENZVisionVideoHistoryReady"
            },


            /* =================================================
               UPLOAD
            ================================================= */

            {
                name:
                    "upload",

                path:
                    "./assets/js/vision-video-upload.js",

                ready:
                    "GENZVisionVideoUploadReady"
            },


            /* =================================================
               PREVIEW
            ================================================= */

            {
                name:
                    "preview",

                path:
                    "./assets/js/vision-video-preview.js",

                ready:
                    "GENZVisionVideoPreviewReady"
            },


            /* =================================================
               FRAMES
            ================================================= */

            {
                name:
                    "frames",

                path:
                    "./assets/js/vision-video-frames.js",

                ready:
                    "GENZVisionVideoFramesReady"
            },


            /* =================================================
               ANALYSIS
            ================================================= */

            {
                name:
                    "analysis",

                path:
                    "./assets/js/vision-video-analysis.js",

                ready:
                    "GENZVisionVideoAnalysisReady"
            },


            /* =================================================
               API
            ================================================= */

            {
                name:
                    "api",

                path:
                    "./assets/js/vision-video-api.js",

                ready:
                    "GENZVisionVideoAPIReady"
            },


            /* =================================================
               MODELS
               -------------------------------------------------
               Model catalog membutuhkan State + DOM + API.
               Module ini mengambil daftar model Vision Video
               melalui operation openkey_models.
            ================================================= */

            {
                name:
                    "models",

                path:
                    "./assets/js/vision-video-models.js",

                ready:
                    "GENZVisionVideoModelsReady"
            },


            /* =================================================
               UI
            ================================================= */

            {
                name:
                    "ui",

                path:
                    "./assets/js/vision-video-ui.js",

                ready:
                    "GENZVisionVideoUIReady"
            },


            /* =================================================
               EVENTS
               -------------------------------------------------
               Events HARUS paling akhir karena bergantung
               pada semua module di atas.
            ================================================= */

            {
                name:
                    "events",

                path:
                    "./assets/js/vision-video-events.js",

                ready:
                    "GENZVisionVideoEventsReady"
            }

        ],

        readyTimeout:
            15000,

        pollInterval:
            50

    });


    /* =====================================================
       LOG
    ===================================================== */

    function log() {

        console.log.apply(
            console,
            [
                "[GEN-Z.AI Vision Video]"
            ].concat(
                Array.from(arguments)
            )
        );

    }


    function warn() {

        console.warn.apply(
            console,
            [
                "[GEN-Z.AI Vision Video]"
            ].concat(
                Array.from(arguments)
            )
        );

    }


    function error() {

        console.error.apply(
            console,
            [
                "[GEN-Z.AI Vision Video]"
            ].concat(
                Array.from(arguments)
            )
        );

    }


    /* =====================================================
       EVENT DISPATCH
    ===================================================== */

    function dispatch(
        name,
        detail = {}
    ) {

        try {

            document.dispatchEvent(
                new CustomEvent(
                    name,
                    {
                        detail
                    }
                )
            );

        } catch (
            err
        ) {

            warn(
                "Event dispatch failed:",
                name,
                err
            );

        }

    }


    /* =====================================================
       FIND LOADER SCRIPT
       -----------------------------------------------------
       Mencari script loader secara stabil.

       Tidak menggunakan document.currentScript karena
       initialization berjalan asynchronous.
    ===================================================== */

    function getLoaderScript() {

        const scripts =
            document.querySelectorAll(
                "script[src]"
            );


        for (
            const script
            of scripts
        ) {

            const src =
                script.getAttribute(
                    "src"
                );


            if (
                !src
            ) {

                continue;

            }


            try {

                const url =
                    new URL(
                        src,
                        window.location.href
                    );


                const pathname =
                    url.pathname
                        .toLowerCase();


                if (
                    pathname.endsWith(
                        "/vision-video-loader.js"
                    )
                ) {

                    return url;

                }

            } catch (
                err
            ) {

                /*
                 * Abaikan script dengan URL invalid.
                 */

            }

        }


        return null;

    }


    /* =====================================================
       MODULE BASE URL
       -----------------------------------------------------
       Base directory module adalah:

       /vision-video/assets/js/

       Fungsi ini dipertahankan untuk kompatibilitas
       internal loader.
    ===================================================== */

    function getModuleBaseURL() {

        const loaderURL =
            getLoaderScript();


        if (
            loaderURL
        ) {

            return new URL(
                "./",
                loaderURL
            );

        }


        return new URL(
            "/vision-video/assets/js/",
            window.location.origin
        );

    }


    /* =====================================================
       SCRIPT URL
       -----------------------------------------------------
       PENTING:
       -----------------------------------------------------
       CONFIG module menggunakan:

           ./assets/js/file.js

       Maka base yang digunakan HARUS:

           /vision-video/

       BUKAN:

           /vision-video/assets/js/

       Jika base salah, browser menghasilkan:

           /vision-video/assets/js/assets/js/file.js

       Resolver ini secara eksplisit menggunakan root
       Vision Video untuk mencegah duplicate assets/js.
    ===================================================== */

    function resolveURL(
        path
    ) {

        /*
         * -------------------------------------------------
         * Root resmi Vision Video.
         *
         * Struktur:
         *
         * /vision-video/
         * ├── index.html
         * └── assets/
         *     └── js/
         *
         * CONFIG menggunakan:
         *
         * ./assets/js/file.js
         *
         * sehingga base harus:
         *
         * /vision-video/
         * -------------------------------------------------
         */

        const visionVideoRoot =
            new URL(
                "/vision-video/",
                window.location.origin
            );


        /*
         * -------------------------------------------------
         * Normalisasi path.
         *
         * Contoh:
         *
         * ./assets/js/vision-video-state.js
         *
         * tetap menjadi:
         *
         * assets/js/vision-video-state.js
         *
         * sehingga hasil akhirnya:
         *
         * /vision-video/assets/js/vision-video-state.js
         * -------------------------------------------------
         */

        const normalizedPath =
            String(
                path || ""
            ).replace(
                /^\.?\//,
                ""
            );


        const url =
            new URL(
                normalizedPath,
                visionVideoRoot
            );


        /* =================================================
           CACHE BUST
        ================================================== */

        if (
            CONFIG.cacheBust
        ) {

            url.searchParams.set(
                "v",
                CONFIG.cacheBust
            );

        }


        return url.href;

    }


    /* =====================================================
       SCRIPT URL WITHOUT CACHE PARAMETER
       -----------------------------------------------------
       Digunakan hanya untuk membandingkan script yang
       sudah berada di DOM secara normal.
    ===================================================== */

    function normalizeScriptURL(
        url
    ) {

        try {

            const normalized =
                new URL(
                    url,
                    window.location.href
                );


            normalized.search = "";


            return normalized.href;

        } catch (
            err
        ) {

            return String(
                url || ""
            );

        }

    }


    /* =====================================================
       CHECK SCRIPT ALREADY LOADED
    ===================================================== */

    function isScriptLoaded(
        url
    ) {

        const scripts =
            document.querySelectorAll(
                "script[src]"
            );


        const target =
            normalizeScriptURL(
                url
            );


        for (
            const script
            of scripts
        ) {

            try {

                const src =
                    script.getAttribute(
                        "src"
                    );


                if (
                    !src
                ) {

                    continue;

                }


                const existing =
                    normalizeScriptURL(
                        src
                    );


                if (
                    existing ===
                    target
                ) {

                    return true;

                }

            } catch (
                err
            ) {

                /*
                 * URL tidak valid.
                 * Abaikan.
                 */

            }

        }


        return false;

    }


    /* =====================================================
       LOAD SCRIPT
    ===================================================== */

    function loadScript(
        module
    ) {

        return new Promise(
            function (
                resolve,
                reject
            ) {

                const url =
                    resolveURL(
                        module.path
                    );


                log(
                    `Resolved module URL: ${module.name}`,
                    url
                );


                /*
                 * -------------------------------------------------
                 * Jika ready flag sudah tersedia,
                 * module sudah siap.
                 * -------------------------------------------------
                 */

                if (
                    window[module.ready]
                ) {

                    resolve(
                        module
                    );

                    return;

                }


                /*
                 * -------------------------------------------------
                 * Jika script sudah ada di DOM tetapi ready flag
                 * belum tersedia, tunggu sampai siap.
                 * -------------------------------------------------
                 */

                if (
                    isScriptLoaded(
                        url
                    )
                ) {

                    log(
                        `Module script already exists: ${module.name}`
                    );


                    waitForReady(
                        module
                    )
                        .then(
                            function () {

                                resolve(
                                    module
                                );

                            }
                        )
                        .catch(
                            reject
                        );

                    return;

                }


                /*
                 * -------------------------------------------------
                 * Inject script.
                 * -------------------------------------------------
                 */

                const script =
                    document.createElement(
                        "script"
                    );


                script.src =
                    url;


                script.type =
                    "text/javascript";


                /*
                 * Dependency harus tetap berurutan.
                 */

                script.async =
                    false;


                script.dataset.genzVisionVideo =
                    module.name;


                let settled =
                    false;


                script.onload =
                    function () {

                        if (
                            settled
                        ) {

                            return;

                        }


                        settled =
                            true;


                        log(
                            `Script loaded: ${module.name}`
                        );


                        waitForReady(
                            module
                        )
                            .then(
                                function () {

                                    resolve(
                                        module
                                    );

                                }
                            )
                            .catch(
                                reject
                            );

                    };


                script.onerror =
                    function () {

                        if (
                            settled
                        ) {

                            return;

                        }


                        settled =
                            true;


                        reject(
                            new Error(
                                `Gagal memuat module ${module.name}: ${url}`
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
       WAIT FOR READY FLAG
    ===================================================== */

    function waitForReady(
        module
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
                        window[module.ready]
                    ) {

                        resolve(
                            module
                        );

                        return;

                    }


                    if (
                        Date.now() -
                        startedAt >=
                        CONFIG.readyTimeout
                    ) {

                        reject(
                            new Error(
                                `Module ${module.name} dimuat tetapi tidak memberikan ready flag ${module.ready}.`
                            )
                        );

                        return;

                    }


                    window.setTimeout(
                        check,
                        CONFIG.pollInterval
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

        const loaded =
            [];


        for (
            const module
            of CONFIG.modules
        ) {

            log(
                `Loading module: ${module.name}`
            );


            await loadScript(
                module
            );


            loaded.push(
                module.name
            );


            log(
                `Module ready: ${module.name}`
            );

        }


        return loaded;

    }


    /* =====================================================
       DEPENDENCY VALIDATION
    ===================================================== */

    function validateDependencies() {

        const requiredGlobals = [

            {
                name:
                    "State",

                value:
                    window.GENZVisionVideoState
            },

            {
                name:
                    "DOM",

                value:
                    window.GENZVisionVideoDOM
            },

            {
                name:
                    "Credit",

                value:
                    window.GENZVisionVideoCredit
            },

            {
                name:
                    "History",

                value:
                    window.GENZVisionVideoHistory
            },

            {
                name:
                    "Upload",

                value:
                    window.GENZVisionVideoUpload
            },

            {
                name:
                    "Preview",

                value:
                    window.GENZVisionVideoPreview
            },

            {
                name:
                    "Frames",

                value:
                    window.GENZVisionVideoFrames
            },

            {
                name:
                    "Analysis",

                value:
                    window.GENZVisionVideoAnalysis
            },

            {
                name:
                    "API",

                value:
                    window.GENZVisionVideoAPI
            },

            {
                name:
                    "Models",

                value:
                    window.GENZVisionVideoModels
            },

            {
                name:
                    "UI",

                value:
                    window.GENZVisionVideoUI
            },

            {
                name:
                    "Events",

                value:
                    window.GENZVisionVideoEvents
            }

        ];


        const missing =
            requiredGlobals
                .filter(
                    function (
                        item
                    ) {

                        return !item.value;

                    }
                )
                .map(
                    function (
                        item
                    ) {

                        return item.name;

                    }
                );


        if (
            missing.length
        ) {

            throw new Error(
                "Dependency Vision Video tidak lengkap: " +
                missing.join(
                    ", "
                )
            );

        }


        return true;

    }


    /* =====================================================
       INITIAL CREDIT
    ===================================================== */

    async function initializeCredit() {

        const credit =
            window.GENZVisionVideoCredit;


        const state =
            window.GENZVisionVideoState;


        if (
            !credit ||
            !state
        ) {

            throw new Error(
                "Vision Video Credit module belum tersedia."
            );

        }


        /*
         * -------------------------------------------------
         * Tetapkan biaya satu generate.
         * -------------------------------------------------
         */

        if (
            typeof state.setCreditRequired ===
                "function"
        ) {

            state.setCreditRequired(
                credit.getCost()
            );

        }


        /*
         * -------------------------------------------------
         * Reset status operasi credit.
         *
         * Tidak mengubah saldo server.
         * -------------------------------------------------
         */

        credit.resetOperationState();


        /*
         * -------------------------------------------------
         * Ambil saldo aktual dari server.
         * -------------------------------------------------
         */

        try {

            const result =
                await credit.checkCredit();


            log(
                "Credit synchronized:",
                credit.getCurrentCredit()
            );


            credit.refreshDisplay();


            return result;

        } catch (
            err
        ) {

            if (
                typeof state.setCreditError ===
                    "function"
            ) {

                state.setCreditError(
                    err
                );

            } else {

                state.set(
                    "credit.error",
                    err &&
                    err.message
                        ? err.message
                        : String(
                            err
                        )
                );

            }


            credit.refreshDisplay();


            warn(
                "Initial credit check gagal:",
                err
            );


            return null;

        }

    }


    /* =====================================================
       INITIAL MODELS
       -----------------------------------------------------
       Memuat catalog model Vision Video dari:

           vision-video-models.js

       Module Models sendiri menangani:
       - request openkey_models
       - filtering model vision
       - populate dropdown
       - menyimpan model terpilih ke state
       - error state model
    ===================================================== */

    async function initializeModels() {

        const models =
            window.GENZVisionVideoModels;


        if (
            !models
        ) {

            throw new Error(
                "Vision Video Models module belum tersedia."
            );

        }


        if (
            typeof models.loadModels !==
                "function"
        ) {

            throw new Error(
                "Vision Video Models module tidak memiliki loadModels()."
            );

        }


        try {

            const result =
                await models.loadModels();


            log(
                "Vision Video models synchronized."
            );


            return result;

        } catch (
            err
        ) {

            warn(
                "Initial model catalog gagal:",
                err
            );


            throw err;

        }

    }


    /* =====================================================
       INITIAL UI
    ===================================================== */

    function initializeUI() {

        const dom =
            window.GENZVisionVideoDOM;


        const ui =
            window.GENZVisionVideoUI;


        if (
            !dom ||
            !ui
        ) {

            return;

        }


        const page =
            dom.get(
                "page"
            );


        if (
            page
        ) {

            page.dataset.visionVideoReady =
                "true";

        }


        ui.sync();


        ui.updateAnalyzeButton();


        ui.renderCreditFromState();


        ui.renderCreditNotice();

    }


    /* =====================================================
       INITIAL STATE
    ===================================================== */

    function initializeState() {

        const state =
            window.GENZVisionVideoState;


        if (
            !state
        ) {

            return;

        }


        /*
         * Pastikan process kembali idle.
         */

        state.setProcess({

            running:
                false,

            progress:
                0,

            stage:
                "idle",

            message:
                "",

            error:
                null

        });


        /*
         * Bersihkan UI state.
         */

        state.set(
            "ui.analyzing",
            false
        );


        state.set(
            "ui.resultReady",
            false
        );


        state.set(
            "ui.copyReady",
            false
        );

    }


    /* =====================================================
       INITIAL EVENTS
    ===================================================== */

    function initializeEvents() {

        const events =
            window.GENZVisionVideoEvents;


        if (
            !events ||
            typeof events.bind !==
                "function"
        ) {

            throw new Error(
                "Vision Video Events module tidak memiliki bind()."
            );

        }


        events.bind();

    }


    /* =====================================================
       READY STATE
    ===================================================== */

    function markReady() {

        window.GENZVisionVideoReady =
            true;


        window.GENZVisionVideoInitialized =
            true;


        const page =
            document.getElementById(
                "visionVideoPage"
            );


        if (
            page
        ) {

            page.dataset.initialized =
                "true";


            page.dataset.error =
                "false";

        }


        dispatch(
            "genz:vision-video:ready",
            {

                ready:
                    true

            }
        );


        log(
            "Vision Video Engine ready."
        );

    }


    /* =====================================================
       ERROR STATE
    ===================================================== */

    function markError(
        err
    ) {

        window.GENZVisionVideoReady =
            false;


        window.GENZVisionVideoInitialized =
            false;


        const message =
            err &&
            err.message
                ? err.message
                : String(
                    err
                );


        const page =
            document.getElementById(
                "visionVideoPage"
            );


        if (
            page
        ) {

            page.dataset.initialized =
                "false";


            page.dataset.error =
                "true";


            page.dataset.errorMessage =
                message;

        }


        dispatch(
            "genz:vision-video:error",
            {

                error:
                    message

            }
        );


        error(
            "Initialization failed:",
            err
        );

    }


    /* =====================================================
       INITIALIZATION
    ===================================================== */

    let initialized =
        false;


    async function initialize() {

        if (
            initialized
        ) {

            return;

        }


        initialized =
            true;


        try {

            log(
                "Starting Vision Video Engine..."
            );


            /* =================================================
               WAIT DOM
            ================================================= */

            if (
                document.readyState ===
                "loading"
            ) {

                await new Promise(
                    function (
                        resolve
                    ) {

                        document.addEventListener(
                            "DOMContentLoaded",
                            resolve,
                            {
                                once:
                                    true
                            }
                        );

                    }
                );

            }


            /* =================================================
               LOAD MODULES
            ================================================= */

            const loaded =
                await loadModules();


            log(
                "All modules loaded:",
                loaded
            );


            /* =================================================
               VALIDATE DEPENDENCIES
            ================================================= */

            validateDependencies();


            /* =================================================
               INITIAL STATE
            ================================================= */

            initializeState();


            /* =================================================
               INITIAL CREDIT
            ================================================= */

            await initializeCredit();


            /* =================================================
               INITIAL MODELS
               -------------------------------------------------
               HARUS dijalankan sebelum Events/UI final
               agar settings.model sudah tersedia.
            ================================================= */

            await initializeModels();


            /* =================================================
               EVENTS
            ================================================= */

            initializeEvents();


            /* =================================================
               UI
            ================================================= */

            initializeUI();


            /* =================================================
               READY
            ================================================= */

            markReady();

        } catch (
            err
        ) {

            markError(
                err
            );

        }

    }


    /* =====================================================
       PUBLIC LOADER API
    ===================================================== */

    window.GENZVisionVideoLoader = {

        config:
            CONFIG,

        initialize,

        loadModules,

        validateDependencies,

        initializeCredit,

        initializeModels,

        isReady:
            function () {

                return Boolean(
                    window.GENZVisionVideoReady
                );

            }

    };


    /* =====================================================
       AUTO INITIALIZE
    ===================================================== */

    initialize();


})();
