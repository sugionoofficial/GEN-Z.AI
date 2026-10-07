/* =========================================================
   GEN-Z.AI
   GENERATE FORM READER
   ---------------------------------------------------------
   File:
   generate/assets/js/generate-form-reader.js

   Tanggung jawab:
   - Mencari field berdasarkan parameter
   - Membaca nilai field dari DOM
   - Tidak melakukan upload
   - Tidak mengubah state model
   - Tidak melakukan submit
========================================================= */

"use strict";


import {
    getContainer
} from "./generate-form-core.js";


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


    /* =====================================================
       IMAGE
    ===================================================== */

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


    /* =====================================================
       AUDIO
    ===================================================== */

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

        return checkbox.checked;

    }


    /* =====================================================
       STANDARD INPUT
    ===================================================== */

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
   DEFAULT EXPORT
========================================================= */

export default {

    findField,

    readFieldValue

};
