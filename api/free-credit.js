import {
    extractClientNetwork,
    FREE_CREDIT_AMOUNT,
    mapClaimErrorResponse,
    validateBrowserSignals
} from "../lib/free-credit/service.js";

const RATE_WINDOW_MS = 60_000;
const CLAIM_LIMIT_PER_WINDOW = 12;
const SIGNAL_LIMIT_PER_WINDOW = 25;
const ipBuckets = new Map();

function checkRateLimit(bucketKey, maxHits) {
    const now = Date.now();
    if (ipBuckets.size > 2000) {
        for (const [k, entry] of ipBuckets) {
            if (now - entry.startedAt >= RATE_WINDOW_MS) {
                ipBuckets.delete(k);
            }
        }
    }
    const existing = ipBuckets.get(bucketKey);
    if (!existing || now - existing.startedAt >= RATE_WINDOW_MS) {
        ipBuckets.set(bucketKey, { startedAt: now, count: 1 });
        return true;
    }
    if (existing.count >= maxHits) {
        return false;
    }
    existing.count += 1;
    return true;
}

export function resetFreeCreditRateLimitsForTests() {
    ipBuckets.clear();
}

function getHeader(req, name) {
    const headers = req?.headers || {};
    return String(headers[name] || headers[name.toLowerCase()] || "").trim();
}

function getBearerToken(req) {
    const auth = getHeader(req, "authorization");
    const match = auth.match(/^Bearer\s+(.+)$/i);
    return match ? match[1].trim() : "";
}

function getBody(req) {
    if (req?.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
        return req.body;
    }
    if (typeof req?.body === "string" && req.body.trim()) {
        try {
            return JSON.parse(req.body);
        } catch {
            return {};
        }
    }
    return {};
}

function sendJson(res, status, payload) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(status).json(payload);
}

function getSupabaseConfig(env = process.env) {
    const url = String(env?.SUPABASE_URL || "").trim().replace(/\/+$/, "");
    const serviceRoleKey = String(env?.SUPABASE_SERVICE_ROLE_KEY || "").trim();
    const anonKey = String(
        env?.SUPABASE_ANON_KEY ||
        env?.SUPABASE_KEY ||
        ""
    ).trim();

    return { url, serviceRoleKey, anonKey };
}

async function supabaseJson(fetchImpl, config, path, options = {}) {
    const response = await fetchImpl(`${config.url}${path}`, options);
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
}

async function verifyAuthenticatedUser(fetchImpl, req, config) {
    const token = getBearerToken(req);
    if (!token) {
        return {
            ok: false,
            status: 401,
            error: "Sesi login tidak ditemukan. Silakan login terlebih dahulu."
        };
    }

    const { response, data } = await supabaseJson(
        fetchImpl,
        config,
        "/auth/v1/user",
        {
            method: "GET",
            headers: {
                apikey: config.anonKey || config.serviceRoleKey,
                Authorization: `Bearer ${token}`
            }
        }
    );

    if (!response.ok || !data?.id) {
        return {
            ok: false,
            status: 401,
            error: "Sesi login sudah berakhir atau tidak valid. Silakan login ulang."
        };
    }

    return { ok: true, user: data };
}

function serviceHeaders(config) {
    return {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        "Content-Type": "application/json"
    };
}

export function createFreeCreditHandler({ fetchImpl = fetch, env } = {}) {
    return async function freeCreditHandler(req, res) {
        const config = getSupabaseConfig(env || process.env);
        if (!config.url || !config.serviceRoleKey) {
            return sendJson(res, 500, {
                ok: false,
                error: "Konfigurasi server Supabase belum lengkap."
            });
        }

        const method = String(req?.method || "GET").toUpperCase();
        const queryAction = String(req?.query?.action || "").trim().toLowerCase();
        const body = method === "POST" ? getBody(req) : {};
        const action = String(body?.action || queryAction || (method === "GET" ? "status" : "claim"))
            .trim()
            .toLowerCase();

        const net = extractClientNetwork(req);

        /* -----------------------------------------------------
           1. STATUS KLAIM (GET /api/free-credit atau action=status)
        ----------------------------------------------------- */
        if ((method === "GET" && action === "status") || (method === "POST" && action === "status")) {
            const auth = await verifyAuthenticatedUser(fetchImpl, req, config);
            if (!auth.ok) {
                return sendJson(res, auth.status, { ok: false, error: auth.error });
            }

            const rpc = await supabaseJson(
                fetchImpl,
                config,
                "/rest/v1/rpc/get_free_credit_claim_status",
                {
                    method: "POST",
                    headers: serviceHeaders(config),
                    body: JSON.stringify({
                        p_user_id: auth.user.id
                    })
                }
            );

            if (!rpc.response.ok || !rpc.data?.ok) {
                return sendJson(res, 502, {
                    ok: false,
                    error: "Gagal memuat status klaim kredit gratis."
                });
            }

            return sendJson(res, 200, {
                ok: true,
                credit_amount: FREE_CREDIT_AMOUNT,
                claimed: Boolean(rpc.data.claimed),
                claimed_at: rpc.data.claimed_at || null,
                has_password_signal: Boolean(rpc.data.has_password_signal)
            });
        }

        /* -----------------------------------------------------
           2. RINGKASAN ADMIN / OWNER (GET ?action=admin-summary)
        ----------------------------------------------------- */
        if (method === "GET" && action === "admin-summary") {
            const auth = await verifyAuthenticatedUser(fetchImpl, req, config);
            if (!auth.ok) {
                return sendJson(res, auth.status, { ok: false, error: auth.error });
            }

            const profileRes = await supabaseJson(
                fetchImpl,
                config,
                `/rest/v1/profiles?id=eq.${encodeURIComponent(auth.user.id)}&select=id,role`,
                {
                    method: "GET",
                    headers: serviceHeaders(config)
                }
            );
            const role = String(profileRes.data?.[0]?.role || "").toUpperCase();
            if (role !== "ADMIN" && role !== "OWNER") {
                return sendJson(res, 403, { ok: false, error: "Akses khusus Admin/Owner." });
            }

            const [claimsRes, attemptsRes] = await Promise.all([
                supabaseJson(
                    fetchImpl,
                    config,
                    "/rest/v1/free_credit_claims?select=id,claimed_user_id,email_exact,ip_address,browser_summary,country,city,credit_amount,balance_before,balance_after,claimed_at&order=claimed_at.desc&limit=50",
                    { method: "GET", headers: serviceHeaders(config) }
                ),
                supabaseJson(
                    fetchImpl,
                    config,
                    "/rest/v1/free_credit_claim_attempts?select=id,attempted_user_id,email_exact,ip_address,browser_summary,status,rejection_reason,matched_reasons,attempted_at&order=attempted_at.desc&limit=50",
                    { method: "GET", headers: serviceHeaders(config) }
                )
            ]);

            return sendJson(res, 200, {
                ok: true,
                claims: Array.isArray(claimsRes.data) ? claimsRes.data : [],
                attempts: Array.isArray(attemptsRes.data) ? attemptsRes.data : []
            });
        }

        if (method !== "POST") {
            res.setHeader("Allow", "GET, POST");
            return sendJson(res, 405, { ok: false, error: "Method tidak diizinkan." });
        }

        /* -----------------------------------------------------
           3. REKAM SINYAL SAAT REGISTER / LOGIN / RESET PASSWORD
        ----------------------------------------------------- */
        if (action === "record-signal") {
            const rateKey = `sig:${net.ip || "unknown"}`;
            if (!checkRateLimit(rateKey, SIGNAL_LIMIT_PER_WINDOW)) {
                return sendJson(res, 429, {
                    ok: false,
                    error: "Terlalu banyak permintaan. Coba beberapa saat lagi."
                });
            }

            let verifiedUserId = null;
            if (getBearerToken(req)) {
                const auth = await verifyAuthenticatedUser(fetchImpl, req, config);
                if (auth.ok) {
                    verifiedUserId = auth.user.id;
                }
            }

            const rawPassword = typeof body.password === "string"
                ? body.password.slice(0, 256)
                : "";
            const rawEmail = typeof body.email === "string"
                ? body.email.trim().toLowerCase().slice(0, 254)
                : "";
            const source = ["register", "login", "password_reset"].includes(String(body.source || ""))
                ? String(body.source)
                : "login";

            if (!verifiedUserId && (!rawEmail || !rawPassword)) {
                return sendJson(res, 400, {
                    ok: false,
                    error: "Data sinyal autentikasi belum lengkap."
                });
            }

            const rawBfp = String(body.browser_fingerprint || "").trim().toLowerCase();
            const rawBid = String(body.browser_install_id || "").trim();
            const validSignals = validateBrowserSignals({
                browserFingerprint: rawBfp,
                browserInstallId: rawBid,
                userAgent: net.userAgent
            });

            const rpc = await supabaseJson(
                fetchImpl,
                config,
                "/rest/v1/rpc/record_free_credit_auth_signal",
                {
                    method: "POST",
                    headers: serviceHeaders(config),
                    body: JSON.stringify({
                        p_user_id: verifiedUserId,
                        p_email: rawEmail || null,
                        p_password: rawPassword || null,
                        p_source: source,
                        p_ip_address: net.ip,
                        p_ip_subnet: net.subnet,
                        p_browser_fingerprint: validSignals.ok ? validSignals.browserFingerprint : null,
                        p_browser_install_id: validSignals.ok ? validSignals.browserInstallId : null,
                        p_user_agent: net.userAgent,
                        p_browser_summary: net.browserSummary
                    })
                }
            );

            if (!rpc.response.ok || !rpc.data?.ok) {
                return sendJson(res, 200, {
                    ok: false,
                    recorded: false
                });
            }

            return sendJson(res, 200, {
                ok: true,
                recorded: true,
                has_password_signal: Boolean(rpc.data.has_password_signal)
            });
        }

        /* -----------------------------------------------------
           4. EKSEKUSI KLAIM 5.000 CREDIT GRATIS (action=claim)
        ----------------------------------------------------- */
        if (action === "claim") {
            const rateKey = `claim:${net.ip || "unknown"}`;
            if (!checkRateLimit(rateKey, CLAIM_LIMIT_PER_WINDOW)) {
                return sendJson(res, 429, {
                    ok: false,
                    error: "Terlalu banyak percobaan klaim. Silakan tunggu 1 menit lalu coba lagi."
                });
            }

            const auth = await verifyAuthenticatedUser(fetchImpl, req, config);
            if (!auth.ok) {
                return sendJson(res, auth.status, { ok: false, error: auth.error });
            }

            if (!net.ip) {
                return sendJson(res, 400, {
                    ok: false,
                    code: "missing_ip",
                    error: "Alamat IP jaringan tidak terdeteksi. Gunakan koneksi normal lalu coba kembali."
                });
            }

            const browserCheck = validateBrowserSignals({
                browserFingerprint: body.browser_fingerprint,
                browserInstallId: body.browser_install_id,
                userAgent: net.userAgent
            });

            if (!browserCheck.ok) {
                return sendJson(res, 400, {
                    ok: false,
                    code: browserCheck.code,
                    error: browserCheck.error
                });
            }

            const rawPassword = typeof body.password === "string" && body.password.length > 0
                ? body.password.slice(0, 256)
                : null;

            const rpc = await supabaseJson(
                fetchImpl,
                config,
                "/rest/v1/rpc/claim_free_credit_5000",
                {
                    method: "POST",
                    headers: serviceHeaders(config),
                    body: JSON.stringify({
                        p_user_id: auth.user.id,
                        p_password: rawPassword,
                        p_ip_address: net.ip,
                        p_ip_subnet: net.subnet,
                        p_browser_fingerprint: browserCheck.browserFingerprint,
                        p_browser_install_id: browserCheck.browserInstallId,
                        p_user_agent: net.userAgent,
                        p_browser_summary: net.browserSummary,
                        p_country: net.country,
                        p_city: net.city
                    })
                }
            );

            if (!rpc.response.ok || !rpc.data) {
                return sendJson(res, 502, {
                    ok: false,
                    error: "Layanan klaim kredit sedang sibuk. Silakan coba sesaat lagi."
                });
            }

            if (!rpc.data.ok) {
                const mapped = mapClaimErrorResponse(
                    rpc.data.code,
                    rpc.data.matched_reasons
                );
                return sendJson(res, mapped.status, {
                    ok: false,
                    code: rpc.data.code || "claim_rejected",
                    matched_reasons: Array.isArray(rpc.data.matched_reasons)
                        ? rpc.data.matched_reasons
                        : [],
                    requires_password: Boolean(mapped.requiresPassword),
                    error: mapped.message
                });
            }

            return sendJson(res, 200, {
                ok: true,
                claim_id: rpc.data.claim_id,
                credit_amount: Number(rpc.data.credit_amount || FREE_CREDIT_AMOUNT),
                balance_before: Number(rpc.data.balance_before || 0),
                balance_after: Number(rpc.data.balance_after || 0),
                claimed_at: rpc.data.claimed_at || new Date().toISOString(),
                message: "Selamat! Free Credit 5.000 Gratis berhasil diklaim dan langsung masuk ke saldo Anda."
            });
        }

        return sendJson(res, 400, {
            ok: false,
            error: "Aksi tidak dikenali."
        });
    };
}

export default createFreeCreditHandler();
