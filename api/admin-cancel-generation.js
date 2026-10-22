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
// ERROR TEXT
// ========================================

const describeError = (data) => {

    if (!data) {
        return "unknown error";
    }

    if (typeof data === "string") {
        return data;
    }

    return String(
        data.message ||
        data.error_description ||
        data.hint ||
        data.details ||
        JSON.stringify(data)
    );

};


const CANCELLABLE_STATUSES = [
    "processing",
    "pending",
    "queued",
    "running"
];


// ========================================
// FALLBACK — TANPA RPC
// ========================================
//
// Kadang PostgREST belum memuat fungsi admin_cancel_generation
// di schema cache (PGRST202) walau fungsinya ada di database.
// Jalur ini memakai service role langsung: PATCH generation_history
// lalu refund lewat refund_generate_credits.
//
// ========================================

const cancelViaRest = async (
    config,
    historyId,
    reason
) => {

    const filter =
        `?id=eq.${encodeURIComponent(historyId)}`;


    const found =
        await supabaseRequest(
            config.url,
            "/rest/v1/generation_history" +
                filter +
                "&select=id,user_id,status,credit_cost,credit_refunded&limit=1",
            {
                method: "GET",
                headers: serviceHeaders(config)
            }
        );


    if (!found.response.ok) {

        return {
            ok: false,
            status: 500,
            error:
                "Gagal membaca riwayat generate: " +
                describeError(found.data)
        };

    }


    const current =
        Array.isArray(found.data)
            ? found.data[0] || null
            : found.data;


    if (!current || !current.id) {

        return {
            ok: false,
            status: 404,
            error:
                "Riwayat generate tidak ditemukan."
        };

    }


    const previous =
        String(
            current.status || ""
        )
            .trim()
            .toLowerCase();


    if (CANCELLABLE_STATUSES.indexOf(previous) === -1) {

        return {
            ok: true,
            row: {
                id: current.id,
                status: current.status,
                previous_status: current.status,
                cancelled: false,
                credit_refunded:
                    current.credit_refunded === true,
                refund_amount: 0
            }
        };

    }


    const finalReason =
        reason || "Dibatalkan oleh admin";


    const patched =
        await supabaseRequest(
            config.url,
            "/rest/v1/generation_history" + filter,
            {
                method: "PATCH",
                headers: {
                    ...serviceHeaders(config),
                    "Prefer": "return=representation"
                },
                body: JSON.stringify({
                    status: "cancelled",
                    completed_at: new Date().toISOString(),
                    error_message: finalReason
                })
            }
        );


    if (!patched.response.ok) {

        return {
            ok: false,
            status: 500,
            error:
                "Gagal menandai generate sebagai batal: " +
                describeError(patched.data)
        };

    }


    let refunded = false;
    let refundAmount = 0;

    const creditCost =
        Number(current.credit_cost || 0);


    if (
        current.credit_refunded !== true &&
        creditCost > 0
    ) {

        const refund =
            await supabaseRequest(
                config.url,
                "/rest/v1/rpc/refund_generate_credits",
                {
                    method: "POST",
                    headers: serviceHeaders(config),
                    body: JSON.stringify({
                        p_user_id: current.user_id,
                        p_amount: creditCost
                    })
                }
            );


        if (refund.response.ok) {

            refunded = true;
            refundAmount = creditCost;

            await supabaseRequest(
                config.url,
                "/rest/v1/generation_history" + filter,
                {
                    method: "PATCH",
                    headers: {
                        ...serviceHeaders(config),
                        "Prefer": "return=minimal"
                    },
                    body: JSON.stringify({
                        credit_refunded: true
                    })
                }
            );

        } else {

            console.error(
                "ADMIN CANCEL REFUND ERROR:",
                refund.data
            );

        }

    }


    return {
        ok: true,
        row: {
            id: current.id,
            status: "cancelled",
            previous_status: previous,
            cancelled: true,
            credit_refunded: refunded,
            refund_amount: refundAmount
        }
    };

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

        let row = null;
        let via = "rpc";


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


        if (result.response.ok) {

            row =
                Array.isArray(result.data)
                    ? result.data[0] || null
                    : result.data;

        } else {

            /*
             * RPC bisa gagal karena PostgREST belum memuat
             * fungsinya di schema cache, jadi jangan langsung
             * menyerah: batalkan langsung lewat service role.
             */

            console.error(
                "ADMIN CANCEL RPC FAILED:",
                result.response.status,
                result.data
            );


            const fallback =
                await cancelViaRest(
                    config,
                    historyId,
                    reason
                );


            if (!fallback.ok) {

                return json(
                    res,
                    fallback.status || 500,
                    {
                        success: false,
                        error:
                            fallback.error +
                            " (RPC " +
                            result.response.status +
                            ": " +
                            describeError(result.data) +
                            ")"
                    }
                );

            }


            row = fallback.row;
            via = "rest";

        }


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
                    row.credit_refunded
                        ? "Generate dibatalkan dan credit dikembalikan."
                        : "Generate berhasil dibatalkan.",
                via,
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
