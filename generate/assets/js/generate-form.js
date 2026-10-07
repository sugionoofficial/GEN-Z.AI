/* =========================================================
   GEN-Z.AI
   GENERATE FORM MODULE
   ---------------------------------------------------------
   File:
   generate/assets/js/generate-form.js

   Tanggung jawab:
   - Orchestrator utama Generate Form
   - Render parameter model secara dinamis
   - Source parameter dari konfigurasi model
   - Mendukung object / array / JSON Schema
   - Image URL / Upload melalui media module
   - Audio URL / Upload melalui media module
   - Collect parameter melalui generate-form-data.js
   - Set value field
   - Reset form
   - Form disabled state
   - Tidak membuat parameter model baru
   - Parameter internal tidak ditampilkan
   - Parameter server-controlled tidak dikirim dari client

   Modul yang menangani detail:
   - generate-form-core.js
   - generate-form-fields.js
   - generate-form-media.js
   - generate-form-reader.js
   - generate-form-render.js
   - generate-form-data.js
   - generate-form-upload.js
========================================================= */

"use strict";


/* =========================================================
   FORM CORE
========================================================= */

import {
    getContainer,
    resolveModel,
    getParameterDefinitions,
    isInternalParameter,
    isServerControlledParameter,
    isClientForbiddenParameter,
    getOrderedParameterNames,
    getDefaultValue,
    normalizeArray
} from "./generate-form-core.js";


/* =========================================================
   FORM RENDER
   ---------------------------------------------------------
   Detail pembuatan field dan layout sekarang dimiliki oleh:
   generate-form-render.js
========================================================= */

import {
    renderParameter,
    forceContainerVisible
} from "./generate-form-render.js";


/* =========================================================
   UPLOAD
========================================================= */

import {
    validateImageFile,
    uploadImageFile,
    validateAudioFile,
    uploadAudioFile
} from "./generate-form-upload.js";


/* =========================================================
   FIELD FACTORIES
========================================================= */

import {
    registerImageFieldFactory,
    registerAudioFieldFactory
} from "./generate-form-fields.js";


/* =========================================================
   MEDIA FIELD MODULE
========================================================= */

import {
    createImageField as createMediaImageField,
    createAudioField as createMediaAudioField,
    registerImageMediaHandlers,
    registerAudioMediaHandlers
} from "./generate-form-media.js";


/* =========================================================
   FIELD READER
========================================================= */

import {
    findField
} from "./generate-form-reader.js";


/* =========================================================
   FORM DATA
   ---------------------------------------------------------
   getFormParameters()
   getFormData()
   sekarang dimiliki oleh:
   generate-form-data.js
========================================================= */

import {
    getFormParameters,
    getFormData
} from "./generate-form-data.js";


/* =========================================================
   NAMED RE-EXPORT
   ---------------------------------------------------------
   Memastikan `getFormParameters` dan `getFormData` dapat
   diakses sebagai named export oleh module lain, mis:

       import { getFormParameters } from "./generate-form.js";
       import * as form from "./generate-form.js";
       form.getFormParameters(...);

   Tidak mengubah perilaku object `generateForm`.
========================================================= */

export {
    getFormParameters,
    getFormData
};


/* =========================================================
   MEDIA HANDLER REGISTRATION
   ---------------------------------------------------------
   Registration dilakukan sekali saat module dimuat.
========================================================= */

registerImageMediaHandlers({
    upload:
        uploadImageFile,

    validate:
        validateImageFile
});


registerAudioMediaHandlers({
    upload:
        uploadAudioFile,

    validate:
        validateAudioFile
});


/* =========================================================
   FIELD FACTORY REGISTRATION
   ---------------------------------------------------------
   Field module menggunakan factory registry untuk media.
========================================================= */

registerImageFieldFactory(
    createMediaImageField
);


registerAudioFieldFactory(
    createMediaAudioField
);


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


    /*
     * Bersihkan field lama sebelum render model baru.
     */

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


    console.debug(
        "[GEN-Z.AI][Generate Form] MODEL:",
        model.model_id ||
        model.id ||
        "-"
    );


    console.debug(
        "[GEN-Z.AI][Generate Form] PARAMETER NAMES:",
        names
    );


    /* =====================================================
       EMPTY PARAMETERS
    ===================================================== */

    if (
        names.length === 0
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


    /* =====================================================
       RENDER PARAMETERS
    ===================================================== */

    let renderedCount =
        0;


    names.forEach(
        name => {

            try {

                const definition =
                    definitions?.[name];


                const field =
                    renderParameter(
                        name,
                        definition
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


    /* =====================================================
       FORCE LAYOUT
    ===================================================== */

    forceContainerVisible(
        container
    );


    console.debug(
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


    return renderedCount > 0;

}


/* =========================================================
   SET FIELD VALUE
   ---------------------------------------------------------
   Dipertahankan di orchestrator karena fungsi ini merupakan
   public API yang digunakan module lain.
========================================================= */

export function setFieldValue(
    name,
    value
) {

    /* =====================================================
       SECURITY / PARAMETER FILTER
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
         * URL yang diberikan secara programmatic
         * bukan hasil upload baru.
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
       RADIO
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
   RESET
========================================================= */

export async function resetDynamicFields(
    modelArgument = null
) {

    const container =
        getContainer();


    if (
        !container
    ) {

        return;

    }


    /* =====================================================
       SEEDANCE
       -----------------------------------------------------
       Seedance memiliki form khusus.

       Jangan render ulang karena render ulang dapat:
       - menghapus upload state
       - menghapus preview
       - menghilangkan event listener khusus
       - mengubah layout form
    ===================================================== */

    const seedanceForm =
        container.querySelector(
            ".seedance-form"
        );


    if (
        seedanceForm
    ) {

        console.debug(
            "[GEN-Z.AI][Generate Form] Reset Seedance tanpa render ulang."
        );


        /* =================================================
           TEXT / TEXTAREA
        ================================================= */

        seedanceForm
            .querySelectorAll(
                "input:not([type='file']):not([type='radio']):not([type='checkbox']), textarea"
            )
            .forEach(
                input => {

                    if (
                        "defaultValue" in
                        input
                    ) {

                        input.value =
                            input.defaultValue;

                    } else {

                        input.value =
                            "";

                    }


                    input.dispatchEvent(
                        new Event(
                            "input",
                            {
                                bubbles:
                                    true
                            }
                        )
                    );


                    input.dispatchEvent(
                        new Event(
                            "change",
                            {
                                bubbles:
                                    true
                            }
                        )
                    );

                }
            );


        /* =================================================
           SELECT
        ================================================= */

        seedanceForm
            .querySelectorAll(
                "select"
            )
            .forEach(
                select => {

                    const defaultOption =
                        select.querySelector(
                            "option[selected]"
                        );


                    if (
                        defaultOption
                    ) {

                        select.value =
                            defaultOption.value;

                    } else if (
                        select.options.length
                    ) {

                        select.selectedIndex =
                            0;

                    }


                    select.dispatchEvent(
                        new Event(
                            "change",
                            {
                                bubbles:
                                    true
                            }
                        )
                    );

                }
            );


        /* =================================================
           RADIO
        ================================================= */

        seedanceForm
            .querySelectorAll(
                "input[type='radio']"
            )
            .forEach(
                radio => {

                    radio.checked =
                        radio.defaultChecked;

                }
            );


        /* =================================================
           CHECKBOX
        ================================================= */

        seedanceForm
            .querySelectorAll(
                "input[type='checkbox']"
            )
            .forEach(
                checkbox => {

                    checkbox.checked =
                        checkbox.defaultChecked;


                    checkbox.dispatchEvent(
                        new Event(
                            "change",
                            {
                                bubbles:
                                    true
                            }
                        )
                    );

                }
            );


        /* =================================================
           FILE INPUT
        ================================================= */

        seedanceForm
            .querySelectorAll(
                "input[type='file']"
            )
            .forEach(
                fileInput => {

                    try {

                        fileInput.value =
                            "";

                    } catch (
                        error
                    ) {

                        console.warn(
                            "[GEN-Z.AI][Generate Form] Reset file input gagal:",
                            error
                        );

                    }

                }
            );


        /* =================================================
           IMAGE UPLOAD
        ================================================= */

        const imageUploads =
            seedanceForm.querySelectorAll(
                ".generate-image-input"
            );


        for (
            const upload
            of imageUploads
        ) {

            if (
                typeof upload.clearUploadedFile ===
                "function"
            ) {

                try {

                    await upload.clearUploadedFile();

                } catch (
                    error
                ) {

                    console.warn(
                        "[GEN-Z.AI][Generate Form] Reset image upload Seedance gagal:",
                        error
                    );

                }

            }

        }


        /* =================================================
           AUDIO UPLOAD
        ================================================= */

        const audioUploads =
            seedanceForm.querySelectorAll(
                ".generate-audio-input"
            );


        for (
            const upload
            of audioUploads
        ) {

            if (
                typeof upload.clearUploadedFile ===
                "function"
            ) {

                try {

                    await upload.clearUploadedFile();

                } catch (
                    error
                ) {

                    console.warn(
                        "[GEN-Z.AI][Generate Form] Reset audio upload Seedance gagal:",
                        error
                    );

                }

            }

        }


        /* =================================================
           PREVIEW
        ================================================= */

        seedanceForm
            .querySelectorAll(
                ".seedance-preview, " +
                ".seedance-file-preview, " +
                ".seedance-selected-files, " +
                ".seedance-media-preview"
            )
            .forEach(
                preview => {

                    preview.innerHTML =
                        "";


                    preview.style.display =
                        "none";

                }
            );


        /* =================================================
           UPLOADED URL
        ================================================= */

        seedanceForm
            .querySelectorAll(
                "[data-uploaded-url]"
            )
            .forEach(
                element => {

                    delete element.dataset.uploadedUrl;

                }
            );


        seedanceForm
            .querySelectorAll(
                "[data-uploaded-urls]"
            )
            .forEach(
                element => {

                    delete element.dataset.uploadedUrls;

                }
            );


        /* =================================================
           COUNTER
        ================================================= */

        seedanceForm
            .querySelectorAll(
                "[data-counter], " +
                ".seedance-counter, " +
                ".char-counter"
            )
            .forEach(
                counter => {

                    const text =
                        String(
                            counter.textContent ||
                            ""
                        );


                    if (
                        /^\s*\d+\s*\/\s*\d+\s*$/.test(
                            text
                        )
                    ) {

                        const match =
                            text.match(
                                /\/\s*(\d+)/
                            );


                        counter.textContent =
                            match
                                ? `0 / ${match[1]}`
                                : "0";

                    }

                }
            );


        /* =================================================
           CHECKBOX EVENTS
        ================================================= */

        seedanceForm
            .querySelectorAll(
                "input[type='checkbox']"
            )
            .forEach(
                checkbox => {

                    checkbox.dispatchEvent(
                        new Event(
                            "input",
                            {
                                bubbles:
                                    true
                            }
                        )
                    );


                    checkbox.dispatchEvent(
                        new Event(
                            "change",
                            {
                                bubbles:
                                    true
                            }
                        )
                    );

                }
            );


        /* =================================================
           CONTAINER VISIBILITY
        ================================================= */

        container.hidden =
            false;


        container.removeAttribute(
            "hidden"
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


        console.debug(
            "[GEN-Z.AI][Generate Form] Reset Seedance selesai. Layout dipertahankan."
        );


        return;

    }


    /* =====================================================
       MODEL NON-SEEDANCE
       -----------------------------------------------------
       Upload harus dibersihkan sebelum render ulang.
    ===================================================== */

    const uploads =
        container.querySelectorAll(
            ".generate-image-input, " +
            ".generate-audio-input"
        );


    for (
        const upload
        of uploads
    ) {

        if (
            typeof upload.clearUploadedFile ===
            "function"
        ) {

            try {

                await upload.clearUploadedFile();

            } catch (
                error
            ) {

                console.warn(
                    "[GEN-Z.AI][Generate Form] Reset upload gagal:",
                    error
                );

            }

        }

    }


    /* =====================================================
       RENDER ULANG MODEL
    ===================================================== */

    renderGenerateForm(
        modelArgument
    );

}


/* =========================================================
   FORM DISABLED
========================================================= */

export function setFormDisabled(
    disabled
) {

    const container =
        getContainer();


    if (
        !container
    ) {

        return;

    }


    container
        .querySelectorAll(
            "input, textarea, select, button"
        )
        .forEach(
            control => {

                control.disabled =
                    Boolean(
                        disabled
                    );

            }
        );

}


/* =========================================================
   MEDIA PARAMETERS
   ---------------------------------------------------------
   Compatibility helper untuk module lain.
========================================================= */

export async function getMediaParameters(
    modelArgument = null
) {

    const data =
        await getFormParameters(
            modelArgument
        );


    return {

        image_urls:
            Array.isArray(
                data.image_urls
            )
                ? data.image_urls
                : (
                    data.image_url
                        ? normalizeArray(
                            data.image_url
                        )
                        : []
                ),

        audio_url:
            String(
                data.audio_url ||
                ""
            ).trim()

    };

}


/* =========================================================
   PARAMETER DEFINITION
========================================================= */

export function getParameterDefinition(
    name,
    modelArgument = null
) {

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

        return null;

    }


    const definitions =
        getParameterDefinitions(
            modelArgument
        );


    return (
        definitions?.[name] ||
        null
    );

}


/* =========================================================
   INIT
========================================================= */

export function initGenerateForm(
    modelArgument = null
) {

    return renderGenerateForm(
        modelArgument
    );

}


/* =========================================================
   PUBLIC API
========================================================= */

export const generateForm =
    Object.freeze({

        render:
            renderGenerateForm,

        renderGenerateForm,

        init:
            initGenerateForm,

        getFormParameters,

        getFormData,

        setFieldValue,

        reset:
            resetDynamicFields,

        setDisabled:
            setFormDisabled,

        getMediaParameters,

        parameterDefinition:
            getParameterDefinition

    });


/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default generateForm;
