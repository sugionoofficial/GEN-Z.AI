/* =========================================================
   GEN-Z.AI — GENERATED AUDIO & TRANSCRIPT PERSISTENCE HELPER
   ---------------------------------------------------------
   File:
     lib/generate/persist-generated-audio.js

   Menyimpan hasil:
   1. `generate_audio` (MP3 / WAV / M4A / OGG / AAC / FLAC)
      ke bucket privat `user-uploads` pada path milik user:
        upscale-videos/outputs/<userId>/genaud-<ts>-<rand>.<ext>
   2. `transcribe_audio` (bundle JSON transkrip + segmen + SRT)
      ke bucket privat `user-uploads` pada path milik user:
        upscale-videos/outputs/<userId>/gentrx-<ts>-<rand>.json

   Catatan Arsitektur:
   - Prefix `upscale-videos/outputs/<userId>/...` sudah diizinkan
     oleh RLS `public.user_owns_media_path` pada `storage.objects`
     dan `isRefOwnedByUser` pada `lib/generate/private-media.js`,
     serta dibersihkan otomatis tanpa mengubah jadwal retensi sistem.
========================================================= */

import {
    buildPrivateMediaRef,
    isPrivateMediaRef
} from "./private-media.js";
import { UPLOAD_BUCKET } from "./upscale-source.js";
import { normalizeTranscriptPayload } from "../../assets/js/transcript-format.js";
import { concatAudioClips } from "./audio-concat.js";

const FETCH_AUDIO_TIMEOUT_MS = 25000;
const MAX_PERSIST_AUDIO_BYTES = 80 * 1024 * 1024;

function decodeBase64ToBytes(base64Text) {
    const clean = String(base64Text || "").replace(/\s+/g, "");
    if (typeof Buffer !== "undefined" && typeof Buffer.from === "function") {
        return new Uint8Array(Buffer.from(clean, "base64"));
    }
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

function encodeBytesToBase64(bytes) {
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || 0);
    if (typeof Buffer !== "undefined" && typeof Buffer.from === "function") {
        return Buffer.from(u8).toString("base64");
    }
    let binary = "";
    for (let i = 0; i < u8.length; i += 1) {
        binary += String.fromCharCode(u8[i]);
    }
    return btoa(binary);
}

function encodeTextToBase64(text) {
    const raw = String(text || "");
    if (typeof Buffer !== "undefined" && typeof Buffer.from === "function") {
        return Buffer.from(raw, "utf8").toString("base64");
    }
    const bytes = new TextEncoder().encode(raw);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 1) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function detectAudioTypeFromBytes(bytes, fallbackMime = "", sourceUrl = "") {
    if (bytes instanceof Uint8Array && bytes.length >= 12) {
        /* RIFF....WAVE */
        if (
            bytes[0] === 0x52 &&
            bytes[1] === 0x49 &&
            bytes[2] === 0x46 &&
            bytes[3] === 0x46 &&
            bytes[8] === 0x57 &&
            bytes[9] === 0x41 &&
            bytes[10] === 0x56 &&
            bytes[11] === 0x45
        ) {
            return { mime: "audio/wav", ext: "wav" };
        }
        /* ID3 atau MP3 sync frame */
        if (
            (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) ||
            (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)
        ) {
            return { mime: "audio/mpeg", ext: "mp3" };
        }
        /* OggS */
        if (
            bytes[0] === 0x4f &&
            bytes[1] === 0x67 &&
            bytes[2] === 0x67 &&
            bytes[3] === 0x53
        ) {
            return { mime: "audio/ogg", ext: "ogg" };
        }
        /* fLaC */
        if (
            bytes[0] === 0x66 &&
            bytes[1] === 0x4c &&
            bytes[2] === 0x61 &&
            bytes[3] === 0x43
        ) {
            return { mime: "audio/flac", ext: "flac" };
        }
        /* ISO BMFF ftyp (M4A / MP4 audio) */
        if (
            bytes[4] === 0x66 &&
            bytes[5] === 0x74 &&
            bytes[6] === 0x79 &&
            bytes[7] === 0x70
        ) {
            return { mime: "audio/mp4", ext: "m4a" };
        }
    }

    const mime = String(fallbackMime || "").split(";")[0].trim().toLowerCase();
    if (mime === "audio/wav" || mime === "audio/x-wav" || mime === "audio/wave") {
        return { mime: "audio/wav", ext: "wav" };
    }
    if (mime === "audio/ogg" || mime === "audio/opus") {
        return { mime: "audio/ogg", ext: "ogg" };
    }
    if (mime === "audio/flac" || mime === "audio/x-flac") {
        return { mime: "audio/flac", ext: "flac" };
    }
    if (mime === "audio/mp4" || mime === "audio/x-m4a" || mime === "audio/m4a") {
        return { mime: "audio/mp4", ext: "m4a" };
    }
    if (mime === "audio/aac") {
        return { mime: "audio/aac", ext: "aac" };
    }
    if (mime === "audio/webm") {
        return { mime: "audio/webm", ext: "webm" };
    }
    if (mime === "audio/mpeg" || mime === "audio/mp3") {
        return { mime: "audio/mpeg", ext: "mp3" };
    }

    const cleanPath = String(sourceUrl || "").split("?")[0].split("#")[0].toLowerCase();
    if (cleanPath.endsWith(".wav")) return { mime: "audio/wav", ext: "wav" };
    if (cleanPath.endsWith(".ogg") || cleanPath.endsWith(".opus")) return { mime: "audio/ogg", ext: "ogg" };
    if (cleanPath.endsWith(".flac")) return { mime: "audio/flac", ext: "flac" };
    if (cleanPath.endsWith(".m4a")) return { mime: "audio/mp4", ext: "m4a" };
    if (cleanPath.endsWith(".aac")) return { mime: "audio/aac", ext: "aac" };
    if (cleanPath.endsWith(".webm") || cleanPath.endsWith(".weba")) return { mime: "audio/webm", ext: "webm" };
    return { mime: "audio/mpeg", ext: "mp3" };
}

function makeRandomSuffix() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID().replace(/-/g, "").slice(0, 10);
    }
    return Math.random().toString(36).slice(2, 12);
}

export async function persistGeneratedAudio({
    sourceUrl,
    userId,
    supabaseUrl,
    serviceKey,
    fetchImpl = globalThis.fetch
} = {}) {
    const rawUrl = String(sourceUrl || "").trim();
    if (!rawUrl) {
        return "";
    }
    if (isPrivateMediaRef(rawUrl)) {
        return rawUrl;
    }

    const cleanUserId = String(userId || "").trim();
    const cleanSupabaseUrl = String(supabaseUrl || "").trim().replace(/\/+$/, "");
    const cleanServiceKey = String(serviceKey || "").trim();

    if (
        !cleanUserId ||
        !/^[A-Za-z0-9._-]+$/.test(cleanUserId) ||
        !cleanSupabaseUrl ||
        !cleanServiceKey ||
        typeof fetchImpl !== "function"
    ) {
        return /^(?:https?:\/\/|data:audio\/)/i.test(rawUrl) ? rawUrl : "";
    }

    try {
        let bytes = null;
        let mimeHint = "";

        const dataMatch = /^data:(audio\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(rawUrl);
        if (dataMatch) {
            mimeHint = dataMatch[1].toLowerCase();
            bytes = decodeBase64ToBytes(dataMatch[2]);
        } else if (/^https?:\/\//i.test(rawUrl)) {
            const controller = typeof AbortController === "function" ? new AbortController() : null;
            const timer = controller
                ? setTimeout(() => controller.abort(), FETCH_AUDIO_TIMEOUT_MS)
                : null;
            try {
                const resp = await fetchImpl(rawUrl, {
                    method: "GET",
                    ...(controller ? { signal: controller.signal } : {})
                });
                if (!resp.ok) {
                    return rawUrl;
                }
                mimeHint = String(resp.headers?.get?.("content-type") || "").trim();
                const buf = await resp.arrayBuffer();
                bytes = new Uint8Array(buf);
            } finally {
                if (timer) clearTimeout(timer);
            }
        } else {
            return "";
        }

        if (!bytes || bytes.byteLength < 32 || bytes.byteLength > MAX_PERSIST_AUDIO_BYTES) {
            return /^https?:\/\//i.test(rawUrl) ? rawUrl : "";
        }

        const detected = detectAudioTypeFromBytes(bytes, mimeHint, rawUrl);
        const objectPath = `upscale-videos/outputs/${cleanUserId}/genaud-${Date.now()}-${makeRandomSuffix()}.${detected.ext}`;
        const encodedPath = objectPath
            .split("/")
            .map(segment => encodeURIComponent(segment))
            .join("/");

        const uploadResp = await fetchImpl(
            `${cleanSupabaseUrl}/storage/v1/object/${UPLOAD_BUCKET}/${encodedPath}`,
            {
                method: "POST",
                headers: {
                    apikey: cleanServiceKey,
                    Authorization: `Bearer ${cleanServiceKey}`,
                    "Content-Type": detected.mime,
                    "x-upsert": "true"
                },
                body: bytes
            }
        );

        if (!uploadResp.ok) {
            return /^https?:\/\//i.test(rawUrl) ? rawUrl : "";
        }

        return buildPrivateMediaRef({
            bucket: UPLOAD_BUCKET,
            objectPath
        });
    } catch (err) {
        console.warn("[persist-generated-audio] Fallback ke URL asli:", err?.message || err);
        return /^https?:\/\//i.test(rawUrl) ? rawUrl : "";
    }
}

export async function persistGeneratedPodcastAudio({
    sourceUrls = [],
    userId,
    supabaseUrl,
    serviceKey,
    pauseMs = 320,
    fetchImpl = globalThis.fetch
} = {}) {
    const cleanUrls = (Array.isArray(sourceUrls) ? sourceUrls : [sourceUrls])
        .map(u => String(u || "").trim())
        .filter(Boolean);

    if (cleanUrls.length === 0) return "";
    if (cleanUrls.length === 1) {
        return persistGeneratedAudio({
            sourceUrl: cleanUrls[0],
            userId,
            supabaseUrl,
            serviceKey,
            fetchImpl
        });
    }

    const cleanUserId = String(userId || "").trim();
    const cleanSupabaseUrl = String(supabaseUrl || "").trim().replace(/\/+$/, "");
    const cleanServiceKey = String(serviceKey || "").trim();
    const hasStorageConfig = Boolean(
        cleanUserId &&
        /^[A-Za-z0-9._-]+$/.test(cleanUserId) &&
        cleanSupabaseUrl &&
        cleanServiceKey
    );

    if (typeof fetchImpl !== "function") {
        return cleanUrls[0] || "";
    }

    try {
        const downloaded = await Promise.all(
            cleanUrls.map(async rawUrl => {
                const dataMatch = /^data:(audio\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(rawUrl);
                if (dataMatch) {
                    return decodeBase64ToBytes(dataMatch[2]);
                }
                const controller = typeof AbortController === "function" ? new AbortController() : null;
                const timer = controller ? setTimeout(() => controller.abort(), FETCH_AUDIO_TIMEOUT_MS) : null;
                try {
                    const resp = await fetchImpl(rawUrl, {
                        method: "GET",
                        ...(controller ? { signal: controller.signal } : {})
                    });
                    if (!resp.ok) {
                        throw new Error(`HTTP ${resp.status} saat mengunduh segmen podcast.`);
                    }
                    const buf = await resp.arrayBuffer();
                    return new Uint8Array(buf);
                } finally {
                    if (timer) clearTimeout(timer);
                }
            })
        );

        const validBuffers = downloaded.filter(b => b instanceof Uint8Array && b.byteLength >= 32);
        if (validBuffers.length === 0) return cleanUrls[0] || "";

        const merged = concatAudioClips(validBuffers, { pauseMs });
        if (!merged?.bytes || merged.bytes.byteLength > MAX_PERSIST_AUDIO_BYTES) {
            return cleanUrls[0] || "";
        }

        if (!hasStorageConfig) {
            return `data:${merged.mimeType};base64,${encodeBytesToBase64(merged.bytes)}`;
        }

        const objectPath = `upscale-videos/outputs/${cleanUserId}/genpod-${Date.now()}-${makeRandomSuffix()}.${merged.ext}`;
        const encodedPath = objectPath
            .split("/")
            .map(segment => encodeURIComponent(segment))
            .join("/");

        const uploadResp = await fetchImpl(
            `${cleanSupabaseUrl}/storage/v1/object/${UPLOAD_BUCKET}/${encodedPath}`,
            {
                method: "POST",
                headers: {
                    apikey: cleanServiceKey,
                    Authorization: `Bearer ${cleanServiceKey}`,
                    "Content-Type": merged.mimeType,
                    "x-upsert": "true"
                },
                body: merged.bytes
            }
        );

        if (!uploadResp.ok) {
            return `data:${merged.mimeType};base64,${encodeBytesToBase64(merged.bytes)}`;
        }

        return buildPrivateMediaRef({
            bucket: UPLOAD_BUCKET,
            objectPath
        });
    } catch (err) {
        console.warn("[persist-generated-podcast] Gagal menggabungkan segmen podcast:", err?.message || err);
        return persistGeneratedAudio({
            sourceUrl: cleanUrls[0],
            userId,
            supabaseUrl,
            serviceKey,
            fetchImpl
        });
    }
}

export async function persistGeneratedTranscript({
    transcript,
    sourceUrl = "",
    userId,
    supabaseUrl,
    serviceKey,
    fetchImpl = globalThis.fetch
} = {}) {
    const normalized = normalizeTranscriptPayload(transcript, {
        diarize: transcript?.diarize !== false
    });
    if (!normalized) {
        return String(sourceUrl || "").trim();
    }

    const cleanUserId = String(userId || "").trim();
    const cleanSupabaseUrl = String(supabaseUrl || "").trim().replace(/\/+$/, "");
    const cleanServiceKey = String(serviceKey || "").trim();

    const payloadJson = JSON.stringify({
        ...normalized,
        createdAt: new Date().toISOString()
    });

    if (
        !cleanUserId ||
        !/^[A-Za-z0-9._-]+$/.test(cleanUserId) ||
        !cleanSupabaseUrl ||
        !cleanServiceKey ||
        typeof fetchImpl !== "function"
    ) {
        return `data:application/json;base64,${encodeTextToBase64(payloadJson)}`;
    }

    try {
        const bytes = new TextEncoder().encode(payloadJson);
        const objectPath = `upscale-videos/outputs/${cleanUserId}/gentrx-${Date.now()}-${makeRandomSuffix()}.json`;
        const encodedPath = objectPath
            .split("/")
            .map(segment => encodeURIComponent(segment))
            .join("/");

        const uploadResp = await fetchImpl(
            `${cleanSupabaseUrl}/storage/v1/object/${UPLOAD_BUCKET}/${encodedPath}`,
            {
                method: "POST",
                headers: {
                    apikey: cleanServiceKey,
                    Authorization: `Bearer ${cleanServiceKey}`,
                    "Content-Type": "application/json; charset=utf-8",
                    "x-upsert": "true"
                },
                body: bytes
            }
        );

        if (!uploadResp.ok) {
            return `data:application/json;base64,${encodeTextToBase64(payloadJson)}`;
        }

        return buildPrivateMediaRef({
            bucket: UPLOAD_BUCKET,
            objectPath
        });
    } catch (err) {
        console.warn("[persist-generated-transcript] Fallback ke data URL JSON:", err?.message || err);
        return `data:application/json;base64,${encodeTextToBase64(payloadJson)}`;
    }
}
