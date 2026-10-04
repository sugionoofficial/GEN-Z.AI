/* =========================================================
   GEN-Z.AI VISION
   ---------------------------------------------------------
   File:
   vision/assets/js/vision-ui.js

   Fungsi:
   - Mengatur status UI
   - Mengatur progress
   - Mengatur loading button
   - Menampilkan error / success / warning
   - Mengatur hasil prompt
   - Mengatur panel analysis
   - Tidak menangani:
     API
     Supabase
     Upload
     Credit
     History
========================================================= */


/* =========================================================
   CONSTANTS
========================================================= */

const VISION_UI_STATUS = Object.freeze({

    IDLE:
        "idle",

    VALIDATING:
        "validating",

    CHECKING_CREDIT:
        "checking-credit",

    RESERVING_CREDIT:
        "reserving-credit",

    ANALYZING:
        "analyzing",

    ENGINEERING:
        "engineering",

    SAVING_HISTORY:
        "saving-history",

    COMPLETED:
        "completed",

    REFUNDING:
        "refunding",

    ERROR:
        "error"

});


const VISION_UI_PROGRESS = Object.freeze({

    idle:
        0,

    validating:
        8,

    "checking-credit":
        16,

    "reserving-credit":
        22,

    analyzing:
        48,

    engineering:
        72,

    "saving-history":
        90,

    completed:
        100,

    refunding:
        94,

    error:
        0

});


/* =========================================================
   INTERNAL HELPERS
========================================================= */

function getDOM() {

    if (
        !window.GENZVisionDOM
    ) {

        throw new Error(
            "GENZVisionDOM belum tersedia."
        );

    }


    return window.GENZVisionDOM.getDOM();

}


function getState() {

    if (
        !window.GENZVisionState
    ) {

        throw new Error(
            "GENZVisionState belum tersedia."
        );

    }


    return window.GENZVisionState;

}


/* =========================================================
   TEXT
========================================================= */

const STATUS_TEXT = Object.freeze({

    idle:
        "Ready",

    validating:
        "Memvalidasi image...",

    "checking-credit":
        "Memeriksa credit...",

    "reserving-credit":
        "Menyiapkan proses Vision...",

    analyzing:
        "Menganalisis gambar...",

    engineering:
        "Menyusun ultra detailed prompt...",

    "saving-history":
        "Menyimpan riwayat...",

    completed:
        "Vision analysis selesai",

    refunding:
        "Mengembalikan credit...",

    error:
        "Vision process gagal"

});


const STATUS_SUBTEXT = Object.freeze({

    idle:
        "Upload gambar untuk memulai.",

    validating:
        "Memeriksa file dan parameter Vision.",

    "checking-credit":
        "Memastikan saldo credit mencukupi.",

    "reserving-credit":
        "Menyiapkan satu credit untuk proses ini.",

    analyzing:
        "Membaca subject, composition, lighting, camera, dan detail visual.",

    engineering:
        "Mengubah hasil visual analysis menjadi prompt yang siap digunakan.",

    "saving-history":
        "Menyimpan aktivitas ke riwayat akun.",

    completed:
        "Prompt berhasil dibuat.",

    refunding:
        "Proses gagal. Credit sedang dikembalikan.",

    error:
        "Periksa pesan error lalu coba kembali."

});


/* =========================================================
   RESULT MESSAGE
========================================================= */

function clearResultMessage() {

    const dom =
        getDOM();


    const existing =
        dom.page?.querySelectorAll(
            ".vision-result-message"
        );


    if (!existing) {

        return;

    }


    existing.forEach(
        element =>
            element.remove()
    );

}


/* =========================================================
   SHOW RESULT MESSAGE
========================================================= */

function showResultMessage(
    message,
    type = "info"
) {

    const dom =
        getDOM();


    clearResultMessage();


    if (
        !dom.promptResult?.parentElement
    ) {

        return false;

    }


    const element =
        document.createElement(
            "div"
        );


    element.className =
        `vision-result-message vision-result-${type}`;


    element.textContent =
        String(
            message ||
            ""
        );


    dom.promptResult
        .parentElement
        .insertBefore(
            element,
            dom.promptResult
        );


    return true;

}


/* =========================================================
   SET STATUS
========================================================= */

function setStatus(
    status,
    message = null
) {

    const dom =
        getDOM();


    const normalized =
        String(
            status ||
            VISION_UI_STATUS.IDLE
        )
            .toLowerCase();


    const statusText =
        message ||
        STATUS_TEXT[
            normalized
        ] ||
        STATUS_TEXT.idle;


    if (
        dom.status
    ) {

        dom.status.textContent =
            statusText;

        dom.status.dataset.status =
            normalized;

    }


    if (
        dom.page
    ) {

        dom.page.dataset.status =
            normalized;

    }


    updateStatusIndicator(
        normalized
    );


    return true;

}


/* =========================================================
   STATUS INDICATOR
========================================================= */

function updateStatusIndicator(
    status
) {

    const dom =
        getDOM();


    if (
        !dom.status
    ) {

        return false;

    }


    const processing =
        [
            VISION_UI_STATUS.VALIDATING,
            VISION_UI_STATUS.CHECKING_CREDIT,
            VISION_UI_STATUS.RESERVING_CREDIT,
            VISION_UI_STATUS.ANALYZING,
            VISION_UI_STATUS.ENGINEERING,
            VISION_UI_STATUS.SAVING_HISTORY,
            VISION_UI_STATUS.REFUNDING
        ].includes(
            status
        );


    dom.status.classList.toggle(
        "vision-status-processing",
        processing
    );


    dom.status.classList.toggle(
        "vision-status-success",
        status ===
            VISION_UI_STATUS.COMPLETED
    );


    dom.status.classList.toggle(
        "vision-status-error",
        status ===
            VISION_UI_STATUS.ERROR
    );


    return true;

}


/* =========================================================
   SET STATUS SUBTEXT
========================================================= */

function setStatusSubtext(
    status
) {

    const dom =
        getDOM();


    if (
        !dom.status
    ) {

        return false;

    }


    const text =
        STATUS_SUBTEXT[
            String(
                status || ""
            )
                .toLowerCase()
        ] ||
        "";


    let subtext =
        dom.status.parentElement
            ?.querySelector(
                ".vision-status-subtext"
            );


    if (
        !subtext
    ) {

        subtext =
            document.createElement(
                "div"
            );

        subtext.className =
            "vision-status-subtext";


        dom.status.parentElement
            ?.appendChild(
                subtext
            );

    }


    subtext.textContent =
        text;


    return true;

}


/* =========================================================
   SET PROGRESS
========================================================= */

function setProgress(
    value,
    text = null
) {

    const dom =
        getDOM();


    let progress =
        Number(value);


    if (
        !Number.isFinite(
            progress
        )
    ) {

        progress =
            0;

    }


    progress =
        Math.max(
            0,
            Math.min(
                100,
                progress
            )
        );


    if (
        dom.progressBar
    ) {

        dom.progressBar.style.width =
            `${progress}%`;

        dom.progressBar
            .setAttribute(
                "aria-valuenow",
                String(progress)
            );

    }


    if (
        dom.progress
    ) {

        dom.progress
            .setAttribute(
                "aria-valuenow",
                String(progress)
            );

    }


    if (
        dom.progressText
    ) {

        dom.progressText.textContent =
            text ||
            `${Math.round(progress)}%`;

    }


    return progress;

}


/* =========================================================
   SET PROGRESS FROM STATUS
========================================================= */

function setProgressFromStatus(
    status,
    customText = null
) {

    const normalized =
        String(
            status ||
            VISION_UI_STATUS.IDLE
        )
            .toLowerCase();


    const progress =
        VISION_UI_PROGRESS[
            normalized
        ] ??
        0;


    return setProgress(
        progress,
        customText
    );

}


/* =========================================================
   SET PROCESSING STATE
========================================================= */

function setProcessing(
    processing
) {

    const dom =
        getDOM();


    const active =
        Boolean(
            processing
        );


    if (
        dom.page
    ) {

        dom.page.classList.toggle(
            "vision-processing",
            active
        );

    }


    if (
        dom.generateButton
    ) {

        dom.generateButton.disabled =
            active;

        dom.generateButton.classList.toggle(
            "vision-processing-button",
            active
        );

    }


    if (
        dom.generateSpinner
    ) {

        dom.generateSpinner.hidden =
            !active;

    }


    if (
        dom.dropzone
    ) {

        dom.dropzone.classList.toggle(
            "vision-dropzone-disabled",
            active
        );

    }


    return true;

}


/* =========================================================
   SET GENERATE BUTTON TEXT
========================================================= */

function setGenerateButtonText(
    text
) {

    const dom =
        getDOM();


    if (
        !dom.generateButton
    ) {

        return false;

    }


    const content =
        dom.generateButton
            .querySelector(
                ".vision-action-content"
            );


    if (
        content
    ) {

        const textElement =
            content.querySelector(
                ".vision-action-text"
            );


        if (
            textElement
        ) {

            textElement.textContent =
                text;

            return true;

        }

    }


    const directText =
        Array.from(
            dom.generateButton.childNodes
        )
            .find(
                node =>
                    node.nodeType ===
                    Node.TEXT_NODE &&
                    node.textContent.trim()
            );


    if (
        directText
    ) {

        directText.textContent =
            ` ${text} `;

    }


    return true;

}


/* =========================================================
   RESET RESULT
========================================================= */

function resetResult() {

    const dom =
        getDOM();


    clearResultMessage();


    if (
        dom.promptPlaceholder
    ) {

        dom.promptPlaceholder.hidden =
            false;

    }


    if (
        dom.promptResult
    ) {

        dom.promptResult.hidden =
            true;

        dom.promptResult.textContent =
            "";

    }


    if (
        dom.copyButton
    ) {

        dom.copyButton.disabled =
            true;

    }


    if (
        dom.analysisResult
    ) {

        dom.analysisResult.textContent =
            "";

    }


    if (
        dom.analysisDetails
    ) {

        dom.analysisDetails.open =
            false;

    }


    return true;

}


/* =========================================================
   SHOW PROMPT
========================================================= */

function showPrompt(
    prompt
) {

    const dom =
        getDOM();


    const text =
        String(
            prompt ||
            ""
        )
            .trim();


    if (
        !text
    ) {

        resetPrompt();

        return false;

    }


    if (
        dom.promptPlaceholder
    ) {

        dom.promptPlaceholder.hidden =
            true;

    }


    if (
        dom.promptResult
    ) {

        dom.promptResult.hidden =
            false;

        dom.promptResult.textContent =
            text;

    }


    if (
        dom.copyButton
    ) {

        dom.copyButton.disabled =
            false;

    }


    return true;

}


/* =========================================================
   RESET PROMPT
========================================================= */

function resetPrompt() {

    const dom =
        getDOM();


    if (
        dom.promptPlaceholder
    ) {

        dom.promptPlaceholder.hidden =
            false;

    }


    if (
        dom.promptResult
    ) {

        dom.promptResult.hidden =
            true;

        dom.promptResult.textContent =
            "";

    }


    if (
        dom.copyButton
    ) {

        dom.copyButton.disabled =
            true;

    }


    return true;

}


/* =========================================================
   SHOW ANALYSIS
========================================================= */

function showAnalysis(
    analysis
) {

    const dom =
        getDOM();


    if (
        !dom.analysisResult
    ) {

        return false;

    }


    let text = "";


    if (
        typeof analysis ===
        "string"
    ) {

        text =
            analysis;

    } else {

        try {

            text =
                JSON.stringify(
                    analysis,
                    null,
                    2
                );

        } catch {

            text =
                String(
                    analysis ||
                    ""
                );

        }

    }


    dom.analysisResult.textContent =
        text;


    if (
        dom.analysisDetails
    ) {

        dom.analysisDetails.hidden =
            !text;

    }


    return Boolean(
        text
    );

}


/* =========================================================
   RESET ANALYSIS
========================================================= */

function resetAnalysis() {

    const dom =
        getDOM();


    if (
        dom.analysisResult
    ) {

        dom.analysisResult.textContent =
            "";

    }


    if (
        dom.analysisDetails
    ) {

        dom.analysisDetails.open =
            false;

        dom.analysisDetails.hidden =
            true;

    }


    return true;

}


/* =========================================================
   COPY BUTTON STATE
========================================================= */

function setCopyState(
    available,
    copied = false
) {

    const dom =
        getDOM();


    if (
        !dom.copyButton
    ) {

        return false;

    }


    dom.copyButton.disabled =
        !available;


    dom.copyButton.classList.toggle(
        "vision-copy-success",
        Boolean(copied)
    );


    const label =
        dom.copyButton
            .querySelector(
                ".vision-copy-label"
            );


    if (
        label
    ) {

        label.textContent =
            copied
                ? "Copied"
                : "Copy Prompt";

    }


    return true;

}


/* =========================================================
   SHOW ERROR
========================================================= */

function showError(
    message
) {

    const text =
        String(
            message ||
            "Terjadi kesalahan pada Vision."
        );


    setStatus(
        VISION_UI_STATUS.ERROR,
        "Vision process gagal"
    );


    setStatusSubtext(
        VISION_UI_STATUS.ERROR
    );


    setProgress(
        0
    );


    showResultMessage(
        text,
        "error"
    );


    return true;

}


/* =========================================================
   SHOW WARNING
========================================================= */

function showWarning(
    message
) {

    const text =
        String(
            message ||
            ""
        );


    showResultMessage(
        text,
        "warning"
    );


    return true;

}


/* =========================================================
   SHOW SUCCESS
========================================================= */

function showSuccess(
    message
) {

    const text =
        String(
            message ||
            "Prompt berhasil dibuat."
        );


    setStatus(
        VISION_UI_STATUS.COMPLETED,
        "Vision analysis selesai"
    );


    setStatusSubtext(
        VISION_UI_STATUS.COMPLETED
    );


    setProgress(
        100,
        "100%"
    );


    showResultMessage(
        text,
        "success"
    );


    return true;

}


/* =========================================================
   SET PROCESS STAGE
========================================================= */

function setStage(
    status,
    options = {}
) {

    const normalized =
        String(
            status ||
            VISION_UI_STATUS.IDLE
        )
            .toLowerCase();


    const progress =
        options.progress !==
        undefined
            ? options.progress
            : VISION_UI_PROGRESS[
                normalized
            ] ?? 0;


    setStatus(
        normalized,
        options.message ||
        null
    );


    setStatusSubtext(
        normalized
    );


    setProgress(
        progress,
        options.progressText ||
        null
    );


    return true;

}


/* =========================================================
   INITIALIZE
========================================================= */

function initialize() {

    const dom =
        getDOM();


    resetResult();

    resetAnalysis();

    setProcessing(
        false
    );

    setStatus(
        VISION_UI_STATUS.IDLE
    );

    setStatusSubtext(
        VISION_UI_STATUS.IDLE
    );

    setProgress(
        0
    );

    setCopyState(
        false
    );


    if (
        dom.generateSpinner
    ) {

        dom.generateSpinner.hidden =
            true;

    }


    return true;

}


/* =========================================================
   SYNC FROM STATE
========================================================= */

function syncFromState() {

    const state =
        getState();


    const process =
        state.get(
            "process",
            {}
        );


    const status =
        process.status ||
        VISION_UI_STATUS.IDLE;


    setStatus(
        status
    );


    setStatusSubtext(
        status
    );


    setProgress(
        process.progress ??
        VISION_UI_PROGRESS[
            status
        ] ??
        0
    );


    setProcessing(
        Boolean(
            process.status &&
            ![
                VISION_UI_STATUS.IDLE,
                VISION_UI_STATUS.COMPLETED,
                VISION_UI_STATUS.ERROR
            ].includes(
                process.status
            )
        )
    );


    return true;

}


/* =========================================================
   PUBLIC API
========================================================= */

const GENZVisionUI = Object.freeze({

    STATUS:
        VISION_UI_STATUS,

    PROGRESS:
        VISION_UI_PROGRESS,

    STATUS_TEXT,

    STATUS_SUBTEXT,

    initialize,

    setStatus,

    setStatusSubtext,

    updateStatusIndicator,

    setProgress,

    setProgressFromStatus,

    setProcessing,

    setGenerateButtonText,

    resetResult,

    showPrompt,

    resetPrompt,

    showAnalysis,

    resetAnalysis,

    setCopyState,

    showError,

    showWarning,

    showSuccess,

    showResultMessage,

    clearResultMessage,

    setStage,

    syncFromState

});


/* =========================================================
   GLOBAL EXPORT
========================================================= */

window.GENZVisionUI =
    GENZVisionUI;
