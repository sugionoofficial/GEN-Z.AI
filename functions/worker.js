import { runVercelHandler } from "./_shared/vercel-adapter.js";
import adminCredit from "../api/admin-credit.js";
import featureCredits from "../api/feature-credits.js";
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

const handlers = new Map([
    ["/api/admin-credit", adminCredit],
    ["/api/feature-credits", featureCredits],
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
// TEMPMAIL HANDLER (Chinaapi)
// =========================================================
async function handleTempmail(request, env) {
    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
    };

    if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const action = url.searchParams.get("action");
    const email = url.searchParams.get("email");
    const token = url.searchParams.get("token");
    const messageId = url.searchParams.get("messageId");

    const TEMPMAIL_URL = (env.TEMPMAIL_API_URL || "").replace(/\/+$/, "");
    if (!TEMPMAIL_URL) {
        return Response.json(
            { error: "TEMPMAIL_API_URL belum di-set di Cloudflare" },
            { status: 500, headers: corsHeaders }
        );
    }

    try {
        let targetUrl = "";
        let method = "GET";

        if (action === "create") {
            targetUrl = `${TEMPMAIL_URL}/api/email?name=gmail`;
            method = "POST";
        } else if (action === "messages") {
            if (!email || !token) {
                return Response.json(
                    { error: "Parameter email & token wajib diisi" },
                    { status: 400, headers: corsHeaders }
                );
            }
            targetUrl = `${TEMPMAIL_URL}/api/email/${encodeURIComponent(email)}/messages?token=${encodeURIComponent(token)}`;
        } else if (action === "message") {
            if (!email || !token || !messageId) {
                return Response.json(
                    { error: "Parameter email, token & messageId wajib diisi" },
                    { status: 400, headers: corsHeaders }
                );
            }
            targetUrl = `${TEMPMAIL_URL}/api/email/${encodeURIComponent(email)}/message/${encodeURIComponent(messageId)}?token=${encodeURIComponent(token)}`;
        } else {
            return Response.json(
                { error: "Action tidak dikenal. Gunakan: create, messages, atau message" },
                { status: 400, headers: corsHeaders }
            );
        }

        const response = await fetch(targetUrl, { method });
        const data = await response.text();

        return new Response(data, {
            status: response.status,
            headers: {
                ...corsHeaders,
                "Content-Type": response.headers.get("Content-Type") || "application/json"
            }
        });
    } catch (error) {
        return Response.json(
            { error: "Gagal menghubungi server Tempmail", detail: String(error) },
            { status: 500, headers: corsHeaders }
        );
    }
}

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
