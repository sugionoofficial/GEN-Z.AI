/* =========================================================
   GEN-Z.AI
   MODEL FORM EDIT MODULE
   ---------------------------------------------------------
   File:
   admin-control/models/functions/model-form-edit.js

   Tanggung jawab:
   - Menentukan mode Edit
   - Menyimpan model yang sedang diedit
   - Membuka form Edit
   - Mengisi form dengan data models
   - Menjaga provider tetap berasal dari providers
   - Menyiapkan data sebelum submit
   - Delegasi submit ke coordinator / handler

   Tidak bertanggung jawab:
   - Query Supabase langsung
   - Render table
   - Create database
   - Update database langsung
   - Delete model
   - Data kie_*
   ========================================================= */

import {
    normalizeModel,
    loadModels,
    loadProviders,
    getModelById,
    getModelByModelId,
    getProviderById
} from "../models-data.js";

import {
    renderModelForm,
    collectModelFormData,
    validateModelFormData,
    normalizeModelSubmission,
    attachModelFormEvents
} from "./model-form-layout.js";


/* =========================================================
   STATE
   ========================================================= */

let editingModel = null;

let editState = {
    active: false,
    modelId: null,
    model: null
};


/* =========================================================
   SAFE HELPERS
   ========================================================= */

function normalizeId(value) {
    return String(
        value === null ||
        value === undefined
            ? ""
            : value
    ).trim();
}


function cloneModel(model) {
    if (!model) {
        return null;
    }

    const normalized =
        normalizeModel(model);

    return {
        ...normalized,

        supported_ratios:
            Array.isArray(
                normalized.supported_ratios
            )
                ? [
                    ...normalized.supported_ratios
                ]
                : [],

        supported_resolutions:
            Array.isArray(
                normalized.supported_resolutions
            )
                ? [
                    ...normalized.supported_resolutions
                ]
                : []
    };
}


function getRootElement(root) {
    if (!root) {
        return null;
    }

    if (
        typeof root === "string"
    ) {
        return document.querySelector(root);
    }

    return root;
}


/* =========================================================
   EDIT STATE
   ========================================================= */

export function isEditing() {
    return editState.active === true;
}


export function getEditingModel() {
    return editState.model
        ? cloneModel(editState.model)
        : null;
}


export function getEditingModelId() {
    return editState.modelId;
}


export function getEditState() {
    return {
        active: editState.active,
        modelId: editState.modelId,
        model: cloneModel(
            editState.model
        )
    };
}


/* =========================================================
   SET EDIT MODEL
   ========================================================= */

export function setEditingModel(model) {
    if (!model) {
        clearEditingModel();
        return null;
    }

    const normalized =
        cloneModel(model);

    if (!normalized) {
        clearEditingModel();
        return null;
    }

    editState = {
        active: true,

        modelId:
            normalizeId(
                normalized.id
            ),

        model: normalized
    };

    editingModel =
        cloneModel(normalized);

    return cloneModel(normalized);
}


/* =========================================================
   CLEAR EDIT STATE
   ========================================================= */

export function clearEditingModel() {
    editingModel = null;

    editState = {
        active: false,
        modelId: null,
        model: null
    };
}


/* =========================================================
   RESOLVE MODEL
   ========================================================= */

export async function resolveModelForEdit(
    modelOrId,
    options = {}
) {
    /*
     * Jika object model langsung diberikan,
     * tidak perlu query ulang.
     */
    if (
        modelOrId &&
        typeof modelOrId === "object"
    ) {
        return setEditingModel(
            modelOrId
        );
    }

    const value =
        normalizeId(modelOrId);

    if (!value) {
        throw new Error(
            "MODEL_ID_REQUIRED"
        );
    }

    const models =
        Array.isArray(options.models)
            ? options.models
            : await loadModels({
                force:
                    Boolean(options.force)
            });

    let model =
        getModelById(
            models,
            value
        );

    /*
     * Fallback ke model_id API.
     *
     * Ini penting karena tombol Edit bisa
     * mengirim database UUID atau model_id.
     */
    if (!model) {
        model =
            getModelByModelId(
                models,
                value
            );
    }

    if (!model) {
        throw new Error(
            "MODEL_NOT_FOUND"
        );
    }

    return setEditingModel(
        model
    );
}


/* =========================================================
   LOAD EDIT DATA
   ========================================================= */

export async function loadEditData(
    modelOrId,
    options = {}
) {
    const [
        model,
        providers
    ] = await Promise.all([
        resolveModelForEdit(
            modelOrId,
            options
        ),

        Array.isArray(
            options.providers
        )
            ? options.providers
            : loadProviders({
                force:
                    Boolean(options.force)
            })
    ]);

    if (!model) {
        throw new Error(
            "EDIT_MODEL_DATA_MISSING"
        );
    }

    return {
        model:
            cloneModel(model),

        providers:
            Array.isArray(providers)
                ? providers
                : []
    };
}


/* =========================================================
   PROVIDER VALIDATION
   ========================================================= */

export function validateEditProvider(
    model,
    providers
) {
    const errors = [];

    if (!model) {
        errors.push(
            "Model tidak ditemukan."
        );

        return errors;
    }

    const providerId =
        normalizeId(
            model.provider_id
        );

    if (!providerId) {
        errors.push(
            "Provider model belum ditentukan."
        );

        return errors;
    }

    const provider =
        getProviderById(
            providers || [],
            providerId
        );

    if (!provider) {
        errors.push(
            "Provider model tidak ditemukan di tabel providers."
        );

        return errors;
    }

    return errors;
}


/* =========================================================
   RENDER EDIT FORM
   ========================================================= */

export function renderEditForm(
    root,
    model,
    options = {}
) {
    const container =
        getRootElement(root);

    if (!container) {
        throw new Error(
            "EDIT_FORM_ROOT_MISSING"
        );
    }

    const normalized =
        cloneModel(model);

    if (!normalized) {
        throw new Error(
            "EDIT_MODEL_MISSING"
        );
    }

    const providers =
        Array.isArray(options.providers)
            ? options.providers
            : [];

    const models =
        Array.isArray(options.models)
            ? options.models
            : [];

    const providerErrors =
        validateEditProvider(
            normalized,
            providers
        );

    if (providerErrors.length) {
        throw new Error(
            providerErrors.join(" ")
        );
    }

    /*
     * Pastikan state tetap sinkron dengan
     * model yang benar-benar dirender.
     */
    setEditingModel(
        normalized
    );

    container.innerHTML =
        renderModelForm(
            normalized,
            {
                providers,
                models
            }
        );

    attachModelFormEvents(
        container,
        {
            providers,
            models
        }
    );

    /*
     * Tandai container sebagai Edit form.
     * Coordinator dapat menggunakan marker ini
     * tanpa perlu membaca state module.
     */
    if (container.dataset) {
        container.dataset.modelFormMode =
            "edit";

        container.dataset.modelId =
            normalizeId(
                normalized.id
            );
    }

    return container;
}


/* =========================================================
   OPEN EDIT
   ========================================================= */

export async function openEditModel(
    root,
    modelOrId,
    options = {}
) {
    const data =
        await loadEditData(
            modelOrId,
            options
        );

    renderEditForm(
        root,
        data.model,
        {
            providers:
                data.providers,

            models:
                Array.isArray(options.models)
                    ? options.models
                    : await loadModels({
                        force:
                            Boolean(options.force)
                    })
        }
    );

    return {
        ...data,
        editing: true
    };
}


/* =========================================================
   COLLECT EDIT DATA
   ========================================================= */

export function collectEditData(
    root
) {
    if (!isEditing()) {
        throw new Error(
            "NOT_EDITING"
        );
    }

    const container =
        getRootElement(root);

    if (!container) {
        throw new Error(
            "EDIT_FORM_ROOT_MISSING"
        );
    }

    const data =
        collectModelFormData(
            container
        );

    /*
     * ID wajib berasal dari model yang sedang
     * diedit, bukan dari input yang bisa diubah.
     */
    const original =
        getEditingModel();

    if (!original) {
        throw new Error(
            "EDIT_MODEL_STATE_MISSING"
        );
    }

    data.id =
        normalizeId(
            original.id
        );

    if (!data.id) {
        throw new Error(
            "EDIT_MODEL_DATABASE_ID_MISSING"
        );
    }

    return data;
}


/* =========================================================
   PREPARE EDIT SUBMISSION
   ========================================================= */

export function prepareEditSubmission(
    root,
    options = {}
) {
    const raw =
        collectEditData(
            root
        );

    const providers =
        Array.isArray(options.providers)
            ? options.providers
            : [];

    const normalized =
        normalizeModelSubmission(
            raw,
            providers
        );

    /*
     * Jangan izinkan provider berubah menjadi
     * provider code. models.provider_id harus
     * tetap FK ke providers.id.
     */
    const original =
        getEditingModel();

    if (
        original &&
        original.id
    ) {
        normalized.id =
            normalizeId(
                original.id
            );
    }

    const errors =
        validateModelFormData(
            normalized,
            {
                providers
            }
        );

    if (errors.length) {
        const error =
            new Error(
                "MODEL_FORM_VALIDATION_FAILED"
            );

        error.errors = errors;

        throw error;
    }

    return normalized;
}


/* =========================================================
   CHANGE DETECTION
   ========================================================= */

function normalizeComparableArray(
    value
) {
    if (!Array.isArray(value)) {
        return [];
    }

    return [
        ...new Set(
            value
                .map(item =>
                    String(
                        item || ""
                    ).trim()
                )
                .filter(Boolean)
        )
    ].sort();
}


function comparableValue(value) {
    if (Array.isArray(value)) {
        return normalizeComparableArray(
            value
        );
    }

    if (
        value === null ||
        value === undefined
    ) {
        return null;
    }

    if (
        typeof value === "number"
    ) {
        return Number(value);
    }

    return String(value).trim();
}


const EDIT_COMPARE_FIELDS = [
    "provider_id",
    "model_id",
    "model_name",
    "description",
    "credit_cost",
    "discount_percent",
    "credit_final",
    "min_duration",
    "max_duration",
    "supported_ratios",
    "supported_resolutions",
    "status"
];


export function getChangedFields(
    originalModel,
    updatedModel
) {
    const original =
        cloneModel(
            originalModel
        );

    const updated =
        cloneModel(
            updatedModel
        );

    if (!original || !updated) {
        return [];
    }

    const changed = [];

    for (
        const field
        of EDIT_COMPARE_FIELDS
    ) {
        const oldValue =
            comparableValue(
                original[field]
            );

        const newValue =
            comparableValue(
                updated[field]
            );

        if (
            JSON.stringify(oldValue) !==
            JSON.stringify(newValue)
        ) {
            changed.push(field);
        }
    }

    return changed;
}


export function hasChanges(
    updatedModel
) {
    const original =
        getEditingModel();

    if (!original) {
        return false;
    }

    return (
        getChangedFields(
            original,
            updatedModel
        ).length > 0
    );
}


/* =========================================================
   UPDATE LOCAL EDIT STATE
   ========================================================= */

export function updateEditingModel(
    model
) {
    if (!isEditing()) {
        return null;
    }

    const normalized =
        cloneModel(model);

    if (!normalized) {
        return null;
    }

    /*
     * ID model yang sedang diedit tidak boleh
     * bergeser akibat hasil form.
     */
    if (editState.modelId) {
        normalized.id =
            editState.modelId;
    }

    editState.model =
        normalized;

    editingModel =
        cloneModel(normalized);

    return cloneModel(
        normalized
    );
}


/* =========================================================
   COMMIT LOCAL EDIT STATE
   ========================================================= */

export function commitEditModel(
    savedModel
) {
    if (!savedModel) {
        return null;
    }

    const normalized =
        cloneModel(savedModel);

    if (!normalized) {
        return null;
    }

    /*
     * Setelah berhasil disimpan, state Edit
     * diperbarui tetapi mode Edit tetap aktif
     * sampai coordinator menutup form.
     */
    editState.model =
        normalized;

    editState.modelId =
        normalizeId(
            normalized.id
        );

    editingModel =
        cloneModel(normalized);

    return cloneModel(
        normalized
    );
}


/* =========================================================
   CLOSE EDIT
   ========================================================= */

export function closeEditModel() {
    clearEditingModel();
}


/* =========================================================
   CANCEL EDIT
   ========================================================= */

export function cancelEditModel() {
    const original =
        getEditingModel();

    clearEditingModel();

    return original;
}


/* =========================================================
   SUBMIT DELEGATION
   ========================================================= */

export async function submitEditModel(
    root,
    options = {}
) {
    const data =
        prepareEditSubmission(
            root,
            options
        );

    /*
     * Modul ini tidak melakukan Supabase update.
     *
     * Cari handler dari coordinator:
     *
     * options.submit
     * options.onSubmit
     *
     * Ini mencegah loop:
     *
     * edit -> save -> edit -> save -> ...
     */
    const submitHandler =
        typeof options.submit === "function"
            ? options.submit
            : typeof options.onSubmit === "function"
                ? options.onSubmit
                : null;

    if (!submitHandler) {
        const error =
            new Error(
                "EDIT_SUBMIT_HANDLER_MISSING"
            );

        error.data = data;

        throw error;
    }

    const result =
        await submitHandler(
            data,
            {
                mode: "edit",
                model:
                    getEditingModel(),
                changedFields:
                    getChangedFields(
                        getEditingModel(),
                        data
                    )
            }
        );

    /*
     * Jangan otomatis memanggil submit lagi.
     * Ini penting untuk mencegah stack overflow.
     */
    if (
        result &&
        result.model
    ) {
        commitEditModel(
            result.model
        );
    } else if (
        result &&
        result.data
    ) {
        commitEditModel(
            result.data
        );
    }

    return result;
}


/* =========================================================
   FORM EVENT BINDING
   ========================================================= */

export function bindEditForm(
    root,
    options = {}
) {
    const container =
        getRootElement(root);

    if (!container) {
        throw new Error(
            "EDIT_FORM_ROOT_MISSING"
        );
    }

    if (!isEditing()) {
        throw new Error(
            "NOT_EDITING"
        );
    }

    const providers =
        Array.isArray(options.providers)
            ? options.providers
            : [];

    const models =
        Array.isArray(options.models)
            ? options.models
            : [];

    attachModelFormEvents(
        container,
        {
            providers,
            models
        }
    );

    if (container.dataset) {
        container.dataset.modelFormMode =
            "edit";

        container.dataset.modelId =
            normalizeId(
                editState.modelId
            );
    }

    return container;
}


/* =========================================================
   FORM RESET TO ORIGINAL
   ========================================================= */

export function restoreOriginalEditForm(
    root,
    options = {}
) {
    if (!isEditing()) {
        return null;
    }

    const original =
        getEditingModel();

    if (!original) {
        return null;
    }

    return renderEditForm(
        root,
        original,
        options
    );
}


/* =========================================================
   GUARD
   ========================================================= */

export function assertEditing() {
    if (!isEditing()) {
        const error =
            new Error(
                "MODEL_EDIT_NOT_ACTIVE"
            );

        error.code =
            "MODEL_EDIT_NOT_ACTIVE";

        throw error;
    }

    return true;
}


/* =========================================================
   PUBLIC API
   ========================================================= */

const ModelFormEdit = {
    isEditing,

    getEditingModel,
    getEditingModelId,
    getEditState,

    setEditingModel,
    clearEditingModel,

    resolveModelForEdit,
    loadEditData,

    renderEditForm,
    openEditModel,

    collectEditData,
    prepareEditSubmission,

    validateEditProvider,

    getChangedFields,
    hasChanges,

    updateEditingModel,
    commitEditModel,

    closeEditModel,
    cancelEditModel,

    submitEditModel,

    bindEditForm,
    restoreOriginalEditForm,

    assertEditing
};


/* =========================================================
   GLOBAL COMPATIBILITY
   ---------------------------------------------------------
   Dipertahankan agar modul lama/coordinator yang masih
   membaca window.GENZModelFormEdit tidak langsung rusak.
   ========================================================= */

if (
    typeof window !== "undefined"
) {
    window.GENZModelFormEdit =
        ModelFormEdit;
}


export default ModelFormEdit;
