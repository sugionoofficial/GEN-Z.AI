/* =========================================================
   GEN-Z.AI
   GENERATE — SATU NOTIFIKASI ERROR SAJA
   ---------------------------------------------------------
   Kasus: pada halaman generate, saat request gagal muncul DUA
   notif identik di bagian atas:
     1. #status  -> "Generate error: <pesan>" (paling atas)
     2. #pageError -> panel "Notifikasi Error" + <pesan>

   Perbaikan: #status tidak lagi diisi pesan error (cukup
   disembunyikan), sehingga hanya #pageError yang tampil.
   #status tetap dipakai untuk pesan loading / sukses.
   ========================================================= */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const APP = "generate/assets/js/generate-app.js";
const SUBMIT = "generate/assets/js/generate-submit.js";
const RUNTIME = "generate/assets/js/generate-runtime.js";
const UI = "generate/assets/js/generate-ui.js";

const REAL_ERROR =
    "Egress Gateway 400: Lyria interaction error (http 400): 400 The prompt could not be processed. " +
    "Please try rephrasing the prompt or using different input.";

/** Ambil satu deklarasi fungsi utuh dari source (brace matching). */
function extractFunction(source, name) {
    const marker = `function ${name}(`;
    const start = source.indexOf(marker);
    assert.ok(start >= 0, `fungsi ${name} tidak ditemukan`);
    const open = source.indexOf("{", start);
    let depth = 0;
    for (let i = open; i < source.length; i += 1) {
        if (source[i] === "{") depth += 1;
        if (source[i] === "}") {
            depth -= 1;
            if (depth === 0) return source.slice(start, i + 1);
        }
    }
    throw new Error(`fungsi ${name} tidak berakhir`);
}

/** Jalankan fungsi showError dengan DOM palsu, tanpa memuat seluruh modul. */
function loadShowError(path, name = "showError") {
    const source = extractFunction(read(path), name);
    const expression = source.replace(/^function\s+\w+\s*\(/, "function (");
    const factory = new Function("getDOM", `return (${expression});`);
    return getDOM => factory(getDOM);
}

function makeFakeDom() {
    const heading = { textContent: "Model tidak tersedia" };
    const pageError = {
        hidden: true,
        style: { display: "none" },
        dataset: {},
        querySelector: selector => (selector === "h2" ? heading : null)
    };
    const pageErrorMessage = { textContent: "" };
    const status = {
        textContent: "Sedang memproses...",
        hidden: false,
        dataset: { error: "true" },
        style: {}
    };
    return {
        heading,
        pageError,
        pageErrorMessage,
        status,
        getDOM: () => ({ pageError, pageErrorMessage, status })
    };
}

/* =========================================================
   PERILAKU: showError() UTAMA (generate-app.js)
   ========================================================= */

test("showError hanya mengisi #pageError, bukan #status", () => {
    const dom = makeFakeDom();
    const showError = loadShowError(APP);

    showError(dom.getDOM)(REAL_ERROR);

    assert.equal(dom.pageError.hidden, false);
    assert.equal(dom.pageError.style.display, "flex");
    assert.equal(dom.pageError.dataset.error, "true");
    assert.equal(dom.pageErrorMessage.textContent, REAL_ERROR);
    assert.equal(dom.heading.textContent, "Notifikasi Error");

    /* Baris #status (notif paling atas) harus hilang. */
    assert.equal(dom.status.hidden, true);
    assert.equal(dom.status.textContent, "");
    assert.equal(dom.status.dataset.error, undefined);
});

test("showError tetap memakai heading 'Model tidak tersedia' untuk error konfigurasi", () => {
    const dom = makeFakeDom();
    loadShowError(APP)(dom.getDOM)("Konfigurasi model tidak dapat dimuat.");
    assert.equal(dom.heading.textContent, "Model tidak tersedia");
    assert.equal(dom.status.hidden, true);
});

test("showError menangani pesan kosong dengan fallback", () => {
    const dom = makeFakeDom();
    loadShowError(APP)(dom.getDOM)("");
    assert.equal(dom.pageErrorMessage.textContent, "Terjadi kesalahan.");
    assert.equal(dom.status.hidden, true);
});

/* =========================================================
   PERILAKU: fallback runtime
   ========================================================= */

test("showError runtime juga tidak menduplikasi pesan ke #status", () => {
    const dom = makeFakeDom();
    loadShowError(RUNTIME)(dom.getDOM)(REAL_ERROR);
    assert.equal(dom.pageError.hidden, false);
    assert.equal(dom.pageErrorMessage.textContent, REAL_ERROR);
    assert.equal(dom.status.hidden, true);
    assert.equal(dom.status.textContent, "");
});

/* =========================================================
   SOURCE GUARDS
   ========================================================= */

test("generate-submit.js tidak lagi menulis 'Generate error: ...' ke #status", () => {
    const src = read(SUBMIT);
    assert.doesNotMatch(src, /"Generate error: "/);
    assert.doesNotMatch(src, /isOpusFinalBusy\s*\?\s*errorMessage/);
    assert.match(src, /showError\(\s*errorMessage\s*\)/);
    assert.match(src, /Jangan tulis ulang #status/);
    assert.match(src, /elements\.status\.hidden\s*=\s*true/);
    assert.match(src, /delete elements\.status\.dataset\.error/);
});

test("generate-ui.js showError memanggil hideStatus(), bukan showStatus(error)", () => {
    const src = read(UI);
    const body = extractFunction(src, "showError");
    assert.match(body, /showPageError\(/);
    assert.match(body, /hideStatus\(\)/);
    assert.doesNotMatch(body, /showStatus\(/);
    /* Fungsi showStatus tetap ada untuk pesan sukses/ready/busy. */
    assert.match(src, /export function showStatus\(/);
});

test("#status tetap dipakai untuk pesan sukses & loading (tidak dihapus total)", () => {
    const submit = read(SUBMIT);
    assert.match(submit, /"Generate selesai\."/);
    const app = read(APP);
    assert.match(app, /elements\.status\.textContent =\s*message;/);
    assert.ok(app.includes("elements.status.hidden =\n            false;"));
});

test("hanya ada satu panel error statis di HTML", () => {
    const html = read("generate/index.html");
    assert.equal((html.match(/id="pageError"/g) || []).length, 1);
    assert.equal((html.match(/id="status"/g) || []).length, 1);
    assert.match(html, /role="alert"/);
    assert.match(html, /Notifikasi Error|Model tidak tersedia/);
});

test("cache-bust modul yang diubah diperbarui", () => {
    const html = read("generate/index.html");
    const app = read(APP);
    assert.match(html, /generate-app\.js\?v=stored-uploads-20261026[\w-]*single-error-20261103/);
    assert.match(app, /generate-submit\.js\?v=20261101-audio-transcribe-single-error-20261103/);
    assert.match(app, /generate-ui\.js\?v=20261101-staged-20s-credit-single-error-20261103/);
});
