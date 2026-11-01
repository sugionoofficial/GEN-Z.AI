/* =========================================================
   GEN-Z.AI
   GENERATE APP MODULE
   ---------------------------------------------------------
   File:
   generate/assets/js/generate-app.js

   Tanggung jawab:
   - Bootstrap halaman Generate
   - Load module Generate
   - Menyiapkan Auth sebelum Model
   - Load model configuration
   - Render model information
   - Render model credit
   - Render dynamic parameter form
   - Sinkronisasi Generate State
   - Sinkronisasi tombol Generate
   - Bind model change
   - Bind resolution change
   - Bind reset
   - Submit Generate ke /api/generate
   - Polling task KIE.AI
   - Menampilkan diagnostic response KIE.AI

   CREDIT SOURCE:
   - credit_480p
   - credit_720p
   - credit_1080p
   - discount_percent

   FINAL CREDIT:
   base - (base * discount / 100)

   PENTING:
   - Account Credit tetap dari profiles.credits
   - Role tetap dari navigation / early auth bridge
   - Model Usage Credit dihitung dari konfigurasi model
   - State HARUS menggunakan SATU instance generate-state.js
   - Generate button hanya aktif jika model benar-benar siap
   - generate-request.js WAJIB tersedia untuk Generate
   - MODEL CREDIT hanya boleh dirender SATU KALI
   - POLLING WAJIB menerima modelId agar /api/generate-status
     dapat melakukan reconciliation generation_history
   - HASIL POLLING TIDAK BOLEH DIANGGAP COMPLETED
     jika status task masih processing/pending/running

   PATCH:
   - Hoist Set constants (secretKeys, state sets) ke module
   - Extend sanitizeKieResponse pattern detection
   - Tidak mengubah perilaku / signature / alur
========================================================= */

"use strict";


/* =========================================================
   MODULE PATH
========================================================= */

import {
    IMAGE_SUBMODE_CHARACTER_SHEET,
    IMAGE_SUBMODE_STANDARD,
    MAIN_MODE_AUDIO,
    MAIN_MODE_IMAGE,
    MAIN_MODE_TRANSCRIBE,
    MAIN_MODE_VIDEO,
    getActiveImageSubMode,
    getActiveMainMode,
    inferSubModeFromRegenerateParameters,
    isAudioModel,
    isImageModel,
    isTranscribeModel,
    resolveMainModeForModel,
    setActiveImageSubMode,
    setActiveMainMode
} from "./generate-mode-state.js";

import {
    formatReadableTimestamp,
    normalizeTranscriptPayload
} from "../../../assets/js/transcript-format.js";

const STATE_MODULE =
    "./generate-state.js";

const AUTH_MODULE =
    "./generate-auth.js?v=20261013-auth-refresh";

const UI_MODULE =
    "./generate-ui.js?v=20261101-audio-transcribe";

const MODEL_MODULE =
    "./generate-model.js?v=20261101-audio-transcribe";

const FORM_MODULE =
    "./generate-form.js?v=20261101-audio-transcribe";

const SEEDANCE_MODULE =
    "./generate-seedance.js";

const RENDER_MODULE =
    "./generate-render.js";

const SUBMIT_MODULE =
    "./generate-submit.js?v=20261101-audio-transcribe";

const VALIDATION_MODULE =
    "./generate-validation.js?v=20261101-audio-transcribe";

const REQUEST_MODULE =
    "./generate-request.js?v=20261029-historygate";

const POLLING_MODULE =
    "./generate-polling.js?v=20261029-historygate";

const CANCELLATION_MODULE =
    "./generate-cancellation.js";


/* =========================================================
   MODULE-LEVEL CONSTANT SETS
   ---------------------------------------------------------
   Hoisted dari dalam fungsi untuk mencegah alokasi berulang.
   Isi tetap identik dengan versi sebelumnya.
========================================================= */

const KIE_SECRET_KEYS =
    new Set([

        "apiKey",

        "api_key",

        "apikey",

        "authorization",

        "Authorization",

        "access_token",

        "accessToken",

        "refresh_token",

        "refreshToken",

        "token",

        "secret",

        "password",

        "credential",

        "credentials",

        "api_key_ciphertext",

        "api_key_iv",

        "api_key_tag"

    ]);


const POLLING_FAILED_STATES =
    new Set([

        "fail",

        "failed",

        "failure",

        "error",

        "rejected",

        "terminated"

    ]);


const POLLING_PROCESSING_STATES =
    new Set([

        "waiting",

        "pending",

        "queued",

        "queue",

        "processing",

        "running",

        "generating",

        "in_progress",

        "in-progress",

        "created",

        "submitted",

        "starting",

        "started"

    ]);


const POLLING_COMPLETED_STATES =
    new Set([

        "success",

        "succeeded",

        "successful",

        "completed",

        "complete",

        "done",

        "finished",

        "successfully_completed"

    ]);


/* =========================================================
   APPLICATION STATE
========================================================= */

const appState = {

    initialized:
        false,

    initializing:
        false,

    authReady:
        false,

    profileReady:
        false,

    modelReady:
        false,

    modules: {

        state:
            null,

        auth:
            null,

        ui:
            null,

        model:
            null,

        form:
            null,
       
        seedance:
            null,

        render:
            null,

        submit:
            null,

        validation:
            null,

        request:
            null,

        polling:
            null,

       cancellation:
            null

    }

};


/* =========================================================
   DOM
========================================================= */

function getDOM() {

    return {

        modelSelector:
            document.getElementById(
                "modelSelector"
            ),

        modelSelect:
            document.getElementById(
                "modelSelect"
            ),

        dynamicFields:
            document.getElementById(
                "dynamicFields"
            ),

        generateForm:
            document.getElementById(
                "generateForm"
            ),

        generateButton:
            document.getElementById(
                "generateButton"
            ),

       generateStatus:
    document.getElementById(
        "generateStatus"
    ),

        generateCreditCost:
            document.getElementById(
                "generateCreditCost"
            ),

        generateCreditValue:
            document.getElementById(
                "generateCreditValue"
            ),

        modelName:
            document.getElementById(
                "modelName"
            ),

        modelDescription:
            document.getElementById(
                "modelDescription"
            ),

        providerName:
            document.getElementById(
                "providerName"
            ),

        modelMeta:
            document.getElementById(
                "modelMeta"
            ),

        loading:
            document.getElementById(
                "loading"
            ),

        status:
            document.getElementById(
                "status"
            ),

        pageError:
            document.getElementById(
                "pageError"
            ),

        pageErrorMessage:
            document.getElementById(
                "pageErrorMessage"
            ),

        resetButton:
            document.getElementById(
                "resetButton"
            ),

        generateCard:
            document.getElementById(
                "generateCard"
            ),

        creditBadge:
            document.getElementById(
                "creditBadge"
            ),

        roleBadge:
            document.getElementById(
                "roleBadge"
            ),

        resultModel:
            document.getElementById(
                "resultModel"
            ),

        resultProvider:
            document.getElementById(
                "resultProvider"
            ),

        resultTaskId:
            document.getElementById(
                "resultTaskId"
            )

    };

}

/* =========================================================
   GENERATE PREMIUM STATUS
   ---------------------------------------------------------
   Status:
   - processing
   - success
   - failed
   - idle
========================================================= */

function ensureGenerateStatus() {

    const elements =
        getDOM();

    if (
        elements.generateStatus
    ) {

        applyGenerateStatusStyles(
            elements.generateStatus
        );

        return elements.generateStatus;

    }

    const button =
        elements.generateButton;

    if (
        !button
    ) {

        return null;

    }

    let wrapper =
        button.parentElement;

    if (
        !wrapper
    ) {

        return null;

    }

    let status =
        wrapper.querySelector(
            "#generateStatus"
        );

    if (
        !status
    ) {

        status =
            document.createElement(
                "div"
            );

        status.id =
            "generateStatus";

        status.setAttribute(
            "aria-live",
            "polite"
        );

        status.setAttribute(
            "aria-atomic",
            "true"
        );

        /*
         * Status ditempatkan tepat di samping tombol Generate
         * pada desktop, dan melebar penuh di bawah tombol pada
         * Mode HP / mobile (diatur lewat stylesheet agar media
         * query tidak dikalahkan oleh inline style).
         */
        status.style.display =
            "none";

        wrapper.style.display =
            "flex";

        wrapper.style.alignItems =
            "center";

        wrapper.style.flexWrap =
            "wrap";

        wrapper.style.gap =
            "8px";

        button.insertAdjacentElement(
            "afterend",
            status
        );

    }

    applyGenerateStatusStyles(
        status
    );

    return status;

}


/* =========================================================
   PREMIUM STATUS STYLE
========================================================= */

function applyGenerateStatusStyles(
    status
) {

    if (
        !status
    ) {

        return;

    }

    /*
     * Animasi dibuat menggunakan CSS injection
     * satu kali saja.
     */

    if (
        !document.getElementById(
            "genzGenerateStatusStyles"
        )
    ) {

        const style =
            document.createElement(
                "style"
            );

        style.id =
            "genzGenerateStatusStyles";

        style.textContent =
            `
            #generateStatus {
                position:relative;
                box-sizing:border-box;
                align-items:center;
                justify-content:flex-start;
                gap:10px;
                min-width:190px;
                max-width:320px;
                min-height:42px;
                margin-left:14px;
                padding:7px 13px;
                font-family:inherit;
                vertical-align:middle;
                border-radius:12px;
                border:1px solid rgba(255,255,255,.08);
                background:
                    linear-gradient(
                        135deg,
                        rgba(255,255,255,.055),
                        rgba(255,255,255,.018)
                    );
                backdrop-filter:blur(14px);
                -webkit-backdrop-filter:blur(14px);
                box-shadow:
                    0 8px 24px rgba(0,0,0,.18),
                    inset 0 1px 0 rgba(255,255,255,.055);
                overflow:hidden;
                transition:
                    opacity .28s ease,
                    transform .28s ease,
                    border-color .28s ease,
                    box-shadow .28s ease;
            }

            #generateStatus::before {
                content:"";
                position:absolute;
                inset:0;
                pointer-events:none;
                background:
                    linear-gradient(
                        110deg,
                        transparent 0%,
                        rgba(255,255,255,.07) 45%,
                        transparent 70%
                    );
                transform:translateX(-120%);
                animation:genzStatusShimmer 2.8s infinite;
            }

            #generateStatus.genz-status-hidden {
                display:none !important;
                opacity:0;
                transform:translateY(4px);
            }

            #generateStatus.genz-status-processing {
                border-color:
                    rgba(255,255,255,.14);

                box-shadow:
                    0 8px 26px rgba(0,0,0,.22),
                    0 0 18px rgba(255,255,255,.035),
                    inset 0 1px 0 rgba(255,255,255,.07);
            }

            #generateStatus.genz-status-retrying {
                border-color:
                    rgba(255,255,255,.34);

                box-shadow:
                    0 8px 28px rgba(0,0,0,.24),
                    0 0 22px rgba(255,255,255,.10),
                    inset 0 1px 0 rgba(255,255,255,.12);
            }

            #generateStatus.genz-status-success {
                border-color:
                    rgba(34,197,94,.30);

                box-shadow:
                    0 8px 28px rgba(0,0,0,.22),
                    0 0 22px rgba(34,197,94,.10),
                    inset 0 1px 0 rgba(255,255,255,.06);
            }

            #generateStatus.genz-status-failed {
                border-color:
                    rgba(239,68,68,.34);

                box-shadow:
                    0 8px 28px rgba(0,0,0,.22),
                    0 0 22px rgba(239,68,68,.10),
                    inset 0 1px 0 rgba(255,255,255,.05);
            }

            .genz-generate-status-inner {
                position:relative;
                z-index:1;
                display:flex;
                align-items:center;
                gap:9px;
                min-width:0;
            }

            .genz-generate-status-icon {
                width:21px;
                height:21px;
                min-width:21px;
                display:flex;
                align-items:center;
                justify-content:center;
                border-radius:50%;
                box-sizing:border-box;
            }

            .genz-status-spinner {
                display:inline-block;
                flex-shrink:0;
                width:17px;
                height:17px;
                border-radius:50%;
                border:2px solid rgba(255,255,255,.18);
                border-top-color:#fff;
                border-right-color:rgba(255,255,255,.72);
                will-change:transform;
                animation:genzStatusSpin .78s linear infinite;
                -webkit-animation:genzStatusSpin .78s linear infinite;
                box-sizing:border-box;
            }

            .genz-status-success-icon {
                width:21px;
                height:21px;
                border-radius:50%;
                display:flex;
                align-items:center;
                justify-content:center;
                background:rgba(34,197,94,.14);
                border:1px solid rgba(34,197,94,.35);
                color:#4ade80;
                font-size:13px;
                font-weight:800;
                box-shadow:0 0 14px rgba(34,197,94,.14);
            }

            .genz-status-failed-icon {
                width:21px;
                height:21px;
                border-radius:50%;
                display:flex;
                align-items:center;
                justify-content:center;
                background:rgba(239,68,68,.14);
                border:1px solid rgba(239,68,68,.35);
                color:#f87171;
                font-size:12px;
                font-weight:900;
                box-shadow:0 0 14px rgba(239,68,68,.12);
            }

            .genz-generate-status-content {
                min-width:0;
                display:flex;
                flex-direction:column;
                gap:2px;
            }

            .genz-generate-status-title {
                font-size:11px;
                line-height:15px;
                font-weight:800;
                letter-spacing:1.25px;
                white-space:nowrap;
            }

            .genz-generate-status-title.processing {
                color:#fff;
            }

            .genz-generate-status-title.retrying {
                color:#ffffff !important;
            }

            .genz-generate-status-title.success {
                color:#4ade80;
            }

            .genz-generate-status-title.failed {
                color:#ff4d4f;
            }

            .genz-generate-status-message {
                max-width:250px;
                font-size:9.5px;
                line-height:14px;
                font-weight:500;
                color:rgba(255,255,255,.58);
                white-space:normal;
                word-break:break-word;
            }

            .genz-generate-status-message.retrying {
                color:rgba(255,255,255,.88);
            }

            .genz-generate-status-message.success {
                color:rgba(134,239,172,.82);
            }

            .genz-generate-status-message.failed {
                color:#ff4d4f;
                font-weight:700;
            }

            @keyframes genzStatusSpin {
                from {
                    transform:rotate(0deg);
                }
                to {
                    transform:rotate(360deg);
                }
            }

            @keyframes genzStatusShimmer {
                0% {
                    transform:translateX(-120%);
                }

                45%,
                100% {
                    transform:translateX(120%);
                }
            }

            html[data-genz-theme="light"] #generateStatus {
                border-color:#d7e1ee;
                background:linear-gradient(180deg, #ffffff 0%, #f5f8fc 100%);
                box-shadow:0 6px 18px rgba(40,54,82,.08);
            }

            html[data-genz-theme="light"] #generateStatus.genz-status-processing,
            html[data-genz-theme="light"] #generateStatus.genz-status-retrying {
                border-color:#cbd6e6;
                box-shadow:0 8px 20px rgba(40,54,82,.09);
            }

            html[data-genz-theme="light"] #generateStatus .genz-status-spinner {
                border:2px solid rgba(15,24,40,.16);
                border-top-color:#ff3355;
                border-right-color:rgba(255,51,85,.72);
            }

            html[data-genz-theme="light"] #generateStatus .genz-generate-status-title.processing,
            html[data-genz-theme="light"] #generateStatus .genz-generate-status-title.retrying {
                color:#0f1828 !important;
            }

            html[data-genz-theme="light"] #generateStatus .genz-generate-status-title.success {
                color:#0a7a49;
            }

            html[data-genz-theme="light"] #generateStatus .genz-generate-status-title.failed {
                color:#b3261e;
            }

            html[data-genz-theme="light"] #generateStatus .genz-generate-status-message {
                color:#4a566b;
            }

            html[data-genz-theme="light"] #generateStatus .genz-generate-status-message.retrying {
                color:#1e293b;
            }

            html[data-genz-theme="light"] #generateStatus .genz-generate-status-message.success {
                color:#0a7a49;
            }

            html[data-genz-theme="light"] #generateStatus .genz-generate-status-message.failed {
                color:#b3261e;
            }

            @media (max-width:980px) {

                #generateStatus {
                    width:100%;
                    min-width:0;
                    max-width:none;
                    margin-left:0;
                    margin-top:6px;
                }

                .genz-generate-status-message {
                    max-width:none;
                }

            }

            @media (prefers-reduced-motion: reduce) {

                #generateStatus::before {
                    animation:none !important;
                }

                .genz-status-spinner {
                    animation:genzStatusSpin .78s linear infinite !important;
                    -webkit-animation:genzStatusSpin .78s linear infinite !important;
                    animation-duration:.78s !important;
                    animation-iteration-count:infinite !important;
                }

            }
            `;

        document.head.appendChild(
            style
        );

    }

}


/* =========================================================
   SET GENERATE STATUS
========================================================= */

function setGenerateStatus(
    type,
    message = ""
) {

    const status =
        ensureGenerateStatus();

    if (
        !status
    ) {

        return;

    }

    const normalized =
        String(
            type ||
            "idle"
        )
        .trim()
        .toLowerCase();

    status.className =
        "";

    if (
        normalized ===
        "idle"
    ) {

        status.classList.add(
            "genz-status-hidden"
        );

        status.style.display =
            "none";

        status.innerHTML =
            "";

        return;

    }

    status.style.display =
        "flex";

    status.classList.remove(
        "genz-status-hidden"
    );

    let title =
        "";

    let titleClass =
        "";

    let icon =
        "";

    let messageClass =
        "";

    if (
        normalized ===
        "processing"
    ) {

        status.classList.add(
            "genz-status-processing"
        );

        title =
            "PROSES";

        titleClass =
            "processing";

        icon =
            `
            <span
                class="genz-generate-status-icon"
                aria-hidden="true"
            >
                <span
                    class="genz-status-spinner"
                ></span>
            </span>
            `;

    }

    else if (
        normalized ===
            "retrying" ||
        normalized ===
            "mencoba"
    ) {

        status.classList.add(
            "genz-status-processing",
            "genz-status-retrying"
        );

        title =
            "MENCOBA";

        titleClass =
            "retrying";

        message =
            message ||
            "mohon tunggu antrian, sistem sedang padat";

        messageClass =
            "retrying";

        icon =
            `
            <span
                class="genz-generate-status-icon"
                aria-hidden="true"
            >
                <span
                    class="genz-status-spinner"
                ></span>
            </span>
            `;

    }

    else if (
        normalized ===
        "success"
    ) {

        status.classList.add(
            "genz-status-success"
        );

        title =
            "SUCCESS";

        titleClass =
            "success";

        message =
            message ||
            "Check Hasil Generate di History...!!!";

        messageClass =
            "success";

        icon =
            `
            <span
                class="genz-status-success-icon"
                aria-hidden="true"
            >
                ✓
            </span>
            `;

    }

    else if (
        normalized ===
            "cancelled" ||
        normalized ===
            "canceled"
    ) {

        status.classList.add(
            "genz-status-cancelled"
        );

        title =
            "DIBATALKAN";

        titleClass =
            "cancelled";

        message =
            message ||
            "Generate dibatalkan.";

        messageClass =
            "cancelled";

        icon =
            `
            <span
                class="genz-status-cancelled-icon"
                aria-hidden="true"
            >
                ×
            </span>
            `;

    }

    else if (
        normalized ===
            "failed" ||
        normalized ===
            "failure" ||
        normalized ===
            "error"
    ) {

        status.classList.add(
            "genz-status-failed"
        );

        title =
            "[GAGAL]";

        titleClass =
            "failed";

        message =
            message ||
            "Generate gagal diproses.";

        messageClass =
            "failed";

        icon =
            `
            <span
                class="genz-status-failed-icon"
                aria-hidden="true"
            >
                ×
            </span>
            `;

    }

    else {

        status.classList.add(
            "genz-status-processing"
        );

        title =
            "PROSES";

        titleClass =
            "processing";

        icon =
            `
            <span
                class="genz-generate-status-icon"
                aria-hidden="true"
            >
                <span
                    class="genz-status-spinner"
                ></span>
            </span>
            `;

    }

    status.innerHTML =
        `
        <div
            class="genz-generate-status-inner"
        >

            ${icon}

            <div
                class="genz-generate-status-content"
            >

                <div
                    class="genz-generate-status-title ${titleClass}"
                >
                    ${title}
                </div>

                ${
                    message
                        ? `
                            <div
                                class="genz-generate-status-message ${messageClass}"
                            >
                                ${escapeGenerateStatusText(
                                    message
                                )}
                            </div>
                        `
                        : ""
                }

            </div>

        </div>
        `;

}


/* =========================================================
   ESCAPE STATUS MESSAGE
========================================================= */

function escapeGenerateStatusText(
    value
) {

    const text =
        String(
            value ??
            ""
        );

    const div =
        document.createElement(
            "div"
        );

    div.textContent =
        text;

    return div.innerHTML;

}


/* =========================================================
   RESET GENERATE STATUS
========================================================= */

function resetGenerateStatus() {

    setGenerateStatus(
        "idle"
    );

}

/* =========================================================
   ERROR
========================================================= */

function showError(
    message
) {

    const elements =
        getDOM();

    const text =
        String(
            message ||
            "Terjadi kesalahan."
        );

    if (
        elements.pageError
    ) {

        elements.pageError.hidden =
            false;

        elements.pageError.style.display =
            "flex";

        elements.pageError.dataset.error =
            "true";

        const heading =
            elements.pageError.querySelector("h2");

        if (heading) {
            heading.textContent =
                /konfigurasi model|model tidak tersedia/i.test(text)
                    ? "Model tidak tersedia"
                    : "Notifikasi Error";
        }

    }

    if (
        elements.pageErrorMessage
    ) {

        elements.pageErrorMessage.textContent =
            text;

    }

    if (
        elements.status
    ) {

        elements.status.textContent =
            text;

        elements.status.dataset.error =
            "true";

        elements.status.hidden =
            false;

    }

}


/* =========================================================
   HIDE ERROR
========================================================= */

function hideError() {

    const elements =
        getDOM();

    if (
        elements.pageError
    ) {

        elements.pageError.hidden =
            true;

        elements.pageError.style.display =
            "none";

        delete elements.pageError.dataset.error;

    }

    if (
        elements.status &&
        elements.status.dataset?.error === "true"
    ) {

        delete elements.status.dataset.error;

    }

}


/* =========================================================
   LOADING
========================================================= */

function ensureButtonSpinnerElement(
    button
) {

    if (
        !button
    ) {

        return null;

    }

    let spinner =
        button.querySelector(
            "#generateButtonSpinner, .spinner, .btn-spinner, .loading-spinner"
        );

    if (
        !spinner
    ) {

        spinner =
            document.createElement(
                "span"
            );

        spinner.id =
            "generateButtonSpinner";

        spinner.className =
            "spinner";

        spinner.setAttribute(
            "aria-hidden",
            "true"
        );

        spinner.hidden =
            true;

        button.insertBefore(
            spinner,
            button.firstChild
        );

    }

    return spinner;

}


function syncGenerateButtonLoading(
    button,
    active,
    message = ""
) {

    if (
        !button
    ) {

        return;

    }

    const isActive =
        Boolean(
            active
        );

    const spinner =
        ensureButtonSpinnerElement(
            button
        );

    if (
        spinner
    ) {

        spinner.hidden =
            !isActive;

    }

    button.classList.toggle(
        "is-loading",
        isActive
    );

    if (
        isActive
    ) {

        button.setAttribute(
            "aria-busy",
            "true"
        );

    } else {

        button.removeAttribute(
            "aria-busy"
        );

    }

    const label =
        button.querySelector(
            ".generate-button-label"
        ) ||
        button.querySelector(
            ".btn-label"
        ) ||
        button.querySelector(
            ".btn-icon + span:not(.generate-button-credit)"
        );

    if (
        label
    ) {

        if (
            !label.dataset.originalText
        ) {

            label.dataset.originalText =
                (label.textContent || "").trim() ||
                "Generate Video";

        }

        if (
            isActive
        ) {

            label.textContent =
                /memuat\s+model/i.test(
                    String(
                        message || ""
                    )
                )
                    ? "Memuat model..."
                    : "Memproses...";

        } else {

            label.textContent =
                label.dataset.originalText ||
                "Generate Video";

        }

    }

}


function showLoading(
    message = "Memuat..."
) {

    const elements =
        getDOM();

    if (
        elements.loading
    ) {

        elements.loading.hidden =
            false;

        elements.loading.style.display =
            "flex";

        elements.loading.style.visibility =
            "visible";

        elements.loading.style.opacity =
            "1";

        elements.loading.setAttribute(
            "aria-hidden",
            "false"
        );

    }

    syncGenerateButtonLoading(
        elements.generateButton,
        true,
        message
    );

    if (
        elements.status
    ) {

        elements.status.textContent =
            message;

        elements.status.hidden =
            false;

    }

}


/* =========================================================
   HIDE LOADING
========================================================= */

function hideLoading() {

    const elements =
        getDOM();

    if (
        elements.loading
    ) {

        elements.loading.hidden =
            true;

        elements.loading.style.display =
            "none";

        elements.loading.style.visibility =
            "hidden";

        elements.loading.style.opacity =
            "0";

        elements.loading.setAttribute(
            "aria-hidden",
            "true"
        );

    }

    syncGenerateButtonLoading(
        elements.generateButton,
        false
    );

}


/* =========================================================
   LOAD MODULE
========================================================= */

async function loadModule(
    name,
    path,
    required = true
) {

    if (
        appState.modules[name]
    ) {

        return appState.modules[name];

    }

    try {

        const module =
            await import(
                path
            );

        if (
            !module
        ) {

            throw new Error(
                `Module ${name} kosong.`
            );

        }

        appState.modules[name] =
            module;

        return module;

    } catch (
        error
    ) {

        if (
            !required
        ) {

            return null;

        }

        const originalMessage =
            error?.message ||
            String(
                error
            );

        throw new Error(
            `Module ${name} gagal dimuat: ${originalMessage}`
        );

    }

}


/* =========================================================
   LOAD CORE MODULES
========================================================= */

async function loadCoreModules() {

    await loadModule(
        "state",
        STATE_MODULE,
        true
    );

    await loadModule(
        "auth",
        AUTH_MODULE,
        true
    );

    await loadModule(
        "ui",
        UI_MODULE,
        true
    );

    await loadModule(
        "model",
        MODEL_MODULE,
        true
    );

    await loadModule(
        "form",
        FORM_MODULE,
        true
    );
   
   await loadModule(
    "seedance",
    SEEDANCE_MODULE,
    true
   );

   await loadModule(
    "cancellation",
    CANCELLATION_MODULE,
    true
   );

   await loadModule(
    "render",
    RENDER_MODULE,
    true
   );

   await loadModule(
    "submit",
    SUBMIT_MODULE,
    true
   );

    await loadModule(
        "validation",
        VALIDATION_MODULE,
        false
    );

    await loadModule(
        "request",
        REQUEST_MODULE,
        true
    );

    await loadModule(
        "polling",
        POLLING_MODULE,
        true
    );

    const request =
        appState.modules.request;

    if (
        !request ||
        typeof request.generateVideo !==
            "function"
    ) {

        throw new Error(
            "generate-request.js berhasil dimuat tetapi generateVideo() tidak tersedia."
        );

    }

    const polling =
        appState.modules.polling;

    if (
        !polling ||
        typeof polling.pollGenerateTask !==
            "function"
    ) {

        throw new Error(
            "generate-polling.js berhasil dimuat tetapi pollGenerateTask() tidak tersedia."
        );

    }

    return appState.modules;

}


/* =========================================================
   MODEL ID
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


/* =========================================================
   MODEL NAME
========================================================= */

function getModelName(
    model
) {

    return String(

        model?.model_name ||

        model?.name ||

        model?.model?.model_name ||

        model?.model?.name ||

        model?.repository?.model_name ||

        getModelId(
            model
        ) ||

        "Model"

    ).trim();

}


/* =========================================================
   PROVIDER NAME
========================================================= */

function getProviderName(
    model
) {

    if (
        typeof model?.provider ===
        "object"
    ) {

        return String(

            model.provider.provider_name ||

            model.provider.name ||

            "-"

        ).trim();

    }

    if (
        typeof model?.provider ===
        "string"
    ) {

        return String(
            model.provider
        ).trim();

    }

    return String(

        model?.provider_name ||

        model?.providerName ||

        model?.model?.provider_name ||

        model?.repository?.provider_name ||

        "-"

    ).trim();

}


/* =========================================================
   MODEL TYPE
========================================================= */

function getModelType(
    model
) {

    return String(

        model?.type ||

        model?.model_type ||

        model?.modelType ||

        model?.model?.type ||

        model?.model?.model_type ||

        ""

    ).trim();

}


/* =========================================================
   RESOLUTION
========================================================= */

function normalizeResolution(
    value
) {

    let resolution =
        String(
            value ??
            ""
        )
        .trim()
        .toLowerCase();

    if (
        !resolution
    ) {

        return "";

    }

    resolution =
        resolution
            .replace(
                /\s+/g,
                ""
            )
            .replace(
                /p$/i,
                ""
            );

    if (
        resolution ===
            "480"
        ||
        resolution ===
            "480p"
        ||
        resolution ===
            "576"
        ||
        resolution ===
            "576p"
    ) {

        return "480p";

    }

    if (
        resolution ===
            "720"
        ||
        resolution ===
            "720p"
        ||
        resolution ===
            "720phd"
        ||
        resolution ===
            "768"
        ||
        resolution ===
            "768p"
    ) {

        return "720p";

    }

    if (
        resolution ===
            "1080"
        ||
        resolution ===
            "1080p"
        ||
        resolution ===
            "2k"
        ||
        resolution ===
            "1440"
        ||
        resolution ===
            "1440p"
    ) {

        return "1080p";

    }

    return String(
        value ??
        ""
    ).trim();

}


/* =========================================================
   GET SELECTED RESOLUTION
========================================================= */

function getSelectedResolution() {

    const elements =
        getDOM();

    const root =
        elements.generateForm ||
        elements.dynamicFields ||
        document;

    const checkedCandidates = [

        '[name="resolution"]:checked',

        '#resolution input[type="radio"]:checked',

        '#resolution input[type="checkbox"]:checked',

        '[data-parameter="resolution"] input[type="radio"]:checked',

        '[data-parameter="resolution"] input[type="checkbox"]:checked',

        '[data-key="resolution"] input[type="radio"]:checked',

        '[data-key="resolution"] input[type="checkbox"]:checked',

        '[data-resolution]:checked'

    ];

    for (
        const selector
        of checkedCandidates
    ) {

        const element =
            root.querySelector(
                selector
            );

        if (
            element &&
            element.value
        ) {

            const normalized =
                normalizeResolution(
                    element.value
                );

            if (
                normalized
            ) {

                return normalized;

            }

        }

    }

    const selectCandidates = [

        'select[name="resolution"]',

        '#resolution',

        '[data-parameter="resolution"]',

        '[data-key="resolution"]',

        '[data-resolution]'

    ];

    for (
        const selector
        of selectCandidates
    ) {

        const element =
            root.querySelector(
                selector
            );

        if (
            !element
        ) {

            continue;

        }

        const value =
            element.value ||
            element.dataset?.resolution ||
            element.getAttribute(
                "data-resolution"
            );

        const normalized =
            normalizeResolution(
                value
            );

        if (
            normalized
        ) {

            return normalized;

        }

    }

    const controls =
        root.querySelectorAll(
            'input[name="resolution"], select[name="resolution"], [data-resolution]'
        );

    for (
        const control
        of controls
    ) {

        if (
            (
                control.type ===
                "radio" ||
                control.type ===
                "checkbox"
            ) &&
            !control.checked
        ) {

            continue;

        }

        const value =
            control.value ||
            control.dataset?.resolution ||
            control.getAttribute(
                "data-resolution"
            );

        const normalized =
            normalizeResolution(
                value
            );

        if (
            normalized
        ) {

            return normalized;

        }

    }

    return "";

}


/* =========================================================
   MODEL SOURCE OBJECTS
========================================================= */

function getModelSourceObjects(
    model
) {

    if (
        !model ||
        typeof model !==
        "object"
    ) {

        return [];

    }

    const objects = [

        model,

        model.pricing,

        model.credit,

        model.config,

        model.config?.pricing,

        model.model,

        model.model?.pricing,

        model.repository,

        model.repository?.pricing

    ];

    return objects.filter(
        item =>
            item &&
            typeof item ===
            "object"
    );

}


/* =========================================================
   GET BASE CREDIT BY RESOLUTION
========================================================= */

function getModelResolutionBaseCredit(
    model,
    resolution
) {

    const normalized =
        normalizeResolution(
            resolution
        );

    if (
        !normalized
    ) {

        return null;

    }

    const suffix =
        normalized.replace(
            "p",
            ""
        );

    const fieldNames = [

        `credit_${normalized}`,

        `credit${suffix}p`,

        `credit_${suffix}p`,

        `credit_${suffix}`,

        `credit_base_${normalized}`,

        `creditBase${suffix}p`,

        `creditBase_${normalized}`

    ];

    const sources =
        getModelSourceObjects(
            model
        );

    for (
        const source
        of sources
    ) {

        for (
            const field
            of fieldNames
        ) {

            const value =
                source[field];

            if (
                value ===
                    null ||
                value ===
                    undefined ||
                value ===
                    ""
            ) {

                continue;

            }

            const number =
                Number(
                    value
                );

            if (
                Number.isFinite(
                    number
                )
            ) {

                return number;

            }

        }

    }

    return null;

}


/* =========================================================
   GET DISCOUNT
========================================================= */

function getModelDiscountPercent(
    model
) {

    const sources =
        getModelSourceObjects(
            model
        );

    for (
        const source
        of sources
    ) {

        const values = [

            source.discount_percent,

            source.discountPercent,

            source.discount

        ];

        for (
            const value
            of values
        ) {

            if (
                value ===
                    null ||
                value ===
                    undefined ||
                value ===
                    ""
            ) {

                continue;

            }

            const number =
                Number(
                    value
                );

            if (
                Number.isFinite(
                    number
                )
            ) {

                return number;

            }

        }

    }

    return 0;

}


/* =========================================================
   CALCULATE FINAL CREDIT
========================================================= */

function calculateFinalCredit(
    baseCredit,
    discountPercent
) {

    const base =
        Number(
            baseCredit
        );

    if (
        !Number.isFinite(
            base
        )
    ) {

        return null;

    }

    const discount =
        Number(
            discountPercent
        );

    const safeDiscount =
        Number.isFinite(
            discount
        )
            ? Math.min(
                100,
                Math.max(
                    0,
                    discount
                )
            )
            : 0;

    const finalCredit =
        base -
        (
            base *
            safeDiscount /
            100
        );

    if (
        !Number.isFinite(
            finalCredit
        )
    ) {

        return null;

    }

    return Math.round(
        finalCredit *
        100
    ) / 100;

}


/* =========================================================
   GET MODEL CREDIT FOR CURRENT RESOLUTION
========================================================= */

function getModelDefaultResolution(
    model
) {

    if (
        !model ||
        typeof model !==
        "object"
    ) {

        return "";

    }

    const candidates = [

        model.parameters?.resolution?.default,

        model.parameters?.resolution?.default_value,

        model.config?.parameters?.resolution?.default,

        model.repository?.parameters?.resolution?.default,

        model.default_resolution,

        model.defaultResolution,

        model.resolution

    ];

    for (
        const candidate
        of candidates
    ) {

        const normalized =
            normalizeResolution(
                candidate
            );

        if (
            normalized
        ) {

            return normalized;

        }

    }

    /*
     * Fallback aman:
     * 480p adalah resolusi credit terendah
     * yang selalu tersedia di admin model.
     */

    return "480p";

}


function getModelCredit(
    model,
    explicitResolution = ""
) {

    if (
        !model ||
        typeof model !==
        "object"
    ) {

        return null;

    }

    const resolution =
        normalizeResolution(
            explicitResolution ||
            getSelectedResolution() ||
            getModelDefaultResolution(
                model
            )
        );

    if (
        resolution
    ) {

        const baseCredit =
            getModelResolutionBaseCredit(
                model,
                resolution
            );

        if (
            baseCredit !==
                null
        ) {

            const discount =
                getModelDiscountPercent(
                    model
                );

            return calculateFinalCredit(
                baseCredit,
                discount
            );

        }

    }

    const suffix =
        resolution
            ? resolution.replace(
                "p",
                ""
            )
            : "";

    if (
        suffix
    ) {

        const finalFields = [

            `credit_final_${resolution}`,

            `creditFinal${suffix}p`,

            `creditFinal_${resolution}`

        ];

        const sources =
            getModelSourceObjects(
                model
            );

        for (
            const source
            of sources
        ) {

            for (
                const field
                of finalFields
            ) {

                const value =
                    source[field];

                if (
                    value ===
                        null ||
                    value ===
                        undefined ||
                    value ===
                        ""
                ) {

                    continue;

                }

                const number =
                    Number(
                        value
                    );

                if (
                    Number.isFinite(
                        number
                    )
                ) {

                    return number;

                }

            }

        }

    }

    /*
     * Fallback terakhir:
     * coba semua resolusi credit yang tersedia
     * dari setting admin model.
     */

    const fallbackResolutions = [
        "480p",
        "720p",
        "1080p"
    ];

    for (
        const fallbackResolution
        of fallbackResolutions
    ) {

        const baseCredit =
            getModelResolutionBaseCredit(
                model,
                fallbackResolution
            );

        if (
            baseCredit !==
                null
        ) {

            const discount =
                getModelDiscountPercent(
                    model
                );

            return calculateFinalCredit(
                baseCredit,
                discount
            );

        }

    }

    return null;

}


/* =========================================================
   FORMAT CREDIT
========================================================= */

function formatCredit(
    value
) {

    if (
        value ===
            null ||
        value ===
            undefined
    ) {

        return "-- Credit";

    }

    const number =
        Number(
            value
        );

    if (
        !Number.isFinite(
            number
        )
    ) {

        return "-- Credit";

    }

    const formatted =
        new Intl.NumberFormat(
            "id-ID",
            {
                minimumFractionDigits:
                    0,

                maximumFractionDigits:
                    2
            }
        ).format(
            number
        );

    /*
     * Tampilkan label "Credit" agar user jelas
     * bahwa angka ini adalah biaya yang akan
     * memotong saldo credit per generate.
     */

    return `${formatted} Credit`;

}


/* =========================================================
   GET CREDIT DISPLAY ELEMENT
========================================================= */

function getCreditDisplayElement() {

    const elements =
        getDOM();

    if (
        elements.generateCreditValue
    ) {

        return elements.generateCreditValue;

    }

    const directElement =
        document.getElementById(
            "generateCreditValue"
        );

    if (
        directElement
    ) {

        return directElement;

    }

    const candidates = [

        document.querySelector(
            "[data-generate-credit]"
        ),

        document.querySelector(
            "[data-credit-display]"
        ),

        document.querySelector(
            ".generate-button-credit-value"
        )

    ];

    for (
        const element
        of candidates
    ) {

        if (
            element
        ) {

            return element;

        }

    }

    const container =
        elements.generateCreditCost ||
        document.querySelector(
            ".generate-button-credit"
        );

    if (
        container
    ) {

        let valueElement =
            container.querySelector(
                "#generateCreditValue"
            );

        if (
            !valueElement
        ) {

            valueElement =
                document.createElement(
                    "span"
                );

            valueElement.id =
                "generateCreditValue";

            valueElement.className =
                "generate-button-credit-value";

            container.appendChild(
                valueElement
            );

        }

        return valueElement;

    }

    return null;

}


/* =========================================================
   CLEAN LEGACY MODEL CREDIT VALUE
========================================================= */

function cleanLegacyModelCreditValue(
    container,
    canonicalElement,
    formatted
) {

    if (
        !container ||
        !canonicalElement
    ) {

        return;

    }

    if (
        container !==
        canonicalElement
    ) {

        const isActualContainer =
            container.contains(
                canonicalElement
            );

        if (
            !isActualContainer
        ) {

            return;

        }

        Array.from(
            container.childNodes
        ).forEach(
            node => {

                if (
                    node.nodeType !==
                    Node.TEXT_NODE
                ) {

                    return;

                }

                const text =
                    String(
                        node.nodeValue ||
                        ""
                    ).trim();

                if (
                    !text
                ) {

                    return;

                }

                const normalized =
                    text
                        .replace(
                            /credit/gi,
                            ""
                        )
                        .replace(
                            /[:\s]/g,
                            ""
                        );

                if (
                    normalized ===
                    String(
                        formatted
                    ).replace(
                        /[\s,]/g,
                        ""
                    )
                ) {

                    node.nodeValue =
                        "";

                }

            }
        );

    }

}


/* =========================================================
   RENDER MODEL CREDIT
========================================================= */

function renderModelCredit(
    model,
    resolution = ""
) {

    const currentModel =
        model ||
        getCurrentModel();

    const selectedResolution =
        normalizeResolution(
            resolution ||
            getSelectedResolution() ||
            getModelDefaultResolution(
                currentModel
            )
        );

    const credit =
        getModelCredit(
            currentModel,
            selectedResolution
        );

    const formatted =
        formatCredit(
            credit
        );

    const elements =
        getDOM();

    const creditElement =
        getCreditDisplayElement();

    if (
        creditElement
    ) {

        creditElement.dataset.modelCreditCanonical =
            "true";

        creditElement.textContent =
            formatted;

        /*
         * Tooltip agar user paham angka ini
         * adalah biaya yang akan memotong
         * saldo credit setiap generate.
         */

        if (
            credit !==
                null &&
            credit !==
                undefined
        ) {

            creditElement.title =
                `Biaya generate: ${formatted}` +
                (
                    selectedResolution
                        ? ` (${selectedResolution})`
                        : ""
                ) +
                ". Nilai diambil dari pengaturan model di halaman admin.";

            creditElement.setAttribute(
                "aria-label",
                `Biaya generate ${formatted}`
            );

        }

        else {

            creditElement.title =
                "Credit model belum dikonfigurasi di halaman edit model.";

            creditElement.setAttribute(
                "aria-label",
                "Credit belum tersedia"
            );

        }

        creditElement.hidden =
            false;

        creditElement.style.display =
            "";

        creditElement.style.visibility =
            "visible";

        creditElement.style.opacity =
            "1";

        cleanLegacyModelCreditValue(
            elements.generateCreditCost,
            creditElement,
            formatted
        );

    }

    if (
        elements.generateCreditCost
    ) {

        if (
            elements.generateCreditCost !==
                creditElement &&
            !elements.generateCreditCost.contains(
                creditElement
            )
        ) {

            elements.generateCreditCost.hidden =
                true;

            elements.generateCreditCost.style.display =
                "none";

            elements.generateCreditCost.style.visibility =
                "hidden";

            elements.generateCreditCost.style.opacity =
                "0";

            elements.generateCreditCost.removeAttribute(
                "data-model-credit-canonical"
            );

        }

        else {

            elements.generateCreditCost.hidden =
                false;

            elements.generateCreditCost.style.display =
                "";

            elements.generateCreditCost.style.visibility =
                "visible";

            elements.generateCreditCost.style.opacity =
                "1";

        }

    }

    const duplicateValues =
        document.querySelectorAll(
            "#generateCreditValue"
        );

    duplicateValues.forEach(
        element => {

            if (
                element ===
                creditElement
            ) {

                return;

            }

            element.removeAttribute(
                "data-model-credit-canonical"
            );

            element.hidden =
                true;

            element.style.display =
                "none";

            element.style.visibility =
                "hidden";

            element.style.opacity =
                "0";

        }
    );

    const creditContainer =
        document.querySelector(
            ".generate-button-credit"
        );

    if (
        creditContainer
    ) {

        creditContainer.hidden =
            false;

        creditContainer.style.display =
            "";

        creditContainer.style.visibility =
            "visible";

        creditContainer.style.opacity =
            "1";

    }

    return credit;

}


/* =========================================================
   SYNC CREDIT AFTER RESOLUTION CHANGE
========================================================= */

function syncModelCreditForResolution() {

    const model =
        getCurrentModel();

    if (
        !model
    ) {

        return null;

    }

    const resolution =
        getSelectedResolution();

    return renderModelCredit(
        model,
        resolution
    );

}


/* =========================================================
   BIND RESOLUTION EVENT
========================================================= */

function bindResolutionEvent() {

    const form =
        getDOM()
            .generateForm;

    if (
        !form
    ) {

        return;

    }

    if (
        form.dataset.genzResolutionCreditBound ===
        "true"
    ) {

        return;

    }

    form.addEventListener(
        "change",
        event => {

            const target =
                event.target;

            if (
                !target
            ) {

                return;

            }

            const name =
                String(
                    target.name ||
                    ""
                )
                .trim()
                .toLowerCase();

            const parameter =
                String(
                    target.dataset?.parameter ||
                    ""
                )
                .trim()
                .toLowerCase();

            const key =
                String(
                    target.dataset?.key ||
                    ""
                )
                .trim()
                .toLowerCase();

            const resolutionAttribute =
                target.hasAttribute(
                    "data-resolution"
                );

            const id =
                String(
                    target.id ||
                    ""
                )
                .trim()
                .toLowerCase();

            const isResolution =
                name ===
                    "resolution" ||

                parameter ===
                    "resolution" ||

                key ===
                    "resolution" ||

                resolutionAttribute ||

                id ===
                    "resolution";

            if (
                !isResolution
            ) {

                return;

            }

            requestAnimationFrame(
                () => {

                    syncModelCreditForResolution();

                }
            );

        }
    );

    form.dataset.genzResolutionCreditBound =
        "true";

}


/* =========================================================
   RENDER MODEL INFORMATION
========================================================= */

function renderModelInformation(
    model
) {

    const elements =
        getDOM();

    if (
        !model
    ) {

        return;

    }

    if (
        elements.modelName
    ) {

        elements.modelName.textContent =
            getModelName(
                model
            );

    }

    if (
        elements.modelDescription
    ) {

        elements.modelDescription.textContent =
            String(

                model.description ||

                model.model?.description ||

                ""

            );

    }

    if (
        elements.providerName
    ) {

        elements.providerName.textContent =
            getProviderName(
                model
            );

    }

    if (
        elements.modelMeta
    ) {

        const id =
            getModelId(
                model
            );

        const type =
            getModelType(
                model
            );

        elements.modelMeta.textContent =
            type
                ? `${id} • ${type}`
                : id;

    }

}


/* =========================================================
   GET CURRENT MODEL
========================================================= */

function getCurrentModel() {

    const state =
        appState.modules.state;

    if (
        state &&
        typeof state.getCurrentModel ===
        "function"
    ) {

        return (
            state.getCurrentModel() ||
            null
        );

    }

    return null;

}


/* =========================================================
   SET CURRENT MODEL
========================================================= */

function setCurrentModel(
    model
) {

    const state =
        appState.modules.state;

    if (
        !state ||
        typeof state.setCurrentModel !==
        "function"
    ) {

        throw new Error(
            "generate-state.js tidak memiliki setCurrentModel()."
        );

    }

    state.setCurrentModel(
        model
    );

    const verified =
        typeof state.getCurrentModel ===
        "function"

            ? state.getCurrentModel()

            : null;

    if (
        !verified ||
        getModelId(
            verified
        ) !==
        getModelId(
            model
        )
    ) {

        throw new Error(
            "Current model gagal disimpan ke Generate State."
        );

    }

    return verified;

}


/* =========================================================
   MARK MODEL READY
========================================================= */

function markModelReady(
    model
) {

    const state =
        appState.modules.state;

    const modelId =
        getModelId(
            model
        );

    const validModel =
        Boolean(
            model &&
            modelId
        );

    appState.modelReady =
        validModel;

    if (
        state &&
        typeof state.setModelLoaded ===
        "function"
    ) {

        state.setModelLoaded(
            validModel
        );

    }

    return validModel;

}


/* =========================================================
   ENABLE GENERATE
========================================================= */

function enableGenerateButton(
    model = null
) {

    const elements =
        getDOM();

    const currentModel =
        model ||
        getCurrentModel();

    const modelId =
        getModelId(
            currentModel
        );

    const modelReady =
        Boolean(
            currentModel &&
            modelId
        );

    if (
        !modelReady
    ) {

        appState.modelReady =
            false;

        if (
            elements.generateButton
        ) {

            elements.generateButton.disabled =
                true;

            elements.generateButton.removeAttribute(
                "aria-busy"
            );

        }

        return false;

    }

    appState.modelReady =
        true;

    const ui =
        appState.modules.ui;

    if (
        ui &&
        typeof ui.enableGeneration ===
        "function"
    ) {

        try {

            ui.enableGeneration();

        } catch (
            error
        ) {

            /*
             * UI module tidak boleh membuat tombol Generate
             * tetap disabled apabila model sudah valid.
             *
             * generate-app.js adalah sumber keputusan terakhir
             * untuk readiness model.
             */

        }

    }

    /*
     * =====================================================
     * FINAL BUTTON STATE
     * -----------------------------------------------------
     * Jangan bergantung sepenuhnya kepada generate-ui.js.
     * Jika model valid dan mempunyai model_id,
     * tombol harus benar-benar aktif.
     * =====================================================
     */

    if (
        elements.generateButton &&
        modelReady
    ) {

        elements.generateButton.disabled =
            false;

        elements.generateButton.removeAttribute(
            "disabled"
        );

        elements.generateButton.removeAttribute(
            "aria-disabled"
        );

        elements.generateButton.removeAttribute(
            "aria-busy"
        );

        syncGenerateButtonLoading(
            elements.generateButton,
            false
        );

        elements.generateButton.style.pointerEvents =
            "auto";

        elements.generateButton.style.cursor =
            "pointer";

    }

    syncModelCreditForResolution();

    return true;

}


/* =========================================================
   DISABLE GENERATE
========================================================= */

function disableGenerateButton() {

    const elements =
        getDOM();

    appState.modelReady =
        false;

    if (
        elements.generateButton
    ) {

        elements.generateButton.disabled =
            true;

        elements.generateButton.removeAttribute(
            "aria-busy"
        );

    }

    const ui =
        appState.modules.ui;

    if (
        ui &&
        typeof ui.disableGeneration ===
        "function"
    ) {

        try {

            ui.disableGeneration();

        } catch (
            error
        ) {

        }

    }

}


/* =========================================================
   RENDER FORM
========================================================= */

async function renderForm(
    model
) {

    const elements =
        getDOM();

    if (
        !elements.dynamicFields
    ) {

        throw new Error(
            "Element #dynamicFields tidak ditemukan."
        );

    }

    const render =
        appState.modules.render;

    if (
        !render ||
        typeof render.renderModelForm !==
            "function"
    ) {

        throw new Error(
            "generate-render.js tidak tersedia."
        );

    }

    setCurrentModel(
        model
    );

    elements.dynamicFields.innerHTML =
        "";

    await render.renderModelForm(
        model
    );

    elements.dynamicFields.hidden =
        false;

    if (
        elements.generateForm
    ) {

        elements.generateForm.hidden =
            false;

    }

    return true;

}


function applyPendingRegeneration() {

    const regeneration =
        window.GENZRegenerate?.read?.();

    if (!regeneration) {
        return;
    }

    const form =
        appState.modules.form;

    const model =
        getCurrentModel();

    const modelId =
        getModelId(model);

    if (
        !form ||
        !model ||
        modelId !== regeneration.modelId
    ) {
        window.GENZRegenerate?.clear?.();
        showError(
            "Model dari task riwayat tidak tersedia atau tidak aktif. Pilih model lain untuk melanjutkan."
        );
        return;
    }

    const parameters =
        regeneration.parameters || {};

    const targetRegenMode = resolveMainModeForModel(model);
    setActiveMainMode(targetRegenMode);
    if (targetRegenMode === MAIN_MODE_IMAGE) {
        const restoredSubMode = inferSubModeFromRegenerateParameters(parameters);
        setActiveImageSubMode(restoredSubMode);
        syncModeSwitcherUI();
        if (restoredSubMode === IMAGE_SUBMODE_CHARACTER_SHEET) {
            appState.modules.render?.renderModelForm?.(model);
        }
    } else {
        syncModeSwitcherUI();
    }

    const setIfAvailable =
        (name, value) => {

            if (
                value === undefined ||
                value === null ||
                value === "" ||
                !form.getParameterDefinition?.(name, model)
            ) {
                return false;
            }

            return form.setFieldValue(
                name,
                value
            );
        };

    [
        "prompt",
        "voice",
        "style",
        "vocal_mode",
        "target_duration",
        "lyrics",
        "language",
        "character_notes",
        "aspect_ratio",
        "duration",
        "resolution"
    ].forEach(
        name => setIfAvailable(
            name,
            parameters[name]
        )
    );

    if (parameters.character_image_url) {
        setIfAvailable("character_image_url", parameters.character_image_url);
    }
    if (parameters.outfit_image_url) {
        setIfAvailable("outfit_image_url", parameters.outfit_image_url);
    }
    if (parameters.audio_url) {
        setIfAvailable("audio_url", parameters.audio_url);
    }

    const setReference =
        (url, candidates) => {

            if (!url) {
                return;
            }

            for (const name of candidates) {
                if (setIfAvailable(name, url)) {
                    return;
                }
            }
        };

    setReference(
        parameters.image_reference_url,
        [
            "character_image_url",
            "image_urls",
            "image_url",
            "first_frame_url",
            "reference_image_urls"
        ]
    );

    const cleanVideoOrAudioRef = String(parameters.video_reference_url || "").trim();
    const looksLikeAudioRef = /\.(?:mp3|wav|m4a|aac|ogg|opus|flac)(?:[?#]|$)/i.test(cleanVideoOrAudioRef);
    setReference(
        cleanVideoOrAudioRef,
        looksLikeAudioRef
            ? ["audio_url", "audio_urls", "video_urls", "video_url"]
            : ["video_urls", "video_url", "reference_video_urls", "audio_url"]
    );

    if (!window.GENZRegenerate?.clear?.()) {
        showError(
            "Parameter task sudah dimuat, tetapi data regenerate tidak dapat dibersihkan dari sesi browser."
        );
    }
}


/* =========================================================
   RENDER COMPLETE MODEL
========================================================= */

async function renderModel(
    model
) {

    if (
        !model
    ) {

        throw new Error(
            "Current model kosong."
        );

    }

    const modelId =
        getModelId(
            model
        );

    if (
        !modelId
    ) {

        throw new Error(
            "Model tidak memiliki model_id yang valid."
        );

    }

    const verifiedModel =
        setCurrentModel(
            model
        );

    renderModelInformation(
        verifiedModel
    );

    await renderForm(
        verifiedModel
    );

    bindResolutionEvent();

    const ready =
        markModelReady(
            verifiedModel
        );

    if (
        !ready
    ) {

        disableGenerateButton();

        throw new Error(
            "Model belum siap digunakan."
        );

    }

    enableGenerateButton(
        verifiedModel
    );

    syncModelCreditForResolution();

    return verifiedModel;

}


/* =========================================================
   INITIALIZE AUTH
========================================================= */

async function initializeAuth() {

    const auth =
        appState.modules.auth;

    if (
        !auth
    ) {

        throw new Error(
            "Module generate-auth.js tidak tersedia."
        );

    }

    if (
        typeof auth.loadSupabase ===
        "function"
    ) {

        await auth.loadSupabase();

    }

    if (
        typeof auth.ensureFreshToken ===
        "function"
    ) {

        await auth.ensureFreshToken();

    }

    let user =
        null;

    if (
        typeof auth.loadCurrentUser ===
        "function"
    ) {

        try {

            user =
                await auth.loadCurrentUser();

        } catch (
            error
        ) {

            user =
                window.GENZ_CURRENT_USER ||
                window.GENZ_NAVIGATION_USER ||
                null;

            if (
                !user
            ) {

                throw error;

            }

        }

    }

    let profile =
        null;

    if (
        typeof auth.loadProfile ===
        "function"
    ) {

        try {

            profile =
                await auth.loadProfile();

        } catch (
            error
        ) {

            profile =
                window.GENZ_CURRENT_PROFILE ||
                window.GENZ_NAVIGATION_PROFILE ||
                null;

        }

    }

    if (
        !user &&
        typeof auth.ensureAuthenticated ===
        "function"
    ) {

        const result =
            await auth.ensureAuthenticated();

        user =
            result?.user ||
            null;

        profile =
            result?.profile ||
            profile ||
            null;

    }

    appState.authReady =
        Boolean(
            user
        );

    appState.profileReady =
        Boolean(

            profile ||

            window.GENZ_CURRENT_PROFILE ||

            window.GENZ_NAVIGATION_PROFILE

        );

    return {
        user,
        profile
    };

}


/* =========================================================
   INITIALIZE MODEL
========================================================= */

async function initializeModel() {

    const modelModule =
        appState.modules.model;

    if (
        !modelModule
    ) {

        throw new Error(
            "Module generate-model.js tidak tersedia."
        );

    }

    let result =
        null;

    if (
        typeof modelModule.resolveInitialModel ===
        "function"
    ) {

        result =
            await modelModule.resolveInitialModel();

    }

    else {

        if (
            typeof modelModule.loadAvailableModels !==
            "function"
        ) {

            throw new Error(
                "API model configuration tidak tersedia."
            );

        }

        const models =
            await modelModule.loadAvailableModels();

        if (
            !Array.isArray(
                models
            ) ||
            models.length ===
                0
        ) {

            throw new Error(
                "Tidak ada model aktif yang tersedia."
            );

        }

        let selectedId =
            "";

        if (
            typeof modelModule.renderModelSelector ===
            "function"
        ) {

            selectedId =
                modelModule.renderModelSelector(
                    models
                ) ||
                "";

        }

        if (
            !selectedId
        ) {

            selectedId =
                String(
                    getDOM()
                        .modelSelect
                        ?.value ||
                    ""
                ).trim();

        }

        if (
            !selectedId
        ) {

            throw new Error(
                "Tidak ada model yang dapat dipilih."
            );

        }

        let selectedModel =
            null;

        if (
            typeof modelModule.selectModel ===
            "function"
        ) {

            selectedModel =
                await modelModule.selectModel(
                    selectedId
                );

        }

        else if (
            typeof modelModule.loadModelConfig ===
            "function"
        ) {

            selectedModel =
                await modelModule.loadModelConfig(
                    selectedId
                );

        }

        result = {

            model:
                selectedModel,

            models

        };

    }

    let model =
        result?.model ||
        getCurrentModel();

    if (
        !model &&
        result?.model_id
    ) {

        model =
            result;

    }

    if (
        !model
    ) {

        throw new Error(
            "Model berhasil dimuat tetapi currentModel kosong."
        );

    }

    model =
        setCurrentModel(
            model
        );

    const elements =
        getDOM();

    const id =
        getModelId(
            model
        );

    if (
        !id
    ) {

        throw new Error(
            "Model berhasil dimuat tetapi model_id kosong."
        );

    }

    if (
        elements.modelSelect
    ) {

        elements.modelSelect.value =
            id;

    }

    await renderModel(
        model
    );

    if (
        elements.modelSelector
    ) {

        elements.modelSelector.hidden =
            false;

        elements.modelSelector.style.display =
            "";

    }

    if (
        elements.modelSelect
    ) {

        elements.modelSelect.disabled =
            false;

        elements.modelSelect.hidden =
            false;

        elements.modelSelect.style.display =
            "";

    }

    if (
        elements.resetButton
    ) {

        elements.resetButton.disabled =
            false;

    }

    syncModelCreditForResolution();

    enableGenerateButton(
        getCurrentModel()
    );

    return getCurrentModel();

}


/* =========================================================
   MODEL CHANGE
========================================================= */

async function handleModelChange(
    event
) {

    const select =
        event?.target ||
        getDOM().modelSelect;

    const selectedId =
        String(
            select?.value ||
            ""
        ).trim();

    if (
        !selectedId
    ) {

        disableGenerateButton();

        return;

    }

    try {

        hideError();

        disableGenerateButton();

        showLoading(
            "Memuat model..."
        );

        const modelModule =
            appState.modules.model;

        if (
            !modelModule
        ) {

            throw new Error(
                "Module generate-model.js tidak tersedia."
            );

        }

        let model =
            null;

        if (
            typeof modelModule.selectModel ===
            "function"
        ) {

            model =
                await modelModule.selectModel(
                    selectedId
                );

        }

        else if (
            typeof modelModule.loadModelConfig ===
            "function"
        ) {

            model =
                await modelModule.loadModelConfig(
                    selectedId
                );

        }

        if (
            !model
        ) {

            throw new Error(
                "Konfigurasi model kosong."
            );

        }

        model =
            setCurrentModel(
                model
            );

        await renderModel(
            model
        );

        appState.modelReady =
            true;

        syncModeSwitcherUI();

        syncModelCreditForResolution();

        enableGenerateButton(
            model
        );

    } catch (
        error
    ) {

        appState.modelReady =
            false;

        const state =
            appState.modules.state;

        if (
            state &&
            typeof state.setModelLoaded ===
            "function"
        ) {

            state.setModelLoaded(
                false
            );

        }

        showError(
            error?.message ||
            "Model gagal dimuat."
        );

        disableGenerateButton();

    } finally {

        hideLoading();

    }

}


/* =========================================================
   KIE.AI RESPONSE SANITIZER
   ---------------------------------------------------------
   PATCH:
   - Gunakan KIE_SECRET_KEYS module-level
   - Pattern detection diperluas (mg_live_, sk_live_,
     AKIA, ghp_, dst.)
========================================================= */

function sanitizeKieResponse(
    value,
    depth = 0,
    seen = new WeakSet()
) {

    if (
        depth >
        7
    ) {

        return "[MAX_DEPTH]";

    }

    if (
        Array.isArray(
            value
        )
    ) {

        return value.map(
            item =>
                sanitizeKieResponse(
                    item,
                    depth + 1,
                    seen
                )
        );

    }

    if (
        value &&
        typeof value ===
            "object"
    ) {

        if (
            seen.has(
                value
            )
        ) {

            return "[CIRCULAR]";

        }

        seen.add(
            value
        );

        const result =
            {};

        for (
            const [
                key,
                item
            ]
            of Object.entries(
                value
            )
        ) {

            if (
                KIE_SECRET_KEYS.has(
                    key
                )
            ) {

                result[key] =
                    "[REDACTED]";

                continue;

            }

            result[key] =
                sanitizeKieResponse(
                    item,
                    depth + 1,
                    seen
                );

        }

        return result;

    }

    if (
        typeof value ===
            "string"
    ) {

        return value

            /* Bearer token */

            .replace(
                /Bearer\s+[^\s"']+/gi,
                "Bearer [REDACTED]"
            )

            /* OpenAI / generic sk- / sk_ */

            .replace(
                /\bsk_[a-zA-Z0-9_-]{8,}\b/g,
                "[REDACTED]"
            )

            .replace(
                /\bsk-[A-Za-z0-9_-]{8,}\b/g,
                "[REDACTED]"
            )

            /* Stripe live / test */

            .replace(
                /\b(pk|rk)_(live|test)_[a-zA-Z0-9]{8,}\b/gi,
                "[REDACTED]"
            )

            /* KIE.AI live key */

            .replace(
                /\bmg_live_[a-zA-Z0-9]{8,}\b/gi,
                "[REDACTED]"
            )

            /* AWS Access Key ID */

            .replace(
                /\bAKIA[0-9A-Z]{16}\b/g,
                "[REDACTED]"
            )

            /* GitHub token */

            .replace(
                /\bgh[pousr]_[a-zA-Z0-9]{36,}\b/g,
                "[REDACTED]"
            );

    }

    return value;

}


/* =========================================================
   CREATE DIAGNOSTIC PANEL
========================================================= */

function ensureKieDiagnosticPanel() {

    let panel =
        document.getElementById(
            "genzKieDiagnostic"
        );

    if (
        panel
    ) {

        return panel;

    }

    const elements =
        getDOM();

    panel =
        document.createElement(
            "section"
        );

    panel.id =
        "genzKieDiagnostic";

    panel.style.cssText =
        [
            "margin-top:20px",
            "padding:18px",
            "border:1px solid rgba(0,255,255,.25)",
            "border-radius:14px",
            "background:rgba(5,10,20,.96)",
            "color:#eafcff",
            "box-sizing:border-box"
        ].join(";");

    panel.innerHTML =
        `
        <div
            style="
                font-size:11px;
                letter-spacing:1.5px;
                opacity:.7;
            "
        >
            KIE.AI RESPONSE
        </div>

        <div
            id="genzKieSummary"
            style="
                margin-top:8px;
                font-size:14px;
                font-weight:600;
                line-height:1.5;
            "
        >
            Menunggu response...
        </div>

        <pre
            id="genzKieRaw"
            style="
                margin:14px 0 0;
                padding:12px;
                white-space:pre-wrap;
                word-break:break-word;
                max-height:420px;
                overflow:auto;
                font-size:12px;
                line-height:1.5;
                background:rgba(0,0,0,.30);
                border-radius:10px;
            "
        ></pre>

        <div
            id="genzGenerationResult"
            style="
                margin-top:16px;
                display:grid;
                gap:12px;
            "
        ></div>
        `;

    const parent =
        elements.generateCard?.parentElement ||

        elements.generateForm?.parentElement ||

        document.querySelector(
            ".content"
        ) ||

        document.body;

    parent.appendChild(
        panel
    );

    return panel;

}


/* =========================================================
   RENDER KIE RESPONSE
   ---------------------------------------------------------
   DIAGNOSTIC UI DINONAKTIFKAN
   ---------------------------------------------------------
   Data KIE tetap diproses oleh polling dan backend.
   Tetapi response JSON / summary KIE TIDAK ditampilkan
   pada halaman Generate.
   
   Status user-facing ditangani oleh:
   - setGenerateStatus()
========================================================= */

function renderKieDiagnostic(
    response,
    phase = "RESPONSE"
) {

    /*
     * Jangan membuat panel diagnostic baru.
     *
     * Polling tetap berjalan normal karena fungsi ini
     * hanya bertanggung jawab terhadap tampilan diagnostic.
     */

    const panel =
        document.getElementById(
            "genzKieDiagnostic"
        );

    if (
        panel
    ) {

        panel.innerHTML =
            "";

        panel.hidden =
            true;

        panel.style.display =
            "none";

        panel.style.visibility =
            "hidden";

        panel.style.opacity =
            "0";

        panel.setAttribute(
            "aria-hidden",
            "true"
        );

    }

    return null;

}

/* =========================================================
   HIDE LEGACY KIE DIAGNOSTIC UI
========================================================= */

function hideLegacyKieDiagnostic() {

    const panel =
        document.getElementById(
            "genzKieDiagnostic"
        );

    if (
        !panel
    ) {

        return;

    }

    panel.hidden =
        true;

    panel.style.display =
        "none";

    panel.style.visibility =
        "hidden";

    panel.style.opacity =
        "0";

    panel.innerHTML =
        "";

}


/* =========================================================
   RENDER GENERATION RESULT
========================================================= */

function renderGenerationResult(
    result
) {

    const resultUrls =
        Array.isArray(
            result?.resultUrls
        )

            ? result.resultUrls

            : Array.isArray(
                result?.result_urls
            )

                ? result.result_urls

                : Array.isArray(
                    result?.data?.resultUrls
                )

                    ? result.data.resultUrls

                    : Array.isArray(
                        result?.data?.result_urls
                    )

                        ? result.data.result_urls

                        : [];

    const panel =
        ensureKieDiagnosticPanel();

    const resultBox =
        panel.querySelector(
            "#genzGenerationResult"
        );

    if (
        !resultBox
    ) {

        return;

    }

    resultBox.innerHTML =
        "";

    if (
        !resultUrls.length
    ) {

        return;

    }

    for (
        const rawUrl
        of resultUrls
    ) {

        const url =
            String(
                rawUrl ||
                ""
            ).trim();

        if (
            !url
        ) {

            continue;

        }

        const isAudioOutput =
            isAudioModel(getCurrentModel()) ||
            /^data:audio\//i.test(url) ||
            /\.(?:mp3|wav|m4a|aac|ogg|opus|flac)(?:[?#]|$)/i.test(url);

        if (isAudioOutput) {
            const audioEl = document.createElement("audio");
            audioEl.controls = true;
            audioEl.preload = "metadata";
            audioEl.src = url;
            audioEl.style.cssText = "width:100%;max-width:760px;display:block;";
            resultBox.appendChild(audioEl);
            continue;
        }

        if (isTranscribeModel(getCurrentModel()) || /\.json(?:[?#]|$)/i.test(url)) {
            continue;
        }

        const isImgOutput =
            isImageModel(getCurrentModel()) ||
            /^data:image\//i.test(url) ||
            /\.(?:png|jpe?g|webp|gif|avif)(?:[?#]|$)/i.test(url);

        if (isImgOutput) {
            const img = document.createElement("img");
            img.src = url;
            img.alt = "Hasil generate gambar";
            img.style.cssText = [
                "width:100%",
                "max-width:760px",
                "border-radius:12px",
                "display:block",
                "object-fit:contain"
            ].join(";");
            resultBox.appendChild(img);
            continue;
        }

        const video =
            document.createElement(
                "video"
            );

        video.controls =
            true;

        video.playsInline =
            true;

        video.preload =
            "metadata";

        video.style.cssText =
            [
                "width:100%",
                "max-width:760px",
                "border-radius:12px",
                "display:block"
            ].join(";");

        const source =
            document.createElement(
                "source"
            );

        source.src =
            url;

        source.type =
            "video/mp4";

        video.appendChild(
            source
        );

        resultBox.appendChild(
            video
        );

    }

}


/* =========================================================
   EXTRACT TASK ID
========================================================= */

function extractTaskId(
    response
) {

    return String(

        response?.taskId ||

        response?.task_id ||

        response?.jobId ||

        response?.job_id ||

        response?.data?.taskId ||

        response?.data?.task_id ||

        response?.data?.jobId ||

        response?.data?.job_id ||

        response?.task?.taskId ||

        response?.task?.task_id ||

        response?.task?.jobId ||

        response?.task?.job_id ||

        response?.data?.task?.taskId ||

        response?.data?.task?.task_id ||

        response?.data?.task?.jobId ||

        response?.data?.task?.job_id ||

        ""

    ).trim();

}


/* =========================================================
   EXTRACT ERROR DIAGNOSTIC
========================================================= */

function extractErrorDiagnostic(
    error
) {

    if (
        error?.details
    ) {

        return error.details;

    }

    if (
        error?.response
    ) {

        return error.response;

    }

    if (
        error?.data
    ) {

        return error.data;

    }

    return {

        success:
            false,

        code:
            error?.code ||
            "GENERATION_FAILED",

        message:
            error?.message ||
            "Generate gagal."

    };

}


/* =========================================================
   POLLING STATE
   ---------------------------------------------------------
   Perbaikan:
   - Jangan hanya percaya result.completed.
   - Validasi state dari backend juga.
   - Processing tidak boleh dianggap completed.
========================================================= */

function getPollingState(
    value
) {

    return String(

        value?.state ||

        value?.status ||

        value?.task_state ||

        value?.taskStatus ||

        value?.data?.state ||

        value?.data?.status ||

        value?.data?.task_state ||

        value?.data?.taskStatus ||

        value?.task?.state ||

        value?.task?.status ||

        value?.task?.task_state ||

        value?.task?.taskStatus ||

        value?.data?.task?.state ||

        value?.data?.task?.status ||

        value?.data?.task?.task_state ||

        value?.data?.task?.taskStatus ||

        value?.result?.state ||

        value?.result?.status ||

        value?.data?.result?.state ||

        value?.data?.result?.status ||

        ""

    )
        .trim()
        .toLowerCase()
        .replace(
            /\s+/g,
            "_"
        );

}


/* =========================================================
   POLLING COMPLETED CHECK
========================================================= */

function isPollingCompleted(
    value
) {
   if (window.GENZGenerateCancellation?.isGenerateCancelled?.(value)) {
    return false;
}

    if (
        value?.failed === true
    ) {

        return false;

    }

    const state =
        getPollingState(
            value
        );

    if (
        POLLING_FAILED_STATES.has(
            state
        )
    ) {

        return false;

    }

    if (
        POLLING_PROCESSING_STATES.has(
            state
        )
    ) {

        return false;

    }

    if (
        POLLING_COMPLETED_STATES.has(
            state
        )
    ) {

        return true;

    }

    /*
     * Backend polling module sudah melakukan normalisasi.
     * Jika completed=true dan tidak ada indikasi state
     * processing/failed, kita menerima hasil tersebut.
     */

    if (
        value?.completed === true
    ) {

        return true;

    }

    /*
     * Result URL merupakan bukti hasil sudah tersedia.
     */

    const resultUrls =
        Array.isArray(
            value?.resultUrls
        )

            ? value.resultUrls

            : Array.isArray(
                value?.result_urls
            )

                ? value.result_urls

                : Array.isArray(
                    value?.data?.resultUrls
                )

                    ? value.data.resultUrls

                    : Array.isArray(
                        value?.data?.result_urls
                    )

                        ? value.data.result_urls

                        : [];

    if (
        resultUrls.length
    ) {

        return true;

    }

    return false;

}


/* =========================================================
   POLLING FAILED CHECK
========================================================= */

function isPollingFailed(
    value
) {

    /*
     * CANCELLED BUKAN FAILED.
     * Cancellation memiliki status terminal sendiri.
     */

    if (
        window
            .GENZGenerateCancellation
            ?.isGenerateCancelled?.(
                value
            )
    ) {

        return false;

    }


    if (
        value?.failed === true
    ) {

        return true;

    }


    const state =
        getPollingState(
            value
        );


    return POLLING_FAILED_STATES.has(
        state
    );

}

/* =========================================================
   BIND GENERATE SUBMIT
========================================================= */

function bindGenerateSubmitEvent() {

    const form =
        getDOM()
            .generateForm;

    if (
        !form
    ) {

        return;

    }

    if (
        form.dataset.genzGenerateBound ===
        "true"
    ) {

        return;

    }

    const submit =
        appState.modules.submit;

    if (
        !submit ||
        typeof submit.handleGenerateSubmit !==
        "function"
    ) {

        throw new Error(
            "generate-submit.js tidak tersedia."
        );

    }

    form.addEventListener(
        "submit",
        submit.handleGenerateSubmit
    );

    form.dataset.genzGenerateBound =
        "true";

}


/* =========================================================
   BIND MODEL EVENT
========================================================= */

function bindModelEvent() {

    const select =
        getDOM()
            .modelSelect;

    if (
        !select
    ) {

        throw new Error(
            "Element #modelSelect tidak ditemukan."
        );

    }

    if (
        select.dataset.genzModelBound ===
        "true"
    ) {

        return;

    }

    select.addEventListener(
        "change",
        handleModelChange
    );

    select.dataset.genzModelBound =
        "true";

}


/* =========================================================
   BIND RESET
========================================================= */

function bindResetEvent() {

    const button =
        getDOM()
            .resetButton;

    if (
        !button
    ) {

        return;

    }

    if (
        button.dataset.genzResetBound ===
        "true"
    ) {

        return;

    }

    button.addEventListener(
        "click",
        async event => {

            event.preventDefault();

            const form =
                appState.modules.form;

            if (
                !form
            ) {

                return;

            }

            try {

                if (
                    typeof form.reset ===
                    "function"
                ) {

                    await form.reset();

                }

                else if (
                    typeof form.resetDynamicFields ===
                    "function"
                ) {

                    await form.resetDynamicFields(
                        getCurrentModel()
                    );

                }

                const currentModel =
                    getCurrentModel();

                if (
                    currentModel &&
                    getModelId(
                        currentModel
                    )
                ) {

                    syncModelCreditForResolution();

                    enableGenerateButton(
                        currentModel
                    );

                }

            } catch (
                error
            ) {

            }

        }
    );

    button.dataset.genzResetBound =
        "true";

}


/* =========================================================
   VALIDATE DOM
========================================================= */

function validateDOM() {

    const elements =
        getDOM();

    const required = [

        "modelSelector",

        "modelSelect",

        "dynamicFields",

        "generateForm",

        "generateButton"

    ];

    const missing =
        required.filter(
            key =>
                !elements[key]
        );

    if (
        missing.length
    ) {

        throw new Error(
            "DOM Generate tidak lengkap: " +
            missing.join(
                ", "
            )
        );

    }

    return true;

}


/* =========================================================
   INITIAL VISUAL STATE
========================================================= */

function initializeVisualState() {

    disableGenerateButton();

    hideLoading();

    hideError();

    ensureGenerateStatus();
   
    resetGenerateStatus();

    hideLegacyKieDiagnostic();

    const elements =
        getDOM();

    if (
        elements.status
    ) {

        elements.status.hidden =
            true;

        elements.status.textContent =
            "";

    }

}


/* =========================================================
   MODE SWITCHER UI & IMAGE RESULT PREVIEW
========================================================= */

let latestGeneratedImageUrl = "";
let latestGeneratedAudioUrl = "";
let latestGeneratedTranscript = null;

function hideImageResult() {
    const card = document.getElementById("generateImageResultCard");
    if (card) {
        card.hidden = true;
    }
}

function hideAudioResult() {
    const card = document.getElementById("generateAudioResultCard");
    const player = document.getElementById("generateAudioResultPlayer");
    if (player) {
        try {
            player.pause();
        } catch {
            /* ignore */
        }
    }
    if (card) {
        card.hidden = true;
    }
}

function hideTranscribeResult() {
    const card = document.getElementById("generateTranscribeResultCard");
    if (card) {
        card.hidden = true;
    }
}

function extractResultAudioUrl(result) {
    if (!result || typeof result !== "object") return "";
    const directCandidates = [
        result.result_url,
        result.resultUrl,
        result.audio_url,
        result.audioUrl,
        result.data?.result_url,
        result.data?.resultUrl,
        result.data?.audio_url,
        ...(Array.isArray(result.result_urls) ? result.result_urls : []),
        ...(Array.isArray(result.resultUrls) ? result.resultUrls : []),
        ...(Array.isArray(result.data?.result_urls) ? result.data.result_urls : []),
        ...(Array.isArray(result.data?.resultUrls) ? result.data.resultUrls : [])
    ];
    for (const candidate of directCandidates) {
        const clean = String(candidate || "").trim();
        if (/^(?:https?:\/\/|data:audio\/)/i.test(clean)) {
            return clean;
        }
    }
    return "";
}

function renderAudioResult(result, model = getCurrentModel()) {
    const url = extractResultAudioUrl(result);
    if (!url) return;

    const card = document.getElementById("generateAudioResultCard");
    const player = document.getElementById("generateAudioResultPlayer");
    const modelLabel = document.getElementById("generateAudioResultModel");
    const lyricsWrap = document.getElementById("generateAudioResultLyricsWrap");
    const lyricsPre = document.getElementById("generateAudioResultLyrics");
    if (!card || !player) return;

    hideImageResult();
    hideTranscribeResult();

    latestGeneratedAudioUrl = url;
    player.src = url;
    try {
        player.load();
    } catch {
        /* ignore */
    }

    const durSec = result?.duration_seconds ?? result?.data?.duration_seconds ?? null;
    const durSuffix =
        typeof durSec === "number" && Number.isFinite(durSec) && durSec > 0
            ? ` • ${Math.round(durSec)} dtk`
            : "";
    if (modelLabel) {
        modelLabel.textContent = `${getModelName(model) || "Audio AI"}${durSuffix}`;
    }

    const lyricsText = String(
        result?.lyrics ||
        result?.data?.lyrics ||
        result?.result?.lyrics ||
        ""
    ).trim();
    if (lyricsWrap && lyricsPre) {
        if (lyricsText) {
            lyricsPre.textContent = lyricsText;
            lyricsWrap.hidden = false;
        } else {
            lyricsPre.textContent = "";
            lyricsWrap.hidden = true;
        }
    }

    card.hidden = false;
    try {
        card.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch {
        /* ignore */
    }
}

function bindAudioDownloadButton() {
    const btn = document.getElementById("generateAudioDownloadBtn");
    if (!btn || btn.dataset.genzAudioDownloadBound === "true") return;

    btn.addEventListener("click", async () => {
        const url = latestGeneratedAudioUrl || document.getElementById("generateAudioResultPlayer")?.src || "";
        if (!url) return;

        const cleanPath = url.split("?")[0].toLowerCase();
        const fallbackExt = cleanPath.endsWith(".wav") ? "wav" : "mp3";
        const filename = window.GENZGeneratedFileName?.create
            ? window.GENZGeneratedFileName.create(url, fallbackExt)
            : `GEN-Z.AI-${Date.now()}.${fallbackExt}`;

        const originalLabel = btn.textContent;
        btn.disabled = true;
        btn.textContent = "Menyiapkan...";

        try {
            window.GenzToast?.info?.({
                title: "Menyiapkan unduhan audio...",
                message: filename,
                duration: 2800
            });
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const blob = await res.blob();
            const blobUrl = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = blobUrl;
            anchor.download = filename;
            anchor.rel = "noopener";
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            setTimeout(() => URL.revokeObjectURL(blobUrl), 15000);
            window.GenzToast?.success?.({
                title: "Audio berhasil diunduh",
                message: filename,
                duration: 5000
            });
        } catch {
            window.open(url, "_blank", "noopener,noreferrer");
            window.GenzToast?.info?.({
                title: "Audio dibuka di tab baru",
                message: "Simpan audio langsung dari tab yang terbuka.",
                duration: 4500
            });
        } finally {
            btn.disabled = false;
            btn.textContent = originalLabel;
        }
    });

    btn.dataset.genzAudioDownloadBound = "true";
}

async function resolveTranscriptFromResultPayload(result) {
    if (!result || typeof result !== "object") return null;
    const directCandidate =
        result.transcript ||
        result.data?.transcript ||
        result.result?.transcript ||
        null;
    if (directCandidate) {
        const normalized = normalizeTranscriptPayload(directCandidate);
        if (normalized && normalized.text) return normalized;
    }

    const urlCandidates = [
        result.result_url,
        result.resultUrl,
        result.data?.result_url,
        ...(Array.isArray(result.result_urls) ? result.result_urls : []),
        ...(Array.isArray(result.data?.result_urls) ? result.data.result_urls : [])
    ];
    for (const rawUrl of urlCandidates) {
        const cleanUrl = String(rawUrl || "").trim();
        if (!cleanUrl) continue;
        try {
            const resp = await fetch(cleanUrl);
            if (!resp.ok) continue;
            const bodyText = await resp.text();
            const parsed = normalizeTranscriptPayload(bodyText);
            if (parsed && parsed.text) return parsed;
        } catch {
            /* coba kandidat berikutnya */
        }
    }
    return null;
}

async function renderTranscribeResult(result, model = getCurrentModel()) {
    const transcript = await resolveTranscriptFromResultPayload(result);
    if (!transcript || !transcript.text) return;

    const card = document.getElementById("generateTranscribeResultCard");
    const metaEl = document.getElementById("generateTranscribeMeta");
    const textEl = document.getElementById("generateTranscribeText");
    const segWrap = document.getElementById("generateTranscribeSegmentsWrap");
    const segList = document.getElementById("generateTranscribeSegmentsList");
    if (!card || !textEl) return;

    hideImageResult();
    hideAudioResult();

    latestGeneratedTranscript = transcript;
    textEl.textContent = transcript.text;

    const metaParts = [getModelName(model) || "Opus Transcribe"];
    if (transcript.language) {
        metaParts.push(`Bahasa: ${String(transcript.language).toUpperCase()}`);
    }
    if (typeof transcript.durationSeconds === "number" && transcript.durationSeconds > 0) {
        metaParts.push(formatReadableTimestamp(transcript.durationSeconds));
    }
    if (metaEl) {
        metaEl.textContent = metaParts.join(" • ");
    }

    if (segWrap && segList) {
        segList.innerHTML = "";
        const segments = Array.isArray(transcript.segments) ? transcript.segments : [];
        if (segments.length > 0) {
            segments.forEach(seg => {
                const row = document.createElement("div");
                row.className = "generate-transcribe-segment-row";

                const timeSpan = document.createElement("span");
                timeSpan.className = "generate-transcribe-segment-time";
                timeSpan.textContent = `${formatReadableTimestamp(seg.start)} → ${formatReadableTimestamp(seg.end)}`;

                const txtSpan = document.createElement("span");
                txtSpan.className = "generate-transcribe-segment-text";
                txtSpan.textContent = seg.speaker ? `[${seg.speaker}] ${seg.text}` : seg.text;

                row.appendChild(timeSpan);
                row.appendChild(txtSpan);
                segList.appendChild(row);
            });
            segWrap.hidden = false;
        } else {
            segWrap.hidden = true;
        }
    }

    card.hidden = false;
    try {
        card.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch {
        /* ignore */
    }
}

function triggerTextFileDownload(content, ext, mimeType, toastTitle) {
    const cleanContent = String(content || "");
    if (!cleanContent.trim()) return;
    const filename = window.GENZGeneratedFileName?.create
        ? window.GENZGeneratedFileName.create("", ext)
        : `GEN-Z.AI-${Date.now()}.${ext}`;
    const blob = new Blob([cleanContent], { type: `${mimeType};charset=utf-8` });
    const blobUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = blobUrl;
    anchor.download = filename;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 15000);
    window.GenzToast?.success?.({
        title: toastTitle,
        message: filename,
        duration: 4500
    });
}

function bindTranscribeActionButtons() {
    const copyBtn = document.getElementById("generateTranscribeCopyBtn");
    if (copyBtn && copyBtn.dataset.genzTrxCopyBound !== "true") {
        copyBtn.addEventListener("click", async () => {
            const text = latestGeneratedTranscript?.text || document.getElementById("generateTranscribeText")?.textContent || "";
            if (!text.trim()) return;
            try {
                await navigator.clipboard.writeText(text);
                window.GenzToast?.success?.({
                    title: "Teks disalin",
                    message: "Transkrip berhasil disalin ke clipboard.",
                    duration: 3500
                });
            } catch {
                window.GenzToast?.error?.({
                    title: "Gagal menyalin",
                    message: "Silakan blok teks secara manual untuk menyalin.",
                    duration: 3500
                });
            }
        });
        copyBtn.dataset.genzTrxCopyBound = "true";
    }

    const txtBtn = document.getElementById("generateTranscribeDownloadTxtBtn");
    if (txtBtn && txtBtn.dataset.genzTrxTxtBound !== "true") {
        txtBtn.addEventListener("click", () => {
            if (!latestGeneratedTranscript) return;
            triggerTextFileDownload(
                latestGeneratedTranscript.txt || latestGeneratedTranscript.text,
                "txt",
                "text/plain",
                "File .TXT berhasil diunduh"
            );
        });
        txtBtn.dataset.genzTrxTxtBound = "true";
    }

    const srtBtn = document.getElementById("generateTranscribeDownloadSrtBtn");
    if (srtBtn && srtBtn.dataset.genzTrxSrtBound !== "true") {
        srtBtn.addEventListener("click", () => {
            if (!latestGeneratedTranscript) return;
            triggerTextFileDownload(
                latestGeneratedTranscript.srt || latestGeneratedTranscript.text,
                "srt",
                "application/x-subrip",
                "Subtitle .SRT berhasil diunduh"
            );
        });
        srtBtn.dataset.genzTrxSrtBound = "true";
    }
}

function extractResultImageUrl(result) {
    if (!result || typeof result !== "object") return "";
    const directCandidates = [
        result.result_url,
        result.resultUrl,
        result.image_url,
        result.imageUrl,
        result.data?.result_url,
        result.data?.resultUrl,
        ...(Array.isArray(result.result_urls) ? result.result_urls : []),
        ...(Array.isArray(result.resultUrls) ? result.resultUrls : []),
        ...(Array.isArray(result.data?.result_urls) ? result.data.result_urls : []),
        ...(Array.isArray(result.data?.resultUrls) ? result.data.resultUrls : [])
    ];
    for (const candidate of directCandidates) {
        const clean = String(candidate || "").trim();
        if (/^(?:https?:\/\/|data:image\/)/i.test(clean)) {
            return clean;
        }
    }
    return "";
}

function renderImageResult(result, model = getCurrentModel()) {
    const url = extractResultImageUrl(result);
    if (!url) return;

    const card = document.getElementById("generateImageResultCard");
    const img = document.getElementById("generateImageResultImg");
    const modelLabel = document.getElementById("generateImageResultModel");
    if (!card || !img) return;

    latestGeneratedImageUrl = url;
    img.src = url;
    if (modelLabel) {
        modelLabel.textContent = getModelName(model) || "";
    }
    card.hidden = false;

    try {
        card.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch {
        /* ignore */
    }
}

function bindImageDownloadButton() {
    const btn = document.getElementById("generateImageDownloadBtn");
    if (!btn || btn.dataset.genzImgDownloadBound === "true") return;

    btn.addEventListener("click", async () => {
        const url = latestGeneratedImageUrl || document.getElementById("generateImageResultImg")?.src || "";
        if (!url) return;

        const filename = window.GENZGeneratedFileName?.create
            ? window.GENZGeneratedFileName.create(url, "png")
            : `GEN-Z.AI-${Date.now()}.png`;

        const originalLabel = btn.textContent;
        btn.disabled = true;
        btn.textContent = "Menyiapkan...";

        try {
            window.GenzToast?.info?.({
                title: "Menyiapkan unduhan foto...",
                message: filename,
                duration: 2800
            });
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const blob = await res.blob();
            const blobUrl = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = blobUrl;
            anchor.download = filename;
            anchor.rel = "noopener";
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            setTimeout(() => URL.revokeObjectURL(blobUrl), 15000);
            window.GenzToast?.success?.({
                title: "Berhasil diunduh",
                message: filename,
                duration: 5000
            });
        } catch {
            window.open(url, "_blank", "noopener,noreferrer");
            window.GenzToast?.info?.({
                title: "Foto dibuka di tab baru",
                message: "Simpan gambar langsung dari tab yang terbuka.",
                duration: 4500
            });
        } finally {
            btn.disabled = false;
            btn.textContent = originalLabel;
        }
    });

    btn.dataset.genzImgDownloadBound = "true";
}

function syncModeSwitcherUI() {
    const mainMode = getActiveMainMode();
    const subMode = getActiveImageSubMode();
    const isImg = mainMode === MAIN_MODE_IMAGE;
    const isAud = mainMode === MAIN_MODE_AUDIO;
    const isTrx = mainMode === MAIN_MODE_TRANSCRIBE;
    const currentModel = getCurrentModel();
    const currentModelId = getModelId(currentModel);

    document.querySelectorAll("#generateMainModeTabs [data-main-mode]").forEach(btn => {
        const active = btn.getAttribute("data-main-mode") === mainMode;
        btn.classList.toggle("is-active", active);
        btn.setAttribute("aria-selected", active ? "true" : "false");
    });

    const subModeWrap = document.getElementById("generateImageSubModeWrap");
    if (subModeWrap) {
        subModeWrap.hidden = !isImg;
    }

    document.querySelectorAll("#generateImageSubModeWrap [data-image-submode]").forEach(btn => {
        const active = btn.getAttribute("data-image-submode") === subMode;
        btn.classList.toggle("is-active", active);
        btn.setAttribute("aria-selected", active ? "true" : "false");
    });

    const audioSubWrap = document.getElementById("generateAudioSubModeWrap");
    if (audioSubWrap) {
        audioSubWrap.hidden = !isAud;
    }

    document.querySelectorAll("#generateAudioSubModeWrap [data-audio-model-id]").forEach(btn => {
        const active = btn.getAttribute("data-audio-model-id") === currentModelId;
        btn.classList.toggle("is-active", active);
        btn.setAttribute("aria-selected", active ? "true" : "false");
    });

    const lockedBanner = document.getElementById("characterSheetLockedBanner");
    if (lockedBanner) {
        lockedBanner.hidden = !(isImg && subMode === IMAGE_SUBMODE_CHARACTER_SHEET);
    }

    const sectionEyebrow = document.getElementById("generateSectionEyebrow");
    if (sectionEyebrow) {
        sectionEyebrow.textContent = isImg
            ? "GENERATE GAMBAR AI"
            : isAud
                ? "GENERATE AUDIO & MUSIC AI"
                : isTrx
                    ? "TRANSCRIBE AUDIO & SUBTITLE AI"
                    : "GENERATE VIDEO AI";
    }

    const sectionDesc = document.getElementById("generateSectionDescription");
    if (sectionDesc) {
        if (isImg) {
            sectionDesc.textContent =
                subMode === IMAGE_SUBMODE_CHARACTER_SHEET
                    ? "Unggah foto karakter (dan opsional foto outfit) untuk membuat lembar Character Sheet studio multi-sudut secara otomatis."
                    : "Pilih model gambar AI, unggah hingga 8 gambar referensi (opsional), lalu tulis prompt gambar Anda.";
        } else if (isAud) {
            sectionDesc.textContent =
                "Buat Voiceover narator 30 karakter suara, Musik / Lagu AI (Lyria 3.5), atau Sound Effects (SFX) kualitas studio.";
        } else if (isTrx) {
            sectionDesc.textContent =
                "Unggah file Audio (MP3/WAV/M4A/AAC/OGG/FLAC) atau Video (MP4/MOV/WEBM) untuk diubah menjadi teks & file subtitle .SRT bertanda waktu.";
        } else {
            sectionDesc.textContent =
                "Pilih model dan parameter video yang tersedia pada konfigurasi model aktif.";
        }
    }

    const topbarEyebrow = document.querySelector(".topbar-eyebrow");
    if (topbarEyebrow) {
        topbarEyebrow.textContent = isImg
            ? "AI IMAGE & CHARACTER STUDIO"
            : isAud
                ? "AI VOICEOVER, MUSIC & SFX STUDIO"
                : isTrx
                    ? "AI SPEECH-TO-TEXT & SRT STUDIO"
                    : "AI VIDEO GENERATOR";
    }

    const buttonLabel = document.querySelector("#generateButton .generate-button-label");
    if (buttonLabel) {
        if (isImg) {
            buttonLabel.textContent =
                subMode === IMAGE_SUBMODE_CHARACTER_SHEET ? "Generate Karakter Sheet" : "Generate Gambar";
        } else if (isAud) {
            buttonLabel.textContent =
                currentModelId === "opus-audio-music"
                    ? "Generate Musik AI"
                    : currentModelId === "opus-audio-sfx"
                        ? "Generate Sound Effect"
                        : "Generate Voiceover";
        } else if (isTrx) {
            buttonLabel.textContent = "Transcribe Audio";
        } else {
            buttonLabel.textContent = "Generate Video";
        }
    }
}

async function switchMainMode(nextMode) {
    if (appState.modules.submit?.isGenerationInProgress?.()) {
        return;
    }

    const targetMode = setActiveMainMode(nextMode);
    if (targetMode !== MAIN_MODE_IMAGE) {
        hideImageResult();
    }
    if (targetMode !== MAIN_MODE_AUDIO) {
        hideAudioResult();
    }
    if (targetMode !== MAIN_MODE_TRANSCRIBE) {
        hideTranscribeResult();
    }
    syncModeSwitcherUI();
    hideError();

    const modelModule = appState.modules.model;
    const stateModule = appState.modules.state;
    if (!modelModule || !stateModule) return;

    const allModels = stateModule.getAvailableModels?.() || [];
    const selectedId = modelModule.renderModelSelector?.(allModels) || "";

    if (!selectedId) {
        disableGenerateButton();
        const container = getDOM().dynamicFields;
        if (container) {
            const emptyLabel =
                targetMode === MAIN_MODE_IMAGE
                    ? "Belum ada model gambar yang aktif."
                    : targetMode === MAIN_MODE_AUDIO
                        ? "Belum ada model audio yang aktif."
                        : targetMode === MAIN_MODE_TRANSCRIBE
                            ? "Belum ada model transkripsi yang aktif."
                            : "Belum ada model video yang aktif.";
            container.innerHTML = `<div class="generate-empty-parameters">${emptyLabel}</div>`;
        }
        return;
    }

    try {
        disableGenerateButton();
        showLoading("Memuat model...");
        const model = await modelModule.selectModel(selectedId);
        if (model) {
            const normalized = setCurrentModel(model);
            await renderModel(normalized);
            appState.modelReady = true;
            syncModeSwitcherUI();
            syncModelCreditForResolution();
            enableGenerateButton(normalized);
        }
    } catch (err) {
        showError(err?.message || "Gagal memuat model.");
    } finally {
        hideLoading();
    }
}

async function switchAudioModelType(targetModelId) {
    if (appState.modules.submit?.isGenerationInProgress?.()) {
        return;
    }
    const cleanId = String(targetModelId || "").trim();
    if (!cleanId) return;

    const select = getDOM().modelSelect;
    if (select && select.value !== cleanId) {
        const hasOption = Array.from(select.options || []).some(opt => opt.value === cleanId);
        if (hasOption) {
            select.value = cleanId;
            await handleModelChange({ target: select });
            return;
        }
    }
    syncModeSwitcherUI();
}

async function switchImageSubMode(nextSubMode) {
    if (appState.modules.submit?.isGenerationInProgress?.()) {
        return;
    }

    const prevSubMode = getActiveImageSubMode();
    const targetSubMode = setActiveImageSubMode(nextSubMode);
    syncModeSwitcherUI();

    if (prevSubMode === targetSubMode) {
        return;
    }

    const currentModel = getCurrentModel();
    if (!currentModel || !isImageModel(currentModel)) {
        return;
    }

    hideError();
    await renderModel(currentModel);
    syncModelCreditForResolution();
    enableGenerateButton(currentModel);
}

function bindModeSwitcherEvents() {
    const mainTabs = document.getElementById("generateMainModeTabs");
    if (mainTabs && mainTabs.dataset.genzModeBound !== "true") {
        mainTabs.addEventListener("click", event => {
            const btn = event.target?.closest?.("[data-main-mode]");
            if (!btn) return;
            const mode = btn.getAttribute("data-main-mode");
            if (mode && mode !== getActiveMainMode()) {
                switchMainMode(mode);
            }
        });
        mainTabs.dataset.genzModeBound = "true";
    }

    const subModeWrap = document.getElementById("generateImageSubModeWrap");
    if (subModeWrap && subModeWrap.dataset.genzSubModeBound !== "true") {
        subModeWrap.addEventListener("click", event => {
            const btn = event.target?.closest?.("[data-image-submode]");
            if (!btn) return;
            const subMode = btn.getAttribute("data-image-submode");
            if (subMode) {
                switchImageSubMode(subMode);
            }
        });
        subModeWrap.dataset.genzSubModeBound = "true";
    }

    const audioSubWrap = document.getElementById("generateAudioSubModeWrap");
    if (audioSubWrap && audioSubWrap.dataset.genzAudioSubModeBound !== "true") {
        audioSubWrap.addEventListener("click", event => {
            const btn = event.target?.closest?.("[data-audio-model-id]");
            if (!btn) return;
            const targetModelId = btn.getAttribute("data-audio-model-id");
            if (targetModelId) {
                switchAudioModelType(targetModelId);
            }
        });
        audioSubWrap.dataset.genzAudioSubModeBound = "true";
    }
}

/* =========================================================
   BOOTSTRAP
========================================================= */

async function bootstrap() {

    if (
        appState.initialized ||
        appState.initializing
    ) {

        return;

    }

    appState.initializing =
        true;

    initializeVisualState();

    try {

        validateDOM();

        await loadCoreModules();

        const state =
            appState.modules.state;

        if (
            typeof state.initializeGenerateElements ===
            "function"
        ) {

            state.initializeGenerateElements();

        }

        await initializeAuth();

        bindModeSwitcherEvents();

        bindImageDownloadButton();

        bindAudioDownloadButton();

        bindTranscribeActionButtons();

        syncModeSwitcherUI();

        bindModelEvent();

        bindResetEvent();

        bindGenerateSubmitEvent();

        bindResolutionEvent();

        await initializeModel();

        syncModeSwitcherUI();

        applyPendingRegeneration();

        const elements =
            getDOM();

        if (
            elements.dynamicFields
        ) {

            elements.dynamicFields.hidden =
                false;

        }

        if (
            elements.generateForm
        ) {

            elements.generateForm.hidden =
                false;

        }

        const currentModel =
            getCurrentModel();

        if (
            currentModel &&
            getModelId(
                currentModel
            )
        ) {

            markModelReady(
                currentModel
            );

            syncModelCreditForResolution();

            enableGenerateButton(
                currentModel
            );

        }

        else {

            disableGenerateButton();

        }

        appState.initialized =
            true;

    } catch (
        error
    ) {

        appState.modelReady =
            false;

        const state =
            appState.modules.state;

        if (
            state &&
            typeof state.setModelLoaded ===
            "function"
        ) {

            state.setModelLoaded(
                false
            );

        }

        disableGenerateButton();

        showError(
            error?.message ||
            "Generate gagal diinisialisasi."
        );

    } finally {

        appState.initializing =
            false;

        hideLoading();

    }

}


/* =========================================================
   GLOBAL API
   ---------------------------------------------------------
   DIPERBAIKI:
   generate-submit.js menggunakan GENZGenerateApp sebagai
   bridge ke fungsi internal generate-app.js.

   Semua fungsi yang memang sudah tersedia di module ini
   sekarang diekspos ke submit module.

   TIDAK MENGUBAH:
   - navigation
   - authentication
   - model registry
   - provider
   - request endpoint
   - polling
   - cancellation
   - credit calculation
========================================================= */

window.GENZGenerateApp =
    Object.freeze({

        /* =================================================
           APPLICATION
        ================================================= */

        state:
            appState,

        bootstrap,

        getModules:
            () =>
                appState.modules,


        /* =================================================
           MODEL
        ================================================= */

        getCurrentModel,

        getModelId,

        getModelName,

        getProviderName,

        getModelType,

        setCurrentModel,

        markModelReady,

        enableGenerateButton,

        disableGenerateButton,


        /* =================================================
           MODEL CREDIT
        ================================================= */

        getModelCredit,

        getSelectedResolution,

        syncModelCreditForResolution,

        renderModelCredit,

        calculateFinalCredit,

        formatCredit,


        /* =================================================
           UI
        ================================================= */

        showError,

        hideError,

        showLoading,

        hideLoading,

        setGenerateStatus,

        resetGenerateStatus,


        /* =================================================
           DIAGNOSTIC
        ================================================= */

        renderKieDiagnostic,

        hideLegacyKieDiagnostic,

        renderGenerationResult,

        renderImageResult,

        hideImageResult,

        renderAudioResult,

        hideAudioResult,

        renderTranscribeResult,

        hideTranscribeResult,

        switchMainMode,

        switchImageSubMode,

        switchAudioModelType,


        /* =================================================
           TASK
        ================================================= */

        extractTaskId,

        extractErrorDiagnostic,


        /* =================================================
           POLLING
        ================================================= */

        getPollingState,

        isPollingCompleted,

        isPollingFailed

    });


/* =========================================================
   START
========================================================= */

function start() {

    bootstrap()
        .catch(
            error => {

                showError(
                    error?.message ||
                    "Generate gagal diinisialisasi."
                );

            }
        );

}


/* =========================================================
   DOM READY
========================================================= */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        start,
        {
            once:
                true
        }
    );

}

else {

    start();

}
