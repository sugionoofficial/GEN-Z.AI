/* =========================================================
   GEN-Z.AI
   CLOUDFLARE WORKER — FACEBOOK, TIKTOK & THREADS MEDIA HANDLER
   ---------------------------------------------------------
   File:
   functions/_shared/fb-media-handler.js

   Endpoint:
   POST /api/fb-media-download
   POST /api/social-media-download

   Alur:
   1. Verifikasi sesi pengguna Supabase (Bearer token)
   2. Deteksi platform tautan:
      - Facebook -> https://getmyfb.com/process
      - TikTok   -> https://ssstik.io/abc?url=dl
      - Threads  -> https://www.threadsdownloader.com/
   3. Unduh dan teruskan stream biner media (video/image/audio)
      langsung ke browser supaya bisa disimpan ke user-uploads
      dan dipotong (cut video/audio) sebelum dipakai sebagai
      media referensi.
========================================================= */

import {
    downloadResolvedFacebookMedia,
    isFacebookMediaUrl,
    resolveFacebookMediaViaGetMyFb
} from "../../lib/fb-media/getmyfb.js";

import {
    downloadResolvedTikTokMedia,
    isTikTokMediaUrl,
    resolveTikTokMediaViaSsstik
} from "../../lib/tiktok-media/ssstik.js";

import {
    downloadResolvedThreadsMedia,
    isThreadsMediaUrl,
    resolveThreadsMediaViaDownloader
} from "../../lib/threads-media/threadsdownloader.js";

function jsonResponse(payload, status = 200) {
    return Response.json(payload, {
        status,
        headers: {
            "Cache-Control": "no-store"
        }
    });
}

async function authenticateUser(request, env, fetchImpl = fetch) {
    const supabaseUrl = String(env?.SUPABASE_URL || "").replace(/\/+$/, "");
    const anonKey = String(env?.SUPABASE_ANON_KEY || env?.SUPABASE_KEY || "").trim();
    const authorization = String(request.headers.get("Authorization") || "");
    const tokenMatch = authorization.match(/^Bearer\s+(.+)$/i);

    if (!tokenMatch || !tokenMatch[1]?.trim()) {
        return {
            error: "Silakan login terlebih dahulu untuk memproses link Facebook, TikTok, atau Threads.",
            status: 401
        };
    }

    if (!supabaseUrl || !anonKey) {
        return {
            error: "Konfigurasi autentikasi Supabase belum lengkap di server.",
            status: 500
        };
    }

    const response = await fetchImpl(`${supabaseUrl}/auth/v1/user`, {
        headers: {
            "apikey": anonKey,
            "Authorization": `Bearer ${tokenMatch[1].trim()}`
        }
    });

    if (!response.ok) {
        return {
            error: "Sesi login tidak valid atau sudah berakhir. Silakan muat ulang halaman.",
            status: 401
        };
    }

    const user = await response.json().catch(() => null);
    if (!user?.id) {
        return {
            error: "Akun pengguna tidak ditemukan.",
            status: 401
        };
    }

    return { user };
}

export default async function handleFbMediaDownload(request, env, { fetchImpl = fetch } = {}) {
    if (request.method !== "POST") {
        return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const auth = await authenticateUser(request, env, fetchImpl);
    if (auth.error) {
        return jsonResponse({ error: auth.error }, auth.status || 401);
    }

    let body = null;
    try {
        body = await request.json();
    } catch {
        return jsonResponse({ error: "Payload JSON tidak valid." }, 400);
    }

    const rawUrl = String(body?.url || "").trim();
    const kind = String(body?.kind || "video").trim().toLowerCase();

    if (!rawUrl) {
        return jsonResponse({ error: "Masukkan link Facebook, TikTok, atau Threads terlebih dahulu." }, 400);
    }

    if (!["video", "image", "audio"].includes(kind)) {
        return jsonResponse({ error: "Jenis media referensi tidak didukung." }, 400);
    }

    const isFacebook = isFacebookMediaUrl(rawUrl);
    const isTikTok = !isFacebook && isTikTokMediaUrl(rawUrl);
    const isThreads = !isFacebook && !isTikTok && isThreadsMediaUrl(rawUrl);

    if (!isFacebook && !isTikTok && !isThreads) {
        return jsonResponse({
            error: "URL tidak didukung untuk tombol Proses. Gunakan link Facebook (facebook.com / fb.watch), TikTok (tiktok.com / vt.tiktok.com), atau Threads (threads.com / threads.net)."
        }, 400);
    }

    const provider = isTikTok ? "tiktok" : isThreads ? "threads" : "facebook";

    try {
        let downloaded;
        if (isTikTok) {
            const resolved = await resolveTikTokMediaViaSsstik(rawUrl, {
                kind,
                fetchImpl
            });
            downloaded = await downloadResolvedTikTokMedia(resolved.candidates, {
                kind,
                fetchImpl
            });
        } else if (isThreads) {
            const resolved = await resolveThreadsMediaViaDownloader(rawUrl, {
                kind,
                turnstileToken: String(env?.THREADS_TURNSTILE_TOKEN || "").trim(),
                fetchImpl
            });
            downloaded = await downloadResolvedThreadsMedia(resolved.candidates, {
                kind,
                fetchImpl
            });
        } else {
            const resolved = await resolveFacebookMediaViaGetMyFb(rawUrl, {
                kind,
                fetchImpl
            });
            downloaded = await downloadResolvedFacebookMedia(resolved.candidates, {
                kind,
                fetchImpl
            });
        }

        const headers = new Headers({
            "Content-Type": downloaded.contentType,
            "Cache-Control": "no-store",
            "X-FB-Media-Filename": downloaded.filename,
            "X-FB-Media-Source": downloaded.source,
            "X-FB-Media-Quality": encodeURIComponent(downloaded.quality || ""),
            "X-FB-Media-Needs-Audio-Extract": downloaded.needsClientAudioExtract ? "1" : "0",
            "X-Social-Media-Provider": provider
        });

        if (downloaded.contentLength) {
            headers.set("Content-Length", String(downloaded.contentLength));
        }

        return new Response(downloaded.body, {
            status: 200,
            headers
        });
    } catch (error) {
        const status = Number.isInteger(error?.status) && error.status >= 400 && error.status < 600
            ? error.status
            : 502;
        const defaultMsg = isTikTok
            ? "Gagal memproses link TikTok lewat SSSTik."
            : isThreads
                ? "Gagal memproses link Threads lewat ThreadsDownloader."
                : "Gagal memproses link Facebook lewat GetMyFB.";
        return jsonResponse({
            error: String(error?.message || defaultMsg)
        }, status);
    }
}
