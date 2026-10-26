import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sw = readFileSync(new URL("../service-worker.js", import.meta.url), "utf8");

test("Service worker memaksa HTML segar dari server setiap navigasi (anti halaman basi)", () => {
    assert.match(sw, /cache:\s*"no-cache"/, "Permintaan HTML harus cache:'no-cache' (paksa revalidasi ke server)");
    assert.match(sw, /request\.mode === "navigate"|text\/html/, "Hanya navigasi HTML yang dipaksa segar");
    assert.match(sw, /skipWaiting/, "SW baru harus langsung aktif");
    assert.match(sw, /clients\.claim/, "SW harus mengambil alih halaman yang sudah terbuka");
});

test("Service worker tidak menyimpan HTML di Cache API (tidak ada halaman basi yang nempel)", () => {
    assert.doesNotMatch(sw, /cache\.put/, "Dilarang menyimpan response HTML ke cache");
    assert.doesNotMatch(sw, /caches\.open/, "Dilarang membuat cache penyimpan halaman");
});
