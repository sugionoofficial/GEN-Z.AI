(() => {
    "use strict";

    const API_ENDPOINT = "/api/social-publisher";
    const MAX_DAYS = 365;
    const MIN_DAYS = 1;
    const PRICE_PERIODS = [
        { key: "daily", label: "per hari" },
        { key: "weekly", label: "per minggu" },
        { key: "monthly", label: "per bulan" },
        { key: "yearly", label: "per tahun" }
    ];
    let users = [];
    let countdownTimer;
    let providerSettings = null;

    function getSupabaseClient() {
        if (window.GENZ_SUPABASE) return window.GENZ_SUPABASE;
        if (window.supabaseClient) return window.supabaseClient;
        const config = window.GENZ_CONFIG || {};
        const key = config.SUPABASE_KEY || config.SUPABASE_ANON_KEY || config.supabaseKey;
        if (!window.supabase?.createClient || !config.SUPABASE_URL || !key) {
            throw new Error("Konfigurasi Supabase tidak tersedia.");
        }
        window.GENZ_SUPABASE = window.supabase.createClient(config.SUPABASE_URL, key);
        return window.GENZ_SUPABASE;
    }

    function clampDays(value) {
        const days = Number(value);
        return Number.isInteger(days) ? Math.min(MAX_DAYS, Math.max(MIN_DAYS, days)) : MIN_DAYS;
    }

    function formatDateTime(value) {
        const date = new Date(value);
        if (!Number.isFinite(date.getTime())) return "--";
        return date.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
    }

    function toDateTimeLocal(value) {
        const date = new Date(value);
        if (!Number.isFinite(date.getTime())) return "";
        const pad = number => String(number).padStart(2, "0");
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    function setStatusMessage(message, type = "") {
        const node = document.getElementById("save-status");
        if (!node) return;
        node.className = `status-box ${type}`.trim();
        node.textContent = message;
    }

    function setPricingStatus(message, type = "") {
        const node = document.getElementById("studio-price-status");
        if (!node) return;
        node.className = `status-box price-settings-status ${type}`.trim();
        node.textContent = message;
    }

    function setImageProviderStatus(message, type = "") {
        const node = document.getElementById("image-provider-status");
        if (!node) return;
        node.className = `status-box price-settings-status ${type}`.trim();
        node.textContent = message;
    }

    function formatPrice(priceIdr) {
        return new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
            maximumFractionDigits: 0
        }).format(priceIdr);
    }

    function getActiveSubscription(user, now = Date.now()) {
        const access = user.studio_access;
        const startedAt = Date.parse(access?.started_at || "");
        const expiresAt = Date.parse(access?.expires_at || "");
        const profileIsActive = String(user.status || "").toLowerCase() === "active";
        if (!profileIsActive || !access?.is_active || !Number.isFinite(startedAt) || !Number.isFinite(expiresAt)) {
            return null;
        }
        if (startedAt > now || expiresAt <= now) return null;
        return { access, startedAt, expiresAt };
    }

    async function sessionToken() {
        const { data, error } = await getSupabaseClient().auth.getSession();
        if (error) throw error;
        const token = data?.session?.access_token;
        if (!token) throw new Error("Sesi login tidak ditemukan. Silakan login ulang.");
        return token;
    }

    async function api(action, { method = "GET", body } = {}) {
        const token = await sessionToken();
        const response = await fetch(`${API_ENDPOINT}?action=${encodeURIComponent(action)}`, {
            method,
            headers: {
                Authorization: `Bearer ${token}`,
                ...(body ? { "Content-Type": "application/json" } : {})
            },
            ...(body ? { body: JSON.stringify(body) } : {})
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || result.success !== true) {
            throw new Error(result.error || `Permintaan gagal (HTTP ${response.status}).`);
        }
        return result;
    }

    function populateUserSelect() {
        const select = document.getElementById("user-select");
        select.replaceChildren(new Option("Pilih user…", ""));
        for (const user of users) {
            const email = user.email || user.name || user.id;
            const option = new Option(`${email} (${user.role || "user"})`, user.id);
            option.disabled = String(user.status || "").toLowerCase() !== "active";
            select.add(option);
        }
    }

    function buildSubscriptionActions(user) {
        const actions = document.createElement("div");
        actions.className = "subscription-actions";

        const buttons = [
            { label: "Edit", action: "edit", variant: "edit" },
            { label: "Tambah masa aktif", action: "extend", variant: "extend" },
            { label: "Kurangi", action: "reduce", variant: "reduce" },
            { label: "Stop", action: "stop", variant: "stop" }
        ];

        for (const { label, action, variant } of buttons) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = `sub-btn ${variant}`;
            button.dataset.subAction = action;
            button.dataset.userId = user.id;
            button.textContent = label;
            actions.append(button);
        }

        return actions;
    }

    function renderActiveSubscriptions(now = Date.now()) {
        const list = document.getElementById("active-subscribers-list");
        const summary = document.getElementById("active-subscribers-summary");
        const count = document.getElementById("active-subscribers-count");
        const activeUsers = users
            .map(user => ({ user, subscription: getActiveSubscription(user, now) }))
            .filter(item => item.subscription)
            .sort((a, b) => a.subscription.expiresAt - b.subscription.expiresAt);

        count.textContent = `${activeUsers.length} AKUN`;
        summary.textContent = activeUsers.length
            ? "Akun aktif dengan langganan Studio Medsos yang masih berlaku."
            : "Saat ini belum ada akun dengan langganan aktif.";
        list.replaceChildren();

        if (!activeUsers.length) {
            const empty = document.createElement("div");
            empty.className = "empty-list";
            empty.textContent = "Belum ada user yang memiliki langganan aktif.";
            list.append(empty);
            return;
        }

        for (const { user, subscription } of activeUsers) {
            const item = document.createElement("article");
            item.className = "subscription-item";

            const details = document.createElement("div");
            const email = document.createElement("div");
            email.className = "subscription-user";
            email.textContent = user.email || user.name || user.id;

            const meta = document.createElement("div");
            meta.className = "subscription-meta";
            const role = document.createElement("span");
            role.textContent = user.role || "user";
            const duration = document.createElement("span");
            duration.textContent = `${subscription.access.duration_days} hari`;
            const expiry = document.createElement("span");
            expiry.textContent = `Berakhir ${formatDateTime(subscription.expiresAt)}`;
            meta.append(role, duration, expiry);
            details.append(email, meta);

            const countdown = document.createElement("div");
            countdown.className = "subscription-countdown";
            countdown.dataset.expiresAt = String(subscription.expiresAt);
            const remainingSeconds = Math.max(0, Math.floor((subscription.expiresAt - now) / 1000));
            countdown.textContent = formatCountdown(remainingSeconds);

            item.append(details, countdown, buildSubscriptionActions(user));
            list.append(item);
        }
    }

    function formatCountdown(totalSeconds) {
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `Sisa ${days} hari ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }

    function updateActiveSubscriptionCountdowns(now = Date.now()) {
        let expired = false;
        for (const countdown of document.querySelectorAll(".subscription-countdown")) {
            const expiresAt = Number(countdown.dataset.expiresAt);
            const remainingSeconds = Math.floor((expiresAt - now) / 1000);
            if (remainingSeconds <= 0) {
                expired = true;
                break;
            }
            countdown.textContent = formatCountdown(remainingSeconds);
        }
        if (expired) renderActiveSubscriptions(now);
    }

    function renderPreview(access) {
        const isActive = Boolean(access?.is_active);
        const startsAt = access?.started_at ? Date.parse(access.started_at) : 0;
        const expiresAt = access?.expires_at ? Date.parse(access.expires_at) : 0;
        const now = Date.now();
        const validExpiry = Number.isFinite(expiresAt);
        const pending = isActive && Number.isFinite(startsAt) && startsAt > now;
        const active = isActive && Number.isFinite(startsAt) && startsAt <= now && validExpiry && expiresAt > now;
        const remainingMs = active ? expiresAt - Date.now() : 0;
        const secondsLeft = Math.floor(remainingMs / 1000);
        const days = Math.floor(secondsLeft / 86400);
        const hours = Math.floor((secondsLeft % 86400) / 3600);
        const minutes = Math.floor((secondsLeft % 3600) / 60);
        const seconds = secondsLeft % 60;

        document.getElementById("badge-status").textContent = active ? "AKTIF" : "TIDAK AKTIF";
        document.getElementById("badge-status").className = `badge ${active ? "active" : "inactive"}`;
        document.getElementById("plan-status").textContent = active
            ? "Langganan siap digunakan"
            : pending ? `Langganan dimulai pada ${formatDateTime(access.started_at)}`
                : isActive && validExpiry ? "Masa langganan sudah berakhir" : "Belum ada langganan aktif";
        const remainingDisplay = document.getElementById("remaining-display");
        const countdownDisplay = document.getElementById("countdown-display");
        remainingDisplay.classList.toggle("running", active);
        countdownDisplay.classList.toggle("running", active);
        remainingDisplay.textContent = active
            ? `${Math.ceil(remainingMs / 86400000)} hari`
            : "0 hari";
        document.getElementById("expiry-display").textContent = `Berakhir pada: ${access?.expires_at ? formatDateTime(access.expires_at) : "--"}`;
        countdownDisplay.textContent = active
            ? `${days} hari ${String(hours).padStart(2, "0")} jam ${String(minutes).padStart(2, "0")} menit ${String(seconds).padStart(2, "0")} detik`
            : "00 hari 00 jam 00 menit 00 detik";
    }

    function setFormEnabled(enabled) {
        for (const id of ["access-status", "duration-days", "started-at", "save-config", "reset-config", "post-limit-input", "save-post-limit"]) {
            document.getElementById(id).disabled = !enabled;
        }
    }

    /* =====================================================
       AKSI PER USER — EDIT / TAMBAH / KURANGI / STOP
    ===================================================== */

    const adjustState = {
        userId: null,
        mode: "extend",
        busy: false
    };

    const QUICK_DAYS = {
        extend: [7, 30, 90],
        reduce: [1, 7, 30]
    };

    function findUser(userId) {
        return users.find(item => item.id === userId) || null;
    }

    function getBaseExpiry(user) {
        const expiresAt = Date.parse(user?.studio_access?.expires_at || "");
        const now = Date.now();
        return Number.isFinite(expiresAt) && expiresAt > now ? expiresAt : now;
    }

    function setAdjustStatus(message, type = "") {
        const node = document.getElementById("adjust-status");
        if (!node) return;
        node.className = `status-box adjust-status ${type}`.trim();
        node.textContent = message;
    }

    function readAdjustDays() {
        const input = document.getElementById("adjust-days");
        return Number(input?.value);
    }

    function renderAdjustPreview() {
        const user = findUser(adjustState.userId);
        const days = readAdjustDays();
        const preview = document.getElementById("adjust-preview");
        const applyButton = document.getElementById("adjust-apply");

        if (!preview || !applyButton) return;

        if (!Number.isInteger(days) || days < 1 || days > 365) {
            preview.textContent = "Masukkan jumlah hari antara 1 dan 365.";
            applyButton.disabled = true;
            return;
        }

        const base = getBaseExpiry(user);
        const signedDays = adjustState.mode === "reduce" ? -days : days;
        const nextExpiry = base + signedDays * 86400000;
        const remainingDays = Math.ceil((nextExpiry - Date.now()) / 86400000);

        if (nextExpiry <= Date.now()) {
            preview.textContent = "Pengurangan melebihi sisa masa aktif. Gunakan tombol Stop untuk menghentikan langganan.";
            applyButton.disabled = true;
            return;
        }

        applyButton.disabled = false;
        preview.textContent = `${adjustState.mode === "reduce" ? "Dikurangi" : "Ditambah"} ${days} hari · sisa ${remainingDays} hari · berakhir ${formatDateTime(nextExpiry)}`;
    }

    function openAdjustModal(userId, mode) {
        const user = findUser(userId);
        if (!user || !user.studio_access) {
            setStatusMessage("Data langganan user tidak ditemukan.", "error");
            return;
        }

        adjustState.userId = userId;
        adjustState.mode = mode === "reduce" ? "reduce" : "extend";

        const modal = document.getElementById("adjust-modal");
        const title = document.getElementById("adjust-title");
        const subtitle = document.getElementById("adjust-subtitle");
        const userLine = document.getElementById("adjust-user");
        const chips = document.getElementById("adjust-chips");
        const input = document.getElementById("adjust-days");

        const isReduce = adjustState.mode === "reduce";
        title.textContent = isReduce ? "Kurangi masa aktif" : "Tambah masa aktif";
        subtitle.textContent = isReduce
            ? "Kurangi sisa masa aktif langganan Studio Medsos user ini."
            : "Tambahkan masa aktif langganan Studio Medsos user ini.";
        userLine.textContent = `${user.email || user.name || user.id} · berakhir ${formatDateTime(user.studio_access.expires_at)}`;

        input.value = isReduce ? "7" : "30";

        chips.replaceChildren();
        for (const days of QUICK_DAYS[adjustState.mode]) {
            const chip = document.createElement("button");
            chip.type = "button";
            chip.className = "adjust-chip";
            chip.dataset.days = String(days);
            chip.textContent = `${days} hari`;
            chips.append(chip);
        }

        setAdjustStatus("");
        renderAdjustPreview();

        modal.hidden = false;
        modal.classList.add("show");
        document.body.classList.add("modal-open");
        window.setTimeout(() => input.focus(), 30);
    }

    function closeAdjustModal() {
        const modal = document.getElementById("adjust-modal");
        if (!modal) return;
        modal.classList.remove("show");
        modal.hidden = true;
        document.body.classList.remove("modal-open");
        adjustState.userId = null;
        adjustState.busy = false;
    }

    function applyAccessResult(userId, access) {
        const user = findUser(userId);
        if (user) user.studio_access = access;
        renderActiveSubscriptions();
        const selectedId = document.getElementById("user-select").value;
        if (selectedId && selectedId === userId) loadUserAccess(userId);
    }

    async function applyAdjust() {
        if (adjustState.busy) return;

        const days = readAdjustDays();
        const userId = adjustState.userId;

        if (!userId) return;
        if (!Number.isInteger(days) || days < 1 || days > 365) {
            setAdjustStatus("Jumlah hari harus bilangan bulat 1–365.", "error");
            return;
        }

        const user = findUser(userId);
        const signedDays = adjustState.mode === "reduce" ? -days : days;
        const applyButton = document.getElementById("adjust-apply");

        adjustState.busy = true;
        applyButton.disabled = true;
        applyButton.textContent = "Menyimpan…";
        setAdjustStatus("Menyimpan perubahan masa aktif…");

        try {
            const result = await api("studio-admin-extend", {
                method: "POST",
                body: { user_id: userId, days: signedDays }
            });

            applyAccessResult(userId, result.access);
            closeAdjustModal();
            setStatusMessage(
                `${adjustState.mode === "reduce" ? "Masa aktif dikurangi" : "Masa aktif ditambah"} ${days} hari untuk ${user?.email || "user"}. Berakhir ${formatDateTime(result.access.expires_at)}.`,
                "success"
            );
        } catch (error) {
            console.error(error);
            setAdjustStatus(error.message || "Gagal memperbarui masa aktif.", "error");
        } finally {
            adjustState.busy = false;
            if (applyButton) {
                applyButton.disabled = false;
                applyButton.textContent = "Simpan";
            }
        }
    }

    async function stopSubscription(userId) {
        const user = findUser(userId);
        if (!user) return;

        const label = user.email || user.name || user.id;
        if (!window.confirm(`Hentikan langganan Studio Medsos untuk ${label}?\n\nAkses user akan langsung ditutup.`)) {
            return;
        }

        try {
            const result = await api("studio-admin-stop", {
                method: "POST",
                body: { user_id: userId }
            });
            applyAccessResult(userId, result.access);
            setStatusMessage(`Langganan ${label} dihentikan.`, "success");
        } catch (error) {
            console.error(error);
            setStatusMessage(error.message || "Gagal menghentikan langganan.", "error");
        }
    }

    function editSubscription(userId) {
        const user = findUser(userId);
        if (!user) return;

        const select = document.getElementById("user-select");
        select.value = userId;
        loadUserAccess(userId);

        const formSection = document.querySelector(".panel-grid");
        formSection?.scrollIntoView({ behavior: "smooth", block: "start" });

        window.setTimeout(() => {
            document.getElementById("duration-days")?.focus();
        }, 320);

        setStatusMessage(
            "Mode edit: ubah masa aktif atau waktu mulai di formulir atas, lalu tekan Simpan Setting.",
            "success"
        );
    }

    function handleSubscriptionClick(event) {
        const button = event.target.closest("[data-sub-action]");
        if (!button) return;

        const userId = button.dataset.userId;
        const action = button.dataset.subAction;

        if (action === "edit") return editSubscription(userId);
        if (action === "extend") return openAdjustModal(userId, "extend");
        if (action === "reduce") return openAdjustModal(userId, "reduce");
        if (action === "stop") return stopSubscription(userId);
    }

    async function loadUserAccess(userId) {
        const user = users.find(item => item.id === userId);
        const info = document.getElementById("selected-user-info");
        if (!userId || !user) {
            info.textContent = "Pilih user untuk melihat dan mengatur langganannya.";
            setFormEnabled(false);
            renderPreview(null);
            return;
        }

        info.textContent = `${user.email || user.name || user.id} · ${user.role || "user"} · ${user.status || "status tidak diketahui"}`;
        setFormEnabled(true);
        const access = user.studio_access;
        document.getElementById("access-status").checked = Boolean(access?.is_active);
        document.getElementById("duration-days").value = clampDays(access?.duration_days ?? 30);
        document.getElementById("duration-label").textContent = `${clampDays(access?.duration_days ?? 30)} hari`;
        document.getElementById("started-at").value = toDateTimeLocal(access?.started_at || Date.now());
        const postLimitInput = document.getElementById("post-limit-input");
        if (postLimitInput) {
            postLimitInput.value = user.post_limit === null || user.post_limit === undefined
                ? ""
                : String(user.post_limit);
        }
        renderPreview(access);
    }

    async function savePostLimit() {
        const userId = document.getElementById("user-select").value;
        if (!userId) {
            setStatusMessage("Pilih user terlebih dahulu.", "error");
            return;
        }
        const input = document.getElementById("post-limit-input");
        const raw = input.value.trim();
        const button = document.getElementById("save-post-limit");
        button.disabled = true;
        button.textContent = "Menyimpan…";
        try {
            const result = await api("studio-admin-set-post-limit", {
                method: "POST",
                body: { user_id: userId, post_limit: raw === "" ? null : Number(raw) }
            });
            const user = findUser(userId);
            if (user) user.post_limit = result.profile?.post_limit ?? null;
            setStatusMessage(
                `Batas posting ${user?.email || userId} diset ke ${raw === "" ? "default role" : `${raw} jadwal`}.`,
                "success"
            );
        } catch (error) {
            console.error(error);
            setStatusMessage(error.message || "Gagal menyimpan batas posting.", "error");
        } finally {
            button.disabled = false;
            button.textContent = "Simpan batas";
        }
    }

    async function loadUsers() {
        const result = await api("studio-admin-users");
        users = result.users || [];
        populateUserSelect();
        renderActiveSubscriptions();
        document.getElementById("user-count").textContent = `${users.length} akun`;
        if (!users.length) {
            setStatusMessage("Belum ada profil user yang dapat dikelola.", "warn");
            return;
        }
        setStatusMessage("Daftar user dan status langganan berhasil dimuat.", "success");
    }

    async function loadPricing() {
        const result = await api("studio-pricing");
        for (const { key } of PRICE_PERIODS) {
            const price = result.pricing?.[`price_${key}_idr`];
            document.getElementById(`studio-price-${key}`).value =
                Number.isSafeInteger(price) && price >= 0 ? String(price) : "";
        }
        renderPricingStatus(result.pricing || {});
    }

    function providerLabel(value) {
        if (value === "cloudflare") return "Cloudflare Workers AI";
        if (value === "qwencloud") return "QwenCloud (Qwen Image)";
        return "Google Gemini";
    }

    function providerReadiness(value, settings = {}) {
        if (value === "cloudflare") {
            if (!settings.cloudflare_configured) return "Workers AI binding belum tersedia";
            const identityModel = settings.cloudflare_identity_model || "@cf/black-forest-labs/flux-2-klein-4b";
            return `Karakter konsisten dari foto referensi: ${identityModel} (gratis, kuota Neuron) · try-on ${settings.cloudflare_tryon_model || "pruna/p-image-try-on"} opsional dan butuh kredit AI Gateway`;
        }
        if (value === "qwencloud") {
            return settings.qwencloud_configured ? "QwenCloud membuat gambar dan caption" : "QWENCLOUD_API_KEY belum tersedia";
        }
        return settings.gemini_configured ? "Gemini membuat gambar dan caption" : "GEMINI_API_KEY belum tersedia";
    }

    function quotaBadge(percent, exhausted) {
        if (exhausted) return { className: "empty", text: "Tier habis" };
        if (percent === null || percent === undefined) return { className: "unknown", text: "Batas tier belum diatur" };
        if (percent <= 10) return { className: "empty", text: `Sisa ${percent}%` };
        if (percent <= 35) return { className: "low", text: `Sisa ${percent}%` };
        return { className: "ok", text: `Sisa ${percent}%` };
    }

    function quotaOptionLabel(entry) {
        const badge = quotaBadge(entry.percent_available, entry.exhausted);
        return `${entry.label} · ${badge.text}`;
    }

    function currentQuotaEntries() {
        return providerSettings?.qwencloud_models || [];
    }

    function currentLlmQuotaEntries() {
        return providerSettings?.qwencloud_llm_models || [];
    }

    function selectedQuwenModel() {
        return document.getElementById("qwencloud-image-model")?.value || "qwen-image-3.0-pro";
    }

    function selectedQwenLlmModel() {
        return document.getElementById("qwencloud-llm-model")?.value || "qwen-plus";
    }

    function renderQuotaCard(panel, limitInput, entry) {
        if (!panel) return;
        if (!entry) {
            panel.replaceChildren();
            return;
        }
        const badge = quotaBadge(entry.percent_available, entry.exhausted);
        const percent = entry.exhausted ? 0 : entry.percent_available;
        const barClass = badge.className === "empty" ? "empty" : badge.className === "low" ? "low" : "";
        panel.replaceChildren();
        const head = document.createElement("div");
        head.className = "quota-row";
        const title = document.createElement("strong");
        title.textContent = entry.label;
        const badgeEl = document.createElement("span");
        badgeEl.className = `quota-badge ${badge.className}`;
        badgeEl.textContent = badge.text;
        head.append(title, badgeEl);
        const bar = document.createElement("div");
        bar.className = `quota-bar ${barClass}`;
        const fill = document.createElement("i");
        fill.style.width = `${percent === null ? 0 : percent}%`;
        bar.append(fill);
        const detail = document.createElement("div");
        detail.className = "quota-row";
        const used = document.createElement("span");
        used.textContent = `Terpakai ${entry.requests_used} request${entry.quota_limit > 0 ? ` dari batas ${entry.quota_limit}` : " (batas belum diatur)"}`;
        const status = document.createElement("span");
        status.textContent = entry.exhausted
            ? `Ditolak provider: ${entry.last_status || "kuota tier habis"}`
            : entry.last_status === "ok" ? "Pemakaian terakhir berhasil" : entry.last_status || "Belum ada pemakaian tercatat";
        detail.append(used, status);
        const note = document.createElement("div");
        note.className = "quota-row";
        const windowEl = document.createElement("span");
        windowEl.textContent = entry.window_started_at ? `Penghitung sejak ${new Date(entry.window_started_at).toLocaleString("id-ID")}` : "Penghitung belum dimulai";
        const model = document.createElement("span");
        model.textContent = entry.quota_source === "free-quota"
            ? `${entry.note ? `${entry.note} · ` : ""}Batas default dari free quota QwenCloud`
            : entry.note || "";
        note.append(windowEl, model);
        panel.append(head, bar, detail, note);
        if (limitInput && document.activeElement !== limitInput) {
            limitInput.value = entry.quota_limit > 0 ? String(entry.quota_limit) : "";
        }
    }

    function renderQwenCloudOptions() {
        const box = document.getElementById("qwencloud-options");
        const checked = document.querySelector('input[name="image-provider"]:checked')?.value;
        if (box) {
            box.hidden = checked !== "qwencloud";
            if (!box.hidden) {
                const entries = currentQuotaEntries();
                const select = document.getElementById("qwencloud-image-model");
                const previous = select.value || providerSettings?.image_model || "";
                select.replaceChildren();
                for (const entry of entries) {
                    select.add(new Option(quotaOptionLabel(entry), entry.model));
                }
                const wanted = entries.some(entry => entry.model === (previous || providerSettings?.image_model))
                    ? (previous || providerSettings?.image_model)
                    : entries[0]?.model;
                select.value = wanted || "";
                renderQuotaPanel();
            }
        }
        renderQwenCloudLlmOptions();
    }

    function renderQwenCloudLlmOptions() {
        const llmSelect = document.getElementById("qwencloud-llm-model");
        if (!llmSelect) return;
        const entries = currentLlmQuotaEntries();
        const previous = llmSelect.value || providerSettings?.quote_llm_model || "qwen-plus";
        llmSelect.replaceChildren();
        for (const entry of entries) {
            llmSelect.add(new Option(quotaOptionLabel(entry), entry.model));
        }
        const wanted = entries.some(entry => entry.model === previous)
            ? previous
            : (entries.find(entry => entry.model === providerSettings?.quote_llm_model)?.model || entries[0]?.model || "qwen-plus");
        llmSelect.value = wanted;
        renderLlmQuotaPanel();
    }

    function renderQuotaPanel() {
        const panel = document.getElementById("qwencloud-quota-panel");
        const entry = currentQuotaEntries().find(item => item.model === selectedQuwenModel());
        const limitInput = document.getElementById("qwencloud-quota-limit");
        renderQuotaCard(panel, limitInput, entry);
    }

    function renderLlmQuotaPanel() {
        const panel = document.getElementById("qwencloud-llm-quota-panel");
        const entry = currentLlmQuotaEntries().find(item => item.model === selectedQwenLlmModel());
        const limitInput = document.getElementById("qwencloud-llm-quota-limit");
        renderQuotaCard(panel, limitInput, entry);
    }

    async function saveQwenCloudQuota(reset = false) {
        const model = selectedQuwenModel();
        const limitRaw = document.getElementById("qwencloud-quota-limit").value.trim();
        const body = { model };
        if (reset) body.reset = true;
        if (!reset && limitRaw !== "") body.quota_limit = Number(limitRaw);
        const button = document.getElementById(reset ? "reset-qwencloud-quota" : "save-qwencloud-quota");
        button.disabled = true;
        try {
            const result = await api("studio-admin-model-quota", { method: "POST", body });
            providerSettings = {
                ...providerSettings,
                qwencloud_models: result.quotas || providerSettings?.qwencloud_models,
                qwencloud_llm_models: result.llm_quotas || providerSettings?.qwencloud_llm_models
            };
            renderQwenCloudOptions();
            setImageProviderStatus(reset
                ? `Penghitung pemakaian ${model} direset.`
                : `Batas tier ${model} disimpan.`, "success");
        } catch (error) {
            setImageProviderStatus(error.message || "Gagal menyimpan batas tier.", "error");
        } finally {
            button.disabled = false;
        }
    }

    async function saveQwenCloudLlmQuota(reset = false) {
        const model = selectedQwenLlmModel();
        const limitRaw = document.getElementById("qwencloud-llm-quota-limit")?.value?.trim() || "";
        const body = { model };
        if (reset) body.reset = true;
        if (!reset && limitRaw !== "") body.quota_limit = Number(limitRaw);
        const button = document.getElementById(reset ? "reset-qwencloud-llm-quota" : "save-qwencloud-llm-quota");
        if (button) button.disabled = true;
        try {
            const result = await api("studio-admin-model-quota", { method: "POST", body });
            providerSettings = {
                ...providerSettings,
                qwencloud_models: result.quotas || providerSettings?.qwencloud_models,
                qwencloud_llm_models: result.llm_quotas || providerSettings?.qwencloud_llm_models
            };
            renderQwenCloudOptions();
            setImageProviderStatus(reset
                ? `Penghitung pemakaian model LLM ${model} direset.`
                : `Batas tier model LLM ${model} disimpan.`, "success");
        } catch (error) {
            setImageProviderStatus(error.message || "Gagal menyimpan batas tier model LLM.", "error");
        } finally {
            if (button) button.disabled = false;
        }
    }

    async function loadImageProvider() {
        const result = await api("studio-admin-image-provider");
        const settings = result.settings || {};
        providerSettings = settings;
        const selected = ["cloudflare", "qwencloud"].includes(settings.image_provider) ? settings.image_provider : "gemini";
        document.querySelector(`input[name="image-provider"][value="${selected}"]`).checked = true;
        renderQwenCloudOptions();
        const llmSummary = settings.quote_llm_model ? ` · LLM Kata Mutiara: QwenCloud (${settings.quote_llm_model}, latar hitam hemat kuota gambar)` : "";
        setImageProviderStatus(`Provider aktif: ${providerLabel(selected)} · ${providerReadiness(selected, settings)}${llmSummary}.`);
    }

    async function saveImageProvider() {
        const selected = document.querySelector('input[name="image-provider"]:checked')?.value;
        if (!selected) {
            setImageProviderStatus("Pilih Google Gemini, Cloudflare Workers AI, atau QwenCloud.", "error");
            return;
        }
        const quoteLlmModel = selectedQwenLlmModel();
        const button = document.getElementById("save-image-provider");
        button.disabled = true;
        setImageProviderStatus("Menyimpan provider gambar dan model LLM Kata-kata Mutiara…");
        try {
            const result = await api("studio-admin-image-provider", {
                method: "POST",
                body: {
                    image_provider: selected,
                    quote_llm_model: quoteLlmModel,
                    ...(selected === "qwencloud" ? { image_model: selectedQuwenModel() } : {})
                }
            });
            providerSettings = { ...providerSettings, ...result.settings };
            renderQwenCloudOptions();
            const savedLlm = result.settings?.quote_llm_model || quoteLlmModel;
            setImageProviderStatus(`${providerLabel(result.settings.image_provider)} disimpan untuk Foto Karakter AI, dan LLM QwenCloud (${savedLlm}) disimpan untuk Kata-kata Mutiara berlatar hitam.`, "success");
        } catch (error) {
            console.error(error);
            setImageProviderStatus(error.message || "Gagal menyimpan provider gambar.", "error");
        } finally {
            button.disabled = false;
        }
    }

    function formatProviderTest(test) {
        const rows = (test?.checks || []).map(check => {
            const status = check.ok
                ? `OK · ${check.mime_type || "gambar"} · ${Math.round((check.bytes || 0) / 1024)} KB · ${check.elapsed_ms} ms`
                : `GAGAL · ${check.error || "kesalahan provider"}`;
            return `${check.model}: ${status}`;
        });
        const lines = [];
        if (test?.identity_ready) {
            lines.push("Karakter konsisten dari foto referensi siap (FLUX.2 klein 4B).");
        } else if (test?.identity_fallback_ready) {
            lines.push("FLUX.2 klein 4B gagal, tetapi cadangan FLUX.2 klein 9B siap (lebih mahal per gambar).");
        } else {
            lines.push("Kedua model FLUX.2 klein gagal — wajah karakter TIDAK akan konsisten, lihat error di bawah.");
        }
        if (test?.t2i_ready === false) {
            lines.push("FLUX.1 schnell gagal, jadi latar Kata-kata Mutiara tidak bisa dibuat.");
        }
        if (test?.try_on_ready === true) {
            lines.push("Try-on Pruna aktif (kredit AI Gateway tersedia).");
        } else if (test?.try_on_ready === false) {
            const cooldown = test?.try_on_cooldown_minutes;
            lines.push(cooldown
                ? `Try-on Pruna tidak aktif; dicoba lagi otomatis dalam ${cooldown} menit.`
                : "Try-on Pruna tidak aktif (wajar bila kredit AI Gateway belum diisi).");
        }
        if (test?.free_tier_ready === false) {
            lines.push("Semua model gagal — periksa kuota Neuron harian.");
        }
        return [...lines, ...rows].join(" — ");
    }

    async function testImageProvider() {
        const button = document.getElementById("test-image-provider");
        if (button) button.disabled = true;
        setImageProviderStatus("Menguji Cloudflare Workers AI (FLUX, SDXL img2img, try-on)…");
        try {
            const result = await api("studio-admin-image-provider-test", {
                method: "POST",
                body: { include_try_on: true }
            });
            const test = result.test || {};
            const allFailed = (test.checks || []).every(check => check.ok !== true);
            setImageProviderStatus(formatProviderTest(test), allFailed ? "error" : "success");
        } catch (error) {
            console.error(error);
            setImageProviderStatus(error.message || "Tes provider Cloudflare gagal.", "error");
        } finally {
            if (button) button.disabled = false;
        }
    }

    function renderPricingStatus(pricing, prefix = "Harga saat ini", type = "") {
        const values = PRICE_PERIODS.map(({ key, label }) => {
            const price = pricing[`price_${key}_idr`];
            return `${label}: ${Number.isSafeInteger(price) && price >= 0 ? formatPrice(price) : "belum ditentukan"}`;
        });
        setPricingStatus(`${prefix} — ${values.join(" · ")}`, type);
    }

    async function savePricing() {
        const pricing = {};
        for (const { key, label } of PRICE_PERIODS) {
            const rawPrice = document.getElementById(`studio-price-${key}`).value.trim();
            if (!rawPrice) {
                pricing[`price_${key}_idr`] = null;
                continue;
            }
            const priceIdr = Number(rawPrice);
            if (!Number.isSafeInteger(priceIdr) || priceIdr < 0) {
                setPricingStatus(`Harga ${label} harus berupa bilangan bulat Rupiah nol atau lebih, atau dikosongkan.`, "error");
                return;
            }
            pricing[`price_${key}_idr`] = priceIdr;
        }

        const button = document.getElementById("save-studio-price");
        button.disabled = true;
        try {
            const result = await api("studio-admin-save-price", {
                method: "POST",
                body: pricing
            });
            for (const { key } of PRICE_PERIODS) {
                const price = result.pricing[`price_${key}_idr`];
                document.getElementById(`studio-price-${key}`).value =
                    Number.isSafeInteger(price) && price >= 0 ? String(price) : "";
            }
            renderPricingStatus(result.pricing, "Harga berhasil disimpan", "success");
        } catch (error) {
            console.error(error);
            setPricingStatus(error.message || "Gagal menyimpan harga langganan.", "error");
        } finally {
            button.disabled = false;
        }
    }

    async function saveSelectedAccess(active) {
        const userId = document.getElementById("user-select").value;
        if (!userId) {
            setStatusMessage("Pilih user terlebih dahulu.", "error");
            return;
        }
        const durationDays = Number(document.getElementById("duration-days").value);
        if (!Number.isInteger(durationDays) || durationDays < MIN_DAYS || durationDays > MAX_DAYS) {
            setStatusMessage("Masa langganan harus berupa bilangan bulat 1–365 hari.", "error");
            return;
        }
        const startValue = document.getElementById("started-at").value;
        const startedAt = new Date(startValue);
        if (!startValue || !Number.isFinite(startedAt.getTime())) {
            setStatusMessage("Masukkan tanggal mulai langganan yang valid.", "error");
            return;
        }

        const saveButton = document.getElementById("save-config");
        const deactivateButton = document.getElementById("reset-config");
        saveButton.disabled = true;
        deactivateButton.disabled = true;
        try {
            const result = await api("studio-admin-save", {
                method: "POST",
                body: {
                    user_id: userId,
                    is_active: active,
                    duration_days: durationDays,
                    started_at: startedAt.toISOString()
                }
            });
            const user = users.find(item => item.id === userId);
            if (user) user.studio_access = result.access;
            document.getElementById("access-status").checked = Boolean(result.access.is_active);
            renderPreview(result.access);
            renderActiveSubscriptions();
            setStatusMessage(
                active ? "Langganan user berhasil disimpan ke Supabase." : "Langganan user berhasil dinonaktifkan.",
                "success"
            );
        } catch (error) {
            console.error(error);
            setStatusMessage(error.message || "Gagal menyimpan langganan.", "error");
        } finally {
            saveButton.disabled = false;
            deactivateButton.disabled = false;
        }
    }

    document.addEventListener("DOMContentLoaded", () => {
        const userSelect = document.getElementById("user-select");
        const durationInput = document.getElementById("duration-days");
        const saveButton = document.getElementById("save-config");
        const deactivateButton = document.getElementById("reset-config");
        const savePriceButton = document.getElementById("save-studio-price");
        const saveImageProviderButton = document.getElementById("save-image-provider");
        setFormEnabled(false);

        userSelect.addEventListener("change", () => {
            setStatusMessage("");
            loadUserAccess(userSelect.value);
        });
        durationInput.addEventListener("input", () => {
            document.getElementById("duration-label").textContent = `${clampDays(durationInput.value)} hari`;
        });
        saveButton.addEventListener("click", () => saveSelectedAccess(document.getElementById("access-status").checked));
        document.getElementById("save-post-limit").addEventListener("click", savePostLimit);
        deactivateButton.addEventListener("click", () => saveSelectedAccess(false));
        document.getElementById("active-subscribers-list").addEventListener("click", handleSubscriptionClick);
        document.getElementById("adjust-modal").addEventListener("click", event => {
            if (event.target.matches("[data-close-adjust]") || event.target.id === "adjust-modal") closeAdjustModal();
        });
        document.getElementById("adjust-days").addEventListener("input", renderAdjustPreview);
        document.getElementById("adjust-chips").addEventListener("click", event => {
            const chip = event.target.closest("[data-days]");
            if (!chip) return;
            document.getElementById("adjust-days").value = chip.dataset.days;
            renderAdjustPreview();
        });
        document.getElementById("adjust-apply").addEventListener("click", applyAdjust);
        document.addEventListener("keydown", event => {
            if (event.key === "Escape" && !document.getElementById("adjust-modal").hidden) closeAdjustModal();
        });
        savePriceButton.addEventListener("click", savePricing);
        saveImageProviderButton.addEventListener("click", saveImageProvider);
        document.getElementById("test-image-provider")?.addEventListener("click", testImageProvider);
        for (const radio of document.querySelectorAll('input[name="image-provider"]')) {
            radio.addEventListener("change", renderQwenCloudOptions);
        }
        document.getElementById("qwencloud-image-model").addEventListener("change", renderQuotaPanel);
        document.getElementById("save-qwencloud-quota").addEventListener("click", () => saveQwenCloudQuota(false));
        document.getElementById("reset-qwencloud-quota").addEventListener("click", () => saveQwenCloudQuota(true));
        document.getElementById("qwencloud-llm-model")?.addEventListener("change", renderLlmQuotaPanel);
        document.getElementById("save-qwencloud-llm-quota")?.addEventListener("click", () => saveQwenCloudLlmQuota(false));
        document.getElementById("reset-qwencloud-llm-quota")?.addEventListener("click", () => saveQwenCloudLlmQuota(true));

        loadUsers().catch(error => {
            console.error(error);
            setStatusMessage(error.message || "Gagal memuat user dari Supabase.", "error");
        });
        loadPricing().catch(error => {
            console.error(error);
            setPricingStatus(error.message || "Gagal memuat harga langganan.", "error");
        });
        loadImageProvider().catch(error => {
            console.error(error);
            setImageProviderStatus(error.message || "Gagal memuat provider gambar.", "error");
        });
        countdownTimer = window.setInterval(() => {
            const user = users.find(item => item.id === userSelect.value);
            renderPreview(user?.studio_access || null);
            updateActiveSubscriptionCountdowns();
        }, 1000);
        window.addEventListener("beforeunload", () => window.clearInterval(countdownTimer), { once: true });
    });
})();
