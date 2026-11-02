import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";

/* =========================================================
   BLACK BOX // STUDIO MEDSOS — CROSSPOST FB KE YOUTUBE/TIKTOK
   ---------------------------------------------------------
   Yang dijaga di sini:
   1. "Buat posting manual" dan "Buat jadwal autopost" (konten
      FB) punya pilihan "Arahkan juga ke medsos lain" berisi
      akun YouTube/TikTok yang terhubung.
   2. Crosspost berjalan di server: mp4 Kata-kata Mutiara yang
      sama diunggah ke bucket privat lalu diantrekan per akun
      (social_video_posts, cron claim yang mengeksekusi).
   3. SISTEM LANGGANAN: crosspost tanpa potong kredit.
   4. Blok composer 4 diberi penjelasan "khusus YouTube/TikTok"
      supaya tidak terkesan duplikat dengan blok FB.
   ========================================================= */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const crosspostSource = readFileSync(path.join(ROOT, "lib/social-publisher/crosspost.js"), "utf8");
const studioHtml = readFileSync(path.join(ROOT, "admin-control/social-publisher.html"), "utf8");
const publisherSource = readFileSync(path.join(ROOT, "admin-control/social-publisher.js"), "utf8");
const apiSource = readFileSync(path.join(ROOT, "api/social-publisher.js"), "utf8");
const cronSource = readFileSync(path.join(ROOT, "functions/_shared/social-publisher-cron.js"), "utf8");
const composerSource = readFileSync(path.join(ROOT, "admin-control/social-video-composer.js"), "utf8");
const connectionsSource = readFileSync(path.join(ROOT, "admin-control/social-video-connections.js"), "utf8");

const USER_ID = "99999999-9999-4999-8999-999999999999";
const ACCOUNT_YT = { id: "11111111-1111-4111-8111-111111111111", platform: "youtube" };
const ACCOUNT_TT = { id: "22222222-2222-4222-8222-222222222222", platform: "tiktok" };

/* ---------------------------------------------------------
   1. UNIT — lib/social-publisher/crosspost.js
   --------------------------------------------------------- */

async function buildCrosspostEnv({ accounts = [ACCOUNT_YT, ACCOUNT_TT] } = {}) {
    const calls = [];
    const fetchStub = async (url, options = {}) => {
        const target = String(url);
        const body = options.body ? (typeof options.body === "string" ? JSON.parse(options.body) : options.body) : {};
        calls.push({ url: target, method: options.method || "GET", body, headers: options.headers || {} });
        if (target.includes("/rest/v1/social_video_accounts")) {
            return { ok: true, status: 200, json: async () => accounts };
        }
        if (target.includes("/rest/v1/social_video_posts")) {
            return {
                ok: true,
                status: 200,
                json: async () => (Array.isArray(body) ? body.map((row, index) => ({ ...row, inserted: index })) : [])
            };
        }
        if (target.includes("/storage/v1/object/")) {
            return { ok: true, status: 200, json: async () => ({}) };
        }
        return { ok: true, status: 200, json: async () => ({}) };
    };
    globalThis.fetch = fetchStub;
    const mod = await import(pathToFileURL(path.join(ROOT, "lib/social-publisher/crosspost.js")).href);
    return { calls, sanitize: mod.sanitizeSocialVideoAccountIds, queue: mod.queueSocialVideoCrosspost, upload: mod.uploadCrosspostVideo };
}

const CONFIG = { url: "https://supabase-uji.co", serviceRoleKey: "service-key-uji" };

test("sanitizeSocialVideoAccountIds: hanya UUID valid, dedup, batas 10", async () => {
    const { sanitize } = await buildCrosspostEnv();
    assert.deepEqual(
        sanitize([" 11111111-1111-4111-8111-111111111111 ", "bukan-uuid", "", ACCOUNT_YT.id, "22222222-2222-4222-8222-222222222222"]),
        [ACCOUNT_YT.id, "22222222-2222-4222-8222-222222222222"]
    );
    assert.deepEqual(sanitize("bukan-array"), []);
    assert.deepEqual(sanitize(null), []);
    assert.equal(sanitize(Array.from({ length: 15 }, (_, index) => `aaaaaaaa-aaaa-4aaa-8aaa-${String(index).padStart(12, "0")}`)).length, 10, "maksimal 10 akun per permintaan");
});

test("queueSocialVideoCrosspost: unggah ke bucket privat lalu antrekan per akun status scheduled tanpa kredit", async () => {
    const { calls, queue } = await buildCrosspostEnv();
    const videoBytes = new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112]);

    const result = await queue({
        config: CONFIG,
        userId: USER_ID,
        accountIds: [ACCOUNT_YT.id, "bukan-uuid", ACCOUNT_TT.id],
        videoBytes,
        title: "Kata Mutiara Hari Ini",
        caption: "Hidup itu sederhana.",
        fileName: "quote-run-1.mp4"
    });

    assert.equal(result.queued, 2, "dua akun valid wajib terantre");
    assert.match(result.videoRef, /^supabase-private:\/\/user-uploads\/social-video\//, "video wajib masuk bucket privat user-uploads");

    const uploadCall = calls.find(call => call.url.includes("/storage/v1/object/"));
    assert.ok(uploadCall, "bytes video wajib diunggah ke storage");
    assert.equal(uploadCall.method, "POST");
    assert.match(uploadCall.url, /storage\/v1\/object\/user-uploads\/social-video\//, "video wajib di path social-video bucket user-uploads");

    const insertCall = calls.find(call => call.url.includes("/rest/v1/social_video_posts"));
    assert.ok(insertCall, "wajib menyisipkan baris social_video_posts");
    assert.equal(Array.isArray(insertCall.body), true);
    assert.equal(insertCall.body.length, 2);
    for (const row of insertCall.body) {
        assert.equal(row.user_id, USER_ID);
        assert.ok([ACCOUNT_YT.id, ACCOUNT_TT.id].includes(row.account_id));
        assert.equal(row.status, "scheduled", "crosspost wajib lewat antrean cron claim");
        assert.equal(row.video_source_type, "upload");
        assert.equal(row.credit_cost, 0, "SISTEM LANGGANAN: crosspost tanpa potong kredit");
        assert.equal(row.attempts, 0);
        assert.equal(row.video_ref, result.videoRef);
        assert.ok(Date.parse(row.scheduled_for) <= Date.now() + 2000, "scheduled_for = now (diproses cron ±1 menit)");
    }
});

test("queueSocialVideoCrosspost: hanya akun aktif milik user, dan nol pilihan = tanpa tulis", async () => {
    const { calls, queue } = await buildCrosspostEnv({ accounts: [ACCOUNT_YT] });
    const result = await queue({
        config: CONFIG,
        userId: USER_ID,
        accountIds: [ACCOUNT_YT.id, ACCOUNT_TT.id],
        videoBytes: new Uint8Array([1, 2, 3])
    });
    assert.equal(result.queued, 1, "akun milik user lain wajib ditolak");

    const empty = await queue({
        config: CONFIG,
        userId: USER_ID,
        accountIds: [],
        videoBytes: new Uint8Array([1, 2, 3])
    });
    assert.equal(empty.queued, 0);
    assert.equal(calls.filter(call => call.url.includes("/rest/v1/social_video_posts")).length, 1, "tanpa pilihan = tanpa insert");
});

/* ---------------------------------------------------------
   2. STRUKTUR — FORM FB PUNYA PILIHAN YOUTUBE/TIKTOK
   --------------------------------------------------------- */

test("Buat posting manual & Buat jadwal autopost punya pilihan arah YouTube/TikTok", () => {
    assert.match(studioHtml, /id="manual-social-target"[\s\S]*?aria-label="Akun YouTube\/TikTok tambahan"/, "form manual wajib punya pilihan medsos lain");
    assert.match(studioHtml, /id="schedule-social-target"[\s\S]*?aria-label="Akun YouTube\/TikTok tambahan"/, "form jadwal wajib punya pilihan medsos lain");
    assert.match(studioHtml, /Arahkan juga ke medsos lain \(opsional\)/);
    /* Hanya relevan untuk konten video. */
    assert.match(studioHtml, /khusus konten <strong>video<\/strong>/);
});

test("blok composer 4 dijelaskan khusus YouTube/TikTok supaya tidak terkesan duplikat", () => {
    const blockStart = studioHtml.indexOf("4. Terbitkan (khusus YouTube");
    assert.notEqual(blockStart, -1, "judul blok 4 wajib menyebut khusus YouTube/TikTok");
    const block = studioHtml.slice(blockStart, blockStart + 1200);
    assert.match(block, /khusus memproses posting YouTube\/TikTok/, "penjelasan fungsi blok 4 wajib ada");
    assert.match(block, /khusus konten Facebook/, "penjelasan beda dengan blok FB wajib ada");
});

test("publisher kirim pilihan crosspost: body jadwal + header post manual", () => {
    assert.match(publisherSource, /social_video_account_ids: isQuote \? selectedSocialAccountIds\("schedule-social-target"\) : \[\]/, "submitSchedule wajib mengirim pilihan crosspost (mode quote)");
    assert.match(publisherSource, /X-Social-Video-Accounts/, "post manual wajib mengirim header crosspost");
    assert.match(publisherSource, /socialTargetIds = isQuoteVideo \? selectedSocialAccountIds\("manual-social-target"\) : \[\]/, "post manual hanya crosspost saat konten video");
    assert.match(publisherSource, /renderSocialTargetOptions\(\)/, "pilihan crosspost wajib diisi dari akun terhubung");
    /* Mode non-video menyembunyikan pilihan (foto karakter tidak bisa ke YT/TT). */
    assert.match(publisherSource, /modeHidden/);
});

test("server proses crosspost: API manual + cron jadwal, kolom DB dengan fallback", () => {
    assert.match(apiSource, /queueSocialVideoCrosspost/, "API manual wajib mengantrekan crosspost");
    assert.match(apiSource, /x-social-video-accounts/i, "API membaca header target crosspost");
    assert.match(apiSource, /isQuoteVideo && socialVideoTargetIds\.length/, "crosspost manual hanya untuk video Kata-kata Mutiara");
    assert.match(apiSource, /social_video_account_ids/, "API menyimpan pilihan jadwal");
    assert.match(apiSource, /isMissingSocialVideoTargetsColumn/, "wajib ada fallback saat migration belum dijalankan");

    assert.match(cronSource, /queueSocialVideoCrosspost/, "cron jadwal wajib mengantrekan crosspost");
    assert.match(cronSource, /social_video_account_ids/, "cron membaca kolom target jadwal");
    assert.match(cronSource, /postMode === "quote" && storyMp4Bytes/, "crosspost cron hanya untuk video Kata-kata Mutiara");
    assert.match(cronSource, /SOCIAL_TARGET_SCHEDULE_COLUMNS/, "cron memilih kolom target dengan tangga fallback");

    /* Migration tersedia dan idempotent. */
    const migration = readFileSync(path.join(ROOT, "supabase/social-schedule-social-video-targets.sql"), "utf8");
    assert.match(migration, /add column if not exists social_video_account_ids uuid\[\]/);
});

/* ---------------------------------------------------------
   3. LOGO MEDSOS DI SETIAP BARIS JADWAL AKTIF
   --------------------------------------------------------- */

test("Jadwal autopost aktif membawa logo medsos (FB selalu, + YT/TT bila crosspost)", () => {
    assert.match(publisherSource, /title\.append\(socialVideoPlatformLogo\("facebook"\)\)/, "baris jadwal wajib diawali logo Facebook");
    assert.match(publisherSource, /extraLogo\.title = `Crosspost juga ke/, "logo crosspost wajib beri keterangan");
    assert.match(publisherSource, /crosspost \$\{scheduleSocialPlatforms/, "detail jadwal wajib menyebut target crosspost");
});

/* ---------------------------------------------------------
   4. PUTUSKAN TANPA DIALOG MENGGANTUNG (BUG HP)
   --------------------------------------------------------- */

test("Putuskan YouTube/TikTok: konfirmasi 2-klik inline, tanpa window.confirm sebagai jalur utama", () => {
    assert.match(connectionsSource, /GENZInlineConfirm\.request\(disconnect/, "wajib pakai helper inline yang sama dengan halaman");
    assert.match(connectionsSource, /label: "Konfirmasi putus"/);
    /* Fallback TIDAK boleh memutus tanpa konfirmasi. */
    assert.match(connectionsSource, /Modul konfirmasi gagal termuat[\s\S]*?window\.confirm/, "fallback wajib lewat jalur window.confirm, bukan langsung putus");
    const clickHandler = connectionsSource.slice(
        connectionsSource.indexOf("disconnect.addEventListener"),
        connectionsSource.indexOf("item.appendChild(info)")
    );
    assert.match(clickHandler, /request\(disconnect[\s\S]*?skipConfirm: true\s*\}\);\s*return;/, "jalur inline wajib lewat disconnectAccount tanpa konfirmasi ulang");
    assert.doesNotMatch(clickHandler, /\{\s*skipConfirm: true\s*\}\);\s*return;\s*}\s*void disconnectAccount\(account, \{ skipConfirm: true \}/, "fallback wajib tanpa skipConfirm");
});

/* ---------------------------------------------------------
   5. COMPOSER — PENJELASAN & KONSISTENSI
   --------------------------------------------------------- */

test("composer tile akun tetap render disabled mengikuti state busy", () => {
    assert.match(composerSource, /checkbox\.disabled = state\.busy/);
    assert.match(composerSource, /input\.disabled = busy/, "setBusy wajib membuka/mengunci checkbox akun");
});
