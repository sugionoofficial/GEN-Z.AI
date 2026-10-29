import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = relative => readFileSync(path.join(root, relative), "utf8");

test("generate/index.html menyertakan spinner di dalam #generateButton serta cache-buster aset mobile spinner", () => {
    const html = read("generate/index.html");

    const buttonMatch = html.match(/<button[\s\S]*?id="generateButton"[\s\S]*?<\/button>/);
    assert.ok(buttonMatch, "#generateButton wajib ada di generate/index.html");
    assert.match(
        buttonMatch[0],
        /id="generateButtonSpinner"[\s\S]*?hidden/,
        "#generateButton wajib punya #generateButtonSpinner yang default hidden"
    );
    assert.match(
        buttonMatch[0],
        /class="generate-button-label"/,
        "#generateButton wajib punya .generate-button-label untuk sinkronisasi teks loading"
    );

    assert.match(html, /generate-premium\.css\?v=[A-Za-z0-9._-]+/);
    assert.match(html, /generate-progress-card\.css\?v=[A-Za-z0-9._-]+/);
    assert.match(html, /generate-light\.css\?v=[A-Za-z0-9._-]+/);
    assert.match(html, /generate-media-blocks\.css\?v=[A-Za-z0-9._-]+/);
    assert.match(html, /generate-progress-card\.js\?v=[A-Za-z0-9._-]+/);
    assert.match(html, /generate-app\.js\?v=[A-Za-z0-9._-]+/);
});

test("generate-premium.css & generate-progress-card.css menjaga semua indikator loading tetap berputar di HP walau prefers-reduced-motion aktif", () => {
    const premiumCss = read("generate/assets/css/generate-premium.css");
    const progressCss = read("generate/assets/css/generate-progress-card.css");

    assert.match(
        premiumCss,
        /#generateButton\s+\.spinner\[hidden\][\s\S]*?display:\s*none\s*!important;/,
        "spinner tombol generate yang berstatus [hidden] wajib disembunyikan"
    );
    assert.match(
        premiumCss,
        /#generateButton\[aria-busy="true"\]\s+\.btn-icon[\s\S]*?display:\s*none\s*!important;/,
        "ikon statis wajib disembunyikan saat tombol sedang memproses"
    );

    const reducedMotionMatch = premiumCss.match(
        /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*?)\n\}/
    );
    assert.ok(reducedMotionMatch, "blok prefers-reduced-motion wajib ada di generate-premium.css");
    const reducedBlock = reducedMotionMatch[1];

    for (const selector of [
        "#generateButton .spinner",
        ".genz-status-spinner",
        ".gpc-thumb-spinner",
        '.generate-media-status[data-state="uploading"]::before'
    ]) {
        assert.ok(
            reducedBlock.includes(selector),
            `${selector} wajib dikecualikan di prefers-reduced-motion agar tetap berputar di HP`
        );
    }
    assert.match(reducedBlock, /animation-iteration-count:\s*infinite\s*!important;/);

    const progressReducedMatch = progressCss.match(
        /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*?)\n\}/
    );
    assert.ok(progressReducedMatch, "blok prefers-reduced-motion wajib ada di generate-progress-card.css");
    assert.match(
        progressReducedMatch[1],
        /\.gpc-thumb-spinner\s*\{[\s\S]*?animation:\s*gpcSpin\s+\.8s\s+linear\s+infinite\s*!important;[\s\S]*?animation-iteration-count:\s*infinite\s*!important;/,
        ".gpc-thumb-spinner tidak boleh dimatikan dengan animation: none di HP"
    );
    assert.match(
        progressCss,
        /@keyframes\s+gpcSpin\s*\{\s*from\s*\{\s*transform:\s*rotate\(0deg\);\s*\}\s*to\s*\{\s*transform:\s*rotate\(360deg\);\s*\}\s*\}/
    );
});

test("generate-app.js merender #generateStatus responsif penuh di Mode HP, kontras di Mode Cerah, dan menyinkronkan spinner tombol", () => {
    const appJs = read("generate/assets/js/generate-app.js");

    assert.doesNotMatch(
        appJs,
        /status\.style\.cssText\s*=/,
        "ensureGenerateStatus tidak boleh memasang min-width/margin-left via inline cssText yang mengalahkan media query Mode HP"
    );
    assert.match(
        appJs,
        /@media\s*\(max-width:980px\)\s*\{\s*#generateStatus\s*\{\s*width:100%;\s*min-width:0;\s*max-width:none;\s*margin-left:0;/,
        "#generateStatus wajib melebar penuh tanpa margin kiri pada Mode HP"
    );
    assert.match(
        appJs,
        /html\[data-genz-theme="light"\]\s+#generateStatus\s+\.genz-status-spinner/,
        ".genz-status-spinner wajib memiliki warna kontras untuk Mode Cerah"
    );
    assert.match(appJs, /function\s+syncGenerateButtonLoading\s*\(/);
    assert.match(appJs, /syncGenerateButtonLoading\(\s*elements\.generateButton,\s*true/);
    assert.match(appJs, /syncGenerateButtonLoading\(\s*elements\.generateButton,\s*false/);
});

test("indikator unggah media menampilkan spinner berputar saat data-state uploading", () => {
    const formMediaJs = read("generate/assets/js/generate-form-media.js");
    const mediaBlocksCss = read("generate/assets/css/generate-media-blocks.css");

    assert.match(formMediaJs, /statusEl\.dataset\.state\s*=/);
    assert.match(
        mediaBlocksCss,
        /\.generate-media-status\[data-state="uploading"\]::before[\s\S]*?animation:\s*genzGenerateSpinner\s+0\.75s\s+linear\s+infinite;/
    );
});
