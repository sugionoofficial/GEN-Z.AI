/* =========================================================
   GEN-Z.AI
   GENERATE APP MODULE
   ---------------------------------------------------------
   File:
   generate/assets/js/generate-app.js

   Tanggung jawab:
   - Bootstrap halaman Generate
   - Inisialisasi DOM
   - Authentication
   - Profile
   - Role + Account Credit
   - Model
   - Model Credit
   - Form
   - Generate Request
   - Polling
   - Reset

   PENTING:
   ---------------------------------------------------------
   File ini menggunakan dynamic import agar kegagalan satu
   module tidak membuat seluruh Generate mati sebelum
   bootstrap dapat memberikan informasi error.

   SOURCE OF TRUTH:
   - Auth          -> Supabase Auth
   - Role          -> profiles.role
   - Account Credit-> profiles.credits
   - Model         -> model registry
   - Model Credit  -> model.credit_final / pricing.credit_final

   TIDAK ADA:
   - Role hardcode
   - Account credit hardcode
   - Model credit hardcode
========================================================= */

"use strict";


/* =========================================================
   APP STATE
========================================================= */

const appState = {

    initialized: false,

    initializing: false,

    submitting: false,

    polling: false,

    eventsBound: false,

    authReady: false,

    profileReady: false,

    modelReady: false,

    currentTaskId: null,

    pollingStartedAt: null,

    modules: {

        state: null,

        auth: null,

        model: null,

        form: null,

        validation: null,

        request: null,

        polling: null,

        ui: null

    }

};


/* =========================================================
   CONFIG
========================================================= */

const POLLING_INTERVAL = 3000;

const POLLING_TIMEOUT =
    10 * 60 * 1000;


/* =========================================================
   DIRECT DOM ACCESS
   ---------------------------------------------------------
   Digunakan bahkan sebelum state module berhasil dimuat.
   Ini sengaja.
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
   SHOW BOOTSTRAP ERROR
   ---------------------------------------------------------
   Harus bisa bekerja walaupun state/UI module gagal.
========================================================= */

function showDirectError(message) {

    const pageError =
        directElement(
            "pageError"
        );

    const pageErrorMessage =
        directElement(
            "pageErrorMessage"
        );


    if (
        pageErrorMessage
    ) {

        pageErrorMessage.textContent =
            String(
                message ||
                "Generate gagal diinisialisasi."
            );

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
                "Generate gagal diinisialisasi."
            );

        status.classList.add(
            "is-error"
        );

    }


    console.error(
        "[GEN-Z.AI][Generate] Bootstrap error:",
        message
    );

}


/* =========================================================
   HIDE DIRECT ERROR
========================================================= */

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

    }

}


/* =========================================================
   LOAD MODULE
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
   LOAD CORE MODULES
========================================================= */

async function loadCoreModules() {

    /*
     * State dimuat pertama.
     *
     * Setelah ini kita sudah punya DOM state.
     */

    const state =
        await loadModule(
            "state",
            "./generate-state.js"
        );


    /*
     * Auth.
     */

    const auth =
        await loadModule(
            "auth",
            "./generate-auth.js"
        );


    /*
     * UI.

     * UI harus dimuat sebelum model supaya
     * rendering error/credit tersedia.
     */

    const ui =
        await loadModule(
            "ui",
            "./generate-ui.js"
        );


    /*
     * Model.
     */

    const model =
        await loadModule(
            "model",
            "./generate-model.js"
        );


    /*
     * Form.
     */

    const form =
        await loadModule(
            "form",
            "./generate-form.js"
        );


    /*
     * Validation.
     */

    const validation =
        await loadModule(
            "validation",
            "./generate-validation.js"
        );


    /*
     * Request.
     */

    const request =
        await loadModule(
            "request",
            "./generate-request.js"
        );


    /*
     * Polling.
     */

    const polling =
        await loadModule(
            "polling",
            "./generate-polling.js"
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
   GET STATE ELEMENTS
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

        } catch {

            /* fallback */

        }

    }


    return directElements();

}


/* =========================================================
   STATE HELPERS
========================================================= */

function getCurrentProfile() {

    const state =
        appState.modules.state;


    if (
        state &&
        typeof state.getCurrentProfile ===
            "function"
    ) {

        return state.getCurrentProfile();

    }


    return null;

}


function getCurrentModel() {

    const state =
        appState.modules.state;


    if (
        state &&
        typeof state.getCurrentModel ===
            "function"
    ) {

        return state.getCurrentModel();

    }


    return null;

}


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
        model?.model_id
    );

}


/* =========================================================
   AUTH BADGE
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
   RENDER ROLE DIRECTLY
   ---------------------------------------------------------
   Ini sengaja tidak bergantung pada UI module.
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


    if (
        !role
    ) {

        badge.textContent =
            "-";

        badge.hidden =
            false;

        badge.style.display =
            "";

        return false;

    }


    badge.textContent =
        role;

    badge.hidden =
        false;

    badge.style.display =
        "";

    badge.dataset.role =
        role;


    return true;

}


/* =========================================================
   RENDER ACCOUNT CREDIT DIRECTLY
   ---------------------------------------------------------
   SOURCE:
       profiles.credits

   0 VALID.
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
   RENDER AUTH BADGES
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


    /*
     * UI module tetap dipanggil jika tersedia.
     * Direct render di atas menjadi pengaman.
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
     * Pastikan UI module tidak menyembunyikan
     * badge setelah render.
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
   RENDER MODEL CREDIT DIRECTLY
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
        const value of candidates
    ) {

        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {

            continue;

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

            return numeric;

        }


        return String(
            value
        ).trim();

    }


    return null;

}


/* =========================================================
   RENDER MODEL CREDIT
========================================================= */

function renderModelCreditDirect(
    model
) {

    const container =
        directElement(
            "generateCreditCost"
        );

    const valueElement =
        directElement(
            "generateCreditValue"
        );


    if (
        !valueElement
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

        valueElement.textContent =
            "-- Credit";

    } else {

        valueElement.textContent =
            `${formatCredit(
                credit
            )} Credit`;

    }


    valueElement.hidden =
        false;

    valueElement.style.display =
        "";


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
     * Render ulang setelah UI module supaya
     * tidak ada module lain yang mengosongkan nilai.
     */

    const finalCredit =
        getModelCredit(
            model
        );


    valueElement.textContent =
        finalCredit === null
            ? "-- Credit"
            : `${formatCredit(
                finalCredit
            )} Credit`;

    valueElement.hidden =
        false;

    valueElement.style.display =
        "";


    if (
        container
    ) {

        container.hidden =
            false;

        container.style.display =
            "inline-flex";

    }


    return true;

}


/* =========================================================
   RENDER MODEL HEADER
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


    /*
     * Model credit selalu diproses terpisah.
     */

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

        ui.showStatus(
            message,
            type
        );

        return;

    }


    const status =
        directElement(
            "status"
        );


    if (
        !status
    ) {

        return;

    }


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


function hideStatus() {

    const ui =
        appState.modules.ui;


    if (
        ui &&
        typeof ui.hideStatus ===
            "function"
    ) {

        ui.hideStatus();

        return;

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

            /* fallback below */

        }

    }


    console.error(
        "[GEN-Z.AI][Generate]",
        error
    );

}


function showPageError(
    message
) {

    const ui =
        appState.modules.ui;


    if (
        ui &&
        typeof ui.showPageError ===
            "function"
    ) {

        try {

            ui.showPageError(
                message
            );

            return;

        } catch {

            /* fallback */

        }

    }


    showDirectError(
        message
    );

}


/* =========================================================
   GENERATION BUTTON
========================================================= */

function enableGeneration() {

    const ui =
        appState.modules.ui;


    if (
        ui &&
        typeof ui.enableGeneration ===
            "function"
    ) {

        ui.enableGeneration();

        return;

    }


    const button =
        directElement(
            "generateButton"
        );


    if (
        button
    ) {

        button.disabled =
            false;

    }

}


function disableGeneration() {

    const ui =
        appState.modules.ui;


    if (
        ui &&
        typeof ui.disableGeneration ===
            "function"
    ) {

        ui.disableGeneration();

        return;

    }


    const button =
        directElement(
            "generateButton"
        );


    if (
        button
    ) {

        button.disabled =
            true;

    }

}


/* =========================================================
   AVAILABILITY
========================================================= */

function refreshGenerateAvailability() {

    if (
        appState.submitting ||
        appState.polling
    ) {

        disableGeneration();

        return;

    }


    const ready =
        appState.authReady &&
        appState.profileReady &&
        appState.modelReady &&
        isCurrentModelReady();


    if (
        ready
    ) {

        enableGeneration();

    } else {

        disableGeneration();

    }

}


/* =========================================================
   INITIALIZE DOM
========================================================= */

async function initializeDOM() {

    const state =
        appState.modules.state;


    if (
        !state ||
        typeof state.initializeGenerateElements !==
            "function"
    ) {

        throw new Error(
            "generate-state.js tidak menyediakan initializeGenerateElements()."
        );

    }


    state.initializeGenerateElements();


    if (
        typeof state.validateGenerateElements ===
            "function"
    ) {

        state.validateGenerateElements();

    }


    console.log(
        "[GEN-Z.AI][Generate] DOM elements initialized."
    );

}


/* =========================================================
   AUTH
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


    /*
     * STEP 1
     */

    if (
        typeof auth.loadSupabase !==
            "function"
    ) {

        throw new Error(
            "generate-auth.js tidak memiliki loadSupabase()."
        );

    }


    await auth.loadSupabase();


    /*
     * STEP 2
     */

    if (
        typeof auth.loadCurrentUser !==
            "function"
    ) {

        throw new Error(
            "generate-auth.js tidak memiliki loadCurrentUser()."
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


    /*
     * STEP 3
     */

    if (
        typeof auth.loadProfile !==
            "function"
    ) {

        throw new Error(
            "generate-auth.js tidak memiliki loadProfile()."
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


    /*
     * STEP 4
     *
     * Profile ID wajib sama dengan user Auth.
     */

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


    /*
     * STEP 5
     *
     * Role WAJIB berasal dari profiles.role.
     */

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


    /*
     * STEP 6
     *
     * Simpan global compatibility.
     */

    window.GENZ_CURRENT_USER =
        user;

    window.GENZ_CURRENT_PROFILE =
        profile;


    /*
     * Navigation hanya cache.
     * Tidak menjadi source of truth.
     */

    window.GENZ_NAVIGATION_USER =
        user;

    window.GENZ_NAVIGATION_PROFILE =
        profile;


    /*
     * STEP 7
     *
     * Tandai profile siap SEBELUM model.
     */

    appState.profileReady =
        true;


    /*
     * STEP 8
     *
     * Render badge langsung.
     */

    renderAuthBadgesDirect(
        profile
    );


    /*
     * Role helper bila tersedia.
     */

    if (
        typeof auth.getCurrentRole ===
            "function"
    ) {

        try {

            auth.getCurrentRole();

        } catch (
            error
        ) {

            console.warn(
                "[GEN-Z.AI][Generate] getCurrentRole:",
                error
            );

        }

    }


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


    /*
     * PENTING:
     *
     * Tidak ada model di sini.
     * Tidak ada model credit di sini.
     */

    return profile;

}


/* =========================================================
   MODEL
========================================================= */

async function initializeModel() {

    const modelModule =
        appState.modules.model;


    if (
        !modelModule ||
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


    /*
     * Render model header.
     */

    renderModelHeaderSafe(
        model
    );


    /*
     * Render form.
     */

    const form =
        appState.modules.form;


    if (
        form &&
        typeof form.renderGenerateForm ===
            "function"
    ) {

        form.renderGenerateForm();

    } else {

        throw new Error(
            "generate-form.js tidak menyediakan renderGenerateForm()."
        );

    }


    appState.modelReady =
        true;


    /*
     * Jangan pernah menghapus auth badge
     * saat model selesai.
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


    try {

        hideDirectError();


        showStatus(
            "Memuat konfigurasi model...",
            "info"
        );


        disableGeneration();


        const modelModule =
            appState.modules.model;


        if (
            !modelModule ||
            typeof modelModule.selectModel !==
                "function"
        ) {

            throw new Error(
                "Model module tidak menyediakan selectModel()."
            );

        }


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

            form.renderGenerateForm();

        }


        appState.modelReady =
            true;


        /*
         * Auth badge tetap dipertahankan.
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


        renderModelHeaderSafe(
            null
        );


        /*
         * Jangan sentuh:
         * - role
         * - account credit
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


        showError(
            error,
            "Gagal memuat konfigurasi model."
        );


        showPageError(
            error?.message ||
            "Gagal memuat konfigurasi model."
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
        !form ||
        typeof form.getFormParameters !==
            "function"
    ) {

        throw new Error(
            "generate-form.js tidak menyediakan getFormParameters()."
        );

    }


    return form.getFormParameters();

}


/* =========================================================
   VALIDATE
========================================================= */

function validateBeforeSubmit(
    parameters
) {

    const validation =
        appState.modules.validation;


    if (
        !validation ||
        typeof validation.validateClientParameters !==
            "function"
    ) {

        throw new Error(
            "generate-validation.js tidak tersedia."
        );

    }


    const errors =
        validation.validateClientParameters(
            parameters
        );


    if (
        !errors ||
        errors.length === 0
    ) {

        return true;

    }


    showError(
        errors.join(
            "\n"
        ),
        "Parameter belum valid."
    );


    const ui =
        appState.modules.ui;


    if (
        ui &&
        typeof ui.focusFirstInvalidField ===
            "function"
    ) {

        ui.focusFirstInvalidField();

    }


    if (
        ui &&
        typeof ui.scrollToError ===
            "function"
    ) {

        ui.scrollToError();

    }


    return false;

}


/* =========================================================
   TASK ID
========================================================= */

function extractTaskId(
    data
) {

    const candidates = [

        data?.task_id,

        data?.taskId,

        data?.job_id,

        data?.jobId,

        data?.task?.task_id,

        data?.task?.taskId,

        data?.task?.job_id,

        data?.task?.jobId,

        data?.data?.task_id,

        data?.data?.taskId,

        data?.data?.job_id,

        data?.data?.jobId

    ];


    for (
        const value of candidates
    ) {

        const normalized =
            String(
                value ??
                ""
            ).trim();


        if (
            normalized
        ) {

            return normalized;

        }

    }


    return "";

}


/* =========================================================
   POLLING STATUS
========================================================= */

function getPollingStatusMessage(
    result
) {

    const state =
        String(
            result?.state ||
            ""
        )
            .trim()
            .toLowerCase();


    switch (
        state
    ) {

        case "waiting":

        case "pending":

        case "queued":

        case "queue":

            return "Task sedang menunggu diproses...";


        case "processing":

        case "running":

        case "generating":

        case "in_progress":

        case "in-progress":

            return "Video sedang dibuat oleh provider...";


        case "success":

        case "succeeded":

        case "completed":

        case "complete":

        case "done":

        case "finished":

            return "Video selesai dibuat.";


        case "fail":

        case "failed":

        case "error":

        case "cancelled":

        case "canceled":

            return "Generate gagal.";


        default:

            return "Memeriksa status video...";

    }

}


/* =========================================================
   POLLING UPDATE
========================================================= */

function handlePollingUpdate(
    result
) {

    showStatus(
        getPollingStatusMessage(
            result
        ),
        "info"
    );


    const taskId =
        extractTaskId(
            result
        );


    if (
        taskId
    ) {

        appState.currentTaskId =
            taskId;

    }

}


/* =========================================================
   WAIT TASK
========================================================= */

async function waitForTask(
    taskId
) {

    const polling =
        appState.modules.polling;


    if (
        !polling ||
        typeof polling.pollTask !==
            "function"
    ) {

        throw new Error(
            "generate-polling.js tidak menyediakan pollTask()."
        );

    }


    appState.polling =
        true;

    appState.currentTaskId =
        taskId;

    appState.pollingStartedAt =
        Date.now();


    refreshGenerateAvailability();


    try {

        showStatus(
            "Task berhasil dibuat. Menunggu hasil video...",
            "info"
        );


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

    } finally {

        appState.polling =
            false;

        refreshGenerateAvailability();

    }

}


/* =========================================================
   GENERATE SUBMIT
========================================================= */

async function handleGenerateSubmit(
    event
) {

    event.preventDefault();


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
            "Sesi pengguna belum siap."
        );

        return;

    }


    if (
        !appState.profileReady
    ) {

        showError(
            "Profile akun belum siap. Credit belum dapat diverifikasi."
        );

        return;

    }


    if (
        !appState.modelReady ||
        !isCurrentModelReady()
    ) {

        showError(
            "Model belum siap digunakan."
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


        const ui =
            appState.modules.ui;


        if (
            ui &&
            typeof ui.showBusy ===
                "function"
        ) {

            ui.showBusy(
                "Mengirim permintaan generate..."
            );

        } else {

            showStatus(
                "Mengirim permintaan generate...",
                "info"
            );

        }


        const request =
            appState.modules.request;


        if (
            !request ||
            typeof request.generateVideo !==
                "function"
        ) {

            throw new Error(
                "generate-request.js tidak menyediakan generateVideo()."
            );

        }


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
         * Backend adalah pihak yang menentukan
         * pengurangan credit.
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
                refreshError
            ) {

                console.warn(
                    "[GEN-Z.AI][Generate] Refresh profile gagal:",
                    refreshError
                );

            }

        }


        /*
         * Model credit tetap ditampilkan
         * setelah profile refresh.
         */

        renderModelCreditDirect(
            getCurrentModel()
        );


    } catch (
        error
    ) {

        const request =
            appState.modules.request;

        const polling =
            appState.modules.polling;


        const RequestError =
            request?.GenerateRequestError;

        const PollingError =
            polling?.GeneratePollingError;


        if (
            RequestError &&
            error instanceof RequestError
        ) {

            showError(
                error,
                "Generate gagal."
            );

        } else if (
            PollingError &&
            error instanceof PollingError
        ) {

            showError(
                error,
                "Proses generate gagal."
            );

        } else {

            showError(
                error,
                "Terjadi kesalahan saat generate."
            );

        }


        /*
         * Auth badge tidak boleh hilang karena
         * request/model error.
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
         * FINAL BADGE RESTORE.
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


    const elements =
        getElements();


    const generateForm =
        elements?.generateForm ||
        elements?.generateFormEl ||
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


    /*
     * Auth selalu dipulihkan.
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
     * Model tidak berubah.
     */

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
        appState.initialized ||
        appState.initializing
    ) {

        return;

    }


    appState.initializing =
        true;


    try {

        /*
         * -------------------------------------------------
         * BOOTSTRAP MARKER
         * -------------------------------------------------
         */

        console.log(
            "[GEN-Z.AI][Generate] BOOTSTRAP START"
        );


        /*
         * -------------------------------------------------
         * STEP 1
         * LOAD MODULES
         * -------------------------------------------------
         */

        showStatus(
            "Memuat Generate...",
            "info"
        );


        await loadCoreModules();


        /*
         * -------------------------------------------------
         * STEP 2
         * DOM
         * -------------------------------------------------
         */

        await initializeDOM();


        /*
         * -------------------------------------------------
         * STEP 3
         * EVENTS
         * -------------------------------------------------
         */

        bindEvents();


        /*
         * -------------------------------------------------
         * STEP 4
         * AUTH
         * -------------------------------------------------
         */

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


            /*
             * Jangan menampilkan badge palsu.
             */

            showPageError(
                authError?.message ||
                "Authentication gagal."
            );


            throw authError;

        }


        /*
         * -------------------------------------------------
         * PENTING
         *
         * Pada titik ini:
         *
         * ROLE sudah harus terlihat.
         * ACCOUNT CREDIT sudah harus terlihat.
         *
         * Model BELUM diperlukan.
         * -------------------------------------------------
         */

        const authProfile =
            getCurrentProfile();


        if (
            authProfile
        ) {

            renderAuthBadgesDirect(
                authProfile
            );

        }


        console.log(
            "[GEN-Z.AI][Generate] PROFILE READY:",
            {
                role:
                    authProfile?.role,

                credits:
                    authProfile?.credits
            }
        );


        /*
         * -------------------------------------------------
         * STEP 5
         * MODEL
         * -------------------------------------------------
         */

        try {

            await initializeModel();

        } catch (
            modelError
        ) {

            /*
             * Model gagal tidak boleh merusak
             * AUTH + PROFILE.
             */

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


            showPageError(
                modelError?.message ||
                "Model gagal dimuat."
            );


            /*
             * Jangan throw ke bootstrap utama.
             *
             * Halaman tetap hidup dengan:
             * ROLE
             * ACCOUNT CREDIT
             *
             * hanya model yang gagal.
             */

            console.error(
                "[GEN-Z.AI][Generate] Model initialization gagal:",
                modelError
            );

        }


        /*
         * -------------------------------------------------
         * STEP 6
         * FINAL SYNC
         * -------------------------------------------------
         */

        const finalProfile =
            getCurrentProfile();


        if (
            finalProfile
        ) {

            renderAuthBadgesDirect(
                finalProfile
            );

        }


        const finalModel =
            getCurrentModel();


        if (
            finalModel
        ) {

            renderModelCreditDirect(
                finalModel
            );

        }


        /*
         * -------------------------------------------------
         * STEP 7
         * READY
         * -------------------------------------------------
         */

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


        refreshGenerateAvailability();


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


        const message =
            error?.message ||
            "Halaman Generate gagal diinisialisasi.";


        /*
         * Jangan pernah menghapus badge yang
         * sudah berhasil dimuat.
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
            message
        );


        showError(
            error,
            message
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

                /*
                 * Jangan biarkan unhandled rejection
                 * membuat browser diam saja.
                 */

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
   BOOT MARKER
   ---------------------------------------------------------
   Ini sengaja diletakkan di akhir file.
   Kalau marker ini muncul di console, berarti file
   generate-app.js berhasil diparse browser.
========================================================= */

console.log(
    "[GEN-Z.AI][Generate] generate-app.js LOADED."
);
