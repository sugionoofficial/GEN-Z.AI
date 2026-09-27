"use strict";

/*
 * ============================================================
 * GEN-Z.AI
 * MODEL EDIT APP
 *
 * Tanggung jawab:
 * - Bootstrap halaman
 * - Menunggu DOM
 * - Load model
 * - Bind event
 * - Save
 * - Cancel / Back
 * - Logout
 * - Sidebar mobile
 *
 * Tidak melakukan:
 * - Query API langsung
 * - Render detail model
 * - Logika PATCH
 * - Registry loading
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
    clearAlert
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
   AUTH TOKEN
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
   ADMIN ACCESS CHECK
============================================================ */

async function checkAdminAccess() {

    const session =
        await getSession();


    if (!session) {

        throw new Error(
            "Sesi login tidak ditemukan. Silakan login kembali."
        );
    }


    const user =
        session.user;


    if (!user) {

        throw new Error(
            "Data user tidak ditemukan."
        );
    }


    /*
     * Jangan memblokir halaman hanya berdasarkan
     * field role tertentu di client.
     *
     * API tetap menjadi authority untuk permission.
     */

    return user;
}


/* ============================================================
   NAVIGATION
============================================================ */

function goBack() {

    if (
        window.history.length > 1
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
   SAVE HANDLER
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
   CANCEL HANDLER
============================================================ */

function handleCancel(
    event
) {

    if (event) {

        event.preventDefault();
    }


    goBack();
}


/* ============================================================
   BACK HANDLER
============================================================ */

function handleBack(
    event
) {

    if (event) {

        event.preventDefault();
    }


    goBack();
}


/* ============================================================
   LOGOUT HANDLER
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
   SIDEBAR NAVIGATION
============================================================ */

function bindNavigation() {

    const dom =
        getDOM();


    dom.backButton?.addEventListener(
        "click",
        handleBack
    );


    dom.cancelButton?.addEventListener(
        "click",
        handleCancel
    );


    dom.logoutButton?.addEventListener(
        "click",
        handleLogout
    );


    dom.navToggle?.addEventListener(
        "click",
        toggleSidebar
    );


    dom.sidebarOverlay?.addEventListener(
        "click",
        closeSidebar
    );
}


/* ============================================================
   SAVE BUTTON
============================================================ */

function bindSave() {

    const dom =
        getDOM();


    dom.saveButton?.addEventListener(
        "click",
        handleSave
    );
}


/* ============================================================
   FORM SUBMIT
============================================================ */

function bindFormSubmit() {

    /*
     * Jangan bergantung hanya pada tombol Save.
     * Jika halaman memiliki form, Enter juga harus
     * menjalankan save.
     */

    const form =
        document.querySelector(
            "form"
        );


    if (!form) {

        return;
    }


    form.addEventListener(
        "submit",
        handleSave
    );
}


/* ============================================================
   ALERT CLEAR
============================================================ */

function bindAlertDismiss() {

    const dom =
        getDOM();


    if (!dom.alert) {

        return;
    }


    dom.alert.addEventListener(
        "click",
        event => {

            const target =
                event.target;


            if (
                target?.closest(
                    "[data-dismiss-alert]"
                )
            ) {

                clearAlert();
            }
        }
    );
}


/* ============================================================
   MOBILE SIDEBAR LINKS
============================================================ */

function bindSidebarLinks() {

    const dom =
        getDOM();


    if (!dom.sidebar) {

        return;
    }


    dom.sidebar.addEventListener(
        "click",
        event => {

            const link =
                event.target.closest(
                    "a"
                );


            if (!link) {

                return;
            }


            closeSidebar();
        }
    );
}


/* ============================================================
   KEYBOARD
============================================================ */

function bindKeyboard() {

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
}


/* ============================================================
   BIND EVENTS
============================================================ */

function bindEvents() {

    bindNavigation();

    bindSave();

    bindFormSubmit();

    bindAlertDismiss();

    bindSidebarLinks();

    bindKeyboard();
}


/* ============================================================
   LOAD PAGE
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
            true,
            "Memuat data model..."
        );


        /*
         * Auth diperiksa lebih dulu.
         */

        await checkAdminAccess();


        /*
         * Bind event satu kali.
         */

        bindEvents();


        /*
         * Load model.
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
   AUTO BOOTSTRAP
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
   START
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
