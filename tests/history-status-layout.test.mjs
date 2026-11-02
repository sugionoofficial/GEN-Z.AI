import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

/*
 * REGRESSION: blok status ("SUCCESS" / "PROCESSING" / "DIBATALKAN")
 * terpotong di halaman History.
 *
 * Laporan pengguna (02/11/2026): badge status tampil sebagai
 * "SUCCES" dan "DIBATAL", provider/model hilang, dan label
 * "DIBATALKAN" di thumbnail keluar dari kotak jadi "BATALK".
 *
 * Penyebab: layout kartu History memakai selector POSISIONAL
 * `td:nth-child(N)`. Sejak kolom User hanya dirender pada scope
 * global (PR #287), urutan sel bergeser satu posisi pada riwayat
 * pribadi:
 *
 *   nth-child(3) { display: none }  -> malah menyembunyikan PROVIDER
 *   nth-child(7) { grid-column: 1 } -> STATUS masuk kolom thumbnail 64px
 *
 * Aturan yang dijaga tes ini:
 *   - Tidak ada lagi selector posisional untuk sel History.
 *   - Setiap sel dipasang lewat class semantiknya.
 *   - Sel status tidak berada di kolom thumbnail yang sempit.
 *   - Sel status/credit tidak memotong isinya.
 *   - Label status di dalam thumbnail punya ukuran font sendiri.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const historyHtml = readFileSync(path.join(root, "history/index.html"), "utf8");
const renderSource = readFileSync(
    path.join(root, "history/assets/js/history-render.js"),
    "utf8"
);

const SEMANTIC_CELLS = [
    "history-thumbnail-cell",
    "history-date-cell",
    "history-user-cell",
    "history-provider-cell",
    "history-model-cell",
    "history-prompt-cell",
    "history-credit-cell",
    "history-status-cell",
    "history-action-cell"
];

function loadRenderModule() {
    const windowObj = { GENZHistory: { state: {} } };
    const sandbox = {
        window: windowObj,
        document: {
            querySelectorAll: () => [],
            querySelector: () => null
        },
        console,
        setTimeout,
        clearTimeout,
        requestAnimationFrame: callback => callback(),
        Number, String, Math, JSON, Array, Object, Date, URL,
        Boolean, Map, Set, Promise
    };

    vm.createContext(sandbox);
    vm.runInContext(renderSource, sandbox);
    return windowObj.GENZHistory;
}

function makeItem(overrides = {}) {
    return {
        id: "row-1",
        task_id: "task-1",
        user_id: "user-1",
        status: "success",
        created_at: new Date().toISOString(),
        provider: "opus",
        model_id: "opus-hailuo-3-i2v-30s",
        prompt: " babi hutan mengejar kusing berlari",
        credit_used: 6000,
        result_url: "https://provider.example/hasil.mp4",
        ...overrides
    };
}

/** Urutan class sel pada baris yang benar-benar dirender. */
function renderedCellOrder(App, { showUserColumn }) {
    const html = App.getRowHtml(makeItem(), 0, showUserColumn);
    return [...html.matchAll(/<td class="([^"]+)"/g)].map(match => match[1].trim());
}

/* ---------------------------------------------------------
   1. TIDAK ADA LAGI SELECTOR POSISIONAL
--------------------------------------------------------- */

test("layout History tidak memakai selector td:nth-child() yang rapuh", () => {
    assert.doesNotMatch(
        historyHtml,
        /td:nth-child\(\d+\)/,
        "urutan sel berubah bila kolom User tidak dirender, jadi selector posisional dilarang"
    );
});

test("setiap sel History punya aturan grid berbasis class semantik", () => {
    SEMANTIC_CELLS.forEach(cell => {
        assert.match(
            historyHtml,
            new RegExp(`td\\.${cell}\\b`),
            `sel ${cell} harus diatur lewat class, bukan posisi`
        );
    });
});

/* ---------------------------------------------------------
   2. STATUS TIDAK BERADA DI KOLOM THUMBNAIL
--------------------------------------------------------- */

/**
 * Ambil deklarasi grid-column terakhir untuk selector yang paling
 * spesifik dan hanya menyebut satu sel (bukan grup). Cukup untuk
 * memastikan status tidak lagi berbagi kolom dengan thumbnail.
 */
function gridColumnFor(cell) {
    const pattern = new RegExp(
        `td\\.${cell}\\s*\\{([^}]*)\\}`,
        "g"
    );

    const values = [];

    for (const match of historyHtml.matchAll(pattern)) {
        const decl = /grid-column:\s*([^;]+);/.exec(match[1]);
        if (decl) {
            values.push(decl[1].trim());
        }
    }

    return values;
}

test("sel status tidak pernah dipasang di kolom 1 (kolom thumbnail)", () => {
    const columns = gridColumnFor("history-status-cell");

    assert.ok(columns.length > 0, "sel status harus punya aturan grid-column");

    columns.forEach(value => {
        assert.notEqual(
            value,
            "1",
            "kolom 1 hanya selebar thumbnail (64px) sehingga badge status terpotong"
        );
    });
});

test("sel status dan credit tidak memotong isinya", () => {
    assert.match(
        historyHtml,
        /td\.history-status-cell,\s*\n\s*td\.history-credit-cell\s*\{\s*overflow:\s*visible;/,
        "overflow:hidden pada td memotong badge status"
    );
});

test("badge status boleh menyusut tanpa terpotong", () => {
    assert.match(
        historyHtml,
        /td\.history-status-cell \.status\s*\{\s*max-width:\s*100%;/
    );
});

/* ---------------------------------------------------------
   3. SEL USER TETAP SEMBUNYI DI RIWAYAT PRIBADI
--------------------------------------------------------- */

test("sel User disembunyikan lewat class baris, bukan posisi kolom", () => {
    assert.match(
        historyHtml,
        /tbody tr:not\(\.history-row-global\) td\.history-user-cell\s*\{\s*display:\s*none;/
    );
});

test("riwayat pribadi tidak merender sel User sehingga provider tetap terlihat", () => {
    const App = loadRenderModule();
    const order = renderedCellOrder(App, { showUserColumn: false });

    assert.deepEqual(order, [
        "history-thumbnail-cell",
        "history-date-cell",
        "history-provider-cell",
        "history-model-cell",
        "history-prompt-cell",
        "history-credit-cell",
        "history-status-cell",
        "history-action-cell"
    ]);

    assert.equal(
        order.includes("history-user-cell"),
        false,
        "sel User tidak dirender pada riwayat pribadi"
    );
    assert.equal(order[2], "history-provider-cell", "provider bukan lagi sel ke-3 yang disembunyikan");
});

test("riwayat global merender sel User di posisi ke-3", () => {
    const App = loadRenderModule();
    const order = renderedCellOrder(App, { showUserColumn: true });

    assert.deepEqual(order, [
        "history-thumbnail-cell",
        "history-date-cell",
        "history-user-cell",
        "history-provider-cell",
        "history-model-cell",
        "history-prompt-cell",
        "history-credit-cell",
        "history-status-cell",
        "history-action-cell"
    ]);
});

/* ---------------------------------------------------------
   4. LABEL STATUS DI DALAM THUMBNAIL
--------------------------------------------------------- */

test("label thumbnail punya font sendiri, tidak mewarisi 20px", () => {
    assert.match(
        historyHtml,
        /\.thumbnail-empty-label,\s*\n\s*\.thumbnail-failed-label\s*\{/,
        "DIBATALKAN/PENDING/GAGAL perlu aturan font sendiri"
    );

    const block = /\.thumbnail-empty-label,\s*\n\s*\.thumbnail-failed-label\s*\{([^}]*)\}/
        .exec(historyHtml);

    assert.ok(block, "blok label thumbnail ditemukan");
    assert.match(block[1], /font-size:\s*[\d.]+px/);
    assert.match(block[1], /overflow-wrap:\s*anywhere/);

    const size = Number(/font-size:\s*([\d.]+)px/.exec(block[1])[1]);
    assert.ok(
        size > 0 && size <= 9,
        `font label harus kecil agar muat di thumbnail 64px, dapat ${size}px`
    );
});

test("thumbnail kosong menata ikon dan label secara vertikal", () => {
    const block = /\.thumbnail-empty\s*\{([^}]*)\}/.exec(historyHtml);

    assert.ok(block);
    assert.match(block[1], /flex-direction:\s*column/);
});

/* ---------------------------------------------------------
   5. STATUS PANJANG TETAP DIRENDER UTUH
--------------------------------------------------------- */

test("label status panjang tidak dipotong di sumber render", () => {
    const App = loadRenderModule();

    const cancelled = App.getRowHtml(makeItem({ status: "cancelled" }), 0, false);
    assert.match(cancelled, /DIBATALKAN/);

    const processing = App.getRowHtml(makeItem({ status: "processing" }), 0, false);
    assert.match(processing, /class="status processing"/);

    const success = App.getRowHtml(makeItem({ status: "success" }), 0, false);
    assert.match(success, /SUCCESS/);
});
