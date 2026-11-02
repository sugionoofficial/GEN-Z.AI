import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/* =========================================================
   BLACK BOX // REGISTRASI — HANYA EMAIL @GMAIL.COM
   ---------------------------------------------------------
   Yang dijaga di sini:
   1. register.html menolak email selain @gmail.com SEBELUM
      signUp dipanggil (lapisan UI).
   2. Supabase punya hard stop di database (lapisan DB):
      trigger BEFORE INSERT on auth.users menolak domain
      lain, jadi pintasan UI tidak bisa lewat.
   3. Pesan errornya berbahasa Indonesia dan jelas.
   ========================================================= */

const registerHtml = readFileSync(new URL("../register.html", import.meta.url), "utf8");
const restrictSql = readFileSync(new URL("../supabase/restrict-registration-gmail.sql", import.meta.url), "utf8");

test("register.html memvalidasi domain @gmail.com sebelum signUp dipanggil", () => {
    const gateIndex = registerHtml.indexOf("!email.endsWith(\"@gmail.com\")");
    const signUpIndex = registerHtml.indexOf(".signUp(");

    assert.notEqual(gateIndex, -1, "harus ada pemeriksaan email.endsWith(\"@gmail.com\")");
    assert.notEqual(signUpIndex, -1, "register.html harus memanggil signUp");
    assert.ok(
        gateIndex < signUpIndex,
        "pemeriksaan domain wajib berjalan sebelum signUp dikirim ke Supabase"
    );
});

test("register.html menampilkan pesan Indonesia yang jelas untuk penolakan domain", () => {
    assert.match(
        registerHtml,
        /Pendaftaran hanya boleh menggunakan email Gmail \(@gmail\.com\)\./,
        "pesan penolakan wajib ada di sisi validasi form"
    );
    assert.match(
        registerHtml,
        /Masukkan email Gmail \(@gmail\.com\)/,
        "placeholder kolom email wajib memberi tahu aturan Gmail sejak awal"
    );
});

test("register.html menerjemahkan penolakan dari server (trigger DB) jadi pesan Gmail", () => {
    const mapperIndex = registerHtml.indexOf("function getErrorMessage(");
    const gateIndex = registerHtml.indexOf("!email.endsWith(\"@gmail.com\")");

    assert.notEqual(mapperIndex, -1, "fungsi getErrorMessage wajib ada");
    assert.notEqual(gateIndex, -1, "pemeriksaan domain wajib ada");

    /* getErrorMessage membandingkan pesan dalam huruf kecil,
       jadi penandanya juga wajib huruf kecil. */
    const mapperSource = registerHtml.slice(mapperIndex, mapperIndex + 4000);

    assert.match(
        mapperSource,
        /message =\s*\n?\s*String\(\s*error\?\.message \|\| ""\s*\)\.toLowerCase\(\)/,
        "pesan error wajib dinormalisasi ke huruf kecil sebelum dicocokkan"
    );
    assert.match(
        mapperSource,
        /message\.includes\(\s*"email_domain_not_allowed"\s*\)/,
        "penanda email_domain_not_allowed dari trigger DB wajib dikenali"
    );
    assert.match(
        mapperSource,
        /message\.includes\(\s*"database error saving new user"\s*\)/,
        "GoTrue membungkus penolakan trigger jadi 'Database error saving new user' — wajib dipetakan juga (huruf kecil)"
    );
    assert.ok(
        !/message\.includes\(\s*"Database error saving new user"\s*\)/.test(mapperSource),
        "penanda berhuruf kapital tidak akan pernah cocok terhadap pesan yang sudah di-lowercase"
    );
});

test("trigger SQL menolak domain non-gmail langsung di auth.users", () => {
    assert.match(
        restrictSql,
        /create trigger block_non_gmail_signup_trg\s+before insert on auth\.users/i,
        "trigger wajib BEFORE INSERT on auth.users supaya semua jalur pendaftaran terjaga"
    );
    assert.match(
        restrictSql,
        /lower\(split_part\(coalesce\(new\.email,\s*''\), '@', 2\)\)\s*not in \('gmail\.com'\)/,
        "penolakan wajib membandingkan domain secara case-insensitive"
    );
    assert.match(
        restrictSql,
        /email_domain_not_allowed/,
        "pengecualian wajib membawa penanda email_domain_not_allowed"
    );
});

test("SQL bersifat idempotent dan aman dijalankan berulang", () => {
    assert.match(restrictSql, /create or replace function public\.block_non_gmail_signup\(\)/i);
    assert.match(restrictSql, /drop trigger if exists block_non_gmail_signup_trg/i);
});
