/* =========================================================
   GEN-Z.AI — OPUS GENERATE_AUDIO & TRANSCRIBE_AUDIO TESTS
   ---------------------------------------------------------
   File:
     tests/opus-audio-transcribe.test.mjs
========================================================= */

import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
    buildSrtFromSegments,
    formatReadableTimestamp,
    formatSrtTimestamp,
    normalizeTranscriptPayload,
    parseSrtOrVttSegments
} from "../assets/js/transcript-format.js";
import {
    persistGeneratedAudio,
    persistGeneratedTranscript
} from "../lib/generate/persist-generated-audio.js";
import {
    DEFAULT_OPUS_AUDIO_CREDIT,
    OPUS_AUDIO_MODEL_IDS,
    OPUS_SPEECH_VOICES,
    computeSpeechWeightedLength,
    isOpusAudioModelId,
    opusAudioModelMap,
    opusAudioModels
} from "../models/opus-audio/index.js";
import {
    DEFAULT_OPUS_TRANSCRIBE_CREDIT,
    OPUS_TRANSCRIBE_LANGUAGES,
    isOpusTranscribeModelId,
    opusTranscribeModelMap,
    opusTranscribeModels
} from "../models/opus-transcribe/index.js";
import {
    buildLyriaMusicPrompt,
    createAudioTask,
    createTranscribeTask,
    extractAudioUrls,
    extractTranscriptUrls,
    formatMusicLyricsForLyria,
    getAudioTask,
    getTranscribeTask
} from "../provider/opus/client.js";
import {
    MAIN_MODE_AUDIO,
    MAIN_MODE_IMAGE,
    MAIN_MODE_TRANSCRIBE,
    MAIN_MODE_VIDEO,
    filterModelsByMainMode,
    isAudioModel,
    isFlatCreditNonVideoModel,
    isImageModel,
    isTranscribeModel,
    normalizeMainMode,
    resolveMainModeForModel
} from "../generate/assets/js/generate-mode-state.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

test("transcript-format: memformat SRT, mem-parse VTT/SRT, dan menormalisasi segmen kata", () => {
    assert.equal(formatSrtTimestamp(0), "00:00:00,000");
    assert.equal(formatSrtTimestamp(65.432), "00:01:05,432");
    assert.equal(formatReadableTimestamp(125.4), "02:05.4");
    assert.equal(formatReadableTimestamp(3661), "01:01:01");

    const srt = buildSrtFromSegments([
        { start: 0, end: 2.5, text: "Halo dunia kreatif!" },
        { start: 2.6, end: 5.2, speaker: "Host", text: "Selamat datang di GEN-Z.AI." }
    ]);
    assert.match(srt, /00:00:00,000 --> 00:00:02,500/);
    assert.match(srt, /\[Host\] Selamat datang di GEN-Z\.AI\./);

    const reparsed = parseSrtOrVttSegments(`WEBVTT\n\n00:00:01.000 --> 00:00:03.500\nBaris pertama\n\n00:00:04.000 --> 00:00:06.250\nBaris kedua`);
    assert.equal(reparsed.length, 2);
    assert.equal(reparsed[0].start, 1);
    assert.equal(reparsed[1].text, "Baris kedua");

    const wordBased = normalizeTranscriptPayload({
        language: "id",
        durationSeconds: 4.5,
        words: [
            { word: "Ini", start: 0.1, end: 0.4 },
            { word: "contoh", start: 0.5, end: 0.9 },
            { word: "kalimat.", start: 1.0, end: 1.6 },
            { word: "Lanjut", start: 3.0, end: 3.4 },
            { word: "lagi!", start: 3.5, end: 4.1 }
        ]
    });
    assert.ok(wordBased);
    assert.equal(wordBased.language, "id");
    assert.equal(wordBased.segments.length, 2);
    assert.match(wordBased.text, /Ini contoh kalimat\./);
    assert.match(wordBased.srt, /-->/);
});

test("opusAudioModels & opusTranscribeModels: katalog, 30 suara resmi, flat 500/1000 kredit, dan validasi", () => {
    assert.equal(opusAudioModels.length, 4);
    assert.deepEqual(OPUS_AUDIO_MODEL_IDS, [
        "opus-audio-speech",
        "opus-audio-music",
        "opus-audio-sfx",
        "opus-audio-podcast"
    ]);
    assert.equal(OPUS_SPEECH_VOICES.length, 30);
    assert.equal(opusTranscribeModels.length, 1);
    assert.ok(OPUS_TRANSCRIBE_LANGUAGES.length >= 10);

    for (const model of [...opusAudioModels, ...opusTranscribeModels]) {
        assert.equal(model.config.provider, "opus");
        const expectedCredit = model.config.id === "opus-audio-podcast" ? 1000 : 500;
        assert.equal(model.config.adminDefaults.credit_480p, expectedCredit);
        assert.equal(model.config.adminDefaults.credit_720p, 0);
        assert.equal(model.config.adminDefaults.credit_1080p, 0);
        assert.equal(model.config.adminEditor.resolutionIndependent, true);
        /* Pastikan parameter select tidak menaruh `enum` agar dirender sebagai <select>, bukan tombol raksasa */
        for (const paramDef of Object.values(model.parameters)) {
            if (paramDef.type === "select") {
                assert.equal(paramDef.enum, undefined);
                assert.ok(Array.isArray(paramDef.options) && paramDef.options.length > 0);
            }
        }
    }

    assert.equal(DEFAULT_OPUS_AUDIO_CREDIT, 500);
    assert.equal(DEFAULT_OPUS_TRANSCRIBE_CREDIT, 500);
    assert.equal(isOpusAudioModelId("opus-audio-speech"), true);
    assert.equal(isOpusTranscribeModelId("opus-transcribe-audio"), true);

    /* Weighted CJK validation pada speech */
    assert.equal(computeSpeechWeightedLength("Halo"), 4);
    assert.equal(computeSpeechWeightedLength("你好"), 6);

    const speechModel = opusAudioModelMap["opus-audio-speech"];
    assert.equal(speechModel.validate({ prompt: "" }).valid, false);
    assert.equal(
        speechModel.validate({ prompt: "Halo semuanya <short pause> selamat pagi!", voice: "Sulafat", style: "Hangat" }).valid,
        true
    );
    assert.equal(
        speechModel.validate({ prompt: "Halo", voice: "SuaraTidakAda" }).valid,
        false
    );
    assert.equal(
        speechModel.validate({ prompt: "字".repeat(2001), voice: "Sulafat" }).valid,
        false
    );

    const musicModel = opusAudioModelMap["opus-audio-music"];
    const musicPayload = musicModel.buildPayload({
        prompt: "Acoustic lo-fi chillhop, 85 BPM",
        vocal_mode: "vocal",
        target_duration: "60",
        lyrics: "[Chorus]\nTerus melangkah"
    });
    assert.equal(musicPayload.audio_type, "music");
    assert.equal(musicPayload.duration, 60);
    assert.equal(musicPayload.vocal_mode, "vocal");

    const transcribeModel = opusTranscribeModelMap["opus-transcribe-audio"];
    assert.equal(transcribeModel.validate({ language: "id" }).valid, false);
    assert.equal(
        transcribeModel.validate({
            audio_url: "supabase-private://user-uploads/generate-input/u1/sample.mp3",
            language: "id"
        }).valid,
        true
    );
    assert.equal(
        transcribeModel.validate({
            video_urls: ["supabase-private://user-uploads/generate-input/u1/clip.mp4"],
            language: "auto"
        }).valid,
        true
    );
    const trxParams = transcribeModel.getParameters({
        audio_url: "supabase-private://user-uploads/generate-input/u1/sample.mp3",
        language: "id"
    });
    assert.match(trxParams.prompt, /\[Transkripsi Audio\]/);
});

test("generate-mode-state: memfilter 4 mode utama secara terpisah tanpa merusak mode video/gambar", () => {
    assert.equal(normalizeMainMode("audio"), MAIN_MODE_AUDIO);
    assert.equal(normalizeMainMode("transcribe"), MAIN_MODE_TRANSCRIBE);
    assert.equal(normalizeMainMode("image"), MAIN_MODE_IMAGE);
    assert.equal(normalizeMainMode("video"), MAIN_MODE_VIDEO);

    const sampleCatalog = [
        { id: "opus-seedance-2.5-t2v", media_type: "video" },
        { id: "opus-nano-banana-pro", media_type: "image" },
        { id: "opus-audio-speech", media_type: "audio" },
        { id: "opus-audio-music", media_type: "audio" },
        { id: "opus-transcribe-audio", media_type: "transcribe" }
    ];

    assert.deepEqual(
        filterModelsByMainMode(sampleCatalog, MAIN_MODE_VIDEO).map(m => m.id),
        ["opus-seedance-2.5-t2v"]
    );
    assert.deepEqual(
        filterModelsByMainMode(sampleCatalog, MAIN_MODE_IMAGE).map(m => m.id),
        ["opus-nano-banana-pro"]
    );
    assert.deepEqual(
        filterModelsByMainMode(sampleCatalog, MAIN_MODE_AUDIO).map(m => m.id),
        ["opus-audio-speech", "opus-audio-music"]
    );
    assert.deepEqual(
        filterModelsByMainMode(sampleCatalog, MAIN_MODE_TRANSCRIBE).map(m => m.id),
        ["opus-transcribe-audio"]
    );

    assert.equal(isAudioModel("opus-audio-sfx"), true);
    assert.equal(isTranscribeModel("opus-transcribe-audio"), true);
    assert.equal(isImageModel("opus-nano-banana-2"), true);
    assert.equal(isFlatCreditNonVideoModel("opus-audio-music"), true);
    assert.equal(isFlatCreditNonVideoModel("opus-transcribe-audio"), true);
    assert.equal(isFlatCreditNonVideoModel("opus-seedance-2.5-t2v"), false);
    assert.equal(resolveMainModeForModel({ id: "opus-audio-speech" }), MAIN_MODE_AUDIO);
    assert.equal(resolveMainModeForModel({ id: "opus-transcribe-audio" }), MAIN_MODE_TRANSCRIBE);
});

test("persistGeneratedAudio & persistGeneratedTranscript: deteksi magic bytes & private storage", async () => {
    const uploadedRequests = [];
    const wavHeader = Buffer.concat([
        Buffer.from([
            0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00,
            0x57, 0x41, 0x56, 0x45, 0x66, 0x6d, 0x74, 0x20
        ]),
        Buffer.alloc(32, 0)
    ]);

    const mockFetch = async (url, init = {}) => {
        const cleanUrl = String(url);
        if (cleanUrl.startsWith("https://cdn.example/output-audio")) {
            return new Response(wavHeader, {
                status: 200,
                headers: { "content-type": "audio/wav" }
            });
        }
        if (cleanUrl.includes("/storage/v1/object/user-uploads/")) {
            uploadedRequests.push({
                url: cleanUrl,
                contentType: init.headers?.["Content-Type"],
                bodySize: init.body?.length || 0
            });
            return new Response(JSON.stringify({ Key: "ok" }), { status: 200 });
        }
        return new Response("not found", { status: 404 });
    };

    const audioRef = await persistGeneratedAudio({
        sourceUrl: "https://cdn.example/output-audio",
        userId: "11111111-2222-3333-4444-555555555555",
        supabaseUrl: "https://example.supabase.co",
        serviceKey: "srv_test_key",
        fetchImpl: mockFetch
    });
    assert.match(
        audioRef,
        /^supabase-private:\/\/user-uploads\/upscale-videos\/outputs\/11111111-2222-3333-4444-555555555555\/genaud-.*\.wav$/
    );
    assert.equal(uploadedRequests[0].contentType, "audio/wav");

    const trxRef = await persistGeneratedTranscript({
        transcript: {
            text: "Halo teman-teman!",
            language: "id",
            segments: [{ start: 0, end: 2.1, text: "Halo teman-teman!" }]
        },
        userId: "11111111-2222-3333-4444-555555555555",
        supabaseUrl: "https://example.supabase.co",
        serviceKey: "srv_test_key",
        fetchImpl: mockFetch
    });
    assert.match(
        trxRef,
        /^supabase-private:\/\/user-uploads\/upscale-videos\/outputs\/11111111-2222-3333-4444-555555555555\/gentrx-.*\.json$/
    );
    assert.equal(uploadedRequests[1].contentType, "application/json; charset=utf-8");

    /* Fallback data URL bila Supabase tidak dikonfigurasi */
    const offlineTrxRef = await persistGeneratedTranscript({
        transcript: { text: "Offline test", segments: [{ start: 0, end: 1.5, text: "Offline test" }] },
        userId: "u1",
        supabaseUrl: "",
        serviceKey: ""
    });
    assert.match(offlineTrxRef, /^data:application\/json;base64,/);
});

test("Opus MCP client: createAudioTask, getAudioTask, createTranscribeTask, dan getTranscribeTask bekerja end-to-end", async () => {
    const recordedCalls = [];
    let audioPollCount = 0;
    let transcribePollCount = 0;

    const server = http.createServer(async (req, res) => {
        const reqUrl = new URL(req.url, "http://127.0.0.1");

        if (req.method === "GET" && reqUrl.pathname === "/source-audio.mp3") {
            res.writeHead(200, { "Content-Type": "audio/mpeg" });
            res.end(Buffer.from([0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x10]));
            return;
        }

        if (req.method === "PUT" && reqUrl.pathname === "/upload-target") {
            const chunks = [];
            for await (const c of req) chunks.push(c);
            recordedCalls.push({ type: "upload_put", bytes: Buffer.concat(chunks).length });
            res.writeHead(200);
            res.end();
            return;
        }

        if (req.method === "GET" && reqUrl.pathname === "/remote-transcript.srt") {
            res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
            res.end("1\n00:00:00,000 --> 00:00:02,400\nTranskrip dari file SRT remote.\n");
            return;
        }

        let rawBody = "";
        for await (const chunk of req) rawBody += chunk;
        const rpc = JSON.parse(rawBody || "{}");

        const sendRpc = result => {
            res.writeHead(200, {
                "Content-Type": "application/json",
                "Mcp-Session-Id": "sess-audio-trx-1"
            });
            res.end(JSON.stringify({ jsonrpc: "2.0", id: rpc.id, result }));
        };

        if (rpc.method === "initialize") {
            sendRpc({ protocolVersion: "2025-03-26", serverInfo: { name: "mock-opus" }, capabilities: {} });
            return;
        }

        if (rpc.method === "notifications/initialized") {
            res.writeHead(202);
            res.end();
            return;
        }

        if (rpc.method === "tools/list") {
            sendRpc({
                tools: [
                    {
                        name: "create_project",
                        inputSchema: { type: "object", properties: { name: { type: "string" } } }
                    },
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
                                        properties: {
                                            id: { type: "string" },
                                            fileName: { type: "string" },
                                            mimeType: { type: "string" }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    {
                        name: "generate_audio",
                        inputSchema: {
                            type: "object",
                            required: ["projectId", "requestKey", "type"],
                            properties: {
                                projectId: { type: "string" },
                                requestKey: { type: "string" },
                                type: { type: "string", enum: ["speech", "music", "sfx"] },
                                text: { type: "string" },
                                voice: { type: "string", enum: ["Sulafat", "Charon", "Kore"] },
                                style: { type: "string" },
                                prompt: { type: "string" },
                                durationSeconds: { type: "number" }
                            }
                        }
                    },
                    {
                        name: "transcribe_audio",
                        inputSchema: {
                            type: "object",
                            required: ["projectId", "requestKey", "assetId"],
                            properties: {
                                projectId: { type: "string" },
                                requestKey: { type: "string" },
                                assetId: { type: "string" },
                                language: { type: "string" },
                                includeTimestamps: { type: "boolean" }
                            }
                        }
                    },
                    {
                        name: "get_status",
                        inputSchema: {
                            type: "object",
                            required: ["jobId"],
                            properties: {
                                projectId: { type: "string" },
                                jobId: { type: "string" },
                                watch: { type: "boolean" }
                            }
                        }
                    }
                ]
            });
            return;
        }

        if (rpc.method === "tools/call") {
            const { name, arguments: args } = rpc.params;
            recordedCalls.push({ tool: name, args });

            if (name === "create_project") {
                sendRpc({
                    structuredContent: { projectId: "proj-aud-1" },
                    content: [{ type: "text", text: JSON.stringify({ projectId: "proj-aud-1" }) }]
                });
                return;
            }

            if (name === "import_assets") {
                const port = server.address().port;
                const payload = {
                    assets: [
                        {
                            assetId: "asset-media-99",
                            uploadUrl: `http://127.0.0.1:${port}/upload-target`,
                            uploadMethod: "PUT"
                        }
                    ]
                };
                sendRpc({
                    structuredContent: payload,
                    content: [{ type: "text", text: JSON.stringify(payload) }]
                });
                return;
            }

            if (name === "generate_audio") {
                const payload = { jobId: "job-aud-777", status: "queued" };
                sendRpc({
                    structuredContent: payload,
                    content: [{ type: "text", text: JSON.stringify(payload) }]
                });
                return;
            }

            if (name === "transcribe_audio") {
                const payload = { jobId: "job-trx-888", status: "processing" };
                sendRpc({
                    structuredContent: payload,
                    content: [{ type: "text", text: JSON.stringify(payload) }]
                });
                return;
            }

            if (name === "get_status") {
                const port = server.address().port;
                if (args.jobId === "job-aud-777") {
                    audioPollCount += 1;
                    const payload =
                        audioPollCount === 1
                            ? { jobId: "job-aud-777", status: "processing" }
                            : {
                                  jobId: "job-aud-777",
                                  status: "completed",
                                  outputs: [
                                      {
                                          url: `https://cdn.opus.example/generated-voiceover.wav`,
                                          mimeType: "audio/wav",
                                          durationSeconds: 8.4
                                      }
                                  ]
                              };
                    sendRpc({
                        structuredContent: payload,
                        content: [{ type: "text", text: JSON.stringify(payload) }]
                    });
                    return;
                }

                if (args.jobId === "job-trx-888") {
                    transcribePollCount += 1;
                    const payload =
                        transcribePollCount === 1
                            ? { jobId: "job-trx-888", status: "processing" }
                            : {
                                  jobId: "job-trx-888",
                                  status: "completed",
                                  transcriptUrl: `http://127.0.0.1:${port}/remote-transcript.srt`
                              };
                    sendRpc({
                        structuredContent: payload,
                        content: [{ type: "text", text: JSON.stringify(payload) }]
                    });
                    return;
                }
            }
        }

        res.writeHead(400);
        res.end();
    });

    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    const port = server.address().port;
    const mcpEndpoint = `http://127.0.0.1:${port}/mcp`;

    try {
        /* 1. Test generate_audio (Speech) */
        const createdAudio = await createAudioTask(
            {
                audio_type: "speech",
                text: "Selamat datang di studio audio GEN-Z.AI!",
                voice: "Sulafat",
                style: "Hangat dan jelas"
            },
            "test-bearer-token",
            { mcpUrl: mcpEndpoint }
        );
        assert.equal(createdAudio.status, "QUEUED");
        assert.match(createdAudio.taskId, /^opus:proj-aud-1:job-aud-777$/);

        const generateCall = recordedCalls.find(c => c.tool === "generate_audio");
        assert.ok(generateCall);
        assert.equal(generateCall.args.type, "speech");
        assert.equal(generateCall.args.voice, "Sulafat");
        assert.equal(generateCall.args.text, "Selamat datang di studio audio GEN-Z.AI!");

        const poll1 = await getAudioTask(createdAudio.taskId, "test-bearer-token", { mcpUrl: mcpEndpoint });
        assert.equal(poll1.status, "PROCESSING");

        const poll2 = await getAudioTask(createdAudio.taskId, "test-bearer-token", { mcpUrl: mcpEndpoint });
        assert.equal(poll2.status, "COMPLETED");
        assert.deepEqual(poll2.audioUrls, ["https://cdn.opus.example/generated-voiceover.wav"]);
        assert.equal(poll2.durationSeconds, 8.4);

        /* 2. Test transcribe_audio (import_assets + transcribe_audio + remote .srt fetch) */
        const dataAudioInput = `data:audio/mpeg;base64,${Buffer.from("ID3-mock-mp3-payload").toString("base64")}`;
        const createdTrx = await createTranscribeTask(
            {
                audio_url: dataAudioInput,
                language: "id"
            },
            "test-bearer-token",
            { mcpUrl: mcpEndpoint }
        );
        assert.match(createdTrx.taskId, /^opus:proj-aud-1:job-trx-888$/);

        const trxCall = recordedCalls.find(c => c.tool === "transcribe_audio");
        assert.ok(trxCall);
        assert.equal(trxCall.args.assetId, "asset-media-99");
        assert.equal(trxCall.args.language, "id");
        assert.equal(trxCall.args.includeTimestamps, true);

        const trxPoll1 = await getTranscribeTask(createdTrx.taskId, "test-bearer-token", { mcpUrl: mcpEndpoint });
        assert.equal(trxPoll1.status, "PROCESSING");

        const trxPoll2 = await getTranscribeTask(createdTrx.taskId, "test-bearer-token", { mcpUrl: mcpEndpoint });
        assert.equal(trxPoll2.status, "COMPLETED");
        assert.ok(trxPoll2.transcript);
        assert.equal(trxPoll2.transcript.text, "Transkrip dari file SRT remote.");
        assert.equal(trxPoll2.transcript.segments.length, 1);
    } finally {
        await new Promise(resolve => server.close(resolve));
    }

    assert.deepEqual(
        extractAudioUrls({ outputs: [{ url: "https://cdn.example/song.mp3", mimeType: "audio/mpeg" }] }),
        ["https://cdn.example/song.mp3"]
    );
    assert.deepEqual(
        extractTranscriptUrls({ outputs: [{ transcriptUrl: "https://cdn.example/captions.srt" }] }),
        ["https://cdn.example/captions.srt"]
    );
});

test("UI & Registry Wiring: /generate, /history, API endpoints, dan SQL seed memuat keempat model baru", () => {
    const generateHtml = fs.readFileSync(path.join(ROOT, "generate/index.html"), "utf8");
    assert.match(generateHtml, /data-main-mode="video"/);
    assert.match(generateHtml, /data-main-mode="image"/);
    assert.match(generateHtml, /data-main-mode="audio"/);
    assert.match(generateHtml, /data-main-mode="transcribe"/);
    assert.match(generateHtml, /id="generateAudioSubModeWrap"/);
    assert.match(generateHtml, /id="generateAudioResultCard"/);
    assert.match(generateHtml, /id="generateTranscribeResultCard"/);

    const historyRender = fs.readFileSync(path.join(ROOT, "history/assets/js/history-render.js"), "utf8");
    const historyModal = fs.readFileSync(path.join(ROOT, "history/assets/js/history-modal.js"), "utf8");
    const sqlSeed = fs.readFileSync(path.join(ROOT, "supabase/opus-provider-models.sql"), "utf8");
    const modelConfigApi = fs.readFileSync(path.join(ROOT, "api/model-config.js"), "utf8");
    const generateApi = fs.readFileSync(path.join(ROOT, "api/generate.js"), "utf8");
    const statusApi = fs.readFileSync(path.join(ROOT, "api/generate-status.js"), "utf8");

    for (const modelId of [...OPUS_AUDIO_MODEL_IDS, "opus-transcribe-audio"]) {
        assert.ok(historyRender.includes(modelId), `history-render.js missing ${modelId}`);
        assert.ok(historyModal.includes(modelId), `history-modal.js missing ${modelId}`);
        assert.ok(sqlSeed.includes(modelId), `opus-provider-models.sql missing ${modelId}`);
    }

    assert.ok(modelConfigApi.includes("...opusAudioModels"));
    assert.ok(modelConfigApi.includes("...opusTranscribeModels"));
    assert.ok(generateApi.includes("persistGeneratedAudio"));
    assert.ok(generateApi.includes("persistGeneratedTranscript"));
    assert.ok(statusApi.includes("persistGeneratedAudio"));
    assert.ok(statusApi.includes("persistGeneratedTranscript"));
});

test("Regresi skema live Opus MCP transcribe_audio: keys=[audio,purpose,languageCode,diarize,requestKey,projectId]", async () => {
    const transcribeCalls = [];

    const server = http.createServer(async (req, res) => {
        const reqUrl = new URL(req.url, "http://127.0.0.1");
        if (req.method === "PUT" && reqUrl.pathname === "/upload-live") {
            for await (const _chunk of req) {
                /* drain */
            }
            res.writeHead(200);
            res.end();
            return;
        }

        let rawBody = "";
        for await (const chunk of req) rawBody += chunk;
        const rpc = JSON.parse(rawBody || "{}");

        const sendRpc = result => {
            res.writeHead(200, {
                "Content-Type": "application/json",
                "Mcp-Session-Id": "sess-live-trx"
            });
            res.end(JSON.stringify({ jsonrpc: "2.0", id: rpc.id, result }));
        };

        if (rpc.method === "initialize") {
            sendRpc({ protocolVersion: "2025-03-26", serverInfo: { name: "mock-opus-live" }, capabilities: {} });
            return;
        }
        if (rpc.method === "notifications/initialized") {
            res.writeHead(202);
            res.end();
            return;
        }

        if (rpc.method === "tools/list") {
            sendRpc({
                tools: [
                    {
                        name: "create_project",
                        inputSchema: { type: "object", properties: { name: { type: "string" } } }
                    },
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
                                        properties: {
                                            fileName: { type: "string" },
                                            mimeType: { type: "string" }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    {
                        name: "transcribe_audio",
                        inputSchema: {
                            type: "object",
                            required: ["audio", "requestKey", "projectId"],
                            properties: {
                                audio: {
                                    anyOf: [
                                        {
                                            type: "object",
                                            required: ["url"],
                                            properties: { url: { type: "string" } }
                                        },
                                        {
                                            type: "object",
                                            required: ["assetId"],
                                            properties: { assetId: { type: "string" } }
                                        },
                                        { type: "string" }
                                    ]
                                },
                                purpose: {
                                    type: "string",
                                    enum: ["captions", "alignment"]
                                },
                                languageCode: { type: "string" },
                                diarize: { type: "boolean" },
                                requestKey: { type: "string" },
                                projectId: { type: "string" }
                            }
                        }
                    },
                    {
                        name: "get_status",
                        inputSchema: {
                            type: "object",
                            required: ["jobId"],
                            properties: {
                                projectId: { type: "string" },
                                jobId: { type: "string" },
                                watch: { type: "boolean" }
                            }
                        }
                    }
                ]
            });
            return;
        }

        if (rpc.method === "tools/call") {
            const { name, arguments: args } = rpc.params;
            if (name === "create_project") {
                sendRpc({
                    structuredContent: { projectId: "proj-live-99" },
                    content: [{ type: "text", text: JSON.stringify({ projectId: "proj-live-99" }) }]
                });
                return;
            }
            if (name === "import_assets") {
                const port = server.address().port;
                const payload = {
                    assets: [
                        {
                            assetId: "ast-live-555",
                            uploadUrl: `http://127.0.0.1:${port}/upload-live`,
                            uploadMethod: "PUT"
                        }
                    ]
                };
                sendRpc({
                    structuredContent: payload,
                    content: [{ type: "text", text: JSON.stringify(payload) }]
                });
                return;
            }
            if (name === "transcribe_audio") {
                transcribeCalls.push(args);
                if (!args.audio) {
                    const errPayload = { errorCode: "invalid_arguments", message: "audio is required." };
                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(
                        JSON.stringify({
                            jsonrpc: "2.0",
                            id: rpc.id,
                            result: {
                                isError: true,
                                structuredContent: errPayload,
                                content: [{ type: "text", text: JSON.stringify(errPayload) }]
                            }
                        })
                    );
                    return;
                }
                /* Simulasikan server yang mewajibkan languageCode 3 huruf ISO-639-3 (`ind`) bila diisi */
                if (args.languageCode && args.languageCode !== "ind") {
                    const errPayload = {
                        errorCode: "invalid_arguments",
                        message: "languageCode must be ISO 639-3 (e.g. 'ind')."
                    };
                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(
                        JSON.stringify({
                            jsonrpc: "2.0",
                            id: rpc.id,
                            result: {
                                isError: true,
                                structuredContent: errPayload,
                                content: [{ type: "text", text: JSON.stringify(errPayload) }]
                            }
                        })
                    );
                    return;
                }
                const payload = { jobId: "job-live-trx-1", status: "queued" };
                sendRpc({
                    structuredContent: payload,
                    content: [{ type: "text", text: JSON.stringify(payload) }]
                });
                return;
            }
            if (name === "get_status") {
                /* Simulasikan output ElevenLabs Scribe v2 di dalam outputs[] */
                const payload = {
                    jobId: "job-live-trx-1",
                    status: "completed",
                    outputs: [
                        {
                            languageCode: "ind",
                            text: "Halo semuanya! Selamat datang kembali.",
                            words: [
                                { text: "Halo", start: 0.1, end: 0.4, type: "word", speakerId: "speaker_0" },
                                { text: " ", start: 0.4, end: 0.45, type: "spacing", speakerId: "speaker_0" },
                                { text: "semuanya!", start: 0.45, end: 1.0, type: "word", speakerId: "speaker_0" },
                                { text: "Selamat", start: 1.3, end: 1.7, type: "word", speakerId: "speaker_1" },
                                { text: " ", start: 1.7, end: 1.72, type: "spacing", speakerId: "speaker_1" },
                                { text: "datang", start: 1.72, end: 2.1, type: "word", speakerId: "speaker_1" },
                                { text: "kembali.", start: 2.15, end: 2.6, type: "word", speakerId: "speaker_1" }
                            ]
                        }
                    ]
                };
                sendRpc({
                    structuredContent: payload,
                    content: [{ type: "text", text: JSON.stringify(payload) }]
                });
                return;
            }
        }
        res.writeHead(400);
        res.end();
    });

    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    const port = server.address().port;
    const mcpEndpoint = `http://127.0.0.1:${port}/mcp`;

    try {
        const dataAudioInput = `data:audio/mpeg;base64,${Buffer.from("ID3-live-mp3-test").toString("base64")}`;
        const created = await createTranscribeTask(
            {
                audio_url: dataAudioInput,
                language: "id"
            },
            "test-bearer-token",
            { mcpUrl: mcpEndpoint }
        );
        assert.equal(created.status, "QUEUED");
        assert.match(created.taskId, /^opus:proj-live-99:job-live-trx-1$/);

        /* Pastikan argumen pertama langsung menyertakan `audio: { assetId: "ast-live-555" }`, `purpose: "captions"`, `diarize: true` */
        assert.deepEqual(transcribeCalls[0].audio, { assetId: "ast-live-555" });
        assert.equal(transcribeCalls[0].purpose, "captions");
        assert.equal(transcribeCalls[0].diarize, true);
        assert.equal(transcribeCalls[0].projectId, "proj-live-99");

        /* Pastikan varian fallback ISO-639-3 (`ind`) berhasil diterima oleh server */
        const acceptedCall = transcribeCalls[transcribeCalls.length - 1];
        assert.deepEqual(acceptedCall.audio, { assetId: "ast-live-555" });
        assert.equal(acceptedCall.languageCode, "ind");

        const polled = await getTranscribeTask(created.taskId, "test-bearer-token", { mcpUrl: mcpEndpoint });
        assert.equal(polled.status, "COMPLETED");
        assert.ok(polled.transcript);
        assert.equal(polled.transcript.language, "ind");
        assert.equal(polled.transcript.text, "Halo semuanya! Selamat datang kembali.");
        assert.equal(polled.transcript.segments.length, 2);
        assert.equal(polled.transcript.segments[0].speaker, "Speaker 1");
        assert.equal(polled.transcript.segments[1].speaker, "Speaker 2");
        assert.match(polled.transcript.srt, /\[Speaker 1\] Halo semuanya!/);
        assert.match(polled.transcript.srt, /\[Speaker 2\] Selamat datang kembali\./);
    } finally {
        await new Promise(resolve => server.close(resolve));
    }
});

test("Lyria 3.5 vocal & lyrics: memformat tag [Verse]/[Chorus] otomatis dan selalu menyematkan lirik ke dalam prompt", async () => {
    /* 1. Baris lirik polos tanpa tag -> otomatis diberi [Verse] & [Chorus] tanpa menghilangkan lirik asli */
    const plainIndoLyrics = [
        "Melangkah sendiri di malam yang tenang",
        "Menatap bintang di langit tinggi",
        "Takkan menyerah mengejar harapan",
        "Kita bersinar menyambut pagi"
    ].join("\n");
    const structuredPlain = formatMusicLyricsForLyria(plainIndoLyrics);
    assert.match(structuredPlain, /\[Verse\]/);
    assert.match(structuredPlain, /\[Chorus\]/);
    assert.match(structuredPlain, /Melangkah sendiri di malam yang tenang/);
    assert.match(structuredPlain, /Kita bersinar menyambut pagi/);

    /* 2. Tag Bahasa Indonesia ([Bait 1], [Reff]) dinormalisasi ke [Verse 1], [Chorus] */
    const indoTagged = formatMusicLyricsForLyria("[Bait 1]\nLangkah pertama\n\n[Reff]\nTerbang bersama");
    assert.match(indoTagged, /^\[Verse 1\]/m);
    assert.match(indoTagged, /^\[Chorus\]/m);

    /* 3. buildLyriaMusicPrompt: vokal + lirik membersihkan kata kontradiktif & menyertakan waktu masuk vokal awal */
    const vocalBuilt = buildLyriaMusicPrompt({
        prompt: "BGM pop akustik instrumental lembut dengan gitar akustik, 92 BPM",
        vocalMode: "vocal",
        lyrics: plainIndoLyrics,
        durationSeconds: 30,
        includeTargetLengthInPrompt: true
    });
    assert.equal(vocalBuilt.isInstrumental, false);
    assert.doesNotMatch(vocalBuilt.musicPrompt, /Instrumental only, no vocals/i);
    assert.match(vocalBuilt.musicPrompt, /Target length: about 30 seconds\./);
    assert.match(vocalBuilt.musicPrompt, /enter immediately at 0:02/);
    assert.match(vocalBuilt.musicPrompt, /not instrumental/i);
    assert.match(vocalBuilt.musicPrompt, /\[Verse\]/);
    assert.match(vocalBuilt.musicPrompt, /\[Chorus\]/);
    assert.match(vocalBuilt.musicPrompt, /Kita bersinar menyambut pagi/);

    /* 4. Mode vokal tanpa lirik kustom tetap memberi instruksi nyanyian vokal, bukan kosong */
    const vocalNoLyrics = buildLyriaMusicPrompt({
        prompt: "Pop R&B hangat romantis",
        vocalMode: "vocal",
        lyrics: "",
        durationSeconds: 30,
        includeTargetLengthInPrompt: true
    });
    assert.equal(vocalNoLyrics.isInstrumental, false);
    assert.match(vocalNoLyrics.musicPrompt, /sung lead vocals/i);
    assert.doesNotMatch(vocalNoLyrics.musicPrompt, /Instrumental only, no vocals/i);

    /* 5. Mode instrumental murni tanpa lirik tetap menjaga aturan "Instrumental only, no vocals." */
    const instBuilt = buildLyriaMusicPrompt({
        prompt: "Cinematic ambient piano",
        vocalMode: "instrumental",
        lyrics: "",
        durationSeconds: 30,
        includeTargetLengthInPrompt: true
    });
    assert.equal(instBuilt.isInstrumental, true);
    assert.match(instBuilt.musicPrompt, /Instrumental only, no vocals\./);

    /* 6. Adapter opus-audio-music otomatis mempromosikan vocal_mode ke "vocal" bila lirik diisi */
    const musicAdapter = opusAudioModelMap["opus-audio-music"];
    const autoPromotedPayload = musicAdapter.buildPayload({
        prompt: "Acoustic pop ceria",
        vocal_mode: "instrumental",
        target_duration: "30",
        lyrics: "Aku bernyanyi di pagi cerah\nMenyambut hari penuh semangat"
    });
    assert.equal(autoPromotedPayload.vocal_mode, "vocal");
    assert.match(autoPromotedPayload.lyrics, /Aku bernyanyi di pagi cerah/);

    /* 7. End-to-end MCP generate_audio: walau skema MCP punya properti `lyrics` & enum model `[lyria-2, lyria-3-pro-preview]`,
          `prompt` WAJIB tetap berisi lirik [Verse]/[Chorus] + arahan vokal, dan memilih `lyria-3-pro-preview` (bukan `lyria-2`) */
    const musicCalls = [];
    const server = http.createServer(async (req, res) => {
        let rawBody = "";
        for await (const chunk of req) rawBody += chunk;
        const rpc = JSON.parse(rawBody || "{}");
        const sendRpc = result => {
            res.writeHead(200, {
                "Content-Type": "application/json",
                "Mcp-Session-Id": "sess-music-vocal-1"
            });
            res.end(JSON.stringify({ jsonrpc: "2.0", id: rpc.id, result }));
        };

        if (rpc.method === "initialize") {
            sendRpc({ protocolVersion: "2025-03-26", serverInfo: { name: "mock-opus-music" }, capabilities: {} });
            return;
        }
        if (rpc.method === "notifications/initialized") {
            res.writeHead(202);
            res.end();
            return;
        }
        if (rpc.method === "tools/list") {
            sendRpc({
                tools: [
                    {
                        name: "create_project",
                        inputSchema: { type: "object", properties: { name: { type: "string" } } }
                    },
                    {
                        name: "generate_audio",
                        inputSchema: {
                            type: "object",
                            required: ["projectId", "requestKey", "audioType", "prompt"],
                            properties: {
                                projectId: { type: "string" },
                                requestKey: { type: "string" },
                                maxCredits: { type: "number" },
                                audioType: { type: "string", enum: ["speech", "bgm", "song"] },
                                model: { type: "string", enum: ["lyria-2", "lyria-3-pro-preview"] },
                                prompt: { type: "string" },
                                lyrics: { type: "string" },
                                instrumental: { type: "boolean" },
                                hasVocals: { type: "boolean" },
                                durationSeconds: { type: "number" }
                            }
                        }
                    }
                ]
            });
            return;
        }
        if (rpc.method === "tools/call") {
            const { name, arguments: args } = rpc.params;
            if (name === "create_project") {
                sendRpc({
                    structuredContent: { projectId: "proj-music-v1" },
                    content: [{ type: "text", text: JSON.stringify({ projectId: "proj-music-v1" }) }]
                });
                return;
            }
            if (name === "generate_audio") {
                musicCalls.push(args);
                if (!args.maxCredits || args.maxCredits <= 0) {
                    const quote = { status: "needs_approval", estimatedCredits: 4 };
                    sendRpc({
                        structuredContent: quote,
                        content: [{ type: "text", text: JSON.stringify(quote) }]
                    });
                    return;
                }
                const ok = { jobId: "job-music-vocal-88", status: "queued" };
                sendRpc({
                    structuredContent: ok,
                    content: [{ type: "text", text: JSON.stringify(ok) }]
                });
                return;
            }
        }
        res.writeHead(400);
        res.end();
    });

    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    const port = server.address().port;
    const mcpEndpoint = `http://127.0.0.1:${port}/mcp`;

    try {
        const createdVocalSong = await musicAdapter.createTask(
            {
                prompt: "Pop akustik hangat dengan gitar dan piano, 95 BPM",
                vocal_mode: "vocal",
                target_duration: "30",
                lyrics: plainIndoLyrics
            },
            "test-bearer-token",
            { mcpUrl: mcpEndpoint }
        );
        assert.match(createdVocalSong.taskId, /^opus:proj-music-v1:job-music-vocal-88$/);
        assert.equal(musicCalls.length, 2); /* quote maxCredits:0 -> approved maxCredits:4 */

        const finalMusicArgs = musicCalls[1];
        assert.equal(finalMusicArgs.audioType, "song"); /* memilih "song" di atas "bgm" saat vokal aktif */
        assert.equal(finalMusicArgs.model, "lyria-3-pro-preview"); /* menghindari lyria-2 yang instrumental-only */
        assert.equal(finalMusicArgs.instrumental, false);
        assert.equal(finalMusicArgs.hasVocals, true);
        assert.equal(finalMusicArgs.maxCredits, 4);
        assert.match(finalMusicArgs.lyrics, /\[Verse\]/);
        assert.match(finalMusicArgs.lyrics, /\[Chorus\]/);
        /* Pastikan `prompt` TETAP berisi arahan vokal + lirik [Verse]/[Chorus] walau field `lyrics` juga ada */
        assert.match(finalMusicArgs.prompt, /enter immediately at 0:02/);
        assert.match(finalMusicArgs.prompt, /\[Verse\]/);
        assert.match(finalMusicArgs.prompt, /\[Chorus\]/);
        assert.match(finalMusicArgs.prompt, /Melangkah sendiri di malam yang tenang/);
    } finally {
        await new Promise(resolve => server.close(resolve));
    }
});


