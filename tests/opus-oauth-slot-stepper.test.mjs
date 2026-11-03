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
    OPUS_MAX_SLOT,
    applyOpusSlotAction,
    buildLoginIntroHtml,
    buildOpusLoginErrorHtml,
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

test("batas 1..9 konsisten dengan normalizeOpusSlot di server", () => {
    assert.equal(OPUS_MAX_SLOT, 9);
    assert.equal(normalizeOpusSlot(99), OPUS_MAX_SLOT);
    assert.equal(normalizeOpusSlot(-4), 1);
    assert.equal(normalizeOpusSlot("7"), 7);

    const capped = applyOpusSlotAction({ slot: 9, count: 9 }, "plus");
    assert.deepEqual(capped, { slot: 9, count: 9 });
    assert.equal(opusSecretNameForSlot(capped.slot), "OPUS_AUTH_TOKEN_9");
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

test("batas bawah 1 dan atas 9 memakai elemen non-tautan yang dimatikan", () => {
    const low = buildLoginIntroHtml({ slot: 1, count: 1, origin: ORIGIN });
    assert.match(low, /<span class='slotbtn is-disabled' aria-disabled='true' aria-label='Kurangi slot auth'>/);
    assert.equal(hrefFor(low, "Kurangi slot auth"), null);
    assert.ok(hrefFor(low, "Tambah slot auth"));

    const high = buildLoginIntroHtml({ slot: 9, count: 9, origin: ORIGIN });
    assert.match(high, /<span class='slotbtn is-disabled' aria-disabled='true' aria-label='Tambah slot auth'>/);
    assert.equal(hrefFor(high, "Tambah slot auth"), null);
    assert.ok(hrefFor(high, "Kurangi slot auth"));
    assert.equal(chipCount(high), 9);
    assert.match(high, /Slot: OPUS_AUTH_TOKEN_9/);
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
