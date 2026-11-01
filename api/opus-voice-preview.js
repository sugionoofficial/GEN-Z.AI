/* =========================================================
   GEN-Z.AI — FREE CACHED OPUS TTS VOICE PREVIEW API
   ---------------------------------------------------------
   File:
     api/opus-voice-preview.js

   GET / POST `/api/opus-voice-preview?voice=Sulafat`
   - Gratis (0 potong kredit pengguna GEN-Z.AI).
   - Wajib login (JWT Supabase).
   - Menggunakan cache permanen di Supabase Storage:
       user-uploads/voice-previews/opus/<voiceLower>.mp3
     sehingga setiap karakter suara cukup di-generate 1x saja
     untuk seluruh pengguna platform.
========================================================= */

import { OPUS_SPEECH_VOICE_IDS } from "../models/opus-audio/specs.js";
import { createAudioTask, getAudioTask } from "../provider/opus/client.js";
import { UPLOAD_BUCKET } from "../lib/generate/upscale-source.js";
import {
    authenticateSupabaseUser,
    loadOpusCredentialPayload,
    resolveRuntimeEnv
} from "../lib/opus/load-opus-credential.js";

const PREVIEW_POLL_ATTEMPTS = 10;
const PREVIEW_POLL_INTERVAL_MS = 1600;
const SIGNED_URL_EXPIRES_SEC = 3600;

function sendJson(res, status, body) {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "private, max-age=300");
    return res.end(JSON.stringify(body));
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function encodeStoragePath(objectPath) {
    return String(objectPath || "")
        .split("/")
        .map(seg => encodeURIComponent(seg))
        .join("/");
}

async function signCachedVoiceObject(supabaseUrl, serviceKey, objectPath, fetchImpl = globalThis.fetch) {
    const encodedPath = encodeStoragePath(objectPath);
    const signResp = await fetchImpl(
        `${supabaseUrl}/storage/v1/object/sign/${UPLOAD_BUCKET}/${encodedPath}`,
        {
            method: "POST",
            headers: {
                apikey: serviceKey,
                Authorization: `Bearer ${serviceKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ expiresIn: SIGNED_URL_EXPIRES_SEC })
        }
    );
    if (!signResp.ok) return "";
    const data = await signResp.json().catch(() => null);
    const rawSigned = String(data?.signedURL || data?.signedUrl || "").trim();
    if (!rawSigned) return "";
    if (/^https?:\/\//i.test(rawSigned)) return rawSigned;
    return `${supabaseUrl}/storage/v1${rawSigned.startsWith("/") ? "" : "/"}${rawSigned}`;
}

async function checkCachedVoicePreview(supabaseUrl, serviceKey, voiceLower, fetchImpl = globalThis.fetch) {
    for (const ext of ["mp3", "wav"]) {
        const objectPath = `voice-previews/opus/${voiceLower}.${ext}`;
        const encodedPath = encodeStoragePath(objectPath);
        const headResp = await fetchImpl(
            `${supabaseUrl}/storage/v1/object/${UPLOAD_BUCKET}/${encodedPath}`,
            {
                method: "HEAD",
                headers: {
                    apikey: serviceKey,
                    Authorization: `Bearer ${serviceKey}`
                }
            }
        );
        if (headResp.ok) {
            const signedUrl = await signCachedVoiceObject(supabaseUrl, serviceKey, objectPath, fetchImpl);
            if (signedUrl) {
                return signedUrl;
            }
        }
    }
    return "";
}

export function buildVoicePreviewSampleText(voiceName) {
    return `Halo! Kenalkan, ini contoh karakter suara ${voiceName} di Studio GEN-Z AI.`;
}

export default async function handler(req, res) {
    if (req.method !== "GET" && req.method !== "POST") {
        res.setHeader("Allow", "GET, POST");
        return sendJson(res, 405, {
            success: false,
            error: "Method tidak diizinkan."
        });
    }

    const env = resolveRuntimeEnv(req);
    const auth = await authenticateSupabaseUser(req, env, { requireAdminOrOwner: false });
    if (!auth.ok) {
        return sendJson(res, auth.status, {
            success: false,
            error: auth.error
        });
    }

    const url = new URL(req.url || "/api/opus-voice-preview", "https://genzai.local");
    const rawVoice = String(
        req.query?.voice ||
        url.searchParams.get("voice") ||
        req.body?.voice ||
        ""
    ).trim();

    const canonicalVoice = OPUS_SPEECH_VOICE_IDS.find(
        v => v.toLowerCase() === rawVoice.toLowerCase()
    );

    if (!canonicalVoice) {
        return sendJson(res, 400, {
            success: false,
            error: `Karakter suara "${rawVoice || "(kosong)"}" tidak valid. Pilih salah satu dari 30 karakter resmi Opus.`
        });
    }

    const voiceLower = canonicalVoice.toLowerCase();

    try {
        const cachedSignedUrl = await checkCachedVoicePreview(
            auth.supabaseUrl,
            auth.serviceKey,
            voiceLower
        );
        if (cachedSignedUrl) {
            return sendJson(res, 200, {
                success: true,
                voice: canonicalVoice,
                cached: true,
                credits_charged: 0,
                preview_url: cachedSignedUrl
            });
        }

        const opusApiKey = await loadOpusCredentialPayload(env);
        if (!opusApiKey) {
            return sendJson(res, 503, {
                success: false,
                error: "Kredensial Opus Labs belum terkonfigurasi di server."
            });
        }

        const sampleText = buildVoicePreviewSampleText(canonicalVoice);
        const created = await createAudioTask(
            {
                opus_model: "gemini-3.8-flash-tts",
                media_type: "audio",
                audio_type: "speech",
                prompt: sampleText,
                text: sampleText,
                voice: canonicalVoice
            },
            opusApiKey,
            { env }
        );

        let audioSourceUrl =
            (Array.isArray(created?.audioUrls) && created.audioUrls[0]) ||
            (Array.isArray(created?.outputUrls) && created.outputUrls[0]) ||
            "";

        if (!audioSourceUrl && created?.taskId) {
            for (let attempt = 0; attempt < PREVIEW_POLL_ATTEMPTS; attempt += 1) {
                await sleep(PREVIEW_POLL_INTERVAL_MS);
                const polled = await getAudioTask(created.taskId, opusApiKey, { env });
                if (polled?.status === "FAILED") {
                    throw new Error(polled.errorMessage || "Gagal membuat sampel suara preview Opus.");
                }
                const candidate =
                    (Array.isArray(polled?.audioUrls) && polled.audioUrls[0]) ||
                    (Array.isArray(polled?.outputUrls) && polled.outputUrls[0]) ||
                    "";
                if (polled?.status === "COMPLETED" && candidate) {
                    audioSourceUrl = candidate;
                    break;
                }
            }
        }

        if (!audioSourceUrl) {
            return sendJson(res, 504, {
                success: false,
                error: "Sampel suara masih diproses oleh Opus Labs. Silakan klik Preview Suara sekali lagi."
            });
        }

        const audioResp = await fetch(audioSourceUrl, { method: "GET" });
        if (!audioResp.ok) {
            return sendJson(res, 200, {
                success: true,
                voice: canonicalVoice,
                cached: false,
                credits_charged: 0,
                preview_url: audioSourceUrl
            });
        }

        const bytes = new Uint8Array(await audioResp.arrayBuffer());
        const isWav =
            bytes.length >= 12 &&
            bytes[0] === 0x52 &&
            bytes[1] === 0x49 &&
            bytes[2] === 0x46 &&
            bytes[3] === 0x46;
        const ext = isWav ? "wav" : "mp3";
        const contentType = isWav ? "audio/wav" : "audio/mpeg";
        const cachePath = `voice-previews/opus/${voiceLower}.${ext}`;
        const encodedCachePath = encodeStoragePath(cachePath);

        const uploadResp = await fetch(
            `${auth.supabaseUrl}/storage/v1/object/${UPLOAD_BUCKET}/${encodedCachePath}`,
            {
                method: "POST",
                headers: {
                    apikey: auth.serviceKey,
                    Authorization: `Bearer ${auth.serviceKey}`,
                    "Content-Type": contentType,
                    "x-upsert": "true"
                },
                body: bytes
            }
        );

        if (uploadResp.ok) {
            const signedUrl = await signCachedVoiceObject(auth.supabaseUrl, auth.serviceKey, cachePath);
            if (signedUrl) {
                return sendJson(res, 200, {
                    success: true,
                    voice: canonicalVoice,
                    cached: false,
                    credits_charged: 0,
                    preview_url: signedUrl
                });
            }
        }

        return sendJson(res, 200, {
            success: true,
            voice: canonicalVoice,
            cached: false,
            credits_charged: 0,
            preview_url: audioSourceUrl
        });
    } catch (error) {
        console.error("[opus-voice-preview] Error:", error);
        return sendJson(res, 502, {
            success: false,
            error: error?.message || "Gagal memuat sampel suara Opus."
        });
    }
}
