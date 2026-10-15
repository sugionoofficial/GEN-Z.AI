(() => {
    "use strict";

    const endpoint = "/api/announcements";
    const form = document.getElementById("announcement-form");
    const titleInput = document.getElementById("announcement-title");
    const categoryInput = document.getElementById("announcement-category");
    const expiresInput = document.getElementById("announcement-expires");
    const messageInput = document.getElementById("announcement-message");
    const checkUrlInput = document.getElementById("announcement-check-url");
    const mediaInput = document.getElementById("announcement-media-file");
    const mediaStatus = document.getElementById("media-status");
    const removeMediaButton = document.getElementById("remove-media");
    const draftButton = document.getElementById("save-draft");
    const publishButton = document.getElementById("publish-button");
    const status = document.getElementById("status");
    const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
    const MAX_VIDEO_SIZE = 50 * 1024 * 1024;
    let mediaUrl = "";
    let mediaType = "";
    let mediaUploadRunning = false;
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

    async function getAccessToken() {
        const { data, error } = await getClient().auth.getSession();
        if (error) throw error;
        const token = data?.session?.access_token;
        if (!token) throw new Error("Sesi login tidak ditemukan. Silakan login ulang.");
        return token;
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
        const previewCheck = document.getElementById("preview-check");
        previewCheck.hidden = !checkUrlInput.value.trim();
        document.getElementById("title-count").textContent =
            `${titleInput.value.length} / 100`;
        document.getElementById("message-count").textContent =
            `${messageInput.value.length.toLocaleString("id-ID")} / 3.000`;
        updateMediaPreview();
    }

    function updateMediaPreview() {
        const image = document.getElementById("preview-media-image");
        const video = document.getElementById("preview-media-video");
        image.hidden = true;
        video.hidden = true;
        video.pause();
        video.removeAttribute("src");
        video.load();

        if (mediaUrl && mediaType === "image") {
            image.src = mediaUrl;
            image.hidden = false;
        } else if (mediaUrl && mediaType === "video") {
            video.src = mediaUrl;
            video.hidden = false;
        }

        mediaStatus.textContent = mediaUrl
            ? `Media siap: ${mediaType === "image" ? "foto" : "video"}.`
            : "Belum ada media.";
        removeMediaButton.hidden = !mediaUrl;
    }

    function setForm(announcement) {
        titleInput.value = announcement?.title || "";
        categoryInput.value = announcement?.category || "info";
        messageInput.value = announcement?.message || "";
        checkUrlInput.value = announcement?.cta_url || "";
        mediaUrl = announcement?.media_url || "";
        mediaType = announcement?.media_type || "";
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
        if (mediaUploadRunning) {
            setStatus("Tunggu sampai unggahan media selesai.", "error");
            return;
        }

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
                    cta_url: checkUrlInput.value.trim(),
                    media_url: mediaUrl,
                    media_type: mediaType,
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

    async function uploadMedia(file) {
        if (!file) return;
        const isImage = file.type.startsWith("image/");
        const isVideo = file.type.startsWith("video/");
        const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;
        if (!isImage && !isVideo) {
            setStatus("Pilih file foto atau video yang didukung.", "error");
            mediaInput.value = "";
            return;
        }
        if (file.size > maxSize) {
            setStatus(
                isImage ? "Ukuran foto maksimal 10 MB." : "Ukuran video maksimal 50 MB.",
                "error"
            );
            mediaInput.value = "";
            return;
        }

        mediaUploadRunning = true;
        mediaInput.disabled = true;
        draftButton.disabled = true;
        publishButton.disabled = true;
        mediaStatus.textContent = "Mengunggah media...";
        setStatus("Mengunggah foto/video ke penyimpanan aman...");

        try {
            const token = await getAccessToken();
            const response = await fetch(`${endpoint}?admin=1&action=upload-media`, {
                method: "POST",
                cache: "no-store",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": file.type
                },
                body: file
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok || result.success !== true) {
                throw new Error(result.error || `Unggah gagal (HTTP ${response.status}).`);
            }

            mediaUrl = result.media_url;
            mediaType = result.media_type;
            updateMediaPreview();
            setStatus("Media berhasil diunggah. Simpan draft atau terbitkan agar tampil untuk semua akun.", "success");
        } catch (error) {
            mediaStatus.textContent = mediaUrl
                ? "Unggahan gagal; media sebelumnya tetap dipilih."
                : "Unggahan gagal.";
            setStatus(error.message || "Media gagal diunggah.", "error");
        } finally {
            mediaUploadRunning = false;
            mediaInput.disabled = false;
            draftButton.disabled = false;
            publishButton.disabled = false;
            mediaInput.value = "";
        }
    }

    titleInput.addEventListener("input", updatePreview);
    categoryInput.addEventListener("change", updatePreview);
    messageInput.addEventListener("input", updatePreview);
    checkUrlInput.addEventListener("input", updatePreview);
    mediaInput.addEventListener("change", () => uploadMedia(mediaInput.files?.[0]));
    removeMediaButton.addEventListener("click", () => {
        mediaUrl = "";
        mediaType = "";
        updateMediaPreview();
    });
    document.getElementById("preview-check").addEventListener("click", () => {
        const url = checkUrlInput.value.trim();
        if (!url) return;
        try {
            const parsed = new URL(url);
            if (parsed.protocol === "https:") window.open(parsed.href, "_blank", "noopener,noreferrer");
        } catch (error) {
            setStatus("Masukkan link HTTPS yang valid untuk tombol CHECK.", "error");
        }
    });
    draftButton.addEventListener("click", () => save(false));
    form.addEventListener("submit", event => {
        event.preventDefault();
        save(true);
    });

    load();
})();
