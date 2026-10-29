/*
 * =========================================================
 * GEN-Z.AI
 * BLACK BOX // MONITORING API
 * ---------------------------------------------------------
 * File: api/monitoring.js
 * Endpoint: /api/monitoring
 * ---------------------------------------------------------
 * GET
 *   ?action=overview      ringkasan kesehatan + aktivitas + temuan
 *   ?action=events        log aktivitas (filter kind/severity/devtools)
 *   ?action=health        riwayat pemeriksaan
 *   ?action=findings      daftar temuan bug
 *   ?action=settings      jadwal pemeriksaan rutin
 *
 * POST
 *   ?action=ingest          dipakai beacon browser (tanpa login)
 *   ?action=scan            jalankan pemeriksaan sekarang (admin/owner)
 *   ?action=update-settings atur interval & retensi (admin/owner)
 *   ?action=update-finding  tandai temuan (admin/owner)
 *   ?action=purge           hapus log lama sesuai retensi (admin/owner)
 *
 * Semua tabel monitoring bersifat server-only (RLS tanpa policy),
 * jadi endpoint ini WAJIB memakai service role.
 * =========================================================
 */

import {
    buildFindings,
    dbRequest,
    fetchSettings,
    getMonitoringConfig,
    highestSeverity,
    isConfigured,
    normalizeEventInput,
    normalizeUserId,
    parseUserAgent,
    pruneOldEvents,
    readNetworkContext,
    REMEDIATION,
    runMonitoringScan,
    saveHealthChecks,
    upsertFindings
} from "../lib/monitoring/health.js";

const MAX_BODY_BYTES = 8 * 1024;
const INGEST_PER_MINUTE = 40;

function send(res, status, body) {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.end(JSON.stringify(body));
}

function fail(res, status, message, extra = {}) {
    return send(res, status, { success: false, error: message, ...extra });
}

function header(req, name) {
    const headers = req.headers || {};
    return String(headers[name] || headers[name.toLowerCase()] || "");
}

function bearer(req) {
    const match = header(req, "authorization").match(/^Bearer\s+(.+)$/i);
    return match ? match[1].trim() : "";
}

function short(value, max = 160) {
    const text = String(value ?? "");
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/*
 * Tabel `profiles` memakai kolom `name`, bukan `full_name`. Dulu select
 * `id,role,full_name` membuat PostgREST menolak (400) sehingga seluruh
 * endpoint monitoring menjawab 502. Sekarang bentuk select dicoba bertahap
 * supaya perbedaan skema antar-deployment tidak mematikan halaman.
 */
async function loadProfile(config, userId, fetchImpl) {
    const variants = ["id,role,name", "id,role"];
    let lastError = null;

    for (const columns of variants) {
        try {
            const rows = await dbRequest(
                config,
                `/profiles?id=eq.${encodeURIComponent(userId)}&select=${columns}`,
                { method: "GET" },
                fetchImpl
            );
            return Array.isArray(rows) ? rows[0] || null : null;
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError || new Error("Profil tidak terbaca.");
}

function isMissingTable(error) {
    const message = String(error?.message || "");
    return (
        error?.status === 404 ||
        error?.code === "PGRST205" ||
        error?.code === "42P01" ||
        /monitoring_[a-z_]+.*(schema cache|does not exist)/i.test(message)
    );
}

async function resolveAdmin(req, config, fetchImpl) {
    const token = bearer(req);
    if (!token) return { ok: false, status: 401, error: "Sesi login tidak ditemukan." };

    let userId = "";
    try {
        const response = await fetchImpl(`${config.supabaseUrl}/auth/v1/user`, {
            headers: {
                apikey: config.serviceKey,
                Authorization: `Bearer ${token}`
            }
        });
        if (!response.ok) return { ok: false, status: 401, error: "Sesi login tidak valid." };
        const user = await response.json();
        userId = user?.id || "";
    } catch {
        return { ok: false, status: 502, error: "Tidak bisa memverifikasi sesi ke Supabase Auth." };
    }

    if (!userId) return { ok: false, status: 401, error: "Sesi login tidak valid." };

    let profile = null;

    try {
        profile = await loadProfile(config, userId, fetchImpl);
    } catch (error) {
        /* Pesan asli ikut dikirim supaya kegagalan kolom/skema langsung
           terlihat di panel, bukan sekadar "Bad Gateway". */
        return {
            ok: false,
            status: 502,
            error: `Gagal membaca profil pengguna: ${short(error?.message || "unknown error")}`
        };
    }

    const role = String(profile?.role || "").trim().toLowerCase();

    if (role !== "admin" && role !== "owner") {
        return {
            ok: false,
            status: 403,
            error: `Halaman ini hanya untuk ADMIN atau OWNER. Role akun ini: ${role || "tidak diketahui"}.`,
            role
        };
    }

    return { ok: true, userId, role, name: String(profile?.name || profile?.full_name || "") };
}

/* ---------------------------------------------------------
   INGEST — dipanggil beacon browser
   --------------------------------------------------------- */

async function handleIngest(req, res, config, fetchImpl) {
    const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
    const rawSize = Number(header(req, "content-length") || 0);
    if (rawSize > MAX_BODY_BYTES) {
        return fail(res, 413, "Payload terlalu besar.");
    }

    const network = readNetworkContext(req);
    /* User agent dari header Cloudflare lebih dipercaya daripada kiriman JS. */
    const event = normalizeEventInput({
        ...body,
        user_agent: network.user_agent || body.user_agent
    });

    /* Jangan simpan request yang jelas bukan dari halaman kita. */
    if (!event.path && !event.message) {
        return fail(res, 400, "Event tidak lengkap.");
    }

    /* Batas laju sederhana per IP supaya tabel tidak bisa dibanjiri. */
    const since = new Date(Date.now() - 60 * 1000).toISOString();
    if (network.ip) {
        try {
            const recent = await dbRequest(
                config,
                `/monitoring_events?ip=eq.${encodeURIComponent(network.ip)}&occurred_at=gte.${encodeURIComponent(since)}&select=id`,
                { method: "GET" },
                fetchImpl
            );
            if (Array.isArray(recent) && recent.length >= INGEST_PER_MINUTE) {
                return send(res, 429, { success: false, error: "Terlalu banyak event. Coba lagi sebentar." });
            }
        } catch {
            /* Gagal menghitung bukan alasan menolak log. */
        }
    }

    /*
     * Kalau permintaan membawa token sesi, identitasnya diverifikasi ke
     * Supabase Auth dan dipakai sebagai sumber kebenaran. Kalau tidak,
     * user_id dari browser tetap disimpan tetapi ditandai belum terverifikasi.
     */
    let verifiedUserId = null;
    const token = bearer(req);

    if (token) {
        try {
            const verify = await fetchImpl(`${config.supabaseUrl}/auth/v1/user`, {
                headers: { apikey: config.serviceKey, Authorization: `Bearer ${token}` }
            });
            if (verify.ok) {
                const account = await verify.json();
                verifiedUserId = normalizeUserId(account?.id);
            }
        } catch {
            /* token tidak bisa diverifikasi — lanjut sebagai klaim browser */
        }
    }

    const agent = parseUserAgent(network.user_agent);
    const row = {
        ...event,
        user_id: verifiedUserId || event.user_id,
        detail: { ...event.detail, identity_verified: Boolean(verifiedUserId) },
        ip: network.ip,
        country: network.country,
        region: network.region,
        city: network.city,
        asn: network.asn,
        colo: network.colo,
        device: agent.device,
        browser: agent.browser,
        os: agent.os
    };

    await dbRequest(
        config,
        "/monitoring_events",
        {
            method: "POST",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify(row)
        },
        fetchImpl
    );

    return send(res, 202, { success: true });
}

/* ---------------------------------------------------------
   OVERVIEW
   --------------------------------------------------------- */

function latestPerTarget(rows) {
    const map = new Map();
    for (const row of rows) {
        if (!map.has(row.target)) map.set(row.target, row);
    }
    return [...map.values()];
}

async function handleOverview(req, res, config, fetchImpl) {
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

    try {
        const [settings, checks, events, findings] = await Promise.all([
            fetchSettings(config, fetchImpl),
            dbRequest(
                config,
                "/monitoring_health_checks?select=*&order=checked_at.desc&limit=70",
                { method: "GET" },
                fetchImpl
            ),
            dbRequest(
                config,
                `/monitoring_events?select=*&order=occurred_at.desc&limit=40`,
                { method: "GET" },
                fetchImpl
            ),
            dbRequest(
                config,
                "/monitoring_findings?select=*&order=last_seen_at.desc&limit=50",
                { method: "GET" },
                fetchImpl
            )
        ]);

        const health = latestPerTarget(Array.isArray(checks) ? checks : []);
        const eventRows = Array.isArray(events) ? events : [];
        const twentyFour = await dbRequest(
            config,
            `/monitoring_events?select=severity,kind,devtools_open&occurred_at=gte.${encodeURIComponent(since)}`,
            { method: "GET" },
            fetchImpl
        ).catch(() => []);

        const dayRows = Array.isArray(twentyFour) ? twentyFour : [];
        const summary = {
            events_24h: dayRows.length,
            errors_24h: dayRows.filter(row => row.severity === "error" || row.severity === "critical").length,
            devtools_24h: dayRows.filter(row => row.devtools_open).length,
            findings_open: (Array.isArray(findings) ? findings : []).filter(row => row.status === "open").length
        };

        const worst = highestSeverity(
            health.map(row => (row.status === "ok" ? "info" : row.status === "warn" ? "warn" : "critical"))
        );

        return send(res, 200, {
            success: true,
            available: true,
            summary: { ...summary, overall: worst },
            health,
            health_history: Array.isArray(checks) ? checks.slice(0, 70) : [],
            events: eventRows,
            findings: Array.isArray(findings) ? findings : [],
            settings,
            site_url: config.siteUrl,
            server_time: new Date().toISOString()
        });
    } catch (error) {
        if (isMissingTable(error)) {
            return send(res, 200, {
                success: true,
                available: false,
                message: "Tabel monitoring belum ada. Jalankan supabase/monitoring-blackbox.sql di Supabase SQL Editor.",
                site_url: config.siteUrl,
                server_time: new Date().toISOString()
            });
        }
        throw error;
    }
}

/* ---------------------------------------------------------
   LIST & FILTER
   --------------------------------------------------------- */

function buildEventFilter(query) {
    const filters = ["select=*", "order=occurred_at.desc"];

    const kind = String(query.kind || "").trim();
    if (kind) filters.push(`kind=eq.${encodeURIComponent(kind)}`);

    const severity = String(query.severity || "").trim();
    if (severity) filters.push(`severity=eq.${encodeURIComponent(severity)}`);

    if (String(query.devtools || "") === "1") filters.push("devtools_open=eq.true");

    const ip = String(query.ip || "").trim();
    if (ip) filters.push(`ip=eq.${encodeURIComponent(ip)}`);

    const minutes = Number(query.minutes || 0);
    if (Number.isFinite(minutes) && minutes > 0) {
        const since = new Date(Date.now() - minutes * 60 * 1000).toISOString();
        filters.push(`occurred_at=gte.${encodeURIComponent(since)}`);
    }

    const limit = Math.min(200, Math.max(1, Number(query.limit) || 50));
    filters.push(`limit=${limit}`);

    return `/monitoring_events?${filters.join("&")}`;
}

async function handleList(req, res, config, fetchImpl, table, query) {
    const path = table === "events"
        ? buildEventFilter(query)
        : table === "findings"
            ? `/monitoring_findings?select=*&order=last_seen_at.desc&limit=${Math.min(200, Math.max(1, Number(query.limit) || 50))}` +
              (query.status ? `&status=eq.${encodeURIComponent(String(query.status))}` : "")
            : `/monitoring_health_checks?select=*&order=checked_at.desc&limit=${Math.min(500, Math.max(1, Number(query.limit) || 100))}`;

    const rows = await dbRequest(config, path, { method: "GET" }, fetchImpl);
    return send(res, 200, { success: true, rows: Array.isArray(rows) ? rows : [] });
}

/* ---------------------------------------------------------
   DETAIL SATU LOG
   Klik satu baris di "Log Aktivitas Live" -> panel detail berisi
   identitas akun, jaringan, perangkat, jejak sesi, dan saran tindakan.
   --------------------------------------------------------- */

async function loadProfileDetail(config, userId, fetchImpl) {
    const variants = ["id,email,name,role", "id,email,role"];

    for (const columns of variants) {
        try {
            const rows = await dbRequest(
                config,
                `/profiles?id=eq.${encodeURIComponent(userId)}&select=${columns}`,
                { method: "GET" },
                fetchImpl
            );
            return Array.isArray(rows) ? rows[0] || null : null;
        } catch {
            /* coba bentuk select berikutnya */
        }
    }

    return null;
}

export function suggestedRemediation(event = {}) {
    if (event.devtools_open || event.kind === "devtools") return REMEDIATION.devtools;
    if (event.kind === "error") return REMEDIATION["client-error"];
    if (event.kind === "api_failure") return REMEDIATION["api-failure"];
    if (event.kind === "security") return REMEDIATION.security;
    return "";
}

async function handleEventDetail(req, res, config, fetchImpl, query) {
    const id = String(query.id || "").trim();

    if (!/^\d+$/.test(id)) {
        return fail(res, 400, "ID log tidak valid.");
    }

    const rows = await dbRequest(
        config,
        `/monitoring_events?id=eq.${encodeURIComponent(id)}&select=*&limit=1`,
        { method: "GET" },
        fetchImpl
    );

    const event = Array.isArray(rows) ? rows[0] : null;
    if (!event) return fail(res, 404, "Log tidak ditemukan.");

    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

    const [profile, ipEvents, sessionEvents] = await Promise.all([
        event.user_id
            ? loadProfileDetail(config, event.user_id, fetchImpl)
            : Promise.resolve(null),
        event.ip
            ? dbRequest(
                config,
                `/monitoring_events?ip=eq.${encodeURIComponent(event.ip)}&occurred_at=gte.${encodeURIComponent(since)}&select=id,occurred_at&order=occurred_at.asc&limit=200`,
                { method: "GET" },
                fetchImpl
            ).catch(() => [])
            : Promise.resolve([]),
        event.session_id
            ? dbRequest(
                config,
                `/monitoring_events?session_id=eq.${encodeURIComponent(event.session_id)}&select=id&limit=200`,
                { method: "GET" },
                fetchImpl
            ).catch(() => [])
            : Promise.resolve([])
    ]);

    const ipList = Array.isArray(ipEvents) ? ipEvents : [];
    const sessionList = Array.isArray(sessionEvents) ? sessionEvents : [];

    return send(res, 200, {
        success: true,
        event,
        profile: profile
            ? {
                email: profile.email || "",
                name: profile.name || "",
                role: String(profile.role || "").toLowerCase()
            }
            : null,
        related: {
            ip_events_24h: ipList.length,
            ip_first_seen_24h: ipList.length ? ipList[0].occurred_at : null,
            ip_last_seen_24h: ipList.length ? ipList[ipList.length - 1].occurred_at : null,
            session_events: sessionList.length
        },
        remediation: suggestedRemediation(event)
    });
}

/* ---------------------------------------------------------
   MUTASI
   --------------------------------------------------------- */

async function handleScan(res, config, fetchImpl) {
    const result = await runMonitoringScan(config, { fetchImpl });
    return send(res, 200, {
        success: true,
        health: result.checks,
        findings: result.findings,
        scanned_at: new Date().toISOString()
    });
}

export function normalizeSettingsInput(body = {}) {
    const interval = Number(body.scan_interval_minutes);
    const retention = Number(body.retention_days);

    if (!Number.isFinite(interval) || interval < 1 || interval > 1440) {
        return { error: "Interval pemeriksaan harus antara 1 dan 1440 menit." };
    }
    if (!Number.isFinite(retention) || retention < 1 || retention > 365) {
        return { error: "Masa simpan log harus antara 1 dan 365 hari." };
    }

    return {
        value: {
            scan_interval_minutes: Math.round(interval),
            retention_days: Math.round(retention),
            devtools_alerts: body.devtools_alerts !== false,
            error_alerts: body.error_alerts !== false,
            updated_at: new Date().toISOString()
        }
    };
}

async function handleUpdateSettings(req, res, config, fetchImpl) {
    const parsed = normalizeSettingsInput(req.body || {});
    if (parsed.error) return fail(res, 400, parsed.error);

    await dbRequest(
        config,
        "/monitoring_settings?id=eq.true",
        {
            method: "PATCH",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify(parsed.value)
        },
        fetchImpl
    );

    return send(res, 200, { success: true, settings: parsed.value });
}

const FINDING_STATUS = new Set(["open", "acknowledged", "resolved"]);

async function handleUpdateFinding(req, res, config, fetchImpl) {
    const body = req.body || {};
    const id = String(body.id || "").trim();
    const status = String(body.status || "").trim();

    if (!/^[0-9a-f-]{36}$/i.test(id)) return fail(res, 400, "ID temuan tidak valid.");
    if (!FINDING_STATUS.has(status)) return fail(res, 400, "Status temuan tidak dikenal.");

    await dbRequest(
        config,
        `/monitoring_findings?id=eq.${encodeURIComponent(id)}`,
        {
            method: "PATCH",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify({ status, updated_at: new Date().toISOString() })
        },
        fetchImpl
    );

    return send(res, 200, { success: true, id, status });
}

/* ---------------------------------------------------------
   ENTRY POINT
   --------------------------------------------------------- */

export default async function handler(req, res) {
    const fetchImpl = globalThis.fetch;
    const config = getMonitoringConfig(req.env || {});

    if (!isConfigured(config)) {
        return fail(res, 500, "Konfigurasi Supabase server belum lengkap.");
    }

    const query = req.query || {};
    const action = String(query.action || "overview").trim();
    const method = String(req.method || "GET").toUpperCase();

    try {
        if (method === "POST") {
            if (action === "ingest") {
                return await handleIngest(req, res, config, fetchImpl);
            }

            const admin = await resolveAdmin(req, config, fetchImpl);
            if (!admin.ok) return fail(res, admin.status, admin.error);

            if (action === "scan") return await handleScan(res, config, fetchImpl);
            if (action === "update-settings") return await handleUpdateSettings(req, res, config, fetchImpl);
            if (action === "update-finding") return await handleUpdateFinding(req, res, config, fetchImpl);
            if (action === "purge") {
                const settings = await fetchSettings(config, fetchImpl).catch(() => null);
                const cutoff = await pruneOldEvents(config, settings?.retention_days || 30, fetchImpl);
                return send(res, 200, { success: true, cutoff });
            }

            return fail(res, 404, "Aksi tidak dikenal.");
        }

        const admin = await resolveAdmin(req, config, fetchImpl);
        if (!admin.ok) return fail(res, admin.status, admin.error);

        if (action === "overview") return await handleOverview(req, res, config, fetchImpl);
        if (action === "event") return await handleEventDetail(req, res, config, fetchImpl, query);
        if (action === "events") return await handleList(req, res, config, fetchImpl, "events", query);
        if (action === "findings") return await handleList(req, res, config, fetchImpl, "findings", query);
        if (action === "health") return await handleList(req, res, config, fetchImpl, "health", query);
        if (action === "settings") {
            const settings = await fetchSettings(config, fetchImpl).catch(() => null);
            return send(res, 200, { success: true, settings });
        }

        return fail(res, 404, "Aksi tidak dikenal.");
    } catch (error) {
        if (isMissingTable(error)) {
            return send(res, 200, {
                success: true,
                available: false,
                message: "Tabel monitoring belum ada. Jalankan supabase/monitoring-blackbox.sql di Supabase SQL Editor.",
                server_time: new Date().toISOString()
            });
        }

        console.error("[Monitoring] API gagal:", error?.message || error);
        return fail(res, 500, error?.message || "Pemeriksaan monitoring gagal.");
    }
}

/* Dipakai test supaya perilakunya sama dengan cron. */
export { buildFindings, saveHealthChecks, upsertFindings };
