import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/* =========================================================
   GUARD: HALAMAN BLACK BOX
   ---------------------------------------------------------
   Halaman ini adalah "control deck" berisi tombol pintas.
   Tujuan tes:
   1. Memakai navigasi bersama yang sama dengan halaman lain.
   2. Tombol AUTH OPUS LOGIN ada, kecil, hitam, font hijau
      terang, dan menunjuk endpoint OAuth Opus yang benar.
   3. Halaman gelap #000000 + mode cerah tetap terbaca.
   4. Folder black-box ikut di-build ke dist (kalau tidak,
      halaman 404 di production).
   ========================================================= */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relative) {
    return readFileSync(path.join(root, relative), "utf8");
}

const pageHtml = read(path.join("black-box", "index.html"));
const pageCss = read(path.join("black-box", "assets", "css", "black-box.css"));

test("black box memakai navigasi bersama dan memuat theme toggle situs", () => {
    assert.match(pageHtml, /<div id="navigation"><\/div>/);
    assert.match(pageHtml, /src="\/navigation\/navigation\.js\?v=[^"]+"/);
    assert.match(pageHtml, /href="\.\.\/assets\/css\/genz-premium\.css\?v=[^"]+"/);
    assert.match(pageHtml, /href="\.\/assets\/css\/black-box\.css\?v=[^"]+"/);

    // navigation.js yang dipakai halaman ini wajib meng-inject theme.js
    // (mode cerah/gelap + pratinjau mode HP) seperti halaman lain.
    const navigation = read(path.join("navigation", "navigation.js"));
    assert.match(navigation, /themeScript\.src = "\/assets\/js\/theme\.js\?v=[^"]+"/);
});

test("halaman black box terdaftar di menu navigasi admin", () => {
    const navigation = read(path.join("navigation", "navigation.js"));
    assert.match(
        navigation,
        /\{ label: "Black Box", href: "\/black-box\/index\.html", icon: ICONS\.blackBox \}/,
    );
    assert.match(navigation, /blackBox: `<svg viewBox="0 0 24 24"/);
});

test("tombol AUTH OPUS LOGIN kecil, hitam, font hijau terang, dan menuju endpoint OAuth", () => {
    const anchorMatch = pageHtml.match(
        /<a\b[^>]*class="bb-tile bb-tile--opus"[\s\S]*?<\/a>/,
    );
    assert.ok(anchorMatch, "expected tombol AUTH OPUS LOGIN (a.bb-tile--opus)");

    const anchor = anchorMatch[0];

    assert.match(
        anchor,
        /href="https:\/\/genzai\.genzai-f37\.workers\.dev\/api\/opus-oauth-login"/,
    );
    assert.match(anchor, /class="bb-tile-label">\s*AUTH OPUS LOGIN\s*<\/span>/);
    assert.match(anchor, /target="_blank"/);
    assert.match(anchor, /rel="noopener noreferrer"/);

    // Tombol: latar hitam pekat.
    assert.match(
        pageCss,
        /\.bb-tile\s*\{[^}]*background:\s*#000000;/s,
        "tombol wajib berlatar hitam pekat",
    );

    // Font hijau terang (#39ff71) untuk label tombol.
    assert.match(pageCss, /--bb-green:\s*#39ff71;/);
    assert.match(
        pageCss,
        /\.bb-tile-label\s*\{[^}]*color:\s*var\(--bb-green\);/s,
    );

    // Tombol tetap hitam + hijau terang walau halaman mode cerah.
    assert.match(
        pageCss,
        /html\[data-genz-theme="light"\] \.bb-tile--opus\s*\{[^}]*border-color:/s,
    );
    assert.doesNotMatch(
        pageCss,
        /html\[data-genz-theme="light"\] \.bb-tile\s*\{[^}]*background:\s*#fff/s,
        "tombol tidak boleh berubah menjadi putih di mode cerah",
    );
});

test("mode gelap memakai #000000 pekat dan mode cerah punya latar terang", () => {
    assert.match(pageHtml, /<meta\s+name="theme-color"\s+content="#000000"\s*>/);

    assert.match(pageCss, /html,\s*body\s*\{\s*background:\s*#000000;\s*\}/s);

    assert.match(
        pageCss,
        /html\[data-genz-theme="light"\] body\.bb-body\s*\{[^}]*background:[^}]*!important;/s,
    );
});

test("layout responsif desktop & HP serta menghormati reduced motion", () => {
    assert.match(
        pageCss,
        /@media \(max-width: 768px\)[\s\S]*?\.bb-grid\s*\{[^}]*grid-template-columns:\s*1fr;/,
        "HP wajib satu kolom penuh",
    );
    assert.match(
        pageCss,
        /grid-template-columns:\s*\n?\s*repeat\(auto-fill, minmax\(2[0-9]{2}px, 1fr\)\)/,
        "desktop memakai grid auto-fill untuk tombol berikutnya",
    );
    assert.match(pageCss, /@media \(max-width: 420px\)/);
    assert.match(pageCss, /@media \(prefers-reduced-motion: reduce\)/);
    assert.match(pageCss, /:focus-visible/);
});

test("slot kosong disiapkan agar tombol pintas berikutnya mudah ditambah", () => {
    assert.match(pageHtml, /class="bb-tile bb-tile--ghost"/);
    assert.match(pageHtml, /SLOT KOSONG/);
    assert.match(pageCss, /\.bb-tile--ghost\s*\{[^}]*border-style:\s*dashed;/s);
});

test("folder black-box ikut dibangun ke dist Cloudflare", () => {
    const buildScript = read(path.join("scripts", "build-cloudflare-pages.mjs"));
    assert.match(buildScript, /"black-box",/);
});

test("BLACK BOX hanya untuk admin/owner: tidak ada di menu role user", () => {
    const navigation = read(path.join("navigation", "navigation.js"));

    const userBlock = navigation.match(
        /const commonUserItems = \[([\s\S]*?)\];/,
    );
    const adminBlock = navigation.match(
        /const adminItems = \[([\s\S]*?)\];/,
    );

    assert.ok(userBlock, "expected commonUserItems");
    assert.ok(adminBlock, "expected adminItems");

    assert.doesNotMatch(
        userBlock[1],
        /Black Box/,
        "menu Black Box tidak boleh muncul untuk role user",
    );
    assert.match(
        adminBlock[1],
        /Black Box/,
        "menu Black Box wajib muncul untuk admin/owner",
    );
});

test("halaman BLACK BOX fail-closed: konten disembunyikan sampai role terverifikasi admin/owner", () => {
    // Gate harus aktif sejak HTML pertama kali dirender.
    assert.match(pageHtml, /<body class="bb-body bb-guard-pending">/);
    assert.match(pageCss, /body\.bb-guard-pending \.bb-page\s*\{[^}]*visibility:\s*hidden;/s);

    // Guard membaca role dari navigation.js (sumber kebenaran profiles.role).
    assert.match(pageHtml, /window\.GENZ_NAVIGATION_ROLE/);
    assert.match(pageHtml, /GENZNavigationReady/);
    assert.match(
        pageHtml,
        /function hasAdminAccess\(role\) \{\s*return role === "admin" \|\| role === "owner";/,
    );

    // Role lain mendapat layar AKSES DITOLAK lalu dialihkan ke dashboard.
    assert.match(pageHtml, /AKSES DITOLAK/);
    assert.match(pageHtml, /id="bbDenied"/);
    assert.match(pageHtml, /var DASHBOARD_PATH = "\/user\/dashboard\.html";/);
    assert.match(pageHtml, /window\.location\.replace\(DASHBOARD_PATH\)/);

    // Guard wajib dimuat SETELAH navigation.js mendefinisikan role global.
    const navigationIndex = pageHtml.indexOf(
        'src="/navigation/navigation.js?v=',
    );
    const guardIndex = pageHtml.indexOf("window.GENZ_NAVIGATION_ROLE");
    assert.ok(navigationIndex > -1 && guardIndex > navigationIndex);
});

test("seluruh teks panel diagnostik & vault BLACK BOX kontras tinggi (tidak memakai --bb-ink hitam di atas latar gelap)", () => {
    const diagSection = pageCss.slice(pageCss.indexOf(".bb-diag-panel"));
    assert.ok(diagSection.length > 0, "expected blok CSS .bb-diag-panel");
    assert.doesNotMatch(
        diagSection,
        /color:\s*var\(--bb-ink\)/,
        "elemen .bb-diag-* tidak boleh memakai --bb-ink (#000000) yang membuat tulisan hilang di atas latar gelap",
    );

    assert.match(pageCss, /\.bb-diag-title\s*\{[^}]*color:\s*#ffffff;/s);
    assert.match(pageCss, /\.bb-diag-input\s*\{[^}]*color:\s*#ffffff;/s);
    assert.match(
        pageCss,
        /html\[data-genz-theme="light"\] body \.bb-tile--opus \.bb-tile-label\s*\{\s*color:\s*var\(--bb-green\)\s*!important;/s,
    );
    assert.match(
        pageCss,
        /html\[data-genz-theme="light"\] body \.bb-tile--opus \.bb-tile-desc\s*\{\s*color:\s*#d6fbe4\s*!important;/s,
    );
});

test("panel diagnostik & vault BLACK BOX aman di layar HP tanpa teks atau input keluar blok", () => {
    assert.match(
        pageCss,
        /\.bb-page,\s*\.bb-page \*,\s*\.bb-page \*::before,\s*\.bb-page \*::after\s*\{\s*box-sizing:\s*border-box;\s*\}/s,
    );
    assert.match(pageCss, /\.bb-diag-panel\s*\{[^}]*max-width:\s*100%;[^}]*min-width:\s*0;/s);
    assert.match(pageCss, /\.bb-diag-card\s*\{[^}]*min-width:\s*0;[^}]*max-width:\s*100%;/s);
    assert.match(pageCss, /\.bb-diag-row\s*\{[^}]*min-width:\s*0;[^}]*max-width:\s*100%;/s);
    assert.match(pageCss, /\.bb-diag-input\s*\{[^}]*min-width:\s*0;[^}]*max-width:\s*100%;/s);
    assert.match(
        pageCss,
        /@media \(max-width: 720px\)[\s\S]*?\.bb-diag-grid\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\);/,
        "grid diagnostik HP wajib memakai minmax(0, 1fr) agar select/input panjang tidak melebar keluar panel",
    );
    assert.match(
        pageCss,
        /@media \(max-width: 720px\)[\s\S]*?\.bb-diag-form-row\s*\{\s*flex-direction:\s*column;/,
        "baris form HP wajib ditumpuk vertikal agar tombol & input tidak keluar kartu",
    );
});


