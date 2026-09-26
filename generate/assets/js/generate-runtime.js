 /* =========================================================
   GEN-Z.AI
   GENERATE RUNTIME BRIDGE
   ---------------------------------------------------------
   File:
   generate/assets/js/generate-runtime.js

   Tanggung jawab:
   - Menjadi bridge antara generate-app.js dan module lain
   - Menyediakan helper UI
   - Menyediakan helper model
   - Menyediakan helper polling
   - Tidak menangani request API
   - Tidak menangani rendering form
   - Tidak menangani submit
========================================================= */

"use strict";


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
   GET DOM
========================================================= */

function getDOM() {

    return {

        modelSelector:
            document.getElementById(
                "modelSelector"
            ),

        modelSelect:
            document.getElementById(
                "modelSelect"
            ),

        dynamicFields:
            document.getElementById(
                "dynamicFields"
            ),

        generateForm:
            document.getElementById(
                "generateForm"
            ),

        generateButton:
            document.getElementById(
                "generateButton"
            ),

        generateStatus:
            document.getElementById(
                "generateStatus"
            ),

        generateCreditCost:
            document.getElementById(
                "generateCreditCost"
            ),

        generateCreditValue:
            document.getElementById(
                "generateCreditValue"
            ),

        modelName:
            document.getElementById(
                "modelName"
            ),

        modelDescription:
            document.getElementById(
                "modelDescription"
            ),

        providerName:
            document.getElementById(
                "providerName"
            ),

        modelMeta:
            document.getElementById(
                "modelMeta"
            ),

        loading:
            document.getElementById(
                "loading"
            ),

        status:
            document.getElementById(
                "status"
            ),

        pageError:
            document.getElementById(
                "pageError"
            ),

        pageErrorMessage:
            document.getElementById(
                "pageErrorMessage"
            ),

        resetButton:
            document.getElementById(
                "resetButton"
            ),

        generateCard:
            document.getElementById(
                "generateCard"
            ),

        creditBadge:
            document.getElementById(
                "creditBadge"
            ),

        roleBadge:
            document.getElementById(
                "roleBadge"
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
   APP STATE
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
   MODULES
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
   CURRENT MODEL
========================================================= */

function getCurrentModel() {

    const app =
        getApp();

    if (
        typeof app.getCurrentModel !==
        "function"
    ) {

        return null;

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
   SELECTED RESOLUTION
========================================================= */

function normalizeResolution(
    value
) {

    let resolution =
        String(
            value ??
            ""
        )
        .trim()
        .toLowerCase();

    if (
        !resolution
    ) {

        return "";

    }

    resolution =
        resolution
            .replace(
                /\s+/g,
                ""
            )
            .replace(
                /p$/i,
                ""
            );

    if (
        resolution === "480" ||
        resolution === "480p"
    ) {

        return "480p";

    }

    if (
        resolution === "720" ||
        resolution === "720p"
    ) {

        return "720p";

    }

    if (
        resolution === "1080" ||
        resolution === "1080p"
    ) {

        return "1080p";

    }

    return String(
        value ??
        ""
    ).trim();

}


function getSelectedResolution() {

    const elements =
        getDOM();

    const root =
        elements.generateForm ||
        elements.dynamicFields ||
        document;

    const checked =
        root.querySelector(
            [
                '[name="resolution"]:checked',
                '#resolution input[type="radio"]:checked',
                '[data-parameter="resolution"] input[type="radio"]:checked',
                '[data-key="resolution"] input[type="radio"]:checked',
                '[data-resolution]:checked'
            ].join(",")
        );

    if (
        checked
    ) {

        return normalizeResolution(
            checked.value ||
            checked.dataset?.resolution ||
            checked.getAttribute(
                "data-resolution"
            )
        );

    }

    const select =
        root.querySelector(
            [
                'select[name="resolution"]',
                '#resolution',
                '[data-parameter="resolution"]',
                '[data-key="resolution"]'
            ].join(",")
        );

    if (
        select
    ) {

        return normalizeResolution(
            select.value ||
            select.dataset?.resolution ||
            select.getAttribute(
                "data-resolution"
            )
        );

    }

    return "";

}


/* =========================================================
   UI
========================================================= */

function showError(
    message
) {

    const elements =
        getDOM();

    const text =
        String(
            message ||
            "Terjadi kesalahan."
        );

    if (
        elements.pageError
    ) {

        elements.pageError.hidden =
            false;

        elements.pageError.style.display =
            "block";

    }

    if (
        elements.pageErrorMessage
    ) {

        elements.pageErrorMessage.textContent =
            text;

    }

    if (
        elements.status
    ) {

        elements.status.textContent =
            text;

        elements.status.hidden =
            false;

    }

}


function hideError() {

    const elements =
        getDOM();

    if (
        elements.pageError
    ) {

        elements.pageError.hidden =
            true;

        elements.pageError.style.display =
            "none";

    }

}


function showLoading(
    message = "Memuat..."
) {

    const elements =
        getDOM();

    if (
        elements.loading
    ) {

        elements.loading.hidden =
            false;

        elements.loading.style.display =
            "flex";

        elements.loading.style.visibility =
            "visible";

        elements.loading.style.opacity =
            "1";

        elements.loading.setAttribute(
            "aria-hidden",
            "false"
        );

    }

    if (
        elements.status
    ) {

        elements.status.textContent =
            message;

        elements.status.hidden =
            false;

    }

}


function hideLoading() {

    const elements =
        getDOM();

    if (
        elements.loading
    ) {

        elements.loading.hidden =
            true;

        elements.loading.style.display =
            "none";

        elements.loading.style.visibility =
            "hidden";

        elements.loading.style.opacity =
            "0";

        elements.loading.setAttribute(
            "aria-hidden",
            "true"
        );

    }

}


/* =========================================================
   GENERATE STATUS
========================================================= */

function setGenerateStatus(
    type,
    message = ""
) {

    const app =
        getApp();

    if (
        typeof app.setGenerateStatus ===
        "function"
    ) {

        return app.setGenerateStatus(
            type,
            message
        );

    }

    const status =
        getDOM()
            .generateStatus;

    if (
        !status
    ) {

        return;

    }

    status.textContent =
        message;

    status.style.display =
        type === "idle"
            ? "none"
            : "flex";

}


/* =========================================================
   DIAGNOSTIC
========================================================= */

function renderKieDiagnostic(
    response,
    phase
) {

    const app =
        getApp();

    if (
        typeof app.renderKieDiagnostic ===
        "function"
    ) {

        return app.renderKieDiagnostic(
            response,
            phase
        );

    }

}


/* =========================================================
   MODEL CREDIT
========================================================= */

function getModelCredit(
    model,
    resolution = ""
) {

    const app =
        getApp();

    if (
        typeof app.getModelCredit ===
        "function"
    ) {

        return app.getModelCredit(
            model,
            resolution
        );

    }

    return null;

}


function syncModelCreditForResolution() {

    const app =
        getApp();

    if (
        typeof app.syncModelCreditForResolution ===
        "function"
    ) {

        return app.syncModelCreditForResolution();

    }

    return null;

}


/* =========================================================
   GENERATE BUTTON
========================================================= */

function enableGenerateButton(
    model
) {

    const app =
        getApp();

    if (
        typeof app.enableGenerateButton ===
        "function"
    ) {

        return app.enableGenerateButton(
            model
        );

    }

    const button =
        getDOM()
            .generateButton;

    if (
        button
    ) {

        button.disabled =
            false;

    }

}


function disableGenerateButton() {

    const app =
        getApp();

    if (
        typeof app.disableGenerateButton ===
        "function"
    ) {

        return app.disableGenerateButton();

    }

    const button =
        getDOM()
            .generateButton;

    if (
        button
    ) {

        button.disabled =
            true;

    }

}


/* =========================================================
   POLLING
========================================================= */

function getPollingState(
    value
) {

    return String(

        value?.state ||

        value?.status ||

        value?.task_state ||

        value?.taskStatus ||

        value?.data?.state ||

        value?.data?.status ||

        value?.data?.task_state ||

        value?.data?.taskStatus ||

        value?.task?.state ||

        value?.task?.status ||

        value?.task?.task_state ||

        value?.task?.taskStatus ||

        value?.data?.task?.state ||

        value?.data?.task?.status ||

        value?.data?.task?.task_state ||

        value?.data?.task?.taskStatus ||

        value?.result?.state ||

        value?.result?.status ||

        value?.data?.result?.state ||

        value?.data?.result?.status ||

        ""

    )
        .trim()
        .toLowerCase()
        .replace(
            /\s+/g,
            "_"
        );

}


function isPollingFailed(
    value
) {

    if (
        window.GENZGenerateCancellation
            ?.isGenerateCancelled?.(
                value
            )
    ) {

        return false;

    }

    if (
        value?.failed === true
    ) {

        return true;

    }

    return [

        "fail",
        "failed",
        "failure",
        "error",
        "rejected",
        "terminated"

    ].includes(
        getPollingState(
            value
        )
    );

}


function isPollingCompleted(
    value
) {

    if (
        window.GENZGenerateCancellation
            ?.isGenerateCancelled?.(
                value
            )
    ) {

        return false;

    }

    if (
        value?.failed === true
    ) {

        return false;

    }

    const state =
        getPollingState(
            value
        );

    if (
        [
            "fail",
            "failed",
            "failure",
            "error",
            "rejected",
            "terminated"
        ].includes(
            state
        )
    ) {

        return false;

    }

    if (
        [
            "waiting",
            "pending",
            "queued",
            "queue",
            "processing",
            "running",
            "generating",
            "in_progress",
            "in-progress",
            "created",
            "submitted",
            "starting",
            "started"
        ].includes(
            state
        )
    ) {

        return false;

    }

    if (
        [
            "success",
            "succeeded",
            "successful",
            "completed",
            "complete",
            "done",
            "finished",
            "successfully_completed"
        ].includes(
            state
        )
    ) {

        return true;

    }

    if (
        value?.completed === true
    ) {

        return true;

    }

    const resultUrls =
        Array.isArray(
            value?.resultUrls
        )
            ? value.resultUrls

            : Array.isArray(
                value?.result_urls
            )
                ? value.result_urls

                : Array.isArray(
                    value?.data?.resultUrls
                )
                    ? value.data.resultUrls

                    : Array.isArray(
                        value?.data?.result_urls
                    )
                        ? value.data.result_urls

                        : [];

    return (
        resultUrls.length >
        0
    );

}


/* =========================================================
   TASK ID
========================================================= */

function extractTaskId(
    response
) {

    return String(

        response?.taskId ||

        response?.task_id ||

        response?.jobId ||

        response?.job_id ||

        response?.data?.taskId ||

        response?.data?.task_id ||

        response?.data?.jobId ||

        response?.data?.job_id ||

        response?.task?.taskId ||

        response?.task?.task_id ||

        response?.task?.jobId ||

        response?.task?.job_id ||

        response?.data?.task?.taskId ||

        response?.data?.task?.task_id ||

        response?.data?.task?.jobId ||

        response?.data?.task?.job_id ||

        ""

    ).trim();

}


/* =========================================================
   ERROR DIAGNOSTIC
========================================================= */

function extractErrorDiagnostic(
    error
) {

    if (
        error?.details
    ) {

        return error.details;

    }

    if (
        error?.response
    ) {

        return error.response;

    }

    if (
        error?.data
    ) {

        return error.data;

    }

    return {

        success:
            false,

        code:
            error?.code ||
            "GENERATION_FAILED",

        message:
            error?.message ||
            "Generate gagal."

    };

}


/* =========================================================
   PUBLIC API
========================================================= */

window.GENZGenerateRuntime =
    Object.freeze({

        getDOM,

        getAppState,

        getModules,

        getCurrentModel,

        getModelId,

        getModelName,

        getProviderName,

        normalizeResolution,

        getSelectedResolution,

        showError,

        hideError,

        showLoading,

        hideLoading,

        setGenerateStatus,

        renderKieDiagnostic,

        getModelCredit,

        syncModelCreditForResolution,

        enableGenerateButton,

        disableGenerateButton,

        getPollingState,

        isPollingFailed,

        isPollingCompleted,

        extractTaskId,

        extractErrorDiagnostic

    });
