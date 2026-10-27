import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const setHtml = readFileSync(
    fileURLToPath(new URL("../admin-control/studio-medsos-set.html", import.meta.url)),
    "utf8"
);

test("SET Studio Medsos: keterangan panjang dibungkus tombol View (halaman bersih)", () => {
    const viewBlocks = setHtml.match(/<details class="view-details">/g) || [];
    const viewButtons = setHtml.match(/<summary class="view-btn">/g) || [];
    assert.ok(
        viewBlocks.length >= 12,
        `Minimal 12 blok keterangan memakai <details class="view-details"> (sekarang ${viewBlocks.length})`
    );
    assert.equal(viewBlocks.length, viewButtons.length, "Setiap view-details harus punya tombol View");
    assert.match(setHtml, /<span class="view-open">View<\/span>/, "Tombol View harus bertuliskan View");
    assert.match(setHtml, /<span class="view-close">Tutup<\/span>/, "Saat terbuka tombol berubah menjadi Tutup");
});

test("SET Studio Medsos: label provider ringkas — keterangan pindah ke balik View", () => {
    const labels = setHtml.match(/<label class="provider-option">[\s\S]*?<\/label>/g) || [];
    assert.equal(labels.length, 10, "Harus ada 10 opsi provider (6 gambar + 4 teks)");
    for (const label of labels) {
        const visibleText = label.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        assert.ok(
            visibleText.length <= 140,
            `Label provider harus ringkas (maks 140 karakter), ditemukan ${visibleText.length}: ${visibleText.slice(0, 60)}…`
        );
    }
    assert.doesNotMatch(
        setHtml,
        /<label class="provider-option">(?:(?!<\/label>)[\s\S])*menerima foto karakter \(dan foto outfit\)/,
        "Keterangan panjang provider Cloudflare tidak boleh tampil langsung di label"
    );
});

test("SET Studio Medsos: keterangan yang diwajibkan tes lama tetap ada di halaman", () => {
    for (const phrase of [
        "akun Puter Anda sendiri",
        "PUTER_AUTH_TOKEN",
        "model teks TokenHub",
        "flux-2-klein-4b",
        "hy-image-v3.5-preview",
        "qwen3-vl-plus",
    ]) {
        assert.ok(
            setHtml.toLowerCase().includes(phrase.toLowerCase()),
            `Frasa keterangan "${phrase}" harus tetap tersimpan di halaman`
        );
    }
});
