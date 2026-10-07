/* =========================================================
   GEN-Z.AI
   GENERATE FORM RENDER MODULE
   ---------------------------------------------------------
   File:
   generate/assets/js/generate-form-render.js

   Tanggung jawab:
   - Membuat wrapper field
   - Menampilkan label
   - Menampilkan description
   - Render parameter
   - Render seluruh dynamic form
   - Mengatur visibility / grid layout
   - Tidak menangani upload
   - Tidak menangani submit
   - Tidak menangani collection parameter
========================================================= */

"use strict";


/* =========================================================
   CORE
========================================================= */

import {
    FULL_WIDTH_PARAMETERS,
    getContainer,
    resolveModel,
    getParameterDefinitions,
    getParameterLabel,
    getParameterDescription,
    isRenderableParameter,
    getOrderedParameterNames
} from "./generate-form-core.js";


/* =========================================================
   FIELD MODULE
========================================================= */

import {
    createFieldInput
} from "./generate-form-fields.js";


/* =========================================================
   CREATE FIELD
========================================================= */

export function createField(
    name,
    definition
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
        "auto",
        "important"
    );


    wrapper.style.setProperty(
        "min-width",
        "0",
        "important"
    );


    wrapper.style.setProperty(
        "max-width",
        "100%",
        "important"
    );


    wrapper.style.setProperty(
        "box-sizing",
        "border-box",
        "important"
    );


    wrapper.style.visibility =
        "visible";


    wrapper.style.opacity =
        "1";


    if (
        FULL_WIDTH_PARAMETERS.has(
            String(
                name ||
                ""
            ).toLowerCase()
        )
    ) {

        wrapper.style.setProperty(
            "grid-column",
            "1 / -1",
            "important"
        );

    } else {

        wrapper.style.setProperty(
            "grid-column",
            "span 1",
            "important"
        );

    }


    const label =
        document.createElement(
            "label"
        );


    label.className =
        "generate-field-label";


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
    definition
) {

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
        name !==
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
                FULL_WIDTH_PARAMETERS.has(
                    parameter
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
   DEFAULT EXPORT
========================================================= */

export default {

    createField,

    appendDescription,

    renderParameter,

    forceContainerVisible,

    renderGenerateForm

};
