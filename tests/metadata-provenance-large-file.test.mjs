import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

/*
 * metadata-provenance.js menempelkan API ke `window`, jadi global ini harus
 * ada sebelum modul diimpor di Node.
 */
globalThis.window = globalThis.window || {};

const { inspectProvenance } = await import(
    "../metadata-cleaner/assets/js/metadata-provenance.js"
);

const cleanSource = await fs.readFile(
    new URL("../metadata-cleaner/assets/js/metadata-clean.js", import.meta.url),
    "utf8"
);
const stateSource = await fs.readFile(
    new URL("../metadata-cleaner/assets/js/metadata-state.js", import.meta.url),
    "utf8"
);
const statusSource = await fs.readFile(
    new URL("../metadata-cleaner/assets/js/metadata-status.js", import.meta.url),
    "utf8"
);
const videoSource = await fs.readFile(
    new URL("../metadata-cleaner/assets/js/metadata-cleaner-video.js", import.meta.url),
    "utf8"
);
const provenanceSource = await fs.readFile(
    new URL("../metadata-cleaner/assets/js/metadata-provenance.js", import.meta.url),
    "utf8"
);

const MB = 1024 * 1024;
const INSPECT_LIMIT = 50 * MB;

function bytesOf(size, fill = 0) {
    const bytes = new Uint8Array(size);
    if (fill) bytes.fill(fill);
    return bytes;
}

function asciiInto(target, offset, text) {
    for (let index = 0; index < text.length; index += 1) {
        target[offset + index] = text.charCodeAt(index);
    }
    return target;
}

function asciiBytes(text) {
    const bytes = new Uint8Array(text.length);
    return asciiInto(bytes, 0, text);
}

function concatBytes(parts) {
    const total = parts.reduce((sum, part) => sum + part.length, 0);
    const out = new Uint8Array(total);
    let cursor = 0;
    for (const part of parts) {
        out.set(part, cursor);
        cursor += part.length;
    }
    return out;
}

function u32(value) {
    return new Uint8Array([
        (value >>> 24) & 0xff,
        (value >>> 16) & 0xff,
        (value >>> 8) & 0xff,
        value & 0xff
    ]);
}

function boxBytes(type, payload = new Uint8Array(0)) {
    return concatBytes([u32(8 + payload.length), asciiBytes(type), payload]);
}

/**
 * File tiruan untuk berkas besar.
 *
 * Isi berkas TIDAK dialokasikan seluruhnya: setiap `slice()` hanya
 * menghasilkan potongan yang diminta, persis seperti Blob asli. Dengan
 * begitu tes bisa memakai berkas 81 MB tanpa memakan ratusan MB memori.
 */
function syntheticFile({ size, name = "klip.mp4", type = "video/mp4", marks = [] }) {
    const render = (start, end) => {
        const bytes = bytesOf(Math.max(0, end - start));
        for (const mark of marks) {
            const markStart = mark.offset;
            const markEnd = markStart + mark.bytes.length;
            const from = Math.max(start, markStart);
            const to = Math.min(end, markEnd);
            if (to <= from) continue;
            bytes.set(
                mark.bytes.subarray(from - markStart, to - markStart),
                from - start
            );
        }
        return bytes;
    };

    return {
        name,
        type,
        size,
        async arrayBuffer() {
            const bytes = render(0, size);
            return bytes.buffer;
        },
        slice(start, end) {
            const from = Math.max(0, Math.min(start, size));
            const to = Math.max(from, Math.min(end, size));
            return {
                async arrayBuffer() {
                    const bytes = render(from, to);
                    return bytes.buffer;
                }
            };
        }
    };
}

/* Layout MP4: ftyp, mdat, lalu kotak uuid berisi C2PA di tengah berkas. */
function buildLargeMp4Layout(size, uuidOffset) {
    const ftyp = boxBytes("ftyp", asciiBytes("isom\0\0\0\0isommp41"));
    const c2paUuid = new Uint8Array([
        0x63, 0x32, 0x70, 0x61, 0x00, 0x11, 0x00, 0x10,
        0x80, 0x00, 0x00, 0xaa, 0x00, 0x38, 0x9b, 0x71
    ]);

    const uuidPayload = concatBytes([
        c2paUuid,
        asciiBytes("c2pa manifest store dari generator AI"),
        bytesOf(64)
    ]);
    const uuidBox = boxBytes("uuid", uuidPayload);

    const firstMdatSize = uuidOffset - ftyp.length;
    const secondMdatOffset = uuidOffset + uuidBox.length;
    const secondMdatSize = size - secondMdatOffset;

    const marks = [
        { offset: 0, bytes: ftyp },
        {
            offset: ftyp.length,
            bytes: concatBytes([u32(firstMdatSize), asciiBytes("mdat")])
        },
        { offset: uuidOffset, bytes: uuidBox },
        {
            offset: secondMdatOffset,
            bytes: concatBytes([u32(secondMdatSize), asciiBytes("mdat")])
        }
    ];

    return marks;
}

/* ------------------------------------------------------------------ */

test("berkas kecil dipindai penuh dan label terdeteksi", async () => {
    const bytes = bytesOf(2048);
    asciiInto(bytes, 16, "c2pa urn:uuid:1234");

    const file = {
        name: "kecil.jpg",
        type: "image/jpeg",
        size: bytes.length,
        async arrayBuffer() {
            return bytes.buffer.slice(0);
        },
        slice(start, end) {
            const part = bytes.subarray(start, end);
            return {
                async arrayBuffer() {
                    return part.buffer.slice(part.byteOffset, part.byteOffset + part.byteLength);
                }
            };
        }
    };

    const result = await inspectProvenance(file);

    assert.equal(result.checked, true);
    assert.equal(result.detected, true);
    assert.ok(!result.partial, "berkas kecil tidak boleh ditandai parsial");
    assert.match(result.status, /DETECTED/);
});

test("berkas 81 MB dipindai SELURUHNYA, bukan hanya kepala dan ekor", async () => {
    const size = 81 * MB;
    /* Kotak C2PA ditaruh di 40 MB — di luar jendela kepala/ekor yang lama. */
    const uuidOffset = 40 * MB;

    const file = syntheticFile({
        size,
        marks: buildLargeMp4Layout(size, uuidOffset)
    });

    const result = await inspectProvenance(file);

    assert.equal(result.checked, true);
    assert.equal(result.detected, true, "label di tengah berkas harus ditemukan");
    assert.ok(
        !result.partial,
        "pemindaian penuh tidak boleh lagi dilaporkan sebagai sebagian"
    );
    assert.equal(result.status, "DETECTED");
    assert.equal(result.fileSize, size);

    const coverage = result.coverage;
    assert.ok(coverage, "cakupan pemindaian harus dilaporkan");
    assert.equal(coverage.complete, true);
    assert.ok(
        coverage.mediaSkippedBytes > 70 * MB,
        "isi video (mdat) dilewati, bukan dibaca"
    );
    assert.ok(
        coverage.scannedBytes < 8 * MB,
        `hanya container metadata yang dibaca (${coverage.scannedBytes} byte)`
    );
    assert.ok(result.findings.some(item => /c2pa/i.test(item)));
    assert.ok(!result.note, "tidak boleh ada peringatan 'hanya sebagian'");
});

test("berkas besar tanpa provenance: tidak ditemukan, tanpa peringatan menakutkan", async () => {
    const size = 81 * MB;

    const marks = [
        { offset: 0, bytes: boxBytes("ftyp", asciiBytes("isom\0\0\0\0isommp41")) }
    ];

    /* Satu mdat yang menutupi sisa berkas. */
    const ftypLength = 8 + 16;
    marks.push({ offset: ftypLength, bytes: concatBytes([u32(size - ftypLength), asciiBytes("mdat")]) });

    const file = syntheticFile({ size, marks });
    const result = await inspectProvenance(file);

    assert.equal(result.detected, false);
    assert.equal(result.status, "NOT_DETECTED");
    assert.ok(!result.partial);
    assert.ok(!result.note, "pemindaian penuh tidak perlu catatan batas");
});

test("kotak C2PA di akhir berkas besar tetap terdeteksi", async () => {
    const size = 81 * MB;
    const uuidOffset = size - 512;

    const file = syntheticFile({
        size,
        marks: buildLargeMp4Layout(size, uuidOffset)
    });

    const result = await inspectProvenance(file);

    assert.equal(result.detected, true);
    assert.ok(!result.partial);
    assert.equal(result.coverage.complete, true);
});

test("pemindaian penuh membaca potongan demi potongan, bukan seluruh berkas sekaligus", async () => {
    const size = 81 * MB;
    let largestSlice = 0;
    let sliceCalls = 0;
    let arrayBufferCalls = 0;

    const file = syntheticFile({
        size,
        marks: buildLargeMp4Layout(size, 40 * MB)
    });

    const originalSlice = file.slice;
    const originalArrayBuffer = file.arrayBuffer;

    file.slice = (start, end) => {
        sliceCalls += 1;
        largestSlice = Math.max(largestSlice, end - start);
        return originalSlice(start, end);
    };

    file.arrayBuffer = () => {
        arrayBufferCalls += 1;
        return originalArrayBuffer();
    };

    await inspectProvenance(file);

    assert.equal(
        arrayBufferCalls,
        0,
        "berkas 81 MB tidak boleh dibaca utuh ke memori"
    );
    assert.ok(sliceCalls > 0, "pembacaan harus lewat slice()");
    assert.ok(
        largestSlice <= 4 * MB + 64,
        `potongan maksimum harus kecil (${largestSlice} byte)`
    );
});

test("berkas besar non-MP4 (JPEG) juga dipindai sampai habis", async () => {
    const size = 60 * MB;
    const marks = [];

    /* SOI JPEG di awal. */
    marks.push({ offset: 0, bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]) });

    /* Label C2PA jauh di tengah. */
    marks.push({ offset: 30 * MB, bytes: asciiBytes("c2pa manifest jumbf") });

    const file = syntheticFile({
        size,
        name: "besar.jpg",
        type: "image/jpeg",
        marks
    });

    const result = await inspectProvenance(file);

    assert.equal(result.detected, true, "label di tengah berkas JPEG harus ditemukan");
    assert.ok(!result.partial);
    assert.equal(result.coverage.complete, true);
});

test("pemindaian panjang tidak lagi memakai jendela 12 MB", () => {
    assert.match(provenanceSource, /SCAN_CHUNK_BYTES/);
    assert.match(provenanceSource, /async function scanWholeFile/);
    assert.match(provenanceSource, /async function scanIsoBmffFile/);
    assert.match(provenanceSource, /tally\.mediaSkippedBytes/);
    assert.doesNotMatch(
        provenanceSource,
        /melebihi batas pemindaian penuh/,
        "pesan lama tidak boleh dipakai lagi"
    );
});

test("cleaning tidak lagi gagal hanya karena provenance tidak bisa diperiksa penuh", () => {
    assert.doesNotMatch(
        cleanSource,
        /File terlalu besar untuk pemeriksaan provenance/,
        "pesan lama tidak boleh muncul lagi dari jalur cleaning"
    );
    assert.match(cleanSource, /provenanceLimited/);
    assert.match(cleanSource, /Pemeriksaan provenance gagal/);
    assert.match(cleanSource, /CLEANING SELESAI — PROVENANCE TERBATAS/);
    assert.match(cleanSource, /residualProvenance/);
    assert.doesNotMatch(
        cleanSource,
        /throw new Error\(\s*"SoftwareAgent atau C2PA/
    );
});

test("state menyimpan tanda cakupan pemindaian agar panel tidak menyesatkan", () => {
    assert.match(stateSource, /normalized\.partial =\s*\n?\s*provenance\.partial === true/);
    assert.match(stateSource, /normalized\.coverage =/);
    assert.match(statusSource, /SELURUH BERKAS/);
});

test("file yang tidak bisa dibaca tetap dilaporkan sebagai NOT_CHECKED, bukan bersih", () => {
    assert.match(cleanSource, /status:\s*\n\s*"NOT_CHECKED"/);
    assert.match(cleanSource, /Provenance tidak dapat diperiksa/);
});

test("residu provenance tidak lagi menggagalkan cleaning", () => {
    assert.match(cleanSource, /RESIDU PROVENANCE MASIH TERBACA/);
    assert.match(cleanSource, /Berkas belum bisa disebut bebas C2PA/);
    assert.doesNotMatch(cleanSource, /File tidak ditandai bersih\./);
    assert.doesNotMatch(
        cleanSource,
        /SoftwareAgent masih ditemukan pada file hasil cleaning/
    );
});

test("cleaner video memangkas kotak metadata sebelum encode ulang", () => {
    assert.match(videoSource, /stripIsoBmffMetadata/);
    assert.match(videoSource, /LANGKAH 1 — pemangkasan kotak metadata/);
    assert.match(videoSource, /residual/);
    assert.doesNotMatch(
        videoSource,
        /Verifikasi gagal: metadata masih ditemukan setelah encode ulang/
    );
    assert.doesNotMatch(
        videoSource,
        /Metadata AI, SoftwareAgent, atau C2PA masih ditemukan setelah remux\./
    );
});

test("stamp hasil cleaning memakai PARTIAL saat provenance tidak lengkap", () => {
    assert.match(cleanSource, /renderCleaningSuccessStamp\("PARTIAL"\)/);
    assert.match(statusSource, /export function renderCleaningSuccessStamp\(/);
});
