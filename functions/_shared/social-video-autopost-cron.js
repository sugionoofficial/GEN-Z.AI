/* =========================================================
   GEN-Z.AI — SOCIAL VIDEO AUTO POST SCHEDULED CRON RUNNER
   ---------------------------------------------------------
   File:
     functions/_shared/social-video-autopost-cron.js

   Dipanggil setiap menit dari `scheduled()` di `functions/worker.mjs`
   saat Social Publisher utama tidak sedang sibuk, untuk mengklaim
   maks. 2 postingan video jatuh tempo (`claim_due_social_video_posts`)
   dan mengeksekusinya lengkap dengan potong kredit + auto-refund.
========================================================= */

import { loadSocialVideoOAuthAppsConfig } from "../../lib/social-video/app-credentials.js";
import { executeSocialVideoPostRow } from "../../lib/social-video/publisher.js";

function envValue(env, key) {
    const proc = typeof process !== "undefined" ? process.env?.[key] : "";
    return String(env?.[key] || proc || "").trim();
}

export async function runSocialVideoAutopostCron(env = {}, now = new Date(), options = {}) {
    const supabaseUrl = envValue(env, "SUPABASE_URL").replace(/\/+$/, "");
    const serviceKey = envValue(env, "SUPABASE_SERVICE_ROLE_KEY");
    const fetchImpl = options.fetchImpl || globalThis.fetch;

    if (!supabaseUrl || !serviceKey || typeof fetchImpl !== "function") {
        return { ok: false, skipped: true, claimed: 0 };
    }

    const claimResp = await fetchImpl(
        `${supabaseUrl}/rest/v1/rpc/claim_due_social_video_posts`,
        {
            method: "POST",
            headers: {
                apikey: serviceKey,
                Authorization: `Bearer ${serviceKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                p_now: (now instanceof Date ? now : new Date(now)).toISOString(),
                p_limit: Number(options.limit) || 2
            })
        }
    );

    if (!claimResp.ok) {
        return { ok: false, claimed: 0, status: claimResp.status };
    }

    const duePosts = await claimResp.json().catch(() => []);
    if (!Array.isArray(duePosts) || duePosts.length === 0) {
        return { ok: true, claimed: 0, published: 0, failed: 0 };
    }

    const appsConfig = await loadSocialVideoOAuthAppsConfig(env, { fetchImpl });
    let published = 0;
    let failed = 0;

    for (const postRow of duePosts) {
        const res = await executeSocialVideoPostRow({
            postRow,
            appsConfig,
            env,
            supabaseUrl,
            serviceKey,
            fetchImpl
        });
        if (res.ok) published += 1;
        else failed += 1;
    }

    return {
        ok: true,
        claimed: duePosts.length,
        published,
        failed
    };
}
