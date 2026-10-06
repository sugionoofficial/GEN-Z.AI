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
   - Memuat history module
   - Memastikan Character Upload siap setelah State
   - Menangani initialization error
   - Tidak berisi logic upload / API / analysis

   CATATAN:
   - Tidak menyentuh Vision Image
   - Credit Vision Video = 1 per generate
   - History menggunakan vision-video-history.js
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
               CHARACTER UPLOAD
               -------------------------------------------------
               Character Upload bergantung pada:
               - DOM halaman
               - State

               File ini sudah dimuat dari index.html.

               Loader hanya memastikan module tersebut
               benar-benar ready setelah State tersedia.
            ================================================= */

            {
                name:
                    "character-upload",

                path:
                    "./assets/js/vision-video-character-upload.js",

                ready:
                    "GENZVisionVideoCharacterUploadReady"
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
               Harus dimuat sebelum Events.
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
               Events HARUS paling akhir.
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
       SCRIPT URL
    ===================================================== */

    function resolveURL(
        path
    ) {

        /*
         * Karena loader sendiri dimuat dari:
         *
         * vision-video/assets/js/
         *
         * maka relative path module harus
         * dihitung dari lokasi loader.
         */

        const loaderScript =
            document.querySelector(
                'script[src*="vision-video-loader.js"]'
            );


        if (
            loaderScript &&
            loaderScript.src
        ) {

            return new URL(
                path,
                loaderScript.src
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
                 * Abaikan URL yang invalid.
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
                 * Module sudah ready.
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
                 * Script sudah ada di DOM tetapi belum ready.
                 *
                 * Ini penting untuk Character Upload karena
                 * index.html memang sudah memuat file tersebut
                 * sebelum loader.
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
                 * Dependency harus tetap sequential.
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
       CHARACTER UPLOAD VALIDATION
    ===================================================== */

    function validateCharacterUpload() {

        const uploader =
            window.GENZVisionVideoCharacterUpload;


        const state =
            window.GENZVisionVideoState;


        if (
            !uploader
        ) {

            throw new Error(
                "Vision Video Character Upload module tidak tersedia."
            );

        }


        if (
            typeof uploader.initialize !==
            "function"
        ) {

            throw new Error(
                "Vision Video Character Upload tidak memiliki initialize()."
            );

        }


        if (
            !state
        ) {

            throw new Error(
                "Vision Video State belum tersedia untuk Character Upload."
            );

        }


        /*
         * Pastikan uploader diinisialisasi
         * setelah State sudah tersedia.
         */

        const initialized =
            uploader.initialize();


        if (
            initialized === false
        ) {

            throw new Error(
                "Vision Video Character Upload gagal diinisialisasi."
            );

        }


        /*
         * Pastikan ready flag tersedia.
         */

        window.GENZVisionVideoCharacterUploadReady =
            true;


        log(
            "Character Upload ready."
        );


        return true;

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
                    "Character Upload",

                value:
                    window.GENZVisionVideoCharacterUpload
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
         * Tetapkan biaya satu generate.
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
         * Reset status operasi credit.
         */

        credit.resetOperationState();


        /*
         * Ambil saldo aktual.
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
         * Process baru dimulai dari idle.
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
         * UI state bersih.
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
               CHARACTER UPLOAD
               -------------------------------------------------
               Pastikan Character Upload menggunakan State
               yang sudah benar-benar tersedia.
            ================================================= */

            validateCharacterUpload();


            /* =================================================
               INITIAL CREDIT
            ================================================= */

            await initializeCredit();


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

        validateCharacterUpload,

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
