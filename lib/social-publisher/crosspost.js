/* =========================================================
   GEN-Z.AI — SOCIAL CROSSPOST QUEUE
   ---------------------------------------------------------
   File: lib/social-publisher/crosspost.js

   Menjembatani konten Facebook (Kata-kata Mutiara + musik,
   format video mp4) ke akun YouTube/TikTok yang terhubung.

   Alur: file video yang sudah ada dalam memori (hasil render
   pratinjau manual atau cron jadwal) diunggah ke bucket privat
   `user-uploads` pada path milik user, lalu tiap akun tujuan
   mendapat satu baris `social_video_posts` berstatus
   `scheduled` dengan `scheduled_for = now()` — diambil cron
   claim (`claim_due_social_video_posts`) dalam ±1 menit.

   SISTEM LANGGANAN: antrean crosspost tidak memotong kredit
   dan tidak menyentuh generation_history.
   ========================================================= */

import { buildPrivateMediaRef } from "../generate/private-media.js";

const CROSSPOST_BUCKET = "user-uploads";
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_CROSSPOST_ACCOUNTS = 10;
const MAX_ERROR_LENGTH = 300;

export function sanitizeSocialVideoAccountIds(value, { max = MAX_CROSSPOST_ACCOUNTS } = {}) {
    const raw = Array.isArray(value)
        ? value
        : typeof value === "string"
            ? value.split(",")
            : [];
    return [...new Set(raw.map(item => String(item || "").trim()).filter(item => UUID_REGEX.test(item)))].slice(0, max);
}

function assertConfig(config) {
    if (!config?.url || !config?.serviceRoleKey) {
        throw new Error("Konfigurasi Supabase untuk crosspost belum lengkap.");
    }
}

async function restRequest(config, path, options = {}) {
    const response = await fetch(`${String(config.url).replace(/\/+$/, "")}${path}`, {
        ...options,
        headers: {
            apikey: config.serviceRoleKey,
            Authorization: `Bearer ${config.serviceRoleKey}`,
            ...(options.headers || {})
        }
    });
    if (!response.ok) {
        const text = await response.text().catch(() => "");
        let data = null;
        if (text) {
            try { data = JSON.parse(text); } catch { data = { message: text }; }
        }
        throw new Error(String(data?.message || data?.error || `Crosspost request gagal (HTTP ${response.status}).`).slice(0, MAX_ERROR_LENGTH));
    }
    return response;
}

/**
 * Simpan bytes video ke bucket privat milik user.
 *
 * @returns {Promise<string>} referensi stabil `supabase-private://user-uploads/...`
 */
export async function uploadCrosspostVideo({ config, userId, bytes, fileName = "crosspost.mp4", mimeType = "video/mp4" }) {
    assertConfig(config);
    if (!bytes?.length) throw new Error("Bytes video crosspost kosong.");
    const safeUser = String(userId || "").replace(/[^0-9a-fA-F-]/g, "").slice(0, 40);
    if (!safeUser) throw new Error("User crosspost tidak valid.");
    const safeName = String(fileName || "crosspost.mp4").replace(/[^a-z0-9.-]/gi, "").slice(0, 80) || "crosspost.mp4";
    const objectPath = `social-video/${safeUser}/${Date.now()}-${safeName}`;
    const encodedPath = objectPath.split("/").map(segment => encodeURIComponent(segment)).join("/");
    await restRequest(
        config,
        `/storage/v1/object/${encodeURIComponent(CROSSPOST_BUCKET)}/${encodedPath}`,
        {
            method: "POST",
            headers: { "Content-Type": mimeType || "video/mp4" },
            body: bytes
        }
    );
    return buildPrivateMediaRef({ bucket: CROSSPOST_BUCKET, objectPath });
}

/**
 * Antrekan crosspost ke akun YouTube/TikTok milik user.
 *
 * @param {object} params
 * @param {string[]} params.accountIds id akun social_video_accounts
 * @param {Uint8Array} params.videoBytes mp4 hasil render
 * @returns {Promise<{queued: number, videoRef: string, accounts: Array}>}
 */
export async function queueSocialVideoCrosspost({
    config,
    userId,
    accountIds,
    videoBytes,
    title = "",
    caption = "",
    hashtags = "",
    privacyLevel = "public",
    fileName = "crosspost.mp4",
    videoRef = ""
}) {
    assertConfig(config);
    const requestedIds = sanitizeSocialVideoAccountIds(accountIds);
    if (!requestedIds.length) return { queued: 0, videoRef: "", accounts: [] };

    /* Hanya akun aktif milik user yang boleh dipakai. */
    const qs = new URLSearchParams({
        select: "id,platform",
        user_id: `eq.${userId}`,
        status: "eq.active"
    });
    const accountResp = await restRequest(config, `/rest/v1/social_video_accounts?${qs.toString()}`, {});
    const ownedAccounts = await accountResp.json().catch(() => []);
    const selectedAccounts = (Array.isArray(ownedAccounts) ? ownedAccounts : [])
        .filter(item => requestedIds.includes(item.id));
    if (!selectedAccounts.length) return { queued: 0, videoRef: "", accounts: [] };

    const finalVideoRef = videoRef || await uploadCrosspostVideo({ config, userId, bytes: videoBytes, fileName });

    const nowIso = new Date().toISOString();
    const rows = selectedAccounts.map(account => ({
        id: crypto.randomUUID(),
        user_id: userId,
        account_id: account.id,
        platform: account.platform,
        video_source_type: "upload",
        video_ref: finalVideoRef,
        title: String(title || "").slice(0, 120),
        caption: String(caption || "").slice(0, 4500),
        hashtags: String(hashtags || "").slice(0, 400),
        privacy_level: ["public", "unlisted", "private", "self_only", "inbox_draft"].includes(String(privacyLevel))
            ? String(privacyLevel)
            : "public",
        scheduled_for: nowIso,
        status: "scheduled",
        credit_cost: 0,
        attempts: 0
    }));
    const insertResp = await restRequest(config, "/rest/v1/social_video_posts", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Prefer: "return=representation"
        },
        body: JSON.stringify(rows)
    });
    const inserted = await insertResp.json().catch(() => []);
    return {
        queued: Array.isArray(inserted) ? inserted.length : 0,
        videoRef: finalVideoRef,
        accounts: selectedAccounts
    };
}
