/* =========================================================
   GEN-Z.AI — SOCIAL VIDEO OAUTH APP ADMIN API
   ---------------------------------------------------------
   File:
     api/social-video-admin.js

   Endpoint khusus Owner & Admin (`/api/social-video-admin`)
   untuk mengelola kredensial aplikasi OAuth multi-user yang
   dipakai tombol Hubungkan Facebook/YouTube/TikTok di Studio Medsos.

   - `action=status`               : status terenkripsi + redirect URI
   - `action=save_social_oauth_app`: simpan/rotasi OAuth App per platform

   Kredensial user akhir tetap terpisah di `social_video_accounts`.
========================================================= */

import {
    authenticateSupabaseUser,
    resolveRuntimeEnv
} from "../lib/opus/load-opus-credential.js";
import {
    loadSocialVideoOAuthAppsConfig,
    resolveSocialVideoRedirectUri,
    saveSocialVideoOAuthAppConfig
} from "../lib/social-video/app-credentials.js";

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

function publicAppStatus(apps, platform) {
    const cfg = apps[platform] || {};
    return {
        configured: Boolean(cfg.configured),
        source: cfg.source || "none",
        maskedId: cfg.maskedAppId || cfg.maskedClientId || cfg.maskedClientKey || null,
        hasLoginConfigId: platform === "facebook" ? Boolean(cfg.loginConfigId) : undefined,
        postMode: platform === "tiktok" ? cfg.postMode || "direct" : undefined,
        updatedAt: cfg.updatedAt || null
    };
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
    const fetchImpl = req?.fetchImpl || globalThis.fetch;
    const auth = await authenticateSupabaseUser(req, env, {
        requireAdminOrOwner: true,
        fetchImpl
    });
    if (!auth.ok) {
        return sendJson(res, auth.status, {
            success: false,
            error: auth.error
        });
    }

    const body = parseJsonBody(req);
    const url = new URL(req.url || "/api/social-video-admin", "https://genzai.local");
    const action = String(
        body.action || url.searchParams.get("action") || "status"
    ).trim().toLowerCase();

    if (action === "save_social_oauth_app") {
        if (req.method !== "POST") {
            return sendJson(res, 405, {
                success: false,
                error: "Gunakan POST untuk menyimpan kredensial OAuth medsos."
            });
        }
        try {
            const saved = await saveSocialVideoOAuthAppConfig(
                env,
                {
                    platform: body.platform,
                    appId: body.appId,
                    appSecret: body.appSecret,
                    loginConfigId: body.loginConfigId,
                    clientId: body.clientId,
                    clientSecret: body.clientSecret,
                    clientKey: body.clientKey,
                    postMode: body.postMode
                },
                { fetchImpl }
            );
            return sendJson(res, 200, {
                success: true,
                action: "save_social_oauth_app",
                message: `Kredensial OAuth ${saved.platform.toUpperCase()} berhasil dienkripsi ke Vault Supabase.`,
                saved
            });
        } catch (err) {
            return sendJson(res, err?.status || 500, {
                success: false,
                error: err?.message || "Gagal menyimpan kredensial OAuth medsos."
            });
        }
    }

    if (action === "status") {
        try {
            const apps = await loadSocialVideoOAuthAppsConfig(env, { fetchImpl });
            return sendJson(res, 200, {
                success: true,
                action: "status",
                checkedAt: new Date().toISOString(),
                operator: {
                    email: auth.user.email,
                    role: auth.user.role
                },
                socialApps: {
                    redirectUri: resolveSocialVideoRedirectUri(req, env),
                    facebook: publicAppStatus(apps, "facebook"),
                    youtube: publicAppStatus(apps, "youtube"),
                    tiktok: publicAppStatus(apps, "tiktok")
                }
            });
        } catch (err) {
            return sendJson(res, err?.status || 500, {
                success: false,
                error: err?.message || "Gagal memuat status OAuth medsos."
            });
        }
    }

    return sendJson(res, 400, {
        success: false,
        error: `Action '${action}' tidak dikenali pada /api/social-video-admin.`
    });
}
