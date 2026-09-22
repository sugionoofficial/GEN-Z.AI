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
   - Bind resolution change
   - Bind reset
   - Submit Generate ke /api/generate
   - Polling task KIE.AI
   - Menampilkan diagnostic response KIE.AI

   CREDIT SOURCE:
   - credit_480p
   - credit_720p
   - credit_1080p
   - discount_percent

   FINAL CREDIT:
   base - (base * discount / 100)

   PENTING:
   - Account Credit tetap dari profiles.credits
   - Role tetap dari navigation / early auth bridge
   - Model Usage Credit dihitung dari konfigurasi model
   - State HARUS menggunakan SATU instance generate-state.js
   - Generate button hanya aktif jika model benar-benar siap
   - generate-request.js WAJIB tersedia untuk Generate
   - MODEL CREDIT hanya boleh dirender SATU KALI
   - POLLING WAJIB menerima modelId agar /api/generate-status
     dapat melakukan reconciliation generation_history
   - HASIL POLLING TIDAK BOLEH DIANGGAP COMPLETED
     jika status task masih processing/pending/running
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
            ),

        resultModel:
            document.getElementById(
                "resultModel"
            ),

        resultProvider:
            document.getElementById(
                "resultProvider"
            ),

        resultTaskId:
            document.getElementById(
                "resultTaskId"
            )

    };

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

        elements.status.hidden =
            false;

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

        return module;

    } catch (
        error
    ) {

        if (
            !required
        ) {

            return null;

        }

        const originalMessage =
            error?.message ||
            String(
                error
            );

        throw new Error(
            `Module ${name} gagal dimuat: ${originalMessage}`
        );

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

    await loadModule(
        "validation",
        VALIDATION_MODULE,
        false
    );

    await loadModule(
        "request",
        REQUEST_MODULE,
        true
    );

    await loadModule(
        "polling",
        POLLING_MODULE,
        true
    );

    const request =
        appState.modules.request;

    if (
        !request ||
        typeof request.generateVideo !==
            "function"
    ) {

        throw new Error(
            "generate-request.js berhasil dimuat tetapi generateVideo() tidak tersedia."
        );

    }

    const polling =
        appState.modules.polling;

    if (
        !polling ||
        typeof polling.pollGenerateTask !==
            "function"
    ) {

        throw new Error(
            "generate-polling.js berhasil dimuat tetapi pollGenerateTask() tidak tersedia."
        );

    }

    return appState.modules;

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
   RESOLUTION
========================================================= */

function normalizeResolution(
    value
) {

    let resolution =
        String(
            value ??
            ""
        )
        .trim()
        .toLowerCase();

    if (
        !resolution
    ) {

        return "";

    }

    resolution =
        resolution
            .replace(
                /\s+/g,
                ""
            )
            .replace(
                /p$/i,
                ""
            );

    if (
        resolution ===
            "480"
        ||
        resolution ===
            "480p"
    ) {

        return "480p";

    }

    if (
        resolution ===
            "720"
        ||
        resolution ===
            "720p"
    ) {

        return "720p";

    }

    if (
        resolution ===
            "1080"
        ||
        resolution ===
            "1080p"
    ) {

        return "1080p";

    }

    return String(
        value ??
        ""
    ).trim();

}


/* =========================================================
   GET SELECTED RESOLUTION
========================================================= */

function getSelectedResolution() {

    const elements =
        getDOM();

    const root =
        elements.generateForm ||
        elements.dynamicFields ||
        document;

    const checkedCandidates = [

        '[name="resolution"]:checked',

        '#resolution input[type="radio"]:checked',

        '#resolution input[type="checkbox"]:checked',

        '[data-parameter="resolution"] input[type="radio"]:checked',

        '[data-parameter="resolution"] input[type="checkbox"]:checked',

        '[data-key="resolution"] input[type="radio"]:checked',

        '[data-key="resolution"] input[type="checkbox"]:checked',

        '[data-resolution]:checked'

    ];

    for (
        const selector
        of checkedCandidates
    ) {

        const element =
            root.querySelector(
                selector
            );

        if (
            element &&
            element.value
        ) {

            const normalized =
                normalizeResolution(
                    element.value
                );

            if (
                normalized
            ) {

                return normalized;

            }

        }

    }

    const selectCandidates = [

        'select[name="resolution"]',

        '#resolution',

        '[data-parameter="resolution"]',

        '[data-key="resolution"]',

        '[data-resolution]'

    ];

    for (
        const selector
        of selectCandidates
    ) {

        const element =
            root.querySelector(
                selector
            );

        if (
            !element
        ) {

            continue;

        }

        const value =
            element.value ||
            element.dataset?.resolution ||
            element.getAttribute(
                "data-resolution"
            );

        const normalized =
            normalizeResolution(
                value
            );

        if (
            normalized
        ) {

            return normalized;

        }

    }

    const controls =
        root.querySelectorAll(
            'input[name="resolution"], select[name="resolution"], [data-resolution]'
        );

    for (
        const control
        of controls
    ) {

        if (
            (
                control.type ===
                "radio" ||
                control.type ===
                "checkbox"
            ) &&
            !control.checked
        ) {

            continue;

        }

        const value =
            control.value ||
            control.dataset?.resolution ||
            control.getAttribute(
                "data-resolution"
            );

        const normalized =
            normalizeResolution(
                value
            );

        if (
            normalized
        ) {

            return normalized;

        }

    }

    return "";

}


/* =========================================================
   MODEL SOURCE OBJECTS
========================================================= */

function getModelSourceObjects(
    model
) {

    if (
        !model ||
        typeof model !==
        "object"
    ) {

        return [];

    }

    const objects = [

        model,

        model.pricing,

        model.credit,

        model.config,

        model.config?.pricing,

        model.model,

        model.model?.pricing,

        model.repository,

        model.repository?.pricing

    ];

    return objects.filter(
        item =>
            item &&
            typeof item ===
            "object"
    );

}


/* =========================================================
   GET BASE CREDIT BY RESOLUTION
========================================================= */

function getModelResolutionBaseCredit(
    model,
    resolution
) {

    const normalized =
        normalizeResolution(
            resolution
        );

    if (
        !normalized
    ) {

        return null;

    }

    const suffix =
        normalized.replace(
            "p",
            ""
        );

    const fieldNames = [

        `credit_${normalized}`,

        `credit${suffix}p`,

        `credit_${suffix}p`,

        `credit_${suffix}`,

        `credit_base_${normalized}`,

        `creditBase${suffix}p`,

        `creditBase_${normalized}`

    ];

    const sources =
        getModelSourceObjects(
            model
        );

    for (
        const source
        of sources
    ) {

        for (
            const field
            of fieldNames
        ) {

            const value =
                source[field];

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

    }

    return null;

}


/* =========================================================
   GET DISCOUNT
========================================================= */

function getModelDiscountPercent(
    model
) {

    const sources =
        getModelSourceObjects(
            model
        );

    for (
        const source
        of sources
    ) {

        const values = [

            source.discount_percent,

            source.discountPercent,

            source.discount

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

    }

    return 0;

}


/* =========================================================
   CALCULATE FINAL CREDIT
========================================================= */

function calculateFinalCredit(
    baseCredit,
    discountPercent
) {

    const base =
        Number(
            baseCredit
        );

    if (
        !Number.isFinite(
            base
        )
    ) {

        return null;

    }

    const discount =
        Number(
            discountPercent
        );

    const safeDiscount =
        Number.isFinite(
            discount
        )
            ? Math.min(
                100,
                Math.max(
                    0,
                    discount
                )
            )
            : 0;

    const finalCredit =
        base -
        (
            base *
            safeDiscount /
            100
        );

    if (
        !Number.isFinite(
            finalCredit
        )
    ) {

        return null;

    }

    return Math.round(
        finalCredit *
        100
    ) / 100;

}


/* =========================================================
   GET MODEL CREDIT FOR CURRENT RESOLUTION
========================================================= */

function getModelCredit(
    model,
    explicitResolution = ""
) {

    if (
        !model ||
        typeof model !==
        "object"
    ) {

        return null;

    }

    const resolution =
        normalizeResolution(
            explicitResolution ||
            getSelectedResolution()
        );

    if (
        resolution
    ) {

        const baseCredit =
            getModelResolutionBaseCredit(
                model,
                resolution
            );

        if (
            baseCredit !==
                null
        ) {

            const discount =
                getModelDiscountPercent(
                    model
                );

            return calculateFinalCredit(
                baseCredit,
                discount
            );

        }

    }

    const suffix =
        resolution
            ? resolution.replace(
                "p",
                ""
            )
            : "";

    if (
        suffix
    ) {

        const finalFields = [

            `credit_final_${resolution}`,

            `creditFinal${suffix}p`,

            `creditFinal_${resolution}`

        ];

        const sources =
            getModelSourceObjects(
                model
            );

        for (
            const source
            of sources
        ) {

            for (
                const field
                of finalFields
            ) {

                const value =
                    source[field];

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
            minimumFractionDigits:
                0,

            maximumFractionDigits:
                2
        }
    ).format(
        number
    );

}


/* =========================================================
   GET CREDIT DISPLAY ELEMENT
========================================================= */

function getCreditDisplayElement() {

    const elements =
        getDOM();

    if (
        elements.generateCreditValue
    ) {

        return elements.generateCreditValue;

    }

    const directElement =
        document.getElementById(
            "generateCreditValue"
        );

    if (
        directElement
    ) {

        return directElement;

    }

    const candidates = [

        document.querySelector(
            "[data-generate-credit]"
        ),

        document.querySelector(
            "[data-credit-display]"
        ),

        document.querySelector(
            ".generate-button-credit-value"
        )

    ];

    for (
        const element
        of candidates
    ) {

        if (
            element
        ) {

            return element;

        }

    }

    const container =
        elements.generateCreditCost ||
        document.querySelector(
            ".generate-button-credit"
        );

    if (
        container
    ) {

        let valueElement =
            container.querySelector(
                "#generateCreditValue"
            );

        if (
            !valueElement
        ) {

            valueElement =
                document.createElement(
                    "span"
                );

            valueElement.id =
                "generateCreditValue";

            valueElement.className =
                "generate-button-credit-value";

            container.appendChild(
                valueElement
            );

        }

        return valueElement;

    }

    return null;

}


/* =========================================================
   CLEAN LEGACY MODEL CREDIT VALUE
========================================================= */

function cleanLegacyModelCreditValue(
    container,
    canonicalElement,
    formatted
) {

    if (
        !container ||
        !canonicalElement
    ) {

        return;

    }

    if (
        container !==
        canonicalElement
    ) {

        const isActualContainer =
            container.contains(
                canonicalElement
            );

        if (
            !isActualContainer
        ) {

            return;

        }

        Array.from(
            container.childNodes
        ).forEach(
            node => {

                if (
                    node.nodeType !==
                    Node.TEXT_NODE
                ) {

                    return;

                }

                const text =
                    String(
                        node.nodeValue ||
                        ""
                    ).trim();

                if (
                    !text
                ) {

                    return;

                }

                const normalized =
                    text
                        .replace(
                            /credit/gi,
                            ""
                        )
                        .replace(
                            /[:\s]/g,
                            ""
                        );

                if (
                    normalized ===
                    String(
                        formatted
                    ).replace(
                        /[\s,]/g,
                        ""
                    )
                ) {

                    node.nodeValue =
                        "";

                }

            }
        );

    }

}


/* =========================================================
   RENDER MODEL CREDIT
========================================================= */

function renderModelCredit(
    model,
    resolution = ""
) {

    const currentModel =
        model ||
        getCurrentModel();

    const selectedResolution =
        normalizeResolution(
            resolution ||
            getSelectedResolution()
        );

    const credit =
        getModelCredit(
            currentModel,
            selectedResolution
        );

    const formatted =
        formatCredit(
            credit
        );

    const elements =
        getDOM();

    const creditElement =
        getCreditDisplayElement();

    if (
        creditElement
    ) {

        creditElement.dataset.modelCreditCanonical =
            "true";

        creditElement.textContent =
            formatted;

        creditElement.hidden =
            false;

        creditElement.style.display =
            "";

        creditElement.style.visibility =
            "visible";

        creditElement.style.opacity =
            "1";

        cleanLegacyModelCreditValue(
            elements.generateCreditCost,
            creditElement,
            formatted
        );

    }

    if (
        elements.generateCreditCost
    ) {

        if (
            elements.generateCreditCost !==
                creditElement &&
            !elements.generateCreditCost.contains(
                creditElement
            )
        ) {

            elements.generateCreditCost.hidden =
                true;

            elements.generateCreditCost.style.display =
                "none";

            elements.generateCreditCost.style.visibility =
                "hidden";

            elements.generateCreditCost.style.opacity =
                "0";

            elements.generateCreditCost.removeAttribute(
                "data-model-credit-canonical"
            );

        }

        else {

            elements.generateCreditCost.hidden =
                false;

            elements.generateCreditCost.style.display =
                "";

            elements.generateCreditCost.style.visibility =
                "visible";

            elements.generateCreditCost.style.opacity =
                "1";

        }

    }

    const duplicateValues =
        document.querySelectorAll(
            "#generateCreditValue"
        );

    duplicateValues.forEach(
        element => {

            if (
                element ===
                creditElement
            ) {

                return;

            }

            element.removeAttribute(
                "data-model-credit-canonical"
            );

            element.hidden =
                true;

            element.style.display =
                "none";

            element.style.visibility =
                "hidden";

            element.style.opacity =
                "0";

        }
    );

    const creditContainer =
        document.querySelector(
            ".generate-button-credit"
        );

    if (
        creditContainer
    ) {

        creditContainer.hidden =
            false;

        creditContainer.style.display =
            "";

        creditContainer.style.visibility =
            "visible";

        creditContainer.style.opacity =
            "1";

    }

    return credit;

}


/* =========================================================
   SYNC CREDIT AFTER RESOLUTION CHANGE
========================================================= */

function syncModelCreditForResolution() {

    const model =
        getCurrentModel();

    if (
        !model
    ) {

        return null;

    }

    const resolution =
        getSelectedResolution();

    return renderModelCredit(
        model,
        resolution
    );

}


/* =========================================================
   BIND RESOLUTION EVENT
========================================================= */

function bindResolutionEvent() {

    const form =
        getDOM()
            .generateForm;

    if (
        !form
    ) {

        return;

    }

    if (
        form.dataset.genzResolutionCreditBound ===
        "true"
    ) {

        return;

    }

    form.addEventListener(
        "change",
        event => {

            const target =
                event.target;

            if (
                !target
            ) {

                return;

            }

            const name =
                String(
                    target.name ||
                    ""
                )
                .trim()
                .toLowerCase();

            const parameter =
                String(
                    target.dataset?.parameter ||
                    ""
                )
                .trim()
                .toLowerCase();

            const key =
                String(
                    target.dataset?.key ||
                    ""
                )
                .trim()
                .toLowerCase();

            const resolutionAttribute =
                target.hasAttribute(
                    "data-resolution"
                );

            const id =
                String(
                    target.id ||
                    ""
                )
                .trim()
                .toLowerCase();

            const isResolution =
                name ===
                    "resolution" ||

                parameter ===
                    "resolution" ||

                key ===
                    "resolution" ||

                resolutionAttribute ||

                id ===
                    "resolution";

            if (
                !isResolution
            ) {

                return;

            }

            requestAnimationFrame(
                () => {

                    syncModelCreditForResolution();

                }
            );

        }
    );

    form.dataset.genzResolutionCreditBound =
        "true";

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

    appState.modelReady =
        validModel;

    if (
        state &&
        typeof state.setModelLoaded ===
        "function"
    ) {

        state.setModelLoaded(
            validModel
        );

    }

    return validModel;

}


/* =========================================================
   ENABLE GENERATE
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

        }

    }

    if (
        elements.generateButton
    ) {

        elements.generateButton.disabled =
            false;

        elements.generateButton.removeAttribute(
            "aria-busy"
        );

    }

    syncModelCreditForResolution();

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

    const verifiedModel =
        setCurrentModel(
            model
        );

    renderModelInformation(
        verifiedModel
    );

    await renderForm(
        verifiedModel
    );

    bindResolutionEvent();

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

    enableGenerateButton(
        verifiedModel
    );

    syncModelCreditForResolution();

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

    if (
        typeof auth.loadSupabase ===
        "function"
    ) {

        await auth.loadSupabase();

    }

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
        Boolean(
            user
        );

    appState.profileReady =
        Boolean(

            profile ||

            window.GENZ_CURRENT_PROFILE ||

            window.GENZ_NAVIGATION_PROFILE

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

    if (
        typeof modelModule.resolveInitialModel ===
        "function"
    ) {

        result =
            await modelModule.resolveInitialModel();

    }

    else {

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

    syncModelCreditForResolution();

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

        await renderModel(
            model
        );

        appState.modelReady =
            true;

        syncModelCreditForResolution();

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
   KIE.AI RESPONSE SANITIZER
========================================================= */

function sanitizeKieResponse(
    value,
    depth = 0,
    seen = new WeakSet()
) {

    if (
        depth >
        7
    ) {

        return "[MAX_DEPTH]";

    }

    const secretKeys =
        new Set([

            "apiKey",

            "api_key",

            "apikey",

            "authorization",

            "Authorization",

            "access_token",

            "accessToken",

            "refresh_token",

            "refreshToken",

            "token",

            "secret",

            "password",

            "credential",

            "credentials",

            "api_key_ciphertext",

            "api_key_iv",

            "api_key_tag"

        ]);

    if (
        Array.isArray(
            value
        )
    ) {

        return value.map(
            item =>
                sanitizeKieResponse(
                    item,
                    depth + 1,
                    seen
                )
        );

    }

    if (
        value &&
        typeof value ===
        "object"
    ) {

        if (
            seen.has(
                value
            )
        ) {

            return "[CIRCULAR]";

        }

        seen.add(
            value
        );

        const result =
            {};

        for (
            const [
                key,
                item
            ]
            of Object.entries(
                value
            )
        ) {

            if (
                secretKeys.has(
                    key
                )
            ) {

                result[key] =
                    "[REDACTED]";

                continue;

            }

            result[key] =
                sanitizeKieResponse(
                    item,
                    depth + 1,
                    seen
                );

        }

        return result;

    }

    if (
        typeof value ===
        "string"
    ) {

        return value

            .replace(
                /Bearer\s+[^\s"']+/gi,
                "Bearer [REDACTED]"
            )

            .replace(
                /sk-[A-Za-z0-9_-]+/g,
                "[REDACTED]"
            );

    }

    return value;

}


/* =========================================================
   CREATE DIAGNOSTIC PANEL
========================================================= */

function ensureKieDiagnosticPanel() {

    let panel =
        document.getElementById(
            "genzKieDiagnostic"
        );

    if (
        panel
    ) {

        return panel;

    }

    const elements =
        getDOM();

    panel =
        document.createElement(
            "section"
        );

    panel.id =
        "genzKieDiagnostic";

    panel.style.cssText =
        [
            "margin-top:20px",
            "padding:18px",
            "border:1px solid rgba(0,255,255,.25)",
            "border-radius:14px",
            "background:rgba(5,10,20,.96)",
            "color:#eafcff",
            "box-sizing:border-box"
        ].join(";");

    panel.innerHTML =
        `
        <div
            style="
                font-size:11px;
                letter-spacing:1.5px;
                opacity:.7;
            "
        >
            KIE.AI RESPONSE
        </div>

        <div
            id="genzKieSummary"
            style="
                margin-top:8px;
                font-size:14px;
                font-weight:600;
                line-height:1.5;
            "
        >
            Menunggu response...
        </div>

        <pre
            id="genzKieRaw"
            style="
                margin:14px 0 0;
                padding:12px;
                white-space:pre-wrap;
                word-break:break-word;
                max-height:420px;
                overflow:auto;
                font-size:12px;
                line-height:1.5;
                background:rgba(0,0,0,.30);
                border-radius:10px;
            "
        ></pre>

        <div
            id="genzGenerationResult"
            style="
                margin-top:16px;
                display:grid;
                gap:12px;
            "
        ></div>
        `;

    const parent =
        elements.generateCard?.parentElement ||

        elements.generateForm?.parentElement ||

        document.querySelector(
            ".content"
        ) ||

        document.body;

    parent.appendChild(
        panel
    );

    return panel;

}


/* =========================================================
   RENDER KIE RESPONSE
========================================================= */

function renderKieDiagnostic(
    response,
    phase = "RESPONSE"
) {

    const panel =
        ensureKieDiagnosticPanel();

    const summary =
        panel.querySelector(
            "#genzKieSummary"
        );

    const raw =
        panel.querySelector(
            "#genzKieRaw"
        );

    const safeResponse =
        sanitizeKieResponse(
            response
        );

    const taskId =
        response?.taskId ||

        response?.task_id ||

        response?.jobId ||

        response?.data?.taskId ||

        response?.data?.task_id ||

        response?.task?.taskId ||

        response?.task?.task_id ||

        "-";

    const state =
        response?.state ||

        response?.status ||

        response?.data?.state ||

        response?.data?.status ||

        response?.task?.state ||

        response?.task?.status ||

        "-";

    const code =
        response?.code ||

        response?.error_code ||

        response?.errorCode ||

        response?.data?.code ||

        "-";

    const message =
        response?.message ||

        response?.msg ||

        response?.error ||

        response?.data?.message ||

        response?.data?.msg ||

        response?.data?.error ||

        "-";

    if (
        summary
    ) {

        summary.textContent =
            `${phase} • Status: ${String(state)} • Code: ${String(code)} • Task: ${String(taskId)} • ${String(message)}`;

    }

    if (
        raw
    ) {

        raw.textContent =
            JSON.stringify(
                safeResponse,
                null,
                2
            );

    }

    panel.hidden =
        false;

}


/* =========================================================
   RENDER GENERATION RESULT
========================================================= */

function renderGenerationResult(
    result
) {

    const resultUrls =
        Array.isArray(
            result?.resultUrls
        )

            ? result.resultUrls

            : Array.isArray(
                result?.result_urls
            )

                ? result.result_urls

                : Array.isArray(
                    result?.data?.resultUrls
                )

                    ? result.data.resultUrls

                    : Array.isArray(
                        result?.data?.result_urls
                    )

                        ? result.data.result_urls

                        : [];

    const panel =
        ensureKieDiagnosticPanel();

    const resultBox =
        panel.querySelector(
            "#genzGenerationResult"
        );

    if (
        !resultBox
    ) {

        return;

    }

    resultBox.innerHTML =
        "";

    if (
        !resultUrls.length
    ) {

        return;

    }

    for (
        const rawUrl
        of resultUrls
    ) {

        const url =
            String(
                rawUrl ||
                ""
            ).trim();

        if (
            !url
        ) {

            continue;

        }

        const video =
            document.createElement(
                "video"
            );

        video.controls =
            true;

        video.playsInline =
            true;

        video.preload =
            "metadata";

        video.style.cssText =
            [
                "width:100%",
                "max-width:760px",
                "border-radius:12px",
                "display:block"
            ].join(";");

        const source =
            document.createElement(
                "source"
            );

        source.src =
            url;

        source.type =
            "video/mp4";

        video.appendChild(
            source
        );

        resultBox.appendChild(
            video
        );

    }

}


/* =========================================================
   EXTRACT TASK ID
========================================================= */

function extractTaskId(
    response
) {

    return String(

        response?.taskId ||

        response?.task_id ||

        response?.jobId ||

        response?.job_id ||

        response?.data?.taskId ||

        response?.data?.task_id ||

        response?.data?.jobId ||

        response?.data?.job_id ||

        response?.task?.taskId ||

        response?.task?.task_id ||

        response?.task?.jobId ||

        response?.task?.job_id ||

        response?.data?.task?.taskId ||

        response?.data?.task?.task_id ||

        response?.data?.task?.jobId ||

        response?.data?.task?.job_id ||

        ""

    ).trim();

}


/* =========================================================
   EXTRACT ERROR DIAGNOSTIC
========================================================= */

function extractErrorDiagnostic(
    error
) {

    if (
        error?.details
    ) {

        return error.details;

    }

    if (
        error?.response
    ) {

        return error.response;

    }

    if (
        error?.data
    ) {

        return error.data;

    }

    return {

        success:
            false,

        code:
            error?.code ||
            "GENERATION_FAILED",

        message:
            error?.message ||
            "Generate gagal."

    };

}


/* =========================================================
   POLLING STATE
   ---------------------------------------------------------
   Perbaikan:
   - Jangan hanya percaya result.completed.
   - Validasi state dari backend juga.
   - Processing tidak boleh dianggap completed.
========================================================= */

function getPollingState(
    value
) {

    return String(

        value?.state ||

        value?.status ||

        value?.task_state ||

        value?.taskStatus ||

        value?.data?.state ||

        value?.data?.status ||

        value?.data?.task_state ||

        value?.data?.taskStatus ||

        value?.task?.state ||

        value?.task?.status ||

        value?.task?.task_state ||

        value?.task?.taskStatus ||

        value?.data?.task?.state ||

        value?.data?.task?.status ||

        value?.data?.task?.task_state ||

        value?.data?.task?.taskStatus ||

        value?.result?.state ||

        value?.result?.status ||

        value?.data?.result?.state ||

        value?.data?.result?.status ||

        ""

    )
        .trim()
        .toLowerCase()
        .replace(
            /\s+/g,
            "_"
        );

}


/* =========================================================
   POLLING COMPLETED CHECK
========================================================= */

function isPollingCompleted(
    value
) {

    if (
        value?.failed === true
    ) {

        return false;

    }

    const state =
        getPollingState(
            value
        );

    const failedStates =
        new Set([

            "fail",

            "failed",

            "failure",

            "error",

            "cancelled",

            "canceled",

            "rejected",

            "terminated"

        ]);

    if (
        failedStates.has(
            state
        )
    ) {

        return false;

    }

    const processingStates =
        new Set([

            "waiting",

            "pending",

            "queued",

            "queue",

            "processing",

            "running",

            "generating",

            "in_progress",

            "in-progress",

            "created",

            "submitted",

            "starting",

            "started"

        ]);

    if (
        processingStates.has(
            state
        )
    ) {

        return false;

    }

    const completedStates =
        new Set([

            "success",

            "succeeded",

            "successful",

            "completed",

            "complete",

            "done",

            "finished",

            "successfully_completed"

        ]);

    if (
        completedStates.has(
            state
        )
    ) {

        return true;

    }

    /*
     * Backend polling module sudah melakukan normalisasi.
     * Jika completed=true dan tidak ada indikasi state
     * processing/failed, kita menerima hasil tersebut.
     */

    if (
        value?.completed === true
    ) {

        return true;

    }

    /*
     * Result URL merupakan bukti hasil sudah tersedia.
     */

    const resultUrls =
        Array.isArray(
            value?.resultUrls
        )

            ? value.resultUrls

            : Array.isArray(
                value?.result_urls
            )

                ? value.result_urls

                : Array.isArray(
                    value?.data?.resultUrls
                )

                    ? value.data.resultUrls

                    : Array.isArray(
                        value?.data?.result_urls
                    )

                        ? value.data.result_urls

                        : [];

    if (
        resultUrls.length
    ) {

        return true;

    }

    return false;

}


/* =========================================================
   POLLING FAILED CHECK
========================================================= */

function isPollingFailed(
    value
) {

    if (
        value?.failed === true
    ) {

        return true;

    }

    const state =
        getPollingState(
            value
        );

    return [

        "fail",

        "failed",

        "failure",

        "error",

        "cancelled",

        "canceled",

        "rejected",

        "terminated"

    ].includes(
        state
    );

}


/* =========================================================
   GENERATE SUBMIT
========================================================= */

let generationInProgress =
    false;


async function handleGenerateSubmit(
    event
) {

    event.preventDefault();

    event.stopPropagation();

    if (
        generationInProgress
    ) {

        return;

    }

    const elements =
        getDOM();

    const model =
        getCurrentModel();

    if (
        !model ||
        !getModelId(
            model
        )
    ) {

        showError(
            "Model belum siap digunakan."
        );

        return;

    }

    /*
     * MODEL ID UNTUK POLLING
     *
     * Ambil SEKALI dari current model yang sama
     * dengan model yang digunakan untuk Generate.
     */

    const modelId =
        getModelId(
            model
        );

    if (
        !modelId
    ) {

        showError(
            "Model ID tidak tersedia untuk polling."
        );

        return;

    }

    const request =
        appState.modules.request;

    const polling =
        appState.modules.polling;

    const form =
        appState.modules.form;

    if (
        !request
    ) {

        showError(
            "generate-request.js tidak berhasil dimuat. Periksa file dan import module."
        );

        return;

    }

    if (
        typeof request.generateVideo !==
            "function"
    ) {

        showError(
            "generate-request.js dimuat tetapi generateVideo() tidak tersedia."
        );

        return;

    }

    if (
        !polling
    ) {

        showError(
            "generate-polling.js tidak berhasil dimuat."
        );

        return;

    }

    if (
        typeof polling.pollGenerateTask !==
            "function"
    ) {

        showError(
            "generate-polling.js dimuat tetapi pollGenerateTask() tidak tersedia."
        );

        return;

    }

    if (
        !form ||
        typeof form.getFormParameters !==
            "function"
    ) {

        showError(
            "generate-form.js tidak memiliki getFormParameters()."
        );

        return;

    }

    generationInProgress =
        true;

    hideError();

    if (
        elements.generateButton
    ) {

        elements.generateButton.disabled =
            true;

        elements.generateButton.setAttribute(
            "aria-busy",
            "true"
        );

    }

    if (
        elements.generateForm
    ) {

        elements.generateForm
            .querySelectorAll(
                "input, select, textarea, button"
            )
            .forEach(
                field => {

                    field.disabled =
                        true;

                }
            );

    }

    renderKieDiagnostic(
        {

            success:
                true,

            stage:
                "client",

            provider:
                getProviderName(
                    model
                ),

            model_id:
                modelId,

            model_name:
                getModelName(
                    model
                ),

            resolution:
                getSelectedResolution(),

            model_credit:
                getModelCredit(
                    model
                ),

            message:
                "Form siap. Request akan dikirim ke server GEN-Z.AI."

        },

        "REQUEST"

    );

    showLoading(
        "Menyiapkan request..."
    );

    try {

        const parameters =
            await form.getFormParameters(
                model
            );

        let validationErrors =
            [];

        if (
            typeof request.validateGenerateRequest ===
            "function"
        ) {

            validationErrors =
                request.validateGenerateRequest(
                    parameters
                );

        }

        else if (
            typeof appState.modules.validation
                ?.validateClientParameters ===
            "function"
        ) {

            validationErrors =
                appState.modules.validation
                    .validateClientParameters(
                        parameters
                    );

        }

        if (
            Array.isArray(
                validationErrors
            ) &&
            validationErrors.length
        ) {

            throw new Error(
                validationErrors.join(
                    "\n"
                )
            );

        }

        showLoading(
            "Mengirim request ke GEN-Z.AI..."
        );

        const response =
            await request.generateVideo(
                parameters
            );

        renderKieDiagnostic(
            response,
            "TASK CREATED"
        );

        const taskId =
            extractTaskId(
                response
            );

        if (
            !taskId
        ) {

            const error =
                new Error(
                    "KIE.AI tidak mengembalikan task ID."
                );

            error.code =
                "TASK_ID_MISSING";

            error.details =
                response;

            throw error;

        }

        if (
            elements.resultModel
        ) {

            elements.resultModel.textContent =
                getModelName(
                    model
                );

        }

        if (
            elements.resultProvider
        ) {

            elements.resultProvider.textContent =
                getProviderName(
                    model
                );

        }

        if (
            elements.resultTaskId
        ) {

            elements.resultTaskId.textContent =
                taskId;

        }

        showLoading(
            `KIE.AI menerima task ${taskId}. Menunggu hasil...`
        );

        /*
         * =================================================
         * POLLING
         * =================================================
         *
         * modelId WAJIB dikirim ke generate-polling.js.
         *
         * generate-polling.js:
         *
         * taskId + modelId
         *          ↓
         * /api/generate-status
         *
         * Backend kemudian melakukan reconciliation
         * generation_history.
         * =================================================
         */

        const result =
            await polling.pollGenerateTask(
                taskId,
                {

                    modelId:
                        modelId,

                    interval:
                        3000,

                    timeout:
                        15 * 60 * 1000,

                    onUpdate:
                        update => {

                            const failed =
                                isPollingFailed(
                                    update
                                );

                            const completed =
                                isPollingCompleted(
                                    update
                                );

                            const phase =
                                failed

                                    ? "FAILED"

                                    : completed

                                        ? "COMPLETED"

                                        : "PROCESSING";

                            renderKieDiagnostic(
                                update,
                                phase
                            );

                            if (
                                failed
                            ) {

                                showLoading(
                                    "KIE.AI melaporkan generate gagal."
                                );

                            }

                            else if (
                                completed
                            ) {

                                showLoading(
                                    "KIE.AI selesai. Menampilkan hasil..."
                                );

                            }

                            else {

                                showLoading(
                                    `KIE.AI sedang memproses task ${taskId}...`
                                );

                            }

                        }

                }
            );


        /* =================================================
           FINAL POLLING VALIDATION
           -------------------------------------------------
           Jangan pernah langsung menganggap response
           terakhir sebagai completed hanya karena polling
           function sudah return.
        ================================================= */

        if (
            isPollingFailed(
                result
            )
        ) {

            const error =
                new Error(

                    result?.message ||

                    result?.msg ||

                    result?.error ||

                    "KIE.AI melaporkan task gagal."

                );

            error.code =

                result?.code ||

                result?.error_code ||

                result?.errorCode ||

                "TASK_FAILED";

            error.details =
                result;

            throw error;

        }


        if (
            !isPollingCompleted(
                result
            )
        ) {

            const state =
                getPollingState(
                    result
                );

            const error =
                new Error(

                    state

                        ? `Polling selesai tetapi task masih berstatus "${state}".`

                        : "Polling selesai tetapi status task belum terkonfirmasi selesai."

                );

            error.code =
                "TASK_NOT_COMPLETED";

            error.details =
                result;

            throw error;

        }


        /*
         * Hanya sampai titik ini result dianggap selesai.
         */

        renderKieDiagnostic(
            result,
            "COMPLETED"
        );

        renderGenerationResult(
            result
        );

        if (
            elements.resultModel
        ) {

            elements.resultModel.textContent =
                getModelName(
                    model
                );

        }

        if (
            elements.resultProvider
        ) {

            elements.resultProvider.textContent =
                getProviderName(
                    model
                );

        }

        if (
            elements.resultTaskId
        ) {

            elements.resultTaskId.textContent =
                taskId;

        }

        if (
            elements.status
        ) {

            elements.status.textContent =
                "Generate selesai.";

            elements.status.hidden =
                false;

        }

        hideLoading();

    } catch (
        error
    ) {

        const diagnostic =
            extractErrorDiagnostic(
                error
            );

        renderKieDiagnostic(
            diagnostic,
            "FAILED"
        );

        const errorMessage =
            error?.message ||
            diagnostic?.message ||
            diagnostic?.error ||
            "Generate gagal diproses.";

        showError(
            errorMessage
        );

        if (
            elements.status
        ) {

            elements.status.textContent =
                "Generate error: " +
                errorMessage;

            elements.status.hidden =
                false;

        }

    } finally {

        generationInProgress =
            false;

        hideLoading();

        if (
            elements.generateForm
        ) {

            elements.generateForm
                .querySelectorAll(
                    "input, select, textarea, button"
                )
                .forEach(
                    field => {

                        field.disabled =
                            false;

                    }
                );

        }

        const currentModel =
            getCurrentModel();

        if (
            currentModel &&
            getModelId(
                currentModel
            )
        ) {

            enableGenerateButton(
                currentModel
            );

            syncModelCreditForResolution();

        }

        else {

            disableGenerateButton();

        }

    }

}


/* =========================================================
   BIND GENERATE SUBMIT
========================================================= */

function bindGenerateSubmitEvent() {

    const form =
        getDOM()
            .generateForm;

    if (
        !form
    ) {

        return;

    }

    if (
        form.dataset.genzGenerateBound ===
        "true"
    ) {

        return;

    }

    form.addEventListener(
        "submit",
        handleGenerateSubmit
    );

    form.dataset.genzGenerateBound =
        "true";

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

                const currentModel =
                    getCurrentModel();

                if (
                    currentModel &&
                    getModelId(
                        currentModel
                    )
                ) {

                    syncModelCreditForResolution();

                    enableGenerateButton(
                        currentModel
                    );

                }

            } catch (
                error
            ) {

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
   INITIAL VISUAL STATE
========================================================= */

function initializeVisualState() {

    disableGenerateButton();

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

        validateDOM();

        await loadCoreModules();

        const state =
            appState.modules.state;

        if (
            typeof state.initializeGenerateElements ===
            "function"
        ) {

            state.initializeGenerateElements();

        }

        await initializeAuth();

        bindModelEvent();

        bindResetEvent();

        bindGenerateSubmitEvent();

        bindResolutionEvent();

        await initializeModel();

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

            syncModelCreditForResolution();

            enableGenerateButton(
                currentModel
            );

        }

        else {

            disableGenerateButton();

        }

        appState.initialized =
            true;

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
   GLOBAL API
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

                showError(
                    error?.message ||
                    "Generate gagal diinisialisasi."
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
