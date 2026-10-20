import { cleanImage } from "../metadata-cleaner/assets/js/metadata-cleaner-image.js";

(() => {
    "use strict";

    const endpoint = "/api/social-publisher";
    const state = { data: null, busy: false, objectUrls: new Map(), manualPreview: null };
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

    async function sessionToken() {
        const { data, error } = await client().auth.getSession();
        if (error) throw error;
        const token = data?.session?.access_token;
        if (!token) throw new Error("Sesi login tidak ditemukan. Silakan login ulang sebagai admin.");
        return token;
    }

    async function api(action, { method = "GET", body, headers = {}, raw = false, responseRaw = raw } = {}) {
        const token = await sessionToken();
        const [actionName, ...queryParts] = String(action).split("&");
        const query = new URLSearchParams({ action: actionName });
        for (const part of queryParts) {
            const separator = part.indexOf("=");
            if (separator > 0) query.set(part.slice(0, separator), decodeURIComponent(part.slice(separator + 1)));
        }
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
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.success !== true) {
            throw new Error(data.error || `Permintaan gagal (HTTP ${response.status}).`);
        }
        return data;
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

    function setButtonBusy(button, busy, busyText = "Memproses…") {
        if (!button.dataset.originalText) button.dataset.originalText = button.textContent.trim();
        button.disabled = busy;
        button.textContent = busy ? busyText : button.dataset.originalText;
    }

    function renderConfig(config = {}) {
        const imageProviderLabel = config.imageProvider === "cloudflare" ? "Cloudflare Workers AI" : "Gemini Image API";
        const captionProviderLabel = config.captionProvider === "cloudflare" ? "Cloudflare Vision Caption" : "Gemini Caption API";
        const garmentLabel = document.querySelector("label[for='character-garment']");
        if (garmentLabel) {
            garmentLabel.textContent = config.imageProvider === "cloudflare"
                ? "Foto pakaian untuk Cloudflare Try-On (wajib)"
                : "Foto pakaian untuk Cloudflare Try-On (opsional)";
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
            detail.textContent = page.can_publish ? `ID ${page.page_id} · izin posting siap` : `ID ${page.page_id} · izin CREATE_CONTENT belum terdeteksi`;
            content.append(title, detail);
            const actions = document.createElement("div");
            actions.className = "item-actions";
            const disconnect = document.createElement("button");
            disconnect.className = "btn small danger";
            disconnect.type = "button";
            disconnect.textContent = "Putuskan";
            disconnect.addEventListener("click", () => disconnectPage(page.id));
            actions.append(disconnect);
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
            const optionLabel = cloudflareProvider && !character.garment_filename
                ? `${character.display_name} · pakaian belum diatur`
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
            detail.textContent = `${character.reference_filename || "referensi"} · ${character.garment_filename ? `Pakaian: ${character.garment_filename}` : "Foto pakaian belum diatur"} · ${character.prompt_notes || "Tanpa catatan tambahan"}`;
            content.append(title, detail);
            const action = document.createElement("button");
            action.className = "btn small";
            action.type = "button";
            action.textContent = character.garment_filename ? "Ganti pakaian" : "Atur pakaian";
            action.addEventListener("click", () => uploadGarment(character));
            const notesAction = document.createElement("button");
            notesAction.className = "btn small";
            notesAction.type = "button";
            notesAction.textContent = "Edit catatan";
            notesAction.addEventListener("click", () => editCharacter(character));
            const actions = document.createElement("div");
            actions.className = "item-actions";
            actions.append(action, notesAction);
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
        if (state.data?.config?.imageProvider === "cloudflare" && selectedCharacter && !selectedCharacter.garment_filename) {
            status(
                $("manual-post-status"),
                `Karakter "${selectedCharacter.display_name}" belum memiliki foto pakaian, sedangkan Cloudflare P-Image Try-On mewajibkannya. Klik "Atur pakaian" pada daftar karakter tersimpan, lalu ulangi pratinjau.`,
                "error"
            );
            return;
        }
        const button = $("manual-post-button");
        let generatedRunId = "";
        setButtonBusy(button, true, "Membuat & membersihkan…");
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
            status(
                $("manual-post-status"),
                `Gambar ${result.preview.aspect_ratio} selesai dibuat dan dibersihkan. Periksa pratinjau serta caption sebelum menerbitkan.`,
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
        setButtonBusy(button, true, "Menerbitkan…");
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
            await loadDashboard();
        } catch (error) {
            clearManualPreview();
            status($("manual-post-status"), `${error.message || "Posting manual gagal."} Periksa Page sebelum mencoba ulang untuk menghindari post ganda.`, "error");
            showNotice(pageMessage, error.message || "Posting manual gagal.", "error");
            await loadDashboard();
        } finally {
            setButtonBusy(button, false);
        }
    }

    function clearManualPreview() {
        const previewUrl = state.objectUrls.get("manual-preview");
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        state.objectUrls.delete("manual-preview");
        state.manualPreview = null;
        $("manual-generated-preview").removeAttribute("src");
        $("manual-generated-result").hidden = true;
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

    function renderRuns(runs = []) {
        const container = $("runs-list");
        container.replaceChildren();
        for (const run of runs) {
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
                : [scene.location, scene.outfit, run.caption].filter(Boolean).join(" · ") || "Menunggu proses.";
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
        if (!runs.length) container.innerHTML = '<div class="empty">Belum ada run. Aktifkan jadwal untuk mulai.</div>';
    }

    function render(data) {
        state.data = data;
        renderConfig(data.config || {});
        renderGlobalState(data.globalEnabled === true);
        renderPages(data.pages || []);
        renderCharacters(data.characters || []);
        renderSchedules(data.schedules || []);
        renderRuns(data.runs || []);
        $("default-caption-template").value = data.postingSettings?.caption_template || "Cerita hari ini ✨";
        $("external-post-link").value = data.postingSettings?.external_link || "";
        const pagesWithoutPublish = (data.pages || []).filter(page => page.can_publish === false).length;
        if (pagesWithoutPublish) {
            showNotice(pageMessage, "Koneksi berhasil, tetapi satu atau beberapa Page belum memberi izin CREATE_CONTENT. Periksa izin aplikasi Meta dan peran Anda pada Page.", "warn");
        }
    }

    async function loadDashboard() {
        if (state.busy) return;
        state.busy = true;
        $("refresh").disabled = true;
        try {
            const data = await api("dashboard");
            render(data);
        } catch (error) {
            showNotice(pageMessage, error.message || "Gagal memuat Social Publisher.", "error");
            configList.replaceChildren();
            $("page-connections").innerHTML = '<div class="empty">Belum dapat dimuat.</div>';
            $("characters-list").innerHTML = '<div class="empty">Belum dapat dimuat.</div>';
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

    function updateCostEstimate() {
        const interval = Number($("interval-hours").value);
        if (!Number.isInteger(interval) || interval < 1 || interval > 168) {
            $("cost-estimate").textContent = "Interval harus antara 1 sampai 168 jam.";
            return;
        }
        const imagesPerMonth = 30 * 24 / interval;
        $("cost-estimate").textContent = `Perkiraan volume Nano Banana 2 Lite: ${imagesPerMonth.toFixed(1)} gambar/bulan pada 1 gambar per jadwal. Biaya bergantung pada tier dan kuota model untuk API key Anda, serta belum termasuk satu panggilan Gemini 2.5 Flash untuk caption per gambar, retry, atau pajak. Periksa harga dan kuota di Google AI Studio sebelum mengaktifkan autopost.`;
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
        $("interval-hours").value = "24";
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
        if (!nextRunAt || Date.parse(nextRunAt) <= Date.now()) {
            status(scheduleStatus, "Atur waktu pertama di masa depan sesuai WIB.", "error");
            return;
        }
        if (!Number.isInteger(intervalHours) || intervalHours < 1 || intervalHours > 168) {
            status(scheduleStatus, "Interval harus bilangan bulat dari 1 sampai 168 jam.", "error");
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
            showNotice(pageMessage, `Facebook berhasil dihubungkan. ${params.get("pages") || ""} Page ditemukan.`, "success");
        } else if (params.has("oauth_error")) {
            const code = params.get("oauth_error");
            const messages = {
                state: "Permintaan OAuth tidak valid. Silakan coba hubungkan ulang.",
                expired: "Permintaan OAuth kedaluwarsa. Silakan coba lagi.",
                denied: "Izin Facebook tidak diberikan.",
                config: "Konfigurasi Meta atau kunci enkripsi belum lengkap.",
                exchange: "Facebook gagal memverifikasi OAuth. Periksa Meta App dan redirect URI.",
                pages: "Tidak dapat membaca daftar Facebook Page yang Anda kelola.",
                no_pages: "Tidak ada Facebook Page yang dapat dihubungkan pada akun ini.",
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

    $("connect-page").addEventListener("click", connectFacebook);
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
    $("manual-character").addEventListener("change", updateManualCharacterPreview);
    $("schedule-form").addEventListener("submit", submitSchedule);
    $("interval-hours").addEventListener("input", updateCostEstimate);
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
