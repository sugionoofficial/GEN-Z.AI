/* =========================================================
   GEN-Z.AI
   HISTORY RENDER MODULE
   ---------------------------------------------------------
   File:
   history/assets/js/history-render.js

   Tanggung jawab:
   - Render history table
   - Render thumbnail
   - Render status
   - Render count
   - Render empty/loading state
   - Escape HTML
   - Format tanggal
   - Video thumbnail interaction helper

   Tidak bertanggung jawab:
   - Query Supabase
   - Authentication
   - Polling backend
   - Modal
   - Event listener utama
========================================================= */

(function () {
    "use strict";

    window.GENZHistory = window.GENZHistory || {};

    const App = window.GENZHistory;

    App.state = App.state || {
        historyData: [],
        currentFilter: "all"
    };

    App.elements = App.elements || {};

    /* =====================================================
       BASIC HELPERS
    ===================================================== */

    function getState() {
        return App.state;
    }

    function getElements() {
        return App.elements;
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

    /* =====================================================
       ESCAPE HTML
    ===================================================== */

    function escapeHtml(value) {

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

    App.escapeHtml = escapeHtml;

    /* =====================================================
       FORMAT DATE
    ===================================================== */

    function formatDate(value) {

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

        try {

            return new Intl.DateTimeFormat(
                "id-ID",
                {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit"
                }
            ).format(date);

        } catch (error) {

            return date.toLocaleString(
                "id-ID"
            );
        }
    }

    App.formatDate = formatDate;

    /* =====================================================
       FORMAT CREDITS
    ===================================================== */

    function formatCredits(value) {

        const number =
            Number(value);

        if (
            !Number.isFinite(number)
        ) {
            return "0";
        }

        if (
            Number.isInteger(number)
        ) {
            return number.toLocaleString(
                "id-ID"
            );
        }

        return number.toLocaleString(
            "id-ID",
            {
                maximumFractionDigits: 4
            }
        );
    }

    App.formatCredits =
        formatCredits;

    /* =====================================================
       RESULT URL
    ===================================================== */

    function getResultUrl(item) {

        if (
            typeof App.getResultUrl ===
            "function"
        ) {
            return App.getResultUrl(item);
        }

        if (!item) {
            return "";
        }

        const value =
            String(
                item.result_url || ""
            ).trim();

        if (!value) {
            return "";
        }

        const lower =
            value.toLowerCase();

        if (
            lower.startsWith(
                "javascript:"
            ) ||
            lower.startsWith(
                "data:text/html"
            )
        ) {
            return "";
        }

        return value;
    }

    /* =====================================================
       DATA ACCESS
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

    /* =====================================================
       STATUS LABEL
    ===================================================== */

    function getStatusLabel(status) {

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

    App.getStatusLabel =
        getStatusLabel;

    /* =====================================================
       STATUS CLASS
    ===================================================== */

    function getStatusClass(status) {

        const normalized =
            normalizeStatus(status);

        switch (normalized) {

            case "success":
                return "status-success";

            case "processing":
                return "status-processing";

            case "pending":
                return "status-pending";

            case "failed":
                return "status-failed";

            case "cancelled":
                return "status-cancelled";

            default:
                return "status-unknown";
        }
    }

    App.getStatusClass =
        getStatusClass;

    /* =====================================================
       PROCESSING THUMBNAIL
    ===================================================== */

    function getProcessingThumbnailHtml() {

        return `
            <div class="history-thumbnail thumbnail-processing">
                <div class="thumbnail-loader"></div>
                <span class="thumbnail-processing-text">
                    GENERATING
                </span>
            </div>
        `;
    }

    /* =====================================================
       SUCCESS THUMBNAIL
    ===================================================== */

    function getSuccessThumbnailHtml(item) {

        const url =
            getResultUrl(item);

        if (!url) {

            return `
                <div class="history-thumbnail thumbnail-empty">
                    <span class="thumbnail-empty-icon">🎬</span>
                </div>
            `;
        }

        const safeUrl =
            escapeHtml(url);

        const taskId =
            escapeHtml(
                getTaskId(item)
            );

        return `
            <div
                class="history-thumbnail video-ready"
                data-video-url="${safeUrl}"
                data-task-id="${taskId}"
                role="button"
                tabindex="0"
                aria-label="Putar hasil video"
            >
                <video
                    src="${safeUrl}"
                    muted
                    playsinline
                    preload="metadata"
                ></video>

                <span class="thumbnail-play">
                    ▶
                </span>

                <span class="thumbnail-success">
                    SUCCESS
                </span>
            </div>
        `;
    }

    /* =====================================================
       FAILED THUMBNAIL
    ===================================================== */

    function getFailedThumbnailHtml(item) {

        const url =
            getResultUrl(item);

        if (!url) {

            return `
                <div class="history-thumbnail thumbnail-failed">
                    <span class="thumbnail-failed-icon">
                        !
                    </span>
                </div>
            `;
        }

        const safeUrl =
            escapeHtml(url);

        return `
            <div
                class="history-thumbnail video-ready thumbnail-failed"
                data-video-url="${safeUrl}"
                role="button"
                tabindex="0"
                aria-label="Lihat hasil generation"
            >
                <video
                    src="${safeUrl}"
                    muted
                    playsinline
                    preload="metadata"
                ></video>

                <span class="thumbnail-play">
                    ▶
                </span>

                <span class="thumbnail-failed-label">
                    GAGAL
                </span>
            </div>
        `;
    }

    /* =====================================================
       EMPTY / OTHER THUMBNAIL
    ===================================================== */

    function getEmptyThumbnailHtml(status) {

        const normalized =
            normalizeStatus(status);

        let icon = "🎬";
        let label = "";

        if (
            normalized === "cancelled"
        ) {
            icon = "×";
            label = "DIBATALKAN";
        } else if (
            normalized === "pending"
        ) {
            icon = "◷";
            label = "PENDING";
        } else {
            icon = "•";
            label = "";
        }

        return `
            <div class="history-thumbnail thumbnail-empty">
                <span class="thumbnail-empty-icon">
                    ${escapeHtml(icon)}
                </span>

                ${
                    label
                        ? `
                            <span class="thumbnail-empty-label">
                                ${escapeHtml(label)}
                            </span>
                        `
                        : ""
                }
            </div>
        `;
    }

    /* =====================================================
       MAIN THUMBNAIL SELECTOR
    ===================================================== */

    function getThumbnailHtml(item) {

        const status =
            normalizeStatus(
                item?.status
            );

        switch (status) {

            case "processing":
            case "pending":
                return getProcessingThumbnailHtml();

            case "success":
                return getSuccessThumbnailHtml(
                    item
                );

            case "failed":
                return getFailedThumbnailHtml(
                    item
                );

            default:
                return getEmptyThumbnailHtml(
                    status
                );
        }
    }

    App.getProcessingThumbnailHtml =
        getProcessingThumbnailHtml;

    App.getSuccessThumbnailHtml =
        getSuccessThumbnailHtml;

    App.getFailedThumbnailHtml =
        getFailedThumbnailHtml;

    App.getEmptyThumbnailHtml =
        getEmptyThumbnailHtml;

    App.getThumbnailHtml =
        getThumbnailHtml;

    /* =====================================================
       FILTERED DATA
    ===================================================== */

    function getFilteredData() {

        if (
            typeof App.getFilteredHistory ===
            "function"
        ) {
            return App.getFilteredHistory();
        }

        const data =
            getHistoryData();

        const filter =
            getState().currentFilter ||
            "all";

        if (filter === "all") {
            return data;
        }

        return data.filter(item => {

            return (
                normalizeStatus(
                    item?.status
                ) === filter
            );
        });
    }

    /* =====================================================
       USER DISPLAY
    ===================================================== */

    function getUserDisplay(item) {

        const email =
            item?.user_email ||
            item?.email ||
            "";

        const name =
            item?.user_name ||
            item?.name ||
            "";

        if (name && email) {

            return `
                <div class="history-user">
                    <strong>
                        ${escapeHtml(name)}
                    </strong>
                    <span>
                        ${escapeHtml(email)}
                    </span>
                </div>
            `;
        }

        if (email) {

            return `
                <div class="history-user">
                    <span>
                        ${escapeHtml(email)}
                    </span>
                </div>
            `;
        }

        if (name) {

            return `
                <div class="history-user">
                    <strong>
                        ${escapeHtml(name)}
                    </strong>
                </div>
            `;
        }

        const userId =
            String(
                item?.user_id || ""
            ).trim();

        return `
            <div class="history-user">
                <span>
                    ${escapeHtml(
                        userId || "-"
                    )}
                </span>
            </div>
        `;
    }

    /* =====================================================
       MODEL DISPLAY
    ===================================================== */

    function getModelDisplay(item) {

        const modelName =
            getModelName(item);

        const modelId =
            getModelId(item);

        const provider =
            getProviderName(item);

        return `
            <div class="history-model">

                <strong>
                    ${escapeHtml(
                        modelName || "-"
                    )}
                </strong>

                ${
                    modelId
                        ? `
                            <span class="history-model-id">
                                ${escapeHtml(
                                    modelId
                                )}
                            </span>
                        `
                        : ""
                }

                ${
                    provider
                        ? `
                            <span class="history-provider">
                                ${escapeHtml(
                                    provider
                                )}
                            </span>
                        `
                        : ""
                }

            </div>
        `;
    }

    /* =====================================================
       PROMPT DISPLAY
    ===================================================== */

    function getPromptDisplay(item) {

        const prompt =
            getPrompt(item);

        if (!prompt) {
            return "-";
        }

        return `
            <div
                class="history-prompt"
                title="${escapeHtml(prompt)}"
            >
                ${escapeHtml(prompt)}
            </div>
        `;
    }

    /* =====================================================
       STATUS DISPLAY
    ===================================================== */

    function getStatusDisplay(item) {

        const status =
            normalizeStatus(
                item?.status
            );

        const label =
            getStatusLabel(status);

        const className =
            getStatusClass(status);

        return `
            <span
                class="history-status ${className}"
                data-status="${escapeHtml(
                    status
                )}"
            >
                ${escapeHtml(label)}
            </span>
        `;
    }

    /* =====================================================
       CREDIT DISPLAY
    ===================================================== */

    function getCreditDisplay(item) {

        const credits =
            getCreditCost(item);

        return `
            <span class="history-credit">
                ${escapeHtml(
                    formatCredits(credits)
                )}
            </span>
        `;
    }

    /* =====================================================
       ROW HTML
    ===================================================== */

    function getRowHtml(
        item,
        index,
        showUserColumn
    ) {

        const id =
            String(
                item?.id || ""
            ).trim();

        const taskId =
            getTaskId(item);

        const createdAt =
            item?.created_at ||
            item?.createdAt ||
            null;

        const safeId =
            escapeHtml(id);

        const safeTaskId =
            escapeHtml(taskId);

        return `
            <tr
                data-history-id="${safeId}"
                data-task-id="${safeTaskId}"
            >

                <td class="history-number">
                    ${index + 1}
                </td>

                ${
                    showUserColumn
                        ? `
                            <td class="history-user-cell">
                                ${getUserDisplay(item)}
                            </td>
                        `
                        : ""
                }

                <td class="history-thumbnail-cell">
                    ${getThumbnailHtml(item)}
                </td>

                <td class="history-model-cell">
                    ${getModelDisplay(item)}
                </td>

                <td class="history-prompt-cell">
                    ${getPromptDisplay(item)}
                </td>

                <td class="history-credit-cell">
                    ${getCreditDisplay(item)}
                </td>

                <td class="history-status-cell">
                    ${getStatusDisplay(item)}
                </td>

                <td class="history-date-cell">
                    ${escapeHtml(
                        formatDate(createdAt)
                    )}
                </td>

                <td class="history-action-cell">

                    <button
                        type="button"
                        class="history-detail-button"
                        data-action="detail"
                        data-history-id="${safeId}"
                        title="Lihat detail"
                    >
                        Detail
                    </button>

                </td>

            </tr>
        `;
    }

    /* =====================================================
       RENDER EMPTY STATE
    ===================================================== */

    function renderEmptyState() {

        const elements =
            getElements();

        if (!elements.emptyState) {
            return;
        }

        elements.emptyState.style.display =
            "block";

        if (elements.tableWrap) {
            elements.tableWrap.style.display =
                "none";
        }

        if (elements.loadingState) {
            elements.loadingState.style.display =
                "none";
        }
    }

    /* =====================================================
       RENDER TABLE
    ===================================================== */

    function renderTable(data) {

        const elements =
            getElements();

        if (!elements.historyBody) {
            return;
        }

        const showUserColumn =
            typeof App.isAdminOrOwner ===
            "function"
                ? App.isAdminOrOwner()
                : false;

        elements.historyBody.innerHTML =
            data.map(
                (item, index) =>
                    getRowHtml(
                        item,
                        index,
                        showUserColumn
                    )
            ).join("");

        if (elements.tableWrap) {
            elements.tableWrap.style.display =
                data.length
                    ? "block"
                    : "none";
        }

        if (elements.emptyState) {
            elements.emptyState.style.display =
                data.length
                    ? "none"
                    : "block";
        }

        if (elements.loadingState) {
            elements.loadingState.style.display =
                "none";
        }
    }

    /* =====================================================
       UPDATE USER COLUMN
    ===================================================== */

    function updateUserColumn() {

        const elements =
            getElements();

        if (!elements.userColumnHeader) {
            return;
        }

        const visible =
            typeof App.isAdminOrOwner ===
            "function"
                ? App.isAdminOrOwner()
                : false;

        elements.userColumnHeader.style.display =
            visible
                ? ""
                : "none";
    }

    /* =====================================================
       HISTORY COUNT
    ===================================================== */

    function updateHistoryCount(
        totalCount,
        filteredCount
    ) {

        const elements =
            getElements();

        if (!elements.historyCount) {
            return;
        }

        const total =
            Number(totalCount) || 0;

        const filtered =
            Number(filteredCount) || 0;

        if (
            total !== filtered
        ) {

            elements.historyCount.textContent =
                `${filtered} / ${total}`;

        } else {

            elements.historyCount.textContent =
                String(total);
        }
    }

    /* =====================================================
       SUBTITLE
    ===================================================== */

    function updateSubtitle() {

        const elements =
            getElements();

        if (!elements.historySubtitle) {
            return;
        }

        const filter =
            getState().currentFilter ||
            "all";

        const labels = {
            all: "Semua generation",
            success: "Generation berhasil",
            processing: "Generation sedang diproses",
            pending: "Generation menunggu proses",
            failed: "Generation gagal",
            cancelled: "Generation dibatalkan"
        };

        elements.historySubtitle.textContent =
            labels[filter] ||
            labels.all;
    }

    /* =====================================================
       MAIN RENDER
    ===================================================== */

    function renderHistory() {

        const elements =
            getElements();

        if (!elements.historyBody) {
            console.warn(
                "History render skipped: " +
                "#historyBody tidak ditemukan."
            );

            return;
        }

        const allData =
            getHistoryData();

        const filteredData =
            getFilteredData();

        updateUserColumn();

        updateHistoryCount(
            allData.length,
            filteredData.length
        );

        updateSubtitle();

        if (!filteredData.length) {
            renderEmptyState();
            return;
        }

        renderTable(
            filteredData
        );
    }

    App.renderHistory =
        renderHistory;

    /* =====================================================
       RENDER LOADING
    ===================================================== */

    function renderLoading() {

        const elements =
            getElements();

        if (elements.loadingState) {
            elements.loadingState.style.display =
                "block";
        }

        if (elements.tableWrap) {
            elements.tableWrap.style.display =
                "none";
        }

        if (elements.emptyState) {
            elements.emptyState.style.display =
                "none";
        }
    }

    App.renderLoading =
        renderLoading;

    /* =====================================================
       RENDER ERROR
    ===================================================== */

    function renderError() {

        const elements =
            getElements();

        if (elements.loadingState) {
            elements.loadingState.style.display =
                "none";
        }

        if (elements.tableWrap) {
            elements.tableWrap.style.display =
                "none";
        }

        if (elements.emptyState) {
            elements.emptyState.style.display =
                "none";
        }
    }

    App.renderError =
        renderError;

    /* =====================================================
       VIDEO PREVIEW HELPER
    ===================================================== */

    function preloadThumbnailVideos() {

        const elements =
            getElements();

        if (!elements.historyBody) {
            return;
        }

        const videos =
            elements.historyBody
                .querySelectorAll(
                    ".history-thumbnail video"
                );

        videos.forEach(video => {

            try {
                video.load();
            } catch (error) {
                console.warn(
                    "Video thumbnail preload failed:",
                    error
                );
            }
        });
    }

    App.preloadThumbnailVideos =
        preloadThumbnailVideos;

    /* =====================================================
       REFRESH RENDER ONLY
    ===================================================== */

    function refreshRender() {

        renderHistory();

        /*
         * Jalankan setelah browser selesai
         * memasukkan HTML ke DOM.
         */
        if (
            typeof requestAnimationFrame ===
            "function"
        ) {

            requestAnimationFrame(
                preloadThumbnailVideos
            );

        } else {

            preloadThumbnailVideos();
        }
    }

    App.refreshRender =
        refreshRender;

})();
