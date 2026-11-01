#!/usr/bin/env node
// =========================================================
// GEN-Z.AI
// SERVER ORCHESTRATOR — STAGED 30s VIDEO (3 x 10 DETIK)
// ---------------------------------------------------------
// File:
//   scripts/run-staged-video-30s.mjs
//
// Menjalankan pipeline bertahap 20s (2 × 10s) & 30s (3 × 10s) untuk:
//   - Seedance 2.5 Reference to Video 30s (`opus-seedance-2.5-r2v-30s`)
//   - MiniMax Hailuo 3 First & Last Frame 30s (`opus-hailuo-3-i2v-30s`)
//
// Alur:
//   1. Tunggu Klip 1 (0-10s) selesai -> simpan di Supabase Storage
//      -> ekstrak frame paling akhir Klip 1
//   2. Buat & tunggu Klip 2 (11-20s) memakai frame akhir Klip 1
//      (+ frame akhir user bila durasi target 20s) -> simpan di Supabase Storage
//   3. Jika durasi target 30s: ekstrak frame paling akhir Klip 2 -> buat & tunggu
//      Klip 3 (21-30s) memakai frame akhir Klip 2 (+ frame akhir user opsional)
//      -> simpan di Supabase Storage
//   4. Gabungkan klip secara mulus (tanpa lompatan frame / audio pop)
//      -> simpan hasil akhir di Supabase Storage -> tampilkan di History
//   5. Jika gagal sebagian (mis. Klip 1 & 2 berhasil, Klip 3 gagal),
//      gabungkan klip yang berhasil ke History & refund sisa kredit.
// =========================================================

import { execFile as execFileCb } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";

import {
    buildPrivateMediaRef,
    isPrivateMediaRef,
    parsePrivateMediaRef
} from "../lib/generate/private-media.js";

import {
    buildLastFrameFfmpegArgs,
    buildReferenceAudioSliceFfmpegArgs,
    buildReferenceVideoSliceFfmpegArgs,
    buildSeamlessMergeFfmpegArgs,
    computeStagedCreditSettlement,
    resolveStagedTargetConfig
} from "../lib/generate/staged-video-30s.js";

const execFileAsync = promisify(execFileCb);

const STORAGE_BUCKET = "user-uploads";
const POLL_INTERVAL_MS = 8_000;
const MAX_CLIP_POLL_DURATION_MS = 180 * 60 * 1000;
const BUSY_WAIT_INTERVAL_MS = 120_000;
const MAX_BUSY_WAIT_CYCLES = 3;

function defaultSleep(ms) {
    return new Promise(resolve => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
}

function encodeStoragePath(objectPath) {
    return String(objectPath || "")
        .replace(/^\/+/, "")
        .split("/")
        .map(seg => encodeURIComponent(seg))
        .join("/");
}

function parseFrameRate(rawRate) {
    const clean = String(rawRate || "").trim();
    if (!clean) return 24;
    if (clean.includes("/")) {
        const [num, den] = clean.split("/").map(Number);
        if (Number.isFinite(num) && Number.isFinite(den) && den > 0 && num > 0) {
            const fps = num / den;
            if (fps >= 10 && fps <= 120) return fps;
        }
        return 24;
    }
    const direct = Number(clean);
    return Number.isFinite(direct) && direct >= 10 && direct <= 120 ? direct : 24;
}

function inferSafeMediaExtension(refOrUrl, fallbackExt = ".mp4") {
    const raw = String(refOrUrl || "").trim();
    const candidatePath = isPrivateMediaRef(raw)
        ? (parsePrivateMediaRef(raw)?.objectPath || "")
        : raw.split("?")[0].split("#")[0];
    const ext = path.extname(candidatePath).toLowerCase();
    if ([".mp4", ".mov", ".webm", ".m4v", ".mp3", ".wav", ".m4a", ".aac", ".ogg"].includes(ext)) {
        return ext;
    }
    return fallbackExt;
}

function isOpusClipAudioCopyrightFailure(text) {
    const combined = String(text || "");
    if (!combined.trim()) return false;
    return (
        /terkena copyright/i.test(combined) ||
        /\b(?:Output|Input)?AudioSensitiveContentDetected\b/i.test(combined) ||
        /\baudio[\s_-]*copyright\b/i.test(combined) ||
        (/\baudio\b/i.test(combined) && /\bcopyright\b/i.test(combined))
    );
}

export async function runStagedVideoOrchestrator({
    env = process.env,
    fetchImpl = globalThis.fetch,
    execFileImpl = execFileAsync,
    sleepImpl = defaultSleep,
    workDir = "",
    emergencyFinalize = false,
    pollIntervalMs = POLL_INTERVAL_MS,
    busyWaitMs = BUSY_WAIT_INTERVAL_MS
} = {}) {
    const supabaseUrl = String(env.SUPABASE_URL || env.GENZ_SUPABASE_URL || "")
        .trim()
        .replace(/\/+$/, "");
    const serviceKey = String(
        env.SUPABASE_SERVICE_ROLE_KEY ||
        env.SUPABASE_SERVICE_KEY ||
        env.GENZ_SUPABASE_SERVICE_KEY ||
        ""
    ).trim();
    const jobId = String(env.JOB_ID || "").trim();
    const apiBaseUrl = String(env.API_BASE_URL || "https://genzai.genzai-f37.workers.dev")
        .trim()
        .replace(/\/+$/, "");

    if (!supabaseUrl || !serviceKey || !jobId) {
        throw new Error("Konfigurasi SUPABASE_URL, SUPABASE_SERVICE_KEY, dan JOB_ID wajib tersedia.");
    }

    const tempRoot = workDir || await fs.mkdtemp(path.join(os.tmpdir(), "genz-staged30-"));
    await fs.mkdir(tempRoot, { recursive: true });

    async function sbRest(pathname, options = {}) {
        const response = await fetchImpl(`${supabaseUrl}${pathname}`, {
            ...options,
            headers: {
                apikey: serviceKey,
                Authorization: `Bearer ${serviceKey}`,
                "Content-Type": "application/json",
                ...(options.headers || {})
            }
        });

        const text = await response.text();
        let data = null;
        if (text) {
            try {
                data = JSON.parse(text);
            } catch {
                data = text;
            }
        }

        if (!response.ok) {
            const err = new Error(
                `Supabase REST gagal (${response.status}) pada ${pathname}: ${typeof data === "string" ? data : JSON.stringify(data)}`
            );
            err.status = response.status;
            throw err;
        }

        return data;
    }

    async function uploadFileToStorage(localPath, objectPath, contentType) {
        const bytes = await fs.readFile(localPath);
        const encoded = encodeStoragePath(objectPath);
        const response = await fetchImpl(
            `${supabaseUrl}/storage/v1/object/${STORAGE_BUCKET}/${encoded}`,
            {
                method: "POST",
                headers: {
                    apikey: serviceKey,
                    Authorization: `Bearer ${serviceKey}`,
                    "Content-Type": contentType,
                    "x-upsert": "true"
                },
                body: bytes
            }
        );

        if (!response.ok) {
            const detail = await response.text().catch(() => "");
            throw new Error(`Upload ke Storage gagal (${response.status}): ${detail}`);
        }

        return buildPrivateMediaRef({
            bucket: STORAGE_BUCKET,
            objectPath
        });
    }

    async function downloadFromStorageRef(ref, destPath) {
        const parsed = parsePrivateMediaRef(ref);
        if (!parsed) {
            throw new Error(`Referensi storage tidak valid: ${ref}`);
        }
        const encoded = encodeStoragePath(parsed.objectPath);
        const response = await fetchImpl(
            `${supabaseUrl}/storage/v1/object/${parsed.bucket}/${encoded}`,
            {
                method: "GET",
                headers: {
                    apikey: serviceKey,
                    Authorization: `Bearer ${serviceKey}`
                }
            }
        );
        if (!response.ok) {
            throw new Error(`Gagal mengunduh ${ref} dari Storage (${response.status})`);
        }
        const buf = Buffer.from(await response.arrayBuffer());
        await fs.writeFile(destPath, buf);
        return destPath;
    }

    async function downloadHttpUrlToFile(url, destPath) {
        let lastErr = null;
        for (let attempt = 1; attempt <= 3; attempt += 1) {
            try {
                const response = await fetchImpl(url, { method: "GET" });
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                const buf = Buffer.from(await response.arrayBuffer());
                if (buf.byteLength < 512) {
                    throw new Error(`Ukuran file video terlalu kecil (${buf.byteLength} byte).`);
                }
                await fs.writeFile(destPath, buf);
                return destPath;
            } catch (err) {
                lastErr = err;
                if (attempt < 3) {
                    await sleepImpl(2000 * attempt);
                }
            }
        }
        throw new Error(`Gagal mengunduh video output klip: ${lastErr?.message || "unknown error"}`);
    }

    async function downloadMediaSourceToFile(refOrUrl, destPath) {
        const clean = String(refOrUrl || "").trim();
        if (!clean) {
            throw new Error("Sumber media referensi kosong.");
        }
        if (isPrivateMediaRef(clean)) {
            return await downloadFromStorageRef(clean, destPath);
        }
        return await downloadHttpUrlToFile(clean, destPath);
    }

    async function loadJob() {
        const rows = await sbRest(
            `/rest/v1/staged_generation_jobs?select=*&id=eq.${encodeURIComponent(jobId)}&limit=1`,
            { method: "GET" }
        );
        return Array.isArray(rows) ? rows[0] || null : null;
    }

    async function loadHistory(historyId) {
        const rows = await sbRest(
            `/rest/v1/generation_history?select=*&id=eq.${encodeURIComponent(historyId)}&limit=1`,
            { method: "GET" }
        );
        return Array.isArray(rows) ? rows[0] || null : null;
    }

    async function patchJobProgress(patchFields) {
        await sbRest(
            `/rest/v1/staged_generation_jobs?id=eq.${encodeURIComponent(jobId)}&status=eq.processing`,
            {
                method: "PATCH",
                headers: { Prefer: "return=minimal" },
                body: JSON.stringify({
                    ...patchFields,
                    updated_at: new Date().toISOString()
                })
            }
        );
    }

    async function isHistoryCancelled(historyId) {
        const hist = await loadHistory(historyId).catch(() => null);
        const status = String(hist?.status || "").trim().toLowerCase();
        return status === "cancelled";
    }

    async function probeVideoFile(localPath, fallbackHasAudio = true) {
        try {
            const { stdout } = await execFileImpl("ffprobe", [
                "-v",
                "error",
                "-print_format",
                "json",
                "-show_format",
                "-show_streams",
                localPath
            ]);
            const parsed = JSON.parse(String(stdout || "{}"));
            const streams = Array.isArray(parsed.streams) ? parsed.streams : [];
            const vStream = streams.find(s => s.codec_type === "video") || {};
            const aStream = streams.find(s => s.codec_type === "audio") || {};
            const hasAudio = streams.some(s => s.codec_type === "audio");
            const width = Number(vStream.width) || 720;
            const height = Number(vStream.height) || 1280;
            const fps = parseFrameRate(vStream.avg_frame_rate || vStream.r_frame_rate);
            const duration =
                Number(vStream.duration) ||
                Number(aStream.duration) ||
                Number(parsed.format?.duration) ||
                10;

            return { width, height, fps, duration, hasAudio };
        } catch {
            return {
                width: 720,
                height: 1280,
                fps: 24,
                duration: 10,
                hasAudio: Boolean(fallbackHasAudio)
            };
        }
    }

    async function countDecodedFrames(localPath) {
        try {
            const { stdout } = await execFileImpl("ffprobe", [
                "-v",
                "error",
                "-count_frames",
                "-select_streams",
                "v:0",
                "-show_entries",
                "stream=nb_read_frames",
                "-of",
                "csv=p=0",
                localPath
            ]);
            const count = parseInt(String(stdout || "").trim(), 10);
            return Number.isFinite(count) && count > 0 ? count : 0;
        } catch {
            return 0;
        }
    }

    async function extractLastFramePng(localClipPath, outputPngPath) {
        const totalFrames = await countDecodedFrames(localClipPath);
        const primaryArgs = buildLastFrameFfmpegArgs({
            inputPath: localClipPath,
            outputPath: outputPngPath,
            totalFrames
        });

        await execFileImpl("ffmpeg", primaryArgs).catch(() => null);
        const primaryStat = await fs.stat(outputPngPath).catch(() => null);

        if (!primaryStat || primaryStat.size < 128) {
            const fallbackArgs = buildLastFrameFfmpegArgs({
                inputPath: localClipPath,
                outputPath: outputPngPath,
                totalFrames: 0
            });
            await execFileImpl("ffmpeg", fallbackArgs);
        }

        const finalStat = await fs.stat(outputPngPath).catch(() => null);
        if (!finalStat || finalStat.size < 128) {
            throw new Error("Gagal mengekstrak frame akhir klip video.");
        }

        return outputPngPath;
    }

    async function mergeSavedClipsToOutput(clipLocalPaths, outputMp4Path, directRefAudio = null, fallbackHasAudio = true) {
        const infos = [];
        for (const p of clipLocalPaths) {
            infos.push(await probeVideoFile(p, fallbackHasAudio));
        }

        const useDirectAudio = Boolean(directRefAudio?.path && directRefAudio?.hasAudio);
        const primaryMergeArgs = buildSeamlessMergeFfmpegArgs({
            clipPaths: clipLocalPaths,
            clipInfos: infos,
            outputPath: outputMp4Path,
            referenceAudioPath: useDirectAudio ? directRefAudio.path : "",
            referenceAudioDuration: useDirectAudio ? directRefAudio.duration : 0,
            referenceAudioHasAudio: useDirectAudio
        });

        try {
            await execFileImpl("ffmpeg", primaryMergeArgs);
        } catch (mergeErr) {
            if (!useDirectAudio) {
                throw mergeErr;
            }
            console.warn(
                "[staged-video-30s] Merge dengan audio referensi langsung gagal, fallback ke audio klip:",
                mergeErr?.message || mergeErr
            );
            const fallbackMergeArgs = buildSeamlessMergeFfmpegArgs({
                clipPaths: clipLocalPaths,
                clipInfos: infos,
                outputPath: outputMp4Path
            });
            await execFileImpl("ffmpeg", fallbackMergeArgs);
        }

        const stat = await fs.stat(outputMp4Path).catch(() => null);
        if (!stat || stat.size < 512) {
            throw new Error("FFmpeg gagal menghasilkan video gabungan akhir.");
        }
        return outputMp4Path;
    }

    async function prepareJobReferenceMedia(job) {
        const reqPayload = job?.request_payload && typeof job.request_payload === "object"
            ? job.request_payload
            : {};
        const rawVideos = Array.isArray(reqPayload.video_urls)
            ? reqPayload.video_urls.map(v => String(v || "").trim()).filter(Boolean).slice(0, 3)
            : [];
        const rawAudios = Array.isArray(reqPayload.audio_urls)
            ? reqPayload.audio_urls.map(a => String(a || "").trim()).filter(Boolean).slice(0, 3)
            : [];

        const videos = [];
        for (let i = 0; i < rawVideos.length; i += 1) {
            const ext = inferSafeMediaExtension(rawVideos[i], ".mp4");
            const localPath = path.join(tempRoot, `source-ref-video-${i + 1}${ext}`);
            try {
                await downloadMediaSourceToFile(rawVideos[i], localPath);
                const info = await probeVideoFile(localPath);
                videos.push({ index: i + 1, sourceRef: rawVideos[i], localPath, info });
            } catch (err) {
                console.warn(
                    `[staged-video-30s] Gagal mengunduh video referensi #${i + 1}:`,
                    err?.message || err
                );
            }
        }

        const audios = [];
        for (let i = 0; i < rawAudios.length; i += 1) {
            const ext = inferSafeMediaExtension(rawAudios[i], ".mp3");
            const localPath = path.join(tempRoot, `source-ref-audio-${i + 1}${ext}`);
            try {
                await downloadMediaSourceToFile(rawAudios[i], localPath);
                const info = await probeVideoFile(localPath);
                audios.push({ index: i + 1, sourceRef: rawAudios[i], localPath, info });
            } catch (err) {
                console.warn(
                    `[staged-video-30s] Gagal mengunduh audio referensi #${i + 1}:`,
                    err?.message || err
                );
            }
        }

        const wantAudio = Boolean(reqPayload.generate_audio ?? true) || audios.length > 0;
        let directRefAudio = null;
        if (wantAudio) {
            if (audios[0]?.info?.hasAudio) {
                directRefAudio = {
                    path: audios[0].localPath,
                    duration: Number(audios[0].info.duration) || 0,
                    hasAudio: true
                };
            } else if (videos[0]?.info?.hasAudio) {
                directRefAudio = {
                    path: videos[0].localPath,
                    duration: Number(videos[0].info.duration) || 0,
                    hasAudio: true
                };
            }
        }

        return {
            videos,
            audios,
            directRefAudio,
            hasAnyMedia: videos.length > 0 || audios.length > 0
        };
    }

    async function callWorkerStep(internalToken, payload) {
        const response = await fetchImpl(`${apiBaseUrl}/api/generate`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Staged-Job-Token": internalToken
            },
            body: JSON.stringify({
                action: "staged-video-step",
                job_id: jobId,
                ...payload
            })
        });

        const text = await response.text();
        let data = null;
        try {
            data = text ? JSON.parse(text) : null;
        } catch {
            data = { error: text };
        }

        return {
            httpStatus: response.status,
            ok: response.ok,
            data: data || {}
        };
    }

    async function finalizeFailureZeroClips(job, errorMessage) {
        const claimed = await sbRest(
            `/rest/v1/staged_generation_jobs?id=eq.${encodeURIComponent(job.id)}&status=eq.processing`,
            {
                method: "PATCH",
                headers: { Prefer: "return=representation" },
                body: JSON.stringify({
                    status: "failed",
                    current_stage: "failed",
                    stage_message: errorMessage,
                    error_message: errorMessage,
                    internal_token: null,
                    credit_charged: 0,
                    credit_refunded_amount: Number(job.credit_total) || 0,
                    completed_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
            }
        );

        if (!Array.isArray(claimed) || claimed.length === 0) {
            return { finalized: false, outcome: "already_finalized" };
        }

        await sbRest(
            `/rest/v1/generation_history?id=eq.${encodeURIComponent(job.history_id)}&status=in.(processing,pending)`,
            {
                method: "PATCH",
                headers: { Prefer: "return=minimal" },
                body: JSON.stringify({
                    status: "failed",
                    error_message: errorMessage,
                    completed_at: new Date().toISOString()
                })
            }
        );

        await sbRest("/rest/v1/rpc/refund_failed_generation_credits", {
            method: "POST",
            body: JSON.stringify({
                p_user_id: job.user_id,
                p_task_id: job.task_id
            })
        });

        return {
            finalized: true,
            outcome: "failed",
            completedClips: 0,
            refunded: Number(job.credit_total) || 0
        };
    }

    function getJobTargetConfig(jobRow) {
        const reqPayload = jobRow?.request_payload || {};
        return resolveStagedTargetConfig(
            reqPayload.target_duration ?? reqPayload.duration ?? 30
        );
    }

    async function finalizeCompletedOrPartialClips(
        job,
        localClipPaths,
        failureNote = "",
        directRefAudio = null
    ) {
        const targetConfig = getJobTargetConfig(job);
        const clipCount = localClipPaths.length;
        const settlement = computeStagedCreditSettlement(
            job.credit_total,
            clipCount,
            targetConfig.totalClips
        );
        const mergedLocalPath = path.join(tempRoot, `merged-final-${clipCount}clips.mp4`);

        const expectedHasAudio = Boolean(job?.request_payload?.generate_audio ?? true);
        await mergeSavedClipsToOutput(
            localClipPaths,
            mergedLocalPath,
            directRefAudio,
            expectedHasAudio
        );

        const finalObjectKey = `upscale-videos/outputs/${job.user_id}/staged30-${job.history_id}-${Date.now()}.mp4`;
        const finalStorageRef = await uploadFileToStorage(
            mergedLocalPath,
            finalObjectKey,
            "video/mp4"
        );

        const jobStatus = settlement.outcome;
        const summaryMsg =
            settlement.outcome === "completed"
                ? `Selesai! ${settlement.totalClips} klip berhasil digabungkan menjadi video ${settlement.finalDuration} detik.`
                : `Selesai sebagian (${settlement.finalDuration} detik dari ${clipCount} klip). Sisa kredit telah dikembalikan.${failureNote ? ` (${failureNote})` : ""}`;

        const claimed = await sbRest(
            `/rest/v1/staged_generation_jobs?id=eq.${encodeURIComponent(job.id)}&status=eq.processing`,
            {
                method: "PATCH",
                headers: { Prefer: "return=representation" },
                body: JSON.stringify({
                    status: jobStatus,
                    current_stage: "completed",
                    stage_message: summaryMsg,
                    merged_storage_ref: finalStorageRef,
                    completed_clips: clipCount,
                    final_duration_seconds: settlement.finalDuration,
                    credit_charged: settlement.charged,
                    credit_refunded_amount: settlement.refund,
                    error_message: failureNote || null,
                    internal_token: null,
                    completed_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
            }
        );

        if (!Array.isArray(claimed) || claimed.length === 0) {
            return { finalized: false, outcome: "already_finalized" };
        }

        const updatedHistory = await sbRest(
            `/rest/v1/generation_history?id=eq.${encodeURIComponent(job.history_id)}&status=in.(processing,pending)`,
            {
                method: "PATCH",
                headers: { Prefer: "return=representation" },
                body: JSON.stringify({
                    status: "success",
                    result_url: finalStorageRef,
                    duration: settlement.finalDuration,
                    credit_cost: settlement.charged,
                    error_message:
                        settlement.outcome === "partial_completed"
                            ? summaryMsg
                            : null,
                    completed_at: new Date().toISOString()
                })
            }
        );

        if (
            Array.isArray(updatedHistory) &&
            updatedHistory.length > 0 &&
            settlement.refund > 0
        ) {
            await sbRest("/rest/v1/rpc/refund_generate_credits", {
                method: "POST",
                body: JSON.stringify({
                    p_user_id: job.user_id,
                    p_amount: settlement.refund
                })
            });
        }

        return {
            finalized: true,
            outcome: settlement.outcome,
            completedClips: clipCount,
            finalDuration: settlement.finalDuration,
            charged: settlement.charged,
            refunded: settlement.refund,
            resultRef: finalStorageRef
        };
    }

    const job = await loadJob();
    if (!job) {
        throw new Error(`staged_generation_jobs dengan id=${jobId} tidak ditemukan.`);
    }

    if (String(job.status || "").toLowerCase() !== "processing") {
        return { finalized: false, outcome: job.status };
    }

    if (await isHistoryCancelled(job.history_id)) {
        await patchJobProgress({
            status: "cancelled",
            current_stage: "cancelled",
            stage_message: "Pemrosesan dibatalkan.",
            internal_token: null,
            completed_at: new Date().toISOString()
        });
        return { finalized: true, outcome: "cancelled" };
    }

    const targetConfig = getJobTargetConfig(job);
    const totalClips = targetConfig.totalClips;
    const targetDurationSeconds = targetConfig.targetDuration;

    // Mode darurat (dipanggil jika job GitHub Actions dihentikan mendadak):
    // pulihkan klip yang sudah tersimpan di server, gabungkan & refund proporsional.
    if (emergencyFinalize) {
        const recoveredClips = [];
        const savedRefs = [
            job.clip_1_storage_ref,
            job.clip_2_storage_ref,
            totalClips >= 3 ? job.clip_3_storage_ref : null
        ].filter(Boolean);

        for (let idx = 0; idx < savedRefs.length; idx += 1) {
            const localRec = path.join(tempRoot, `recovered-clip-${idx + 1}.mp4`);
            try {
                await downloadFromStorageRef(savedRefs[idx], localRec);
                recoveredClips.push(localRec);
            } catch {
                break;
            }
        }

        if (recoveredClips.length > 0) {
            const emergencyRefMedia = await prepareJobReferenceMedia(job).catch(() => null);
            return await finalizeCompletedOrPartialClips(
                job,
                recoveredClips,
                "Pemrosesan tahap berikutnya terhenti di server",
                emergencyRefMedia?.directRefAudio || null
            );
        }

        return await finalizeFailureZeroClips(
            job,
            `Pemrosesan video ${targetDurationSeconds} detik terhenti sebelum Klip 1 selesai.`
        );
    }

    const internalToken = String(job.internal_token || "").trim();
    if (!internalToken) {
        throw new Error("internal_token kosong pada job bertahap.");
    }
    if (String(env.GITHUB_ACTIONS || "").toLowerCase() === "true") {
        console.log(`::add-mask::${internalToken}`);
    }

    const jobFolder = `upscale-videos/outputs/${job.user_id}/staged30-${job.history_id}`;

    async function sliceAndUploadClipReferenceSegments(
        clipIndex,
        referenceMedia,
        { muteVideos = false } = {}
    ) {
        if (!referenceMedia?.hasAnyMedia) {
            return { videoSegmentRefs: [], audioSegmentRefs: [] };
        }

        const videoSegmentRefs = [];
        for (const item of referenceMedia.videos || []) {
            const suffix = muteVideos ? "-muted" : "";
            const sliceLocalPath = path.join(
                tempRoot,
                `ref-video-${item.index}-clip-${clipIndex}${suffix}.mp4`
            );
            const sliceArgs = buildReferenceVideoSliceFfmpegArgs({
                inputPath: item.localPath,
                outputPath: sliceLocalPath,
                clipIndex,
                clipDurationSeconds: 10,
                sourceDurationSeconds: Number(item.info?.duration) || 0,
                includeAudio: !muteVideos && Boolean(item.info?.hasAudio)
            });

            await execFileImpl("ffmpeg", sliceArgs);
            const sliceStat = await fs.stat(sliceLocalPath).catch(() => null);
            if (!sliceStat || sliceStat.size < 256) {
                throw new Error(
                    `Gagal memotong segmen video referensi #${item.index} untuk Klip ${clipIndex}.`
                );
            }

            const uploadedRef = await uploadFileToStorage(
                sliceLocalPath,
                `${jobFolder}/ref-video-${item.index}-clip-${clipIndex}${suffix}.mp4`,
                "video/mp4"
            );
            videoSegmentRefs.push(uploadedRef);
        }

        const audioSegmentRefs = [];
        if (!muteVideos) {
            for (const item of referenceMedia.audios || []) {
                const sliceMp3Path = path.join(
                    tempRoot,
                    `ref-audio-${item.index}-clip-${clipIndex}.mp3`
                );
                const sliceMp3Args = buildReferenceAudioSliceFfmpegArgs({
                    inputPath: item.localPath,
                    outputPath: sliceMp3Path,
                    clipIndex,
                    clipDurationSeconds: 10,
                    sourceDurationSeconds: Number(item.info?.duration) || 0,
                    format: "mp3"
                });

                let finalAudioSlicePath = sliceMp3Path;
                let finalAudioStorageExt = "mp3";
                let finalAudioContentType = "audio/mpeg";

                try {
                    await execFileImpl("ffmpeg", sliceMp3Args);
                } catch {
                    // Fallback ke WAV (juga diizinkan Opus: mp3, wav) bila encoder libmp3lame tidak tersedia
                    const sliceWavPath = path.join(
                        tempRoot,
                        `ref-audio-${item.index}-clip-${clipIndex}.wav`
                    );
                    const sliceWavArgs = buildReferenceAudioSliceFfmpegArgs({
                        inputPath: item.localPath,
                        outputPath: sliceWavPath,
                        clipIndex,
                        clipDurationSeconds: 10,
                        sourceDurationSeconds: Number(item.info?.duration) || 0,
                        format: "wav"
                    });
                    await execFileImpl("ffmpeg", sliceWavArgs);
                    finalAudioSlicePath = sliceWavPath;
                    finalAudioStorageExt = "wav";
                    finalAudioContentType = "audio/wav";
                }

                const sliceStat = await fs.stat(finalAudioSlicePath).catch(() => null);
                if (!sliceStat || sliceStat.size < 128) {
                    throw new Error(
                        `Gagal memotong segmen audio referensi #${item.index} untuk Klip ${clipIndex}.`
                    );
                }

                const uploadedRef = await uploadFileToStorage(
                    finalAudioSlicePath,
                    `${jobFolder}/ref-audio-${item.index}-clip-${clipIndex}.${finalAudioStorageExt}`,
                    finalAudioContentType
                );
                audioSegmentRefs.push(uploadedRef);
            }
        }

        return { videoSegmentRefs, audioSegmentRefs };
    }

    async function executeAndPersistClip({
        clipIndex,
        initialTaskId = "",
        firstFrameRef = "",
        referenceMedia = null
    }) {
        const excludedSlots = new Set();
        let busyWaitCycles = 0;
        let activeTaskId = String(initialTaskId || "").trim();
        let preparedSegmentRefs = null;
        let retriedMutedForCopyright = false;
        let muteVideosForClip = false;

        while (true) {
            if (await isHistoryCancelled(job.history_id)) {
                const cancelErr = new Error("Generasi dibatalkan.");
                cancelErr.cancelled = true;
                throw cancelErr;
            }

            if (!activeTaskId) {
                if (!preparedSegmentRefs && referenceMedia?.hasAnyMedia) {
                    try {
                        preparedSegmentRefs = await sliceAndUploadClipReferenceSegments(
                            clipIndex,
                            referenceMedia,
                            { muteVideos: muteVideosForClip }
                        );
                    } catch (sliceErr) {
                        console.warn(
                            `[staged-video-30s] Gagal menyiapkan potongan referensi Klip ${clipIndex}, lanjut fallback frame akhir:`,
                            sliceErr?.message || sliceErr
                        );
                        preparedSegmentRefs = { videoSegmentRefs: [], audioSegmentRefs: [] };
                    }
                }

                const createRes = await callWorkerStep(internalToken, {
                    step_action: "create_clip",
                    clip_index: clipIndex,
                    first_frame_ref: firstFrameRef || undefined,
                    video_segment_refs:
                        preparedSegmentRefs?.videoSegmentRefs?.length > 0
                            ? preparedSegmentRefs.videoSegmentRefs
                            : undefined,
                    audio_segment_refs:
                        preparedSegmentRefs?.audioSegmentRefs?.length > 0
                            ? preparedSegmentRefs.audioSegmentRefs
                            : undefined,
                    generate_audio_override: muteVideosForClip ? false : undefined,
                    exclude_key_slots: [...excludedSlots]
                });

                if (createRes.httpStatus === 409) {
                    const cancelErr = new Error("Job sudah selesai atau dibatalkan.");
                    cancelErr.cancelled = true;
                    throw cancelErr;
                }

                if (createRes.ok && createRes.data?.success && createRes.data?.task_id) {
                    activeTaskId = String(createRes.data.task_id).trim();
                    await patchJobProgress({
                        [`clip_${clipIndex}_task_id`]: activeTaskId,
                        current_stage: `clip_${clipIndex}_generating`,
                        stage_message: `Membuat Klip ${clipIndex}/${totalClips} (durasi ${(clipIndex - 1) * 10 + (clipIndex === 1 ? 0 : 1)}–${clipIndex * 10} detik)...`
                    });
                } else if (
                    !retriedMutedForCopyright &&
                    Boolean(referenceMedia?.hasAnyMedia) &&
                    isOpusClipAudioCopyrightFailure(
                        `${createRes.data?.error_code || ""} ${createRes.data?.error || ""}`
                    )
                ) {
                    retriedMutedForCopyright = true;
                    muteVideosForClip = true;
                    preparedSegmentRefs = null;
                    continue;
                } else if (createRes.data?.opus_busy) {
                    const failedSlot = createRes.data.failed_key_slot;
                    const poolSize = Number(createRes.data.key_pool_size) || 1;
                    if (Number.isInteger(failedSlot)) {
                        excludedSlots.add(failedSlot);
                    }

                    if (!createRes.data.rotated_full_cycle && excludedSlots.size < poolSize) {
                        continue;
                    }

                    if (busyWaitCycles < MAX_BUSY_WAIT_CYCLES) {
                        busyWaitCycles += 1;
                        excludedSlots.clear();
                        await patchJobProgress({
                            stage_message: `Menunggu antrian Opus untuk Klip ${clipIndex}/${totalClips} (percobaan ulang ${busyWaitCycles}/${MAX_BUSY_WAIT_CYCLES})...`
                        });
                        await sleepImpl(busyWaitMs);
                        continue;
                    }

                    throw new Error(
                        createRes.data?.error ||
                        `Saldo/antrian upstream Opus sedang penuh saat membuat Klip ${clipIndex}.`
                    );
                } else {
                    throw new Error(
                        createRes.data?.error ||
                        `Gagal memulai Klip ${clipIndex} pada provider Opus.`
                    );
                }
            }

            // Poll activeTaskId sampai selesai
            const pollStartedAt = Date.now();
            let pollIter = 0;
            let switchToAnotherKey = false;

            while (Date.now() - pollStartedAt < MAX_CLIP_POLL_DURATION_MS) {
                pollIter += 1;
                if (pollIter % 3 === 0 && (await isHistoryCancelled(job.history_id))) {
                    const cancelErr = new Error("Generasi dibatalkan.");
                    cancelErr.cancelled = true;
                    throw cancelErr;
                }

                const queryRes = await callWorkerStep(internalToken, {
                    step_action: "query_clip",
                    clip_index: clipIndex,
                    clip_task_id: activeTaskId
                });

                if (queryRes.httpStatus === 409) {
                    const cancelErr = new Error("Job sudah dihentikan.");
                    cancelErr.cancelled = true;
                    throw cancelErr;
                }

                if (!queryRes.ok || !queryRes.data?.success) {
                    await sleepImpl(pollIntervalMs);
                    continue;
                }

                const q = queryRes.data;
                if (q.completed && Array.isArray(q.output_urls) && q.output_urls.length > 0) {
                    const localClipPath = path.join(tempRoot, `clip-${clipIndex}.mp4`);
                    await downloadHttpUrlToFile(q.output_urls[0], localClipPath);

                    const clipStorageRef = await uploadFileToStorage(
                        localClipPath,
                        `${jobFolder}/clip-${clipIndex}.mp4`,
                        "video/mp4"
                    );

                    return {
                        taskId: activeTaskId,
                        localClipPath,
                        clipStorageRef
                    };
                }

                if (q.failed) {
                    if (
                        !retriedMutedForCopyright &&
                        Boolean(referenceMedia?.hasAnyMedia) &&
                        isOpusClipAudioCopyrightFailure(
                            `${q.error_code || ""} ${q.error_message || ""}`
                        )
                    ) {
                        retriedMutedForCopyright = true;
                        muteVideosForClip = true;
                        preparedSegmentRefs = null;
                        activeTaskId = "";
                        switchToAnotherKey = true;
                        break;
                    }

                    if (q.opus_busy) {
                        const failedSlot = q.key_slot;
                        const poolSize = Number(q.key_pool_size) || 1;
                        if (Number.isInteger(failedSlot)) {
                            excludedSlots.add(failedSlot);
                        }
                        activeTaskId = "";

                        if (excludedSlots.size < poolSize) {
                            switchToAnotherKey = true;
                            break;
                        }

                        if (busyWaitCycles < MAX_BUSY_WAIT_CYCLES) {
                            busyWaitCycles += 1;
                            excludedSlots.clear();
                            await patchJobProgress({
                                stage_message: `Menunggu antrian Opus untuk Klip ${clipIndex}/${totalClips} (percobaan ulang ${busyWaitCycles}/${MAX_BUSY_WAIT_CYCLES})...`
                            });
                            await sleepImpl(busyWaitMs);
                            switchToAnotherKey = true;
                            break;
                        }
                    }

                    throw new Error(
                        q.error_message ||
                        `Klip ${clipIndex} gagal diproses oleh Opus.`
                    );
                }

                await sleepImpl(pollIntervalMs);
            }

            if (switchToAnotherKey) {
                continue;
            }

            throw new Error(`Waktu tunggu Klip ${clipIndex} habis.`);
        }
    }

    const completedClipLocalPaths = [];

    try {
        const referenceMedia = await prepareJobReferenceMedia(job);
        const directRefAudio = referenceMedia?.directRefAudio || null;

        // =================================================
        // KLIP 1 (0 - 10 DETIK)
        // =================================================
        let clip1Result;
        try {
            clip1Result = await executeAndPersistClip({
                clipIndex: 1,
                initialTaskId: job.clip_1_task_id || "",
                referenceMedia
            });
        } catch (clip1Err) {
            if (clip1Err?.cancelled) {
                await patchJobProgress({
                    status: "cancelled",
                    current_stage: "cancelled",
                    internal_token: null,
                    completed_at: new Date().toISOString()
                });
                return { finalized: true, outcome: "cancelled" };
            }
            return await finalizeFailureZeroClips(
                job,
                clip1Err?.message || "Klip 1 gagal dibuat."
            );
        }

        completedClipLocalPaths.push(clip1Result.localClipPath);

        const frame1LocalPath = path.join(tempRoot, "frame-1-end.png");
        let frame1Ref = "";
        try {
            await extractLastFramePng(clip1Result.localClipPath, frame1LocalPath);
            frame1Ref = await uploadFileToStorage(
                frame1LocalPath,
                `${jobFolder}/frame-1-end.png`,
                "image/png"
            );
        } catch (frame1Err) {
            return await finalizeCompletedOrPartialClips(
                job,
                completedClipLocalPaths,
                frame1Err?.message || "Gagal menyiapkan frame akhir Klip 1",
                directRefAudio
            );
        }

        await patchJobProgress({
            completed_clips: 1,
            clip_1_storage_ref: clip1Result.clipStorageRef,
            clip_1_last_frame_ref: frame1Ref,
            current_stage: "clip_2_generating",
            stage_message: `Klip 1 tersimpan di server • Membuat Klip 2/${totalClips} (durasi 11–20 detik)...`
        });

        // =================================================
        // KLIP 2 (11 - 20 DETIK, DARI POSISI AKHIR KLIP 1)
        // =================================================
        let clip2Result;
        try {
            clip2Result = await executeAndPersistClip({
                clipIndex: 2,
                initialTaskId: job.clip_2_task_id || "",
                firstFrameRef: frame1Ref,
                referenceMedia
            });
        } catch (clip2Err) {
            if (clip2Err?.cancelled) {
                await patchJobProgress({
                    status: "cancelled",
                    current_stage: "cancelled",
                    internal_token: null,
                    completed_at: new Date().toISOString()
                });
                return { finalized: true, outcome: "cancelled" };
            }
            return await finalizeCompletedOrPartialClips(
                job,
                completedClipLocalPaths,
                clip2Err?.message || "Klip 2 gagal diproses",
                directRefAudio
            );
        }

        completedClipLocalPaths.push(clip2Result.localClipPath);

        if (totalClips === 2) {
            await patchJobProgress({
                completed_clips: 2,
                clip_2_storage_ref: clip2Result.clipStorageRef,
                current_stage: "merging",
                stage_message: "Klip 2 tersimpan di server • Menggabungkan 2 klip menjadi video 20 detik..."
            });

            return await finalizeCompletedOrPartialClips(
                job,
                completedClipLocalPaths,
                "",
                directRefAudio
            );
        }

        const frame2LocalPath = path.join(tempRoot, "frame-2-end.png");
        let frame2Ref = "";
        try {
            await extractLastFramePng(clip2Result.localClipPath, frame2LocalPath);
            frame2Ref = await uploadFileToStorage(
                frame2LocalPath,
                `${jobFolder}/frame-2-end.png`,
                "image/png"
            );
        } catch (frame2Err) {
            return await finalizeCompletedOrPartialClips(
                job,
                completedClipLocalPaths,
                frame2Err?.message || "Gagal menyiapkan frame akhir Klip 2",
                directRefAudio
            );
        }

        await patchJobProgress({
            completed_clips: 2,
            clip_2_storage_ref: clip2Result.clipStorageRef,
            clip_2_last_frame_ref: frame2Ref,
            current_stage: "clip_3_generating",
            stage_message: "Klip 2 tersimpan di server • Membuat Klip 3/3 (durasi 21–30 detik)..."
        });

        // =================================================
        // KLIP 3 (21 - 30 DETIK, DARI POSISI AKHIR KLIP 2)
        // =================================================
        let clip3Result;
        try {
            clip3Result = await executeAndPersistClip({
                clipIndex: 3,
                initialTaskId: job.clip_3_task_id || "",
                firstFrameRef: frame2Ref,
                referenceMedia
            });
        } catch (clip3Err) {
            if (clip3Err?.cancelled) {
                await patchJobProgress({
                    status: "cancelled",
                    current_stage: "cancelled",
                    internal_token: null,
                    completed_at: new Date().toISOString()
                });
                return { finalized: true, outcome: "cancelled" };
            }
            return await finalizeCompletedOrPartialClips(
                job,
                completedClipLocalPaths,
                clip3Err?.message || "Klip 3 gagal diproses",
                directRefAudio
            );
        }

        completedClipLocalPaths.push(clip3Result.localClipPath);

        await patchJobProgress({
            completed_clips: 3,
            clip_3_storage_ref: clip3Result.clipStorageRef,
            current_stage: "merging",
            stage_message: "Klip 3 tersimpan di server • Menggabungkan 3 klip menjadi video 30 detik..."
        });

        // =================================================
        // GABUNGKAN 3 KLIP SECARA MULUS -> HISTORY
        // =================================================
        return await finalizeCompletedOrPartialClips(
            job,
            completedClipLocalPaths,
            "",
            directRefAudio
        );
    } finally {
        if (!workDir) {
            await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => null);
        }
    }
}

const isCliMain =
    Boolean(process.argv[1]) &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isCliMain) {
    const emergencyFinalize = process.argv.includes("--finalize-emergency");
    runStagedVideoOrchestrator({ emergencyFinalize })
        .then(result => {
            console.log("[staged-video-30s] Selesai:", JSON.stringify(result));
            process.exit(0);
        })
        .catch(err => {
            console.error("[staged-video-30s] Gagal:", err?.message || err);
            process.exit(1);
        });
}
