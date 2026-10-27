import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

/*
 * REGRESSION: "Media sudah kedaluwarsa" muncul padahal belum 24 jam.
 *
 * Laporan pengguna (26/10/2026):
 *
 *   Wan 2.2 Animate Mix, dibuat 15.14.57, selesai 15.21.17.
 *   Modal History berkata "Media sudah kedaluwarsa — file disimpan
 *   hanya 24 jam lalu dihapus otomatis", PADAHAL hasilnya masih ada
 *   (tautan OSS provider masih hidup) dan belum 24 jam.
 *
 * Penyebabnya:
 *
 *   1. `resolvePrivateMediaRefs` menandai `media_expired` pada BARIS
 *      RIWAYAT setiap kali ada media privat yang gagal ditandatangani
 *      — termasuk `image_reference_url` / `video_reference_url`.
 *      Padahal upload input hanya disimpan 1 jam, jadi referensi foto
 *      acuan sudah hilang lebih dulu, sementara HASIL generation
 *      tetap hidup. Akibatnya modal menyembunyikan hasil yang masih
 *      bisa dibuka.
 *   2. Semua kedaluwarsa dijelaskan "dihapus setelah 24 jam", padahal
 *      tautan bertanda tangan dari provider bisa kedaluwarsa sendiri.
 *
 * Aturan yang dijaga tes ini:
 *   - Hanya kegagalan `result_url` yang menandai media hasil
 *     kedaluwarsa.
 *   - Referensi input yang hilang TIDAK menghilangkan hasil.
 *   - `Expires` pada URL adalah DETIK; URL yang masih berlaku tidak
 *     boleh dianggap kedaluwarsa.
 *   - Keterangan di modal sesuai sebabnya, dan tautan hasil yang
 *     sudah mati tidak ditampilkan.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const renderSource = readFileSync(
    path.join(root, "history/assets/js/history-render.js"),
    "utf8"
);
const dataSource = readFileSync(
    path.join(root, "history/assets/js/history-data.js"),
    "utf8"
);
const modalSource = readFileSync(
    path.join(root, "history/assets/js/history-modal.js"),
    "utf8"
);
const historyHtml = readFileSync(path.join(root, "history/index.html"), "utf8");

const OSS_URL_LIVE =
    "https://dashscope-f4de.oss-ap-southeast-5.aliyuncs.com/1d/4f/20261026/f244af48/b8b798e7-5e89-4409-b3c9-1838c2aae80a.mp4" +
    `?Expires=${Math.floor(Date.now() / 1000) + 86400}&OSSAccessKeyId=LTAI5tRcsWJEymQaTsKbKqGf&Signature=q0r2QX2BmvwSFSUYXqFyBan4%2FaA%3D`;

function loadRenderModule() {
    const sandbox = {
        window: { GENZHistory: {} },
        document: {
            querySelectorAll: () => [],
            querySelector: () => null
        },
        console,
        setTimeout,
        clearTimeout,
        requestAnimationFrame: callback => callback(),
        Number,
        String,
        Math,
        JSON,
        Array,
        Object,
        Date,
        URL
    };

    vm.createContext(sandbox);
    vm.runInContext(renderSource, sandbox);

    return sandbox.window.GENZHistory;
}

function loadDataModule(client) {
    const sandbox = {
        window: { GENZHistory: {} },
        document: {
            getElementById: () => null,
            querySelector: () => null,
            querySelectorAll: () => [],
            addEventListener: () => {}
        },
        console: { warn: () => {}, log: () => {}, error: () => {}, info: () => {} },
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
        requestAnimationFrame: callback => callback(),
        Number,
        String,
        Math,
        JSON,
        Array,
        Object,
        Date,
        URL,
        Promise,
        Map,
        Set
    };

    vm.createContext(sandbox);
    vm.runInContext(dataSource, sandbox);

    const App = sandbox.window.GENZHistory;
    App.state.supabaseClient = client;
    return App;
}

function makeClient({ failingPaths = [] } = {}) {
    const calls = [];

    return {
        calls,
        storage: {
            from: bucket => ({
                createSignedUrl: async (objectPath, ttl) => {
                    calls.push({ bucket, objectPath, ttl });

                    if (failingPaths.some(part => objectPath.includes(part))) {
                        return {
                            data: null,
                            error: { message: "Object not found" }
                        };
                    }

                    return {
                        data: {
                            signedUrl:
                                `https://project.supabase.co/storage/v1/object/sign/${bucket}/${objectPath}?token=abc`
                        },
                        error: null
                    };
                }
            })
        }
    };
}

const USER_REF_PHOTO =
    "supabase-private://user-uploads/generate-input/20261026-face.jpg";
const USER_REF_VIDEO =
    "supabase-private://user-uploads/generate-input/20261026-source.mp4";

/* ---------------------------------------------------------
   1. SUMBER DATA: REFERENSI GAGAL BUKAN HASIL KEDALUWARSA
--------------------------------------------------------- */

test("referensi input yang gagal di-sign tidak menandai hasil kedaluwarsa", async () => {
    const client = makeClient({ failingPaths: ["generate-input"] });
    const App = loadDataModule(client);

    const items = [
        {
            id: "b8b798e7",
            status: "success",
            created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            result_url: OSS_URL_LIVE,
            image_reference_url: USER_REF_PHOTO,
            video_reference_url: USER_REF_VIDEO
        }
    ];

    await App.resolvePrivateMediaRefs(items);

    const item = items[0];

    assert.equal(
        Boolean(item.media_expired),
        false,
        "hasil tetap hidup, jadi baris riwayat tidak boleh ditandai kedaluwarsa"
    );
    assert.equal(item.result_url, OSS_URL_LIVE, "tautan hasil tidak boleh disentuh");
    assert.equal(item.image_reference_url, "", "referensi kosong, bukan URL mentah");
    assert.equal(item.video_reference_url, "");
    assert.deepEqual(
        { ...item.reference_expired },
        { image_reference_url: true, video_reference_url: true },
        "referensi yang hilang dicatat terpisah"
    );
});

test("hasil privat yang gagal di-sign tetap ditandai kedaluwarsa", async () => {
    const client = makeClient({ failingPaths: ["outputs/hilang"] });
    const App = loadDataModule(client);

    const items = [
        {
            id: "upscale-1",
            status: "success",
            created_at: new Date().toISOString(),
            result_url:
                "supabase-private://user-uploads/upscale-photos/outputs/hilang.mp4"
        }
    ];

    await App.resolvePrivateMediaRefs(items);

    assert.equal(items[0].media_expired, true);
    assert.equal(items[0].result_url, "");
});

test("hasil privat yang berhasil di-sign tidak ditandai kedaluwarsa", async () => {
    const client = makeClient();
    const App = loadDataModule(client);

    const items = [
        {
            id: "upscale-2",
            status: "success",
            created_at: new Date().toISOString(),
            result_url:
                "supabase-private://user-uploads/upscale-photos/outputs/ada.mp4"
        }
    ];

    await App.resolvePrivateMediaRefs(items);

    assert.equal(Boolean(items[0].media_expired), false);
    assert.match(items[0].result_url, /^https:\/\/project\.supabase\.co\/storage\/v1\/object\/sign\//);
});

/* ---------------------------------------------------------
   2. RENDER: PENILAIAN KEDALUWARSA
--------------------------------------------------------- */

test("URL provider yang masih berlaku tidak dianggap kedaluwarsa", () => {
    const App = loadRenderModule();

    const future = Math.floor(Date.now() / 1000) + 6 * 60 * 60;

    const item = {
        status: "success",
        created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        result_url: `https://dashscope.aliyuncs.com/hasil.mp4?Expires=${future}&Signature=x`
    };

    assert.equal(App.getMediaExpiryReason(item), "");
    assert.equal(App.isExpiredMedia(item), false);
});

test("URL provider yang lewat masa berlaku disebut link kedaluwarsa, bukan file dihapus", () => {
    const App = loadRenderModule();

    const past = Math.floor(Date.now() / 1000) - 60;

    const item = {
        status: "success",
        created_at: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(),
        result_url: `https://dashscope.aliyuncs.com/hasil.mp4?Expires=${past}&Signature=x`
    };

    assert.equal(App.getMediaExpiryReason(item), "link");
});

test("Expires dibaca sebagai detik, bukan milidetik", () => {
    const App = loadRenderModule();

    const future = Math.floor(Date.now() / 1000) + 3600;

    assert.equal(
        App.getSignedLinkExpiresAt(`https://x.test/a.mp4?Expires=${future}`),
        future * 1000
    );
});

test("tautan provider tanpa parameter kedaluwarsa tetap dianggap hidup", () => {
    const App = loadRenderModule();

    assert.equal(App.getMediaExpiryReason({ result_url: OSS_URL_LIVE }), "");
    assert.equal(
        App.getMediaExpiryReason({ result_url: "https://x.test/a.mp4" }),
        ""
    );
});

test("media Supabase yang dikelola sendiri kedaluwarsa setelah 24 jam", () => {
    const App = loadRenderModule();

    const managedUrl =
        "https://project.supabase.co/storage/v1/object/public/dashboard-videos/upscale-videos/a.mp4";

    assert.equal(
        App.getMediaExpiryReason({
            result_url: managedUrl,
            created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
        }),
        "",
        "2 jam belum lewat masa simpan"
    );

    assert.equal(
        App.getMediaExpiryReason({
            result_url: managedUrl,
            created_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
        }),
        "deleted"
    );
});

test("penanda media_expired dari data tetap dihormati", () => {
    const App = loadRenderModule();

    assert.equal(
        App.getMediaExpiryReason({ result_url: OSS_URL_LIVE, media_expired: true }),
        "deleted"
    );
});

/* ---------------------------------------------------------
   3. MODAL: KETERANGAN JUJUR & TAUTAN MATI TIDAK DITAMPILKAN
--------------------------------------------------------- */

test("modal membedakan sebab kedaluwarsa", () => {
    assert.match(modalSource, /Tautan hasil sudah kedaluwarsa/);
    assert.match(modalSource, /Berkas hasil sudah tidak tersedia di penyimpanan/);
    assert.doesNotMatch(
        modalSource,
        /File ini disimpan hanya 24 jam lalu dihapus otomatis/,
        "klaim 24 jam untuk semua kasus harus dihapus"
    );
});

test("modal tidak menampilkan tautan hasil yang sudah mati", () => {
    const expiredBlock =
        modalSource.match(
            /function renderResult\(item\) \{[\s\S]*?\n    \}/
        )?.[0] || "";

    assert.ok(expiredBlock, "renderResult harus tetap ada");
    assert.match(
        expiredBlock,
        /isMediaExpired\(item\)/,
        "renderResult harus memeriksa kedaluwarsa"
    );
    assert.match(expiredBlock, /Tautan hasil sudah tidak tersedia\./);
});

test("halaman History memuat versi modul terbaru", () => {
    assert.match(
        historyHtml,
        /history-data\.js\?v=20261026-expiry-result-only/
    );
    assert.match(
        historyHtml,
        /history-render\.js\?v=20261026-expiry-result-only/
    );
    assert.match(
        historyHtml,
        /history-modal\.js\?v=20261026-expiry-result-only/
    );
});
