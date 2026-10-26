import test from "node:test";
import assert from "node:assert/strict";
import jpeg from "jpeg-js";

import {
    cropFaceRegion,
    locateHeadBox,
    downscaleRgba
} from "../lib/social-publisher/reference-image.js";

/*
 * Foto sintetis: latar polos + satu "kepala" berwarna kulit pada posisi
 * tertentu. Ini menguji bahwa potongan wajah MENGIKUTI posisi kepala, bukan
 * selalu memotong bagian atas-tengah.
 */
function makePortrait({
    width = 900,
    height = 1400,
    headX = 450,
    headY = 260,
    headRadius = 90,
    background = [40, 90, 160]
} = {}) {
    const data = new Uint8Array(width * height * 4);

    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const index = (y * width + x) * 4;
            data[index] = background[0];
            data[index + 1] = background[1];
            data[index + 2] = background[2];
            data[index + 3] = 255;
        }
    }

    for (let y = -headRadius; y <= headRadius; y += 1) {
        for (let x = -headRadius; x <= headRadius; x += 1) {
            if (x * x + y * y > headRadius * headRadius) continue;
            const px = headX + x;
            const py = headY + y;
            if (px < 0 || py < 0 || px >= width || py >= height) continue;
            const index = (py * width + px) * 4;
            data[index] = 196;
            data[index + 1] = 150;
            data[index + 2] = 120;
            data[index + 3] = 255;
        }
    }

    return { width, height, data };
}

function encode(image) {
    return new Uint8Array(jpeg.encode({ data: image.data, width: image.width, height: image.height }, 90).data);
}

test("locateHeadBox menemukan kepala yang tidak di tengah", () => {
    const image = makePortrait({ headX: 690, headY: 240, headRadius: 85 });
    const box = locateHeadBox(image);

    assert.ok(box, "kepala harus terdeteksi");
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;

    assert.ok(
        Math.abs(centerX - 690) < image.width * 0.12,
        `pusat potongan (${Math.round(centerX)}) harus dekat kepala (690)`
    );
    assert.ok(
        centerY < image.height * 0.45,
        `potongan harus di area atas (pusat y ${Math.round(centerY)})`
    );
});

test("locateHeadBox menemukan kepala yang lebih rendah (foto duduk)", () => {
    const image = makePortrait({ headY: 430, headRadius: 80 });
    const box = locateHeadBox(image);

    assert.ok(box, "kepala harus terdeteksi");
    const centerY = box.y + box.height / 2;
    assert.ok(
        centerY > image.height * 0.2,
        `potongan harus ikut turun (pusat y ${Math.round(centerY)})`
    );
    assert.ok(centerY < image.height * 0.5);
});

test("locateHeadBox mengembalikan null untuk foto tanpa area kulit", () => {
    const image = makePortrait({ background: [20, 20, 20], headRadius: 0 });
    assert.equal(locateHeadBox(image), null);
});

test("potongan kepala lebih rapat daripada tebakan geometris lama", () => {
    const image = makePortrait({ headX: 450, headY: 200, headRadius: 70 });
    const bytes = encode(image);

    const crop = cropFaceRegion(bytes, "image/jpeg", { maxSide: 512 });
    assert.ok(crop, "foto jangkung harus dipotong");
    assert.equal(crop.method, "skin");

    /* Tebakan lama: 62% lebar x 42% tinggi dari atas. */
    const legacyWidth = Math.round(image.width * 0.62);
    const legacyHeight = Math.round(image.height * 0.42);

    assert.ok(
        crop.box.width < legacyWidth,
        `lebar kotak kepala ${crop.box.width} harus lebih rapat dari ${legacyWidth}`
    );
    assert.ok(
        crop.box.height < legacyHeight,
        `tinggi kotak kepala ${crop.box.height} harus lebih rapat dari ${legacyHeight}`
    );
});

test("potret kepala-dada yang sudah dekat tidak dipotong lagi", () => {
    /* Kepala mengisi hampir setengah lebar foto pada bidang persegi. */
    const image = makePortrait({
        width: 600,
        height: 620,
        headX: 300,
        headY: 250,
        headRadius: 130
    });
    const bytes = encode(image);

    assert.equal(
        cropFaceRegion(bytes, "image/jpeg"),
        null,
        "wajah sudah besar; memotong lagi berisiko memenggal dagu"
    );
});

test("melaporkan perkiraan lebar wajah untuk peringatan foto terlalu jauh", () => {
    const far = makePortrait({ headRadius: 38 });
    const near = makePortrait({ headRadius: 120 });

    const farCrop = cropFaceRegion(encode(far), "image/jpeg", { maxSide: 512 });
    const nearCrop = cropFaceRegion(encode(near), "image/jpeg", { maxSide: 512 });

    assert.ok(farCrop.headWidth > 0);
    assert.ok(nearCrop.headWidth > 0);
    assert.ok(
        farCrop.headWidth < 200,
        `wajah jauh harus dilaporkan kecil (${farCrop.headWidth} px)`
    );
    assert.ok(
        nearCrop.headWidth > farCrop.headWidth,
        "wajah dekat harus dilaporkan lebih besar"
    );
});

test("foto tanpa kulit tetap dipotong secara geometris (perilaku lama)", () => {
    const image = makePortrait({ background: [20, 20, 20], headRadius: 0 });
    const bytes = encode(image);

    const crop = cropFaceRegion(bytes, "image/jpeg");
    assert.ok(crop, "foto jangkung tanpa kulit tetap dipotong");
    assert.equal(crop.method, "geometry");
    assert.equal(crop.width, Math.round(image.width * 0.62));
});

test("deteksi kepala tidak berjalan berat pada foto besar", () => {
    const image = makePortrait({ width: 2400, height: 3600, headRadius: 260 });
    const started = Date.now();
    const box = locateHeadBox(image);
    const elapsed = Date.now() - started;

    assert.ok(box);
    assert.ok(elapsed < 2000, `deteksi terlalu lambat: ${elapsed} ms`);
});

test("potongan tetap diperkecil ke batas sisi dan menghasilkan JPEG valid", () => {
    const image = makePortrait({ width: 1200, height: 1800, headRadius: 140 });
    const bytes = encode(image);
    const crop = cropFaceRegion(bytes, "image/jpeg", { maxSide: 512 });

    assert.ok(crop);
    assert.ok(Math.max(crop.width, crop.height) <= 512);
    assert.equal(crop.mimeType, "image/jpeg");
    /* JPEG SOI. */
    assert.equal(crop.bytes[0], 0xff);
    assert.equal(crop.bytes[1], 0xd8);
    assert.ok(crop.source.width === 1200 && crop.source.height === 1800);
});

test("downscaleRgba tetap aman untuk citra sintetis", () => {
    const image = makePortrait({ width: 200, height: 300, headRadius: 30 });
    const scaled = downscaleRgba(image, 100);
    assert.ok(scaled.width <= 100);
    assert.ok(scaled.height <= 150);
});
