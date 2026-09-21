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
   - Menjaga credit per resolution:
       credit_480p
       credit_720p
       credit_1080p

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


function normalizeNumber(
    value,
    fallback = 0
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


function normalizeArray(value) {

    if (
        Array.isArray(value)
    ) {

        return [
            ...new Set(
                value
                    .map(
                        item =>
                            String(
                                item === null ||
                                item === undefined
                                    ? ""
                                    : item
                            ).trim()
                    )
                    .filter(Boolean)
            )
        ];

    }


    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return [];

    }


    if (
        typeof value === "string"
    ) {

        const text =
            value.trim();


        if (!text) {
            return [];
        }


        /*
         * PostgreSQL array:
         *
         * {9:16,16:9}
         */
        if (
            text.startsWith("{") &&
            text.endsWith("}")
        ) {

            const inner =
                text.slice(
                    1,
                    -1
                );


            if (!inner.trim()) {
                return [];
            }


            return [
                ...new Set(
                    inner
                        .split(",")
                        .map(
                            item =>
                                item
                                    .replace(
                                        /^"(.*)"$/,
                                        "$1"
                                    )
                                    .trim()
                        )
                        .filter(Boolean)
                )
            ];

        }


        /*
         * JSON array.
         */
        try {

            const parsed =
                JSON.parse(text);


            if (
                Array.isArray(parsed)
            ) {

                return normalizeArray(
                    parsed
                );

            }

        } catch {
            /* Bukan JSON. */
        }


        /*
         * CSV fallback.
         */
        if (
            text.includes(",")
        ) {

            return [
                ...new Set(
                    text
                        .split(",")
                        .map(
                            item =>
                                item.trim()
                        )
                        .filter(Boolean)
                )
            ];

        }


        return [
            text
        ];

    }


    return [];

}


function cloneModel(model) {

    if (!model) {
        return null;
    }


    const normalized =
        normalizeModel(model);


    /*
     * normalizeModel() pada models-data.js
     * dapat memiliki field yang belum mengenal
     * credit per resolution.
     *
     * Karena itu field credit resolution
     * dipertahankan secara eksplisit dari source
     * model.
     */

    const credit480p =
        normalizeNumber(
            model.credit_480p ??
            model.credit480p ??
            normalized.credit_480p ??
            normalized.credit480p,
            0
        );


    const credit720p =
        normalizeNumber(
            model.credit_720p ??
            model.credit720p ??
            normalized.credit_720p ??
            normalized.credit720p,
            0
        );


    const credit1080p =
        normalizeNumber(
            model.credit_1080p ??
            model.credit1080p ??
            normalized.credit_1080p ??
            normalized.credit1080p,
            0
        );


    return {

        ...normalized,


        /*
         * Pastikan field credit per resolution
         * selalu tersedia di state Edit.
         */

        credit_480p:
            credit480p,

        credit_720p:
            credit720p,

        credit_1080p:
            credit1080p,


        supported_ratios:
            Array.isArray(
                normalized.supported_ratios
            )
                ? [
                    ...normalized.supported_ratios
                ]
                : normalizeArray(
                    model.supported_ratios
                ),


        supported_resolutions:
            Array.isArray(
                normalized.supported_resolutions
            )
                ? [
                    ...normalized.supported_resolutions
                ]
                : normalizeArray(
                    model.supported_resolutions
                )

    };

}


function getRootElement(root) {

    if (!root) {
        return null;
    }


    if (
        typeof root === "string"
    ) {

        return document.querySelector(
            root
        );

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
        ? cloneModel(
            editState.model
        )
        : null;

}


export function getEditingModelId() {

    return editState.modelId;

}


export function getEditState() {

    return {

        active:
            editState.active,

        modelId:
            editState.modelId,

        model:
            cloneModel(
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

        active:
            true,

        modelId:
            normalizeId(
                normalized.id
            ),

        model:
            normalized

    };


    editingModel =
        cloneModel(
            normalized
        );


    return cloneModel(
        normalized
    );

}


/* =========================================================
   CLEAR EDIT STATE
   ========================================================= */

export function clearEditingModel() {

    editingModel = null;


    editState = {

        active:
            false,

        modelId:
            null,

        model:
            null

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
        normalizeId(
            modelOrId
        );


    if (!value) {

        throw new Error(
            "MODEL_ID_REQUIRED"
        );

    }


    const models =
        Array.isArray(
            options.models
        )
            ? options.models
            : await loadModels({
                force:
                    Boolean(
                        options.force
                    )
            });


    let model =
        getModelById(
            models,
            value
        );


    /*
     * Fallback ke model_id API.
     *
     * Tombol Edit dapat mengirim:
     * - database UUID
     * - model_id
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
                    Boolean(
                        options.force
                    )
            })

    ]);


    if (!model) {

        throw new Error(
            "EDIT_MODEL_DATA_MISSING"
        );

    }


    return {

        model:
            cloneModel(
                model
            ),

        providers:
            Array.isArray(
                providers
            )
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
        getRootElement(
            root
        );


    if (!container) {

        throw new Error(
            "EDIT_FORM_ROOT_MISSING"
        );

    }


    const normalized =
        cloneModel(
            model
        );


    if (!normalized) {

        throw new Error(
            "EDIT_MODEL_MISSING"
        );

    }


    const providers =
        Array.isArray(
            options.providers
        )
            ? options.providers
            : [];


    const models =
        Array.isArray(
            options.models
        )
            ? options.models
            : [];


    const providerErrors =
        validateEditProvider(
            normalized,
            providers
        );


    if (
        providerErrors.length
    ) {

        throw new Error(
            providerErrors.join(" ")
        );

    }


    /*
     * Pastikan state sinkron dengan
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
     * Marker Edit form.
     */

    if (
        container.dataset
    ) {

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


    let models;


    if (
        Array.isArray(
            options.models
        )
    ) {

        models =
            options.models;

    } else {

        /*
         * Gunakan model yang sudah berhasil
         * diperoleh terlebih dahulu.
         *
         * Tidak perlu memaksa request tambahan
         * apabila model list sudah tersedia.
         */

        models =
            await loadModels({
                force:
                    Boolean(
                        options.force
                    )
            });

    }


    renderEditForm(
        root,
        data.model,
        {

            providers:
                data.providers,

            models:
                Array.isArray(
                    models
                )
                    ? models
                    : []

        }
    );


    return {

        ...data,

        editing:
            true

    };

}


/* =========================================================
   COLLECT EDIT DATA
   ========================================================= */

export function collectEditData(
    root
) {

    if (
        !isEditing()
    ) {

        throw new Error(
            "NOT_EDITING"
        );

    }


    const container =
        getRootElement(
            root
        );


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
     * Pastikan credit resolution tetap terbaca
     * walaupun layout lama belum meneruskannya.
     */

    function readNumber(
        selectors,
        fallback
    ) {

        for (
            const selector
            of selectors
        ) {

            const element =
                container.querySelector(
                    selector
                );


            if (
                element
            ) {

                return normalizeNumber(
                    element.value,
                    fallback
                );

            }

        }


        return fallback;

    }


    const original =
        getEditingModel();


    if (!original) {

        throw new Error(
            "EDIT_MODEL_STATE_MISSING"
        );

    }


    /*
     * Credit 480p
     */

    data.credit_480p =
        readNumber(
            [
                "[name='credit_480p']",
                "#credit_480p",
                "[data-field='credit_480p']"
            ],
            normalizeNumber(
                original.credit_480p,
                0
            )
        );


    /*
     * Credit 720p
     */

    data.credit_720p =
        readNumber(
            [
                "[name='credit_720p']",
                "#credit_720p",
                "[data-field='credit_720p']"
            ],
            normalizeNumber(
                original.credit_720p,
                0
            )
        );


    /*
     * Credit 1080p
     */

    data.credit_1080p =
        readNumber(
            [
                "[name='credit_1080p']",
                "#credit_1080p",
                "[data-field='credit_1080p']"
            ],
            normalizeNumber(
                original.credit_1080p,
                0
            )
        );


    /*
     * ID wajib berasal dari model yang sedang
     * diedit, bukan dari input yang bisa diubah.
     */

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
        Array.isArray(
            options.providers
        )
            ? options.providers
            : [];


    const normalized =
        normalizeModelSubmission(
            raw,
            providers
        );


    /*
     * Pastikan credit resolution tidak hilang
     * apabila normalizeModelSubmission() versi
     * lama belum mengenali field baru.
     */

    normalized.credit_480p =
        normalizeNumber(
            raw.credit_480p,
            0
        );


    normalized.credit_720p =
        normalizeNumber(
            raw.credit_720p,
            0
        );


    normalized.credit_1080p =
        normalizeNumber(
            raw.credit_1080p,
            0
        );


    /*
     * Jangan izinkan provider berubah menjadi
     * provider code.
     *
     * models.provider_id harus tetap FK
     * ke providers.id.
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


    /*
     * Jika model_id tidak boleh diganti,
     * pertahankan model_id asli ketika form
     * tidak mengirim nilai.
     *
     * Jika layout memang mengizinkan edit,
     * nilai form tetap digunakan.
     */

    if (
        !normalized.model_id &&
        original &&
        original.model_id
    ) {

        normalized.model_id =
            original.model_id;

    }


    /*
     * Jika nama model kosong akibat field
     * tidak tersedia, pertahankan nama asli.
     */

    if (
        !normalized.model_name &&
        original &&
        original.model_name
    ) {

        normalized.model_name =
            original.model_name;

    }


    /*
     * Validasi.
     */

    const errors =
        validateModelFormData(
            normalized,
            {
                providers
            }
        );


    /*
     * Validasi tambahan khusus credit resolution.
     *
     * Ini tetap dilakukan di module Edit agar
     * credit negatif tidak lolos walaupun layout
     * belum memiliki validasi field baru.
     */

    if (
        !Number.isFinite(
            normalized.credit_480p
        ) ||
        normalized.credit_480p < 0
    ) {

        errors.push(
            "Credit 480p tidak valid."
        );

    }


    if (
        !Number.isFinite(
            normalized.credit_720p
        ) ||
        normalized.credit_720p < 0
    ) {

        errors.push(
            "Credit 720p tidak valid."
        );

    }


    if (
        !Number.isFinite(
            normalized.credit_1080p
        ) ||
        normalized.credit_1080p < 0
    ) {

        errors.push(
            "Credit 1080p tidak valid."
        );

    }


    if (
        errors.length
    ) {

        const error =
            new Error(
                "MODEL_FORM_VALIDATION_FAILED"
            );


        error.code =
            "MODEL_FORM_VALIDATION_FAILED";


        error.errors =
            errors;


        error.data =
            normalized;


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

    if (
        !Array.isArray(value)
    ) {

        return [];

    }


    return [
        ...new Set(
            value
                .map(
                    item =>
                        String(
                            item || ""
                        ).trim()
                )
                .filter(Boolean)
        )
    ].sort();

}


function comparableValue(
    value
) {

    if (
        Array.isArray(value)
    ) {

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

        return Number(
            value
        );

    }


    /*
     * Credit resolution kadang datang sebagai
     * string dari input number.
     *
     * Normalisasi string numerik menjadi number
     * agar "100" dan 100 tidak dianggap perubahan.
     */

    if (
        typeof value === "string" &&
        value.trim() !== "" &&
        Number.isFinite(
            Number(value)
        )
    ) {

        return Number(value);

    }


    return String(
        value
    ).trim();

}


/* =========================================================
   EDIT COMPARE FIELDS
   ========================================================= */

const EDIT_COMPARE_FIELDS = [

    "provider_id",

    "model_id",

    "model_name",

    "description",

    "credit_cost",

    "discount_percent",

    "credit_final",

    /*
     * CREDIT PER RESOLUTION
     */

    "credit_480p",

    "credit_720p",

    "credit_1080p",

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


    if (
        !original ||
        !updated
    ) {

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
            JSON.stringify(
                oldValue
            ) !==
            JSON.stringify(
                newValue
            )
        ) {

            changed.push(
                field
            );

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

    if (
        !isEditing()
    ) {

        return null;

    }


    const normalized =
        cloneModel(
            model
        );


    if (!normalized) {

        return null;

    }


    /*
     * ID model yang sedang diedit tidak boleh
     * bergeser akibat hasil form.
     */

    if (
        editState.modelId
    ) {

        normalized.id =
            editState.modelId;

    }


    editState.model =
        normalized;


    editingModel =
        cloneModel(
            normalized
        );


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
        cloneModel(
            savedModel
        );


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
        cloneModel(
            normalized
        );


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
     * Handler tetap diserahkan kepada:
     *
     * options.submit
     * options.onSubmit
     */

    const submitHandler =
        typeof options.submit ===
            "function"

            ? options.submit

            : typeof options.onSubmit ===
                "function"

                ? options.onSubmit

                : null;


    if (
        !submitHandler
    ) {

        const error =
            new Error(
                "EDIT_SUBMIT_HANDLER_MISSING"
            );


        error.code =
            "EDIT_SUBMIT_HANDLER_MISSING";


        error.data =
            data;


        throw error;

    }


    /*
     * Snapshot state sebelum submit.
     *
     * Jangan mengambil state ulang setelah
     * coordinator mulai mengubah form.
     */

    const editingSnapshot =
        getEditingModel();


    const changedFields =
        getChangedFields(
            editingSnapshot,
            data
        );


    /*
     * Submit hanya SATU KALI.
     *
     * Tidak ada fallback recursive.
     */

    const result =
        await submitHandler(
            data,
            {

                mode:
                    "edit",

                model:
                    editingSnapshot,

                changedFields:
                    changedFields

            }
        );


    /*
     * Update local state hanya setelah handler
     * benar-benar mengembalikan model/data.
     *
     * Tidak memanggil submit lagi.
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
        getRootElement(
            root
        );


    if (!container) {

        throw new Error(
            "EDIT_FORM_ROOT_MISSING"
        );

    }


    if (
        !isEditing()
    ) {

        throw new Error(
            "NOT_EDITING"
        );

    }


    const providers =
        Array.isArray(
            options.providers
        )
            ? options.providers
            : [];


    const models =
        Array.isArray(
            options.models
        )
            ? options.models
            : [];


    attachModelFormEvents(
        container,
        {
            providers,
            models
        }
    );


    if (
        container.dataset
    ) {

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

    if (
        !isEditing()
    ) {

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

    if (
        !isEditing()
    ) {

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
