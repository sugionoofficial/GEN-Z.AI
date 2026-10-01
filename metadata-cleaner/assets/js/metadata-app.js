
// deployment trigger 2026-10-01
/* =========================================================
   GEN-Z.AI
   AI METADATA CLEANER
   ---------------------------------------------------------
   File:
   metadata-cleaner/assets/js/metadata-app.js

   Fungsi:
   - Upload image / video
   - Preview media
   - Read image metadata
   - Read basic video/container metadata
   - Detect AI-related metadata indicators
   - Detect C2PA / Content Credentials
   - Show AI DETECT overlay
   - Clean image metadata locally
   - Clean video metadata locally through FFmpeg WASM
   - Refresh metadata after cleaning
   - Verify cleaned output locally
   - Show cleaned preview
   - Download cleaned copy
   - Original file remains untouched

   IMPORTANT:
   - Cleaning tidak digunakan untuk mengubah pixel
     demi menghindari AI detector.
   - File hasil dibaca ulang setelah cleaning.
   - Metadata UI selalu mengikuti file yang terakhir
     benar-benar dibaca.
   - C2PA / Content Credentials diperiksa langsung
     saat CHECK dan setelah cleaning.

   REFACTOR:
   - CHECK logic berada di metadata-check.js
   - Provenance inspection berada di metadata-check.js
   - Readable error helper berada di metadata-check.js
========================================================= */


import {
    APP,
    state
} from "./metadata-state.js";


import {
    elements,
    cacheElements
} from "./metadata-dom.js";


import {
    bindMetadataEvents
} from "./metadata-events.js";


import {
    checkMetadata,
    inspectFileProvenance,
    getReadableError
} from "./metadata-check.js";


import {
    clearOriginalPreview,
    clearCleanedPreview,
    setPreviewStatus
} from "./metadata-preview.js";


import {
    renderDetectionResult,
    renderMetadata,
    setStatus
} from "./metadata-status.js";


import {
    cleanMetadata
} from "./metadata-clean.js";


import {
    downloadCleanedFile
} from "./metadata-download.js";

import {
    openFilePicker,
    handleFileInput,
    handleDragOver,
    handleDragLeave,
    handleDrop
} from "./metadata-file.js";

import {
    resetForNewFile,
    resetApplication
} from "./metadata-reset.js";
/* =========================================================
   CONSTANTS
========================================================= */

const CLEANING_DURATION =
    10000;


const CLEANING_TICK =
    100;


const CLEANING_STAGES = [

    {
        progress: 8,
        title: "INITIALIZING",
        message:
            "Menyiapkan proses pembersihan..."
    },

    {
        progress: 22,
        title: "ANALYZING",
        message:
            "Menganalisis struktur media..."
    },

    {
        progress: 42,
        title: "CLEANING",
        message:
            "Membersihkan metadata..."
    },

    {
        progress: 64,
        title: "REBUILDING",
        message:
            "Membangun file hasil baru..."
    },

    {
        progress: 82,
        title: "VERIFYING",
        message:
            "Memeriksa ulang file hasil..."
    },

    {
        progress: 94,
        title: "FINALIZING",
        message:
            "Menyiapkan file untuk download..."
    },

    {
        progress: 100,
        title: "READY",
        message:
            "File cleaned siap digunakan."
    }

];


/* =========================================================
   INIT
========================================================= */

function init() {

    cacheElements();


    bindMetadataEvents({

        handleFileInput,

        openFilePicker,

        checkMetadata,

        cleanMetadata,

        downloadCleanedFile,

        handleDragOver,

        handleDragLeave,

        handleDrop

    });


    injectPremiumCleaningStyles();


    resetApplication();


    console.info(
        "[GEN-Z.AI] AI Metadata Cleaner initialized."
    );
}

/* =========================================================
   PREMIUM LOADER CSS
========================================================= */

function injectPremiumCleaningStyles() {

    if (
        document.getElementById(
            "genzMetadataCleaningStyles"
        )
    ) {

        return;
    }


    const style =
        document.createElement(
            "style"
        );


    style.id =
        "genzMetadataCleaningStyles";


    style.textContent = `

        .genz-metadata-cleaning-loader {

            position: fixed;

            inset: 0;

            z-index: 2147483000;

            display: flex;

            align-items: center;

            justify-content: center;

            padding: 24px;

            background:
                radial-gradient(
                    circle at center,
                    rgba(255, 25, 65, 0.13),
                    rgba(0, 0, 0, 0.88) 42%,
                    rgba(0, 0, 0, 0.97)
                );

            backdrop-filter:
                blur(18px);

            -webkit-backdrop-filter:
                blur(18px);

            opacity: 0;

            visibility: hidden;

            pointer-events: none;

            transition:
                opacity 220ms ease,
                visibility 220ms ease;
        }


        .genz-metadata-cleaning-loader.is-visible {

            opacity: 1;

            visibility: visible;

            pointer-events: auto;
        }


        .genz-clean-loader-panel {

            position: relative;

            width:
                min(460px, 94vw);

            padding:
                34px 32px 30px;

            border:
                1px solid
                rgba(255, 45, 80, 0.55);

            border-radius:
                24px;

            background:
                linear-gradient(
                    145deg,
                    rgba(22, 22, 28, 0.97),
                    rgba(5, 5, 9, 0.98)
                );

            box-shadow:
                0 0 0 1px
                rgba(255, 45, 80, 0.08),

                0 0 32px
                rgba(255, 20, 55, 0.20),

                0 0 90px
                rgba(255, 20, 55, 0.10);

            overflow:
                hidden;

            text-align:
                center;
        }


        .genz-clean-loader-panel::before {

            content:
                "";

            position:
                absolute;

            top:
                0;

            left:
                8%;

            right:
                8%;

            height:
                1px;

            background:
                linear-gradient(
                    90deg,
                    transparent,
                    rgba(255, 60, 90, 0.95),
                    transparent
                );

            box-shadow:
                0 0 18px
                rgba(255, 40, 75, 0.65);
        }


        .genz-clean-loader-orbit {

            position:
                relative;

            width:
                86px;

            height:
                86px;

            margin:
                0 auto 20px;

            border:
                1px solid
                rgba(255, 50, 80, 0.32);

            border-radius:
                50%;

            animation:
                genzCleanOrbit 3s
                linear infinite;
        }


        .genz-clean-loader-orbit::before,
        .genz-clean-loader-orbit::after {

            content:
                "";

            position:
                absolute;

            inset:
                8px;

            border:
                1px solid
                rgba(255, 80, 100, 0.20);

            border-radius:
                50%;
        }


        .genz-clean-loader-orbit::after {

            inset:
                -8px;

            border:
                1px dashed
                rgba(255, 40, 70, 0.25);
        }


        .genz-clean-loader-core {

            position:
                absolute;

            inset:
                18px;

            display:
                flex;

            align-items:
                center;

            justify-content:
                center;

            border:
                1px solid
                rgba(255, 70, 95, 0.72);

            border-radius:
                50%;

            background:
                radial-gradient(
                    circle,
                    rgba(255, 40, 75, 0.24),
                    rgba(0, 0, 0, 0.72)
                );

            box-shadow:
                inset 0 0 18px
                rgba(255, 40, 70, 0.16),

                0 0 22px
                rgba(255, 30, 65, 0.22);

            animation:
                genzCleanPulse 1.6s
                ease-in-out infinite;
        }


        .genz-clean-loader-core span {

            color:
                rgba(255, 255, 255, 0.94);

            font:
                800 12px
                Arial,
                sans-serif;

            letter-spacing:
                2px;
        }


        .genz-clean-loader-brand {

            color:
                rgba(255, 65, 90, 0.96);

            font:
                800 11px
                Arial,
                sans-serif;

            letter-spacing:
                4px;

            margin-bottom:
                8px;

            text-shadow:
                0 0 12px
                rgba(255, 40, 70, 0.45);
        }


        .genz-clean-loader-title {

            color:
                rgba(255, 255, 255, 0.96);

            font:
                800 20px
                Arial,
                sans-serif;

            letter-spacing:
                2px;
        }


        .genz-clean-loader-stage {

            margin-top:
                14px;

            color:
                rgba(255, 70, 95, 0.98);

            font:
                800 11px
                Arial,
                sans-serif;

            letter-spacing:
                2.5px;
        }


        .genz-clean-loader-message {

            min-height:
                20px;

            margin-top:
                7px;

            color:
                rgba(255, 255, 255, 0.55);

            font:
                500 12px
                Arial,
                sans-serif;
        }


        .genz-clean-loader-progress {

            position:
                relative;

            width:
                100%;

            height:
                7px;

            margin-top:
                24px;

            overflow:
                hidden;

            border:
                1px solid
                rgba(255, 50, 80, 0.22);

            border-radius:
                999px;

            background:
                rgba(255, 255, 255, 0.055);
        }


        .genz-clean-loader-progress-bar {

            width:
                0%;

            height:
                100%;

            border-radius:
                inherit;

            background:
                linear-gradient(
                    90deg,
                    rgba(255, 25, 60, 0.82),
                    rgba(255, 80, 100, 1)
                );

            box-shadow:
                0 0 14px
                rgba(255, 35, 70, 0.65);

            transition:
                width 120ms linear;
        }


        .genz-clean-loader-footer {

            display:
                flex;

            align-items:
                center;

            justify-content:
                space-between;

            margin-top:
                12px;

            color:
                rgba(255, 255, 255, 0.30);

            font:
                700 9px
                Arial,
                sans-serif;

            letter-spacing:
                1.4px;
        }


        .genz-clean-loader-footer strong {

            color:
                rgba(255, 255, 255, 0.82);

            font-size:
                10px;
        }


        @keyframes genzCleanOrbit {

            from {

                transform:
                    rotate(0deg);
            }

            to {

                transform:
                    rotate(360deg);
            }
        }


        @keyframes genzCleanPulse {

            0%,
            100% {

                transform:
                    scale(0.94);

                box-shadow:
                    inset 0 0 18px
                    rgba(255, 40, 70, 0.12),

                    0 0 16px
                    rgba(255, 30, 65, 0.16);
            }

            50% {

                transform:
                    scale(1.04);

                box-shadow:
                    inset 0 0 22px
                    rgba(255, 40, 70, 0.22),

                    0 0 30px
                    rgba(255, 30, 65, 0.30);
            }
        }


        @media (max-width: 640px) {

            .genz-clean-loader-panel {

                padding:
                    28px 22px 24px;

                border-radius:
                    20px;
            }


            .genz-clean-loader-title {

                font-size:
                    17px;
            }
        }

    `;


    document.head.appendChild(
        style
    );
}

/* =========================================================
   PUBLIC APP
========================================================= */

window.GENZMetadataCleaner =
    Object.freeze({

        getState() {

            return {

                file:
                    state.file,

                fileType:
                    state.fileType,

                metadata:
                    [
                        ...(
                            state.metadata || []
                        )
                    ],

                aiIndicators:
                    [
                        ...(
                            state.aiIndicators || []
                        )
                    ],

                provenance:
                    state.provenance ||
                    null,

                checked:
                    state.checked,

                cleaned:
                    Boolean(
                        state.cleanedBlob
                    ),

                cleanedFile:
                    state.cleanedFile ||
                    null
            };
        },


        reset() {

            resetApplication();
        }

    });


/* =========================================================
   START
========================================================= */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        init,
        {
            once: true
        }
    );

} else {

    init();
}

/* =========================================================
   GEN-Z.AI
   METADATA CLEANER DEPLOY DIAGNOSTIC
   ---------------------------------------------------------
   Tujuan:
   - Memastikan module benar-benar loaded
   - Memastikan tombol CLEAN terdeteksi
   - Memastikan event CLEAN terpancing
   - Menangkap error global
   - Menangkap unhandled Promise rejection
========================================================= */

(function initMetadataDeployDiagnostic() {

    console.log(
        "%c[GEN-Z.AI][METADATA] DEPLOY DIAGNOSTIC ACTIVE",
        "font-weight:bold;font-size:14px;"
    );

    console.log(
        "[GEN-Z.AI][METADATA] URL:",
        window.location.href
    );

    console.log(
        "[GEN-Z.AI][METADATA] metadata-app.js loaded:",
        true
    );


    /* =====================================================
       CHECK DOM
    ===================================================== */

    const cleanButton =
        document.getElementById(
            "metadata-clean-button"
        );

    const checkButton =
        document.getElementById(
            "metadata-check-button"
        );

    const fileInput =
        document.getElementById(
            "metadata-file-input"
        );


    console.log(
        "[GEN-Z.AI][METADATA] DOM CHECK:",
        {
            cleanButton: !!cleanButton,
            checkButton: !!checkButton,
            fileInput: !!fileInput
        }
    );


    /* =====================================================
       CLEAN BUTTON PROBE
    ===================================================== */

    if (
        cleanButton
    ) {

        cleanButton.addEventListener(
            "click",
            function metadataCleanProbe() {

                console.log(
                    "%c[GEN-Z.AI][METADATA] CLEAN BUTTON CLICK TERDETEKSI",
                    "font-weight:bold;"
                );

                console.log(
                    "[GEN-Z.AI][METADATA] state:",
                    window.GENZMetadataCleaner
                        ?.state
                );

            },
            true
        );

    } else {

        console.error(
            "[GEN-Z.AI][METADATA] CLEAN BUTTON TIDAK DITEMUKAN!"
        );

    }


    /* =====================================================
       CHECK BUTTON PROBE
    ===================================================== */

    if (
        checkButton
    ) {

        checkButton.addEventListener(
            "click",
            function metadataCheckProbe() {

                console.log(
                    "[GEN-Z.AI][METADATA] CHECK BUTTON CLICK TERDETEKSI"
                );

            },
            true
        );

    }


    /* =====================================================
       FILE INPUT PROBE
    ===================================================== */

    if (
        fileInput
    ) {

        fileInput.addEventListener(
            "change",
            function metadataFileProbe(
                event
            ) {

                const file =
                    event.target
                        ?.files
                        ?.[
                            0
                        ];


                console.log(
                    "[GEN-Z.AI][METADATA] FILE INPUT TERDETEKSI:",
                    {
                        name:
                            file?.name ||
                            null,

                        type:
                            file?.type ||
                            null,

                        size:
                            file?.size ||
                            0
                    }
                );

            },
            true
        );

    }


    /* =====================================================
       GLOBAL ERROR TRAP
    ===================================================== */

    window.addEventListener(
        "error",
        function metadataGlobalError(
            event
        ) {

            console.error(
                "%c[GEN-Z.AI][METADATA] GLOBAL ERROR",
                "font-weight:bold;color:red;",
                {
                    message:
                        event.message,

                    filename:
                        event.filename,

                    line:
                        event.lineno,

                    column:
                        event.colno,

                    error:
                        event.error
                }
            );

        }
    );


    /* =====================================================
       PROMISE ERROR TRAP
    ===================================================== */

    window.addEventListener(
        "unhandledrejection",
        function metadataUnhandledRejection(
            event
        ) {

            console.error(
                "%c[GEN-Z.AI][METADATA] UNHANDLED PROMISE ERROR",
                "font-weight:bold;color:red;",
                event.reason
            );

        }
    );


    /* =====================================================
       MODULE READY MARKER
    ===================================================== */

    window.__GENZ_METADATA_DEPLOY_DIAGNOSTIC__ =
        true;


})();
