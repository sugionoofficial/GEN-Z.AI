import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../studio-flow/index.html", import.meta.url), "utf8");
const js = readFileSync(new URL("../studio-flow/studio-flow.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../studio-flow/studio-flow.css", import.meta.url), "utf8");
const nav = readFileSync(new URL("../navigation/navigation.js", import.meta.url), "utf8");
const api = readFileSync(new URL("../api/social-publisher.js", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/20261110065601_studio_flow_history.sql", import.meta.url), "utf8");
const buildScript = readFileSync(new URL("../scripts/build-cloudflare-pages.mjs", import.meta.url), "utf8");
const resultMigration = readFileSync(new URL("../supabase/migrations/20261110100538_studio_flow_results_bucket.sql", import.meta.url), "utf8");

test("Cloudflare static build includes the Studio Flow files", () => {
    assert.match(buildScript, /"studio-flow"/);
});

test("STUDIO FLOW menyediakan ruang premium untuk gambar/video dan preview khusus", () => {
    assert.match(html, /STUDIO <span>FLOW<\/span>/);
    assert.match(html, /Ruang Kreasi/);
    assert.match(html, /Preview & status/);
    assert.match(html, /Desktop Companion belum tersambung/);
    assert.match(css, /--sf-cyan/);
    assert.match(css, /workspace-grid/);
});

test("Studio Flow image references obey 5 character + 1 outfit + 2 scene = 8 total", () => {
    assert.match(html, /Karakter[\s\S]*?0 \/ 5/);
    assert.match(html, /Outfit[\s\S]*?0 \/ 1/);
    assert.match(html, /Lokasi & Pose[\s\S]*?0 \/ 2/);
    assert.match(html, /0 \/ 8/);
    assert.match(js, /const IMAGE_LIMIT = \{ character: 5, outfit: 1, scene: 2 \}/);
    assert.match(js, /const REF_LIMIT = 8/);
});

test("Studio Flow exposes Nano Banana 2.1, output count, ratios and Flow video configuration", () => {
    assert.match(html, /Nano Banana 2\.1/);
    assert.match(html, /Nano Banana Pro/);
    assert.match(html, /Nano Banana 2 Lite/);
    assert.match(html, /16:9 · Landscape/);
    assert.match(html, /4 output/);
    assert.match(html, /Veo 3\.1 Lite/);
    assert.match(html, /Omni 1\.2 Flash/);
    assert.match(html, /Frame awal & akhir/);
});

test("Studio Flow requires the existing Studio Medsos subscription and adds no GEN-Z credit charge", () => {
    assert.match(js, /studio-access-status/);
    assert.match(js, /data\.access\?\.active/);
    assert.match(html, /Tanpa potong kredit GEN-Z\.AI/);
    assert.match(html, /Kuota Google Flow tetap berlaku/);
});

test("Studio Flow has its own history area and is listed for every navigation role", () => {
    assert.match(html, /Riwayat STUDIO FLOW/);
    assert.match(html, /RIWAYAT TERPISAH DARI HISTORY UTAMA/);
    assert.equal((nav.match(/label: "STUDIO FLOW"/g) || []).length, 2);
    assert.equal((nav.match(/href: "\/studio-flow\/index.html"/g) || []).length, 2);
});

test("Studio Flow sends tasks through visible Flow UI automation and returns downloaded results", () => {
    assert.match(js, /window\.studioFlowDesktop/);
    assert.match(js, /desktopBridge\.handoffTask\(task, stagingId, \{ historyId, accessToken \}\)/);
    assert.match(js, /protocolVersion !== 2/);
    assert.match(js, /generationSubmitted !== true/);
    assert.match(js, /onOutputImported/);
    assert.match(html, /Companion dibutuhkan/);
    assert.match(html, /Companion mengisi kontrol Flow yang terlihat/);
});

test("Studio Flow history is authenticated, subscription-gated, and scoped to the current user", () => {
    assert.match(api, /action === "studio-flow-history"[\s\S]*?ensureStudioAccess\(config, userId\)/);
    assert.match(api, /user_id=eq\.\$\{encodeURIComponent\(userId\)\}.*order=created_at\.desc&limit=10/);
    assert.match(api, /studio-flow-history-delete[\s\S]*?user_id=eq\.\$\{encodeURIComponent\(userId\)\}/);
    assert.match(api, /if \(!parsed \|\| parsed\.protocol !== "https:"\)/);
    assert.match(migration, /references auth\.users\(id\) on delete cascade/);
    assert.match(migration, /enable row level security/);
    assert.match(migration, /auth\.uid\(\) = user_id/);
    assert.match(api, /studio-flow-save-result/);
    assert.match(api, /createSignedStudioFlowOutputUrl/);
    assert.match(resultMigration, /'studio-flow-results'[\s\S]*?false/);
    assert.match(resultMigration, /studio_flow_results_owner_select/);
    assert.match(resultMigration, /storage\.foldername\(name\).*auth\.uid\(\)::text/s);
    assert.match(js, /studio-flow-history/);
    assert.match(js, /createElement\("article"\)/);
});
