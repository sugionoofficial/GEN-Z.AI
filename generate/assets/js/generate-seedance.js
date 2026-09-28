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

function renderSeedanceStyles() {

    if (
        document.getElementById(
            "seedance-generate-styles"
        )
    ) {
        return;
    }

    const style =
        document.createElement("style");

    style.id =
        "seedance-generate-styles";

    style.textContent = `
        .seedance-form {
            display: grid;
            gap: 16px;
        }

        .seedance-field {
            display: grid;
            gap: 8px;
        }

        .seedance-field-label {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            color: rgba(255,255,255,.88);
            font-size: 13px;
            font-weight: 600;
        }

        .seedance-field-description {
            color: rgba(255,255,255,.42);
            font-size: 11px;
            line-height: 1.5;
        }

        .seedance-input,
        .seedance-textarea,
        .seedance-select {
            width: 100%;
            box-sizing: border-box;
            border: 1px solid rgba(255,255,255,.08);
            border-radius: 10px;
            background: rgba(255,255,255,.035);
            color: rgba(255,255,255,.88);
            outline: none;
            transition:
                border-color .18s ease,
                background .18s ease,
                box-shadow .18s ease;
        }

        .seedance-input,
        .seedance-select {
            min-height: 42px;
            padding: 0 12px;
        }

        .seedance-textarea {
            min-height: 120px;
            padding: 11px 12px;
            resize: vertical;
        }

        .seedance-input:focus,
        .seedance-textarea:focus,
        .seedance-select:focus {
            border-color: rgba(255,255,255,.2);
            background: rgba(255,255,255,.05);
            box-shadow:
                0 0 0 2px
                rgba(255,255,255,.025);
        }

        .seedance-file-input {
            width: 100%;
            box-sizing: border-box;
            padding: 10px;
            border: 1px dashed rgba(255,255,255,.12);
            border-radius: 10px;
            background: rgba(255,255,255,.025);
            color: rgba(255,255,255,.58);
            cursor: pointer;
        }

        .seedance-file-input:hover {
            border-color: rgba(255,255,255,.2);
            background: rgba(255,255,255,.04);
        }

        .seedance-source-tabs {
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
        }

        .seedance-source-tab {
            border: 1px solid rgba(255,255,255,.08);
            border-radius: 8px;
            background: rgba(255,255,255,.025);
            color: rgba(255,255,255,.5);
            padding: 7px 11px;
            font-size: 11px;
            cursor: pointer;
            transition:
                border-color .18s ease,
                background .18s ease,
                color .18s ease;
        }

        .seedance-source-tab:hover {
            color: rgba(255,255,255,.8);
            background: rgba(255,255,255,.045);
        }

        .seedance-source-tab.active {
            color: rgba(255,255,255,.95);
            border-color: rgba(255,255,255,.18);
            background: rgba(255,255,255,.07);
        }

        .seedance-source-panel {
            display: grid;
            gap: 10px;
        }

        .seedance-source-panel[hidden] {
            display: none;
        }

        .seedance-selected-files {
            display: grid;
            gap: 6px;
            margin-top: 10px;
            max-height: 420px;
            overflow-y: auto;
            overflow-x: hidden;
            padding-right: 2px;
        }

        .seedance-selected-files::-webkit-scrollbar {
            width: 5px;
        }

        .seedance-selected-files::-webkit-scrollbar-track {
            background: transparent;
        }

        .seedance-selected-files::-webkit-scrollbar-thumb {
            background: rgba(255,255,255,.12);
            border-radius: 999px;
        }

        .seedance-selected-files-summary {
            position: sticky;
            top: 0;
            z-index: 2;
            padding: 7px 9px;
            border: 1px solid rgba(255,255,255,.07);
            border-radius: 8px;
            background: rgba(18,18,18,.96);
            color: rgba(255,255,255,.5);
            font-size: 10px;
        }

        .seedance-selected-file {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            min-width: 0;
            box-sizing: border-box;
            padding: 9px 10px;
            border: 1px solid rgba(255,255,255,.07);
            border-radius: 9px;
            background: rgba(255,255,255,.025);
            color: rgba(255,255,255,.72);
            font-size: 11px;
        }

        .seedance-selected-file-name {
            min-width: 0;
            flex: 1 1 auto;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .seedance-selected-file-size {
            flex: 0 0 auto;
            color: rgba(255,255,255,.35);
            white-space: nowrap;
        }

        .seedance-file-error {
            display: none;
            padding: 8px 10px;
            border: 1px solid rgba(255,70,70,.22);
            border-radius: 8px;
            background: rgba(255,50,50,.05);
            color: rgba(255,120,120,.9);
            font-size: 10px;
            line-height: 1.45;
        }

        .seedance-file-error.active {
            display: block;
        }

        .seedance-media-preview {
            display: grid;
            grid-template-columns:
                repeat(
                    auto-fill,
                    minmax(120px, 1fr)
                );
            gap: 10px;
            margin-top: 12px;
        }

        .seedance-media-preview > * {
            min-width: 0;
            max-width: 100%;
        }

        .seedance-preview-media {
            display: block;
            width: 100%;
            max-width: 100%;
            max-height: 220px;
            object-fit: contain;
            border-radius: 9px;
            overflow: hidden;
        }

        .seedance-media-url {
            min-height: 90px;
        }

        .seedance-prompt-counter {
            text-align: right;
            color: rgba(255,255,255,.32);
            font-size: 10px;
        }

        .seedance-duration-row {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .seedance-duration-value {
            min-width: 42px;
            text-align: center;
            color: rgba(255,255,255,.65);
            font-size: 12px;
        }

        .seedance-range {
            width: 100%;
        }

        .seedance-toggle-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            min-height: 42px;
            padding: 10px 12px;
            box-sizing: border-box;
            border: 1px solid rgba(255,255,255,.07);
            border-radius: 10px;
            background: rgba(255,255,255,.025);
        }

        .seedance-toggle-label {
            color: rgba(255,255,255,.7);
            font-size: 12px;
        }

        .seedance-toggle {
            position: relative;
            width: 42px;
            height: 22px;
            flex: 0 0 auto;
        }

        .seedance-toggle input {
            position: absolute;
            opacity: 0;
            pointer-events: none;
        }

        .seedance-toggle-track {
            position: absolute;
            inset: 0;
            border-radius: 999px;
            background: rgba(255,255,255,.1);
            cursor: pointer;
            transition:
                background .18s ease;
        }

        .seedance-toggle-track::after {
            content: "";
            position: absolute;
            top: 3px;
            left: 3px;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: rgba(255,255,255,.7);
            transition:
                transform .18s ease;
        }

        .seedance-toggle input:checked
        + .seedance-toggle-track {
            background: rgba(255,255,255,.24);
        }

        .seedance-toggle input:checked
        + .seedance-toggle-track::after {
            transform: translateX(20px);
            background: #fff;
        }

        .seedance-hidden {
            display: none !important;
        }

        @media (max-width: 700px) {

            .seedance-media-preview {
                grid-template-columns:
                    repeat(
                        auto-fill,
                        minmax(100px, 1fr)
                    );
            }

            .seedance-selected-file {
                gap: 7px;
                padding: 8px;
            }

            .seedance-selected-file-name {
                font-size: 10px;
            }

            .seedance-selected-file-size {
                font-size: 9px;
            }
        }
    `;

    document.head.appendChild(style);
}


/* =========================================================
   SOURCE TAB HANDLING
========================================================= */

function bindSourceTabs() {

    const tabs =
        document.querySelectorAll(
            ".seedance-source-tab"
        );

    tabs.forEach(
        tab => {

            tab.addEventListener(
                "click",
                () => {

                    const target =
                        tab.dataset.target;

                    if (!target) {
                        return;
                    }

                    const wrapper =
                        tab.closest(
                            ".seedance-media-source"
                        );

                    if (!wrapper) {
                        return;
                    }

                    const allTabs =
                        wrapper.querySelectorAll(
                            ".seedance-source-tab"
                        );

                    allTabs.forEach(
                        item => {
                            item.classList.toggle(
                                "active",
                                item === tab
                            );
                        }
                    );

                    const modeInput =
                        wrapper.querySelector(
                            ".seedance-source-mode"
                        );

                    if (modeInput) {
                        modeInput.value =
                            target;
                    }

                    const panels =
                        wrapper.querySelectorAll(
                            ".seedance-source-panel"
                        );

                    panels.forEach(
                        panel => {

                            const panelMode =
                                panel.dataset.mode;

                            panel.hidden =
                                panelMode !==
                                target;
                        }
                    );
                }
            );
        }
    );
}


/* =========================================================
   FILE DISPLAY
========================================================= */

function getFileInputBaseId(input) {

    return String(
        input?.id || ""
    ).replace(
        /-file$/,
        ""
    );
}


function getFileInputMaxFiles(input) {

    const value =
        Number(
            input?.dataset?.maxFiles || ""
        );

    if (
        Number.isInteger(value) &&
        value > 0
    ) {
        return value;
    }

    return null;
}


function getFileInputLabel(input) {

    const wrapper =
        input?.closest(
            ".seedance-media-source"
        );

    const label =
        wrapper?.querySelector(
            ".seedance-field-label"
        );

    const text =
        String(
            label?.textContent || ""
        ).trim();

    return text || "File";
}


function getFileErrorElement(input) {

    const baseId =
        getFileInputBaseId(input);

    if (!baseId) {
        return null;
    }

    const existing =
        document.getElementById(
            `${baseId}-file-error`
        );

    if (existing) {
        return existing;
    }

    const error =
        document.createElement("div");

    error.id =
        `${baseId}-file-error`;

    error.className =
        "seedance-file-error";

    const parent =
        input.parentElement;

    if (parent) {
        parent.appendChild(error);
    }

    return error;
}


function showFileInputError(
    input,
    message
) {

    const error =
        getFileErrorElement(input);

    if (!error) {
        return;
    }

    error.textContent =
        String(message || "");

    error.classList.toggle(
        "active",
        Boolean(message)
    );
}


function clearFileInputError(input) {

    const error =
        getFileErrorElement(input);

    if (!error) {
        return;
    }

    error.textContent = "";

    error.classList.remove(
        "active"
    );
}


function displaySelectedFiles(input) {

    const baseId =
        getFileInputBaseId(input);

    const container =
        document.getElementById(
            `${baseId}-files`
        );

    if (!container) {
        return;
    }

    container.innerHTML = "";

    const files =
        Array.from(
            input?.files || []
        );

    if (files.length === 0) {
        return;
    }

    const summary =
        document.createElement("div");

    summary.className =
        "seedance-selected-files-summary";

    const maxFiles =
        getFileInputMaxFiles(input);

    summary.textContent =
        maxFiles
            ? `${files.length} file dipilih dari maksimal ${maxFiles}`
            : `${files.length} file dipilih`;

    container.appendChild(
        summary
    );

    files.forEach(
        (file, index) => {

            const row =
                document.createElement("div");

            row.className =
                "seedance-selected-file";

            row.dataset.index =
                String(index);

            const name =
                document.createElement("span");

            name.className =
                "seedance-selected-file-name";

            name.title =
                file.name;

            name.textContent =
                file.name;

            const size =
                document.createElement("span");

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


async function renderFilePreview(
    input,
    expectedType
) {

    const baseId =
        getFileInputBaseId(input);

    const preview =
        document.getElementById(
            `${baseId}-preview`
        );

    if (!preview) {
        return;
    }

    preview.innerHTML = "";

    const files =
        Array.from(
            input?.files || []
        );

    if (files.length === 0) {
        return;
    }

    for (
        const file
        of files
    ) {

        try {

            const element =
                await mediaModule
                    .createPreviewElement(
                        file,
                        {
                            className:
                                "seedance-preview-media"
                        }
                    );

            if (element) {
                preview.appendChild(
                    element
                );
            }

        } catch (error) {

            console.warn(
                "[GEN-Z.AI] " +
                "Seedance preview gagal:",
                error
            );
        }
    }
}


/* =========================================================
   FILE INPUT EVENTS
========================================================= */

function bindFileInputs() {

    const inputs =
        document.querySelectorAll(
            ".seedance-file-input"
        );

    inputs.forEach(
        input => {

            if (
                input.dataset
                    .seedanceBound === "true"
            ) {
                return;
            }

            input.dataset
                .seedanceBound = "true";

            input.addEventListener(
                "change",
                async () => {

                    clearFileInputError(
                        input
                    );

                    const files =
                        Array.from(
                            input.files || []
                        );

                    const maxFiles =
                        getFileInputMaxFiles(
                            input
                        );

                    const label =
                        getFileInputLabel(
                            input
                        );

                    try {

                        validateReferenceFileCount(
                            files,
                            maxFiles,
                            label
                        );

                    } catch (error) {

                        input.value = "";

                        displaySelectedFiles(
                            input
                        );

                        await renderFilePreview(
                            input,
                            getExpectedTypeFromInput(
                                input
                            )
                        );

                        showFileInputError(
                            input,
                            error?.message ||
                                "Jumlah file melebihi batas."
                        );

                        return;
                    }

                    displaySelectedFiles(
                        input
                    );

                    const expectedType =
                        getExpectedTypeFromInput(
                            input
                        );

                    await renderFilePreview(
                        input,
                        expectedType
                    );
                }
            );
        }
    );
}


/* =========================================================
   INPUT TYPE DETECTION
========================================================= */

function getExpectedTypeFromInput(
    input
) {

    const accept =
        String(
            input?.accept || ""
        ).toLowerCase();

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
   URL INPUT EVENTS
========================================================= */

function bindUrlInputs() {

    const inputs =
        document.querySelectorAll(
            ".seedance-url-input"
        );

    inputs.forEach(
        input => {

            if (
                input.dataset
                    .seedanceUrlBound === "true"
            ) {
                return;
            }

            input.dataset
                .seedanceUrlBound = "true";

            input.addEventListener(
                "input",
                () => {

                    const expectedType =
                        getExpectedTypeFromUrlInput(
                            input
                        );

                    if (
                        expectedType
                    ) {
                        input.dataset
                            .expectedType =
                            expectedType;
                    }
                }
            );
        }
    );
}


function getExpectedTypeFromUrlInput(
    input
) {

    const name =
        String(
            input?.id || ""
        ).toLowerCase();

    if (
        name.includes("image")
    ) {
        return "image";
    }

    if (
        name.includes("video")
    ) {
        return "video";
    }

    if (
        name.includes("audio")
    ) {
        return "audio";
    }

    return null;
}


/* =========================================================
   PROMPT COUNTER
========================================================= */

function bindPromptCounter() {

    const textarea =
        document.getElementById(
            FIELD_IDS.prompt
        );

    if (!textarea) {
        return;
    }

    const counter =
        document.getElementById(
            `${FIELD_IDS.prompt}-counter`
        );

    if (!counter) {
        return;
    }

    const update =
        () => {

            counter.textContent =
                `${textarea.value.length}/30000`;
        };

    textarea.addEventListener(
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
            FIELD_IDS.duration
        );

    if (!input) {
        return;
    }

    const output =
        document.getElementById(
            `${FIELD_IDS.duration}-value`
        );

    const update =
        () => {

            let value =
                Number(
                    input.value
                );

            if (
                !Number.isFinite(value)
            ) {
                value =
                    MIN_DURATION;
            }

            value =
                Math.min(
                    MAX_DURATION,
                    Math.max(
                        MIN_DURATION,
                        value
                    )
                );

            input.value =
                String(value);

            if (output) {
                output.textContent =
                    `${value}s`;
            }
        };

    input.addEventListener(
        "input",
        update
    );

    input.addEventListener(
        "change",
        update
    );

    update();
}


/* =========================================================
   TOGGLE LABELS
========================================================= */

function bindToggleLabels() {

    const toggles =
        document.querySelectorAll(
            ".seedance-toggle input"
        );

    toggles.forEach(
        input => {

            if (
                input.dataset
                    .seedanceToggleBound ===
                "true"
            ) {
                return;
            }

            input.dataset
                .seedanceToggleBound =
                "true";

            const update =
                () => {

                    const row =
                        input.closest(
                            ".seedance-toggle-row"
                        );

                    if (!row) {
                        return;
                    }

                    const status =
                        row.querySelector(
                            ".seedance-toggle-status"
                        );

                    if (!status) {
                        return;
                    }

                    status.textContent =
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
   EVENT BINDING
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
   FILE COUNT VALIDATION
========================================================= */

function validateReferenceFileCount(
    files,
    maxFiles,
    label
) {

    if (
        !Number.isInteger(maxFiles) ||
        maxFiles <= 0
    ) {
        return;
    }

    const count =
        Array.isArray(files)
            ? files.length
            : 0;

    if (
        count > maxFiles
    ) {
        throw new Error(
            `${label} maksimal ${maxFiles} file. ` +
            `Anda memilih ${count} file.`
        );
    }
}


/* =========================================================
   MEDIA SOURCE COLLECTION
========================================================= */

async function collectMediaSource(
    name,
    type,
    multiple = false,
    maxFiles = null,
    label = "File"
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

        if (multiple) {

            validateReferenceFileCount(
                files,
                maxFiles,
                label
            );

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

    const urlInput =
        document.getElementById(
            `${id}-url`
        );

    if (multiple) {

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
   SEEDANCE PARAMETERS
========================================================= */

async function getSeedanceParameters() {

    const promptElement =
        document.getElementById(
            FIELD_IDS.prompt
        );

    const resolutionElement =
        document.getElementById(
            FIELD_IDS.resolution
        );

    const aspectRatioElement =
        document.getElementById(
            FIELD_IDS.aspectRatio
        );

    const durationElement =
        document.getElementById(
            FIELD_IDS.duration
        );

    const outputFormatElement =
        document.getElementById(
            FIELD_IDS.outputFormat
        );

    const generateAudioElement =
        document.getElementById(
            FIELD_IDS.generateAudio
        );

    const returnLastFrameElement =
        document.getElementById(
            FIELD_IDS.returnLastFrame
        );

    const webSearchElement =
        document.getElementById(
            FIELD_IDS.webSearch
        );


    const prompt =
        String(
            promptElement?.value || ""
        ).trim();


    const resolution =
        String(
            resolutionElement?.value ||
            "720p"
        ).trim();


    const aspectRatio =
        String(
            aspectRatioElement?.value ||
            "adaptive"
        ).trim();


    const duration =
        Number(
            durationElement?.value ||
            MIN_DURATION
        );


    const outputFormat =
        String(
            outputFormatElement?.value ||
            "mp4"
        ).trim();


    const generateAudio =
        Boolean(
            generateAudioElement?.checked
        );


    const returnLastFrame =
        Boolean(
            returnLastFrameElement?.checked
        );


    const webSearch =
        Boolean(
            webSearchElement?.checked
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
            true,
            MAX_REFERENCE_IMAGE_FILES,
            "Reference Images"
        );


    const referenceVideoUrls =
        await collectMediaSource(
            "referenceVideos",
            "video",
            true,
            MAX_REFERENCE_VIDEO_FILES,
            "Reference Videos"
        );


    const referenceAudioUrls =
        await collectMediaSource(
            "referenceAudio",
            "audio",
            true,
            MAX_REFERENCE_AUDIO_FILES,
            "Reference Audio"
        );


    const parameters = {};


    if (prompt) {
        parameters.prompt =
            prompt;
    }


    if (firstFrameUrl) {
        parameters.first_frame_url =
            firstFrameUrl;
    }


    if (lastFrameUrl) {
        parameters.last_frame_url =
            lastFrameUrl;
    }


    if (
        Array.isArray(
            referenceImageUrls
        ) &&
        referenceImageUrls.length > 0
    ) {

        parameters.reference_image_urls =
            referenceImageUrls;
    }


    if (
        Array.isArray(
            referenceVideoUrls
        ) &&
        referenceVideoUrls.length > 0
    ) {

        parameters.reference_video_urls =
            referenceVideoUrls;
    }


    if (
        Array.isArray(
            referenceAudioUrls
        ) &&
        referenceAudioUrls.length > 0
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


    return parameters;
}


/* =========================================================
   PARAMETER VALIDATION
========================================================= */

function validateSeedanceParameters(
    parameters
) {

    if (
        !parameters ||
        typeof parameters !== "object"
    ) {

        throw new Error(
            "Parameter Seedance tidak valid."
        );
    }


    if (
        parameters.prompt !== undefined
    ) {

        const prompt =
            String(
                parameters.prompt
            );

        if (
            prompt.length > 30000
        ) {

            throw new Error(
                "Prompt maksimal 30000 karakter."
            );
        }
    }


    const allowedResolutions =
        [
            "480p",
            "720p",
            "1080p"
        ];


    if (
        parameters.resolution !==
        undefined &&
        !allowedResolutions.includes(
            String(
                parameters.resolution
            )
        )
    ) {

        throw new Error(
            "Resolution Seedance tidak valid."
        );
    }


    const allowedAspectRatios =
        [
            "adaptive",
            "16:9",
            "9:16",
            "4:3",
            "3:4",
            "1:1",
            "21:9"
        ];


    if (
        parameters.aspect_ratio !==
        undefined &&
        !allowedAspectRatios.includes(
            String(
                parameters.aspect_ratio
            )
        )
    ) {

        throw new Error(
            "Aspect ratio Seedance tidak valid."
        );
    }


    if (
        parameters.duration !==
        undefined
    ) {

        const duration =
            Number(
                parameters.duration
            );

        if (
            !Number.isFinite(duration) ||
            duration < MIN_DURATION ||
            duration > MAX_DURATION
        ) {

            throw new Error(
                `Duration harus antara ` +
                `${MIN_DURATION} dan ` +
                `${MAX_DURATION} detik.`
            );
        }
    }


    const allowedOutputFormats =
        [
            "mp4",
            "mov"
        ];


    if (
        parameters.output_format !==
        undefined &&
        !allowedOutputFormats.includes(
            String(
                parameters.output_format
            )
        )
    ) {

        throw new Error(
            "Output format Seedance tidak valid."
        );
    }


    if (
        parameters.reference_image_urls !==
        undefined
    ) {

        if (
            !Array.isArray(
                parameters.reference_image_urls
            )
        ) {

            throw new Error(
                "Reference Images harus berupa array."
            );
        }

        validateReferenceFileCount(
            parameters.reference_image_urls,
            MAX_REFERENCE_IMAGE_FILES,
            "Reference Images"
        );
    }


    if (
        parameters.reference_video_urls !==
        undefined
    ) {

        if (
            !Array.isArray(
                parameters.reference_video_urls
            )
        ) {

            throw new Error(
                "Reference Videos harus berupa array."
            );
        }

        validateReferenceFileCount(
            parameters.reference_video_urls,
            MAX_REFERENCE_VIDEO_FILES,
            "Reference Videos"
        );
    }


    if (
        parameters.reference_audio_urls !==
        undefined
    ) {

        if (
            !Array.isArray(
                parameters.reference_audio_urls
            )
        ) {

            throw new Error(
                "Reference Audio harus berupa array."
            );
        }

        validateReferenceFileCount(
            parameters.reference_audio_urls,
            MAX_REFERENCE_AUDIO_FILES,
            "Reference Audio"
        );
    }


    return true;
}


/* =========================================================
   RESET FORM
========================================================= */

function resetSeedanceForm() {

    const promptElement =
        document.getElementById(
            FIELD_IDS.prompt
        );

    if (promptElement) {
        promptElement.value = "";
    }


    const firstFrameInput =
        document.getElementById(
            `${fieldId(
                "firstFrame"
            )}-file`
        );

    if (firstFrameInput) {
        firstFrameInput.value = "";
    }


    const lastFrameInput =
        document.getElementById(
            `${fieldId(
                "lastFrame"
            )}-file`
        );

    if (lastFrameInput) {
        lastFrameInput.value = "";
    }


    const referenceImageInput =
        document.getElementById(
            `${fieldId(
                "referenceImages"
            )}-file`
        );

    if (referenceImageInput) {
        referenceImageInput.value = "";
    }


    const referenceVideoInput =
        document.getElementById(
            `${fieldId(
                "referenceVideos"
            )}-file`
        );

    if (referenceVideoInput) {
        referenceVideoInput.value = "";
    }


    const referenceAudioInput =
        document.getElementById(
            `${fieldId(
                "referenceAudio"
            )}-file`
        );

    if (referenceAudioInput) {
        referenceAudioInput.value = "";
    }


    const urlInputs =
        document.querySelectorAll(
            ".seedance-url-input"
        );

    urlInputs.forEach(
        input => {
            input.value = "";
        }
    );


    const resolutionElement =
        document.getElementById(
            FIELD_IDS.resolution
        );

    if (resolutionElement) {
        resolutionElement.value =
            "720p";
    }


    const aspectRatioElement =
        document.getElementById(
            FIELD_IDS.aspectRatio
        );

    if (aspectRatioElement) {
        aspectRatioElement.value =
            "adaptive";
    }


    const durationElement =
        document.getElementById(
            FIELD_IDS.duration
        );

    if (durationElement) {
        durationElement.value =
            String(
                MIN_DURATION
            );
    }


    const outputFormatElement =
        document.getElementById(
            FIELD_IDS.outputFormat
        );

    if (outputFormatElement) {
        outputFormatElement.value =
            "mp4";
    }


    const generateAudioElement =
        document.getElementById(
            FIELD_IDS.generateAudio
        );

    if (generateAudioElement) {
        generateAudioElement.checked =
            true;
    }


    const returnLastFrameElement =
        document.getElementById(
            FIELD_IDS.returnLastFrame
        );

    if (returnLastFrameElement) {
        returnLastFrameElement.checked =
            false;
    }


    const webSearchElement =
        document.getElementById(
            FIELD_IDS.webSearch
        );

    if (webSearchElement) {
        webSearchElement.checked =
            false;
    }


    const selectedFiles =
        document.querySelectorAll(
            ".seedance-selected-files"
        );

    selectedFiles.forEach(
        element => {
            element.innerHTML = "";
        }
    );


    const previews =
        document.querySelectorAll(
            ".seedance-media-preview"
        );

    previews.forEach(
        element => {
            element.innerHTML = "";
        }
    );


    const errors =
        document.querySelectorAll(
            ".seedance-file-error"
        );

    errors.forEach(
        element => {

            element.textContent =
                "";

            element.classList.remove(
                "active"
            );
        }
    );


    bindPromptCounter();

    bindDuration();

    bindToggleLabels();
}


/* =========================================================
   MODULE INIT
========================================================= */

function initSeedanceModule() {

    renderSeedanceStyles();

    bindSeedanceEvents();
}


/* =========================================================
   PUBLIC MODULE
========================================================= */

const seedanceModule = {

    SEEDANCE_MODEL_ID,

    isSeedanceModel,

    renderSeedanceForm,

    getSeedanceParameters,

    validateSeedanceParameters,

    resetSeedanceForm,

    initSeedanceModule
};


/* =========================================================
   EXPORT
========================================================= */

export default Object.freeze(
    seedanceModule
);


export {

    SEEDANCE_MODEL_ID,

    isSeedanceModel,

    renderSeedanceForm,

    getSeedanceParameters,

    validateSeedanceParameters,

    resetSeedanceForm,

    initSeedanceModule
};
