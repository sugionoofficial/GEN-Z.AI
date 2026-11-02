import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = relative => readFileSync(path.join(root, relative), "utf8");

const html = read("generate/index.html");
const js = read("generate/assets/js/generate-mobile-model-picker.js");
const css = read("generate/assets/css/generate-mobile-model-picker.css");

test("halaman Generate memuat picker model mobile dengan cache-buster", () => {
    assert.match(html, /generate-mobile-model-picker\.css\?v=[A-Za-z0-9._-]+/);
    assert.match(html, /generate-mobile-model-picker\.js\?v=[A-Za-z0-9._-]+/);
    assert.match(html, /id="modelSelect"[\s\S]*?aria-label="Pilih model AI"/);
});

test("picker mobile hanya aktif di HP dan tidak menghapus native select", () => {
    assert.match(js, /const MOBILE_QUERY = "\(max-width: 768px\)"/);
    assert.match(js, /document\.getElementById\("modelSelect"\)/);
    assert.doesNotMatch(js, /select\.remove\(/);
    assert.doesNotMatch(js, /select\.disabled\s*=/);
    assert.match(css, /@media \(max-width: 768px\)/);
    assert.match(css, /\.generate-model-select-wrap\.is-mobile-picker-enhanced > \.generate-model-select/);
    assert.doesNotMatch(css, /\.generate-model-select-wrap\.is-mobile-picker-enhanced > \.generate-model-select\s*\{[^}]*display:\s*none/);
});

test("pilihan picker meneruskan change ke alur generate lama", () => {
    assert.match(js, /select\.value = option\.value/);
    assert.match(js, /select\.dispatchEvent\(new Event\("change", \{ bubbles: true \}\)\)/);
    assert.match(js, /new MutationObserver\(sync\)/);
    assert.match(js, /select\.addEventListener\("change", sync\)/);
});

test("daftar model mobile punya gaya gelap, baris terpilih biru, dan target sentuh layak", () => {
    assert.match(css, /\.generate-model-picker-menu\s*\{[^}]*background:\s*#0d111a/);
    assert.match(css, /\.generate-model-picker-option\[aria-selected="true"\]\s*\{[^}]*background:\s*#83b9f3/);
    assert.match(css, /\.generate-model-picker-option\s*\{[^}]*min-height:\s*44px/);
    assert.match(css, /html\[data-genz-theme="light"\] \.generate-model-picker-menu/);
});

test("picker mobile mendukung keyboard, focus, dan tutup di luar area", () => {
    assert.match(js, /aria-haspopup/);
    assert.match(js, /aria-expanded/);
    assert.match(js, /role", "listbox"/);
    assert.match(js, /aria-activedescendant/);
    for (const key of ["ArrowDown", "ArrowUp", "Home", "End", "Enter", "Escape", "Tab"]) {
        assert.ok(js.includes(`case "${key}"`), `keyboard ${key} harus didukung`);
    }
    assert.match(js, /document\.addEventListener\("pointerdown"/);
    assert.match(js, /document\.addEventListener\("focusin"/);
});
