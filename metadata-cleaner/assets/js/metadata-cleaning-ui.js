/* =========================================================
   GEN-Z.AI
   AI METADATA CLEANER
   ---------------------------------------------------------
   File:
   metadata-cleaner/assets/js/metadata-cleaning-ui.js

   Tanggung jawab:
   - Premium cleaning loader
   - Cleaning progress
   - Cleaning stage
   - Cleaning message
   - Cleaning loader animation
   - Cleaning loader CSS

   Tidak menangani:
   - File processing
   - Metadata detection
   - Metadata cleaning
   - Preview media
   - Download
   - Application state
========================================================= */


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
   CREATE PREMIUM CLEANING LOADER
========================================================= */

export function createPremiumCleaningLoader() {

    const existing =
        document.getElementById(
            "genzMetadataCleaningLoader"
        );


    if (
        existing
    ) {

        existing.remove();

    }


    const overlay =
        document.createElement(
            "div"
        );


    overlay.id =
        "genzMetadataCleaningLoader";


    overlay.className =
        "genz-metadata-cleaning-loader";


    overlay.innerHTML = `

        <div class="genz-clean-loader-panel">

            <div class="genz-clean-loader-orbit">

                <div class="genz-clean-loader-core">

                    <span>
                        AI
                    </span>

                </div>

            </div>


            <div class="genz-clean-loader-brand">
                GEN-Z.AI
            </div>


            <div class="genz-clean-loader-title">
                CLEANING METADATA
            </div>


            <div
                class="genz-clean-loader-stage"
                data-clean-loader-stage
            >
                INITIALIZING
            </div>


            <div
                class="genz-clean-loader-message"
                data-clean-loader-message
            >
                Menyiapkan proses pembersihan...
            </div>


            <div class="genz-clean-loader-progress">

                <div
                    class="genz-clean-loader-progress-bar"
                    data-clean-loader-progress
                ></div>

            </div>


            <div class="genz-clean-loader-footer">

                <span>
                    SECURE LOCAL PROCESS
                </span>


                <strong
                    data-clean-loader-percent
                >
                    0%
                </strong>

            </div>

        </div>

    `;


    document.body.appendChild(
        overlay
    );


    requestAnimationFrame(
        () => {

            overlay.classList.add(
                "is-visible"
            );

        }
    );


    return overlay;

}


/* =========================================================
   PREMIUM LOADER TIMER
========================================================= */

export async function runPremiumCleaningTimer(
    loader,
    duration = CLEANING_DURATION
) {

    if (
        !loader
    ) {

        return;

    }


    const start =
        performance.now();


    let timerId =
        null;


    try {

        updatePremiumCleaningLoader(
            loader,
            8,
            "INITIALIZING",
            "Menyiapkan proses pembersihan..."
        );


        timerId =
            setInterval(
                () => {

                    const elapsed =
                        performance.now() -
                        start;


                    const ratio =
                        Math.min(
                            elapsed /
                            duration,
                            1
                        );


                    const progress =
                        Math.min(
                            96,
                            Math.round(
                                ratio *
                                96
                            )
                        );


                    const stage =
                        getCleaningStage(
                            progress
                        );


                    updatePremiumCleaningLoader(
                        loader,
                        progress,
                        stage.title,
                        stage.message
                    );

                },
                CLEANING_TICK
            );


        await wait(
            duration
        );


    } finally {

        if (
            timerId !== null
        ) {

            clearInterval(
                timerId
            );

        }

    }

}


/* =========================================================
   CLEANING STAGE
========================================================= */

export function getCleaningStage(
    progress
) {

    const value =
        Number(
            progress
        ) || 0;


    if (
        value >= 94
    ) {

        return CLEANING_STAGES[5];

    }


    if (
        value >= 82
    ) {

        return CLEANING_STAGES[4];

    }


    if (
        value >= 64
    ) {

        return CLEANING_STAGES[3];

    }


    if (
        value >= 42
    ) {

        return CLEANING_STAGES[2];

    }


    if (
        value >= 22
    ) {

        return CLEANING_STAGES[1];

    }


    return CLEANING_STAGES[0];

}


/* =========================================================
   UPDATE PREMIUM CLEANING LOADER
========================================================= */

export function updatePremiumCleaningLoader(
    loader,
    progress,
    stage,
    message
) {

    if (
        !loader
    ) {

        return;

    }


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


    const progressBar =
        loader.querySelector(
            "[data-clean-loader-progress]"
        );


    const percent =
        loader.querySelector(
            "[data-clean-loader-percent]"
        );


    const stageElement =
        loader.querySelector(
            "[data-clean-loader-stage]"
        );


    const messageElement =
        loader.querySelector(
            "[data-clean-loader-message]"
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


    if (
        stageElement
    ) {

        stageElement.textContent =
            String(
                stage ||
                ""
            );

    }


    if (
        messageElement
    ) {

        messageElement.textContent =
            String(
                message ||
                ""
            );

    }

}


/* =========================================================
   REMOVE PREMIUM CLEANING LOADER
========================================================= */

export function removePremiumCleaningLoader(
    loader
) {

    if (
        !loader
    ) {

        return;

    }


    loader.classList.remove(
        "is-visible"
    );


    setTimeout(
        () => {

            loader.remove();

        },
        250
    );

}


/* =========================================================
   WAIT
========================================================= */

export function wait(
    milliseconds
) {

    const duration =
        Math.max(
            0,
            Number(
                milliseconds
            ) || 0
        );


    return new Promise(
        resolve => {

            setTimeout(
                resolve,
                duration
            );

        }
    );

}


/* =========================================================
   PREMIUM LOADER CSS
========================================================= */

export function injectPremiumCleaningStyles() {

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

            position:
                fixed;

            inset:
                0;

            z-index:
                2147483000;

            display:
                flex;

            align-items:
                center;

            justify-content:
                center;

            padding:
                24px;

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

            opacity:
                0;

            visibility:
                hidden;

            pointer-events:
                none;

            transition:
                opacity 220ms ease,
                visibility 220ms ease;

        }


        .genz-metadata-cleaning-loader.is-visible {

            opacity:
                1;

            visibility:
                visible;

            pointer-events:
                auto;

        }


        .genz-clean-loader-panel {

            position:
                relative;

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
   CONSTANTS API
========================================================= */

export {

    CLEANING_DURATION,

    CLEANING_TICK,

    CLEANING_STAGES

};
