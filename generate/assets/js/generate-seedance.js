/* =========================================================
   GEN-Z.AI
   SEEDANCE 2.5 GENERATE MODULE
   ---------------------------------------------------------
   Model:
   bytedance/seedance-2-5

   Khusus Seedance 2.5:
   - First Frame
   - Last Frame
   - Reference Images
   - Reference Videos
   - Reference Audio
   - Prompt
   - Resolution
   - Aspect Ratio
   - Duration
   - Output Format
   - Generate Audio
   - Return Last Frame
   - Web Search

   IMPORTANT:
   - nsfw_checker TIDAK dikirim dari browser.
   - Credit TIDAK dihitung di sini.
   - Credit mengikuti model config:
       credit_480p
       credit_720p
       credit_1080p
   - Grok tidak menggunakan module ini.
========================================================= */

"use strict";


import {
    getGenerateElements,
    getCurrentModel,
    getSupabaseClient
} from "./generate-state.js";

import mediaModule from "./generate-media.js";


/* =========================================================
   CONSTANTS
========================================================= */

const SEEDANCE_MODEL_ID =
    "bytedance/seedance-2-5";


const FIELD_IDS = {

    prompt:
        "seedancePrompt",

    firstFrame:
        "seedanceFirstFrame",

    lastFrame:
        "seedanceLastFrame",

    referenceImages:
        "seedanceReferenceImages",

    referenceVideos:
        "seedanceReferenceVideos",

    referenceAudio:
        "seedanceReferenceAudio",

    resolution:
        "seedanceResolution",

    aspectRatio:
        "seedanceAspectRatio",

    duration:
        "seedanceDuration",

    outputFormat:
        "seedanceOutputFormat",

    generateAudio:
        "seedanceGenerateAudio",

    returnLastFrame:
        "seedanceReturnLastFrame",

    webSearch:
        "seedanceWebSearch"

};


/* =========================================================
   LIMITS
========================================================= */

const MIN_DURATION =
    5;

const MAX_DURATION =
    30;


/*
 * KIE documentation:
 *
 * reference video total <= 30 sec
 * reference audio total <= 30 sec
 */
const MAX_REFERENCE_IMAGE_FILES =
    30;

const MAX_REFERENCE_VIDEO_FILES =
    10;

const MAX_REFERENCE_AUDIO_FILES =
    10;


const MAX_REFERENCE_VIDEO_DURATION =
    30;

const MAX_REFERENCE_AUDIO_DURATION =
    30;


/* =========================================================
   MODEL CHECK
========================================================= */

function getModelId(
    model
) {

    return String(

        model?.model_id ||

        model?.id ||

        model?.model?.model_id ||

        model?.model?.id ||

        ""

    ).trim();

}


function isSeedanceModel(
    model = getCurrentModel()
) {

    return (
        getModelId(model) ===
        SEEDANCE_MODEL_ID
    );

}


/* =========================================================
   ELEMENT HELPERS
========================================================= */

function getDynamicFields() {

    const elements =
        getGenerateElements?.();


    if (
        elements?.dynamicFields
    ) {

        return elements.dynamicFields;

    }


    const byId =
        document.getElementById(
            "dynamicFields"
        );


    if (
        byId
    ) {

        return byId;

    }


    throw new Error(
        "Container #dynamicFields tidak ditemukan."
    );

}


/* =========================================================
   HTML ESCAPE
========================================================= */

function escapeHtml(
    value
) {

    return String(
        value ?? ""
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}


/* =========================================================
   INPUT ID
========================================================= */

function fieldId(
    name
) {

    return FIELD_IDS[name] ||
        `seedance-${name}`;

}


/* =========================================================
   COMMON FIELD
========================================================= */

function createFieldWrapper(
    title,
    description = "",
    content = "",
    extraClass = ""
) {

    return `
        <section
            class="seedance-field ${extraClass}"
        >

            <div class="seedance-field-header">

                <div>

                    <div class="seedance-field-title">
                        ${escapeHtml(title)}
                    </div>

                    ${
                        description
                            ? `
                                <div class="seedance-field-description">
                                    ${escapeHtml(description)}
                                </div>
                              `
                            : ""
                    }

                </div>

            </div>

            ${content}

        </section>
    `;

}


/* =========================================================
   MEDIA SOURCE FIELD
========================================================= */

function createMediaSourceField(
    options = {}
) {

    const {

    name,

    title,

    description,

    type,

    multiple = false,

    required = false,

    maxFiles = null

} = options;


    const id =
        fieldId(name);


    const accept =
        mediaModule.getAcceptForType(
            type
        );


    const multipleAttr =
    multiple
        ? "multiple"
        : "";

const requiredAttr =
    required
        ? "required"
        : "";

const maxFilesAttr =
    Number.isInteger(maxFiles) &&
    maxFiles > 0
        ? `data-max-files="${maxFiles}"`
        : "";


    const modeName =
        `${id}-mode`;


    const urlInputId =
        `${id}-url`;


    const fileInputId =
        `${id}-file`;


    return createFieldWrapper(

        title,

        description,

        `

        <div class="seedance-media-source">

            <div class="seedance-source-tabs">

                <button
                    type="button"
                    class="seedance-source-tab is-active"
                    data-seedance-source="${id}"
                    data-mode="upload"
                >
                    Upload
                </button>

                <button
                    type="button"
                    class="seedance-source-tab"
                    data-seedance-source="${id}"
                    data-mode="url"
                >
                    URL
                </button>

            </div>


            <input
                type="hidden"
                id="${modeName}"
                value="upload"
            />


            <div
                class="seedance-source-panel"
                data-panel="${id}-upload"
            >

                <input
    type="file"
    id="${fileInputId}"
    class="seedance-file-input"
    accept="${escapeHtml(accept)}"
    ${multipleAttr}
    ${requiredAttr}
    ${maxFilesAttr}
/>

                <div
                    class="seedance-file-help"
                >
                    ${
    multiple
        ? (
            Number.isInteger(maxFiles) &&
            maxFiles > 0
                ? `Pilih hingga ${maxFiles} file.`
                : "Pilih satu atau beberapa file."
          )
        : "Pilih satu file."
}
                </div>

                <div
                    id="${id}-files"
                    class="seedance-selected-files"
                ></div>

            </div>


            <div
                class="seedance-source-panel"
                data-panel="${id}-url"
                hidden
            >

                <textarea
                    id="${urlInputId}"
                    class="seedance-url-input"
                    rows="${multiple ? 3 : 1}"
                    placeholder="${
                        multiple
                            ? "Satu URL per baris..."
                            : "https://..."
                    }"
                ></textarea>

                ${
                    multiple
                        ? `
                            <div class="seedance-file-help">
                                Satu URL per baris.
                            </div>
                          `
                        : ""
                }

            </div>


            <div
                id="${id}-preview"
                class="seedance-media-preview"
            ></div>

        </div>

        `

    );

}


/* =========================================================
   PROMPT
========================================================= */

function renderPrompt() {

    return createFieldWrapper(

        "Prompt",

        "Instruksi video untuk Seedance 2.5.",

        `
        <textarea
            id="${fieldId("prompt")}"
            class="seedance-prompt-input"
            rows="7"
            maxlength="30000"
            placeholder="Deskripsikan video yang ingin dibuat..."
        ></textarea>

        <div class="seedance-counter">
            <span id="seedancePromptCounter">
                0
            </span>
            / 30000
        </div>
        `

    );

}


/* =========================================================
   SELECT
========================================================= */

function renderSelect(
    name,
    title,
    description,
    options
) {

    const id =
        fieldId(name);


    const html =
        options
            .map(
                option => `
                    <option
                        value="${escapeHtml(option.value)}"
                        ${
                            option.selected
                                ? "selected"
                                : ""
                        }
                    >
                        ${escapeHtml(option.label)}
                    </option>
                `
            )
            .join("");


    return createFieldWrapper(

        title,

        description,

        `
        <select
            id="${id}"
            class="seedance-select"
        >
            ${html}
        </select>
        `

    );

}


/* =========================================================
   DURATION
========================================================= */

function renderDuration() {

    return createFieldWrapper(

        "Duration",

        "Durasi video dalam detik.",

        `
        <div class="seedance-duration-row">

            <input
                id="${fieldId("duration")}"
                type="range"
                min="${MIN_DURATION}"
                max="${MAX_DURATION}"
                step="1"
                value="5"
                class="seedance-duration-range"
            />

            <div
                id="seedanceDurationValue"
                class="seedance-duration-value"
            >
                5 detik
            </div>

        </div>

        <div class="seedance-duration-scale">

            <span>
                ${MIN_DURATION}s
            </span>

            <span>
                ${MAX_DURATION}s
            </span>

        </div>
        `

    );

}


/* =========================================================
   CHECKBOX
========================================================= */

function renderCheckbox(
    name,
    title,
    description,
    checked = false
) {

    const id =
        fieldId(name);


    return createFieldWrapper(

        title,

        description,

        `
        <label
            class="seedance-toggle"
        >

            <input
                id="${id}"
                type="checkbox"
                ${
                    checked
                        ? "checked"
                        : ""
                }
            />

            <span
                class="seedance-toggle-track"
            >

                <span
                    class="seedance-toggle-thumb"
                ></span>

            </span>

            <span
                class="seedance-toggle-label"
            >
                ${
                    checked
                        ? "Aktif"
                        : "Nonaktif"
                }
            </span>

        </label>
        `

    );

}


/* =========================================================
   RENDER STYLES
========================================================= */

function injectStyles() {

    const styleId =
        "seedance-generate-styles";


    if (
        document.getElementById(
            styleId
        )
    ) {

        return;

    }


    const style =
        document.createElement(
            "style"
        );


    style.id =
        styleId;


    style.textContent = `

        .seedance-field {
            margin-bottom: 22px;
            padding: 18px;
            border: 1px solid rgba(255, 45, 80, .20);
            border-radius: 16px;
            background:
                linear-gradient(
                    145deg,
                    rgba(255,255,255,.045),
                    rgba(0,0,0,.25)
                );
            box-shadow:
                0 0 22px rgba(255, 35, 70, .055);
        }

        .seedance-field-header {
            margin-bottom: 14px;
        }

        .seedance-field-title {
            color: #fff;
            font-size: 14px;
            font-weight: 800;
        }

        .seedance-field-description {
            margin-top: 5px;
            color: rgba(255,255,255,.48);
            font-size: 12px;
            line-height: 1.5;
        }

        .seedance-source-tabs {
            display: flex;
            gap: 8px;
            margin-bottom: 12px;
        }

        .seedance-source-tab {
            border: 1px solid rgba(255,255,255,.12);
            border-radius: 9px;
            padding: 8px 14px;
            background: rgba(255,255,255,.045);
            color: rgba(255,255,255,.62);
            cursor: pointer;
            font-size: 12px;
            font-weight: 700;
        }

        .seedance-source-tab.is-active {
            border-color: rgba(255,35,70,.65);
            background: rgba(255,35,70,.12);
            color: #fff;
        }

        .seedance-file-input,
        .seedance-url-input,
        .seedance-prompt-input,
        .seedance-select {
            box-sizing: border-box;
            width: 100%;
            border: 1px solid rgba(255,255,255,.11);
            border-radius: 11px;
            background: rgba(0,0,0,.32);
            color: #fff;
            outline: none;
        }

        .seedance-file-input {
            padding: 11px;
            font-size: 12px;
        }

        .seedance-url-input,
        .seedance-prompt-input {
            padding: 12px;
            resize: vertical;
            line-height: 1.5;
        }

        .seedance-select {
            min-height: 44px;
            padding: 0 12px;
        }

        .seedance-file-help {
            margin-top: 7px;
            color: rgba(255,255,255,.38);
            font-size: 11px;
        }

        .seedance-selected-files {
            display: grid;
            gap: 6px;
            margin-top: 10px;
        }

        .seedance-selected-file {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            padding: 9px 10px;
            border: 1px solid rgba(255,255,255,.07);
            border-radius: 9px;
            background: rgba(255,255,255,.025);
            color: rgba(255,255,255,.72);
            font-size: 11px;
        }

        .seedance-selected-file-name {
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .seedance-selected-file-size {
            flex: 0 0 auto;
            color: rgba(255,255,255,.35);
        }

        .seedance-media-preview {
            display: grid;
            gap: 10px;
            margin-top: 12px;
        }

        .seedance-media-preview img,
        .seedance-media-preview video {
            display: block;
            width: 100%;
            max-height: 360px;
            object-fit: contain;
            border-radius: 12px;
            background: #000;
        }

        .seedance-media-preview audio {
            width: 100%;
        }

        .seedance-prompt-input:focus,
        .seedance-url-input:focus,
        .seedance-select:focus,
        .seedance-file-input:focus {
            border-color: rgba(255,35,70,.65);
            box-shadow:
                0 0 0 3px rgba(255,35,70,.08);
        }

        .seedance-counter {
            margin-top: 6px;
            text-align: right;
            color: rgba(255,255,255,.34);
            font-size: 10px;
        }

        .seedance-duration-row {
            display: flex;
            align-items: center;
            gap: 15px;
        }

        .seedance-duration-range {
            flex: 1;
            accent-color: #ff2346;
        }

        .seedance-duration-value {
            min-width: 75px;
            text-align: right;
            color: #fff;
            font-size: 13px;
            font-weight: 800;
        }

        .seedance-duration-scale {
            display: flex;
            justify-content: space-between;
            margin-top: 7px;
            color: rgba(255,255,255,.3);
            font-size: 10px;
        }

        .seedance-toggle {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            cursor: pointer;
        }

        .seedance-toggle input {
            position: absolute;
            opacity: 0;
            pointer-events: none;
        }

        .seedance-toggle-track {
            position: relative;
            width: 44px;
            height: 24px;
            border-radius: 20px;
            background: rgba(255,255,255,.12);
            transition: .2s;
        }

        .seedance-toggle-thumb {
            position: absolute;
            top: 3px;
            left: 3px;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: rgba(255,255,255,.7);
            transition: .2s;
        }

        .seedance-toggle input:checked
        + .seedance-toggle-track {
            background: rgba(255,35,70,.72);
        }

        .seedance-toggle input:checked
        + .seedance-toggle-track
        .seedance-toggle-thumb {
            transform: translateX(20px);
            background: #fff;
        }

        .seedance-toggle-label {
            color: rgba(255,255,255,.72);
            font-size: 12px;
            font-weight: 700;
        }

        @media (max-width: 640px) {

            .seedance-field {
                padding: 15px;
                border-radius: 14px;
            }

            .seedance-duration-row {
                flex-direction: column;
                align-items: stretch;
            }

            .seedance-duration-value {
                text-align: left;
            }

        }

    `;


    document.head.appendChild(
        style
    );

}


/* =========================================================
   RENDER FORM
========================================================= */

function renderSeedanceForm(
    model = getCurrentModel()
) {

    if (
        !isSeedanceModel(model)
    ) {

        return false;

    }


    const container =
        getDynamicFields();


    injectStyles();


    container.innerHTML = `

        <div
            class="seedance-form"
            data-model="bytedance/seedance-2-5"
        >

            ${renderPrompt()}


            ${createMediaSourceField({

                name:
                    "firstFrame",

                title:
                    "Frame Awal",

                description:
                    "Opsional. Upload gambar atau masukkan URL gambar.",

                type:
                    "image"

            })}


            ${createMediaSourceField({

                name:
                    "lastFrame",

                title:
                    "Frame Akhir",

                description:
                    "Opsional. Menentukan frame akhir video.",

                type:
                    "image"

            })}


            ${createMediaSourceField({
    name:
        "referenceImages",
    title:
        "Reference Images",
    description:
        "Opsional. Maksimal 30 gambar referensi.",
    type:
        "image",
    multiple:
        true,
    maxFiles:
        MAX_REFERENCE_IMAGE_FILES
})}


            ${createMediaSourceField({
    name:
        "referenceVideos",
    title:
        "Reference Videos",
    description:
        "Opsional. Maksimal 10 video referensi. Total durasi maksimal 30 detik.",
    type:
        "video",
    multiple:
        true,
    maxFiles:
        MAX_REFERENCE_VIDEO_FILES
})}


            ${createMediaSourceField({
    name:
        "referenceAudio",
    title:
        "Reference Audio",
    description:
        "Opsional. Maksimal 10 audio referensi. Total durasi maksimal 30 detik.",
    type:
        "audio",
    multiple:
        true,
    maxFiles:
        MAX_REFERENCE_AUDIO_FILES
})}


            ${renderSelect(

                "resolution",

                "Resolution",

                "Resolusi output Seedance.",

                [
                    {
                        value:
                            "480p",

                        label:
                            "480p"
                    },

                    {
                        value:
                            "720p",

                        label:
                            "720p",

                        selected:
                            true
                    },

                    {
                        value:
                            "1080p",

                        label:
                            "1080p"
                    }
                ]

            )}


            ${renderSelect(

                "aspectRatio",

                "Aspect Ratio",

                "Rasio video output.",

                [
                    {
                        value:
                            "adaptive",

                        label:
                            "Adaptive",

                        selected:
                            true
                    },

                    {
                        value:
                            "16:9",

                        label:
                            "16:9"
                    },

                    {
                        value:
                            "9:16",

                        label:
                            "9:16"
                    },

                    {
                        value:
                            "4:3",

                        label:
                            "4:3"
                    },

                    {
                        value:
                            "3:4",

                        label:
                            "3:4"
                    },

                    {
                        value:
                            "1:1",

                        label:
                            "1:1"
                    },

                    {
                        value:
                            "21:9",

                        label:
                            "21:9"
                    }
                ]

            )}


            ${renderDuration()}


            ${renderSelect(

                "outputFormat",

                "Output Format",

                "Format file hasil.",

                [
                    {
                        value:
                            "mp4",

                        label:
                            "MP4",

                        selected:
                            true
                    },

                    {
                        value:
                            "mov",

                        label:
                            "MOV"
                    }
                ]

            )}


            ${renderCheckbox(

                "generateAudio",

                "Generate Audio",

                "Aktifkan audio hasil generate.",

                true

            )}


            ${renderCheckbox(

                "returnLastFrame",

                "Return Last Frame",

                "Kembalikan frame terakhir sebagai bagian dari hasil.",

                false

            )}


            ${renderCheckbox(

                "webSearch",

                "Web Search",

                "Izinkan Seedance menggunakan pencarian web.",

                false

            )}

        </div>

    `;


    bindSeedanceEvents();


    return true;

}


/* =========================================================
   SOURCE TAB
========================================================= */

function bindSourceTabs() {

    const buttons =
        document.querySelectorAll(
            "[data-seedance-source]"
        );


    buttons.forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    const sourceId =
                        button.dataset
                            .seedanceSource;

                    const mode =
                        button.dataset
                            .mode;


                    const hidden =
                        document.getElementById(
                            `${sourceId}-mode`
                        );


                    if (
                        hidden
                    ) {

                        hidden.value =
                            mode;

                    }


                    const wrapper =
                        button.closest(
                            ".seedance-media-source"
                        );


                    if (
                        !wrapper
                    ) {

                        return;

                    }


                    wrapper
                        .querySelectorAll(
                            ".seedance-source-tab"
                        )
                        .forEach(
                            tab => {

                                tab.classList.toggle(
                                    "is-active",
                                    tab === button
                                );

                            }
                        );


                    wrapper
                        .querySelectorAll(
                            ".seedance-source-panel"
                        )
                        .forEach(
                            panel => {

                                panel.hidden =
                                    !panel.dataset
                                        .panel
                                        .endsWith(
                                            mode
                                        );

                            }
                        );

                }
            );

        }
    );

}


/* =========================================================
   DISPLAY SELECTED FILES
========================================================= */

function displaySelectedFiles(
    input
) {

    const container =
        document.getElementById(
            `${input.id
                .replace(
                    /-file$/,
                    ""
                )}-files`
        );


    if (
        !container
    ) {

        return;

    }


    container.innerHTML =
        "";


    const files =
        Array.from(
            input.files || []
        );


    files.forEach(
        file => {

            const row =
                document.createElement(
                    "div"
                );


            row.className =
                "seedance-selected-file";


            const name =
                document.createElement(
                    "span"
                );


            name.className =
                "seedance-selected-file-name";


            name.textContent =
                file.name;


            const size =
                document.createElement(
                    "span"
                );


            size.className =
                "seedance-selected-file-size";


            size.textContent =
                mediaModule.formatFileSize(
                    file.size
                );


            row.append(
                name,
                size
            );


            container.appendChild(
                row
            );

        }
    );

}


/* =========================================================
   FILE PREVIEW
========================================================= */

function renderFilePreview(
    input,
    expectedType
) {

    const baseId =
        input.id.replace(
            /-file$/,
            ""
        );


    const preview =
        document.getElementById(
            `${baseId}-preview`
        );


    if (
        !preview
    ) {

        return;

    }


    preview.innerHTML =
        "";


    const files =
        Array.from(
            input.files || []
        );


    files.forEach(
        file => {

            try {

                const element =
                    mediaModule.createPreviewElement(
                        file,
                        {
                            className:
                                "seedance-preview-media"
                        }
                    );


                if (
                    element
                ) {

                    preview.appendChild(
                        element
                    );

                }

            } catch (
                error
            ) {

                console.warn(
                    "[Seedance] Preview gagal:",
                    error
                );

            }

        }
    );

}


/* =========================================================
   URL PREVIEW
========================================================= */

function renderUrlPreview(
    input,
    type
) {

    const baseId =
        input.id.replace(
            /-url$/,
            ""
        );


    const preview =
        document.getElementById(
            `${baseId}-preview`
        );


    if (
        !preview
    ) {

        return;

    }


    preview.innerHTML =
        "";


    const urls =
        mediaModule.normalizeUrlList(
            input.value
        );


    urls.forEach(
        url => {

            try {

                const element =
                    mediaModule
                        .createUrlPreviewElement(
                            url,
                            type,
                            {
                                className:
                                    "seedance-preview-media"
                            }
                        );


                if (
                    element
                ) {

                    preview.appendChild(
                        element
                    );

                }

            } catch {
                /* Invalid URL handled during collection. */
            }

        }
    );

}


/* =========================================================
   BIND FILE INPUT
========================================================= */

function bindFileInputs() {

    const inputs =
        document.querySelectorAll(
            ".seedance-file-input"
        );


    inputs.forEach(
        input => {

            input.addEventListener(
                "change",
                () => {

                    displaySelectedFiles(
                        input
                    );


                    const expectedType =
                        getExpectedTypeFromInput(
                            input
                        );


                    renderFilePreview(
                        input,
                        expectedType
                    );

                }
            );

        }
    );

}


/* =========================================================
   EXPECTED TYPE
========================================================= */

function getExpectedTypeFromInput(
    input
) {

    const accept =
        String(
            input?.accept || ""
        );


    if (
        accept.includes(
            "image/"
        )
    ) {

        return "image";

    }


    if (
        accept.includes(
            "video/"
        )
    ) {

        return "video";

    }


    if (
        accept.includes(
            "audio/"
        )
    ) {

        return "audio";

    }


    return null;

}


/* =========================================================
   BIND URL INPUT
========================================================= */

function bindUrlInputs() {

    const inputs =
        document.querySelectorAll(
            ".seedance-url-input"
        );


    inputs.forEach(
        input => {

            input.addEventListener(
                "input",
                () => {

                    const type =
                        getExpectedTypeFromUrlInput(
                            input
                        );


                    renderUrlPreview(
                        input,
                        type
                    );

                }
            );

        }
    );

}


function getExpectedTypeFromUrlInput(
    input
) {

    const wrapper =
        input.closest(
            ".seedance-media-source"
        );


    if (
        !wrapper
    ) {

        return null;

    }


    const fileInput =
        wrapper.querySelector(
            ".seedance-file-input"
        );


    return getExpectedTypeFromInput(
        fileInput
    );

}


/* =========================================================
   PROMPT COUNTER
========================================================= */

function bindPromptCounter() {

    const input =
        document.getElementById(
            fieldId("prompt")
        );


    const counter =
        document.getElementById(
            "seedancePromptCounter"
        );


    if (
        !input ||
        !counter
    ) {

        return;

    }


    const update =
        () => {

            counter.textContent =
                String(
                    input.value.length
                );

        };


    input.addEventListener(
        "input",
        update
    );


    update();

}


/* =========================================================
   DURATION
========================================================= */

function bindDuration() {

    const input =
        document.getElementById(
            fieldId("duration")
        );


    const output =
        document.getElementById(
            "seedanceDurationValue"
        );


    if (
        !input ||
        !output
    ) {

        return;

    }


    const update =
        () => {

            output.textContent =
                `${input.value} detik`;

        };


    input.addEventListener(
        "input",
        update
    );


    update();

}


/* =========================================================
   TOGGLE LABEL
========================================================= */

function bindToggleLabels() {

    const names = [
        "generateAudio",
        "returnLastFrame",
        "webSearch"
    ];


    names.forEach(
        name => {

            const input =
                document.getElementById(
                    fieldId(name)
                );


            if (
                !input
            ) {

                return;

            }


            const label =
                input
                    .closest(
                        ".seedance-toggle"
                    )
                    ?.querySelector(
                        ".seedance-toggle-label"
                    );


            if (
                !label
            ) {

                return;

            }


            const update =
                () => {

                    label.textContent =
                        input.checked
                            ? "Aktif"
                            : "Nonaktif";

                };


            input.addEventListener(
                "change",
                update
            );


            update();

        }
    );

}


/* =========================================================
   BIND EVENTS
========================================================= */

function bindSeedanceEvents() {

    bindSourceTabs();

    bindFileInputs();

    bindUrlInputs();

    bindPromptCounter();

    bindDuration();

    bindToggleLabels();

}


/* =========================================================
   READ MEDIA SOURCE
========================================================= */

async function collectMediaSource(
    name,
    type,
    multiple = false
) {

    const id =
        fieldId(name);


    const modeElement =
        document.getElementById(
            `${id}-mode`
        );


    const mode =
        String(
            modeElement?.value ||
            "upload"
        );


    /*
     * Upload mode.
     */
    if (
        mode === "upload"
    ) {

        const input =
            document.getElementById(
                `${id}-file`
            );


        const files =
            Array.from(
                input?.files || []
            );


        if (
            files.length === 0
        ) {

            return multiple
                ? []
                : "";

        }


        if (
            multiple
        ) {

            await mediaModule
                .validateTotalSize(
                    files,
                    type
                );


            if (
                type === "video" ||
                type === "audio"
            ) {

                await mediaModule
                    .validateTotalDuration(
                        files,
                        type
                    );

            }


            const uploaded =
                await mediaModule
                    .uploadFiles(
                        files,
                        {
                            expectedType:
                                type
                        }
                    );


            return uploaded.map(
                item => item.url
            );

        }


        const uploaded =
            await mediaModule
                .uploadFile(
                    files[0],
                    {
                        expectedType:
                            type
                    }
                );


        return uploaded.url;

    }


    /*
     * URL mode.
     */
    const urlInput =
        document.getElementById(
            `${id}-url`
        );


    if (
        multiple
    ) {

        return mediaModule
            .normalizeUrlList(
                urlInput?.value || ""
            );

    }


    return mediaModule.normalizeUrl(
        urlInput?.value || ""
    );

}


/* =========================================================
   COLLECT PARAMETERS
========================================================= */

async function getSeedanceParameters() {

    if (
        !isSeedanceModel()
    ) {

        throw new Error(
            "Model aktif bukan Seedance 2.5."
        );

    }


    const prompt =
        String(
            document.getElementById(
                fieldId("prompt")
            )?.value ||
            ""
        ).trim();


    const resolution =
        String(
            document.getElementById(
                fieldId("resolution")
            )?.value ||
            "720p"
        ).trim();


    const aspectRatio =
        String(
            document.getElementById(
                fieldId("aspectRatio")
            )?.value ||
            "adaptive"
        ).trim();


    const duration =
        Number(
            document.getElementById(
                fieldId("duration")
            )?.value ||
            5
        );


    const outputFormat =
        String(
            document.getElementById(
                fieldId("outputFormat")
            )?.value ||
            "mp4"
        ).trim();


    const generateAudio =
        Boolean(
            document.getElementById(
                fieldId("generateAudio")
            )?.checked
        );


    const returnLastFrame =
        Boolean(
            document.getElementById(
                fieldId("returnLastFrame")
            )?.checked
        );


    const webSearch =
        Boolean(
            document.getElementById(
                fieldId("webSearch")
            )?.checked
        );


    const firstFrameUrl =
        await collectMediaSource(
            "firstFrame",
            "image",
            false
        );


    const lastFrameUrl =
        await collectMediaSource(
            "lastFrame",
            "image",
            false
        );


    const referenceImageUrls =
        await collectMediaSource(
            "referenceImages",
            "image",
            true
        );


    const referenceVideoUrls =
        await collectMediaSource(
            "referenceVideos",
            "video",
            true
        );


    const referenceAudioUrls =
        await collectMediaSource(
            "referenceAudio",
            "audio",
            true
        );


    const parameters = {};


    /*
     * Prompt optional according to KIE docs.
     * Jangan kirim string kosong.
     */
    if (
        prompt
    ) {

        parameters.prompt =
            prompt;

    }


    if (
        firstFrameUrl
    ) {

        parameters.first_frame_url =
            firstFrameUrl;

    }


    if (
        lastFrameUrl
    ) {

        parameters.last_frame_url =
            lastFrameUrl;

    }


    if (
        Array.isArray(
            referenceImageUrls
        ) &&
        referenceImageUrls.length
    ) {

        parameters.reference_image_urls =
            referenceImageUrls;

    }


    if (
        Array.isArray(
            referenceVideoUrls
        ) &&
        referenceVideoUrls.length
    ) {

        parameters.reference_video_urls =
            referenceVideoUrls;

    }


    if (
        Array.isArray(
            referenceAudioUrls
        ) &&
        referenceAudioUrls.length
    ) {

        parameters.reference_audio_urls =
            referenceAudioUrls;

    }


    parameters.resolution =
        resolution;


    parameters.aspect_ratio =
        aspectRatio;


    parameters.duration =
        duration;


    parameters.output_format =
        outputFormat;


    parameters.generate_audio =
        generateAudio;


    parameters.return_last_frame =
        returnLastFrame;


    parameters.web_search =
        webSearch;


    /*
     * NSFW CHECKER SENGAJA TIDAK ADA.
     *
     * Server tetap menjadi pemilik
     * kontrol tersebut.
     */


    return parameters;

}


/* =========================================================
   VALIDATE PARAMETERS
========================================================= */

function validateSeedanceParameters(
    parameters
) {

    if (
        !parameters ||
        typeof parameters !== "object"
    ) {

        throw new Error(
            "Parameter Seedance kosong."
        );

    }


    if (
        parameters.prompt &&
        String(
            parameters.prompt
        ).length > 30000
    ) {

        throw new Error(
            "Prompt maksimal 30000 karakter."
        );

    }


    const allowedResolution =
        new Set([
            "480p",
            "720p",
            "1080p"
        ]);


    if (
        !allowedResolution.has(
            parameters.resolution
        )
    ) {

        throw new Error(
            "Resolution Seedance tidak valid."
        );

    }


    const allowedAspectRatio =
        new Set([
            "16:9",
            "4:3",
            "1:1",
            "3:4",
            "9:16",
            "21:9",
            "adaptive"
        ]);


    if (
        !allowedAspectRatio.has(
            parameters.aspect_ratio
        )
    ) {

        throw new Error(
            "Aspect ratio Seedance tidak valid."
        );

    }


    const duration =
        Number(
            parameters.duration
        );


    if (
        !Number.isFinite(
            duration
        ) ||
        duration < MIN_DURATION ||
        duration > MAX_DURATION
    ) {

        throw new Error(
            `Duration harus antara ${MIN_DURATION} dan ${MAX_DURATION} detik.`
        );

    }


    if (
        parameters.output_format !==
            "mp4" &&
        parameters.output_format !==
            "mov"
    ) {

        throw new Error(
            "Output format harus MP4 atau MOV."
        );

    }


    if (
        parameters.reference_video_urls &&
        !Array.isArray(
            parameters.reference_video_urls
        )
    ) {

        throw new Error(
            "Reference video harus berupa array URL."
        );

    }


    if (
        parameters.reference_audio_urls &&
        !Array.isArray(
            parameters.reference_audio_urls
        )
    ) {

        throw new Error(
            "Reference audio harus berupa array URL."
        );

    }


    if (
        parameters.reference_image_urls &&
        !Array.isArray(
            parameters.reference_image_urls
        )
    ) {

        throw new Error(
            "Reference image harus berupa array URL."
        );

    }


    return true;

}


/* =========================================================
   SET DEFAULTS
========================================================= */

function resetSeedanceForm() {

    const container =
        getDynamicFields?.();


    if (
        !container
    ) {

        return;

    }


    if (
        !container.querySelector(
            ".seedance-form"
        )
    ) {

        return;

    }


    const prompt =
        document.getElementById(
            fieldId("prompt")
        );


    if (
        prompt
    ) {

        prompt.value =
            "";

    }


    const duration =
        document.getElementById(
            fieldId("duration")
        );


    if (
        duration
    ) {

        duration.value =
            "5";

    }


    const resolution =
        document.getElementById(
            fieldId("resolution")
        );


    if (
        resolution
    ) {

        resolution.value =
            "720p";

    }


    const aspectRatio =
        document.getElementById(
            fieldId("aspectRatio")
        );


    if (
        aspectRatio
    ) {

        aspectRatio.value =
            "adaptive";

    }


    const outputFormat =
        document.getElementById(
            fieldId("outputFormat")
        );


    if (
        outputFormat
    ) {

        outputFormat.value =
            "mp4";

    }


    [
        "generateAudio",
        "returnLastFrame",
        "webSearch"
    ].forEach(
        name => {

            const input =
                document.getElementById(
                    fieldId(name)
                );


            if (
                input
            ) {

                input.checked =
                    name ===
                    "generateAudio";

            }

        }
    );


    document
        .querySelectorAll(
            ".seedance-file-input"
        )
        .forEach(
            input => {

                input.value =
                    "";

            }
        );


    document
        .querySelectorAll(
            ".seedance-url-input"
        )
        .forEach(
            input => {

                input.value =
                    "";

            }
        );


    bindPromptCounter();

    bindDuration();

    bindToggleLabels();

}


/* =========================================================
   API OBJECT
========================================================= */

const seedanceModule = {

    SEEDANCE_MODEL_ID,

    isSeedanceModel,

    renderSeedanceForm,

    getSeedanceParameters,

    validateSeedanceParameters,

    resetSeedanceForm

};


export default Object.freeze(
    seedanceModule
);


export {

    SEEDANCE_MODEL_ID,

    isSeedanceModel,

    renderSeedanceForm,

    getSeedanceParameters,

    validateSeedanceParameters,

    resetSeedanceForm

};
