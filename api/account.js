// ========================================
// GEN-Z.AI
// ACCOUNT SELF-SERVICE API
// File: api/account.js
// ========================================
//
// POST /api/account
// Body:
//   { "action": "update-profile", "name": "Nama Baru" }
//   { "action": "request-deletion", "reason": "no-longer-used",
//     "note": "...", "confirm": "HAPUS" }
//   { "action": "cancel-deletion" }
//   { "action": "status" }
//
// GET /api/account   -> status permintaan penghapusan terakhir
//
// Fungsi:
// - Ganti nama tampilan (profiles.name)
// - Ajukan penghapusan akun + data
// - Batalkan permintaan yang masih pending
//
// Kenapa lewat API:
// - Update nama butuh validasi server (panjang, karakter, spam)
// - Permintaan penghapusan harus tercatat dengan email & waktu
//   server, bukan dari browser.
//
// WAJIB environment variable:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
// ========================================

const MAX_NAME_LENGTH = 80;
const MIN_NAME_LENGTH = 2;
const MAX_NOTE_LENGTH = 500;

const DELETION_REASONS = new Set([
    "no-longer-used",
    "switching-service",
    "delete-all-data",
    "too-expensive",
    "other"
]);

const CANCEL_CONFIRMATION = "HAPUS";


const json = (res, status, data) => {
    return res
        .status(status)
        .json(data);
};


const getHeader = (req, name) => {

    const headers = req.headers || {};

    return (
        headers[name] ||
        headers[name.toLowerCase()] ||
        ""
    );

};


const getBearerToken = (req) => {

    const authorization =
        getHeader(req, "authorization");

    if (!authorization) return null;

    const match = authorization.match(/^Bearer\s+(.+)$/i);

    return match ? match[1].trim() : null;

};


const getSupabaseConfig = () => {

    const url =
        String(process.env.SUPABASE_URL || "")
            .trim()
            .replace(/\/+$/, "");

    const serviceRoleKey =
        String(process.env.SUPABASE_SERVICE_ROLE_KEY || "")
            .trim();

    const anonKey =
        String(
            process.env.SUPABASE_ANON_KEY ||
            process.env.SUPABASE_KEY ||
            ""
        ).trim();

    return {
        url,
        serviceRoleKey,
        anonKey
    };

};


const supabaseRequest = async (url, path, options = {}) => {

    const response =
        await fetch(`${url}${path}`, options);

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

    if (req.body && typeof req.body === "object") {
        return req.body;
    }

    if (typeof req.body === "string") {
        try {
            return JSON.parse(req.body);
        } catch {
            return {};
        }
    }

    return {};

};


// ========================================
// AUTH
// ========================================

const verifyUser = async (req, config) => {

    const token = getBearerToken(req);

    if (!token) {
        return {
            ok: false,
            status: 401,
            error: "Session tidak ditemukan. Silakan login ulang."
        };
    }

    const authResult =
        await supabaseRequest(
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

    const profileResult =
        await supabaseRequest(
            config.url,
            `/rest/v1/profiles?select=id,email,name,role,credits,status,created_at` +
                `&id=eq.${encodeURIComponent(userId)}&limit=1`,
            {
                method: "GET",
                headers: serviceHeaders(config)
            }
        );

    if (!profileResult.response.ok) {
        return {
            ok: false,
            status: 500,
            error:
                "Gagal membaca profil: " +
                describeError(profileResult.data)
        };
    }

    const profile =
        Array.isArray(profileResult.data)
            ? profileResult.data[0] || null
            : profileResult.data;

    return {
        ok: true,
        user: {
            id: userId,
            email:
                profile?.email ||
                authResult.data.email ||
                ""
        },
        profile: profile || null
    };

};


// ========================================
// VALIDASI
// ========================================

const normalizeName = (value) => {

    return String(value == null ? "" : value)
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

};


const validateName = (name) => {

    if (name.length < MIN_NAME_LENGTH) {
        return `Nama minimal ${MIN_NAME_LENGTH} karakter.`;
    }

    if (name.length > MAX_NAME_LENGTH) {
        return `Nama maksimal ${MAX_NAME_LENGTH} karakter.`;
    }

    if (/^[<>{}\\/$`]+$/.test(name)) {
        return "Nama tidak boleh hanya berisi simbol.";
    }

    return "";

};


// ========================================
// ACTIONS
// ========================================

const updateProfile = async (config, user, body) => {

    const name = normalizeName(body.name);
    const error = validateName(name);

    if (error) {
        return { status: 400, error };
    }

    if (
        user.profile &&
        normalizeName(user.profile.name) === name
    ) {
        return {
            status: 200,
            data: {
                success: true,
                message: "Nama tidak berubah.",
                profile: user.profile
            }
        };
    }

    const updateResult =
        await supabaseRequest(
            config.url,
            `/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}`,
            {
                method: "PATCH",
                headers: {
                    ...serviceHeaders(config),
                    Prefer: "return=representation"
                },
                body: JSON.stringify({
                    name,
                    updated_at: new Date().toISOString()
                })
            }
        );

    if (!updateResult.response.ok) {
        return {
            status: 500,
            error:
                "Gagal menyimpan nama: " +
                describeError(updateResult.data)
        };
    }

    const profile =
        Array.isArray(updateResult.data)
            ? updateResult.data[0] || null
            : updateResult.data;

    return {
        status: 200,
        data: {
            success: true,
            message: "Nama berhasil diperbarui.",
            profile
        }
    };

};


const getPendingRequest = async (config, userId) => {

    const result =
        await supabaseRequest(
            config.url,
            `/rest/v1/account_deletion_requests` +
                `?select=id,user_id,email,reason,note,status,requested_at` +
                `&user_id=eq.${encodeURIComponent(userId)}` +
                `&order=requested_at.desc&limit=1`,
            {
                method: "GET",
                headers: serviceHeaders(config)
            }
        );

    if (!result.response.ok) {
        return {
            ok: false,
            error:
                "Gagal membaca permintaan: " +
                describeError(result.data)
        };
    }

    const row =
        Array.isArray(result.data)
            ? result.data[0] || null
            : result.data;

    return { ok: true, request: row || null };

};


const requestDeletion = async (config, user, body) => {

    const reason = String(body.reason || "").trim();

    if (!DELETION_REASONS.has(reason)) {
        return {
            status: 400,
            error: "Pilih alasan penghapusan terlebih dahulu."
        };
    }

    const confirmation =
        String(body.confirm || "")
            .trim()
            .toUpperCase();

    if (confirmation !== CANCEL_CONFIRMATION) {
        return {
            status: 400,
            error: `Ketik ${CANCEL_CONFIRMATION} untuk mengonfirmasi.`
        };
    }

    const note =
        String(body.note || "")
            .replace(/[\u0000-\u001f\u007f]/g, " ")
            .trim()
            .slice(0, MAX_NOTE_LENGTH);

    const existing =
        await getPendingRequest(config, user.id);

    if (!existing.ok) {
        return { status: 500, error: existing.error };
    }

    if (existing.request && existing.request.status === "pending") {
        return {
            status: 409,
            error:
                "Sudah ada permintaan penghapusan yang sedang ditinjau.",
            request: existing.request
        };
    }

    const insertResult =
        await supabaseRequest(
            config.url,
            "/rest/v1/account_deletion_requests",
            {
                method: "POST",
                headers: {
                    ...serviceHeaders(config),
                    Prefer: "return=representation"
                },
                body: JSON.stringify({
                    user_id: user.id,
                    email: user.email || null,
                    reason,
                    note: note || null,
                    status: "pending"
                })
            }
        );

    if (!insertResult.response.ok) {

        /* 23505 = masih ada permintaan pending (balapan request) */
        if (insertResult.response.status === 409) {
            const latest = await getPendingRequest(config, user.id);

            return {
                status: 409,
                error:
                    "Sudah ada permintaan penghapusan yang sedang ditinjau.",
                request: latest.ok ? latest.request : null
            };
        }

        return {
            status: 500,
            error:
                "Gagal mengirim permintaan: " +
                describeError(insertResult.data)
        };
    }

    const request =
        Array.isArray(insertResult.data)
            ? insertResult.data[0] || null
            : insertResult.data;

    return {
        status: 201,
        data: {
            success: true,
            message:
                "Permintaan penghapusan terkirim. Tim GEN-Z.AI akan meninjau maksimal 7 hari kerja.",
            request
        }
    };

};


const cancelDeletion = async (config, user) => {

    const updateResult =
        await supabaseRequest(
            config.url,
            `/rest/v1/account_deletion_requests` +
                `?user_id=eq.${encodeURIComponent(user.id)}` +
                `&status=eq.pending`,
            {
                method: "PATCH",
                headers: {
                    ...serviceHeaders(config),
                    Prefer: "return=representation"
                },
                body: JSON.stringify({
                    status: "cancelled",
                    updated_at: new Date().toISOString()
                })
            }
        );

    if (!updateResult.response.ok) {
        return {
            status: 500,
            error:
                "Gagal membatalkan permintaan: " +
                describeError(updateResult.data)
        };
    }

    const rows =
        Array.isArray(updateResult.data) ? updateResult.data : [];

    if (!rows.length) {
        return {
            status: 404,
            error: "Tidak ada permintaan penghapusan yang aktif."
        };
    }

    return {
        status: 200,
        data: {
            success: true,
            message: "Permintaan penghapusan dibatalkan.",
            request: rows[0]
        }
    };

};


const getStatus = async (config, user) => {

    const latest =
        await getPendingRequest(config, user.id);

    if (!latest.ok) {
        return { status: 500, error: latest.error };
    }

    return {
        status: 200,
        data: {
            success: true,
            request: latest.request
        }
    };

};


// ========================================
// HANDLER
// ========================================

export default async function handler(req, res) {

    if (req.method !== "POST" && req.method !== "GET") {
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

        const auth = await verifyUser(req, config);

        if (!auth.ok) {
            return json(res, auth.status, {
                success: false,
                error: auth.error
            });
        }

        const body = getBody(req);

        const action =
            req.method === "GET"
                ? "status"
                : String(body.action || "status").trim().toLowerCase();

        let result;

        if (action === "update-profile") {
            result = await updateProfile(config, auth.user, body);
        } else if (action === "request-deletion") {
            result = await requestDeletion(config, auth.user, body);
        } else if (action === "cancel-deletion") {
            result = await cancelDeletion(config, auth.user);
        } else if (action === "status") {
            result = await getStatus(config, auth.user);
        } else {
            return json(res, 400, {
                success: false,
                error: "Action tidak dikenal."
            });
        }

        if (!result.data) {
            return json(res, result.status || 500, {
                success: false,
                error: result.error || "Permintaan gagal diproses.",
                request: result.request || null
            });
        }

        return json(res, result.status || 200, result.data);

    } catch (error) {

        console.error("ACCOUNT API ERROR:", error);

        return json(res, 500, {
            success: false,
            error:
                "Terjadi kesalahan server: " +
                (error && error.message ? error.message : "unknown")
        });

    }
}
