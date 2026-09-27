"use strict";

/*
 * ============================================================
 * GEN-Z.AI
 * MODEL EDIT STATE
 *
 * Tanggung jawab:
 * - Menyimpan state halaman Edit Model
 * - Menyimpan referensi DOM
 * - Menyediakan akses state untuk module lain
 *
 * Tidak melakukan:
 * - API request
 * - Render
 * - Save
 * - Registry loading
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
   DOM REFERENCES
============================================================ */

function getDOM() {

    return {

        app:
            document.querySelector(".app"),

        sidebar:
            document.querySelector(".sidebar"),

        sidebarOverlay:
            document.querySelector(".sidebar-overlay"),

        navToggle:
            document.querySelector(".nav-toggle"),

        backButton:
            document.querySelector(".back-button"),

        cancelButton:
            document.querySelector(
                "#cancelButton"
            ),

        saveButton:
            document.querySelector(
                "#saveButton"
            ),

        logoutButton:
            document.querySelector(
                "#logoutButton"
            ),

        alert:
            document.querySelector(
                "#alert"
            ),

        loading:
            document.querySelector(
                "#loading"
            ),

        loadingText:
            document.querySelector(
                "#loadingText"
            ),

        modelHero:
            document.querySelector(
                ".model-hero"
            ),

        heroModelName:
            document.querySelector(
                "#heroModelName"
            ),

        heroModelId:
            document.querySelector(
                "#heroModelId"
            ),

        heroProvider:
            document.querySelector(
                "#heroProvider"
            ),

        heroType:
            document.querySelector(
                "#heroType"
            ),

        modelName:
            document.querySelector(
                "#modelName"
            ),

        modelId:
            document.querySelector(
                "#modelId"
            ),

        provider:
            document.querySelector(
                "#provider"
            ),

        type:
            document.querySelector(
                "#type"
            ),

        description:
            document.querySelector(
                "#description"
            ),

        statusToggle:
            document.querySelector(
                "#statusToggle"
            ),

        statusText:
            document.querySelector(
                "#statusText"
            ),

        statusDescription:
            document.querySelector(
                "#statusDescription"
            ),

        priceUsd:
            document.querySelector(
                "#priceUsd"
            ),

        exchangeRate:
            document.querySelector(
                "#exchangeRate"
            ),

        discount:
            document.querySelector(
                "#discount"
            ),

        credit480p:
            document.querySelector(
                "#credit480p"
            ),

        credit720p:
            document.querySelector(
                "#credit720p"
            ),

        credit1080p:
            document.querySelector(
                "#credit1080p"
            ),

        finalPrice:
            document.querySelector(
                "#finalPrice"
            ),

        duration:
            document.querySelector(
                "#duration"
            ),

        ratio:
            document.querySelector(
                "#ratio"
            ),

        resolution:
            document.querySelector(
                "#resolution"
            )
    };
}


/* ============================================================
   STATE ACCESS
============================================================ */

function getState() {

    return state;
}


function setState(patch = {}) {

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
   MODEL
============================================================ */

function setCurrentModel(model) {

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
   SAVING STATE
============================================================ */

function setSaving(value) {

    state.saving =
        Boolean(value);

    return state.saving;
}


function isSaving() {

    return state.saving;
}


/* ============================================================
   INITIALIZATION
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


/*
 * Global bridge.
 *
 * Module lain dapat menggunakan:
 *
 * window.GENZModelEditState
 */

window.GENZModelEditState =
    GENZModelEditState;


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
