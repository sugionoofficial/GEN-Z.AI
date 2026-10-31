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

    const GENERATED_IMAGE_MODEL_IDS = [
        "opus-gpt-image-2.5-flare",
        "opus-gpt-image-2.5-sunburst",
        "opus-seedream-5.0-pro",
        "opus-nano-banana-2",
        "opus-nano-banana-pro"
    ];

    function isImageHistoryItem(item) {
        const mediaType = String(item?.media_type || item?.mediaType || "").trim().toLowerCase();
        if (mediaType === "image") return true;
        const modelId = String(item?.model_id || item?.modelId || "").trim().toLowerCase();
        return modelId === "upscale-photo" || GENERATED_IMAGE_MODEL_IDS.indexOf(modelId) !== -1;
    }

    function isImageResultUrl(url) {

        if (!url) {
            return false;
        }

        const raw =
            String(url)
                .trim()
                .toLowerCase();

        if (raw.indexOf("data:image/") === 0) {
            return true;
        }

        const clean =
            raw
                .split("?")[0]
                .split("#")[0];

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


    function isVisionHistoryItem(item) {

        if (
            typeof window.GENZRegenerate?.isVisionTask ===
            "function"
        ) {
            return window.GENZRegenerate.isVisionTask(item);
        }

        const taskId =
            getTaskId(item).toLowerCase();

        const providers = [
            item?.provider_id,
            item?.provider_name,
            item?.provider
        ].map(
            value =>
                String(value || "")
                    .trim()
                    .toLowerCase()
        );

        return taskId.startsWith("vision-") ||
            providers.some(
                provider =>
                    /(^|[^a-z])vision([^a-z]|$)/.test(provider)
            );
    }


    App.isVisionHistoryItem =
        isVisionHistoryItem;


    function isNonRegenerableHistoryItem(item) {
        if (isVisionHistoryItem(item)) {
            return true;
        }

        const taskId =
            getTaskId(item).toLowerCase();
        const modelId =
            String(item?.model_id || item?.modelId || "")
                .trim()
                .toLowerCase();
        const providerId =
            String(item?.provider_id || "")
                .trim()
                .toLowerCase();

        return Boolean(
            item?.upscale_of_history_id ||
            item?.upscale_source_url ||
            item?.upscale_target ||
            providerId === "genzai-internal" ||
            taskId.startsWith("feature:") ||
            taskId.startsWith("upscale_") ||
            taskId.startsWith("upscale-photo_") ||
            modelId === "metadata-cleaner" ||
            modelId === "prompt-studio" ||
            modelId === "upscale-photo" ||
            modelId === "upscale-video" ||
            modelId === "vision-image" ||
            modelId === "vision-video"
        );
    }


    App.isNonRegenerableHistoryItem =
        isNonRegenerableHistoryItem;


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

        const raw = String(
            item?.error_message ||
            item?.error ||
            item?.message ||
            ""
        ).trim();

        if (
            /\b(?:Output|Input)?AudioSensitiveContentDetected\b/i.test(raw) ||
            /\b(?:output|input)?\s*audio\s+may\s+be\s+related\s+to\s+copyright\b/i.test(raw) ||
            (/\baudio\b/i.test(raw) && /\bcopyright\s+restrictions?\b/i.test(raw))
        ) {
            return "audio pada video/lagu yang anda upload terkena copyright, silahkan gunakan video/lagu yang lain, atau generate tanpa audio";
        }

        return raw;
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

    /* =================================================
       REFERENCE THUMBNAIL
       -------------------------------------------------
       Saat generation masih diproses, hasil belum ada.
       Yang bisa ditampilkan adalah referensi yang dipakai
       (image_reference_url / video_reference_url).
    ================================================= */

    function isSignedUrlAlreadyExpired(url) {
        if (!url) return false;
        const expiresAt = getSignedLinkExpiresAt(url);
        return expiresAt > 0 && Date.now() >= expiresAt;
    }

    function getReferenceThumbnail(item) {

        const rawImage =
            String(
                item?.image_reference_url || ""
            ).trim();

        const rawVideo =
            String(
                item?.video_reference_url || ""
            ).trim();

        const imageUrl =
            rawImage && !isSignedUrlAlreadyExpired(rawImage) ? rawImage : "";

        const videoUrl =
            rawVideo && !isSignedUrlAlreadyExpired(rawVideo) ? rawVideo : "";

        if (!imageUrl && !videoUrl) {

            return null;
        }

        return {
            url: imageUrl || videoUrl,
            isVideo: !imageUrl && Boolean(videoUrl)
        };
    }


    function getProcessingThumbnailHtml(
        item
    ) {

        const reference =
            getReferenceThumbnail(
                item
            );

        const referenceHtml =
            reference
                ? `
                    <div
                        class="thumbnail-reference"
                        aria-label="Referensi generation"
                    >

                        ${
                            reference.isVideo
                                ? `
                                    <video
                                        src="${escapeHtml(reference.url)}"
                                        muted
                                        playsinline
                                        preload="metadata"
                                    ></video>
                                `
                                : `
                                    <img
                                        src="${escapeHtml(reference.url)}"
                                        alt="Referensi"
                                        loading="lazy"
                                    >
                                `
                        }

                        <span class="thumbnail-reference-label">
                            REF
                        </span>

                    </div>
                `
                : "";

        return `
            <div class="thumbnail-processing-wrap">

                <div
                    class="history-thumbnail thumbnail-processing"
                    aria-label="Generation sedang diproses"
                >

                    <div class="thumbnail-loader"></div>

                    <span class="thumbnail-processing-label">
                        GENERATING
                    </span>

                </div>

                ${referenceHtml}

            </div>
        `;
    }


    /* =====================================================
       RETENSI MEDIA — 24 JAM
       -----------------------------------------------------
       Media hasil yang disimpan di Supabase Storage hanya
       bertahan 24 jam (dihapus oleh cron retensi). Baris
       riwayat tetap ada, tetapi thumbnail ditandai
       EXPIRED dan video tidak bisa diputar lagi.
    ===================================================== */

    const MEDIA_RETENTION_MS =
        24 * 60 * 60 * 1000;

    const MANAGED_MEDIA_PREFIXES = [
        "/storage/v1/object/public/dashboard-videos/",
        "/storage/v1/object/public/dashboard-upscales/",
        "/storage/v1/object/sign/dashboard-videos/",
        "/storage/v1/object/sign/dashboard-upscales/",
        "/storage/v1/object/authenticated/dashboard-videos/",
        "/storage/v1/object/authenticated/dashboard-upscales/",
        /* Bucket privat (output upscale baru) */
        "/storage/v1/object/sign/user-uploads/",
        "/storage/v1/object/authenticated/user-uploads/"
    ];

    function isManagedMediaUrl(
        url
    ) {

        const value =
            String(
                url ||
                ""
            );

        if (!value) {
            return false;
        }

        return MANAGED_MEDIA_PREFIXES.some(
            function (prefix) {
                return value.includes(
                    prefix
                );
            }
        );
    }

    /**
     * Waktu kedaluwarsa yang tertulis di dalam URL bertanda tangan
     * (mis. `?Expires=1793089153` pada URL OSS provider).
     *
     * Nilainya dalam DETIK. Kalau dikira milidetik, semua tautan
     * akan dianggap kedaluwarsa sejak awal — itu bug yang harus
     * dijaga tes.
     */
    function parseIsoCompactUtc(raw) {
        const match =
            /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/i.exec(
                String(raw || "").trim()
            );

        if (!match) {
            return 0;
        }

        return Date.UTC(
            Number(match[1]),
            Number(match[2]) - 1,
            Number(match[3]),
            Number(match[4]),
            Number(match[5]),
            Number(match[6])
        );
    }

    function getSignedLinkExpiresAt(
        url
    ) {

        const value =
            String(
                url ||
                ""
            )
                .trim();

        if (!value) {
            return 0;
        }

        let parsed;

        try {

            parsed =
                new URL(
                    value
                );

        } catch (
            parseError
        ) {

            return 0;
        }

        /* 1. Parameter langsung (?Expires=... / ?expires=...) — OSS, S3 v2, CloudFront. */
        const raw =
            parsed.searchParams.get(
                "Expires"
            ) ||
            parsed.searchParams.get(
                "expires"
            );

        if (raw) {
            const seconds = Number(raw);
            if (Number.isFinite(seconds) && seconds > 0) {
                return seconds * 1000;
            }
        }

        /* 2. Token CDN Akamai / Fastly / Opus:
              ?hdnts=Expires=1793215842~FullPath~Signature=...
              ?hdnea=st=1793212234~exp=1793215842~acl=/*~hmac=... */
        const tokenFields = ["hdnts", "hdnea", "__token__"];

        for (let i = 0; i < tokenFields.length; i += 1) {
            const token = parsed.searchParams.get(tokenFields[i]);
            if (!token) continue;

            const match =
                /(?:^|[~&])(?:Expires|expires|exp)=(\d{9,11})(?:[~&]|$)/.exec(
                    token
                );

            if (match) {
                const seconds = Number(match[1]);
                if (Number.isFinite(seconds) && seconds > 0) {
                    return seconds * 1000;
                }
            }
        }

        /* 3. AWS S3 / R2 / GCS SigV4 (?X-Amz-Date=YYYYMMDDTHHMMSSZ&X-Amz-Expires=3600). */
        const amzDate =
            parsed.searchParams.get("X-Amz-Date") ||
            parsed.searchParams.get("x-amz-date") ||
            parsed.searchParams.get("X-Goog-Date") ||
            parsed.searchParams.get("x-goog-date");

        const amzDuration =
            parsed.searchParams.get("X-Amz-Expires") ||
            parsed.searchParams.get("x-amz-expires") ||
            parsed.searchParams.get("X-Goog-Expires") ||
            parsed.searchParams.get("x-goog-expires");

        if (amzDate && amzDuration) {
            const startMs = parseIsoCompactUtc(amzDate);
            const ttlSeconds = Number(amzDuration);

            if (startMs > 0 && Number.isFinite(ttlSeconds) && ttlSeconds > 0) {
                return startMs + ttlSeconds * 1000;
            }
        }

        return 0;
    }


    /**
     * Alasan media hasil tidak bisa dibuka lagi.
     *
     *   "deleted" — berkas hasil sudah dihapus dari penyimpanan
     *               (mis. cron retensi 24 jam).
     *   "link"    — berkas mungkin masih ada, tetapi tautan
     *               bertanda tangan dari provider sudah lewat
     *               masa berlakunya.
     *   ""        — media masih bisa dibuka.
     *
     * Dibedakan supaya UI tidak menulis "dihapus setelah 24 jam"
     * untuk kasus yang sebenarnya cuma tautannya kedaluwarsa.
     */
    function getMediaExpiryReason(
        item
    ) {

        if (
            !item ||
            typeof item !== "object"
        ) {
            return "";
        }

        const url =
            getResultUrl(
                item
            );

        if (!url) {
            return "";
        }

        /*
         * history-data.js menandai `media_expired` hanya ketika
         * signed URL HASIL gagal dibuat (berkas sudah dihapus).
         */
        if (
            item.media_expired === true
        ) {

            return "deleted";
        }

        const linkExpiresAt =
            getSignedLinkExpiresAt(
                url
            );

        if (
            linkExpiresAt > 0 &&
            Date.now() >= linkExpiresAt
        ) {

            return "link";
        }

        /*
         * Retensi 24 jam hanya berlaku untuk media yang kita kelola
         * sendiri (Supabase Storage). URL eksternal milik provider
         * tidak pernah dihapus oleh cron kita.
         */
        if (
            !isManagedMediaUrl(
                url
            )
        ) {
            return "";
        }

        const created =
            new Date(
                item?.created_at ||
                item?.createdAt ||
                ""
            ).getTime();

        if (
            !Number.isFinite(created) ||
            created <= 0
        ) {
            return "";
        }

        return (
            Date.now() - created >=
            MEDIA_RETENTION_MS
        )
            ? "deleted"
            : "";
    }


    function isExpiredMedia(
        item
    ) {

        return Boolean(
            getMediaExpiryReason(
                item
            )
        );
    }

    App.MEDIA_RETENTION_MS =
        MEDIA_RETENTION_MS;

    App.isManagedMediaUrl =
        isManagedMediaUrl;

    App.isExpiredMedia =
        isExpiredMedia;

    App.getMediaExpiryReason =
        getMediaExpiryReason;

    App.getSignedLinkExpiresAt =
        getSignedLinkExpiresAt;


    function getSuccessThumbnailHtml(
        item
    ) {

        const url =
            getResultUrl(
                item
            );

        if (!url) {
            const taskIdLower = getTaskId(item).toLowerCase();
            const modelIdLower = getModelId(item).toLowerCase();
            let icon = "🎬";
            let ariaLabel = "Hasil belum tersedia";
            let isTextFeature = false;

            if (
                modelIdLower === "metadata-cleaner" ||
                taskIdLower.startsWith("feature:metadata_cleaner:")
            ) {
                icon = "🧹";
                ariaLabel = "AI Metadata Cleaner selesai";
                isTextFeature = true;
            } else if (
                modelIdLower === "prompt-studio" ||
                taskIdLower.startsWith("feature:prompt_studio:")
            ) {
                icon = "✨";
                ariaLabel = "Studio Prompt selesai";
                isTextFeature = true;
            } else if (
                modelIdLower === "vision-video" ||
                taskIdLower.startsWith("vision-video-")
            ) {
                icon = "🎞️";
                ariaLabel = "Vision Video selesai";
                isTextFeature = true;
            } else if (
                modelIdLower === "vision-image" ||
                isVisionHistoryItem(item)
            ) {
                icon = "👁️";
                ariaLabel = "Vision Image selesai";
                isTextFeature = true;
            }

            return `
                <div
                    class="history-thumbnail thumbnail-empty"
                    aria-label="${escapeHtml(ariaLabel)}"
                >
                    <span class="thumbnail-empty-icon">
                        ${escapeHtml(icon)}
                    </span>
                    ${
                        isTextFeature
                            ? `<span class="thumbnail-success">SUCCESS</span>`
                            : ""
                    }
                </div>
            `;
        }

        /*
         * File media sudah dihapus cron retensi (lebih dari 24 jam).
         * Thumbnail tidak lagi memuat video supaya browser tidak
         * menembak URL yang sudah tidak ada.
         */

        if (isExpiredMedia(item)) {

            return `
                <div
                    class="history-thumbnail thumbnail-expired"
                    aria-label="Media expired"
                >

                    <span class="thumbnail-expired-icon">
                        ⏳
                    </span>

                    <span class="thumbnail-expired-label">
                        EXPIRED
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

        if (isImageResultUrl(url) || isImageHistoryItem(item)) {

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
                    muted
                    playsinline
                    preload="none"
                    class="thumbnail-media"
                    data-thumb-src="${safeUrl}"
                    data-thumb-frame="0.2"
                    aria-hidden="true"
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
                    muted
                    playsinline
                    preload="none"
                    class="thumbnail-media"
                    data-thumb-src="${safeUrl}"
                    data-thumb-frame="0.2"
                    aria-hidden="true"
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
                return getProcessingThumbnailHtml(
                    item
                );

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
        const status =
            normalizeStatus(item?.status);
        const isRefunded =
            Boolean(item?.credit_refunded === true) &&
            credits > 0 &&
            (status === "failed" || status === "cancelled");

        return `
            <span class="history-credit">
                ${escapeHtml(
                    formatCredits(
                        credits
                    )
                )}
                ${
                    isRefunded
                        ? `<small style="display:block;color:#7ef0b4;font-size:10px;font-weight:700;line-height:1.2;margin-top:2px;">Refund</small>`
                        : ""
                }
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

                    ${
                        isNonRegenerableHistoryItem(item)
                            ? ""
                            : `
                                <button
                                    type="button"
                                    class="history-regenerate-button"
                                    data-action="regenerate"
                                    data-history-id="${safeId}"
                                    title="Buka kembali parameter di halaman Generate"
                                >
                                    Regenerate
                                </button>
                            `
                    }

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

        if (
            typeof requestAnimationFrame ===
            "function"
        ) {

            requestAnimationFrame(
                hydrateThumbnailVideos
            );

        } else {

            hydrateThumbnailVideos();

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
       VIDEO THUMBNAIL POSTER
       -----------------------------------------------------
       Sebelumnya thumbnail video memakai preload="none" tanpa
       frame, jadi kotaknya tampil hitam/kosong dan user tidak
       tahu video mana yang berhasil.

       Sekarang setiap thumbnail video memuat frame pertama
       (#t=0.2) HANYA saat masuk viewport, supaya tidak memicu
       ratusan request ke file .mp4 sekaligus.
    ===================================================== */

    const THUMBNAIL_POSTER_TIME = 0.2;

    let thumbnailObserver = null;


    function buildThumbnailPosterUrl(url, seconds) {

        const clean =
            String(url || "").trim();

        if (!clean) {
            return "";
        }

        /*
         * Fragment #t= hanya untuk thumbnail. Saat video diputar
         * (inline / modal) URL asli tetap dipakai, jadi playback
         * tetap mulai dari awal.
         */

        const base =
            clean.split("#")[0];

        const time =
            Number(seconds);

        const target =
            Number.isFinite(time) && time > 0
                ? time
                : THUMBNAIL_POSTER_TIME;

        return base + "#t=" + target;
    }


    function applyThumbnailPosterFrame(video) {

        try {

            const duration =
                Number(video.duration);

            const target =
                Number.isFinite(duration) && duration > 0
                    ? Math.min(THUMBNAIL_POSTER_TIME, duration / 2)
                    : THUMBNAIL_POSTER_TIME;

            if (
                Math.abs(
                    Number(video.currentTime || 0) - target
                ) > 0.05
            ) {
                video.currentTime = target;
            }

        } catch (_error) {
            /* Browser tanpa dukungan seek: biarkan frame awal. */
        }
    }


    function hydrateThumbnailVideo(video) {

        if (!video) {
            return false;
        }

        const pendingSrc =
            video.dataset
                ? video.dataset.thumbSrc
                : "";

        if (pendingSrc) {

            delete video.dataset.thumbSrc;

            video.preload =
                "metadata";

            video.src =
                buildThumbnailPosterUrl(
                    pendingSrc,
                    video.dataset.thumbFrame
                );
        }

        if (!video.getAttribute("src")) {
            return false;
        }

        if (
            video.dataset.posterFrameBound !== "1"
        ) {

            video.dataset.posterFrameBound = "1";

            video.addEventListener(
                "loadedmetadata",
                function () {
                    applyThumbnailPosterFrame(video);
                },
                { once: true }
            );

            video.addEventListener(
                "error",
                function () {
                    const wrap =
                        typeof video.closest === "function"
                            ? video.closest(".history-thumbnail")
                            : null;
                    if (!wrap) return;
                    wrap.className = "history-thumbnail thumbnail-expired";
                    wrap.removeAttribute("data-video-url");
                    wrap.setAttribute("aria-label", "Media expired");
                    wrap.innerHTML =
                        '<span class="thumbnail-expired-icon">⏳</span>' +
                        '<span class="thumbnail-expired-label">EXPIRED</span>';
                },
                { once: true }
            );
        }

        if (video.readyState >= 1) {
            applyThumbnailPosterFrame(video);
        }

        return true;
    }


    function hydrateThumbnailVideos() {

        if (typeof document === "undefined") {
            return;
        }

        const videos =
            Array.prototype.slice.call(
                document.querySelectorAll(
                    ".history-thumbnail video[data-thumb-src]"
                )
            );

        if (!videos.length) {
            return;
        }

        if (
            typeof IntersectionObserver !==
            "function"
        ) {

            videos.forEach(
                hydrateThumbnailVideo
            );

            return;
        }

        /*
         * Observer lama di-disconnect supaya node hasil render
         * ulang tidak menumpuk di memori.
         */

        if (thumbnailObserver) {
            thumbnailObserver.disconnect();
        }

        thumbnailObserver =
            new IntersectionObserver(
                function (entries) {

                    entries.forEach(
                        function (entry) {

                            if (!entry.isIntersecting) {
                                return;
                            }

                            thumbnailObserver.unobserve(
                                entry.target
                            );

                            hydrateThumbnailVideo(
                                entry.target
                            );
                        }
                    );
                },
                {
                    rootMargin:
                        "200px 0px"
                }
            );

        videos.forEach(
            function (video) {
                thumbnailObserver.observe(video);
            }
        );
    }


    App.hydrateThumbnailVideo =
        hydrateThumbnailVideo;

    App.hydrateThumbnailVideos =
        hydrateThumbnailVideos;


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
                function () {

                    preloadThumbnailVideos();

                    hydrateThumbnailVideos();
                }
            );

        } else {

            preloadThumbnailVideos();

            hydrateThumbnailVideos();

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
