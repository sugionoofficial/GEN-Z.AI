/* =========================================================
   GEN-Z.AI
   GENERATE FORM MODULE
   ---------------------------------------------------------
   File:
   generate/assets/js/generate-form.js

   Tanggung jawab:
   - Render dynamic parameter form
   - Membaca parameter dari currentModel
   - Membaca parameter dari adapter model
   - Menjaga nama/key parameter
   - Mengambil nilai form
   - Reset form
   - Sinkronisasi field

   SUMBER PARAMETER:
   - model.parameters
   - model.config.parameters
   - model.parameter_schema
   - model.config.parameter_schema

   Tidak ada parameter model yang di-hardcode.
========================================================= */

import {
    getGenerateElements,
    getCurrentModel
} from "./generate-state.js";


/* =========================================================
   LOCAL HELPERS
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
        String(value).trim();

    return result || fallback;
}


function normalizeArray(
    value
) {

    if (Array.isArray(value)) {

        return value
            .filter(
                item =>
                    item !== null &&
                    item !== undefined
            )
            .map(
                item =>
                    typeof item === "string"
                        ? item.trim()
                        : item
            )
            .filter(
                item =>
                    item !== ""
            );
    }


    if (
        value === null ||
        value === undefined
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
         * JSON array.
         */
        if (
            text.startsWith("[") &&
            text.endsWith("]")
        ) {

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
                /* fallback */
            }
        }


        /*
         * PostgreSQL array.
         *
         * {"2:3","9:16"}
         */
        if (
            text.startsWith("{") &&
            text.endsWith("}")
        ) {

            const content =
                text
                    .slice(1, -1)
                    .trim();

            if (!content) {
                return [];
            }

            return content
                .split(",")
                .map(
                    item =>
                        item
                            .trim()
                            .replace(
                                /^"(.*)"$/,
                                "$1"
                            )
                )
                .filter(Boolean);
        }


        /*
         * CSV.
         */
        return text
            .split(",")
            .map(
                item =>
                    item.trim()
            )
            .filter(Boolean);
    }


    /*
     * Object values.
     */
    if (
        typeof value === "object"
    ) {

        return Object.values(
            value
        )
            .filter(
                item =>
                    item !== null &&
                    item !== undefined
            );
    }


    return [value];
}


function toBoolean(
    value,
    fallback = false
) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return fallback;
    }


    if (
        typeof value === "boolean"
    ) {

        return value;
    }


    if (
        typeof value === "number"
    ) {

        return value !== 0;
    }


    const normalized =
        String(value)
            .trim()
            .toLowerCase();


    if (
        [
            "true",
            "1",
            "yes",
            "y",
            "on",
            "enabled",
            "active"
        ].includes(
            normalized
        )
    ) {

        return true;
    }


    if (
        [
            "false",
            "0",
            "no",
            "n",
            "off",
            "disabled",
            "inactive"
        ].includes(
            normalized
        )
    ) {

        return false;
    }


    return fallback;
}


/* =========================================================
   ELEMENT
========================================================= */

function getDynamicFieldsElement() {

    const elements =
        getGenerateElements();

    if (!elements) {
        return null;
    }

    return elements.dynamicFields;
}


/* =========================================================
   PARAMETER SOURCE RESOLUTION
   ---------------------------------------------------------
   Adapter dari model folder menggunakan:

   const parameters = {
       prompt: {...},
       mode: {...},
       ...
   };

   API model-config mengirim object tersebut
   sebagai:

       model.parameters

   Tetapi module ini juga mendukung beberapa
   bentuk kompatibilitas lain.
========================================================= */

function resolveParameterSource(
    model
) {

    if (!model) {
        return null;
    }


    /*
     * PRIORITAS 1
     *
     * API utama.
     */
    if (
        model.parameters &&
        typeof model.parameters === "object"
    ) {

        return model.parameters;
    }


    /*
     * PRIORITAS 2
     *
     * Beberapa adapter/config wrapper.
     */
    if (
        model.config?.parameters &&
        typeof model.config.parameters === "object"
    ) {

        return model.config.parameters;
    }


    /*
     * PRIORITAS 3
     */
    if (
        model.parameter_schema &&
        typeof model.parameter_schema === "object"
    ) {

        return model.parameter_schema;
    }


    /*
     * PRIORITAS 4
     */
    if (
        model.parameterSchema &&
        typeof model.parameterSchema === "object"
    ) {

        return model.parameterSchema;
    }


    /*
     * PRIORITAS 5
     */
    if (
        model.config?.parameter_schema &&
        typeof model.config.parameter_schema === "object"
    ) {

        return model.config.parameter_schema;
    }


    /*
     * PRIORITAS 6
     */
    if (
        model.config?.parameterSchema &&
        typeof model.config.parameterSchema === "object"
    ) {

        return model.config.parameterSchema;
    }


    return null;
}


/* =========================================================
   NORMALIZE PARAMETER DEFINITIONS
   ---------------------------------------------------------
   Mendukung:

   1. Array
   [
       {
           name: "prompt",
           type: "string"
       }
   ]

   2. Object keyed
   {
       prompt: {
           type: "string"
       }
   }

   3. Single wrapper
   {
       parameters: {...}
   }
========================================================= */

function normalizeParameterDefinitions(
    source
) {

    if (!source) {
        return [];
    }


    /*
     * Array.
     */
    if (
        Array.isArray(source)
    ) {

        return source
            .map(
                definition =>
                    normalizeParameterDefinition(
                        definition
                    )
            )
            .filter(Boolean);
    }


    /*
     * Object wrapper.
     */
    if (
        source.parameters &&
        typeof source.parameters === "object"
    ) {

        return normalizeParameterDefinitions(
            source.parameters
        );
    }


    /*
     * Object keyed by parameter name.
     */
    if (
        typeof source === "object"
    ) {

        return Object.entries(
            source
        )
            .map(
                ([key, definition]) =>
                    normalizeParameterDefinition(
                        definition,
                        key
                    )
            )
            .filter(Boolean);
    }


    return [];
}


/* =========================================================
   NORMALIZE SINGLE DEFINITION
========================================================= */

function normalizeParameterDefinition(
    definition,
    fallbackName = ""
) {

    /*
     * Primitive definition.
     *
     * Contoh:
     *
     * prompt: "string"
     */
    if (
        definition === null ||
        definition === undefined
    ) {

        if (!fallbackName) {
            return null;
        }

        return {
            name: fallbackName,
            key: fallbackName,
            type: "text"
        };
    }


    if (
        typeof definition !== "object"
    ) {

        return {
            name:
                fallbackName,

            key:
                fallbackName,

            type:
                typeof definition
        };
    }


    const name =
        safeString(
            definition.name ||
            definition.key ||
            definition.parameter ||
            definition.id ||
            fallbackName
        );


    if (!name) {
        return null;
    }


    /*
     * Copy seluruh definisi asli.
     *
     * Ini penting supaya:
     *
     * min
     * max
     * enum
     * default
     * required
     * maxLength
     * maxItems
     * dll.
     *
     * tetap tersedia untuk frontend.
     */
    return {
        ...definition,

        name,

        key:
            definition.key ||
            name
    };
}


/* =========================================================
   GET MODEL PARAMETERS
========================================================= */

function getModelParameters(
    model = getCurrentModel()
) {

    const source =
        resolveParameterSource(
            model
        );

    if (!source) {
        return [];
    }


    return normalizeParameterDefinitions(
        source
    );
}


/* =========================================================
   PARAMETER NAME
========================================================= */

function getParameterName(
    definition
) {

    if (!definition) {
        return "";
    }


    return safeString(
        definition.name ||
        definition.key ||
        definition.parameter ||
        definition.id ||
        ""
    );
}


/* =========================================================
   PARAMETER TYPE
========================================================= */

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

        string:
            "text",

        text:
            "text",

        textarea:
            "textarea",

        multiline:
            "textarea",

        number:
            "number",

        integer:
            "number",

        float:
            "number",

        decimal:
            "number",

        boolean:
            "checkbox",

        bool:
            "checkbox",

        checkbox:
            "checkbox",

        select:
            "select",

        dropdown:
            "select",

        enum:
            "select",

        radio:
            "radio",

        url:
            "url",

        image:
            "url",

        image_url:
            "url",

        video_url:
            "url"
    };


    return (
        aliases[raw] ||
        "text"
    );
}


/* =========================================================
   LABEL
========================================================= */

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


/* =========================================================
   DESCRIPTION
========================================================= */

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


/* =========================================================
   PLACEHOLDER
========================================================= */

function getParameterPlaceholder(
    definition
) {

    return safeString(
        definition?.placeholder ||
        "",
        ""
    );
}


/* =========================================================
   REQUIRED
========================================================= */

function isRequired(
    definition
) {

    return (
        definition?.required === true ||
        definition?.required === "true" ||
        definition?.is_required === true ||
        definition?.is_required === "true"
    );
}


/* =========================================================
   OPTIONS
   ---------------------------------------------------------
   Sumber:

   enum
   options
   values
   choices

   Tidak ada nilai model yang ditulis manual.
========================================================= */

function getOptions(
    definition
) {

    let source =
        definition?.options;


    if (
        source === undefined ||
        source === null
    ) {

        source =
            definition?.values;
    }


    if (
        source === undefined ||
        source === null
    ) {

        source =
            definition?.choices;
    }


    if (
        source === undefined ||
        source === null
    ) {

        source =
            definition?.enum;
    }


    if (
        source === undefined ||
        source === null
    ) {

        return [];
    }


    /*
     * Array.
     */
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

                        const value =
                            option.value ??
                            option.id ??
                            option.key ??
                            option.name ??
                            "";

                        const label =
                            option.label ??
                            option.name ??
                            option.title ??
                            option.value ??
                            option.id ??
                            option.key ??
                            "";

                        return {
                            value:
                                String(
                                    value
                                ),

                            label:
                                safeString(
                                    label,
                                    value
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
     * Object:
     *
     * {
     *     "16:9": "16:9"
     * }
     */
    if (
        typeof source === "object"
    ) {

        return Object.entries(
            source
        )
            .map(
                ([value, label]) => ({

                    value:
                        String(value),

                    label:
                        safeString(
                            label,
                            value
                        )

                })
            )
            .filter(
                option =>
                    option.value
            );
    }


    /*
     * String / CSV / JSON.
     */
    return normalizeArray(
        source
    ).map(
        value => ({

            value:
                String(value),

            label:
                String(value)

        })
    );
}


/* =========================================================
   DEFAULT
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
   FIELD ID
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
   LABEL ELEMENT
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
   COMMON ATTRIBUTES
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
     * Numeric constraints.
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


    /*
     * maxlength.
     */
    if (
        definition?.maxLength !== undefined &&
        definition?.maxLength !== null &&
        "maxLength" in element
    ) {

        element.maxLength =
            Number(
                definition.maxLength
            );
    }


    /*
     * minlength.
     */
    if (
        definition?.minLength !== undefined &&
        definition?.minLength !== null &&
        "minLength" in element
    ) {

        element.minLength =
            Number(
                definition.minLength
            );
    }
}


/* =========================================================
   TEXT INPUT
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
   TEXTAREA
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


    textarea.rows =
        Number.isFinite(rows) &&
        rows > 0
            ? rows
            : 5;


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
   NUMBER
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
   CHECKBOX
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


    input.checked =
        toBoolean(
            getDefaultValue(
                definition
            ),
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
   SELECT
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


    /*
     * Jika enum/options tersedia,
     * render semuanya.
     */
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


    /*
     * Tidak ada options.
     *
     * Jangan membuat pilihan palsu.
     */
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
    }


    return select;
}


/* =========================================================
   RADIO
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
        (
            optionData,
            index
        ) => {

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


            input.checked =
                optionData.value ===
                defaultValue;


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
   INPUT DISPATCH
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
   DESCRIPTION
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
   FIELD
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
     * Checkbox dan radio memiliki label
     * sendiri.
     */
    if (
        type !== "checkbox" &&
        type !== "radio"
    ) {

        field.appendChild(
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
            )
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


    container.innerHTML =
        "";


    if (!model) {

        return [];
    }


    const parameters =
        getModelParameters(
            model
        );


    /*
     * Debug hanya untuk membantu verifikasi
     * konfigurasi yang benar-benar diterima
     * frontend.
     */
    console.debug(
        "[GEN-Z.AI][Generate Form] Model:",
        model?.model_id ||
        model?.id ||
        null
    );


    console.debug(
        "[GEN-Z.AI][Generate Form] Parameters:",
        parameters
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


    const renderedFields =
        [];


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
   READ FIELD VALUE
========================================================= */

function readFieldValue(
    field
) {

    if (!field) {
        return undefined;
    }


    /*
     * Radio.
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
             * Radio yang tidak aktif
             * tidak boleh menimpa radio aktif.
             */
            if (
                field.type ===
                "radio" &&
                !field.checked
            ) {

                return;
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
   GET FORM DATA
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


    const formData =
        new FormData(
            form
        );


    for (
        const [
            key,
            value
        ]
        of formData.entries()
    ) {

        if (
            Object.prototype.hasOwnProperty.call(
                data,
                key
            )
        ) {

            continue;
        }


        if (
            typeof File !==
                "undefined" &&
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
   RESET
========================================================= */

export function resetDynamicFields() {

    const container =
        getDynamicFieldsElement();


    if (!container) {
        return;
    }


    const model =
        getCurrentModel();


    renderDynamicFields(
        model
    );
}


/* =========================================================
   DISABLE
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


    const definitions =
        getModelParameters();


    fields.forEach(
        field => {

            if (disabled) {

                field.disabled =
                    true;

                return;
            }


            const definition =
                definitions.find(
                    item =>
                        getParameterName(
                            item
                        ) ===
                        field.name
                );


            field.disabled =
                definition?.disabled ===
                true;
        }
    );
}


/* =========================================================
   MEDIA PARAMETERS
========================================================= */

export function getMediaParameters(
    parameters =
        getFormParameters()
) {

    const result =
        {};


    Object.entries(
        parameters
    ).forEach(
        ([key, value]) => {

            if (
                key === "image_urls" ||
                key === "image_url" ||
                key === "video_url" ||
                key === "audio_url"
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
   PUBLIC API
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
