/* =========================================================
   GEN-Z.AI
   GENERATE FORM VALUE MODULE
   ---------------------------------------------------------
   File:
   generate/assets/js/generate-form-value.js

   Tanggung jawab:
   - Set value field berdasarkan parameter
   - Image URL
   - Audio URL
   - Radio / Enum
   - Checkbox
   - Input / Textarea / Select
   - Tidak menangani rendering field
   - Tidak menangani reset form
========================================================= */

"use strict";


/* =========================================================
   FORM CORE
========================================================= */

import {
    isInternalParameter,
    isServerControlledParameter,
    isClientForbiddenParameter,
    normalizeArray
} from "./generate-form-core.js";


/* =========================================================
   FIELD READER
========================================================= */

import {
    findField
} from "./generate-form-reader.js";


/* =========================================================
   SET FIELD VALUE
========================================================= */

export function setFieldValue(
    name,
    value
) {

    /* =====================================================
       PROTECTED PARAMETERS
    ===================================================== */

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


    /* =====================================================
       FIND FIELD
    ===================================================== */

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


        /*
         * Value baru berasal dari URL.
         * Uploaded URL lama harus dibersihkan agar
         * tidak ikut terbaca oleh form-data.
         */

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


        /*
         * Value baru berasal dari URL.
         * Uploaded URL lama harus dibersihkan.
         */

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
       RADIO / ENUM
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


                /*
                 * Struktur radio:
                 *
                 * label
                 *   input[type=radio]
                 *   span.generate-option-label
                 *
                 * atau struktur field lain yang
                 * menggunakan sibling label.
                 */

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
       NORMAL INPUT
       -----------------------------------------------------
       input:
       - text
       - number
       - range
       - url
       - hidden

       textarea
       select
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
   DEFAULT EXPORT
========================================================= */

export default Object.freeze({

    setFieldValue

});
