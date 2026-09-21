/* =========================================================
   GEN-Z.AI
   MODEL FORM LAYOUT MODULE
   ---------------------------------------------------------
   File:
   admin-control/models/functions/model-form-layout.js

   TANGGUNG JAWAB:
   - Render form Tambah Model
   - Render form Edit Model
   - Provider dari tabel providers
   - Model dari tabel models
   - Ratio dari models.supported_ratios
   - Resolution dari models.supported_resolutions
   - Duration dari models.min_duration / max_duration
   - Credit calculation
   - Credit per resolution:
       credit_480p
       credit_720p
       credit_1080p
   - Normalisasi form data

   DATABASE RELATION:
   ---------------------------------------------------------
   providers.id
        ↓
   models.provider_id

   providers.provider_id
        ↓
   provider_credentials.provider_id

   CATATAN:
   ---------------------------------------------------------
   - Model ID tidak dapat diubah saat Edit.
   - Provider tidak dapat diubah saat Edit karena
     merupakan bagian dari identitas model.
   - Ratio hanya berasal dari Supabase.
   - Resolution hanya berasal dari Supabase.
   - Duration mengikuti schema models:
       min_duration
       max_duration
   - Tidak mengarang daftar duration.
   - Tidak menggunakan tabel kie_*.
   - Tidak query Supabase secara langsung.
   - credit_final tetap dipertahankan sebagai
     compatibility/fallback.
   - Credit aktual per resolution disimpan pada:
       credit_480p
       credit_720p
       credit_1080p
   ========================================================= */

import {
    loadModels,
    loadProviders,
    normalizeModel,
    normalizeArrayValue,
    getProviderById,
    getProviderByCode
} from "../models-data.js";


/* =========================================================
   CONSTANTS
   ========================================================= */

const FIELD_NAMES = {

    id:
        "id",

    provider:
        "provider_id",

    modelId:
        "model_id",

    modelName:
        "model_name",

    description:
        "description",

    creditCost:
        "credit_cost",

    discountPercent:
        "discount_percent",

    creditFinal:
        "credit_final",

    credit480p:
        "credit_480p",

    credit720p:
        "credit_720p",

    credit1080p:
        "credit_1080p",

    minDuration:
        "min_duration",

    maxDuration:
        "max_duration",

    supportedRatios:
        "supported_ratios",

    supportedResolutions:
        "supported_resolutions",

    status:
        "status"

};


const STATUS_OPTIONS = [

    {
        value:
            "active",

        label:
            "Active"
    },

    {
        value:
            "inactive",

        label:
            "Inactive"
    },

    {
        value:
            "maintenance",

        label:
            "Maintenance"
    }

];


/* =========================================================
   SAFE HELPERS
   ========================================================= */

function escapeHtml(
    value
) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";

    }


    return String(
        value
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}


function toNumber(
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


    const parsed =
        Number(
            value
        );


    return Number.isFinite(
        parsed
    )
        ? parsed
        : fallback;

}


function unique(
    values
) {

    return [
        ...new Set(

            (
                Array.isArray(
                    values
                )
                    ? values
                    : []
            )
                .map(
                    value =>
                        String(
                            value ?? ""
                        ).trim()
                )
                .filter(
                    Boolean
                )

        )
    ];

}


function normalizeStatus(
    value
) {

    const status =
        String(
            value ?? ""
        )
            .trim()
            .toLowerCase();


    return STATUS_OPTIONS.some(
        option =>
            option.value ===
            status
    )

        ? status

        : "inactive";

}


function getElement(
    root,
    selector
) {

    if (
        !root ||
        typeof root.querySelector !==
            "function"
    ) {

        return null;

    }


    return root.querySelector(
        selector
    );

}


function getElements(
    root,
    selector
) {

    if (
        !root ||
        typeof root.querySelectorAll !==
            "function"
    ) {

        return [];

    }


    return [
        ...root.querySelectorAll(
            selector
        )
    ];

}


/* =========================================================
   NORMALIZE MODEL
   ========================================================= */

function normalizeFormModel(
    model
) {

    if (!model) {

        return {

            id:
                "",

            provider_id:
                "",

            model_id:
                "",

            model_name:
                "",

            description:
                "",

            credit_cost:
                0,

            discount_percent:
                0,

            credit_final:
                0,

            credit_480p:
                0,

            credit_720p:
                0,

            credit_1080p:
                0,

            min_duration:
                "",

            max_duration:
                "",

            supported_ratios:
                [],

            supported_resolutions:
                [],

            status:
                "active"

        };

    }


    /*
     * normalizeModel() tetap dipakai untuk
     * normalisasi struktur model utama.
     *
     * Credit resolution dibaca juga langsung
     * dari source model supaya tidak hilang
     * apabila normalizer lama belum mengenal
     * tiga field baru.
     */

    const normalized =
        normalizeModel(
            model
        );


    const source =
        model || {};


    const creditFinal =
        toNumber(
            normalized.credit_final ??
                source.credit_final,
            calculateCreditFinal(
                normalized.credit_cost,
                normalized.discount_percent
            )
        );


    /*
     * Untuk model lama:
     *
     * credit_480p
     * credit_720p
     * credit_1080p
     *
     * fallback ke credit_final.
     *
     * Tetapi apabila kolom memang sudah memiliki
     * nilai, nilai tersebut dipertahankan.
     */

    const credit480p =
        toNumber(
            source.credit_480p ??
                normalized.credit_480p,
            creditFinal
        );


    const credit720p =
        toNumber(
            source.credit_720p ??
                normalized.credit_720p,
            creditFinal
        );


    const credit1080p =
        toNumber(
            source.credit_1080p ??
                normalized.credit_1080p,
            creditFinal
        );


    return {

        id:
            normalized.id ||
            source.id ||
            "",

        provider_id:
            normalized.provider_id ||
            source.provider_id ||
            "",

        model_id:
            normalized.model_id ||
            source.model_id ||
            "",

        model_name:
            normalized.model_name ||
            source.model_name ||
            "",

        description:
            normalized.description ||
            source.description ||
            "",

        credit_cost:
            toNumber(
                normalized.credit_cost ??
                    source.credit_cost,
                0
            ),

        discount_percent:
            toNumber(
                normalized.discount_percent ??
                    source.discount_percent,
                0
            ),

        credit_final:
            creditFinal,

        credit_480p:
            credit480p,

        credit_720p:
            credit720p,

        credit_1080p:
            credit1080p,

        min_duration:
            normalized.min_duration !==
                null &&
            normalized.min_duration !==
                undefined

                ?

                normalized.min_duration

                :

                (
                    source.min_duration !==
                        null &&
                    source.min_duration !==
                        undefined

                        ?

                        source.min_duration

                        :

                        ""
                ),

        max_duration:
            normalized.max_duration !==
                null &&
            normalized.max_duration !==
                undefined

                ?

                normalized.max_duration

                :

                (
                    source.max_duration !==
                        null &&
                    source.max_duration !==
                        undefined

                        ?

                        source.max_duration

                        :

                        ""
                ),

        supported_ratios:
            unique(
                normalizeArrayValue(
                    normalized.supported_ratios ??
                        source.supported_ratios
                )
            ),

        supported_resolutions:
            unique(
                normalizeArrayValue(
                    normalized.supported_resolutions ??
                        source.supported_resolutions
                )
            ),

        status:
            normalizeStatus(
                normalized.status ||
                    source.status
            )

    };

}


/* =========================================================
   PROVIDER HELPERS
   ========================================================= */

function providerLabel(
    provider
) {

    if (!provider) {

        return "Unknown Provider";

    }


    return (

        provider.provider_name ||

        provider.name ||

        provider.provider_id ||

        provider.id ||

        "Unknown Provider"

    );

}


function providerCode(
    provider
) {

    if (!provider) {

        return "";

    }


    return String(

        provider.provider_id ||

        provider.code ||

        ""

    ).trim();

}


function providerDatabaseId(
    provider
) {

    if (!provider) {

        return "";

    }


    return String(
        provider.id ||
        ""
    ).trim();

}


function isProviderActive(
    provider
) {

    if (!provider) {

        return false;

    }


    if (
        provider.is_active ===
            true ||

        provider.active ===
            true ||

        provider.enabled ===
            true
    ) {

        return true;

    }


    const status =
        String(
            provider.status ?? ""
        )
            .trim()
            .toLowerCase();


    return (

        status ===
            "active" ||

        status ===
            "aktif" ||

        status ===
            "enabled"

    );

}


function sortProviders(
    providers
) {

    return [
        ...(providers || [])
    ].sort(
        (
            a,
            b
        ) => {

            const activeA =
                isProviderActive(
                    a
                )
                    ? 0
                    : 1;


            const activeB =
                isProviderActive(
                    b
                )
                    ? 0
                    : 1;


            if (
                activeA !==
                activeB
            ) {

                return (
                    activeA -
                    activeB
                );

            }


            return providerLabel(
                a
            ).localeCompare(
                providerLabel(
                    b
                ),
                "id",
                {
                    sensitivity:
                        "base"
                }
            );

        }
    );

}


/* =========================================================
   PROVIDER OPTIONS
   ========================================================= */

function renderProviderOptions(
    providers,
    selectedProviderId = "",
    selectedProviderCode = "",
    isEdit = false
) {

    const normalizedId =
        String(
            selectedProviderId ?? ""
        ).trim();


    const normalizedCode =
        String(
            selectedProviderCode ?? ""
        ).trim();


    const sorted =
        sortProviders(
            providers
        );


    let html = `

        <option value="">
            Pilih Provider
        </option>

    `;


    for (
        const provider of sorted
    ) {

        const id =
            providerDatabaseId(
                provider
            );


        if (!id) {

            continue;

        }


        const code =
            providerCode(
                provider
            );


        const selected =

            id ===
                normalizedId ||

            (
                !normalizedId &&
                code ===
                    normalizedCode
            );


        const active =
            isProviderActive(
                provider
            );


        /*
         * Provider tidak boleh dipilih jika
         * inactive pada form Create.
         *
         * Pada Edit, provider yang sudah tersimpan
         * tetap ditampilkan agar record lama
         * dapat dibaca dengan benar.
         */

        const disabled =
            !isEdit &&
            !active;


        html += `

            <option
                value="${escapeHtml(
                    id
                )}"

                data-provider-code="${escapeHtml(
                    code
                )}"

                data-status="${
                    active
                        ? "active"
                        : "inactive"
                }"

                ${
                    selected
                        ? "selected"
                        : ""
                }

                ${
                    disabled
                        ? "disabled"
                        : ""
                }
            >

                ${escapeHtml(
                    providerLabel(
                        provider
                    )
                )}

                ${
                    code
                        ? ` (${escapeHtml(
                            code
                        )})`
                        : ""
                }

            </option>

        `;

    }


    return html;

}


/* =========================================================
   STATUS OPTIONS
   ========================================================= */

function renderStatusOptions(
    selectedStatus = "active"
) {

    const status =
        normalizeStatus(
            selectedStatus
        );


    return STATUS_OPTIONS
        .map(
            option => `

                <option
                    value="${escapeHtml(
                        option.value
                    )}"

                    ${
                        option.value ===
                        status

                            ? "selected"

                            : ""
                    }
                >

                    ${escapeHtml(
                        option.label
                    )}

                </option>

            `
        )
        .join("");

}


/* =========================================================
   MODEL DATA
   ========================================================= */

function getModelsForProvider(
    models,
    providerId
) {

    const id =
        String(
            providerId ?? ""
        ).trim();


    if (!id) {

        return [];

    }


    return (

        Array.isArray(
            models
        )

            ? models

            : []

    )
        .filter(
            model => {

                return (

                    String(
                        model?.provider_id ??
                            ""
                    ).trim() ===
                    id

                );

            }
        )
        .map(
            normalizeModel
        );

}


function getModelIds(
    models,
    providerId = ""
) {

    return unique(

        getModelsForProvider(
            models,
            providerId
        )
            .map(
                model =>
                    model.model_id
            )

    );

}


function getModelByModelId(
    models,
    providerId,
    modelId
) {

    const provider =
        String(
            providerId ?? ""
        ).trim();


    const id =
        String(
            modelId ?? ""
        ).trim();


    if (
        !provider ||
        !id
    ) {

        return null;

    }


    return (

        getModelsForProvider(
            models,
            provider
        ).find(
            model => {

                return (

                    String(
                        model?.model_id ??
                            ""
                    ).trim() ===
                    id

                );

            }
        ) ||

        null

    );

}


/* =========================================================
   MODEL ID OPTIONS
   ========================================================= */

function renderModelIdOptions(
    models,
    selectedProviderId = "",
    selectedModelId = ""
) {

    const ids =
        getModelIds(
            models,
            selectedProviderId
        );


    const selected =
        String(
            selectedModelId ?? ""
        ).trim();


    return ids
        .map(
            modelId => `

                <option
                    value="${escapeHtml(
                        modelId
                    )}"

                    ${
                        modelId ===
                        selected

                            ? "selected"

                            : ""
                    }
                ></option>

            `
        )
        .join("");

}


/* =========================================================
   RATIO DATA
   ========================================================= */

function getRatioValues(
    models,
    providerId,
    modelId,
    fallbackModel = null
) {

    const model =
        getModelByModelId(
            models,
            providerId,
            modelId
        ) ||
        fallbackModel;


    if (!model) {

        return [];

    }


    return unique(
        normalizeArrayValue(
            model.supported_ratios
        )
    );

}


/* =========================================================
   RESOLUTION DATA
   ========================================================= */

function getResolutionValues(
    models,
    providerId,
    modelId,
    fallbackModel = null
) {

    const model =
        getModelByModelId(
            models,
            providerId,
            modelId
        ) ||
        fallbackModel;


    if (!model) {

        return [];

    }


    return unique(
        normalizeArrayValue(
            model.supported_resolutions
        )
    );

}


/* =========================================================
   RATIO CHECKBOXES
   ========================================================= */

function renderRatioCheckboxes(
    availableRatios = [],
    selectedRatios = [],
    disabled = false
) {

    const available =
        unique(
            availableRatios
        );


    const selected =
        unique(
            selectedRatios
        );


    if (
        !available.length
    ) {

        return `

            <div class="model-form-help">

                Tidak ada supported ratio
                pada record model di Supabase.

            </div>

        `;

    }


    return available
        .map(
            ratio => `

                <label
                    class="model-option-checkbox"
                >

                    <input
                        type="checkbox"

                        name="${FIELD_NAMES.supportedRatios}"

                        value="${escapeHtml(
                            ratio
                        )}"

                        ${
                            selected.includes(
                                ratio
                            )
                                ? "checked"
                                : ""
                        }

                        ${
                            disabled
                                ? "disabled"
                                : ""
                        }
                    >

                    <span>
                        ${escapeHtml(
                            ratio
                        )}
                    </span>

                </label>

            `
        )
        .join("");

}


/* =========================================================
   RESOLUTION CHECKBOXES
   ========================================================= */

function renderResolutionCheckboxes(
    availableResolutions = [],
    selectedResolutions = [],
    disabled = false
) {

    const available =
        unique(
            availableResolutions
        );


    const selected =
        unique(
            selectedResolutions
        );


    if (
        !available.length
    ) {

        return `

            <div class="model-form-help">

                Tidak ada supported resolution
                pada record model di Supabase.

            </div>

        `;

    }


    return available
        .map(
            resolution => `

                <label
                    class="model-option-checkbox"
                >

                    <input
                        type="checkbox"

                        name="${FIELD_NAMES.supportedResolutions}"

                        value="${escapeHtml(
                            resolution
                        )}"

                        ${
                            selected.includes(
                                resolution
                            )
                                ? "checked"
                                : ""
                        }

                        ${
                            disabled
                                ? "disabled"
                                : ""
                        }
                    >

                    <span>
                        ${escapeHtml(
                            resolution
                        )}
                    </span>

                </label>

            `
        )
        .join("");

}


/* =========================================================
   FORM STYLES
   ========================================================= */

function injectFormStyles() {

    if (
        typeof document ===
        "undefined"
    ) {

        return;

    }


    if (
        document.getElementById(
            "genz-model-form-layout-style"
        )
    ) {

        return;

    }


    const style =
        document.createElement(
            "style"
        );


    style.id =
        "genz-model-form-layout-style";


    style.textContent = `

        .model-form-section {
            display: grid;
            gap: 18px;
        }

        .model-form-grid {
            display: grid;
            grid-template-columns:
                repeat(
                    2,
                    minmax(0, 1fr)
                );
            gap: 16px;
        }

        .model-form-grid.full {
            grid-template-columns: 1fr;
        }

        .model-form-field {
            display: flex;
            flex-direction: column;
            gap: 7px;
            min-width: 0;
        }

        .model-form-field label {
            font-size: 13px;
            font-weight: 600;
        }

        .model-form-field input,
        .model-form-field select,
        .model-form-field textarea {
            width: 100%;
            min-height: 42px;
            box-sizing: border-box;
            border: 1px solid
                rgba(128,128,128,.28);
            border-radius: 8px;
            padding: 9px 11px;
            background: inherit;
            color: inherit;
            outline: none;
        }

        .model-form-field textarea {
            min-height: 90px;
            resize: vertical;
        }

        .model-form-field input:focus,
        .model-form-field select:focus,
        .model-form-field textarea:focus {
            border-color:
                rgba(99,102,241,.7);
        }

        .model-form-field input[readonly],
        .model-form-field select[disabled] {
            cursor: not-allowed;
            opacity: .72;
        }

        .model-form-help {
            font-size: 11px;
            opacity: .65;
            line-height: 1.45;
        }

        .model-checkbox-group {
            display: grid;
            grid-template-columns:
                repeat(
                    auto-fit,
                    minmax(90px, 1fr)
                );
            gap: 8px;
        }

        .model-option-checkbox {
            display: flex;
            align-items: center;
            gap: 8px;
            min-height: 40px;
            padding: 8px 10px;
            border: 1px solid
                rgba(128,128,128,.22);
            border-radius: 8px;
            cursor: pointer;
            user-select: none;
        }

        .model-option-checkbox input {
            width: auto;
            min-height: auto;
            margin: 0;
        }

        .model-option-checkbox input:disabled {
            cursor: not-allowed;
        }

        .model-option-checkbox span {
            font-size: 13px;
        }

        .model-form-readonly {
            opacity: .78;
        }

        .model-form-readonly input {
            cursor: not-allowed;
        }

        .model-provider-status {
            font-size: 11px;
            opacity: .7;
        }

        .model-credit-preview {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 12px;
            border-radius: 8px;
            background:
                rgba(128,128,128,.08);
            font-size: 13px;
        }

        .model-credit-preview strong {
            font-size: 15px;
        }

        .model-credit-resolution-grid {
            display: grid;
            grid-template-columns:
                repeat(
                    3,
                    minmax(0, 1fr)
                );
            gap: 16px;
        }

        .model-credit-resolution-card {
            display: flex;
            flex-direction: column;
            gap: 7px;
            min-width: 0;
        }

        .model-credit-resolution-card label {
            font-size: 13px;
            font-weight: 600;
        }

        .model-credit-resolution-card input {
            width: 100%;
            min-height: 42px;
            box-sizing: border-box;
            border: 1px solid
                rgba(128,128,128,.28);
            border-radius: 8px;
            padding: 9px 11px;
            background: inherit;
            color: inherit;
            outline: none;
        }

        .model-credit-resolution-card input:focus {
            border-color:
                rgba(99,102,241,.7);
        }

        .model-form-mode-edit {
            opacity: .92;
        }

        .model-form-identity-lock {
            font-size: 11px;
            opacity: .65;
            line-height: 1.45;
            margin-top: 2px;
        }

        @media (max-width: 900px) {

            .model-credit-resolution-grid {
                grid-template-columns:
                    repeat(
                        2,
                        minmax(0, 1fr)
                    );
            }

        }

        @media (max-width: 700px) {

            .model-form-grid {
                grid-template-columns: 1fr;
            }

            .model-credit-resolution-grid {
                grid-template-columns: 1fr;
            }

        }

    `;


    document.head.appendChild(
        style
    );

}


/* =========================================================
   FORM HTML
   ========================================================= */

export function renderModelForm(
    model = null,
    options = {}
) {

    injectFormStyles();


    const data =
        normalizeFormModel(
            model
        );


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


    const isEdit =
        Boolean(
            data.id
        );


    const provider =
        getProviderById(
            providers,
            data.provider_id
        );


    const selectedProviderCode =
        providerCode(
            provider
        );


    /*
     * Saat Edit, data model yang cocok dari
     * Supabase menjadi sumber utama.
     */

    const currentModel =
        getModelByModelId(
            models,
            data.provider_id,
            data.model_id
        ) ||
        data;


    const ratioValues =
        getRatioValues(
            models,
            data.provider_id,
            data.model_id,
            currentModel
        );


    const resolutionValues =
        getResolutionValues(
            models,
            data.provider_id,
            data.model_id,
            currentModel
        );


    const modelIdOptions =
        renderModelIdOptions(
            models,
            data.provider_id,
            data.model_id
        );


    /*
     * Identity fields.
     *
     * Model ID + Provider merupakan identitas
     * model yang terdaftar.
     *
     * Saat Edit keduanya dikunci untuk mencegah
     * record berubah menjadi pasangan provider/model
     * yang tidak ada di Supabase.
     */

    const modelIdReadonly =
        isEdit
            ? "readonly"
            : "";


    const providerDisabled =
        isEdit
            ? "disabled"
            : "";


    const identityLock =
        isEdit
            ? `

                <div
                    class="model-form-identity-lock"
                >
                    Provider dan Model ID merupakan
                    identitas record dan tidak dapat
                    diubah saat Edit.
                </div>

              `
            : "";


    const modelIdPlaceholder =
        isEdit

            ? "Model ID tidak dapat diubah"

            : (

                modelIdOptions

                    ? "Pilih atau ketik Model ID"

                    : "Ketik Model ID pertama"

            );


    const creditFinal =
        calculateCreditFinal(
            data.credit_cost,
            data.discount_percent
        );


    return `

        <div
            class="model-form-section ${
                isEdit
                    ? "model-form-mode-edit"
                    : ""
            }"

            data-model-form="true"

            data-mode="${
                isEdit
                    ? "edit"
                    : "create"
            }"
        >


            ${
                isEdit

                    ? `

                        <input
                            type="hidden"

                            name="${FIELD_NAMES.id}"

                            value="${escapeHtml(
                                data.id
                            )}"
                        >

                      `

                    : ""
            }


            <!-- =========================================
                 PROVIDER / MODEL ID
            ========================================== -->

            <div
                class="model-form-grid"
            >


                <!-- PROVIDER -->

                <div
                    class="model-form-field"
                >

                    <label
                        for="model-provider"
                    >
                        Provider *
                    </label>


                    <select
                        id="model-provider"

                        name="${FIELD_NAMES.provider}"

                        data-model-field="provider_id"

                        required

                        ${
                            isEdit
                                ? "aria-readonly=\"true\""
                                : ""
                        }

                        ${providerDisabled}
                    >

                        ${renderProviderOptions(
                            providers,
                            data.provider_id,
                            selectedProviderCode,
                            isEdit
                        )}

                    </select>


                    <div
                        class="model-provider-status"
                        data-provider-status
                    ></div>


                    ${identityLock}

                </div>


                <!-- MODEL ID -->

                <div
                    class="model-form-field"
                >

                    <label
                        for="model-id"
                    >
                        Model ID *
                    </label>


                    <input
                        id="model-id"

                        name="${FIELD_NAMES.modelId}"

                        data-model-field="model_id"

                        list="model-id-list"

                        value="${escapeHtml(
                            data.model_id
                        )}"

                        placeholder="${escapeHtml(
                            modelIdPlaceholder
                        )}"

                        autocomplete="off"

                        required

                        ${modelIdReadonly}
                    >


                    <datalist
                        id="model-id-list"
                    >

                        ${modelIdOptions}

                    </datalist>


                    <div
                        class="model-form-help"
                    >

                        ${
                            isEdit

                                ? "Model ID berasal dari data Supabase dan tidak dapat diubah."

                                : (

                                    modelIdOptions

                                        ? "Model ID yang tersedia berasal dari tabel models Supabase."

                                        : "Belum ada Model ID pada tabel models. Untuk record pertama, Model ID dapat dimasukkan manual."

                                )

                        }

                    </div>

                </div>


            </div>


            <!-- =========================================
                 MODEL NAME / STATUS
            ========================================== -->

            <div
                class="model-form-grid"
            >


                <!-- MODEL NAME -->

                <div
                    class="model-form-field"
                >

                    <label
                        for="model-name"
                    >
                        Model Name *
                    </label>


                    <input
                        id="model-name"

                        name="${FIELD_NAMES.modelName}"

                        data-model-field="model_name"

                        value="${escapeHtml(
                            data.model_name
                        )}"

                        placeholder="Nama model"

                        required
                    >

                </div>


                <!-- STATUS -->

                <div
                    class="model-form-field"
                >

                    <label
                        for="model-status"
                    >
                        Status *
                    </label>


                    <select
                        id="model-status"

                        name="${FIELD_NAMES.status}"

                        data-model-field="status"

                        required
                    >

                        ${renderStatusOptions(
                            data.status
                        )}

                    </select>

                </div>


            </div>


            <!-- =========================================
                 DESCRIPTION
            ========================================== -->

            <div
                class="model-form-grid full"
            >

                <div
                    class="model-form-field"
                >

                    <label
                        for="model-description"
                    >
                        Description
                    </label>


                    <textarea
                        id="model-description"

                        name="${FIELD_NAMES.description}"

                        data-model-field="description"

                        placeholder="Deskripsi model"
                    >${escapeHtml(
                        data.description
                    )}</textarea>

                </div>

            </div>


            <!-- =========================================
                 CREDIT NORMAL / DISCOUNT
            ========================================== -->

            <div
                class="model-form-grid"
            >


                <!-- CREDIT COST -->

                <div
                    class="model-form-field"
                >

                    <label
                        for="model-credit-cost"
                    >
                        Credit Normal *
                    </label>


                    <input
                        id="model-credit-cost"

                        name="${FIELD_NAMES.creditCost}"

                        data-model-field="credit_cost"

                        type="number"

                        min="0"

                        step="0.0001"

                        value="${escapeHtml(
                            data.credit_cost
                        )}"

                        required
                    >

                </div>


                <!-- DISCOUNT -->

                <div
                    class="model-form-field"
                >

                    <label
                        for="model-discount"
                    >
                        Diskon (%)
                    </label>


                    <input
                        id="model-discount"

                        name="${FIELD_NAMES.discountPercent}"

                        data-model-field="discount_percent"

                        type="number"

                        min="0"

                        max="100"

                        step="0.01"

                        value="${escapeHtml(
                            data.discount_percent
                        )}"
                    >

                </div>


            </div>


            <!-- =========================================
                 CREDIT FINAL
            ========================================== -->

            <div
                class="model-credit-preview"
            >

                <span>
                    Credit Final
                </span>


                <strong
                    data-credit-final-preview
                >
                    ${escapeHtml(
                        creditFinal
                    )}
                </strong>


                <input
                    type="hidden"

                    name="${FIELD_NAMES.creditFinal}"

                    data-model-field="credit_final"

                    value="${escapeHtml(
                        creditFinal
                    )}"
                >

            </div>


            <!-- =========================================
                 CREDIT PER RESOLUTION
            ========================================== -->

            <div
                class="model-form-grid full"
            >

                <div
                    class="model-form-field"
                >

                    <label>
                        Credit per Resolution
                    </label>


                    <div
                        class="model-form-help"
                    >

                        Tentukan credit yang dipotong
                        berdasarkan resolusi yang dipilih
                        pada halaman Generate.

                    </div>

                </div>

            </div>


            <div
                class="model-credit-resolution-grid"
            >


                <!-- CREDIT 480P -->

                <div
                    class="model-credit-resolution-card"
                >

                    <label
                        for="model-credit-480p"
                    >
                        Credit 480p
                    </label>


                    <input
                        id="model-credit-480p"

                        name="${FIELD_NAMES.credit480p}"

                        data-model-field="credit_480p"

                        type="number"

                        min="0"

                        step="0.0001"

                        value="${escapeHtml(
                            data.credit_480p
                        )}"

                        required
                    >


                    <div
                        class="model-form-help"
                    >
                        Credit yang digunakan
                        untuk resolusi 480p.
                    </div>

                </div>


                <!-- CREDIT 720P -->

                <div
                    class="model-credit-resolution-card"
                >

                    <label
                        for="model-credit-720p"
                    >
                        Credit 720p
                    </label>


                    <input
                        id="model-credit-720p"

                        name="${FIELD_NAMES.credit720p}"

                        data-model-field="credit_720p"

                        type="number"

                        min="0"

                        step="0.0001"

                        value="${escapeHtml(
                            data.credit_720p
                        )}"

                        required
                    >


                    <div
                        class="model-form-help"
                    >
                        Credit yang digunakan
                        untuk resolusi 720p.
                    </div>

                </div>


                <!-- CREDIT 1080P -->

                <div
                    class="model-credit-resolution-card"
                >

                    <label
                        for="model-credit-1080p"
                    >
                        Credit 1080p
                    </label>


                    <input
                        id="model-credit-1080p"

                        name="${FIELD_NAMES.credit1080p}"

                        data-model-field="credit_1080p"

                        type="number"

                        min="0"

                        step="0.0001"

                        value="${escapeHtml(
                            data.credit_1080p
                        )}"

                        required
                    >


                    <div
                        class="model-form-help"
                    >
                        Credit yang digunakan
                        untuk resolusi 1080p.
                    </div>

                </div>


            </div>


            <!-- =========================================
                 DURATION
            ========================================== -->

            <div
                class="model-form-grid"
            >


                <!-- MIN DURATION -->

                <div
                    class="model-form-field model-form-readonly"
                >

                    <label
                        for="model-min-duration"
                    >
                        Minimum Duration
                    </label>


                    <input
                        id="model-min-duration"

                        name="${FIELD_NAMES.minDuration}"

                        data-model-field="min_duration"

                        type="number"

                        min="0"

                        step="1"

                        value="${escapeHtml(
                            data.min_duration
                        )}"

                        readonly
                    >


                    <div
                        class="model-form-help"
                    >

                        Mengikuti
                        <strong>
                            min_duration
                        </strong>
                        dari record model di Supabase.

                    </div>

                </div>


                <!-- MAX DURATION -->

                <div
                    class="model-form-field model-form-readonly"
                >

                    <label
                        for="model-max-duration"
                    >
                        Maximum Duration
                    </label>


                    <input
                        id="model-max-duration"

                        name="${FIELD_NAMES.maxDuration}"

                        data-model-field="max_duration"

                        type="number"

                        min="0"

                        step="1"

                        value="${escapeHtml(
                            data.max_duration
                        )}"

                        readonly
                    >


                    <div
                        class="model-form-help"
                    >

                        Mengikuti
                        <strong>
                            max_duration
                        </strong>
                        dari record model di Supabase.

                    </div>

                </div>


            </div>


            <!-- =========================================
                 SUPPORTED RATIOS
            ========================================== -->

            <div
                class="model-form-grid full"
            >

                <div
                    class="model-form-field"
                >

                    <label>
                        Supported Ratios
                    </label>


                    <div
                        class="model-checkbox-group"
                        data-ratio-group
                    >

                        ${renderRatioCheckboxes(
                            ratioValues,
                            data.supported_ratios,
                            false
                        )}

                    </div>


                    <div
                        class="model-form-help"
                    >

                        Opsi checkbox hanya berasal
                        dari
                        <strong>
                            supported_ratios
                        </strong>
                        pada data model di Supabase.

                    </div>

                </div>

            </div>


            <!-- =========================================
                 SUPPORTED RESOLUTIONS
            ========================================== -->

            <div
                class="model-form-grid full"
            >

                <div
                    class="model-form-field"
                >

                    <label>
                        Supported Resolutions
                    </label>


                    <div
                        class="model-checkbox-group"
                        data-resolution-group
                    >

                        ${renderResolutionCheckboxes(
                            resolutionValues,
                            data.supported_resolutions,
                            false
                        )}

                    </div>


                    <div
                        class="model-form-help"
                    >

                        Opsi checkbox hanya berasal
                        dari
                        <strong>
                            supported_resolutions
                        </strong>
                        pada data model di Supabase.

                    </div>

                </div>

            </div>


        </div>

    `;

}


/* =========================================================
   COLLECT FORM DATA
   ========================================================= */

export function collectModelFormData(
    root
) {

    if (!root) {

        throw new Error(
            "MODEL_FORM_ROOT_MISSING"
        );

    }


    const getValue =
        name => {

            const element =
                getElement(
                    root,
                    `[name="${name}"]`
                );


            return element

                ? String(
                    element.value ??
                        ""
                ).trim()

                : "";

        };


    const getNumber =
        name => {

            const value =
                getValue(
                    name
                );


            if (
                value === ""
            ) {

                return null;

            }


            const parsed =
                Number(
                    value
                );


            return Number.isFinite(
                parsed
            )
                ? parsed
                : null;

        };


    const getCheckedValues =
        name => {

            return getElements(
                root,
                `input[name="${name}"]:checked`
            )
                .map(
                    element =>
                        String(
                            element.value ??
                                ""
                        ).trim()
                )
                .filter(
                    Boolean
                );

        };


    const creditCost =
        getNumber(
            FIELD_NAMES.creditCost
        );


    const discountPercent =
        getNumber(
            FIELD_NAMES.discountPercent
        );


    /*
     * Resolution-specific credit.
     */

    const credit480p =
        getNumber(
            FIELD_NAMES.credit480p
        );


    const credit720p =
        getNumber(
            FIELD_NAMES.credit720p
        );


    const credit1080p =
        getNumber(
            FIELD_NAMES.credit1080p
        );


    return {

        id:
            getValue(
                FIELD_NAMES.id
            ) ||
            null,

        provider_id:
            getValue(
                FIELD_NAMES.provider
            ),

        model_id:
            getValue(
                FIELD_NAMES.modelId
            ),

        model_name:
            getValue(
                FIELD_NAMES.modelName
            ),

        description:
            getValue(
                FIELD_NAMES.description
            ),

        credit_cost:
            creditCost,

        discount_percent:
            discountPercent === null
                ? 0
                : discountPercent,

        credit_final:
            calculateCreditFinal(
                creditCost,
                discountPercent
            ),

        credit_480p:
            credit480p,

        credit_720p:
            credit720p,

        credit_1080p:
            credit1080p,

        min_duration:
            getNumber(
                FIELD_NAMES.minDuration
            ),

        max_duration:
            getNumber(
                FIELD_NAMES.maxDuration
            ),

        supported_ratios:
            getCheckedValues(
                FIELD_NAMES.supportedRatios
            ),

        supported_resolutions:
            getCheckedValues(
                FIELD_NAMES.supportedResolutions
            ),

        status:
            normalizeStatus(
                getValue(
                    FIELD_NAMES.status
                )
            )

    };

}


/* =========================================================
   VALIDATION
   ========================================================= */

export function validateModelFormData(
    data,
    options = {}
) {

    const errors = [];


    if (!data) {

        return [
            "Data model tidak ditemukan."
        ];

    }


    if (
        !String(
            data.provider_id ??
                ""
        ).trim()
    ) {

        errors.push(
            "Provider wajib dipilih."
        );

    }


    if (
        !String(
            data.model_id ??
                ""
        ).trim()
    ) {

        errors.push(
            "Model ID wajib diisi."
        );

    }


    if (
        !String(
            data.model_name ??
                ""
        ).trim()
    ) {

        errors.push(
            "Model Name wajib diisi."
        );

    }


    const creditCost =
        Number(
            data.credit_cost
        );


    if (
        !Number.isFinite(
            creditCost
        ) ||
        creditCost < 0
    ) {

        errors.push(
            "Credit Cost harus berupa angka 0 atau lebih."
        );

    }


    const discount =
        Number(
            data.discount_percent
        );


    if (
        !Number.isFinite(
            discount
        ) ||
        discount < 0 ||
        discount > 100
    ) {

        errors.push(
            "Discount Percent harus berada antara 0 sampai 100."
        );

    }


    /* =====================================================
       CREDIT PER RESOLUTION
       ===================================================== */

    const credit480p =
        Number(
            data.credit_480p
        );


    if (
        !Number.isFinite(
            credit480p
        ) ||
        credit480p < 0
    ) {

        errors.push(
            "Credit 480p harus berupa angka 0 atau lebih."
        );

    }


    const credit720p =
        Number(
            data.credit_720p
        );


    if (
        !Number.isFinite(
            credit720p
        ) ||
        credit720p < 0
    ) {

        errors.push(
            "Credit 720p harus berupa angka 0 atau lebih."
        );

    }


    const credit1080p =
        Number(
            data.credit_1080p
        );


    if (
        !Number.isFinite(
            credit1080p
        ) ||
        credit1080p < 0
    ) {

        errors.push(
            "Credit 1080p harus berupa angka 0 atau lebih."
        );

    }


    const minDuration =
        data.min_duration;


    const maxDuration =
        data.max_duration;


    if (
        minDuration !== null &&
        minDuration !== undefined &&
        minDuration !== ""
    ) {

        if (
            !Number.isFinite(
                Number(
                    minDuration
                )
            ) ||
            Number(
                minDuration
            ) < 0
        ) {

            errors.push(
                "Minimum Duration tidak valid."
            );

        }

    }


    if (
        maxDuration !== null &&
        maxDuration !== undefined &&
        maxDuration !== ""
    ) {

        if (
            !Number.isFinite(
                Number(
                    maxDuration
                )
            ) ||
            Number(
                maxDuration
            ) < 0
        ) {

            errors.push(
                "Maximum Duration tidak valid."
            );

        }

    }


    if (
        minDuration !== null &&
        minDuration !== undefined &&
        minDuration !== "" &&

        maxDuration !== null &&
        maxDuration !== undefined &&
        maxDuration !== ""
    ) {

        if (
            Number(
                minDuration
            ) >
            Number(
                maxDuration
            )
        ) {

            errors.push(
                "Minimum Duration tidak boleh lebih besar dari Maximum Duration."
            );

        }

    }


    if (
        !Array.isArray(
            data.supported_ratios
        )
    ) {

        errors.push(
            "Supported Ratios harus berupa array."
        );

    }


    if (
        !Array.isArray(
            data.supported_resolutions
        )
    ) {

        errors.push(
            "Supported Resolutions harus berupa array."
        );

    }


    const providers =
        Array.isArray(
            options.providers
        )
            ? options.providers
            : [];


    if (
        providers.length &&
        data.provider_id
    ) {

        const provider =
            resolveProvider(
                providers,
                data.provider_id
            );


        if (!provider) {

            errors.push(
                "Provider yang dipilih tidak ditemukan."
            );

        } else if (
            !isProviderActive(
                provider
            )
        ) {

            /*
             * Provider inactive tidak boleh
             * dipakai untuk Create.
             *
             * Saat Edit, record lama tetap dapat
             * dibaca, tetapi perubahan tetap
             * mengikuti aturan backend.
             */

            if (
                !data.id
            ) {

                errors.push(
                    "Provider yang dipilih tidak aktif."
                );

            }

        }

    }


    return errors;

}


/* =========================================================
   CREDIT CALCULATION
   ========================================================= */

export function calculateCreditFinal(
    creditCost,
    discountPercent
) {

    const cost =
        Number(
            creditCost
        );


    const discount =
        Number(
            discountPercent
        );


    if (
        !Number.isFinite(
            cost
        ) ||
        !Number.isFinite(
            discount
        )
    ) {

        return 0;

    }


    const safeCost =
        Math.max(
            0,
            cost
        );


    const safeDiscount =
        Math.min(
            100,
            Math.max(
                0,
                discount
            )
        );


    return Number(
        (
            safeCost *
            (
                1 -
                safeDiscount /
                100
            )
        ).toFixed(
            6
        )
    );

}


/* =========================================================
   CREDIT PREVIEW
   ========================================================= */

export function updateCreditFinalPreview(
    root
) {

    if (!root) {

        return;

    }


    const creditCost =
        getElement(
            root,
            `[name="${FIELD_NAMES.creditCost}"]`
        );


    const discount =
        getElement(
            root,
            `[name="${FIELD_NAMES.discountPercent}"]`
        );


    const preview =
        getElement(
            root,
            "[data-credit-final-preview]"
        );


    const finalField =
        getElement(
            root,
            `[name="${FIELD_NAMES.creditFinal}"]`
        );


    if (
        !creditCost ||
        !discount
    ) {

        return;

    }


    const finalCredit =
        calculateCreditFinal(
            creditCost.value,
            discount.value
        );


    if (
        preview
    ) {

        preview.textContent =
            String(
                finalCredit
            );

    }


    if (
        finalField
    ) {

        finalField.value =
            String(
                finalCredit
            );

    }

}


/* =========================================================
   PROVIDER STATUS
   ========================================================= */

export function updateProviderStatus(
    root,
    providers = null
) {

    if (!root) {

        return;

    }


    const providerSelect =
        getElement(
            root,
            `[name="${FIELD_NAMES.provider}"]`
        );


    const statusElement =
        getElement(
            root,
            "[data-provider-status]"
        );


    if (
        !providerSelect ||
        !statusElement
    ) {

        return;

    }


    const providerId =
        String(
            providerSelect.value ??
                ""
        ).trim();


    if (!providerId) {

        statusElement.textContent =
            "Belum ada provider dipilih.";

        return;

    }


    const provider =
        resolveProvider(
            providers || [],
            providerId
        );


    if (!provider) {

        statusElement.textContent =
            "Provider tidak ditemukan.";

        return;

    }


    const active =
        isProviderActive(
            provider
        );


    const code =
        providerCode(
            provider
        );


    statusElement.textContent =
        `Status provider: ${
            active
                ? "active"
                : "inactive"
        }${
            code
                ? ` · ${code}`
                : ""
        }`;

}


/* =========================================================
   APPLY MODEL DATA
   ========================================================= */

export function applyModelDataToForm(
    root,
    model
) {

    if (
        !root ||
        !model
    ) {

        return;

    }


    const normalized =
        normalizeFormModel(
            model
        );


    const setValue =
        (
            name,
            value
        ) => {

            const element =
                getElement(
                    root,
                    `[name="${name}"]`
                );


            if (element) {

                element.value =
                    value === null ||
                    value === undefined

                        ? ""

                        : String(
                            value
                        );

            }

        };


    setValue(
        FIELD_NAMES.modelId,
        normalized.model_id
    );


    setValue(
        FIELD_NAMES.modelName,
        normalized.model_name
    );


    setValue(
        FIELD_NAMES.description,
        normalized.description
    );


    setValue(
        FIELD_NAMES.creditCost,
        normalized.credit_cost
    );


    setValue(
        FIELD_NAMES.discountPercent,
        normalized.discount_percent
    );


    /*
     * credit_final selalu dihitung ulang.
     *
     * credit_final bukan input manual.
     */

    const finalCredit =
        calculateCreditFinal(
            normalized.credit_cost,
            normalized.discount_percent
        );


    setValue(
        FIELD_NAMES.creditFinal,
        finalCredit
    );


    /*
     * Credit berdasarkan resolution.
     */

    setValue(
        FIELD_NAMES.credit480p,
        normalized.credit_480p
    );


    setValue(
        FIELD_NAMES.credit720p,
        normalized.credit_720p
    );


    setValue(
        FIELD_NAMES.credit1080p,
        normalized.credit_1080p
    );


    setValue(
        FIELD_NAMES.minDuration,
        normalized.min_duration
    );


    setValue(
        FIELD_NAMES.maxDuration,
        normalized.max_duration
    );


    setValue(
        FIELD_NAMES.status,
        normalized.status
    );


    const ratios =
        unique(
            normalized.supported_ratios
        );


    getElements(
        root,
        `input[name="${FIELD_NAMES.supportedRatios}"]`
    ).forEach(
        element => {

            element.checked =
                ratios.includes(
                    String(
                        element.value ??
                            ""
                    ).trim()
                );

        }
    );


    const resolutions =
        unique(
            normalized.supported_resolutions
        );


    getElements(
        root,
        `input[name="${FIELD_NAMES.supportedResolutions}"]`
    ).forEach(
        element => {

            element.checked =
                resolutions.includes(
                    String(
                        element.value ??
                            ""
                    ).trim()
                );

        }
    );


    updateCreditFinalPreview(
        root
    );

}


/* =========================================================
   MODEL ID DATASOURCE
   ========================================================= */

export function updateModelIdOptions(
    root,
    models = []
) {

    if (!root) {

        return;

    }


    const providerSelect =
        getElement(
            root,
            `[name="${FIELD_NAMES.provider}"]`
        );


    const modelIdInput =
        getElement(
            root,
            `[name="${FIELD_NAMES.modelId}"]`
        );


    const datalist =
        getElement(
            root,
            "#model-id-list"
        );


    if (
        !providerSelect ||
        !modelIdInput ||
        !datalist
    ) {

        return;

    }


    const providerId =
        String(
            providerSelect.value ??
                ""
        ).trim();


    const modelIds =
        getModelIds(
            models,
            providerId
        );


    datalist.innerHTML =
        modelIds
            .map(
                modelId => `

                    <option
                        value="${escapeHtml(
                            modelId
                        )}"
                    ></option>

                `
            )
            .join("");

}


/* =========================================================
   UPDATE SELECTED MODEL
   ========================================================= */

export function updateSelectedModelFields(
    root,
    models = []
) {

    if (!root) {

        return;

    }


    const providerSelect =
        getElement(
            root,
            `[name="${FIELD_NAMES.provider}"]`
        );


    const modelIdInput =
        getElement(
            root,
            `[name="${FIELD_NAMES.modelId}"]`
        );


    if (
        !providerSelect ||
        !modelIdInput
    ) {

        return;

    }


    const providerId =
        String(
            providerSelect.value ??
                ""
        ).trim();


    const modelId =
        String(
            modelIdInput.value ??
                ""
        ).trim();


    if (
        !providerId ||
        !modelId
    ) {

        return;

    }


    const model =
        getModelByModelId(
            models,
            providerId,
            modelId
        );


    if (!model) {

        return;

    }


    applyModelDataToForm(
        root,
        model
    );

}


/* =========================================================
   PROVIDER CHANGE
   ========================================================= */

export function handleProviderChange(
    root,
    models = [],
    providers = []
) {

    if (!root) {

        return;

    }


    const providerSelect =
        getElement(
            root,
            `[name="${FIELD_NAMES.provider}"]`
        );


    const modelIdInput =
        getElement(
            root,
            `[name="${FIELD_NAMES.modelId}"]`
        );


    if (
        !providerSelect ||
        !modelIdInput
    ) {

        return;

    }


    const formMode =
        root.dataset?.mode ||
        "create";


    /*
     * Pada Edit provider dikunci.
     *
     * Event tidak boleh mengubah identity model.
     */

    if (
        formMode === "edit"
    ) {

        updateProviderStatus(
            root,
            providers
        );

        return;

    }


    const providerId =
        String(
            providerSelect.value ??
                ""
        ).trim();


    updateModelIdOptions(
        root,
        models
    );


    updateProviderStatus(
        root,
        providers
    );


    /*
     * Cari apakah Model ID saat ini memang
     * milik provider yang baru dipilih.
     */

    const currentModel =
        getModelByModelId(
            models,
            providerId,
            modelIdInput.value
        );


    if (
        currentModel
    ) {

        applyModelDataToForm(
            root,
            currentModel
        );

        return;

    }


    /*
     * Provider baru tidak memiliki Model ID
     * yang sedang dipilih.
     *
     * Bersihkan field turunan.
     */

    modelIdInput.value =
        "";


    setDependentField(
        root,
        FIELD_NAMES.modelName,
        ""
    );


    setDependentField(
        root,
        FIELD_NAMES.description,
        ""
    );


    setDependentField(
        root,
        FIELD_NAMES.creditCost,
        0
    );


    setDependentField(
        root,
        FIELD_NAMES.discountPercent,
        0
    );


    setDependentField(
        root,
        FIELD_NAMES.creditFinal,
        0
    );


    setDependentField(
        root,
        FIELD_NAMES.credit480p,
        0
    );


    setDependentField(
        root,
        FIELD_NAMES.credit720p,
        0
    );


    setDependentField(
        root,
        FIELD_NAMES.credit1080p,
        0
    );


    setDependentField(
        root,
        FIELD_NAMES.minDuration,
        ""
    );


    setDependentField(
        root,
        FIELD_NAMES.maxDuration,
        ""
    );


    replaceCheckboxValues(
        root,
        FIELD_NAMES.supportedRatios,
        []
    );


    replaceCheckboxValues(
        root,
        FIELD_NAMES.supportedResolutions,
        []
    );


    updateCreditFinalPreview(
        root
    );

}


/* =========================================================
   DEPENDENT FIELD
   ========================================================= */

function setDependentField(
    root,
    name,
    value
) {

    const element =
        getElement(
            root,
            `[name="${name}"]`
        );


    if (element) {

        element.value =
            value === null ||
            value === undefined

                ? ""

                : String(
                    value
                );

    }

}


function replaceCheckboxValues(
    root,
    name,
    values
) {

    const selected =
        unique(
            values
        );


    getElements(
        root,
        `input[name="${name}"]`
    ).forEach(
        element => {

            element.checked =
                selected.includes(
                    String(
                        element.value ??
                            ""
                    ).trim()
                );

        }
    );

}


/* =========================================================
   ATTACH FORM EVENTS
   ========================================================= */

export function attachModelFormEvents(
    root,
    options = {}
) {

    if (!root) {

        return;

    }


    const models =
        Array.isArray(
            options.models
        )
            ? options.models
            : [];


    const providers =
        Array.isArray(
            options.providers
        )
            ? options.providers
            : [];


    /*
     * Hindari duplicate listener.
     */

    if (
        root.dataset &&
        root.dataset
            .modelFormEventsAttached ===
            "true"
    ) {

        updateModelIdOptions(
            root,
            models
        );


        updateProviderStatus(
            root,
            providers
        );


        updateSelectedModelFields(
            root,
            models
        );


        updateCreditFinalPreview(
            root
        );


        return;

    }


    const providerSelect =
        getElement(
            root,
            `[name="${FIELD_NAMES.provider}"]`
        );


    const modelIdInput =
        getElement(
            root,
            `[name="${FIELD_NAMES.modelId}"]`
        );


    const creditCost =
        getElement(
            root,
            `[name="${FIELD_NAMES.creditCost}"]`
        );


    const discountPercent =
        getElement(
            root,
            `[name="${FIELD_NAMES.discountPercent}"]`
        );


    if (
        providerSelect &&
        !providerSelect.disabled
    ) {

        providerSelect.addEventListener(
            "change",
            () => {

                handleProviderChange(
                    root,
                    models,
                    providers
                );

            }
        );

    }


    /*
     * Model ID hanya aktif pada Create.
     */

    if (
        modelIdInput &&
        !modelIdInput.readOnly
    ) {

        modelIdInput.addEventListener(
            "change",
            () => {

                updateSelectedModelFields(
                    root,
                    models
                );

            }
        );


        modelIdInput.addEventListener(
            "input",
            () => {

                updateSelectedModelFields(
                    root,
                    models
                );

            }
        );

    }


    /*
     * Credit calculation.
     */

    if (creditCost) {

        creditCost.addEventListener(
            "input",
            () => {

                updateCreditFinalPreview(
                    root
                );

            }
        );

    }


    if (discountPercent) {

        discountPercent.addEventListener(
            "input",
            () => {

                updateCreditFinalPreview(
                    root
                );

            }
        );

    }


    if (root.dataset) {

        root.dataset
            .modelFormEventsAttached =
            "true";

    }


    updateModelIdOptions(
        root,
        models
    );


    updateProviderStatus(
        root,
        providers
    );


    updateSelectedModelFields(
        root,
        models
    );


    updateCreditFinalPreview(
        root
    );

}


/* =========================================================
   LOAD FORM DATA
   ========================================================= */

export async function loadModelFormData(
    options = {}
) {

    const [
        models,
        providers
    ] = await Promise.all([

        options.models ||

        loadModels(
            {
                force:
                    Boolean(
                        options.force
                    )
            }
        ),

        options.providers ||

        loadProviders(
            {
                force:
                    Boolean(
                        options.force
                    )
            }
        )

    ]);


    return {

        models:

            Array.isArray(
                models
            )

                ?

                models.map(
                    normalizeModel
                )

                :

                [],


        providers:

            Array.isArray(
                providers
            )

                ?

                providers

                :

                []

    };

}


/* =========================================================
   PREPARE FORM
   ========================================================= */

export async function prepareModelForm(
    model = null,
    options = {}
) {

    const data =
        await loadModelFormData(
            options
        );


    const html =
        renderModelForm(
            model,
            data
        );


    return {

        html,

        model:
            normalizeFormModel(
                model
            ),

        models:
            data.models,

        providers:
            data.providers

    };

}


/* =========================================================
   PROVIDER LOOKUP
   ========================================================= */

export function resolveProvider(
    providers,
    providerValue
) {

    const value =
        String(
            providerValue ?? ""
        ).trim();


    if (!value) {

        return null;

    }


    /*
     * PRIMARY:
     * providers.id
     */

    const byId =
        getProviderById(
            providers,
            value
        );


    if (
        byId
    ) {

        return byId;

    }


    /*
     * COMPATIBILITY:
     * providers.provider_id
     */

    return (
        getProviderByCode(
            providers,
            value
        ) ||

        null

    );

}


/* =========================================================
   NORMALIZE SUBMISSION
   ========================================================= */

export function normalizeModelSubmission(
    formData,
    providers = []
) {

    const data = {
        ...(formData || {})
    };


    const provider =
        resolveProvider(
            providers,
            data.provider_id
        );


    /*
     * models.provider_id HARUS:
     *
     * providers.id
     *
     * Bukan:
     *
     * providers.provider_id
     */

    if (
        provider &&
        provider.id
    ) {

        data.provider_id =
            String(
                provider.id
            ).trim();

    }


    data.model_id =
        String(
            data.model_id ??
                ""
        ).trim();


    data.model_name =
        String(
            data.model_name ??
                ""
        ).trim();


    data.description =
        String(
            data.description ??
                ""
        ).trim();


    data.status =
        normalizeStatus(
            data.status
        );


    data.supported_ratios =
        unique(
            normalizeArrayValue(
                data.supported_ratios
            )
        );


    data.supported_resolutions =
        unique(
            normalizeArrayValue(
                data.supported_resolutions
            )
        );


    if (
        data.credit_cost !==
            null &&
        data.credit_cost !==
            undefined &&
        data.credit_cost !==
            ""
    ) {

        data.credit_cost =
            Number(
                data.credit_cost
            );

    }


    if (
        data.discount_percent !==
            null &&
        data.discount_percent !==
            undefined &&
        data.discount_percent !==
            ""
    ) {

        data.discount_percent =
            Number(
                data.discount_percent
            );

    }


    /*
     * Credit resolution.
     *
     * Jangan membuat nilai baru secara
     * otomatis di sini.
     *
     * Nilai berasal dari form / record model.
     */

    if (
        data.credit_480p !==
            null &&
        data.credit_480p !==
            undefined &&
        data.credit_480p !==
            ""
    ) {

        data.credit_480p =
            Number(
                data.credit_480p
            );

    }


    if (
        data.credit_720p !==
            null &&
        data.credit_720p !==
            undefined &&
        data.credit_720p !==
            ""
    ) {

        data.credit_720p =
            Number(
                data.credit_720p
            );

    }


    if (
        data.credit_1080p !==
            null &&
        data.credit_1080p !==
            undefined &&
        data.credit_1080p !==
            ""
    ) {

        data.credit_1080p =
            Number(
                data.credit_1080p
            );

    }


    if (
        data.min_duration !==
            null &&
        data.min_duration !==
            undefined &&
        data.min_duration !==
            ""
    ) {

        data.min_duration =
            Number(
                data.min_duration
            );

    }


    if (
        data.max_duration !==
            null &&
        data.max_duration !==
            undefined &&
        data.max_duration !==
            ""
    ) {

        data.max_duration =
            Number(
                data.max_duration
            );

    }


    /*
     * credit_final selalu dihitung ulang.
     */

    data.credit_final =
        calculateCreditFinal(
            data.credit_cost,
            data.discount_percent
        );


    return data;

}


/* =========================================================
   DEFAULT EXPORT
   ========================================================= */

export default {

    renderModelForm,

    collectModelFormData,

    validateModelFormData,

    normalizeModelSubmission,

    prepareModelForm,

    loadModelFormData,

    attachModelFormEvents,

    updateModelIdOptions,

    updateSelectedModelFields,

    updateProviderStatus,

    updateCreditFinalPreview,

    applyModelDataToForm,

    calculateCreditFinal,

    renderProviderOptions,

    renderModelIdOptions,

    renderRatioCheckboxes,

    renderResolutionCheckboxes,

    resolveProvider,

    getModelsForProvider,

    getModelIds,

    getModelByModelId,

    getRatioValues,

    getResolutionValues,

    handleProviderChange,

    FIELD_NAMES,

    STATUS_OPTIONS

};
