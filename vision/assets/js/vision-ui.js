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
   - Mengatur tampilan credit
   - Sinkronisasi progress state -> DOM
   - Tidak menangani:
     API
     Supabase
     Upload
     Credit logic
     History
========================================================= */


/* =========================================================
   CONSTANTS
========================================================= */

const VISION_UI_STATUS =
    Object.freeze({

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


const VISION_UI_PROGRESS =
    Object.freeze({

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
   STATUS TEXT
========================================================= */

const STATUS_TEXT =
    Object.freeze({

        idle:
            "Menunggu gambar...",

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


const STATUS_SUBTEXT =
    Object.freeze({

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
   NORMALIZE STATUS
========================================================= */

function normalizeStatus(
    status
) {

    const value =
        String(
            status ||
            VISION_UI_STATUS.IDLE
        )
            .trim()
            .toLowerCase();


    if (
        Object.prototype.hasOwnProperty.call(
            STATUS_TEXT,
            value
        )
    ) {

        return value;

    }


    return VISION_UI_STATUS.IDLE;

}


/* =========================================================
   RESULT MESSAGE
========================================================= */

function clearResultMessage() {

    const dom =
        getDOM();


    if (
        !dom.page
    ) {

        return false;

    }


    const existing =
        dom.page.querySelectorAll(
            ".vision-result-message"
        );


    existing.forEach(
        item => {

            item.remove();

        }
    );


    return true;

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
        !dom.promptContainer
    ) {

        return false;

    }


    const text =
        String(
            message ||
            ""
        )
            .trim();


    if (
        !text
    ) {

        return false;

    }


    const messageElement =
        document.createElement(
            "div"
        );


    messageElement.className =
        `vision-result-message vision-result-${type}`;


    messageElement.textContent =
        text;


    dom.promptContainer
        .parentElement
        ?.insertBefore(
            messageElement,
            dom.promptContainer
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
        normalizeStatus(
            status
        );


    const text =
        String(
            message ||
            STATUS_TEXT[
                normalized
            ] ||
            STATUS_TEXT.idle
        );


    /*
     * -----------------------------------------------------
     * STATUS CONTAINER
     * -----------------------------------------------------
     */

    if (
        dom.status
    ) {

        dom.status.dataset.state =
            normalized;

    }


    /*
     * -----------------------------------------------------
     * STATUS TEXT
     * -----------------------------------------------------
     */

    if (
        dom.statusText
    ) {

        dom.statusText.textContent =
            text;

    }


    /*
     * -----------------------------------------------------
     * PAGE STATE
     * -----------------------------------------------------
     */

    if (
        dom.page
    ) {

        dom.page.dataset.status =
            normalized;

    }


    /*
     * -----------------------------------------------------
     * INDICATOR
     * -----------------------------------------------------
     */

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


    const normalized =
        normalizeStatus(
            status
        );


    const processing =
        [
            VISION_UI_STATUS.VALIDATING,
            VISION_UI_STATUS.CHECKING_CREDIT,
            VISION_UI_STATUS.RESERVING_CREDIT,
            VISION_UI_STATUS.ANALYZING,
            VISION_UI_STATUS.ENGINEERING,
            VISION_UI_STATUS.SAVING_HISTORY,
            VISION_UI_STATUS.REFUNDING
        ]
            .includes(
                normalized
            );


    if (
        dom.status
    ) {

        dom.status.classList.toggle(
            "vision-status-processing",
            processing
        );


        dom.status.classList.toggle(
            "vision-status-success",
            normalized ===
                VISION_UI_STATUS.COMPLETED
        );


        dom.status.classList.toggle(
            "vision-status-error",
            normalized ===
                VISION_UI_STATUS.ERROR
        );


        dom.status.classList.toggle(
            "vision-status-idle",
            normalized ===
                VISION_UI_STATUS.IDLE
        );

    }


    if (
        dom.statusIndicator
    ) {

        dom.statusIndicator.dataset.state =
            normalized;


        dom.statusIndicator.classList.toggle(
            "vision-status-processing",
            processing
        );


        dom.statusIndicator.classList.toggle(
            "vision-status-success",
            normalized ===
                VISION_UI_STATUS.COMPLETED
        );


        dom.statusIndicator.classList.toggle(
            "vision-status-error",
            normalized ===
                VISION_UI_STATUS.ERROR
        );

    }


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


    const normalized =
        normalizeStatus(
            status
        );


    const text =
        STATUS_SUBTEXT[
            normalized
        ] ||
        "";


    let subtext =
        dom.status.parentElement
            ?.querySelector(
                ".vision-status-subtext"
            );


    if (
        !subtext &&
        text
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


    if (
        subtext
    ) {

        subtext.textContent =
            text;

        subtext.hidden =
            !text;

    }


    return true;

}


/* =========================================================
   PROGRESS STAGE TEXT
========================================================= */

function getProgressStageText(
    progress
) {

    const value =
        Number(
            progress
        );


    if (
        value >= 100
    ) {

        return "READY";

    }


    if (
        value >= 88
    ) {

        return "FINALIZING";

    }


    if (
        value >= 70
    ) {

        return "PROMPT ENGINEERING";

    }


    if (
        value >= 50
    ) {

        return "ANALYSIS COMPLETE";

    }


    if (
        value >= 25
    ) {

        return "VISION ANALYSIS";

    }


    if (
        value >= 5
    ) {

        return "INITIALIZING";

    }


    return "READY";

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
        Number(
            value
        );


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


    const rounded =
        Math.round(
            progress
        );


    /*
     * -----------------------------------------------------
     * PROGRESS CONTAINER
     * -----------------------------------------------------
     */

    if (
        dom.progress
    ) {

        dom.progress
            .setAttribute(
                "aria-valuenow",
                String(
                    rounded
                )
            );


        dom.progress
            .setAttribute(
                "aria-valuemin",
                "0"
            );


        dom.progress
            .setAttribute(
                "aria-valuemax",
                "100"
            );


        /*
         * Jika progress > 0 dan proses masih berjalan,
         * pastikan container terlihat.
         */

        if (
            progress > 0
        ) {

            dom.progress.hidden =
                false;

        }

    }


    /*
     * -----------------------------------------------------
     * PROGRESS BAR
     * -----------------------------------------------------
     */

    if (
        dom.progressBar
    ) {

        /*
         * Force browser melakukan layout sebelum
         * width berikutnya diterapkan.
         *
         * Ini membantu transition CSS tetap berjalan
         * ketika nilai progress berubah cepat.
         */

        dom.progressBar.style.width =
            "0%";


        void dom.progressBar.offsetWidth;


        dom.progressBar.style.width =
            `${progress}%`;


        dom.progressBar
            .setAttribute(
                "aria-valuenow",
                String(
                    rounded
                )
            );


        dom.progressBar
            .setAttribute(
                "aria-valuemin",
                "0"
            );


        dom.progressBar
            .setAttribute(
                "aria-valuemax",
                "100"
            );


        dom.progressBar.dataset.progress =
            String(
                rounded
            );


        dom.progressBar.dataset.stage =
            getProgressStageText(
                progress
            );

    }


    /*
     * -----------------------------------------------------
     * PROGRESS TEXT
     * -----------------------------------------------------
     */

    if (
        dom.progressText
    ) {

        dom.progressText.textContent =
            text ||
            `${rounded}%`;

    }


    /*
     * -----------------------------------------------------
     * PAGE PROGRESS DATA
     * -----------------------------------------------------
     */

    if (
        dom.page
    ) {

        dom.page.dataset.progress =
            String(
                rounded
            );

    }


    /*
     * -----------------------------------------------------
     * PROGRESS CONTAINER DATA
     * -----------------------------------------------------
 */

    if (
        dom.progress
    ) {

        dom.progress.dataset.progress =
            String(
                rounded
            );


        dom.progress.dataset.stage =
            getProgressStageText(
                progress
            );

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
        normalizeStatus(
            status
        );


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


    /*
     * -----------------------------------------------------
     * PAGE
     * -----------------------------------------------------
     */

    if (
        dom.page
    ) {

        dom.page.classList.toggle(
            "vision-processing",
            active
        );

    }


    /*
     * -----------------------------------------------------
     * GENERATE BUTTON
     * -----------------------------------------------------
 */

    if (
        dom.generateButton
    ) {

        dom.generateButton.disabled =
            active;


        dom.generateButton.classList.toggle(
            "vision-processing-button",
            active
        );


        dom.generateButton.setAttribute(
            "aria-busy",
            active
                ? "true"
                : "false"
        );

    }


    /*
     * -----------------------------------------------------
     * SPINNER
     * -----------------------------------------------------
 */

    if (
        dom.generateSpinner
    ) {

        dom.generateSpinner.hidden =
            !active;

    }


    /*
     * -----------------------------------------------------
     * PROGRESS
     * -----------------------------------------------------
 */

    if (
        dom.progress
    ) {

        dom.progress.hidden =
            !active;


        dom.progress.classList.toggle(
            "vision-progress-active",
            active
        );


        dom.progress.setAttribute(
            "aria-hidden",
            active
                ? "false"
                : "true"
        );

    }


    /*
     * -----------------------------------------------------
     * DROPZONE
     * -----------------------------------------------------
 */

    if (
        dom.dropzone
    ) {

        dom.dropzone.classList.toggle(
            "vision-dropzone-disabled",
            active
        );


        dom.dropzone.setAttribute(
            "aria-disabled",
            active
                ? "true"
                : "false"
        );

    }


    /*
     * -----------------------------------------------------
     * START VISUAL PROGRESS
     * -----------------------------------------------------
 *
     * Jangan mengubah nilai state.
     *
     * Jika progress state sudah tersedia,
     * langsung render nilai tersebut.
     */

    if (
        active
    ) {

        let currentProgress =
            5;


        try {

            const process =
                getState().getProcess();


            const stateProgress =
                Number(
                    process?.progress
                );


            if (
                Number.isFinite(
                    stateProgress
                ) &&
                stateProgress > 0
            ) {

                currentProgress =
                    stateProgress;

            }

        } catch (
            error
        ) {

            console.warn(
                "[GEN-Z.AI Vision] Progress state read failed:",
                error
            );

        }


        setProgress(
            currentProgress,
            `${Math.round(currentProgress)}%`
        );

    }

    else {

        /*
         * Jangan menghapus progress 100%
         * jika proses selesai.
         *
         * Caller yang memanggil setProcessing(false)
         * akan menentukan hasil akhirnya.
         */

        if (
            dom.progress
        ) {

            dom.progress.classList.remove(
                "vision-progress-active"
            );

        }

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


    const value =
        String(
            text ||
            ""
        );


    if (
        dom.generateButtonText
    ) {

        dom.generateButtonText.textContent =
            value;

        return true;

    }


    const textElement =
        dom.generateButton
            .querySelector(
                ".vision-action-text"
            );


    if (
        textElement
    ) {

        textElement.textContent =
            value;

        return true;

    }


    return false;

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


    setCopyState(
        false,
        false
    );


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


    setCopyState(
        true,
        false
    );


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


    setCopyState(
        false,
        false
    );


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


    let text =
        "";


    if (
        typeof analysis ===
        "string"
    ) {

        text =
            analysis;

    }

    else {

        try {

            text =
                JSON.stringify(
                    analysis,
                    null,
                    2
                );

        }

        catch (
            error
        ) {

            console.error(
                "[GEN-Z.AI Vision] Analysis render failed:",
                error
            );


            text =
                String(
                    analysis ||
                    ""
                );

        }

    }


    text =
        text.trim();


    if (
        text
    ) {

        dom.analysisResult.textContent =
            text;

    }

    else {

        dom.analysisResult.textContent =
            "Belum ada hasil analisis.";

    }


    if (
        dom.analysisDetails
    ) {

        dom.analysisDetails.hidden =
            false;

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
            "Belum ada hasil analisis.";

    }


    if (
        dom.analysisDetails
    ) {

        dom.analysisDetails.open =
            false;

        dom.analysisDetails.hidden =
            false;

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


    const canCopy =
        Boolean(
            available
        );


    dom.copyButton.disabled =
        !canCopy;


    dom.copyButton.classList.toggle(
        "vision-copy-success",
        Boolean(
            copied
        )
    );


    dom.copyButton.setAttribute(
        "aria-label",
        copied
            ? "Prompt copied"
            : "Copy prompt"
    );


    dom.copyButton.setAttribute(
        "title",
        copied
            ? "Prompt copied"
            : "Copy prompt"
    );


    if (
        copied
    ) {

        dom.copyButton.textContent =
            "COPIED";

    }

    else {

        dom.copyButton.textContent =
            "COPY";

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
        )
            .trim();


    setStatus(
        VISION_UI_STATUS.ERROR,
        "Vision process gagal"
    );


    setStatusSubtext(
        VISION_UI_STATUS.ERROR
    );


    setProgress(
        0,
        "ERROR"
    );


    if (
        getDOM().progress
    ) {

        getDOM().progress.hidden =
            false;

        getDOM().progress.classList.remove(
            "vision-progress-active"
        );

    }


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
        )
            .trim();


    if (
        !text
    ) {

        return false;

    }


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
        )
            .trim();


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


    if (
        getDOM().progress
    ) {

        getDOM().progress.hidden =
            false;

        getDOM().progress.classList.remove(
            "vision-progress-active"
        );

    }


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
        normalizeStatus(
            status
        );


    const progress =
        options.progress !==
        undefined
            ? options.progress
            : VISION_UI_PROGRESS[
                normalized
            ] ??
            0;


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


    const dom =
        getDOM();


    if (
        dom.progress
    ) {

        dom.progress.hidden =
            normalized ===
                VISION_UI_STATUS.IDLE;

    }


    return true;

}


/* =========================================================
   UPDATE CREDIT
========================================================= */

function updateCredit(
    credits
) {

    const dom =
        getDOM();


    const numericCredits =
        Number(
            credits
        );


    const value =
        Number.isFinite(
            numericCredits
        )
            ? numericCredits
            : 0;


    if (
        dom.credit
    ) {

        dom.credit.textContent =
            String(
                value
            );

    }


    const creditElement =
        dom.creditBalance ||
        dom.credits ||
        dom.userCredits ||
        dom.accountCredits;


    if (
        creditElement
    ) {

        creditElement.textContent =
            String(
                value
            );

    }


    if (
        dom.page
    ) {

        dom.page.dataset.credits =
            String(
                value
            );

    }


    return value;

}


/* =========================================================
   INITIALIZE
========================================================= */

function initialize() {

    const dom =
        getDOM();


    /*
     * -----------------------------------------------------
     * RESULT
     * -----------------------------------------------------
     */

    resetResult();


    /*
     * -----------------------------------------------------
     * ANALYSIS
     * -----------------------------------------------------
     */

    resetAnalysis();


    /*
     * -----------------------------------------------------
     * PROCESSING
     * -----------------------------------------------------
 */

    setProcessing(
        false
    );


    /*
     * -----------------------------------------------------
     * STATUS
     * -----------------------------------------------------
 */

    setStatus(
        VISION_UI_STATUS.IDLE
    );


    setStatusSubtext(
        VISION_UI_STATUS.IDLE
    );


    /*
     * -----------------------------------------------------
     * PROGRESS
     * -----------------------------------------------------
 */

    setProgress(
        0,
        "READY"
    );


    if (
        dom.progress
    ) {

        dom.progress.hidden =
            true;

        dom.progress.classList.remove(
            "vision-progress-active"
        );

        dom.progress.setAttribute(
            "aria-hidden",
            "true"
        );

    }


    /*
     * -----------------------------------------------------
     * COPY
     * -----------------------------------------------------
 */

    setCopyState(
        false,
        false
    );


    /*
     * -----------------------------------------------------
     * SPINNER
     * -----------------------------------------------------
 */

    if (
        dom.generateSpinner
    ) {

        dom.generateSpinner.hidden =
            true;

    }


    /*
     * -----------------------------------------------------
     * GENERATE BUTTON
     * -----------------------------------------------------
 */

    if (
        dom.generateButton
    ) {

        dom.generateButton.disabled =
            false;

        dom.generateButton.removeAttribute(
            "aria-busy"
        );

    }


    return true;

}


/* =========================================================
   SYNC FROM STATE
========================================================= */

function syncFromState() {

    const state =
        getState();


    /*
     * -----------------------------------------------------
     * PROCESS STATE
     * -----------------------------------------------------
     *
     * vision-state.js tidak menyediakan state.get().
     *
     * Gunakan API resmi getProcess() agar UI tetap
     * terhubung dengan struktur state yang sebenarnya.
     */

    const process =
        state.getProcess();


    const status =
        normalizeStatus(
            process.status ||
            VISION_UI_STATUS.IDLE
        );


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


    const processing =
        Boolean(
            process.status &&
            ![
                VISION_UI_STATUS.IDLE,
                VISION_UI_STATUS.COMPLETED,
                VISION_UI_STATUS.ERROR
            ]
                .includes(
                    status
                )
        );


    setProcessing(
        processing
    );


    const dom =
        getDOM();


    if (
        dom.progress
    ) {

        dom.progress.hidden =
            !processing &&
            status !==
                VISION_UI_STATUS.COMPLETED &&
            status !==
                VISION_UI_STATUS.ERROR;

    }


    return true;

}


/* =========================================================
   PUBLIC API
========================================================= */

const GENZVisionUI =
    Object.freeze({

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

        updateCredit,

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
