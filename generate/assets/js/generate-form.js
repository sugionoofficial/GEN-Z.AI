/* =========================================================
   GEN-Z.AI
   GENERATE FORM MODULE
   ---------------------------------------------------------
   File:
   generate/assets/js/generate-form.js

   Tanggung jawab:
   - Orchestrate generate form
   - Render parameter model secara dinamis
   - Source parameter dari konfigurasi model
   - Mendukung object / array / JSON Schema
   - Image URL / Upload melalui media module
   - Audio URL / Upload melalui media module
   - Collect parameter melalui generate-form-data.js
   - Reset form
   - Form disabled state
   - Media parameter access
   - Parameter definition access
   - Tidak membuat parameter model baru
   - Parameter internal tidak ditampilkan
   - Parameter server-controlled tidak dikirim dari client

   Renderer:
   - generate-form-render.js

   Field factories:
   - generate-form-fields.js

   Field value:
   - generate-form-value.js

   Media:
   - generate-form-media.js

   Data:
   - generate-form-data.js
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
    normalizeArray
} from "./generate-form-core.js";


/* =========================================================
   FORM RENDERER
   ---------------------------------------------------------
   Tanggung jawab:
   - createField()
   - appendDescription()
   - renderParameter()
   - forceContainerVisible()
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
   FORM VALUE
   ---------------------------------------------------------
   setFieldValue()
   sekarang dimiliki oleh:
   generate-form-value.js
========================================================= */

import {
    setFieldValue
} from "./generate-form-value.js";


/* =========================================================
   FORM DATA
   ---------------------------------------------------------
   getFormParameters()
   getFormData()
   dimiliki oleh:
   generate-form-data.js
========================================================= */

import {
    getFormParameters,
    getFormData
} from "./generate-form-data.js";


/* =========================================================
   MEDIA HANDLER REGISTRATION
   ---------------------------------------------------------
   Register upload / validation handler sebelum field
   media digunakan oleh form.
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
   Field factory image/audio disediakan oleh
   generate-form-media.js.
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


    /* =====================================================
       CLEAR FORM LAMA
    ===================================================== */

    container.innerHTML =
        "";


    /* =====================================================
       GET PARAMETER DEFINITIONS
    ===================================================== */

    const definitions =
        getParameterDefinitions(
            model
        );


    const names =
        getOrderedParameterNames(
            definitions
        );


    /* =====================================================
       DEBUG
    ===================================================== */

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


    /* =====================================================
       FORCE CONTAINER VISIBLE
    ===================================================== */

    forceContainerVisible(
        container
    );


    /* =====================================================
       DEBUG RENDER RESULT
    ===================================================== */

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
       Seedance memiliki form khusus yang tidak boleh
       dirender ulang karena state/layout handler-nya
       dikelola oleh form khusus tersebut.
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
           TEXT / NUMBER / RANGE / URL / TEXTAREA
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
           KEEP CONTAINER VISIBLE
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
       NON-SEEDANCE
       -----------------------------------------------------
       Bersihkan upload terlebih dahulu.
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
       RENDER ULANG
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

        return null;

    }


    /* =====================================================
       DEFINITIONS
    ===================================================== */

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
