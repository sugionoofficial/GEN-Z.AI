(() => {
    "use strict";

    const endpoint = "/api/announcements";
    const form = document.getElementById("announcement-form");
    const titleInput = document.getElementById("announcement-title");
    const categoryInput = document.getElementById("announcement-category");
    const expiresInput = document.getElementById("announcement-expires");
    const messageInput = document.getElementById("announcement-message");
    const draftButton = document.getElementById("save-draft");
    const publishButton = document.getElementById("publish-button");
    const status = document.getElementById("status");
    const categoryLabels = {
        info: "Informasi umum",
        feature: "Fitur baru",
        maintenance: "Pemeliharaan",
        important: "Penting"
    };

    function getClient() {
        if (window.GENZ_SUPABASE) return window.GENZ_SUPABASE;
        if (window.supabaseClient) return window.supabaseClient;

        const config = window.GENZ_CONFIG || {};
        const key = config.SUPABASE_KEY || config.SUPABASE_ANON_KEY;
        if (!window.supabase?.createClient || !config.SUPABASE_URL || !key) {
            throw new Error("Konfigurasi Supabase tidak ditemukan.");
        }

        const client = window.supabase.createClient(config.SUPABASE_URL, key);
        window.GENZ_SUPABASE = client;
        return client;
    }

    async function request(method, body) {
        const { data, error } = await getClient().auth.getSession();
        if (error) throw error;
        const token = data?.session?.access_token;
        if (!token) throw new Error("Sesi login tidak ditemukan. Silakan login ulang.");

        const response = await fetch(`${endpoint}?admin=1`, {
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

    function setStatus(message, tone = "") {
        status.textContent = message;
        status.className = tone;
        status.setAttribute("role", tone === "error" ? "alert" : "status");
    }

    function updatePreview() {
        document.getElementById("preview-title").textContent =
            titleInput.value.trim() || "Judul informasi Anda";
        document.getElementById("preview-message").textContent =
            messageInput.value.trim() ||
            "Pratinjau isi informasi akan tampil di sini. Gunakan bahasa yang jelas dan ringkas untuk seluruh pengguna.";

        const category = categoryInput.value;
        const badge = document.getElementById("preview-category");
        badge.textContent = categoryLabels[category];
        badge.dataset.category = category;
        document.getElementById("title-count").textContent =
            `${titleInput.value.length} / 100`;
        document.getElementById("message-count").textContent =
            `${messageInput.value.length.toLocaleString("id-ID")} / 3.000`;
    }

    function setForm(announcement) {
        titleInput.value = announcement?.title || "";
        categoryInput.value = announcement?.category || "info";
        messageInput.value = announcement?.message || "";
        draftButton.textContent = announcement?.is_published
            ? "Tarik Pengumuman"
            : "Simpan Draft";

        if (announcement?.expires_at) {
            const expiresAt = new Date(announcement.expires_at);
            const localDate = new Date(
                expiresAt.getTime() - expiresAt.getTimezoneOffset() * 60000
            );
            expiresInput.value = localDate.toISOString().slice(0, 16);
        } else {
            expiresInput.value = "";
        }

        updatePreview();
    }

    async function load() {
        draftButton.disabled = true;
        publishButton.disabled = true;
        setStatus("Memuat informasi dan memeriksa akses admin...");
        try {
            const result = await request("GET");
            setForm(result.announcement);
            draftButton.disabled = false;
            publishButton.disabled = false;
            setStatus(
                result.announcement?.is_published
                    ? "Informasi sedang diterbitkan untuk semua akun."
                    : "Siap. Informasi saat ini belum diterbitkan."
            );
        } catch (error) {
            setStatus(error.message || "Informasi gagal dimuat.", "error");
        }
    }

    async function save(isPublished) {
        draftButton.disabled = true;
        publishButton.disabled = true;
        setStatus(isPublished ? "Menerbitkan informasi untuk semua akun..." : "Menyimpan draft...");

        try {
            const expiresAt = expiresInput.value
                ? new Date(expiresInput.value).toISOString()
                : null;
            const result = await request("POST", {
                action: "save_announcement",
                announcement: {
                    title: titleInput.value,
                    message: messageInput.value,
                    category: categoryInput.value,
                    expires_at: expiresAt,
                    is_published: isPublished
                }
            });
            setForm(result.announcement);
            if (isPublished && result.announcement) {
                window.dispatchEvent(
                    new CustomEvent(
                        "genz-announcement-published",
                        { detail: result.announcement }
                    )
                );
            }
            setStatus(
                isPublished
                    ? "Informasi berhasil diterbitkan dan siap tampil di halaman akun."
                    : "Draft berhasil disimpan. Informasi belum terlihat oleh pengguna."
            );
        } catch (error) {
            setStatus(error.message || "Informasi gagal disimpan.", "error");
        } finally {
            draftButton.disabled = false;
            publishButton.disabled = false;
        }
    }

    titleInput.addEventListener("input", updatePreview);
    categoryInput.addEventListener("change", updatePreview);
    messageInput.addEventListener("input", updatePreview);
    draftButton.addEventListener("click", () => save(false));
    form.addEventListener("submit", event => {
        event.preventDefault();
        save(true);
    });

    load();
})();
