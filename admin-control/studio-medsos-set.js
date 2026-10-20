(() => {
    "use strict";

    const API_ENDPOINT = "/api/social-publisher";
    const MAX_DAYS = 365;
    const MIN_DAYS = 1;
    let users = [];
    let countdownTimer;

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
        document.getElementById("remaining-display").textContent = active
            ? `${Math.ceil(remainingMs / 86400000)} hari`
            : "0 hari";
        document.getElementById("expiry-display").textContent = `Berakhir pada: ${access?.expires_at ? formatDateTime(access.expires_at) : "--"}`;
        document.getElementById("countdown-display").textContent = active
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
        const price = result.pricing?.price_idr;
        document.getElementById("studio-price").value = Number.isSafeInteger(price) && price >= 0 ? String(price) : "";
        setPricingStatus(
            Number.isSafeInteger(price) && price >= 0
                ? `Harga saat ini: ${formatPrice(price)}`
                : "Harga belum ditentukan. Isi harga lalu simpan untuk menampilkannya kepada user."
        );
    }

    async function savePricing() {
        const input = document.getElementById("studio-price");
        const rawPrice = input.value.trim();
        const priceIdr = Number(rawPrice);
        if (!rawPrice || !Number.isSafeInteger(priceIdr) || priceIdr < 0) {
            setPricingStatus("Masukkan harga Rupiah berupa bilangan bulat nol atau lebih.", "error");
            return;
        }

        const button = document.getElementById("save-studio-price");
        button.disabled = true;
        try {
            const result = await api("studio-admin-save-price", {
                method: "POST",
                body: { price_idr: priceIdr }
            });
            input.value = String(result.pricing.price_idr);
            setPricingStatus(`Harga berhasil disimpan: ${formatPrice(result.pricing.price_idr)}`, "success");
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

        loadUsers().catch(error => {
            console.error(error);
            setStatusMessage(error.message || "Gagal memuat user dari Supabase.", "error");
        });
        loadPricing().catch(error => {
            console.error(error);
            setPricingStatus(error.message || "Gagal memuat harga langganan.", "error");
        });
        countdownTimer = window.setInterval(() => {
            const user = users.find(item => item.id === userSelect.value);
            renderPreview(user?.studio_access || null);
            updateActiveSubscriptionCountdowns();
        }, 1000);
        window.addEventListener("beforeunload", () => window.clearInterval(countdownTimer), { once: true });
    });
})();
