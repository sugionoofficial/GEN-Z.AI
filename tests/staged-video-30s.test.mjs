import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { getOpusVideoModel } from "../models/opus-video/index.js";
import { resolveBillableCredit } from "../lib/generate/qwencloud-credit.js";
import { isRefOwnedByUser } from "../lib/generate/private-media.js";
import {
    STAGED_30S_MODEL_ID,
    buildLastFrameFfmpegArgs,
    buildReferenceAudioSliceFfmpegArgs,
    buildReferenceVideoSliceFfmpegArgs,
    buildSeamlessMergeFfmpegArgs,
    buildStaged30sPrompts,
    cleanContinuationPromptForFirstFrame,
    computeLoopedSegmentTiming,
    computeStagedCreditSettlement,
    generateStaged30sTaskId,
    isStaged30sModelId,
    isStaged30sTaskId,
    resolveStagedApiBaseUrl,
    resolveStagedTargetConfig
} from "../lib/generate/staged-video-30s.js";
import { runStagedVideoOrchestrator } from "../scripts/run-staged-video-30s.mjs";

const USER_ID = "88888888-4444-4444-8888-121212121212";
const JOB_ID = "11111111-2222-4333-8444-555555555555";
const HISTORY_ID = "99999999-2222-4333-8444-666666666666";

test("model clone opus-seedance-2.5-r2v-30s terdaftar dengan durasi 30 detik & kredit flat", () => {
    const model = getOpusVideoModel(STAGED_30S_MODEL_ID);
    assert.ok(model, "adapter opus-seedance-2.5-r2v-30s harus terdaftar");
    assert.equal(model.config.staged30s, true);
    assert.equal(model.config.referenceRequired, true);
    assert.equal(isStaged30sModelId(STAGED_30S_MODEL_ID), true);
    assert.equal(isStaged30sModelId("opus-seedance-2.5-r2v"), false);

    const taskId = generateStaged30sTaskId(() => 1793400000000, "abc12345");
    assert.equal(taskId, "staged30_1793400000000_abc12345");
    assert.equal(isStaged30sTaskId(taskId), true);

    const missingRef = model.validate({
        prompt: "Seorang presenter berbicara di studio",
        duration: "30"
    });
    assert.equal(missingRef.valid, false);

    const wrongDuration = model.validate({
        prompt: "@image1 berjalan santai",
        image_urls: ["https://cdn.example.com/ref.jpg"],
        duration: "10"
    });
    assert.equal(wrongDuration.valid, false);

    const valid30 = model.validate({
        prompt: "@image1 menari mengikuti @video1 dengan musik @audio1",
        image_urls: ["https://cdn.example.com/ref.jpg"],
        video_urls: ["https://cdn.example.com/motion.mp4"],
        audio_url: "https://cdn.example.com/music.mp3",
        aspect_ratio: "9:16",
        resolution: "720p",
        duration: "30",
        generate_audio: true
    });
    assert.equal(valid30.valid, true, valid30.errors.join("; "));

    const billed720 = resolveBillableCredit(
        7500,
        { duration: "30" },
        model.config,
        STAGED_30S_MODEL_ID
    );
    const billed480 = resolveBillableCredit(
        6000,
        { duration: "30" },
        model.config,
        STAGED_30S_MODEL_ID
    );
    assert.equal(billed720.billableCredit, 7500, "tarif 720p harus flat 7500 tanpa dikali 30");
    assert.equal(billed720.durationFactor, 1);
    assert.equal(billed480.billableCredit, 6000, "tarif 480p harus flat 6000 tanpa dikali 30");
    assert.equal(billed480.durationFactor, 1);
});

test("buildStaged30sPrompts memetakan durasi eksplisit 0-10, 11-20, dan 21-30 secara presisi", () => {
    const prompt = [
        "Gaya sinematik 35mm, pencahayaan golden hour hangat.",
        "0-10 detik: @image1 berjalan memasuki taman bunga mengikuti langkah @video1.",
        "11-20 detik: @image1 berhenti di dekat air mancur lalu menoleh ke kamera sambil tersenyum.",
        "21-30 detik: Kamera bergerak mundur perlahan memperlihatkan panorama taman sore hari."
    ].join("\n");

    const staged = buildStaged30sPrompts(prompt);
    assert.equal(staged.mode, "explicit_duration");
    assert.equal(staged.hasExplicitDuration, true);

    // Klip 1 wajib mempertahankan @image1 & @video1 serta hanya memuat aksi 0-10
    assert.match(staged.clip1, /Durasi 0-10 detik/i);
    assert.match(staged.clip1, /@image1/);
    assert.match(staged.clip1, /@video1/);
    assert.doesNotMatch(staged.clip1, /berhenti di dekat air mancur/i);
    assert.doesNotMatch(staged.clip1, /panorama taman sore hari/i);

    // Klip 2 wajib memakai segmen 11-20 dan membersihkan token @image1 untuk first_last_frame
    assert.match(staged.clip2, /Durasi 11-20 detik/i);
    assert.match(staged.clip2, /berhenti di dekat air mancur/i);
    assert.doesNotMatch(staged.clip2, /@image1|@video1/);
    assert.doesNotMatch(staged.clip2, /panorama taman sore hari/i);

    // Klip 3 wajib memakai segmen 21-30
    assert.match(staged.clip3, /Durasi 21-30 detik/i);
    assert.match(staged.clip3, /panorama taman sore hari/i);
    assert.doesNotMatch(staged.clip3, /memasuki taman bunga/i);
});

test("buildStaged30sPrompts mendukung format [00:00-00:10] / 10-20s / 20-30s & mengabaikan angka non-durasi", () => {
    const clockPrompt =
        "[00:00-00:10] Pembukaan di lobi hotel mewah.\n" +
        "[00:10-00:20] Subjek menaiki tangga marmer secara anggun.\n" +
        "[00:20-00:30] Subjek tiba di balkon memandang lampu kota malam.";
    const clockRes = buildStaged30sPrompts(clockPrompt);
    assert.equal(clockRes.hasExplicitDuration, true);
    assert.match(clockRes.clip1, /lobi hotel mewah/);
    assert.match(clockRes.clip2, /tangga marmer/);
    assert.match(clockRes.clip3, /balkon memandang lampu kota/);

    // Angka usia "20-25 tahun" bukan penanda durasi -> otomatis dibuatkan durasi oleh sistem
    const agePrompt =
        "@image1 wanita usia 20-25 tahun sedang berbicara ramah di ruang kerja modern dengan @audio1";
    const ageRes = buildStaged30sPrompts(agePrompt);
    assert.equal(ageRes.hasExplicitDuration, false);
    assert.equal(ageRes.mode, "auto_generated");
    assert.match(ageRes.clip1, /Durasi 0-10 detik/);
    assert.match(ageRes.clip2, /Durasi 11-20 detik/);
    assert.match(ageRes.clip3, /Durasi 21-30 detik/);
    assert.doesNotMatch(ageRes.clip2, /@image1|@audio1/);
    assert.doesNotMatch(ageRes.clip3, /@image1|@audio1/);
});

test("buildStaged30sPrompts membuatkan durasi 0-10, 11-20, 21-30 otomatis saat prompt tanpa durasi", () => {
    const multiBeatPrompt =
        "@image1 membuka buku catatan di meja kafe. Dia menulis ide sambil tersenyum tenang. Kamera bergerak perlahan menyorot cangkir kopi dan jendela hujan.";
    const res = buildStaged30sPrompts(multiBeatPrompt);

    assert.equal(res.mode, "auto_generated");
    assert.equal(res.hasExplicitDuration, false);
    assert.match(res.clip1, /Durasi 0-10 detik/);
    assert.match(res.clip1, /membuka buku catatan/);
    assert.match(res.clip2, /Durasi 11-20 detik/);
    assert.match(res.clip2, /menulis ide sambil tersenyum tenang/);
    assert.match(res.clip3, /Durasi 21-30 detik/);
    assert.match(res.clip3, /cangkir kopi dan jendela hujan/);

    assert.equal(
        cleanContinuationPromptForFirstFrame("@image1 menari mengikuti gerakan @video1 dengan suara @audio1"),
        "subjek utama pada frame awal menari dengan gerakan dan ritme yang tetap konsisten dengan ekspresi serta ritme yang konsisten"
    );
});

test("computeStagedCreditSettlement menghitung potongan & refund proporsional dengan akurat", () => {
    assert.deepEqual(computeStagedCreditSettlement(7500, 3), {
        completedClips: 3,
        totalClips: 3,
        charged: 7500,
        refund: 0,
        finalDuration: 30,
        outcome: "completed"
    });

    assert.deepEqual(computeStagedCreditSettlement(7500, 2), {
        completedClips: 2,
        totalClips: 3,
        charged: 5000,
        refund: 2500,
        finalDuration: 20,
        outcome: "partial_completed"
    });

    assert.deepEqual(computeStagedCreditSettlement(6000, 1), {
        completedClips: 1,
        totalClips: 3,
        charged: 2000,
        refund: 4000,
        finalDuration: 10,
        outcome: "partial_completed"
    });

    assert.deepEqual(computeStagedCreditSettlement(7500, 0), {
        completedClips: 0,
        totalClips: 3,
        charged: 0,
        refund: 7500,
        finalDuration: 0,
        outcome: "failed"
    });
});

test("FFmpeg builders & path RLS mendukung ekstraksi last-frame presisi dan penggabungan mulus tanpa patah", () => {
    const exactFrameArgs = buildLastFrameFfmpegArgs({
        inputPath: "/tmp/clip-1.mp4",
        outputPath: "/tmp/frame-1-end.png",
        totalFrames: 240
    });
    assert.ok(exactFrameArgs.includes("select=eq(n\\,239)"));

    const fallbackFrameArgs = buildLastFrameFfmpegArgs({
        inputPath: "/tmp/clip-1.mp4",
        outputPath: "/tmp/frame-1-end.png",
        totalFrames: 0
    });
    assert.ok(fallbackFrameArgs.includes("-sseof"));

    const mergeArgs = buildSeamlessMergeFfmpegArgs({
        clipPaths: ["/tmp/c1.mp4", "/tmp/c2.mp4", "/tmp/c3.mp4"],
        clipInfos: [
            { width: 720, height: 1280, fps: 24, duration: 10, hasAudio: true },
            { width: 720, height: 1280, fps: 24, duration: 10, hasAudio: true },
            { width: 720, height: 1280, fps: 24, duration: 10, hasAudio: false }
        ],
        outputPath: "/tmp/merged-30s.mp4"
    });

    const filterComplex = mergeArgs[mergeArgs.indexOf("-filter_complex") + 1];
    assert.match(filterComplex, /\[1:v:0\]trim=start_frame=1,setpts=PTS-STARTPTS/);
    assert.match(filterComplex, /\[2:v:0\]trim=start_frame=1,setpts=PTS-STARTPTS/);
    assert.match(filterComplex, /anullsrc=channel_layout=stereo/);
    assert.match(filterComplex, /acrossfade=d=0\.06/);
    assert.ok(mergeArgs.includes("+faststart"));

    // Pastikan semua path klip & hasil akhir berada di dalam namespace milik user (RLS & private-media)
    const clipRef = `supabase-private://user-uploads/upscale-videos/outputs/${USER_ID}/staged30-${HISTORY_ID}/frame-1-end.png`;
    const mergedRef = `supabase-private://user-uploads/upscale-videos/outputs/${USER_ID}/staged30-${HISTORY_ID}-1793400000.mp4`;
    assert.equal(isRefOwnedByUser(clipRef, USER_ID), true);
    assert.equal(isRefOwnedByUser(mergedRef, USER_ID), true);

    assert.equal(
        resolveStagedApiBaseUrl({ headers: { host: "localhost:8787" } }),
        "https://genzai.genzai-f37.workers.dev"
    );
    assert.equal(
        resolveStagedApiBaseUrl({ headers: { host: "genzai.example.com" } }),
        "https://genzai.example.com"
    );
});

test("runStagedVideoOrchestrator menjalankan Klip 1 -> Klip 2 (last frame 1) -> Klip 3 (last frame 2) -> Merge 30s -> History", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "staged30-e2e-ok-"));
    try {
        const storageUploads = [];
        const createClipCalls = [];
        let historyRow = {
            id: HISTORY_ID,
            user_id: USER_ID,
            status: "processing",
            task_id: "staged30_test_ok",
            credit_cost: 7500,
            credit_refunded: false
        };
        let jobRow = {
            id: JOB_ID,
            task_id: "staged30_test_ok",
            history_id: HISTORY_ID,
            user_id: USER_ID,
            status: "processing",
            current_stage: "clip_1_generating",
            internal_token: "a".repeat(64),
            clip_1_task_id: "opus:proj1:job1",
            credit_total: 7500
        };

        const mockFetch = async (urlStr, options = {}) => {
            const u = String(urlStr);

            if (u.includes("/rest/v1/staged_generation_jobs") && options.method === "GET") {
                return new Response(JSON.stringify([jobRow]), { status: 200 });
            }
            if (u.includes("/rest/v1/staged_generation_jobs") && options.method === "PATCH") {
                const body = JSON.parse(options.body);
                if (u.includes("status=eq.processing") && jobRow.status !== "processing") {
                    return new Response(JSON.stringify([]), { status: 200 });
                }
                jobRow = { ...jobRow, ...body };
                return new Response(JSON.stringify([jobRow]), { status: 200 });
            }
            if (u.includes("/rest/v1/generation_history") && options.method === "GET") {
                return new Response(JSON.stringify([historyRow]), { status: 200 });
            }
            if (u.includes("/rest/v1/generation_history") && options.method === "PATCH") {
                const body = JSON.parse(options.body);
                historyRow = { ...historyRow, ...body };
                return new Response(JSON.stringify([historyRow]), { status: 200 });
            }
            if (u.includes("/storage/v1/object/user-uploads/")) {
                storageUploads.push(decodeURIComponent(u.split("/storage/v1/object/user-uploads/")[1]));
                return new Response(JSON.stringify({ Key: u }), { status: 200 });
            }
            if (u.endsWith("/api/generate")) {
                const body = JSON.parse(options.body);
                if (body.step_action === "create_clip") {
                    createClipCalls.push(body);
                    // Simulasikan rotasi akun Opus pada Klip 2 slot 0 -> sukses di slot 1
                    if (body.clip_index === 2 && (!body.exclude_key_slots || body.exclude_key_slots.length === 0)) {
                        return new Response(JSON.stringify({
                            success: false,
                            opus_busy: true,
                            failed_key_slot: 0,
                            key_pool_size: 2,
                            rotated_full_cycle: false
                        }), { status: 200 });
                    }
                    return new Response(JSON.stringify({
                        success: true,
                        task_id: `opus:proj${body.clip_index}:job${body.clip_index}`,
                        key_slot: 1,
                        key_pool_size: 2
                    }), { status: 200 });
                }
                if (body.step_action === "query_clip") {
                    return new Response(JSON.stringify({
                        success: true,
                        completed: true,
                        failed: false,
                        processing: false,
                        output_urls: [`https://cdn.opus.example/clip-${body.clip_index}.mp4`]
                    }), { status: 200 });
                }
            }
            if (u.startsWith("https://cdn.opus.example/")) {
                return new Response(Buffer.alloc(2048, 0x42), { status: 200 });
            }
            throw new Error(`Unexpected fetch URL in test: ${u}`);
        };

        const mockExecFile = async (cmd, args) => {
            if (cmd === "ffprobe") {
                if (args.includes("-count_frames")) {
                    return { stdout: "240\n", stderr: "" };
                }
                return {
                    stdout: JSON.stringify({
                        streams: [
                            { codec_type: "video", width: 720, height: 1280, avg_frame_rate: "24/1", duration: "10.0" },
                            { codec_type: "audio" }
                        ],
                        format: { duration: "10.0" }
                    }),
                    stderr: ""
                };
            }
            if (cmd === "ffmpeg") {
                const outFile = args[args.length - 1];
                await fs.writeFile(outFile, Buffer.alloc(4096, 0x11));
                return { stdout: "", stderr: "" };
            }
            throw new Error(`Unexpected exec: ${cmd}`);
        };

        const outcome = await runStagedVideoOrchestrator({
            env: {
                SUPABASE_URL: "https://proj.supabase.co",
                SUPABASE_SERVICE_KEY: "srv_key",
                JOB_ID,
                API_BASE_URL: "https://genzai.genzai-f37.workers.dev"
            },
            fetchImpl: mockFetch,
            execFileImpl: mockExecFile,
            sleepImpl: async () => {},
            workDir: tempDir,
            pollIntervalMs: 1,
            busyWaitMs: 1
        });

        assert.equal(outcome.finalized, true);
        assert.equal(outcome.outcome, "completed");
        assert.equal(outcome.completedClips, 3);
        assert.equal(outcome.finalDuration, 30);
        assert.equal(outcome.charged, 7500);
        assert.equal(outcome.refunded, 0);

        // Pastikan ketiga klip + kedua frame akhir + hasil gabungan 30s tersimpan di server
        assert.ok(storageUploads.some(p => p.endsWith("/clip-1.mp4")));
        assert.ok(storageUploads.some(p => p.endsWith("/frame-1-end.png")));
        assert.ok(storageUploads.some(p => p.endsWith("/clip-2.mp4")));
        assert.ok(storageUploads.some(p => p.endsWith("/frame-2-end.png")));
        assert.ok(storageUploads.some(p => p.endsWith("/clip-3.mp4")));
        assert.ok(storageUploads.some(p => p.includes(`/staged30-${HISTORY_ID}-`) && p.endsWith(".mp4")));

        // Pastikan Klip 2 memakai last-frame Klip 1, dan Klip 3 memakai last-frame Klip 2
        const clip2SuccessCreate = createClipCalls.filter(c => c.clip_index === 2).pop();
        const clip3SuccessCreate = createClipCalls.find(c => c.clip_index === 3);
        assert.ok(clip2SuccessCreate.first_frame_ref.endsWith("/frame-1-end.png"));
        assert.deepEqual(clip2SuccessCreate.exclude_key_slots, [0], "rotasi akun Opus berjalan otomatis");
        assert.ok(clip3SuccessCreate.first_frame_ref.endsWith("/frame-2-end.png"));

        // Pastikan History terupdate menjadi success 30 detik
        assert.equal(historyRow.status, "success");
        assert.equal(historyRow.duration, 30);
        assert.ok(historyRow.result_url.startsWith("supabase-private://user-uploads/upscale-videos/outputs/"));
        assert.equal(jobRow.internal_token, null, "internal_token dihapus setelah selesai");
    } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
    }
});

test("runStagedVideoOrchestrator menyimpan gabungan 20 detik ke History & refund 1/3 kredit jika Klip 3 gagal permanen", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "staged30-e2e-partial-"));
    try {
        let refundedAmount = 0;
        let historyRow = {
            id: HISTORY_ID,
            user_id: USER_ID,
            status: "processing",
            task_id: "staged30_test_partial",
            credit_cost: 7500,
            credit_refunded: false
        };
        let jobRow = {
            id: JOB_ID,
            task_id: "staged30_test_partial",
            history_id: HISTORY_ID,
            user_id: USER_ID,
            status: "processing",
            current_stage: "clip_1_generating",
            internal_token: "b".repeat(64),
            clip_1_task_id: "opus:proj1:job1",
            credit_total: 7500
        };

        const mockFetch = async (urlStr, options = {}) => {
            const u = String(urlStr);
            if (u.includes("/rest/v1/staged_generation_jobs") && options.method === "GET") {
                return new Response(JSON.stringify([jobRow]), { status: 200 });
            }
            if (u.includes("/rest/v1/staged_generation_jobs") && options.method === "PATCH") {
                const body = JSON.parse(options.body);
                jobRow = { ...jobRow, ...body };
                return new Response(JSON.stringify([jobRow]), { status: 200 });
            }
            if (u.includes("/rest/v1/generation_history") && options.method === "GET") {
                return new Response(JSON.stringify([historyRow]), { status: 200 });
            }
            if (u.includes("/rest/v1/generation_history") && options.method === "PATCH") {
                const body = JSON.parse(options.body);
                historyRow = { ...historyRow, ...body };
                return new Response(JSON.stringify([historyRow]), { status: 200 });
            }
            if (u.includes("/rest/v1/rpc/refund_generate_credits")) {
                const body = JSON.parse(options.body);
                refundedAmount += Number(body.p_amount) || 0;
                return new Response(JSON.stringify(true), { status: 200 });
            }
            if (u.includes("/storage/v1/object/user-uploads/")) {
                return new Response(JSON.stringify({ Key: u }), { status: 200 });
            }
            if (u.endsWith("/api/generate")) {
                const body = JSON.parse(options.body);
                if (body.step_action === "create_clip") {
                    if (body.clip_index === 3) {
                        return new Response(JSON.stringify({
                            success: false,
                            opus_busy: false,
                            error: "Provider upstream error pada Klip 3"
                        }), { status: 200 });
                    }
                    return new Response(JSON.stringify({
                        success: true,
                        task_id: `opus:proj${body.clip_index}:job${body.clip_index}`
                    }), { status: 200 });
                }
                if (body.step_action === "query_clip") {
                    return new Response(JSON.stringify({
                        success: true,
                        completed: true,
                        failed: false,
                        output_urls: [`https://cdn.opus.example/clip-${body.clip_index}.mp4`]
                    }), { status: 200 });
                }
            }
            if (u.startsWith("https://cdn.opus.example/")) {
                return new Response(Buffer.alloc(2048, 0x42), { status: 200 });
            }
            throw new Error(`Unexpected fetch URL: ${u}`);
        };

        const mockExecFile = async (cmd, args) => {
            if (cmd === "ffprobe") {
                if (args.includes("-count_frames")) return { stdout: "240\n", stderr: "" };
                return {
                    stdout: JSON.stringify({
                        streams: [{ codec_type: "video", width: 720, height: 1280, avg_frame_rate: "24/1", duration: "10.0" }]
                    }),
                    stderr: ""
                };
            }
            const outFile = args[args.length - 1];
            await fs.writeFile(outFile, Buffer.alloc(4096, 0x22));
            return { stdout: "", stderr: "" };
        };

        const outcome = await runStagedVideoOrchestrator({
            env: {
                SUPABASE_URL: "https://proj.supabase.co",
                SUPABASE_SERVICE_KEY: "srv_key",
                JOB_ID
            },
            fetchImpl: mockFetch,
            execFileImpl: mockExecFile,
            sleepImpl: async () => {},
            workDir: tempDir,
            pollIntervalMs: 1,
            busyWaitMs: 1
        });

        assert.equal(outcome.outcome, "partial_completed");
        assert.equal(outcome.completedClips, 2);
        assert.equal(outcome.finalDuration, 20);
        assert.equal(outcome.charged, 5000);
        assert.equal(outcome.refunded, 2500);
        assert.equal(refundedAmount, 2500);
        assert.equal(historyRow.status, "success");
        assert.equal(historyRow.duration, 20);
        assert.equal(historyRow.credit_cost, 5000);
        assert.ok(historyRow.result_url.startsWith("supabase-private://user-uploads/upscale-videos/outputs/"));
    } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
    }
});

test("preserveMediaRefs mempertahankan @image1/@video1/@audio1 pada Klip 2 & 3 serta memotong/loop segmen 10-20s & 20-30s", () => {
    const autoR2v = buildStaged30sPrompts(
        "Karakter @image1 menirukan gerakan dari karakter @video1, gerakan realistis",
        { preserveMediaRefs: true }
    );
    assert.equal(autoR2v.preserveMediaRefs, true);
    assert.match(autoR2v.clip1, /@image1/);
    assert.match(autoR2v.clip1, /@video1/);
    assert.match(autoR2v.clip2, /Durasi 11-20 detik/);
    assert.match(autoR2v.clip2, /@image1/);
    assert.match(autoR2v.clip2, /@video1/);
    assert.match(autoR2v.clip3, /Durasi 21-30 detik/);
    assert.match(autoR2v.clip3, /@image1/);
    assert.match(autoR2v.clip3, /@video1/);

    const explicitR2v = buildStaged30sPrompts(
        [
            "0-10 detik: @image1 menari pembuka mengikuti @video1 dengan lagu @audio1.",
            "11-20 detik: @image1 berputar mengikuti koreografi @video1 dan irama @audio1.",
            "21-30 detik: @image1 melakukan pose penutup mengikuti @video1 dan akhir lagu @audio1."
        ].join("\n"),
        { preserveMediaRefs: true }
    );
    assert.equal(explicitR2v.mode, "explicit_duration");
    assert.match(explicitR2v.clip2, /@image1/);
    assert.match(explicitR2v.clip2, /@video1/);
    assert.match(explicitR2v.clip2, /@audio1/);
    assert.match(explicitR2v.clip3, /@image1/);
    assert.match(explicitR2v.clip3, /@video1/);
    assert.match(explicitR2v.clip3, /@audio1/);

    // Referensi penuh >= 30s -> potong langsung 10-20s & 20-30s tanpa loop
    const timingFull2 = computeLoopedSegmentTiming({ clipIndex: 2, sourceDurationSeconds: 30.5 });
    const timingFull3 = computeLoopedSegmentTiming({ clipIndex: 3, sourceDurationSeconds: 30.5 });
    assert.equal(timingFull2.needsLoop, false);
    assert.equal(timingFull2.effectiveStartSeconds, 10);
    assert.equal(timingFull3.needsLoop, false);
    assert.equal(timingFull3.effectiveStartSeconds, 20);

    const sliceFull2Args = buildReferenceVideoSliceFfmpegArgs({
        inputPath: "/tmp/ref30.mp4",
        outputPath: "/tmp/ref-c2.mp4",
        clipIndex: 2,
        sourceDurationSeconds: 30.5
    });
    assert.equal(sliceFull2Args.includes("-stream_loop"), false);
    assert.equal(sliceFull2Args[sliceFull2Args.indexOf("-ss") + 1], "10");

    // Referensi pendek 15s -> loop otomatis berkesinambungan (Klip 2 mulai detik 10, Klip 3 mulai 20 % 15 = detik 5)
    const timingShort2 = computeLoopedSegmentTiming({ clipIndex: 2, sourceDurationSeconds: 15 });
    const timingShort3 = computeLoopedSegmentTiming({ clipIndex: 3, sourceDurationSeconds: 15 });
    assert.equal(timingShort2.needsLoop, true);
    assert.equal(timingShort2.effectiveStartSeconds, 10);
    assert.equal(timingShort3.needsLoop, true);
    assert.equal(timingShort3.effectiveStartSeconds, 5);

    const sliceLoop3Args = buildReferenceVideoSliceFfmpegArgs({
        inputPath: "/tmp/ref15.mp4",
        outputPath: "/tmp/ref-c3.mp4",
        clipIndex: 3,
        sourceDurationSeconds: 15
    });
    assert.equal(sliceLoop3Args.includes("-stream_loop"), true);
    assert.equal(sliceLoop3Args[sliceLoop3Args.indexOf("-ss") + 1], "5");

    const audioLoop3Args = buildReferenceAudioSliceFfmpegArgs({
        inputPath: "/tmp/ref12.wav",
        outputPath: "/tmp/ref-a3.mp3",
        clipIndex: 3,
        sourceDurationSeconds: 12
    });
    assert.equal(audioLoop3Args.includes("-stream_loop"), true);
    assert.equal(audioLoop3Args[audioLoop3Args.indexOf("-ss") + 1], "8");
    assert.equal(audioLoop3Args[audioLoop3Args.indexOf("-c:a") + 1], "libmp3lame");
    assert.equal(audioLoop3Args[audioLoop3Args.indexOf("-f") + 1], "mp3");
    assert.equal(audioLoop3Args.includes("aac"), false, "tidak boleh memakai kontainer AAC/M4A yang ditolak Opus sebagai mov");
    assert.equal(audioLoop3Args.includes("-movflags"), false);

    const audioWavFallbackArgs = buildReferenceAudioSliceFfmpegArgs({
        inputPath: "/tmp/ref12.wav",
        outputPath: "/tmp/ref-a2.wav",
        clipIndex: 2,
        sourceDurationSeconds: 30,
        format: "wav"
    });
    assert.equal(audioWavFallbackArgs[audioWavFallbackArgs.indexOf("-c:a") + 1], "pcm_s16le");
    assert.equal(audioWavFallbackArgs[audioWavFallbackArgs.indexOf("-f") + 1], "wav");

    // Merge dengan audio referensi asli utuh (loop otomatis bila < 30s)
    const mergeDirectLoopArgs = buildSeamlessMergeFfmpegArgs({
        clipPaths: ["/tmp/c1.mp4", "/tmp/c2.mp4", "/tmp/c3.mp4"],
        clipInfos: [
            { width: 720, height: 1280, fps: 24, duration: 10, hasAudio: true },
            { width: 720, height: 1280, fps: 24, duration: 10, hasAudio: false },
            { width: 720, height: 1280, fps: 24, duration: 10, hasAudio: false }
        ],
        outputPath: "/tmp/merged-ref-audio.mp4",
        referenceAudioPath: "/tmp/ref15.mp4",
        referenceAudioDuration: 15,
        referenceAudioHasAudio: true
    });
    assert.equal(mergeDirectLoopArgs.includes("-stream_loop"), true);
    assert.equal(mergeDirectLoopArgs.includes("-shortest"), true);
    const directFilter = mergeDirectLoopArgs[mergeDirectLoopArgs.indexOf("-filter_complex") + 1];
    assert.match(directFilter, /\[3:a:0\]aformat=.*atrim=0:29\.917,asetpts=PTS-STARTPTS\[aout\]/);
    assert.doesNotMatch(directFilter, /acrossfade/);
});

test("runStagedVideoOrchestrator memotong & me-loop @video1 ke Klip 2 (10-20s) & Klip 3 (20-30s) serta menempelkan audio asli utuh saat merge", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "staged30-e2e-refvideo-"));
    try {
        const storageUploads = [];
        const createClipCalls = [];
        const ffmpegCalls = [];
        const refVideoPrivateRef = `supabase-private://user-uploads/generate-input/${USER_ID}/video-dance-15s.mp4`;
        const refImagePrivateRef = `supabase-private://user-uploads/generate-input/${USER_ID}/char.jpg`;

        let historyRow = {
            id: HISTORY_ID,
            user_id: USER_ID,
            status: "processing",
            task_id: "staged30_test_ref_video",
            credit_cost: 7500,
            credit_refunded: false
        };
        let jobRow = {
            id: JOB_ID,
            task_id: "staged30_test_ref_video",
            history_id: HISTORY_ID,
            user_id: USER_ID,
            status: "processing",
            current_stage: "clip_1_generating",
            internal_token: "c".repeat(64),
            clip_1_task_id: "opus:proj1:job1",
            credit_total: 7500,
            request_payload: {
                prompt: "Karakter @image1 menirukan gerakan dari karakter @video1, gerakan realistis",
                aspect_ratio: "9:16",
                resolution: "720p",
                generate_audio: true,
                image_urls: [refImagePrivateRef],
                video_urls: [refVideoPrivateRef],
                audio_urls: []
            }
        };

        let clip3CopyrightTriggered = false;

        const mockFetch = async (urlStr, options = {}) => {
            const u = String(urlStr);

            if (u.includes("/rest/v1/staged_generation_jobs") && options.method === "GET") {
                return new Response(JSON.stringify([jobRow]), { status: 200 });
            }
            if (u.includes("/rest/v1/staged_generation_jobs") && options.method === "PATCH") {
                const body = JSON.parse(options.body);
                jobRow = { ...jobRow, ...body };
                return new Response(JSON.stringify([jobRow]), { status: 200 });
            }
            if (u.includes("/rest/v1/generation_history") && options.method === "GET") {
                return new Response(JSON.stringify([historyRow]), { status: 200 });
            }
            if (u.includes("/rest/v1/generation_history") && options.method === "PATCH") {
                const body = JSON.parse(options.body);
                historyRow = { ...historyRow, ...body };
                return new Response(JSON.stringify([historyRow]), { status: 200 });
            }
            if (u.includes("/storage/v1/object/user-uploads/") && options.method === "GET") {
                return new Response(Buffer.alloc(4096, 0x55), { status: 200 });
            }
            if (u.includes("/storage/v1/object/user-uploads/") && options.method === "POST") {
                storageUploads.push(decodeURIComponent(u.split("/storage/v1/object/user-uploads/")[1]));
                return new Response(JSON.stringify({ Key: u }), { status: 200 });
            }
            if (u.endsWith("/api/generate")) {
                const body = JSON.parse(options.body);
                if (body.step_action === "create_clip") {
                    createClipCalls.push(body);
                    // Simulasikan Klip 3 gagal copyright pada percobaan pertama -> otomatis retry muted & tetap dapat audio referensi di merge akhir
                    if (body.clip_index === 3 && !clip3CopyrightTriggered) {
                        clip3CopyrightTriggered = true;
                        return new Response(JSON.stringify({
                            success: false,
                            error: "audio pada video/lagu yang anda upload terkena copyright, silahkan gunakan video/lagu yang lain, atau generate tanpa audio"
                        }), { status: 200 });
                    }
                    return new Response(JSON.stringify({
                        success: true,
                        task_id: `opus:proj${body.clip_index}:job${body.clip_index}`
                    }), { status: 200 });
                }
                if (body.step_action === "query_clip") {
                    return new Response(JSON.stringify({
                        success: true,
                        completed: true,
                        failed: false,
                        processing: false,
                        output_urls: [`https://cdn.opus.example/clip-${body.clip_index}.mp4`]
                    }), { status: 200 });
                }
            }
            if (u.startsWith("https://cdn.opus.example/")) {
                return new Response(Buffer.alloc(2048, 0x42), { status: 200 });
            }
            throw new Error(`Unexpected fetch URL in refvideo test: ${u}`);
        };

        const mockExecFile = async (cmd, args) => {
            if (cmd === "ffprobe") {
                if (args.includes("-count_frames")) {
                    return { stdout: "240\n", stderr: "" };
                }
                const targetFile = String(args[args.length - 1] || "");
                const isRefSource = targetFile.includes("source-ref-video-1");
                return {
                    stdout: JSON.stringify({
                        streams: [
                            {
                                codec_type: "video",
                                width: 720,
                                height: 1280,
                                avg_frame_rate: "24/1",
                                duration: isRefSource ? "15.0" : "10.0"
                            },
                            {
                                codec_type: "audio",
                                duration: isRefSource ? "15.0" : "10.0"
                            }
                        ],
                        format: { duration: isRefSource ? "15.0" : "10.0" }
                    }),
                    stderr: ""
                };
            }
            if (cmd === "ffmpeg") {
                ffmpegCalls.push(args);
                const outFile = args[args.length - 1];
                await fs.writeFile(outFile, Buffer.alloc(4096, 0x33));
                return { stdout: "", stderr: "" };
            }
            throw new Error(`Unexpected exec: ${cmd}`);
        };

        const outcome = await runStagedVideoOrchestrator({
            env: {
                SUPABASE_URL: "https://proj.supabase.co",
                SUPABASE_SERVICE_KEY: "srv_key",
                JOB_ID
            },
            fetchImpl: mockFetch,
            execFileImpl: mockExecFile,
            sleepImpl: async () => {},
            workDir: tempDir,
            pollIntervalMs: 1,
            busyWaitMs: 1
        });

        assert.equal(outcome.outcome, "completed");
        assert.equal(outcome.completedClips, 3);
        assert.equal(outcome.finalDuration, 30);

        // Pastikan segmen referensi Klip 2 (10-20s) & Klip 3 (20-30s + fallback muted) diunggah ke namespace user
        assert.ok(storageUploads.some(p => p.endsWith("/ref-video-1-clip-2.mp4")));
        assert.ok(storageUploads.some(p => p.endsWith("/ref-video-1-clip-3.mp4")));
        assert.ok(storageUploads.some(p => p.endsWith("/ref-video-1-clip-3-muted.mp4")));

        const clip2Call = createClipCalls.find(c => c.clip_index === 2);
        assert.ok(clip2Call.first_frame_ref.endsWith("/frame-1-end.png"));
        assert.equal(clip2Call.video_segment_refs.length, 1);
        assert.ok(clip2Call.video_segment_refs[0].endsWith("/ref-video-1-clip-2.mp4"));
        assert.equal(isRefOwnedByUser(clip2Call.video_segment_refs[0], USER_ID), true);

        const clip3Calls = createClipCalls.filter(c => c.clip_index === 3);
        assert.equal(clip3Calls.length, 2, "Klip 3 mencoba dengan audio dulu lalu fallback muted saat copyright");
        assert.ok(clip3Calls[0].video_segment_refs[0].endsWith("/ref-video-1-clip-3.mp4"));
        assert.ok(clip3Calls[1].video_segment_refs[0].endsWith("/ref-video-1-clip-3-muted.mp4"));
        assert.equal(clip3Calls[1].generate_audio_override, false);

        // Pastikan perintah merge akhir memakai audio referensi asli utuh dengan loop (-stream_loop -1)
        const finalMergeCall = ffmpegCalls[ffmpegCalls.length - 1];
        assert.equal(finalMergeCall.includes("-stream_loop"), true);
        assert.equal(finalMergeCall.includes("-shortest"), true);
        assert.ok(
            finalMergeCall.some(arg => String(arg).includes("source-ref-video-1.mp4")),
            "Merge akhir harus mengambil audio asli langsung dari video referensi"
        );
    } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
    }
});

test("adapter opus-seedance-2.5-r2v menerima payload lanjutan Klip 2/3 (frame akhir @image1 + segmen @video1/@audio1) & api/generate.js menjaga kepemilikan RLS", async () => {
    const r2vAdapter = getOpusVideoModel("opus-seedance-2.5-r2v");
    assert.ok(r2vAdapter, "adapter opus-seedance-2.5-r2v wajib tersedia");

    const stagedPrompts = buildStaged30sPrompts(
        "Karakter @image1 menirukan gerakan dari karakter @video1, gerakan realistis",
        { preserveMediaRefs: true }
    );

    const continuationInput = {
        prompt: stagedPrompts.clip2,
        aspect_ratio: "9:16",
        resolution: "720p",
        duration: "10",
        generate_audio: true,
        image_urls: ["https://proj.supabase.co/storage/v1/object/sign/user-uploads/frame-1-end.png?token=sig1"],
        video_urls: ["https://proj.supabase.co/storage/v1/object/sign/user-uploads/ref-video-1-clip-2.mp4?token=sig2"],
        audio_urls: []
    };

    const validation = r2vAdapter.validate(continuationInput);
    assert.equal(validation.valid, true, validation.errors.join("; "));

    const builtPayload = r2vAdapter.buildPayload(continuationInput);
    assert.equal(builtPayload.workflow, "reference2video");
    assert.equal(builtPayload.duration, 10);
    assert.equal(builtPayload.first_frame_url, undefined, "tidak boleh mencampur first_frame_url dengan reference2video");
    assert.equal(builtPayload.reference_image_urls.length, 1);
    assert.equal(builtPayload.reference_video_urls.length, 1);

    const generateSrc = await fs.readFile(new URL("../api/generate.js", import.meta.url), "utf8");
    assert.match(generateSrc, /const useR2vForContinuation =/);
    assert.match(generateSrc, /video_segment_refs/);
    assert.match(generateSrc, /audio_segment_refs/);
    assert.match(generateSrc, /preserveMediaRefs:\s*hasStagedReferenceMedia/);
});

test("runStagedVideoOrchestrator memotong @audio1 (.wav/.mp3) pada Klip 2 (10-20s) & Klip 3 (20-30s) menjadi MP3 (audio/mpeg), bukan M4A/MOV", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "staged30-e2e-refaudio-mp3-"));
    try {
        const storageUploads = [];
        const createClipCalls = [];
        const ffmpegCalls = [];
        const refAudioPrivateRef = `supabase-private://user-uploads/generate-input/${USER_ID}/audio-song-30s.wav`;
        const refImagePrivateRef = `supabase-private://user-uploads/generate-input/${USER_ID}/char.jpg`;

        let historyRow = {
            id: HISTORY_ID,
            user_id: USER_ID,
            status: "processing",
            task_id: "staged30_test_ref_audio_mp3",
            credit_cost: 7500,
            credit_refunded: false
        };
        let jobRow = {
            id: JOB_ID,
            task_id: "staged30_test_ref_audio_mp3",
            history_id: HISTORY_ID,
            user_id: USER_ID,
            status: "processing",
            current_stage: "clip_1_generating",
            internal_token: "d".repeat(64),
            clip_1_task_id: "opus:proj1:job1",
            credit_total: 7500,
            request_payload: {
                prompt: "Karakter @image1 melakukan Lipsync dengan lagu @audio1, bergoyang lincah, gerakan realistis",
                aspect_ratio: "9:16",
                resolution: "720p",
                generate_audio: true,
                image_urls: [refImagePrivateRef],
                video_urls: [],
                audio_urls: [refAudioPrivateRef],
                clip_prompts: buildStaged30sPrompts(
                    "Karakter @image1 melakukan Lipsync dengan lagu @audio1, bergoyang lincah, gerakan realistis",
                    { preserveMediaRefs: true }
                )
            }
        };

        const mockFetch = async (url, options = {}) => {
            const u = String(url);
            const method = String(options.method || "GET").toUpperCase();

            if (u.includes("/rest/v1/staged_generation_jobs") && method === "GET") {
                return new Response(JSON.stringify([jobRow]), { status: 200 });
            }
            if (u.includes("/rest/v1/staged_generation_jobs") && method === "PATCH") {
                const patch = JSON.parse(options.body);
                jobRow = { ...jobRow, ...patch };
                return new Response(JSON.stringify([jobRow]), { status: 200 });
            }
            if (u.includes("/rest/v1/generation_history") && method === "GET") {
                return new Response(JSON.stringify([historyRow]), { status: 200 });
            }
            if (u.includes("/rest/v1/generation_history") && method === "PATCH") {
                const patch = JSON.parse(options.body);
                historyRow = { ...historyRow, ...patch };
                return new Response(JSON.stringify([historyRow]), { status: 200 });
            }
            if (u.includes("/storage/v1/object/user-uploads/") && method === "GET") {
                return new Response(Buffer.alloc(4096, 0x22), { status: 200 });
            }
            if (u.includes("/storage/v1/object/user-uploads/") && method === "POST") {
                const contentType = options.headers?.["Content-Type"] || options.headers?.["content-type"] || "";
                storageUploads.push({
                    path: decodeURIComponent(u.split("/storage/v1/object/user-uploads/")[1]),
                    contentType
                });
                return new Response(JSON.stringify({ Key: "ok" }), { status: 200 });
            }
            if (u.endsWith("/api/generate") && method === "POST") {
                const body = JSON.parse(options.body);
                if (body.step_action === "create_clip") {
                    createClipCalls.push(body);
                    // Simulasikan penolakan nyata Opus bila masih dikirim .m4a
                    if ((body.audio_segment_refs || []).some(ref => ref.endsWith(".m4a"))) {
                        return new Response(
                            JSON.stringify({
                                success: false,
                                error: "Egress Gateway 502: CreateAsset failed (400 InvalidParameter.FormatUnsupported): Unsupported audio format: mov. Allowed formats: mp3, wav."
                            }),
                            { status: 200 }
                        );
                    }
                    return new Response(
                        JSON.stringify({
                            success: true,
                            task_id: `opus:proj${body.clip_index}:job${body.clip_index}`
                        }),
                        { status: 200 }
                    );
                }
                if (body.step_action === "query_clip") {
                    return new Response(
                        JSON.stringify({
                            success: true,
                            completed: true,
                            output_urls: [`https://cdn.opus.pro/clip-${body.clip_index}.mp4`]
                        }),
                        { status: 200 }
                    );
                }
            }
            if (u.startsWith("https://cdn.opus.pro/clip-")) {
                return new Response(Buffer.alloc(4096, 0x55), { status: 200 });
            }
            throw new Error(`Unexpected fetch URL: ${u} (${method})`);
        };

        const mockExecFile = async (cmd, args) => {
            if (cmd === "ffprobe") {
                if (args.includes("-count_frames")) {
                    return { stdout: "240\n", stderr: "" };
                }
                const targetFile = String(args[args.length - 1] || "");
                const isRefAudio = targetFile.includes("source-ref-audio-");
                return {
                    stdout: JSON.stringify({
                        streams: isRefAudio
                            ? [{ codec_type: "audio", duration: "30.0" }]
                            : [
                                  {
                                      codec_type: "video",
                                      width: 720,
                                      height: 1280,
                                      avg_frame_rate: "24/1",
                                      duration: "10.0"
                                  },
                                  { codec_type: "audio", duration: "10.0" }
                              ],
                        format: { duration: isRefAudio ? "30.0" : "10.0" }
                    }),
                    stderr: ""
                };
            }
            if (cmd === "ffmpeg") {
                ffmpegCalls.push(args);
                const outFile = args[args.length - 1];
                await fs.writeFile(outFile, Buffer.alloc(4096, 0x44));
                return { stdout: "", stderr: "" };
            }
            throw new Error(`Unexpected exec: ${cmd}`);
        };

        const outcome = await runStagedVideoOrchestrator({
            env: {
                SUPABASE_URL: "https://proj.supabase.co",
                SUPABASE_SERVICE_KEY: "srv_key",
                JOB_ID
            },
            fetchImpl: mockFetch,
            execFileImpl: mockExecFile,
            sleepImpl: async () => {},
            workDir: tempDir,
            pollIntervalMs: 1,
            busyWaitMs: 1
        });

        assert.equal(outcome.outcome, "completed");
        assert.equal(outcome.completedClips, 3);
        assert.equal(outcome.finalDuration, 30);

        const audioUploads = storageUploads.filter(item => item.path.includes("/ref-audio-"));
        assert.equal(audioUploads.length, 2, "harus mengunggah potongan MP3 untuk Klip 2 dan Klip 3");
        assert.ok(audioUploads.every(item => item.path.endsWith(".mp3")));
        assert.ok(audioUploads.every(item => item.contentType === "audio/mpeg"));
        assert.equal(
            storageUploads.some(item => item.path.endsWith(".m4a")),
            false,
            "tidak boleh ada potongan audio .m4a yang memicu error format mov di Opus"
        );

        const clip2Call = createClipCalls.find(c => c.clip_index === 2);
        const clip3Call = createClipCalls.find(c => c.clip_index === 3);
        assert.ok(clip2Call.audio_segment_refs[0].endsWith("/ref-audio-1-clip-2.mp3"));
        assert.ok(clip3Call.audio_segment_refs[0].endsWith("/ref-audio-1-clip-3.mp3"));
        assert.equal(isRefOwnedByUser(clip2Call.audio_segment_refs[0], USER_ID), true);
        assert.equal(isRefOwnedByUser(clip3Call.audio_segment_refs[0], USER_ID), true);

        const formMediaJs = await fs.readFile(
            new URL("../generate/assets/js/generate-form-media.js", import.meta.url),
            "utf8"
        );
        assert.doesNotMatch(formMediaJs, /fb_audio_out_\$\{uniqueId\}\.m4a/);
        assert.match(formMediaJs, /ensureCompatibleAudioUploadFile/);
    } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
    }
});

test("opsi durasi 20 detik pada opus-seedance-2.5-r2v-30s: validasi, kredit proporsional 2/3, prompt 2 klip, dan orkestrasi 20 detik penuh", async () => {
    const model = getOpusVideoModel(STAGED_30S_MODEL_ID);
    const durationParam = model.parameters.find(p => p.name === "duration");
    assert.deepEqual(durationParam.enum, ["20", "30"]);
    assert.equal(durationParam.default, "30", "default tetap 30 detik");

    const valid20 = model.validate({
        prompt: "@image1 berjalan santai di taman sore hari mengikuti @video1",
        image_urls: ["https://cdn.example.com/ref.jpg"],
        video_urls: ["https://cdn.example.com/motion.mp4"],
        aspect_ratio: "9:16",
        resolution: "720p",
        duration: "20",
        generate_audio: true
    });
    assert.equal(valid20.valid, true, valid20.errors.join("; "));

    // Kredit 20 detik = proporsional 2/3 dari tarif 30 detik (480p: 6000 -> 4000, 720p: 7500 -> 5000)
    const billed20s720 = resolveBillableCredit(
        7500,
        { duration: "20" },
        model.config,
        STAGED_30S_MODEL_ID
    );
    const billed20s480 = resolveBillableCredit(
        6000,
        { duration: "20" },
        model.config,
        STAGED_30S_MODEL_ID
    );
    assert.equal(billed20s720.billableCredit, 5000, "20s 720p harus tepat 5000 kredit (2/3 dari 7500)");
    assert.equal(billed20s480.billableCredit, 4000, "20s 480p harus tepat 4000 kredit (2/3 dari 6000)");

    assert.deepEqual(resolveStagedTargetConfig("20"), {
        targetDuration: 20,
        totalClips: 2,
        clipDuration: 10
    });
    assert.deepEqual(resolveStagedTargetConfig("30"), {
        targetDuration: 30,
        totalClips: 3,
        clipDuration: 10
    });

    // Prompt 20 detik otomatis & eksplisit hanya menghasilkan 2 segmen (clip3 kosong)
    const autoPrompts20 = buildStaged30sPrompts(
        "@image1 membuka pintu kafe, lalu duduk sambil tersenyum menyeruput kopi hangat.",
        { targetDuration: 20, preserveMediaRefs: true }
    );
    assert.equal(autoPrompts20.targetDuration, 20);
    assert.equal(autoPrompts20.totalClips, 2);
    assert.match(autoPrompts20.clip1, /Durasi 0-10 detik/);
    assert.match(autoPrompts20.clip2, /Durasi 11-20 detik/);
    assert.equal(autoPrompts20.clip3, "");
    assert.equal(autoPrompts20.segmentsSummary.clip3Range, null);

    const explicitPrompts20 = buildStaged30sPrompts(
        "0-10 detik: @image1 berjalan di tepi pantai.\n11-20 detik: @image1 melambaikan tangan ke arah kamera.",
        { targetDuration: 20 }
    );
    assert.equal(explicitPrompts20.mode, "explicit_duration");
    assert.equal(explicitPrompts20.totalClips, 2);
    assert.match(explicitPrompts20.clip1, /berjalan di tepi pantai/);
    assert.match(explicitPrompts20.clip2, /melambaikan tangan/);
    assert.equal(explicitPrompts20.clip3, "");

    // Settlement 20s: 2/2 selesai penuh, 1/2 refund 50%, 0/2 refund 100%
    const full20 = computeStagedCreditSettlement(5000, 2, 2);
    assert.equal(full20.outcome, "completed");
    assert.equal(full20.finalDuration, 20);
    assert.equal(full20.charged, 5000);
    assert.equal(full20.refund, 0);

    const partial20 = computeStagedCreditSettlement(5000, 1, 2);
    assert.equal(partial20.outcome, "partial_completed");
    assert.equal(partial20.finalDuration, 10);
    assert.equal(partial20.charged, 2500);
    assert.equal(partial20.refund, 2500);

    // Orkestrasi penuh 20 detik: hanya mengeksekusi Klip 1 & Klip 2 (tanpa Klip 3), lalu merge 20 detik
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "staged-20s-test-"));
    try {
        const jobState = {
            id: JOB_ID,
            task_id: "staged30_1793400000999_20sec",
            history_id: HISTORY_ID,
            user_id: USER_ID,
            model_id: STAGED_30S_MODEL_ID,
            status: "processing",
            current_stage: "clip_1_generating",
            internal_token: "tok_secret_20s",
            clip_1_task_id: "opus_clip1_20s",
            clip_2_task_id: null,
            clip_3_task_id: null,
            completed_clips: 0,
            credit_total: 5000,
            request_payload: {
                prompt: autoPrompts20.originalPrompt,
                target_duration: 20,
                total_clips: 2,
                clip_prompts: {
                    mode: autoPrompts20.mode,
                    clip1: autoPrompts20.clip1,
                    clip2: autoPrompts20.clip2,
                    clip3: autoPrompts20.clip3
                },
                aspect_ratio: "9:16",
                resolution: "720p",
                generate_audio: true,
                image_urls: [`storage://user-uploads/upscale-photos/inputs/${USER_ID}/ref.png`],
                video_urls: [],
                audio_urls: []
            }
        };

        const createClipCalls = [];
        const storageUploads = [];
        let historyPatchBody = null;

        const mockFetch = async (url, init = {}) => {
            const u = String(url);
            const method = String(init.method || "GET").toUpperCase();

            if (u.includes("/rest/v1/staged_generation_jobs") && method === "GET") {
                return new Response(JSON.stringify([jobState]), { status: 200 });
            }
            if (u.includes("/rest/v1/staged_generation_jobs") && method === "PATCH") {
                Object.assign(jobState, JSON.parse(init.body));
                return new Response(JSON.stringify([jobState]), { status: 200 });
            }
            if (u.includes("/rest/v1/generation_history") && method === "GET") {
                return new Response(JSON.stringify([{ status: "processing" }]), { status: 200 });
            }
            if (u.includes("/rest/v1/generation_history") && method === "PATCH") {
                historyPatchBody = JSON.parse(init.body);
                return new Response(JSON.stringify([{ id: HISTORY_ID, ...historyPatchBody }]), {
                    status: 200
                });
            }
            if (u.includes("/storage/v1/object/user-uploads/") && method === "POST") {
                storageUploads.push(u);
                return new Response(JSON.stringify({ Key: u }), { status: 200 });
            }
            if (u.endsWith("/api/generate") && method === "POST") {
                const payload = JSON.parse(init.body);
                if (payload.step_action === "create_clip") {
                    createClipCalls.push(payload);
                    return new Response(
                        JSON.stringify({
                            success: true,
                            task_id: `opus_clip${payload.clip_index}_20s`
                        }),
                        { status: 200 }
                    );
                }
                if (payload.step_action === "query_clip") {
                    return new Response(
                        JSON.stringify({
                            success: true,
                            completed: true,
                            output_urls: [`https://cdn.opus.example/clip-${payload.clip_index}.mp4`]
                        }),
                        { status: 200 }
                    );
                }
            }
            if (u.startsWith("https://cdn.opus.example/clip-")) {
                return new Response(Buffer.alloc(2048, 0x33), { status: 200 });
            }
            throw new Error(`Unexpected fetch in 20s test: ${method} ${u}`);
        };

        const mockExecFile = async (cmd, args) => {
            if (cmd === "ffprobe") {
                if (args.includes("-count_frames")) {
                    return { stdout: "240\n", stderr: "" };
                }
                return {
                    stdout: JSON.stringify({
                        streams: [
                            {
                                codec_type: "video",
                                width: 720,
                                height: 1280,
                                avg_frame_rate: "24/1",
                                duration: "10.0"
                            },
                            { codec_type: "audio", duration: "10.0" }
                        ],
                        format: { duration: "10.0" }
                    }),
                    stderr: ""
                };
            }
            if (cmd === "ffmpeg") {
                const outFile = args[args.length - 1];
                await fs.writeFile(outFile, Buffer.alloc(4096, 0x55));
                return { stdout: "", stderr: "" };
            }
            throw new Error(`Unexpected exec: ${cmd}`);
        };

        const outcome = await runStagedVideoOrchestrator({
            env: {
                SUPABASE_URL: "https://proj.supabase.co",
                SUPABASE_SERVICE_KEY: "srv_key",
                JOB_ID
            },
            fetchImpl: mockFetch,
            execFileImpl: mockExecFile,
            sleepImpl: async () => {},
            workDir: tempDir,
            pollIntervalMs: 1,
            busyWaitMs: 1
        });

        assert.equal(outcome.outcome, "completed");
        assert.equal(outcome.completedClips, 2);
        assert.equal(outcome.finalDuration, 20);
        assert.equal(outcome.charged, 5000);
        assert.equal(outcome.refunded, 0);

        assert.equal(
            createClipCalls.some(call => call.clip_index === 3),
            false,
            "mode 20 detik tidak boleh mengeksekusi Klip 3"
        );
        assert.equal(
            storageUploads.some(uploadUrl => uploadUrl.includes("frame-2-end.png")),
            false,
            "mode 20 detik tidak perlu mengekstrak frame akhir Klip 2"
        );
        assert.equal(historyPatchBody?.duration, 20);
        assert.equal(historyPatchBody?.credit_cost, 5000);
        assert.equal(historyPatchBody?.status, "success");
        assert.match(jobState.stage_message, /2 klip berhasil digabungkan menjadi video 20 detik/);
    } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
    }
});


