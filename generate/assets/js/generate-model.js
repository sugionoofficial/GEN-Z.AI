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
    getStoredModelId,
    saveSelectedModelId,
    safeString
} from "./generate-utils.js";

import {
    getAccessToken
} from "./generate-auth.js";


/* =========================================================
   CONSTANT
========================================================= */

const MODEL_CONFIG_ENDPOINT =
    "/api/model-config";


/* =========================================================
   HELPERS
========================================================= */

function getElements() {

    return getGenerateElements();

}


function getModelId(model) {

    if (!model) {
        return "";
    }

    return String(
        model.model_id ||
        model.id ||
        ""
    ).trim();

}


function getModelName(model) {

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


function getProviderName(model) {

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
            model.provider.provider_id,
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
   MODEL EXECUTION VALIDATION
   ---------------------------------------------------------
   Model tetap berasal dari Admin Models.

   Namun Generate hanya boleh menampilkan model yang:
   - mempunyai model_id
   - mempunyai adapter
   - provider tersedia
   - provider aktif
   - status model aktif

   API key TIDAK diperiksa di frontend.
   API key tetap menjadi tanggung jawab backend/provider.
========================================================= */

function isExecutableModel(model) {

    if (
        !model ||
        typeof model !== "object"
    ) {
        return false;
    }

    const modelId =
        getModelId(model);

    if (!modelId) {
        return false;
    }

    const modelStatus =
        String(
            model.status || ""
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
     * Model harus mempunyai adapter.
     *
     * Backend /api/model-config mengirim:
     *
     * adapter_available: true / false
     *
     * Jangan menganggap undefined sebagai true.
     */
    if (
        model.adapter_available !== true
    ) {
        return false;
    }

    /*
     * Provider harus tersedia.
     */
    const provider =
        model.provider;

    if (
        !provider ||
        typeof provider !== "object"
    ) {
        return false;
    }

    /*
     * Jika backend memberikan status provider,
     * model hanya boleh digunakan ketika active.
     */
    const providerStatus =
        String(
            provider.status || ""
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
     * Provider ID harus tersedia.
     */
    const providerId =
        String(
            model.provider_code ||
            provider.provider_id ||
            ""
        ).trim();

    if (!providerId) {
        return false;
    }

    return true;

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

                credentials: "same-origin"
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

    /*
     * Model source tetap berasal dari
     * /api/model-config.
     *
     * Tidak ada model hardcoded di frontend.
     */
    const validModels =
        models.filter(
            model =>
                isExecutableModel(
                    model
                )
        );

    /*
     * Jika backend mengirim model tetapi
     * semuanya tidak executable, berikan
     * pesan yang lebih tepat.
     */
    if (
        validModels.length === 0
    ) {

        const hasModels =
            models.length > 0;

        if (hasModels) {

            throw new Error(
                "Tidak ada model aktif yang memiliki adapter dan provider aktif."
            );

        }

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
    } = elements;

    if (!modelSelect) {

        throw new Error(
            "Element #modelSelect tidak ditemukan."
        );

    }

    /*
     * Bersihkan selector.
     */
    modelSelect.innerHTML = "";

    /*
     * Placeholder.
     */
    const placeholder =
        document.createElement(
            "option"
        );

    placeholder.value = "";

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
     * Hanya model executable yang
     * boleh dirender.
     *
     * Ini juga menjadi perlindungan kedua
     * jika fungsi ini dipanggil langsung
     * dengan data mentah.
     */
    const normalizedModels =
        Array.isArray(models)
            ? models.filter(
                model =>
                    isExecutableModel(
                        model
                    )
            )
            : [];

    /*
     * Tambahkan model dari API.
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
     * 1. preferredModelId
     * 2. stored model
     * 3. model pertama
     */
    let selectedModelId =
        preferredModelId ||
        getStoredModelId();

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

        selectedModelId =
            getModelId(
                normalizedModels[0]
            );

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
        normalizedModels.length === 0;

    if (modelSelector) {

        modelSelector.classList.add(
            "show"
        );

    }

    return selectedModelId || null;

}


/* =========================================================
   FIND MODEL
========================================================= */

export function findModel(
    modelId
) {

    const normalizedId =
        String(
            modelId || ""
        ).trim();

    if (!normalizedId) {
        return null;
    }

    return findAvailableModel(
        normalizedId
    );

}


/* =========================================================
   LOAD MODEL CONFIG
========================================================= */

export async function loadModelConfig(
    modelId
) {

    const normalizedId =
        String(
            modelId || ""
        ).trim();

    if (!normalizedId) {

        throw new Error(
            "Model ID tidak ditemukan."
        );

    }

    /*
     * Pastikan model memang berasal dari
     * daftar model yang telah dimuat.
     *
     * Ini mencegah frontend meminta
     * model sembarangan.
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

    if (
        !availableModel
    ) {

        throw new Error(
            "Model yang dipilih tidak tersedia."
        );

    }

    /*
     * URLSearchParams mencegah model_id
     * merusak URL ketika mempunyai karakter
     * khusus.
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

    /*
     * Endpoint detail biasanya mengembalikan
     * object model langsung, atau data.model.
     */
    let model =
        data?.model ||
        data?.data?.model ||
        data?.data;

    /*
     * Jika response langsung berupa object
     * model, gunakan response tersebut.
     */
    if (
        !model &&
        data &&
        typeof data === "object" &&
        !Array.isArray(data) &&
        (
            data.model_id ||
            data.id
        )
    ) {

        model =
            data;

    }

    if (
        !model ||
        !getModelId(model)
    ) {

        throw new Error(
            `Konfigurasi model "${normalizedId}" tidak ditemukan.`
        );

    }

    /*
     * Jangan mengganti model_id dari server
     * dengan nilai buatan frontend.
     */
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
     * Detail model juga wajib executable.
     *
     * Backend adalah sumber validasi utama.
     * Pemeriksaan frontend ini hanya menjaga
     * state agar tidak menyimpan model invalid.
     */
    if (
        !isExecutableModel(
            model
        )
    ) {

        throw new Error(
            `Model "${serverModelId}" tidak dapat digunakan. Provider atau adapter model tidak aktif.`
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
            modelId || ""
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

    /*
     * Selector harus berasal dari model
     * yang diberikan endpoint.
     */
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

    if (
        !selectedModel
    ) {

        throw new Error(
            "Model yang dipilih tidak tersedia."
        );

    }

    /*
     * Perlindungan tambahan.
     */
    if (
        !isExecutableModel(
            selectedModel
        )
    ) {

        throw new Error(
            "Model yang dipilih belum siap digunakan."
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
     * Jika model tersimpan masih tersedia
     * dan executable, gunakan model tersebut.
     */
    let selectedModelId =
        storedModelId;

    if (
        !selectedModelId ||
        !models.some(
            model =>
                getModelId(
                    model
                ) ===
                selectedModelId
        )
    ) {

        selectedModelId =
            getModelId(
                models[0]
            );

    }

    if (!selectedModelId) {

        throw new Error(
            "Model awal tidak dapat ditentukan."
        );

    }

    renderModelSelector(
        models,
        selectedModelId
    );

    const model =
        await loadModelConfig(
            selectedModelId
        );

    /*
     * Pastikan selector tetap sinkron
     * dengan model yang benar-benar diterima
     * dari endpoint detail.
     */
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

    return model;

}


/* =========================================================
   REFRESH MODEL LIST
========================================================= */

export async function refreshModels(
    preferredModelId = null
) {

    const models =
        await loadAvailableModels();

    const selectedModelId =
        renderModelSelector(
            models,
            preferredModelId
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
            model: null
        };

    }

    const model =
        await loadModelConfig(
            selectedModelId
        );

    return {
        models,
        model
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
