import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT = process.cwd();
const api = fs.readFileSync(path.join(ROOT, "api", "social-publisher.js"), "utf8");
const panelHtml = fs.readFileSync(path.join(ROOT, "admin-control", "social-publisher.html"), "utf8");
const panelJs = fs.readFileSync(path.join(ROOT, "admin-control", "social-publisher.js"), "utf8");

/* Tombol "Cek kesehatan autopost" memanggil RPC social_publisher_health()
   lewat API server, supaya admin tidak perlu membuka SQL Editor. */

test("endpoint health check ada dan hanya untuk admin", () => {
    assert.match(api, /async function getAutopostHealth\(config\)/);
    assert.match(api, /\/rest\/v1\/rpc\/social_publisher_health/);
    assert.match(
        api,
        /if \(action === "autopost-health"\) \{\s*requireStudioAdmin\(profile\);/,
        "endpoint wajib memanggil requireStudioAdmin sebelum membaca data"
    );
    /* Deployment yang belum menjalankan migration tidak boleh error 500. */
    assert.match(api, /available: false, health: null/);
});

test("panel punya tombol dan wadah laporan yang tersembunyi secara bawaan", () => {
    assert.match(panelHtml, /id="autopost-health-btn"[^>]*hidden/);
    assert.match(panelHtml, /id="autopost-health-report"[^>]*hidden/);
    assert.match(panelHtml, /Cek kesehatan autopost/);
});

test("laporan dirender tanpa innerHTML (aman terhadap teks dari database)", () => {
    assert.match(panelJs, /async function checkAutopostHealth\(/);
    assert.match(panelJs, /function renderAutopostHealth\(payload\)/);
    assert.match(panelJs, /await api\("autopost-health"\)/);
    assert.match(panelJs, /function applyAutopostHealthAccess\(/);
    assert.match(panelJs, /canManageGlobalAutopublish === true/);

    const start = panelJs.indexOf("function renderAutopostHealth(payload)");
    const end = panelJs.indexOf("async function checkAutopostHealth(");
    assert.ok(start > 0 && end > start, "fungsi render harus ada sebelum checkAutopostHealth");
    const body = panelJs.slice(start, end);
    assert.doesNotMatch(body, /innerHTML/, "pesan alert harus dirender lewat textContent");
    assert.match(body, /createElement\("li"\)/);
    /* Ringkasan angka penting ikut ditampilkan. */
    for (const label of ["Run sukses 24 jam", "Run gagal 24 jam", "Token Opus kedaluwarsa"]) {
        assert.ok(body.includes(label), `ringkasan harus memuat "${label}"`);
    }
});

test("tombol hanya tampil untuk admin/owner", () => {
    assert.match(panelHtml, /id="autopost-health-btn"[^>]*hidden/);
    assert.match(panelJs, /button\.hidden = !canManage/);
});
