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
   - Mengambil katalog model OpenKey
   - Mengisi dropdown model Vision
   - Mengaktifkan dropdown setelah model tersedia
   - Inisialisasi preview
   - Inisialisasi upload
   - Inisialisasi UI
   - Inisialisasi events
   - Sinkronisasi credit awal
   - Tidak menangani proses Vision langsung
========================================================= */


/* =========================================================
   MODULE IMPORT
========================================================= */

import "./vision-state.js";
import "./vision-dom.js";
import "./vision-upload.js";
import "./vision-preview.js";
import "./vision-ui.js";
import "./vision-premium.js";
import "./vision-supabase.js";
import "./vision-credit.js";


/* =========================================================
   VISION API DEPENDENCY CHAIN
========================================================= */

import "./vision-api-core.js";
import "./vision-api-models.js";
import "./vision-api-response.js";
import "./vision-api-analysis.js";
import "./vision-api-prompt.js";
import "./vision-api.js";


/* =========================================================
   VISION PROCESS MODULES
========================================================= */

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


    dom.getDOM();


    return true;

}


/* =========================================================
   INITIALIZE SUPABASE
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
   MODEL NORMALIZER
========================================================= */

function normalizeCatalogModel(
    model
) {

    const api =
        window.GENZVisionAPI;


    if (
        !api
    ) {

        return null;

    }


    if (
        typeof api.normalizeVisionModel !==
        "function"
    ) {

        return null;

    }


    return api.normalizeVisionModel(
        model
    );

}


/* =========================================================
   CHECK IMAGE SUPPORT
========================================================= */

function supportsImageInput(
    model
) {

    const api =
        window.GENZVisionAPI;


    if (
        !api
    ) {

        return false;

    }


    if (
        typeof api.supportsImageInput !==
        "function"
    ) {

        return false;

    }


    return api.supportsImageInput(
        model
    );

}


/* =========================================================
   POPULATE MODEL SELECT
========================================================= */

async function initializeModelCatalog() {

    const api =
        window.GENZVisionAPI;


    const domRegistry =
        window.GENZVisionDOM;


    const state =
        window.GENZVisionState;


    if (
        !api
    ) {

        throw new Error(
            "GENZVisionAPI belum tersedia."
        );

    }


    if (
        !domRegistry
    ) {

        throw new Error(
            "GENZVisionDOM belum tersedia."
        );

    }


    if (
        !state
    ) {

        throw new Error(
            "GENZVisionState belum tersedia."
        );

    }


    if (
        typeof api.getOpenKeyModels !==
        "function"
    ) {

        throw new Error(
            "GENZVisionAPI.getOpenKeyModels() belum tersedia."
        );

    }


    if (
        typeof api.normalizeVisionModel !==
        "function"
    ) {

        throw new Error(
            "GENZVisionAPI.normalizeVisionModel() belum tersedia."
        );

    }


    if (
        typeof api.supportsImageInput !==
        "function"
    ) {

        throw new Error(
            "GENZVisionAPI.supportsImageInput() belum tersedia."
        );

    }


    const dom =
        domRegistry.getDOM();


    const select =
        dom.model;


    if (
        !select
    ) {

        throw new Error(
            "visionModel tidak ditemukan."
        );

    }


    /* -----------------------------------------------------
       LOCK DROPDOWN
    ----------------------------------------------------- */

    select.disabled =
        true;


    /* -----------------------------------------------------
       AMBIL KATALOG OPENKEY
    ----------------------------------------------------- */

    const catalog =
        await api.getOpenKeyModels();


    if (
        !Array.isArray(catalog)
    ) {

        throw new Error(
            "Katalog model OpenKey tidak valid."
        );

    }


    console.info(
        "[GEN-Z.AI Vision] OpenKey catalog count:",
        catalog.length
    );


    /* -----------------------------------------------------
       NORMALIZE
    ----------------------------------------------------- */

    const normalizedCatalog =
        catalog
            .map(
                normalizeCatalogModel
            )
            .filter(
                Boolean
            );


    console.info(
        "[GEN-Z.AI Vision] Normalized catalog count:",
        normalizedCatalog.length
    );


    /* -----------------------------------------------------
       FILTER VISION MODELS
    ----------------------------------------------------- */

    const models =
        normalizedCatalog
            .filter(
                supportsImageInput
            );


    /* -----------------------------------------------------
       DEBUG CAPABILITY
    ----------------------------------------------------- */

    console.info(
        "[GEN-Z.AI Vision] Vision capability evaluation:",
        normalizedCatalog.map(
            model => ({

                id:
                    model.id,

                name:
                    model.name,

                input_modalities:
                    model.input_modalities,

                capabilities:
                    model.capabilities,

                supports_image:
                    supportsImageInput(
                        model
                    )

            })
        )
    );


    if (
        models.length ===
        0
    ) {

        select.disabled =
            true;


        throw new Error(
            "OpenKey tidak menyediakan model yang mendukung input gambar."
        );

    }


    /* -----------------------------------------------------
       AMBIL MODEL SEBELUMNYA
    ----------------------------------------------------- */

    let previousModelId =
        "";


    if (
        typeof state.getModelId ===
        "function"
    ) {

        previousModelId =
            String(
                state.getModelId() ||
                ""
            ).trim();

    }


    if (
        !previousModelId
    ) {

        previousModelId =
            String(
                select.value ||
                ""
            ).trim();

    }


    /* -----------------------------------------------------
       CLEAR OPTION LAMA
    ----------------------------------------------------- */

    select.innerHTML =
        "";


    /* -----------------------------------------------------
       TAMBAHKAN MODEL
    ----------------------------------------------------- */

    models.forEach(
        model => {

            const option =
                document.createElement(
                    "option"
                );


            option.value =
                model.id;


            option.textContent =
                model.name;


            option.dataset.provider =
                "openkey";


            option.dataset.modelId =
                model.id;


            select.appendChild(
                option
            );

        }
    );


    /* -----------------------------------------------------
       TENTUKAN MODEL TERPILIH
    ----------------------------------------------------- */

    const previousExists =
        models.some(
            model =>
                model.id ===
                previousModelId
        );


    const selectedModel =
        previousExists
            ? models.find(
                model =>
                    model.id ===
                    previousModelId
            )
            : models[0];


    if (
        !selectedModel
    ) {

        select.disabled =
            true;


        throw new Error(
            "Tidak dapat menentukan model Vision."
        );

    }


    select.value =
        selectedModel.id;


    /* -----------------------------------------------------
       SINKRONKAN MODEL KE STATE
    ----------------------------------------------------- */

    if (
        typeof state.setModel ===
        "function"
    ) {

        state.setModel({

            ...selectedModel,

            providerId:
                "openkey",

            providerName:
                "OpenKey"

        });

    }


    if (
        typeof state.setModelId ===
        "function"
    ) {

        state.setModelId(
            selectedModel.id
        );

    }


    if (
        typeof state.setModelName ===
        "function"
    ) {

        state.setModelName(
            selectedModel.name
        );

    }


    if (
        typeof state.setModelProvider ===
        "function"
    ) {

        state.setModelProvider(
            "openkey"
        );

    }


    if (
        typeof state.setModelAvailable ===
        "function"
    ) {

        state.setModelAvailable(
            true
        );

    }


    /* -----------------------------------------------------
       ENABLE DROPDOWN
    ----------------------------------------------------- */

    select.disabled =
        false;


    console.info(
        "[GEN-Z.AI Vision] OpenKey Vision models loaded:",
        models.map(
            model =>
                model.id
        )
    );


    console.info(
        "[GEN-Z.AI Vision] Vision model selected:",
        selectedModel.id
    );


    return {

        models,

        selected:
            selectedModel

    };

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
   INITIALIZE CREDIT
   ---------------------------------------------------------
   Sumber credit:
   profiles.credits

   State:
   GENZVisionState.credit.balance

   PENTING:
   Jangan menggunakan:
       state.set("auth.credits", ...)

   karena GENZVisionState tidak mempunyai
   fungsi set() generik dan credit bukan
   bagian dari auth.
========================================================= */

async function initializeCredit() {

    const credit =
        window.GENZVisionCredit;


    const state =
        window.GENZVisionState;


    if (
        !credit
    ) {

        throw new Error(
            "GENZVisionCredit belum tersedia."
        );

    }


    if (
        !state
    ) {

        throw new Error(
            "GENZVisionState belum tersedia."
        );

    }


    /*
     * Pastikan API state credit tersedia.
     */

    if (
        typeof state.setCreditBalance !==
        "function"
    ) {

        throw new Error(
            "GENZVisionState.setCreditBalance() belum tersedia."
        );

    }


    try {

        /*
         * -------------------------------------------------
         * CHECK CREDIT
         * -------------------------------------------------
         *
         * checkCredit() membaca saldo dari
         * profiles.credits.
         *
         * Tidak melakukan deduction.
         */

        const result =
            await credit.checkCredit();


        console.info(
            "[GEN-Z.AI Vision] Initial credit result:",
            result
        );


        /*
         * -------------------------------------------------
         * AMBIL NILAI CREDIT
         * -------------------------------------------------
         *
         * Prioritas:
         *
         * 1. result.credits
         * 2. result.balance
         * 3. result.credit
         *
         * Ini hanya normalisasi output.
         */

        let credits =
            null;


        if (
            result &&
            result.credits !==
            undefined &&
            result.credits !==
            null
        ) {

            credits =
                Number(
                    result.credits
                );

        }
        else if (
            result &&
            result.balance !==
            undefined &&
            result.balance !==
            null
        ) {

            credits =
                Number(
                    result.balance
                );

        }
        else if (
            result &&
            result.credit !==
            undefined &&
            result.credit !==
            null
        ) {

            credits =
                Number(
                    result.credit
                );

        }


        /*
         * -------------------------------------------------
         * SIMPAN CREDIT KE STATE
         * -------------------------------------------------
         */

        if (
            Number.isFinite(
                credits
            )
        ) {

            state.setCreditBalance(
                credits
            );


            /*
             * Credit sudah berhasil
             * dimuat ke state.
             */

            if (
                typeof state.setCreditLoaded ===
                "function"
            ) {

                state.setCreditLoaded(
                    true
                );

            }


            /*
             * Remaining mengikuti balance
             * pada initial load.
             *
             * Required masih 0 sampai
             * proses generate menentukan
             * kebutuhan credit.
             */

            if (
                typeof state.getCreditRequired ===
                "function" &&
                typeof state.setCreditRemaining ===
                "function"
            ) {

                const required =
                    Number(
                        state.getCreditRequired()
                    );


                if (
                    Number.isFinite(
                        required
                    )
                ) {

                    state.setCreditRemaining(

                        Math.max(
                            0,
                            credits -
                            required
                        )

                    );

                }

            }


            console.info(
                "[GEN-Z.AI Vision] Credit balance synced:",
                credits
            );

        }
        else {

            console.warn(
                "[GEN-Z.AI Vision] Credit value tidak ditemukan pada hasil checkCredit():",
                result
            );


            if (
                typeof state.setCreditLoaded ===
                "function"
            ) {

                state.setCreditLoaded(
                    false
                );

            }

        }


        /*
         * -------------------------------------------------
         * REFRESH CREDIT DISPLAY
         * -------------------------------------------------
         *
         * refreshDisplay() dijalankan setelah
         * state sudah berisi saldo.
         */

        if (
            typeof credit.refreshDisplay ===
            "function"
        ) {

            credit.refreshDisplay();

        }


        return result;

    }
    catch (
        error
    ) {

        /*
         * -------------------------------------------------
         * CREDIT ERROR
         * -------------------------------------------------
         *
         * Error credit tidak boleh menghancurkan
         * seluruh halaman Vision.
         */

        console.warn(
            "[GEN-Z.AI Vision] Initial credit check gagal:",
            error
        );


        if (
            typeof state.setCreditLoaded ===
            "function"
        ) {

            state.setCreditLoaded(
                false
            );

        }


        if (
            typeof credit.refreshDisplay ===
            "function"
        ) {

            credit.refreshDisplay();

        }


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
         */

        initializeDOM();


        /*
         * -------------------------------------------------
         * SUPABASE
         * -------------------------------------------------
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
         */

        initializeEvents();


        /*
         * -------------------------------------------------
         * OPENKEY MODEL CATALOG
         * -------------------------------------------------
         *
         * Kegagalan katalog tidak mematikan
         * upload / preview / UI.
         */

        try {

            await initializeModelCatalog();

        }
        catch (
            catalogError
        ) {

            console.error(
                "[GEN-Z.AI Vision] OpenKey model catalog gagal:",
                catalogError
            );

        }


        /*
         * -------------------------------------------------
         * INITIAL CREDIT
         * -------------------------------------------------
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

    }
    catch (
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

        initialize,

        initializeModelCatalog

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

}
else {

    initialize();

}
