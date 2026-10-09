/* =========================================================
   GEN-Z.AI
   HISTORY MODAL MODULE v4
   ---------------------------------------------------------
   + Fitur upscale: tombol "Upscale ke 2K" di modal detail
   + Fitur download: tombol "Download" di modal detail
   + Deteksi tipe media (image vs video) dari URL
   + Deteksi model "upscale-photo" untuk hide upscale button
========================================================= */

(function () {

    "use strict";


    window.GENZHistory = window.GENZHistory || {};
    const App = window.GENZHistory;

    App.state = App.state || {};
if (!Array.isArray(App.state.historyData)) App.state.historyData = [];
if (typeof App.state.currentFilter !== "string") App.state.currentFilter = "all";
if (!Object.prototype.hasOwnProperty.call(App.state, "currentModalHistoryId")) {
    App.state.currentModalHistoryId = null;
}

/* Timer runtime untuk modal — 1 instance global */
App.state.modalRuntimeTimerId = null;

    App.elements = App.elements || {};


    /* =====================================================
       HELPERS
    ===================================================== */

    function getState() { return App.state; }
    function getElements() { return App.elements; }

    function escapeHtml(value) {
        if (typeof App.escapeHtml === "function") return App.escapeHtml(value);
        if (value === null || value === undefined) return "";
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function normalizeStatus(status) {
        if (typeof App.normalizeStatus === "function") return App.normalizeStatus(status);
        const v = String(status || "pending").trim().toLowerCase();
        if (v === "completed") return "success";
        if (v === "queued") return "pending";
        return v;
    }

    function getHistoryData() {
        if (typeof App.getHistoryData === "function") {
            const d = App.getHistoryData();
            return Array.isArray(d) ? d : [];
        }
        return Array.isArray(getState().historyData) ? getState().historyData : [];
    }

    function getHistoryById(id) {
        const target = String(id || "").trim();
        if (!target) return null;
        if (typeof App.findHistoryById === "function") return App.findHistoryById(target);
        return getHistoryData().find(i => String(i?.id || "").trim() === target) || null;
    }


    /* =====================================================
       DATA HELPERS
    ===================================================== */

    function getTaskId(item) {
        if (typeof App.getTaskId === "function") return App.getTaskId(item);
        return String(item?.task_id || item?.taskId || "").trim();
    }

    function getModelId(item) {
        if (typeof App.getModelId === "function") return App.getModelId(item);
        return String(item?.model_id || item?.modelId || "").trim();
    }

    function getModelName(item) {
        if (typeof App.getModelName === "function") return App.getModelName(item);
        return String(item?.model_name || item?.modelName || item?.model || "").trim();
    }

    function getProviderName(item) {
        if (typeof App.getProviderName === "function") return App.getProviderName(item);
        return String(item?.provider_name || item?.providerName || item?.provider || "").trim();
    }

    function getPrompt(item) {
        if (typeof App.getPrompt === "function") return App.getPrompt(item);
        return String(item?.prompt || "").trim();
    }

    function getCreditCost(item) {
        if (typeof App.getCreditCost === "function") return App.getCreditCost(item);
        const v = Number(item?.credit_cost ?? 0);
        return Number.isFinite(v) ? v : 0;
    }

    function getErrorMessage(item) {
        if (typeof App.getErrorMessage === "function") return App.getErrorMessage(item);
        return String(item?.error_message || item?.error || item?.message || "").trim();
    }

    function getResultUrl(item) {
        if (typeof App.getResultUrl === "function") return App.getResultUrl(item);
        const v = String(item?.result_url || "").trim();
        if (!v) return "";
        const lower = v.toLowerCase();
        if (lower.startsWith("javascript:") || lower.startsWith("data:text/html")) return "";
        return v;
    }

    function formatDate(value) {
        if (typeof App.formatDate === "function") return App.formatDate(value);
        if (!value) return "-";
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return "-";
        return d.toLocaleString("id-ID");
    }

    function formatCredits(value) {
        if (typeof App.formatCredits === "function") return App.formatCredits(value);
        const n = Number(value);
        if (!Number.isFinite(n)) return "0";
        return n.toLocaleString("id-ID");
    }


    /* =====================================================
       MEDIA TYPE DETECTION
    ===================================================== */

    var IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif", "bmp", "svg", "avif"];

    function isImageUrl(url) {
        if (!url) return false;
        var clean = String(url).split("?")[0].split("#")[0].toLowerCase();
        var dot = clean.lastIndexOf(".");
        if (dot === -1) return false;
        var ext = clean.slice(dot + 1);
        return IMAGE_EXTENSIONS.indexOf(ext) !== -1;
    }

    function isUpscalePhoto(item) {
        var modelId = String(item?.model_id || item?.modelId || "").toLowerCase();
        if (modelId === "upscale-photo") return true;
        var taskId = String(item?.task_id || item?.taskId || "").toLowerCase();
        if (taskId.indexOf("upscale-photo_") === 0) return true;
        return false;
    }

    function isUpscaleVideo(item) {
        var modelId = String(item?.model_id || item?.modelId || "").toLowerCase();
        if (modelId === "upscale-video") return true;
        var taskId = String(item?.task_id || item?.taskId || "").toLowerCase();
        if (taskId.indexOf("upscale_") === 0) return true;
        return false;
    }

    function getMediaType(item) {
        var url = getResultUrl(item);
        if (url && isImageUrl(url)) return "image";
        // Kalau model = upscale-photo → pasti image
        if (isUpscalePhoto(item)) return "image";
        // Default ke video (existing behavior)
        return "video";
    }


    /* =====================================================
       STATUS LABEL / CLASS
    ===================================================== */

    function getStatusLabel(status) {
        if (typeof App.getStatusLabel === "function") return App.getStatusLabel(status);
        const n = normalizeStatus(status);
        switch (n) {
            case "success": return "SUCCESS";
            case "processing": return "PROCESSING";
            case "pending": return "PENDING";
            case "failed": return "GAGAL";
            case "cancelled": return "DIBATALKAN";
            default: return n ? n.toUpperCase() : "UNKNOWN";
        }
    }

    function getStatusClass(status) {
        if (typeof App.getStatusClass === "function") return App.getStatusClass(status);
        return "status-" + normalizeStatus(status);
    }


    /* =====================================================
       RENDER FIELD
    ===================================================== */

    function renderField(label, value, options) {
        options = options || {};
        const rawValue = value === null || value === undefined ? "" : String(value).trim();
        const displayValue = rawValue || "-";
        const extraClass = String(options.className || "").trim();
        const mono = options.mono === true ? " mono" : "";

        return `
            <div class="detail-row ${escapeHtml(extraClass)}">
                <div class="detail-label">${escapeHtml(label)}</div>
                <div class="detail-value${mono}">${escapeHtml(displayValue)}</div>
            </div>
        `;
    }


    /* =====================================================
       PROMPT
    ===================================================== */

    function renderPrompt(item) {
        const prompt = getPrompt(item);
        const historyId = String(item?.id || "").trim();
        const safeHistoryId = escapeHtml(historyId);

        return `
            <div class="detail-row detail-prompt-row">
                <div class="detail-label">Prompt</div>
                <div class="detail-value detail-prompt-value">
                    ${
                        prompt
                            ? `
                                <div class="detail-prompt-content">
                                    <div class="detail-prompt-text">${escapeHtml(prompt)}</div>
                                    <button
                                        type="button"
                                        class="history-prompt-copy detail-prompt-copy"
                                        data-action="copy-prompt"
                                        data-history-id="${safeHistoryId}"
                                        title="Copy prompt"
                                    >COPY</button>
                                </div>
                            `
                            : "-"
                    }
                </div>
            </div>
        `;
    }


    /* =====================================================
       STATUS
    ===================================================== */

    function renderStatus(item) {
        const status = normalizeStatus(item?.status);
        const label = getStatusLabel(status);
        const className = getStatusClass(status);

        return `
            <div class="detail-row">
                <div class="detail-label">Status</div>
                <div class="detail-value">
                    <span class="status ${escapeHtml(className)}">
                        <span class="status-dot"></span>
                        ${escapeHtml(label)}
                    </span>
                </div>
            </div>
        `;
    }

   /* =====================================================
   MODAL RUNTIME COUNTER
===================================================== */

function pad2(n) {
    return n < 10 ? "0" + n : String(n);
}

function formatRuntime(ms) {
    if (!Number.isFinite(ms) || ms < 0) return "00:00";
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return h + ":" + pad2(m) + ":" + pad2(s);
    return pad2(m) + ":" + pad2(s);
}

function stopModalRuntime() {
    const st = getState();
    if (st.modalRuntimeTimerId) {
        clearInterval(st.modalRuntimeTimerId);
        st.modalRuntimeTimerId = null;
    }
}

function startModalRuntime(createdAtIso) {
    stopModalRuntime();

    if (!createdAtIso) return;

    const startTime = new Date(createdAtIso).getTime();
    if (!Number.isFinite(startTime)) return;

    const el = document.getElementById("modalRuntime");
    if (!el) return;

    const tick = function () {
        const target = document.getElementById("modalRuntime");
        if (!target) {
            stopModalRuntime();
            return;
        }
        const elapsed = Date.now() - startTime;
        target.textContent = formatRuntime(elapsed);
    };

    tick();
    getState().modalRuntimeTimerId = setInterval(tick, 1000);
}

function renderRuntimeRow(item) {
    const status = normalizeStatus(item?.status);
    const isActive = status === "processing" || status === "pending";

    if (!isActive) return "";

    const createdAt =
        item?.created_at ||
        item?.createdAt ||
        "";

    if (!createdAt) return "";

    return `
        <div class="detail-row detail-runtime-row">
            <div class="detail-label">Runtime</div>
            <div class="detail-value">
                <span class="modal-runtime-badge">
                    <span class="modal-runtime-dot" aria-hidden="true"></span>
                    <span id="modalRuntime" data-created-at="${escapeHtml(String(createdAt))}">--:--</span>
                </span>
            </div>
        </div>
    `;
}


    /* =====================================================
       RESULT
    ===================================================== */

    function renderResult(item) {
        const url = getResultUrl(item);
        if (!url) {
            return `
                <div class="detail-row">
                    <div class="detail-label">Result</div>
                    <div class="detail-value">-</div>
                </div>
            `;
        }
        const safeUrl = escapeHtml(url);
        return `
            <div class="detail-row">
                <div class="detail-label">Result</div>
                <div class="detail-value">
                    <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="output-link">
                        Buka hasil generation
                    </a>
                </div>
            </div>
        `;
    }


    /* =====================================================
       ERROR
    ===================================================== */

    function renderError(item) {
        const error = getErrorMessage(item);
        if (!error) return "";
        return `
            <div class="detail-row">
                <div class="detail-label">Error</div>
                <div class="detail-value" style="color:#991b1b;">
                    ${escapeHtml(error)}
                </div>
            </div>
        `;
    }


    /* =====================================================
       MEDIA PREVIEW — Image atau Video
    ===================================================== */

    function renderMediaPreview(item) {
        const status = normalizeStatus(item?.status);
        const url = getResultUrl(item);
        if (status !== "success" || !url) return "";

        const safeUrl = escapeHtml(url);
        const mediaType = getMediaType(item);

        if (mediaType === "image") {
            return `
                <div class="detail-video-preview detail-image-preview">
                    <img
                        src="${safeUrl}"
                        alt="Upscale result"
                        loading="lazy"
                        decoding="async"
                    >
                </div>
            `;
        }

        return `
            <div class="detail-video-preview">
                <video controls playsinline preload="metadata" src="${safeUrl}"></video>
            </div>
        `;
    }


    /* =====================================================
       UPSCALE HELPER
    ===================================================== */

    function hasAlreadyUpscaled(parentId) {
        const target = String(parentId || "").trim();
        if (!target) return false;

        return getHistoryData().some(h => {
            const parentRef = String(h?.upscale_of_history_id || "").trim();
            if (parentRef !== target) return false;
            const st = normalizeStatus(h?.status);
            return st !== "failed" && st !== "cancelled";
        });
    }


    /* =====================================================
       ACTION ROW — Download + Upscale
       -----------------------------------------------------
       Aturan:
       - Image (upscale-photo) → hanya tombol Download
       - Video upscale result → hanya tombol Download
       - Video original success → Download + Upscale
    ===================================================== */

    function renderActionRow(item) {
        const status = normalizeStatus(item?.status);
        const url = getResultUrl(item);

        if (status !== "success" || !url) return "";

        const safeId = escapeHtml(String(item.id || "").trim());
        const mediaType = getMediaType(item);
        const isPhoto = mediaType === "image";
        const isVideoUpscale = isUpscaleVideo(item);

        const downloadLabel = isPhoto ? "Download Foto" : "Download Video";
        const downloadIcon = isPhoto ? "⬇" : "⬇";

        const alreadyUpscaled = isVideoUpscale || hasAlreadyUpscaled(item.id);

        /* Tombol upscale hanya untuk video original (bukan image, bukan hasil upscale) */
        const canUpscale = !isPhoto && !alreadyUpscaled;

        return `
            <div class="detail-row detail-action-row">
                <div class="detail-label">Action</div>
                <div class="detail-value">

                    <div class="detail-action-buttons">

                        <button
                            type="button"
                            class="download-button"
                            data-action="download"
                            data-history-id="${safeId}"
                            title="${escapeHtml(downloadLabel)}"
                        >
                            <span class="download-icon" aria-hidden="true">${downloadIcon}</span>
                            ${escapeHtml(downloadLabel)}
                        </button>

                        ${
                            canUpscale
                                ? `
                                    <button
                                        type="button"
                                        class="upscale-button"
                                        data-action="upscale"
                                        data-history-id="${safeId}"
                                        title="Upscale ke 2K"
                                    >
                                        <span class="upscale-icon" aria-hidden="true">⬆</span>
                                        Upscale ke 2560×1440 (QHD)
                                        <span class="upscale-button-cost">1 credit</span>
                                    </button>
                                `
                                : (
                                    alreadyUpscaled && !isPhoto
                                        ? `<span class="upscale-already-text">✓ Upscale sudah diproses</span>`
                                        : ""
                                )
                        }

                    </div>

                    ${
                        canUpscale
                            ? `
                                <p class="upscale-hint">
                                    Upscale: video diproses ulang menjadi 2K
                                    dengan FFmpeg. Estimasi 1–3 menit.
                                </p>
                            `
                            : ""
                    }

                </div>
            </div>
        `;
    }


    /* =====================================================
       MODAL BODY
    ===================================================== */

    function renderModalBody(item) {
        const elements = getElements();
        const body = elements.modalBody || document.getElementById("modalBody");
        if (!body) return;

        if (!item) {
            body.innerHTML = `
                <div class="detail-row">
                    <div class="detail-label">History</div>
                    <div class="detail-value">Data history tidak ditemukan.</div>
                </div>
            `;
            return;
        }

        const createdAt = item?.created_at || item?.createdAt || null;
        const completedAt = item?.completed_at || item?.completedAt || null;
        const taskId = getTaskId(item);
        const modelId = getModelId(item);
        const modelName = getModelName(item);
        const provider = getProviderName(item);
        const credits = getCreditCost(item);

        body.innerHTML = `
            ${renderMediaPreview(item)}
            ${renderStatus(item)}
            ${renderRuntimeRow(item)}
            ${renderField("Provider", provider)}
            ${renderField("Model", modelName)}
            ${renderField("Model ID", modelId, { mono: true })}
            ${renderField("Task ID", taskId, { mono: true })}
            ${renderField("Credit", formatCredits(credits))}
            ${renderField("Dibuat", formatDate(createdAt))}
            ${renderField("Selesai", completedAt ? formatDate(completedAt) : "-")}
            ${renderPrompt(item)}
            ${renderResult(item)}
            ${renderError(item)}
            ${renderActionRow(item)}
        `;
    }


    /* =====================================================
       DOWNLOAD HELPER — BUILD FILENAME
    ===================================================== */

    function buildDownloadFilename(item) {
        const taskId = String(item?.task_id || item?.id || "file").trim();
        const resolution = String(item?.resolution || "").trim();
        const modelName = String(item?.model_name || item?.model_id || "").trim();

        const shortId = taskId
            .substring(0, 12)
            .replace(/[^a-z0-9_-]/gi, "");

        // Deteksi ekstensi dari URL
        let ext = "mp4";
        const url = getResultUrl(item);
        if (url) {
            const clean = String(url).split("?")[0].split("#")[0].toLowerCase();
            const match = clean.match(/\.([a-z0-9]+)$/i);
            if (match && match[1]) {
                ext = match[1];
            }
        }
        // Fallback: kalau model = upscale-photo, default jpg
        if (isUpscalePhoto(item) && (ext === "mp4" || !ext)) {
            ext = "jpg";
        }

        const date = new Date()
            .toISOString()
            .slice(0, 10)
            .replace(/-/g, "");

        const modelClean = modelName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "")
            .substring(0, 30) || "file";

        const resPart = resolution
            ? `-${resolution.replace(/[^a-z0-9]/gi, "")}`
            : "";

        return `GENZ-AI-${date}-${modelClean}${resPart}-${shortId}.${ext}`;
    }


    /* =====================================================
       DOWNLOAD HANDLER
    ===================================================== */

    async function handleDownload(button) {
        const historyId = String(button?.dataset?.historyId || "").trim();
        if (!historyId) return;

        const item = getHistoryById(historyId);
        if (!item) {
            alert("Data history tidak ditemukan");
            return;
        }

        const url = getResultUrl(item);
        if (!url) {
            alert("Hasil tidak tersedia untuk diunduh");
            return;
        }

        const filename = buildDownloadFilename(item);
        const originalHTML = button.innerHTML;

        button.disabled = true;
        button.innerHTML = '<span class="download-icon">⏳</span> Menyiapkan...';

        /* ---- Approach 1: Fetch blob ---- */

        try {
            const res = await fetch(url, { mode: "cors" });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const blob = await res.blob();
            const objUrl = URL.createObjectURL(blob);

            const a = document.createElement("a");
            a.href = objUrl;
            a.download = filename;
            a.style.display = "none";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            setTimeout(() => {
                try { URL.revokeObjectURL(objUrl); } catch (e) {}
            }, 5000);

            button.innerHTML = '<span class="download-icon">✓</span> Terunduh';
            button.classList.add("download-button-success");

            setTimeout(() => {
                button.innerHTML = originalHTML;
                button.classList.remove("download-button-success");
                button.disabled = false;
            }, 2500);

            return;

        } catch (err) {
            console.warn("[download] Blob fetch failed, fallback to direct:", err);
        }

        /* ---- Approach 2: Direct anchor ---- */

        try {
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            a.target = "_blank";
            a.rel = "noopener noreferrer";
            a.style.display = "none";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            button.innerHTML = '<span class="download-icon">✓</span> Terbuka di tab';
            button.classList.add("download-button-success");

            setTimeout(() => {
                button.innerHTML = originalHTML;
                button.classList.remove("download-button-success");
                button.disabled = false;
            }, 2500);

        } catch (err2) {
            console.error("[download] Fallback failed:", err2);
            alert("Gagal mengunduh. Coba klik kanan pada media → Save As.");
            button.innerHTML = originalHTML;
            button.disabled = false;
        }
    }


    /* =====================================================
       UPSCALE HANDLER
    ===================================================== */

    async function handleUpscale(button) {
        const historyId = String(button?.dataset?.historyId || "").trim();
        if (!historyId) return;

        if (!window.confirm("Upscale video ini ke 2K?\nAkan menggunakan 1 credit.")) {
            return;
        }

        const originalHTML = button.innerHTML;
        button.disabled = true;
        button.innerHTML = "Memproses...";

        try {
            const client = App.state?.supabaseClient || window.GENZ_SUPABASE;
            if (!client) throw new Error("Supabase client tidak tersedia");

            const { data: sessionData } = await client.auth.getSession();
            const token = sessionData?.session?.access_token;
            if (!token) throw new Error("Sesi login tidak ditemukan");

            const res = await fetch("/api/generate", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    action: "upscale",
                    history_id: historyId
                })
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(data?.error || `Gagal memulai upscale (${res.status})`);
            }

            button.innerHTML = "✓ Upscale dimulai";
            button.classList.add("upscale-button-success");

            setTimeout(async () => {
                try {
                    if (typeof App.loadHistory === "function") {
                        await App.loadHistory({ silent: true });
                    }
                    if (typeof App.closeDetailModal === "function") {
                        App.closeDetailModal();
                    }
                } catch (e) {
                    console.warn("[upscale] Reload history failed:", e);
                }
            }, 800);

        } catch (err) {
            console.error("[upscale] Error:", err);
            alert(err.message || "Gagal memulai upscale");
            button.disabled = false;
            button.innerHTML = originalHTML;
        }
    }


    /* =====================================================
       EVENT DELEGATION DI MODAL BODY
    ===================================================== */

    function setupModalBodyEvents() {
        const elements = getElements();
        const body = elements.modalBody || document.getElementById("modalBody");
        if (!body) return;
        if (body.dataset.actionBound === "true") return;

        body.addEventListener("click", function (event) {

            const downloadBtn = event.target.closest("[data-action='download']");
            if (downloadBtn) {
                event.preventDefault();
                handleDownload(downloadBtn);
                return;
            }

            const upscaleBtn = event.target.closest("[data-action='upscale']");
            if (upscaleBtn) {
                event.preventDefault();
                handleUpscale(upscaleBtn);
                return;
            }

        });

        body.dataset.actionBound = "true";
    }


    /* =====================================================
       OPEN MODAL
    ===================================================== */

    function openDetailModal(id) {
        const targetId = String(id || "").trim();
        if (!targetId) return;

        const item = getHistoryById(targetId);
        if (!item) {
            console.warn("[GEN-Z.AI History] History detail tidak ditemukan:", targetId);
            return;
        }

        getState().currentModalHistoryId = targetId;
        renderModalBody(item);
        setupModalBodyEvents();

        const createdAt =
            item?.created_at ||
            item?.createdAt ||
            "";
        startModalRuntime(createdAt);

        const elements = getElements();
        const modal = elements.detailModal || document.getElementById("detailModal");
        if (!modal) return;

        modal.style.display = "flex";
        modal.classList.add("show");
        modal.setAttribute("aria-hidden", "false");
        document.body.classList.add("history-modal-open");

        const closeBtn = elements.closeModal || document.getElementById("closeModal");
        if (closeBtn) {
            try { closeBtn.focus(); } catch (e) {}
        }
    }

    App.openDetailModal = openDetailModal;


    /* =====================================================
       CLOSE MODAL
    ===================================================== */

    function closeDetailModal() {
        stopModalRuntime();

        const elements = getElements();
        const modal = elements.detailModal || document.getElementById("detailModal");
        if (!modal) return;

        const videos = modal.querySelectorAll("video");
        videos.forEach(v => {
            try { v.pause(); v.currentTime = 0; } catch (e) {}
        });

        modal.style.display = "none";
        modal.classList.remove("show");
        modal.setAttribute("aria-hidden", "true");
        document.body.classList.remove("history-modal-open");

        getState().currentModalHistoryId = null;
    }

    App.closeDetailModal = closeDetailModal;


    /* =====================================================
       TOGGLE
    ===================================================== */

    function toggleDetailModal(id) {
        const elements = getElements();
        const modal = elements.detailModal || document.getElementById("detailModal");

        if (modal && (modal.style.display === "flex" || modal.classList.contains("show"))) {
            closeDetailModal();
            return;
        }

        openDetailModal(id);
    }

    App.toggleDetailModal = toggleDetailModal;


    /* =====================================================
       REFRESH OPEN MODAL
    ===================================================== */

    function refreshOpenModal() {
        const id = getState().currentModalHistoryId;
        if (!id) return;

        stopModalRuntime();

        const item = getHistoryById(id);
        if (!item) {
            closeDetailModal();
            return;
        }

        renderModalBody(item);
    }

    App.refreshOpenModal = refreshOpenModal;


    /* =====================================================
       PUBLIC COMPAT
    ===================================================== */

    App.renderModalBody = renderModalBody;
    App.renderHistoryModal = openDetailModal;

    window.openHistoryDetail = openDetailModal;
    window.closeHistoryDetail = closeDetailModal;

})();
