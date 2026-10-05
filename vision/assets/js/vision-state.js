/* =========================================================
   GEN-Z.AI VISION
   ---------------------------------------------------------
   File:
   vision/assets/js/vision-state.js

   Fungsi:
   - Central state management
   - Auth state
   - Reference image
   - Replacement character
   - Outfit source
   - Model state
   - Vision settings
   - Analysis state
   - Prompt state
   - Process state
   - Credit state
   - History state
   - UI state
   - Backward compatibility aliases
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

            session: null,

            user: null,

            profile: null,

            authenticated: false,

            role: null,

            email: null

        },


        /* ---------------------------------------------
           REFERENCE IMAGE
        --------------------------------------------- */

        file: null,


        /* ---------------------------------------------
           REPLACEMENT CHARACTER
        --------------------------------------------- */

        replacementCharacter: null,


        /* ---------------------------------------------
           OUTFIT SOURCE
           ---------------------------------------------
           reference:
           Gunakan outfit dari gambar referensi utama.

           character:
           Gunakan outfit dari replacement character.
        --------------------------------------------- */

        outfitSource: "reference",


        /* ---------------------------------------------
           MODEL
        --------------------------------------------- */

        model: {

            id: null,

            name: null,

            provider: null,

            providerId: null,

            inputModalities: [],

            outputModalities: [],

            available: false

        },


        /* ---------------------------------------------
           SETTINGS
        --------------------------------------------- */

        settings: {

            detail: "high",

            purpose: "",

            instruction: ""

        },


        /* ---------------------------------------------
           ANALYSIS
        --------------------------------------------- */

        analysis: {

            raw: null,

            normalized: null,

            completed: false,

            error: null

        },


        /* ---------------------------------------------
           PROMPT
        --------------------------------------------- */

        prompt: {

            text: "",

            generated: false,

            copied: false

        },


        /* ---------------------------------------------
           PROCESS
        --------------------------------------------- */

        process: {

            status: "idle",

            loading: false,

            progress: 0,

            stage: null,

            startedAt: null,

            completedAt: null,

            error: null

        },


        /* ---------------------------------------------
           CREDIT
        --------------------------------------------- */

        credit: {

            balance: 0,

            required: 0,

            remaining: 0,

            loaded: false

        },


        /* ---------------------------------------------
           HISTORY
        --------------------------------------------- */

        history: {

            items: [],

            loaded: false

        },


        /* ---------------------------------------------
           UI
        --------------------------------------------- */

        ui: {

            initialized: false,

            busy: false,

            error: null

        }

    };


    /* =====================================================
       INTERNAL STATE
    ===================================================== */

    let STATE =
        createState();


    /* =====================================================
       CREATE STATE
    ===================================================== */

    function createState() {

        return {

            auth: {

                ...DEFAULT_STATE.auth

            },

            file:
                DEFAULT_STATE.file,

            replacementCharacter:
                DEFAULT_STATE.replacementCharacter,

            outfitSource:
                DEFAULT_STATE.outfitSource,

            model: {

                ...DEFAULT_STATE.model,

                inputModalities: [
                    ...DEFAULT_STATE.model.inputModalities
                ],

                outputModalities: [
                    ...DEFAULT_STATE.model.outputModalities
                ]

            },

            settings: {

                ...DEFAULT_STATE.settings

            },

            analysis: {

                ...DEFAULT_STATE.analysis

            },

            prompt: {

                ...DEFAULT_STATE.prompt

            },

            process: {

                ...DEFAULT_STATE.process

            },

            credit: {

                ...DEFAULT_STATE.credit

            },

            history: {

                ...DEFAULT_STATE.history,

                items: [
                    ...DEFAULT_STATE.history.items
                ]

            },

            ui: {

                ...DEFAULT_STATE.ui

            }

        };

    }


    /* =====================================================
       STATE ACCESS
    ===================================================== */

    function getState() {

        return STATE;

    }


    function resetState() {

        STATE =
            createState();

        return STATE;

    }


    /* =====================================================
       AUTH
    ===================================================== */

    function setAuth(
        auth
    ) {

        STATE.auth = {

            ...STATE.auth,

            ...(auth || {})

        };

        return STATE.auth;

    }


    function getAuth() {

        return STATE.auth;

    }


    function setSession(
        session
    ) {

        STATE.auth.session =
            session || null;

        return STATE.auth.session;

    }


    function getSession() {

        return STATE.auth.session;

    }


    function setUser(
        user
    ) {

        STATE.auth.user =
            user || null;

        STATE.auth.authenticated =
            Boolean(user);

        if (
            user &&
            user.email
        ) {

            STATE.auth.email =
                user.email;

        }

        return STATE.auth.user;

    }


    function getUser() {

        return STATE.auth.user;

    }


    function setProfile(
        profile
    ) {

        STATE.auth.profile =
            profile || null;

        if (profile) {

            STATE.auth.role =
                profile.role ||
                null;

            STATE.auth.email =
                profile.email ||
                STATE.auth.email ||
                null;

        }

        return STATE.auth.profile;

    }


    function getProfile() {

        return STATE.auth.profile;

    }


    function setAuthenticated(
        authenticated
    ) {

        STATE.auth.authenticated =
            Boolean(authenticated);

        return STATE.auth.authenticated;

    }


    function isAuthenticated() {

        return Boolean(
            STATE.auth.authenticated
        );

    }


    /* =====================================================
       REFERENCE IMAGE
    ===================================================== */

    function setReferenceFile(
        file
    ) {

        STATE.file =
            file || null;

        return STATE.file;

    }


    function getReferenceFile() {

        return STATE.file;

    }


    function clearReferenceFile() {

        STATE.file =
            null;

        return true;

    }


    function hasReferenceFile() {

        return Boolean(
            STATE.file
        );

    }


    /* =====================================================
       REFERENCE IMAGE
       BACKWARD COMPATIBILITY ALIASES
       -----------------------------------------------------
       Beberapa modul lama masih menggunakan:
       - setFile()
       - getFile()
       - clearFile()
       - hasFile()

       Semua diarahkan ke reference file yang sama.
    ===================================================== */

    function setFile(
        file
    ) {

        return setReferenceFile(
            file
        );

    }


    function getFile() {

        return getReferenceFile();

    }


    function clearFile() {

        return clearReferenceFile();

    }


    function hasFile() {

        return hasReferenceFile();

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
       OUTFIT SOURCE
    ===================================================== */

    function setOutfitSource(
        source
    ) {

        const normalized =
            String(
                source || "reference"
            )
                .trim()
                .toLowerCase();


        if (
            normalized !== "reference" &&
            normalized !== "character"
        ) {

            STATE.outfitSource =
                "reference";

            return STATE.outfitSource;

        }


        STATE.outfitSource =
            normalized;


        return STATE.outfitSource;

    }


    function getOutfitSource() {

        return STATE.outfitSource;

    }


    function isReferenceOutfit() {

        return (
            STATE.outfitSource ===
            "reference"
        );

    }


    function isCharacterOutfit() {

        return (
            STATE.outfitSource ===
            "character"
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


    /* =====================================================
       MODEL
    ===================================================== */

    function setModel(
        model
    ) {

        STATE.model = {

            ...STATE.model,

            ...(model || {})

        };

        return STATE.model;

    }


    function getModel() {

        return STATE.model;

    }


    function setModelId(
        id
    ) {

        STATE.model.id =
            id || null;

        return STATE.model.id;

    }


    function getModelId() {

        return STATE.model.id;

    }


    function setModelName(
        name
    ) {

        STATE.model.name =
            name || null;

        return STATE.model.name;

    }


    function getModelName() {

        return STATE.model.name;

    }


    function setModelProvider(
        provider
    ) {

        STATE.model.provider =
            provider || null;

        return STATE.model.provider;

    }


    function getModelProvider() {

        return STATE.model.provider;

    }


    function setModelAvailable(
        available
    ) {

        STATE.model.available =
            Boolean(available);

        return STATE.model.available;

    }


    function isModelAvailable() {

        return Boolean(
            STATE.model.available
        );

    }


    /* =====================================================
       SETTINGS
    ===================================================== */

    function setSettings(
        settings
    ) {

        STATE.settings = {

            ...STATE.settings,

            ...(settings || {})

        };

        return STATE.settings;

    }


    function getSettings() {

        return STATE.settings;

    }


    function setDetail(
        detail
    ) {

        STATE.settings.detail =
            detail || "high";

        return STATE.settings.detail;

    }


    function getDetail() {

        return STATE.settings.detail;

    }


    function setPurpose(
        purpose
    ) {

        STATE.settings.purpose =
            purpose || "";

        return STATE.settings.purpose;

    }


    function getPurpose() {

        return STATE.settings.purpose;

    }


    function setInstruction(
        instruction
    ) {

        STATE.settings.instruction =
            instruction || "";

        return STATE.settings.instruction;

    }


    function getInstruction() {

        return STATE.settings.instruction;

    }


    /* =====================================================
       ANALYSIS
    ===================================================== */

    function setAnalysis(
        analysis
    ) {

        STATE.analysis = {

            ...STATE.analysis,

            ...(analysis || {})

        };

        return STATE.analysis;

    }


    function getAnalysis() {

        return STATE.analysis;

    }


    function setAnalysisRaw(
        raw
    ) {

        STATE.analysis.raw =
            raw;

        return STATE.analysis.raw;

    }


    function getAnalysisRaw() {

        return STATE.analysis.raw;

    }


    function setAnalysisNormalized(
        normalized
    ) {

        STATE.analysis.normalized =
            normalized;

        return STATE.analysis.normalized;

    }


    function getAnalysisNormalized() {

        return STATE.analysis.normalized;

    }


    function setAnalysisCompleted(
        completed
    ) {

        STATE.analysis.completed =
            Boolean(completed);

        return STATE.analysis.completed;

    }


    function isAnalysisCompleted() {

        return Boolean(
            STATE.analysis.completed
        );

    }


    function setAnalysisError(
        error
    ) {

        STATE.analysis.error =
            error || null;

        return STATE.analysis.error;

    }


    function getAnalysisError() {

        return STATE.analysis.error;

    }


    /* =====================================================
       PROMPT
    ===================================================== */

    function setPrompt(
        text
    ) {

        STATE.prompt.text =
            text || "";

        STATE.prompt.generated =
            Boolean(
                STATE.prompt.text
            );

        return STATE.prompt.text;

    }


    function getPrompt() {

        return STATE.prompt.text;

    }


    function clearPrompt() {

        STATE.prompt.text =
            "";

        STATE.prompt.generated =
            false;

        STATE.prompt.copied =
            false;

        return true;

    }


    function hasPrompt() {

        return Boolean(
            STATE.prompt.text
        );

    }


    function setPromptGenerated(
        generated
    ) {

        STATE.prompt.generated =
            Boolean(generated);

        return STATE.prompt.generated;

    }


    function isPromptGenerated() {

        return Boolean(
            STATE.prompt.generated
        );

    }


    function setPromptCopied(
        copied
    ) {

        STATE.prompt.copied =
            Boolean(copied);

        return STATE.prompt.copied;

    }


    function isPromptCopied() {

        return Boolean(
            STATE.prompt.copied
        );

    }


    /* =====================================================
       PROCESS
    ===================================================== */

    function setProcess(
        process
    ) {

        STATE.process = {

            ...STATE.process,

            ...(process || {})

        };

        return STATE.process;

    }


    function getProcess() {

        return STATE.process;

    }


    function setProcessStatus(
        status
    ) {

        STATE.process.status =
            status || "idle";

        return STATE.process.status;

    }


    function getProcessStatus() {

        return STATE.process.status;

    }


    function setLoading(
        loading
    ) {

        STATE.process.loading =
            Boolean(loading);

        return STATE.process.loading;

    }


    function isLoading() {

        return Boolean(
            STATE.process.loading
        );

    }


    function setProgress(
        progress
    ) {

        let value =
            Number(progress);


        if (!Number.isFinite(value)) {

            value = 0;

        }


        value =
            Math.max(
                0,
                Math.min(
                    100,
                    value
                )
            );


        STATE.process.progress =
            value;


        return STATE.process.progress;

    }


    function getProgress() {

        return STATE.process.progress;

    }


    function setProcessStage(
        stage
    ) {

        STATE.process.stage =
            stage || null;

        return STATE.process.stage;

    }


    function getProcessStage() {

        return STATE.process.stage;

    }


    function setProcessError(
        error
    ) {

        STATE.process.error =
            error || null;

        return STATE.process.error;

    }


    function getProcessError() {

        return STATE.process.error;

    }


    function startProcess() {

        STATE.process.status =
            "processing";

        STATE.process.loading =
            true;

        STATE.process.progress =
            0;

        STATE.process.stage =
            null;

        STATE.process.startedAt =
            Date.now();

        STATE.process.completedAt =
            null;

        STATE.process.error =
            null;

        return STATE.process;

    }


    function completeProcess() {

        STATE.process.status =
            "completed";

        STATE.process.loading =
            false;

        STATE.process.progress =
            100;

        STATE.process.completedAt =
            Date.now();

        return STATE.process;

    }


    function failProcess(
        error
    ) {

        STATE.process.status =
            "error";

        STATE.process.loading =
            false;

        STATE.process.error =
            error || null;

        STATE.process.completedAt =
            Date.now();

        return STATE.process;

    }


    function resetProcess() {

        STATE.process = {

            ...DEFAULT_STATE.process

        };

        return STATE.process;

    }


    /* =====================================================
       CREDIT
    ===================================================== */

    function setCredit(
        credit
    ) {

        STATE.credit = {

            ...STATE.credit,

            ...(credit || {})

        };

        return STATE.credit;

    }


    function getCredit() {

        return STATE.credit;

    }


    function setCreditBalance(
        balance
    ) {

        const value =
            Number(balance);


        STATE.credit.balance =
            Number.isFinite(value)
                ? value
                : 0;


        return STATE.credit.balance;

    }


    function getCreditBalance() {

        return STATE.credit.balance;

    }


    function setCreditRequired(
        required
    ) {

        const value =
            Number(required);


        STATE.credit.required =
            Number.isFinite(value)
                ? value
                : 0;


        return STATE.credit.required;

    }


    function getCreditRequired() {

        return STATE.credit.required;

    }


    function setCreditRemaining(
        remaining
    ) {

        const value =
            Number(remaining);


        STATE.credit.remaining =
            Number.isFinite(value)
                ? value
                : 0;


        return STATE.credit.remaining;

    }


    function getCreditRemaining() {

        return STATE.credit.remaining;

    }


    function setCreditLoaded(
        loaded
    ) {

        STATE.credit.loaded =
            Boolean(loaded);

        return STATE.credit.loaded;

    }


    function isCreditLoaded() {

        return Boolean(
            STATE.credit.loaded
        );

    }


    /* =====================================================
       HISTORY
    ===================================================== */

    function setHistory(
        items
    ) {

        STATE.history.items =
            Array.isArray(items)
                ? items
                : [];

        STATE.history.loaded =
            true;

        return STATE.history.items;

    }


    function getHistory() {

        return STATE.history;

    }


    function getHistoryItems() {

        return STATE.history.items;

    }


    function addHistoryItem(
        item
    ) {

        if (!item) {

            return STATE.history.items;

        }


        STATE.history.items.unshift(
            item
        );


        return STATE.history.items;

    }


    function clearHistory() {

        STATE.history.items =
            [];

        return true;

    }


    function setHistoryLoaded(
        loaded
    ) {

        STATE.history.loaded =
            Boolean(loaded);

        return STATE.history.loaded;

    }


    function isHistoryLoaded() {

        return Boolean(
            STATE.history.loaded
        );

    }


    /* =====================================================
       UI
    ===================================================== */

    function setUI(
        ui
    ) {

        STATE.ui = {

            ...STATE.ui,

            ...(ui || {})

        };

        return STATE.ui;

    }


    function getUI() {

        return STATE.ui;

    }


    function setInitialized(
        initialized
    ) {

        STATE.ui.initialized =
            Boolean(initialized);

        return STATE.ui.initialized;

    }


    function isInitialized() {

        return Boolean(
            STATE.ui.initialized
        );

    }


    function setBusy(
        busy
    ) {

        STATE.ui.busy =
            Boolean(busy);

        return STATE.ui.busy;

    }


    function isBusy() {

        return Boolean(
            STATE.ui.busy
        );

    }


    function setUIError(
        error
    ) {

        STATE.ui.error =
            error || null;

        return STATE.ui.error;

    }


    function getUIError() {

        return STATE.ui.error;

    }


    /* =====================================================
       READY CHECKS
    ===================================================== */

    function isReadyForAnalysis() {

        return (

            hasReferenceImage() &&

            isAuthenticated() &&

            isModelAvailable()

        );

    }


    function isReadyForPrompt() {

        return (

            isAnalysisCompleted() &&

            Boolean(
                STATE.analysis.normalized
            )

        );

    }


    function isReadyForGenerate() {

        return (

            isReadyForAnalysis() &&

            isReadyForPrompt()

        );

    }


    /* =====================================================
       SNAPSHOT
    ===================================================== */

    function getSnapshot() {

        return {

            auth: {

                ...STATE.auth

            },

            file:
                STATE.file,

            replacementCharacter:
                STATE.replacementCharacter,

            outfitSource:
                STATE.outfitSource,

            model: {

                ...STATE.model

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

                items: [
                    ...STATE.history.items
                ]

            },

            ui: {

                ...STATE.ui

            }

        };

    }


    /* =====================================================
       DEBUG
    ===================================================== */

    function debugState() {

        return getSnapshot();

    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    window.GENZVisionState = {

        /* -----------------------------------------
           STATE
        ----------------------------------------- */

        getState,

        resetState,

        getSnapshot,

        debugState,


        /* -----------------------------------------
           AUTH
        ----------------------------------------- */

        setAuth,

        getAuth,

        setSession,

        getSession,

        setUser,

        getUser,

        setProfile,

        getProfile,

        setAuthenticated,

        isAuthenticated,


        /* -----------------------------------------
           REFERENCE IMAGE
        ----------------------------------------- */

        setReferenceFile,

        getReferenceFile,

        clearReferenceFile,

        hasReferenceFile,


        /* -----------------------------------------
           REFERENCE IMAGE
           BACKWARD COMPATIBILITY
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
           OUTFIT SOURCE
        ----------------------------------------- */

        setOutfitSource,

        getOutfitSource,

        isReferenceOutfit,

        isCharacterOutfit,


        /* -----------------------------------------
           IMAGE ALIASES
        ----------------------------------------- */

        getReferenceImage,

        getCharacterImage,

        hasReferenceImage,

        hasCharacterImage,


        /* -----------------------------------------
           MODEL
        ----------------------------------------- */

        setModel,

        getModel,

        setModelId,

        getModelId,

        setModelName,

        getModelName,

        setModelProvider,

        getModelProvider,

        setModelAvailable,

        isModelAvailable,


        /* -----------------------------------------
           SETTINGS
        ----------------------------------------- */

        setSettings,

        getSettings,

        setDetail,

        getDetail,

        setPurpose,

        getPurpose,

        setInstruction,

        getInstruction,


        /* -----------------------------------------
           ANALYSIS
        ----------------------------------------- */

        setAnalysis,

        getAnalysis,

        setAnalysisRaw,

        getAnalysisRaw,

        setAnalysisNormalized,

        getAnalysisNormalized,

        setAnalysisCompleted,

        isAnalysisCompleted,

        setAnalysisError,

        getAnalysisError,


        /* -----------------------------------------
           PROMPT
        ----------------------------------------- */

        setPrompt,

        getPrompt,

        clearPrompt,

        hasPrompt,

        setPromptGenerated,

        isPromptGenerated,

        setPromptCopied,

        isPromptCopied,


        /* -----------------------------------------
           PROCESS
        ----------------------------------------- */

        setProcess,

        getProcess,

        setProcessStatus,

        getProcessStatus,

        setLoading,

        isLoading,

        setProgress,

        getProgress,

        setProcessStage,

        getProcessStage,

        setProcessError,

        getProcessError,

        startProcess,

        completeProcess,

        failProcess,

        resetProcess,


        /* -----------------------------------------
           CREDIT
        ----------------------------------------- */

        setCredit,

        getCredit,

        setCreditBalance,

        getCreditBalance,

        setCreditRequired,

        getCreditRequired,

        setCreditRemaining,

        getCreditRemaining,

        setCreditLoaded,

        isCreditLoaded,


        /* -----------------------------------------
           HISTORY
        ----------------------------------------- */

        setHistory,

        getHistory,

        getHistoryItems,

        addHistoryItem,

        clearHistory,

        setHistoryLoaded,

        isHistoryLoaded,


        /* -----------------------------------------
           UI
        ----------------------------------------- */

        setUI,

        getUI,

        setInitialized,

        isInitialized,

        setBusy,

        isBusy,

        setUIError,

        getUIError,


        /* -----------------------------------------
           READY CHECKS
        ----------------------------------------- */

        isReadyForAnalysis,

        isReadyForPrompt,

        isReadyForGenerate

    };


})();
