import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

import {
    detectAIIndicators,
    detectAigcMarkers,
    hasAigcMarking
} from "../metadata-cleaner/assets/js/metadata-detector.js";

import {
    isBlankFrame
} from "../metadata-cleaner/assets/js/metadata-openkey-detection.js";

/*
 * PENANDAAN AIGC DI METADATA VIDEO
 * ---------------------------------------------------------
 * Laporan pengguna (video 20 detik dari pipeline AIGC):
 *
 *   tags.aigc_info  {"aigc_label_type":0,"source_info":""}
 *   tags.wxMeta     {"WXVer":671108930}
 *
 * File JELAS berisi penanda AI, tetapi halaman Metadata
 * Cleaner hanya berkata "OPENKEY BELUM DAPAT MENYIMPULKAN"
 * dan tidak pernah menandai AI DETECTED.
 *
 * Dua bug yang dijaga tes ini:
 *
 *   1. Detektor metadata tidak mengenali kotak `aigc_info`,
 *      sehingga `metadataDetected` selalu false.
 *   2. Frame video ke-2 tertangkap putih polos dan tetap
 *      dikirim ke model visual sebagai "bukti".
 *
 * Aturan yang harus tetap berlaku:
 *   - Penandaan AIGC = indikator AI (kategori `aigc`).
 *   - Hasil visual "belum konklusif" TIDAK membatalkan
 *     temuan metadata.
 *   - Frame kosong tidak pernah dikirim sebagai bukti.
 *   - Tetap jujur: ini bukti metadata, bukan forensik.
 */

const root = new URL("../", import.meta.url);
const read = relative => fs.readFile(new URL(relative, root), "utf8");

const detectorSource = await read("metadata-cleaner/assets/js/metadata-detector.js");
const openKeySource = await read("metadata-cleaner/assets/js/metadata-openkey-detection.js");
const statusSource = await read("metadata-cleaner/assets/js/metadata-status.js");
const cleanerVideoSource = await read("metadata-cleaner/assets/js/metadata-cleaner-video.js");
const cleanerHtml = await read("metadata-cleaner/index.html");
const cleanerSource = await read("metadata-cleaner/assets/js/metadata-clean.js");
const appSource = await read("metadata-cleaner/assets/js/metadata-app.js");
const checkSource = await read("metadata-cleaner/assets/js/metadata-check.js");
const cleanSource = cleanerSource;
const resetSource = await read("metadata-cleaner/assets/js/metadata-reset.js");
const fileSource = await read("metadata-cleaner/assets/js/metadata-file.js");

/* Contoh metadata nyata dari laporan pengguna. */
const AIGC_ITEM = {
    field: "FFprobe Format.tags.aigc_info",
    value: '{"aigc_label_type":0,"source_info":""}',
    source: "FFprobe Format"
};

const WXMETA_ITEM = {
    field: "FFprobe Format.tags.wxMeta",
    value: '{"WXVer":671108930}',
    source: "FFprobe Format"
};

const CLEAN_ITEMS = [
    { field: "tags.encoder", value: "Lavf58.20.100", source: "FFprobe Format" },
    { field: "Duration", value: "20.085 s", source: "Metadata" },
    { field: "Filename", value: "input", source: "Container" },
    { field: "tags.handler_name", value: "VideoHandler", source: "FFprobe Format" }
];

/* ---------------------------------------------------------
   HARNESS STATUS MODULE (state & DOM di-stub)
--------------------------------------------------------- */

function createNode() {
    return {
        className: "",
        textContent: "",
        attributes: {},
        children: [],
        style: {},
        classList: {
            remove() {},
            add() {},
            toggle() {}
        },
        setAttribute(name, value) {
            this.attributes[name] = value;
        },
        getAttribute(name) {
            return this.attributes[name] ?? null;
        },
        appendChild(child) {
            this.children.push(child);
            return child;
        },
        append(...nodes) {
            this.children.push(...nodes);
        },
        insertBefore(node) {
            this.children.unshift(node);
            return node;
        },
        replaceChildren(...nodes) {
            this.children = [...nodes];
        },
        remove() {},
        querySelector() {
            return this.children[0] || null;
        }
    };
}

globalThis.__aigcState = {};
globalThis.__aigcElements = {
    statusTitle: { textContent: "" },
    statusDescription: { textContent: "" },
    statusIndicator: { classList: { remove() {}, add() {} } },
    aiOverlay: null
};

const stateUrl =
    `data:text/javascript,${encodeURIComponent("export const state = globalThis.__aigcState;")}`;
const domUrl =
    `data:text/javascript,${encodeURIComponent("export const elements = globalThis.__aigcElements;")}`;

const statusModule = await import(
    `data:text/javascript,${encodeURIComponent(
        statusSource
            .replace(/from "\.\/metadata-state\.js"/g, `from "${stateUrl}"`)
            .replace(/from "\.\/metadata-dom\.js"/g, `from "${domUrl}"`)
    )}`
);

function setStatusState(overrides) {
    for (const key of Object.keys(globalThis.__aigcState)) {
        delete globalThis.__aigcState[key];
    }

    Object.assign(globalThis.__aigcState, {
        aiIndicators: [],
        provenance: null,
        sightengineDetection: {},
        sightengineChecked: false,
        sightengineError: null,
        openkeyDetection: null
    }, overrides);

    globalThis.__aigcElements.statusTitle.textContent = "";
    globalThis.__aigcElements.statusDescription.textContent = "";
}

const aigcUncertainOpenKey = {
    status: "complete",
    verdict: "uncertain",
    confidence: 50,
    summary: "Frame 2 adalah gambar putih polos tanpa konten visual.",
    model: "grok-4.5",
    frameCount: 3
};

/* ---------------------------------------------------------
   DETEKTOR METADATA
--------------------------------------------------------- */

test("kotak penanda AIGC dikenali sebagai indikator AI", () => {
    const indicators = detectAIIndicators([AIGC_ITEM]);

    assert.equal(indicators.length, 1, "aigc_info harus menghasilkan tepat satu indikator");
    assert.equal(indicators[0].category, "aigc");
    assert.equal(indicators[0].field, AIGC_ITEM.field);
    assert.match(indicators[0].keyword, /aigc/);
});

test("penanda AIGC dikenali walau nilainya kosong", () => {
    const markers = detectAigcMarkers({
        field: "tags.aigc_info",
        value: "{}",
        source: "FFprobe"
    });

    assert.equal(markers.length, 1, "nama field saja sudah cukup menjadi penanda");
});

test("kunci skema AIGC di dalam nilai JSON juga dikenali", () => {
    const markers = detectAigcMarkers({
        field: "Custom.Data",
        value: '{"content_producer":"abc","produce_id":"123"}',
        source: "Custom"
    });

    assert.equal(markers.length, 1);
    assert.match(markers[0].evidence, /content_producer/);
});

test("metadata biasa tidak dianggap penandaan AIGC", () => {
    assert.deepEqual(detectAIIndicators(CLEAN_ITEMS), []);
    assert.equal(hasAigcMarking(CLEAN_ITEMS), false);
    assert.equal(hasAigcMarking([AIGC_ITEM]), true);
    assert.equal(hasAigcMarking(null), false);
});

test("wxMeta tanpa kunci AIGC tidak dihitung sebagai AI", () => {
    assert.deepEqual(detectAIIndicators([WXMETA_ITEM]), []);
});

test("detektor AIGC tersedia di modul detektor", () => {
    assert.match(detectorSource, /export function detectAigcMarkers\(/);
    assert.match(detectorSource, /export function hasAigcMarking\(/);
    assert.match(detectorSource, /category:\s*\n\s*"aigc"/);
});

/* ---------------------------------------------------------
   STATUS HALAMAN
--------------------------------------------------------- */

test("AIGC + visual belum konklusif tetap AI DETECTED", () => {
    setStatusState({
        aiIndicators: detectAIIndicators([AIGC_ITEM, WXMETA_ITEM]),
        openkeyDetection: aigcUncertainOpenKey
    });

    statusModule.renderDetectionResult();

    assert.equal(
        globalThis.__aigcElements.statusTitle.textContent,
        "AI DETECTION",
        "penandaan AIGC harus menghasilkan AI DETECTION, bukan 'belum dapat menyimpulkan'"
    );

    const description = globalThis.__aigcElements.statusDescription.textContent;
    assert.match(description, /penandaan AIGC/i);
    assert.match(description, /aigc_info/, "field penandanya disebut supaya bisa diperiksa");
    assert.match(description, /belum dapat menyimpulkan/i);
    assert.match(description, /tidak menghapus temuan metadata/i);
    assert.match(description, /bukan hasil analisis piksel/i, "harus jujur soal sumber bukti");
});

test("stamp overlay menampilkan AI DETECTED untuk penandaan AIGC", () => {
    const overlay = createNode();
    overlay.hidden = true;
    const previousOverlay = globalThis.__aigcElements.aiOverlay;
    const previousDocument = globalThis.document;

    globalThis.__aigcElements.aiOverlay = overlay;
    globalThis.document = { createElement: () => createNode() };

    try {
        setStatusState({
            aiIndicators: detectAIIndicators([AIGC_ITEM]),
            openkeyDetection: aigcUncertainOpenKey
        });

        statusModule.renderDetectionResult();

        assert.equal(overlay.hidden, false);
        const stamp = overlay.children[0];
        assert.ok(stamp, "stamp AI detection harus dibuat");
        assert.equal(
            stamp.children[0].textContent,
            "AI DETECTED",
            "label stamp harus AI DETECTED"
        );
    } finally {
        globalThis.__aigcElements.aiOverlay = previousOverlay;
        globalThis.document = previousDocument;
    }
});

test("visual 'tidak ada indikasi' tidak menghapus temuan AIGC", () => {
    setStatusState({
        aiIndicators: detectAIIndicators([AIGC_ITEM]),
        openkeyDetection: {
            status: "complete",
            verdict: "likely_not_ai",
            confidence: 70,
            summary: "Tidak terlihat artefak.",
            model: "grok-4.5",
            frameCount: 3
        }
    });

    statusModule.renderDetectionResult();

    assert.equal(globalThis.__aigcElements.statusTitle.textContent, "AI DETECTION");
    assert.match(
        globalThis.__aigcElements.statusDescription.textContent,
        /penandaan AIGC/i
    );
});

test("penandaan AIGC tanpa pemeriksaan visual tetap AI DETECTED", () => {
    setStatusState({
        aiIndicators: detectAIIndicators([AIGC_ITEM, WXMETA_ITEM]),
        openkeyDetection: null
    });

    statusModule.renderDetectionResult();

    assert.equal(globalThis.__aigcElements.statusTitle.textContent, "AI DETECTION");
    const description = globalThis.__aigcElements.statusDescription.textContent;
    assert.match(description, /penandaan AIGC/i);
    assert.match(description, /aigc_info/);
});

test("pemeriksaan visual yang gagal tidak menghapus temuan AIGC", () => {
    setStatusState({
        aiIndicators: detectAIIndicators([AIGC_ITEM]),
        openkeyDetection: {
            status: "error",
            error: "Layanan OpenKey sedang gangguan (HTTP 502 Bad Gateway).",
            model: null,
            frameCount: 0
        }
    });

    statusModule.renderDetectionResult();

    assert.equal(globalThis.__aigcElements.statusTitle.textContent, "AI DETECTION");
    assert.match(
        globalThis.__aigcElements.statusDescription.textContent,
        /penandaan AIGC/i
    );
});

test("tanpa penandaan AIGC, visual belum konklusif tetap dilaporkan apa adanya", () => {
    setStatusState({
        aiIndicators: detectAIIndicators(CLEAN_ITEMS),
        openkeyDetection: aigcUncertainOpenKey
    });

    statusModule.renderDetectionResult();

    assert.equal(
        globalThis.__aigcElements.statusTitle.textContent,
        "OPENKEY BELUM DAPAT MENYIMPULKAN",
        "tanpa bukti metadata, status harus tetap jujur belum konklusif"
    );
});

/* ---------------------------------------------------------
   PANEL OPENKEY
--------------------------------------------------------- */

test("panel OpenKey menyebut penandaan AIGC saat visual belum konklusif", () => {
    const container = createNode();
    const previousDocument = globalThis.document;
    globalThis.document = {
        getElementById: () => container,
        createElement: () => createNode()
    };

    try {
        openKeyRender(
            {
                ...aigcUncertainOpenKey,
                skippedFrames: [10.04]
            },
            detectAIIndicators([AIGC_ITEM]),
            null
        );

        assert.equal(container.children[0].textContent, "HASIL VISUAL BELUM KONKLUSIF");
        assert.match(
            container.children[1].textContent,
            /penandaan AIGC \(tags\.aigc_info\)/i,
            "ringkasan harus menyebut penanda metadata"
        );
        assert.match(
            container.children[1].textContent,
            /tidak dibatalkan|cukup/i
        );
        assert.match(
            container.children[2].textContent,
            /Penandaan AIGC: tags\.aigc_info/,
            "detail harus mencantumkan field penandanya"
        );
        assert.match(
            container.children[2].textContent,
            /1 frame kosong dilewati/,
            "frame yang dilewati harus disebut jujur"
        );
    } finally {
        globalThis.document = previousDocument;
    }
});

/* renderOpenKeyResult dipakai tanpa import ulang supaya modul tetap satu instance. */
const openKeyModule = await import(
    "../metadata-cleaner/assets/js/metadata-openkey-detection.js"
);

function openKeyRender(result, indicators, provenance) {
    return openKeyModule.renderOpenKeyResult(result, indicators, provenance);
}

/* ---------------------------------------------------------
   FRAME VIDEO KOSONG
--------------------------------------------------------- */

function fakeFrameContext(pixels) {
    return {
        getImageData() {
            return { data: pixels };
        }
    };
}

function rgba(luminance, count) {
    const data = new Uint8ClampedArray(count * 4);
    for (let index = 0; index < count; index += 1) {
        data[index * 4] = luminance;
        data[index * 4 + 1] = luminance;
        data[index * 4 + 2] = luminance;
        data[index * 4 + 3] = 255;
    }
    return data;
}

test("frame putih atau hitam polos terdeteksi kosong", () => {
    assert.equal(isBlankFrame(fakeFrameContext(rgba(255, 64)), 8, 8), true);
    assert.equal(isBlankFrame(fakeFrameContext(rgba(0, 64)), 8, 8), true);
});

test("frame dengan konten visual tidak dianggap kosong", () => {
    const data = new Uint8ClampedArray(64 * 4);
    for (let index = 0; index < 64; index += 1) {
        const value = index % 2 === 0 ? 20 : 230;
        data[index * 4] = value;
        data[index * 4 + 1] = value;
        data[index * 4 + 2] = value;
        data[index * 4 + 3] = 255;
    }

    assert.equal(isBlankFrame(fakeFrameContext(data), 8, 8), false);
});

test("frame yang tidak bisa dibaca tidak pernah dianggap kosong", () => {
    const context = {
        getImageData() {
            throw new Error("SecurityError");
        }
    };

    assert.equal(isBlankFrame(context, 8, 8), false, "gagal baca bukan alasan membuang frame");
});

test("pengambilan frame memakai banyak titik dan melewati frame kosong", () => {
    assert.match(openKeySource, /VIDEO_FRAME_CANDIDATES/);
    assert.match(openKeySource, /\[0\.08, 0\.22, 0\.36, 0\.5, 0\.64, 0\.78, 0\.92\]/);
    assert.match(openKeySource, /isBlankFrame\(/, "setiap frame harus diperiksa dulu");
    assert.match(openKeySource, /skipped\.push\(/);
    assert.match(openKeySource, /frames\.skippedTimestamps/);
    assert.match(
        openKeySource,
        /requestVideoFrameCallback/,
        "harus menunggu frame benar-benar dipresentasikan"
    );
});

test("semua frame kosong dilaporkan, bukan dikirim sebagai bukti", () => {
    assert.match(
        openKeySource,
        /Semua frame yang diambil kosong/,
        "harus ada pesan jujur saat tidak ada bukti visual"
    );
});

test("instruksi ke model menolak 'tanpa artefak' sebagai bukti bukan AI", () => {
    assert.match(
        openKeySource,
        /tidak adanya artefak visual BUKAN bukti bahwa media bukan hasil AI/,
        "prompt harus melarang menyimpulkan bukan AI hanya dari ketiadaan artefak"
    );
    assert.match(openKeySource, /penandaan AIGC \(AI-Generated Content\)/);
    assert.match(
        openKeySource,
        /content: "Anda adalah pemeriksa indikasi media generatif[\s\S]{0,400}AIGC/
    );
});

/* ---------------------------------------------------------
   CLEANING & CACHE
--------------------------------------------------------- */

test("residu setelah CLEAN ikut memakai deteksi AIGC", () => {
    assert.match(
        cleanerVideoSource,
        /detectAIIndicators\(\[item\]\)\.length > 0/,
        "penanda AIGC yang tersisa harus terhitung residu"
    );

    /* Dan memang terhitung, bukan hanya dipanggil. */
    assert.ok(detectAIIndicators([AIGC_ITEM]).length > 0);
});

test("semua impor modul yang berubah memakai cache-buster", () => {
    /*
       metadata-status.js tidak diimpor dengan query sebelumnya,
       sehingga perbaikan AIGC bisa tertahan di cache browser HP
       pengguna. Setiap modul yang berubah harus diimpor dengan
       versi, dan versinya harus sama di semua tempat supaya
       modul tidak termuat dua kali (state ikut terduplikasi).
    */
    const changedModules = [
        "metadata-status.js",
        "metadata-detector.js",
        "metadata-cleaner-video.js",
        "metadata-openkey-detection.js"
    ];

    const versions = new Map();

    for (const source of [appSource, checkSource, cleanSource, resetSource, fileSource]) {
        for (const moduleName of changedModules) {
            const pattern = new RegExp(
                `from "\\./${moduleName.replace(".", "\\.")}(\\?v=([^"]+))?";`,
                "g"
            );

            for (const match of source.matchAll(pattern)) {
                assert.ok(
                    match[1],
                    `impor ${moduleName} harus memakai ?v= agar tidak tersaji dari cache lama`
                );

                const known = versions.get(moduleName);
                if (known === undefined) {
                    versions.set(moduleName, match[2]);
                } else {
                    assert.equal(
                        match[2],
                        known,
                        `versi impor ${moduleName} harus sama di semua modul`
                    );
                }
            }
        }
    }

    for (const moduleName of changedModules) {
        assert.ok(versions.has(moduleName), `${moduleName} harus tetap diimpor`);
    }

    const appVersion = cleanerHtml.match(/metadata-app\.js\?v=([^"]+)"/);
    assert.ok(appVersion, "halaman harus memuat metadata-app.js dengan versi");
    assert.equal(
        appVersion[1],
        versions.get("metadata-openkey-detection.js"),
        "entry dan modul harus memakai versi rilis yang sama"
    );
});

test("pesan residu membedakan penandaan AIGC dari residu provenance biasa", () => {
    assert.match(
        cleanerVideoSource,
        /penandaan AIGC masih terbaca \(/,
        "residu AIGC harus disebut sebagai penandaan AIGC"
    );
    assert.match(
        cleanerSource,
        /const residualHasAigc =\s*\n\s*\/aigc\/i\.test\(/,
        "status cleaning harus tahu residunya AIGC"
    );
    assert.match(
        cleanerSource,
        /CLEANING SELESAI — PENANDAAN AI MASIH TERBACA/
    );
    assert.match(
        cleanerSource,
        /belum bisa disebut bebas penandaan AI maupun C2PA/
    );
});
