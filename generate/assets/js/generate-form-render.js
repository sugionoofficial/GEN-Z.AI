/* =========================================================
   GEN-Z.AI
   GENERATE FORM RENDERER
   ---------------------------------------------------------
   File:
   generate/assets/js/generate-form-render.js

   Fungsi:
   - Membuat wrapper field
   - Membuat label parameter
   - Membuat description
   - Merender parameter
   - Mengatur visibility container
   - Mengatur layout 1 / 2 kolom

   Tidak menangani:
   - State
   - Submit
   - API
   - Credit
   - Reset
   - Form data
   - Upload
========================================================= */

"use strict";


/* =========================================================
   FORM CORE
========================================================= */

import {
    FULL_WIDTH_PARAMETERS,
    getContainer,
    getParameterLabel,
    getParameterDescription,
    isInternalParameter,
    isServerControlledParameter,
    isClientForbiddenParameter,
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
     * Duration memiliki title / label
     * internal sendiri.
     *
     * Description tidak ditambahkan
     * dua kali.
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
   FULL WIDTH CHECK
========================================================= */

function isFullWidthParameter(
    parameter
) {

    if (
        Array.isArray(
            FULL_WIDTH_PARAMETERS
        )
    ) {

        return FULL_WIDTH_PARAMETERS.includes(
            parameter
        );
    }


    if (
        FULL_WIDTH_PARAMETERS instanceof Set
    ) {

        return FULL_WIDTH_PARAMETERS.has(
            parameter
        );
    }


    return (
        parameter === "prompt" ||
        parameter === "negative_prompt" ||
        parameter === "description" ||
        parameter === "image_urls" ||
        parameter === "image_url" ||
        parameter === "audio_url"
    );
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
                isFullWidthParameter(
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
   DEFAULT EXPORT
========================================================= */

export default Object.freeze({

    createField,

    appendDescription,

    renderParameter,

    forceContainerVisible

});
