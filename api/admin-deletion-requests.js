// ========================================
// GEN-Z.AI
// ADMIN — ACCOUNT DELETION REQUESTS
// File: api/admin-deletion-requests.js
// ========================================
//
// GET  /api/admin-deletion-requests?status=pending
//   -> daftar permintaan penghapusan akun + data
//
// PATCH /api/admin-deletion-requests
//   Body: { "action": "review", "id": "<uuid>",
//           "status": "completed" | "rejected",
//           "note": "opsional" }
//   -> menandai permintaan selesai / ditolak
//
// Hanya role admin / owner yang boleh mengakses.
// Penghapusan akun di Supabase Auth TIDAK dilakukan di sini:
// setelah status 'completed', admin menghapus user lewat
// tombol Delete User di halaman User Management.
//
// WAJIB environment variable:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
// ========================================

const REVIEW_STATUSES = new Set(["completed", "rejected"]);

const ALLOWED_FILTERS = new Set([
    "pending",
    "completed",
    "rejected",
    "cancelled",
    "reviewed",
    "all"
]);

const DEFAULT_LIMIT = 60;
const MAX_LIMIT = 200;


const json = (res, status, data) => res.status(status).json(data);


const getHeader = (req, name) => {
    const headers = req.headers || {};
    return headers[name] || headers[name.toLowerCase()] || "";
};


const getBearerToken = (req) => {
    const authorization = getHeader(req, "authorization");
    if (!authorization) return null;
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    return match ? match[1].trim() : null;
};


const getSupabaseConfig = () => ({
    url: String(process.env.SUPABASE_URL || "")
        .trim()
        .replace(/\/+$/, ""),
    serviceRoleKey: String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim(),
    anonKey: String(
        process.env.SUPABASE_ANON_KEY ||
        process.env.SUPABASE_KEY ||
        ""
    ).trim()
});


const supabaseRequest = async (url, path, options = {}) => {
    const response = await fetch(`${url}${path}`, options);
    const text = await response.text();

    let data = null;

    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            data = { raw: text };
        }
    }

    return { response, data };
};


const serviceHeaders = (config) => ({
    "apikey": config.serviceRoleKey,
    "Authorization": `Bearer ${config.serviceRoleKey}`,
    "Content-Type": "application/json"
});


const describeError = (data) => {
    if (!data) return "unknown error";
    if (typeof data === "string") return data;

    return String(
        data.message ||
        data.hint ||
        data.details ||
        data.error_description ||
        JSON.stringify(data)
    );
};


const getBody = (req) => {
    if (req.body && typeof req.body === "object") return req.body;

    if (typeof req.body === "string") {
        try {
            return JSON.parse(req.body);
        } catch {
            return {};
        }
    }

    return {};
};


const getQueryValue = (req, key) => {
    if (req.query && req.query[key] !== undefined) {
        const value = req.query[key];
        return Array.isArray(value) ? value[0] : value;
    }

    try {
        const url = new URL(req.url || "", "https://local");
        return url.searchParams.get(key) || "";
    } catch {
        return "";
    }
};


// ========================================
// ADMIN GUARD
// ========================================

const verifyAdmin = async (req, config) => {

    const token = getBearerToken(req);

    if (!token) {
        return {
            ok: false,
            status: 401,
            error: "Session tidak ditemukan. Silakan login ulang."
        };
    }

    const authResult = await supabaseRequest(
        config.url,
        "/auth/v1/user",
        {
            method: "GET",
            headers: {
                "apikey": config.anonKey || config.serviceRoleKey,
                "Authorization": `Bearer ${token}`
            }
        }
    );

    if (!authResult.response.ok || !authResult.data?.id) {
        return {
            ok: false,
            status: 401,
            error: "Session Supabase tidak valid. Silakan login ulang."
        };
    }

    const userId = authResult.data.id;

    const profileResult = await supabaseRequest(
        config.url,
        `/rest/v1/profiles?select=id,email,role,name&id=eq.` +
            `${encodeURIComponent(userId)}&limit=1`,
        {
            method: "GET",
            headers: serviceHeaders(config)
        }
    );

    if (!profileResult.response.ok) {
        return {
            ok: false,
            status: 500,
            error: "Gagal membaca profil admin: " + describeError(profileResult.data)
        };
    }

    const profile = Array.isArray(profileResult.data)
        ? profileResult.data[0] || null
        : profileResult.data;

    const role = String(profile?.role || "").toLowerCase();

    if (!profile || (role !== "admin" && role !== "owner")) {
        return {
            ok: false,
            status: 403,
            error: "Hanya admin atau owner yang bisa mengakses data ini."
        };
    }

    return {
        ok: true,
        admin: {
            id: userId,
            email: profile.email || authResult.data.email || "",
            role
        }
    };

};


// ========================================
// HANDLERS
// ========================================

const listRequests = async (req, config) => {

    const filter = String(getQueryValue(req, "status") || "all")
        .trim()
        .toLowerCase();

    if (!ALLOWED_FILTERS.has(filter)) {
        return { status: 400, error: "Filter status tidak dikenal." };
    }

    const limitRaw = Number(getQueryValue(req, "limit"));
    const limit = Number.isFinite(limitRaw) && limitRaw > 0
        ? Math.min(Math.floor(limitRaw), MAX_LIMIT)
        : DEFAULT_LIMIT;

    const query =
        `/rest/v1/account_deletion_requests` +
        `?select=id,user_id,email,reason,note,status,requested_at,updated_at,reviewed_at,reviewed_by` +
        (filter === "all" ? "" : `&status=eq.${encodeURIComponent(filter)}`) +
        `&order=requested_at.desc&limit=${limit}`;

    const result = await supabaseRequest(config.url, query, {
        method: "GET",
        headers: serviceHeaders(config)
    });

    if (!result.response.ok) {
        return {
            status: 500,
            error: "Gagal memuat permintaan: " + describeError(result.data)
        };
    }

    const rows = Array.isArray(result.data) ? result.data : [];

    /* Statistik ringkas untuk badge jumlah pending */
    const countResult = await supabaseRequest(
        config.url,
        `/rest/v1/account_deletion_requests?select=status`,
        {
            method: "GET",
            headers: {
                ...serviceHeaders(config),
                Prefer: "count=exact"
            }
        }
    );

    const allRows = Array.isArray(countResult.data) ? countResult.data : [];
    const stats = {
        pending: 0,
        completed: 0,
        rejected: 0,
        cancelled: 0,
        reviewed: 0,
        total: allRows.length
    };

    allRows.forEach((row) => {
        const key = String(row?.status || "").toLowerCase();
        if (stats[key] !== undefined) stats[key] += 1;
    });

    /* Data profil untuk nama + role + status akun */
    const userIds = [...new Set(rows.map((row) => row.user_id).filter(Boolean))];
    let profiles = [];

    if (userIds.length) {
        const profileResult = await supabaseRequest(
            config.url,
            `/rest/v1/profiles` +
                `?select=id,name,email,role,status,credits` +
                `&id=in.(${userIds.map((id) => `"${id}"`).join(",")})`,
            {
                method: "GET",
                headers: serviceHeaders(config)
            }
        );

        if (profileResult.response.ok && Array.isArray(profileResult.data)) {
            profiles = profileResult.data;
        }
    }

    const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));

    return {
        status: 200,
        data: {
            success: true,
            stats,
            requests: rows.map((row) => ({
                ...row,
                profile: profileMap.get(row.user_id) || null
            }))
        }
    };

};


const reviewRequest = async (config, admin, body) => {

    const id = String(body.id || "").trim();
    const status = String(body.status || "").trim().toLowerCase();
    const note = String(body.note || "")
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .trim()
        .slice(0, 500);

    if (!id) {
        return { status: 400, error: "ID permintaan wajib diisi." };
    }

    if (!REVIEW_STATUSES.has(status)) {
        return {
            status: 400,
            error: "Status hanya boleh 'completed' atau 'rejected'."
        };
    }

    const updateResult = await supabaseRequest(
        config.url,
        `/rest/v1/account_deletion_requests?id=eq.${encodeURIComponent(id)}` +
            `&status=eq.pending`,
        {
            method: "PATCH",
            headers: {
                ...serviceHeaders(config),
                Prefer: "return=representation"
            },
            body: JSON.stringify({
                status,
                note: note || null,
                reviewed_at: new Date().toISOString(),
                reviewed_by: admin.id,
                updated_at: new Date().toISOString()
            })
        }
    );

    if (!updateResult.response.ok) {
        return {
            status: 500,
            error: "Gagal memperbarui permintaan: " + describeError(updateResult.data)
        };
    }

    const rows = Array.isArray(updateResult.data) ? updateResult.data : [];

    if (!rows.length) {
        return {
            status: 404,
            error:
                "Permintaan tidak ditemukan atau sudah diproses sebelumnya."
        };
    }

    return {
        status: 200,
        data: {
            success: true,
            message:
                status === "completed"
                    ? "Permintaan ditandai selesai. Jangan lupa hapus akun user di panel ini."
                    : "Permintaan ditolak.",
            request: rows[0]
        }
    };

};


// ========================================
// MAIN HANDLER
// ========================================

export default async function handler(req, res) {

    if (req.method !== "GET" && req.method !== "PATCH" && req.method !== "POST") {
        return json(res, 405, {
            success: false,
            error: "Method tidak diizinkan."
        });
    }

    const config = getSupabaseConfig();

    if (!config.url || !config.serviceRoleKey) {
        return json(res, 500, {
            success: false,
            error: "Konfigurasi Supabase server belum lengkap."
        });
    }

    try {

        const auth = await verifyAdmin(req, config);

        if (!auth.ok) {
            return json(res, auth.status, {
                success: false,
                error: auth.error
            });
        }

        if (req.method === "GET") {
            const result = await listRequests(req, config);

            if (!result.data) {
                return json(res, result.status || 500, {
                    success: false,
                    error: result.error
                });
            }

            return json(res, result.status || 200, result.data);
        }

        const body = getBody(req);
        const action = String(body.action || "review").trim().toLowerCase();

        if (action !== "review") {
            return json(res, 400, {
                success: false,
                error: "Action tidak dikenal."
            });
        }

        const result = await reviewRequest(config, auth.admin, body);

        if (!result.data) {
            return json(res, result.status || 500, {
                success: false,
                error: result.error
            });
        }

        return json(res, result.status || 200, result.data);

    } catch (error) {

        console.error("ADMIN DELETION REQUESTS ERROR:", error);

        return json(res, 500, {
            success: false,
            error:
                "Terjadi kesalahan server: " +
                (error && error.message ? error.message : "unknown")
        });

    }
}
