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
========================================================= */

"use strict";

/* =========================================================
   TEXT FIELD
========================================================= */

export function createTextField(definition = {}, name = "") {

    const input = document.createElement("input");

    input.type = "text";
    input.className = "form-input";

    input.dataset.parameter = name;

    if (definition.placeholder) {
        input.placeholder = String(
            definition.placeholder
        );
    }

    if (
        definition.default !== undefined &&
        definition.default !== null
    ) {
        input.value = String(
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
        input.maxLength = maxLength;
    }

    if (definition.required === true) {
        input.required = true;
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
        document.createElement("textarea");

    textarea.className = "form-textarea";

    textarea.dataset.parameter = name;

    if (definition.placeholder) {
        textarea.placeholder = String(
            definition.placeholder
        );
    }

    if (
        definition.default !== undefined &&
        definition.default !== null
    ) {
        textarea.value = String(
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
        textarea.maxLength = maxLength;
    }

    if (definition.required === true) {
        textarea.required = true;
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

    const input = document.createElement("input");

    input.type = "number";
    input.className = "form-input";

    input.dataset.parameter = name;

    if (
        definition.default !== undefined &&
        definition.default !== null
    ) {
        input.value = String(
            definition.default
        );
    }

    if (definition.min !== undefined) {
        input.min = String(
            definition.min
        );
    }

    if (definition.max !== undefined) {
        input.max = String(
            definition.max
        );
    }

    if (definition.step !== undefined) {
        input.step = String(
            definition.step
        );
    }

    if (definition.required === true) {
        input.required = true;
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
     * Duration menggunakan enum apabila tersedia.
     * Jangan membuat nilai sendiri.
     */

    if (
        Array.isArray(definition.enum) &&
        definition.enum.length
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
        document.createElement("label");

    wrapper.className =
        "form-checkbox";

    wrapper.dataset.parameter = name;

    const input =
        document.createElement("input");

    input.type = "checkbox";

    input.value = "true";

    if (
        definition.default === true
    ) {
        input.checked = true;
    }

    if (
        definition.required === true
    ) {
        input.required = true;
    }

    const text =
        document.createElement("span");

    text.textContent =
        definition.label ||
        definition.title ||
        name;

    wrapper.appendChild(input);
    wrapper.appendChild(text);

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
        document.createElement("select");

    select.className =
        "form-select";

    select.dataset.parameter = name;

    const options =
        Array.isArray(definition.options)
            ? definition.options
            : [];

    const defaultValue =
        definition.default !== undefined &&
        definition.default !== null
            ? String(definition.default)
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
            document.createElement("option");

        option.value =
            String(value);

        option.textContent =
            String(label);

        if (
            String(value) ===
            defaultValue
        ) {
            option.selected = true;
        }

        select.appendChild(option);
    }

    if (definition.required === true) {
        select.required = true;
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
        document.createElement("div");

    wrapper.className =
        "form-enum-group";

    wrapper.dataset.parameter =
        name;

    const values =
        Array.isArray(definition.enum)
            ? definition.enum
            : [];

    const defaultValue =
        definition.default !== undefined &&
        definition.default !== null
            ? String(definition.default)
            : "";

    values.forEach(
        (enumValue, index) => {

            if (
                enumValue === undefined ||
                enumValue === null
            ) {
                return;
            }

            /*
             * IMPORTANT:
             *
             * value HARUS mempertahankan nilai
             * asli dari definition.enum.
             *
             * Jangan mengubah:
             * 576P    -> 576
             * 720P HD -> 720
             *
             * Karena nilai inilah yang nanti dibaca
             * oleh getFormParameters().
             */

            const value =
                String(enumValue);

            const id =
                `parameter-${name}-${index}`;

            const label =
                document.createElement("label");

            label.className =
                "form-enum-option";

            label.htmlFor = id;

            const radio =
                document.createElement("input");

            radio.type = "radio";

            radio.id = id;

            radio.name =
                `parameter-${name}`;

            radio.value =
                value;

            radio.dataset.parameter =
                name;

            if (
                value === defaultValue
            ) {
                radio.checked = true;
                label.classList.add("active");
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

                    if (radio.checked) {
                        label.classList.add(
                            "active"
                        );
                    }
                }
            );

            const text =
                document.createElement("span");

            text.textContent =
                formatEnumLabel(value);

            label.appendChild(radio);
            label.appendChild(text);

            wrapper.appendChild(label);
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

    const text =
        String(value);

    /*
     * Hanya untuk tampilan.
     *
     * value radio TIDAK disentuh.
     */

    return text;
}


/* =========================================================
   FIELD DISPATCHER
========================================================= */

export function createFieldInput(
    name,
    definition = {}
) {

    const type =
        String(
            definition?.type || "string"
        )
            .trim()
            .toLowerCase();


    /* -----------------------------------------------------
       IMAGE
    ----------------------------------------------------- */

    if (
        name === "image_urls" ||
        name === "image_url"
    ) {

        return createImageField(
            definition,
            name
        );
    }


    /* -----------------------------------------------------
       AUDIO
    ----------------------------------------------------- */

    if (
        name === "audio_url"
    ) {

        return createAudioField(
            definition,
            name
        );
    }


    /* -----------------------------------------------------
       ENUM
    ----------------------------------------------------- */

    if (
        Array.isArray(definition?.enum) &&
        definition.enum.length
    ) {

        return createEnumField(
            name,
            definition
        );
    }


    /* -----------------------------------------------------
       OPTIONS
    ----------------------------------------------------- */

    if (
        Array.isArray(definition?.options) &&
        definition.options.length
    ) {

        return createSelectField(
            definition,
            name
        );
    }


    /* -----------------------------------------------------
       BOOLEAN
    ----------------------------------------------------- */

    if (
        type === "boolean"
    ) {

        return createBooleanField(
            definition,
            name
        );
    }


    /* -----------------------------------------------------
       DURATION
    ----------------------------------------------------- */

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


    /* -----------------------------------------------------
       NUMBER
    ----------------------------------------------------- */

    if (
        type === "number" ||
        type === "integer"
    ) {

        return createNumberField(
            definition,
            name
        );
    }


    /* -----------------------------------------------------
       TEXTAREA
    ----------------------------------------------------- */

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


    /* -----------------------------------------------------
       DEFAULT TEXT
    ----------------------------------------------------- */

    return createTextField(
        definition,
        name
    );
}


/* =========================================================
   IMAGE / AUDIO PLACEHOLDER
   ---------------------------------------------------------
   Untuk tahap refactor ini fungsi custom uploader tetap
   dipertahankan sebagai dependency dari generate-form.js.
   Jangan membuat implementasi baru di sini sebelum fungsi
   asli uploader dipindahkan.
========================================================= */

let imageFieldFactory = null;
let audioFieldFactory = null;


export function registerImageFieldFactory(
    factory
) {

    if (
        typeof factory !== "function"
    ) {
        throw new TypeError(
            "Image field factory must be a function"
        );
    }

    imageFieldFactory =
        factory;
}


export function registerAudioFieldFactory(
    factory
) {

    if (
        typeof factory !== "function"
    ) {
        throw new TypeError(
            "Audio field factory must be a function"
        );
    }

    audioFieldFactory =
        factory;
}


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
