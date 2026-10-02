// deployment trigger 2026-10-02

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

   LOADING:
   - CHECK minimum duration: 10 detik
   - CLEAN minimum duration: 10 detik
   - Loader menunggu proses asli selesai
   - Loader tidak memotong proses yang sedang berjalan
   - Error tetap menghentikan loader
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


/*
   CHECK dan CLEAN sama-sama memiliki
   minimum loading duration 10 detik.
*/

const CHECKING_DURATION =
    10000;


const CLEANING_DURATION =
    10000;


const CLEANING_TICK =
    100;


/*
   Stage visual CLEAN.
   Stage ini hanya mengatur tampilan loader.
   Tidak mengubah proses cleaning sebenarnya.
*/

const CLEANING_STAGES = [

    {
        progress: 8,

        title:
            "INITIALIZING",

        message:
            "Menyiapkan proses pembersihan..."
    },

    {
        progress: 22,

        title:
            "ANALYZING",

        message:
            "Menganalisis struktur media..."
    },

    {
        progress: 42,

        title:
            "CLEANING",

        message:
            "Membersihkan metadata..."
    },

    {
        progress: 64,

        title:
            "REBUILDING",

        message:
            "Membangun file hasil baru..."
    },

    {
        progress: 82,

        title:
            "VERIFYING",

        message:
            "Memeriksa ulang file hasil..."
    },

    {
        progress: 94,

        title:
            "FINALIZING",

        message:
            "Menyiapkan file untuk download..."
    },

    {
        progress: 100,

        title:
            "READY",

        message:
            "File cleaned siap digunakan."
    }

];


/* =========================================================
   LOADING STATE
========================================================= */

let metadataLoader =
    null;


let metadataLoaderTimer =
    null;


let metadataLoaderStartedAt =
    0;


let metadataLoaderMode =
    null;


let metadataLoaderRunning =
    false;


/* =========================================================
   LOADER DOM
========================================================= */

function ensureMetadataLoader() {

    if (
        metadataLoader &&
        document.body.contains(
            metadataLoader
        )
    ) {

        return metadataLoader;
    }


    const loader =
        document.createElement(
            "div"
        );


    loader.id =
        "genzMetadataCleaningLoader";


    loader.className =
        "genz-metadata-cleaning-loader";


    loader.setAttribute(
        "aria-hidden",
        "true"
    );


    loader.innerHTML = `

        <div
            class="genz-clean-loader-panel"
            role="status"
            aria-live="polite"
        >

            <div
                class="genz-clean-loader-orbit"
            >

                <div
                    class="genz-clean-loader-core"
                >

                    <span>
                        AI
                    </span>

                </div>

            </div>


            <div
                class="genz-clean-loader-brand"
            >
                GEN-Z.AI
            </div>


            <div
                class="genz-clean-loader-title"
                data-metadata-loader-title
            >
                PROCESSING
            </div>


            <div
                class="genz-clean-loader-stage"
                data-metadata-loader-stage
            >
                INITIALIZING
            </div>


            <div
                class="genz-clean-loader-message"
                data-metadata-loader-message
            >
                Menyiapkan proses...
            </div>


            <div
                class="genz-clean-loader-progress"
            >

                <div
                    class="genz-clean-loader-progress-bar"
                    data-metadata-loader-progress
                ></div>

            </div>


            <div
                class="genz-clean-loader-footer"
            >

                <span>
                    METADATA PROCESSING
                </span>

                <strong
                    data-metadata-loader-percent
                >
                    0%
                </strong>

            </div>

        </div>

    `;


    document.body.appendChild(
        loader
    );


    metadataLoader =
        loader;


    return loader;
}


/* =========================================================
   LOADER ELEMENTS
========================================================= */

function getMetadataLoaderElements() {

    const loader =
        ensureMetadataLoader();


    return {

        loader,

        title:
            loader.querySelector(
                "[data-metadata-loader-title]"
            ),

        stage:
            loader.querySelector(
                "[data-metadata-loader-stage]"
            ),

        message:
            loader.querySelector(
                "[data-metadata-loader-message]"
            ),

        progress:
            loader.querySelector(
                "[data-metadata-loader-progress]"
            ),

        percent:
            loader.querySelector(
                "[data-metadata-loader-percent]"
            )

    };
}


/* =========================================================
   LOADER PROGRESS
========================================================= */

function setMetadataLoaderProgress(
    progress
) {

    const {

        progress:
            progressBar,

        percent

    } =
        getMetadataLoaderElements();


    const safeProgress =
        Math.max(
            0,
            Math.min(
                100,
                Number(
                    progress
                ) || 0
            )
        );


    if (
        progressBar
    ) {

        progressBar.style.width =
            `${safeProgress}%`;
    }


    if (
        percent
    ) {

        percent.textContent =
            `${Math.round(
                safeProgress
            )}%`;
    }
}


/* =========================================================
   LOADER CONTENT
========================================================= */

function setMetadataLoaderContent(
    options = {}
) {

    const {

        title =
            "PROCESSING",

        stage =
            "INITIALIZING",

        message =
            "Menyiapkan proses...",

        progress =
            0

    } =
        options;


    const {

        title:
            titleElement,

        stage:
            stageElement,

        message:
            messageElement

    } =
        getMetadataLoaderElements();


    if (
        titleElement
    ) {

        titleElement.textContent =
            title;
    }


    if (
        stageElement
    ) {

        stageElement.textContent =
            stage;
    }


    if (
        messageElement
    ) {

        messageElement.textContent =
            message;
    }


    setMetadataLoaderProgress(
        progress
    );
}


/* =========================================================
   CLEANING STAGE
========================================================= */

function getCleaningStage(
    elapsed
) {

    const ratio =
        CLEANING_DURATION > 0
            ? elapsed /
              CLEANING_DURATION
            : 0;


    const clampedRatio =
        Math.max(
            0,
            Math.min(
                0.94,
                ratio * 0.94
            )
        );


    const simulatedProgress =
        Math.round(
            clampedRatio * 100
        );


    let currentStage =
        CLEANING_STAGES[0];


    for (
        const stage
        of CLEANING_STAGES
    ) {

        if (
            simulatedProgress >=
            stage.progress
        ) {

            currentStage =
                stage;
        }
    }


    return {

        ...currentStage,

        progress:
            Math.min(
                94,
                Math.max(
                    8,
                    simulatedProgress
                )
            )

    };
}


/* =========================================================
   CHECKING STAGE
========================================================= */

function getCheckStage(
    elapsed
) {

    /*
       CHECK berlangsung minimal 10 detik.

       Progress dibuat bertahap dan tidak pernah
       mencapai 100% sebelum proses asli selesai.
    */

    if (
        elapsed < 1000
    ) {

        return {

            progress:
                8,

            stage:
                "INITIALIZING",

            message:
                "Menyiapkan pemeriksaan file..."

        };
    }


    if (
        elapsed < 2500
    ) {

        return {

            progress:
                20,

            stage:
                "READING",

            message:
                "Membaca struktur dan metadata media..."

        };
    }


    if (
        elapsed < 4500
    ) {

        return {

            progress:
                35,

            stage:
                "ANALYZING",

            message:
                "Menganalisis indikator metadata..."

        };
    }


    if (
        elapsed < 6500
    ) {

        return {

            progress:
                52,

            stage:
                "AI INDICATORS",

            message:
                "Memeriksa indikator metadata terkait AI..."

        };
    }


    if (
        elapsed < 8000
    ) {

        return {

            progress:
                68,

            stage:
                "PROVENANCE",

            message:
                "Memeriksa C2PA / Content Credentials..."

        };
    }


    if (
        elapsed < 9000
    ) {

        return {

            progress:
                82,

            stage:
                "VERIFYING",

            message:
                "Memverifikasi hasil pemeriksaan..."

        };
    }


    return {

        progress:
            94,

        stage:
            "FINALIZING",

        message:
            "Menyelesaikan pemeriksaan metadata..."

    };
}


/* =========================================================
   START LOADER
========================================================= */

function startMetadataLoader(
    mode = "clean"
) {

    const loader =
        ensureMetadataLoader();


    metadataLoaderMode =
        mode;


    metadataLoaderRunning =
        true;


    metadataLoaderStartedAt =
        Date.now();


    if (
        metadataLoaderTimer
    ) {

        clearInterval(
            metadataLoaderTimer
        );


        metadataLoaderTimer =
            null;
    }


    loader.classList.add(
        "is-visible"
    );


    loader.setAttribute(
        "aria-hidden",
        "false"
    );


    if (
        mode === "check"
    ) {

        setMetadataLoaderContent({

            title:
                "CHECKING METADATA",

            stage:
                "INITIALIZING",

            message:
                "Menyiapkan pemeriksaan file...",

            progress:
                8

        });

    } else {

        setMetadataLoaderContent({

            title:
                "CLEANING METADATA",

            stage:
                "INITIALIZING",

            message:
                "Menyiapkan proses pembersihan...",

            progress:
                8

        });
    }


    metadataLoaderTimer =
        window.setInterval(
            function metadataLoaderTick() {

                if (
                    !metadataLoaderRunning
                ) {

                    return;
                }


                const elapsed =
                    Date.now() -
                    metadataLoaderStartedAt;


                /*
                   ================================
                   CHECK
                   ================================
                */

                if (
                    metadataLoaderMode ===
                    "check"
                ) {

                    const checkStage =
                        getCheckStage(
                            elapsed
                        );


                    setMetadataLoaderContent({

                        title:
                            "CHECKING METADATA",

                        stage:
                            checkStage.stage,

                        message:
                            checkStage.message,

                        progress:
                            checkStage.progress

                    });


                    return;
                }


                /*
                   ================================
                   CLEAN
                   ================================
                */

                const cleaningStage =
                    getCleaningStage(
                        elapsed
                    );


                setMetadataLoaderContent({

                    title:
                        "CLEANING METADATA",

                    stage:
                        cleaningStage.title,

                    message:
                        cleaningStage.message,

                    progress:
                        cleaningStage.progress

                });

            },
            CLEANING_TICK
        );
}


/* =========================================================
   STOP LOADER
========================================================= */

function stopMetadataLoader(
    success = true,
    options = {}
) {

    const {

        title,
        message

    } =
        options;


    metadataLoaderRunning =
        false;


    if (
        metadataLoaderTimer
    ) {

        clearInterval(
            metadataLoaderTimer
        );


        metadataLoaderTimer =
            null;
    }


    const {

        loader

    } =
        getMetadataLoaderElements();


    if (
        success
    ) {

        setMetadataLoaderContent({

            title:
                title ||
                (
                    metadataLoaderMode ===
                    "check"
                        ? "CHECK COMPLETE"
                        : "CLEANING COMPLETE"
                ),

            stage:
                "READY",

            message:
                message ||
                (
                    metadataLoaderMode ===
                    "check"
                        ? "Pemeriksaan metadata selesai."
                        : "File cleaned siap digunakan."
                ),

            progress:
                100

        });

    } else {

        setMetadataLoaderContent({

            title:
                title ||
                "PROCESS FAILED",

            stage:
                "ERROR",

            message:
                message ||
                "Proses tidak dapat diselesaikan.",

            progress:
                100

        });
    }


    window.setTimeout(
        function hideMetadataLoader() {

            if (
                loader
            ) {

                loader.classList.remove(
                    "is-visible"
                );


                loader.setAttribute(
                    "aria-hidden",
                    "true"
                );
            }


            metadataLoaderMode =
                null;

        },
        success
            ? 420
            : 700
    );
}


/* =========================================================
   WAIT FOR MINIMUM DURATION
========================================================= */

async function waitForMinimumLoaderDuration(
    startedAt,
    minimumDuration
) {

    const elapsed =
        Date.now() -
        startedAt;


    const remaining =
        Math.max(
            0,
            minimumDuration -
            elapsed
        );


    if (
        remaining <= 0
    ) {

        return;
    }


    await new Promise(
        resolve => {

            window.setTimeout(
                resolve,
                remaining
            );

        }
    );
}


/* =========================================================
   READABLE ERROR
========================================================= */

function getMetadataProcessError(
    error
) {

    try {

        if (
            typeof getReadableError ===
            "function"
        ) {

            const readable =
                getReadableError(
                    error
                );


            if (
                readable
            ) {

                return String(
                    readable
                );
            }
        }

    } catch (
        readableError
    ) {

        console.warn(
            "[GEN-Z.AI][METADATA] Failed to format error:",
            readableError
        );
    }


    if (
        error instanceof Error &&
        error.message
    ) {

        return error.message;
    }


    if (
        typeof error ===
        "string"
    ) {

        return error;
    }


    try {

        return JSON.stringify(
            error
        );

    } catch (
        jsonError
    ) {

        return "Terjadi kesalahan saat memproses metadata.";
    }
}


/* =========================================================
   CHECK WRAPPER
   ---------------------------------------------------------
   CHECK ASLI TETAP BERADA DI metadata-check.js.
   Wrapper hanya mengontrol loader.
========================================================= */

async function handleMetadataCheck(
    ...args
) {

    if (
        metadataLoaderRunning
    ) {

        console.warn(
            "[GEN-Z.AI][METADATA] CHECK sedang berjalan."
        );


        return;
    }


    startMetadataLoader(
        "check"
    );


    const startedAt =
        Date.now();


    try {

        const result =
            await checkMetadata(
                ...args
            );


        /*
           Jangan tutup loader sebelum
           minimum 10 detik tercapai.
        */

        await waitForMinimumLoaderDuration(
            startedAt,
            CHECKING_DURATION
        );


        /*
           Setelah proses asli selesai dan
           minimum 10 detik terpenuhi,
           baru tampilkan READY.
        */

        setMetadataLoaderContent({

            title:
                "CHECK COMPLETE",

            stage:
                "READY",

            message:
                "Metadata dan provenance berhasil diperiksa.",

            progress:
                100

        });


        stopMetadataLoader(
            true,
            {

                title:
                    "CHECK COMPLETE",

                message:
                    "Metadata dan provenance berhasil diperiksa."

            }
        );


        return result;

    } catch (
        error
    ) {

        const message =
            getMetadataProcessError(
                error
            );


        console.error(
            "[GEN-Z.AI][METADATA] CHECK ERROR:",
            error
        );


        stopMetadataLoader(
            false,
            {

                title:
                    "CHECK FAILED",

                message:
                    message

            }
        );


        throw error;
    }
}


/* =========================================================
   CLEAN WRAPPER
   ---------------------------------------------------------
   CLEAN ASLI TETAP BERADA DI metadata-clean.js.
   Wrapper hanya mengontrol loader.
========================================================= */

async function handleMetadataClean(
    ...args
) {

    if (
        metadataLoaderRunning
    ) {

        console.warn(
            "[GEN-Z.AI][METADATA] CLEAN sedang berjalan."
        );


        return;
    }


    startMetadataLoader(
        "clean"
    );


    const startedAt =
        Date.now();


    try {

        const result =
            await cleanMetadata(
                ...args
            );


        /*
           Jangan tutup loader sebelum
           minimum 10 detik tercapai.

           Jika FFmpeg / cleaning memerlukan
           waktu lebih dari 10 detik,
           fungsi ini langsung lanjut karena
           proses asli sudah lebih lama.
        */

        await waitForMinimumLoaderDuration(
            startedAt,
            CLEANING_DURATION
        );


        setMetadataLoaderContent({

            title:
                "CLEANING COMPLETE",

            stage:
                "READY",

            message:
                "Metadata berhasil dibersihkan dan file hasil telah diverifikasi.",

            progress:
                100

        });


        stopMetadataLoader(
            true,
            {

                title:
                    "CLEANING COMPLETE",

                message:
                    "Metadata berhasil dibersihkan dan file hasil telah diverifikasi."

            }
        );


        return result;

    } catch (
        error
    ) {

        const message =
            getMetadataProcessError(
                error
            );


        console.error(
            "[GEN-Z.AI][METADATA] CLEAN ERROR:",
            error
        );


        stopMetadataLoader(
            false,
            {

                title:
                    "CLEANING FAILED",

                message:
                    message

            }
        );


        throw error;
    }
}


/* =========================================================
   INIT
========================================================= */

function init() {

    cacheElements();


    /*
       Loader dibuat sebelum event binding.
       Dengan demikian elemen selalu tersedia
       ketika tombol ditekan.
    */

    ensureMetadataLoader();


    bindMetadataEvents({

        handleFileInput,

        openFilePicker,

        /*
           CHECK menggunakan wrapper loader.
        */

        checkMetadata:
            handleMetadataCheck,

        /*
           CLEAN menggunakan wrapper loader.
        */

        cleanMetadata:
            handleMetadataClean,

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
                            state.metadata ||
                            []
                        )
                    ],

                aiIndicators:
                    [
                        ...(
                            state.aiIndicators ||
                            []
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
                    null,

                loading:
                    metadataLoaderRunning,

                loadingMode:
                    metadataLoaderMode

            };
        },


        reset() {

            if (
                metadataLoaderTimer
            ) {

                clearInterval(
                    metadataLoaderTimer
                );


                metadataLoaderTimer =
                    null;
            }


            metadataLoaderRunning =
                false;


            metadataLoaderMode =
                null;


            if (
                metadataLoader
            ) {

                metadataLoader.classList.remove(
                    "is-visible"
                );


                metadataLoader.setAttribute(
                    "aria-hidden",
                    "true"
                );
            }


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
            once:
                true
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

            cleanButton:
                !!cleanButton,

            checkButton:
                !!checkButton,

            fileInput:
                !!fileInput

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
                    "[GEN-Z.AI][METADATA] loader:",
                    {

                        running:
                            metadataLoaderRunning,

                        mode:
                            metadataLoaderMode

                    }
                );


                console.log(
                    "[GEN-Z.AI][METADATA] state:",
                    window.GENZMetadataCleaner
                        ?.getState?.()
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


                console.log(
                    "[GEN-Z.AI][METADATA] loader:",
                    {

                        running:
                            metadataLoaderRunning,

                        mode:
                            metadataLoaderMode

                    }
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

            }
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
