/* =========================================================
   GEN-Z.AI
   HISTORY MODAL MODULE
   ---------------------------------------------------------
   File:
   history/assets/js/history-modal.js

   Tanggung jawab:
   - Membuka detail history
   - Menutup detail modal
   - Render isi detail
   - Menampilkan prompt / model / provider / status
   - Menampilkan result URL
   - Menampilkan error generation

   Tidak bertanggung jawab:
   - Query Supabase
   - Authentication
   - Polling
   - Render table
   - Filter
   - Sidebar
========================================================= */

(function () {
    "use strict";

    window.GENZHistory = window.GENZHistory || {};

    const App = window.GENZHistory;

    App.state = App.state || {
        historyData: [],
        currentFilter: "all",
        currentModalHistoryId: null
    };

    App.elements = App.elements || {};

    /* =====================================================
       HELPERS
    ===================================================== */

    function getState() {
        return App.state;
    }

    function getElements() {
        return App.elements;
    }

    function escapeHtml(value) {

        if (
            typeof App.escapeHtml ===
            "function"
        ) {
            return App.escapeHtml(value);
        }

        if (
            value === null ||
            value === undefined
        ) {
            return "";
        }

        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function normalizeStatus(status) {

        if (
            typeof App.normalizeStatus ===
            "function"
        ) {
            return App.normalizeStatus(status);
        }

        const value =
            String(status || "pending")
                .trim()
                .toLowerCase();

        if (value === "completed") {
            return "success";
        }

        if (value === "queued") {
            return "pending";
        }

        return value;
    }

    function getHistoryData() {

        if (
            typeof App.getHistoryData ===
            "function"
        ) {
            return App.getHistoryData();
        }

        return Array.isArray(
            getState().historyData
        )
            ? getState().historyData
            : [];
    }

    function getHistoryById(id) {

        const target =
            String(id || "").trim();

        if (!target) {
            return null;
        }

        if (
            typeof App.findHistoryById ===
            "function"
        ) {
            return App.findHistoryById(
                target
            );
        }

        return getHistoryData().find(
            item =>
                String(
                    item?.id || ""
                ).trim() === target
        ) || null;
    }

    /* =====================================================
       BASIC DATA
    ===================================================== */

    function getTaskId(item) {

        if (
            typeof App.getTaskId ===
            "function"
        ) {
            return App.getTaskId(item);
        }

        return String(
            item?.task_id ||
            item?.taskId ||
            ""
        ).trim();
    }

    function getModelId(item) {

        if (
            typeof App.getModelId ===
            "function"
        ) {
            return App.getModelId(item);
        }

        return String(
            item?.model_id ||
            item?.modelId ||
            ""
        ).trim();
    }

    function getModelName(item) {

        if (
            typeof App.getModelName ===
            "function"
        ) {
            return App.getModelName(item);
        }

        return String(
            item?.model_name ||
            item?.modelName ||
            item?.model ||
            ""
        ).trim();
    }

    function getProviderName(item) {

        if (
            typeof App.getProviderName ===
            "function"
        ) {
            return App.getProviderName(item);
        }

        return String(
            item?.provider_name ||
            item?.providerName ||
            item?.provider ||
            ""
        ).trim();
    }

    function getPrompt(item) {

        if (
            typeof App.getPrompt ===
            "function"
        ) {
            return App.getPrompt(item);
        }

        return String(
            item?.prompt ||
            ""
        ).trim();
    }

    function getCreditCost(item) {

        if (
            typeof App.getCreditCost ===
            "function"
        ) {
            return App.getCreditCost(item);
        }

        const value =
            Number(
                item?.credit_cost ??
                item?.credits_used ??
                item?.cost ??
                0
            );

        return Number.isFinite(value)
            ? value
            : 0;
    }

    function getErrorMessage(item) {

        if (
            typeof App.getErrorMessage ===
            "function"
        ) {
            return App.getErrorMessage(item);
        }

        return String(
            item?.error_message ||
            item?.error ||
            item?.message ||
            ""
        ).trim();
    }

    function getResultUrl(item) {

        if (
            typeof App.getResultUrl ===
            "function"
        ) {
            return App.getResultUrl(item);
        }

        return String(
            item?.result_url || ""
        ).trim();
    }

    function formatDate(value) {

        if (
            typeof App.formatDate ===
            "function"
        ) {
            return App.formatDate(value);
        }

        if (!value) {
            return "-";
        }

        const date =
            new Date(value);

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return "-";
        }

        return date.toLocaleString(
            "id-ID"
        );
    }

    function formatCredits(value) {

        if (
            typeof App.formatCredits ===
            "function"
        ) {
            return App.formatCredits(value);
        }

        const number =
            Number(value);

        if (
            !Number.isFinite(number)
        ) {
            return "0";
        }

        return number.toLocaleString(
            "id-ID"
        );
    }

    /* =====================================================
       STATUS
    ===================================================== */

    function getStatusLabel(status) {

        if (
            typeof App.getStatusLabel ===
            "function"
        ) {
            return App.getStatusLabel(
                status
            );
        }

        const normalized =
            normalizeStatus(status);

        switch (normalized) {

            case "success":
                return "SUCCESS";

            case "processing":
                return "PROCESSING";

            case "pending":
                return "PENDING";

            case "failed":
                return "GAGAL";

            case "cancelled":
                return "DIBATALKAN";

            default:
                return normalized
                    ? normalized.toUpperCase()
                    : "UNKNOWN";
        }
    }

    function getStatusClass(status) {

        if (
            typeof App.getStatusClass ===
            "function"
        ) {
            return App.getStatusClass(
                status
            );
        }

        const normalized =
            normalizeStatus(status);

        return (
            "status-" +
            normalized
        );
    }

    /* =====================================================
       FIELD
    ===================================================== */

    function renderField(
        label,
        value,
        className = ""
    ) {

        const safeValue =
            value === null ||
            value === undefined ||
            String(value).trim() === ""
                ? "-"
                : String(value);

        return `
            <div class="history-detail-field ${escapeHtml(className)}">

                <div class="history-detail-label">
                    ${escapeHtml(label)}
                </div>

                <div class="history-detail-value">
                    ${escapeHtml(safeValue)}
                </div>

            </div>
        `;
    }

    /* =====================================================
       PROMPT FIELD
    ===================================================== */

    function renderPrompt(item) {

        const prompt =
            getPrompt(item);

        return `
            <div class="history-detail-field history-detail-prompt">

                <div class="history-detail-label">
                    Prompt
                </div>

                <div class="history-detail-value history-detail-prompt-value">
                    ${
                        prompt
                            ? escapeHtml(prompt)
                            : "-"
                    }
                </div>

            </div>
        `;
    }

    /* =====================================================
       STATUS FIELD
    ===================================================== */

    function renderStatus(item) {

        const status =
            normalizeStatus(
                item?.status
            );

        const label =
            getStatusLabel(status);

        const className =
            getStatusClass(status);

        return `
            <div class="history-detail-field">

                <div class="history-detail-label">
                    Status
                </div>

                <div class="history-detail-value">

                    <span
                        class="history-status ${escapeHtml(className)}"
                    >
                        ${escapeHtml(label)}
                    </span>

                </div>

            </div>
        `;
    }

    /* =====================================================
       RESULT FIELD
    ===================================================== */

    function renderResult(item) {

        const url =
            getResultUrl(item);

        if (!url) {

            return `
                <div class="history-detail-field">

                    <div class="history-detail-label">
                        Result
                    </div>

                    <div class="history-detail-value">
                        -
                    </div>

                </div>
            `;
        }

        const safeUrl =
            escapeHtml(url);

        return `
            <div class="history-detail-field">

                <div class="history-detail-label">
                    Result
                </div>

                <div class="history-detail-result">

                    <a
                        href="${safeUrl}"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="history-result-link"
                    >
                        Buka hasil
                    </a>

                </div>

            </div>
        `;
    }

    /* =====================================================
       ERROR FIELD
    ===================================================== */

    function renderError(item) {

        const error =
            getErrorMessage(item);

        if (!error) {
            return "";
        }

        return `
            <div class="history-detail-error">

                <div class="history-detail-error-title">
                    Error
                </div>

                <div class="history-detail-error-message">
                    ${escapeHtml(error)}
                </div>

            </div>
        `;
    }

    /* =====================================================
       VIDEO PREVIEW
    ===================================================== */

    function renderVideoPreview(item) {

        const status =
            normalizeStatus(
                item?.status
            );

        const url =
            getResultUrl(item);

        if (
            status !== "success" ||
            !url
        ) {
            return "";
        }

        const safeUrl =
            escapeHtml(url);

        return `
            <div class="history-detail-video">

                <video
                    controls
                    playsinline
                    preload="metadata"
                    src="${safeUrl}"
                ></video>

            </div>
        `;
    }

    /* =====================================================
       MODAL BODY
    ===================================================== */

    function renderModalBody(item) {

        const elements =
            getElements();

        if (!elements.modalBody) {
            return;
        }

        if (!item) {

            elements.modalBody.innerHTML = `
                <div class="history-detail-empty">
                    Data history tidak ditemukan.
                </div>
            `;

            return;
        }

        const createdAt =
            item?.created_at ||
            item?.createdAt ||
            null;

        const completedAt =
            item?.completed_at ||
            item?.completedAt ||
            null;

        const taskId =
            getTaskId(item);

        const modelId =
            getModelId(item);

        const modelName =
            getModelName(item);

        const provider =
            getProviderName(item);

        const credits =
            getCreditCost(item);

        elements.modalBody.innerHTML = `

            <div class="history-detail-container">

                ${renderVideoPreview(item)}

                <div class="history-detail-grid">

                    ${renderStatus(item)}

                    ${renderField(
                        "Model",
                        modelName
                    )}

                    ${renderField(
                        "Model ID",
                        modelId
                    )}

                    ${renderField(
                        "Provider",
                        provider
                    )}

                    ${renderField(
                        "Task ID",
                        taskId
                    )}

                    ${renderField(
                        "Credit",
                        formatCredits(
                            credits
                        )
                    )}

                    ${renderField(
                        "Dibuat",
                        formatDate(
                            createdAt
                        )
                    )}

                    ${renderField(
                        "Selesai",
                        completedAt
                            ? formatDate(
                                completedAt
                            )
                            : "-"
                    )}

                </div>

                ${renderPrompt(item)}

                ${renderResult(item)}

                ${renderError(item)}

            </div>
        `;
    }

    /* =====================================================
       OPEN MODAL
    ===================================================== */

    function openDetailModal(id) {

        const elements =
            getElements();

        const targetId =
            String(id || "").trim();

        if (!targetId) {
            return;
        }

        const item =
            getHistoryById(targetId);

        if (!item) {

            console.warn(
                "History detail tidak ditemukan:",
                targetId
            );

            return;
        }

        getState().currentModalHistoryId =
            targetId;

        renderModalBody(item);

        if (!elements.detailModal) {
            return;
        }

        elements.detailModal.style.display =
            "flex";

        elements.detailModal.setAttribute(
            "aria-hidden",
            "false"
        );

        document.body.classList.add(
            "history-modal-open"
        );

        /*
         * Fokus ke tombol close jika tersedia.
         */
        if (elements.closeModal) {

            try {
                elements.closeModal.focus();
            } catch (error) {
                /* noop */
            }
        }
    }

    App.openDetailModal =
        openDetailModal;

    /* =====================================================
       CLOSE MODAL
    ===================================================== */

    function closeDetailModal() {

        const elements =
            getElements();

        if (!elements.detailModal) {
            return;
        }

        /*
         * Hentikan video yang sedang berjalan.
         */
        const videos =
            elements.detailModal
                .querySelectorAll(
                    "video"
                );

        videos.forEach(video => {

            try {

                video.pause();

                video.currentTime = 0;

            } catch (error) {
                /* noop */
            }
        });

        elements.detailModal.style.display =
            "none";

        elements.detailModal.setAttribute(
            "aria-hidden",
            "true"
        );

        document.body.classList.remove(
            "history-modal-open"
        );

        getState().currentModalHistoryId =
            null;
    }

    App.closeDetailModal =
        closeDetailModal;

    /* =====================================================
       TOGGLE MODAL
    ===================================================== */

    function toggleDetailModal(
        id
    ) {

        const elements =
            getElements();

        if (
            elements.detailModal &&
            elements.detailModal.style.display ===
                "flex"
        ) {

            closeDetailModal();

            return;
        }

        openDetailModal(id);
    }

    App.toggleDetailModal =
        toggleDetailModal;

    /* =====================================================
       REFRESH OPEN MODAL
    ===================================================== */

    function refreshOpenModal() {

        const state =
            getState();

        const id =
            state.currentModalHistoryId;

        if (!id) {
            return;
        }

        const item =
            getHistoryById(id);

        if (!item) {

            closeDetailModal();

            return;
        }

        renderModalBody(item);
    }

    App.refreshOpenModal =
        refreshOpenModal;

    /* =====================================================
       GLOBAL COMPATIBILITY
       -----------------------------------------------------
       Dipertahankan untuk HTML lama yang mungkin masih
       menggunakan onclick="openDetailModal(...)"
       atau nama fungsi global sejenis.
    ===================================================== */

    window.openHistoryDetail =
        openDetailModal;

    window.closeHistoryDetail =
        closeDetailModal;

})();
