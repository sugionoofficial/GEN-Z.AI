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

   SOURCE OF TRUTH:
   - Model identity      : repository model registry
   - Model parameters    : model folder parameters.js
   - Provider identity   : model config / Supabase provider
   - Admin configuration : optional Supabase models row

   Catatan:
   - Tidak membuat model sendiri.
   - Tidak membuat parameter sendiri.
   - Tidak menganggap provider selalu berupa object.
   - Tidak melakukan request detail kedua jika model lengkap
     sudah tersedia dari endpoint list.
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
   2. model.id
   3. model.config.id
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
   ---------------------------------------------------------
   Backend baru menyediakan provider sebagai object.

   Tetapi frontend tetap dibuat fleksibel untuk:
   - provider object
   - provider_id
   - provider_code
   - provider_name
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

    /*
     * Backend model-config mengirim:
     *
     * adapter_available: true
     */

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


    /*
     * Fallback untuk response kompatibilitas.
     */

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
   ---------------------------------------------------------
   Tidak menentukan parameter.
   Hanya memeriksa data dari backend.
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
   MODEL VISIBILITY
   ---------------------------------------------------------
   Model boleh tampil apabila:

   1. Model ID tersedia.
   2. Status model active.
   3. Jika provider diketahui, provider harus active.
   4. Provider tidak lagi diwajibkan harus berupa object.

   Model tanpa provider tetap bisa diketahui dari
   repository, tetapi tidak executable.
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
        getModelId(
            model
        );


    if (!modelId) {
        return false;
    }


    const modelStatus =
        getModelStatus(
            model
        );


    if (
        modelStatus &&
        modelStatus !==
            "active"
    ) {

        return false;
    }


    const providerId =
        getProviderId(
            model
        );

    const providerStatus =
        getProviderStatus(
            model
        );


    /*
     * Jika provider tersedia dan statusnya
     * bukan active, model tidak executable.
     *
     * Namun model tetap dianggap visible jika
     * backend mengirimnya.
     */
    if (
        providerId &&
        providerStatus &&
        providerStatus !==
            "active"
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
        !isVisibleModel(
            model
        )
    ) {

        return false;
    }


    /*
     * Model harus memiliki adapter.
     */
    if (
        !hasAdapter(
            model
        )
    ) {

        return false;
    }


    /*
     * Provider harus tersedia untuk execution.
     */
    const providerId =
        getProviderId(
            model
        );


    if (!providerId) {
        return false;
    }


    const providerStatus =
        getProviderStatus(
            model
        );


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
   NORMALIZE MODEL
   ---------------------------------------------------------
   Tidak membuat data teknis baru.

   Hanya menambahkan alias aman agar module Generate
   tidak perlu mengetahui variasi response backend.
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


    const normalized =
        {
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


    /*
     * Jangan mengganti nilai model_id
     * dengan ID database.
     */
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


    /*
     * Compatibility provider.
     */
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


    return normalized;
}


/* =========================================================
   MERGE MODEL CONFIGURATION
   ---------------------------------------------------------
   Dipertahankan untuk kompatibilitas.

   Detail server memiliki prioritas.
   Data list hanya digunakan sebagai fallback.
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
     * Normalize tetapi jangan membuat model baru.
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
   ---------------------------------------------------------
   OPTIMIZATION:

   Jika model sudah tersedia di availableModels,
   langsung gunakan model tersebut.

   Tidak perlu:
       GET /api/model-config
       GET /api/model-config?model_id=...

   Endpoint detail tetap menjadi fallback jika fungsi
   dipanggil sebelum daftar model tersedia.
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
     *
     * Endpoint list sudah mengirim konfigurasi lengkap.
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
            "[GEN-Z.AI][Generate Model] Parameters:",
            model.parameters || {}
        );


        return model;
    }


    /*
     * =====================================================
     * FALLBACK DETAIL REQUEST
     * =====================================================
     *
     * Hanya digunakan jika model belum ada
     * di availableModels.
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


    /*
     * loadModelConfig sekarang menggunakan
     * fast path dari state.
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


    /*
     * Fast path.
     * Tidak request endpoint kedua.
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
