/* =========================================================
   GEN-Z.AI
   GENERATE APP MODULE
   ---------------------------------------------------------
   File:
   generate/assets/js/generate-app.js

   Tanggung jawab:
   - Bootstrap halaman Generate
   - Load module Generate
   - Menyiapkan Auth sebelum Model
   - Load model configuration
   - Render model information
   - Render model credit
   - Render dynamic parameter form
   - Bind model change
   - Bind reset

   PENTING:
   - Account Credit tetap dari profiles.credits
   - Role tetap dari navigation / early auth bridge
   - Model Usage Credit dari konfigurasi model
   - State HARUS menggunakan SATU instance generate-state.js
========================================================= */

"use strict";


/* =========================================================
   MODULE PATH
========================================================= */

const STATE_MODULE =
    "./generate-state.js";

const AUTH_MODULE =
    "./generate-auth.js";

const UI_MODULE =
    "./generate-ui.js";

const MODEL_MODULE =
    "./generate-model.js";

const FORM_MODULE =
    "./generate-form.js";

const VALIDATION_MODULE =
    "./generate-validation.js";

const REQUEST_MODULE =
    "./generate-request.js";

const POLLING_MODULE =
    "./generate-polling.js";


/* =========================================================
   APPLICATION STATE
========================================================= */

const appState = {

    initialized:
        false,

    initializing:
        false,

    authReady:
        false,

    profileReady:
        false,

    modelReady:
        false,

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
   DEBUG
========================================================= */

function debug(...args) {

    console.debug(
        "[GEN-Z.AI][Generate]",
        ...args
    );

}


/* =========================================================
   DOM
========================================================= */

function getDOM() {

    return {

        modelSelector:
            document.getElementById(
                "modelSelector"
            ),

        modelSelect:
            document.getElementById(
                "modelSelect"
            ),

        dynamicFields:
            document.getElementById(
                "dynamicFields"
            ),

        generateForm:
            document.getElementById(
                "generateForm"
            ),

        generateButton:
            document.getElementById(
                "generateButton"
            ),

        generateCreditCost:
            document.getElementById(
                "generateCreditCost"
            ),

        generateCreditValue:
            document.getElementById(
                "generateCreditValue"
            ),

        modelName:
            document.getElementById(
                "modelName"
            ),

        modelDescription:
            document.getElementById(
                "modelDescription"
            ),

        providerName:
            document.getElementById(
                "providerName"
            ),

        modelMeta:
            document.getElementById(
                "modelMeta"
            ),

        loading:
            document.getElementById(
                "generateLoading"
            ),

        status:
            document.getElementById(
                "generateStatus"
            ),

        pageError:
            document.getElementById(
                "generateError"
            ),

        pageErrorMessage:
            document.getElementById(
                "generateErrorMessage"
            ),

        resetButton:
            document.getElementById(
                "resetGenerateButton"
            )
    };

}


/* =========================================================
   LOAD MODULE
   ---------------------------------------------------------
   JANGAN CACHE-BUST INTERNAL MODULE.

   Semua module harus mendapatkan instance state yang sama.
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

        debug(
            "Loading module:",
            name,
            path
        );


        /*
         * PENTING:
         *
         * Jangan:
         *
         * import(`${path}?v=${Date.now()}`)
         *
         * karena itu membuat module instance berbeda.
         */
        const module =
            await import(path);


        if (
            !module
        ) {

            throw new Error(
                `Module ${name} kosong.`
            );

        }


        appState.modules[name] =
            module;


        debug(
            "Module loaded:",
            name,
            Object.keys(module)
        );


        return module;

    } catch (error) {

        console.error(
            `[GEN-Z.AI][Generate] Module ${name} gagal dimuat:`,
            error
        );


        if (
            !required
        ) {

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
     * STATE
     */
    await loadModule(
        "state",
        STATE_MODULE,
        true
    );


    /*
     * AUTH
     */
    await loadModule(
        "auth",
        AUTH_MODULE,
        true
    );


    /*
     * UI
     */
    await loadModule(
        "ui",
        UI_MODULE,
        true
    );


    /*
     * MODEL
     */
    await loadModule(
        "model",
        MODEL_MODULE,
        true
    );


    /*
     * FORM
     */
    await loadModule(
        "form",
        FORM_MODULE,
        true
    );


    /*
     * OPTIONAL
     */
    await loadModule(
        "validation",
        VALIDATION_MODULE,
        false
    );


    await loadModule(
        "request",
        REQUEST_MODULE,
        false
    );


    await loadModule(
        "polling",
        POLLING_MODULE,
        false
    );


    return appState.modules;

}


/* =========================================================
   ERROR
========================================================= */

function showError(
    message
) {

    const elements =
        getDOM();

    const text =
        String(
            message ||
            "Terjadi kesalahan."
        );


    console.error(
        "[GEN-Z.AI][Generate]",
        text
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
            text;

    }


    if (
        elements.status
    ) {

        elements.status.textContent =
            text;

    }

}


/* =========================================================
   HIDE ERROR
========================================================= */

function hideError() {

    const elements =
        getDOM();


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
   LOADING
========================================================= */

function showLoading(
    message = "Memuat..."
) {

    const elements =
        getDOM();


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


function hideLoading() {

    const elements =
        getDOM();


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
   MODEL ID
========================================================= */

function getModelId(
    model
) {

    return String(

        model?.model_id ||

        model?.id ||

        model?.model?.model_id ||

        model?.model?.id ||

        ""

    ).trim();

}


/* =========================================================
   MODEL NAME
========================================================= */

function getModelName(
    model
) {

    return String(

        model?.model_name ||

        model?.name ||

        model?.model?.model_name ||

        model?.model?.name ||

        model?.repository?.model_name ||

        getModelId(model) ||

        "Model"

    ).trim();

}


/* =========================================================
   PROVIDER NAME
========================================================= */

function getProviderName(
    model
) {

    if (
        typeof model?.provider ===
        "object"
    ) {

        return String(

            model.provider.provider_name ||

            model.provider.name ||

            "-"

        ).trim();

    }


    if (
        typeof model?.provider ===
        "string"
    ) {

        return String(
            model.provider
        ).trim();

    }


    return String(

        model?.provider_name ||

        model?.providerName ||

        model?.model?.provider_name ||

        model?.repository?.provider_name ||

        "-"

    ).trim();

}


/* =========================================================
   MODEL TYPE
========================================================= */

function getModelType(
    model
) {

    return String(

        model?.type ||

        model?.model_type ||

        model?.modelType ||

        model?.model?.type ||

        model?.model?.model_type ||

        ""

    ).trim();

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


    const pricing =
        model.pricing &&
        typeof model.pricing ===
        "object"

            ? model.pricing

            : {};


    const values = [

        pricing.credit_final,

        model.credit_final,

        pricing.creditFinal,

        model.creditFinal,

        pricing.credit_cost,

        model.credit_cost

    ];


    for (
        const value of values
    ) {

        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {

            continue;

        }


        const number =
            Number(value);


        if (
            Number.isFinite(number)
        ) {

            return number;

        }

    }


    return null;

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
   ---------------------------------------------------------
   HANYA CREDIT PEMAKAIAN MODEL.
   TIDAK MENYENTUH profiles.credits.
========================================================= */

function renderModelCredit(
    model
) {

    const elements =
        getDOM();

    const credit =
        getModelCredit(model);

    const formatted =
        formatCredit(credit);


    if (
        elements.generateCreditCost
    ) {

        elements.generateCreditCost.textContent =
            formatted;

        elements.generateCreditCost.hidden =
            false;

        elements.generateCreditCost.style.display =
            "";

    }


    if (
        elements.generateCreditValue
    ) {

        elements.generateCreditValue.textContent =
            formatted;

        elements.generateCreditValue.hidden =
            false;

        elements.generateCreditValue.style.display =
            "";

    }


    debug(
        "MODEL CREDIT:",
        {
            model:
                getModelId(model),

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
        getDOM();


    if (
        !model
    ) {

        return;

    }


    if (
        elements.modelName
    ) {

        elements.modelName.textContent =
            getModelName(model);

    }


    if (
        elements.modelDescription
    ) {

        elements.modelDescription.textContent =
            String(

                model.description ||

                model.model?.description ||

                ""

            );

    }


    if (
        elements.providerName
    ) {

        elements.providerName.textContent =
            getProviderName(model);

    }


    if (
        elements.modelMeta
    ) {

        const id =
            getModelId(model);

        const type =
            getModelType(model);


        elements.modelMeta.textContent =
            type
                ? `${id} • ${type}`
                : id;

    }

}


/* =========================================================
   GET CURRENT MODEL
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
   FORCE STATE MODEL
========================================================= */

function setCurrentModel(
    model
) {

    const state =
        appState.modules.state;


    if (
        !state ||
        typeof state.setCurrentModel !==
        "function"
    ) {

        throw new Error(
            "generate-state.js tidak memiliki setCurrentModel()."
        );

    }


    state.setCurrentModel(
        model
    );


    /*
     * Verifikasi langsung.
     */
    const verified =
        typeof state.getCurrentModel ===
        "function"

            ? state.getCurrentModel()

            : null;


    if (
        !verified ||
        getModelId(verified) !==
        getModelId(model)
    ) {

        throw new Error(
            "Current model gagal disimpan ke Generate State."
        );

    }


    debug(
        "STATE CURRENT MODEL:",
        {
            id:
                getModelId(verified),

            parameters:
                verified?.parameters,

            parameterKeys:
                verified?.parameters &&
                typeof verified.parameters ===
                "object"

                    ? Object.keys(
                        verified.parameters
                    )

                    : []
        }
    );


    return verified;

}


/* =========================================================
   RENDER FORM
   ---------------------------------------------------------
   INI BAGIAN PALING PENTING.
========================================================= */

async function renderForm(
    model
) {

    const elements =
        getDOM();

    const formModule =
        appState.modules.form;


    if (
        !elements.dynamicFields
    ) {

        throw new Error(
            "Element #dynamicFields tidak ditemukan."
        );

    }


    if (
        !formModule
    ) {

        throw new Error(
            "Module generate-form.js tidak tersedia."
        );

    }


    /*
     * Simpan model ke state yang SAMA
     * dengan yang digunakan generate-form.js.
     */
    setCurrentModel(
        model
    );


    /*
     * Bersihkan form lama.
     */
    elements.dynamicFields.innerHTML =
        "";


    /*
     * Cari API render.
     */
    if (
        typeof formModule.renderGenerateForm ===
        "function"
    ) {

        await formModule.renderGenerateForm();

    }

    else if (
        typeof formModule.render ===
        "function"
    ) {

        await formModule.render();

    }

    else if (
        typeof formModule.init ===
        "function"
    ) {

        await formModule.init();

    }

    else {

        throw new Error(
            "generate-form.js tidak memiliki renderGenerateForm(), render(), atau init()."
        );

    }


    /*
     * Pastikan container tampil.
     */
    elements.dynamicFields.hidden =
        false;

    elements.dynamicFields.style.display =
        "grid";


    if (
        elements.generateForm
    ) {

        elements.generateForm.hidden =
            false;

    }


    const children =
        elements.dynamicFields.children.length;


    debug(
        "DYNAMIC FORM RESULT:",
        {
            model:
                getModelId(model),

            children,

            parameters:
                model?.parameters,

            parameterKeys:
                model?.parameters &&
                typeof model.parameters ===
                "object"

                    ? Object.keys(
                        model.parameters
                    )

                    : []
        }
    );


    /*
     * Jangan diam-diam gagal.
     *
     * Jika model memang punya parameter tetapi
     * generate-form tidak menghasilkan element,
     * tampilkan pesan diagnostik yang jelas.
     */
    if (
        children === 0
    ) {

        const parameters =
            model?.parameters;


        let hasParameters =
            false;


        if (
            Array.isArray(parameters)
        ) {

            hasParameters =
                parameters.length > 0;

        }

        else if (
            parameters &&
            typeof parameters ===
            "object"
        ) {

            hasParameters =
                Object.keys(
                    parameters
                ).length > 0;

        }


        if (
            hasParameters
        ) {

            console.error(
                "[GEN-Z.AI][Generate] MODEL MEMILIKI PARAMETER TETAPI FORM KOSONG.",
                {
                    model,
                    parameters
                }
            );


            throw new Error(
                "Konfigurasi parameter model tersedia, tetapi form parameter gagal dirender."
            );

        }

        else {

            console.warn(
                "[GEN-Z.AI][Generate] Model tidak memiliki parameter.",
                model
            );

        }

    }

}


/* =========================================================
   RENDER COMPLETE MODEL
========================================================= */

async function renderModel(
    model
) {

    if (
        !model
    ) {

        throw new Error(
            "Current model kosong."
        );

    }


    /*
     * STEP 1
     * Model information
     */
    renderModelInformation(
        model
    );


    /*
     * STEP 2
     * Model usage credit
     */
    renderModelCredit(
        model
    );


    /*
     * STEP 3
     * Dynamic parameters
     */
    await renderForm(
        model
    );


    appState.modelReady =
        true;


    debug(
        "COMPLETE MODEL UI READY:",
        {
            id:
                getModelId(model),

            name:
                getModelName(model),

            provider:
                getProviderName(model),

            credit:
                getModelCredit(model)
        }
    );

}


/* =========================================================
   INITIALIZE AUTH
========================================================= */

async function initializeAuth() {

    const auth =
        appState.modules.auth;


    if (
        !auth
    ) {

        throw new Error(
            "Module generate-auth.js tidak tersedia."
        );

    }


    /*
     * Supabase.
     */
    if (
        typeof auth.loadSupabase ===
        "function"
    ) {

        await auth.loadSupabase();

    }


    /*
     * User.
     */
    let user =
        null;


    if (
        typeof auth.loadCurrentUser ===
        "function"
    ) {

        try {

            user =
                await auth.loadCurrentUser();

        } catch (error) {

            user =
                window.GENZ_CURRENT_USER ||
                window.GENZ_NAVIGATION_USER ||
                null;


            if (
                !user
            ) {

                throw error;

            }

        }

    }


    /*
     * Profile.
     *
     * Ini hanya sinkronisasi internal.
     * Badge Owner + account credit tetap milik
     * early auth bridge/navigation.
     */
    let profile =
        null;


    if (
        typeof auth.loadProfile ===
        "function"
    ) {

        try {

            profile =
                await auth.loadProfile();

        } catch (error) {

            console.warn(
                "[GEN-Z.AI][Generate] Profile sync warning:",
                error
            );


            profile =
                window.GENZ_CURRENT_PROFILE ||
                window.GENZ_NAVIGATION_PROFILE ||
                null;

        }

    }


    if (
        !user &&
        typeof auth.ensureAuthenticated ===
        "function"
    ) {

        const result =
            await auth.ensureAuthenticated();


        user =
            result?.user ||
            null;


        profile =
            result?.profile ||
            profile ||
            null;

    }


    appState.authReady =
        Boolean(user);


    appState.profileReady =
        Boolean(

            profile ||

            window.GENZ_CURRENT_PROFILE ||

            window.GENZ_NAVIGATION_PROFILE

        );


    debug(
        "AUTH READY:",
        {
            user:
                Boolean(user),

            profile:
                Boolean(
                    profile ||
                    window.GENZ_CURRENT_PROFILE ||
                    window.GENZ_NAVIGATION_PROFILE
                )
        }
    );


    return {
        user,
        profile
    };

}


/* =========================================================
   INITIALIZE MODEL
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


    let result =
        null;


    /*
     * Primary API.
     */
    if (
        typeof modelModule.resolveInitialModel ===
        "function"
    ) {

        debug(
            "resolveInitialModel()"
        );


        result =
            await modelModule.resolveInitialModel();

    }

    else {

        /*
         * Fallback.
         */
        if (
            typeof modelModule.loadAvailableModels !==
            "function"
        ) {

            throw new Error(
                "API model configuration tidak tersedia."
            );

        }


        const models =
            await modelModule.loadAvailableModels();


        if (
            !Array.isArray(models) ||
            models.length === 0
        ) {

            throw new Error(
                "Tidak ada model aktif yang tersedia."
            );

        }


        let selectedId =
            "";


        if (
            typeof modelModule.renderModelSelector ===
            "function"
        ) {

            selectedId =
                modelModule.renderModelSelector(
                    models
                ) || "";

        }


        if (
            !selectedId
        ) {

            selectedId =
                String(
                    getDOM().modelSelect?.value ||
                    ""
                ).trim();

        }


        if (
            !selectedId
        ) {

            throw new Error(
                "Tidak ada model yang dapat dipilih."
            );

        }


        let selectedModel =
            null;


        if (
            typeof modelModule.selectModel ===
            "function"
        ) {

            selectedModel =
                await modelModule.selectModel(
                    selectedId
                );

        }

        else if (
            typeof modelModule.loadModelConfig ===
            "function"
        ) {

            selectedModel =
                await modelModule.loadModelConfig(
                    selectedId
                );

        }


        result = {

            model:
                selectedModel,

            models

        };

    }


    /*
     * Ambil model.
     */
    let model =
        result?.model ||
        getCurrentModel();


    /*
     * Beberapa API mengembalikan model
     * secara langsung.
     */
    if (
        !model &&
        result?.model_id
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
     * PAKSA MODEL MASUK KE STATE.
     */
    model =
        setCurrentModel(
            model
        );


    /*
     * Set selector.
     */
    const elements =
        getDOM();

    const id =
        getModelId(model);


    if (
        elements.modelSelect &&
        id
    ) {

        elements.modelSelect.value =
            id;

    }


    /*
     * RENDER SEMUANYA.
     */
    await renderModel(
        model
    );


    /*
     * Pastikan selector terlihat.
     */
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


    hideLoading();


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
        getDOM().modelSelect;


    const selectedId =
        String(
            select?.value ||
            ""
        ).trim();


    if (
        !selectedId
    ) {

        return;

    }


    try {

        hideError();

        showLoading(
            "Memuat model..."
        );


        const modelModule =
            appState.modules.model;


        if (
            !modelModule
        ) {

            throw new Error(
                "Module generate-model.js tidak tersedia."
            );

        }


        let model =
            null;


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


        if (
            !model
        ) {

            throw new Error(
                "Konfigurasi model kosong."
            );

        }


        /*
         * State tunggal.
         */
        model =
            setCurrentModel(
                model
            );


        /*
         * Render model + form.
         */
        await renderModel(
            model
        );


        appState.modelReady =
            true;


        debug(
            "MODEL CHANGED:",
            selectedId
        );

    } catch (error) {

        appState.modelReady =
            false;


        console.error(
            "[GEN-Z.AI][Generate] Model change gagal:",
            error
        );


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

    const select =
        getDOM().modelSelect;


    if (
        !select
    ) {

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
        "Model event bound."
    );

}


/* =========================================================
   BIND RESET
========================================================= */

function bindResetEvent() {

    const button =
        getDOM().resetButton;


    if (
        !button
    ) {

        return;

    }


    if (
        button.dataset.genzResetBound ===
        "true"
    ) {

        return;

    }


    button.addEventListener(
        "click",
        event => {

            event.preventDefault();


            const form =
                appState.modules.form;


            if (
                form &&
                typeof form.reset ===
                "function"
            ) {

                try {

                    form.reset();

                } catch (error) {

                    console.warn(
                        "[GEN-Z.AI][Generate] Reset gagal:",
                        error
                    );

                }

            }

        }
    );


    button.dataset.genzResetBound =
        "true";

}


/* =========================================================
   VALIDATE DOM
========================================================= */

function validateDOM() {

    const elements =
        getDOM();


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


        /*
         * 1. DOM
         */
        validateDOM();


        /*
         * 2. MODULE
         */
        await loadCoreModules();


        /*
         * 3. STATE DOM
         */
        const state =
            appState.modules.state;


        if (
            typeof state.initializeGenerateElements ===
            "function"
        ) {

            state.initializeGenerateElements();

        }


        /*
         * 4. AUTH
         */
        await initializeAuth();


        /*
         * 5. EVENTS
         */
        bindModelEvent();

        bindResetEvent();


        /*
         * 6. MODEL
         */
        hideError();

        showLoading(
            "Memuat model..."
        );


        await initializeModel();


        /*
         * 7. COMPLETE
         */
        const elements =
            getDOM();


        if (
            elements.dynamicFields
        ) {

            elements.dynamicFields.hidden =
                false;

        }


        if (
            elements.generateForm
        ) {

            elements.generateForm.hidden =
                false;

        }


        appState.initialized =
            true;


        debug(
            "Bootstrap completed."
        );

    } catch (error) {

        console.error(
            "[GEN-Z.AI][Generate] Bootstrap gagal:",
            error
        );


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
   GLOBAL DEBUG
========================================================= */

window.GENZGenerateApp =
    Object.freeze({

        state:
            appState,

        bootstrap,

        getCurrentModel,

        getModules:
            () =>
                appState.modules

    });


/* =========================================================
   START
========================================================= */

function start() {

    bootstrap().catch(
        error => {

            console.error(
                "[GEN-Z.AI][Generate] Fatal:",
                error
            );

        }
    );

}


/* =========================================================
   DOM READY
========================================================= */

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
