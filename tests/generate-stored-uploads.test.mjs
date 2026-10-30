import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

import {
    STORED_UPLOAD_LIMIT,
    STORED_UPLOAD_ROOT,
    STORED_UPLOAD_TTL_MS,
    formatStoredUploadRemaining,
    getStoredUploadKind,
    getStoredUploadRemainingMs,
    isStoredUploadFresh,
    listStoredUploads,
    parseStoredUploadPath
} from "../generate/assets/js/generate-stored-uploads.js";

/*
 * FITUR: "Unggahan tersimpan" di halaman Generate.
 *
 * Laporan pengguna:
 *
 *   Foto yang diunggah lewat halaman Generate masih ada di
 *   storage (masa simpan 1 jam), tetapi halaman tidak punya
 *   cara memakainya lagi. Satu-satunya jalan adalah
 *   mengunggah ulang file yang sama.
 *
 * Aturan yang dijaga tes ini:
 *   - Hanya file yang MASIH berlaku (< 1 jam) yang ditampilkan.
 *   - Retensi tidak berubah: upload tetap 1 jam.
 *   - File yang keburu dihapus tidak boleh tampil sebagai
 *     tombol yang pasti gagal; pesannya harus jelas.
 *   - Memilih unggahan tersimpan mengisi nilai upload yang
 *     sama seperti upload baru (tanpa upload ulang).
 *   - Pemotongan klip tidak tersedia untuk file tersimpan,
 *     dan UI mengatakannya apa adanya.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = relative => readFileSync(path.join(root, relative), "utf8");

const formMediaSource = read("generate/assets/js/generate-form-media.js");
const generateHtml = read("generate/index.html");
const retentionSource = read("lib/storage-retention/cleanup.js");

const NOW = 1_800_000_000_000; // waktu tetap untuk tes
const MINUTE = 60 * 1000;

function folderStamp(minutesAgo) {
    return String(NOW - minutesAgo * MINUTE);
}

const USER_ID = "c237fcef-6456-451e-ae98-691f2dabb60d";
const ROOT_PATH = `${STORED_UPLOAD_ROOT}/${USER_ID}`;

/* ---------------------------------------------------------
   FAKE SUPABASE STORAGE
--------------------------------------------------------- */

function makeStorage({ folders, filesByFolder, failingSign = [] } = {}) {
    const calls = {
        list: [],
        sign: []
    };

    const storage = {
        from: bucket => ({
            list: async (prefix, options) => {
                calls.list.push({ bucket, prefix, options });

                if (prefix === ROOT_PATH) {
                    return { data: folders, error: null };
                }

                const folder = prefix.split("/").pop();

                return {
                    data: filesByFolder?.[folder] || [],
                    error: null
                };
            },

            createSignedUrl: async (objectPath, ttl) => {
                calls.sign.push({ objectPath, ttl });

                if (failingSign.some(part => objectPath.includes(part))) {
                    return {
                        data: null,
                        error: { message: "Object not found" }
                    };
                }

                return {
                    data: {
                        signedUrl: `https://project.supabase.co/storage/v1/object/sign/${objectPath}?token=x`
                    },
                    error: null
                };
            }
        })
    };

    return { supabase: { storage }, calls };
}

function folderEntry(minutesAgo) {
    return { name: folderStamp(minutesAgo), id: null, metadata: null };
}

function fileEntry(name, mimeType, size = 1024) {
    return {
        name,
        id: `${name}-id`,
        metadata: {
            mimetype: mimeType,
            size
        }
    };
}

/* ---------------------------------------------------------
   1. PATH & UMUR FILE
--------------------------------------------------------- */

test("path upload diurai menjadi waktu dan nama file", () => {
    const parsed = parseStoredUploadPath(
        `${ROOT_PATH}/${folderStamp(10)}/abc12345-wajah.jpg`
    );

    assert.deepEqual(parsed, {
        userId: USER_ID,
        folder: folderStamp(10),
        createdAt: NOW - 10 * MINUTE,
        name: "abc12345-wajah.jpg"
    });
});

test("path aneh ditolak, bukan ditebak", () => {
    assert.equal(parseStoredUploadPath(""), null);
    assert.equal(parseStoredUploadPath("dashboard-videos/x/1/a.jpg"), null);
    assert.equal(parseStoredUploadPath(`${STORED_UPLOAD_ROOT}/${USER_ID}`), null);
    assert.equal(
        parseStoredUploadPath(`${STORED_UPLOAD_ROOT}/${USER_ID}/bukan-angka/a.jpg`),
        null
    );
    assert.equal(
        parseStoredUploadPath(`${STORED_UPLOAD_ROOT}/${USER_ID}/1761480000000`),
        null
    );
});

test("hanya file di bawah 1 jam yang dianggap masih berlaku", () => {
    const fresh = { createdAt: NOW - 59 * MINUTE };
    const stale = { createdAt: NOW - 61 * MINUTE };

    assert.equal(isStoredUploadFresh(fresh, { now: NOW }), true);
    assert.equal(isStoredUploadFresh(stale, { now: NOW }), false);
    assert.equal(isStoredUploadFresh({ createdAt: 0 }, { now: NOW }), false);
    assert.equal(isStoredUploadFresh(null, { now: NOW }), false);
});

test("jam perangkat yang sedikit maju tidak membuang file baru", () => {
    assert.equal(
        isStoredUploadFresh({ createdAt: NOW + 60 * 1000 }, { now: NOW }),
        true,
        "folder 1 menit di masa depan masih diterima"
    );

    assert.equal(
        isStoredUploadFresh({ createdAt: NOW + 24 * 60 * MINUTE }, { now: NOW }),
        false,
        "folder dari masa depan yang jauh bukan bukti file baru"
    );
});

test("sisa waktu ditulis dalam menit, bukan angka mentah", () => {
    assert.equal(
        formatStoredUploadRemaining(NOW + 42 * MINUTE, { now: NOW }),
        "sisa 42 menit"
    );

    assert.equal(
        formatStoredUploadRemaining(NOW + 30 * 1000, { now: NOW }),
        "kurang dari 1 menit"
    );

    assert.equal(
        formatStoredUploadRemaining(NOW - MINUTE, { now: NOW }),
        "kedaluwarsa"
    );

    assert.equal(
        getStoredUploadRemainingMs(NOW - 10 * MINUTE, { now: NOW }),
        50 * MINUTE
    );
});

test("jenis media dibaca dari MIME lalu ekstensi", () => {
    assert.equal(getStoredUploadKind({ mimeType: "image/jpeg" }), "image");
    assert.equal(getStoredUploadKind({ mimeType: "video/mp4" }), "video");
    assert.equal(getStoredUploadKind({ mimeType: "audio/mpeg" }), "audio");
    assert.equal(getStoredUploadKind({ name: "hasil.WEBM" }), "video");
    assert.equal(getStoredUploadKind({ name: "lagu.wav" }), "audio");
    assert.equal(getStoredUploadKind({ name: "dokumen.pdf" }), "");
});

/* ---------------------------------------------------------
   2. DAFTAR UNGGAHAN
--------------------------------------------------------- */

test("daftar hanya berisi unggahan yang masih berlaku, terbaru dulu", async () => {
    const { supabase, calls } = makeStorage({
        folders: [folderEntry(50), folderEntry(5), folderEntry(120)],
        filesByFolder: {
            [folderStamp(5)]: [fileEntry("wajah-baru.jpg", "image/jpeg")],
            [folderStamp(50)]: [fileEntry("wajah-lama.jpg", "image/jpeg")],
            [folderStamp(120)]: [fileEntry("sudah-hapus.jpg", "image/jpeg")]
        }
    });

    const entries = await listStoredUploads({
        supabase,
        userId: USER_ID,
        now: NOW,
        kinds: ["image"]
    });

    assert.deepEqual(
        entries.map(entry => entry.name),
        ["wajah-baru.jpg", "wajah-lama.jpg"]
    );

    assert.equal(
        calls.list.some(call => call.prefix.includes(folderStamp(120))),
        false,
        "folder kedaluwarsa tidak boleh dibaca sama sekali"
    );

    assert.equal(entries[0].kind, "image");
    assert.equal(entries[0].expiresAt, NOW - 5 * MINUTE + STORED_UPLOAD_TTL_MS);
    assert.match(entries[0].url, /object\/sign\/generate-input\//);
});

test("filter jenis media memisahkan foto, video, dan audio", async () => {
    const folder = folderStamp(3);
    const { supabase } = makeStorage({
        folders: [folderEntry(3)],
        filesByFolder: {
            [folder]: [
                fileEntry("wajah.jpg", "image/jpeg"),
                fileEntry("gerak.mp4", "video/mp4"),
                fileEntry("suara.mp3", "audio/mpeg")
            ]
        }
    });

    const images = await listStoredUploads({
        supabase,
        userId: USER_ID,
        now: NOW,
        kinds: ["image"]
    });

    assert.deepEqual(images.map(entry => entry.name), ["wajah.jpg"]);

    const videos = await listStoredUploads({
        supabase,
        userId: USER_ID,
        now: NOW,
        kinds: ["video"]
    });

    assert.deepEqual(videos.map(entry => entry.name), ["gerak.mp4"]);
});

test("file yang signed URL-nya gagal tidak ditampilkan", async () => {
    const folder = folderStamp(2);
    const { supabase } = makeStorage({
        folders: [folderEntry(2)],
        filesByFolder: {
            [folder]: [fileEntry("hilang.jpg", "image/jpeg")]
        },
        failingSign: ["hilang.jpg"]
    });

    const entries = await listStoredUploads({
        supabase,
        userId: USER_ID,
        now: NOW
    });

    assert.deepEqual(entries, [], "jangan tampilkan tombol yang pasti gagal");
});

test("jumlah unggahan dibatasi supaya daftar tidak membanjiri layar HP", async () => {
    const folders = [];
    const filesByFolder = {};

    for (let index = 0; index < 30; index += 1) {
        folders.push(folderEntry(index));
        filesByFolder[folderStamp(index)] = [
            fileEntry(`foto-${index}.jpg`, "image/jpeg")
        ];
    }

    const { supabase } = makeStorage({ folders, filesByFolder });

    const entries = await listStoredUploads({
        supabase,
        userId: USER_ID,
        now: NOW
    });

    assert.equal(entries.length, STORED_UPLOAD_LIMIT);
    assert.equal(entries[0].name, "foto-0.jpg", "yang terbaru di urutan pertama");
});

test("tanpa client atau user, daftar kosong (bukan error)", async () => {
    assert.deepEqual(await listStoredUploads({ now: NOW }), []);
    assert.deepEqual(
        await listStoredUploads({ supabase: null, userId: USER_ID, now: NOW }),
        []
    );
});

/* ---------------------------------------------------------
   3. PANEL UI
--------------------------------------------------------- */

function createFakeDocument() {
    const listeners = [];

    function makeElement(tagName) {
        const element = {
            tagName,
            className: "",
            textContent: "",
            hidden: false,
            disabled: false,
            type: "",
            src: "",
            alt: "",
            title: "",
            loading: "",
            dataset: {},
            attributes: {},
            children: [],
            classes: new Set(),
            listeners: {},
            style: {
                setProperty() {}
            },
            get innerHTML() {
                return "";
            },
            set innerHTML(value) {
                if (value === "") {
                    element.children = [];
                }
            },
            setAttribute(name, value) {
                element.attributes[name] = String(value);
            },
            getAttribute(name) {
                return element.attributes[name] ?? null;
            },
            appendChild(child) {
                element.children.push(child);
                return child;
            },
            append(...nodes) {
                element.children.push(...nodes);
            },
            addEventListener(type, handler) {
                element.listeners[type] = element.listeners[type] || [];
                element.listeners[type].push(handler);
                listeners.push({ element, type, handler });
            },
            click() {
                for (const handler of element.listeners.click || []) {
                    handler({
                        preventDefault() {},
                        stopPropagation() {}
                    });
                }
            }
        };

        return element;
    }

    return {
        document: {
            createElement: tagName => makeElement(tagName)
        },
        listeners
    };
}

async function withFakeDocument(run) {
    const previous = globalThis.document;
    const fake = createFakeDocument();
    globalThis.document = fake.document;

    try {
        return await run(fake);
    } finally {
        globalThis.document = previous;
    }
}

function findButtons(rootElement) {
    const found = [];

    const walk = node => {
        if (!node || typeof node !== "object") {
            return;
        }

        if (node.tagName === "button") {
            found.push(node);
        }

        for (const child of node.children || []) {
            walk(child);
        }
    };

    walk(rootElement);
    return found;
}

test("panel memuat daftar saat dibuka dan memakai file yang dipilih", async () => {
    await withFakeDocument(async () => {
        const folder = folderStamp(4);
        const { supabase } = makeStorage({
            folders: [folderEntry(4)],
            filesByFolder: {
                [folder]: [fileEntry("wajah.jpg", "image/jpeg")]
            }
        });

        let contextCalls = 0;
        const picked = [];

        const panel = createPanel({
            kinds: ["image"],
            now: () => NOW,
            getContext: async () => {
                contextCalls += 1;
                return { supabase, userId: USER_ID };
            },
            onPick: entry => {
                picked.push(entry);
            }
        });

        assert.equal(contextCalls, 0, "jangan menembak storage sebelum panel dibuka");

        await panel.expand();

        assert.equal(contextCalls, 1);

        const itemButtons = findButtons(panel.element).filter(
            button => button.dataset.storedPath
        );

        assert.equal(itemButtons.length, 1);

        itemButtons[0].click();
        await new Promise(resolve => setTimeout(resolve, 0));

        assert.equal(picked.length, 1, "onPick harus dipanggil");
        assert.equal(picked[0].name, "wajah.jpg");
        assert.match(panel.element.children[2].textContent, /Memakai unggahan tersimpan/);
    });
});

test("file yang hampir dihapus tetap boleh dipakai, dengan peringatan", async () => {
    await withFakeDocument(async () => {
        /* Upload 57 menit lalu: sisa ±3 menit. */
        const folder = folderStamp(57);
        const { supabase } = makeStorage({
            folders: [folderEntry(57)],
            filesByFolder: {
                [folder]: [fileEntry("wajah.jpg", "image/jpeg")]
            }
        });

        const picked = [];

        const panel = createPanel({
            kinds: ["image"],
            now: () => NOW,
            getContext: async () => ({ supabase, userId: USER_ID }),
            onPick: entry => {
                picked.push(entry);
            }
        });

        await panel.expand();

        const itemButton = findButtons(panel.element).find(
            button => button.dataset.storedPath
        );

        itemButton.click();
        await new Promise(resolve => setTimeout(resolve, 0));

        assert.equal(picked.length, 1, "masih berlaku, jadi tetap bisa dipakai");

        const status = panel.element.children[2].textContent;

        assert.match(status, /hampir dihapus/);
        assert.match(status, /unggah ulang/);
        assert.match(status, /sisa \d+ menit/);
    });
});

test("file yang kedaluwarsa saat panel terbuka tidak dipakai diam-diam", async () => {
    await withFakeDocument(async () => {
        const folder = folderStamp(4);
        const { supabase } = makeStorage({
            folders: [folderEntry(4)],
            filesByFolder: {
                [folder]: [fileEntry("wajah.jpg", "image/jpeg")]
            }
        });

        let clock = NOW;
        let contextCalls = 0;
        const picked = [];

        const panel = createPanel({
            kinds: ["image"],
            now: () => clock,
            getContext: async () => {
                contextCalls += 1;
                return { supabase, userId: USER_ID };
            },
            onPick: entry => {
                picked.push(entry);
            }
        });

        await panel.expand();

        const itemButton = findButtons(panel.element).find(
            button => button.dataset.storedPath
        );

        /* Lewat 1 jam sejak upload. */
        clock = NOW + 70 * MINUTE;

        itemButton.click();
        await new Promise(resolve => setTimeout(resolve, 0));

        assert.equal(picked.length, 0, "file yang sudah dihapus tidak boleh dipakai");
        assert.match(
            panel.element.children[2].textContent,
            /sudah dihapus/i,
            "pesannya harus jelas, bukan error samar"
        );
        assert.ok(contextCalls >= 2, "daftar dimuat ulang setelah file hilang");
    });
});

/* Panel diimpor lewat modul browser (butuh document global). */
const { createStoredUploadsPanel } = await import(
    "../generate/assets/js/generate-stored-uploads.js"
);

function createPanel(options) {
    return createStoredUploadsPanel(options);
}

/* ---------------------------------------------------------
   4. INTEGRASI HALAMAN GENERATE
--------------------------------------------------------- */

test("panel terpasang di ketiga field media", () => {
    assert.match(
        formMediaSource,
        /from "\.\/generate-stored-uploads\.js\?v=stored-uploads-20261026/
    );

    assert.equal(
        (formMediaSource.match(/createStoredUploadsPanel\(\{/g) || []).length,
        3,
        "foto, video, dan audio masing-masing punya panel"
    );

    assert.equal(
        (formMediaSource.match(/storedUploadsPanel\.element/g) || []).length,
        3
    );

    assert.match(formMediaSource, /kinds:\s*\n\s*\["image"\]/);
    assert.match(formMediaSource, /kinds:\s*\n\s*\["video"\]/);
    assert.match(formMediaSource, /kinds:\s*\n\s*\["audio"\]/);
});

test("memilih unggahan tersimpan mengisi nilai upload tanpa upload baru", () => {
    /* Foto: dataset dipakai reader sebagai sumber nilai. */
    assert.match(formMediaSource, /wrapper\.dataset\.uploadedUrl =\s*\n\s*urls\[0\];/);
    assert.match(formMediaSource, /wrapper\.dataset\.uploadedUrls =\s*\n\s*JSON\.stringify\(/);

    /* Video & audio memakai signed URL langsung. */
    assert.match(formMediaSource, /wrapper\.dataset\.uploadedUrl =\s*\n\s*entry\.url;/);

    /* Penanda asal supaya jelas ini bukan file lokal. */
    assert.match(formMediaSource, /wrapper\.dataset\.uploadSource =\s*\n\s*"stored";/);

    /* Tidak boleh ada upload ulang tersembunyi. */
    const imageApply = formMediaSource.match(
        /function applyStoredImage\([\s\S]*?\n    \}/
    )?.[0] || "";
    const videoApply = formMediaSource.match(
        /function applyStoredVideo\([\s\S]*?\n    \}/
    )?.[0] || "";

    assert.ok(imageApply && videoApply);
    assert.doesNotMatch(imageApply, /uploadImage\(/);
    assert.doesNotMatch(videoApply, /uploadVideo\(/);
});

test("video/audio tersimpan dijelaskan dipakai utuh, bukan bisa dipotong", () => {
    assert.match(
        formMediaSource,
        /Video dari unggahan tersimpan dipakai utuh \(tidak dipotong ulang\)\./
    );
    assert.match(
        formMediaSource,
        /Audio dari unggahan tersimpan dipakai utuh \(tidak dipotong ulang\)\./
    );
});

test("retensi upload tetap 1 jam — fitur ini tidak memperpanjang umur file", () => {
    assert.equal(STORED_UPLOAD_TTL_MS, 60 * 60 * 1000);

    assert.match(
        retentionSource,
        /export const UPLOAD_TTL_MS =\s*\n?\s*1 \* HOUR_MS;/
    );

    assert.match(generateHtml, /hanya bisa dipakai[\s\S]*?<strong>1 jam<\/strong>/);
    assert.match(generateHtml, /dihapus otomatis dari penyimpanan/);
});

test("panel punya gaya yang mengikuti tema gelap dan cerah", () => {
    const css = read("generate/assets/css/generate-media-blocks.css");

    assert.match(css, /\.generate-stored-uploads\s*\{/);
    assert.match(css, /\.generate-stored-uploads-toggle/);
    assert.match(css, /\.generate-stored-upload-thumb img/);
    assert.match(
        css,
        /html\[data-genz-theme="light"\]\[data-genz-theme="light"\] body #dynamicFields \.generate-stored-upload \{/,
        "mode cerah tidak boleh tertinggal"
    );

    assert.match(
        generateHtml,
        /Selama masih tersimpan, file itu bisa dipakai[\s\S]*?Unggahan tersimpan/,
        "catatan retensi harus menyebut tombol pemakaian ulang"
    );
});

test("halaman Generate memakai versi aset terbaru", () => {
    assert.match(
        generateHtml,
        /generate-media-blocks\.css\?v=stored-uploads-20261026/
    );

    assert.match(
        generateHtml,
        /generate-app\.js\?v=stored-uploads-20261026/
    );

    const formSource = read("generate/assets/js/generate-form.js");

    assert.match(
        formSource,
        /generate-form-media\.js\?v=stored-uploads-20261026/
    );
});

test("membaca file langsung di generate-input/<userId>/<file> (format uploadImageFile/uploadVideoFile/uploadAudioFile) beserta timestamp PostgreSQL & Safari", async () => {
    const nowMs = Date.parse("2026-10-30T11:00:00.000Z");

    const flatItems = [
        {
            name: "audio-e495a0a0-66ee-43ee-843a-c1c88099767d.wav",
            id: "8c16d7eb-4939-496a-aba8-89734f9052a1",
            created_at: "2026-10-30 10:46:03.425391+00",
            updated_at: "2026-10-30 10:46:03.425391+00",
            metadata: { size: 1920044, mimetype: "audio/wav" }
        },
        {
            name: "f93340db-402a-4f5a-9228-6032d7c01798.png",
            id: "cf354ed5-df9f-424f-94b0-a1fdcc520bcf",
            created_at: "2026-10-30 10:44:24.552465+00",
            updated_at: "2026-10-30 10:44:24.552465+00",
            metadata: { size: 5455252, mimetype: "image/png" }
        },
        {
            name: "video-9b12c34d-1111-4222-8333-444455556666.mp4",
            id: "ab12cd34-1111-4222-8333-444455556666",
            created_at: "2026-10-30T10:50:00.000Z",
            updated_at: "2026-10-30T10:50:00.000Z",
            metadata: { size: 8400123, mimetype: "video/mp4" }
        },
        {
            name: "sudah-lewat-sejam.png",
            id: "deadbeef-0000-4000-8000-000000000001",
            created_at: "2026-10-30 09:30:00.000000+00",
            updated_at: "2026-10-30 09:30:00.000000+00",
            metadata: { size: 120000, mimetype: "image/png" }
        }
    ];

    const supabase = {
        supabaseUrl: "https://ycovbqmezhrvzobxqnyp.supabase.co",
        storage: {
            from: () => ({
                list: async prefix => {
                    assert.equal(prefix, ROOT_PATH);
                    return { data: flatItems, error: null };
                },
                createSignedUrl: async objectPath => ({
                    data: {
                        signedUrl: `/storage/v1/object/sign/user-uploads/${objectPath}?token=abc`
                    },
                    error: null
                })
            })
        }
    };

    const images = await listStoredUploads({
        supabase,
        userId: USER_ID,
        now: nowMs,
        kinds: ["image"]
    });
    assert.deepEqual(
        images.map(item => item.name),
        ["f93340db-402a-4f5a-9228-6032d7c01798.png"],
        "foto < 1 jam tampil dan foto > 1 jam disaring"
    );
    assert.equal(
        images[0].url,
        `https://ycovbqmezhrvzobxqnyp.supabase.co/storage/v1/object/sign/user-uploads/${ROOT_PATH}/f93340db-402a-4f5a-9228-6032d7c01798.png?token=abc`
    );

    const videos = await listStoredUploads({
        supabase,
        userId: USER_ID,
        now: nowMs,
        kinds: ["video"]
    });
    assert.deepEqual(
        videos.map(item => item.name),
        ["video-9b12c34d-1111-4222-8333-444455556666.mp4"]
    );

    const audios = await listStoredUploads({
        supabase,
        userId: USER_ID,
        now: nowMs,
        kinds: ["audio"]
    });
    assert.deepEqual(
        audios.map(item => item.name),
        ["audio-e495a0a0-66ee-43ee-843a-c1c88099767d.wav"]
    );

    const allMedia = await listStoredUploads({
        supabase,
        userId: USER_ID,
        now: nowMs
    });
    assert.deepEqual(
        allMedia.map(item => item.name),
        [
            "video-9b12c34d-1111-4222-8333-444455556666.mp4",
            "audio-e495a0a0-66ee-43ee-843a-c1c88099767d.wav",
            "f93340db-402a-4f5a-9228-6032d7c01798.png"
        ],
        "diurutkan dari unggahan paling baru"
    );
});

test("panel memuat ulang daftar saat dibuka kembali atau tombol Muat ulang diklik setelah upload baru", async () => {
    await withFakeDocument(async () => {
        const currentFiles = [];
        const supabase = {
            storage: {
                from: () => ({
                    list: async () => ({ data: [...currentFiles], error: null }),
                    createSignedUrl: async objectPath => ({
                        data: {
                            signedUrl: `https://project.supabase.co/storage/v1/object/sign/${objectPath}?token=1`
                        },
                        error: null
                    })
                })
            }
        };

        const panel = createPanel({
            kinds: ["image"],
            now: () => NOW,
            getContext: async () => ({ supabase, userId: USER_ID })
        });

        /* 1. Dibuka saat belum ada unggahan */
        await panel.expand();
        assert.equal(
            findButtons(panel.element).filter(b => b.dataset.storedPath).length,
            0
        );

        /* 2. Ditutup, user mengunggah foto baru (format flat generate-form-upload.js), lalu dibuka lagi */
        panel.collapse();
        currentFiles.push({
            name: "f93340db-402a-4f5a-9228-6032d7c01798.png",
            id: "img-1",
            created_at: new Date(NOW - 2 * MINUTE).toISOString(),
            metadata: { size: 2048, mimetype: "image/png" }
        });

        await panel.expand();
        const afterReopen = findButtons(panel.element).filter(
            b => b.dataset.storedPath
        );
        assert.equal(afterReopen.length, 1);
        assert.equal(
            afterReopen[0].dataset.storedPath,
            `${ROOT_PATH}/f93340db-402a-4f5a-9228-6032d7c01798.png`
        );

        /* 3. Saat panel masih terbuka, user mengunggah foto ke-2 lalu klik Muat ulang */
        currentFiles.push({
            name: "8201afea-5a53-47fe-a6f9-f02e62ee4088.jpg",
            id: "img-2",
            created_at: new Date(NOW - 1 * MINUTE).toISOString(),
            metadata: { size: 4096, mimetype: "image/jpeg" }
        });

        await panel.refresh();
        const afterRefresh = findButtons(panel.element).filter(
            b => b.dataset.storedPath
        );
        assert.equal(afterRefresh.length, 2);
        assert.equal(
            afterRefresh[0].dataset.storedPath,
            `${ROOT_PATH}/8201afea-5a53-47fe-a6f9-f02e62ee4088.jpg`,
            "foto terbaru muncul paling atas saat Muat ulang diklik"
        );
    });
});

