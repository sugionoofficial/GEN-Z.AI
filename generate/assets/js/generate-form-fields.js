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
   - Video

   Catatan:
   - Tidak menangani state
   - Tidak menangani submit
   - Tidak menangani API
   - Tidak menangani credit
   - Tidak mengubah nilai parameter
   - Image / Audio / Video menggunakan factory registry
========================================================= */

"use strict";


/* =========================================================
   IMAGE / AUDIO / VIDEO FACTORY REGISTRY
========================================================= */

let imageFieldFactory = null;

let audioFieldFactory = null;

let videoFieldFactory = null;


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
   REGISTER VIDEO FIELD FACTORY
========================================================= */

export function registerVideoFieldFactory(
    factory
) {

    if (
        typeof factory !==
        "function"
    ) {

        throw new TypeError(
            "Video field factory must be a function"
        );

    }

    videoFieldFactory =
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
   VIDEO FIELD
========================================================= */

export function createVideoField(
    definition = {},
    name = "video_urls"
) {

    if (
        typeof videoFieldFactory !==
        "function"
    ) {

        throw new Error(
            "Video field factory is not registered"
        );

    }

    return videoFieldFactory(
        definition,
        name
    );

}


/* =========================================================
   DEFAULT VALUE HELPER
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


    const min =
        Number(
            definition.min
        );

    const max =
        Number(
            definition.max
        );


    if (
        !Number.isFinite(min) ||
        !Number.isFinite(max) ||
        max <= min
    ) {

        return createNumberField(
            definition,
            name
        );

    }


    const step =
        Number(
            definition.step
        );

    const resolvedStep =
        Number.isFinite(step) &&
        step > 0
            ? step
            : 1;


    const defaultValue =
        resolveFieldDefault(
            definition
        );

    let initial =
        Number(
            defaultValue
        );

    if (
        !Number.isFinite(initial)
    ) {

        initial =
            min;

    }


    if (
        initial < min
    ) {

        initial =
            min;

    }

    if (
        initial > max
    ) {

        initial =
            max;

    }


    const wrapper =
        document.createElement(
            "div"
        );

    wrapper.className =
        "generate-duration-field";

    wrapper.dataset.parameter =
        name;


    const valueRow =
        document.createElement(
            "div"
        );

    valueRow.className =
        "generate-duration-value-row";

    valueRow.style.cssText =
        [
            "display:flex",
            "align-items:center",
            "justify-content:space-between",
            "gap:12px",
            "margin-bottom:4px"
        ].join(";");


    const valueLabel =
        document.createElement(
            "span"
        );

    valueLabel.className =
        "generate-duration-value-label";

    valueLabel.style.cssText =
        [
            "font-size:13px",
            "font-weight:700",
            "letter-spacing:0.02em",
            "color:rgba(255,255,255,0.72)"
        ].join(";");

    valueLabel.textContent =
        "Durasi";


    const valueDisplay =
        document.createElement(
            "span"
        );

    valueDisplay.className =
        "generate-duration-value";

    valueDisplay.style.cssText =
        [
            "font-size:14px",
            "font-weight:800",
            "color:var(--gz-lime, #b7ff00)",
            "min-width:52px",
            "text-align:right"
        ].join(";");

    valueDisplay.textContent =
        `${initial}s`;


    valueRow.appendChild(
        valueLabel
    );

    valueRow.appendChild(
        valueDisplay
    );


    const input =
        document.createElement(
            "input"
        );

    input.type =
        "range";

    input.className =
        "generate-duration-range form-input";

    input.dataset.parameter =
        name;

    input.min =
        String(
            min
        );

    input.max =
        String(
            max
        );

    input.step =
        String(
            resolvedStep
        );

    input.value =
        String(
            initial
        );


    if (
        definition.required ===
        true
    ) {

        input.required =
            true;

    }


    const metaRow =
        document.createElement(
            "div"
        );

    metaRow.className =
        "generate-duration-meta";

    metaRow.style.cssText =
        [
            "display:flex",
            "align-items:center",
            "justify-content:space-between",
            "gap:12px",
            "margin-top:6px",
            "font-size:11px",
            "font-weight:600",
            "letter-spacing:0.04em",
            "color:rgba(255,255,255,0.42)",
            "text-transform:uppercase"
        ].join(";");


    const minLabel =
        document.createElement(
            "span"
        );

    minLabel.textContent =
        `${min}s`;


    const maxLabel =
        document.createElement(
            "span"
        );

    maxLabel.textContent =
        `${max}s`;


    metaRow.appendChild(
        minLabel
    );

    metaRow.appendChild(
        maxLabel
    );


    input.addEventListener(
        "input",
        () => {

            valueDisplay.textContent =
                `${input.value}s`;

        }
    );


    wrapper.appendChild(
        valueRow
    );

    wrapper.appendChild(
        input
    );

    wrapper.appendChild(
        metaRow
    );


    return wrapper;

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
   CHECKBOX GROUP FIELD (PILIHAN SISTEM)
   ---------------------------------------------------------
   Dipakai oleh parameter bertype `checkbox_group`, mis.
   "Deskripsi Musik / Lagu AI" pada model opus-audio-music.

   - `definition.groups`: [{ id, label, options: [{value,label,text}] }]
   - `definition.default`: array value yang tercentang awal
   - `definition.allowNote`: sediakan catatan tambahan opsional
   - Nilai akhir dibaca oleh generate-form-reader.js yang menyusun
     deskripsi musikal aman lewat composeMusicDescription().
========================================================= */

export function createCheckboxGroupField(
    definition = {},
    name = ""
) {

    const wrapper =
        document.createElement(
            "div"
        );


    wrapper.className =
        "generate-checkbox-group";


    wrapper.dataset.parameter =
        name;


    /* Samakan dengan createFieldId() agar label field tetap terasosiasi. */
    wrapper.id =
        "generate-field-" +
        String(
            name
        ).replace(
            /[^a-zA-Z0-9_-]/g,
            "-"
        );


    const rawDefault =
        resolveFieldDefault(
            definition
        );


    const defaults =
        new Set(
            (
                Array.isArray(
                    rawDefault
                )
                    ? rawDefault
                    : []
            )
                .map(
                    item =>
                        String(
                            item ??
                                ""
                        ).trim()
                )
                .filter(
                    Boolean
                )
        );


    let countLabel = null;


    const updateCount = () => {

        const total =
            wrapper.querySelectorAll(
                'input[type="checkbox"][data-preset-value]:checked'
            ).length;


        if (
            countLabel
        ) {

            countLabel.textContent =
                total +
                " pilihan aktif";

        }

    };


    /* -----------------------------------------------------
       TOOLBAR
    ----------------------------------------------------- */

    const toolbar =
        document.createElement(
            "div"
        );


    toolbar.className =
        "generate-checkbox-group__toolbar";


    countLabel =
        document.createElement(
            "span"
        );


    countLabel.className =
        "generate-checkbox-group__count";


    toolbar.appendChild(
        countLabel
    );


    const resetButton =
        document.createElement(
            "button"
        );


    resetButton.type =
        "button";


    resetButton.className =
        "generate-checkbox-group__reset";


    resetButton.textContent =
        "Pakai rekomendasi sistem";


    resetButton.addEventListener(
        "click",
        () => {

            wrapper
                .querySelectorAll(
                    'input[type="checkbox"][data-preset-value]'
                )
                .forEach(
                    input => {

                        input.checked =
                            defaults.has(
                                String(
                                    input.dataset.presetValue ||
                                        ""
                                )
                            );

                    }
                );


            const noteInput =
                wrapper.querySelector(
                    ".generate-checkbox-group__note"
                );


            if (
                noteInput
            ) {

                noteInput.value =
                    "";

            }


            updateCount();

        }
    );


    toolbar.appendChild(
        resetButton
    );


    wrapper.appendChild(
        toolbar
    );


    /* -----------------------------------------------------
       GROUPS
    ----------------------------------------------------- */

    const groups =
        Array.isArray(
            definition.groups
        )
            ? definition.groups
            : [];


    groups.forEach(
        group => {

            const options =
                Array.isArray(
                    group?.options
                )
                    ? group.options
                    : [];


            if (
                options.length ===
                0
            ) {

                return;

            }


            const section =
                document.createElement(
                    "fieldset"
                );


            section.className =
                "generate-checkbox-group__group";


            const legend =
                document.createElement(
                    "legend"
                );


            legend.className =
                "generate-checkbox-group__legend";


            legend.textContent =
                String(
                    group?.label ||
                        ""
                ).trim() ||
                "Pilihan";


            section.appendChild(
                legend
            );


            const grid =
                document.createElement(
                    "div"
                );


            grid.className =
                "generate-checkbox-group__options";


            options.forEach(
                option => {

                    const value =
                        String(
                            option?.value ??
                                ""
                        ).trim();


                    const text =
                        String(
                            option?.text ??
                                ""
                        ).trim();


                    if (
                        !value ||
                        !text
                    ) {

                        return;

                    }


                    const label =
                        document.createElement(
                            "label"
                        );


                    label.className =
                        "generate-checkbox-option";


                    const input =
                        document.createElement(
                            "input"
                        );


                    input.type =
                        "checkbox";


                    input.value =
                        value;


                    input.dataset.parameter =
                        name;


                    input.dataset.presetValue =
                        value;


                    input.dataset.presetText =
                        text;


                    input.checked =
                        defaults.has(
                            value
                        );


                    const caption =
                        document.createElement(
                            "span"
                        );


                    caption.textContent =
                        String(
                            option?.label ??
                                value
                        );


                    label.appendChild(
                        input
                    );


                    label.appendChild(
                        caption
                    );


                    grid.appendChild(
                        label
                    );

                }
            );


            section.appendChild(
                grid
            );


            wrapper.appendChild(
                section
            );

        }
    );


    /* -----------------------------------------------------
       CATATAN TAMBAHAN (OPSIONAL)
    ----------------------------------------------------- */

    if (
        definition.allowNote ===
        true
    ) {

        const noteWrap =
            document.createElement(
                "div"
            );


        noteWrap.className =
            "generate-checkbox-group__note-wrap";


        const note =
            document.createElement(
                "textarea"
            );


        note.className =
            "generate-checkbox-group__note";


        note.dataset.parameter =
            name;


        note.rows =
            2;


        note.placeholder =
            String(
                definition.notePlaceholder ||
                    ""
            );


        const noteMax =
            Number(
                definition.noteMaxLength
            );


        if (
            Number.isFinite(
                noteMax
            ) &&
            noteMax > 0
        ) {

            note.maxLength =
                noteMax;

        }


        noteWrap.appendChild(
            note
        );


        wrapper.appendChild(
            noteWrap
        );

    }


    wrapper.addEventListener(
        "change",
        updateCount
    );


    updateCount();


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
                    value,
                    name
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
    value,
    name = ""
) {

    if (
        value ===
            undefined ||
        value ===
            null
    ) {

        return "";

    }

    const raw =
        String(
            value
        );

    if (
        String(name || "")
            .trim()
            .toLowerCase() ===
            "duration" &&
        /^\d+$/.test(
            raw.trim()
        )
    ) {

        return `${raw.trim()}s`;

    }


    return raw;

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
   VIDEO TYPE DETECTOR
========================================================= */

function isVideoField(
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
            "video_urls" ||

        normalizedName ===
            "video_url" ||

        type ===
            "video" ||

        type ===
            "video_url" ||

        type ===
            "video_urls"
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
       VIDEO
    ===================================================== */

    if (
        isVideoField(
            name,
            definition
        )
    ) {

        return createVideoField(
            definition,
            name
        );

    }


    /* =====================================================
       CHECKBOX GROUP (PILIHAN SISTEM)
    ===================================================== */

    if (
        type ===
            "checkbox_group" &&
        Array.isArray(
            definition?.groups
        ) &&
        definition.groups.length > 0
    ) {

        return createCheckboxGroupField(
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

    createCheckboxGroupField,

    createSelectField,

    createEnumField,

    formatEnumLabel,

    createFieldInput,

    registerImageFieldFactory,

    registerAudioFieldFactory,

    registerVideoFieldFactory,

    createImageField,

    createAudioField,

    createVideoField

});
