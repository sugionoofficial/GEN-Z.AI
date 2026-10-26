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

const MB = 1024 * 1024;
const INSPECT_LIMIT = 50 * MB;
const WINDOW = 12 * MB;

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

/**
 * File tiruan: ukuran dilaporkan besar tanpa harus mengalokasikan seluruh
 * ukuran itu di memori tes.
 */
function fakeFile({ head, tail = new Uint8Array(0), size, name = "besar.jpg", type = "image/jpeg" }) {
    return {
        name,
        type,
        size,
        async arrayBuffer() {
            return head.buffer.slice(head.byteOffset, head.byteOffset + head.byteLength);
        },
        slice(start, end) {
            const isHead = start === 0;
            const chunk = isHead ? head : tail;
            return {
                async arrayBuffer() {
                    return chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength);
                }
            };
        }
    };
}

test("berkas di bawah batas tetap dipindai penuh", async () => {
    const bytes = bytesOf(2048);
    asciiInto(bytes, 16, "c2pa urn:uuid:1234");

    const result = await inspectProvenance(fakeFile({ head: bytes, size: bytes.length }));

    assert.equal(result.checked, true);
    assert.equal(result.detected, true);
    assert.equal(result.partial, undefined, "berkas kecil tidak boleh ditandai parsial");
    assert.match(result.status, /DETECTED/);
});

test("berkas besar tidak lagi menggagalkan pemeriksaan", async () => {
    const head = bytesOf(WINDOW + 64 * 1024);
    /* JPEG magic supaya formatnya terbaca walau hanya kepala yang dipindai. */
    head[0] = 0xff;
    head[1] = 0xd8;
    head[2] = 0xff;

    const result = await inspectProvenance(
        fakeFile({ head, size: 200 * MB, name: "video.mp4", type: "video/mp4" })
    );

    assert.equal(result.checked, true);
    assert.equal(result.partial, true);
    assert.equal(result.detected, false);
    assert.equal(result.status, "PARTIAL", "tidak ditemukan pada pemindaian sebagian bukan NOT_DETECTED");
    assert.equal(result.fileSize, 200 * MB);
    assert.ok(result.scannedBytes <= WINDOW + 64 * 1024 + WINDOW);
    assert.match(result.note, /melebihi batas pemindaian penuh/i);
    assert.match(result.note, /bukan berarti berkas bebas C2PA/i);
    assert.equal(result.inspectionLimitBytes, INSPECT_LIMIT);
});

test("label C2PA di bagian akhir berkas besar tetap terdeteksi", async () => {
    const head = bytesOf(WINDOW + 64 * 1024);
    head[0] = 0xff;
    head[1] = 0xd8;
    head[2] = 0xff;

    const tail = asciiInto(bytesOf(4096), 128, "c2pa manifest di ekor berkas");

    const result = await inspectProvenance(
        fakeFile({ head, tail, size: 200 * MB, name: "video.mp4", type: "video/mp4" })
    );

    assert.equal(result.partial, true);
    assert.equal(result.detected, true, "sinyal yang benar-benar ditemukan tetap dilaporkan");
    assert.equal(result.status, "DETECTED");
    assert.ok(result.findings.some(item => /c2pa/i.test(item)));
});

test("pemindaian sebagian hanya membaca kepala dan ekor, bukan seluruh berkas", async () => {
    const head = bytesOf(1024);
    head[0] = 0xff;
    head[1] = 0xd8;
    head[2] = 0xff;

    let tailRequested = null;
    const file = fakeFile({ head, tail: bytesOf(1024), size: 120 * MB });
    const originalSlice = file.slice;
    file.slice = (start, end) => {
        if (start > 0) tailRequested = [start, end];
        return originalSlice(start, end);
    };

    await inspectProvenance(file);

    assert.ok(tailRequested, "ekor berkas harus ikut dipindai");
    assert.equal(tailRequested[1], 120 * MB);
    assert.ok(
        tailRequested[0] < 120 * MB && tailRequested[0] > 100 * MB,
        "pemindaian ekor dimulai dekat akhir berkas"
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
    /* Residu yang ditemukan dicatat, tidak lagi membuang hasil cleaning. */
    assert.match(cleanSource, /residualProvenance/);
    assert.doesNotMatch(
        cleanSource,
        /throw new Error\(\s*"SoftwareAgent atau C2PA/
    );
});

test("state menyimpan tanda pemindaian sebagian agar panel tidak menyesatkan", () => {
    assert.match(stateSource, /normalized\.partial =\s*\n?\s*provenance\.partial === true/);
    assert.match(stateSource, /normalized\.note =/);
    assert.match(statusSource, /SEBAGIAN \(berkas besar\)/);
});

test("file yang tidak bisa dibaca tetap dilaporkan sebagai NOT_CHECKED, bukan bersih", () => {
    assert.match(cleanSource, /status:\s*\n\s*"NOT_CHECKED"/);
    assert.match(cleanSource, /Provenance tidak dapat diperiksa/);
});

test("residu provenance tidak lagi menggagalkan cleaning", () => {
    assert.match(cleanSource, /RESIDU PROVENANCE MASIH TERBACA/);
    assert.match(cleanSource, /Berkas belum bisa disebut bebas C2PA/);
    assert.doesNotMatch(
        cleanSource,
        /File tidak ditandai bersih\./
    );
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

test("stamp hasil cleaning memakai PARTIAL saat provenance hanya sebagian", () => {
    assert.match(cleanSource, /renderCleaningSuccessStamp\("PARTIAL"\)/);
    assert.match(statusSource, /export function renderCleaningSuccessStamp\(/);
});
