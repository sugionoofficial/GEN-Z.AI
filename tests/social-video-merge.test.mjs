import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { mergeRunsAndPosts, runTimeMs, socialPostTimeMs } from "../admin-control/social-video-merge.js";

/* =========================================================
   BLACK BOX // RIWAYAT TERPADU FACEBOOK + YOUTUBE/TIKTOK
   ---------------------------------------------------------
   Yang dijaga di sini:
   1. Riwayat Facebook dan status posting YouTube/TikTok
      menyatu dalam SATU daftar urut waktu (bukan blok
      terpisah yang di-pin).
   2. Setiap halaman pagination hanya menampilkan post
      YouTube/TikTok pada jendela waktunya — tidak dobel.
   3. Tanpa run Facebook, semua post tetap tampil.
   ========================================================= */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publisherSource = readFileSync(path.join(ROOT, "admin-control/social-publisher.js"), "utf8");
const studioHtml = readFileSync(path.join(ROOT, "admin-control/social-publisher.html"), "utf8");

const T = iso => Date.parse(iso);
const run = (id, at, extra = {}) => ({ id, status: "posted", created_at: at, scheduled_for: at, ...extra });
const post = (id, at, extra = {}) => ({ id, platform: "youtube", status: "published", published_at: at, scheduled_for: at, created_at: at, ...extra });

test("urutan hasil gabungan menurun berdasarkan waktu, semua jenis bercampur", () => {
    const merged = mergeRunsAndPosts(
        [run("fb1", "2026-11-02T10:00:00Z"), run("fb2", "2026-11-02T08:00:00Z")],
        [post("yt1", "2026-11-02T12:00:00Z"), post("tt1", "2026-11-02T09:00:00Z")],
        1, 1
    );

    assert.deepEqual(
        merged.map(row => row.type === "run" ? row.run.id : row.post.id),
        ["yt1", "fb1", "tt1", "fb2"],
        "YouTube, FB, TikTok, FB — urutan waktu menurun"
    );
    assert.equal(merged[0].type, "social");
    assert.equal(merged[1].type, "run");
});

test("halaman 1 menampung post yang lebih baru dari semua run", () => {
    const runs = [run("fb1", "2026-11-02T10:00:00Z"), run("fb2", "2026-11-02T08:00:00Z")];
    const newer = post("yt-baru", "2026-11-02T15:00:00Z");

    const page1 = mergeRunsAndPosts(runs, [newer], 1, 3);
    assert.ok(page1.some(row => row.type === "social" && row.post.id === "yt-baru"), "post terbaru wajib di halaman 1");

    const page2 = mergeRunsAndPosts(runs, [newer], 2, 3);
    assert.equal(page2.some(row => row.type === "social"), false, "tidak boleh dobel di halaman 2");
});

test("halaman tengah hanya menampilkan post di dalam jendela waktunya", () => {
    const runs = [
        run("p2a", "2026-11-01T10:00:00Z"),
        run("p2b", "2026-11-01T08:00:00Z")
    ];
    const inside = post("yt-dalam", "2026-11-01T09:00:00Z");
    const outside = post("yt-luar", "2026-11-02T09:00:00Z");

    const page2 = mergeRunsAndPosts(runs, [inside, outside], 2, 3);
    assert.ok(page2.some(row => row.type === "social" && row.post.id === "yt-dalam"));
    assert.equal(page2.some(row => row.type === "social" && row.post.id === "yt-luar"), false);
});

test("halaman terakhir menampung post yang lebih lama dari semua run", () => {
    const runs = [run("fb1", "2026-11-02T10:00:00Z")];
    const older = post("yt-lama", "2026-10-01T09:00:00Z");

    const lastPage = mergeRunsAndPosts(runs, [older], 5, 5);
    assert.ok(lastPage.some(row => row.type === "social" && row.post.id === "yt-lama"), "post lama wajib tampil di halaman terakhir");

    const page1 = mergeRunsAndPosts(runs, [older], 1, 5);
    assert.equal(page1.some(row => row.type === "social"), false, "tidak boleh dobel di halaman 1");
});

test("tanpa run Facebook, semua post tampil dan pesan kosong hanya bila dua-duanya kosong", () => {
    const all = mergeRunsAndPosts([], [post("yt1", "2026-11-02T12:00:00Z"), post("tt1", "2026-11-01T09:00:00Z")], 1, 1);
    assert.equal(all.length, 2);

    assert.deepEqual(mergeRunsAndPosts([], [], 1, 1), []);
});

test("waktu pembanding: post memakai jam tayang, run memakai jadwal/pembuatan", () => {
    assert.equal(socialPostTimeMs({ published_at: "2026-11-02T13:28:03Z", scheduled_for: "2026-11-02T12:00:00Z" }), T("2026-11-02T13:28:03Z"));
    assert.equal(socialPostTimeMs({ scheduled_for: "2026-11-03T09:00:00Z", created_at: "2026-11-02T08:00:00Z" }), T("2026-11-03T09:00:00Z"));
    assert.equal(runTimeMs({ scheduled_for: "2026-11-02T10:00:00Z", created_at: "2026-11-01T10:00:00Z" }), T("2026-11-02T10:00:00Z"));
    assert.equal(socialPostTimeMs({}), 0);
});

/* ---------------------------------------------------------
   Integrasi halaman: blok terpisah dihapus, renderer pindah
   ke daftar riwayat.
   --------------------------------------------------------- */

test("riwayat YouTube/TikTok menyatu di runs-list, bukan sub-blok terpisah", () => {
    assert.doesNotMatch(
        studioHtml,
        /social-video-history|svh-list|svh-refresh/,
        "sub-blok terpisah wajib dihapus dari HTML"
    );

    assert.match(publisherSource, /mergeRunsAndPosts\(/, "renderRuns wajib memakai helper penggabung");
    assert.match(publisherSource, /renderSocialVideoRow/, "renderer baris Social Video wajib ada di social-publisher.js");
    assert.match(publisherSource, /genz:social-video-posts-changed/, "wajib mendengarkan event pembaruan dari composer");
    assert.match(publisherSource, /loadSocialVideoPosts\(\)/, "status Social Video wajib dimuat saat dashboard dimuat");

    /* Dua daftar wajib render ke container yang sama (#runs-list). */
    const renderRunsStart = publisherSource.indexOf("function renderRuns(");
    const renderRunsEnd = publisherSource.indexOf("renderRunsPaginationControls();", renderRunsStart);
    const renderRunsBlock = publisherSource.slice(renderRunsStart, renderRunsEnd);
    assert.match(renderRunsBlock, /row\.type === "social"/, "baris social wajib dirender di loop yang sama");
    assert.match(renderRunsBlock, /mergedRows\.length/, "pesan kosong wajib memperhitungkan hasil gabungan");
});

test("logo medsos untuk riwayat ada di social-publisher.js dengan status jadwal/terbit", () => {
    assert.match(publisherSource, /M23\.498 6\.186/, "logo YouTube wajib ada");
    assert.match(publisherSource, /M12\.525\.02/, "logo TikTok wajib ada");
    assert.match(publisherSource, /svp-logo svp-logo--\$\{platform/, "logo wajib mengikuti platform baris");
    assert.match(publisherSource, /Jadwal tayang:/, "label jadwal wajib terbedakan");
    assert.match(publisherSource, /Tertayang:/, "label terbit wajib terbedakan");
    assert.match(publisherSource, /cancel_post/, "pembatalan jadwal dari riwayat wajib ada");
});

test("pin cache composer & publisher dimutakhirkan", () => {
    assert.match(studioHtml, /social-video-composer\.js\?v=svp-composer-20261103/);
    assert.match(studioHtml, /social-publisher\.js\?v=crosspost-targets-20261103/);
    assert.match(studioHtml, /satu daftar urut waktu/, "legenda daftar terpadu wajib ada di sub judul riwayat");
});
