/* =========================================================
   GEN-Z.AI VISION VIDEO
   ---------------------------------------------------------
   File:
   vision-video/assets/js/vision-video-events.js

   Fungsi:
   - Event coordinator Vision Video
   - Analyze button
   - Sinkronisasi form ke state
   - Validasi video
   - CHECK credit
   - DEDUCT 1 credit
   - Menjalankan analysis preparation
   - Menjalankan API analysis
   - Menyimpan hasil ke generation_history
   - REFUND credit jika proses analysis gagal
   - Reset / cancel process

   ATURAN:
   - 1 generate prompt = 1 credit
   - Credit hanya dideduct satu kali
   - Credit tidak dideduct jika validasi gagal
   - Credit direfund jika proses setelah deduction gagal
   - History success disimpan setelah prompt berhasil
   - History failure disimpan ketika proses gagal
   - Tidak menyentuh Vision Image
========================================================= */

(function () {

    "use strict";


    /* =====================================================
       CONFIGURATION
    ===================================================== */

    const CONFIG = Object.freeze({

        creditCost:
            1,

        events: {

            metadataReady:
                "genz:vision-video:metadata-ready",

            fileSelected:
                "genz:vision-video:file-selected",

            fileRemoved:
                "genz:vision-video:file-removed",

            previewCleared:
                "genz:vision-video:preview-cleared",

            analysisPrepared:
                "genz:vision-video:analysis-prepared",

            analysisError:
                "genz:vision-video:analysis-error",

            apiStart:
                "genz:vision-video:api-start",

            apiComplete:
                "genz:vision-video:api-analysis-complete",

            apiError:
                "genz:vision-video:api-analysis-error",

            processProgress:
                "genz:vision-video:process-progress",

            processComplete:
                "genz:vision-video:process-complete"

        }

    });


    /* =====================================================
       DEPENDENCIES
    ===================================================== */

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


    function getAnalysis() {

        if (
            !window.GENZVisionVideoAnalysis
        ) {

            throw new Error(
                "GEN-Z.AI Vision Video Analysis belum tersedia."
            );
        }

        return window.GENZVisionVideoAnalysis;
    }


    function getAPI() {

        if (
            !window.GENZVisionVideoAPI
        ) {

            throw new Error(
                "GEN-Z.AI Vision Video API belum tersedia."
            );
        }

        return window.GENZVisionVideoAPI;
    }


    function getUI() {

        if (
            !window.GENZVisionVideoUI
        ) {

            throw new Error(
                "GEN-Z.AI Vision Video UI belum tersedia."
            );
        }

        return window.GENZVisionVideoUI;
    }


    function getCredit() {

        if (
            !window.GENZVisionVideoCredit
        ) {

            throw new Error(
                "GEN-Z.AI Vision Video Credit belum tersedia."
            );
        }

        return window.GENZVisionVideoCredit;
    }


    function getHistory() {

        if (
            !window.GENZVisionVideoHistory
        ) {

            throw new Error(
                "GEN-Z.AI Vision Video History belum tersedia."
            );
        }

        return window.GENZVisionVideoHistory;
    }


    /* =====================================================
       EVENT DISPATCH
    ===================================================== */

    function dispatch(
        name,
        detail = {}
    ) {

        try {

            document.dispatchEvent(
                new CustomEvent(
                    name,
                    {
                        detail
                    }
                )
            );

        } catch (error) {

            console.warn(
                "[GEN-Z.AI Vision Video] Event dispatch gagal:",
                name,
                error
            );
        }
    }


    /* =====================================================
       FORM VALUE
    ===================================================== */

    function readValue(
        key
    ) {

        const dom =
            getDOM();


        const element =
            dom.get(key);


        if (!element) {

            return "";

        }


        return (
            element.value ??
            ""
        );
    }


    /* =====================================================
       FORM BOOLEAN
    ===================================================== */

    function readChecked(
        key
    ) {

        const dom =
            getDOM();


        const element =
            dom.get(key);


        if (!element) {

            return false;

        }


        return Boolean(
            element.checked
        );
    }


    /* =====================================================
       SYNC FORM TO STATE
    ===================================================== */

    function syncFormToState() {

        const state =
            getState();


        const settings = {

            model:
                readValue(
                    "model"
                ).trim(),

            detail:
                readValue(
                    "detail"
                ).trim() ||
                "standard",

            frameMode:
                readValue(
                    "frameMode"
                ).trim() ||
                "auto",

            purpose:
                readValue(
                    "purpose"
                ).trim() ||
                "general",

            instruction:
                readValue(
                    "instruction"
                ).trim()

        };


        state.setSettings(
            settings
        );


        return settings;
    }


    /* =====================================================
       READ CURRENT SETTINGS
    ===================================================== */

    function getCurrentSettings() {

        const state =
            getState();


        const settings =
            state.getValue(
                "settings",
                {}
            ) || {};


        return {

            model:
                settings.model ||
                "",

            detail:
                settings.detail ||
                "standard",

            frameMode:
                settings.frameMode ||
                "auto",

            purpose:
                settings.purpose ||
                "general",

            instruction:
                settings.instruction ||
                ""

        };
    }


    /* =====================================================
       VALIDATE VIDEO
       -----------------------------------------------------
       FIX:
       State aktual menyimpan metadata langsung:
       video.duration
       video.width
       video.height
       video.fps

       BUKAN:
       video.metadata.duration
       video.metadata.width
       dst.
    ===================================================== */

    function validateVideo() {

        const state =
            getState();


        const file =
            state.getValue(
                "video.file",
                null
            );


        if (!file) {

            return {

                valid:
                    false,

                message:
                    "Silakan upload video terlebih dahulu."

            };
        }


        const duration =
            Number(
                state.getValue(
                    "video.duration",
                    0
                )
            );


        if (
            !Number.isFinite(duration) ||
            duration <= 0
        ) {

            return {

                valid:
                    false,

                message:
                    "Metadata video belum siap."

            };
        }


        const width =
            Number(
                state.getValue(
                    "video.width",
                    0
                )
            );


        const height =
            Number(
                state.getValue(
                    "video.height",
                    0
                )
            );


        if (
            !Number.isFinite(width) ||
            !Number.isFinite(height) ||
            width <= 0 ||
            height <= 0
        ) {

            return {

                valid:
                    false,

                message:
                    "Resolusi video belum dapat dibaca."

            };
        }


        return {

            valid:
                true,

            message:
                ""

        };
    }


    /* =====================================================
       VALIDATE SETTINGS
    ===================================================== */

    function validateSettings() {

        const settings =
            getCurrentSettings();


        if (!settings.model) {

            return {

                valid:
                    false,

                message:
                    "Model Vision Video belum dipilih."

            };
        }


        return {

            valid:
                true,

            message:
                ""

        };
    }


    /* =====================================================
       VALIDATE CREDIT
    ===================================================== */

    function validateCreditLocal() {

        const credit =
            getCredit();


        const required =
            typeof credit.getCost ===
                "function"
                ? credit.getCost()
                : CONFIG.creditCost;


        const current =
            typeof credit.getCurrentCredit ===
                "function"
                ? credit.getCurrentCredit()
                : 0;


        if (
            current <
            required
        ) {

            const error =
                new Error(
                    `Credit tidak mencukupi. Diperlukan ${required} credit, saldo saat ini ${current} credit.`
                );


            error.code =
                "INSUFFICIENT_CREDITS";


            error.currentCredits =
                current;


            error.requiredCredits =
                required;


            throw error;

        }


        return true;
    }


    /* =====================================================
       VALIDATE COMPLETE FORM
    ===================================================== */

    function validateForm() {

        const video =
            validateVideo();


        if (!video.valid) {

            return video;

        }


        const settings =
            validateSettings();


        if (!settings.valid) {

            return settings;

        }


        return {

            valid:
                true,

            message:
                ""

        };
    }


    /* =====================================================
       PROGRESS
    ===================================================== */

    function setProgress(
        progress,
        message
    ) {

        const state =
            getState();


        const value =
            Math.max(
                0,
                Math.min(
                    100,
                    Number(progress) || 0
                )
            );


        state.setProcess({

            progress:
                value,

            message:
                message ||
                ""

        });


        dispatch(
            CONFIG.events.processProgress,
            {

                progress:
                    value,

                message:
                    message ||
                    ""

            }
        );
    }


    /* =====================================================
       PREPARATION PROGRESS
    ===================================================== */

    function handlePreparationProgress(
        progress
    ) {

        const value =
            Number(progress);


        if (
            !Number.isFinite(value)
        ) {

            return;

        }


        setProgress(
            value,
            "Menyiapkan frame video..."
        );
    }


    /* =====================================================
       BUILD ANALYSIS PAYLOAD
    ===================================================== */

    async function prepareAnalysis() {

        const analysis =
            getAnalysis();


        const settings =
            getCurrentSettings();


        return analysis.prepareAnalysis({

            mode:
                settings.frameMode,

            detail:
                settings.detail,

            purpose:
                settings.purpose,

            includeDataURL:
                true,

            onProgress:
                handlePreparationProgress

        });
    }


    /* =====================================================
       RUN API ANALYSIS
    ===================================================== */

    async function runAPIAnalysis(
        prepared
    ) {

        const api =
            getAPI();


        if (
            !prepared ||
            !prepared.payload
        ) {

            throw new Error(
                "Analysis payload belum tersedia."
            );
        }


        setProgress(
            60,
            "Mengirim frame ke Vision Engine..."
        );


        const settings =
            getCurrentSettings();


        const result =
            await api.analyze(
                prepared.payload,
                {

                    model:
                        settings.model,

                    detail:
                        settings.detail

                }
            );


        setProgress(
            90,
            "Menyusun hasil analysis..."
        );


        return result;
    }


    /* =====================================================
       GENERATE PROMPT FROM ANALYSIS
    ===================================================== */

    function buildPromptFromAnalysis(
        result
    ) {

        if (!result) {

            return "";

        }


        const content =
            typeof result.content ===
                "string"
                ? result.content.trim()
                : "";


        if (!content) {

            return "";

        }


        return content;
    }


    /* =====================================================
       STORE PROMPT
    ===================================================== */

    function storePrompt(
        result
    ) {

        const state =
            getState();


        const prompt =
            buildPromptFromAnalysis(
                result
            );


        if (!prompt) {

            return "";

        }


        state.setPrompt(
            prompt
        );


        return prompt;
    }


    /* =====================================================
       CREATE PROCESS TASK ID
    ===================================================== */

    function ensureTaskId() {

        const state =
            getState();


        const existing =
            String(
                state.getValue(
                    "process.taskId",
                    ""
                ) ||
                ""
            ).trim();


        if (existing) {

            return existing;

        }


        const history =
            getHistory();


        const taskId =
            history.createTaskId();


        state.setProcess({

            taskId

        });


        return taskId;
    }


    /* =====================================================
       CREDIT METADATA
    ===================================================== */

    function getCreditMetadata() {

        const state =
            getState();


        const settings =
            getCurrentSettings();


        const taskId =
            ensureTaskId();


        return {

            taskId,

            modelId:
                settings.model,

            modelName:
                settings.model

        };
    }


    /* =====================================================
       CHECK CREDIT
    ===================================================== */

    async function checkCredit() {

        const credit =
            getCredit();


        /*
         * Server adalah authority.
         *
         * Jangan hanya mengandalkan saldo lokal,
         * karena saldo dapat berubah dari tab/proses lain.
         */

        const result =
            await credit.checkCredit();


        if (
            !result ||
            result.sufficient !== true
        ) {

            const error =
                new Error(
                    "Credit tidak mencukupi."
                );


            error.code =
                "INSUFFICIENT_CREDITS";


            throw error;

        }


        return result;
    }


    /* =====================================================
       DEDUCT CREDIT
    ===================================================== */

    async function deductCredit() {

        const credit =
            getCredit();


        const metadata =
            getCreditMetadata();


        /*
         * Pastikan state operasi credit bersih
         * untuk generate baru.
         */

        credit.resetOperationState();


        /*
         * CHECK lagi di server sebelum deduction.
         *
         * Ini sengaja tidak mengandalkan CHECK
         * yang dilakukan saat page initialization.
         */

        await checkCredit();


        /*
         * DEDUCT tepat satu kali.
         */

        const result =
            await credit.deductCredit(
                metadata
            );


        if (
            !result ||
            (
                result.deducted !== true &&
                result.alreadyDeducted !== true
            )
        ) {

            throw new Error(
                "Credit gagal dipotong."
            );

        }


        return result;
    }


    /* =====================================================
       REFUND CREDIT
    ===================================================== */

    async function refundCredit() {

        const credit =
            getCredit();


        const creditState =
            credit.getCreditState();


        if (
            !creditState.deducted ||
            creditState.refunded
        ) {

            return {

                refunded:
                    false,

                skipped:
                    true

            };

        }


        const metadata =
            getCreditMetadata();


        return credit.refundCredit(
            metadata
        );
    }


    /* =====================================================
       SAVE SUCCESS HISTORY
    ===================================================== */

    async function saveSuccessHistory(
        prompt
    ) {

        const state =
            getState();


        const history =
            getHistory();


        const settings =
            getCurrentSettings();


        const taskId =
            ensureTaskId();


        const result =
            await history.saveSuccess({

                taskId,

                model:
                    settings.model,

                modelName:
                    settings.model,

                prompt,

                settings,

                file:
                    state.getValue(
                        "video",
                        {}
                    ),

                creditCost:
                    CONFIG.creditCost

            });


        return result;
    }


    /* =====================================================
       SAVE FAILED HISTORY
    ===================================================== */

    async function saveFailedHistory(
        error
    ) {

        const state =
            getState();


        const history =
            getHistory();


        const settings =
            getCurrentSettings();


        const taskId =
            ensureTaskId();


        try {

            return await history.saveFailed(
                error,
                {

                    taskId,

                    model:
                        settings.model,

                    modelName:
                        settings.model,

                    settings,

                    file:
                        state.getValue(
                            "video",
                            {}
                        ),

                    creditCost:
                        CONFIG.creditCost

                }
            );

        } catch (historyError) {

            console.warn(
                "[GEN-Z.AI Vision Video] Failed history save gagal:",
                historyError
            );


            return null;
        }
    }


    /* =====================================================
       MAIN ANALYZE FLOW
    ===================================================== */

    let analysisRunning =
        false;


    async function analyzeVideo() {

        if (analysisRunning) {

            return null;

        }


        const state =
            getState();


        const ui =
            getUI();


        const validation =
            validateForm();


        if (!validation.valid) {

            ui.renderErrorStatus(
                validation.message
            );


            return null;

        }


        analysisRunning =
            true;


        let creditWasDeducted =
            false;


        let prompt =
            "";


        try {

            /* =============================================
               FORM
            ============================================= */

            syncFormToState();


            /* =============================================
               RESET RESULT
            ============================================= */

            state.setPrompt(
                ""
            );


            state.setAnalysis({

                status:
                    "preparing",

                result:
                    "",

                raw:
                    null,

                structure:
                    null

            });


            state.setProcess({

                status:
                    "preparing",

                progress:
                    0,

                message:
                    "Menyiapkan analisis video...",

                error:
                    null

            });


            ui.resetResults();


            ui.setAnalyzeButtonLoading(
                true,
                "Memeriksa credit..."
            );


            ui.renderProcessingStatus(
                "Memeriksa credit..."
            );


            setProgress(
                5,
                "Memeriksa credit..."
            );


            /* =============================================
               TASK ID
            ============================================= */

            ensureTaskId();


            /* =============================================
               CREDIT CHECK + DEDUCT
            ============================================= */

            const creditResult =
                await deductCredit();


            creditWasDeducted =
                creditResult.deducted === true ||
                creditResult.alreadyDeducted === true;


            ui.updateCredit();


            setProgress(
                12,
                "Credit terverifikasi. Menyiapkan video..."
            );


            /* =============================================
               PREPARATION
            ============================================= */

            ui.setAnalyzeButtonLoading(
                true,
                "Menyiapkan..."
            );


            ui.renderProcessingStatus(
                "Menyiapkan frame video..."
            );


            const prepared =
                await prepareAnalysis();


            if (
                !prepared ||
                !prepared.payload
            ) {

                throw new Error(
                    "Gagal menyiapkan payload analisis video."
                );

            }


            dispatch(
                CONFIG.events.analysisPrepared,
                prepared
            );


            /* =============================================
               API ANALYSIS
            ============================================= */

            state.setProcess({

                status:
                    "analyzing",

                progress:
                    55,

                message:
                    "Menganalisis frame video..."

            });


            ui.setAnalyzeButtonLoading(
                true,
                "Menganalisis..."
            );


            ui.renderProcessingStatus(
                "Menganalisis frame video..."
            );


            dispatch(
                CONFIG.events.apiStart,
                {

                    prepared

                }
            );


            const result =
                await runAPIAnalysis(
                    prepared
                );


            if (!result) {

                throw new Error(
                    "Vision Engine tidak mengembalikan hasil."
                );

            }


            dispatch(
                CONFIG.events.apiComplete,
                {

                    result,

                    prepared

                }
            );


            /* =============================================
               BUILD PROMPT
            ============================================= */

            prompt =
                storePrompt(
                    result
                );


            if (!prompt) {

                throw new Error(
                    "Vision Engine tidak menghasilkan prompt."
                );

            }


            state.setProcess({

                status:
                    "saving",

                progress:
                    94,

                message:
                    "Menyimpan riwayat..."

            });


            ui.renderProcessingStatus(
                "Menyimpan hasil ke history..."
            );


            /* =============================================
               SAVE HISTORY
               ---------------------------------------------
               History gagal TIDAK membatalkan prompt
               yang sudah berhasil dibuat.
               Credit tetap terpotong karena generate
               berhasil.
            ============================================= */

            try {

                await saveSuccessHistory(
                    prompt
                );

            } catch (historyError) {

                console.warn(
                    "[GEN-Z.AI Vision Video] History save gagal:",
                    historyError
                );

            }


            /* =============================================
               COMPLETE
            ============================================= */

            setProgress(
                100,
                "Analisis video selesai."
            );


            state.completeAnalysis(
                result.content
            );


            state.setProcess({

                status:
                    "complete",

                progress:
                    100,

                message:
                    "Analisis video selesai.",

                error:
                    null

            });


            ui.renderAnalysis(
                result.content
            );


            ui.renderPrompt(
                prompt
            );


            ui.renderSuccessStatus(
                "Analisis video selesai."
            );


            ui.completeProgress();


            ui.setAnalyzeButtonLoading(
                false,
                "Analyze Video"
            );


            ui.updateCredit();


            dispatch(
                CONFIG.events.processComplete,
                {

                    result,

                    prompt,

                    prepared,

                    creditCost:
                        CONFIG.creditCost,

                    creditDeducted:
                        creditWasDeducted

                }
            );


            return result;

        } catch (error) {

            const message =
                error &&
                error.message
                    ? error.message
                    : "Analisis video gagal.";


            console.error(
                "[GEN-Z.AI Vision Video] Analysis error:",
                error
            );


            /* =============================================
               REFUND
               ---------------------------------------------
               Hanya jika credit benar-benar sudah
               dideduct.
            ============================================= */

            if (
                creditWasDeducted
            ) {

                try {

                    ui.renderProcessingStatus(
                        "Mengembalikan credit..."
                    );


                    await refundCredit();


                    ui.updateCredit();

                } catch (refundError) {

                    console.error(
                        "[GEN-Z.AI Vision Video] Refund credit gagal:",
                        refundError
                    );

                }

            }


            /* =============================================
               FAILED HISTORY
            ============================================= */

            await saveFailedHistory(
                error
            );


            /* =============================================
               ERROR STATE
            ============================================= */

            state.failAnalysis(
                message
            );


            state.setProcess({

                status:
                    "error",

                message:
                    message,

                error:
                    message

            });


            ui.renderErrorStatus(
                message
            );


            ui.setAnalyzeButtonLoading(
                false,
                "Analyze Video"
            );


            ui.updateCredit();


            dispatch(
                CONFIG.events.apiError,
                {

                    error:
                        message

                }
            );


            return null;

        } finally {

            analysisRunning =
                false;


            ui.updateAnalyzeButton();

        }

    }


    /* =====================================================
       CANCEL
    ===================================================== */

    function cancelAnalysis() {

        const analysis =
            getAnalysis();


        try {

            analysis.cancel();

        } catch (error) {

            console.warn(
                "[GEN-Z.AI Vision Video] Analysis cancel warning:",
                error
            );

        }


        const state =
            getState();


        state.setProcess({

            status:
                "cancelled",

            progress:
                state.getValue(
                    "process.progress",
                    0
                ),

            message:
                "Analisis dibatalkan."

        });


        const ui =
            getUI();


        ui.setAnalyzeButtonLoading(
            false,
            "Analyze Video"
        );


        ui.renderStatus(
            "Analisis dibatalkan.",
            "cancelled"
        );


        analysisRunning =
            false;


        ui.updateAnalyzeButton();

    }


    /* =====================================================
       RESET
    ===================================================== */

    function reset() {

        const state =
            getState();


        try {

            getAnalysis().cancel();

        } catch (error) {

            /*
             * Cancel gagal tidak boleh
             * menghalangi reset UI/state.
             */

        }


        /*
         * Reset credit operation state hanya
         * untuk status lokal operasi berikutnya.
         *
         * Tidak mengembalikan credit.
         */

        try {

            getCredit().resetOperationState();

        } catch (error) {

            console.warn(
                "[GEN-Z.AI Vision Video] Credit reset warning:",
                error
            );

        }


        state.reset();


        analysisRunning =
            false;


        const ui =
            getUI();


        ui.resetResults();


        ui.renderCreditFromState();


        ui.renderUploadState(
            false
        );


        ui.setAnalyzeButtonLoading(
            false,
            "Analyze Video"
        );


        ui.updateAnalyzeButton();

    }


    /* =====================================================
       FORM EVENTS
    ===================================================== */

    function handleFormChange() {

        try {

            syncFormToState();

            getUI().updateAnalyzeButton();

        } catch (error) {

            console.warn(
                "[GEN-Z.AI Vision Video] Form sync warning:",
                error
            );

        }

    }


    /* =====================================================
       FILE EVENTS
    ===================================================== */

    function handleFileSelected() {

        try {

            syncFormToState();


            getUI().renderUploadState(
                true
            );


            getUI().renderFileInfo();


            getUI().updateAnalyzeButton();

        } catch (error) {

            console.warn(
                "[GEN-Z.AI Vision Video] File selected UI warning:",
                error
            );

        }

    }


    function handleFileRemoved() {

        try {

            getUI().resetResults();


            getUI().renderUploadState(
                false
            );


            getUI().updateAnalyzeButton();

        } catch (error) {

            console.warn(
                "[GEN-Z.AI Vision Video] File remove UI warning:",
                error
            );

        }

    }


    /* =====================================================
       BUTTON BINDING
    ===================================================== */

    let bound =
        false;


    function bind() {

        if (bound) {

            return;

        }


        bound =
            true;


        const dom =
            getDOM();


        const analyzeButton =
            dom.get(
                "analyzeButton"
            );


        if (analyzeButton) {

            analyzeButton.addEventListener(
                "click",
                function (event) {

                    event.preventDefault();


                    if (
                        analysisRunning
                    ) {

                        return;

                    }


                    analyzeVideo();

                }
            );

        }


        /* =================================================
           SETTINGS
        ================================================= */

        [
            "model",
            "detail",
            "frameMode",
            "purpose",
            "instruction"

        ].forEach(
            function (
                key
            ) {

                const field =
                    dom.get(
                        key
                    );


                if (!field) {

                    return;

                }


                field.addEventListener(
                    "change",
                    handleFormChange
                );


                field.addEventListener(
                    "input",
                    handleFormChange
                );

            }
        );


        /* =================================================
           FILE LIFECYCLE
        ================================================= */

        document.addEventListener(
            CONFIG.events.fileSelected,
            handleFileSelected
        );


        document.addEventListener(
            CONFIG.events.fileRemoved,
            handleFileRemoved
        );


        /* =================================================
           METADATA READY
        ================================================= */

        document.addEventListener(
            CONFIG.events.metadataReady,
            function () {

                getUI().renderVideoMetadata();


                getUI().updateAnalyzeButton();

            }
        );


        /* =================================================
           API START
        ================================================= */

        document.addEventListener(
            CONFIG.events.apiStart,
            function () {

                getUI().setAnalyzeButtonLoading(
                    true,
                    "Menganalisis..."
                );


                getUI().renderProcessingStatus(
                    "Mengirim frame video ke Vision Engine..."
                );

            }
        );


        /* =================================================
           API COMPLETION
        ================================================= */

        document.addEventListener(
            CONFIG.events.apiComplete,
            function (event) {

                const result =
                    event &&
                    event.detail &&
                    event.detail.result
                        ? event.detail.result
                        : null;


                if (!result) {

                    return;

                }


                /*
                 * Hasil final sebenarnya diproses
                 * oleh analyzeVideo().
                 *
                 * Di sini hanya memastikan UI
                 * menerima hasil API jika event
                 * dipicu oleh API module.
                 */

            }
        );


        /* =================================================
           API ERROR
        ================================================= */

        document.addEventListener(
            CONFIG.events.apiError,
            function (event) {

                const error =
                    event &&
                    event.detail
                        ? event.detail.error
                        : "";


                if (error) {

                    getUI().renderErrorStatus(
                        error
                    );

                }

            }
        );


        /* =================================================
           ANALYSIS PREPARATION ERROR
        ================================================= */

        document.addEventListener(
            CONFIG.events.analysisError,
            function (event) {

                const error =
                    event &&
                    event.detail
                        ? event.detail.error
                        : "";


                if (error) {

                    getUI().renderErrorStatus(
                        error
                    );

                }

            }
        );


        /* =================================================
           ESCAPE
        ================================================= */

        document.addEventListener(
            "keydown",
            function (event) {

                if (
                    event.key !==
                    "Escape"
                ) {

                    return;

                }


                if (
                    !analysisRunning
                ) {

                    return;

                }


                cancelAnalysis();

            }
        );


        syncFormToState();


        getUI().sync();

    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    const API = {

        config:
            CONFIG,

        syncFormToState,

        getCurrentSettings,

        validateVideo,

        validateSettings,

        validateCreditLocal,

        validateForm,

        setProgress,

        prepareAnalysis,

        runAPIAnalysis,

        buildPromptFromAnalysis,

        storePrompt,

        ensureTaskId,

        checkCredit,

        deductCredit,

        refundCredit,

        saveSuccessHistory,

        saveFailedHistory,

        analyzeVideo,

        cancelAnalysis,

        reset,

        bind,

        isRunning:
            function () {

                return analysisRunning;

            }

    };


    /* =====================================================
       GLOBAL EXPORT
    ===================================================== */

    window.GENZVisionVideoEvents =
        API;


    window.GENZVisionVideoEventsReady =
        true;


    /* =====================================================
       AUTO BIND
    ===================================================== */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            bind,
            {
                once:
                    true
            }
        );

    } else {

        bind();

    }


    console.log(
        "[GEN-Z.AI Vision Video] Events module ready."
    );

})();
