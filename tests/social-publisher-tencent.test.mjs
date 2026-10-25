import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import jpeg from "jpeg-js";

import {
    generateTencentSocialImage,
    tencentImageSizeForRatio,
    TENCENT_V35_ENDPOINT
} from "../lib/social-publisher/tencent.js";
import { generateSocialImage, testTencentImageProvider } from "../lib/social-publisher/providers.js";

const ENDPOINT = "https://tokenhub-intl.tencentcloudmaas.com/v1/wand/hunyuan-image/v3-generation";
const V35_ENDPOINT = "https://tokenhub-intl.tencentcloudmaas.com/v1/wand/hunyuan-image/v35-generation";

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
            aspectRatio: "9:16",
            model: "hy-image-v3"
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
    assert.deepEqual(tencentImageSizeForRatio("16:9", "hy-image-v3"), { width: 1024, height: 576 });
    assert.deepEqual(tencentImageSizeForRatio("9:16", "hy-image-v3"), { width: 576, height: 1024 });
    const { width, height } = tencentImageSizeForRatio("9:16", "hy-image-v3");
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
                env: { TENCENT_TOKENHUB_KEY: "k", TENCENT_IMAGE_MODEL: "hy-image-v3" },
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
            env: { TENCENT_TOKENHUB_KEY: "k", TENCENT_IMAGE_MODEL: "hy-image-v3" },
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
    let seenBody = null;
    const restore = mockFetch(async (url, options = {}) => {
        if (url === "https://proxy.example/tencent") {
            seenUrl = url;
            seenBody = JSON.parse(options.body);
            return Response.json({
                choices: [{ delta: { image: { url: "https://aigc-image.example/x.png" } } }],
                request_id: "req-ovr"
            });
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
        assert.equal(seenBody.model, "hy-image-v3.5-preview");
    } finally {
        restore();
    }
});

test("hy-image-v3.5-preview memakai protokol messages dengan gambar referensi", async () => {
    const output = photo({ width: 1080, height: 1920 });
    let seenUrl = "";
    let body = null;
    const restore = mockFetch(async (url, options = {}) => {
        if (url === V35_ENDPOINT) {
            seenUrl = url;
            body = JSON.parse(options.body);
            return Response.json({
                object: "image.chat.completion.chunk",
                choices: [{ index: 0, delta: { type: "image", image: { url: "https://aigc-image.example/v35.png", width: 1080, height: 1920 } }, finish_reason: null }],
                request_id: "req-v35"
            });
        }
        if (url === "https://aigc-image.example/v35.png") {
            return new Response(output, { headers: { "content-type": "image/png" } });
        }
        throw new Error(`Unexpected fetch: ${url}`);
    });
    try {
        const result = await generateTencentSocialImage({
            env: { TENCENT_TOKENHUB_KEY: "k" },
            prompt: "Karakter di galeri seni",
            referenceBytes: photo(),
            referenceMimeType: "image/jpeg",
            garmentBytes: photo({ width: 300, height: 300 }),
            garmentMimeType: "image/jpeg",
            aspectRatio: "9:16"
        });
        assert.equal(seenUrl, V35_ENDPOINT, "Model default harus memakai endpoint v35");
        assert.equal(body.model, "hy-image-v3.5-preview");
        assert.equal(body.size, "1080x1920");
        assert.equal(body.messages[0].role, "user");
        const parts = body.messages[0].content;
        assert.equal(parts[0].type, "text");
        assert.equal(parts.filter(part => part.type === "image_url").length, 2, "referensi + outfit");
        assert.match(parts[1].image_url.url, /^data:image\/jpeg;base64,/);
        assert.equal(result.model, "hy-image-v3.5-preview");
        assert.equal(result.images_sent, 2);
        assert.ok(result.bytes.length > 0);
    } finally {
        restore();
    }
});

test("jawaban v3.5 berbentuk SSE tetap terbaca", async () => {
    const output = photo({ width: 300, height: 500 });
    const sse = [
        'data: {"choices":[{"index":0,"delta":{"type":"text"},"finish_reason":null}],"request_id":"req-sse"}',
        'data: {"choices":[{"index":0,"delta":{"type":"image","image":{"url":"https://aigc-image.example/sse.png"}},"finish_reason":null}],"request_id":"req-sse"}',
        "data: [DONE]"
    ].join("\n\n");
    const restore = mockFetch(async (url) => {
        if (url === V35_ENDPOINT) {
            return new Response(sse, { headers: { "content-type": "text/event-stream" } });
        }
        if (url === "https://aigc-image.example/sse.png") {
            return new Response(output, { headers: { "content-type": "image/jpeg" } });
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
        assert.ok(result.bytes.length > 0);
        assert.equal(result.model, "hy-image-v3.5-preview");
    } finally {
        restore();
    }
});

test("frame error v3.5 dilaporkan sebagai penolakan, bukan gambar kosong", async () => {
    const restore = mockFetch(async () => Response.json({
        choices: [{ index: 0, delta: {}, finish_reason: "error" }],
        error: { type: "invalid_request_error", code: "content_filter", message: "input moderation rejected" },
        request_id: "req-filter"
    }));
    try {
        await assert.rejects(
            generateTencentSocialImage({
                env: { TENCENT_TOKENHUB_KEY: "k" },
                prompt: "Karakter di taman",
                referenceBytes: photo(),
                referenceMimeType: "image/jpeg"
            }),
            error => {
                assert.equal(error.status, 422);
                assert.match(error.message, /input moderation rejected/);
                assert.match(error.message, /req-filter/);
                return true;
            }
        );
    } finally {
        restore();
    }
});

test("ukuran v3.5 memakai 1080x1920 dan 1920x1080", () => {
    assert.deepEqual(tencentImageSizeForRatio("9:16", "hy-image-v3.5-preview"), { width: 1080, height: 1920 });
    assert.deepEqual(tencentImageSizeForRatio("16:9", "hy-image-v3.5-preview"), { width: 1920, height: 1080 });
    const { width, height } = tencentImageSizeForRatio("9:16");
    assert.ok(width >= 256 && height <= 8192, "batas v3.5");
    assert.ok(width * height <= 16777216, "luas maksimum v3.5");
});

test("tombol tes Tencent mengembalikan ringkasan gambar yang benar-benar dibuat", async () => {
    const output = photo({ width: 576, height: 1024 });
    const restore = mockFetch(async (url) => {
        if (url === ENDPOINT) {
            return Response.json({ data: [{ url: "https://aigc-image.example/test.png" }] });
        }
        if (url === "https://aigc-image.example/test.png") {
            return new Response(output, { headers: { "content-type": "image/jpeg" } });
        }
        throw new Error(`Unexpected fetch: ${url}`);
    });
    try {
        const result = await testTencentImageProvider({ env: { TENCENT_TOKENHUB_KEY: "k", TENCENT_IMAGE_MODEL: "hy-image-v3" } });
        assert.equal(result.ok, true);
        assert.equal(result.model, "hy-image-v3");
        assert.ok(result.bytes > 0);
        assert.equal(result.images_sent, 1);
        assert.ok(["sample-photo", "synthetic"].includes(result.test_reference_source));
    } finally {
        restore();
    }
});

test("tombol tes Tencent meneruskan error asli, bukan melaporkan OK", async () => {
    const restore = mockFetch(async () => Response.json({
        error: { message: "postpaid billing is not enabled for this model" }
    }, { status: 403 }));
    try {
        const result = await testTencentImageProvider({ env: { TENCENT_TOKENHUB_KEY: "k", TENCENT_IMAGE_MODEL: "hy-image-v3" } });
        assert.equal(result.ok, false);
        assert.equal(result.status, 403);
        assert.match(result.error, /postpaid billing is not enabled/);
    } finally {
        restore();
    }
});

test("tombol Tes Tencent ada di admin dan memanggil aksi tes dengan provider tencent", () => {
    const read = path => readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), "utf8");
    const html = read("admin-control/studio-medsos-set.html");
    const js = read("admin-control/studio-medsos-set.js");
    const api = read("api/social-publisher.js");
    assert.match(html, /id="test-tencent-provider"/, "Tombol Tes Tencent harus ada di panel admin");
    assert.match(js, /test-tencent-provider"\)\?\.addEventListener\("click", testTencentProvider\)/);
    assert.match(js, /body: \{ provider: "tencent" \}/, "Handler harus mengirim provider tencent");
    assert.match(api, /testTencentImageProvider\(\{ env \}\)/, "API harus memakai jalur tes Tencent");
    assert.match(api, /String\(body\?\.provider \|\| "cloudflare"\)/, "Aksi tes harus menerima pilihan provider");
});
