import test from "node:test";
import assert from "node:assert/strict";
import jpeg from "jpeg-js";

import {
    generateTencentSocialImage,
    tencentImageSizeForRatio
} from "../lib/social-publisher/tencent.js";
import { generateSocialImage } from "../lib/social-publisher/providers.js";

const ENDPOINT = "https://tokenhub-intl.tencentcloudmaas.com/v1/wand/hunyuan-image/v3-generation";

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

function mockFetch(handler) {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, options = {}) => handler(String(input), options);
    return () => { globalThis.fetch = originalFetch; };
}

test("Hy-Image-3.0 dipanggil dengan foto referensi dan outfit sebagai base64", async () => {
    const output = photo({ width: 300, height: 500 });
    let requestBody = null;
    let authHeader = "";
    const restore = mockFetch(async (url, options = {}) => {
        if (url === ENDPOINT) {
            authHeader = options.headers.Authorization;
            requestBody = JSON.parse(options.body);
            return Response.json({ data: [{ url: "https://aigc-image.example/result.png" }], request_id: "req-1" });
        }
        if (url === "https://aigc-image.example/result.png") {
            return new Response(output, { headers: { "content-type": "image/jpeg" } });
        }
        throw new Error(`Unexpected fetch: ${url}`);
    });
    try {
        const result = await generateTencentSocialImage({
            env: { TENCENT_TOKENHUB_KEY: "tencent-key" },
            prompt: "Karakter di galeri seni",
            referenceBytes: photo(),
            referenceMimeType: "image/jpeg",
            garmentBytes: photo({ width: 300, height: 300 }),
            garmentMimeType: "image/jpeg",
            aspectRatio: "9:16"
        });

        assert.equal(authHeader, "Bearer tencent-key");
        assert.equal(requestBody.model, "hy-image-v3");
        assert.equal(requestBody.size, "576x1024");
        assert.equal(requestBody.revise, false);
        assert.equal(requestBody.images.length, 2, "referensi + outfit");
        assert.match(requestBody.images[0], /^data:image\/jpeg;base64,/);
        assert.equal(result.model, "hy-image-v3");
        assert.equal(result.images_sent, 2);
        assert.ok(result.bytes.length > 0);
        assert.equal(result.mimeType, "image/jpeg");
    } finally {
        restore();
    }
});

test("rasio 16:9 memakai 1024x576 agar tetap di dalam batas area API", () => {
    assert.deepEqual(tencentImageSizeForRatio("16:9"), { width: 1024, height: 576 });
    assert.deepEqual(tencentImageSizeForRatio("9:16"), { width: 576, height: 1024 });
    const { width, height } = tencentImageSizeForRatio("9:16");
    assert.ok(width >= 512 && height >= 512, "batas minimum sisi Hy-Image-3.0");
    assert.ok(width * height <= 1024 * 1024, "luas maksimum Hy-Image-3.0");
});

test("tanpa TENCENT_TOKENHUB_KEY pesannya menyebut secret yang harus diisi", async () => {
    await assert.rejects(
        generateTencentSocialImage({
            env: {},
            prompt: "apa saja",
            referenceBytes: photo(),
            referenceMimeType: "image/jpeg"
        }),
        error => {
            assert.equal(error.status, 503);
            assert.match(error.message, /TENCENT_TOKENHUB_KEY belum dikonfigurasi/);
            assert.match(error.message, /wrangler@4 secret put TENCENT_TOKENHUB_KEY/);
            return true;
        }
    );
});

test("401 dijelaskan sebagai API key TokenHub, bukan SecretId", async () => {
    const restore = mockFetch(async () => Response.json({
        error: { message: "invalid api key" },
        request_id: "req-401"
    }, { status: 401 }));
    try {
        await assert.rejects(
            generateSocialImage({
                env: { TENCENT_TOKENHUB_KEY: "salah" },
                prompt: "Karakter di taman",
                referenceBytes: photo(),
                referenceMimeType: "image/jpeg",
                imageProvider: "tencent"
            }),
            error => {
                assert.equal(error.status, 401);
                assert.match(error.message, /API key TokenHub/);
                assert.match(error.message, /req-401/);
                return true;
            }
        );
    } finally {
        restore();
    }
});

test("422 moderasi konten dijelaskan dengan saran mengubah prompt", async () => {
    const restore = mockFetch(async () => Response.json({
        error: { message: "moderation blocked" }
    }, { status: 422 }));
    try {
        await assert.rejects(
            generateTencentSocialImage({
                env: { TENCENT_TOKENHUB_KEY: "k" },
                prompt: "Karakter di pantai",
                referenceBytes: photo(),
                referenceMimeType: "image/jpeg"
            }),
            error => {
                assert.equal(error.status, 422);
                assert.match(error.message, /diblokir moderasi konten Tencent/);
                return true;
            }
        );
    } finally {
        restore();
    }
});

test("respons tanpa URL gambar tidak dianggap sukses", async () => {
    const restore = mockFetch(async () => Response.json({ data: [], request_id: "req-2" }));
    try {
        await assert.rejects(
            generateTencentSocialImage({
                env: { TENCENT_TOKENHUB_KEY: "k" },
                prompt: "Karakter di taman",
                referenceBytes: photo(),
                referenceMimeType: "image/jpeg"
            }),
            error => {
                assert.equal(error.status, 502);
                assert.match(error.message, /tidak mengembalikan URL gambar/);
                return true;
            }
        );
    } finally {
        restore();
    }
});

test("URL hasil yang menolak akses anonim diunduh ulang dengan Bearer", async () => {
    const output = photo({ width: 320, height: 480 });
    const restore = mockFetch(async (url, options = {}) => {
        if (url === ENDPOINT) {
            return Response.json({ data: [{ url: "https://aigc-image.example/locked.png" }] });
        }
        if (url === "https://aigc-image.example/locked.png") {
            if (!options.headers?.Authorization) return new Response("denied", { status: 403 });
            assert.equal(options.headers.Authorization, "Bearer k");
            return new Response(output, { headers: { "content-type": "image/png" } });
        }
        throw new Error(`Unexpected fetch: ${url}`);
    });
    try {
        const result = await generateTencentSocialImage({
            env: { TENCENT_TOKENHUB_KEY: "k" },
            prompt: "Karakter di taman",
            referenceBytes: photo(),
            referenceMimeType: "image/jpeg"
        });
        assert.equal(result.mimeType, "image/png");
        assert.ok(result.bytes.length > 0);
    } finally {
        restore();
    }
});

test("endpoint dan model bisa dioverride lewat Worker variable", async () => {
    let seenUrl = "";
    let seenModel = "";
    const restore = mockFetch(async (url, options = {}) => {
        if (url === "https://proxy.example/tencent") {
            seenUrl = url;
            seenModel = JSON.parse(options.body).model;
            return Response.json({ data: [{ url: "https://aigc-image.example/x.png" }] });
        }
        if (url === "https://aigc-image.example/x.png") {
            return new Response(photo({ width: 300, height: 300 }), { headers: { "content-type": "image/jpeg" } });
        }
        throw new Error(`Unexpected fetch: ${url}`);
    });
    try {
        await generateTencentSocialImage({
            env: {
                TENCENT_TOKENHUB_KEY: "k",
                TENCENT_IMAGE_ENDPOINT: "https://proxy.example/tencent",
                TENCENT_IMAGE_MODEL: "hy-image-v3.5-preview"
            },
            prompt: "Karakter di taman",
            referenceBytes: photo(),
            referenceMimeType: "image/jpeg"
        });
        assert.equal(seenUrl, "https://proxy.example/tencent");
        assert.equal(seenModel, "hy-image-v3.5-preview");
    } finally {
        restore();
    }
});
