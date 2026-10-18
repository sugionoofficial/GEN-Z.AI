/*
 * Regresi: teks "Menghubungkan ke tim support..." tidak boleh
 * nyangkut di role admin/user setelah chat berhasil dibuka.
 *
 * Bug lama:
 * 1. Jalur support agent (role ADMIN/OWNER) tanpa percakapan
 *    aktif tidak pernah memanggil setFeedback("") — teks
 *    loading permanen di panel.
 * 2. setFeedback(CONNECTION...) dipasang SEBELUM guard
 *    if (busy) return — panggilan ganda bisa menanam teks
 *    lalu keluar tanpa membersihkannya.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
    new URL("../assets/js/support-chat.js", import.meta.url),
    "utf8"
);

test("support-chat: teks koneksi memakai konstanta CONNECTION_FEEDBACK_TEXT", () => {
    assert.match(
        source,
        /const CONNECTION_FEEDBACK_TEXT = "Menghubungkan ke tim support\.\.\."/
    );
});

test("support-chat: guard busy harus dieksekusi sebelum teks koneksi dipasang", () => {
    const busyIndex = source.indexOf("if (busy) return;");
    const setTextIndex = source.indexOf(
        "setFeedback(CONNECTION_FEEDBACK_TEXT);"
    );

    assert.ok(busyIndex > -1, "guard if (busy) return harus ada");
    assert.ok(setTextIndex > -1, "setFeedback(CONNECTION_FEEDBACK_TEXT) harus ada");
    assert.ok(
        setTextIndex > busyIndex,
        "teks koneksi tidak boleh dipasang sebelum guard busy"
    );
});

test("support-chat: jalur inbox admin tanpa percakapan membersihkan feedback", () => {
    assert.match(
        source,
        /renderEmpty\("Pilih percakapan untuk mulai membalas\."\);\s*setFeedback\(""\);/
    );
});

test("support-chat: openChat punya safety check di akhir jalur sukses", () => {
    assert.match(
        source,
        /if \(feedback\.textContent === CONNECTION_FEEDBACK_TEXT\) \{\s*setFeedback\(""\);\s*\}/
    );
});
