/* =========================================================
   GEN-Z.AI
   GENERATE FORM MODULE
   ---------------------------------------------------------
   File:
   generate/assets/js/generate-form.js

   Tanggung jawab:
   - Render parameter model secara dinamis
   - Source parameter dari konfigurasi model
   - Mendukung object / array / JSON Schema
   - Image URL / Upload melalui media module
   - Audio URL / Upload melalui media module
   - Enum
   - Boolean
   - Number / Integer
   - Duration range
   - Collect parameter melalui generate-form-data.js
   - Reset form
   - Tidak membuat parameter model baru
   - Parameter internal tidak ditampilkan
   - Parameter server-controlled tidak dikirim dari client
========================================================= */

"use strict";


/* =========================================================
   STATE
========================================================= */

import {
    getGenerateElements,
    getCurrentModel,
    getCurrentUser,
    getSupabaseClient
} from "./generate-state.js";


/* =========================================================
   UPLOAD
========================================================= */

import {
    createImageStoragePath,
    validateImageFile,
    uploadImageFile,
    createAudioStoragePath,
    validateAudioFile,
    uploadAudioFile
} from "./generate-form-upload.js";


/* =========================================================
   FORM CORE
========================================================= */

import {
    INTERNAL_PARAMETERS,
    SERVER_CONTROLLED_PARAMETERS,
    PARAMETER_ORDER,
    FULL_WIDTH_PARAMETERS,
    getContainer,
    resolveModel,
    getParameterDefinitions,
    normalizeParameterDefinitions,
    getParameterLabel,
    getParameterDescription,
    isInternalParameter,
    isServerControlledParameter,
    isClientForbiddenParameter,
    isRenderableParameter,
    getOrderedParameterNames,
    getDefaultValue,
    normalizeArray,
    normalizeParameterValue,
    createFieldId
} from "./generate-form-core.js";


/* =========================================================
   FIELD FACTORIES
========================================================= */

import {
    registerImageFieldFactory,
    registerAudioFieldFactory
} from "./generate-form-fields.js";


/* =========================================================
   MEDIA FIELD MODULE
========================================================= */

import {
    createImageField as createMediaImageField,
    createAudioField as createMediaAudioField,
    registerImageMediaHandlers,
    registerAudioMediaHandlers
} from "./generate-form-media.js";


/* =========================================================
   FIELD READER
========================================================= */

import {
    findField,
    readFieldValue
} from "./generate-form-reader.js";


/* =========================================================
   MEDIA READER
========================================================= */

import {
    resolveImageParameterValue,
    resolveAudioParameterValue
} from "./generate-form-media-reader.js";


/* =========================================================
   FORM DATA
   ---------------------------------------------------------
   getFormParameters()
   getFormData()
   sekarang dimiliki oleh:
   generate-form-data.js
========================================================= */

import {
    getFormParameters,
    getFormData
} from "./generate-form-data.js";


/* =========================================================
   MEDIA HANDLER REGISTRATION
========================================================= */

registerImageMediaHandlers({
    upload:
        uploadImageFile,

    validate:
        validateImageFile
});


registerAudioMediaHandlers({
    upload:
        uploadAudioFile,

    validate:
        validateAudioFile
});


registerImageFieldFactory(
    createMediaImageField
);


registerAudioFieldFactory(
    createMediaAudioField
);


/* =========================================================
   CREATE FIELD
========================================================= */

function createField(
    name,
    definition = {}
) {

    const wrapper =
        document.createElement(
            "div"
        );


    wrapper.className =
        "generate-field";


    wrapper.dataset.parameter =
        name;


    wrapper.style.setProperty(
        "width",
        "100%",
        "important"
    );


    wrapper.style.setProperty(
        "min-width",
        "0",
        "important"
    );


    wrapper.style.setProperty(
        "box-sizing",
        "border-box",
        "important"
    );


    wrapper.style.setProperty(
        "visibility",
        "visible",
        "important"
    );


    wrapper.style.setProperty(
        "opacity",
        "1",
        "important"
    );


    const label =
        document.createElement(
            "label"
        );


    label.className =
        "generate-field-label";


    label.htmlFor =
        createFieldId(
            name
        );


    label.textContent =
        getParameterLabel(
            name,
            definition
        );


    wrapper.appendChild(
        label
    );


    return wrapper;

}


/* =========================================================
   DESCRIPTION
========================================================= */

function appendDescription(
    wrapper,
    definition
) {

    if (
        !wrapper
    ) {

        return;

    }


    const description =
        getParameterDescription(
            definition
        );


    if (
        !description
    ) {

        return;

    }


    const element =
        document.createElement(
            "div"
        );


    element.className =
        "generate-field-description";


    element.textContent =
        description;


    wrapper.appendChild(
        element
    );

}


/* =========================================================
   ENUM
========================================================= */

function createEnumField(
    name,
    definition = {}
) {

    const wrapper =
        document.createElement(
            "div"
        );


    wrapper.className =
        "generate-option-group";


    const enumValues =
        Array.isArray(
            definition?.enum
        )

            ? definition.enum

            : (
                Array.isArray(
                    definition?.options
                )
                    ? definition.options
                    : []
            );


    let defaultValue =
        getDefaultValue(
            definition
        );


    if (
        defaultValue ===
            undefined &&
        enumValues.length
    ) {

        defaultValue =
            enumValues[0];

    }


    enumValues.forEach(
        value => {

            const option =
                document.createElement(
                    "label"
                );


            option.className =
                "generate-option";


            const input =
                document.createElement(
                    "input"
                );


            input.type =
                "radio";


            input.name =
                `generate-radio-${name}`;


            input.value =
                String(
                    value
                );


            input.dataset.parameter =
                name;


            input.id =
                createFieldId(
                    `${name}-${String(value)}`
                );


            const optionLabel =
                document.createElement(
                    "span"
                );


            optionLabel.className =
                "generate-option-label";


            optionLabel.textContent =
                String(
                    value
                );


            if (
                String(value) ===
                String(defaultValue)
            ) {

                input.checked =
                    true;


                optionLabel.classList.add(
                    "active"
                );

            }


            input.addEventListener(
                "change",
                () => {

                    wrapper
                        .querySelectorAll(
                            ".generate-option-label"
                        )
                        .forEach(
                            label => {

                                label.classList.remove(
                                    "active"
                                );

                            }
                        );


                    if (
                        input.checked
                    ) {

                        optionLabel.classList.add(
                            "active"
                        );

                    }

                }
            );


            option.appendChild(
                input
            );


            option.appendChild(
                optionLabel
            );


            wrapper.appendChild(
                option
            );

        }
    );


    return wrapper;

}


/* =========================================================
   BOOLEAN
========================================================= */

function createBooleanField(
    definition = {},
    name = ""
) {

    const wrapper =
        document.createElement(
            "label"
        );


    wrapper.className =
        "generate-checkbox-field";


    const input =
        document.createElement(
            "input"
        );


    input.type =
        "checkbox";


    input.name =
        name;


    input.dataset.parameter =
        name;


    input.id =
        createFieldId(
            name
        );


    input.checked =
        Boolean(
            getDefaultValue(
                definition
            )
        );


    const text =
        document.createElement(
            "span"
        );


    text.className =
        "generate-checkbox-label";


    text.textContent =
        getParameterLabel(
            name,
            definition
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
   NUMBER
========================================================= */

function createNumberField(
    definition = {},
    name = ""
) {

    const input =
        document.createElement(
            "input"
        );


    input.type =
        "number";


    input.id =
        createFieldId(
            name
        );


    input.name =
        name;


    input.className =
        "form-control";


    input.dataset.parameter =
        name;


    const min =
        Number(
            definition?.min ??
            definition?.minimum
        );


    const max =
        Number(
            definition?.max ??
            definition?.maximum
        );


    if (
        Number.isFinite(
            min
        )
    ) {

        input.min =
            String(
                min
            );

    }


    if (
        Number.isFinite(
            max
        )
    ) {

        input.max =
            String(
                max
            );

    }


    const type =
        String(
            definition?.type ||
            ""
        )
            .trim()
            .toLowerCase();


    input.step =
        type ===
            "integer"

            ? "1"

            : "any";


    const defaultValue =
        getDefaultValue(
            definition
        );


    if (
        defaultValue !==
        undefined &&
        defaultValue !==
        null
    ) {

        input.value =
            String(
                defaultValue
            );

    }


    return input;

}


/* =========================================================
   DURATION
========================================================= */

function createDurationField(
    definition = {},
    name = "duration"
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


    const title =
        document.createElement(
            "span"
        );


    title.textContent =
        getParameterLabel(
            name,
            definition
        );


    const valueLabel =
        document.createElement(
            "span"
        );


    valueLabel.className =
        "generate-duration-value";


    const range =
        document.createElement(
            "input"
        );


    range.type =
        "range";


    range.id =
        createFieldId(
            name
        );


    range.name =
        name;


    range.className =
        "generate-duration-range";


    range.dataset.parameter =
        name;


    let min =
        Number(
            definition?.min ??
            definition?.minimum
        );


    let max =
        Number(
            definition?.max ??
            definition?.maximum
        );


    if (
        !Number.isFinite(
            min
        )
    ) {

        min =
            1;

    }


    if (
        !Number.isFinite(
            max
        )
    ) {

        max =
            30;

    }


    const parsedDefault =
        Number(
            getDefaultValue(
                definition
            )
        );


    let value =
        Number.isFinite(
            parsedDefault
        )
            ? parsedDefault
            : min;


    value =
        Math.max(
            min,
            Math.min(
                max,
                value
            )
        );


    range.min =
        String(
            min
        );


    range.max =
        String(
            max
        );


    range.step =
        "1";


    range.value =
        String(
            value
        );


    valueLabel.textContent =
        `${value} detik`;


    top.appendChild(
        title
    );


    top.appendChild(
        valueLabel
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


    range.addEventListener(
        "input",
        () => {

            valueLabel.textContent =
                `${range.value} detik`;

        }
    );


    return wrapper;

}


/* =========================================================
   TEXTAREA
========================================================= */

function createTextareaField(
    definition = {},
    name = ""
) {

    const textarea =
        document.createElement(
            "textarea"
        );


    textarea.id =
        createFieldId(
            name
        );


    textarea.name =
        name;


    textarea.className =
        "form-control";


    textarea.dataset.parameter =
        name;


    textarea.rows =
        Number(
            definition?.rows
        ) ||
        5;


    textarea.placeholder =
        definition?.placeholder ||
        (
            name === "prompt"
                ? "Masukkan prompt..."
                : ""
        );


    const maxLength =
        Number(
            definition?.maxLength ??
            definition?.max_length
        );


    if (
        Number.isFinite(
            maxLength
        )
    ) {

        textarea.maxLength =
            maxLength;

    }


    const defaultValue =
        getDefaultValue(
            definition
        );


    if (
        defaultValue !==
            undefined &&
        defaultValue !==
            null
    ) {

        textarea.value =
            String(
                defaultValue
            );

    }


    return textarea;

}


/* =========================================================
   TEXT
========================================================= */

function createTextField(
    definition = {},
    name = ""
) {

    const input =
        document.createElement(
            "input"
        );


    input.type =
        "text";


    input.id =
        createFieldId(
            name
        );


    input.name =
        name;


    input.className =
        "form-control";


    input.dataset.parameter =
        name;


    input.placeholder =
        definition?.placeholder ||
        "";


    const maxLength =
        Number(
            definition?.maxLength ??
            definition?.max_length
        );


    if (
        Number.isFinite(
            maxLength
        )
    ) {

        input.maxLength =
            maxLength;

    }


    const defaultValue =
        getDefaultValue(
            definition
        );


    if (
        defaultValue !==
            undefined &&
        defaultValue !==
            null
    ) {

        input.value =
            String(
                defaultValue
            );

    }


    return input;

}


/* =========================================================
   SELECT
========================================================= */

function createSelectField(
    definition = {},
    name = ""
) {

    const select =
        document.createElement(
            "select"
        );


    select.id =
        createFieldId(
            name
        );


    select.name =
        name;


    select.className =
        "form-control";


    select.dataset.parameter =
        name;


    const options =
        Array.isArray(
            definition?.options
        )
            ? definition.options
            : [];


    options.forEach(
        optionValue => {

            const option =
                document.createElement(
                    "option"
                );


            if (
                optionValue &&
                typeof optionValue ===
                    "object"
            ) {

                option.value =
                    String(
                        optionValue.value ??
                        optionValue.id ??
                        ""
                    );


                option.textContent =
                    String(
                        optionValue.label ??
                        optionValue.name ??
                        option.value
                    );

            } else {

                option.value =
                    String(
                        optionValue
                    );


                option.textContent =
                    String(
                        optionValue
                    );

            }


            select.appendChild(
                option
            );

        }
    );


    const defaultValue =
        getDefaultValue(
            definition
        );


    if (
        defaultValue !==
            undefined &&
        defaultValue !==
            null
    ) {

        select.value =
            String(
                defaultValue
            );

    }


    return select;

}


/* =========================================================
   CREATE INPUT
========================================================= */

function createFieldInput(
    name,
    definition = {}
) {

    const type =
        String(
            definition?.type ||
            "string"
        )
            .trim()
            .toLowerCase();


    /* =====================================================
       IMAGE
    ===================================================== */

    if (
        name === "image_urls" ||
        name === "image_url"
    ) {

        return createMediaImageField(
            definition,
            name
        );

    }


    /* =====================================================
       AUDIO
    ===================================================== */

    if (
        name === "audio_url" ||
        type === "audio" ||
        type === "audio_url"
    ) {

        return createMediaAudioField(
            definition,
            name
        );

    }


    /* =====================================================
       ENUM
    ===================================================== */

    if (
        Array.isArray(
            definition?.enum
        ) &&
        definition.enum.length
    ) {

        return createEnumField(
            name,
            definition
        );

    }


    /* =====================================================
       OPTIONS
    ===================================================== */

    if (
        Array.isArray(
            definition?.options
        ) &&
        definition.options.length
    ) {

        return createSelectField(
            definition,
            name
        );

    }


    /* =====================================================
       BOOLEAN
    ===================================================== */

    if (
        type === "boolean"
    ) {

        return createBooleanField(
            definition,
            name
        );

    }


    /* =====================================================
       DURATION
    ===================================================== */

    if (
        name === "duration" &&
        (
            type === "number" ||
            type === "integer"
        )
    ) {

        return createDurationField(
            definition,
            name
        );

    }


    /* =====================================================
       NUMBER
    ===================================================== */

    if (
        type === "number" ||
        type === "integer"
    ) {

        return createNumberField(
            definition,
            name
        );

    }


    /* =====================================================
       TEXTAREA
    ===================================================== */

    const maxLength =
        Number(
            definition?.maxLength ??
            definition?.max_length
        );


    if (
        name === "prompt" ||
        name === "description" ||
        name === "negative_prompt" ||
        (
            Number.isFinite(
                maxLength
            ) &&
            maxLength > 500
        )
    ) {

        return createTextareaField(
            definition,
            name
        );

    }


    /* =====================================================
       DEFAULT TEXT
    ===================================================== */

    return createTextField(
        definition,
        name
    );

}


/* =========================================================
   RENDER PARAMETER
========================================================= */

function renderParameter(
    name,
    definition
) {

    if (
        !isRenderableParameter(
            name,
            definition
        )
    ) {

        return null;

    }


    if (
        isClientForbiddenParameter(
            name
        )
    ) {

        return null;

    }


    if (
        isInternalParameter(
            name
        )
    ) {

        return null;

    }


    if (
        isServerControlledParameter(
            name
        )
    ) {

        return null;

    }


    const wrapper =
        createField(
            name,
            definition
        );


    const input =
        createFieldInput(
            name,
            definition
        );


    if (
        input
    ) {

        wrapper.appendChild(
            input
        );

    }


    /*
     * Duration memiliki title sendiri.
     */

    if (
        name !== "duration"
    ) {

        appendDescription(
            wrapper,
            definition
        );

    }


    return wrapper;

}


/* =========================================================
   FORCE CONTAINER VISIBLE
========================================================= */

function forceContainerVisible(
    container
) {

    if (
        !container
    ) {

        return;

    }


    container.hidden =
        false;


    container.removeAttribute(
        "hidden"
    );


    container.style.setProperty(
        "display",
        "grid",
        "important"
    );


    container.style.setProperty(
        "grid-template-columns",
        "repeat(2, minmax(0, 1fr))",
        "important"
    );


    container.style.setProperty(
        "grid-auto-flow",
        "row",
        "important"
    );


    container.style.setProperty(
        "align-items",
        "start",
        "important"
    );


    container.style.setProperty(
        "column-gap",
        "20px",
        "important"
    );


    container.style.setProperty(
        "row-gap",
        "18px",
        "important"
    );


    container.style.setProperty(
        "width",
        "100%",
        "important"
    );


    container.style.setProperty(
        "box-sizing",
        "border-box",
        "important"
    );


    container.style.setProperty(
        "visibility",
        "visible",
        "important"
    );


    container.style.setProperty(
        "opacity",
        "1",
        "important"
    );


    container.style.setProperty(
        "height",
        "auto",
        "important"
    );


    container.style.setProperty(
        "max-height",
        "none",
        "important"
    );


    container.style.setProperty(
        "overflow",
        "visible",
        "important"
    );


    const mobile =
        typeof window !==
            "undefined" &&
        typeof window.matchMedia ===
            "function" &&
        window.matchMedia(
            "(max-width: 768px)"
        ).matches;


    if (
        mobile
    ) {

        container.style.setProperty(
            "grid-template-columns",
            "minmax(0, 1fr)",
            "important"
        );

    }


    const fields =
        container.querySelectorAll(
            ".generate-field"
        );


    fields.forEach(
        field => {

            if (
                !field
            ) {

                return;

            }


            const parameter =
                String(
                    field.dataset.parameter ||
                    ""
                )
                    .trim()
                    .toLowerCase();


            field.style.setProperty(
                "display",
                "block",
                "important"
            );


            field.style.setProperty(
                "width",
                "auto",
                "important"
            );


            field.style.setProperty(
                "min-width",
                "0",
                "important"
            );


            field.style.setProperty(
                "max-width",
                "100%",
                "important"
            );


            field.style.setProperty(
                "box-sizing",
                "border-box",
                "important"
            );


            field.style.setProperty(
                "align-self",
                "start",
                "important"
            );


            field.style.setProperty(
                "visibility",
                "visible",
                "important"
            );


            field.style.setProperty(
                "opacity",
                "1",
                "important"
            );


            const fullWidth =
                (
                    Array.isArray(
                        FULL_WIDTH_PARAMETERS
                    )
                        ? FULL_WIDTH_PARAMETERS.includes(
                            parameter
                        )
                        : (
                            FULL_WIDTH_PARAMETERS instanceof Set
                                ? FULL_WIDTH_PARAMETERS.has(
                                    parameter
                                )
                                : (
                                    parameter === "prompt" ||
                                    parameter === "negative_prompt" ||
                                    parameter === "description" ||
                                    parameter === "image_urls" ||
                                    parameter === "image_url" ||
                                    parameter === "audio_url"
                                )
                        )
                );


            if (
                mobile
            ) {

                field.style.setProperty(
                    "grid-column",
                    "1 / -1",
                    "important"
                );

            } else if (
                fullWidth
            ) {

                field.style.setProperty(
                    "grid-column",
                    "1 / -1",
                    "important"
                );

            } else {

                field.style.setProperty(
                    "grid-column",
                    "span 1",
                    "important"
                );

            }

        }
    );

}


/* =========================================================
   RENDER FORM
========================================================= */

export function renderGenerateForm(
    modelArgument = null
) {

    const container =
        getContainer();


    if (
        !container
    ) {

        console.error(
            "[GEN-Z.AI][Generate Form] #dynamicFields tidak ditemukan."
        );


        return false;

    }


    const model =
        resolveModel(
            modelArgument
        );


    if (
        !model
    ) {

        console.error(
            "[GEN-Z.AI][Generate Form] Model tidak tersedia."
        );


        return false;

    }


    container.innerHTML =
        "";


    const definitions =
        getParameterDefinitions(
            model
        );


    const names =
        getOrderedParameterNames(
            definitions
        );


    console.debug(
        "[GEN-Z.AI][Generate Form] MODEL:",
        model.model_id ||
        model.id ||
        "-"
    );


    console.debug(
        "[GEN-Z.AI][Generate Form] PARAMETER NAMES:",
        names
    );


    if (
        names.length === 0
    ) {

        const empty =
            document.createElement(
                "div"
            );


        empty.className =
            "generate-empty-parameters";


        empty.textContent =
            "Parameter model belum tersedia.";


        container.appendChild(
            empty
        );


        forceContainerVisible(
            container
        );


        return false;

    }


    let renderedCount =
        0;


    names.forEach(
        name => {

            try {

                const field =
                    renderParameter(
                        name,
                        definitions[name]
                    );


                if (
                    field
                ) {

                    container.appendChild(
                        field
                    );


                    renderedCount +=
                        1;

                }

            } catch (
                error
            ) {

                console.error(
                    "[GEN-Z.AI][Generate Form] Parameter gagal dirender:",
                    name,
                    error
                );

            }

        }
    );


    forceContainerVisible(
        container
    );


    console.debug(
        "[GEN-Z.AI][Generate Form] RENDER SELESAI:",
        {
            model:
                model.model_id ||
                model.id ||
                "-",

            fields:
                renderedCount,

            parameters:
                names
        }
    );


    return renderedCount > 0;

}


/* =========================================================
   SET FIELD VALUE
========================================================= */

export function setFieldValue(
    name,
    value
) {

    if (
        isClientForbiddenParameter(
            name
        ) ||
        isInternalParameter(
            name
        ) ||
        isServerControlledParameter(
            name
        )
    ) {

        return false;

    }


    const field =
        findField(
            name
        );


    if (
        !field
    ) {

        return false;

    }


    /* =====================================================
       IMAGE
    ===================================================== */

    if (
        name === "image_urls" ||
        name === "image_url"
    ) {

        const imageInput =
            field.querySelector(
                ".generate-image-input"
            ) ||
            (
                field.classList?.contains(
                    "generate-image-input"
                )
                    ? field
                    : null
            );


        const images =
            normalizeArray(
                value
            );


        const urlInput =
            imageInput &&
            typeof imageInput.getUrlInput ===
                "function"

                ? imageInput.getUrlInput()

                : field.querySelector(
                    'input[type="url"]'
                );


        if (
            urlInput
        ) {

            urlInput.value =
                images[0] ||
                "";

        }


        if (
            imageInput &&
            typeof imageInput.setUploadedUrl ===
                "function"
        ) {

            imageInput.setUploadedUrl(
                ""
            );

        }


        return true;

    }


    /* =====================================================
       AUDIO
    ===================================================== */

    if (
        name === "audio_url"
    ) {

        const audioInput =
            field.querySelector(
                ".generate-audio-input"
            ) ||
            (
                field.classList?.contains(
                    "generate-audio-input"
                )
                    ? field
                    : null
            );


        const urlInput =
            audioInput &&
            typeof audioInput.getUrlInput ===
                "function"

                ? audioInput.getUrlInput()

                : field.querySelector(
                    'input[type="url"]'
                );


        if (
            urlInput
        ) {

            urlInput.value =
                String(
                    value ||
                    ""
                ).trim();

        }


        if (
            audioInput &&
            typeof audioInput.setUploadedUrl ===
                "function"
        ) {

            audioInput.setUploadedUrl(
                ""
            );

        }


        return true;

    }


    /* =====================================================
       RADIO
    ===================================================== */

    const radios =
        field.querySelectorAll(
            'input[type="radio"]'
        );


    if (
        radios.length
    ) {

        let found =
            false;


        radios.forEach(
            radio => {

                const active =
                    String(
                        radio.value
                    ) ===
                    String(
                        value
                    );


                radio.checked =
                    active;


                radio
                    .nextElementSibling
                    ?.classList.toggle(
                        "active",
                        active
                    );


                if (
                    active
                ) {

                    found =
                        true;

                }

            }
        );


        return found;

    }


    /* =====================================================
       CHECKBOX
    ===================================================== */

    const checkbox =
        field.querySelector(
            'input[type="checkbox"]'
        );


    if (
        checkbox
    ) {

        checkbox.checked =
            Boolean(
                value
            );


        return true;

    }


    /* =====================================================
       NORMAL
    ===================================================== */

    const input =
        field.querySelector(
            "input, textarea, select"
        );


    if (
        !input
    ) {

        return false;

    }


    input.value =
        value ??
        "";


    return true;

}


/* =========================================================
   RESET
========================================================= */

export async function resetDynamicFields(
    modelArgument = null
) {

    const container =
        getContainer();


    if (
        !container
    ) {

        return;

    }


    /* =====================================================
       SEEDANCE
    ===================================================== */

    const seedanceForm =
        container.querySelector(
            ".seedance-form"
        );


    if (
        seedanceForm
    ) {

        console.debug(
            "[GEN-Z.AI][Generate Form] Reset Seedance tanpa render ulang."
        );


        seedanceForm
            .querySelectorAll(
                "input:not([type='file']):not([type='radio']):not([type='checkbox']), textarea"
            )
            .forEach(
                input => {

                    if (
                        "defaultValue" in
                        input
                    ) {

                        input.value =
                            input.defaultValue;

                    } else {

                        input.value =
                            "";

                    }


                    input.dispatchEvent(
                        new Event(
                            "input",
                            {
                                bubbles:
                                    true
                            }
                        )
                    );


                    input.dispatchEvent(
                        new Event(
                            "change",
                            {
                                bubbles:
                                    true
                            }
                        )
                    );

                }
            );


        seedanceForm
            .querySelectorAll(
                "select"
            )
            .forEach(
                select => {

                    const defaultOption =
                        select.querySelector(
                            "option[selected]"
                        );


                    if (
                        defaultOption
                    ) {

                        select.value =
                            defaultOption.value;

                    } else if (
                        select.options.length
                    ) {

                        select.selectedIndex =
                            0;

                    }


                    select.dispatchEvent(
                        new Event(
                            "change",
                            {
                                bubbles:
                                    true
                            }
                        )
                    );

                }
            );


        seedanceForm
            .querySelectorAll(
                "input[type='radio']"
            )
            .forEach(
                radio => {

                    radio.checked =
                        radio.defaultChecked;

                }
            );


        seedanceForm
            .querySelectorAll(
                "input[type='checkbox']"
            )
            .forEach(
                checkbox => {

                    checkbox.checked =
                        checkbox.defaultChecked;


                    checkbox.dispatchEvent(
                        new Event(
                            "change",
                            {
                                bubbles:
                                    true
                            }
                        )
                    );

                }
            );


        seedanceForm
            .querySelectorAll(
                "input[type='file']"
            )
            .forEach(
                fileInput => {

                    try {

                        fileInput.value =
                            "";

                    } catch (
                        error
                    ) {

                        console.warn(
                            "[GEN-Z.AI][Generate Form] Reset file input gagal:",
                            error
                        );

                    }

                }
            );


        const imageUploads =
            seedanceForm.querySelectorAll(
                ".generate-image-input"
            );


        for (
            const upload
            of imageUploads
        ) {

            if (
                typeof upload.clearUploadedFile ===
                "function"
            ) {

                try {

                    await upload.clearUploadedFile();

                } catch (
                    error
                ) {

                    console.warn(
                        "[GEN-Z.AI][Generate Form] Reset image upload Seedance gagal:",
                        error
                    );

                }

            }

        }


        const audioUploads =
            seedanceForm.querySelectorAll(
                ".generate-audio-input"
            );


        for (
            const upload
            of audioUploads
        ) {

            if (
                typeof upload.clearUploadedFile ===
                "function"
            ) {

                try {

                    await upload.clearUploadedFile();

                } catch (
                    error
                ) {

                    console.warn(
                        "[GEN-Z.AI][Generate Form] Reset audio upload Seedance gagal:",
                        error
                    );

                }

            }

        }


        seedanceForm
            .querySelectorAll(
                ".seedance-preview, " +
                ".seedance-file-preview, " +
                ".seedance-selected-files, " +
                ".seedance-media-preview"
            )
            .forEach(
                preview => {

                    preview.innerHTML =
                        "";


                    preview.style.display =
                        "none";

                }
            );


        seedanceForm
            .querySelectorAll(
                "[data-uploaded-url]"
            )
            .forEach(
                element => {

                    delete element.dataset.uploadedUrl;

                }
            );


        seedanceForm
            .querySelectorAll(
                "[data-uploaded-urls]"
            )
            .forEach(
                element => {

                    delete element.dataset.uploadedUrls;

                }
            );


        seedanceForm
            .querySelectorAll(
                "[data-counter], " +
                ".seedance-counter, " +
                ".char-counter"
            )
            .forEach(
                counter => {

                    const text =
                        String(
                            counter.textContent ||
                            ""
                        );


                    if (
                        /^\s*\d+\s*\/\s*\d+\s*$/.test(
                            text
                        )
                    ) {

                        const match =
                            text.match(
                                /\/\s*(\d+)/
                            );


                        counter.textContent =
                            match
                                ? `0 / ${match[1]}`
                                : "0";

                    }

                }
            );


        seedanceForm
            .querySelectorAll(
                "input[type='checkbox']"
            )
            .forEach(
                checkbox => {

                    checkbox.dispatchEvent(
                        new Event(
                            "input",
                            {
                                bubbles:
                                    true
                            }
                        )
                    );


                    checkbox.dispatchEvent(
                        new Event(
                            "change",
                            {
                                bubbles:
                                    true
                            }
                        )
                    );

                }
            );


        container.hidden =
            false;


        container.removeAttribute(
            "hidden"
        );


        container.style.setProperty(
            "visibility",
            "visible",
            "important"
        );


        container.style.setProperty(
            "opacity",
            "1",
            "important"
        );


        console.debug(
            "[GEN-Z.AI][Generate Form] Reset Seedance selesai. Layout dipertahankan."
        );


        return;

    }


    /* =====================================================
       MODEL NON-SEEDANCE
    ===================================================== */

    const uploads =
        container.querySelectorAll(
            ".generate-image-input, " +
            ".generate-audio-input"
        );


    for (
        const upload
        of uploads
    ) {

        if (
            typeof upload.clearUploadedFile ===
            "function"
        ) {

            try {

                await upload.clearUploadedFile();

            } catch (
                error
            ) {

                console.warn(
                    "[GEN-Z.AI][Generate Form] Reset upload gagal:",
                    error
                );

            }

        }

    }


    renderGenerateForm(
        modelArgument
    );

}


/* =========================================================
   FORM DISABLED
========================================================= */

export function setFormDisabled(
    disabled
) {

    const container =
        getContainer();


    if (
        !container
    ) {

        return;

    }


    container
        .querySelectorAll(
            "input, textarea, select, button"
        )
        .forEach(
            control => {

                control.disabled =
                    Boolean(
                        disabled
                    );

            }
        );

}


/* =========================================================
   MEDIA PARAMETERS
========================================================= */

export async function getMediaParameters(
    modelArgument = null
) {

    const data =
        await getFormParameters(
            modelArgument
        );


    return {

        image_urls:
            Array.isArray(
                data.image_urls
            )
                ? data.image_urls
                : (
                    data.image_url
                        ? normalizeArray(
                            data.image_url
                        )
                        : []
                ),

        audio_url:
            String(
                data.audio_url ||
                ""
            ).trim()

    };

}


/* =========================================================
   PARAMETER DEFINITION
========================================================= */

export function getParameterDefinition(
    name,
    modelArgument = null
) {

    if (
        isClientForbiddenParameter(
            name
        ) ||
        isInternalParameter(
            name
        ) ||
        isServerControlledParameter(
            name
        )
    ) {

        return null;

    }


    const definitions =
        getParameterDefinitions(
            modelArgument
        );


    return (
        definitions?.[name] ||
        null
    );

}


/* =========================================================
   INIT
========================================================= */

export function initGenerateForm(
    modelArgument = null
) {

    return renderGenerateForm(
        modelArgument
    );

}


/* =========================================================
   PUBLIC API
========================================================= */

export const generateForm =
    Object.freeze({

        render:
            renderGenerateForm,

        renderGenerateForm,

        init:
            initGenerateForm,

        getFormParameters,

        getFormData,

        setFieldValue,

        reset:
            resetDynamicFields,

        setDisabled:
            setFormDisabled,

        getMediaParameters,

        parameterDefinition:
            getParameterDefinition

    });


/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default generateForm;
