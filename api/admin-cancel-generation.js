// ========================================
// GEN-Z.AI
// ADMIN FORCE CANCEL GENERATION API
// File: api/admin-cancel-generation.js
// ========================================
//
// POST /api/admin-cancel-generation
// Body:
//   { "history_id": "<uuid>", "reason": "..." }
//
// Fungsi:
// - Membatalkan paksa generation yang masih processing
// - Menandai generation_history.status = 'cancelled'
// - Mengembalikan credit user (kalau belum direfund)
//
// Kenapa lewat API:
//   Update langsung dari browser diblokir RLS untuk baris
//   milik user lain, sehingga tombol Cancel Generate tidak
//   berefek apa pun. Endpoint ini memakai service role.
//
// WAJIB environment variable:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
// ========================================


const json = (res, status, data) => {

    return res
        .status(status)
        .json(data);

};


const getHeader = (req, name) => {

    const headers =
        req.headers || {};

    return (
        headers[name] ||
        headers[name.toLowerCase()] ||
        ""
    );

};


const getBearerToken = (req) => {

    const authorization =
        getHeader(
            req,
            "authorization"
        );

    if (!authorization) {

        return null;

    }

    const match =
        authorization.match(
            /^Bearer\s+(.+)$/i
        );

    return match
        ? match[1].trim()
        : null;

};


const getSupabaseConfig = () => {

    const url =
        process.env.SUPABASE_URL;

    const serviceRoleKey =
        process.env.SUPABASE_SERVICE_ROLE_KEY;

    const anonKey =
        process.env.SUPABASE_ANON_KEY ||
        process.env.SUPABASE_KEY;

    return {
        url,
        serviceRoleKey,
        anonKey
    };

};


const supabaseRequest = async (
    url,
    path,
    options = {}
) => {

    const response =
        await fetch(
            `${url}${path}`,
            options
        );

    const text =
        await response.text();

    let data = null;

    if (text) {

        try {

            data =
                JSON.parse(text);

        } catch {

            data = {
                raw: text
            };

        }

    }

    return {
        response,
        data
    };

};


const serviceHeaders = (config) => ({

    "apikey":
        config.serviceRoleKey,

    "Authorization":
        `Bearer ${config.serviceRoleKey}`,

    "Content-Type":
        "application/json"

});


// ========================================
// VERIFY CALLER
// ========================================

const verifyAdmin = async (
    req,
    config
) => {

    const token =
        getBearerToken(req);

    if (!token) {

        return {
            ok: false,
            status: 401,
            error:
                "Session tidak ditemukan."
        };

    }


    const authResult =
        await supabaseRequest(
            config.url,
            "/auth/v1/user",
            {
                method: "GET",
                headers: {
                    "apikey":
                        config.anonKey ||
                        config.serviceRoleKey,

                    "Authorization":
                        `Bearer ${token}`
                }
            }
        );


    if (
        !authResult.response.ok ||
        !authResult.data?.id
    ) {

        return {
            ok: false,
            status: 401,
            error:
                "Session Supabase tidak valid."
        };

    }


    const userId =
        authResult.data.id;


    const profileResult =
        await supabaseRequest(
            config.url,
            `/rest/v1/profiles?select=id,email,name,role,status&id=eq.${encodeURIComponent(userId)}&limit=1`,
            {
                method: "GET",
                headers: serviceHeaders(config)
            }
        );


    if (!profileResult.response.ok) {

        console.error(
            "PROFILE CHECK ERROR:",
            profileResult.data
        );

        return {
            ok: false,
            status: 500,
            error:
                "Gagal memeriksa profile admin."
        };

    }


    const profile =
        Array.isArray(profileResult.data)
            ? profileResult.data[0]
            : null;


    if (!profile) {

        return {
            ok: false,
            status: 403,
            error:
                "Profile admin tidak ditemukan."
        };

    }


    const role =
        String(profile.role || "")
            .trim()
            .toUpperCase();


    if (!["ADMIN", "OWNER"].includes(role)) {

        return {
            ok: false,
            status: 403,
            error:
                "Anda tidak memiliki akses admin."
        };

    }


    return {
        ok: true,
        user: profile
    };

};


// ========================================
// GET BODY
// ========================================

const getBody = (req) => {

    if (
        req.body &&
        typeof req.body === "object"
    ) {

        return req.body;

    }


    if (
        typeof req.body === "string"
    ) {

        try {

            return JSON.parse(req.body);

        } catch {

            return {};

        }

    }


    return {};

};


// ========================================
// HANDLER
// ========================================

export default async function handler(
    req,
    res
) {

    // ====================================
    // METHOD
    // ====================================

    if (req.method === "OPTIONS") {

        return json(res, 200, {
            success: true
        });

    }


    if (req.method !== "POST") {

        return json(
            res,
            405,
            {
                success: false,
                error:
                    "Method tidak diizinkan."
            }
        );

    }


    const config =
        getSupabaseConfig();


    if (
        !config.url ||
        !config.serviceRoleKey
    ) {

        return json(
            res,
            500,
            {
                success: false,
                error:
                    "Konfigurasi Supabase belum lengkap."
            }
        );

    }


    try {

        // =================================
        // AUTH
        // =================================

        const auth =
            await verifyAdmin(
                req,
                config
            );


        if (!auth.ok) {

            return json(
                res,
                auth.status,
                {
                    success: false,
                    error: auth.error
                }
            );

        }


        // =================================
        // BODY
        // =================================

        const body =
            getBody(req);


        const historyId =
            String(
                body.history_id ||
                body.historyId ||
                body.id ||
                ""
            ).trim();


        if (!historyId) {

            return json(
                res,
                400,
                {
                    success: false,
                    error:
                        "history_id wajib diisi."
                }
            );

        }


        const reason =
            String(
                body.reason || ""
            ).trim();


        // =================================
        // RPC
        // =================================

        const result =
            await supabaseRequest(
                config.url,
                "/rest/v1/rpc/admin_cancel_generation",
                {
                    method: "POST",
                    headers: serviceHeaders(config),
                    body: JSON.stringify({
                        p_history_id: historyId,
                        p_reason: reason || null
                    })
                }
            );


        if (!result.response.ok) {

            console.error(
                "ADMIN CANCEL GENERATION ERROR:",
                result.data
            );

            return json(
                res,
                500,
                {
                    success: false,
                    error:
                        "Gagal membatalkan generate. " +
                        "Pastikan migration " +
                        "supabase/admin-cancel-generation.sql " +
                        "sudah dijalankan."
                }
            );

        }


        const row =
            Array.isArray(result.data)
                ? result.data[0] || null
                : result.data;


        if (!row) {

            return json(
                res,
                404,
                {
                    success: false,
                    error:
                        "Riwayat generate tidak ditemukan."
                }
            );

        }


        if (row.cancelled !== true) {

            return json(
                res,
                409,
                {
                    success: false,
                    error:
                        "Generate sudah selesai (" +
                        (row.previous_status || row.status || "unknown") +
                        ") dan tidak bisa dibatalkan.",
                    history: row
                }
            );

        }


        console.info(
            "[admin-cancel-generation] cancelled:",
            {
                history_id: historyId,
                previous_status: row.previous_status,
                refund_amount: row.refund_amount,
                by: auth.user.email || auth.user.id
            }
        );


        return json(
            res,
            200,
            {
                success: true,
                message:
                    "Generate berhasil dibatalkan.",
                history: row
            }
        );

    } catch (error) {

        console.error(
            "ADMIN CANCEL GENERATION FATAL:",
            error
        );

        return json(
            res,
            500,
            {
                success: false,
                error:
                    error?.message ||
                    "Gagal membatalkan generate."
            }
        );

    }

}
