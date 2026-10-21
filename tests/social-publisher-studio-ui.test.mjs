import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const source = readFileSync(
    fileURLToPath(new URL("../admin-control/social-publisher.js", import.meta.url)),
    "utf8"
);
const htmlSource = readFileSync(
    fileURLToPath(new URL("../admin-control/social-publisher.html", import.meta.url)),
    "utf8"
);
const apiSource = readFileSync(
    fileURLToPath(new URL("../api/social-publisher.js", import.meta.url)),
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

test("preview foto pakaian tersedia di daftar karakter dan bagian posting manual", () => {
    // loadGarmentPreview harus sejajar dengan loadReferencePreview (scope utama IIFE)
    // agar thumbnail pakaian di daftar karakter benar-benar termuat.
    const garmentIndent = source.match(/^([ \t]*)async function loadGarmentPreview\(/m);
    const referenceIndent = source.match(/^([ \t]*)async function loadReferencePreview\(/m);
    assert.ok(garmentIndent, "loadGarmentPreview tidak ditemukan di admin-control/social-publisher.js");
    assert.ok(referenceIndent, "loadReferencePreview tidak ditemukan di admin-control/social-publisher.js");
    assert.equal(garmentIndent[1].length, referenceIndent[1].length);
    assert.match(source, /loadGarmentPreview\(character\.id, garmentImg\)/, "Daftar karakter harus memuat preview pakaian");
    assert.match(source, /api\("garment&character_id="/, "Preview pakaian harus memakai endpoint garment");
    assert.match(htmlSource, /id="manual-garment-preview"/, "Bagian posting manual harus punya elemen preview pakaian");
    assert.match(htmlSource, /id="manual-garment-box"/, "Bagian posting manual harus punya wadah preview pakaian");
    assert.match(htmlSource, /\.thumbs\{/, "CSS harus menyediakan wadah .thumbs untuk dua thumbnail karakter");
});

test("endpoint garment tersedia di API social publisher", () => {
    assert.match(
        apiSource,
        /if \(action === "garment"\)/,
        "api/social-publisher.js harus melayani action GET garment untuk preview pakaian"
    );
});

test("QwenCloud tersedia sebagai opsi provider gambar", () => {
    const setHtml = readFileSync(
        fileURLToPath(new URL("../admin-control/studio-medsos-set.html", import.meta.url)),
        "utf8"
    );
    const setJs = readFileSync(
        fileURLToPath(new URL("../admin-control/studio-medsos-set.js", import.meta.url)),
        "utf8"
    );
    const cronSource = readFileSync(
        fileURLToPath(new URL("../functions/_shared/social-publisher-cron.js", import.meta.url)),
        "utf8"
    );
    assert.match(setHtml, /name="image-provider" value="qwencloud"/, "Admin SET Studio Medsos harus punya radio QwenCloud");
    assert.match(apiSource, /\["gemini", "cloudflare", "qwencloud"\]/, "Validasi provider harus menerima qwencloud");
    assert.match(apiSource, /QWENCLOUD_API_KEY/, "API harus memeriksa secret QWENCLOUD_API_KEY");
    assert.match(setJs, /qwencloud_configured/, "Status kesiapan QwenCloud harus ditampilkan di admin");
    assert.match(source, /QwenCloud \(/, "Studio Medsos harus melabeli provider QwenCloud");
    assert.match(cronSource, /"qwencloud"/, "Cron autopost harus mendukung provider qwencloud");
});

test("dropdown model QwenCloud dan panel kuota tier tersedia di SET Studio Medsos", () => {
    const setHtml = readFileSync(
        fileURLToPath(new URL("../admin-control/studio-medsos-set.html", import.meta.url)),
        "utf8"
    );
    const setJs = readFileSync(
        fileURLToPath(new URL("../admin-control/studio-medsos-set.js", import.meta.url)),
        "utf8"
    );
    const migration = readFileSync(
        fileURLToPath(new URL("../supabase/social-auto-publisher.sql", import.meta.url)),
        "utf8"
    );
    assert.match(setHtml, /id="qwencloud-image-model"/, "Dropdown model gambar QwenCloud harus ada");
    assert.match(setHtml, /id="qwencloud-quota-panel"/, "Panel kuota tier harus ada");
    assert.match(setHtml, /id="qwencloud-quota-limit"/, "Input batas tier harus ada");
    assert.match(setJs, /studio-admin-model-quota/, "Admin JS harus memanggil action penyimpanan kuota");
    assert.match(setJs, /percent_available/, "Admin JS harus menampilkan persentase tier tersedia");
    assert.match(setJs, /Tier habis/, "Admin JS harus menandai model yang tier-nya habis");
    assert.match(apiSource, /action === "studio-admin-model-quota"/, "API harus melayani penyimpanan kuota per model");
    assert.match(migration, /check \(image_provider in \('gemini', 'cloudflare', 'qwencloud'\)\)/, "Migration harus menerima provider qwencloud");
    assert.match(migration, /add column if not exists image_model/, "Migration harus menambah kolom image_model");
    assert.match(migration, /create table if not exists public\.social_publisher_model_quotas/, "Migration harus membuat ledger kuota model");
});

test("panel menjelaskan error \"Aplikasi tidak aktif\" dan membuka panduan otomatis", () => {
    assert.match(
        htmlSource,
        /id="meta-app-mode-help"/,
        "Kartu Hubungkan Facebook harus punya panduan mode Development Meta App"
    );
    assert.match(
        htmlSource,
        /Aplikasi tidak aktif/,
        "Panduan harus menyebut pesan error Facebook yang muncul"
    );
    assert.match(
        htmlSource,
        /App roles/,
        "Panduan harus mengarahkan ke App roles untuk menambah Tester/Developer"
    );
    assert.match(
        htmlSource,
        /CREATE_CONTENT/,
        "Panduan harus mengingatkan tugas Page CREATE_CONTENT"
    );
    assert.match(
        htmlSource,
        /genzai\.genzai-f37\.workers\.dev\/api\/facebook-oauth-callback/,
        "Panduan harus memuat redirect URI yang benar"
    );
    assert.match(
        source,
        /function revealMetaAppModeHelp\(/,
        "Panduan harus bisa dibuka otomatis dari hasil OAuth"
    );
    assert.match(
        source,
        /\["denied", "no_pages", "pages", "exchange"\]\.includes\(code\)/,
        "Panduan otomatis dibuka untuk error izin/Page/exchange"
    );
    assert.match(
        source,
        /App Role pada Meta App yang masih mode Development/,
        "Pesan denied harus menjelaskan penyebab mode Development"
    );
});
