/* =========================================================
   GEN-Z.AI
   GENERATE MODEL MODULE
   ---------------------------------------------------------
   File:
   generate/assets/js/generate-model.js

   Tanggung jawab:
   - Load model dari /api/model-config
   - Menampilkan model aktif
   - Resolve model terpilih
   - Menyimpan model terpilih
   - Menyediakan model lengkap untuk Generate Form
   - Menyediakan credit pemakaian model

   SOURCE OF TRUTH:
   - Model              : /api/model-config
   - Model identity     : repository model registry
   - Parameters         : repository model parameters
   - Provider           : provider dari model-config
   - Model credit       : credit_final

   PENTING:
   - Tidak membuat model palsu
   - Tidak membuat parameter palsu
   - Tidak mengambil credit akun/profile
   - Tidak mengganggu auth/profile/OWNER
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
   SAFE HELPERS
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
        String(value).trim();

    return result || fallback;
}


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
        Number(value);

    return Number.isFinite(number)
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

    const normalized =
        safeString(modelId);

    if (!normalized) {
        return;
    }

    try {

        localStorage.setItem(
            SELECTED_MODEL_STORAGE_KEY,
            normalized
        );

    } catch {

        /* localStorage optional */
    }
}


/* =========================================================
   ELEMENTS
========================================================= */

function getElements() {

    try {

        return getGenerateElements();

    } catch {

        return {
            modelSelector:
                document.getElementById(
                    "modelSelector"
                ),

            modelSelect:
                document.getElementById(
                    "modelSelect"
                )
        };
    }
}


/* =========================================================
   MODEL ID
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
   PROVIDER
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


function getProviderId(
    model
) {

    const provider =
        getProviderObject(model);

    return safeString(
        model?.provider_code ||
        model?.provider_id ||
        provider?.provider_id ||
        provider?.id ||
        model?.repository?.provider_id
    );
}


function getProviderName(
    model
) {

    const provider =
        getProviderObject(model);

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


function getProviderStatus(
    model
) {

    const provider =
        getProviderObject(model);

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
   ADAPTER
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

    /*
     * Endpoint /api/model-config
     * saat ini mengirim adapter_available.
     */
    return false;
}


/* =========================================================
   PARAMETERS
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
        Array.isArray(parameters)
    ) {

        return parameters.length > 0;
    }

    if (
        parameters &&
        typeof parameters ===
            "object"
    ) {

        return (
            Object.keys(parameters)
                .length > 0
        );
    }

    return false;
}


/* =========================================================
   MODEL VISIBILITY
   ---------------------------------------------------------
   FIX UTAMA #1

   Sebelumnya fungsi ini dipanggil tetapi tidak ada.

   Model dari repository tetap boleh tampil apabila:
   - model ID ada
   - status model bukan inactive/disabled
   - provider tidak secara eksplisit inactive

   Tidak mensyaratkan parameter atau provider harus ada
   agar selector tetap bisa mengetahui model repository.
========================================================= */

function isVisibleModel(
    model
) {

    if (
        !model ||
        typeof model !==
            "object"
    ) {

        return false;
    }

    const modelId =
        getModelId(model);

    if (!modelId) {
        return false;
    }

    const status =
        getModelStatus(model);

    const hiddenStatuses = [
        "inactive",
        "disabled",
        "deleted",
        "archived"
    ];

    if (
        hiddenStatuses.includes(
            status
        )
    ) {

        return false;
    }

    const providerStatus =
        getProviderStatus(model);

    const hiddenProviderStatuses = [
        "inactive",
        "disabled",
        "deleted",
        "suspended"
    ];

    if (
        hiddenProviderStatuses.includes(
            providerStatus
        )
    ) {

        return false;
    }

    return true;
}


/* =========================================================
   MODEL EXECUTABLE
   ---------------------------------------------------------
   FIX UTAMA #2

   Model dari /api/model-config mempunyai:
     adapter_available: true

   Provider aktif tidak boleh ditolak hanya karena
   provider object / provider status tidak dikirim dalam
   format tertentu.

   Yang wajib:
   - model_id valid
   - model visible
   - adapter tidak secara eksplisit false
   - provider tidak secara eksplisit inactive
========================================================= */

function isExecutableModel(
    model
) {

    if (
        !isVisibleModel(model)
    ) {

        return false;
    }

    const modelId =
        getModelId(model);

    if (!modelId) {
        return false;
    }

    /*
     * Jika backend secara eksplisit mengatakan
     * adapter false, jangan menjalankan model.
     */
    if (
        Object.prototype.hasOwnProperty.call(
            model,
            "adapter_available"
        )
    ) {

        if (
            safeBoolean(
                model.adapter_available,
                false
            ) === false
        ) {

            return false;
        }
    }

    /*
     * Provider hanya ditolak jika statusnya
     * secara eksplisit bukan active.
     *
     * Status kosong berarti backend belum
     * mengirim status provider, bukan otomatis error.
     */
    const providerStatus =
        getProviderStatus(model);

    if (
        providerStatus &&
        providerStatus !== "active"
    ) {

        return false;
    }

    return true;
}


/* =========================================================
   MODEL CREDIT
   ---------------------------------------------------------
   CREDIT PEMAKAIAN MODEL.

   BUKAN:
   profiles.credits

   Prioritas:
   1. pricing.credit_final
   2. credit_final
   3. pricing.credit_cost
   4. credit_cost
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

    /*
     * Compatibility legacy.
     *
     * Kalau backend belum mempunyai credit_final,
     * credit_cost masih dapat digunakan.
     */
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
        getModelId(model);

    const modelName =
        getModelName(model);

    const providerId =
        getProviderId(model);

    const providerName =
        getProviderName(model);

    if (
        !normalized.model_id &&
        modelId
    ) {

        normalized.model_id =
            modelId;
    }

    if (
        !normalized.model_name &&
        modelName
    ) {

        normalized.model_name =
            modelName;
    }

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

    /*
     * Provider status compatibility.
     */
    if (
        !normalized.provider_status
    ) {

        normalized.provider_status =
            getProviderStatus(model);
    }

    /*
     * Credit.
     */
    const credit =
        getModelCredit(model);

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

    normalized.credit_cost =
        credit.creditCost;

    normalized.discount_percent =
        credit.discountPercent;

    normalized.credit_final =
        credit.creditFinal;

    /*
     * Compatibility flags.
     */
    normalized.model_id =
        safeString(
            normalized.model_id
        );

    normalized.model_name =
        safeString(
            normalized.model_name,
            "Model"
        );

    normalized.provider_name =
        safeString(
            normalized.provider_name,
            "-"
        );

    console.debug(
        "[GEN-Z.AI][Generate Model] Normalized:",
        {
            model_id:
                normalized.model_id,

            model_name:
                normalized.model_name,

            provider:
                normalized.provider_name,

            status:
                normalized.status,

            adapter_available:
                normalized.adapter_available,

            credit_final:
                normalized.credit_final,

            parameters:
                normalized.parameters
        }
    );

    return normalized;
}


/* =========================================================
   MERGE MODEL
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
     * Detail parameter lebih tinggi.
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
     * Schema fallback.
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
     * Credit detail lebih tinggi.
     */
    const detailCredit =
        getModelCredit(
            detailModel
        );

    const listCredit =
        getModelCredit(
            listModel
        );

    merged.credit_final =
        detailCredit.creditFinal !== null
            ? detailCredit.creditFinal
            : listCredit.creditFinal;

    merged.credit_cost =
        detailCredit.creditCost !== null
            ? detailCredit.creditCost
            : listCredit.creditCost;

    merged.discount_percent =
        detailCredit.discountPercent ??
        listCredit.discountPercent ??
        0;

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
   REQUEST MODEL CONFIG
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
                method: "GET",

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
            `Server mengembalikan response tidak valid (${response.status}).`
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
   EXTRACT MODELS
========================================================= */

function extractModels(
    data
) {

    if (
        Array.isArray(data)
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
        !Array.isArray(data) &&
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
        extractModels(data);

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

    console.log(
        "[GEN-Z.AI][Generate Model] AVAILABLE MODELS:",
        visibleModels.map(
            model => ({
                id:
                    getModelId(
                        model
                    ),

                name:
                    getModelName(
                        model
                    ),

                provider:
                    getProviderName(
                        model
                    ),

                executable:
                    isExecutableModel(
                        model
                    ),

                credit:
                    getModelCredit(
                        model
                    )
            })
        )
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

    const modelSelect =
        elements.modelSelect;

    const modelSelector =
        elements.modelSelector;

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
        Array.isArray(models)
            ? models
                .map(
                    normalizeModel
                )
                .filter(Boolean)
                .filter(
                    isVisibleModel
                )
            : [];

    normalizedModels.forEach(
        model => {

            const modelId =
                getModelId(model);

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
                getModelName(model);

            const providerName =
                getProviderName(model);

            option.textContent =
                providerName &&
                providerName !== "-"
                    ? `${modelName} • ${providerName}`
                    : modelName;

            option.dataset.modelId =
                modelId;

            option.dataset.providerId =
                getProviderId(model);

            option.dataset.providerName =
                providerName;

            option.dataset.adapterAvailable =
                hasAdapter(model)
                    ? "true"
                    : "false";

            option.dataset.parametersAvailable =
                hasParameters(model)
                    ? "true"
                    : "false";

            const credit =
                getModelCredit(model);

            option.dataset.creditCost =
                credit.creditCost !== null
                    ? String(
                        credit.creditCost
                    )
                    : "";

            option.dataset.creditFinal =
                credit.creditFinal !== null
                    ? String(
                        credit.creditFinal
                    )
                    : "";

            option.dataset.executable =
                isExecutableModel(model)
                    ? "true"
                    : "false";

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
                getModelId(model) ===
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

        } else if (
            normalizedModels.length
        ) {

            selectedModelId =
                getModelId(
                    normalizedModels[0]
                );

        } else {

            selectedModelId =
                "";
        }
    }

    if (
        selectedModelId
    ) {

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

    if (
        modelSelector
    ) {

        modelSelector.classList.add(
            "show"
        );

        modelSelector.hidden =
            false;
    }

    console.log(
        "[GEN-Z.AI][Generate Model] Selector rendered:",
        {
            total:
                normalizedModels.length,

            selected:
                selectedModelId,

            models:
                normalizedModels.map(
                    model => ({
                        id:
                            getModelId(
                                model
                            ),

                        executable:
                            isExecutableModel(
                                model
                            )
                    })
                )
        }
    );

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
        safeString(modelId);

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
        safeString(modelId);

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
                getModelId(model) ===
                normalizedId
        );

    /*
     * FAST PATH
     *
     * /api/model-config sudah mengirim
     * parameter + credit + provider.
     *
     * Tidak perlu request kedua.
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
                `Model "${normalizedId}" belum siap digunakan.`
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

        console.log(
            "[GEN-Z.AI][Generate Model] MODEL SELECTED:",
            {
                model_id:
                    getModelId(
                        model
                    ),

                model_name:
                    getModelName(
                        model
                    ),

                provider:
                    getProviderName(
                        model
                    ),

                credit:
                    getModelCredit(
                        model
                    ),

                parameters:
                    model.parameters
            }
        );

        return model;
    }

    /*
     * DETAIL FALLBACK
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
            extractSingleModel(data)
        );

    if (
        !detailModel ||
        !getModelId(detailModel)
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
            `Model "${serverModelId}" belum siap digunakan.`
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

    return model;
}


/* =========================================================
   SELECT MODEL
========================================================= */

export async function selectModel(
    modelId
) {

    const normalizedId =
        safeString(modelId);

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
                getModelId(model) ===
                normalizedId
        );

    if (
        !selectedModel
    ) {

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
     * 1. Model tersimpan dan executable.
     */
    const storedModel =
        models.find(
            model =>
                getModelId(model) ===
                storedModelId &&
                isExecutableModel(
                    model
                )
        );

    if (
        storedModel
    ) {

        selectedModelId =
            getModelId(
                storedModel
            );
    }

    /*
     * 2. Model executable pertama.
     */
    if (
        !selectedModelId
    ) {

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

    /*
     * 3. Render selector.
     */
    const renderedModelId =
        renderModelSelector(
            models,
            selectedModelId
        );

    if (
        !selectedModelId
    ) {

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

    /*
     * 4. Resolve model.
     */
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
            getModelId(model);
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

    const preferredId =
        safeString(
            preferredModelId
        );

    if (
        preferredId
    ) {

        const preferredModel =
            models.find(
                model =>
                    getModelId(model) ===
                    preferredId &&
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

    if (
        !selectedModelId
    ) {

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

    if (
        !selectedModelId
    ) {

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
   MODEL READY
========================================================= */

export function isModelReady() {

    const model =
        getCurrentModel();

    return Boolean(
        isModelLoaded() &&
        model &&
        getModelId(model) &&
        isExecutableModel(model)
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
