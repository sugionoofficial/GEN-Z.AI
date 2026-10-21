import { runHandlerAdapter } from "./_shared/handler-adapter.js";
import adminCredit from "../api/admin-credit.js";
import featureCredits from "../api/feature-credits.js";
import announcements from "../api/announcements.js";
import adminModels from "../api/admin-models.js";
import adminProviderCredentials from "../api/admin-provider-credentials.js";
import adminUsers from "../api/admin-users.js";
import generateStatus from "../api/generate-status.js";
import generate from "../api/generate.js";
import kieConfig from "../api/kie-config.js";
import modelConfig from "../api/model-config.js";
import openkeyChat from "../api/openkey-chat.js";
import sightengineDetect from "../api/sightengine-detect.js";
import socialPublisher from "../api/social-publisher.js";
import facebookDataDeletion from "../api/facebook-data-deletion.js";
import { runSocialPublisherCron } from "./_shared/social-publisher-cron.js";
import viddraAccount from "../api/viddra/account.js";
import viddraGenerate from "../api/viddra/generate.js";
import handleTempmail from "./_shared/tempmail-handler.js";

const handlers = new Map([
    ["/api/admin-credit", adminCredit],
    ["/api/feature-credits", featureCredits],
    ["/api/announcements", announcements],
    ["/api/admin-models", adminModels],
    ["/api/admin-provider-credentials", adminProviderCredentials],
    ["/api/admin-users", adminUsers],
    ["/api/generate-status", generateStatus],
    ["/api/generate", generate],
    ["/api/kie-config", kieConfig],
    ["/api/model-config", modelConfig],
    ["/api/openkey-chat", openkeyChat],
    ["/api/sightengine-detect", sightengineDetect],
    ["/api/social-publisher", socialPublisher],
    ["/api/facebook-oauth-callback", socialPublisher],
    ["/api/facebook-data-deletion", facebookDataDeletion],
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

        if (
            pathname === "/api/social-publisher" &&
            request.method === "POST" &&
            ["upload-reference", "upload-garment", "upload-outfit"].includes(url.searchParams.get("action"))
        ) {
            const action = url.searchParams.get("action");
            const contentLength = Number(request.headers.get("content-length") || 0);
            if (contentLength > 8 * 1024 * 1024) {
                const label = action === "upload-reference"
                    ? "File referensi"
                    : action === "upload-garment" ? "File pakaian" : "File outfit";
                return Response.json(
                    { success: false, error: `${label} maksimal 8 MB.` },
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
        const task = runSocialPublisherCron(env, controller?.scheduledTime || new Date())
            .catch(error => {
                console.error("[Cloudflare Worker] Social Publisher cron failed:", error?.message || "unknown error");
            });
        if (context?.waitUntil) context.waitUntil(task);
        else await task;
    }
};
