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
   - Video URL / Upload melalui media module
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
    uploadAudioFile,
    validateVideoFile,
    uploadVideoFile
} from "./generate-form-upload.js";


/* =========================================================
   FIELD FACTORIES
========================================================= */

import {
    registerImageFieldFactory,
    registerAudioFieldFactory,
    registerVideoFieldFactory
} from "./generate-form-fields.js";


/* =========================================================
   MEDIA FIELD MODULE
========================================================= */

import {
    createImageArrayField as createMediaImageArrayField,
    createAudioField as createMediaAudioField,
    createVideoArrayField as createMediaVideoArrayField,
    registerImageMediaHandlers,
    registerAudioMediaHandlers,
    registerVideoMediaHandlers
} from "./generate-form-media.js?v=stored-uploads-20261026-20261101-mp3slice";


/* =========================================================
   FIELD READER
========================================================= */

import {
    findField
} from "./generate-form-reader.js";


/* =========================================================
   FORM DATA
========================================================= */

import {
    getFormParameters,
    getFormData
} from "./generate-form-data.js?v=20261101-music-vocal-sync";


/* =========================================================
   NAMED RE-EXPORT
========================================================= */

export {
    getFormParameters,
    getFormData
};


/* =========================================================
   MEDIA HANDLER REGISTRATION
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


registerVideoMediaHandlers({
    upload:
        uploadVideoFile,

    validate:
        validateVideoFile
});


/* =========================================================
   FIELD FACTORY REGISTRATION
========================================================= */

registerImageFieldFactory(
    createMediaImageArrayField
);


registerAudioFieldFactory(
    createMediaAudioField
);


registerVideoFieldFactory(
    createMediaVideoArrayField
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
       SYNC MODE VOKAL <-> LIRIK LAGU (MUSIC / LAGU AI)
    ===================================================== */

    bindMusicVocalLyricsSync(
        container
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


function bindMusicVocalLyricsSync(
    container
) {

    if (
        !container
    ) {

        return;

    }

    const vocalField =
        container.querySelector(
            '.generate-field[data-parameter="vocal_mode"]'
        );

    const lyricsField =
        container.querySelector(
            '.generate-field[data-parameter="lyrics"]'
        );

    const vocalSelect =
        vocalField?.querySelector(
            "select"
        );

    const lyricsTextarea =
        lyricsField?.querySelector(
            "textarea"
        );

    if (
        !vocalSelect ||
        !lyricsTextarea
    ) {

        return;

    }

    const syncLyricsVisualState = () => {
        const isVocal =
            String(
                vocalSelect.value || ""
            ).toLowerCase() === "vocal";

        lyricsField.style.opacity =
            isVocal || lyricsTextarea.value.trim().length > 0
                ? "1"
                : "0.88";
    };

    const handleLyricsChange = () => {
        if (
            lyricsTextarea.value.trim().length > 0
        ) {
            delete vocalSelect.dataset.manualInstrumental;
            if (
                String(
                    vocalSelect.value || ""
                ).toLowerCase() !== "vocal"
            ) {
                vocalSelect.value =
                    "vocal";
            }
        }
        syncLyricsVisualState();
    };

    lyricsTextarea.addEventListener(
        "input",
        handleLyricsChange
    );

    lyricsTextarea.addEventListener(
        "change",
        handleLyricsChange
    );

    vocalSelect.addEventListener(
        "change",
        () => {
            if (
                String(
                    vocalSelect.value || ""
                ).toLowerCase() === "instrumental"
            ) {
                vocalSelect.dataset.manualInstrumental =
                    "1";
            } else {
                delete vocalSelect.dataset.manualInstrumental;
            }
            syncLyricsVisualState();
        }
    );

    syncLyricsVisualState();

}


/* =========================================================
   SET FIELD VALUE
========================================================= */

export function setFieldValue(
    name,
    value
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
        [
            "image_urls",
            "image_url",
            "first_frame_url",
            "reference_image_urls"
        ].includes(name)
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
       VIDEO
    ===================================================== */

    if (
        [
            "video_urls",
            "video_url",
            "reference_video_urls"
        ].includes(name)
    ) {

        const videoInput =
            field.querySelector(
                ".generate-video-input"
            ) ||
            (
                field.classList?.contains(
                    "generate-video-input"
                )
                    ? field
                    : null
            );


        const videos =
            normalizeArray(
                value
            );


        const urlInput =
            videoInput &&
            typeof videoInput.getUrlInput ===
                "function"

                ? videoInput.getUrlInput()

                : field.querySelector(
                    'input[type="url"]'
                );


        if (
            urlInput
        ) {

            urlInput.value =
                videos[0] ||
                "";

        }


        if (
            videoInput &&
            typeof videoInput.setUploadedUrl ===
                "function"
        ) {

            videoInput.setUploadedUrl(
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


        const videoUploads =
            seedanceForm.querySelectorAll(
                ".generate-video-input"
            );


        for (
            const upload
            of videoUploads
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
                        "[GEN-Z.AI][Generate Form] Reset video upload Seedance gagal:",
                        error
                    );

                }

            }

        }


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
    ===================================================== */

    const uploads =
        container.querySelectorAll(
            ".generate-image-input, " +
            ".generate-audio-input, " +
            ".generate-video-input"
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
            ).trim(),

        video_urls:
            Array.isArray(
                data.video_urls
            )
                ? data.video_urls
                : (
                    data.video_url
                        ? normalizeArray(
                            data.video_url
                        )
                        : []
                )

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
