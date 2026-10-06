/* =========================================================
   GEN-Z.AI VISION VIDEO
   ---------------------------------------------------------
   File:
   vision-video/assets/js/vision-video-ui.js

   Fungsi:
   - Rendering UI Vision Video
   - Credit display
   - Button state
   - Loading / progress
   - Status analysis
   - Prompt result
   - Analysis result
   - Video structure result
   - Copy button support
   - Tidak menangani upload
   - Tidak menangani frame extraction
   - Tidak menangani API request
========================================================= */

(function () {

    "use strict";


    /* =====================================================
       CONFIGURATION
    ===================================================== */

    const CONFIG = Object.freeze({

        defaultStatus:
            "Siap menganalisis video.",

        processingStatus:
            "Menganalisis video...",

        successStatus:
            "Analisis video selesai.",

        errorStatus:
            "Analisis video gagal.",

        minimumProgress:
            0,

        maximumProgress:
            100

    });


    /* =====================================================
       DEPENDENCIES
    ===================================================== */

    function getDOM() {

        if (
            !window.GENZVisionVideoDOM
        ) {

            throw new Error(
                "GEN-Z.AI Vision Video DOM belum tersedia."
            );
        }

        return window.GENZVisionVideoDOM;
    }


    function getState() {

        if (
            !window.GENZVisionVideoState
        ) {

            throw new Error(
                "GEN-Z.AI Vision Video State belum tersedia."
            );
        }

        return window.GENZVisionVideoState;
    }


    /* =====================================================
       DOM HELPERS
    ===================================================== */

    function element(key) {

        try {

            return getDOM().get(key);

        } catch (error) {

            return null;
        }
    }


    function setText(key, value) {

        const dom =
            getDOM();

        const el =
            element(key);

        if (!el) {
            return false;
        }

        dom.setText(
            key,
            value == null
                ? ""
                : String(value)
        );

        return true;
    }


    function show(key) {

        const el =
            element(key);

        if (!el) {
            return false;
        }

        getDOM().show(key);

        return true;
    }


    function hide(key) {

        const el =
            element(key);

        if (!el) {
            return false;
        }

        getDOM().hide(key);

        return true;
    }


    function enable(key) {

        const el =
            element(key);

        if (!el) {
            return false;
        }

        getDOM().enable(key);

        return true;
    }


    function disable(key) {

        const el =
            element(key);

        if (!el) {
            return false;
        }

        getDOM().disable(key);

        return true;
    }


    function addClass(key, className) {

        const el =
            element(key);

        if (!el) {
            return false;
        }

        getDOM().addClass(
            key,
            className
        );

        return true;
    }


    function removeClass(key, className) {

        const el =
            element(key);

        if (!el) {
            return false;
        }

        getDOM().removeClass(
            key,
            className
        );

        return true;
    }


    /* =====================================================
       NUMBER FORMAT
    ===================================================== */

    function formatNumber(value) {

        const number =
            Number(value);


        if (
            !Number.isFinite(number)
        ) {

            return "0";
        }


        try {

            return new Intl.NumberFormat(
                "id-ID"
            ).format(number);

        } catch (error) {

            return String(
                Math.round(number)
            );
        }
    }


    /* =====================================================
       CREDIT
    ===================================================== */

    function renderCredit(value) {

        const credit =
            Number(value);


        setText(
            "creditValue",
            Number.isFinite(credit)
                ? formatNumber(credit)
                : "0"
        );
    }


    function renderCreditFromState() {

        const state =
            getState();


        const credit =
            state.getValue(
                "credit.balance",
                0
            );


        renderCredit(
            credit
        );
    }


    /* =====================================================
       BUTTON
    ===================================================== */

    function setAnalyzeButtonLoading(
        loading,
        text
    ) {

        const button =
            element(
                "analyzeButton"
            );


        if (!button) {
            return;
        }


        const label =
            text ||
            (
                loading
                    ? "Menganalisis..."
                    : "Analyze Video"
            );


        setText(
            "analyzeButtonText",
            label
        );


        const spinner =
            element(
                "analyzeSpinner"
            );


        if (spinner) {

            if (loading) {

                show(
                    "analyzeSpinner"
                );

            } else {

                hide(
                    "analyzeSpinner"
                );
            }
        }


        if (loading) {

            disable(
                "analyzeButton"
            );

            addClass(
                "analyzeButton",
                "is-loading"
            );

        } else {

            enable(
                "analyzeButton"
            );

            removeClass(
                "analyzeButton",
                "is-loading"
            );
        }
    }


    /* =====================================================
       BUTTON VALIDATION
    ===================================================== */

    function updateAnalyzeButton() {

        const state =
            getState();


        const file =
            state.getValue(
                "video.file",
                null
            );


        const processing =
            state.getValue(
                "process.status",
                "idle"
            );


        const hasFile =
            Boolean(file);


        const isProcessing =
            processing === "preparing" ||
            processing === "analyzing";


        if (
            hasFile &&
            !isProcessing
        ) {

            enable(
                "analyzeButton"
            );

        } else {

            disable(
                "analyzeButton"
            );
        }
    }


    /* =====================================================
       STATUS
    ===================================================== */

    function renderStatus(
        message,
        type = "idle"
    ) {

        const text =
            message ||
            CONFIG.defaultStatus;


        setText(
            "statusText",
            text
        );


        const indicator =
            element(
                "statusIndicator"
            );


        if (indicator) {

            indicator.dataset.status =
                type;
        }


        const status =
            element(
                "status"
            );


        if (status) {

            status.dataset.status =
                type;
        }
    }


    function renderIdleStatus() {

        renderStatus(
            CONFIG.defaultStatus,
            "idle"
        );
    }


    function renderProcessingStatus(
        message
    ) {

        renderStatus(
            message ||
                CONFIG.processingStatus,
            "processing"
        );
    }


    function renderSuccessStatus(
        message
    ) {

        renderStatus(
            message ||
                CONFIG.successStatus,
            "success"
        );
    }


    function renderErrorStatus(
        message
    ) {

        renderStatus(
            message ||
                CONFIG.errorStatus,
            "error"
        );
    }


    /* =====================================================
       PROGRESS
    ===================================================== */

    function normalizeProgress(value) {

        const number =
            Number(value);


        if (
            !Number.isFinite(number)
        ) {

            return 0;
        }


        return Math.min(
            CONFIG.maximumProgress,
            Math.max(
                CONFIG.minimumProgress,
                number
            )
        );
    }


    function renderProgress(
        value,
        label
    ) {

        const progress =
            normalizeProgress(
                value
            );


        const bar =
            element(
                "progressBar"
            );


        if (bar) {

            bar.style.width =
                progress + "%";

            bar.setAttribute(
                "aria-valuenow",
                String(progress)
            );
        }


        setText(
            "progressText",
            label ||
                `${Math.round(progress)}%`
        );
    }


    function resetProgress() {

        renderProgress(
            0,
            "0%"
        );
    }


    function completeProgress() {

        renderProgress(
            100,
            "100%"
        );
    }


    /* =====================================================
       PROCESS STATE
    ===================================================== */

    function renderProcessState(
        process
    ) {

        const status =
            process &&
            process.status
                ? process.status
                : "idle";


        const progress =
            process &&
            Number.isFinite(
                Number(process.progress)
            )
                ? Number(
                    process.progress
                )
                : 0;


        const message =
            process &&
            process.message
                ? process.message
                : "";


        switch (status) {

            case "preparing":

                setAnalyzeButtonLoading(
                    true,
                    "Menyiapkan..."
                );

                renderProcessingStatus(
                    message ||
                    "Menyiapkan frame video..."
                );

                renderProgress(
                    progress,
                    `${Math.round(progress)}%`
                );

                break;


            case "analyzing":

                setAnalyzeButtonLoading(
                    true,
                    "Menganalisis..."
                );

                renderProcessingStatus(
                    message ||
                    CONFIG.processingStatus
                );

                renderProgress(
                    progress,
                    `${Math.round(progress)}%`
                );

                break;


            case "complete":

                setAnalyzeButtonLoading(
                    false,
                    "Analyze Video"
                );

                renderSuccessStatus(
                    message ||
                    CONFIG.successStatus
                );

                completeProgress();

                break;


            case "error":

                setAnalyzeButtonLoading(
                    false,
                    "Analyze Video"
                );

                renderErrorStatus(
                    message ||
                    CONFIG.errorStatus
                );

                renderProgress(
                    progress,
                    `${Math.round(progress)}%`
                );

                break;


            case "cancelled":

                setAnalyzeButtonLoading(
                    false,
                    "Analyze Video"
                );

                renderStatus(
                    message ||
                    "Analisis dibatalkan.",
                    "cancelled"
                );

                renderProgress(
                    progress,
                    `${Math.round(progress)}%`
                );

                break;


            default:

                setAnalyzeButtonLoading(
                    false,
                    "Analyze Video"
                );

                renderIdleStatus();

                renderProgress(
                    0,
                    "0%"
                );

                break;
        }


        updateAnalyzeButton();
    }


    /* =====================================================
       PROMPT
    ===================================================== */

    function renderPrompt(
        prompt
    ) {

        const value =
            typeof prompt === "string"
                ? prompt.trim()
                : "";


        const result =
            element(
                "promptResult"
            );


        const placeholder =
            element(
                "promptPlaceholder"
            );


        if (!value) {

            if (result) {

                result.textContent =
                    "";
            }


            if (placeholder) {

                show(
                    "promptPlaceholder"
                );
            }


            hide(
                "copyButton"
            );

            return;
        }


        if (result) {

            result.textContent =
                value;
        }


        if (placeholder) {

            hide(
                "promptPlaceholder"
            );
        }


        show(
            "copyButton"
        );
    }


    function clearPrompt() {

        renderPrompt(
            ""
        );
    }


    /* =====================================================
       ANALYSIS
    ===================================================== */

    function renderAnalysis(
        analysis
    ) {

        const value =
            normalizeAnalysisText(
                analysis
            );


        const result =
            element(
                "analysisResult"
            );


        const placeholder =
            element(
                "analysisPlaceholder"
            );


        if (!value) {

            if (result) {

                result.textContent =
                    "";
            }


            if (placeholder) {

                show(
                    "analysisPlaceholder"
                );
            }


            return;
        }


        if (result) {

            result.textContent =
                value;
        }


        if (placeholder) {

            hide(
                "analysisPlaceholder"
            );
        }
    }


    function normalizeAnalysisText(
        analysis
    ) {

        if (
            typeof analysis === "string"
        ) {

            return analysis.trim();
        }


        if (
            Array.isArray(analysis)
        ) {

            return analysis
                .map(function (item) {

                    return normalizeAnalysisText(
                        item
                    );

                })
                .filter(Boolean)
                .join("\n");
        }


        if (
            analysis &&
            typeof analysis === "object"
        ) {

            if (
                typeof analysis.content === "string"
            ) {

                return analysis.content.trim();
            }


            if (
                typeof analysis.result === "string"
            ) {

                return analysis.result.trim();
            }


            try {

                return JSON.stringify(
                    analysis,
                    null,
                    2
                );

            } catch (error) {

                return "";
            }
        }


        return "";
    }


    function clearAnalysis() {

        renderAnalysis(
            ""
        );
    }


    /* =====================================================
       VIDEO STRUCTURE
    ===================================================== */

    function renderStructure(
        structure
    ) {

        if (!structure) {
            return;
        }


        if (
            typeof structure !== "object"
        ) {

            return;
        }


        setText(
            "sceneCount",
            formatStructureValue(
                structure.sceneCount
            )
        );


        setText(
            "subject",
            formatStructureValue(
                structure.subject
            )
        );


        setText(
            "camera",
            formatStructureValue(
                structure.camera
            )
        );


        setText(
            "motion",
            formatStructureValue(
                structure.motion
            )
        );


        setText(
            "environment",
            formatStructureValue(
                structure.environment
            )
        );


        setText(
            "lighting",
            formatStructureValue(
                structure.lighting
            )
        );
    }


    function formatStructureValue(
        value
    ) {

        if (
            value === null ||
            value === undefined
        ) {

            return "-";
        }


        if (
            typeof value === "number"
        ) {

            return String(value);
        }


        if (
            typeof value === "string"
        ) {

            return value.trim() || "-";
        }


        if (
            Array.isArray(value)
        ) {

            return value
                .map(function (item) {

                    return formatStructureValue(
                        item
                    );

                })
                .filter(function (item) {

                    return item !== "-";

                })
                .join(", ") || "-";
        }


        try {

            return JSON.stringify(
                value,
                null,
                2
            );

        } catch (error) {

            return "-";
        }
    }


    /* =====================================================
       VIDEO METADATA
    ===================================================== */

    function renderVideoMetadata() {

        const state =
            getState();


        const metadata =
            state.getValue(
                "video.metadata",
                {}
            );


        if (!metadata) {
            return;
        }


        const duration =
            Number(
                metadata.duration
            );


        if (
            Number.isFinite(
                duration
            ) &&
            duration > 0
        ) {

            setText(
                "fileDuration",
                formatDuration(
                    duration
                )
            );
        }


        const width =
            Number(
                metadata.width
            );


        const height =
            Number(
                metadata.height
            );


        if (
            width > 0 &&
            height > 0
        ) {

            setText(
                "fileResolution",
                `${width} × ${height}`
            );
        }


        const fps =
            Number(
                metadata.fps
            );


        if (
            Number.isFinite(fps) &&
            fps > 0
        ) {

            setText(
                "fileFPS",
                `${fps.toFixed(2)} FPS`
            );
        }
    }


    function formatDuration(
        seconds
    ) {

        const value =
            Math.max(
                0,
                Number(seconds) || 0
            );


        const hours =
            Math.floor(
                value / 3600
            );


        const minutes =
            Math.floor(
                (value % 3600) / 60
            );


        const secs =
            Math.floor(
                value % 60
            );


        if (hours > 0) {

            return [
                String(hours)
                    .padStart(2, "0"),

                String(minutes)
                    .padStart(2, "0"),

                String(secs)
                    .padStart(2, "0")

            ].join(":");
        }


        return [
            String(minutes)
                .padStart(2, "0"),

            String(secs)
                .padStart(2, "0")

        ].join(":");
    }


    /* =====================================================
       FILE INFO
    ===================================================== */

    function renderFileInfo() {

        const state =
            getState();


        const file =
            state.getValue(
                "video.file",
                null
            );


        if (!file) {
            return;
        }


        setText(
            "fileName",
            file.name ||
                "Video"
        );


        setText(
            "fileSize",
            formatFileSize(
                file.size
            )
        );


        renderVideoMetadata();
    }


    function formatFileSize(
        bytes
    ) {

        const value =
            Number(bytes);


        if (
            !Number.isFinite(value) ||
            value <= 0
        ) {

            return "0 B";
        }


        const units = [
            "B",
            "KB",
            "MB",
            "GB",
            "TB"
        ];


        const index =
            Math.min(
                Math.floor(
                    Math.log(value) /
                    Math.log(1024)
                ),
                units.length - 1
            );


        const size =
            value /
            Math.pow(
                1024,
                index
            );


        return `${size.toFixed(
            index === 0 ? 0 : 2
        )} ${units[index]}`;
    }


    /* =====================================================
       UPLOAD / PREVIEW UI
    ===================================================== */

    function renderUploadState(
        hasVideo
    ) {

        if (hasVideo) {

            hide(
                "uploadState"
            );

            show(
                "previewState"
            );

        } else {

            show(
                "uploadState"
            );

            hide(
                "previewState"
            );
        }


        updateAnalyzeButton();
    }


    /* =====================================================
       CREDIT NOTICE
    ===================================================== */

    function renderCreditNotice() {

        const state =
            getState();


        const balance =
            Number(
                state.getValue(
                    "credit.balance",
                    0
                )
            );


        const required =
            Number(
                state.getValue(
                    "credit.required",
                    0
                )
            );


        const notice =
            element(
                "creditNotice"
            );


        if (!notice) {
            return;
        }


        /*
         * Jika backend/provider belum menentukan
         * kebutuhan kredit, jangan membuat angka
         * palsu di frontend.
         */

        if (
            !Number.isFinite(required) ||
            required <= 0
        ) {

            notice.textContent =
                "Credit akan diverifikasi saat proses analisis.";

            removeClass(
                "creditNotice",
                "is-error"
            );

            return;
        }


        if (
            balance < required
        ) {

            notice.textContent =
                `Credit tidak cukup. Dibutuhkan ${formatNumber(required)} credit.`;

            addClass(
                "creditNotice",
                "is-error"
            );

            return;
        }


        notice.textContent =
            `Analisis membutuhkan ${formatNumber(required)} credit.`;

        removeClass(
            "creditNotice",
            "is-error"
        );
    }


    /* =====================================================
       RESET RESULT
    ===================================================== */

    function resetResults() {

        clearPrompt();

        clearAnalysis();


        setText(
            "sceneCount",
            "-"
        );

        setText(
            "subject",
            "-"
        );

        setText(
            "camera",
            "-"
        );

        setText(
            "motion",
            "-"
        );

        setText(
            "environment",
            "-"
        );

        setText(
            "lighting",
            "-"
        );


        resetProgress();

        renderIdleStatus();
    }


    /* =====================================================
       FULL UI SYNC
    ===================================================== */

    function sync() {

        const state =
            getState();


        const file =
            state.getValue(
                "video.file",
                null
            );


        const process =
            state.getValue(
                "process",
                {}
            );


        const prompt =
            state.getValue(
                "prompt.result",
                ""
            );


        const analysis =
            state.getValue(
                "analysis.result",
                ""
            );


        const structure =
            state.getValue(
                "analysis.structure",
                null
            );


        renderCreditFromState();

        renderCreditNotice();

        renderUploadState(
            Boolean(file)
        );

        renderFileInfo();

        renderPrompt(
            prompt
        );

        renderAnalysis(
            analysis
        );

        renderStructure(
            structure
        );

        renderProcessState(
            process
        );
    }


    /* =====================================================
       COPY RESULT
    ===================================================== */

    async function copyPrompt() {

        const state =
            getState();


        const prompt =
            state.getValue(
                "prompt.result",
                ""
            );


        if (
            !prompt ||
            typeof prompt !== "string"
        ) {

            return false;
        }


        try {

            if (
                navigator.clipboard &&
                typeof navigator.clipboard.writeText ===
                    "function"
            ) {

                await navigator.clipboard.writeText(
                    prompt
                );

            } else {

                const textarea =
                    document.createElement(
                        "textarea"
                    );


                textarea.value =
                    prompt;

                textarea.style.position =
                    "fixed";

                textarea.style.opacity =
                    "0";

                document.body.appendChild(
                    textarea
                );

                textarea.focus();

                textarea.select();

                document.execCommand(
                    "copy"
                );

                textarea.remove();
            }


            setText(
                "copyButton",
                "Copied"
            );


            window.setTimeout(
                function () {

                    setText(
                        "copyButton",
                        "Copy Prompt"
                    );

                },
                1500
            );


            return true;

        } catch (error) {

            console.error(
                "[GEN-Z.AI Vision Video] Copy failed:",
                error
            );


            return false;
        }
    }


    /* =====================================================
       API EVENTS
    ===================================================== */

    function handleAPIStart() {

        setAnalyzeButtonLoading(
            true,
            "Menganalisis..."
        );

        renderProcessingStatus(
            "Mengirim frame video untuk dianalisis..."
        );
    }


    function handleAPIComplete(event) {

        const detail =
            event &&
            event.detail
                ? event.detail
                : {};


        const result =
            detail.result;


        if (
            result &&
            result.content
        ) {

            renderAnalysis(
                result.content
            );
        }


        setAnalyzeButtonLoading(
            false,
            "Analyze Video"
        );


        renderSuccessStatus(
            "Analisis video selesai."
        );


        completeProgress();

        updateAnalyzeButton();
    }


    function handleAPIError(event) {

        const detail =
            event &&
            event.detail
                ? event.detail
                : {};


        renderErrorStatus(
            detail.error ||
            "Analisis video gagal."
        );


        setAnalyzeButtonLoading(
            false,
            "Analyze Video"
        );


        updateAnalyzeButton();
    }


    /* =====================================================
       ANALYSIS EVENTS
    ===================================================== */

    function handleAnalysisPrepared(event) {

        const detail =
            event &&
            event.detail
                ? event.detail
                : {};


        const progress =
            Number(
                detail.progress
            );


        if (
            Number.isFinite(progress)
        ) {

            renderProgress(
                progress,
                `${Math.round(progress)}%`
            );
        }
    }


    function handleAnalysisError(event) {

        const detail =
            event &&
            event.detail
                ? event.detail
                : {};


        renderErrorStatus(
            detail.error ||
            "Persiapan analisis video gagal."
        );


        setAnalyzeButtonLoading(
            false,
            "Analyze Video"
        );


        updateAnalyzeButton();
    }


    /* =====================================================
       PROCESS EVENTS
    ===================================================== */

    function handleProcessProgress(event) {

        const detail =
            event &&
            event.detail
                ? event.detail
                : {};


        const progress =
            Number(
                detail.progress
            );


        if (
            Number.isFinite(progress)
        ) {

            renderProgress(
                progress,
                detail.message ||
                `${Math.round(progress)}%`
            );
        }


        if (
            detail.message
        ) {

            renderProcessingStatus(
                detail.message
            );
        }
    }


    /* =====================================================
       EVENT BINDING
    ===================================================== */

    let bound = false;


    function bind() {

        if (bound) {
            return;
        }


        bound = true;


        document.addEventListener(
            "genz:vision-video:metadata-ready",
            function () {

                renderVideoMetadata();

                updateAnalyzeButton();

            }
        );


        document.addEventListener(
            "genz:vision-video:file-selected",
            function () {

                renderUploadState(
                    true
                );

                renderFileInfo();

                resetResults();

                renderCreditNotice();

            }
        );


        document.addEventListener(
            "genz:vision-video:file-removed",
            function () {

                renderUploadState(
                    false
                );

                resetResults();

                updateAnalyzeButton();

            }
        );


        document.addEventListener(
            "genz:vision-video:analysis-prepared",
            handleAnalysisPrepared
        );


        document.addEventListener(
            "genz:vision-video:analysis-error",
            handleAnalysisError
        );


        document.addEventListener(
            "genz:vision-video:api-start",
            handleAPIStart
        );


        document.addEventListener(
            "genz:vision-video:api-analysis-complete",
            handleAPIComplete
        );


        document.addEventListener(
            "genz:vision-video:api-analysis-error",
            handleAPIError
        );


        document.addEventListener(
            "genz:vision-video:process-progress",
            handleProcessProgress
        );


        const copyButton =
            element(
                "copyButton"
            );


        if (copyButton) {

            copyButton.addEventListener(
                "click",
                function () {

                    copyPrompt();

                }
            );
        }


        sync();
    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    const API = {

        config:
            CONFIG,

        renderCredit,

        renderCreditFromState,

        renderCreditNotice,

        setAnalyzeButtonLoading,

        updateAnalyzeButton,

        renderStatus,

        renderIdleStatus,

        renderProcessingStatus,

        renderSuccessStatus,

        renderErrorStatus,

        renderProgress,

        resetProgress,

        completeProgress,

        renderProcessState,

        renderPrompt,

        clearPrompt,

        renderAnalysis,

        clearAnalysis,

        renderStructure,

        renderVideoMetadata,

        renderFileInfo,

        renderUploadState,

        resetResults,

        sync,

        copyPrompt,

        bind

    };


    window.GENZVisionVideoUI =
        API;

    window.GENZVisionVideoUIReady =
        true;


    /*
     * Bind hanya jika DOM sudah tersedia.
     * Loader tetap menjadi pengendali utama.
     */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            bind,
            {
                once: true
            }
        );

    } else {

        bind();
    }


    console.log(
        "[GEN-Z.AI Vision Video] UI module ready."
    );

})();
