/* =========================================================
   GEN-Z.AI
   GENERATE FORM RENDERER
   ---------------------------------------------------------
   File:
   generate/assets/js/generate-form-render.js

   Tanggung jawab:
   - Membuat wrapper field
   - Menentukan layout field
   - Render parameter model
   - Render seluruh dynamic form
   - Menjaga visibility/layout container
   - Mencari field
   - Membaca nilai field
   - Normalisasi nilai primitive

   Catatan:
   - Tidak menangani upload
   - Tidak menangani submit
   - Tidak menangani credit
   - Tidak menangani reset
========================================================= */

"use strict";


/* =========================================================
   CORE
========================================================= */

import {
    getContainer,
    resolveModel,
    getParameterDefinitions,
    getOrderedParameterNames,
    getParameterLabel,
    getParameterDescription,
    isRenderableParameter,
    createFieldId
} from "./generate-form-core.js";


/* =========================================================
   FIELD FACTORY
========================================================= */

import {
    createFieldInput
} from "./generate-form-fields.js";


/* =========================================================
   CREATE FIELD
========================================================= */

export function createField(
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


    wrapper.style.width =
        "100%";


    wrapper.style.minWidth =
        "0";


    wrapper.style.maxWidth =
        "100%";


    wrapper.style.boxSizing =
        "border-box";


    const normalizedName =
        String(
            name ||
            ""
        )
            .trim()
            .toLowerCase();


    const fullWidth =
        normalizedName ===
            "image_urls" ||
        normalizedName ===
            "image_url" ||
        normalizedName ===
            "audio_url" ||
        normalizedName ===
            "prompt" ||
        normalizedName ===
            "negative_prompt" ||
        normalizedName ===
            "description";


    wrapper.style.gridColumn =
        fullWidth
            ? "1 / -1"
            : "span 1";


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

export function appendDescription(
    wrapper,
    definition = {}
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
   RENDER PARAMETER
========================================================= */

export function renderParameter(
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


    if (
        String(
            name ||
            ""
        )
            .trim()
            .toLowerCase() !==
        "duration"
    ) {

        appendDescription(
            wrapper,
            definition
        );

    }


    return wrapper;

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


    console.log(
        "[GEN-Z.AI][Generate Form] MODEL:",
        model.model_id ||
        model.id ||
        "-"
    );


    console.log(
        "[GEN-Z.AI][Generate Form] PARAMETER NAMES:",
        names
    );


    if (
        names.length ===
        0
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


    console.log(
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


    return renderedCount >
        0;

}


/* =========================================================
   FORCE CONTAINER VISIBLE
========================================================= */

export function forceContainerVisible(
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
                parameter ===
                    "prompt" ||
                parameter ===
                    "negative_prompt" ||
                parameter ===
                    "description" ||
                parameter ===
                    "image_urls" ||
                parameter ===
                    "image_url" ||
                parameter ===
                    "audio_url";


            if (
                mobile
            ) {

                field.style.setProperty(
                    "grid-column",
                    "1 / -1",
                    "important"
                );

            }

            else if (
                fullWidth
            ) {

                field.style.setProperty(
                    "grid-column",
                    "1 / -1",
                    "important"
                );

            }

            else {

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
   FIND FIELD
========================================================= */

export function findField(
    name
) {

    const container =
        getContainer();


    if (
        !container
    ) {

        return null;

    }


    const escaped =
        typeof CSS !==
            "undefined" &&
        typeof CSS.escape ===
            "function"

            ? CSS.escape(
                name
            )

            : String(
                name
            )
                .replace(
                    /"/g,
                    '\\"'
                );


    return (
        container.querySelector(
            `[data-parameter="${escaped}"]`
        ) ||
        null
    );

}


/* =========================================================
   READ FIELD
========================================================= */

export function readFieldValue(
    field
) {

    if (
        !field
    ) {

        return undefined;

    }


    const imageInput =
        field.querySelector(
            ".generate-image-input"
        );


    if (
        imageInput
    ) {

        const mode =
            typeof imageInput.getInputMode ===
            "function"

                ? imageInput.getInputMode()

                : (
                    imageInput.dataset.imageMode ||
                    "url"
                );


        if (
            mode ===
            "upload"
        ) {

            return (
                typeof imageInput.getUploadedUrl ===
                "function"

                    ? imageInput.getUploadedUrl()

                    : String(
                        imageInput.dataset.uploadedUrl ||
                        ""
                    ).trim()
            );

        }


        const urlInput =
            typeof imageInput.getUrlInput ===
            "function"

                ? imageInput.getUrlInput()

                : field.querySelector(
                    'input[type="url"]'
                );


        return String(
            urlInput?.value ||
            ""
        ).trim();

    }


    const audioInput =
        field.querySelector(
            ".generate-audio-input"
        );


    if (
        audioInput
    ) {

        const mode =
            typeof audioInput.getInputMode ===
            "function"

                ? audioInput.getInputMode()

                : (
                    audioInput.dataset.audioMode ||
                    "url"
                );


        if (
            mode ===
            "upload"
        ) {

            return (
                typeof audioInput.getUploadedUrl ===
                "function"

                    ? audioInput.getUploadedUrl()

                    : String(
                        audioInput.dataset.uploadedUrl ||
                        ""
                    ).trim()
            );

        }


        const urlInput =
            typeof audioInput.getUrlInput ===
            "function"

                ? audioInput.getUrlInput()

                : field.querySelector(
                    'input[type="url"]'
                );


        return String(
            urlInput?.value ||
            ""
        ).trim();

    }


    const radio =
        field.querySelector(
            'input[type="radio"]:checked'
        );


    if (
        radio
    ) {

        return radio.value;

    }


    const checkbox =
        field.querySelector(
            'input[type="checkbox"]'
        );


    if (
        checkbox
    ) {

        return checkbox.checked;

    }


    const input =
        field.querySelector(
            "input, textarea, select"
        );


    if (
        !input
    ) {

        return undefined;

    }


    return input.value;

}


/* =========================================================
   NORMALIZE VALUE
========================================================= */

export function normalizeParameterValue(
    name,
    value,
    definition
) {

    const type =
        String(
            definition?.type ||
            ""
        )
            .trim()
            .toLowerCase();


    if (
        name ===
            "image_urls" ||
        name ===
            "image_url"
    ) {

        if (
            Array.isArray(
                value
            )
        ) {

            return value;

        }


        return String(
            value ||
            ""
        )
            .split(",")
            .map(
                item =>
                    item.trim()
            )
            .filter(Boolean);

    }


    if (
        name ===
        "audio_url"
    ) {

        return String(
            value ||
            ""
        ).trim();

    }


    if (
        type ===
        "boolean"
    ) {

        return Boolean(
            value
        );

    }


    if (
        type ===
            "number" ||
        type ===
            "integer"
    ) {

        const number =
            Number(
                value
            );


        if (
            !Number.isFinite(
                number
            )
        ) {

            return value;

        }


        return (
            type ===
            "integer"
        )

            ? Math.round(
                number
            )

            : number;

    }


    return value;

}
