// =========================================================
// GEN-Z.AI
// VISION ENGINE
// ---------------------------------------------------------
// File:
// vision/assets/js/vision-events.js
//
// Fungsi:
// - Bind seluruh event Vision
// - Upload image
// - Drag & drop
// - Form settings
// - Generate Vision
// - Copy prompt
// - Remove image
// - Tidak mengubah logic API / credit / history
// =========================================================

(function () {

    "use strict";


    // =====================================================
    // CONSTANT
    // =====================================================

    const CREDIT_COST = 1;


    // =====================================================
    // MODULE GETTERS
    // =====================================================

    function getState() {

        if (!window.GENZVisionState) {

            throw new Error(
                "GENZVisionState belum tersedia."
            );

        }

        return window.GENZVisionState;

    }


    function getDOM() {

        if (!window.GENZVisionDOM) {

            throw new Error(
                "GENZVisionDOM belum tersedia."
            );

        }


        if (
            typeof window.GENZVisionDOM.getDOM !==
            "function"
        ) {

            throw new Error(
                "GENZVisionDOM.getDOM() belum tersedia."
            );

        }


        return window.GENZVisionDOM.getDOM();

    }


    function getUpload() {

        if (!window.GENZVisionUpload) {

            throw new Error(
                "GENZVisionUpload belum tersedia."
            );

        }

        return window.GENZVisionUpload;

    }


    function getPreview() {

        if (!window.GENZVisionPreview) {

            throw new Error(
                "GENZVisionPreview belum tersedia."
            );

        }

        return window.GENZVisionPreview;

    }


    function getUI() {

        if (!window.GENZVisionUI) {

            throw new Error(
                "GENZVisionUI belum tersedia."
            );

        }

        return window.GENZVisionUI;

    }


    function getCredit() {

        if (!window.GENZVisionCredit) {

            throw new Error(
                "GENZVisionCredit belum tersedia."
            );

        }

        return window.GENZVisionCredit;

    }


    function getAPI() {

        if (!window.GENZVisionAPI) {

            throw new Error(
                "GENZVisionAPI belum tersedia."
            );

        }

        return window.GENZVisionAPI;

    }


    function getAnalysis() {

        if (!window.GENZVisionAnalysis) {

            throw new Error(
                "GENZVisionAnalysis belum tersedia."
            );

        }

        return window.GENZVisionAnalysis;

    }


    function getPrompt() {

        if (!window.GENZVisionPrompt) {

            throw new Error(
                "GENZVisionPrompt belum tersedia."
            );

        }

        return window.GENZVisionPrompt;

    }


    function getHistory() {

        if (!window.GENZVisionHistory) {

            throw new Error(
                "GENZVisionHistory belum tersedia."
            );

        }

        return window.GENZVisionHistory;

    }


    // =====================================================
    // SAFE ERROR
    // =====================================================

    function normalizeError(error) {

        if (
            error &&
            typeof error === "object"
        ) {

            if (
                typeof error.message === "string" &&
                error.message.trim()
            ) {

                return error.message.trim();

            }

        }


        if (
            typeof error === "string" &&
            error.trim()
        ) {

            return error.trim();

        }


        return (
            "Terjadi kesalahan pada Vision Engine."
        );

    }


    // =====================================================
    // FORM
    // =====================================================

    function readFormValues() {

        const dom =
            getDOM();


        const selectedValue =
            String(
                dom.model?.value ||
                ""
            ).trim();


        const detail =
            dom.detail?.value ||
            "ultra";


        const purpose =
            dom.purpose?.value ||
            "image-generation";


        const instruction =
            String(
                dom.instruction?.value || ""
            ).trim();


        return {

            model:
                selectedValue,

            detail,

            purpose,

            instruction

        };

    }


    // =====================================================
    // MODEL STATE
    // =====================================================

    function syncModelToState() {

        const state =
            getState();


        const dom =
            getDOM();


        const selectedId =
            String(
                dom.model?.value ||
                ""
            ).trim();


        if (
            !selectedId
        ) {

            return null;

        }


        const currentModel =
            state.get(
                "model",
                null
            );


        /*
         * Jangan mengubah model menjadi string.
         *
         * vision-state.js menyimpan model sebagai object:
         *
         * {
         *     id,
         *     name,
         *     providerId,
         *     providerName
         * }
         *
         * Jika model lama cocok dengan select,
         * pertahankan metadata yang sudah ada.
         */

        if (
            currentModel &&
            typeof currentModel === "object" &&
            String(
                currentModel.id ||
                ""
            ) === selectedId
        ) {

            return currentModel;

        }


        const model = {

            id:
                selectedId,

            name:
                dom.model?.selectedOptions?.[0]?.textContent
                    ?.trim() ||
                selectedId,

            providerId:
                "openkey",

            providerName:
                "OpenKey"

        };


        state.setModel(
            model
        );


        return model;

    }


    // =====================================================
    // FORM -> STATE
    // =====================================================

    function syncFormToState() {

        const values =
            readFormValues();


        /*
         * Model diproses terpisah agar state.model
         * selalu berupa object.
         */

        syncModelToState();


        getState().setSettings({

            detail:
                values.detail,

            purpose:
                values.purpose,

            instruction:
                values.instruction

        });

    }


    // =====================================================
    // FILE INPUT
    // =====================================================

    async function handleNewImage(
        file
    ) {

        if (!file) {

            return null;

        }


        const ui =
            getUI();


        try {

            ui.setProcessing(
                false
            );


            ui.resetResult();


            const fileData =
                await getUpload().processFile(
                    file
                );


            getPreview().renderPreview(
                fileData
            );


            ui.setStatus(
                "ready",
                "Image siap dianalisis."
            );


            return fileData;

        } catch (error) {

            const message =
                normalizeError(
                    error
                );


            getState().setProcessError(
                message
            );


            ui.setStatus(
                "error",
                message
            );


            return null;

        }

    }


    // =====================================================
    // FILE INPUT CHANGE
    // =====================================================

    async function handleFileInput(
        event
    ) {

        const input =
            event?.target;


        const files =
            Array.from(
                input?.files || []
            );


        if (
            files.length === 0
        ) {

            return;

        }


        await handleNewImage(
            files[0]
        );

    }


    // =====================================================
    // DROP
    // =====================================================

    async function handleDrop(
        event
    ) {

        event.preventDefault();

        event.stopPropagation();


        getPreview().setDropzoneActive(
            false
        );


        const files =
            Array.from(
                event
                    ?.dataTransfer
                    ?.files || []
            );


        if (
            files.length === 0
        ) {

            return;

        }


        await handleNewImage(
            files[0]
        );

    }


    // =====================================================
    // DRAG OVER
    // =====================================================

    function handleDragOver(
        event
    ) {

        event.preventDefault();

        event.stopPropagation();


        getPreview().setDropzoneActive(
            true
        );

    }


    // =====================================================
    // DRAG LEAVE
    // =====================================================

    function handleDragLeave(
        event
    ) {

        event.preventDefault();

        event.stopPropagation();


        getPreview().setDropzoneActive(
            false
        );

    }


    // =====================================================
    // DROPZONE CLICK
    // =====================================================

    function handleDropzoneClick(
        event
    ) {

        const dom =
            getDOM();


        if (
            event.target ===
            dom.fileInput
        ) {

            return;

        }


        if (
            event.target ===
            dom.browseButton ||
            dom.browseButton?.contains(
                event.target
            )
        ) {

            return;

        }


        if (
            event.target ===
            dom.removeButton ||
            dom.removeButton?.contains(
                event.target
            )
        ) {

            return;

        }


        getUpload().openFilePicker();

    }


    // =====================================================
    // BROWSE BUTTON
    // =====================================================

    function handleBrowseClick(
        event
    ) {

        event.stopPropagation();

    }


    // =====================================================
    // REMOVE IMAGE
    // =====================================================

    function handleRemoveImage(
        event
    ) {

        event.preventDefault();

        event.stopPropagation();


        try {

            getPreview().clearPreview(
                true
            );


            getState().clearAnalysis();

            getState().clearPrompt();

            getUI().resetResult();


            getUI().setStatus(
                "ready",
                "Reference image dihapus."
            );

        } catch (error) {

            const message =
                normalizeError(
                    error
                );


            getUI().setStatus(
                "error",
                message
            );

        }

    }


    // =====================================================
    // FORM EVENTS
    // =====================================================

    function handleModelChange() {

        syncModelToState();

    }


    function handleDetailChange() {

        syncFormToState();

    }


    function handlePurposeChange() {

        syncFormToState();

    }


    function handleInstructionInput() {

        syncFormToState();

    }


    // =====================================================
    // COPY PROMPT
    // =====================================================

    async function handleCopyPrompt(
        event
    ) {

        event.preventDefault();

        event.stopPropagation();


        try {

            const prompt =
                getPrompt().getPrompt();


            if (!prompt) {

                return;

            }


            await getPrompt().copyPrompt();


            getUI().setCopyState(
                true
            );


            window.setTimeout(
                () => {

                    getUI().setCopyState(
                        false
                    );

                },
                1800
            );

        } catch (error) {

            getUI().setStatus(
                "error",
                normalizeError(
                    error
                )
            );

        }

    }


    // =====================================================
    // VALIDATE READY
    // =====================================================

    function validateReady() {

        const state =
            getState().getState();


        if (
            !state.file ||
            !state.file.original ||
            !state.file.dataUrl
        ) {

            throw new Error(
                "Silakan upload reference image terlebih dahulu."
            );

        }


        return true;

    }


    // =====================================================
    // VISION PROCESS
    // =====================================================

    async function startVisionProcess() {

        const currentState =
            getState().getState();


        if (
            currentState
                ?.process
                ?.processing === true
        ) {

            return;

        }


        let creditWasDeducted =
            false;


        try {

            // =============================================
            // VALIDATE
            // =============================================

            validateReady();


            syncFormToState();


            const state =
                getState().getState();


            // =============================================
            // CREDIT CHECK
            // =============================================

            getUI().setStatus(
                "checking",
                "Memeriksa credit..."
            );


            const credit =
                await getCredit().checkCredit(
                    CREDIT_COST
                );


            if (
                !credit ||
                credit.allowed !== true
            ) {

                throw new Error(
                    credit?.message ||
                    "Credit tidak mencukupi."
                );

            }


            // =============================================
            // RESET RESULT
            // =============================================

            getUI().resetResult();


            getUI().setProcessing(
                true
            );


            getUI().setStatus(
                "processing",
                "Memulai Vision Engine..."
            );


            getState().setProcessing(
                true
            );


            getState().setProgress(
                5
            );


            // =============================================
            // DEDUCT CREDIT
            // =============================================

            await getCredit().deductCredit(
                CREDIT_COST
            );


            creditWasDeducted =
                true;


            getState().markCreditDeducted();


            getUI().updateCredit();


            // =============================================
            // ANALYSIS
            // =============================================

            getUI().setStatus(
                "processing",
                "Menganalisis gambar..."
            );


            getState().setProgress(
                25
            );


            const analysisResponse =
                await getAPI().analyzeImage({

                    model:
                        state.model,

                    settings:
                        state.settings

                });


            /*
             * analyzeImage() dapat memilih model aktual
             * dari katalog OpenKey.
             *
             * Karena object model dikembalikan oleh API,
             * sinkronkan kembali state agar history dan
             * prompt generation menggunakan model aktual.
             */

            if (
                analysisResponse?.model &&
                typeof analysisResponse.model ===
                    "object"
            ) {

                getState().setModel(
                    analysisResponse.model
                );

            }


            getState().setProgress(
                50
            );


            // =============================================
            // NORMALIZE ANALYSIS
            // =============================================

            const normalizedAnalysis =
                getAnalysis().normalizeAnalysis(
                    analysisResponse
                );


            getState().setAnalysis(
                normalizedAnalysis
            );


            getUI().showAnalysis(
                normalizedAnalysis
            );


            // =============================================
            // PROMPT GENERATION
            // =============================================

            getUI().setStatus(
                "processing",
                "Membangun ultra detailed prompt..."
            );


            getState().setProgress(
                70
            );


            const promptResponse =
                await getAPI().generatePrompt(

                    normalizedAnalysis,

                    {

                        model:
                            getState().get(
                                "model",
                                state.model
                            ),

                        settings:
                            state.settings

                    }

                );


            // =============================================
            // NORMALIZE PROMPT
            // =============================================

            const prompt =
                getPrompt().normalizePrompt(
                    promptResponse
                );


            if (!prompt) {

                throw new Error(
                    "Vision Engine tidak menghasilkan prompt."
                );

            }


            getState().setPrompt(
                prompt
            );


            getState().setProgress(
                88
            );


            // =============================================
            // SAVE HISTORY
            // =============================================

            getUI().setStatus(
                "processing",
                "Menyimpan riwayat..."
            );


            try {

                const finalState =
                    getState().getState();


                await getHistory().saveSuccess({

                    taskId:
                        finalState
                            .process
                            .taskId,

                    modelId:
                        finalState
                            .model
                            .id,

                    modelName:
                        finalState
                            .model
                            .name,

                    prompt,

                    analysis:
                        normalizedAnalysis,

                    creditCost:
                        CREDIT_COST

                });

            } catch (historyError) {

                console.warn(
                    "[GEN-Z.AI Vision] History save gagal:",
                    historyError
                );

            }


            // =============================================
            // COMPLETE
            // =============================================

            getState().setProgress(
                100
            );


            getState().setProcessStatus(
                "completed",
                "READY",
                100
            );


            getState().setProcessing(
                false
            );


            getUI().setProcessing(
                false
            );


            getUI().showPrompt(
                prompt
            );


            getUI().setStatus(
                "success",
                "Vision analysis selesai."
            );


            getUI().updateCredit();


        } catch (error) {

            const message =
                normalizeError(
                    error
                );


            console.error(
                "[GEN-Z.AI Vision]",
                error
            );


            const state =
                getState().getState();


            // =============================================
            // REFUND
            // =============================================

            if (
                creditWasDeducted === true &&
                state.credit?.refunded !== true
            ) {

                try {

                    await getCredit().refundCredit(
                        CREDIT_COST
                    );


                    getState().markCreditRefunded();


                    getUI().updateCredit();

                } catch (refundError) {

                    console.error(
                        "[GEN-Z.AI Vision] Refund gagal:",
                        refundError
                    );

                }

            }


            // =============================================
            // FAILED HISTORY
            // =============================================

            try {

                await getHistory().saveFailed({

                    taskId:
                        state
                            .process
                            .taskId,

                    modelId:
                        state
                            .model
                            .id,

                    modelName:
                        state
                            .model
                            .name,

                    error:
                        message,

                    creditCost:
                        CREDIT_COST

                });

            } catch (historyError) {

                console.warn(
                    "[GEN-Z.AI Vision] Failed history save gagal:",
                    historyError
                );

            }


            // =============================================
            // ERROR STATE
            // =============================================

            getState().setProcessError(
                message
            );


            getState().setProcessing(
                false
            );


            getUI().setProcessing(
                false
            );


            getUI().setStatus(
                "error",
                message
            );

        }

    }


    // =====================================================
    // GENERATE BUTTON
    // =====================================================

    function handleGenerateClick(
        event
    ) {

        event.preventDefault();

        event.stopPropagation();


        startVisionProcess();

    }


    // =====================================================
    // EVENT HELPER
    // =====================================================

    function bindEvent(
        element,
        eventName,
        handler
    ) {

        if (!element) {

            return;

        }


        element.addEventListener(
            eventName,
            handler
        );

    }


    // =====================================================
    // BIND EVENTS
    // =====================================================

    function bindEvents() {

        const dom =
            getDOM();


        // ================================================
        // FILE INPUT
        // ================================================

        bindEvent(
            dom.fileInput,
            "change",
            handleFileInput
        );


        // ================================================
        // BROWSE LABEL
        // ================================================

        bindEvent(
            dom.browseButton,
            "click",
            handleBrowseClick
        );


        // ================================================
        // DROPZONE
        // ================================================

        bindEvent(
            dom.dropzone,
            "click",
            handleDropzoneClick
        );


        bindEvent(
            dom.dropzone,
            "dragover",
            handleDragOver
        );


        bindEvent(
            dom.dropzone,
            "dragleave",
            handleDragLeave
        );


        bindEvent(
            dom.dropzone,
            "drop",
            handleDrop
        );


        // ================================================
        // REMOVE
        // ================================================

        bindEvent(
            dom.removeButton,
            "click",
            handleRemoveImage
        );


        // ================================================
        // FORM
        // ================================================

        bindEvent(
            dom.model,
            "change",
            handleModelChange
        );


        bindEvent(
            dom.detail,
            "change",
            handleDetailChange
        );


        bindEvent(
            dom.purpose,
            "change",
            handlePurposeChange
        );


        bindEvent(
            dom.instruction,
            "input",
            handleInstructionInput
        );


        // ================================================
        // GENERATE
        // ================================================

        bindEvent(
            dom.generateButton,
            "click",
            handleGenerateClick
        );


        // ================================================
        // COPY
        // ================================================

        bindEvent(
            dom.copyButton,
            "click",
            handleCopyPrompt
        );

    }


    // =====================================================
    // INITIALIZE
    // =====================================================

    function initialize() {

        const dom =
            getDOM();


        if (!dom.fileInput) {

            throw new Error(
                "visionFileInput tidak ditemukan."
            );

        }


        if (!dom.dropzone) {

            throw new Error(
                "visionDropzone tidak ditemukan."
            );

        }


        if (
            typeof window.GENZVisionDOM.validateDOM ===
            "function"
        ) {

            const validation =
                window.GENZVisionDOM.validateDOM({
                    log: true
                });


            if (!validation.valid) {

                throw new Error(
                    "Vision DOM tidak lengkap."
                );

            }

        }


        // =============================================
        // BIND EVENTS
        // =============================================

        bindEvents();


        // =============================================
        // SYNC FORM
        // =============================================

        syncFormToState();


        // =============================================
        // RESTORE PREVIEW
        // =============================================

        getPreview().renderFromState();


        return true;

    }


    // =====================================================
    // PUBLIC API
    // =====================================================

    const GENZVisionEvents =
        Object.freeze({

            initialize,

            bindEvents,

            syncFormToState,

            handleNewImage,

            handleFileInput,

            handleDrop,

            handleDragOver,

            handleDragLeave,

            handleDropzoneClick,

            handleBrowseClick,

            handleRemoveImage,

            startVisionProcess,

            handleGenerateClick,

            handleCopyPrompt

        });


    // =====================================================
    // GLOBAL EXPORT
    // =====================================================

    window.GENZVisionEvents =
        GENZVisionEvents;


})();
