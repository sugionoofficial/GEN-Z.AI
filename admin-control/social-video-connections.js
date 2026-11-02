/* =========================================================
   GEN-Z.AI — STUDIO MEDSOS: KONEKSI YOUTUBE & TIKTOK
   ---------------------------------------------------------
   File:
     admin-control/social-video-connections.js

   Menghubungkan akun YouTube / TikTok milik user login ke
   Studio Medsos memakai OAuth resmi multi-user melalui
   `/api/social-video-autopost`. Token tidak pernah disimpan
   di browser; server menyimpan terenkripsi AES-256-GCM.
========================================================= */

(() => {
    "use strict";

    const ENDPOINT = "/api/social-video-autopost";
    const PLATFORMS = {
        youtube: {
            label: "YouTube",
            buttonId: "connect-youtube",
            statusId: "youtube-connection-status",
            listId: "youtube-accounts",
            authorizeHosts: ["accounts.google.com"]
        },
        tiktok: {
            label: "TikTok",
            buttonId: "connect-tiktok",
            statusId: "tiktok-connection-status",
            listId: "tiktok-accounts",
            authorizeHosts: ["www.tiktok.com", "tiktok.com"]
        }
    };

    const $ = id => document.getElementById(id);
    const message = $("social-connections-message");
    const refreshButton = $("refresh-social-connections");
    const state = {
        busy: false,
        accounts: [],
        platformsConfigured: { youtube: false, tiktok: false }
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
        if (!message) return;
        message.hidden = !text;
        message.textContent = text || "";
        message.className = `notice ${tone}`.trim();
    }

    function setBusy(busy) {
        state.busy = busy;
        if (refreshButton) refreshButton.disabled = busy;
        for (const platform of Object.keys(PLATFORMS)) {
            const button = $(PLATFORMS[platform].buttonId);
            if (button) {
                button.disabled = busy || !state.platformsConfigured[platform];
            }
        }
    }

    function accountLabel(account) {
        return account.account_name || account.account_handle || account.external_account_id || "Akun terhubung";
    }

    function renderAccounts(platform) {
        const cfg = PLATFORMS[platform];
        const list = $(cfg.listId);
        const status = $(cfg.statusId);
        const button = $(cfg.buttonId);
        if (!list || !status || !button) return;

        const accounts = state.accounts.filter(account => account.platform === platform);
        const configured = Boolean(state.platformsConfigured[platform]);
        button.disabled = state.busy || !configured;
        button.textContent = accounts.length > 0 ? `Hubungkan ${cfg.label} lain` : `Hubungkan ${cfg.label}`;

        if (!configured) {
            status.textContent = "Menunggu konfigurasi OAuth oleh admin.";
            status.className = "status warn";
        } else if (accounts.length > 0) {
            status.textContent = `${accounts.length} akun terhubung.`;
            status.className = "status ok";
        } else {
            status.textContent = "Belum ada akun terhubung.";
            status.className = "status";
        }

        list.replaceChildren();
        if (accounts.length === 0) {
            const empty = document.createElement("div");
            empty.className = "empty";
            empty.textContent = configured
                ? `Klik “Hubungkan ${cfg.label}” untuk menambahkan akun.`
                : "OAuth belum siap. Hubungi admin jika tombol nonaktif.";
            list.appendChild(empty);
            return;
        }

        for (const account of accounts) {
            const item = document.createElement("div");
            item.className = "item social-account-item";

            const info = document.createElement("div");
            info.className = "social-account-info";

            const name = document.createElement("strong");
            name.textContent = accountLabel(account);
            info.appendChild(name);

            const handle = document.createElement("span");
            handle.className = "help";
            handle.textContent = account.account_handle
                ? `${account.account_handle} · ${account.status || "active"}`
                : (account.status || "active");
            info.appendChild(handle);

            const disconnect = document.createElement("button");
            disconnect.type = "button";
            disconnect.className = "btn small danger";
            disconnect.textContent = "Putuskan";
            disconnect.disabled = state.busy;
            /* Halaman ini melarang dialog mengambang (window.confirm):
               di beberapa browser mobile dialognya tidak bisa disentuh.
               Konfirmasi memakai pola halaman: klik 1 mempersenjatai
               tombol jadi "Konfirmasi", klik 2 menjalankan. */
            disconnect.addEventListener("click", () => {
                if (window.GENZInlineConfirm?.request) {
                    if (!window.GENZInlineConfirm.request(disconnect, {
                        label: "Konfirmasi putus",
                        ariaLabel: `Konfirmasi putuskan akun ${accountLabel(account)}`,
                        title: `Putuskan akun "${accountLabel(account)}" dari Studio Medsos?`
                    })) return;
                    void disconnectAccount(account, { skipConfirm: true });
                    return;
                }
                /* Modul konfirmasi gagal termuat: jalankan lewat jalur
                   lama yang masih memakai window.confirm — jangan pernah
                   memutus tanpa konfirmasi apa pun. */
                void disconnectAccount(account);
            });

            item.appendChild(info);
            item.appendChild(disconnect);
            list.appendChild(item);
        }
    }

    function render() {
        for (const platform of Object.keys(PLATFORMS)) renderAccounts(platform);
    }

    async function loadConnections() {
        setBusy(true);
        try {
            const data = await api("bootstrap");
            state.accounts = Array.isArray(data.accounts) ? data.accounts : [];
            state.platformsConfigured = {
                youtube: Boolean(data.platformsConfigured?.youtube),
                tiktok: Boolean(data.platformsConfigured?.tiktok)
            };
            render();
        } catch (error) {
            showMessage(error.message || "Gagal memuat koneksi YouTube/TikTok.", "error");
        } finally {
            setBusy(false);
        }
    }

    async function connectPlatform(platform) {
        const cfg = PLATFORMS[platform];
        if (!cfg || state.busy) return;
        setBusy(true);
        showMessage(`Membuka halaman izin ${cfg.label}…`);
        try {
            const data = await api("oauth_start", {
                method: "POST",
                body: { platform }
            });
            const rawUrl = String(data.authorizeUrl || "");
            const url = new URL(rawUrl);
            if (url.protocol !== "https:" || !cfg.authorizeHosts.includes(url.hostname)) {
                throw new Error(`URL OAuth ${cfg.label} tidak valid.`);
            }
            window.location.assign(url.toString());
        } catch (error) {
            showMessage(error.message || `Gagal menghubungkan ${cfg.label}.`, "error");
            setBusy(false);
        }
    }

    async function disconnectAccount(account, { skipConfirm = false } = {}) {
        if (!account?.id || state.busy) return;
        if (!skipConfirm && !window.GENZInlineConfirm) {
            const label = accountLabel(account);
            if (!window.confirm(`Putuskan akun "${label}" dari Studio Medsos?`)) return;
        }
        setBusy(true);
        try {
            const data = await api("disconnect_account", {
                method: "POST",
                body: { accountId: account.id }
            });
            state.accounts = Array.isArray(data.accounts) ? data.accounts : [];
            render();
            showMessage(data.message || "Akun medsos berhasil diputuskan.", "success");
        } catch (error) {
            showMessage(error.message || "Gagal memutuskan akun medsos.", "error");
        } finally {
            setBusy(false);
        }
    }

    function showOAuthReturn() {
        const params = new URLSearchParams(window.location.search);
        const connected = params.get("social_connected");
        const error = params.get("social_oauth_error");
        if (connected && PLATFORMS[connected]) {
            const count = Number(params.get("social_count") || 1);
            showMessage(
                `${PLATFORMS[connected].label} berhasil dihubungkan${count > 1 ? ` (${count} akun)` : ""}.`,
                "success"
            );
        } else if (connected === "facebook") {
            showMessage("Facebook berhasil dihubungkan ke Social Video.", "success");
        } else if (error) {
            showMessage(error, "error");
        }
        if (connected || error) {
            params.delete("social_connected");
            params.delete("social_count");
            params.delete("social_oauth_error");
            const query = params.toString();
            const next = window.location.pathname + (query ? `?${query}` : "") + window.location.hash;
            window.history.replaceState({}, "", next);
            document.getElementById("social-connections")?.scrollIntoView({ block: "start" });
        }
    }

    function init() {
        if (!$("social-connections")) return;
        for (const platform of Object.keys(PLATFORMS)) {
            $(PLATFORMS[platform].buttonId)?.addEventListener("click", () => connectPlatform(platform));
        }
        refreshButton?.addEventListener("click", loadConnections);
        showOAuthReturn();
        loadConnections();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})();
