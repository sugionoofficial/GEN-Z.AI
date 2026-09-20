/* =========================================================
   GEN-Z.AI
   GENERATE FORM MODULE
   ---------------------------------------------------------
   File:
   generate/assets/js/generate-form.js

   Tanggung jawab:
   - Render parameter form berdasarkan model.parameters
   - Input gambar: URL atau Upload
   - Preview gambar upload
   - Hapus gambar dengan tombol X
   - Checkbox-style ratio / resolution
   - Duration slider
   - Collect parameter form

   Source of truth:
   - models/*/parameters.js

   Catatan:
   - image_urls maksimal mengikuti definition.maxItems
   - Saat ini Grok Image to Video = maxItems 1
   - URL dan Upload adalah dua metode untuk SATU gambar
   - Tidak mengirim task_id
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

const INTERNAL_PARAMETERS =
    new Set([
        "task_id"
    ]);


/* =========================================================
   UI PARAMETER ORDER
========================================================= */

const GENERATE_PARAMETER_ORDER = [
    "image_urls",
    "image_url",
    "prompt",
    "aspect_ratio",
    "resolution",
    "duration"
];


/* =========================================================
   HELPERS
========================================================= */

function getContainer() {

    const elements =
        getGenerateElements();

    return elements?.dynamicFields || null;

}


function getParameterDefinitions() {

    const model =
        getCurrentModel();

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

    return parameters;

}


function parameterDefinition(
    name
) {

    const definitions =
        getParameterDefinitions();

    return definitions[name] || null;

}


function createFieldId(
    name
) {

    return (
        "generate-field-" +
        String(name)
            .replace(
                /[^a-zA-Z0-9_-]/g,
                "-"
            )
    );

}


function getDefaultValue(
    definition
) {

    if (
        !definition ||
        typeof definition !== "object"
    ) {
        return "";
    }

    return definition.default;

}


function isInternalParameter(
    name
) {

    return INTERNAL_PARAMETERS.has(
        name
    );

}


function isRenderableParameter(
    name,
    definition
) {

    if (
        isInternalParameter(
            name
        )
    ) {
        return false;
    }

    if (
        !definition ||
        typeof definition !== "object"
    ) {
        return false;
    }

    return (
        GENERATE_PARAMETER_ORDER.includes(
            name
        )
    );

}


/* =========================================================
   FIELD WRAPPER
========================================================= */

function createFieldWrapper(
    name,
    label
) {

    const field =
        document.createElement(
            "div"
        );

    field.className =
        "generate-field";

    field.dataset.parameter =
        name;

    const title =
        document.createElement(
            "label"
        );

    title.className =
        "generate-field-label";

    title.textContent =
        label;

    field.appendChild(
        title
    );

    return {
        field,
        title
    };

}


/* =========================================================
   IMAGE INPUT
   ---------------------------------------------------------
   SATU SLOT GAMBAR

   Pilihan:
   1. Gunakan URL
   2. Upload Gambar

   Hanya salah satu yang aktif.
========================================================= */

function createImageInput(
    definition,
    name
) {

    const wrapper =
        document.createElement(
            "div"
        );

    wrapper.className =
        "generate-image-input";


    /* -----------------------------------------------------
       MAX ITEMS
    ----------------------------------------------------- */

    const maxItemsNumber =
        Number(
            definition?.maxItems
        );

    const maxItems =
        Number.isFinite(
            maxItemsNumber
        )
            ? Math.max(
                1,
                maxItemsNumber
            )
            : 1;


    /* -----------------------------------------------------
       STATE
    ----------------------------------------------------- */

    let inputMode =
        "url";

    let uploadedPath =
        "";

    let uploadedUrl =
        "";


    /* -----------------------------------------------------
       MODE BUTTONS
    ----------------------------------------------------- */

    const modeGroup =
        document.createElement(
            "div"
        );

    modeGroup.className =
        "generate-image-mode";


    const urlModeButton =
        document.createElement(
            "button"
        );

    urlModeButton.type =
        "button";

    urlModeButton.className =
        "generate-image-mode-button active";

    urlModeButton.textContent =
        "Gunakan URL";


    const uploadModeButton =
        document.createElement(
            "button"
        );

    uploadModeButton.type =
        "button";

    uploadModeButton.className =
        "generate-image-mode-button";

    uploadModeButton.textContent =
        "Upload Gambar";


    modeGroup.appendChild(
        urlModeButton
    );

    modeGroup.appendChild(
        uploadModeButton
    );

    wrapper.appendChild(
        modeGroup
    );


    /* =====================================================
       URL PANEL
    ===================================================== */

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

    urlInput.inputMode =
        "url";

    urlInput.autocomplete =
        "off";

    urlInput.className =
        "form-control";

    urlInput.placeholder =
        "Tempel URL gambar...";


    const defaultValue =
        getDefaultValue(
            definition
        );


    if (
        Array.isArray(
            defaultValue
        ) &&
        defaultValue.length
    ) {

        urlInput.value =
            String(
                defaultValue[0] ||
                ""
            );

    } else if (
        defaultValue !== null &&
        defaultValue !== undefined &&
        defaultValue !== ""
    ) {

        urlInput.value =
            String(
                defaultValue
            );

    }


    urlPanel.appendChild(
        urlInput
    );


    /* =====================================================
       UPLOAD PANEL
    ===================================================== */

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
        "image/*";

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


    const uploadStatus =
        document.createElement(
            "div"
        );

    uploadStatus.className =
        "generate-image-upload-status";


    /* =====================================================
       PREVIEW
    ===================================================== */

    const preview =
        document.createElement(
            "div"
        );

    preview.className =
        "generate-image-preview";


    const previewImage =
        document.createElement(
            "img"
        );

    previewImage.className =
        "generate-image-preview-image";

    previewImage.alt =
        "Preview gambar referensi";

    previewImage.hidden =
        true;


    /* =====================================================
       REMOVE BUTTON
    ===================================================== */

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

    removeButton.setAttribute(
        "aria-label",
        "Hapus gambar"
    );

    removeButton.title =
        "Hapus gambar";

    removeButton.hidden =
        true;


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
        uploadStatus
    );

    uploadPanel.appendChild(
        preview
    );


    wrapper.appendChild(
        urlPanel
    );

    wrapper.appendChild(
        uploadPanel
    );


    /* =====================================================
       CLEAR PREVIEW
    ===================================================== */

    function clearPreviewOnly() {

        previewImage.removeAttribute(
            "src"
        );

        previewImage.hidden =
            true;

        removeButton.hidden =
            true;

        uploadedUrl =
            "";

    }


    /* =====================================================
       REMOVE STORAGE FILE
    ===================================================== */

    async function removeUploadedFile() {

        const path =
            uploadedPath;

        uploadedPath =
            "";

        uploadedUrl =
            "";

        clearPreviewOnly();


        if (!path) {
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
                    "dashboard-videos"
                )
                .remove([
                    path
                ]);

        } catch (
            error
        ) {

            console.warn(
                "[GEN-Z.AI][Generate Form] Gagal menghapus file Storage:",
                error
            );

        }

    }


    /* =====================================================
       SET INPUT MODE
    ===================================================== */

    function setMode(
        mode
    ) {

        inputMode =
            mode === "upload"
                ? "upload"
                : "url";


        const isUpload =
            inputMode ===
            "upload";


        urlPanel.hidden =
            isUpload;

        uploadPanel.hidden =
            !isUpload;


        urlModeButton.classList.toggle(
            "active",
            !isUpload
        );

        uploadModeButton.classList.toggle(
            "active",
            isUpload
        );


        if (
            isUpload
        ) {

            /*
             * Upload menjadi sumber tunggal.
             * URL dikosongkan agar tidak ikut terkirim.
             */

            urlInput.value =
                "";

        } else {

            /*
             * URL menjadi sumber tunggal.
             * Upload sebelumnya dibersihkan.
             */

            if (
                uploadedPath
            ) {

                removeUploadedFile();

            }

            clearPreviewOnly();

            uploadStatus.textContent =
                "";

        }

    }


    /* =====================================================
       UPLOAD REFERENCE IMAGE
    ===================================================== */

    async function uploadReferenceImage(
        file
    ) {

        if (!file) {
            return;
        }


        /* -------------------------------------------------
           TYPE
        ------------------------------------------------- */

        if (
            !String(
                file.type ||
                ""
            )
                .toLowerCase()
                .startsWith(
                    "image/"
                )
        ) {

            uploadStatus.textContent =
                "File harus berupa gambar.";

            return;

        }


        /* -------------------------------------------------
           MAX ITEMS
        ------------------------------------------------- */

        if (
            maxItems < 1
        ) {

            uploadStatus.textContent =
                "Model tidak mengizinkan gambar referensi.";

            return;

        }


        /* -------------------------------------------------
           SUPABASE
        ------------------------------------------------- */

        const client =
            getSupabaseClient();

        const user =
            getCurrentUser();


        if (
            !client ||
            !client.storage
        ) {

            uploadStatus.textContent =
                "Storage belum tersedia.";

            return;

        }


        if (
            !user?.id
        ) {

            uploadStatus.textContent =
                "Session user belum tersedia.";

            return;

        }


        /* -------------------------------------------------
           DELETE OLD UPLOAD
        ------------------------------------------------- */

        if (
            uploadedPath
        ) {

            await removeUploadedFile();

        }


        /* -------------------------------------------------
           FILE EXTENSION
        ------------------------------------------------- */

        const extension =
            String(
                file.name ||
                ""
            )
                .split(
                    "."
                )
                .pop()
                .toLowerCase()
                .replace(
                    /[^a-z0-9]/g,
                    ""
                ) ||
                "jpg";


        /* -------------------------------------------------
           RANDOM ID
        ------------------------------------------------- */

        const randomPart =
            globalThis.crypto &&
            typeof globalThis.crypto.randomUUID ===
                "function"

                ? globalThis.crypto.randomUUID()

                : (
                    String(
                        Date.now()
                    ) +
                    "-" +
                    Math.random()
                        .toString(
                            36
                        )
                        .slice(
                            2
                        )
                );


        /* -------------------------------------------------
           STORAGE PATH
        ------------------------------------------------- */

        const path =
            "generate-inputs/" +
            user.id +
            "/" +
            Date.now() +
            "-" +
            randomPart +
            "." +
            extension;


        chooseButton.disabled =
            true;

        uploadStatus.textContent =
            "Mengunggah gambar...";


        try {

            /* ---------------------------------------------
               UPLOAD
            --------------------------------------------- */

            const result =
                await client
                    .storage
                    .from(
                        "dashboard-videos"
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


            if (
                result.error
            ) {

                throw result.error;

            }


            /* ---------------------------------------------
               PUBLIC URL
            --------------------------------------------- */

            const publicResult =
                client
                    .storage
                    .from(
                        "dashboard-videos"
                    )
                    .getPublicUrl(
                        path
                    );


            const publicUrl =
                String(
                    publicResult
                        ?.data
                        ?.publicUrl ||
                    ""
                ).trim();


            if (
                !publicUrl
            ) {

                throw new Error(
                    "URL publik gambar tidak tersedia."
                );

            }


            /* ---------------------------------------------
               SAVE STATE
            --------------------------------------------- */

            uploadedPath =
                path;

            uploadedUrl =
                publicUrl;


            /* ---------------------------------------------
               PREVIEW
            --------------------------------------------- */

            previewImage.src =
                publicUrl;

            previewImage.hidden =
                false;

            removeButton.hidden =
                false;


            uploadStatus.textContent =
                "Gambar siap digunakan.";

        } catch (
            error
        ) {

            uploadedPath =
                "";

            uploadedUrl =
                "";

            clearPreviewOnly();


            uploadStatus.textContent =
                error?.message ||
                "Gagal mengunggah gambar.";


            console.error(
                "[GEN-Z.AI][Generate Form] Upload gambar gagal:",
                error
            );

        } finally {

            chooseButton.disabled =
                false;

        }

    }


    /* =====================================================
       EVENTS
    ===================================================== */

    urlModeButton.addEventListener(
        "click",
        () => {

            setMode(
                "url"
            );

        }
    );


    uploadModeButton.addEventListener(
        "click",
        () => {

            setMode(
                "upload"
            );

        }
    );


    chooseButton.addEventListener(
        "click",
        () => {

            fileInput.click();

        }
    );


    fileInput.addEventListener(
        "change",
        async () => {

            const file =
                fileInput.files?.[0] ||
                null;


            if (!file) {
                return;
            }


            await uploadReferenceImage(
                file
            );


            /*
             * Reset input supaya file yang sama
             * dapat dipilih kembali setelah dihapus.
             */

            fileInput.value =
                "";

        }
    );


    removeButton.addEventListener(
        "click",
        async () => {

            await removeUploadedFile();

            uploadStatus.textContent =
                "";

            fileInput.value =
                "";

        }
    );


    /* =====================================================
       PUBLIC HELPERS
    ===================================================== */

    wrapper.getInputMode =
        () => inputMode;


    wrapper.getUrlInput =
        () => urlInput;


    wrapper.getUploadedUrl =
        () => uploadedUrl;


    wrapper.getUploadedPath =
        () => uploadedPath;


    wrapper.clearUploadedFile =
        removeUploadedFile;


    wrapper.getReferenceFiles =
        () => {

            return uploadedUrl
                ? [
                    uploadedUrl
                ]
                : [];

        };


    return wrapper;

}


/* =========================================================
   TEXTAREA
========================================================= */

function createTextarea(
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

    textarea.rows =
        5;

    textarea.placeholder =
        "Tulis prompt...";


    const defaultValue =
        getDefaultValue(
            definition
        );


    if (
        defaultValue !==
            undefined &&
        defaultValue !==
            null
    ) {

        textarea.value =
            String(
                defaultValue
            );

    }


    if (
        Number.isFinite(
            Number(
                definition?.maxLength
            )
        )
    ) {

        textarea.maxLength =
            Number(
                definition.maxLength
            );

    }


    return textarea;

}


/* =========================================================
   TEXT INPUT
========================================================= */

function createTextInput(
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


    const defaultValue =
        getDefaultValue(
            definition
        );


    if (
        defaultValue !==
            undefined &&
        defaultValue !==
            null
    ) {

        input.value =
            String(
                defaultValue
            );

    }


    if (
        Number.isFinite(
            Number(
                definition?.maxLength
            )
        )
    ) {

        input.maxLength =
            Number(
                definition.maxLength
            );

    }


    return input;

}


/* =========================================================
   CHECKBOX STYLE SINGLE SELECT
========================================================= */

function createOptionCards(
    definition,
    name,
    options
) {

    const group =
        document.createElement(
            "div"
        );

    group.className =
        "generate-option-group";


    const defaultValue =
        getDefaultValue(
            definition
        );


    let selectedValue =
        defaultValue;


    if (
        selectedValue ===
            undefined ||
        selectedValue ===
            null
    ) {

        selectedValue =
            options?.[0];

    }


    options.forEach(
        (
            option,
            index
        ) => {

            const value =
                typeof option ===
                    "object"

                    ? option.value

                    : option;


            const label =
                typeof option ===
                    "object"

                    ? (
                        option.label ??
                        option.value
                    )

                    : option;


            const id =
                createFieldId(
                    name
                ) +
                "-" +
                index;


            const item =
                document.createElement(
                    "label"
                );

            item.className =
                "generate-option-card";


            const input =
                document.createElement(
                    "input"
                );

            input.type =
                "radio";

            input.name =
                name;

            input.value =
                String(
                    value
                );

            input.id =
                id;


            if (
                String(
                    value
                ) ===
                String(
                    selectedValue
                )
            ) {

                input.checked =
                    true;

                item.classList.add(
                    "active"
                );

            }


            const visual =
                document.createElement(
                    "span"
                );

            visual.className =
                "generate-option-check";


            const text =
                document.createElement(
                    "span"
                );

            text.className =
                "generate-option-text";

            text.textContent =
                String(
                    label
                );


            item.appendChild(
                input
            );

            item.appendChild(
                visual
            );

            item.appendChild(
                text
            );


            input.addEventListener(
                "change",
                () => {

                    group
                        .querySelectorAll(
                            ".generate-option-card"
                        )
                        .forEach(
                            element => {

                                element.classList.remove(
                                    "active"
                                );

                            }
                        );


                    if (
                        input.checked
                    ) {

                        item.classList.add(
                            "active"
                        );

                    }

                }
            );


            group.appendChild(
                item
            );

        }
    );


    return group;

}


/* =========================================================
   RANGE SLIDER
========================================================= */

function createRangeInput(
    definition,
    name
) {

    const wrapper =
        document.createElement(
            "div"
        );

    wrapper.className =
        "generate-range-wrapper";


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
        "generate-range";


    const min =
        Number(
            definition?.min
        );

    const max =
        Number(
            definition?.max
        );

    const step =
        Number(
            definition?.step
        );


    if (
        Number.isFinite(
            min
        )
    ) {

        range.min =
            String(
                min
            );

    }


    if (
        Number.isFinite(
            max
        )
    ) {

        range.max =
            String(
                max
            );

    }


    if (
        Number.isFinite(
            step
        ) &&
        step > 0
    ) {

        range.step =
            String(
                step
            );

    }


    const defaultValue =
        Number(
            getDefaultValue(
                definition
            )
        );


    if (
        Number.isFinite(
            defaultValue
        )
    ) {

        range.value =
            String(
                defaultValue
            );

    } else if (
        Number.isFinite(
            min
        )
    ) {

        range.value =
            String(
                min
            );

    }


    const valueDisplay =
        document.createElement(
            "span"
        );

    valueDisplay.className =
        "generate-range-value";


    function updateValue() {

        valueDisplay.textContent =
            range.value;

    }


    updateValue();


    range.addEventListener(
        "input",
        updateValue
    );


    wrapper.appendChild(
        range
    );

    wrapper.appendChild(
        valueDisplay
    );


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


    const options =
        Array.isArray(
            definition?.enum
        )
            ? definition.enum
            : [];


    const defaultValue =
        getDefaultValue(
            definition
        );


    options.forEach(
        option => {

            const item =
                document.createElement(
                    "option"
                );

            item.value =
                String(
                    option
                );

            item.textContent =
                String(
                    option
                );


            if (
                String(
                    option
                ) ===
                String(
                    defaultValue
                )
            ) {

                item.selected =
                    true;

            }


            select.appendChild(
                item
            );

        }
    );


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


    if (
        name === "prompt"
    ) {

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
            Array.isArray(
                definition?.enum
            )
                ? definition.enum
                : [];


        return createOptionCards(
            definition,
            name,
            options
        );

    }


    if (
        name === "duration"
    ) {

        return createRangeInput(
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

        image_urls:
            "Gambar Referensi",

        image_url:
            "Gambar Referensi",

        prompt:
            "Prompt",

        aspect_ratio:
            "Aspect Ratio",

        resolution:
            "Resolution",

        duration:
            "Duration"

    };


    const label =
        labelMap[name] ||
        name;


    const {
        field,
        title
    } =
        createFieldWrapper(
            name,
            label
        );


    const input =
        createFieldInput(
            definition,
            name
        );


    field.appendChild(
        input
    );


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


    container.innerHTML =
        "";


    const definitions =
        getParameterDefinitions();


    const names =
        GENERATE_PARAMETER_ORDER
            .filter(
                name =>
                    isRenderableParameter(
                        name,
                        definitions[name]
                    )
            );


    names.forEach(
        name => {

            const field =
                renderParameter(
                    name,
                    definitions[name]
                );


            container.appendChild(
                field
            );

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


    if (!container) {
        return null;
    }


    const field =
        Array.from(
            container.querySelectorAll(
                ".generate-field"
            )
        )
            .find(
                element =>
                    element.dataset.parameter ===
                    name
            );


    return field || null;

}


/* =========================================================
   READ FIELD VALUE
========================================================= */

function readFieldValue(
    field
) {

    if (!field) {
        return undefined;
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
   NORMALIZE IMAGE VALUE
========================================================= */

function normalizeImageValue(
    value
) {

    if (
        Array.isArray(
            value
        )
    ) {

        return value
            .map(
                item =>
                    String(
                        item || ""
                    ).trim()
            )
            .filter(
                Boolean
            );

    }


    const text =
        String(
            value || ""
        ).trim();


    return text
        ? [
            text
        ]
        : [];

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


    const parameters =
        {};


    const definitions =
        getParameterDefinitions();


    const names =
        GENERATE_PARAMETER_ORDER
            .filter(
                name =>
                    isRenderableParameter(
                        name,
                        definitions[name]
                    )
            );


    names.forEach(
        name => {

            const field =
                findField(
                    name
                );


            if (!field) {
                return;
            }


            let value;


            /*
             * Input gambar:
             *
             * URL:
             * image_urls = [url]
             *
             * Upload:
             * image_urls = [publicUrl]
             *
             * Hanya sumber aktif yang dikirim.
             */

            if (
                name === "image_urls" ||
                name === "image_url"
            ) {

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
                                    "input[type=\"url\"]"
                                );


                        value =
                            String(
                                urlInput?.value ||
                                ""
                            ).trim();

                    }

                } else {

                    value =
                        readFieldValue(
                            field
                        );

                }

            } else {

                value =
                    readFieldValue(
                        field
                    );

            }


            if (
                value === undefined
            ) {

                return;

            }


            /*
             * image_urls selalu array.
             */

            if (
                name ===
                    "image_urls" ||
                name ===
                    "image_url"
            ) {

                const images =
                    normalizeImageValue(
                        value
                    );


                if (
                    images.length
                ) {

                    parameters.image_urls =
                        images;

                }


                return;

            }


            /*
             * Jangan mengirim parameter kosong
             * kecuali memang bernilai false / 0.
             */

            if (
                value === "" ||
                value === null ||
                value === undefined
            ) {

                return;

            }


            parameters[name] =
                value;

        }
    );


    /*
     * task_id sengaja tidak pernah dikirim.
     */

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
        findField(
            name
        );


    if (!field) {
        return false;
    }


    /*
     * IMAGE
     */

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
                    "input[type=\"url\"]"
                );


        const images =
            normalizeImageValue(
                value
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

                const checked =
                    String(
                        radio.value
                    ) ===
                    String(
                        value
                    );


                radio.checked =
                    checked;


                const card =
                    radio.closest(
                        ".generate-option-card"
                    );


                if (
                    card
                ) {

                    card.classList.toggle(
                        "active",
                        checked
                    );

                }


                if (
                    checked
                ) {

                    found =
                        true;

                }

            }
        );


        return found;

    }


    /*
     * NORMAL INPUT
     */

    const input =
        field.querySelector(
            "input, textarea, select"
        );


    if (!input) {
        return false;
    }


    input.value =
        value ??
        "";


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


    /*
     * Hapus upload Storage yang masih aktif.
     */

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


    renderGenerateForm();

}


/* =========================================================
   SET FORM DISABLED
========================================================= */

export function setFormDisabled(
    disabled
) {

    const container =
        getContainer();


    if (!container) {
        return;
    }


    const controls =
        container.querySelectorAll(
            "input, textarea, select, button"
        );


    controls.forEach(
        control => {

            control.disabled =
                Boolean(
                    disabled
                );

        }
    );

}


/* =========================================================
   GET MEDIA PARAMETERS
========================================================= */

export function getMediaParameters() {

    const data =
        getFormParameters();


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
   GET PARAMETER DEFINITION
========================================================= */

export function getParameterDefinition(
    name
) {

    return parameterDefinition(
        name
    );

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
