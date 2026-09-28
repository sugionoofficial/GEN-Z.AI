/* =========================================================
   GEN-Z.AI
   SEEDANCE 2.5 GENERATE MODULE
   ---------------------------------------------------------
   Model:
   bytedance/seedance-2-5

   Fitur:
   - Prompt
   - First Frame
   - Last Frame
   - Reference Images
   - Reference Videos
   - Reference Audio
   - Resolution
   - Aspect Ratio
   - Duration
   - Output Format
   - Generate Audio
   - Return Last Frame
   - Web Search

   Reference:
   - Images  : max 30
   - Videos  : max 10
   - Audio   : max 10

   IMPORTANT:
   - nsfw_checker TIDAK dikirim dari browser.
   - Credit TIDAK dihitung di sini.
   - Credit mengikuti model config:
       credit_480p
       credit_720p
       credit_1080p
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


const MIN_DURATION =
    5;

const MAX_DURATION =
    30;


const MAX_REFERENCE_IMAGE_FILES =
    30;

const MAX_REFERENCE_VIDEO_FILES =
    10;

const MAX_REFERENCE_AUDIO_FILES =
    10;


/* =========================================================
   INTERNAL FILE STATE
   ---------------------------------------------------------
   Native input.files akan berubah setiap kali user memilih
   file baru.

   Karena itu Reference Images / Videos / Audio menggunakan
   state internal agar:

   + Tambah file
   + Tambah file lagi
   + Hapus file tertentu

   tidak saling menimpa.
========================================================= */

const selectedReferenceFiles = {

    referenceImages: [],

    referenceVideos: [],

    referenceAudio: []

};


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

    return (
        FIELD_IDS[name] ||
        `seedance-${name}`
    );

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
            class="seedance-field ${escapeHtml(extraClass)}"
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


    const isReference =
        multiple &&
        (
            name === "referenceImages" ||
            name === "referenceVideos" ||
            name === "referenceAudio"
        );


    const addButton =
        isReference
            ? `
                <button
                    type="button"
                    class="seedance-add-file-button"
                    data-seedance-add="${escapeHtml(name)}"
                >
                    + Tambah
                </button>
              `
            : "";


    return createFieldWrapper(

        title,

        description,

        `

        <div
            class="seedance-media-source"
            data-seedance-media="${escapeHtml(name)}"
        >

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
                class="seedance-source-mode"
                value="upload"
            />


            <div
                class="seedance-source-panel"
                data-mode="upload"
            >

                <div class="seedance-upload-toolbar">

                    ${addButton}

                    ${
                        isReference
                            ? `
                                <span
                                    class="seedance-file-limit"
                                    data-limit-for="${escapeHtml(name)}"
                                >
                                    0 / ${maxFiles}
                                </span>
                              `
                            : ""
                    }

                </div>


                <input
                    type="file"
                    id="${fileInputId}"
                    class="seedance-file-input"
                    accept="${escapeHtml(accept)}"
                    ${multipleAttr}
                    ${requiredAttr}
                    ${maxFilesAttr}
                    ${
                        isReference
                            ? `data-reference-name="${escapeHtml(name)}"`
                            : ""
                    }
                />


                <div
                    class="seedance-file-help"
                >
                    ${
                        multiple
                            ? (
                                Number.isInteger(maxFiles) &&
                                maxFiles > 0
                                    ? `Maksimal ${maxFiles} file. Gunakan + Tambah untuk menambahkan file secara bertahap.`
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
                data-mode="url"
                hidden
            >

                <textarea
                    id="${urlInputId}"
                    class="seedance-url-input"
                    rows="${multiple ? 4 : 1}"
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
   STYLES
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
            border: 1px solid rgba(255,45,80,.20);
            border-radius: 16px;
            background:
                linear-gradient(
                    145deg,
                    rgba(255,255,255,.045),
                    rgba(0,0,0,.25)
                );
            box-shadow:
                0 0 22px rgba(255,35,70,.055);
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


        .seedance-upload-toolbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            margin-bottom: 10px;
        }


        .seedance-add-file-button {
            border: 1px solid rgba(255,35,70,.55);
            border-radius: 9px;
            padding: 8px 13px;
            background: rgba(255,35,70,.10);
            color: #fff;
            cursor: pointer;
            font-size: 12px;
            font-weight: 800;
            transition:
                background .18s ease,
                border-color .18s ease,
                transform .18s ease;
        }


        .seedance-add-file-button:hover {
            background: rgba(255,35,70,.20);
            border-color: rgba(255,35,70,.85);
            transform: translateY(-1px);
        }


        .seedance-file-limit {
            margin-left: auto;
            color: rgba(255,255,255,.45);
            font-size: 11px;
            font-weight: 700;
        }


        .seedance-file-input {
            box-sizing: border-box;
            width: 100%;
            padding: 11px;
            border: 1px solid rgba(255,255,255,.11);
            border-radius: 11px;
            background: rgba(0,0,0,.32);
            color: #fff;
            font-size: 12px;
            outline: none;
        }


        .seedance-file-help {
            margin-top: 7px;
            color: rgba(255,255,255,.38);
            font-size: 11px;
            line-height: 1.45;
        }


        .seedance-selected-files {
            display: grid;
            gap: 7px;
            margin-top: 12px;
        }


        .seedance-selected-file {
            display: flex;
            align-items: center;
            gap: 10px;
            min-width: 0;
            padding: 9px 10px;
            border: 1px solid rgba(255,255,255,.07);
            border-radius: 9px;
            background: rgba(255,255,255,.025);
        }


        .seedance-selected-file-index {
            flex: 0 0 26px;
            width: 26px;
            height: 26px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 7px;
            background: rgba(255,35,70,.10);
            color: rgba(255,255,255,.75);
            font-size: 10px;
            font-weight: 800;
        }


        .seedance-selected-file-info {
            min-width: 0;
            flex: 1;
        }


        .seedance-selected-file-name {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            color: rgba(255,255,255,.78);
            font-size: 11px;
            font-weight: 700;
        }


        .seedance-selected-file-size {
            margin-top: 2px;
            color: rgba(255,255,255,.35);
            font-size: 10px;
        }


        .seedance-remove-file-button {
            flex: 0 0 auto;
            border: 1px solid rgba(255,70,90,.25);
            border-radius: 7px;
            padding: 6px 9px;
            background: rgba(255,35,70,.07);
            color: rgba(255,150,160,.9);
            cursor: pointer;
            font-size: 11px;
            font-weight: 800;
        }


        .seedance-remove-file-button:hover {
            border-color: rgba(255,70,90,.65);
            background: rgba(255,35,70,.16);
            color: #fff;
        }


        .seedance-file-input.seedance-hidden-native-input {
            position: absolute;
            width: 1px;
            height: 1px;
            opacity: 0;
            pointer-events: none;
        }


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


        .seedance-media-preview {
            display: grid;
            grid-template-columns:
                repeat(
                    auto-fill,
                    minmax(
                        150px,
                        1fr
                    )
                );
            gap: 10px;
            margin-top: 12px;
        }


        .seedance-preview-media {
            display: block;
            width: 100%;
            max-height: 260px;
            object-fit: contain;
            border-radius: 10px;
            background: #000;
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
        width: 100%;
        box-sizing: border-box;
        margin-bottom: 14px;
        padding: 13px;
        border-radius: 13px;
    }


    .seedance-field-header {
        width: 100%;
        margin-bottom: 11px;
    }


    .seedance-field-title {
        font-size: 13px;
        line-height: 1.35;
    }


    .seedance-field-description {
        font-size: 10px;
        line-height: 1.45;
    }


    /* =========================================
       SOURCE TABS
    ========================================= */

    .seedance-source-tabs {
        width: 100%;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px;
    }


    .seedance-source-tab {
        width: 100%;
        min-width: 0;
        box-sizing: border-box;
        padding: 9px 8px;
        font-size: 11px;
        text-align: center;
    }


    /* =========================================
       ADD BUTTON + COUNTER
    ========================================= */

    .seedance-upload-toolbar {
        width: 100%;
        min-width: 0;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        flex-wrap: wrap;
    }


    .seedance-add-file-button {
        flex: 0 0 auto;
        min-height: 36px;
        padding: 8px 11px;
        font-size: 11px;
    }


    .seedance-file-limit {
        flex: 0 0 auto;
        margin-left: auto;
        font-size: 10px;
        white-space: nowrap;
    }


    /* =========================================
       FILE INPUT
    ========================================= */

    .seedance-file-input {
        width: 100%;
        max-width: 100%;
        min-width: 0;
        box-sizing: border-box;
        padding: 9px;
        font-size: 11px;
    }


    /* =========================================
       SELECTED FILE
    ========================================= */

    .seedance-selected-files {
        width: 100%;
        min-width: 0;
        display: grid;
        gap: 6px;
    }


    .seedance-selected-file {
        width: 100%;
        min-width: 0;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        gap: 7px;
        padding: 8px;
    }


    .seedance-selected-file-index {
        flex: 0 0 23px;
        width: 23px;
        height: 23px;
        font-size: 9px;
    }


    .seedance-selected-file-info {
        flex: 1 1 auto;
        min-width: 0;
        overflow: hidden;
    }


    .seedance-selected-file-name {
        width: 100%;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 10px;
        line-height: 1.3;
    }


    .seedance-selected-file-size {
        font-size: 9px;
        line-height: 1.3;
    }


    .seedance-remove-file-button {
        flex: 0 0 auto;
        min-height: 30px;
        padding: 6px 8px;
        white-space: nowrap;
        font-size: 9px;
    }


    /* =========================================
       URL / PROMPT
    ========================================= */

    .seedance-url-input,
    .seedance-prompt-input {
        width: 100%;
        max-width: 100%;
        min-width: 0;
        box-sizing: border-box;
        font-size: 12px;
    }


    .seedance-prompt-input {
        min-height: 130px;
    }


    .seedance-url-input {
        min-height: 80px;
    }


    /* =========================================
       SELECT
    ========================================= */

    .seedance-select {
        width: 100%;
        max-width: 100%;
        min-width: 0;
        min-height: 42px;
        box-sizing: border-box;
        font-size: 12px;
    }


    /* =========================================
       PREVIEW
    ========================================= */

    .seedance-media-preview {
        width: 100%;
        min-width: 0;
        grid-template-columns:
            repeat(
                2,
                minmax(0, 1fr)
            );
        gap: 7px;
    }


    .seedance-preview-media {
        width: 100%;
        max-width: 100%;
        min-width: 0;
        max-height: 180px;
        object-fit: contain;
        border-radius: 8px;
    }


    /* =========================================
       DURATION
    ========================================= */

    .seedance-duration-row {
        width: 100%;
        min-width: 0;
        display: flex;
        align-items: center;
        gap: 9px;
    }


    .seedance-duration-range {
        flex: 1 1 auto;
        min-width: 0;
        width: 100%;
    }


    .seedance-duration-value {
        flex: 0 0 auto;
        min-width: 62px;
        font-size: 11px;
        text-align: right;
    }


    .seedance-duration-scale {
        font-size: 9px;
    }


    /* =========================================
       TOGGLE
    ========================================= */

    .seedance-toggle {
        max-width: 100%;
        min-width: 0;
        display: inline-flex;
        align-items: center;
        gap: 8px;
    }


    .seedance-toggle-track {
        flex: 0 0 auto;
    }


    .seedance-toggle-label {
        min-width: 0;
        font-size: 11px;
    }


    /* =========================================
       COUNTER
    ========================================= */

    .seedance-counter {
        font-size: 9px;
    }

}


/* =========================================================
   VERY SMALL PHONES
   ========================================================= */

@media (max-width: 380px) {

    .seedance-field {
        padding: 11px;
        border-radius: 11px;
    }


    .seedance-upload-toolbar {
        align-items: stretch;
    }


    .seedance-add-file-button {
        flex: 1 1 auto;
        min-width: 0;
    }


    .seedance-file-limit {
        flex: 0 0 auto;
        margin-left: 0;
        align-self: center;
    }


    .seedance-selected-file {
        gap: 5px;
        padding: 7px;
    }


    .seedance-selected-file-index {
        flex-basis: 21px;
        width: 21px;
        height: 21px;
    }


    .seedance-remove-file-button {
        padding: 5px 6px;
        font-size: 8px;
    }


    .seedance-media-preview {
        grid-template-columns:
            repeat(
                2,
                minmax(0, 1fr)
            );
    }


    .seedance-duration-row {
        gap: 7px;
    }


    .seedance-duration-value {
        min-width: 57px;
        font-size: 10px;
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
            data-model="${SEEDANCE_MODEL_ID}"
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


    resetReferenceFileState();


    bindSeedanceEvents();


    return true;

}


/* =========================================================
   RESET REFERENCE STATE
========================================================= */

function resetReferenceFileState() {

    Object.keys(
        selectedReferenceFiles
    ).forEach(
        name => {

            selectedReferenceFiles[name] =
                [];

        }
    );

}


/* =========================================================
   SOURCE TABS
========================================================= */

function bindSourceTabs() {

    document
        .querySelectorAll(
            ".seedance-source-tab"
        )
        .forEach(
            button => {

                if (
                    button.dataset.seedanceBound ===
                    "true"
                ) {

                    return;

                }


                button.dataset.seedanceBound =
                    "true";


                button.addEventListener(
                    "click",
                    () => {

                        const sourceId =
                            button.dataset
                                .seedanceSource;


                        const mode =
                            button.dataset
                                .mode ||
                            "upload";


                        const wrapper =
                            button.closest(
                                ".seedance-media-source"
                            );


                        if (
                            !wrapper
                        ) {

                            return;

                        }


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
                                        panel.dataset.mode !==
                                        mode;

                                }
                            );

                    }
                );

            }
        );

}


/* =========================================================
   ADD BUTTON
========================================================= */

function bindAddButtons() {

    document
        .querySelectorAll(
            "[data-seedance-add]"
        )
        .forEach(
            button => {

                if (
                    button.dataset.seedanceBound ===
                    "true"
                ) {

                    return;

                }


                button.dataset.seedanceBound =
                    "true";


                button.addEventListener(
                    "click",
                    event => {

                        event.preventDefault();


                        const name =
                            button.dataset
                                .seedanceAdd;


                        const input =
                            document.getElementById(
                                `${fieldId(name)}-file`
                            );


                        if (
                            !input
                        ) {

                            return;

                        }


                        const maxFiles =
                            getMaxFilesForReference(
                                name
                            );


                        const currentCount =
                            selectedReferenceFiles[
                                name
                            ]?.length || 0;


                        if (
                            currentCount >=
                            maxFiles
                        ) {

                            showSeedanceFileMessage(
                                `${getReferenceLabel(name)} maksimal ${maxFiles} file.`
                            );

                            return;

                        }


                        input.click();

                    }
                );

            }
        );

}


/* =========================================================
   GET MAX FILES
========================================================= */

function getMaxFilesForReference(
    name
) {

    if (
        name === "referenceImages"
    ) {

        return MAX_REFERENCE_IMAGE_FILES;

    }


    if (
        name === "referenceVideos"
    ) {

        return MAX_REFERENCE_VIDEO_FILES;

    }


    if (
        name === "referenceAudio"
    ) {

        return MAX_REFERENCE_AUDIO_FILES;

    }


    return 1;

}


/* =========================================================
   LABEL
========================================================= */

function getReferenceLabel(
    name
) {

    if (
        name === "referenceImages"
    ) {

        return "Reference Images";

    }


    if (
        name === "referenceVideos"
    ) {

        return "Reference Videos";

    }


    if (
        name === "referenceAudio"
    ) {

        return "Reference Audio";

    }


    return "File";

}


/* =========================================================
   FILE KEY
========================================================= */

function getFileKey(
    file
) {

    return [

        file?.name || "",

        file?.size || 0,

        file?.lastModified || 0,

        file?.type || ""

    ].join(
        "::"
    );

}


/* =========================================================
   ADD FILES TO STATE
========================================================= */

function addReferenceFiles(
    name,
    files
) {

    const list =
        selectedReferenceFiles[name];


    if (
        !Array.isArray(list)
    ) {

        return;

    }


    const maxFiles =
        getMaxFilesForReference(
            name
        );


    const existingKeys =
        new Set(
            list.map(
                file =>
                    getFileKey(file)
            )
        );


    for (
        const file of files
    ) {

        if (
            list.length >=
            maxFiles
        ) {

            break;

        }


        const key =
            getFileKey(file);


        if (
            existingKeys.has(key)
        ) {

            continue;

        }


        list.push(file);


        existingKeys.add(key);

    }


    renderReferenceFileList(
        name
    );


    updateReferenceLimit(
        name
    );


    renderReferencePreview(
        name
    );

}


/* =========================================================
   REMOVE FILE
========================================================= */

function removeReferenceFile(
    name,
    index
) {

    const list =
        selectedReferenceFiles[name];


    if (
        !Array.isArray(list)
    ) {

        return;

    }


    if (
        index < 0 ||
        index >= list.length
    ) {

        return;

    }


    list.splice(
        index,
        1
    );


    renderReferenceFileList(
        name
    );


    updateReferenceLimit(
        name
    );


    renderReferencePreview(
        name
    );

}


/* =========================================================
   RENDER REFERENCE LIST
========================================================= */

function renderReferenceFileList(
    name
) {

    const id =
        fieldId(name);


    const container =
        document.getElementById(
            `${id}-files`
        );


    if (
        !container
    ) {

        return;

    }


    container.innerHTML =
        "";


    const files =
        selectedReferenceFiles[name] ||
        [];


    files.forEach(
        (
            file,
            index
        ) => {

            const row =
                document.createElement(
                    "div"
                );


            row.className =
                "seedance-selected-file";


            const number =
                document.createElement(
                    "div"
                );


            number.className =
                "seedance-selected-file-index";


            number.textContent =
                String(
                    index + 1
                );


            const info =
                document.createElement(
                    "div"
                );


            info.className =
                "seedance-selected-file-info";


            const fileName =
                document.createElement(
                    "div"
                );


            fileName.className =
                "seedance-selected-file-name";


            fileName.textContent =
                file.name;


            const fileSize =
                document.createElement(
                    "div"
                );


            fileSize.className =
                "seedance-selected-file-size";


            fileSize.textContent =
                mediaModule.formatFileSize(
                    file.size
                );


            info.append(
                fileName,
                fileSize
            );


            const remove =
                document.createElement(
                    "button"
                );


            remove.type =
                "button";


            remove.className =
                "seedance-remove-file-button";


            remove.textContent =
                "× Hapus";


            remove.dataset.index =
                String(index);


            remove.addEventListener(
                "click",
                event => {

                    event.preventDefault();


                    removeReferenceFile(
                        name,
                        index
                    );

                }
            );


            row.append(
                number,
                info,
                remove
            );


            container.appendChild(
                row
            );

        }
    );

}


/* =========================================================
   UPDATE LIMIT COUNTER
========================================================= */

function updateReferenceLimit(
    name
) {

    const limit =
        document.querySelector(
            `[data-limit-for="${name}"]`
        );


    if (
        !limit
    ) {

        return;

    }


    const maxFiles =
        getMaxFilesForReference(
            name
        );


    const count =
        selectedReferenceFiles[name]
            ?.length || 0;


    limit.textContent =
        `${count} / ${maxFiles}`;


    if (
        count >= maxFiles
    ) {

        limit.style.color =
            "rgba(255,120,130,.95)";

    } else {

        limit.style.color =
            "rgba(255,255,255,.45)";

    }

}


/* =========================================================
   FILE INPUTS
========================================================= */

function bindFileInputs() {

    document
        .querySelectorAll(
            ".seedance-file-input"
        )
        .forEach(
            input => {

                if (
                    input.dataset.seedanceBound ===
                    "true"
                ) {

                    return;

                }


                input.dataset.seedanceBound =
                    "true";


                input.addEventListener(
                    "change",
                    () => {

                        const referenceName =
                            input.dataset
                                .referenceName;


                        const files =
                            Array.from(
                                input.files || []
                            );


                        if (
                            referenceName
                        ) {

                            addReferenceFiles(
                                referenceName,
                                files
                            );


                            /*
                             * Reset native input.
                             *
                             * File sebenarnya sudah masuk
                             * ke internal state.
                             *
                             * Dengan reset ini user bisa
                             * memilih file yang sama lagi
                             * jika sebelumnya dihapus.
                             */
                            input.value =
                                "";

                            return;

                        }


                        displaySingleFile(
                            input
                        );


                        renderFilePreview(
                            input
                        );

                    }
                );

            }
        );

}


/* =========================================================
   SINGLE FILE DISPLAY
========================================================= */

function displaySingleFile(
    input
) {

    const baseId =
        input.id.replace(
            /-file$/,
            ""
        );


    const container =
        document.getElementById(
            `${baseId}-files`
        );


    if (
        !container
    ) {

        return;

    }


    container.innerHTML =
        "";


    const file =
        input.files?.[0];


    if (
        !file
    ) {

        return;

    }


    const row =
        document.createElement(
            "div"
        );


    row.className =
        "seedance-selected-file";


    const info =
        document.createElement(
            "div"
        );


    info.className =
        "seedance-selected-file-info";


    const name =
        document.createElement(
            "div"
        );


    name.className =
        "seedance-selected-file-name";


    name.textContent =
        file.name;


    const size =
        document.createElement(
            "div"
        );


    size.className =
        "seedance-selected-file-size";


    size.textContent =
        mediaModule.formatFileSize(
            file.size
        );


    info.append(
        name,
        size
    );


    row.append(
        info
    );


    container.appendChild(
        row
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
   REFERENCE PREVIEW
========================================================= */

function renderReferencePreview(
    name
) {

    const id =
        fieldId(name);


    const preview =
        document.getElementById(
            `${id}-preview`
        );


    if (
        !preview
    ) {

        return;

    }


    preview.innerHTML =
        "";


    const files =
        selectedReferenceFiles[name] ||
        [];


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
   SINGLE FILE PREVIEW
========================================================= */

function renderFilePreview(
    input
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
   URL INPUTS
========================================================= */

function bindUrlInputs() {

    document
        .querySelectorAll(
            ".seedance-url-input"
        )
        .forEach(
            input => {

                if (
                    input.dataset.seedanceBound ===
                    "true"
                ) {

                    return;

                }


                input.dataset.seedanceBound =
                    "true";


                input.addEventListener(
                    "input",
                    () => {

                        renderUrlPreview(
                            input
                        );

                    }
                );

            }
        );

}


/* =========================================================
   URL TYPE
========================================================= */

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
   URL PREVIEW
========================================================= */

function renderUrlPreview(
    input
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


    const type =
        getExpectedTypeFromUrlInput(
            input
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

                /*
                 * URL divalidasi saat collection.
                 */

            }

        }
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


    if (
        input.dataset.seedanceCounterBound ===
        "true"
    ) {

        counter.textContent =
            String(
                input.value.length
            );

        return;

    }


    input.dataset.seedanceCounterBound =
        "true";


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


    if (
        input.dataset.seedanceDurationBound ===
        "true"
    ) {

        output.textContent =
            `${input.value} detik`;

        return;

    }


    input.dataset.seedanceDurationBound =
        "true";


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
   TOGGLE LABELS
========================================================= */

function bindToggleLabels() {

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


            if (
                input.dataset.seedanceToggleBound !==
                "true"
            ) {

                input.dataset.seedanceToggleBound =
                    "true";


                input.addEventListener(
                    "change",
                    () => {

                        label.textContent =
                            input.checked
                                ? "Aktif"
                                : "Nonaktif";

                    }
                );

            }


            label.textContent =
                input.checked
                    ? "Aktif"
                    : "Nonaktif";

        }
    );

}


/* =========================================================
   BIND EVENTS
========================================================= */

function bindSeedanceEvents() {

    bindSourceTabs();

    bindAddButtons();

    bindFileInputs();

    bindUrlInputs();

    bindPromptCounter();

    bindDuration();

    bindToggleLabels();

    updateReferenceLimit(
        "referenceImages"
    );

    updateReferenceLimit(
        "referenceVideos"
    );

    updateReferenceLimit(
        "referenceAudio"
    );

}


/* =========================================================
   MESSAGE
========================================================= */

function showSeedanceFileMessage(
    message
) {

    console.warn(
        `[Seedance] ${message}`
    );

    /*
     * Jangan menggunakan alert().
     * Alert native browser membuat UX buruk
     * dan dapat mengganggu proses Generate.
     */

}


/* =========================================================
   VALIDATE REFERENCE FILE COUNT
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
   COLLECT MEDIA SOURCE
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


    /*
     * =====================================================
     * UPLOAD MODE
     * =====================================================
     */

    if (
        mode === "upload"
    ) {

        /*
         * Reference multiple menggunakan
         * internal state.
         */

        if (
            multiple
        ) {

            const files =
                Array.isArray(
                    selectedReferenceFiles[name]
                )
                    ? selectedReferenceFiles[name]
                    : [];


            if (
                files.length === 0
            ) {

                return [];

            }


            validateReferenceFileCount(
                files,
                maxFiles,
                label
            );


            await mediaModule.validateTotalSize(
                files,
                type
            );


            if (
                type === "video" ||
                type === "audio"
            ) {

                await mediaModule.validateTotalDuration(
                    files,
                    type
                );

            }


            const uploaded =
                await mediaModule.uploadFiles(
                    files,
                    {
                        expectedType:
                            type
                    }
                );


            return uploaded.map(
                item =>
                    item.url
            );

        }


        /*
         * First Frame / Last Frame
         */

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

            return "";

        }


        const uploaded =
            await mediaModule.uploadFile(
                files[0],
                {
                    expectedType:
                        type
                }
            );


        return uploaded.url;

    }


    /*
     * =====================================================
     * URL MODE
     * =====================================================
     */

    const urlInput =
        document.getElementById(
            `${id}-url`
        );


    if (
        multiple
    ) {

        const urls =
            mediaModule.normalizeUrlList(
                urlInput?.value || ""
            );


        validateReferenceFileCount(
            urls,
            maxFiles,
            label
        );


        return urls;

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


    /*
     * First Frame
     */

    const firstFrameUrl =
        await collectMediaSource(
            "firstFrame",
            "image",
            false
        );


    /*
     * Last Frame
     */

    const lastFrameUrl =
        await collectMediaSource(
            "lastFrame",
            "image",
            false
        );


    /*
     * Reference Images
     */

    const referenceImageUrls =
        await collectMediaSource(
            "referenceImages",
            "image",
            true,
            MAX_REFERENCE_IMAGE_FILES,
            "Reference Images"
        );


    /*
     * Reference Videos
     */

    const referenceVideoUrls =
        await collectMediaSource(
            "referenceVideos",
            "video",
            true,
            MAX_REFERENCE_VIDEO_FILES,
            "Reference Videos"
        );


    /*
     * Reference Audio
     */

    const referenceAudioUrls =
        await collectMediaSource(
            "referenceAudio",
            "audio",
            true,
            MAX_REFERENCE_AUDIO_FILES,
            "Reference Audio"
        );


    const parameters =
        {};


    /*
     * Prompt optional.
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
     * NSFW CHECKER TIDAK DIKIRIM.
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
        !Number.isFinite(duration) ||
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
        parameters.reference_image_urls &&
        !Array.isArray(
            parameters.reference_image_urls
        )
    ) {

        throw new Error(
            "Reference image harus berupa array URL."
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
        Array.isArray(
            parameters.reference_image_urls
        )
    ) {

        validateReferenceFileCount(
            parameters.reference_image_urls,
            MAX_REFERENCE_IMAGE_FILES,
            "Reference Images"
        );

    }


    if (
        Array.isArray(
            parameters.reference_video_urls
        )
    ) {

        validateReferenceFileCount(
            parameters.reference_video_urls,
            MAX_REFERENCE_VIDEO_FILES,
            "Reference Videos"
        );

    }


    if (
        Array.isArray(
            parameters.reference_audio_urls
        )
    ) {

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


    /*
     * Reset internal reference state.
     */

    resetReferenceFileState();


    /*
     * Prompt
     */

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


    /*
     * Duration
     */

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


    /*
     * Resolution
     */

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


    /*
     * Aspect ratio
     */

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


    /*
     * Output format
     */

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


    /*
     * Toggle
     */

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


    /*
     * Native inputs.
     */

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


    /*
     * URL.
     */

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


    /*
     * Clear lists and previews.
     */

    document
        .querySelectorAll(
            ".seedance-selected-files"
        )
        .forEach(
            element => {

                element.innerHTML =
                    "";

            }
        );


    document
        .querySelectorAll(
            ".seedance-media-preview"
        )
        .forEach(
            element => {

                element.innerHTML =
                    "";

            }
        );


    updateReferenceLimit(
        "referenceImages"
    );

    updateReferenceLimit(
        "referenceVideos"
    );

    updateReferenceLimit(
        "referenceAudio"
    );


    bindPromptCounter();

    bindDuration();

    bindToggleLabels();

}


/* =========================================================
   PUBLIC API
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
