import test from "node:test";
import assert from "node:assert/strict";
import jpeg from "jpeg-js";
import { PNG } from "pngjs";

import {
    downloadDownscaledReference,
    downloadModelReference
} from "../lib/social-publisher/storage.js";
import {
    normalizeReferenceImageBounds,
    prepareReferenceImage,
    readPngRgbaSync
} from "../lib/social-publisher/reference-image.js";
import { generateSocialContextCaption } from "../lib/social-publisher/providers.js";
import { generateOpusSocialImage, OPUS_DEFAULT_MCP_URL, resetOpusTokenCache } from "../lib/social-publisher/opus.js";
import { stripImageMetadata } from "../metadata-cleaner/assets/js/metadata-cleaner-image.js";

const config = { url: "https://project.example", serviceRoleKey: "service-key" };

function tinyJpeg() {
    const data = new Uint8Array(16 * 16 * 4).fill(140);
    return new Uint8Array(jpeg.encode({ data, width: 16, height: 16 }, 80).data);
}

function mockFetch(handler) {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, options = {}) => handler(String(input), options);
    return () => { globalThis.fetch = originalFetch; };
}

function signHandler(onDownload) {
    return async (url, options = {}) => {
        if (url.includes("/storage/v1/object/sign/")) {
            assert.equal(options.method, "POST");
            return Response.json({ signedURL: "/object/sign/social-character-references/social-reference/user-1/ref.jpg?token=abc" });
        }
        return onDownload(url, options);
    };
}

test("referensi diambil lewat transformasi Supabase agar Worker tidak men-decode foto besar", async () => {
    const restore = mockFetch(signHandler(async (url) => {
        const parsed = new URL(url);
        assert.match(parsed.pathname, /^\/storage\/v1\/render\/image\/sign\//);
        assert.equal(parsed.searchParams.get("token"), "abc", "token tanda tangan harus dipertahankan");
        assert.equal(parsed.searchParams.get("width"), "512");
        assert.equal(parsed.searchParams.get("height"), "512");
        assert.equal(parsed.searchParams.get("resize"), "contain");
        return new Response(tinyJpeg(), { headers: { "content-type": "image/jpeg" } });
    }));
    try {
        const result = await downloadModelReference(config, "social-reference/user-1/ref.jpg");
        assert.equal(result.source, "supabase-transform");
        assert.equal(result.mimeType, "image/jpeg");
        assert.ok(result.bytes.length > 0);
    } finally {
        restore();
    }
});

test("bila transformasi ditolak, referensi asli tetap diunduh", async () => {
    const restore = mockFetch(signHandler(async (url) => {
        if (url.includes("/render/image/sign/")) return new Response("transformations disabled", { status: 400 });
        if (url.includes("/storage/v1/object/authenticated/")) return new Response(tinyJpeg(), { headers: { "content-type": "image/jpeg" } });
        throw new Error(`Unexpected fetch: ${url}`);
    }));
    try {
        const result = await downloadModelReference(config, "social-reference/user-1/ref.jpg");
        assert.equal(result.source, "original");
        assert.ok(result.bytes.length > 0);
    } finally {
        restore();
    }
});

test("bila URL tanda tangan gagal dibuat, unduhan biasa tetap dipakai", async () => {
    const restore = mockFetch(async (url) => {
        if (url.includes("/storage/v1/object/sign/")) return new Response("nope", { status: 500 });
        if (url.includes("/storage/v1/object/authenticated/")) {
            return new Response(tinyJpeg(), { headers: { "content-type": "image/jpeg" } });
        }
        throw new Error(`Unexpected fetch: ${url}`);
    });
    try {
        await assert.rejects(() => downloadDownscaledReference(config, "social-reference/user-1/ref.jpg"));
        const result = await downloadModelReference(config, "social-reference/user-1/ref.jpg");
        assert.equal(result.source, "original");
        assert.ok(result.bytes.length > 0);
    } finally {
        restore();
    }
});

test("PNG raksasa ditolak sebelum decode agar Worker tidak kehabisan memori", () => {
    /* Header PNG 6000x6000 (36 MP) tanpa data piksel: cukup untuk memastikan
       guard dimensi berjalan sebelum pngjs membaca apa pun. */
    const bytes = new Uint8Array(64);
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    new DataView(bytes.buffer).setUint32(8, 13);
    bytes.set([0x49, 0x48, 0x44, 0x52], 12);
    new DataView(bytes.buffer).setUint32(16, 6000);
    new DataView(bytes.buffer).setUint32(20, 6000);

    const prepared = prepareReferenceImage(bytes, "image/png");
    assert.equal(prepared.resized, false);
    assert.match(prepared.note, /terlalu besar untuk diperkecil/);
    assert.match(prepared.note, /6000x6000/);
});

test("foto referensi yang sudah kecil tidak di-decode sama sekali", () => {
    const bytes = tinyJpeg();
    const prepared = prepareReferenceImage(bytes, "image/jpeg");
    assert.equal(prepared.resized, false);
    assert.equal(prepared.note, "");
    assert.equal(prepared.bytes, bytes, "byte asli dipakai apa adanya tanpa decode/encode");
});

test("Opus melewati decode/resize pada foto referensi besar yang dimensinya sudah valid (300..6000px) agar terhindar dari Error 1102", async () => {
    resetOpusTokenCache();
    /* Header JPEG palsu 1200x1600 berukuran 250 KB tanpa bitstream scanline:
       bila Opus mencoba men-decode pikselnya secara eager, jpeg-js akan gagal. */
    const fakeLargeJpeg = new Uint8Array(250_000);
    fakeLargeJpeg.set([
        0xff, 0xd8,
        0xff, 0xc0, 0x00, 0x11, 0x08,
        0x06, 0x40, /* height 1600 */
        0x04, 0xb0, /* width 1200 */
        0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01
    ], 0);

    const outData = new Uint8Array(640 * 1136 * 4);
    for (let i = 0; i < outData.length; i += 4) {
        outData[i] = (i * 19) & 255;
        outData[i + 1] = (i * 37) & 255;
        outData[i + 2] = (i * 61) & 255;
        outData[i + 3] = 255;
    }
    const outputJpeg = new Uint8Array(jpeg.encode({ data: outData, width: 640, height: 1136 }, 80).data);

    let seenImportUrl = "";
    const restore = mockFetch(async (url, options = {}) => {
        if (url === "https://cdn.opus.pro/out/fast.jpg") {
            return new Response(outputJpeg, { status: 200, headers: { "content-type": "image/jpeg" } });
        }
        if (url === OPUS_DEFAULT_MCP_URL) {
            const body = JSON.parse(options.body);
            if (body.method === "initialize") return Response.json({ jsonrpc: "2.0", id: body.id, result: {} });
            if (body.method === "notifications/initialized") return new Response("", { status: 204 });
            if (body.method === "tools/list") {
                return Response.json({
                    jsonrpc: "2.0",
                    id: body.id,
                    result: {
                        tools: [
                            { name: "opus_video_tools_whoami", inputSchema: { type: "object", properties: {} } },
                            { name: "create_project", inputSchema: { type: "object", required: ["name"], properties: { name: { type: "string" } } } },
                            {
                                name: "import_assets",
                                inputSchema: {
                                    type: "object",
                                    required: ["projectId", "assets"],
                                    properties: {
                                        projectId: { type: "string" },
                                        assets: {
                                            type: "array",
                                            items: {
                                                type: "object",
                                                properties: { url: { type: "string" }, dataUrl: { type: "string" }, role: { type: "string" } }
                                            }
                                        }
                                    }
                                }
                            },
                            {
                                name: "generate_keyframes",
                                inputSchema: {
                                    type: "object",
                                    required: ["projectId", "items"],
                                    properties: {
                                        projectId: { type: "string" },
                                        items: {
                                            type: "array",
                                            items: {
                                                type: "object",
                                                properties: { id: { type: "string" }, prompt: { type: "string" }, referenceAssets: { type: "array", items: { type: "string" } } }
                                            }
                                        }
                                    }
                                }
                            },
                            {
                                name: "get_status",
                                inputSchema: {
                                    type: "object",
                                    required: ["projectId", "jobIds"],
                                    properties: { projectId: { type: "string" }, jobIds: { type: "array", items: { type: "string" } } }
                                }
                            }
                        ]
                    }
                });
            }
            const { name, arguments: args } = body.params;
            if (name === "opus_video_tools_whoami") return Response.json({ jsonrpc: "2.0", id: body.id, result: { structuredContent: { has_api_access: true } } });
            if (name === "create_project") return Response.json({ jsonrpc: "2.0", id: body.id, result: { structuredContent: { projectId: "proj_fast" } } });
            if (name === "import_assets") {
                seenImportUrl = args.assets[0].url;
                return Response.json({ jsonrpc: "2.0", id: body.id, result: { structuredContent: { assets: [{ assetId: "ast_fast", status: "ready" }] } } });
            }
            if (name === "generate_keyframes") return Response.json({ jsonrpc: "2.0", id: body.id, result: { structuredContent: { jobIds: ["job_fast"] } } });
            if (name === "get_status") return Response.json({ jsonrpc: "2.0", id: body.id, result: { structuredContent: { jobs: [{ jobId: "job_fast", status: "completed", downloadUrl: "https://cdn.opus.pro/out/fast.jpg" }] } } });
        }
        throw new Error(`Unexpected fetch: ${url}`);
    });

    try {
        const res = await generateOpusSocialImage({
            env: { OPUS_AUTH_TOKEN: "tok-fast", OPUS_POLL_INTERVAL_MS: "5" },
            prompt: "Potret editorial cepat",
            referenceBytes: fakeLargeJpeg,
            referenceMimeType: "image/jpeg",
            personImageUrl: "https://project.supabase.co/storage/v1/object/sign/char-1200x1600.jpg"
        });
        assert.equal(seenImportUrl, "https://project.supabase.co/storage/v1/object/sign/char-1200x1600.jpg");
        assert.equal(res.width, 640);
    } finally {
        restore();
    }
});

test("readPngRgbaSync men-decode PNG memakai node:zlib inflateSync (aman di workerd) dan stripImageMetadata menerima Uint8Array zero-copy", async () => {
    const png = new PNG({ width: 274, height: 272 });
    for (let y = 0; y < png.height; y += 1) {
        for (let x = 0; x < png.width; x += 1) {
            const idx = (y * png.width + x) * 4;
            png.data[idx] = (x + y) & 255;
            png.data[idx + 1] = (x * 2) & 255;
            png.data[idx + 2] = (y * 2) & 255;
            png.data[idx + 3] = x < 20 ? 0 : 255;
        }
    }
    const rawPng = new Uint8Array(PNG.sync.write(png));
    const decoded = readPngRgbaSync(rawPng);
    assert.equal(decoded.width, 274);
    assert.equal(decoded.height, 272);
    assert.equal(decoded.data.length, 274 * 272 * 4);

    const normalized = normalizeReferenceImageBounds(rawPng, "image/png", {
        triggerMinSide: 300,
        minSide: 512,
        maxSide: 2048
    });
    assert.equal(normalized.resized, true);
    assert.ok(normalized.width >= 512 && normalized.height >= 512);

    const cleanedBlob = await stripImageMetadata(rawPng, "image/png");
    const cleanedBytes = new Uint8Array(await cleanedBlob.arrayBuffer());
    assert.ok(cleanedBytes.byteLength > 100);
});

test("generateSocialContextCaption melewati Array.from(imageBytes) pada gambar PNG besar (>750 KB) agar tidak memicu Error 1102", async () => {
    const hugePng = new Uint8Array(1_200_000);
    const seenCalls = [];
    const caption = await generateSocialContextCaption({
        env: {
            AI: {
                run: async (model, payload) => {
                    seenCalls.push({ model, hasImageArray: Array.isArray(payload?.image) });
                    return { response: "Hai guys, senang banget jalan sore hari ini!" };
                }
            }
        },
        imageBytes: hugePng,
        imageMimeType: "image/png",
        characterName: "BELA",
        scene: { location: "taman kota" },
        imageProvider: "opus",
        textProvider: "cloudflare"
    });
    assert.equal(seenCalls.length, 1);
    assert.equal(seenCalls[0].hasImageArray, false, "Tidak boleh membuat Array jutaan integer untuk gambar > 750 KB");
    assert.match(caption, /Hai guys/);
});
