/* =========================================================
   GEN-Z.AI
   GENERATE STATE MODULE
   ---------------------------------------------------------
   File:
   generate/assets/js/generate-state.js

   Tanggung jawab:
   - Menyimpan state Generate
   - Menyimpan referensi DOM
   - Menyediakan akses state untuk module lain

   Tidak bertanggung jawab:
   - Supabase authentication
   - Query model
   - Render parameter
   - Validation
   - API generate
   - Styling
========================================================= */

const state = {
    /* =====================================================
       SUPABASE
    ====================================================== */

    supabaseClient: null,

    /* =====================================================
       AUTH
    ====================================================== */

    currentUser: null,

    currentProfile: null,

    /* =====================================================
       MODEL
    ====================================================== */

    currentModel: null,

    availableModels: [],

    modelLoaded: false,

    /* =====================================================
       DOM
    ====================================================== */

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

        creditBadge: null
    }
};


/* =========================================================
   INITIALIZE DOM REFERENCES
========================================================= */

export function initializeGenerateElements() {

    state.elements.status =
        document.getElementById(
            "status"
        );

    state.elements.modelSelector =
        document.getElementById(
            "modelSelector"
        );

    state.elements.modelSelect =
        document.getElementById(
            "modelSelect"
        );

    state.elements.modelName =
        document.getElementById(
            "modelName"
        );

    state.elements.modelDescription =
        document.getElementById(
            "modelDescription"
        );

    state.elements.providerName =
        document.getElementById(
            "providerName"
        );

    state.elements.modelMeta =
        document.getElementById(
            "modelMeta"
        );

    state.elements.dynamicFields =
        document.getElementById(
            "dynamicFields"
        );

    state.elements.generateForm =
        document.getElementById(
            "generateForm"
        );

    state.elements.generateCard =
        document.getElementById(
            "generateCard"
        );

    state.elements.generateButton =
        document.getElementById(
            "generateButton"
        );

    state.elements.resetButton =
        document.getElementById(
            "resetButton"
        );

    state.elements.loading =
        document.getElementById(
            "loading"
        );

    state.elements.resultCard =
        document.getElementById(
            "resultCard"
        );

    state.elements.pageError =
        document.getElementById(
            "pageError"
        );

    state.elements.pageErrorMessage =
        document.getElementById(
            "pageErrorMessage"
        );

    state.elements.roleBadge =
        document.getElementById(
            "roleBadge"
        );

    state.elements.creditBadge =
        document.getElementById(
            "creditBadge"
        );

    return state.elements;
}


/* =========================================================
   ELEMENT VALIDATION
   ---------------------------------------------------------
   Dipakai saat bootstrap untuk memastikan HTML Generate
   memiliki elemen inti yang diperlukan.
========================================================= */

export function validateGenerateElements() {

    const required = [
        [
            "status",
            state.elements.status
        ],
        [
            "modelSelector",
            state.elements.modelSelector
        ],
        [
            "modelSelect",
            state.elements.modelSelect
        ],
        [
            "modelName",
            state.elements.modelName
        ],
        [
            "modelDescription",
            state.elements.modelDescription
        ],
        [
            "providerName",
            state.elements.providerName
        ],
        [
            "modelMeta",
            state.elements.modelMeta
        ],
        [
            "dynamicFields",
            state.elements.dynamicFields
        ],
        [
            "generateForm",
            state.elements.generateForm
        ],
        [
            "generateButton",
            state.elements.generateButton
        ],
        [
            "resetButton",
            state.elements.resetButton
        ],
        [
            "loading",
            state.elements.loading
        ],
        [
            "resultCard",
            state.elements.resultCard
        ],
        [
            "pageError",
            state.elements.pageError
        ],
        [
            "pageErrorMessage",
            state.elements.pageErrorMessage
        ]
    ];

    const missing =
        required
            .filter(
                ([, element]) =>
                    !element
            )
            .map(
                ([name]) =>
                    name
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
   SUPABASE STATE
========================================================= */

export function setSupabaseClient(
    client
) {

    state.supabaseClient =
        client;

    return state.supabaseClient;
}


export function getSupabaseClient() {

    return state.supabaseClient;
}


/* =========================================================
   USER STATE
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
   PROFILE STATE
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
   MODEL STATE
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
   MODEL LOOKUP
   ---------------------------------------------------------
   Menghindari module lain mengakses array secara langsung
   ketika hanya membutuhkan satu model.
========================================================= */

export function findAvailableModel(
    modelId
) {

    if (
        !modelId
    ) {
        return null;
    }

    return (
        state.availableModels.find(
            model =>
                String(
                    model?.model_id
                ) ===
                String(
                    modelId
                )
        ) ||
        null
    );
}


/* =========================================================
   STATE RESET
   ---------------------------------------------------------
   Dipakai ketika user logout atau Generate perlu
   diinisialisasi ulang.
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
   DOM ACCESSOR
========================================================= */

export function getGenerateElements() {

    return state.elements;
}


/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default state;
