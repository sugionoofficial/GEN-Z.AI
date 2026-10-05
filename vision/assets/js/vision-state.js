/* =========================================================
   GEN-Z.AI VISION
   ---------------------------------------------------------
   File:
   vision/assets/js/vision-state.js

   Fungsi:
   - Single source of truth Vision
   - Menyimpan reference image
   - Menyimpan replacement character image
   - Menyimpan model
   - Menyimpan settings
   - Menyimpan analysis
   - Menyimpan generated prompt
   - Menyimpan process state
   - Menyimpan credit state
   - Menyimpan history state
   - Menyimpan UI state
   - Menyediakan compatibility API get() / set()

   Tidak menangani:
   - DOM
   - API
   - Upload
   - Analysis
   - Prompt generation
   - Credit transaction
   - History persistence
========================================================= */


/* =========================================================
   DEFAULT STATE
========================================================= */

const DEFAULT_STATE = {

    /* =====================================================
       AUTH
    ===================================================== */

    auth: {

        user:
            null,

        profile:
            null,

        initialized:
            false

    },


    /* =====================================================
       REFERENCE IMAGE
       -----------------------------------------------------
       File utama yang akan dibedah / dianalisis.

       Property "file" dipertahankan untuk kompatibilitas
       dengan modul Vision yang sudah ada.
    ===================================================== */

    file:
        null,


    /* =====================================================
       REPLACEMENT CHARACTER
       -----------------------------------------------------
       Image karakter pengganti.

       Tidak menggantikan "file".
       Kedua image memiliki lifecycle terpisah.
    ===================================================== */

    replacementCharacter:
        null,


    /* =====================================================
       MODEL
    ===================================================== */

    model: {

        id:
            "",

        name:
            "",

        providerId:
            "openkey",

        providerName:
            "OpenKey",

        inputModalities:
            [],

        outputModalities:
            [],

        capabilities:
            null

    },


    /* =====================================================
       SETTINGS
    ===================================================== */

    settings: {

        detail:
            "balanced",

        purpose:
            "general",

        instruction:
            ""

    },


    /* =====================================================
       ANALYSIS
    ===================================================== */

    analysis: {

        status:
            "idle",

        result:
            null,

        raw:
            null,

        error:
            null

    },


    /* =====================================================
       PROMPT
    ===================================================== */

    prompt: {

        status:
            "idle",

        value:
            "",

        error:
            null

    },


    /* =====================================================
       PROCESS
    ===================================================== */

    process: {

        status:
            "idle",

        stage:
            "",

        progress:
            0,

        error:
            null

    },


    /* =====================================================
       CREDIT
    ===================================================== */

    credit: {

        available:
            0,

        reserved:
            false,

        charged:
            false,

        refunded:
            false

    },


    /* =====================================================
       HISTORY
    ===================================================== */

    history: {

        items:
            [],

        loading:
            false,

        error:
            null

    },


    /* =====================================================
       UI
    ===================================================== */

    ui: {

        initialized:
            false,

        loading:
            false

    }

};


/* =========================================================
   STATE CLONE
========================================================= */

function cloneDefaultState() {

    return {

        auth: {

            user:
                DEFAULT_STATE.auth.user,

            profile:
                DEFAULT_STATE.auth.profile,

            initialized:
                DEFAULT_STATE.auth.initialized

        },


        file:
            DEFAULT_STATE.file,


        replacementCharacter:
            DEFAULT_STATE.replacementCharacter,


        model: {

            id:
                DEFAULT_STATE.model.id,

            name:
                DEFAULT_STATE.model.name,

            providerId:
                DEFAULT_STATE.model.providerId,

            providerName:
                DEFAULT_STATE.model.providerName,

            inputModalities:
                [],

            outputModalities:
                [],

            capabilities:
                DEFAULT_STATE.model.capabilities

        },


        settings: {

            detail:
                DEFAULT_STATE.settings.detail,

            purpose:
                DEFAULT_STATE.settings.purpose,

            instruction:
                DEFAULT_STATE.settings.instruction

        },


        analysis: {

            status:
                DEFAULT_STATE.analysis.status,

            result:
                DEFAULT_STATE.analysis.result,

            raw:
                DEFAULT_STATE.analysis.raw,

            error:
                DEFAULT_STATE.analysis.error

        },


        prompt: {

            status:
                DEFAULT_STATE.prompt.status,

            value:
                DEFAULT_STATE.prompt.value,

            error:
                DEFAULT_STATE.prompt.error

        },


        process: {

            status:
                DEFAULT_STATE.process.status,

            stage:
                DEFAULT_STATE.process.stage,

            progress:
                DEFAULT_STATE.process.progress,

            error:
                DEFAULT_STATE.process.error

        },


        credit: {

            available:
                DEFAULT_STATE.credit.available,

            reserved:
                DEFAULT_STATE.credit.reserved,

            charged:
                DEFAULT_STATE.credit.charged,

            refunded:
                DEFAULT_STATE.credit.refunded

        },


        history: {

            items:
                [],

            loading:
                DEFAULT_STATE.history.loading,

            error:
                DEFAULT_STATE.history.error

        },


        ui: {

            initialized:
                DEFAULT_STATE.ui.initialized,

            loading:
                DEFAULT_STATE.ui.loading

        }

    };

}


/* =========================================================
   INTERNAL STATE
========================================================= */

let STATE =
    cloneDefaultState();


/* =========================================================
   INITIALIZE
   ---------------------------------------------------------
   Dipanggil oleh vision-loader.js.

   State hanya perlu memastikan internal state tersedia.
   Tidak melakukan API / DOM / network operation.
========================================================= */

function initialize() {

    if (
        !STATE ||
        typeof STATE !== "object"
    ) {

        STATE =
            cloneDefaultState();

    }


    return true;

}


/* =========================================================
   GET STATE
   ---------------------------------------------------------
   API utama.

   Contoh:
   getState()
   getState("model.id")
   getState("auth.profile")
========================================================= */

function getState(
    path,
    fallback = undefined
) {

    if (
        !path
    ) {

        return STATE;

    }


    const parts =
        String(path)
            .split(".")
            .filter(Boolean);


    let current =
        STATE;


    for (
        const part
        of parts
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
   SET STATE
   ---------------------------------------------------------
   API utama.

   Contoh:
   setState("model.id", "grok-4.6")
========================================================= */

function setState(
    path,
    value
) {

    if (
        !path
    ) {

        return false;

    }


    const parts =
        String(path)
            .split(".")
            .filter(Boolean);


    if (
        parts.length === 0
    ) {

        return false;

    }


    let current =
        STATE;


    for (
        let index = 0;
        index < parts.length - 1;
        index++
    ) {

        const part =
            parts[index];


        if (
            !current[part] ||
            typeof current[part] !== "object"
        ) {

            current[part] =
                {};

        }


        current =
            current[part];

    }


    current[
        parts[parts.length - 1]
    ] =
        value;


    return true;

}


/* =========================================================
   COMPATIBILITY GET
   ---------------------------------------------------------
   Compatibility layer untuk modul Vision lama.

   Modul lama menggunakan:

       state.get("model.id")

   Sedangkan API utama menggunakan:

       state.getState("model.id")

   Keduanya sekarang diarahkan ke sumber state yang sama.
========================================================= */

function get(
    path,
    fallback = undefined
) {

    return getState(
        path,
        fallback
    );

}


/* =========================================================
   COMPATIBILITY SET
   ---------------------------------------------------------
   Compatibility layer untuk modul Vision lama.

   Modul lama menggunakan:

       state.set(
           "auth.credits",
           10
       )

   Sedangkan API utama menggunakan:

       state.setState(
           "auth.credits",
           10
       )
========================================================= */

function set(
    path,
    value
) {

    return setState(
        path,
        value
    );

}


/* =========================================================
   RESET STATE
========================================================= */

function resetState() {

    STATE =
        cloneDefaultState();


    return STATE;

}


/* =========================================================
   AUTH
========================================================= */

function setAuth(
    auth = {}
) {

    if (
        Object.prototype.hasOwnProperty.call(
            auth,
            "user"
        )
    ) {

        STATE.auth.user =
            auth.user;

    }


    if (
        Object.prototype.hasOwnProperty.call(
            auth,
            "profile"
        )
    ) {

        STATE.auth.profile =
            auth.profile;

    }


    if (
        Object.prototype.hasOwnProperty.call(
            auth,
            "initialized"
        )
    ) {

        STATE.auth.initialized =
            Boolean(
                auth.initialized
            );

    }


    return STATE.auth;

}


/* =========================================================
   MODEL
========================================================= */

function setModel(
    model = {}
) {

    STATE.model = {

        id:
            model.id ||
            "",

        name:
            model.name ||
            "",

        providerId:
            model.providerId ||
            "openkey",

        providerName:
            model.providerName ||
            "OpenKey",

        inputModalities:
            Array.isArray(
                model.inputModalities
            )
                ? model.inputModalities
                : [],

        outputModalities:
            Array.isArray(
                model.outputModalities
            )
                ? model.outputModalities
                : [],

        capabilities:
            model.capabilities ??
            null

    };


    return STATE.model;

}


function getModel() {

    return STATE.model;

}


/* =========================================================
   REFERENCE IMAGE
========================================================= */

function setFile(
    file
) {

    STATE.file =
        file ||
        null;


    return STATE.file;

}


function getFile() {

    return STATE.file;

}


function clearFile() {

    STATE.file =
        null;


    return true;

}


function hasFile() {

    return Boolean(
        STATE.file
    );

}


/* =========================================================
   REPLACEMENT CHARACTER
========================================================= */

function setReplacementCharacter(
    file
) {

    STATE.replacementCharacter =
        file ||
        null;


    return STATE.replacementCharacter;

}


function getReplacementCharacter() {

    return STATE.replacementCharacter;

}


function clearReplacementCharacter() {

    STATE.replacementCharacter =
        null;


    return true;

}


function hasReplacementCharacter() {

    return Boolean(
        STATE.replacementCharacter
    );

}


/* =========================================================
   IMAGE HELPERS
========================================================= */

function getReferenceImage() {

    return STATE.file;

}


function getCharacterImage() {

    return STATE.replacementCharacter;

}


function hasReferenceImage() {

    return Boolean(
        STATE.file
    );

}


function hasCharacterImage() {

    return Boolean(
        STATE.replacementCharacter
    );

}


function clearImages() {

    STATE.file =
        null;

    STATE.replacementCharacter =
        null;


    return true;

}


/* =========================================================
   SETTINGS
========================================================= */

function setSettings(
    settings = {}
) {

    if (
        Object.prototype.hasOwnProperty.call(
            settings,
            "detail"
        )
    ) {

        STATE.settings.detail =
            settings.detail;

    }


    if (
        Object.prototype.hasOwnProperty.call(
            settings,
            "purpose"
        )
    ) {

        STATE.settings.purpose =
            settings.purpose;

    }


    if (
        Object.prototype.hasOwnProperty.call(
            settings,
            "instruction"
        )
    ) {

        STATE.settings.instruction =
            settings.instruction;

    }


    return STATE.settings;

}


function getSettings() {

    return STATE.settings;

}


/* =========================================================
   ANALYSIS
========================================================= */

function setAnalysis(
    analysis = {}
) {

    STATE.analysis = {

        ...STATE.analysis,

        ...analysis

    };


    return STATE.analysis;

}


function getAnalysis() {

    return STATE.analysis;

}


function clearAnalysis() {

    STATE.analysis = {

        status:
            "idle",

        result:
            null,

        raw:
            null,

        error:
            null

    };


    return true;

}


/* =========================================================
   PROMPT
========================================================= */

function setPrompt(
    prompt = {}
) {

    STATE.prompt = {

        ...STATE.prompt,

        ...prompt

    };


    return STATE.prompt;

}


function getPrompt() {

    return STATE.prompt;

}


function setPromptValue(
    value
) {

    STATE.prompt.value =
        value === null ||
        value === undefined
            ? ""
            : String(value);


    return STATE.prompt.value;

}


function clearPrompt() {

    STATE.prompt = {

        status:
            "idle",

        value:
            "",

        error:
            null

    };


    return true;

}


/* =========================================================
   PROCESS
========================================================= */

function setProcess(
    process = {}
) {

    STATE.process = {

        ...STATE.process,

        ...process

    };


    return STATE.process;

}


function getProcess() {

    return STATE.process;

}


function setProcessStatus(
    status,
    stage = "",
    progress = 0,
    error = null
) {

    STATE.process = {

        status:
            status ||
            "idle",

        stage:
            stage ||
            "",

        progress:
            Number.isFinite(
                Number(progress)
            )
                ? Number(progress)
                : 0,

        error:
            error

    };


    return STATE.process;

}


function setProcessError(
    error
) {

    STATE.process.status =
        "error";

    STATE.process.error =
        error ||
        null;


    return STATE.process;

}


/* =========================================================
   CREDIT
========================================================= */

function setCredit(
    credit = {}
) {

    STATE.credit = {

        ...STATE.credit,

        ...credit

    };


    return STATE.credit;

}


function getCredit() {

    return STATE.credit;

}


/* =========================================================
   HISTORY
========================================================= */

function setHistory(
    history = {}
) {

    STATE.history = {

        ...STATE.history,

        ...history

    };


    return STATE.history;

}


function getHistory() {

    return STATE.history;

}


/* =========================================================
   UI
========================================================= */

function setUI(
    ui = {}
) {

    STATE.ui = {

        ...STATE.ui,

        ...ui

    };


    return STATE.ui;

}


function getUI() {

    return STATE.ui;

}


/* =========================================================
   CHECK
========================================================= */

function isReadyForAnalysis() {

    return Boolean(
        hasReferenceImage() &&
        STATE.model.id
    );

}


function isReadyForCharacterReplacement() {

    return Boolean(
        hasReferenceImage() &&
        hasCharacterImage()
    );

}


/* =========================================================
   SNAPSHOT
========================================================= */

function getSnapshot() {

    return {

        ...STATE,

        auth: {

            ...STATE.auth

        },

        model: {

            ...STATE.model,

            inputModalities:
                [
                    ...STATE.model.inputModalities
                ],

            outputModalities:
                [
                    ...STATE.model.outputModalities
                ]

        },

        settings: {

            ...STATE.settings

        },

        analysis: {

            ...STATE.analysis

        },

        prompt: {

            ...STATE.prompt

        },

        process: {

            ...STATE.process

        },

        credit: {

            ...STATE.credit

        },

        history: {

            ...STATE.history,

            items:
                [
                    ...STATE.history.items
                ]

        },

        ui: {

            ...STATE.ui

        }

    };

}


/* =========================================================
   DEBUG
========================================================= */

function getDebugInfo() {

    return {

        hasReferenceImage:
            hasReferenceImage(),

        hasReplacementCharacter:
            hasCharacterImage(),

        model:
            STATE.model.id,

        analysisStatus:
            STATE.analysis.status,

        promptStatus:
            STATE.prompt.status,

        processStatus:
            STATE.process.status,

        processProgress:
            STATE.process.progress,

        creditAvailable:
            STATE.credit.available

    };

}


/* =========================================================
   PUBLIC API
========================================================= */

const GENZVisionState =
    Object.freeze({

        /* -------------------------------------------------
           CORE
        ------------------------------------------------- */

        DEFAULT_STATE,

        initialize,

        getState,

        setState,

        /* -------------------------------------------------
           COMPATIBILITY API
           -----------------------------------------------
           Dipertahankan karena modul Vision existing
           masih menggunakan state.get() / state.set().
        ------------------------------------------------- */

        get,

        set,

        resetState,

        getSnapshot,

        getDebugInfo,


        /* -------------------------------------------------
           AUTH
        ------------------------------------------------- */

        setAuth,


        /* -------------------------------------------------
           MODEL
        ------------------------------------------------- */

        setModel,

        getModel,


        /* -------------------------------------------------
           REFERENCE IMAGE
        ------------------------------------------------- */

        setFile,

        getFile,

        clearFile,

        hasFile,


        /* -------------------------------------------------
           REPLACEMENT CHARACTER
        ------------------------------------------------- */

        setReplacementCharacter,

        getReplacementCharacter,

        clearReplacementCharacter,

        hasReplacementCharacter,


        /* -------------------------------------------------
           IMAGE HELPERS
        ------------------------------------------------- */

        getReferenceImage,

        getCharacterImage,

        hasReferenceImage,

        hasCharacterImage,

        clearImages,


        /* -------------------------------------------------
           SETTINGS
        ------------------------------------------------- */

        setSettings,

        getSettings,


        /* -------------------------------------------------
           ANALYSIS
        ------------------------------------------------- */

        setAnalysis,

        getAnalysis,

        clearAnalysis,


        /* -------------------------------------------------
           PROMPT
        ------------------------------------------------- */

        setPrompt,

        getPrompt,

        setPromptValue,

        clearPrompt,


        /* -------------------------------------------------
           PROCESS
        ------------------------------------------------- */

        setProcess,

        getProcess,

        setProcessStatus,

        setProcessError,


        /* -------------------------------------------------
           CREDIT
        ------------------------------------------------- */

        setCredit,

        getCredit,


        /* -------------------------------------------------
           HISTORY
        ------------------------------------------------- */

        setHistory,

        getHistory,


        /* -------------------------------------------------
           UI
        ------------------------------------------------- */

        setUI,

        getUI,


        /* -------------------------------------------------
           CHECK
        ------------------------------------------------- */

        isReadyForAnalysis,

        isReadyForCharacterReplacement

    });


/* =========================================================
   GLOBAL EXPORT
========================================================= */

window.GENZVisionState =
    GENZVisionState;
