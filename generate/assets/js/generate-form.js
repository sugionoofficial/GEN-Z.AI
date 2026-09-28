/* =========================================================
   GEN-Z.AI
   GENERATE FORM MODULE
   ---------------------------------------------------------
   File:
   generate/assets/js/generate-form.js

   Tanggung jawab:
   - Render parameter model secara dinamis
   - Source parameter dari konfigurasi model
   - Mendukung object / array / JSON Schema
   - Image URL / Upload
   - Enum
   - Boolean
   - Number / Integer
   - Duration range
   - Collect parameter
   - Reset form
   - Tidak membuat parameter model baru
   - Parameter internal seperti task_id / index tidak
     ditampilkan atau dikirim secara otomatis
   - Parameter keamanan server seperti nsfw_checker
     tidak pernah ditampilkan atau dikirim dari client
========================================================= */

"use strict";


/* =========================================================
   STATE
========================================================= */

import {
    getGenerateElements,
    getCurrentModel,
    getCurrentUser,
    getSupabaseClient
} from "./generate-state.js";


/* =========================================================
   CONSTANTS
========================================================= */

const INTERNAL_PARAMETERS =
    new Set([
        "task_id",
        "index"
    ]);


const SERVER_CONTROLLED_PARAMETERS =
    new Set([
        "nsfw_checker"
    ]);


const STORAGE_BUCKET =
    "dashboard-videos";


const ALLOWED_IMAGE_TYPES =
    new Set([
        "image/jpeg",
        "image/png",
        "image/webp"
    ]);


const MAX_IMAGE_SIZE =
    10 * 1024 * 1024;


/*
 * Hanya menentukan urutan visual.
 *
 * BUKAN whitelist.
 *
 * Parameter lain yang diberikan model
 * tetap akan dirender.
 */

const PARAMETER_ORDER = [
    "image_urls",
    "image_url",
    "prompt",
    "mode",
    "aspect_ratio",
    "duration",
    "resolution"
];


/*
 * Parameter yang secara visual sebaiknya
 * menggunakan satu baris penuh.
 *
 * Prompt dan gambar biasanya membutuhkan
 * ruang horizontal penuh.
 *
 * Parameter lain dapat berdampingan.
 */

const FULL_WIDTH_PARAMETERS =
    new Set([
        "image_urls",
        "image_url",
        "prompt",
        "negative_prompt",
        "description"
    ]);


/* =========================================================
   DOM
========================================================= */

function getContainer() {

    const domContainer =
        document.getElementById(
            "dynamicFields"
        );

    if (
        domContainer
    ) {

        return domContainer;

    }


    const elements =
        getGenerateElements();


    return (
        elements?.dynamicFields ||
        null
    );

}


/* =========================================================
   MODEL
========================================================= */

function resolveModel(
    modelArgument = null
) {

    if (
        modelArgument &&
        typeof modelArgument ===
        "object"
    ) {

        return modelArgument;

    }


    const currentModel =
        getCurrentModel();


    if (
        currentModel &&
        typeof currentModel ===
        "object"
    ) {

        return currentModel;

    }


    return null;

}


/* =========================================================
   PARAMETER SOURCE
========================================================= */

function getParameterDefinitions(
    modelArgument = null
) {

    const model =
        resolveModel(
            modelArgument
        );


    if (
        !model
    ) {

        console.warn(
            "[GEN-Z.AI][Generate Form] Model tidak tersedia."
        );


        return {};

    }


    const candidates = [

        model.parameters,

        model.parameter_schema,

        model.parameterSchema,

        model.input_schema,

        model.inputSchema,

        model.schema,

        model.config?.parameters,

        model.config?.parameter_schema,

        model.config?.parameterSchema,

        model.config?.input_schema,

        model.config?.inputSchema,

        model.config?.schema,

        model.repository?.parameters,

        model.repository?.parameter_schema,

        model.repository?.parameterSchema,

        model.repository?.input_schema,

        model.repository?.inputSchema,

        model.repository?.schema,

        model.model?.parameters,

        model.model?.parameter_schema,

        model.model?.parameterSchema,

        model.model?.input_schema,

        model.model?.inputSchema,

        model.model?.schema

    ];


    for (
        const candidate
        of candidates
    ) {

        const normalized =
            normalizeParameterDefinitions(
                candidate
            );


        if (
            Object.keys(
                normalized
            ).length > 0
        ) {

            console.debug(
                "[GEN-Z.AI][Generate Form] Parameter source ditemukan:",
                {
                    model:
                        model.model_id ||
                        model.id ||
                        "-",

                    keys:
                        Object.keys(
                            normalized
                        )
                }
            );


            return normalized;

        }

    }


    const nestedCandidates = [

        model.data?.parameters,

        model.data?.parameter_schema,

        model.data?.parameterSchema,

        model.data?.input_schema,

        model.data?.inputSchema,

        model.data?.schema

    ];


    for (
        const candidate
        of nestedCandidates
    ) {

        const normalized =
            normalizeParameterDefinitions(
                candidate
            );


        if (
            Object.keys(
                normalized
            ).length > 0
        ) {

            return normalized;

        }

    }


    console.warn(
        "[GEN-Z.AI][Generate Form] Parameter model tidak ditemukan:",
        {
            modelId:
                model.model_id ||
                model.id ||
                "-",

            modelKeys:
                Object.keys(
                    model
                )
        }
    );


    return {};

}


/* =========================================================
   NORMALIZE PARAMETERS
========================================================= */

function normalizeParameterDefinitions(
    value
) {

    if (
        !value
    ) {

        return {};

    }


    if (
        typeof value ===
        "string"
    ) {

        const text =
            value.trim();


        if (
            !text
        ) {

            return {};

        }


        try {

            const parsed =
                JSON.parse(
                    text
                );


            return normalizeParameterDefinitions(
                parsed
            );

        } catch {

            return {};

        }

    }


    if (
        Array.isArray(value)
    ) {

        const result =
            {};


        value.forEach(
            item => {

                if (
                    !item ||
                    typeof item !==
                    "object"
                ) {

                    return;

                }


                const name =
                    String(
                        item.name ??
                        item.key ??
                        item.id ??
                        item.parameter ??
                        ""
                    ).trim();


                if (
                    !name
                ) {

                    return;

                }


                const definition = {
                    ...item
                };


                delete definition.name;
                delete definition.key;
                delete definition.id;
                delete definition.parameter;


                result[name] =
                    definition;

            }
        );


        return result;

    }


    if (
        typeof value !==
        "object"
    ) {

        return {};

    }


    if (
        value.parameters
    ) {

        const nested =
            normalizeParameterDefinitions(
                value.parameters
            );


        if (
            Object.keys(
                nested
            ).length
        ) {

            return nested;

        }

    }


    if (
        value.properties &&
        typeof value.properties ===
        "object"
    ) {

        const properties =
            normalizeParameterDefinitions(
                value.properties
            );


        if (
            Object.keys(
                properties
            ).length
        ) {

            return properties;

        }

    }


    if (
        value.input_schema
    ) {

        const nested =
            normalizeParameterDefinitions(
                value.input_schema
            );


        if (
            Object.keys(
                nested
            ).length
        ) {

            return nested;

        }

    }


    if (
        value.schema
    ) {

        const nested =
            normalizeParameterDefinitions(
                value.schema
            );


        if (
            Object.keys(
                nested
            ).length
        ) {

            return nested;

        }

    }


    const result =
        {};


    Object.entries(
        value
    ).forEach(
        (
            [
                key,
                definition
            ]
        ) => {

            if (
                !key ||
                definition ===
                null ||
                definition ===
                undefined
            ) {

                return;

            }


            if (
                key ===
                    "required" ||
                key ===
                    "title" ||
                key ===
                    "description" ||
                key ===
                    "type" ||
                key ===
                    "additionalProperties"
            ) {

                return;

            }


            if (
                typeof definition ===
                "object"
            ) {

                result[key] =
                    definition;

                return;

            }


            if (
                typeof definition ===
                    "string" ||
                typeof definition ===
                    "number" ||
                typeof definition ===
                    "boolean"
            ) {

                result[key] = {

                    type:
                        typeof definition,

                    default:
                        definition

                };

            }

        }
    );


    return result;

}


/* =========================================================
   LABEL
========================================================= */

function getParameterLabel(
    name,
    definition
) {

    if (
        typeof definition?.label ===
        "string" &&
        definition.label.trim()
    ) {

        return definition.label.trim();

    }


    if (
        typeof definition?.title ===
        "string" &&
        definition.title.trim()
    ) {

        return definition.title.trim();

    }


    const labels = {

        image_urls:
            "Gambar Referensi",

        image_url:
            "Gambar Referensi",

        prompt:
            "Prompt",

        mode:
            "Mode",

        aspect_ratio:
            "Aspect Ratio",

        duration:
            "Duration",

        resolution:
            "Resolution"

    };


    if (
        labels[name]
    ) {

        return labels[name];

    }


    return String(
        name
    )
        .replace(
            /[_-]+/g,
            " "
        )
        .replace(
            /\b\w/g,
            character =>
                character.toUpperCase()
        );

}


/* =========================================================
   DESCRIPTION
========================================================= */

function getParameterDescription(
    definition
) {

    return String(
        definition?.description ||
        ""
    ).trim();

}


/* =========================================================
   INTERNAL / SERVER CONTROLLED
========================================================= */

function isInternalParameter(
    name
) {

    return INTERNAL_PARAMETERS.has(
        String(
            name ||
            ""
        ).trim()
    );

}


function isServerControlledParameter(
    name
) {

    return SERVER_CONTROLLED_PARAMETERS.has(
        String(
            name ||
            ""
        ).trim()
            .toLowerCase()
    );

}


function isClientForbiddenParameter(
    name
) {

    return (
        isInternalParameter(
            name
        ) ||
        isServerControlledParameter(
            name
        )
    );

}


/* =========================================================
   RENDERABLE
========================================================= */

function isRenderableParameter(
    name,
    definition
) {

    if (
        !name
    ) {

        return false;

    }


    if (
        isClientForbiddenParameter(
            name
        )
    ) {

        return false;

    }


    if (
        !definition ||
        typeof definition !==
        "object"
    ) {

        return false;

    }


    return true;

}


/* =========================================================
   ORDER
========================================================= */

function getOrderedParameterNames(
    definitions
) {

    const names =
        Object.keys(
            definitions ||
            {}
        )
        .filter(
            name =>
                isRenderableParameter(
                    name,
                    definitions[name]
                )
        );


    const ordered =
        [];


    PARAMETER_ORDER.forEach(
        preferredName => {

            if (
                names.includes(
                    preferredName
                )
            ) {

                ordered.push(
                    preferredName
                );

            }

        }
    );


    names.forEach(
        name => {

            if (
                !ordered.includes(
                    name
                )
            ) {

                ordered.push(
                    name
                );

            }

        }
    );


    return ordered;

}


/* =========================================================
   FIELD
   ---------------------------------------------------------
   PERBAIKAN LAYOUT:
   - Tidak lagi width: 100% untuk semua field
   - Field biasa memakai 1 kolom
   - Prompt / image memakai full width
   - Grid dikontrol oleh #dynamicFields
========================================================= */

function createField(
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


    /*
     * PENTING:
     * Sebelumnya:
     *
     * wrapper.style.width = "100%";
     *
     * Ini menyebabkan semua field mengambil
     * satu baris penuh walaupun parent adalah grid.
     *
     * Sekarang field memakai ukuran grid.
     */

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


    /*
     * Prompt / image membutuhkan satu baris penuh.
     */

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

function appendDescription(
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
   DEFAULT
========================================================= */

function getDefaultValue(
    definition
) {

    if (
        !definition ||
        typeof definition !==
        "object"
    ) {

        return undefined;

    }


    return (
        definition.default ??
        definition.default_value ??
        definition.value
    );

}


/* =========================================================
   ARRAY
========================================================= */

function normalizeArray(
    value
) {

    if (
        Array.isArray(value)
    ) {

        return value
            .map(
                item =>
                    String(
                        item ??
                        ""
                    ).trim()
            )
            .filter(Boolean);

    }


    if (
        value ===
            null ||
        value ===
            undefined
    ) {

        return [];

    }


    if (
        typeof value !==
        "string"
    ) {

        return [];

    }


    const text =
        value.trim();


    if (
        !text
    ) {

        return [];

    }


    if (
        text.startsWith("[") &&
        text.endsWith("]")
    ) {

        try {

            const parsed =
                JSON.parse(
                    text
                );


            if (
                Array.isArray(
                    parsed
                )
            ) {

                return normalizeArray(
                    parsed
                );

            }

        } catch {

            /* fallback */

        }

    }


    if (
        text.startsWith("{") &&
        text.endsWith("}")
    ) {

        return text
            .slice(
                1,
                -1
            )
            .split(",")
            .map(
                item =>
                    item
                        .trim()
                        .replace(
                            /^"(.*)"$/,
                            "$1"
                        )
            )
            .filter(Boolean);

    }


    return text
        .split(",")
        .map(
            item =>
                item.trim()
        )
        .filter(Boolean);

}


/* =========================================================
   FIELD ID
========================================================= */

function createFieldId(
    name
) {

    return (
        "generate-field-" +
        String(
            name
        )
            .replace(
                /[^a-zA-Z0-9_-]/g,
                "-"
            )
    );

}


/* =========================================================
   IMAGE FIELD
========================================================= */

function createImageField(
    definition = {},
    parameterName = ""
) {

    const wrapper =
        document.createElement("div");


    wrapper.className =
        "generate-image-input";


    wrapper.style.setProperty(
        "width",
        "100%",
        "important"
    );


    if (
        parameterName
    ) {

        wrapper.dataset.parameter =
            parameterName;

    }


    const modeSelector =
        document.createElement("div");


    modeSelector.className =
        "generate-image-mode-selector";


    modeSelector.style.display =
        "flex";


    modeSelector.style.gap =
        "8px";


    modeSelector.style.marginBottom =
        "10px";


    const urlButton =
        document.createElement("button");


    urlButton.type =
        "button";


    urlButton.textContent =
        "Gunakan URL";


    urlButton.className =
        "generate-image-mode-button active";


    urlButton.style.cursor =
        "pointer";


    const uploadButton =
        document.createElement("button");


    uploadButton.type =
        "button";


    uploadButton.textContent =
        "Upload Gambar";


    uploadButton.className =
        "generate-image-mode-button";


    uploadButton.style.cursor =
        "pointer";


    modeSelector.appendChild(
        urlButton
    );


    modeSelector.appendChild(
        uploadButton
    );


    const urlContainer =
        document.createElement("div");


    urlContainer.className =
        "generate-image-url-container";


    const urlInput =
        document.createElement("input");


    urlInput.type =
        "url";


    urlInput.className =
        "generate-image-url";


    urlInput.placeholder =
        "Masukkan URL gambar";


    urlInput.autocomplete =
        "off";


    urlInput.style.setProperty(
        "width",
        "100%",
        "important"
    );


    urlContainer.appendChild(
        urlInput
    );


    const uploadContainer =
        document.createElement("div");


    uploadContainer.className =
        "generate-image-upload-container";


    uploadContainer.style.display =
        "none";


    const fileInput =
        document.createElement("input");


    fileInput.type =
        "file";


    fileInput.accept =
        definition.accept ||
        "image/*";


    fileInput.multiple =
        Boolean(
            definition.multiple ||
            Number(
                definition.maxItems ||
                definition.max_items
            ) > 1
        );


    fileInput.className =
        "generate-image-file";


    uploadContainer.appendChild(
        fileInput
    );


    const preview =
        document.createElement("div");


    preview.className =
        "generate-image-preview";


    preview.style.display =
        "none";


    preview.style.flexWrap =
        "wrap";


    preview.style.gap =
        "8px";


    preview.style.marginTop =
        "10px";


    preview.style.maxWidth =
        "360px";


    function renderPreview(
        files
    ) {

        preview.innerHTML =
            "";


        const selectedFiles =
            Array.from(
                files || []
            ).filter(
                file =>
                    file &&
                    file.type &&
                    file.type.startsWith(
                        "image/"
                    )
            );


        if (
            !selectedFiles.length
        ) {

            preview.style.display =
                "none";


            return;

        }


        preview.style.display =
            "flex";


        selectedFiles.forEach(
            file => {

                const reader =
                    new FileReader();


                reader.onload =
                    event => {

                        const image =
                            document.createElement(
                                "img"
                            );


                        image.src =
                            event.target.result;


                        image.alt =
                            "Preview gambar";


                        image.style.width =
                            "160px";


                        image.style.height =
                            "160px";


                        image.style.maxWidth =
                            "160px";


                        image.style.maxHeight =
                            "160px";


                        image.style.objectFit =
                            "cover";


                        image.style.display =
                            "block";


                        image.style.borderRadius =
                            "10px";


                        image.style.border =
                            "1px solid rgba(255,255,255,.12)";


                        preview.appendChild(
                            image
                        );

                    };


                reader.readAsDataURL(
                    file
                );

            }
        );

    }


    function setMode(
        mode
    ) {

        const uploadMode =
            mode === "upload";


        if (
            uploadMode
        ) {

            urlContainer.style.display =
                "none";


            uploadContainer.style.display =
                "block";


            urlButton.classList.remove(
                "active"
            );


            uploadButton.classList.add(
                "active"
            );


            if (
                fileInput.files &&
                fileInput.files.length
            ) {

                renderPreview(
                    fileInput.files
                );

            } else {

                preview.style.display =
                    "none";

            }

        } else {

            urlContainer.style.display =
                "block";


            uploadContainer.style.display =
                "none";


            preview.style.display =
                "none";


            uploadButton.classList.remove(
                "active"
            );


            urlButton.classList.add(
                "active"
            );

        }


        wrapper.dataset.imageMode =
            uploadMode
                ? "upload"
                : "url";

    }


    urlButton.addEventListener(
        "click",
        event => {

            event.preventDefault();
            event.stopPropagation();


            setMode(
                "url"
            );

        }
    );


    uploadButton.addEventListener(
        "click",
        event => {

            event.preventDefault();
            event.stopPropagation();


            setMode(
                "upload"
            );

        }
    );


    fileInput.addEventListener(
        "change",
        () => {

            renderPreview(
                fileInput.files
            );

        }
    );


    urlInput.addEventListener(
        "keydown",
        event => {

            if (
                event.key ===
                "Enter"
            ) {

                event.preventDefault();

            }

        }
    );


    wrapper._imageMode =
        () =>
            wrapper.dataset.imageMode ||
            "url";


    wrapper._urlInput =
        urlInput;


    wrapper._fileInput =
        fileInput;


    wrapper._preview =
        preview;


    wrapper.getInputMode =
        () =>
            wrapper.dataset.imageMode ||
            "url";


    wrapper.getUrlInput =
        () =>
            urlInput;


    wrapper.getFileInput =
        () =>
            fileInput;


    wrapper.getUploadedUrl =
        () =>
            String(
                wrapper.dataset.uploadedUrl ||
                ""
            ).trim();


    wrapper.setUploadedUrl =
        url => {

            const normalized =
                String(
                    url ||
                    ""
                ).trim();


            if (
                normalized
            ) {

                wrapper.dataset.uploadedUrl =
                    normalized;

            } else {

                delete wrapper.dataset.uploadedUrl;

            }


            return normalized;

        };


    wrapper.getSelectedFiles =
        () =>
            Array.from(
                fileInput.files || []
            );


    wrapper.getImageMode =
        () =>
            wrapper.dataset.imageMode ||
            "url";


    wrapper.clearUploadedFile =
        async () => {

            fileInput.value =
                "";


            urlInput.value =
                "";


            preview.innerHTML =
                "";


            preview.style.display =
                "none";


            delete wrapper.dataset.uploadedUrl;


            setMode(
                "url"
            );

        };


    wrapper.appendChild(
        modeSelector
    );


    wrapper.appendChild(
        urlContainer
    );


    wrapper.appendChild(
        uploadContainer
    );


    wrapper.appendChild(
        preview
    );


    setMode(
        "url"
    );


    return wrapper;

}


/* =========================================================
   ENUM
========================================================= */

function createEnumField(
    name,
    definition
) {

    const wrapper =
        document.createElement(
            "div"
        );


    wrapper.className =
        "generate-option-group";


    const enumValues =
        Array.isArray(
            definition?.enum
        )

            ? definition.enum

            : (
                Array.isArray(
                    definition?.options
                )
                    ? definition.options
                    : []
            );


    let defaultValue =
        getDefaultValue(
            definition
        );


    if (
        defaultValue ===
        undefined &&
        enumValues.length
    ) {

        defaultValue =
            enumValues[0];

    }


    enumValues.forEach(
        value => {

            const option =
                document.createElement(
                    "label"
                );


            option.className =
                "generate-option";


            const input =
                document.createElement(
                    "input"
                );


            input.type =
                "radio";


            input.name =
                `generate-radio-${name}`;


            input.value =
                String(
                    value
                );


            input.dataset.parameter =
                name;


            const optionLabel =
                document.createElement(
                    "span"
                );


            optionLabel.className =
                "generate-option-label";


            optionLabel.textContent =
                String(
                    value
                );


            if (
                String(
                    value
                ) ===
                String(
                    defaultValue
                )
            ) {

                input.checked =
                    true;

            }


            input.addEventListener(
                "change",
                () => {

                    wrapper
                        .querySelectorAll(
                            ".generate-option-label"
                        )
                        .forEach(
                            label => {

                                label.classList.remove(
                                    "active"
                                );

                            }
                        );


                    if (
                        input.checked
                    ) {

                        optionLabel.classList.add(
                            "active"
                        );

                    }

                }
            );


            option.appendChild(
                input
            );


            option.appendChild(
                optionLabel
            );


            wrapper.appendChild(
                option
            );

        }
    );


    const checked =
        wrapper.querySelector(
            "input:checked"
        );


    if (
        checked
    ) {

        checked
            .nextElementSibling
            ?.classList.add(
                "active"
            );

    }


    return wrapper;

}


/* =========================================================
   BOOLEAN
========================================================= */

function createBooleanField(
    definition,
    name
) {

    const wrapper =
        document.createElement(
            "label"
        );


    wrapper.className =
        "generate-checkbox-field";


    const input =
        document.createElement(
            "input"
        );


    input.type =
        "checkbox";


    input.name =
        name;


    input.dataset.parameter =
        name;


    input.checked =
        Boolean(
            getDefaultValue(
                definition
            )
        );


    const text =
        document.createElement(
            "span"
        );


    text.className =
        "generate-checkbox-label";


    text.textContent =
        "Aktif";


    wrapper.appendChild(
        input
    );


    wrapper.appendChild(
        text
    );


    return wrapper;

}


/* =========================================================
   NUMBER
========================================================= */

function createNumberField(
    definition,
    name
) {

    const input =
        document.createElement(
            "input"
        );


    input.type =
        "number";


    input.id =
        createFieldId(
            name
        );


    input.name =
        name;


    input.className =
        "form-control";


    input.dataset.parameter =
        name;


    const min =
        Number(
            definition?.min ??
            definition?.minimum
        );


    const max =
        Number(
            definition?.max ??
            definition?.maximum
        );


    if (
        Number.isFinite(
            min
        )
    ) {

        input.min =
            String(
                min
            );

    }


    if (
        Number.isFinite(
            max
        )
    ) {

        input.max =
            String(
                max
            );

    }


    input.step =
        String(
            definition?.type ||
            ""
        ).toLowerCase() ===
            "integer"

            ? "1"

            : "any";


    const defaultValue =
        getDefaultValue(
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


    return input;

}


/* =========================================================
   DURATION
========================================================= */

function createDurationField(
    definition,
    name
) {

    const wrapper =
        document.createElement(
            "div"
        );


    wrapper.className =
        "generate-duration-field";


    const top =
        document.createElement(
            "div"
        );


    top.className =
        "generate-duration-top";


    const title =
        document.createElement(
            "span"
        );


    title.textContent =
        getParameterLabel(
            name,
            definition
        );


    const valueLabel =
        document.createElement(
            "span"
        );


    valueLabel.className =
        "generate-duration-value";


    const range =
        document.createElement(
            "input"
        );


    range.type =
        "range";


    range.id =
        createFieldId(
            name
        );


    range.name =
        name;


    range.className =
        "generate-duration-range";


    range.dataset.parameter =
        name;


    let min =
        Number(
            definition?.min ??
            definition?.minimum
        );


    let max =
        Number(
            definition?.max ??
            definition?.maximum
        );


    if (
        !Number.isFinite(
            min
        )
    ) {

        min =
            1;

    }


    if (
        !Number.isFinite(
            max
        )
    ) {

        max =
            30;

    }


    const rawDefault =
        getDefaultValue(
            definition
        );


    const parsedDefault =
        Number(
            rawDefault
        );


    let value =
        Number.isFinite(
            parsedDefault
        )
            ? parsedDefault
            : min;


    value =
        Math.max(
            min,
            Math.min(
                max,
                value
            )
        );


    range.min =
        String(
            min
        );


    range.max =
        String(
            max
        );


    range.step =
        "1";


    range.value =
        String(
            value
        );


    valueLabel.textContent =
        `${value} detik`;


    top.appendChild(
        title
    );


    top.appendChild(
        valueLabel
    );


    wrapper.appendChild(
        top
    );


    wrapper.appendChild(
        range
    );


    const scale =
        document.createElement(
            "div"
        );


    scale.className =
        "generate-duration-scale";


    const minLabel =
        document.createElement(
            "span"
        );


    minLabel.textContent =
        `${min} detik`;


    const maxLabel =
        document.createElement(
            "span"
        );


    maxLabel.textContent =
        `${max} detik`;


    scale.appendChild(
        minLabel
    );


    scale.appendChild(
        maxLabel
    );


    wrapper.appendChild(
        scale
    );


    range.addEventListener(
        "input",
        () => {

            valueLabel.textContent =
                `${range.value} detik`;

        }
    );


    return wrapper;

}


/* =========================================================
   TEXTAREA
========================================================= */

function createTextareaField(
    definition,
    name
) {

    const textarea =
        document.createElement(
            "textarea"
        );


    textarea.id =
        createFieldId(
            name
        );


    textarea.name =
        name;


    textarea.className =
        "form-control";


    textarea.dataset.parameter =
        name;


    textarea.rows =
        5;


    textarea.placeholder =
        definition?.placeholder ||
        "Masukkan prompt...";


    const maxLength =
        Number(
            definition?.maxLength ??
            definition?.max_length
        );


    if (
        Number.isFinite(
            maxLength
        )
    ) {

        textarea.maxLength =
            maxLength;

    }


    const defaultValue =
        getDefaultValue(
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


    return textarea;

}


/* =========================================================
   TEXT
========================================================= */

function createTextField(
    definition,
    name
) {

    const input =
        document.createElement(
            "input"
        );


    input.type =
        "text";


    input.id =
        createFieldId(
            name
        );


    input.name =
        name;


    input.className =
        "form-control";


    input.dataset.parameter =
        name;


    input.placeholder =
        definition?.placeholder ||
        "";


    const maxLength =
        Number(
            definition?.maxLength ??
            definition?.max_length
        );


    if (
        Number.isFinite(
            maxLength
        )
    ) {

        input.maxLength =
            maxLength;

    }


    const defaultValue =
        getDefaultValue(
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


    return input;

}


/* =========================================================
   SELECT
========================================================= */

function createSelectField(
    definition,
    name
) {

    const select =
        document.createElement(
            "select"
        );


    select.id =
        createFieldId(
            name
        );


    select.name =
        name;


    select.className =
        "form-control";


    select.dataset.parameter =
        name;


    const options =
        Array.isArray(
            definition?.options
        )

            ? definition.options

            : [];


    options.forEach(
        optionValue => {

            const option =
                document.createElement(
                    "option"
                );


            if (
                optionValue &&
                typeof optionValue ===
                "object"
            ) {

                option.value =
                    String(
                        optionValue.value ??
                        optionValue.id ??
                        ""
                    );


                option.textContent =
                    String(
                        optionValue.label ??
                        optionValue.name ??
                        option.value
                    );

            }

            else {

                option.value =
                    String(
                        optionValue
                    );


                option.textContent =
                    String(
                        optionValue
                    );

            }


            select.appendChild(
                option
            );

        }
    );


    const defaultValue =
        getDefaultValue(
            definition
        );


    if (
        defaultValue !==
        undefined
    ) {

        select.value =
            String(
                defaultValue
            );

    }


    return select;

}


/* =========================================================
   CREATE INPUT
========================================================= */

function createFieldInput(
    name,
    definition
) {

    const type =
        String(
            definition?.type ||
            "string"
        )
            .trim()
            .toLowerCase();


    if (
        name ===
            "image_urls" ||
        name ===
            "image_url"
    ) {

        return createImageField(
            definition,
            name
        );

    }


    if (
        Array.isArray(
            definition?.enum
        ) &&
        definition.enum.length
    ) {

        return createEnumField(
            name,
            definition
        );

    }


    if (
        Array.isArray(
            definition?.options
        ) &&
        definition.options.length
    ) {

        return createSelectField(
            definition,
            name
        );

    }


    if (
        type ===
        "boolean"
    ) {

        return createBooleanField(
            definition,
            name
        );

    }


    if (
        name ===
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


    const maxLength =
        Number(
            definition?.maxLength ??
            definition?.max_length
        );


    if (
        name ===
            "prompt" ||
        name ===
            "description" ||
        name ===
            "negative_prompt" ||
        (
            Number.isFinite(
                maxLength
            ) &&
            maxLength >
                500
        )
    ) {

        return createTextareaField(
            definition,
            name
        );

    }


    return createTextField(
        definition,
        name
    );

}


/* =========================================================
   RENDER PARAMETER
========================================================= */

function renderParameter(
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
   ---------------------------------------------------------
   PERBAIKAN LAYOUT:
   - Desktop = 2 kolom
   - Mobile = 1 kolom
   - Field biasa = 1 kolom
   - Prompt / image = full width
   - Memaksa direct child grid agar tidak kembali vertikal
========================================================= */

function forceContainerVisible(
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


    /*
     * =====================================================
     * CONTAINER
     * =====================================================
     */

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


    /*
     * =====================================================
     * MOBILE
     * =====================================================
     */

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


    /*
     * =====================================================
     * FIELD CHILDREN
     * =====================================================
     */

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


            /*
             * Pastikan field benar-benar
             * menjadi item grid.
             */

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


            /*
             * Prompt / image full width.
             */

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
                    "image_url";


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
   FIND FIELD
========================================================= */

function findField(
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

function readFieldValue(
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

function normalizeParameterValue(
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

        return normalizeArray(
            value
        );

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


/* =========================================================
   IMAGE UPLOAD
========================================================= */

function createImageStoragePath(
    userId,
    file
) {

    const safeUserId =
        String(
            userId ||
            "anonymous"
        )
            .replace(
                /[^a-zA-Z0-9_-]/g,
                ""
            );


    const originalName =
        String(
            file?.name ||
            "image"
        );


    const extensionMatch =
        originalName.match(
            /\.([a-zA-Z0-9]+)$/
        );


    const extension =
        extensionMatch
            ? extensionMatch[1]
                .toLowerCase()
                .replace(
                    /[^a-z0-9]/g,
                    ""
                )
            : "jpg";


    const randomPart =
        (
            typeof crypto !==
                "undefined" &&
            typeof crypto.randomUUID ===
                "function"
        )

            ? crypto.randomUUID()

            : (
                Date.now().toString(36) +
                "-" +
                Math.random()
                    .toString(36)
                    .slice(2, 12)
            );


    return (
        "generate-input/" +
        safeUserId +
        "/" +
        randomPart +
        "." +
        extension
    );

}


function validateImageFile(
    file
) {

    if (
        !file
    ) {

        throw new Error(
            "File gambar tidak ditemukan."
        );

    }


    if (
        !ALLOWED_IMAGE_TYPES.has(
            file.type
        )
    ) {

        throw new Error(
            "Format gambar tidak didukung. Gunakan JPG, PNG, atau WebP."
        );

    }


    if (
        file.size >
        MAX_IMAGE_SIZE
    ) {

        throw new Error(
            "Ukuran gambar maksimal 10 MB."
        );

    }


    return true;

}


async function uploadImageFile(
    file
) {

    validateImageFile(
        file
    );


    const supabase =
        getSupabaseClient();


    if (
        !supabase ||
        !supabase.storage
    ) {

        throw new Error(
            "Supabase Storage belum tersedia."
        );

    }


    const user =
        getCurrentUser();


    const userId =
        user?.id ||
        user?.user?.id ||
        "";


    if (
        !userId
    ) {

        throw new Error(
            "User belum terautentikasi untuk upload gambar."
        );

    }


    const path =
        createImageStoragePath(
            userId,
            file
        );


    console.debug(
        "[GEN-Z.AI][Generate Form] Upload gambar:",
        {
            bucket:
                STORAGE_BUCKET,

            path,

            name:
                file.name,

            type:
                file.type,

            size:
                file.size
        }
    );


    const {
        error:
            uploadError
    } =
        await supabase.storage
            .from(
                STORAGE_BUCKET
            )
            .upload(
                path,
                file,
                {
                    cacheControl:
                        "3600",

                    upsert:
                        false,

                    contentType:
                        file.type
                }
            );


    if (
        uploadError
    ) {

        console.error(
            "[GEN-Z.AI][Generate Form] Upload gambar gagal:",
            uploadError
        );


        throw uploadError;

    }


    const publicResult =
        supabase.storage
            .from(
                STORAGE_BUCKET
            )
            .getPublicUrl(
                path
            );


    const publicUrl =
        String(
            publicResult?.data?.publicUrl ||
            ""
        ).trim();


    if (
        !publicUrl
    ) {

        throw new Error(
            "Upload berhasil tetapi URL publik gambar tidak tersedia."
        );

    }


    console.debug(
        "[GEN-Z.AI][Generate Form] Upload gambar berhasil:",
        publicUrl
    );


    return {
        path,
        url:
            publicUrl
    };

}


async function resolveImageParameterValue(
    imageInput,
    definition
) {

    if (
        !imageInput
    ) {

        return [];

    }


    const mode =
        typeof imageInput.getInputMode ===
        "function"

            ? imageInput.getInputMode()

            : (
                imageInput.dataset.imageMode ||
                "url"
            );


    if (
        mode !==
        "upload"
    ) {

        const urlInput =
            typeof imageInput.getUrlInput ===
            "function"

                ? imageInput.getUrlInput()

                : imageInput.querySelector(
                    'input[type="url"]'
                );


        const url =
            String(
                urlInput?.value ||
                ""
            ).trim();


        if (
            !url
        ) {

            return [];

        }


        return [
            url
        ];

    }


    const existingUrl =
        typeof imageInput.getUploadedUrl ===
        "function"

            ? imageInput.getUploadedUrl()

            : String(
                imageInput.dataset.uploadedUrl ||
                ""
            ).trim();


    if (
        existingUrl
    ) {

        return [
            existingUrl
        ];

    }


    const fileInput =
        typeof imageInput.getFileInput ===
        "function"

            ? imageInput.getFileInput()

            : imageInput.querySelector(
                ".generate-image-file"
            );


    const files =
        Array.from(
            fileInput?.files ||
            []
        );


    if (
        !files.length
    ) {

        return [];

    }


    const configuredMaxItems =
        Number(
            definition?.maxItems ??
            definition?.max_items
        );


    const maxItems =
        Number.isFinite(
            configuredMaxItems
        ) &&
        configuredMaxItems > 0

            ? Math.floor(
                configuredMaxItems
            )

            : 1;


    const selectedFiles =
        files.slice(
            0,
            maxItems
        );


    const uploadedUrls =
        [];


    for (
        const file
        of selectedFiles
    ) {

        const uploaded =
            await uploadImageFile(
                file
            );


        if (
            uploaded?.url
        ) {

            uploadedUrls.push(
                uploaded.url
            );

        }

    }


    if (
        uploadedUrls.length
    ) {

        imageInput.dataset.uploadedUrl =
            uploadedUrls[0];

    }


    return uploadedUrls;

}


/* =========================================================
   GET FORM PARAMETERS
========================================================= */

export async function getFormParameters(
    modelArgument = null
) {

    const definitions =
        getParameterDefinitions(
            modelArgument
        );


    const names =
        getOrderedParameterNames(
            definitions
        );


    const parameters =
        {};


    for (
        const name
        of names
    ) {

        if (
            isClientForbiddenParameter(
                name
            )
        ) {

            continue;

        }


        const field =
            findField(
                name
            );


        if (
            !field
        ) {

            continue;

        }


        const definition =
            definitions[name];


        if (
            name ===
                "image_urls" ||
            name ===
                "image_url"
        ) {

            const imageInput =
                field.querySelector(
                    ".generate-image-input"
                );


            if (
                !imageInput
            ) {

                continue;

            }


            let images =
                [];


            try {

                images =
                    await resolveImageParameterValue(
                        imageInput,
                        definition
                    );

            } catch (
                error
            ) {

                console.error(
                    "[GEN-Z.AI][Generate Form] Upload gambar gagal:",
                    error
                );


                throw new Error(
                    error?.message ||
                    "Gagal mengupload gambar referensi."
                );

            }


            if (
                !images.length
            ) {

                continue;

            }


            const maxItemsRaw =
                Number(
                    definition?.maxItems ??
                    definition?.max_items
                );


            const maxItems =
                Number.isFinite(
                    maxItemsRaw
                ) &&
                maxItemsRaw > 0

                    ? Math.floor(
                        maxItemsRaw
                    )

                    : 1;


            const normalizedImages =
                images.slice(
                    0,
                    maxItems
                );


            if (
                name ===
                "image_url"
            ) {

                parameters.image_url =
                    normalizedImages[0];

            } else {

                parameters.image_urls =
                    normalizedImages;

            }


            continue;

        }


        const value =
            readFieldValue(
                field
            );


        if (
            String(
                definition?.type ||
                ""
            )
                .trim()
                .toLowerCase() ===
            "boolean"
        ) {

            parameters[name] =
                Boolean(
                    value
                );


            continue;

        }


        if (
            value ===
                undefined ||
            value ===
                null ||
            value ===
                ""
        ) {

            continue;

        }


        parameters[name] =
            normalizeParameterValue(
                name,
                value,
                definition
            );

    }


    delete parameters.task_id;
    delete parameters.index;
    delete parameters.nsfw_checker;


    console.debug(
        "[GEN-Z.AI][Generate Form] FORM PARAMETERS:",
        parameters
    );


    console.debug(
        "[GEN-Z.AI][Generate Form] REFERENCE IMAGE:",
        {
            image_urls:
                Array.isArray(
                    parameters.image_urls
                )
                    ? parameters.image_urls.length
                    : 0,

            image_url:
                parameters.image_url
                    ? "present"
                    : "missing",

            hasReferenceImage:
                (
                    (
                        Array.isArray(
                            parameters.image_urls
                        ) &&
                        parameters.image_urls.length >
                            0
                    ) ||
                    Boolean(
                        parameters.image_url
                    )
                )
        }
    );


    return parameters;

}


/* =========================================================
   GET FORM DATA
========================================================= */

export function getFormData(
    modelArgument = null
) {

    return getFormParameters(
        modelArgument
    );

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


    if (
        name ===
            "image_urls" ||
        name ===
            "image_url"
    ) {

        const imageInput =
            field.querySelector(
                ".generate-image-input"
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


        return true;

    }


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
   ---------------------------------------------------------
   PERBAIKAN:
   - Seedance tidak boleh di-render ulang saat Reset
   - Struktur/layout Seedance dipertahankan
   - Semua input dikembalikan ke nilai default
   - File upload dibersihkan
   - Preview dibersihkan
   - Toggle dikembalikan ke default
   - Model lain tetap menggunakan render ulang normal
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


    /*
     * =====================================================
     * SEEDANCE
     * =====================================================
     *
     * Seedance mempunyai renderer dan layout khusus.
     *
     * JANGAN memanggil:
     *
     *     renderGenerateForm()
     *
     * karena itu akan menghapus:
     *
     *     .seedance-form
     *
     * lalu menggantinya dengan generic form renderer.
     *
     * Kita reset langsung elemen yang sudah ada.
     */

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


        /*
         * -------------------------------------------------
         * INPUT TEXT / TEXTAREA
         * -------------------------------------------------
         */

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


        /*
         * -------------------------------------------------
         * SELECT
         * -------------------------------------------------
         */

        seedanceForm
            .querySelectorAll(
                "select"
            )
            .forEach(
                select => {

                    /*
                     * Kembalikan ke option pertama
                     * jika tidak ada selected default.
                     */

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


        /*
         * -------------------------------------------------
         * RADIO
         * -------------------------------------------------
         */

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


        /*
         * -------------------------------------------------
         * CHECKBOX / TOGGLE
         * -------------------------------------------------
         */

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


        /*
         * -------------------------------------------------
         * FILE INPUT
         * -------------------------------------------------
         */

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


        /*
         * -------------------------------------------------
         * UPLOAD COMPONENT
         * -------------------------------------------------
         *
         * Jika renderer Seedance mempunyai method
         * clearUploadedFile(), gunakan method tersebut
         * supaya state internal renderer ikut dibersihkan.
         */

        const uploads =
            seedanceForm.querySelectorAll(
                ".generate-image-input"
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
                        "[GEN-Z.AI][Generate Form] Reset upload Seedance gagal:",
                        error
                    );

                }

            }

        }


        /*
         * -------------------------------------------------
         * PREVIEW / SELECTED FILES
         * -------------------------------------------------
         */

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


        /*
         * -------------------------------------------------
         * UPLOADED URL / DATASET
         * -------------------------------------------------
         */

        seedanceForm
            .querySelectorAll(
                "[data-uploaded-url]"
            )
            .forEach(
                element => {

                    delete element.dataset.uploadedUrl;

                }
            );


        /*
         * -------------------------------------------------
         * TEXT COUNTER
         * -------------------------------------------------
         */

        seedanceForm
            .querySelectorAll(
                "[data-counter], " +
                ".seedance-counter, " +
                ".char-counter"
            )
            .forEach(
                counter => {

                    /*
                     * Jangan menghapus struktur counter.
                     * Hanya reset angka jika memang
                     * menggunakan pola angka.
                     */

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


        /*
         * -------------------------------------------------
         * TOGGLE VISUAL STATE
         * -------------------------------------------------
         *
         * Beberapa renderer Seedance memakai class
         * untuk menampilkan Aktif / Nonaktif.
         *
         * Setelah checkbox dikembalikan ke default,
         * kirim event supaya renderer memperbarui
         * visualnya sendiri.
         */

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


        /*
         * -------------------------------------------------
         * PASTIKAN LAYOUT TETAP HIDUP
         * -------------------------------------------------
         */

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


        /*
         * PENTING:
         *
         * Tidak ada:
         *
         *     container.innerHTML = "";
         *
         * Tidak ada:
         *
         *     renderGenerateForm();
         *
         * Jadi .seedance-form tetap berada
         * di tempatnya.
         */

        console.debug(
            "[GEN-Z.AI][Generate Form] Reset Seedance selesai. Layout dipertahankan."
        );


        return;

    }


    /*
     * =====================================================
     * MODEL NON-SEEDANCE
     * =====================================================
     *
     * Perilaku model lama tetap dipertahankan.
     */

    const uploads =
        container.querySelectorAll(
            ".generate-image-input"
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

export function getMediaParameters(
    modelArgument = null
) {

    const data =
        getFormParameters(
            modelArgument
        );


    return {

        image_urls:
            Array.isArray(
                data.image_urls
            )
                ? data.image_urls
                : []

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
        )
    ) {

        return null;

    }


    const definitions =
        getParameterDefinitions(
            modelArgument
        );


    return (
        definitions[name] ||
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
