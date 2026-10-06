/* =========================================================
   GEN-Z.AI VISION VIDEO
   ---------------------------------------------------------
   File:
   vision-video/assets/js/vision-video-state.js

   Fungsi:
   - Single source of truth untuk Vision Video
   - Menyimpan video source
   - Menyimpan metadata video
   - Menyimpan analysis settings
   - Menyimpan frame information
   - Menyimpan analysis result
   - Menyimpan generated prompt
   - Menyimpan credit state
   - Menyimpan UI/progress state
   - Tidak bergantung pada Vision Image
========================================================= */


/* =========================================================
   DEFAULT STATE
========================================================= */

const VISION_VIDEO_DEFAULT_STATE = {

    /* =====================================================
       VIDEO
    ===================================================== */

    video: {

        file: null,

        objectUrl: null,

        name: "",

        size: 0,

        type: "",

        duration: 0,

        width: 0,

        height: 0,

        fps: null

    },


    /* =====================================================
       ANALYSIS SETTINGS
    ===================================================== */

    settings: {

        model: "",

        detail: "ultra",

        frameMode: "auto",

        purpose: "general",

        instruction: ""

    },


    /* =====================================================
       FRAME ANALYSIS
    ===================================================== */

    frames: {

        items: [],

        count: 0,

        analyzedCount: 0,

        samplingMode: "auto",

        interval: 0,

        ready: false

    },


    /* =====================================================
       ANALYSIS
    ===================================================== */

    analysis: {

        status: "idle",

        result: null,

        error: null,

        startedAt: null,

        completedAt: null

    },


    /* =====================================================
       GENERATED PROMPT
    ===================================================== */

    prompt: {

        text: "",

        ready: false

    },


    /* =====================================================
       CREDIT
       -----------------------------------------------------
       Credit untuk Vision Video.
       Tidak melakukan database operation di state.
       Database operation akan dilakukan oleh module
       workflow/API yang memang bertanggung jawab.
    ===================================================== */

    credit: {

        /* Saldo aktual user dari profiles.credits */

        balance: null,

        /* Credit yang diperlukan untuk satu analysis */

        required: 1,

        /* Apakah credit sudah berhasil di-charge */

        charged: false,

        /* Apakah proses charging sedang berjalan */

        charging: false,

        /* Apakah credit sedang diproses/refund */

        refunding: false,

        /* Apakah credit berhasil dikembalikan */

        refunded: false,

        /* Pesan error credit */

        error: null,

        /* Timestamp ketika credit berhasil di-charge */

        chargedAt: null,

        /* Timestamp ketika credit berhasil di-refund */

        refundedAt: null,

        /* Optional transaction/reference ID dari backend */

        transactionId: null,

        /* Optional history ID dari backend */

        historyId: null

    },


    /* =====================================================
       PROCESS
    ===================================================== */

    process: {

        running: false,

        progress: 0,

        stage: "idle",

        message: "",

        error: null

    },


    /* =====================================================
       UI
    ===================================================== */

    ui: {

        videoUploaded: false,

        previewReady: false,

        analyzing: false,

        resultReady: false,

        copyReady: false

    },


    /* =====================================================
       MODEL CATALOG
    ===================================================== */

    models: {

        items: [],

        loaded: false,

        loading: false,

        error: null

    }

};


/* =========================================================
   INTERNAL STATE
========================================================= */

let visionVideoState = cloneState(
    VISION_VIDEO_DEFAULT_STATE
);


/* =========================================================
   CLONE
========================================================= */

function cloneState(source) {

    return {

        video: {
            ...source.video
        },

        settings: {
            ...source.settings
        },

        frames: {
            ...source.frames,

            items: [
                ...(source.frames.items || [])
            ]

        },

        analysis: {
            ...source.analysis
        },

        prompt: {
            ...source.prompt
        },

        credit: {
            ...source.credit
        },

        process: {
            ...source.process
        },

        ui: {
            ...source.ui
        },

        models: {
            ...source.models,

            items: [
                ...(source.models.items || [])
            ]

        }

    };

}


/* =========================================================
   GET
========================================================= */

function getVisionVideoState() {

    return visionVideoState;

}


/* =========================================================
   GET PATH
========================================================= */

function getVisionVideoStateValue(path) {

    if (
        typeof path !== "string" ||
        !path.trim()
    ) {

        return undefined;

    }

    const parts =
        path.split(".");

    let current =
        visionVideoState;

    for (const part of parts) {

        if (
            current === null ||
            current === undefined
        ) {

            return undefined;

        }

        current =
            current[part];

    }

    return current;

}


/* =========================================================
   SET PATH
========================================================= */

function setVisionVideoStateValue(
    path,
    value
) {

    if (
        typeof path !== "string" ||
        !path.trim()
    ) {

        return false;

    }

    const parts =
        path.split(".");

    let current =
        visionVideoState;

    for (
        let index = 0;
        index < parts.length - 1;
        index++
    ) {

        const key =
            parts[index];

        if (
            !current[key] ||
            typeof current[key] !== "object"
        ) {

            current[key] = {};

        }

        current =
            current[key];

    }

    current[
        parts[parts.length - 1]
    ] = value;

    return true;

}


/* =========================================================
   UPDATE
========================================================= */

function updateVisionVideoState(
    updates = {}
) {

    if (
        !updates ||
        typeof updates !== "object"
    ) {

        return visionVideoState;

    }

    visionVideoState = {

        ...visionVideoState,

        ...updates

    };

    return visionVideoState;

}


/* =========================================================
   RESET VIDEO
========================================================= */

function resetVisionVideoVideoState() {

    if (
        visionVideoState.video.objectUrl
    ) {

        try {

            URL.revokeObjectURL(
                visionVideoState.video.objectUrl
            );

        } catch (_) {}

    }

    visionVideoState.video = {

        ...VISION_VIDEO_DEFAULT_STATE.video

    };

    visionVideoState.frames = {

        ...VISION_VIDEO_DEFAULT_STATE.frames,

        items: []

    };

    visionVideoState.analysis = {

        ...VISION_VIDEO_DEFAULT_STATE.analysis

    };

    visionVideoState.prompt = {

        ...VISION_VIDEO_DEFAULT_STATE.prompt

    };

    visionVideoState.credit = {

        ...VISION_VIDEO_DEFAULT_STATE.credit

    };

    visionVideoState.process = {

        ...VISION_VIDEO_DEFAULT_STATE.process

    };

    visionVideoState.ui = {

        ...VISION_VIDEO_DEFAULT_STATE.ui

    };

    return visionVideoState;

}


/* =========================================================
   RESET ALL
========================================================= */

function resetVisionVideoState() {

    if (
        visionVideoState.video.objectUrl
    ) {

        try {

            URL.revokeObjectURL(
                visionVideoState.video.objectUrl
            );

        } catch (_) {}

    }

    visionVideoState =
        cloneState(
            VISION_VIDEO_DEFAULT_STATE
        );

    return visionVideoState;

}


/* =========================================================
   SET VIDEO FILE
========================================================= */

function setVisionVideoFile(file) {

    if (!(file instanceof File)) {

        throw new TypeError(
            "Vision Video membutuhkan File object."
        );

    }

    if (
        visionVideoState.video.objectUrl
    ) {

        try {

            URL.revokeObjectURL(
                visionVideoState.video.objectUrl
            );

        } catch (_) {}

    }

    const objectUrl =
        URL.createObjectURL(file);

    visionVideoState.video = {

        ...visionVideoState.video,

        file,

        objectUrl,

        name:
            file.name || "",

        size:
            Number(file.size) || 0,

        type:
            file.type || ""

    };

    visionVideoState.ui.videoUploaded =
        true;

    visionVideoState.ui.previewReady =
        false;

    return visionVideoState.video;

}


/* =========================================================
   SET VIDEO METADATA
========================================================= */

function setVisionVideoMetadata(
    metadata = {}
) {

    visionVideoState.video = {

        ...visionVideoState.video,

        duration:
            Number(metadata.duration) || 0,

        width:
            Number(metadata.width) || 0,

        height:
            Number(metadata.height) || 0,

        fps:
            metadata.fps !== null &&
            metadata.fps !== undefined &&
            metadata.fps !== ""
                ? Number(metadata.fps)
                : null

    };

    visionVideoState.ui.previewReady =
        true;

    return visionVideoState.video;

}


/* =========================================================
   SET SETTINGS
========================================================= */

function setVisionVideoSettings(
    settings = {}
) {

    visionVideoState.settings = {

        ...visionVideoState.settings,

        ...settings

    };

    return visionVideoState.settings;

}


/* =========================================================
   SET FRAMES
========================================================= */

function setVisionVideoFrames(
    frames = []
) {

    const safeFrames =
        Array.isArray(frames)
            ? frames
            : [];

    visionVideoState.frames = {

        ...visionVideoState.frames,

        items:
            safeFrames,

        count:
            safeFrames.length,

        analyzedCount:
            0,

        ready:
            safeFrames.length > 0

    };

    return visionVideoState.frames;

}


/* =========================================================
   SET ANALYSIS RESULT
========================================================= */

function setVisionVideoAnalysisResult(
    result
) {

    visionVideoState.analysis = {

        ...visionVideoState.analysis,

        status:
            "completed",

        result,

        error:
            null,

        completedAt:
            new Date().toISOString()

    };

    visionVideoState.ui.resultReady =
        true;

    return visionVideoState.analysis;

}


/* =========================================================
   SET PROMPT
========================================================= */

function setVisionVideoPrompt(
    text
) {

    const promptText =
        typeof text === "string"
            ? text
            : "";

    visionVideoState.prompt = {

        text:
            promptText,

        ready:
            promptText.trim().length > 0

    };

    visionVideoState.ui.copyReady =
        promptText.trim().length > 0;

    return visionVideoState.prompt;

}


/* =========================================================
   CREDIT
   ---------------------------------------------------------
   State-only operations.
   Tidak ada query database di sini.
========================================================= */


/* =========================================================
   SET CREDIT BALANCE
========================================================= */

function setVisionVideoCreditBalance(
    balance
) {

    const numericBalance =
        Number(balance);

    visionVideoState.credit.balance =
        Number.isFinite(numericBalance)
            ? Math.max(0, numericBalance)
            : null;

    visionVideoState.credit.error =
        null;

    return visionVideoState.credit;

}


/* =========================================================
   SET REQUIRED CREDIT
========================================================= */

function setVisionVideoCreditRequired(
    required = 1
) {

    const numericRequired =
        Number(required);

    visionVideoState.credit.required =
        Number.isFinite(numericRequired) &&
        numericRequired > 0
            ? numericRequired
            : 1;

    return visionVideoState.credit;

}


/* =========================================================
   SET CREDIT CHARGING
========================================================= */

function setVisionVideoCreditCharging(
    charging = true
) {

    visionVideoState.credit.charging =
        Boolean(charging);

    if (charging) {

        visionVideoState.credit.error =
            null;

        visionVideoState.credit.refunded =
            false;

        visionVideoState.credit.refunding =
            false;

    }

    return visionVideoState.credit;

}


/* =========================================================
   SET CREDIT CHARGED
========================================================= */

function setVisionVideoCreditCharged(
    charged = true,
    metadata = {}
) {

    const isCharged =
        Boolean(charged);

    visionVideoState.credit.charged =
        isCharged;

    visionVideoState.credit.charging =
        false;

    if (isCharged) {

        visionVideoState.credit.refunded =
            false;

        visionVideoState.credit.refunding =
            false;

        visionVideoState.credit.error =
            null;

        visionVideoState.credit.chargedAt =
            new Date().toISOString();

        if (
            metadata &&
            typeof metadata === "object"
        ) {

            if (
                metadata.transactionId !== undefined
            ) {

                visionVideoState.credit.transactionId =
                    metadata.transactionId;

            }

            if (
                metadata.historyId !== undefined
            ) {

                visionVideoState.credit.historyId =
                    metadata.historyId;

            }

        }

    }

    return visionVideoState.credit;

}


/* =========================================================
   SET CREDIT REFUNDING
========================================================= */

function setVisionVideoCreditRefunding(
    refunding = true
) {

    visionVideoState.credit.refunding =
        Boolean(refunding);

    if (refunding) {

        visionVideoState.credit.error =
            null;

    }

    return visionVideoState.credit;

}


/* =========================================================
   SET CREDIT REFUNDED
========================================================= */

function setVisionVideoCreditRefunded(
    refunded = true
) {

    const isRefunded =
        Boolean(refunded);

    visionVideoState.credit.refunded =
        isRefunded;

    visionVideoState.credit.refunding =
        false;

    if (isRefunded) {

        visionVideoState.credit.refundedAt =
            new Date().toISOString();

        visionVideoState.credit.charged =
            false;

    }

    return visionVideoState.credit;

}


/* =========================================================
   SET CREDIT ERROR
========================================================= */

function setVisionVideoCreditError(
    error
) {

    const message =
        error instanceof Error
            ? error.message
            : String(
                error ||
                "Credit operation failed."
            );

    visionVideoState.credit.error =
        message;

    visionVideoState.credit.charging =
        false;

    visionVideoState.credit.refunding =
        false;

    return visionVideoState.credit;

}


/* =========================================================
   CLEAR CREDIT OPERATION
========================================================= */

function clearVisionVideoCreditOperation() {

    visionVideoState.credit.charged =
        false;

    visionVideoState.credit.charging =
        false;

    visionVideoState.credit.refunding =
        false;

    visionVideoState.credit.refunded =
        false;

    visionVideoState.credit.error =
        null;

    visionVideoState.credit.chargedAt =
        null;

    visionVideoState.credit.refundedAt =
        null;

    visionVideoState.credit.transactionId =
        null;

    visionVideoState.credit.historyId =
        null;

    return visionVideoState.credit;

}


/* =========================================================
   PROCESS STATE
========================================================= */

function setVisionVideoProcess(
    updates = {}
) {

    visionVideoState.process = {

        ...visionVideoState.process,

        ...updates

    };

    return visionVideoState.process;

}


/* =========================================================
   ANALYSIS START
========================================================= */

function startVisionVideoAnalysis() {

    visionVideoState.analysis = {

        ...visionVideoState.analysis,

        status:
            "running",

        result:
            null,

        error:
            null,

        startedAt:
            new Date().toISOString(),

        completedAt:
            null

    };

    visionVideoState.process = {

        ...visionVideoState.process,

        running:
            true,

        progress:
            0,

        stage:
            "initializing",

        message:
            "Preparing video analysis...",

        error:
            null

    };

    visionVideoState.ui.analyzing =
        true;

    visionVideoState.ui.resultReady =
        false;

    return visionVideoState;

}


/* =========================================================
   ANALYSIS ERROR
========================================================= */

function failVisionVideoAnalysis(
    error
) {

    const message =
        error instanceof Error
            ? error.message
            : String(
                error ||
                "Unknown error."
            );

    visionVideoState.analysis = {

        ...visionVideoState.analysis,

        status:
            "error",

        error:
            message,

        completedAt:
            new Date().toISOString()

    };

    visionVideoState.process = {

        ...visionVideoState.process,

        running:
            false,

        stage:
            "error",

        message,

        error:
            message

    };

    visionVideoState.ui.analyzing =
        false;

    return visionVideoState;

}


/* =========================================================
   COMPLETE ANALYSIS
========================================================= */

function completeVisionVideoAnalysis() {

    visionVideoState.analysis = {

        ...visionVideoState.analysis,

        status:
            "completed",

        completedAt:
            new Date().toISOString()

    };

    visionVideoState.process = {

        ...visionVideoState.process,

        running:
            false,

        progress:
            100,

        stage:
            "completed",

        message:
            "Video analysis completed.",

        error:
            null

    };

    visionVideoState.ui.analyzing =
        false;

    visionVideoState.ui.resultReady =
        true;

    return visionVideoState;

}


/* =========================================================
   MODEL STATE
========================================================= */

function setVisionVideoModels(
    models = []
) {

    const safeModels =
        Array.isArray(models)
            ? models
            : [];

    visionVideoState.models = {

        items:
            safeModels,

        loaded:
            true,

        loading:
            false,

        error:
            null

    };

    return visionVideoState.models;

}


/* =========================================================
   MODEL LOADING
========================================================= */

function setVisionVideoModelsLoading(
    loading = true
) {

    visionVideoState.models.loading =
        Boolean(loading);

    if (loading) {

        visionVideoState.models.error =
            null;

    }

    return visionVideoState.models;

}


/* =========================================================
   MODEL ERROR
========================================================= */

function setVisionVideoModelsError(
    error
) {

    const message =
        error instanceof Error
            ? error.message
            : String(
                error ||
                "Model loading failed."
            );

    visionVideoState.models = {

        ...visionVideoState.models,

        loading:
            false,

        loaded:
            false,

        error:
            message

    };

    return visionVideoState.models;

}


/* =========================================================
   PUBLIC API
========================================================= */

const GENZVisionVideoState = {

    /* -----------------------------------------------------
       Core state
    ----------------------------------------------------- */

    get:
        getVisionVideoState,

    getValue:
        getVisionVideoStateValue,

    set:
        setVisionVideoStateValue,

    update:
        updateVisionVideoState,

    reset:
        resetVisionVideoState,

    resetVideo:
        resetVisionVideoVideoState,


    /* -----------------------------------------------------
       Video
    ----------------------------------------------------- */

    setVideo:
        setVisionVideoFile,

    setMetadata:
        setVisionVideoMetadata,


    /* -----------------------------------------------------
       Settings
    ----------------------------------------------------- */

    setSettings:
        setVisionVideoSettings,


    /* -----------------------------------------------------
       Frames
    ----------------------------------------------------- */

    setFrames:
        setVisionVideoFrames,


    /* -----------------------------------------------------
       Analysis
    ----------------------------------------------------- */

    setAnalysis:
        setVisionVideoAnalysisResult,


    /* -----------------------------------------------------
       Prompt
    ----------------------------------------------------- */

    setPrompt:
        setVisionVideoPrompt,


    /* -----------------------------------------------------
       Credit
    ----------------------------------------------------- */

    setCreditBalance:
        setVisionVideoCreditBalance,

    setCreditRequired:
        setVisionVideoCreditRequired,

    setCreditCharging:
        setVisionVideoCreditCharging,

    setCreditCharged:
        setVisionVideoCreditCharged,

    setCreditRefunding:
        setVisionVideoCreditRefunding,

    setCreditRefunded:
        setVisionVideoCreditRefunded,

    setCreditError:
        setVisionVideoCreditError,

    clearCreditOperation:
        clearVisionVideoCreditOperation,


    /* -----------------------------------------------------
       Process
    ----------------------------------------------------- */

    setProcess:
        setVisionVideoProcess,

    startAnalysis:
        startVisionVideoAnalysis,

    failAnalysis:
        failVisionVideoAnalysis,

    completeAnalysis:
        completeVisionVideoAnalysis,


    /* -----------------------------------------------------
       Models
    ----------------------------------------------------- */

    setModels:
        setVisionVideoModels,

    setModelsLoading:
        setVisionVideoModelsLoading,

    setModelsError:
        setVisionVideoModelsError

};


/* =========================================================
   GLOBAL EXPORT
========================================================= */

window.GENZVisionVideoState =
    GENZVisionVideoState;


/* =========================================================
   READY FLAG
========================================================= */

window.GENZVisionVideoStateReady =
    true;


/* =========================================================
   DEBUG
========================================================= */

console.info(
    "[GEN-Z.AI Vision Video] State module ready."
);
