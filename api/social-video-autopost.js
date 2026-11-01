/* =========================================================
   GEN-Z.AI — MULTI-USER SOCIAL VIDEO AUTO POST API
   ---------------------------------------------------------
   File:
     api/social-video-autopost.js

   Endpoint publik terotentikasi (`/api/social-video-autopost`)
   untuk SELURUH user login GEN-Z.AI (role `user`, `admin`, `owner`):
   - `bootstrap`         : Info akun medsos user, tarif kredit, riwayat post,
                           video History siap pakai, & status OAuth platform.
   - `oauth_start`       : Mulai login OAuth PKCE ke Facebook / YouTube / TikTok.
   - `list_accounts`     : Daftar akun FB / YouTube / TikTok milik user sendiri.
   - `disconnect_account`: Putuskan akun medsos milik user sendiri.
   - `create_upload_url` : Buat Signed Upload URL MP4 langsung ke bucket privat
                           `user-uploads/social-video/<user_id>/...`.
   - `sign_preview`      : Buat Signed Preview URL untuk `supabase-private://...` milik user.
   - `list_history_videos`: Daftar video hasil Generate / Motion UI milik user sendiri.
   - `generate_ai_caption`: Buat judul, caption, & hashtag viral otomatis (Workers AI + fallback).
   - `create_posts`      : Publish langsung (potong kredit per post + auto-refund jika gagal)
                           atau jadwalkan Auto Post ke antrean cron.
   - `list_posts`        : Daftar jadwal & riwayat Auto Post milik user sendiri.
   - `cancel_post`       : Batalkan jadwal Auto Post yang masih berstatus `scheduled`.
========================================================= */

import crypto from "node:crypto";
import {
    authenticateSupabaseUser,
    resolveRuntimeEnv
} from "../lib/opus/load-opus-credential.js";
import { buildPrivateMediaRef, isPrivateMediaRef } from "../lib/generate/private-media.js";
import {
    loadSocialVideoOAuthAppsConfig,
    resolveSocialVideoRedirectUri
} from "../lib/social-video/app-credentials.js";
import {
    assertSafePublicVideoUrl,
    buildPlatformAuthorizeUrl,
    executeSocialVideoPostRow,
    fetchSocialPostFeatureCost,
    generateOAuthStateAndPkce,
    signPrivateVideoReference
} from "../lib/social-video/publisher.js";

const SUPPORTED_PLATFORMS = new Set(["facebook", "youtube", "tiktok"]);
const SUPPORTED_PRIVACY = new Set([
    "public",
    "unlisted",
    "private",
    "self_only",
    "inbox_draft"
]);
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sendJson(res, status, payload) {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    return res.end(JSON.stringify(payload));
}

function parseJsonBody(req) {
    if (req?.body && typeof req.body === "object") return req.body;
    if (typeof req?.body === "string" && req.body.trim()) {
        try {
            return JSON.parse(req.body);
        } catch {
            return {};
        }
    }
    return {};
}

function encodeStoragePath(objectPath) {
    return String(objectPath || "")
        .split("/")
        .filter(Boolean)
        .map(seg => encodeURIComponent(seg))
        .join("/");
}

async function fetchUserProfile(supabaseUrl, serviceKey, userId, fetchImpl) {
    const qs = new URLSearchParams({
        select: "id,role,credits",
        id: `eq.${userId}`,
        limit: "1"
    });
    const resp = await fetchImpl(`${supabaseUrl}/rest/v1/profiles?${qs.toString()}`, {
        method: "GET",
        headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`
        }
    });
    if (!resp.ok) return { role: "user", credits: 0 };
    const rows = await resp.json().catch(() => []);
    const row = Array.isArray(rows) ? rows[0] : null;
    return {
        role: String(row?.role || "user").trim().toLowerCase(),
        credits: Number(row?.credits ?? 0)
    };
}

async function fetchUserConnectedAccounts(supabaseUrl, serviceKey, userId, fetchImpl) {
    const qs = new URLSearchParams({
        select: "id,platform,external_account_id,account_name,account_handle,avatar_url,status,updated_at",
        user_id: `eq.${userId}`,
        order: "created_at.desc"
    });
    const resp = await fetchImpl(
        `${supabaseUrl}/rest/v1/social_video_accounts?${qs.toString()}`,
        {
            method: "GET",
            headers: {
                apikey: serviceKey,
                Authorization: `Bearer ${serviceKey}`
            }
        }
    );
    if (!resp.ok) return [];
    const rows = await resp.json().catch(() => []);
    return Array.isArray(rows) ? rows : [];
}

async function fetchUserPosts(supabaseUrl, serviceKey, userId, fetchImpl, limit = 30) {
    const qs = new URLSearchParams({
        select: "id,account_id,platform,video_source_type,video_ref,title,caption,hashtags,privacy_level,scheduled_for,status,credit_cost,credit_refunded,remote_post_id,remote_post_url,error_message,published_at,created_at",
        user_id: `eq.${userId}`,
        order: "created_at.desc",
        limit: String(limit)
    });
    const resp = await fetchImpl(
        `${supabaseUrl}/rest/v1/social_video_posts?${qs.toString()}`,
        {
            method: "GET",
            headers: {
                apikey: serviceKey,
                Authorization: `Bearer ${serviceKey}`
            }
        }
    );
    if (!resp.ok) return [];
    const rows = await resp.json().catch(() => []);
    return Array.isArray(rows) ? rows : [];
}

function looksLikeVideoResult(row = {}) {
    const url = String(row.result_url || "").trim().toLowerCase();
    const model = `${row.model_id || ""} ${row.model_name || ""}`.toLowerCase();
    if (!url) return false;
    if (/\.(png|jpg|jpeg|webp|gif|mp3|wav|ogg|m4a|flac)(\?|$)/i.test(url)) {
        return false;
    }
    if (/\.(mp4|mov|webm|m4v)(\?|$)/i.test(url)) {
        return true;
    }
    if (/video|seedance|veo|wan|kling|sora|hailuo|vidu|motion|upscale-video|director/i.test(model)) {
        return true;
    }
    return false;
}

async function fetchUserHistoryVideos(supabaseUrl, serviceKey, userId, fetchImpl) {
    const results = [];

    try {
        const histQs = new URLSearchParams({
            select: "id,model_id,model_name,prompt,result_url,created_at,status",
            user_id: `eq.${userId}`,
            status: "eq.completed",
            result_url: "not.is.null",
            order: "created_at.desc",
            limit: "25"
        });
        const histResp = await fetchImpl(
            `${supabaseUrl}/rest/v1/generation_history?${histQs.toString()}`,
            {
                method: "GET",
                headers: {
                    apikey: serviceKey,
                    Authorization: `Bearer ${serviceKey}`
                }
            }
        );
        if (histResp.ok) {
            const rows = await histResp.json().catch(() => []);
            if (Array.isArray(rows)) {
                for (const row of rows) {
                    if (!looksLikeVideoResult(row)) continue;
                    results.push({
                        id: `hist_${row.id}`,
                        source: "history",
                        label: `${row.model_name || row.model_id || "Video AI"} — ${String(row.prompt || "Tanpa judul").slice(0, 52)}`,
                        title: String(row.prompt || row.model_name || "Video AI").slice(0, 80),
                        video_ref: String(row.result_url),
                        created_at: row.created_at
                    });
                }
            }
        }
    } catch {
        /* ignore */
    }

    try {
        const muiQs = new URLSearchParams({
            select: "id,template_id,brand_name,headline,result_url,created_at,status",
            user_id: `eq.${userId}`,
            status: "eq.completed",
            result_url: "not.is.null",
            order: "created_at.desc",
            limit: "15"
        });
        const muiResp = await fetchImpl(
            `${supabaseUrl}/rest/v1/motion_ui_jobs?${muiQs.toString()}`,
            {
                method: "GET",
                headers: {
                    apikey: serviceKey,
                    Authorization: `Bearer ${serviceKey}`
                }
            }
        );
        if (muiResp.ok) {
            const rows = await muiResp.json().catch(() => []);
            if (Array.isArray(rows)) {
                for (const row of rows) {
                    if (!row.result_url) continue;
                    results.push({
                        id: `mui_${row.id}`,
                        source: "motion_ui",
                        label: `Motion UI (${row.brand_name || row.template_id}) — ${String(row.headline || "").slice(0, 48)}`,
                        title: String(row.headline || row.brand_name || "Motion UI Video").slice(0, 80),
                        video_ref: String(row.result_url),
                        created_at: row.created_at
                    });
                }
            }
        }
    } catch {
        /* ignore */
    }

    return results.slice(0, 30);
}

async function generateViralSocialCopy({ topic, platforms = [], env = {} }) {
    const cleanTopic = String(topic || "Konten video kreatif & edukatif AI").trim().slice(0, 300);
    const platText = platforms.length > 0 ? platforms.join(", ").toUpperCase() : "Facebook Reels, YouTube Shorts, TikTok";

    if (env?.AI && typeof env.AI.run === "function") {
        try {
            const aiResp = await env.AI.run("@cf/meta/llama-3.1-8b-instruct-fp8", {
                messages: [
                    {
                        role: "system",
                        content:
                            "Kamu adalah spesialis konten viral Indonesia untuk Facebook Reels, YouTube Shorts, dan TikTok. " +
                            "Balas HANYA dalam format JSON murni satu objek: {\"title\":\"...\",\"caption\":\"...\",\"hashtags\":\"#tag1 #tag2 #tag3 #shorts #fyp\"}."
                    },
                    {
                        role: "user",
                        content: `Buatkan judul singkat menarik (maks 70 karakter), caption engaging Bahasa Indonesia (2-3 kalimat), dan 6 hashtag populer untuk platform ${platText} tentang topik: ${cleanTopic}`
                    }
                ],
                max_tokens: 320
            });
            const rawText = String(aiResp?.response || "").trim();
            const jsonMatch = rawText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                if (parsed?.title || parsed?.caption) {
                    return {
                        title: String(parsed.title || cleanTopic).slice(0, 90),
                        caption: String(parsed.caption || cleanTopic).slice(0, 1200),
                        hashtags: String(parsed.hashtags || "#shorts #reels #tiktok #fyp #viral #ai").slice(0, 250)
                    };
                }
            }
        } catch {
            /* fallback deterministic */
        }
    }

    const shortHeadline = cleanTopic.length > 68 ? `${cleanTopic.slice(0, 65)}...` : cleanTopic;
    return {
        title: `${shortHeadline} #Shorts`,
        caption: `${cleanTopic}\n\nTonton sampai habis dan tulis pendapatmu di kolom komentar! Jangan lupa follow & share supaya tidak ketinggalan update berikutnya.`,
        hashtags: "#shorts #reels #tiktokindonesia #fyp #viral #genzai"
    };
}

export default async function handler(req, res) {
    if (req.method !== "GET" && req.method !== "POST") {
        res.setHeader("Allow", "GET, POST");
        return sendJson(res, 405, { success: false, error: "Method tidak diizinkan." });
    }

    const env = resolveRuntimeEnv(req);
    const fetchImpl = req?.fetchImpl || globalThis.fetch;
    const supabaseUrl = String(env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
    const serviceKey = String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

    if (!supabaseUrl || !serviceKey) {
        return sendJson(res, 500, {
            success: false,
            error: "Konfigurasi SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum lengkap."
        });
    }

    const auth = await authenticateSupabaseUser(req, env, {
        requireAdminOrOwner: false,
        fetchImpl
    });
    if (!auth.ok) {
        return sendJson(res, auth.status, {
            success: false,
            error: auth.error
        });
    }

    const body = parseJsonBody(req);
    const url = new URL(req.url || "/api/social-video-autopost", "https://genzai.local");
    const action = String(body.action || url.searchParams.get("action") || "bootstrap")
        .trim()
        .toLowerCase();

    const userId = auth.user.id;
    const redirectUri = resolveSocialVideoRedirectUri(req, env);

    try {
        if (action === "bootstrap") {
            const [profile, creditCost, appsCfg, accounts, posts, historyVideos] = await Promise.all([
                fetchUserProfile(supabaseUrl, serviceKey, userId, fetchImpl),
                fetchSocialPostFeatureCost(supabaseUrl, serviceKey, fetchImpl),
                loadSocialVideoOAuthAppsConfig(env, { fetchImpl }),
                fetchUserConnectedAccounts(supabaseUrl, serviceKey, userId, fetchImpl),
                fetchUserPosts(supabaseUrl, serviceKey, userId, fetchImpl, 25),
                fetchUserHistoryVideos(supabaseUrl, serviceKey, userId, fetchImpl)
            ]);

            return sendJson(res, 200, {
                success: true,
                viewer: {
                    id: userId,
                    email: auth.user.email,
                    role: profile.role,
                    credits: profile.credits,
                    isAdminOrOwner: profile.role === "admin" || profile.role === "owner"
                },
                creditCost,
                redirectUri,
                platformsConfigured: {
                    facebook: appsCfg.facebook.configured,
                    youtube: appsCfg.youtube.configured,
                    tiktok: appsCfg.tiktok.configured
                },
                accounts,
                posts,
                historyVideos
            });
        }

        if (action === "list_accounts") {
            const accounts = await fetchUserConnectedAccounts(supabaseUrl, serviceKey, userId, fetchImpl);
            return sendJson(res, 200, { success: true, accounts });
        }

        if (action === "disconnect_account") {
            if (req.method !== "POST") {
                return sendJson(res, 405, { success: false, error: "Gunakan POST." });
            }
            const accountId = String(body.accountId || "").trim();
            if (!UUID_REGEX.test(accountId)) {
                return sendJson(res, 400, { success: false, error: "ID akun medsos tidak valid." });
            }

            await fetchImpl(
                `${supabaseUrl}/rest/v1/social_video_accounts?id=eq.${encodeURIComponent(accountId)}&user_id=eq.${encodeURIComponent(userId)}`,
                {
                    method: "DELETE",
                    headers: {
                        apikey: serviceKey,
                        Authorization: `Bearer ${serviceKey}`
                    }
                }
            );
            const accounts = await fetchUserConnectedAccounts(supabaseUrl, serviceKey, userId, fetchImpl);
            return sendJson(res, 200, {
                success: true,
                message: "Akun medsos berhasil diputuskan.",
                accounts
            });
        }

        if (action === "oauth_start") {
            if (req.method !== "POST") {
                return sendJson(res, 405, { success: false, error: "Gunakan POST untuk memulai OAuth." });
            }
            const platform = String(body.platform || "").trim().toLowerCase();
            if (!SUPPORTED_PLATFORMS.has(platform)) {
                return sendJson(res, 400, {
                    success: false,
                    error: "Pilih platform yang didukung: facebook, youtube, atau tiktok."
                });
            }

            const appsConfig = await loadSocialVideoOAuthAppsConfig(env, { fetchImpl });
            const { state, stateHash, codeVerifier, codeChallenge } = generateOAuthStateAndPkce();
            const authorizeUrl = buildPlatformAuthorizeUrl({
                platform,
                appsConfig,
                redirectUri,
                state,
                codeChallenge
            });

            const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
            const stateResp = await fetchImpl(`${supabaseUrl}/rest/v1/social_video_oauth_states`, {
                method: "POST",
                headers: {
                    apikey: serviceKey,
                    Authorization: `Bearer ${serviceKey}`,
                    "Content-Type": "application/json",
                    Prefer: "return=minimal"
                },
                body: JSON.stringify({
                    state_hash: stateHash,
                    user_id: userId,
                    platform,
                    code_verifier: codeVerifier,
                    return_path: "/opusclip/?tab=social",
                    expires_at: expiresAt
                })
            });

            if (!stateResp.ok) {
                const detail = await stateResp.text().catch(() => "");
                return sendJson(res, 500, {
                    success: false,
                    error: `Gagal menyimpan sesi login OAuth (${stateResp.status}): ${detail.slice(0, 120)}`
                });
            }

            return sendJson(res, 200, {
                success: true,
                platform,
                authorizeUrl,
                redirectUri
            });
        }

        if (action === "create_upload_url") {
            if (req.method !== "POST") {
                return sendJson(res, 405, { success: false, error: "Gunakan POST." });
            }
            const rawName = String(body.fileName || "video.mp4").trim().toLowerCase();
            const extMatch = rawName.match(/\.(mp4|mov|m4v|webm)$/i);
            const ext = extMatch ? extMatch[1].toLowerCase() : "mp4";
            const fileSize = Number(body.fileSize || 0);
            if (fileSize > 180 * 1024 * 1024) {
                return sendJson(res, 413, {
                    success: false,
                    error: "Ukuran file video maksimal 180 MB."
                });
            }

            const objectPath = `social-video/${userId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
            const encodedPath = encodeStoragePath(objectPath);
            const upResp = await fetchImpl(
                `${supabaseUrl}/storage/v1/object/upload/sign/user-uploads/${encodedPath}`,
                {
                    method: "POST",
                    headers: {
                        apikey: serviceKey,
                        Authorization: `Bearer ${serviceKey}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({})
                }
            );
            const upData = await upResp.json().catch(() => ({}));
            const relUrl = String(upData?.url || upData?.signedURL || "").trim();
            if (!upResp.ok || !relUrl) {
                return sendJson(res, 500, {
                    success: false,
                    error: "Gagal membuat tautan unggah video langsung ke server."
                });
            }

            const fullUploadUrl = relUrl.startsWith("http")
                ? relUrl
                : `${supabaseUrl}${relUrl.startsWith("/storage/v1") ? "" : "/storage/v1"}${relUrl.startsWith("/") ? "" : "/"}${relUrl}`;

            const storageRef = buildPrivateMediaRef({
                bucket: "user-uploads",
                objectPath
            });

            return sendJson(res, 200, {
                success: true,
                uploadUrl: fullUploadUrl,
                token: upData?.token || null,
                storageRef,
                objectPath
            });
        }

        if (action === "sign_preview") {
            const videoRef = String(
                body.videoRef || url.searchParams.get("videoRef") || ""
            ).trim();
            if (!videoRef) {
                return sendJson(res, 400, { success: false, error: "videoRef wajib diisi." });
            }
            const signedUrl = isPrivateMediaRef(videoRef)
                ? await signPrivateVideoReference(videoRef, {
                    userId,
                    supabaseUrl,
                    serviceKey,
                    expiresInSec: 3600,
                    fetchImpl
                })
                : assertSafePublicVideoUrl(videoRef);

            return sendJson(res, 200, { success: true, previewUrl: signedUrl });
        }

        if (action === "list_history_videos") {
            const historyVideos = await fetchUserHistoryVideos(supabaseUrl, serviceKey, userId, fetchImpl);
            return sendJson(res, 200, { success: true, historyVideos });
        }

        if (action === "generate_ai_caption") {
            if (req.method !== "POST") {
                return sendJson(res, 405, { success: false, error: "Gunakan POST." });
            }
            const copy = await generateViralSocialCopy({
                topic: body.topic || body.title || body.caption || "",
                platforms: Array.isArray(body.platforms) ? body.platforms : [],
                env
            });
            return sendJson(res, 200, { success: true, copy });
        }

        if (action === "create_posts") {
            if (req.method !== "POST") {
                return sendJson(res, 405, { success: false, error: "Gunakan POST." });
            }

            const rawAccountIds = Array.isArray(body.accountIds)
                ? body.accountIds
                : body.accountId
                    ? [body.accountId]
                    : [];
            const accountIds = [...new Set(rawAccountIds.map(v => String(v || "").trim()).filter(v => UUID_REGEX.test(v)))];

            if (accountIds.length === 0) {
                return sendJson(res, 400, {
                    success: false,
                    error: "Pilih minimal 1 akun medsos terhubung (Facebook, YouTube, atau TikTok)."
                });
            }

            const videoRef = String(body.videoRef || "").trim();
            if (!videoRef) {
                return sendJson(res, 400, {
                    success: false,
                    error: "Pilih atau unggah video MP4 terlebih dahulu."
                });
            }

            /* Validasi awal kepemilikan / keamanan URL sebelum membuat baris antrean */
            if (isPrivateMediaRef(videoRef)) {
                await signPrivateVideoReference(videoRef, {
                    userId,
                    supabaseUrl,
                    serviceKey,
                    expiresInSec: 300,
                    fetchImpl
                });
            } else {
                assertSafePublicVideoUrl(videoRef);
            }

            const userAccounts = await fetchUserConnectedAccounts(supabaseUrl, serviceKey, userId, fetchImpl);
            const selectedAccounts = accountIds
                .map(id => userAccounts.find(a => a.id === id && a.status === "active"))
                .filter(Boolean);

            if (selectedAccounts.length === 0) {
                return sendJson(res, 404, {
                    success: false,
                    error: "Akun medsos yang dipilih tidak ditemukan pada profil Anda."
                });
            }

            const rawScheduled = String(body.scheduledFor || "").trim();
            const publishNow = body.publishNow === true || !rawScheduled;
            let scheduledIso = new Date().toISOString();

            if (!publishNow) {
                const parsedTime = Date.parse(rawScheduled);
                if (!Number.isFinite(parsedTime) || parsedTime <= Date.now() + 30_000) {
                    return sendJson(res, 400, {
                        success: false,
                        error: "Waktu jadwal tayang harus berada di masa mendatang (minimal 1 menit ke depan)."
                    });
                }
                scheduledIso = new Date(parsedTime).toISOString();
            }

            const [profile, unitCost] = await Promise.all([
                fetchUserProfile(supabaseUrl, serviceKey, userId, fetchImpl),
                fetchSocialPostFeatureCost(supabaseUrl, serviceKey, fetchImpl)
            ]);
            const totalRequiredCredits = unitCost * selectedAccounts.length;
            if (unitCost > 0 && profile.credits < totalRequiredCredits) {
                return sendJson(res, 402, {
                    success: false,
                    code: "INSUFFICIENT_CREDITS",
                    error: `Saldo kredit Anda (${profile.credits}) belum cukup untuk ${selectedAccounts.length} postingan (${totalRequiredCredits} kredit).`
                });
            }

            const cleanSourceType = ["upload", "history", "url", "opusclip"].includes(String(body.videoSourceType || ""))
                ? String(body.videoSourceType)
                : isPrivateMediaRef(videoRef)
                    ? "upload"
                    : "url";
            const cleanPrivacy = SUPPORTED_PRIVACY.has(String(body.privacyLevel || "").toLowerCase())
                ? String(body.privacyLevel).toLowerCase()
                : "public";
            const cleanTitle = String(body.title || "").trim().slice(0, 120);
            const cleanCaption = String(body.caption || "").trim().slice(0, 4500);
            const cleanHashtags = String(body.hashtags || "").trim().slice(0, 400);

            const rowsToInsert = selectedAccounts.map(acct => ({
                id: crypto.randomUUID(),
                user_id: userId,
                account_id: acct.id,
                platform: acct.platform,
                video_source_type: cleanSourceType,
                video_ref: videoRef,
                title: cleanTitle,
                caption: cleanCaption,
                hashtags: cleanHashtags,
                privacy_level: cleanPrivacy,
                scheduled_for: scheduledIso,
                status: publishNow ? "processing" : "scheduled",
                credit_cost: unitCost,
                attempts: publishNow ? 1 : 0
            }));

            const insResp = await fetchImpl(`${supabaseUrl}/rest/v1/social_video_posts`, {
                method: "POST",
                headers: {
                    apikey: serviceKey,
                    Authorization: `Bearer ${serviceKey}`,
                    "Content-Type": "application/json",
                    Prefer: "return=representation"
                },
                body: JSON.stringify(rowsToInsert)
            });

            const insertedRows = await insResp.json().catch(() => []);
            if (!insResp.ok || !Array.isArray(insertedRows) || insertedRows.length === 0) {
                return sendJson(res, 500, {
                    success: false,
                    error: "Gagal menyimpan antrean posting video ke database."
                });
            }

            if (!publishNow) {
                return sendJson(res, 200, {
                    success: true,
                    mode: "scheduled",
                    scheduledCount: insertedRows.length,
                    scheduledFor: scheduledIso,
                    unitCreditCost: unitCost,
                    posts: insertedRows
                });
            }

            const appsConfig = await loadSocialVideoOAuthAppsConfig(env, { fetchImpl });
            const executionResults = [];
            for (const postRow of insertedRows) {
                const resItem = await executeSocialVideoPostRow({
                    postRow,
                    appsConfig,
                    env,
                    supabaseUrl,
                    serviceKey,
                    fetchImpl
                });
                executionResults.push(resItem);
            }

            const updatedProfile = await fetchUserProfile(supabaseUrl, serviceKey, userId, fetchImpl);
            const posts = await fetchUserPosts(supabaseUrl, serviceKey, userId, fetchImpl, 25);
            const succeeded = executionResults.filter(r => r.ok).length;

            return sendJson(res, succeeded > 0 ? 200 : 400, {
                success: succeeded > 0,
                mode: "immediate",
                succeeded,
                failed: executionResults.length - succeeded,
                results: executionResults,
                creditsRemaining: updatedProfile.credits,
                posts,
                ...(succeeded === 0
                    ? { error: executionResults[0]?.error || "Gagal mem-posting video ke akun tujuan." }
                    : {})
            });
        }

        if (action === "list_posts") {
            const posts = await fetchUserPosts(supabaseUrl, serviceKey, userId, fetchImpl, 30);
            return sendJson(res, 200, { success: true, posts });
        }

        if (action === "cancel_post") {
            if (req.method !== "POST") {
                return sendJson(res, 405, { success: false, error: "Gunakan POST." });
            }
            const postId = String(body.postId || "").trim();
            if (!UUID_REGEX.test(postId)) {
                return sendJson(res, 400, { success: false, error: "ID jadwal tidak valid." });
            }

            await fetchImpl(
                `${supabaseUrl}/rest/v1/social_video_posts?id=eq.${encodeURIComponent(postId)}&user_id=eq.${encodeURIComponent(userId)}&status=eq.scheduled`,
                {
                    method: "PATCH",
                    headers: {
                        apikey: serviceKey,
                        Authorization: `Bearer ${serviceKey}`,
                        "Content-Type": "application/json",
                        Prefer: "return=minimal"
                    },
                    body: JSON.stringify({
                        status: "cancelled",
                        updated_at: new Date().toISOString()
                    })
                }
            );

            const posts = await fetchUserPosts(supabaseUrl, serviceKey, userId, fetchImpl, 25);
            return sendJson(res, 200, {
                success: true,
                message: "Jadwal Auto Post berhasil dibatalkan.",
                posts
            });
        }

        return sendJson(res, 400, {
            success: false,
            error: `Action '${action}' tidak dikenali pada /api/social-video-autopost.`
        });
    } catch (err) {
        return sendJson(res, err?.status || 500, {
            success: false,
            error: err?.message || "Terjadi kesalahan pada layanan Social Video Auto Post."
        });
    }
}
