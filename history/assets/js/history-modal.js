/* =========================================================
   GEN-Z.AI
   HISTORY MODAL MODULE v6
   ---------------------------------------------------------
   + Fitur upscale: tombol "Upscale ke 2K" di modal detail
   + Fitur download: tombol "Download" di modal detail
   + Deteksi tipe media (image vs video) dari URL
   + Deteksi model "upscale-photo" untuk hide upscale button

   PATCH v6 (2026-10-10):
   - Image preview kembali ke <img> tag dengan inline style.
   - HAPUS loading="lazy" dan decoding="async" yang menyebabkan
     rendering blur. Gambar akan load full quality saat modal terbuka.
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
        if (isUpscalePhoto(item)) return "image";
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
        /*
         * Jangan tampilkan tautan "Buka hasil generation" yang sudah
         * tidak bisa dibuka; itu bertentangan dengan peringatan
         * kedaluwarsa di atasnya.
         */
        if (isMediaExpired(item)) {
            return `
                <div class="detail-row">
                    <div class="detail-label">Result</div>
                    <div class="detail-value">
                        <span class="detail-expired-hint">Tautan hasil sudah tidak tersedia.</span>
                    </div>
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

    function renderUpscaleProgressActions(item) {
        const status = normalizeStatus(item?.status);
        if (
            getModelId(item).toLowerCase() !== "upscale-video" ||
            (status !== "processing" && status !== "pending")
        ) {
            return "";
        }

        const safeId = escapeHtml(String(item.id || "").trim());
        return `
            <div class="detail-row detail-action-row">
                <div class="detail-label">Upscale</div>
                <div class="detail-value">
                    <div class="detail-action-buttons">
                        <button
                            type="button"
                            class="download-button"
                            data-action="refresh-upscale-status"
                            data-history-id="${safeId}"
                        >
                            Periksa status GitHub
                        </button>
                        <button
                            type="button"
                            class="upscale-button"
                            data-action="cancel-upscale"
                            data-history-id="${safeId}"
                        >
                            Batalkan proses
                        </button>
                    </div>
                    <p class="upscale-hint">
                        Jika job GitHub sudah berhenti atau dibatalkan, pemeriksaan ini akan memperbarui status History dan mengembalikan credit bila perlu.
                    </p>
                </div>
            </div>
        `;
    }


    /* =====================================================
       MEDIA PREVIEW — Image atau Video
       -----------------------------------------------------
       PATCH v6: <img> tag dengan inline style eksplisit.
       HAPUS loading="lazy" dan decoding="async" yang
       menyebabkan rendering blur.
    ===================================================== */

    function isMediaExpired(item) {
        return typeof App.isExpiredMedia === "function"
            ? App.isExpiredMedia(item)
            : false;
    }

    /*
     * Alasan kedaluwarsa dibedakan supaya keterangan di modal jujur:
     * "dihapus setelah 24 jam" (berkas hilang dari penyimpanan)
     * berbeda dari "tautan provider kedaluwarsa" (berkas mungkin
     * masih ada, hanya tautannya yang tidak berlaku lagi).
     */
    function getMediaExpiryReason(item) {
        return typeof App.getMediaExpiryReason === "function"
            ? App.getMediaExpiryReason(item)
            : isMediaExpired(item)
                ? "deleted"
                : "";
    }

    function getExpiredNoticeCopy(reason) {
        if (reason === "link") {
            return {
                title: "Tautan hasil sudah kedaluwarsa",
                body: "Tautan sementara dari provider sudah melewati masa berlakunya (umumnya 1–24 jam sejak generation selesai), jadi berkasnya tidak bisa dibuka atau diunduh dari tautan ini lagi. Riwayat dan detail generation tetap tersimpan."
            };
        }

        return {
            title: "Media sudah kedaluwarsa",
            body: "Berkas hasil sudah tidak tersedia di penyimpanan. Media riwayat disimpan maksimal 24 jam, jadi file tidak bisa dibuka atau diunduh lagi. Riwayat dan detail generation tetap tersimpan."
        };
    }

    function renderMediaPreview(item) {
        const status = normalizeStatus(item?.status);
        const url = getResultUrl(item);
        if (status !== "success" || !url) return "";

        /*
         * File sudah dihapus cron retensi 24 jam: jangan tampilkan
         * <video>/<img> yang akan gagal dimuat.
         */
        if (isMediaExpired(item)) {
            const copy = getExpiredNoticeCopy(getMediaExpiryReason(item));
            return `
                <div class="detail-expired-notice" role="note">
                    <span class="detail-expired-icon" aria-hidden="true">⏳</span>
                    <div>
                        <strong>${escapeHtml(copy.title)}</strong>
                        <p>${escapeHtml(copy.body)}</p>
                    </div>
                </div>
            `;
        }

        const safeUrl = escapeHtml(url);
        const mediaType = getMediaType(item);

        if (mediaType === "image") {
            /* Inline style untuk force full quality + layout stabil */
            return `
                <div class="detail-image-preview">
                    <img
                        src="${safeUrl}"
                        alt="Hasil upscale"
                        style="display:block;width:100%;height:auto;max-height:60vh;object-fit:contain;border-radius:12px;background:#030509;"
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

    let cachedUpscaleVideoCost = null;
    let upscaleVideoCostPromise = null;

    async function loadUpscaleVideoCost() {
        if (cachedUpscaleVideoCost !== null) {
            return cachedUpscaleVideoCost;
        }
        if (upscaleVideoCostPromise) {
            return upscaleVideoCostPromise;
        }
        upscaleVideoCostPromise = (async () => {
            try {
                const client = App.state?.supabaseClient || window.GENZ_SUPABASE;
                const sessionResult = await client?.auth?.getSession?.();
                const token = sessionResult?.data?.session?.access_token;
                if (!token) return null;

                const res = await fetch("/api/feature-credits", {
                    method: "GET",
                    headers: { Authorization: `Bearer ${token}` }
                });
                const payload = await res.json().catch(() => null);
                if (!res.ok || !Array.isArray(payload?.settings)) return null;

                const row = payload.settings.find(
                    entry => entry?.feature_id === "upscale_video"
                );
                const cost = Number(row?.credit_cost);
                if (Number.isFinite(cost) && cost >= 0) {
                    cachedUpscaleVideoCost = cost;
                    document.querySelectorAll(".upscale-button-cost").forEach(el => {
                        el.textContent = `${formatCredits(cost)} credit`;
                    });
                    return cost;
                }
            } catch (_err) {
                /* ignore tariff lookup error */
            } finally {
                upscaleVideoCostPromise = null;
            }
            return null;
        })();
        return upscaleVideoCostPromise;
    }

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
    ===================================================== */

    function renderActionRow(item) {
        const status = normalizeStatus(item?.status);
        const url = getResultUrl(item);

        if (status !== "success" || !url) return "";

        if (isMediaExpired(item)) {
            const reason = getMediaExpiryReason(item);
            const hint = reason === "link"
                ? "Tautan hasil dari provider sudah kedaluwarsa. Riwayat dan detail generation tetap tersimpan."
                : "Media hasil sudah tidak tersedia setelah masa simpan 24 jam. Riwayat dan detail generation tetap tersimpan.";
            return `
                <div class="detail-row detail-action-row">
                    <div class="detail-label">Action</div>
                    <div class="detail-value">
                        <span class="detail-expired-hint">
                            ${escapeHtml(hint)}
                        </span>
                    </div>
                </div>
            `;
        }

        const safeId = escapeHtml(String(item.id || "").trim());
        const mediaType = getMediaType(item);
        const isPhoto = mediaType === "image";
        const isVideoUpscale = isUpscaleVideo(item);

        const downloadLabel = isPhoto ? "Download Foto" : "Download Video";

        const alreadyUpscaled = isVideoUpscale || hasAlreadyUpscaled(item.id);

        const canUpscale = !isPhoto && !alreadyUpscaled;
        if (canUpscale && cachedUpscaleVideoCost === null) {
            loadUpscaleVideoCost();
        }
        const upscaleCostLabel = cachedUpscaleVideoCost !== null
            ? `${formatCredits(cachedUpscaleVideoCost)} credit`
            : "Tarif dinamis";

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
                            <span class="download-icon" aria-hidden="true">⬇</span>
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
                                        <span class="upscale-button-cost">${escapeHtml(upscaleCostLabel)}</span>
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
        const statusNormalized = normalizeStatus(item?.status);
        const creditDisplayText =
            Boolean(item?.credit_refunded === true) &&
            credits > 0 &&
            (statusNormalized === "failed" || statusNormalized === "cancelled")
                ? `${formatCredits(credits)} (Dikembalikan / Refund)`
                : formatCredits(credits);

        body.innerHTML = `
            ${renderMediaPreview(item)}
            ${renderStatus(item)}
            ${renderRuntimeRow(item)}
            ${renderField("Provider", provider)}
            ${renderField("Model", modelName)}
            ${renderField("Model ID", modelId, { mono: true })}
            ${renderField("Task ID", taskId, { mono: true })}
            ${renderField("Credit", creditDisplayText)}
            ${renderField("Dibuat", formatDate(createdAt))}
            ${renderField("Selesai", completedAt ? formatDate(completedAt) : "-")}
            ${renderPrompt(item)}
            ${renderResult(item)}
            ${renderError(item)}
            ${renderUpscaleProgressActions(item)}
            ${renderActionRow(item)}
        `;
    }


    /* =====================================================
       DOWNLOAD HELPER — BUILD FILENAME
    ===================================================== */

    function buildDownloadFilename(item) {
        const url = getResultUrl(item);
        const fallbackExtension =
            getMediaType(item) === "image"
                ? "jpg"
                : "mp4";

        return window.GENZGeneratedFileName.create(
            url,
            fallbackExtension
        );
    }

    function getDirectDownloadUrl(url, filename) {
        try {
            const downloadUrl = new URL(url, window.location.href);
            if (
                downloadUrl.hostname.endsWith(".supabase.co") &&
                (downloadUrl.pathname.includes("/storage/v1/object/public/") ||
                    downloadUrl.pathname.includes("/storage/v1/object/sign/"))
            ) {
                downloadUrl.searchParams.set("download", filename);
            }
            return downloadUrl.href;
        } catch (error) {
            console.warn("[download] Could not prepare direct download URL:", error);
            return url;
        }
    }

    function triggerDirectDownload(url, filename) {
        const link = document.createElement("a");
        link.href = getDirectDownloadUrl(url, filename);
        link.download = filename;
        link.rel = "noopener noreferrer";
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();
        link.remove();
    }


    /* =====================================================
       NOTIFIKASI UNDUHAN
       -----------------------------------------------------
       Sebelumnya tombol hanya berubah teks 2,5 detik sehingga
       pengguna tidak tahu unduhan berhasil atau gagal.
       Sekarang setiap langkah memberi toast:
         info    -> "Menyiapkan unduhan…"
         success -> "Berhasil diunduh" + nama file
         info    -> "Unduhan dibuka di tab baru" (fallback)
         error   -> "Gagal mengunduh" + tombol "Coba lagi"
    ===================================================== */

    const DOWNLOAD_TOAST_KEY = "history-download";

    function notifyDownload(options = {}) {
        const toast = window.GENZToast;

        if (!toast || typeof toast.show !== "function") {
            if (options.type === "error") {
                console.warn("[download]", options.message || "");
            }
            return "";
        }

        return toast.show(options.message || "", {
            type: options.type || "info",
            description: options.description || "",
            actionLabel: options.actionLabel || "",
            onAction: options.onAction || null,
            duration: options.duration,
            key: options.key || DOWNLOAD_TOAST_KEY
        });
    }

    function notifyDownloadStart(filename) {
        notifyDownload({
            type: "info",
            message: "Menyiapkan unduhan…",
            description: filename,
            duration: 0
        });
    }

    function notifyDownloadSuccess(message, filename) {
        notifyDownload({
            type: "success",
            message,
            description: filename,
            duration: 5200
        });
    }

    function notifyDownloadFallback(filename) {
        notifyDownload({
            type: "info",
            message: "Unduhan dibuka di tab baru",
            description: `${filename} — jika tidak muncul, izinkan unduhan otomatis di browser.`,
            duration: 6000
        });
    }

    function notifyDownloadFailure(reason, retry) {
        notifyDownload({
            type: "error",
            message: "GAGAL MENGUNDUH",
            description: reason || "Silakan coba kembali.",
            actionLabel: typeof retry === "function" ? "Coba lagi" : "",
            onAction: typeof retry === "function" ? retry : null,
            duration: 0
        });
    }


    /* =====================================================
       DOWNLOAD HANDLER
    ===================================================== */

    async function handleDownload(button) {
        const historyId = String(button?.dataset?.historyId || "").trim();
        if (!historyId) return;

        const item = getHistoryById(historyId);
        if (!item) {
            notifyDownloadFailure("Data history tidak ditemukan.");
            return;
        }

        const url = getResultUrl(item);
        if (!url) {
            notifyDownloadFailure("Hasil tidak tersedia atau sudah kedaluwarsa untuk diunduh.");
            return;
        }

        const filename = buildDownloadFilename(item);
        const originalHTML = button.innerHTML;
        const isNativeApp = Boolean(
            window.GENZAndroidDownloads ||
            window.Capacitor?.isNativePlatform?.() ||
            window.Capacitor?.Plugins
        );

        button.disabled = true;
        button.innerHTML = '<span class="download-icon">⏳</span> Menyiapkan...';

        notifyDownloadStart(filename);

        if (isNativeApp) {
            try {
                const bridge = window.GENZAndroidDownloads;
                if (typeof bridge?.downloadUrl !== "function") {
                    console.warn(
                        "[download] Android bridge unavailable; falling back to a direct URL download."
                    );
                    triggerDirectDownload(url, filename);
                    button.innerHTML =
                        '<span class="download-icon">⬇</span> Permintaan unduhan dikirim';
                    notifyDownloadFallback(filename);
                    setTimeout(() => {
                        button.innerHTML = originalHTML;
                        button.disabled = false;
                    }, 3500);
                    return;
                }

                bridge.downloadUrl(
                    url,
                    filename,
                    "",
                    window.location.href,
                    navigator.userAgent
                );
                button.innerHTML = '<span class="download-icon">✓</span> Unduhan dimulai';
                button.classList.add("download-button-success");
                notifyDownloadSuccess("Unduhan dimulai", filename);
                setTimeout(() => {
                    button.innerHTML = originalHTML;
                    button.classList.remove("download-button-success");
                    button.disabled = false;
                }, 2500);
            } catch (error) {
                console.error("[download] Android download failed:", error);
                notifyDownloadFailure(
                    error?.message || "Silakan coba kembali.",
                    () => handleDownload(button)
                );
                button.innerHTML = originalHTML;
                button.disabled = false;
            }
            return;
        }

        try {
            const res = await fetch(url, { mode: "cors" });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const blob = await res.blob();
            if (typeof window.GENZMobileDownload === "function") {
                const saved = await window.GENZMobileDownload(blob, filename);
                if (saved === false) {
                    throw new Error("File tidak berhasil disimpan di perangkat.");
                }

                if (saved === true) {
                    button.innerHTML = '<span class="download-icon">✓</span> Tersimpan di Downloads';
                    button.classList.add("download-button-success");
                    notifyDownloadSuccess("Tersimpan di Downloads", filename);
                    setTimeout(() => {
                        button.innerHTML = originalHTML;
                        button.classList.remove("download-button-success");
                        button.disabled = false;
                    }, 2500);
                    return;
                }

            }

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

            notifyDownloadSuccess("Berhasil diunduh", filename);

            setTimeout(() => {
                button.innerHTML = originalHTML;
                button.classList.remove("download-button-success");
                button.disabled = false;
            }, 2500);

            return;

        } catch (err) {
            console.warn("[download] Blob fetch failed, fallback to direct:", err);
        }

        try {
            triggerDirectDownload(url, filename);

            button.innerHTML = isNativeApp
                ? '<span class="download-icon">⬇</span> Permintaan unduhan dikirim'
                : '<span class="download-icon">↗</span> Membuka unduhan';

            notifyDownloadFallback(filename);

            setTimeout(() => {
                button.innerHTML = originalHTML;
                button.disabled = false;
            }, 2500);

        } catch (err2) {
            console.error("[download] Fallback failed:", err2);
            notifyDownloadFailure(
                err2?.message || "Silakan coba kembali.",
                () => handleDownload(button)
            );
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

        const dynamicCost = await loadUpscaleVideoCost();
        const costPromptText = dynamicCost !== null
            ? `Akan menggunakan ${formatCredits(dynamicCost)} credit.`
            : "Biaya credit mengikuti tarif Upscale Video aktif.";

        if (!window.confirm(`Upscale video ini ke 2K?\n${costPromptText}`)) {
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

    async function handleUpscaleStatus(button, cancel = false) {
        const historyId = String(button?.dataset?.historyId || "").trim();
        if (!historyId) return;

        if (
            cancel &&
            !window.confirm("Batalkan proses upscale ini? Credit akan dikembalikan.")
        ) {
            return;
        }

        const originalHTML = button.innerHTML;
        button.disabled = true;
        button.innerHTML = cancel ? "Membatalkan..." : "Memeriksa...";

        try {
            const client = App.state?.supabaseClient || window.GENZ_SUPABASE;
            if (!client) throw new Error("Supabase client tidak tersedia");

            const { data: sessionData, error: sessionError } =
                await client.auth.getSession();
            if (sessionError) throw sessionError;

            const token = sessionData?.session?.access_token;
            if (!token) throw new Error("Sesi login tidak ditemukan");

            const response = await fetch("/api/generate", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    action: "upscale-video-status",
                    history_id: historyId,
                    cancel
                })
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(
                    payload?.error || `Gagal memeriksa status (${response.status})`
                );
            }

            if (typeof App.loadHistory === "function") {
                await App.loadHistory({ silent: true });
            }
            if (typeof App.refreshOpenModal === "function") {
                App.refreshOpenModal();
            }

            if (cancel && payload?.status === "cancelled") {
                alert("Upscale dibatalkan dan credit telah dikembalikan.");
            } else if (cancel) {
                alert("GitHub belum mengonfirmasi pembatalan. Periksa status kembali beberapa saat lagi.");
            } else if (!cancel && payload?.run_found === false && payload?.terminal !== true) {
                alert("Run GitHub belum ditemukan. Status History belum diubah.");
            } else if (
                !cancel &&
                payload?.run_conclusion === "success" &&
                payload?.terminal !== true
            ) {
                alert("GitHub melaporkan proses selesai, tetapi hasil belum tercatat di History. Silakan coba periksa kembali.");
            }
        } catch (error) {
            console.error("[upscale-status] Error:", error);
            alert(error?.message || "Gagal memperbarui status upscale.");
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

            const refreshUpscaleBtn =
                event.target.closest("[data-action='refresh-upscale-status']");
            if (refreshUpscaleBtn) {
                event.preventDefault();
                handleUpscaleStatus(refreshUpscaleBtn);
                return;
            }

            const cancelUpscaleBtn =
                event.target.closest("[data-action='cancel-upscale']");
            if (cancelUpscaleBtn) {
                event.preventDefault();
                handleUpscaleStatus(cancelUpscaleBtn, true);
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

        if (
            getModelId(item).toLowerCase() === "upscale-video" &&
            ["processing", "pending"].includes(normalizeStatus(item.status))
        ) {
            const createdAt = Date.parse(item.created_at || item.createdAt || "");
            if (Number.isFinite(createdAt) && Date.now() - createdAt > 55 * 60 * 1000) {
                const statusButton = modal.querySelector(
                    "[data-action='refresh-upscale-status']"
                );
                if (statusButton) {
                    window.setTimeout(() => {
                        if (statusButton.isConnected) {
                            handleUpscaleStatus(statusButton);
                        }
                    }, 0);
                }
            }
        }

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
        /*
           Jangan biarkan error kecil (mis. timer runtime) membuat
           tombol × terasa "mati". Semua langkah dibungkus try/catch
           supaya modal SELALU tertutup.
        */
        try {
            stopModalRuntime();
        } catch (error) {
            console.warn("[modal] stopModalRuntime gagal:", error);
        }

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

        try {
            getState().currentModalHistoryId = null;
        } catch (error) {
            console.warn("[modal] reset state modal gagal:", error);
        }
    }

    App.closeDetailModal = closeDetailModal;


    /* =====================================================
       FALLBACK KLIK TOMBOL ×
       -----------------------------------------------------
       Listener delegasi di document memastikan tombol tutup
       tetap berfungsi walau elemen di-render ulang atau
       listener per-elemen hilang.
    ===================================================== */

    if (
        typeof document !== "undefined" &&
        !document.documentElement.dataset.genzModalCloseFallback
    ) {
        document.documentElement.dataset.genzModalCloseFallback = "on";

        document.addEventListener(
            "click",
            function (event) {
                const closer = event.target?.closest?.(
                    "#closeModal, [data-close-modal]"
                );

                if (!closer) return;

                event.preventDefault();
                closeDetailModal();
            },
            true
        );
    }


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
