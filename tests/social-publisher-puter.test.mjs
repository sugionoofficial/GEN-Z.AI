import test from "node:test";
import assert from "node:assert/strict";
import jpeg from "jpeg-js";

import {
    generatePuterSocialImage,
    puterImageModel,
    readImageSize,
    PUTER_DEFAULT_IMAGE_MODEL
} from "../lib/social-publisher/puter.js";
import { generateSocialImage, testPuterImageProvider } from "../lib/social-publisher/providers.js";

const DRIVERS_CALL_URL = "https://api.puter.com/drivers/call";

function photo({ width = 400, height = 600 } = {}) {
    const data = new Uint8Array(width * height * 4);
    for (let index = 0; index < width * height; index += 1) {
        data[index * 4] = index % 255;
        data[index * 4 + 1] = (index * 3) % 255;
        data[index * 4 + 2] = (index * 7) % 255;
        data[index * 4 + 3] = 255;
    }
    return new Uint8Array(jpeg.encode({ data, width, height }, 80).data);
}

function pngLike({ width = 320, height = 480 } = {}) {
    /* PNG signature + IHDR palsu: cukup untuk deteksi mime + pembacaan dimensi. */
    const bytes = new Uint8Array(64);
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    bytes.set([0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52], 8);
    bytes[16] = (width >>> 24) & 0xff;
    bytes[17] = (width >>> 16) & 0xff;
    bytes[18] = (width >>> 8) & 0xff;
    bytes[19] = width & 0xff;
    bytes[20] = (height >>> 24) & 0xff;
    bytes[21] = (height >>> 16) & 0xff;
    bytes[22] = (height >>> 8) & 0xff;
    bytes[23] = height & 0xff;
    return bytes;
}

function mockFetch(handler) {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, options = {}) => handler(String(input), options);
    return () => { globalThis.fetch = originalFetch; };
}

function base64(bytes) {
    return Buffer.from(bytes).toString("base64");
}

test("generatePuterSocialImage memanggil drivers/call dengan referensi + outfit", async () => {
    const output = pngLike({ width: 720, height: 1280 });
    let requestBody = null;
    let authHeader = "";
    const restore = mockFetch(async (url, options = {}) => {
        if (url === DRIVERS_CALL_URL) {
            authHeader = options.headers.Authorization;
            requestBody = JSON.parse(options.body);
            return Response.json({
                success: true,
                result: { data: base64(output), mime_type: "image/png" }
            });
        }
        throw new Error(`Unexpected fetch: ${url}`);
    });
    try {
        const result = await generatePuterSocialImage({
            env: { PUTER_AUTH_TOKEN: "puter-token" },
            prompt: "Karakter di galeri seni",
            referenceBytes: photo(),
            referenceMimeType: "image/jpeg",
            garmentBytes: photo({ width: 300, height: 300 }),
            garmentMimeType: "image/jpeg",
            aspectRatio: "9:16"
        });

        assert.equal(authHeader, "Bearer puter-token");
        assert.equal(requestBody.interface, "puter-image-generation");
        assert.equal(requestBody.driver, "ai-image");
        assert.equal(requestBody.method, "generate");
        assert.equal(requestBody.auth_token, "puter-token");
        assert.equal(requestBody.args.model, PUTER_DEFAULT_IMAGE_MODEL);
        assert.deepEqual(requestBody.args.ratio, { w: 9, h: 16 });
        assert.equal(requestBody.args.quality, "1K", "model Gemini harus dikirimi kualitas 1K");
        assert.equal(requestBody.args.input_images.length, 2, "referensi + outfit");
        assert.match(requestBody.args.input_images[0], /^data:image\/jpeg;base64,/);
        assert.match(requestBody.args.input_images[1], /^data:image\/jpeg;base64,/);
        assert.equal(result.model, PUTER_DEFAULT_IMAGE_MODEL);
        assert.equal(result.images_sent, 2);
        assert.equal(result.mimeType, "image/png");
        assert.equal(result.width, 720);
        assert.equal(result.height, 1280);
        assert.ok(result.bytes.length > 0);
    } finally {
        restore();
    }
});

test("rasio 16:9 mengirim ratio 16:9; model non-Gemini tidak dikirimi quality", async () => {
    let requestBody = null;
    const restore = mockFetch(async (url, options = {}) => {
        if (url === DRIVERS_CALL_URL) {
            requestBody = JSON.parse(options.body);
            return Response.json({
                success: true,
                result: { data: base64(pngLike()), mime_type: "image/png" }
            });
        }
        throw new Error(`Unexpected fetch: ${url}`);
    });
    try {
        await generatePuterSocialImage({
            env: { PUTER_AUTH_TOKEN: "puter-token", PUTER_IMAGE_MODEL: "kling-v3" },
            prompt: "Latar hitam polos",
            aspectRatio: "16:9"
        });
        assert.deepEqual(requestBody.args.ratio, { w: 16, h: 9 });
        assert.equal(requestBody.args.model, "kling-v3");
        assert.equal(requestBody.args.quality, undefined, "quality hanya untuk model Gemini");
        assert.equal(requestBody.args.input_images, undefined, "tanpa referensi = tanpa input_images");
    } finally {
        restore();
    }
});

test("hasil hosted URL diunduh; respons biner langsung dipakai", async () => {
    const hostedBytes = pngLike({ width: 640, height: 1136 });
    const binaryBytes = pngLike({ width: 108, height: 192 });
    let call = 0;
    const restore = mockFetch(async (url, options = {}) => {
        if (url === DRIVERS_CALL_URL) {
            call += 1;
            return call === 1
                ? Response.json({ success: true, result: { url: "https://assets.example/out.png" } })
                : new Response(binaryBytes, { headers: { "content-type": "application/octet-stream" } });
        }
        if (url === "https://assets.example/out.png") {
            return new Response(hostedBytes, { headers: { "content-type": "image/png" } });
        }
        throw new Error(`Unexpected fetch: ${url}`);
    });
    try {
        const viaUrl = await generatePuterSocialImage({
            env: { PUTER_AUTH_TOKEN: "puter-token" },
            prompt: "tes",
            referenceBytes: photo(),
            referenceMimeType: "image/jpeg"
        });
        assert.equal(viaUrl.mimeType, "image/png");
        assert.equal(viaUrl.width, 640);
        assert.equal(viaUrl.height, 1136);

        const viaBinary = await generatePuterSocialImage({
            env: { PUTER_AUTH_TOKEN: "puter-token" },
            prompt: "tes"
        });
        assert.equal(viaBinary.mimeType, "image/png");
        assert.equal(viaBinary.width, 108);
    } finally {
        restore();
    }
});

test("insufficient_funds dilaporkan jujur sebagai jatah akun Puter habis", async () => {
    const restore = mockFetch(async (url) => {
        if (url === DRIVERS_CALL_URL) {
            return Response.json({
                success: false,
                error: { code: "insufficient_funds", message: "Insufficient funds" }
            });
        }
        throw new Error(`Unexpected fetch: ${url}`);
    });
    try {
        await assert.rejects(
            () => generatePuterSocialImage({
                env: { PUTER_AUTH_TOKEN: "puter-token" },
                prompt: "tes",
                referenceBytes: photo(),
                referenceMimeType: "image/jpeg"
            }),
            error => {
                assert.equal(error.status, 402);
                assert.match(error.message, /insufficient_funds/);
                assert.match(error.message, /akun Puter/i);
                assert.match(error.message, /User-Pays/);
                assert.match(error.message, /bukan kredit GEN-Z\.AI/);
                return true;
            }
        );
    } finally {
        restore();
    }
});

test("token salah menunjuk ke PUTER_AUTH_TOKEN; tanpa token memberi petunjuk secret", async () => {
    const restore = mockFetch(async (url) => {
        if (url === DRIVERS_CALL_URL) {
            return Response.json({
                success: false,
                error: { code: "token_auth_failed", message: "invalid token" }
            });
        }
        throw new Error(`Unexpected fetch: ${url}`);
    });
    try {
        await assert.rejects(
            () => generatePuterSocialImage({ env: { PUTER_AUTH_TOKEN: "wrong" }, prompt: "tes" }),
            error => {
                assert.equal(error.status, 401);
                assert.match(error.message, /PUTER_AUTH_TOKEN/);
                return true;
            }
        );
    } finally {
        restore();
    }

    await assert.rejects(
        () => generatePuterSocialImage({ env: {}, prompt: "tes" }),
        error => {
            assert.equal(error.status, 503);
            assert.match(error.message, /PUTER_AUTH_TOKEN belum dikonfigurasi/);
            assert.match(error.message, /puter\.com\/dashboard/);
            assert.match(error.message, /User-Pays/);
            return true;
        }
    );
});

test("generateSocialImage meneruskan provider puter; tes melaporkan ukuran hasil", async () => {
    const output = pngLike({ width: 720, height: 1280 });
    let hit = 0;
    const restore = mockFetch(async (url) => {
        if (url === DRIVERS_CALL_URL) {
            hit += 1;
            return Response.json({
                success: true,
                result: { data: base64(output), mime_type: "image/png" }
            });
        }
        /* loadCloudflareTestReference memuat foto contoh; gagal = fallback sintetis. */
        throw new Error(`Unexpected fetch: ${url}`);
    });
    try {
        const generated = await generateSocialImage({
            env: { PUTER_AUTH_TOKEN: "puter-token" },
            prompt: "Potret karakter",
            referenceBytes: photo(),
            referenceMimeType: "image/jpeg",
            aspectRatio: "9:16",
            imageProvider: "puter"
        });
        assert.equal(generated.model, PUTER_DEFAULT_IMAGE_MODEL);
        assert.ok(generated.bytes.length > 0);

        const testResult = await testPuterImageProvider({ env: { PUTER_AUTH_TOKEN: "puter-token" } });
        assert.equal(testResult.ok, true);
        assert.equal(testResult.model, PUTER_DEFAULT_IMAGE_MODEL);
        assert.ok(testResult.bytes > 0);
        assert.equal(testResult.width, 720);
        assert.equal(testResult.height, 1280);
        assert.ok(["sample-photo", "synthetic"].includes(testResult.test_reference_source));
        assert.equal(hit, 2, "satu generate + satu tes");
    } finally {
        restore();
    }
});

test("readImageSize membaca PNG/JPEG; puterImageModel memakai override env", () => {
    assert.deepEqual(readImageSize(pngLike({ width: 33, height: 44 })), { width: 33, height: 44 });
    const jpegBytes = photo({ width: 401, height: 602 });
    assert.deepEqual(readImageSize(jpegBytes), { width: 401, height: 602 });
    assert.equal(readImageSize(new Uint8Array([1, 2, 3])), null);
    assert.equal(puterImageModel({}), PUTER_DEFAULT_IMAGE_MODEL);
    assert.equal(puterImageModel({ PUTER_IMAGE_MODEL: "gemini-3.1-flash-lite-image" }), "gemini-3.1-flash-lite-image");
});
