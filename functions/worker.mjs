import { runHandlerAdapter } from "./_shared/handler-adapter.js";
import adminCredit from "../api/admin-credit.js";
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
import opusVoicePreview from "../api/opus-voice-preview.js";
import opusBlackbox from "../api/opus-blackbox.js";
import opusclipBlackbox from "../api/opusclip-blackbox.js";
import opusclip from "../api/opusclip.js";
import sightengineDetect from "../api/sightengine-detect.js";
import socialPublisher from "../api/social-publisher.js";
import facebookDataDeletion from "../api/facebook-data-deletion.js";
import monitoring from "../api/monitoring.js";
import { runSocialPublisherCron } from "./_shared/social-publisher-cron.js";
import { runStorageRetentionCron } from "./_shared/storage-retention-cron.js";
import { runSupportGuestCleanupCron } from "./_shared/support-guest-cleanup-cron.js";
import { runMonitoringCron } from "./_shared/monitoring-cron.js";
import viddraAccount from "../api/viddra/account.js";
import viddraGenerate from "../api/viddra/generate.js";
import handleTempmail from "./_shared/tempmail-handler.js";
import handleFbMediaDownload from "./_shared/fb-media-handler.js";

const handlers = new Map([
    ["/api/admin-credit", adminCredit],
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
    ["/api/opus-voice-preview", opusVoicePreview],
    ["/api/opus-blackbox", opusBlackbox],
    ["/api/opusclip-blackbox", opusclipBlackbox],
    ["/api/opusclip", opusclip],
    ["/api/sightengine-detect", sightengineDetect],
    ["/api/social-publisher", socialPublisher],
    ["/api/facebook-oauth-callback", socialPublisher],
    ["/api/facebook-data-deletion", facebookDataDeletion],
    // BLACK BOX // MONITORING — log aktivitas, kesehatan web, temuan bug.
    ["/api/monitoring", monitoring],
    // Alias kept for the Deauthorize/Deletion URL field in the Meta dashboard.
    ["/api/data-deletion", facebookDataDeletion],
    ["/api/viddra/account", viddraAccount],
    ["/api/viddra/generate", viddraGenerate]
]);

// =========================================================
// MAIN WORKER
// =========================================================
export default {
    async fetch(request, env, context) {
        const url = new URL(request.url);
        const pathname = url.pathname.replace(/\/+$/, "") || "/";

        // Route khusus Tempmail
        if (pathname === "/api/tempmail") {
            return handleTempmail(request, env);
        }

        // Route unduh & proses URL Facebook (GetMyFB) dan TikTok (SSSTik) untuk referensi media
        if (pathname === "/api/fb-media-download" || pathname === "/api/social-media-download") {
            return handleFbMediaDownload(request, env);
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
                return Response.json(
                    { success: false, error: `${label} maksimal ${action === "upload-song" ? "16" : "8"} MB.` },
                    { status: 413, headers: { "Cache-Control": "no-store" } }
                );
            }
        }

        const handler = handlers.get(pathname);

        if (handler) {
            try {
                return await runHandlerAdapter(handler, request, context, env);
            } catch (error) {
                console.error("[Cloudflare Worker] API request failed:", error);
                return Response.json(
                    { error: "Internal server error" },
                    { status: 500 }
                );
            }
        }

        if (pathname.startsWith("/api/")) {
            return Response.json({ error: "Not found" }, { status: 404 });
        }

        return env.ASSETS.fetch(request);
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
