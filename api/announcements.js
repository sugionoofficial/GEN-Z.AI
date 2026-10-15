const SUPABASE_URL = String(process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
const SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const CATEGORIES = new Set(["info", "feature", "maintenance", "important"]);
const MEDIA_BUCKET = "site-announcements";
const MEDIA_TYPES = new Map([
    ["image/jpeg", { kind: "image", extension: "jpg", maxSize: 10 * 1024 * 1024 }],
    ["image/png", { kind: "image", extension: "png", maxSize: 10 * 1024 * 1024 }],
    ["image/webp", { kind: "image", extension: "webp", maxSize: 10 * 1024 * 1024 }],
    ["image/gif", { kind: "image", extension: "gif", maxSize: 10 * 1024 * 1024 }],
    ["image/avif", { kind: "image", extension: "avif", maxSize: 10 * 1024 * 1024 }],
    ["video/mp4", { kind: "video", extension: "mp4", maxSize: 50 * 1024 * 1024 }],
    ["video/webm", { kind: "video", extension: "webm", maxSize: 50 * 1024 * 1024 }],
    ["video/quicktime", { kind: "video", extension: "mov", maxSize: 50 * 1024 * 1024 }]
]);

function send(res, status, body) {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.end(JSON.stringify(body));
}

function fail(message, status = 500) {
    const error = new Error(message);
    error.status = status;
    return error;
}

async function supabase(path, options = {}) {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
        throw fail("Konfigurasi Supabase server belum lengkap.");
    }

    const response = await fetch(`${SUPABASE_URL}${path}`, {
        ...options,
        headers: {
            apikey: SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });
    const text = await response.text();
    let data = null;

    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            data = text;
        }
    }

    if (!response.ok) {
        const message = String(data?.message || data?.error || "");
        if (
            response.status === 404 &&
            (data?.code === "PGRST205" || /site_announcements.*schema cache/i.test(message))
        ) {
            throw fail(
                "Tabel pengumuman belum tersedia. Jalankan supabase/site-announcements.sql melalui Supabase SQL Editor.",
                503
            );
        }
        throw fail(message || "Permintaan Supabase gagal.", response.status);
    }

    return data;
}

async function authenticate(req) {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
        throw fail("Konfigurasi Supabase server belum lengkap.");
    }

    const authorization = String(req.headers?.authorization || req.headers?.Authorization || "");
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (!match) throw fail("Silakan login untuk melihat pengumuman.", 401);

    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: {
            apikey: SERVICE_ROLE_KEY,
            Authorization: `Bearer ${match[1]}`
        }
    });
    const user = await response.json().catch(() => null);

    if (!response.ok || !user?.id) {
        throw fail("Sesi login tidak valid. Silakan login ulang.", 401);
    }

    return user;
}

async function getRole(userId) {
    const profiles = await supabase(
        `/rest/v1/profiles?select=role&id=eq.${encodeURIComponent(userId)}&limit=1`
    );
    return String(profiles?.[0]?.role || "").trim().toUpperCase();
}

async function getAnnouncement(adminView) {
    const rows = await supabase(
        "/rest/v1/site_announcements?select=id,title,message,category,is_published,expires_at,updated_at,media_url,media_type,cta_url&id=eq.1&limit=1"
    );
    const announcement = rows?.[0] || null;

    if (
        !adminView &&
        announcement &&
        (
            !announcement.is_published ||
            (announcement.expires_at && Date.parse(announcement.expires_at) <= Date.now())
        )
    ) {
        return null;
    }

    return announcement;
}

function validateHttpsUrl(value, label) {
    const raw = typeof value === "string" ? value.trim() : "";
    if (!raw) return null;

    let url;
    try {
        url = new URL(raw);
    } catch {
        throw fail(`${label} harus berupa URL yang valid.`, 400);
    }
    if (url.protocol !== "https:" || url.username || url.password) {
        throw fail(`${label} harus menggunakan tautan HTTPS yang valid.`, 400);
    }
    return url;
}

function validateAnnouncement(body) {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const category = String(body.category || "");
    const isPublished = body.is_published === true;
    const expiresAt = body.expires_at === "" || body.expires_at == null
        ? null
        : String(body.expires_at);
    const mediaUrl = typeof body.media_url === "string" ? body.media_url.trim() : "";
    const mediaType = body.media_type == null ? "" : String(body.media_type);
    const ctaUrl = validateHttpsUrl(body.cta_url, "Link tombol CHECK");

    if (title.length > 100) throw fail("Judul maksimal 100 karakter.", 400);
    if (message.length > 3000) throw fail("Isi informasi maksimal 3.000 karakter.", 400);
    if (!CATEGORIES.has(category)) throw fail("Kategori informasi tidak valid.", 400);
    if (isPublished && (!title || !message)) {
        throw fail("Judul dan isi wajib diisi sebelum informasi diterbitkan.", 400);
    }

    if (expiresAt && (!Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= Date.now())) {
        throw fail("Waktu kedaluwarsa harus berupa waktu yang valid di masa mendatang.", 400);
    }

    if (mediaUrl) {
        const url = validateHttpsUrl(mediaUrl, "URL media");
        const storageOrigin = new URL(SUPABASE_URL).origin;
        if (
            url.origin !== storageOrigin ||
            !url.pathname.startsWith(`/storage/v1/object/public/${MEDIA_BUCKET}/`) ||
            !["image", "video"].includes(mediaType)
        ) {
            throw fail("Media harus diunggah melalui pemilih file di halaman ini.", 400);
        }
    } else if (mediaType) {
        throw fail("Pilih ulang media yang akan ditampilkan.", 400);
    }

    return {
        id: 1,
        title,
        message,
        category,
        is_published: isPublished,
        expires_at: expiresAt,
        media_url: mediaUrl || null,
        media_type: mediaUrl ? mediaType : null,
        cta_url: ctaUrl?.href || null,
        updated_at: new Date().toISOString()
    };
}

async function ensureMediaBucket() {
    const response = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
        method: "POST",
        headers: {
            apikey: SERVICE_ROLE_KEY,
            Authorization: ["Bearer", SERVICE_ROLE_KEY].join(" "),
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            id: MEDIA_BUCKET,
            name: MEDIA_BUCKET,
            public: true,
            file_size_limit: 50 * 1024 * 1024,
            allowed_mime_types: [...MEDIA_TYPES.keys()]
        })
    });

    if (response.ok || response.status === 409) return;

    const data = await response.json().catch(() => null);
    const message = String(data?.message || data?.error || "");
    if (/already exists|duplicate/i.test(message)) return;
    throw fail(message || "Bucket media pengumuman gagal disiapkan.", response.status);
}

async function uploadAnnouncementMedia(req, res) {
    const contentType = String(req.headers?.["content-type"] || "")
        .split(";")[0]
        .trim()
        .toLowerCase();
    const media = MEDIA_TYPES.get(contentType);
    if (!media) {
        throw fail("Format media tidak didukung. Pilih foto JPG, PNG, WebP, GIF, AVIF atau video MP4, WebM, MOV.", 400);
    }

    const declaredLength = Number(req.headers?.["content-length"] || 0);
    if (declaredLength > media.maxSize) {
        throw fail(media.kind === "image" ? "Ukuran foto maksimal 10 MB." : "Ukuran video maksimal 50 MB.", 413);
    }

    if (
        !req.body ||
        !(ArrayBuffer.isView(req.body) || req.body instanceof ArrayBuffer)
    ) {
        throw fail("Isi file media tidak valid.", 400);
    }
    const bytes = req.body instanceof ArrayBuffer
        ? new Uint8Array(req.body)
        : new Uint8Array(req.body.buffer, req.body.byteOffset, req.body.byteLength);
    if (bytes.byteLength === 0 || bytes.byteLength > media.maxSize) {
        throw fail(bytes.byteLength === 0 ? "File media kosong." : "Ukuran media melebihi batas yang diizinkan.", bytes.byteLength === 0 ? 400 : 413);
    }

    await ensureMediaBucket();
    const objectPath = `${crypto.randomUUID()}.${media.extension}`;
    const uploadResponse = await fetch(
        `${SUPABASE_URL}/storage/v1/object/${MEDIA_BUCKET}/${objectPath}`,
        {
            method: "POST",
            headers: {
                apikey: SERVICE_ROLE_KEY,
                Authorization: ["Bearer", SERVICE_ROLE_KEY].join(" "),
                "Content-Type": contentType,
                "x-upsert": "false"
            },
            body: bytes
        }
    );
    if (!uploadResponse.ok) {
        const data = await uploadResponse.json().catch(() => null);
        throw fail(
            String(data?.message || data?.error || "File media gagal diunggah."),
            uploadResponse.status
        );
    }

    return send(res, 200, {
        success: true,
        media_url: `${SUPABASE_URL}/storage/v1/object/public/${MEDIA_BUCKET}/${objectPath}`,
        media_type: media.kind
    });
}

export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", req.headers?.origin || "*");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");

    if (req.method === "OPTIONS") {
        res.statusCode = 204;
        return res.end();
    }
    if (req.method !== "GET" && req.method !== "POST") {
        return send(res, 405, { success: false, error: "Method tidak didukung." });
    }

    try {
        const user = await authenticate(req);
        const adminView = new URL(req.url, "http://localhost").searchParams.get("admin") === "1";

        if (req.method === "GET") {
            if (adminView && !["ADMIN", "OWNER"].includes(await getRole(user.id))) {
                throw fail("Halaman ini hanya dapat diakses admin atau owner.", 403);
            }
            return send(res, 200, {
                success: true,
                announcement: await getAnnouncement(adminView),
                user_id: user.id
            });
        }

        if (!["ADMIN", "OWNER"].includes(await getRole(user.id))) {
            throw fail("Hanya admin atau owner yang dapat mengelola informasi.", 403);
        }

        if (req.query?.action === "upload-media") {
            return await uploadAnnouncementMedia(req, res);
        }

        const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
        if (!body || typeof body !== "object" || Array.isArray(body)) {
            throw fail("Data informasi tidak valid.", 400);
        }
        if (body.action !== "save_announcement") {
            throw fail("Aksi tidak dikenal.", 400);
        }

        const announcement = validateAnnouncement(body.announcement || {});
        announcement.updated_by = user.id;
        const saved = await supabase(
            "/rest/v1/site_announcements?on_conflict=id",
            {
                method: "POST",
                headers: { Prefer: "resolution=merge-duplicates,return=representation" },
                body: JSON.stringify(announcement)
            }
        );
        return send(res, 200, { success: true, announcement: saved?.[0] || null });
    } catch (error) {
        console.error("[announcements] Request failed:", error);
        return send(res, error.status || 500, {
            success: false,
            error: error.message || "Gagal memproses informasi."
        });
    }
}
