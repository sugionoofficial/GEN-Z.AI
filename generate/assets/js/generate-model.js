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

   Tidak bertanggung jawab:
   - Supabase initialization
   - Profile / role
   - Dynamic form
   - Generate request
   - Provider API key
   - Credit deduction
   - Result rendering

   Source of truth:
   - Model       : Admin Models / Supabase models
   - Provider    : Supabase providers
   - Adapter     : model adapter registry

   PENTING:
   - Tidak menggunakan generate-utils.js
   - Model active tetap boleh tampil walaupun
     adapter belum tersedia
   - Model tanpa adapter tidak dianggap executable
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
   LOCAL HELPERS
   ---------------------------------------------------------
   generate-utils.js tidak tersedia di repository.
   Fungsi yang diperlukan dibuat lokal agar module
   tidak mempunyai dependency yang rusak.
========================================================= */


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
   STORAGE KEY
========================================================= */

const SELECTED_MODEL_STORAGE_KEY =
    "genz_generate_selected_model";


/* =========================================================
   GET STORED MODEL ID
========================================================= */

function getStoredModelId() {

    try {

        return String(
            localStorage.getItem(
                SELECTED_MODEL_STORAGE_KEY
            ) ||
            ""
        ).trim();

    } catch (error) {

        return "";

    }

}


/* =========================================================
   SAVE SELECTED MODEL ID
========================================================= */

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

    } catch (error) {

        /*
         * localStorage bukan source of truth.
         * Jika browser memblokir storage,
         * Generate tetap dapat berjalan.
         */

    }

}


/* =========================================================
   GET ELEMENTS
========================================================= */

function getElements() {

    return getGenerateElements();

}


/* =========================================================
   GET MODEL ID
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
   GET MODEL NAME
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
   GET PROVIDER NAME
========================================================= */

function getProviderName(
    model
) {

    if (!model) {
        return "-";
    }


    if (
        typeof model.provider ===
            "object" &&
        model.provider
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
   MODEL VISIBILITY VALIDATION
   ---------------------------------------------------------
   Menentukan apakah model boleh ditampilkan.

   TIDAK memeriksa adapter.

   Syarat:
   - model valid
   - model_id tersedia
   - status model active jika status tersedia
   - provider tersedia
   - provider active jika status tersedia
   - provider ID tersedia
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


    /*
     * Jika status dikirim backend,
     * hanya active yang ditampilkan.
     *
     * Jika tidak ada status, jangan
     * mengarang status inactive.
     */

    const modelStatus =
        String(
            model.status ||
            ""
        )
            .trim()
            .toLowerCase();


    if (
        modelStatus &&
        modelStatus !== "active"
    ) {

        return false;

    }


    /*
     * Provider wajib berupa object.
     */

    const provider =
        model.provider;


    if (
        !provider ||
        typeof provider !==
            "object"
    ) {

        return false;

    }


    /*
     * Jika provider memiliki status,
     * provider harus active.
     */

    const providerStatus =
        String(
            provider.status ||
            ""
        )
            .trim()
            .toLowerCase();


    if (
        providerStatus &&
        providerStatus !== "active"
    ) {

        return false;

    }


    /*
     * Provider ID.
     */

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
   MODEL EXECUTION VALIDATION
   ---------------------------------------------------------
   Model visible belum tentu executable.

   Adapter WAJIB tersedia untuk execution.
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
                method: "GET",

                headers: {
                    "Accept":
                        "application/json",

                    "Authorization":
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

    } catch (error) {

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
     * Model berasal langsung dari backend.
     *
     * Tidak ada model hardcoded.
     */

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


    setAvailableModels(
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


    /*
     * Placeholder.
     */

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


    /*
     * Hanya model visible yang
     * ditampilkan.
     */

    const normalizedModels =
        Array.isArray(
            models
        )
            ? models.filter(
                model =>
                    isVisibleModel(
                        model
                    )
            )
            : [];


    /*
     * Render model.
     */

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


            modelSelect.appendChild(
                option
            );

        }
    );


    /*
     * Tentukan model pilihan.
     *
     * Prioritas:
     *
     * 1. preferredModelId yang valid
     * 2. stored model yang valid
     * 3. executable model pertama
     * 4. visible model pertama
     */

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


    /*
     * Pastikan model memang berasal dari
     * daftar yang sudah dimuat.
     */

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


    const model =
        extractSingleModel(
            data
        );


    if (
        !model ||
        !getModelId(
            model
        )
    ) {

        throw new Error(
            `Konfigurasi model "${normalizedId}" tidak ditemukan.`
        );

    }


    const serverModelId =
        getModelId(
            model
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
     * Detail endpoint memang mensyaratkan
     * adapter untuk execution.
     *
     * Model tanpa adapter tetap terlihat
     * di selector, tetapi tidak dijadikan
     * current executable model.
     */

    if (
        !isExecutableModel(
            model
        )
    ) {

        throw new Error(
            `Model "${serverModelId}" belum siap digunakan. Provider atau adapter model tidak aktif.`
        );

    }


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
   HANDLE MODEL CHANGE
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


    /*
     * Hanya gunakan stored model jika
     * masih tersedia dan executable.
     */

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


    /*
     * Jika stored model tidak executable,
     * cari executable model pertama.
     */

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


    /*
     * Render semua model active.
     *
     * Kalau tidak ada adapter sama sekali,
     * daftar model tetap tampil.
     */

    const renderedModelId =
        renderModelSelector(
            models,
            selectedModelId
        );


    /*
     * Tidak ada model executable.
     *
     * Jangan memanggil detail endpoint,
     * karena backend memang akan menolaknya.
     */

    if (!selectedModelId) {

        setCurrentModel(
            null
        );

        setModelLoaded(
            false
        );


        return {
            model: null,
            models,
            executable: false,
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
        executable: true,
        selectedModelId:
            selectedModelId
    };

}


/* =========================================================
   REFRESH MODEL LIST
========================================================= */

export async function refreshModels(
    preferredModelId = null
) {

    const models =
        await loadAvailableModels();


    /*
     * Hanya gunakan preferred model
     * jika executable.
     */

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
            model: null,
            executable: false,
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
        executable: true,
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
   EXPORT MODEL API
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
