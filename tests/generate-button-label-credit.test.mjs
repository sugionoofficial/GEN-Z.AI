/* =========================================================
   GEN-Z.AI — TOMBOL GENERATE: LABEL "GENERATE" + KREDIT
   ---------------------------------------------------------
   Tombol utama di halaman /generate dulu berubah-ubah teks
   per mode ("Generate Video", "Generate Gambar", "Generate
   Audio", "Transcribe Audio"). Sekarang labelnya satu:
   GENERATE, dan badge di dalam tombol menunjukkan kredit
   yang AKAN DIPOTONG.

   Yang dijaga tes ini:
   1. HTML: label tombol = "Generate" (bukan "Generate Video").
   2. JS: tidak ada jalur yang menulis label lama lagi.
   3. Badge kredit memakai satuan "credit" + ikon ▼ + aria
      yang menyatakan pemotongan.
   4. Badge dihitung ulang saat mode berganti.
   5. CSS: label kapital, badge berbentuk pill, mode terang ada.
========================================================= */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = relative => readFileSync(path.join(root, relative), "utf8");

const html = read("generate/index.html");
const appJs = read("generate/assets/js/generate-app.js");
const uiJs = read("generate/assets/js/generate-ui.js");
const premiumCss = read("generate/assets/css/generate-premium.css");
const lightCss = read("generate/assets/css/generate-light.css");

/* =========================================================
   1. HTML
   ========================================================= */

test("label tombol utama adalah Generate, bukan Generate Video", () => {
    const buttonMatch = html.match(/<button[\s\S]*?id="generateButton"[\s\S]*?<\/button>/);
    assert.ok(buttonMatch, "#generateButton wajib ada");

    const button = buttonMatch[0];
    assert.match(button, /<span class="generate-button-label">Generate<\/span>/);
    assert.doesNotMatch(button, /generate-button-label">Generate Video</);
    assert.doesNotMatch(button, /generate-button-label">Generate Gambar</);
});

test("badge kredit di tombol memakai ikon ▼ dan satuan credit", () => {
    const buttonMatch = html.match(/<button[\s\S]*?id="generateButton"[\s\S]*?<\/button>/);
    const button = buttonMatch[0];

    assert.match(button, /id="generateCreditValue"[\s\S]*?-- credit/);
    assert.match(button, /generate-button-credit-icon[\s\S]*?▼/);
    assert.match(button, /aria-label="Kredit yang akan dipotong saat Generate"/);
    assert.doesNotMatch(button, /-- Credit/);
});

test("aset yang berubah memakai cache-buster baru", () => {
    assert.match(html, /generate-premium\.css\?v=[\w-]*generate-pill-credit-20261105/);
    assert.match(html, /generate-light\.css\?v=[\w-]*generate-pill-credit-20261105/);
    assert.match(html, /generate-app\.js\?v=[\w-]*generate-pill-credit-20261105/);
});

/* =========================================================
   2. JS — LABEL
   ========================================================= */

test("generate-app.js punya satu sumber label GENERATE", () => {
    assert.match(appJs, /const GENERATE_BUTTON_LABEL =\s*\n\s*"Generate";/);
    assert.match(appJs, /function syncGenerateButtonLabel\(/);

    /* syncModeSwitcherUI wajib memanggil helper ini */
    const switcher = appJs.slice(appJs.indexOf("function syncModeSwitcherUI()"));
    assert.match(switcher.slice(0, 6000), /syncGenerateButtonLabel\(\);/);
});

test("tidak ada lagi jalur JS yang menulis label mode lama", () => {
    for (const stale of [
        '"Generate Video"',
        '"Generate Gambar"',
        '"Generate Karakter Sheet"',
        '"Generate Musik AI"',
        '"Generate Sound Effect"',
        '"Generate Podcast AI"',
        '"Generate Voiceover"',
        '"Transcribe Audio"'
    ]) {
        assert.ok(!appJs.includes(stale), `label lama masih ditulis: ${stale}`);
    }
});

test("pemulihan setelah loading kembali ke Generate, bukan Generate Video", () => {
    const fallbacks = appJs.match(/"Generate"|"Generate Video"/g) || [];
    assert.ok(fallbacks.includes('"Generate"'));
    assert.ok(!appJs.includes('"Generate Video"'));

    /* runtime & ui juga tidak boleh memulihkan label lama */
    const runtimeJs = read("generate/assets/js/generate-runtime.js");
    assert.ok(!uiJs.includes('"Generate Video"'));
    assert.ok(!runtimeJs.includes('"Generate Video"'));
});

/* =========================================================
   3. JS — KREDIT
   ========================================================= */

test("format kredit memakai satuan credit yang konsisten", () => {
    assert.match(appJs, /return `\$\{formatted\} credit`;/);
    assert.match(appJs, /return "-- credit";/);
    assert.doesNotMatch(appJs, /return `\$\{formatted\} Credit`;/);

    assert.match(uiJs, /\)\} credit`;/);
    assert.match(uiJs, /"-- credit"/);
    assert.doesNotMatch(uiJs, /\)\} Credit`;/);
    assert.doesNotMatch(uiJs, /"-- Credit"/);
});

test("tooltip & aria menjelaskan kredit akan dipotong", () => {
    assert.match(appJs, /Kredit yang akan dipotong saat Generate/);
    assert.match(
        appJs,
        /"aria-label",\s*\n\s*`Kredit yang akan dipotong \$\{formatted\}`/
    );
});

test("badge kredit dihitung ulang saat mode berganti", () => {
    const switcher = appJs.slice(appJs.indexOf("function syncModeSwitcherUI()"));
    const body = switcher.slice(0, 8000);
    assert.match(body, /syncModelCreditForResolution\(\);/);
});

/* =========================================================
   4. CSS
   ========================================================= */

test("CSS membuat label kapital & badge kredit berbentuk pill", () => {
    assert.match(
        premiumCss,
        /#generateButton\s*\n?\s*\.generate-button-label \{\s*\n\s*text-transform:\s*\n\s*uppercase;/,
    );
    assert.match(premiumCss, /\.generate-button-credit-icon \{/);

    const creditRule = premiumCss.match(/\.generate-button-credit \{([\s\S]*?)\}/);
    assert.ok(creditRule, "rule .generate-button-credit wajib ada");
    assert.match(creditRule[1], /border-radius:\s*\n\s*999px;/);
    assert.match(creditRule[1], /font-weight:\s*\n\s*900;/);
});

test("mode terang tetap punya badge kredit yang terbaca", () => {
    assert.match(lightCss, /body \.generate-button-credit,/);
    assert.match(lightCss, /body #generateCreditCost \{/);
    const rule = lightCss.match(/body #generateCreditCost \{([\s\S]*?)\}/);
    assert.ok(rule);
    assert.match(rule[1], /font-weight: 900;/);
});
