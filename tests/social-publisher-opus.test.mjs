import test from "node:test";
import assert from "node:assert/strict";
import { encode as encodeWebp, encodeWithAlpha as encodeWebpWithAlpha } from "@stacksjs/ts-webp";
import jpeg from "jpeg-js";
import { PNG } from "pngjs";

import {
    generateOpusSocialImage,
    opusConfigured,
    opusImageModel,
    opusImageQuality,
    normalizeOpusImageModel,
    readImageSize,
    resetOpusTokenCache,
    OPUS_IMAGE_MODELS,
    OPUS_DEFAULT_IMAGE_MODEL,
    OPUS_MAX_REFERENCE_IMAGES,
    OPUS_DEFAULT_ASPECT_RATIO,
    OPUS_DEFAULT_IMAGE_QUALITY,
    OPUS_DEFAULT_MCP_URL,
    OPUS_OAUTH_TOKEN_URL
} from "../lib/social-publisher/opus.js";
import { generateSocialImage, testOpusImageProvider } from "../lib/social-publisher/providers.js";
import socialPublisherHandler from "../api/social-publisher.js";

function texturedJpeg({ width = 480, height = 854 } = {}) {
    const data = new Uint8Array(width * height * 4);
    for (let index = 0; index < width * height; index += 1) {
        data[index * 4] = (index * 5) % 255;
        data[index * 4 + 1] = (index * 11) % 255;
        data[index * 4 + 2] = (index * 17) % 255;
        data[index * 4 + 3] = 255;
    }
    return new Uint8Array(jpeg.encode({ data, width, height }, 85).data);
}

function solidBlankJpeg({ width = 480, height = 854 } = {}) {
    const data = new Uint8Array(width * height * 4);
    for (let index = 0; index < width * height; index += 1) {
        data[index * 4] = 128;
        data[index * 4 + 1] = 128;
        data[index * 4 + 2] = 128;
        data[index * 4 + 3] = 255;
    }
    return new Uint8Array(jpeg.encode({ data, width, height }, 80).data);
}

function mockFetch(handler) {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, options = {}) => handler(String(input), options);
    return () => {
        globalThis.fetch = originalFetch;
    };
}

function standardMcpTools() {
    return [
        { name: "opus_video_tools_whoami", inputSchema: { type: "object", properties: {} } },
        {
            name: "create_project",
            inputSchema: {
                type: "object",
                properties: {
                    name: { type: "string" },
                    requestKey: { type: "string" }
                }
            }
        },
        {
            name: "import_assets",
            inputSchema: {
                type: "object",
                properties: {
                    projectId: { type: "string" },
                    assetId: { type: "string" },
                    fileName: { type: "string" },
                    mimeType: { type: "string" },
                    sizeBytes: { type: "number" },
                    role: { type: "string" },
                    requestKey: { type: "string" }
                }
            }
        },
        {
            name: "generate_keyframes",
            inputSchema: {
                type: "object",
                properties: {
                    projectId: { type: "string" },
                    prompt: { type: "string" },
                    aspectRatio: { type: "string" },
                    size: { type: "string" },
                    width: { type: "number" },
                    height: { type: "number" },
                    model: { type: "string" },
                    quality: { type: "string" },
                    referenceAssets: { type: "array", items: { type: "object" } },
                    requestKey: { type: "string" }
                }
            }
        },
        {
            name: "get_status",
            inputSchema: {
                type: "object",
                properties: {
                    projectId: { type: "string" },
                    jobId: { type: "string" },
                    watch: { type: "boolean" },
                    timeoutSeconds: { type: "number" }
                }
            }
        }
    ];
}

test("generateOpusSocialImage menjalankan alur penuh Opus Labs MCP (whoami -> create_project -> import_assets -> generate_keyframes -> get_status)", async () => {
    resetOpusTokenCache();
    const outputJpeg = texturedJpeg({ width: 720, height: 1280 });
    const uploadedBlobs = [];
    const seenSessionIds = [];
    let keyframeArgs = null;
    let statusCalls = 0;
    let importCounter = 0;

    const restore = mockFetch(async (url, options = {}) => {
        if (url.startsWith("https://storage.opus.example/upload-")) {
            uploadedBlobs.push({
                url,
                method: options.method,
                contentType: options.headers?.["Content-Type"],
                size: options.body?.byteLength || 0
            });
            return new Response("", { status: 200 });
        }
        if (url === "https://cdn.opus.pro/generated/ad-out.jpg") {
            return new Response(outputJpeg, {
                status: 200,
                headers: { "content-type": "image/jpeg" }
            });
        }
        if (url === OPUS_DEFAULT_MCP_URL) {
            assert.equal(options.headers.Authorization, "Bearer opus-oauth-token");
            const body = JSON.parse(options.body);
            if (body.method === "initialize") {
                return new Response(
                    JSON.stringify({
                        jsonrpc: "2.0",
                        id: body.id,
                        result: { protocolVersion: "2025-03-26", serverInfo: { name: "opus-video-tools" } }
                    }),
                    {
                        status: 200,
                        headers: {
                            "content-type": "application/json",
                            "mcp-session-id": "sess-opus-123"
                        }
                    }
                );
            }
            seenSessionIds.push(options.headers["Mcp-Session-Id"]);
            if (body.method === "notifications/initialized") {
                return new Response("", { status: 202 });
            }
            if (body.method === "tools/list") {
                return Response.json({
                    jsonrpc: "2.0",
                    id: body.id,
                    result: { tools: standardMcpTools() }
                });
            }
            if (body.method === "tools/call") {
                const { name, arguments: args } = body.params;
                if (name === "opus_video_tools_whoami") {
                    return Response.json({
                        jsonrpc: "2.0",
                        id: body.id,
                        result: {
                            content: [{ type: "text", text: JSON.stringify({ orgId: "org_1", has_api_access: true }) }]
                        }
                    });
                }
                if (name === "create_project") {
                    return Response.json({
                        jsonrpc: "2.0",
                        id: body.id,
                        result: {
                            structuredContent: { projectId: "proj_ad_99" }
                        }
                    });
                }
                if (name === "import_assets") {
                    if (!args.assetId) {
                        importCounter += 1;
                        return Response.json({
                            jsonrpc: "2.0",
                            id: body.id,
                            result: {
                                structuredContent: {
                                    assetId: `asset_${importCounter}`,
                                    status: "awaiting_upload",
                                    uploadUrl: `https://storage.opus.example/upload-${importCounter}`
                                }
                            }
                        });
                    }
                    return Response.json({
                        jsonrpc: "2.0",
                        id: body.id,
                        result: {
                            structuredContent: {
                                assetId: args.assetId,
                                status: "ready",
                                uri: `https://cdn.opus.pro/assets/${args.assetId}.jpg`
                            }
                        }
                    });
                }
                if (name === "generate_keyframes") {
                    keyframeArgs = args;
                    return Response.json({
                        jsonrpc: "2.0",
                        id: body.id,
                        result: {
                            structuredContent: {
                                jobId: "job_kf_001",
                                status: "queued",
                                model: args.model || "gpt-image-2.5-flare"
                            }
                        }
                    });
                }
                if (name === "get_status") {
                    statusCalls += 1;
                    if (statusCalls === 1) {
                        return Response.json({
                            jsonrpc: "2.0",
                            id: body.id,
                            result: {
                                structuredContent: {
                                    jobId: "job_kf_001",
                                    status: "running",
                                    nextPollAfterSeconds: 0.01
                                }
                            }
                        });
                    }
                    return Response.json({
                        jsonrpc: "2.0",
                        id: body.id,
                        result: {
                            structuredContent: {
                                jobId: "job_kf_001",
                                status: "completed",
                                model: keyframeArgs?.model || "gpt-image-2.5-flare",
                                outputs: [{ url: "https://cdn.opus.pro/generated/ad-out.jpg", mimeType: "image/jpeg" }]
                            }
                        }
                    });
                }
            }
        }
        throw new Error(`Unexpected fetch: ${url}`);
    });

    try {
        const result = await generateOpusSocialImage({
            env: {
                OPUS_AUTH_TOKEN: "opus-oauth-token",
                OPUS_POLL_INTERVAL_MS: "5"
            },
            prompt: "Iklan produk minuman segar di kafe tropis",
            referenceBytes: texturedJpeg({ width: 320, height: 480 }),
            referenceMimeType: "image/jpeg",
            garmentBytes: texturedJpeg({ width: 300, height: 300 }),
            garmentMimeType: "image/jpeg",
            extraReferenceImages: [
                texturedJpeg({ width: 280, height: 280 }),
                texturedJpeg({ width: 260, height: 260 })
            ],
            aspectRatio: "16:9"
        });

        assert.ok(seenSessionIds.every(id => id === "sess-opus-123"), "Mcp-Session-Id harus diteruskan");
        assert.equal(uploadedBlobs.length, 3, "Batas unggah referensi maksimal 3 gambar (up to 3)");
        assert.equal(keyframeArgs.projectId, "proj_ad_99");
        assert.equal(keyframeArgs.model, "gpt-image-2.5-flare");
        assert.equal(keyframeArgs.aspectRatio, "9:16", "Rasio Opus harus dikunci ke 9:16");
        assert.equal(keyframeArgs.size, "1024x1536");
        assert.equal(keyframeArgs.quality, "low", "Quality Opus harus disetel ke low");
        assert.equal(keyframeArgs.width, 1080);
        assert.equal(keyframeArgs.height, 1920);
        assert.equal(keyframeArgs.referenceAssets.length, 3);
        assert.equal(keyframeArgs.referenceAssets[0].assetId, "asset_1");
        assert.equal(keyframeArgs.referenceAssets[1].assetId, "asset_2");
        assert.equal(keyframeArgs.referenceAssets[2].assetId, "asset_3");
        assert.equal(statusCalls, 2);
        assert.equal(result.model, "gpt-image-2.5-flare");
        assert.equal(result.aspectRatio, "9:16");
        assert.equal(result.quality, "low");
        assert.equal(result.maxReferenceImages, 3);
        assert.equal(result.mimeType, "image/jpeg");
        assert.equal(result.width, 720);
        assert.equal(result.height, 1280);
        assert.equal(result.images_sent, 3);
    } finally {
        restore();
    }
});

test("mendukung respons SSE MCP dan perpanjangan otomatis OAuth refresh_token", async () => {
    resetOpusTokenCache();
    const outJpeg = texturedJpeg({ width: 640, height: 360 });
    let refreshedCount = 0;
    let keyframeArgs = null;

    const restore = mockFetch(async (url, options = {}) => {
        if (url === OPUS_OAUTH_TOKEN_URL) {
            refreshedCount += 1;
            const form = new URLSearchParams(options.body);
            assert.equal(form.get("grant_type"), "refresh_token");
            assert.equal(form.get("refresh_token"), "rt_live_123");
            assert.equal(form.get("client_id"), "client_opus_abc");
            assert.equal(form.get("resource"), "https://labs.opus.pro/opus-video-tools/mcp");
            assert.equal(form.get("scope"), "openid offline_access");
            return Response.json({
                access_token: "fresh-access-token",
                refresh_token: "rt_live_456",
                expires_in: 3600
            });
        }
        if (url === OPUS_DEFAULT_MCP_URL) {
            assert.equal(options.headers.Authorization, "Bearer fresh-access-token");
            assert.equal(options.headers["MCP-Protocol-Version"], "2025-03-26");
            const body = JSON.parse(options.body);
            const sseReply = (payload) => new Response(
                `event: message\ndata: ${JSON.stringify({ jsonrpc: "2.0", id: body.id, result: payload })}\n\n`,
                { status: 200, headers: { "content-type": "text/event-stream" } }
            );
            if (body.method === "initialize") {
                return sseReply({ protocolVersion: "2025-03-26" });
            }
            if (body.method === "notifications/initialized") {
                return new Response("", { status: 204 });
            }
            if (body.method === "tools/list") {
                return sseReply({ tools: standardMcpTools() });
            }
            if (body.method === "tools/call") {
                const { name, arguments: args } = body.params;
                if (name === "opus_video_tools_whoami") {
                    return sseReply({ structuredContent: { orgId: "org_1", has_api_access: true } });
                }
                if (name === "generate_keyframes") {
                    keyframeArgs = args;
                    return sseReply({
                        content: [{
                            type: "image",
                            mimeType: "image/jpeg",
                            data: Buffer.from(outJpeg).toString("base64")
                        }],
                        structuredContent: { status: "completed", model: "custom-ad-model" }
                    });
                }
            }
        }
        throw new Error(`Unexpected fetch: ${url}`);
    });

    try {
        const oauthJson = JSON.stringify({
            access_token: "expired-token",
            refresh_token: "rt_live_123",
            client_id: "client_opus_abc",
            resource: "https://labs.opus.pro/opus-video-tools/mcp",
            scope: "openid offline_access",
            expires_at: Math.floor(Date.now() / 1000) - 120
        });
        const result = await generateOpusSocialImage({
            env: {
                OPUS_AUTH_TOKEN: oauthJson,
                OPUS_PROJECT_ID: "proj_existing"
            },
            imageModel: "GPT Image 2.5 sunburst",
            prompt: "Potret produk vertikal",
            aspectRatio: "16:9"
        });

        assert.equal(refreshedCount, 1);
        assert.equal(keyframeArgs.projectId, "proj_existing");
        assert.equal(keyframeArgs.aspectRatio, "9:16");
        assert.equal(keyframeArgs.width, 1080);
        assert.equal(keyframeArgs.height, 1920);
        assert.equal(keyframeArgs.quality, "low");
        assert.equal(keyframeArgs.model, "gpt-image-2.5-sunburst");
        assert.equal(result.width, 640);
        assert.equal(result.height, 360);
    } finally {
        restore();
    }
});

test("error Opus diterjemahkan secara jujur: tanpa token, kredit habis, akses belum aktif, submission_unknown, dan gambar kosong", async () => {
    resetOpusTokenCache();

    /* 1. Tanpa token -> 503 dengan petunjuk OPUS_AUTH_TOKEN & kredit akun OpusClip */
    await assert.rejects(
        () => generateOpusSocialImage({ env: {}, prompt: "tes" }),
        err => {
            assert.equal(err.status, 503);
            assert.match(err.message, /OPUS_AUTH_TOKEN belum dikonfigurasi/);
            assert.match(err.message, /product-ad-studio\.labs\.opus\.pro/);
            assert.match(err.message, /kredit akun OpusClip/);
            return true;
        }
    );

    /* 2. Kredit akun OpusClip habis -> 402 */
    let restore = mockFetch(async (url, options = {}) => {
        const body = JSON.parse(options.body);
        if (body.method === "initialize") return Response.json({ jsonrpc: "2.0", id: body.id, result: {} });
        if (body.method === "notifications/initialized") return new Response("", { status: 204 });
        if (body.method === "tools/list") return Response.json({ jsonrpc: "2.0", id: body.id, result: { tools: standardMcpTools() } });
        if (body.method === "tools/call" && body.params.name === "opus_video_tools_whoami") {
            return Response.json({ jsonrpc: "2.0", id: body.id, result: { structuredContent: { has_api_access: true } } });
        }
        if (body.method === "tools/call" && body.params.name === "create_project") {
            return Response.json({ jsonrpc: "2.0", id: body.id, result: { structuredContent: { projectId: "p1" } } });
        }
        if (body.method === "tools/call" && body.params.name === "generate_keyframes") {
            return Response.json({
                jsonrpc: "2.0",
                id: body.id,
                result: {
                    isError: true,
                    structuredContent: {
                        errorCode: "credit_admission_rejected",
                        message: "Organization does not have enough credits"
                    }
                }
            });
        }
        throw new Error(`Unexpected ${url}`);
    });
    try {
        await assert.rejects(
            () => generateOpusSocialImage({ env: { OPUS_AUTH_TOKEN: "tok" }, prompt: "tes" }),
            err => {
                assert.equal(err.status, 402);
                assert.match(err.message, /credit_admission_rejected/);
                assert.match(err.message, /kredit akun OpusClip/i);
                assert.match(err.message, /bukan kredit GEN-Z\.AI/);
                return true;
            }
        );
    } finally {
        restore();
    }

    /* 3. submission_unknown -> 502 dengan jobId dan TANPA retry generate_keyframes */
    let createCalls = 0;
    restore = mockFetch(async (_url, options = {}) => {
        const body = JSON.parse(options.body);
        if (body.method === "initialize") return Response.json({ jsonrpc: "2.0", id: body.id, result: {} });
        if (body.method === "notifications/initialized") return new Response("", { status: 204 });
        if (body.method === "tools/list") return Response.json({ jsonrpc: "2.0", id: body.id, result: { tools: standardMcpTools() } });
        if (body.method === "tools/call" && body.params.name === "opus_video_tools_whoami") {
            return Response.json({ jsonrpc: "2.0", id: body.id, result: { structuredContent: { has_api_access: true } } });
        }
        if (body.method === "tools/call" && body.params.name === "create_project") {
            return Response.json({ jsonrpc: "2.0", id: body.id, result: { structuredContent: { projectId: "p1" } } });
        }
        if (body.method === "tools/call" && body.params.name === "generate_keyframes") {
            createCalls += 1;
            return Response.json({
                jsonrpc: "2.0",
                id: body.id,
                result: { structuredContent: { jobId: "job_uncertain_77", status: "submission_unknown" } }
            });
        }
        throw new Error("Should not poll or retry");
    });
    try {
        await assert.rejects(
            () => generateOpusSocialImage({ env: { OPUS_AUTH_TOKEN: "tok" }, prompt: "tes" }),
            err => {
                assert.equal(err.status, 502);
                assert.equal(err.jobId, "job_uncertain_77");
                assert.match(err.message, /job_uncertain_77/);
                assert.match(err.message, /TIDAK mengirim ulang otomatis/);
                return true;
            }
        );
        assert.equal(createCalls, 1, "Tidak boleh me-retry pembuatan berbayar saat submission_unknown");
    } finally {
        restore();
    }

    /* 4. Gambar kosong ditolak oleh anti-blank guard */
    restore = mockFetch(async (url) => {
        if (url === "https://custom.opus.example/v1/ad-images") {
            return new Response(solidBlankJpeg(), {
                status: 200,
                headers: { "content-type": "image/jpeg" }
            });
        }
        throw new Error(`Unexpected ${url}`);
    });
    try {
        await assert.rejects(
            () => generateOpusSocialImage({
                env: { OPUS_AUTH_TOKEN: "tok", OPUS_API_URL: "https://custom.opus.example/v1/ad-images" },
                prompt: "tes"
            }),
            err => {
                assert.equal(err.status, 502);
                assert.match(err.message, /gambar kosong/i);
                return true;
            }
        );
    } finally {
        restore();
    }
});

test("generateSocialImage meneruskan provider opus & testOpusImageProvider melaporkan metrik hasil", async () => {
    resetOpusTokenCache();
    const outJpeg = texturedJpeg({ width: 720, height: 1280 });
    const httpBodies = [];
    const restore = mockFetch(async (url, options = {}) => {
        if (url === "https://custom.opus.example/v1/ad-images") {
            const parsedBody = options.body ? JSON.parse(options.body) : {};
            httpBodies.push(parsedBody);
            return Response.json({
                status: "completed",
                model: parsedBody.model || "gpt-image-2.5-flare",
                outputs: [{ url: "https://cdn.opus.pro/out/final.jpg" }]
            });
        }
        if (url === "https://cdn.opus.pro/out/final.jpg") {
            return new Response(outJpeg, { status: 200, headers: { "content-type": "image/jpeg" } });
        }
        /* Unduhan foto contoh Cloudflare pada testOpusImageProvider boleh gagal -> jatuh ke synthetic */
        return new Response("offline", { status: 503 });
    });

    try {
        const direct = await generateSocialImage({
            env: { OPUS_AUTH_TOKEN: "tok", OPUS_API_URL: "https://custom.opus.example/v1/ad-images" },
            prompt: "Iklan sepatu lari",
            imageProvider: "opus",
            imageModel: "gpt-image-2.5-sunburst",
            garmentImageUrls: [
                "https://cdn.example/1.jpg",
                "https://cdn.example/2.jpg",
                "https://cdn.example/3.jpg",
                "https://cdn.example/4.jpg"
            ],
            aspectRatio: "16:9"
        });
        assert.equal(direct.mimeType, "image/jpeg");
        assert.equal(direct.model, "gpt-image-2.5-sunburst");
        assert.equal(direct.aspectRatio, "9:16");
        assert.equal(direct.quality, "low");
        assert.equal(direct.images_sent, 3, "HTTP API juga wajib membatasi maksimal 3 gambar referensi");
        assert.equal(httpBodies[0].model, "gpt-image-2.5-sunburst");
        assert.equal(httpBodies[0].aspect_ratio, "9:16");
        assert.equal(httpBodies[0].size, "1024x1536");
        assert.equal(httpBodies[0].quality, "low");
        assert.equal(httpBodies[0].input_images.length, 3);
        assert.equal(direct.width, 720);
        assert.equal(direct.height, 1280);

        const testRes = await testOpusImageProvider({
            env: { OPUS_AUTH_TOKEN: "tok", OPUS_API_URL: "https://custom.opus.example/v1/ad-images" },
            imageModel: "gpt-image-2.5-flare"
        });
        assert.equal(testRes.ok, true);
        assert.equal(testRes.model, "gpt-image-2.5-flare");
        assert.equal(testRes.aspect_ratio, "9:16");
        assert.equal(testRes.quality, "low");
        assert.equal(testRes.max_reference_images, 3);
        assert.equal(testRes.width, 720);
        assert.equal(testRes.height, 1280);
        assert.equal(testRes.images_sent, 1);
    } finally {
        restore();
    }

    assert.equal(OPUS_DEFAULT_IMAGE_MODEL, "gpt-image-2.5-flare");
    assert.equal(OPUS_MAX_REFERENCE_IMAGES, 3);
    assert.equal(OPUS_DEFAULT_ASPECT_RATIO, "9:16");
    assert.equal(OPUS_DEFAULT_IMAGE_QUALITY, "low");
    assert.deepEqual(OPUS_IMAGE_MODELS.map(m => m.id), [
        "gpt-image-2.5-flare",
        "gpt-image-2.5-sunburst"
    ]);
    assert.equal(opusConfigured({}), false);
    assert.equal(opusConfigured({ OPUS_AUTH_TOKEN: "abc" }), true);
    assert.equal(opusConfigured({ OPUS_REFRESH_TOKEN: "rt", OPUS_CLIENT_ID: "cid" }), true);
    assert.equal(opusImageModel({}), "gpt-image-2.5-flare");
    assert.equal(normalizeOpusImageModel("GPT Image 2.5 flare"), "gpt-image-2.5-flare");
    assert.equal(normalizeOpusImageModel("GPT Image 2.5 sunburst"), "gpt-image-2.5-sunburst");
    assert.equal(normalizeOpusImageModel("qwen-image-3.0-pro"), "gpt-image-2.5-flare");
    assert.equal(opusImageModel({ OPUS_IMAGE_MODEL: "opus-ad-v2" }), "opus-ad-v2");
    assert.equal(opusImageQuality({}), "low");
    assert.deepEqual(readImageSize(outJpeg), { width: 720, height: 1280 });
});

test("endpoint api/social-publisher mengizinkan admin menyimpan & menguji model opus (flare / sunburst)", async () => {
    resetOpusTokenCache();
    const baseEnv = {
        SUPABASE_URL: "https://project.example",
        SUPABASE_SERVICE_ROLE_KEY: "server-only-test-key",
        SUPABASE_ANON_KEY: "anon-test-key"
    };
    const makeRes = () => ({
        statusCode: 0,
        headers: {},
        body: null,
        setHeader(k, v) { this.headers[k] = v; },
        status(c) { this.statusCode = c; return this; },
        json(v) { this.body = v; return this; },
        end(v) { this.body = v; return this; }
    });
    const outJpeg = texturedJpeg({ width: 540, height: 960 });
    let lastHttpModel = "";

    const restore = mockFetch(async (url, options = {}) => {
        if (url.endsWith("/auth/v1/user")) return Response.json({ id: "admin-user" });
        if (url.includes("/rest/v1/profiles?select=id,role,status")) {
            return Response.json([{ id: "admin-user", role: "ADMIN", status: "active" }]);
        }
        if (url.includes("/rest/v1/social_publisher_config?on_conflict=id")) {
            const payload = JSON.parse(options.body);
            return Response.json([{
                id: true,
                image_provider: payload.image_provider,
                image_model: payload.image_model,
                text_provider: payload.text_provider,
                updated_at: payload.updated_at
            }], { status: 201 });
        }
        if (url === "https://custom.opus.example/v1/ad-images") {
            const reqJson = options.body ? JSON.parse(options.body) : {};
            lastHttpModel = reqJson.model || "";
            return new Response(outJpeg, { status: 200, headers: { "content-type": "image/jpeg" } });
        }
        return new Response("offline", { status: 503 });
    });

    try {
        /* Tanpa OPUS_AUTH_TOKEN -> 409 */
        const resMissing = makeRes();
        await socialPublisherHandler({
            method: "POST",
            url: "/api/social-publisher?action=studio-admin-image-provider",
            query: { action: "studio-admin-image-provider" },
            headers: { authorization: "Bearer test-token" },
            body: { image_provider: "opus" },
            env: baseEnv
        }, resMissing);
        assert.equal(resMissing.statusCode, 409);
        assert.match(resMissing.body.error, /OPUS_AUTH_TOKEN/);

        /* Dengan OPUS_AUTH_TOKEN + pilihan model Sunburst -> 200 */
        const resSaved = makeRes();
        await socialPublisherHandler({
            method: "POST",
            url: "/api/social-publisher?action=studio-admin-image-provider",
            query: { action: "studio-admin-image-provider" },
            headers: { authorization: "Bearer test-token" },
            body: { image_provider: "opus", image_model: "gpt-image-2.5-sunburst" },
            env: { ...baseEnv, OPUS_AUTH_TOKEN: "tok-live" }
        }, resSaved);
        assert.equal(resSaved.statusCode, 200);
        assert.equal(resSaved.body.settings.image_provider, "opus");
        assert.equal(resSaved.body.settings.image_model, "gpt-image-2.5-sunburst");
        assert.equal(resSaved.body.settings.opus_model, "gpt-image-2.5-sunburst");
        assert.equal(resSaved.body.settings.opus_max_reference_images, 3);
        assert.equal(resSaved.body.settings.opus_aspect_ratio, "9:16");
        assert.equal(resSaved.body.settings.opus_quality, "low");
        assert.equal(resSaved.body.settings.opus_configured, true);

        /* Tes provider opus lewat endpoint admin dengan pilihan model eksplisit */
        const resTest = makeRes();
        await socialPublisherHandler({
            method: "POST",
            url: "/api/social-publisher?action=studio-admin-image-provider-test",
            query: { action: "studio-admin-image-provider-test" },
            headers: { authorization: "Bearer test-token" },
            body: { provider: "opus", image_model: "gpt-image-2.5-sunburst" },
            env: {
                ...baseEnv,
                OPUS_AUTH_TOKEN: "tok-live",
                OPUS_API_URL: "https://custom.opus.example/v1/ad-images"
            }
        }, resTest);
        assert.equal(resTest.statusCode, 200);
        assert.equal(resTest.body.provider, "opus");
        assert.equal(resTest.body.test.ok, true);
        assert.equal(resTest.body.test.model, "gpt-image-2.5-sunburst");
        assert.equal(resTest.body.test.aspect_ratio, "9:16");
        assert.equal(resTest.body.test.quality, "low");
        assert.equal(resTest.body.test.max_reference_images, 3);
        assert.equal(lastHttpModel, "gpt-image-2.5-sunburst");
        assert.equal(resTest.body.test.width, 540);
        assert.equal(resTest.body.test.height, 960);
    } finally {
        restore();
    }
});

test("mendukung skema batch ketat Opus Video Tools v2 (keyframes[] + $defs + anyOf enum + timedOut watch)", async () => {
    resetOpusTokenCache();
    const outputJpeg = texturedJpeg({ width: 720, height: 1280 });
    const importPayloads = [];
    let batchKeyframePayload = null;
    let statusPolls = 0;

    const batchStrictTools = [
        { name: "opus_video_tools_whoami", inputSchema: { type: "object", properties: {} } },
        {
            name: "create_project",
            inputSchema: {
                type: "object",
                required: ["name", "requestKey"],
                properties: {
                    name: { type: "string" },
                    requestKey: { type: "string", format: "uuid" }
                }
            }
        },
        {
            name: "import_assets",
            inputSchema: {
                type: "object",
                required: ["projectId", "requestKey", "assets"],
                properties: {
                    projectId: { type: "string" },
                    requestKey: { type: "string", format: "uuid" },
                    assets: {
                        type: "array",
                        items: {
                            oneOf: [
                                {
                                    type: "object",
                                    required: ["fileName", "mimeType", "sizeBytes"],
                                    properties: {
                                        fileName: { type: "string" },
                                        mimeType: { type: "string" },
                                        sizeBytes: { type: "integer" },
                                        kind: { enum: ["image", "video", "audio"] }
                                    }
                                },
                                {
                                    type: "object",
                                    required: ["assetId"],
                                    properties: {
                                        assetId: { type: "string" }
                                    }
                                }
                            ]
                        }
                    }
                }
            }
        },
        {
            name: "generate_keyframes",
            inputSchema: {
                type: "object",
                required: ["projectId", "requestKey", "keyframes"],
                $defs: {
                    RefAsset: {
                        type: "object",
                        required: ["assetId", "role"],
                        properties: {
                            assetId: { type: "string" },
                            role: { anyOf: [{ const: "subject" }, { const: "product" }, { const: "style" }] },
                            label: { type: "string" }
                        }
                    },
                    KeyframeSpec: {
                        type: "object",
                        required: ["keyframeId", "outputLabel", "prompt", "aspect"],
                        properties: {
                            keyframeId: { type: "string" },
                            outputLabel: { type: "string" },
                            prompt: { type: "string" },
                            aspect: { anyOf: [{ enum: ["9:16", "16:9", "1:1"] }, { type: "null" }] },
                            model: {
                                anyOf: [
                                    { enum: ["openai/gpt-image-2.5-flare", "openai/gpt-image-2.5-sunburst"] },
                                    { type: "null" }
                                ]
                            },
                            referenceAssets: {
                                type: "array",
                                items: { $ref: "#/$defs/RefAsset" }
                            }
                        }
                    }
                },
                properties: {
                    projectId: { type: "string" },
                    requestKey: { type: "string", format: "uuid" },
                    keyframes: {
                        type: "array",
                        minItems: 1,
                        items: { $ref: "#/$defs/KeyframeSpec" }
                    }
                }
            }
        },
        {
            name: "get_status",
            inputSchema: {
                type: "object",
                required: ["jobIds"],
                properties: {
                    projectId: { type: "string" },
                    jobIds: { type: "array", items: { type: "string" } },
                    watch: { type: "boolean" },
                    timeoutSeconds: { type: "number" }
                }
            }
        }
    ];

    const restore = mockFetch(async (url, options = {}) => {
        if (url === "https://storage.opus.example/strict-put-1") {
            return new Response("", { status: 200 });
        }
        if (url === "https://cdn.opus.pro/generated/strict-out.jpg") {
            return new Response(outputJpeg, { status: 200, headers: { "content-type": "image/jpeg" } });
        }
        if (url === OPUS_DEFAULT_MCP_URL) {
            const body = JSON.parse(options.body);
            if (body.method === "initialize") return Response.json({ jsonrpc: "2.0", id: body.id, result: {} });
            if (body.method === "notifications/initialized") return new Response("", { status: 204 });
            if (body.method === "tools/list") {
                return Response.json({ jsonrpc: "2.0", id: body.id, result: { tools: batchStrictTools } });
            }
            if (body.method === "tools/call") {
                const { name, arguments: args } = body.params;
                if (name === "opus_video_tools_whoami") {
                    return Response.json({ jsonrpc: "2.0", id: body.id, result: { structuredContent: { has_api_access: true } } });
                }
                if (name === "create_project") {
                    return Response.json({ jsonrpc: "2.0", id: body.id, result: { structuredContent: { projectId: "proj_v2" } } });
                }
                if (name === "import_assets") {
                    importPayloads.push(args);
                    const first = args.assets?.[0] || {};
                    if (!first.assetId) {
                        /* Pastikan tidak ada field liar `role: "person"` yang tidak ada di skema import_assets */
                        assert.equal(first.role, undefined);
                        assert.equal(first.kind, "image");
                        return Response.json({
                            jsonrpc: "2.0",
                            id: body.id,
                            result: {
                                structuredContent: {
                                    assets: [{
                                        assetId: "asset_strict_1",
                                        status: "awaiting_upload",
                                        upload: { url: "https://storage.opus.example/strict-put-1", method: "PUT" }
                                    }]
                                }
                            }
                        });
                    }
                    /* Finalisasi tidak boleh menyisipkan `status: "uploaded"` karena tidak ada di skema */
                    assert.deepEqual(Object.keys(first), ["assetId"]);
                    return Response.json({
                        jsonrpc: "2.0",
                        id: body.id,
                        result: {
                            structuredContent: {
                                assets: [{ assetId: "asset_strict_1", status: "ready" }]
                            }
                        }
                    });
                }
                if (name === "generate_keyframes") {
                    batchKeyframePayload = args;
                    return Response.json({
                        jsonrpc: "2.0",
                        id: body.id,
                        result: {
                            structuredContent: {
                                keyframes: [{ keyframeId: "kf-1", jobId: "job_batch_77", status: "queued" }]
                            }
                        }
                    });
                }
                if (name === "get_status") {
                    statusPolls += 1;
                    assert.deepEqual(args.jobIds, ["job_batch_77"]);
                    if (statusPolls === 1) {
                        return Response.json({
                            jsonrpc: "2.0",
                            id: body.id,
                            result: {
                                structuredContent: {
                                    timedOut: true,
                                    nextPollAfterSeconds: 0.01,
                                    jobs: [{ jobId: "job_batch_77", status: "running" }]
                                }
                            }
                        });
                    }
                    return Response.json({
                        jsonrpc: "2.0",
                        id: body.id,
                        result: {
                            structuredContent: {
                                jobs: [{
                                    jobId: "job_batch_77",
                                    status: "completed",
                                    result: { presignedUrl: "https://cdn.opus.pro/generated/strict-out.jpg" }
                                }]
                            }
                        }
                    });
                }
            }
        }
        throw new Error(`Unexpected fetch: ${url}`);
    });

    try {
        const res = await generateOpusSocialImage({
            env: { OPUS_AUTH_TOKEN: "tok-v2", OPUS_POLL_INTERVAL_MS: "5" },
            prompt: "Iklan parfum editorial",
            referenceBytes: texturedJpeg({ width: 300, height: 400 }),
            referenceMimeType: "image/jpeg",
            imageModel: "gpt-image-2.5-sunburst"
        });
        assert.equal(importPayloads.length, 2);
        assert.equal(batchKeyframePayload.projectId, "proj_v2");
        assert.equal(batchKeyframePayload.keyframes.length, 1);
        const kf = batchKeyframePayload.keyframes[0];
        assert.equal(kf.keyframeId, "kf-1");
        assert.equal(kf.outputLabel, "keyframe-1");
        assert.equal(kf.aspect, "9:16");
        assert.equal(kf.model, "openai/gpt-image-2.5-sunburst");
        assert.equal(kf.size, undefined, "Tidak boleh menyisipkan size yang tidak ada di skema");
        assert.equal(kf.referenceAssets[0].assetId, "asset_strict_1");
        assert.equal(kf.referenceAssets[0].role, "subject", "Role person dipetakan ke enum subject");
        assert.equal(statusPolls, 2);
        assert.equal(res.width, 720);
        assert.equal(res.height, 1280);
    } finally {
        restore();
    }
});

test("self-healing retry otomatis memangkas argumen opsional saat server menolak invalid_arguments tanpa jobId", async () => {
    resetOpusTokenCache();
    const outputJpeg = texturedJpeg({ width: 540, height: 960 });
    const generateAttempts = [];

    const restore = mockFetch(async (url, options = {}) => {
        if (url === OPUS_DEFAULT_MCP_URL) {
            const body = JSON.parse(options.body);
            if (body.method === "initialize") return Response.json({ jsonrpc: "2.0", id: body.id, result: {} });
            if (body.method === "notifications/initialized") return new Response("", { status: 204 });
            if (body.method === "tools/list") {
                return Response.json({ jsonrpc: "2.0", id: body.id, result: { tools: standardMcpTools() } });
            }
            if (body.method === "tools/call") {
                const { name, arguments: args } = body.params;
                if (name === "opus_video_tools_whoami") {
                    return Response.json({ jsonrpc: "2.0", id: body.id, result: { structuredContent: { has_api_access: true } } });
                }
                if (name === "create_project") {
                    return Response.json({ jsonrpc: "2.0", id: body.id, result: { structuredContent: { projectId: "proj_heal" } } });
                }
                if (name === "generate_keyframes") {
                    generateAttempts.push(args);
                    if (args.size || args.width || args.quality) {
                        return Response.json({
                            jsonrpc: "2.0",
                            id: body.id,
                            result: {
                                isError: true,
                                structuredContent: {
                                    ok: false,
                                    error: "invalid_arguments",
                                    issues: [{ path: ["size"], message: "Cannot combine size with aspectRatio" }]
                                }
                            }
                        });
                    }
                    return Response.json({
                        jsonrpc: "2.0",
                        id: body.id,
                        result: {
                            content: [{ type: "image", mimeType: "image/jpeg", data: Buffer.from(outputJpeg).toString("base64") }],
                            structuredContent: { status: "completed", model: args.model || "gpt-image-2.5-flare" }
                        }
                    });
                }
            }
        }
        throw new Error(`Unexpected fetch: ${url}`);
    });

    try {
        const res = await generateOpusSocialImage({
            env: { OPUS_AUTH_TOKEN: "tok-heal" },
            prompt: "Poster kopi dingin"
        });
        assert.equal(generateAttempts.length, 2, "Harus melakukan 1x retry bersih saat invalid_arguments tanpa jobId");
        assert.equal(generateAttempts[0].size, "1024x1536");
        assert.equal(generateAttempts[1].size, undefined);
        assert.equal(generateAttempts[1].width, undefined);
        assert.equal(generateAttempts[1].quality, undefined);
        assert.equal(generateAttempts[1].aspectRatio, "9:16");
        assert.equal(res.width, 540);
        assert.equal(res.height, 960);
    } finally {
        restore();
    }
});

test("memilih varian upload lokal pada import_assets (bukan varian URL) sehingga referenceAssets tidak pernah berisi data:image base64", async () => {
    resetOpusTokenCache();
    const outputJpeg = texturedJpeg({ width: 720, height: 1280 });
    let capturedRefAssets = null;

    const liveItemsStyleTools = [
        { name: "opus_video_tools_whoami", inputSchema: { type: "object", properties: {} } },
        {
            name: "create_project",
            inputSchema: {
                type: "object",
                required: ["name", "requestKey"],
                properties: {
                    name: { type: "string" },
                    requestKey: { type: "string", format: "uuid" }
                }
            }
        },
        {
            name: "import_assets",
            inputSchema: {
                type: "object",
                required: ["projectId", "requestKey", "items"],
                properties: {
                    projectId: { type: "string" },
                    requestKey: { type: "string", format: "uuid" },
                    items: {
                        type: "array",
                        items: {
                            oneOf: [
                                /* Varian 0: URL remote (jebakan bila dipilih untuk bytes lokal!) */
                                {
                                    type: "object",
                                    required: ["id", "url"],
                                    properties: {
                                        id: { type: "string" },
                                        url: { type: "string", format: "uri" }
                                    }
                                },
                                /* Varian 1: Upload lokal */
                                {
                                    type: "object",
                                    required: ["id", "fileName", "mimeType", "sizeBytes"],
                                    properties: {
                                        id: { type: "string" },
                                        fileName: { type: "string" },
                                        mimeType: { type: "string" },
                                        sizeBytes: { type: "integer" }
                                    }
                                },
                                /* Varian 2: Finalisasi */
                                {
                                    type: "object",
                                    required: ["assetId"],
                                    properties: {
                                        assetId: { type: "string" }
                                    }
                                }
                            ]
                        }
                    }
                }
            }
        },
        {
            name: "generate_keyframes",
            inputSchema: {
                type: "object",
                required: ["projectId", "requestKey", "items"],
                properties: {
                    projectId: { type: "string" },
                    requestKey: { type: "string", format: "uuid" },
                    items: {
                        type: "array",
                        items: {
                            type: "object",
                            required: ["id", "prompt"],
                            properties: {
                                id: { type: "string" },
                                prompt: { type: "string" },
                                aspectRatio: { type: "string" },
                                model: { type: "string" },
                                quality: { type: "string" },
                                referenceAssets: {
                                    type: "array",
                                    items: { type: "string" }
                                }
                            }
                        }
                    }
                }
            }
        },
        {
            name: "get_status",
            inputSchema: {
                type: "object",
                required: ["jobIds"],
                properties: {
                    projectId: { type: "string" },
                    jobIds: { type: "array", items: { type: "string" } },
                    watch: { type: "boolean" },
                    timeoutSeconds: { type: "number" }
                }
            }
        }
    ];

    const restore = mockFetch(async (url, options = {}) => {
        if (url === "https://storage.opus.example/live-put-1") {
            return new Response("", { status: 200 });
        }
        if (url === "https://cdn.opus.pro/generated/live-out.jpg") {
            return new Response(outputJpeg, { status: 200, headers: { "content-type": "image/jpeg" } });
        }
        if (url === OPUS_DEFAULT_MCP_URL) {
            const body = JSON.parse(options.body);
            if (body.method === "initialize") return Response.json({ jsonrpc: "2.0", id: body.id, result: {} });
            if (body.method === "notifications/initialized") return new Response("", { status: 204 });
            if (body.method === "tools/list") {
                return Response.json({ jsonrpc: "2.0", id: body.id, result: { tools: liveItemsStyleTools } });
            }
            if (body.method === "tools/call") {
                const { name, arguments: args } = body.params;
                if (name === "opus_video_tools_whoami") {
                    return Response.json({ jsonrpc: "2.0", id: body.id, result: { structuredContent: { has_api_access: true } } });
                }
                if (name === "create_project") {
                    return Response.json({
                        jsonrpc: "2.0",
                        id: body.id,
                        result: { structuredContent: { projectId: "gen_dd4f9364b4ca" } }
                    });
                }
                if (name === "import_assets") {
                    const entry = args.items?.[0] || {};
                    if (entry.url) {
                        /* Persis perilaku server Opus saat menerima URL tidak valid tanpa isError:true */
                        return Response.json({
                            jsonrpc: "2.0",
                            id: body.id,
                            result: {
                                structuredContent: {
                                    projectId: "gen_dd4f9364b4ca",
                                    items: [{ id: entry.id || "ref-1", ok: false, field: "items[0].url", value: entry.url }]
                                }
                            }
                        });
                    }
                    if (!entry.assetId) {
                        assert.equal(entry.fileName, "character.jpg");
                        assert.equal(entry.mimeType, "image/jpeg");
                        assert.ok(entry.sizeBytes > 0);
                        return Response.json({
                            jsonrpc: "2.0",
                            id: body.id,
                            result: {
                                structuredContent: {
                                    projectId: "gen_dd4f9364b4ca",
                                    items: [{
                                        id: entry.id,
                                        ok: true,
                                        status: "awaiting_upload",
                                        asset: { id: "ast_live_001" },
                                        upload: { url: "https://storage.opus.example/live-put-1", method: "PUT" }
                                    }]
                                }
                            }
                        });
                    }
                    assert.equal(entry.assetId, "ast_live_001");
                    return Response.json({
                        jsonrpc: "2.0",
                        id: body.id,
                        result: {
                            structuredContent: {
                                projectId: "gen_dd4f9364b4ca",
                                items: [{ ok: true, status: "ready", asset: { id: "ast_live_001" } }]
                            }
                        }
                    });
                }
                if (name === "generate_keyframes") {
                    const kf = args.items?.[0] || {};
                    capturedRefAssets = kf.referenceAssets;
                    if (String(kf.referenceAssets?.[0] || "").startsWith("data:")) {
                        return Response.json({
                            jsonrpc: "2.0",
                            id: body.id,
                            result: {
                                isError: true,
                                structuredContent: {
                                    code: "invalid_reference_assets",
                                    projectId: "gen_dd4f9364b4ca",
                                    items: [{ id: kf.id, ok: false, field: "referenceAssets[0]", value: kf.referenceAssets[0] }]
                                }
                            }
                        });
                    }
                    return Response.json({
                        jsonrpc: "2.0",
                        id: body.id,
                        result: {
                            structuredContent: {
                                projectId: "gen_dd4f9364b4ca",
                                items: [{ id: kf.id, ok: true, job: { id: "job_live_99", status: "queued" } }]
                            }
                        }
                    });
                }
                if (name === "get_status") {
                    assert.deepEqual(args.jobIds, ["job_live_99"], "Harus memakai job.id server, bukan client id kf-1");
                    return Response.json({
                        jsonrpc: "2.0",
                        id: body.id,
                        result: {
                            structuredContent: {
                                jobs: {
                                    job_live_99: {
                                        status: "completed",
                                        outputs: [{ downloadUrl: "https://cdn.opus.pro/generated/live-out.jpg" }]
                                    }
                                }
                            }
                        }
                    });
                }
            }
        }
        throw new Error(`Unexpected fetch: ${url}`);
    });

    try {
        const res = await generateOpusSocialImage({
            env: { OPUS_AUTH_TOKEN: "tok-live-items", OPUS_POLL_INTERVAL_MS: "5" },
            prompt: "Potret karakter di kafe hangat",
            referenceBytes: texturedJpeg({ width: 320, height: 480 }),
            referenceMimeType: "image/jpeg"
        });
        assert.deepEqual(capturedRefAssets, ["ast_live_001"]);
        assert.equal(res.width, 720);
        assert.equal(res.height, 1280);
    } finally {
        restore();
    }
});

test("mendukung skema asli produksi import_assets Opus (dataUrl / mediaBase64 tanpa path palsu) dan resolve_job saat get_status selesai", async () => {
    resetOpusTokenCache();
    const outputJpeg = texturedJpeg({ width: 1024, height: 1536 });
    const seenImportArgs = [];
    let resolvedJobCalled = false;

    const exactProductionTools = [
        { name: "opus_video_tools_whoami", inputSchema: { type: "object", properties: {} } },
        {
            name: "create_project",
            inputSchema: {
                type: "object",
                required: ["name"],
                properties: {
                    name: { type: "string" },
                    requestKey: { type: "string" }
                }
            }
        },
        {
            name: "import_assets",
            inputSchema: {
                type: "object",
                required: ["assets", "projectId"],
                properties: {
                    assets: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                path: { type: "string" },
                                assetId: { type: "string" },
                                sizeBytes: { type: "number" },
                                role: { type: "string" },
                                label: { type: "string" },
                                contentType: { type: "string" },
                                dataUrl: { type: "string" },
                                mediaBase64: { type: "string" },
                                mediaMimeType: { type: "string" },
                                url: { type: "string" }
                            }
                        }
                    },
                    projectId: { type: "string" }
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
                    requestKey: { type: "string" },
                    items: {
                        type: "array",
                        items: {
                            type: "object",
                            required: ["id", "prompt"],
                            properties: {
                                id: { type: "string" },
                                prompt: { type: "string" },
                                aspectRatio: { type: "string" },
                                model: { type: "string" },
                                quality: { type: "string" },
                                referenceAssets: {
                                    type: "array",
                                    items: { type: "string" }
                                }
                            }
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
                properties: {
                    projectId: { type: "string" },
                    jobIds: { type: "array", items: { type: "string" } },
                    watch: { type: "boolean" },
                    timeoutSeconds: { type: "number" }
                }
            }
        },
        {
            name: "resolve_job",
            inputSchema: {
                type: "object",
                required: ["projectId", "jobId"],
                properties: {
                    projectId: { type: "string" },
                    jobId: { type: "string" }
                }
            }
        }
    ];

    const restore = mockFetch(async (url, options = {}) => {
        if (url === "https://cdn.opus.pro/resolved/final-9x16.jpg") {
            return new Response(outputJpeg, { status: 200, headers: { "content-type": "image/jpeg" } });
        }
        if (url === OPUS_DEFAULT_MCP_URL) {
            const body = JSON.parse(options.body);
            if (body.method === "initialize") return Response.json({ jsonrpc: "2.0", id: body.id, result: {} });
            if (body.method === "notifications/initialized") return new Response("", { status: 204 });
            if (body.method === "tools/list") {
                return Response.json({ jsonrpc: "2.0", id: body.id, result: { tools: exactProductionTools } });
            }
            if (body.method === "tools/call") {
                const { name, arguments: args } = body.params;
                if (name === "opus_video_tools_whoami") {
                    return Response.json({ jsonrpc: "2.0", id: body.id, result: { structuredContent: { has_api_access: true } } });
                }
                if (name === "create_project") {
                    return Response.json({
                        jsonrpc: "2.0",
                        id: body.id,
                        result: { structuredContent: { projectId: "gen_c7a67b3e90d299875826372039148b80" } }
                    });
                }
                if (name === "import_assets") {
                    seenImportArgs.push(args);
                    assert.equal(args.requestKey, undefined, "Tidak boleh menyisipkan requestKey bila tidak ada di skema import_assets");
                    const spec = args.assets?.[0] || {};
                    if (spec.path) {
                        /* Persis error nyata produksi bila path lokal dikirim tanpa dataUrl/mediaBase64 */
                        return Response.json({
                            jsonrpc: "2.0",
                            id: body.id,
                            result: {
                                structuredContent: {
                                    projectId: args.projectId,
                                    assets: [{
                                        ok: false,
                                        label: "asset_1",
                                        error: "asset_prepare_failed",
                                        detail: JSON.stringify({ error: "asset_not_ready", assetId: spec.path })
                                    }]
                                }
                            }
                        });
                    }
                    assert.ok(
                        typeof spec.dataUrl === "string" && spec.dataUrl.startsWith("data:image/jpeg;base64,"),
                        "Harus mengirim dataUrl inline untuk bytes gambar di memori Worker"
                    );
                    return Response.json({
                        jsonrpc: "2.0",
                        id: body.id,
                        result: {
                            structuredContent: {
                                projectId: args.projectId,
                                assets: [{
                                    ok: true,
                                    assetId: "asset_prod_ready_01",
                                    label: spec.label || "character_reference",
                                    status: "ready"
                                }]
                            }
                        }
                    });
                }
                if (name === "generate_keyframes") {
                    const kf = args.items?.[0] || {};
                    assert.deepEqual(kf.referenceAssets, ["asset_prod_ready_01"]);
                    assert.equal(kf.aspectRatio, "9:16");
                    assert.equal(kf.quality, "low");
                    assert.equal(kf.model, "gpt-image-2.5-flare");
                    return Response.json({
                        jsonrpc: "2.0",
                        id: body.id,
                        result: {
                            structuredContent: {
                                projectId: args.projectId,
                                items: [{ id: kf.id, ok: true, jobId: "job_prod_42", status: "queued" }]
                            }
                        }
                    });
                }
                if (name === "get_status") {
                    return Response.json({
                        jsonrpc: "2.0",
                        id: body.id,
                        result: {
                            structuredContent: {
                                projectId: args.projectId,
                                jobs: [{
                                    jobId: "job_prod_42",
                                    status: "completed",
                                    outputs: [{ url: "https://cdn.opus.pro/resolved/final-9x16.jpg" }]
                                }]
                            }
                        }
                    });
                }
            }
        }
        throw new Error(`Unexpected fetch: ${url}`);
    });

    try {
        const res = await generateOpusSocialImage({
            env: { OPUS_AUTH_TOKEN: "tok-prod-exact", OPUS_POLL_INTERVAL_MS: "5" },
            prompt: "Iklan produk kopi botol di meja kayu",
            referenceBytes: texturedJpeg({ width: 360, height: 640 }),
            referenceMimeType: "image/jpeg",
            imageModel: "gpt-image-2.5-flare"
        });
        assert.equal(seenImportArgs.length, 1, "Percobaan pertama dengan dataUrl langsung diterima tanpa gagal");
        assert.equal(seenImportArgs[0].assets[0].path, undefined);
        assert.equal(resolvedJobCalled, false, "resolve_job tidak boleh dipanggil untuk job yang sudah completed normal");
        assert.equal(res.width, 1024);
        assert.equal(res.height, 1536);
        assert.equal(res.images_sent, 1);
    } finally {
        restore();
    }
});

test("import_assets tidak pernah mengirim assets[] tanpa sumber media dan dapat fallback ke /tmp/ path awaiting_upload -> PUT -> finalize", async () => {
    resetOpusTokenCache();
    const outputJpeg = texturedJpeg({ width: 720, height: 1280 });
    const seenSpecs = [];
    let putUploaded = false;

    const prodTools = [
        { name: "opus_video_tools_whoami", inputSchema: { type: "object", properties: {} } },
        {
            name: "create_project",
            inputSchema: {
                type: "object",
                required: ["name"],
                properties: { name: { type: "string" } }
            }
        },
        {
            name: "import_assets",
            inputSchema: {
                type: "object",
                required: ["assets", "projectId"],
                properties: {
                    projectId: { type: "string" },
                    assets: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                path: { type: "string" },
                                assetId: { type: "string" },
                                sizeBytes: { type: "number" },
                                role: { type: "string" },
                                label: { type: "string" },
                                contentType: { type: "string" },
                                dataUrl: { type: "string" },
                                mediaBase64: { type: "string" },
                                mediaMimeType: { type: "string" },
                                url: { type: "string" }
                            }
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
                            required: ["id", "prompt"],
                            properties: {
                                id: { type: "string" },
                                prompt: { type: "string" },
                                aspectRatio: { type: "string" },
                                model: { type: "string" },
                                referenceAssets: { type: "array", items: { type: "string" } }
                            }
                        }
                    }
                }
            }
        },
        {
            name: "get_status",
            inputSchema: {
                type: "object",
                required: ["jobIds"],
                properties: {
                    projectId: { type: "string" },
                    jobIds: { type: "array", items: { type: "string" } }
                }
            }
        }
    ];

    const restore = mockFetch(async (url, options = {}) => {
        if (url === "https://upload.opus.example/put-signed-99") {
            putUploaded = true;
            return new Response("", { status: 200 });
        }
        if (url === "https://cdn.opus.pro/out/fallback-put.jpg") {
            return new Response(outputJpeg, { status: 200, headers: { "content-type": "image/jpeg" } });
        }
        if (url === OPUS_DEFAULT_MCP_URL) {
            const body = JSON.parse(options.body);
            if (body.method === "initialize") return Response.json({ jsonrpc: "2.0", id: body.id, result: {} });
            if (body.method === "notifications/initialized") return new Response("", { status: 204 });
            if (body.method === "tools/list") {
                return Response.json({ jsonrpc: "2.0", id: body.id, result: { tools: prodTools } });
            }
            if (body.method === "tools/call") {
                const { name, arguments: args } = body.params;
                if (name === "opus_video_tools_whoami") {
                    return Response.json({ jsonrpc: "2.0", id: body.id, result: { structuredContent: { has_api_access: true } } });
                }
                if (name === "create_project") {
                    return Response.json({ jsonrpc: "2.0", id: body.id, result: { structuredContent: { projectId: "gen_fallback_01" } } });
                }
                if (name === "import_assets") {
                    const spec = args.assets?.[0] || {};
                    seenSpecs.push(spec);
                    const hasRequiredSource = Boolean(spec.url || spec.dataUrl || spec.mediaBase64 || spec.assetId || spec.path);
                    assert.equal(hasRequiredSource, true, "Setiap panggilan import_assets wajib memiliki url/dataUrl/mediaBase64/assetId/path");

                    if (spec.assetId === "ast_from_put_99") {
                        assert.equal(putUploaded, true);
                        return Response.json({
                            jsonrpc: "2.0",
                            id: body.id,
                            result: {
                                structuredContent: {
                                    projectId: args.projectId,
                                    assets: [{ ok: true, assetId: "ast_from_put_99", status: "ready" }]
                                }
                            }
                        });
                    }
                    if (spec.path && spec.path.startsWith("/tmp/")) {
                        return Response.json({
                            jsonrpc: "2.0",
                            id: body.id,
                            result: {
                                structuredContent: {
                                    projectId: args.projectId,
                                    assets: [{
                                        ok: true,
                                        status: "awaiting_upload",
                                        assetId: "ast_from_put_99",
                                        upload: { putUrl: "https://upload.opus.example/put-signed-99", method: "PUT" }
                                    }]
                                }
                            }
                        });
                    }
                    /* Simulasikan server yang menolak inline dataUrl/mediaBase64 sehingga memaksa 2-step PUT upload */
                    return Response.json({
                        jsonrpc: "2.0",
                        id: body.id,
                        result: {
                            structuredContent: {
                                projectId: args.projectId,
                                assets: [{ ok: false, error: "inline_not_allowed", message: "Use signed upload" }]
                            }
                        }
                    });
                }
                if (name === "generate_keyframes") {
                    assert.deepEqual(args.items[0].referenceAssets, ["ast_from_put_99"]);
                    return Response.json({
                        jsonrpc: "2.0",
                        id: body.id,
                        result: {
                            structuredContent: {
                                projectId: args.projectId,
                                items: [{ id: "kf-1", ok: true, jobId: "job_put_99", status: "queued" }]
                            }
                        }
                    });
                }
                if (name === "get_status") {
                    return Response.json({
                        jsonrpc: "2.0",
                        id: body.id,
                        result: {
                            structuredContent: {
                                jobs: [{ jobId: "job_put_99", status: "completed", downloadUrl: "https://cdn.opus.pro/out/fallback-put.jpg" }]
                            }
                        }
                    });
                }
            }
        }
        throw new Error(`Unexpected fetch: ${url}`);
    });

    try {
        const res = await generateOpusSocialImage({
            env: { OPUS_AUTH_TOKEN: "tok-fallback-put", OPUS_POLL_INTERVAL_MS: "5" },
            prompt: "Iklan botol parfum",
            referenceBytes: texturedJpeg({ width: 512, height: 512 }),
            referenceMimeType: "image/jpeg"
        });
        assert.equal(putUploaded, true);
        assert.equal(res.width, 720);
        assert.equal(res.height, 1280);
    } finally {
        restore();
    }
});

test("generateOpusSocialImage mengekstrak jobId bersarang/markdown JSON dan mengunduh gambar dari sibling assets di get_status", async () => {
    resetOpusTokenCache();
    const outputJpeg = texturedJpeg({ width: 720, height: 1280 });
    let polledJobId = "";

    const restore = mockFetch(async (url, options = {}) => {
        if (url === "https://cdn.opus.pro/out/sibling-asset.jpg") {
            return new Response(outputJpeg, { status: 200, headers: { "content-type": "image/jpeg" } });
        }
        if (url === OPUS_DEFAULT_MCP_URL) {
            const body = JSON.parse(options.body);
            if (body.method === "initialize") return Response.json({ jsonrpc: "2.0", id: body.id, result: {} });
            if (body.method === "notifications/initialized") return new Response("", { status: 204 });
            if (body.method === "tools/list") {
                return Response.json({ jsonrpc: "2.0", id: body.id, result: { tools: standardMcpTools() } });
            }
            if (body.method === "tools/call") {
                const { name, arguments: args } = body.params;
                if (name === "opus_video_tools_whoami") {
                    return Response.json({ jsonrpc: "2.0", id: body.id, result: { structuredContent: { has_api_access: true } } });
                }
                if (name === "create_project") {
                    return Response.json({ jsonrpc: "2.0", id: body.id, result: { structuredContent: { projectId: "gen_nested_01" } } });
                }
                if (name === "generate_keyframes") {
                    const mdPayload = [
                        "Submitted 1 keyframe generation request.",
                        "```json",
                        JSON.stringify({
                            data: {
                                projectId: args.projectId,
                                items: [
                                    {
                                        id: "kf-1",
                                        ok: true,
                                        status: "queued",
                                        submission: { executionId: "exec-nested-901" }
                                    }
                                ]
                            }
                        }),
                        "```"
                    ].join("\n");
                    return Response.json({
                        jsonrpc: "2.0",
                        id: body.id,
                        result: {
                            content: [{ type: "text", text: mdPayload }]
                        }
                    });
                }
                if (name === "get_status") {
                    polledJobId = args.jobId;
                    return Response.json({
                        jsonrpc: "2.0",
                        id: body.id,
                        result: {
                            structuredContent: {
                                projectId: args.projectId,
                                jobs: [{ id: "exec-nested-901", status: "completed", outputAssetId: "ast_out_901" }],
                                assets: [{ assetId: "ast_out_901", resultUrl: "https://cdn.opus.pro/out/sibling-asset.jpg" }]
                            }
                        }
                    });
                }
            }
        }
        throw new Error(`Unexpected fetch: ${url}`);
    });

    try {
        const res = await generateOpusSocialImage({
            env: { OPUS_AUTH_TOKEN: "tok-nested", OPUS_POLL_INTERVAL_MS: "5" },
            prompt: "Kopi susu dingin di meja kayu"
        });
        assert.equal(polledJobId, "exec-nested-901");
        assert.equal(res.width, 720);
        assert.equal(res.height, 1280);
    } finally {
        restore();
    }
});

test("generateOpusSocialImage menggunakan fallback list_jobs saat generate_keyframes sukses tanpa jobId inline serta memulihkan error unsupported_model", async () => {
    resetOpusTokenCache();
    const outputJpeg = texturedJpeg({ width: 720, height: 1280 });
    let listJobsCalledWithProject = "";
    let keyframeAttempts = 0;

    const toolsWithListJobs = [
        ...standardMcpTools(),
        {
            name: "list_jobs",
            inputSchema: {
                type: "object",
                required: ["projectId"],
                properties: {
                    projectId: { type: "string" },
                    limit: { type: "number" }
                }
            }
        }
    ];

    let restore = mockFetch(async (url, options = {}) => {
        if (url === "https://cdn.opus.pro/out/from-list-jobs.jpg") {
            return new Response(outputJpeg, { status: 200, headers: { "content-type": "image/jpeg" } });
        }
        if (url === OPUS_DEFAULT_MCP_URL) {
            const body = JSON.parse(options.body);
            if (body.method === "initialize") return Response.json({ jsonrpc: "2.0", id: body.id, result: {} });
            if (body.method === "notifications/initialized") return new Response("", { status: 204 });
            if (body.method === "tools/list") {
                return Response.json({ jsonrpc: "2.0", id: body.id, result: { tools: toolsWithListJobs } });
            }
            if (body.method === "tools/call") {
                const { name, arguments: args } = body.params;
                if (name === "opus_video_tools_whoami") {
                    return Response.json({ jsonrpc: "2.0", id: body.id, result: { structuredContent: { has_api_access: true } } });
                }
                if (name === "create_project") {
                    return Response.json({ jsonrpc: "2.0", id: body.id, result: { structuredContent: { projectId: "gen_list_01" } } });
                }
                if (name === "generate_keyframes") {
                    keyframeAttempts += 1;
                    /* Percobaan pertama gagal di level item tanpa ok:false (dulu tertelan jadi unexpected_response) */
                    if (args.model) {
                        return Response.json({
                            jsonrpc: "2.0",
                            id: body.id,
                            result: {
                                structuredContent: {
                                    projectId: args.projectId,
                                    items: [{ id: "kf-1", error: "unsupported_model", message: "Model alias not enabled" }]
                                }
                            }
                        });
                    }
                    /* Percobaan fallback tanpa model sukses tapi tidak mengembalikan jobId inline */
                    return Response.json({
                        jsonrpc: "2.0",
                        id: body.id,
                        result: {
                            structuredContent: {
                                projectId: args.projectId,
                                items: [{ id: "kf-1", ok: true, status: "queued" }]
                            }
                        }
                    });
                }
                if (name === "list_jobs") {
                    listJobsCalledWithProject = args.projectId;
                    return Response.json({
                        jsonrpc: "2.0",
                        id: body.id,
                        result: {
                            structuredContent: {
                                projectId: args.projectId,
                                jobs: { "kf-1": "job_listed_77" }
                            }
                        }
                    });
                }
                if (name === "get_status") {
                    assert.equal(args.jobId, "job_listed_77");
                    return Response.json({
                        jsonrpc: "2.0",
                        id: body.id,
                        result: {
                            structuredContent: {
                                jobs: [{ jobId: "job_listed_77", status: "completed", downloadUrl: "https://cdn.opus.pro/out/from-list-jobs.jpg" }]
                            }
                        }
                    });
                }
            }
        }
        throw new Error(`Unexpected fetch: ${url}`);
    });

    try {
        const res = await generateOpusSocialImage({
            env: { OPUS_AUTH_TOKEN: "tok-list-jobs", OPUS_POLL_INTERVAL_MS: "5" },
            prompt: "Sepatu lari putih modern"
        });
        assert.equal(keyframeAttempts >= 2, true, "Harus otomatis mencoba kandidat fallback saat unsupported_model");
        assert.equal(listJobsCalledWithProject, "gen_list_01");
        assert.equal(res.width, 720);
        assert.equal(res.height, 1280);
    } finally {
        restore();
    }

    /* Verifikasi diagnostik tersanitasi apabila respons benar-benar kosong tanpa jobId maupun list_jobs */
    const strictStatusTools = standardMcpTools().map(t => (
        t.name === "get_status"
            ? { ...t, inputSchema: { ...t.inputSchema, required: ["jobId"] } }
            : t
    ));
    restore = mockFetch(async (url, options = {}) => {
        if (url === OPUS_DEFAULT_MCP_URL) {
            const body = JSON.parse(options.body);
            if (body.method === "initialize") return Response.json({ jsonrpc: "2.0", id: body.id, result: {} });
            if (body.method === "notifications/initialized") return new Response("", { status: 204 });
            if (body.method === "tools/list") {
                return Response.json({ jsonrpc: "2.0", id: body.id, result: { tools: strictStatusTools } });
            }
            if (body.method === "tools/call") {
                const { name } = body.params;
                if (name === "opus_video_tools_whoami") {
                    return Response.json({ jsonrpc: "2.0", id: body.id, result: { structuredContent: { has_api_access: true } } });
                }
                if (name === "create_project") {
                    return Response.json({ jsonrpc: "2.0", id: body.id, result: { structuredContent: { projectId: "gen_noop_01" } } });
                }
                if (name === "generate_keyframes") {
                    return Response.json({
                        jsonrpc: "2.0",
                        id: body.id,
                        result: {
                            structuredContent: {
                                projectId: "gen_noop_01",
                                note: "accepted_without_id",
                                accessToken: "secret-abc-999",
                                signedLink: "https://example.com/file?X-Amz-Signature=topsecret"
                            }
                        }
                    });
                }
            }
        }
        throw new Error(`Unexpected fetch: ${url}`);
    });

    try {
        await assert.rejects(
            () => generateOpusSocialImage({
                env: { OPUS_AUTH_TOKEN: "tok-diag", OPUS_POLL_INTERVAL_MS: "5" },
                prompt: "Tes diagnostik"
            }),
            err => {
                assert.equal(err.code, "unexpected_response");
                assert.match(err.message, /accepted_without_id/);
                assert.match(err.message, /\[schema:/);
                assert.doesNotMatch(err.message, /secret-abc-999/);
                assert.doesNotMatch(err.message, /topsecret/);
                return true;
            }
        );
    } finally {
        restore();
    }
});

test("generateOpusSocialImage menormalisasi dimensi gambar referensi <300px (mis. outfit 274x272 PNG) agar tidak ditolak invalid_frame_dimensions", async () => {
    resetOpusTokenCache();
    const outputJpeg = texturedJpeg({ width: 720, height: 1280 });

    /* Buat PNG pakaian 274x272 dengan latar transparan persis kasus produksi */
    const tinyOutfitPng = new PNG({ width: 274, height: 272 });
    for (let y = 0; y < 272; y += 1) {
        for (let x = 0; x < 274; x += 1) {
            const idx = (y * 274 + x) * 4;
            const insideShirt = x >= 40 && x <= 234 && y >= 30 && y <= 240;
            tinyOutfitPng.data[idx] = insideShirt ? (x * 7) % 255 : 0;
            tinyOutfitPng.data[idx + 1] = insideShirt ? (y * 9) % 255 : 0;
            tinyOutfitPng.data[idx + 2] = insideShirt ? ((x + y) * 5) % 255 : 0;
            tinyOutfitPng.data[idx + 3] = insideShirt ? 255 : 0;
        }
    }
    const tinyOutfitBytes = new Uint8Array(PNG.sync.write(tinyOutfitPng));
    assert.deepEqual(readImageSize(tinyOutfitBytes), { width: 274, height: 272 });

    const prodTools = [
        { name: "opus_video_tools_whoami", inputSchema: { type: "object", properties: {} } },
        {
            name: "create_project",
            inputSchema: { type: "object", required: ["name"], properties: { name: { type: "string" } } }
        },
        {
            name: "import_assets",
            inputSchema: {
                type: "object",
                required: ["assets", "projectId"],
                properties: {
                    projectId: { type: "string" },
                    assets: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                path: { type: "string" },
                                assetId: { type: "string" },
                                sizeBytes: { type: "number" },
                                role: { type: "string" },
                                label: { type: "string" },
                                contentType: { type: "string" },
                                dataUrl: { type: "string" },
                                mediaBase64: { type: "string" },
                                mediaMimeType: { type: "string" },
                                url: { type: "string" }
                            }
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
                            required: ["id", "prompt"],
                            properties: {
                                id: { type: "string" },
                                prompt: { type: "string" },
                                model: { type: "string" },
                                aspectRatio: { type: "string" },
                                quality: { type: "string" },
                                referenceAssets: { type: "array", items: { type: "string" } }
                            }
                        }
                    }
                }
            }
        },
        {
            name: "get_status",
            inputSchema: {
                type: "object",
                properties: { projectId: { type: "string" }, jobIds: { type: "array", items: { type: "string" } } }
            }
        }
    ];

    /* 1. bytes + signed URL Supabase untuk 274x272 PNG: URL mentah wajib diabaikan & gambar di-upscale >=512px sebelum import */
    const importedAssetDims = new Map();
    let importCounter = 0;

    let restore = mockFetch(async (url, options = {}) => {
        if (url === "https://cdn.opus.pro/out/upscaled-ok.jpg") {
            return new Response(outputJpeg, { status: 200, headers: { "content-type": "image/jpeg" } });
        }
        if (url === OPUS_DEFAULT_MCP_URL) {
            const body = JSON.parse(options.body);
            if (body.method === "initialize") return Response.json({ jsonrpc: "2.0", id: body.id, result: {} });
            if (body.method === "notifications/initialized") return new Response("", { status: 204 });
            if (body.method === "tools/list") return Response.json({ jsonrpc: "2.0", id: body.id, result: { tools: prodTools } });
            if (body.method === "tools/call") {
                const { name, arguments: args } = body.params;
                if (name === "opus_video_tools_whoami") {
                    return Response.json({ jsonrpc: "2.0", id: body.id, result: { structuredContent: { has_api_access: true } } });
                }
                if (name === "create_project") {
                    return Response.json({ jsonrpc: "2.0", id: body.id, result: { structuredContent: { projectId: "gen_dim_01" } } });
                }
                if (name === "import_assets") {
                    importCounter += 1;
                    const spec = args.assets[0];
                    const assetId = `ast_dim_${importCounter}`;
                    if (spec.url === "https://supabase.example/raw/outfit_274x272.png") {
                        importedAssetDims.set(assetId, { width: 274, height: 272 });
                    } else if (spec.url === "https://supabase.example/raw/person_720x1280.jpg") {
                        importedAssetDims.set(assetId, { width: 720, height: 1280 });
                    } else if (spec.dataUrl) {
                        const b64 = spec.dataUrl.split(",")[1];
                        const raw = Uint8Array.from(Buffer.from(b64, "base64"));
                        importedAssetDims.set(assetId, readImageSize(raw));
                    }
                    return Response.json({
                        jsonrpc: "2.0",
                        id: body.id,
                        result: { structuredContent: { projectId: args.projectId, assets: [{ ok: true, assetId }] } }
                    });
                }
                if (name === "generate_keyframes") {
                    const refs = args.items[0].referenceAssets || [];
                    for (let idx = 0; idx < refs.length; idx += 1) {
                        const dims = importedAssetDims.get(refs[idx]);
                        if (!dims || dims.width < 300 || dims.height < 300 || dims.width > 6000 || dims.height > 6000) {
                            return Response.json({
                                jsonrpc: "2.0",
                                id: body.id,
                                result: {
                                    structuredContent: {
                                        projectId: args.projectId,
                                        items: [{
                                            id: "kf-1",
                                            ok: false,
                                            field: `referenceAssets[${idx}]`,
                                            errorCode: "invalid_frame_dimensions",
                                            message: `referenceAssets[${idx}] is ${dims?.width}x${dims?.height}. Image references need both sides between 300px and 6000px`
                                        }]
                                    }
                                }
                            });
                        }
                    }
                    return Response.json({
                        jsonrpc: "2.0",
                        id: body.id,
                        result: { structuredContent: { projectId: args.projectId, jobIds: ["job_dim_ok_1"] } }
                    });
                }
                if (name === "get_status") {
                    return Response.json({
                        jsonrpc: "2.0",
                        id: body.id,
                        result: {
                            structuredContent: {
                                jobs: [{ jobId: "job_dim_ok_1", status: "completed", downloadUrl: "https://cdn.opus.pro/out/upscaled-ok.jpg" }]
                            }
                        }
                    });
                }
            }
        }
        throw new Error(`Unexpected fetch: ${url}`);
    });

    try {
        const res = await generateOpusSocialImage({
            env: { OPUS_AUTH_TOKEN: "tok-dim", OPUS_POLL_INTERVAL_MS: "5" },
            prompt: "Karakter memakai jaket streetwear",
            referenceBytes: texturedJpeg({ width: 720, height: 1280 }),
            referenceMimeType: "image/jpeg",
            personImageUrl: "https://supabase.example/raw/person_720x1280.jpg",
            garmentBytes: tinyOutfitBytes,
            garmentMimeType: "image/png",
            garmentImageUrls: ["https://supabase.example/raw/outfit_274x272.png"]
        });
        const outfitDims = importedAssetDims.get("ast_dim_2");
        assert.ok(outfitDims.width >= 512 && outfitDims.height >= 512, `Outfit 274x272 harus di-upscale >=512px, aktual: ${outfitDims.width}x${outfitDims.height}`);
        assert.equal(res.images_sent, 2);
        assert.equal(res.width, 720);
    } finally {
        restore();
    }

    /* 2. URL murni tanpa bytes awal: pulih otomatis saat server menolak invalid_frame_dimensions */
    importedAssetDims.clear();
    importCounter = 0;
    let remoteTinyDownloads = 0;

    restore = mockFetch(async (url, options = {}) => {
        if (url === "https://shop.example/tiny-274x272.png") {
            remoteTinyDownloads += 1;
            return new Response(tinyOutfitBytes, { status: 200, headers: { "content-type": "image/png" } });
        }
        if (url === "https://cdn.opus.pro/out/recovered-url.jpg") {
            return new Response(outputJpeg, { status: 200, headers: { "content-type": "image/jpeg" } });
        }
        if (url === OPUS_DEFAULT_MCP_URL) {
            const body = JSON.parse(options.body);
            if (body.method === "initialize") return Response.json({ jsonrpc: "2.0", id: body.id, result: {} });
            if (body.method === "notifications/initialized") return new Response("", { status: 204 });
            if (body.method === "tools/list") return Response.json({ jsonrpc: "2.0", id: body.id, result: { tools: prodTools } });
            if (body.method === "tools/call") {
                const { name, arguments: args } = body.params;
                if (name === "opus_video_tools_whoami") {
                    return Response.json({ jsonrpc: "2.0", id: body.id, result: { structuredContent: { has_api_access: true } } });
                }
                if (name === "create_project") {
                    return Response.json({ jsonrpc: "2.0", id: body.id, result: { structuredContent: { projectId: "gen_dim_02" } } });
                }
                if (name === "import_assets") {
                    importCounter += 1;
                    const spec = args.assets[0];
                    const assetId = `ast_url_${importCounter}`;
                    if (spec.url === "https://shop.example/tiny-274x272.png") {
                        importedAssetDims.set(assetId, { width: 274, height: 272 });
                    } else if (spec.dataUrl) {
                        const b64 = spec.dataUrl.split(",")[1];
                        const raw = Uint8Array.from(Buffer.from(b64, "base64"));
                        importedAssetDims.set(assetId, readImageSize(raw));
                    }
                    return Response.json({
                        jsonrpc: "2.0",
                        id: body.id,
                        result: { structuredContent: { projectId: args.projectId, assets: [{ ok: true, assetId }] } }
                    });
                }
                if (name === "generate_keyframes") {
                    const refs = args.items[0].referenceAssets || [];
                    for (let idx = 0; idx < refs.length; idx += 1) {
                        const dims = importedAssetDims.get(refs[idx]);
                        if (!dims || dims.width < 300 || dims.height < 300) {
                            return Response.json({
                                jsonrpc: "2.0",
                                id: body.id,
                                result: {
                                    structuredContent: {
                                        projectId: args.projectId,
                                        items: [{
                                            id: "kf-1",
                                            ok: false,
                                            field: `referenceAssets[${idx}]`,
                                            errorCode: "invalid_frame_dimensions",
                                            message: `referenceAssets[${idx}] is ${dims?.width}x${dims?.height}. Image references need both sides between 300px and 6000px`
                                        }]
                                    }
                                }
                            });
                        }
                    }
                    return Response.json({
                        jsonrpc: "2.0",
                        id: body.id,
                        result: { structuredContent: { projectId: args.projectId, jobIds: ["job_dim_ok_2"] } }
                    });
                }
                if (name === "get_status") {
                    return Response.json({
                        jsonrpc: "2.0",
                        id: body.id,
                        result: {
                            structuredContent: {
                                jobs: [{ jobId: "job_dim_ok_2", status: "completed", downloadUrl: "https://cdn.opus.pro/out/recovered-url.jpg" }]
                            }
                        }
                    });
                }
            }
        }
        throw new Error(`Unexpected fetch: ${url}`);
    });

    try {
        const res = await generateOpusSocialImage({
            env: { OPUS_AUTH_TOKEN: "tok-dim-url", OPUS_POLL_INTERVAL_MS: "5" },
            prompt: "Produk tas di meja marmer",
            garmentImageUrls: ["https://shop.example/tiny-274x272.png"]
        });
        assert.equal(remoteTinyDownloads, 1);
        assert.equal(res.images_sent, 1);
        assert.equal(res.width, 720);
    } finally {
        restore();
    }
});

test("generateOpusSocialImage tidak pernah menganggap kode error job_queue_timeout sebagai jobId dan melakukan retry idempotent dengan requestKey yang sama", async () => {
    resetOpusTokenCache();
    const outputJpeg = texturedJpeg({ width: 720, height: 1280 });
    const toolsWithListJobs = [
        ...standardMcpTools(),
        {
            name: "list_jobs",
            inputSchema: {
                type: "object",
                required: ["projectId"],
                properties: { projectId: { type: "string" } }
            }
        }
    ];

    /* 1. job_queue_timeout di respons teks/JSON tanpa ok:false -> cek list_jobs (kosong) -> retry dengan requestKey identik -> sukses + toleransi job_not_found pertama */
    const seenRequestKeys = [];
    const seenStatusJobIds = [];
    let kfCalls = 0;
    let statusCalls = 0;

    let restore = mockFetch(async (url, options = {}) => {
        if (url === "https://cdn.opus.pro/out/queue-recovered.jpg") {
            return new Response(outputJpeg, { status: 200, headers: { "content-type": "image/jpeg" } });
        }
        if (url === OPUS_DEFAULT_MCP_URL) {
            const body = JSON.parse(options.body);
            if (body.method === "initialize") return Response.json({ jsonrpc: "2.0", id: body.id, result: {} });
            if (body.method === "notifications/initialized") return new Response("", { status: 204 });
            if (body.method === "tools/list") return Response.json({ jsonrpc: "2.0", id: body.id, result: { tools: toolsWithListJobs } });
            if (body.method === "tools/call") {
                const { name, arguments: args } = body.params;
                if (name === "opus_video_tools_whoami") {
                    return Response.json({ jsonrpc: "2.0", id: body.id, result: { structuredContent: { has_api_access: true } } });
                }
                if (name === "create_project") {
                    return Response.json({ jsonrpc: "2.0", id: body.id, result: { structuredContent: { projectId: "gen_qt_01" } } });
                }
                if (name === "generate_keyframes") {
                    kfCalls += 1;
                    seenRequestKeys.push(args.requestKey);
                    if (kfCalls === 1) {
                        const rawPayload = JSON.stringify({
                            projectId: args.projectId,
                            code: "job_queue_timeout"
                        });
                        return Response.json({
                            jsonrpc: "2.0",
                            id: body.id,
                            result: { content: [{ type: "text", text: rawPayload }] }
                        });
                    }
                    return Response.json({
                        jsonrpc: "2.0",
                        id: body.id,
                        result: { structuredContent: { projectId: args.projectId, jobId: "job_real_404" } }
                    });
                }
                if (name === "list_jobs") {
                    return Response.json({
                        jsonrpc: "2.0",
                        id: body.id,
                        result: { structuredContent: { projectId: args.projectId, jobs: [] } }
                    });
                }
                if (name === "get_status") {
                    statusCalls += 1;
                    seenStatusJobIds.push(args.jobId);
                    assert.notEqual(args.jobId, "job_queue_timeout", "Tidak boleh memanggil get_status dengan job_queue_timeout");
                    if (statusCalls === 1) {
                        /* Simulasikan eventual consistency sesaat setelah submit */
                        return Response.json({
                            jsonrpc: "2.0",
                            id: body.id,
                            result: { structuredContent: { jobId: args.jobId, error: "job_not_found" } }
                        });
                    }
                    return Response.json({
                        jsonrpc: "2.0",
                        id: body.id,
                        result: {
                            structuredContent: {
                                jobId: args.jobId,
                                status: "completed",
                                downloadUrl: "https://cdn.opus.pro/out/queue-recovered.jpg"
                            }
                        }
                    });
                }
            }
        }
        throw new Error(`Unexpected fetch: ${url}`);
    });

    try {
        const res = await generateOpusSocialImage({
            env: { OPUS_AUTH_TOKEN: "tok-qt", OPUS_POLL_INTERVAL_MS: "5" },
            prompt: "Sneakers putih minimalis"
        });
        assert.equal(kfCalls, 2);
        assert.equal(seenRequestKeys[0], seenRequestKeys[1], "Retry job_queue_timeout wajib mempertahankan requestKey UUID yang sama");
        assert.deepEqual(seenStatusJobIds, ["job_real_404", "job_real_404"]);
        assert.equal(res.width, 720);
    } finally {
        restore();
    }

    /* 2. Bila job sebenarnya sudah terdaftar di list_jobs saat job_queue_timeout, langsung pantau tanpa submit ulang */
    let secondKfCalls = 0;
    restore = mockFetch(async (url, options = {}) => {
        if (url === "https://cdn.opus.pro/out/already-queued.jpg") {
            return new Response(outputJpeg, { status: 200, headers: { "content-type": "image/jpeg" } });
        }
        if (url === OPUS_DEFAULT_MCP_URL) {
            const body = JSON.parse(options.body);
            if (body.method === "initialize") return Response.json({ jsonrpc: "2.0", id: body.id, result: {} });
            if (body.method === "notifications/initialized") return new Response("", { status: 204 });
            if (body.method === "tools/list") return Response.json({ jsonrpc: "2.0", id: body.id, result: { tools: toolsWithListJobs } });
            if (body.method === "tools/call") {
                const { name, arguments: args } = body.params;
                if (name === "opus_video_tools_whoami") {
                    return Response.json({ jsonrpc: "2.0", id: body.id, result: { structuredContent: { has_api_access: true } } });
                }
                if (name === "create_project") {
                    return Response.json({ jsonrpc: "2.0", id: body.id, result: { structuredContent: { projectId: "gen_qt_02" } } });
                }
                if (name === "generate_keyframes") {
                    secondKfCalls += 1;
                    return Response.json({
                        jsonrpc: "2.0",
                        id: body.id,
                        result: { structuredContent: { projectId: args.projectId, status: "job_queue_timeout" } }
                    });
                }
                if (name === "list_jobs") {
                    return Response.json({
                        jsonrpc: "2.0",
                        id: body.id,
                        result: { structuredContent: { projectId: args.projectId, jobs: [{ jobId: "job_queued_88", status: "running" }] } }
                    });
                }
                if (name === "get_status") {
                    assert.equal(args.jobId, "job_queued_88");
                    return Response.json({
                        jsonrpc: "2.0",
                        id: body.id,
                        result: {
                            structuredContent: {
                                jobId: "job_queued_88",
                                status: "completed",
                                downloadUrl: "https://cdn.opus.pro/out/already-queued.jpg"
                            }
                        }
                    });
                }
            }
        }
        throw new Error(`Unexpected fetch: ${url}`);
    });

    try {
        const res = await generateOpusSocialImage({
            env: { OPUS_AUTH_TOKEN: "tok-qt2", OPUS_POLL_INTERVAL_MS: "5" },
            prompt: "Kemeja linen pantai"
        });
        assert.equal(secondKfCalls, 1, "Tidak boleh submit ulang generate_keyframes bila job sudah ditemukan di list_jobs");
        assert.equal(res.width, 720);
    } finally {
        restore();
    }
});

test("readImageSize membaca dimensi WebP VP8X (768x1376, bukan 16711681x6225923), VP8L lossless, VP8 lossy, dan JPEG ber-EXIF thumbnail", () => {
    /* 1. Reproduksi tepat bug produksi: WebP VP8X 768x1376 memiliki reserved bytes [0,0,0]
          di offset 21..23 dan width-1 = 767 ([0xff, 0x02, 0x00]) di offset 24..26 serta
          height-1 = 1375 ([0x5f, 0x05, 0x00]) di offset 27..29. Offset lama (22..24 & 25..27)
          salah membacanya sebagai 16711681x6225923px. */
    const vp8xHeader = new Uint8Array(30);
    vp8xHeader.set([0x52, 0x49, 0x46, 0x46], 0); // "RIFF"
    vp8xHeader.set([22, 0, 0, 0], 4);
    vp8xHeader.set([0x57, 0x45, 0x42, 0x50], 8); // "WEBP"
    vp8xHeader.set([0x56, 0x50, 0x38, 0x58], 12); // "VP8X"
    vp8xHeader.set([10, 0, 0, 0], 16); // chunk size = 10
    vp8xHeader[20] = 0x18; // alpha + exif flags
    vp8xHeader.set([0x00, 0x00, 0x00], 21); // reserved 24-bit
    vp8xHeader.set([0xff, 0x02, 0x00], 24); // width - 1 = 767 -> 768
    vp8xHeader.set([0x5f, 0x05, 0x00], 27); // height - 1 = 1375 -> 1376
    assert.deepEqual(readImageSize(vp8xHeader), { width: 768, height: 1376 });

    /* 2. WebP VP8L lossless nyata */
    const rgbaLossless = new Uint8Array(320 * 480 * 4);
    for (let i = 0; i < 320 * 480; i += 1) {
        rgbaLossless[i * 4] = (i * 7) & 255;
        rgbaLossless[i * 4 + 1] = (i * 13) & 255;
        rgbaLossless[i * 4 + 2] = (i * 19) & 255;
        rgbaLossless[i * 4 + 3] = 255;
    }
    const vp8lBytes = encodeWebp({ data: rgbaLossless, width: 320, height: 480 }, { lossless: true });
    assert.deepEqual(readImageSize(vp8lBytes), { width: 320, height: 480 });

    /* 3. WebP VP8 lossy nyata */
    const vp8LossyBytes = encodeWebp({ data: rgbaLossless, width: 320, height: 480 }, { lossless: false, quality: 75 });
    assert.deepEqual(readImageSize(vp8LossyBytes), { width: 320, height: 480 });

    /* 4. JPEG dengan APP1 EXIF yang berisi penanda SOF0 palsu thumbnail 160x120 di dalam segmen APP1 */
    const realJpeg = texturedJpeg({ width: 900, height: 1200 });
    const fakeExifPayload = new Uint8Array([
        0x45, 0x78, 0x69, 0x66, 0x00, 0x00,
        0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x78, 0x00, 0xa0 // 160x120 thumbnail SOF0 di dalam APP1
    ]);
    const app1Len = fakeExifPayload.length + 2;
    const jpegWithExif = new Uint8Array(2 + 4 + fakeExifPayload.length + (realJpeg.length - 2));
    jpegWithExif.set([0xff, 0xd8, 0xff, 0xe1, (app1Len >> 8) & 0xff, app1Len & 0xff], 0);
    jpegWithExif.set(fakeExifPayload, 6);
    jpegWithExif.set(realJpeg.subarray(2), 6 + fakeExifPayload.length);
    assert.deepEqual(readImageSize(jpegWithExif), { width: 900, height: 1200 });
});

test("generateOpusSocialImage meloloskan karakter WebP VP8X 768x1376 tanpa decode dan meng-upscale outfit WebP <300px secara otomatis", async () => {
    resetOpusTokenCache();

    /* Karakter VP8X 768x1376 (persis skenario produksi BELA .webp) */
    const charRgba = new Uint8Array(768 * 1376 * 4);
    for (let i = 0; i < 768 * 1376; i += 1) {
        charRgba[i * 4] = (i * 3) & 255;
        charRgba[i * 4 + 1] = (i * 5) & 255;
        charRgba[i * 4 + 2] = (i * 11) & 255;
        charRgba[i * 4 + 3] = i % 17 === 0 ? 240 : 255;
    }
    const charVp8xWebp = encodeWebpWithAlpha({ data: charRgba, width: 768, height: 1376 });
    assert.equal(String.fromCharCode(...charVp8xWebp.subarray(12, 16)), "VP8X");
    assert.deepEqual(readImageSize(charVp8xWebp), { width: 768, height: 1376 });

    /* Outfit WebP kecil < 300px (220x250 lossy & 240x260 VP8X alpha) */
    const smallOutfitRgba = new Uint8Array(220 * 250 * 4);
    for (let i = 0; i < 220 * 250; i += 1) {
        smallOutfitRgba[i * 4] = (i * 9) & 255;
        smallOutfitRgba[i * 4 + 1] = 140;
        smallOutfitRgba[i * 4 + 2] = (i * 15) & 255;
        smallOutfitRgba[i * 4 + 3] = 255;
    }
    const tinyOutfitWebp = encodeWebp({ data: smallOutfitRgba, width: 220, height: 250 }, { lossless: false, quality: 80 });
    assert.deepEqual(readImageSize(tinyOutfitWebp), { width: 220, height: 250 });

    const outputJpeg = texturedJpeg({ width: 720, height: 1280 });
    const importedItems = [];
    const uploadedPayloads = new Map();

    const tools = [
        { name: "opus_video_tools_whoami", inputSchema: { type: "object", properties: {} } },
        {
            name: "create_project",
            inputSchema: {
                type: "object",
                required: ["name", "requestKey"],
                properties: { name: { type: "string" }, requestKey: { type: "string" } }
            }
        },
        {
            name: "import_assets",
            inputSchema: {
                type: "object",
                required: ["projectId", "requestKey", "items"],
                properties: {
                    projectId: { type: "string" },
                    requestKey: { type: "string" },
                    items: {
                        type: "array",
                        items: {
                            oneOf: [
                                {
                                    type: "object",
                                    required: ["id", "url"],
                                    properties: {
                                        id: { type: "string" },
                                        url: { type: "string", format: "uri" }
                                    }
                                },
                                {
                                    type: "object",
                                    required: ["id", "fileName", "mimeType", "sizeBytes"],
                                    properties: {
                                        id: { type: "string" },
                                        fileName: { type: "string" },
                                        mimeType: { type: "string" },
                                        sizeBytes: { type: "integer" }
                                    }
                                },
                                {
                                    type: "object",
                                    required: ["assetId"],
                                    properties: { assetId: { type: "string" } }
                                }
                            ]
                        }
                    }
                }
            }
        },
        {
            name: "generate_keyframes",
            inputSchema: {
                type: "object",
                required: ["projectId", "requestKey", "prompt"],
                properties: {
                    projectId: { type: "string" },
                    requestKey: { type: "string" },
                    prompt: { type: "string" },
                    referenceAssetIds: { type: "array", items: { type: "string" } }
                }
            }
        }
    ];

    let assetSeq = 0;
    const restore = mockFetch(async (url, options = {}) => {
        if (url.startsWith("https://upload.opus.example/")) {
            const raw = new Uint8Array(options.body);
            uploadedPayloads.set(url, raw);
            return new Response("", { status: 200 });
        }
        if (url === "https://cdn.opus.pro/out/webp-ok.jpg") {
            return new Response(outputJpeg, { status: 200, headers: { "content-type": "image/jpeg" } });
        }
        if (url === OPUS_DEFAULT_MCP_URL) {
            const body = JSON.parse(options.body);
            if (body.method === "initialize") return Response.json({ jsonrpc: "2.0", id: body.id, result: {} });
            if (body.method === "notifications/initialized") return new Response("", { status: 204 });
            if (body.method === "tools/list") return Response.json({ jsonrpc: "2.0", id: body.id, result: { tools } });
            if (body.method === "tools/call") {
                const { name, arguments: args } = body.params;
                if (name === "opus_video_tools_whoami") {
                    return Response.json({ jsonrpc: "2.0", id: body.id, result: { structuredContent: { has_api_access: true } } });
                }
                if (name === "create_project") {
                    return Response.json({ jsonrpc: "2.0", id: body.id, result: { structuredContent: { projectId: "proj_webp" } } });
                }
                if (name === "import_assets") {
                    const first = args.items[0];
                    importedItems.push(first);
                    if (first.assetId) {
                        return Response.json({
                            jsonrpc: "2.0",
                            id: body.id,
                            result: { structuredContent: { results: [{ assetId: first.assetId, status: "ready" }] } }
                        });
                    }
                    assetSeq += 1;
                    const assetId = `asset_webp_${assetSeq}`;
                    if (first.url) {
                        return Response.json({
                            jsonrpc: "2.0",
                            id: body.id,
                            result: { structuredContent: { results: [{ id: first.id, assetId, status: "ready" }] } }
                        });
                    }
                    const uploadUrl = `https://upload.opus.example/${assetId}`;
                    return Response.json({
                        jsonrpc: "2.0",
                        id: body.id,
                        result: { structuredContent: { results: [{ id: first.id, assetId, status: "awaiting_upload", uploadUrl }] } }
                    });
                }
                if (name === "generate_keyframes") {
                    return Response.json({
                        jsonrpc: "2.0",
                        id: body.id,
                        result: {
                            structuredContent: {
                                status: "completed",
                                downloadUrl: "https://cdn.opus.pro/out/webp-ok.jpg"
                            }
                        }
                    });
                }
            }
        }
        throw new Error(`Unexpected fetch: ${url}`);
    });

    try {
        const res = await generateOpusSocialImage({
            env: { OPUS_AUTH_TOKEN: "tok-webp" },
            prompt: "Model mengenakan outfit kasual",
            referenceBytes: charVp8xWebp,
            referenceMimeType: "image/webp",
            personImageUrl: "https://project.supabase.co/storage/v1/object/sign/social-character-references/char.webp?token=abc",
            garmentBytes: tinyOutfitWebp,
            garmentMimeType: "image/webp",
            garmentImageUrls: [
                "https://project.supabase.co/storage/v1/object/sign/social-character-references/tiny-outfit.webp?token=def"
            ]
        });

        assert.equal(res.width, 720);
        assert.equal(res.images_sent, 2);

        /* Karakter WebP 768x1376 sudah valid [300, 6000] -> dikirim byte-for-byte apa adanya sebagai character.webp (image/webp) tanpa decode/resize! */
        assert.equal(importedItems[0].mimeType, "image/webp");
        assert.equal(importedItems[0].fileName, "character.webp");
        assert.equal(importedItems[0].sizeBytes, charVp8xWebp.byteLength);
        const uploadedChar = uploadedPayloads.get("https://upload.opus.example/asset_webp_1");
        assert.deepEqual(uploadedChar, charVp8xWebp);

        /* Outfit WebP 220x250 (<300px) -> otomatis di-decode & di-upscale ke JPEG >=512px sebagai outfit.jpg! */
        assert.equal(importedItems[2].mimeType, "image/jpeg");
        assert.equal(importedItems[2].fileName, "outfit.jpg");
        const uploadedOutfit = uploadedPayloads.get("https://upload.opus.example/asset_webp_2");
        assert.ok(uploadedOutfit?.byteLength > 0);
        const upscaledDims = readImageSize(uploadedOutfit);
        assert.ok(upscaledDims.width >= 512 && upscaledDims.height >= 512, `Expected >=512px, got ${upscaledDims?.width}x${upscaledDims?.height}`);
    } finally {
        restore();
    }
});





