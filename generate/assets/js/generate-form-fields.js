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
   ---------------------------------------------------------
   Implementasi Image / Audio disediakan oleh
   generate-form-media.js.

   File ini hanya mengetahui kontrak factory.
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
   ---------------------------------------------------------
   Dispatcher menuju factory yang sudah diregistrasikan.
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
   ---------------------------------------------------------
   Dispatcher menuju factory yang sudah diregistrasikan.
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
        definition.placeholder
    ) {

        input.placeholder =
            String(
                definition.placeholder
            );
    }

    if (
        definition.default !== undefined &&
        definition.default !== null
    ) {

        input.value =
            String(
                definition.default
            );
    }

    const maxLength =
        Number(
            definition.maxLength ??
            definition.max_length
        );

    if (
        Number.isFinite(maxLength) &&
        maxLength > 0
    ) {

        input.maxLength =
            maxLength;
    }

    if (
        definition.required === true
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
        definition.placeholder
    ) {

        textarea.placeholder =
            String(
                definition.placeholder
            );
    }

    if (
        definition.default !== undefined &&
        definition.default !== null
    ) {

        textarea.value =
            String(
                definition.default
            );
    }

    const maxLength =
        Number(
            definition.maxLength ??
            definition.max_length
        );

    if (
        Number.isFinite(maxLength) &&
        maxLength > 0
    ) {

        textarea.maxLength =
            maxLength;
    }

    if (
        definition.required === true
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

    if (
        definition.default !== undefined &&
        definition.default !== null
    ) {

        input.value =
            String(
                definition.default
            );
    }

    if (
        definition.min !== undefined
    ) {

        input.min =
            String(
                definition.min
            );
    }

    if (
        definition.max !== undefined
    ) {

        input.max =
            String(
                definition.max
            );
    }

    if (
        definition.step !== undefined
    ) {

        input.step =
            String(
                definition.step
            );
    }

    if (
        definition.required === true
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
     * Duration menggunakan enum apabila provider
     * menyediakan enum.
     *
     * Jangan membuat nilai duration sendiri.
     * Nilai harus tetap mengikuti definition.
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

    if (
        definition.default === true
    ) {

        input.checked =
            true;
    }

    if (
        definition.required === true
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
        definition.default !== undefined &&
        definition.default !== null
            ? String(
                definition.default
            )
            : "";

    for (
        const optionDefinition of options
    ) {

        let value;
        let label;

        if (
            typeof optionDefinition ===
                "object" &&
            optionDefinition !== null
        ) {

            value =
                optionDefinition.value ??
                optionDefinition.id ??
                optionDefinition.name;

            label =
                optionDefinition.label ??
                optionDefinition.name ??
                value;

        } else {

            value =
                optionDefinition;

            label =
                optionDefinition;
        }

        if (
            value === undefined ||
            value === null
        ) {

            continue;
        }

        const option =
            document.createElement(
                "option"
            );

        option.value =
            String(
                value
            );

        option.textContent =
            String(
                label
            );

        if (
            String(value) ===
            defaultValue
        ) {

            option.selected =
                true;
        }

        select.appendChild(
            option
        );
    }

    if (
        definition.required === true
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
        definition.default !== undefined &&
        definition.default !== null
            ? String(
                definition.default
            )
            : "";

    values.forEach(
        (
            enumValue,
            index
        ) => {

            if (
                enumValue === undefined ||
                enumValue === null
            ) {

                return;
            }

            /*
             * IMPORTANT
             *
             * Nilai radio harus mempertahankan
             * nilai asli dari definition.enum.
             *
             * Contoh:
             *
             * 576P
             * 720P HD
             * 1080P
             *
             * Jangan mengubahnya menjadi:
             *
             * 576
             * 720
             * 1080
             *
             * Label hanya untuk tampilan.
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
                value === defaultValue
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
        value === undefined ||
        value === null
    ) {

        return "";
    }

    /*
     * Formatter hanya mempengaruhi
     * tampilan label.
     *
     * Nilai parameter tidak disentuh.
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
   ---------------------------------------------------------
   Menentukan factory field berdasarkan parameter.
========================================================= */

export function createFieldInput(
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
            Number.isFinite(maxLength) &&
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
   ---------------------------------------------------------
   Tidak wajib digunakan.
   Named exports tetap menjadi API utama.
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
