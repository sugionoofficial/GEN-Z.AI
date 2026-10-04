/* =========================================================
   GEN-Z.AI VISION
   ---------------------------------------------------------
   File:
   vision/assets/js/vision-events.js

   Fungsi:
   - Menghubungkan event UI Vision
   - Menjalankan pipeline Vision
   - Check credit
   - Deduct 1 credit
   - Analyze image
   - Generate final prompt
   - Save history
   - Refund credit jika proses gagal
   - Copy prompt
   - Reset process
   - Menangani koneksi UI upload
   - Tidak menangani detail API
   - Tidak menangani upload processing
   - Tidak menangani rendering CSS
========================================================= */


/* =========================================================
   CONFIG
========================================================= */

const VISION_EVENTS_CONFIG =
    Object.freeze({

        CREDIT_COST:
            1,

        DEFAULT_MODEL:
            "gemini-3.1-pro",

        DEFAULT_DETAIL:
            "ultra",

        DEFAULT_PURPOSE:
            "image-generation"

    });


/* =========================================================
   INTERNAL INITIALIZATION LOCK
   ---------------------------------------------------------
   Mencegah event listener terpasang dua kali jika loader
   menjalankan initialize() lebih dari satu kali.
========================================================= */

let visionEventsInitialized =
    false;


/* =========================================================
   MODULE ACCESS
========================================================= */

function getModule(
    name
) {

    const module =
        window[name];


    if (
        !module
    ) {

        throw new Error(
            `${name} belum tersedia.`
        );

    }


    return module;

}


/* =========================================================
   MODULES
========================================================= */

function getState() {

    return getModule(
        "GENZVisionState"
    );

}


function getDOM() {

    return getModule(
        "GENZVisionDOM"
    );

}


function getUI() {

    return getModule(
        "GENZVisionUI"
    );

}


function getUpload() {

    return getModule(
        "GENZVisionUpload"
    );

}


function getPreview() {

    return getModule(
        "GENZVisionPreview"
    );

}


function getAPI() {

    return getModule(
        "GENZVisionAPI"
    );

}


function getCredit() {

    return getModule(
        "GENZVisionCredit"
    );

}


function getAnalysis() {

    return getModule(
        "GENZVisionAnalysis"
    );

}


function getPrompt() {

    return getModule(
        "GENZVisionPrompt"
    );

}


function getHistory() {

    return getModule(
        "GENZVisionHistory"
    );

}


/* =========================================================
   DOM HELPER
========================================================= */

function element(
    name
) {

    const dom =
        getDOM();


    return dom[name] ||
        null;

}


/* =========================================================
   READ FORM
========================================================= */

function readForm() {

    const model =
        element(
            "model"
        );


    const detail =
        element(
            "detail"
        );


    const purpose =
        element(
            "purpose"
        );


    const instruction =
        element(
            "instruction"
        );


    const modelId =
        model?.value ||
        VISION_EVENTS_CONFIG
            .DEFAULT_MODEL;


    const detailValue =
        detail?.value ||
        VISION_EVENTS_CONFIG
            .DEFAULT_DETAIL;


    const purposeValue =
        purpose?.value ||
        VISION_EVENTS_CONFIG
            .DEFAULT_PURPOSE;


    const instructionValue =
        instruction?.value ||
        "";


    return {

        model:
            modelId,

        detail:
            detailValue,

        purpose:
            purposeValue,

        instruction:
            instructionValue.trim()

    };

}


/* =========================================================
   MODEL INFORMATION
========================================================= */

function getModelName(
    modelId
) {

    const names = {

        "gemini-3.1-pro":
            "Gemini 3.1 Pro",

        "grok-4.6":
            "Grok 4.6",

        "qwen3-vl-max":
            "Qwen3 VL Max"

    };


    return (
        names[modelId] ||
        modelId ||
        "Vision Model"
    );

}


/* =========================================================
   UPDATE STATE SETTINGS
========================================================= */

function syncFormToState() {

    const state =
        getState();


    const form =
        readForm();


    state.set(
        "model.id",
        form.model
    );


    state.set(
        "model.name",
        getModelName(
            form.model
        )
    );


    state.set(
        "settings.detail",
        form.detail
    );


    state.set(
        "settings.purpose",
        form.purpose
    );


    state.set(
        "settings.instruction",
        form.instruction
    );


    return form;

}


/* =========================================================
   CHECK READY
========================================================= */

function validateReady() {

    const state =
        getState();


    const file =
        state.get(
            "file.original",
            null
        );


    if (
        !file
    ) {

        return {

            valid:
                false,

            message:
                "Upload gambar terlebih dahulu."

        };

    }


    const dataUrl =
        state.get(
            "file.dataUrl",
            ""
        );


    if (
        !dataUrl
    ) {

        return {

            valid:
                false,

            message:
                "Data gambar belum siap diproses."

        };

    }


    const form =
        readForm();


    if (
        !form.model
    ) {

        return {

            valid:
                false,

            message:
                "Model Vision belum dipilih."

        };

    }


    return {

        valid:
            true,

        form

    };

}


/* =========================================================
   GENERATE BUTTON LOCK
========================================================= */

function setGenerateLock(
    locked
) {

    const button =
        element(
            "generateButton"
        );


    if (
        !button
    ) {

        return;

    }


    button.disabled =
        Boolean(
            locked
        );


    button.setAttribute(
        "aria-busy",
        locked
            ? "true"
            : "false"
    );

}


/* =========================================================
   RESET PROCESS STATE
========================================================= */

function resetProcessState() {

    const state =
        getState();


    const credit =
        getCredit();


    state.setProcessStatus(
        "idle"
    );


    state.clearProcessError();


    state.setProgress(
        0
    );


    credit.resetOperationState();

}


/* =========================================================
   RESET UI OUTPUT
========================================================= */

function resetUIOutput() {

    const ui =
        getUI();


    ui.resetResult();


    ui.resetAnalysis();


    ui.resetPrompt();


    ui.clearResultMessage();


    ui.setCopyState(
        false
    );

}


/* =========================================================
   RESET AFTER NEW IMAGE
========================================================= */

function resetAfterNewImage() {

    const state =
        getState();


    /*
     * Hasil Vision sebelumnya
     * tidak boleh tetap tampil
     * ketika gambar baru dipilih.
     */

    getAnalysis()
        .clearAnalysis();


    getPrompt()
        .clearPrompt();


    state.set(
        "analysis.completed",
        false
    );


    state.set(
        "prompt.completed",
        false
    );


    state.set(
        "history.saved",
        false
    );


    state.set(
        "history.historyId",
        null
    );


    resetProcessState();


    resetUIOutput();

}


/* =========================================================
   START PROCESS
========================================================= */

async function startVisionProcess() {

    const state =
        getState();


    const ui =
        getUI();


    const validation =
        validateReady();


    if (
        !validation.valid
    ) {

        ui.showError(
            validation.message
        );


        return {

            success:
                false,

            error:
                validation.message

        };

    }


    if (
        state.get(
            "process.status",
            "idle"
        ) ===
        "processing"
    ) {

        return {

            success:
                false,

            error:
                "Vision sedang diproses."

        };

    }


    syncFormToState();


    const form =
        validation.form;


    let creditDeducted =
        false;


    try {

        /*
         * -------------------------------------------------
         * RESET PROCESS
         * -------------------------------------------------
         */

        resetProcessState();


        state.set(
            "credit.cost",
            VISION_EVENTS_CONFIG
                .CREDIT_COST
        );


        state.set(
            "process.taskId",
            getHistory()
                .createTaskId()
        );


        /*
         * -------------------------------------------------
         * UI START
         * -------------------------------------------------
         */

        setGenerateLock(
            true
        );


        ui.setProcessing(
            true
        );


        ui.setStage(
            "checking",
            {
                progress:
                    5
            }
        );


        /*
         * -------------------------------------------------
         * CREDIT CHECK
         * -------------------------------------------------
         */

        const credit =
            getCredit();


        const creditCheck =
            await credit.checkCredit();


        if (
            !creditCheck ||
            creditCheck.sufficient !== true
        ) {

            throw new Error(
                "Credit tidak mencukupi."
            );

        }


        state.set(
            "credit.checked",
            true
        );


        /*
         * -------------------------------------------------
         * DEDUCT
         * -------------------------------------------------
         */

        ui.setStage(
            "reserving",
            {
                progress:
                    10
            }
        );


        const deduction =
            await credit.deductCredit({

                taskId:
                    state.get(
                        "process.taskId",
                        ""
                    ),

                modelId:
                    form.model,

                model:
                    form.model,

                modelName:
                    getModelName(
                        form.model
                    )

            });


        if (
            !deduction ||
            (
                deduction.success === false &&
                deduction.alreadyDeducted !== true
            )
        ) {

            throw new Error(
                deduction?.message ||
                "Credit gagal dipotong."
            );

        }


        creditDeducted =
            true;


        state.set(
            "credit.deducted",
            true
        );


        /*
         * -------------------------------------------------
         * ANALYSIS
         * -------------------------------------------------
         */

        ui.setStage(
            "analyzing",
            {
                progress:
                    25
            }
        );


        const api =
            getAPI();


        const fileDataUrl =
            state.get(
                "file.dataUrl",
                ""
            );


        const analysisResponse =
            await api.analyzeImage({

                dataUrl:
                    fileDataUrl,

                model:
                    form.model,

                detail:
                    form.detail,

                purpose:
                    form.purpose,

                instruction:
                    form.instruction

            });


        ui.setStage(
            "analyzing",
            {
                progress:
                    45
            }
        );


        /*
         * -------------------------------------------------
         * NORMALIZE ANALYSIS
         * -------------------------------------------------
         */

        const analysis =
            getAnalysis();


        const analysisResult =
            analysis.storeAnalysis(
                analysisResponse
            );


        if (
            !analysisResult ||
            !analysisResult.normalized
        ) {

            throw new Error(
                "Hasil analisis gambar tidak valid."
            );

        }


        state.set(
            "analysis.completed",
            true
        );


        ui.showAnalysis(
            analysisResult.normalized
        );


        /*
         * -------------------------------------------------
         * GENERATE PROMPT
         * -------------------------------------------------
         */

        ui.setStage(
            "engineering",
            {
                progress:
                    58
            }
        );


        const promptResponse =
            await api.generatePrompt({

                analysis:
                    analysisResult.normalized,

                model:
                    form.model,

                detail:
                    form.detail,

                purpose:
                    form.purpose,

                instruction:
                    form.instruction

            });


        ui.setStage(
            "engineering",
            {
                progress:
                    75
            }
        );


        /*
         * -------------------------------------------------
         * CLEAN + VALIDATE PROMPT
         * -------------------------------------------------
         */

        const prompt =
            getPrompt();


        const finalPrompt =
            prompt.extractPrompt(
                promptResponse
            );


        const promptValidation =
            prompt.validatePrompt(
                finalPrompt
            );


        if (
            !promptValidation ||
            !promptValidation.valid
        ) {

            throw new Error(

                promptValidation?.reason ||
                "Prompt yang dihasilkan tidak valid."

            );

        }


        prompt.storePrompt(
            finalPrompt
        );


        state.set(
            "prompt.completed",
            true
        );


        /*
         * -------------------------------------------------
         * RESULT
         * -------------------------------------------------
         */

        ui.setStage(
            "finalizing",
            {
                progress:
                    88
            }
        );


        ui.showPrompt(
            finalPrompt
        );


        /*
         * -------------------------------------------------
         * SAVE HISTORY
         * -------------------------------------------------
         */

        const history =
            getHistory();


        await history.saveSuccess({

            taskId:
                state.get(
                    "process.taskId",
                    ""
                ),

            model:
                form.model,

            modelName:
                getModelName(
                    form.model
                ),

            prompt:
                finalPrompt,

            settings:
                {

                    detail:
                        form.detail,

                    purpose:
                        form.purpose,

                    instruction:
                        form.instruction

                },

            imageReferenceUrl:
                null

        });


        /*
         * -------------------------------------------------
         * COMPLETE
         * -------------------------------------------------
         */

        state.set(
            "process.status",
            "success"
        );


        state.set(
            "process.stage",
            "completed"
        );


        state.set(
            "process.progress",
            100
        );


        ui.setStage(
            "completed",
            {
                progress:
                    100
            }
        );


        ui.showSuccess(
            "Vision selesai. Prompt berhasil dibuat."
        );


        return {

            success:
                true,

            prompt:
                finalPrompt,

            analysis:
                analysisResult.normalized

        };

    } catch (
        error
    ) {

        /*
         * -------------------------------------------------
         * ERROR
         * -------------------------------------------------
         */

        const message =
            error instanceof Error
                ? error.message
                : String(
                    error ||
                    "Vision process gagal."
                );


        state.set(
            "process.status",
            "failed"
        );


        state.set(
            "process.error",
            message
        );


        /*
         * -------------------------------------------------
         * REFUND
         * -------------------------------------------------
         */

        if (
            creditDeducted
        ) {

            try {

                await getCredit()
                    .refundCredit({

                        taskId:
                            state.get(
                                "process.taskId",
                                ""
                            ),

                        reason:
                            message

                    });


                state.set(
                    "credit.refunded",
                    true
                );


            } catch (
                refundError
            ) {

                console.error(
                    "[GEN-Z.AI Vision] Refund gagal:",
                    refundError
                );

            }

        }


        /*
         * -------------------------------------------------
         * FAILED HISTORY
         * -------------------------------------------------
         */

        try {

            await getHistory()
                .saveFailed(
                    message,
                    {

                        taskId:
                            state.get(
                                "process.taskId",
                                ""
                            ),

                        model:
                            form.model,

                        modelName:
                            getModelName(
                                form.model
                            ),

                        settings:
                            {

                                detail:
                                    form.detail,

                                purpose:
                                    form.purpose,

                                instruction:
                                    form.instruction

                            }

                    }
                );


        } catch (
            historyError
        ) {

            console.error(
                "[GEN-Z.AI Vision] History gagal:",
                historyError
            );

        }


        ui.showError(
            message
        );


        return {

            success:
                false,

            error:
                message

        };

    } finally {

        /*
         * -------------------------------------------------
         * RESTORE UI
         * -------------------------------------------------
         */

        setGenerateLock(
            false
        );


        ui.setProcessing(
            false
        );

    }

}


/* =========================================================
   COPY BUTTON
========================================================= */

async function handleCopyPrompt() {

    const ui =
        getUI();


    try {

        const prompt =
            getPrompt();


        await prompt.copyPrompt();


        ui.setCopyState(
            true
        );


        setTimeout(

            () => {

                ui.setCopyState(
                    false
                );

            },

            1800

        );


    } catch (
        error
    ) {

        ui.showError(

            error instanceof Error
                ? error.message
                : "Prompt gagal disalin."

        );

    }

}


/* =========================================================
   REMOVE IMAGE
========================================================= */

function handleRemoveImage() {

    const upload =
        getUpload();


    const preview =
        getPreview();


    const state =
        getState();


    try {

        upload.clearFile();

    } catch (
        error
    ) {

        console.error(
            "[GEN-Z.AI Vision] Upload clear:",
            error
        );

    }


    try {

        preview.clearPreview();

    } catch (
        error
    ) {

        console.error(
            "[GEN-Z.AI Vision] Preview clear:",
            error
        );

    }


    state.clearFile();


    resetProcessState();


    state.set(
        "history.saved",
        false
    );


    state.set(
        "history.historyId",
        null
    );


    getAnalysis()
        .clearAnalysis();


    getPrompt()
        .clearPrompt();


    resetUIOutput();

}


/* =========================================================
   RESET OUTPUT
========================================================= */

function resetOutput() {

    const state =
        getState();


    getAnalysis()
        .clearAnalysis();


    getPrompt()
        .clearPrompt();


    resetProcessState();


    state.set(
        "history.saved",
        false
    );


    state.set(
        "history.historyId",
        null
    );


    resetUIOutput();

}


/* =========================================================
   HANDLE MODEL CHANGE
========================================================= */

function handleModelChange(
    event
) {

    const state =
        getState();


    const value =
        event?.target?.value ||
        VISION_EVENTS_CONFIG
            .DEFAULT_MODEL;


    state.set(
        "model.id",
        value
    );


    state.set(
        "model.name",
        getModelName(
            value
        )
    );

}


/* =========================================================
   HANDLE DETAIL CHANGE
========================================================= */

function handleDetailChange(
    event
) {

    const state =
        getState();


    state.set(
        "settings.detail",
        event?.target?.value ||
        VISION_EVENTS_CONFIG
            .DEFAULT_DETAIL
    );

}


/* =========================================================
   HANDLE PURPOSE CHANGE
========================================================= */

function handlePurposeChange(
    event
) {

    const state =
        getState();


    state.set(
        "settings.purpose",
        event?.target?.value ||
        VISION_EVENTS_CONFIG
            .DEFAULT_PURPOSE
    );

}


/* =========================================================
   HANDLE INSTRUCTION INPUT
========================================================= */

function handleInstructionInput(
    event
) {

    const state =
        getState();


    state.set(
        "settings.instruction",
        event?.target?.value ||
        ""
    );

}


/* =========================================================
   HANDLE NEW IMAGE
========================================================= */

function handleNewImage(
    file
) {

    if (
        !file
    ) {

        return false;

    }


    /*
     * File dari vision-upload.js sudah
     * berisi dataUrl dan metadata.
     *
     * Render preview terlebih dahulu.
     */

    const preview =
        getPreview();


    preview.renderPreview(
        file
    );


    /*
     * Bersihkan hasil Vision lama.
     *
     * Penting:
     * resetAfterNewImage() TIDAK menghapus
     * file baru dari state.
     */

    resetAfterNewImage();


    /*
     * Pastikan state berisi file terbaru.
     */

    const state =
        getState();


    state.set(
        "file.original",
        file.original
    );


    state.set(
        "file.name",
        file.name
    );


    state.set(
        "file.size",
        file.size
    );


    state.set(
        "file.type",
        file.type
    );


    state.set(
        "file.mimeType",
        file.mimeType
    );


    state.set(
        "file.dataUrl",
        file.dataUrl
    );


    state.set(
        "file.width",
        file.width
    );


    state.set(
        "file.height",
        file.height
    );


    /*
     * Pastikan dropzone kembali aktif
     * setelah gambar berhasil dipilih.
     */

    try {

        preview.setDropzoneActive(
            false
        );

    } catch (
        error
    ) {

        console.warn(
            "[GEN-Z.AI Vision] Dropzone state:",
            error
        );

    }


    return true;

}


/* =========================================================
   HANDLE UPLOAD ERROR
========================================================= */

function handleUploadError(
    error
) {

    const message =
        error?.message ||
        "Gambar gagal diproses.";


    try {

        getPreview()
            .setDropzoneActive(
                false
            );

    } catch (
        previewError
    ) {

        console.warn(
            "[GEN-Z.AI Vision] Preview error:",
            previewError
        );

    }


    try {

        getUI()
            .showError(
                message
            );

    } catch (
        uiError
    ) {

        console.error(
            "[GEN-Z.AI Vision] Upload UI error:",
            uiError
        );

    }


    return false;

}


/* =========================================================
   OPEN FILE PICKER
   ---------------------------------------------------------
   Semua jalur pemilihan file diarahkan ke module upload.
   Jangan memproses File secara langsung di events module.
========================================================= */

function openFilePicker() {

    const dom =
        getDOM();


    const upload =
        getUpload();


    /*
     * Jalur utama.
     */

    if (
        typeof upload.openFilePicker ===
        "function"
    ) {

        upload.openFilePicker();

        return true;

    }


    /*
     * Fallback jika fungsi module upload
     * tidak tersedia.
     */

    if (
        dom.fileInput &&
        typeof dom.fileInput.click ===
            "function"
    ) {

        dom.fileInput.click();

        return true;

    }


    console.error(
        "[GEN-Z.AI Vision] File picker tidak tersedia."
    );


    return false;

}


/* =========================================================
   BIND EVENT
========================================================= */

function bindEvent(
    target,
    event,
    handler
) {

    if (
        !target ||
        typeof target.addEventListener !==
            "function"
    ) {

        return false;

    }


    target.addEventListener(
        event,
        handler
    );


    return true;

}


/* =========================================================
   BIND EVENTS
========================================================= */

function bindEvents() {

    const dom =
        getDOM();


    /* =====================================================
       FILE INPUT
       -----------------------------------------------------
       Ini adalah jalur utama setelah user memilih file
       dari native file picker.
    ===================================================== */

    bindEvent(

        dom.fileInput,

        "change",

        async event => {

            try {

                const file =
                    await getUpload()
                        .handleFileInput(
                            event
                        );


                /*
                 * handleFileInput() dari module upload
                 * mengembalikan fileData jika berhasil.
                 */

                if (
                    file
                ) {

                    handleNewImage(
                        file
                    );

                }

            } catch (
                error
            ) {

                handleUploadError(
                    error
                );

            }

        }

    );


    /* =====================================================
       BROWSE BUTTON
       -----------------------------------------------------
       Jangan mengandalkan bubbling dropzone.
       Tombol Browse mempunyai jalur picker sendiri.
    ===================================================== */

    bindEvent(

        dom.browseButton,

        "click",

        event => {

            event.preventDefault();
            event.stopPropagation();


            openFilePicker();

        }

    );


    /* =====================================================
       DROPZONE DRAG OVER
    ===================================================== */

    bindEvent(

        dom.dropzone,

        "dragover",

        event => {

            event.preventDefault();
            event.stopPropagation();


            try {

                getPreview()
                    .setDropzoneActive(
                        true
                    );

            } catch (
                error
            ) {

                console.warn(
                    "[GEN-Z.AI Vision] Dragover:",
                    error
                );

            }

        }

    );


    /* =====================================================
       DROPZONE DRAG LEAVE
    ===================================================== */

    bindEvent(

        dom.dropzone,

        "dragleave",

        event => {

            event.preventDefault();
            event.stopPropagation();


            try {

                getPreview()
                    .setDropzoneActive(
                        false
                    );

            } catch (
                error
            ) {

                console.warn(
                    "[GEN-Z.AI Vision] Dragleave:",
                    error
                );

            }

        }

    );


    /* =====================================================
       DROPZONE DROP
    ===================================================== */

    bindEvent(

        dom.dropzone,

        "drop",

        async event => {

            event.preventDefault();
            event.stopPropagation();


            try {

                getPreview()
                    .setDropzoneActive(
                        false
                    );

            } catch (
                error
            ) {

                console.warn(
                    "[GEN-Z.AI Vision] Dropzone reset:",
                    error
                );

            }


            try {

                const file =
                    await getUpload()
                        .handleDrop(
                            event
                        );


                if (
                    file
                ) {

                    handleNewImage(
                        file
                    );

                }

            } catch (
                error
            ) {

                handleUploadError(
                    error
                );

            }

        }

    );


    /* =====================================================
       DROPZONE CLICK
       -----------------------------------------------------
       Klik area kosong membuka native file picker.
       
       Jangan menggunakan fileInput.click() langsung
       sebagai jalur utama. Semua picker diarahkan
       melalui vision-upload.js.
    ===================================================== */

    bindEvent(

        dom.dropzone,

        "click",

        event => {

            /*
             * Jangan proses klik tombol.
             *
             * Browse button sudah mempunyai handler sendiri.
             */

            if (
                dom.browseButton &&
                (
                    event.target ===
                        dom.browseButton ||
                    dom.browseButton.contains(
                        event.target
                    )
                )
            ) {

                return;

            }


            /*
             * Jangan proses klik button lain
             * di dalam dropzone.
             */

            if (
                event.target?.closest(
                    "button"
                )
            ) {

                return;

            }


            /*
             * Jangan memproses klik langsung
             * pada input file.
             */

            if (
                event.target ===
                dom.fileInput
            ) {

                return;

            }


            /*
             * Semua klik area upload menuju
             * module upload.
             */

            openFilePicker();

        }

    );


    /* =====================================================
       REMOVE IMAGE
    ===================================================== */

    bindEvent(

        dom.removeButton,

        "click",

        handleRemoveImage

    );


    /* =====================================================
       GENERATE
    ===================================================== */

    bindEvent(

        dom.generateButton,

        "click",

        startVisionProcess

    );


    /* =====================================================
       COPY
    ===================================================== */

    bindEvent(

        dom.copyButton,

        "click",

        handleCopyPrompt

    );


    /* =====================================================
       MODEL
    ===================================================== */

    bindEvent(

        dom.model,

        "change",

        handleModelChange

    );


    /* =====================================================
       DETAIL
    ===================================================== */

    bindEvent(

        dom.detail,

        "change",

        handleDetailChange

    );


    /* =====================================================
       PURPOSE
    ===================================================== */

    bindEvent(

        dom.purpose,

        "change",

        handlePurposeChange

    );


    /* =====================================================
       INSTRUCTION
    ===================================================== */

    bindEvent(

        dom.instruction,

        "input",

        handleInstructionInput

    );


    return true;

}


/* =========================================================
   INITIALIZE EVENTS
========================================================= */

function initialize() {

    /*
     * Loader dapat memanggil initialize lebih dari sekali.
     * Jangan pasang listener berulang.
     */

    if (
        visionEventsInitialized
    ) {

        return true;

    }


    try {

        const dom =
            getDOM();


        /*
         * Pastikan elemen penting tersedia
         * sebelum memasang event.
         */

        if (
            !dom.fileInput
        ) {

            throw new Error(
                "visionFileInput tidak ditemukan."
            );

        }


        if (
            !dom.dropzone
        ) {

            throw new Error(
                "visionDropzone tidak ditemukan."
            );

        }


        bindEvents();


        syncFormToState();


        visionEventsInitialized =
            true;


        return true;

    } catch (
        error
    ) {

        console.error(
            "[GEN-Z.AI Vision] Event initialization failed:",
            error
        );


        return false;

    }

}


/* =========================================================
   PUBLIC API
========================================================= */

const GENZVisionEvents =
    Object.freeze({

        CONFIG:
            VISION_EVENTS_CONFIG,

        readForm,

        syncFormToState,

        validateReady,

        startVisionProcess,

        handleCopyPrompt,

        handleRemoveImage,

        resetOutput,

        openFilePicker,

        bindEvents,

        initialize

    });


/* =========================================================
   GLOBAL EXPORT
========================================================= */

window.GENZVisionEvents =
    GENZVisionEvents;
