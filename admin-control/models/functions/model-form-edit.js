/* =========================================================
   GEN-Z.AI
   MODEL FORM EDIT MODULE
   ---------------------------------------------------------
   File:
   admin-control/models/functions/model-form-edit.js

   Tanggung jawab:
   - Menentukan mode Edit
   - Menyimpan model yang sedang diedit
   - Menyimpan snapshot model awal
   - Membuka form Edit
   - Mengisi form dengan data Models
   - Menjaga provider tetap berasal dari providers
   - Menyiapkan data sebelum submit
   - Delegasi submit ke coordinator / handler
   - Menjaga credit per resolution:
       credit_480p
       credit_720p
       credit_1080p
   - Menjaga discount_percent

   Tidak bertanggung jawab:
   - Query Supabase langsung
   - Render table
   - Create database
   - Update database langsung
   - Delete model
   - Data kie_*
   - Mengarang data model
   - Menghitung / menyimpan credit_final
   ========================================================= */

import {
    loadModels,
    loadProviders
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
    model: null,
    originalModel: null
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


function hasOwn(
    object,
    key
) {

    return Boolean(
        object &&
        Object.prototype.hasOwnProperty.call(
            object,
            key
        )
    );

}


function readNumberField(
    source,
    snakeCaseKey,
    camelCaseKey,
    fallback = 0
) {

    if (!source) {
        return fallback;
    }

    /*
     * hasOwnProperty digunakan supaya nilai 0
     * tetap dianggap sebagai nilai valid.
     */

    if (
        hasOwn(
            source,
            snakeCaseKey
        )
    ) {

        const value =
            source[snakeCaseKey];

        if (
            value !== null &&
            value !== undefined &&
            value !== ""
        ) {

            return normalizeNumber(
                value,
                fallback
            );

        }

    }


    if (
        camelCaseKey &&
        hasOwn(
            source,
            camelCaseKey
        )
    ) {

        const value =
            source[camelCaseKey];

        if (
            value !== null &&
            value !== undefined &&
            value !== ""
        ) {

            return normalizeNumber(
                value,
                fallback
            );

        }

    }


    return fallback;

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
                text.slice(
                    1,
                    -1
                );

            if (
                !inner.trim()
            ) {

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
   Tidak bergantung pada normalizeModel() dari
   models-data.js.

   Source of truth:
   - model object dari Models module
   - database Models
   - bukan data buatan Edit module
   ========================================================= */

function cloneModel(model) {

    if (!model) {
        return null;
    }


    const cloned = {
        ...model
    };


    /* -----------------------------------------------------
       SUPPORTED RATIOS
       ----------------------------------------------------- */

    cloned.supported_ratios =
        normalizeArray(
            model.supported_ratios
        );


    /* -----------------------------------------------------
       SUPPORTED RESOLUTIONS
       ----------------------------------------------------- */

    cloned.supported_resolutions =
        normalizeArray(
            model.supported_resolutions
        );


    /* -----------------------------------------------------
       CREDIT PER RESOLUTION
       ----------------------------------------------------- */

    cloned.credit_480p =
        readNumberField(
            model,
            "credit_480p",
            "credit480p",
            0
        );


    cloned.credit_720p =
        readNumberField(
            model,
            "credit_720p",
            "credit720p",
            0
        );


    cloned.credit_1080p =
        readNumberField(
            model,
            "credit_1080p",
            "credit1080p",
            0
        );


    /* -----------------------------------------------------
       DISCOUNT
       ----------------------------------------------------- */

    if (
        model.discount_percent !== undefined &&
        model.discount_percent !== null
    ) {

        cloned.discount_percent =
            normalizeNumber(
                model.discount_percent,
                0
            );

    }


    /* -----------------------------------------------------
       DURATION
       ----------------------------------------------------- */

    if (
        model.min_duration !== undefined &&
        model.min_duration !== null
    ) {

        cloned.min_duration =
            normalizeNumber(
                model.min_duration,
                0
            );

    }


    if (
        model.max_duration !== undefined &&
        model.max_duration !== null
    ) {

        cloned.max_duration =
            normalizeNumber(
                model.max_duration,
                0
            );

    }


    /*
     * Model family hanya dipertahankan jika memang
     * berasal dari source model.
     */

    if (
        model.model_family !== undefined &&
        model.model_family !== null
    ) {

        cloned.model_family =
            String(
                model.model_family
            ).trim();

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
   Provider harus berasal dari providers yang sudah
   dimuat oleh caller / Models module.

   Tidak melakukan query tambahan.
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
   MODEL LOOKUP
   ---------------------------------------------------------
   Pencarian hanya terhadap Models yang sudah dimuat.

   Prioritas:
   1. database id
   2. model_id
   ========================================================= */

function findModelInList(
    models,
    value
) {

    const target =
        normalizeId(
            value
        );


    if (!target) {
        return null;
    }


    const list =
        Array.isArray(
            models
        )
            ? models
            : [];


    /*
     * 1. Database ID
     */

    const byDatabaseId =
        list.find(
            model =>
                normalizeId(
                    model?.id
                ) === target
        );


    if (
        byDatabaseId
    ) {

        return byDatabaseId;

    }


    /*
     * 2. Model ID
     */

    const byModelId =
        list.find(
            model =>
                normalizeId(
                    model?.model_id
                ) === target
        );


    if (
        byModelId
    ) {

        return byModelId;

    }


    return null;

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


export function getOriginalEditingModel() {

    return editState.originalModel
        ? cloneModel(
            editState.originalModel
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
            ),

        originalModel:
            cloneModel(
                editState.originalModel
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


    /*
     * Database ID adalah identitas record
     * yang sedang diedit.
     */

    const databaseId =
        normalizeId(
            normalized.id
        );


    /*
     * Jika sudah berada dalam mode Edit untuk
     * record yang sama, jangan mengganti
     * originalModel dengan state terbaru.
     */

    const sameEditingRecord =
        editState.active === true &&
        normalizeId(
            editState.modelId
        ) === databaseId;


    const originalSnapshot =
        sameEditingRecord &&
        editState.originalModel
            ? cloneModel(
                editState.originalModel
            )
            : cloneModel(
                normalized
            );


    editState = {

        active:
            true,

        modelId:
            databaseId || null,

        model:
            normalized,

        originalModel:
            originalSnapshot

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
            null,

        originalModel:
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
     * Gunakan Models yang sudah diberikan
     * oleh caller terlebih dahulu.
     */

    let models =
        Array.isArray(
            options.models
        )
            ? options.models
            : null;


    /*
     * Jika caller belum memiliki Models,
     * baru load Models satu kali.
     */

    if (!models) {

        models =
            await loadModels({
                force:
                    Boolean(
                        options.force
                    )
            });

    }


    if (
        !Array.isArray(
            models
        )
    ) {

        models = [];

    }


    const model =
        findModelInList(
            models,
            value
        );


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
     * Jika model object diberikan,
     * gunakan object tersebut langsung.
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
     * Provider menggunakan data yang sudah tersedia.
     * Jika belum tersedia, loadProviders dilakukan
     * satu kali.
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
     * Pertahankan seluruh Models jika tersedia.
     *
     * Ini penting untuk komponen search/dropdown Model.
     */

    const models =
        Array.isArray(
            options.models
        )
            ? options.models
            : [model];


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


    /*
     * Provider wajib ada di providers.
     */

    const providerErrors =
        validateEditProvider(
            normalized,
            providers
        );


    if (
        providerErrors.length
    ) {

        const error =
            new Error(
                providerErrors.join(" ")
            );

        error.code =
            "EDIT_PROVIDER_INVALID";

        error.errors =
            providerErrors;

        throw error;

    }


    /*
     * Sinkronkan state dengan model
     * yang benar-benar dirender.
     *
     * Jangan mengganti original snapshot apabila
     * record yang sama sedang diedit.
     */

    setEditingModel(
        normalized
    );


    /*
     * Render form.
     */

    container.innerHTML =
        renderModelForm(
            normalized,
            {
                providers,
                models
            }
        );


    /*
     * Event hanya dipasang setelah HTML
     * selesai dibuat.
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


    /* -----------------------------------------------------
       SAFE NUMBER READER
       ----------------------------------------------------- */

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
                 * Field ada tetapi kosong:
                 * jangan menghancurkan nilai lama.
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


    /* -----------------------------------------------------
       CREDIT 480p
       ----------------------------------------------------- */

    data.credit_480p =
        readNumber(
            [
                "[name='credit_480p']",
                "#credit_480p",
                "#credit480p",
                "[data-field='credit_480p']"
            ],
            readNumberField(
                original,
                "credit_480p",
                "credit480p",
                0
            )
        );


    /* -----------------------------------------------------
       CREDIT 720p
       ----------------------------------------------------- */

    data.credit_720p =
        readNumber(
            [
                "[name='credit_720p']",
                "#credit_720p",
                "#credit720p",
                "[data-field='credit_720p']"
            ],
            readNumberField(
                original,
                "credit_720p",
                "credit720p",
                0
            )
        );


    /* -----------------------------------------------------
       CREDIT 1080p
       ----------------------------------------------------- */

    data.credit_1080p =
        readNumber(
            [
                "[name='credit_1080p']",
                "#credit_1080p",
                "#credit1080p",
                "[data-field='credit_1080p']"
            ],
            readNumberField(
                original,
                "credit_1080p",
                "credit1080p",
                0
            )
        );


    /* -----------------------------------------------------
       DISCOUNT
       ----------------------------------------------------- */

    data.discount_percent =
        readNumber(
            [
                "[name='discount_percent']",
                "#discount_percent",
                "#discountPercent",
                "[data-field='discount_percent']"
            ],
            readNumberField(
                original,
                "discount_percent",
                "discountPercent",
                0
            )
        );


    /* -----------------------------------------------------
       DATABASE ID
       -----------------------------------------------------
       Tidak boleh berasal dari input form.
       ----------------------------------------------------- */

    data.id =
        normalizeId(
            original.id
        );


    if (!data.id) {

        throw new Error(
            "EDIT_MODEL_DATABASE_ID_MISSING"
        );

    }


    /* -----------------------------------------------------
       MODEL ID
       ----------------------------------------------------- */

    if (
        !data.model_id &&
        original.model_id
    ) {

        data.model_id =
            original.model_id;

    }


    /* -----------------------------------------------------
       MODEL NAME
       ----------------------------------------------------- */

    if (
        !data.model_name &&
        original.model_name
    ) {

        data.model_name =
            original.model_name;

    }


    /* -----------------------------------------------------
       MODEL FAMILY
       ----------------------------------------------------- */

    if (
        !data.model_family &&
        original.model_family
    ) {

        data.model_family =
            original.model_family;

    }


    /* -----------------------------------------------------
       PROVIDER ID
       ----------------------------------------------------- */

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
     * Normalize data form.
     */

    const normalized =
        normalizeModelSubmission(
            raw,
            providers
        );


    /* -----------------------------------------------------
       CREDIT PER RESOLUTION
       -----------------------------------------------------
       Nilai berasal dari konfigurasi model.

       TIDAK:
       - dihitung dari credit_final
       - dihitung dari KIE price
       - dihitung dari USD
       - dihitung dari duration
       ----------------------------------------------------- */

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


    normalized.discount_percent =
        normalizeNumber(
            raw.discount_percent,
            0
        );


    /* -----------------------------------------------------
       DATABASE ID
       ----------------------------------------------------- */

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


    /* -----------------------------------------------------
       PROVIDER ID
       -----------------------------------------------------
       Provider identity berasal dari model awal.
       ----------------------------------------------------- */

    if (
        original &&
        original.provider_id
    ) {

        normalized.provider_id =
            original.provider_id;

    }


    /* -----------------------------------------------------
       MODEL ID
       ----------------------------------------------------- */

    if (
        original &&
        original.model_id
    ) {

        normalized.model_id =
            original.model_id;

    }


    /* -----------------------------------------------------
       MODEL NAME
       ----------------------------------------------------- */

    if (
        original &&
        original.model_name
    ) {

        normalized.model_name =
            original.model_name;

    }


    /* -----------------------------------------------------
       MODEL FAMILY
       ----------------------------------------------------- */

    if (
        original &&
        original.model_family
    ) {

        normalized.model_family =
            original.model_family;

    }


    /* -----------------------------------------------------
       TECHNICAL METADATA
       -----------------------------------------------------
       Jangan diubah oleh Edit jika source model
       sudah memilikinya.
       ----------------------------------------------------- */

    if (
        original
    ) {

        normalized.supported_ratios =
            normalizeArray(
                original.supported_ratios
            );


        normalized.supported_resolutions =
            normalizeArray(
                original.supported_resolutions
            );

    }


    /* -----------------------------------------------------
       DURATION
       ----------------------------------------------------- */

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


    /* -----------------------------------------------------
       KIE PRICE
       -----------------------------------------------------
       Jangan dihitung ulang di Edit module.
       ----------------------------------------------------- */

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


    /* -----------------------------------------------------
       VALIDASI FORM UMUM
       ----------------------------------------------------- */

    const errors =
        validateModelFormData(
            normalized,
            {
                providers
            }
        );


    /*
     * Pastikan errors selalu array.
     */

    const validationErrors =
        Array.isArray(
            errors
        )
            ? errors
            : [];


    /* -----------------------------------------------------
       VALIDASI CREDIT 480p
       ----------------------------------------------------- */

    if (
        !Number.isFinite(
            normalized.credit_480p
        ) ||
        normalized.credit_480p < 0
    ) {

        validationErrors.push(
            "Credit 480p tidak valid."
        );

    }


    /* -----------------------------------------------------
       VALIDASI CREDIT 720p
       ----------------------------------------------------- */

    if (
        !Number.isFinite(
            normalized.credit_720p
        ) ||
        normalized.credit_720p < 0
    ) {

        validationErrors.push(
            "Credit 720p tidak valid."
        );

    }


    /* -----------------------------------------------------
       VALIDASI CREDIT 1080p
       ----------------------------------------------------- */

    if (
        !Number.isFinite(
            normalized.credit_1080p
        ) ||
        normalized.credit_1080p < 0
    ) {

        validationErrors.push(
            "Credit 1080p tidak valid."
        );

    }


    /* -----------------------------------------------------
       VALIDASI DISCOUNT
       ----------------------------------------------------- */

    if (
        !Number.isFinite(
            normalized.discount_percent
        ) ||
        normalized.discount_percent < 0 ||
        normalized.discount_percent > 100
    ) {

        validationErrors.push(
            "Discount harus berada di antara 0 dan 100."
        );

    }


    /* -----------------------------------------------------
       VALIDASI PROVIDER
       ----------------------------------------------------- */

    const provider =
        findProviderById(
            providers,
            normalized.provider_id
        );


    if (
        normalized.provider_id &&
        !provider
    ) {

        validationErrors.push(
            "Provider model tidak ditemukan di tabel providers."
        );

    }


    /* -----------------------------------------------------
       THROW VALIDATION ERROR
       ----------------------------------------------------- */

    if (
        validationErrors.length
    ) {

        const error =
            new Error(
                "MODEL_FORM_VALIDATION_FAILED"
            );


        error.code =
            "MODEL_FORM_VALIDATION_FAILED";


        error.errors =
            validationErrors;


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

    "model_family",

    "description",

    "discount_percent",

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


/* =========================================================
   GET CHANGED FIELDS
   ---------------------------------------------------------
   Default comparison menggunakan ORIGINAL MODEL,
   bukan state model terakhir yang mungkin sudah
   dimodifikasi oleh event sementara.
   ========================================================= */

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


/* =========================================================
   HAS CHANGES
   ========================================================= */

export function hasChanges(
    updatedModel
) {

    const original =
        getOriginalEditingModel();


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
     * Provider/model identity tetap dari
     * state awal.
     */

    if (
        editState.originalModel
    ) {

        if (
            editState.originalModel.provider_id
        ) {

            normalized.provider_id =
                editState.originalModel.provider_id;

        }


        if (
            editState.originalModel.model_id
        ) {

            normalized.model_id =
                editState.originalModel.model_id;

        }


        if (
            editState.originalModel.model_name
        ) {

            normalized.model_name =
                editState.originalModel.model_name;

        }


        if (
            editState.originalModel.model_family
        ) {

            normalized.model_family =
                editState.originalModel.model_family;

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
     * Jika API tidak mengembalikan ID,
     * gunakan ID record yang sedang diedit.
     */

    if (
        !normalized.id &&
        editState.modelId
    ) {

        normalized.id =
            editState.modelId;

    }


    /*
     * Setelah API berhasil menyimpan,
     * state Edit diperbarui.
     *
     * Snapshot original juga digeser ke
     * hasil yang sudah berhasil disimpan.
     */

    editState.model =
        normalized;


    editState.originalModel =
        cloneModel(
            normalized
        );


    editState.modelId =
        normalizeId(
            normalized.id
        );


    editState.active =
        true;


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
   ---------------------------------------------------------
   Mengembalikan snapshot sebelum perubahan.
   ========================================================= */

export function cancelEditModel() {

    const original =
        getOriginalEditingModel();


    clearEditingModel();


    return original;

}


/* =========================================================
   SUBMIT DELEGATION
   ---------------------------------------------------------
   Tidak ada Supabase/API call langsung.
   Tidak ada fallback recursive.
   Handler dipanggil tepat satu kali.
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
     * Snapshot ORIGINAL sebelum submit.
     */

    const editingSnapshot =
        getOriginalEditingModel() ||
        getEditingModel();


    const changedFields =
        getChangedFields(
            editingSnapshot,
            data
        );


    /*
     * Submit SATU kali.
     *
     * Tidak ada:
     * submitEditModel()
     * submit()
     * fallback()
     * recursive retry
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

    } else if (
        result &&
        typeof result === "object" &&
        (
            result.id ||
            result.model_id
        )
    ) {

        commitEditModel(
            result
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
   RESTORE EDIT FORM
   ---------------------------------------------------------
   Restore selalu menggunakan ORIGINAL SNAPSHOT.
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
        getOriginalEditingModel();


    if (!original) {

        return null;

    }


    /*
     * Reset state model aktif ke snapshot original,
     * tetapi tetap mempertahankan snapshot tersebut.
     */

    editState.model =
        cloneModel(
            original
        );


    editingModel =
        cloneModel(
            original
        );


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
    getOriginalEditingModel,
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
