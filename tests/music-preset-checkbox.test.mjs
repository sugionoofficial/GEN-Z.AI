/* =========================================================
   GEN-Z.AI
   MUSIC / LAGU AI — PILIHAN SISTEM (CHECKBOX) & DURASI
   ---------------------------------------------------------
   Regression guard untuk:
   1. Deskripsi Musik / Lagu AI bukan lagi textarea bebas,
      melainkan checkbox_group pilihan sistem.
   2. Cakupan deskripsi diperluas (8 kategori, 100+ opsi),
      semua teks musikal netral & aman filter Lyria 3.5.
   3. composeMusicDescription() whitelist + sanitasi catatan.
   4. Durasi maksimum naik 120 -> 180 detik (3 menit),
      300 detik / 5 menit TIDAK diizinkan dalam 1 generate.
   5. Alur baca/tulis form (fake DOM) tetap menghasilkan
      `prompt` berupa STRING yang siap dikirim ke API.
   ========================================================= */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
    MUSIC_PRESET_GROUPS,
    MUSIC_PRESET_TEXT_BY_VALUE,
    MUSIC_PRESET_DEFAULT_VALUES,
    MUSIC_PRESET_FALLBACK_TEXT,
    composeMusicDescription
} from "../models/opus-audio/music-presets.js";
import {
    LYRIA_UPSTREAM_MAX_DURATION_SECONDS,
    OPUS_MUSIC_DURATIONS,
    OPUS_MUSIC_MAX_DURATION_SECONDS
} from "../models/opus-audio/specs.js";
import { opusAudioModelMap } from "../models/opus-audio/index.js";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const musicAdapter = opusAudioModelMap["opus-audio-music"];
const allValues = Object.keys(MUSIC_PRESET_TEXT_BY_VALUE);

/* =========================================================
   KATALOG
   ========================================================= */

test("katalog pilihan sistem mencakup 8 kategori & lebih dari 100 opsi", () => {
    assert.equal(MUSIC_PRESET_GROUPS.length, 8);
    assert.ok(allValues.length >= 100, `jumlah opsi: ${allValues.length}`);
    const ids = MUSIC_PRESET_GROUPS.map(g => g.id);
    assert.deepEqual(ids, ["genre", "mood", "instrumen", "tempo", "vokal", "struktur", "produksi", "tema"]);
    for (const group of MUSIC_PRESET_GROUPS) {
        assert.ok(group.options.length >= 8, `${group.id} terlalu sedikit opsi`);
        for (const option of group.options) {
            assert.ok(option.value && option.label && option.text, `opsi kosong di ${group.id}`);
        }
    }
});

test("setiap value preset unik dan punya teks musikal", () => {
    const options = MUSIC_PRESET_GROUPS.flatMap(g => g.options);
    assert.equal(new Set(options.map(o => o.value)).size, options.length);
    assert.equal(allValues.length, options.length);
    for (const value of allValues) {
        assert.ok(MUSIC_PRESET_TEXT_BY_VALUE[value].trim().length > 5);
    }
});

test("tidak ada teks preset yang memicu filter konten Lyria", () => {
    const forbidden = /\b(?:mirip|seperti|cover|artis|penyanyi|rakyat|kekuasaan|pemerintah|korupsi|menderita|penderitaan|kehancuran|bunuh|senjata|kekerasan|hasut|khianati|mencuri|menjual|protes|politi[ck]|partai|pilpres|presiden|menteri|istana|mahkota|liang lahat|dibungkam|diinjak)\b/i;
    for (const [value, text] of Object.entries(MUSIC_PRESET_TEXT_BY_VALUE)) {
        assert.doesNotMatch(text, forbidden, `teks preset "${value}" berisiko: ${text}`);
    }
    assert.doesNotMatch(MUSIC_PRESET_FALLBACK_TEXT, forbidden);
});

test("pilihan bawaan semuanya ada di whitelist dan menghasilkan deskripsi utuh", () => {
    for (const value of MUSIC_PRESET_DEFAULT_VALUES) {
        assert.ok(MUSIC_PRESET_TEXT_BY_VALUE[value], `default "${value}" tidak dikenal`);
    }
    const composed = composeMusicDescription({ values: MUSIC_PRESET_DEFAULT_VALUES });
    assert.match(composed, /Emotional pop ballad/);
    assert.match(composed, /88 BPM/);
    assert.match(composed, /lyrics in Indonesian/);
    assert.match(composed, /clean modern studio production/);
    assert.ok(composed.length < 1000);
});

/* =========================================================
   COMPOSER
   ========================================================= */

test("composeMusicDescription menolak value di luar whitelist (anti injeksi teks bebas)", () => {
    const composed = composeMusicDescription({ values: ["dangdut", "<script>alert(1)</script>", " politik protes "] });
    assert.equal(composed, "Dangdut with kendang groove");
    assert.doesNotMatch(composed, /script|politik|protes/);
});

test("composeMusicDescription duplikat tidak digandakan", () => {
    const composed = composeMusicDescription({ values: ["piano", "piano", { value: "piano" }] });
    assert.equal(composed, "soft piano");
});

test("string tetap diterima untuk kompatibilitas klien API lama", () => {
    assert.equal(composeMusicDescription("  Pop akustik hangat, 95 BPM  "), "Pop akustik hangat, 95 BPM");
});

test("array kosong + fallback kosong menghasilkan string kosong (validasi gagal)", () => {
    assert.equal(composeMusicDescription([], { fallback: "" }), "");
    assert.equal(composeMusicDescription({ values: [], note: "" }, { fallback: "" }), "");
    assert.equal(composeMusicDescription({ values: ["nilai_tidak_ada"] }, { fallback: "" }), "");
});

test("catatan tambahan dibersihkan dari referensi artis & URL", () => {
    const composed = composeMusicDescription({
        values: ["pop_balada"],
        note: "mirip Via Vallen, cek https://example.com/lagu"
    });
    assert.match(composed, /Emotional pop ballad/);
    assert.doesNotMatch(composed, /Via Vallen/);
    assert.doesNotMatch(composed, /example\.com/);
    assert.match(composed, /warna musik orisinal/);
});

/* =========================================================
   ADAPTER & DURASI
   ========================================================= */

test("parameter prompt music sekarang bertipe checkbox_group dengan grup & default", () => {
    const definition = musicAdapter.parameters.prompt;
    assert.equal(definition.type, "checkbox_group");
    assert.equal(definition.required, true);
    assert.equal(definition.allowNote, true);
    assert.equal(definition.groups.length, 8);
    assert.ok(Array.isArray(definition.default));
    assert.deepEqual(definition.default, [...MUSIC_PRESET_DEFAULT_VALUES]);
    assert.doesNotMatch(read("models/opus-audio/factory.js"), /"Deskripsi musik \/ lagu wajib diisi\."/);
});

test("adapter menyusun prompt string dari array pilihan centang", () => {
    const payload = musicAdapter.buildPayload({
        prompt: ["dangdut", "semangat", "kendang", "cepat_128", "energik"],
        target_duration: "180",
        vocal_mode: "vocal",
        lyrics: "[Verse]\nHalo"
    });
    assert.equal(typeof payload.prompt, "string");
    assert.match(payload.prompt, /Dangdut with kendang groove/);
    assert.match(payload.prompt, /128 BPM/);
    assert.equal(payload.duration, 180);
    assert.equal(payload.vocal_mode, "vocal");
});

test("validate menerima array preset & 180 detik, menolak pilihan kosong dan 300 detik", () => {
    assert.equal(musicAdapter.validate({ prompt: MUSIC_PRESET_DEFAULT_VALUES, target_duration: "180" }).valid, true);
    assert.equal(musicAdapter.validate({ prompt: "Pop akustik hangat", target_duration: "180" }).valid, true);
    assert.equal(musicAdapter.validate({ prompt: [], target_duration: "30" }).valid, false);
    assert.equal(musicAdapter.validate({ prompt: ["tidak_ada"], target_duration: "30" }).valid, false);
    const rejected = musicAdapter.validate({ prompt: MUSIC_PRESET_DEFAULT_VALUES, target_duration: "300" });
    assert.equal(rejected.valid, false);
    assert.match(rejected.errors.join(" "), /300/);
    assert.match(rejected.errors.join(" "), /15, 30, 60, 120, 180/);
});

test("durasi maksimum resmi 180 detik; 5 menit (300) tidak tersedia", () => {
    const values = OPUS_MUSIC_DURATIONS.map(item => item.value);
    assert.deepEqual(values, ["15", "30", "60", "120", "180"]);
    assert.equal(OPUS_MUSIC_MAX_DURATION_SECONDS, 180);
    assert.equal(LYRIA_UPSTREAM_MAX_DURATION_SECONDS, 184);
    assert.ok(!values.includes("240") && !values.includes("300"));
    assert.deepEqual(musicAdapter.config.supportedDurations, [15, 30, 60, 120, 180]);
    const last = OPUS_MUSIC_DURATIONS.at(-1);
    assert.match(last.label, /3 Menit/);
});

/* =========================================================
   FAKE DOM — RENDER / BACA / TULIS FORM
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

async function loadFormModules() {
    const fields = await import("../generate/assets/js/generate-form-fields.js");
    const reader = await import("../generate/assets/js/generate-form-reader.js");
    return { fields, reader };
}

test("createFieldInput mengarahkan checkbox_group ke createCheckboxGroupField", async () => {
    const { fields } = await loadFormModules();
    const output = withFakeDom(() =>
        fields.createFieldInput("prompt", musicAdapter.parameters.prompt)
    );
    assert.equal(output.className, "generate-checkbox-group");
    assert.equal(output.dataset.parameter, "prompt");
});

test("checkbox_group merender semua grup, 102 checkbox, dan default tercentang", async () => {
    const { fields } = await loadFormModules();
    const wrapper = withFakeDom(() =>
        fields.createCheckboxGroupField(musicAdapter.parameters.prompt, "prompt")
    );
    assert.equal(wrapper.querySelectorAll(".generate-checkbox-group__group").length, 8);
    assert.equal(wrapper.querySelectorAll('input[type="checkbox"][data-preset-value]').length, allValues.length);
    assert.equal(
        wrapper.querySelectorAll('input[type="checkbox"][data-preset-value]:checked').length,
        MUSIC_PRESET_DEFAULT_VALUES.length
    );
    assert.ok(wrapper.querySelector(".generate-checkbox-group__note"));
    assert.equal(wrapper.querySelector(".generate-checkbox-group__count").textContent, `${MUSIC_PRESET_DEFAULT_VALUES.length} pilihan aktif`);
});

test("readFieldValue menyusun prompt string aman dari checkbox yang dicentang", async () => {
    const { fields, reader } = await loadFormModules();
    const wrapper = withFakeDom(() =>
        fields.createCheckboxGroupField(musicAdapter.parameters.prompt, "prompt")
    );
    const field = new FakeElement("div");
    field.appendChild(wrapper);

    let composed = reader.readFieldValue(field);
    assert.equal(typeof composed, "string");
    assert.match(composed, /Emotional pop ballad/);
    assert.match(composed, /lyrics in Indonesian/);

    /* Hapus semua centang -> string kosong, bukan boolean false. */
    wrapper.querySelectorAll('input[type="checkbox"][data-preset-value]').forEach(input => {
        input.checked = false;
    });
    composed = reader.readFieldValue(field);
    assert.equal(composed, "");

    /* Centang pilihan lain + catatan. */
    wrapper.querySelectorAll('input[type="checkbox"][data-preset-value="dangdut"]')[0].checked = true;
    wrapper.querySelector(".generate-checkbox-group__note").value = "mirip Via Vallen";
    composed = reader.readFieldValue(field);
    assert.match(composed, /Dangdut with kendang groove/);
    assert.doesNotMatch(composed, /Via Vallen/);
    assert.equal(musicAdapter.validate({ prompt: composed, target_duration: "30" }).valid, true);
});

test("tombol rekomendasi sistem mengembalikan pilihan ke default", async () => {
    const { fields, reader } = await loadFormModules();
    const wrapper = withFakeDom(() =>
        fields.createCheckboxGroupField(musicAdapter.parameters.prompt, "prompt")
    );
    wrapper.querySelectorAll('input[type="checkbox"][data-preset-value]').forEach(input => {
        input.checked = false;
    });
    wrapper.querySelectorAll('input[type="checkbox"][data-preset-value="edm"]')[0].checked = true;
    wrapper.querySelector(".generate-checkbox-group__note").value = "catatan lama";

    wrapper.querySelector(".generate-checkbox-group__reset").dispatch("click");

    assert.equal(
        wrapper.querySelectorAll('input[type="checkbox"][data-preset-value]:checked').length,
        MUSIC_PRESET_DEFAULT_VALUES.length
    );
    assert.equal(wrapper.querySelector(".generate-checkbox-group__note").value, "");
    const field = new FakeElement("div");
    field.appendChild(wrapper);
    assert.match(reader.readFieldValue(field), /Emotional pop ballad/);
});

test("setFieldValue memulihkan checkbox dari array value maupun string deskripsi", async () => {
    const { fields } = await loadFormModules();
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
            setter("prompt", ["dangdut", "koplo"]);
            const checked = wrapper
                .querySelectorAll('input[type="checkbox"][data-preset-value]:checked')
                .map(input => input.dataset.presetValue);
            assert.deepEqual(checked.sort(), ["dangdut", "koplo"]);

            setter("prompt", "Lo-fi chill hip hop, calm and peaceful mood");
            const restored = wrapper
                .querySelectorAll('input[type="checkbox"][data-preset-value]:checked')
                .map(input => input.dataset.presetValue);
            assert.deepEqual(restored.sort(), ["lofi", "tenang"]);
        }
    });
});

/* =========================================================
   SOURCE GUARDS
   ========================================================= */

test("CSS checkbox_group tersedia untuk tema gelap & terang, dengan cache-bust baru", () => {
    const premium = read("generate/assets/css/generate-premium.css");
    const light = read("generate/assets/css/generate-light.css");
    assert.match(premium, /#dynamicFields \.generate-checkbox-group__options/);
    assert.match(premium, /\.generate-checkbox-option:has\(input:checked\)/);
    assert.match(light, /generate-checkbox-option/);
    assert.match(light, /data-genz-theme="light"/);

    const html = read("generate/index.html");
    assert.match(html, /generate-premium\.css\?v=music-preset-20261103/);
    assert.match(html, /generate-light\.css\?v=music-preset-20261103/);
    assert.match(html, /Deskripsi cukup dipilih dengan centang/);
});

test("wiring checkbox_group lengkap di reader, value, form, dan fields", () => {
    const fieldsSrc = read("generate/assets/js/generate-form-fields.js");
    assert.match(fieldsSrc, /export function createCheckboxGroupField/);
    assert.match(fieldsSrc, /type ===\s*"checkbox_group"/);
    assert.match(fieldsSrc, /createCheckboxGroupField,/);

    const readerSrc = read("generate/assets/js/generate-form-reader.js");
    assert.match(readerSrc, /composeMusicDescription/);
    assert.match(readerSrc, /\.generate-checkbox-group/);
    assert.match(readerSrc, /data-preset-value/);

    for (const path of [
        "generate/assets/js/generate-form-value.js",
        "generate/assets/js/generate-form.js"
    ]) {
        const src = read(path);
        assert.match(src, /CHECKBOX GROUP \(PILIHAN SISTEM\)/);
        assert.match(src, /dataset\.presetText/);
        assert.match(src, /composedText\.includes/);
        assert.match(src, /wantedValues/);
    }
});
