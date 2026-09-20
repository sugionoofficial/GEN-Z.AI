/* =========================================================
   GEN-Z.AI
   GENERATE APP MODULE
   ---------------------------------------------------------
   File:
   generate/assets/js/generate-app.js

   RESPONSIBILITY:
   - Bootstrap Generate
   - DOM initialization
   - Authentication
   - Profile
   - Role
   - Account Credit
   - Model
   - Model Credit
   - Form
   - Generate Request
   - Polling
   - Reset

   SOURCE OF TRUTH:
   - Auth           -> Supabase Auth / Shared Navigation
   - Role           -> profiles.role
   - Account Credit -> profiles.credits
   - Model          -> generate-model.js / /api/model-config
   - Model Credit   -> models.credit_final

   IMPORTANT:
   - AUTH tidak bergantung pada MODEL
   - PROFILE tidak bergantung pada FORM
   - ROLE tidak bergantung pada MODEL
   - ACCOUNT CREDIT tidak bergantung pada MODEL
   - MODEL ERROR tidak menghapus AUTH
   - FORM ERROR tidak menghapus AUTH
   - FORM ERROR tidak menghapus MODEL
========================================================= */

"use strict";


/* =========================================================
   APPLICATION STATE
========================================================= */

const appState = {

    initialized:
        false,

    initializing:
        false,

    submitting:
        false,

    polling:
        false,

    eventsBound:
        false,

    authReady:
        false,

    profileReady:
        false,

    modelReady:
        false,

    currentTaskId:
        null,

    pollingStartedAt:
        null,

    modules: {

        state:
            null,

        auth:
            null,

        ui:
            null,

        model:
            null,

        form:
            null,

        validation:
            null,

        request:
            null,

        polling:
            null

    }

};


/* =========================================================
   CONFIG
========================================================= */

const CACHE_VERSION =
    "20260921-generate-bootstrap3";

const POLLING_INTERVAL =
    3000;

const POLLING_TIMEOUT =
    10 * 60 * 1000;


/* =========================================================
   DIRECT DOM
========================================================= */

function directElement(id) {

    try {

        return document.getElementById(id);

    } catch {

        return null;

    }

}


function directElements() {

    return {

        status:
            directElement("status"),

        modelSelector:
            directElement("modelSelector"),

        modelSelect:
            directElement("modelSelect"),

        modelName:
            directElement("modelName"),

        modelDescription:
            directElement("modelDescription"),

        providerName:
            directElement("providerName"),

        modelMeta:
            directElement("modelMeta"),

        dynamicFields:
            directElement("dynamicFields"),

        generateForm:
            directElement("generateForm"),

        generateCard:
            directElement("generateCard"),

        generateButton:
            directElement("generateButton"),

        resetButton:
            directElement("resetButton"),

        loading:
            directElement("loading"),

        resultCard:
            directElement("resultCard"),

        pageError:
            directElement("pageError"),

        pageErrorMessage:
            directElement("pageErrorMessage"),

        roleBadge:
            directElement("roleBadge"),

        creditBadge:
            directElement("creditBadge"),

        generateCreditCost:
            directElement("generateCreditCost"),

        generateCreditValue:
            directElement("generateCreditValue"),

        resultModel:
            directElement("resultModel"),

        resultProvider:
            directElement("resultProvider"),

        resultTaskId:
            directElement("resultTaskId")

    };

}


/* =========================================================
   MODULE LOADER
========================================================= */

async function loadModule(name, path) {

    if (appState.modules[name]) {

        return appState.modules[name];

    }


    try {

        const module =
            await import(path);


        if (
            !module ||
            typeof module !== "object"
        ) {

            throw new Error(
                `Module ${name} tidak menghasilkan export yang valid.`
            );

        }


        appState.modules[name] =
            module;


        console.log(
            `[GEN-Z.AI][Generate] Module ${name} loaded.`
        );


        return module;

    } catch (error) {

        console.error(
            `[GEN-Z.AI][Generate] Module ${name} gagal dimuat:`,
            error
        );


        throw new Error(
            `Module Generate "${name}" gagal dimuat: ${
                error?.message ||
                String(error)
            }`
        );

    }

}


/* =========================================================
   OPTIONAL MODULE
========================================================= */

async function loadOptionalModule(name, path) {

    try {

        return await loadModule(
            name,
            path
        );

    } catch (error) {

        console.error(
            `[GEN-Z.AI][Generate] Optional module "${name}" gagal:`,
            error
        );


        return null;

    }

}


/* =========================================================
   CURRENT PROFILE
========================================================= */

function getCurrentProfile() {

    const state =
        appState.modules.state;


    if (
        state &&
        typeof state.getCurrentProfile ===
            "function"
    ) {

        try {

            const profile =
                state.getCurrentProfile();


            if (profile) {

                return profile;

            }

        } catch {

            /* fallback */

        }

    }


    return (
        window.GENZ_CURRENT_PROFILE ||
        window.GENZ_NAVIGATION_PROFILE ||
        null
    );

}


/* =========================================================
   CURRENT USER
========================================================= */

function getCurrentUser() {

    const state =
        appState.modules.state;


    if (
        state &&
        typeof state.getCurrentUser ===
            "function"
    ) {

        try {

            const user =
                state.getCurrentUser();


            if (user) {

                return user;

            }

        } catch {

            /* fallback */

        }

    }


    return (
        window.GENZ_CURRENT_USER ||
        window.GENZ_NAVIGATION_USER ||
        null
    );

}


/* =========================================================
   CURRENT MODEL
========================================================= */

function getCurrentModel() {

    const state =
        appState.modules.state;


    if (
        state &&
        typeof state.getCurrentModel ===
            "function"
    ) {

        try {

            const model =
                state.getCurrentModel();


            if (model) {

                return model;

            }

        } catch {

            /* fallback */

        }

    }


    return null;

}


/* =========================================================
   MODEL READY
========================================================= */

function isCurrentModelReady() {

    const state =
        appState.modules.state;


    if (
        state &&
        typeof state.isModelReady ===
            "function"
    ) {

        try {

            return Boolean(
                state.isModelReady()
            );

        } catch {

            /* fallback */

        }

    }


    const model =
        getCurrentModel();


    return Boolean(
        String(
            model?.model_id ||
            ""
        ).trim()
    );

}


/* =========================================================
   ROLE
========================================================= */

function normalizeRole(role) {

    return String(
        role ?? ""
    )
        .trim()
        .toUpperCase();

}


/* =========================================================
   CREDIT FORMAT
========================================================= */

function formatCredit(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return "-";

    }


    const numeric =
        Number(value);


    if (
        Number.isFinite(numeric)
    ) {

        return new Intl.NumberFormat(
            "id-ID",
            {
                maximumFractionDigits:
                    2
            }
        ).format(numeric);

    }


    return String(value);

}


/* =========================================================
   ACCOUNT CREDIT
   ---------------------------------------------------------
   SOURCE:
   profiles.credits
========================================================= */

function renderAccountCreditDirect(profile) {

    const badge =
        directElement("creditBadge");


    if (!badge) {

        console.warn(
            "[GEN-Z.AI][Generate] #creditBadge tidak ditemukan."
        );

        return false;

    }


    badge.textContent =
        `Credit: ${formatCredit(
            profile?.credits
        )}`;


    badge.hidden =
        false;

    badge.removeAttribute("hidden");

    badge.style.display =
        "";

    badge.style.visibility =
        "visible";

    badge.style.opacity =
        "1";


    return true;

}


/* =========================================================
   ROLE BADGE
========================================================= */

function renderRoleDirect(profile) {

    const badge =
        directElement("roleBadge");


    if (!badge) {

        console.warn(
            "[GEN-Z.AI][Generate] #roleBadge tidak ditemukan."
        );

        return false;

    }


    const role =
        normalizeRole(
            profile?.role
        );


    badge.textContent =
        role || "-";


    badge.hidden =
        false;

    badge.removeAttribute("hidden");

    badge.style.display =
        "";

    badge.style.visibility =
        "visible";

    badge.style.opacity =
        "1";


    if (role) {

        badge.dataset.role =
            role;

    }


    return Boolean(role);

}


/* =========================================================
   AUTH BADGES
========================================================= */

function renderAuthBadgesDirect(profile) {

    if (
        !profile ||
        typeof profile !== "object"
    ) {

        return false;

    }


    /*
     * Direct render FIRST.
     * Tidak bergantung kepada UI module.
     */

    renderRoleDirect(
        profile
    );


    renderAccountCreditDirect(
        profile
    );


    /*
     * UI module hanya compatibility.
     */

    const ui =
        appState.modules.ui;


    if (
        ui &&
        typeof ui.renderAuthBadges ===
            "function"
    ) {

        try {

            ui.renderAuthBadges(
                profile
            );

        } catch (error) {

            console.warn(
                "[GEN-Z.AI][Generate] UI auth badge gagal:",
                error
            );

        }

    }


    /*
     * FINAL DIRECT RENDER.
     * Mencegah UI module mengosongkan badge.
     */

    renderRoleDirect(
        profile
    );


    renderAccountCreditDirect(
        profile
    );


    return true;

}


/* =========================================================
   MODEL CREDIT
========================================================= */

function getModelCredit(model) {

    if (
        !model ||
        typeof model !== "object"
    ) {

        return null;

    }


    const candidates = [

        model?.pricing?.credit_final,

        model?.credit_final,

        model?.pricing?.credit_cost,

        model?.credit_cost

    ];


    for (
        const candidate of candidates
    ) {

        if (
            candidate === null ||
            candidate === undefined ||
            candidate === ""
        ) {

            continue;

        }


        const numeric =
            Number(candidate);


        if (
            Number.isFinite(numeric)
        ) {

            return numeric;

        }


        const text =
            String(candidate).trim();


        if (text) {

            return text;

        }

    }


    return null;

}


/* =========================================================
   MODEL CREDIT RENDER
========================================================= */

function renderModelCreditDirect(model) {

    const container =
        directElement(
            "generateCreditCost"
        );

    const value =
        directElement(
            "generateCreditValue"
        );


    if (!value) {

        console.warn(
            "[GEN-Z.AI][Generate] #generateCreditValue tidak ditemukan."
        );

        return false;

    }


    const credit =
        getModelCredit(model);


    value.textContent =
        credit === null
            ? "-- Credit"
            : `${formatCredit(
                credit
            )} Credit`;


    value.hidden =
        false;

    value.removeAttribute("hidden");

    value.style.display =
        "";

    value.style.visibility =
        "visible";

    value.style.opacity =
        "1";


    if (container) {

        container.hidden =
            false;

        container.removeAttribute(
            "hidden"
        );

        container.style.display =
            "inline-flex";

        container.style.visibility =
            "visible";

        container.style.opacity =
            "1";

    }


    /*
     * UI compatibility.
     */

    const ui =
        appState.modules.ui;


    if (
        ui &&
        typeof ui.renderModelCredit ===
            "function"
    ) {

        try {

            ui.renderModelCredit(
                model
            );

        } catch (error) {

            console.warn(
                "[GEN-Z.AI][Generate] UI model credit gagal:",
                error
            );

        }

    }


    /*
     * Final direct render.
     */

    const finalCredit =
        getModelCredit(model);


    value.textContent =
        finalCredit === null
            ? "-- Credit"
            : `${formatCredit(
                finalCredit
            )} Credit`;


    value.hidden =
        false;

    value.removeAttribute("hidden");

    value.style.display =
        "";

    value.style.visibility =
        "visible";

    value.style.opacity =
        "1";


    if (container) {

        container.hidden =
            false;

        container.removeAttribute(
            "hidden"
        );

        container.style.display =
            "inline-flex";

        container.style.visibility =
            "visible";

        container.style.opacity =
            "1";

    }


    return true;

}


/* =========================================================
   MODEL HEADER
========================================================= */

function renderModelHeaderSafe(model) {

    const ui =
        appState.modules.ui;


    if (
        ui &&
        typeof ui.renderModelHeader ===
            "function"
    ) {

        try {

            ui.renderModelHeader(
                model
            );

        } catch (error) {

            console.warn(
                "[GEN-Z.AI][Generate] Model header gagal:",
                error
            );

        }

    }


    renderModelCreditDirect(
        model
    );

}


/* =========================================================
   STATUS
========================================================= */

function showStatus(
    message,
    type = "info"
) {

    const ui =
        appState.modules.ui;


    if (
        ui &&
        typeof ui.showStatus ===
            "function"
    ) {

        try {

            ui.showStatus(
                message,
                type
            );

        } catch {

            /* direct fallback */

        }

    }


    const status =
        directElement("status");


    if (status) {

        status.hidden =
            false;

        status.removeAttribute(
            "hidden"
        );

        status.style.display =
            "";

        status.textContent =
            String(
                message || ""
            );

        status.dataset.type =
            type;

    }

}


/* =========================================================
   HIDE STATUS
========================================================= */

function hideStatus() {

    const ui =
        appState.modules.ui;


    if (
        ui &&
        typeof ui.hideStatus ===
            "function"
    ) {

        try {

            ui.hideStatus();

        } catch {

            /* ignore */

        }

    }


    const status =
        directElement("status");


    if (status) {

        status.hidden =
            true;

    }

}


/* =========================================================
   DIRECT ERROR
========================================================= */

function showDirectError(message) {

    const text =
        String(
            message ||
            "Generate gagal diinisialisasi."
        );


    const pageError =
        directElement(
            "pageError"
        );

    const pageErrorMessage =
        directElement(
            "pageErrorMessage"
        );

    const status =
        directElement(
            "status"
        );


    if (pageErrorMessage) {

        pageErrorMessage.textContent =
            text;

    }


    if (pageError) {

        pageError.hidden =
            false;

        pageError.removeAttribute(
            "hidden"
        );

        pageError.style.display =
            "";

        pageError.classList.add(
            "is-error"
        );

    }


    if (status) {

        status.hidden =
            false;

        status.removeAttribute(
            "hidden"
        );

        status.style.display =
            "";

        status.textContent =
            text;

        status.dataset.type =
            "error";

        status.classList.add(
            "is-error"
        );

    }


    console.error(
        "[GEN-Z.AI][Generate] ERROR:",
        text
    );

}


function hideDirectError() {

    const pageError =
        directElement(
            "pageError"
        );


    if (pageError) {

        pageError.hidden =
            true;

        pageError.classList.remove(
            "is-error"
        );

    }


    const status =
        directElement(
            "status"
        );


    if (status) {

        status.classList.remove(
            "is-error"
        );

    }

}


/* =========================================================
   ERROR
========================================================= */

function showError(
    error,
    fallback = "Terjadi kesalahan."
) {

    const message =
        error?.message ||
        String(
            error ||
            fallback
        );


    const ui =
        appState.modules.ui;


    if (
        ui &&
        typeof ui.showError ===
            "function"
    ) {

        try {

            ui.showError(
                error,
                fallback
            );

        } catch {

            /* direct fallback */

        }

    }


    showDirectError(
        message
    );

}


/* =========================================================
   PAGE ERROR
========================================================= */

function showPageError(message) {

    showDirectError(
        message
    );

}


/* =========================================================
   INITIALIZE DOM
========================================================= */

async function initializeDOM() {

    const state =
        appState.modules.state;


    if (
        state &&
        typeof state.initializeGenerateElements ===
            "function"
    ) {

        try {

            state.initializeGenerateElements();

        } catch (error) {

            console.warn(
                "[GEN-Z.AI][Generate] State DOM initialization gagal:",
                error
            );

        }

    }


    const elements =
        directElements();


    console.log(
        "[GEN-Z.AI][Generate] DOM READY:",
        {
            roleBadge:
                Boolean(
                    elements.roleBadge
                ),

            creditBadge:
                Boolean(
                    elements.creditBadge
                ),

            modelSelect:
                Boolean(
                    elements.modelSelect
                ),

            generateCreditValue:
                Boolean(
                    elements.generateCreditValue
                ),

            generateButton:
                Boolean(
                    elements.generateButton
                ),

            generateForm:
                Boolean(
                    elements.generateForm
                )
        }
    );


    if (
        state &&
        typeof state.validateGenerateElements ===
            "function"
    ) {

        try {

            state.validateGenerateElements();

        } catch (error) {

            console.warn(
                "[GEN-Z.AI][Generate] DOM validation warning:",
                error
            );

        }

    }


    return elements;

}


/* =========================================================
   HYDRATE NAVIGATION PROFILE
========================================================= */

function hydrateNavigationProfile() {

    const profile =
        window.GENZ_CURRENT_PROFILE ||
        window.GENZ_NAVIGATION_PROFILE ||
        null;


    const user =
        window.GENZ_CURRENT_USER ||
        window.GENZ_NAVIGATION_USER ||
        null;


    if (
        !profile ||
        typeof profile !== "object"
    ) {

        return null;

    }


    const state =
        appState.modules.state;


    if (
        state &&
        typeof state.setCurrentProfile ===
            "function"
    ) {

        try {

            state.setCurrentProfile(
                profile
            );

        } catch (error) {

            console.warn(
                "[GEN-Z.AI][Generate] State profile hydration gagal:",
                error
            );

        }

    }


    if (
        state &&
        typeof state.setCurrentUser ===
            "function" &&
        user
    ) {

        try {

            state.setCurrentUser(
                user
            );

        } catch {

            /* ignore */

        }

    }


    appState.authReady =
        Boolean(
            user?.id ||
            profile?.id
        );


    appState.profileReady =
        true;


    renderAuthBadgesDirect(
        profile
    );


    console.log(
        "[GEN-Z.AI][Generate] NAVIGATION PROFILE:",
        {
            email:
                profile.email ||
                user?.email,

            role:
                profile.role,

            credits:
                profile.credits
        }
    );


    return profile;

}


/* =========================================================
   WAIT FOR NAVIGATION
========================================================= */

async function waitForNavigationProfile(
    timeout = 4000
) {

    let profile =
        hydrateNavigationProfile();


    if (profile) {

        return profile;

    }


    const navigationReady =
        window.GENZNavigationReady;


    if (
        !navigationReady ||
        typeof navigationReady.then !==
            "function"
    ) {

        return null;

    }


    try {

        await Promise.race([

            navigationReady,

            new Promise(
                resolve => {

                    setTimeout(
                        resolve,
                        timeout
                    );

                }
            )

        ]);

    } catch (error) {

        console.warn(
            "[GEN-Z.AI][Generate] Navigation Ready gagal:",
            error
        );

    }


    profile =
        hydrateNavigationProfile();


    return profile;

}


/* =========================================================
   AUTH FALLBACK
========================================================= */

async function initializeAuthFallback() {

    const auth =
        appState.modules.auth;


    if (!auth) {

        throw new Error(
            "generate-auth.js belum dimuat."
        );

    }


    if (
        typeof auth.loadSupabase !==
            "function"
    ) {

        throw new Error(
            "generate-auth.js tidak menyediakan loadSupabase()."
        );

    }


    await auth.loadSupabase();


    if (
        typeof auth.loadCurrentUser !==
            "function"
    ) {

        throw new Error(
            "generate-auth.js tidak menyediakan loadCurrentUser()."
        );

    }


    const user =
        await auth.loadCurrentUser();


    if (!user?.id) {

        throw new Error(
            "User Auth belum tersedia."
        );

    }


    let profile =
        null;


    if (
        typeof auth.loadProfile ===
            "function"
    ) {

        profile =
            await auth.loadProfile();

    }


    if (
        !profile ||
        typeof profile !== "object"
    ) {

        throw new Error(
            "Profile akun tidak ditemukan."
        );

    }


    if (
        profile.id &&
        String(profile.id) !==
        String(user.id)
    ) {

        throw new Error(
            "Profile akun tidak sesuai dengan user Auth."
        );

    }


    const state =
        appState.modules.state;


    if (
        state &&
        typeof state.setCurrentUser ===
            "function"
    ) {

        state.setCurrentUser(
            user
        );

    }


    if (
        state &&
        typeof state.setCurrentProfile ===
            "function"
    ) {

        state.setCurrentProfile(
            profile
        );

    }


    window.GENZ_CURRENT_USER =
        user;

    window.GENZ_CURRENT_PROFILE =
        profile;

    window.GENZ_NAVIGATION_USER =
        user;

    window.GENZ_NAVIGATION_PROFILE =
        profile;


    appState.authReady =
        true;

    appState.profileReady =
        true;


    renderAuthBadgesDirect(
        profile
    );


    console.log(
        "[GEN-Z.AI][Generate] AUTH FALLBACK READY:",
        {
            email:
                user.email,

            role:
                profile.role,

            credits:
                profile.credits
        }
    );


    return profile;

}


/* =========================================================
   INITIALIZE AUTH
   ---------------------------------------------------------
   PRIORITY:
   1. Shared Navigation
   2. generate-auth fallback
========================================================= */

async function initializeAuth() {

    let profile =
        await waitForNavigationProfile();


    if (profile) {

        /*
         * Pastikan badge langsung terlihat.
         */

        renderAuthBadgesDirect(
            profile
        );


        return profile;

    }


    console.log(
        "[GEN-Z.AI][Generate] Navigation profile belum tersedia. Fallback Auth."
    );


    profile =
        await initializeAuthFallback();


    return profile;

}


/* =========================================================
   ENABLE GENERATE
========================================================= */

function enableGeneration() {

    const button =
        directElement(
            "generateButton"
        );


    if (!button) {

        return;

    }


    button.disabled =
        false;

    button.removeAttribute(
        "aria-disabled"
    );


    const loading =
        directElement(
            "loading"
        );


    if (loading) {

        loading.hidden =
            true;

    }

}


/* =========================================================
   DISABLE GENERATE
========================================================= */

function disableGeneration() {

    const button =
        directElement(
            "generateButton"
        );


    if (button) {

        button.disabled =
            true;

        button.setAttribute(
            "aria-disabled",
            "true"
        );

    }

}


/* =========================================================
   GENERATE AVAILABILITY
========================================================= */

function refreshGenerateAvailability() {

    if (
        appState.submitting ||
        appState.polling
    ) {

        disableGeneration();

        return;

    }


    if (
        appState.authReady &&
        appState.profileReady &&
        appState.modelReady &&
        isCurrentModelReady()
    ) {

        enableGeneration();

    } else {

        disableGeneration();

    }


    /*
     * Model credit harus selalu dipertahankan.
     */

    const model =
        getCurrentModel();


    if (model) {

        renderModelCreditDirect(
            model
        );

    }


    /*
     * Account credit harus selalu dipertahankan.
     */

    const profile =
        getCurrentProfile();


    if (profile) {

        renderAuthBadgesDirect(
            profile
        );

    }

}


/* =========================================================
   INITIALIZE MODEL
========================================================= */

async function initializeModel() {

    const modelModule =
        appState.modules.model;


    if (!modelModule) {

        throw new Error(
            "generate-model.js belum dimuat."
        );

    }


    if (
        typeof modelModule.resolveInitialModel !==
            "function"
    ) {

        throw new Error(
            "generate-model.js tidak menyediakan resolveInitialModel()."
        );

    }


    showStatus(
        "Memuat model...",
        "info"
    );


    const resolved =
        await modelModule.resolveInitialModel();


    const model =
        resolved?.model ||
        (
            resolved?.model_id
                ? resolved
                : null
        );


    if (!model) {

        throw new Error(
            "Tidak ada model executable yang tersedia."
        );

    }


    const state =
        appState.modules.state;


    if (
        state &&
        typeof state.setCurrentModel ===
            "function"
    ) {

        state.setCurrentModel(
            model
        );

    }


    renderModelHeaderSafe(
        model
    );


    appState.modelReady =
        true;


    /*
     * Form dirender belakangan.
     * Jadi error Form tidak mengganggu Model.
     */

    const profile =
        getCurrentProfile();


    if (profile) {

        renderAuthBadgesDirect(
            profile
        );

    }


    renderModelCreditDirect(
        model
    );


    refreshGenerateAvailability();


    console.log(
        "[GEN-Z.AI][Generate] MODEL READY:",
        {
            model_id:
                model.model_id,

            model_name:
                model.model_name ||
                model.name,

            provider:
                model.provider_name ||
                model.provider,

            credit_final:
                model.credit_final,

            credit_cost:
                model.credit_cost
        }
    );


    return model;

}


/* =========================================================
   MODEL CHANGE
========================================================= */

async function handleModelChange(event) {

    const modelId =
        String(
            event?.target?.value ||
            ""
        ).trim();


    if (!modelId) {

        appState.modelReady =
            false;

        disableGeneration();

        renderModelHeaderSafe(
            null
        );

        return;

    }


    const modelModule =
        appState.modules.model;


    if (
        !modelModule ||
        typeof modelModule.selectModel !==
            "function"
    ) {

        showError(
            new Error(
                "Model module tidak menyediakan selectModel()."
            )
        );

        return;

    }


    try {

        hideDirectError();

        showStatus(
            "Memuat konfigurasi model...",
            "info"
        );

        disableGeneration();


        const model =
            await modelModule.selectModel(
                modelId
            );


        if (!model) {

            throw new Error(
                "Konfigurasi model tidak ditemukan."
            );

        }


        const state =
            appState.modules.state;


        if (
            state &&
            typeof state.setCurrentModel ===
                "function"
        ) {

            state.setCurrentModel(
                model
            );

        }


        renderModelHeaderSafe(
            model
        );


        const form =
            appState.modules.form;


        if (
            form &&
            typeof form.renderGenerateForm ===
                "function"
        ) {

            try {

                form.renderGenerateForm();

            } catch (error) {

                console.error(
                    "[GEN-Z.AI][Generate] Form model change gagal:",
                    error
                );

            }

        }


        appState.modelReady =
            true;


        const profile =
            getCurrentProfile();


        if (profile) {

            renderAuthBadgesDirect(
                profile
            );

        }


        renderModelCreditDirect(
            model
        );


        refreshGenerateAvailability();


        showStatus(
            "Model siap digunakan.",
            "success"
        );


    } catch (error) {

        appState.modelReady =
            false;

        disableGeneration();


        const profile =
            getCurrentProfile();


        if (profile) {

            renderAuthBadgesDirect(
                profile
            );

        }


        renderModelCreditDirect(
            getCurrentModel()
        );


        showError(
            error,
            "Model gagal dimuat."
        );

    }

}


/* =========================================================
   COLLECT PARAMETERS
========================================================= */

function collectParameters() {

    const form =
        appState.modules.form;


    if (
        form &&
        typeof form.collectParameters ===
            "function"
    ) {

        return form.collectParameters();

    }


    const generateForm =
        directElement(
            "generateForm"
        );


    if (!generateForm) {

        throw new Error(
            "Generate form tidak ditemukan."
        );

    }


    const formData =
        new FormData(
            generateForm
        );


    const result = {};


    for (
        const [key, value]
        of formData.entries()
    ) {

        if (
            Object.prototype.hasOwnProperty.call(
                result,
                key
            )
        ) {

            if (
                Array.isArray(
                    result[key]
                )
            ) {

                result[key].push(
                    value
                );

            } else {

                result[key] = [
                    result[key],
                    value
                ];

            }

        } else {

            result[key] =
                value;

        }

    }


    return result;

}


/* =========================================================
   VALIDATION
========================================================= */

function validateBeforeSubmit(
    parameters
) {

    const validation =
        appState.modules.validation;


    if (
        validation &&
        typeof validation.validateGenerateParameters ===
            "function"
    ) {

        const result =
            validation.validateGenerateParameters(
                parameters
            );


        if (result === false) {

            return false;

        }


        if (
            result &&
            typeof result === "object" &&
            result.valid === false
        ) {

            showError(
                new Error(
                    result.message ||
                    "Parameter Generate tidak valid."
                )
            );

            return false;

        }

    }


    return true;

}


/* =========================================================
   TASK ID
========================================================= */

function extractTaskId(payload) {

    if (
        !payload ||
        typeof payload !== "object"
    ) {

        return null;

    }


    const candidates = [

        payload.task_id,

        payload.taskId,

        payload.id,

        payload.data?.task_id,

        payload.data?.taskId,

        payload.data?.id,

        payload.result?.task_id,

        payload.result?.taskId,

        payload.result?.id

    ];


    for (
        const candidate
        of candidates
    ) {

        const value =
            String(
                candidate ??
                ""
            ).trim();


        if (value) {

            return value;

        }

    }


    return null;

}


/* =========================================================
   POLLING STATUS
========================================================= */

function getPollingStatusMessage(status) {

    const normalized =
        String(
            status ?? ""
        )
            .trim()
            .toUpperCase();


    if (
        normalized === "SUCCESS" ||
        normalized === "SUCCEEDED" ||
        normalized === "COMPLETED" ||
        normalized === "DONE"
    ) {

        return "Generate selesai.";

    }


    if (
        normalized === "FAILED" ||
        normalized === "FAILURE" ||
        normalized === "ERROR"
    ) {

        return "Generate gagal.";

    }


    if (
        normalized === "PROCESSING" ||
        normalized === "RUNNING"
    ) {

        return "Video sedang diproses...";

    }


    return "Menunggu hasil generate...";

}


/* =========================================================
   POLLING UPDATE
========================================================= */

function handlePollingUpdate(payload) {

    const status =
        payload?.status ||
        payload?.data?.status ||
        payload?.result?.status ||
        "";


    showStatus(
        getPollingStatusMessage(
            status
        ),
        "info"
    );

}


/* =========================================================
   WAIT FOR TASK
========================================================= */

async function waitForTask(taskId) {

    const polling =
        appState.modules.polling;


    if (!polling) {

        throw new Error(
            "generate-polling.js tidak tersedia."
        );

    }


    appState.polling =
        true;

    appState.pollingStartedAt =
        Date.now();


    try {

        if (
            typeof polling.pollGenerateTask ===
                "function"
        ) {

            return await polling.pollGenerateTask(
                taskId,
                {
                    interval:
                        POLLING_INTERVAL,

                    timeout:
                        POLLING_TIMEOUT,

                    onUpdate:
                        handlePollingUpdate
                }
            );

        }


        if (
            typeof polling.pollTask ===
                "function"
        ) {

            return await polling.pollTask(
                taskId,
                {
                    interval:
                        POLLING_INTERVAL,

                    timeout:
                        POLLING_TIMEOUT,

                    onUpdate:
                        handlePollingUpdate
                }
            );

        }


        if (
            typeof polling.waitForTask ===
                "function"
        ) {

            return await polling.waitForTask(
                taskId
            );

        }


        throw new Error(
            "generate-polling.js tidak menyediakan fungsi polling yang kompatibel."
        );

    } finally {

        appState.polling =
            false;

    }

}


/* =========================================================
   GENERATE SUBMIT
========================================================= */

async function handleGenerateSubmit(event) {

    if (event) {

        event.preventDefault();

    }


    if (
        appState.submitting ||
        appState.polling
    ) {

        return;

    }


    if (!appState.authReady) {

        showError(
            new Error(
                "Sesi pengguna belum siap."
            )
        );

        return;

    }


    if (!appState.profileReady) {

        showError(
            new Error(
                "Profile akun belum siap."
            )
        );

        return;

    }


    if (
        !appState.modelReady ||
        !isCurrentModelReady()
    ) {

        showError(
            new Error(
                "Model belum siap digunakan."
            )
        );

        return;

    }


    const request =
        appState.modules.request;


    if (
        !request ||
        typeof request.generateVideo !==
            "function"
    ) {

        showError(
            new Error(
                "generate-request.js tidak tersedia."
            )
        );

        return;

    }


    appState.submitting =
        true;

    appState.currentTaskId =
        null;

    appState.pollingStartedAt =
        null;


    try {

        hideDirectError();


        const profile =
            getCurrentProfile();


        if (profile) {

            renderAuthBadgesDirect(
                profile
            );

        }


        const parameters =
            collectParameters();


        if (
            !validateBeforeSubmit(
                parameters
            )
        ) {

            return;

        }


        showStatus(
            "Mengirim permintaan generate...",
            "info"
        );


        const data =
            await request.generateVideo(
                parameters
            );


        const taskId =
            extractTaskId(
                data
            );


        if (!taskId) {

            throw new Error(
                "Task ID tidak ditemukan dari response generate."
            );

        }


        appState.currentTaskId =
            taskId;


        const finalResult =
            await waitForTask(
                taskId
            );


        appState.currentTaskId =
            extractTaskId(
                finalResult
            ) ||
            taskId;


        showStatus(
            "Video berhasil dibuat. Hasil tersedia di History.",
            "success"
        );


        /*
         * Refresh profile setelah generate.
         * Backend tetap sumber perubahan saldo.
         */

        const auth =
            appState.modules.auth;


        if (
            auth &&
            typeof auth.loadProfile ===
                "function"
        ) {

            try {

                const refreshedProfile =
                    await auth.loadProfile();


                if (
                    refreshedProfile
                ) {

                    const state =
                        appState.modules.state;


                    if (
                        state &&
                        typeof state.setCurrentProfile ===
                            "function"
                    ) {

                        state.setCurrentProfile(
                            refreshedProfile
                        );

                    }


                    window.GENZ_CURRENT_PROFILE =
                        refreshedProfile;

                    window.GENZ_NAVIGATION_PROFILE =
                        refreshedProfile;


                    appState.profileReady =
                        true;


                    renderAuthBadgesDirect(
                        refreshedProfile
                    );

                }

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI][Generate] Refresh profile gagal:",
                    error
                );

            }

        }


        renderModelCreditDirect(
            getCurrentModel()
        );


    } catch (error) {

        showError(
            error,
            "Generate gagal."
        );


        /*
         * Auth tidak boleh hilang.
         */

        const profile =
            getCurrentProfile();


        if (profile) {

            renderAuthBadgesDirect(
                profile
            );

        }


        /*
         * Model credit tidak boleh hilang.
         */

        renderModelCreditDirect(
            getCurrentModel()
        );


    } finally {

        appState.submitting =
            false;

        appState.polling =
            false;


        refreshGenerateAvailability();


        const ui =
            appState.modules.ui;


        if (
            ui &&
            typeof ui.finishRequest ===
                "function"
        ) {

            try {

                ui.finishRequest();

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI][Generate] finishRequest gagal:",
                    error
                );

            }

        }


        /*
         * FINAL AUTH RESTORE
         */

        const finalProfile =
            getCurrentProfile();


        if (finalProfile) {

            renderAuthBadgesDirect(
                finalProfile
            );

        }


        /*
         * FINAL MODEL CREDIT RESTORE
         */

        renderModelCreditDirect(
            getCurrentModel()
        );

    }

}


/* =========================================================
   RESET
========================================================= */

async function resetForm() {

    if (
        appState.submitting ||
        appState.polling
    ) {

        return;

    }


    const generateForm =
        directElement(
            "generateForm"
        );


    if (generateForm) {

        try {

            generateForm.reset();

        } catch {

            /* ignore */

        }

    }


    const form =
        appState.modules.form;


    if (
        form &&
        typeof form.resetDynamicFields ===
            "function"
    ) {

        try {

            await form.resetDynamicFields();

        } catch (error) {

            console.warn(
                "[GEN-Z.AI][Generate] Reset dynamic fields gagal:",
                error
            );

        }

    }


    appState.currentTaskId =
        null;

    appState.pollingStartedAt =
        null;


    const ui =
        appState.modules.ui;


    if (
        ui &&
        typeof ui.resetUI ===
            "function"
    ) {

        try {

            ui.resetUI();

        } catch (error) {

            console.warn(
                "[GEN-Z.AI][Generate] resetUI gagal:",
                error
            );

        }

    }


    const profile =
        getCurrentProfile();


    if (profile) {

        renderAuthBadgesDirect(
            profile
        );

    }


    const model =
        getCurrentModel();


    if (
        model &&
        isCurrentModelReady()
    ) {

        renderModelHeaderSafe(
            model
        );


        if (
            form &&
            typeof form.renderGenerateForm ===
                "function"
        ) {

            try {

                form.renderGenerateForm();

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI][Generate] Render form setelah reset gagal:",
                    error
                );

            }

        }


        appState.modelReady =
            true;


        if (profile) {

            renderAuthBadgesDirect(
                profile
            );

        }


        renderModelCreditDirect(
            model
        );


        refreshGenerateAvailability();


        showStatus(
            "Form berhasil direset.",
            "success"
        );

    } else {

        appState.modelReady =
            false;

        disableGeneration();

    }

}


/* =========================================================
   INPUT HANDLER
========================================================= */

function handleInput(event) {

    const target =
        event?.target;


    if (
        !target ||
        typeof target.matches !==
            "function"
    ) {

        return;

    }


    if (
        !target.matches(
            "input, textarea, select"
        )
    ) {

        return;

    }


    const status =
        directElement(
            "status"
        );


    if (
        status &&
        status.classList.contains(
            "is-error"
        )
    ) {

        hideStatus();

    }

}


/* =========================================================
   CHANGE HANDLER
========================================================= */

function handleChange(event) {

    const target =
        event?.target;


    if (!target) {

        return;

    }


    const modelSelect =
        directElement(
            "modelSelect"
        );


    if (
        target ===
        modelSelect
    ) {

        return;

    }


    const status =
        directElement(
            "status"
        );


    if (
        status &&
        status.classList.contains(
            "is-error"
        )
    ) {

        hideStatus();

    }

}


/* =========================================================
   BIND EVENTS
========================================================= */

function bindEvents() {

    if (
        appState.eventsBound
    ) {

        return;

    }


    const modelSelect =
        directElement(
            "modelSelect"
        );

    const generateForm =
        directElement(
            "generateForm"
        );

    const resetButton =
        directElement(
            "resetButton"
        );


    if (modelSelect) {

        modelSelect.addEventListener(
            "change",
            handleModelChange
        );

    }


    if (generateForm) {

        generateForm.addEventListener(
            "submit",
            handleGenerateSubmit
        );

    }


    if (resetButton) {

        resetButton.addEventListener(
            "click",
            resetForm
        );

    }


    document.addEventListener(
        "input",
        handleInput
    );


    document.addEventListener(
        "change",
        handleChange
    );


    appState.eventsBound =
        true;

}


/* =========================================================
   LOAD FORM / OPTIONAL MODULES
========================================================= */

async function loadOptionalGenerateModules() {

    /*
     * FORM sengaja dimuat setelah AUTH + MODEL.
     *
     * Kalau generate-form.js atau dependency-nya
     * memiliki syntax error, OWNER dan CREDIT tetap
     * sudah tampil.
     */

    await loadOptionalModule(
        "form",
        `./generate-form.js?v=${CACHE_VERSION}`
    );


    await loadOptionalModule(
        "validation",
        `./generate-validation.js?v=${CACHE_VERSION}`
    );


    await loadOptionalModule(
        "request",
        `./generate-request.js?v=${CACHE_VERSION}`
    );


    await loadOptionalModule(
        "polling",
        `./generate-polling.js?v=${CACHE_VERSION}`
    );

}


/* =========================================================
   RENDER FORM SAFELY
========================================================= */

function renderFormSafely() {

    const form =
        appState.modules.form;

    const model =
        getCurrentModel();


    if (
        !form ||
        !model
    ) {

        return false;

    }


    if (
        typeof form.renderGenerateForm !==
            "function"
    ) {

        console.warn(
            "[GEN-Z.AI][Generate] renderGenerateForm() tidak tersedia."
        );

        return false;

    }


    try {

        form.renderGenerateForm();

        return true;

    } catch (error) {

        /*
         * FORM ERROR TIDAK BOLEH
         * MENGUBAH modelReady.
         */

        console.error(
            "[GEN-Z.AI][Generate] Form gagal dirender:",
            error
        );


        showStatus(
            "Model siap digunakan. Form parameter belum dapat dimuat.",
            "error"
        );


        return false;

    }

}


/* =========================================================
   INITIALIZE APPLICATION
========================================================= */

export async function initializeGenerateApp() {

    if (
        appState.initialized
    ) {

        return;

    }


    if (
        appState.initializing
    ) {

        return;

    }


    appState.initializing =
        true;


    try {

        console.log(
            "[GEN-Z.AI][Generate] ================================="
        );

        console.log(
            "[GEN-Z.AI][Generate] BOOTSTRAP START"
        );


        /* =====================================================
           STEP 1
           DOM
        ===================================================== */

        const elements =
            await initializeDOM();


        if (
            !elements.roleBadge ||
            !elements.creditBadge ||
            !elements.modelSelect ||
            !elements.generateCreditValue ||
            !elements.generateButton ||
            !elements.generateForm
        ) {

            throw new Error(
                "Element utama halaman Generate tidak lengkap."
            );

        }


        /* =====================================================
           STEP 2
           STATE
        ===================================================== */

        await loadModule(
            "state",
            `./generate-state.js?v=${CACHE_VERSION}`
        );


        /*
         * Reinitialize state DOM setelah module tersedia.
         */

        const state =
            appState.modules.state;


        if (
            state &&
            typeof state.initializeGenerateElements ===
                "function"
        ) {

            try {

                state.initializeGenerateElements();

            } catch (error) {

                console.warn(
                    "[GEN-Z.AI][Generate] State element init warning:",
                    error
                );

            }

        }


        /* =====================================================
           STEP 3
           AUTH MODULE
        ===================================================== */

        await loadModule(
            "auth",
            `./generate-auth.js?v=${CACHE_VERSION}`
        );


        /* =====================================================
           STEP 4
           AUTH / PROFILE
           -----------------------------------------------------
           INI SEKARANG TERJADI SEBELUM MODEL DAN FORM.
        ===================================================== */

        showStatus(
            "Memeriksa sesi...",
            "info"
        );


        let profile =
            null;


        try {

            profile =
                await initializeAuth();

        } catch (authError) {

            appState.authReady =
                false;

            appState.profileReady =
                false;


            /*
             * Jangan mencoba model.
             * Tanpa akun valid, Generate memang belum
             * seharusnya berjalan.
             */

            showPageError(
                authError?.message ||
                "Authentication gagal."
            );


            throw authError;

        }


        /* =====================================================
           STEP 5
           AUTH READY
           -----------------------------------------------------
           OWNER + ACCOUNT CREDIT HARUS SUDAH TERLIHAT DI SINI.
        ===================================================== */

        if (profile) {

            renderAuthBadgesDirect(
                profile
            );

        }


        console.log(
            "[GEN-Z.AI][Generate] AUTH READY:",
            {
                authReady:
                    appState.authReady,

                profileReady:
                    appState.profileReady,

                email:
                    profile?.email ||
                    getCurrentUser()?.email,

                role:
                    profile?.role,

                credits:
                    profile?.credits
            }
        );


        /* =====================================================
           STEP 6
           LOAD UI
           -----------------------------------------------------
           UI TIDAK BOLEH MENJADI SYARAT AUTH.
        ===================================================== */

        await loadOptionalModule(
            "ui",
            `./generate-ui.js?v=${CACHE_VERSION}`
        );


        /*
         * UI boleh melakukan render tambahan,
         * tetapi direct render tetap final authority.
         */

        renderAuthBadgesDirect(
            profile
        );


        /* =====================================================
           STEP 7
           MODEL MODULE
        ===================================================== */

        try {

            await loadModule(
                "model",
                `./generate-model.js?v=${CACHE_VERSION}`
            );


        } catch (modelModuleError) {

            appState.modelReady =
                false;


            /*
             * AUTH HARUS TETAP HIDUP.
             */

            renderAuthBadgesDirect(
                profile
            );


            showStatus(
                "Akun siap. Modul model belum tersedia.",
                "info"
            );


            console.error(
                "[GEN-Z.AI][Generate] Model module gagal:",
                modelModuleError
            );

        }


        /* =====================================================
           STEP 8
           MODEL INITIALIZATION
        ===================================================== */

        if (
            appState.modules.model
        ) {

            try {

                await initializeModel();

            } catch (modelError) {

                appState.modelReady =
                    false;


                /*
                 * JANGAN reset auth.
                 */

                renderAuthBadgesDirect(
                    profile
                );


                showStatus(
                    "Akun siap. Model belum tersedia.",
                    "info"
                );


                console.error(
                    "[GEN-Z.AI][Generate] Model initialization gagal:",
                    modelError
                );

            }

        }


        /* =====================================================
           STEP 9
           OPTIONAL MODULES
           -----------------------------------------------------
           FORM BARU DIMUAT SETELAH AUTH + MODEL.
        ===================================================== */

        await loadOptionalGenerateModules();


        /* =====================================================
           STEP 10
           FORM
        ===================================================== */

        if (
            appState.modelReady
        ) {

            renderFormSafely();

        }


        /* =====================================================
           STEP 11
           EVENTS
        ===================================================== */

        bindEvents();


        /* =====================================================
           STEP 12
           FINAL AUTH RESTORE
        ===================================================== */

        const finalProfile =
            getCurrentProfile() ||
            profile;


        if (finalProfile) {

            renderAuthBadgesDirect(
                finalProfile
            );

        }


        /* =====================================================
           STEP 13
           FINAL MODEL CREDIT
        ===================================================== */

        const finalModel =
            getCurrentModel();


        if (finalModel) {

            renderModelCreditDirect(
                finalModel
            );

        }


        /* =====================================================
           STEP 14
           AVAILABILITY
        ===================================================== */

        refreshGenerateAvailability();


        /* =====================================================
           STEP 15
           READY
        ===================================================== */

        appState.initialized =
            true;


        if (
            appState.modelReady
        ) {

            hideDirectError();


            showStatus(
                "Model siap digunakan.",
                "success"
            );

        } else {

            /*
             * Auth berhasil.
             * Jangan tampilkan error fatal halaman.
             */

            showStatus(
                "Akun siap. Model belum tersedia.",
                "info"
            );

        }


        console.log(
            "[GEN-Z.AI][Generate] ================================="
        );

        console.log(
            "[GEN-Z.AI][Generate] BOOTSTRAP READY:",
            {
                authReady:
                    appState.authReady,

                profileReady:
                    appState.profileReady,

                modelReady:
                    appState.modelReady,

                email:
                    finalProfile?.email,

                role:
                    finalProfile?.role,

                credits:
                    finalProfile?.credits,

                model:
                    finalModel?.model_id,

                modelCredit:
                    getModelCredit(
                        finalModel
                    )
            }
        );

        console.log(
            "[GEN-Z.AI][Generate] ================================="
        );


    } catch (error) {

        appState.initialized =
            false;


        /*
         * PENTING:
         *
         * Kalau Auth sudah berhasil tetapi module lain
         * gagal, badge TIDAK BOLEH DIHAPUS.
         */

        const preservedProfile =
            getCurrentProfile() ||
            window.GENZ_CURRENT_PROFILE ||
            window.GENZ_NAVIGATION_PROFILE ||
            null;


        if (preservedProfile) {

            appState.profileReady =
                true;


            renderAuthBadgesDirect(
                preservedProfile
            );

        }


        disableGeneration();


        showDirectError(
            error?.message ||
            "Halaman Generate gagal diinisialisasi."
        );


        console.error(
            "[GEN-Z.AI][Generate] Bootstrap failed:",
            error
        );


    } finally {

        appState.initializing =
            false;

    }

}


/* =========================================================
   PUBLIC API
========================================================= */

export const generateApp =
    Object.freeze({

        initialize:
            initializeGenerateApp,

        reset:
            resetForm,

        collectParameters:
            collectParameters,

        isPolling:
            () =>
                appState.polling,

        isInitialized:
            () =>
                appState.initialized,

        isSubmitting:
            () =>
                appState.submitting,

        isAuthReady:
            () =>
                appState.authReady,

        isProfileReady:
            () =>
                appState.profileReady,

        isModelReady:
            () =>
                appState.modelReady,

        getCurrentTaskId:
            () =>
                appState.currentTaskId

    });


/* =========================================================
   GLOBAL COMPATIBILITY
========================================================= */

window.GENZGenerateApp =
    generateApp;


/* =========================================================
   AUTO BOOTSTRAP
========================================================= */

function boot() {

    console.log(
        "[GEN-Z.AI][Generate] DOM BOOT."
    );


    initializeGenerateApp()
        .catch(error => {

            console.error(
                "[GEN-Z.AI][Generate] Unhandled bootstrap error:",
                error
            );

        });

}


if (
    document.readyState ===
        "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        boot,
        {
            once:
                true
        }
    );

} else {

    boot();

}


/* =========================================================
   FINAL LOAD MARKER
========================================================= */

console.log(
    "[GEN-Z.AI][Generate] generate-app.js LOADED.",
    CACHE_VERSION
);
