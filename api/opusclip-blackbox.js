/* =========================================================
   GEN-Z.AI — BLACK BOX MODUL 03: OPUSCLIP & MCP VAULT API
   ---------------------------------------------------------
   File:
     api/opusclip-blackbox.js

   Endpoint khusus Owner & Admin (`/api/opusclip-blackbox`):
   - `action=status`        : Cek status kredensial terenkripsi
                              `OPUSCLIP_API_KEY` (`api.opus.pro` `/api-usage?q=mine`)
                              + sesi OAuth `https://mcp.opus.pro/mcp` (`opusclip_whoami`)
   - `action=save_api_key`  : Simpan/rotasi `OPUSCLIP_API_KEY` (+ opsional `orgId`)
                              secara terenkripsi AES-256-GCM ke `provider_credentials`
   - `action=save_mcp_oauth`: Simpan/rotasi JSON token OAuth `mcp.opus.pro`
                              ke `provider_credentials` + sinkronisasi `opus_oauth_tokens`
                              (strictly upsert, TIDAK PERNAH menghapus baris `opus_oauth_tokens`).
========================================================= */

import {
    authenticateSupabaseUser,
    resolveRuntimeEnv
} from "../lib/opus/load-opus-credential.js";
import {
    loadOpusClipMcpCredential,
    loadOpusClipRestConfig,
    saveOpusClipMcpCredential,
    saveOpusClipRestConfig
} from "../lib/opus/opusclip-credentials.js";
import {
    createOpusClipApiClient,
    getOrgApiUsage
} from "../provider/opusclip/client.js";
import { inspectOpusClipMcpWhoami } from "../provider/opusclip/mcp-understanding.js";

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
    const url = new URL(req.url || "/api/opusclip-blackbox", "https://genzai.local");
    const action = String(
        body.action || url.searchParams.get("action") || "status"
    ).trim().toLowerCase();

    if (action === "save_api_key") {
        if (req.method !== "POST") {
            return sendJson(res, 405, { success: false, error: "Gunakan POST untuk menyimpan API key." });
        }
        try {
            const saved = await saveOpusClipRestConfig(
                env,
                {
                    apiKey: body.apiKey || body.api_key || "",
                    orgId: body.orgId || body.org_id || ""
                },
                { fetchImpl }
            );
            return sendJson(res, 200, {
                success: true,
                action: "save_api_key",
                message: "OPUSCLIP_API_KEY berhasil dienkripsi & disimpan di Vault Supabase.",
                rest: saved
            });
        } catch (err) {
            return sendJson(res, err?.status || 500, {
                success: false,
                error: err?.message || "Gagal menyimpan OPUSCLIP_API_KEY."
            });
        }
    }

    if (action === "save_mcp_oauth") {
        if (req.method !== "POST") {
            return sendJson(res, 405, { success: false, error: "Gunakan POST untuk menyimpan token OAuth." });
        }
        try {
            const saved = await saveOpusClipMcpCredential(
                env,
                {
                    rawToken: body.rawToken || body.oauthJson || body.token || ""
                },
                { fetchImpl }
            );
            return sendJson(res, 200, {
                success: true,
                action: "save_mcp_oauth",
                message: "Token OAuth mcp.opus.pro berhasil dienkripsi & disinkronkan ke Vault.",
                mcp: saved
            });
        } catch (err) {
            return sendJson(res, err?.status || 500, {
                success: false,
                error: err?.message || "Gagal menyimpan token OAuth mcp.opus.pro."
            });
        }
    }

    if (action === "status") {
        const [restCfg, mcpCfg] = await Promise.all([
            loadOpusClipRestConfig(env, { fetchImpl }),
            loadOpusClipMcpCredential(env, { fetchImpl })
        ]);

        let restHealth = {
            configured: restCfg.configured,
            healthy: false,
            source: restCfg.source,
            maskedKey: restCfg.maskedKey || null,
            orgId: restCfg.orgId || null,
            updatedAt: restCfg.updatedAt || null,
            usage: null,
            error: null
        };

        if (restCfg.configured) {
            try {
                const client = createOpusClipApiClient({
                    apiKey: restCfg.apiKey,
                    orgId: restCfg.orgId,
                    baseUrl: restCfg.baseUrl,
                    fetchImpl,
                    timeoutMs: 12_000
                });
                const usage = await getOrgApiUsage(client);
                restHealth.healthy = true;
                restHealth.usage = usage;
            } catch (err) {
                restHealth.healthy = false;
                restHealth.error = err?.message || "Gagal memverifikasi OPUSCLIP_API_KEY.";
            }
        }

        const mcpHealth = await inspectOpusClipMcpWhoami(mcpCfg.rawCredential, {
            env,
            mcpUrl: mcpCfg.mcpUrl,
            fetchImpl,
            timeoutMs: 12_000
        });

        return sendJson(res, 200, {
            success: true,
            action: "status",
            checkedAt: new Date().toISOString(),
            operator: {
                email: auth.user.email,
                role: auth.user.role
            },
            rest: restHealth,
            mcp: {
                ...mcpHealth,
                source: mcpCfg.source,
                hasRefreshToken: mcpCfg.hasRefreshToken,
                updatedAt: mcpCfg.updatedAt || null
            },
            oauthLoginUrl: "/api/opus-oauth-login?mcp=https%3A%2F%2Fmcp.opus.pro%2Fmcp"
        });
    }

    return sendJson(res, 400, {
        success: false,
        error: `Action '${action}' tidak dikenali pada /api/opusclip-blackbox.`
    });
}
