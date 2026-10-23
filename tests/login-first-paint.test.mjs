import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/*
 * REGRESSION: halaman login tidak boleh "mampir" ke desain lama.
 *
 * Penyebab lamanya: blok <style> PREMIUM LOGIN OVERRIDE ditaruh di akhir
 * <body>, SETELAH <script> CDN Supabase yang blocking. Browser sudah
 * melukis body (memakai assets/css/login.css = desain lama) sambil
 * menunggu script CDN selesai, jadi user sempat melihat halaman lain
 * sekilas sebelum tampilan login final muncul.
 *
 * Aturan yang dijaga test ini:
 *   1. Semua <style> harus berada di dalam <head> (sebelum <body>).
 *   2. Blok premium override harus berada SETELAH assets/css/login.css
 *      supaya urutan cascade tetap sama seperti sebelumnya.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rawHtml = readFileSync(path.join(root, "login.html"), "utf8");
// Komentar HTML bisa menyebut nama tag, jadi dibuang dulu sebelum dipindai.
const html = rawHtml.replace(/<!--[\s\S]*?-->/g, "");

const bodyIndex = html.indexOf("<body");
const headCloseIndex = html.indexOf("</head>");

test("login.html tidak punya <style> di dalam <body>", () => {
    assert.ok(bodyIndex > 0, "login.html harus punya tag <body>");

    const styleAfterBody = html.indexOf("<style", bodyIndex);
    assert.equal(
        styleAfterBody,
        -1,
        "tag <style> ditemukan setelah <body>; pindahkan ke <head> agar tidak ada kedipan desain lama"
    );

    const stylesInBody = [...html.slice(bodyIndex).matchAll(/<style\b/gi)];
    assert.equal(stylesInBody.length, 0);
});

test("login.html tidak memuat stylesheet setelah <body> dibuka", () => {
    const linkAfterBody = html.indexOf("<link", bodyIndex);
    assert.equal(linkAfterBody, -1, "tag <link> stylesheet/favicon tidak boleh berada di dalam <body>");
});

test("premium override ada di <head> dan setelah assets/css/login.css", () => {
    // Penanda isi blok premium override (bukan komentar).
    const premiumIndex = html.indexOf("--login-red:");
    const baseCssIndex = html.indexOf('href="assets/css/login.css"');

    assert.ok(premiumIndex > 0, "blok PREMIUM LOGIN OVERRIDE harus ada di login.html");
    assert.ok(premiumIndex < headCloseIndex, "blok premium override harus berada di dalam <head>");
    assert.ok(
        baseCssIndex > 0 && baseCssIndex < premiumIndex,
        "premium override harus dimuat setelah assets/css/login.css agar cascade tetap benar"
    );
});

test("variabel desain premium sudah aktif sebelum <body>", () => {
    const head = html.slice(0, headCloseIndex);

    for (const token of ["--login-red:", "--login-radius:", "--login-card:"]) {
        assert.ok(
            head.includes(token),
            `token desain ${token} harus dideklarasikan di <head> (bukan di akhir <body>)`
        );
    }

    // Ukuran kartu final (650px) harus sudah dipakai sejak render pertama.
    assert.match(
        head,
        /\.login-card\s*\{[^}]*min-height:\s*650px/s,
        "aturan .login-card final harus ada di <head>"
    );
});

test("script CDN Supabase tetap setelah markup kartu login", () => {
    const supabaseIndex = html.indexOf("cdn.jsdelivr.net/npm/@supabase/supabase-js");
    const formIndex = html.indexOf('id="loginForm"') >= 0
        ? html.indexOf('id="loginForm"')
        : html.indexOf('id="loginButton"');

    assert.ok(supabaseIndex > 0, "script Supabase harus tetap dimuat");
    assert.ok(formIndex > 0, "form login harus tetap ada");
    assert.ok(
        formIndex < supabaseIndex,
        "markup form login harus dirender sebelum script CDN yang blocking"
    );
});
