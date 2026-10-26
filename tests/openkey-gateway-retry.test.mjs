import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

import openKeyClient from "../provider/openkey/client.js";
import {
    cacheVisionModel,
    describeOpenKeyFailure,
    readCachedVisionModel,
    requestOpenKey,
    selectVisionModels
} from "../metadata-cleaner/assets/js/metadata-openkey-detection.js";

/*
 * OPENKEY GATEWAY 502
 * ---------------------------------------------------------
 * Laporan pengguna: halaman Metadata Cleaner menampilkan
 *   OPENKEY AI CHECK TIDAK TERSEDIA
 *   OpenKey request gagal (502).
 *
 * 502/503/504 berasal dari gateway OpenKey (provider di
 * belakangnya sedang sibuk/restart), bukan dari konfigurasi
 * pengguna. Gangguan seperti ini biasanya pulih dalam hitungan
 * detik, jadi:
 *
 *   1. permintaan diulang terbatas (server & browser),
 *   2. pesan ke pengguna menyebut gangguan layanan dengan jujur,
 *   3. hasil metadata lokal tetap ditampilkan (sudah ada),
 *   4. katalog model yang sempat gagal tidak memblokir
 *      pemeriksaan bila model vision terakhir masih tersimpan.
 */

const root = new URL("../", import.meta.url);
const read = relative => fs.readFile(new URL(relative, root), "utf8");

const apiSource = await read("api/openkey-chat.js");
const checkSource = await read("metadata-cleaner/assets/js/metadata-check.js");

function jsonResponse(status, data) {
    return {
        ok: status >= 200 && status < 300,
        status,
        headers: { get: () => "application/json" },
        async json() {
            return data;
        },
        async text() {
            return data === null ? "" : JSON.stringify(data);
        }
    };
}

test("gangguan gateway diulang, bukan langsung menyerah", async () => {
    const originalFetch = globalThis.fetch;
    const calls = [];

    globalThis.fetch = async () => {
        calls.push(1);
        if (calls.length === 1) {
            return jsonResponse(502, null);
        }
        return jsonResponse(200, { data: [{ id: "grok-4.5" }] });
    };

    try {
        const result = await openKeyClient.request("/models", {
            apiKey: "kunci-uji",
            retryDelaysMs: [0, 0]
        });

        assert.equal(calls.length, 2, "502 pertama harus dicoba ulang");
        assert.equal(result.data[0].id, "grok-4.5");
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("gangguan gateway yang berlanjut berhenti setelah dua percobaan ulang", async () => {
    const originalFetch = globalThis.fetch;
    const calls = [];

    globalThis.fetch = async () => {
        calls.push(1);
        return jsonResponse(502, null);
    };

    try {
        await assert.rejects(
            openKeyClient.request("/models", {
                apiKey: "kunci-uji",
                retryDelaysMs: [0, 0]
            }),
            error => {
                assert.equal(error.status, 502);
                assert.equal(error.retryable, true);
                assert.match(
                    error.message,
                    /Layanan OpenKey sedang gangguan \(HTTP 502 Bad Gateway\)/,
                    "pesan harus jujur menyebut gangguan layanan, bukan sekadar kode"
                );
                return true;
            }
        );

        assert.equal(calls.length, 3, "1 percobaan awal + 2 percobaan ulang");
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("kesalahan konfigurasi tidak diulang", async () => {
    const originalFetch = globalThis.fetch;
    const calls = [];

    globalThis.fetch = async () => {
        calls.push(1);
        return jsonResponse(400, { message: "Model tidak dikenal." });
    };

    try {
        await assert.rejects(
            openKeyClient.request("/chat/completions", {
                method: "POST",
                apiKey: "kunci-uji",
                body: { model: "tidak-ada" },
                retryDelaysMs: [0, 0]
            }),
            error => {
                assert.equal(error.status, 400);
                assert.equal(error.message, "Model tidak dikenal.");
                assert.equal(error.retryable, false);
                return true;
            }
        );

        assert.equal(calls.length, 1, "400 bukan gangguan sesaat, jangan diulang");
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("retry bisa dimatikan lewat retryDelaysMs kosong", async () => {
    const originalFetch = globalThis.fetch;
    const calls = [];

    globalThis.fetch = async () => {
        calls.push(1);
        return jsonResponse(503, null);
    };

    try {
        await assert.rejects(
            openKeyClient.request("/models", {
                apiKey: "kunci-uji",
                retryDelaysMs: []
            })
        );
        assert.equal(calls.length, 1);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("API meneruskan sifat retryable ke halaman", () => {
    assert.match(apiSource, /retryable:\s*\n\s*error\.retryable === true/);
    const occurrences = apiSource.match(/retryable:\s*\n\s*error\.retryable === true/g) || [];
    assert.ok(
        occurrences.length >= 2,
        "katalog model dan chat completion sama-sama harus melaporkan retryable"
    );
});

test("halaman mengulang sekali gangguan gateway sebelum melapor", async () => {
    const originalFetch = globalThis.fetch;
    const calls = [];

    globalThis.fetch = async () => {
        calls.push(1);
        if (calls.length === 1) {
            return jsonResponse(502, null);
        }
        return jsonResponse(200, { success: true, models: [] });
    };

    try {
        const result = await requestOpenKey({ operation: "openkey_models" }, "token-uji");
        assert.equal(calls.length, 2);
        assert.equal(result.success, true);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("gangguan gateway berulang menghasilkan pesan yang bisa ditindaklanjuti", async () => {
    const originalFetch = globalThis.fetch;
    const calls = [];

    globalThis.fetch = async () => {
        calls.push(1);
        return jsonResponse(502, null);
    };

    try {
        await assert.rejects(
            requestOpenKey({ operation: "openkey_models" }, "token-uji"),
            error => {
                assert.equal(error.status, 502);
                assert.equal(error.retryable, true);
                return true;
            }
        );
        assert.equal(calls.length, 2, "browser mencoba ulang satu kali");
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("pesan error membedakan gangguan layanan dari kesalahan kredensial", () => {
    assert.match(
        describeOpenKeyFailure({ status: 502, message: "OpenKey request gagal (502)." }),
        /sedang gangguan \(HTTP 502\).*Metadata lokal/i
    );
    assert.match(describeOpenKeyFailure({ status: 503 }), /gangguan \(HTTP 503\)/);
    assert.match(describeOpenKeyFailure({ status: 504 }), /gangguan \(HTTP 504\)/);
    assert.match(describeOpenKeyFailure({ status: 429 }), /membatasi jumlah permintaan/);
    assert.match(describeOpenKeyFailure({ status: 401 }), /menolak kredensial/);
    assert.match(
        describeOpenKeyFailure({ code: "OPENKEY_TIMEOUT" }),
        /melewati batas waktu/
    );
    assert.equal(
        describeOpenKeyFailure(new Error("OpenKey tidak menyediakan model dengan dukungan input gambar.")),
        "OpenKey tidak menyediakan model dengan dukungan input gambar."
    );
});

test("halaman memakai pesan OpenKey yang sudah diterjemahkan", () => {
    assert.match(checkSource, /describeOpenKeyFailure/);
    assert.match(
        checkSource,
        /status: "error",\s*\n\s*message: describeOpenKeyFailure\(error\)/,
        "blok TIDAK TERSEDIA harus menampilkan pesan yang bisa ditindaklanjuti"
    );
});

test("katalog model yang gagal memakai model vision terakhir yang tersimpan", async () => {
    const store = new Map();
    const previousWindow = globalThis.window;

    globalThis.window = {
        localStorage: {
            getItem: key => (store.has(key) ? store.get(key) : null),
            setItem: (key, value) => store.set(key, value),
            removeItem: key => store.delete(key)
        }
    };

    try {
        assert.equal(readCachedVisionModel(), "", "cache kosong di awal");

        cacheVisionModel("qwen3-vl-max");
        assert.equal(readCachedVisionModel(), "qwen3-vl-max");

        /* Cache kedaluwarsa setelah 7 hari. */
        store.set(
            "genz-openkey-vision-model",
            JSON.stringify({
                modelId: "qwen3-vl-max",
                savedAt: Date.now() - 8 * 24 * 60 * 60 * 1000
            })
        );
        assert.equal(readCachedVisionModel(), "");
    } finally {
        globalThis.window = previousWindow;
    }
});

test("cache model hanya dipakai sebagai cadangan, bukan pengganti katalog", async () => {
    const source = await read("metadata-cleaner/assets/js/metadata-openkey-detection.js");
    const body = source.slice(
        source.indexOf("export async function detectOpenKeyMedia("),
        source.indexOf("export function renderOpenKeyResult(")
    );

    assert.match(body, /cacheVisionModel\(modelIds\[0\]\)/, "model utama disimpan untuk cadangan");
    assert.match(body, /cacheVisionModel\(candidate\)/, "model yang benar-benar berhasil disimpan");
    assert.match(
        body,
        /error\?\.retryable === true[\s\S]{0,80}readCachedVisionModel\(\)/,
        "cadangan hanya dipakai untuk gangguan sesaat"
    );
    assert.match(
        body,
        /if \(!cachedModelId\) \{[\s\S]{0,40}throw error;/,
        "tanpa cadangan, error asli dilaporkan"
    );
});


test("kandidat model vision dibatasi dan menghormati dukungan gambar", () => {
    const models = [
        { id: "teks-saja", input_modalities: ["text"] },
        { id: "grok-4.5" },
        { id: "qwen3-vl-max", input_modalities: ["text", "image"] },
        { id: "model-lain", capabilities: { vision: true } }
    ];

    const candidates = selectVisionModels(models, 2);
    assert.deepEqual(
        candidates.map(model => model.id),
        ["grok-4.5", "qwen3-vl-max"],
        "urutan katalog dipertahankan dan model teks-saja dilewati"
    );

    assert.equal(selectVisionModels(models, 1).length, 1);
    assert.deepEqual(selectVisionModels(null), []);
});
