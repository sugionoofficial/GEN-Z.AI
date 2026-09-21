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
   - Preserve model credit configuration when model data
     is merged from list/detail/config sources
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
   MODEL MERGE HELPERS
========================================================= */

/**
 * Merge nested model configuration without destroying
 * data that already exists.
 *
 * Priority:
 * 1. incoming model/detail
 * 2. existing model/list fallback
 *
 * This is intentionally conservative.
 * It does NOT calculate credit here.
 * Credit calculation remains the responsibility of
 * generate-model.js / generate-ui.js.
 */
function mergeModelObjects(
    fallback,
    incoming
) {

    const fallbackObject =
        (
            fallback &&
            typeof fallback === "object" &&
            !Array.isArray(fallback)
        )
            ? fallback
            : {};

    const incomingObject =
        (
            incoming &&
            typeof incoming === "object" &&
            !Array.isArray(incoming)
        )
            ? incoming
            : {};


    const result = {

        ...fallbackObject,

        ...incomingObject

    };


    /* -----------------------------------------------------
       Preserve important nested configuration objects.
    ----------------------------------------------------- */

    const nestedKeys = [

        "pricing",

        "config",

        "model",

        "repository"

    ];


    nestedKeys.forEach(
        key => {

            const fallbackNested =
                fallbackObject[key];

            const incomingNested =
                incomingObject[key];


            const hasFallback =
                (
                    fallbackNested &&
                    typeof fallbackNested === "object" &&
                    !Array.isArray(fallbackNested)
                );


            const hasIncoming =
                (
                    incomingNested &&
                    typeof incomingNested === "object" &&
                    !Array.isArray(incomingNested)
                );


            if (
                hasFallback ||
                hasIncoming
            ) {

                result[key] =
                    mergeModelObjects(
                        hasFallback
                            ? fallbackNested
                            : {},
                        hasIncoming
                            ? incomingNested
                            : {}
                    );

            }

        }
    );


    return result;

}


/**
 * Find a model from the currently available model list.
 */
function findAvailableModelInternal(
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
                        model?.modelId ??
                        model?.id ??
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


/**
 * Resolve model ID from multiple supported structures.
 */
function resolveModelId(
    model
) {

    return String(

        model?.model_id ??

        model?.modelId ??

        model?.id ??

        model?.model?.model_id ??

        model?.model?.modelId ??

        model?.model?.id ??

        ""

    ).trim();

}


/**
 * Preserve the per-resolution credit fields that are stored
 * by Model Edit.
 *
 * This function intentionally does NOT create credit_final_*.
 */
function getCreditSnapshot(
    model
) {

    if (
        !model ||
        typeof model !== "object"
    ) {

        return {

            credit_480p: undefined,

            credit_720p: undefined,

            credit_1080p: undefined,

            discount_percent: undefined

        };

    }


    const sources = [

        model,

        model.pricing,

        model.config,

        model.config?.pricing,

        model.model,

        model.model?.pricing,

        model.repository,

        model.repository?.pricing

    ];


    const result = {

        credit_480p: undefined,

        credit_720p: undefined,

        credit_1080p: undefined,

        discount_percent: undefined

    };


    sources.forEach(
        source => {

            if (
                !source ||
                typeof source !== "object"
            ) {

                return;

            }


            if (
                result.credit_480p === undefined
            ) {

                result.credit_480p =
                    source.credit_480p ??
                    source.credit480p ??
                    source.credit_base_480p ??
                    source.creditBase480p;

            }


            if (
                result.credit_720p === undefined
            ) {

                result.credit_720p =
                    source.credit_720p ??
                    source.credit720p ??
                    source.credit_base_720p ??
                    source.creditBase720p;

            }


            if (
                result.credit_1080p === undefined
            ) {

                result.credit_1080p =
                    source.credit_1080p ??
                    source.credit1080p ??
                    source.credit_base_1080p ??
                    source.creditBase1080p;

            }


            if (
                result.discount_percent === undefined
            ) {

                result.discount_percent =
                    source.discount_percent ??
                    source.discountPercent;

            }

        }
    );


    return result;

}


/**
 * Attach missing credit fields to the top-level model only when
 * they are absent.
 *
 * Incoming/detail data always has priority.
 */
function preserveModelCreditFields(
    fallbackModel,
    incomingModel,
    mergedModel
) {

    const fallbackCredit =
        getCreditSnapshot(
            fallbackModel
        );


    const incomingCredit =
        getCreditSnapshot(
            incomingModel
        );


    const currentCredit =
        getCreditSnapshot(
            mergedModel
        );


    const finalModel =
        {
            ...mergedModel
        };


    const fields = [

        "credit_480p",

        "credit_720p",

        "credit_1080p",

        "discount_percent"

    ];


    fields.forEach(
        field => {

            /*
             * First priority:
             * value already present in incoming/merged model.
             */
            if (
                currentCredit[field] !== undefined &&
                currentCredit[field] !== null &&
                currentCredit[field] !== ""
            ) {

                return;

            }


            /*
             * Second priority:
             * value from incoming nested configuration.
             */
            if (
                incomingCredit[field] !== undefined &&
                incomingCredit[field] !== null &&
                incomingCredit[field] !== ""
            ) {

                finalModel[field] =
                    incomingCredit[field];

                return;

            }


            /*
             * Third priority:
             * value from available model list.
             */
            if (
                fallbackCredit[field] !== undefined &&
                fallbackCredit[field] !== null &&
                fallbackCredit[field] !== ""
            ) {

                finalModel[field] =
                    fallbackCredit[field];

            }

        }
    );


    return finalModel;

}


/**
 * Build the final current-model state object.
 *
 * Important:
 * This function only preserves/merges data.
 * It does NOT calculate discounted credit.
 */
function buildCurrentModel(
    incomingModel
) {

    if (
        !incomingModel ||
        typeof incomingModel !== "object"
    ) {

        return null;

    }


    const modelId =
        resolveModelId(
            incomingModel
        );


    const availableModel =
        findAvailableModelInternal(
            modelId
        );


    /*
     * Available model acts only as fallback.
     * Incoming detail/config remains authoritative.
     */
    let mergedModel =
        mergeModelObjects(
            availableModel || {},
            incomingModel
        );


    /*
     * Explicitly preserve per-resolution credit fields.
     */
    mergedModel =
        preserveModelCreditFields(
            availableModel,
            incomingModel,
            mergedModel
        );


    /*
     * Normalize model_id only if the incoming model did not
     * already expose it at the top level.
     */
    if (
        !mergedModel.model_id &&
        modelId
    ) {

        mergedModel.model_id =
            modelId;

    }


    return mergedModel;

}


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

    const normalizedModel =
        buildCurrentModel(
            model
        );


    state.currentModel =
        normalizedModel;


    const modelId =
        resolveModelId(
            normalizedModel
        );


    state.modelLoaded =
        Boolean(
            modelId
        );


    /*
     * CREDIT DEBUG
     *
     * This lets us verify exactly what reaches Generate UI.
     * No calculation is performed here.
     */
    const creditSnapshot =
        getCreditSnapshot(
            normalizedModel
        );


    console.debug(
        "[GEN-Z.AI][Generate State] CURRENT MODEL SET",
        {

            modelId,

            credit_480p:
                creditSnapshot.credit_480p,

            credit_720p:
                creditSnapshot.credit_720p,

            credit_1080p:
                creditSnapshot.credit_1080p,

            discount_percent:
                creditSnapshot.discount_percent,

            modelLoaded:
                state.modelLoaded

        }
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


    /*
     * If a current model already exists, refresh it using the
     * newly available model list as fallback data.
     *
     * This is important when the model list finishes loading
     * after the current model was initially selected.
     */
    if (
        state.currentModel
    ) {

        const currentModelId =
            resolveModelId(
                state.currentModel
            );


        if (
            currentModelId
        ) {

            const availableModel =
                findAvailableModelInternal(
                    currentModelId
                );


            if (
                availableModel
            ) {

                state.currentModel =
                    buildCurrentModel(
                        state.currentModel
                    );

            }

        }

    }


    console.debug(
        "[GEN-Z.AI][Generate State] AVAILABLE MODELS SET",
        {

            count:
                state.availableModels.length

        }
    );


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

    return findAvailableModelInternal(
        modelId
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
        resolveModelId(
            model
        );


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
