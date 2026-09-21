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
   - Mengisi form dengan data Models
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
   - Mengarang data model
   ========================================================= */

import {
    loadModels,
    loadProviders,
    getModelById,
    getModelByModelId
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

    const number = Number(value);

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
         * {9:16,16:9}
         */

        if (
            text.startsWith("{") &&
            text.endsWith("}")
        ) {

            const inner =
                text.slice(1, -1);

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
            /*
             * Bukan JSON.
             */
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


/* =========================================================
   MODEL CLONE
   ---------------------------------------------------------
   Jangan bergantung pada normalizeModel() dari models-data.js.
   Versi models-data.js saat ini tidak mengekspor fungsi tersebut.

   Source of truth:
   - model object yang diberikan oleh Models module
   - bukan data buatan Edit module
   ========================================================= */

function cloneModel(model) {

    if (!model) {
        return null;
    }


    const cloned = {
        ...model
    };


    /*
     * Array dibuat copy agar perubahan state Edit
     * tidak mengubah object Models asli.
     */

    if (
        Array.isArray(
            model.supported_ratios
        )
    ) {

        cloned.supported_ratios = [
            ...model.supported_ratios
        ];

    } else {

        cloned.supported_ratios =
            normalizeArray(
                model.supported_ratios
            );

    }


    if (
        Array.isArray(
            model.supported_resolutions
        )
    ) {

        cloned.supported_resolutions = [
            ...model.supported_resolutions
        ];

    } else {

        cloned.supported_resolutions =
            normalizeArray(
                model.supported_resolutions
            );

    }


    /*
     * Credit resolution:
     *
     * Prioritas:
     * 1. credit_480p
     * 2. credit480p
     * 3. nilai existing
     *
     * TIDAK menggunakan credit_final sebagai
     * formula otomatis.
     */

    cloned.credit_480p =
        normalizeNumber(
            model.credit_480p ??
            model.credit480p,
            0
        );


    cloned.credit_720p =
        normalizeNumber(
            model.credit_720p ??
            model.credit720p,
            0
        );


    cloned.credit_1080p =
        normalizeNumber(
            model.credit_1080p ??
            model.credit1080p,
            0
        );


    /*
     * Credit legacy tetap dipertahankan.
     */

    if (
        model.credit_cost !== undefined
    ) {

        cloned.credit_cost =
            normalizeNumber(
                model.credit_cost,
                0
            );

    }


    if (
        model.discount_percent !== undefined
    ) {

        cloned.discount_percent =
            normalizeNumber(
                model.discount_percent,
                0
            );

    }


    if (
        model.credit_final !== undefined
    ) {

        cloned.credit_final =
            normalizeNumber(
                model.credit_final,
                0
            );

    }


    /*
     * Duration.
     */

    if (
        model.min_duration !== undefined
    ) {

        cloned.min_duration =
            normalizeNumber(
                model.min_duration,
                0
            );

    }


    if (
        model.max_duration !== undefined
    ) {

        cloned.max_duration =
            normalizeNumber(
                model.max_duration,
                0
            );

    }


    return cloned;

}


/* =========================================================
   ROOT ELEMENT
   ========================================================= */

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
   PROVIDER LOOKUP
   ---------------------------------------------------------
   Jangan memakai getProviderById() dari models-data.js
   karena fungsi tersebut async.

   Di sini providers sudah diberikan oleh caller,
   jadi lookup lokal lebih ringan dan tidak membuat
   request tambahan.
   ========================================================= */

function findProviderById(
    providers,
    providerId
) {

    const id =
        normalizeId(
            providerId
        );

    if (!id) {
        return null;
    }


    const list =
        Array.isArray(
            providers
        )
            ? providers
            : [];


    return (
        list.find(
            provider =>
                normalizeId(
                    provider?.id
                ) === id
        ) ||
        null
    );

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
        cloneModel(
            model
        );


    if (!normalized) {

        clearEditingModel();

        return null;

    }


    const databaseId =
        normalizeId(
            normalized.id
        );


    /*
     * Database ID adalah identitas record yang
     * sedang diedit.
     */

    editState = {

        active:
            true,

        modelId:
            databaseId || null,

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
     * jangan query ulang.
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


    /*
     * Gunakan models yang sudah tersedia
     * jika caller memilikinya.
     */

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
     * Fallback ke model_id.
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

    /*
     * Jika model object diberikan, tidak perlu
     * reload models.
     */

    const model =
        await resolveModelForEdit(
            modelOrId,
            options
        );


    if (!model) {

        throw new Error(
            "EDIT_MODEL_DATA_MISSING"
        );

    }


    /*
     * Provider juga memakai data yang sudah tersedia
     * bila caller telah memuatnya.
     */

    const providers =
        Array.isArray(
            options.providers
        )
            ? options.providers
            : await loadProviders({
                force:
                    Boolean(
                        options.force
                    )
            });


    /*
     * Models dikembalikan supaya openEditModel()
     * tidak melakukan loadModels() kedua kali.
     */

    const models =
        Array.isArray(
            options.models
        )
            ? options.models
            : (
                model
                    ? [model]
                    : []
            );


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
                : [],

        models:
            Array.isArray(
                models
            )
                ? models
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
        findProviderById(
            providers,
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
     * Sinkronkan state dengan model yang
     * benar-benar dirender.
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


    /*
     * Event hanya dipasang sekali setelah
     * HTML form selesai dibuat.
     */

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

    /*
     * loadEditData sekarang mengembalikan:
     * - model
     * - providers
     * - models
     *
     * Jadi tidak perlu loadModels() kedua kali.
     */

    const data =
        await loadEditData(
            modelOrId,
            options
        );


    const models =
        Array.isArray(
            data.models
        )
            ? data.models
            : (
                data.model
                    ? [data.model]
                    : []
            );


    renderEditForm(
        root,
        data.model,
        {

            providers:
                data.providers,

            models:
                models

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


    const original =
        getEditingModel();


    if (!original) {

        throw new Error(
            "EDIT_MODEL_STATE_MISSING"
        );

    }


    const data =
        collectModelFormData(
            container
        );


    /*
     * Helper untuk membaca number dari form.
     *
     * Jika field TIDAK ADA:
     * gunakan nilai model asli.
     *
     * Jangan otomatis menjadi 0 karena itu
     * bisa menghancurkan harga credit lama.
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

                const raw =
                    element.value;


                /*
                 * Input ada tetapi kosong.
                 * Tetap gunakan fallback existing.
                 */

                if (
                    raw === null ||
                    raw === undefined ||
                    String(raw).trim() === ""
                ) {

                    return fallback;

                }


                return normalizeNumber(
                    raw,
                    fallback
                );

            }

        }


        return fallback;

    }


    /*
     * CREDIT 480p
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
     * CREDIT 720p
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
     * CREDIT 1080p
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
     * Database ID tidak boleh berasal dari input.
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


    /*
     * Model ID adalah identitas model.
     * Jika form tidak mengirimkannya, gunakan
     * nilai asli.
     */

    if (
        !data.model_id &&
        original.model_id
    ) {

        data.model_id =
            original.model_id;

    }


    /*
     * Nama model juga dipertahankan jika
     * layout tidak mengirimkannya.
     */

    if (
        !data.model_name &&
        original.model_name
    ) {

        data.model_name =
            original.model_name;

    }


    /*
     * Provider ID dipertahankan dari model asli
     * jika layout tidak mengirimkannya.
     */

    if (
        !data.provider_id &&
        original.provider_id
    ) {

        data.provider_id =
            original.provider_id;

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


    /*
     * Normalize hanya data form.
     */

    const normalized =
        normalizeModelSubmission(
            raw,
            providers
        );


    /*
     * Pastikan tiga credit resolution selalu
     * dibawa ke payload.
     *
     * Tidak dihitung dari credit_final.
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
     * ID database harus tetap ID record asli.
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
     * Jangan sampai provider berubah menjadi
     * provider code atau nilai lain.
     */

    if (
        original &&
        original.provider_id
    ) {

        normalized.provider_id =
            original.provider_id;

    }


    /*
     * Model identity tidak boleh hilang
     * ketika field readonly tidak ikut submit.
     */

    if (
        original &&
        original.model_id
    ) {

        normalized.model_id =
            original.model_id;

    }


    if (
        original &&
        original.model_name
    ) {

        normalized.model_name =
            original.model_name;

    }


    /*
     * Model family juga dipertahankan.
     */

    if (
        original &&
        original.model_family
    ) {

        normalized.model_family =
            original.model_family;

    }


    /*
     * Technical metadata tetap dari model asli.
     *
     * Edit hanya mengubah field yang memang
     * diperbolehkan.
     */

    if (
        original &&
        original.supported_ratios
    ) {

        normalized.supported_ratios =
            normalizeArray(
                original.supported_ratios
            );

    }


    if (
        original &&
        original.supported_resolutions
    ) {

        normalized.supported_resolutions =
            normalizeArray(
                original.supported_resolutions
            );

    }


    if (
        original &&
        original.min_duration !== undefined
    ) {

        normalized.min_duration =
            original.min_duration;

    }


    if (
        original &&
        original.max_duration !== undefined
    ) {

        normalized.max_duration =
            original.max_duration;

    }


    /*
     * KIE price / identity tidak dibuat ulang
     * oleh Edit module.
     *
     * Jika field ada pada original model,
     * pertahankan.
     */

    if (
        original &&
        original.kie_unit_price !== undefined
    ) {

        normalized.kie_unit_price =
            original.kie_unit_price;

    }


    if (
        original &&
        original.kie_price !== undefined
    ) {

        normalized.kie_price =
            original.kie_price;

    }


    /*
     * Validasi form umum.
     */

    const errors =
        validateModelFormData(
            normalized,
            {
                providers
            }
        );


    /*
     * Validasi khusus credit resolution.
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


    /*
     * Provider wajib benar-benar ada di
     * providers yang sudah dimuat.
     */

    const provider =
        findProviderById(
            providers,
            normalized.provider_id
        );


    if (
        normalized.provider_id &&
        !provider
    ) {

        errors.push(
            "Provider model tidak ditemukan di tabel providers."
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
                            item === null ||
                            item === undefined
                                ? ""
                                : item
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
     * Numeric string dibandingkan sebagai number.
     */

    if (
        typeof value === "string" &&
        value.trim() !== "" &&
        Number.isFinite(
            Number(value)
        )
    ) {

        return Number(
            value
        );

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
     * Database ID tidak boleh berubah.
     */

    if (
        editState.modelId
    ) {

        normalized.id =
            editState.modelId;

    }


    /*
     * Provider/model identity juga dipertahankan
     * dari state awal bila tersedia.
     */

    if (
        editState.model
    ) {

        if (
            editState.model.provider_id
        ) {

            normalized.provider_id =
                editState.model.provider_id;

        }


        if (
            editState.model.model_id
        ) {

            normalized.model_id =
                editState.model.model_id;

        }


        if (
            editState.model.model_name
        ) {

            normalized.model_name =
                editState.model.model_name;

        }

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
     * diperbarui.
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
     * Modul Edit tidak melakukan update Supabase.
     *
     * Update tetap didelegasikan ke handler/coordinator.
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
     * Snapshot sebelum submit.
     */

    const editingSnapshot =
        getEditingModel();


    const changedFields =
        getChangedFields(
            editingSnapshot,
            data
        );


    /*
     * Submit tepat SATU kali.
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
     * Commit hanya setelah handler berhasil.
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
   RESTORE ORIGINAL FORM
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
   ========================================================= */

if (
    typeof window !== "undefined"
) {

    window.GENZModelFormEdit =
        ModelFormEdit;

}


export default ModelFormEdit;
