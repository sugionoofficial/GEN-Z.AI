import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

import handler, { normalizeSettingsInput } from "../api/monitoring.js";
import { buildFindings, normalizeEventInput, parseUserAgent, readNetworkContext } from "../lib/monitoring/health.js";
import { runMonitoringCron } from "../functions/_shared/monitoring-cron.js";

/* =========================================================
   BLACK BOX // MONITORING
   ---------------------------------------------------------
   Yang dijaga di sini:
   1. Hanya ADMIN/OWNER yang boleh membaca data monitoring.
   2. Beacon boleh menulis event tanpa login, tapi IP & lokasi
      WAJIB berasal dari server (Cloudflare), bukan browser.
   3. Temuan selalu punya "cara mengatasi".
   4. Halaman, kartu di admin panel, dan menu navigasi ada.
   ========================================================= */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relative) {
    return readFileSync(path.join(root, relative), "utf8");
}

const ENV = {
    SUPABASE_URL: "https://project.example",
    SUPABASE_SERVICE_ROLE_KEY: "server-only-test-key",
    MONITORING_SITE_URL: "https://site.example"
};

function makeRes() {
    return {
        statusCode: 0,
        headers: {},
        body: "",
        setHeader(name, value) { this.headers[String(name).toLowerCase()] = value; },
        end(chunk) {
            if (chunk !== undefined) this.body += String(chunk);
            return this;
        }
    };
}

function makeReq({ method = "GET", action = "overview", body, headers = {}, query = {}, cf = null } = {}) {
    return {
        method,
        url: `/api/monitoring?action=${action}`,
        headers: {
            authorization: "Bearer test-token",
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0 Safari/537.36",
            "cf-connecting-ip": "203.0.113.9",
            ...headers
        },
        query: { action, ...query },
        env: ENV,
        cf,
        body
    };
}

async function call(req) {
    const res = makeRes();
    await handler(req, res);
    let json = {};
    try {
        json = res.body ? JSON.parse(res.body) : {};
    } catch {
        json = {};
    }
    return { status: res.statusCode, json, res };
}

function baseSettings(overrides = {}) {
    return {
        id: true,
        scan_interval_minutes: 15,
        retention_days: 30,
        devtools_alerts: true,
        error_alerts: true,
        last_scan_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        last_scan_status: "info",
        ...overrides
    };
}

function installFetch({ role = "admin", settings = baseSettings(), events = [], findings = [], onWrite } = {}) {
    const original = globalThis.fetch;

    globalThis.fetch = async (input, options = {}) => {
        const url = String(input);
        const method = String(options.method || "GET").toUpperCase();

        if (url.includes("/auth/v1/user")) return Response.json({ id: "admin-1" });
        if (url.includes("/auth/v1/health")) return Response.json({ name: "GoTrue" });
        if (url.includes("/storage/v1/bucket")) return Response.json([]);
        if (url.endsWith("/index.html")) return new Response("ok", { status: 200 });
        if (url.includes("/api/announcements")) return Response.json({ success: true });

        if (url.includes("/rest/v1/profiles")) return Response.json([{ id: "admin-1", role, full_name: "Admin" }]);

        if (url.includes("/rest/v1/monitoring_settings")) {
            if (method === "PATCH" && onWrite) onWrite("settings", options.body);
            return Response.json([settings]);
        }

        if (url.includes("/rest/v1/monitoring_health_checks")) {
            if (method === "POST" && onWrite) onWrite("health", options.body);
            return method === "POST" ? new Response(null, { status: 201 }) : Response.json([]);
        }

        if (url.includes("/rest/v1/monitoring_events")) {
            if (method === "POST" && onWrite) onWrite("event", options.body);
            if (method === "POST") return new Response(null, { status: 201 });
            return Response.json(events);
        }

        if (url.includes("/rest/v1/monitoring_findings")) {
            if (method === "POST" && onWrite) onWrite("finding", options.body);
            if (method === "PATCH" && onWrite) onWrite("finding-patch", options.body);
            return method === "GET" ? Response.json(findings) : Response.json([]);
        }

        if (url.includes("/rest/v1/social_post_runs")) {
            return Response.json([{ status: "posted", scheduled_for: new Date().toISOString() }]);
        }

        return Response.json({});
    };

    return () => { globalThis.fetch = original; };
}

/* ---------------------------------------------------------
   SQL
   --------------------------------------------------------- */

test("migrasi membuat empat tabel monitoring dengan RLS server-only", () => {
    const sql = read("supabase/monitoring-blackbox.sql");

    for (const table of [
        "monitoring_events",
        "monitoring_health_checks",
        "monitoring_findings",
        "monitoring_settings"
    ]) {
        assert.match(sql, new RegExp(`create table if not exists public\\.${table}`));
        assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
        assert.match(sql, new RegExp(`revoke all on public\\.${table} from public, anon, authenticated`));
        assert.match(sql, new RegExp(`grant all on public\\.${table} to service_role`));
    }

    assert.match(sql, /fingerprint text not null unique/);
    assert.match(sql, /devtools_open boolean not null default false/);
    assert.match(sql, /insert into public\.monitoring_settings \(id\)\s*values \(true\)\s*on conflict \(id\) do nothing/);
});

/* ---------------------------------------------------------
   OTORISASI
   --------------------------------------------------------- */

test("overview menolak permintaan tanpa token dan menolak role USER", async () => {
    const restore = installFetch();
    try {
        const anonymous = await call(makeReq({ headers: { authorization: "" } }));
        assert.equal(anonymous.status, 401);

        const user = await call(makeReq());
        assert.equal(user.status, 200, "admin harus lolos (dicek terpisah)");
    } finally {
        restore();
    }

    const restoreUser = installFetch({ role: "user" });
    try {
        const user = await call(makeReq());
        assert.equal(user.status, 403);
        assert.match(user.json.error, /ADMIN|OWNER/i);
    } finally {
        restoreUser();
    }
});

test("overview mengembalikan ringkasan lengkap untuk admin", async () => {
    const restore = installFetch();
    try {
        const { status, json } = await call(makeReq());
        assert.equal(status, 200);
        assert.equal(json.success, true);
        assert.equal(json.available, true);
        assert.ok(json.summary);
        assert.ok(Array.isArray(json.health));
        assert.ok(Array.isArray(json.events));
        assert.ok(Array.isArray(json.findings));
        assert.equal(json.settings.scan_interval_minutes, 15);
    } finally {
        restore();
    }
});

/* ---------------------------------------------------------
   INGEST
   --------------------------------------------------------- */

test("beacon boleh ingest tanpa login dan IP/lokasi diambil dari Cloudflare", async () => {
    let saved = null;
    const restore = installFetch({ onWrite: (kind, body) => { if (kind === "event") saved = JSON.parse(body); } });

    try {
        const { status, json } = await call(makeReq({
            method: "POST",
            action: "ingest",
            headers: { authorization: "" },
            cf: { city: "Jakarta", region: "Jakarta", country: "ID", asn: 7713, colo: "CGK" },
            body: {
                kind: "devtools",
                /* Klaim palsu dari browser harus diabaikan. */
                ip: "1.2.3.4",
                country: "XX",
                message: "DevTools dibuka."
            }
        }));

        assert.equal(status, 202);
        assert.equal(json.success, true);
        assert.ok(saved, "event harus tersimpan");

        assert.equal(saved.ip, "203.0.113.9", "IP wajib dari header Cloudflare");
        assert.equal(saved.country, "ID", "negara wajib dari request.cf");
        assert.equal(saved.city, "Jakarta");
        assert.equal(saved.asn, "AS7713");
        assert.equal(saved.colo, "CGK");
        assert.equal(saved.devtools_open, true);
        assert.equal(saved.kind, "devtools");
        assert.equal(saved.browser, "Chrome");
        assert.equal(saved.os, "Windows");
    } finally {
        restore();
    }
});

test("ingest menolak payload kosong dan payload kebesaran", async () => {
    const restore = installFetch();
    try {
        const empty = await call(makeReq({ method: "POST", action: "ingest", headers: { authorization: "" }, body: {} }));
        assert.equal(empty.status, 400);

        const big = await call(makeReq({
            method: "POST",
            action: "ingest",
            headers: { authorization: "", "content-length": String(64 * 1024) },
            body: { kind: "activity", path: "/x", message: "x" }
        }));
        assert.equal(big.status, 413);
    } finally {
        restore();
    }
});

test("normalizeEventInput memotong teks panjang dan membuang kind asing", () => {
    const event = normalizeEventInput({ kind: "<script>", message: "a".repeat(900), path: "/halaman?token=rahasia" });

    assert.equal(event.kind, "activity");
    assert.equal(event.path, "/halaman", "query string dibuang");
    assert.ok(event.message.length <= 500);
});

test("readNetworkContext memakai header cf-connecting-ip lebih dulu", () => {
    const context = readNetworkContext({
        headers: { "cf-connecting-ip": "198.51.100.7", "x-forwarded-for": "10.0.0.1" },
        cf: { country: "ID", city: "Bandung" }
    });

    assert.equal(context.ip, "198.51.100.7");
    assert.equal(context.country, "ID");
    assert.equal(context.city, "Bandung");
});

test("parseUserAgent mengenali perangkat mobile dan browser", () => {
    const mobile = parseUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1");
    assert.equal(mobile.device, "mobile");
    assert.equal(mobile.browser, "Safari");
    assert.equal(mobile.os, "iOS");
});

/* ---------------------------------------------------------
   TEMUAN
   --------------------------------------------------------- */

test("temuan kesehatan yang gagal selalu membawa cara mengatasi", () => {
    const findings = buildFindings({
        checks: [
            {
                target: "database",
                label: "Database",
                status: "fail",
                latency_ms: 12,
                detail: { message: "Layanan mengembalikan 503.", hint: "Cek dashboard Supabase." }
            },
            { target: "web", label: "Situs web", status: "ok", latency_ms: 40, detail: {} }
        ],
        events: [],
        settings: baseSettings()
    });

    assert.equal(findings.length, 1);
    assert.equal(findings[0].fingerprint, "health:database");
    assert.equal(findings[0].severity, "critical");
    assert.match(findings[0].remediation, /Supabase/);
});

test("akses DevTools membuat satu temuan agregat, bukan satu per kejadian", () => {
    const now = new Date().toISOString();
    const events = [
        { kind: "devtools", severity: "warn", devtools_open: true, ip: "203.0.113.9", occurred_at: now },
        { kind: "page_view", severity: "info", devtools_open: true, ip: "203.0.113.9", occurred_at: now },
        { kind: "devtools", severity: "warn", devtools_open: true, ip: "198.51.100.4", occurred_at: now }
    ];

    const findings = buildFindings({ checks: [], events, settings: baseSettings() });

    assert.equal(findings.length, 1);
    assert.equal(findings[0].fingerprint, "devtools:open");
    assert.match(findings[0].remediation, /kata sandi|sesi/i);
    assert.equal(findings[0].evidence.ips.length, 2);
});

test("temuan DevTools dihormati oleh saklar devtools_alerts", () => {
    const findings = buildFindings({
        checks: [],
        events: [{ kind: "devtools", devtools_open: true, occurred_at: new Date().toISOString() }],
        settings: baseSettings({ devtools_alerts: false })
    });

    assert.equal(findings.length, 0);
});

test("error klien berulang di halaman yang sama jadi temuan", () => {
    const now = new Date().toISOString();
    const events = Array.from({ length: 4 }, () => ({
        kind: "error",
        severity: "error",
        path: "/generate/index.html",
        message: "Cannot read properties of null",
        occurred_at: now
    }));

    const findings = buildFindings({ checks: [], events, settings: baseSettings() });

    assert.equal(findings.length, 1);
    assert.equal(findings[0].fingerprint, "client-error:/generate/index.html");
    assert.equal(findings[0].category, "bug");
    assert.ok(findings[0].remediation.length > 10);
});

/* ---------------------------------------------------------
   PENGATURAN & SCAN
   --------------------------------------------------------- */

test("validasi pengaturan menolak interval dan retensi di luar batas", () => {
    assert.ok(normalizeSettingsInput({ scan_interval_minutes: 0, retention_days: 30 }).error);
    assert.ok(normalizeSettingsInput({ scan_interval_minutes: 15, retention_days: 400 }).error);

    const ok = normalizeSettingsInput({ scan_interval_minutes: 30, retention_days: 90 });
    assert.equal(ok.value.scan_interval_minutes, 30);
    assert.equal(ok.value.retention_days, 90);
});

test("scan menulis hasil pemeriksaan dan memperbarui waktu scan", async () => {
    const writes = [];
    const restore = installFetch({ onWrite: (kind, body) => writes.push([kind, body]) });

    try {
        const { status, json } = await call(makeReq({ method: "POST", action: "scan", body: {} }));

        assert.equal(status, 200);
        assert.equal(json.success, true);
        assert.ok(json.health.length >= 6, "minimal enam target diperiksa");

        const healthWrite = writes.find(([kind]) => kind === "health");
        assert.ok(healthWrite, "hasil pemeriksaan harus disimpan");
        assert.ok(JSON.parse(healthWrite[1]).length >= 6);

        const settingsWrite = writes.find(([kind]) => kind === "settings");
        assert.ok(settingsWrite, "last_scan_at harus diperbarui");
    } finally {
        restore();
    }
});

test("cron melewati pemeriksaan bila interval belum terlewati", async () => {
    const restore = installFetch({ settings: baseSettings({ last_scan_at: new Date().toISOString() }) });
    try {
        const result = await runMonitoringCron(ENV, new Date());
        assert.equal(result.skipped, true);
        assert.equal(result.reason, "not_due");
    } finally {
        restore();
    }
});

test("cron berhenti aman bila konfigurasi Supabase tidak ada", async () => {
    const result = await runMonitoringCron({}, new Date());
    assert.equal(result.skipped, true);
    assert.equal(result.reason, "supabase_not_configured");
});

/* ---------------------------------------------------------
   UI / INTEGRASI
   --------------------------------------------------------- */

test("admin panel punya kartu MONITORING menuju halaman monitoring", () => {
    const panel = read("admin-control/admin-panel.html");
    const card = panel.match(/<a\b[^>]*class="feature-card"[^>]*href="\.\/monitoring\.html"[\s\S]*?<\/a>/);

    assert.ok(card, "kartu MONITORING wajib ada");
    assert.match(card[0], /MONITORING/);
});

test("halaman monitoring memakai tampilan BLACK BOX dan memuat beacon", () => {
    const page = read("admin-control/monitoring.html");

    assert.match(page, /href="\.\.\/black-box\/assets\/css\/black-box\.css\?v=[^"]+"/);
    assert.match(page, /href="\.\/assets\/css\/monitoring\.css\?v=[^"]+"/);
    assert.match(page, /class="bb-body bb-guard-pending"/);
    assert.match(page, /\/assets\/js\/security-beacon\.js\?v=[^"]+/);
    assert.match(page, /type="module" src="\.\/monitoring\.js\?v=[^"]+"/);
    assert.match(page, /<div id="navigation"><\/div>/);

    for (const section of ["Kesehatan Web", "Temuan &amp; Cara Mengatasi", "Log Aktivitas Live", "Akses &amp; DevTools", "Pemeriksaan Rutin"]) {
        assert.ok(page.includes(section), `bagian "${section}" wajib ada`);
    }
});

test("menu navigasi menampilkan Monitoring hanya untuk admin/owner", () => {
    const navigation = read("navigation/navigation.js");
    assert.match(navigation, /monitoring: `<svg viewBox="0 0 24 24"/);
    assert.match(navigation, /\{ label: "Monitoring", href: "\/admin-control\/monitoring\.html", icon: ICONS\.monitoring \}/);
});

test("beacon mendeteksi DevTools dan tidak pernah memakai alamat lokal", () => {
    const beacon = read("assets/js/security-beacon.js");

    assert.match(beacon, /\/api\/monitoring\?action=ingest/);
    assert.match(beacon, /navigator\.sendBeacon/);
    assert.match(beacon, /outerWidth/);
    assert.match(beacon, /defineProperty/);
    assert.doesNotMatch(beacon, /localhost|127\.0\.0\.1/);
});

test("guard monitoring menunggu GENZNavigationReady sebelum memutuskan akses", () => {
    const page = read("admin-control/monitoring.html");

    assert.match(page, /window\.GENZNavigationReady/, "harus menunggu promise navigasi");
    assert.match(page, /Promise\.race/, "harus punya batas waktu tunggu");

    /* Regresi: polling cepat yang dulu menolak akun OWNER karena role
       default navigation.js masih \"user\" saat profil belum termuat. */
    assert.doesNotMatch(page, /attempts >= 20/);
});

test("guard mengonfirmasi role ke tabel profiles sebelum menolak", () => {
    const page = read("admin-control/monitoring.html");

    assert.match(page, /var ADMIN_ROLES = \["admin", "owner"\];/);
    assert.match(page, /async function roleFromProfile/);
    assert.match(page, /\.from\("profiles"\)/);
    assert.match(page, /hasAccess\(direct\)/);

    /* Penolakan hanya boleh terjadi setelah role dikonfirmasi. */
    assert.match(page, /var role = await resolveRole\(\);[\s\S]{0,600}deny\(role\);/);
});

test("API memakai kolom profiles.name, bukan full_name", () => {
    const source = read("api/monitoring.js");

    assert.match(source, /const variants = \["id,role,name", "id,role"\];/);
    assert.doesNotMatch(source, /select=id,role,full_name/);
    assert.match(source, /profile\?\.name \|\| profile\?\.full_name/);
});

test("role admin tetap terbaca walau bentuk select pertama ditolak skema", async () => {
    const original = globalThis.fetch;

    globalThis.fetch = async (input, options = {}) => {
        const url = String(input);
        const method = String(options.method || "GET").toUpperCase();

        if (url.includes("/auth/v1/user")) return Response.json({ id: "admin-1" });
        if (url.includes("/auth/v1/health")) return Response.json({ name: "GoTrue" });
        if (url.includes("/storage/v1/bucket")) return Response.json([]);
        if (url.endsWith("/index.html")) return new Response("ok", { status: 200 });
        if (url.includes("/api/announcements")) return Response.json({ success: true });

        if (url.includes("/rest/v1/profiles")) {
            /* Simulasi deployment yang belum punya kolom `name`. */
            if (url.includes("select=id,role,name")) {
                return Response.json(
                    { code: "42703", message: 'column profiles.name does not exist' },
                    { status: 400 }
                );
            }
            return Response.json([{ id: "admin-1", role: "owner" }]);
        }

        if (url.includes("/rest/v1/monitoring_settings")) return Response.json([baseSettings()]);
        if (url.includes("/rest/v1/monitoring_health_checks")) return method === "POST"
            ? new Response(null, { status: 201 })
            : Response.json([]);
        if (url.includes("/rest/v1/monitoring_events")) return Response.json([]);
        if (url.includes("/rest/v1/monitoring_findings")) return Response.json([]);
        if (url.includes("/rest/v1/social_post_runs")) return Response.json([]);

        return Response.json({});
    };

    try {
        const { status, json } = await call(makeReq());
        assert.equal(status, 200, "fallback select harus menyelamatkan akses OWNER");
        assert.equal(json.success, true);
    } finally {
        globalThis.fetch = original;
    }
});

/* ---------------------------------------------------------
   DETAIL LOG (klik satu baris)
   --------------------------------------------------------- */

test("beacon mengirim user_id dari sesi Supabase agar email bisa ditampilkan", () => {
    const beacon = read("assets/js/security-beacon.js");

    assert.match(beacon, /user_id: currentUserId\(\)/);
    assert.match(beacon, /-auth-token/);
    assert.match(beacon, /GENZ_NAVIGATION_USER/);
});

test("user_id palsu yang bukan UUID dibuang saat ingest", () => {
    const valid = normalizeEventInput({
        kind: "page_view",
        path: "/generate/index.html",
        user_id: "c237fcef-6456-451e-ae98-691f2dabb60d"
    });
    assert.equal(valid.user_id, "c237fcef-6456-451e-ae98-691f2dabb60d");

    const invalid = normalizeEventInput({ kind: "page_view", path: "/x", user_id: "<script>" });
    assert.equal(invalid.user_id, null);
});

function detailFetch({ event = {}, profile = null } = {}) {
    const original = globalThis.fetch;

    globalThis.fetch = async (input, options = {}) => {
        const url = String(input);
        const method = String(options.method || "GET").toUpperCase();

        if (url.includes("/auth/v1/user")) return Response.json({ id: "admin-1" });
        if (url.includes("/rest/v1/profiles")) {
            if (url.includes("id=eq.c237fcef")) {
                return Response.json([profile || { id: "c237fcef-6456-451e-ae98-691f2dabb60d", email: "owner@genz.ai", name: "Owner", role: "OWNER" }]);
            }
            return Response.json([{ id: "admin-1", role: "admin" }]);
        }
        if (url.includes("/rest/v1/monitoring_events")) {
            if (url.includes("id=eq.12")) return Response.json([event]);
            if (url.includes("ip=eq.")) {
                return Response.json([
                    { id: 1, occurred_at: "2026-10-29T07:00:00.000Z" },
                    { id: 2, occurred_at: "2026-10-29T07:05:00.000Z" }
                ]);
            }
            if (url.includes("session_id=eq.")) return Response.json([{ id: 1 }, { id: 2 }, { id: 3 }]);
            return Response.json([]);
        }

        return Response.json(method === "GET" ? [] : {});
    };

    return () => { globalThis.fetch = original; };
}

test("detail log menolak id tidak valid dan log yang tidak ada", async () => {
    const restore = detailFetch({});
    try {
        const bad = await call(makeReq({ action: "event", query: { id: "abc" } }));
        assert.equal(bad.status, 400);

        const missing = await call(makeReq({ action: "event", query: { id: "99" } }));
        assert.equal(missing.status, 404);
    } finally {
        restore();
    }
});

test("detail log memuat email pemilik, jaringan, perangkat, dan cara mengatasi", async () => {
    const restore = detailFetch({
        event: {
            id: 12,
            kind: "devtools",
            severity: "warn",
            path: "/generate/index.html",
            message: "DevTools dibuka pada halaman ini.",
            ip: "203.0.113.9",
            city: "Jakarta",
            region: "Jakarta",
            country: "ID",
            asn: "AS7713",
            colo: "CGK",
            browser: "Chrome",
            os: "Windows",
            device: "desktop",
            user_agent: "Mozilla/5.0 Chrome/130",
            user_id: "c237fcef-6456-451e-ae98-691f2dabb60d",
            session_id: "s_abc",
            devtools_open: true,
            occurred_at: "2026-10-29T07:00:00.000Z",
            detail: { viewport: "1440x900", screen: "1920x1080", href: "https://site.example/generate/index.html" }
        }
    });

    try {
        const { status, json } = await call(makeReq({ action: "event", query: { id: "12" } }));

        assert.equal(status, 200);
        assert.equal(json.success, true);
        assert.equal(json.event.id, 12);
        assert.equal(json.profile.email, "owner@genz.ai");
        assert.equal(json.profile.role, "owner");
        assert.equal(json.event.ip, "203.0.113.9");
        assert.equal(json.event.browser, "Chrome");
        assert.equal(json.related.ip_events_24h, 2);
        assert.equal(json.related.session_events, 3);
        assert.match(json.remediation, /kata sandi|sesi/i);
    } finally {
        restore();
    }
});

test("halaman monitoring punya panel detail dan baris log bisa diklik", () => {
    const page = read("admin-control/monitoring.html");
    const script = read("admin-control/monitoring.js");
    const css = read("admin-control/assets/css/monitoring.css");

    assert.match(page, /id="monDetail"/);
    assert.match(page, /id="monDetailBody"/);
    assert.match(page, /id="monDetailClose"/);
    assert.match(page, /class="mon-detail-backdrop"/);

    assert.match(script, /row\.dataset\.eventId = String\(event\.id\)/);
    assert.match(script, /api\("event", \{ query: \{ id \} \}\)/);
    assert.match(script, /function renderDetail/);
    assert.match(script, /Email/);

    assert.match(css, /\.mon-detail-panel/);
    assert.match(css, /\.mon-detail-row/);
});

test("identitas dari token sesi menimpa user_id kiriman browser", async () => {
    const original = globalThis.fetch;
    let saved = null;

    globalThis.fetch = async (input, options = {}) => {
        const url = String(input);
        const method = String(options.method || "GET").toUpperCase();

        if (url.includes("/auth/v1/user")) {
            return Response.json({ id: "c237fcef-6456-451e-ae98-691f2dabb60d" });
        }
        if (url.includes("/rest/v1/monitoring_events")) {
            if (method === "POST") {
                saved = JSON.parse(options.body);
                return new Response(null, { status: 201 });
            }
            return Response.json([]);
        }

        return Response.json([]);
    };

    try {
        const { status } = await call(makeReq({
            method: "POST",
            action: "ingest",
            headers: { authorization: "Bearer sesi-valid" },
            body: {
                kind: "page_view",
                path: "/history/index.html",
                /* Klaim browser yang berbeda dari token. */
                user_id: "11111111-1111-1111-1111-111111111111"
            }
        }));

        assert.equal(status, 202);
        assert.equal(saved.user_id, "c237fcef-6456-451e-ae98-691f2dabb60d");
        assert.equal(saved.detail.identity_verified, true);
    } finally {
        globalThis.fetch = original;
    }
});

/* ---------------------------------------------------------
   BATAS JUMLAH LOG (500) + PILIHAN 50 / 100 / 500
   --------------------------------------------------------- */

test("migrasi menambah max_events dan fungsi pangkas log", () => {
    const sql = read("supabase/monitoring-log-cap.sql");

    assert.match(sql, /add column if not exists max_events integer not null default 500/);
    assert.match(sql, /check \(max_events between 50 and 10000\)/);
    assert.match(sql, /create or replace function public\.prune_monitoring_events\(p_keep integer default 500\)/);
    assert.match(sql, /offset v_keep/);
    assert.match(sql, /revoke all on function public\.prune_monitoring_events/);
});

test("filter log dibatasi maksimal 500 baris", async () => {
    const { buildEventFilter } = await import("../api/monitoring.js");

    assert.equal(buildEventFilter({ limit: "500" }).endsWith("limit=500"), true);
    assert.match(buildEventFilter({ limit: "9000" }), /limit=500$/, "tidak boleh lebih dari 500");
    assert.match(buildEventFilter({}), /limit=50$/, "bawaan 50 baris");
});

test("validasi pengaturan menolak batas log di luar rentang", () => {
    assert.ok(normalizeSettingsInput({ scan_interval_minutes: 15, retention_days: 30, max_events: 10 }).error);
    assert.ok(normalizeSettingsInput({ scan_interval_minutes: 15, retention_days: 30, max_events: 20000 }).error);

    const ok = normalizeSettingsInput({ scan_interval_minutes: 15, retention_days: 30, max_events: 500 });
    assert.equal(ok.value.max_events, 500);

    const fallback = normalizeSettingsInput({ scan_interval_minutes: 15, retention_days: 30 });
    assert.equal(fallback.value.max_events, 500, "tanpa isian, bawaan 500");
});

test("halaman menyediakan pilihan 50 / 100 / 500 dan mengirim limit ke API", () => {
    const page = read("admin-control/monitoring.html");
    const script = read("admin-control/monitoring.js");

    assert.match(page, /id="monLogLimit"/);
    for (const value of ["50", "100", "500"]) {
        assert.match(page, new RegExp(`<option value="${value}">${value}</option>`));
    }

    assert.match(script, /const LOG_LIMIT_OPTIONS = \[50, 100, 500\];/);
    assert.match(script, /api\("events", \{ query: \{ limit: state\.logLimit \} \}\)/);
    assert.match(script, /filtered\.slice\(0, state\.logLimit\)/);
});

test("cron menegakkan batas log setiap menit meski pemeriksaan belum jatuh tempo", async () => {
    let pruned = false;

    const original = globalThis.fetch;
    globalThis.fetch = async (input, options = {}) => {
        const url = String(input);
        const method = String(options.method || "GET").toUpperCase();

        if (url.includes("/rpc/prune_monitoring_events")) {
            pruned = true;
            return Response.json(3);
        }
        if (url.includes("/rest/v1/monitoring_settings")) {
            return Response.json([baseSettings({ last_scan_at: new Date().toISOString(), max_events: 500 })]);
        }

        return Response.json(method === "GET" ? [] : {});
    };

    try {
        const result = await runMonitoringCron(ENV, new Date());
        assert.equal(result.skipped, true);
        assert.equal(result.pruned, 3);
        assert.equal(pruned, true, "RPC pangkas harus dipanggil walaupun scan belum due");
    } finally {
        globalThis.fetch = original;
    }
});

test("pemangkas log memanggil RPC dengan batas yang benar", async () => {
    const { pruneEventOverflow } = await import("../lib/monitoring/health.js");

    let payload = null;
    let target = "";
    const original = globalThis.fetch;

    globalThis.fetch = async (input, options = {}) => {
        target = String(input);
        payload = JSON.parse(options.body || "{}");
        return Response.json(7);
    };

    try {
        const removed = await pruneEventOverflow(
            { supabaseUrl: "https://project.example", serviceKey: "k" },
            500
        );

        assert.equal(removed, 7);
        assert.match(target, /\/rest\/v1\/rpc\/prune_monitoring_events$/);
        assert.equal(payload.p_keep, 500);

        /* Di bawah 50 harus dinaikkan, di atas 10000 diturunkan. */
        await pruneEventOverflow({ supabaseUrl: "https://project.example", serviceKey: "k" }, 5);
        assert.equal(payload.p_keep, 50);

        await pruneEventOverflow({ supabaseUrl: "https://project.example", serviceKey: "k" }, 999999);
        assert.equal(payload.p_keep, 10000);
    } finally {
        globalThis.fetch = original;
    }
});

/* ---------------------------------------------------------
   URL API: parameter harus terpisah, bukan "events&limit=50"
   yang ter-encode menjadi events%26limit%3D50 (404).
   --------------------------------------------------------- */

function loadMonitoringUi(extra = {}) {
    const source = read("admin-control/monitoring.js");
    const calls = [];

    const window = {
        localStorage: { getItem: () => null, setItem: () => {} },
        addEventListener: () => {}
    };
    window.GENZSession = { ensureFreshSession: async () => ({ access_token: "token-uji" }) };

    const document = {
        body: { classList: { contains: () => true } },
        addEventListener: () => {},
        getElementById: () => null,
        visibilityState: "visible"
    };

    const context = {
        window,
        document,
        console,
        URLSearchParams,
        setTimeout,
        clearTimeout,
        fetch: async url => {
            calls.push(String(url));
            return {
                ok: true,
                status: 200,
                text: async () => JSON.stringify({ success: true, rows: [] })
            };
        },
        ...extra
    };

    vm.createContext(context);
    vm.runInContext(source, context);

    return { context, calls };
}

test("permintaan log memakai query terpisah (bukan %26)", async () => {
    const { context, calls } = loadMonitoringUi();

    await vm.runInContext('api("events", { query: { limit: 500 } })', context);

    assert.equal(calls.length, 1);
    assert.ok(!calls[0].includes("%26"), "action tidak boleh ter-encode jadi %26");

    const url = new URL(calls[0], "https://contoh.test");
    assert.equal(url.pathname, "/api/monitoring");
    assert.equal(url.searchParams.get("action"), "events");
    assert.equal(url.searchParams.get("limit"), "500");
});

test("permintaan detail log mengirim action dan id terpisah", async () => {
    const { context, calls } = loadMonitoringUi();

    await vm.runInContext('api("event", { query: { id: 26 } })', context);

    const url = new URL(calls[0], "https://contoh.test");
    assert.equal(url.searchParams.get("action"), "event");
    assert.equal(url.searchParams.get("id"), "26");
});

test("action tunggal tetap rapi tanpa query tambahan", async () => {
    const { context, calls } = loadMonitoringUi();

    await vm.runInContext('api("overview")', context);

    assert.equal(calls[0], "/api/monitoring?action=overview");
});

test("UI tidak lagi menyisipkan & ke dalam argumen action", () => {
    const ui = read("admin-control/monitoring.js");

    assert.ok(!/api\(`events&/.test(ui), "jangan pakai api(`events&limit=…`)");
    assert.ok(!/api\(`event&/.test(ui), "jangan pakai api(`event&id=…`)");
    assert.ok(ui.includes("new URLSearchParams"), "query harus dibangun dengan URLSearchParams");
});
