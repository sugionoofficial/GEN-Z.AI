import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

import {
    stripIsoBmffMetadata,
    isIsoBmffBuffer
} from "../metadata-cleaner/assets/js/metadata-iso-bmff.js";

/* ------------------------------------------------------------------ */
/* Pembuat berkas MP4 tiruan                                           */
/* ------------------------------------------------------------------ */

function box(type, payloadLength = 0, fill = 0) {
    const size = 8 + payloadLength;
    const bytes = Buffer.alloc(size, fill);
    bytes.writeUInt32BE(size, 0);
    bytes.write(type, 4, "latin1");
    return bytes;
}

function boxWith(type, payload) {
    const size = 8 + payload.length;
    const bytes = Buffer.alloc(size);
    bytes.writeUInt32BE(size, 0);
    bytes.write(type, 4, "latin1");
    Buffer.from(payload).copy(bytes, 8);
    return bytes;
}

const C2PA_UUID = Buffer.from(
    "6332706100110010800000AA00389B71",
    "hex"
);

function uuidBox(uuid, payload) {
    return boxWith("uuid", Buffer.concat([uuid, Buffer.from(payload || "")]));
}

/** moov berisi udta berisi C2PA. */
function buildMoovWithC2pa(padding = 0) {
    const udta = boxWith(
        "udta",
        Buffer.concat([
            Buffer.from("c2pa manifest store placeholder"),
            Buffer.alloc(padding, 0x41)
        ])
    );
    const mvhd = box("mvhd", 100, 0x01);
    return boxWith("moov", Buffer.concat([mvhd, udta]));
}

function buildMp4({ withC2pa = true, mediaSize = 4096 } = {}) {
    const ftyp = boxWith("ftyp", Buffer.from("isom\0\0\0\0isommp41", "latin1"));
    const moov = withC2pa ? buildMoovWithC2pa() : box("moov", 64, 0x02);
    const media = box("mdat", mediaSize, 0x5a);
    return Buffer.concat([ftyp, moov, media]);
}

/* ------------------------------------------------------------------ */
/* Tes                                                                 */
/* ------------------------------------------------------------------ */

test("mendeteksi buffer ISO BMFF", () => {
    assert.equal(isIsoBmffBuffer(new Uint8Array(buildMp4())), true);
    assert.equal(
        isIsoBmffBuffer(new Uint8Array(Buffer.from("bukan mp4 sama sekali"))),
        false
    );
});

test("kotak udta berisi C2PA dihapus menjadi free", () => {
    const input = buildMp4();
    const result = stripIsoBmffMetadata(new Uint8Array(input));

    assert.equal(result.changed, true);
    assert.ok(result.removed.includes("udta"));

    const text = Buffer.from(result.bytes).toString("latin1");
    assert.equal(
        text.includes("c2pa"),
        false,
        "label c2pa harus ikut terhapus dari isi kotak"
    );
});

test("ukuran berkas dan offset byte tidak berubah sama sekali", () => {
    const input = buildMp4({ mediaSize: 8192 });
    const before = Buffer.from(input).toString("latin1");
    const mdatOffsetBefore = before.indexOf("mdat");

    const result = stripIsoBmffMetadata(new Uint8Array(input));
    const after = Buffer.from(result.bytes).toString("latin1");

    assert.equal(result.bytes.length, input.length);
    assert.equal(
        after.indexOf("mdat"),
        mdatOffsetBefore,
        "posisi mdat tidak boleh bergeser"
    );
    assert.match(after, /ftyp/);
    assert.match(after, /moov/);
    assert.match(after, /mvhd/, "kotak struktur seperti mvhd tetap ada");
});

test("kotak uuid C2PA dihapus, uuid lain dibiarkan", () => {
    const otherUuid = uuidBox(
        Buffer.from("0123456789abcdef0123456789abcdef", "hex"),
        Buffer.from("data vendor lain")
    );

    const input = Buffer.concat([
        boxWith("ftyp", Buffer.from("isom\0\0\0\0", "latin1")),
        uuidBox(C2PA_UUID, Buffer.from("manifest-store")),
        otherUuid,
        box("mdat", 256, 0x11)
    ]);

    const result = stripIsoBmffMetadata(new Uint8Array(input));

    assert.equal(result.removed.filter(type => type === "uuid").length, 1);

    const text = Buffer.from(result.bytes).toString("latin1");
    assert.equal(text.includes("manifest-store"), false);
    assert.equal(
        text.includes("data vendor lain"),
        true,
        "uuid milik vendor lain tidak boleh dirusak"
    );
});

test("memori video (mdat) tidak pernah diubah", () => {
    const input = buildMp4({ mediaSize: 2048 });
    const mediaStart = Buffer.from(input).toString("latin1").indexOf("mdat") + 4;

    const result = stripIsoBmffMetadata(new Uint8Array(input));

    const mediaBefore = input.subarray(mediaStart, mediaStart + 2048);
    const mediaAfter = Buffer.from(result.bytes).subarray(
        mediaStart,
        mediaStart + 2048
    );

    assert.deepEqual(
        Buffer.from(mediaAfter),
        Buffer.from(mediaBefore),
        "isi video tidak boleh berubah satu byte pun"
    );
});

test("berkas tanpa metadata provenance tidak diubah", () => {
    const input = buildMp4({ withC2pa: false });
    const result = stripIsoBmffMetadata(new Uint8Array(input));

    assert.equal(result.changed, false);
    assert.deepEqual(result.removed, []);
});

test("buffer yang bukan ISO BMFF dikembalikan apa adanya", () => {
    const input = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    const result = stripIsoBmffMetadata(input);

    assert.equal(result.changed, false);
    assert.equal(result.bytes, input);
});

test("kotak rusak / terpotong tidak membuat proses melempar error", () => {
    const input = Buffer.concat([
        boxWith("ftyp", Buffer.from("isom\0\0\0\0", "latin1")),
        Buffer.from([0x00, 0x00, 0xff, 0xff, 0x75, 0x64, 0x74, 0x61])
    ]);

    const result = stripIsoBmffMetadata(new Uint8Array(input));
    assert.equal(typeof result.changed, "boolean");
});

test("provenance.js melewati mdat saat mencari label c2pa", async () => {
    const source = await fs.readFile(
        new URL(
            "../metadata-cleaner/assets/js/metadata-provenance.js",
            import.meta.url
        ),
        "utf8"
    );

    assert.match(source, /function findMediaByteRanges/);
    assert.match(source, /containsAsciiInsensitiveOutside/);
    assert.match(source, /positif palsu, bukan provenance/);
    assert.match(
        source,
        /containsAsciiInsensitiveOutside\(\s*bytes,\s*C2PA_LABEL,\s*mediaRanges\s*\)/
    );
});
