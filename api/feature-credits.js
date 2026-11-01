const CORE_FEATURE_IDS = new Set([
    "vision",
    "vision_video",
    "upscale",
    "upscale_video",
    "prompt_studio",
    "metadata_cleaner"
]);

const OPTIONAL_FEATURE_IDS = new Set([
    "opusclip_clipping",
    "opusclip_dubbing",
    "opusclip_thumbnail",
    "opusclip_censor_edit",
    "opusclip_understanding",
    "opusclip_motion_ui",
    "opusclip_social_post"
]);

const FEATURE_IDS = new Set([
    ...CORE_FEATURE_IDS,
    ...OPTIONAL_FEATURE_IDS
]);

function getSupabaseConfig(env = {}) {
    return {
        url: String(env.SUPABASE_URL || process.env.SUPABASE_URL || "").trim().replace(/\/+$/, ""),
        serviceRoleKey: String(
            env.SUPABASE_SERVICE_ROLE_KEY ||
            process.env.SUPABASE_SERVICE_ROLE_KEY ||
            ""
        ).trim(),
        anonKey: String(
            env.SUPABASE_ANON_KEY ||
            env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
            env.SUPABASE_KEY ||
            process.env.SUPABASE_ANON_KEY ||
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
            process.env.SUPABASE_KEY ||
            ""
        ).trim()
    };
}

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

function sanitizeOptionalText(value, maxLength = 4000) {
    if (value == null) {
        return "";
    }
    const text = String(value).trim();
    if (!text) {
        return "";
    }
    return text.slice(0, maxLength);
}

async function supabase(config, path, options = {}) {
    const SERVICE_ROLE_KEY = config.serviceRoleKey;
    if (!config.url || !config.serviceRoleKey) {
        throw fail("Konfigurasi Supabase server belum lengkap.");
    }

    const response = await fetch(`${config.url}${path}`, {
        ...options,
        headers: {
            apikey: config.serviceRoleKey,
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

async function authenticate(req, config) {
    if (!config.url) {
        throw fail("SUPABASE_URL belum dikonfigurasi di server.", 500);
    }
    if (!config.anonKey && !config.serviceRoleKey) {
        throw fail(
            "SUPABASE_ANON_KEY (atau SUPABASE_KEY) belum dikonfigurasi di server.",
            500
        );
    }

    const authorization = String(req.headers?.authorization || req.headers?.Authorization || "");
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (!match) throw fail("Silakan login untuk menggunakan fitur ini.", 401);

    const response = await fetch(`${config.url}/auth/v1/user`, {
        headers: {
            apikey: config.anonKey || config.serviceRoleKey,
            Authorization: `Bearer ${match[1]}`
        }
    });
    const user = await response.json().catch(() => null);

    if (!response.ok || !user?.id) {
        if (response.status === 403) {
            throw fail(
                "Supabase menolak API key untuk validasi sesi (403). Pastikan SUPABASE_URL dan SUPABASE_ANON_KEY atau SUPABASE_KEY di server berasal dari project Supabase yang sama dengan aplikasi, lalu deploy ulang API.",
                403
            );
        }
        if (response.status === 401) {
            throw fail(
                "Sesi login tidak valid atau sudah kedaluwarsa. Silakan login ulang. Jika masalah berlanjut, pastikan SUPABASE_URL dan API key server berasal dari project Supabase yang sama dengan aplikasi.",
                401
            );
        }
        throw fail("Sesi login tidak valid. Silakan login ulang.", 401);
    }

    return user;
}

async function getRole(config, userId) {
    const rows = await supabase(
        config,
        `/rest/v1/profiles?select=role&id=eq.${encodeURIComponent(userId)}&limit=1`
    );
    return String(rows?.[0]?.role || "").trim().toUpperCase();
}

async function getSettings(config) {
    const rows = await supabase(
        config,
        "/rest/v1/feature_credit_settings?select=feature_id,credit_cost,updated_at&order=feature_id.asc"
    );
    return rows;
}

function validateSettings(settings) {
    if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
        throw fail("Data tarif tidak valid.", 400);
    }

    const entries = Object.entries(settings);
    for (const coreId of CORE_FEATURE_IDS) {
        if (!Object.prototype.hasOwnProperty.call(settings, coreId)) {
            throw fail("Tarif untuk semua fitur harus dikirim.", 400);
        }
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
        const config = getSupabaseConfig(req.env);
        const user = await authenticate(req, config);

        if (req.method === "GET") {
            if (
                new URL(req.url, "http://localhost").searchParams.get("admin") === "1" &&
                !["ADMIN", "OWNER"].includes(await getRole(config, user.id))
            ) {
                throw fail("Halaman ini hanya dapat diakses admin atau owner.", 403);
            }
            const settings = await getSettings(config);
            return send(res, 200, { success: true, settings });
        }

        const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
        if (!body || typeof body !== "object" || Array.isArray(body)) {
            throw fail("Request body tidak valid.", 400);
        }

        if (body.action === "save_settings") {
            if (!["ADMIN", "OWNER"].includes(await getRole(config, user.id))) {
                throw fail("Hanya admin atau owner yang dapat mengubah tarif.", 403);
            }

            const rows = validateSettings(body.settings).map(row => ({
                ...row,
                updated_at: new Date().toISOString()
            }));
            const saved = await supabase(
                config,
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

            const prompt = sanitizeOptionalText(body.prompt, 4000);
            const modelId = sanitizeOptionalText(body.model_id, 120);
            const modelName = sanitizeOptionalText(body.model_name, 160);
            const rpcPayload = {
                p_user_id: user.id,
                p_feature_id: featureId,
                p_transaction_id: transactionId
            };
            if (prompt) rpcPayload.p_prompt = prompt;
            if (modelId) rpcPayload.p_model_id = modelId;
            if (modelName) rpcPayload.p_model_name = modelName;

            const result = await supabase(config, "/rest/v1/rpc/charge_feature_credits", {
                method: "POST",
                body: JSON.stringify(rpcPayload)
            });
            return send(res, 200, { success: true, ...result });
        }

        if (body.action === "settle") {
            const transactionId = String(body.transaction_id || "");
            const outcome = String(body.outcome || "");
            if (!/^[0-9a-f-]{36}$/i.test(transactionId) || !["complete", "refund"].includes(outcome)) {
                throw fail("Data penyelesaian transaksi tidak valid.", 400);
            }

            const errorMessage = sanitizeOptionalText(body.error_message, 1000);
            const prompt = sanitizeOptionalText(body.prompt, 4000);
            const rpcPayload = {
                p_user_id: user.id,
                p_transaction_id: transactionId,
                p_outcome: outcome
            };
            if (errorMessage) rpcPayload.p_error_message = errorMessage;
            if (prompt) rpcPayload.p_prompt = prompt;

            const result = await supabase(config, "/rest/v1/rpc/settle_feature_credits", {
                method: "POST",
                body: JSON.stringify(rpcPayload)
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
