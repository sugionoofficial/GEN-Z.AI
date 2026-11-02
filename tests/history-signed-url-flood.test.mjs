import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

/*
 * REGRESSION: banjir "Object not found" di konsol halaman History.
 *
 * Laporan pengguna (02/11/2026):
 *
 *   POST https://…supabase.co/storage/v1/object/sign/user-uploads/… 400
 *   Gagal membuat signed URL: generate-input/<uid>/<uuid>.jpg Object not found
 *   … diulang ribuan kali ("6499 log entries are not shown").
 *
 * Penyebab:
 *   1. Cron retensi menghapus file (upload Generate 1 jam, media
 *      upscale 24 jam) tetapi baris riwayat menyimpan referensinya
 *      selamanya, jadi setiap reload meminta signed URL untuk file
 *      yang sudah pasti tidak ada.
 *   2. Hanya URL sukses yang masuk cache. Kegagalan tidak diingat,
 *      sehingga auto-refresh 10 detik + status sync mengulang
 *      request identik tanpa henti.
 *   3. Satu POST per referensi (200 baris x 3 kolom), tanpa dedupe
 *      untuk path yang dipakai banyak baris.
 *   4. Setiap kegagalan mencetak console.warn sendiri.
 *
 * Aturan yang dijaga tes ini:
 *   - Referensi lewat masa retensi TIDAK dikirim ke Storage API.
 *   - Kegagalan diingat: reload berikutnya tidak menembak lagi.
 *   - Path yang sama hanya ditandatangani sekali per gelombang.
 *   - Request paralel untuk ref sama dipakai bersama.
 *   - Penandatanganan memakai batch bila client mendukungnya.
 *   - Konsol menerima ringkasan, bukan satu baris per file.
 *   - Hasil yang masih hidup tetap mendapat signed URL.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const dataSource = readFileSync(
    path.join(root, "history/assets/js/history-data.js"),
    "utf8"
);
const historyHtml = readFileSync(path.join(root, "history/index.html"), "utf8");

const USER_ID = "c237fcef-6456-451e-ae98-691f2dabb60d";

const HOUR_MS = 60 * 60 * 1000;

function inputRef(name = "foto.jpg") {
    return `supabase-private://user-uploads/generate-input/${USER_ID}/${name}`;
}

function outputRef(name = "hasil.png") {
    return `supabase-private://user-uploads/upscale-photos/outputs/${USER_ID}/${name}`;
}

function loadDataModule(client, { logs = [] } = {}) {
    const windowObj = { GENZHistory: { state: {} } };

    const sandbox = {
        window: windowObj,
        console: {
            warn: (...args) => logs.push({ level: "warn", args }),
            info: (...args) => logs.push({ level: "info", args }),
            log: (...args) => logs.push({ level: "log", args }),
            error: (...args) => logs.push({ level: "error", args })
        },
        setTimeout,
        clearTimeout,
        Number,
        String,
        Boolean,
        Array,
        Object,
        Date,
        URL,
        Promise,
        Map,
        Set,
        Math,
        JSON
    };

    vm.createContext(sandbox);
    vm.runInContext(dataSource, sandbox);

    const App = windowObj.GENZHistory;
    App.state.supabaseClient = client;
    App.state.currentUser = { id: USER_ID };
    App.state.historyData = [];
    return App;
}

/**
 * Client palsu yang menghitung request. `missing` menentukan path
 * yang dianggap sudah dihapus cron. `batch: false` mensimulasikan
 * client lama tanpa createSignedUrls.
 */
function makeClient({ missing = () => true, batch = true, delay = 0 } = {}) {
    const singleCalls = [];
    const batchCalls = [];

    const makeApi = bucket => {
        const api = {
            createSignedUrl: async (objectPath, ttl) => {
                singleCalls.push({ bucket, objectPath, ttl });

                if (delay) {
                    await new Promise(resolve => setTimeout(resolve, delay));
                }

                if (missing(objectPath)) {
                    return { data: null, error: { message: "Object not found" } };
                }

                return {
                    data: {
                        signedUrl:
                            `https://project.supabase.co/storage/v1/object/sign/${bucket}/${objectPath}?token=abc`
                    },
                    error: null
                };
            }
        };

        if (batch) {
            api.createSignedUrls = async (paths, ttl) => {
                batchCalls.push({ bucket, paths: [...paths], ttl });

                if (delay) {
                    await new Promise(resolve => setTimeout(resolve, delay));
                }

                return {
                    data: paths.map(objectPath => ({
                        path: objectPath,
                        error: missing(objectPath) ? "Object not found" : null,
                        signedUrl: missing(objectPath)
                            ? null
                            : `https://project.supabase.co/storage/v1/object/sign/${bucket}/${objectPath}?token=abc`
                    })),
                    error: null
                };
            };
        }

        return api;
    };

    return {
        singleCalls,
        batchCalls,
        get totalRequests() {
            return singleCalls.length + batchCalls.length;
        },
        get signedPaths() {
            return [
                ...singleCalls.map(call => call.objectPath),
                ...batchCalls.flatMap(call => call.paths)
            ];
        },
        storage: { from: makeApi }
    };
}

/* ---------------------------------------------------------
   1. REFERENSI LEWAT RETENSI TIDAK PERGI KE STORAGE API
--------------------------------------------------------- */

test("upload Generate yang lewat 1 jam tidak pernah diminta signed URL lagi", async () => {
    const client = makeClient();
    const App = loadDataModule(client);

    const items = [
        {
            id: "lama",
            status: "success",
            created_at: new Date(Date.now() - 3 * HOUR_MS).toISOString(),
            result_url: "https://provider.example/hasil.mp4",
            image_reference_url: inputRef("lama.jpg")
        }
    ];

    await App.resolvePrivateMediaRefs(items);

    assert.equal(
        client.totalRequests,
        0,
        "file yang pasti sudah dihapus cron tidak boleh ditembak ke Storage API"
    );
    assert.equal(items[0].image_reference_url, "");
    assert.equal(items[0].reference_expired.image_reference_url, true);
    assert.equal(
        items[0].result_url,
        "https://provider.example/hasil.mp4",
        "hasil provider tetap utuh"
    );
    assert.equal(Boolean(items[0].media_expired), false);
});

test("output upscale yang lewat 24 jam ditandai kedaluwarsa tanpa request", async () => {
    const client = makeClient();
    const App = loadDataModule(client);

    const items = [
        {
            id: "output-lama",
            status: "success",
            created_at: new Date(Date.now() - 30 * HOUR_MS).toISOString(),
            result_url: outputRef("lama.png")
        }
    ];

    await App.resolvePrivateMediaRefs(items);

    assert.equal(client.totalRequests, 0);
    assert.equal(items[0].result_url, "");
    assert.equal(items[0].media_expired, true);
});

test("upload yang masih dalam masa simpan tetap ditandatangani", async () => {
    const client = makeClient({ missing: () => false });
    const App = loadDataModule(client);

    const items = [
        {
            id: "baru",
            status: "success",
            created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
            image_reference_url: inputRef("baru.jpg")
        }
    ];

    await App.resolvePrivateMediaRefs(items);

    assert.equal(client.totalRequests, 1, "file yang masih hidup tetap diminta");
    assert.match(
        items[0].image_reference_url,
        /^https:\/\/project\.supabase\.co\/storage\/v1\/object\/sign\//
    );
    assert.equal(Boolean(items[0].reference_expired?.image_reference_url), false);
});

test("baris tanpa created_at tidak ditebak umurnya", async () => {
    const client = makeClient({ missing: () => false });
    const App = loadDataModule(client);

    const items = [{ id: "tanpa-tanggal", image_reference_url: inputRef("x.jpg") }];

    await App.resolvePrivateMediaRefs(items);

    assert.equal(client.totalRequests, 1);
    assert.match(items[0].image_reference_url, /^https:\/\//);
});

/* ---------------------------------------------------------
   2. KEGAGALAN DIINGAT — TIDAK ADA REQUEST BERULANG
--------------------------------------------------------- */

test("referensi yang hilang tidak ditembak ulang saat reload berikutnya", async () => {
    const client = makeClient({ missing: () => true });
    const App = loadDataModule(client);

    const makeItems = () => [
        {
            id: "hilang",
            status: "success",
            created_at: new Date().toISOString(),
            image_reference_url: inputRef("hilang.jpg")
        }
    ];

    const first = makeItems();
    await App.resolvePrivateMediaRefs(first);
    const afterFirst = client.totalRequests;

    assert.equal(afterFirst, 1, "percobaan pertama wajar terjadi");

    for (let i = 0; i < 10; i++) {
        await App.resolvePrivateMediaRefs(makeItems());
    }

    assert.equal(
        client.totalRequests,
        afterFirst,
        "10 reload berikutnya tidak boleh menambah request untuk file yang sama"
    );
});

test("timer refresh 5 menit melewati file yang sudah terbukti hilang", async () => {
    const client = makeClient({ missing: () => true });
    const App = loadDataModule(client);

    const items = [
        {
            id: "hilang",
            status: "success",
            created_at: new Date().toISOString(),
            image_reference_url: inputRef("hilang.jpg")
        }
    ];

    await App.resolvePrivateMediaRefs(items);
    const afterResolve = client.totalRequests;

    App.state.historyData = items;

    for (let i = 0; i < 5; i++) {
        await App.refreshPrivateMediaRefs();
    }

    assert.equal(
        client.totalRequests,
        afterResolve,
        "refreshPrivateMediaRefs tidak boleh mengulang file yang hilang"
    );
});

/* ---------------------------------------------------------
   3. DEDUPE — SATU PATH SEKALI PER GELOMBANG
--------------------------------------------------------- */

test("path yang dipakai banyak baris hanya ditandatangani sekali", async () => {
    const client = makeClient({ missing: () => false });
    const App = loadDataModule(client);

    const shared = inputRef("dipakai-ulang.jpg");

    const items = Array.from({ length: 25 }, (_, index) => ({
        id: `row-${index}`,
        status: "success",
        created_at: new Date().toISOString(),
        image_reference_url: shared
    }));

    await App.resolvePrivateMediaRefs(items);

    assert.equal(
        client.signedPaths.filter(value => value.endsWith("dipakai-ulang.jpg")).length,
        1,
        "25 baris dengan file sama cukup satu penandatanganan"
    );

    items.forEach(item => {
        assert.match(item.image_reference_url, /^https:\/\//);
    });
});

test("request paralel untuk referensi sama dipakai bersama", async () => {
    const client = makeClient({ missing: () => false, delay: 15 });
    const App = loadDataModule(client);

    const shared = inputRef("paralel.jpg");
    const rows = () => [
        {
            id: "row",
            created_at: new Date().toISOString(),
            image_reference_url: shared
        }
    ];

    const a = rows();
    const b = rows();
    const c = rows();

    await Promise.all([
        App.resolvePrivateMediaRefs(a),
        App.resolvePrivateMediaRefs(b),
        App.resolvePrivateMediaRefs(c)
    ]);

    assert.equal(
        client.signedPaths.filter(value => value.endsWith("paralel.jpg")).length,
        1,
        "tiga reload bersamaan tidak boleh menghasilkan tiga request"
    );
    assert.match(a[0].image_reference_url, /^https:\/\//);
    assert.match(b[0].image_reference_url, /^https:\/\//);
    assert.match(c[0].image_reference_url, /^https:\/\//);
});

/* ---------------------------------------------------------
   4. BATCH — SATU POST MENGGANTIKAN RATUSAN
--------------------------------------------------------- */

test("penandatanganan memakai createSignedUrls secara batch", async () => {
    const client = makeClient({ missing: () => false });
    const App = loadDataModule(client);

    const items = Array.from({ length: 40 }, (_, index) => ({
        id: `row-${index}`,
        status: "success",
        created_at: new Date().toISOString(),
        image_reference_url: inputRef(`file-${index}.jpg`)
    }));

    await App.resolvePrivateMediaRefs(items);

    assert.equal(client.singleCalls.length, 0, "tidak ada POST per objek");
    assert.equal(client.batchCalls.length, 1, "40 path cukup satu request batch");
    assert.equal(client.batchCalls[0].paths.length, 40);

    items.forEach(item => {
        assert.match(item.image_reference_url, /^https:\/\//);
    });
});

test("file hilang di dalam batch tidak menjadi error jaringan per file", async () => {
    const client = makeClient({
        missing: objectPath => objectPath.includes("hilang")
    });
    const logs = [];
    const App = loadDataModule(client, { logs });

    const items = Array.from({ length: 30 }, (_, index) => ({
        id: `row-${index}`,
        status: "success",
        created_at: new Date().toISOString(),
        image_reference_url: inputRef(`hilang-${index}.jpg`)
    }));

    await App.resolvePrivateMediaRefs(items);

    assert.equal(client.batchCalls.length, 1);
    assert.equal(client.singleCalls.length, 0);

    items.forEach(item => {
        assert.equal(item.image_reference_url, "");
        assert.equal(item.reference_expired.image_reference_url, true);
    });

    assert.equal(
        logs.filter(entry => entry.level === "warn").length,
        0,
        "tidak ada console.warn per file"
    );
    assert.equal(
        logs.filter(entry => entry.level === "info").length,
        1,
        "cukup satu ringkasan untuk seluruh gelombang"
    );
});

test("campuran file hidup dan hilang dipisahkan dengan benar", async () => {
    const client = makeClient({
        missing: objectPath => objectPath.includes("hilang")
    });
    const App = loadDataModule(client);

    const items = [
        {
            id: "hidup",
            created_at: new Date().toISOString(),
            image_reference_url: inputRef("hidup.jpg"),
            result_url: outputRef("ada.png")
        },
        {
            id: "mati",
            created_at: new Date().toISOString(),
            image_reference_url: inputRef("hilang.jpg"),
            result_url: outputRef("hilang.png")
        }
    ];

    await App.resolvePrivateMediaRefs(items);

    assert.match(items[0].image_reference_url, /^https:\/\//);
    assert.match(items[0].result_url, /^https:\/\//);
    assert.equal(Boolean(items[0].media_expired), false);

    assert.equal(items[1].image_reference_url, "");
    assert.equal(items[1].result_url, "");
    assert.equal(items[1].media_expired, true);
});

test("client tanpa API batch tetap jalan lewat jalur per objek", async () => {
    const client = makeClient({ missing: () => false, batch: false });
    const App = loadDataModule(client);

    const items = Array.from({ length: 12 }, (_, index) => ({
        id: `row-${index}`,
        created_at: new Date().toISOString(),
        image_reference_url: inputRef(`legacy-${index}.jpg`)
    }));

    await App.resolvePrivateMediaRefs(items);

    assert.equal(client.batchCalls.length, 0);
    assert.equal(client.singleCalls.length, 12);
    items.forEach(item => {
        assert.match(item.image_reference_url, /^https:\/\//);
    });
});

/* ---------------------------------------------------------
   5. LOG TIDAK BERULANG
--------------------------------------------------------- */

test("reload berulang tidak mengulang pesan konsol yang sama", async () => {
    const client = makeClient({ missing: () => true });
    const logs = [];
    const App = loadDataModule(client, { logs });

    const items = () => [
        {
            id: "hilang",
            created_at: new Date(Date.now() - 5 * HOUR_MS).toISOString(),
            image_reference_url: inputRef("lama.jpg")
        }
    ];

    for (let i = 0; i < 20; i++) {
        await App.resolvePrivateMediaRefs(items());
    }

    assert.equal(
        logs.length,
        1,
        "20 reload hanya menghasilkan satu baris log, bukan ribuan"
    );
});

/* ---------------------------------------------------------
   6. KONTRAK SUMBER & VERSI CACHE
--------------------------------------------------------- */

test("modul data memuat penjaga anti banjir request", () => {
    assert.match(dataSource, /PRIVATE_MEDIA_MISSING_RETRY_MS/);
    assert.match(dataSource, /privateMediaMissing/);
    assert.match(dataSource, /privateMediaInFlight/);
    assert.match(dataSource, /createSignedUrls/);
    assert.match(dataSource, /isPrivateMediaRetentionExpired/);
    assert.match(
        dataSource,
    /PRIVATE_MEDIA_MAX_CONCURRENCY/,
        "request per objek tetap dibatasi"
    );
    assert.doesNotMatch(
        dataSource,
        /console\.warn\(\s*"Gagal membuat signed URL:"/,
        "warning per file harus sudah dihapus"
    );
});

test("halaman History memuat versi modul yang sudah diperbaiki", () => {
    assert.match(
        historyHtml,
        /history-data\.js\?v=20261026-expiry-result-only[^"]*signed-url-flood-20261102/
    );
});

test("route batch yang tidak tersedia jatuh kembali ke per objek, bukan mengosongkan media", async () => {
    const client = makeClient({ missing: () => false });
    const App = loadDataModule(client);

    let batchAttempts = 0;

    client.storage.from = bucket => ({
        createSignedUrls: async () => {
            batchAttempts++;
            return {
                data: null,
                error: { message: "Not Found", status: 404, statusCode: "404" }
            };
        },
        createSignedUrl: async (objectPath, ttl) => {
            client.singleCalls.push({ bucket, objectPath, ttl });
            return {
                data: {
                    signedUrl:
                        `https://project.supabase.co/storage/v1/object/sign/${bucket}/${objectPath}?token=abc`
                },
                error: null
            };
        }
    });

    const items = Array.from({ length: 4 }, (_, index) => ({
        id: `row-${index}`,
        created_at: new Date().toISOString(),
        image_reference_url: inputRef(`fallback-${index}.jpg`)
    }));

    await App.resolvePrivateMediaRefs(items);

    assert.equal(batchAttempts, 1, "batch hanya dicoba sekali");
    assert.equal(client.singleCalls.length, 4, "jatuh kembali ke per objek");

    items.forEach(item => {
        assert.match(
            item.image_reference_url,
            /^https:\/\//,
            "media yang masih hidup tidak boleh ikut kosong"
        );
    });

    // Gelombang berikutnya langsung memakai jalur per objek.
    const next = [
        {
            id: "next",
            created_at: new Date().toISOString(),
            image_reference_url: inputRef("fallback-next.jpg")
        }
    ];

    await App.resolvePrivateMediaRefs(next);

    assert.equal(batchAttempts, 1, "tidak mencoba batch lagi di sesi ini");
    assert.match(next[0].image_reference_url, /^https:\/\//);
});
