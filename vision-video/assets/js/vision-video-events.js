/* =========================================================
   GEN-Z.AI VISION VIDEO
   ---------------------------------------------------------
   File:
   vision-video/assets/js/vision-video-events.js

   Fungsi:
   - Event coordinator Vision Video
   - Analyze button
   - Sinkronisasi form ke state
   - Menjalankan analysis preparation
   - Menjalankan API analysis
   - Reset / cancel process
   - Tidak menangani rendering UI secara langsung
   - Tidak menangani upload secara langsung
   - Tidak menangani frame extraction secara langsung
========================================================= */

(function () {

    "use strict";


    /* =====================================================
       CONFIGURATION
    ===================================================== */

    const CONFIG = Object.freeze({

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
            );


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

                valid: false,

                message:
                    "Silakan upload video terlebih dahulu."

            };
        }


        const metadata =
            state.getValue(
                "video.metadata",
                {}
            );


        const duration =
            Number(
                metadata.duration
            );


        if (
            !Number.isFinite(duration) ||
            duration <= 0
        ) {

            return {

                valid: false,

                message:
                    "Metadata video belum siap."

            };
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
            width <= 0 ||
            height <= 0
        ) {

            return {

                valid: false,

                message:
                    "Resolusi video belum dapat dibaca."

            };
        }


        return {

            valid: true,

            message: ""

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

                valid: false,

                message:
                    "Model Vision Video belum dipilih."

            };
        }


        return {

            valid: true,

            message: ""

        };
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

            valid: true,

            message: ""

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


        return analysis.prepareAnalysis({

            mode:
                getCurrentSettings()
                    .frameMode,

            detail:
                getCurrentSettings()
                    .detail,

            purpose:
                getCurrentSettings()
                    .purpose,

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
            100,
            "Analisis video selesai."
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
            typeof result.content === "string"
                ? result.content.trim()
                : "";


        if (!content) {
            return "";
        }


        /*
         * API analysis pada tahap ini adalah
         * sumber hasil analisis.
         *
         * Prompt final tidak dibuat dengan
         * menambahkan klaim visual baru.
         */

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
       MAIN ANALYZE FLOW
    ===================================================== */

    let analysisRunning =
        false;


    async function analyzeVideo() {

        if (analysisRunning) {

            return;
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

            return;
        }


        analysisRunning =
            true;


        try {

            /*
             * Pastikan form terakhir
             * masuk ke state.
             */

            syncFormToState();


            /*
             * Bersihkan hasil lama.
             */

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
                    "Menyiapkan analisis video..."

            });


            ui.resetResults();


            ui.setAnalyzeButtonLoading(
                true,
                "Menyiapkan..."
            );


            ui.renderProcessingStatus(
                "Menyiapkan frame video..."
            );


            setProgress(
                5,
                "Membaca video..."
            );


            /*
             * Tahap 1:
             * Extract + prepare frame payload.
             */

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


            /*
             * Tahap 2:
             * API multimodal analysis.
             */

            state.setProcess({

                status:
                    "analyzing",

                progress:
                    55,

                message:
                    "Menganalisis frame video..."

            });


            ui.renderProcessingStatus(
                "Menganalisis frame video..."
            );


            const result =
                await runAPIAnalysis(
                    prepared
                );


            /*
             * Tahap 3:
             * Simpan hasil analysis.
             */

            const prompt =
                storePrompt(
                    result
                );


            if (!prompt) {

                throw new Error(
                    "API tidak menghasilkan konten analysis."
                );
            }


            state.setProcess({

                status:
                    "complete",

                progress:
                    100,

                message:
                    "Analisis video selesai."

            });


            state.completeAnalysis(
                result.content
            );


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


            dispatch(
                CONFIG.events.processComplete,
                {

                    result,

                    prompt,

                    prepared

                }
            );


            return result;

        } catch (error) {

            const message =
                error &&
                error.message
                    ? error.message
                    : "Analisis video gagal.";


            state.failAnalysis(
                message
            );


            state.setProcess({

                status:
                    "error",

                message:

                    message

            });


            ui.renderErrorStatus(
                message
            );


            ui.setAnalyzeButtonLoading(
                false,
                "Analyze Video"
            );


            dispatch(
                CONFIG.events.apiError,
                {

                    error:
                        message

                }
            );


            console.error(
                "[GEN-Z.AI Vision Video] Analysis error:",
                error
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
             * Tidak perlu menghentikan reset
             * hanya karena cancel gagal.
             */
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

                    analyzeVideo();

                }
            );
        }


        /*
         * Settings.
         */

        [
            "model",
            "detail",
            "frameMode",
            "purpose",
            "instruction"

        ].forEach(function (key) {

            const field =
                dom.get(key);


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

        });


        /*
         * File lifecycle.
         */

        document.addEventListener(
            CONFIG.events.fileSelected,
            handleFileSelected
        );


        document.addEventListener(
            CONFIG.events.fileRemoved,
            handleFileRemoved
        );


        /*
         * Metadata ready.
         */

        document.addEventListener(
            CONFIG.events.metadataReady,
            function () {

                getUI().renderVideoMetadata();

                getUI().updateAnalyzeButton();

            }
        );


        /*
         * API progress.
         */

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


        /*
         * API completion.
         */

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


                const prompt =
                    storePrompt(
                        result
                    );


                if (prompt) {

                    getUI().renderPrompt(
                        prompt
                    );
                }

            }
        );


        /*
         * API error.
         */

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


        /*
         * Analysis preparation error.
         */

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


        /*
         * Escape untuk membatalkan proses.
         */

        document.addEventListener(
            "keydown",
            function (event) {

                if (
                    event.key !== "Escape"
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

        validateForm,

        setProgress,

        prepareAnalysis,

        runAPIAnalysis,

        storePrompt,

        analyzeVideo,

        cancelAnalysis,

        reset,

        bind,

        isRunning:
            function () {

                return analysisRunning;

            }

    };


    window.GENZVisionVideoEvents =
        API;

    window.GENZVisionVideoEventsReady =
        true;


    /*
     * Event coordinator menunggu DOM.
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
        "[GEN-Z.AI Vision Video] Events module ready."
    );

})();
