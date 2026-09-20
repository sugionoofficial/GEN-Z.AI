/* =========================================================
   GEN-Z.AI
   GENERATE STATE MODULE
   ---------------------------------------------------------
   File:
   generate/assets/js/generate-state.js

   Responsibility:
   - Store Generate application state
   - Store DOM references
   - Provide getter/setter functions
   - Preserve legacy element aliases
   - Store model credit DOM references
========================================================= */

"use strict";


/* =========================================================
   APPLICATION STATE
========================================================= */

const state = {

    supabaseClient: null,

    currentUser: null,

    currentProfile: null,

    currentModel: null,

    availableModels: [],

    modelLoaded: false,


    /* =====================================================
       DOM REFERENCES
    ===================================================== */

    elements: {

        /* -------------------------------------------------
           CORE
        ------------------------------------------------- */

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


        /* -------------------------------------------------
           ACCOUNT
        ------------------------------------------------- */

        roleBadge: null,

        creditBadge: null,


        /* -------------------------------------------------
           MODEL CREDIT
        ------------------------------------------------- */

        generateCreditCost: null,

        generateCreditValue: null,


        /* -------------------------------------------------
           RESULT
        ------------------------------------------------- */

        resultModel: null,

        resultProvider: null,

        resultTaskId: null,


        /* -------------------------------------------------
           LEGACY ALIASES
        ------------------------------------------------- */

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

        generateCreditCostEl: null,

        generateCreditValueEl: null,

        resultModelEl: null,

        resultProviderEl: null,

        resultTaskIdEl: null

    }

};


/* =========================================================
   INITIALIZE GENERATE ELEMENTS
========================================================= */

export function initializeGenerateElements() {

    const elementIds = {

        status:
            "status",

        modelSelector:
            "modelSelector",

        modelSelect:
            "modelSelect",

        modelName:
            "modelName",

        modelDescription:
            "modelDescription",

        providerName:
            "providerName",

        modelMeta:
            "modelMeta",

        dynamicFields:
            "dynamicFields",

        generateForm:
            "generateForm",

        generateCard:
            "generateCard",

        generateButton:
            "generateButton",

        resetButton:
            "resetButton",

        loading:
            "loading",

        resultCard:
            "resultCard",

        pageError:
            "pageError",

        pageErrorMessage:
            "pageErrorMessage",

        roleBadge:
            "roleBadge",

        creditBadge:
            "creditBadge",

        generateCreditCost:
            "generateCreditCost",

        generateCreditValue:
            "generateCreditValue",

        resultModel:
            "resultModel",

        resultProvider:
            "resultProvider",

        resultTaskId:
            "resultTaskId"

    };


    /* =====================================================
       FIND DOM ELEMENTS
    ===================================================== */

    Object.entries(
        elementIds
    ).forEach(
        (
            [
                key,
                id
            ]
        ) => {

            state.elements[key] =
                document.getElementById(
                    id
                );

        }
    );


    /* =====================================================
       LEGACY ALIASES
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


    /* =====================================================
       MODEL CREDIT ALIASES
    ===================================================== */

    state.elements.generateCreditCostEl =
        state.elements.generateCreditCost;

    state.elements.generateCreditValueEl =
        state.elements.generateCreditValue;


    /* =====================================================
       RESULT ALIASES
    ===================================================== */

    state.elements.resultModelEl =
        state.elements.resultModel;

    state.elements.resultProviderEl =
        state.elements.resultProvider;

    state.elements.resultTaskIdEl =
        state.elements.resultTaskId;


    /* =====================================================
       DEBUG
    ===================================================== */

    console.debug(
        "[GEN-Z.AI][Generate State] DOM initialized",
        {

            roleBadge:
                Boolean(
                    state.elements.roleBadge
                ),

            creditBadge:
                Boolean(
                    state.elements.creditBadge
                ),

            generateCreditCost:
                Boolean(
                    state.elements.generateCreditCost
                ),

            generateCreditValue:
                Boolean(
                    state.elements.generateCreditValue
                ),

            modelSelect:
                Boolean(
                    state.elements.modelSelect
                ),

            generateForm:
                Boolean(
                    state.elements.generateForm
                )

        }
    );


    return state.elements;

}


/* =========================================================
   VALIDATE DOM
========================================================= */

export function validateGenerateElements() {

    const requiredElements = [

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

        "pageErrorMessage",

        "generateCreditCost",

        "generateCreditValue"

    ];


    const missing =
        requiredElements.filter(
            key =>
                !state.elements[key]
        );


    if (
        missing.length > 0
    ) {

        throw new Error(
            "Elemen Generate tidak lengkap: " +
            missing.join(
                ", "
            )
        );

    }


    return true;

}


/* =========================================================
   SUPABASE CLIENT
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
   CURRENT USER
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
   CURRENT PROFILE
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
   CURRENT MODEL
========================================================= */

export function setCurrentModel(
    model
) {

    state.currentModel =
        model || null;


    const modelId =
        String(
            model?.model_id ??
            ""
        ).trim();


    state.modelLoaded =
        Boolean(
            modelId
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
   FIND AVAILABLE MODEL
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


    if (
        !target
    ) {

        return null;

    }


    return (
        state.availableModels.find(
            model => {

                const currentId =
                    String(
                        model?.model_id ??
                        ""
                    ).trim();


                return (
                    currentId ===
                    target
                );

            }
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

    return Boolean(
        state.modelLoaded
    );

}


/* =========================================================
   MODEL READY
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
   GET DOM ELEMENTS
========================================================= */

export function getGenerateElements() {

    return state.elements;

}


/* =========================================================
   RESET GENERATE STATE
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
