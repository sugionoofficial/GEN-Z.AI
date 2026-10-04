/* =========================================================
   GEN-Z.AI VISION
   ---------------------------------------------------------
   File:
   vision/assets/js/vision-loader.js

   Fungsi:
   - Entry point Vision
   - Memastikan dependency tersedia
   - Inisialisasi state
   - Inisialisasi DOM
   - Inisialisasi UI
   - Inisialisasi upload
   - Inisialisasi events
   - Sinkronisasi credit awal
   - Tidak menangani API Vision langsung
   - Tidak menangani proses generate langsung
========================================================= */


/* =========================================================
   CONFIG
========================================================= */

const VISION_LOADER_CONFIG =
    Object.freeze({

        REQUIRED_MODULES: [

            "GENZVisionState",

            "GENZVisionDOM",

            "GENZVisionUpload",

            "GENZVisionPreview",

            "GENZVisionUI",

            "GENZVisionCredit",

            "GENZVisionAPI",

            "GENZVisionAnalysis",

            "GENZVisionPrompt",

            "GENZVisionHistory",

            "GENZVisionEvents"

        ],

        MAX_WAIT:
            10000,

        RETRY_INTERVAL:
            50

    });


/* =========================================================
   WAIT
========================================================= */

function wait(
    milliseconds
) {

    return new Promise(
        resolve => {

            setTimeout(
                resolve,
                milliseconds
            );

        }
    );

}


/* =========================================================
   CHECK MODULES
========================================================= */

function getMissingModules() {

    return VISION_LOADER_CONFIG
        .REQUIRED_MODULES
        .filter(
            name =>
                !window[name]
        );

}


/* =========================================================
   WAIT FOR MODULES
========================================================= */

async function waitForModules() {

    const startedAt =
        Date.now();


    while (
        Date.now() -
        startedAt <
        VISION_LOADER_CONFIG.MAX_WAIT
    ) {

        const missing =
            getMissingModules();


        if (
            missing.length ===
            0
        ) {

            return true;

        }


        await wait(
            VISION_LOADER_CONFIG
                .RETRY_INTERVAL
        );

    }


    const missing =
        getMissingModules();


    throw new Error(

        "Vision dependency belum tersedia: " +
        missing.join(
            ", "
        )

    );

}


/* =========================================================
   INITIALIZE STATE
========================================================= */

function initializeState() {

    const state =
        window.GENZVisionState;


    if (
        !state
    ) {

        throw new Error(
            "GENZVisionState belum tersedia."
        );

    }


    if (
        typeof state.initialize ===
        "function"
    ) {

        state.initialize();

    }


    return true;

}


/* =========================================================
   INITIALIZE DOM
========================================================= */

function initializeDOM() {

    const dom =
        window.GENZVisionDOM;


    if (
        !dom
    ) {

        throw new Error(
            "GENZVisionDOM belum tersedia."
        );

    }


    if (
        typeof dom.initialize ===
        "function"
    ) {

        dom.initialize();

    }


    return true;

}


/* =========================================================
   INITIALIZE PREVIEW
========================================================= */

function initializePreview() {

    const preview =
        window.GENZVisionPreview;


    if (
        !preview
    ) {

        throw new Error(
            "GENZVisionPreview belum tersedia."
        );

    }


    if (
        typeof preview.initialize ===
        "function"
    ) {

        preview.initialize();

    }


    return true;

}


/* =========================================================
   INITIALIZE UPLOAD
========================================================= */

function initializeUpload() {

    const upload =
        window.GENZVisionUpload;


    if (
        !upload
    ) {

        throw new Error(
            "GENZVisionUpload belum tersedia."
        );

    }


    if (
        typeof upload.initialize ===
        "function"
    ) {

        upload.initialize();

    }


    return true;

}


/* =========================================================
   INITIALIZE UI
========================================================= */

function initializeUI() {

    const ui =
        window.GENZVisionUI;


    if (
        !ui
    ) {

        throw new Error(
            "GENZVisionUI belum tersedia."
        );

    }


    if (
        typeof ui.initialize ===
        "function"
    ) {

        ui.initialize();

    }


    if (
        typeof ui.syncFromState ===
        "function"
    ) {

        ui.syncFromState();

    }


    return true;

}


/* =========================================================
   INITIALIZE EVENTS
========================================================= */

function initializeEvents() {

    const events =
        window.GENZVisionEvents;


    if (
        !events
    ) {

        throw new Error(
            "GENZVisionEvents belum tersedia."
        );

    }


    if (
        typeof events.initialize ===
        "function"
    ) {

        events.initialize();

    }


    return true;

}


/* =========================================================
   LOAD INITIAL CREDIT
========================================================= */

async function initializeCredit() {

    const credit =
        window.GENZVisionCredit;


    if (
        !credit
    ) {

        throw new Error(
            "GENZVisionCredit belum tersedia."
        );

    }


    /*
     * checkCredit() hanya membaca saldo
     * dan melakukan validasi.
     *
     * Tidak ada deduction di tahap ini.
     */

    try {

        const result =
            await credit.checkCredit();


        if (
            result?.credits !==
            undefined
        ) {

            const state =
                window.GENZVisionState;


            state.set(
                "auth.credits",
                Number(
                    result.credits
                )
            );

        }


        return result;

    } catch (
        error
    ) {

        /*
         * Jangan membuat halaman gagal
         * hanya karena saldo gagal dibaca.
         *
         * User tetap bisa melihat halaman,
         * tetapi tombol proses akan memvalidasi
         * credit lagi saat digunakan.
         */

        console.warn(
            "[GEN-Z.AI Vision] Initial credit check gagal:",
            error
        );


        return {

            allowed:
                false,

            credits:
                null,

            error:
                error

        };

    }

}


/* =========================================================
   INITIALIZE EVERYTHING
========================================================= */

async function initialize() {

    try {

        /*
         * Pastikan semua file module
         * sudah loaded.
         */

        await waitForModules();


        /*
         * State
         */

        initializeState();


        /*
         * DOM
         */

        initializeDOM();


        /*
         * Preview
         */

        initializePreview();


        /*
         * Upload
         */

        initializeUpload();


        /*
         * UI
         */

        initializeUI();


        /*
         * Events
         */

        initializeEvents();


        /*
         * Credit
         */

        await initializeCredit();


        /*
         * Final UI sync
         */

        if (
            window.GENZVisionUI &&
            typeof window
                .GENZVisionUI
                .syncFromState ===
                "function"
        ) {

            window.GENZVisionUI
                .syncFromState();

        }


        window.GENZVisionReady =
            true;


        window.dispatchEvent(
            new CustomEvent(
                "genz:vision-ready"
            )
        );


        console.info(
            "[GEN-Z.AI Vision] Vision Engine ready."
        );


        return true;

    } catch (
        error
    ) {

        console.error(
            "[GEN-Z.AI Vision] Initialization failed:",
            error
        );


        window.GENZVisionReady =
            false;


        window.dispatchEvent(
            new CustomEvent(
                "genz:vision-error",
                {

                    detail: {

                        error

                    }

                }
            )
        );


        return false;

    }

}


/* =========================================================
   PUBLIC API
========================================================= */

const GENZVisionLoader =
    Object.freeze({

        CONFIG:
            VISION_LOADER_CONFIG,

        waitForModules,

        getMissingModules,

        initialize

    });


/* =========================================================
   GLOBAL EXPORT
========================================================= */

window.GENZVisionLoader =
    GENZVisionLoader;


/* =========================================================
   AUTO START
========================================================= */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(

        "DOMContentLoaded",

        () => {

            initialize();

        },

        {
            once:
                true
        }

    );

} else {

    initialize();

}
