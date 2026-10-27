import test from "node:test";
import assert from "node:assert/strict";
import jpeg from "jpeg-js";

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
            return Response.json({
                access_token: "fresh-access-token",
                refresh_token: "rt_live_456",
                expires_in: 3600
            });
        }
        if (url === OPUS_DEFAULT_MCP_URL) {
            assert.equal(options.headers.Authorization, "Bearer fresh-access-token");
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
