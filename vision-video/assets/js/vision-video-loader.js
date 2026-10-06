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
   - Menangani initialization error
   - Tidak berisi logic upload / API / analysis
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

        modules: [

            /* -------------------------------------------------
               STATE
            ------------------------------------------------- */

            {
                name:
                    "state",

                path:
                    "./assets/js/vision-video-state.js",

                ready:
                    "GENZVisionVideoStateReady"
            },


            /* -------------------------------------------------
               DOM
            ------------------------------------------------- */

            {
                name:
                    "dom",

                path:
                    "./assets/js/vision-video-dom.js",

                ready:
                    "GENZVisionVideoDOMReady"
            },


            /* -------------------------------------------------
               CREDIT
               -------------------------------------------------
               Harus setelah State + DOM karena credit module
               membutuhkan keduanya.
            ------------------------------------------------- */

            {
                name:
                    "credit",

                path:
                    "./assets/js/vision-video-credit.js",

                ready:
                    "GENZVisionVideoCreditReady"
            },


            /* -------------------------------------------------
               UPLOAD
            ------------------------------------------------- */

            {
                name:
                    "upload",

                path:
                    "./assets/js/vision-video-upload.js",

                ready:
                    "GENZVisionVideoUploadReady"
            },


            /* -------------------------------------------------
               PREVIEW
            ------------------------------------------------- */

            {
                name:
                    "preview",

                path:
                    "./assets/js/vision-video-preview.js",

                ready:
                    "GENZVisionVideoPreviewReady"
            },


            /* -------------------------------------------------
               FRAMES
            ------------------------------------------------- */

            {
                name:
                    "frames",

                path:
                    "./assets/js/vision-video-frames.js",

                ready:
                    "GENZVisionVideoFramesReady"
            },


            /* -------------------------------------------------
               ANALYSIS
            ------------------------------------------------- */

            {
                name:
                    "analysis",

                path:
                    "./assets/js/vision-video-analysis.js",

                ready:
                    "GENZVisionVideoAnalysisReady"
            },


            /* -------------------------------------------------
               API
            ------------------------------------------------- */

            {
                name:
                    "api",

                path:
                    "./assets/js/vision-video-api.js",

                ready:
                    "GENZVisionVideoAPIReady"
            },


            /* -------------------------------------------------
               UI
            ------------------------------------------------- */

            {
                name:
                    "ui",

                path:
                    "./assets/js/vision-video-ui.js",

                ready:
                    "GENZVisionVideoUIReady"
            },


            /* -------------------------------------------------
               EVENTS
            ------------------------------------------------- */

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
       SCRIPT URL
    ===================================================== */

    function resolveURL(
        path
    ) {

        const currentScript =
            document.currentScript;


        if (
            currentScript &&
            currentScript.src
        ) {

            return new URL(
                path,
                currentScript.src
            ).href;

        }


        return new URL(
            path,
            window.location.href
        ).href;

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


        for (
            const script
            of scripts
        ) {

            try {

                const existing =
                    new URL(
                        script.src,
                        window.location.href
                    ).href;


                if (
                    existing ===
                    url
                ) {

                    return true;

                }

            } catch (
                err
            ) {

                /*
                 * Abaikan script URL yang
                 * tidak dapat diparse.
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
                 * Jika script sudah ada di DOM tetapi
                 * belum memberikan ready flag, tunggu.
                 * -------------------------------------------------
                 */

                if (
                    isScriptLoaded(
                        url
                    )
                ) {

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
                 * Inject script
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
                                `Gagal memuat module ${module.name}: ${module.path}`
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
         * Tidak mengubah saldo.
         * -------------------------------------------------
         */

        credit.resetOperationState();


        /*
         * -------------------------------------------------
         * Ambil saldo aktual dari server.
         *
         * Ini yang membuat badge tidak lagi
         * menampilkan 0 hanya karena state awal null.
         * -------------------------------------------------
         */

        try {

            await credit.checkCredit();

            log(
                "Credit synchronized:",
                credit.getCurrentCredit()
            );

        } catch (
            err
        ) {

            /*
             * -------------------------------------------------
             * Credit check gagal.
             *
             * Jangan menghentikan seluruh engine.
             * UI tetap dapat dibuka, tetapi saldo tidak
             * dianggap valid sampai check berikutnya.
             * -------------------------------------------------
             */

            state.setCreditError(
                err
            );


            credit.refreshDisplay();


            warn(
                "Initial credit check gagal:",
                err
            );

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


        /*
         * Render state setelah credit
         * berhasil/gagal disinkronkan.
         */

        ui.sync();


        ui.updateAnalyzeButton();

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
         * Pastikan state process kembali
         * ke kondisi idle apabila halaman
         * baru dibuka.
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
         * Pastikan UI analysis tidak dianggap
         * sedang berjalan setelah reload.
         */

        state.set(
            "ui.analyzing",
            false
        );


        state.set(
            "ui.resultReady",
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


            /*
             * -------------------------------------------------
             * Pastikan DOM halaman sudah siap.
             * -------------------------------------------------
             */

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


            /*
             * -------------------------------------------------
             * Load module berdasarkan dependency order.
             * -------------------------------------------------
             */

            const loaded =
                await loadModules();


            log(
                "All modules loaded:",
                loaded
            );


            /*
             * -------------------------------------------------
             * Validasi seluruh global.
             * -------------------------------------------------
             */

            validateDependencies();


            /*
             * -------------------------------------------------
             * State awal.
             * -------------------------------------------------
             */

            initializeState();


            /*
             * -------------------------------------------------
             * Credit harus disinkronkan sebelum UI pertama
             * kali dirender.
             * -------------------------------------------------
             */

            await initializeCredit();


            /*
             * -------------------------------------------------
             * Events setelah semua dependency siap.
             * -------------------------------------------------
             */

            initializeEvents();


            /*
             * -------------------------------------------------
             * UI terakhir.
             * -------------------------------------------------
             */

            initializeUI();


            /*
             * -------------------------------------------------
             * Engine siap.
             * ------------------------------------------------- */

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
