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
   - Menyediakan konfigurasi lengkap untuk Generate Form
   - Menyediakan parameter model
   - Menyediakan credit pemakaian model

   SOURCE OF TRUTH:
   - Model             : /api/model-config
   - Model identity    : repository model registry
   - Parameters        : repository model parameters
   - Provider          : provider configuration
   - Model credit      : credit_final

   PENTING:
   - Tidak mengambil credit akun
   - Tidak mengubah profiles.credits
   - Tidak membuat parameter palsu
   - Tidak membuat model palsu
   - Parameter harus diteruskan utuh ke currentModel
========================================================= */

"use strict";


/* =========================================================
   IMPORT STATE
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


/* =========================================================
   IMPORT AUTH
========================================================= */

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
        String(value).trim();


    return result || fallback;

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


/* =========================================================
   SAVE SELECTED MODEL
========================================================= */

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

        model.id ||

        model.model?.model_id ||

        model.model?.id

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

        model.model?.model_name ||

        model.model?.name ||

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
        getProviderObject(model);


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


/* =========================================================
   PROVIDER STATUS
========================================================= */

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


    return false;

}


/* =========================================================
   NORMALIZE PARAMETER COLLECTION
   ---------------------------------------------------------
   Parameter dapat berasal dari:
   - parameters
   - parameters.parameters
   - config.parameters
   - repository.parameters
   - model.parameters
   - parameter_schema
   - parameterSchema
========================================================= */

function normalizeParameterCollection(
    value
) {

    if (
        !value
    ) {

        return {};

    }


    /* -----------------------------------------------------
       ARRAY
    ----------------------------------------------------- */

    if (
        Array.isArray(value)
    ) {

        const result = {};


        value.forEach(
            parameter => {

                if (
                    !parameter ||
                    typeof parameter !==
                    "object"
                ) {

                    return;

                }


                const name =
                    safeString(

                        parameter.name ||

                        parameter.key ||

                        parameter.id

                    );


                if (!name) {

                    return;

                }


                const definition = {
                    ...parameter
                };


                delete definition.name;
                delete definition.key;
                delete definition.id;


                result[name] =
                    definition;

            }
        );


        return result;

    }


    /* -----------------------------------------------------
       OBJECT
    ----------------------------------------------------- */

    if (
        typeof value !==
        "object"
    ) {

        return {};

    }


    /* -----------------------------------------------------
       NESTED PARAMETERS
    ----------------------------------------------------- */

    if (
        value.parameters &&
        typeof value.parameters ===
        "object"
    ) {

        return normalizeParameterCollection(
            value.parameters
        );

    }


    /* -----------------------------------------------------
       NESTED SCHEMA
    ----------------------------------------------------- */

    if (
        value.properties &&
        typeof value.properties ===
        "object"
    ) {

        return normalizeParameterCollection(
            value.properties
        );

    }


    /* -----------------------------------------------------
       COPY OBJECT
    ----------------------------------------------------- */

    const result = {};


    Object.entries(value)
        .forEach(
            (
                [
                    key,
                    definition
                ]
            ) => {

                if (
                    !key ||
                    definition ===
                    undefined
                ) {

                    return;

                }


                result[key] =
                    definition;

            }
        );


    return result;

}


/* =========================================================
   EXTRACT MODEL PARAMETERS
   ---------------------------------------------------------
   INI FIX UTAMA.
========================================================= */

function extractModelParameters(
    model
) {

    if (
        !model ||
        typeof model !==
        "object"
    ) {

        return {};

    }


    const candidates = [

        model.parameters,

        model.config?.parameters,

        model.repository?.parameters,

        model.model?.parameters,

        model.parameter_schema,

        model.parameterSchema,

        model.config?.parameter_schema,

        model.config?.parameterSchema,

        model.repository?.parameter_schema,

        model.repository?.parameterSchema,

        model.model?.parameter_schema,

        model.model?.parameterSchema

    ];


    for (
        const candidate
        of candidates
    ) {

        if (
            !candidate
        ) {

            continue;

        }


        const normalized =
            normalizeParameterCollection(
                candidate
            );


        if (
            Object.keys(
                normalized
            ).length > 0
        ) {

            return normalized;

        }

    }


    return {};

}


/* =========================================================
   HAS PARAMETERS
========================================================= */

function hasParameters(
    model
) {

    const parameters =
        extractModelParameters(
            model
        );


    return (
        Object.keys(
            parameters
        ).length > 0
    );

}


/* =========================================================
   MODEL VISIBILITY
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


    const providerStatus =
        getProviderStatus(model);


    if (
        providerStatus &&
        providerStatus !==
        "active"
    ) {

        return false;

    }


    return true;

}


/* =========================================================
   MODEL CREDIT
   ---------------------------------------------------------
   BUKAN CREDIT AKUN.
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

            creditCost:
                null,

            discountPercent:
                0,

            creditFinal:
                null

        };

    }


    const pricing =
        model.pricing &&
        typeof model.pricing ===
        "object"

            ? model.pricing

            : {};


    const creditFinalValues = [

        pricing.credit_final,

        model.credit_final,

        pricing.creditFinal,

        model.creditFinal

    ];


    let creditFinal =
        null;


    for (
        const value
        of creditFinalValues
    ) {

        const number =
            safeNumber(value);


        if (
            number !== null
        ) {

            creditFinal =
                number;

            break;

        }

    }


    const creditCostValues = [

        pricing.credit_cost,

        model.credit_cost,

        pricing.creditCost,

        model.creditCost

    ];


    let creditCost =
        null;


    for (
        const value
        of creditCostValues
    ) {

        const number =
            safeNumber(value);


        if (
            number !== null
        ) {

            creditCost =
                number;

            break;

        }

    }


    const discountPercent =
        safeNumber(

            pricing.discount_percent ??

            model.discount_percent ??

            pricing.discountPercent ??

            model.discountPercent,

            0

        );


    /*
     * Compatibility.
     *
     * Kalau backend belum mengirim credit_final,
     * credit_cost tetap dapat dipakai.
     */
    if (
        creditFinal === null &&
        creditCost !== null
    ) {

        creditFinal =
            creditCost;

    }


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


    const parameters =
        extractModelParameters(
            model
        );


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
     * PENTING:
     * Selalu tulis parameters hasil ekstraksi
     * ke root model.
     */
    normalized.parameters =
        parameters;


    /*
     * Compatibility schema.
     */
    normalized.parameter_schema =
        parameters;


    normalized.parameterSchema =
        parameters;


    /*
     * Provider status.
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
        getModelCredit(
            model
        );


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
     * Compatibility identity.
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
        "[GEN-Z.AI][Generate Model] NORMALIZED MODEL:",
        {

            model_id:
                normalized.model_id,

            model_name:
                normalized.model_name,

            provider:
                normalized.provider_name,

            adapter_available:
                normalized.adapter_available,

            credit_final:
                normalized.credit_final,

            parameter_count:
                Object.keys(
                    normalized.parameters || {}
                ).length,

            parameter_keys:
                Object.keys(
                    normalized.parameters || {}
                ),

            parameters:
                normalized.parameters

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

    if (
        !detailModel &&
        !listModel
    ) {

        return null;

    }


    if (
        !detailModel
    ) {

        return normalizeModel(
            listModel
        );

    }


    if (
        !listModel
    ) {

        return normalizeModel(
            detailModel
        );

    }


    const merged = {

        ...listModel,

        ...detailModel

    };


    /*
     * PARAMETER DETAIL.
     */
    const detailParameters =
        extractModelParameters(
            detailModel
        );


    const listParameters =
        extractModelParameters(
            listModel
        );


    const finalParameters =
        Object.keys(
            detailParameters
        ).length > 0

            ? detailParameters

            : listParameters;


    merged.parameters =
        finalParameters;


    /*
     * Parameter schema.
     */
    merged.parameter_schema =
        finalParameters;


    merged.parameterSchema =
        finalParameters;


    /*
     * Nested config compatibility.
     */
    if (
        !merged.config &&
        listModel.config
    ) {

        merged.config =
            listModel.config;

    }


    if (
        merged.config &&
        typeof merged.config ===
        "object"
    ) {

        merged.config = {

            ...merged.config,

            parameters:
                finalParameters

        };

    }


    /*
     * Repository compatibility.
     */
    if (
        merged.repository &&
        typeof merged.repository ===
        "object"
    ) {

        merged.repository = {

            ...merged.repository,

            parameters:
                finalParameters

        };

    }


    /*
     * Credit.
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


    let data =
        null;


    try {

        data =
            await response.json();

    } catch {

        throw new Error(
            `Server mengembalikan response tidak valid (${response.status}).`
        );

    }


    if (
        !response.ok
    ) {

        const message =

            data?.error ||

            data?.message ||

            (
                Array.isArray(
                    data?.errors
                )
                    ? data.errors.join(
                        ", "
                    )
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
        extractModels(
            data
        );


    const normalizedModels =
        models
            .map(
                normalizeModel
            )
            .filter(Boolean);


    const visibleModels =
        normalizedModels.filter(
            isVisibleModel
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

                parameterCount:
                    Object.keys(
                        model.parameters || {}
                    ).length,

                parameterKeys:
                    Object.keys(
                        model.parameters || {}
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


    if (
        !elements
    ) {

        return null;

    }


    const modelSelect =
        elements.modelSelect;


    const modelSelector =
        elements.modelSelector;


    if (
        !modelSelect
    ) {

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


            option.dataset.modelId =
                modelId;


            option.dataset.providerId =
                getProviderId(
                    model
                );


            option.dataset.providerName =
                providerName;


            option.dataset.parametersAvailable =

                hasParameters(model)

                    ? "true"

                    : "false";


            option.dataset.parameterCount =
                String(
                    Object.keys(
                        extractModelParameters(
                            model
                        )
                    ).length
                );


            const credit =
                getModelCredit(
                    model
                );


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
        "[GEN-Z.AI][Generate Model] SELECTOR:",
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

                        parameterCount:
                            Object.keys(
                                model.parameters || {}
                            ).length,

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
   ---------------------------------------------------------
   FIX UTAMA:

   MODEL DETAIL SELALU DIMINTA DARI API.

   Tidak lagi langsung percaya kepada list model.
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
                getModelId(model) ===
                normalizedId
        ) || null;


    /*
     * =====================================================
     * REQUEST DETAIL MODEL
     * =====================================================
     *
     * Ini sengaja selalu dilakukan.
     *
     * Tujuannya:
     * memastikan parameter lengkap.
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


    const rawDetailModel =
        extractSingleModel(
            data
        );


    const detailModel =
        normalizeModel(
            rawDetailModel
        );


    /*
     * =====================================================
     * VALIDATE DETAIL
     * =====================================================
     */

    if (
        !detailModel ||
        !getModelId(detailModel)
    ) {

        /*
         * Fallback hanya jika server tidak
         * mengembalikan detail tetapi list
         * memiliki model tersebut.
         */
        if (
            availableModel
        ) {

            const fallback =
                normalizeModel(
                    availableModel
                );


            if (
                !fallback
            ) {

                throw new Error(
                    `Konfigurasi model "${normalizedId}" tidak ditemukan.`
                );

            }


            setCurrentModel(
                fallback
            );


            setModelLoaded(
                true
            );


            saveSelectedModelId(
                normalizedId
            );


            return fallback;

        }


        throw new Error(
            `Konfigurasi model "${normalizedId}" tidak ditemukan.`
        );

    }


    /*
     * =====================================================
     * MODEL ID HARUS SESUAI
     * =====================================================
     */

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


    /*
     * =====================================================
     * MERGE
     * =====================================================
     */

    const model =
        mergeModelConfiguration(

            detailModel,

            availableModel

        );


    if (
        !model
    ) {

        throw new Error(
            "Konfigurasi model gagal dibentuk."
        );

    }


    /*
     * =====================================================
     * PAKSA PARAMETERS
     * =====================================================
     *
     * Jangan sampai parameter hilang
     * setelah merge.
     */

    const parameters =
        extractModelParameters(
            model
        );


    model.parameters =
        parameters;


    model.parameter_schema =
        parameters;


    model.parameterSchema =
        parameters;


    /*
     * =====================================================
     * DEBUG FINAL
     * =====================================================
     */

    console.log(
        "[GEN-Z.AI][Generate Model] DETAIL MODEL READY:",
        {

            model_id:
                getModelId(model),

            model_name:
                getModelName(model),

            provider:
                getProviderName(model),

            parameterCount:
                Object.keys(
                    model.parameters || {}
                ).length,

            parameterKeys:
                Object.keys(
                    model.parameters || {}
                ),

            parameters:
                model.parameters,

            credit:
                getModelCredit(
                    model
                )

        }
    );


    /*
     * =====================================================
     * STATE
     * =====================================================
     */

    setCurrentModel(
        model
    );


    setModelLoaded(
        true
    );


    saveSelectedModelId(
        serverModelId
    );


    /*
     * =====================================================
     * VERIFIKASI STATE
     * =====================================================
     */

    const verified =
        getCurrentModel();


    if (
        !verified ||
        getModelId(
            verified
        ) !==
        serverModelId
    ) {

        throw new Error(
            "Current model gagal disimpan."
        );

    }


    const verifiedParameters =
        extractModelParameters(
            verified
        );


    if (
        Object.keys(
            verifiedParameters
        ).length === 0
    ) {

        console.warn(
            "[GEN-Z.AI][Generate Model] MODEL TIDAK MEMILIKI PARAMETER:",
            verified
        );

    } else {

        console.log(
            "[GEN-Z.AI][Generate Model] PARAMETERS VERIFIED:",
            Object.keys(
                verifiedParameters
            )
        );

    }


    return verified;

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


    /*
     * Selalu lewat loadModelConfig()
     * supaya parameter detail diambil.
     */
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
     * =====================================================
     * STORED MODEL
     * =====================================================
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
     * =====================================================
     * FIRST EXECUTABLE
     * =====================================================
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
     * =====================================================
     * RENDER SELECTOR
     * =====================================================
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
     * =====================================================
     * LOAD DETAIL
     * =====================================================
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


/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default generateModel;
