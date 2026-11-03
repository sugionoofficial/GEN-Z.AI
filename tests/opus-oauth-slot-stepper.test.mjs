/* =========================================================
   GEN-Z.AI — PEMILIH SLOT LOGIN OPUS (+ / -)
   ---------------------------------------------------------
   Halaman /api/opus-oauth-login dulunya mengharuskan admin
   mengedit `?slot=2` / `?slot=3` di address bar untuk login
   akun ke-2 / ke-3. Sekarang ada tombol + dan - yang
   menambah/mengurangi slot auth, chip untuk memilih slot,
   dan URL disinkronkan otomatis.

   Logika transisi state ada di `applyOpusSlotAction()` dan
   disuntikkan ke <script> inline lewat toString(), jadi
   server dan browser memakai kode yang persis sama.
========================================================= */

import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";

import opusOAuthLogin from "../api/opus-oauth-login.js";
import {
    OPUS_MAX_SLOT,
    applyOpusSlotAction,
    buildLoginIntroHtml,
    normalizeOpusSlot,
    opusSecretNameForSlot
} from "../functions/_shared/opus-oauth-web.js";

const ORIGIN = "https://genzai.genzai-f37.workers.dev";
const INTRO_PATH = "/api/opus-oauth-login";

function mockRes() {
    const headers = {};
    return {
        statusCode: 200,
        headers,
        body: "",
        setHeader(name, value) {
            headers[String(name).toLowerCase()] = value;
            return this;
        },
        end(raw) {
            this.body = raw === undefined ? "" : String(raw);
            return this;
        }
    };
}

function req(url) {
    return {
        method: "GET",
        url,
        headers: { host: "genzai.genzai-f37.workers.dev" },
        env: {}
    };
}

/* =========================================================
   1. LOGIKA TRANSISI SLOT (murni)
   ========================================================= */

test("+ menambah slot auth dan langsung memilih slot baru", () => {
    assert.deepEqual(applyOpusSlotAction({ slot: 1, count: 1 }, "plus"), { slot: 2, count: 2 });
    assert.deepEqual(applyOpusSlotAction({ slot: 3, count: 3 }, "plus"), { slot: 4, count: 4 });
    assert.equal(opusSecretNameForSlot(4), "OPUS_AUTH_TOKEN_4");
});

test("- mengurangi slot dan menurunkan pilihan bila slot terpilih ikut hilang", () => {
    assert.deepEqual(applyOpusSlotAction({ slot: 3, count: 3 }, "minus"), { slot: 2, count: 2 });
    assert.deepEqual(
        applyOpusSlotAction({ slot: 2, count: 5 }, "minus"),
        { slot: 2, count: 4 }
    );
    assert.deepEqual(applyOpusSlotAction({ slot: 1, count: 1 }, "minus"), { slot: 1, count: 1 });
});

test("select memilih chip yang ada, tidak bisa melewati jumlah slot", () => {
    assert.deepEqual(
        applyOpusSlotAction({ slot: 4, count: 4, targetSlot: 2 }, "select"),
        { slot: 2, count: 4 }
    );
    assert.deepEqual(
        applyOpusSlotAction({ slot: 2, count: 4, targetSlot: 9 }, "select"),
        { slot: 4, count: 4 }
    );
});

test("batas 1..9 konsisten dengan normalizeOpusSlot di server", () => {
    assert.equal(OPUS_MAX_SLOT, 9);
    assert.equal(normalizeOpusSlot(99), OPUS_MAX_SLOT);
    assert.equal(normalizeOpusSlot(-4), 1);
    assert.equal(normalizeOpusSlot("7"), 7);

    const capped = applyOpusSlotAction({ slot: 9, count: 9 }, "plus");
    assert.deepEqual(capped, { slot: 9, count: 9 });
    assert.equal(opusSecretNameForSlot(capped.slot), "OPUS_AUTH_TOKEN_9");

    const floored = applyOpusSlotAction({ slot: 1, count: 1 }, "minus");
    assert.deepEqual(floored, { slot: 1, count: 1 });
});

test("state awal dinormalisasi dan count tidak boleh lebih kecil dari slot", () => {
    assert.deepEqual(applyOpusSlotAction({ slot: 5, count: 2 }, "init"), { slot: 5, count: 5 });
    assert.deepEqual(applyOpusSlotAction(null, "init"), { slot: 1, count: 1 });
});

/* =========================================================
   2. HTML HALAMAN PEMBUKA
   ========================================================= */

test("halaman pembuka punya tombol + dan -, chip, dan tidak lagi menyuruh edit URL", () => {
    const html = buildLoginIntroHtml({ slot: 1, origin: ORIGIN });

    assert.match(html, /id='slotPlus'[^>]*>\+<\/button>/);
    assert.match(html, /id='slotMinus'[^>]*>&minus;<\/button>/);
    assert.match(html, /id='slotChips'/);
    assert.match(html, /id='startBtn'/);
    assert.match(html, /data-base=/);
    assert.match(html, /LANJUT LOGIN KE OPUS/);
    assert.match(html, /tidak perlu lagi mengedit \?slot=/);
    assert.doesNotMatch(html, /ganti angka pada URL/);

    /* tautan awal tetap kompatibel dengan alur start=1 yang lama */
    assert.match(html, /start=1&amp;slot=1/);

    /* logika murni benar-benar tersuntik, bukan duplikat tangan */
    assert.match(html, /var applyOpusSlotAction = function applyOpusSlotAction/);
    assert.match(html, /action === "plus"/);
    assert.match(html, /action === "minus"/);
});

test("slot dari URL tetap dipakai sebagai nilai awal", () => {
    const html = buildLoginIntroHtml({ slot: 3, origin: ORIGIN });

    assert.match(html, /Slot: OPUS_AUTH_TOKEN_3/);
    assert.match(html, /start=1&amp;slot=3/);
    assert.match(html, /var INITIAL_SLOT = 3/);
    assert.match(html, /Maksimal 9 slot/);
});

test("endpoint /api/opus-oauth-login?slot=2 merender pemilih slot yang benar", async () => {
    const res = mockRes();
    await opusOAuthLogin(req(`${INTRO_PATH}?slot=2`), res);

    assert.equal(res.statusCode, 200);
    assert.match(res.body, /OPUS_AUTH_TOKEN_2/);
    assert.match(res.body, /id='slotPlus'/);
    assert.match(res.body, /id='slotMinus'/);
    assert.match(res.body, /start=1&amp;slot=2/);
});

test("origin disuntikkan lewat atribut data-base yang di-escape, bukan literal JS", () => {
    const html = buildLoginIntroHtml({ slot: 1, origin: ORIGIN });
    assert.match(html, /data-base='https:\/\/genzai\.genzai-f37\.workers\.dev\/api\/opus-oauth-login'/);
    assert.match(html, /getAttribute\("data-base"\)/);

    const hostile = buildLoginIntroHtml({
        slot: 1,
        origin: "https://x.example/</script><script>alert(1)</script>"
    });
    assert.doesNotMatch(hostile, /<script>alert\(1\)/);
});

/* =========================================================
   3. UJI SCRIPT INLINE DENGAN FAKE DOM
   ========================================================= */

class FakeElement {
    constructor(id, attrs = {}) {
        this.id = id;
        this.attrs = { ...attrs };
        this.textContent = "";
        this.innerHTML = "";
        this.href = "";
        this.disabled = false;
        this.parentNode = null;
        this.handlers = Object.create(null);
    }

    getAttribute(key) {
        return Object.prototype.hasOwnProperty.call(this.attrs, key)
            ? this.attrs[key]
            : null;
    }

    setAttribute(key, value) {
        this.attrs[key] = value;
    }

    addEventListener(type, fn) {
        (this.handlers[type] || (this.handlers[type] = [])).push(fn);
    }

    async fire(type, extra = {}) {
        for (const fn of this.handlers[type] || []) {
            await fn(Object.assign({ target: this }, extra));
        }
    }
}

function buildBrowserHarness(html, { href = `${ORIGIN}${INTRO_PATH}?slot=2`, stored = null } = {}) {
    const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
    assert.ok(scriptMatch, "halaman pembuka harus punya script inline");

    const ids = [
        "startBtn", "slotBadge", "slotNum", "slotChips",
        "slotHint", "slotPlus", "slotMinus"
    ];
    const elements = new Map();
    for (const id of ids) {
        elements.set(id, new FakeElement(
            id,
            id === "startBtn" ? { "data-base": `${ORIGIN}${INTRO_PATH}` } : {}
        ));
    }
    const chipsBox = elements.get("slotChips");

    const store = new Map();
    if (stored) store.set("genz_opus_login_slot", JSON.stringify(stored));

    const location = { href };
    const localStorage = {
        getItem(key) { return store.has(key) ? store.get(key) : null; },
        setItem(key, value) { store.set(key, String(value)); }
    };
    const history = {
        replaceState(_state, _title, url) {
            location.href = String(url);
        }
    };

    const context = vm.createContext({
        document: {
            getElementById(id) { return elements.get(id) || null; }
        },
        window: { location, localStorage, history },
        URL,
        URLSearchParams
    });

    vm.runInContext(scriptMatch[1], context);

    function chip(slot) {
        const node = new FakeElement("chip-" + slot, { "data-slot": String(slot) });
        node.parentNode = chipsBox;
        return node;
    }

    return { elements, chip, location, store, chipsBox };
}

test("klik + mengubah slot, tautan login, badge, chip, dan URL tanpa edit manual", async () => {
    const html = buildLoginIntroHtml({ slot: 2, origin: ORIGIN });
    const { elements, location } = buildBrowserHarness(html);

    assert.equal(elements.get("slotBadge").textContent, "Slot: OPUS_AUTH_TOKEN_2");
    assert.equal(
        elements.get("startBtn").href,
        `${ORIGIN}${INTRO_PATH}?start=1&slot=2`
    );

    await elements.get("slotPlus").fire("click");

    assert.equal(elements.get("slotBadge").textContent, "Slot: OPUS_AUTH_TOKEN_3");
    assert.equal(
        elements.get("startBtn").href,
        `${ORIGIN}${INTRO_PATH}?start=1&slot=3`
    );
    assert.match(elements.get("slotNum").innerHTML, /Slot 3 dari 3/);
    assert.equal(
        (elements.get("slotChips").innerHTML.match(/class='chip/g) || []).length,
        3
    );

    const url = new URL(location.href);
    assert.equal(url.searchParams.get("slot"), "3");
    assert.equal(url.searchParams.get("count"), "3");
});

test("klik - mengurangi slot dan chip yang terpilih kembali ke slot terakhir", async () => {
    const html = buildLoginIntroHtml({ slot: 1, origin: ORIGIN });
    const { elements } = buildBrowserHarness(html, {
        href: `${ORIGIN}${INTRO_PATH}?slot=4&count=4`
    });

    assert.equal(elements.get("slotBadge").textContent, "Slot: OPUS_AUTH_TOKEN_4");
    assert.equal(elements.get("slotPlus").disabled, false);
    assert.equal(elements.get("slotMinus").disabled, false);

    await elements.get("slotMinus").fire("click");

    assert.equal(elements.get("slotBadge").textContent, "Slot: OPUS_AUTH_TOKEN_3");
    assert.equal(
        elements.get("startBtn").href,
        `${ORIGIN}${INTRO_PATH}?start=1&slot=3`
    );
});

test("chip memilih slot tanpa mengubah jumlah slot", async () => {
    const html = buildLoginIntroHtml({ slot: 1, origin: ORIGIN });
    const { elements, chip, chipsBox } = buildBrowserHarness(html, {
        href: `${ORIGIN}${INTRO_PATH}?slot=5&count=5`
    });

    await chipsBox.fire("click", { target: chip(2) });

    assert.equal(elements.get("slotBadge").textContent, "Slot: OPUS_AUTH_TOKEN_2");
    assert.equal(
        elements.get("startBtn").href,
        `${ORIGIN}${INTRO_PATH}?start=1&slot=2`
    );
    assert.match(elements.get("slotNum").innerHTML, /Slot 2 dari 5/);
    assert.equal(
        (chipsBox.innerHTML.match(/class='chip/g) || []).length,
        5
    );
});

test("tombol dinonaktifkan di batas bawah 1 dan batas atas 9", () => {
    const html = buildLoginIntroHtml({ slot: 1, origin: ORIGIN });

    const low = buildBrowserHarness(html, {
        href: `${ORIGIN}${INTRO_PATH}?slot=1&count=1`
    });
    assert.equal(low.elements.get("slotMinus").disabled, true);
    assert.equal(low.elements.get("slotPlus").disabled, false);

    const high = buildBrowserHarness(html, {
        href: `${ORIGIN}${INTRO_PATH}?slot=9&count=9`
    });
    assert.equal(high.elements.get("slotPlus").disabled, true);
    assert.equal(high.elements.get("slotMinus").disabled, false);
    assert.equal(high.elements.get("slotBadge").textContent, "Slot: OPUS_AUTH_TOKEN_9");
});

test("pilihan terakhir dipulihkan dari localStorage saat URL tanpa ?slot", () => {
    const html = buildLoginIntroHtml({ slot: 1, origin: ORIGIN });
    const { elements } = buildBrowserHarness(html, {
        href: `${ORIGIN}${INTRO_PATH}`,
        stored: { slot: 3, count: 5 }
    });

    assert.equal(elements.get("slotBadge").textContent, "Slot: OPUS_AUTH_TOKEN_3");
    assert.match(elements.get("slotNum").innerHTML, /Slot 3 dari 5/);
    assert.equal(
        elements.get("startBtn").href,
        `${ORIGIN}${INTRO_PATH}?start=1&slot=3`
    );
});

test("URL menang atas localStorage agar tautan ?slot=… masih bisa dibagikan", () => {
    const html = buildLoginIntroHtml({ slot: 1, origin: ORIGIN });
    const { elements } = buildBrowserHarness(html, {
        href: `${ORIGIN}${INTRO_PATH}?slot=7&count=7`,
        stored: { slot: 2, count: 2 }
    });

    assert.equal(elements.get("slotBadge").textContent, "Slot: OPUS_AUTH_TOKEN_7");
});
