/* =========================================================
   GEN-Z.AI — STUDIO MEDSOS: POST & JADWALKAN VIDEO KE
   YOUTUBE / TIKTOK
   ---------------------------------------------------------
   File:
     admin-control/social-video-composer.js

   Melengkapi blok "Hubungkan YouTube & TikTok":
     1. Post manual  — terbitkan video sekarang ke akun
        YouTube/TikTok yang dicentang (`create_posts`
        publishNow).
     2. Auto post    — jadwalkan tayang; cron server
        (social-video-autopost-cron) menerbitkan tepat
        pada waktunya (`create_posts` scheduledFor).
     3. Antrean      — daftar posting + batalkan jadwal
        (`cancel_post`).

   Backend: /api/social-video-autopost (sama dengan blok
   koneksi). Token sesi tidak pernah disimpan di browser.
========================================================= */

(() => {
    "use strict";

    const ENDPOINT = "/api/social-video-autopost";
    const MAX_UPLOAD_BYTES = 180 * 1024 * 1024;
    const ALLOWED_EXT = ["mp4", "mov", "m4v", "webm"];

    const PLATFORM_LABEL = {
        youtube: "YouTube",
        tiktok: "TikTok",
        facebook: "Facebook"
    };

    /* Logo resmi tiap platform (path sederhana 24×24) supaya tiap baris
       riwayat posting langsung terbedakan medsosnya. */
    const PLATFORM_LOGOS = {
        youtube:
            '<svg viewBox="0 0 24 24" role="img" aria-label="Logo YouTube"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>',
        tiktok:
            '<svg viewBox="0 0 24 24" role="img" aria-label="Logo TikTok"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>',
        facebook:
            '<svg viewBox="0 0 24 24" role="img" aria-label="Logo Facebook"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>'
    };

    function platformLogo(platform) {
        const span = document.createElement("span");
        span.className = `svp-logo svp-logo--${platform || "facebook"}`;
        span.innerHTML = PLATFORM_LOGOS[platform] || PLATFORM_LOGOS.facebook;
        return span;
    }

    const STATUS_LABEL = {
        scheduled: "Terjadwal",
        processing: "Diproses",
        published: "Tayang",
        failed: "Gagal",
        cancelled: "Dibatalkan"
    };

    const $ = id => document.getElementById(id);

    const els = {
        section: null,
        message: null,
        refresh: null,
        accounts: null,
        accountsHint: null,
        historyWrap: null,
        uploadWrap: null,
        urlWrap: null,
        historySelect: null,
        file: null,
        url: null,
        preview: null,
        title: null,
        caption: null,
        hashtags: null,
        privacy: null,
        aiCaption: null,
        credit: null,
        schedule: null,
        publish: null,
        scheduleBtn: null,
        queue: null,
        queueSection: null,
        historyRefresh: null
    };

    const state = {
        busy: false,
        source: "history",
        loaded: false,
        accounts: [],
        posts: [],
        historyVideos: [],
        creditCost: 0,
        credits: 0,
        previewObjectUrl: ""
    };

    function client() {
        if (window.GENZ_SUPABASE) return window.GENZ_SUPABASE;
        if (window.supabaseClient) return window.supabaseClient;
        const cfg = window.GENZ_CONFIG || {};
        const key = cfg.SUPABASE_KEY || cfg.SUPABASE_ANON_KEY;
        if (!window.supabase?.createClient || !cfg.SUPABASE_URL || !key) {
            throw new Error("Konfigurasi Supabase tidak tersedia.");
        }
        window.GENZ_SUPABASE = window.supabase.createClient(cfg.SUPABASE_URL, key);
        return window.GENZ_SUPABASE;
    }

    async function sessionToken(force = false) {
        if (window.GENZSession?.ensureFreshSession) {
            const refreshed = await window.GENZSession.ensureFreshSession({ force });
            if (refreshed?.access_token) return refreshed.access_token;
        }
        const { data, error } = await client().auth.getSession();
        if (error) throw error;
        const token = data?.session?.access_token;
        if (!token) throw new Error("Sesi login tidak ditemukan. Silakan login ulang.");
        return token;
    }

    async function api(action, { method = "GET", body } = {}) {
        for (let attempt = 0; attempt < 2; attempt++) {
            const token = await sessionToken(attempt > 0);
            const response = await fetch(`${ENDPOINT}?action=${encodeURIComponent(action)}`, {
                method,
                headers: {
                    Authorization: `Bearer ${token}`,
                    ...(body ? { "Content-Type": "application/json" } : {})
                },
                ...(body ? { body: JSON.stringify(body) } : {})
            });
            const data = await response.json().catch(() => ({}));
            if (response.status === 401 && attempt === 0) continue;
            if (!response.ok || data?.success === false) {
                throw new Error(data?.error || `Permintaan gagal (HTTP ${response.status}).`);
            }
            return data;
        }
        throw new Error("Sesi login tidak valid. Silakan login ulang.");
    }

    function showMessage(text, tone = "info") {
        if (!els.message) return;
        els.message.hidden = !text;
        els.message.textContent = text || "";
        els.message.className = `notice ${tone}`.trim();
    }

    function setBusy(busy) {
        state.busy = busy;
        syncActionButtons();
        if (els.refresh) els.refresh.disabled = busy;
    }

    function activeAccounts() {
        return state.accounts.filter(account => (account.status || "active") === "active");
    }

    function selectedAccountIds() {
        if (!els.accounts) return [];
        return [...els.accounts.querySelectorAll("input[data-svp-account]:checked")]
            .map(input => input.value);
    }

    function selectedPlatforms() {
        if (!els.accounts) return [];
        return [...new Set(
            [...els.accounts.querySelectorAll("input[data-svp-account]:checked")]
                .map(input => input.dataset.svpPlatform)
        )];
    }

    function syncActionButtons() {
        const ready = Boolean(els.publish) && !state.busy && selectedAccountIds().length > 0;
        if (els.publish) els.publish.disabled = !ready;
        if (els.scheduleBtn) els.scheduleBtn.disabled = !ready;
        if (els.aiCaption) els.aiCaption.disabled = state.busy;
        updateCreditInfo();
    }

    function updateCreditInfo() {
        if (!els.credit) return;
        const count = selectedAccountIds().length;
        const unit = Number(state.creditCost) || 0;
        if (!count) {
            els.credit.textContent = unit > 0
                ? `Biaya per posting: ${unit} kredit per akun. Pilih minimal 1 akun tujuan.`
                : "Pilih minimal 1 akun tujuan.";
            return;
        }
        const total = unit * count;
        els.credit.textContent = unit > 0
            ? `Biaya: ${total} kredit (${unit} × ${count} akun). Saldo: ${state.credits} kredit.`
            : `Gratis (${count} akun dipilih).`;
    }

    /* ---------------------------------------------------------
       AKUN TUJUAN
       --------------------------------------------------------- */

    function accountLabel(account) {
        return account.account_name || account.account_handle || account.external_account_id || "Akun terhubung";
    }

    function renderAccounts() {
        if (!els.accounts) return;
        const list = activeAccounts();
        els.accounts.replaceChildren();

        if (list.length === 0) {
            const empty = document.createElement("div");
            empty.className = "empty";
            empty.textContent = "Belum ada akun terhubung. Gunakan blok \"Hubungkan YouTube & TikTok\" di atas.";
            els.accounts.appendChild(empty);
            if (els.accountsHint) {
                els.accountsHint.hidden = false;
                els.accountsHint.textContent = "Hubungkan dulu akun YouTube/TikTok Anda, lalu tekan \"Muat ulang\".";
            }
            syncActionButtons();
            return;
        }

        if (els.accountsHint) {
            els.accountsHint.hidden = true;
            els.accountsHint.textContent = "";
        }

        for (const account of list) {
            const label = document.createElement("label");
            label.className = "svp-account";

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.value = account.id;
            checkbox.dataset.svpAccount = "1";
            checkbox.dataset.svpPlatform = account.platform || "";
            checkbox.disabled = state.busy;
            checkbox.addEventListener("change", syncActionButtons);

            const meta = document.createElement("span");
            meta.className = "svp-account-meta";

            const name = document.createElement("span");
            name.className = "svp-account-name";
            name.textContent = accountLabel(account);

            const badge = document.createElement("span");
            badge.className = `svp-platform-badge ${account.platform || ""}`;
            badge.textContent = PLATFORM_LABEL[account.platform] || account.platform || "Medsos";

            meta.appendChild(name);
            meta.appendChild(badge);
            label.appendChild(checkbox);
            label.appendChild(meta);
            els.accounts.appendChild(label);
        }

        syncActionButtons();
    }

    /* ---------------------------------------------------------
       SUMBER VIDEO + PRATINJAU
       --------------------------------------------------------- */

    function isPrivateRef(value) {
        return /^supabase-private:\/\//i.test(String(value || ""));
    }

    function renderHistoryOptions() {
        if (!els.historySelect) return;
        els.historySelect.replaceChildren();

        if (state.historyVideos.length === 0) {
            const option = document.createElement("option");
            option.value = "";
            option.textContent = "Belum ada video selesai di Riwayat — unggah manual atau pakai URL.";
            els.historySelect.appendChild(option);
            return;
        }

        for (const video of state.historyVideos) {
            const option = document.createElement("option");
            option.value = video.id;
            option.textContent = video.label || video.title || video.video_ref;
            option.dataset.videoRef = video.video_ref || "";
            els.historySelect.appendChild(option);
        }
    }

    function clearPreview() {
        if (state.previewObjectUrl) {
            URL.revokeObjectURL(state.previewObjectUrl);
            state.previewObjectUrl = "";
        }
        if (els.preview) {
            els.preview.hidden = true;
            els.preview.removeAttribute("src");
        }
    }

    async function resolvePreviewUrl() {
        clearPreview();
        if (!els.preview) return;

        const source = state.source;
        let candidate = "";

        if (source === "history") {
            const option = els.historySelect?.selectedOptions?.[0];
            candidate = option?.dataset.videoRef || "";
            if (!candidate) return;
            if (isPrivateRef(candidate)) {
                const data = await api("sign_preview", { method: "POST", body: { videoRef: candidate } });
                candidate = data.previewUrl || "";
            }
        } else if (source === "upload") {
            const file = els.file?.files?.[0];
            if (!file) return;
            candidate = URL.createObjectURL(file);
            state.previewObjectUrl = candidate;
        } else if (source === "url") {
            candidate = String(els.url?.value || "").trim();
            if (!candidate) return;
        }

        if (!candidate) return;
        els.preview.src = candidate;
        els.preview.hidden = false;
    }

    function setSource(source) {
        state.source = ["history", "upload", "url"].includes(source) ? source : "history";
        if (els.historyWrap) els.historyWrap.hidden = state.source !== "history";
        if (els.uploadWrap) els.uploadWrap.hidden = state.source !== "upload";
        if (els.urlWrap) els.urlWrap.hidden = state.source !== "url";
        for (const tab of document.querySelectorAll("[data-svp-source]")) {
            tab.classList.toggle("is-active", tab.dataset.svpSource === state.source);
        }
        void resolvePreviewUrl().catch(() => {
            /* Pratinjau gagal tidak boleh memblokir posting. */
            clearPreview();
        });
    }

    function validateUploadFile(file) {
        if (!file) throw new Error("Pilih file video terlebih dahulu.");
        const ext = (file.name.split(".").pop() || "").toLowerCase();
        if (!ALLOWED_EXT.includes(ext)) {
            throw new Error("Format video harus MP4, MOV, M4V, atau WEBM.");
        }
        if (file.size > MAX_UPLOAD_BYTES) {
            throw new Error("Ukuran file video maksimal 180 MB.");
        }
        return file;
    }

    async function uploadVideoFile(file) {
        const data = await api("create_upload_url", {
            method: "POST",
            body: { fileName: file.name, fileSize: file.size }
        });

        let putUrl = String(data.uploadUrl || "");
        if (!putUrl) throw new Error("Gagal membuat tautan unggah video.");
        if (data.token && !putUrl.includes("token=")) {
            putUrl += (putUrl.includes("?") ? "&" : "?") + `token=${encodeURIComponent(data.token)}`;
        }

        const resp = await fetch(putUrl, {
            method: "PUT",
            headers: { "Content-Type": file.type || "video/mp4" },
            body: file
        });
        if (!resp.ok) {
            throw new Error(`Gagal mengunggah video ke server (HTTP ${resp.status}).`);
        }

        if (!data.storageRef) throw new Error("Server tidak mengembalikan lokasi video.");
        return { videoRef: data.storageRef, videoSourceType: "upload" };
    }

    async function resolveVideoTarget() {
        if (state.source === "upload") {
            const file = validateUploadFile(els.file?.files?.[0]);
            return await uploadVideoFile(file);
        }

        if (state.source === "url") {
            const raw = String(els.url?.value || "").trim();
            if (!raw) throw new Error("Isi URL video terlebih dahulu.");
            const parsed = new URL(raw);
            if (parsed.protocol !== "https:") throw new Error("URL video harus https://");
            return { videoRef: parsed.toString(), videoSourceType: "url" };
        }

        const option = els.historySelect?.selectedOptions?.[0];
        const videoRef = option?.dataset.videoRef || "";
        if (!videoRef) throw new Error("Pilih video dari Riwayat, unggah file, atau isi URL video.");
        return { videoRef, videoSourceType: "history" };
    }

    /* ---------------------------------------------------------
       POST MANUAL & AUTOPOST
       --------------------------------------------------------- */

    function buildPostPayload(videoTarget, extra = {}) {
        return {
            accountIds: selectedAccountIds(),
            videoRef: videoTarget.videoRef,
            videoSourceType: videoTarget.videoSourceType,
            title: String(els.title?.value || "").trim(),
            caption: String(els.caption?.value || "").trim(),
            hashtags: String(els.hashtags?.value || "").trim(),
            privacyLevel: String(els.privacy?.value || "public"),
            ...extra
        };
    }

    async function submitPost(extra, confirmText) {
        if (state.busy) return;
        const accountIds = selectedAccountIds();
        if (accountIds.length === 0) {
            showMessage("Pilih minimal 1 akun tujuan (YouTube/TikTok) yang sudah terhubung.", "error");
            return;
        }

        setBusy(true);
        showMessage("Menyiapkan video…");
        try {
            const videoTarget = await resolveVideoTarget();

            const unit = Number(state.creditCost) || 0;
            const total = unit * accountIds.length;
            if (total > 0 && !window.confirm(`${confirmText} Biaya: ${total} kredit (${unit} × ${accountIds.length} akun). Lanjutkan?`)) {
                showMessage("Dibatalkan.");
                setBusy(false);
                return;
            }

            showMessage("Mengirim ke server…");
            const data = await api("create_posts", {
                method: "POST",
                body: buildPostPayload(videoTarget, extra)
            });

            state.posts = Array.isArray(data.posts) ? data.posts : state.posts;
            if (typeof data.creditsRemaining === "number") state.credits = data.creditsRemaining;
            renderQueue();
            updateCreditInfo();

            if (data.mode === "scheduled") {
                showMessage(`${data.scheduledCount} posting dijadwalkan untuk tayang otomatis.`, "success");
            } else {
                const ok = Number(data.succeeded) || 0;
                const fail = Number(data.failed) || 0;
                showMessage(fail > 0
                    ? `Selesai: ${ok} akun berhasil, ${fail} gagal. Lihat detail di antrean.`
                    : `Berhasil diterbitkan ke ${ok} akun.`, ok > 0 ? "success" : "error");
            }
        } catch (error) {
            showMessage(error.message || "Gagal mengirim posting.", "error");
        } finally {
            setBusy(false);
        }
    }

    function publishNow() {
        const count = selectedAccountIds().length;
        void submitPost(
            { publishNow: true },
            `Terbitkan video ke ${count} akun sekarang?`
        );
    }

    function schedulePost() {
        const raw = String(els.schedule?.value || "").trim();
        if (!raw) {
            showMessage("Isi tanggal & jam tayang untuk autopost, atau gunakan \"Post sekarang\".", "error");
            return;
        }
        const parsed = Date.parse(raw);
        if (!Number.isFinite(parsed) || parsed <= Date.now() + 60_000) {
            showMessage("Jadwal harus minimal 1 menit di masa depan (waktu perangkat Anda).", "error");
            return;
        }
        const count = selectedAccountIds().length;
        const when = new Date(parsed).toLocaleString("id-ID");
        void submitPost(
            { scheduledFor: new Date(parsed).toISOString() },
            `Jadwalkan autopost ke ${count} akun pada ${when}?`
        );
    }

    /* ---------------------------------------------------------
       CAPTION AI
       --------------------------------------------------------- */

    async function aiCaption() {
        if (state.busy) return;
        setBusy(true);
        showMessage("Menulis caption dengan AI…");
        try {
            const data = await api("generate_ai_caption", {
                method: "POST",
                body: {
                    topic: String(els.title?.value || els.caption?.value || "").trim(),
                    platforms: selectedPlatforms()
                }
            });
            const copy = data.copy || {};
            if (copy.title && els.title) els.title.value = copy.title;
            if (copy.caption && els.caption) els.caption.value = copy.caption;
            if (copy.hashtags && els.hashtags) els.hashtags.value = copy.hashtags;
            showMessage("Caption AI siap. Silakan sunting bila perlu.", "success");
        } catch (error) {
            showMessage(error.message || "Gagal membuat caption AI.", "error");
        } finally {
            setBusy(false);
        }
    }

    /* ---------------------------------------------------------
       ANTREAN / RIWAYAT POSTING
       --------------------------------------------------------- */

    function formatWhen(iso) {
        if (!iso) return "";
        const parsed = Date.parse(iso);
        if (!Number.isFinite(parsed)) return "";
        return new Date(parsed).toLocaleString("id-ID");
    }

    function renderQueue() {
        /* Antrean/riwayat YouTube/TikTok sengaja TIDAK dirender di kartu
           composer, melainkan di blok "Riwayat pembuatan & posting"
           (#svh-list) — sama seperti riwayat Facebook. */
        if (!els.queue) return;
        els.queue.replaceChildren();

        if (state.posts.length === 0) {
            const empty = document.createElement("div");
            empty.className = "empty";
            empty.textContent = "Belum ada posting YouTube/TikTok. Jadwal dan hasilnya tampil di sini.";
            els.queue.appendChild(empty);
            return;
        }

        for (const post of state.posts) {
            const account = state.accounts.find(item => item.id === post.account_id);
            const item = document.createElement("div");
            item.className = "item svp-post-item";

            const info = document.createElement("div");
            info.className = "svp-post-info";

            const head = document.createElement("span");
            head.className = "svp-post-title";
            /* Logo medsos dulu — pembeda utama tiap baris riwayat. */
            head.appendChild(platformLogo(post.platform));
            const badge = document.createElement("span");
            badge.className = `svp-platform-badge ${post.platform || ""}`;
            badge.textContent = PLATFORM_LABEL[post.platform] || post.platform || "Medsos";
            head.appendChild(badge);
            head.appendChild(document.createTextNode(` ${post.title || "(tanpa judul)"}`));

            const meta = document.createElement("span");
            meta.className = "svp-post-meta";
            const bits = [];
            if (account) bits.push(accountLabel(account));
            if (post.status === "scheduled" && post.scheduled_for) bits.push(`Tayang: ${formatWhen(post.scheduled_for)}`);
            if (post.published_at) bits.push(`Tayang: ${formatWhen(post.published_at)}`);
            meta.textContent = bits.join(" · ");

            const status = document.createElement("span");
            status.className = `svp-status ${post.status || ""}`;
            status.textContent = STATUS_LABEL[post.status] || post.status || "-";

            info.appendChild(head);
            info.appendChild(meta);
            info.appendChild(status);

            if (post.error_message) {
                const err = document.createElement("span");
                err.className = "svp-post-error";
                err.textContent = post.error_message;
                info.appendChild(err);
            }

            item.appendChild(info);

            if (post.status === "scheduled") {
                const cancel = document.createElement("button");
                cancel.type = "button";
                cancel.className = "btn small danger";
                cancel.textContent = "Batalkan";
                cancel.disabled = state.busy;
                cancel.addEventListener("click", () => cancelScheduledPost(post));
                item.appendChild(cancel);
            }

            els.queue.appendChild(item);
        }
    }

    async function cancelScheduledPost(post) {
        if (state.busy || !post?.id) return;
        if (!window.confirm("Batalkan jadwal autopost ini?")) return;
        setBusy(true);
        try {
            const data = await api("cancel_post", {
                method: "POST",
                body: { postId: post.id }
            });
            state.posts = Array.isArray(data.posts) ? data.posts : state.posts;
            renderQueue();
            showMessage(data.message || "Jadwal berhasil dibatalkan.", "success");
        } catch (error) {
            showMessage(error.message || "Gagal membatalkan jadwal.", "error");
        } finally {
            setBusy(false);
        }
    }

    /* ---------------------------------------------------------
       MUAT DATA & INISIALISASI
       --------------------------------------------------------- */

    async function load() {
        setBusy(true);
        try {
            const data = await api("bootstrap");
            state.accounts = Array.isArray(data.accounts) ? data.accounts : [];
            state.posts = Array.isArray(data.posts) ? data.posts : [];
            state.historyVideos = Array.isArray(data.historyVideos) ? data.historyVideos : [];
            state.creditCost = Number(data.creditCost) || 0;
            state.credits = Number(data.viewer?.credits) || 0;
            state.loaded = true;
            renderAccounts();
            renderHistoryOptions();
            renderQueue();
            updateCreditInfo();
        } catch (error) {
            showMessage(error.message || "Gagal memuat data post YouTube/TikTok.", "error");
        } finally {
            setBusy(false);
        }
    }

    function init() {
        els.section = $("social-video-post");
        if (!els.section) return;
        els.message = $("svp-message");
        els.refresh = $("svp-refresh");
        els.accounts = $("svp-accounts");
        els.accountsHint = $("svp-accounts-hint");
        els.historyWrap = $("svp-source-history");
        els.uploadWrap = $("svp-source-upload");
        els.urlWrap = $("svp-source-url");
        els.historySelect = $("svp-history-select");
        els.file = $("svp-file");
        els.url = $("svp-url");
        els.preview = $("svp-preview");
        els.title = $("svp-title");
        els.caption = $("svp-caption");
        els.hashtags = $("svp-hashtags");
        els.privacy = $("svp-privacy");
        els.aiCaption = $("svp-ai-caption");
        els.credit = $("svp-credit");
        els.schedule = $("svp-schedule");
        els.publish = $("svp-publish");
        els.scheduleBtn = $("svp-schedule-btn");
        /* Riwayat posting YouTube/TikTok tampil di blok "Riwayat
           pembuatan & posting" (bukan di kartu composer). */
        els.queue = $("svh-list");
        els.queueSection = $("social-video-history");
        els.historyRefresh = $("svh-refresh");

        els.refresh?.addEventListener("click", () => void load());
        for (const tab of document.querySelectorAll("[data-svp-source]")) {
            tab.addEventListener("click", () => setSource(tab.dataset.svpSource));
        }
        els.historySelect?.addEventListener("change", () => void resolvePreviewUrl());
        els.file?.addEventListener("change", () => void resolvePreviewUrl());
        els.url?.addEventListener("change", () => void resolvePreviewUrl());
        els.publish?.addEventListener("click", publishNow);
        els.scheduleBtn?.addEventListener("click", schedulePost);
        els.aiCaption?.addEventListener("click", () => void aiCaption());
        els.historyRefresh?.addEventListener("click", () => void load());

        void load();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})();
