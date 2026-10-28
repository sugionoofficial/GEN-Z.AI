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

import {
    MODEL_FIELDS,
    cleanModel,
    validateModel
} from "../lib/admin-models/validation.js";

import {
    getParameterDefinitions
} from "../generate/assets/js/generate-form-core.js";

import {
    formatEnumLabel
} from "../generate/assets/js/generate-form-fields.js";

import {
    OPUS_QUEUE_FINAL_ERROR_MESSAGE,
    OPUS_QUEUE_MAX_ATTEMPTS,
    OPUS_QUEUE_RETRY_STATUS_LABEL,
    OPUS_QUEUE_RUNTIME_MS,
    OPUS_QUEUE_WAIT_MESSAGE,
    OPUS_SYSTEM_BUSY_FINAL_CODE,
    formatQueueCountdown,
    isOpusUpstreamCreditBusy,
    runOpusQueueRetryLoop
} from "../generate/assets/js/opus-queue-retry.js";

import { readFileSync } from "node:fs";

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
   2. PEMOTONGAN KREDIT SESUAI PENGATURAN EDIT MODEL (FLAT PER RESOLUSI)
========================================================= */

test("resolveBillableCredit memotong credit model Opus tepat sesuai pengaturan Edit Model tanpa dikalikan durasi", () => {
    assert.equal(isOpusModel({ providerId: "opus" }, ""), true);
    assert.equal(isOpusModel(null, "opus-seedance-2.5-t2v"), true);
    assert.equal(isOpusModel({ providerId: "motiongen" }, "seedance-25-studio-s14"), false);

    const shortClip = resolveBillableCredit(5000, { duration: "5" }, { providerId: "opus" }, "opus-seedance-2.5-i2v");
    assert.equal(shortClip.durationFactor, 1);
    assert.equal(shortClip.creditUnit, 5000);
    assert.equal(shortClip.billableCredit, 5000);

    const maxClip30s = resolveBillableCredit(5000, { duration: "30" }, { providerId: "opus" }, "opus-seedance-2.5-i2v");
    assert.equal(maxClip30s.durationSeconds, 30);
    assert.equal(maxClip30s.durationFactor, 1);
    assert.equal(maxClip30s.creditUnit, 5000);
    assert.equal(maxClip30s.billableCredit, 5000, "jika di Edit Model diatur 5000, durasi 30s wajib tetap memotong 5000 (bukan 30000)");

    const hailuo15s = resolveBillableCredit(2500, { duration: "15" }, null, "opus-hailuo-3-t2v");
    assert.equal(hailuo15s.durationFactor, 1);
    assert.equal(hailuo15s.billableCredit, 2500);

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
    const detailedCreditErr = translateOpusError("insufficient_credits", "Required 90 credits, available 24");
    assert.match(detailedCreditErr, /upstream OpusClip/i);
    assert.match(detailedCreditErr, /Required 90 credits, available 24/);
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

test("Seedance 2.5 I2V dan R2V memiliki pilihan durasi terkonfigurasi checkbox serta generate_audio aktif secara default", () => {
    const expectedDurations = ["4", "5", "8", "10", "12", "15", "20", "25", "30"];

    for (const modelId of ["opus-seedance-2.5-i2v", "opus-seedance-2.5-r2v"]) {
        const model = getOpusVideoModel(modelId);
        assert.ok(model, `Model ${modelId} harus terdaftar`);

        assert.equal(model.config.adminEditor.selectableDurations, true);
        assert.deepEqual(
            model.config.adminEditor.durationOptions.map(opt => opt.value),
            expectedDurations
        );

        const durationParam = model.parameters.find(param => param.name === "duration");
        assert.ok(durationParam);
        assert.equal(durationParam.type, "string");
        assert.deepEqual(durationParam.enum, expectedDurations);
        assert.equal(durationParam.default, "5");

        const audioParam = model.parameters.find(param => param.name === "generate_audio");
        assert.ok(audioParam);
        assert.equal(audioParam.default, true);
        assert.equal(audioParam.label, "Generate Audio");

        const defaultParams = model.getParameters({
            prompt: "Adegan sinematik dengan audio bawaan",
            image_url: "https://cdn.example.com/frame.jpg",
            image_urls: ["https://cdn.example.com/ref1.jpg"]
        });
        assert.equal(defaultParams.generate_audio, true, `${modelId} harus mengaktifkan generate_audio secara default`);

        const defaultPayload = model.buildPayload({
            prompt: "Adegan sinematik dengan audio bawaan",
            image_url: "https://cdn.example.com/frame.jpg",
            image_urls: ["https://cdn.example.com/ref1.jpg"]
        });
        assert.equal(defaultPayload.generate_audio, true);

        const disabledAudioPayload = model.buildPayload({
            prompt: "Adegan tanpa audio",
            image_url: "https://cdn.example.com/frame.jpg",
            image_urls: ["https://cdn.example.com/ref1.jpg"],
            generate_audio: false
        });
        assert.equal(disabledAudioPayload.generate_audio, false);

        const invalidDuration = model.validate({
            prompt: "Durasi di luar daftar pilihan",
            image_url: "https://cdn.example.com/frame.jpg",
            image_urls: ["https://cdn.example.com/ref1.jpg"],
            duration: "7"
        });
        assert.equal(invalidDuration.valid, false);
    }
});

test("supported_durations divalidasi di admin-models, diteruskan ke form /generate, dan didukung sistem checkbox model-edit.html", async () => {
    assert.ok(MODEL_FIELDS.includes("supported_durations"));

    const cleaned = cleanModel({
        model_id: "opus-seedance-2.5-i2v",
        supported_durations: ["5", "10", "15"]
    });
    assert.deepEqual(cleaned.supported_durations, ["5", "10", "15"]);
    assert.equal(validateModel(cleaned, false), null);

    const invalid = cleanModel({
        model_id: "opus-seedance-2.5-i2v",
        supported_durations: ["5", "abc"]
    });
    assert.match(String(validateModel(invalid, false)), /supported_durations/);

    const i2v = getOpusVideoModel("opus-seedance-2.5-i2v");
    const definitions = getParameterDefinitions({
        model_id: i2v.config.id,
        parameters: i2v.parameters,
        supported_resolutions: ["720p"],
        supported_durations: ["10", "15", "30"]
    });
    assert.deepEqual(definitions.duration.enum, ["10", "15", "30"]);
    assert.equal(
        definitions.duration.default,
        "10",
        "ketika default lama (5) tidak dicentang admin, default otomatis jatuh ke durasi aktif pertama (10)"
    );
    assert.equal(definitions.generate_audio.default, true);
    assert.equal(formatEnumLabel("10", "duration"), "10s");
    assert.equal(formatEnumLabel("720p", "resolution"), "720p");

    const modelEditHtml = readFileSync(
        new URL("../admin-control/model-edit.html", import.meta.url),
        "utf8"
    );
    assert.match(modelEditHtml, /id="activeDurationField"/);
    assert.match(modelEditHtml, /id="activeDurationSelector"/);
    assert.match(modelEditHtml, /data-active-duration="/);
    assert.match(modelEditHtml, /payload\.supported_durations\s*=/);
    assert.match(modelEditHtml, /Pilih minimal satu durasi untuk diaktifkan di Generate\./);
});

test("/api/model-config mengembalikan supported_durations terfilter dan menyesuaikan default duration dari database", async () => {
    const prevUrl = process.env.SUPABASE_URL;
    const prevKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const originalFetch = globalThis.fetch;

    process.env.SUPABASE_URL = "https://supabase.mock.local";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "mock-service-role-secret";

    globalThis.fetch = async (url) => {
        const href = String(url);
        if (href.includes("/auth/v1/user")) {
            return Response.json({ id: "user-001", email: "user@example.com" });
        }
        if (href.includes("/rest/v1/models")) {
            return Response.json([
                {
                    id: "4c21ab91-6e57-410f-b5ed-da9e92c92618",
                    provider_id: "prov-opus-uuid",
                    model_id: "opus-seedance-2.5-i2v",
                    model_name: "Seedance 2.5 Image to Video (Opus)",
                    description: "Seedance 2.5 I2V",
                    min_duration: 4,
                    max_duration: 30,
                    supported_ratios: [],
                    supported_resolutions: ["720p"],
                    supported_durations: ["8", "15"],
                    credit_480p: 3000,
                    credit_720p: 5000,
                    credit_1080p: 0,
                    discount_percent: 0,
                    status: "active"
                }
            ]);
        }
        if (href.includes("/rest/v1/providers")) {
            return Response.json([
                {
                    id: "prov-opus-uuid",
                    provider_id: "opus",
                    provider_name: "Opus",
                    status: "active"
                }
            ]);
        }
        throw new Error(`Unexpected fetch in model-config test: ${href}`);
    };

    try {
        const { default: modelConfigHandler } = await import(
            `../api/model-config.js?test=${Date.now()}`
        );

        let statusCode = 200;
        let rawBody = "";
        const req = {
            method: "GET",
            url: "/api/model-config?model_id=opus-seedance-2.5-i2v",
            headers: {
                authorization: "Bearer mock-user-session-token"
            }
        };
        const res = {
            set statusCode(code) {
                statusCode = code;
            },
            get statusCode() {
                return statusCode;
            },
            setHeader() {},
            end(payload) {
                rawBody = String(payload || "");
            }
        };

        await modelConfigHandler(req, res);
        assert.equal(statusCode, 200);

        const body = JSON.parse(rawBody);
        assert.equal(body.success, true);
        assert.deepEqual(body.model.supported_durations, ["8", "15"]);

        const durationParam = body.model.parameters.find(p => p.name === "duration");
        assert.ok(durationParam);
        assert.deepEqual(durationParam.enum, ["8", "15"]);
        assert.equal(durationParam.default, "8");

        const audioParam = body.model.parameters.find(p => p.name === "generate_audio");
        assert.ok(audioParam);
        assert.equal(audioParam.default, true);
    } finally {
        globalThis.fetch = originalFetch;
        if (prevUrl === undefined) delete process.env.SUPABASE_URL;
        else process.env.SUPABASE_URL = prevUrl;
        if (prevKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
        else process.env.SUPABASE_SERVICE_ROLE_KEY = prevKey;
    }
});

test("semua 6 model provider Opus mendukung pilihan durasi sistem checkbox di Edit Model dan halaman Generate", () => {
    const expectedByModel = {
        "opus-seedance-2.5-t2v": ["4", "5", "8", "10", "12", "15", "20", "25", "30"],
        "opus-seedance-2.5-i2v": ["4", "5", "8", "10", "12", "15", "20", "25", "30"],
        "opus-seedance-2.5-r2v": ["4", "5", "8", "10", "12", "15", "20", "25", "30"],
        "opus-seedance-2.0-r2v": ["4", "5", "8", "10", "12", "15"],
        "opus-hailuo-3-t2v": ["5", "6", "8", "10", "12", "15"],
        "opus-hailuo-3-i2v": ["5", "6", "8", "10", "12", "15"]
    };

    assert.equal(opusVideoModels.length, 6);

    for (const adapter of opusVideoModels) {
        const modelId = adapter.config.id;
        assert.equal(
            adapter.config.adminEditor.selectableDurations,
            true,
            `${modelId} wajib mengaktifkan selectableDurations`
        );
        assert.deepEqual(
            adapter.config.adminEditor.durationOptions.map(opt => opt.value),
            expectedByModel[modelId],
            `${modelId} wajib memiliki durationOptions checkbox sesuai spesifikasi`
        );

        const durationParam = adapter.parameters.find(p => p.name === "duration");
        assert.ok(durationParam);
        assert.equal(durationParam.type, "string");
        assert.deepEqual(durationParam.enum, expectedByModel[modelId]);
    }
});

test("antrian Opus: mendeteksi Insufficient credits upstream, menunggu runtime 5 menit berstatus putih MENCOBA, dan berhenti setelah 3 kali gagal dengan SISTEM SIBUK, COBA LAGI", async () => {
    assert.equal(OPUS_QUEUE_RUNTIME_MS, 5 * 60 * 1000);
    assert.equal(OPUS_QUEUE_MAX_ATTEMPTS, 3);
    assert.equal(OPUS_QUEUE_WAIT_MESSAGE, "mohon tunggu antrian, sistem sedang padat");
    assert.equal(OPUS_QUEUE_FINAL_ERROR_MESSAGE, "SISTEM SIBUK, COBA LAGI");
    assert.equal(OPUS_QUEUE_RETRY_STATUS_LABEL, "MENCOBA");
    assert.equal(formatQueueCountdown(OPUS_QUEUE_RUNTIME_MS), "05:00");
    assert.equal(formatQueueCountdown(61000), "01:01");
    assert.equal(formatQueueCountdown(0), "00:00");

    /* 1. Deteksi pesan persis yang dilaporkan user */
    assert.equal(
        isOpusUpstreamCreditBusy({
            modelId: "opus-seedance-2.5-i2v",
            message:
                "Saldo kredit akun Opus Labs (upstream OpusClip) tidak mencukupi untuk durasi/resolusi video ini. (Detail Opus: Insufficient credits. No provider request was made.) (5.000 credit telah dikembalikan ke saldo akun Anda.)"
        }),
        true
    );

    /* 2. Jangan tertukar dengan saldo user GEN-Z.AI sendiri yang kurang (HTTP 402 sebelum provider dipanggil) */
    assert.equal(
        isOpusUpstreamCreditBusy({
            modelId: "opus-seedance-2.5-i2v",
            status: 402,
            code: "INSUFFICIENT_CREDITS",
            message: "Insufficient credits",
            creditRefunded: false,
            details: {
                code: "INSUFFICIENT_CREDITS",
                model_id: "opus-seedance-2.5-i2v"
            }
        }),
        false
    );

    /* 3. Skenario giliran tiba pada percobaan ke-3 setelah 2 kali antrian 5 menit */
    const sleptSlicesSuccess = [];
    const waitStartsSuccess = [];
    let attemptCounterSuccess = 0;

    const recoveredResult = await runOpusQueueRetryLoop({
        maxAttempts: 3,
        runtimeMs: 5 * 60 * 1000,
        tickMs: 60 * 1000,
        sleepFn: async ms => {
            sleptSlicesSuccess.push(ms);
        },
        onQueueWaitStart: info => {
            waitStartsSuccess.push(info);
        },
        executeAttempt: async attempt => {
            attemptCounterSuccess = attempt;
            if (attempt < 3) {
                const err = new Error(
                    "Saldo kredit akun Opus Labs (upstream OpusClip) tidak mencukupi untuk durasi/resolusi video ini. (Detail Opus: Insufficient credits. No provider request was made.)"
                );
                err.code = "insufficient_credits";
                throw err;
            }
            return { taskId: "opus:proj_ok:job_ok", completed: true };
        }
    });

    assert.equal(attemptCounterSuccess, 3);
    assert.equal(recoveredResult.completed, true);
    assert.equal(waitStartsSuccess.length, 2);
    assert.equal(waitStartsSuccess[0].message, "mohon tunggu antrian, sistem sedang padat");
    assert.equal(waitStartsSuccess[0].statusLabel, "MENCOBA");
    assert.equal(waitStartsSuccess[0].formattedRemaining, "05:00");
    assert.equal(
        sleptSlicesSuccess.reduce((sum, v) => sum + v, 0),
        2 * 5 * 60 * 1000,
        "2 kali menunggu masing-masing tepat 5 menit"
    );

    /* 4. Skenario 3 kali percobaan gagal -> sistem langsung STOP dan mengeluarkan notif SISTEM SIBUK, COBA LAGI */
    const sleptSlicesFail = [];
    const waitStartsFail = [];
    let attemptCounterFail = 0;

    await assert.rejects(
        async () => {
            await runOpusQueueRetryLoop({
                maxAttempts: 3,
                runtimeMs: 5 * 60 * 1000,
                tickMs: 60 * 1000,
                sleepFn: async ms => {
                    sleptSlicesFail.push(ms);
                },
                onQueueWaitStart: info => {
                    waitStartsFail.push(info);
                },
                executeAttempt: async () => {
                    attemptCounterFail += 1;
                    const err = new Error("mohon tunggu antrian, sistem sedang padat");
                    err.code = "OPUS_UPSTREAM_QUEUE_BUSY";
                    err.details = { credit_refunded: true, refunded_credit: 5000 };
                    throw err;
                }
            });
        },
        err => {
            assert.equal(err.message, "SISTEM SIBUK, COBA LAGI");
            assert.equal(err.code, OPUS_SYSTEM_BUSY_FINAL_CODE);
            assert.equal(err.attempts, 3);
            assert.equal(err.suppressRefundSuffix, true);
            return true;
        }
    );

    assert.equal(attemptCounterFail, 3, "harus berhenti tepat setelah 3 kali percobaan gagal");
    assert.equal(waitStartsFail.length, 2, "percobaan ke-3 yang gagal langsung berhenti tanpa menunggu 5 menit lagi");
    assert.equal(
        sleptSlicesFail.reduce((sum, v) => sum + v, 0),
        2 * 5 * 60 * 1000
    );

    /* 5. Verifikasi CSS & status warna putih MENCOBA di UI /generate */
    const appJs = readFileSync(
        new URL("../generate/assets/js/generate-app.js", import.meta.url),
        "utf8"
    );
    assert.match(appJs, /title\s*=\s*"MENCOBA"/);
    assert.match(appJs, /\.genz-generate-status-title\.retrying\s*\{\s*color:#ffffff\s*!important;/);

    const progressCardJs = readFileSync(
        new URL("../generate/assets/js/generate-progress-card.js", import.meta.url),
        "utf8"
    );
    assert.match(progressCardJs, /setStatus\("MENCOBA"\)/);

    const progressCardCss = readFileSync(
        new URL("../generate/assets/css/generate-progress-card.css", import.meta.url),
        "utf8"
    );
    assert.match(
        progressCardCss,
        /\.genz-progress-card\[data-state="retrying"\]\s+\.gpc-status\s*\{\s*color:\s*#ffffff;\s*\}/
    );
});






