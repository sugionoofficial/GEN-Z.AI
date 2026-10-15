import { runVercelHandler } from "./_shared/vercel-adapter.js";
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

        const handler = handlers.get(pathname);

        if (handler) {
            try {
                return await runVercelHandler(handler, request, context, env);
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
    }
};
