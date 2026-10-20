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

            item.append(details, countdown);
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
        for (const id of ["access-status", "duration-days", "started-at", "save-config", "reset-config"]) {
            document.getElementById(id).disabled = !enabled;
        }
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
        renderPreview(access);
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
            return settings.cloudflare_configured ? "Workers AI membuat gambar dan caption" : "Workers AI binding belum tersedia";
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

    function selectedQuwenModel() {
        return document.getElementById("qwencloud-image-model").value || "qwen-image-3.0-pro";
    }

    function renderQwenCloudOptions() {
        const box = document.getElementById("qwencloud-options");
        const checked = document.querySelector('input[name="image-provider"]:checked')?.value;
        box.hidden = checked !== "qwencloud";
        if (box.hidden) return;
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

    function renderQuotaPanel() {
        const panel = document.getElementById("qwencloud-quota-panel");
        const entry = currentQuotaEntries().find(item => item.model === selectedQuwenModel());
        const limitInput = document.getElementById("qwencloud-quota-limit");
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
        const window = document.createElement("span");
        window.textContent = entry.window_started_at ? `Penghitung sejak ${new Date(entry.window_started_at).toLocaleString("id-ID")}` : "Penghitung belum dimulai";
        const model = document.createElement("span");
        model.textContent = entry.quota_source === "free-quota"
            ? "Batas default dari free quota QwenCloud; tersimpan saat pemakaian pertama atau saat batas disimpan"
            : entry.note || "";
        note.append(window, model);
        panel.append(head, bar, detail, note);
        if (document.activeElement !== limitInput) limitInput.value = entry.quota_limit > 0 ? String(entry.quota_limit) : "";
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
            providerSettings = { ...providerSettings, qwencloud_models: result.quotas };
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

    async function loadImageProvider() {
        const result = await api("studio-admin-image-provider");
        const settings = result.settings || {};
        providerSettings = settings;
        const selected = ["cloudflare", "qwencloud"].includes(settings.image_provider) ? settings.image_provider : "gemini";
        document.querySelector(`input[name="image-provider"][value="${selected}"]`).checked = true;
        renderQwenCloudOptions();
        setImageProviderStatus(`Provider aktif: ${providerLabel(selected)} · ${providerReadiness(selected, settings)}.`);
    }

    async function saveImageProvider() {
        const selected = document.querySelector('input[name="image-provider"]:checked')?.value;
        if (!selected) {
            setImageProviderStatus("Pilih Google Gemini, Cloudflare Workers AI, atau QwenCloud.", "error");
            return;
        }
        const button = document.getElementById("save-image-provider");
        button.disabled = true;
        setImageProviderStatus("Menyimpan provider untuk posting manual dan autopost…");
        try {
            const result = await api("studio-admin-image-provider", {
                method: "POST",
                body: {
                    image_provider: selected,
                    ...(selected === "qwencloud" ? { image_model: selectedQuwenModel() } : {})
                }
            });
            providerSettings = { ...providerSettings, ...result.settings };
            renderQwenCloudOptions();
            setImageProviderStatus(`${providerLabel(result.settings.image_provider)} disimpan untuk pembuatan gambar dan caption manual maupun autopost.`, "success");
        } catch (error) {
            console.error(error);
            setImageProviderStatus(error.message || "Gagal menyimpan provider gambar.", "error");
        } finally {
            button.disabled = false;
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
        deactivateButton.addEventListener("click", () => saveSelectedAccess(false));
        savePriceButton.addEventListener("click", savePricing);
        saveImageProviderButton.addEventListener("click", saveImageProvider);
        for (const radio of document.querySelectorAll('input[name="image-provider"]')) {
            radio.addEventListener("change", renderQwenCloudOptions);
        }
        document.getElementById("qwencloud-image-model").addEventListener("change", renderQuotaPanel);
        document.getElementById("save-qwencloud-quota").addEventListener("click", () => saveQwenCloudQuota(false));
        document.getElementById("reset-qwencloud-quota").addEventListener("click", () => saveQwenCloudQuota(true));

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
