import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

import {
    HISTORY_MEDIA_TTL_MS,
    RETENTION_RULES,
    UPLOAD_TTL_MS,
    cleanupRule,
    collectExpiredPaths,
    createStorageApi,
    isExpired,
    isPathInsidePrefix,
    runStorageCleanup,
    shouldRunStorageCleanup
} from "../lib/storage-retention/cleanup.js";

import { runStorageRetentionCron } from "../functions/_shared/storage-retention-cron.js";

/*
 * RETENSI MEDIA GEN-Z.AI
 * ---------------------------------------------------------
 * Upload foto/video/audio di halaman Generate hanya boleh
 * dipakai 1 jam, media riwayat (upscale) 24 jam. Test ini
 * menjaga aturan TTL, keamanan path, dan pembersihan cron.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = relative => readFileSync(path.join(root, relative), "utf8");

const HOUR = 60 * 60 * 1000;
const NOW = new Date("2026-10-23T12:00:00.000Z");

function isoAgo(ms) {
    return new Date(NOW.getTime() - ms).toISOString();
}

function createFakeApi(tree) {
    const calls = [];
    return {
        calls,
        async list(bucket, prefix, { limit = 100, offset = 0 } = {}) {
            const entries = tree[`${bucket}:${prefix}`] || tree[prefix] || [];
            return entries.slice(offset, offset + limit);
        },
        async remove(bucket, prefixes) {
            calls.push({ bucket, prefixes: [...prefixes] });
            return { deleted: prefixes.length };
        }
    };
}

function file(name, createdAt) {
    return { name, id: `id-${name}`, metadata: { size: 1024 }, created_at: createdAt };
}

function folder(name) {
    return { name, id: null, metadata: null, created_at: null };
}

test("TTL: upload 1 jam, media riwayat 24 jam", () => {
    assert.equal(UPLOAD_TTL_MS, 1 * HOUR);
    assert.equal(HISTORY_MEDIA_TTL_MS, 24 * HOUR);

    const uploadRule = RETENTION_RULES.find(rule => rule.id === "generate-input");
    assert.ok(uploadRule);
    assert.equal(uploadRule.ttlMs, UPLOAD_TTL_MS);
    assert.equal(uploadRule.bucket, "dashboard-videos");

    // Konten situs (videos/ & thumbnails/) tidak boleh ikut dibersihkan.
    for (const rule of RETENTION_RULES) {
        assert.ok(!["videos", "thumbnails"].includes(rule.prefix), `prefix ${rule.prefix} tidak boleh dibersihkan`);
    }
});

test("upload baru memakai bucket privat + signed URL", () => {
    const uploadRules = RETENTION_RULES.filter(rule => rule.bucket === "user-uploads");
    assert.equal(uploadRules.length, 3);

    const inputRule = uploadRules.find(rule => rule.prefix === "generate-input");
    assert.equal(inputRule.ttlMs, UPLOAD_TTL_MS);

    assert.equal(
        uploadRules.find(rule => rule.prefix === "upscale-photos").ttlMs,
        HISTORY_MEDIA_TTL_MS
    );
    assert.equal(
        uploadRules.find(rule => rule.prefix === "upscale-videos").ttlMs,
        HISTORY_MEDIA_TTL_MS
    );

    const generateUpload = read("generate/assets/js/generate-form-upload.js");
    assert.match(generateUpload, /STORAGE_BUCKET =\s*\n?\s*"user-uploads"/);
    assert.match(generateUpload, /createSignedUrl\(/);
    assert.match(generateUpload, /STORAGE_URL_TTL_SECONDS =\s*\n?\s*60 \* 60/);
    assert.doesNotMatch(generateUpload, /getPublicUrl/);

    const upscale = read("upscale/assets/js/upscale-app.js");
    assert.match(upscale, /bucket: "user-uploads"/);
    assert.match(upscale, /createSignedUrl\(/);
    assert.doesNotMatch(upscale, /getPublicUrl/);

    const media = read("generate/assets/js/generate-media.js");
    assert.match(media, /"user-uploads"/);
    assert.match(media, /createSignedUrl\(/);

    const bucketSql = read("supabase/user-media-bucket.sql");
    assert.match(bucketSql, /'user-uploads', 'user-uploads', false/);
    assert.match(bucketSql, /for select/);
    assert.match(bucketSql, /for insert/);

    const worker = read(".github/workflows/upscale.yml");
    assert.match(worker, /for BUCKET in user-uploads dashboard-videos/);

    // Cache-bust modul yang berubah.
    /* Versi cache-buster boleh naik kapan saja; yang penting ada. */
    assert.match(read("generate/index.html"), /generate-app\.js\?v=[A-Za-z0-9._-]+/);
    assert.match(read("upscale/index.html"), /upscale-app\.js\?v=20261023-private-uploads/);
});

test("isExpired menghormati batas TTL", () => {
    assert.equal(isExpired(isoAgo(59 * 60 * 1000), NOW, UPLOAD_TTL_MS), false);
    assert.equal(isExpired(isoAgo(61 * 60 * 1000), NOW, UPLOAD_TTL_MS), true);
    assert.equal(isExpired(isoAgo(23 * HOUR), NOW, HISTORY_MEDIA_TTL_MS), false);
    assert.equal(isExpired(isoAgo(25 * HOUR), NOW, HISTORY_MEDIA_TTL_MS), true);
    assert.equal(isExpired(null, NOW, UPLOAD_TTL_MS), false);
});

test("isPathInsidePrefix menolak path di luar prefix", () => {
    assert.equal(isPathInsidePrefix("generate-input/user-1/a.jpg", "generate-input"), true);
    assert.equal(isPathInsidePrefix("generate-input/user-1/../../videos/a.mp4", "generate-input"), false);
    assert.equal(isPathInsidePrefix("videos/a.mp4", "generate-input"), false);
    assert.equal(isPathInsidePrefix("generate-inputX/a.jpg", "generate-input"), false);
});

test("collectExpiredPaths menelusuri folder dan memakai pagination", async () => {
    const rule = RETENTION_RULES.find(item => item.id === "generate-input");
    const api = createFakeApi({
        "generate-input": [folder("user-1"), folder("user-2")],
        "generate-input/user-1": [
            file("a.jpg", isoAgo(2 * HOUR)),
            file("b.jpg", isoAgo(90 * 60 * 1000)),
            file("c.jpg", isoAgo(30 * 60 * 1000))
        ],
        "generate-input/user-2": [
            file("d.mp4", isoAgo(3 * HOUR))
        ]
    });

    const result = await collectExpiredPaths(api, rule, { now: NOW, pageSize: 2 });

    assert.deepEqual(result.expired.sort(), [
        "generate-input/user-1/a.jpg",
        "generate-input/user-1/b.jpg",
        "generate-input/user-2/d.mp4"
    ]);
    assert.equal(result.scanned.length, 4);
});

test("cleanupRule hanya menghapus file kedaluwarsa dan memotong chunk", async () => {
    const rule = RETENTION_RULES.find(item => item.id === "generate-input");
    const files = [];
    for (let index = 0; index < 101; index += 1) {
        files.push(file(`old-${index}.jpg`, isoAgo(2 * HOUR)));
    }
    files.push(file("fresh.jpg", isoAgo(5 * 60 * 1000)));

    const api = createFakeApi({
        "generate-input": [folder("user-1")],
        "generate-input/user-1": files
    });

    const summary = await cleanupRule(api, rule, { now: NOW, pageSize: 100 });

    assert.equal(summary.deleted, 101);
    assert.equal(summary.failed, 0);
    assert.equal(api.calls.length, 2);
    assert.equal(api.calls[0].prefixes.length, 100);
    assert.equal(api.calls[1].prefixes.length, 1);
    assert.ok(!api.calls.flatMap(call => call.prefixes).includes("generate-input/user-1/fresh.jpg"));
});

test("cleanupRule mode dryRun tidak memanggil delete", async () => {
    const rule = RETENTION_RULES.find(item => item.id === "generate-input");
    const api = createFakeApi({
        "generate-input": [folder("user-1")],
        "generate-input/user-1": [file("a.jpg", isoAgo(2 * HOUR))]
    });

    const summary = await cleanupRule(api, rule, { now: NOW, dryRun: true });

    assert.equal(summary.expired, 1);
    assert.equal(summary.deleted, 0);
    assert.equal(api.calls.length, 0);
});

test("runStorageCleanup meringkas semua rule dan tahan error", async () => {
    const nowIso = isoAgo(25 * HOUR);
    const api = {
        async list(bucket, prefix) {
            // Rule bucket privat tidak punya file pada skenario ini.
            if (bucket !== "dashboard-videos") return [];
            if (prefix === "upscale-videos") throw new Error("storage down");
            if (prefix === "generate-input") return [folder("user-1")];
            if (prefix === "generate-input/user-1") return [file("a.jpg", nowIso)];
            if (prefix === "upscale-photos") return [file("p.jpg", nowIso)];
            return [];
        },
        async remove() {
            return { deleted: 1 };
        }
    };

    const summary = await runStorageCleanup(api, { now: NOW, rules: RETENTION_RULES });

    assert.equal(summary.ok, true);
    assert.equal(summary.totals.deleted, 2);
    const failedRule = summary.rules.find(item => item.id === "upscale-video");
    assert.match(failedRule.error, /storage down/);
});

test("createStorageApi memakai endpoint list & delete Supabase Storage", async () => {
    const requests = [];
    const api = createStorageApi({
        url: "https://project.supabase.co/",
        serviceRoleKey: "service-key",
        fetchImpl: async (url, options) => {
            requests.push({ url, options });
            if (options.method === "POST") {
                return { ok: true, json: async () => [{ name: "a.jpg", id: "1" }] };
            }
            return { ok: true, json: async () => [] };
        }
    });

    await api.list("dashboard-videos", "generate-input");
    await api.remove("dashboard-videos", ["generate-input/a.jpg"]);

    assert.equal(requests[0].url, "https://project.supabase.co/storage/v1/object/list/dashboard-videos");
    assert.equal(requests[0].options.method, "POST");
    assert.equal(JSON.parse(requests[0].options.body).prefix, "generate-input");
    assert.equal(requests[0].options.headers.apikey, "service-key");

    assert.equal(requests[1].url, "https://project.supabase.co/storage/v1/object/dashboard-videos");
    assert.equal(requests[1].options.method, "DELETE");
    assert.deepEqual(JSON.parse(requests[1].options.body).prefixes, ["generate-input/a.jpg"]);
});

test("cron retensi berjalan tiap 5 menit dan butuh kredensial", async () => {
    assert.equal(shouldRunStorageCleanup(new Date("2026-10-23T12:05:00.000Z")), true);
    assert.equal(shouldRunStorageCleanup(new Date("2026-10-23T12:06:00.000Z")), false);

    const skipped = await runStorageRetentionCron({}, NOW);
    assert.equal(skipped.skipped, true);
    assert.equal(skipped.reason, "missing_credentials");

    const results = [];
    const calls = [];
    const summary = await runStorageRetentionCron(
        { SUPABASE_URL: "https://project.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "service-key" },
        NOW,
        {
            force: true,
            rules: [RETENTION_RULES[0]],
            fetchImpl: async (url, options) => {
                calls.push(options.method);
                if (options.method === "POST") {
                    const body = JSON.parse(options.body);
                    if (body.prefix === "generate-input") {
                        return { ok: true, json: async () => [folder("user-1")] };
                    }
                    return { ok: true, json: async () => [file("old.jpg", isoAgo(2 * HOUR))] };
                }
                results.push(options.body);
                return { ok: true, json: async () => [] };
            }
        }
    );

    assert.equal(summary.ok, true);
    assert.equal(summary.totals.deleted, 1);
    assert.equal(calls.filter(method => method === "DELETE").length, 1);
    assert.equal(results.length, 1);
});

test("worker menjalankan cron retensi bersama cron social publisher", () => {
    const worker = read("functions/worker.mjs");
    assert.match(worker, /runStorageRetentionCron/);
    assert.match(worker, /Promise\.allSettled/);
});

test("UI: info 1 jam di Generate & History, 24 jam di Upscale", () => {
    const generate = read("generate/index.html");
    assert.match(generate, /id="generateStorageNote"/);
    assert.match(generate, /hanya bisa dipakai[\s\S]*?<strong>1 jam<\/strong>/);
    assert.match(generate, /dihapus otomatis/);

    const history = read("history/index.html");
    assert.match(history, /id="historyRetentionNotice"/);
    assert.match(
        history,
        /Media hasil generate &amp; upscale disimpan <strong>maksimal 1 jam<\/strong>\./
    );
    assert.match(
        history,
        /Setelah itu file dihapus otomatis dan riwayatnya ditandai[\s\S]*?<strong>KEDALUWARSA<\/strong>\./
    );
    assert.doesNotMatch(history, /maksimal 24 jam/);
    assert.match(history, /thumbnail-expired/);

    const upscale = read("upscale/index.html");
    assert.match(upscale, /upscale-retention-note/);
    assert.match(upscale, /maksimal 24 jam/);
});

test("sisa catatan lama sudah dirapikan", () => {
    // Guard 8 MB di Worker hanya untuk action yang masih ada.
    const worker = read("functions/worker.mjs");
    assert.doesNotMatch(worker, /upload-garment/);
    assert.match(worker, /"upload-reference", "upload-outfit"/);

    // Dokumentasi retensi tersedia dan menyebut kedua batas waktu.
    const doc = read("STORAGE-RETENTION.md");
    assert.match(doc, /1 jam/);
    assert.match(doc, /24 jam/);
    assert.match(doc, /Tidak pernah disentuh cron/i);

    // Policy upscale tidak lagi terlihat seperti penyimpanan permanen.
    const sql = read("supabase/upscale-video-upload-policy.sql");
    assert.match(sql, /24 JAM/);
    assert.match(sql, /STORAGE-RETENTION\.md/);
    assert.match(sql, /bucket_id = 'dashboard-videos'/);

    // README menautkan dokumen retensi.
    const readme = read("README.md");
    assert.match(readme, /STORAGE-RETENTION\.md/);
});

test("history menandai media yang sudah kedaluwarsa", () => {
    const renderSource = read("history/assets/js/history-render.js");
    const sandbox = {
        window: { GENZHistory: {} },
        document: { querySelectorAll: () => [], querySelector: () => null },
        console,
        Date,
        Number,
        String,
        Math,
        JSON,
        Array,
        Object
    };
    vm.createContext(sandbox);
    vm.runInContext(renderSource, sandbox);

    const App = sandbox.window.GENZHistory;
    const baseItem = {
        id: "1",
        task_id: "t1",
        status: "success",
        result_url: "https://ycovbqmezhrvzobxqnyp.supabase.co/storage/v1/object/public/dashboard-upscales/outputs/old.mp4"
    };

    const expired = App.getThumbnailHtml({
        ...baseItem,
        created_at: new Date(Date.now() - 25 * HOUR).toISOString()
    });
    assert.match(expired, /thumbnail-expired/);
    assert.match(expired, /KEDALUWARSA/);
    assert.doesNotMatch(expired, /<video/);

    const fresh = App.getThumbnailHtml({
        ...baseItem,
        created_at: new Date(Date.now() - 2 * HOUR).toISOString()
    });
    assert.doesNotMatch(fresh, /thumbnail-expired/);
    assert.match(fresh, /data-thumb-src/);

    // URL milik provider (bukan storage kita) tidak ditandai kedaluwarsa.
    assert.equal(
        App.isExpiredMedia({
            ...baseItem,
            result_url: "https://cdn.provider.example/video.mp4",
            created_at: new Date(Date.now() - 48 * HOUR).toISOString()
        }),
        false
    );

    const modal = read("history/assets/js/history-modal.js");
    assert.match(modal, /detail-expired-notice/);
    assert.match(modal, /isMediaExpired/);
});
