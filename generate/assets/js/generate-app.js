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
   - Sinkronisasi Generate State
   - Sinkronisasi tombol Generate
   - Bind model change
   - Bind reset

   PENTING:
   - Account Credit tetap dari profiles.credits
   - Role tetap dari navigation / early auth bridge
   - Model Usage Credit dari konfigurasi model
   - State HARUS menggunakan SATU instance generate-state.js
   - Generate button hanya aktif jika model benar-benar siap
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
   ---------------------------------------------------------
   ID HARUS SAMA DENGAN generate/index.html
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

        /*
         * CANONICAL IDs
         */

        loading:
            document.getElementById(
                "loading"
            ),

        status:
            document.getElementById(
                "status"
            ),

        pageError:
            document.getElementById(
                "pageError"
            ),

        pageErrorMessage:
            document.getElementById(
                "pageErrorMessage"
            ),

        resetButton:
            document.getElementById(
                "resetButton"
            ),

        /*
         * Compatibility
         */

        generateCard:
            document.getElementById(
                "generateCard"
            ),

        creditBadge:
            document.getElementById(
                "creditBadge"
            ),

        roleBadge:
            document.getElementById(
                "roleBadge"
            )

    };

}


/* =========================================================
   LOAD MODULE
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
         * JANGAN CACHE BUST.
         *
         * Semua module harus menggunakan instance
         * generate-state.js yang sama.
         */

        const module =
            await import(
                path
            );


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
            Object.keys(
                module
            )
        );


        return module;

    } catch (
        error
    ) {

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

    await loadModule(
        "state",
        STATE_MODULE,
        true
    );


    await loadModule(
        "auth",
        AUTH_MODULE,
        true
    );


    await loadModule(
        "ui",
        UI_MODULE,
        true
    );


    await loadModule(
        "model",
        MODEL_MODULE,
        true
    );


    await loadModule(
        "form",
        FORM_MODULE,
        true
    );


    /*
     * OPTIONAL MODULE
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

        elements.status.hidden =
            false;

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

        elements.loading.style.visibility =
            "visible";

        elements.loading.style.opacity =
            "1";

        elements.loading.setAttribute(
            "aria-hidden",
            "false"
        );

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
        getDOM();


    if (
        elements.loading
    ) {

        elements.loading.hidden =
            true;

        elements.loading.style.display =
            "none";

        elements.loading.style.visibility =
            "hidden";

        elements.loading.style.opacity =
            "0";

        elements.loading.setAttribute(
            "aria-hidden",
            "true"
        );

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

        getModelId(
            model
        ) ||

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
        const value
        of values
    ) {

        if (
            value ===
                null ||
            value ===
                undefined ||
            value ===
                ""
        ) {

            continue;

        }


        const number =
            Number(
                value
            );


        if (
            Number.isFinite(
                number
            )
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
        value ===
            null ||
        value ===
            undefined
    ) {

        return "-";

    }


    const number =
        Number(
            value
        );


    if (
        !Number.isFinite(
            number
        )
    ) {

        return "-";

    }


    return new Intl.NumberFormat(
        "id-ID",
        {
            maximumFractionDigits:
                2
        }
    ).format(
        number
    );

}


/* =========================================================
   RENDER MODEL CREDIT
   ---------------------------------------------------------
   PENTING:
   Credit ini adalah MODEL USAGE CREDIT.
   BUKAN Account Credit.
========================================================= */

function renderModelCredit(
    model
) {

    const elements =
        getDOM();


    const credit =
        getModelCredit(
            model
        );


    const formatted =
        formatCredit(
            credit
        );


    /*
     * Nilai credit di dalam tombol Generate.
     */

    if (
        elements.generateCreditCost
    ) {

        elements.generateCreditCost.textContent =
            formatted;

        elements.generateCreditCost.hidden =
            false;

    }


    /*
     * Compatibility / alternate display.
     */

    if (
        elements.generateCreditValue
    ) {

        elements.generateCreditValue.textContent =
            formatted;

    }


    debug(
        "MODEL CREDIT:",
        {
            model:
                getModelId(
                    model
                ),

            credit,

            formatted
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
            getModelName(
                model
            );

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
            getProviderName(
                model
            );

    }


    if (
        elements.modelMeta
    ) {

        const id =
            getModelId(
                model
            );


        const type =
            getModelType(
                model
            );


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
   SET CURRENT MODEL
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


    const verified =
        typeof state.getCurrentModel ===
        "function"

            ? state.getCurrentModel()

            : null;


    if (
        !verified ||
        getModelId(
            verified
        ) !==
        getModelId(
            model
        )
    ) {

        throw new Error(
            "Current model gagal disimpan ke Generate State."
        );

    }


    return verified;

}


/* =========================================================
   MARK MODEL READY
   ---------------------------------------------------------
   Ini bagian penting untuk masalah:
   Generate button tetap disabled.
========================================================= */

function markModelReady(
    model
) {

    const state =
        appState.modules.state;


    const modelId =
        getModelId(
            model
        );


    const validModel =
        Boolean(
            model &&
            modelId
        );


    /*
     * State utama aplikasi.
     */

    appState.modelReady =
        validModel;


    /*
     * Sinkronisasi dengan generate-state.js.
     *
     * generate-ui.js menggunakan isModelReady(),
     * yang bergantung pada state.modelLoaded.
     */

    if (
        state &&
        typeof state.setModelLoaded ===
        "function"
    ) {

        state.setModelLoaded(
            validModel
        );

    }


    debug(
        "MODEL READY STATE:",
        {
            modelId,

            validModel,

            appStateModelReady:
                appState.modelReady
        }
    );


    return validModel;

}


/* =========================================================
   ENABLE GENERATE
   ---------------------------------------------------------
   Jangan hanya mengubah HTML button.
   State dan UI harus sama-sama sinkron.
========================================================= */

function enableGenerateButton(
    model = null
) {

    const elements =
        getDOM();


    const currentModel =
        model ||
        getCurrentModel();


    const modelId =
        getModelId(
            currentModel
        );


    const modelReady =
        Boolean(
            currentModel &&
            modelId
        );


    /*
     * Jangan pernah mengaktifkan tombol
     * jika model belum benar-benar tersedia.
     */

    if (
        !modelReady
    ) {

        appState.modelReady =
            false;


        if (
            elements.generateButton
        ) {

            elements.generateButton.disabled =
                true;

            elements.generateButton.removeAttribute(
                "aria-busy"
            );

        }


        return false;

    }


    appState.modelReady =
        true;


    /*
     * UI module adalah pemilik state visual
     * Generate button.
     */

    const ui =
        appState.modules.ui;


    if (
        ui &&
        typeof ui.enableGeneration ===
        "function"
    ) {

        try {

            ui.enableGeneration();

        } catch (
            error
        ) {

            console.warn(
                "[GEN-Z.AI][Generate] UI enableGeneration warning:",
                error
            );

        }

    }


    /*
     * Safety fallback.
     *
     * Jika UI module tidak berhasil mengubah tombol,
     * app module tetap memastikan tombol aktif.
     */

    if (
        elements.generateButton
    ) {

        elements.generateButton.disabled =
            false;

        elements.generateButton.removeAttribute(
            "aria-busy"
        );

    }


    /*
     * Credit HARUS dirender setelah enable.
     * Jangan sampai tombol aktif tetapi credit hilang.
     */

    renderModelCredit(
        currentModel
    );


    debug(
        "GENERATE BUTTON ENABLED:",
        {
            modelId,

            modelName:
                getModelName(
                    currentModel
                ),

            credit:
                getModelCredit(
                    currentModel
                )
        }
    );


    return true;

}


/* =========================================================
   DISABLE GENERATE
========================================================= */

function disableGenerateButton() {

    const elements =
        getDOM();


    appState.modelReady =
        false;


    if (
        elements.generateButton
    ) {

        elements.generateButton.disabled =
            true;

        elements.generateButton.removeAttribute(
            "aria-busy"
        );

    }


    const ui =
        appState.modules.ui;


    if (
        ui &&
        typeof ui.disableGeneration ===
        "function"
    ) {

        try {

            ui.disableGeneration();

        } catch (
            error
        ) {

            console.warn(
                "[GEN-Z.AI][Generate] UI disableGeneration warning:",
                error
            );

        }

    }

}


/* =========================================================
   RENDER FORM
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


    setCurrentModel(
        model
    );


    elements.dynamicFields.innerHTML =
        "";


    let result =
        null;


    if (
        typeof formModule.renderGenerateForm ===
        "function"
    ) {

        result =
            await formModule.renderGenerateForm(
                model
            );

    }

    else if (
        typeof formModule.render ===
        "function"
    ) {

        result =
            await formModule.render(
                model
            );

    }

    else if (
        typeof formModule.init ===
        "function"
    ) {

        result =
            await formModule.init(
                model
            );

    }

    else {

        throw new Error(
            "generate-form.js tidak memiliki API render yang valid."
        );

    }


    elements.dynamicFields.hidden =
        false;


    if (
        elements.generateForm
    ) {

        elements.generateForm.hidden =
            false;

    }


    /*
     * Jangan menganggap form gagal hanya karena
     * model tidak memiliki parameter.
     */

    const children =
        elements.dynamicFields.children.length;


    debug(
        "DYNAMIC FORM:",
        {
            model:
                getModelId(
                    model
                ),

            rendered:
                result,

            children
        }
    );


    return true;

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
     * Model wajib mempunyai model_id.
     */

    const modelId =
        getModelId(
            model
        );


    if (
        !modelId
    ) {

        throw new Error(
            "Model tidak memiliki model_id yang valid."
        );

    }


    /*
     * 1. Simpan ke SINGLE Generate State.
     */

    const verifiedModel =
        setCurrentModel(
            model
        );


    /*
     * 2. Model info.
     */

    renderModelInformation(
        verifiedModel
    );


    /*
     * 3. Model Usage Credit.
     *
     * Tetap ditampilkan di tombol Generate.
     */

    renderModelCredit(
        verifiedModel
    );


    /*
     * 4. Dynamic parameter form.
     */

    await renderForm(
        verifiedModel
    );


    /*
     * 5. Tandai model sudah siap.
     *
     * Ini penting karena generate-ui.js
     * membaca state.modelLoaded.
     */

    const ready =
        markModelReady(
            verifiedModel
        );


    if (
        !ready
    ) {

        disableGenerateButton();


        throw new Error(
            "Model belum siap digunakan."
        );

    }


    /*
     * 6. Aktifkan tombol Generate.
     */

    enableGenerateButton(
        verifiedModel
    );


    /*
     * 7. Render ulang credit sebagai final guard.
     */

    renderModelCredit(
        verifiedModel
    );


    debug(
        "MODEL UI READY:",
        {
            id:
                modelId,

            name:
                getModelName(
                    verifiedModel
                ),

            provider:
                getProviderName(
                    verifiedModel
                ),

            credit:
                getModelCredit(
                    verifiedModel
                ),

            modelReady:
                appState.modelReady
        }
    );


    return verifiedModel;

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
     * Load Supabase.
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

        } catch (
            error
        ) {

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

        } catch (
            error
        ) {

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


    /*
     * Fallback authentication.
     */

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
        Boolean(
            user
        );


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
                appState.authReady,

            profile:
                appState.profileReady
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
     * PRIMARY API
     */

    if (
        typeof modelModule.resolveInitialModel ===
        "function"
    ) {

        result =
            await modelModule.resolveInitialModel();

    }

    else {

        /*
         * FALLBACK API
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
            !Array.isArray(
                models
            ) ||
            models.length ===
                0
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
                ) ||
                "";

        }


        if (
            !selectedId
        ) {

            selectedId =
                String(
                    getDOM()
                        .modelSelect
                        ?.value ||
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


    let model =
        result?.model ||
        getCurrentModel();


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


    model =
        setCurrentModel(
            model
        );


    const elements =
        getDOM();


    const id =
        getModelId(
            model
        );


    if (
        !id
    ) {

        throw new Error(
            "Model berhasil dimuat tetapi model_id kosong."
        );

    }


    if (
        elements.modelSelect
    ) {

        elements.modelSelect.value =
            id;

    }


    /*
     * Render model lengkap.
     *
     * Fungsi ini juga:
     * - set modelLoaded
     * - render credit
     * - render form
     * - enable Generate button
     */

    await renderModel(
        model
    );


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

        elements.modelSelect.disabled =
            false;

        elements.modelSelect.hidden =
            false;

        elements.modelSelect.style.display =
            "";

    }


    if (
        elements.resetButton
    ) {

        elements.resetButton.disabled =
            false;

    }


    /*
     * Final safety synchronization.
     */

    enableGenerateButton(
        getCurrentModel()
    );


    return getCurrentModel();

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

        disableGenerateButton();

        return;

    }


    try {

        hideError();


        /*
         * Saat model sedang diganti,
         * tombol tidak boleh dipakai.
         */

        disableGenerateButton();


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


        model =
            setCurrentModel(
                model
            );


        /*
         * renderModel menangani seluruh sinkronisasi:
         * - model state
         * - model info
         * - credit
         * - form
         * - modelLoaded
         * - generate button
         */

        await renderModel(
            model
        );


        appState.modelReady =
            true;


        /*
         * Final guard.
         */

        enableGenerateButton(
            model
        );


    } catch (
        error
    ) {

        appState.modelReady =
            false;


        const state =
            appState.modules.state;


        if (
            state &&
            typeof state.setModelLoaded ===
            "function"
        ) {

            state.setModelLoaded(
                false
            );

        }


        console.error(
            "[GEN-Z.AI][Generate] Model change gagal:",
            error
        );


        showError(
            error?.message ||
            "Model gagal dimuat."
        );


        disableGenerateButton();

    } finally {

        hideLoading();

    }

}


/* =========================================================
   BIND MODEL EVENT
========================================================= */

function bindModelEvent() {

    const select =
        getDOM()
            .modelSelect;


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

}


/* =========================================================
   BIND RESET
========================================================= */

function bindResetEvent() {

    const button =
        getDOM()
            .resetButton;


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
        async event => {

            event.preventDefault();


            const form =
                appState.modules.form;


            if (
                !form
            ) {

                return;

            }


            try {

                if (
                    typeof form.reset ===
                    "function"
                ) {

                    await form.reset();

                }

                else if (
                    typeof form.resetDynamicFields ===
                    "function"
                ) {

                    await form.resetDynamicFields(
                        getCurrentModel()
                    );

                }


                /*
                 * Reset parameter tidak berarti
                 * model menjadi tidak siap.
                 *
                 * Model tetap aktif dan credit tetap
                 * harus tampil.
                 */

                const currentModel =
                    getCurrentModel();


                if (
                    currentModel &&
                    getModelId(
                        currentModel
                    )
                ) {

                    renderModelCredit(
                        currentModel
                    );


                    enableGenerateButton(
                        currentModel
                    );

                }

            } catch (
                error
            ) {

                console.error(
                    "[GEN-Z.AI][Generate] Reset gagal:",
                    error
                );

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

        "generateForm",

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
            missing.join(
                ", "
            )
        );

    }


    return true;

}


/* =========================================================
   INITIAL HIDE
========================================================= */

function initializeVisualState() {

    /*
     * Tombol Generate sengaja tetap disabled
     * sampai model berhasil diverifikasi.
     */

    disableGenerateButton();


    /*
     * Jangan tampilkan loading saat halaman baru
     * dibuka.
     *
     * Loading hanya digunakan saat:
     * - pergantian model
     * - proses Generate
     */

    hideLoading();


    hideError();


    const elements =
        getDOM();


    if (
        elements.status
    ) {

        elements.status.hidden =
            true;

        elements.status.textContent =
            "";

    }


    /*
     * Jangan menghapus credit.
     *
     * Credit akan dirender kembali setelah model
     * berhasil dimuat.
     */

}


/* =========================================================
   BOOTSTRAP
========================================================= */

async function bootstrap() {

    if (
        appState.initialized ||
        appState.initializing
    ) {

        return;

    }


    appState.initializing =
        true;


    initializeVisualState();


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
         *
         * Tidak memanggil showLoading().
         *
         * initializeModel() akan:
         * - load model
         * - set current model
         * - set modelLoaded
         * - render model
         * - render credit
         * - render form
         * - enable Generate button
         */

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


        /*
         * Final model/button synchronization.
         */

        const currentModel =
            getCurrentModel();


        if (
            currentModel &&
            getModelId(
                currentModel
            )
        ) {

            markModelReady(
                currentModel
            );


            renderModelCredit(
                currentModel
            );


            enableGenerateButton(
                currentModel
            );

        }

        else {

            disableGenerateButton();

        }


        appState.initialized =
            true;


        debug(
            "Bootstrap completed:",
            {
                model:
                    getModelId(
                        currentModel
                    ),

                modelReady:
                    appState.modelReady,

                modelCredit:
                    getModelCredit(
                        currentModel
                    ),

                generateButtonDisabled:
                    Boolean(
                        elements.generateButton?.disabled
                    )
            }
        );


    } catch (
        error
    ) {

        console.error(
            "[GEN-Z.AI][Generate] Bootstrap gagal:",
            error
        );


        appState.modelReady =
            false;


        const state =
            appState.modules.state;


        if (
            state &&
            typeof state.setModelLoaded ===
            "function"
        ) {

            state.setModelLoaded(
                false
            );

        }


        disableGenerateButton();


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

    bootstrap()
        .catch(
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

}

else {

    start();

}
