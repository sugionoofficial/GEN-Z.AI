/* =========================================================
   GEN-Z.AI — UNIVERSAL SOCIAL VIDEO OAUTH CALLBACK
   ---------------------------------------------------------
   File:
     api/social-video-oauth-callback.js

   Callback tunggal bersih (`/api/social-video-oauth-callback`)
   untuk ketiga platform multi-user:
   - Facebook Page & Reels
   - YouTube Channel & Shorts
   - TikTok Creator Account

   Memverifikasi `state_hash` pada `public.social_video_oauth_states`
   (sekali pakai + TTL 15 menit), menukar `code` menjadi token akses
   & refresh, mengenkripsi AES-256-GCM ke `public.social_video_accounts`
   milik `user_id` terkait, lalu me-redirect kembali ke `/opusclip/?tab=social`.
========================================================= */

import { resolveRuntimeEnv } from "../lib/opus/load-opus-credential.js";
import {
    encryptAccountTokenPair,
    loadSocialVideoOAuthAppsConfig,
    resolveSocialVideoPublicOrigin,
    resolveSocialVideoRedirectUri
} from "../lib/social-video/app-credentials.js";
import {
    exchangePlatformOAuthCode,
    hashOAuthState
} from "../lib/social-video/publisher.js";

function redirectTo(res, location) {
    res.statusCode = 302;
    res.setHeader("Location", location);
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    return res.end("");
}

function safeReturnUrl(origin, returnPath, params = {}) {
    const cleanPath = String(returnPath || "/opusclip/?tab=social").startsWith("/")
        ? String(returnPath || "/opusclip/?tab=social")
        : "/opusclip/?tab=social";
    const target = new URL(cleanPath, origin);
    target.searchParams.set("tab", "social");
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== "") {
            target.searchParams.set(k, String(v));
        }
    }
    return target.toString();
}

export default async function handler(req, res) {
    const env = resolveRuntimeEnv(req);
    const fetchImpl = req?.fetchImpl || globalThis.fetch;
    const origin = resolveSocialVideoPublicOrigin(req, env);
    const redirectUri = resolveSocialVideoRedirectUri(req, env);

    if (req.method !== "GET" && req.method !== "HEAD") {
        res.statusCode = 405;
        res.setHeader("Allow", "GET, HEAD");
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        return res.end(JSON.stringify({ success: false, error: "Method tidak diizinkan." }));
    }

    const supabaseUrl = String(env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
    const serviceKey = String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
    if (!supabaseUrl || !serviceKey) {
        return redirectTo(
            res,
            safeReturnUrl(origin, "/opusclip/", { oauth_error: "Konfigurasi server belum lengkap." })
        );
    }

    const url = new URL(req.url || "/api/social-video-oauth-callback", origin);
    const providerErr = url.searchParams.get("error");
    const rawState = String(url.searchParams.get("state") || "").trim();
    const code = String(url.searchParams.get("code") || "").trim();

    if (!rawState) {
        return redirectTo(
            res,
            safeReturnUrl(origin, "/opusclip/", { oauth_error: "Parameter state OAuth tidak ditemukan." })
        );
    }

    const stateHash = hashOAuthState(rawState);
    const stateQs = new URLSearchParams({
        select: "id,user_id,platform,code_verifier,return_path,expires_at",
        state_hash: `eq.${stateHash}`,
        limit: "1"
    });

    let stateRow = null;
    try {
        const stateResp = await fetchImpl(
            `${supabaseUrl}/rest/v1/social_video_oauth_states?${stateQs.toString()}`,
            {
                method: "GET",
                headers: {
                    apikey: serviceKey,
                    Authorization: `Bearer ${serviceKey}`
                }
            }
        );
        const rows = await stateResp.json().catch(() => []);
        stateRow = Array.isArray(rows) ? rows[0] : null;
    } catch {
        stateRow = null;
    }

    if (!stateRow || Date.parse(stateRow.expires_at) <= Date.now()) {
        return redirectTo(
            res,
            safeReturnUrl(origin, "/opusclip/", {
                oauth_error: "Sesi login OAuth sudah kedaluwarsa. Silakan klik tombol Hubungkan kembali."
            })
        );
    }

    /* Hapus state sekali pakai segera (anti-replay) */
    await fetchImpl(
        `${supabaseUrl}/rest/v1/social_video_oauth_states?id=eq.${encodeURIComponent(stateRow.id)}`,
        {
            method: "DELETE",
            headers: {
                apikey: serviceKey,
                Authorization: `Bearer ${serviceKey}`
            }
        }
    ).catch(() => {});

    if (providerErr) {
        const desc = url.searchParams.get("error_description") || providerErr;
        return redirectTo(
            res,
            safeReturnUrl(origin, stateRow.return_path, {
                oauth_error: `Login ${stateRow.platform.toUpperCase()} dibatalkan: ${String(desc).slice(0, 140)}`
            })
        );
    }

    if (!code) {
        return redirectTo(
            res,
            safeReturnUrl(origin, stateRow.return_path, {
                oauth_error: "Kode otorisasi OAuth tidak diterima."
            })
        );
    }

    try {
        const appsConfig = await loadSocialVideoOAuthAppsConfig(env, { fetchImpl });
        const connectedList = await exchangePlatformOAuthCode({
            platform: stateRow.platform,
            code,
            codeVerifier: stateRow.code_verifier || "",
            redirectUri,
            appsConfig,
            fetchImpl
        });

        const nowIso = new Date().toISOString();
        const upsertRows = connectedList.map(item => {
            const encrypted = encryptAccountTokenPair(item.accessToken, item.refreshToken || "", env);
            return {
                user_id: stateRow.user_id,
                platform: item.platform,
                external_account_id: item.externalAccountId,
                account_name: item.accountName,
                account_handle: item.accountHandle || null,
                avatar_url: item.avatarUrl || null,
                ...encrypted,
                token_expires_at: item.tokenExpiresAt || null,
                scopes: item.scopes || null,
                status: "active",
                updated_at: nowIso
            };
        });

        /* Pertahankan refresh_token lama jika Google OAuth tidak mengirim ulang refresh_token baru */
        for (const row of upsertRows) {
            if (!row.refresh_ciphertext && row.platform === "youtube") {
                const existQs = new URLSearchParams({
                    select: "refresh_ciphertext,refresh_iv,refresh_tag",
                    user_id: `eq.${row.user_id}`,
                    platform: "eq.youtube",
                    external_account_id: `eq.${row.external_account_id}`,
                    limit: "1"
                });
                const existResp = await fetchImpl(
                    `${supabaseUrl}/rest/v1/social_video_accounts?${existQs.toString()}`,
                    {
                        method: "GET",
                        headers: {
                            apikey: serviceKey,
                            Authorization: `Bearer ${serviceKey}`
                        }
                    }
                );
                const existRows = await existResp.json().catch(() => []);
                const prev = Array.isArray(existRows) ? existRows[0] : null;
                if (prev?.refresh_ciphertext) {
                    row.refresh_ciphertext = prev.refresh_ciphertext;
                    row.refresh_iv = prev.refresh_iv;
                    row.refresh_tag = prev.refresh_tag;
                }
            }
        }

        const saveResp = await fetchImpl(
            `${supabaseUrl}/rest/v1/social_video_accounts?on_conflict=user_id,platform,external_account_id`,
            {
                method: "POST",
                headers: {
                    apikey: serviceKey,
                    Authorization: `Bearer ${serviceKey}`,
                    "Content-Type": "application/json",
                    Prefer: "resolution=merge-duplicates,return=minimal"
                },
                body: JSON.stringify(upsertRows)
            }
        );

        if (!saveResp.ok) {
            const errTxt = await saveResp.text().catch(() => "");
            throw new Error(`Gagal menyimpan akun terhubung (${saveResp.status}): ${errTxt.slice(0, 120)}`);
        }

        return redirectTo(
            res,
            safeReturnUrl(origin, stateRow.return_path, {
                connected: stateRow.platform,
                count: upsertRows.length
            })
        );
    } catch (err) {
        return redirectTo(
            res,
            safeReturnUrl(origin, stateRow.return_path, {
                oauth_error: String(err?.message || "Gagal menghubungkan akun medsos.").slice(0, 180)
            })
        );
    }
}
