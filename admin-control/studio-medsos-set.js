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
        document.getElementById("user-count").textContent = `${users.length} akun`;
        if (!users.length) {
            setStatusMessage("Belum ada profil user yang dapat dikelola.", "warn");
            return;
        }
        setStatusMessage("Daftar user dan status langganan berhasil dimuat.", "success");
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

        loadUsers().catch(error => {
            console.error(error);
            setStatusMessage(error.message || "Gagal memuat user dari Supabase.", "error");
        });
        countdownTimer = window.setInterval(() => {
            const user = users.find(item => item.id === userSelect.value);
            renderPreview(user?.studio_access || null);
        }, 1000);
        window.addEventListener("beforeunload", () => window.clearInterval(countdownTimer), { once: true });
    });
})();
