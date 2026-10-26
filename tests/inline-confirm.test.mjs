import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";

/*
 * Konfirmasi aksi di Studio Medsos dan SET Studio Medsos wajib terjadi di
 * tombol yang sama ("klik 1 = tombol jadi CONFIRM hijau terang, klik 2 =
 * jalan"), bukan dialog/blok notifikasi mengambang.
 *
 * Tes ini menjaga dua hal:
 *   1. helper `assets/js/inline-confirm.js` berperilaku benar, dan
 *   2. tidak ada satu pun `window.confirm` yang kembali masuk ke halaman.
 */

const root = new URL("../", import.meta.url);

async function read(relativePath) {
    return fs.readFile(new URL(relativePath, root), "utf8");
}

const inlineConfirmSource = await read("admin-control/assets/js/inline-confirm.js");
const publisherSource = await read("admin-control/social-publisher.js");
const publisherHtml = await read("admin-control/social-publisher.html");
const lightCss = await read("admin-control/assets/css/social-publisher-light.css");
const setSource = await read("admin-control/studio-medsos-set.js");
const setHtml = await read("admin-control/studio-medsos-set.html");

function createButton(text) {
    const classes = new Set(["btn"]);
    const attributes = new Map();
    return {
        textContent: text,
        focused: false,
        classList: {
            add: name => classes.add(name),
            remove: name => classes.delete(name),
            contains: name => classes.has(name)
        },
        classes,
        hasClass: name => classes.has(name),
        getAttribute: name => (attributes.has(name) ? attributes.get(name) : null),
        setAttribute: (name, value) => attributes.set(name, value),
        removeAttribute: name => attributes.delete(name),
        contains: () => false,
        focus() {
            this.focused = true;
        }
    };
}

function loadHelper() {
    const timers = [];
    const listeners = { click: [], keydown: [] };
    const context = {
        window: {},
        document: {
            addEventListener(type, handler) {
                listeners[type]?.push(handler);
            }
        },
        setTimeout(handler) {
            timers.push(handler);
            return timers.length;
        },
        clearTimeout(id) {
            if (id) timers[id - 1] = null;
        },
        Map,
        Boolean,
        Array,
        Object,
        String
    };
    vm.runInNewContext(inlineConfirmSource, context);
    return {
        helper: context.window.GENZInlineConfirm,
        runTimers() {
            timers.forEach(handler => handler && handler());
        },
        clickOutside() {
            listeners.click.forEach(handler => handler({ target: {} }));
        },
        pressEscape() {
            listeners.keydown.forEach(handler => handler({ key: "Escape" }));
        }
    };
}

test("klik pertama mengubah tombol yang sama menjadi CONFIRM", () => {
    const { helper } = loadHelper();
    const button = createButton("Hapus");
    const proceed = helper.request(button, { label: "Konfirmasi hapus" });

    assert.equal(proceed, false, "klik pertama tidak boleh langsung menghapus");
    assert.equal(button.textContent, "Konfirmasi hapus");
    assert.ok(button.hasClass("is-confirming"));
    assert.equal(button.getAttribute("aria-pressed"), "true");
});

test("klik kedua menjalankan aksi dan memulihkan label", () => {
    const { helper } = loadHelper();
    const button = createButton("Hapus");
    helper.request(button, { label: "Konfirmasi hapus" });
    const proceed = helper.request(button, { label: "Konfirmasi hapus" });

    assert.equal(proceed, true);
    assert.equal(button.textContent, "Hapus");
    assert.equal(button.hasClass("is-confirming"), false);
    assert.equal(button.getAttribute("aria-pressed"), null);
});

test("konfirmasi kedaluwarsa sendiri tanpa mengubah data", () => {
    const { helper, runTimers } = loadHelper();
    const button = createButton("Hapus");
    helper.request(button, { label: "Konfirmasi hapus" });
    runTimers();

    assert.equal(button.textContent, "Hapus");
    assert.equal(button.hasClass("is-confirming"), false);
    assert.equal(helper.isArmed(button), false);
});

test("klik di luar tombol atau tombol Escape membatalkan konfirmasi", () => {
    const { helper, clickOutside, pressEscape } = loadHelper();

    const first = createButton("Putuskan");
    helper.request(first, { label: "Konfirmasi putuskan" });
    clickOutside();
    assert.equal(first.textContent, "Putuskan");
    assert.equal(helper.isArmed(first), false);

    const second = createButton("Hapus");
    helper.request(second, { label: "Konfirmasi hapus" });
    pressEscape();
    assert.equal(second.textContent, "Hapus");
});

test("konfirmasi hanya berlaku untuk satu tombol dalam satu waktu", () => {
    const { helper } = loadHelper();
    const first = createButton("Hapus");
    const second = createButton("Batalkan");

    helper.request(first, { label: "Konfirmasi hapus" });
    helper.request(second, { label: "Konfirmasi batal" });

    assert.equal(first.textContent, "Hapus");
    assert.equal(second.textContent, "Konfirmasi batal");
});

test("tombol yang tidak ada tidak membuat aksi diam-diam gagal", () => {
    const { helper } = loadHelper();
    assert.equal(helper.request(null, { label: "Konfirmasi hapus" }), true);
});

test("tidak ada dialog mengambang tersisa di halaman Studio Medsos", () => {
    for (const [name, source] of [
        ["social-publisher.js", publisherSource],
        ["studio-medsos-set.js", setSource]
    ]) {
        assert.doesNotMatch(
            source,
            /window\.confirm\s*\(/,
            `${name} tidak boleh memakai window.confirm`
        );
    }
});

test("kedua halaman memuat helper sebelum skrip halaman", () => {
    const publisherScript = publisherHtml.indexOf("./assets/js/inline-confirm.js");
    const publisherModule = publisherHtml.indexOf("social-publisher.js?v=");
    assert.ok(publisherScript > 0, "helper harus dimuat di halaman Studio Medsos");
    assert.ok(publisherScript < publisherModule, "helper harus dimuat sebelum modul halaman");

    const setScript = setHtml.indexOf("./assets/js/inline-confirm.js");
    const setModule = setHtml.indexOf("studio-medsos-set.js?v=");
    assert.ok(setScript > 0, "helper harus dimuat di halaman SET Studio Medsos");
    assert.ok(setScript < setModule, "helper harus dimuat sebelum skrip halaman");
});

test("tombol konfirmasi berwarna hijau terang di tema gelap", () => {
    const rule = publisherHtml.slice(
        publisherHtml.indexOf(".btn.is-confirming"),
        publisherHtml.indexOf("btn-confirm-pulse", publisherHtml.indexOf(".btn.is-confirming"))
    );
    assert.match(rule, /#22c55e|#4ef08a|#12b76a/, "tema gelap harus memakai hijau terang");
    assert.doesNotMatch(rule, /#f5b950|#8a5a12/, "warna amber lama tidak boleh kembali");
});

test("tombol konfirmasi berwarna hijau terang di tema terang", () => {
    const rule = lightCss.slice(
        lightCss.indexOf(".btn.is-confirming"),
        lightCss.indexOf("btn-confirm-pulse-light", lightCss.indexOf(".btn.is-confirming"))
    );
    assert.match(rule, /#2ee072|#6ff2a4|#12a150/, "tema terang harus memakai hijau terang");
    assert.doesNotMatch(rule, /#e0a43c|#fff3d8/, "warna amber lama tidak boleh kembali");
});

test("tombol hentikan langganan juga dikonfirmasi di tombolnya sendiri", () => {
    assert.match(setSource, /confirmInlineAction\(button,/);
    assert.match(setSource, /stopSubscription\(userId, button\)/);
    assert.match(setHtml, /\.sub-btn\.is-confirming/);
    assert.match(
        setHtml,
        /html\[data-genz-theme="light"\] \.sub-btn\.is-confirming/,
        "tema terang juga butuh gaya konfirmasi hijau"
    );
    assert.match(setHtml, /sub-btn-confirm-pulse/);
});

test("setiap aksi destruktif di Studio Medsos melewati konfirmasi tombol", () => {
    for (const label of [
        "Konfirmasi hapus",
        "Konfirmasi putuskan",
        "Konfirmasi batal",
        "Konfirmasi matikan",
        "Konfirmasi jeda",
        "Konfirmasi hentikan"
    ]) {
        assert.match(publisherSource, new RegExp(label), `label "${label}" harus ada`);
    }

    const calls = publisherSource.match(/confirmInlineAction\(/g) || [];
    assert.ok(calls.length >= 10, "helper harus dipakai di semua titik konfirmasi");
});
