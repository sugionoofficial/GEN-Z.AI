import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import socialPublisherHandler from "../api/social-publisher.js";
import {
    buildRunsPageSequence,
    DEFAULT_SOCIAL_RUNS_PER_PAGE,
    normalizeRunsPage,
    normalizeRunsPerPage,
    parseContentRangeTotal,
    SOCIAL_RUNS_PER_PAGE_OPTIONS
} from "../lib/social-publisher/utils.js";

const source = readFileSync(
    fileURLToPath(new URL("../admin-control/social-publisher.js", import.meta.url)),
    "utf8"
);
const htmlSource = readFileSync(
    fileURLToPath(new URL("../admin-control/social-publisher.html", import.meta.url)),
    "utf8"
);
const apiSource = readFileSync(
    fileURLToPath(new URL("../api/social-publisher.js", import.meta.url)),
    "utf8"
);

test("switch autopost saya dan master hijau saat ON, merah saat OFF", () => {
    assert.match(htmlSource, /id="global-toggle" class="btn danger"[^>]*>Autopost saya: OFF<\/button>/);
    assert.match(htmlSource, /id="master-toggle" class="btn danger"[^>]*>Master switch: OFF<\/button>/);

    const render = source.match(/function renderGlobalState\(\) \{([\s\S]*?)\n    \}\n\n    function renderPages/);
    assert.ok(render, "Renderer status switch tidak ditemukan");
    assert.match(render[1], /globalToggle\.textContent = mine \? "Autopost saya: ON" : "Autopost saya: OFF"/);
    assert.match(render[1], /globalToggle\.classList\.toggle\("green", mine\)/);
    assert.match(render[1], /globalToggle\.classList\.toggle\("danger", !mine\)/);
    assert.match(render[1], /masterToggle\.textContent = master \? "Master switch: ON" : "Master switch: OFF"/);
    assert.match(render[1], /masterToggle\.classList\.toggle\("green", master\)/);
    assert.match(render[1], /masterToggle\.classList\.toggle\("danger", !master\)/);
});

function declarationIndent(pattern) {
    const match = source.match(new RegExp(`^([ \\t]*)${pattern}`, "m"));
    assert.ok(match, `Deklarasi ${pattern} tidak ditemukan di admin-control/social-publisher.js`);
    return match[1].length;
}

test("bagian pakaian default dihapus; pakaian mengikuti foto referensi karakter", () => {
    // Perubahan perilaku: tidak ada lagi unggahan "foto pakaian default".
    // Pakaian default mengikuti foto referensi karakter yang dipakai.
    assert.doesNotMatch(htmlSource, /character-garment/, "Field foto pakaian default harus dihapus");
    assert.doesNotMatch(htmlSource, /manual-garment/, "Preview pakaian di posting manual harus dihapus");
    assert.doesNotMatch(source, /uploadGarment|loadGarmentPreview|garment_filename/);
    assert.doesNotMatch(apiSource, /upload-garment|"garment"/);

    // Tanpa outfit, prompt memakai pakaian dari foto referensi.
    const promptSource = readFileSync(
        fileURLToPath(new URL("../lib/social-publisher/utils.js", import.meta.url)),
        "utf8"
    );
    assert.match(promptSource, /useReferenceOutfit = false/);
    assert.match(promptSource, /already wearing in the reference image/);
    assert.match(apiSource, /useReferenceOutfit: !garmentObjectKey/);

    // Daftar karakter tidak lagi punya tombol pakaian.
    assert.match(source, /Pakaian mengikuti foto referensi/);
});

test("riwayat menandai sumber posting: Auto untuk jadwal, Manual untuk posting manual", () => {
    assert.match(source, /const source = run\.schedule_id \? "Auto" : "Manual";/);
    assert.doesNotMatch(source, /run\.schedule_id \? "Jadwal"/);
});

test("tampilan HP memadatkan blok status agar bisa sejajar satu baris", () => {
    // Regresi: di layar <=380px grid config-list turun jadi satu kolom sehingga
    // blok Meta OAuth dan QwenCloud tidak pernah sejajar.
    const mobileBlock = htmlSource.match(/@media\(max-width:768px\)\{[^\n]*config-list\{[^}]*\}[^\n]*\}/);
    assert.ok(mobileBlock, "Aturan mobile untuk .config-list tidak ditemukan");
    assert.match(mobileBlock[0], /config-list\{grid-template-columns:repeat\(2/);
    assert.match(htmlSource, /@media\(max-width:380px\)\{[^\n]*config-item\{padding:8px 8px\}/);
    assert.doesNotMatch(
        htmlSource,
        /@media\(max-width:380px\)\{\.config-list\{grid-template-columns:1fr\}/,
        "Grid tidak boleh turun ke satu kolom di HP kecil"
    );
});

test("QwenCloud tersedia sebagai opsi provider gambar", () => {
    const setHtml = readFileSync(
        fileURLToPath(new URL("../admin-control/studio-medsos-set.html", import.meta.url)),
        "utf8"
    );
    const setJs = readFileSync(
        fileURLToPath(new URL("../admin-control/studio-medsos-set.js", import.meta.url)),
        "utf8"
    );
    const cronSource = readFileSync(
        fileURLToPath(new URL("../functions/_shared/social-publisher-cron.js", import.meta.url)),
        "utf8"
    );
    assert.match(setHtml, /name="image-provider" value="qwencloud"/, "Admin SET Studio Medsos harus punya radio QwenCloud");
    assert.match(apiSource, /\["gemini", "cloudflare", "qwencloud", "tencent", "puter", "opus"\]/, "Validasi provider harus menerima qwencloud");
    assert.match(apiSource, /QWENCLOUD_API_KEY/, "API harus memeriksa secret QWENCLOUD_API_KEY");
    assert.match(setJs, /qwencloud_configured/, "Status kesiapan QwenCloud harus ditampilkan di admin");
    assert.match(source, /QwenCloud \(/, "Studio Medsos harus melabeli provider QwenCloud");
    assert.match(cronSource, /"qwencloud"/, "Cron autopost harus mendukung provider qwencloud");
});

test("Tencent Cloud tersedia sebagai opsi provider gambar", () => {
    const setHtml = readFileSync(
        fileURLToPath(new URL("../admin-control/studio-medsos-set.html", import.meta.url)),
        "utf8"
    );
    const setJs = readFileSync(
        fileURLToPath(new URL("../admin-control/studio-medsos-set.js", import.meta.url)),
        "utf8"
    );
    assert.match(setHtml, /name="image-provider" value="tencent"/, "Admin SET Studio Medsos harus punya radio Tencent Cloud");
    assert.match(apiSource, /TENCENT_TOKENHUB_KEY/, "API harus memeriksa secret TENCENT_TOKENHUB_KEY");
    assert.match(apiSource, /tencent_configured/, "Status kesiapan Tencent harus dikirim ke admin");
    assert.match(setJs, /tencent_configured/, "Status kesiapan Tencent harus ditampilkan di admin");
    assert.match(setJs, /Tencent Cloud \(Hy Image 3\.5 Preview\)/, "Studio Medsos harus melabeli provider Tencent");
    assert.match(
        readFileSync(fileURLToPath(new URL("../lib/social-publisher/providers.js", import.meta.url)), "utf8"),
        /generateTencentSocialImage/,
        "generateSocialImage harus meneruskan ke provider Tencent"
    );
});

test("Puter.js tersedia sebagai opsi provider gambar dengan label jujur", () => {
    const setHtml = readFileSync(
        fileURLToPath(new URL("../admin-control/studio-medsos-set.html", import.meta.url)),
        "utf8"
    );
    const setJs = readFileSync(
        fileURLToPath(new URL("../admin-control/studio-medsos-set.js", import.meta.url)),
        "utf8"
    );
    const providersSource = readFileSync(
        fileURLToPath(new URL("../lib/social-publisher/providers.js", import.meta.url)),
        "utf8"
    );
    const cronSource = readFileSync(
        fileURLToPath(new URL("../functions/_shared/social-publisher-cron.js", import.meta.url)),
        "utf8"
    );
    assert.match(setHtml, /name="image-provider" value="puter"/, "Admin SET Studio Medsos harus punya radio Puter");
    assert.match(setHtml, /id="test-puter-provider"/, "Harus ada tombol Tes Puter");
    assert.match(setHtml, /akun Puter Anda sendiri/, "Label Puter harus menyebut kuota akun Puter, bukan gratis tanpa batas");
    assert.match(setHtml, /PUTER_AUTH_TOKEN/, "Petunjuk secret PUTER_AUTH_TOKEN harus tampil di panel");
    assert.match(apiSource, /PUTER_AUTH_TOKEN/, "API harus memeriksa secret PUTER_AUTH_TOKEN");
    assert.match(apiSource, /puter_configured/, "Status kesiapan Puter harus dikirim ke admin");
    assert.match(setJs, /puter_configured/, "Status kesiapan Puter harus ditampilkan di admin");
    assert.match(setJs, /Puter\.js \(kuota akun Puter Anda\)/, "Studio Medsos harus melabeli provider Puter dengan jujur");
    assert.match(setJs, /User-Pays/, "Keterangan kesiapan harus menyebut model User-Pays");
    assert.match(setJs, /insufficient_funds/, "Keterangan harus menyebut kegagalan saat jatah Puter habis");
    assert.match(setJs, /testPuterProvider/, "Tombol Tes Puter harus berfungsi");
    /* Tombol helper secret dihapus atas permintaan user (2026-10-26):
       pemasangan secret dilakukan manual di dashboard Cloudflare. */
    assert.doesNotMatch(setHtml, /copy-puter-secret-name/, "Tombol salin nama secret tidak boleh ada lagi");
    assert.doesNotMatch(setHtml, /Buka pengaturan secret Worker/, "Tombol buka pengaturan secret tidak boleh ada lagi");
    assert.doesNotMatch(setJs, /copyPuterSecretName/, "Fungsi salin nama secret tidak boleh ada lagi");
    const setupDoc = readFileSync(
        fileURLToPath(new URL("../SOCIAL-PUBLISHER-SETUP.md", import.meta.url)),
        "utf8"
    );
    assert.match(setupDoc, /PUTER_AUTH_TOKEN/, "Dokumen setup harus memuat panduan secret Puter");
    assert.match(setupDoc, /User-Pays/, "Dokumen setup harus menyebut model User-Pays secara jujur");
    /* Regresi (2026-10-26): check constraint database menolak provider
       (bahkan 'tencent' di instalasi lama) sehingga Simpan Provider gagal
       23514. Skema + migrasi harus menerima daftar lengkap, dan API harus
       mengarahkan ke migrasi yang benar. */
    const migration = readFileSync(
        fileURLToPath(new URL("../supabase/social-auto-publisher.sql", import.meta.url)),
        "utf8"
    );
    const puterConstraint = /image_provider in \('gemini', 'cloudflare', 'qwencloud', 'tencent', 'puter', 'opus'\)/g;
    assert.equal(
        (migration.match(puterConstraint) || []).length,
        3,
        "Tiga titik check constraint image_provider di social-auto-publisher.sql harus menerima puter dan opus"
    );
    const constraintMigration = readFileSync(
        fileURLToPath(new URL("../supabase/social-image-provider-constraint.sql", import.meta.url)),
        "utf8"
    );
    assert.match(constraintMigration, /drop constraint if exists social_publisher_config_image_provider_check/, "Migrasi constraint harus idempoten (image)");
    assert.match(constraintMigration, /drop constraint if exists social_publisher_config_text_provider_check/, "Migrasi constraint harus idempoten (text)");
    assert.match(constraintMigration, /'tencent', 'puter', 'opus'\)/, "Migrasi constraint harus memuat daftar provider lengkap");
    assert.match(
        apiSource,
        /social-image-provider-constraint\.sql/,
        "API harus mengarahkan ke migrasi constraint saat database belum diperbarui"
    );
    assert.match(
        apiSource,
        /social_publisher_config_text_provider_check/,
        "API harus menangani check constraint text_provider sebelum fallback kolom"
    );
    assert.match(providersSource, /generatePuterSocialImage/, "generateSocialImage harus meneruskan ke provider Puter");
    assert.match(cronSource, /"puter"/, "Cron autopost harus mendukung provider puter");
    assert.doesNotMatch(
        setHtml,
        /value="puter">[\s\S]{0,400}unlimited/i,
        "Klaim unlimited pada opsi Puter dilarang"
    );
});

test("Opus Labs (Product Ad Studio) tersedia sebagai opsi provider gambar dengan label jujur", () => {
    const setHtml = readFileSync(
        fileURLToPath(new URL("../admin-control/studio-medsos-set.html", import.meta.url)),
        "utf8"
    );
    const setJs = readFileSync(
        fileURLToPath(new URL("../admin-control/studio-medsos-set.js", import.meta.url)),
        "utf8"
    );
    const providersSource = readFileSync(
        fileURLToPath(new URL("../lib/social-publisher/providers.js", import.meta.url)),
        "utf8"
    );
    const cronSource = readFileSync(
        fileURLToPath(new URL("../functions/_shared/social-publisher-cron.js", import.meta.url)),
        "utf8"
    );
    const setupDoc = readFileSync(
        fileURLToPath(new URL("../SOCIAL-PUBLISHER-SETUP.md", import.meta.url)),
        "utf8"
    );
    assert.match(setHtml, /name="image-provider" value="opus"/, "Admin SET Studio Medsos harus punya radio Opus");
    assert.match(setHtml, /id="opus-options"/, "Kotak opsi model Opus harus tersedia di SET Studio Medsos");
    assert.match(setHtml, /id="opus-image-model"/, "Dropdown model Opus harus tersedia di SET Studio Medsos");
    assert.match(setHtml, /gpt-image-2\.5-flare/, "Model GPT Image 2.5 Flare harus tersedia");
    assert.match(setHtml, /gpt-image-2\.5-sunburst/, "Model GPT Image 2.5 Sunburst harus tersedia");
    assert.match(setHtml, /maksimal 3 gambar/i, "Batas unggah maksimal 3 gambar referensi harus tercantum");
    assert.match(setHtml, /quality low/i, "Parameter quality low harus tercantum");
    assert.match(setHtml, /id="test-opus-provider"/, "Harus ada tombol Tes Opus");
    assert.match(setHtml, /product-ad-studio\.labs\.opus\.pro/, "Keterangan harus merujuk ke Product Ad Studio Opus Labs");
    assert.match(setHtml, /kredit akun OpusClip Anda sendiri/, "Label Opus harus menyebut kredit akun OpusClip sendiri secara jujur");
    assert.match(setHtml, /OPUS_AUTH_TOKEN/, "Petunjuk secret OPUS_AUTH_TOKEN harus tampil di panel");
    assert.doesNotMatch(
        setHtml,
        /value="opus">[\s\S]{0,400}unlimited/i,
        "Klaim unlimited pada opsi Opus dilarang"
    );
    assert.match(apiSource, /OPUS_AUTH_TOKEN/, "API harus menyebut secret OPUS_AUTH_TOKEN");
    assert.match(apiSource, /opus_configured/, "Status kesiapan Opus harus dikirim ke admin");
    assert.match(apiSource, /opus_models/, "Daftar model Opus harus dikirim ke admin");
    assert.match(setJs, /opus_configured/, "Status kesiapan Opus harus ditampilkan di admin");
    assert.match(setJs, /selectedOpusModel/, "SET Studio Medsos harus mengirim pilihan model Opus");
    assert.match(setJs, /Opus Labs \(Product Ad Studio\)/, "Studio Medsos harus melabeli provider Opus");
    assert.match(setJs, /testOpusProvider/, "Tombol Tes Opus harus berfungsi");
    assert.match(source, /Opus Labs \(Product Ad Studio/, "Kartu status Studio Medsos harus mengenali label Opus");
    assert.match(providersSource, /generateOpusSocialImage/, "generateSocialImage harus meneruskan ke provider Opus");
    assert.match(cronSource, /"opus"/, "Cron autopost harus mendukung provider opus");
    assert.match(setupDoc, /OPUS_AUTH_TOKEN/, "Dokumen setup harus memuat panduan secret Opus");
    assert.match(setupDoc, /gpt-image-2\.5-flare/, "Dokumen setup harus memuat model GPT Image 2.5 Flare");
    assert.match(setupDoc, /gpt-image-2\.5-sunburst/, "Dokumen setup harus memuat model GPT Image 2.5 Sunburst");
});

test("dropdown model QwenCloud dan panel kuota tier tersedia di SET Studio Medsos", () => {
    const setHtml = readFileSync(
        fileURLToPath(new URL("../admin-control/studio-medsos-set.html", import.meta.url)),
        "utf8"
    );
    const setJs = readFileSync(
        fileURLToPath(new URL("../admin-control/studio-medsos-set.js", import.meta.url)),
        "utf8"
    );
    const migration = readFileSync(
        fileURLToPath(new URL("../supabase/social-auto-publisher.sql", import.meta.url)),
        "utf8"
    );
    assert.match(setHtml, /id="qwencloud-image-model"/, "Dropdown model gambar QwenCloud harus ada");
    assert.match(setHtml, /id="qwencloud-quota-panel"/, "Panel kuota tier harus ada");
    assert.match(setHtml, /id="qwencloud-quota-limit"/, "Input batas tier harus ada");
    assert.match(setJs, /studio-admin-model-quota/, "Admin JS harus memanggil action penyimpanan kuota");
    assert.match(setJs, /percent_available/, "Admin JS harus menampilkan persentase tier tersedia");
    assert.match(setJs, /Tier habis/, "Admin JS harus menandai model yang tier-nya habis");
    assert.match(apiSource, /action === "studio-admin-model-quota"/, "API harus melayani penyimpanan kuota per model");
    assert.match(migration, /check \(image_provider in \('gemini', 'cloudflare', 'qwencloud', 'tencent', 'puter', 'opus'\)\)/, "Migration harus menerima provider qwencloud, tencent, puter, dan opus");
    assert.match(migration, /add column if not exists image_model/, "Migration harus menambah kolom image_model");
    assert.match(migration, /create table if not exists public\.social_publisher_model_quotas/, "Migration harus membuat ledger kuota model");
});

test("kartu Hubungkan Facebook bersih tanpa panduan mode Development karena aplikasi sudah Live", () => {
    assert.doesNotMatch(
        htmlSource,
        /id="meta-app-mode-help"/,
        "Kartu Hubungkan Facebook tidak boleh lagi menampilkan panduan mode Development"
    );
    assert.doesNotMatch(
        htmlSource,
        /Aplikasi tidak aktif/,
        "Teks error mode Development tidak boleh tampil di bawah tombol Hubungkan Facebook"
    );
    assert.doesNotMatch(
        htmlSource,
        /Profil pribadi tidak dapat diposting otomatis lewat Graph API resmi/,
        "Catatan tambahan di bawah tombol Hubungkan Facebook harus dihapus"
    );
    assert.doesNotMatch(
        source,
        /revealMetaAppModeHelp|mode Development/,
        "Script Studio Medsos tidak boleh lagi mengacu ke panduan mode Development"
    );
    assert.match(
        htmlSource,
        /<div class="actions">\s*<button id="connect-page"[^>]*>Hubungkan Facebook<\/button>\s*<button id="toggle-tutorial"[^>]*>Tutorial<\/button>\s*<\/div>/,
        "Tombol Tutorial harus berada tepat di samping tombol Hubungkan Facebook"
    );
    assert.match(
        htmlSource,
        /<div id="usage-tutorial" class="tutorial-panel"[^>]*hidden>/,
        "Blok tutorial harus tertutup secara default (hidden) sebelum diklik"
    );
});

test("filter tampilan 10/20/50/100 dan navigasi halaman tersedia pada Riwayat pembuatan & posting", () => {
    assert.deepEqual(SOCIAL_RUNS_PER_PAGE_OPTIONS, [10, 20, 50, 100]);
    assert.equal(DEFAULT_SOCIAL_RUNS_PER_PAGE, 10);
    assert.equal(normalizeRunsPerPage(10), 10);
    assert.equal(normalizeRunsPerPage("20"), 20);
    assert.equal(normalizeRunsPerPage("50"), 50);
    assert.equal(normalizeRunsPerPage(100), 100);
    assert.equal(normalizeRunsPerPage(999), 10);
    assert.equal(normalizeRunsPage("4"), 4);
    assert.equal(normalizeRunsPage(-2), 1);
    assert.equal(parseContentRangeTotal("0-9/135"), 135);
    assert.equal(parseContentRangeTotal("*/0"), 0);
    assert.equal(parseContentRangeTotal(""), null);

    assert.deepEqual(buildRunsPageSequence(1, 4), [1, 2, 3, 4]);
    assert.deepEqual(buildRunsPageSequence(1, 14), [1, 2, 3, 4, 5, "…", 14]);
    assert.deepEqual(buildRunsPageSequence(7, 14), [1, "…", 6, 7, 8, "…", 14]);
    assert.deepEqual(buildRunsPageSequence(14, 14), [1, "…", 10, 11, 12, 13, 14]);

    assert.match(htmlSource, /id="runs-section"/, "Bagian riwayat harus memiliki id runs-section");
    assert.match(htmlSource, /id="runs-toolbar"/, "Toolbar filter tampilan riwayat harus ada");
    assert.match(htmlSource, /id="runs-pagination-info"/, "Info jumlah data & halaman harus ada");
    assert.match(htmlSource, /id="runs-per-page"/, "Dropdown jumlah data per halaman harus ada");
    assert.match(htmlSource, /id="runs-pagination"/, "Navigasi halaman riwayat harus ada");

    const optionMatches = [...htmlSource.matchAll(/<select id="runs-per-page"[\s\S]*?<\/select>/g)];
    assert.equal(optionMatches.length, 1, "Harus tepat satu dropdown runs-per-page");
    const values = [...optionMatches[0][0].matchAll(/<option value="(\d+)"/g)].map(match => Number(match[1]));
    assert.deepEqual(values, [10, 20, 50, 100], "Pilihan tampilan harus 10, 20, 50, 100");

    assert.equal(
        declarationIndent("async function loadRunsPage\\("),
        declarationIndent("async function loadDashboard\\("),
        "loadRunsPage harus berada di scope utama IIFE sejajar dengan loadDashboard"
    );
});

test("endpoint runs dan dashboard mendukung paginasi 10/20/50/100 serta halaman 1, 2, 3, 4 dst", async () => {
    const allRuns = Array.from({ length: 135 }, (_, index) => ({
        id: `run-${index + 1}`,
        schedule_id: null,
        status: "posted",
        scheduled_for: null,
        scene_plan: { location: `Lokasi ${index + 1}`, outfit: "Linen" },
        caption: `Post ke-${index + 1}`,
        outfit_name: "Linen",
        outfit_order_url: "",
        facebook_post_id: `fb-${index + 1}`,
        permalink_url: `https://www.facebook.com/post/${index + 1}`,
        profile_share_url: "",
        error_message: "",
        finished_at: "2026-10-22T00:00:00.000Z",
        created_at: "2026-10-22T00:00:00.000Z"
    }));

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input) => {
        const url = String(input);
        if (url.endsWith("/auth/v1/user")) {
            return Response.json({ id: "owner-1", email: "owner@example.com" });
        }
        if (url.includes("/rest/v1/profiles?")) {
            return Response.json([{ id: "owner-1", role: "OWNER", status: "active" }]);
        }
        if (url.includes("/rest/v1/studio_medsos_access?")) {
            return Response.json([{
                user_id: "owner-1",
                is_active: true,
                duration_days: 30,
                started_at: new Date(Date.now() - 86400000).toISOString(),
                expires_at: new Date(Date.now() + 29 * 86400000).toISOString()
            }]);
        }
        if (url.includes("/rest/v1/social_post_runs?")) {
            const parsed = new URL(url);
            const limit = Number(parsed.searchParams.get("limit") || 10);
            const offset = Number(parsed.searchParams.get("offset") || 0);
            if (offset >= allRuns.length) {
                return new Response(
                    JSON.stringify({ code: "PGRST103", message: "Requested range not satisfiable" }),
                    { status: 416, headers: { "Content-Range": `*/${allRuns.length}` } }
                );
            }
            const slice = allRuns.slice(offset, offset + limit);
            return new Response(JSON.stringify(slice), {
                status: 200,
                headers: {
                    "Content-Type": "application/json",
                    "Content-Range": `${offset}-${offset + slice.length - 1}/${allRuns.length}`
                }
            });
        }
        if (url.includes("/storage/v1/bucket/")) {
            return Response.json({ id: "social-character-references", public: false });
        }
        return Response.json([]);
    };

    const env = {
        SUPABASE_URL: "https://supabase.example.co",
        SUPABASE_ANON_KEY: "anon-key",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key"
    };

    async function callApi(url) {
        const res = {
            statusCode: 200,
            headers: {},
            body: null,
            setHeader(name, value) { this.headers[name] = value; },
            status(code) { this.statusCode = code; return this; },
            json(payload) { this.body = payload; return this; }
        };
        await socialPublisherHandler({
            method: "GET",
            url,
            headers: { authorization: "Bearer valid-token" },
            env
        }, res);
        return res;
    }

    try {
        const dash = await callApi("/api/social-publisher?action=dashboard");
        assert.equal(dash.statusCode, 200);
        assert.equal(dash.body.runs.length, 10);
        assert.equal(dash.body.runs[0].id, "run-1");
        assert.deepEqual(dash.body.runsPagination, { page: 1, perPage: 10, total: 135, totalPages: 14 });

        const page4 = await callApi("/api/social-publisher?action=runs&page=4&limit=10");
        assert.equal(page4.statusCode, 200);
        assert.equal(page4.body.runs.length, 10);
        assert.equal(page4.body.runs[0].id, "run-31");
        assert.equal(page4.body.runs[9].id, "run-40");
        assert.deepEqual(page4.body.runsPagination, { page: 4, perPage: 10, total: 135, totalPages: 14 });

        for (const [size, expectedPages] of [[20, 7], [50, 3], [100, 2]]) {
            const resp = await callApi(`/api/social-publisher?action=runs&page=1&limit=${size}`);
            assert.equal(resp.statusCode, 200);
            assert.equal(resp.body.runs.length, size);
            assert.deepEqual(resp.body.runsPagination, { page: 1, perPage: size, total: 135, totalPages: expectedPages });
        }

        const outOfRange = await callApi("/api/social-publisher?action=runs&page=99&limit=10");
        assert.equal(outOfRange.statusCode, 200);
        assert.equal(outOfRange.body.runs.length, 5);
        assert.equal(outOfRange.body.runs[0].id, "run-131");
        assert.deepEqual(outOfRange.body.runsPagination, { page: 14, perPage: 10, total: 135, totalPages: 14 });
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("interaksi klik halaman 1..4 dan dropdown 10/20/50/100 di UI memperbarui daftar riwayat secara langsung", async () => {
    class MockElement {
        constructor(tagName = "div", id = "") {
            this.tagName = String(tagName).toUpperCase();
            this.id = id;
            this.className = "";
            this.textContent = "";
            this.value = "";
            this.type = "";
            this.hidden = false;
            this.disabled = false;
            this.checked = false;
            this.open = false;
            this.style = {};
            this.dataset = {};
            this.attributes = new Map();
            this.children = [];
            this.parentElement = null;
            this.listeners = new Map();
            this._innerHTML = "";
            this.classList = {
                add: (...names) => {
                    const set = new Set(this.className.split(/\s+/).filter(Boolean));
                    for (const n of names) set.add(n);
                    this.className = [...set].join(" ");
                },
                remove: (...names) => {
                    const set = new Set(this.className.split(/\s+/).filter(Boolean));
                    for (const n of names) set.delete(n);
                    this.className = [...set].join(" ");
                },
                toggle: (name, force) => {
                    const set = new Set(this.className.split(/\s+/).filter(Boolean));
                    const next = force === undefined ? !set.has(name) : Boolean(force);
                    if (next) set.add(name); else set.delete(name);
                    this.className = [...set].join(" ");
                },
                contains: (name) => this.className.split(/\s+/).includes(name)
            };
        }
        get innerHTML() { return this._innerHTML; }
        set innerHTML(html) {
            this._innerHTML = String(html);
            this.children = [];
        }
        append(...nodes) {
            for (const node of nodes) {
                const el = typeof node === "string" ? Object.assign(new MockElement("#text"), { textContent: node }) : node;
                el.parentElement = this;
                this.children.push(el);
            }
        }
        add(option) { this.append(option); }
        replaceChildren(...nodes) {
            this.children = [];
            this._innerHTML = "";
            this.append(...nodes);
        }
        setAttribute(k, v) {
            this.attributes.set(k, String(v));
            if (k.startsWith("data-")) {
                const camel = k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
                this.dataset[camel] = String(v);
            }
        }
        getAttribute(k) { return this.attributes.get(k) ?? null; }
        removeAttribute(k) { this.attributes.delete(k); }
        addEventListener(type, fn) {
            if (!this.listeners.has(type)) this.listeners.set(type, []);
            this.listeners.get(type).push(fn);
        }
        dispatchEvent(event) {
            const evt = { target: event.target || this, preventDefault() {}, ...event };
            for (const fn of this.listeners.get(evt.type) || []) fn(evt);
        }
        closest(selector) {
            let cur = this;
            while (cur) {
                if (selector === "[data-page]" && (cur.dataset?.page !== undefined || cur.attributes?.has("data-page"))) {
                    return cur;
                }
                cur = cur.parentElement;
            }
            return null;
        }
        getBoundingClientRect() { return { top: -120, left: 0, width: 800, height: 400 }; }
        scrollIntoView() {}
        getContext() {
            return { drawImage() {} };
        }
        toBlob(callback, type = "image/png") {
            const validPng = Buffer.from(
                "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
                "base64"
            );
            callback(new Blob([validPng], { type }));
        }
        set src(val) {
            this._src = val;
            this.naturalWidth = 10;
            this.naturalHeight = 10;
            if (typeof this.onload === "function") queueMicrotask(() => this.onload());
        }
        get src() { return this._src || ""; }
        get fullText() {
            if (this.tagName === "#TEXT") return this.textContent;
            if (!this.children.length) return this.textContent;
            return this.children.map(child => child.fullText).join("");
        }
    }

    const elementsById = new Map();
    const idMatches = [...htmlSource.matchAll(/\bid="([^"]+)"/g)];
    for (const [, id] of idMatches) {
        if (!elementsById.has(id)) elementsById.set(id, new MockElement("div", id));
    }
    elementsById.get("runs-per-page").value = "10";
    elementsById.get("interval-minutes").value = "1440";
    elementsById.get("manual-post-button").textContent = "Buat & bersihkan pratinjau";
    elementsById.get("manual-publish-button").textContent = "Terbitkan ke Facebook Page";
    elementsById.get("usage-tutorial").hidden = true;
    const mainWrap = new MockElement("main", "");

    const allRuns = Array.from({ length: 135 }, (_, idx) => ({
        id: `run-${idx + 1}`,
        schedule_id: null,
        status: "posted",
        scheduled_for: null,
        scene_plan: { location: `Spot ${idx + 1}`, outfit: "Linen" },
        caption: `Konten #${idx + 1}`,
        outfit_name: "Linen",
        outfit_order_url: "",
        permalink_url: `https://www.facebook.com/post/${idx + 1}`,
        profile_share_url: "",
        created_at: "2026-10-22T01:00:00.000Z"
    }));

    const storage = new Map();
    const prevGlobals = {
        window: globalThis.window,
        document: globalThis.document,
        location: globalThis.location,
        history: globalThis.history,
        Option: globalThis.Option,
        Image: globalThis.Image,
        fetch: globalThis.fetch
    };

    let scrolledCount = 0;
    const intervalIds = [];
    const mockWindow = {
        GENZ_SUPABASE: {
            auth: {
                async getSession() {
                    return { data: { session: { access_token: "valid-token" } }, error: null };
                }
            }
        },
        localStorage: {
            getItem: k => (storage.has(k) ? storage.get(k) : null),
            setItem: (k, v) => storage.set(k, String(v))
        },
        innerHeight: 800,
        scrollY: 600,
        scrollTo() { scrolledCount += 1; },
        addEventListener() {},
        setInterval(fn, ms) {
            const id = setInterval(fn, ms);
            intervalIds.push(id);
            return id;
        },
        confirm: () => true
    };

    const mockDocument = {
        addEventListener() {},
        getElementById: id => elementsById.get(id) || null,
        createElement: tag => new MockElement(tag),
        createTextNode: text => Object.assign(new MockElement("#text"), { textContent: String(text) }),
        querySelector: sel => (sel === "main.wrap" ? mainWrap : new MockElement("label"))
    };

    globalThis.window = mockWindow;
    globalThis.document = mockDocument;
    globalThis.location = { search: "", pathname: "/admin-control/social-publisher.html" };
    globalThis.history = { replaceState() {} };
    globalThis.Option = class Option extends MockElement {
        constructor(label = "", val = "") {
            super("option");
            this.textContent = label;
            this.value = val;
        }
    };
    globalThis.Image = class Image extends MockElement {
        constructor() {
            super("img");
        }
    };

    let releaseGenerate = null;
    let releasePublish = null;
    const onePixelPngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    globalThis.fetch = async (input) => {
        const urlStr = String(input);
        if (urlStr.includes("action=manual-generate")) {
            await new Promise(resolve => { releaseGenerate = resolve; });
            return Response.json({
                success: true,
                preview: {
                    run_id: "manual-run-test",
                    image_base64: onePixelPngBase64,
                    image_mime_type: "image/png",
                    aspect_ratio: "9:16",
                    page_name: "GEN-Z Page",
                    caption: "Caption uji coba ✨"
                }
            });
        }
        if (urlStr.includes("action=manual-publish")) {
            await new Promise(resolve => { releasePublish = resolve; });
            return Response.json({
                success: true,
                post: {
                    page_name: "GEN-Z Page",
                    permalink_url: "https://www.facebook.com/post/999"
                }
            });
        }
        if (urlStr.startsWith("/api/social-publisher?")) {
            const res = {
                statusCode: 200,
                headers: {},
                body: null,
                setHeader(k, v) { this.headers[k] = v; },
                status(code) { this.statusCode = code; return this; },
                json(payload) { this.body = payload; return this; }
            };
            await socialPublisherHandler({
                method: "GET",
                url: urlStr,
                headers: { authorization: "Bearer valid-token" },
                env: {
                    SUPABASE_URL: "https://supabase.example.co",
                    SUPABASE_ANON_KEY: "anon-key",
                    SUPABASE_SERVICE_ROLE_KEY: "service-role-key"
                }
            }, res);
            return new Response(JSON.stringify(res.body), {
                status: res.statusCode,
                headers: { "Content-Type": "application/json" }
            });
        }
        if (urlStr.endsWith("/auth/v1/user")) {
            return Response.json({ id: "owner-1", email: "owner@example.com" });
        }
        if (urlStr.includes("/rest/v1/profiles?")) {
            return Response.json([{ id: "owner-1", role: "OWNER", status: "active" }]);
        }
        if (urlStr.includes("/rest/v1/studio_medsos_access?")) {
            return Response.json([{
                user_id: "owner-1",
                is_active: true,
                duration_days: 30,
                started_at: new Date(Date.now() - 86400000).toISOString(),
                expires_at: new Date(Date.now() + 29 * 86400000).toISOString()
            }]);
        }
        if (urlStr.includes("/rest/v1/social_post_runs?")) {
            const parsed = new URL(urlStr);
            const limit = Number(parsed.searchParams.get("limit") || 10);
            const offset = Number(parsed.searchParams.get("offset") || 0);
            const slice = allRuns.slice(offset, offset + limit);
            return new Response(JSON.stringify(slice), {
                status: 200,
                headers: {
                    "Content-Type": "application/json",
                    "Content-Range": `${offset}-${offset + slice.length - 1}/${allRuns.length}`
                }
            });
        }
        if (urlStr.includes("/storage/v1/bucket/")) {
            return Response.json({ id: "social-character-references", public: false });
        }
        return Response.json([]);
    };

    try {
        await import(`../admin-control/social-publisher.js?ui-test=${Date.now()}`);
        await new Promise(resolve => setTimeout(resolve, 40));

        const runsList = elementsById.get("runs-list");
        const runsInfo = elementsById.get("runs-pagination-info");
        const runsNav = elementsById.get("runs-pagination");
        const perPageSelect = elementsById.get("runs-per-page");

        assert.equal(runsList.children.length, 10);
        assert.equal(runsInfo.textContent, "Menampilkan 1–10 dari 135 riwayat · Halaman 1 dari 14");
        assert.equal(runsNav.hidden, false);
        assert.deepEqual(
            runsNav.children.map(c => c.textContent),
            ["‹", "1", "2", "3", "4", "5", "…", "14", "›"]
        );

        // Klik tombol halaman 4
        const page4Btn = runsNav.children.find(c => c.dataset?.page === "4");
        runsNav.dispatchEvent({ type: "click", target: page4Btn });
        await new Promise(resolve => setTimeout(resolve, 40));

        assert.equal(runsList.children.length, 10);
        assert.match(runsList.children[0].fullText, /Konten #31/);
        assert.match(runsList.children[9].fullText, /Konten #40/);
        assert.equal(runsInfo.textContent, "Menampilkan 31–40 dari 135 riwayat · Halaman 4 dari 14");
        assert.ok(scrolledCount >= 1, "Klik halaman harus menggulir kembali ke bagian riwayat");

        // Ubah filter tampilan ke 20, 50, lalu 100
        for (const [size, expectedText] of [
            [20, "Menampilkan 1–20 dari 135 riwayat · Halaman 1 dari 7"],
            [50, "Menampilkan 1–50 dari 135 riwayat · Halaman 1 dari 3"],
            [100, "Menampilkan 1–100 dari 135 riwayat · Halaman 1 dari 2"]
        ]) {
            perPageSelect.value = String(size);
            perPageSelect.dispatchEvent({ type: "change", target: perPageSelect });
            await new Promise(resolve => setTimeout(resolve, 40));
            assert.equal(runsList.children.length, size);
            assert.equal(runsInfo.textContent, expectedText);
            assert.equal(storage.get("genz-social-runs-per-page"), String(size));
        }

        // Klik tombol Tutorial untuk membuka & menutup blok panduan penggunaan
        const tutorialBtn = elementsById.get("toggle-tutorial");
        const tutorialPanel = elementsById.get("usage-tutorial");
        const closeTutorialBtn = elementsById.get("close-tutorial");

        assert.equal(tutorialPanel.hidden, true);
        tutorialBtn.dispatchEvent({ type: "click", target: tutorialBtn });
        assert.equal(tutorialPanel.hidden, false);
        assert.equal(tutorialBtn.getAttribute("aria-expanded"), "true");
        assert.equal(tutorialBtn.classList.contains("is-open"), true);

        tutorialBtn.dispatchEvent({ type: "click", target: tutorialBtn });
        assert.equal(tutorialPanel.hidden, true);
        assert.equal(tutorialBtn.getAttribute("aria-expanded"), "false");

        tutorialBtn.dispatchEvent({ type: "click", target: tutorialBtn });
        assert.equal(tutorialPanel.hidden, false);
        closeTutorialBtn.dispatchEvent({ type: "click", target: closeTutorialBtn });
        assert.equal(tutorialPanel.hidden, true);
        assert.equal(tutorialBtn.getAttribute("aria-expanded"), "false");

        // Klik tombol "Buat & bersihkan pratinjau" -> tampilkan loading premium
        const manualPostForm = elementsById.get("manual-post-form");
        const manualPostBtn = elementsById.get("manual-post-button");
        const manualPublishBtn = elementsById.get("manual-publish-button");
        const manualDiscardBtn = elementsById.get("manual-discard-button");
        elementsById.get("manual-character").value = "char-test";
        elementsById.get("manual-page").value = "page-test";
        elementsById.get("manual-aspect-ratio").value = "9:16";

        manualPostForm.dispatchEvent({ type: "submit", target: manualPostForm });
        await new Promise(resolve => setTimeout(resolve, 20));
        assert.equal(manualPostBtn.disabled, true);
        assert.equal(manualPostBtn.getAttribute("aria-busy"), "true");
        assert.equal(manualPostBtn.classList.contains("is-premium-loading"), true);
        assert.deepEqual(
            manualPostBtn.children.map(c => c.className),
            ["btn-fx-orbit", "btn-fx-text", "btn-fx-time"]
        );
        assert.equal(manualPostBtn.children[1].textContent, "Membuat gambar AI…");
        assert.equal(manualPostBtn.children[2].textContent, "0:00");

        releaseGenerate();
        await new Promise(resolve => setTimeout(resolve, 50));
        assert.equal(manualPostBtn.disabled, false);
        assert.equal(manualPostBtn.classList.contains("is-premium-loading"), false);
        assert.equal(manualPostBtn.textContent, "Buat & bersihkan pratinjau");

        /*
         * Konfirmasi terbit memakai tombol yang sama (tanpa dialog
         * mengambang). Klik pertama hanya mengubah tombol menjadi tombol
         * konfirmasi dan belum mengirim apa pun.
         */
        manualPublishBtn.dispatchEvent({ type: "click", target: manualPublishBtn });
        await new Promise(resolve => setTimeout(resolve, 20));
        assert.equal(manualPublishBtn.textContent, "Konfirmasi: Terbitkan sekarang");
        assert.equal(manualPublishBtn.classList.contains("is-confirming"), true);
        assert.equal(manualPublishBtn.getAttribute("aria-pressed"), "true");
        assert.equal(manualDiscardBtn.textContent, "Batal");
        assert.equal(manualPublishBtn.disabled, false);
        assert.match(
            elementsById.get("manual-post-status").textContent,
            /Klik tombol sekali lagi untuk menerbitkan ke "GEN-Z Page"/i
        );
        assert.match(
            elementsById.get("manual-post-status").textContent,
            /Batal otomatis dalam 9 detik/i
        );

        // Klik kedua pada tombol yang sama -> barulah benar-benar terbit.
        manualPublishBtn.dispatchEvent({ type: "click", target: manualPublishBtn });
        await new Promise(resolve => setTimeout(resolve, 20));
        assert.equal(manualPublishBtn.disabled, true);
        assert.equal(manualDiscardBtn.disabled, true);
        assert.equal(manualPublishBtn.getAttribute("aria-busy"), "true");
        assert.equal(manualPublishBtn.classList.contains("is-premium-loading"), true);
        assert.deepEqual(
            manualPublishBtn.children.map(c => c.className),
            ["btn-fx-orbit", "btn-fx-text", "btn-fx-time"]
        );
        assert.equal(manualPublishBtn.children[1].textContent, "Mengunggah ke Facebook Page…");
        assert.equal(manualPublishBtn.children[2].textContent, "0:00");

        releasePublish();
        await new Promise(resolve => setTimeout(resolve, 50));
        assert.equal(manualPublishBtn.disabled, false);
        assert.equal(manualDiscardBtn.disabled, false);
        assert.equal(manualPublishBtn.classList.contains("is-premium-loading"), false);
        assert.equal(manualPublishBtn.classList.contains("is-confirming"), false);
        assert.equal(manualPublishBtn.textContent, "Terbitkan ke Facebook Page");
    } finally {
        for (const id of intervalIds) clearInterval(id);
        Object.assign(globalThis, prevGlobals);
    }
});

test("tombol Hubungkan Facebook punya jalur manual untuk browser HP", () => {
    // Regresi: di browser dalam aplikasi (Facebook/Instagram/WhatsApp) Meta
    // memblokir halaman izin OAuth sehingga blok persetujuan tidak muncul.
    assert.match(htmlSource, /id="connect-help"/);
    assert.match(htmlSource, /id="oauth-manual-link"/);
    assert.match(htmlSource, /id="connect-copy-link"/);

    assert.match(source, /IN_APP_BROWSER_PATTERNS/);
    assert.match(source, /detectInAppBrowser/);
    assert.match(source, /renderInAppBrowserHint\(\);/);
    // Tautan manual dipasang sebelum pengalihan otomatis dicoba.
    const connectBody = source.slice(source.indexOf("async function connectFacebook"));
    assert.match(connectBody, /showConnectHelp\(\{/);
    assert.ok(
        connectBody.indexOf("showConnectHelp(") < connectBody.indexOf("window.location.assign("),
        "tautan manual harus tersedia sebelum window.location.assign"
    );
    assert.match(source, /copyCurrentPageLink/);
    assert.match(htmlSource, /social-publisher\.js\?v=/);
});

test("Master Switch mendukung 3 status (ACTIVE hijau, OFF merah, MAINTENANCE kuning) dan menjadi tanda indikator non-klik pada role USER", async () => {
    const lightCss = readFileSync(
        fileURLToPath(new URL("../admin-control/assets/css/social-publisher-light.css", import.meta.url)),
        "utf8"
    );

    // Struktur indikator Master Switch dan CSS warna hijau / merah / kuning di dark & light mode
    assert.match(htmlSource, /id="master-switch-block"/);
    assert.match(htmlSource, /id="master-status-badge"/);
    assert.match(htmlSource, /id="master-status-text"/);
    assert.match(htmlSource, /\.master-status-pill\{[^}]*pointer-events:none/);
    assert.match(htmlSource, /\.master-status-pill\.is-active\{[^}]*color:#5ef5b8/);
    assert.match(htmlSource, /\.master-status-pill\.is-off\{[^}]*color:#ff7a8d/);
    assert.match(htmlSource, /\.master-status-pill\.is-maintenance\{[^}]*color:#ffe066/);
    assert.match(lightCss, /\.master-status-pill\.is-active/);
    assert.match(lightCss, /\.master-status-pill\.is-off/);
    assert.match(lightCss, /\.master-status-pill\.is-maintenance/);

    // Verifikasi backend set-global-enabled & dashboard untuk 3 status (ACTIVE / MAINTENANCE / OFF)
    let persistedConfig = {
        id: true,
        global_enabled: true,
        global_status: "active",
        image_provider: "opus",
        image_model: "gpt-image-2.5-flare",
        updated_at: new Date().toISOString()
    };
    let currentCaller = { id: "admin-1", role: "ADMIN", status: "active" };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, options = {}) => {
        const url = String(input);
        if (url.endsWith("/auth/v1/user")) {
            return Response.json({ id: currentCaller.id, email: `${currentCaller.id}@example.com` });
        }
        if (url.includes("/rest/v1/profiles?")) {
            return Response.json([currentCaller]);
        }
        if (url.includes("/rest/v1/studio_medsos_access?")) {
            return Response.json([{
                user_id: currentCaller.id,
                is_active: true,
                duration_days: 30,
                started_at: new Date(Date.now() - 86400000).toISOString(),
                expires_at: new Date(Date.now() + 29 * 86400000).toISOString()
            }]);
        }
        if (url.includes("/rest/v1/social_publisher_config?on_conflict=id")) {
            const payload = JSON.parse(options.body);
            persistedConfig = { ...persistedConfig, ...payload };
            return Response.json([persistedConfig], { status: 201 });
        }
        if (url.includes("/rest/v1/social_publisher_config?")) {
            return Response.json([persistedConfig]);
        }
        if (url.includes("/storage/v1/bucket/")) {
            return Response.json({ id: "social-character-references", public: false });
        }
        return Response.json([]);
    };

    const env = {
        SUPABASE_URL: "https://supabase.example.co",
        SUPABASE_ANON_KEY: "anon-key",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
        META_APP_ID: "app-id",
        META_APP_SECRET: "app-secret",
        META_REDIRECT_URI: "https://example.com/callback",
        META_LOGIN_CONFIG_ID: "cfg-id",
        OPUS_AUTH_TOKEN: "test-opus",
        SOCIAL_TOKEN_ENCRYPTION_KEY: btoa("x".repeat(32))
    };

    async function callApi(method, url, body = undefined) {
        const res = {
            statusCode: 200,
            headers: {},
            body: null,
            setHeader(k, v) { this.headers[k] = v; },
            status(code) { this.statusCode = code; return this; },
            json(payload) { this.body = payload; return this; }
        };
        await socialPublisherHandler({
            method,
            url,
            headers: { authorization: "Bearer valid-token" },
            body,
            env
        }, res);
        return res;
    }

    try {
        // 1. Admin set MAINTENANCE -> globalEnabled false, globalStatus 'maintenance'
        const setMaint = await callApi("POST", "/api/social-publisher?action=set-global-enabled", { status: "maintenance" });
        assert.equal(setMaint.statusCode, 200);
        assert.equal(setMaint.body.globalEnabled, false);
        assert.equal(setMaint.body.globalStatus, "maintenance");

        // Role USER membaca dashboard -> melihat globalStatus 'maintenance' & canManageGlobalAutopublish false
        currentCaller = { id: "user-1", role: "USER", status: "active" };
        const userDashMaint = await callApi("GET", "/api/social-publisher?action=dashboard");
        assert.equal(userDashMaint.statusCode, 200);
        assert.equal(userDashMaint.body.globalStatus, "maintenance");
        assert.equal(userDashMaint.body.globalEnabled, false);
        assert.equal(userDashMaint.body.canManageGlobalAutopublish, false);

        // Role USER dilarang mengubah Master Switch
        const userAttempt = await callApi("POST", "/api/social-publisher?action=set-global-enabled", { status: "active" });
        assert.equal(userAttempt.statusCode, 403);

        // 2. Owner set OFF -> globalEnabled false, globalStatus 'off'
        currentCaller = { id: "owner-1", role: "OWNER", status: "active" };
        const setOff = await callApi("POST", "/api/social-publisher?action=set-global-enabled", { status: "off" });
        assert.equal(setOff.statusCode, 200);
        assert.equal(setOff.body.globalEnabled, false);
        assert.equal(setOff.body.globalStatus, "off");

        currentCaller = { id: "user-1", role: "USER", status: "active" };
        const userDashOff = await callApi("GET", "/api/social-publisher?action=dashboard");
        assert.equal(userDashOff.body.globalStatus, "off");
        assert.equal(userDashOff.body.globalEnabled, false);

        // 3. Admin set ACTIVE -> globalEnabled true, globalStatus 'active'
        currentCaller = { id: "admin-1", role: "ADMIN", status: "active" };
        const setActive = await callApi("POST", "/api/social-publisher?action=set-global-enabled", { status: "active" });
        assert.equal(setActive.statusCode, 200);
        assert.equal(setActive.body.globalEnabled, true);
        assert.equal(setActive.body.globalStatus, "active");

        currentCaller = { id: "user-1", role: "USER", status: "active" };
        const userDashActive = await callApi("GET", "/api/social-publisher?action=dashboard");
        assert.equal(userDashActive.body.globalStatus, "active");
        assert.equal(userDashActive.body.globalEnabled, true);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("5 blok fitur Studio Medsos tampil sebagai blok kecil kompak (termasuk KOLEKSI MUSIK) dan tampil blok penuh saat diklik, serta indikator Master Switch USER sesuai warna", async () => {
    // Pastikan judul berubah menjadi KOLEKSI MUSIK
    assert.match(htmlSource, /<h3 id="songs-title">KOLEKSI MUSIK<\/h3>/);
    assert.doesNotMatch(htmlSource, /Koleksi musik auto-play Kata-kata Mutiara/);

    const expectedCollapsibleSections = [
        ["outfit-card", "outfit-collapse-btn", "outfit-collapse-body", "outfit-collapse-chip-label"],
        ["songs-card", "songs-collapse-btn", "songs-collapse-body", "songs-collapse-chip-label"],
        ["posting-settings-card", "posting-settings-collapse-btn", "posting-settings-collapse-body", "posting-settings-collapse-chip-label"],
        ["manual-post-card", "manual-post-collapse-btn", "manual-post-collapse-body", "manual-post-collapse-chip-label"],
        ["schedule-card", "schedule-collapse-btn", "schedule-collapse-body", "schedule-collapse-chip-label"]
    ];

    for (const [cardId, btnId, bodyId] of expectedCollapsibleSections) {
        assert.match(htmlSource, new RegExp(`id="${cardId}"[^>]*class="card studio-collapsible"`));
        assert.match(htmlSource, new RegExp(`id="${btnId}"[^>]*aria-expanded="false"`));
        assert.match(htmlSource, new RegExp(`id="${bodyId}"[^>]*class="studio-collapse-body"[^>]*hidden`));
    }

    class MockElement {
        constructor(tagName = "div", id = "") {
            this.tagName = String(tagName).toUpperCase();
            this.id = id;
            this.className = "";
            this.textContent = "";
            this.value = "";
            this.type = "";
            this.hidden = false;
            this.disabled = false;
            this.checked = false;
            this.style = {};
            this.dataset = {};
            this.attributes = new Map();
            this.children = [];
            this.parentElement = null;
            this.listeners = new Map();
            this._innerHTML = "";
            this.classList = {
                add: (...names) => {
                    const set = new Set(this.className.split(/\s+/).filter(Boolean));
                    for (const n of names) set.add(n);
                    this.className = [...set].join(" ");
                },
                remove: (...names) => {
                    const set = new Set(this.className.split(/\s+/).filter(Boolean));
                    for (const n of names) set.delete(n);
                    this.className = [...set].join(" ");
                },
                toggle: (name, force) => {
                    const set = new Set(this.className.split(/\s+/).filter(Boolean));
                    const next = force === undefined ? !set.has(name) : Boolean(force);
                    if (next) set.add(name); else set.delete(name);
                    this.className = [...set].join(" ");
                },
                contains: (name) => this.className.split(/\s+/).includes(name)
            };
        }
        get innerHTML() { return this._innerHTML; }
        set innerHTML(html) { this._innerHTML = String(html); this.children = []; }
        append(...nodes) {
            for (const node of nodes) {
                const el = typeof node === "string" ? Object.assign(new MockElement("#text"), { textContent: node }) : node;
                el.parentElement = this;
                this.children.push(el);
            }
        }
        add(option) { this.append(option); }
        replaceChildren(...nodes) { this.children = []; this._innerHTML = ""; this.append(...nodes); }
        setAttribute(k, v) { this.attributes.set(k, String(v)); }
        getAttribute(k) { return this.attributes.get(k) ?? null; }
        removeAttribute(k) { this.attributes.delete(k); }
        addEventListener(type, fn) {
            if (!this.listeners.has(type)) this.listeners.set(type, []);
            this.listeners.get(type).push(fn);
        }
        dispatchEvent(event) {
            const evt = { target: event.target || this, currentTarget: this, preventDefault() {}, ...event };
            for (const fn of this.listeners.get(evt.type) || []) fn(evt);
        }
        closest() { return null; }
        scrollIntoView() {}
        focus() {}
    }

    const elementsById = new Map();
    for (const [, id] of htmlSource.matchAll(/\bid="([^"]+)"/g)) {
        if (!elementsById.has(id)) elementsById.set(id, new MockElement("div", id));
    }
    elementsById.get("runs-per-page").value = "10";
    elementsById.get("interval-minutes").value = "1440";
    elementsById.get("usage-tutorial").hidden = true;
    for (const [, btnId, bodyId, chipId] of expectedCollapsibleSections) {
        elementsById.get(btnId).setAttribute("aria-expanded", "false");
        elementsById.get(bodyId).hidden = true;
        elementsById.get(chipId).textContent = "Buka";
    }

    let simulatedMasterStatus = "maintenance";
    const intervalIds = [];
    const prevGlobals = {
        window: globalThis.window,
        document: globalThis.document,
        location: globalThis.location,
        history: globalThis.history,
        Option: globalThis.Option,
        Image: globalThis.Image,
        fetch: globalThis.fetch
    };

    globalThis.window = {
        GENZ_SUPABASE: {
            auth: {
                async getSession() {
                    return { data: { session: { access_token: "valid-token" } }, error: null };
                }
            }
        },
        localStorage: { getItem: () => null, setItem() {} },
        innerHeight: 800,
        scrollY: 0,
        scrollTo() {},
        addEventListener() {},
        setInterval(fn, ms) {
            const id = setInterval(fn, ms);
            intervalIds.push(id);
            return id;
        }
    };
    globalThis.document = {
        addEventListener() {},
        getElementById: id => elementsById.get(id) || null,
        createElement: tag => new MockElement(tag),
        createTextNode: text => Object.assign(new MockElement("#text"), { textContent: String(text) }),
        querySelector: () => new MockElement("main")
    };
    globalThis.location = { search: "", pathname: "/admin-control/social-publisher.html" };
    globalThis.history = { replaceState() {} };
    globalThis.Option = class Option extends MockElement {
        constructor(label = "", val = "") {
            super("option");
            this.textContent = label;
            this.value = val;
        }
    };
    globalThis.Image = class Image extends MockElement {
        constructor() { super("img"); }
    };

    globalThis.fetch = async (input) => {
        const urlStr = String(input);
        if (urlStr.includes("action=studio-access-status")) {
            return Response.json({
                success: true,
                access: {
                    user_id: "user-1",
                    is_active: true,
                    duration_days: 30,
                    started_at: new Date(Date.now() - 86400000).toISOString(),
                    expires_at: new Date(Date.now() + 29 * 86400000).toISOString()
                }
            });
        }
        if (urlStr.includes("action=dashboard")) {
            return Response.json({
                success: true,
                characters: [{ id: "char-1", name: "Karakter Uji" }],
                pages: [{ id: "page-1", page_name: "Page Uji" }],
                schedules: [
                    {
                        id: "sched-on",
                        character_id: "char-1",
                        page_connection_id: "page-1",
                        interval_minutes: 60,
                        next_run_at: new Date(Date.now() + 1800000).toISOString(),
                        aspect_ratio: "9:16",
                        enabled: true,
                        autopublish_enabled: true
                    },
                    {
                        id: "sched-off",
                        character_id: "char-1",
                        page_connection_id: "page-1",
                        interval_minutes: 120,
                        next_run_at: new Date(Date.now() + 3600000).toISOString(),
                        aspect_ratio: "9:16",
                        enabled: false,
                        autopublish_enabled: false
                    }
                ],
                runs: [],
                runsPagination: { page: 1, perPage: 10, total: 0, totalPages: 1 },
                outfits: [],
                autopublishEnabled: true,
                globalEnabled: simulatedMasterStatus === "active",
                globalStatus: simulatedMasterStatus,
                canManageGlobalAutopublish: false,
                postingSettings: { caption_template: "Halo", external_link: "" },
                config: {
                    metaOAuthConfigured: true,
                    imageProvider: "opus",
                    imageApiConfigured: true,
                    captionApiConfigured: true,
                    tokenEncryptionConfigured: true,
                    referenceStorageConfigured: true,
                    outfitLibraryReady: true
                }
            });
        }
        return Response.json({ success: true, songs: [], pricing: {} });
    };

    try {
        await import(`../admin-control/social-publisher.js?collapsible-test=${Date.now()}`);
        await new Promise(resolve => setTimeout(resolve, 40));

        const masterBlock = elementsById.get("master-switch-block");
        const masterBadge = elementsById.get("master-status-badge");
        const masterText = elementsById.get("master-status-text");
        const masterControls = elementsById.get("master-switch-controls");
        const refreshBtn = elementsById.get("refresh");

        // Role USER saat Admin menyetel MAINTENANCE -> MAINTENANCE warna kuning, kontrol tersembunyi
        assert.equal(masterBlock.getAttribute("data-master-role"), "user");
        assert.equal(masterBlock.getAttribute("data-master-status"), "maintenance");
        assert.equal(masterText.textContent, "MAINTENANCE");
        assert.equal(masterBadge.className, "master-status-pill is-maintenance");
        assert.equal(masterControls.hidden, true);

        // Role USER saat Admin menyetel ACTIVE -> ACTIVE warna hijau
        simulatedMasterStatus = "active";
        refreshBtn.dispatchEvent({ type: "click", target: refreshBtn });
        await new Promise(resolve => setTimeout(resolve, 35));
        assert.equal(masterBlock.getAttribute("data-master-status"), "active");
        assert.equal(masterText.textContent, "ACTIVE");
        assert.equal(masterBadge.className, "master-status-pill is-active");
        assert.equal(masterControls.hidden, true);

        // Role USER saat Admin menyetel OFF -> OFF warna merah
        simulatedMasterStatus = "off";
        refreshBtn.dispatchEvent({ type: "click", target: refreshBtn });
        await new Promise(resolve => setTimeout(resolve, 35));
        assert.equal(masterBlock.getAttribute("data-master-status"), "off");
        assert.equal(masterText.textContent, "OFF");
        assert.equal(masterBadge.className, "master-status-pill is-off");
        assert.equal(masterControls.hidden, true);

        // Klik masing-masing dari 5 blok kecil -> tampil blok penuh, klik lagi -> kembali blok kecil
        for (const [cardId, btnId, bodyId, chipId] of expectedCollapsibleSections) {
            const card = elementsById.get(cardId);
            const btn = elementsById.get(btnId);
            const body = elementsById.get(bodyId);
            const chip = elementsById.get(chipId);

            assert.equal(body.hidden, true, `${cardId} harus tertutup sebagai blok kecil saat awal`);
            assert.equal(card.classList.contains("is-expanded"), false);

            btn.dispatchEvent({ type: "click", target: btn });
            assert.equal(body.hidden, false, `${cardId} harus tampil blok penuh setelah diklik`);
            assert.equal(card.classList.contains("is-expanded"), true);
            assert.equal(btn.getAttribute("aria-expanded"), "true");
            assert.equal(chip.textContent, "Tutup");

            btn.dispatchEvent({ type: "click", target: btn });
            assert.equal(body.hidden, true, `${cardId} harus kembali menjadi blok kecil saat diklik ulang`);
            assert.equal(card.classList.contains("is-expanded"), false);
            assert.equal(btn.getAttribute("aria-expanded"), "false");
            assert.equal(chip.textContent, "Buka");
        }

        // Verifikasi tombol Autopost: ON berwarna hijau terang (.autopost-on) & Autopost: OFF berwarna merah terang (.autopost-off)
        const schedulesListEl = elementsById.get("schedules-list");
        assert.equal(schedulesListEl.children.length, 2, "2 kartu jadwal harus ter-render di blok Jadwal autopost aktif");
        const firstActions = schedulesListEl.children[0].children[1];
        const secondActions = schedulesListEl.children[1].children[1];
        const autopostOnBtn = firstActions.children[1];
        const autopostOffBtn = secondActions.children[1];

        assert.equal(autopostOnBtn.textContent, "Autopost: ON");
        assert.match(autopostOnBtn.className, /\bautopost-on\b/, "Tombol Autopost: ON harus memakai class hijau terang autopost-on");
        assert.doesNotMatch(autopostOnBtn.className, /\bdanger\b/, "Tombol Autopost: ON tidak boleh lagi memakai class merah danger");
        assert.equal(autopostOnBtn.dataset.autopostState, "on");

        assert.equal(autopostOffBtn.textContent, "Autopost: OFF");
        assert.match(autopostOffBtn.className, /\bautopost-off\b/, "Tombol Autopost: OFF harus memakai class merah terang autopost-off");
        assert.doesNotMatch(autopostOffBtn.className, /\bgreen\b/, "Tombol Autopost: OFF tidak boleh lagi memakai class hijau green");
        assert.equal(autopostOffBtn.dataset.autopostState, "off");
    } finally {
        for (const id of intervalIds) clearInterval(id);
        Object.assign(globalThis, prevGlobals);
    }
});

test("Jadwal autopost aktif tampil pada blok mandiri baru tepat di atas blok riwayat, tidak lagi di dalam blok Buat jadwal autopost, dengan warna hijau terang ON dan merah terang OFF", () => {
    const scheduleCardMatch = htmlSource.match(
        /<section id="schedule-card"[\s\S]*?<\/section>/
    );
    assert.ok(scheduleCardMatch, "Blok #schedule-card wajib ada");
    assert.doesNotMatch(
        scheduleCardMatch[0],
        /id="schedules-list"/,
        "#schedules-list tidak boleh lagi berada di dalam blok Buat jadwal autopost (#schedule-card)"
    );

    const activeSectionMatch = htmlSource.match(
        /<section[^>]*id="active-schedules-section"[\s\S]*?<\/section>/
    );
    assert.ok(activeSectionMatch, "Blok baru #active-schedules-section wajib ada");
    assert.match(activeSectionMatch[0], /class="card wide"/);
    assert.match(activeSectionMatch[0], /id="active-schedules-title"/);
    assert.match(activeSectionMatch[0], /id="active-schedules-badge"/);
    assert.match(activeSectionMatch[0], /id="schedules-list"/);

    const scheduleCardEndIndex = htmlSource.indexOf(scheduleCardMatch[0]) + scheduleCardMatch[0].length;
    const activeSectionIndex = htmlSource.indexOf('id="active-schedules-section"');
    const runsSectionIndex = htmlSource.indexOf('id="runs-section"');

    assert.ok(
        activeSectionIndex > scheduleCardEndIndex,
        "Blok #active-schedules-section harus berada setelah blok #schedule-card ditutup"
    );
    assert.ok(
        activeSectionIndex < runsSectionIndex,
        "Blok #active-schedules-section harus berada tepat di atas blok riwayat (#runs-section)"
    );

    const lightCssSource = readFileSync(
        fileURLToPath(new URL("../admin-control/assets/css/social-publisher-light.css", import.meta.url)),
        "utf8"
    );
    assert.match(htmlSource, /\.btn\.autopost-on:not\(\.is-confirming\)\{[^}]*#39ff71/);
    assert.match(htmlSource, /\.btn\.autopost-off:not\(\.is-confirming\)\{[^}]*#ef4444/);
    assert.match(lightCssSource, /\.btn\.autopost-on:not\(\.is-confirming\)[\s\S]*?#39f076/);
    assert.match(lightCssSource, /\.btn\.autopost-off:not\(\.is-confirming\)[\s\S]*?#e11d2f/);
});
