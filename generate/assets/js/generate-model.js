/* =========================================================
   GEN-Z.AI
   GENERATE MODEL MODULE
   ---------------------------------------------------------
   File:
   generate/assets/js/generate-model.js

   Tanggung jawab:
   - Load daftar model dari /api/model-config
   - Load detail model
   - Authorization Bearer
   - Render model selector
   - Resolve model awal
   - Simpan model terpilih
   - Mempertahankan parameter model dari backend

   Source of truth:
   - Model       : Admin Models / Supabase models
   - Provider    : Supabase providers
   - Adapter     : model adapter registry

   Tidak ada parameter model yang hardcoded.
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
   STORAGE
========================================================= */

const SELECTED_MODEL_STORAGE_KEY =
    "genz_generate_selected_model";


function getStoredModelId() {

    try {

        return String(
            localStorage.getItem(
                SELECTED_MODEL_STORAGE_KEY
            ) ||
            ""
        ).trim();

    } catch {

        return "";
    }
}


function saveSelectedModelId(
    modelId
) {

    const normalizedId =
        String(
            modelId ||
            ""
        ).trim();


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
========================================================= */

function getModelId(
    model
) {

    if (!model) {
        return "";
    }


    return String(
        model.model_id ||
        model.id ||
        ""
    ).trim();
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
        model.model_id ||
        model.id,
        "Model"
    );
}


/* =========================================================
   PROVIDER NAME
========================================================= */

function getProviderName(
    model
) {

    if (!model) {
        return "-";
    }


    if (
        model.provider &&
        typeof model.provider ===
            "object"
    ) {

        return safeString(
            model.provider.provider_name ||
            model.provider.name ||
            model.provider.provider_id ||
            model.provider.id,
            "-"
        );
    }


    return safeString(
        model.provider_name ||
        model.provider,
        "-"
    );
}


/* =========================================================
   PARAMETER AVAILABILITY
   ---------------------------------------------------------
   Tidak menentukan isi parameter.
   Hanya memeriksa apakah backend sudah
   mengirim konfigurasi parameter.
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
            Object.keys(
                parameters
            ).length > 0
        );
    }


    return false;
}


/* =========================================================
   MERGE MODEL CONFIG
   ---------------------------------------------------------
   Detail endpoint tetap menjadi source utama.

   Tetapi jika detail response kehilangan
   field parameters, parameter dari model
   yang sudah diterima dari endpoint list
   dipertahankan.

   Tidak membuat parameter baru.
========================================================= */

function mergeModelConfiguration(
    detailModel,
    listModel
) {

    if (!detailModel) {
        return listModel || null;
    }


    if (!listModel) {
        return detailModel;
    }


    const merged = {
        ...listModel,
        ...detailModel
    };


    /*
     * Parameter detail menjadi prioritas
     * jika benar-benar tersedia.
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

        /*
         * Jika detail tidak membawa parameter,
         * pertahankan parameter dari list.
         */
        merged.parameters =
            listModel.parameters;
    }


    /*
     * Beberapa konfigurasi adapter mungkin
     * berada di config.
     *
     * Pertahankan jika detail tidak membawanya.
     */
    if (
        !merged.config &&
        listModel.config
    ) {

        merged.config =
            listModel.config;
    }


    /*
     * Parameter schema kompatibilitas.
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


    return merged;
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
        getModelId(
            model
        );


    if (!modelId) {
        return false;
    }


    const modelStatus =
        String(
            model.status ||
            ""
        )
            .trim()
            .toLowerCase();


    if (
        modelStatus &&
        modelStatus !==
            "active"
    ) {

        return false;
    }


    const provider =
        model.provider;


    if (
        !provider ||
        typeof provider !==
            "object"
    ) {

        return false;
    }


    const providerStatus =
        String(
            provider.status ||
            ""
        )
            .trim()
            .toLowerCase();


    if (
        providerStatus &&
        providerStatus !==
            "active"
    ) {

        return false;
    }


    const providerId =
        String(
            model.provider_code ||
            model.provider_id ||
            provider.provider_id ||
            provider.id ||
            ""
        ).trim();


    if (!providerId) {
        return false;
    }


    return true;
}


/* =========================================================
   EXECUTABLE
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


    return (
        model.adapter_available ===
        true
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


    const validModels =
        models.filter(
            model =>
                isVisibleModel(
                    model
                )
        );


    if (
        validModels.length ===
            0
    ) {

        throw new Error(
            "Tidak ada model aktif yang tersedia."
        );
    }


    /*
     * Simpan model lengkap dari backend.
     *
     * Termasuk:
     * - parameters
     * - pricing
     * - duration
     * - ratios
     * - resolutions
     * - adapter status
     */
    setAvailableModels(
        validModels
    );


    console.debug(
        "[GEN-Z.AI][Generate Model] Loaded models:",
        validModels
    );


    return validModels;
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
        Array.isArray(models)
            ? models.filter(
                model =>
                    isVisibleModel(
                        model
                    )
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
                model.adapter_available ===
                    true
                    ? "true"
                    : "false";


            option.dataset.parametersAvailable =
                hasParameters(
                    model
                )
                    ? "true"
                    : "false";


            modelSelect.appendChild(
                option
            );
        }
    );


    let selectedModelId =
        String(
            preferredModelId ||
            getStoredModelId() ||
            ""
        ).trim();


    const preferredExists =
        normalizedModels.some(
            model =>
                getModelId(
                    model
                ) ===
                selectedModelId
        );


    if (!preferredExists) {

        const executableModel =
            normalizedModels.find(
                model =>
                    isExecutableModel(
                        model
                    )
            );


        if (executableModel) {

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
        String(
            modelId ||
            ""
        ).trim();


    if (!normalizedId) {
        return null;
    }


    return findAvailableModel(
        normalizedId
    );
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
   LOAD MODEL CONFIG
========================================================= */

export async function loadModelConfig(
    modelId
) {

    const normalizedId =
        String(
            modelId ||
            ""
        ).trim();


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


    if (!availableModel) {

        throw new Error(
            "Model yang dipilih tidak tersedia."
        );
    }


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
        extractSingleModel(
            data
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


    /*
     * Gabungkan detail + list.
     *
     * Detail tetap prioritas.
     * Parameter dari list dipertahankan jika
     * detail tidak mengirimkannya.
     */
    const model =
        mergeModelConfiguration(
            detailModel,
            availableModel
        );


    /*
     * Verifikasi parameter yang diterima.
     */
    console.debug(
        "[GEN-Z.AI][Generate Model] Selected model:",
        model
    );


    console.debug(
        "[GEN-Z.AI][Generate Model] Parameters:",
        model?.parameters || {}
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
        String(
            modelId ||
            ""
        ).trim();


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


    if (
        !isExecutableModel(
            selectedModel
        )
    ) {

        throw new Error(
            "Model yang dipilih belum memiliki adapter dan belum siap digunakan."
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


        if (executableModel) {

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


    let executablePreferred =
        null;


    if (
        preferredModelId
    ) {

        executablePreferred =
            models.find(
                model =>
                    getModelId(
                        model
                    ) ===
                    String(
                        preferredModelId
                    ).trim() &&
                    isExecutableModel(
                        model
                    )
            );
    }


    let selectedModelId =
        executablePreferred
            ? getModelId(
                executablePreferred
            )
            : null;


    if (!selectedModelId) {

        const executableModel =
            models.find(
                model =>
                    isExecutableModel(
                        model
                    )
            );


        if (executableModel) {

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
