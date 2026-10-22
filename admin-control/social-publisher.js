import { cleanImage } from "../metadata-cleaner/assets/js/metadata-cleaner-image.js";

(() => {
    "use strict";

    const endpoint = "/api/social-publisher";
    const RUNS_PER_PAGE_OPTIONS = [10, 20, 50, 100];
    const DEFAULT_RUNS_PER_PAGE = 10;
    const RUNS_PER_PAGE_STORAGE_KEY = "genz-social-runs-per-page";

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
        manualPreview: null
    };
    const $ = id => document.getElementById(id);
    const pageMessage = $("page-message");
    const configMessage = $("config-message");
    const configList = $("config-list");
    const globalState = $("global-state");
    const globalToggle = $("global-toggle");
    const connectStatus = $("connect-status");
    const characterStatus = $("character-status");
    const scheduleStatus = $("schedule-status");
    const uploadButton = $("upload-character");
    const saveScheduleButton = $("save-schedule");
    const connectButton = $("connect-page");
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
            const data = await response.json().catch(() => ({}));
            if (!response.ok || data.success !== true) {
                const error = new Error(data.error || `Permintaan gagal (HTTP ${response.status}).`);
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
                : "Gemini Image API";
        const captionProviderLabel = config.captionProvider === "cloudflare"
            ? "Cloudflare Vision Caption"
            : config.captionProvider === "qwencloud" ? "QwenCloud Vision Caption" : "Gemini Caption API";
        const garmentLabel = document.querySelector("label[for='character-garment']");
        if (garmentLabel) {
            garmentLabel.textContent = config.imageProvider === "cloudflare"
                ? "Foto pakaian default (opsional bila sudah ada outfit)"
                : "Foto pakaian default (opsional)";
        }
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
        globalToggle.disabled = !allReady && !state.data?.globalEnabled;
        if (!allReady && !state.data?.globalEnabled) {
            showNotice(configMessage, "Autopublish belum dapat diaktifkan. Lengkapi secrets Cloudflare, buat bucket privat Supabase Storage, dan pastikan SQL migration sudah dijalankan.", "warn");
        } else {
            configMessage.hidden = true;
        }
    }

    function renderGlobalState(enabled) {
        globalState.textContent = enabled ? "AUTOPUBLISH ON" : "AUTOPUBLISH OFF";
        globalState.className = `state ${enabled ? "on" : "off"}`;
        globalToggle.textContent = enabled ? "Jeda semua autopost" : "Aktifkan autopublish";
        globalToggle.classList.toggle("danger", enabled);
        globalToggle.classList.toggle("green", !enabled);
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
            icon.className = "thumb";
            icon.style.display = "grid";
            icon.style.placeItems = "center";
            icon.style.fontSize = "22px";
            icon.textContent = "f";
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
            disconnect.addEventListener("click", () => disconnectPage(page.id));
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
        const cloudflareProvider = state.data?.config?.imageProvider === "cloudflare";
        container.replaceChildren();
        select.replaceChildren(new Option("Pilih karakter…", ""));
        manualSelect.replaceChildren(new Option("Pilih karakter…", ""));
        for (const character of characters) {
            const characterOutfits = (state.data?.outfits || []).filter(outfit => outfit.character_id === character.id);
            const activeOutfitCount = characterOutfits.filter(outfit => outfit.is_active !== false).length;
            const needsGarment = cloudflareProvider && !character.garment_filename && activeOutfitCount === 0;
            const optionLabel = needsGarment
                ? `${character.display_name} · outfit belum diatur`
                : character.display_name;
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
            const garmentImg = document.createElement("img");
            garmentImg.className = "thumb";
            garmentImg.alt = character.garment_filename ? `Foto pakaian ${character.display_name}` : "Foto pakaian belum diatur";
            garmentImg.loading = "lazy";
            garmentImg.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='54' height='66'%3E%3Crect width='100%25' height='100%25' fill='%231b2737'/%3E%3C/svg%3E";
            garmentImg.dataset.characterId = character.id;
            if (character.garment_filename) loadGarmentPreview(character.id, garmentImg);
            const thumbs = document.createElement("div");
            thumbs.className = "thumbs";
            thumbs.append(img, garmentImg);
            const content = document.createElement("div");
            const title = document.createElement("p");
            title.className = "item-title";
            title.textContent = character.display_name;
            const detail = document.createElement("div");
            detail.className = "item-meta";
            detail.textContent = `${character.reference_filename || "referensi"} · ${activeOutfitCount ? `${activeOutfitCount} outfit aktif` : "Belum ada outfit"} · ${character.garment_filename ? "Pakaian default tersedia" : "Tanpa pakaian default"} · ${character.prompt_notes || "Tanpa catatan tambahan"}`;
            content.append(title, detail);
            const action = document.createElement("button");
            action.className = "btn small";
            action.type = "button";
            action.textContent = character.garment_filename ? "Ganti pakaian default" : "Pakaian default";
            action.addEventListener("click", () => uploadGarment(character));
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
            notesAction.textContent = "Edit catatan";
            notesAction.addEventListener("click", () => editCharacter(character));
            const actions = document.createElement("div");
            actions.className = "item-actions";
            actions.append(outfitAction, action, notesAction);
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

    async function loadGarmentPreview(characterId, img) {
        try {
            const response = await api("garment&character_id=" + encodeURIComponent(characterId), { raw: true });
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            if (img.dataset.characterId && img.dataset.characterId !== characterId) {
                URL.revokeObjectURL(url);
                return;
            }
            const previousUrl = state.objectUrls.get(`garment:${characterId}`);
            if (previousUrl) URL.revokeObjectURL(previousUrl);
            state.objectUrls.set(`garment:${characterId}`, url);
            img.src = url;
        } catch {
            if (!img.dataset.characterId || img.dataset.characterId === characterId) {
                img.alt = "Preview pakaian tidak tersedia";
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
                ? "Belum ada outfit untuk karakter ini. Tambahkan minimal satu outfit agar gambar memakai pakaian yang Anda tentukan."
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
            remove.addEventListener("click", () => deleteOutfit(outfit));
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
        if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 8 * 1024 * 1024) {
            status(outfitStatus, "Foto outfit harus JPEG, PNG, atau WebP berukuran maksimal 8 MB.", "error");
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

    async function editOutfit(outfit) {
        const name = window.prompt("Nama outfit", outfit.name || "");
        if (name === null) return;
        const orderUrl = window.prompt("Link order outfit (HTTPS, boleh dikosongkan)", outfit.order_url || "");
        if (orderUrl === null) return;
        const notes = window.prompt("Catatan outfit (boleh dikosongkan)", outfit.notes || "");
        if (notes === null) return;
        if (orderUrl.trim() && !safeHttpsLink(orderUrl)) {
            showNotice(pageMessage, "Link order harus berupa URL HTTPS yang valid.", "error");
            return;
        }
        try {
            await api("save-outfit", {
                method: "POST",
                body: {
                    id: outfit.id,
                    name: name.trim() || outfit.name,
                    order_url: orderUrl.trim(),
                    notes: notes.trim(),
                    is_active: outfit.is_active !== false
                }
            });
            showNotice(pageMessage, "Outfit diperbarui.", "success");
            await loadDashboard();
        } catch (error) {
            showNotice(pageMessage, error.message, "error");
        }
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

    async function deleteOutfit(outfit) {
        if (!window.confirm(`Hapus outfit "${outfit.name}"? Riwayat post yang sudah terbit tidak berubah.`)) return;
        try {
            await api("delete-outfit", { method: "POST", body: { id: outfit.id } });
            showNotice(pageMessage, "Outfit dihapus.", "success");
            await loadDashboard();
        } catch (error) {
            showNotice(pageMessage, error.message, "error");
        }
    }

    function updateManualCharacterPreview() {
        const characterId = $("manual-character").value;
        const preview = $("manual-character-preview");
        const placeholder = $("manual-character-placeholder");
        const garmentBox = $("manual-garment-box");
        const garmentPreview = $("manual-garment-preview");
        if (state.manualPreview) return;
        preview.dataset.characterId = characterId;
        garmentPreview.dataset.characterId = characterId;
        if (!characterId) {
            preview.hidden = true;
            preview.removeAttribute("src");
            placeholder.hidden = false;
            garmentBox.hidden = true;
            garmentPreview.removeAttribute("src");
            return;
        }
        const character = state.data?.characters?.find(item => item.id === characterId);
        preview.alt = `Foto referensi ${character?.display_name || "karakter"} yang dipilih`;
        preview.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='54' height='66'%3E%3Crect width='100%25' height='100%25' fill='%231b2737'/%3E%3C/svg%3E";
        preview.hidden = false;
        placeholder.hidden = true;
        loadReferencePreview(characterId, preview);
        if (character?.garment_filename) {
            garmentBox.hidden = false;
            garmentPreview.alt = `Foto pakaian ${character.display_name} yang dipilih`;
            garmentPreview.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='54' height='66'%3E%3Crect width='100%25' height='100%25' fill='%231b2737'/%3E%3C/svg%3E";
            loadGarmentPreview(characterId, garmentPreview);
        } else {
            garmentBox.hidden = true;
            garmentPreview.removeAttribute("src");
        }
    }

    async function submitManualPost(event) {
        event.preventDefault();
        const characterId = $("manual-character").value;
        const pageConnectionId = $("manual-page").value;
        if (!characterId || !pageConnectionId) {
            status($("manual-post-status"), "Pilih karakter tersimpan dan Facebook Page.", "error");
            return;
        }
        const selectedCharacter = (state.data?.characters || []).find(character => character.id === characterId);
        const hasActiveOutfit = (state.data?.outfits || []).some(outfit => outfit.character_id === characterId && outfit.is_active !== false);
        if (state.data?.config?.imageProvider === "cloudflare" && selectedCharacter && !selectedCharacter.garment_filename && !hasActiveOutfit) {
            status(
                $("manual-post-status"),
                `Karakter "${selectedCharacter.display_name}" belum memiliki outfit maupun foto pakaian, sedangkan Cloudflare P-Image Try-On mewajibkannya. Tambahkan outfit pada bagian "Outfit & link order", lalu ulangi pratinjau.`,
                "error"
            );
            return;
        }
        const button = $("manual-post-button");
        let generatedRunId = "";
        setButtonBusy(button, true, "Membuat gambar AI…", {
            premium: true,
            stages: [
                { at: 0, text: "Membuat gambar AI…" },
                { at: 7, text: "Merancang visual & caption…" },
                { at: 16, text: "Menyempurnakan detail gambar…" }
            ]
        });
        status($("manual-post-status"), "Membuat satu gambar, membersihkan metadata, dan menyiapkan caption untuk pratinjau…");
        try {
            if (state.manualPreview) await discardManualPreview(false);
            const result = await api("manual-generate", {
                method: "POST",
                body: {
                    character_id: characterId,
                    page_connection_id: pageConnectionId,
                    aspect_ratio: $("manual-aspect-ratio").value
                }
            });
            generatedRunId = result.preview.run_id;
            updateButtonBusyText(button, "Membersihkan metadata…");
            const binary = atob(result.preview.image_base64);
            const bytes = new Uint8Array(binary.length);
            for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
            const generatedBlob = new Blob([bytes], { type: result.preview.image_mime_type });
            const cleaned = await cleanImage(generatedBlob);
            const objectUrl = URL.createObjectURL(cleaned.blob);
            const previousUrl = state.objectUrls.get("manual-preview");
            if (previousUrl) URL.revokeObjectURL(previousUrl);
            state.objectUrls.set("manual-preview", objectUrl);
            state.manualPreview = {
                runId: result.preview.run_id,
                blob: cleaned.blob,
                pageName: result.preview.page_name,
                caption: result.preview.caption
            };
            $("manual-generated-preview").src = objectUrl;
            $("manual-generated-result").hidden = false;
            $("manual-character-preview").hidden = true;
            $("manual-character-placeholder").hidden = true;
            $("manual-garment-box").hidden = true;
            $("manual-generated-caption").textContent = result.preview.caption;
            showManualOutfit(result.preview.outfit);
            const outfitNote = result.preview.outfit?.name
                ? ` Outfit acak: ${result.preview.outfit.name}${result.preview.outfit.order_url ? " (link order disertakan di caption)" : ""}.`
                : "";
            status(
                $("manual-post-status"),
                `Gambar ${result.preview.aspect_ratio} selesai dibuat dan dibersihkan.${outfitNote} Periksa pratinjau serta caption sebelum menerbitkan.`,
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

    async function publishManualPreview() {
        if (!state.manualPreview) {
            status($("manual-post-status"), "Buat pratinjau gambar terlebih dahulu.", "error");
            return;
        }
        if (!window.confirm(`Terbitkan gambar dan caption pratinjau ini ke "${state.manualPreview.pageName}"? Post akan langsung terlihat oleh audiens Page.`)) return;

        const button = $("manual-publish-button");
        const discardButton = $("manual-discard-button");
        const pageConnectionId = $("manual-page").value;
        if (discardButton) discardButton.disabled = true;
        setButtonBusy(button, true, "Mengunggah ke Facebook Page…", {
            premium: true,
            stages: [
                { at: 0, text: "Mengunggah ke Facebook Page…" },
                { at: 5, text: "Menerbitkan posting Page…" }
            ]
        });
        status($("manual-post-status"), "Mengirim gambar yang sudah dibersihkan ke Facebook Page…");
        try {
            const result = await api("manual-publish", {
                method: "POST",
                body: state.manualPreview.blob,
                raw: true,
                responseRaw: false,
                headers: {
                    "Content-Type": state.manualPreview.blob.type,
                    "X-Manual-Run-Id": state.manualPreview.runId
                }
            });
            const postUrl = safeExternalUrl(result.post?.permalink_url);
            status(
                $("manual-post-status"),
                `Posting berhasil diterbitkan ke ${result.post?.page_name || "Facebook Page"}.${postUrl ? ` ${postUrl}` : ""}`,
                "good"
            );
            showNotice(pageMessage, "Posting manual berhasil diterbitkan.", "success");
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

    function clearManualPreview() {
        const previewUrl = state.objectUrls.get("manual-preview");
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        state.objectUrls.delete("manual-preview");
        state.manualPreview = null;
        $("manual-generated-preview").removeAttribute("src");
        $("manual-generated-result").hidden = true;
        $("manual-outfit-line").hidden = true;
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
            status($("posting-settings-status"), "Caption dasar dan link tersimpan; akan dipakai di semua posting berikutnya.", "good");
        } catch (error) {
            status($("posting-settings-status"), error.message || "Pengaturan caption gagal disimpan.", "error");
        } finally {
            setButtonBusy(button, false);
        }
    }

    async function editCharacter(character) {
        const displayName = window.prompt("Nama karakter", character.display_name || "");
        if (displayName === null) return;
        const promptNotes = window.prompt("Ciri karakter yang perlu dijaga", character.prompt_notes || "");
        if (promptNotes === null) return;
        try {
            await api("save-character", { method: "POST", body: { id: character.id, display_name: displayName, prompt_notes: promptNotes } });
            showNotice(pageMessage, "Catatan karakter diperbarui.", "success");
            await loadDashboard();
        } catch (error) {
            showNotice(pageMessage, error.message, "error");
        }
    }

    async function uploadGarment(character) {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/jpeg,image/png,image/webp";
        input.addEventListener("change", async () => {
            const file = input.files?.[0];
            if (!file) return;
            if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 8 * 1024 * 1024) {
                showNotice(pageMessage, "Pilih JPEG, PNG, atau WebP berukuran maksimal 8 MB.", "error");
                return;
            }
            if (!window.confirm("Pastikan Anda berhak menggunakan foto pakaian ini. Saat Cloudflare dipilih, foto akan diproses oleh Workers AI/Pruna. Lanjutkan unggah?")) return;
            try {
                await api(`upload-garment&character_id=${encodeURIComponent(character.id)}`, {
                    method: "POST",
                    body: file,
                    raw: true,
                    headers: {
                        "Content-Type": file.type,
                        "X-File-Name": encodeURIComponent(file.name),
                        "X-Garment-Rights": "1"
                    }
                });
                showNotice(pageMessage, "Foto pakaian tersimpan. Cloudflare P-Image Try-On akan memakainya untuk gambar berikutnya.", "success");
                await loadDashboard();
            } catch (error) {
                showNotice(pageMessage, error.message, "error");
            }
        }, { once: true });
        input.click();
    }

    function pageName(id) {
        return state.data?.pages?.find(page => page.id === id)?.page_name || "Page";
    }
    function characterName(id) {
        return state.data?.characters?.find(character => character.id === id)?.display_name || "Karakter";
    }

    function renderSchedules(schedules = []) {
        const container = $("schedules-list");
        container.replaceChildren();
        for (const schedule of schedules) {
            const card = document.createElement("article");
            card.className = "item";
            card.style.gridTemplateColumns = "minmax(0,1fr) auto";
            const content = document.createElement("div");
            const title = document.createElement("p");
            title.className = "item-title";
            title.textContent = `${characterName(schedule.character_id)} → ${pageName(schedule.page_connection_id)}`;
            const detail = document.createElement("div");
            detail.className = "item-meta";
            detail.textContent = `Setiap ${schedule.interval_hours} jam · rasio ${schedule.aspect_ratio || "9:16"} · berikutnya ${formatDate(schedule.next_run_at)} · ${schedule.enabled ? "jadwal aktif" : "jadwal dijeda"}`;
            content.append(title, detail);
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
            const toggle = document.createElement("button");
            toggle.className = `btn small ${schedule.enabled ? "danger" : "green"}`;
            toggle.type = "button";
            toggle.textContent = schedule.enabled ? "Jeda" : "Aktifkan";
            toggle.addEventListener("click", () => toggleSchedule(schedule));
            const remove = document.createElement("button");
            remove.className = "btn small danger";
            remove.type = "button";
            remove.textContent = "Hapus";
            remove.addEventListener("click", () => deleteSchedule(schedule.id));
            actions.append(edit, toggle, remove);
            card.append(content, actions);
            container.append(card);
        }
        if (!schedules.length) container.innerHTML = '<div class="empty">Belum ada jadwal autopost.</div>';
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
            label.textContent = run.status || "queued";
            const source = run.schedule_id ? "Jadwal" : "Manual";
            title.append(label, document.createTextNode(`  ${source} · ${formatDate(run.scheduled_for || run.created_at)}`));
            const detail = document.createElement("div");
            detail.className = "item-meta";
            const scene = run.scene_plan || {};
            detail.textContent = run.status === "failed"
                ? (run.error_message || "Posting gagal; cek konfigurasi API dan Page.")
                : [scene.location, run.outfit_name || scene.outfit, run.caption].filter(Boolean).join(" · ") || "Menunggu proses.";
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
            item.append(content);
            container.append(item);
        }
        if (!visibleRuns.length) container.innerHTML = '<div class="empty">Belum ada run. Aktifkan jadwal untuk mulai.</div>';
        renderRunsPaginationControls();
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
        renderConfig(data.config || {});
        renderGlobalState(data.globalEnabled === true);
        renderPages(data.pages || []);
        renderCharacters(data.characters || []);
        renderSchedules(data.schedules || []);
        renderRuns(data.runs || [], data.runsPagination || null);
        $("default-caption-template").value = data.postingSettings?.caption_template || "Cerita hari ini ✨";
        $("external-post-link").value = data.postingSettings?.external_link || "";
        renderOutfitSelector(data.characters || []);
        renderOutfits();
        applySchedulePolicyUi();
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
        if (state.busy) return;
        state.busy = true;
        $("refresh").disabled = true;
        try {
            const data = await api(`dashboard&runs_page=${state.runsPage}&runs_limit=${state.runsPerPage}`);
            render(data);
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

    async function connectFacebook() {
        setButtonBusy(connectButton, true, "Menghubungkan…");
        status(connectStatus, "Membuka persetujuan Meta…");
        try {
            const result = await api("oauth-start");
            const url = new URL(result.authorization_url);
            if (url.protocol !== "https:" || !["www.facebook.com", "facebook.com"].includes(url.hostname)) throw new Error("URL OAuth tidak valid.");
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
                result.can_publish ? "good" : "error"
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

    async function disconnectPage(id) {
        if (!window.confirm("Putuskan koneksi Page ini? Jadwal yang masih menggunakannya harus dihapus terlebih dahulu.")) return;
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
        const garmentFile = $("character-garment").files?.[0];
        if (!name || !file || !$("character-consent").checked) {
            status(characterStatus, "Isi nama, pilih foto, dan centang konfirmasi hak penggunaan serta subjek dewasa.", "error");
            return;
        }
        if (!/image\/(jpeg|png|webp)/.test(file.type) || file.size > 8 * 1024 * 1024) {
            status(characterStatus, "Pilih JPEG, PNG, atau WebP berukuran maksimal 8 MB.", "error");
            return;
        }
        if (garmentFile && (!/^image\/(jpeg|png|webp)$/.test(garmentFile.type) || garmentFile.size > 8 * 1024 * 1024)) {
            status(characterStatus, "Foto pakaian harus JPEG, PNG, atau WebP berukuran maksimal 8 MB.", "error");
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
            if (garmentFile) {
                await api(`upload-garment&character_id=${encodeURIComponent(data.character.id)}`, {
                    method: "POST",
                    body: garmentFile,
                    raw: true,
                    headers: {
                        "Content-Type": garmentFile.type,
                        "X-File-Name": encodeURIComponent(garmentFile.name),
                        "X-Garment-Rights": "1"
                    }
                });
            }
            const notes = $("character-notes").value.trim();
            if (notes) {
                await api("save-character", { method: "POST", body: { id: data.character.id, display_name: name, prompt_notes: notes } });
            }
            $("character-form").reset();
            status(characterStatus, garmentFile
                ? "Karakter dan foto pakaian tersimpan di Supabase Storage privat."
                : "Karakter tersimpan. Tambahkan foto pakaian sebelum memakai Cloudflare P-Image Try-On.", "good");
            await loadDashboard();
        } catch (error) {
            status(characterStatus, characterCreated
                ? `Karakter sudah tersimpan, tetapi foto pakaian/catatan gagal disimpan: ${error.message}`
                : error.message, "error");
            if (characterCreated) await loadDashboard();
        } finally {
            setButtonBusy(uploadButton, false);
        }
    }

    function schedulePolicy() {
        const policy = state.data?.schedulePolicy || {};
        const min = Number.isInteger(Number(policy.minIntervalHours)) && Number(policy.minIntervalHours) > 0
            ? Number(policy.minIntervalHours)
            : 1;
        const max = Number.isInteger(Number(policy.maxIntervalHours)) && Number(policy.maxIntervalHours) >= min
            ? Number(policy.maxIntervalHours)
            : 168;
        return {
            role: String(policy.role || "").trim().toUpperCase(),
            min,
            max
        };
    }

    function applySchedulePolicyUi() {
        const { role, min, max } = schedulePolicy();
        const input = $("interval-hours");
        input.min = String(min);
        input.max = String(max);
        const help = $("interval-help");
        if (help) {
            const roleLabel = role ? `role ${role}` : "role Anda";
            help.textContent = `Minimal ${min} jam untuk ${roleLabel}, maksimal ${max} jam. ${min} jam = batas tercepat (satu post tiap jam); 24 jam = satu post per hari.`;
        }
        const value = Number(input.value);
        if (!Number.isInteger(value) || value < min || value > max) {
            input.value = String(Math.min(max, Math.max(min, 24)));
        }
        updateCostEstimate();
    }

    function updateCostEstimate() {
        const { role, min, max } = schedulePolicy();
        const interval = Number($("interval-hours").value);
        if (!Number.isInteger(interval) || interval < min || interval > max) {
            $("cost-estimate").textContent = `Interval harus bilangan bulat antara ${min} sampai ${max} jam untuk role ${role || "Anda"} (minimal ${min} jam).`;
            return;
        }
        const imagesPerMonth = 30 * 24 / interval;
        const cadence = interval === 1 ? "satu post per jam" : `satu post setiap ${interval} jam`;
        const riskNote = interval < 6
            ? " Interval di bawah 6 jam berarti lebih dari 4 post per hari per jadwal; pastikan kuota provider dan kebijakan Facebook Page Anda mendukung."
            : "";
        $("cost-estimate").textContent = `Perkiraan volume Nano Banana 2 Lite: ${imagesPerMonth.toFixed(1)} gambar/bulan (${cadence}) pada 1 gambar per jadwal. Biaya bergantung pada tier dan kuota model untuk API key Anda, serta belum termasuk satu panggilan Gemini 2.5 Flash untuk caption per gambar, retry, atau pajak. Periksa harga dan kuota di Google AI Studio sebelum mengaktifkan autopost.${riskNote}`;
    }

    function editSchedule(schedule) {
        $("schedule-id").value = schedule.id;
        $("schedule-character").value = schedule.character_id;
        $("schedule-page").value = schedule.page_connection_id;
        $("interval-hours").value = schedule.interval_hours;
        $("first-run").value = utcToLocalWib(schedule.next_run_at);
        $("schedule-aspect-ratio").value = schedule.aspect_ratio || "9:16";
        $("schedule-enabled").checked = schedule.enabled === true;
        saveScheduleButton.textContent = "Simpan perubahan";
        $("cancel-edit").hidden = false;
        updateCostEstimate();
        window.scrollTo({ top: $("schedule-form").getBoundingClientRect().top + window.scrollY - 18, behavior: "smooth" });
    }

    function resetScheduleForm() {
        $("schedule-form").reset();
        $("schedule-id").value = "";
        const { min, max } = schedulePolicy();
        $("interval-hours").value = String(min <= 24 && 24 <= max ? 24 : min);
        $("schedule-aspect-ratio").value = "9:16";
        $("schedule-enabled").checked = false;
        saveScheduleButton.textContent = "Simpan jadwal";
        $("cancel-edit").hidden = true;
        setDefaultStartTime();
        updateCostEstimate();
    }

    async function submitSchedule(event) {
        event.preventDefault();
        const intervalHours = Number($("interval-hours").value);
        const nextRunAt = localWibToUtc($("first-run").value);
        const { role, min, max } = schedulePolicy();
        if (!nextRunAt || Date.parse(nextRunAt) <= Date.now()) {
            status(scheduleStatus, "Atur waktu pertama di masa depan sesuai WIB.", "error");
            return;
        }
        if (!Number.isInteger(intervalHours) || intervalHours < min || intervalHours > max) {
            status(
                scheduleStatus,
                `Interval harus bilangan bulat ${min}–${max} jam untuk role ${role || "Anda"}. Minimal ${min} jam (satu post per jam).`,
                "error"
            );
            return;
        }
        const body = {
            id: $("schedule-id").value || undefined,
            character_id: $("schedule-character").value,
            page_connection_id: $("schedule-page").value,
            interval_hours: intervalHours,
            next_run_at: nextRunAt,
            timezone: "Asia/Jakarta",
            aspect_ratio: $("schedule-aspect-ratio").value,
            caption_template: $("default-caption-template").value,
            enabled: $("schedule-enabled").checked
        };
        const scheduledCharacter = (state.data?.characters || []).find(character => character.id === body.character_id);
        if (state.data?.config?.imageProvider === "cloudflare" && scheduledCharacter && !scheduledCharacter.garment_filename
            && !window.confirm(`Karakter "${scheduledCharacter.display_name}" belum memiliki foto pakaian, sedangkan Cloudflare P-Image Try-On mewajibkannya. Jadwal akan terus gagal sampai foto pakaian diunggah. Tetap simpan jadwal?`)) {
            status(scheduleStatus, "Jadwal dibatalkan. Unggah foto pakaian pada karakter terlebih dahulu lewat tombol \"Atur pakaian\".", "error");
            return;
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

    async function deleteSchedule(id) {
        if (!window.confirm("Hapus jadwal ini? Riwayat posting akan tetap tersimpan.")) return;
        try {
            await api("delete-schedule", { method: "POST", body: { id } });
            showNotice(pageMessage, "Jadwal dihapus.", "success");
            await loadDashboard();
        } catch (error) {
            showNotice(pageMessage, error.message, "error");
        }
    }

    async function toggleGlobal() {
        if (!state.data) return;
        const enabling = !state.data.globalEnabled;
        const warning = enabling
            ? "Autopublish akan membuat dan menerbitkan gambar untuk semua jadwal aktif. Lanjutkan?"
            : "Jeda semua autopost? Jadwal tersimpan dan dapat diaktifkan kembali.";
        if (!window.confirm(warning)) return;
        setButtonBusy(globalToggle, true, "Memperbarui…");
        try {
            await api("set-global-enabled", { method: "POST", body: { enabled: enabling } });
            showNotice(pageMessage, enabling ? "Autopublish global aktif." : "Autopublish global dijeda.", enabling ? "success" : "warn");
            await loadDashboard();
        } catch (error) {
            showNotice(pageMessage, error.message, "error");
        } finally {
            setButtonBusy(globalToggle, false);
            renderGlobalState(state.data?.globalEnabled === true);
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
                state: "Permintaan OAuth tidak valid. Silakan coba hubungkan ulang.",
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
    $("manual-discard-button").addEventListener("click", async () => {
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
    $("manual-character").addEventListener("change", updateManualCharacterPreview);
    $("schedule-form").addEventListener("submit", submitSchedule);
    $("interval-hours").addEventListener("input", updateCostEstimate);
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
    $("global-toggle").addEventListener("click", toggleGlobal);
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
        value.textContent = `${state.durationDays} hari`;
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
        window.addEventListener("focus", refreshStudioGate);
    }
    showOAuthResult();
    setDefaultStartTime();
    updateCostEstimate();
    attachStudioGateEvents();
    loadDashboard();
})();
