/* =========================================================
   GEN-Z.AI
   MODEL FORM LAYOUT MODULE
   ---------------------------------------------------------
   File:
   admin-control/models/functions/model-form-layout.js

   Tanggung jawab:
   - Render form Tambah Model
   - Render form Edit Model
   - Provider dari tabel providers
   - Model ID dari data models Supabase
   - Model Name dari data models Supabase
   - Ratio dari data models Supabase
   - Resolution dari data models Supabase
   - Duration dari data models Supabase
   - Credit calculation
   - Normalisasi data form

   Tidak bertanggung jawab:
   - Query Supabase langsung
   - Create / Update / Delete database
   - Table events
   - Database submit
   - Data KIE lama
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
    id: "id",
    provider: "provider_id",
    modelId: "model_id",
    modelName: "model_name",
    description: "description",
    creditCost: "credit_cost",
    discountPercent: "discount_percent",
    creditFinal: "credit_final",
    minDuration: "min_duration",
    maxDuration: "max_duration",
    supportedRatios: "supported_ratios",
    supportedResolutions: "supported_resolutions",
    status: "status"
};


const STATUS_OPTIONS = [
    {
        value: "active",
        label: "Active"
    },
    {
        value: "inactive",
        label: "Inactive"
    },
    {
        value: "maintenance",
        label: "Maintenance"
    }
];


/* =========================================================
   SAFE HELPERS
   ========================================================= */

function escapeHtml(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function toNumber(
    value,
    fallback = 0
) {

    const number =
        Number(value);

    return Number.isFinite(number)
        ? number
        : fallback;
}


function unique(values) {

    return [
        ...new Set(
            (
                Array.isArray(values)
                    ? values
                    : []
            )
                .map(
                    value =>
                        String(
                            value ?? ""
                        ).trim()
                )
                .filter(Boolean)
        )
    ];
}


function normalizeStatus(value) {

    const status =
        String(
            value ?? ""
        )
            .trim()
            .toLowerCase();

    return STATUS_OPTIONS.some(
        option =>
            option.value === status
    )
        ? status
        : "inactive";
}


function getElement(
    root,
    selector
) {

    if (!root) {
        return null;
    }

    if (
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
            id: "",
            provider_id: "",
            model_id: "",
            model_name: "",
            description: "",
            credit_cost: 0,
            discount_percent: 0,
            credit_final: 0,
            min_duration: "",
            max_duration: "",
            supported_ratios: [],
            supported_resolutions: [],
            status: "active"
        };

    }


    const normalized =
        normalizeModel(model);


    return {

        id:
            normalized.id || "",

        provider_id:
            normalized.provider_id || "",

        model_id:
            normalized.model_id || "",

        model_name:
            normalized.model_name || "",

        description:
            normalized.description || "",

        credit_cost:
            toNumber(
                normalized.credit_cost,
                0
            ),

        discount_percent:
            toNumber(
                normalized.discount_percent,
                0
            ),

        credit_final:
            toNumber(
                normalized.credit_final,
                0
            ),

        min_duration:
            normalized.min_duration !==
                null &&
            normalized.min_duration !==
                undefined
                ? normalized.min_duration
                : "",

        max_duration:
            normalized.max_duration !==
                null &&
            normalized.max_duration !==
                undefined
                ? normalized.max_duration
                : "",

        supported_ratios:
            unique(
                normalizeArrayValue(
                    normalized.supported_ratios
                )
            ),

        supported_resolutions:
            unique(
                normalizeArrayValue(
                    normalized.supported_resolutions
                )
            ),

        status:
            normalizeStatus(
                normalized.status
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
        provider.id || ""
    ).trim();

}


function isProviderActive(
    provider
) {

    if (!provider) {
        return false;
    }


    const status =
        String(
            provider.status ?? ""
        )
            .trim()
            .toLowerCase();


    if (
        [
            "active",
            "aktif",
            "enabled"
        ].includes(status)
    ) {
        return true;
    }


    if (
        provider.is_active === true ||
        provider.active === true ||
        provider.enabled === true
    ) {
        return true;
    }


    return false;

}


function sortProviders(
    providers
) {

    return [
        ...(providers || [])
    ].sort(
        (a, b) => {

            const activeA =
                isProviderActive(a)
                    ? 0
                    : 1;

            const activeB =
                isProviderActive(b)
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


            return providerLabel(a)
                .localeCompare(
                    providerLabel(b),
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
    selectedProviderCode = ""
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


        html += `
            <option
                value="${escapeHtml(id)}"
                data-provider-code="${escapeHtml(code)}"
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
            >
                ${escapeHtml(
                    providerLabel(
                        provider
                    )
                )}
                ${
                    code
                        ? ` (${escapeHtml(code)})`
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
        Array.isArray(models)
            ? models
            : []
    )
        .filter(
            model =>
                String(
                    model?.provider_id ??
                        ""
                ).trim() === id
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
            model =>
                String(
                    model?.model_id ??
                        ""
                ).trim() === id
        ) || null
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
                >
                    ${escapeHtml(
                        modelId
                    )}
                </option>
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
    selectedRatios = []
) {

    const available =
        unique(
            availableRatios
        );


    const selected =
        unique(
            selectedRatios
        );


    if (!available.length) {

        return `
            <div class="model-form-help">
                Tidak ada data ratio pada
                model ini di Supabase.
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
    selectedResolutions = []
) {

    const available =
        unique(
            availableResolutions
        );


    const selected =
        unique(
            selectedResolutions
        );


    if (!available.length) {

        return `
            <div class="model-form-help">
                Tidak ada data resolution
                pada model ini di Supabase.
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

        .model-form-field input[readonly] {
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

        .model-form-mode-edit {
            opacity: .85;
        }

        @media (max-width: 700px) {

            .model-form-grid {
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
     * Record model dari Supabase menjadi
     * sumber utama saat Edit.
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
     * Model ID:
     *
     * CREATE:
     *   boleh diketik untuk membuat
     *   record pertama.
     *
     * EDIT:
     *   readonly.
     *
     * Model ID adalah identifier model,
     * bukan field yang boleh berubah
     * sembarangan saat edit.
     */

    const modelIdReadonly =
        isEdit
            ? "readonly"
            : "";


    const modelIdPlaceholder =
        isEdit
            ? "Model ID tidak dapat diubah"
            : (
                modelIdOptions
                    ? "Pilih atau ketik Model ID"
                    : "Ketik Model ID pertama"
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


            <!-- PROVIDER -->

            <div
                class="model-form-grid"
            >

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
                                ? "data-edit-provider=\"true\""
                                : ""
                        }
                    >

                        ${renderProviderOptions(
                            providers,
                            data.provider_id,
                            selectedProviderCode
                        )}

                    </select>


                    <div
                        class="model-provider-status"
                        data-provider-status
                    ></div>

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
                                        ? "Model ID yang sudah tersedia berasal dari data models Supabase."
                                        : "Belum ada Model ID di tabel models. Model ID pertama dapat dimasukkan secara manual."
                                )
                        }
                    </div>

                </div>

            </div>


            <!-- MODEL NAME / STATUS -->

            <div
                class="model-form-grid"
            >

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


            <!-- DESCRIPTION -->

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


            <!-- CREDIT -->

            <div
                class="model-form-grid"
            >

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


            <!-- CREDIT FINAL -->

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
                        calculateCreditFinal(
                            data.credit_cost,
                            data.discount_percent
                        )
                    )}
                </strong>

            </div>


            <!-- DURATION -->

            <div
                class="model-form-grid"
            >

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
                        Mengikuti data model
                        dari Supabase.
                    </div>

                </div>


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
                        Mengikuti data model
                        dari Supabase.
                    </div>

                </div>

            </div>


            <!-- RATIO -->

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
                            data.supported_ratios
                        )}

                    </div>


                    <div
                        class="model-form-help"
                    >
                        Opsi hanya berasal dari
                        supported_ratios pada
                        record model di Supabase.
                    </div>

                </div>

            </div>


            <!-- RESOLUTION -->

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
                            data.supported_resolutions
                        )}

                    </div>


                    <div
                        class="model-form-help"
                    >
                        Opsi hanya berasal dari
                        supported_resolutions pada
                        record model di Supabase.
                        Pilihan dapat disesuaikan
                        menggunakan checkbox.
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
                getValue(name);


            if (
                value === ""
            ) {
                return null;
            }


            const number =
                Number(value);


            return Number.isFinite(
                number
            )
                ? number
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
                .filter(Boolean);

        };


    const creditCost =
        getNumber(
            FIELD_NAMES.creditCost
        );


    const discountPercent =
        getNumber(
            FIELD_NAMES.discountPercent
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
            getProviderById(
                providers,
                data.provider_id
            );


        if (!provider) {

            errors.push(
                "Provider yang dipilih tidak ditemukan."
            );

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
        !Number.isFinite(cost) ||
        !Number.isFinite(discount)
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
            safeCost -
            (
                safeCost *
                safeDiscount /
                100
            )
        ).toFixed(4)
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


    if (
        !creditCost ||
        !discount ||
        !preview
    ) {

        return;

    }


    preview.textContent =
        String(
            calculateCreditFinal(
                creditCost.value,
                discount.value
            )
        );

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
        getProviderById(
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


    statusElement.textContent =
        `Status provider: ${
            active
                ? "active"
                : "inactive"
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


    /*
     * Model ID hanya diisi dari record
     * Supabase.
     *
     * Saat Edit field readonly.
     */

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


    setValue(
        FIELD_NAMES.creditFinal,
        normalized.credit_final
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


    const providerId =
        String(
            providerSelect.value ??
                ""
        ).trim();


    /*
     * Saat provider berubah, cari apakah
     * Model ID saat ini memang dimiliki
     * provider baru.
     */

    const currentModel =
        getModelByModelId(
            models,
            providerId,
            modelIdInput.value
        );


    updateModelIdOptions(
        root,
        models
    );


    updateProviderStatus(
        root,
        providers
    );


    if (currentModel) {

        applyModelDataToForm(
            root,
            currentModel
        );

        return;

    }


    /*
     * Model ID yang lama bukan milik
     * provider baru.
     *
     * Bersihkan semua field turunan
     * agar data provider lama tidak
     * terbawa.
     */

    /*
     * Pada Edit, Provider seharusnya
     * tidak boleh menyebabkan Model ID
     * berubah diam-diam.
     *
     * Namun event ini tetap menangani
     * mode Create secara aman.
     */

    const formMode =
        root.dataset?.mode ||
        "create";


    if (
        formMode === "edit"
    ) {
        return;
    }


    modelIdInput.value = "";


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
                : String(value);

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
     * Hindari pemasangan event dua kali.
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


    if (providerSelect) {

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
     * Jangan attach input/change handler
     * yang mencoba mengubah Model ID
     * ketika field readonly.
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

                /*
                 * Hanya populate field apabila
                 * Model ID cocok persis dengan
                 * record Supabase.
                 *
                 * Tidak menghapus input manual.
                 */

                updateSelectedModelFields(
                    root,
                    models
                );

            }
        );

    }


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
            loadModels({
                force:
                    Boolean(
                        options.force
                    )
            }),

        options.providers ||
            loadProviders({
                force:
                    Boolean(
                        options.force
                    )
            })

    ]);


    return {

        models:
            Array.isArray(models)
                ? models.map(
                      normalizeModel
                  )
                : [],

        providers:
            Array.isArray(
                providers
            )
                ? providers
                : []

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


    return (
        getProviderById(
            providers,
            value
        ) ||
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
     * FK models.provider_id
     * selalu menunjuk ke providers.id.
     *
     * Bukan providers.provider_id.
     */

    if (
        provider &&
        provider.id
    ) {

        data.provider_id =
            String(
                provider.id
            );

    }


    data.model_id =
        String(
            data.model_id ?? ""
        ).trim();


    data.model_name =
        String(
            data.model_name ?? ""
        ).trim();


    data.description =
        String(
            data.description ?? ""
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
        data.credit_cost !== ""
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
        data.discount_percent !== ""
    ) {

        data.discount_percent =
            Number(
                data.discount_percent
            );

    }


    if (
        data.min_duration !==
            null &&
        data.min_duration !==
            undefined &&
        data.min_duration !== ""
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
        data.max_duration !== ""
    ) {

        data.max_duration =
            Number(
                data.max_duration
            );

    }


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
