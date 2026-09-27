"use strict";

/*
 * ============================================================
 * GEN-Z.AI
 * MODEL EDIT APP
 *
 * Tanggung jawab:
 * - Bootstrap halaman
 * - Auth check
 * - Load model
 * - Bind event
 * - Save
 * - Back
 * - Logout
 * - Sidebar
 *
 * Tidak melakukan:
 * - API request langsung
 * - Render model
 * - PATCH langsung
 * ============================================================
 */

import {
    getDOM,
    getState,
    setInitialized,
    resetState
} from "./model-edit-state.js";

import {
    loadModel
} from "./model-edit-loader.js";

import {
    saveModel
} from "./model-edit-save.js";

import {
    renderLoading,
    renderError,
    clearAlert,
    updateResolutionPricing,
    updatePricePreview
} from "./model-edit-render.js";


/* ============================================================
   SUPABASE
============================================================ */

function getSupabase() {

    return (
        window.GENZ_SUPABASE ||
        window.supabaseClient ||
        null
    );
}


/* ============================================================
   SESSION
============================================================ */

async function getSession() {

    const supabase =
        getSupabase();


    if (!supabase) {

        return null;
    }


    try {

        const {
            data,
            error
        } =
        await supabase.auth.getSession();


        if (error) {

            console.warn(
                "GEN-Z.AI model-edit session warning:",
                error
            );

            return null;
        }


        return (
            data?.session ||
            null
        );

    } catch (error) {

        console.warn(
            "GEN-Z.AI model-edit session error:",
            error
        );

        return null;
    }
}


/* ============================================================
   AUTH CHECK
============================================================ */

async function checkAdminAccess() {

    const session =
        await getSession();


    if (!session) {

        throw new Error(
            "Sesi login tidak ditemukan. Silakan login kembali."
        );
    }


    if (!session.user) {

        throw new Error(
            "Data user tidak ditemukan."
        );
    }


    return session.user;
}


/* ============================================================
   BACK
============================================================ */

function goBack() {

    if (
        document.referrer &&
        document.referrer.includes(
            window.location.host
        )
    ) {

        window.history.back();

        return;
    }


    window.location.href =
        "./models.html";
}


/* ============================================================
   LOGOUT
============================================================ */

async function logout() {

    const supabase =
        getSupabase();


    try {

        if (supabase) {

            await supabase.auth.signOut();
        }

    } catch (error) {

        console.warn(
            "GEN-Z.AI logout warning:",
            error
        );

    } finally {

        window.location.href =
            "../index.html";
    }
}


/* ============================================================
   SIDEBAR
============================================================ */

function openSidebar() {

    const dom =
        getDOM();


    dom.sidebar?.classList.add(
        "active"
    );


    dom.sidebarOverlay?.classList.add(
        "active"
    );


    document.body.classList.add(
        "sidebar-open"
    );
}


function closeSidebar() {

    const dom =
        getDOM();


    dom.sidebar?.classList.remove(
        "active"
    );


    dom.sidebarOverlay?.classList.remove(
        "active"
    );


    document.body.classList.remove(
        "sidebar-open"
    );
}


function toggleSidebar() {

    const dom =
        getDOM();


    if (
        dom.sidebar?.classList.contains(
            "active"
        )
    ) {

        closeSidebar();

    } else {

        openSidebar();
    }
}


/* ============================================================
   SAVE
============================================================ */

async function handleSave(
    event
) {

    if (event) {

        event.preventDefault();
    }


    try {

        await saveModel();

    } catch (error) {

        console.error(
            "GEN-Z.AI model-edit save error:",
            error
        );
    }
}


/* ============================================================
   CANCEL / BACK
============================================================ */

function handleCancel(
    event
) {

    if (event) {

        event.preventDefault();
    }


    goBack();
}


function handleBack(
    event
) {

    if (event) {

        event.preventDefault();
    }


    goBack();
}


/* ============================================================
   LOGOUT
============================================================ */

async function handleLogout(
    event
) {

    if (event) {

        event.preventDefault();
    }


    await logout();
}


/* ============================================================
   PRICING EVENTS
============================================================ */

function bindPricingEvents() {

    const dom =
        getDOM();


    /*
     * Discount dan credit hanya memengaruhi
     * preview pricing di halaman.
     */

    [
        dom.discount,
        dom.credit480p,
        dom.credit720p,
        dom.credit1080p
    ]
    .filter(Boolean)
    .forEach(
        element => {

            element.addEventListener(
                "input",
                () => {

                    updateResolutionPricing();

                    updatePricePreview();
                }
            );

            element.addEventListener(
                "change",
                () => {

                    updateResolutionPricing();

                    updatePricePreview();
                }
            );
        }
    );


    /*
     * Kurs / USD price.
     */

    [
        dom.priceUsd,
        dom.exchangeRate
    ]
    .filter(Boolean)
    .forEach(
        element => {

            element.addEventListener(
                "input",
                () => {

                    updatePricePreview();
                }
            );

            element.addEventListener(
                "change",
                () => {

                    updatePricePreview();
                }
            );
        }
    );
}


/* ============================================================
   BUTTON EVENTS
============================================================ */

function bindButtonEvents() {

    const dom =
        getDOM();


    if (
        dom.saveButton &&
        dom.saveButton.dataset
            .modelEditBound !==
        "true"
    ) {

        dom.saveButton.addEventListener(
            "click",
            handleSave
        );

        dom.saveButton.dataset
            .modelEditBound =
                "true";
    }


    if (
        dom.cancelButton &&
        dom.cancelButton.dataset
            .modelEditBound !==
        "true"
    ) {

        dom.cancelButton.addEventListener(
            "click",
            handleCancel
        );

        dom.cancelButton.dataset
            .modelEditBound =
                "true";
    }


    if (
        dom.backButton &&
        dom.backButton.dataset
            .modelEditBound !==
        "true"
    ) {

        dom.backButton.addEventListener(
            "click",
            handleBack
        );

        dom.backButton.dataset
            .modelEditBound =
                "true";
    }


    if (
        dom.logoutButton &&
        dom.logoutButton.dataset
            .modelEditBound !==
        "true"
    ) {

        dom.logoutButton.addEventListener(
            "click",
            handleLogout
        );

        dom.logoutButton.dataset
            .modelEditBound =
                "true";
    }
}


/* ============================================================
   SIDEBAR EVENTS
============================================================ */

function bindSidebarEvents() {

    const dom =
        getDOM();


    if (
        dom.navToggle &&
        dom.navToggle.dataset
            .modelEditBound !==
        "true"
    ) {

        dom.navToggle.addEventListener(
            "click",
            toggleSidebar
        );

        dom.navToggle.dataset
            .modelEditBound =
                "true";
    }


    if (
        dom.sidebarOverlay &&
        dom.sidebarOverlay.dataset
            .modelEditBound !==
        "true"
    ) {

        dom.sidebarOverlay.addEventListener(
            "click",
            closeSidebar
        );

        dom.sidebarOverlay.dataset
            .modelEditBound =
                "true";
    }


    if (
        dom.sidebar &&
        dom.sidebar.dataset
            .modelEditBound !==
        "true"
    ) {

        dom.sidebar.addEventListener(
            "click",
            event => {

                const link =
                    event.target.closest(
                        "a"
                    );


                if (link) {

                    closeSidebar();
                }
            }
        );


        dom.sidebar.dataset
            .modelEditBound =
                "true";
    }
}


/* ============================================================
   KEYBOARD
============================================================ */

function bindKeyboard() {

    if (
        document.body.dataset
            .modelEditKeyboardBound ===
        "true"
    ) {

        return;
    }


    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key ===
                "Escape"
            ) {

                closeSidebar();
            }
        }
    );


    document.body.dataset
        .modelEditKeyboardBound =
            "true";
}


/* ============================================================
   ALERT
============================================================ */

function bindAlert() {

    const dom =
        getDOM();


    if (
        !dom.alert ||
        dom.alert.dataset
            .modelEditBound ===
        "true"
    ) {

        return;
    }


    dom.alert.addEventListener(
        "click",
        event => {

            const dismiss =
                event.target.closest(
                    "[data-dismiss-alert]"
                );


            if (
                dismiss
            ) {

                clearAlert();
            }
        }
    );


    dom.alert.dataset
        .modelEditBound =
            "true";
}


/* ============================================================
   ALL EVENTS
============================================================ */

function bindEvents() {

    bindButtonEvents();

    bindPricingEvents();

    bindSidebarEvents();

    bindKeyboard();

    bindAlert();
}


/* ============================================================
   INITIALIZE
============================================================ */

async function initialize() {

    const state =
        getState();


    if (
        state.initialized
    ) {

        return state;
    }


    const dom =
        getDOM();


    if (!dom.app) {

        throw new Error(
            "Root halaman Model Edit tidak ditemukan."
        );
    }


    try {

        renderLoading(
            true
        );


        /*
         * Auth
         */

        await checkAdminAccess();


        /*
         * Events
         */

        bindEvents();


        /*
         * Model
         */

        await loadModel();


        setInitialized(
            true
        );


        return getState();

    } catch (error) {

        renderLoading(
            false
        );


        renderError(
            error?.message ||
            "Halaman Edit Model gagal dimuat."
        );


        throw error;
    }
}


/* ============================================================
   DESTROY
============================================================ */

function destroy() {

    resetState();
}


/* ============================================================
   BOOTSTRAP
============================================================ */

async function bootstrap() {

    try {

        await initialize();

    } catch (error) {

        console.error(
            "GEN-Z.AI model-edit bootstrap error:",
            error
        );
    }
}


/* ============================================================
   PUBLIC API
============================================================ */

const GENZModelEditApp =
    Object.freeze({

        initialize,

        bootstrap,

        destroy,

        getSupabase,

        getSession,

        checkAdminAccess,

        goBack,

        logout,

        openSidebar,

        closeSidebar,

        toggleSidebar,

        bindEvents,

        handleSave,

        handleCancel,

        handleBack,

        handleLogout
    });


window.GENZModelEditApp =
    GENZModelEditApp;


export {

    initialize,

    bootstrap,

    destroy,

    getSupabase,

    getSession,

    checkAdminAccess,

    goBack,

    logout,

    openSidebar,

    closeSidebar,

    toggleSidebar,

    bindEvents,

    handleSave,

    handleCancel,

    handleBack,

    handleLogout
};


/* ============================================================
   AUTO START
============================================================ */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        bootstrap,
        {
            once: true
        }
    );

} else {

    bootstrap();
}
