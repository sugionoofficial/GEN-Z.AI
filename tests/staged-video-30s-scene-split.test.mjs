import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";

import {
    buildStaged30sPrompts,
    parseStructuredScenes,
    STAGED_30S_MAX_PROMPT
} from "../lib/generate/staged-video-30s.js";

/* Prompt nyata yang dilaporkan user: 3 scene × 10 detik, blok global,
   tabel teknis, dan Negative Prompt. Sebelum perbaikan, ketiga klip
   menerima SELURUH prompt ini karena parser durasi tidak membaca judul
   "### Scene 1 (00–10 detik)" dan jatuh ke mode auto_generated. */
const DAILY_VLOG_PROMPT = `### Prompt Video: Daily Vlog Menuju Parkiran Motor

* Gunakan foto referensi sebagai acuan utama identitas wajah.

* Rambut hitam panjang, lurus, terurai alami.

* Jaket denim hitam dan kaus hitam.

* Wajah, bentuk tubuh, warna kulit, dan pakaian tidak boleh berubah.

* Gaya daily vlog natural, seperti sedang merekam aktivitas sehari-hari menggunakan kamera depan HP.

(klip 1,2,3 menerima ini)



### Scene 1 (00–10 detik): Memulai perjalanan

Visual dan gerakan:

Karakter memegang smartphone menggunakan satu tangan dalam posisi selfie. Kamera sedikit bergoyang mengikuti langkah kaki. Dia mulai berjalan santai meninggalkan area dalam ruangan menuju lorong yang mengarah ke parkiran motor.

Sesekali melihat layar kamera, tersenyum tipis, alis sedikit terangkat, dan berbicara dengan ekspresi santai tetapi serius.

Dialog:

"Guys, sekarang aku mau kasih sedikit tips ya... kalau kalian lagi cari pasangan, jangan sampai terlalu gampang percaya sama orang."

(klip 1 menerima ini)



### Scene 2 (10–20 detik): Pertimbangan memilih pasangan

Visual dan gerakan:

Kamera tetap selfie handheld. Karakter berjalan melewati lorong menuju area parkiran. Rambut bergerak alami mengikuti langkah. Tangan yang bebas sesekali membuat gestur kecil untuk menekankan pembicaraan.

Ekspresi wajah berubah menjadi sedikit jahil, tersenyum sambil menaikkan alis.

Dialog:

"Menurut aku, pertimbangan pertama itu lihat dulu duitnya... punya masa depan atau nggak. Soalnya cinta juga butuh modal, guys."

(klip 2 menerima ini)



### Scene 3 (20–30 detik): Penutup yang menggelitik

Visual dan gerakan:

Karakter mulai memasuki area parkiran motor. Terlihat beberapa sepeda motor terparkir di belakangnya. Kamera sedikit bergerak ketika dia menoleh mencari motornya.

Dia kemudian kembali menatap kamera, tersenyum nakal, sedikit memiringkan kepala, lalu tertawa kecil.

Dialog:

"Terus yang kedua, jangan lupa lihat wajahnya! Minimal enak dipandang lah. Hahaha... jangan sampai sudah nggak punya duit, mukanya juga bikin kita harus banyak bersabar!"

(klip 3 menerima ini)



### Pengaturan teknis video

| Elemen      | Pengaturan                     |

| ----------- | ------------------------------ |

| Durasi      | 30 detik                       |

| Pembagian   | 3 scene × 10 detik             |

| Rasio       | 9:16 vertikal                  |

| Resolusi    | 4K                             |

| Kamera      | Front camera smartphone        |

| Gerakan     | Handheld selfie natural        |

| Pencahayaan | Natural lighting               |

| Audio       | Suara wanita natural           |

| Lip-sync    | Sinkron sempurna dengan dialog |

| Ekspresi    | Santai, jahil, ekspresif       |

Negative Prompt:

Jangan mengubah identitas wajah, jangan mengganti pakaian, jangan mengubah gaya rambut, jangan membuat wajah menjadi terlalu halus seperti boneka, hindari gerakan tubuh kaku, hindari jari berlebih, hindari kamera melayang, hindari perubahan lokasi mendadak, hindari suara robot, hindari dialog terpotong, dan hindari pergantian karakter antar-scene.

(klip 1,2,3 menerima ini)`;

const DIALOG = {
    scene1: "Guys, sekarang aku mau kasih sedikit tips",
    scene2: "Menurut aku, pertimbangan pertama itu lihat dulu duitnya",
    scene3: "Terus yang kedua, jangan lupa lihat wajahnya"
};
const SCENE_TITLES = [
    "Memulai perjalanan",
    "Pertimbangan memilih pasangan",
    "Penutup yang menggelitik"
];

test("parseStructuredScenes membaca 3 judul adegan Markdown beserta jendela 0-10 / 10-20 / 20-30", () => {
    const parsed = parseStructuredScenes(DAILY_VLOG_PROMPT);
    assert.equal(parsed.matched, true);
    assert.equal(parsed.scenes.length, 3);
    assert.deepEqual(
        parsed.scenes.map(scene => [scene.startSec, scene.endSec]),
        [[0, 10], [10, 20], [20, 30]]
    );
    assert.match(parsed.sharedHead, /Jaket denim hitam/);
    assert.doesNotMatch(parsed.sharedHead, /Memulai perjalanan/);
    assert.match(parsed.sharedTail, /Pengaturan teknis video/);
    assert.match(parsed.sharedTail, /Negative Prompt/);
    // Catatan meta penulis prompt bukan instruksi untuk model video.
    for (const scene of parsed.scenes) {
        assert.doesNotMatch(scene.text, /menerima ini/i);
    }
    assert.doesNotMatch(parsed.sharedTail, /menerima ini/i);
});

test("Seedance 2.5 30s: alur + dialog dibagi sendiri ke Klip 1/2/3, tidak ada klip yang memuat semua prompt", () => {
    const staged = buildStaged30sPrompts(DAILY_VLOG_PROMPT, { targetDuration: 30 });

    assert.equal(staged.mode, "structured_scenes");
    assert.equal(staged.hasExplicitDuration, true);
    assert.equal(staged.structuredScenes, true);
    assert.equal(staged.sceneCount, 3);
    assert.equal(staged.totalClips, 3);
    assert.ok(staged.clip1.length <= STAGED_30S_MAX_PROMPT);
    assert.ok(staged.clip2.length <= STAGED_30S_MAX_PROMPT);
    assert.ok(staged.clip3.length <= STAGED_30S_MAX_PROMPT);

    const clips = [staged.clip1, staged.clip2, staged.clip3];
    const dialogs = [DIALOG.scene1, DIALOG.scene2, DIALOG.scene3];

    clips.forEach((clip, index) => {
        // Header jendela waktu tiap klip.
        assert.match(clip, new RegExp(`Durasi ${["0-10", "11-20", "21-30"][index]} detik`, "i"));

        // HANYA dialog adegan sendiri yang boleh masuk.
        dialogs.forEach((dialog, dialogIndex) => {
            if (dialogIndex === index) {
                assert.ok(clip.includes(dialog), `Klip ${index + 1} wajib memuat dialog scene ${dialogIndex + 1}`);
            } else {
                assert.ok(
                    !clip.includes(dialog),
                    `Klip ${index + 1} TIDAK boleh memuat dialog scene ${dialogIndex + 1}`
                );
            }
        });

        // HANYA judul adegan sendiri; judul scene lain tidak boleh bocor.
        SCENE_TITLES.forEach((title, titleIndex) => {
            if (titleIndex === index) {
                assert.ok(clip.includes(title), `Klip ${index + 1} wajib memuat judul scene ${titleIndex + 1}`);
            } else {
                assert.ok(!clip.includes(title), `Klip ${index + 1} tidak boleh memuat judul scene ${titleIndex + 1}`);
            }
        });

        // Blok global, pengaturan teknis, dan Negative Prompt wajib ikut ke SEMUA klip.
        assert.ok(clip.includes("Jaket denim hitam"), `Klip ${index + 1} kehilangan identitas global`);
        assert.ok(clip.includes("Pengaturan teknis video"), `Klip ${index + 1} kehilangan pengaturan teknis`);
        assert.ok(clip.includes("Lip-sync"), `Klip ${index + 1} kehilangan pengaturan audio`);
        assert.ok(clip.includes("Jangan mengubah identitas wajah"), `Klip ${index + 1} kehilangan Negative Prompt`);

        // Instruksi eksplisit agar model tidak merender adegan klip lain.
        assert.match(clip, /Jalankan HANYA adegan di bawah ini/i);

        // Tidak ada lagi catatan meta "(klip ... menerima ini)" yang dikirim ke model.
        assert.doesNotMatch(clip, /\(klip\s+\d.*menerima ini\)/i);

        // Tidak ada klip yang menerima prompt utuh (panjangnya jauh di bawah prompt asli).
        assert.ok(
            clip.length < DAILY_VLOG_PROMPT.length,
            `Klip ${index + 1} masih memuat prompt utuh`
        );
    });

    assert.notEqual(staged.clip1, staged.clip2);
    assert.notEqual(staged.clip2, staged.clip3);
    assert.notEqual(staged.clip1, staged.clip3);

    // Regresi utama: tidak boleh ada klip yang berisi ketiga dialog sekaligus.
    for (const clip of clips) {
        const hit = dialogs.filter(dialog => clip.includes(dialog)).length;
        assert.equal(hit, 1, "Tiap klip hanya boleh memuat SATU dialog adegan");
    }
});

test("Prompt berstruktur 20 detik hanya menghasilkan 2 klip tanpa duplikasi adegan pembuka", () => {
    const staged = buildStaged30sPrompts(DAILY_VLOG_PROMPT, { targetDuration: 20 });
    assert.equal(staged.mode, "structured_scenes");
    assert.equal(staged.totalClips, 2);
    assert.equal(staged.clip3, "");
    assert.match(staged.clip1, /Durasi 0-10 detik/);
    assert.match(staged.clip2, /Durasi 11-20 detik/);
    assert.ok(staged.clip1.includes(DIALOG.scene1));
    assert.ok(!staged.clip1.includes(DIALOG.scene2));
    assert.ok(!staged.clip1.includes(DIALOG.scene3));
    assert.ok(staged.clip2.includes(DIALOG.scene2));
    assert.ok(staged.clip2.includes(DIALOG.scene3));
    assert.ok(!staged.clip2.includes(DIALOG.scene1));
    assert.ok(staged.clip1.includes("Jangan mengubah identitas wajah"));
    assert.ok(staged.clip2.includes("Jangan mengubah identitas wajah"));
});

test("Prompt berstruktur dengan @image1 tetap menjaga referensi media pada Klip 2 & 3", () => {
    const prompt = [
        "### Identitas karakter",
        "Subjek @image1 mengenakan jaket merah, rambut pendek.",
        "### Scene 1 (0-10 detik): Pembukaan",
        "Dialog: \"Halo semuanya, hari ini aku jalan-jalan.\"",
        "### Scene 2 (10-20 detik): Tengah cerita",
        "Dialog: \"Ternyata di sini ramai sekali, ya.\"",
        "### Scene 3 (20-30 detik): Penutup",
        "Dialog: \"Sampai jumpa di video berikutnya!\"",
        "Negative Prompt: jangan mengubah wajah."
    ].join("\n");

    const staged = buildStaged30sPrompts(prompt, { targetDuration: 30, preserveMediaRefs: true });
    assert.equal(staged.mode, "structured_scenes");
    for (const clip of [staged.clip1, staged.clip2, staged.clip3]) {
        assert.match(clip, /@image1/);
        assert.match(clip, /Negative Prompt/);
    }
    assert.ok(staged.clip2.includes("Ternyata di sini ramai"));
    assert.ok(!staged.clip2.includes("Halo semuanya"));
    assert.ok(!staged.clip2.includes("Sampai jumpa"));
});

test("Prompt polos tanpa penanda durasi tidak lagi disalin utuh ke ketiga klip", () => {
    const prompt = [
        "Seorang wanita membuka pintu kafe dengan senyum tipis.",
        "Dia duduk di dekat jendela sambil menyeruput kopi hangat.",
        "Kamera perlahan menyorot hujan di luar jendela hingga adegan memudar."
    ].join(" ");
    const staged = buildStaged30sPrompts(prompt, { targetDuration: 30 });
    assert.equal(staged.mode, "auto_generated");
    assert.equal(staged.hasExplicitDuration, false);

    const beats = [
        "membuka pintu kafe",
        "menyeruput kopi hangat",
        "hujan di luar jendela"
    ];
    const clips = [staged.clip1, staged.clip2, staged.clip3];
    clips.forEach((clip, index) => {
        beats.forEach((beat, beatIndex) => {
            if (beatIndex === index) {
                assert.ok(clip.includes(beat), `Klip ${index + 1} wajib memuat beat ${beatIndex + 1}`);
            } else {
                assert.ok(
                    !clip.includes(beat),
                    `Klip ${index + 1} tidak boleh memuat beat ${beatIndex + 1}`
                );
            }
        });
    });
    assert.doesNotMatch(staged.clip1, /Konteks visual keseluruhan/);
});

test("Format durasi lama '0-10 detik:' tetap dipetakan ke klip masing-masing", () => {
    const prompt = [
        "Gaya sinematik 35mm.",
        "0-10 detik: @image1 berjalan memasuki taman bunga.",
        "11-20 detik: @image1 berhenti di dekat air mancur.",
        "21-30 detik: Kamera mundur memperlihatkan panorama taman.",
        "Negative Prompt: hindari wajah boneka."
    ].join("\n");
    const staged = buildStaged30sPrompts(prompt, { targetDuration: 30 });
    assert.equal(staged.mode, "explicit_duration");
    assert.ok(staged.clip1.includes("taman bunga"));
    assert.ok(!staged.clip1.includes("air mancur"));
    assert.ok(!staged.clip1.includes("panorama taman"));
    assert.ok(staged.clip2.includes("air mancur"));
    assert.ok(!staged.clip2.includes("panorama taman"));
    assert.ok(staged.clip3.includes("panorama taman"));
    for (const clip of [staged.clip1, staged.clip2, staged.clip3]) {
        assert.ok(clip.includes("hindari wajah boneka"), "Negative Prompt ikut ke semua klip");
    }
});

test("api/generate.js mengirim prompt per klip (bukan prompt utuh) ke create_clip", async () => {
    const source = await fs.readFile(new URL("../api/generate.js", import.meta.url), "utf8");
    assert.match(source, /clipPrompts\.clip1 \|\| reqPayload\.prompt/);
    assert.match(source, /clipIndex === 2\s*\?\s*String\(clipPrompts\.clip2/);
    assert.match(source, /String\(clipPrompts\.clip3/);
    assert.match(source, /clip_prompts:\s*\{/);
});
