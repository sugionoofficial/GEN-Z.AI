import {
    extractClientNetwork,
    FREE_CREDIT_AMOUNT,
    FREE_CREDIT_BANNER_BUCKET,
    FREE_CREDIT_BANNER_PREFIX,
    mapClaimErrorResponse,
    validateBannerImageUrl,
    validateBrowserSignals
} from "../lib/free-credit/service.js";

const RATE_WINDOW_MS = 60_000;
const CLAIM_LIMIT_PER_WINDOW = 12;
const SIGNAL_LIMIT_PER_WINDOW = 25;
const MAX_BANNER_BYTES = 8 * 1024 * 1024;
const BANNER_MIME_TYPES = new Map([
    ["image/jpeg", "jpg"],
    ["image/png", "png"],
    ["image/webp", "webp"],
    ["image/avif", "avif"]
]);

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
    if (
        req?.body &&
        typeof req.body === "object" &&
        !Buffer.isBuffer(req.body) &&
        !ArrayBuffer.isView(req.body) &&
        !(req.body instanceof ArrayBuffer)
    ) {
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

function serviceHeaders(config, extra = {}) {
    return {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        "Content-Type": "application/json",
        ...extra
    };
}

async function requireAdminOrOwner(fetchImpl, req, config) {
    const auth = await verifyAuthenticatedUser(fetchImpl, req, config);
    if (!auth.ok) {
        return auth;
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
        return {
            ok: false,
            status: 403,
            error: "Akses khusus Admin/Owner."
        };
    }

    return { ok: true, user: auth.user, role };
}

function normalizeSettingsRow(row) {
    if (!row || typeof row !== "object") {
        return {
            claim_enabled: true,
            banner_image_url: null,
            updated_at: null
        };
    }
    return {
        claim_enabled: row.claim_enabled !== false,
        banner_image_url:
            typeof row.banner_image_url === "string" && row.banner_image_url.trim()
                ? row.banner_image_url.trim()
                : null,
        updated_at: row.updated_at || null
    };
}

async function loadFreeCreditSettings(fetchImpl, config) {
    try {
        const res = await supabaseJson(
            fetchImpl,
            config,
            "/rest/v1/free_credit_settings?id=eq.1&select=id,claim_enabled,banner_image_url,updated_at&limit=1",
            { method: "GET", headers: serviceHeaders(config) }
        );
        const row = Array.isArray(res.data) ? res.data[0] : null;
        return normalizeSettingsRow(row);
    } catch {
        return normalizeSettingsRow(null);
    }
}

async function saveFreeCreditSettings(fetchImpl, config, payload) {
    const res = await supabaseJson(
        fetchImpl,
        config,
        "/rest/v1/free_credit_settings?on_conflict=id",
        {
            method: "POST",
            headers: serviceHeaders(config, {
                Prefer: "resolution=merge-duplicates,return=representation"
            }),
            body: JSON.stringify({
                id: 1,
                claim_enabled: payload.claim_enabled !== false,
                banner_image_url: payload.banner_image_url || null,
                updated_at: new Date().toISOString(),
                updated_by: payload.updated_by || null
            })
        }
    );

    if (!res.response.ok) {
        return {
            ok: false,
            error: String(
                res.data?.message ||
                res.data?.error ||
                "Gagal menyimpan pengaturan klaim kredit gratis."
            )
        };
    }

    const savedRow = Array.isArray(res.data) ? res.data[0] : payload;
    return {
        ok: true,
        settings: normalizeSettingsRow(savedRow)
    };
}

async function ensureBannerBucket(fetchImpl, config) {
    const response = await fetchImpl(`${config.url}/storage/v1/bucket`, {
        method: "POST",
        headers: serviceHeaders(config),
        body: JSON.stringify({
            id: FREE_CREDIT_BANNER_BUCKET,
            name: FREE_CREDIT_BANNER_BUCKET,
            public: true,
            file_size_limit: 50 * 1024 * 1024,
            allowed_mime_types: [
                "image/jpeg",
                "image/png",
                "image/webp",
                "image/gif",
                "image/avif",
                "video/mp4",
                "video/webm",
                "video/quicktime"
            ]
        })
    });

    if (response.ok || response.status === 409) return;
    const data = await response.json().catch(() => null);
    const message = String(data?.message || data?.error || "");
    if (/already exists|duplicate/i.test(message)) return;
}

async function deleteReplacedBannerBestEffort(fetchImpl, config, oldUrl, newUrl) {
    if (!oldUrl || oldUrl === newUrl) return;
    const check = validateBannerImageUrl(oldUrl, config.url);
    if (!check.ok || !check.objectPath) return;

    try {
        await fetchImpl(
            `${config.url}/storage/v1/object/${FREE_CREDIT_BANNER_BUCKET}/${check.objectPath}`,
            {
                method: "DELETE",
                headers: {
                    apikey: config.serviceRoleKey,
                    Authorization: `Bearer ${config.serviceRoleKey}`
                }
            }
        );
    } catch {
        /* best effort cleanup */
    }
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

        /* -----------------------------------------------------
           0. UPLOAD GAMBAR BANNER 16:9 (POST ?action=upload-banner)
              Body berupa binary gambar (JPG / PNG / WebP / AVIF)
        ----------------------------------------------------- */
        if (method === "POST" && queryAction === "upload-banner") {
            const admin = await requireAdminOrOwner(fetchImpl, req, config);
            if (!admin.ok) {
                return sendJson(res, admin.status, { ok: false, error: admin.error });
            }

            const contentType = getHeader(req, "content-type")
                .split(";")[0]
                .trim()
                .toLowerCase();
            const ext = BANNER_MIME_TYPES.get(contentType);
            if (!ext) {
                return sendJson(res, 400, {
                    ok: false,
                    error: "Format gambar tidak didukung. Pilih gambar JPG, PNG, WebP, atau AVIF."
                });
            }

            const declaredLength = Number(getHeader(req, "content-length") || 0);
            if (declaredLength > MAX_BANNER_BYTES) {
                return sendJson(res, 413, {
                    ok: false,
                    error: "Ukuran gambar banner 16:9 maksimal 8 MB."
                });
            }

            if (
                !req.body ||
                !(ArrayBuffer.isView(req.body) || req.body instanceof ArrayBuffer)
            ) {
                return sendJson(res, 400, {
                    ok: false,
                    error: "File gambar tidak terbaca atau kosong."
                });
            }

            const bytes = req.body instanceof ArrayBuffer
                ? new Uint8Array(req.body)
                : new Uint8Array(req.body.buffer, req.body.byteOffset, req.body.byteLength);

            if (bytes.byteLength === 0 || bytes.byteLength > MAX_BANNER_BYTES) {
                return sendJson(res, bytes.byteLength === 0 ? 400 : 413, {
                    ok: false,
                    error: bytes.byteLength === 0
                        ? "File gambar kosong."
                        : "Ukuran gambar banner 16:9 maksimal 8 MB."
                });
            }

            await ensureBannerBucket(fetchImpl, config);

            const objectPath = `${FREE_CREDIT_BANNER_PREFIX}${crypto.randomUUID()}.${ext}`;
            const uploadRes = await fetchImpl(
                `${config.url}/storage/v1/object/${FREE_CREDIT_BANNER_BUCKET}/${objectPath}`,
                {
                    method: "POST",
                    headers: {
                        apikey: config.serviceRoleKey,
                        Authorization: `Bearer ${config.serviceRoleKey}`,
                        "Content-Type": contentType,
                        "x-upsert": "false"
                    },
                    body: bytes
                }
            );

            if (!uploadRes.ok) {
                const errPayload = await uploadRes.json().catch(() => null);
                return sendJson(res, 502, {
                    ok: false,
                    error: String(
                        errPayload?.message ||
                        errPayload?.error ||
                        "Gagal mengunggah gambar banner 16:9 ke Supabase Storage."
                    )
                });
            }

            const publicUrl = `${config.url}/storage/v1/object/public/${FREE_CREDIT_BANNER_BUCKET}/${objectPath}`;
            const currentSettings = await loadFreeCreditSettings(fetchImpl, config);

            if (String(req?.query?.save || "1") !== "0") {
                const saved = await saveFreeCreditSettings(fetchImpl, config, {
                    claim_enabled: currentSettings.claim_enabled,
                    banner_image_url: publicUrl,
                    updated_by: admin.user.id
                });
                if (!saved.ok) {
                    return sendJson(res, 502, { ok: false, error: saved.error });
                }
                await deleteReplacedBannerBestEffort(
                    fetchImpl,
                    config,
                    currentSettings.banner_image_url,
                    publicUrl
                );
                return sendJson(res, 200, {
                    ok: true,
                    banner_image_url: publicUrl,
                    settings: saved.settings
                });
            }

            return sendJson(res, 200, {
                ok: true,
                banner_image_url: publicUrl
            });
        }

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
                claim_enabled: rpc.data.claim_enabled !== false,
                banner_image_url:
                    typeof rpc.data.banner_image_url === "string" && rpc.data.banner_image_url.trim()
                        ? rpc.data.banner_image_url.trim()
                        : null,
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
            const admin = await requireAdminOrOwner(fetchImpl, req, config);
            if (!admin.ok) {
                return sendJson(res, admin.status, { ok: false, error: admin.error });
            }

            const [settings, claimsRes, attemptsRes] = await Promise.all([
                loadFreeCreditSettings(fetchImpl, config),
                supabaseJson(
                    fetchImpl,
                    config,
                    "/rest/v1/free_credit_claims?select=id,claimed_user_id,email_exact,ip_address,browser_summary,country,city,credit_amount,balance_before,balance_after,claimed_at&order=claimed_at.desc&limit=100",
                    { method: "GET", headers: serviceHeaders(config) }
                ),
                supabaseJson(
                    fetchImpl,
                    config,
                    "/rest/v1/free_credit_claim_attempts?select=id,attempted_user_id,email_exact,ip_address,browser_summary,status,rejection_reason,matched_reasons,attempted_at&order=attempted_at.desc&limit=100",
                    { method: "GET", headers: serviceHeaders(config) }
                )
            ]);

            return sendJson(res, 200, {
                ok: true,
                settings,
                claims: Array.isArray(claimsRes.data) ? claimsRes.data : [],
                attempts: Array.isArray(attemptsRes.data) ? attemptsRes.data : []
            });
        }

        if (method !== "POST") {
            res.setHeader("Allow", "GET, POST");
            return sendJson(res, 405, { ok: false, error: "Method tidak diizinkan." });
        }

        /* -----------------------------------------------------
           2B. SIMPAN PENGATURAN ON/OFF & BANNER 16:9 (ADMIN / OWNER)
               (POST action=update-settings)
        ----------------------------------------------------- */
        if (action === "update-settings") {
            const admin = await requireAdminOrOwner(fetchImpl, req, config);
            if (!admin.ok) {
                return sendJson(res, admin.status, { ok: false, error: admin.error });
            }

            const current = await loadFreeCreditSettings(fetchImpl, config);

            let nextEnabled = current.claim_enabled;
            if (body.claim_enabled !== undefined) {
                if (typeof body.claim_enabled !== "boolean") {
                    return sendJson(res, 400, {
                        ok: false,
                        error: "Nilai status On/Off klaim kredit gratis harus berupa boolean."
                    });
                }
                nextEnabled = body.claim_enabled;
            }

            let nextBannerUrl = current.banner_image_url;
            if (Object.prototype.hasOwnProperty.call(body, "banner_image_url")) {
                const validated = validateBannerImageUrl(body.banner_image_url, config.url);
                if (!validated.ok) {
                    return sendJson(res, 400, {
                        ok: false,
                        error: validated.error
                    });
                }
                nextBannerUrl = validated.url;
            }

            const saved = await saveFreeCreditSettings(fetchImpl, config, {
                claim_enabled: nextEnabled,
                banner_image_url: nextBannerUrl,
                updated_by: admin.user.id
            });

            if (!saved.ok) {
                return sendJson(res, 502, {
                    ok: false,
                    error: saved.error
                });
            }

            await deleteReplacedBannerBestEffort(
                fetchImpl,
                config,
                current.banner_image_url,
                nextBannerUrl
            );

            return sendJson(res, 200, {
                ok: true,
                settings: saved.settings
            });
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

            const currentSettings = await loadFreeCreditSettings(fetchImpl, config);
            if (!currentSettings.claim_enabled) {
                const mappedDisabled = mapClaimErrorResponse("feature_disabled", [
                    "feature_disabled"
                ]);
                return sendJson(res, mappedDisabled.status, {
                    ok: false,
                    code: "feature_disabled",
                    matched_reasons: ["feature_disabled"],
                    requires_password: false,
                    error: mappedDisabled.message
                });
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
