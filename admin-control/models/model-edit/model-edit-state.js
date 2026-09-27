"use strict";

/*
 * ============================================================
 * GEN-Z.AI
 * MODEL EDIT STATE
 *
 * Satu-satunya sumber state untuk halaman Edit Model.
 * Tidak melakukan API request.
 * Tidak melakukan rendering.
 * Tidak melakukan save.
 * ============================================================
 */

const state = {
    currentModel: null,
    currentModelId: "",
    currentDatabaseModel: null,
    saving: false,
    initialized: false
};


/* ============================================================
   DOM
============================================================ */

function getDOM() {

    return {

        /* App */
        app:
            document.querySelector(".app") ||
            document.querySelector("#appShell"),

        /* Navigation */
        sidebar:
            document.querySelector(".sidebar") ||
            document.querySelector("#adminSidebar"),

        sidebarOverlay:
            document.querySelector("#sidebarOverlay"),

        navToggle:
            document.querySelector(".nav-toggle") ||
            document.querySelector("#navToggle"),

        backButton:
            document.querySelector("#backButton"),

        cancelButton:
            document.querySelector("#cancelButton"),

        saveButton:
            document.querySelector("#saveButton"),

        logoutButton:
            document.querySelector("#logoutButton"),


        /* Alert / loading */

        alert:
            document.querySelector("#alertBox"),

        loading:
            document.querySelector("#loadingBox"),

        editContent:
            document.querySelector("#editContent"),


        /* Hero */

        modelHero:
            document.querySelector(".model-hero"),

        heroModelName:
            document.querySelector("#heroModelName"),

        heroModelId:
            document.querySelector("#heroModelId"),


        /* Model information */

        modelName:
            document.querySelector("#modelName"),

        modelId:
            document.querySelector("#modelId"),

        provider:
            document.querySelector("#providerName"),

        type:
            document.querySelector("#modelType"),

        description:
            document.querySelector("#description"),


        /* Status */

        statusToggle:
            document.querySelector("#statusToggle"),

        statusText:
            document.querySelector("#statusText"),


        /* Price */

        priceUsd:
            document.querySelector("#priceUsd"),

        exchangeRate:
            document.querySelector("#exchangeRate"),

        discount:
            document.querySelector("#discount"),


        /* Credit */

        credit480p:
            document.querySelector("#credit480p"),

        credit720p:
            document.querySelector("#credit720p"),

        credit1080p:
            document.querySelector("#credit1080p"),


        /* Technical parameters */

        durationValue:
            document.querySelector("#durationValue"),

        ratioValue:
            document.querySelector("#ratioValue"),

        resolutionValue:
            document.querySelector("#resolutionValue"),


        /* Pricing preview */

        pricingCredit480p:
            document.querySelector(
                "#pricingCredit480p"
            ),

        pricingDiscount480p:
            document.querySelector(
                "#pricingDiscount480p"
            ),

        pricingFinal480p:
            document.querySelector(
                "#pricingFinal480p"
            ),

        pricingCredit720p:
            document.querySelector(
                "#pricingCredit720p"
            ),

        pricingDiscount720p:
            document.querySelector(
                "#pricingDiscount720p"
            ),

        pricingFinal720p:
            document.querySelector(
                "#pricingFinal720p"
            ),

        pricingCredit1080p:
            document.querySelector(
                "#pricingCredit1080p"
            ),

        pricingDiscount1080p:
            document.querySelector(
                "#pricingDiscount1080p"
            ),

        pricingFinal1080p:
            document.querySelector(
                "#pricingFinal1080p"
            )
    };
}


/* ============================================================
   STATE ACCESS
============================================================ */

function getState() {

    return state;
}


function setState(
    patch = {}
) {

    if (
        !patch ||
        typeof patch !== "object"
    ) {

        return state;
    }


    Object.assign(
        state,
        patch
    );


    return state;
}


/* ============================================================
   CURRENT MODEL
============================================================ */

function setCurrentModel(
    model
) {

    state.currentModel =
        model || null;


    return state.currentModel;
}


function getCurrentModel() {

    return state.currentModel;
}


/* ============================================================
   DATABASE MODEL
============================================================ */

function setCurrentDatabaseModel(
    model
) {

    state.currentDatabaseModel =
        model || null;


    return state.currentDatabaseModel;
}


function getCurrentDatabaseModel() {

    return state.currentDatabaseModel;
}


/* ============================================================
   MODEL ID
============================================================ */

function setCurrentModelId(
    modelId
) {

    state.currentModelId =
        String(
            modelId || ""
        ).trim();


    return state.currentModelId;
}


function getCurrentModelId() {

    return state.currentModelId;
}


/* ============================================================
   SAVING
============================================================ */

function setSaving(
    value
) {

    state.saving =
        Boolean(value);


    return state.saving;
}


function isSaving() {

    return state.saving;
}


/* ============================================================
   INITIALIZED
============================================================ */

function setInitialized(
    value
) {

    state.initialized =
        Boolean(value);


    return state.initialized;
}


function isInitialized() {

    return state.initialized;
}


/* ============================================================
   RESET
============================================================ */

function resetState() {

    state.currentModel = null;

    state.currentModelId = "";

    state.currentDatabaseModel = null;

    state.saving = false;

    state.initialized = false;


    return state;
}


/* ============================================================
   PUBLIC API
============================================================ */

const GENZModelEditState =
    Object.freeze({

        state,

        getDOM,

        getState,
        setState,

        setCurrentModel,
        getCurrentModel,

        setCurrentDatabaseModel,
        getCurrentDatabaseModel,

        setCurrentModelId,
        getCurrentModelId,

        setSaving,
        isSaving,

        setInitialized,
        isInitialized,

        resetState
    });


window.GENZModelEditState =
    GENZModelEditState;


/* ============================================================
   ES MODULE EXPORTS
============================================================ */

export {

    state,

    getDOM,

    getState,
    setState,

    setCurrentModel,
    getCurrentModel,

    setCurrentDatabaseModel,
    getCurrentDatabaseModel,

    setCurrentModelId,
    getCurrentModelId,

    setSaving,
    isSaving,

    setInitialized,
    isInitialized,

    resetState
};
