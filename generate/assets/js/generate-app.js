/* =========================================================
   GEN-Z.AI
   GENERATE APP MODULE
   ---------------------------------------------------------
   File:
   generate/assets/js/generate-app.js

   Tanggung jawab:
   - Bootstrap Generate
   - Load semua module
   - Auth/profile tetap independen
   - Load model
   - Render model selector
   - Render model information
   - Render dynamic form
   - Render model credit
   - Bind model change
   - Generate request
   - Polling
   - Reset

   PENTING:
   - Tidak menyentuh navigation/auth bridge
   - Tidak mengambil credit akun untuk model
   - Model berasal dari /api/model-config
   - Parameter berasal dari konfigurasi model
========================================================= */

"use strict";


/* =========================================================
   APP STATE
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

const MODEL_MODULE =
    "./generate-model.js";

const FORM_MODULE =
    "./generate-form.js";

const STATE_MODULE =
    "./generate-state.js";

const AUTH_MODULE =
    "./generate-auth.js";

const UI_MODULE =
    "./generate-ui.js";

const VALIDATION_MODULE =
    "./generate-validation.js";

const REQUEST_MODULE =
    "./generate-request.js";

const POLLING_MODULE =
    "./generate-polling.js";


/* =========================================================
   DIRECT DOM
========================================================= */

function el(id) {

    try {

        return document.getElementById(id);

    } catch {

        return null;

    }

}


function dom() {

    return {

        status:
            el("status"),

        modelSelector:
            el("modelSelector"),

        modelSelect:
            el("modelSelect"),

        modelName:
            el("modelName"),

        modelDescription:
            el("modelDescription"),

        providerName:
            el("providerName"),

        modelMeta:
            el("modelMeta"),

        dynamicFields:
            el("dynamicFields"),

        generateForm:
            el("generateForm"),

        generateCard:
            el("generateCard"),

        generateButton:
            el("generateButton"),

        resetButton:
            el("resetButton"),

        loading:
            el("loading"),

        resultCard:
            el("resultCard"),

        pageError:
            el("pageError"),

        pageErrorMessage:
            el("pageErrorMessage"),

        roleBadge:
            el("roleBadge"),

        creditBadge:
            el("creditBadge"),

        generateCreditCost:
            el("generateCreditCost"),

        generateCreditValue:
            el("generateCreditValue"),

        resultModel:
            el("resultModel"),

        resultProvider:
            el("resultProvider"),

        resultTaskId:
            el("resultTaskId")

    };

}


/* =========================================================
   DEBUG LOGGER
========================================================= */

function debug(
    ...args
) {

    console.debug(
        "[GEN-Z.AI][Generate]",
        ...args
    );

}


/* =========================================================
   MODULE LOADER
========================================================= */

async function loadModule(
    name,
    path,
    required = true
) {

    if (
        appState.modules[name]
    ) {

        return appState.modules[name];

    }

    try {

        const module =
            await import(path);

        if (
            !module ||
            typeof module !==
                "object"
        ) {

            throw new Error(
                `Module ${name} tidak menghasilkan export valid.`
            );

        }

        appState.modules[name] =
            module;

        debug(
            `Module ${name} loaded.`,
            Object.keys(module)
        );

        return module;

    } catch (error) {

        console.error(
            `[GEN-Z.AI][Generate] Module ${name} gagal dimuat:`,
            error
        );

        if (!required) {

            return null;

        }

        throw error;

    }

}


/* =========================================================
   LOAD CORE MODULES
========================================================= */

async function loadCoreModules() {

    /*
     * State harus paling awal.
     */

    await loadModule(
        "state",
        STATE_MODULE,
        true
    );

    /*
     * Auth.
     */

    await loadModule(
        "auth",
        AUTH_MODULE,
        true
    );

    /*
     * UI.
     */

    await loadModule(
        "ui",
        UI_MODULE,
        true
    );

    /*
     * Model.
     */

    await loadModule(
        "model",
        MODEL_MODULE,
        true
    );

    /*
     * Form.
     */

    await loadModule(
        "form",
        FORM_MODULE,
        true
    );

    /*
     * Validation.
     */

    await loadModule(
        "validation",
        VALIDATION_MODULE,
        false
    );

    /*
     * Request.
     */

    await loadModule(
        "request",
        REQUEST_MODULE,
        false
    );

    /*
     * Polling.
     */

    await loadModule(
        "polling",
        POLLING_MODULE,
        false
    );

    return appState.modules;

}


/* =========================================================
   SHOW ERROR
========================================================= */

function showError(
    message
) {

    const elements =
        dom();

    console.error(
        "[GEN-Z.AI][Generate]",
        message
    );

    if (
        elements.pageError
    ) {

        elements.pageError.hidden =
            false;

        elements.pageError.style.display =
            "block";

    }

    if (
        elements.pageErrorMessage
    ) {

        elements.pageErrorMessage.textContent =
            String(
                message ||
                "Terjadi kesalahan."
            );

    }

    if (
        elements.status
    ) {

        elements.status.textContent =
            String(
                message ||
                "Terjadi kesalahan."
            );

    }

}


/* =========================================================
   HIDE ERROR
========================================================= */

function hideError() {

    const elements =
        dom();

    if (
        elements.pageError
    ) {

        elements.pageError.hidden =
            true;

        elements.pageError.style.display =
            "none";

    }

}


/* =========================================================
   SHOW LOADING
========================================================= */

function showLoading(
    message = "Memuat..."
) {

    const elements =
        dom();

    if (
        elements.loading
    ) {

        elements.loading.hidden =
            false;

        elements.loading.style.display =
            "flex";

    }

    if (
        elements.status
    ) {

        elements.status.textContent =
            message;

    }

}


/* =========================================================
   HIDE LOADING
========================================================= */

function hideLoading() {

    const elements =
        dom();

    if (
        elements.loading
    ) {

        elements.loading.hidden =
            true;

        elements.loading.style.display =
            "none";

    }

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

        return (
            state.getCurrentModel() ||
            null
        );

    }

    return null;

}


/* =========================================================
   MODEL ID
========================================================= */

function modelId(
    model
) {

    return String(
        model?.model_id ||
        model?.id ||
        ""
    ).trim();

}


/* =========================================================
   MODEL NAME
========================================================= */

function modelName(
    model
) {

    return String(
        model?.model_name ||
        model?.name ||
        model?.repository?.model_name ||
        model?.model_id ||
        "Model"
    ).trim();

}


/* =========================================================
   PROVIDER NAME
========================================================= */

function providerName(
    model
) {

    if (
        typeof model?.provider ===
            "object"
    ) {

        return String(
            model.provider.provider_name ||
            model.provider.name ||
            ""
        ).trim();

    }

    return String(
        model?.provider_name ||
        model?.provider ||
        model?.repository?.provider_name ||
        "-"
    ).trim();

}


/* =========================================================
   MODEL CREDIT
========================================================= */

function modelCredit(
    model
) {

    const pricing =
        model?.pricing || {};

    const value =
        pricing.credit_final ??
        model?.credit_final ??
        pricing.credit_cost ??
        model?.credit_cost ??
        null;

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return null;

    }

    const number =
        Number(value);

    return Number.isFinite(
        number
    )
        ? number
        : null;

}


/* =========================================================
   FORMAT CREDIT
========================================================= */

function formatCredit(
    value
) {

    if (
        value === null ||
        value === undefined
    ) {

        return "-";

    }

    const number =
        Number(value);

    if (
        !Number.isFinite(number)
    ) {

        return "-";

    }

    return new Intl.NumberFormat(
        "id-ID",
        {
            maximumFractionDigits:
                2
        }
    ).format(number);

}


/* =========================================================
   RENDER MODEL CREDIT
========================================================= */

function renderModelCredit(
    model
) {

    const elements =
        dom();

    const credit =
        modelCredit(model);

    const formatted =
        formatCredit(credit);

    if (
        elements.generateCreditCost
    ) {

        elements.generateCreditCost.textContent =
            formatted;

        elements.generateCreditCost.style.display =
            "";

    }

    if (
        elements.generateCreditValue
    ) {

        elements.generateCreditValue.textContent =
            formatted;

        elements.generateCreditValue.style.display =
            "";

    }

    debug(
        "Model credit rendered:",
        {
            model:
                modelId(model),

            credit
        }
    );

}


/* =========================================================
   RENDER MODEL INFORMATION
========================================================= */

function renderModelInformation(
    model
) {

    const elements =
        dom();

    if (!model) {

        if (
            elements.modelName
        ) {

            elements.modelName.textContent =
                "Pilih model";

        }

        if (
            elements.modelDescription
        ) {

            elements.modelDescription.textContent =
                "";

        }

        if (
            elements.providerName
        ) {

            elements.providerName.textContent =
                "-";

        }

        if (
            elements.modelMeta
        ) {

            elements.modelMeta.textContent =
                "";

        }

        return;

    }

    if (
        elements.modelName
    ) {

        elements.modelName.textContent =
            modelName(model);

    }

    if (
        elements.modelDescription
    ) {

        elements.modelDescription.textContent =
            String(
                model.description ||
                ""
            );

    }

    if (
        elements.providerName
    ) {

        elements.providerName.textContent =
            providerName(model);

    }

    if (
        elements.modelMeta
    ) {

        const id =
            modelId(model);

        const type =
            String(
                model.type ||
                model.model_type ||
                ""
            ).trim();

        elements.modelMeta.textContent =
            type
                ? `${id} • ${type}`
                : id;

    }

}


/* =========================================================
   RENDER FORM
========================================================= */

async function renderForm(
    model
) {

    const formModule =
        appState.modules.form;

    const elements =
        dom();

    if (
        !elements.dynamicFields
    ) {

        throw new Error(
            "Element #dynamicFields tidak ditemukan."
        );

    }

    /*
     * Bersihkan hanya ketika model valid.
     */

    elements.dynamicFields.innerHTML =
        "";

    if (
        !model
    ) {

        return;

    }

    if (
        !formModule
    ) {

        throw new Error(
            "Module generate-form.js tidak tersedia."
        );

    }

    /*
     * API utama.
     */

    if (
        typeof formModule.render ===
            "function"
    ) {

        await formModule.render();

    }

    else if (
        typeof formModule.renderGenerateForm ===
            "function"
    ) {

        await formModule.renderGenerateForm();

    }

    else if (
        typeof formModule.init ===
            "function"
    ) {

        await formModule.init();

    }

    else {

        throw new Error(
            "generate-form.js tidak memiliki fungsi render/init."
        );

    }

    /*
     * Pastikan form terlihat.
     */

    elements.dynamicFields.hidden =
        false;

    elements.dynamicFields.style.display =
        "";

    debug(
        "Dynamic form rendered:",
        elements.dynamicFields.children.length
    );

}


/* =========================================================
   RENDER MODEL UI
========================================================= */

async function renderModel(
    model
) {

    if (!model) {

        return;

    }

    renderModelInformation(
        model
    );

    renderModelCredit(
        model
    );

    await renderForm(
        model
    );

    appState.modelReady =
        Boolean(
            modelId(model)
        );

}


/* =========================================================
   LOAD MODEL
========================================================= */

async function initializeModel() {

    const modelModule =
        appState.modules.model;

    if (
        !modelModule
    ) {

        throw new Error(
            "Module generate-model.js tidak tersedia."
        );

    }

    /*
     * -----------------------------------------------------
     * PRIMARY API
     * -----------------------------------------------------
     */

    let result = null;

    if (
        typeof modelModule.resolveInitialModel ===
            "function"
    ) {

        debug(
            "Calling resolveInitialModel()..."
        );

        result =
            await modelModule.resolveInitialModel();

    }

    /*
     * -----------------------------------------------------
     * COMPATIBILITY FALLBACK
     * -----------------------------------------------------
     */

    else {

        let models = [];

        if (
            typeof modelModule.loadAvailableModels ===
                "function"
        ) {

            models =
                await modelModule.loadAvailableModels();

        }

        if (
            !Array.isArray(models) ||
            !models.length
        ) {

            throw new Error(
                "Tidak ada model tersedia dari /api/model-config."
            );

        }

        let selectedId = null;

        if (
            typeof modelModule.renderModelSelector ===
                "function"
        ) {

            selectedId =
                modelModule.renderModelSelector(
                    models
                );

        }

        if (
            !selectedId
        ) {

            selectedId =
                String(
                    document.getElementById(
                        "modelSelect"
                    )?.value ||
                    ""
                ).trim();

        }

        if (
            !selectedId
        ) {

            throw new Error(
                "Model tersedia tetapi tidak ada model yang dapat dipilih."
            );

        }

        if (
            typeof modelModule.selectModel ===
                "function"
        ) {

            result = {
                model:
                    await modelModule.selectModel(
                        selectedId
                    ),

                models
            };

        }

        else if (
            typeof modelModule.loadModelConfig ===
                "function"
        ) {

            result = {
                model:
                    await modelModule.loadModelConfig(
                        selectedId
                    ),

                models
            };

        }

    }

    /*
     * -----------------------------------------------------
     * GET CURRENT MODEL
     * -----------------------------------------------------
     */

    let model =
        result?.model ||
        getCurrentModel();

    /*
     * Kalau result berupa model langsung.
     */

    if (
        !model &&
        result &&
        result.model_id
    ) {

        model =
            result;

    }

    if (
        !model
    ) {

        throw new Error(
            "Model berhasil dimuat tetapi currentModel kosong."
        );

    }

    /*
     * Render selector sekali lagi jika diperlukan.
     */

    const elements =
        dom();

    if (
        elements.modelSelect &&
        modelId(model)
    ) {

        elements.modelSelect.value =
            modelId(model);

    }

    /*
     * Render seluruh UI model.
     */

    await renderModel(
        model
    );

    debug(
        "MODEL READY:",
        {
            id:
                modelId(model),

            name:
                modelName(model),

            provider:
                providerName(model),

            credit:
                modelCredit(model),

            parameters:
                model.parameters
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

    const select =
        event?.target ||
        dom().modelSelect;

    const selectedId =
        String(
            select?.value ||
            ""
        ).trim();

    if (
        !selectedId
    ) {

        appState.modelReady =
            false;

        return;

    }

    try {

        hideError();

        showLoading(
            "Memuat model..."
        );

        const modelModule =
            appState.modules.model;

        let model = null;

        if (
            typeof modelModule.selectModel ===
                "function"
        ) {

            model =
                await modelModule.selectModel(
                    selectedId
                );

        }

        else if (
            typeof modelModule.loadModelConfig ===
                "function"
        ) {

            model =
                await modelModule.loadModelConfig(
                    selectedId
                );

        }

        else {

            throw new Error(
                "API pemilihan model tidak tersedia."
            );

        }

        await renderModel(
            model
        );

        appState.modelReady =
            true;

        debug(
            "Model changed:",
            selectedId
        );

    } catch (error) {

        appState.modelReady =
            false;

        showError(
            error?.message ||
            "Model gagal dimuat."
        );

    } finally {

        hideLoading();

    }

}


/* =========================================================
   BIND MODEL EVENT
========================================================= */

function bindModelEvent() {

    const elements =
        dom();

    const select =
        elements.modelSelect;

    if (!select) {

        throw new Error(
            "Element #modelSelect tidak ditemukan."
        );

    }

    if (
        select.dataset.genzModelBound ===
        "true"
    ) {

        return;

    }

    select.addEventListener(
        "change",
        handleModelChange
    );

    select.dataset.genzModelBound =
        "true";

    debug(
        "Model select event bound."
    );

}


/* =========================================================
   FORM RESET
========================================================= */

function bindResetEvent() {

    const elements =
        dom();

    if (
        !elements.resetButton
    ) {

        return;

    }

    if (
        elements.resetButton.dataset.genzResetBound ===
        "true"
    ) {

        return;

    }

    elements.resetButton.addEventListener(
        "click",
        event => {

            event.preventDefault();

            const formModule =
                appState.modules.form;

            if (
                formModule &&
                typeof formModule.reset ===
                    "function"
            ) {

                try {

                    formModule.reset();

                } catch (
                    error
                ) {

                    console.warn(
                        "[GEN-Z.AI][Generate] Form reset gagal:",
                        error
                    );

                }

            }

        }
    );

    elements.resetButton.dataset.genzResetBound =
        "true";

}


/* =========================================================
   AUTH INITIALIZATION
========================================================= */

async function initializeAuth() {

    const authModule =
        appState.modules.auth;

    if (!authModule) {

        return;

    }

    /*
     * Auth bridge/navigation sudah mengurus
     * OWNER + account credit.

     * Di sini kita hanya sinkronkan state,
     * bukan mengganti tampilan yang sudah benar.
     */

    try {

        if (
            typeof authModule.initialize ===
                "function"
        ) {

            await authModule.initialize();

        }

        else if (
            typeof authModule.init ===
                "function"
        ) {

            await authModule.init();

        }

        appState.authReady =
            true;

        appState.profileReady =
            true;

    } catch (error) {

        /*
         * Jangan membuang auth bridge hanya karena
         * module auth internal gagal.
         */

        console.warn(
            "[GEN-Z.AI][Generate] Internal auth sync warning:",
            error
        );

        appState.authReady =
            true;

    }

}


/* =========================================================
   VALIDATE DOM
========================================================= */

function validateDOM() {

    const elements =
        dom();

    const required = [

        "modelSelector",
        "modelSelect",
        "dynamicFields",
        "generateButton"

    ];

    const missing =
        required.filter(
            key =>
                !elements[key]
        );

    if (
        missing.length
    ) {

        throw new Error(
            "DOM Generate tidak lengkap: " +
            missing.join(", ")
        );

    }

    return true;

}


/* =========================================================
   BOOTSTRAP
========================================================= */

async function bootstrap() {

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

        debug(
            "Bootstrap started."
        );

        validateDOM();

        /*
         * Load modules terlebih dahulu.
         */

        await loadCoreModules();

        /*
         * Initialize state DOM.
         */

        const stateModule =
            appState.modules.state;

        if (
            typeof stateModule.initializeGenerateElements ===
                "function"
        ) {

            stateModule.initializeGenerateElements();

        }

        /*
         * Auth tidak boleh menghalangi model.
         */

        await initializeAuth();

        /*
         * Bind event model sebelum model
         * di-load agar tidak kehilangan event.
         */

        bindModelEvent();

        bindResetEvent();

        /*
         * MODEL.
         *
         * Ini bagian yang sebelumnya tidak sampai
         * ke UI.
         */

        showLoading(
            "Memuat model..."
        );

        hideError();

        await initializeModel();

        /*
         * Pastikan selector terlihat.
         */

        const elements =
            dom();

        if (
            elements.modelSelector
        ) {

            elements.modelSelector.hidden =
                false;

            elements.modelSelector.style.display =
                "";

        }

        if (
            elements.modelSelect
        ) {

            elements.modelSelect.hidden =
                false;

            elements.modelSelect.style.display =
                "";

        }

        if (
            elements.dynamicFields
        ) {

            elements.dynamicFields.hidden =
                false;

        }

        appState.initialized =
            true;

        debug(
            "Bootstrap completed successfully."
        );

    } catch (error) {

        console.error(
            "[GEN-Z.AI][Generate] Bootstrap gagal:",
            error
        );

        /*
         * Auth yang sudah tampil tetap dibiarkan.
         */

        showError(
            error?.message ||
            "Generate gagal diinisialisasi."
        );

    } finally {

        appState.initializing =
            false;

        hideLoading();

    }

}


/* =========================================================
   GLOBAL DEBUG API
========================================================= */

window.GENZGenerateApp =
    Object.freeze({

        state:
            appState,

        bootstrap,

        getCurrentModel

    });


/* =========================================================
   START
========================================================= */

function start() {

    bootstrap().catch(
        error => {

            console.error(
                "[GEN-Z.AI][Generate] Fatal bootstrap error:",
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
        start,
        {
            once:
                true
        }
    );

} else {

    start();

}
