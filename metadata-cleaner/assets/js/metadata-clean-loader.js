/* =========================================================
   GEN-Z.AI
   METADATA CLEANING LOADER
   ---------------------------------------------------------
   File:
   metadata-cleaner/assets/js/metadata-clean-loader.js

   Fungsi:
   - Create premium cleaning loader
   - Update progress
   - Update stage
   - Run minimum loading timer
   - Remove loader
========================================================= */


/* =========================================================
   CONSTANTS
========================================================= */

const CLEANING_DURATION =
    10000;


const CLEANING_TICK =
    100;


/* =========================================================
   CLEANING STAGES
========================================================= */

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
    }

];


/* =========================================================
   CREATE PREMIUM CLEANING LOADER
========================================================= */

function createPremiumCleaningLoader() {

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
                    <span>AI</span>
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
   GET CLEANING STAGE
========================================================= */

function getCleaningStage(
    progress
) {

    if (
        progress >= 94
    ) {

        return CLEANING_STAGES[5];

    }


    if (
        progress >= 82
    ) {

        return CLEANING_STAGES[4];

    }


    if (
        progress >= 64
    ) {

        return CLEANING_STAGES[3];

    }


    if (
        progress >= 42
    ) {

        return CLEANING_STAGES[2];

    }


    if (
        progress >= 22
    ) {

        return CLEANING_STAGES[1];

    }


    return CLEANING_STAGES[0];
}


/* =========================================================
   UPDATE PREMIUM CLEANING LOADER
========================================================= */

function updatePremiumCleaningLoader(
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
            `${Math.round(safeProgress)}%`;

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
   RUN PREMIUM CLEANING TIMER
========================================================= */

async function runPremiumCleaningTimer(
    loader,
    duration
) {

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
   REMOVE PREMIUM CLEANING LOADER
========================================================= */

function removePremiumCleaningLoader(
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
   PUBLIC API
========================================================= */

export {

    CLEANING_DURATION,

    CLEANING_TICK,

    CLEANING_STAGES,

    createPremiumCleaningLoader,

    getCleaningStage,

    updatePremiumCleaningLoader,

    runPremiumCleaningTimer,

    removePremiumCleaningLoader

};


window.GENZMetadataCleaningLoader = {

    CLEANING_DURATION,

    CLEANING_TICK,

    CLEANING_STAGES,

    createPremiumCleaningLoader,

    getCleaningStage,

    updatePremiumCleaningLoader,

    runPremiumCleaningTimer,

    removePremiumCleaningLoader

};
