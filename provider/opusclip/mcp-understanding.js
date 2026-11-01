/* =========================================================
   GEN-Z.AI — OPUSCLIP DEEP VIDEO UNDERSTANDING MCP CLIENT
   ---------------------------------------------------------
   File:
     provider/opusclip/mcp-understanding.js

   100% browser-safe ES module (TANPA impor `node:*` / `lib/**`).
   Menghubungkan ke MCP `https://mcp.opus.pro/mcp` memakai OAuth 2.0
   PKCE Vault (`provider/opus/oauth-vault.js`) tanpa pernah menghapus
   baris `opus_oauth_tokens`.

   Tool MCP resmi yang digunakan (sesuai `skills/copy-video-style`):
   - `opusclip_whoami`
   - `opusclip_create_upload_link`
   - `opusclip_analyze_reference_media` (JANGAN pakai `opusclip_analyze_video`)
   - `opusclip_get_reference_analysis`
========================================================= */

import { resolveOpusOAuthTokenWithVault } from "../opus/oauth-vault.js";

export const DEFAULT_OPUSCLIP_MCP_URL = "https://mcp.opus.pro/mcp";
const DEFAULT_OAUTH_TOKEN_URL = "https://focused-horizon-38.authkit.app/oauth2/token";

export const COPY_VIDEO_STYLE_PROMPT_PRESETS = Object.freeze({
    copy_video_style: [
        "Analyze this reference video thoroughly as a repeatable editing & motion blueprint.",
        "Return structured sections in Indonesian with concrete timestamps & actionable specs:",
        "1. Hook & 3-Second Opening Pattern (visual framing, headline overlay, audio punch).",
        "2. Pacing, Cut Rhythm & Scene Transitions (average shot length, jump-cut cadence, zoom/pan velocity).",
        "3. Typography & Caption System (font weight/style, color palette + hex estimates, highlight animation, screen placement).",
        "4. B-Roll, Motion Graphics & Sound Design Cues (SFX timing, music energy curve, visual callouts).",
        "5. Step-by-Step Copy Video Style Blueprint (exact prompt & Remotion/OpusClip settings to recreate this style on a new topic)."
    ].join("\n"),
    viral_teardown: [
        "Lakukan bedah viralitas mendalam pada video referensi ini dalam Bahasa Indonesia:",
        "1. Kekuatan Hook (0-3 detik pertama) & psikologi retensi penonton.",
        "2. Struktur Storytelling (setup, eskalasi konflik/informasi, payoff/CTA).",
        "3. Elemen Visual & Audio paling menentukan.",
        "4. Skor estimasi Hook / Coherence / Trend beserta 5 rekomendasi perbaikan konkret."
    ].join("\n"),
    shot_by_shot: [
        "Buat daftar Shot-by-Shot Storyboard & Timestamp Breakdown lengkap dalam Bahasa Indonesia:",
        "Untuk setiap segmen waktu, cantumkan: [Timestamp] Visual di layar, Teks/Caption, Gerakan Kamera/Zoom, Transisi, dan Efek Suara/Musik."
    ].join("\n")
});

export function parseOpusClipMcpAuthConfig(rawCredential, defaultMcpUrl = DEFAULT_OPUSCLIP_MCP_URL) {
    const cleanRaw = String(rawCredential || "").trim();
    if (!cleanRaw) return null;

    if (cleanRaw.startsWith("{")) {
        try {
            const parsed = JSON.parse(cleanRaw);
            const oauth = parsed?.oauth && typeof parsed.oauth === "object" ? parsed.oauth : parsed;
            const accessToken = String(
                oauth.access_token || oauth.accessToken || parsed.token || ""
            ).trim();
            const refreshToken = String(
                oauth.refresh_token || oauth.refreshToken || ""
            ).trim();
            const clientId = String(
                oauth.client_id || oauth.clientId || ""
            ).trim();
            const clientSecret = String(
                oauth.client_secret || oauth.clientSecret || ""
            ).trim();
            const tokenEndpoint = String(
                oauth.token_endpoint || oauth.tokenEndpoint || DEFAULT_OAUTH_TOKEN_URL
            ).trim();
            const mcpUrl = String(
                parsed.mcp_url || parsed.mcpUrl || oauth.resource || defaultMcpUrl
            ).trim();
            const rawExpiresMs = Number(oauth.expires_at_ms || oauth.expiresAtMs || 0) || 0;
            const rawExpiresSec = Number(oauth.expires_at || oauth.expiresAt || 0) || 0;
            const expiresAtMs = rawExpiresMs > 0
                ? rawExpiresMs
                : rawExpiresSec > 0
                    ? (rawExpiresSec < 1e12 ? rawExpiresSec * 1000 : rawExpiresSec)
                    : 0;

            if (accessToken || refreshToken) {
                return {
                    type: "oauth",
                    mcpUrl: mcpUrl || defaultMcpUrl,
                    tokenEndpoint,
                    clientId,
                    clientSecret,
                    resource: mcpUrl || defaultMcpUrl,
                    scope: String(oauth.scope || "").trim(),
                    accessToken,
                    refreshToken,
                    expiresAtMs
                };
            }
        } catch {
            /* fallback bearer string */
        }
    }

    return {
        type: "bearer",
        mcpUrl: defaultMcpUrl,
        accessToken: cleanRaw.replace(/^Bearer\s+/i, "").trim(),
        refreshToken: "",
        clientId: ""
    };
}

function parseSseOrJsonRpcPayload(rawText) {
    const trimmed = String(rawText || "").trim();
    if (!trimmed) return null;
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try {
            return JSON.parse(trimmed);
        } catch {
            /* fallback SSE */
        }
    }

    const lines = trimmed.split(/\r?\n/);
    let lastJson = null;
    for (const line of lines) {
        if (line.startsWith("data:")) {
            const dataPart = line.slice(5).trim();
            if (!dataPart || dataPart === "[DONE]") continue;
            try {
                lastJson = JSON.parse(dataPart);
            } catch {
                /* ignore partial */
            }
        }
    }
    return lastJson;
}

function unwrapMcpToolResult(rpcResponse) {
    if (rpcResponse?.error) {
        const msg = rpcResponse.error.message || JSON.stringify(rpcResponse.error);
        const err = new Error(`MCP OpusClip error: ${msg}`);
        err.status = 502;
        throw err;
    }

    const result = rpcResponse?.result ?? rpcResponse;
    if (result?.isError) {
        const textMsg = Array.isArray(result.content)
            ? result.content.map(item => item?.text || "").filter(Boolean).join("\n")
            : "Tool MCP mengembalikan isError=true.";
        const err = new Error(textMsg || "Eksekusi tool MCP OpusClip gagal.");
        err.status = 502;
        throw err;
    }

    if (result?.structuredContent && typeof result.structuredContent === "object") {
        return result.structuredContent;
    }

    if (Array.isArray(result?.content)) {
        const joined = result.content
            .map(item => (typeof item?.text === "string" ? item.text : ""))
            .filter(Boolean)
            .join("\n")
            .trim();
        if (joined) {
            try {
                return JSON.parse(joined);
            } catch {
                return { text: joined };
            }
        }
    }

    return result && typeof result === "object" ? result : {};
}

export async function callOpusClipMcpTool(toolName, toolArgs = {}, rawCredential, {
    env = null,
    mcpUrl = DEFAULT_OPUSCLIP_MCP_URL,
    fetchImpl = globalThis.fetch,
    timeoutMs = 40_000
} = {}) {
    const authConfig = parseOpusClipMcpAuthConfig(rawCredential, mcpUrl);
    if (!authConfig || (!authConfig.accessToken && !authConfig.refreshToken)) {
        const err = new Error(
            "Token OAuth mcp.opus.pro belum dikonfigurasi. Buka BLACK BOX Modul 03 untuk login OAuth 1-klik."
        );
        err.status = 503;
        err.code = "MISSING_MCP_OAUTH";
        throw err;
    }

    const endpoint = authConfig.mcpUrl || mcpUrl || DEFAULT_OPUSCLIP_MCP_URL;

    async function invokeOnce(forceRefresh = false) {
        let bearerToken = authConfig.accessToken;
        if (authConfig.type === "oauth" && authConfig.refreshToken && authConfig.clientId) {
            const resolved = await resolveOpusOAuthTokenWithVault({
                env,
                tokenEndpoint: authConfig.tokenEndpoint,
                clientId: authConfig.clientId,
                clientSecret: authConfig.clientSecret,
                resource: authConfig.resource || endpoint,
                scope: authConfig.scope,
                accessToken: authConfig.accessToken,
                refreshToken: authConfig.refreshToken,
                expiresAtMs: authConfig.expiresAtMs,
                forceRefresh
            });
            bearerToken = resolved.accessToken;
        }

        if (!bearerToken) {
            const err = new Error("Access token OAuth mcp.opus.pro kosong atau kedaluwarsa.");
            err.status = 401;
            throw err;
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const initResp = await fetchImpl(endpoint, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${bearerToken}`,
                    "Content-Type": "application/json",
                    Accept: "application/json, text/event-stream"
                },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    id: 1,
                    method: "initialize",
                    params: {
                        protocolVersion: "2025-03-26",
                        capabilities: {},
                        clientInfo: { name: "genz-ai-opusclip-studio", version: "2.0.0" }
                    }
                }),
                signal: controller.signal
            });

            if (initResp.status === 401 && !forceRefresh && authConfig.refreshToken) {
                return { unauthorizedRetry: true };
            }

            const sessionId =
                initResp.headers?.get?.("mcp-session-id") ||
                initResp.headers?.get?.("Mcp-Session-Id") ||
                "";

            const callHeaders = {
                Authorization: `Bearer ${bearerToken}`,
                "Content-Type": "application/json",
                Accept: "application/json, text/event-stream"
            };
            if (sessionId) {
                callHeaders["mcp-session-id"] = sessionId;
            }

            const callResp = await fetchImpl(endpoint, {
                method: "POST",
                headers: callHeaders,
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    id: 2,
                    method: "tools/call",
                    params: {
                        name: toolName,
                        arguments: toolArgs
                    }
                }),
                signal: controller.signal
            });

            if (callResp.status === 401 && !forceRefresh && authConfig.refreshToken) {
                return { unauthorizedRetry: true };
            }

            const rawText = await callResp.text().catch(() => "");
            if (!callResp.ok) {
                const err = new Error(
                    `MCP mcp.opus.pro menolak panggilan ${toolName} (HTTP ${callResp.status}): ${rawText.slice(0, 200)}`
                );
                err.status = callResp.status === 401 ? 401 : 502;
                throw err;
            }

            const rpcJson = parseSseOrJsonRpcPayload(rawText);
            return { data: unwrapMcpToolResult(rpcJson) };
        } finally {
            clearTimeout(timer);
        }
    }

    const firstTry = await invokeOnce(false);
    if (firstTry?.unauthorizedRetry) {
        const retried = await invokeOnce(true);
        return retried.data;
    }
    return firstTry.data;
}

export async function inspectOpusClipMcpWhoami(rawCredential, options = {}) {
    if (!rawCredential || !String(rawCredential).trim()) {
        return {
            configured: false,
            healthy: false,
            endpoint: options.mcpUrl || DEFAULT_OPUSCLIP_MCP_URL,
            message: "Token OAuth mcp.opus.pro belum disimpan."
        };
    }
    try {
        const result = await callOpusClipMcpTool("opusclip_whoami", {}, rawCredential, options);
        return {
            configured: true,
            healthy: true,
            endpoint: options.mcpUrl || DEFAULT_OPUSCLIP_MCP_URL,
            account: result
        };
    } catch (err) {
        return {
            configured: true,
            healthy: false,
            endpoint: options.mcpUrl || DEFAULT_OPUSCLIP_MCP_URL,
            error: err?.message || "Gagal memverifikasi sesi mcp.opus.pro."
        };
    }
}

export async function createOpusClipMcpUploadLink({
    fileName = "reference.mp4",
    mimeType = "video/mp4"
} = {}, rawCredential, options = {}) {
    const cleanFile = String(fileName || "reference.mp4").trim();
    const dot = cleanFile.lastIndexOf(".");
    const extension = dot >= 0 ? cleanFile.slice(dot + 1).toLowerCase() : "mp4";
    return callOpusClipMcpTool(
        "opusclip_create_upload_link",
        {
            fileName: cleanFile,
            extension,
            mimeType
        },
        rawCredential,
        options
    );
}

export async function submitOpusClipReferenceAnalysis({
    mediaUrl,
    uploadId,
    mediaType = "video",
    durationSeconds = 60,
    preset = "copy_video_style",
    customPrompt = "",
    idempotencyKey = ""
} = {}, rawCredential, options = {}) {
    const cleanUrl = typeof mediaUrl === "string" ? mediaUrl.trim() : "";
    const cleanUploadId = typeof uploadId === "string" ? uploadId.trim() : "";

    if (!cleanUrl && !cleanUploadId) {
        const err = new Error("Masukkan URL media langsung (HTTPS <= 15 MB) atau unggah file video terlebih dahulu.");
        err.status = 400;
        throw err;
    }

    const safeDuration = Math.max(1, Math.min(300, Math.round(Number(durationSeconds) || 60)));
    if (Number(durationSeconds) > 300) {
        const err = new Error("Durasi video referensi untuk Deep Video Understanding maksimal 300 detik (5 menit).");
        err.status = 400;
        throw err;
    }

    const basePresetPrompt =
        COPY_VIDEO_STYLE_PROMPT_PRESETS[preset] || COPY_VIDEO_STYLE_PROMPT_PRESETS.copy_video_style;
    const extraPrompt = String(customPrompt || "").trim();
    const finalPrompt = extraPrompt
        ? `${basePresetPrompt}\n\nInstruksi Tambahan Pengguna:\n${extraPrompt}`
        : basePresetPrompt;

    const cleanIdem =
        String(idempotencyKey || "").trim().slice(0, 128) ||
        `genzai-und-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    const args = {
        prompt: finalPrompt,
        mediaType: mediaType === "image" || mediaType === "audio" ? mediaType : "video",
        durationSeconds: safeDuration,
        idempotencyKey: cleanIdem.length >= 8 ? cleanIdem : `${cleanIdem}-pad12345`
    };
    if (cleanUploadId) {
        args.uploadId = cleanUploadId;
    } else {
        args.mediaUrl = cleanUrl;
    }

    return callOpusClipMcpTool("opusclip_analyze_reference_media", args, rawCredential, options);
}

export async function getOpusClipReferenceAnalysis({ jobId } = {}, rawCredential, options = {}) {
    const cleanJobId = String(jobId || "").trim();
    if (!cleanJobId) {
        const err = new Error("jobId analisis video wajib diisi.");
        err.status = 400;
        throw err;
    }
    return callOpusClipMcpTool(
        "opusclip_get_reference_analysis",
        { jobId: cleanJobId },
        rawCredential,
        options
    );
}
