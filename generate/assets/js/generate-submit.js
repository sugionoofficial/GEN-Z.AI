/* =========================================================
   GEN-Z.AI
   GENERATE SUBMIT MODULE
   ---------------------------------------------------------
   File:
   generate/assets/js/generate-submit.js

   Tanggung jawab:
   - Menangani submit Generate
   - Mengambil parameter dari renderer
   - Validasi parameter
   - Mengirim request Generate
   - Mengambil task ID
   - Polling task
   - Menangani success / failed / cancelled
   - Menjaga state tombol Generate
   - Tidak merender form
   - Tidak menangani pemilihan model

   PATCH (progress card):
   - GenzProgress.show() dipanggil TANPA parameters
     (parameters belum ada di titik ini)
   - GenzProgress.setThumbnail() dipanggil setelah
     parameters berhasil didapat dari getModelParameters
   - GenzProgress.update() saat queued & processing
   - GenzProgress.success() saat selesai
   - GenzProgress.fail() saat error
========================================================= */

"use strict";


/* =========================================================
   STATE
========================================================= */

let generationInProgress =
    false;


/* =========================================================
   DIAGNOSTIC HELPER
   ---------------------------------------------------------
   Update judul tab + console log supaya posisi stuck bisa
   dilihat dari HP tanpa DevTools.
========================================================= */

function setDiagStage(
    stage
) {

    const label =
        String(
            stage ||
            ""
        );


    try {

        document.title =
            "[DIAG] " +
            label;

    } catch {
        /* ignore */
    }


    try {

        console.log(
            "[GEN-Z.AI][DIAG]",
            new Date()
                .toISOString(),

            label
        );

    } catch {
        /* ignore */
    }

}


/* =========================================================
   DIAGNOSTIC: AWAIT WITH TIMEOUT
   ---------------------------------------------------------
   Mencegah hang total kalau promise tidak pernah settle.
========================================================= */

async function awaitWithTimeout(
    promise,
    label,
    ms = 90000
) {

    if (
        !promise ||
        typeof promise.then !==
        "function"
    ) {

        return promise;

    }


    let timer =
        null;


    const timeout =
        new Promise(
            (_, reject) => {

                timer =
                    setTimeout(
                        () => {

                            reject(
                                new Error(
                                    `[TIMEOUT] ${label} > ${ms}ms`
                                )
                            );

                        },
                        ms
                    );

            }
        );


    try {

        return await Promise.race([

            promise,

            timeout

        ]);

    } finally {

        if (
            timer
        ) {

            clearTimeout(
                timer
            );

        }

    }

}


/* =========================================================
   GENERATION STATE
========================================================= */

function isGenerationInProgress() {

    return generationInProgress;

}


/* =========================================================
   GET APP
========================================================= */

function getApp() {

    const app =
        window.GENZGenerateApp;

    if (
        !app
    ) {

        throw new Error(
            "GENZGenerateApp belum tersedia."
        );

    }

    return app;

}


/* =========================================================
   GET MODULES
========================================================= */

function getModules() {

    const app =
        getApp();

    if (
        typeof app.getModules !==
        "function"
    ) {

        throw new Error(
            "GENZGenerateApp.getModules() tidak tersedia."
        );

    }

    return app.getModules();

}


/* =========================================================
   GET APP STATE
========================================================= */

function getAppState() {

    const app =
        getApp();

    if (
        !app.state
    ) {

        throw new Error(
            "GENZGenerateApp.state tidak tersedia."
        );

    }

    return app.state;

}


/* =========================================================
   GET DOM
========================================================= */

function getDOM() {

    /*
     * generate-app.js tidak mengekspos getDOM().
     *
     * Karena submit module hanya membutuhkan
     * elemen-elemen berikut, ambil langsung dari DOM.
     */

    return {

        generateButton:
            document.getElementById(
                "generateButton"
            ),

        generateForm:
            document.getElementById(
                "generateForm"
            ),

        status:
            document.getElementById(
                "status"
            ),

        resultModel:
            document.getElementById(
                "resultModel"
            ),

        resultProvider:
            document.getElementById(
                "resultProvider"
            ),

        resultTaskId:
            document.getElementById(
                "resultTaskId"
            )

    };

}


/* =========================================================
   CURRENT MODEL
========================================================= */

function getCurrentModel() {

    const app =
        getApp();

    if (
        typeof app.getCurrentModel !==
        "function"
    ) {

        throw new Error(
            "GENZGenerateApp.getCurrentModel() tidak tersedia."
        );

    }

    return app.getCurrentModel();

}


/* =========================================================
   MODEL ID
========================================================= */

function getModelId(
    model
) {

    return String(

        model?.model_id ||

        model?.id ||

        model?.model?.model_id ||

        model?.model?.id ||

        ""

    ).trim();

}


/* =========================================================
   MODEL NAME
========================================================= */

function getModelName(
    model
) {

    return String(

        model?.model_name ||

        model?.name ||

        model?.model?.model_name ||

        model?.model?.name ||

        model?.repository?.model_name ||

        getModelId(
            model
        ) ||

        "Model"

    ).trim();

}


/* =========================================================
   PROVIDER NAME
========================================================= */

function getProviderName(
    model
) {

    if (
        typeof model?.provider ===
        "object"
    ) {

        return String(

            model.provider.provider_name ||

            model.provider.name ||

            "-"

        ).trim();

    }

    if (
        typeof model?.provider ===
        "string"
    ) {

        return String(
            model.provider
        ).trim();

    }

    return String(

        model?.provider_name ||

        model?.providerName ||

        model?.model?.provider_name ||

        model?.repository?.provider_name ||

        "-"

    ).trim();

}


/* =========================================================
   UI BRIDGE
========================================================= */

function callApp(
    method,
    ...args
) {

    const app =
        getApp();

    if (
        typeof app[method] ===
        "function"
    ) {

        return app[method](
            ...args
        );

    }

    return undefined;

}


/* =========================================================
   ERROR
========================================================= */

function showError(
    message
) {

    callApp(
        "showError",
        message
    );

}


/* =========================================================
   HIDE ERROR
========================================================= */

function hideError() {

    callApp(
        "hideError"
    );

}


/* =========================================================
   LOADING
========================================================= */

function showLoading(
    message
) {

    callApp(
        "showLoading",
        message
    );

}


/* =========================================================
   HIDE LOADING
========================================================= */

function hideLoading() {

    callApp(
        "hideLoading"
    );

}


/* =========================================================
   GENERATE STATUS
========================================================= */

function setGenerateStatus(
    state,
    message
) {

    callApp(
        "setGenerateStatus",
        state,
        message
    );

}


/* =========================================================
   KIE DIAGNOSTIC
========================================================= */

function renderKieDiagnostic(
    data,
    stage
) {

    callApp(
        "renderKieDiagnostic",
        data,
        stage
    );

}


/* =========================================================
   MODEL CREDIT
========================================================= */

function getModelCredit(
    model
) {

    const app =
        getApp();

    if (
        typeof app.getModelCredit ===
        "function"
    ) {

        return app.getModelCredit(
            model
        );

    }

    return null;

}


/* =========================================================
   RESOLUTION
========================================================= */

function getSelectedResolution() {

    const app =
        getApp();

    if (
        typeof app.getSelectedResolution ===
        "function"
    ) {

        return app.getSelectedResolution();

    }

    return "";

}


/* =========================================================
   POLLING HELPERS
========================================================= */

function isPollingFailed(
    value
) {

    const app =
        getApp();

    if (
        typeof app.isPollingFailed ===
        "function"
    ) {

        return app.isPollingFailed(
            value
        );

    }

    return false;

}


function isPollingCompleted(
    value
) {

    const app =
        getApp();

    if (
        typeof app.isPollingCompleted ===
        "function"
    ) {

        return app.isPollingCompleted(
            value
        );

    }

    return false;

}


function getPollingState(
    value
) {

    const app =
        getApp();

    if (
        typeof app.getPollingState ===
        "function"
    ) {

        return app.getPollingState(
            value
        );

    }

    return "";

}


/* =========================================================
   TASK ID
========================================================= */

function extractTaskId(
    response
) {

    const app =
        getApp();

    if (
        typeof app.extractTaskId ===
        "function"
    ) {

        return app.extractTaskId(
            response
        );

    }

    return (

        response?.taskId ||

        response?.data?.taskId ||

        response?.data?.task_id ||

        response?.task_id ||

        ""

    );

}


/* =========================================================
   ERROR DIAGNOSTIC
========================================================= */

function extractErrorDiagnostic(
    error
) {

    const app =
        getApp();

    if (
        typeof app.extractErrorDiagnostic ===
        "function"
    ) {

        return app.extractErrorDiagnostic(
            error
        );

    }

    return {

        success:
            false,

        message:
            error?.message ||
            "Generate gagal diproses."

    };

}


/* =========================================================
   ENABLE GENERATE
========================================================= */

function enableGenerateButton(
    model
) {

    callApp(
        "enableGenerateButton",
        model
    );

}


/* =========================================================
   DISABLE GENERATE
========================================================= */

function disableGenerateButton() {

    callApp(
        "disableGenerateButton"
    );

}


/* =========================================================
   SYNC CREDIT
========================================================= */

function syncModelCreditForResolution() {

    callApp(
        "syncModelCreditForResolution"
    );

}


/* =========================================================
   NORMALIZE CANCELLATION
========================================================= */

function normalizeCancellation(
    value
) {

    const modules =
        getModules();

    const cancellation =
        modules.cancellation ||
        window.GENZGenerateCancellation;

    if (
        cancellation &&
        typeof cancellation.normalizeGenerateCancellation ===
        "function"
    ) {

        return cancellation
            .normalizeGenerateCancellation(
                value
            );

    }

    return {

        cancelled:
            true,

        message:
            value?.message ||
            "Generate dibatalkan."

    };

}


/* =========================================================
   IS CANCELLED
========================================================= */

function isCancelled(
    value
) {

    const modules =
        getModules();

    const cancellation =
        modules.cancellation ||
        window.GENZGenerateCancellation;

    if (
        cancellation &&
        typeof cancellation.isGenerateCancelled ===
        "function"
    ) {

        return cancellation
            .isGenerateCancelled(
                value
            );

    }

    return false;

}


/* =========================================================
   GENZ PROGRESS CARD — SAFE WRAPPERS
   ---------------------------------------------------------
   Semua helper ini mencegah error pada flow generate
   apabila window.GenzProgress tidak tersedia.
========================================================= */

function progressShow(
    options
) {

    try {

        if (
            window.GenzProgress &&
            typeof window.GenzProgress.show ===
                "function"
        ) {

            window.GenzProgress.show(
                options || {}
            );

        }

    } catch (
        error
    ) {

        console.warn(
            "[GENZ] progressShow error:",
            error
        );

    }

}


function progressSetThumbnail(
    url
) {

    try {

        if (
            window.GenzProgress &&
            typeof window.GenzProgress.setThumbnail ===
                "function" &&
            url
        ) {

            window.GenzProgress.setThumbnail(
                url
            );

        }

    } catch (
        error
    ) {

        console.warn(
            "[GENZ] progressSetThumbnail error:",
            error
        );

    }

}


function progressSetModel(
    name
) {

    try {

        if (
            window.GenzProgress &&
            typeof window.GenzProgress.setModel ===
                "function" &&
            name
        ) {

            window.GenzProgress.setModel(
                name
            );

        }

    } catch (
        error
    ) {

        console.warn(
            "[GENZ] progressSetModel error:",
            error
        );

    }

}


function progressUpdate(
    options
) {

    try {

        if (
            window.GenzProgress &&
            typeof window.GenzProgress.update ===
                "function"
        ) {

            window.GenzProgress.update(
                options || {}
            );

        }

    } catch (
        error
    ) {

        console.warn(
            "[GENZ] progressUpdate error:",
            error
        );

    }

}


function progressSuccess(
    options
) {

    try {

        if (
            window.GenzProgress &&
            typeof window.GenzProgress.success ===
                "function"
        ) {

            window.GenzProgress.success(
                options || {}
            );

        }

    } catch (
        error
    ) {

        console.warn(
            "[GENZ] progressSuccess error:",
            error
        );

    }

}


function progressFail(
    options
) {

    try {

        if (
            window.GenzProgress &&
            typeof window.GenzProgress.fail ===
                "function"
        ) {

            window.GenzProgress.fail(
                options || {}
            );

        }

    } catch (
        error
    ) {

        console.warn(
            "[GENZ] progressFail error:",
            error
        );

    }

}


/* =========================================================
   HANDLE GENERATE SUBMIT
========================================================= */

async function handleGenerateSubmit(
    event
) {

    event.preventDefault();

    event.stopPropagation();


    if (
        generationInProgress
    ) {

        return;

    }


    setDiagStage(
        "1. Mulai submit"
    );


    const elements =
        getDOM();

    const model =
        getCurrentModel();


    if (
        !model ||
        !getModelId(
            model
        )
    ) {

        showError(
            "Model belum siap digunakan."
        );

        return;

    }


    const modelId =
        getModelId(
            model
        );


    if (
        !modelId
    ) {

        showError(
            "Model ID tidak tersedia untuk polling."
        );

        return;

    }


    const modules =
        getModules();


    const request =
        modules.request;

    const polling =
        modules.polling;

    const render =
        modules.render;


    if (
        !request
    ) {

        showError(
            "generate-request.js tidak berhasil dimuat. Periksa file dan import module."
        );

        return;

    }


    if (
        typeof request.generateVideo !==
        "function"
    ) {

        showError(
            "generate-request.js dimuat tetapi generateVideo() tidak tersedia."
        );

        return;

    }


    if (
        !polling
    ) {

        showError(
            "generate-polling.js tidak berhasil dimuat."
        );

        return;

    }


    if (
        typeof polling.pollGenerateTask !==
        "function"
    ) {

        showError(
            "generate-polling.js dimuat tetapi pollGenerateTask() tidak tersedia."
        );

        return;

    }


    if (
        !render ||
        typeof render.getModelParameters !==
        "function"
    ) {

        showError(
            "generate-render.js tidak tersedia atau getModelParameters() tidak tersedia."
        );

        return;

    }


    generationInProgress =
        true;


    hideError();


    setGenerateStatus(
        "processing",
        "Menyiapkan proses generate..."
    );


    if (
        elements.generateButton
    ) {

        elements.generateButton.disabled =
            true;

        elements.generateButton.setAttribute(
            "aria-busy",
            "true"
        );

    }


    if (
        elements.generateForm
    ) {

        elements.generateForm
            .querySelectorAll(
                "input, select, textarea, button"
            )
            .forEach(
                field => {

                    field.disabled =
                        true;

                }
            );

    }


    renderKieDiagnostic(
        {

            success:
                true,

            stage:
                "client",

            provider:
                getProviderName(
                    model
                ),

            model_id:
                modelId,

            model_name:
                getModelName(
                    model
                ),

            resolution:
                getSelectedResolution(),

            model_credit:
                getModelCredit(
                    model
                ),

            message:
                "Form siap. Request akan dikirim ke server GEN-Z.AI."

        },

        "REQUEST"

    );


    showLoading(
        "Menyiapkan request..."
    );


    /* =====================================================
       GENZ PROGRESS CARD — SHOW
       -----------------------------------------------------
       PENTING: JANGAN akses `parameters` di sini.
       Variabel `parameters` didefinisikan di dalam try
       block di bawah setelah getModelParameters selesai.

       Thumbnail akan di-set belakangan lewat
       progressSetThumbnail() setelah parameters ada.
    ===================================================== */

    progressShow({

        model:
            modelId,

        title:
            "Menyiapkan permintaan..."

    });


    try {

        /*
         * =================================================
         * PARAMETERS
         * =================================================
         *
         * generate-render.js sekarang menjadi pintu
         * pengambilan parameter.
         *
         * Ini penting untuk Seedance:
         *
         * Seedance
         *    ↓
         * generate-render.js
         *    ↓
         * generate-seedance.js
         *
         * Model lain
         *    ↓
         * generate-render.js
         *    ↓
         * generate-form.js
         */

        setDiagStage(
            "2. Sebelum getModelParameters"
        );


        const parameters =
            await awaitWithTimeout(

                render.getModelParameters(
                    model
                ),

                "getModelParameters",

                90000

            );


        setDiagStage(
            "3. Setelah getModelParameters OK"
        );


        /* =================================================
           GENZ PROGRESS CARD — SET THUMBNAIL
           -------------------------------------------------
           parameters baru tersedia di sini.
           Ambil image_url pertama sebagai thumbnail.
        ================================================= */

        try {

            const imageUrls =
                parameters &&
                Array.isArray(
                    parameters.image_urls
                )
                    ? parameters.image_urls
                    : [];

            if (
                imageUrls.length &&
                imageUrls[0]
            ) {

                progressSetThumbnail(
                    imageUrls[0]
                );

            }

        } catch (
            thumbError
        ) {

            console.warn(
                "[GENZ] thumbnail setup error:",
                thumbError
            );

        }


        /*
         * =================================================
         * VALIDATION
         * =================================================
         */

        let validationErrors =
            [];


        if (
            typeof render.validateModelParameters ===
            "function"
        ) {

            validationErrors =
                render.validateModelParameters(
                    model,
                    parameters
                );

        }

        else if (
            typeof request.validateGenerateRequest ===
            "function"
        ) {

            validationErrors =
                request.validateGenerateRequest(
                    parameters
                );

        }


        if (
            Array.isArray(
                validationErrors
            ) &&
            validationErrors.length
        ) {

            throw new Error(
                validationErrors.join(
                    "\n"
                )
            );

        }


        showLoading(
            "Mengirim request ke GEN-Z.AI..."
        );


        setGenerateStatus(
            "processing",
            "Request sedang dikirim ke GEN-Z.AI..."
        );


        /*
         * =================================================
         * CREATE TASK
         * =================================================
         */

        setDiagStage(
            "4. Sebelum generateVideo"
        );


        const response =
            await awaitWithTimeout(

                request.generateVideo(
                    parameters
                ),

                "generateVideo",

                90000

            );


        setDiagStage(
            "5. generateVideo OK, dapat response"
        );


        renderKieDiagnostic(
            response,
            "TASK CREATED"
        );


        const taskId =
            extractTaskId(
                response
            );


        if (
            !taskId
        ) {

            const error =
                new Error(
                    "KIE.AI tidak mengembalikan task ID."
                );

            error.code =
                "TASK_ID_MISSING";

            error.details =
                response;

            throw error;

        }


        if (
            elements.resultModel
        ) {

            elements.resultModel.textContent =
                getModelName(
                    model
                );

        }


        if (
            elements.resultProvider
        ) {

            elements.resultProvider.textContent =
                getProviderName(
                    model
                );

        }


        if (
            elements.resultTaskId
        ) {

            elements.resultTaskId.textContent =
                taskId;

        }


        showLoading(
            `KIE.AI menerima task ${taskId}. Menunggu hasil...`
        );


        /* ===== GENZ PROGRESS CARD — QUEUED ===== */

        progressUpdate({

            status:
                "QUEUED",

            message:
                "Task diterima. Menunggu antrean..."

        });


        setGenerateStatus(
            "processing",
            "Generate sedang diproses. Mohon tunggu..."
        );


        /*
         * =================================================
         * POLLING
         * =================================================
         */

        setDiagStage(
            "6. Sebelum polling"
        );


        const result =
            await polling.pollGenerateTask(
                taskId,
                {

                    modelId:
                        modelId,

                    interval:
                        3000,

                    timeout:
                        15 * 60 * 1000,

                    onUpdate:
                        update => {

                            const failed =
                                isPollingFailed(
                                    update
                                );

                            const completed =
                                isPollingCompleted(
                                    update
                                );


                            if (
                                failed
                            ) {

                                const failedMessage =
                                    update?.message ||
                                    update?.msg ||
                                    update?.error ||
                                    update?.data?.message ||
                                    update?.data?.error ||
                                    "Generate gagal diproses.";


                                showLoading(
                                    "KIE.AI melaporkan generate gagal."
                                );


                                setGenerateStatus(
                                    "failed",
                                    failedMessage
                                );


                                /* ===== GENZ PROGRESS CARD — FAIL (polling) ===== */

                                progressFail({

                                    message:
                                        failedMessage

                                });

                            }

                            else if (
                                completed
                            ) {

                                showLoading(
                                    "KIE.AI selesai. Memverifikasi hasil..."
                                );


                                setGenerateStatus(
                                    "processing",
                                    "Generate selesai. Sedang memverifikasi hasil..."
                                );


                                /* ===== GENZ PROGRESS CARD — VERIFY ===== */

                                progressUpdate({

                                    status:
                                        "PROCESSING",

                                    message:
                                        "Memverifikasi hasil..."

                                });

                            }

                            else {

                                showLoading(
                                    `KIE.AI sedang memproses task ${taskId}...`
                                );


                                /* ===== GENZ PROGRESS CARD — UPDATE ===== */

                                const progressState =
                                    String(
                                        update?.state ||
                                        update?.provider_state ||
                                        update?.status ||
                                        ""
                                    )
                                        .trim()
                                        .toUpperCase();


                                progressUpdate({

                                    status:
                                        progressState ||
                                        "PROCESSING",

                                    message:
                                        "Sedang diproses oleh AI..."

                                });


                                setGenerateStatus(
                                    "processing",
                                    "Video sedang diproses. Mohon tunggu..."
                                );

                            }

                        }

                }
            );


        setDiagStage(
            "7. Polling OK"
        );


        /*
         * =================================================
         * CANCELLATION
         * ================================================= */

        if (
            isCancelled(
                result
            )
        ) {

            const cancelledResult =
                normalizeCancellation(
                    result
                );


            setGenerateStatus(
                "cancelled",
                cancelledResult.message ||
                    "Generate dibatalkan oleh admin."
            );


            getAppState()
                .generationInProgress =
                false;


            return cancelledResult;

        }


        /*
         * =================================================
         * FINAL FAILED CHECK
         * ================================================= */

        if (
            isPollingFailed(
                result
            )
        ) {

            const error =
                new Error(

                    result?.message ||

                    result?.msg ||

                    result?.error ||

                    "KIE.AI melaporkan task gagal."

                );


            error.code =

                result?.code ||

                result?.error_code ||

                result?.errorCode ||

                "TASK_FAILED";


            error.details =
                result;


            throw error;

        }


        /*
         * =================================================
         * FINAL COMPLETED CHECK
         * ================================================= */

        if (
            !isPollingCompleted(
                result
            )
        ) {

            const state =
                getPollingState(
                    result
                );


            const error =
                new Error(

                    state

                        ? `Polling selesai tetapi task masih berstatus "${state}".`

                        : "Polling selesai tetapi status task belum terkonfirmasi selesai."

                );


            error.code =
                "TASK_NOT_COMPLETED";


            error.details =
                result;


            throw error;

        }


        /*
         * =================================================
         * SUCCESS
         * ================================================= */

        renderKieDiagnostic(
            result,
            "COMPLETED"
        );


        const resultBox =
            document.getElementById(
                "genzGenerationResult"
            );


        if (
            resultBox
        ) {

            resultBox.innerHTML =
                "";

            resultBox.style.display =
                "none";

        }


        if (
            elements.resultModel
        ) {

            elements.resultModel.textContent =
                getModelName(
                    model
                );

        }


        if (
            elements.resultProvider
        ) {

            elements.resultProvider.textContent =
                getProviderName(
                    model
                );

        }


        if (
            elements.resultTaskId
        ) {

            elements.resultTaskId.textContent =
                taskId;

        }


        if (
            elements.status
        ) {

            elements.status.textContent =
                "Generate selesai.";

            elements.status.hidden =
                false;

        }


        setGenerateStatus(
            "success",
            "Check Hasil Generate di History...!!!"
        );


        /* ===== GENZ PROGRESS CARD — SUCCESS ===== */

        progressSuccess({

            message:
                "Video selesai dibuat! Cek History."

        });


        hideLoading();


        return result;


    } catch (
        error
    ) {

        setDiagStage(
            "ERROR: " +
            (
                error?.message ||
                "unknown"
            )
        );


        const diagnostic =
            extractErrorDiagnostic(
                error
            );


        renderKieDiagnostic(
            diagnostic,
            "FAILED"
        );


        const errorMessage =
            error?.message ||
            diagnostic?.message ||
            diagnostic?.error ||
            "Generate gagal diproses.";


        showError(
            errorMessage
        );


        if (
            isCancelled(
                error
            )
        ) {

            const cancelledResult =
                normalizeCancellation(
                    error
                );


            setGenerateStatus(
                "cancelled",
                cancelledResult.message ||
                    "Generate dibatalkan."
            );


            getAppState()
                .generationInProgress =
                false;


            /* ===== GENZ PROGRESS CARD — CANCELLED ===== */

            progressFail({

                message:
                    cancelledResult.message ||
                    "Generate dibatalkan."

            });


            return cancelledResult;

        }


        setGenerateStatus(
            "failed",
            errorMessage
        );


        /* ===== GENZ PROGRESS CARD — FAIL ===== */

        progressFail({

            message:
                errorMessage

        });


        if (
            elements.status
        ) {

            elements.status.textContent =
                "Generate error: " +
                errorMessage;

            elements.status.hidden =
                false;

        }

    } finally {

        generationInProgress =
            false;


        hideLoading();


        if (
            elements.generateForm
        ) {

            elements.generateForm
                .querySelectorAll(
                    "input, select, textarea, button"
                )
                .forEach(
                    field => {

                        field.disabled =
                            false;

                    }
                );

        }


        const currentModel =
            getCurrentModel();


        if (
            currentModel &&
            getModelId(
                currentModel
            )
        ) {

            enableGenerateButton(
                currentModel
            );


            syncModelCreditForResolution();

        }

        else {

            disableGenerateButton();

        }

    }

}


/* =========================================================
   PUBLIC API
========================================================= */

const GENZGenerateSubmit =
    Object.freeze({

        handleGenerateSubmit,

        isGenerationInProgress

    });


/*
 * Compatibility global.
 *
 * Tetap dipertahankan karena beberapa bagian
 * sistem lama masih dapat mengakses API ini
 * melalui window.
 */

window.GENZGenerateSubmit =
    GENZGenerateSubmit;


/* =========================================================
   ES MODULE EXPORT
========================================================= */

export {

    handleGenerateSubmit,

    isGenerationInProgress

};
