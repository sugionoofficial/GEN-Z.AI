/* =========================================================
   GEN-Z.AI
   GENERATE FORM READER
   ---------------------------------------------------------
   File:
   generate/assets/js/generate-form-reader.js

   Tanggung jawab:
   - Mencari field parameter
   - Membaca value field
   - Tidak membuat field
   - Tidak melakukan render
   - Tidak melakukan upload
   - Tidak mengubah konfigurasi model
========================================================= */

"use strict";


/* =========================================================
   FIND FIELD
========================================================= */

export function findField(
    name
) {

    const parameter =
        String(
            name ||
            ""
        ).trim();


    if (
        !parameter
    ) {

        return null;

    }


    /* =====================================================
       PRIMARY
       .generate-field[data-parameter]
    ===================================================== */

    const directField =
        document.querySelector(
            `.generate-field[data-parameter="${CSS.escape(parameter)}"]`
        );


    if (
        directField
    ) {

        return directField;

    }


    /* =====================================================
       FALLBACK
       Semua elemen data-parameter
    ===================================================== */

    const fields =
        document.querySelectorAll(
            "[data-parameter]"
        );


    for (
        const field
        of fields
    ) {

        const fieldParameter =
            String(
                field.dataset?.parameter ||
                ""
            ).trim();


        if (
            fieldParameter ===
            parameter
        ) {

            return (
                field.closest(
                    ".generate-field"
                ) ||
                field
            );

        }

    }


    /* =====================================================
       FALLBACK ID
       parameter-${name}
    ===================================================== */

    const element =
        document.getElementById(
            `parameter-${parameter}`
        );


    if (
        element
    ) {

        return (
            element.closest(
                ".generate-field"
            ) ||
            element
        );

    }


    return null;

}


/* =========================================================
   READ FIELD VALUE
========================================================= */

export function readFieldValue(
    field
) {

    if (
        !field
    ) {

        return undefined;

    }


    /* =====================================================
       RADIO
    ===================================================== */

    const radio =
        field.querySelector(
            'input[type="radio"]:checked'
        );


    if (
        radio
    ) {

        return radio.value;

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

        return Boolean(
            checkbox.checked
        );

    }


    /* =====================================================
       SELECT
    ===================================================== */

    const select =
        field.querySelector(
            "select"
        );


    if (
        select
    ) {

        return select.value;

    }


    /* =====================================================
       TEXTAREA
    ===================================================== */

    const textarea =
        field.querySelector(
            "textarea"
        );


    if (
        textarea
    ) {

        return textarea.value;

    }


    /* =====================================================
       STANDARD INPUT
    ===================================================== */

    const input =
        field.querySelector(
            "input"
        );


    if (
        input
    ) {

        return input.value;

    }


    /* =====================================================
       CONTENTEDITABLE
    ===================================================== */

    const editable =
        field.querySelector(
            '[contenteditable="true"]'
        );


    if (
        editable
    ) {

        return (
            editable.textContent ||
            ""
        );

    }


    /* =====================================================
       FIELD VALUE
    ===================================================== */

    if (
        "value" in field
    ) {

        return field.value;

    }


    return undefined;

}


/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default Object.freeze({

    findField,

    readFieldValue

});
