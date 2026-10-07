/* =========================================================
   GEN-Z.AI
   GENERATE FORM ENGINE
   ---------------------------------------------------------
   File:
   generate/assets/js/generate-form.js

   Fungsi:
   - Dynamic model parameter form
   - Image upload / URL
   - Audio upload / URL
   - Parameter normalization
   - Supabase storage upload
   - Motiongen parameter handling
   - Seedance compatibility
   - Form parameter extraction

   CATATAN:
   - Jangan mengirim webhook_url ke client/provider
   - Jangan mengirim nsfw_checker dari form
   - Motiongen wajib 1 image + 1 audio
========================================================= */

import {
    getGenerateElements,
    getCurrentModel,
    getCurrentUser,
    getSupabaseClient
} from "./generate-state.js";


/* =========================================================
   INTERNAL PARAMETERS
========================================================= */

const INTERNAL_PARAMETERS = new Set([
    "task_id",
    "index"
]);


/* =========================================================
   SERVER CONTROLLED PARAMETERS
========================================================= */

const SERVER_CONTROLLED_PARAMETERS = new Set([
    "nsfw_checker"
]);


/* =========================================================
   CLIENT FORBIDDEN PARAMETERS
========================================================= */

const CLIENT_FORBIDDEN_PARAMETERS = new Set([
    "webhook_url",
    "webhook"
]);


/* =========================================================
   STORAGE
========================================================= */

const STORAGE_BUCKET = "dashboard-videos";

const STORAGE_IMAGE_FOLDER = "generate-input";

const STORAGE_AUDIO_FOLDER = "generate-input";


/* =========================================================
   FILE TYPES
========================================================= */

const ALLOWED_IMAGE_TYPES = Object.freeze([
    "image/jpeg",
    "image/png",
    "image/webp"
]);

const MOTIONGEN_ALLOWED_IMAGE_TYPES = Object.freeze([
    "image/jpeg",
    "image/png"
]);

const ALLOWED_AUDIO_TYPES = Object.freeze([
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/x-wav"
]);


/* =========================================================
   FILE SIZE
========================================================= */

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;


/* =========================================================
   MODEL IDENTIFIERS
========================================================= */

const MOTIONGEN_MODEL_ID =
    "digital-human-lipsync-image";

const MOTIONGEN_PROVIDER_ID =
    "motiongen";


/* =========================================================
   MOTIONGEN RESOLUTION
========================================================= */

const MOTIONGEN_RESOLUTIONS = Object.freeze([
    "480p",
    "720p"
]);

const MOTIONGEN_RESOLUTION_LABELS = Object.freeze({
    "480p": "576P",
    "720p": "720P HD"
});

const MOTIONGEN_RESOLUTION_ALIASES = Object.freeze({
    "576p": "480p",
    "576P": "480p",
    "480P": "480p",
    "720P": "720p",
    "720p HD": "720p",
    "720P HD": "720p"
});


/* =========================================================
   PARAMETER ORDER
========================================================= */

const PARAMETER_ORDER = Object.freeze([
    "image_urls",
    "image_url",
    "audio_url",
    "prompt",
    "mode",
    "aspect_ratio",
    "duration",
    "resolution"
]);


/* =========================================================
   FULL WIDTH FIELDS
========================================================= */

const FULL_WIDTH_FIELDS = new Set([
    "image_urls",
    "image_url",
    "audio_url",
    "prompt",
    "negative_prompt",
    "description"
]);


/* =========================================================
   MODEL CHECK
========================================================= */

function isMotiongenModel(model) {

    const modelId =
        String(
            model?.id ||
            model?.model_id ||
            model?.model ||
            ""
        ).trim();

    const providerId =
        String(
            model?.provider_id ||
            model?.providerId ||
            ""
        ).trim();

    return (
        modelId === MOTIONGEN_MODEL_ID ||
        (
            providerId === MOTIONGEN_PROVIDER_ID &&
            modelId === MOTIONGEN_MODEL_ID
        )
    );
}


/* =========================================================
   MODEL PARAMETER DEFINITIONS
========================================================= */

function getParameterDefinitions(model) {

    if (!model || typeof model !== "object") {
        return [];
    }

    let definitions =
        model.parameters ||
        model.parameter_definitions ||
        model.inputs ||
        model.fields ||
        [];

    if (!Array.isArray(definitions)) {

        if (
            definitions &&
            typeof definitions === "object" &&
            !Array.isArray(definitions)
        ) {

            definitions =
                Object.entries(definitions).map(
                    ([name, definition]) => ({
                        name,
                        ...(definition || {})
                    })
                );

        } else {

            definitions = [];
        }
    }

    definitions =
        normalizeParameterDefinitions(
            definitions
        );

    if (isMotiongenModel(model)) {

        definitions =
            definitions.filter(
                definition =>
                    !CLIENT_FORBIDDEN_PARAMETERS.has(
                        definition.name
                    )
            );

        definitions =
            definitions.map(
                definition => {

                    if (
                        definition.name ===
                        "resolution"
                    ) {

                        return {
                            ...definition,
                            type: "select",
                            options:
                                MOTIONGEN_RESOLUTIONS.map(
                                    resolution => ({
                                        value: resolution,
                                        label:
                                            MOTIONGEN_RESOLUTION_LABELS[
                                                resolution
                                            ] ||
                                            resolution
                                    })
                                ),
                            default: "720p"
                        };
                    }

                    return definition;
                }
            );
    }

    return definitions;
}


/* =========================================================
   NORMALIZE PARAMETER DEFINITIONS
========================================================= */

function normalizeParameterDefinitions(
    definitions
) {

    if (!Array.isArray(definitions)) {
        return [];
    }

    return definitions
        .map(
            definition => {

                if (
                    typeof definition ===
                    "string"
                ) {

                    return {
                        name: definition,
                        type: "text"
                    };
                }

                if (
                    !definition ||
                    typeof definition !==
                    "object"
                ) {

                    return null;
                }

                const name =
                    definition.name ||
                    definition.id ||
                    definition.key;

                if (!name) {
                    return null;
                }

                let type =
                    definition.type ||
                    definition.input_type ||
                    definition.inputType ||
                    "text";

                if (
                    type === "string" &&
                    (
                        definition.format ===
                            "textarea" ||
                        definition.multiline === true
                    )
                ) {

                    type = "textarea";
                }

                return {
                    ...definition,
                    name,
                    type
                };
            }
        )
        .filter(Boolean);
}


/* =========================================================
   SORT PARAMETERS
========================================================= */

function sortParameterDefinitions(
    definitions
) {

    if (!Array.isArray(definitions)) {
        return [];
    }

    const orderMap =
        new Map(
            PARAMETER_ORDER.map(
                (name, index) =>
                    [name, index]
            )
        );

    return [...definitions].sort(
        (a, b) => {

            const aIndex =
                orderMap.has(a.name)
                    ? orderMap.get(a.name)
                    : 999;

            const bIndex =
                orderMap.has(b.name)
                    ? orderMap.get(b.name)
                    : 999;

            return aIndex - bIndex;
        }
    );
}


/* =========================================================
   GENERIC FIELD CONTAINER
========================================================= */

function createFieldContainer(
    definition
) {

    const container =
        document.createElement("div");

    container.className =
        "generate-field";

    if (
        FULL_WIDTH_FIELDS.has(
            definition.name
        )
    ) {

        container.classList.add(
            "generate-field-full"
        );
    }

    container.dataset.parameter =
        definition.name;

    return container;
}


/* =========================================================
   LABEL
========================================================= */

function createFieldLabel(
    definition
) {

    const label =
        document.createElement("label");

    label.className =
        "generate-field-label";

    label.textContent =
        definition.label ||
        definition.title ||
        definition.name;

    if (definition.required) {

        const required =
            document.createElement("span");

        required.className =
            "generate-required";

        required.textContent =
            " *";

        label.appendChild(
            required
        );
    }

    return label;
}


/* =========================================================
   DESCRIPTION
========================================================= */

function createFieldDescription(
    definition
) {

    const description =
        definition.description ||
        definition.help ||
        definition.hint;

    if (!description) {
        return null;
    }

    const element =
        document.createElement("div");

    element.className =
        "generate-field-description";

    element.textContent =
        description;

    return element;
}


/* =========================================================
   IMAGE FIELD
========================================================= */

function createImageField(
    definition,
    modelArgument
) {

    const container =
        createFieldContainer(
            definition
        );

    container.classList.add(
        "generate-image-field"
    );

    const label =
        createFieldLabel(
            definition
        );

    container.appendChild(
        label
    );

    const description =
        createFieldDescription(
            definition
        );

    if (description) {

        container.appendChild(
            description
        );
    }


    /* =====================================================
       MODE SWITCH
    ===================================================== */

    const modeWrapper =
        document.createElement("div");

    modeWrapper.className =
        "generate-media-mode";


    const uploadButton =
        document.createElement("button");

    uploadButton.type =
        "button";

    uploadButton.className =
        "generate-media-mode-button active";

    uploadButton.textContent =
        "Upload";


    const urlButton =
        document.createElement("button");

    urlButton.type =
        "button";

    urlButton.className =
        "generate-media-mode-button";

    urlButton.textContent =
        "URL";


    modeWrapper.appendChild(
        uploadButton
    );

    modeWrapper.appendChild(
        urlButton
    );

    container.appendChild(
        modeWrapper
    );


    /* =====================================================
       INPUT WRAPPER
    ===================================================== */

    const inputWrapper =
        document.createElement("div");

    inputWrapper.className =
        "generate-media-input";


    /* =====================================================
       FILE INPUT
    ===================================================== */

    const fileInput =
        document.createElement("input");

    fileInput.type =
        "file";

    fileInput.className =
        "generate-file-input";

    fileInput.accept =
        isMotiongenModel(
            modelArgument
        )
            ? ".jpg,.jpeg,.png,image/jpeg,image/png"
            : ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";


    /* =====================================================
       STATUS
    ===================================================== */

    const status =
        document.createElement("div");

    status.className =
        "generate-upload-status";

    status.textContent =
        "Pilih gambar";


    /* =====================================================
       PREVIEW
    ===================================================== */

    const preview =
        document.createElement("div");

    preview.className =
        "generate-media-preview";


    /* =====================================================
       URL INPUT
    ===================================================== */

    const urlInput =
        document.createElement("input");

    urlInput.type =
        "url";

    urlInput.className =
        "generate-url-input";

    urlInput.placeholder =
        "https://example.com/image.jpg";

    urlInput.autocomplete =
        "off";


    /* =====================================================
       DEFAULT MODE
    ===================================================== */

    urlInput.style.display =
        "none";


    /* =====================================================
       APPEND
    ===================================================== */

    inputWrapper.appendChild(
        fileInput
    );

    inputWrapper.appendChild(
        status
    );

    inputWrapper.appendChild(
        preview
    );

    inputWrapper.appendChild(
        urlInput
    );

    container.appendChild(
        inputWrapper
    );


    /* =====================================================
       UPLOADED URL STATE
    ===================================================== */

    container.dataset.uploadedUrl =
        "";


    /* =====================================================
       GET UPLOADED URL
    ===================================================== */

    container.getUploadedUrl =
        function () {

            return String(
                container.dataset.uploadedUrl ||
                ""
            ).trim();
        };


    /* =====================================================
       SET UPLOADED URL
    ===================================================== */

    container.setUploadedUrl =
        function (value) {

            container.dataset.uploadedUrl =
                String(
                    value || ""
                ).trim();
        };


    /* =====================================================
       SELECTED FILES
    ===================================================== */

    container.getSelectedFiles =
        function () {

            return fileInput.files
                ? Array.from(
                    fileInput.files
                )
                : [];
        };


    /* =====================================================
       URL MODE
    ===================================================== */

    urlButton.addEventListener(
        "click",
        () => {

            uploadButton.classList.remove(
                "active"
            );

            urlButton.classList.add(
                "active"
            );

            fileInput.style.display =
                "none";

            status.style.display =
                "none";

            preview.style.display =
                "none";

            urlInput.style.display =
                "";

            container.dataset.mediaMode =
                "url";
        }
    );


    /* =====================================================
       UPLOAD MODE
    ===================================================== */

    uploadButton.addEventListener(
        "click",
        () => {

            urlButton.classList.remove(
                "active"
            );

            uploadButton.classList.add(
                "active"
            );

            fileInput.style.display =
                "";

            status.style.display =
                "";

            preview.style.display =
                "";

            urlInput.style.display =
                "none";

            container.dataset.mediaMode =
                "upload";
        }
    );


    /* =====================================================
       IMAGE FILE CHANGE
       -----------------------------------------------------
       FIX:
       File langsung di-upload ke Supabase dan public URL
       disimpan ke container.dataset.uploadedUrl.
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

                /* -----------------------------------------
                   VALIDATE
                ----------------------------------------- */

                validateImageFile(
                    file,
                    modelArgument
                );


                /* -----------------------------------------
                   RESET PREVIOUS URL
                ----------------------------------------- */

                container.setUploadedUrl(
                    ""
                );


                /* -----------------------------------------
                   PREVIEW
                ----------------------------------------- */

                preview.innerHTML =
                    "";

                const image =
                    document.createElement(
                        "img"
                    );

                image.src =
                    URL.createObjectURL(
                        file
                    );

                image.alt =
                    "Image preview";

                preview.appendChild(
                    image
                );


                /* -----------------------------------------
                   UPLOAD STATUS
                ----------------------------------------- */

                status.textContent =
                    "Mengunggah gambar...";


                /* -----------------------------------------
                   IMMEDIATE UPLOAD
                ----------------------------------------- */

                const publicUrl =
                    await uploadImageFile(
                        file,
                        modelArgument
                    );


                if (!publicUrl) {

                    throw new Error(
                        "Public URL gambar tidak berhasil dibuat."
                    );
                }


                /* -----------------------------------------
                   STORE PUBLIC URL
                ----------------------------------------- */

                container.setUploadedUrl(
                    publicUrl
                );


                /* -----------------------------------------
                   SUCCESS
                ----------------------------------------- */

                status.textContent =
                    file.name;

            } catch (error) {

                fileInput.value =
                    "";

                container.setUploadedUrl(
                    ""
                );

                preview.innerHTML =
                    "";

                status.textContent =
                    error?.message ||
                    "Gagal mengunggah gambar.";

                console.error(
                    "[GEN-Z.AI Generate] Image upload/validation error:",
                    error
                );
            }
        }
    );


    /* =====================================================
       URL CHANGE
    ===================================================== */

    urlInput.addEventListener(
        "input",
        () => {

            container.setUploadedUrl(
                ""
            );
        }
    );


    /* =====================================================
       INITIAL MODE
    ===================================================== */

    container.dataset.mediaMode =
        "upload";


    return container;
}


/* =========================================================
   AUDIO FIELD
========================================================= */

function createAudioField(
    definition,
    modelArgument
) {

    const container =
        createFieldContainer(
            definition
        );

    container.classList.add(
        "generate-audio-field"
    );

    const label =
        createFieldLabel(
            definition
        );

    container.appendChild(
        label
    );

    const description =
        createFieldDescription(
            definition
        );

    if (description) {

        container.appendChild(
            description
        );
    }


    /* =====================================================
       MODE SWITCH
    ===================================================== */

    const modeWrapper =
        document.createElement("div");

    modeWrapper.className =
        "generate-media-mode";


    const uploadButton =
        document.createElement("button");

    uploadButton.type =
        "button";

    uploadButton.className =
        "generate-media-mode-button active";

    uploadButton.textContent =
        "Upload";


    const urlButton =
        document.createElement("button");

    urlButton.type =
        "button";

    urlButton.className =
        "generate-media-mode-button";

    urlButton.textContent =
        "URL";


    modeWrapper.appendChild(
        uploadButton
    );

    modeWrapper.appendChild(
        urlButton
    );

    container.appendChild(
        modeWrapper
    );


    /* =====================================================
       INPUT WRAPPER
    ===================================================== */

    const inputWrapper =
        document.createElement("div");

    inputWrapper.className =
        "generate-media-input";


    /* =====================================================
       FILE INPUT
    ===================================================== */

    const fileInput =
        document.createElement("input");

    fileInput.type =
        "file";

    fileInput.className =
        "generate-file-input";

    fileInput.accept =
        ".mp3,.wav,audio/mpeg,audio/mp3,audio/wav";


    /* =====================================================
       STATUS
    ===================================================== */

    const status =
        document.createElement("div");

    status.className =
        "generate-upload-status";

    status.textContent =
        "Pilih audio";


    /* =====================================================
       URL INPUT
    ===================================================== */

    const urlInput =
        document.createElement("input");

    urlInput.type =
        "url";

    urlInput.className =
        "generate-url-input";

    urlInput.placeholder =
        "https://example.com/audio.mp3";

    urlInput.autocomplete =
        "off";

    urlInput.style.display =
        "none";


    /* =====================================================
       APPEND
    ===================================================== */

    inputWrapper.appendChild(
        fileInput
    );

    inputWrapper.appendChild(
        status
    );

    inputWrapper.appendChild(
        urlInput
    );

    container.appendChild(
        inputWrapper
    );


    /* =====================================================
       UPLOADED URL STATE
    ===================================================== */

    container.dataset.uploadedUrl =
        "";


    /* =====================================================
       GET UPLOADED URL
    ===================================================== */

    container.getUploadedUrl =
        function () {

            return String(
                container.dataset.uploadedUrl ||
                ""
            ).trim();
        };


    /* =====================================================
       SET UPLOADED URL
    ===================================================== */

    container.setUploadedUrl =
        function (value) {

            container.dataset.uploadedUrl =
                String(
                    value || ""
                ).trim();
        };


    /* =====================================================
       SELECTED FILES
    ===================================================== */

    container.getSelectedFiles =
        function () {

            return fileInput.files
                ? Array.from(
                    fileInput.files
                )
                : [];
        };


    /* =====================================================
       URL MODE
    ===================================================== */

    urlButton.addEventListener(
        "click",
        () => {

            uploadButton.classList.remove(
                "active"
            );

            urlButton.classList.add(
                "active"
            );

            fileInput.style.display =
                "none";

            status.style.display =
                "none";

            urlInput.style.display =
                "";

            container.dataset.mediaMode =
                "url";
        }
    );


    /* =====================================================
       UPLOAD MODE
    ===================================================== */

    uploadButton.addEventListener(
        "click",
        () => {

            urlButton.classList.remove(
                "active"
            );

            uploadButton.classList.add(
                "active"
            );

            fileInput.style.display =
                "";

            status.style.display =
                "";

            urlInput.style.display =
                "none";

            container.dataset.mediaMode =
                "upload";
        }
    );


    /* =====================================================
       AUDIO FILE CHANGE
    ===================================================== */

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

                container.setUploadedUrl(
                    ""
                );

                status.textContent =
                    file.name;

            } catch (error) {

                fileInput.value =
                    "";

                container.setUploadedUrl(
                    ""
                );

                status.textContent =
                    error?.message ||
                    "Audio tidak valid.";

                console.error(
                    "[GEN-Z.AI Generate] Audio validation error:",
                    error
                );
            }
        }
    );


    /* =====================================================
       URL CHANGE
    ===================================================== */

    urlInput.addEventListener(
        "input",
        () => {

            container.setUploadedUrl(
                ""
            );
        }
    );


    /* =====================================================
       INITIAL MODE
    ===================================================== */

    container.dataset.mediaMode =
        "upload";


    return container;
}


/* =========================================================
   TEXTAREA FIELD
========================================================= */

function createTextareaField(
    definition
) {

    const container =
        createFieldContainer(
            definition
        );

    const label =
        createFieldLabel(
            definition
        );

    container.appendChild(
        label
    );

    const description =
        createFieldDescription(
            definition
        );

    if (description) {

        container.appendChild(
            description
        );
    }

    const textarea =
        document.createElement(
            "textarea"
        );

    textarea.className =
        "generate-textarea";

    textarea.name =
        definition.name;

    textarea.placeholder =
        definition.placeholder ||
        "";

    textarea.rows =
        Number(
            definition.rows ||
            5
        );

    if (definition.maxLength) {

        textarea.maxLength =
            Number(
                definition.maxLength
            );
    }

    if (definition.required) {

        textarea.required =
            true;
    }

    if (
        definition.default !==
        undefined
    ) {

        textarea.value =
            String(
                definition.default
            );
    }

    container.appendChild(
        textarea
    );

    container.getValue =
        function () {

            return textarea.value;
        };

    container.setValue =
        function (value) {

            textarea.value =
                value == null
                    ? ""
                    : String(value);
        };

    return container;
}


/* =========================================================
   TEXT FIELD
========================================================= */

function createTextField(
    definition
) {

    const container =
        createFieldContainer(
            definition
        );

    const label =
        createFieldLabel(
            definition
        );

    container.appendChild(
        label
    );

    const description =
        createFieldDescription(
            definition
        );

    if (description) {

        container.appendChild(
            description
        );
    }

    const input =
        document.createElement(
            "input"
        );

    input.type =
        definition.type ===
            "number"
            ? "number"
            : "text";

    input.className =
        "generate-input";

    input.name =
        definition.name;

    input.placeholder =
        definition.placeholder ||
        "";

    if (definition.required) {

        input.required =
            true;
    }

    if (definition.maxLength) {

        input.maxLength =
            Number(
                definition.maxLength
            );
    }

    if (
        definition.default !==
        undefined
    ) {

        input.value =
            String(
                definition.default
            );
    }

    container.appendChild(
        input
    );

    container.getValue =
        function () {

            return input.value;
        };

    container.setValue =
        function (value) {

            input.value =
                value == null
                    ? ""
                    : String(value);
        };

    return container;
}


/* =========================================================
   NUMBER FIELD
========================================================= */

function createNumberField(
    definition
) {

    const container =
        createFieldContainer(
            definition
        );

    const label =
        createFieldLabel(
            definition
        );

    container.appendChild(
        label
    );

    const description =
        createFieldDescription(
            definition
        );

    if (description) {

        container.appendChild(
            description
        );
    }

    const input =
        document.createElement(
            "input"
        );

    input.type =
        "number";

    input.className =
        "generate-input";

    input.name =
        definition.name;

    if (
        definition.min !==
        undefined
    ) {

        input.min =
            String(
                definition.min
            );
    }

    if (
        definition.max !==
        undefined
    ) {

        input.max =
            String(
                definition.max
            );
    }

    if (
        definition.step !==
        undefined
    ) {

        input.step =
            String(
                definition.step
            );
    }

    if (
        definition.default !==
        undefined
    ) {

        input.value =
            String(
                definition.default
            );
    }

    if (definition.required) {

        input.required =
            true;
    }

    container.appendChild(
        input
    );

    container.getValue =
        function () {

            return input.value;
        };

    container.setValue =
        function (value) {

            input.value =
                value == null
                    ? ""
                    : String(value);
        };

    return container;
}


/* =========================================================
   BOOLEAN FIELD
========================================================= */

function createBooleanField(
    definition
) {

    const container =
        createFieldContainer(
            definition
        );

    const wrapper =
        document.createElement(
            "label"
        );

    wrapper.className =
        "generate-checkbox-wrapper";


    const input =
        document.createElement(
            "input"
        );

    input.type =
        "checkbox";

    input.name =
        definition.name;

    input.checked =
        definition.default === true;


    const text =
        document.createElement(
            "span"
        );

    text.textContent =
        definition.label ||
        definition.title ||
        definition.name;


    wrapper.appendChild(
        input
    );

    wrapper.appendChild(
        text
    );

    container.appendChild(
        wrapper
    );


    container.getValue =
        function () {

            return input.checked;
        };


    container.setValue =
        function (value) {

            input.checked =
                Boolean(value);
        };


    return container;
}


/* =========================================================
   SELECT FIELD
========================================================= */

function createSelectField(
    definition
) {

    const container =
        createFieldContainer(
            definition
        );

    const label =
        createFieldLabel(
            definition
        );

    container.appendChild(
        label
    );

    const description =
        createFieldDescription(
            definition
        );

    if (description) {

        container.appendChild(
            description
        );
    }

    const select =
        document.createElement(
            "select"
        );

    select.className =
        "generate-select";

    select.name =
        definition.name;


    const options =
        Array.isArray(
            definition.options
        )
            ? definition.options
            : Array.isArray(
                definition.enum
            )
                ? definition.enum
                : [];


    options.forEach(
        option => {

            const element =
                document.createElement(
                    "option"
                );

            if (
                typeof option ===
                "object"
            ) {

                element.value =
                    String(
                        option.value ??
                        option.id ??
                        ""
                    );

                element.textContent =
                    option.label ??
                    option.name ??
                    option.value ??
                    "";

            } else {

                element.value =
                    String(
                        option
                    );

                element.textContent =
                    String(
                        option
                    );
            }

            select.appendChild(
                element
            );
        }
    );


    if (
        definition.default !==
        undefined
    ) {

        select.value =
            String(
                definition.default
            );
    }


    container.appendChild(
        select
    );


    container.getValue =
        function () {

            return select.value;
        };


    container.setValue =
        function (value) {

            select.value =
                value == null
                    ? ""
                    : String(value);
        };


    return container;
}


/* =========================================================
   GENERIC FIELD
========================================================= */

function createGenericField(
    definition,
    modelArgument
) {

    const type =
        String(
            definition.type ||
            "text"
        ).toLowerCase();


    if (
        type === "image" ||
        type === "images" ||
        type === "image_url" ||
        type === "image_urls"
    ) {

        return createImageField(
            definition,
            modelArgument
        );
    }


    if (
        type === "audio" ||
        type === "audio_url"
    ) {

        return createAudioField(
            definition,
            modelArgument
        );
    }


    if (
        type === "textarea"
    ) {

        return createTextareaField(
            definition
        );
    }


    if (
        type === "boolean" ||
        type === "bool" ||
        type === "checkbox"
    ) {

        return createBooleanField(
            definition
        );
    }


    if (
        type === "select" ||
        type === "enum"
    ) {

        return createSelectField(
            definition
        );
    }


    if (
        type === "number" ||
        type === "integer" ||
        type === "duration"
    ) {

        return createNumberField(
            definition
        );
    }


    return createTextField(
        definition
    );
}


/* =========================================================
   VALIDATE IMAGE
========================================================= */

function validateImageFile(
    file,
    modelArgument
) {

    if (!(file instanceof File)) {

        throw new Error(
            "File gambar tidak valid."
        );
    }


    const allowedTypes =
        isMotiongenModel(
            modelArgument
        )
            ? MOTIONGEN_ALLOWED_IMAGE_TYPES
            : ALLOWED_IMAGE_TYPES;


    if (
        !allowedTypes.includes(
            file.type
        )
    ) {

        throw new Error(
            isMotiongenModel(
                modelArgument
            )
                ? "Motiongen hanya mendukung JPG dan PNG."
                : "Format gambar tidak didukung."
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


/* =========================================================
   VALIDATE AUDIO
========================================================= */

function validateAudioFile(
    file
) {

    if (!(file instanceof File)) {

        throw new Error(
            "File audio tidak valid."
        );
    }


    if (
        !ALLOWED_AUDIO_TYPES.includes(
            file.type
        )
    ) {

        const extension =
            file.name
                .split(".")
                .pop()
                ?.toLowerCase();


        if (
            extension !== "mp3" &&
            extension !== "wav"
        ) {

            throw new Error(
                "Audio harus berupa MP3 atau WAV."
            );
        }
    }


    return true;
}


/* =========================================================
   UPLOAD IMAGE FILE
========================================================= */

async function uploadImageFile(
    file,
    modelArgument
) {

    validateImageFile(
        file,
        modelArgument
    );


    const supabase =
        getSupabaseClient();


    if (!supabase) {

        throw new Error(
            "Supabase client belum tersedia."
        );
    }


    const user =
        getCurrentUser();


    const userId =
        user?.id ||
        user?.user?.id ||
        "";


    if (!userId) {

        throw new Error(
            "User belum terautentikasi."
        );
    }


    const extension =
        file.name
            .split(".")
            .pop()
            ?.toLowerCase() ||
        "jpg";


    const safeExtension =
        extension === "jpeg"
            ? "jpg"
            : extension;


    const fileName =
        `${crypto.randomUUID()}.${safeExtension}`;


    const path =
        `${STORAGE_IMAGE_FOLDER}/${userId}/${fileName}`;


    const {
        error
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
                        file.type ||
                        "image/jpeg"
                }
            );


    if (error) {

        throw new Error(
            error.message ||
            "Gagal mengunggah gambar."
        );
    }


    const {
        data
    } =
        supabase.storage
            .from(
                STORAGE_BUCKET
            )
            .getPublicUrl(
                path
            );


    const publicUrl =
        String(
            data?.publicUrl ||
            ""
        ).trim();


    if (!publicUrl) {

        throw new Error(
            "Public URL gambar tidak tersedia."
        );
    }


    return publicUrl;
}


/* =========================================================
   UPLOAD AUDIO FILE
========================================================= */

async function uploadAudioFile(
    file,
    modelArgument
) {

    validateAudioFile(
        file
    );


    const supabase =
        getSupabaseClient();


    if (!supabase) {

        throw new Error(
            "Supabase client belum tersedia."
        );
    }


    const user =
        getCurrentUser();


    const userId =
        user?.id ||
        user?.user?.id ||
        "";


    if (!userId) {

        throw new Error(
            "User belum terautentikasi."
        );
    }


    const extension =
        file.name
            .split(".")
            .pop()
            ?.toLowerCase() ||
        "mp3";


    const safeExtension =
        extension === "mpeg"
            ? "mp3"
            : extension;


    const fileName =
        `${crypto.randomUUID()}.${safeExtension}`;


    const path =
        `${STORAGE_AUDIO_FOLDER}/${userId}/${fileName}`;


    const {
        error
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
                        file.type ||
                        "audio/mpeg"
                }
            );


    if (error) {

        throw new Error(
            error.message ||
            "Gagal mengunggah audio."
        );
    }


    const {
        data
    } =
        supabase.storage
            .from(
                STORAGE_BUCKET
            )
            .getPublicUrl(
                path
            );


    const publicUrl =
        String(
            data?.publicUrl ||
            ""
        ).trim();


    if (!publicUrl) {

        throw new Error(
            "Public URL audio tidak tersedia."
        );
    }


    return publicUrl;
}


/* =========================================================
   NORMALIZE RESOLUTION
========================================================= */

function normalizeMotiongenResolution(
    value
) {

    const normalized =
        String(
            value ?? ""
        ).trim();


    if (
        MOTIONGEN_RESOLUTIONS.includes(
            normalized
        )
    ) {

        return normalized;
    }


    if (
        MOTIONGEN_RESOLUTION_ALIASES[
            normalized
        ]
    ) {

        return MOTIONGEN_RESOLUTION_ALIASES[
            normalized
        ];
    }


    return "720p";
}


/* =========================================================
   NORMALIZE PARAMETER VALUE
========================================================= */

function normalizeParameterValue(
    definition,
    value,
    modelArgument
) {

    if (
        value === null ||
        value === undefined
    ) {

        return value;
    }


    const type =
        String(
            definition?.type ||
            ""
        ).toLowerCase();


    if (
        type === "image" ||
        type === "images" ||
        type === "image_url" ||
        type === "image_urls"
    ) {

        if (Array.isArray(value)) {

            return value
                .map(
                    item =>
                        String(
                            item || ""
                        ).trim()
                )
                .filter(Boolean);
        }


        if (
            typeof value ===
            "string"
        ) {

            return value
                .trim();
        }


        return value;
    }


    if (
        type === "audio" ||
        type === "audio_url"
    ) {

        return typeof value ===
            "string"
            ? value.trim()
            : value;
    }


    if (
        type === "number" ||
        type === "integer" ||
        type === "duration"
    ) {

        const number =
            Number(value);

        return Number.isFinite(
            number
        )
            ? number
            : value;
    }


    if (
        type === "boolean" ||
        type === "bool"
    ) {

        return Boolean(
            value
        );
    }


    if (
        isMotiongenModel(
            modelArgument
        ) &&
        definition.name ===
            "resolution"
    ) {

        return normalizeMotiongenResolution(
            value
        );
    }


    return typeof value ===
        "string"
        ? value.trim()
        : value;
}


/* =========================================================
   RESOLVE IMAGE PARAMETER
========================================================= */

async function resolveImageParameterValue(
    rawValue,
    modelArgument
) {

    if (
        typeof rawValue ===
        "string"
    ) {

        const url =
            rawValue.trim();

        return url
            ? [url]
            : [];
    }


    if (
        Array.isArray(
            rawValue
        )
    ) {

        return rawValue
            .map(
                value =>
                    String(
                        value || ""
                    ).trim()
            )
            .filter(Boolean);
    }


    if (
        !rawValue ||
        typeof rawValue !==
            "object"
    ) {

        return [];
    }


    const mode =
        rawValue.mode ||
        "upload";


    if (
        mode === "url"
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
        rawValue.url
    ) {

        const url =
            String(
                rawValue.url
            ).trim();

        return url
            ? [url]
            : [];
    }


    const files =
        Array.isArray(
            rawValue.files
        )
            ? rawValue.files
            : [];


    if (!files.length) {
        return [];
    }


    const urls = [];


    for (
        const file of files
    ) {

        const url =
            await uploadImageFile(
                file,
                modelArgument
            );

        if (url) {
            urls.push(url);
        }
    }


    return urls;
}


/* =========================================================
   RESOLVE AUDIO PARAMETER
========================================================= */

async function resolveAudioParameterValue(
    rawValue,
    modelArgument
) {

    if (
        typeof rawValue ===
        "string"
    ) {

        return rawValue.trim();
    }


    if (
        !rawValue ||
        typeof rawValue !==
            "object"
    ) {

        return "";
    }


    const mode =
        rawValue.mode ||
        "upload";


    if (
        mode === "url"
    ) {

        return String(
            rawValue.url ||
            ""
        ).trim();
    }


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
            "Audio upload harus berisi tepat 1 file."
        );
    }


    return await uploadAudioFile(
        files[0],
        modelArgument
    );
}


/* =========================================================
   READ FIELD VALUE
========================================================= */

function readFieldValue(
    field
) {

    if (
        typeof field.getValue ===
        "function"
    ) {

        return field.getValue();
    }


    const name =
        field.dataset.parameter ||
        "";


    /* =====================================================
       MEDIA
    ===================================================== */

    if (
        field.classList.contains(
            "generate-image-field"
        ) ||
        field.classList.contains(
            "generate-audio-field"
        )
    ) {

        const mode =
            field.dataset.mediaMode ||
            "upload";


        if (
            mode === "url"
        ) {

            const input =
                field.querySelector(
                    ".generate-url-input"
                );

            return {
                mode: "url",
                url:
                    input?.value?.trim() ||
                    "",
                files: []
            };
        }


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


    const input =
        field.querySelector(
            `[name="${CSS.escape(name)}"]`
        );


    if (!input) {
        return "";
    }


    if (
        input.type ===
        "checkbox"
    ) {

        return input.checked;
    }


    return input.value;
}


/* =========================================================
   GET FORM PARAMETERS
========================================================= */

async function getFormParameters(
    modelArgument
) {

    const model =
        modelArgument ||
        getCurrentModel();


    if (!model) {

        throw new Error(
            "Model belum dipilih."
        );
    }


    const elements =
        getGenerateElements();


    const form =
        elements?.form ||
        document.querySelector(
            "form"
        );


    if (!form) {

        throw new Error(
            "Generate form tidak ditemukan."
        );
    }


    const definitions =
        sortParameterDefinitions(
            getParameterDefinitions(
                model
            )
        );


    const parameters = {};


    for (
        const definition of
        definitions
    ) {

        const name =
            String(
                definition.name ||
                ""
            ).trim();


        if (!name) {
            continue;
        }


        /* -----------------------------------------------
           INTERNAL
        ----------------------------------------------- */

        if (
            INTERNAL_PARAMETERS.has(
                name
            )
        ) {

            continue;
        }


        /* -----------------------------------------------
           SERVER CONTROLLED
        ----------------------------------------------- */

        if (
            SERVER_CONTROLLED_PARAMETERS.has(
                name
            )
        ) {

            continue;
        }


        /* -----------------------------------------------
           CLIENT FORBIDDEN
        ----------------------------------------------- */

        if (
            CLIENT_FORBIDDEN_PARAMETERS.has(
                name
            )
        ) {

            continue;
        }


        const field =
            form.querySelector(
                `[data-parameter="${CSS.escape(name)}"]`
            );


        if (!field) {
            continue;
        }


        const rawValue =
            readFieldValue(
                field
            );


        const normalizedValue =
            normalizeParameterValue(
                definition,
                rawValue,
                model
            );


        /* =================================================
           IMAGE
        ================================================= */

        const type =
            String(
                definition.type ||
                ""
            ).toLowerCase();


        if (
            type === "image" ||
            type === "images" ||
            type === "image_url" ||
            type === "image_urls"
        ) {

            const imageUrls =
                await resolveImageParameterValue(
                    normalizedValue,
                    model
                );


            if (
                name === "image_url"
            ) {

                if (
                    imageUrls.length
                ) {

                    parameters.image_url =
                        imageUrls[0];
                }

            } else {

                parameters.image_urls =
                    imageUrls;
            }


            continue;
        }


        /* =================================================
           AUDIO
        ================================================= */

        if (
            type === "audio" ||
            type === "audio_url"
        ) {

            const audioUrl =
                await resolveAudioParameterValue(
                    normalizedValue,
                    model
                );


            if (audioUrl) {

                parameters.audio_url =
                    audioUrl;
            }


            continue;
        }


        /* =================================================
           EMPTY VALUES
        ================================================= */

        if (
            normalizedValue ===
                "" ||
            normalizedValue ===
                null ||
            normalizedValue ===
                undefined
        ) {

            continue;
        }


        parameters[name] =
            normalizedValue;
    }


    /* =====================================================
       MOTIONGEN VALIDATION
    ===================================================== */

    if (
        isMotiongenModel(
            model
        )
    ) {

        /* -----------------------------------------------
           PROMPT
        ----------------------------------------------- */

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


        /* -----------------------------------------------
           IMAGE
        ----------------------------------------------- */

        let imageUrls =
            Array.isArray(
                parameters.image_urls
            )
                ? parameters.image_urls
                : [];


        if (
            !imageUrls.length &&
            parameters.image_url
        ) {

            imageUrls = [
                String(
                    parameters.image_url
                ).trim()
            ];
        }


        imageUrls =
            imageUrls
                .map(
                    url =>
                        String(
                            url || ""
                        ).trim()
                )
                .filter(Boolean);


        if (
            imageUrls.length !== 1
        ) {

            throw new Error(
                "Motiongen membutuhkan tepat 1 gambar."
            );
        }


        parameters.image_urls =
            imageUrls;


        delete parameters.image_url;


        /* -----------------------------------------------
           AUDIO
        ----------------------------------------------- */

        const audioUrl =
            String(
                parameters.audio_url ||
                ""
            ).trim();


        if (!audioUrl) {

            throw new Error(
                "Motiongen membutuhkan 1 audio."
            );
        }


        parameters.audio_url =
            audioUrl;


        /* -----------------------------------------------
           RESOLUTION
        ----------------------------------------------- */

        parameters.resolution =
            normalizeMotiongenResolution(
                parameters.resolution
            );


        /* -----------------------------------------------
           FORBIDDEN
        ----------------------------------------------- */

        delete parameters.webhook;

        delete parameters.webhook_url;

        delete parameters.nsfw_checker;
    }


    /* =====================================================
       FINAL CLEANUP
    ===================================================== */

    delete parameters.task_id;

    delete parameters.index;

    delete parameters.webhook;

    delete parameters.webhook_url;

    delete parameters.nsfw_checker;


    return parameters;
}


/* =========================================================
   SET FIELD VALUE
========================================================= */

function setFieldValue(
    field,
    value
) {

    if (!field) {
        return;
    }


    if (
        typeof field.setValue ===
        "function"
    ) {

        field.setValue(
            value
        );

        return;
    }


    if (
        field.classList.contains(
            "generate-image-field"
        ) ||
        field.classList.contains(
            "generate-audio-field"
        )
    ) {

        if (
            typeof value ===
            "string"
        ) {

            const urlInput =
                field.querySelector(
                    ".generate-url-input"
                );

            if (urlInput) {

                urlInput.value =
                    value;
            }

            if (
                typeof field.setUploadedUrl ===
                "function"
            ) {

                field.setUploadedUrl(
                    value
                );
            }
        }

        return;
    }


    const name =
        field.dataset.parameter;


    const input =
        field.querySelector(
            `[name="${CSS.escape(name)}"]`
        );


    if (!input) {
        return;
    }


    if (
        input.type ===
        "checkbox"
    ) {

        input.checked =
            Boolean(value);

        return;
    }


    input.value =
        value == null
            ? ""
            : String(value);
}


/* =========================================================
   RESET DYNAMIC FIELDS
========================================================= */

function resetDynamicFields() {

    const elements =
        getGenerateElements();


    const form =
        elements?.form ||
        document.querySelector(
            "form"
        );


    if (!form) {
        return;
    }


    const dynamicContainer =
        form.querySelector(
            "[data-generate-dynamic-fields]"
        ) ||
        form.querySelector(
            ".generate-dynamic-fields"
        );


    if (dynamicContainer) {

        dynamicContainer.innerHTML =
            "";
    }
}


/* =========================================================
   RENDER MODEL FORM
========================================================= */

function renderModelForm(
    modelArgument
) {

    const model =
        modelArgument ||
        getCurrentModel();


    if (!model) {
        return;
    }


    const elements =
        getGenerateElements();


    const form =
        elements?.form ||
        document.querySelector(
            "form"
        );


    if (!form) {
        return;
    }


    let container =
        form.querySelector(
            "[data-generate-dynamic-fields]"
        );


    if (!container) {

        container =
            form.querySelector(
                ".generate-dynamic-fields"
            );
    }


    if (!container) {

        container =
            document.createElement(
                "div"
            );

        container.className =
            "generate-dynamic-fields";

        container.dataset.generateDynamicFields =
            "true";

        form.appendChild(
            container
        );
    }


    container.innerHTML =
        "";


    const definitions =
        sortParameterDefinitions(
            getParameterDefinitions(
                model
            )
        );


    definitions.forEach(
        definition => {

            if (
                INTERNAL_PARAMETERS.has(
                    definition.name
                )
            ) {
                return;
            }

            if (
                SERVER_CONTROLLED_PARAMETERS.has(
                    definition.name
                )
            ) {
                return;
            }

            if (
                CLIENT_FORBIDDEN_PARAMETERS.has(
                    definition.name
                )
            ) {
                return;
            }


            const field =
                createGenericField(
                    definition,
                    model
                );


            if (field) {

                container.appendChild(
                    field
                );
            }
        }
    );


    return container;
}


/* =========================================================
   GET MEDIA PARAMETERS
========================================================= */

function getMediaParameters(
    modelArgument
) {

    const model =
        modelArgument ||
        getCurrentModel();


    if (!model) {
        return {};
    }


    const elements =
        getGenerateElements();


    const form =
        elements?.form ||
        document.querySelector(
            "form"
        );


    if (!form) {
        return {};
    }


    const result = {};


    const imageField =
        form.querySelector(
            '[data-parameter="image_urls"]'
        ) ||
        form.querySelector(
            '[data-parameter="image_url"]'
        );


    if (imageField) {

        result.image_urls =
            typeof imageField.getUploadedUrl ===
            "function"
                ? imageField.getUploadedUrl()
                : "";
    }


    const audioField =
        form.querySelector(
            '[data-parameter="audio_url"]'
        );


    if (audioField) {

        result.audio_url =
            typeof audioField.getUploadedUrl ===
            "function"
                ? audioField.getUploadedUrl()
                : "";
    }


    return result;
}


/* =========================================================
   PUBLIC API
========================================================= */

export {
    isMotiongenModel,
    getParameterDefinitions,
    normalizeParameterDefinitions,
    normalizeParameterValue,
    createImageField,
    createAudioField,
    uploadImageFile,
    uploadAudioFile,
    resolveImageParameterValue,
    resolveAudioParameterValue,
    readFieldValue,
    getFormParameters,
    setFieldValue,
    resetDynamicFields,
    renderModelForm,
    getMediaParameters,
    validateImageFile,
    validateAudioFile,
    normalizeMotiongenResolution
};


/* =========================================================
   GLOBAL COMPATIBILITY
========================================================= */

if (
    typeof window !==
    "undefined"
) {

    window.GENZGenerateForm =
        Object.freeze({
            isMotiongenModel,
            getParameterDefinitions,
            normalizeParameterDefinitions,
            normalizeParameterValue,
            createImageField,
            createAudioField,
            uploadImageFile,
            uploadAudioFile,
            resolveImageParameterValue,
            resolveAudioParameterValue,
            readFieldValue,
            getFormParameters,
            setFieldValue,
            resetDynamicFields,
            renderModelForm,
            getMediaParameters,
            validateImageFile,
            validateAudioFile,
            normalizeMotiongenResolution
        });
}
