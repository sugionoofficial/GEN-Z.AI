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
