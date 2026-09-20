/* =========================================================
   GEN-Z.AI
   GENERATE STATE MODULE
   ---------------------------------------------------------
   File:
   generate/assets/js/generate-state.js

   Tanggung jawab:
   - Menyimpan seluruh state halaman Generate
   - Menyimpan referensi DOM
   - Menyediakan getter/setter untuk module lain
   - Menyediakan kompatibilitas nama elemen antar-module

   Tidak bertanggung jawab:
   - Supabase authentication
   - Query model
   - Render parameter
   - Validation
   - API generate
   - Styling
========================================================= */

const state = {
    supabaseClient: null,

    currentUser: null,

    currentProfile: null,

    currentModel: null,

    availableModels: [],

    modelLoaded: false,

    elements: {
        /* =====================================================
           CANONICAL ELEMENT REFERENCES
        ===================================================== */

        status: null,

        modelSelector: null,

        modelSelect: null,

        modelName: null,

        modelDescription: null,

        providerName: null,

        modelMeta: null,

        dynamicFields: null,

        generateForm: null,

        generateCard: null,

        generateButton: null,

        resetButton: null,

        loading: null,

        resultCard: null,

        pageError: null,

        pageErrorMessage: null,

        roleBadge: null,

        creditBadge: null,

        resultModel: null,

        resultProvider: null,

        resultTaskId: null,

        /* =====================================================
           LEGACY / MODULE COMPATIBILITY ALIASES

           Beberapa module Generate menggunakan nama:
           - statusEl
           - modelSelectorEl
           - modelSelectEl
           - modelNameEl
           - modelDescriptionEl
           - providerNameEl
           - modelMetaEl
           - dynamicFieldsEl
           - generateFormEl
           - generateCardEl
           - generateButtonEl
           - resetButtonEl
           - loadingEl
           - resultCardEl
           - pageErrorEl
           - pageErrorMessageEl
           - roleBadgeEl
           - creditBadgeEl
           - resultModelEl
           - resultProviderEl
           - resultTaskIdEl

           Alias ini menunjuk ke DOM yang sama.
        ===================================================== */

        statusEl: null,

        modelSelectorEl: null,

        modelSelectEl: null,

        modelNameEl: null,

        modelDescriptionEl: null,

        providerNameEl: null,

        modelMetaEl: null,

        dynamicFieldsEl: null,

        generateFormEl: null,

        generateCardEl: null,

        generateButtonEl: null,

        resetButtonEl: null,

        loadingEl: null,

        resultCardEl: null,

        pageErrorEl: null,

        pageErrorMessageEl: null,

        roleBadgeEl: null,

        creditBadgeEl: null,

        resultModelEl: null,

        resultProviderEl: null,

        resultTaskIdEl: null
    }
};


/* =========================================================
   INITIALIZE DOM
========================================================= */

export function initializeGenerateElements() {

    const ids = {
        status: "status",

        modelSelector: "modelSelector",

        modelSelect: "modelSelect",

        modelName: "modelName",

        modelDescription: "modelDescription",

        providerName: "providerName",

        modelMeta: "modelMeta",

        dynamicFields: "dynamicFields",

        generateForm: "generateForm",

        generateCard: "generateCard",

        generateButton: "generateButton",

        resetButton: "resetButton",

        loading: "loading",

        resultCard: "resultCard",

        pageError: "pageError",

        pageErrorMessage: "pageErrorMessage",

        roleBadge: "roleBadge",

        creditBadge: "creditBadge",

        resultModel: "resultModel",

        resultProvider: "resultProvider",

        resultTaskId: "resultTaskId"
    };


    /* =====================================================
       LOAD DOM REFERENCES
    ===================================================== */

    for (
        const [
            key,
            id
        ] of Object.entries(ids)
    ) {

        state.elements[key] =
            document.getElementById(id);
    }


    /* =====================================================
       CREATE COMPATIBILITY ALIASES
    ===================================================== */

    state.elements.statusEl =
        state.elements.status;

    state.elements.modelSelectorEl =
        state.elements.modelSelector;

    state.elements.modelSelectEl =
        state.elements.modelSelect;

    state.elements.modelNameEl =
        state.elements.modelName;

    state.elements.modelDescriptionEl =
        state.elements.modelDescription;

    state.elements.providerNameEl =
        state.elements.providerName;

    state.elements.modelMetaEl =
        state.elements.modelMeta;

    state.elements.dynamicFieldsEl =
        state.elements.dynamicFields;

    state.elements.generateFormEl =
        state.elements.generateForm;

    state.elements.generateCardEl =
        state.elements.generateCard;

    state.elements.generateButtonEl =
        state.elements.generateButton;

    state.elements.resetButtonEl =
        state.elements.resetButton;

    state.elements.loadingEl =
        state.elements.loading;

    state.elements.resultCardEl =
        state.elements.resultCard;

    state.elements.pageErrorEl =
        state.elements.pageError;

    state.elements.pageErrorMessageEl =
        state.elements.pageErrorMessage;

    state.elements.roleBadgeEl =
        state.elements.roleBadge;

    state.elements.creditBadgeEl =
        state.elements.creditBadge;

    state.elements.resultModelEl =
        state.elements.resultModel;

    state.elements.resultProviderEl =
        state.elements.resultProvider;

    state.elements.resultTaskIdEl =
        state.elements.resultTaskId;


    return state.elements;
}


/* =========================================================
   VALIDATE DOM
========================================================= */

export function validateGenerateElements() {

    const required = [
        "status",

        "modelSelector",

        "modelSelect",

        "modelName",

        "modelDescription",

        "providerName",

        "modelMeta",

        "dynamicFields",

        "generateForm",

        "generateButton",

        "resetButton",

        "loading",

        "resultCard",

        "pageError",

        "pageErrorMessage"
    ];


    const missing =
        required.filter(
            key =>
                !state.elements[key]
        );


    if (
        missing.length > 0
    ) {

        throw new Error(
            `Elemen Generate tidak lengkap: ${missing.join(", ")}.`
        );
    }


    return true;
}


/* =========================================================
   SUPABASE
========================================================= */

export function setSupabaseClient(
    client
) {

    state.supabaseClient =
        client || null;


    return state.supabaseClient;
}


export function getSupabaseClient() {

    return state.supabaseClient;
}


/* =========================================================
   USER
========================================================= */

export function setCurrentUser(
    user
) {

    state.currentUser =
        user || null;


    return state.currentUser;
}


export function getCurrentUser() {

    return state.currentUser;
}


/* =========================================================
   PROFILE
========================================================= */

export function setCurrentProfile(
    profile
) {

    state.currentProfile =
        profile || null;


    return state.currentProfile;
}


export function getCurrentProfile() {

    return state.currentProfile;
}


/* =========================================================
   MODEL
========================================================= */

export function setCurrentModel(
    model
) {

    state.currentModel =
        model || null;


    state.modelLoaded =
        Boolean(
            model &&
            String(
                model.model_id ??
                ""
            ).trim()
        );


    return state.currentModel;
}


export function getCurrentModel() {

    return state.currentModel;
}


/* =========================================================
   AVAILABLE MODELS
========================================================= */

export function setAvailableModels(
    models
) {

    state.availableModels =
        Array.isArray(
            models
        )
            ? models
            : [];


    return state.availableModels;
}


export function getAvailableModels() {

    return state.availableModels;
}


/* =========================================================
   FIND MODEL
========================================================= */

export function findAvailableModel(
    modelId
) {

    if (
        modelId === null ||
        modelId === undefined
    ) {

        return null;
    }


    const target =
        String(
            modelId
        ).trim();


    if (!target) {

        return null;
    }


    return (
        state.availableModels.find(
            model =>
                String(
                    model?.model_id ??
                    ""
                ).trim() === target
        ) ||
        null
    );
}


/* =========================================================
   MODEL LOADED
========================================================= */

export function setModelLoaded(
    value
) {

    state.modelLoaded =
        Boolean(
            value
        );


    return state.modelLoaded;
}


export function isModelLoaded() {

    return state.modelLoaded;
}


/* =========================================================
   MODEL READY
   ---------------------------------------------------------
   Dipakai oleh:
   - generate-ui.js
   - generate-app.js

   Model dianggap siap apabila:
   1. currentModel tersedia
   2. currentModel memiliki model_id
   3. modelLoaded bernilai true
========================================================= */

export function isModelReady() {

    const model =
        state.currentModel;


    const modelId =
        String(
            model?.model_id ??
            ""
        ).trim();


    return Boolean(
        state.modelLoaded &&
        model &&
        modelId
    );
}


/* =========================================================
   ELEMENTS
========================================================= */

export function getGenerateElements() {

    return state.elements;
}


/* =========================================================
   RESET STATE
========================================================= */

export function resetGenerateState() {

    state.currentUser =
        null;


    state.currentProfile =
        null;


    state.currentModel =
        null;


    state.availableModels =
        [];


    state.modelLoaded =
        false;
}


/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default state;
