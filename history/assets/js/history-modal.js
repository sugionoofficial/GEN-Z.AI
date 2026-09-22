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
   - Menampilkan video hasil generation

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


    /* =====================================================
       ROOT NAMESPACE
    ===================================================== */

    window.GENZHistory =
        window.GENZHistory || {};

    const App =
        window.GENZHistory;


    /* =====================================================
       STATE
       -----------------------------------------------------
       Jangan mengganti state yang sudah dibuat oleh
       history-state.js.
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

    if (
        !Object.prototype.hasOwnProperty.call(
            App.state,
            "currentModalHistoryId"
        )
    ) {

        App.state.currentModalHistoryId = null;

    }


    /* =====================================================
       ELEMENTS
    ===================================================== */

    App.elements =
        App.elements || {};


    /* =====================================================
       HELPERS
    ===================================================== */

    function getState() {

        return App.state;

    }


    function getElements() {

        return App.elements;

    }


    function escapeHtml(
        value
    ) {

        if (
            typeof App.escapeHtml ===
            "function"
        ) {

            return App.escapeHtml(
                value
            );

        }


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


    function getHistoryData() {

        if (
            typeof App.getHistoryData ===
            "function"
        ) {

            const data =
                App.getHistoryData();


            return Array.isArray(data)
                ? data
                : [];

        }


        return Array.isArray(
            getState().historyData
        )
            ? getState().historyData
            : [];

    }


    function getHistoryById(
        id
    ) {

        const target =
            String(
                id || ""
            ).trim();


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
            function (item) {

                return (
                    String(
                        item?.id || ""
                    ).trim() === target
                );

            }
        ) || null;

    }


    /* =====================================================
       DATA HELPERS
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


        const value =
            String(
                item?.result_url ||
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


    function formatDate(
        value
    ) {

        if (
            typeof App.formatDate ===
            "function"
        ) {

            return App.formatDate(
                value
            );

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


    function formatCredits(
        value
    ) {

        if (
            typeof App.formatCredits ===
            "function"
        ) {

            return App.formatCredits(
                value
            );

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

    function getStatusLabel(
        status
    ) {

        if (
            typeof App.getStatusLabel ===
            "function"
        ) {

            return App.getStatusLabel(
                status
            );

        }


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


    function getStatusClass(
        status
    ) {

        if (
            typeof App.getStatusClass ===
            "function"
        ) {

            return App.getStatusClass(
                status
            );

        }


        return (
            "status-" +
            normalizeStatus(
                status
            )
        );

    }


    /* =====================================================
       DETAIL FIELD
       -----------------------------------------------------
       Menggunakan class yang memang sudah tersedia
       di CSS history/index.html:
       .detail-row
       .detail-label
       .detail-value
    ===================================================== */

    function renderField(
        label,
        value,
        options = {}
    ) {

        const rawValue =
            value === null ||
            value === undefined
                ? ""
                : String(value).trim();


        const displayValue =
            rawValue || "-";


        const extraClass =
            String(
                options.className || ""
            ).trim();


        const mono =
            options.mono === true
                ? " mono"
                : "";


        return `
            <div
                class="detail-row ${escapeHtml(
                    extraClass
                )}"
            >

                <div class="detail-label">
                    ${escapeHtml(
                        label
                    )}
                </div>

                <div
                    class="detail-value${mono}"
                >
                    ${escapeHtml(
                        displayValue
                    )}
                </div>

            </div>
        `;

    }


    /* =====================================================
       PROMPT
    ===================================================== */

    function renderPrompt(
        item
    ) {

        const prompt =
            getPrompt(
                item
            );


        return `
            <div class="detail-row">

                <div class="detail-label">
                    Prompt
                </div>

                <div class="detail-value">
                    ${
                        prompt
                            ? escapeHtml(
                                prompt
                            )
                            : "-"
                    }
                </div>

            </div>
        `;

    }


    /* =====================================================
       STATUS
    ===================================================== */

    function renderStatus(
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


        const className =
            getStatusClass(
                status
            );


        return `
            <div class="detail-row">

                <div class="detail-label">
                    Status
                </div>

                <div class="detail-value">

                    <span
                        class="status ${escapeHtml(
                            className
                        )}"
                    >

                        <span
                            class="status-dot"
                        ></span>

                        ${escapeHtml(
                            label
                        )}

                    </span>

                </div>

            </div>
        `;

    }


    /* =====================================================
       RESULT
    ===================================================== */

    function renderResult(
        item
    ) {

        const url =
            getResultUrl(
                item
            );


        if (!url) {

            return `
                <div class="detail-row">

                    <div class="detail-label">
                        Result
                    </div>

                    <div class="detail-value">
                        -
                    </div>

                </div>
            `;

        }


        const safeUrl =
            escapeHtml(
                url
            );


        return `
            <div class="detail-row">

                <div class="detail-label">
                    Result
                </div>

                <div class="detail-value">

                    <a
                        href="${safeUrl}"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="output-link"
                    >
                        Buka hasil generation
                    </a>

                </div>

            </div>
        `;

    }


    /* =====================================================
       ERROR
    ===================================================== */

    function renderError(
        item
    ) {

        const error =
            getErrorMessage(
                item
            );


        if (!error) {

            return "";

        }


        return `
            <div class="detail-row">

                <div class="detail-label">
                    Error
                </div>

                <div
                    class="detail-value"
                    style="
                        color:#991b1b;
                    "
                >
                    ${escapeHtml(
                        error
                    )}
                </div>

            </div>
        `;

    }


    /* =====================================================
       VIDEO PREVIEW
       -----------------------------------------------------
       Menggunakan class yang memang tersedia:
       .detail-video-preview
    ===================================================== */

    function renderVideoPreview(
        item
    ) {

        const status =
            normalizeStatus(
                item?.status
            );


        const url =
            getResultUrl(
                item
            );


        if (
            status !== "success" ||
            !url
        ) {

            return "";

        }


        const safeUrl =
            escapeHtml(
                url
            );


        return `
            <div class="detail-video-preview">

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

    function renderModalBody(
        item
    ) {

        const elements =
            getElements();


        if (
            !elements.modalBody
        ) {

            return;

        }


        if (!item) {

            elements.modalBody.innerHTML = `
                <div class="detail-row">

                    <div class="detail-label">
                        History
                    </div>

                    <div class="detail-value">
                        Data history tidak ditemukan.
                    </div>

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
            getTaskId(
                item
            );


        const modelId =
            getModelId(
                item
            );


        const modelName =
            getModelName(
                item
            );


        const provider =
            getProviderName(
                item
            );


        const credits =
            getCreditCost(
                item
            );


        elements.modalBody.innerHTML = `

            ${renderVideoPreview(
                item
            )}


            ${renderStatus(
                item
            )}


            ${renderField(
                "Provider",
                provider
            )}


            ${renderField(
                "Model",
                modelName
            )}


            ${renderField(
                "Model ID",
                modelId,
                {
                    mono: true
                }
            )}


            ${renderField(
                "Task ID",
                taskId,
                {
                    mono: true
                }
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


            ${renderPrompt(
                item
            )}


            ${renderResult(
                item
            )}


            ${renderError(
                item
            )}

        `;

    }


    /* =====================================================
       OPEN MODAL
    ===================================================== */

    function openDetailModal(
        id
    ) {

        const elements =
            getElements();


        const targetId =
            String(
                id || ""
            ).trim();


        if (!targetId) {

            return;

        }


        const item =
            getHistoryById(
                targetId
            );


        if (!item) {

            console.warn(
                "[GEN-Z.AI History] History detail tidak ditemukan:",
                targetId
            );


            return;

        }


        getState().currentModalHistoryId =
            targetId;


        renderModalBody(
            item
        );


        if (
            !elements.detailModal
        ) {

            return;

        }


        /*
         * CSS awal memakai display:none.
         * Menggunakan inline display:flex
         * tetap kompatibel dengan CSS tersebut.
         */
        elements.detailModal.style.display =
            "flex";


        elements.detailModal.setAttribute(
            "aria-hidden",
            "false"
        );


        /*
         * Tambahkan class show agar
         * kompatibel dengan CSS .modal.show.
         */
        elements.detailModal.classList.add(
            "show"
        );


        document.body.classList.add(
            "history-modal-open"
        );


        /*
         * Fokus tombol close.
         */
        if (
            elements.closeModal
        ) {

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


        if (
            !elements.detailModal
        ) {

            return;

        }


        /*
         * Hentikan video yang sedang
         * dimainkan di dalam modal.
         */
        const videos =
            elements.detailModal
                .querySelectorAll(
                    "video"
                );


        videos.forEach(
            function (video) {

                try {

                    video.pause();

                    video.currentTime = 0;

                } catch (error) {

                    /* noop */

                }

            }
        );


        /*
         * Bersihkan modal state.
         */
        elements.detailModal.style.display =
            "none";


        elements.detailModal.classList.remove(
            "show"
        );


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
            (
                elements.detailModal.style.display ===
                    "flex" ||

                elements.detailModal.classList.contains(
                    "show"
                )
            )
        ) {

            closeDetailModal();

            return;

        }


        openDetailModal(
            id
        );

    }


    App.toggleDetailModal =
        toggleDetailModal;


    /* =====================================================
       REFRESH OPEN MODAL
       -----------------------------------------------------
       Dipakai setelah history reload supaya
       modal yang sedang terbuka ikut mendapatkan
       data terbaru.
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
            getHistoryById(
                id
            );


        if (!item) {

            closeDetailModal();

            return;

        }


        renderModalBody(
            item
        );

    }


    App.refreshOpenModal =
        refreshOpenModal;


    /* =====================================================
       PUBLIC COMPATIBILITY
    ===================================================== */

    App.renderModalBody =
        renderModalBody;

    App.renderHistoryModal =
        openDetailModal;


    /* =====================================================
       GLOBAL COMPATIBILITY
       -----------------------------------------------------
       Dipertahankan untuk HTML lama yang mungkin masih
       menggunakan:
       onclick="openHistoryDetail(...)"
    ===================================================== */

    window.openHistoryDetail =
        openDetailModal;


    window.closeHistoryDetail =
        closeDetailModal;


})();
