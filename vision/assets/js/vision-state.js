/* =========================================================
   GEN-Z.AI VISION
   ---------------------------------------------------------
   File:
   vision/assets/js/vision-state.js

   Fungsi:
   - Menyimpan seluruh state Vision
   - Menjadi single source of truth
   - Menyediakan getter / setter state
   - Tidak mengakses DOM
   - Tidak melakukan API request
   - Tidak melakukan Supabase query
   - Tidak melakukan upload
   - Tidak melakukan credit deduction
   - Tidak melakukan history

   Public:
   window.GENZVisionState
========================================================= */

const DEFAULT_STATE = {

    /* =====================================================
       AUTH
    ===================================================== */

    auth: {

        initialized: false,

        authenticated: false,

        userId: null,

        email: "",

        profile: null,

        credits: 0

    },


    /* =====================================================
       FILE
    ===================================================== */

    file: {

        original: null,

        name: "",

        size: 0,

        type: "",

        dataUrl: "",

        mimeType: "",

        width: 0,

        height: 0

    },


    /* =====================================================
       MODEL
    ===================================================== */

    model: {

        id: "gemini-3.1-pro",

        name: "Gemini 3.1 Pro",

        providerId: "openkey",

        providerName: "OpenKey"

    },


    /* =====================================================
       SETTINGS
    ===================================================== */

    settings: {

        detail: "ultra",

        purpose: "image-generation",

        instruction: ""

    },


    /* =====================================================
       ANALYSIS
    ===================================================== */

    analysis: {

        raw: null,

        normalized: null,

        text: "",

        completed: false

    },


    /* =====================================================
       PROMPT
    ===================================================== */

    prompt: {

        text: "",

        completed: false,

        copied: false

    },


    /* =====================================================
       PROCESS
    ===================================================== */

    process: {

        status: "idle",

        stage: "",

        progress: 0,

        taskId: null,

        startedAt: null,

        completedAt: null,

        error: null

    },


    /* =====================================================
       CREDIT
    ===================================================== */

    credit: {

        cost: 1,

        checked: false,

        reserved: false,

        deducted: false,

        refunded: false

    },


    /* =====================================================
       HISTORY
    ===================================================== */

    history: {

        saved: false,

        historyId: null

    },


    /* =====================================================
       UI
    ===================================================== */

    ui: {

        uploadDragging: false,

        processing: false,

        copyAvailable: false,

        showAnalysis: false

    }

};


/* =========================================================
   STATE CLONE
========================================================= */

function cloneState(value) {

    if (
        value === null ||
        typeof value !== "object"
    ) {

        return value;

    }


    if (
        typeof structuredClone === "function"
    ) {

        return structuredClone(value);

    }


    return JSON.parse(
        JSON.stringify(value)
    );

}


/* =========================================================
   INTERNAL STATE
========================================================= */

let state =
    cloneState(DEFAULT_STATE);


/* =========================================================
   RESET
========================================================= */

function resetState() {

    state =
        cloneState(DEFAULT_STATE);

    notify();

}


/* =========================================================
   GET WHOLE STATE
========================================================= */

function getState() {

    return state;

}


/* =========================================================
   GET CLONED STATE
========================================================= */

function getStateSnapshot() {

    return cloneState(state);

}


/* =========================================================
   GET PATH
========================================================= */

function get(path, fallback = null) {

    if (
        typeof path !== "string" ||
        !path.trim()
    ) {

        return fallback;

    }


    const parts =
        path.split(".").filter(Boolean);


    let current =
        state;


    for (
        const part of parts
    ) {

        if (
            current === null ||
            current === undefined ||
            !Object.prototype.hasOwnProperty.call(
                current,
                part
            )
        ) {

            return fallback;

        }


        current =
            current[part];

    }


    return current;

}


/* =========================================================
   SET PATH
========================================================= */

function set(
    path,
    value,
    options = {}
) {

    if (
        typeof path !== "string" ||
        !path.trim()
    ) {

        return false;

    }


    const parts =
        path.split(".").filter(Boolean);


    if (
        parts.length === 0
    ) {

        return false;

    }


    let current =
        state;


    for (
        let index = 0;
        index < parts.length - 1;
        index += 1
    ) {

        const part =
            parts[index];


        if (
            !current[part] ||
            typeof current[part] !== "object"
        ) {

            current[part] = {};

        }


        current =
            current[part];

    }


    const finalKey =
        parts[parts.length - 1];


    current[finalKey] =
        value;


    if (
        options.notify !== false
    ) {

        notify();

    }


    return true;

}


/* =========================================================
   MERGE OBJECT
========================================================= */

function merge(
    path,
    value,
    options = {}
) {

    if (
        !value ||
        typeof value !== "object" ||
        Array.isArray(value)
    ) {

        return false;

    }


    const current =
        get(path);


    if (
        !current ||
        typeof current !== "object" ||
        Array.isArray(current)
    ) {

        return set(
            path,
            cloneState(value),
            options
        );

    }


    Object.assign(
        current,
        value
    );


    if (
        options.notify !== false
    ) {

        notify();

    }


    return true;

}


/* =========================================================
   AUTH STATE
========================================================= */

function setAuth(auth = {}) {

    state.auth = {

        ...state.auth,

        ...auth

    };


    notify();

}


function setAuthenticated(
    authenticated,
    user = null
) {

    state.auth.authenticated =
        Boolean(authenticated);


    if (user) {

        state.auth.userId =
            user.id ||
            null;

        state.auth.email =
            user.email ||
            "";

    }


    state.auth.initialized =
        true;


    notify();

}


/* =========================================================
   PROFILE
========================================================= */

function setProfile(profile) {

    state.auth.profile =
        profile || null;


    if (
        profile &&
        profile.credits !== undefined
    ) {

        state.auth.credits =
            normalizeCredits(
                profile.credits
            );

    }


    notify();

}


/* =========================================================
   CREDITS
========================================================= */

function normalizeCredits(value) {

    const number =
        Number(value);


    if (
        !Number.isFinite(number) ||
        number < 0
    ) {

        return 0;

    }


    return number;

}


function setCredits(value) {

    state.auth.credits =
        normalizeCredits(value);


    notify();

}


function getCredits() {

    return normalizeCredits(
        state.auth.credits
    );

}


function hasEnoughCredits(
    amount = 1
) {

    const cost =
        Number(amount);


    if (
        !Number.isFinite(cost) ||
        cost <= 0
    ) {

        return false;

    }


    return getCredits() >= cost;

}


/* =========================================================
   FILE STATE
========================================================= */

function setFile(fileData = {}) {

    state.file = {

        ...state.file,

        ...fileData

    };


    notify();

}


function clearFile() {

    state.file =
        cloneState(
            DEFAULT_STATE.file
        );


    notify();

}


function hasFile() {

    return Boolean(
        state.file.original ||
        state.file.dataUrl
    );

}


/* =========================================================
   MODEL STATE
========================================================= */

function setModel(model = {}) {

    state.model = {

        ...state.model,

        ...model

    };


    notify();

}


/* =========================================================
   SETTINGS
========================================================= */

function setSettings(settings = {}) {

    state.settings = {

        ...state.settings,

        ...settings

    };


    notify();

}


/* =========================================================
   ANALYSIS
========================================================= */

function setAnalysis(
    analysis,
    options = {}
) {

    state.analysis.raw =
        analysis;


    state.analysis.normalized =
        options.normalized !== undefined
            ? options.normalized
            : analysis;


    state.analysis.text =
        options.text !== undefined
            ? String(options.text || "")
            : state.analysis.text;


    state.analysis.completed =
        options.completed !== undefined
            ? Boolean(options.completed)
            : true;


    notify();

}


function clearAnalysis() {

    state.analysis =
        cloneState(
            DEFAULT_STATE.analysis
        );


    notify();

}


/* =========================================================
   PROMPT
========================================================= */

function setPrompt(
    prompt,
    options = {}
) {

    state.prompt.text =
        String(prompt || "");


    state.prompt.completed =
        options.completed !== undefined
            ? Boolean(options.completed)
            : Boolean(
                state.prompt.text
            );


    state.prompt.copied =
        false;


    notify();

}


function clearPrompt() {

    state.prompt =
        cloneState(
            DEFAULT_STATE.prompt
        );


    notify();

}


function markPromptCopied(
    copied = true
) {

    state.prompt.copied =
        Boolean(copied);


    notify();

}


/* =========================================================
   PROCESS
========================================================= */

const PROCESS_STAGES = Object.freeze({

    IDLE:
        "idle",

    VALIDATING:
        "validating",

    CHECKING_CREDIT:
        "checking-credit",

    RESERVING_CREDIT:
        "reserving-credit",

    ANALYZING:
        "analyzing",

    ENGINEERING:
        "engineering",

    SAVING_HISTORY:
        "saving-history",

    COMPLETED:
        "completed",

    REFUNDING:
        "refunding",

    ERROR:
        "error"

});


function setProcess(
    process = {},
    options = {}
) {

    state.process = {

        ...state.process,

        ...process

    };


    if (
        options.notify !== false
    ) {

        notify();

    }

}


function setProcessStatus(
    status,
    stage = "",
    progress = null
) {

    state.process.status =
        String(status || "idle");


    state.process.stage =
        String(stage || "");


    if (
        progress !== null &&
        Number.isFinite(
            Number(progress)
        )
    ) {

        state.process.progress =
            Math.max(
                0,
                Math.min(
                    100,
                    Number(progress)
                )
            );

    }


    notify();

}


function setProcessing(
    processing
) {

    state.ui.processing =
        Boolean(processing);


    notify();

}


/* =========================================================
   PROCESS ERROR
========================================================= */

function setProcessError(error) {

    state.process.error =
        normalizeError(error);


    state.process.status =
        PROCESS_STAGES.ERROR;


    notify();

}


function clearProcessError() {

    state.process.error =
        null;


    notify();

}


/* =========================================================
   CREDIT TRANSACTION STATE
========================================================= */

function markCreditChecked(
    checked = true
) {

    state.credit.checked =
        Boolean(checked);


    notify();

}


function markCreditReserved(
    reserved = true
) {

    state.credit.reserved =
        Boolean(reserved);


    notify();

}


function markCreditDeducted(
    deducted = true
) {

    state.credit.deducted =
        Boolean(deducted);


    notify();

}


function markCreditRefunded(
    refunded = true
) {

    state.credit.refunded =
        Boolean(refunded);


    notify();

}


/* =========================================================
   HISTORY STATE
========================================================= */

function markHistorySaved(
    historyId = null
) {

    state.history.saved =
        true;

    state.history.historyId =
        historyId || null;


    notify();

}


/* =========================================================
   TASK
========================================================= */

function setTaskId(taskId) {

    state.process.taskId =
        taskId || null;


    notify();

}


/* =========================================================
   PROGRESS
========================================================= */

function setProgress(
    progress,
    stage = null
) {

    const numeric =
        Number(progress);


    if (
        Number.isFinite(numeric)
    ) {

        state.process.progress =
            Math.max(
                0,
                Math.min(
                    100,
                    numeric
                )
            );

    }


    if (
        stage !== null
    ) {

        state.process.stage =
            String(stage || "");

    }


    notify();

}


/* =========================================================
   UI STATE
========================================================= */

function setUI(
    ui = {},
    options = {}
) {

    state.ui = {

        ...state.ui,

        ...ui

    };


    if (
        options.notify !== false
    ) {

        notify();

    }

}


/* =========================================================
   VALIDATION HELPERS
========================================================= */

function isValidImageFile(file) {

    if (!file) {

        return false;

    }


    if (
        typeof file.type === "string" &&
        file.type.startsWith("image/")
    ) {

        return true;

    }


    const name =
        String(
            file.name || ""
        ).toLowerCase();


    return /\.(jpg|jpeg|png|webp|gif|bmp)$/i
        .test(name);

}


/* =========================================================
   ERROR NORMALIZER
========================================================= */

function normalizeError(error) {

    if (!error) {

        return {

            message:
                "Terjadi kesalahan yang tidak diketahui."

        };

    }


    if (
        typeof error === "string"
    ) {

        return {

            message:
                error

        };

    }


    if (
        error instanceof Error
    ) {

        return {

            name:
                error.name || "Error",

            message:
                error.message ||
                "Terjadi kesalahan.",

            stack:
                error.stack || ""

        };

    }


    if (
        typeof error === "object"
    ) {

        return {

            name:
                error.name ||
                "",

            message:
                error.message ||
                error.error ||
                error.detail ||
                "Terjadi kesalahan.",

            code:
                error.code ||
                null,

            status:
                error.status ||
                error.statusCode ||
                null

        };

    }


    return {

        message:
            String(error)

    };

}


/* =========================================================
   STATE SUBSCRIBERS
========================================================= */

const subscribers =
    new Set();


function subscribe(
    callback
) {

    if (
        typeof callback !== "function"
    ) {

        return () => {};

    }


    subscribers.add(
        callback
    );


    return () => {

        subscribers.delete(
            callback
        );

    };

}


/* =========================================================
   NOTIFY
========================================================= */

function notify() {

    for (
        const callback
        of subscribers
    ) {

        try {

            callback(
                state
            );

        } catch (error) {

            console.error(
                "[GENZ Vision] State subscriber error:",
                error
            );

        }

    }

}


/* =========================================================
   DEBUG
========================================================= */

function getDebugState() {

    return {

        authenticated:
            state.auth.authenticated,

        userId:
            state.auth.userId,

        credits:
            state.auth.credits,

        file:
            Boolean(state.file.original),

        fileName:
            state.file.name,

        model:
            state.model.id,

        detail:
            state.settings.detail,

        purpose:
            state.settings.purpose,

        process:
            state.process.status,

        progress:
            state.process.progress,

        creditChecked:
            state.credit.checked,

        creditDeducted:
            state.credit.deducted,

        creditRefunded:
            state.credit.refunded,

        historySaved:
            state.history.saved,

        promptReady:
            state.prompt.completed

    };

}


/* =========================================================
   PUBLIC API
========================================================= */

const GENZVisionState = Object.freeze({

    getState,

    getStateSnapshot,

    get,

    set,

    merge,

    resetState,

    subscribe,

    setAuth,

    setAuthenticated,

    setProfile,

    setCredits,

    getCredits,

    hasEnoughCredits,

    setFile,

    clearFile,

    hasFile,

    setModel,

    setSettings,

    setAnalysis,

    clearAnalysis,

    setPrompt,

    clearPrompt,

    markPromptCopied,

    setProcess,

    setProcessStatus,

    setProcessing,

    setProcessError,

    clearProcessError,

    markCreditChecked,

    markCreditReserved,

    markCreditDeducted,

    markCreditRefunded,

    markHistorySaved,

    setTaskId,

    setProgress,

    setUI,

    isValidImageFile,

    normalizeError,

    getDebugState,

    PROCESS_STAGES

});


/* =========================================================
   GLOBAL EXPORT
========================================================= */

window.GENZVisionState =
    GENZVisionState;
