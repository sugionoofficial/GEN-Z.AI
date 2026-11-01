/* =========================================================
   GEN-Z.AI — MULTI-USER SOCIAL VIDEO OAUTH & PUBLISHING ENGINE
   ---------------------------------------------------------
   File:
     lib/social-video/publisher.js

   Menangani:
   1. Pembuatan URL OAuth PKCE & pertukaran token untuk:
      - Facebook Page & Reels (`graph.facebook.com/v21.0`)
      - YouTube Video & Shorts (`accounts.google.com` + YouTube Data API v3)
      - TikTok Video (`www.tiktok.com/v2/auth/authorize/` + TikTok API v2)
   2. Auto-refresh token akses YouTube & TikTok sebelum kedaluwarsa.
   3. Penandatanganan aman referensi privat `supabase-private://...`
      dengan verifikasi kepemilikan `user_id` + proteksi SSRF untuk URL HTTPS.
   4. Eksekusi publikasi langsung maupun cron terjadwal dengan pemotongan
      kredit atomik (`charge_feature_credits`) & auto-refund jika gagal
      (`settle_feature_credits` outcome `refund`) memakai `SUPABASE_SERVICE_ROLE_KEY`.
========================================================= */

import crypto from "node:crypto";
import { isPrivateMediaRef, parsePrivateMediaRef } from "../generate/private-media.js";
import {
    decryptAccountTokenPair,
    encryptAccountTokenPair,
    loadSocialVideoOAuthAppsConfig
} from "./app-credentials.js";

export const GRAPH_API_VERSION = "v21.0";
export const SOCIAL_VIDEO_FEATURE_ID = "opusclip_social_post";
export const DEFAULT_SOCIAL_POST_COST = 250;

const ALLOWED_PRIVATE_BUCKETS = new Set([
    "user-uploads",
    "dashboard-videos",
    "dashboard-upscales"
]);

const MAX_YOUTUBE_VIDEO_BYTES = 90 * 1024 * 1024;
const MAX_TIKTOK_VIDEO_BYTES = 60 * 1024 * 1024;
const TIKTOK_CHUNK_SIZE = 10 * 1024 * 1024;

export function hashOAuthState(rawState) {
    return crypto
        .createHash("sha256")
        .update(String(rawState || ""), "utf8")
        .digest("hex");
}

export function generateOAuthStateAndPkce() {
    const state = crypto.randomBytes(24).toString("base64url");
    const stateHash = hashOAuthState(state);
    const codeVerifier = crypto.randomBytes(32).toString("base64url");
    const codeChallenge = crypto
        .createHash("sha256")
        .update(codeVerifier, "utf8")
        .digest("base64url");

    return {
        state,
        stateHash,
        codeVerifier,
        codeChallenge
    };
}

function isPrivateOrLocalHostname(hostname) {
    const host = String(hostname || "").trim().toLowerCase().replace(/^\[|\]$/g, "");
    if (!host) return true;
    if (
        host === "localhost" ||
        host.endsWith(".localhost") ||
        host.endsWith(".local") ||
        host.endsWith(".internal") ||
        host === "::1" ||
        host === "0:0:0:0:0:0:0:1"
    ) {
        return true;
    }

    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
        const parts = host.split(".").map(Number);
        if (parts.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return true;
        const [a, b] = parts;
        if (
            a === 0 ||
            a === 10 ||
            a === 127 ||
            (a === 169 && b === 254) ||
            (a === 172 && b >= 16 && b <= 31) ||
            (a === 192 && b === 168) ||
            (a === 100 && b >= 64 && b <= 127)
        ) {
            return true;
        }
    }

    if (host.includes(":")) {
        if (host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80")) {
            return true;
        }
    }

    return false;
}

export function assertSafePublicVideoUrl(rawUrl) {
    let parsed;
    try {
        parsed = new URL(String(rawUrl || "").trim());
    } catch {
        const err = new Error("URL video tidak valid.");
        err.status = 400;
        throw err;
    }

    if (parsed.protocol !== "https:") {
        const err = new Error("URL video wajib menggunakan protokol HTTPS.");
        err.status = 400;
        throw err;
    }

    if (parsed.username || parsed.password) {
        const err = new Error("URL video tidak boleh memuat kredensial.");
        err.status = 400;
        throw err;
    }

    if (parsed.port && parsed.port !== "443") {
        const err = new Error("Port URL video tidak diizinkan.");
        err.status = 400;
        throw err;
    }

    if (isPrivateOrLocalHostname(parsed.hostname)) {
        const err = new Error("Host lokal atau jaringan privat tidak diizinkan.");
        err.status = 400;
        throw err;
    }

    return parsed.toString();
}

function encodeStorageObjectPath(objectPath) {
    return String(objectPath || "")
        .split("/")
        .filter(Boolean)
        .map(seg => encodeURIComponent(seg))
        .join("/");
}

async function userOwnsHistoryMedia(supabaseUrl, serviceKey, userId, rawRef, fetchImpl) {
    const qs = new URLSearchParams({
        select: "id",
        user_id: `eq.${userId}`,
        result_url: `eq.${rawRef}`,
        limit: "1"
    });
    const resp = await fetchImpl(`${supabaseUrl}/rest/v1/generation_history?${qs.toString()}`, {
        method: "GET",
        headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`
        }
    });
    if (!resp.ok) return false;
    const rows = await resp.json().catch(() => []);
    return Array.isArray(rows) && rows.length > 0;
}

export async function signPrivateVideoReference(
    rawRef,
    { userId, supabaseUrl, serviceKey, expiresInSec = 7200, fetchImpl = globalThis.fetch } = {}
) {
    const parsed = parsePrivateMediaRef(rawRef);
    if (!parsed) {
        const err = new Error("Referensi penyimpanan video tidak valid.");
        err.status = 400;
        throw err;
    }

    if (!ALLOWED_PRIVATE_BUCKETS.has(parsed.bucket)) {
        const err = new Error(`Bucket video '${parsed.bucket}' tidak diizinkan.`);
        err.status = 403;
        throw err;
    }

    const cleanUser = String(userId || "").trim();
    const pathSegments = parsed.objectPath.split("/").filter(Boolean);
    const ownsByPath = Boolean(cleanUser && pathSegments.includes(cleanUser));

    if (!ownsByPath) {
        const ownsHistory = await userOwnsHistoryMedia(
            supabaseUrl,
            serviceKey,
            cleanUser,
            rawRef,
            fetchImpl
        );
        if (!ownsHistory) {
            const err = new Error("Anda tidak memiliki akses ke file video tersebut.");
            err.status = 403;
            throw err;
        }
    }

    const encodedPath = encodeStorageObjectPath(parsed.objectPath);
    const signResp = await fetchImpl(
        `${supabaseUrl}/storage/v1/object/sign/${encodeURIComponent(parsed.bucket)}/${encodedPath}`,
        {
            method: "POST",
            headers: {
                apikey: serviceKey,
                Authorization: `Bearer ${serviceKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ expiresIn: expiresInSec })
        }
    );

    const signData = await signResp.json().catch(() => null);
    const signedSuffix = String(signData?.signedURL || signData?.signedUrl || "").trim();
    if (!signResp.ok || !signedSuffix) {
        throw new Error("Gagal menandatangani akses file video dari penyimpanan server.");
    }

    if (signedSuffix.startsWith("http://") || signedSuffix.startsWith("https://")) {
        return signedSuffix;
    }
    const prefix = signedSuffix.startsWith("/storage/v1") ? "" : "/storage/v1";
    return `${supabaseUrl}${prefix}${signedSuffix.startsWith("/") ? "" : "/"}${signedSuffix}`;
}

export async function resolvePublishableVideoUrl(
    videoRef,
    { userId, supabaseUrl, serviceKey, fetchImpl = globalThis.fetch } = {}
) {
    const cleanRef = String(videoRef || "").trim();
    if (!cleanRef) {
        const err = new Error("Sumber video wajib dipilih terlebih dahulu.");
        err.status = 400;
        throw err;
    }

    if (isPrivateMediaRef(cleanRef)) {
        return signPrivateVideoReference(cleanRef, {
            userId,
            supabaseUrl,
            serviceKey,
            expiresInSec: 7200,
            fetchImpl
        });
    }

    return assertSafePublicVideoUrl(cleanRef);
}

/* =========================================================
   OAUTH AUTHORIZE URL BUILDERS & TOKEN EXCHANGERS
========================================================= */

export function buildPlatformAuthorizeUrl({
    platform,
    appsConfig,
    redirectUri,
    state,
    codeChallenge
}) {
    const cleanPlatform = String(platform || "").trim().toLowerCase();

    if (cleanPlatform === "facebook") {
        if (!appsConfig.facebook?.configured) {
            const err = new Error(
                "Kredensial Facebook Meta App belum dikonfigurasi oleh Admin di BLACK BOX → MODUL 03."
            );
            err.status = 400;
            throw err;
        }
        const authUrl = new URL(`https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth`);
        authUrl.searchParams.set("client_id", appsConfig.facebook.appId);
        authUrl.searchParams.set("redirect_uri", redirectUri);
        authUrl.searchParams.set("state", state);
        authUrl.searchParams.set("response_type", "code");
        if (appsConfig.facebook.loginConfigId) {
            authUrl.searchParams.set("config_id", appsConfig.facebook.loginConfigId);
        } else {
            authUrl.searchParams.set(
                "scope",
                "pages_show_list,pages_read_engagement,pages_manage_posts"
            );
        }
        return authUrl.toString();
    }

    if (cleanPlatform === "youtube") {
        if (!appsConfig.youtube?.configured) {
            const err = new Error(
                "Kredensial Google / YouTube OAuth belum diisi Admin di BLACK BOX → MODUL 03."
            );
            err.status = 400;
            throw err;
        }
        const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
        authUrl.searchParams.set("client_id", appsConfig.youtube.clientId);
        authUrl.searchParams.set("redirect_uri", redirectUri);
        authUrl.searchParams.set("response_type", "code");
        authUrl.searchParams.set(
            "scope",
            "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly"
        );
        authUrl.searchParams.set("access_type", "offline");
        authUrl.searchParams.set("prompt", "consent");
        authUrl.searchParams.set("include_granted_scopes", "true");
        authUrl.searchParams.set("state", state);
        if (codeChallenge) {
            authUrl.searchParams.set("code_challenge", codeChallenge);
            authUrl.searchParams.set("code_challenge_method", "S256");
        }
        return authUrl.toString();
    }

    if (cleanPlatform === "tiktok") {
        if (!appsConfig.tiktok?.configured) {
            const err = new Error(
                "Kredensial TikTok Developer OAuth belum diisi Admin di BLACK BOX → MODUL 03."
            );
            err.status = 400;
            throw err;
        }
        const authUrl = new URL("https://www.tiktok.com/v2/auth/authorize/");
        authUrl.searchParams.set("client_key", appsConfig.tiktok.clientKey);
        authUrl.searchParams.set("response_type", "code");
        authUrl.searchParams.set("scope", "user.info.basic,video.publish,video.upload");
        authUrl.searchParams.set("redirect_uri", redirectUri);
        authUrl.searchParams.set("state", state);
        if (codeChallenge) {
            authUrl.searchParams.set("code_challenge", codeChallenge);
            authUrl.searchParams.set("code_challenge_method", "S256");
        }
        return authUrl.toString();
    }

    const err = new Error("Platform medsos tidak didukung.");
    err.status = 400;
    throw err;
}

export async function exchangePlatformOAuthCode({
    platform,
    code,
    codeVerifier,
    redirectUri,
    appsConfig,
    fetchImpl = globalThis.fetch
}) {
    const cleanPlatform = String(platform || "").trim().toLowerCase();

    if (cleanPlatform === "facebook") {
        const fbCfg = appsConfig.facebook;
        const shortUrl = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/oauth/access_token`);
        shortUrl.searchParams.set("client_id", fbCfg.appId);
        shortUrl.searchParams.set("client_secret", fbCfg.appSecret);
        shortUrl.searchParams.set("redirect_uri", redirectUri);
        shortUrl.searchParams.set("code", code);

        const shortResp = await fetchImpl(shortUrl.toString());
        const shortData = await shortResp.json().catch(() => ({}));
        if (!shortResp.ok || !shortData.access_token) {
            throw new Error(
                shortData?.error?.message || "Gagal menukar kode otorisasi Facebook."
            );
        }

        let userToken = String(shortData.access_token);
        const longUrl = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/oauth/access_token`);
        longUrl.searchParams.set("grant_type", "fb_exchange_token");
        longUrl.searchParams.set("client_id", fbCfg.appId);
        longUrl.searchParams.set("client_secret", fbCfg.appSecret);
        longUrl.searchParams.set("fb_exchange_token", userToken);
        const longResp = await fetchImpl(longUrl.toString());
        const longData = await longResp.json().catch(() => ({}));
        if (longResp.ok && longData.access_token) {
            userToken = String(longData.access_token);
        }

        const pagesUrl = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/me/accounts`);
        pagesUrl.searchParams.set("fields", "id,name,username,picture{url},access_token");
        pagesUrl.searchParams.set("limit", "50");
        pagesUrl.searchParams.set("access_token", userToken);

        const pagesResp = await fetchImpl(pagesUrl.toString());
        const pagesData = await pagesResp.json().catch(() => ({}));
        if (!pagesResp.ok) {
            throw new Error(pagesData?.error?.message || "Gagal mengambil daftar Facebook Page.");
        }

        const pages = Array.isArray(pagesData?.data)
            ? pagesData.data.filter(p => p?.id && p?.access_token)
            : [];
        if (pages.length === 0) {
            throw new Error(
                "Tidak ada Facebook Page yang terpilih/dikelola pada akun Facebook tersebut."
            );
        }

        return pages.map(page => ({
            platform: "facebook",
            externalAccountId: String(page.id),
            accountName: String(page.name || `Facebook Page ${page.id}`),
            accountHandle: page.username ? `@${page.username}` : null,
            avatarUrl: page.picture?.data?.url || null,
            accessToken: String(page.access_token),
            refreshToken: "",
            tokenExpiresAt: null,
            scopes: "pages_show_list,pages_read_engagement,pages_manage_posts"
        }));
    }

    if (cleanPlatform === "youtube") {
        const ytCfg = appsConfig.youtube;
        const body = new URLSearchParams({
            code,
            client_id: ytCfg.clientId,
            client_secret: ytCfg.clientSecret,
            redirect_uri: redirectUri,
            grant_type: "authorization_code"
        });
        if (codeVerifier) body.set("code_verifier", codeVerifier);

        const tokenResp = await fetchImpl("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Accept: "application/json"
            },
            body: body.toString()
        });
        const tokenData = await tokenResp.json().catch(() => ({}));
        if (!tokenResp.ok || !tokenData.access_token) {
            throw new Error(
                tokenData?.error_description || tokenData?.error || "Gagal menukar kode OAuth YouTube."
            );
        }

        const expiresIn = Number(tokenData.expires_in) || 3600;
        const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

        const chResp = await fetchImpl(
            "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
            {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${tokenData.access_token}`,
                    Accept: "application/json"
                }
            }
        );
        const chData = await chResp.json().catch(() => ({}));
        const items = Array.isArray(chData?.items) ? chData.items : [];
        if (!chResp.ok || items.length === 0) {
            throw new Error(
                chData?.error?.message ||
                "Akun Google ini belum memiliki Channel YouTube aktif. Buat channel YouTube terlebih dahulu."
            );
        }

        return items.map(ch => ({
            platform: "youtube",
            externalAccountId: String(ch.id),
            accountName: String(ch.snippet?.title || `YouTube ${ch.id}`),
            accountHandle: ch.snippet?.customUrl || null,
            avatarUrl: ch.snippet?.thumbnails?.default?.url || null,
            accessToken: String(tokenData.access_token),
            refreshToken: String(tokenData.refresh_token || ""),
            tokenExpiresAt: expiresAt,
            scopes: String(tokenData.scope || "youtube.upload")
        }));
    }

    if (cleanPlatform === "tiktok") {
        const ttCfg = appsConfig.tiktok;
        const body = new URLSearchParams({
            client_key: ttCfg.clientKey,
            client_secret: ttCfg.clientSecret,
            code,
            grant_type: "authorization_code",
            redirect_uri: redirectUri
        });
        if (codeVerifier) body.set("code_verifier", codeVerifier);

        const tokenResp = await fetchImpl("https://open.tiktokapis.com/v2/oauth/token/", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Accept: "application/json"
            },
            body: body.toString()
        });
        const rawTokenData = await tokenResp.json().catch(() => ({}));
        const tokenData = rawTokenData?.data && rawTokenData.data.access_token
            ? rawTokenData.data
            : rawTokenData;

        if (!tokenResp.ok || !tokenData?.access_token) {
            throw new Error(
                tokenData?.error_description ||
                tokenData?.message ||
                tokenData?.error ||
                "Gagal menukar kode OAuth TikTok."
            );
        }

        const openId = String(tokenData.open_id || "tiktok_user");
        const expiresIn = Number(tokenData.expires_in) || 86400;
        const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

        let displayName = "TikTok Creator";
        let username = null;
        let avatarUrl = null;
        try {
            const profileResp = await fetchImpl(
                "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url,username",
                {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${tokenData.access_token}`,
                        Accept: "application/json"
                    }
                }
            );
            const profileJson = await profileResp.json().catch(() => ({}));
            const userObj = profileJson?.data?.user || {};
            if (userObj.display_name) displayName = String(userObj.display_name);
            if (userObj.username) username = `@${String(userObj.username).replace(/^@/, "")}`;
            if (userObj.avatar_url) avatarUrl = String(userObj.avatar_url);
        } catch {
            /* non-fatal */
        }

        return [
            {
                platform: "tiktok",
                externalAccountId: openId,
                accountName: displayName,
                accountHandle: username,
                avatarUrl,
                accessToken: String(tokenData.access_token),
                refreshToken: String(tokenData.refresh_token || ""),
                tokenExpiresAt: expiresAt,
                scopes: String(tokenData.scope || "user.info.basic,video.publish,video.upload")
            }
        ];
    }

    throw new Error("Platform OAuth tidak dikenali.");
}

/* =========================================================
   TOKEN AUTO-REFRESH & VIDEO UPLOAD BY PLATFORM
========================================================= */

async function ensureFreshAccountAccessToken({
    accountRow,
    env,
    appsConfig,
    supabaseUrl,
    serviceKey,
    fetchImpl = globalThis.fetch
}) {
    const { accessToken, refreshToken } = decryptAccountTokenPair(accountRow, env);
    if (!accessToken && !refreshToken) {
        throw new Error(
            `Token akun ${accountRow.platform} tidak dapat didekripsi. Silakan hubungkan ulang akun tersebut.`
        );
    }

    const expiresAtMs = accountRow.token_expires_at ? Date.parse(accountRow.token_expires_at) : 0;
    const stillValid = !expiresAtMs || expiresAtMs - Date.now() > 5 * 60 * 1000;
    if (stillValid && accessToken) {
        return accessToken;
    }

    if (!refreshToken) {
        return accessToken;
    }

    let newAccess = "";
    let newRefresh = refreshToken;
    let newExpiresIso = null;

    if (accountRow.platform === "youtube") {
        const ytCfg = appsConfig.youtube;
        if (!ytCfg?.configured) return accessToken;
        const body = new URLSearchParams({
            client_id: ytCfg.clientId,
            client_secret: ytCfg.clientSecret,
            refresh_token: refreshToken,
            grant_type: "refresh_token"
        });
        const resp = await fetchImpl("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: body.toString()
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data.access_token) {
            throw new Error(
                `Sesi YouTube kedaluwarsa (${data?.error_description || data?.error || resp.status}). Hubungkan ulang YouTube.`
            );
        }
        newAccess = String(data.access_token);
        if (data.refresh_token) newRefresh = String(data.refresh_token);
        newExpiresIso = new Date(Date.now() + (Number(data.expires_in) || 3600) * 1000).toISOString();
    } else if (accountRow.platform === "tiktok") {
        const ttCfg = appsConfig.tiktok;
        if (!ttCfg?.configured) return accessToken;
        const body = new URLSearchParams({
            client_key: ttCfg.clientKey,
            client_secret: ttCfg.clientSecret,
            grant_type: "refresh_token",
            refresh_token: refreshToken
        });
        const resp = await fetchImpl("https://open.tiktokapis.com/v2/oauth/token/", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: body.toString()
        });
        const raw = await resp.json().catch(() => ({}));
        const data = raw?.data?.access_token ? raw.data : raw;
        if (!resp.ok || !data?.access_token) {
            throw new Error(
                `Sesi TikTok kedaluwarsa (${data?.error_description || data?.error || resp.status}). Hubungkan ulang TikTok.`
            );
        }
        newAccess = String(data.access_token);
        if (data.refresh_token) newRefresh = String(data.refresh_token);
        newExpiresIso = new Date(Date.now() + (Number(data.expires_in) || 86400) * 1000).toISOString();
    } else {
        return accessToken;
    }

    if (supabaseUrl && serviceKey && accountRow.id) {
        const enc = encryptAccountTokenPair(newAccess, newRefresh, env);
        await fetchImpl(
            `${supabaseUrl}/rest/v1/social_video_accounts?id=eq.${encodeURIComponent(accountRow.id)}`,
            {
                method: "PATCH",
                headers: {
                    apikey: serviceKey,
                    Authorization: `Bearer ${serviceKey}`,
                    "Content-Type": "application/json",
                    Prefer: "return=minimal"
                },
                body: JSON.stringify({
                    ...enc,
                    token_expires_at: newExpiresIso,
                    status: "active",
                    updated_at: new Date().toISOString()
                })
            }
        ).catch(() => {});
    }

    return newAccess;
}

export function composeFullSocialCaption(caption = "", hashtags = "") {
    const cleanCaption = String(caption || "").trim();
    const tagsList = String(hashtags || "")
        .split(/[\s,]+/)
        .map(t => t.trim())
        .filter(Boolean)
        .map(t => (t.startsWith("#") ? t : `#${t}`));
    const tagLine = tagsList.join(" ");
    if (cleanCaption && tagLine) return `${cleanCaption}\n\n${tagLine}`;
    return cleanCaption || tagLine || "";
}

async function downloadVideoBytesBounded(videoUrl, maxBytes, fetchImpl) {
    const resp = await fetchImpl(videoUrl, { method: "GET" });
    if (!resp.ok) {
        throw new Error(`Gagal mengunduh sumber video (HTTP ${resp.status}).`);
    }
    const declaredLen = Number(resp.headers?.get?.("content-length") || 0);
    if (declaredLen > maxBytes) {
        throw new Error(
            `Ukuran file video (${Math.round(declaredLen / (1024 * 1024))} MB) melebihi batas unggah langsung (${Math.round(maxBytes / (1024 * 1024))} MB).`
        );
    }
    const buf = new Uint8Array(await resp.arrayBuffer());
    if (buf.byteLength === 0) {
        throw new Error("File video kosong (0 byte).");
    }
    if (buf.byteLength > maxBytes) {
        throw new Error(
            `Ukuran file video (${Math.round(buf.byteLength / (1024 * 1024))} MB) melebihi batas ${Math.round(maxBytes / (1024 * 1024))} MB.`
        );
    }
    return buf;
}

export async function publishVideoToFacebookPage({
    pageId,
    pageAccessToken,
    videoUrl,
    title,
    caption,
    hashtags,
    fetchImpl = globalThis.fetch
}) {
    const description = composeFullSocialCaption(caption, hashtags);
    const body = new URLSearchParams({
        file_url: videoUrl,
        access_token: pageAccessToken
    });
    if (title) body.set("title", String(title).slice(0, 250));
    if (description) body.set("description", description.slice(0, 5000));

    const resp = await fetchImpl(
        `https://graph-video.facebook.com/${GRAPH_API_VERSION}/${encodeURIComponent(pageId)}/videos`,
        {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: body.toString()
        }
    );
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data?.id) {
        throw new Error(
            data?.error?.message || `Facebook menolak unggahan video (HTTP ${resp.status}).`
        );
    }

    const postId = String(data.id);
    return {
        remotePostId: postId,
        remotePostUrl: `https://www.facebook.com/${encodeURIComponent(pageId)}/videos/${encodeURIComponent(postId)}`
    };
}

export async function publishVideoToYouTubeChannel({
    accessToken,
    videoUrl,
    title,
    caption,
    hashtags,
    privacyLevel = "public",
    fetchImpl = globalThis.fetch
}) {
    const bytes = await downloadVideoBytesBounded(videoUrl, MAX_YOUTUBE_VIDEO_BYTES, fetchImpl);
    const fullDesc = composeFullSocialCaption(caption, hashtags);
    const cleanTags = String(hashtags || "")
        .split(/[\s,]+/)
        .map(t => t.replace(/^#+/, "").trim())
        .filter(Boolean)
        .slice(0, 15);

    const ytPrivacy = ["public", "unlisted", "private"].includes(String(privacyLevel).toLowerCase())
        ? String(privacyLevel).toLowerCase()
        : "public";

    const safeTitle = String(title || caption || "Video Shorts AI").trim().slice(0, 95) || "Video Shorts AI";

    const initResp = await fetchImpl(
        "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json; charset=UTF-8",
                "X-Upload-Content-Length": String(bytes.byteLength),
                "X-Upload-Content-Type": "video/mp4"
            },
            body: JSON.stringify({
                snippet: {
                    title: safeTitle,
                    description: fullDesc.slice(0, 4900),
                    ...(cleanTags.length > 0 ? { tags: cleanTags } : {}),
                    categoryId: "22"
                },
                status: {
                    privacyStatus: ytPrivacy,
                    selfDeclaredMadeForKids: false
                }
            })
        }
    );

    const uploadLocation = initResp.headers?.get?.("location") || "";
    if (!initResp.ok || !uploadLocation) {
        const errData = await initResp.json().catch(() => ({}));
        throw new Error(
            errData?.error?.message || `Gagal memulai upload YouTube (HTTP ${initResp.status}).`
        );
    }

    const putResp = await fetchImpl(uploadLocation, {
        method: "PUT",
        headers: {
            "Content-Type": "video/mp4",
            "Content-Length": String(bytes.byteLength)
        },
        body: bytes
    });

    const putData = await putResp.json().catch(() => ({}));
    if (!putResp.ok || !putData?.id) {
        throw new Error(
            putData?.error?.message || `Gagal menyelesaikan unggahan video YouTube (HTTP ${putResp.status}).`
        );
    }

    const videoId = String(putData.id);
    return {
        remotePostId: videoId,
        remotePostUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`
    };
}

export async function publishVideoToTikTokAccount({
    accessToken,
    accountHandle = "",
    videoUrl,
    title,
    caption,
    hashtags,
    privacyLevel = "public",
    defaultPostMode = "direct",
    fetchImpl = globalThis.fetch
}) {
    const bytes = await downloadVideoBytesBounded(videoUrl, MAX_TIKTOK_VIDEO_BYTES, fetchImpl);
    const videoSize = bytes.byteLength;
    const chunkSize = videoSize <= TIKTOK_CHUNK_SIZE ? videoSize : TIKTOK_CHUNK_SIZE;
    const totalChunks = Math.max(1, Math.ceil(videoSize / chunkSize));

    const combinedText = composeFullSocialCaption(caption || title, hashtags).slice(0, 2100) ||
        String(title || "Video AI").slice(0, 150);

    const mapTikTokPrivacy = level => {
        const l = String(level || "").toLowerCase();
        if (l === "private" || l === "self_only") return "SELF_ONLY";
        if (l === "unlisted") return "MUTUAL_FOLLOW_FRIENDS";
        return "PUBLIC_TO_EVERYONE";
    };

    const callInit = async useInbox => {
        const endpoint = useInbox
            ? "https://open.tiktokapis.com/v2/post/publish/inbox/video/init/"
            : "https://open.tiktokapis.com/v2/post/publish/video/init/";

        const payload = useInbox
            ? {
                source_info: {
                    source: "FILE_UPLOAD",
                    video_size: videoSize,
                    chunk_size: chunkSize,
                    total_chunk_count: totalChunks
                }
            }
            : {
                post_info: {
                    title: combinedText,
                    privacy_level: mapTikTokPrivacy(privacyLevel),
                    disable_duet: false,
                    disable_comment: false,
                    disable_stitch: false
                },
                source_info: {
                    source: "FILE_UPLOAD",
                    video_size: videoSize,
                    chunk_size: chunkSize,
                    total_chunk_count: totalChunks
                }
            };

        const resp = await fetchImpl(endpoint, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json; charset=UTF-8"
            },
            body: JSON.stringify(payload)
        });
        const json = await resp.json().catch(() => ({}));
        return { resp, json };
    };

    const forceInbox =
        defaultPostMode === "inbox" || String(privacyLevel || "").toLowerCase() === "inbox_draft";
    let usedInbox = forceInbox;
    let initResult = await callInit(usedInbox);

    const errCode = String(initResult.json?.error?.code || "");
    if (
        !usedInbox &&
        (!initResult.resp.ok || (errCode && errCode !== "ok")) &&
        /unaudited|private_account|scope_not_authorized|sandbox/i.test(
            `${errCode} ${initResult.json?.error?.message || ""}`
        )
    ) {
        usedInbox = true;
        initResult = await callInit(true);
    }

    const finalErrCode = String(initResult.json?.error?.code || "");
    const uploadUrl = String(initResult.json?.data?.upload_url || "").trim();
    const publishId = String(initResult.json?.data?.publish_id || "").trim();

    if (!initResult.resp.ok || (finalErrCode && finalErrCode !== "ok") || !uploadUrl) {
        throw new Error(
            initResult.json?.error?.message ||
            `TikTok menolak inisialisasi unggahan video (${finalErrCode || initResult.resp.status}).`
        );
    }

    for (let idx = 0; idx < totalChunks; idx += 1) {
        const start = idx * chunkSize;
        const endExclusive = idx === totalChunks - 1
            ? videoSize
            : Math.min(start + chunkSize, videoSize);
        const slice = bytes.subarray(start, endExclusive);

        const putResp = await fetchImpl(uploadUrl, {
            method: "PUT",
            headers: {
                "Content-Type": "video/mp4",
                "Content-Length": String(slice.byteLength),
                "Content-Range": `bytes ${start}-${endExclusive - 1}/${videoSize}`
            },
            body: slice
        });

        if (!putResp.ok && putResp.status !== 201 && putResp.status !== 206) {
            throw new Error(`Gagal mengunggah chunk video ke TikTok (HTTP ${putResp.status}).`);
        }
    }

    const cleanHandle = String(accountHandle || "").replace(/^@/, "").trim();
    const profileUrl = cleanHandle
        ? `https://www.tiktok.com/@${encodeURIComponent(cleanHandle)}`
        : "https://www.tiktok.com/";

    return {
        remotePostId: publishId || `tiktok_${Date.now()}`,
        remotePostUrl: profileUrl,
        deliveredToInbox: usedInbox
    };
}

/* =========================================================
   CREDIT RPC + END-TO-END POST EXECUTION
========================================================= */

export async function fetchSocialPostFeatureCost(supabaseUrl, serviceKey, fetchImpl = globalThis.fetch) {
    try {
        const resp = await fetchImpl(
            `${supabaseUrl}/rest/v1/feature_credit_settings?select=credit_cost&feature_id=eq.${SOCIAL_VIDEO_FEATURE_ID}&limit=1`,
            {
                method: "GET",
                headers: {
                    apikey: serviceKey,
                    Authorization: `Bearer ${serviceKey}`
                }
            }
        );
        if (resp.ok) {
            const rows = await resp.json().catch(() => []);
            if (Array.isArray(rows) && rows[0]?.credit_cost !== undefined) {
                return Math.max(0, Number(rows[0].credit_cost) || 0);
            }
        }
    } catch {
        /* fallback */
    }
    return DEFAULT_SOCIAL_POST_COST;
}

async function chargePostCreditsRpc({
    supabaseUrl,
    serviceKey,
    userId,
    transactionId,
    platform,
    title,
    fetchImpl
}) {
    const resp = await fetchImpl(`${supabaseUrl}/rest/v1/rpc/charge_feature_credits`, {
        method: "POST",
        headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            p_user_id: userId,
            p_feature_id: SOCIAL_VIDEO_FEATURE_ID,
            p_transaction_id: transactionId,
            p_prompt: `[${String(platform || "").toUpperCase()}] ${String(title || "Auto Post Video").slice(0, 140)}`,
            p_model_id: "social-video-autopost",
            p_model_name: `Social Video Auto Post (${String(platform || "").toUpperCase()})`
        })
    });

    const data = await resp.json().catch(() => null);
    if (!resp.ok) {
        const msg = String(data?.message || data?.error || "");
        if (msg.includes("INSUFFICIENT_CREDITS")) {
            const err = new Error("Saldo kredit tidak mencukupi untuk mem-posting video ke akun medsos.");
            err.status = 402;
            err.code = "INSUFFICIENT_CREDITS";
            throw err;
        }
        const err = new Error(`Gagal memotong kredit posting sosmed: ${msg || resp.status}`);
        err.status = 500;
        throw err;
    }

    return Array.isArray(data) ? data[0] : data;
}

async function settlePostCreditsRpc({
    supabaseUrl,
    serviceKey,
    userId,
    transactionId,
    outcome,
    resultUrl,
    errorMessage,
    fetchImpl
}) {
    try {
        await fetchImpl(`${supabaseUrl}/rest/v1/rpc/settle_feature_credits`, {
            method: "POST",
            headers: {
                apikey: serviceKey,
                Authorization: `Bearer ${serviceKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                p_user_id: userId,
                p_transaction_id: transactionId,
                p_outcome: outcome,
                p_result_url: resultUrl || null,
                p_error_message: errorMessage || null
            })
        });
    } catch {
        /* non-fatal */
    }
}

async function updateSocialVideoPostRow(supabaseUrl, serviceKey, postId, patch, fetchImpl) {
    await fetchImpl(
        `${supabaseUrl}/rest/v1/social_video_posts?id=eq.${encodeURIComponent(postId)}`,
        {
            method: "PATCH",
            headers: {
                apikey: serviceKey,
                Authorization: `Bearer ${serviceKey}`,
                "Content-Type": "application/json",
                Prefer: "return=minimal"
            },
            body: JSON.stringify({
                ...patch,
                updated_at: new Date().toISOString()
            })
        }
    ).catch(() => {});
}

export async function executeSocialVideoPostRow({
    postRow,
    accountRow = null,
    appsConfig = null,
    env = {},
    supabaseUrl,
    serviceKey,
    fetchImpl = globalThis.fetch
}) {
    const resolvedApps = appsConfig || (await loadSocialVideoOAuthAppsConfig(env, { fetchImpl }));

    let acct = accountRow;
    if (!acct) {
        const qs = new URLSearchParams({
            select: "*",
            id: `eq.${postRow.account_id}`,
            user_id: `eq.${postRow.user_id}`,
            limit: "1"
        });
        const acctResp = await fetchImpl(
            `${supabaseUrl}/rest/v1/social_video_accounts?${qs.toString()}`,
            {
                method: "GET",
                headers: {
                    apikey: serviceKey,
                    Authorization: `Bearer ${serviceKey}`
                }
            }
        );
        const rows = await acctResp.json().catch(() => []);
        acct = Array.isArray(rows) ? rows[0] : null;
    }

    if (!acct || acct.status !== "active") {
        const msg = "Akun medsos tujuan tidak ditemukan atau sudah diputuskan.";
        await updateSocialVideoPostRow(
            supabaseUrl,
            serviceKey,
            postRow.id,
            { status: "failed", error_message: msg },
            fetchImpl
        );
        return { ok: false, postId: postRow.id, error: msg, refunded: false };
    }

    const txId = postRow.credit_transaction_id || crypto.randomUUID();
    let chargedCost = Number(postRow.credit_cost) || 0;
    let didCharge = false;

    try {
        const chargeRes = await chargePostCreditsRpc({
            supabaseUrl,
            serviceKey,
            userId: postRow.user_id,
            transactionId: txId,
            platform: acct.platform,
            title: postRow.title || postRow.caption,
            fetchImpl
        });
        didCharge = true;
        chargedCost = Number(chargeRes?.cost ?? chargedCost);
    } catch (chargeErr) {
        await updateSocialVideoPostRow(
            supabaseUrl,
            serviceKey,
            postRow.id,
            {
                status: "failed",
                error_message: chargeErr.message || "Saldo kredit tidak mencukupi."
            },
            fetchImpl
        );
        return {
            ok: false,
            postId: postRow.id,
            status: chargeErr.status || 402,
            error: chargeErr.message,
            refunded: false
        };
    }

    try {
        const publishableVideoUrl = await resolvePublishableVideoUrl(postRow.video_ref, {
            userId: postRow.user_id,
            supabaseUrl,
            serviceKey,
            fetchImpl
        });

        const accessToken = await ensureFreshAccountAccessToken({
            accountRow: acct,
            env,
            appsConfig: resolvedApps,
            supabaseUrl,
            serviceKey,
            fetchImpl
        });

        let published;
        if (acct.platform === "facebook") {
            published = await publishVideoToFacebookPage({
                pageId: acct.external_account_id,
                pageAccessToken: accessToken,
                videoUrl: publishableVideoUrl,
                title: postRow.title,
                caption: postRow.caption,
                hashtags: postRow.hashtags,
                fetchImpl
            });
        } else if (acct.platform === "youtube") {
            published = await publishVideoToYouTubeChannel({
                accessToken,
                videoUrl: publishableVideoUrl,
                title: postRow.title,
                caption: postRow.caption,
                hashtags: postRow.hashtags,
                privacyLevel: postRow.privacy_level,
                fetchImpl
            });
        } else if (acct.platform === "tiktok") {
            published = await publishVideoToTikTokAccount({
                accessToken,
                accountHandle: acct.account_handle || "",
                videoUrl: publishableVideoUrl,
                title: postRow.title,
                caption: postRow.caption,
                hashtags: postRow.hashtags,
                privacyLevel: postRow.privacy_level,
                defaultPostMode: resolvedApps.tiktok?.postMode || "direct",
                fetchImpl
            });
        } else {
            throw new Error(`Platform '${acct.platform}' tidak didukung.`);
        }

        await settlePostCreditsRpc({
            supabaseUrl,
            serviceKey,
            userId: postRow.user_id,
            transactionId: txId,
            outcome: "complete",
            resultUrl: published.remotePostUrl,
            fetchImpl
        });

        const publishedAt = new Date().toISOString();
        await updateSocialVideoPostRow(
            supabaseUrl,
            serviceKey,
            postRow.id,
            {
                status: "published",
                credit_transaction_id: txId,
                credit_cost: chargedCost,
                credit_refunded: false,
                remote_post_id: published.remotePostId,
                remote_post_url: published.remotePostUrl,
                error_message: null,
                published_at: publishedAt
            },
            fetchImpl
        );

        return {
            ok: true,
            postId: postRow.id,
            platform: acct.platform,
            accountName: acct.account_name,
            remotePostId: published.remotePostId,
            remotePostUrl: published.remotePostUrl,
            deliveredToInbox: Boolean(published.deliveredToInbox),
            creditCost: chargedCost
        };
    } catch (pubErr) {
        if (didCharge) {
            await settlePostCreditsRpc({
                supabaseUrl,
                serviceKey,
                userId: postRow.user_id,
                transactionId: txId,
                outcome: "refund",
                errorMessage: pubErr?.message || "Gagal mem-posting video.",
                fetchImpl
            });
        }

        await updateSocialVideoPostRow(
            supabaseUrl,
            serviceKey,
            postRow.id,
            {
                status: "failed",
                credit_transaction_id: txId,
                credit_cost: chargedCost,
                credit_refunded: didCharge,
                error_message: String(pubErr?.message || "Gagal mem-posting video.").slice(0, 500)
            },
            fetchImpl
        );

        return {
            ok: false,
            postId: postRow.id,
            platform: acct.platform,
            accountName: acct.account_name,
            error: pubErr?.message || "Gagal mem-posting video.",
            refunded: didCharge
        };
    }
}
