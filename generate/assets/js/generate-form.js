/* =========================================================
   GEN-Z.AI
   GENERATE FORM MODULE
   ---------------------------------------------------------
   File:
   generate/assets/js/generate-form.js

   Tanggung jawab:
   - Render dynamic parameter form
   - Membaca parameter dari currentModel
   - Membuat input sesuai definisi model
   - Menjaga name/key parameter
   - Mengambil nilai form
   - Reset form
   - Sinkronisasi field yang saling terkait

   Tidak bertanggung jawab:
   - Supabase authentication
   - Model API
   - /api/generate
   - Provider API key
   - Credit deduction
========================================================= */

import {
    getGenerateElements,
    getCurrentModel
} from "./generate-state.js";

import {
    normalizeArray,
    safeString,
    toFiniteNumber,
    toBoolean
} from "./generate-utils.js";


/* =========================================================
   HELPERS
========================================================= */

function getDynamicFieldsElement() {

    const elements =
        getGenerateElements();

    if (!elements) {
        return null;
    }

    return elements.dynamicFields;
}


function getModelParameters(
    model = getCurrentModel()
) {

    if (!model) {
        return [];
    }

    const parameters =
        model.parameters;

    if (
        Array.isArray(parameters)
    ) {
        return parameters;
    }

    /*
     * Beberapa konfigurasi dapat menggunakan
     * object keyed by parameter name.
     */
    if (
        parameters &&
        typeof parameters === "object"
    ) {

        return Object.entries(
            parameters
        ).map(
            ([key, definition]) => {

                if (
                    definition &&
                    typeof definition ===
                        "object"
                ) {

                    return {
                        key,
                        name:
                            definition.name ||
                            key,
                        ...definition
                    };
                }

                return {
                    key,
                    name: key,
                    type:
                        typeof definition
                };
            }
        );
    }

    return [];
}


function getParameterName(
    definition
) {

    if (!definition) {
        return "";
    }

    return String(
        definition.name ||
        definition.key ||
        definition.parameter ||
        ""
    ).trim();
}


function getParameterType(
    definition
) {

    const raw =
        String(
            definition?.type ||
            definition?.input_type ||
            definition?.inputType ||
            "text"
        )
            .trim()
            .toLowerCase();

    const aliases = {
        string: "text",
        text: "text",
        textarea: "textarea",
        multiline: "textarea",
        number: "number",
        integer: "number",
        float: "number",
        decimal: "number",
        boolean: "checkbox",
        bool: "checkbox",
        checkbox: "checkbox",
        select: "select",
        dropdown: "select",
        enum: "select",
        radio: "radio",
        url: "url",
        image: "url",
        image_url: "url",
        video_url: "url"
    };

    return aliases[raw] || "text";
}


function getParameterLabel(
    definition,
    name
) {

    return safeString(
        definition?.label ||
        definition?.title ||
        definition?.display_name ||
        definition?.displayName ||
        name,
        name
    );
}


function getParameterDescription(
    definition
) {

    return safeString(
        definition?.description ||
        definition?.help ||
        definition?.hint ||
        "",
        ""
    );
}


function getParameterPlaceholder(
    definition
) {

    return safeString(
        definition?.placeholder ||
        "",
        ""
    );
}


function isRequired(
    definition
) {

    return (
        definition?.required === true ||
        definition?.is_required === true ||
        definition?.required === "true"
    );
}


/* =========================================================
   OPTIONS
========================================================= */

function getOptions(
    definition
) {

    const source =
        definition?.options ??
        definition?.values ??
        definition?.choices ??
        definition?.enum ??
        [];

    if (
        Array.isArray(source)
    ) {

        return source
            .map(
                option => {

                    if (
                        option &&
                        typeof option ===
                            "object"
                    ) {

                        return {
                            value:
                                String(
                                    option.value ??
                                    option.id ??
                                    option.key ??
                                    ""
                                ),
                            label:
                                safeString(
                                    option.label ??
                                    option.name ??
                                    option.title ??
                                    option.value ??
                                    option.id ??
                                    option.key ??
                                    "",
                                    ""
                                )
                        };
                    }

                    return {
                        value:
                            String(
                                option
                            ),
                        label:
                            String(
                                option
                            )
                    };
                }
            )
            .filter(
                option =>
                    option.value
            );
    }

    /*
     * Support object:
     *
     * {
     *   "16:9": "16:9",
     *   "9:16": "9:16"
     * }
     */
    if (
        source &&
        typeof source === "object"
    ) {

        return Object.entries(
            source
        ).map(
            ([value, label]) => ({
                value:
                    String(value),
                label:
                    safeString(
                        label,
                        value
                    )
            })
        );
    }

    /*
     * Support string values.
     */
    const normalized =
        normalizeArray(
            source
        );

    return normalized.map(
        value => ({
            value:
                String(value),
            label:
                String(value)
        })
    );
}


/* =========================================================
   DEFAULT VALUE
========================================================= */

function getDefaultValue(
    definition
) {

    if (
        Object.prototype.hasOwnProperty.call(
            definition || {},
            "default"
        )
    ) {
        return definition.default;
    }

    if (
        Object.prototype.hasOwnProperty.call(
            definition || {},
            "default_value"
        )
    ) {
        return definition.default_value;
    }

    if (
        Object.prototype.hasOwnProperty.call(
            definition || {},
            "defaultValue"
        )
    ) {
        return definition.defaultValue;
    }

    return "";
}


/* =========================================================
   CREATE ID
========================================================= */

function createFieldId(
    name
) {

    return (
        "generate-field-" +
        String(name)
            .trim()
            .replace(
                /[^a-zA-Z0-9_-]/g,
                "-"
            )
    );
}


/* =========================================================
   CREATE LABEL
========================================================= */

function createLabel(
    labelText,
    fieldId,
    required = false
) {

    const label =
        document.createElement(
            "label"
        );

    label.htmlFor =
        fieldId;

    label.className =
        "generate-field-label";

    label.textContent =
        labelText;

    if (required) {

        const requiredMark =
            document.createElement(
                "span"
            );

        requiredMark.className =
            "required";

        requiredMark.textContent =
            " *";

        label.appendChild(
            requiredMark
        );
    }

    return label;
}


/* =========================================================
   APPLY COMMON ATTRIBUTES
========================================================= */

function applyCommonAttributes(
    element,
    definition,
    name
) {

    element.name =
        name;

    element.id =
        createFieldId(
            name
        );

    if (
        definition?.autocomplete
    ) {

        element.autocomplete =
            String(
                definition.autocomplete
            );
    }

    const placeholder =
        getParameterPlaceholder(
            definition
        );

    if (
        placeholder &&
        "placeholder" in element
    ) {

        element.placeholder =
            placeholder;
    }

    if (
        isRequired(
            definition
        )
    ) {

        element.required =
            true;
    }

    if (
        definition?.disabled === true
    ) {

        element.disabled =
            true;
    }

    if (
        definition?.readonly === true ||
        definition?.readOnly === true
    ) {

        element.readOnly =
            true;
    }

    /*
     * Min / max / step hanya digunakan jika
     * memang diberikan oleh konfigurasi model.
     */
    if (
        definition?.min !== undefined &&
        definition?.min !== null &&
        "min" in element
    ) {

        element.min =
            String(
                definition.min
            );
    }

    if (
        definition?.max !== undefined &&
        definition?.max !== null &&
        "max" in element
    ) {

        element.max =
            String(
                definition.max
            );
    }

    if (
        definition?.step !== undefined &&
        definition?.step !== null &&
        "step" in element
    ) {

        element.step =
            String(
                definition.step
            );
    }
}


/* =========================================================
   CREATE TEXT INPUT
========================================================= */

function createTextInput(
    definition,
    name
) {

    const input =
        document.createElement(
            "input"
        );

    input.type =
        getParameterType(
            definition
        );

    applyCommonAttributes(
        input,
        definition,
        name
    );

    const defaultValue =
        getDefaultValue(
            definition
        );

    if (
        defaultValue !== null &&
        defaultValue !== undefined
    ) {

        input.value =
            String(
                defaultValue
            );
    }

    return input;
}


/* =========================================================
   CREATE TEXTAREA
========================================================= */

function createTextarea(
    definition,
    name
) {

    const textarea =
        document.createElement(
            "textarea"
        );

    applyCommonAttributes(
        textarea,
        definition,
        name
    );

    const rows =
        Number(
            definition?.rows
        );

    if (
        Number.isFinite(rows) &&
        rows > 0
    ) {

        textarea.rows =
            rows;
    } else {

        textarea.rows =
            5;
    }

    const defaultValue =
        getDefaultValue(
            definition
        );

    if (
        defaultValue !== null &&
        defaultValue !== undefined
    ) {

        textarea.value =
            String(
                defaultValue
            );
    }

    return textarea;
}


/* =========================================================
   CREATE NUMBER INPUT
========================================================= */

function createNumberInput(
    definition,
    name
) {

    const input =
        document.createElement(
            "input"
        );

    input.type =
        "number";

    applyCommonAttributes(
        input,
        definition,
        name
    );

    const defaultValue =
        getDefaultValue(
            definition
        );

    if (
        defaultValue !== null &&
        defaultValue !== undefined &&
        defaultValue !== ""
    ) {

        input.value =
            String(
                defaultValue
            );
    }

    return input;
}


/* =========================================================
   CREATE CHECKBOX
========================================================= */

function createCheckbox(
    definition,
    name
) {

    const wrapper =
        document.createElement(
            "label"
        );

    wrapper.className =
        "generate-checkbox";

    const input =
        document.createElement(
            "input"
        );

    input.type =
        "checkbox";

    applyCommonAttributes(
        input,
        definition,
        name
    );

    /*
     * Checkbox tidak menggunakan value sebagai
     * nilai boolean utama. checked adalah sumbernya.
     */
    const defaultValue =
        getDefaultValue(
            definition
        );

    input.checked =
        toBoolean(
            defaultValue,
            false
        );

    const text =
        document.createElement(
            "span"
        );

    text.textContent =
        getParameterLabel(
            definition,
            name
        );

    wrapper.appendChild(
        input
    );

    wrapper.appendChild(
        text
    );

    return wrapper;
}


/* =========================================================
   CREATE SELECT
========================================================= */

function createSelect(
    definition,
    name
) {

    const select =
        document.createElement(
            "select"
        );

    applyCommonAttributes(
        select,
        definition,
        name
    );

    const options =
        getOptions(
            definition
        );

    const defaultValue =
        String(
            getDefaultValue(
                definition
            ) ?? ""
        );

    if (
        options.length === 0
    ) {

        const emptyOption =
            document.createElement(
                "option"
            );

        emptyOption.value =
            "";

        emptyOption.textContent =
            "Tidak ada pilihan";

        emptyOption.disabled =
            true;

        emptyOption.selected =
            true;

        select.appendChild(
            emptyOption
        );

        return select;
    }

    options.forEach(
        optionData => {

            const option =
                document.createElement(
                    "option"
                );

            option.value =
                optionData.value;

            option.textContent =
                optionData.label;

            if (
                optionData.value ===
                defaultValue
            ) {

                option.selected =
                    true;
            }

            select.appendChild(
                option
            );
        }
    );

    return select;
}


/* =========================================================
   CREATE RADIO
========================================================= */

function createRadioGroup(
    definition,
    name
) {

    const wrapper =
        document.createElement(
            "div"
        );

    wrapper.className =
        "generate-radio-group";

    const options =
        getOptions(
            definition
        );

    const defaultValue =
        String(
            getDefaultValue(
                definition
            ) ?? ""
        );

    options.forEach(
        (optionData, index) => {

            const label =
                document.createElement(
                    "label"
                );

            label.className =
                "generate-radio-option";

            const input =
                document.createElement(
                    "input"
                );

            input.type =
                "radio";

            input.name =
                name;

            input.id =
                `${createFieldId(
                    name
                )}-${index}`;

            input.value =
                optionData.value;

            if (
                optionData.value ===
                defaultValue
            ) {

                input.checked =
                    true;
            }

            const text =
                document.createElement(
                    "span"
                );

            text.textContent =
                optionData.label;

            label.appendChild(
                input
            );

            label.appendChild(
                text
            );

            wrapper.appendChild(
                label
            );
        }
    );

    return wrapper;
}


/* =========================================================
   CREATE INPUT
========================================================= */

function createInput(
    definition,
    name
) {

    const type =
        getParameterType(
            definition
        );

    switch (type) {

        case "textarea":
            return createTextarea(
                definition,
                name
            );

        case "number":
            return createNumberInput(
                definition,
                name
            );

        case "checkbox":
            return createCheckbox(
                definition,
                name
            );

        case "select":
            return createSelect(
                definition,
                name
            );

        case "radio":
            return createRadioGroup(
                definition,
                name
            );

        case "url":
            return createTextInput(
                {
                    ...definition,
                    type: "url"
                },
                name
            );

        case "text":
        default:
            return createTextInput(
                definition,
                name
            );
    }
}


/* =========================================================
   CREATE FIELD DESCRIPTION
========================================================= */

function createDescription(
    definition
) {

    const description =
        getParameterDescription(
            definition
        );

    if (!description) {
        return null;
    }

    const element =
        document.createElement(
            "small"
        );

    element.className =
        "generate-field-description";

    element.textContent =
        description;

    return element;
}


/* =========================================================
   CREATE FIELD WRAPPER
========================================================= */

function createField(
    definition
) {

    const name =
        getParameterName(
            definition
        );

    if (!name) {
        return null;
    }

    const field =
        document.createElement(
            "div"
        );

    field.className =
        "generate-field";

    field.dataset.parameter =
        name;

    const type =
        getParameterType(
            definition
        );

    /*
     * Checkbox dan radio sudah mempunyai
     * label internal.
     */
    if (
        type !== "checkbox" &&
        type !== "radio"
    ) {

        const label =
            createLabel(
                getParameterLabel(
                    definition,
                    name
                ),
                createFieldId(
                    name
                ),
                isRequired(
                    definition
                )
            );

        field.appendChild(
            label
        );
    }

    const input =
        createInput(
            definition,
            name
        );

    if (!input) {
        return null;
    }

    field.appendChild(
        input
    );

    const description =
        createDescription(
            definition
        );

    if (description) {

        field.appendChild(
            description
        );
    }

    return field;
}


/* =========================================================
   RENDER DYNAMIC FIELDS
========================================================= */

export function renderDynamicFields(
    model = getCurrentModel()
) {

    const container =
        getDynamicFieldsElement();

    if (!container) {

        throw new Error(
            "Container dynamic fields tidak ditemukan."
        );
    }

    container.innerHTML = "";

    if (!model) {

        return [];
    }

    const parameters =
        getModelParameters(
            model
        );

    if (
        parameters.length === 0
    ) {

        const message =
            document.createElement(
                "div"
            );

        message.className =
            "generate-empty-fields";

        message.textContent =
            "Model ini tidak memiliki parameter tambahan.";

        container.appendChild(
            message
        );

        return [];
    }

    const renderedFields = [];

    parameters.forEach(
        definition => {

            const field =
                createField(
                    definition
                );

            if (!field) {
                return;
            }

            container.appendChild(
                field
            );

            renderedFields.push(
                field
            );
        }
    );

    return renderedFields;
}


/* =========================================================
   FIND FIELD
========================================================= */

export function findField(
    name
) {

    const container =
        getDynamicFieldsElement();

    if (!container) {
        return null;
    }

    const normalizedName =
        String(
            name || ""
        ).trim();

    if (!normalizedName) {
        return null;
    }

    return container.querySelector(
        `[name="${CSS.escape(
            normalizedName
        )}"]`
    );
}


/* =========================================================
   GET FIELD VALUE
========================================================= */

function readFieldValue(
    field
) {

    if (!field) {
        return undefined;
    }

    /*
     * Radio group.
     */
    if (
        field.type ===
        "radio"
    ) {

        if (!field.checked) {
            return undefined;
        }

        return field.value;
    }

    /*
     * Checkbox.
     */
    if (
        field.type ===
        "checkbox"
    ) {

        return Boolean(
            field.checked
        );
    }

    /*
     * Number.
     */
    if (
        field.type ===
        "number"
    ) {

        if (
            field.value === ""
        ) {

            return "";
        }

        const value =
            Number(
                field.value
            );

        return Number.isFinite(
            value
        )
            ? value
            : field.value;
    }

    return field.value;
}


/* =========================================================
   GET FORM PARAMETERS
========================================================= */

export function getFormParameters() {

    const container =
        getDynamicFieldsElement();

    if (!container) {
        return {};
    }

    const parameters =
        {};

    const fields =
        container.querySelectorAll(
            "[name]"
        );

    fields.forEach(
        field => {

            const name =
                String(
                    field.name || ""
                ).trim();

            if (!name) {
                return;
            }

            /*
             * Radio yang tidak checked tidak boleh
             * menimpa nilai radio yang checked.
             */
            if (
                field.type ===
                "radio"
            ) {

                if (!field.checked) {
                    return;
                }
            }

            const value =
                readFieldValue(
                    field
                );

            if (
                value === undefined
            ) {
                return;
            }

            parameters[name] =
                value;
        }
    );

    return parameters;
}


/* =========================================================
   GET ALL FORM DATA
========================================================= */

export function getFormData() {

    const elements =
        getGenerateElements();

    if (!elements) {
        return {};
    }

    const form =
        elements.generateForm;

    if (!form) {
        return {};
    }

    const data =
        getFormParameters();

    /*
     * FormData digunakan hanya sebagai fallback
     * untuk elemen statis yang mungkin ada di
     * HTML lama.
     *
     * Dynamic fields tetap menjadi sumber utama.
     */
    const formData =
        new FormData(
            form
        );

    for (
        const [
            key,
            value
        ] of formData.entries()
    ) {

        if (
            Object.prototype.hasOwnProperty.call(
                data,
                key
            )
        ) {
            continue;
        }

        /*
         * Jangan memasukkan File object ke
         * request JSON secara otomatis.
         */
        if (
            value instanceof File
        ) {
            continue;
        }

        data[key] =
            value;
    }

    return data;
}


/* =========================================================
   SET FIELD VALUE
========================================================= */

export function setFieldValue(
    name,
    value
) {

    const container =
        getDynamicFieldsElement();

    if (!container) {
        return false;
    }

    const normalizedName =
        String(
            name || ""
        ).trim();

    if (!normalizedName) {
        return false;
    }

    const fields =
        container.querySelectorAll(
            `[name="${CSS.escape(
                normalizedName
            )}"]`
        );

    if (
        fields.length === 0
    ) {

        return false;
    }

    fields.forEach(
        field => {

            if (
                field.type ===
                "checkbox"
            ) {

                field.checked =
                    toBoolean(
                        value,
                        false
                    );

                return;
            }

            if (
                field.type ===
                "radio"
            ) {

                field.checked =
                    String(
                        field.value
                    ) ===
                    String(
                        value
                    );

                return;
            }

            field.value =
                value === null ||
                value === undefined
                    ? ""
                    : String(
                        value
                    );
        }
    );

    return true;
}


/* =========================================================
   RESET DYNAMIC FIELDS
========================================================= */

export function resetDynamicFields() {

    const container =
        getDynamicFieldsElement();

    if (!container) {
        return;
    }

    const model =
        getCurrentModel();

    /*
     * Render ulang dari konfigurasi model.
     * Ini lebih aman daripada mengandalkan
     * HTML lama yang mungkin sudah berubah.
     */
    renderDynamicFields(
        model
    );
}


/* =========================================================
   DISABLE FORM
========================================================= */

export function setFormDisabled(
    disabled
) {

    const container =
        getDynamicFieldsElement();

    if (!container) {
        return;
    }

    const fields =
        container.querySelectorAll(
            "input, textarea, select, button"
        );

    fields.forEach(
        field => {

            /*
             * Jangan mengubah readonly menjadi
             * editable.
             */
            if (
                disabled
            ) {

                field.disabled =
                    true;

                return;
            }

            /*
             * Saat enable kembali, hormati
             * konfigurasi disabled/readOnly.
             */
            const name =
                field.name;

            const definition =
                getModelParameters()
                    .find(
                        item =>
                            getParameterName(
                                item
                            ) === name
                    );

            field.disabled =
                definition?.disabled ===
                true;
        }
    );
}


/* =========================================================
   COLLECT FILE / URL INPUTS
========================================================= */

export function getMediaParameters(
    parameters = getFormParameters()
) {

    const result =
        {};

    /*
     * Pertahankan nama parameter asli.
     * Tidak mengubah payload menjadi format baru.
     */
    Object.entries(
        parameters
    ).forEach(
        ([key, value]) => {

            if (
                key ===
                "image_urls" ||
                key ===
                "image_url" ||
                key ===
                "video_url" ||
                key ===
                "audio_url"
            ) {

                result[key] =
                    value;
            }
        }
    );

    return result;
}


/* =========================================================
   PARAMETER DEFINITION
========================================================= */

export function parameterDefinition(
    name
) {

    const normalizedName =
        String(
            name || ""
        ).trim();

    if (!normalizedName) {
        return null;
    }

    return (
        getModelParameters()
            .find(
                definition =>
                    getParameterName(
                        definition
                    ) ===
                    normalizedName
            ) ||
        null
    );
}


/* =========================================================
   EXPORT FORM API
========================================================= */

export const generateForm =
    Object.freeze({

        renderDynamicFields,

        findField,

        getFormParameters,

        getFormData,

        setFieldValue,

        resetDynamicFields,

        setFormDisabled,

        getMediaParameters,

        parameterDefinition

    });


export default generateForm;
