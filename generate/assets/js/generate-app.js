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
   - Auth           -> Supabase Auth
   - Role           -> profiles.role
   - Account Credit -> profiles.credits
   - Model          -> /api/model-config
   - Model Credit   -> models.credit_final

   IMPORTANT:
   - Form failure must NOT destroy Auth.
   - Form failure must NOT destroy Profile.
   - Form failure must NOT destroy Role.
   - Form failure must NOT destroy Account Credit.
   - Form failure must NOT destroy Model.
   - Model failure must NOT destroy Auth/Profile.

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

const POLLING_INTERVAL =
    3000;

const POLLING_TIMEOUT =
    10 * 60 * 1000;


/* =========================================================
   DIRECT DOM
   ---------------------------------------------------------
   Direct DOM access intentionally does not depend on
   generate-state.js or generate-ui.js.
========================================================= */

function directElement(
    id
) {

    try {

        return document.getElementById(
            id
        );

    } catch {

        return null;

    }

}


function directElements() {

    return {

        status:
            directElement(
                "status"
            ),

        modelSelector:
            directElement(
                "modelSelector"
            ),

        modelSelect:
            directElement(
                "modelSelect"
            ),

        modelName:
            directElement(
                "modelName"
            ),

        modelDescription:
            directElement(
                "modelDescription"
            ),

        providerName:
            directElement(
                "providerName"
            ),

        modelMeta:
            directElement(
                "modelMeta"
            ),

        dynamicFields:
            directElement(
                "dynamicFields"
            ),

        generateForm:
            directElement(
                "generateForm"
            ),

        generateCard:
            directElement(
                "generateCard"
            ),

        generateButton:
            directElement(
                "generateButton"
            ),

        resetButton:
            directElement(
                "resetButton"
            ),

        loading:
            directElement(
                "loading"
            ),

        resultCard:
            directElement(
                "resultCard"
            ),

        pageError:
            directElement(
                "pageError"
            ),

        pageErrorMessage:
            directElement(
                "pageErrorMessage"
            ),

        roleBadge:
            directElement(
                "roleBadge"
            ),

        creditBadge:
            directElement(
                "creditBadge"
            ),

        generateCreditCost:
            directElement(
                "generateCreditCost"
            ),

        generateCreditValue:
            directElement(
                "generateCreditValue"
            ),

        resultModel:
            directElement(
                "resultModel"
            ),

        resultProvider:
            directElement(
                "resultProvider"
            ),

        resultTaskId:
            directElement(
                "resultTaskId"
            )

    };

}


/* =========================================================
   GET ELEMENTS
========================================================= */

function getElements() {

    const state =
        appState.modules.state;


    if (
        state &&
        typeof state.getGenerateElements ===
            "function"
    ) {

        try {

            return state.getGenerateElements();

        } catch (
            error
        ) {

            console.warn(
                "[GEN-Z.AI][Generate] State element lookup failed:",
                error
            );

        }

    }


    return directElements();

}


/* =========================================================
   ERROR DISPLAY
========================================================= */

function showDirectError(
    message
) {

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


    if (
        pageErrorMessage
    ) {

        pageErrorMessage.textContent =
            text;

    }


    if (
        pageError
    ) {

        pageError.hidden =
            false;

        pageError.style.display =
            "";

        pageError.classList.add(
            "is-error"
        );

    }


    if (
        status
    ) {

        status.hidden =
            false;

        status.style.display =
            "";

        status.textContent =
            text;

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


    if (
        pageError
    ) {

        pageError.hidden =
            true;

        pageError.classList.remove(
            "is-error"
        );

    }

}


/* =========================================================
   MODULE LOADER
========================================================= */

async function loadModule(
    name,
    path
) {

    if (
        appState.modules[name]
    ) {

        return appState.modules[name];

    }


    try {

        const module =
            await import(
                path
            );


        if (
            !module ||
            typeof module !==
                "object"
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

    } catch (
        error
    ) {

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
   OPTIONAL MODULE LOADER
   ---------------------------------------------------------
   Module optional tidak boleh menghentikan bootstrap.
========================================================= */

async function loadOptionalModule(
    name,
    path
) {

    try {

        return await loadModule(
            name,
            path
        );

    } catch (
        error
    ) {

        console.error(
            `[GEN-Z.AI][Generate] Optional module "${name}" gagal:`,
            error
        );


        return null;

    }

}


/* =========================================================
   LOAD CORE MODULES
   ---------------------------------------------------------
   CORE:
   - state
   - auth
   - ui
   - model

   OPTIONAL:
   - form
   - validation
   - request
   - polling
========================================================= */

async function loadCoreModules() {

    /* -----------------------------------------------------
       STATE
    ----------------------------------------------------- */

    const state =
        await loadModule(
            "state",
            "./generate-state.js?v=20260921"
        );


    /* -----------------------------------------------------
       AUTH
    ----------------------------------------------------- */

    const auth =
        await loadModule(
            "auth",
            "./generate-auth.js?v=20260921"
        );


    /* -----------------------------------------------------
       UI
    ----------------------------------------------------- */

    const ui =
        await loadModule(
            "ui",
            "./generate-ui.js?v=20260921"
        );


    /* -----------------------------------------------------
       MODEL
    ----------------------------------------------------- */

    const model =
        await loadModule(
            "model",
            "./generate-model.js?v=20260921"
        );


    /* -----------------------------------------------------
       FORM
    ----------------------------------------------------- */

    const form =
        await loadOptionalModule(
            "form",
            "./generate-form.js?v=20260921"
        );


    /* -----------------------------------------------------
       VALIDATION
    ----------------------------------------------------- */

    const validation =
        await loadOptionalModule(
            "validation",
            "./generate-validation.js?v=20260921"
        );


    /* -----------------------------------------------------
       REQUEST
    ----------------------------------------------------- */

    const request =
        await loadOptionalModule(
            "request",
            "./generate-request.js?v=20260921"
        );


    /* -----------------------------------------------------
       POLLING
    ----------------------------------------------------- */

    const polling =
        await loadOptionalModule(
            "polling",
            "./generate-polling.js?v=20260921"
        );


    return {

        state,

        auth,

        ui,

        model,

        form,

        validation,

        request,

        polling

    };

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

            return state.getCurrentProfile();

        } catch {

            return null;

        }

    }


    return null;

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

            return state.getCurrentUser();

        } catch {

            return null;

        }

    }


    return null;

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

            return state.getCurrentModel();

        } catch {

            return null;

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

            return false;

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

function normalizeRole(
    role
) {

    return String(
        role ?? ""
    )
        .trim()
        .toUpperCase();

}


/* =========================================================
   CREDIT FORMAT
========================================================= */

function formatCredit(
    value
) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return "-";

    }


    const numeric =
        Number(
            value
        );


    if (
        Number.isFinite(
            numeric
        )
    ) {

        return new Intl.NumberFormat(
            "id-ID",
            {
                maximumFractionDigits:
                    2
            }
        ).format(
            numeric
        );

    }


    return String(
        value
    );

}


/* =========================================================
   ACCOUNT CREDIT
   ---------------------------------------------------------
   SOURCE:
   profiles.credits
========================================================= */

function renderAccountCreditDirect(
    profile
) {

    const badge =
        directElement(
            "creditBadge"
        );


    if (
        !badge
    ) {

        console.warn(
            "[GEN-Z.AI][Generate] #creditBadge tidak ditemukan."
        );

        return false;

    }


    const credits =
        profile?.credits;


    badge.textContent =
        `Credit: ${formatCredit(
            credits
        )}`;


    badge.hidden =
        false;

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

function renderRoleDirect(
    profile
) {

    const badge =
        directElement(
            "roleBadge"
        );


    if (
        !badge
    ) {

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
        role ||
        "-";


    badge.hidden =
        false;

    badge.style.display =
        "";

    badge.style.visibility =
        "visible";

    badge.style.opacity =
        "1";


    if (
        role
    ) {

        badge.dataset.role =
            role;

    }


    return Boolean(
        role
    );

}


/* =========================================================
   AUTH BADGES
========================================================= */

function renderAuthBadgesDirect(
    profile
) {

    if (
        !profile ||
        typeof profile !==
            "object"
    ) {

        return false;

    }


    renderRoleDirect(
        profile
    );


    renderAccountCreditDirect(
        profile
    );


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

        } catch (
            error
        ) {

            console.warn(
                "[GEN-Z.AI][Generate] UI auth badge gagal:",
                error
            );

        }

    }


    /*
     * Render ulang secara direct.
     *
     * Ini mencegah module UI lain mengosongkan badge.
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

function getModelCredit(
    model
) {

    if (
        !model ||
        typeof model !==
            "object"
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
            Number(
                candidate
            );


        if (
            Number.isFinite(
                numeric
            )
        ) {

            return numeric;

        }


        const text =
            String(
                candidate
            ).trim();


        if (
            text
        ) {

            return text;

        }

    }


    return null;

}


/* =========================================================
   MODEL CREDIT RENDER
========================================================= */

function renderModelCreditDirect(
    model
) {

    const container =
        directElement(
            "generateCreditCost"
        );

    const value =
        directElement(
            "generateCreditValue"
        );


    if (
        !value
    ) {

        console.warn(
            "[GEN-Z.AI][Generate] #generateCreditValue tidak ditemukan."
        );

        return false;

    }


    const credit =
        getModelCredit(
            model
        );


    if (
        credit === null
    ) {

        value.textContent =
            "-- Credit";

    } else {

        value.textContent =
            `${formatCredit(
                credit
            )} Credit`;

    }


    value.hidden =
        false;

    value.style.display =
        "";

    value.style.visibility =
        "visible";

    value.style.opacity =
        "1";


    if (
        container
    ) {

        container.hidden =
            false;

        container.style.display =
            "inline-flex";

        container.style.visibility =
            "visible";

        container.style.opacity =
            "1";

    }


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

        } catch (
            error
        ) {

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
        getModelCredit(
            model
        );


    value.textContent =
        finalCredit === null
            ? "-- Credit"
            : `${formatCredit(
                finalCredit
            )} Credit`;


    value.hidden =
        false;

    value.style.display =
        "";

    value.style.visibility =
        "visible";


    if (
        container
    ) {

        container.hidden =
            false;

        container.style.display =
            "inline-flex";

        container.style.visibility =
            "visible";

    }


    return true;

}


/* =========================================================
   MODEL HEADER
========================================================= */

function renderModelHeaderSafe(
    model
) {

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

        } catch (
            error
        ) {

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

        } catch (
            error
        ) {

            console.warn(
                "[GEN-Z.AI][Generate] UI status gagal:",
                error
            );

        }

    }


    const status =
        directElement(
            "status"
        );


    if (
        status
    ) {

        status.hidden =
            false;

        status.style.display =
            "";

        status.textContent =
            String(
                message ||
                ""
            );

        status.dataset.type =
            type;

    }

}


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
        directElement(
            "status"
        );


    if (
        status
    ) {

        status.hidden =
            true;

    }

}


/* =========================================================
   ERROR
========================================================= */

function showError(
    error,
    fallback =
        "Terjadi kesalahan."
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


function showPageError(
    message
) {

    showDirectError(
        message
    );

}


/* =========================================================
   ENABLE GENERATE
========================================================= */

function enableGeneration() {

    const button =
        directElement(
            "generateButton"
        );


    if (
        !button
    ) {

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


    if (
        loading
    ) {

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


    if (
        button
    ) {

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
     * Model credit tidak boleh hilang ketika
     * availability berubah.
     */

    const model =
        getCurrentModel();


    if (
        model
    ) {

        renderModelCreditDirect(
            model
        );

    }


    /*
     * Account credit juga selalu dipertahankan.
     */

    const profile =
        getCurrentProfile();


    if (
        profile
    ) {

        renderAuthBadgesDirect(
            profile
        );

    }

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

        state.initializeGenerateElements();

    }


    /*
     * DOM direct validation.
     */

    const elements =
        directElements();


    console.log(
        "[GEN-Z.AI][Generate] DOM:",
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

            generateCreditCost:
                Boolean(
                    elements.generateCreditCost
                ),

            generateCreditValue:
                Boolean(
                    elements.generateCreditValue
                ),

            generateForm:
                Boolean(
                    elements.generateForm
                ),

            generateButton:
                Boolean(
                    elements.generateButton
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

        } catch (
            error
        ) {

            console.warn(
                "[GEN-Z.AI][Generate] DOM validation warning:",
                error
            );

        }

    }


    return elements;

}


/* =========================================================
   AUTH INITIALIZATION
========================================================= */

async function initializeAuth() {

    const auth =
        appState.modules.auth;


    if (
        !auth
    ) {

        throw new Error(
            "generate-auth.js belum dimuat."
        );

    }


    /* -----------------------------------------------------
       SUPABASE
    ----------------------------------------------------- */

    if (
        typeof auth.loadSupabase !==
            "function"
    ) {

        throw new Error(
            "generate-auth.js tidak menyediakan loadSupabase()."
        );

    }


    await auth.loadSupabase();


    /* -----------------------------------------------------
       USER
    ----------------------------------------------------- */

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


    if (
        !user?.id
    ) {

        throw new Error(
            "User Auth belum tersedia."
        );

    }


    appState.authReady =
        true;


    /* -----------------------------------------------------
       PROFILE
    ----------------------------------------------------- */

    if (
        typeof auth.loadProfile !==
            "function"
    ) {

        throw new Error(
            "generate-auth.js tidak menyediakan loadProfile()."
        );

    }


    const profile =
        await auth.loadProfile();


    if (
        !profile ||
        typeof profile !==
            "object"
    ) {

        throw new Error(
            "Profile akun tidak ditemukan."
        );

    }


    /* -----------------------------------------------------
       PROFILE ID
    ----------------------------------------------------- */

    if (
        String(
            profile.id ??
            ""
        ) !==
        String(
            user.id
        )
    ) {

        throw new Error(
            "Profile akun tidak sesuai dengan user Auth."
        );

    }


    /* -----------------------------------------------------
       ROLE
    ----------------------------------------------------- */

    const role =
        normalizeRole(
            profile.role
        );


    if (
        !role
    ) {

        throw new Error(
            "Role akun tidak tersedia."
        );

    }


    /* -----------------------------------------------------
       SAVE STATE
    ----------------------------------------------------- */

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


    /* -----------------------------------------------------
       GLOBAL COMPATIBILITY
    ----------------------------------------------------- */

    window.GENZ_CURRENT_USER =
        user;

    window.GENZ_CURRENT_PROFILE =
        profile;

    window.GENZ_NAVIGATION_USER =
        user;

    window.GENZ_NAVIGATION_PROFILE =
        profile;


    /* -----------------------------------------------------
       PROFILE READY
    ----------------------------------------------------- */

    appState.profileReady =
        true;


    /* -----------------------------------------------------
       RENDER AUTH
    ----------------------------------------------------- */

    renderAuthBadgesDirect(
        profile
    );


    console.log(
        "[GEN-Z.AI][Generate] AUTH READY:",
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
   MODEL INITIALIZATION
========================================================= */

async function initializeModel() {

    const modelModule =
        appState.modules.model;


    if (
        !modelModule
    ) {

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


    if (
        !model
    ) {

        throw new Error(
            "Tidak ada model executable yang tersedia."
        );

    }


    /* -----------------------------------------------------
       SAVE MODEL
    ----------------------------------------------------- */

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


    /* -----------------------------------------------------
       MODEL HEADER
    ----------------------------------------------------- */

    renderModelHeaderSafe(
        model
    );


    /* -----------------------------------------------------
       FORM
       -----------------------------------------------------
       FORM FAILURE DOES NOT FAIL MODEL.
    ----------------------------------------------------- */

    const form =
        appState.modules.form;


    if (
        form &&
        typeof form.renderGenerateForm ===
            "function"
    ) {

        try {

            form.renderGenerateForm();

        } catch (
            error
        ) {

            console.error(
                "[GEN-Z.AI][Generate] Render form gagal:",
                error
            );


            showStatus(
                "Model siap digunakan. Form parameter belum dapat dimuat.",
                "error"
            );

        }

    } else {

        console.warn(
            "[GEN-Z.AI][Generate] Form module tidak tersedia."
        );

    }


    /* -----------------------------------------------------
       MODEL READY
    ----------------------------------------------------- */

    appState.modelReady =
        true;


    /* -----------------------------------------------------
       PRESERVE AUTH
    ----------------------------------------------------- */

    const profile =
        getCurrentProfile();


    if (
        profile
    ) {

        renderAuthBadgesDirect(
            profile
        );

    }


    /* -----------------------------------------------------
       MODEL CREDIT
    ----------------------------------------------------- */

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

            pricing:
                model.pricing

        }
    );


    return model;

}


/* =========================================================
   MODEL CHANGE
========================================================= */

async function handleModelChange(
    event
) {

    const modelId =
        String(
            event?.target?.value ||
            ""
        ).trim();


    if (
        !modelId
    ) {

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


        if (
            !model
        ) {

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

            } catch (
                error
            ) {

                console.error(
                    "[GEN-Z.AI][Generate] Form model change gagal:",
                    error
                );

            }

        }


        appState.modelReady =
            true;


        renderAuthBadgesDirect(
            getCurrentProfile()
        );


        renderModelCreditDirect(
            model
        );


        refreshGenerateAvailability();


        showStatus(
            "Model siap digunakan.",
            "success"
        );


    } catch (
        error
    ) {

        appState.modelReady =
            false;


        disableGeneration();


        const profile =
            getCurrentProfile();


        if (
            profile
        ) {

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


    if (
        !generateForm
    ) {

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
        const [
            key,
            value
        ] of formData.entries()
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
   CLIENT VALIDATION
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


        if (
            result === false
        ) {

            return false;

        }


        if (
            result &&
            typeof result ===
                "object" &&
            result.valid ===
                false
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

function extractTaskId(
    payload
) {

    if (
        !payload ||
        typeof payload !==
            "object"
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
        const candidate of candidates
    ) {

        const value =
            String(
                candidate ??
                ""
            ).trim();


        if (
            value
        ) {

            return value;

        }

    }


    return null;

}


/* =========================================================
   POLLING STATUS MESSAGE
========================================================= */

function getPollingStatusMessage(
    status
) {

    const normalized =
        String(
            status ??
            ""
        )
        .trim()
        .toUpperCase();


    if (
        normalized ===
            "SUCCESS" ||
        normalized ===
            "SUCCEEDED" ||
        normalized ===
            "COMPLETED" ||
        normalized ===
            "DONE"
    ) {

        return "Generate selesai.";

    }


    if (
        normalized ===
            "FAILED" ||
        normalized ===
            "FAILURE" ||
        normalized ===
            "ERROR"
    ) {

        return "Generate gagal.";

    }


    if (
        normalized ===
            "PROCESSING" ||
        normalized ===
            "RUNNING"
    ) {

        return "Video sedang diproses...";

    }


    return "Menunggu hasil generate...";

}


/* =========================================================
   POLLING UPDATE
========================================================= */

function handlePollingUpdate(
    payload
) {

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

async function waitForTask(
    taskId
) {

    const polling =
        appState.modules.polling;


    if (
        !polling
    ) {

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

async function handleGenerateSubmit(
    event
) {

    if (
        event
    ) {

        event.preventDefault();

    }


    if (
        appState.submitting ||
        appState.polling
    ) {

        return;

    }


    if (
        !appState.authReady
    ) {

        showError(
            new Error(
                "Sesi pengguna belum siap."
            )
        );

        return;

    }


    if (
        !appState.profileReady
    ) {

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


        if (
            profile
        ) {

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


        if (
            !taskId
        ) {

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
         * Refresh profile.
         *
         * Backend menjadi sumber perubahan credit.
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

                    appState.profileReady =
                        true;


                    renderAuthBadgesDirect(
                        refreshedProfile
                    );

                }

            } catch (
                error
            ) {

                console.warn(
                    "[GEN-Z.AI][Generate] Refresh profile gagal:",
                    error
                );

            }

        }


        renderModelCreditDirect(
            getCurrentModel()
        );


    } catch (
        error
    ) {

        showError(
            error,
            "Generate gagal."
        );


        /*
         * Jangan menghapus auth badge.
         */

        const profile =
            getCurrentProfile();


        if (
            profile
        ) {

            renderAuthBadgesDirect(
                profile
            );

        }


        /*
         * Jangan menghapus model credit.
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

            } catch (
                error
            ) {

                console.warn(
                    "[GEN-Z.AI][Generate] finishRequest gagal:",
                    error
                );

            }

        }


        /*
         * Final badge restore.
         */

        const profile =
            getCurrentProfile();


        if (
            profile
        ) {

            renderAuthBadgesDirect(
                profile
            );

        }


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


    if (
        generateForm
    ) {

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

        } catch (
            error
        ) {

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

        } catch (
            error
        ) {

            console.warn(
                "[GEN-Z.AI][Generate] resetUI gagal:",
                error
            );

        }

    }


    const profile =
        getCurrentProfile();


    if (
        profile
    ) {

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

            } catch (
                error
            ) {

                console.warn(
                    "[GEN-Z.AI][Generate] Render form setelah reset gagal:",
                    error
                );

            }

        }


        appState.modelReady =
            true;


        renderAuthBadgesDirect(
            profile
        );


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

function handleInput(
    event
) {

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

function handleChange(
    event
) {

    const target =
        event?.target;


    if (
        !target
    ) {

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


    if (
        modelSelect
    ) {

        modelSelect.addEventListener(
            "change",
            handleModelChange
        );

    }


    if (
        generateForm
    ) {

        generateForm.addEventListener(
            "submit",
            handleGenerateSubmit
        );

    }


    if (
        resetButton
    ) {

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
            "[GEN-Z.AI][Generate] BOOTSTRAP START"
        );


        /* =================================================
           STEP 1
           LOAD CORE + OPTIONAL MODULES
        ================================================= */

        showStatus(
            "Memuat Generate...",
            "info"
        );


        await loadCoreModules();


        /* =================================================
           STEP 2
           DOM
        ================================================= */

        await initializeDOM();


        /* =================================================
           STEP 3
           EVENTS
        ================================================= */

        bindEvents();


        /* =================================================
           STEP 4
           AUTH
        ================================================= */

        showStatus(
            "Memeriksa sesi...",
            "info"
        );


        try {

            await initializeAuth();

        } catch (
            authError
        ) {

            appState.authReady =
                false;

            appState.profileReady =
                false;


            showPageError(
                authError?.message ||
                "Authentication gagal."
            );


            throw authError;

        }


        /* =================================================
           AUTH IS NOW READY
           ROLE + ACCOUNT CREDIT MUST BE VISIBLE
        ================================================= */

        const profile =
            getCurrentProfile();


        if (
            profile
        ) {

            renderAuthBadgesDirect(
                profile
            );

        }


        console.log(
            "[GEN-Z.AI][Generate] PROFILE READY:",
            {

                role:
                    profile?.role,

                credits:
                    profile?.credits

            }
        );


        /* =================================================
           STEP 5
           MODEL
           -------------------------------------------------
           MODEL FAILURE DOES NOT FAIL AUTH.
        ================================================= */

        try {

            await initializeModel();

        } catch (
            modelError
        ) {

            appState.modelReady =
                false;


            const preservedProfile =
                getCurrentProfile();


            if (
                preservedProfile
            ) {

                renderAuthBadgesDirect(
                    preservedProfile
                );

            }


            showStatus(
                "Akun siap. Model belum tersedia.",
                "error"
            );


            console.error(
                "[GEN-Z.AI][Generate] Model initialization gagal:",
                modelError
            );

        }


        /* =================================================
           STEP 6
           FINAL AUTH RESTORE
        ================================================= */

        const finalProfile =
            getCurrentProfile();


        if (
            finalProfile
        ) {

            renderAuthBadgesDirect(
                finalProfile
            );

        }


        /* =================================================
           STEP 7
           FINAL MODEL CREDIT
        ================================================= */

        const finalModel =
            getCurrentModel();


        if (
            finalModel
        ) {

            renderModelCreditDirect(
                finalModel
            );

        }


        /* =================================================
           STEP 8
           AVAILABILITY
        ================================================= */

        refreshGenerateAvailability();


        /* =================================================
           STEP 9
           READY
        ================================================= */

        if (
            appState.modelReady
        ) {

            hideDirectError();


            showStatus(
                "Model siap digunakan.",
                "success"
            );

        } else {

            showStatus(
                "Akun siap. Model belum tersedia.",
                "info"
            );

        }


        appState.initialized =
            true;


        console.log(
            "[GEN-Z.AI][Generate] BOOTSTRAP READY:",
            {

                authReady:
                    appState.authReady,

                profileReady:
                    appState.profileReady,

                modelReady:
                    appState.modelReady,

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


    } catch (
        error
    ) {

        appState.initialized =
            false;


        appState.modelReady =
            false;


        disableGeneration();


        /*
         * Jika Auth sudah berhasil, jangan
         * menghapus badge.
         */

        const profile =
            getCurrentProfile();


        if (
            profile
        ) {

            renderAuthBadgesDirect(
                profile
            );

        }


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
   AUTO BOOTSTRAP
========================================================= */

function boot() {

    initializeGenerateApp()
        .catch(
            error => {

                console.error(
                    "[GEN-Z.AI][Generate] Unhandled bootstrap error:",
                    error
                );

            }
        );

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
   GLOBAL COMPATIBILITY
========================================================= */

window.GENZGenerateApp =
    generateApp;


/* =========================================================
   FINAL LOAD MARKER
========================================================= */

console.log(
    "[GEN-Z.AI][Generate] generate-app.js LOADED."
);
