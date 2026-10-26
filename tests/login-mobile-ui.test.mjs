import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const login = readFileSync(new URL("../login.html", import.meta.url), "utf8");

test("Login HP: WELCOME BACK dihapus — cukup judul 'Masuk ke akun Anda'", () => {
    assert.doesNotMatch(login, /WELCOME BACK/i, "Teks WELCOME BACK harus dihapus");
    assert.doesNotMatch(login, /login-kicker/, "Kelas login-kicker harus dihapus total");
    assert.match(login, /<h1>\s*Masuk ke akun Anda\s*<\/h1>/, "Judul Masuk ke akun Anda harus tetap ada");
});

test("Login: logo tidak bisa diunduh/diseret + center di mode HP", () => {
    assert.match(login, /class="brand-logo-img"[\s\S]{0,250}?draggable="false"/, "Logo harus draggable=false");
    assert.match(login, /\.brand-logo-img\s*\{[^}]*?pointer-events:\s*none/, "CSS logo harus pointer-events none (blokir long-press/right-click)");
    assert.match(login, /\.brand-logo-img\s*\{[^}]*?-webkit-user-drag:\s*none/, "CSS logo harus -webkit-user-drag none");
    assert.match(login, /\.brand-logo-img\s*\{[^}]*?margin-left:\s*auto/, "Logo harus center (margin auto) di mode HP");
});

test("Login HP: blok brand lebih pendek (deskripsi & footer disembunyikan, min-height 310px dihapus)", () => {
    assert.doesNotMatch(login, /min-height:\s*310px/, "min-height 310px lama tidak boleh kembali");
    assert.match(login, /\.brand-description\s*\{[^}]*?display:\s*none/, "brand-description harus disembunyikan di HP");
    assert.match(login, /\.brand-footer\s*\{[^}]*?display:\s*none/, "brand-footer harus disembunyikan di HP");
});

test("Login: tombol LOGIN hijau terang & REGISTER merah terang dengan ukuran sama", () => {
    assert.match(login, /\.login-button\s*\{[^}]*?#4ef08a/, "Tombol LOGIN harus hijau terang (#4ef08a)");
    assert.match(login, /\.login-button\s*\{[^}]*?color:\s*#04260f/, "Teks tombol LOGIN harus gelap di atas hijau terang");
    assert.match(login, /\.register-link-button\s*\{[^}]*?#ff4d5e/, "Tombol REGISTER harus merah terang (#ff4d5e)");
    assert.match(
        login,
        /\.register-link-button\s*\{[^}]*?height:\s*var\(--login-input-height\)/,
        "Tinggi tombol REGISTER harus sama dengan tombol LOGIN (var --login-input-height)"
    );
    assert.match(login, /\.register-link-button\s*\{[^}]*?width:\s*100%/, "Lebar tombol REGISTER harus 100% seperti LOGIN");
    assert.match(login, /@media \(max-width: 600px\)\s*\{\s*\.register-link-button\s*\{\s*height:\s*53px/, "Tinggi tombol REGISTER harus ikut 53px di HP");
    assert.match(login, /@media \(max-width: 370px\)\s*\{\s*\.register-link-button\s*\{\s*height:\s*50px/, "Tinggi tombol REGISTER harus ikut 50px di HP kecil");
});
