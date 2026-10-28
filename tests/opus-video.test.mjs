import test from "node:test";
import assert from "node:assert/strict";

import opusVideoModels, {
    OPUS_VIDEO_SPECS,
    getOpusVideoModel
} from "../models/opus-video/index.js";

import {
    encodeOpusTaskId,
    extractVideoUrls,
    parseOpusTaskId,
    redactSecrets,
    translateOpusError
} from "../provider/opus/client.js";

import {
    isOpusModel,
    resolveBillableCredit,
    resolveQuotaUsageSeconds
} from "../lib/generate/qwencloud-credit.js";

import {
    getModelLogoFile
} from "../generate/assets/js/generate-model-logo.js";

/* =========================================================
   1. REGISTRY, LOGO, DAN VALIDASI ADAPTER MODEL
========================================================= */

test("semua spec Opus menghasilkan adapter lengkap dengan logo valid", () => {
    assert.equal(opusVideoModels.length, OPUS_VIDEO_SPECS.length);
    assert.equal(opusVideoModels.length, 6);

    for (const adapter of opusVideoModels) {
        assert.equal(adapter.config.providerId, "opus");
        assert.equal(adapter.config.providerName, "Opus");
        assert.ok(adapter.config.logo === "seedance.svg" || adapter.config.logo === "minimax.svg");
        assert.equal(getOpusVideoModel(adapter.config.id), adapter);

        const resolvedLogo = getModelLogoFile({
            model_id: adapter.config.id,
            model_name: adapter.config.name,
            provider_id: adapter.config.providerId,
            provider_name: adapter.config.providerName,
            logo: adapter.config.logo
        });
        assert.equal(resolvedLogo, adapter.config.logo);

        const legacyLogo = getModelLogoFile({
            model_id: adapter.config.id,
            model_name: adapter.config.name,
            provider_id: adapter.config.providerId,
            provider_name: adapter.config.providerName
        });
        assert.equal(legacyLogo, adapter.config.logo);
    }
});

test("Seedance 2.5 mendukung durasi 4–30 detik dan generate_audio", () => {
    const model = getOpusVideoModel("opus-seedance-2.5-t2v");
    assert.ok(model);

    const valid30 = model.validate({
        prompt: "Kamera mendorong perlahan ke cangkir kopi hangat di meja kayu pagi hari",
        aspect_ratio: "9:16",
        resolution: "720p",
        duration: "30",
        generate_audio: true
    });
    assert.equal(valid30.valid, true, valid30.errors.join("; "));

    const payload = model.buildPayload({
        prompt: "Dialog hangat",
        aspect_ratio: "9:16",
        resolution: "480p",
        duration: "20",
        generate_audio: true
    });
    assert.equal(payload.model, "seedance-2.5");
    assert.equal(payload.workflow, "reference2video");
    assert.equal(payload.duration, 20);
    assert.equal(payload.resolution, "480p");
    assert.equal(payload.generate_audio, true);

    const tooShort = model.validate({ prompt: "Tes", duration: "3" });
    assert.equal(tooShort.valid, false);

    const tooLong = model.validate({ prompt: "Tes", duration: "35" });
    assert.equal(tooLong.valid, false);
});

test("Seedance 2.5 R2V membatasi referensi maksimal 3 gambar", () => {
    const r2v = getOpusVideoModel("opus-seedance-2.5-r2v");
    assert.ok(r2v);

    const missingRef = r2v.validate({
        prompt: "@image1 berjalan di taman kota",
        image_urls: []
    });
    assert.equal(missingRef.valid, false);

    const okThree = r2v.validate({
        prompt: "@image1 memegang @image2 di latar @image3",
        image_urls: [
            "https://cdn.example.com/1.jpg",
            "https://cdn.example.com/2.png",
            "https://cdn.example.com/3.webp"
        ],
        duration: "10"
    });
    assert.equal(okThree.valid, true, okThree.errors.join("; "));

    const fourRefs = r2v.validate({
        prompt: "Terlalu banyak referensi",
        image_urls: [
            "https://cdn.example.com/1.jpg",
            "https://cdn.example.com/2.jpg",
            "https://cdn.example.com/3.jpg",
            "https://cdn.example.com/4.jpg"
        ]
    });
    assert.equal(fourRefs.valid, false);
});

test("MiniMax Hailuo 3 memetakan alias resolusi 720p->768p dan 1080p->2k serta mendukung first+last frame", () => {
    const hailuoI2v = getOpusVideoModel("opus-hailuo-3-i2v");
    assert.ok(hailuoI2v);

    const paramsFromAlias = hailuoI2v.getParameters({
        prompt: "Transisi mulus dari siang ke malam",
        image_url: "https://cdn.example.com/start.jpg",
        last_frame_url: "https://cdn.example.com/end.jpg",
        resolution: "1080p",
        duration: "10"
    });
    assert.equal(paramsFromAlias.resolution, "2k");

    const validation = hailuoI2v.validate(paramsFromAlias);
    assert.equal(validation.valid, true, validation.errors.join("; "));

    const payload = hailuoI2v.buildPayload(paramsFromAlias);
    assert.equal(payload.model, "hailuo-3");
    assert.equal(payload.workflow, "first_last_frame");
    assert.equal(payload.resolution, "2k");
    assert.equal(payload.first_frame_url, "https://cdn.example.com/start.jpg");
    assert.equal(payload.last_frame_url, "https://cdn.example.com/end.jpg");
    assert.equal(payload.aspect_ratio, undefined);
});

/* =========================================================
   2. BILLING KREDIT PER BLOK 5 DETIK UNTUK OPUS
========================================================= */

test("resolveBillableCredit menghitung faktor durasi 5 detik untuk model Opus", () => {
    assert.equal(isOpusModel({ providerId: "opus" }, ""), true);
    assert.equal(isOpusModel(null, "opus-seedance-2.5-t2v"), true);
    assert.equal(isOpusModel({ providerId: "motiongen" }, "seedance-25-studio-s14"), false);

    const block1 = resolveBillableCredit(25, { duration: "5" }, { providerId: "opus" }, "opus-seedance-2.5-t2v");
    assert.equal(block1.durationFactor, 1);
    assert.equal(block1.billableCredit, 25);

    const block6 = resolveBillableCredit(25, { duration: "30" }, { providerId: "opus" }, "opus-seedance-2.5-t2v");
    assert.equal(block6.durationFactor, 6);
    assert.equal(block6.billableCredit, 150);

    /* Kuota tier gratis QwenCloud tidak boleh terpengaruh oleh provider opus */
    assert.equal(resolveQuotaUsageSeconds(15, 5, "opus"), null);
});

/* =========================================================
   3. ENCODING TASK ID, VIDEO URL FILTER, DAN ERROR TRANSLATION
========================================================= */

test("encodeOpusTaskId dan parseOpusTaskId menjaga projectId + jobId secara utuh", () => {
    const encoded = encodeOpusTaskId("proj_abc123", "job_xyz987");
    assert.equal(encoded, "opus:proj_abc123:job_xyz987");

    const parsed = parseOpusTaskId(encoded);
    assert.equal(parsed.projectId, "proj_abc123");
    assert.equal(parsed.jobId, "job_xyz987");
    assert.equal(parsed.isInlineDone, false);

    const noProj = parseOpusTaskId(encodeOpusTaskId("", "job_only_1"));
    assert.equal(noProj.projectId, "");
    assert.equal(noProj.jobId, "job_only_1");
});

test("extractVideoUrls memilih URL video output dan mengabaikan gambar referensi/thumbnail", () => {
    const sample = {
        status: "completed",
        firstFrameUrl: "https://cdn.example.com/input-frame.jpg",
        thumbnailUrl: "https://cdn.example.com/thumb.png",
        outputs: [
            {
                mimeType: "image/jpeg",
                url: "https://cdn.example.com/cover.jpg"
            },
            {
                mimeType: "video/mp4",
                downloadUrl: "https://cdn.opus.pro/renders/final-clip.mp4?sig=123",
                durationSeconds: 10
            }
        ]
    };

    const urls = extractVideoUrls(sample);
    assert.deepEqual(urls, ["https://cdn.opus.pro/renders/final-clip.mp4?sig=123"]);
});

test("translateOpusError dan redactSecrets mengamankan pesan error ke Bahasa Indonesia", () => {
    assert.match(translateOpusError("credit_admission_rejected"), /Saldo kredit akun Opus Labs/i);
    assert.match(translateOpusError("content_policy"), /kebijakan keamanan Opus Labs/i);
    assert.match(translateOpusError("submission_unknown"), /submission_unknown/i);

    const scrubbed = redactSecrets("Authorization: Bearer secretJwt12345 token=myRefresh9999", ["myRefresh9999"]);
    assert.ok(!scrubbed.includes("secretJwt12345"));
    assert.ok(!scrubbed.includes("myRefresh9999"));
});

/* =========================================================
   4. END-TO-END MCP FLOW: AWAITING_UPLOAD + CREATE + POLL
========================================================= */

test("alur lengkap MCP: OAuth refresh, import_assets awaiting_upload, generate_video_clips, dan get_status watch:false", async () => {
    const originalFetch = globalThis.fetch;
    const mcpCalls = [];
    const putUploads = [];
    let pollCount = 0;

    const fakeTools = [
        {
            name: "opus_video_tools_whoami",
            inputSchema: { type: "object", properties: {} }
        },
        {
            name: "create_project",
            inputSchema: {
                type: "object",
                properties: {
                    name: { type: "string" },
                    requestKey: { type: "string", format: "uuid" }
                },
                required: ["name", "requestKey"]
            }
        },
        {
            name: "import_assets",
            inputSchema: {
                type: "object",
                properties: {
                    projectId: { type: "string" },
                    requestKey: { type: "string", format: "uuid" },
                    assets: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                clientId: { type: "string" },
                                assetId: { type: "string" },
                                fileName: { type: "string" },
                                mimeType: { type: "string" },
                                status: { type: "string", enum: ["uploaded", "ready"] }
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
                    requestKey: { type: "string", format: "uuid" },
                    clips: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                clipId: { type: "string" },
                                outputLabel: { type: "string" },
                                model: { type: "string", enum: ["seedance-2.5", "seedance-2.0", "hailuo-3"] },
                                workflow: { type: "string", enum: ["reference2video", "first_last_frame"] },
                                prompt: { type: "string" },
                                durationSeconds: { type: "integer" },
                                resolution: { type: "string", enum: ["480p", "720p", "768p", "2k"] },
                                aspectRatio: { type: "string", enum: ["9:16", "16:9", "1:1"] },
                                generateAudio: { type: "boolean" },
                                referenceAssets: {
                                    type: "array",
                                    items: {
                                        type: "object",
                                        properties: {
                                            assetId: { type: "string" },
                                            label: { type: "string" },
                                            role: { type: "string" }
                                        },
                                        required: ["assetId"]
                                    }
                                }
                            },
                            required: ["clipId", "model", "workflow", "prompt", "durationSeconds"]
                        }
                    }
                },
                required: ["projectId", "requestKey", "clips"]
            }
        },
        {
            name: "get_status",
            inputSchema: {
                type: "object",
                properties: {
                    projectId: { type: "string" },
                    jobId: { type: "string" },
                    watch: { type: "boolean" }
                },
                required: ["jobId"]
            }
        }
    ];

    globalThis.fetch = async (url, init = {}) => {
        const target = String(url);

        if (target === "https://focused-horizon-38.authkit.app/oauth2/token") {
            return new Response(
                JSON.stringify({
                    access_token: "fresh_access_token_opus",
                    refresh_token: "fresh_refresh_token_opus",
                    expires_in: 3600
                }),
                { status: 200, headers: { "Content-Type": "application/json" } }
            );
        }

        if (target === "https://cdn.example.com/ref-product.jpg") {
            return new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), {
                status: 200,
                headers: { "Content-Type": "image/jpeg" }
            });
        }

        if (target === "https://storage.opus.pro/presigned-put/asset_ref_01") {
            putUploads.push({
                method: init.method,
                contentType: init.headers?.["Content-Type"] || init.headers?.["content-type"],
                byteLength: init.body?.byteLength || 0
            });
            return new Response("", { status: 200 });
        }

        if (target === "https://labs.opus.pro/opus-video-tools/mcp") {
            const rpc = JSON.parse(String(init.body || "{}"));
            mcpCalls.push(rpc);

            if (rpc.method === "initialize") {
                return new Response(
                    JSON.stringify({
                        jsonrpc: "2.0",
                        id: rpc.id,
                        result: { protocolVersion: "2025-03-26", serverInfo: { name: "opus-mcp" } }
                    }),
                    {
                        status: 200,
                        headers: {
                            "Content-Type": "application/json",
                            "Mcp-Session-Id": "sess_opus_test_1"
                        }
                    }
                );
            }

            if (rpc.method === "notifications/initialized") {
                return new Response("", { status: 202 });
            }

            if (rpc.method === "tools/list") {
                return new Response(
                    JSON.stringify({
                        jsonrpc: "2.0",
                        id: rpc.id,
                        result: { tools: fakeTools }
                    }),
                    { status: 200, headers: { "Content-Type": "application/json" } }
                );
            }

            if (rpc.method === "tools/call") {
                const { name, arguments: args } = rpc.params;

                if (name === "opus_video_tools_whoami") {
                    return new Response(
                        JSON.stringify({
                            jsonrpc: "2.0",
                            id: rpc.id,
                            result: { structuredContent: { orgId: "org_1" } }
                        }),
                        { status: 200, headers: { "Content-Type": "application/json" } }
                    );
                }

                if (name === "create_project") {
                    return new Response(
                        JSON.stringify({
                            jsonrpc: "2.0",
                            id: rpc.id,
                            result: { structuredContent: { projectId: "proj_live_77" } }
                        }),
                        { status: 200, headers: { "Content-Type": "application/json" } }
                    );
                }

                if (name === "import_assets") {
                    const firstAsset = args.assets?.[0] || {};
                    if (!firstAsset.assetId) {
                        return new Response(
                            JSON.stringify({
                                jsonrpc: "2.0",
                                id: rpc.id,
                                result: {
                                    structuredContent: {
                                        assets: [
                                            {
                                                clientId: firstAsset.clientId,
                                                assetId: "asset_ref_01",
                                                status: "awaiting_upload",
                                                uploadUrl: "https://storage.opus.pro/presigned-put/asset_ref_01"
                                            }
                                        ]
                                    }
                                }
                            }),
                            { status: 200, headers: { "Content-Type": "application/json" } }
                        );
                    }
                    return new Response(
                        JSON.stringify({
                            jsonrpc: "2.0",
                            id: rpc.id,
                            result: {
                                structuredContent: {
                                    assets: [
                                        {
                                            assetId: "asset_ref_01",
                                            status: "ready"
                                        }
                                    ]
                                }
                            }
                        }),
                        { status: 200, headers: { "Content-Type": "application/json" } }
                    );
                }

                if (name === "generate_video_clips") {
                    return new Response(
                        JSON.stringify({
                            jsonrpc: "2.0",
                            id: rpc.id,
                            result: {
                                structuredContent: {
                                    projectId: args.projectId,
                                    jobs: [
                                        {
                                            jobId: "job_vid_9901",
                                            status: "queued"
                                        }
                                    ]
                                }
                            }
                        }),
                        { status: 200, headers: { "Content-Type": "application/json" } }
                    );
                }

                if (name === "get_status") {
                    pollCount += 1;
                    if (pollCount === 1) {
                        return new Response(
                            JSON.stringify({
                                jsonrpc: "2.0",
                                id: rpc.id,
                                result: {
                                    structuredContent: {
                                        jobId: args.jobId,
                                        status: "running",
                                        firstFrameUrl: "https://cdn.example.com/ref-product.jpg"
                                    }
                                }
                            }),
                            { status: 200, headers: { "Content-Type": "application/json" } }
                        );
                    }
                    return new Response(
                        JSON.stringify({
                            jsonrpc: "2.0",
                            id: rpc.id,
                            result: {
                                structuredContent: {
                                    jobId: args.jobId,
                                    status: "completed",
                                    durationSeconds: 10,
                                    outputs: [
                                        {
                                            mimeType: "video/mp4",
                                            downloadUrl: "https://cdn.opus.pro/videos/job_vid_9901.mp4"
                                        }
                                    ]
                                }
                            }
                        }),
                        { status: 200, headers: { "Content-Type": "application/json" } }
                    );
                }
            }
        }

        throw new Error(`Unexpected fetch URL in test: ${target}`);
    };

    try {
        const model = getOpusVideoModel("opus-seedance-2.5-r2v");
        const oauthJsonCredential = JSON.stringify({
            refresh_token: "rt_workos_test_123",
            client_id: "client_test_opus"
        });

        const created = await model.createTask(
            {
                prompt: "Kamera berputar halus menampilkan @image1 di atas meja marmer",
                image_urls: ["https://cdn.example.com/ref-product.jpg"],
                aspect_ratio: "9:16",
                resolution: "720p",
                duration: "10",
                generate_audio: true
            },
            oauthJsonCredential
        );

        assert.equal(created.taskId, "opus:proj_live_77:job_vid_9901");
        assert.equal(putUploads.length, 1);
        assert.equal(putUploads[0].method, "PUT");
        assert.equal(putUploads[0].byteLength, 4);

        const genCall = mcpCalls.find(c => c.method === "tools/call" && c.params?.name === "generate_video_clips");
        assert.ok(genCall);
        assert.equal(genCall.params.arguments.projectId, "proj_live_77");
        const clipArg = genCall.params.arguments.clips[0];
        assert.equal(clipArg.model, "seedance-2.5");
        assert.equal(clipArg.workflow, "reference2video");
        assert.equal(clipArg.durationSeconds, 10);
        assert.equal(clipArg.resolution, "720p");
        assert.equal(clipArg.aspectRatio, "9:16");
        assert.equal(clipArg.generateAudio, true);
        assert.equal(clipArg.referenceAssets[0].assetId, "asset_ref_01");

        /* Poll #1: masih running -> tidak boleh ada URL bocor di raw maupun outputUrls */
        const pollRunning = await model.queryTask(created.taskId, oauthJsonCredential);
        assert.equal(pollRunning.status, "PROCESSING");
        assert.equal(pollRunning.processing, true);
        assert.equal(pollRunning.completed, false);
        assert.deepEqual(pollRunning.outputUrls, []);
        assert.ok(!JSON.stringify(pollRunning.raw).includes("https://"));

        const statusCall = mcpCalls.find(c => c.method === "tools/call" && c.params?.name === "get_status");
        assert.equal(statusCall.params.arguments.projectId, "proj_live_77");
        assert.equal(statusCall.params.arguments.jobId, "job_vid_9901");
        assert.equal(statusCall.params.arguments.watch, false);

        /* Poll #2: completed -> mengembalikan URL MP4 dan usage.duration */
        const pollDone = await model.queryTask(created.taskId, oauthJsonCredential);
        assert.equal(pollDone.status, "COMPLETED");
        assert.equal(pollDone.completed, true);
        assert.deepEqual(pollDone.outputUrls, ["https://cdn.opus.pro/videos/job_vid_9901.mp4"]);
        assert.equal(pollDone.usage?.duration, 10);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("Opus MCP: memulihkan jobId via list_jobs saat generate_video_clips sukses tanpa jobId inline + toleransi job_not_found + sibling assets/resolve_job", async () => {
    const originalFetch = globalThis.fetch;
    let statusCallCount = 0;
    let listJobsCalled = 0;
    let resolveJobCalled = false;

    const fakeTools = [
        { name: "opus_video_tools_whoami", inputSchema: { type: "object", properties: {} } },
        {
            name: "create_project",
            inputSchema: {
                type: "object",
                properties: { name: { type: "string" }, requestKey: { type: "string" } }
            }
        },
        {
            name: "generate_video_clips",
            inputSchema: {
                type: "object",
                properties: {
                    projectId: { type: "string" },
                    requestKey: { type: "string" },
                    clips: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                clipId: { type: "string" },
                                model: { type: "string" },
                                workflow: { type: "string" },
                                prompt: { type: "string" },
                                durationSeconds: { type: "integer" },
                                resolution: { type: "string" },
                                aspectRatio: { type: "string" }
                            }
                        }
                    }
                }
            }
        },
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
        },
        {
            name: "get_status",
            inputSchema: {
                type: "object",
                required: ["jobIds"],
                properties: {
                    projectId: { type: "string" },
                    jobIds: { type: "array", items: { type: "string" } },
                    watch: { type: "boolean" }
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

    globalThis.fetch = async (url, init = {}) => {
        if (String(url) !== "https://labs.opus.pro/opus-video-tools/mcp") {
            throw new Error(`Unexpected fetch URL: ${url}`);
        }
        const rpc = JSON.parse(String(init.body || "{}"));
        if (rpc.method === "initialize") {
            return Response.json(
                { jsonrpc: "2.0", id: rpc.id, result: { protocolVersion: "2025-03-26" } },
                { headers: { "Mcp-Session-Id": "sess_no_inline_jobid" } }
            );
        }
        if (rpc.method === "notifications/initialized") {
            return new Response("", { status: 202 });
        }
        if (rpc.method === "tools/list") {
            return Response.json({ jsonrpc: "2.0", id: rpc.id, result: { tools: fakeTools } });
        }
        if (rpc.method === "tools/call") {
            const { name, arguments: args } = rpc.params;
            if (name === "opus_video_tools_whoami") {
                return Response.json({ jsonrpc: "2.0", id: rpc.id, result: { structuredContent: { orgId: "org_1" } } });
            }
            if (name === "create_project") {
                return Response.json({ jsonrpc: "2.0", id: rpc.id, result: { structuredContent: { projectId: "proj_no_inline_01" } } });
            }
            if (name === "generate_video_clips") {
                /* Respons nyata produksi: sukses mengantrekan clip tanpa menyertakan jobId inline */
                return Response.json({
                    jsonrpc: "2.0",
                    id: rpc.id,
                    result: {
                        structuredContent: {
                            projectId: args.projectId,
                            items: [{ id: "clip-1", ok: true, status: "queued" }]
                        }
                    }
                });
            }
            if (name === "list_jobs") {
                listJobsCalled += 1;
                return Response.json({
                    jsonrpc: "2.0",
                    id: rpc.id,
                    result: {
                        structuredContent: {
                            projectId: args.projectId,
                            jobs: { "clip-1": "job_listed_vid_501" }
                        }
                    }
                });
            }
            if (name === "get_status") {
                statusCallCount += 1;
                assert.deepEqual(args.jobIds, ["job_listed_vid_501"]);
                if (statusCallCount === 1) {
                    /* Eventual consistency sesaat setelah submit */
                    return Response.json({
                        jsonrpc: "2.0",
                        id: rpc.id,
                        result: {
                            structuredContent: {
                                projectId: args.projectId,
                                error: "job_not_found"
                            }
                        }
                    });
                }
                /* Sudah completed tetapi URL unduhan baru tersedia melalui resolve_job */
                return Response.json({
                    jsonrpc: "2.0",
                    id: rpc.id,
                    result: {
                        structuredContent: {
                            projectId: args.projectId,
                            jobs: [{ id: "job_listed_vid_501", status: "completed", durationSeconds: 5 }]
                        }
                    }
                });
            }
            if (name === "resolve_job") {
                resolveJobCalled = true;
                assert.equal(args.jobId, "job_listed_vid_501");
                return Response.json({
                    jsonrpc: "2.0",
                    id: rpc.id,
                    result: {
                        structuredContent: {
                            jobId: args.jobId,
                            status: "completed",
                            assets: [{ assetId: "ast_v_501", downloadUrl: "https://cdn.opus.pro/videos/resolved-501.mp4" }]
                        }
                    }
                });
            }
        }
        throw new Error(`Unhandled RPC: ${rpc.method}`);
    };

    try {
        const model = getOpusVideoModel("opus-seedance-2.5-t2v");
        const token = "opus-mock-bearer-token";

        const created = await model.createTask(
            { prompt: "Kucing oranye berlari di taman bunga matahari", duration: "5", resolution: "720p", aspect_ratio: "9:16" },
            token
        );

        assert.equal(created.taskId, "opus:proj_no_inline_01:job_listed_vid_501");
        assert.ok(listJobsCalled >= 1);

        /* Poll 1: job_not_found sementara -> tetap QUEUED/PROCESSING, tidak boleh FAILED */
        const poll1 = await model.queryTask(created.taskId, token);
        assert.equal(poll1.failed, false);
        assert.equal(poll1.processing, true);

        /* Poll 2: completed tanpa URL di get_status -> otomatis resolve_job dan mengembalikan MP4 */
        const poll2 = await model.queryTask(created.taskId, token);
        assert.equal(resolveJobCalled, true);
        assert.equal(poll2.status, "COMPLETED");
        assert.deepEqual(poll2.outputUrls, ["https://cdn.opus.pro/videos/resolved-501.mp4"]);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("Opus MCP: mempertahankan task QUEUED berbasis projectId saat jobId baru muncul beberapa detik kemudian di list_jobs", async () => {
    const originalFetch = globalThis.fetch;
    let projectJobReady = false;

    const fakeTools = [
        { name: "opus_video_tools_whoami", inputSchema: { type: "object", properties: {} } },
        { name: "create_project", inputSchema: { type: "object", properties: { name: { type: "string" } } } },
        { name: "generate_video_clips", inputSchema: { type: "object", properties: { projectId: { type: "string" }, prompt: { type: "string" } } } },
        { name: "list_jobs", inputSchema: { type: "object", properties: { projectId: { type: "string" } } } },
        { name: "get_status", inputSchema: { type: "object", required: ["jobId"], properties: { projectId: { type: "string" }, jobId: { type: "string" }, watch: { type: "boolean" } } } }
    ];

    globalThis.fetch = async (url, init = {}) => {
        const rpc = JSON.parse(String(init.body || "{}"));
        if (rpc.method === "initialize") {
            return Response.json(
                { jsonrpc: "2.0", id: rpc.id, result: { protocolVersion: "2025-03-26" } },
                { headers: { "Mcp-Session-Id": "sess_delayed_job" } }
            );
        }
        if (rpc.method === "notifications/initialized") return new Response("", { status: 202 });
        if (rpc.method === "tools/list") return Response.json({ jsonrpc: "2.0", id: rpc.id, result: { tools: fakeTools } });
        if (rpc.method === "tools/call") {
            const { name, arguments: args } = rpc.params;
            if (name === "opus_video_tools_whoami") return Response.json({ jsonrpc: "2.0", id: rpc.id, result: { structuredContent: { orgId: "org_1" } } });
            if (name === "create_project") return Response.json({ jsonrpc: "2.0", id: rpc.id, result: { structuredContent: { projectId: "proj_delayed_09" } } });
            if (name === "generate_video_clips") {
                return Response.json({
                    jsonrpc: "2.0",
                    id: rpc.id,
                    result: { content: [{ type: "text", text: "Video generation request accepted into project queue." }] }
                });
            }
            if (name === "list_jobs") {
                if (!projectJobReady) {
                    return Response.json({ jsonrpc: "2.0", id: rpc.id, result: { structuredContent: { projectId: args.projectId, jobs: [] } } });
                }
                return Response.json({
                    jsonrpc: "2.0",
                    id: rpc.id,
                    result: {
                        structuredContent: {
                            projectId: args.projectId,
                            jobs: [{ id: "job_delayed_777", status: "running" }]
                        }
                    }
                });
            }
            if (name === "get_status") {
                return Response.json({
                    jsonrpc: "2.0",
                    id: rpc.id,
                    result: {
                        structuredContent: {
                            projectId: args.projectId,
                            jobs: [{ id: args.jobId, status: "completed", outputAssetId: "ast_out_777" }],
                            assets: [
                                { assetId: "ast_ref_input", role: "reference", url: "https://cdn.opus.pro/ref/input.mp4" },
                                { assetId: "ast_out_777", resultUrl: "https://cdn.opus.pro/videos/final-777.mp4" }
                            ]
                        }
                    }
                });
            }
        }
        throw new Error(`Unhandled RPC: ${rpc.method}`);
    };

    try {
        const model = getOpusVideoModel("opus-hailuo-3-t2v");
        const token = "opus-mock-bearer-token";

        /* Saat createTask, list_jobs masih kosong -> TIDAK boleh gagal MISSING_TASK_ID */
        const created = await model.createTask(
            { prompt: "Ombak laut biru sinematik saat matahari terbenam", duration: "5", resolution: "768p", aspect_ratio: "9:16" },
            token
        );
        assert.equal(created.taskId, "opus:proj_delayed_09:__project_pending__");
        assert.equal(created.status, "QUEUED");

        /* Poll 1 sebelum job muncul di list_jobs -> tetap QUEUED */
        const pollEarly = await model.queryTask(created.taskId, token);
        assert.equal(pollEarly.status, "QUEUED");
        assert.equal(pollEarly.processing, true);

        /* Sekarang job sudah muncul di proyek Opus dan selesai */
        projectJobReady = true;
        const pollCompleted = await model.queryTask(created.taskId, token);
        assert.equal(pollCompleted.status, "COMPLETED");
        assert.equal(pollCompleted.taskId, created.taskId, "taskId asli tetap dipertahankan untuk sinkronisasi generation_history");
        assert.equal(pollCompleted.jobId, "job_delayed_777");
        /* Harus mengambil ast_out_777, bukan ast_ref_input */
        assert.deepEqual(pollCompleted.outputUrls, ["https://cdn.opus.pro/videos/final-777.mp4"]);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("Opus MCP: meneruskan durasi 30 detik secara utuh pada schema clips[] gabungan allOf + anyOf, mencocokkan bytedance/seedance-2.5 tanpa tertipu seedance-2, dan fallback import_assets dataUrl", async () => {
    const originalFetch = globalThis.fetch;
    let capturedClipArgs = null;
    let importCallCount = 0;

    const fakeTools = [
        { name: "opus_video_tools_whoami", inputSchema: { type: "object", properties: {} } },
        { name: "create_project", inputSchema: { type: "object", properties: { name: { type: "string" } } } },
        {
            name: "import_assets",
            inputSchema: {
                type: "object",
                properties: {
                    projectId: { type: "string" },
                    requestKey: { type: "string" },
                    items: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                clientId: { type: "string" },
                                fileName: { type: "string" },
                                mimeType: { type: "string" },
                                url: { type: "string" },
                                dataUrl: { type: "string" },
                                sizeBytes: { type: "integer" }
                            }
                        }
                    }
                }
            }
        },
        {
            name: "generate_video_clips",
            inputSchema: {
                $defs: {
                    BaseClip: {
                        type: "object",
                        required: ["id", "prompt"],
                        properties: {
                            id: { type: "string" },
                            outputLabel: { type: "string" },
                            prompt: { type: "string" }
                        }
                    },
                    Seedance20RefBranch: {
                        type: "object",
                        required: ["workflow", "model"],
                        properties: {
                            workflow: { const: "reference2video" },
                            model: { enum: ["seedance", "seedance-2"] },
                            durationSec: { type: "integer", minimum: 4, maximum: 15, default: 5 },
                            aspect: { enum: ["9:16", "16:9", "1:1"] },
                            referenceAssets: { type: "array", items: { type: "string" } }
                        }
                    },
                    Seedance25FrameBranch: {
                        type: "object",
                        required: ["workflow", "model"],
                        properties: {
                            workflow: { const: "first_last_frame" },
                            /* Urutan sengaja menaruh "seedance" & "seedance-2" lebih dulu untuk menguji anti-substring bug */
                            model: { enum: ["seedance", "seedance-2", "bytedance/seedance-2.5", "minimax/hailuo-3"] },
                            durationSec: {
                                anyOf: [
                                    { enum: [-1] },
                                    { type: "integer", minimum: 4, maximum: 30, default: 5 }
                                ]
                            },
                            resolution: { enum: ["480p", "720p"] },
                            generateAudio: { type: "boolean" },
                            firstFrame: { type: "string" },
                            aspect: { enum: ["adaptive", "9:16", "16:9"] }
                        }
                    }
                },
                type: "object",
                required: ["projectId", "clips"],
                properties: {
                    projectId: { type: "string" },
                    requestKey: { type: "string" },
                    clips: {
                        type: "array",
                        items: {
                            allOf: [
                                { $ref: "#/$defs/BaseClip" },
                                {
                                    anyOf: [
                                        { $ref: "#/$defs/Seedance20RefBranch" },
                                        { $ref: "#/$defs/Seedance25FrameBranch" }
                                    ]
                                }
                            ]
                        }
                    }
                }
            }
        }
    ];

    globalThis.fetch = async (url, init = {}) => {
        if (String(url) === "https://private-bucket.example.com/first-frame.png") {
            return new Response(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), {
                status: 200,
                headers: { "Content-Type": "image/png" }
            });
        }
        const rpc = JSON.parse(String(init.body || "{}"));
        if (rpc.method === "initialize") {
            return Response.json(
                { jsonrpc: "2.0", id: rpc.id, result: { protocolVersion: "2025-03-26" } },
                { headers: { "Mcp-Session-Id": "sess_30s_union" } }
            );
        }
        if (rpc.method === "notifications/initialized") return new Response("", { status: 202 });
        if (rpc.method === "tools/list") return Response.json({ jsonrpc: "2.0", id: rpc.id, result: { tools: fakeTools } });
        if (rpc.method === "tools/call") {
            const { name, arguments: args } = rpc.params;
            if (name === "opus_video_tools_whoami") {
                return Response.json({ jsonrpc: "2.0", id: rpc.id, result: { structuredContent: { orgId: "org_1" } } });
            }
            if (name === "create_project") {
                return Response.json({ jsonrpc: "2.0", id: rpc.id, result: { structuredContent: { projectId: "proj_30s_01" } } });
            }
            if (name === "import_assets") {
                importCallCount += 1;
                const item = args.items[0];
                if (item.url && !item.dataUrl) {
                    /* Simulasikan kegagalan remote fetch Opus saat menarik signed URL eksternal */
                    return Response.json({
                        jsonrpc: "2.0",
                        id: rpc.id,
                        result: {
                            structuredContent: {
                                items: [{ clientId: item.clientId, ok: false, error: "remote_url_unreachable" }]
                            }
                        }
                    });
                }
                assert.match(item.dataUrl, /^data:image\/png;base64,/);
                return Response.json({
                    jsonrpc: "2.0",
                    id: rpc.id,
                    result: {
                        structuredContent: {
                            items: [{ clientId: item.clientId, ok: true, asset: { id: "ast_durable_ff_30s" } }]
                        }
                    }
                });
            }
            if (name === "generate_video_clips") {
                capturedClipArgs = args;
                return Response.json({
                    jsonrpc: "2.0",
                    id: rpc.id,
                    result: {
                        structuredContent: {
                            projectId: args.projectId,
                            jobId: "job_30s_ok_01",
                            status: "queued"
                        }
                    }
                });
            }
        }
        throw new Error(`Unhandled RPC: ${rpc.method}`);
    };

    try {
        const model = getOpusVideoModel("opus-seedance-2.5-i2v");
        const created = await model.createTask(
            {
                prompt: "Kamera dolly-in perlahan melintasi kota cyberpunk hujan malam selama 30 detik penuh",
                image_url: "https://private-bucket.example.com/first-frame.png",
                duration: "30",
                resolution: "480p",
                generate_audio: true
            },
            "opus-mock-bearer-token"
        );

        assert.equal(importCallCount, 2, "harus fallback ke dataUrl setelah remote URL import gagal");
        assert.ok(capturedClipArgs, "generate_video_clips wajib dipanggil");
        assert.equal(capturedClipArgs.clips.length, 1);

        const clip = capturedClipArgs.clips[0];
        assert.equal(clip.id, "clip-1");
        assert.equal(clip.outputLabel, "clip-1");
        assert.equal(clip.workflow, "first_last_frame");
        assert.equal(clip.model, "bytedance/seedance-2.5", "tidak boleh salah mencocokkan 'seedance' atau 'seedance-2'");
        assert.equal(clip.durationSec, 30, "durasi 30 detik wajib terkirim utuh sebagai integer 30, bukan hilang ke default 5 detik");
        assert.equal(clip.resolution, "480p");
        assert.equal(clip.generateAudio, true);
        assert.equal(clip.firstFrame, "ast_durable_ff_30s");
        assert.equal(clip.aspect, undefined, "aspect tidak boleh dipaksakan pada first_last_frame jika tidak required");

        assert.equal(created.mcpRequestSummary?.durationKey, "durationSec");
        assert.equal(created.mcpRequestSummary?.durationValue, 30);
        assert.equal(created.mcpRequestSummary?.model, "bytedance/seedance-2.5");
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("Opus MCP: mengisi durasi pada nested config ('30s' + autoDuration:false + durationMode:'fixed'), top-level durationMs, dan membedakan requestKey antar varian berbeda", async () => {
    const originalFetch = globalThis.fetch;
    const seenCalls = [];

    const fakeTools = [
        { name: "opus_video_tools_whoami", inputSchema: { type: "object", properties: {} } },
        { name: "create_project", inputSchema: { type: "object", properties: { name: { type: "string" } } } },
        {
            name: "generate_video_clips",
            inputSchema: {
                type: "object",
                required: ["projectId", "clips"],
                properties: {
                    projectId: { type: "string" },
                    requestKey: { type: "string" },
                    durationMs: { type: "integer" },
                    clips: {
                        type: "array",
                        items: {
                            type: "object",
                            required: ["clipId", "prompt", "config"],
                            properties: {
                                clipId: { type: "string" },
                                label: { type: "string" },
                                prompt: { type: "string" },
                                workflow: { enum: ["reference2video", "first_last_frame"] },
                                config: {
                                    type: "object",
                                    properties: {
                                        modelName: { type: "string" },
                                        targetDuration: { type: "string", pattern: "^\\d+s$" },
                                        autoDuration: { type: "boolean" },
                                        durationMode: { enum: ["auto", "fixed"] },
                                        resolution: { enum: ["480p", "720p"] },
                                        generateAudio: { type: "boolean" }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    ];

    globalThis.fetch = async (_url, init = {}) => {
        const rpc = JSON.parse(String(init.body || "{}"));
        if (rpc.method === "initialize") {
            return Response.json(
                { jsonrpc: "2.0", id: rpc.id, result: { protocolVersion: "2025-03-26" } },
                { headers: { "Mcp-Session-Id": "sess_nested_cfg" } }
            );
        }
        if (rpc.method === "notifications/initialized") return new Response("", { status: 202 });
        if (rpc.method === "tools/list") return Response.json({ jsonrpc: "2.0", id: rpc.id, result: { tools: fakeTools } });
        if (rpc.method === "tools/call") {
            const { name, arguments: args } = rpc.params;
            if (name === "opus_video_tools_whoami") {
                return Response.json({ jsonrpc: "2.0", id: rpc.id, result: { structuredContent: { orgId: "org_1" } } });
            }
            if (name === "create_project") {
                return Response.json({ jsonrpc: "2.0", id: rpc.id, result: { structuredContent: { projectId: "proj_nested_01" } } });
            }
            if (name === "generate_video_clips") {
                seenCalls.push(structuredClone(args));
                if (seenCalls.length === 1) {
                    /* Simulasikan penolakan properti opsional `label` pada varian pertama */
                    return Response.json({
                        jsonrpc: "2.0",
                        id: rpc.id,
                        result: {
                            isError: true,
                            structuredContent: {
                                code: "invalid_arguments",
                                message: "Unrecognized key: label"
                            }
                        }
                    });
                }
                return Response.json({
                    jsonrpc: "2.0",
                    id: rpc.id,
                    result: {
                        structuredContent: {
                            projectId: args.projectId,
                            jobId: "job_nested_30s",
                            status: "queued"
                        }
                    }
                });
            }
        }
        throw new Error(`Unhandled RPC: ${rpc.method}`);
    };

    try {
        const model = getOpusVideoModel("opus-seedance-2.5-t2v");
        const created = await model.createTask(
            {
                prompt: "Astronot berjalan di padang pasir merah Mars",
                duration: "30",
                resolution: "720p",
                aspect_ratio: "16:9",
                generate_audio: true
            },
            "opus-mock-bearer-token"
        );

        assert.equal(seenCalls.length, 2, "harus mencoba varian ringkas setelah invalid_arguments");
        assert.notEqual(
            seenCalls[0].requestKey,
            seenCalls[1].requestKey,
            "varian dengan payload berbeda wajib memakai requestKey UUID baru sesuai aturan idempotensi Opus"
        );

        const acceptedArgs = seenCalls[1];
        assert.equal(acceptedArgs.durationMs, 30000);
        const clip = acceptedArgs.clips[0];
        assert.equal(clip.label, undefined, "varian minimal menghapus label opsional");
        assert.equal(clip.workflow, "reference2video", "workflow tetap dipertahankan pada varian minimal");
        assert.equal(clip.config.targetDuration, "30s");
        assert.equal(clip.config.autoDuration, false);
        assert.equal(clip.config.durationMode, "fixed");
        assert.equal(clip.config.resolution, "720p");
        assert.equal(clip.config.generateAudio, true);
        assert.equal(created.taskId, "opus:proj_nested_01:job_nested_30s");
    } finally {
        globalThis.fetch = originalFetch;
    }
});



