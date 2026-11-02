import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildFindings, runMonitoringScan, REMEDIATION } from "../lib/monitoring/health.js";

/* =========================================================
   BLACK BOX // MONITORING — SIKLUS TUTUP TEMUAN
   ---------------------------------------------------------
   Yang dijaga di sini:
   1. Temuan berbasis event yang buktinya sudah berhenti
      mengalir WAJIB tertutup saat "Periksa sekarang" — tidak
      boleh dibangkitkan terus dari event lama (jendela 24 jam).
   2. Temuan yang masih menerima kejadian baru tetap terbuka.
   3. Notifikasi hasil pemeriksaan harus terlihat (fixed di
      layar), bukan menempel di ujung bawah halaman.
   ========================================================= */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relative) {
    return readFileSync(path.join(root, relative), "utf8");
}

const CONFIG = {
    supabaseUrl: "https://project.example",
    serviceKey: "kunci-uji",
    siteUrl: "https://situs.example"
};

const SETTINGS = {
    scan_interval_minutes: 5,
    retention_days: 7,
    max_events: 500,
    devtools_alerts: true
};

const minutesAgo = minutes => new Date(Date.now() - minutes * 60_000).toISOString();

function errorEvents(fingerprintPath, atIso, count = 3) {
    return Array.from({ length: count }, () => ({
        kind: "error",
        severity: "error",
        path: fingerprintPath,
        message: "Script error.",
        occurred_at: atIso
    }));
}

/* ---------------------------------------------------------
   1. buildFindings — bukti basi tidak dibangkitkan lagi
   --------------------------------------------------------- */

test("temuan dengan bukti basi tidak dibangkitkan ulang dari event lama", () => {
    const events = errorEvents("/halaman-lama", minutesAgo(30));

    const findings = buildFindings({
        checks: [],
        events,
        settings: SETTINGS,
        existingFindings: [
            {
                id: "aaaaaaaa-1111-1111-1111-111111111111",
                fingerprint: "client-error:/halaman-lama",
                status: "open",
                handled_at: null,
                updated_at: minutesAgo(1)
            }
        ]
    });

    assert.equal(
        findings.find(finding => finding.fingerprint === "client-error:/halaman-lama"),
        undefined,
        "event yang berhenti sebelum pembaruan terakhir tidak boleh membangkitkan temuan"
    );
});

test("temuan tetap terbuka bila ada kejadian baru setelah pembaruan terakhir", () => {
    const events = [
        ...errorEvents("/halaman-hidup", minutesAgo(40)),
        ...errorEvents("/halaman-hidup", minutesAgo(0.5))
    ];

    const findings = buildFindings({
        checks: [],
        events,
        settings: SETTINGS,
        existingFindings: [
            {
                id: "bbbbbbbb-2222-2222-2222-222222222222",
                fingerprint: "client-error:/halaman-hidup",
                status: "open",
                handled_at: null,
                updated_at: minutesAgo(5)
            }
        ]
    });

    const finding = findings.find(item => item.fingerprint === "client-error:/halaman-hidup");
    assert.ok(finding, "kejadian baru setelah updated_at wajib tetap ditampilkan");
    assert.ok(new Date(finding.evidence.latest_at) > new Date(minutesAgo(5)));
});

test("error pertama kali tetap muncul meski tidak ada baris temuan sebelumnya", () => {
    const findings = buildFindings({
        checks: [],
        events: errorEvents("/halaman-baru", minutesAgo(2)),
        settings: SETTINGS,
        existingFindings: []
    });

    assert.ok(
        findings.find(item => item.fingerprint === "client-error:/halaman-baru"),
        "temuan baru tanpa riwayat wajib tetap dibuat"
    );
});

test("temuan health tidak pernah dianggap basi", () => {
    const findings = buildFindings({
        checks: [{ target: "api", label: "API", status: "fail", detail: { message: "mati" } }],
        events: [],
        settings: SETTINGS,
        existingFindings: [
            {
                id: "cccccccc-3333-3333-3333-333333333333",
                fingerprint: "health:api",
                status: "open",
                handled_at: null,
                updated_at: new Date().toISOString()
            }
        ]
    });

    assert.ok(findings.find(item => item.fingerprint === "health:api"), "health:api wajib tetap ada");
});

/* ---------------------------------------------------------
   2. runMonitoringScan — ujung ke ujung
   --------------------------------------------------------- */

function scanFetcher({ existingRows, events }) {
    const patchCalls = [];

    const fetchImpl = async (url, options = {}) => {
        const target = String(url);
        const method = String(options.method || "GET").toUpperCase();

        if (target.includes("/monitoring_findings")) {
            if (method === "GET") return Response.json(existingRows);
            if (method === "PATCH") {
                patchCalls.push({ url: target, body: JSON.parse(options.body || "{}") });
                return new Response(null, { status: 204 });
            }
            return Response.json([]);
        }
        if (target.includes("/monitoring_health_checks") && method === "POST") {
            return new Response(null, { status: 201 });
        }
        if (target.includes("/rpc/prune_monitoring_events")) {
            return new Response(null, { status: 204 });
        }
        if (target.includes("/monitoring_settings")) {
            if (method === "PATCH") return Response.json([]);
            return Response.json([SETTINGS]);
        }
        if (target.includes("/monitoring_events")) {
            return Response.json(events);
        }
        if (target.endsWith("/index.html")) {
            return new Response("ok", { status: 200 });
        }
        if (target.includes("/api/announcements")) {
            return Response.json({});
        }
        if (target.includes("/social_post_runs")) {
            return Response.json([{ status: "posted", created_at: new Date().toISOString() }]);
        }
        return Response.json([]);
    };

    return { fetchImpl, patchCalls };
}

test("Periksa sekarang menutup temuan yang sumbernya sudah berhenti", async () => {
    const staleId = "dddddddd-4444-4444-4444-444444444444";
    const aliveId = "eeeeeeee-5555-5555-5555-555555555555";

    const { fetchImpl, patchCalls } = scanFetcher({
        existingRows: [
            {
                id: staleId,
                fingerprint: "client-error:/halaman-lama",
                status: "open",
                occurrence_count: 12,
                category: "bug",
                handled_at: null,
                last_seen_at: minutesAgo(1),
                updated_at: minutesAgo(1)
            },
            {
                id: aliveId,
                fingerprint: "client-error:/halaman-hidup",
                status: "open",
                occurrence_count: 4,
                category: "bug",
                handled_at: null,
                last_seen_at: minutesAgo(5),
                updated_at: minutesAgo(5)
            }
        ],
        events: [
            ...errorEvents("/halaman-lama", minutesAgo(30)),
            ...errorEvents("/halaman-hidup", minutesAgo(40)),
            ...errorEvents("/halaman-hidup", minutesAgo(1))
        ]
    });

    const result = await runMonitoringScan(CONFIG, { fetchImpl, settings: SETTINGS });

    const fingerprints = result.findings.map(finding => finding.fingerprint);
    assert.ok(!fingerprints.includes("client-error:/halaman-lama"), "temuan basi tidak boleh ada di hasil");
    assert.ok(fingerprints.includes("client-error:/halaman-hidup"), "temuan hidup tetap ada di hasil");

    const stalePatches = patchCalls.filter(call => call.url.includes(staleId));
    assert.equal(stalePatches.length, 1, "baris basi wajib ditutup tepat satu kali");
    assert.equal(stalePatches[0].body.status, "resolved");

    const alivePatches = patchCalls.filter(call => call.url.includes(aliveId));
    assert.equal(alivePatches.length, 1);
    assert.equal(alivePatches[0].body.status, "open");
});

/* ---------------------------------------------------------
   3. Teks remediation harus jujur
   --------------------------------------------------------- */

test("remediation client-error menjelaskan penutupan otomatis", () => {
    const text = REMEDIATION["client-error"];

    assert.ok(text.includes("Periksa sekarang"), "menyebut tombol Periksa sekarang");
    assert.ok(text.includes("Tandai selesai"), "menyebut tombol Tandai selesai");
    assert.ok(!text.includes("memastikan temuan tertutup"), "janji lama yang menyesatkan sudah dihapus");
});

/* ---------------------------------------------------------
   4. Notifikasi pemeriksaan harus terlihat
   --------------------------------------------------------- */

test("toast monitoring menempel di body dan tampil fixed di layar", () => {
    const moduleSource = read("admin-control/monitoring.js");
    const cssSource = read("admin-control/assets/css/monitoring.css");
    const htmlSource = read("admin-control/monitoring.html");

    assert.ok(
        moduleSource.includes("document.body.append(created)"),
        "toast wajib ditempel di document.body"
    );
    assert.ok(
        !moduleSource.includes('document.getElementById("monPage").append(created)'),
        "jangan lagi menempel toast di ujung #monPage"
    );

    const toastBlock = cssSource.match(/\.mon-toast\s*\{[\s\S]*?\}/);
    assert.ok(toastBlock, ".mon-toast wajib ada di CSS");
    assert.match(toastBlock[0], /position:\s*fixed/, "toast wajib position: fixed");
    assert.match(toastBlock[0], /z-index:/, "toast wajib punya z-index");

    assert.match(htmlSource, /monitoring\.js\?v=monitoring-20261102-scan-close/, "pin modul monitoring.js wajib dimutakhirkan");
    assert.match(htmlSource, /monitoring\.css\?v=monitoring-20261102-toast-fixed/, "pin CSS monitoring wajib dimutakhirkan");
});

test("klik Periksa sekarang memberi umpan balik seketika", () => {
    const moduleSource = read("admin-control/monitoring.js");
    const scanSource = moduleSource.match(/async function runScan\(\)[\s\S]*?\n\}/);

    assert.ok(scanSource, "runScan wajib ada");
    assert.match(
        scanSource[0],
        /toast\("Memeriksa semua layanan…"\)/,
        "runScan wajib menampilkan toast seketika saat tombol ditekan"
    );
    assert.match(scanSource[0], /MEMERIKSA…/, "label tombol berubah saat memeriksa");
});
