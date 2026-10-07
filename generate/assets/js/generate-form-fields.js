/* =========================================================
   GEN-Z.AI
   GENERATE FORM
   ---------------------------------------------------------
   File:
   generate/assets/js/generate-form-fields.js

   Fungsi:
   - Membuat field input dinamis
   - Text
   - Textarea
   - Number
   - Duration
   - Boolean
   - Select
   - Enum / Radio
   - Image
   - Audio

   Catatan:
   - Tidak menangani state
   - Tidak menangani submit
   - Tidak menangani API
   - Tidak menangani credit
   - Tidak mengubah nilai parameter
   - Image / Audio menggunakan factory registry
========================================================= */

"use strict";


/* =========================================================
   IMAGE / AUDIO FACTORY REGISTRY
========================================================= */

let imageFieldFactory = null;

let audioFieldFactory = null;


/* =========================================================
   REGISTER IMAGE FIELD FACTORY
========================================================= */

export function registerImageFieldFactory(
    factory
) {

    if (
        typeof factory !==
        "function"
    ) {

        throw new TypeError(
            "Image field factory must be a function"
        );

    }

    imageFieldFactory =
        factory;

}


/* =========================================================
   REGISTER AUDIO FIELD FACTORY
========================================================= */

export function registerAudioFieldFactory(
    factory
) {

    if (
        typeof factory !==
        "function"
    ) {

        throw new TypeError(
            "Audio field factory must be a function"
        );

    }

    audioFieldFactory =
        factory;

}


/* =========================================================
   IMAGE FIELD
========================================================= */

export function createImageField(
    definition = {},
    name = "image_urls"
) {

    if (
        typeof imageFieldFactory !==
        "function"
    ) {

        throw new Error(
            "Image field factory is not registered"
        );

    }

    return imageFieldFactory(
        definition,
        name
    );

}


/* =========================================================
   AUDIO FIELD
========================================================= */

export function createAudioField(
    definition = {},
    name = "audio_url"
) {

    if (
        typeof audioFieldFactory !==
        "function"
    ) {

        throw new Error(
            "Audio field factory is not registered"
        );

    }

    return audioFieldFactory(
        definition,
        name
    );

}


/* =========================================================
   DEFAULT VALUE HELPER
   ---------------------------------------------------------
   Hanya membaca definition.
   Tidak menghitung / mengubah nilai.
========================================================= */

function resolveFieldDefault(
    definition = {}
) {

    if (
        definition.default !==
            undefined &&
        definition.default !==
            null
    ) {

        return definition.default;

    }

    if (
        definition.default_value !==
            undefined &&
        definition.default_value !==
            null
    ) {

        return definition.default_value;

    }

    return undefined;

}


/* =========================================================
   TEXT FIELD
========================================================= */

export function createTextField(
    definition = {},
    name = ""
) {

    const input =
        document.createElement(
            "input"
        );


    input.type =
        "text";


    input.className =
        "form-input";


    input.dataset.parameter =
        name;


    if (
        definition.placeholder !==
            undefined &&
        definition.placeholder !==
            null
    ) {

        input.placeholder =
            String(
                definition.placeholder
            );

    }


    const defaultValue =
        resolveFieldDefault(
            definition
        );


    if (
        defaultValue !==
            undefined
    ) {

        input.value =
            String(
                defaultValue
            );

    }


    const maxLength =
        Number(
            definition.maxLength ??
            definition.max_length
        );


    if (
        Number.isFinite(
            maxLength
        ) &&
        maxLength > 0
    ) {

        input.maxLength =
            maxLength;

    }


    if (
        definition.required ===
        true
    ) {

        input.required =
            true;

    }


    return input;

}


/* =========================================================
   TEXTAREA FIELD
========================================================= */

export function createTextareaField(
    definition = {},
    name = ""
) {

    const textarea =
        document.createElement(
            "textarea"
        );


    textarea.className =
        "form-textarea";


    textarea.dataset.parameter =
        name;


    if (
        definition.placeholder !==
            undefined &&
        definition.placeholder !==
            null
    ) {

        textarea.placeholder =
            String(
                definition.placeholder
            );

    }


    const defaultValue =
        resolveFieldDefault(
            definition
        );


    if (
        defaultValue !==
            undefined
    ) {

        textarea.value =
            String(
                defaultValue
            );

    }


    const maxLength =
        Number(
            definition.maxLength ??
            definition.max_length
        );


    if (
        Number.isFinite(
            maxLength
        ) &&
        maxLength > 0
    ) {

        textarea.maxLength =
            maxLength;

    }


    if (
        definition.required ===
        true
    ) {

        textarea.required =
            true;

    }


    return textarea;

}


/* =========================================================
   NUMBER FIELD
========================================================= */

export function createNumberField(
    definition = {},
    name = ""
) {

    const input =
        document.createElement(
            "input"
        );


    input.type =
        "number";


    input.className =
        "form-input";


    input.dataset.parameter =
        name;


    const defaultValue =
        resolveFieldDefault(
            definition
        );


    if (
        defaultValue !==
            undefined
    ) {

        input.value =
            String(
                defaultValue
            );

    }


    if (
        definition.min !==
            undefined &&
        definition.min !==
            null
    ) {

        input.min =
            String(
                definition.min
            );

    }


    if (
        definition.max !==
            undefined &&
        definition.max !==
            null
    ) {

        input.max =
            String(
                definition.max
            );

    }


    if (
        definition.step !==
            undefined &&
        definition.step !==
            null
    ) {

        input.step =
            String(
                definition.step
            );

    }


    if (
        definition.required ===
        true
    ) {

        input.required =
            true;

    }


    return input;

}


/* =========================================================
   DURATION FIELD
========================================================= */

export function createDurationField(
    definition = {},
    name = "duration"
) {

    /*
     * Jika provider memberikan enum,
     * gunakan enum asli provider.
     */

    if (
        Array.isArray(
            definition.enum
        ) &&
        definition.enum.length > 0
    ) {

        return createEnumField(
            name,
            definition
        );

    }


    return createNumberField(
        definition,
        name
    );

}


/* =========================================================
   BOOLEAN FIELD
========================================================= */

export function createBooleanField(
    definition = {},
    name = ""
) {

    const wrapper =
        document.createElement(
            "label"
        );


    wrapper.className =
        "form-checkbox";


    wrapper.dataset.parameter =
        name;


    const input =
        document.createElement(
            "input"
        );


    input.type =
        "checkbox";


    input.value =
        "true";


    input.dataset.parameter =
        name;


    const defaultValue =
        resolveFieldDefault(
            definition
        );


    /*
     * Boolean hanya dianggap checked
     * jika nilai default memang true.
     */

    input.checked =
        defaultValue === true;


    if (
        definition.required ===
        true
    ) {

        input.required =
            true;

    }


    const text =
        document.createElement(
            "span"
        );


    text.textContent =
        definition.label ||
        definition.title ||
        name;


    wrapper.appendChild(
        input
    );


    wrapper.appendChild(
        text
    );


    return wrapper;

}


/* =========================================================
   SELECT OPTION NORMALIZER
========================================================= */

function resolveSelectOption(
    optionDefinition
) {

    if (
        optionDefinition ===
            undefined ||
        optionDefinition ===
            null
    ) {

        return null;

    }


    if (
        typeof optionDefinition ===
        "object"
    ) {

        const value =
            optionDefinition.value ??
            optionDefinition.id ??
            optionDefinition.name;


        if (
            value ===
                undefined ||
            value ===
                null
        ) {

            return null;

        }


        const label =
            optionDefinition.label ??
            optionDefinition.name ??
            value;


        return {

            value:
                String(
                    value
                ),

            label:
                String(
                    label
                )

        };

    }


    return {

        value:
            String(
                optionDefinition
            ),

        label:
            String(
                optionDefinition
            )

    };

}


/* =========================================================
   SELECT FIELD
========================================================= */

export function createSelectField(
    definition = {},
    name = ""
) {

    const select =
        document.createElement(
            "select"
        );


    select.className =
        "form-select";


    select.dataset.parameter =
        name;


    const options =
        Array.isArray(
            definition.options
        )
            ? definition.options
            : [];


    const defaultValue =
        resolveFieldDefault(
            definition
        );


    const defaultString =
        defaultValue !==
            undefined &&
        defaultValue !==
            null
            ? String(
                defaultValue
            )
            : "";


    for (
        const optionDefinition
        of options
    ) {

        const optionData =
            resolveSelectOption(
                optionDefinition
            );


        if (
            !optionData
        ) {

            continue;

        }


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
            defaultString
        ) {

            option.selected =
                true;

        }


        select.appendChild(
            option
        );

    }


    if (
        definition.required ===
        true
    ) {

        select.required =
            true;

    }


    return select;

}


/* =========================================================
   ENUM / RADIO FIELD
========================================================= */

export function createEnumField(
    name,
    definition = {}
) {

    const wrapper =
        document.createElement(
            "div"
        );


    wrapper.className =
        "form-enum-group";


    wrapper.dataset.parameter =
        name;


    const values =
        Array.isArray(
            definition.enum
        )
            ? definition.enum
            : [];


    const defaultValue =
        resolveFieldDefault(
            definition
        );


    const defaultString =
        defaultValue !==
            undefined &&
        defaultValue !==
            null
            ? String(
                defaultValue
            )
            : "";


    values.forEach(
        (
            enumValue,
            index
        ) => {

            if (
                enumValue ===
                    undefined ||
                enumValue ===
                    null
            ) {

                return;

            }


            /*
             * Nilai parameter HARUS tetap sama
             * dengan definition.enum.
             *
             * Formatter hanya berlaku untuk
             * text label.
             */

            const value =
                String(
                    enumValue
                );


            const id =
                `parameter-${name}-${index}`;


            const label =
                document.createElement(
                    "label"
                );


            label.className =
                "form-enum-option";


            label.htmlFor =
                id;


            const radio =
                document.createElement(
                    "input"
                );


            radio.type =
                "radio";


            radio.id =
                id;


            radio.name =
                `parameter-${name}`;


            radio.value =
                value;


            radio.dataset.parameter =
                name;


            if (
                value ===
                defaultString
            ) {

                radio.checked =
                    true;


                label.classList.add(
                    "active"
                );

            }


            radio.addEventListener(
                "change",
                () => {

                    wrapper
                        .querySelectorAll(
                            ".form-enum-option"
                        )
                        .forEach(
                            option => {

                                option.classList.remove(
                                    "active"
                                );

                            }
                        );


                    if (
                        radio.checked
                    ) {

                        label.classList.add(
                            "active"
                        );

                    }

                }
            );


            const text =
                document.createElement(
                    "span"
                );


            text.textContent =
                formatEnumLabel(
                    value
                );


            label.appendChild(
                radio
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
   ENUM LABEL FORMATTER
========================================================= */

export function formatEnumLabel(
    value
) {

    if (
        value ===
            undefined ||
        value ===
            null
    ) {

        return "";

    }


    /*
     * Jangan mengubah nilai.
     * Label hanya menampilkan nilai asli.
     */

    return String(
        value
    );

}


/* =========================================================
   IMAGE TYPE DETECTOR
========================================================= */

function isImageField(
    name,
    definition = {}
) {

    const normalizedName =
        String(
            name || ""
        )
            .trim()
            .toLowerCase();


    const type =
        String(
            definition?.type || ""
        )
            .trim()
            .toLowerCase();


    return (
        normalizedName ===
            "image_urls" ||

        normalizedName ===
            "image_url" ||

        type ===
            "image" ||

        type ===
            "image_url" ||

        type ===
            "image_urls"
    );

}


/* =========================================================
   AUDIO TYPE DETECTOR
========================================================= */

function isAudioField(
    name,
    definition = {}
) {

    const normalizedName =
        String(
            name || ""
        )
            .trim()
            .toLowerCase();


    const type =
        String(
            definition?.type || ""
        )
            .trim()
            .toLowerCase();


    return (
        normalizedName ===
            "audio_url" ||

        type ===
            "audio" ||

        type ===
            "audio_url"
    );

}


/* =========================================================
   FIELD DISPATCHER
========================================================= */

export function createFieldInput(
    name,
    definition = {}
) {

    const normalizedName =
        String(
            name || ""
        )
            .trim()
            .toLowerCase();


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
        isImageField(
            name,
            definition
        )
    ) {

        return createImageField(
            definition,
            name
        );

    }


    /* =====================================================
       AUDIO
    ===================================================== */

    if (
        isAudioField(
            name,
            definition
        )
    ) {

        return createAudioField(
            definition,
            name
        );

    }


    /* =====================================================
       ENUM
       -----------------------------------------------------
       Enum harus diprioritaskan sebelum generic type.
    ===================================================== */

    if (
        Array.isArray(
            definition?.enum
        ) &&
        definition.enum.length > 0
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
        definition.options.length > 0
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
        type ===
            "boolean"
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
        normalizedName ===
            "duration" &&
        (
            type ===
                "number" ||
            type ===
                "integer"
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
        type ===
            "number" ||
        type ===
            "integer"
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
        normalizedName ===
            "prompt" ||

        normalizedName ===
            "description" ||

        normalizedName ===
            "negative_prompt" ||

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
   DEFAULT EXPORT
========================================================= */

export default Object.freeze({

    createTextField,

    createTextareaField,

    createNumberField,

    createDurationField,

    createBooleanField,

    createSelectField,

    createEnumField,

    formatEnumLabel,

    createFieldInput,

    registerImageFieldFactory,

    registerAudioFieldFactory,

    createImageField,

    createAudioField

});
