import { cleanImage } from "../metadata-cleaner/assets/js/metadata-cleaner-image.js";
import { describeHttpFailure, isPlatformFailure } from "./assets/js/http-failure.js";

(() => {
    "use strict";

    const endpoint = "/api/social-publisher";
    const RUNS_PER_PAGE_OPTIONS = [10, 20, 50, 100];
    const DEFAULT_RUNS_PER_PAGE = 10;
    const RUNS_PER_PAGE_STORAGE_KEY = "genz-social-runs-per-page";
    /* Logo resmi Facebook (huruf f dalam lingkaran biru #1877F2) ditempel inline
       supaya blok koneksi selalu menampilkan logo asli tanpa aset eksternal. */
    const FB_LOGO_SVG = '<svg viewBox="0 0 1024 1024" width="40" height="40" role="img" aria-label="Logo Facebook"><path fill="#1877F2" d="M1024 512C1024 229.23 794.77 0 512 0S0 229.23 0 512c0 255.55 187.23 467.37 432 505.78V660.28H301.5V512H432v-39.04c0-128.36 76.47-199.24 193.48-199.24 56.02 0 114.6 9.98 114.6 9.98v126.06h-64.64c-63.66 0-83.64 39.51-83.64 80.03V512h142.2l-22.74 148.28H591.8v357.5C836.77 979.37 1024 767.55 1024 512z"/></svg>';

    function readSavedRunsPerPage() {
        try {
            const saved = Number(window.localStorage?.getItem(RUNS_PER_PAGE_STORAGE_KEY));
            if (RUNS_PER_PAGE_OPTIONS.includes(saved)) return saved;
        } catch {
            // Abaikan bila localStorage dibatasi browser.
        }
        return DEFAULT_RUNS_PER_PAGE;
    }

    function saveRunsPerPage(value) {
        try {
            window.localStorage?.setItem(RUNS_PER_PAGE_STORAGE_KEY, String(value));
        } catch {
            // Abaikan bila localStorage dibatasi browser.
        }
    }

    const state = {
        data: null,
        busy: false,
        runsBusy: false,
        runsPage: 1,
        runsPerPage: readSavedRunsPerPage(),
        runsTotal: 0,
        runsTotalPages: 1,
        objectUrls: new Map(),
        manualPreview: null,
        /*
         * Konfirmasi terbit manual memakai tombol yang sama (dua langkah),
         * bukan dialog mengambang: klik pertama "mempersenjatai" tombol,
         * klik kedua benar-benar menerbitkan.
         */
        publishArmed: false,
        publishArmTimer: null,
        orphanNoticeShown: false,
        songs: [],
        songLibraryReady: true,
        defaultFacebookSongs: []
    };
    const $ = id => document.getElementById(id);
    const pageMessage = $("page-message");
    const configMessage = $("config-message");
    const configList = $("config-list");
    const globalState = $("global-state");
    /* Switch milik user yang sedang login. */
    const globalToggle = $("global-toggle");
    /* Master switch seluruh akun (admin/owner saja). */
    const masterToggle = $("master-toggle");
    const connectStatus = $("connect-status");
    const characterStatus = $("character-status");
    const scheduleStatus = $("schedule-status");
    const uploadButton = $("upload-character");
    const saveScheduleButton = $("save-schedule");
    const connectButton = $("connect-page");
    /* Bantuan OAuth: tautan manual + peringatan browser dalam aplikasi. */
    const connectHelp = $("connect-help");
    const connectHelpTitle = $("connect-help-title");
    const connectHelpText = $("connect-help-text");
    const oauthManualLink = $("oauth-manual-link");
    const connectCopyButton = $("connect-copy-link");
    const connectCopyStatus = $("connect-copy-status");
    const outfitSelect = $("outfit-character");
    const outfitStatus = $("outfit-status");
    const saveOutfitButton = $("save-outfit");
    let studioAccessState = null;
    let studioAccessError = null;
    let studioGateDismissed = false;

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
            if (refreshed?.access_token) {
                return refreshed.access_token;
            }
        }
        const { data, error } = await client().auth.getSession();
        if (error) throw error;
        const token = data?.session?.access_token;
        if (!token) throw new Error("Sesi login tidak ditemukan. Silakan login ulang sebagai admin.");
        return token;
    }

    async function api(action, { method = "GET", body, headers = {}, raw = false, responseRaw = raw } = {}) {
        const [actionName, ...queryParts] = String(action).split("&");
        const query = new URLSearchParams({ action: actionName });
        for (const part of queryParts) {
            const separator = part.indexOf("=");
            if (separator > 0) query.set(part.slice(0, separator), decodeURIComponent(part.slice(separator + 1)));
        }

        for (let attempt = 0; attempt < 2; attempt++) {
            const token = await sessionToken(attempt > 0);
            const response = await fetch(`${endpoint}?${query.toString()}`, {
                method,
                headers: {
                    Authorization: `Bearer ${token}`,
                    ...(body && !raw ? { "Content-Type": "application/json" } : {}),
                    ...headers
                },
                ...(body ? { body: raw ? body : JSON.stringify(body) } : {})
            });

            if (responseRaw && response.ok) return response;
            if (response.status === 401 && attempt === 0 && window.GENZSession?.ensureFreshSession) {
                continue;
            }
            /* Dibaca sebagai teks dulu: halaman error Cloudflare bukan JSON dan
               dulu berakhir jadi pesan "Permintaan gagal (HTTP 503)" tanpa sebab. */
            const bodyText = await response.text().catch(() => "");
            if (method === "GET" && attempt === 0 && isPlatformFailure(response.status, bodyText)) {
                await new Promise(resolve => setTimeout(resolve, 1200));
                continue;
            }
            let data = {};
            try {
                data = bodyText ? JSON.parse(bodyText) : {};
            } catch {
                data = {};
            }
            if (!response.ok || data.success !== true) {
                const error = new Error(data.error || describeHttpFailure(response.status, bodyText));
                error.code = data.code || "";
                error.status = response.status;
                error.retrySafe = data.retry_safe !== false;
                error.needsReconnect = data.needs_reconnect === true;
                throw error;
            }
            return data;
        }
    }

    function showNotice(element, message, tone = "warn") {
        element.hidden = !message;
        element.className = `notice${tone ? ` ${tone}` : ""}`;
        element.textContent = message;
    }

    function status(element, message, tone = "") {
        element.textContent = message || "";
        element.className = `status${tone ? ` ${tone}` : ""}`;
    }

    /*
     * Konfirmasi memakai tombol yang sama (klik 1 = tombol jadi hijau
     * terang "Konfirmasi", klik 2 = aksi dijalankan), bukan window.confirm
     * yang memunculkan blok dialog mengambang di tengah layar HP.
     * Helper-nya ada di ./assets/js/inline-confirm.js.
     */
    function confirmInlineAction(button, options = {}) {
        const helper = window.GENZInlineConfirm;
        if (!helper || typeof helper.request !== "function") {
            showNotice(
                pageMessage,
                "Modul konfirmasi tombol belum termuat. Muat ulang halaman lalu coba lagi.",
                "error"
            );
            return false;
        }
        return helper.request(button, options);
    }

    function formatDate(value) {
        if (!value) return "—";
        const date = new Date(value);
        if (!Number.isFinite(date.getTime())) return "—";
        return new Intl.DateTimeFormat("id-ID", {
            timeZone: "Asia/Jakarta",
            dateStyle: "medium",
            timeStyle: "short"
        }).format(date) + " WIB";
    }

    function setDefaultStartTime() {
        const date = new Date(Date.now() + 60 * 60 * 1000);
        const parts = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Jakarta",
            year: "numeric", month: "2-digit", day: "2-digit",
            hour: "2-digit", minute: "2-digit", hourCycle: "h23"
        }).formatToParts(date);
        const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
        $("first-run").value = `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`;
    }

    function localWibToUtc(value) {
        const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
        if (!match) return null;
        const [, year, month, day, hour, minute] = match.map(Number);
        return new Date(Date.UTC(year, month - 1, day, hour - 7, minute)).toISOString();
    }

    function utcToLocalWib(value) {
        const date = new Date(value);
        if (!Number.isFinite(date.getTime())) return "";
        const parts = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Jakarta",
            year: "numeric", month: "2-digit", day: "2-digit",
            hour: "2-digit", minute: "2-digit", hourCycle: "h23"
        }).formatToParts(date);
        const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
        return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`;
    }

    function safeExternalUrl(value) {
        try {
            const url = new URL(value);
            if (url.protocol !== "https:" || !["facebook.com", "www.facebook.com", "m.facebook.com"].includes(url.hostname)) return "";
            return url.toString();
        } catch {
            return "";
        }
    }

    const busyStates = new WeakMap();

    function formatElapsedSeconds(totalSeconds) {
        const safe = Math.max(0, Math.floor(totalSeconds));
        const minutes = Math.floor(safe / 60);
        const seconds = safe % 60;
        return `${minutes}:${String(seconds).padStart(2, "0")}`;
    }

    function updateButtonBusyText(button, nextText) {
        const current = busyStates.get(button);
        if (!current) return;
        current.manualStageLocked = true;
        if (current.textNode) current.textNode.textContent = nextText;
    }

    function setButtonBusy(button, busy, busyText = "Memproses…", options = {}) {
        if (!button) return;
        const previous = busyStates.get(button);
        if (previous?.intervalId) {
            clearInterval(previous.intervalId);
        }
        busyStates.delete(button);

        if (!button.dataset.originalText) button.dataset.originalText = button.textContent.trim();

        if (!busy) {
            button.disabled = false;
            button.removeAttribute("aria-busy");
            button.classList.remove("is-premium-loading");
            button.replaceChildren();
            button.textContent = button.dataset.originalText;
            return;
        }

        button.disabled = true;
        button.setAttribute("aria-busy", "true");

        if (!options.premium) {
            button.textContent = busyText;
            return;
        }

        button.classList.add("is-premium-loading");
        const orbit = document.createElement("span");
        orbit.className = "btn-fx-orbit";
        orbit.setAttribute("aria-hidden", "true");

        const textNode = document.createElement("span");
        textNode.className = "btn-fx-text";
        textNode.textContent = busyText;

        const timeNode = document.createElement("span");
        timeNode.className = "btn-fx-time";
        timeNode.textContent = "0:00";

        button.replaceChildren(orbit, textNode, timeNode);

        const startedAt = Date.now();
        const stages = Array.isArray(options.stages) ? options.stages : [];
        const entry = {
            textNode,
            timeNode,
            manualStageLocked: false,
            intervalId: setInterval(() => {
                const elapsed = Math.floor((Date.now() - startedAt) / 1000);
                timeNode.textContent = formatElapsedSeconds(elapsed);
                if (!entry.manualStageLocked && stages.length) {
                    let activeLabel = busyText;
                    for (const stage of stages) {
                        if (elapsed >= stage.at) activeLabel = stage.text;
                    }
                    if (textNode.textContent !== activeLabel) {
                        textNode.textContent = activeLabel;
                    }
                }
            }, 1000)
        };
        busyStates.set(button, entry);
    }

    function renderConfig(config = {}) {
        const imageProviderLabel = config.imageProvider === "cloudflare"
            ? "Cloudflare Workers AI"
            : config.imageProvider === "qwencloud"
                ? `QwenCloud (${config.imageModel || "qwen-image-3.0-pro"})`
                : config.imageProvider === "tencent"
                    ? "Tencent Hy Image"
                    : config.imageProvider === "puter"
                        ? "Puter.js (kuota akun Puter)"
                        : config.imageProvider === "opus"
                            ? `Opus Labs (Product Ad Studio · ${config.imageModel || "gpt-image-2.5-flare"})`
                            : "Gemini Image API";
        const captionProviderLabel = config.captionProvider === "cloudflare"
            ? "Cloudflare Vision Caption"
            : config.captionProvider === "qwencloud"
                ? "QwenCloud Vision Caption"
                : config.captionProvider === "tencent"
                    ? "Tencent Vision Caption"
                    : (config.captionProvider === "puter" || config.captionProvider === "opus")
                        ? "Cloudflare Vision Caption"
                        : "Gemini Caption API";
        const items = [
            ["Meta OAuth", config.metaOAuthConfigured],
            [imageProviderLabel, config.imageApiConfigured],
            [captionProviderLabel, config.captionApiConfigured],
            ["Token encryption", config.tokenEncryptionConfigured],
            ["Private Supabase Storage", config.referenceStorageConfigured]
        ];
        configList.replaceChildren();
        for (const [label, ok] of items) {
            const item = document.createElement("div");
            item.className = "config-item";
            const title = document.createElement("span");
            title.textContent = label;
            const value = document.createElement("strong");
            const dot = document.createElement("i");
            dot.className = `dot${ok ? " ok" : ""}`;
            dot.setAttribute("aria-hidden", "true");
            value.append(dot, document.createTextNode(ok ? "Siap" : "Belum diatur"));
            item.append(title, value);
            configList.append(item);
        }

        const allReady = items.every(([, ok]) => ok === true);
        const autopublishOn = state.data?.autopublishEnabled === true;
        globalToggle.disabled = !allReady && !autopublishOn;
        if (!allReady && !autopublishOn) {
            showNotice(configMessage, "Autopublish belum dapat diaktifkan. Lengkapi secrets Cloudflare, buat bucket privat Supabase Storage, dan pastikan SQL migration sudah dijalankan.", "warn");
        } else {
            configMessage.hidden = true;
        }
    }

    const STUDIO_COLLAPSIBLE_SECTIONS = [
        { cardId: "outfit-card", btnId: "outfit-collapse-btn", bodyId: "outfit-collapse-body", chipId: "outfit-collapse-chip-label" },
        { cardId: "songs-card", btnId: "songs-collapse-btn", bodyId: "songs-collapse-body", chipId: "songs-collapse-chip-label" },
        { cardId: "posting-settings-card", btnId: "posting-settings-collapse-btn", bodyId: "posting-settings-collapse-body", chipId: "posting-settings-collapse-chip-label" },
        { cardId: "manual-post-card", btnId: "manual-post-collapse-btn", bodyId: "manual-post-collapse-body", chipId: "manual-post-collapse-chip-label" },
        { cardId: "schedule-card", btnId: "schedule-collapse-btn", bodyId: "schedule-collapse-body", chipId: "schedule-collapse-chip-label" }
    ];

    function setStudioCardExpanded(cardId, expanded) {
        const entry = STUDIO_COLLAPSIBLE_SECTIONS.find(item => item.cardId === cardId);
        if (!entry) return;
        const card = $(entry.cardId);
        const btn = $(entry.btnId);
        const body = $(entry.bodyId);
        const chip = $(entry.chipId);
        const isOpen = Boolean(expanded);
        if (card) card.classList.toggle("is-expanded", isOpen);
        if (btn) btn.setAttribute("aria-expanded", String(isOpen));
        if (body) body.hidden = !isOpen;
        if (chip) chip.textContent = isOpen ? "Tutup" : "Buka";
    }

    function toggleStudioCard(cardId) {
        const entry = STUDIO_COLLAPSIBLE_SECTIONS.find(item => item.cardId === cardId);
        if (!entry) return;
        const body = $(entry.bodyId);
        const nextOpen = body ? body.hidden === true : true;
        setStudioCardExpanded(cardId, nextOpen);
    }

    function updateCollapsibleSummaries() {
        const outfits = Array.isArray(state.data?.outfits) ? state.data.outfits : [];
        const activeOutfits = outfits.filter(item => item.enabled !== false).length;
        const outfitMeta = $("outfit-summary-meta");
        if (outfitMeta) {
            outfitMeta.textContent = outfits.length
                ? `${activeOutfits} aktif · ${outfits.length} outfit`
                : "0 outfit";
        }

        const customSongs = Array.isArray(state.songs) ? state.songs : [];
        const songsMeta = $("songs-summary-meta");
        if (songsMeta) {
            songsMeta.textContent = customSongs.length
                ? `${customSongs.length} musik tersimpan`
                : "8 musik bawaan";
        }

        const extLink = String($("external-post-link")?.value || state.data?.postingSettings?.external_link || "").trim();
        const postingMeta = $("posting-settings-summary-meta");
        if (postingMeta) {
            postingMeta.textContent = extLink ? "Caption + Link aktif" : "Template siap";
        }
    }

    function resolveMasterStatus() {
        const raw = String(state.data?.globalStatus || "").trim().toLowerCase();
        if (state.data?.globalEnabled === true) return "active";
        if (raw === "maintenance") return "maintenance";
        if (raw === "active" && state.data?.globalEnabled !== false) return "active";
        if (raw === "off") return "off";
        return state.data?.globalEnabled === false ? "off" : "active";
    }

    function renderMasterSwitchBlock(masterStatus, canManage) {
        const block = $("master-switch-block");
        const roleTag = $("master-switch-role-tag");
        const desc = $("master-switch-desc");
        const badge = $("master-status-badge");
        const badgeText = $("master-status-text");
        const controls = $("master-switch-controls");

        const statusKey = ["active", "off", "maintenance"].includes(masterStatus) ? masterStatus : "off";
        const statusLabel = statusKey === "active"
            ? "ACTIVE"
            : statusKey === "maintenance"
                ? "MAINTENANCE"
                : "OFF";

        if (block) {
            block.setAttribute("data-master-status", statusKey);
            block.setAttribute("data-master-role", canManage ? "admin" : "user");
        }
        if (roleTag) {
            roleTag.textContent = canManage ? "Kontrol Admin" : "Status Sistem";
        }
        if (desc) {
            desc.textContent = statusKey === "active"
                ? "Layanan Studio Medsos aktif penuh — jadwal autopost berjalan normal."
                : statusKey === "maintenance"
                    ? "Sistem sedang dalam pemeliharaan (Maintenance) oleh Admin/Owner."
                    : "Autopost global sedang dinonaktifkan sementara oleh Admin/Owner.";
        }
        if (badge) {
            badge.className = `master-status-pill is-${statusKey}`;
        }
        if (badgeText) {
            badgeText.textContent = statusLabel;
        }
        if (controls) {
            controls.hidden = !canManage;
        }
        for (const [id, key] of [
            ["master-btn-active", "active"],
            ["master-btn-maintenance", "maintenance"],
            ["master-btn-off", "off"]
        ]) {
            const btn = $(id);
            if (!btn) continue;
            const current = key === statusKey;
            btn.classList.toggle("is-current", current);
            btn.setAttribute("aria-pressed", String(current));
        }
    }

    function renderGlobalState() {
        const mine = state.data?.autopublishEnabled === true;
        const masterStatus = resolveMasterStatus();
        const master = masterStatus === "active";
        const effective = mine && master;

        globalState.textContent = effective
            ? "AUTOPUBLISH ON"
            : masterStatus === "maintenance"
                ? "MAINTENANCE"
                : mine && !master
                    ? "AUTOPUBLISH DIJEDA ADMIN"
                    : "AUTOPUBLISH OFF";
        globalState.className = `state ${effective ? "on" : masterStatus === "maintenance" ? "maintenance" : "off"}`;

        globalToggle.textContent = mine ? "Autopost saya: ON" : "Autopost saya: OFF";
        globalToggle.title = mine ? "Klik untuk menjeda autopost akun Anda." : "Klik untuk mengaktifkan autopost akun Anda.";
        globalToggle.setAttribute("aria-pressed", String(mine));
        globalToggle.classList.toggle("green", mine);
        globalToggle.classList.toggle("danger", !mine);

        const canManage = state.data?.canManageGlobalAutopublish === true;
        renderMasterSwitchBlock(masterStatus, canManage);

        if (!masterToggle) return;
        masterToggle.hidden = !canManage;
        if (!canManage) return;
        masterToggle.textContent = master ? "Master switch: ON" : "Master switch: OFF";
        masterToggle.title = master
            ? "Klik untuk menjeda autopost SEMUA akun (perawatan/insiden)."
            : "Klik untuk mengaktifkan kembali autopost semua akun.";
        masterToggle.setAttribute("aria-pressed", String(master));
        masterToggle.classList.toggle("green", master);
        masterToggle.classList.toggle("danger", !master);
    }

    function renderPages(pages = []) {
        const container = $("page-connections");
        const select = $("schedule-page");
        const manualSelect = $("manual-page");
        container.replaceChildren();
        select.replaceChildren(new Option("Pilih Page…", ""));
        manualSelect.replaceChildren(new Option("Pilih Page…", ""));
        for (const page of pages) {
            const option = new Option(`${page.page_name}${page.can_publish ? "" : " — perlu izin"}`, page.id);
            option.disabled = page.can_publish === false;
            select.add(option);
            const manualOption = new Option(`${page.page_name}${page.can_publish ? "" : " — perlu izin"}`, page.id);
            manualOption.disabled = page.can_publish === false;
            manualSelect.add(manualOption);

            const item = document.createElement("div");
            item.className = "item";
            const icon = document.createElement("div");
            icon.className = "thumb fb-logo";
            icon.style.display = "grid";
            icon.style.placeItems = "center";
            icon.innerHTML = FB_LOGO_SVG;
            const content = document.createElement("div");
            const title = document.createElement("p");
            title.className = "item-title";
            title.textContent = page.page_name || "Facebook Page";
            const detail = document.createElement("div");
            detail.className = "item-meta";
            const checked = page.token_checked_at ? ` · diperiksa ${formatDate(page.token_checked_at)}` : "";
            detail.textContent = page.can_publish
                ? `ID ${page.page_id} · izin posting siap${checked}`
                : `ID ${page.page_id} · izin CREATE_CONTENT belum terdeteksi${checked}`;
            content.append(title, detail);
            const actions = document.createElement("div");
            actions.className = "item-actions";
            const check = document.createElement("button");
            check.className = "btn small";
            check.type = "button";
            check.textContent = "Periksa izin";
            check.addEventListener("click", () => checkPagePermission(page.id, check));
            const disconnect = document.createElement("button");
            disconnect.className = "btn small danger";
            disconnect.type = "button";
            disconnect.textContent = "Putuskan";
            disconnect.addEventListener("click", () => disconnectPage(page.id, disconnect));
            actions.append(check, disconnect);
            item.append(icon, content, actions);
            container.append(item);
        }
        if (!pages.length) container.innerHTML = '<div class="empty">Belum ada Facebook Page terhubung.</div>';
    }

    function renderCharacters(characters = []) {
        const container = $("characters-list");
        const select = $("schedule-character");
        const manualSelect = $("manual-character");
        container.replaceChildren();
        select.replaceChildren(new Option("Pilih karakter…", ""));
        manualSelect.replaceChildren(new Option("Pilih karakter…", ""));
        for (const character of characters) {
            const characterOutfits = (state.data?.outfits || []).filter(outfit => outfit.character_id === character.id);
            const activeOutfitCount = characterOutfits.filter(outfit => outfit.is_active !== false).length;
            /* Tanpa outfit, pakaian mengikuti foto referensi karakter, jadi
               karakter selalu bisa dipakai walau belum punya outfit. */
            const optionLabel = character.display_name;
            select.add(new Option(optionLabel, character.id));
            manualSelect.add(new Option(optionLabel, character.id));
            const item = document.createElement("div");
            item.className = "item";
            const img = document.createElement("img");
            img.className = "thumb";
            img.alt = `Foto referensi ${character.display_name}`;
            img.loading = "lazy";
            img.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='54' height='66'%3E%3Crect width='100%25' height='100%25' fill='%231b2737'/%3E%3C/svg%3E";
            loadReferencePreview(character.id, img);
            const thumbs = document.createElement("div");
            thumbs.className = "thumbs";
            thumbs.append(img);
            const content = document.createElement("div");
            const title = document.createElement("p");
            title.className = "item-title";
            title.textContent = character.display_name;
            const detail = document.createElement("div");
            detail.className = "item-meta";
            detail.textContent = `${character.reference_filename || "referensi"} · ${activeOutfitCount ? `${activeOutfitCount} outfit aktif` : "Pakaian mengikuti foto referensi"} · ${character.prompt_notes || "Tanpa catatan tambahan"}`;
            content.append(title, detail);
            const outfitAction = document.createElement("button");
            outfitAction.className = "btn small green";
            outfitAction.type = "button";
            outfitAction.textContent = activeOutfitCount
                ? `Kelola outfit (${activeOutfitCount})`
                : "Kelola outfit";
            outfitAction.addEventListener("click", () => focusOutfitLibrary(character.id));
            const notesAction = document.createElement("button");
            notesAction.className = "btn small";
            notesAction.type = "button";
            notesAction.textContent = "Edit";
            notesAction.title = "Edit nama, catatan, atau ganti foto referensi";
            notesAction.addEventListener("click", () => editCharacter(character));
            const deleteAction = document.createElement("button");
            deleteAction.className = "btn small danger";
            deleteAction.type = "button";
            deleteAction.textContent = "Hapus";
            deleteAction.addEventListener("click", () => deleteCharacter(character, deleteAction));
            const actions = document.createElement("div");
            actions.className = "item-actions";
            actions.append(outfitAction, notesAction, deleteAction);
            item.append(thumbs, content, actions);
            container.append(item);
        }
        if (!characters.length) container.innerHTML = '<div class="empty">Belum ada karakter. Tambahkan foto referensi untuk memulai.</div>';
    }

    async function loadReferencePreview(characterId, img) {
        try {
            const response = await api("reference&character_id=" + encodeURIComponent(characterId), { raw: true });
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            if (img.dataset.characterId && img.dataset.characterId !== characterId) {
                URL.revokeObjectURL(url);
                return;
            }
            const previousUrl = state.objectUrls.get(characterId);
            if (previousUrl) URL.revokeObjectURL(previousUrl);
            state.objectUrls.set(characterId, url);
            img.src = url;
        } catch {
            if (!img.dataset.characterId || img.dataset.characterId === characterId) {
                img.alt = "Preview referensi tidak tersedia";
            }
        }
    }

    function safeHttpsLink(value) {
        try {
            const url = new URL(String(value || ""));
            return url.protocol === "https:" ? url.toString() : "";
        } catch {
            return "";
        }
    }

    function renderOutfits() {
        const container = $("outfits-list");
        const selectedCharacterId = outfitSelect.value;
        const outfits = (state.data?.outfits || []).filter(outfit => outfit.character_id === selectedCharacterId);
        const ready = state.data?.config?.outfitLibraryReady !== false;
        const badge = $("outfit-ready-badge");
        const notice = $("outfit-library-notice");
        if (badge) {
            const count = selectedCharacterId ? outfits.length : (state.data?.outfits || []).length;
            badge.textContent = ready ? `${count} outfit` : "Belum siap";
            badge.className = `badge${ready ? " posted" : " failed"}`;
        }
        if (notice) notice.hidden = ready;
        saveOutfitButton.disabled = !ready;

        container.replaceChildren();
        if (!selectedCharacterId) {
            const empty = document.createElement("div");
            empty.className = "empty";
            empty.style.gridColumn = "1/-1";
            empty.textContent = "Pilih karakter untuk melihat daftar outfit.";
            container.append(empty);
            return;
        }
        if (!outfits.length) {
            const empty = document.createElement("div");
            empty.className = "empty";
            empty.style.gridColumn = "1/-1";
            empty.textContent = ready
                ? "Belum ada outfit untuk karakter ini. Tanpa outfit, pakaian mengikuti foto referensi karakter; tambahkan outfit bila ingin pakaian yang Anda tentukan."
                : "Library outfit belum tersedia di database. Jalankan ulang supabase/social-auto-publisher.sql, lalu muat ulang halaman.";
            container.append(empty);
            return;
        }

        for (const outfit of outfits) {
            const card = document.createElement("article");
            card.className = "outfit-card";
            const img = document.createElement("img");
            img.alt = `Foto outfit ${outfit.name}`;
            img.loading = "lazy";
            img.dataset.outfitId = outfit.id;
            img.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='215' height='170'%3E%3Crect width='100%25' height='100%25' fill='%231b2737'/%3E%3C/svg%3E";
            loadOutfitPreview(outfit.id, img);
            const title = document.createElement("p");
            title.className = "item-title";
            title.textContent = outfit.name;
            const stateRow = document.createElement("div");
            stateRow.className = "outfit-state";
            const stateBadge = document.createElement("span");
            stateBadge.className = `badge ${outfit.is_active === false ? "failed" : "posted"}`;
            stateBadge.textContent = outfit.is_active === false ? "Nonaktif" : "Aktif";
            const meta = document.createElement("span");
            meta.className = "item-meta";
            meta.textContent = outfit.notes || "";
            stateRow.append(stateBadge, meta);
            const order = document.createElement("a");
            order.className = "outfit-order";
            const orderUrl = safeHttpsLink(outfit.order_url);
            if (orderUrl) {
                order.href = orderUrl;
                order.target = "_blank";
                order.rel = "noopener noreferrer";
                order.textContent = orderUrl;
            } else {
                order.classList.add("missing");
                order.textContent = "Tanpa link order";
            }
            const actions = document.createElement("div");
            actions.className = "outfit-card-actions";
            const toggle = document.createElement("button");
            toggle.className = `btn small ${outfit.is_active === false ? "green" : ""}`;
            toggle.type = "button";
            toggle.textContent = outfit.is_active === false ? "Aktifkan" : "Nonaktifkan";
            toggle.addEventListener("click", () => toggleOutfit(outfit));
            const edit = document.createElement("button");
            edit.className = "btn small";
            edit.type = "button";
            edit.textContent = "Edit";
            edit.addEventListener("click", () => editOutfit(outfit));
            const remove = document.createElement("button");
            remove.className = "btn small danger";
            remove.type = "button";
            remove.textContent = "Hapus";
            remove.addEventListener("click", () => deleteOutfit(outfit, remove));
            actions.append(toggle, edit, remove);
            card.append(img, title, stateRow, order, actions);
            container.append(card);
        }
    }

    async function loadOutfitPreview(outfitId, img) {
        try {
            const response = await api("outfit&outfit_id=" + encodeURIComponent(outfitId), { raw: true });
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            if (img.dataset.outfitId && img.dataset.outfitId !== outfitId) {
                URL.revokeObjectURL(url);
                return;
            }
            const previousUrl = state.objectUrls.get(`outfit:${outfitId}`);
            if (previousUrl) URL.revokeObjectURL(previousUrl);
            state.objectUrls.set(`outfit:${outfitId}`, url);
            img.src = url;
        } catch {
            img.alt = "Preview outfit tidak tersedia";
        }
    }

    function focusOutfitLibrary(characterId) {
        setStudioCardExpanded("outfit-card", true);
        outfitSelect.value = characterId;
        renderOutfits();
        document.getElementById("outfit-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
        $("outfit-name").focus({ preventScroll: true });
    }

    async function submitOutfit(event) {
        event.preventDefault();
        const characterId = outfitSelect.value;
        const name = $("outfit-name").value.trim();
        const orderUrl = $("outfit-order-url").value.trim();
        const notes = $("outfit-notes").value.trim();
        const file = $("outfit-image").files?.[0];
        if (!characterId) {
            status(outfitStatus, "Pilih karakter terlebih dahulu.", "error");
            return;
        }
        if (!name || !file) {
            status(outfitStatus, "Isi nama outfit dan pilih foto outfit.", "error");
            return;
        }
        try {
            await validateImageFile(file);
        } catch (error) {
            status(outfitStatus, error.message, "error");
            return;
        }
        if (orderUrl && !safeHttpsLink(orderUrl)) {
            status(outfitStatus, "Link order harus berupa URL HTTPS yang valid.", "error");
            return;
        }
        if (!$("outfit-rights").checked) {
            status(outfitStatus, "Centang konfirmasi hak penggunaan foto outfit.", "error");
            return;
        }

        setButtonBusy(saveOutfitButton, true, "Menyimpan…");
        status(outfitStatus, "Mengunggah foto outfit ke Supabase Storage privat…");
        try {
            await api(`upload-outfit&character_id=${encodeURIComponent(characterId)}`, {
                method: "POST",
                body: file,
                raw: true,
                headers: {
                    "Content-Type": file.type,
                    "X-File-Name": encodeURIComponent(file.name),
                    "X-Outfit-Name": encodeURIComponent(name),
                    "X-Outfit-Order-Url": encodeURIComponent(orderUrl),
                    "X-Outfit-Notes": encodeURIComponent(notes),
                    "X-Outfit-Rights": "1"
                }
            });
            $("outfit-form").reset();
            outfitSelect.value = characterId;
            status(outfitStatus, `Outfit "${name}" tersimpan. Outfit ini ikut dipilih acak pada post berikutnya.`, "good");
            await loadDashboard();
        } catch (error) {
            status(outfitStatus, error.message || "Outfit gagal disimpan.", "error");
        } finally {
            setButtonBusy(saveOutfitButton, false);
        }
    }

    function editOutfit(outfit) {
        openEditModal("outfit", outfit);
    }

    async function toggleOutfit(outfit) {
        try {
            await api("save-outfit", {
                method: "POST",
                body: {
                    id: outfit.id,
                    name: outfit.name,
                    order_url: outfit.order_url || "",
                    notes: outfit.notes || "",
                    is_active: outfit.is_active === false
                }
            });
            await loadDashboard();
        } catch (error) {
            showNotice(pageMessage, error.message, "error");
        }
    }

    async function deleteOutfit(outfit, button) {
        if (!confirmInlineAction(button, {
            label: "Konfirmasi hapus",
            ariaLabel: `Konfirmasi hapus outfit ${outfit.name}`,
            title: `Hapus outfit "${outfit.name}"? Riwayat post yang sudah terbit tidak berubah.`
        })) return;
        try {
            await api("delete-outfit", { method: "POST", body: { id: outfit.id } });
            showNotice(pageMessage, "Outfit dihapus.", "success");
            await loadDashboard();
        } catch (error) {
            showNotice(pageMessage, error.message, "error");
        }
    }

    const FACEBOOK_SONG_HOSTS = new Set([
        "facebook.com",
        "www.facebook.com",
        "m.facebook.com",
        "web.facebook.com",
        "business.facebook.com",
        "fb.watch",
        "fb.com",
        "www.fb.com"
    ]);

    function safeFacebookSongLink(value) {
        try {
            const url = new URL(String(value || "").trim());
            if (url.protocol !== "https:" || !FACEBOOK_SONG_HOSTS.has(url.hostname.toLowerCase())) return "";
            return url.toString();
        } catch {
            return "";
        }
    }

    function populateQuotePresets(quotePresets = {}) {
        const themes = Array.isArray(quotePresets?.themes) ? quotePresets.themes : [];
        const visualStyles = Array.isArray(quotePresets?.visualStyles) ? quotePresets.visualStyles : [];

        for (const [id, emptyText] of [
            ["manual-quote-theme", "Acak otomatis"],
            ["schedule-quote-theme", "Acak otomatis setiap post"]
        ]) {
            const select = $(id);
            if (!select || !themes.length) continue;
            const prev = select.value;
            select.replaceChildren(new Option(emptyText, ""));
            for (const item of themes) {
                const optionValue = item.value ?? item.id ?? "";
                select.add(new Option(item.label, optionValue));
            }
            select.value = themes.some(item => (item.value ?? item.id) === prev) ? prev : "";
        }

        for (const [id, emptyText] of [
            ["manual-quote-visual", "Acak otomatis"],
            ["schedule-quote-visual", "Acak otomatis setiap post"]
        ]) {
            const select = $(id);
            if (!select || !visualStyles.length) continue;
            const prev = select.value;
            select.replaceChildren(new Option(emptyText, ""));
            for (const item of visualStyles) {
                const optionValue = item.value ?? item.id ?? "";
                select.add(new Option(item.label, optionValue));
            }
            select.value = visualStyles.some(item => (item.value ?? item.id) === prev) ? prev : "";
        }
    }

    function setManualPostMode(mode) {
        const nextMode = mode === "quote" ? "quote" : "character";
        const isQuote = nextMode === "quote";
        const modeSelect = $("manual-post-mode");
        if (modeSelect) modeSelect.value = nextMode;
        for (const tab of document.querySelectorAll?.("[data-manual-mode]") || []) {
            tab.classList.toggle("is-active", tab.dataset.manualMode === nextMode);
        }
        const charFields = $("manual-character-fields");
        const quoteFields = $("manual-quote-fields");
        const charSelect = $("manual-character");
        const aspectWrap = $("manual-aspect-wrap");
        const aspectSelect = $("manual-aspect-ratio");
        if (charFields) charFields.hidden = isQuote;
        if (quoteFields) quoteFields.hidden = !isQuote;
        if (charSelect) charSelect.required = !isQuote;
        if (aspectWrap) aspectWrap.hidden = isQuote;
        if (isQuote && aspectSelect) aspectSelect.value = "9:16";
        updateManualCharacterPreview();
    }

    function setSchedulePostMode(mode, { preserveSongToggle = false } = {}) {
        const nextMode = mode === "quote" ? "quote" : "character";
        const isQuote = nextMode === "quote";
        const modeSelect = $("schedule-post-mode");
        if (modeSelect) modeSelect.value = nextMode;
        for (const tab of document.querySelectorAll?.("[data-schedule-mode]") || []) {
            tab.classList.toggle("is-active", tab.dataset.scheduleMode === nextMode);
        }
        const charWrap = $("schedule-character-wrap");
        const charSelect = $("schedule-character");
        const quoteFields = $("schedule-quote-fields");
        const sceneFields = $("schedule-scene-fields-wrap");
        const aspectWrap = $("schedule-aspect-wrap");
        const aspectSelect = $("schedule-aspect-ratio");
        const songCheck = $("schedule-random-song");
        if (charWrap) charWrap.hidden = isQuote;
        if (charSelect) charSelect.required = !isQuote;
        if (quoteFields) quoteFields.hidden = !isQuote;
        if (sceneFields) sceneFields.hidden = isQuote;
        if (aspectWrap) aspectWrap.hidden = isQuote;
        if (isQuote && aspectSelect) aspectSelect.value = "9:16";
        if (!preserveSongToggle && songCheck) {
            songCheck.checked = isQuote;
        }
    }

    let activeSongPreviewId = "";

    const songPreviewBlobs = new Map();
    const SILENT_WAV_DATA_URI = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";

    function syncSongPlayButtons() {
        const player = $("song-preview-player");
        const isPlaying = Boolean(player && !player.paused && !player.ended && activeSongPreviewId);
        for (const btn of document.querySelectorAll?.("[data-song-play-btn]") || []) {
            const btnKey = btn.getAttribute("data-song-key") || "";
            btn.textContent = isPlaying && btnKey && btnKey === activeSongPreviewId ? "⏸ Berhenti" : "▶ Putar";
        }
    }

    function stopSongPreviewPlayer({ hideBar = true } = {}) {
        const player = $("song-preview-player");
        if (player) {
            try { player.pause(); } catch {}
            player.muted = false;
            player.removeAttribute("src");
            try { player.load?.(); } catch {}
        }
        const prevUrl = state.objectUrls.get("song-audio-preview");
        if (prevUrl) {
            URL.revokeObjectURL(prevUrl);
            state.objectUrls.delete("song-audio-preview");
        }
        activeSongPreviewId = "";
        const bar = $("song-preview-bar");
        if (bar && hideBar) bar.hidden = true;
        syncSongPlayButtons();
    }

    function inferSongMimeType(song, headerContentType = "", blobType = "") {
        const cleanHeader = String(headerContentType || "").split(";")[0].trim().toLowerCase();
        if (cleanHeader && cleanHeader !== "application/octet-stream") return cleanHeader;
        const cleanBlob = String(blobType || "").split(";")[0].trim().toLowerCase();
        if (cleanBlob && cleanBlob !== "application/octet-stream") return cleanBlob;
        const songMime = String(song?.audio_mime_type || "").split(";")[0].trim().toLowerCase();
        if (songMime) return songMime;
        const key = String(song?.audio_object_key || "").toLowerCase();
        if (key.endsWith(".mp3")) return "audio/mpeg";
        if (key.endsWith(".aac")) return "audio/aac";
        if (key.endsWith(".mp4")) return "video/mp4";
        return "audio/mp4";
    }

    async function togglePlaySongPreview(song, button) {
        const player = $("song-preview-player");
        if (!player) return;
        const bar = $("song-preview-bar");
        const titleEl = $("song-preview-title");
        const songStatus = $("song-status");
        const songKey = String(song.id || song.audio_object_key || "");
        if (activeSongPreviewId === songKey && !player.paused) {
            stopSongPreviewPlayer();
            return;
        }
        stopSongPreviewPlayer({ hideBar: false });
        activeSongPreviewId = songKey;
        if (bar) bar.hidden = false;
        if (titleEl) {
            titleEl.textContent = `🎵 Memuat audio: ${song.title || "Musik Pilihan"}${song.artist ? ` — ${song.artist}` : ""}…`;
        }
        if (button) button.textContent = "⏳ Memuat…";

        const audioKey = String(song.audio_object_key || "");
        const cachedBlob = song.id ? songPreviewBlobs.get(song.id) : null;
        // Unlock HTMLAudioElement synchronously inside the user gesture before any network await (critical for iOS Safari & Mobile Chrome)
        if (!audioKey.startsWith("builtin:") && !cachedBlob && song.id) {
            try {
                player.muted = true;
                player.src = SILENT_WAV_DATA_URI;
                const unlockPromise = player.play?.();
                if (unlockPromise?.catch) unlockPromise.catch(() => {});
            } catch {}
        }

        try {
            let playUrl = "";
            if (audioKey.startsWith("builtin:")) {
                const slug = audioKey.replace(/^builtin:/i, "");
                playUrl = `/assets/audio/story-music/${encodeURIComponent(slug)}.m4a`;
            } else if (cachedBlob) {
                playUrl = URL.createObjectURL(cachedBlob);
                state.objectUrls.set("song-audio-preview", playUrl);
            } else if (song.id) {
                const response = await api(`song-audio&id=${encodeURIComponent(song.id)}`, { raw: true });
                const rawBlob = await response.blob();
                if (!rawBlob || !rawBlob.size) {
                    throw new Error("File audio kosong atau gagal diunduh dari penyimpanan.");
                }
                const resolvedMime = inferSongMimeType(song, response.headers?.get?.("content-type"), rawBlob.type);
                const typedBlob = rawBlob.type === resolvedMime ? rawBlob : new Blob([rawBlob], { type: resolvedMime });
                songPreviewBlobs.set(song.id, typedBlob);
                playUrl = URL.createObjectURL(typedBlob);
                state.objectUrls.set("song-audio-preview", playUrl);
            }
            if (!playUrl) throw new Error("File audio tidak tersedia untuk lagu ini.");
            if (activeSongPreviewId !== songKey) return;

            try { player.pause?.(); } catch {}
            player.muted = false;
            player.src = playUrl;
            player.onplay = () => syncSongPlayButtons();
            player.onpause = () => syncSongPlayButtons();
            player.onended = () => stopSongPreviewPlayer();
            try { player.load?.(); } catch {}

            if (titleEl) {
                titleEl.textContent = `🎵 Sedang memutar: ${song.title || "Musik Pilihan"}${song.artist ? ` — ${song.artist}` : ""}`;
            }

            try {
                await player.play();
                syncSongPlayButtons();
            } catch (playErr) {
                // Keep visible native <audio controls> bar ready so strict mobile browsers can play on single tap
                syncSongPlayButtons();
                if (titleEl) {
                    titleEl.textContent = `🎵 Siap diputar: ${song.title || "Musik Pilihan"} (klik tombol ▶ pada pemutar di bawah)`;
                }
                if (songStatus) {
                    status(songStatus, "Audio berhasil dimuat. Tekan tombol ▶ pada bar pemutar musik di bawah untuk mendengarkan.", "good");
                }
            }
        } catch (error) {
            stopSongPreviewPlayer();
            const msg = error?.message || "Gagal memutar pratinjau lagu.";
            if (songStatus) status(songStatus, msg, "error");
            showNotice(pageMessage, msg, "error");
        }
    }

    function renderSongs() {
        const container = $("songs-list");
        if (!container) return;
        const songs = Array.isArray(state.songs) ? state.songs : [];
        const activeCount = songs.filter(song => song.is_active !== false).length;
        const defaultCount = Array.isArray(state.defaultFacebookSongs) && state.defaultFacebookSongs.length
            ? state.defaultFacebookSongs.length
            : (Array.isArray(state.data?.defaultFacebookSongs) ? state.data.defaultFacebookSongs.length : 8);
        const ready = state.songLibraryReady !== false;

        const badge = $("songs-ready-badge");
        if (badge) {
            badge.textContent = songs.length
                ? `${activeCount}/${songs.length} musik aktif`
                : `${defaultCount} musik bawaan siap`;
            badge.className = `badge ${ready ? "posted" : ""}`.trim();
        }
        const notice = $("songs-library-notice");
        if (notice) notice.hidden = ready;
        const seedBtn = $("seed-default-songs");
        if (seedBtn) seedBtn.disabled = !ready;

        container.replaceChildren();
        if (!songs.length) {
            const empty = document.createElement("div");
            empty.className = "empty";
            empty.style.gridColumn = "1/-1";
            empty.textContent = ready
                ? `Belum ada file lagu yang Anda unggah. Saat ini ${defaultCount} musik instrumental bawaan siap auto-play acak otomatis di Postingan Beranda Page, Reels, maupun Cerita — atau unggah file lagu Anda sendiri (.mp3 / .m4a / video .mp4 FB) di atas.`
                : `Tabel musik belum diaktifkan di database; ${defaultCount} musik instrumental bawaan tetap aktif otomatis untuk Kata-kata Mutiara.`;
            container.append(empty);
            return;
        }

        for (const song of songs) {
            const card = document.createElement("article");
            card.className = "song-card";

            const head = document.createElement("div");
            head.className = "song-card-head";
            const icon = document.createElement("div");
            icon.className = "song-icon";
            icon.setAttribute("aria-hidden", "true");
            icon.textContent = "🎵";
            const body = document.createElement("div");
            body.className = "song-card-body";
            const title = document.createElement("p");
            title.className = "item-title";
            title.textContent = song.title || "Musik Cerita";
            const artist = document.createElement("p");
            artist.className = "song-artist";
            artist.textContent = song.artist || "Musik Instrumental";
            body.append(title, artist);
            head.append(icon, body);

            const stateRow = document.createElement("div");
            stateRow.className = "outfit-state";
            const stateBadge = document.createElement("span");
            stateBadge.className = `badge ${song.is_active === false ? "failed" : "posted"}`;
            stateBadge.textContent = song.is_active === false ? "Nonaktif" : "Aktif";
            stateRow.append(stateBadge);
            const audioKey = String(song.audio_object_key || "");
            const sourcePill = document.createElement("span");
            sourcePill.className = "song-mood-pill";
            const durText = Number(song.duration_seconds) > 0 ? ` · ${song.duration_seconds}s` : "";
            sourcePill.textContent = audioKey.startsWith("builtin:")
                ? `Bawaan${durText}`
                : audioKey
                    ? `Upload Anda${durText}`
                    : "Bawaan";
            stateRow.append(sourcePill);
            if (song.mood) {
                const moodPill = document.createElement("span");
                moodPill.className = "song-mood-pill";
                moodPill.textContent = song.mood;
                stateRow.append(moodPill);
            }

            const actions = document.createElement("div");
            actions.className = "outfit-card-actions";
            if (audioKey) {
                const playBtn = document.createElement("button");
                playBtn.className = "btn small";
                playBtn.type = "button";
                const songKey = String(song.id || audioKey);
                const playerEl = $("song-preview-player");
                const isCurrentlyPlaying = Boolean(playerEl && !playerEl.paused && !playerEl.ended && activeSongPreviewId === songKey);
                playBtn.setAttribute("data-song-play-btn", "1");
                playBtn.setAttribute("data-song-key", songKey);
                playBtn.textContent = isCurrentlyPlaying ? "⏸ Berhenti" : "▶ Putar";
                playBtn.addEventListener("click", () => togglePlaySongPreview(song, playBtn));
                actions.append(playBtn);
            }
            const toggle = document.createElement("button");
            toggle.className = `btn small ${song.is_active === false ? "green" : ""}`;
            toggle.type = "button";
            toggle.textContent = song.is_active === false ? "Aktifkan" : "Nonaktifkan";
            toggle.addEventListener("click", () => toggleSong(song));
            const edit = document.createElement("button");
            edit.className = "btn small";
            edit.type = "button";
            edit.textContent = "Edit";
            edit.addEventListener("click", () => editSong(song));
            const remove = document.createElement("button");
            remove.className = "btn small danger";
            remove.type = "button";
            remove.textContent = "Hapus";
            remove.addEventListener("click", () => deleteSong(song, remove));
            actions.append(toggle, edit, remove);

            card.append(head, stateRow, actions);
            container.append(card);
        }
    }

    async function loadFacebookSongs() {
        if (!$("songs-list")) return;
        try {
            const result = await api("songs");
            state.songs = Array.isArray(result.songs) ? result.songs : [];
            state.songLibraryReady = result.songLibraryReady !== false;
            if (Array.isArray(result.defaultSongs) && result.defaultSongs.length) {
                state.defaultFacebookSongs = result.defaultSongs;
            }
            renderSongs();
            updateCollapsibleSummaries();
        } catch {
            renderSongs();
            updateCollapsibleSummaries();
        }
    }

    function resetSongForm() {
        $("song-form")?.reset?.();
        if ($("song-id")) $("song-id").value = "";
        if ($("song-file-field")) $("song-file-field").hidden = false;
        if ($("save-song")) $("save-song").textContent = "Unggah & simpan musik";
        if ($("cancel-song-edit")) $("cancel-song-edit").hidden = true;
        if (activeSongPreviewId === "__local_file__") {
            stopSongPreviewPlayer();
        }
    }

    function normalizeClientQuoteTarget(value) {
        const clean = String(value || "").trim().toLowerCase();
        return ["feed", "reels", "story", "feed_story"].includes(clean) ? clean : "feed";
    }

    function quoteTargetLabel(target) {
        const t = normalizeClientQuoteTarget(target);
        if (t === "reels") return "Facebook Reels + Page";
        if (t === "story") return "Cerita (Story 24 Jam)";
        if (t === "feed_story") return "Postingan Beranda + Cerita";
        return "Postingan Beranda Page";
    }

    function quotePublishButtonText(target) {
        const t = normalizeClientQuoteTarget(target);
        if (t === "reels") return "Terbitkan sebagai Reels FB";
        if (t === "story") return "Terbitkan ke Cerita FB";
        if (t === "feed_story") return "Terbitkan ke Beranda & Cerita";
        return "Terbitkan ke Beranda Page";
    }

    function editSong(song) {
        if (!$("song-form")) return;
        setStudioCardExpanded("songs-card", true);
        if ($("song-id")) $("song-id").value = song.id || "";
        if ($("song-title")) $("song-title").value = song.title || "";
        if ($("song-artist")) $("song-artist").value = song.artist || "";
        if ($("song-mood")) $("song-mood").value = song.mood || "";
        if ($("song-file-field")) $("song-file-field").hidden = true;
        if ($("save-song")) $("save-song").textContent = "Simpan perubahan musik";
        if ($("cancel-song-edit")) $("cancel-song-edit").hidden = false;
        $("songs-card")?.scrollIntoView?.({ behavior: "smooth", block: "start" });
        $("song-title")?.focus?.({ preventScroll: true });
    }

    async function submitSong(event) {
        event.preventDefault();
        const songStatus = $("song-status");
        const saveBtn = $("save-song");
        const id = $("song-id")?.value?.trim() || "";
        const audioFile = $("song-audio-file")?.files?.[0] || null;
        let title = $("song-title")?.value?.trim() || "";
        const artist = $("song-artist")?.value?.trim() || "";
        const mood = $("song-mood")?.value?.trim() || "";

        if (!title && audioFile?.name) {
            title = audioFile.name.replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[_-]+/g, " ").trim();
        }
        if (!title) {
            status(songStatus, "Judul lagu wajib diisi.", "error");
            return;
        }
        if (!id && !audioFile) {
            status(songStatus, "Pilih file lagu (.mp3, .m4a, .aac) atau video ber-audio (.mp4) terlebih dahulu, atau klik \"+ Isi 8 Musik Bawaan\".", "error");
            return;
        }
        if (audioFile && audioFile.size > 16 * 1024 * 1024) {
            status(songStatus, "Ukuran file lagu/video maksimal 16 MB.", "error");
            return;
        }

        const existingSong = id ? state.songs.find(item => item.id === id) : null;
        setButtonBusy(saveBtn, true, audioFile ? "Mengunggah audio…" : "Menyimpan…");
        status(songStatus, audioFile ? "Memeriksa trek audio dan mengunggah musik Cerita…" : "Menyimpan perubahan musik…");
        try {
            if (!id && audioFile) {
                const uploadResult = await api("upload-song", {
                    method: "POST",
                    body: audioFile,
                    raw: true,
                    headers: {
                        "Content-Type": audioFile.type || "application/octet-stream",
                        "X-File-Name": encodeURIComponent(audioFile.name),
                        "X-Song-Title": encodeURIComponent(title),
                        "X-Song-Artist": encodeURIComponent(artist),
                        "X-Song-Mood": encodeURIComponent(mood)
                    }
                });
                if (uploadResult?.song?.id) {
                    const cachedType = inferSongMimeType(uploadResult.song, "", audioFile.type);
                    const cachedBlob = audioFile.type === cachedType ? audioFile : new Blob([audioFile], { type: cachedType });
                    songPreviewBlobs.set(uploadResult.song.id, cachedBlob);
                    const bar = $("song-preview-bar");
                    const player = $("song-preview-player");
                    const titleEl = $("song-preview-title");
                    stopSongPreviewPlayer({ hideBar: false });
                    const readyUrl = URL.createObjectURL(cachedBlob);
                    state.objectUrls.set("song-audio-preview", readyUrl);
                    activeSongPreviewId = String(uploadResult.song.id);
                    if (titleEl) {
                        titleEl.textContent = `🎵 Siap diputar: ${title}${artist ? ` — ${artist}` : ""}`;
                    }
                    if (player) {
                        player.src = readyUrl;
                        player.onplay = () => syncSongPlayButtons();
                        player.onpause = () => syncSongPlayButtons();
                        player.onended = () => stopSongPreviewPlayer();
                        try { player.load?.(); } catch {}
                    }
                    if (bar) bar.hidden = false;
                }
            } else {
                await api("save-song", {
                    method: "POST",
                    body: {
                        id,
                        title,
                        artist,
                        mood,
                        is_active: existingSong ? existingSong.is_active !== false : true
                    }
                });
            }
            resetSongForm();
            status(songStatus, `Musik "${title}" tersimpan dan siap auto-play secara acak (maks. 60 detik di Beranda/Reels, maks. 25 detik di Cerita).`, "good");
            await loadFacebookSongs();
        } catch (error) {
            status(songStatus, error.message || "Gagal menyimpan musik Cerita.", "error");
        } finally {
            setButtonBusy(saveBtn, false);
            if ($("save-song")) {
                $("save-song").textContent = $("song-id")?.value ? "Simpan perubahan musik" : "Unggah & simpan musik Cerita";
            }
        }
    }

    async function toggleSong(song) {
        try {
            await api("save-song", {
                method: "POST",
                body: {
                    id: song.id,
                    title: song.title,
                    artist: song.artist || "",
                    mood: song.mood || "",
                    is_active: song.is_active === false
                }
            });
            await loadFacebookSongs();
        } catch (error) {
            showNotice(pageMessage, error.message, "error");
        }
    }

    async function deleteSong(song, button) {
        if (!confirmInlineAction(button, {
            label: "Konfirmasi hapus",
            ariaLabel: `Konfirmasi hapus musik ${song.title}`,
            title: `Hapus musik "${song.title}" dari koleksi Cerita Facebook?`
        })) return;
        try {
            stopSongPreviewPlayer();
            if (song.id) songPreviewBlobs.delete(song.id);
            await api("delete-song", { method: "POST", body: { id: song.id } });
            showNotice(pageMessage, `Musik "${song.title}" dihapus.`, "success");
            await loadFacebookSongs();
        } catch (error) {
            showNotice(pageMessage, error.message, "error");
        }
    }

    async function seedDefaultSongs() {
        const seedBtn = $("seed-default-songs");
        const songStatus = $("song-status");
        setButtonBusy(seedBtn, true, "Menambahkan…");
        status(songStatus, "Menambahkan 8 musik instrumental bawaan siap auto-play…");
        try {
            const result = await api("seed-default-songs", { method: "POST", body: {} });
            state.songs = Array.isArray(result.songs) ? result.songs : state.songs;
            renderSongs();
            status(
                songStatus,
                result.added > 0
                    ? `${result.added} musik instrumental bawaan siap auto-play ditambahkan ke koleksi Anda.`
                    : "Seluruh 8 musik instrumental bawaan sudah ada di koleksi Anda.",
                "good"
            );
        } catch (error) {
            status(songStatus, error.message || "Gagal mengisi musik bawaan.", "error");
        } finally {
            setButtonBusy(seedBtn, false);
        }
    }

    function updateManualCharacterPreview() {
        const postMode = $("manual-post-mode")?.value === "quote" ? "quote" : "character";
        const characterId = $("manual-character").value;
        const preview = $("manual-character-preview");
        const placeholder = $("manual-character-placeholder");
        if (state.manualPreview) return;
        if (postMode === "quote") {
            preview.hidden = true;
            preview.removeAttribute("src");
            placeholder.textContent = "Mode Cerita Kata-kata Mutiara + Musik Auto-Play aktif — klik Buat & bersihkan pratinjau untuk merender Video Cerita 9:16 lengkap dengan musik auto-play.";
            placeholder.hidden = false;
            return;
        }
        placeholder.textContent = "Pilih karakter untuk melihat foto referensinya.";
        preview.dataset.characterId = characterId;
        if (!characterId) {
            preview.hidden = true;
            preview.removeAttribute("src");
            placeholder.hidden = false;
            return;
        }
        const character = state.data?.characters?.find(item => item.id === characterId);
        preview.alt = `Foto referensi ${character?.display_name || "karakter"} yang dipilih`;
        preview.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='54' height='66'%3E%3Crect width='100%25' height='100%25' fill='%231b2737'/%3E%3C/svg%3E";
        preview.hidden = false;
        placeholder.hidden = true;
        loadReferencePreview(characterId, preview);
    }

    async function submitManualPost(event) {
        event.preventDefault();
        /* Pratinjau baru membatalkan konfirmasi pratinjau sebelumnya. */
        disarmManualPublish();
        const postMode = $("manual-post-mode")?.value === "quote" ? "quote" : "character";
        const isQuote = postMode === "quote";
        const characterId = $("manual-character").value;
        const pageConnectionId = $("manual-page").value;
        if ((!isQuote && !characterId) || !pageConnectionId) {
            status(
                $("manual-post-status"),
                isQuote
                    ? "Pilih Facebook Page tujuan sebelum membuat poster kata-kata mutiara."
                    : "Pilih karakter tersimpan dan Facebook Page.",
                "error"
            );
            return;
        }
        const button = $("manual-post-button");
        let generatedRunId = "";
        setButtonBusy(button, true, isQuote ? "Merangkai kata mutiara via LLM…" : "Membuat gambar AI…", {
            premium: true,
            stages: isQuote
                ? [
                    { at: 0, text: "Merangkai kata mutiara via LLM…" },
                    { at: 3, text: "Merender kartu latar hitam & tanda tangan…" },
                    { at: 7, text: "Menggabungkan musik auto-play…" }
                ]
                : [
                    { at: 0, text: "Membuat gambar AI…" },
                    { at: 7, text: "Merancang visual & caption…" },
                    { at: 16, text: "Menyempurnakan detail gambar…" }
                ]
        });
        status(
            $("manual-post-status"),
            isQuote
                ? "Merangkai kata-kata mutiara lewat LLM QwenCloud di atas latar hitam polos (tanpa memakai kuota gambar) dan menyematkan lagu acak…"
                : "Membuat satu gambar, membersihkan metadata, dan menyiapkan caption untuk pratinjau…"
        );
        try {
            if (state.manualPreview) await discardManualPreview(false);
            const selectedQuoteTarget = normalizeClientQuoteTarget($("manual-quote-target")?.value);
            const requestBody = isQuote
                ? {
                    post_mode: "quote",
                    quote_publish_target: selectedQuoteTarget,
                    page_connection_id: pageConnectionId,
                    aspect_ratio: $("manual-aspect-ratio").value,
                    quote_theme: $("manual-quote-theme")?.value || "",
                    quote_visual_style: $("manual-quote-visual")?.value || "",
                    custom_quote: $("manual-custom-quote")?.value?.trim() || "",
                    use_random_song: $("manual-quote-random-song") ? $("manual-quote-random-song").checked : true
                }
                : {
                    character_id: characterId,
                    page_connection_id: pageConnectionId,
                    aspect_ratio: $("manual-aspect-ratio").value,
                    ...($("manual-character-random-song")?.checked ? { use_random_song: true } : {})
                };
            let result = null;
            const maxManualPolicyRetries = isQuote ? 0 : 3;
            for (let policyAttempt = 0; policyAttempt <= maxManualPolicyRetries; policyAttempt += 1) {
                try {
                    result = await api("manual-generate", {
                        method: "POST",
                        body: policyAttempt > 0
                            ? { ...requestBody, policy_retry_attempt: policyAttempt }
                            : requestBody
                    });
                    break;
                } catch (genError) {
                    const errText = String(genError?.message || "");
                    const isOpusPolicy = /Permintaan gambar ditolak kebijakan konten Opus|safety[_\s-]*violations|rejected by the safety system/i.test(errText);
                    if (!isOpusPolicy || policyAttempt >= maxManualPolicyRetries) {
                        throw genError;
                    }
                    const nextAttemptNumber = policyAttempt + 1;
                    status(
                        $("manual-post-status"),
                        `${errText} — Langsung membuat ulang gambar baru secara otomatis (${nextAttemptNumber}/${maxManualPolicyRetries})…`,
                        "warn"
                    );
                    updateButtonBusyText(button, `Ditolak policy Opus, langsung generate ulang (${nextAttemptNumber}/${maxManualPolicyRetries})…`);
                    loadRunsPage(1).catch(() => {});
                }
            }
            generatedRunId = result.preview.run_id;
            const isQuoteVideoPreview = Boolean(result.preview.video_base64);
            const resolvedQuoteTarget = normalizeClientQuoteTarget(result.preview.quote_publish_target || selectedQuoteTarget);
            const binary = atob(result.preview.image_base64);
            const bytes = new Uint8Array(binary.length);
            for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
            const generatedBlob = new Blob([bytes], { type: result.preview.image_mime_type });

            const videoEl = $("manual-generated-video");
            const audioEl = $("manual-generated-audio");
            const imgEl = $("manual-generated-preview");
            const publishBtn = $("manual-publish-button");

            if (isQuoteVideoPreview) {
                updateButtonBusyText(button, "Menyiapkan kartu video & musik auto-play…");
                const videoBinary = atob(result.preview.video_base64);
                const videoBytes = new Uint8Array(videoBinary.length);
                for (let index = 0; index < videoBinary.length; index += 1) videoBytes[index] = videoBinary.charCodeAt(index);
                const videoBlob = new Blob([videoBytes], { type: result.preview.video_mime_type || "video/mp4" });
                const videoUrl = URL.createObjectURL(videoBlob);
                const posterUrl = URL.createObjectURL(generatedBlob);
                const prevVideoUrl = state.objectUrls.get("manual-preview-video");
                if (prevVideoUrl) URL.revokeObjectURL(prevVideoUrl);
                const prevPosterUrl = state.objectUrls.get("manual-preview");
                if (prevPosterUrl) URL.revokeObjectURL(prevPosterUrl);
                state.objectUrls.set("manual-preview-video", videoUrl);
                state.objectUrls.set("manual-preview", posterUrl);

                state.manualPreview = {
                    runId: result.preview.run_id,
                    blob: videoBlob,
                    isQuoteVideo: true,
                    quoteTarget: resolvedQuoteTarget,
                    pageConnectionId,
                    durationSeconds: Number(result.preview.duration_seconds) || 0,
                    quoteSignature: result.preview.quote_signature || (result.preview.page_name ? `quote by: ${result.preview.page_name}` : ""),
                    song: result.preview.song || null,
                    quoteTheme: result.preview.quote_theme || "",
                    pageName: result.preview.page_name,
                    caption: result.preview.caption
                };
                if (videoEl) {
                    try { videoEl.pause?.(); } catch {}
                    videoEl.removeAttribute("src");
                    videoEl.removeAttribute("poster");
                    videoEl.hidden = true;
                }
                if (imgEl) {
                    imgEl.src = posterUrl;
                    imgEl.hidden = false;
                }
                if (audioEl) {
                    audioEl.src = videoUrl;
                    audioEl.hidden = false;
                    audioEl.load?.();
                }
                if (publishBtn) publishBtn.textContent = quotePublishButtonText(resolvedQuoteTarget);
            } else {
                updateButtonBusyText(button, "Membersihkan metadata…");
                const cleaned = await cleanImage(generatedBlob);
                const objectUrl = URL.createObjectURL(cleaned.blob);
                const previousUrl = state.objectUrls.get("manual-preview");
                if (previousUrl) URL.revokeObjectURL(previousUrl);
                state.objectUrls.set("manual-preview", objectUrl);
                state.manualPreview = {
                    runId: result.preview.run_id,
                    blob: cleaned.blob,
                    isQuoteVideo: false,
                    pageName: result.preview.page_name,
                    caption: result.preview.caption
                };
                if (videoEl) {
                    try { videoEl.pause?.(); } catch {}
                    videoEl.removeAttribute("src");
                    videoEl.hidden = true;
                }
                if (audioEl) {
                    try { audioEl.pause?.(); } catch {}
                    audioEl.removeAttribute("src");
                    audioEl.hidden = true;
                }
                if (imgEl) {
                    imgEl.src = objectUrl;
                    imgEl.hidden = false;
                }
                if (publishBtn) publishBtn.textContent = "Terbitkan ke Facebook Page";
            }

            $("manual-generated-result").hidden = false;
            $("manual-character-preview").hidden = true;
            $("manual-character-placeholder").hidden = true;
            $("manual-generated-caption").textContent = isQuoteVideoPreview
                ? `“${result.preview.quote_text || result.preview.caption}”`
                : result.preview.caption;
            showManualOutfit(result.preview.outfit);
            showManualSong(
                result.preview.song,
                result.preview.quote_theme,
                isQuoteVideoPreview ? resolvedQuoteTarget : "",
                isQuoteVideoPreview ? state.manualPreview.durationSeconds : 0,
                isQuoteVideoPreview ? state.manualPreview.quoteSignature : ""
            );
            const outfitNote = result.preview.outfit?.name
                ? ` Outfit acak: ${result.preview.outfit.name}${result.preview.outfit.order_url ? " (link order disertakan di caption)" : ""}.`
                : "";
            const songNote = result.preview.song?.title
                ? ` Musik auto-play: ${result.preview.song.title}${result.preview.song.artist ? ` — ${result.preview.song.artist}` : ""}.`
                : "";
            status(
                $("manual-post-status"),
                isQuoteVideoPreview
                    ? `Kartu video Kata-kata Mutiara 9:16 selesai dibuat. Kartu dan kontrol audio pratinjau tampil di sebelah kanan.${songNote} Terbitkan ke ${quoteTargetLabel(resolvedQuoteTarget)} setelah diperiksa.`
                    : `Gambar ${result.preview.aspect_ratio} selesai dibuat dan dibersihkan.${outfitNote}${songNote} Periksa pratinjau serta caption sebelum menerbitkan.`,
                "good"
            );
        } catch (error) {
            let cleanupMessage = "";
            if (generatedRunId) {
                try {
                    await api("manual-discard", { method: "POST", body: { run_id: generatedRunId } });
                } catch (discardError) {
                    cleanupMessage = ` Gagal menutup run pratinjau: ${discardError.message || "kesalahan server"}.`;
                }
            }
            status($("manual-post-status"), `${error.message || "Gagal membuat pratinjau."}${cleanupMessage}`, "error");
        } finally {
            setButtonBusy(button, false);
        }
    }

    const PUBLISH_ARM_TIMEOUT_MS = 9000;

    /** Label tombol terbit sesuai mode pratinjau (foto vs Kata-kata Mutiara). */
    function manualPublishLabel(preview = state.manualPreview) {
        return preview?.isQuoteVideo
            ? quotePublishButtonText(normalizeClientQuoteTarget(preview.quoteTarget))
            : "Terbitkan ke Facebook Page";
    }

    /**
     * Membatalkan status "siap terbit" tanpa menyentuh pratinjau.
     *
     * Dipakai saat user mengubah Page/target, membuat pratinjau baru, atau
     * membiarkan tombol terlalu lama. Tidak ada dialog, tidak ada blok
     * mengambang — hanya tombol yang kembali ke label semula.
     */
    function disarmManualPublish({ silent = true } = {}) {
        if (state.publishArmTimer) {
            clearTimeout(state.publishArmTimer);
            state.publishArmTimer = null;
        }
        if (!state.publishArmed) {
            resetDiscardButtonLabel();
            return;
        }
        state.publishArmed = false;
        const button = $("manual-publish-button");
        if (button) {
            if (!button.classList.contains("is-premium-loading")) {
                button.textContent = manualPublishLabel();
            }
            button.classList.remove("is-confirming");
            button.removeAttribute("aria-pressed");
            button.setAttribute("aria-label", manualPublishLabel());
        }
        resetDiscardButtonLabel();
        if (!silent) {
            status($("manual-post-status"), "Penerbitan dibatalkan. Klik tombol terbit jika ingin mencoba lagi.");
        }
    }

    function resetDiscardButtonLabel() {
        const discard = $("manual-discard-button");
        if (discard) discard.textContent = "Buang pratinjau";
    }

    /**
     * Mengubah tombol terbit menjadi tombol konfirmasi.
     *
     * Rincian tujuan terbit ditulis di baris status yang sudah ada, jadi user
     * tetap melihat ke Page/target mana post akan dikirim tanpa blok
     * mengambang yang menutupi pratinjau di layar HP.
     */
    function armManualPublish(preview) {
        const button = $("manual-publish-button");
        const isQuoteVideo = preview.isQuoteVideo === true;
        const quoteTarget = isQuoteVideo
            ? normalizeClientQuoteTarget($("manual-quote-target")?.value || preview.quoteTarget)
            : "";
        const targetLabel = isQuoteVideo ? quoteTargetLabel(quoteTarget) : "Facebook Page";

        state.publishArmed = true;
        if (state.publishArmTimer) clearTimeout(state.publishArmTimer);
        state.publishArmTimer = setTimeout(() => {
            state.publishArmTimer = null;
            if (state.publishArmed) {
                disarmManualPublish({ silent: false });
                status(
                    $("manual-post-status"),
                    "Konfirmasi terbit kedaluwarsa. Klik tombol terbit lagi bila masih ingin menerbitkan.",
                    "error"
                );
            }
        }, PUBLISH_ARM_TIMEOUT_MS);

        if (button) {
            button.textContent = isQuoteVideo
                ? `Konfirmasi: ${quotePublishButtonText(quoteTarget)}?`
                : "Konfirmasi: Terbitkan sekarang";
            button.classList.add("is-confirming");
            button.setAttribute("aria-pressed", "true");
            button.setAttribute("aria-label", `Konfirmasi terbitkan ke ${targetLabel} "${preview.pageName}"`);
            button.focus?.();
        }

        /* Tombol buang sementara menjadi "Batal" supaya tidak salah hapus. */
        const discard = $("manual-discard-button");
        if (discard) discard.textContent = "Batal";

        status(
            $("manual-post-status"),
            isQuoteVideo
                ? `Klik tombol sekali lagi untuk menerbitkan ke ${targetLabel} "${preview.pageName}". Post langsung terlihat audiens. Batal otomatis dalam ${Math.round(PUBLISH_ARM_TIMEOUT_MS / 1000)} detik.`
                : `Klik tombol sekali lagi untuk menerbitkan ke "${preview.pageName}". Post langsung terlihat audiens Page. Batal otomatis dalam ${Math.round(PUBLISH_ARM_TIMEOUT_MS / 1000)} detik.`
        );
    }

    async function publishManualPreview() {
        if (!state.manualPreview) {
            status($("manual-post-status"), "Buat pratinjau terlebih dahulu.", "error");
            return;
        }
        const isQuoteVideo = state.manualPreview.isQuoteVideo === true;
        const pageConnectionId = $("manual-page").value;
        if (isQuoteVideo && state.manualPreview.pageConnectionId && pageConnectionId && pageConnectionId !== state.manualPreview.pageConnectionId) {
            status(
                $("manual-post-status"),
                `Facebook Page diubah setelah pratinjau dibuat (tanda tangan pojok kanan bawah saat ini: "${state.manualPreview.quoteSignature || `quote by: ${state.manualPreview.pageName}`}"). Klik "Buat & bersihkan pratinjau" ulang agar tanda tangan sesuai akun FB yang memposting.`,
                "error"
            );
            return;
        }
        const quoteTarget = isQuoteVideo
            ? normalizeClientQuoteTarget($("manual-quote-target")?.value || state.manualPreview.quoteTarget)
            : "";
        const targetLabel = isQuoteVideo ? quoteTargetLabel(quoteTarget) : "Facebook Page";

        /*
         * Konfirmasi DI DALAM tombol, bukan dialog mengambang.
         *
         * Klik pertama hanya mempersenjatai tombol dan menuliskan tujuan
         * terbit di baris status; klik kedua barulah mengirim. Perubahan
         * Page/target sudah mematikan status ini lewat listener terkait.
         */
        if (!state.publishArmed) {
            armManualPublish(state.manualPreview);
            return;
        }

        disarmManualPublish();

        const button = $("manual-publish-button");
        const discardButton = $("manual-discard-button");
        if (button) {
            button.dataset.originalText = manualPublishLabel();
            button.textContent = manualPublishLabel();
            button.classList.remove("is-confirming");
        }
        if (discardButton) discardButton.disabled = true;
        setButtonBusy(button, true, isQuoteVideo ? `Menerbitkan ke ${targetLabel}…` : "Mengunggah ke Facebook Page…", {
            premium: true,
            stages: isQuoteVideo
                ? [
                    { at: 0, text: "Mengunggah video + musik ke FB…" },
                    { at: 5, text: `Menerbitkan ke ${targetLabel}…` }
                ]
                : [
                    { at: 0, text: "Mengunggah ke Facebook Page…" },
                    { at: 5, text: "Menerbitkan posting Page…" }
                ]
        });
        status($("manual-post-status"), isQuoteVideo ? `Mengunggah Kata-kata Mutiara + musik auto-play ke ${targetLabel}…` : "Mengirim gambar yang sudah dibersihkan ke Facebook Page…");
        try {
            const result = await api("manual-publish", {
                method: "POST",
                body: state.manualPreview.blob,
                raw: true,
                responseRaw: false,
                headers: {
                    "Content-Type": state.manualPreview.blob.type,
                    "X-Manual-Run-Id": state.manualPreview.runId,
                    ...(isQuoteVideo ? { "X-Quote-Target": quoteTarget } : {})
                }
            });
            const postUrl = safeExternalUrl(result.post?.permalink_url);
            status(
                $("manual-post-status"),
                isQuoteVideo
                    ? `Kata-kata Mutiara + musik auto-play berhasil diterbitkan ke ${targetLabel} (${result.post?.page_name || "Facebook Page"}).${postUrl ? ` ${postUrl}` : ""}`
                    : `Posting berhasil diterbitkan ke ${result.post?.page_name || "Facebook Page"}.${postUrl ? ` ${postUrl}` : ""}`,
                "good"
            );
            showNotice(pageMessage, isQuoteVideo ? `Berhasil diterbitkan ke ${targetLabel} dengan musik auto-play.` : "Posting manual berhasil diterbitkan.", "success");
            clearManualPreview();
            state.runsPage = 1;
            await loadDashboard();
        } catch (error) {
            clearManualPreview();
            const permissionProblem = ["permission_denied", "missing_page_role", "token_invalid", "missing_page_token"].includes(error.code);
            const guidance = permissionProblem
                ? " Posting tidak terkirim, jadi aman dicoba lagi setelah izin diperbaiki: klik \"Periksa izin\" pada Page atau hubungkan ulang Facebook."
                : error.retrySafe === false
                    ? " Posting mungkin sudah masuk ke Page — periksa Page di Facebook sebelum mencoba ulang untuk menghindari post ganda."
                    : " Posting tidak terkirim; periksa Page sebelum mencoba ulang untuk menghindari post ganda.";
            const message = `${error.message || "Posting manual gagal."}${guidance}`;
            status($("manual-post-status"), message, "error");
            showNotice(pageMessage, message, "error");
            if (permissionProblem && pageConnectionId) {
                await checkPagePermission(pageConnectionId);
            } else {
                await loadDashboard();
            }
        } finally {
            setButtonBusy(button, false);
            if (button) {
                /* Label dasar dipulihkan; bukan teks "Konfirmasi…" yang tersisa. */
                button.dataset.originalText = manualPublishLabel();
                button.textContent = manualPublishLabel();
                button.classList.remove("is-confirming");
                button.removeAttribute("aria-pressed");
            }
            if (discardButton) discardButton.disabled = false;
        }
    }

    function showManualOutfit(outfit) {
        const line = $("manual-outfit-line");
        if (!line) return;
        line.replaceChildren();
        if (!outfit?.name) {
            line.hidden = true;
            return;
        }
        const label = document.createElement("strong");
        label.textContent = `Outfit terpilih acak: ${outfit.name}`;
        line.append(label);
        const orderUrl = safeHttpsLink(outfit.order_url);
        if (orderUrl) {
            const link = document.createElement("a");
            link.href = orderUrl;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = orderUrl;
            line.append(document.createTextNode(" · "), link);
        }
        line.hidden = false;
    }

    function showManualSong(song, quoteTheme = "", quoteTarget = "", durationSeconds = 0, quoteSignature = "") {
        const line = $("manual-song-line");
        if (!line) return;
        line.replaceChildren();
        if (!song?.title && !quoteTheme && !quoteTarget && !quoteSignature) {
            line.hidden = true;
            return;
        }
        if (quoteTarget) {
            const targetStrong = document.createElement("strong");
            const durInfo = durationSeconds > 0
                ? ` · Durasi: ${quoteTarget === "story" ? Math.min(25, durationSeconds) : durationSeconds}s`
                : "";
            targetStrong.textContent = `📌 Target: ${quoteTargetLabel(quoteTarget)}${durInfo} · Tanpa caption/link/hashtag`;
            line.append(targetStrong);
        }
        if (quoteSignature) {
            if (line.childNodes.length) line.append(document.createTextNode(" · "));
            const sigStrong = document.createElement("strong");
            sigStrong.textContent = `✍️ ${quoteSignature}`;
            line.append(sigStrong);
        }
        if (quoteTheme) {
            if (line.childNodes.length) line.append(document.createTextNode(" · "));
            const themeStrong = document.createElement("strong");
            themeStrong.textContent = `Tema: ${quoteTheme}`;
            line.append(themeStrong);
        }
        if (song?.title) {
            if (line.childNodes.length) line.append(document.createTextNode(" · "));
            const songStrong = document.createElement("strong");
            songStrong.textContent = `🎵 Musik auto-play: ${song.title}${song.artist ? ` — ${song.artist}` : ""}`;
            line.append(songStrong);
        }
        line.hidden = false;
    }

    function clearManualPreview() {
        const previewUrl = state.objectUrls.get("manual-preview");
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        state.objectUrls.delete("manual-preview");
        const videoUrl = state.objectUrls.get("manual-preview-video");
        if (videoUrl) URL.revokeObjectURL(videoUrl);
        state.objectUrls.delete("manual-preview-video");
        state.manualPreview = null;
        const videoEl = $("manual-generated-video");
        if (videoEl) {
            try { videoEl.pause?.(); } catch {}
            videoEl.removeAttribute("src");
            videoEl.removeAttribute("poster");
            videoEl.hidden = true;
        }
        const audioEl = $("manual-generated-audio");
        if (audioEl) {
            try { audioEl.pause?.(); } catch {}
            audioEl.removeAttribute("src");
            audioEl.hidden = true;
        }
        const imgEl = $("manual-generated-preview");
        if (imgEl) {
            imgEl.removeAttribute("src");
            imgEl.hidden = false;
        }
        disarmManualPublish();
        if ($("manual-publish-button")) $("manual-publish-button").textContent = manualPublishLabel(null);
        $("manual-generated-result").hidden = true;
        $("manual-outfit-line").hidden = true;
        if ($("manual-song-line")) $("manual-song-line").hidden = true;
        updateManualCharacterPreview();
    }

    async function discardManualPreview(reportErrors = true) {
        if (!state.manualPreview) return;
        try {
            await api("manual-discard", {
                method: "POST",
                body: { run_id: state.manualPreview.runId }
            });
            clearManualPreview();
        } catch (error) {
            if (reportErrors) status($("manual-post-status"), error.message || "Pratinjau gagal dibuang.", "error");
            throw error;
        }
    }

    async function savePostingSettings(event) {
        event.preventDefault();
        const button = $("save-posting-settings");
        setButtonBusy(button, true, "Menyimpan…");
        status($("posting-settings-status"), "Menyimpan caption dasar dan link…");
        try {
            const result = await api("save-posting-settings", {
                method: "POST",
                body: {
                    caption_template: $("default-caption-template").value,
                    external_link: $("external-post-link").value
                }
            });
            if (state.data) state.data.postingSettings = result.postingSettings;
            updateCollapsibleSummaries();
            status($("posting-settings-status"), "Caption dasar dan link tersimpan; akan dipakai di semua posting berikutnya.", "good");
        } catch (error) {
            status($("posting-settings-status"), error.message || "Pengaturan caption gagal disimpan.", "error");
        } finally {
            setButtonBusy(button, false);
        }
    }

    function editCharacter(character) {
        openEditModal("character", character);
    }

    const MIN_IMAGE_DIMENSION = 240;

    function readImageDimensions(file) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
                const width = img.naturalWidth;
                const height = img.naturalHeight;
                URL.revokeObjectURL(url);
                resolve({ width, height });
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error("File gambar tidak dapat dibaca."));
            };
            img.src = url;
        });
    }

    /* Validasi upload foto: tipe + ukuran + resolusi minimal, supaya file kecil
       (mis. kompresan WhatsApp) tidak ditolak provider gambar di tengah run. */
    async function validateImageFile(file) {
        if (!/image\/(jpeg|png|webp)/.test(file.type) || file.size > 8 * 1024 * 1024) {
            throw new Error("Pilih JPEG, PNG, atau WebP berukuran maksimal 8 MB.");
        }
        const { width, height } = await readImageDimensions(file);
        if (width < MIN_IMAGE_DIMENSION || height < MIN_IMAGE_DIMENSION) {
            throw new Error(
                `Resolusi foto minimal ${MIN_IMAGE_DIMENSION}×${MIN_IMAGE_DIMENSION} piksel; file ini ${width}×${height} piksel. ` +
                "Pakai file asli beresolusi lebih besar agar tidak ditolak provider gambar."
            );
        }
        return { width, height };
    }

    let editModalPreviewUrl = null;

    function editModalStatus(message, tone = "") {
        status($("edit-modal-status"), message, tone);
    }

    function loadEditModalCurrentPhoto() {
        const meta = state.editModal;
        if (!meta) return;
        const photo = $("edit-modal-photo");
        if (meta.type === "character") loadReferencePreview(meta.id, photo);
        else loadOutfitPreview(meta.id, photo);
    }

    function openEditModal(type, data) {
        const isCharacter = type === "character";
        state.editModal = { type, id: data.id, isActive: data.is_active !== false };
        $("edit-modal-title").textContent = isCharacter
            ? `Edit karakter · ${data.display_name || ""}`
            : `Edit outfit · ${data.name || ""}`;
        $("edit-modal-name").value = isCharacter ? (data.display_name || "") : (data.name || "");
        const notes = $("edit-modal-notes");
        notes.maxLength = isCharacter ? 1200 : 400;
        notes.value = isCharacter ? (data.prompt_notes || "") : (data.notes || "");
        $("edit-modal-order-field").hidden = isCharacter;
        $("edit-modal-order").value = isCharacter ? "" : (data.order_url || "");
        const fileInput = $("edit-modal-file");
        fileInput.value = "";
        if (editModalPreviewUrl) {
            URL.revokeObjectURL(editModalPreviewUrl);
            editModalPreviewUrl = null;
        }
        $("edit-modal-file-name").textContent = "Tanpa file baru: foto tidak diganti.";
        const photo = $("edit-modal-photo");
        photo.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='74' height='92'%3E%3Crect width='100%25' height='100%25' fill='%231b2737'/%3E%3C/svg%3E";
        if (isCharacter) {
            photo.dataset.characterId = data.id;
            delete photo.dataset.outfitId;
            loadReferencePreview(data.id, photo);
        } else {
            photo.dataset.outfitId = data.id;
            delete photo.dataset.characterId;
            loadOutfitPreview(data.id, photo);
        }
        editModalStatus("");
        $("edit-modal-overlay").hidden = false;
        $("edit-modal-name").focus({ preventScroll: true });
    }

    function closeEditModal() {
        const needsReload = state.editModal?.needsReload === true;
        state.editModal = null;
        if (editModalPreviewUrl) {
            URL.revokeObjectURL(editModalPreviewUrl);
            editModalPreviewUrl = null;
        }
        $("edit-modal-overlay").hidden = true;
        if (needsReload) loadDashboard().catch(() => {});
    }

    async function saveEditModal() {
        const meta = state.editModal;
        if (!meta) return;
        const isCharacter = meta.type === "character";
        const name = $("edit-modal-name").value.trim();
        if (!name) {
            editModalStatus("Nama tidak boleh kosong.", "error");
            return;
        }
        const notes = $("edit-modal-notes").value.trim();
        const orderUrl = $("edit-modal-order").value.trim();
        if (!isCharacter && orderUrl && !safeHttpsLink(orderUrl)) {
            editModalStatus("Link order harus berupa URL HTTPS yang valid.", "error");
            return;
        }
        const file = $("edit-modal-file").files?.[0] || null;
        if (file) {
            try {
                await validateImageFile(file);
            } catch (error) {
                editModalStatus(error.message, "error");
                return;
            }
        }
        const saveButton = $("edit-modal-save");
        setButtonBusy(saveButton, true, "Menyimpan…");
        try {
            if (isCharacter) {
                await api("save-character", { method: "POST", body: { id: meta.id, display_name: name, prompt_notes: notes } });
            } else {
                await api("save-outfit", {
                    method: "POST",
                    body: { id: meta.id, name, order_url: orderUrl, notes, is_active: meta.isActive }
                });
            }
            if (file) {
                editModalStatus("Data tersimpan; mengunggah foto baru…");
                await api(isCharacter ? "replace-reference" : "replace-outfit-photo", {
                    method: "POST",
                    body: file,
                    raw: true,
                    headers: {
                        "Content-Type": file.type,
                        "X-File-Name": encodeURIComponent(file.name),
                        ...(isCharacter
                            ? { "X-Character-Id": encodeURIComponent(meta.id) }
                            : { "X-Outfit-Id": encodeURIComponent(meta.id) })
                    }
                });
                /* Panel tetap terbuka supaya foto yang berhasil diunggah
                   terlihat sebagai review di blok foto sebelum ditutup. */
                $("edit-modal-file").value = "";
                $("edit-modal-file-name").textContent = "Foto baru aktif — pratinjau di atas adalah foto yang berhasil diunggah.";
                editModalStatus(`${isCharacter ? "Karakter" : "Outfit"} diperbarui; foto baru berhasil diunggah.`, "good");
                state.editModal.needsReload = true;
            } else {
                closeEditModal();
                showNotice(pageMessage, isCharacter ? "Karakter diperbarui." : "Outfit diperbarui.", "success");
                await loadDashboard();
            }
        } catch (error) {
            editModalStatus(error.message, "error");
        } finally {
            setButtonBusy(saveButton, false);
        }
    }

    async function deleteCharacter(character, button) {
        const outfitCount = (state.data?.outfits || []).filter(outfit => outfit.character_id === character.id).length;
        if (!confirmInlineAction(button, {
            label: "Konfirmasi hapus",
            ariaLabel: `Konfirmasi hapus karakter ${character.display_name}`,
            title: `Hapus karakter "${character.display_name}"?${outfitCount ? ` ${outfitCount} outfit karakter ini ikut terhapus.` : ""} Tindakan ini tidak dapat dibatalkan.`
        })) return;
        try {
            await api("delete-character", { method: "POST", body: { id: character.id } });
            showNotice(pageMessage, `Karakter "${character.display_name}" dihapus.`, "success");
        } catch (error) {
            showNotice(pageMessage, error.message, "error");
            return;
        }
        await loadDashboard();
    }

    function pageName(id) {
        return state.data?.pages?.find(page => page.id === id)?.page_name || "Page";
    }
    function characterName(id) {
        return state.data?.characters?.find(character => character.id === id)?.display_name || "Karakter";
    }

    const scheduleCountdown = { timer: null, nodes: [] };

    function formatScheduleCountdown(remainingMs) {
        const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        const pad = value => String(value).padStart(2, "0");
        return days > 0
            ? `${days} hari ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
            : `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }

    function updateScheduleCountdownNode(node) {
        if (!node) return;
        const target = Number(node.dataset.countdownTarget);
        const label = node.querySelector(".schedule-countdown-label");
        const value = node.querySelector(".schedule-countdown-value");
        if (!Number.isFinite(target) || !value) return;
        const remaining = target - Date.now();
        if (remaining <= 0) {
            node.dataset.countdownState = "waiting";
            if (label) label.textContent = "Menunggu eksekusi otomatis";
            value.textContent = "00:00:00";
            return;
        }
        node.dataset.countdownState = "running";
        if (label) label.textContent = "Autopublish aktif · posting berikutnya dalam";
        value.textContent = formatScheduleCountdown(remaining);
    }

    function createScheduleCountdown(schedule) {
        const target = Date.parse(schedule.next_run_at);
        if (!Number.isFinite(target)) return null;
        const box = document.createElement("div");
        box.className = "schedule-countdown";
        box.setAttribute("role", "timer");
        box.dataset.countdownTarget = String(target);
        box.title = `Posting otomatis berikutnya ${formatDate(schedule.next_run_at)}`;
        const label = document.createElement("span");
        label.className = "schedule-countdown-label";
        const value = document.createElement("span");
        value.className = "schedule-countdown-value";
        value.setAttribute("aria-live", "off");
        box.append(label, value);
        updateScheduleCountdownNode(box);
        scheduleCountdown.nodes.push(box);
        return box;
    }

    function startScheduleCountdown() {
        if (scheduleCountdown.timer !== null) {
            window.clearInterval(scheduleCountdown.timer);
            scheduleCountdown.timer = null;
        }
        if (!scheduleCountdown.nodes.length) return;
        scheduleCountdown.timer = window.setInterval(() => {
            for (const node of scheduleCountdown.nodes) {
                if (node.isConnected) updateScheduleCountdownNode(node);
            }
        }, 1000);
    }

    function stopScheduleCountdown() {
        if (scheduleCountdown.timer !== null) {
            window.clearInterval(scheduleCountdown.timer);
            scheduleCountdown.timer = null;
        }
        scheduleCountdown.nodes = [];
    }

    const SCENE_PRESET_FIELDS = [
        ["schedule-location", "locations", "Acak otomatis"],
        ["schedule-angle", "angles", "Otomatis — medium shot"],
        ["schedule-situation", "situations", "Acak otomatis"],
        ["schedule-atmosphere", "atmospheres", "Acak otomatis"],
        ["schedule-condition", "conditions", "Acak otomatis"],
        ["schedule-lighting", "lighting", "Acak otomatis"]
    ];

    /**
     * Mengisi dropdown parameter gambar dari `scenePresets` yang dikirim API.
     * Nilai kosong = otomatis (server mengacak / memakai medium shot).
     */
    function populateScenePresets(presets = {}) {
        for (const [elementId, presetKey, emptyLabel] of SCENE_PRESET_FIELDS) {
            const select = $(elementId);
            if (!select) continue;
            const previous = select.value;
            const options = Array.isArray(presets?.[presetKey]) ? presets[presetKey] : [];
            if (!options.length) continue;
            select.replaceChildren(new Option(emptyLabel, ""));
            for (const option of options) {
                select.add(new Option(option.label, option.value));
            }
            select.value = options.some(option => option.value === previous) ? previous : "";
        }
    }

    function sceneSummary(schedule) {
        if (schedule.post_mode === "quote") {
            const parts = [quoteTargetLabel(schedule.quote_publish_target || "feed")];
            const themeLabel = state.data?.quotePresets?.themes?.find(t => (t.value ?? t.id) === schedule.quote_theme)?.label || schedule.quote_theme;
            parts.push(themeLabel ? `tema ${themeLabel}` : "tema acak");
            parts.push("latar hitam hemat kuota");
            parts.push(schedule.use_random_song !== false ? "🎵 musik auto-play ON" : "tanpa musik acak");
            return parts.join(" · ");
        }
        const parts = [];
        const angle = schedule.camera_angle || "medium shot";
        parts.push(`angle ${angle}`);
        if (schedule.scene_location) parts.push(`lokasi ${schedule.scene_location}`);
        if (schedule.scene_atmosphere) parts.push(`suasana ${schedule.scene_atmosphere}`);
        if (schedule.scene_condition) parts.push(`kondisi ${schedule.scene_condition}`);
        if (schedule.scene_lighting) parts.push(`cahaya ${schedule.scene_lighting}`);
        if (schedule.use_random_song === true) parts.push("🎵 lagu FB acak ON");
        if (schedule.scene_details) parts.push("detail khusus");
        if (schedule.negative_prompt) parts.push("negative tambahan");
        return parts.join(" · ");
    }

    function renderSchedules(schedules = []) {
        const container = $("schedules-list");
        const activeBadge = $("active-schedules-badge");
        stopScheduleCountdown();
        container.replaceChildren();
        const accountAutopublishOn = state.data?.autopublishEnabled === true && state.data?.globalEnabled !== false;
        const activeCount = schedules.filter(s => s.enabled === true && s.autopublish_enabled !== false).length;
        const pausedCount = Math.max(0, schedules.length - activeCount);
        if (activeBadge) {
            if (!schedules.length) {
                activeBadge.className = "badge";
                activeBadge.textContent = "0 aktif";
            } else if (activeCount > 0) {
                activeBadge.className = "badge posted";
                activeBadge.textContent = pausedCount > 0
                    ? `${activeCount} aktif · ${pausedCount} dijeda`
                    : `${activeCount} aktif`;
            } else {
                activeBadge.className = "badge queued";
                activeBadge.textContent = `0 aktif · ${pausedCount} dijeda`;
            }
        }
        const orderedSchedules = [...schedules].sort((a, b) => {
            const aActive = a.enabled === true && a.autopublish_enabled !== false ? 1 : 0;
            const bActive = b.enabled === true && b.autopublish_enabled !== false ? 1 : 0;
            return bActive - aActive;
        });
        let countdownCards = 0;
        for (const schedule of orderedSchedules) {
            const isScheduleActive = schedule.enabled === true && schedule.autopublish_enabled !== false;
            const card = document.createElement("article");
            card.className = `item ${isScheduleActive ? "is-schedule-active" : "is-schedule-paused"}`;
            card.style.gridTemplateColumns = "minmax(0,1fr) auto";
            const content = document.createElement("div");
            const title = document.createElement("p");
            title.className = "item-title";
            const isQuoteSchedule = schedule.post_mode === "quote";
            if (isQuoteSchedule) {
                const quoteBadge = document.createElement("span");
                quoteBadge.className = "badge quote-mode";
                quoteBadge.textContent = "Kata Mutiara";
                title.append(
                    quoteBadge,
                    document.createTextNode(`  ✨ Kata-kata Mutiara → ${pageName(schedule.page_connection_id)}`)
                );
            } else {
                title.textContent = `${characterName(schedule.character_id)} → ${pageName(schedule.page_connection_id)}`;
            }
            const scheduleAutopublishOn = schedule.autopublish_enabled !== false;
            const effectiveAutopublish = accountAutopublishOn && scheduleAutopublishOn;
            const detail = document.createElement("div");
            detail.className = "item-meta";
            detail.textContent = `Setiap ${formatIntervalLabel(schedule.interval_minutes || schedule.interval_hours * 60)} · rasio ${schedule.aspect_ratio || "9:16"} · berikutnya ${formatDate(schedule.next_run_at)} · ${schedule.enabled ? "jadwal aktif" : "jadwal dijeda"} · autopost ${scheduleAutopublishOn ? "ON" : "OFF"}`;
            const scene = document.createElement("div");
            scene.className = "item-meta";
            scene.textContent = sceneSummary(schedule);
            content.append(title, detail, scene);
            if (schedule.enabled === true && scheduleAutopublishOn && !accountAutopublishOn) {
                const paused = document.createElement("div");
                paused.className = "item-meta";
                paused.textContent = "Autopost akun sedang dijeda, jadi jadwal ini belum berjalan otomatis.";
                content.append(paused);
            }
            if (schedule.enabled === true && effectiveAutopublish) {
                const countdown = createScheduleCountdown(schedule);
                if (countdown) {
                    content.append(countdown);
                    countdownCards += 1;
                }
            }
            const actions = document.createElement("div");
            actions.className = "item-actions";
            actions.style.display = "flex";
            actions.style.flexWrap = "wrap";
            actions.style.gap = "7px";
            const edit = document.createElement("button");
            edit.className = "btn small";
            edit.type = "button";
            edit.textContent = "Edit";
            edit.addEventListener("click", () => editSchedule(schedule));
            const autopublish = document.createElement("button");
            autopublish.className = `btn small ${scheduleAutopublishOn ? "danger" : "green"}`;
            autopublish.type = "button";
            autopublish.textContent = scheduleAutopublishOn ? "Autopost: ON" : "Autopost: OFF";
            autopublish.title = scheduleAutopublishOn
                ? "Matikan autopost hanya untuk jadwal ini."
                : "Aktifkan autopost hanya untuk jadwal ini.";
            autopublish.addEventListener("click", () => toggleScheduleAutopublish(schedule, autopublish));
            const toggle = document.createElement("button");
            toggle.className = `btn small ${schedule.enabled ? "danger" : "green"}`;
            toggle.type = "button";
            toggle.textContent = schedule.enabled ? "Jeda" : "Aktifkan";
            toggle.addEventListener("click", () => toggleSchedule(schedule));
            const remove = document.createElement("button");
            remove.className = "btn small danger";
            remove.type = "button";
            remove.textContent = "Hapus";
            remove.addEventListener("click", () => deleteSchedule(schedule.id, remove));
            actions.append(edit, autopublish, toggle, remove);
            card.append(content, actions);
            container.append(card);
        }
        if (!schedules.length) container.innerHTML = '<div class="empty">Belum ada jadwal autopost aktif.</div>';
        if (countdownCards > 0) startScheduleCountdown();
        else scheduleCountdown.nodes = [];
    }

    function getRunsPageSequence(currentPage, totalPages) {
        const total = Math.max(1, Math.floor(Number(totalPages) || 1));
        const current = Math.min(total, Math.max(1, Math.floor(Number(currentPage) || 1)));
        if (total <= 7) {
            return Array.from({ length: total }, (_, index) => index + 1);
        }
        if (current <= 4) {
            return [1, 2, 3, 4, 5, "…", total];
        }
        if (current >= total - 3) {
            return [1, "…", total - 4, total - 3, total - 2, total - 1, total];
        }
        return [1, "…", current - 1, current, current + 1, "…", total];
    }

    function renderRunsPaginationControls() {
        const info = $("runs-pagination-info");
        const perPageSelect = $("runs-per-page");
        const nav = $("runs-pagination");

        if (perPageSelect) {
            perPageSelect.value = String(state.runsPerPage);
            perPageSelect.disabled = state.runsBusy;
        }

        if (info) {
            if (state.runsTotal <= 0) {
                info.textContent = "Belum ada riwayat";
            } else {
                const start = (state.runsPage - 1) * state.runsPerPage + 1;
                const end = Math.min(state.runsTotal, state.runsPage * state.runsPerPage);
                info.textContent = `Menampilkan ${start}–${end} dari ${state.runsTotal} riwayat · Halaman ${state.runsPage} dari ${state.runsTotalPages}`;
            }
        }

        if (!nav) return;
        nav.replaceChildren();
        if (state.runsTotal <= 0) {
            nav.hidden = true;
            return;
        }
        nav.hidden = false;

        const prev = document.createElement("button");
        prev.type = "button";
        prev.className = "runs-page-btn runs-page-nav";
        prev.dataset.page = String(state.runsPage - 1);
        prev.disabled = state.runsPage <= 1 || state.runsBusy;
        prev.setAttribute("aria-label", "Halaman sebelumnya");
        prev.textContent = "‹";
        nav.append(prev);

        for (const entry of getRunsPageSequence(state.runsPage, state.runsTotalPages)) {
            if (entry === "…") {
                const ellipsis = document.createElement("span");
                ellipsis.className = "runs-ellipsis";
                ellipsis.setAttribute("aria-hidden", "true");
                ellipsis.textContent = "…";
                nav.append(ellipsis);
                continue;
            }
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = `runs-page-btn${entry === state.runsPage ? " active" : ""}`;
            btn.dataset.page = String(entry);
            btn.disabled = state.runsBusy;
            if (entry === state.runsPage) btn.setAttribute("aria-current", "page");
            btn.setAttribute("aria-label", `Halaman ${entry}`);
            btn.textContent = String(entry);
            nav.append(btn);
        }

        const next = document.createElement("button");
        next.type = "button";
        next.className = "runs-page-btn runs-page-nav";
        next.dataset.page = String(state.runsPage + 1);
        next.disabled = state.runsPage >= state.runsTotalPages || state.runsBusy;
        next.setAttribute("aria-label", "Halaman berikutnya");
        next.textContent = "›";
        nav.append(next);
    }

    async function cancelRun(run, button) {
        const source = run.schedule_id ? "run autopost" : "pratinjau manual";
        if (!confirmInlineAction(button, {
            label: "Konfirmasi batal",
            ariaLabel: `Konfirmasi batalkan ${source}`,
            title: `Batalkan ${source} ini? Statusnya akan menjadi gagal dan tidak bisa dilanjutkan.`
        })) return;
        setButtonBusy(button, true, "Membatalkan…");
        try {
            await api("cancel-run", { method: "POST", body: { run_id: run.id } });
            showNotice(pageMessage, "Run dibatalkan. Riwayat diperbarui.", "success");
            await loadRunsPage(state.runsPage);
        } catch (error) {
            setButtonBusy(button, false);
            showNotice(pageMessage, error.message || "Gagal membatalkan run.", "error");
        }
    }

    /*
     * Pratinjau manual menyimpan byte gambar hanya di memori halaman. Setelah
     * refresh, tombol "Buang pratinjau" hilang dan barisnya tertinggal sebagai
     * "generating". Beri tahu pengguna bahwa baris itu bisa dibatalkan dari
     * riwayat, alih-alih membiarkannya diam-diam menggantung.
     */
    function noticeOrphanPreview(runs = []) {
        if (state.manualPreview || state.orphanNoticeShown) return;
        const orphan = runs.find(run => run.status === "generating" && !run.schedule_id);
        if (!orphan) return;
        state.orphanNoticeShown = true;
        showNotice(
            pageMessage,
            "Ada pratinjau manual yang belum diselesaikan (halaman di-refresh sehingga gambarnya hilang). "
            + "Tekan Batalkan pada baris tersebut di Riwayat Pembuatan & Posting agar tidak menggantung.",
            "warn"
        );
    }

    function renderRuns(runs = [], pagination = null) {
        const container = $("runs-list");
        container.replaceChildren();

        let visibleRuns = runs;
        if (pagination && typeof pagination === "object") {
            const perPage = RUNS_PER_PAGE_OPTIONS.includes(Number(pagination.perPage))
                ? Number(pagination.perPage)
                : state.runsPerPage;
            const total = Math.max(0, Number(pagination.total) || 0);
            const totalPages = Math.max(1, Number(pagination.totalPages) || Math.ceil(total / perPage) || 1);
            const page = Math.min(totalPages, Math.max(1, Number(pagination.page) || state.runsPage || 1));
            state.runsPerPage = perPage;
            state.runsTotal = total;
            state.runsTotalPages = totalPages;
            state.runsPage = page;
        } else {
            const perPage = state.runsPerPage;
            const total = runs.length;
            const totalPages = Math.max(1, Math.ceil(total / perPage));
            const page = Math.min(totalPages, Math.max(1, state.runsPage || 1));
            const start = (page - 1) * perPage;
            visibleRuns = runs.slice(start, start + perPage);
            state.runsTotal = total;
            state.runsTotalPages = totalPages;
            state.runsPage = page;
        }

        for (const run of visibleRuns) {
            const item = document.createElement("div");
            item.className = "item";
            item.style.gridTemplateColumns = "minmax(0,1fr) auto";
            const content = document.createElement("div");
            const title = document.createElement("p");
            title.className = "item-title";
            const label = document.createElement("span");
            label.className = `badge ${run.status || "queued"}`;
            /*
             * Run manual yang sudah punya caption bukan "sedang diproses":
             * gambar sudah jadi di browser dan menunggu diterbitkan/dibuang.
             * Label lama menyebutnya "generating" sehingga pratinjau yang
             * ditinggal setelah refresh tampak seperti proses yang macet.
             */
            const awaitingPublish = run.status === "generating" && !run.schedule_id && Boolean(run.caption);
            label.textContent = awaitingPublish ? "pratinjau siap" : (run.status || "queued");
            const source = run.schedule_id ? "Auto" : "Manual";
            const isQuoteRun = run.post_mode === "quote" || Boolean(run.quote_text) || Boolean(run.scene_plan?.quote_mode);
            title.append(label);
            if (isQuoteRun) {
                const quoteBadge = document.createElement("span");
                quoteBadge.className = "badge quote-mode";
                quoteBadge.style.marginLeft = "6px";
                const runTarget = run.quote_publish_target || run.scene_plan?.quote_publish_target || (run.scene_plan?.story_target ? "story" : "feed");
                quoteBadge.textContent = `Kata Mutiara · ${quoteTargetLabel(runTarget)}`;
                title.append(quoteBadge);
            }
            title.append(document.createTextNode(`  ${source} · ${formatDate(run.scheduled_for || run.created_at)}`));
            const detail = document.createElement("div");
            detail.className = "item-meta";
            const scene = run.scene_plan || {};
            const songTitle = run.song_title || scene.song_title || "";
            const songArtist = run.song_artist || scene.song_artist || "";
            const songSummary = songTitle ? `🎵 ${songTitle}${songArtist ? ` — ${songArtist}` : ""}` : "";
            const quotePreview = run.quote_text ? `“${run.quote_text}”` : "";
            detail.textContent = run.status === "failed"
                ? (run.error_message || "Posting gagal; cek konfigurasi API dan Page.")
                : isQuoteRun
                    ? [run.quote_theme || scene.theme_label, quotePreview, songSummary, run.caption].filter(Boolean).join(" · ") || "Menunggu proses."
                    : [scene.location, run.outfit_name || scene.outfit, songSummary, run.caption].filter(Boolean).join(" · ") || "Menunggu proses.";
            content.append(title, detail);
            if (run.status === "posted" && run.permalink_url) {
                const share = document.createElement("div");
                share.className = "share-row";
                const postUrl = safeExternalUrl(run.permalink_url);
                if (postUrl) {
                    const view = document.createElement("a");
                    view.className = "btn small";
                    view.href = postUrl;
                    view.target = "_blank";
                    view.rel = "noopener noreferrer";
                    view.textContent = "Lihat post Page";
                    share.append(view);
                }
                const shareUrl = safeExternalUrl(run.profile_share_url);
                if (shareUrl) {
                    const profile = document.createElement("a");
                    profile.className = "btn small green";
                    profile.href = shareUrl;
                    profile.target = "_blank";
                    profile.rel = "noopener noreferrer";
                    profile.textContent = "Bagikan ke profil pribadi";
                    share.append(profile);
                }
                content.append(share);
            }
            if (run.status === "generating" || run.status === "queued") {
                const actions = document.createElement("div");
                actions.className = "item-actions";
                const cancel = document.createElement("button");
                cancel.type = "button";
                cancel.className = "btn small";
                cancel.textContent = "Batalkan";
                cancel.addEventListener("click", () => cancelRun(run, cancel));
                actions.append(cancel);
                item.append(content, actions);
                container.append(item);
                continue;
            }
            item.append(content);
            container.append(item);
        }
        if (!visibleRuns.length) container.innerHTML = '<div class="empty">Belum ada run. Aktifkan jadwal untuk mulai.</div>';
        noticeOrphanPreview(runs);
        renderRunsPaginationControls();
    }

    const autopostWatch = { knownPosted: null, reloading: false };

    async function pollAutopostSuccess() {
        if (autopostWatch.reloading || document.visibilityState !== "visible") return;
        try {
            const result = await api("runs&page=1&limit=15");
            const postedAuto = (result.runs || []).filter(run => run.schedule_id && run.status === "posted");
            if (autopostWatch.knownPosted === null) {
                autopostWatch.knownPosted = new Set(postedAuto.map(run => run.id));
                return;
            }
            const fresh = postedAuto.find(run => !autopostWatch.knownPosted.has(run.id));
            if (!fresh) return;
            autopostWatch.reloading = true;
            showNotice(pageMessage, "Posting otomatis berhasil terbit — halaman dimuat ulang otomatis…", "success");
            window.setTimeout(() => window.location.reload(), 1500);
        } catch {
            /* Polling gagal: coba lagi pada interval berikutnya. */
        }
    }

    async function loadRunsPage(targetPage = state.runsPage, { perPage = state.runsPerPage, scrollIntoView = false } = {}) {
        if (state.runsBusy) return;
        const safePerPage = RUNS_PER_PAGE_OPTIONS.includes(Number(perPage))
            ? Number(perPage)
            : DEFAULT_RUNS_PER_PAGE;
        const safePage = Math.max(1, Math.floor(Number(targetPage) || 1));

        state.runsPerPage = safePerPage;
        state.runsPage = safePage;
        saveRunsPerPage(safePerPage);

        state.runsBusy = true;
        renderRunsPaginationControls();
        const info = $("runs-pagination-info");
        if (info) info.textContent = `Memuat halaman ${safePage}…`;

        try {
            const result = await api(`runs&page=${safePage}&limit=${safePerPage}`);
            if (state.data) {
                state.data.runs = result.runs || [];
                state.data.runsPagination = result.runsPagination || null;
            }
            state.runsBusy = false;
            renderRuns(result.runs || [], result.runsPagination || null);
            if (scrollIntoView) {
                const section = $("runs-section");
                if (section) {
                    const rect = section.getBoundingClientRect();
                    if (rect.top < 0 || rect.top > window.innerHeight * 0.65) {
                        window.scrollTo({
                            top: Math.max(0, rect.top + window.scrollY - 16),
                            behavior: "smooth"
                        });
                    }
                }
            }
        } catch (error) {
            state.runsBusy = false;
            if (error?.status === 404 && Array.isArray(state.data?.runs)) {
                renderRuns(state.data.runs, null);
                return;
            }
            renderRunsPaginationControls();
            showNotice(pageMessage, error.message || "Gagal memuat halaman riwayat.", "error");
        }
    }

    function renderOutfitSelector(characters = []) {
        const previous = outfitSelect.value;
        outfitSelect.replaceChildren(new Option("Pilih karakter…", ""));
        for (const character of characters) {
            outfitSelect.add(new Option(character.display_name, character.id));
        }
        outfitSelect.value = characters.some(character => character.id === previous) ? previous : "";
    }

    function render(data) {
        state.data = data;
        if (Array.isArray(data.defaultFacebookSongs) && data.defaultFacebookSongs.length) {
            state.defaultFacebookSongs = data.defaultFacebookSongs;
        }
        renderConfig(data.config || {});
        renderGlobalState();
        renderPages(data.pages || []);
        renderCharacters(data.characters || []);
        populateScenePresets(data.scenePresets);
        populateQuotePresets(data.quotePresets);
        renderSchedules(data.schedules || []);
        renderRuns(data.runs || [], data.runsPagination || null);
        $("default-caption-template").value = data.postingSettings?.caption_template || "Cerita hari ini ✨";
        $("external-post-link").value = data.postingSettings?.external_link || "";
        renderOutfitSelector(data.characters || []);
        renderOutfits();
        renderSongs();
        updateCollapsibleSummaries();
        applySchedulePolicyUi();
        const missingMigrations = [];
        if (data.autopublishSchemaReady === false) missingMigrations.push("supabase/social-autopublish-per-user.sql");
        if (data.sceneSchemaReady === false) missingMigrations.push("supabase/social-schedule-autopublish-scene.sql");
        if (missingMigrations.length) {
            showNotice(
                pageMessage,
                `Database belum menjalankan ${missingMigrations.join(" dan ")}. Jalankan file tersebut di Supabase SQL Editor, lalu muat ulang halaman ini.`,
                "warn"
            );
            return;
        }
        const pagesWithoutPublish = (data.pages || []).filter(page => page.can_publish === false).length;
        if (pagesWithoutPublish) {
            showNotice(
                pageMessage,
                `${pagesWithoutPublish} Page belum siap menerbitkan. Klik "Periksa izin" pada Page tersebut. Pastikan aplikasi Meta memakai use case "Manage everything on your Page" dengan izin pages_show_list, pages_read_engagement, dan pages_manage_posts serta akun Anda punya tugas CREATE_CONTENT, lalu hubungkan ulang Page.`,
                "warn"
            );
        }
    }

    async function loadDashboard() {
        /* Daftar digambar ulang: tombol lama hilang, jangan tinggalkan status konfirmasi. */
        window.GENZInlineConfirm?.disarmAll?.();
        if (state.busy) return;
        state.busy = true;
        $("refresh").disabled = true;
        try {
            const data = await api(`dashboard&runs_page=${state.runsPage}&runs_limit=${state.runsPerPage}`);
            render(data);
            await loadFacebookSongs();
        } catch (error) {
            showNotice(pageMessage, error.message || "Gagal memuat Social Publisher.", "error");
            configList.replaceChildren();
            $("page-connections").innerHTML = '<div class="empty">Belum dapat dimuat.</div>';
            $("characters-list").innerHTML = '<div class="empty">Belum dapat dimuat.</div>';
            $("runs-list").innerHTML = '<div class="empty">Belum dapat dimuat.</div>';
            const info = $("runs-pagination-info");
            if (info) info.textContent = "Belum dapat dimuat";
        } finally {
            state.busy = false;
            $("refresh").disabled = false;
        }
    }

    /*
     * Facebook menolak menampilkan halaman izin OAuth di browser dalam
     * aplikasi (WebView) seperti Facebook, Instagram, WhatsApp, atau TikTok.
     * Di HP tautan Studio Medsos sering dibuka dari aplikasi tersebut,
     * sehingga blok persetujuan Meta tidak muncul sama sekali.
     */
    const IN_APP_BROWSER_PATTERNS = [
        [/FBAN|FBAV|FB_IAB|FBIOS/i, "aplikasi Facebook"],
        [/Instagram/i, "aplikasi Instagram"],
        [/Messenger/i, "aplikasi Messenger"],
        [/WhatsApp/i, "aplikasi WhatsApp"],
        [/Line\//i, "aplikasi LINE"],
        [/TikTok|musical_ly|BytedanceWebview/i, "aplikasi TikTok"],
        [/Snapchat/i, "aplikasi Snapchat"],
        [/MicroMessenger/i, "aplikasi WeChat"],
        [/LinkedInApp/i, "aplikasi LinkedIn"],
        [/Twitter/i, "aplikasi X"],
        [/GSA\//i, "Google App"]
    ];

    function detectInAppBrowser() {
        const agent = String(window.navigator?.userAgent || "");
        if (!agent) return "";
        const match = IN_APP_BROWSER_PATTERNS.find(([pattern]) => pattern.test(agent));
        return match ? match[1] : "";
    }

    function showConnectHelp({ title, message, url = "", tone = "warn" }) {
        if (!connectHelp) return;
        connectHelp.hidden = false;
        connectHelp.className = `notice ${tone}`;
        if (connectHelpTitle) connectHelpTitle.textContent = title;
        if (connectHelpText) connectHelpText.textContent = message;
        if (oauthManualLink) {
            if (url) {
                oauthManualLink.href = url;
                oauthManualLink.hidden = false;
            } else {
                oauthManualLink.removeAttribute("href");
                oauthManualLink.hidden = true;
            }
        }
    }

    function renderInAppBrowserHint() {
        const app = detectInAppBrowser();
        if (!app) return;
        showConnectHelp({
            title: "Buka halaman ini di Chrome atau Safari",
            message: `Anda sedang membuka Studio Medsos di dalam ${app}. Facebook memblokir halaman izin OAuth di browser dalam aplikasi, jadi blok persetujuan tidak akan muncul. Salin tautan halaman ini, buka di Chrome atau Safari, lalu login dan tekan Hubungkan Facebook dari sana.`,
            tone: "warn"
        });
    }

    async function copyCurrentPageLink() {
        const link = String(window.location.href || "");
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(link);
            } else {
                const field = document.createElement("textarea");
                field.value = link;
                field.setAttribute("readonly", "");
                field.style.position = "fixed";
                field.style.opacity = "0";
                document.body.append(field);
                field.select();
                const copied = document.execCommand?.("copy");
                field.remove();
                if (!copied) throw new Error("copy tidak didukung");
            }
            status(connectCopyStatus, "Tautan disalin. Tempel di Chrome atau Safari untuk melanjutkan.");
        } catch {
            status(
                connectCopyStatus,
                "Tidak dapat menyalin otomatis. Salin alamat halaman ini secara manual dari bilah alamat browser.",
                "warn"
            );
        }
    }

    async function connectFacebook() {
        setButtonBusy(connectButton, true, "Menghubungkan…");
        status(connectStatus, "Membuka persetujuan Meta…");
        try {
            const result = await api("oauth-start");
            const url = new URL(result.authorization_url);
            if (url.protocol !== "https:" || !["www.facebook.com", "facebook.com"].includes(url.hostname)) throw new Error("URL OAuth tidak valid.");

            /* Tautan manual tetap tersedia kalau pengalihan otomatis diblokir
               oleh browser HP atau WebView. */
            status(connectStatus, "Membuka halaman izin Facebook…");
            showConnectHelp({
                title: "Halaman izin Facebook belum terbuka?",
                message: "Pengalihan otomatis bisa diblokir di sebagian browser HP. Ketuk tombol di bawah untuk membuka halaman izin Meta secara manual di tab yang sama.",
                url: url.toString(),
                tone: "warn"
            });
            window.location.assign(url.toString());
        } catch (error) {
            status(connectStatus, error.message, "error");
            setButtonBusy(connectButton, false);
        }
    }

    async function checkPagePermission(id, button = null) {
        if (button) setButtonBusy(button, true, "Memeriksa…");
        status(connectStatus, "Memeriksa token dan izin Page langsung ke Facebook…");
        try {
            const result = await api("check-page", { method: "POST", body: { id } });
            const tokenNote = result.token?.expires_at
                ? ` Token berlaku sampai ${formatDate(result.token.expires_at)}.`
                : result.token?.valid === true
                    ? " Token Page masih berlaku."
                    : "";
            status(
                connectStatus,
                `${result.message || "Pemeriksaan selesai."}${tokenNote}`,
                result.can_publish ? "good" : "warn"
            );
            showNotice(pageMessage, result.message || "Pemeriksaan izin Page selesai.", result.can_publish ? "success" : "warn");
            await loadDashboard();
            return result;
        } catch (error) {
            status(connectStatus, error.message || "Gagal memeriksa izin Page.", "error");
            showNotice(pageMessage, error.message || "Gagal memeriksa izin Page.", "error");
            return null;
        } finally {
            if (button) setButtonBusy(button, false);
        }
    }

    async function disconnectPage(id, button) {
        if (!confirmInlineAction(button, {
            label: "Konfirmasi putuskan",
            ariaLabel: "Konfirmasi putuskan koneksi Page",
            title: "Putuskan koneksi Page ini? Jadwal yang masih menggunakannya harus dihapus terlebih dahulu."
        })) return;
        try {
            await api("disconnect-page", { method: "POST", body: { id } });
            showNotice(pageMessage, "Koneksi Page diputuskan.", "success");
            await loadDashboard();
        } catch (error) {
            showNotice(pageMessage, error.message, "error");
        }
    }

    async function uploadCharacter(event) {
        event.preventDefault();
        const name = $("character-name").value.trim();
        const file = $("character-image").files?.[0];
        if (!name || !file || !$("character-consent").checked) {
            status(characterStatus, "Isi nama, pilih foto, dan centang konfirmasi hak penggunaan serta subjek dewasa.", "error");
            return;
        }
        try {
            await validateImageFile(file);
        } catch (error) {
            status(characterStatus, error.message, "error");
            return;
        }
        setButtonBusy(uploadButton, true, "Mengunggah…");
        status(characterStatus, "Mengunggah foto karakter ke Supabase Storage privat…");
        let characterCreated = false;
        try {
            const uploaded = await api("upload-reference", {
                method: "POST",
                body: file,
                raw: true,
                headers: {
                    "Content-Type": file.type,
                    "X-File-Name": encodeURIComponent(file.name),
                    "X-Character-Name": encodeURIComponent(name),
                    "X-Character-Consent": "1",
                    "X-Character-Adult": "1"
                }
            });
            const data = await uploaded.json().catch(() => ({}));
            if (!uploaded.ok || data.success !== true || !data.character?.id) throw new Error(data.error || "Upload referensi gagal.");
            characterCreated = true;
            const notes = $("character-notes").value.trim();
            if (notes) {
                await api("save-character", { method: "POST", body: { id: data.character.id, display_name: name, prompt_notes: notes } });
            }
            $("character-form").reset();
            status(characterStatus, "Karakter tersimpan. Pakaian default mengikuti foto referensi; tambahkan outfit + link order bila ingin menggantinya.", "good");
            await loadDashboard();
        } catch (error) {
            status(characterStatus, characterCreated
                ? `Karakter sudah tersimpan, tetapi catatan gagal disimpan: ${error.message}`
                : error.message, "error");
            if (characterCreated) await loadDashboard();
        } finally {
            setButtonBusy(uploadButton, false);
        }
    }

    function schedulePolicy() {
        const policy = state.data?.schedulePolicy || {};
        const min = Number.isInteger(Number(policy.minIntervalMinutes)) && Number(policy.minIntervalMinutes) > 0
            ? Number(policy.minIntervalMinutes)
            : 60;
        const max = Number.isInteger(Number(policy.maxIntervalMinutes)) && Number(policy.maxIntervalMinutes) >= min
            ? Number(policy.maxIntervalMinutes)
            : 10080;
        return {
            role: String(policy.role || "").trim().toUpperCase(),
            min,
            max
        };
    }

    function formatIntervalLabel(minutes) {
        const value = Number(minutes);
        if (!Number.isFinite(value) || value <= 0) return "—";
        if (value < 60) return `${value} menit`;
        const hours = Math.floor(value / 60);
        const rest = value % 60;
        return rest ? `${hours} jam ${rest} menit` : `${hours} jam`;
    }

    function accountPostLimit() {
        const raw = state.data?.postLimit;
        if (raw === null || raw === undefined || raw === "") return null;
        const parsed = Number(raw);
        return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
    }

    function scheduleQuota() {
        const policy = state.data?.schedulePolicy || {};
        const parsed = Number(policy.maxSchedules);
        const roleMax = Number.isInteger(parsed) && parsed > 0 ? parsed : null;
        /* Batas per akun (diatur admin) menang atas default role. */
        const maxSchedules = accountPostLimit() ?? roleMax;
        const count = Array.isArray(state.data?.schedules)
            ? state.data.schedules.length
            : Number(state.data?.scheduleCount) || 0;
        return {
            role: String(policy.role || "").trim().toUpperCase(),
            maxSchedules,
            count,
            reached: Boolean(maxSchedules) && count >= maxSchedules
        };
    }

    function applyScheduleQuotaUi() {
        const badge = $("schedule-quota");
        const { role, maxSchedules, count, reached } = scheduleQuota();
        const editing = Boolean($("schedule-id").value);
        if (badge) {
            badge.textContent = maxSchedules
                ? `${count}/${maxSchedules} jadwal${reached ? " · batas tercapai" : ""}`
                : `${count} jadwal · tanpa batas`;
            badge.className = `badge${reached ? " failed" : ""}`;
            badge.title = maxSchedules
                ? `Akun ini maksimal ${maxSchedules} jadwal autopost.${reached ? " Hapus salah satu jadwal untuk membuat yang baru." : ""}`
                : "Role admin/owner tanpa batas jumlah jadwal.";
        }
        /* Tombol simpan hanya dikunci saat membuat jadwal baru, bukan saat mengedit. */
        saveScheduleButton.disabled = reached && !editing;
        updatePostLimitUi();
    }

    function updatePostLimitUi() {
        const notice = $("schedule-limit-notice");
        if (!notice) return;
        const limit = accountPostLimit();
        const count = Array.isArray(state.data?.schedules)
            ? state.data.schedules.length
            : Number(state.data?.scheduleCount) || 0;
        if (limit !== null && count >= limit) {
            notice.hidden = false;
            notice.textContent = `Batas Posting Anda (${limit}). Hubungi admin untuk menambah batas posting`;
        } else {
            notice.hidden = true;
            notice.textContent = "";
        }
    }

    function applySchedulePolicyUi() {
        const { role, min, max } = schedulePolicy();
        const input = $("interval-minutes");
        input.min = String(min);
        input.max = String(max);
        const help = $("interval-help");
        if (help) {
            const roleLabel = role ? `role ${role}` : "role Anda";
            help.textContent = `Minimal ${formatIntervalLabel(min)} untuk ${roleLabel}, maksimal ${formatIntervalLabel(max)}. 1440 menit = satu post per hari.`;
        }
        const value = Number(input.value);
        if (!Number.isInteger(value) || value < min || value > max) {
            input.value = String(Math.min(max, Math.max(min, 1440)));
        }
        updateCostEstimate();
        applyScheduleQuotaUi();
    }

    function updateCostEstimate() {
        const { role, min, max } = schedulePolicy();
        const interval = Number($("interval-minutes").value);
        if (!Number.isInteger(interval) || interval < min || interval > max) {
            $("cost-estimate").textContent = `Interval harus bilangan bulat antara ${min} sampai ${max} menit untuk role ${role || "Anda"} (minimal ${formatIntervalLabel(min)}).`;
            return;
        }
        const imagesPerMonth = 30 * 24 * 60 / interval;
        const cadence = `satu post setiap ${formatIntervalLabel(interval)}`;
        const riskNote = interval < 360
            ? " Interval di bawah 6 jam berarti lebih dari 4 post per hari per jadwal; pastikan kuota provider dan kebijakan Facebook Page Anda mendukung."
            : "";
        $("cost-estimate").textContent = `Perkiraan volume Nano Banana 2 Lite: ${imagesPerMonth.toFixed(1)} gambar/bulan (${cadence}) pada 1 gambar per jadwal. Biaya bergantung pada tier dan kuota model untuk API key Anda, serta belum termasuk satu panggilan Gemini 2.5 Flash untuk caption per gambar, retry, atau pajak. Periksa harga dan kuota di Google AI Studio sebelum mengaktifkan autopost.${riskNote}`;
    }

    function editSchedule(schedule) {
        setStudioCardExpanded("schedule-card", true);
        const isQuote = schedule.post_mode === "quote";
        $("schedule-id").value = schedule.id;
        setSchedulePostMode(isQuote ? "quote" : "character", { preserveSongToggle: true });
        $("schedule-character").value = schedule.character_id || "";
        $("schedule-page").value = schedule.page_connection_id;
        $("interval-minutes").value = schedule.interval_minutes || schedule.interval_hours * 60;
        $("first-run").value = utcToLocalWib(schedule.next_run_at);
        $("schedule-aspect-ratio").value = schedule.aspect_ratio || "9:16";
        if ($("schedule-quote-target")) $("schedule-quote-target").value = normalizeClientQuoteTarget(schedule.quote_publish_target || "feed");
        if ($("schedule-quote-theme")) $("schedule-quote-theme").value = schedule.quote_theme || "";
        if ($("schedule-quote-visual")) $("schedule-quote-visual").value = schedule.quote_visual_style || "";
        if ($("schedule-random-song")) {
            $("schedule-random-song").checked = isQuote
                ? schedule.use_random_song !== false
                : schedule.use_random_song === true;
        }
        $("schedule-location").value = schedule.scene_location || "";
        $("schedule-angle").value = schedule.camera_angle || "";
        $("schedule-situation").value = schedule.scene_situation || "";
        $("schedule-atmosphere").value = schedule.scene_atmosphere || "";
        $("schedule-condition").value = schedule.scene_condition || "";
        $("schedule-lighting").value = schedule.scene_lighting || "";
        $("schedule-details").value = schedule.scene_details || "";
        $("schedule-negative").value = schedule.negative_prompt || "";
        $("schedule-autopublish").checked = schedule.autopublish_enabled !== false;
        $("schedule-enabled").checked = schedule.enabled === true;
        saveScheduleButton.textContent = "Simpan perubahan";
        $("cancel-edit").hidden = false;
        updateCostEstimate();
        applyScheduleQuotaUi();
        window.scrollTo({ top: $("schedule-form").getBoundingClientRect().top + window.scrollY - 18, behavior: "smooth" });
    }

    function resetScheduleForm() {
        $("schedule-form").reset();
        $("schedule-id").value = "";
        setSchedulePostMode("character");
        if ($("schedule-quote-target")) $("schedule-quote-target").value = "feed";
        if ($("schedule-quote-theme")) $("schedule-quote-theme").value = "";
        if ($("schedule-quote-visual")) $("schedule-quote-visual").value = "";
        const { min, max } = schedulePolicy();
        $("interval-minutes").value = String(min <= 1440 && 1440 <= max ? 1440 : min);
        $("schedule-aspect-ratio").value = "9:16";
        $("schedule-location").value = "";
        $("schedule-angle").value = "";
        $("schedule-situation").value = "";
        $("schedule-atmosphere").value = "";
        $("schedule-condition").value = "";
        $("schedule-lighting").value = "";
        $("schedule-details").value = "";
        $("schedule-negative").value = "";
        $("schedule-autopublish").checked = true;
        $("schedule-enabled").checked = false;
        saveScheduleButton.textContent = "Simpan jadwal";
        $("cancel-edit").hidden = true;
        setDefaultStartTime();
        updateCostEstimate();
        applyScheduleQuotaUi();
    }

    async function submitSchedule(event) {
        event.preventDefault();
        const postMode = $("schedule-post-mode")?.value === "quote" ? "quote" : "character";
        const isQuote = postMode === "quote";
        const characterId = $("schedule-character").value;
        const pageConnectionId = $("schedule-page").value;
        const intervalMinutes = Number($("interval-minutes").value);
        const nextRunAt = localWibToUtc($("first-run").value);
        const { role, min, max } = schedulePolicy();
        if (!pageConnectionId) {
            status(scheduleStatus, "Pilih Facebook Page tujuan jadwal autopost.", "error");
            return;
        }
        if (!isQuote && !characterId) {
            status(scheduleStatus, "Pilih karakter untuk jadwal foto karakter AI, atau pindah ke mode Kata-kata Mutiara + Lagu FB.", "error");
            return;
        }
        if (!nextRunAt || Date.parse(nextRunAt) <= Date.now()) {
            status(scheduleStatus, "Atur waktu pertama di masa depan sesuai WIB.", "error");
            return;
        }
        if (!Number.isInteger(intervalMinutes) || intervalMinutes < min || intervalMinutes > max) {
            status(
                scheduleStatus,
                `Interval harus bilangan bulat ${min}–${max} menit untuk role ${role || "Anda"}. Minimal ${formatIntervalLabel(min)}.`,
                "error"
            );
            return;
        }
        const useRandomSong = $("schedule-random-song")
            ? $("schedule-random-song").checked
            : isQuote;
        const body = {
            id: $("schedule-id").value || undefined,
            post_mode: postMode,
            character_id: isQuote ? null : characterId,
            page_connection_id: pageConnectionId,
            interval_minutes: intervalMinutes,
            next_run_at: nextRunAt,
            timezone: "Asia/Jakarta",
            aspect_ratio: $("schedule-aspect-ratio").value,
            caption_template: $("default-caption-template").value,
            quote_publish_target: isQuote ? normalizeClientQuoteTarget($("schedule-quote-target")?.value) : "feed",
            quote_theme: isQuote ? ($("schedule-quote-theme")?.value || "") : "",
            quote_visual_style: isQuote ? ($("schedule-quote-visual")?.value || "") : "",
            use_random_song: useRandomSong,
            scene_location: $("schedule-location").value,
            camera_angle: $("schedule-angle").value,
            scene_situation: $("schedule-situation").value,
            scene_atmosphere: $("schedule-atmosphere").value,
            scene_condition: $("schedule-condition").value,
            scene_lighting: $("schedule-lighting").value,
            scene_details: $("schedule-details").value.trim(),
            negative_prompt: $("schedule-negative").value.trim(),
            autopublish_enabled: $("schedule-autopublish").checked,
            enabled: $("schedule-enabled").checked
        };
        if (isQuote) {
            body.scene_location = "";
            body.camera_angle = "";
            body.scene_situation = "";
            body.scene_atmosphere = "";
            body.scene_condition = "";
            body.scene_lighting = "";
        }
        setButtonBusy(saveScheduleButton, true, "Menyimpan…");
        status(scheduleStatus, "Menyimpan konfigurasi jadwal…");
        try {
            await api("save-schedule", { method: "POST", body });
            status(scheduleStatus, "Jadwal berhasil disimpan.", "good");
            resetScheduleForm();
            await loadDashboard();
        } catch (error) {
            status(scheduleStatus, error.message, "error");
        } finally {
            setButtonBusy(saveScheduleButton, false);
            saveScheduleButton.textContent = $("schedule-id").value ? "Simpan perubahan" : "Simpan jadwal";
        }
    }

    async function toggleScheduleAutopublish(schedule, button) {
        const enabling = schedule.autopublish_enabled === false;
        if (!enabling && !confirmInlineAction(button, {
            label: "Konfirmasi matikan",
            ariaLabel: "Konfirmasi matikan autopost jadwal ini",
            title: "Matikan autopost untuk jadwal ini saja? Jadwal lain dan akun lain tidak terpengaruh."
        })) return;
        try {
            await api("set-schedule-autopublish", {
                method: "POST",
                body: { id: schedule.id, enabled: enabling }
            });
            showNotice(
                pageMessage,
                enabling ? "Autopost jadwal ini diaktifkan." : "Autopost jadwal ini dimatikan. Jadwal lain tetap berjalan.",
                enabling ? "success" : "warn"
            );
            await loadDashboard();
        } catch (error) {
            showNotice(pageMessage, error.message, "error");
        }
    }

    async function toggleSchedule(schedule) {
        try {
            let nextRun = schedule.next_run_at;
            if (!schedule.enabled && Date.parse(nextRun) <= Date.now()) {
                nextRun = new Date(Date.now() + 5 * 60 * 1000).toISOString();
            }
            await api("save-schedule", {
                method: "POST",
                body: {
                    ...schedule,
                    enabled: !schedule.enabled,
                    next_run_at: nextRun,
                    timezone: "Asia/Jakarta"
                }
            });
            await loadDashboard();
        } catch (error) {
            showNotice(pageMessage, error.message, "error");
        }
    }

    async function deleteSchedule(id, button) {
        if (!confirmInlineAction(button, {
            label: "Konfirmasi hapus",
            ariaLabel: "Konfirmasi hapus jadwal",
            title: "Hapus jadwal ini? Riwayat posting akan tetap tersimpan."
        })) return;
        try {
            await api("delete-schedule", { method: "POST", body: { id } });
            showNotice(pageMessage, "Jadwal dihapus.", "success");
            await loadDashboard();
        } catch (error) {
            showNotice(pageMessage, error.message, "error");
        }
    }

    async function toggleAutopublish() {
        if (!state.data) return;
        const enabling = !state.data.autopublishEnabled;
        const warning = enabling
            ? "Aktifkan autopost akun Anda? Autopublish akan membuat dan menerbitkan gambar untuk jadwal aktif MILIK AKUN ANDA. Jadwal akun lain tidak terpengaruh."
            : "Jeda autopost akun Anda? Jadwal tersimpan dan dapat diaktifkan kembali kapan saja. Jadwal akun lain tidak terpengaruh.";
        if (!confirmInlineAction(globalToggle, {
            label: enabling ? "Konfirmasi aktifkan" : "Konfirmasi jeda",
            ariaLabel: enabling ? "Konfirmasi aktifkan autopost akun saya" : "Konfirmasi jeda autopost akun saya",
            title: warning
        })) return;
        setButtonBusy(globalToggle, true, "Memperbarui…");
        try {
            await api("set-autopublish", { method: "POST", body: { enabled: enabling } });
            showNotice(
                pageMessage,
                enabling ? "Autopublish akun Anda aktif." : "Autopublish akun Anda dijeda. Jadwal akun lain tetap berjalan.",
                enabling ? "success" : "warn"
            );
            await loadDashboard();
        } catch (error) {
            showNotice(pageMessage, error.message, "error");
        } finally {
            setButtonBusy(globalToggle, false);
            renderGlobalState();
        }
    }

    async function setMasterStatus(targetStatus, button) {
        if (!state.data || state.data.canManageGlobalAutopublish !== true) return;
        const nextStatus = ["active", "off", "maintenance"].includes(targetStatus) ? targetStatus : "off";
        if (resolveMasterStatus() === nextStatus) return;

        const confirmMap = {
            active: {
                label: "Konfirmasi aktifkan",
                ariaLabel: "Konfirmasi aktifkan master switch semua akun",
                title: "Aktifkan Master Switch (ACTIVE)? Seluruh user akan melihat indikator ACTIVE berwarna hijau.",
                notice: "Master switch diatur ke ACTIVE: layanan Studio Medsos aktif penuh.",
                tone: "success"
            },
            maintenance: {
                label: "Konfirmasi maintenance",
                ariaLabel: "Konfirmasi setel master switch ke maintenance",
                title: "Setel Master Switch ke MAINTENANCE? Seluruh user akan melihat indikator MAINTENANCE berwarna kuning dan autopost dijeda sementara.",
                notice: "Master switch diatur ke MAINTENANCE: user melihat status MAINTENANCE (kuning) dan autopost dijeda.",
                tone: "warn"
            },
            off: {
                label: "Konfirmasi matikan",
                ariaLabel: "Konfirmasi matikan master switch semua akun",
                title: "Matikan Master Switch (OFF)? Seluruh user akan melihat indikator OFF berwarna merah dan semua autopost dihentikan.",
                notice: "Master switch diatur ke OFF: user melihat status OFF (merah) dan semua autopost berhenti.",
                tone: "warn"
            }
        }[nextStatus];

        if (!confirmInlineAction(button, {
            label: confirmMap.label,
            ariaLabel: confirmMap.ariaLabel,
            title: confirmMap.title
        })) return;

        setButtonBusy(button, true, "Memperbarui…");
        try {
            const result = await api("set-global-enabled", {
                method: "POST",
                body: { status: nextStatus, enabled: nextStatus === "active" }
            });
            if (state.data) {
                state.data.globalStatus = result.globalStatus || nextStatus;
                state.data.globalEnabled = result.globalEnabled === true;
            }
            showNotice(pageMessage, confirmMap.notice, confirmMap.tone);
            await loadDashboard();
        } catch (error) {
            showNotice(pageMessage, error.message, "error");
        } finally {
            setButtonBusy(button, false);
            renderGlobalState();
        }
    }

    async function toggleMasterAutopublish() {
        if (!state.data || state.data.canManageGlobalAutopublish !== true) return;
        const enabling = state.data.globalEnabled !== true;
        const warning = enabling
            ? "Aktifkan kembali autopost untuk SEMUA akun?"
            : "Hentikan autopost SEMUA akun? Hanya admin yang bisa melakukan ini; switch milik masing-masing user tidak berubah.";
        if (!confirmInlineAction(masterToggle, {
            label: enabling ? "Konfirmasi aktifkan" : "Konfirmasi hentikan",
            ariaLabel: enabling ? "Konfirmasi aktifkan autopost semua akun" : "Konfirmasi hentikan autopost semua akun",
            title: warning
        })) return;
        setButtonBusy(masterToggle, true, "Memperbarui…");
        try {
            await api("set-global-enabled", { method: "POST", body: { enabled: enabling } });
            showNotice(pageMessage, enabling ? "Master switch aktif." : "Master switch dimatikan: semua autopost berhenti.", enabling ? "success" : "warn");
            await loadDashboard();
        } catch (error) {
            showNotice(pageMessage, error.message, "error");
        } finally {
            setButtonBusy(masterToggle, false);
            renderGlobalState();
        }
    }

    function showOAuthResult() {
        const params = new URLSearchParams(location.search);
        if (params.get("facebook_connected") === "1") {
            showNotice(
                pageMessage,
                `Facebook berhasil dihubungkan. ${params.get("pages") || ""} Page ditemukan.${params.get("need_permission")
                    ? ` ${params.get("need_permission")} Page belum memiliki izin pages_manage_posts/CREATE_CONTENT — klik "Periksa izin" lalu hubungkan ulang setelah izin diperbaiki.`
                    : ""}`,
                params.get("need_permission") ? "warn" : "success"
            );
        } else if (params.has("oauth_error")) {
            const code = params.get("oauth_error");
            const messages = {
                state: "Permintaan OAuth tidak valid. Ini biasanya terjadi bila proses dimulai di satu browser lalu diselesaikan di browser lain (misalnya tautan Facebook disalin ke Chrome). Ulangi dari tombol Hubungkan Facebook di browser yang sama.",
                expired: "Permintaan OAuth kedaluwarsa. Silakan coba lagi.",
                denied: "Izin Facebook tidak diberikan. Silakan coba hubungkan ulang dan setujui izin pengelolaan Page.",
                config: "Konfigurasi Meta atau kunci enkripsi belum lengkap.",
                exchange: "Facebook gagal memverifikasi OAuth. Periksa Meta App dan redirect URI.",
                pages: "Tidak dapat membaca daftar Facebook Page yang Anda kelola.",
                no_pages: "Tidak ada Facebook Page yang dapat dihubungkan pada akun ini. Pastikan akun Facebook tersebut mengelola minimal satu Page dengan izin menerbitkan konten.",
                migration: "SQL migration Social Publisher belum dijalankan.",
                callback: "Proses koneksi Facebook gagal. Coba lagi."
            };
            showNotice(pageMessage, messages[code] || "Koneksi Facebook gagal.", "error");
        }
        if (params.has("facebook_connected") || params.has("oauth_error")) {
            history.replaceState({}, "", location.pathname);
        }
    }

    function clearObjectUrls() {
        for (const url of state.objectUrls.values()) URL.revokeObjectURL(url);
        state.objectUrls.clear();
    }

    async function refreshStudioPricing() {
        const periods = ["daily", "weekly", "monthly", "yearly"];
        const priceDisplays = periods.flatMap(period => [
            [$(`studio-price-${period}`), `price_${period}_idr`],
            [$(`studio-gate-price-${period}`), `price_${period}_idr`]
        ]).filter(([node]) => node);
        if (!priceDisplays.length) return;
        const formatPrice = amount => Number.isSafeInteger(amount) && amount >= 0
            ? new Intl.NumberFormat("id-ID", {
                style: "currency",
                currency: "IDR",
                maximumFractionDigits: 0
            }).format(amount)
            : "Belum ditentukan";
        try {
            const result = await api("studio-pricing");
            for (const [node, key] of priceDisplays) {
                node.textContent = formatPrice(result.pricing?.[key]);
            }
        } catch (error) {
            console.error("Studio Medsos pricing load failed:", error);
            for (const [node] of priceDisplays) node.textContent = "Tidak dapat dimuat";
        }
    }

    function setTutorialOpen(open) {
        const panel = $("usage-tutorial");
        const button = $("toggle-tutorial");
        if (!panel || !button) return;
        const isOpen = Boolean(open);
        panel.hidden = !isOpen;
        button.setAttribute("aria-expanded", String(isOpen));
        button.classList.toggle("is-open", isOpen);
    }

    $("connect-page").addEventListener("click", connectFacebook);
    connectCopyButton?.addEventListener("click", copyCurrentPageLink);
    $("toggle-tutorial")?.addEventListener("click", () => {
        const panel = $("usage-tutorial");
        if (!panel) return;
        setTutorialOpen(panel.hidden);
    });
    $("close-tutorial")?.addEventListener("click", () => {
        setTutorialOpen(false);
        $("toggle-tutorial")?.focus?.();
    });
    $("character-form").addEventListener("submit", uploadCharacter);
    $("manual-post-form").addEventListener("submit", submitManualPost);
    $("manual-publish-button").addEventListener("click", publishManualPreview);
    $("edit-modal-close").addEventListener("click", closeEditModal);
    $("edit-modal-cancel").addEventListener("click", closeEditModal);
    $("edit-modal-save").addEventListener("click", saveEditModal);
    $("edit-modal-overlay").addEventListener("click", event => {
        if (event.target === event.currentTarget) closeEditModal();
    });
    $("edit-modal-file").addEventListener("change", event => {
        const file = event.target.files?.[0];
        const photo = $("edit-modal-photo");
        if (editModalPreviewUrl) {
            URL.revokeObjectURL(editModalPreviewUrl);
            editModalPreviewUrl = null;
        }
        if (file) {
            /* Review langsung: foto terpilih tampil di blok foto sebelum diunggah. */
            editModalPreviewUrl = URL.createObjectURL(file);
            photo.src = editModalPreviewUrl;
            $("edit-modal-file-name").textContent = `File baru: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB) — pratinjau ditampilkan, akan diunggah saat Simpan.`;
            validateImageFile(file).catch(error => {
                editModalStatus(error.message, "error");
                event.target.value = "";
                if (editModalPreviewUrl) {
                    URL.revokeObjectURL(editModalPreviewUrl);
                    editModalPreviewUrl = null;
                }
                $("edit-modal-file-name").textContent = "Tanpa file baru: foto tidak diganti.";
                loadEditModalCurrentPhoto();
            });
        } else {
            $("edit-modal-file-name").textContent = "Tanpa file baru: foto tidak diganti.";
            loadEditModalCurrentPhoto();
        }
    });
    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && !$("edit-modal-overlay").hidden) closeEditModal();
    });
    $("manual-discard-button").addEventListener("click", async () => {
        /*
         * Saat tombol terbit sedang menunggu konfirmasi, tombol ini
         * berfungsi sebagai "Batal": membatalkan konfirmasi, bukan
         * menghapus pratinjau yang sudah dibuat.
         */
        if (state.publishArmed) {
            disarmManualPublish({ silent: false });
            return;
        }
        try {
            await discardManualPreview();
            status($("manual-post-status"), "Pratinjau dibuang. Gambar tidak diterbitkan.", "good");
        } catch {
            // The visible status is set by discardManualPreview.
        }
    });
    $("posting-settings-form").addEventListener("submit", savePostingSettings);
    $("outfit-form").addEventListener("submit", submitOutfit);
    outfitSelect.addEventListener("change", renderOutfits);
    $("song-form")?.addEventListener("submit", submitSong);
    $("song-audio-file")?.addEventListener("change", event => {
        const file = event.target.files?.[0];
        const titleInput = $("song-title");
        if (file && titleInput && !titleInput.value.trim()) {
            titleInput.value = file.name.replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[_-]+/g, " ").trim().slice(0, 140);
        }
        if (file) {
            const bar = $("song-preview-bar");
            const player = $("song-preview-player");
            const titleEl = $("song-preview-title");
            stopSongPreviewPlayer({ hideBar: false });
            const localUrl = URL.createObjectURL(file);
            state.objectUrls.set("song-audio-preview", localUrl);
            activeSongPreviewId = "__local_file__";
            if (titleEl) titleEl.textContent = `🎵 Pratinjau file dipilih: ${file.name}`;
            if (player) {
                player.src = localUrl;
                try { player.load?.(); } catch {}
            }
            if (bar) bar.hidden = false;
        }
    });
    $("song-preview-close")?.addEventListener("click", () => stopSongPreviewPlayer());
    $("cancel-song-edit")?.addEventListener("click", resetSongForm);
    $("seed-default-songs")?.addEventListener("click", seedDefaultSongs);
    $("manual-post-mode")?.addEventListener("change", event => setManualPostMode(event.target.value));
    $("manual-quote-target")?.addEventListener("change", event => {
        const nextTarget = normalizeClientQuoteTarget(event.target.value);
        disarmManualPublish();
        if (state.manualPreview?.isQuoteVideo) {
            state.manualPreview.quoteTarget = nextTarget;
            if ($("manual-publish-button")) $("manual-publish-button").textContent = quotePublishButtonText(nextTarget);
            showManualSong(
                state.manualPreview.song,
                state.manualPreview.quoteTheme,
                nextTarget,
                state.manualPreview.durationSeconds,
                state.manualPreview.quoteSignature
            );
        }
    });
    for (const tab of document.querySelectorAll?.("[data-manual-mode]") || []) {
        tab.addEventListener("click", () => setManualPostMode(tab.dataset.manualMode));
    }
    $("schedule-post-mode")?.addEventListener("change", event => setSchedulePostMode(event.target.value));
    for (const tab of document.querySelectorAll?.("[data-schedule-mode]") || []) {
        tab.addEventListener("click", () => setSchedulePostMode(tab.dataset.scheduleMode));
    }
    $("manual-character").addEventListener("change", updateManualCharacterPreview);
    /*
     * Mengganti Page (atau target Kata-kata Mutiara) membatalkan status
     * "siap terbit", supaya konfirmasi tidak pernah berlaku untuk tujuan
     * yang berbeda dari yang tertulis di layar.
     */
    $("manual-page")?.addEventListener("change", () => disarmManualPublish());
    $("schedule-form").addEventListener("submit", submitSchedule);
    $("interval-minutes").addEventListener("input", updateCostEstimate);
    if ($("runs-per-page")) {
        $("runs-per-page").value = String(state.runsPerPage);
        $("runs-per-page").addEventListener("change", event => {
            const parsed = Number(event.target.value);
            const nextPerPage = RUNS_PER_PAGE_OPTIONS.includes(parsed) ? parsed : DEFAULT_RUNS_PER_PAGE;
            state.runsPerPage = nextPerPage;
            state.runsPage = 1;
            saveRunsPerPage(nextPerPage);
            loadRunsPage(1, { perPage: nextPerPage });
        });
    }
    $("runs-pagination")?.addEventListener("click", event => {
        const button = event.target.closest("[data-page]");
        if (!button || button.disabled) return;
        const nextPage = Number(button.dataset.page);
        if (!Number.isInteger(nextPage) || nextPage < 1 || nextPage > state.runsTotalPages) return;
        if (nextPage === state.runsPage) return;
        loadRunsPage(nextPage, { perPage: state.runsPerPage, scrollIntoView: true });
    });
    $("refresh").addEventListener("click", loadDashboard);
    $("global-toggle").addEventListener("click", toggleAutopublish);
    masterToggle?.addEventListener("click", toggleMasterAutopublish);
    $("master-btn-active")?.addEventListener("click", event => setMasterStatus("active", event.currentTarget || $("master-btn-active")));
    $("master-btn-maintenance")?.addEventListener("click", event => setMasterStatus("maintenance", event.currentTarget || $("master-btn-maintenance")));
    $("master-btn-off")?.addEventListener("click", event => setMasterStatus("off", event.currentTarget || $("master-btn-off")));
    for (const section of STUDIO_COLLAPSIBLE_SECTIONS) {
        $(section.btnId)?.addEventListener("click", () => toggleStudioCard(section.cardId));
    }
    $("cancel-edit").addEventListener("click", resetScheduleForm);
    window.addEventListener("beforeunload", clearObjectUrls);

    function clampDuration(value) {
        const days = Number(value) || 1;
        if (!Number.isFinite(days)) return 1;
        return Math.min(365, Math.max(1, Math.round(days)));
    }

    function parseStudioAccess(record) {
        const startedAt = record?.started_at ? Date.parse(record.started_at) : Number.NaN;
        const durationDays = clampDuration(record?.duration_days ?? 30);
        const expiresAt = record?.expires_at ? Date.parse(record.expires_at) : Number.NaN;

        return {
            active: Boolean(record?.is_active),
            durationDays,
            startedAt,
            expiresAt,
            userId: record?.user_id || null
        };
    }

    async function getStudioSubscriptionState() {
        const { access } = await api("studio-access-status");
        return parseStudioAccess(access);
    }

    function updateStudioGate() {
        const gate = document.getElementById("studio-access-gate");
        const badge = document.getElementById("studio-gate-badge");
        const title = document.getElementById("studio-gate-title");
        const message = document.getElementById("studio-gate-message");
        const value = document.getElementById("studio-gate-value");
        const countdown = document.getElementById("studio-gate-countdown");
        const okButton = document.getElementById("studio-gate-ok");
        const mainWrap = document.querySelector("main.wrap");

        if (!gate || !badge || !title || !message || !value || !countdown || !okButton || !mainWrap) return;

        if (studioAccessError || !studioAccessState) {
            gate.hidden = false;
            value.classList.remove("running");
            countdown.classList.remove("running");
            badge.textContent = "STATUS TIDAK TERSEDIA";
            badge.className = "studio-gate-badge inactive";
            title.textContent = "Status langganan belum dapat diverifikasi";
            message.textContent = studioAccessError?.message || "Tidak dapat memuat status langganan dari server.";
            value.textContent = "Akses ditahan";
            countdown.textContent = "Coba muat ulang halaman. Jika masalah berlanjut, hubungi admin.";
            okButton.disabled = true;
            mainWrap.classList.add("studio-locked");
            return;
        }

        const state = studioAccessState;
        const expiryAt = Number(state.expiresAt || state.startedAt + state.durationDays * 24 * 60 * 60 * 1000);
        const active = Boolean(state.active) &&
            Number.isFinite(state.startedAt) && state.startedAt <= Date.now() &&
            Number.isFinite(expiryAt) && Date.now() < expiryAt;

        if (!active) {
            gate.hidden = false;
            value.classList.remove("running");
            countdown.classList.remove("running");
            badge.textContent = "TIDAK AKTIF";
            badge.className = "studio-gate-badge inactive";
            title.textContent = state.active && state.startedAt > Date.now()
                ? "Langganan Studio Medsos belum dimulai"
                : "Status akun Anda tidak aktif sebagai langganan";
            message.textContent = state.active && state.startedAt > Date.now()
                ? "Akses Studio Medsos akan tersedia setelah waktu mulai langganan."
                : "Anda belum memiliki langganan aktif untuk membuka Studio Medsos. Aktivasi langganan diperlukan untuk mengakses fitur ini.";
            value.textContent = "Akses dibatasi";
            countdown.textContent = state.active && state.startedAt > Date.now()
                ? `Mulai pada: ${new Date(state.startedAt).toLocaleString("id-ID")}`
                : "Silakan hubungi admin untuk aktivasi paket.";
            okButton.disabled = true;
            mainWrap.classList.add("studio-locked");
            return;
        }

        const remainingMs = Math.max(0, expiryAt - Date.now());
        const totalSeconds = Math.floor(remainingMs / 1000);
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        badge.textContent = "AKTIF";
        badge.className = "studio-gate-badge active";
        value.classList.add("running");
        countdown.classList.add("running");
        title.textContent = "Status akun aktif sebagai langganan";
        message.textContent = "Masa aktif langganan Anda masih berjalan. Halaman akan terbuka setelah Anda menutup pengingat ini.";
        value.textContent = `${hours >= 12 ? days + 1 : days} hari`;
        countdown.textContent = `${days} hari ${String(hours).padStart(2, "0")} jam ${String(minutes).padStart(2, "0")} menit ${String(seconds).padStart(2, "0")} detik`;
        okButton.disabled = false;
        gate.hidden = studioGateDismissed;
        mainWrap.classList.toggle("studio-locked", !studioGateDismissed);
    }

    async function refreshStudioGate() {
        try {
            studioAccessState = await getStudioSubscriptionState();
            studioAccessError = null;
        } catch (error) {
            studioAccessState = null;
            studioAccessError = error;
            console.error("Studio Medsos access verification failed:", error);
        }
        updateStudioGate();
    }

    function attachStudioGateEvents() {
        const gate = document.getElementById("studio-access-gate");
        const okButton = document.getElementById("studio-gate-ok");
        if (!gate || !okButton) return;

        okButton.addEventListener("click", () => {
            studioGateDismissed = true;
            gate.hidden = true;
            const mainWrap = document.querySelector("main.wrap");
            if (mainWrap) mainWrap.classList.remove("studio-locked");
        });

        refreshStudioGate();
        refreshStudioPricing();
        window.setInterval(updateStudioGate, 1000);
        window.setInterval(refreshStudioGate, 60000);
        window.setInterval(pollAutopostSuccess, 20000);
        pollAutopostSuccess();
        window.addEventListener("focus", refreshStudioGate);
    }
    showOAuthResult();
    renderInAppBrowserHint();
    setDefaultStartTime();
    updateCostEstimate();
    attachStudioGateEvents();
    loadDashboard();
})();
