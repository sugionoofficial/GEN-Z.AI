import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
