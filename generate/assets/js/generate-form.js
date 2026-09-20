/* =========================================================
   GEN-Z.AI
   GENERATE FORM MODULE
   ---------------------------------------------------------
   File:
   generate/assets/js/generate-form.js

   TANGGUNG JAWAB:
   - Render parameter Generate dari model.parameters
   - Image input
   - Prompt
   - Aspect ratio
   - Resolution
   - Duration slider
   - Membaca nilai form
   - Reset form
   - Disable / enable form

   SOURCE OF TRUTH:
   models/<model>/parameters.js
   melalui /api/model-config

   INTERNAL:
   task_id tidak pernah ditampilkan atau dikirim sebagai
   parameter generation.
========================================================= */

import {
    getGenerateElements,
    getCurrentModel
} from "./generate-state.js";


/* =========================================================
   INTERNAL PARAMETERS
========================================================= */

const INTERNAL_PARAMETERS = new Set([
    "task_id"
]);


/* =========================================================
   PARAMETER YANG DITAMPILKAN
   ---------------------------------------------------------
   Ini BUKAN source of truth konfigurasi.

   Daftar ini hanya menentukan parameter mana yang relevan
   untuk halaman Generate.

   Definisi nilai tetap berasal dari model.parameters.
========================================================= */

const GENERATE_PARAMETER_ORDER = [
    "image_urls",
    "image_url",
    "prompt",
    "aspect_ratio",
    "resolution",
    "duration"
];


/* =========================================================
   HELPERS
========================================================= */

function safeString(value, fallback = "") {

    if (
        value === null ||
        value === undefined
    ) {
        return fallback;
    }

    const result = String(value).trim();

    return result || fallback;
}


/* =========================================================
   ARRAY NORMALIZER
========================================================= */

function normalizeArray(value) {

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
        value === undefined ||
        value === ""
    ) {
        return [];
    }


    if (
        typeof value === "string"
    ) {

        const text = value.trim();

        if (!text) {
            return [];
        }


        /* JSON array */

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


        /* PostgreSQL array */

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


        /* CSV */

        return text
            .split(",")
            .map(
                item =>
                    item.trim()
            )
            .filter(Boolean);
    }


    return [value];
}


/* =========================================================
   BOOLEAN
========================================================= */

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
        ].includes(normalized)
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
        ].includes(normalized)
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

    return elements.dynamicFields || null;
}


/* =========================================================
   PARAMETER SOURCE
========================================================= */

function resolveParameterSource(
    model = getCurrentModel()
) {

    if (!model) {
        return null;
    }


    if (
        !model.parameters ||
        typeof model.parameters !== "object"
    ) {
        return null;
    }


    return model.parameters;
}


/* =========================================================
   NORMALIZE DEFINITIONS
========================================================= */

function normalizeParameterDefinitions(
    source
) {

    if (!source) {
        return [];
    }


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


    if (
        source.parameters &&
        typeof source.parameters === "object"
    ) {

        return normalizeParameterDefinitions(
            source.parameters
        );
    }


    if (
        typeof source === "object"
    ) {

        return Object.entries(source)
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
   NORMALIZE DEFINITION
========================================================= */

function normalizeParameterDefinition(
    definition,
    fallbackName = ""
) {

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
            type: "string"
        };
    }


    if (
        typeof definition !== "object"
    ) {

        if (!fallbackName) {
            return null;
        }

        return {
            name: fallbackName,
            key: fallbackName,
            type: typeof definition
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
    )
        .filter(
            definition => {

                const name =
                    getParameterName(
                        definition
                    );

                if (!name) {
                    return false;
                }


                if (
                    INTERNAL_PARAMETERS.has(
                        name
                    )
                ) {
                    return false;
                }


                /*
                 * Hanya parameter yang digunakan
                 * halaman Generate.
                 */
                return GENERATE_PARAMETER_ORDER
                    .includes(name);
            }
        )
        .sort(
            (a, b) => {

                const aName =
                    getParameterName(a);

                const bName =
                    getParameterName(b);

                const aIndex =
                    GENERATE_PARAMETER_ORDER
                        .indexOf(aName);

                const bIndex =
                    GENERATE_PARAMETER_ORDER
                        .indexOf(bName);

                return aIndex - bIndex;
            }
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

    return String(
        definition?.type ||
        definition?.input_type ||
        definition?.inputType ||
        "string"
    )
        .trim()
        .toLowerCase();
}


/* =========================================================
   LABEL
========================================================= */

function getParameterLabel(
    definition,
    name
) {

    const labels = {

        image_urls:
            "Input Gambar",

        image_url:
            "Input Gambar",

        prompt:
            "Prompt",

        aspect_ratio:
            "Rasio",

        resolution:
            "Resolusi",

        duration:
            "Durasi"
    };


    return safeString(
        labels[name] ||
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
        ""
    );
}


/* =========================================================
   PLACEHOLDER
========================================================= */

function getParameterPlaceholder(
    definition,
    name
) {

    const defaults = {

        image_urls:
            "Tempel URL gambar...",

        image_url:
            "Tempel URL gambar...",

        prompt:
            "Tulis prompt video..."
    };


    return safeString(
        definition?.placeholder ||
        defaults[name] ||
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


    if (
        Array.isArray(source)
    ) {

        return source
            .map(
                option => {

                    if (
                        option &&
                        typeof option === "object"
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
                                String(value),

                            label:
                                safeString(
                                    label,
                                    value
                                )
                        };
                    }


                    return {
                        value:
                            String(option),

                        label:
                            String(option)
                    };
                }
            )
            .filter(
                option =>
                    option.value !== ""
            );
    }


    if (
        typeof source === "object"
    ) {

        return Object.entries(source)
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
            );
    }


    return normalizeArray(source)
        .map(
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
   REQUIRED MARK
========================================================= */

function appendRequiredMark(
    label,
    definition
) {

    if (
        !isRequired(
            definition
        )
    ) {
        return;
    }


    const mark =
        document.createElement(
            "span"
        );

    mark.className =
        "required";

    mark.textContent =
        " *";

    label.appendChild(mark);
}


/* =========================================================
   CREATE STANDARD LABEL
========================================================= */

function createLabel(
    definition,
    name
) {

    const label =
        document.createElement(
            "label"
        );

    label.className =
        "generate-field-label";

    label.htmlFor =
        createFieldId(name);

    label.textContent =
        getParameterLabel(
            definition,
            name
        );

    appendRequiredMark(
        label,
        definition
    );

    return label;
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
        "text";

    input.id =
        createFieldId(name);

    input.name =
        name;

    input.autocomplete =
        "off";

    input.className =
        "form-control";

    input.placeholder =
        getParameterPlaceholder(
            definition,
            name
        );


    const defaultValue =
        getDefaultValue(
            definition
        );

    if (
        defaultValue !== "" &&
        defaultValue !== null &&
        defaultValue !== undefined
    ) {

        input.value =
            Array.isArray(defaultValue)
                ? defaultValue.join(", ")
                : String(defaultValue);
    }


    if (
        definition?.maxLength !== undefined
    ) {

        input.maxLength =
            Number(
                definition.maxLength
            );
    }


    if (
        definition?.minLength !== undefined
    ) {

        input.minLength =
            Number(
                definition.minLength
            );
    }


    if (
        definition?.disabled === true
    ) {

        input.disabled =
            true;
    }


    return input;
}


/* =========================================================
   IMAGE INPUT
   ---------------------------------------------------------
   image_urls adalah ARRAY pada backend.

   UI menggunakan satu URL karena parameters.js
   saat ini menetapkan maxItems: 1.

   Saat dibaca, nilainya dikembalikan sebagai array.
========================================================= */

function createImageInput(
    definition,
    name
) {

    const wrapper =
        document.createElement(
            "div"
        );

    wrapper.className =
        "generate-image-input";


    const input =
        createTextInput(
            {
                ...definition,

                placeholder:
                    getParameterPlaceholder(
                        definition,
                        name
                    )
            },
            name
        );

    input.type =
        "url";

    input.inputMode =
        "url";

    input.accept =
        "image/*";


    wrapper.appendChild(
        input
    );


    return wrapper;
}


/* =========================================================
   TEXTAREA
========================================================= */

function createPromptInput(
    definition,
    name
) {

    const textarea =
        document.createElement(
            "textarea"
        );

    textarea.id =
        createFieldId(name);

    textarea.name =
        name;

    textarea.className =
        "form-control";

    textarea.rows =
        5;

    textarea.autocomplete =
        "off";

    textarea.placeholder =
        getParameterPlaceholder(
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

        textarea.value =
            String(
                defaultValue
            );
    }


    if (
        definition?.maxLength !== undefined
    ) {

        textarea.maxLength =
            Number(
                definition.maxLength
            );
    }


    if (
        definition?.minLength !== undefined
    ) {

        textarea.minLength =
            Number(
                definition.minLength
            );
    }


    return textarea;
}


/* =========================================================
   NUMBER INPUT
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

    input.id =
        createFieldId(name);

    input.name =
        name;

    input.className =
        "form-control";


    if (
        definition?.min !== undefined
    ) {

        input.min =
            String(
                definition.min
            );
    }


    if (
        definition?.max !== undefined
    ) {

        input.max =
            String(
                definition.max
            );
    }


    if (
        definition?.step !== undefined
    ) {

        input.step =
            String(
                definition.step
            );
    }


    const defaultValue =
        getDefaultValue(
            definition
        );

    if (
        defaultValue !== "" &&
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
   DURATION SLIDER
   ---------------------------------------------------------
   min/max/default/step semuanya berasal dari
   parameters.js.

   Tidak ada angka durasi yang di-hardcode.
========================================================= */

function createDurationInput(
    definition,
    name
) {

    const wrapper =
        document.createElement(
            "div"
        );

    wrapper.className =
        "generate-duration-field";


    const top =
        document.createElement(
            "div"
        );

    top.className =
        "generate-duration-top";


    const value =
        document.createElement(
            "span"
        );

    value.className =
        "generate-duration-value";


    const range =
        document.createElement(
            "input"
        );

    range.type =
        "range";

    range.id =
        createFieldId(name);

    range.name =
        name;

    range.className =
        "generate-duration-range";


    const min =
        definition?.min !== undefined
            ? Number(definition.min)
            : 0;

    const max =
        definition?.max !== undefined
            ? Number(definition.max)
            : 100;

    const step =
        definition?.step !== undefined
            ? Number(definition.step)
            : 1;


    range.min =
        String(min);

    range.max =
        String(max);

    range.step =
        String(step);


    let defaultValue =
        getDefaultValue(
            definition
        );


    if (
        defaultValue === "" ||
        defaultValue === null ||
        defaultValue === undefined
    ) {

        defaultValue =
            min;
    }


    let numericDefault =
        Number(
            defaultValue
        );


    if (
        !Number.isFinite(
            numericDefault
        )
    ) {

        numericDefault =
            min;
    }


    numericDefault =
        Math.min(
            max,
            Math.max(
                min,
                numericDefault
            )
        );


    range.value =
        String(
            numericDefault
        );


    value.textContent =
        `${numericDefault} detik`;


    const updateValue =
        () => {

            value.textContent =
                `${range.value} detik`;
        };


    range.addEventListener(
        "input",
        updateValue
    );


    range.addEventListener(
        "change",
        updateValue
    );


    top.appendChild(
        createDurationLabel(
            definition,
            name
        )
    );

    top.appendChild(
        value
    );


    wrapper.appendChild(
        top
    );

    wrapper.appendChild(
        range
    );


    const scale =
        document.createElement(
            "div"
        );

    scale.className =
        "generate-duration-scale";


    const minLabel =
        document.createElement(
            "span"
        );

    minLabel.textContent =
        `${min} detik`;


    const maxLabel =
        document.createElement(
            "span"
        );

    maxLabel.textContent =
        `${max} detik`;


    scale.appendChild(
        minLabel
    );

    scale.appendChild(
        maxLabel
    );


    wrapper.appendChild(
        scale
    );


    return wrapper;
}


/* =========================================================
   DURATION LABEL
========================================================= */

function createDurationLabel(
    definition,
    name
) {

    const label =
        document.createElement(
            "span"
        );

    label.className =
        "generate-field-label";

    label.textContent =
        getParameterLabel(
            definition,
            name
        );


    if (
        isRequired(
            definition
        )
    ) {

        const mark =
            document.createElement(
                "span"
            );

        mark.className =
            "required";

        mark.textContent =
            " *";

        label.appendChild(
            mark
        );
    }


    return label;
}


/* =========================================================
   CHECKBOX-STYLE SINGLE SELECT
   ---------------------------------------------------------
   Ratio dan resolution tetap menggunakan satu nilai.

   Visualnya checkbox/card.
   Secara HTML menggunakan radio agar hanya satu
   pilihan yang aktif.
========================================================= */

function createOptionGroup(
    definition,
    name
) {

    const wrapper =
        document.createElement(
            "div"
        );

    wrapper.className =
        "generate-option-group";


    const options =
        getOptions(
            definition
        );


    let defaultValue =
        getDefaultValue(
            definition
        );


    if (
        defaultValue === null ||
        defaultValue === undefined
    ) {

        defaultValue =
            "";
    }


    defaultValue =
        String(
            defaultValue
        );


    options.forEach(
        (
            option,
            index
        ) => {

            const label =
                document.createElement(
                    "label"
                );

            label.className =
                "generate-option";


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
                option.value;


            input.checked =
                option.value ===
                defaultValue;


            const text =
                document.createElement(
                    "span"
                );

            text.className =
                "generate-option-label";

            text.textContent =
                option.label;


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
   DESCRIPTION
========================================================= */

function createDescription(
    definition
) {

    const text =
        getParameterDescription(
            definition
        );

    if (!text) {
        return null;
    }


    const element =
        document.createElement(
            "small"
        );

    element.className =
        "generate-field-description";

    element.textContent =
        text;

    return element;
}


/* =========================================================
   CREATE FIELD
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


    if (
        INTERNAL_PARAMETERS.has(
            name
        )
    ) {
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


    field.dataset.parameterType =
        type;


    /* =====================================================
       IMAGE
    ====================================================== */

    if (
        name === "image_urls" ||
        name === "image_url"
    ) {

        field.appendChild(
            createLabel(
                definition,
                name
            )
        );


        field.appendChild(
            createImageInput(
                definition,
                name
            )
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


    /* =====================================================
       PROMPT
    ====================================================== */

    if (
        name === "prompt"
    ) {

        field.appendChild(
            createLabel(
                definition,
                name
            )
        );


        field.appendChild(
            createPromptInput(
                definition,
                name
            )
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


    /* =====================================================
       RATIO
    ====================================================== */

    if (
        name === "aspect_ratio"
    ) {

        field.appendChild(
            createLabel(
                definition,
                name
            )
        );


        field.appendChild(
            createOptionGroup(
                definition,
                name
            )
        );


        return field;
    }


    /* =====================================================
       RESOLUTION
    ====================================================== */

    if (
        name === "resolution"
    ) {

        field.appendChild(
            createLabel(
                definition,
                name
            )
        );


        field.appendChild(
            createOptionGroup(
                definition,
                name
            )
        );


        return field;
    }


    /* =====================================================
       DURATION
    ====================================================== */

    if (
        name === "duration"
    ) {

        field.appendChild(
            createDurationInput(
                definition,
                name
            )
        );


        return field;
    }


    /*
     * Parameter yang tidak termasuk UI Generate
     * tidak dirender.
     */

    return null;
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


    if (
        renderedFields.length === 0
    ) {

        const message =
            document.createElement(
                "div"
            );

        message.className =
            "generate-empty-fields";

        message.textContent =
            "Model ini tidak memiliki parameter Generate yang tersedia.";

        container.appendChild(
            message
        );
    }


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


    const fields =
        container.querySelectorAll(
            "[name]"
        );


    for (
        const field of fields
    ) {

        if (
            String(
                field.name || ""
            ).trim() ===
            normalizedName
        ) {

            return field;
        }
    }


    return null;
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


    if (
        field.type === "radio"
    ) {

        if (!field.checked) {
            return undefined;
        }

        return field.value;
    }


    if (
        field.type === "checkbox"
    ) {

        return Boolean(
            field.checked
        );
    }


    if (
        field.type === "range" ||
        field.type === "number"
    ) {

        if (
            field.value === ""
        ) {
            return "";
        }


        const number =
            Number(
                field.value
            );


        return Number.isFinite(
            number
        )
            ? number
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


            if (
                INTERNAL_PARAMETERS.has(
                    name
                )
            ) {
                return;
            }


            if (
                field.type === "radio" &&
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


            const definition =
                parameterDefinition(
                    name
                );


            const originalType =
                String(
                    definition?.type ||
                    ""
                )
                    .trim()
                    .toLowerCase();


            /*
             * image_urls harus ARRAY.
             */

            if (
                name === "image_urls" ||
                originalType === "array"
            ) {

                parameters[name] =
                    normalizeArray(
                        value
                    );

                return;
            }


            parameters[name] =
                value;
        }
    );


    /*
     * Jika model menggunakan image_url singular,
     * backend tetap menerima image_url sesuai definisi.
     *
     * Tidak membuat key image_urls palsu.
     */


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


    /*
     * Dynamic parameters adalah source utama.
     */

    return getFormParameters();
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


    if (
        INTERNAL_PARAMETERS.has(
            normalizedName
        )
    ) {
        return false;
    }


    const fields =
        container.querySelectorAll(
            "[name]"
        );


    let found =
        false;


    fields.forEach(
        field => {

            if (
                String(
                    field.name || ""
                ).trim() !==
                normalizedName
            ) {
                return;
            }


            found =
                true;


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


            if (
                Array.isArray(value)
            ) {

                field.value =
                    value.join(
                        ", "
                    );

                return;
            }


            field.value =
                value === null ||
                value === undefined
                    ? ""
                    : String(value);
        }
    );


    return found;
}


/* =========================================================
   RESET
========================================================= */

export function resetDynamicFields() {

    const model =
        getCurrentModel();


    renderDynamicFields(
        model
    );
}


/* =========================================================
   DISABLE / ENABLE
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

            field.disabled =
                Boolean(
                    disabled
                );
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
        parameters || {}
    ).forEach(
        ([key, value]) => {

            if (
                INTERNAL_PARAMETERS.has(
                    key
                )
            ) {
                return;
            }


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


    if (
        INTERNAL_PARAMETERS.has(
            normalizedName
        )
    ) {
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
