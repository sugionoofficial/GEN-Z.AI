import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const source = readFileSync(
    fileURLToPath(new URL("../admin-control/social-publisher.js", import.meta.url)),
    "utf8"
);

function declarationIndent(pattern) {
    const match = source.match(new RegExp(`^([ \\t]*)${pattern}`, "m"));
    assert.ok(match, `Deklarasi ${pattern} tidak ditemukan di admin-control/social-publisher.js`);
    return match[1].length;
}

test("uploadGarment berada di scope utama IIFE agar tombol Atur pakaian berfungsi", () => {
    // Regresi: uploadGarment pernah nested di dalam editCharacter sehingga
    // klik "Atur pakaian"/"Ganti pakaian" melempar ReferenceError dan karakter
    // tidak pernah punya garment_object_key untuk Cloudflare P-Image Try-On.
    assert.equal(
        declarationIndent("async function uploadGarment\\("),
        declarationIndent("async function editCharacter\\("),
        "uploadGarment harus sejajar dengan editCharacter (scope utama IIFE), bukan nested di dalamnya"
    );
    assert.match(
        source,
        /addEventListener\("click", \(\) => uploadGarment\(character\)\)/,
        "Tombol pakaian pada daftar karakter harus memanggil uploadGarment"
    );
});

test("posting manual menolak lebih dulu karakter tanpa foto pakaian saat provider Cloudflare", () => {
    const manualPost = source.slice(source.indexOf("async function submitManualPost"));
    const guardIndex = manualPost.indexOf("garment_filename");
    const callIndex = manualPost.indexOf("api(\"manual-generate\"");
    assert.ok(guardIndex > -1, "Guard foto pakaian tidak ditemukan di submitManualPost");
    assert.ok(callIndex > -1, "Panggilan manual-generate tidak ditemukan di submitManualPost");
    assert.ok(
        guardIndex < callIndex,
        "Guard foto pakaian harus berjalan sebelum permintaan manual-generate dikirim"
    );
});

test("label foto pakaian mengikuti provider gambar yang aktif", () => {
    assert.match(
        source,
        /document\.querySelector\("label\[for='character-garment'\]"\)/,
        "renderConfig harus memperbarui label field foto pakaian sesuai provider"
    );
});
