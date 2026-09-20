/* =========================================================
   GEN-Z.AI
   GENERATE MODEL MODULE
   ---------------------------------------------------------
   File:
   generate/assets/js/generate-model.js

   Tanggung jawab:
   - Load daftar model dari /api/model-config
   - Resolve model dari repository registry
   - Render model selector
   - Authorization Bearer
   - Menyimpan model terpilih
   - Menyediakan model lengkap untuk module Generate
   - Menormalisasi CREDIT model secara konsisten

   SOURCE OF TRUTH:
   - Model identity      : repository model registry
   - Model parameters    : model folder parameters.js
   - Provider identity   : model config / Supabase provider
   - Admin configuration : optional Supabase models row
   - Model credit        : models.credit_final

   Catatan:
   - Tidak membuat model sendiri.
   - Tidak membuat parameter sendiri.
   - Tidak menganggap provider selalu berupa object.
   - Tidak melakukan request detail kedua jika model lengkap
     sudah tersedia dari endpoint list.
   - Credit model TIDAK mengambil credit account/profile.
========================================================= */

import {
    getGenerateElements,
    setCurrentModel,
    getCurrentModel,
    setAvailableModels,
    getAvailableModels,
    findAvailableModel,
    setModelLoaded,
    isModelLoaded
} from "./generate-state.js";

import {
    getAccessToken
} from "./generate-auth.js";


/* =========================================================
   CONSTANT
========================================================= */

const MODEL_CONFIG_ENDPOINT =
    "/api/model-config";

const SELECTED_MODEL_STORAGE_KEY =
    "genz_generate_selected_model";


/* =========================================================
   SAFE STRING
========================================================= */

function safeString(
    value,
    fallback = ""
) {

    if (
        value === null ||
        value === undefined
    ) {

        return fallback;
    }


    const result =
        String(
            value
        ).trim();


    return result ||
        fallback;
}


/* =========================================================
   SAFE BOOLEAN
========================================================= */

function safeBoolean(
    value,
    fallback = false
) {

    if (
        typeof value ===
        "boolean"
    ) {

        return value;
    }


    if (
        typeof value ===
        "string"
    ) {

        const normalized =
            value
                .trim()
                .toLowerCase();

        if (
            normalized ===
            "true"
        ) {

            return true;
        }

        if (
            normalized ===
            "false"
        ) {

            return false;
        }
    }


    return fallback;
}


/* =========================================================
   SAFE NUMBER
   ---------------------------------------------------------
   Penting:
   - 0 adalah nilai valid.
   - null/undefined/"" dianggap tidak tersedia.
========================================================= */

function safeNumber(
    value,
    fallback = null
) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return fallback;
    }


    const number =
        Number(
            value
        );


    return Number.isFinite(
        number
    )
        ? number
        : fallback;
}


/* =========================================================
   STORAGE
========================================================= */

function getStoredModelId() {

    try {

        return String(
            localStorage.getItem(
                SELECTED_MODEL_STORAGE_KEY
            ) || ""
        ).trim();

    } catch {

        return "";
    }
}


function saveSelectedModelId(
    modelId
) {

    const normalizedId =
        safeString(
            modelId
        );

    if (!normalizedId) {
        return;
    }


    try {

        localStorage.setItem(
            SELECTED_MODEL_STORAGE_KEY,
            normalizedId
        );

    } catch {

        /*
         * localStorage bukan source of truth.
         */
    }
}


/* =========================================================
   ELEMENTS
========================================================= */

function getElements() {

    return getGenerateElements();
}


/* =========================================================
   MODEL ID
   ---------------------------------------------------------
   PRIORITAS:
   1. model.model_id
   2. model.config.id
   3. model.id
========================================================= */

function getModelId(
    model
) {

    if (!model) {
        return "";
    }


    return safeString(
        model.model_id ||
        model.config?.id ||
        model.id
    );
}


/* =========================================================
   MODEL NAME
========================================================= */

function getModelName(
    model
) {

    if (!model) {
        return "Model";
    }


    return safeString(
        model.model_name ||
        model.name ||
        model.config?.name ||
        model.repository?.model_name ||
        model.model_id ||
        model.id,
        "Model"
    );
}


/* =========================================================
   PROVIDER OBJECT
========================================================= */

function getProviderObject(
    model
) {

    if (
        model?.provider &&
        typeof model.provider ===
            "object"
    ) {

        return model.provider;
    }


    return null;
}


/* =========================================================
   PROVIDER ID
========================================================= */

function getProviderId(
    model
) {

    const provider =
        getProviderObject(
            model
        );


    return safeString(
        model?.provider_code ||
        model?.provider_id ||
        provider?.provider_id ||
        provider?.id ||
        model?.repository?.provider_id
    );
}


/* =========================================================
   PROVIDER NAME
========================================================= */

function getProviderName(
    model
) {

    const provider =
        getProviderObject(
            model
        );


    return safeString(
        model?.provider_name ||
        provider?.provider_name ||
        provider?.name ||
        model?.repository?.provider_name ||
        model?.provider_code ||
        model?.provider_id,
        "-"
    );
}


/* =========================================================
   PROVIDER STATUS
========================================================= */

function getProviderStatus(
    model
) {

    const provider =
        getProviderObject(
            model
        );


    return safeString(
        model?.provider_status ||
        provider?.status,
        ""
    ).toLowerCase();
}


/* =========================================================
   MODEL STATUS
========================================================= */

function getModelStatus(
    model
) {

    return safeString(
        model?.status,
        "active"
    ).toLowerCase();
}


/* =========================================================
   ADAPTER STATUS
========================================================= */

function hasAdapter(
    model
) {

    if (
        model &&
        Object.prototype.hasOwnProperty.call(
            model,
            "adapter_available"
        )
    ) {

        return safeBoolean(
            model.adapter_available,
            false
        );
    }


    if (
        model?.adapter &&
        typeof model.adapter ===
            "object"
    ) {

        return true;
    }


    return false;
}


/* =========================================================
   PARAMETER AVAILABILITY
========================================================= */

function hasParameters(
    model
) {

    if (!model) {
        return false;
    }


    const parameters =
        model.parameters;


    if (
        Array.isArray(
            parameters
        )
    ) {

        return (
            parameters.length >
            0
        );
    }


    if (
        parameters &&
        typeof parameters ===
            "object"
    ) {

        return (
            Object.keys(
                parameters
            ).length > 0
        );
    }


    return false;
}


/* =========================================================
   MODEL CREDIT
   ---------------------------------------------------------
   SOURCE OF TRUTH:

   models.credit_final

   Backend juga menyediakan:

   pricing.credit_final

   Compatibility:

   credit_cost
   discount_percent

   Urutan:
   1. pricing.credit_final
   2. credit_final
   3. pricing.credit_cost
   4. credit_cost

   Jika credit_final tersedia, JANGAN menghitung ulang.
========================================================= */

function getModelCredit(
    model
) {

    if (
        !model ||
        typeof model !==
            "object"
    ) {

        return {
            creditCost: null,
            discountPercent: 0,
            creditFinal: null
        };
    }


    const pricing =
        model.pricing &&
        typeof model.pricing ===
            "object"
            ? model.pricing
            : {};


    const pricingCreditFinal =
        safeNumber(
            pricing.credit_final
        );

    const rootCreditFinal =
        safeNumber(
            model.credit_final
        );

    const pricingCreditCost =
        safeNumber(
            pricing.credit_cost
        );

    const rootCreditCost =
        safeNumber(
            model.credit_cost
        );

    const discountPercent =
        safeNumber(
            pricing.discount_percent ??
            model.discount_percent,
            0
        );


    let creditFinal =
        pricingCreditFinal;


    if (
        creditFinal === null
    ) {

        creditFinal =
            rootCreditFinal;
    }


    if (
        creditFinal === null &&
        pricingCreditCost !== null
    ) {

        creditFinal =
            pricingCreditCost;
    }


    if (
        creditFinal === null &&
        rootCreditCost !== null
    ) {

        creditFinal =
            rootCreditCost;
    }


    const creditCost =
        pricingCreditCost !== null
            ? pricingCreditCost
            : rootCreditCost;


    return {
        creditCost,
        discountPercent,
        creditFinal
    };
}


/* =========================================================
   NORMALIZE MODEL
   ---------------------------------------------------------
   Fokus penting:

   normalized.pricing.credit_final
   normalized.credit_final

   HARUS selalu sinkron.

   Ini memastikan UI Generate dapat membaca credit
   walaupun backend/legacy module mengirim format berbeda.
========================================================= */

function normalizeModel(
    model
) {

    if (
        !model ||
        typeof model !==
            "object"
    ) {

        return null;
    }


    const normalized = {
        ...model
    };


    const modelId =
        getModelId(
            model
        );


    const modelName =
        getModelName(
            model
        );


    const providerId =
        getProviderId(
            model
        );


    const providerName =
        getProviderName(
            model
        );


    /* =====================================================
       MODEL ID
    ===================================================== */

    if (
        !normalized.model_id &&
        modelId
    ) {

        normalized.model_id =
            modelId;
    }


    /* =====================================================
       MODEL NAME
    ===================================================== */

    if (
        !normalized.model_name &&
        modelName
    ) {

        normalized.model_name =
            modelName;
    }


    /* =====================================================
       PROVIDER
    ===================================================== */

    if (
        !normalized.provider_id &&
        providerId
    ) {

        normalized.provider_id =
            providerId;
    }


    if (
        !normalized.provider_name &&
        providerName
    ) {

        normalized.provider_name =
            providerName;
    }


    /* =====================================================
       CREDIT NORMALIZATION
    ===================================================== */

    const credit =
        getModelCredit(
            model
        );


    /*
     * pricing harus selalu berupa object.
     */
    const existingPricing =
        normalized.pricing &&
        typeof normalized.pricing ===
            "object"
            ? normalized.pricing
            : {};


    normalized.pricing = {
        ...existingPricing,

        credit_cost:
            credit.creditCost,

        discount_percent:
            credit.discountPercent,

        credit_final:
            credit.creditFinal
    };


    /*
     * Compatibility root fields.
     */
    normalized.credit_cost =
        credit.creditCost;


    normalized.discount_percent =
        credit.discountPercent;


    normalized.credit_final =
        credit.creditFinal;


    /*
     * Debug khusus credit model.
     * Tidak mengganggu UI.
     */
    console.debug(
        "[GEN-Z.AI][Generate Model] Credit normalized:",
        {
            model_id:
                normalized.model_id,

            credit_cost:
                normalized.credit_cost,

            discount_percent:
                normalized.discount_percent,

            credit_final:
                normalized.credit_final,

            pricing:
                normalized.pricing
        }
    );


    return normalized;
}


/* =========================================================
   MERGE MODEL CONFIGURATION
========================================================= */

function mergeModelConfiguration(
    detailModel,
    listModel
) {

    if (!detailModel) {
        return normalizeModel(
            listModel
        );
    }


    if (!listModel) {
        return normalizeModel(
            detailModel
        );
    }


    const merged = {
        ...listModel,
        ...detailModel
    };


    /*
     * Parameter detail prioritas.
     */
    if (
        hasParameters(
            detailModel
        )
    ) {

        merged.parameters =
            detailModel.parameters;

    } else if (
        hasParameters(
            listModel
        )
    ) {

        merged.parameters =
            listModel.parameters;
    }


    /*
     * Config fallback.
     */
    if (
        !merged.config &&
        listModel.config
    ) {

        merged.config =
            listModel.config;
    }


    /*
     * Compatibility parameter schema.
     */
    if (
        !merged.parameter_schema &&
        listModel.parameter_schema
    ) {

        merged.parameter_schema =
            listModel.parameter_schema;
    }


    if (
        !merged.parameterSchema &&
        listModel.parameterSchema
    ) {

        merged.parameterSchema =
            listModel.parameterSchema;
    }


    /*
     * Credit harus berasal dari detail jika tersedia.
     * Jika detail tidak membawa credit, pertahankan list.
     */
    const detailCredit =
        getModelCredit(
            detailModel
        );

    const listCredit =
        getModelCredit(
            listModel
        );


    if (
        detailCredit.creditFinal !==
        null
    ) {

        merged.credit_final =
            detailCredit.creditFinal;

    } else {

        merged.credit_final =
            listCredit.creditFinal;
    }


    if (
        detailCredit.creditCost !==
        null
    ) {

        merged.credit_cost =
            detailCredit.creditCost;

    } else {

        merged.credit_cost =
            listCredit.creditCost;
    }


    merged.discount_percent =
        detailCredit.discountPercent !==
            null &&
        detailCredit.discountPercent !==
            undefined
            ? detailCredit.discountPercent
            : listCredit.discountPercent;


    merged.pricing = {
        ...(listModel.pricing || {}),
        ...(detailModel.pricing || {}),

        credit_cost:
            merged.credit_cost,

        discount_percent:
            merged.discount_percent,

        credit_final:
            merged.credit_final
    };


    return normalizeModel(
        merged
    );
}


/* =========================================================
   API REQUEST
========================================================= */

async function requestModelConfig(
    url
) {

    const accessToken =
        await getAccessToken();


    if (!accessToken) {

        throw new Error(
            "Session tidak ditemukan. Silakan login kembali."
        );
    }


    const response =
        await fetch(
            url,
            {
                method:
                    "GET",

                headers: {
                    Accept:
                        "application/json",

                    Authorization:
                        `Bearer ${accessToken}`
                },

                credentials:
                    "same-origin"
            }
        );


    let data = null;


    try {

        data =
            await response.json();

    } catch {

        throw new Error(
            `Server mengembalikan response yang tidak valid (${response.status}).`
        );
    }


    if (!response.ok) {

        const message =
            data?.error ||
            data?.message ||
            (
                Array.isArray(
                    data?.errors
                )
                    ? data.errors.join(", ")
                    : ""
            ) ||
            `Gagal memuat model (${response.status}).`;


        throw new Error(
            message
        );
    }


    if (
        data &&
        data.success === false
    ) {

        throw new Error(
            data.error ||
            data.message ||
            "Konfigurasi model gagal dimuat."
        );
    }


    return data;
}


/* =========================================================
   EXTRACT MODEL ARRAY
========================================================= */

function extractModels(
    data
) {

    if (
        Array.isArray(
            data
        )
    ) {

        return data;
    }


    if (
        Array.isArray(
            data?.models
        )
    ) {

        return data.models;
    }


    if (
        Array.isArray(
            data?.data
        )
    ) {

        return data.data;
    }


    if (
        Array.isArray(
            data?.data?.models
        )
    ) {

        return data.data.models;
    }


    return [];
}


/* =========================================================
   EXTRACT SINGLE MODEL
========================================================= */

function extractSingleModel(
    data
) {

    if (
        data?.model &&
        typeof data.model ===
            "object"
    ) {

        return data.model;
    }


    if (
        data?.data?.model &&
        typeof data.data.model ===
            "object"
    ) {

        return data.data.model;
    }


    if (
        data?.data &&
        typeof data.data ===
            "object" &&
        !Array.isArray(
            data.data
        ) &&
        (
            data.data.model_id ||
            data.data.id
        )
    ) {

        return data.data;
    }


    if (
        data &&
        typeof data ===
            "object" &&
        !Array.isArray(
            data
        ) &&
        (
            data.model_id ||
            data.id
        )
    ) {

        return data;
    }


    return null;
}


/* =========================================================
   LOAD AVAILABLE MODELS
========================================================= */

export async function loadAvailableModels() {

    const data =
        await requestModelConfig(
            MODEL_CONFIG_ENDPOINT
        );


    const models =
        extractModels(
            data
        );


    /*
     * Normalize tanpa membuat model baru.
     */
    const normalizedModels =
        models
            .map(
                normalizeModel
            )
            .filter(Boolean);


    const visibleModels =
        normalizedModels.filter(
            model =>
                isVisibleModel(
                    model
                )
        );


    if (
        visibleModels.length ===
            0
    ) {

        throw new Error(
            "Tidak ada model aktif yang tersedia."
        );
    }


    setAvailableModels(
        visibleModels
    );


    console.debug(
        "[GEN-Z.AI][Generate Model] Loaded models:",
        visibleModels
    );


    return visibleModels;
}


/* =========================================================
   RENDER MODEL SELECTOR
========================================================= */

export function renderModelSelector(
    models,
    preferredModelId = null
) {

    const elements =
        getElements();


    if (!elements) {
        return null;
    }


    const {
        modelSelector,
        modelSelect
    } =
        elements;


    if (!modelSelect) {

        throw new Error(
            "Element #modelSelect tidak ditemukan."
        );
    }


    modelSelect.innerHTML =
        "";


    const placeholder =
        document.createElement(
            "option"
        );


    placeholder.value =
        "";

    placeholder.textContent =
        "Pilih model...";

    placeholder.disabled =
        true;

    placeholder.selected =
        true;


    modelSelect.appendChild(
        placeholder
    );


    const normalizedModels =
        Array.isArray(
            models
        )
            ? models
                .map(
                    normalizeModel
                )
                .filter(
                    Boolean
                )
                .filter(
                    isVisibleModel
                )
            : [];


    normalizedModels.forEach(
        model => {

            const modelId =
                getModelId(
                    model
                );


            if (!modelId) {
                return;
            }


            const option =
                document.createElement(
                    "option"
                );


            option.value =
                modelId;


            const modelName =
                getModelName(
                    model
                );


            const providerName =
                getProviderName(
                    model
                );


            option.textContent =
                providerName &&
                providerName !== "-"
                    ? `${modelName} • ${providerName}`
                    : modelName;


            option.dataset.adapterAvailable =
                hasAdapter(
                    model
                )
                    ? "true"
                    : "false";


            option.dataset.parametersAvailable =
                hasParameters(
                    model
                )
                    ? "true"
                    : "false";


            option.dataset.providerId =
                getProviderId(
                    model
                );


            const modelCredit =
                getModelCredit(
                    model
                );


            /*
             * Simpan credit pada option juga.
             * Berguna untuk debugging dan kompatibilitas.
             */
            option.dataset.creditCost =
                modelCredit.creditCost !==
                null
                    ? String(
                        modelCredit.creditCost
                    )
                    : "";

            option.dataset.creditFinal =
                modelCredit.creditFinal !==
                null
                    ? String(
                        modelCredit.creditFinal
                    )
                    : "";


            modelSelect.appendChild(
                option
            );
        }
    );


    let selectedModelId =
        safeString(
            preferredModelId ||
            getStoredModelId()
        );


    const preferredExists =
        normalizedModels.some(
            model =>
                getModelId(
                    model
                ) ===
                selectedModelId
        );


    if (
        !preferredExists
    ) {

        const executableModel =
            normalizedModels.find(
                model =>
                    isExecutableModel(
                        model
                    )
            );


        if (
            executableModel
        ) {

            selectedModelId =
                getModelId(
                    executableModel
                );

        } else {

            selectedModelId =
                getModelId(
                    normalizedModels[0]
                );
        }
    }


    if (selectedModelId) {

        modelSelect.value =
            selectedModelId;


        saveSelectedModelId(
            selectedModelId
        );


        placeholder.selected =
            false;
    }


    modelSelect.disabled =
        normalizedModels.length ===
        0;


    if (modelSelector) {

        modelSelector.classList.add(
            "show"
        );
    }


    return (
        selectedModelId ||
        null
    );
}


/* =========================================================
   FIND MODEL
========================================================= */

export function findModel(
    modelId
) {

    const normalizedId =
        safeString(
            modelId
        );


    if (!normalizedId) {
        return null;
    }


    const model =
        findAvailableModel(
            normalizedId
        );


    return normalizeModel(
        model
    );
}


/* =========================================================
   LOAD MODEL CONFIG
========================================================= */

export async function loadModelConfig(
    modelId
) {

    const normalizedId =
        safeString(
            modelId
        );


    if (!normalizedId) {

        throw new Error(
            "Model ID tidak ditemukan."
        );
    }


    const availableModels =
        getAvailableModels();


    const availableModel =
        availableModels.find(
            model =>
                getModelId(
                    model
                ) ===
                normalizedId
        );


    /*
     * =====================================================
     * FAST PATH
     * =====================================================
     */
    if (
        availableModel
    ) {

        const model =
            normalizeModel(
                availableModel
            );


        if (
            !isExecutableModel(
                model
            )
        ) {

            throw new Error(
                `Model "${normalizedId}" belum siap digunakan. Provider atau adapter model tidak aktif.`
            );
        }


        setCurrentModel(
            model
        );

        setModelLoaded(
            true
        );


        saveSelectedModelId(
            normalizedId
        );


        console.debug(
            "[GEN-Z.AI][Generate Model] Selected model:",
            model
        );


        console.debug(
            "[GEN-Z.AI][Generate Model] Model credit:",
            getModelCredit(
                model
            )
        );


        console.debug(
            "[GEN-Z.AI][Generate Model] Parameters:",
            model.parameters || {}
        );


        return model;
    }


    /*
     * =====================================================
     * FALLBACK DETAIL REQUEST
     * =====================================================
     */

    const params =
        new URLSearchParams();


    params.set(
        "model_id",
        normalizedId
    );


    const data =
        await requestModelConfig(
            `${MODEL_CONFIG_ENDPOINT}?${params.toString()}`
        );


    const detailModel =
        normalizeModel(
            extractSingleModel(
                data
            )
        );


    if (
        !detailModel ||
        !getModelId(
            detailModel
        )
    ) {

        throw new Error(
            `Konfigurasi model "${normalizedId}" tidak ditemukan.`
        );
    }


    const serverModelId =
        getModelId(
            detailModel
        );


    if (
        serverModelId !==
        normalizedId
    ) {

        throw new Error(
            "Model ID dari server tidak sesuai dengan model yang diminta."
        );
    }


    if (
        !isExecutableModel(
            detailModel
        )
    ) {

        throw new Error(
            `Model "${serverModelId}" belum siap digunakan. Provider atau adapter model tidak aktif.`
        );
    }


    const model =
        mergeModelConfiguration(
            detailModel,
            availableModel
        );


    setCurrentModel(
        model
    );


    setModelLoaded(
        true
    );


    saveSelectedModelId(
        serverModelId
    );


    console.debug(
        "[GEN-Z.AI][Generate Model] Selected model:",
        model
    );


    console.debug(
        "[GEN-Z.AI][Generate Model] Model credit:",
        getModelCredit(
            model
        )
    );


    console.debug(
        "[GEN-Z.AI][Generate Model] Parameters:",
        model?.parameters || {}
    );


    return model;
}


/* =========================================================
   SELECT MODEL
========================================================= */

export async function selectModel(
    modelId
) {

    const normalizedId =
        safeString(
            modelId
        );


    if (!normalizedId) {

        setCurrentModel(
            null
        );

        setModelLoaded(
            false
        );

        return null;
    }


    const available =
        getAvailableModels();


    const selectedModel =
        available.find(
            model =>
                getModelId(
                    model
                ) ===
                normalizedId
        );


    if (!selectedModel) {

        throw new Error(
            "Model yang dipilih tidak tersedia."
        );
    }


    const normalizedModel =
        normalizeModel(
            selectedModel
        );


    if (
        !isExecutableModel(
            normalizedModel
        )
    ) {

        throw new Error(
            "Model yang dipilih belum memiliki adapter/provider aktif dan belum siap digunakan."
        );
    }


    return loadModelConfig(
        normalizedId
    );
}


/* =========================================================
   RESOLVE INITIAL MODEL
========================================================= */

export async function resolveInitialModel() {

    const storedModelId =
        getStoredModelId();


    const models =
        await loadAvailableModels();


    let selectedModelId =
        null;


    /*
     * Prioritas:
     * 1. model tersimpan dan executable
     * 2. model executable pertama
     */
    const storedModel =
        models.find(
            model =>
                getModelId(
                    model
                ) ===
                storedModelId
        );


    if (
        storedModel &&
        isExecutableModel(
            storedModel
        )
    ) {

        selectedModelId =
            getModelId(
                storedModel
            );
    }


    if (!selectedModelId) {

        const executableModel =
            models.find(
                model =>
                    isExecutableModel(
                        model
                    )
            );


        if (
            executableModel
        ) {

            selectedModelId =
                getModelId(
                    executableModel
                );
        }
    }


    const renderedModelId =
        renderModelSelector(
            models,
            selectedModelId
        );


    if (!selectedModelId) {

        setCurrentModel(
            null
        );

        setModelLoaded(
            false
        );


        return {
            model:
                null,

            models,

            executable:
                false,

            selectedModelId:
                renderedModelId
        };
    }


    const model =
        await loadModelConfig(
            selectedModelId
        );


    const elements =
        getElements();


    if (
        elements?.modelSelect
    ) {

        elements.modelSelect.value =
            getModelId(
                model
            );
    }


    return {
        model,

        models,

        executable:
            true,

        selectedModelId
    };
}


/* =========================================================
   REFRESH MODELS
========================================================= */

export async function refreshModels(
    preferredModelId = null
) {

    const models =
        await loadAvailableModels();


    let selectedModelId =
        null;


    const normalizedPreferredId =
        safeString(
            preferredModelId
        );


    if (
        normalizedPreferredId
    ) {

        const preferredModel =
            models.find(
                model =>
                    getModelId(
                        model
                    ) ===
                    normalizedPreferredId &&
                    isExecutableModel(
                        model
                    )
            );


        if (
            preferredModel
        ) {

            selectedModelId =
                getModelId(
                    preferredModel
                );
        }
    }


    if (!selectedModelId) {

        const executableModel =
            models.find(
                model =>
                    isExecutableModel(
                        model
                    )
            );


        if (
            executableModel
        ) {

            selectedModelId =
                getModelId(
                    executableModel
                );
        }
    }


    const renderedModelId =
        renderModelSelector(
            models,
            selectedModelId
        );


    if (!selectedModelId) {

        setCurrentModel(
            null
        );

        setModelLoaded(
            false
        );


        return {
            models,

            model:
                null,

            executable:
                false,

            selectedModelId:
                renderedModelId
        };
    }


    const model =
        await loadModelConfig(
            selectedModelId
        );


    return {
        models,

        model,

        executable:
            true,

        selectedModelId
    };
}


/* =========================================================
   GET MODEL
========================================================= */

export function getModel() {

    return getCurrentModel();
}


/* =========================================================
   MODEL STATUS
========================================================= */

export function isModelReady() {

    const model =
        getCurrentModel();


    return Boolean(
        isModelLoaded() &&
        model &&
        getModelId(
            model
        ) &&
        isExecutableModel(
            model
        )
    );
}


/* =========================================================
   PUBLIC API
========================================================= */

export const generateModel =
    Object.freeze({

        loadAvailableModels,

        renderModelSelector,

        findModel,

        loadModelConfig,

        selectModel,

        resolveInitialModel,

        refreshModels,

        getModel,

        isModelReady

    });


export default generateModel;
