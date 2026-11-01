/* =========================================================
   GEN-Z.AI — SOCIAL VIDEO OAUTH APP & ACCOUNT CREDENTIALS
   ---------------------------------------------------------
   File:
     lib/social-video/app-credentials.js

   Mengelola kredensial OAuth App (Facebook Meta, YouTube Google,
   TikTok Developer) di Vault Supabase `public.provider_credentials`
   secara terenkripsi AES-256-GCM (dengan fallback otomatis ke
   variabel environment Worker seperti `META_APP_ID`), serta
   enkripsi/dekripsi token OAuth per-user pada tabel
   `public.social_video_accounts`.
========================================================= */

import {
    decryptCredentialRow,
    encryptCredentialPlaintext,
    maskSecretPreview,
    saveProviderCredentialPlaintext
} from "../opus/opusclip-credentials.js";

export const SOCIAL_VIDEO_META_PROVIDER_ID = "social_video_meta";
export const SOCIAL_VIDEO_YOUTUBE_PROVIDER_ID = "social_video_youtube";
export const SOCIAL_VIDEO_TIKTOK_PROVIDER_ID = "social_video_tiktok";

export const SOCIAL_VIDEO_OAUTH_CALLBACK_PATH = "/api/social-video-oauth-callback";

function envStr(env, key) {
    const val = env?.[key] ?? (typeof process !== "undefined" ? process.env?.[key] : "");
    return String(val || "").trim();
}

export function resolveSocialVideoPublicOrigin(req, env = {}) {
    const headers = req?.headers || {};
    const rawHost = String(headers["x-forwarded-host"] || headers.host || "")
        .split(",")[0]
        .trim();
    if (rawHost && !rawHost.startsWith("genzai.local")) {
        const forwardedProto = String(headers["x-forwarded-proto"] || "")
            .split(",")[0]
            .trim();
        let proto = forwardedProto;
        if (!proto) {
            try {
                const visitor = JSON.parse(String(headers["cf-visitor"] || "{}"));
                proto = String(visitor?.scheme || "");
            } catch {
                proto = "";
            }
        }
        if (!proto) {
            proto = rawHost.startsWith("localhost") || rawHost.startsWith("127.0.0.1")
                ? "http"
                : "https";
        }
        return `${proto}://${rawHost}`;
    }

    const metaRedirect = envStr(env, "META_REDIRECT_URI");
    if (metaRedirect) {
        try {
            return new URL(metaRedirect).origin;
        } catch {
            /* ignore */
        }
    }
    return "https://genzai.genzai-f37.workers.dev";
}

export function resolveSocialVideoRedirectUri(req, env = {}) {
    const explicit = envStr(env, "SOCIAL_VIDEO_REDIRECT_URI");
    if (explicit) return explicit;
    return `${resolveSocialVideoPublicOrigin(req, env)}${SOCIAL_VIDEO_OAUTH_CALLBACK_PATH}`;
}

async function readProviderJson(env, providerId, fetchImpl = globalThis.fetch) {
    const supabaseUrl = envStr(env, "SUPABASE_URL").replace(/\/+$/, "");
    const serviceKey = envStr(env, "SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey || typeof fetchImpl !== "function") {
        return { data: null, updatedAt: null, fromDb: false };
    }

    try {
        const qs = new URLSearchParams({
            select: "provider_id,api_key_ciphertext,api_key_iv,api_key_tag,updated_at",
            provider_id: `eq.${providerId}`,
            limit: "1"
        });
        const resp = await fetchImpl(
            `${supabaseUrl}/rest/v1/provider_credentials?${qs.toString()}`,
            {
                method: "GET",
                headers: {
                    apikey: serviceKey,
                    Authorization: `Bearer ${serviceKey}`
                }
            }
        );
        if (!resp.ok) return { data: null, updatedAt: null, fromDb: false };
        const rows = await resp.json().catch(() => []);
        if (!Array.isArray(rows) || !rows[0]) {
            return { data: null, updatedAt: null, fromDb: false };
        }
        const plaintext = decryptCredentialRow(rows[0], env);
        if (!plaintext) return { data: null, updatedAt: null, fromDb: false };
        const parsed = JSON.parse(plaintext);
        return {
            data: parsed && typeof parsed === "object" ? parsed : null,
            updatedAt: rows[0].updated_at || null,
            fromDb: true
        };
    } catch {
        return { data: null, updatedAt: null, fromDb: false };
    }
}

export async function loadSocialVideoOAuthAppsConfig(env = {}, { fetchImpl = globalThis.fetch } = {}) {
    const [metaDb, ytDb, ttDb] = await Promise.all([
        readProviderJson(env, SOCIAL_VIDEO_META_PROVIDER_ID, fetchImpl),
        readProviderJson(env, SOCIAL_VIDEO_YOUTUBE_PROVIDER_ID, fetchImpl),
        readProviderJson(env, SOCIAL_VIDEO_TIKTOK_PROVIDER_ID, fetchImpl)
    ]);

    const fbAppId = String(metaDb.data?.appId || envStr(env, "META_APP_ID")).trim();
    const fbAppSecret = String(metaDb.data?.appSecret || envStr(env, "META_APP_SECRET")).trim();
    const fbLoginConfigId = String(
        metaDb.data?.loginConfigId !== undefined
            ? metaDb.data.loginConfigId
            : envStr(env, "META_LOGIN_CONFIG_ID")
    ).trim();
    const fbSource = metaDb.fromDb && metaDb.data?.appId
        ? "supabase_vault"
        : fbAppId && fbAppSecret
            ? "worker_env"
            : "none";

    const ytClientId = String(
        ytDb.data?.clientId || envStr(env, "GOOGLE_CLIENT_ID") || envStr(env, "YOUTUBE_CLIENT_ID")
    ).trim();
    const ytClientSecret = String(
        ytDb.data?.clientSecret || envStr(env, "GOOGLE_CLIENT_SECRET") || envStr(env, "YOUTUBE_CLIENT_SECRET")
    ).trim();
    const ytSource = ytDb.fromDb && ytDb.data?.clientId
        ? "supabase_vault"
        : ytClientId && ytClientSecret
            ? "worker_env"
            : "none";

    const ttClientKey = String(ttDb.data?.clientKey || envStr(env, "TIKTOK_CLIENT_KEY")).trim();
    const ttClientSecret = String(ttDb.data?.clientSecret || envStr(env, "TIKTOK_CLIENT_SECRET")).trim();
    const rawPostMode = String(ttDb.data?.postMode || envStr(env, "TIKTOK_POST_MODE") || "direct")
        .trim()
        .toLowerCase();
    const ttPostMode = rawPostMode === "inbox" ? "inbox" : "direct";
    const ttSource = ttDb.fromDb && ttDb.data?.clientKey
        ? "supabase_vault"
        : ttClientKey && ttClientSecret
            ? "worker_env"
            : "none";

    return {
        facebook: {
            configured: Boolean(fbAppId && fbAppSecret),
            appId: fbAppId,
            appSecret: fbAppSecret,
            loginConfigId: fbLoginConfigId,
            maskedAppId: maskSecretPreview(fbAppId),
            source: fbSource,
            updatedAt: metaDb.updatedAt
        },
        youtube: {
            configured: Boolean(ytClientId && ytClientSecret),
            clientId: ytClientId,
            clientSecret: ytClientSecret,
            maskedClientId: maskSecretPreview(ytClientId),
            source: ytSource,
            updatedAt: ytDb.updatedAt
        },
        tiktok: {
            configured: Boolean(ttClientKey && ttClientSecret),
            clientKey: ttClientKey,
            clientSecret: ttClientSecret,
            postMode: ttPostMode,
            maskedClientKey: maskSecretPreview(ttClientKey),
            source: ttSource,
            updatedAt: ttDb.updatedAt
        }
    };
}

export async function saveSocialVideoOAuthAppConfig(
    env,
    { platform, appId, appSecret, loginConfigId = "", clientId, clientSecret, clientKey, postMode = "direct" } = {},
    { fetchImpl = globalThis.fetch } = {}
) {
    const cleanPlatform = String(platform || "").trim().toLowerCase();

    if (cleanPlatform === "facebook") {
        const id = String(appId || clientId || "").trim();
        const secret = String(appSecret || clientSecret || "").trim();
        if (!id || !secret) {
            const err = new Error("META_APP_ID dan META_APP_SECRET wajib diisi untuk Facebook.");
            err.status = 400;
            throw err;
        }
        const saved = await saveProviderCredentialPlaintext(env, {
            providerId: SOCIAL_VIDEO_META_PROVIDER_ID,
            providerName: "Social Video OAuth — Facebook Meta",
            description: "Kredensial OAuth Meta App multi-user (Facebook Page & Reels).",
            plaintext: JSON.stringify({
                appId: id,
                appSecret: secret,
                loginConfigId: String(loginConfigId || "").trim()
            }),
            fetchImpl
        });
        return {
            platform: "facebook",
            configured: true,
            maskedId: maskSecretPreview(id),
            updatedAt: saved.updatedAt
        };
    }

    if (cleanPlatform === "youtube") {
        const id = String(clientId || appId || "").trim();
        const secret = String(clientSecret || appSecret || "").trim();
        if (!id || !secret) {
            const err = new Error("Google Client ID dan Client Secret wajib diisi untuk YouTube.");
            err.status = 400;
            throw err;
        }
        const saved = await saveProviderCredentialPlaintext(env, {
            providerId: SOCIAL_VIDEO_YOUTUBE_PROVIDER_ID,
            providerName: "Social Video OAuth — YouTube Google",
            description: "Kredensial OAuth Google Cloud (YouTube Data API v3 Upload).",
            plaintext: JSON.stringify({ clientId: id, clientSecret: secret }),
            fetchImpl
        });
        return {
            platform: "youtube",
            configured: true,
            maskedId: maskSecretPreview(id),
            updatedAt: saved.updatedAt
        };
    }

    if (cleanPlatform === "tiktok") {
        const key = String(clientKey || clientId || appId || "").trim();
        const secret = String(clientSecret || appSecret || "").trim();
        if (!key || !secret) {
            const err = new Error("TikTok Client Key dan Client Secret wajib diisi untuk TikTok.");
            err.status = 400;
            throw err;
        }
        const normalizedMode = String(postMode || "direct").trim().toLowerCase() === "inbox"
            ? "inbox"
            : "direct";
        const saved = await saveProviderCredentialPlaintext(env, {
            providerId: SOCIAL_VIDEO_TIKTOK_PROVIDER_ID,
            providerName: "Social Video OAuth — TikTok Developer",
            description: "Kredensial OAuth TikTok Content Posting API v2.",
            plaintext: JSON.stringify({
                clientKey: key,
                clientSecret: secret,
                postMode: normalizedMode
            }),
            fetchImpl
        });
        return {
            platform: "tiktok",
            configured: true,
            postMode: normalizedMode,
            maskedId: maskSecretPreview(key),
            updatedAt: saved.updatedAt
        };
    }

    const err = new Error("Platform OAuth tidak dikenali (pilih facebook, youtube, atau tiktok).");
    err.status = 400;
    throw err;
}

export function encryptAccountTokenPair(accessToken, refreshToken = "", env = {}) {
    const accessEnc = encryptCredentialPlaintext(String(accessToken || ""), env);
    const result = {
        token_ciphertext: accessEnc.api_key_ciphertext,
        token_iv: accessEnc.api_key_iv,
        token_tag: accessEnc.api_key_tag,
        refresh_ciphertext: null,
        refresh_iv: null,
        refresh_tag: null
    };

    const cleanRefresh = String(refreshToken || "").trim();
    if (cleanRefresh) {
        const refreshEnc = encryptCredentialPlaintext(cleanRefresh, env);
        result.refresh_ciphertext = refreshEnc.api_key_ciphertext;
        result.refresh_iv = refreshEnc.api_key_iv;
        result.refresh_tag = refreshEnc.api_key_tag;
    }

    return result;
}

export function decryptAccountTokenPair(accountRow = {}, env = {}) {
    const accessToken = decryptCredentialRow(
        {
            api_key_ciphertext: accountRow.token_ciphertext,
            api_key_iv: accountRow.token_iv,
            api_key_tag: accountRow.token_tag
        },
        env
    );

    const refreshToken = accountRow.refresh_ciphertext
        ? decryptCredentialRow(
            {
                api_key_ciphertext: accountRow.refresh_ciphertext,
                api_key_iv: accountRow.refresh_iv,
                api_key_tag: accountRow.refresh_tag
            },
            env
        )
        : "";

    return { accessToken, refreshToken };
}
