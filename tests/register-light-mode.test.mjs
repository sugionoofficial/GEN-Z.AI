import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const registerHtml = readFileSync(new URL("../register.html", import.meta.url), "utf8");
const themeJs = readFileSync(new URL("../assets/js/theme.js", import.meta.url), "utf8");

test("register.html menjaga variabel --text di mode gelap dan tidak mengunci data-genz-theme di <html>", () => {
    assert.match(registerHtml, /<html\s+lang="id"\s*>/, "tag <html> tidak boleh mengunci data-genz-theme");
    assert.match(
        registerHtml,
        /:root\s*\{[\s\S]*?--text:\s*#ffffff\s*;/,
        ":root harus mendeklarasikan --text: #ffffff untuk mode gelap"
    );
    assert.match(
        registerHtml,
        /\.input-wrapper\s+input\s*\{[\s\S]*?color:\s*var\(--text\)\s*;/,
        "input harus memakai var(--text) agar terbaca di mode gelap maupun cerah"
    );
});

test("register.html mode cerah mengganti background gradient gelap pada .card dan .form-side", () => {
    assert.match(
        registerHtml,
        /html\[data-genz-theme="light"\]\[data-genz-theme="light"\]\s+body\s+\.card\s*\{[^}]*background:\s*#ffffff\s*;/,
        ".card di mode cerah wajib memakai shorthand background terang agar linear-gradient hitam hilang"
    );
    assert.match(
        registerHtml,
        /html\[data-genz-theme="light"\]\[data-genz-theme="light"\]\s+body\s+\.form-side\s*\{[^}]*background:\s*#ffffff\s*;[^}]*color:\s*#101828\s*;/,
        ".form-side di mode cerah harus putih dengan teks gelap"
    );
});

test("register.html mode cerah menjaga kontras semua teks, label, tombol Login, pesan, dan syarat password", () => {
    assert.match(
        registerHtml,
        /html\[data-genz-theme="light"\]\[data-genz-theme="light"\]\s+body\s+\.label\s*\{[^}]*color:\s*#344054\s*!important\s*;/,
        "label form di mode cerah harus gelap kontras"
    );
    assert.match(
        registerHtml,
        /html\[data-genz-theme="light"\]\[data-genz-theme="light"\]\s+body\s+\.login-link-button\s*\{[^}]*color:\s*#101828\s*;/,
        "tombol Login di mode cerah tidak boleh putih di atas putih"
    );
    assert.match(
        registerHtml,
        /html\[data-genz-theme="light"\]\[data-genz-theme="light"\]\s+body\s+\.toggle-password:hover\s*\{[^}]*color:\s*#101828\s*;/,
        "ikon toggle password saat hover di mode cerah tidak boleh berubah putih"
    );
    assert.match(
        registerHtml,
        /html\[data-genz-theme="light"\]\[data-genz-theme="light"\]\s+body\s+\.message\.error\s*\{[^}]*color:\s*#b42318\s*;/,
        "pesan error di mode cerah harus kontras tinggi"
    );
    assert.match(
        registerHtml,
        /html\[data-genz-theme="light"\]\[data-genz-theme="light"\]\s+body\s+\.message\.success\s*\{[^}]*color:\s*#067647\s*;/,
        "pesan sukses di mode cerah harus kontras tinggi"
    );
    assert.match(
        registerHtml,
        /html\[data-genz-theme="light"\]\[data-genz-theme="light"\]\s+body\s+\.requirements\s+\.requirement\.valid\s*\{[^}]*color:\s*#067647\s*;/,
        "syarat password valid di mode cerah harus hijau tua yang terbaca di atas latar terang"
    );
});

test("panel .visual (dark island) menjaga teks deskripsi tetap terang di mode cerah", () => {
    assert.match(
        registerHtml,
        /html\[data-genz-theme="light"\]\[data-genz-theme="light"\]\s+body\s+\.visual\s+\.visual-description\s*\{[^}]*color:\s*#c2c7d2\s*!important\s*;/,
        ".visual-description harus tetap terang dengan !important di dalam dark island"
    );
    assert.match(
        themeJs,
        /html\[data-genz-theme="light"\]\s+body\s+:is\(\.brand-panel,\s*\.visual\)\s+:is\([\s\S]*?\.visual-description[\s\S]*?\)\s*\{\s*color:\s*rgba\(255,\s*255,\s*255,\s*\.72\)\s*!important\s*;/,
        "theme.js harus melindungi deskripsi di dalam dark island dari aturan [class*=\"-desc\"] !important"
    );
    assert.doesNotMatch(
        themeJs,
        /\.requirement\s*,/,
        "theme.js harus menargetkan container .requirements, bukan baris item .requirement"
    );
});
