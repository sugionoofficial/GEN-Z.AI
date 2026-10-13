const SUPABASE_URL = String(process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
const SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const FEATURE_IDS = new Set([
    "vision",
    "vision_video",
    "upscale",
    "prompt_studio",
    "metadata_cleaner"
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
            (data?.code === "PGRST205" || /feature_credit_settings.*schema cache/i.test(message))
        ) {
            throw fail(
                "Tabel tarif belum tersedia di Supabase. Jalankan supabase/feature-credit-settings.sql melalui Supabase SQL Editor, lalu muat ulang halaman. Jika migration sudah dijalankan, tunggu beberapa saat agar schema cache diperbarui.",
                503
            );
        }
        throw fail(message || "Permintaan Supabase gagal.", response.status);
    }

    return data;
}

async function authenticate(req) {
    const authorization = String(req.headers?.authorization || req.headers?.Authorization || "");
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (!match) throw fail("Silakan login untuk menggunakan fitur ini.", 401);

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
    const rows = await supabase(
        `/rest/v1/profiles?select=role&id=eq.${encodeURIComponent(userId)}&limit=1`
    );
    return String(rows?.[0]?.role || "").trim().toUpperCase();
}

async function getSettings() {
    const rows = await supabase(
        "/rest/v1/feature_credit_settings?select=feature_id,credit_cost,updated_at&order=feature_id.asc"
    );
    return rows;
}

function validateSettings(settings) {
    if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
        throw fail("Data tarif tidak valid.", 400);
    }

    const entries = Object.entries(settings);
    if (entries.length !== FEATURE_IDS.size) {
        throw fail("Tarif untuk semua fitur harus dikirim.", 400);
    }

    for (const [featureId, cost] of entries) {
        if (
            !FEATURE_IDS.has(featureId) ||
            !Number.isInteger(cost) ||
            cost < 0 ||
            cost > 1000000
        ) {
            throw fail("Tarif harus berupa bilangan bulat antara 0 sampai 1.000.000.", 400);
        }
    }

    return entries.map(([feature_id, credit_cost]) => ({ feature_id, credit_cost }));
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

        if (req.method === "GET") {
            if (
                new URL(req.url, "http://localhost").searchParams.get("admin") === "1" &&
                !["ADMIN", "OWNER"].includes(await getRole(user.id))
            ) {
                throw fail("Halaman ini hanya dapat diakses admin atau owner.", 403);
            }
            const settings = await getSettings();
            return send(res, 200, { success: true, settings });
        }

        const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
        if (!body || typeof body !== "object" || Array.isArray(body)) {
            throw fail("Request body tidak valid.", 400);
        }

        if (body.action === "save_settings") {
            if (!["ADMIN", "OWNER"].includes(await getRole(user.id))) {
                throw fail("Hanya admin atau owner yang dapat mengubah tarif.", 403);
            }

            const rows = validateSettings(body.settings).map(row => ({
                ...row,
                updated_at: new Date().toISOString()
            }));
            const saved = await supabase(
                "/rest/v1/feature_credit_settings?on_conflict=feature_id",
                {
                    method: "POST",
                    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
                    body: JSON.stringify(rows)
                }
            );
            return send(res, 200, { success: true, settings: saved });
        }

        if (body.action === "charge") {
            const featureId = String(body.feature_id || "");
            const transactionId = String(body.transaction_id || "");
            if (!FEATURE_IDS.has(featureId) || !/^[0-9a-f-]{36}$/i.test(transactionId)) {
                throw fail("Fitur atau ID transaksi tidak valid.", 400);
            }

            const result = await supabase("/rest/v1/rpc/charge_feature_credits", {
                method: "POST",
                body: JSON.stringify({
                    p_user_id: user.id,
                    p_feature_id: featureId,
                    p_transaction_id: transactionId
                })
            });
            return send(res, 200, { success: true, ...result });
        }

        if (body.action === "settle") {
            const transactionId = String(body.transaction_id || "");
            const outcome = String(body.outcome || "");
            if (!/^[0-9a-f-]{36}$/i.test(transactionId) || !["complete", "refund"].includes(outcome)) {
                throw fail("Data penyelesaian transaksi tidak valid.", 400);
            }

            const result = await supabase("/rest/v1/rpc/settle_feature_credits", {
                method: "POST",
                body: JSON.stringify({
                    p_user_id: user.id,
                    p_transaction_id: transactionId,
                    p_outcome: outcome
                })
            });
            return send(res, 200, { success: true, ...result });
        }

        throw fail("Aksi tidak dikenal.", 400);
    } catch (error) {
        console.error("[feature-credits] Request failed:", error);
        return send(res, error.status || 500, {
            success: false,
            error: error.message || "Gagal memproses tarif kredit."
        });
    }
}
