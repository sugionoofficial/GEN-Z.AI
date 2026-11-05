import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const baca = nama => readFileSync(new URL(`../migrasi/${nama}`, import.meta.url), "utf8");

const PETA = baca("peta-url-lama.sql");
const REWRITE = baca("rewrite-url-lama.sql");
const VERIFIKASI = baca("verifikasi-url-baru.sql");

const LAMA = "ycovbqmezhrvzobxqnyp";
const BARU = "rvgioyenjgkprnssfpfr";

/* ---------------------------------------------------------------------
   Rewrite URL adalah satu-satunya langkah migrasi yang MENGUBAH data
   produksi. Kesalahan kecil di sini tidak bisa dibatalkan setelah project
   lama di-pause, jadi ketiga skrip dikunci oleh test.
   --------------------------------------------------------------------- */

test("peta-url-lama.sql hanya membaca, tidak pernah mengubah data", () => {
    const tanpaKomentar = PETA.replace(/--[^\n]*/g, "");
    assert.ok(!/\bupdate\b/i.test(tanpaKomentar), "skrip peta tidak boleh berisi UPDATE");
    assert.ok(!/\bdelete\b/i.test(tanpaKomentar), "skrip peta tidak boleh berisi DELETE");
    assert.ok(!/\binsert\b/i.test(tanpaKomentar), "skrip peta tidak boleh berisi INSERT");
    assert.match(PETA, new RegExp(`%${LAMA}%`), "harus mencari alamat project lama");
});

test("rewrite-url-lama.sql hanya menulis ke schema public dan kolom teks", () => {
    assert.match(REWRITE, /where c\.table_schema = 'public'/, "batasi ke schema public");
    assert.match(REWRITE, /c\.data_type in \('text', 'character varying', 'character'\)/, "kolom teks");
    assert.match(REWRITE, /c\.udt_name in \('text', 'varchar', 'bpchar', 'citext'\)/, "termasuk bpchar");
    assert.match(REWRITE, /c\.column_name not like 'encrypted\\_%'/, "kolom terenkripsi tidak disentuh");

    const tanpaKomentar = REWRITE.replace(/--[^\n]*/g, "");
    assert.ok(!/\bdelete\b/i.test(tanpaKomentar), "rewrite tidak boleh menghapus baris");
    assert.ok(!/\bdrop\b/i.test(tanpaKomentar), "rewrite tidak boleh menghapus objek");
    assert.ok(!/\btruncate\b/i.test(tanpaKomentar), "rewrite tidak boleh mengosongkan tabel");
    assert.match(tanpaKomentar, /replace\(/, "perubahan harus lewat replace, bukan menimpa nilai");
});

test("rewrite-url-lama.sql mengganti jejak lama ke jejak baru, bukan sebaliknya", () => {
    assert.match(REWRITE, new RegExp(`jejak_lama constant text := '${LAMA}'`));
    assert.match(REWRITE, new RegExp(`jejak_baru constant text := '${BARU}'`));

    /* Arah terbalik akan merusak data: project baru ditimpa project lama. */
    const barisLama = REWRITE.split("\n").find(baris => baris.includes("jejak_lama constant"));
    assert.ok(!barisLama.includes(BARU), "jejak_lama tidak boleh berisi nama project baru");
});

test("rewrite-url-lama.sql menangani kolom padat character(n) / bpchar", () => {
    /*
     * Regresi nyata: versi pertama hanya memeriksa text & varchar sehingga
     * kolom bpchar tidak pernah di-rewrite, dan `replace()` tanpa cast akan
     * gagal pada tipe itu. Sisa 4 baris di produksi berasal dari celah ini.
     */
    assert.match(REWRITE, /udt_name in \('text', 'varchar', 'bpchar', 'citext'\)/);
    assert.match(REWRITE, /format_type\(/, "cast balik harus memakai tipe asli kolom");
    assert.match(REWRITE, /::%s where/, "nilai harus di-cast ke tipe aslinya");
});

test("rewrite-url-lama.sql aman dijalankan ulang", () => {
    /* Syarat LIKE membuat baris yang sudah bersih tidak tersentuh lagi. */
    assert.match(REWRITE, /where %I::text like %L/);
    assert.match(REWRITE, /pola_pencarian constant text := '%ycovbqmezhrvzobxqnyp%'/);
});

test("rewrite-url-lama.sql berjalan sebagai satu statement", () => {
    /*
     * SQL Editor hanya menampilkan hasil query terakhir. Satu DO block =
     * satu statement, sehingga tidak ada langkah yang diam-diam terlewat.
     */
    const pembuka = REWRITE.indexOf("do $$");
    const penutup = REWRITE.lastIndexOf("$$;");

    assert.ok(pembuka > -1, "harus berupa DO block");
    assert.ok(penutup > pembuka, "DO block harus ditutup dengan '$$;'");
    assert.equal(REWRITE.split("do $$").length - 1, 1, "hanya boleh ada satu DO block");

    /* Di luar DO block tidak boleh ada statement lain. */
    const luarBlok = (REWRITE.slice(0, pembuka) + REWRITE.slice(penutup + 3))
        .replace(/--[^\n]*/g, "");
    assert.equal(luarBlok.split(";").filter(bagian => bagian.trim()).length, 0,
        "tidak boleh ada statement tambahan di luar DO block");
});

test("verifikasi-url-baru.sql melaporkan sisa alamat lama DAN alamat baru terpasang", () => {
    assert.match(VERIFIKASI, /as sisa_url_lama/);
    assert.match(VERIFIKASI, /as referensi_url_baru/);
    assert.match(VERIFIKASI, /BERSIH — aman lanjut pause project lama/);
    assert.match(VERIFIKASI, /MASIH ADA URL LAMA/);

    const tanpaKomentar = VERIFIKASI.replace(/--[^\n]*/g, "");
    assert.ok(!/\bupdate\b/i.test(tanpaKomentar), "verifikasi harus read-only");
});

test("skrip migrasi tidak memuat rahasia apa pun", () => {
    for (const [nama, isi] of [["peta", PETA], ["rewrite", REWRITE], ["verifikasi", VERIFIKASI]]) {
        assert.ok(!/service_role|sb_secret|eyJhbGciOi|password\s*=/i.test(isi), `${nama} tidak boleh memuat kredensial`);
    }
});

test("ketiga berkas memakai cakupan tipe kolom yang sama", () => {
    /* Kalau pemetaan, rewrite, dan verifikasi memakai daftar tipe berbeda,
       hasil "BERSIH" tidak bisa dipercaya. */
    const pola = /udt_name in \('text', 'varchar', 'bpchar', 'citext'\)/;
    for (const [nama, isi] of [["peta", PETA], ["rewrite", REWRITE], ["verifikasi", VERIFIKASI]]) {
        assert.match(isi, pola, `${nama} harus memeriksa bpchar juga`);
    }
});
