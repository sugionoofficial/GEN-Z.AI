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

        resultTaskId: null
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

    for (
        const [
            key,
            id
        ] of Object.entries(ids)
    ) {
        state.elements[key] =
            document.getElementById(id);
    }

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
            model.model_id
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
        Array.isArray(models)
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
                    model?.model_id ?? ""
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
        Boolean(value);

    return state.modelLoaded;
}


export function isModelLoaded() {

    return state.modelLoaded;
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
