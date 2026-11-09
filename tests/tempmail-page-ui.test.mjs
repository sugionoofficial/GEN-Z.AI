import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

/* =========================================================
   TEMPMAIL — HALAMAN & MENU NAVIGASI
   ---------------------------------------------------------
   Yang dijaga:
   1. Menu "TempMail" hanya muncul untuk admin/owner dan
      mengarah ke /email.html yang ikut di-build ke dist.
   2. Halaman memulihkan alias yang sudah ada saat dibuka
      (action=alias) sehingga alamat tidak hilang setelah reload.
   3. Isi email dari pengirim luar dirender di iframe sandbox,
      bukan innerHTML di origin aplikasi (cegah XSS / token
      Supabase dicuri).
   4. Halaman memakai session helper bersama + light theme.
========================================================= */

const ROOT = process.cwd();

function readRepoFile(relativePath) {
    return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function extractFunctionSource(source, signature) {
    const start = source.indexOf(signature);
    assert.notEqual(start, -1, `Expected to find ${signature}`);
    const openBrace = source.indexOf("{", start);
    assert.notEqual(openBrace, -1, `Expected opening brace for ${signature}`);

    let depth = 0;
    for (let index = openBrace; index < source.length; index += 1) {
        const ch = source[index];
        if (ch === "{") depth += 1;
        else if (ch === "}") {
            depth -= 1;
            if (depth === 0) {
                return source.slice(start, index + 1);
            }
        }
    }

    assert.fail(`Unclosed function body for ${signature}`);
}

test("menu TempMail tersedia untuk admin/owner dan tidak muncul untuk user biasa", () => {
    const navigationSource = readRepoFile("navigation/navigation.js");
    const getNavConfigSrc = extractFunctionSource(
        navigationSource,
        "function getNavigationConfig(role)"
    );

    const context = vm.createContext({ Object });
    vm.runInContext(`${getNavConfigSrc}\nthis.getNavigationConfig = getNavigationConfig;`, context);

    for (const role of ["admin", "owner"]) {
        const item = context
            .getNavigationConfig(role)
            .find(menuItem => menuItem.label === "TempMail");

        assert.ok(item, `Expected menu TempMail untuk role="${role}"`);
        assert.equal(item.href, "/email.html");
        assert.match(item.icon, /^<svg\b[\s\S]*<\/svg>$/);
    }

    const userItems = context.getNavigationConfig("user");
    assert.equal(
        userItems.some(menuItem => menuItem.label === "TempMail"),
        false,
        "TempMail tidak boleh tampil untuk user biasa"
    );
});

test("email.html ikut di-build ke dist agar menu navigasi tidak 404", () => {
    const buildScript = readRepoFile("scripts/build-cloudflare-pages.mjs");
    assert.match(buildScript, /"email\.html"/);
});

test("halaman TempMail memuat navigasi bersama, config, dan light theme", () => {
    const page = readRepoFile("email.html");

    assert.match(page, /<script src="\/assets\/js\/config\.js"><\/script>/);
    assert.match(page, /src="\/navigation\/navigation\.js\?v=[^"]+"/);
    assert.match(page, /href="\/assets\/css\/tempmail-light\.css\?v=[^"]+"/);
    assert.match(page, /id="status"[^>]*aria-live="polite"/);
});

test("halaman TempMail memulihkan alias lama dan menyegarkan token sebelum request", () => {
    const page = readRepoFile("email.html");

    assert.match(page, /action=alias/);
    assert.match(page, /loadExistingAlias/);
    assert.match(page, /ensureFreshSession/);
    assert.match(page, /response\.status === 401/);
});

test("isi email dirender di iframe sandbox, bukan innerHTML di origin aplikasi", () => {
    const page = readRepoFile("email.html");

    assert.match(page, /<iframe[\s\S]*?id="message-frame"[\s\S]*?sandbox=""/);
    assert.match(page, /Content-Security-Policy/);
    assert.match(page, /messageFrame\.srcdoc/);

    // Pola lama yang berbahaya: HTML email dari pengirim luar
    // ditulis langsung ke DOM halaman aplikasi.
    assert.doesNotMatch(page, /message-content/);
    assert.doesNotMatch(page, /innerHTML\s*=\s*content/);
    assert.doesNotMatch(page, /msg\.body_html/);
    assert.doesNotMatch(page, /list\.innerHTML/);
});

test("daftar pesan memakai textContent supaya subject pengirim tidak bisa injeksi HTML", () => {
    const page = readRepoFile("email.html");
    const subjectBlock = page.match(
        /subject\.textContent\s*=[\s\S]{0,120}/
    );

    assert.ok(subjectBlock, "expected subject dirender lewat textContent");
    assert.doesNotMatch(page, /\$\{msg\.subject\}/);
    assert.doesNotMatch(page, /\$\{msg\.from_addr\}/);
});

test("light theme ikut menata elemen inbox dan iframe body yang baru", () => {
    const lightCss = readRepoFile("assets/css/tempmail-light.css");

    assert.match(lightCss, /body \.msg-frame/);
    assert.match(lightCss, /body \.msg-text/);
    assert.match(lightCss, /body \.inbox-meta/);
});
