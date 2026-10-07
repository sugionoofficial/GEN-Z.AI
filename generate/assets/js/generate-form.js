/* =========================================================
   GEN-Z.AI
   ---------------------------------------------------------
   File:
   generate/assets/js/generate-form.js

   Fungsi:
   - Dynamic parameter form renderer
   - Image upload / URL
   - Audio upload / URL
   - Parameter normalization
   - Motiongen-AI specific handling
   - Resolution mapping
   - Forbidden parameter filtering
   - Form value collection
   - Seedance form compatibility
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

const INTERNAL_PARAMETERS = new Set([
    "task_id",
    "index"
]);

const SERVER_CONTROLLED_PARAMETERS = new Set([
    "nsfw_checker"
]);

const CLIENT_FORBIDDEN_PARAMETERS = new Set([
    "webhook_url",
    "webhook"
]);

const STORAGE_BUCKET = "dashboard-videos";

const ALLOWED_IMAGE_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp"
]);

const MOTIONGEN_ALLOWED_IMAGE_TYPES = new Set([
    "image/jpeg",
    "image/png"
]);

const ALLOWED_AUDIO_TYPES = new Set([
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/x-wav",
    "audio/wave"
]);

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

const MOTIONGEN_MODEL_ID =
    "digital-human-lipsync-image";

const MOTIONGEN_PROVIDER_ID =
    "motiongen";

const MOTIONGEN_RESOLUTION_VALUES = [
    "480p",
    "720p"
];

const MOTIONGEN_RESOLUTION_LABELS = Object.freeze({
    "480p": "576P",
    "720p": "720P HD"
});

const MOTIONGEN_RESOLUTION_ALIASES = Object.freeze({
    "576p": "480p",
    "576": "480p",
    "480p": "480p",
    "720p": "720p",
    "720": "720p",
    "720p hd": "720p"
});

const PARAMETER_ORDER = [
    "image_urls",
    "image_url",
    "audio_url",
    "prompt",
    "mode",
    "aspect_ratio",
    "duration",
    "resolution"
];

const FULL_WIDTH_PARAMETERS = new Set([
    "image_urls",
    "image_url",
    "audio_url",
    "prompt",
    "negative_prompt",
    "description"
]);


/* =========================================================
   BASIC HELPERS
========================================================= */

function getContainer() {
    const elements =
        typeof getGenerateElements === "function"
            ? getGenerateElements()
            : null;

    if (
        elements &&
        elements.dynamicFields
    ) {
        return elements.dynamicFields;
    }

    return document.getElementById(
        "dynamicFields"
    );
}


function resolveModel(modelArgument = null) {

    if (modelArgument) {
        return modelArgument;
    }

    try {
        return getCurrentModel();
    } catch (error) {
        console.warn(
            "[GEN-Z.AI Generate] Unable to resolve current model:",
            error
        );

        return null;
    }
}


function getModelId(model) {

    if (!model) {
        return "";
    }

    return String(
        model.model_id ||
        model.modelId ||
        model.id ||
        model.model ||
        ""
    ).trim();
}


function getProviderId(model) {

    if (!model) {
        return "";
    }

    return String(
        model.provider_id ||
        model.providerId ||
        model.provider ||
        ""
    ).trim();
}


function isMotiongenModel(modelArgument = null) {

    const model =
        resolveModel(modelArgument);

    if (!model) {
        return false;
    }

    const modelId =
        getModelId(model).toLowerCase();

    const providerId =
        getProviderId(model).toLowerCase();

    return (
        modelId ===
            MOTIONGEN_MODEL_ID.toLowerCase()
        ||
        (
            modelId ===
                MOTIONGEN_MODEL_ID.toLowerCase()
            &&
            providerId ===
                MOTIONGEN_PROVIDER_ID
        )
    );
}


/* =========================================================
   RESOLUTION HELPERS
========================================================= */

function normalizeMotiongenResolution(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    const raw =
        String(value).trim();

    if (!raw) {
        return "";
    }

    if (
        MOTIONGEN_RESOLUTION_VALUES.includes(
            raw
        )
    ) {
        return raw;
    }

    const normalized =
        raw.toLowerCase();

    return (
        MOTIONGEN_RESOLUTION_ALIASES[
            normalized
        ] ||
        ""
    );
}


function getMotiongenResolutionLabel(
    value
) {

    const normalized =
        normalizeMotiongenResolution(
            value
        );

    return (
        MOTIONGEN_RESOLUTION_LABELS[
            normalized
        ] ||
        String(value ?? "")
    );
}


/* =========================================================
   PARAMETER DEFINITIONS
========================================================= */

function getParameterDefinitions(
    modelArgument = null
) {

    const model =
        resolveModel(modelArgument);

    if (!model) {
        return {};
    }

    const possibleSources = [
        model.parameters,
        model.parameter_schema,
        model.input_schema,
        model.schema,
        model.config?.parameters,
        model.config?.parameter_schema,
        model.config?.input_schema,
        model.config?.schema,
        model.repository?.parameters,
        model.repository?.parameter_schema,
        model.repository?.input_schema,
        model.repository?.schema,
        model.model?.parameters,
        model.model?.parameter_schema,
        model.model?.input_schema,
        model.model?.schema,
        model.data?.parameters,
        model.data?.parameter_schema,
        model.data?.input_schema,
        model.data?.schema
    ];

    let normalizedDefinitions = null;

    for (
        const source
        of possibleSources
    ) {

        const normalized =
            normalizeParameterDefinitions(
                source
            );

        if (
            normalized &&
            Object.keys(normalized).length
        ) {
            normalizedDefinitions =
                normalized;

            break;
        }
    }

    if (!normalizedDefinitions) {
        normalizedDefinitions = {};
    }

    /* =====================================================
       MOTIONGEN RESOLUTION
    ===================================================== */

    if (
        isMotiongenModel(model)
    ) {

        let supportedResolutions = [];

        if (
            Array.isArray(
                model.supported_resolutions
            )
        ) {

            supportedResolutions =
                model.supported_resolutions;
        }

        if (
            !supportedResolutions.length &&
            Array.isArray(
                model.supportedResolutions
            )
        ) {

            supportedResolutions =
                model.supportedResolutions;
        }

        if (
            !supportedResolutions.length &&
            Array.isArray(
                model.config?.supported_resolutions
            )
        ) {

            supportedResolutions =
                model.config
                    .supported_resolutions;
        }

        if (
            !supportedResolutions.length &&
            Array.isArray(
                model.data?.supported_resolutions
            )
        ) {

            supportedResolutions =
                model.data
                    .supported_resolutions;
        }

        const mappedResolutions =
            supportedResolutions
                .map(
                    normalizeMotiongenResolution
                )
                .filter(Boolean);

        const uniqueResolutions =
            [
                ...new Set(
                    mappedResolutions
                )
            ];

        const finalResolutions =
            uniqueResolutions.length
                ? uniqueResolutions
                : [
                    ...MOTIONGEN_RESOLUTION_VALUES
                ];

        normalizedDefinitions.resolution =
            {
                type: "string",
                enum: finalResolutions,
                default:
                    finalResolutions.includes(
                        "720p"
                    )
                        ? "720p"
                        : finalResolutions[0]
            };
    }

    /* =====================================================
       EXISTING RESOLUTION OVERRIDE
       FOR NON-MOTIONGEN MODELS
    ===================================================== */

    if (
        !isMotiongenModel(model) &&
        Array.isArray(
            model.supported_resolutions
        ) &&
        model.supported_resolutions.length
    ) {

        if (
            normalizedDefinitions.resolution
        ) {

            normalizedDefinitions.resolution =
                {
                    ...normalizedDefinitions.resolution,
                    enum:
                        model.supported_resolutions
                };

        } else {

            normalizedDefinitions.resolution =
                {
                    type: "string",
                    enum:
                        model.supported_resolutions,
                    default:
                        model.supported_resolutions[0]
                };
        }
    }

    /* =====================================================
       NEVER RENDER WEBHOOK
    ===================================================== */

    delete normalizedDefinitions.webhook_url;
    delete normalizedDefinitions.webhook;

    return normalizedDefinitions;
}


/* =========================================================
   NORMALIZE PARAMETER DEFINITIONS
========================================================= */

function normalizeParameterDefinitions(
    source
) {

    if (!source) {
        return {};
    }

    if (
        typeof source === "string"
    ) {

        try {
            source =
                JSON.parse(source);
        } catch {
            return {};
        }
    }

    if (
        Array.isArray(source)
    ) {

        const output = {};

        source.forEach(
            item => {

                if (
                    typeof item ===
                    "string"
                ) {

                    output[item] = {
                        type: "string"
                    };

                    return;
                }

                if (
                    !item ||
                    typeof item !==
                        "object"
                ) {
                    return;
                }

                const name =
                    item.name ||
                    item.key ||
                    item.id ||
                    item.parameter;

                if (!name) {
                    return;
                }

                const {
                    name: ignoredName,
                    key: ignoredKey,
                    id: ignoredId,
                    parameter: ignoredParameter,
                    ...definition
                } = item;

                output[name] =
                    definition;
            }
        );

        return output;
    }

    if (
        typeof source !== "object"
    ) {
        return {};
    }

    if (
        source.properties &&
        typeof source.properties ===
            "object"
    ) {

        return {
            ...source.properties
        };
    }

    if (
        source.parameters &&
        typeof source.parameters ===
            "object"
    ) {

        return normalizeParameterDefinitions(
            source.parameters
        );
    }

    if (
        source.inputs &&
        typeof source.inputs ===
            "object"
    ) {

        return normalizeParameterDefinitions(
            source.inputs
        );
    }

    if (
        source.fields &&
        typeof source.fields ===
            "object"
    ) {

        return normalizeParameterDefinitions(
            source.fields
        );
    }

    return {
        ...source
    };
}


/* =========================================================
   PARAMETER LABEL
========================================================= */

function getParameterLabel(
    parameterName
) {

    const labels = {
        image_urls: "Image",
        image_url: "Image",
        audio_url: "Audio",
        prompt: "Prompt",
        negative_prompt:
            "Negative Prompt",
        mode: "Mode",
        aspect_ratio:
            "Aspect Ratio",
        duration: "Duration",
        resolution: "Resolution",
        description: "Description"
    };

    if (
        labels[parameterName]
    ) {

        return labels[
            parameterName
        ];
    }

    return String(
        parameterName
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
   PARAMETER FILTERING
========================================================= */

function isInternalParameter(
    parameterName
) {

    return INTERNAL_PARAMETERS.has(
        parameterName
    );
}


function isServerControlledParameter(
    parameterName
) {

    return SERVER_CONTROLLED_PARAMETERS.has(
        parameterName
    );
}


function isClientForbiddenParameter(
    parameterName
) {

    return (
        CLIENT_FORBIDDEN_PARAMETERS.has(
            parameterName
        )
        ||
        isInternalParameter(
            parameterName
        )
        ||
        isServerControlledParameter(
            parameterName
        )
    );
}


function isRenderableParameter(
    parameterName
) {

    if (
        !parameterName
    ) {
        return false;
    }

    return !isClientForbiddenParameter(
        parameterName
    );
}


/* =========================================================
   PARAMETER ORDER
========================================================= */

function getOrderedParameterNames(
    definitions
) {

    const names =
        Object.keys(
            definitions || {}
        )
        .filter(
            isRenderableParameter
        );

    const ordered = [];

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
                !ordered.includes(name)
            ) {

                ordered.push(name);
            }
        }
    );

    return ordered;
}


/* =========================================================
   FIELD CREATION
========================================================= */

function createField(
    parameterName,
    definition,
    modelArgument = null
) {

    const wrapper =
        document.createElement(
            "div"
        );

    wrapper.className =
        "generate-field";

    wrapper.dataset.parameter =
        parameterName;

    if (
        FULL_WIDTH_PARAMETERS.has(
            parameterName
        )
    ) {

        wrapper.classList.add(
            "generate-field-full"
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
            parameterName
        );

    wrapper.appendChild(
        label
    );

    const input =
        createFieldInput(
            parameterName,
            definition,
            modelArgument
        );

    if (input) {
        wrapper.appendChild(
            input
        );
    }

    return wrapper;
}


/* =========================================================
   IMAGE FIELD
========================================================= */

function createImageField(
    parameterName,
    definition,
    modelArgument = null
) {

    const container =
        document.createElement(
            "div"
        );

    container.className =
        "generate-media-input generate-image-input";

    container.dataset.parameter =
        parameterName;

    const controls =
        document.createElement(
            "div"
        );

    controls.className =
        "generate-media-controls";

    const urlButton =
        document.createElement(
            "button"
        );

    urlButton.type = "button";
    urlButton.className =
        "generate-media-mode active";
    urlButton.textContent =
        "URL";

    const uploadButton =
        document.createElement(
            "button"
        );

    uploadButton.type = "button";
    uploadButton.className =
        "generate-media-mode";
    uploadButton.textContent =
        "Upload";

    controls.appendChild(
        urlButton
    );

    controls.appendChild(
        uploadButton
    );

    container.appendChild(
        controls
    );

    const urlInput =
        document.createElement(
            "input"
        );

    urlInput.type = "url";
    urlInput.className =
        "generate-media-url";
    urlInput.placeholder =
        "https://...";
    urlInput.autocomplete =
        "off";

    const fileInput =
        document.createElement(
            "input"
        );

    fileInput.type = "file";
    fileInput.className =
        "generate-media-file";
    fileInput.accept =
        isMotiongenModel(
            modelArgument
        )
            ? ".jpg,.jpeg,.png,image/jpeg,image/png"
            : ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";

    fileInput.style.display =
        "none";

    const preview =
        document.createElement(
            "div"
        );

    preview.className =
        "generate-media-preview";

    const status =
        document.createElement(
            "div"
        );

    status.className =
        "generate-media-status";

    container.appendChild(
        urlInput
    );

    container.appendChild(
        fileInput
    );

    container.appendChild(
        preview
    );

    container.appendChild(
        status
    );


    /* =====================================================
       URL MODE
    ===================================================== */

    urlButton.addEventListener(
        "click",
        () => {

            urlButton.classList.add(
                "active"
            );

            uploadButton.classList.remove(
                "active"
            );

            urlInput.style.display =
                "";

            fileInput.style.display =
                "none";

            /*
             * URL mode must not accidentally reuse
             * an old uploaded image.
             */

            container.setUploadedUrl(
                ""
            );

            fileInput.value =
                "";

            preview.innerHTML =
                "";

            status.textContent =
                "";
        }
    );


    /* =====================================================
       UPLOAD MODE
    ===================================================== */

    uploadButton.addEventListener(
        "click",
        () => {

            uploadButton.classList.add(
                "active"
            );

            urlButton.classList.remove(
                "active"
            );

            urlInput.style.display =
                "none";

            fileInput.style.display =
                "";

            /*
             * URL mode value must not interfere
             * with uploaded image mode.
             */

            urlInput.value =
                "";

            fileInput.click();
        }
    );


    /* =====================================================
       IMAGE FILE CHANGE
       -----------------------------------------------------
       IMPORTANT:
       The previous implementation only displayed the
       selected file locally.

       Motiongen requires a PUBLIC image URL.
       Therefore the file is uploaded immediately and
       the resulting URL is stored in container.dataset.
    ===================================================== */

    fileInput.addEventListener(
        "change",
        async () => {

            const file =
                fileInput.files?.[0];

            if (!file) {
                return;
            }

            try {

                /* =========================================
                   VALIDATE IMAGE
                ========================================= */

                validateImageFile(
                    file,
                    modelArgument
                );


                /* =========================================
                   CLEAR PREVIOUS UPLOADED URL
                ========================================= */

                container.setUploadedUrl(
                    ""
                );


                /* =========================================
                   LOCAL PREVIEW
                ========================================= */

                preview.innerHTML =
                    "";

                const image =
                    document.createElement(
                        "img"
                    );

                const objectUrl =
                    URL.createObjectURL(
                        file
                    );

                image.src =
                    objectUrl;

                image.alt =
                    "Image preview";

                preview.appendChild(
                    image
                );


                /* =========================================
                   UPLOAD STATUS
                ========================================= */

                status.textContent =
                    "Mengunggah gambar...";


                /* =========================================
                   UPLOAD TO SUPABASE
                ========================================= */

                const publicUrl =
                    await uploadImageFile(
                        file,
                        modelArgument
                    );


                /* =========================================
                   VERIFY PUBLIC URL
                ========================================= */

                if (!publicUrl) {

                    throw new Error(
                        "Public URL gambar tidak berhasil dibuat."
                    );
                }


                /* =========================================
                   STORE PUBLIC URL
                   ------------------------------------------------
                   getFormParameters() akan mengambil URL
                   ini dan menghasilkan:

                   image_urls: [
                       publicUrl
                   ]
                ========================================= */

                container.setUploadedUrl(
                    publicUrl
                );


                /* =========================================
                   SUCCESS STATUS
                ========================================= */

                status.textContent =
                    file.name;


                /*
                 * Release browser object URL after the
                 * preview image has loaded.
                 */

                image.addEventListener(
                    "load",
                    () => {

                        try {
                            URL.revokeObjectURL(
                                objectUrl
                            );
                        } catch {
                            /* ignore */
                        }

                    },
                    {
                        once: true
                    }
                );


            } catch (error) {

                /* =========================================
                   RESET FAILED UPLOAD
                ========================================= */

                fileInput.value =
                    "";

                container.setUploadedUrl(
                    ""
                );

                preview.innerHTML =
                    "";

                status.textContent =
                    error?.message ||
                    "Upload gambar gagal.";


                console.error(
                    "[GEN-Z.AI Generate] Image upload/validation error:",
                    error
                );
            }
        }
    );


    /* =====================================================
       PUBLIC FIELD METHODS
    ===================================================== */

    container.getInputMode = () => {

        if (
            uploadButton.classList.contains(
                "active"
            )
        ) {

            return "upload";
        }

        return "url";
    };


    container.getUrlInput = () =>
        urlInput;


    container.getFileInput = () =>
        fileInput;


    container.getUploadedUrl = () =>
        container.dataset.uploadedUrl ||
        "";


    container.setUploadedUrl = (
        value
    ) => {

        container.dataset.uploadedUrl =
            value || "";
    };


    container.clearUploadedFile = () => {

        fileInput.value =
            "";

        container.dataset.uploadedUrl =
            "";

        preview.innerHTML =
            "";

        status.textContent =
            "";
    };


    container.getSelectedFiles = () =>
        fileInput.files
            ? Array.from(
                fileInput.files
            )
            : [];


    return container;
}


/* =========================================================
   AUDIO FIELD
========================================================= */

function createAudioField(
    parameterName,
    definition,
    modelArgument = null
) {

    const container =
        document.createElement(
            "div"
        );

    container.className =
        "generate-media-input generate-audio-input";

    container.dataset.parameter =
        parameterName;

    const controls =
        document.createElement(
            "div"
        );

    controls.className =
        "generate-media-controls";

    const urlButton =
        document.createElement(
            "button"
        );

    urlButton.type = "button";
    urlButton.className =
        "generate-media-mode active";
    urlButton.textContent =
        "URL";

    const uploadButton =
        document.createElement(
            "button"
        );

    uploadButton.type = "button";
    uploadButton.className =
        "generate-media-mode";
    uploadButton.textContent =
        "Upload";

    controls.appendChild(
        urlButton
    );

    controls.appendChild(
        uploadButton
    );

    container.appendChild(
        controls
    );

    const urlInput =
        document.createElement(
            "input"
        );

    urlInput.type = "url";
    urlInput.className =
        "generate-media-url";
    urlInput.placeholder =
        "https://.../audio.mp3";
    urlInput.autocomplete =
        "off";

    const fileInput =
        document.createElement(
            "input"
        );

    fileInput.type = "file";
    fileInput.className =
        "generate-media-file";
    fileInput.accept =
        ".mp3,.wav,audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/wave";

    fileInput.style.display =
        "none";

    const preview =
        document.createElement(
            "audio"
        );

    preview.className =
        "generate-audio-preview";

    preview.controls =
        true;

    preview.style.display =
        "none";

    const status =
        document.createElement(
            "div"
        );

    status.className =
        "generate-media-status";

    container.appendChild(
        urlInput
    );

    container.appendChild(
        fileInput
    );

    container.appendChild(
        preview
    );

    container.appendChild(
        status
    );

    urlButton.addEventListener(
        "click",
        () => {

            urlButton.classList.add(
                "active"
            );

            uploadButton.classList.remove(
                "active"
            );

            urlInput.style.display =
                "";

            fileInput.style.display =
                "none";
        }
    );

    uploadButton.addEventListener(
        "click",
        () => {

            uploadButton.classList.add(
                "active"
            );

            urlButton.classList.remove(
                "active"
            );

            urlInput.style.display =
                "none";

            fileInput.style.display =
                "";

            fileInput.click();
        }
    );

    fileInput.addEventListener(
        "change",
        () => {

            const file =
                fileInput.files?.[0];

            if (!file) {
                return;
            }

            try {

                validateAudioFile(
                    file
                );

                preview.src =
                    URL.createObjectURL(
                        file
                    );

                preview.style.display =
                    "";

                status.textContent =
                    file.name;

            } catch (error) {

                fileInput.value =
                    "";

                preview.removeAttribute(
                    "src"
                );

                preview.style.display =
                    "none";

                status.textContent =
                    error.message;

                console.error(
                    "[GEN-Z.AI Generate] Audio validation error:",
                    error
                );
            }
        }
    );

    container.getInputMode = () => {

        if (
            uploadButton.classList.contains(
                "active"
            )
        ) {

            return "upload";
        }

        return "url";
    };

    container.getUrlInput = () =>
        urlInput;

    container.getFileInput = () =>
        fileInput;

    container.getUploadedUrl = () =>
        container.dataset.uploadedUrl ||
        "";

    container.setUploadedUrl = (
        value
    ) => {

        container.dataset.uploadedUrl =
            value || "";
    };

    container.clearUploadedFile = () => {

        fileInput.value =
            "";

        container.dataset.uploadedUrl =
            "";

        preview.removeAttribute(
            "src"
        );

        preview.style.display =
            "none";

        status.textContent =
            "";
    };

    container.getSelectedFiles = () =>
        fileInput.files
            ? Array.from(
                fileInput.files
            )
            : [];

    return container;
}


/* =========================================================
   ENUM FIELD
========================================================= */

function createEnumField(
    parameterName,
    definition,
    modelArgument = null
) {

    const container =
        document.createElement(
            "div"
        );

    container.className =
        "generate-enum-field";

    const values =
        Array.isArray(
            definition?.enum
        )
            ? definition.enum
            : [];

    const defaultValue =
        definition?.default ??
        definition?.defaultValue ??
        values[0] ??
        "";

    values.forEach(
        (value, index) => {

            const label =
                document.createElement(
                    "label"
                );

            label.className =
                "generate-radio-option";

            const input =
                document.createElement(
                    "input"
                );

            input.type =
                "radio";

            input.name =
                `parameter_${parameterName}`;

            input.value =
                String(value);

            if (
                String(value) ===
                String(defaultValue)
            ) {

                input.checked =
                    true;
            }

            const text =
                document.createElement(
                    "span"
                );

            let displayValue =
                value;

            if (
                parameterName ===
                    "resolution" &&
                isMotiongenModel(
                    modelArgument
                )
            ) {

                displayValue =
                    getMotiongenResolutionLabel(
                        value
                    );
            }

            text.textContent =
                String(
                    displayValue
                );

            label.appendChild(
                input
            );

            label.appendChild(
                text
            );

            container.appendChild(
                label
            );
        }
    );

    return container;
}


/* =========================================================
   BOOLEAN FIELD
========================================================= */

function createBooleanField(
    parameterName,
    definition
) {

    const label =
        document.createElement(
            "label"
        );

    label.className =
        "generate-checkbox-option";

    const input =
        document.createElement(
            "input"
        );

    input.type =
        "checkbox";

    input.dataset.parameter =
        parameterName;

    const defaultValue =
        definition?.default ??
        definition?.defaultValue ??
        false;

    input.checked =
        Boolean(
            defaultValue
        );

    const text =
        document.createElement(
            "span"
        );

    text.textContent =
        getParameterLabel(
            parameterName
        );

    label.appendChild(
        input
    );

    label.appendChild(
        text
    );

    return label;
}


/* =========================================================
   NUMBER FIELD
========================================================= */

function createNumberField(
    parameterName,
    definition
) {

    const input =
        document.createElement(
            "input"
        );

    input.type =
        "number";

    input.dataset.parameter =
        parameterName;

    if (
        definition?.min !==
        undefined
    ) {

        input.min =
            definition.min;
    }

    if (
        definition?.max !==
        undefined
    ) {

        input.max =
            definition.max;
    }

    if (
        definition?.step !==
        undefined
    ) {

        input.step =
            definition.step;
    }

    if (
        definition?.default !==
        undefined
    ) {

        input.value =
            definition.default;
    }

    return input;
}


/* =========================================================
   DURATION FIELD
========================================================= */

function createDurationField(
    parameterName,
    definition
) {

    return createNumberField(
        parameterName,
        definition
    );
}


/* =========================================================
   TEXTAREA
========================================================= */

function createTextareaField(
    parameterName,
    definition
) {

    const textarea =
        document.createElement(
            "textarea"
        );

    textarea.dataset.parameter =
        parameterName;

    textarea.rows =
        parameterName ===
            "prompt"
            ? 5
            : 3;

    textarea.placeholder =
        definition?.placeholder ||
        "";

    if (
        definition?.maxLength !==
        undefined
    ) {

        textarea.maxLength =
            definition.maxLength;
    }

    if (
        definition?.default !==
        undefined
    ) {

        textarea.value =
            definition.default;
    }

    return textarea;
}


/* =========================================================
   TEXT FIELD
========================================================= */

function createTextField(
    parameterName,
    definition
) {

    const input =
        document.createElement(
            "input"
        );

    input.type =
        "text";

    input.dataset.parameter =
        parameterName;

    input.placeholder =
        definition?.placeholder ||
        "";

    if (
        definition?.maxLength !==
        undefined
    ) {

        input.maxLength =
            definition.maxLength;
    }

    if (
        definition?.default !==
        undefined
    ) {

        input.value =
            definition.default;
    }

    return input;
}


/* =========================================================
   SELECT FIELD
========================================================= */

function createSelectField(
    parameterName,
    definition
) {

    const select =
        document.createElement(
            "select"
        );

    select.dataset.parameter =
        parameterName;

    const options =
        definition?.options ||
        definition?.values ||
        [];

    options.forEach(
        option => {

            const optionElement =
                document.createElement(
                    "option"
                );

            if (
                typeof option ===
                "object"
            ) {

                optionElement.value =
                    option.value ??
                    option.id ??
                    "";

                optionElement.textContent =
                    option.label ??
                    option.name ??
                    option.value ??
                    "";

            } else {

                optionElement.value =
                    String(option);

                optionElement.textContent =
                    String(option);
            }

            select.appendChild(
                optionElement
            );
        }
    );

    if (
        definition?.default !==
        undefined
    ) {

        select.value =
            definition.default;
    }

    return select;
}


/* =========================================================
   FIELD INPUT FACTORY
========================================================= */

function createFieldInput(
    parameterName,
    definition,
    modelArgument = null
) {

    if (
        parameterName ===
            "image_urls" ||
        parameterName ===
            "image_url"
    ) {

        return createImageField(
            parameterName,
            definition,
            modelArgument
        );
    }

    if (
        parameterName ===
        "audio_url"
    ) {

        return createAudioField(
            parameterName,
            definition,
            modelArgument
        );
    }

    if (
        Array.isArray(
            definition?.enum
        ) &&
        definition.enum.length
    ) {

        return createEnumField(
            parameterName,
            definition,
            modelArgument
        );
    }

    if (
        Array.isArray(
            definition?.options
        ) &&
        definition.options.length
    ) {

        return createSelectField(
            parameterName,
            definition
        );
    }

    const type =
        String(
            definition?.type ||
            ""
        ).toLowerCase();

    if (
        type === "boolean"
    ) {

        return createBooleanField(
            parameterName,
            definition
        );
    }

    if (
        parameterName ===
            "duration" &&
        (
            type === "number" ||
            type === "integer" ||
            !type
        )
    ) {

        return createDurationField(
            parameterName,
            definition
        );
    }

    if (
        type === "number" ||
        type === "integer"
    ) {

        return createNumberField(
            parameterName,
            definition
        );
    }

    if (
        parameterName ===
            "prompt" ||
        parameterName ===
            "negative_prompt" ||
        parameterName ===
            "description"
    ) {

        return createTextareaField(
            parameterName,
            definition
        );
    }

    return createTextField(
        parameterName,
        definition
    );
}


/* =========================================================
   RENDER PARAMETER
========================================================= */

function renderParameter(
    parameterName,
    definition,
    modelArgument = null
) {

    if (
        !isRenderableParameter(
            parameterName
        )
    ) {

        return null;
    }

    const field =
        createField(
            parameterName,
            definition,
            modelArgument
        );

    if (
        definition?.description
    ) {

        const description =
            document.createElement(
                "div"
            );

        description.className =
            "generate-field-description";

        description.textContent =
            definition.description;

        field.appendChild(
            description
        );
    }

    return field;
}


/* =========================================================
   RENDER FORM
========================================================= */

function renderGenerateForm(
    modelArgument = null
) {

    const container =
        getContainer();

    if (!container) {
        console.warn(
            "[GEN-Z.AI Generate] #dynamicFields not found."
        );

        return;
    }

    const model =
        resolveModel(
            modelArgument
        );

    const definitions =
        getParameterDefinitions(
            model
        );

    const names =
        getOrderedParameterNames(
            definitions
        );

    container.innerHTML =
        "";

    names.forEach(
        parameterName => {

            const field =
                renderParameter(
                    parameterName,
                    definitions[
                        parameterName
                    ],
                    model
                );

            if (field) {

                container.appendChild(
                    field
                );
            }
        }
    );

    forceContainerVisible(
        container
    );
}


/* =========================================================
   CONTAINER VISIBILITY / GRID
========================================================= */

function forceContainerVisible(
    container
) {

    if (!container) {
        return;
    }

    container.style.display =
        "grid";

    container.style.gridTemplateColumns =
        "repeat(2, minmax(0, 1fr))";

    container.style.gap =
        "16px";

    Array.from(
        container.children
    ).forEach(
        field => {

            const parameter =
                field.dataset?.parameter;

            if (
                FULL_WIDTH_PARAMETERS.has(
                    parameter
                )
            ) {

                field.style.gridColumn =
                    "1 / -1";
            }
        }
    );
}


/* =========================================================
   FIELD LOOKUP
========================================================= */

function findField(
    parameterName
) {

    const container =
        getContainer();

    if (!container) {
        return null;
    }

    return container.querySelector(
        `[data-parameter="${CSS.escape(
            parameterName
        )}"]`
    );
}


/* =========================================================
   READ FIELD VALUE
========================================================= */

function readFieldValue(
    field
) {

    if (!field) {
        return null;
    }

    if (
        field.classList.contains(
            "generate-image-input"
        )
        ||
        field.classList.contains(
            "generate-audio-input"
        )
    ) {

        const mode =
            typeof field.getInputMode ===
            "function"
                ? field.getInputMode()
                : "url";

        if (
            mode === "upload"
        ) {

            return {
                mode: "upload",
                url:
                    typeof field.getUploadedUrl ===
                    "function"
                        ? field.getUploadedUrl()
                        : "",
                files:
                    typeof field.getSelectedFiles ===
                    "function"
                        ? field.getSelectedFiles()
                        : []
            };
        }

        const urlInput =
            typeof field.getUrlInput ===
            "function"
                ? field.getUrlInput()
                : null;

        return {
            mode: "url",
            url:
                urlInput?.value?.trim() ||
                "",
            files: []
        };
    }

    const radio =
        field.querySelector(
            'input[type="radio"]:checked'
        );

    if (radio) {
        return radio.value;
    }

    const checkbox =
        field.querySelector(
            'input[type="checkbox"]'
        );

    if (checkbox) {
        return checkbox.checked;
    }

    const input =
        field.querySelector(
            "input, textarea, select"
        );

    if (input) {

        return input.type ===
            "checkbox"
            ? input.checked
            : input.value;
    }

    return null;
}


/* =========================================================
   NORMALIZE PARAMETER VALUE
========================================================= */

function normalizeParameterValue(
    parameterName,
    value,
    definition,
    modelArgument = null
) {

    if (
        value === null ||
        value === undefined
    ) {

        return value;
    }

    if (
        parameterName ===
            "image_urls"
    ) {

        if (
            Array.isArray(value)
        ) {

            return value
                .filter(Boolean)
                .map(
                    item =>
                        String(item)
                            .trim()
                );
        }

        if (
            typeof value ===
            "string"
        ) {

            const trimmed =
                value.trim();

            if (!trimmed) {
                return [];
            }

            return [
                trimmed
            ];
        }
    }

    if (
        parameterName ===
            "image_url"
    ) {

        return String(
            value
        ).trim();
    }

    if (
        parameterName ===
            "audio_url"
    ) {

        return String(
            value
        ).trim();
    }

    if (
        parameterName ===
            "resolution" &&
        isMotiongenModel(
            modelArgument
        )
    ) {

        return normalizeMotiongenResolution(
            value
        );
    }

    const type =
        String(
            definition?.type ||
            ""
        ).toLowerCase();

    if (
        type === "boolean"
    ) {

        return Boolean(
            value
        );
    }

    if (
        type === "integer"
    ) {

        const number =
            Number(value);

        return Number.isFinite(
            number
        )
            ? Math.round(number)
            : value;
    }

    if (
        type === "number"
    ) {

        const number =
            Number(value);

        return Number.isFinite(
            number
        )
            ? number
            : value;
    }

    return value;
}


/* =========================================================
   IMAGE FILE VALIDATION
========================================================= */

function validateImageFile(
    file,
    modelArgument = null
) {

    if (!file) {

        throw new Error(
            "File gambar tidak ditemukan."
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

    const motiongen =
        isMotiongenModel(
            modelArgument
        );

    if (motiongen) {

        const validMime =
            MOTIONGEN_ALLOWED_IMAGE_TYPES.has(
                file.type
            );

        const extension =
            String(
                file.name || ""
            )
                .split(".")
                .pop()
                .toLowerCase();

        const validExtension =
            extension === "jpg" ||
            extension === "jpeg" ||
            extension === "png";

        if (
            !validMime &&
            !validExtension
        ) {

            throw new Error(
                "Motiongen-AI hanya menerima gambar JPG atau PNG."
            );
        }

        return true;
    }

    const validMime =
        ALLOWED_IMAGE_TYPES.has(
            file.type
        );

    const extension =
        String(
            file.name || ""
        )
            .split(".")
            .pop()
            .toLowerCase();

    const validExtension =
        extension === "jpg" ||
        extension === "jpeg" ||
        extension === "png" ||
        extension === "webp";

    if (
        !validMime &&
        !validExtension
    ) {

        throw new Error(
            "Format gambar tidak didukung."
        );
    }

    return true;
}


/* =========================================================
   AUDIO FILE VALIDATION
========================================================= */

function validateAudioFile(
    file
) {

    if (!file) {

        throw new Error(
            "File audio tidak ditemukan."
        );
    }

    const validMime =
        ALLOWED_AUDIO_TYPES.has(
            file.type
        );

    const extension =
        String(
            file.name || ""
        )
            .split(".")
            .pop()
            .toLowerCase();

    const validExtension =
        extension === "mp3" ||
        extension === "wav";

    if (
        !validMime &&
        !validExtension
    ) {

        throw new Error(
            "Audio Motiongen-AI harus berupa MP3 atau WAV."
        );
    }

    return true;
}


/* =========================================================
   IMAGE STORAGE PATH
========================================================= */

function createImageStoragePath(
    userId,
    file
) {

    const extension =
        String(
            file.name || ""
        )
            .split(".")
            .pop()
            .toLowerCase() ||
        "jpg";

    return [
        "generate-input",
        userId,
        `${crypto.randomUUID()}.${extension}`
    ].join("/");
}


/* =========================================================
   AUDIO STORAGE PATH
========================================================= */

function createAudioStoragePath(
    userId,
    file
) {

    const extension =
        String(
            file.name || ""
        )
            .split(".")
            .pop()
            .toLowerCase() ||
        "mp3";

    return [
        "generate-input",
        userId,
        `${crypto.randomUUID()}.${extension}`
    ].join("/");
}


/* =========================================================
   IMAGE UPLOAD
========================================================= */

async function uploadImageFile(
    file,
    modelArgument = null
) {

    validateImageFile(
        file,
        modelArgument
    );

    const client =
        getSupabaseClient();

    if (!client) {

        throw new Error(
            "Supabase client belum tersedia."
        );
    }

    const user =
        getCurrentUser();

    if (!user?.id) {

        throw new Error(
            "User belum terautentikasi."
        );
    }

    const path =
        createImageStoragePath(
            user.id,
            file
        );

    const {
        error
    } =
        await client.storage
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
                        file.type ||
                        "image/jpeg"
                }
            );

    if (error) {

        throw error;
    }

    const {
        data
    } =
        client.storage
            .from(
                STORAGE_BUCKET
            )
            .getPublicUrl(
                path
            );

    const publicUrl =
        data?.publicUrl ||
        "";

    if (!publicUrl) {

        throw new Error(
            "Public URL gambar tidak berhasil dibuat."
        );
    }

    return publicUrl;
}


/* =========================================================
   AUDIO UPLOAD
========================================================= */

async function uploadAudioFile(
    file
) {

    validateAudioFile(
        file
    );

    const client =
        getSupabaseClient();

    if (!client) {

        throw new Error(
            "Supabase client belum tersedia."
        );
    }

    const user =
        getCurrentUser();

    if (!user?.id) {

        throw new Error(
            "User belum terautentikasi."
        );
    }

    const path =
        createAudioStoragePath(
            user.id,
            file
        );

    const {
        error
    } =
        await client.storage
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
                        file.type ||
                        "audio/mpeg"
                }
            );

    if (error) {

        throw error;
    }

    const {
        data
    } =
        client.storage
            .from(
                STORAGE_BUCKET
            )
            .getPublicUrl(
                path
            );

    const publicUrl =
        data?.publicUrl ||
        "";

    if (!publicUrl) {

        throw new Error(
            "Public URL audio tidak berhasil dibuat."
        );
    }

    return publicUrl;
}


/* =========================================================
   RESOLVE IMAGE PARAMETER
========================================================= */

async function resolveImageParameterValue(
    parameterName,
    rawValue,
    modelArgument = null
) {

    if (
        !rawValue
    ) {

        return [];
    }

    if (
        typeof rawValue ===
        "string"
    ) {

        const trimmed =
            rawValue.trim();

        return trimmed
            ? [trimmed]
            : [];
    }

    if (
        Array.isArray(
            rawValue
        )
    ) {

        return rawValue
            .filter(Boolean)
            .map(
                item =>
                    String(item)
                        .trim()
            )
            .filter(Boolean);
    }

    if (
        typeof rawValue !==
        "object"
    ) {

        return [];
    }

    if (
        rawValue.mode ===
        "url"
    ) {

        const url =
            String(
                rawValue.url ||
                ""
            ).trim();

        return url
            ? [url]
            : [];
    }

    if (
        rawValue.mode ===
        "upload"
    ) {

        /*
         * The image upload handler now stores the
         * public URL immediately.

         * Therefore this branch normally receives:
         *
         * rawValue.url = public Supabase URL
         *
         * The fallback below remains intact for
         * compatibility with existing callers.
         */

        if (
            rawValue.url
        ) {

            return [
                String(
                    rawValue.url
                ).trim()
            ].filter(Boolean);
        }

        const files =
            Array.isArray(
                rawValue.files
            )
                ? rawValue.files
                : [];

        if (
            !files.length
        ) {

            return [];
        }

        const urls = [];

        for (
            const file
            of files
        ) {

            const url =
                await uploadImageFile(
                    file,
                    modelArgument
                );

            urls.push(
                url
            );
        }

        return urls;
    }

    return [];
}


/* =========================================================
   RESOLVE AUDIO PARAMETER
========================================================= */

async function resolveAudioParameterValue(
    rawValue
) {

    if (
        !rawValue
    ) {

        return "";
    }

    if (
        typeof rawValue ===
        "string"
    ) {

        return rawValue.trim();
    }

    if (
        typeof rawValue !==
        "object"
    ) {

        return "";
    }

    if (
        rawValue.mode ===
        "url"
    ) {

        return String(
            rawValue.url ||
            ""
        ).trim();
    }

    if (
        rawValue.mode ===
        "upload"
    ) {

        if (
            rawValue.url
        ) {

            return String(
                rawValue.url
            ).trim();
        }

        const files =
            Array.isArray(
                rawValue.files
            )
                ? rawValue.files
                : [];

        if (
            files.length !== 1
        ) {

            throw new Error(
                "Motiongen-AI membutuhkan tepat 1 file audio."
            );
        }

        return uploadAudioFile(
            files[0]
        );
    }

    return "";
}


/* =========================================================
   GET FORM PARAMETERS
========================================================= */

async function getFormParameters(
    modelArgument = null
) {

    const model =
        resolveModel(
            modelArgument
        );

    const definitions =
        getParameterDefinitions(
            model
        );

    const names =
        getOrderedParameterNames(
            definitions
        );

    const parameters = {};

    for (
        const parameterName
        of names
    ) {

        if (
            isClientForbiddenParameter(
                parameterName
            )
        ) {
            continue;
        }

        const field =
            findField(
                parameterName
            );

        if (!field) {
            continue;
        }

        const rawValue =
            readFieldValue(
                field
            );

        /* =============================================
           IMAGE
        ============================================= */

        if (
            parameterName ===
                "image_urls" ||
            parameterName ===
                "image_url"
        ) {

            const imageUrls =
                await resolveImageParameterValue(
                    parameterName,
                    rawValue,
                    model
                );

            if (
                parameterName ===
                "image_urls"
            ) {

                parameters.image_urls =
                    imageUrls;

            } else {

                parameters.image_url =
                    imageUrls[0] ||
                    "";
            }

            continue;
        }

        /* =============================================
           AUDIO
        ============================================= */

        if (
            parameterName ===
            "audio_url"
        ) {

            parameters.audio_url =
                await resolveAudioParameterValue(
                    rawValue
                );

            continue;
        }

        const normalizedValue =
            normalizeParameterValue(
                parameterName,
                rawValue,
                definitions[
                    parameterName
                ],
                model
            );

        if (
            normalizedValue !==
                null &&
            normalizedValue !==
                undefined &&
            normalizedValue !==
                ""
        ) {

            parameters[
                parameterName
            ] =
                normalizedValue;
        }
    }


    /* =====================================================
       ALWAYS REMOVE FORBIDDEN / SERVER CONTROLLED FIELDS
    ===================================================== */

    delete parameters.task_id;
    delete parameters.index;
    delete parameters.nsfw_checker;
    delete parameters.webhook_url;
    delete parameters.webhook;


    /* =====================================================
       MOTIONGEN VALIDATION
    ===================================================== */

    if (
        isMotiongenModel(
            model
        )
    ) {

        /* -------------------------------------------------
           PROMPT
        ------------------------------------------------- */

        const prompt =
            String(
                parameters.prompt ||
                ""
            ).trim();

        if (!prompt) {

            throw new Error(
                "Prompt wajib diisi."
            );
        }

        parameters.prompt =
            prompt;


        /* -------------------------------------------------
           IMAGE
        ------------------------------------------------- */

        let imageUrls =
            Array.isArray(
                parameters.image_urls
            )
                ? parameters.image_urls
                    .filter(Boolean)
                    .map(
                        value =>
                            String(value)
                                .trim()
                    )
                    .filter(Boolean)
                : [];

        /*
         * Compatibility:
         * Jika schema menggunakan image_url,
         * ubah menjadi image_urls karena
         * Motiongen API membutuhkan image_urls.
         */

        if (
            !imageUrls.length &&
            parameters.image_url
        ) {

            const imageUrl =
                String(
                    parameters.image_url
                ).trim();

            if (imageUrl) {

                imageUrls = [
                    imageUrl
                ];
            }
        }

        if (
            imageUrls.length !== 1
        ) {

            throw new Error(
                "Motiongen-AI membutuhkan tepat 1 gambar."
            );
        }

        parameters.image_urls =
            imageUrls;

        delete parameters.image_url;


        /* -------------------------------------------------
           AUDIO
        ------------------------------------------------- */

        const audioUrl =
            String(
                parameters.audio_url ||
                ""
            ).trim();

        if (!audioUrl) {

            throw new Error(
                "Audio wajib diisi. Gunakan URL audio atau upload file MP3/WAV."
            );
        }

        parameters.audio_url =
            audioUrl;


        /* -------------------------------------------------
           RESOLUTION
        ------------------------------------------------- */

        if (
            parameters.resolution !==
            undefined
        ) {

            const resolution =
                normalizeMotiongenResolution(
                    parameters.resolution
                );

            if (!resolution) {

                throw new Error(
                    "Resolusi Motiongen-AI tidak valid."
                );
            }

            parameters.resolution =
                resolution;
        }
    }

    return parameters;
}


/* =========================================================
   GET FORM DATA
========================================================= */

async function getFormData(
    modelArgument = null
) {

    const parameters =
        await getFormParameters(
            modelArgument
        );

    return {
        model:
            getModelId(
                resolveModel(
                    modelArgument
                )
            ),
        parameters
    };
}


/* =========================================================
   SET FIELD VALUE
========================================================= */

function setFieldValue(
    parameterName,
    value,
    modelArgument = null
) {

    const field =
        findField(
            parameterName
        );

    if (!field) {
        return false;
    }

    if (
        field.classList.contains(
            "generate-image-input"
        )
    ) {

        const urlInput =
            field.getUrlInput?.();

        if (
            urlInput &&
            typeof value ===
                "string"
        ) {

            urlInput.value =
                value;
        }

        return true;
    }

    if (
        field.classList.contains(
            "generate-audio-input"
        )
    ) {

        const urlInput =
            field.getUrlInput?.();

        if (
            urlInput &&
            typeof value ===
                "string"
        ) {

            urlInput.value =
                value;
        }

        return true;
    }

    if (
        parameterName ===
            "resolution" &&
        isMotiongenModel(
            modelArgument
        )
    ) {

        value =
            normalizeMotiongenResolution(
                value
            );
    }

    const radio =
        field.querySelector(
            `input[type="radio"][value="${CSS.escape(
                String(value)
            )}"]`
        );

    if (radio) {

        radio.checked =
            true;

        return true;
    }

    const checkbox =
        field.querySelector(
            'input[type="checkbox"]'
        );

    if (
        checkbox &&
        typeof value ===
            "boolean"
    ) {

        checkbox.checked =
            value;

        return true;
    }

    const input =
        field.querySelector(
            "input, textarea, select"
        );

    if (input) {

        if (
            input.type ===
            "checkbox"
        ) {

            input.checked =
                Boolean(value);

        } else {

            input.value =
                value ?? "";
        }

        return true;
    }

    return false;
}


/* =========================================================
   RESET DYNAMIC FIELDS
========================================================= */

function resetDynamicFields() {

    const container =
        getContainer();

    if (!container) {
        return;
    }

    /*
     * Preserve Seedance-specific form.
     * Seedance renderer is managed outside this
     * generic dynamic renderer.
     */

    const seedanceForm =
        container.querySelector(
            "#seedance-form"
        );

    if (seedanceForm) {

        const children =
            Array.from(
                container.children
            );

        children.forEach(
            child => {

                if (
                    child !==
                    seedanceForm
                ) {

                    child.remove();
                }
            }
        );

        return;
    }

    container.innerHTML =
        "";
}


/* =========================================================
   FORM DISABLED STATE
========================================================= */

function setFormDisabled(
    disabled
) {

    const container =
        getContainer();

    if (!container) {
        return;
    }

    const elements =
        container.querySelectorAll(
            "input, textarea, select, button"
        );

    elements.forEach(
        element => {

            element.disabled =
                Boolean(
                    disabled
                );
        }
    );
}


/* =========================================================
   MEDIA PARAMETERS
========================================================= */

async function getMediaParameters(
    modelArgument = null
) {

    const data =
        await getFormParameters(
            modelArgument
        );

    return {
        image_urls:
            data.image_urls ||
            [],
        image_url:
            data.image_url ||
            "",
        audio_url:
            data.audio_url ||
            ""
    };
}


/* =========================================================
   PARAMETER DEFINITION
========================================================= */

function getParameterDefinition(
    parameterName,
    modelArgument = null
) {

    const definitions =
        getParameterDefinitions(
            modelArgument
        );

    return (
        definitions[
            parameterName
        ] ||
        null
    );
}


/* =========================================================
   INITIALIZE FORM
========================================================= */

function initGenerateForm(
    modelArgument = null
) {

    renderGenerateForm(
        modelArgument
    );
}


/* =========================================================
   PUBLIC API
========================================================= */

const generateForm = Object.freeze({

    init:
        initGenerateForm,

    render:
        renderGenerateForm,

    reset:
        resetDynamicFields,

    getParameters:
        getFormParameters,

    getData:
        getFormData,

    getMediaParameters,

    setValue:
        setFieldValue,

    setDisabled:
        setFormDisabled,

    getParameterDefinitions,

    getParameterDefinition,

    normalizeParameterValue,

    normalizeMotiongenResolution,

    getMotiongenResolutionLabel,

    isMotiongenModel,

    validateImageFile,

    validateAudioFile,

    uploadImageFile,

    uploadAudioFile
});


/* =========================================================
   GLOBAL COMPATIBILITY
========================================================= */

if (
    typeof window !==
    "undefined"
) {

    window.GENZGenerateForm =
        generateForm;

    window.GENZGenerateFormRenderer =
        generateForm;
}


/* =========================================================
   EXPORTS
========================================================= */

export {
    generateForm,

    initGenerateForm,
    renderGenerateForm,
    resetDynamicFields,
    getFormParameters,
    getFormData,
    getMediaParameters,
    setFieldValue,
    setFormDisabled,
    getParameterDefinitions,
    getParameterDefinition,
    normalizeParameterValue,
    normalizeMotiongenResolution,
    getMotiongenResolutionLabel,
    isMotiongenModel,
    validateImageFile,
    validateAudioFile,
    uploadImageFile,
    uploadAudioFile
};

export default generateForm;
