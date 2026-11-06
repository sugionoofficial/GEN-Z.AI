import { runHandlerAdapter } from "./_shared/handler-adapter.js";
import adminCredit from "../api/admin-credit.js";
import adminCopilot from "../api/admin-copilot.js";
import featureCredits from "../api/feature-credits.js";
import freeCredit from "../api/free-credit.js";
import announcements from "../api/announcements.js";
import adminModels from "../api/admin-models.js";
import adminProviderCredentials from "../api/admin-provider-credentials.js";
import adminUsers from "../api/admin-users.js";
import adminCancelGeneration from "../api/admin-cancel-generation.js";
import account from "../api/account.js";
import adminDeletionRequests from "../api/admin-deletion-requests.js";
import generateStatus from "../api/generate-status.js";
import generate from "../api/generate.js";
import kieConfig from "../api/kie-config.js";
import modelConfig from "../api/model-config.js";
import openkeyChat from "../api/openkey-chat.js";
import opusOAuthLogin from "../api/opus-oauth-login.js";
import opusOAuthCallback from "../api/opus-oauth-callback.js";
import openClipsOAuthLogin from "../api/openclips-oauth-login.js";
import openClipsOAuthCallback from "../api/openclips-oauth-callback.js";
import opusVoicePreview from "../api/opus-voice-preview.js";
import opusBlackbox from "../api/opus-blackbox.js";
import socialVideoAdmin from "../api/social-video-admin.js";
import socialVideoAutopost from "../api/social-video-autopost.js";
import socialVideoOAuthCallback from "../api/social-video-oauth-callback.js";
import sightengineDetect from "../api/sightengine-detect.js";
import socialPublisher from "../api/social-publisher.js";
import facebookDataDeletion from "../api/facebook-data-deletion.js";
import monitoring from "../api/monitoring.js";
import { runSocialPublisherCron } from "./_shared/social-publisher-cron.js";
import { runSocialVideoAutopostCron } from "./_shared/social-video-autopost-cron.js";
import { runStorageRetentionCron } from "./_shared/storage-retention-cron.js";
import { runSupportGuestCleanupCron } from "./_shared/support-guest-cleanup-cron.js";
import { runMonitoringCron } from "./_shared/monitoring-cron.js";
import { buildProxyResponse, detectProxy } from "../lib/anti-proxy/detect.js";
import copilotSupabase from "../api/copilot-supabase.js";
import copilotCloudflare from "../api/copilot-cloudflare.js";
import copilotSession from "../api/copilot-session.js";
import copilotUpload from "../api/copilot-upload.js";
import handleTempmail from "./_shared/tempmail-handler.js";
import handleFbMediaDownload from "./_shared/fb-media-handler.js";
import antiProxyCheck from "../api/anti-proxy-check.js";

const handlers = new Map([
    ["/api/admin-credit", adminCredit],
    ["/api/admin-copilot", adminCopilot],
    ["/api/feature-credits", featureCredits],
    ["/api/free-credit", freeCredit],
    ["/api/announcements", announcements],
    ["/api/admin-models", adminModels],
    ["/api/admin-provider-credentials", adminProviderCredentials],
    ["/api/admin-users", adminUsers],
    ["/api/admin-cancel-generation", adminCancelGeneration],
    ["/api/account", account],
    ["/api/admin-deletion-requests", adminDeletionRequests],
    ["/api/generate-status", generateStatus],
    ["/api/generate", generate],
    ["/api/kie-config", kieConfig],
    ["/api/model-config", modelConfig],
    ["/api/openkey-chat", openkeyChat],
    // Login OAuth Opus lewat browser (tanpa Termux / Node.js).
    ["/api/opus-oauth-login", opusOAuthLogin],
    ["/api/opus-oauth-callback", opusOAuthCallback],
    ["/api/openclips-oauth-login", openClipsOAuthLogin],
    ["/api/openclips-oauth-callback", openClipsOAuthCallback],
    ["/api/opus-voice-preview", opusVoicePreview],
    ["/api/opus-blackbox", opusBlackbox],
    ["/api/social-video-admin", socialVideoAdmin],
    ["/api/social-video-autopost", socialVideoAutopost],
    ["/api/social-video-oauth-callback", socialVideoOAuthCallback],
    ["/api/sightengine-detect", sightengineDetect],
    ["/api/social-publisher", socialPublisher],
    ["/api/facebook-oauth-callback", socialPublisher],
    ["/api/facebook-data-deletion", facebookDataDeletion],
    // BLACK BOX // MONITORING — log aktivitas, kesehatan web, temuan bug.
    ["/api/copilot-supabase", copilotSupabase],
    ["/api/copilot-cloudflare", copilotCloudflare],
    ["/api/copilot-session", copilotSession],
    ["/api/copilot-upload", copilotUpload],
    ["/api/monitoring", monitoring],
    ["/api/anti-proxy-check", antiProxyCheck],
    // Alias kept for the Deauthorize/Deletion URL field in the Meta dashboard.
    ["/api/data-deletion", facebookDataDeletion]
]);

// =========================================================
// SECURITY HEADERS & EDGE RATE LIMITING
// =========================================================
const SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()"
};

const API_RATE_WINDOW_MS = 60_000;
const API_RATE_LIMIT_PER_WINDOW = 300;
const apiIpBuckets = new Map();

function checkApiRateLimit(ip) {
    const now = Date.now();
    if (apiIpBuckets.size > 5000) {
        for (const [k, entry] of apiIpBuckets) {
            if (now - entry.startedAt >= API_RATE_WINDOW_MS) {
                apiIpBuckets.delete(k);
            }
        }
    }
    const entry = apiIpBuckets.get(ip);
    if (!entry || now - entry.startedAt >= API_RATE_WINDOW_MS) {
        apiIpBuckets.set(ip, { startedAt: now, count: 1 });
        return true;
    }
    if (entry.count >= API_RATE_LIMIT_PER_WINDOW) {
        return false;
    }
    entry.count += 1;
    return true;
}

function applySecurityHeaders(response, isApi = false) {
    if (!response || !(response instanceof Response)) return response;
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
        if (!headers.has(key)) {
            headers.set(key, value);
        }
    }
    if (isApi && !headers.has("Cache-Control")) {
        headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    }
    const body = [204, 205, 304].includes(response.status) ? null : response.body;
    return new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers
    });
}

// =========================================================
// MAIN WORKER
// =========================================================
export default {
    async fetch(request, env, context) {
        const url = new URL(request.url);
        const pathname = url.pathname.replace(/\/+$/, "") || "/";

        // =====================================================
        // ANTI-PROXY / MITM (Reqable, Charles, Fiddler)
        // Putus koneksi bila API di-capture lewat proxy debugging.
        // =====================================================
        if (pathname.startsWith("/api/") && pathname !== "/api/anti-proxy-check") {
            const probe = detectProxy(request);
            if (probe.blocked) {
                // log ke monitoring (fire-and-forget) agar admin lihat di BLACK BOX
                try {
                    const ip = String(request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "").split(",")[0].trim();
                    const logHeaders = Object.fromEntries([...request.headers.entries()].slice(0, 12).map(([k,v])=>[k,String(v).slice(0,120)]));
                    context.waitUntil && context.waitUntil((async()=>{
                        try {
                            const envCfg = env || {};
                            if (!envCfg.SUPABASE_URL || !envCfg.SUPABASE_SERVICE_ROLE_KEY) return;
                            await fetch(`${String(envCfg.SUPABASE_URL).replace(/\/+$/,"")}/rest/v1/monitoring_events`, {
                                method:"POST",
                                headers:{ apikey: envCfg.SUPABASE_SERVICE_ROLE_KEY, Authorization:`Bearer ${envCfg.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type":"application/json", Prefer:"return=minimal" },
                                body: JSON.stringify({ kind:"security", severity:"critical", path: pathname, message:`Proxy/MITM terdeteksi: ${probe.reasonText.slice(0,300)}`, detail:{ reason: probe.reasonText, severity: probe.severity, headers: logHeaders, ip }, ip, user_agent: String(request.headers.get("user-agent")||"").slice(0,400) })
                            });
                        } catch{}
                    })());
                } catch{}
                const built = buildProxyResponse(probe.reasonText);
                return applySecurityHeaders(new Response(built.body, { status: built.status, headers: built.headers }), true);
            }
        }

        // Perlindungan Rate Limiting API terhadap flooding / brute-force Reqable
        if (
            pathname.startsWith("/api/") &&
            pathname !== "/api/facebook-data-deletion" &&
            pathname !== "/api/data-deletion"
        ) {
            const clientIp = String(
                request.headers.get("cf-connecting-ip") ||
                request.headers.get("x-forwarded-for") ||
                "edge-client"
            ).split(",")[0].trim();

            if (!checkApiRateLimit(clientIp)) {
                return applySecurityHeaders(
                    Response.json(
                        { error: "Too many requests. Please slow down." },
                        { status: 429, headers: { "Retry-After": "60", "Cache-Control": "no-store" } }
                    ),
                    true
                );
            }
        }

        // Route khusus Tempmail
        if (pathname === "/api/tempmail") {
            const res = await handleTempmail(request, env);
            return applySecurityHeaders(res, true);
        }

        // Route unduh & proses URL Facebook (GetMyFB) dan TikTok (SSSTik) untuk referensi media
        if (pathname === "/api/fb-media-download" || pathname === "/api/social-media-download") {
            const res = await handleFbMediaDownload(request, env);
            return applySecurityHeaders(res, true);
        }

        if (
            pathname === "/api/social-publisher" &&
            request.method === "POST" &&
            ["upload-reference", "upload-outfit", "upload-song"].includes(url.searchParams.get("action"))
        ) {
            const action = url.searchParams.get("action");
            const contentLength = Number(request.headers.get("content-length") || 0);
            const maxBytes = action === "upload-song" ? 16 * 1024 * 1024 : 8 * 1024 * 1024;
            if (contentLength > maxBytes) {
                const label = action === "upload-reference"
                    ? "File referensi"
                    : action === "upload-outfit"
                        ? "File outfit"
                        : "File lagu/audio";
                return applySecurityHeaders(
                    Response.json(
                        { success: false, error: `${label} maksimal ${action === "upload-song" ? "16" : "8"} MB.` },
                        { status: 413, headers: { "Cache-Control": "no-store" } }
                    ),
                    true
                );
            }
        }

        const handler = handlers.get(pathname);

        if (handler) {
            try {
                const res = await runHandlerAdapter(handler, request, context, env);
                return applySecurityHeaders(res, true);
            } catch (error) {
                console.error("[Cloudflare Worker] API request failed:", error);
                return applySecurityHeaders(
                    Response.json(
                        { error: "Internal server error" },
                        { status: 500 }
                    ),
                    true
                );
            }
        }

        if (pathname.startsWith("/api/")) {
            return applySecurityHeaders(
                Response.json({ error: "Not found" }, { status: 404 }),
                true
            );
        }

        // Inject anti-proxy guard ke halaman HTML (client-side lockdown)
        const assetRes = await env.ASSETS.fetch(request);
        const ct = assetRes.headers.get("content-type") || "";
        if (ct.includes("text/html")) {
            try {
                const html = await assetRes.text();
                if (html.includes("</head>") && !html.includes("anti-proxy-guard.js")) {
                    const injected = html.replace("</head>", '<script src="/assets/js/anti-proxy-guard.js?v=20261107a"></script></head>');
                    return applySecurityHeaders(new Response(injected, { status: assetRes.status, headers: assetRes.headers }), false);
                }
                return applySecurityHeaders(new Response(html, { status: assetRes.status, headers: assetRes.headers }), false);
            } catch {}
        }
        return applySecurityHeaders(assetRes, false);
    },

    async scheduled(controller, env, context) {
        const scheduledAt = controller?.scheduledTime
            ? new Date(controller.scheduledTime)
            : new Date();

        const runAllTasks = async () => {
            const socialResult = await runSocialPublisherCron(env, scheduledAt)
                .catch(error => {
                    console.error("[Cloudflare Worker] Social Publisher cron failed:", error?.message || "unknown error");
                    return null;
                });

            /*
             * Cloudflare Worker membatasi 50 subrequest per eksekusi scheduled().
             * Satu siklus autopost Opus + Facebook memakai ~33 subrequest; bila
             * retensi media (10–14 subrequest), cleanup akun tamu, dan monitoring
             * berjalan bersamaan pada menit kelipatan 5/10 (:00, :10, :20, :30,
             * :40, :50), totalnya menembus batas 50 subrequest sehingga proses
             * autopost terputus di tengah jalan dan gagal menulis status akhir.
             * Karena itu, tugas pemeliharaan latar hanya dijalankan pada menit
             * saat Social Publisher sedang tidak memproses postingan aktif.
             */
            const socialBusy = Boolean(
                (socialResult?.claimed || 0) > 0 ||
                (socialResult?.resumed || 0) > 0
            );
            if (socialBusy) {
                return;
            }

            const videoSocialResult = await runSocialVideoAutopostCron(env, scheduledAt)
                .catch(error => {
                    console.error("[Cloudflare Worker] Social Video Autopost cron failed:", error?.message || "unknown error");
                    return null;
                });

            if ((videoSocialResult?.claimed || 0) > 0) {
                return;
            }

            const tasks = [
                // Retensi media: upload 1 jam, media riwayat 24 jam.
                runStorageRetentionCron(env, scheduledAt)
                    .catch(error => {
                        console.error("[Cloudflare Worker] Storage retention cron failed:", error?.message || "unknown error");
                    }),

                // Akun tamu live chat: hapus yang tanpa percakapan / 7 hari idle.
                runSupportGuestCleanupCron(env, scheduledAt)
                    .catch(error => {
                        console.error("[Cloudflare Worker] Support guest cleanup cron failed:", error?.message || "unknown error");
                    }),

                // Pemeriksaan rutin BLACK BOX (mengikuti interval di monitoring_settings).
                runMonitoringCron(env, scheduledAt)
                    .catch(error => {
                        console.error("[Cloudflare Worker] Monitoring cron failed:", error?.message || "unknown error");
                    })
            ];

            await Promise.allSettled(tasks);
        };

        const task = runAllTasks();
        if (context?.waitUntil) context.waitUntil(task);
        else await task;
    }
};
