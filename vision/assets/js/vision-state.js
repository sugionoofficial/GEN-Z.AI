/* =========================================================
   GEN-Z.AI
   VISION STATE
   ---------------------------------------------------------
   File:
   vision/assets/js/vision-state.js

   Fungsi:
   - Global state management
   - Auth state
   - Reference image state
   - Replacement character state
   - Model state
   - Settings state
   - Analysis state
   - Prompt state
   - Process state
   - Credit state
   - History state
   - UI state
   - Legacy compatibility:
       get()
       set()
       merge()
       setProcessing()
       setProcessingState()
       isProcessing()
       setProgress()
       getProgress()

   Catatan:
   - Tetap menggunakan global window.GENZVisionState
   - BUKAN ES MODULE
========================================================= */

(function () {

    "use strict";


    /* =====================================================
       DEFAULT STATE
    ===================================================== */

    const DEFAULT_STATE = {

        /* ---------------------------------------------
           AUTH
        --------------------------------------------- */

        auth: {
            user: null,
            profile: null,
            initialized: false
        },


        /* ---------------------------------------------
           REFERENCE IMAGE
        --------------------------------------------- */

        file: null,


        /* ---------------------------------------------
           REPLACEMENT CHARACTER IMAGE
        --------------------------------------------- */

        replacementCharacter: null,


        /* ---------------------------------------------
           MODEL
        --------------------------------------------- */

        model: {

            id: "",

            name: "",

            providerId: "openkey",

            providerName: "OpenKey",

            inputModalities: [],

            outputModalities: [],

            capabilities: null

        },


        /* ---------------------------------------------
           SETTINGS
        --------------------------------------------- */

        settings: {

            detail: "balanced",

            purpose: "general",

            instruction: ""

        },


        /* ---------------------------------------------
           ANALYSIS
        --------------------------------------------- */

        analysis: {

            status: "idle",

            result: null,

            raw: null,

            error: null

        },


        /* ---------------------------------------------
           PROMPT
        --------------------------------------------- */

        prompt: {

            status: "idle",

            value: "",

            error: null

        },


        /* ---------------------------------------------
           PROCESS
        --------------------------------------------- */

        process: {

            status: "idle",

            stage: "",

            progress: 0,

            error: null

        },


        /* ---------------------------------------------
           CREDIT
        --------------------------------------------- */

        credit: {

            available: 0,

            reserved: false,

            charged: false,

            refunded: false

        },


        /* ---------------------------------------------
           HISTORY
        --------------------------------------------- */

        history: {

            items: [],

            loading: false,

            error: null

        },


        /* ---------------------------------------------
           UI
        --------------------------------------------- */

        ui: {

            initialized: false,

            loading: false

        }

    };


    /* =====================================================
       INTERNAL STATE
    ===================================================== */

    let STATE = cloneDefaultState();


    /* =====================================================
       CLONE DEFAULT STATE
    ===================================================== */

    function cloneDefaultState() {

        return JSON.parse(
            JSON.stringify(DEFAULT_STATE)
        );

    }


    /* =====================================================
       INITIALIZE
    ===================================================== */

    function initialize() {

        if (
            !STATE ||
            typeof STATE !== "object"
        ) {

            STATE = cloneDefaultState();

        }

        return true;

    }


    /* =====================================================
       GET STATE
    ===================================================== */

    function getState(
        path,
        fallback = undefined
    ) {

        if (
            path === undefined ||
            path === null ||
            path === ""
        ) {

            return STATE;

        }


        const parts =
            String(path).split(".");


        let current = STATE;


        for (const part of parts) {

            if (
                current === null ||
                current === undefined ||
                typeof current !== "object" ||
                !(part in current)
            ) {

                return fallback;

            }


            current = current[part];

        }


        return current;

    }


    /* =====================================================
       SET STATE
    ===================================================== */

    function setState(
        path,
        value
    ) {

        if (
            path === undefined ||
            path === null ||
            path === ""
        ) {

            return false;

        }


        const parts =
            String(path).split(".");


        let current = STATE;


        for (
            let index = 0;
            index < parts.length - 1;
            index++
        ) {

            const part = parts[index];


            if (
                !current[part] ||
                typeof current[part] !== "object"
            ) {

                current[part] = {};

            }


            current = current[part];

        }


        current[
            parts[parts.length - 1]
        ] = value;


        return value;

    }


    /* =====================================================
       LEGACY GET
    ===================================================== */

    function get(
        path,
        fallback = undefined
    ) {

        return getState(
            path,
            fallback
        );

    }


    /* =====================================================
       LEGACY SET
    ===================================================== */

    function set(
        path,
        value
    ) {

        return setState(
            path,
            value
        );

    }


    /* =====================================================
       LEGACY MERGE
    ===================================================== */

    function merge(
        path,
        patch
    ) {

        if (
            path === undefined ||
            path === null ||
            path === ""
        ) {

            return false;

        }


        if (
            !patch ||
            typeof patch !== "object" ||
            Array.isArray(patch)
        ) {

            return setState(
                path,
                patch
            );

        }


        const current =
            getState(
                path,
                {}
            );


        let base;


        if (
            current &&
            typeof current === "object" &&
            !Array.isArray(current)
        ) {

            base = current;

        } else {

            base = {};

        }


        const merged = {

            ...base,

            ...patch

        };


        return setState(
            path,
            merged
        );

    }


    /* =====================================================
       RESET STATE
    ===================================================== */

    function resetState() {

        STATE =
            cloneDefaultState();


        return STATE;

    }


    /* =====================================================
       AUTH
    ===================================================== */

    function setAuth(
        auth = {}
    ) {

        STATE.auth = {

            ...STATE.auth,

            ...auth

        };


        return STATE.auth;

    }


    /* =====================================================
       MODEL
    ===================================================== */

    function setModel(
        model = {}
    ) {

        STATE.model = {

            ...STATE.model,

            ...model

        };


        return STATE.model;

    }


    function getModel() {

        return STATE.model;

    }


    /* =====================================================
       REFERENCE FILE
    ===================================================== */

    function setFile(
        file
    ) {

        STATE.file =
            file || null;


        return STATE.file;

    }


    function getFile() {

        return STATE.file;

    }


    function clearFile() {

        STATE.file = null;

        return true;

    }


    function hasFile() {

        return Boolean(
            STATE.file
        );

    }


    /* =====================================================
       REPLACEMENT CHARACTER
    ===================================================== */

    function setReplacementCharacter(
        file
    ) {

        STATE.replacementCharacter =
            file || null;


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


    /* =====================================================
       IMAGE ALIASES
    ===================================================== */

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

        STATE.file = null;

        STATE.replacementCharacter = null;

        return true;

    }


    /* =====================================================
       SETTINGS
    ===================================================== */

    function setSettings(
        settings = {}
    ) {

        STATE.settings = {

            ...STATE.settings,

            ...settings

        };


        return STATE.settings;

    }


    function getSettings() {

        return STATE.settings;

    }


    /* =====================================================
       ANALYSIS
    ===================================================== */

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

            ...DEFAULT_STATE.analysis

        };


        return STATE.analysis;

    }


    /* =====================================================
       PROMPT
    ===================================================== */

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
            value || "";


        return STATE.prompt.value;

    }


    function clearPrompt() {

        STATE.prompt = {

            ...DEFAULT_STATE.prompt

        };


        return STATE.prompt;

    }


    /* =====================================================
       PROCESS
    ===================================================== */

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

            ...STATE.process,

            status,

            stage,

            progress,

            error

        };


        return STATE.process;

    }


    function setProcessError(
        error
    ) {

        STATE.process = {

            ...STATE.process,

            status: "error",

            error

        };


        return STATE.process;

    }


    /* =====================================================
       LEGACY setProcessing()
    ===================================================== */

    function setProcessing(
        value = true,
        options = {}
    ) {

        /* ---------------------------------------------
           BOOLEAN
        --------------------------------------------- */

        if (
            typeof value === "boolean"
        ) {

            if (value) {

                STATE.process = {

                    ...STATE.process,

                    status: "processing",

                    stage:
                        options.stage ??
                        STATE.process.stage ??
                        "",

                    progress:
                        options.progress ??
                        STATE.process.progress ??
                        0,

                    error: null

                };

            } else {

                STATE.process = {

                    ...STATE.process,

                    status: "idle",

                    stage:
                        options.stage ??
                        STATE.process.stage ??
                        "",

                    progress:
                        options.progress ??
                        STATE.process.progress ??
                        0,

                    error:
                        options.error ??
                        null

                };

            }


            return STATE.process;

        }


        /* ---------------------------------------------
           OBJECT
        --------------------------------------------- */

        if (
            value &&
            typeof value === "object" &&
            !Array.isArray(value)
        ) {

            STATE.process = {

                ...STATE.process,

                ...value,

                status:
                    value.status ??
                    "processing"

            };


            return STATE.process;

        }


        /* ---------------------------------------------
           STRING
        --------------------------------------------- */

        if (
            typeof value === "string"
        ) {

            STATE.process = {

                ...STATE.process,

                status: value

            };


            return STATE.process;

        }


        return STATE.process;

    }


    /* =====================================================
       LEGACY setProcessingState()
    ===================================================== */

    function setProcessingState(
        processing,
        stage = "",
        progress = 0,
        error = null
    ) {

        if (
            processing
        ) {

            return setProcessStatus(

                "processing",

                stage,

                progress,

                error

            );

        }


        return setProcessStatus(

            "idle",

            stage,

            progress,

            error

        );

    }


    /* =====================================================
       PROCESS CHECK
    ===================================================== */

    function isProcessing() {

        return (

            STATE.process.status ===
            "processing"

        );

    }


    /* =====================================================
       LEGACY setProgress()
       -----------------------------------------------------
       vision-events.js menggunakan:

       getState().setProgress(25)

       Progress selalu disimpan di:

       state.process.progress
    ===================================================== */

    function setProgress(
        progress
    ) {

        let normalizedProgress =
            Number(progress);


        if (
            !Number.isFinite(
                normalizedProgress
            )
        ) {

            normalizedProgress = 0;

        }


        normalizedProgress =
            Math.max(
                0,
                Math.min(
                    100,
                    normalizedProgress
                )
            );


        STATE.process = {

            ...STATE.process,

            progress:
                normalizedProgress

        };


        return normalizedProgress;

    }


    /* =====================================================
       GET PROGRESS
    ===================================================== */

    function getProgress() {

        const progress =
            Number(
                STATE.process.progress
            );


        if (
            !Number.isFinite(progress)
        ) {

            return 0;

        }


        return Math.max(
            0,
            Math.min(
                100,
                progress
            )
        );

    }


    /* =====================================================
       CREDIT
    ===================================================== */

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


    /* =====================================================
       HISTORY
    ===================================================== */

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


    /* =====================================================
       UI
    ===================================================== */

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


    /* =====================================================
       READY CHECK
    ===================================================== */

    function isReadyForAnalysis() {

        return Boolean(

            hasReferenceImage() &&

            STATE.model.id

        );

    }


    /* =====================================================
       CHARACTER REPLACEMENT READY CHECK
    ===================================================== */

    function isReadyForCharacterReplacement() {

        return Boolean(

            hasReferenceImage() &&

            hasCharacterImage()

        );

    }


    /* =====================================================
       SNAPSHOT
    ===================================================== */

    function getSnapshot() {

        return cloneState(
            STATE
        );

    }


    /* =====================================================
       DEBUG INFO
    ===================================================== */

    function getDebugInfo() {

        return {

            initialized: true,

            hasReferenceImage:
                hasReferenceImage(),

            hasReplacementCharacter:
                hasCharacterImage(),

            model:
                STATE.model,

            settings:
                STATE.settings,

            analysisStatus:
                STATE.analysis.status,

            promptStatus:
                STATE.prompt.status,

            processStatus:
                STATE.process.status,

            processProgress:
                getProgress(),

            credit:
                STATE.credit,

            historyCount:

                Array.isArray(
                    STATE.history.items
                )

                    ? STATE.history.items.length

                    : 0

        };

    }


    /* =====================================================
       CLONE STATE
    ===================================================== */

    function cloneState(
        value
    ) {

        return JSON.parse(
            JSON.stringify(value)
        );

    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    const GENZVisionState =
        Object.freeze({

            /* -----------------------------------------
               CORE
            ----------------------------------------- */

            DEFAULT_STATE,

            initialize,

            getState,

            setState,

            get,

            set,

            merge,

            resetState,

            getSnapshot,

            getDebugInfo,


            /* -----------------------------------------
               AUTH
            ----------------------------------------- */

            setAuth,


            /* -----------------------------------------
               MODEL
            ----------------------------------------- */

            setModel,

            getModel,


            /* -----------------------------------------
               REFERENCE IMAGE
            ----------------------------------------- */

            setFile,

            getFile,

            clearFile,

            hasFile,


            /* -----------------------------------------
               REPLACEMENT CHARACTER
            ----------------------------------------- */

            setReplacementCharacter,

            getReplacementCharacter,

            clearReplacementCharacter,

            hasReplacementCharacter,


            /* -----------------------------------------
               IMAGE ALIASES
            ----------------------------------------- */

            getReferenceImage,

            getCharacterImage,

            hasReferenceImage,

            hasCharacterImage,

            clearImages,


            /* -----------------------------------------
               SETTINGS
            ----------------------------------------- */

            setSettings,

            getSettings,


            /* -----------------------------------------
               ANALYSIS
            ----------------------------------------- */

            setAnalysis,

            getAnalysis,

            clearAnalysis,


            /* -----------------------------------------
               PROMPT
            ----------------------------------------- */

            setPrompt,

            getPrompt,

            setPromptValue,

            clearPrompt,


            /* -----------------------------------------
               PROCESS
            ----------------------------------------- */

            setProcess,

            getProcess,

            setProcessStatus,

            setProcessError,

            setProcessing,

            setProcessingState,

            isProcessing,

            setProgress,

            getProgress,


            /* -----------------------------------------
               CREDIT
            ----------------------------------------- */

            setCredit,

            getCredit,


            /* -----------------------------------------
               HISTORY
            ----------------------------------------- */

            setHistory,

            getHistory,


            /* -----------------------------------------
               UI
            ----------------------------------------- */

            setUI,

            getUI,


            /* -----------------------------------------
               READY CHECKS
            ----------------------------------------- */

            isReadyForAnalysis,

            isReadyForCharacterReplacement

        });


    /* =====================================================
       GLOBAL EXPORT
    ===================================================== */

    window.GENZVisionState =
        GENZVisionState;


})();
