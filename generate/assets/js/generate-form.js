/* =========================================================
   GEN-Z.AI
   GENERATE FORM MODULE
   ---------------------------------------------------------
   File:
   generate/assets/js/generate-form.js

   Tanggung jawab:
   - Render parameter berdasarkan model.parameters
   - Input gambar URL / Upload
   - Maksimal gambar mengikuti maxItems
   - Preview + tombol X
   - Checkbox-style ratio / resolution
   - Duration slider
   - Collect parameter form
   - Reset form

   SOURCE OF TRUTH:
   - models/*/parameters.js

   CATATAN:
   - task_id bukan input user
   - task_id tidak pernah dikirim
   - image_urls hanya berisi SATU sumber aktif
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
    "task_id"
]);

const GENERATE_PARAMETER_ORDER = [
    "image_urls",
    "image_url",
    "prompt",
    "aspect_ratio",
    "resolution",
    "duration"
];

const STORAGE_BUCKET = "dashboard-videos";

const ALLOWED_IMAGE_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp"
]);

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;


/* =========================================================
   HELPERS
========================================================= */

function getContainer() {
    const elements = getGenerateElements();

    return elements?.dynamicFields || null;
}


function getParameterDefinitions() {
    const model = getCurrentModel();

    if (!model) {
        return {};
    }

    const parameters =
        model.parameters ||
        model.config?.parameters ||
        {};

    if (
        !parameters ||
        typeof parameters !== "object"
    ) {
        return {};
    }

    if (
        parameters.parameters &&
        typeof parameters.parameters === "object"
    ) {
        return parameters.parameters;
    }

    return parameters;
}


function parameterDefinition(name) {
    const definitions = getParameterDefinitions();

    return definitions[name] || null;
}


function createFieldId(name) {
    return (
        "generate-field-" +
        String(name)
            .replace(/[^a-zA-Z0-9_-]/g, "-")
    );
}


function getDefaultValue(definition) {
    if (
        !definition ||
        typeof definition !== "object"
    ) {
        return undefined;
    }

    return definition.default;
}


function isInternalParameter(name) {
    return INTERNAL_PARAMETERS.has(name);
}


function isRenderableParameter(name, definition) {
    if (isInternalParameter(name)) {
        return false;
    }

    if (
        !definition ||
        typeof definition !== "object"
    ) {
        return false;
    }

    return GENERATE_PARAMETER_ORDER.includes(name);
}


function normalizeArray(value) {
    if (Array.isArray(value)) {
        return value
            .map(item => String(item ?? "").trim())
            .filter(Boolean);
    }

    if (
        value === null ||
        value === undefined
    ) {
        return [];
    }

    if (typeof value === "string") {
        const text = value.trim();

        if (!text) {
            return [];
        }

        if (
            text.startsWith("[") &&
            text.endsWith("]")
        ) {
            try {
                const parsed = JSON.parse(text);

                if (Array.isArray(parsed)) {
                    return normalizeArray(parsed);
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
                .slice(1, -1)
                .split(",")
                .map(item =>
                    item
                        .trim()
                        .replace(/^"(.*)"$/, "$1")
                )
                .filter(Boolean);
        }

        return text
            .split(",")
            .map(item => item.trim())
            .filter(Boolean);
    }

    return [String(value)];
}


/* =========================================================
   FIELD WRAPPER
========================================================= */

function createFieldWrapper(name, label) {
    const field = document.createElement("div");

    field.className = "generate-field";
    field.dataset.parameter = name;

    const title = document.createElement("label");

    title.className = "generate-field-label";
    title.textContent = label;

    field.appendChild(title);

    return {
        field,
        title
    };
}


/* =========================================================
   IMAGE INPUT
   ---------------------------------------------------------
   SATU SLOT

   URL:
   image_urls = [url]

   UPLOAD:
   image_urls = [publicUrl]

   Hanya satu sumber aktif.
========================================================= */

function createImageInput(definition, name) {
    const wrapper = document.createElement("div");

    wrapper.className = "generate-image-input";

    const maxItemsRaw = Number(
        definition?.maxItems
    );

    const maxItems =
        Number.isFinite(maxItemsRaw)
            ? Math.max(0, Math.floor(maxItemsRaw))
            : 1;


    /* -----------------------------------------------------
       STATE
    ----------------------------------------------------- */

    let inputMode = "url";
    let uploadedPath = "";
    let uploadedUrl = "";


    /* -----------------------------------------------------
       MODE BUTTONS
    ----------------------------------------------------- */

    const modeGroup = document.createElement("div");

    modeGroup.className = "generate-image-mode";


    const urlModeButton = document.createElement("button");

    urlModeButton.type = "button";
    urlModeButton.className =
        "generate-image-mode-button active";
    urlModeButton.textContent = "Gunakan URL";


    const uploadModeButton = document.createElement("button");

    uploadModeButton.type = "button";
    uploadModeButton.className =
        "generate-image-mode-button";
    uploadModeButton.textContent = "Upload Gambar";


    modeGroup.appendChild(urlModeButton);
    modeGroup.appendChild(uploadModeButton);

    wrapper.appendChild(modeGroup);


    /* -----------------------------------------------------
       URL PANEL
    ----------------------------------------------------- */

    const urlPanel = document.createElement("div");

    urlPanel.className = "generate-image-url-panel";


    const urlInput = document.createElement("input");

    urlInput.type = "url";
    urlInput.id = createFieldId(name);
    urlInput.name = name;
    urlInput.className = "form-control";
    urlInput.inputMode = "url";
    urlInput.autocomplete = "off";
    urlInput.placeholder =
        "Tempel URL gambar...";


    const defaultValue = getDefaultValue(definition);

    const defaultImages =
        normalizeArray(defaultValue);


    if (defaultImages.length) {
        urlInput.value = defaultImages[0];
    }


    urlPanel.appendChild(urlInput);

    wrapper.appendChild(urlPanel);


    /* -----------------------------------------------------
       UPLOAD PANEL
    ----------------------------------------------------- */

    const uploadPanel = document.createElement("div");

    uploadPanel.className =
        "generate-image-upload-panel";

    uploadPanel.hidden = true;


    const fileInput = document.createElement("input");

    fileInput.type = "file";
    fileInput.accept =
        ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";
    fileInput.hidden = true;


    const chooseButton = document.createElement("button");

    chooseButton.type = "button";
    chooseButton.className =
        "generate-image-upload-button";
    chooseButton.textContent =
        "+ Tambah Gambar";


    const uploadStatus = document.createElement("div");

    uploadStatus.className =
        "generate-image-upload-status";


    /* -----------------------------------------------------
       PREVIEW
    ----------------------------------------------------- */

    const preview = document.createElement("div");

    preview.className =
        "generate-image-preview";

    preview.hidden = true;


    const previewImage = document.createElement("img");

    previewImage.className =
        "generate-image-preview-image";

    previewImage.alt =
        "Preview gambar referensi";


    /* -----------------------------------------------------
       REMOVE
    ----------------------------------------------------- */

    const removeButton = document.createElement("button");

    removeButton.type = "button";
    removeButton.className =
        "generate-image-remove";
    removeButton.textContent = "×";
    removeButton.title = "Hapus gambar";
    removeButton.setAttribute(
        "aria-label",
        "Hapus gambar"
    );


    preview.appendChild(previewImage);
    preview.appendChild(removeButton);

    uploadPanel.appendChild(fileInput);
    uploadPanel.appendChild(chooseButton);
    uploadPanel.appendChild(uploadStatus);
    uploadPanel.appendChild(preview);

    wrapper.appendChild(uploadPanel);


    /* =====================================================
       CLEAR PREVIEW
    ===================================================== */

    function clearPreview() {
        previewImage.removeAttribute("src");

        preview.hidden = true;

        uploadedUrl = "";
    }


    /* =====================================================
       REMOVE STORAGE FILE
    ===================================================== */

    async function removeUploadedFile() {
        const path = uploadedPath;

        uploadedPath = "";
        uploadedUrl = "";

        clearPreview();

        if (!path) {
            return;
        }

        const client = getSupabaseClient();

        if (
            !client ||
            !client.storage
        ) {
            return;
        }

        try {
            await client
                .storage
                .from(STORAGE_BUCKET)
                .remove([path]);
        } catch (error) {
            console.warn(
                "[GEN-Z.AI][Generate Form] Storage remove failed:",
                error
            );
        }
    }


    /* =====================================================
       SET MODE
    ===================================================== */

    async function setMode(mode) {
        const nextMode =
            mode === "upload"
                ? "upload"
                : "url";

        inputMode = nextMode;

        const isUpload =
            inputMode === "upload";


        urlPanel.hidden = isUpload;
        uploadPanel.hidden = !isUpload;


        urlModeButton.classList.toggle(
            "active",
            !isUpload
        );

        uploadModeButton.classList.toggle(
            "active",
            isUpload
        );


        if (isUpload) {
            urlInput.value = "";
            return;
        }


        if (uploadedPath) {
            await removeUploadedFile();
        } else {
            clearPreview();
        }

        uploadStatus.textContent = "";
    }


    /* =====================================================
       UPLOAD IMAGE
    ===================================================== */

    async function uploadReferenceImage(file) {
        if (!file) {
            return;
        }


        if (maxItems < 1) {
            uploadStatus.textContent =
                "Model tidak mendukung gambar referensi.";

            return;
        }


        const type =
            String(file.type || "")
                .toLowerCase();


        if (!ALLOWED_IMAGE_TYPES.has(type)) {
            uploadStatus.textContent =
                "Format gambar harus JPG, PNG, atau WebP.";

            fileInput.value = "";

            return;
        }


        if (
            Number(file.size) >
            MAX_IMAGE_SIZE
        ) {
            uploadStatus.textContent =
                "Ukuran gambar maksimal 10 MB.";

            fileInput.value = "";

            return;
        }


        const client = getSupabaseClient();
        const user = getCurrentUser();


        if (
            !client ||
            !client.storage
        ) {
            uploadStatus.textContent =
                "Storage belum tersedia.";

            return;
        }


        if (!user?.id) {
            uploadStatus.textContent =
                "Session user belum tersedia.";

            return;
        }


        if (uploadedPath) {
            await removeUploadedFile();
        }


        chooseButton.disabled = true;

        uploadStatus.textContent =
            "Mengunggah gambar...";


        const extensionMap = {
            "image/jpeg": "jpg",
            "image/png": "png",
            "image/webp": "webp"
        };

        const extension =
            extensionMap[type] || "jpg";


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
                    .from(STORAGE_BUCKET)
                    .upload(
                        path,
                        file,
                        {
                            cacheControl: "3600",
                            upsert: false,
                            contentType: type
                        }
                    );


            if (result?.error) {
                throw result.error;
            }


            const publicResult =
                client
                    .storage
                    .from(STORAGE_BUCKET)
                    .getPublicUrl(path);


            const publicUrl =
                String(
                    publicResult
                        ?.data
                        ?.publicUrl ||
                    ""
                ).trim();


            if (!publicUrl) {
                throw new Error(
                    "URL gambar tidak tersedia."
                );
            }


            uploadedPath = path;
            uploadedUrl = publicUrl;


            previewImage.src = publicUrl;
            preview.hidden = false;


            uploadStatus.textContent =
                "Gambar siap digunakan.";


        } catch (error) {
            uploadedPath = "";
            uploadedUrl = "";

            clearPreview();

            uploadStatus.textContent =
                error?.message ||
                "Gagal mengunggah gambar.";

            console.error(
                "[GEN-Z.AI][Generate Form] Upload gagal:",
                error
            );


        } finally {
            chooseButton.disabled = false;
            fileInput.value = "";
        }
    }


    /* =====================================================
       EVENTS
    ===================================================== */

    urlModeButton.addEventListener(
        "click",
        () => {
            void setMode("url");
        }
    );


    uploadModeButton.addEventListener(
        "click",
        () => {
            void setMode("upload");
        }
    );


    chooseButton.addEventListener(
        "click",
        () => {
            if (maxItems < 1) {
                uploadStatus.textContent =
                    "Model tidak mendukung gambar referensi.";

                return;
            }

            fileInput.click();
        }
    );


    fileInput.addEventListener(
        "change",
        event => {
            const file =
                event.target?.files?.[0] ||
                null;

            void uploadReferenceImage(file);
        }
    );


    removeButton.addEventListener(
        "click",
        () => {
            void removeUploadedFile();

            uploadStatus.textContent = "";
        }
    );


    /* =====================================================
       PUBLIC IMAGE API
    ===================================================== */

    wrapper.getInputMode = () => inputMode;

    wrapper.getUrlInput = () => urlInput;

    wrapper.getUploadedUrl = () => uploadedUrl;

    wrapper.getUploadedPath = () => uploadedPath;

    wrapper.getReferenceFiles = () =>
        uploadedUrl
            ? [uploadedUrl]
            : [];


    wrapper.clearUploadedFile = async () => {
        await removeUploadedFile();

        uploadStatus.textContent = "";
        fileInput.value = "";
    };


    wrapper.setMode = setMode;


    /* =====================================================
       MODEL DOES NOT SUPPORT IMAGE
    ===================================================== */

    if (maxItems < 1) {
        urlModeButton.disabled = true;
        uploadModeButton.disabled = true;
        urlInput.disabled = true;
        chooseButton.disabled = true;

        uploadStatus.textContent =
            "Model ini tidak mendukung gambar referensi.";
    }


    return wrapper;
}


/* =========================================================
   TEXTAREA
========================================================= */

function createTextarea(definition, name) {
    const textarea =
        document.createElement("textarea");

    textarea.id = createFieldId(name);
    textarea.name = name;
    textarea.className = "form-control";
    textarea.rows = 5;
    textarea.placeholder =
        "Tulis prompt video...";


    const maxLength =
        Number(definition?.maxLength);

    if (Number.isFinite(maxLength)) {
        textarea.maxLength = maxLength;
    }


    const defaultValue =
        getDefaultValue(definition);

    if (
        defaultValue !== null &&
        defaultValue !== undefined
    ) {
        textarea.value =
            String(defaultValue);
    }


    return textarea;
}


/* =========================================================
   TEXT INPUT
========================================================= */

function createTextInput(definition, name) {
    const input =
        document.createElement("input");

    input.type = "text";
    input.id = createFieldId(name);
    input.name = name;
    input.className = "form-control";


    const maxLength =
        Number(definition?.maxLength);

    if (Number.isFinite(maxLength)) {
        input.maxLength = maxLength;
    }


    const defaultValue =
        getDefaultValue(definition);

    if (
        defaultValue !== null &&
        defaultValue !== undefined
    ) {
        input.value =
            String(defaultValue);
    }


    return input;
}


/* =========================================================
   OPTION CARDS
   ---------------------------------------------------------
   Radio secara logic.
   CSS dapat membuatnya terlihat seperti checkbox/card.
========================================================= */

function createOptionCards(
    definition,
    name,
    options
) {
    const wrapper =
        document.createElement("div");

    wrapper.className =
        "generate-option-cards";


    const defaultValue =
        getDefaultValue(definition);


    options.forEach(option => {
        const label =
            document.createElement("label");

        label.className =
            "generate-option-card";


        const radio =
            document.createElement("input");

        radio.type = "radio";
        radio.name = name;
        radio.value = String(option);


        if (
            String(option) ===
            String(defaultValue)
        ) {
            radio.checked = true;
            label.classList.add("active");
        }


        const text =
            document.createElement("span");

        text.className =
            "generate-option-card-text";

        text.textContent =
            String(option);


        label.appendChild(radio);
        label.appendChild(text);

        wrapper.appendChild(label);


        radio.addEventListener(
            "change",
            () => {
                wrapper
                    .querySelectorAll(
                        ".generate-option-card"
                    )
                    .forEach(card => {
                        const input =
                            card.querySelector(
                                'input[type="radio"]'
                            );

                        card.classList.toggle(
                            "active",
                            Boolean(
                                input?.checked
                            )
                        );
                    });
            }
        );
    });


    return wrapper;
}


/* =========================================================
   RANGE
========================================================= */

function createRangeInput(
    definition,
    name
) {
    const wrapper =
        document.createElement("div");

    wrapper.className =
        "generate-range-wrapper";


    const range =
        document.createElement("input");

    range.type = "range";
    range.id = createFieldId(name);
    range.name = name;
    range.className =
        "generate-range";


    const min =
        Number(definition?.min);

    const max =
        Number(definition?.max);

    const step =
        Number(definition?.step);

    const defaultValue =
        Number(definition?.default);


    if (Number.isFinite(min)) {
        range.min = String(min);
    }

    if (Number.isFinite(max)) {
        range.max = String(max);
    }

    if (
        Number.isFinite(step) &&
        step > 0
    ) {
        range.step = String(step);
    }


    if (Number.isFinite(defaultValue)) {
        range.value =
            String(defaultValue);
    } else if (Number.isFinite(min)) {
        range.value =
            String(min);
    }


    const valueDisplay =
        document.createElement("span");

    valueDisplay.className =
        "generate-range-value";


    function updateValue() {
        const value =
            range.value;

        valueDisplay.textContent =
            value
                ? `${value} detik`
                : "-";
    }


    updateValue();


    range.addEventListener(
        "input",
        updateValue
    );


    wrapper.appendChild(range);
    wrapper.appendChild(valueDisplay);


    return wrapper;
}


/* =========================================================
   SELECT
========================================================= */

function createSelectInput(
    definition,
    name
) {
    const select =
        document.createElement("select");

    select.id = createFieldId(name);
    select.name = name;
    select.className =
        "form-control";


    const options =
        Array.isArray(definition?.enum)
            ? definition.enum
            : [];


    const defaultValue =
        getDefaultValue(definition);


    options.forEach(option => {
        const item =
            document.createElement("option");

        item.value =
            String(option);

        item.textContent =
            String(option);

        item.selected =
            String(option) ===
            String(defaultValue);

        select.appendChild(item);
    });


    return select;
}


/* =========================================================
   CREATE FIELD INPUT
========================================================= */

function createFieldInput(
    definition,
    name
) {
    if (
        name === "image_urls" ||
        name === "image_url"
    ) {
        return createImageInput(
            definition,
            name
        );
    }


    if (name === "prompt") {
        return createTextarea(
            definition,
            name
        );
    }


    if (
        name === "aspect_ratio" ||
        name === "resolution"
    ) {
        const options =
            Array.isArray(definition?.enum)
                ? definition.enum
                : [];

        return createOptionCards(
            definition,
            name,
            options
        );
    }


    if (name === "duration") {
        return createRangeInput(
            definition,
            name
        );
    }


    if (
        Array.isArray(definition?.enum) &&
        definition.enum.length
    ) {
        return createSelectInput(
            definition,
            name
        );
    }


    return createTextInput(
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
    const labelMap = {
        image_urls: "Gambar Referensi",
        image_url: "Gambar Referensi",
        prompt: "Prompt",
        aspect_ratio: "Aspect Ratio",
        resolution: "Resolution",
        duration: "Duration"
    };


    const label =
        labelMap[name] ||
        name;


    const {
        field
    } = createFieldWrapper(
        name,
        label
    );


    const input =
        createFieldInput(
            definition,
            name
        );


    field.appendChild(input);

    return field;
}


/* =========================================================
   RENDER FORM
========================================================= */

export function renderGenerateForm() {
    const container =
        getContainer();

    if (!container) {
        return;
    }


    container.innerHTML = "";


    const definitions =
        getParameterDefinitions();


    const names =
        GENERATE_PARAMETER_ORDER.filter(
            name =>
                isRenderableParameter(
                    name,
                    definitions[name]
                )
        );


    names.forEach(name => {
        const field =
            renderParameter(
                name,
                definitions[name]
            );

        container.appendChild(field);
    });
}


/* =========================================================
   FIND FIELD
========================================================= */

function findField(name) {
    const container =
        getContainer();

    if (!container) {
        return null;
    }


    const fields =
        container.querySelectorAll(
            ".generate-field"
        );


    for (const field of fields) {
        if (
            field.dataset.parameter ===
            name
        ) {
            return field;
        }
    }


    return null;
}


/* =========================================================
   READ FIELD VALUE
========================================================= */

function readFieldValue(field) {
    if (!field) {
        return undefined;
    }


    const radio =
        field.querySelector(
            'input[type="radio"]:checked'
        );


    if (radio) {
        return radio.value;
    }


    const input =
        field.querySelector(
            "input, textarea, select"
        );


    if (!input) {
        return undefined;
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
   NORMALIZE IMAGE
========================================================= */

function normalizeImageValue(value) {
    return normalizeArray(value);
}


/* =========================================================
   GET FORM PARAMETERS
========================================================= */

export function getFormParameters() {
    const container =
        getContainer();

    if (!container) {
        return {};
    }


    const parameters = {};

    const definitions =
        getParameterDefinitions();


    const names =
        GENERATE_PARAMETER_ORDER.filter(
            name =>
                isRenderableParameter(
                    name,
                    definitions[name]
                )
        );


    names.forEach(name => {
        const field =
            findField(name);

        if (!field) {
            return;
        }


        let value;


        /* -------------------------------------------------
           IMAGE
        ------------------------------------------------- */

        if (
            name === "image_urls" ||
            name === "image_url"
        ) {
            const imageInput =
                field.querySelector(
                    ".generate-image-input"
                );


            if (imageInput) {
                const mode =
                    typeof imageInput.getInputMode ===
                        "function"
                        ? imageInput.getInputMode()
                        : "url";


                if (mode === "upload") {
                    value =
                        typeof imageInput.getUploadedUrl ===
                            "function"
                            ? imageInput.getUploadedUrl()
                            : "";
                } else {
                    const urlInput =
                        typeof imageInput.getUrlInput ===
                            "function"
                            ? imageInput.getUrlInput()
                            : field.querySelector(
                                'input[type="url"]'
                            );

                    value =
                        String(
                            urlInput?.value ||
                            ""
                        ).trim();
                }
            } else {
                value =
                    readFieldValue(field);
            }


            const images =
                normalizeImageValue(value);


            if (images.length) {
                parameters.image_urls =
                    images.slice(
                        0,
                        Math.max(
                            1,
                            Number(
                                definitions[name]
                                    ?.maxItems
                            ) || 1
                        )
                    );
            }


            return;
        }


        /* -------------------------------------------------
           OTHER PARAMETERS
        ------------------------------------------------- */

        value =
            readFieldValue(field);


        if (
            value === "" ||
            value === null ||
            value === undefined
        ) {
            return;
        }


        parameters[name] =
            value;
    });


    /* -----------------------------------------------------
       NEVER SEND TASK ID
    ----------------------------------------------------- */

    delete parameters.task_id;


    return parameters;
}


/* =========================================================
   GET FORM DATA
========================================================= */

export function getFormData() {
    return getFormParameters();
}


/* =========================================================
   SET FIELD VALUE
========================================================= */

export function setFieldValue(
    name,
    value
) {
    const field =
        findField(name);

    if (!field) {
        return false;
    }


    /* -----------------------------------------------------
       IMAGE
    ----------------------------------------------------- */

    if (
        name === "image_urls" ||
        name === "image_url"
    ) {
        const imageInput =
            field.querySelector(
                ".generate-image-input"
            );


        const urlInput =
            imageInput &&
            typeof imageInput.getUrlInput ===
                "function"
                ? imageInput.getUrlInput()
                : field.querySelector(
                    'input[type="url"]'
                );


        const images =
            normalizeImageValue(value);


        if (urlInput) {
            urlInput.value =
                images[0] || "";
        }


        if (images.length) {
            if (
                imageInput &&
                typeof imageInput.setMode ===
                    "function"
            ) {
                void imageInput.setMode("url");
            }
        }


        return true;
    }


    /* -----------------------------------------------------
       RADIO
    ----------------------------------------------------- */

    const radios =
        field.querySelectorAll(
            'input[type="radio"]'
        );


    if (radios.length) {
        let found = false;


        radios.forEach(radio => {
            const checked =
                String(radio.value) ===
                String(value);


            radio.checked =
                checked;


            const card =
                radio.closest(
                    ".generate-option-card"
                );


            if (card) {
                card.classList.toggle(
                    "active",
                    checked
                );
            }


            if (checked) {
                found = true;
            }
        });


        return found;
    }


    /* -----------------------------------------------------
       NORMAL INPUT
    ----------------------------------------------------- */

    const input =
        field.querySelector(
            "input, textarea, select"
        );


    if (!input) {
        return false;
    }


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


    input.dispatchEvent(
        new Event(
            "input",
            {
                bubbles: true
            }
        )
    );


    input.dispatchEvent(
        new Event(
            "change",
            {
                bubbles: true
            }
        )
    );


    return true;
}


/* =========================================================
   RESET DYNAMIC FIELDS
========================================================= */

export async function resetDynamicFields() {
    const container =
        getContainer();

    if (!container) {
        return;
    }


    const imageInputs =
        container.querySelectorAll(
            ".generate-image-input"
        );


    for (
        const imageInput of imageInputs
    ) {
        if (
            typeof imageInput.clearUploadedFile ===
            "function"
        ) {
            try {
                await imageInput.clearUploadedFile();
            } catch (error) {
                console.warn(
                    "[GEN-Z.AI][Generate Form] Reset upload gagal:",
                    error
                );
            }
        }
    }


    renderGenerateForm();
}


/* =========================================================
   DISABLE FORM
========================================================= */

export function setFormDisabled(
    disabled
) {
    const container =
        getContainer();

    if (!container) {
        return;
    }


    container
        .querySelectorAll(
            "input, textarea, select, button"
        )
        .forEach(control => {
            control.disabled =
                Boolean(disabled);
        });
}


/* =========================================================
   MEDIA PARAMETERS
========================================================= */

export function getMediaParameters() {
    const data =
        getFormParameters();


    return {
        image_urls:
            Array.isArray(data.image_urls)
                ? data.image_urls
                : []
    };
}


/* =========================================================
   PARAMETER DEFINITION
========================================================= */

export function getParameterDefinition(
    name
) {
    return parameterDefinition(name);
}


/* =========================================================
   INIT
========================================================= */

export function initGenerateForm() {
    renderGenerateForm();
}


/* =========================================================
   PUBLIC API
========================================================= */

export const generateForm =
    Object.freeze({
        render:
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


export default generateForm;
