/* =========================================================
   GEN-Z.AI VISION
   ---------------------------------------------------------
   File:
   vision/assets/js/vision-loader.js

   Fungsi:
   - Entry point Vision
   - Memuat seluruh module Vision
   - Menjamin urutan dependency
   - Inisialisasi state
   - Inisialisasi DOM
   - Inisialisasi Supabase
   - Inisialisasi preview
   - Inisialisasi upload
   - Inisialisasi UI
   - Inisialisasi events
   - Sinkronisasi credit awal
   - Tidak menangani proses Vision langsung
========================================================= */


/* =========================================================
   MODULE IMPORT
   ---------------------------------------------------------
   Semua module Vision dimuat dari satu entry point.

   URUTAN PENTING:
   1. State
   2. DOM
   3. Upload / Preview / UI
   4. Supabase
   5. Credit / API / Analysis / Prompt / History
   6. Events
========================================================= */

import "./vision-state.js";
import "./vision-dom.js";
import "./vision-upload.js";
import "./vision-preview.js";
import "./vision-ui.js";
import "./vision-supabase.js";
import "./vision-credit.js";
import "./vision-api.js";
import "./vision-analysis.js";
import "./vision-prompt.js";
import "./vision-history.js";
import "./vision-events.js";


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

            "GENZVisionSupabase",

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


    /*
     * vision-dom.js saat ini tidak
     * membutuhkan initialize().
     *
     * getDOM() akan membangun cache
     * ketika pertama kali digunakan.
     */

    if (
        typeof dom.resetDOMCache ===
        "function"
    ) {

        dom.resetDOMCache();

    }


    const validation =
        dom.validateDOM({

            log:
                true

        });


    if (
        !validation.valid
    ) {

        throw new Error(
            "Vision DOM tidak lengkap."
        );

    }


    /*
     * Paksa DOM cache dibuat setelah
     * seluruh HTML tersedia.
     */

    dom.getDOM();


    return true;

}


/* =========================================================
   INITIALIZE SUPABASE
   ---------------------------------------------------------
   Supabase harus tersedia SEBELUM:
   - vision-credit.js
   - vision-api.js
   - vision-history.js

   vision-supabase.js bertugas membuat:
   window.supabaseClient
========================================================= */

function initializeSupabase() {

    const supabase =
        window.GENZVisionSupabase;


    if (
        !supabase
    ) {

        throw new Error(
            "GENZVisionSupabase belum tersedia."
        );

    }


    if (
        typeof supabase.initialize !==
        "function"
    ) {

        throw new Error(
            "GENZVisionSupabase.initialize() belum tersedia."
        );

    }


    const client =
        supabase.initialize();


    if (
        !client
    ) {

        throw new Error(
            "Supabase client gagal dibuat."
        );

    }


    /*
     * Pastikan global client benar-benar
     * tersedia untuk seluruh module Vision.
     */

    if (
        !window.supabaseClient
    ) {

        window.supabaseClient =
            client;

    }


    if (
        typeof window.supabaseClient
            .auth
            ?.getSession !==
        "function"
    ) {

        throw new Error(
            "Supabase client tidak memiliki auth.getSession()."
        );

    }


    console.info(
        "[GEN-Z.AI Vision] Supabase client ready."
    );


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
        typeof events.initialize !==
        "function"
    ) {

        throw new Error(
            "GENZVisionEvents.initialize() belum tersedia."
        );

    }


    const initialized =
        events.initialize();


    if (
        initialized === false
    ) {

        throw new Error(
            "Vision events gagal diinisialisasi."
        );

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
     * checkCredit() hanya membaca
     * dan memvalidasi saldo.
     *
     * Tidak melakukan deduction.
     */

    try {

        const result =
            await credit.checkCredit();


        if (
            result?.credits !==
            undefined &&
            result?.credits !==
            null
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
         * Gagal membaca credit tidak
         * membuat seluruh halaman mati.
         *
         * Saat Generate ditekan,
         * credit akan diperiksa kembali.
         */

        console.warn(
            "[GEN-Z.AI Vision] Initial credit check gagal:",
            error
        );


        return {

            allowed:
                false,

            sufficient:
                false,

            credits:
                null,

            error:
                error

        };

    }

}


/* =========================================================
   FINAL UI SYNC
========================================================= */

function finalUISync() {

    const ui =
        window.GENZVisionUI;


    if (
        !ui
    ) {

        return false;

    }


    if (
        typeof ui.syncFromState ===
        "function"
    ) {

        ui.syncFromState();

    }


    /*
     * Refresh credit badge setelah
     * initial credit check selesai.
     */

    const credit =
        window.GENZVisionCredit;


    if (
        credit &&
        typeof credit.refreshDisplay ===
        "function"
    ) {

        credit.refreshDisplay();

    }


    return true;

}


/* =========================================================
   INITIALIZE EVERYTHING
========================================================= */

async function initialize() {

    try {

        /*
         * -------------------------------------------------
         * MODULES
         * -------------------------------------------------
         *
         * Import di bagian atas file memastikan
         * seluruh module Vision dimuat.
         */

        await waitForModules();


        /*
         * -------------------------------------------------
         * STATE
         * -------------------------------------------------
         */

        initializeState();


        /*
         * -------------------------------------------------
         * DOM
         * -------------------------------------------------
         *
         * Harus dilakukan sebelum event binding.
         */

        initializeDOM();


        /*
         * -------------------------------------------------
         * SUPABASE
         * -------------------------------------------------
         *
         * WAJIB sebelum credit/API/history.
         *
         * Ini membuat:
         *
         * window.supabaseClient
         *
         * tersedia untuk seluruh module Vision.
         */

        initializeSupabase();


        /*
         * -------------------------------------------------
         * PREVIEW
         * -------------------------------------------------
         */

        initializePreview();


        /*
         * -------------------------------------------------
         * UPLOAD
         * -------------------------------------------------
         */

        initializeUpload();


        /*
         * -------------------------------------------------
         * UI
         * -------------------------------------------------
         */

        initializeUI();


        /*
         * -------------------------------------------------
         * EVENTS
         * -------------------------------------------------
         *
         * Setelah ini tombol SELECT IMAGE,
         * dropzone, remove, generate, copy,
         * model, detail, purpose dan instruction
         * sudah memiliki event listener.
         */

        initializeEvents();


        /*
         * -------------------------------------------------
         * INITIAL CREDIT
         * -------------------------------------------------
         *
         * Supabase sudah siap pada tahap ini.
         */

        await initializeCredit();


        /*
         * -------------------------------------------------
         * FINAL UI
         * -------------------------------------------------
         */

        finalUISync();


        /*
         * -------------------------------------------------
         * READY FLAG
         * -------------------------------------------------
         */

        window.GENZVisionReady =
            true;


        /*
         * -------------------------------------------------
         * READY EVENT
         * -------------------------------------------------
         */

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
