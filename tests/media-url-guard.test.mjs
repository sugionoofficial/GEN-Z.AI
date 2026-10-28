import assert from "node:assert/strict";
import test from "node:test";

import {
    inspectReferenceMediaUrl,
    isNonMediaHttpPayload,
    validateParametersMediaUrls
} from "../assets/js/media-url-guard.js";
import { createVideoTask } from "../provider/opus/client.js";

function createMockRes() {
    return {
        statusCode: 200,
        headers: {},
        body: null,
        setHeader(name, value) {
            this.headers[String(name).toLowerCase()] = value;
        },
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.body = payload;
            return this;
        },
        end(raw) {
            if (typeof raw === "string" && raw.length > 0) {
                try {
                    this.body = JSON.parse(raw);
                } catch {
                    this.body = raw;
                }
            }
            return this;
        }
    };
}

test("inspectReferenceMediaUrl menolak link halaman medsos/share dengan pesan Bahasa Indonesia", () => {
    const blockedSamples = [
        ["https://www.facebook.com/watch?v=123456789", /Facebook/i],
        ["https://m.facebook.com/reel/987654321", /Facebook/i],
        ["https://fb.watch/abcDEF123/", /Facebook/i],
        ["https://www.tiktok.com/@creator/video/7390000000000000000", /TikTok/i],
        ["https://vt.tiktok.com/ZS8abcdef/", /TikTok/i],
        ["https://www.instagram.com/reel/C9abcDEF/", /Instagram/i],
        ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", /YouTube/i],
        ["https://youtu.be/dQw4w9WgXcQ", /YouTube/i],
        ["https://x.com/someone/status/123456", /X \/ Twitter/i],
        ["https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view?usp=sharing", /Google Drive/i],
        ["https://www.dropbox.com/s/abcdef12345/sample.mp4?dl=0", /Dropbox/i],
        ["https://www.pinterest.com/pin/123456789/", /Pinterest/i],
        ["https://www.canva.com/design/DAG123456/view", /Canva/i]
    ];

    for (const [sampleUrl, pattern] of blockedSamples) {
        const result = inspectReferenceMediaUrl(sampleUrl);
        assert.equal(result.valid, false, `Expected ${sampleUrl} to be rejected`);
        assert.equal(result.code, "NON_DIRECT_MEDIA_URL");
        assert.match(result.message, pattern);
    }

    const allowedSamples = [
        "https://cdn.example.com/assets/photo.jpg",
        "https://scontent.xx.fbcdn.net/v/t39.30808-6/sample_image.jpg?_nc_cat=101",
        "https://ycovbqmezhrvzobxqnyp.supabase.co/storage/v1/object/sign/user-uploads/u1/img.png?token=abc",
        "https://dl.dropboxusercontent.com/s/abcdef/sample.mp4",
        "https://www.dropbox.com/s/abcdef12345/sample.mp4?dl=1",
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
    ];

    for (const sampleUrl of allowedSamples) {
        const result = inspectReferenceMediaUrl(sampleUrl);
        assert.equal(result.valid, true, `Expected ${sampleUrl} to be accepted`);
    }
});

test("validateParametersMediaUrls dan isNonMediaHttpPayload mendeteksi URL medsos & payload HTML", () => {
    const errors = validateParametersMediaUrls({
        prompt: "buatkan video dari https://www.facebook.com/watch?v=999",
        image_url: "https://www.facebook.com/share/r/1AbCdEf/",
        reference_video_urls: ["https://www.tiktok.com/@a/video/123"]
    });
    assert.equal(errors.length, 2);
    assert.match(errors[0], /Facebook/i);
    assert.match(errors[1], /TikTok/i);

    const htmlBytes = new TextEncoder().encode("<!DOCTYPE html><html><body>Login to Facebook</body></html>");
    assert.equal(isNonMediaHttpPayload("text/html; charset=utf-8", htmlBytes), true);
    assert.equal(isNonMediaHttpPayload("application/octet-stream", htmlBytes), true);

    const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    assert.equal(isNonMediaHttpPayload("image/png", pngHeader), false);
    assert.equal(isNonMediaHttpPayload("", pngHeader), false);
});

test("POST /api/generate menolak URL Facebook dengan 422 NON_DIRECT_MEDIA_URL sebelum memotong credit", async () => {
    const originalFetch = global.fetch;
    const originalUrl = process.env.SUPABASE_URL;
    const originalServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const originalAnonKey = process.env.SUPABASE_ANON_KEY;

    process.env.SUPABASE_URL = "https://supabase.example.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "srv-test-token";
    process.env.SUPABASE_ANON_KEY = "anon-test-token";

    const { default: generateHandler } = await import(
        `../api/generate.js?urlguard-test=${Date.now()}`
    );

    let deductCalled = false;

    global.fetch = async (input) => {
        const url = String(input);
        if (url === "https://supabase.example.co/auth/v1/user") {
            return new Response(
                JSON.stringify({ id: "user-fb-1", email: "user@genz.ai" }),
                { status: 200, headers: { "Content-Type": "application/json" } }
            );
        }
        if (url.includes("/rest/v1/rpc/deduct_generate_credits")) {
            deductCalled = true;
            return new Response(JSON.stringify(7000), {
                status: 200,
                headers: { "Content-Type": "application/json" }
            });
        }
        return new Response(JSON.stringify([]), {
            status: 200,
            headers: { "Content-Type": "application/json" }
        });
    };

    try {
        const res = createMockRes();
        const req = {
            method: "POST",
            headers: {
                authorization: "Bearer user-session-tok"
            },
            body: {
                model: "opus-seedance-2.5-i2v",
                prompt: "Buat gerakan sinematik halus",
                parameters: {
                    prompt: "Buat gerakan sinematik halus",
                    image_url: "https://www.facebook.com/watch?v=10987654321",
                    duration: 5
                }
            }
        };

        await generateHandler(req, res);

        assert.equal(res.statusCode, 422);
        assert.equal(deductCalled, false, "Credit tidak boleh dipotong untuk URL halaman Facebook");
        assert.equal(res.body?.code, "NON_DIRECT_MEDIA_URL");
        assert.match(String(res.body?.error || res.body?.message || ""), /Facebook/i);
    } finally {
        global.fetch = originalFetch;
        process.env.SUPABASE_URL = originalUrl;
        process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceKey;
        process.env.SUPABASE_ANON_KEY = originalAnonKey;
    }
});

test("createVideoTask menangani JSON-RPC -32603 pada import_assets URL: blokir HTML/403 dengan pesan jelas & sukses fallback presigned PUT untuk gambar asli", async () => {
    const originalFetch = global.fetch;
    const mcpEndpoint = "https://labs.opus.pro/opus-video-tools/mcp";

    const buildMcpToolsList = () => ({
        tools: [
            {
                name: "create_project",
                inputSchema: {
                    type: "object",
                    properties: { title: { type: "string" } }
                }
            },
            {
                name: "import_assets",
                inputSchema: {
                    type: "object",
                    properties: {
                        projectId: { type: "string" },
                        assets: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    clientId: { type: "string" },
                                    url: { type: "string" },
                                    fileName: { type: "string" },
                                    mimeType: { type: "string" },
                                    size: { type: "number" },
                                    assetId: { type: "string" }
                                }
                            }
                        }
                    }
                }
            },
            {
                name: "generate_video_clips",
                inputSchema: {
                    type: "object",
                    properties: {
                        projectId: { type: "string" },
                        prompt: { type: "string" },
                        model: { type: "string" },
                        workflow: { type: "string" },
                        firstFrame: { type: "string" }
                    }
                }
            }
        ]
    });

    const installMockFetch = (cdnResponder) => {
        global.fetch = async (input, init = {}) => {
            const url = String(input);
            if (url === "https://cdn-edge.example.com/media-item") {
                return cdnResponder();
            }
            if (url === "https://upload.opus.example.com/put-object") {
                return new Response("", { status: 200 });
            }
            if (url === mcpEndpoint) {
                const rpc = JSON.parse(String(init.body || "{}"));
                const reply = (result) =>
                    new Response(
                        JSON.stringify({ jsonrpc: "2.0", id: rpc.id, result }),
                        {
                            status: 200,
                            headers: {
                                "Content-Type": "application/json",
                                "Mcp-Session-Id": "sess-test-1"
                            }
                        }
                    );
                if (rpc.method === "initialize") {
                    return reply({ protocolVersion: "2025-03-26", capabilities: {} });
                }
                if (rpc.method === "notifications/initialized") {
                    return new Response("", { status: 202 });
                }
                if (rpc.method === "tools/list") {
                    return reply(buildMcpToolsList());
                }
                if (rpc.method === "tools/call") {
                    const toolName = rpc.params?.name;
                    const args = rpc.params?.arguments || {};
                    if (toolName === "create_project") {
                        return reply({
                            content: [{ type: "text", text: JSON.stringify({ projectId: "proj-1" }) }]
                        });
                    }
                    if (toolName === "import_assets") {
                        const firstItem = args.assets?.[0] || {};
                        if (firstItem.url) {
                            return new Response(
                                JSON.stringify({
                                    jsonrpc: "2.0",
                                    id: rpc.id,
                                    error: { code: -32603, message: "Internal error" }
                                }),
                                { status: 200, headers: { "Content-Type": "application/json" } }
                            );
                        }
                        if (firstItem.assetId) {
                            return reply({
                                content: [
                                    {
                                        type: "text",
                                        text: JSON.stringify({
                                            assets: [{ assetId: firstItem.assetId, status: "ready" }]
                                        })
                                    }
                                ]
                            });
                        }
                        return reply({
                            content: [
                                {
                                    type: "text",
                                    text: JSON.stringify({
                                        assets: [
                                            {
                                                clientId: firstItem.clientId,
                                                assetId: "asset-uploaded-1",
                                                status: "awaiting_upload",
                                                uploadUrl: "https://upload.opus.example.com/put-object"
                                            }
                                        ]
                                    })
                                }
                            ]
                        });
                    }
                    if (toolName === "generate_video_clips") {
                        return reply({
                            content: [
                                {
                                    type: "text",
                                    text: JSON.stringify({ projectId: "proj-1", jobId: "job-ok-1" })
                                }
                            ]
                        });
                    }
                }
            }
            throw new Error(`Unexpected fetch URL in test: ${url}`);
        };
    };

    try {
        /* 1. URL ternyata mengembalikan halaman HTML -> harus melempar NON_DIRECT_MEDIA_URL yang jelas, BUKAN Internal error */
        installMockFetch(() =>
            new Response("<!DOCTYPE html><html><body>Login Required</body></html>", {
                status: 200,
                headers: { "Content-Type": "text/html; charset=utf-8" }
            })
        );

        await assert.rejects(
            () =>
                createVideoTask(
                    {
                        model: "opus-seedance-2.5-i2v",
                        prompt: "Gerakan kamera halus",
                        image_url: "https://cdn-edge.example.com/media-item",
                        duration: 5
                    },
                    "opus-bearer-test-token"
                ),
            (err) => {
                assert.equal(err.code, "NON_DIRECT_MEDIA_URL");
                assert.equal(err.status, 422);
                assert.match(err.message, /halaman web \(HTML\)/i);
                return true;
            }
        );

        /* 2. URL ternyata mengembalikan HTTP 403 Forbidden -> harus melempar REFERENCE_FETCH_FORBIDDEN */
        installMockFetch(() => new Response("Access Denied", { status: 403 }));

        await assert.rejects(
            () =>
                createVideoTask(
                    {
                        model: "opus-seedance-2.5-i2v",
                        prompt: "Gerakan kamera halus",
                        image_url: "https://cdn-edge.example.com/media-item",
                        duration: 5
                    },
                    "opus-bearer-test-token"
                ),
            (err) => {
                assert.equal(err.code, "REFERENCE_FETCH_FORBIDDEN");
                assert.equal(err.status, 422);
                assert.match(err.message, /HTTP 403/i);
                return true;
            }
        );

        /* 3. URL mengembalikan bytes gambar valid -> fallback awaiting_upload + PUT berhasil menyelesaikan task! */
        installMockFetch(() =>
            new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]), {
                status: 200,
                headers: { "Content-Type": "image/jpeg" }
            })
        );

        const task = await createVideoTask(
            {
                model: "opus-seedance-2.5-i2v",
                prompt: "Gerakan kamera halus",
                image_url: "https://cdn-edge.example.com/media-item",
                duration: 5
            },
            "opus-bearer-test-token"
        );
        assert.equal(task.taskId, "opus:proj-1:job-ok-1");
    } finally {
        global.fetch = originalFetch;
    }
});
