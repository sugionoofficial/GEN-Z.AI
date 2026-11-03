/* =========================================================
   GEN-Z.AI — PEMILIH SLOT LOGIN OPUS (+ / -)
   ---------------------------------------------------------
   Halaman /api/opus-oauth-login dulunya mengharuskan admin
   mengedit `?slot=2` / `?slot=3` di address bar untuk login
   akun ke-2 / ke-3.

   VERSI SEKARANG: tombol + / - dan chip adalah TAUTAN yang
   dirender penuh di server (tanpa JavaScript). Setiap klik
   melakukan navigasi ke `?slot=..&count=..`, sehingga URL di
   address bar PASTI berubah. Ini penting karena halaman sering
   dibuka di iframe preview / browser HP yang memblokir inline
   script dan history.replaceState().

   `applyOpusSlotAction()` dipakai server untuk menghitung state
   berikutnya, jadi logikanya tetap murni & teruji.
========================================================= */

import assert from "node:assert/strict";
import test from "node:test";

import opusOAuthLogin from "../api/opus-oauth-login.js";
import opusOAuthCallback from "../api/opus-oauth-callback.js";
import {
    OPUS_CHIP_WINDOW,
    OPUS_MAX_SAFE_SLOT,
    OPUS_MIN_SLOT,
    applyOpusSlotAction,
    getOpusChipRange,
    buildLoginIntroHtml,
    buildOpusLoginErrorHtml,
    buildOpusLoginSuccessHtml,
    decodeOAuthState,
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

function req(url, { env = {} } = {}) {
    return {
        method: "GET",
        url,
        env,
        headers: {
            host: "genzai.genzai-f37.workers.dev",
            "x-forwarded-host": "genzai.genzai-f37.workers.dev",
            "x-forwarded-proto": "https"
        }
    };
}

function json(payload, status = 200) {
    return new Response(JSON.stringify(payload), {
        status,
        headers: { "content-type": "application/json" }
    });
}

function withFetch(impl, run) {
    const original = globalThis.fetch;
    globalThis.fetch = async (input, options = {}) => impl(String(input), options);
    return Promise.resolve()
        .then(run)
        .finally(() => { globalThis.fetch = original; });
}

const START_FETCH = (url) => {
    if (url.startsWith("https://labs.opus.pro/.well-known/oauth-protected-resource")) {
        return json({
            resource: "https://labs.opus.pro/opus-video-tools/mcp",
            authorization_servers: ["https://focused-horizon-38.authkit.app"]
        });
    }
    if (url === "https://focused-horizon-38.authkit.app/.well-known/oauth-authorization-server") {
        return json({
            authorization_endpoint: "https://focused-horizon-38.authkit.app/oauth2/authorize",
            token_endpoint: "https://focused-horizon-38.authkit.app/oauth2/token",
            registration_endpoint: "https://focused-horizon-38.authkit.app/oauth2/register",
            scopes_supported: ["openid", "offline_access"],
            token_endpoint_auth_methods_supported: ["none"]
        });
    }
    if (url.endsWith("/oauth2/register")) {
        return json({ client_id: "client_stepper_1", scope: "openid offline_access" });
    }
    return new Response("not found", { status: 404 });
};

function hrefFor(html, label) {
    const pattern = new RegExp(
        `<a class='slotbtn' href='([^']*)' aria-label='${label}'[^>]*>`
    );
    const match = html.match(pattern);
    return match ? match[1] : null;
}

function chipCount(html) {
    return (html.match(/class='chip(?: active)?'/g) || []).length;
}

/* =========================================================
   1. LOGIKA TRANSISI SLOT (murni, dipakai server)
   ========================================================= */

test("+ menambah slot auth dan langsung memilih slot baru", () => {
    assert.deepEqual(applyOpusSlotAction({ slot: 1, count: 1 }, "plus"), { slot: 2, count: 2 });
    assert.deepEqual(applyOpusSlotAction({ slot: 3, count: 3 }, "plus"), { slot: 4, count: 4 });
    assert.equal(opusSecretNameForSlot(4), "OPUS_AUTH_TOKEN_4");
});

test("- mengurangi slot dan menurunkan pilihan bila slot terpilih ikut hilang", () => {
    assert.deepEqual(applyOpusSlotAction({ slot: 3, count: 3 }, "minus"), { slot: 2, count: 2 });
    assert.deepEqual(applyOpusSlotAction({ slot: 2, count: 5 }, "minus"), { slot: 2, count: 4 });
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

test("nomor slot TIDAK dibatasi 9: 10, 99, 1000 dst tetap valid", () => {
    assert.equal(OPUS_MIN_SLOT, 1);
    assert.equal(OPUS_MAX_SAFE_SLOT, Number.MAX_SAFE_INTEGER);
    assert.equal(normalizeOpusSlot(9), 9);
    assert.equal(normalizeOpusSlot(10), 10);
    assert.equal(normalizeOpusSlot(99), 99);
    assert.equal(normalizeOpusSlot(1000), 1000);
    assert.equal(normalizeOpusSlot("123"), 123);
    assert.equal(opusSecretNameForSlot(12), "OPUS_AUTH_TOKEN_12");
    assert.equal(opusSecretNameForSlot(1000), "OPUS_AUTH_TOKEN_1000");

    assert.deepEqual(applyOpusSlotAction({ slot: 9, count: 9 }, "plus"), { slot: 10, count: 10 });
    assert.deepEqual(applyOpusSlotAction({ slot: 99, count: 99 }, "plus"), { slot: 100, count: 100 });
});

test("input tidak valid jatuh ke 1 dan angka raksasa dibatasi pengaman numerik", () => {
    assert.equal(normalizeOpusSlot(0), 1);
    assert.equal(normalizeOpusSlot(-4), 1);
    assert.equal(normalizeOpusSlot("abc"), 1);
    assert.equal(normalizeOpusSlot(Infinity), 1);
    assert.equal(normalizeOpusSlot(NaN), 1);
    assert.equal(normalizeOpusSlot(1e30), OPUS_MAX_SAFE_SLOT);

    /* Tetap tidak ada slot 0 / minus */
    assert.deepEqual(applyOpusSlotAction({ slot: 1, count: 1 }, "minus"), { slot: 1, count: 1 });
});

test("state awal dinormalisasi dan count tidak boleh lebih kecil dari slot", () => {
    assert.deepEqual(applyOpusSlotAction({ slot: 5, count: 2 }, "init"), { slot: 5, count: 5 });
    assert.deepEqual(applyOpusSlotAction(null, "init"), { slot: 1, count: 1 });
});

/* =========================================================
   2. TOMBOL + / - ADALAH TAUTAN (URL PASTI BERUBAH)
   ========================================================= */

test("halaman pembuka TIDAK bergantung JavaScript: + dan - berupa <a href>", () => {
    const html = buildLoginIntroHtml({ slot: 1, origin: ORIGIN });

    assert.doesNotMatch(html, /<script/);
    assert.doesNotMatch(html, /history\.replaceState/);
    assert.doesNotMatch(html, /localStorage/);
    assert.doesNotMatch(html, /ganti angka pada URL/);

    assert.match(html, /id='slotPlus'|aria-label='Tambah slot auth'/);
    assert.match(html, /aria-label='Kurangi slot auth'/);
    assert.match(html, /LANJUT LOGIN KE OPUS/);
    assert.match(html, /langsung mengganti alamat URL/);
    assert.match(html, /Jumlah slot <b>tidak dibatasi<\/b>/);
    assert.doesNotMatch(html, /Maksimal 9 slot/);
    assert.match(html, /Alamat: <b>\?slot=1&amp;count=1<\/b>/);

    assert.equal(
        hrefFor(html, "Tambah slot auth"),
        `${ORIGIN}${INTRO_PATH}?slot=2&amp;count=2`
    );

    /* chip dirender server, bukan oleh JavaScript */
    assert.match(html, /class='chip active'[^>]*>Slot 1<\/a>/);
    assert.equal(chipCount(html), 1);
});

test("klik + dari slot 3 / 5 slot menuju URL baru yang benar", () => {
    const html = buildLoginIntroHtml({ slot: 3, count: 5, origin: ORIGIN });

    assert.equal(
        hrefFor(html, "Tambah slot auth"),
        `${ORIGIN}${INTRO_PATH}?slot=6&amp;count=6`
    );
    assert.equal(
        hrefFor(html, "Kurangi slot auth"),
        `${ORIGIN}${INTRO_PATH}?slot=3&amp;count=4`
    );
    assert.equal(chipCount(html), 5);
    assert.match(html, /class='chip active' href='[^']*slot=3&amp;count=5'[^>]*>Slot 3<\/a>/);
    assert.match(html, /Slot 3 dari 5/);
    assert.match(html, /Slot: OPUS_AUTH_TOKEN_3/);
});

test("hanya batas bawah 1 yang dimatikan; + tetap aktif di atas 9", () => {
    const low = buildLoginIntroHtml({ slot: 1, count: 1, origin: ORIGIN });
    assert.match(low, /<span class='slotbtn is-disabled' aria-disabled='true' aria-label='Kurangi slot auth'>/);
    assert.equal(hrefFor(low, "Kurangi slot auth"), null);
    assert.ok(hrefFor(low, "Tambah slot auth"));

    for (const total of [9, 10, 25, 40, 100]) {
        const html = buildLoginIntroHtml({ slot: total, count: total, origin: ORIGIN });
        assert.ok(
            hrefFor(html, "Tambah slot auth"),
            `tombol + harus tetap aktif pada ${total} slot`
        );
        assert.ok(hrefFor(html, "Kurangi slot auth"));
        assert.doesNotMatch(html, /Maksimal 9 slot/);
    }
});

test("count yang lebih kecil dari slot dinormalkan agar tidak ada chip hilang", () => {
    const html = buildLoginIntroHtml({ slot: 5, count: 2, origin: ORIGIN });

    assert.equal(chipCount(html), 5);
    assert.match(html, /Slot 5 dari 5/);
    assert.match(html, /Alamat: <b>\?slot=5&amp;count=5<\/b>/);
});

test("tautan login membawa slot & count agar jumlah slot tidak hilang setelah OAuth", () => {
    const html = buildLoginIntroHtml({ slot: 3, count: 5, origin: ORIGIN });

    assert.match(html, /start=1&amp;slot=3&amp;count=5/);
});

test("origin di-escape pada href sehingga tidak bisa menyuntik tag", () => {
    const hostile = buildLoginIntroHtml({
        slot: 1,
        origin: "https://x.example/' onmouseover='alert(1)"
    });
    assert.doesNotMatch(hostile, /onmouseover='alert\(1\)/);
    assert.match(hostile, /&#39;/);
});

/* =========================================================
   3. ENDPOINT
   ========================================================= */

test("GET /api/opus-oauth-login?slot=2 merender tautan + / - tanpa script", async () => {
    const res = mockRes();
    await opusOAuthLogin(req(`${INTRO_PATH}?slot=2`), res);

    assert.equal(res.statusCode, 200);
    assert.match(res.body, /OPUS_AUTH_TOKEN_2/);
    assert.match(res.body, /aria-label='Tambah slot auth'/);
    assert.match(res.body, /aria-label='Kurangi slot auth'/);
    assert.match(res.body, /start=1&amp;slot=2&amp;count=2/);
    assert.doesNotMatch(res.body, /<script/);
});

test("GET /api/opus-oauth-login?slot=3&count=7 merender 7 chip server-side", async () => {
    const res = mockRes();
    await opusOAuthLogin(req(`${INTRO_PATH}?slot=3&count=7`), res);

    assert.equal(res.statusCode, 200);
    assert.equal(chipCount(res.body), 7);
    assert.match(res.body, /Slot 3 dari 7/);
    assert.match(res.body, /Alamat: <b>\?slot=3&amp;count=7<\/b>/);
});

test("?start=1 menyimpan count ke dalam state OAuth yang ditandatangani", async () => {
    await withFetch(START_FETCH, async () => {
        const env = { OPUS_LOGIN_STATE_SECRET: "stepper-secret" };
        const res = mockRes();
        await opusOAuthLogin(req(`${INTRO_PATH}?start=1&slot=4&count=6`, { env }), res);

        assert.equal(res.statusCode, 302);
        const location = new URL(res.headers.location);
        const decoded = await decodeOAuthState(location.searchParams.get("state"), { env });
        assert.ok(decoded);
        assert.equal(decoded.sl, 4);
        assert.equal(decoded.cn, 6);
    });
});

test("halaman error COBA LAGI mengembalikan slot & count yang sama", () => {
    const html = buildOpusLoginErrorHtml({
        message: "Sesi kedaluwarsa",
        slot: 4,
        count: 6,
        origin: ORIGIN
    });

    assert.match(html, /COBA LAGI/);
    assert.match(html, /\?slot=4&amp;count=6/);
});

test("callback error mempertahankan count dari state saat kembali ke halaman pembuka", async () => {
    const res = mockRes();
    await opusOAuthCallback(req("/api/opus-oauth-callback?error=access_denied&slot=4&count=6"), res);

    assert.equal(res.statusCode, 400);
    assert.match(res.body, /\?slot=4&amp;count=6/);
});

/* =========================================================
   4. TANPA BATAS ATAS — SLOT DI ATAS 9
   ========================================================= */

test("halaman slot 12: + menuju slot 13, badge & tautan login ikut benar", () => {
    const html = buildLoginIntroHtml({ slot: 12, count: 12, origin: ORIGIN });

    assert.match(html, /Slot: OPUS_AUTH_TOKEN_12/);
    assert.match(html, /Slot 12 dari 12/);
    assert.equal(chipCount(html), 12);
    assert.equal(
        hrefFor(html, "Tambah slot auth"),
        `${ORIGIN}${INTRO_PATH}?slot=13&amp;count=13`
    );
    assert.match(html, /start=1&amp;slot=12&amp;count=12/);
    assert.match(html, /Alamat: <b>\?slot=12&amp;count=12<\/b>/);
    assert.doesNotMatch(html, /Maksimal 9 slot/);
});

test("+ berulang kali bisa menembus 9, 20, 50, 100 tanpa hambatan", () => {
    let state = { slot: 1, count: 1 };
    for (let step = 0; step < 120; step += 1) {
        state = applyOpusSlotAction(state, "plus");
    }
    assert.deepEqual(state, { slot: 121, count: 121 });
    assert.equal(opusSecretNameForSlot(state.slot), "OPUS_AUTH_TOKEN_121");

    const html = buildLoginIntroHtml({ slot: state.slot, count: state.count, origin: ORIGIN });
    assert.match(html, /Slot: OPUS_AUTH_TOKEN_121/);
    assert.equal(
        hrefFor(html, "Tambah slot auth"),
        `${ORIGIN}${INTRO_PATH}?slot=122&amp;count=122`
    );
});

test("halaman sukses & error memakai nama secret slot besar", () => {
    const success = buildOpusLoginSuccessHtml({ compactJson: "{}", slot: 42, status: 200 });
    assert.match(success, /OPUS_AUTH_TOKEN_42/);

    const error = buildOpusLoginErrorHtml({ message: "Gagal", slot: 42, count: 50, origin: ORIGIN });
    assert.match(error, /\?slot=42&amp;count=50/);
});

test("endpoint menerima slot & count di atas 9", async () => {
    const res = mockRes();
    await opusOAuthLogin(req(`${INTRO_PATH}?slot=37&count=40`), res);

    assert.equal(res.statusCode, 200);
    assert.match(res.body, /Slot: OPUS_AUTH_TOKEN_37/);
    assert.match(res.body, /Slot 37 dari 40/);
    assert.match(res.body, /start=1&amp;slot=37&amp;count=40/);
    assert.equal(chipCount(res.body), 40);
});

test("callback error mempertahankan slot besar", async () => {
    const res = mockRes();
    await opusOAuthCallback(req("/api/opus-oauth-callback?error=access_denied&slot=42&count=50"), res);

    assert.equal(res.statusCode, 400);
    assert.match(res.body, /\?slot=42&amp;count=50/);
});

/* =========================================================
   5. JENDELA CHIP (HTML tetap kecil walau slot sangat banyak)
   ========================================================= */

test("getOpusChipRange menampilkan semua slot saat jumlah masih kecil", () => {
    assert.deepEqual(getOpusChipRange(3, 5), { start: 1, end: 5, windowed: false });
    assert.deepEqual(getOpusChipRange(1, 1), { start: 1, end: 1, windowed: false });
    assert.deepEqual(getOpusChipRange(20, OPUS_CHIP_WINDOW), {
        start: 1,
        end: OPUS_CHIP_WINDOW,
        windowed: false
    });
});

test("getOpusChipRange menjaga jendela tetap di dalam batas 1..total", () => {
    const first = getOpusChipRange(1, 1000);
    assert.equal(first.start, 1);
    assert.equal(first.end, OPUS_CHIP_WINDOW);
    assert.equal(first.windowed, true);

    const last = getOpusChipRange(1000, 1000);
    assert.equal(last.start, 1000 - OPUS_CHIP_WINDOW + 1);
    assert.equal(last.end, 1000);

    const middle = getOpusChipRange(500, 1000);
    assert.ok(middle.start < 500 && middle.end > 500);
    assert.equal(middle.end - middle.start + 1, OPUS_CHIP_WINDOW);
});

test("count sangat besar tetap menghasilkan HTML kecil dengan tautan lompat", () => {
    const html = buildLoginIntroHtml({ slot: 500, count: 100000, origin: ORIGIN });

    assert.ok(html.length < 30000, `HTML terlalu besar: ${html.length} karakter`);
    assert.equal(chipCount(html), OPUS_CHIP_WINDOW);
    assert.match(html, /class='chip chip--jump'/);
    assert.match(html, /&laquo; 1/);
    assert.match(html, /100000 &raquo;/);
    assert.match(html, /Chip \d+–\d+ dari 100000/);
    assert.match(html, /Slot: OPUS_AUTH_TOKEN_500/);
    assert.equal(
        hrefFor(html, "Tambah slot auth"),
        `${ORIGIN}${INTRO_PATH}?slot=100001&amp;count=100001`
    );
});

test("URL dengan angka tidak masuk akal tidak membuat server meledak", () => {
    const html = buildLoginIntroHtml({
        slot: "999999999999999999999999",
        count: "999999999999999999999999",
        origin: ORIGIN
    });

    assert.ok(Number.isFinite(html.length));
    assert.equal(chipCount(html), OPUS_CHIP_WINDOW);
    assert.match(html, /tidak dibatasi/);
});
