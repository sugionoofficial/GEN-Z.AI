/* =========================================================
   GEN-Z.AI
   MUSIC / LAGU AI — BLOK KATEGORI (ACCORDION)
   ---------------------------------------------------------
   Regression guard untuk tampilan "Pilihan Sistem":
   1. Tiap kategori jadi satu blok <details>/<summary> yang
      tertutup saat awal; klik judul membuka, klik lagi
      mengecil kembali (perilaku native browser, tanpa JS
      toggle tambahan).
   2. Badge per kategori menampilkan jumlah pilihan aktif
      supaya pilihan bawaan tetap terlihat walau blok tertutup.
   3. Membuka/menutup blok TIDAK mengubah nilai form.
   4. CSS rapi untuk tema gelap/terang + tap target HP.
   ========================================================= */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
    MUSIC_PRESET_GROUPS,
    MUSIC_PRESET_DEFAULT_VALUES
} from "../models/opus-audio/music-presets.js";
import { opusAudioModelMap } from "../models/opus-audio/index.js";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const musicAdapter = opusAudioModelMap["opus-audio-music"];

/* =========================================================
   FAKE DOM
   ========================================================= */

class FakeElement {
    constructor(tagName) {
        this.tagName = String(tagName).toUpperCase();
        this.children = [];
        this.dataset = {};
        this.className = "";
        this.textContent = "";
        this.checked = false;
        this.value = "";
        this.open = false;
        this.listeners = {};
    }
    appendChild(child) {
        this.children.push(child);
        return child;
    }
    addEventListener(type, callback) {
        (this.listeners[type] ||= []).push(callback);
    }
    dispatch(type) {
        (this.listeners[type] || []).forEach(cb => cb({ type }));
    }
    descendants() {
        const out = [];
        for (const child of this.children) {
            out.push(child);
            out.push(...child.descendants());
        }
        return out;
    }
    querySelectorAll(selector) {
        return this.descendants().filter(el => FakeElement.matches(el, selector));
    }
    querySelector(selector) {
        return this.querySelectorAll(selector)[0] || null;
    }
    static matches(el, selector) {
        const s = String(selector).trim();
        const tag = (/^([a-zA-Z0-9]+)/.exec(s) || [])[1];
        if (tag && el.tagName !== tag.toUpperCase()) return false;
        for (const [, key, val] of s.matchAll(/\[([^\]=]+)(?:="([^"]*)")?\]/g)) {
            if (key === "type") {
                if (el.type !== val) return false;
            } else if (key.startsWith("data-")) {
                const camel = key.slice(5).replace(/-([a-z])/g, (_m, c) => c.toUpperCase());
                const actual = el.dataset[camel];
                if (val === undefined ? actual === undefined : String(actual) !== val) return false;
            }
        }
        for (const [, cls] of s.matchAll(/\.([a-zA-Z0-9_-]+)/g)) {
            if (!String(el.className || "").split(/\s+/).includes(cls)) return false;
        }
        if (s.includes(":checked") && !el.checked) return false;
        return true;
    }
}

function withFakeDom(callback) {
    const previousDocument = globalThis.document;
    const previousCSS = globalThis.CSS;
    globalThis.document = { createElement: tag => new FakeElement(tag), querySelector: () => null };
    globalThis.CSS = { escape: value => String(value) };
    try {
        return callback();
    } finally {
        globalThis.document = previousDocument;
        globalThis.CSS = previousCSS;
    }
}

async function renderGroup() {
    const fields = await import("../generate/assets/js/generate-form-fields.js");
    const reader = await import("../generate/assets/js/generate-form-reader.js");
    const wrapper = withFakeDom(() =>
        fields.createCheckboxGroupField(musicAdapter.parameters.prompt, "prompt")
    );
    return { wrapper, reader };
}

/* Browser: klik <summary> membalik `details.open`. */
function clickSummary(section) {
    section.open = !section.open;
}

/* =========================================================
   STRUKTUR BLOK
   ========================================================= */

test("setiap kategori dirender sebagai <details> yang tertutup", async () => {
    const { wrapper } = await renderGroup();
    const sections = wrapper.querySelectorAll("details.generate-checkbox-group__group");

    assert.equal(sections.length, MUSIC_PRESET_GROUPS.length);
    assert.equal(sections.length, 8);
    assert.deepEqual(
        sections.map(section => section.dataset.presetGroup),
        MUSIC_PRESET_GROUPS.map(group => group.id)
    );

    for (const section of sections) {
        assert.equal(section.open, false, "blok harus mengecil saat awal");
        assert.equal(section.children[0].tagName, "SUMMARY");
        assert.ok(section.children.some(child => child.className === "generate-checkbox-group__body"));
    }
});

test("judul blok berisi nomor, nama kategori, badge, dan chevron", async () => {
    const { wrapper } = await renderGroup();
    const sections = wrapper.querySelectorAll("details.generate-checkbox-group__group");

    sections.forEach((section, i) => {
        const summary = section.children[0];
        assert.equal(summary.className, "generate-checkbox-group__summary");
        assert.equal(summary.children.length, 4);
        assert.equal(summary.children[0].className, "generate-checkbox-group__index");
        assert.equal(summary.children[0].textContent, String(i + 1).padStart(2, "0"));
        assert.equal(summary.children[1].textContent, MUSIC_PRESET_GROUPS[i].label);
        assert.equal(summary.children[2].className, "generate-checkbox-group__badge");
        assert.equal(summary.children[3].className, "generate-checkbox-group__chevron");

        /* Toggle memakai perilaku native <details>, bukan listener klik JS. */
        assert.equal(summary.listeners.click, undefined);
    });
});

test("opsi berada di dalam body (yang disembunyikan native saat blok tertutup)", async () => {
    const { wrapper } = await renderGroup();
    const sections = wrapper.querySelectorAll("details.generate-checkbox-group__group");
    const allInputs = wrapper.querySelectorAll('input[type="checkbox"][data-preset-value]');

    let insideBody = 0;
    for (const section of sections) {
        const body = section.children.find(child => child.className === "generate-checkbox-group__body");
        assert.ok(body, "body blok harus ada");
        assert.ok(body.querySelector(".generate-checkbox-group__options"));
        const summary = section.children[0];
        assert.equal(summary.querySelectorAll("input").length, 0, "checkbox tidak boleh di judul");
        insideBody += body.querySelectorAll('input[type="checkbox"][data-preset-value]').length;
    }
    assert.equal(insideBody, allInputs.length);
});

/* =========================================================
   BADGE & RINGKASAN
   ========================================================= */

test("badge per kategori menampilkan jumlah pilihan aktif walau blok tertutup", async () => {
    const { wrapper } = await renderGroup();
    const sections = wrapper.querySelectorAll("details.generate-checkbox-group__group");

    for (const section of sections) {
        const badge = section.children[0].children[2];
        const checked = section.querySelectorAll('input[type="checkbox"][data-preset-value]:checked').length;
        if (checked > 0) {
            assert.equal(badge.textContent, `${checked} dipilih`);
            assert.equal(badge.dataset.active, "true");
            assert.equal(section.dataset.selected, "true");
        } else {
            const total = section.querySelectorAll('input[type="checkbox"][data-preset-value]').length;
            assert.equal(badge.textContent, `${total} opsi`);
            assert.equal(badge.dataset.active, "false");
            assert.equal(section.dataset.selected, "false");
        }
    }

    assert.equal(
        wrapper.querySelector(".generate-checkbox-group__count").textContent,
        `${MUSIC_PRESET_DEFAULT_VALUES.length} pilihan aktif`
    );
    assert.match(wrapper.querySelector(".generate-checkbox-group__hint").textContent, /Ketuk kategori/);
});

test("centang baru memperbarui badge kategori & total tanpa membuka blok", async () => {
    const { wrapper } = await renderGroup();
    const genre = wrapper.querySelector('details[data-preset-group="genre"]');
    const badge = genre.children[0].children[2];
    const before = genre.querySelectorAll('input[type="checkbox"][data-preset-value]:checked').length;

    const extra = genre.querySelector('input[type="checkbox"][data-preset-value="jazz"]');
    assert.equal(extra.checked, false);
    extra.checked = true;
    wrapper.dispatch("change");

    assert.equal(badge.textContent, `${before + 1} dipilih`);
    assert.equal(
        wrapper.querySelector(".generate-checkbox-group__count").textContent,
        `${MUSIC_PRESET_DEFAULT_VALUES.length + 1} pilihan aktif`
    );
});

test("tombol rekomendasi sistem menyegarkan badge tanpa mengubah status buka/tutup", async () => {
    const { wrapper } = await renderGroup();
    const sections = wrapper.querySelectorAll("details.generate-checkbox-group__group");
    clickSummary(sections[0]);
    assert.equal(sections[0].open, true);

    wrapper.querySelectorAll('input[type="checkbox"][data-preset-value]').forEach(input => {
        input.checked = false;
    });
    wrapper.dispatch("change");
    assert.equal(sections[0].children[0].children[2].dataset.active, "false");

    wrapper.querySelector(".generate-checkbox-group__reset").dispatch("click");

    assert.equal(sections[0].open, true, "reset tidak boleh menutup blok yang terbuka");
    assert.equal(
        wrapper.querySelector(".generate-checkbox-group__count").textContent,
        `${MUSIC_PRESET_DEFAULT_VALUES.length} pilihan aktif`
    );
    assert.equal(
        wrapper.querySelectorAll('input[type="checkbox"][data-preset-value]:checked').length,
        MUSIC_PRESET_DEFAULT_VALUES.length
    );
});

/* =========================================================
   BUKA / TUTUP TIDAK MENGUBAH NILAI FORM
   ========================================================= */

test("klik buka lalu klik lagi menutup, dan nilai prompt tetap sama", async () => {
    const { wrapper, reader } = await renderGroup();
    const field = new FakeElement("div");
    field.appendChild(wrapper);

    const before = reader.readFieldValue(field);
    assert.match(before, /Emotional pop ballad/);

    const target = wrapper.querySelector('details[data-preset-group="mood"]');
    assert.equal(target.open, false);

    clickSummary(target);
    assert.equal(target.open, true, "klik pertama membuka");
    assert.equal(reader.readFieldValue(field), before);

    clickSummary(target);
    assert.equal(target.open, false, "klik kedua mengecil kembali");
    assert.equal(reader.readFieldValue(field), before);

    /* Blok lain tetap tertutup (bukan accordion eksklusif). */
    for (const section of wrapper.querySelectorAll("details.generate-checkbox-group__group")) {
        assert.equal(section.open, false);
    }
});

test("pemulihan nilai via setFieldValue menyegarkan badge (tanpa event change)", async () => {
    const fields = await import("../generate/assets/js/generate-form-fields.js");
    const valueModule = await import("../generate/assets/js/generate-form-value.js");
    const formModule = await import("../generate/assets/js/generate-form.js");

    withFakeDom(() => {
        const wrapper = fields.createCheckboxGroupField(musicAdapter.parameters.prompt, "prompt");
        const field = new FakeElement("div");
        field.className = "generate-field";
        field.dataset.parameter = "prompt";
        field.appendChild(wrapper);
        globalThis.document.querySelector = selector =>
            String(selector).includes('data-parameter="prompt"') ? field : null;

        for (const setter of [valueModule.setFieldValue, formModule.setFieldValue]) {
            setter("prompt", ["dangdut"]);

            assert.equal(
                wrapper.querySelector(".generate-checkbox-group__count").textContent,
                "1 pilihan aktif"
            );
            const genre = wrapper.querySelector('details[data-preset-group="genre"]');
            const mood = wrapper.querySelector('details[data-preset-group="mood"]');
            assert.equal(genre.children[0].children[2].textContent, "1 dipilih");
            assert.equal(genre.dataset.selected, "true");
            assert.equal(mood.children[0].children[2].dataset.active, "false");
            assert.equal(mood.dataset.selected, "false");

            setter("prompt", MUSIC_PRESET_DEFAULT_VALUES);
            assert.equal(
                wrapper.querySelector(".generate-checkbox-group__count").textContent,
                `${MUSIC_PRESET_DEFAULT_VALUES.length} pilihan aktif`
            );
        }
    });
});

/* =========================================================
   SOURCE GUARDS
   ========================================================= */

test("render memakai details/summary native, bukan fieldset/legend lama", () => {
    const src = read("generate/assets/js/generate-form-fields.js");
    const start = src.indexOf("export function createCheckboxGroupField(");
    const end = src.indexOf("SELECT OPTION NORMALIZER", start);
    const body = src.slice(start, end);

    assert.match(body, /document\.createElement\(\s*"details"\s*\)/);
    assert.match(body, /document\.createElement\(\s*"summary"\s*\)/);
    assert.match(body, /section\.open\s*=\s*false/);
    assert.doesNotMatch(body, /createElement\(\s*"fieldset"/);
    assert.doesNotMatch(body, /createElement\(\s*"legend"/);
    assert.doesNotMatch(body, /summary\s*\.addEventListener\(\s*"click"/);
    assert.match(body, /wrapper\.addEventListener\(\s*"change"/);
});

test("hook refresh tersedia di kedua jalur setFieldValue", () => {
    const fields = read("generate/assets/js/generate-form-fields.js");
    assert.match(fields, /wrapper\.refreshPresetSummary\s*=\s*refresh/);
    for (const path of [
        "generate/assets/js/generate-form-value.js",
        "generate/assets/js/generate-form.js"
    ]) {
        assert.match(read(path), /presetGroup\.refreshPresetSummary\(\)/);
    }
});

test("CSS accordion: state [open], chevron, marker native disembunyikan", () => {
    const premium = read("generate/assets/css/generate-premium.css");
    const light = read("generate/assets/css/generate-light.css");

    assert.match(premium, /generate-checkbox-group__group\[open\]/);
    assert.match(premium, /generate-checkbox-group__group\[data-selected="true"\]/);
    assert.match(premium, /generate-checkbox-group__badge\[data-active="true"\]/);
    assert.match(premium, /group\[open\] \.generate-checkbox-group__chevron/);
    assert.match(premium, /::-webkit-details-marker/);
    assert.match(premium, /list-style:\s*none/);
    assert.match(premium, /@keyframes genz-preset-reveal/);
    assert.match(premium, /#dynamicFields \.generate-checkbox-group__options/);
    assert.match(premium, /\.generate-checkbox-option:has\(input:checked\)/);

    assert.match(light, /generate-checkbox-group__group\[open\]/);
    assert.match(light, /generate-checkbox-group__badge\[data-active="true"\]/);
    assert.match(light, /generate-checkbox-option:has\(input:checked\)/);
    assert.match(light, /data-genz-theme="light"/);
});

test("CSS mode HP: tap target >= 44px, toolbar bertumpuk, breakpoint 768/480/360", () => {
    const premium = read("generate/assets/css/generate-premium.css");
    assert.match(premium, /@media \(max-width: 768px\)/);
    assert.match(premium, /@media \(max-width: 480px\)/);
    assert.match(premium, /@media \(max-width: 360px\)/);
    assert.match(premium, /min-height: 48px/);
    assert.match(premium, /min-height: 44px/);
    assert.match(premium, /width: 100%/);
    assert.match(premium, /grid-template-columns: minmax\(0, 1fr\)/);
    assert.match(premium, /@media \(prefers-reduced-motion: reduce\)/);
});

test("cache-bust aset yang diubah diperbarui dan pin modul identik", () => {
    const TAG = "preset-accordion-20261103";
    const html = read("generate/index.html");
    assert.match(html, new RegExp(`generate-premium\\.css\\?v=music-preset-20261103-${TAG}`));
    assert.match(html, new RegExp(`generate-light\\.css\\?v=music-preset-20261103-${TAG}`));
    assert.match(html, new RegExp(`generate-app\\.js\\?v=[\\w-]*${TAG}`));

    const app = read("generate/assets/js/generate-app.js");
    assert.match(app, new RegExp(`generate-form\\.js\\?v=20261101-music-vocal-sync-${TAG}`));

    const pin = `generate-form-fields.js?v=${TAG}`;
    for (const path of [
        "generate/assets/js/generate-form.js",
        "generate/assets/js/generate-form-render.js"
    ]) {
        assert.match(read(path), new RegExp(pin.replace("?", "\\?")));
    }
    assert.match(
        read("generate/assets/js/generate-form.js"),
        new RegExp(`generate-form-render\\.js\\?v=${TAG}`)
    );
});
