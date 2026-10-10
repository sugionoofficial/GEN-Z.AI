/* 
=========================================================
   GEN-Z.AI
   HISTORY RENDER MODULE
   ---------------------------------------------------------
   File:
   history/assets/js/history-render.js

   PATCH v3 (2026-10-10):
   - Deteksi image vs video untuk thumbnail.
   - Thumbnail image pakai struktur <img> dengan class
     thumbnail-media yang CSS-nya diatur di index.html.
   - Tidak ada play button untuk image.
========================================================= */

(function () {

    "use strict";

    window.GENZHistory =
        window.GENZHistory || {};

    const App =
        window.GENZHistory;


    /* =====================================================
       STATE
    ===================================================== */

    App.state =
        App.state || {};

    if (
        !Array.isArray(
            App.state.historyData
        )
    ) {
        App.state.historyData = [];
    }

    if (
        typeof App.state.currentFilter !==
        "string"
    ) {
        App.state.currentFilter = "all";
    }


    /* =====================================================
       ELEMENTS
    ===================================================== */

    App.elements =
        App.elements || {};


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

            const result =
                App.getHistoryData();

            if (
                Array.isArray(result)
            ) {
                return result;
            }
        }

        return Array.isArray(
            getState().historyData
        )
            ? getState().historyData
            : [];
    }


    function normalizeStatus(
        status
    ) {

        if (
            typeof App.normalizeStatus ===
            "function"
        ) {
            return App.normalizeStatus(
                status
            );
        }

        const value =
            String(
                status || "pending"
            )
                .trim()
                .toLowerCase();

        if (
            value === "completed"
        ) {
            return "success";
        }

        if (
            value === "queued"
        ) {
            return "pending";
        }

        return value;
    }


    /* =====================================================
       ESCAPE HTML
    ===================================================== */

    function escapeHtml(
        value
    ) {

        if (
            value === null ||
            value === undefined
        ) {
            return "";
        }

        return String(value)
            .replace(
                /&/g,
                "&amp;"
            )
            .replace(
                /</g,
                "&lt;"
            )
            .replace(
                />/g,
                "&gt;"
            )
            .replace(
                /"/g,
                "&quot;"
            )
            .replace(
                /'/g,
                "&#039;"
            );
    }

    App.escapeHtml =
        escapeHtml;


    /* =====================================================
       FORMAT DATE
    ===================================================== */

    function formatDate(
        value
    ) {

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

    App.formatDate =
        formatDate;


    /* =====================================================
       FORMAT CREDIT
    ===================================================== */

    function formatCredits(
        value
    ) {

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

    function getResultUrl(
        item
    ) {

        if (
            typeof App.getResultUrl ===
            "function"
        ) {
            return App.getResultUrl(
                item
            );
        }

        if (!item) {
            return "";
        }

        const value =
            String(
                item.result_url ||
                ""
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
       MEDIA TYPE DETECTION
    ===================================================== */

    const IMAGE_EXTENSIONS = [
        "jpg",
        "jpeg",
        "png",
        "webp",
        "gif",
        "bmp",
        "svg",
        "avif"
    ];

    function isImageResultUrl(url) {

        if (!url) {
            return false;
        }

        const clean =
            String(url)
                .split("?")[0]
                .split("#")[0]
                .toLowerCase();

        const dot =
            clean.lastIndexOf(".");

        if (dot === -1) {
            return false;
        }

        const ext =
            clean.slice(dot + 1);

        return (
            IMAGE_EXTENSIONS.indexOf(
                ext
            ) !== -1
        );
    }


    /* =====================================================
       DATA ACCESS
    ===================================================== */

    function getTaskId(
        item
    ) {

        if (
            typeof App.getTaskId ===
            "function"
        ) {
            return App.getTaskId(
                item
            );
        }

        return String(
            item?.task_id ||
            item?.taskId ||
            ""
        ).trim();
    }


    function getModelId(
        item
    ) {

        if (
            typeof App.getModelId ===
            "function"
        ) {
            return App.getModelId(
                item
            );
        }

        return String(
            item?.model_id ||
            item?.modelId ||
            ""
        ).trim();
    }


    function getModelName(
        item
    ) {

        if (
            typeof App.getModelName ===
            "function"
        ) {
            return App.getModelName(
                item
            );
        }

        return String(
            item?.model_name ||
            item?.modelName ||
            item?.model ||
            ""
        ).trim();
    }


    function getProviderName(
        item
    ) {

        if (
            typeof App.getProviderName ===
            "function"
        ) {
            return App.getProviderName(
                item
            );
        }

        return String(
            item?.provider_name ||
            item?.providerName ||
            item?.provider ||
            ""
        ).trim();
    }


    function getPrompt(
        item
    ) {

        if (
            typeof App.getPrompt ===
            "function"
        ) {
            return App.getPrompt(
                item
            );
        }

        return String(
            item?.prompt ||
            item?.input_prompt ||
            item?.description ||
            ""
        ).trim();
    }


    function getCreditCost(
        item
    ) {

        if (
            typeof App.getCreditCost ===
            "function"
        ) {
            return App.getCreditCost(
                item
            );
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


    function getErrorMessage(
        item
    ) {

        if (
            typeof App.getErrorMessage ===
            "function"
        ) {
            return App.getErrorMessage(
                item
            );
        }

        return String(
            item?.error_message ||
            item?.error ||
            item?.message ||
            ""
        ).trim();
    }


    /* =====================================================
       STATUS
    ===================================================== */

    function getStatusLabel(
        status
    ) {

        const normalized =
            normalizeStatus(
                status
            );

        switch (
            normalized
        ) {

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


    function getStatusClass(
        status
    ) {

        const normalized =
            normalizeStatus(
                status
            );

        switch (
            normalized
        ) {

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
       THUMBNAIL
    ===================================================== */

    function getProcessingThumbnailHtml() {

        return `
            <div
                class="history-thumbnail thumbnail-processing"
                aria-label="Generation sedang diproses"
            >

                <div class="thumbnail-loader"></div>

                <span class="thumbnail-processing-label">
                    GENERATING
                </span>

            </div>
        `;
    }


    function getSuccessThumbnailHtml(
        item
    ) {

        const url =
            getResultUrl(
                item
            );

        if (!url) {

            return `
                <div
                    class="history-thumbnail thumbnail-empty"
                    aria-label="Hasil belum tersedia"
                >
                    <span class="thumbnail-empty-icon">
                        🎬
                    </span>
                </div>
            `;
        }

        const safeUrl =
            escapeHtml(
                url
            );

        const taskId =
            escapeHtml(
                getTaskId(
                    item
                )
            );

        /* =================================================
           IMAGE RESULT
           -------------------------------------------------
           Thumbnail image pakai <img> dengan class
           thumbnail-media. CSS di index.html yang atur
           object-fit: contain supaya tidak zoom.
        ================================================= */

        if (isImageResultUrl(url)) {

            return `
                <div
                    class="history-thumbnail thumbnail-image-success"
                    role="button"
                    tabindex="0"
                    aria-label="Lihat hasil gambar"
                >

                    <img
                        src="${safeUrl}"
                        alt="Hasil"
                        class="thumbnail-media"
                    >

                    <span class="thumbnail-success">
                        SUCCESS
                    </span>

                </div>
            `;
        }

        /* =================================================
           VIDEO RESULT
        ================================================= */

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
                    preload="none"
                    class="thumbnail-media"
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


    function getFailedThumbnailHtml(
        item
    ) {

        const url =
            getResultUrl(
                item
            );

        if (!url) {

            return `
                <div
                    class="history-thumbnail thumbnail-failed"
                    aria-label="Generation gagal"
                >
                    <span class="thumbnail-failed-icon">
                        !
                    </span>
                </div>
            `;
        }

        const safeUrl =
            escapeHtml(
                url
            );

        const taskId =
            escapeHtml(
                getTaskId(
                    item
                )
            );

        return `
            <div
                class="history-thumbnail video-ready thumbnail-failed"
                data-video-url="${safeUrl}"
                data-task-id="${taskId}"
                role="button"
                tabindex="0"
                aria-label="Lihat hasil generation"
            >

                <video
                    src="${safeUrl}"
                    muted
                    playsinline
                    preload="metadata"
                    class="thumbnail-media"
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


    function getEmptyThumbnailHtml(
        status
    ) {

        const normalized =
            normalizeStatus(
                status
            );

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


    function getThumbnailHtml(
        item
    ) {

        const status =
            normalizeStatus(
                item?.status
            );

        switch (
            status
        ) {

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

    App.isImageResultUrl =
        isImageResultUrl;


    /* =====================================================
       FILTER
    ===================================================== */

    function normalizeFilter(
        filter
    ) {

        const value =
            String(
                filter || "all"
            )
                .trim()
                .toLowerCase();

        const allowed = [
            "all",
            "success",
            "processing",
            "pending",
            "failed",
            "cancelled"
        ];

        return allowed.includes(
            value
        )
            ? value
            : "all";
    }


    function getFilteredData() {

        if (
            typeof App.getFilteredHistory ===
            "function"
        ) {

            const result =
                App.getFilteredHistory();

            if (
                Array.isArray(result)
            ) {
                return result;
            }
        }

        const data =
            getHistoryData();

        const filter =
            normalizeFilter(
                getState().currentFilter
            );

        if (
            filter === "all"
        ) {
            return data;
        }

        return data.filter(
            function (item) {

                return (
                    normalizeStatus(
                        item?.status
                    ) === filter
                );

            }
        );
    }


    /* =====================================================
       USER
    ===================================================== */

    function getUserDisplay(
        item
    ) {

        const email =
            item?.user_email ||
            item?.email ||
            "";

        const name =
            item?.user_name ||
            item?.name ||
            "";

        if (
            name &&
            email
        ) {

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
                item?.user_id ||
                ""
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
       PROVIDER
    ===================================================== */

    function getProviderDisplay(
        item
    ) {

        const provider =
            getProviderName(
                item
            );

        return `
            <div
                class="history-provider-cell-content"
                title="${escapeHtml(provider)}"
            >
                ${
                    provider
                        ? escapeHtml(
                            provider
                        )
                        : "-"
                }
            </div>
        `;
    }


    /* =====================================================
       MODEL
    ===================================================== */

    function getModelDisplay(
        item
    ) {

        const modelName =
            getModelName(
                item
            );

        const modelId =
            getModelId(
                item
            );

        return `
            <div
                class="history-model"
                title="${escapeHtml(
                    modelName || modelId
                )}"
            >

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

            </div>
        `;
    }


    /* =====================================================
       PROMPT DISPLAY
    ===================================================== */

    function getPromptDisplay(
        item
    ) {

        const prompt =
            getPrompt(
                item
            );

        if (!prompt) {

            return `
                <div class="history-prompt-wrap">

                    <span
                        class="history-prompt-empty"
                        title="-"
                    >
                        -
                    </span>

                </div>
            `;
        }


        const safePrompt =
            escapeHtml(
                prompt
            );


        const historyId =
            String(
                item?.id ||
                ""
            ).trim();


        const safeHistoryId =
            escapeHtml(
                historyId
            );


        return `
            <div
                class="history-prompt-wrap"
            >

                <button
                    type="button"
                    class="history-prompt"
                    data-action="prompt"
                    data-history-id="${safeHistoryId}"
                    title="Klik untuk melihat prompt lengkap"
                    aria-label="Lihat prompt lengkap"
                >

                    <span
                        class="history-prompt-text"
                        title="${safePrompt}"
                    >${safePrompt}</span>

                </button>


                <button
                    type="button"
                    class="history-prompt-copy"
                    data-action="copy-prompt"
                    data-history-id="${safeHistoryId}"
                    title="Copy prompt"
                    aria-label="Copy prompt"
                >
                    COPY
                </button>

            </div>
        `;
    }


    App.getPromptDisplay =
        getPromptDisplay;


    /* =====================================================
       COPY PROMPT
    ===================================================== */

    function findHistoryItem(
        historyId
    ) {

        const id =
            String(
                historyId || ""
            ).trim();

        if (!id) {
            return null;
        }


        const data =
            getHistoryData();


        return (
            data.find(
                function (item) {

                    return (
                        String(
                            item?.id ||
                            ""
                        ).trim() === id
                    );

                }
            ) ||
            null
        );

    }


    async function copyPrompt(
        historyId,
        button
    ) {

        const item =
            findHistoryItem(
                historyId
            );


        if (!item) {

            console.warn(
                "[GEN-Z.AI History] " +
                "Project history tidak ditemukan:",
                historyId
            );

            return;

        }


        const prompt =
            getPrompt(
                item
            );


        if (!prompt) {

            return;

        }


        const value =
            String(
                prompt
            );


        try {

            if (
                navigator.clipboard &&
                typeof navigator.clipboard.writeText ===
                    "function"
            ) {

                await navigator.clipboard.writeText(
                    value
                );

            } else {

                const textarea =
                    document.createElement(
                        "textarea"
                    );


                textarea.value =
                    value;


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


                document.body.appendChild(
                    textarea
                );


                textarea.focus();
                textarea.select();


                const copied =
                    document.execCommand(
                        "copy"
                    );


                textarea.remove();


                if (!copied) {

                    throw new Error(
                        "Clipboard fallback gagal."
                    );

                }

            }


            if (button) {

                const originalText =
                    button.textContent;


                button.textContent =
                    "COPIED";


                button.classList.add(
                    "copied"
                );


                window.setTimeout(
                    function () {

                        if (
                            button.isConnected
                        ) {

                            button.textContent =
                                originalText;

                            button.classList.remove(
                                "copied"
                            );

                        }

                    },
                    1200
                );

            }

        } catch (error) {

            console.error(
                "[GEN-Z.AI History] Copy prompt gagal:",
                error
            );

        }

    }


    App.copyHistoryPrompt =
        copyPrompt;


    /* =====================================================
       STATUS DISPLAY
    ===================================================== */

    function getStatusDisplay(
        item
    ) {

        const status =
            normalizeStatus(
                item?.status
            );

        const label =
            getStatusLabel(
                status
            );


        const statusBadge = `
            <span
                class="status ${escapeHtml(
                    status
                )}"
                data-status="${escapeHtml(
                    status
                )}"
            >
                ${escapeHtml(
                    label
                )}
            </span>
        `;


        const isActive =
            status === "processing" ||
            status === "pending";


        if (!isActive) {

            return statusBadge;

        }


        const createdAt =
            item?.created_at ||
            item?.createdAt ||
            "";


        if (!createdAt) {

            return statusBadge;

        }


        const runtimeBadge = `
            <span
                class="runtime-badge"
                data-runtime-created-at="${escapeHtml(
                    String(createdAt)
                )}"
                title="Waktu berjalan sejak dibuat"
            >--:--</span>
        `;


        return `
            <div class="history-status-wrap">
                ${statusBadge}
                ${runtimeBadge}
            </div>
        `;

    }


    /* =====================================================
       CREDIT
    ===================================================== */

    function getCreditDisplay(
        item
    ) {

        const credits =
            getCreditCost(
                item
            );

        return `
            <span class="history-credit">
                ${escapeHtml(
                    formatCredits(
                        credits
                    )
                )}
            </span>
        `;
    }


    /* =====================================================
       ROW
    ===================================================== */

    function getRowHtml(
        item,
        index,
        showUserColumn
    ) {

        const id =
            String(
                item?.id ||
                ""
            ).trim();

        const taskId =
            getTaskId(
                item
            );

        const createdAt =
            item?.created_at ||
            item?.createdAt ||
            null;

        const safeId =
            escapeHtml(
                id
            );

        const safeTaskId =
            escapeHtml(
                taskId
            );

        return `
            <tr
                data-history-id="${safeId}"
                data-task-id="${safeTaskId}"
            >

                <!-- PREVIEW -->

                <td class="history-thumbnail-cell">
                    ${getThumbnailHtml(
                        item
                    )}
                </td>


                <!-- TANGGAL -->

                <td class="history-date-cell">
                    ${escapeHtml(
                        formatDate(
                            createdAt
                        )
                    )}
                </td>


                <!-- USER -->

                ${
                    showUserColumn
                        ? `
                            <td class="history-user-cell">
                                ${getUserDisplay(
                                    item
                                )}
                            </td>
                        `
                        : ""
                }


                <!-- PROVIDER -->

                <td class="history-provider-cell">
                    ${getProviderDisplay(
                        item
                    )}
                </td>


                <!-- MODEL -->

                <td class="history-model-cell">
                    ${getModelDisplay(
                        item
                    )}
                </td>


                <!-- PROMPT -->

                <td class="history-prompt-cell">
                    ${getPromptDisplay(
                        item
                    )}
                </td>


                <!-- CREDIT -->

                <td class="history-credit-cell">
                    ${getCreditDisplay(
                        item
                    )}
                </td>


                <!-- STATUS -->

                <td class="history-status-cell">
                    ${getStatusDisplay(
                        item
                    )}
                </td>


                <!-- ACTION -->

                <td class="history-action-cell">

                    <button
                        type="button"
                        class="history-detail-button"
                        data-action="detail"
                        data-history-id="${safeId}"
                        title="Lihat detail generation"
                    >
                        Detail
                    </button>

                </td>

            </tr>
        `;
    }


    /* =====================================================
       EMPTY
    ===================================================== */

    function renderEmptyState() {

        const elements =
            getElements();

        if (
            !elements.emptyState
        ) {
            return;
        }

        elements.emptyState.style.display =
            "block";

        if (
            elements.tableWrap
        ) {
            elements.tableWrap.style.display =
                "none";
        }

        if (
            elements.loadingState
        ) {
            elements.loadingState.style.display =
                "none";
        }
    }


    /* =====================================================
       TABLE
    ===================================================== */

    function renderTable(
        data
    ) {

        const elements =
            getElements();

        if (
            !elements.historyBody
        ) {
            return;
        }

        const showUserColumn =
            typeof App.isAdminOrOwner ===
            "function"

                ? App.isAdminOrOwner()

                : false;


        elements.historyBody.innerHTML =
            data
                .map(
                    function (
                        item,
                        index
                    ) {

                        return getRowHtml(
                            item,
                            index,
                            showUserColumn
                        );

                    }
                )
                .join("");


        if (
            elements.tableWrap
        ) {

            elements.tableWrap.style.display =
                data.length
                    ? "block"
                    : "none";

        }


        if (
            elements.emptyState
        ) {

            elements.emptyState.style.display =
                data.length
                    ? "none"
                    : "block";

        }


        if (
            elements.loadingState
        ) {

            elements.loadingState.style.display =
                "none";

        }


        if (
            typeof App.startRuntimeCounter ===
            "function"
        ) {

            App.startRuntimeCounter();

        }

    }


    /* =====================================================
       USER COLUMN
    ===================================================== */

    function updateUserColumn() {

        const elements =
            getElements();

        if (
            !elements.userColumnHeader
        ) {
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
       COUNT
    ===================================================== */

    function updateHistoryCount(
        totalCount,
        filteredCount
    ) {

        const elements =
            getElements();

        if (
            !elements.historyCount
        ) {
            return;
        }

        const total =
            Number(
                totalCount
            ) || 0;

        const filtered =
            Number(
                filteredCount
            ) || 0;


        elements.historyCount.textContent =
            total !== filtered
                ? `${filtered} / ${total}`
                : String(total);
    }


    /* =====================================================
       SUBTITLE
    ===================================================== */

    function updateSubtitle() {

        const elements =
            getElements();

        if (
            !elements.historySubtitle
        ) {
            return;
        }

        const filter =
            normalizeFilter(
                getState().currentFilter
            );

        const labels = {

            all:
                "Semua generation",

            success:
                "Generation berhasil",

            processing:
                "Generation sedang diproses",

            pending:
                "Generation menunggu proses",

            failed:
                "Generation gagal",

            cancelled:
                "Generation dibatalkan"

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

        if (
            !elements.historyBody
        ) {

            console.warn(
                "[GEN-Z.AI History] " +
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


        if (
            !filteredData.length
        ) {

            elements.historyBody.innerHTML =
                "";

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
       LOADING
    ===================================================== */

    function renderLoading() {

        const elements =
            getElements();

        if (
            elements.loadingState
        ) {

            elements.loadingState.style.display =
                "block";
        }

        if (
            elements.tableWrap
        ) {

            elements.tableWrap.style.display =
                "none";
        }

        if (
            elements.emptyState
        ) {

            elements.emptyState.style.display =
                "none";
        }
    }


    App.renderLoading =
        renderLoading;


    /* =====================================================
       ERROR
    ===================================================== */

    function renderError() {

        const elements =
            getElements();

        if (
            elements.loadingState
        ) {

            elements.loadingState.style.display =
                "none";
        }

        if (
            elements.tableWrap
        ) {

            elements.tableWrap.style.display =
                "none";
        }

        if (
            elements.emptyState
        ) {

            elements.emptyState.style.display =
                "none";
        }
    }


    App.renderError =
        renderError;


    /* =====================================================
       VIDEO PRELOAD
    ===================================================== */

    function preloadThumbnailVideos() {

    /*
     * DISABLED — Jangan paksa load semua video thumbnail.
     *
     * Sebelumnya fungsi ini memanggil video.load() untuk
     * SEMUA thumbnail, yang memicu ratusan HTTP request
     * ke file .mp4 sekaligus.
     *
     * Browser modern sudah otomatis load video saat
     * masuk viewport ketika preload="metadata".
     *
     * Biarkan browser yang mengatur kapan load.
     */

    return;
}


    App.preloadThumbnailVideos =
        preloadThumbnailVideos;


    /* =====================================================
       REFRESH
    ===================================================== */

    function refreshRender() {

        renderHistory();

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


    /* =====================================================
       PUBLIC API
    ===================================================== */

    App.getUserDisplay =
        getUserDisplay;

    App.getProviderDisplay =
        getProviderDisplay;

    App.getModelDisplay =
        getModelDisplay;

    App.getPromptDisplay =
        getPromptDisplay;

    App.getStatusDisplay =
        getStatusDisplay;

    App.getCreditDisplay =
        getCreditDisplay;

    App.getRowHtml =
        getRowHtml;

    App.renderTable =
        renderTable;

    App.renderEmptyState =
        renderEmptyState;

    App.updateUserColumn =
        updateUserColumn;

    App.updateHistoryCount =
        updateHistoryCount;

    App.updateSubtitle =
        updateSubtitle;


})();
