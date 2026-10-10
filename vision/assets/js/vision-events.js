// =========================================================
// GEN-Z.AI
// VISION ENGINE
// ---------------------------------------------------------
// File:
// vision/assets/js/vision-events.js
//
// Fungsi:
// - Bind seluruh event Vision
// - Upload reference image
// - Upload replacement character
// - Drag & drop reference image
// - Drag & drop replacement character
// - Form settings
// - Outfit source
// - Generate Vision
// - Copy prompt
// - Copy analysis
// - Remove reference image
// - Remove replacement character
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
    // OUTFIT SOURCE
    // =====================================================

    function syncOutfitSourceToState() {

        const state =
            getState();


        const dom =
            getDOM();


        if (
            !dom.outfitSource
        ) {

            if (
                typeof state.getOutfitSource ===
                "function"
            ) {

                return state.getOutfitSource();

            }


            return "reference";

        }


        let selectedValue =
            "";


        if (
            typeof dom.outfitSource.value ===
            "string"
        ) {

            selectedValue =
                dom.outfitSource.value;

        }


        if (
            !selectedValue &&
            typeof dom.outfitSource.length ===
            "number"
        ) {

            const selected =
                Array.from(
                    dom.outfitSource
                ).find(
                    item =>
                        item?.checked === true
                );


            if (selected) {

                selectedValue =
                    selected.value;

            }

        }


        const normalized =
            String(
                selectedValue ||
                "reference"
            )
                .trim()
                .toLowerCase();


        const outfitSource =
            normalized === "character"
                ? "character"
                : "reference";


        if (
            typeof state.setOutfitSource ===
            "function"
        ) {

            state.setOutfitSource(
                outfitSource
            );

        }


        return outfitSource;

    }


    // =====================================================
    // OUTFIT SOURCE CHANGE
    // =====================================================

    function handleOutfitSourceChange() {

        const state =
            getState();


        const dom =
            getDOM();


        if (
            !dom.outfitSource
        ) {

            return;

        }


        const outfitSource =
            syncOutfitSourceToState();


        if (
            typeof state.clearPrompt ===
            "function"
        ) {

            state.clearPrompt();

        }


        const ui =
            getUI();


        if (
            outfitSource ===
            "character"
        ) {

            ui.setStatus(
                "ready",
                "Outfit akan menggunakan replacement character."
            );

        } else {

            ui.setStatus(
                "ready",
                "Outfit akan menggunakan image reference."
            );

        }

    }


    // =====================================================
    // FORM -> STATE
    // =====================================================

    function syncFormToState() {

        const values =
            readFormValues();


        syncModelToState();


        getState().setSettings({

            detail:
                values.detail,

            purpose:
                values.purpose,

            instruction:
                values.instruction

        });


        syncOutfitSourceToState();

    }


    // =====================================================
    // REFERENCE IMAGE
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
    // REFERENCE FILE INPUT
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
    // REFERENCE DROP
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
    // REFERENCE DRAG OVER
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
    // REFERENCE DRAG LEAVE
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
    // REFERENCE DROPZONE CLICK
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
    // REFERENCE BROWSE BUTTON
    // =====================================================

    function handleBrowseClick(
        event
    ) {

        event.stopPropagation();

    }


    // =====================================================
    // REMOVE REFERENCE IMAGE
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
    // REPLACEMENT CHARACTER
    // =====================================================

    async function handleNewReplacementCharacter(
        file
    ) {

        if (!file) {

            return null;

        }


        try {

            const fileData =
                await getUpload()
                    .processReplacementCharacter(
                        file
                    );


            getPreview()
                .renderCharacterPreview(
                    fileData
                );


            getUI().setStatus(
                "ready",
                "Replacement character siap digunakan."
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


            getUI().setStatus(
                "error",
                message
            );


            return null;

        }

    }


    // =====================================================
    // REPLACEMENT CHARACTER FILE INPUT
    // =====================================================

    async function handleReplacementCharacterInput(
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


        await handleNewReplacementCharacter(
            files[0]
        );

    }


    // =====================================================
    // REPLACEMENT CHARACTER DRAG OVER
    // =====================================================

    function handleCharacterDragOver(
        event
    ) {

        event.preventDefault();

        event.stopPropagation();


        const dropzone =
            event.currentTarget;


        if (dropzone) {

            dropzone.classList.add(
                "is-dragover"
            );

        }

    }


    // =====================================================
    // REPLACEMENT CHARACTER DRAG LEAVE
    // =====================================================

    function handleCharacterDragLeave(
        event
    ) {

        event.preventDefault();

        event.stopPropagation();


        const dropzone =
            event.currentTarget;


        if (dropzone) {

            dropzone.classList.remove(
                "is-dragover"
            );

        }

    }


    // =====================================================
    // REPLACEMENT CHARACTER DROP
    // =====================================================

    async function handleCharacterDrop(
        event
    ) {

        event.preventDefault();

        event.stopPropagation();


        const dropzone =
            event.currentTarget;


        if (dropzone) {

            dropzone.classList.remove(
                "is-dragover"
            );

        }


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


        await handleNewReplacementCharacter(
            files[0]
        );

    }


    // =====================================================
    // REPLACEMENT CHARACTER DROPZONE CLICK
    // =====================================================

    function handleCharacterDropzoneClick(
        event
    ) {

        const dom =
            getDOM();


        if (
            event.target ===
            dom.characterFileInput
        ) {

            return;

        }


        if (
            event.target ===
            dom.characterBrowseButton ||
            dom.characterBrowseButton?.contains(
                event.target
            )
        ) {

            return;

        }


        if (
            event.target ===
            dom.characterRemoveButton ||
            dom.characterRemoveButton?.contains(
                event.target
            )
        ) {

            return;

        }


        if (
            dom.characterFileInput
        ) {

            dom.characterFileInput.click();

        }

    }


    // =====================================================
    // REPLACEMENT CHARACTER BROWSE
    // =====================================================

    function handleCharacterBrowseClick(
        event
    ) {

        event.stopPropagation();

    }


    // =====================================================
    // REMOVE REPLACEMENT CHARACTER
    // =====================================================

    function handleRemoveReplacementCharacter(
        event
    ) {

        event.preventDefault();

        event.stopPropagation();


        try {

            getUpload()
                .removeReplacementCharacter();


            getPreview()
                .clearCharacterPreview();


            getUI().setStatus(
                "ready",
                "Replacement character dihapus."
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
    // COPY ANALYSIS
    // =====================================================

    async function handleCopyAnalysis(
        event
    ) {

        event.preventDefault();

        event.stopPropagation();


        const dom =
            getDOM();


        const button =
            dom.analysisCopyButton;


        const result =
            dom.analysisResult;


        if (!result) {

            return;

        }


        const text =
            String(
                result.textContent ||
                ""
            ).trim();


        if (!text) {

            return;

        }


        if (
            button &&
            button.disabled
        ) {

            return;

        }


        let copied =
            false;


        try {

            /* -------- PRIMARY: Clipboard API -------- */

            if (
                navigator.clipboard &&
                typeof navigator.clipboard.writeText ===
                    "function"
            ) {

                try {

                    await navigator.clipboard.writeText(
                        text
                    );

                    copied =
                        true;

                }
                catch (
                    clipboardError
                ) {

                    console.warn(
                        "[GEN-Z.AI Vision] Clipboard API gagal, menggunakan fallback.",
                        clipboardError
                    );

                }

            }


            /* -------- FALLBACK: execCommand -------- */

            if (!copied) {

                const textarea =
                    document.createElement(
                        "textarea"
                    );


                textarea.value =
                    text;


                textarea.setAttribute(
                    "readonly",
                    ""
                );


                textarea.style.position =
                    "fixed";

                textarea.style.left =
                    "-9999px";

                textarea.style.top =
                    "0";

                textarea.style.opacity =
                    "0";

                textarea.style.pointerEvents =
                    "none";


                document.body.appendChild(
                    textarea
                );


                textarea.focus();

                textarea.select();

                textarea.setSelectionRange(
                    0,
                    textarea.value.length
                );


                try {

                    copied =
                        document.execCommand(
                            "copy"
                        );

                }
                catch (
                    error
                ) {

                    copied =
                        false;

                }


                textarea.remove();

            }


            if (!copied) {

                throw new Error(
                    "Browser menolak operasi copy."
                );

            }


            /* -------- SUCCESS FEEDBACK -------- */

            if (button) {

                button.disabled =
                    true;

                button.textContent =
                    "✓ COPIED";

                button.classList.add(
                    "vision-copy-success"
                );


                window.setTimeout(
                    () => {

                        button.disabled =
                            false;

                        button.textContent =
                            "COPY";

                        button.classList.remove(
                            "vision-copy-success"
                        );

                    },
                    1800
                );

            }

        }
        catch (error) {

            console.error(
                "[GEN-Z.AI Vision] Copy analysis gagal:",
                error
            );


            if (button) {

                button.textContent =
                    "✕ FAILED";


                window.setTimeout(
                    () => {

                        button.textContent =
                            "COPY";

                    },
                    1800
                );

            }

        }

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

            validateReady();


            syncFormToState();


            const state =
                getState().getState();


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


            await getCredit().deductCredit(
                CREDIT_COST
            );


            creditWasDeducted =
                true;


            getState().markCreditDeducted();


            getUI().updateCredit();


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


            const analysisPayload =
                analysisResponse?.analysis &&
                typeof analysisResponse.analysis ===
                    "object"
                    ? analysisResponse.analysis
                    : (
                        typeof analysisResponse?.text ===
                        "string"
                            ? analysisResponse.text
                            : analysisResponse
                    );


            console.info(
                "[GEN-Z.AI Vision] Analysis payload selected:",
                {
                    source:
                        analysisResponse?.analysis &&
                        typeof analysisResponse.analysis ===
                            "object"
                            ? "analysisResponse.analysis"
                            : (
                                typeof analysisResponse?.text ===
                                "string"
                                    ? "analysisResponse.text"
                                    : "analysisResponse"
                            ),

                    topLevelKeys:
                        analysisPayload &&
                        typeof analysisPayload ===
                            "object"
                            ? Object.keys(
                                analysisPayload
                            )
                            : [],

                    textLength:
                        typeof analysisPayload ===
                            "string"
                            ? analysisPayload.length
                            : null
                }
            );


            const normalizedAnalysis =
                getAnalysis().normalizeAnalysis(
                    analysisPayload
                );


            console.info(
                "[GEN-Z.AI Vision] Analysis normalized:",
                {
                    topLevelKeys:
                        normalizedAnalysis &&
                        typeof normalizedAnalysis ===
                            "object"
                            ? Object.keys(
                                normalizedAnalysis
                            )
                            : [],

                    subject:
                        normalizedAnalysis?.subject,

                    appearance:
                        normalizedAnalysis?.appearance,

                    face_hair:
                        normalizedAnalysis?.face_hair,

                    pose:
                        normalizedAnalysis?.pose,

                    clothing:
                        normalizedAnalysis?.clothing,

                    product:
                        normalizedAnalysis?.product,

                    environment:
                        normalizedAnalysis?.environment,

                    visual_style:
                        normalizedAnalysis?.visual_style
                }
            );


            getState().setAnalysis(
                normalizedAnalysis
            );


            getUI().showAnalysis(
                normalizedAnalysis
            );


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
        // REFERENCE FILE INPUT
        // ================================================

        bindEvent(
            dom.fileInput,
            "change",
            handleFileInput
        );


        // ================================================
        // REFERENCE BROWSE
        // ================================================

        bindEvent(
            dom.browseButton,
            "click",
            handleBrowseClick
        );


        // ================================================
        // REFERENCE DROPZONE
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
        // REFERENCE REMOVE
        // ================================================

        bindEvent(
            dom.removeButton,
            "click",
            handleRemoveImage
        );


        // ================================================
        // REPLACEMENT CHARACTER FILE INPUT
        // ================================================

        bindEvent(
            dom.characterFileInput,
            "change",
            handleReplacementCharacterInput
        );


        // ================================================
        // REPLACEMENT CHARACTER BROWSE
        // ================================================

        bindEvent(
            dom.characterBrowseButton,
            "click",
            handleCharacterBrowseClick
        );


        // ================================================
        // REPLACEMENT CHARACTER DROPZONE
        // ================================================

        bindEvent(
            dom.characterDropzone,
            "click",
            handleCharacterDropzoneClick
        );


        bindEvent(
            dom.characterDropzone,
            "dragover",
            handleCharacterDragOver
        );


        bindEvent(
            dom.characterDropzone,
            "dragleave",
            handleCharacterDragLeave
        );


        bindEvent(
            dom.characterDropzone,
            "drop",
            handleCharacterDrop
        );


        // ================================================
        // REPLACEMENT CHARACTER REMOVE
        // ================================================

        bindEvent(
            dom.characterRemoveButton,
            "click",
            handleRemoveReplacementCharacter
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
        // OUTFIT SOURCE
        // ================================================

        bindEvent(
            dom.outfitSource,
            "change",
            handleOutfitSourceChange
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
        // COPY PROMPT
        // ================================================

        bindEvent(
            dom.copyButton,
            "click",
            handleCopyPrompt
        );


        // ================================================
        // COPY ANALYSIS
        // ================================================

        bindEvent(
            dom.analysisCopyButton,
            "click",
            handleCopyAnalysis
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


        bindEvents();


        syncFormToState();


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

            syncOutfitSourceToState,

            handleOutfitSourceChange,

            handleNewImage,

            handleFileInput,

            handleDrop,

            handleDragOver,

            handleDragLeave,

            handleDropzoneClick,

            handleBrowseClick,

            handleRemoveImage,

            handleNewReplacementCharacter,

            handleReplacementCharacterInput,

            handleCharacterDrop,

            handleCharacterDragOver,

            handleCharacterDragLeave,

            handleCharacterDropzoneClick,

            handleCharacterBrowseClick,

            handleRemoveReplacementCharacter,

            startVisionProcess,

            handleGenerateClick,

            handleCopyPrompt,

            handleCopyAnalysis

        });


    // =====================================================
    // GLOBAL EXPORT
    // =====================================================

    window.GENZVisionEvents =
        GENZVisionEvents;


})();
