import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

import {
    formatSpeakerLabel,
    buildSpeakerFormattedDialog,
    normalizeTranscriptPayload
} from "../assets/js/transcript-format.js";
import {
    parsePodcastDialogScript,
    MAX_PODCAST_TURNS
} from "../models/opus-audio/podcast-dialog.js";
import {
    opusAudioModels,
    opusAudioModelMap
} from "../models/opus-audio/index.js";
import {
    opusTranscribeModels,
    opusTranscribeModelMap
} from "../models/opus-transcribe/index.js";
import {
    opusVideoModels,
    getOpusVideoModel
} from "../models/opus-video/index.js";
import {
    concatAudioClips,
    concatMp3Buffers,
    detectAudioContainer
} from "../lib/generate/audio-concat.js";
import {
    persistGeneratedPodcastAudio,
    persistGeneratedTranscript
} from "../lib/generate/persist-generated-audio.js";
import {
    resolveBillableCredit
} from "../lib/generate/qwencloud-credit.js";
import {
    STAGED_30S_MODEL_IDS,
    STAGED_30S_SEEDANCE_T2V_MODEL_ID,
    STAGED_30S_SEEDANCE_I2V_MODEL_ID,
    OPUS_VIDEO_DIRECTOR_MODEL_ID,
    isStaged30sModelId,
    resolveStagedTargetConfig,
    resolveStagedModelProfile,
    buildDefaultDirectorBgmPrompt,
    buildDirectorMuxFfmpegArgs
} from "../lib/generate/staged-video-30s.js";
import {
    createAudioTask,
    getAudioTask,
    createTranscribeTask,
    getTranscribeTask
} from "../provider/opus/client.js";
import opusVoicePreviewHandler from "../api/opus-voice-preview.js";
import opusBlackboxHandler from "../api/opus-blackbox.js";

const ROOT = process.cwd();

function buildWavBuffer(samples = [1000, -1000, 2000, -2000], sampleRate = 24000) {
    const pcmByteLen = samples.length * 2;
    const buf = Buffer.alloc(44 + pcmByteLen);
    buf.write("RIFF", 0, "ascii");
    buf.writeUInt32LE(36 + pcmByteLen, 4);
    buf.write("WAVE", 8, "ascii");
    buf.write("fmt ", 12, "ascii");
    buf.writeUInt32LE(16, 16);
    buf.writeUInt16LE(1, 20);
    buf.writeUInt16LE(1, 22);
    buf.writeUInt32LE(sampleRate, 24);
    buf.writeUInt32LE(sampleRate * 2, 28);
    buf.writeUInt16LE(2, 32);
    buf.writeUInt16LE(16, 34);
    buf.write("data", 36, "ascii");
    buf.writeUInt32LE(pcmByteLen, 40);
    for (let i = 0; i < samples.length; i += 1) {
        buf.writeInt16LE(samples[i], 44 + i * 2);
    }
    return buf;
}

function createMockRes() {
    return {
        statusCode: 200,
        headers: {},
        body: null,
        setHeader(k, v) {
            this.headers[k] = v;
        },
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.body = payload;
            return this;
        },
        end(payload) {
            if (typeof payload === "string") {
                try {
                    this.body = JSON.parse(payload);
                } catch {
                    this.body = payload;
                }
            } else if (payload !== undefined) {
                this.body = payload;
            }
            return this;
        }
    };
}

/* =========================================================
   FITUR 1: MULTI-SPEAKER DIARIZATION (`diarize`)
========================================================= */

test("Bagian 1 #1 — Diarization: formatSpeakerLabel idempoten, dialog multi-pembicara, dan toggle diarize=false", async () => {
    assert.equal(formatSpeakerLabel("speaker_0"), "Speaker 1");
    assert.equal(formatSpeakerLabel("speaker_1"), "Speaker 2");
    assert.equal(formatSpeakerLabel("0"), "Speaker 1");
    assert.equal(formatSpeakerLabel("Speaker 1"), "Speaker 1");
    assert.equal(formatSpeakerLabel(formatSpeakerLabel("speaker_0")), "Speaker 1");

    const trxAdapter = opusTranscribeModelMap["opus-transcribe-audio"];
    assert.ok(trxAdapter);
    assert.equal(trxAdapter.parameters.diarize.type, "boolean");
    assert.equal(trxAdapter.parameters.diarize.default, true);

    const samplePayload = {
        languageCode: "ind",
        text: "Halo Budi apa kabar? Kabar baik Andi, siap mulai rekaman.",
        words: [
            { text: "Halo", start: 0.1, end: 0.3, type: "word", speakerId: "speaker_0" },
            { text: "Budi", start: 0.35, end: 0.6, type: "word", speakerId: "speaker_0" },
            { text: "apa", start: 0.65, end: 0.8, type: "word", speakerId: "speaker_0" },
            { text: "kabar?", start: 0.85, end: 1.2, type: "word", speakerId: "speaker_0" },
            { text: "Kabar", start: 1.5, end: 1.8, type: "word", speakerId: "speaker_1" },
            { text: "baik", start: 1.85, end: 2.1, type: "word", speakerId: "speaker_1" },
            { text: "Andi,", start: 2.15, end: 2.5, type: "word", speakerId: "speaker_1" },
            { text: "siap", start: 2.55, end: 2.8, type: "word", speakerId: "speaker_1" },
            { text: "mulai", start: 2.85, end: 3.1, type: "word", speakerId: "speaker_1" },
            { text: "rekaman.", start: 3.15, end: 3.6, type: "word", speakerId: "speaker_1" }
        ]
    };

    const withDiarize = normalizeTranscriptPayload(samplePayload, { diarize: true });
    assert.equal(withDiarize.diarize, true);
    assert.equal(withDiarize.speakerCount, 2);
    assert.deepEqual(withDiarize.speakers, ["Speaker 1", "Speaker 2"]);
    assert.match(withDiarize.dialogText, /\[Speaker 1\]: Halo Budi apa kabar\?/);
    assert.match(withDiarize.dialogText, /\[Speaker 2\]: Kabar baik Andi, siap mulai rekaman\./);
    assert.equal(withDiarize.txt, withDiarize.dialogText);
    assert.match(withDiarize.srt, /\[Speaker 1\] Halo Budi apa kabar\?/);

    const withoutDiarize = normalizeTranscriptPayload(samplePayload, { diarize: false });
    assert.equal(withoutDiarize.diarize, false);
    assert.equal(withoutDiarize.speakerCount, 0);
    assert.equal(withoutDiarize.dialogText, "");
    assert.ok(!withoutDiarize.segments[0].speaker);
    assert.doesNotMatch(withoutDiarize.srt, /\[Speaker 1\]/);

    /* persistGeneratedTranscript wajib mempertahankan diarize=false */
    const dataUri = await persistGeneratedTranscript({ transcript: withoutDiarize });
    assert.match(dataUri, /^data:application\/json;base64,/);
    const decoded = JSON.parse(Buffer.from(dataUri.split(",")[1], "base64").toString("utf8"));
    assert.equal(decoded.diarize, false);
    assert.equal(decoded.speakerCount, 0);

    /* Mock MCP server untuk memverifikasi diarize=false mengirim diarize:false & menyematkan |d0 */
    const receivedCalls = [];
    const server = http.createServer(async (req, res) => {
        let raw = "";
        for await (const chunk of req) raw += chunk;
        const rpc = JSON.parse(raw || "{}");
        const reply = result => {
            res.writeHead(200, { "Content-Type": "application/json", "Mcp-Session-Id": "s-d0" });
            res.end(JSON.stringify({ jsonrpc: "2.0", id: rpc.id, result }));
        };
        if (rpc.method === "initialize") return reply({ protocolVersion: "2025-03-26", capabilities: {} });
        if (rpc.method === "notifications/initialized") {
            res.writeHead(202);
            return res.end();
        }
        if (rpc.method === "tools/list") {
            return reply({
                tools: [
                    { name: "create_project", inputSchema: { type: "object", properties: { name: { type: "string" } } } },
                    {
                        name: "transcribe_audio",
                        inputSchema: {
                            type: "object",
                            properties: {
                                audio: { type: "object", properties: { url: { type: "string" } } },
                                diarize: { type: "boolean" },
                                projectId: { type: "string" }
                            }
                        }
                    },
                    { name: "get_status", inputSchema: { type: "object", properties: { jobId: { type: "string" } } } }
                ]
            });
        }
        if (rpc.method === "tools/call") {
            const { name, arguments: args } = rpc.params;
            if (name === "create_project") {
                return reply({ structuredContent: { projectId: "p-d0" }, content: [{ type: "text", text: '{"projectId":"p-d0"}' }] });
            }
            if (name === "transcribe_audio") {
                receivedCalls.push(args);
                return reply({ structuredContent: { jobId: "j-d0", status: "queued" }, content: [{ type: "text", text: '{"jobId":"j-d0","status":"queued"}' }] });
            }
            if (name === "get_status") {
                const done = { jobId: "j-d0", status: "completed", outputs: [samplePayload] };
                return reply({ structuredContent: done, content: [{ type: "text", text: JSON.stringify(done) }] });
            }
        }
        res.writeHead(400);
        res.end();
    });

    await new Promise(r => server.listen(0, "127.0.0.1", r));
    const mcpUrl = `http://127.0.0.1:${server.address().port}/mcp`;
    try {
        const created = await createTranscribeTask(
            { audio_url: "https://cdn.example/interview.mp3", diarize: false },
            "test",
            { mcpUrl }
        );
        assert.match(created.taskId, /\|d0$/);
        assert.equal(receivedCalls[0].diarize, false);

        const status = await getTranscribeTask(created.taskId, "test", { mcpUrl });
        assert.equal(status.status, "COMPLETED");
        assert.equal(status.transcript.diarize, false);
        assert.equal(status.transcript.speakerCount, 0);
    } finally {
        await new Promise(r => server.close(r));
    }
});

/* =========================================================
   FITUR 2: PODCAST 2 SUARA & PREVIEW SUARA GRATIS
========================================================= */

test("Bagian 1 #2 — Podcast 2 Suara: parser dialog, concat WAV/MP3, MCP multi-turn, & endpoint Preview Suara gratis", async () => {
    const parsedAb = parsePodcastDialogScript(
        "A: Selamat malam semuanya!\nB: Malam juga! Topik hari ini seru banget.\nA: Yuk langsung kita bahas."
    );
    assert.equal(parsedAb.turns.length, 3);
    assert.equal(parsedAb.turns[0].speaker, "A");
    assert.equal(parsedAb.turns[1].speaker, "B");
    assert.equal(parsedAb.turns[2].speaker, "A");

    const parsedNamed = parsePodcastDialogScript(
        "[Host]: Halo dari studio GEN-Z.AI!\n[Narasumber]: Terima kasih sudah mengundang saya."
    );
    assert.equal(parsedNamed.turns.length, 2);
    assert.equal(parsedNamed.turns[0].speaker, "A");
    assert.equal(parsedNamed.turns[1].speaker, "B");

    const podcastModel = opusAudioModelMap["opus-audio-podcast"];
    assert.ok(podcastModel);
    assert.equal(podcastModel.config.adminDefaults.credit_480p, 1000);
    const sameVoiceValidation = podcastModel.validate({
        prompt: "A: Halo\nB: Hai",
        voice_a: "Puck",
        voice_b: "Puck"
    });
    assert.equal(sameVoiceValidation.valid, false);
    assert.match(sameVoiceValidation.errors.join(" "), /berbeda/i);

    /* Splicing WAV PCM16 + jeda hening antar giliran */
    const wavA = buildWavBuffer([1200, -1200, 1200, -1200], 24000);
    const wavB = buildWavBuffer([2400, -2400, 2400, -2400], 24000);
    const mergedWav = concatAudioClips(
        [new Uint8Array(wavA), new Uint8Array(wavB)],
        { pauseMs: 100 }
    );
    assert.equal(mergedWav.ext, "wav");
    assert.equal(mergedWav.mimeType, "audio/wav");
    assert.equal(Buffer.from(mergedWav.bytes.slice(0, 4)).toString("ascii"), "RIFF");
    assert.ok(mergedWav.bytes.byteLength > wavA.byteLength + wavB.byteLength);

    /* Strip ID3v2 pada MP3 & concat mulus */
    const fakeMp3Frame = Buffer.from([0xff, 0xfb, 0x90, 0x64, 0x00, 0x11, 0x22, 0x33]);
    const id3Header = Buffer.from([
        0x49, 0x44, 0x33, 0x03, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x04,
        0xde, 0xad, 0xbe, 0xef
    ]);
    const mp3WithId3 = Buffer.concat([id3Header, fakeMp3Frame]);
    assert.equal(detectAudioContainer(new Uint8Array(mp3WithId3)), "mp3");
    const mergedMp3 = concatMp3Buffers(
        [new Uint8Array(mp3WithId3), new Uint8Array(fakeMp3Frame)],
        { pauseMs: 0 }
    );
    assert.equal(mergedMp3.byteLength, fakeMp3Frame.byteLength * 2);

    /* Mock MCP untuk Podcast 2 giliran */
    const speechArgs = [];
    const server = http.createServer(async (req, res) => {
        const reqUrl = new URL(req.url, "http://127.0.0.1");
        if (req.method === "GET" && reqUrl.pathname.startsWith("/turn-")) {
            res.writeHead(200, { "Content-Type": "audio/wav" });
            res.end(reqUrl.pathname === "/turn-1.wav" ? wavA : wavB);
            return;
        }
        let raw = "";
        for await (const chunk of req) raw += chunk;
        const rpc = JSON.parse(raw || "{}");
        const reply = result => {
            res.writeHead(200, { "Content-Type": "application/json", "Mcp-Session-Id": "s-pod" });
            res.end(JSON.stringify({ jsonrpc: "2.0", id: rpc.id, result }));
        };
        if (rpc.method === "initialize") return reply({ protocolVersion: "2025-03-26", capabilities: {} });
        if (rpc.method === "notifications/initialized") {
            res.writeHead(202);
            return res.end();
        }
        if (rpc.method === "tools/list") {
            return reply({
                tools: [
                    { name: "create_project", inputSchema: { type: "object", properties: { name: { type: "string" } } } },
                    {
                        name: "generate_audio",
                        inputSchema: {
                            type: "object",
                            properties: {
                                kind: { type: "string" },
                                text: { type: "string" },
                                voiceName: { type: "string" },
                                styleInstructions: { type: "string" },
                                projectId: { type: "string" }
                            }
                        }
                    },
                    { name: "get_status", inputSchema: { type: "object", properties: { jobId: { type: "string" } } } }
                ]
            });
        }
        if (rpc.method === "tools/call") {
            const { name, arguments: args } = rpc.params;
            if (name === "create_project") {
                return reply({ structuredContent: { projectId: "p-pod" }, content: [{ type: "text", text: '{"projectId":"p-pod"}' }] });
            }
            if (name === "generate_audio") {
                speechArgs.push(args);
                const jobId = `job-turn-${speechArgs.length}`;
                return reply({ structuredContent: { jobId, status: "queued" }, content: [{ type: "text", text: JSON.stringify({ jobId, status: "queued" }) }] });
            }
            if (name === "get_status") {
                const port = server.address().port;
                const turnFile = args.jobId === "job-turn-1" ? "turn-1.wav" : "turn-2.wav";
                const done = {
                    jobId: args.jobId,
                    status: "completed",
                    outputs: [{ url: `http://127.0.0.1:${port}/${turnFile}`, mimeType: "audio/wav" }]
                };
                return reply({ structuredContent: done, content: [{ type: "text", text: JSON.stringify(done) }] });
            }
        }
        res.writeHead(400);
        res.end();
    });

    await new Promise(r => server.listen(0, "127.0.0.1", r));
    const mcpUrl = `http://127.0.0.1:${server.address().port}/mcp`;
    try {
        const created = await createAudioTask(
            {
                audioKind: "podcast",
                prompt: "A: Halo pendengar setia!\nB: Senang kembali menyapa kalian!",
                voice_a: "Aoede",
                voice_b: "Fenrir",
                style_a: "Hangat",
                style_b: "Tegas"
            },
            "test",
            { mcpUrl }
        );
        assert.equal(speechArgs.length, 2);
        assert.equal(speechArgs[0].voiceName, "Aoede");
        assert.equal(speechArgs[1].voiceName, "Fenrir");
        assert.match(created.taskId, /podcast:/);

        const polled = await getAudioTask(created.taskId, "test", { mcpUrl });
        assert.equal(polled.status, "COMPLETED");
        assert.equal(polled.audioUrls.length, 2);

        const dataMerged = await persistGeneratedPodcastAudio({
            sourceUrls: polled.audioUrls
        });
        assert.match(dataMerged, /^data:audio\/wav;base64,/);
    } finally {
        await new Promise(r => server.close(r));
    }

    /* Endpoint /api/opus-voice-preview: mengembalikan sampel cache 0 kredit */
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, init = {}) => {
        const u = String(url);
        if (u.includes("/auth/v1/user")) {
            return new Response(JSON.stringify({ id: "user-1", email: "member@example.com" }), { status: 200 });
        }
        if (u.includes("/storage/v1/object/user-uploads/voice-previews/opus/kore.mp3") && init.method === "HEAD") {
            return new Response(null, { status: 200 });
        }
        if (u.includes("/storage/v1/object/sign/user-uploads/voice-previews/opus/kore.mp3")) {
            return new Response(JSON.stringify({ signedURL: "/object/sign/user-uploads/voice-previews/opus/kore.mp3?t=ok" }), { status: 200 });
        }
        return new Response("not found", { status: 404 });
    };
    try {
        const req = {
            method: "GET",
            query: { voice: "Kore" },
            headers: { authorization: "Bearer test" },
            env: {
                SUPABASE_URL: "https://mock-sb.example",
                SUPABASE_SERVICE_ROLE_KEY: "test"
            }
        };
        const res = createMockRes();
        await opusVoicePreviewHandler(req, res);
        assert.equal(res.statusCode, 200);
        assert.equal(res.body.success, true);
        assert.equal(res.body.voice, "Kore");
        assert.equal(res.body.cached, true);
        assert.equal(res.body.credits_charged, 0);
        assert.match(res.body.preview_url, /kore\.mp3/);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

/* =========================================================
   FITUR 3 & 4: STAGED 20S/30S T2V + I2V & AI VIDEO DIRECTOR
========================================================= */

test("Bagian 1 #3 & #4 — Seedance 2.5 T2V/I2V 30s & AI Video Director: profil model, kredit, dan argumen FFmpeg mux", () => {
    assert.ok(isStaged30sModelId(STAGED_30S_SEEDANCE_T2V_MODEL_ID));
    assert.ok(isStaged30sModelId(STAGED_30S_SEEDANCE_I2V_MODEL_ID));
    assert.ok(isStaged30sModelId(OPUS_VIDEO_DIRECTOR_MODEL_ID));
    assert.equal(STAGED_30S_MODEL_IDS.length, 5);

    const t2vProfile = resolveStagedModelProfile(STAGED_30S_SEEDANCE_T2V_MODEL_ID);
    assert.equal(t2vProfile.clip1AdapterId, "opus-seedance-2.5-t2v");
    assert.equal(t2vProfile.continuationI2vAdapterId, "opus-seedance-2.5-i2v");

    const i2vProfile = resolveStagedModelProfile(STAGED_30S_SEEDANCE_I2V_MODEL_ID);
    assert.equal(i2vProfile.clip1AdapterId, "opus-seedance-2.5-i2v");
    assert.equal(i2vProfile.continuationI2vAdapterId, "opus-seedance-2.5-i2v");

    const directorProfile = resolveStagedModelProfile(OPUS_VIDEO_DIRECTOR_MODEL_ID);
    assert.equal(directorProfile.isVideoDirector, true);
    assert.equal(directorProfile.clip1AdapterId, "opus-seedance-2.5-t2v");
    assert.equal(directorProfile.continuationI2vAdapterId, "opus-seedance-2.5-i2v");

    const t2vAdapter = getOpusVideoModel(STAGED_30S_SEEDANCE_T2V_MODEL_ID);
    const i2vAdapter = getOpusVideoModel(STAGED_30S_SEEDANCE_I2V_MODEL_ID);
    const directorAdapter = getOpusVideoModel(OPUS_VIDEO_DIRECTOR_MODEL_ID);
    assert.equal(t2vAdapter.config.adminDefaults.credit_480p, 4500);
    assert.equal(t2vAdapter.config.adminDefaults.credit_720p, 6000);
    assert.equal(i2vAdapter.config.adminDefaults.credit_480p, 4500);
    assert.equal(i2vAdapter.config.adminDefaults.credit_720p, 6000);
    assert.equal(directorAdapter.config.adminDefaults.credit_480p, 3500);
    assert.equal(directorAdapter.config.adminDefaults.credit_720p, 3500);

    /* Kredit T2V/I2V 30s: 30s = 4500/6000, 20s = 2/3 = 3000/4000 */
    assert.equal(
        resolveBillableCredit(4500, { duration: "30" }, t2vAdapter.config, STAGED_30S_SEEDANCE_T2V_MODEL_ID).billableCredit,
        4500
    );
    assert.equal(
        resolveBillableCredit(6000, { duration: "30" }, t2vAdapter.config, STAGED_30S_SEEDANCE_T2V_MODEL_ID).billableCredit,
        6000
    );
    assert.equal(
        resolveBillableCredit(4500, { duration: "20" }, t2vAdapter.config, STAGED_30S_SEEDANCE_T2V_MODEL_ID).billableCredit,
        3000
    );
    assert.equal(
        resolveBillableCredit(6000, { duration: "20" }, i2vAdapter.config, STAGED_30S_SEEDANCE_I2V_MODEL_ID).billableCredit,
        4000
    );

    /* Kredit AI Video Director: flat 3.500 kredit untuk 10s maupun 15s (tidak kena skala 2/3) */
    assert.equal(
        resolveBillableCredit(3500, { duration: "10" }, directorAdapter.config, OPUS_VIDEO_DIRECTOR_MODEL_ID).billableCredit,
        3500
    );
    assert.equal(
        resolveBillableCredit(3500, { duration: "15" }, directorAdapter.config, OPUS_VIDEO_DIRECTOR_MODEL_ID).billableCredit,
        3500
    );
    assert.equal(
        resolveBillableCredit(3500, { duration: "20" }, directorAdapter.config, OPUS_VIDEO_DIRECTOR_MODEL_ID).billableCredit,
        3500
    );

    /* Target config & FFmpeg muxing args untuk AI Video Director */
    assert.deepEqual(resolveStagedTargetConfig("15", OPUS_VIDEO_DIRECTOR_MODEL_ID), {
        targetDuration: 15,
        totalClips: 1,
        clipDuration: 15,
        isVideoDirector: true
    });
    const bgmAuto = buildDefaultDirectorBgmPrompt("Kopi pagi sinematik di pegunungan");
    assert.match(bgmAuto, /instrumental background music/i);
    assert.match(bgmAuto, /without vocals/i);

    const muxBoth = buildDirectorMuxFfmpegArgs({
        videoPath: "/tmp/video.mp4",
        voicePath: "/tmp/voice.mp3",
        bgmPath: "/tmp/bgm.mp3",
        outputPath: "/tmp/final.mp4",
        videoDuration: 10
    });
    assert.ok(muxBoth.some(a => a.includes("amix=inputs=2")));
    assert.equal(muxBoth[muxBoth.length - 1], "/tmp/final.mp4");

    const directorRunnerSrc = fs.readFileSync(path.join(ROOT, "scripts/run-staged-video-30s.mjs"), "utf8");
    assert.match(directorRunnerSrc, /create_director_audio/);
    assert.match(directorRunnerSrc, /query_director_audio/);
    assert.match(directorRunnerSrc, /buildDirectorMuxFfmpegArgs/);
});

/* =========================================================
   FITUR 5: PANEL OPUS STATUS & JOB RECOVERY DI BLACK BOX
========================================================= */

test("Bagian 1 #5 — BLACK BOX Modul 02 & /api/opus-blackbox: guard admin/owner, status MCP, dan 1-klik job recovery", async () => {
    const blackBoxHtml = fs.readFileSync(path.join(ROOT, "black-box/index.html"), "utf8");
    assert.match(blackBoxHtml, /id="bbOpusDiagToggle"/);
    assert.match(blackBoxHtml, /id="bbOpusDiagPanel"/);
    assert.match(blackBoxHtml, /\/api\/opus-blackbox/);

    /* Verifikasi seluruh inline <script> di black-box/index.html bebas syntax error */
    const scriptMatches = [...blackBoxHtml.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
    assert.ok(scriptMatches.length >= 1);
    for (const match of scriptMatches) {
        const jsBody = match[1].trim();
        if (jsBody) {
            assert.doesNotThrow(() => new vm.Script(jsBody));
        }
    }

    /* Mock MCP server untuk whoami + get_status + resolve_job */
    const server = http.createServer(async (req, res) => {
        let raw = "";
        for await (const chunk of req) raw += chunk;
        const rpc = JSON.parse(raw || "{}");
        const reply = result => {
            res.writeHead(200, { "Content-Type": "application/json", "Mcp-Session-Id": "s-bb" });
            res.end(JSON.stringify({ jsonrpc: "2.0", id: rpc.id, result }));
        };
        if (rpc.method === "initialize") return reply({ protocolVersion: "2025-03-26", capabilities: {} });
        if (rpc.method === "notifications/initialized") {
            res.writeHead(202);
            return res.end();
        }
        if (rpc.method === "tools/list") {
            return reply({
                tools: [
                    { name: "opus_video_tools_whoami", inputSchema: { type: "object", properties: {} } },
                    { name: "list_jobs", inputSchema: { type: "object", properties: { projectId: { type: "string" } } } },
                    { name: "get_status", inputSchema: { type: "object", properties: { jobId: { type: "string" } } } },
                    { name: "resolve_job", inputSchema: { type: "object", properties: { jobId: { type: "string" } } } }
                ]
            });
        }
        if (rpc.method === "tools/call") {
            const { name, arguments: args } = rpc.params;
            if (name === "opus_video_tools_whoami") {
                const who = { email: "studio@gen-z.ai", credits: 9250, plan: "Pro" };
                return reply({ structuredContent: who, content: [{ type: "text", text: JSON.stringify(who) }] });
            }
            if (name === "list_jobs") {
                const jobs = { jobs: [{ jobId: "job-stuck-1", status: "completed", projectId: args.projectId }] };
                return reply({ structuredContent: jobs, content: [{ type: "text", text: JSON.stringify(jobs) }] });
            }
            if (name === "get_status" || name === "resolve_job") {
                const done = {
                    jobId: args.jobId,
                    status: "completed",
                    outputs: [{ videoUrl: "https://cdn.example/recovered-video.mp4" }]
                };
                return reply({ structuredContent: done, content: [{ type: "text", text: JSON.stringify(done) }] });
            }
        }
        res.writeHead(400);
        res.end();
    });

    await new Promise(r => server.listen(0, "127.0.0.1", r));
    const mcpUrl = `http://127.0.0.1:${server.address().port}/mcp`;
    const originalFetch = globalThis.fetch;
    const patchedRows = [];
    let currentRole = "user";

    globalThis.fetch = async (url, init = {}) => {
        const u = String(url);
        if (u.startsWith("http://127.0.0.1:")) {
            return originalFetch(url, init);
        }
        if (u.includes("/auth/v1/user")) {
            return new Response(JSON.stringify({ id: "owner-1", email: "owner@gen-z.ai" }), { status: 200 });
        }
        if (u.includes("/rest/v1/profiles")) {
            return new Response(JSON.stringify([{ id: "owner-1", role: currentRole, email: "owner@gen-z.ai" }]), { status: 200 });
        }
        if (u.includes("/rest/v1/provider_credentials")) {
            return new Response(JSON.stringify([]), { status: 200 });
        }
        if (u.includes("/rest/v1/opus_oauth_tokens")) {
            return new Response(
                JSON.stringify([
                    {
                        id: "default",
                        access_token: "test",
                        expires_at: new Date(Date.now() + 3600000).toISOString(),
                        updated_at: new Date().toISOString()
                    }
                ]),
                { status: 200 }
            );
        }
        if (u.includes("/rest/v1/generation_history") && (!init.method || init.method === "GET")) {
            return new Response(
                JSON.stringify([
                    {
                        id: "hist-1",
                        user_id: "owner-1",
                        user_email: "owner@gen-z.ai",
                        model_id: "opus-seedance-2.5-t2v",
                        model_name: "Seedance 2.5",
                        task_id: "opus:proj-9:job-stuck-1",
                        status: "processing",
                        result_url: null,
                        credit_cost: 1500
                    }
                ]),
                { status: 200 }
            );
        }
        if (u.includes("/rest/v1/generation_history") && init.method === "PATCH") {
            const body = JSON.parse(init.body || "{}");
            patchedRows.push(body);
            return new Response(JSON.stringify([{ id: "hist-1", ...body }]), { status: 200 });
        }
        return new Response("not found", { status: 404 });
    };

    const env = {
        SUPABASE_URL: "https://mock-sb.example",
        SUPABASE_SERVICE_ROLE_KEY: "test",
        OPUS_API_KEY: "test",
        OPUS_MCP_URL: mcpUrl
    };

    try {
        /* 1. User biasa ditolak 403 */
        const resDenied = createMockRes();
        await opusBlackboxHandler(
            { method: "GET", query: { action: "status" }, headers: { authorization: "Bearer test" }, env },
            resDenied
        );
        assert.equal(resDenied.statusCode, 403);

        /* 2. Owner diizinkan membaca status MCP + OAuth Vault + daftar job menggantung */
        currentRole = "owner";
        const resStatus = createMockRes();
        await opusBlackboxHandler(
            { method: "GET", query: { action: "status" }, headers: { authorization: "Bearer test" }, env },
            resStatus
        );
        assert.equal(resStatus.statusCode, 200);
        assert.equal(resStatus.body.success, true);
        assert.equal(resStatus.body.mcp.slots[0].ok, true);
        assert.equal(resStatus.body.mcp.slots[0].account.email, "studio@gen-z.ai");
        assert.equal(resStatus.body.mcp.slots[0].account.credits, 9250);
        assert.equal(resStatus.body.vault.count, 1);
        assert.equal(resStatus.body.recoverableHistory.length, 1);

        /* 3. Owner memulihkan job yang menggantung lewat action=resolve_job */
        const resRecover = createMockRes();
        await opusBlackboxHandler(
            {
                method: "POST",
                body: {
                    action: "resolve_job",
                    task_id: "opus:proj-9:job-stuck-1",
                    history_id: "hist-1"
                },
                headers: { authorization: "Bearer test" },
                env
            },
            resRecover
        );
        assert.equal(resRecover.statusCode, 200);
        assert.equal(resRecover.body.outputUrls[0], "https://cdn.example/recovered-video.mp4");
        assert.equal(resRecover.body.historyUpdated, true);
        assert.equal(patchedRows.length, 1);
        assert.equal(patchedRows[0].status, "success");
        assert.equal(patchedRows[0].result_url, "https://cdn.example/recovered-video.mp4");
    } finally {
        globalThis.fetch = originalFetch;
        await new Promise(r => server.close(r));
    }
});
