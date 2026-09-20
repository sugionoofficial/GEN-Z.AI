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
 *
 * "index" sengaja tidak dimasukkan.
 */

const PARAMETER_ORDER = [
    "image_urls",
    "image_url",
    "prompt",
    "mode",
    "aspect_ratio",
    "duration",
    "resolution",
    "nsfw_checker"
];


/* =========================================================
   DOM
========================================================= */

function getContainer() {

    const elements =
        getGenerateElements();

    return (
        elements?.dynamicFields ||
        document.getElementById(
            "dynamicFields"
        ) ||
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


    /*
     * Semua kemungkinan struktur parameter
     * yang berasal dari konfigurasi model.
     */

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


    /*
     * Nested API response.
     */

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


    /*
     * JSON STRING
     */

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


    /*
     * ARRAY
     *
     * [
     *   {
     *      name: "prompt",
     *      type: "string"
     *   }
     * ]
     */

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


    /*
     * OBJECT
     */

    if (
        typeof value !==
        "object"
    ) {

        return {};

    }


    /*
     * Nested parameters.
     */

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


    /*
     * JSON Schema properties.
     */

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


    /*
     * input_schema.properties
     */

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


    /*
     * schema.properties
     */

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


    /*
     * Plain parameter object.
     */

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


            /*
             * Metadata bukan parameter.
             */

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


            /*
             * Primitive definition.
             */

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
            "Resolution",

        nsfw_checker:
            "NSFW Checker"

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
   INTERNAL
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
        isInternalParameter(
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


    wrapper.style.width =
        "100%";


    wrapper.style.visibility =
        "visible";


    wrapper.style.opacity =
        "1";


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


    /*
     * JSON ARRAY
     */

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


    /*
     * PostgreSQL ARRAY
     */

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


    /*
     * CSV
     */

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
    name,
    definition
) {

    const wrapper =
        document.createElement(
            "div"
        );


    wrapper.className =
        "generate-image-input";


    wrapper.dataset.parameter =
        name;


    wrapper.style.width =
        "100%";


    wrapper.style.visibility =
        "visible";


    wrapper.style.opacity =
        "1";


    let mode =
        "url";


    let uploadedPath =
        "";


    let uploadedUrl =
        "";


    /*
     * MODE BUTTONS
     */

    const modeGroup =
        document.createElement(
            "div"
        );


    modeGroup.className =
        "generate-image-mode";


    const urlButton =
        document.createElement(
            "button"
        );


    urlButton.type =
        "button";


    urlButton.className =
        "generate-image-mode-button active";


    urlButton.textContent =
        "Gunakan URL";


    const uploadButton =
        document.createElement(
            "button"
        );


    uploadButton.type =
        "button";


    uploadButton.className =
        "generate-image-mode-button";


    uploadButton.textContent =
        "Upload Gambar";


    modeGroup.appendChild(
        urlButton
    );


    modeGroup.appendChild(
        uploadButton
    );


    wrapper.appendChild(
        modeGroup
    );


    /*
     * URL PANEL
     */

    const urlPanel =
        document.createElement(
            "div"
        );


    urlPanel.className =
        "generate-image-url-panel";


    const urlInput =
        document.createElement(
            "input"
        );


    urlInput.type =
        "url";


    urlInput.id =
        createFieldId(
            name
        );


    urlInput.name =
        name;


    urlInput.className =
        "form-control";


    urlInput.placeholder =
        "Tempel URL gambar...";


    urlInput.autocomplete =
        "off";


    const defaultImages =
        normalizeArray(
            getDefaultValue(
                definition
            )
        );


    if (
        defaultImages.length
    ) {

        urlInput.value =
            defaultImages[0];

    }


    urlPanel.appendChild(
        urlInput
    );


    wrapper.appendChild(
        urlPanel
    );


    /*
     * UPLOAD PANEL
     */

    const uploadPanel =
        document.createElement(
            "div"
        );


    uploadPanel.className =
        "generate-image-upload-panel";


    uploadPanel.hidden =
        true;


    const fileInput =
        document.createElement(
            "input"
        );


    fileInput.type =
        "file";


    fileInput.accept =
        "image/jpeg,image/png,image/webp";


    fileInput.hidden =
        true;


    const chooseButton =
        document.createElement(
            "button"
        );


    chooseButton.type =
        "button";


    chooseButton.className =
        "generate-image-upload-button";


    chooseButton.textContent =
        "+ Tambah Gambar";


    const status =
        document.createElement(
            "div"
        );


    status.className =
        "generate-image-upload-status";


    const preview =
        document.createElement(
            "div"
        );


    preview.className =
        "generate-image-preview";


    preview.hidden =
        true;


    const previewImage =
        document.createElement(
            "img"
        );


    previewImage.className =
        "generate-image-preview-image";


    previewImage.alt =
        "Preview gambar";


    const removeButton =
        document.createElement(
            "button"
        );


    removeButton.type =
        "button";


    removeButton.className =
        "generate-image-remove";


    removeButton.textContent =
        "×";


    preview.appendChild(
        previewImage
    );


    preview.appendChild(
        removeButton
    );


    uploadPanel.appendChild(
        fileInput
    );


    uploadPanel.appendChild(
        chooseButton
    );


    uploadPanel.appendChild(
        status
    );


    uploadPanel.appendChild(
        preview
    );


    wrapper.appendChild(
        uploadPanel
    );


    /*
     * URL MODE
     */

    urlButton.addEventListener(
        "click",
        () => {

            mode =
                "url";


            urlPanel.hidden =
                false;


            uploadPanel.hidden =
                true;


            urlButton.classList.add(
                "active"
            );


            uploadButton.classList.remove(
                "active"
            );

        }
    );


    /*
     * UPLOAD MODE
     */

    uploadButton.addEventListener(
        "click",
        () => {

            mode =
                "upload";


            urlPanel.hidden =
                true;


            uploadPanel.hidden =
                false;


            urlButton.classList.remove(
                "active"
            );


            uploadButton.classList.add(
                "active"
            );

        }
    );


    /*
     * CHOOSE
     */

    chooseButton.addEventListener(
        "click",
        () => {

            fileInput.click();

        }
    );


    /*
     * UPLOAD
     */

    fileInput.addEventListener(
        "change",
        async event => {

            const file =
                event.target.files?.[0];


            if (
                !file
            ) {

                return;

            }


            if (
                !ALLOWED_IMAGE_TYPES.has(
                    String(
                        file.type ||
                        ""
                    ).toLowerCase()
                )
            ) {

                status.textContent =
                    "Format gambar harus JPG, PNG, atau WebP.";


                fileInput.value =
                    "";


                return;

            }


            if (
                Number(
                    file.size
                ) >
                MAX_IMAGE_SIZE
            ) {

                status.textContent =
                    "Ukuran gambar maksimal 10 MB.";


                fileInput.value =
                    "";


                return;

            }


            const client =
                getSupabaseClient();


            const user =
                getCurrentUser();


            if (
                !client ||
                !client.storage
            ) {

                status.textContent =
                    "Storage belum tersedia.";


                return;

            }


            if (
                !user?.id
            ) {

                status.textContent =
                    "Session user belum tersedia.";


                return;

            }


            chooseButton.disabled =
                true;


            status.textContent =
                "Mengunggah gambar...";


            const extensionMap = {

                "image/jpeg":
                    "jpg",

                "image/png":
                    "png",

                "image/webp":
                    "webp"

            };


            const extension =
                extensionMap[
                    file.type
                ] ||
                "jpg";


            const randomPart =
                globalThis.crypto &&
                typeof globalThis.crypto.randomUUID ===
                    "function"

                    ? globalThis.crypto.randomUUID()

                    : (
                        Date.now() +
                        "-" +
                        Math.random()
                            .toString(36)
                            .slice(2)
                    );


            const path =
                "generate-inputs/" +
                user.id +
                "/" +
                Date.now() +
                "-" +
                randomPart +
                "." +
                extension;


            try {

                const result =
                    await client
                        .storage
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
                    result?.error
                ) {

                    throw result.error;

                }


                uploadedPath =
                    path;


                const publicResult =
                    client
                        .storage
                        .from(
                            STORAGE_BUCKET
                        )
                        .getPublicUrl(
                            path
                        );


                uploadedUrl =
                    publicResult
                        ?.data
                        ?.publicUrl ||
                    "";


                if (
                    !uploadedUrl
                ) {

                    throw new Error(
                        "Public URL gambar tidak tersedia."
                    );

                }


                urlInput.value =
                    "";


                previewImage.src =
                    uploadedUrl;


                preview.hidden =
                    false;


                status.textContent =
                    "Gambar berhasil diunggah.";


            } catch (
                error
            ) {

                console.error(
                    "[GEN-Z.AI][Generate Form] Upload error:",
                    error
                );


                status.textContent =
                    error?.message ||
                    "Upload gambar gagal.";


            } finally {

                chooseButton.disabled =
                    false;


                fileInput.value =
                    "";

            }

        }
    );


    /*
     * REMOVE
     */

    removeButton.addEventListener(
        "click",
        async () => {

            const path =
                uploadedPath;


            uploadedPath =
                "";


            uploadedUrl =
                "";


            previewImage.removeAttribute(
                "src"
            );


            preview.hidden =
                true;


            status.textContent =
                "";


            if (
                !path
            ) {

                return;

            }


            const client =
                getSupabaseClient();


            if (
                !client ||
                !client.storage
            ) {

                return;

            }


            try {

                await client
                    .storage
                    .from(
                        STORAGE_BUCKET
                    )
                    .remove([
                        path
                    ]);

            } catch (
                error
            ) {

                console.warn(
                    "[GEN-Z.AI][Generate Form] Gagal menghapus upload:",
                    error
                );

            }

        }
    );


    /*
     * PUBLIC HELPERS
     */

    wrapper.getInputMode =
        () =>
            mode;


    wrapper.getUrlInput =
        () =>
            urlInput;


    wrapper.getUploadedUrl =
        () =>
            uploadedUrl;


    wrapper.clearUploadedFile =
        async () => {

            await removeButton.click();

        };


    wrapper.setMode =
        nextMode => {

            if (
                nextMode ===
                "upload"
            ) {

                uploadButton.click();

            } else {

                urlButton.click();

            }

        };


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


    /*
     * IMAGE
     */

    if (
        name ===
            "image_urls" ||
        name ===
            "image_url"
    ) {

        return createImageField(
            name,
            definition
        );

    }


    /*
     * ENUM
     */

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


    /*
     * OPTIONS
     */

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


    /*
     * BOOLEAN
     */

    if (
        type ===
        "boolean"
    ) {

        return createBooleanField(
            definition,
            name
        );

    }


    /*
     * DURATION
     */

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


    /*
     * NUMBER
     */

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


    /*
     * TEXTAREA
     */

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


    /*
     * DEFAULT TEXT
     */

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


    /*
     * Duration sudah mempunyai
     * title sendiri.
     */

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


    /*
     * CLEAR
     */

    container.innerHTML =
        "";


    /*
     * PARAMETERS
     */

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


    /*
     * EMPTY
     */

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


    /*
     * RENDER
     */

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


    container.style.setProperty(
        "display",
        "grid",
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


    /*
     * IMAGE
     */

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

                : "url";


        if (
            mode ===
            "upload"
        ) {

            return (
                typeof imageInput.getUploadedUrl ===
                "function"

                    ? imageInput.getUploadedUrl()

                    : ""
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


    /*
     * RADIO
     */

    const radio =
        field.querySelector(
            'input[type="radio"]:checked'
        );


    if (
        radio
    ) {

        return radio.value;

    }


    /*
     * CHECKBOX
     */

    const checkbox =
        field.querySelector(
            'input[type="checkbox"]'
        );


    if (
        checkbox
    ) {

        return checkbox.checked;

    }


    /*
     * NORMAL
     */

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


    /*
     * IMAGE
     */

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


    /*
     * BOOLEAN
     */

    if (
        type ===
        "boolean"
    ) {

        return Boolean(
            value
        );

    }


    /*
     * NUMBER
     */

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
   GET FORM PARAMETERS
========================================================= */

export function getFormParameters(
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


    names.forEach(
        name => {

            /*
             * Safety:
             * parameter internal tidak pernah
             * ikut dikirim.
             */

            if (
                isInternalParameter(
                    name
                )
            ) {

                return;

            }


            const field =
                findField(
                    name
                );


            if (
                !field
            ) {

                return;

            }


            const value =
                readFieldValue(
                    field
                );


            const definition =
                definitions[name];


            /*
             * IMAGE
             */

            if (
                name ===
                    "image_urls" ||
                name ===
                    "image_url"
            ) {

                const images =
                    normalizeArray(
                        value
                    );


                const maxItems =
                    Math.max(
                        1,
                        Number(
                            definition?.maxItems ??
                            definition?.max_items
                        ) ||
                        1
                    );


                if (
                    images.length
                ) {

                    parameters.image_urls =
                        images.slice(
                            0,
                            maxItems
                        );

                }


                return;

            }


            /*
             * BOOLEAN
             */

            if (
                String(
                    definition?.type ||
                    ""
                ).toLowerCase() ===
                "boolean"
            ) {

                parameters[name] =
                    Boolean(
                        value
                    );


                return;

            }


            /*
             * EMPTY
             */

            if (
                value ===
                    undefined ||
                value ===
                    null ||
                value ===
                    ""
            ) {

                return;

            }


            parameters[name] =
                normalizeParameterValue(
                    name,
                    value,
                    definition
                );

        }
    );


    /*
     * Final safety.
     */

    delete parameters.task_id;
    delete parameters.index;


    console.debug(
        "[GEN-Z.AI][Generate Form] FORM PARAMETERS:",
        parameters
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
        isInternalParameter(
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


    /*
     * IMAGE
     */

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


    /*
     * RADIO
     */

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


    /*
     * CHECKBOX
     */

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


    /*
     * SELECT / INPUT / TEXTAREA
     */

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


    /*
     * Hapus upload terlebih dahulu.
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
        isInternalParameter(
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
