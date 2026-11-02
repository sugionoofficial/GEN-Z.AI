import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

/* =========================================================
   BLACK BOX // STUDIO MEDSOS — TATA LETAK KONEKSI AKUN
   ---------------------------------------------------------
   Yang dijaga di sini:
   1. Facebook Page, YouTube, dan TikTok berada di SATU blok
      koneksi yang sama, sejajar sebagai kartu sejenis —
      tidak berpencar di halaman.
   2. Panel tutorial penuh berada di bawah deretan kartu
      (tetap hidden default) — tidak memaksa kartu Facebook
      jadi tinggi.
   3. Tampilan HP: kartu koneksi menumpuk 1 kolom.
   4. Kartu karakter jadi full-width setelah kartu Facebook
      pindah, tanpa penomoran basi.
   ========================================================= */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(path.join(ROOT, "admin-control/social-publisher.html"), "utf8");
const publisherSource = readFileSync(path.join(ROOT, "admin-control/social-publisher.js"), "utf8");

test("kartu Facebook Page sejajar dengan YouTube & TikTok di blok koneksi yang sama", () => {
    const sectionStart = html.indexOf('id="social-connections"');
    assert.notEqual(sectionStart, -1, "blok koneksi wajib ada");
    const sectionEnd = html.indexOf("</section>", sectionStart);
    const section = html.slice(sectionStart, sectionEnd);

    assert.match(section, /id="page-connections"/, "daftar Facebook Page wajib di dalam blok koneksi");
    assert.match(section, /id="connect-page"/, "tombol Hubungkan Facebook wajib di dalam blok koneksi");
    assert.match(section, /id="youtube-accounts"/, "kartu YouTube tetap di blok koneksi");
    assert.match(section, /id="tiktok-accounts"/, "kartu TikTok tetap di blok koneksi");

    /* Urutan kartu sejenis: Facebook -> YouTube -> TikTok */
    const fbPos = section.indexOf("<strong>Facebook Page</strong>");
    const ytPos = section.indexOf("<strong>YouTube</strong>");
    const ttPos = section.indexOf("<strong>TikTok</strong>");
    assert.ok(fbPos !== -1 && ytPos !== -1 && ttPos !== -1);
    assert.ok(fbPos < ytPos && ytPos < ttPos, "urutan kartu: Facebook, YouTube, TikTok");
});

test("kartu Facebook tidak lagi ada di grid alur kerja bawah", () => {
    const gridStart = html.indexOf('<div class="grid"');
    assert.notEqual(gridStart, -1);
    const gridEnd = html.indexOf('id="runs-section"', gridStart);
    const gridRegion = html.slice(gridStart, gridEnd);

    assert.doesNotMatch(
        gridRegion,
        /id="connect-page"|id="page-connections"/,
        "kartu Hubungkan Facebook wajib pindah ke blok koneksi atas"
    );
    assert.doesNotMatch(gridRegion, />1\. Hubungkan Facebook Page</, "penomoran basi dihapus");
    assert.match(gridRegion, /class="card wide" aria-labelledby="character-title"/, "kartu karakter wajib full-width");
    assert.doesNotMatch(gridRegion, />2\. Tambah karakter referensi</, "penomoran basi dihapus");
});

test("tutorial penuh di bawah deretan kartu koneksi, tertutup secara default", () => {
    const sectionStart = html.indexOf('id="social-connections"');
    const sectionEnd = html.indexOf("</section>", sectionStart);
    const section = html.slice(sectionStart, sectionEnd);

    const gridEnd = section.indexOf("</div>", section.indexOf("id=\"tiktok-accounts\""));
    const tutorialPos = section.indexOf('id="usage-tutorial"');
    assert.ok(tutorialPos > gridEnd, "tutorial wajib SETELAH deretan kartu koneksi");
    assert.match(section, /<div id="usage-tutorial" class="tutorial-panel"[^>]*hidden>/, "tutorial wajib hidden default");
    assert.match(section, /Panduan Penggunaan Studio Medsos/, "isi tutorial utuh");
    assert.equal(section.match(/tutorial-num/g)?.length, 6, "enam langkah tutorial utuh");
    assert.doesNotMatch(section, /2\. Tambah karakter referensi</, "rujukan penomoran lama diperbarui");
    assert.doesNotMatch(section, /4\. Buat jadwal autopost</, "rujukan penomoran lama diperbarui");
});

test("tampilan HP: kartu koneksi menumpuk 1 kolom dan tombol nyaman disentuh", () => {
    assert.match(
        html,
        /\.social-connections-grid\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/,
        "desktop: tiga kartu sejajar"
    );
    assert.match(
        html,
        /@media\(max-width:960px\)\{\n?\s*\.social-connections-grid\{grid-template-columns:1fr\}/,
        "layar sempit: menumpuk 1 kolom"
    );
    const mobileBlock = html.match(/@media\(max-width:768px\)\{#social-connections[^}]*\}[^}]*\}[^}]*\}/);
    assert.ok(mobileBlock, "aturan mobile khusus blok koneksi wajib ada");
    assert.match(mobileBlock[0], /social-connection-card\{padding:12px\}/);
    assert.match(mobileBlock[0], /\.actions \.btn\{flex:1 1 auto\}/, "tombol melebar di HP");
});

test("tombol Muat ulang blok koneksi menyegarkan Facebook juga", () => {
    assert.match(
        publisherSource,
        /\$\("refresh-social-connections"\)\?\.addEventListener\("click"[^}]*loadDashboard/,
        "listener social-publisher.js wajib memuat ulang dashboard (Facebook)"
    );
    assert.match(html, /social-publisher\.js\?v=tujuan-terpadu-20261103/, "pin publisher wajib dimutakhirkan");
});
