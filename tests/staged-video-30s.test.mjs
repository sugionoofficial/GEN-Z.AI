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
    buildSeamlessMergeFfmpegArgs,
    buildStaged30sPrompts,
    cleanContinuationPromptForFirstFrame,
    computeStagedCreditSettlement,
    generateStaged30sTaskId,
    isStaged30sModelId,
    isStaged30sTaskId,
    resolveStagedApiBaseUrl
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
