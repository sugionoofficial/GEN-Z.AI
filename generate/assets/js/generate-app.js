/* =========================================================
   GEN-Z.AI
   GENERATE APP MODULE
   ---------------------------------------------------------
   File:
   generate/assets/js/generate-app.js

   Tanggung jawab:
   - Bootstrap halaman Generate
   - Load module Generate secara berurutan
   - Menyiapkan Auth sebelum Model
   - Load model configuration
   - Render model information
   - Render model credit
   - Render dynamic parameter form
   - Bind model change
   - Bind reset
   - Tidak mengambil alih Account Credit / Role badge

   PENTING:
   - Owner + saldo akun tetap ditangani oleh
     early auth bridge di generate/index.html
   - Account credit:
       profiles.credits
   - Model usage credit:
       model.credit_final / model.pricing.credit_final
   - Jangan mencampur keduanya
========================================================= */


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

function debug(
    ...args
) {

    console.debug(
        "[GEN-Z.AI][Generate]",
        ...args
    );

}


/* =========================================================
   DOM
========================================================= */

function dom() {

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
            `Loading module: ${name}`,
            path
        );


        const module =
            await import(
                `${path}?v=${Date.now()}`
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
            `Module loaded: ${name}`
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
   ---------------------------------------------------------
   URUTAN SANGAT PENTING
========================================================= */

async function loadCoreModules() {

    /*
     * -----------------------------------------------------
     * 1. STATE
     * -----------------------------------------------------
     */

    await loadModule(
        "state",
        STATE_MODULE,
        true
    );


    /*
     * -----------------------------------------------------
     * 2. AUTH
     * -----------------------------------------------------
     */

    await loadModule(
        "auth",
        AUTH_MODULE,
        true
    );


    /*
     * -----------------------------------------------------
     * 3. UI
     * -----------------------------------------------------
     */

    await loadModule(
        "ui",
        UI_MODULE,
        true
    );


    /*
     * -----------------------------------------------------
     * 4. MODEL
     * -----------------------------------------------------
     */

    await loadModule(
        "model",
        MODEL_MODULE,
        true
    );


    /*
     * -----------------------------------------------------
     * 5. FORM
     * -----------------------------------------------------
     */

    await loadModule(
        "form",
        FORM_MODULE,
        true
    );


    /*
     * -----------------------------------------------------
     * OPTIONAL MODULES
     * -----------------------------------------------------
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
   SHOW ERROR
========================================================= */

function showError(
    message
) {

    const elements =
        dom();


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
        model?.model?.model_id ||
        model?.model?.id ||
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
        model?.model?.model_name ||
        model?.model?.name ||
        model?.repository?.model_name ||
        modelId(model) ||
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

function modelType(
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
   ---------------------------------------------------------
   SOURCE KHUSUS CREDIT PEMAKAIAN MODEL

   PRIORITAS:
   1. pricing.credit_final
   2. credit_final
   3. pricing.credit_cost
   4. credit_cost

   TIDAK PERNAH menggunakan:
   profiles.credits
========================================================= */

function modelCredit(
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


    const candidates = [

        pricing.credit_final,

        model.credit_final,

        model.pricing?.creditFinal,

        model.creditFinal,

        pricing.credit_cost,

        model.credit_cost

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
        value === null ||
        value === undefined
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
========================================================= */

function renderModelCredit(
    model
) {

    const elements =
        dom();


    const credit =
        modelCredit(
            model
        );


    const formatted =
        formatCredit(
            credit
        );


    /*
     * Credit di tombol Generate.
     */

    if (
        elements.generateCreditCost
    ) {

        elements.generateCreditCost.textContent =
            formatted;

        elements.generateCreditCost.style.display =
            "";

        elements.generateCreditCost.hidden =
            false;

    }


    if (
        elements.generateCreditValue
    ) {

        elements.generateCreditValue.textContent =
            formatted;

        elements.generateCreditValue.style.display =
            "";

        elements.generateCreditValue.hidden =
            false;

    }


    debug(
        "Model credit rendered:",
        {
            model:
                modelId(model),

            credit:
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


    if (
        !model
    ) {

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
            modelName(
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
            providerName(
                model
            );

    }


    if (
        elements.modelMeta
    ) {

        const id =
            modelId(
                model
            );


        const type =
            modelType(
                model
            );


        elements.modelMeta.textContent =
            type
                ? `${id} • ${type}`
                : id;

    }

}


/* =========================================================
   RENDER FORM
   ---------------------------------------------------------
   FORM HARUS MENERIMA CURRENT MODEL DARI STATE
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


    if (
        !model
    ) {

        elements.dynamicFields.innerHTML =
            "";

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
     * -----------------------------------------------------
     * PENTING
     * -----------------------------------------------------
     *
     * generate-form.js mengambil currentModel
     * dari generate-state.js.
     *
     * Pastikan state sudah berisi model.
     */

    const stateModule =
        appState.modules.state;


    if (
        stateModule &&
        typeof stateModule.setCurrentModel ===
            "function"
    ) {

        const stateModel =
            typeof stateModule.getCurrentModel ===
                "function"
                ? stateModule.getCurrentModel()
                : null;


        if (
            !stateModel ||
            modelId(stateModel) !==
                modelId(model)
        ) {

            stateModule.setCurrentModel(
                model
            );

        }

    }


    /*
     * -----------------------------------------------------
     * RENDER
     * -----------------------------------------------------
     */

    let rendered =
        false;


    if (
        typeof formModule.render ===
            "function"
    ) {

        await formModule.render();

        rendered =
            true;

    }


    else if (
        typeof formModule.renderGenerateForm ===
            "function"
    ) {

        await formModule.renderGenerateForm();

        rendered =
            true;

    }


    else if (
        typeof formModule.init ===
            "function"
    ) {

        await formModule.init();

        rendered =
            true;

    }


    if (
        !rendered
    ) {

        throw new Error(
            "generate-form.js tidak memiliki API render/init."
        );

    }


    /*
     * Pastikan container benar-benar terlihat.
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

        elements.generateForm.style.display =
            "";

    }


    debug(
        "Dynamic form rendered:",
        {
            children:
                elements.dynamicFields.children.length,

            model:
                modelId(model)
        }
    );


    /*
     * Jangan menganggap form kosong sebagai error
     * sebelum memeriksa struktur parameter model.
     */

    if (
        elements.dynamicFields.children.length ===
            0
    ) {

        console.warn(
            "[GEN-Z.AI][Generate] Dynamic form kosong.",
            {
                model:
                    model,

                parameters:
                    model?.parameters,

                configParameters:
                    model?.config?.parameters,

                parameterSchema:
                    model?.parameter_schema,

                parameterSchemaCamel:
                    model?.parameterSchema
            }
        );

    }

}


/* =========================================================
   RENDER COMPLETE MODEL UI
========================================================= */

async function renderModel(
    model
) {

    if (
        !model
    ) {

        return;

    }


    /*
     * Model information.
     */

    renderModelInformation(
        model
    );


    /*
     * Model usage credit.
     */

    renderModelCredit(
        model
    );


    /*
     * Dynamic parameters.
     */

    await renderForm(
        model
    );


    appState.modelReady =
        Boolean(
            modelId(
                model
            )
        );


    debug(
        "Complete model UI rendered."
    );

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


    showLoading(
        "Memuat model..."
    );


    debug(
        "Starting model initialization..."
    );


    let result =
        null;


    /*
     * -----------------------------------------------------
     * PRIMARY API
     * -----------------------------------------------------
     */

    if (
        typeof modelModule.resolveInitialModel ===
            "function"
    ) {

        debug(
            "Calling resolveInitialModel()"
        );


        result =
            await modelModule.resolveInitialModel();

    }


    /*
     * -----------------------------------------------------
     * FALLBACK
     * -----------------------------------------------------
     */

    else {

        let models =
            [];


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


        else {

            throw new Error(
                "API model selection tidak tersedia."
            );

        }


        result = {

            model:
                selectedModel,

            models

        };

    }


    /*
     * -----------------------------------------------------
     * RESOLVE CURRENT MODEL
     * -----------------------------------------------------
     */

    let model =
        result?.model ||
        getCurrentModel();


    /*
     * Beberapa API bisa mengembalikan
     * model langsung.
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
     * -----------------------------------------------------
     * PAKSA STATE CURRENT MODEL
     * -----------------------------------------------------
     */

    const stateModule =
        appState.modules.state;


    if (
        stateModule &&
        typeof stateModule.setCurrentModel ===
            "function"
    ) {

        stateModule.setCurrentModel(
            model
        );

    }


    /*
     * -----------------------------------------------------
     * SET SELECT VALUE
     * -----------------------------------------------------
     */

    const elements =
        dom();


    const id =
        modelId(
            model
        );


    if (
        elements.modelSelect &&
        id
    ) {

        elements.modelSelect.value =
            id;

    }


    /*
     * -----------------------------------------------------
     * RENDER UI
     * -----------------------------------------------------
     */

    await renderModel(
        model
    );


    debug(
        "MODEL READY:",
        {
            id:
                id,

            name:
                modelName(model),

            provider:
                providerName(model),

            type:
                modelType(model),

            credit:
                modelCredit(model),

            parameters:
                model.parameters
        }
    );


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


        else {

            throw new Error(
                "API pemilihan model tidak tersedia."
            );

        }


        if (
            !model
        ) {

            throw new Error(
                "Model tidak mengembalikan konfigurasi."
            );

        }


        /*
         * Pastikan state benar.
         */

        const stateModule =
            appState.modules.state;


        if (
            stateModule &&
            typeof stateModule.setCurrentModel ===
                "function"
        ) {

            stateModule.setCurrentModel(
                model
            );

        }


        /*
         * Render model + parameter.
         */

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

    const elements =
        dom();


    const select =
        elements.modelSelect;


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
        "Model select event bound."
    );

}


/* =========================================================
   BIND RESET
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
   ---------------------------------------------------------
   FIX:
   generate-auth.js TIDAK memiliki:
       initialize()
       init()

   API yang benar:
       loadSupabase()
       loadCurrentUser()
       loadProfile()
       ensureAuthenticated()

   Owner + account credit TIDAK disentuh.
========================================================= */

async function initializeAuth() {

    const authModule =
        appState.modules.auth;


    if (
        !authModule
    ) {

        throw new Error(
            "Module generate-auth.js tidak tersedia."
        );

    }


    debug(
        "Initializing Generate auth..."
    );


    /*
     * -----------------------------------------------------
     * 1. LOAD SUPABASE CLIENT
     * -----------------------------------------------------
     */

    if (
        typeof authModule.loadSupabase ===
            "function"
    ) {

        await authModule.loadSupabase();

        debug(
            "Supabase client siap."
        );

    }

    else {

        throw new Error(
            "generate-auth.js tidak memiliki loadSupabase()."
        );

    }


    /*
     * -----------------------------------------------------
     * 2. LOAD USER
     * -----------------------------------------------------
     */

    let user =
        null;


    if (
        typeof authModule.loadCurrentUser ===
            "function"
    ) {

        try {

            user =
                await authModule.loadCurrentUser();

        } catch (
            error
        ) {

            /*
             * Navigation sudah mempunyai user.
             * Gunakan sebagai fallback jika tersedia.
             */

            user =
                window.GENZ_CURRENT_USER ||
                window.GENZ_NAVIGATION_USER ||
                null;


            if (
                !user
            ) {

                throw error;

            }


            debug(
                "User menggunakan navigation fallback."
            );

        }

    }


    /*
     * -----------------------------------------------------
     * 3. PROFILE
     * -----------------------------------------------------
     */

    let profile =
        null;


    if (
        user &&
        typeof authModule.loadProfile ===
            "function"
    ) {

        try {

            profile =
                await authModule.loadProfile();

        } catch (
            error
        ) {

            /*
             * Jangan merusak Owner + account credit
             * yang sudah tampil melalui early bridge.
             */

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
     * -----------------------------------------------------
     * 4. ENSURE AUTHENTICATED FALLBACK
     * -----------------------------------------------------
     */

    if (
        !user &&
        typeof authModule.ensureAuthenticated ===
            "function"
    ) {

        const authenticated =
            await authModule.ensureAuthenticated();


        user =
            authenticated?.user ||
            null;


        profile =
            authenticated?.profile ||
            profile ||
            null;

    }


    /*
     * -----------------------------------------------------
     * 5. FINAL AUTH STATE
     * -----------------------------------------------------
     */

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
        "Generate auth ready:",
        {
            user:
                Boolean(user),

            profile:
                Boolean(
                    profile ||
                    window.GENZ_CURRENT_PROFILE ||
                    window.GENZ_NAVIGATION_PROFILE
                ),

            supabase:
                Boolean(
                    window.GENZ_SUPABASE ||
                    window.supabaseClient
                )
        }
    );


    return {
        user,
        profile
    };

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


        /*
         * -------------------------------------------------
         * 1. VALIDATE DOM
         * -------------------------------------------------
         */

        validateDOM();


        /*
         * -------------------------------------------------
         * 2. LOAD MODULES
         * -------------------------------------------------
         */

        await loadCoreModules();


        /*
         * -------------------------------------------------
         * 3. INITIALIZE STATE DOM
         * -------------------------------------------------
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
         * -------------------------------------------------
         * 4. AUTH
         * -------------------------------------------------
         *
         * Wajib dilakukan sebelum model karena
         * /api/model-config membutuhkan access token.
         * -------------------------------------------------
         */

        await initializeAuth();


        /*
         * -------------------------------------------------
         * 5. EVENTS
         * -------------------------------------------------
         */

        bindModelEvent();

        bindResetEvent();


        /*
         * -------------------------------------------------
         * 6. MODEL
         * -------------------------------------------------
         */

        hideError();


        showLoading(
            "Memuat model..."
        );


        await initializeModel();


        /*
         * -------------------------------------------------
         * 7. FINAL VISIBILITY
         * -------------------------------------------------
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


        if (
            elements.generateForm
        ) {

            elements.generateForm.hidden =
                false;

        }


        appState.initialized =
            true;


        debug(
            "Bootstrap completed successfully."
        );

    } catch (
        error
    ) {

        console.error(
            "[GEN-Z.AI][Generate] Bootstrap gagal:",
            error
        );


        /*
         * Owner + account credit jangan disentuh.
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

        getCurrentModel,

        getModules:
            () => appState.modules

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
