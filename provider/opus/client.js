/* =========================================================
   GEN-Z.AI
   OPUS LABS (OPUS VIDEO TOOLS MCP)
   PROVIDER CLIENT
   ---------------------------------------------------------
   File:
     provider/opus/client.js

   Fungsi:
   - Klien MCP JSON-RPC 2.0 (Streamable HTTP / SSE) untuk
     Opus Labs Video Tools (https://labs.opus.pro/opus-video-tools/mcp)
   - Mendukung token Bearer langsung maupun refresh token OAuth WorkOS
   - Introspection live JSON Schema untuk create_project,
     import_assets, generate_video_clips, get_status, list_jobs
   - Create video task (async) dengan taskId komposit
     opus:<projectId>:<jobId>
   - Query video task (non-blocking watch:false agar hemat CPU
     pada Cloudflare Workers Free Plan)
   - Normalisasi status, URL video output, dan kode error Opus
     ke Bahasa Indonesia
   - 100% browser-safe ES module (ikut di-bundle untuk katalog
     model di Admin Panel)
========================================================= */

function getEnv() {
    return (
        typeof process !== "undefined" &&
        process &&
        process.env
            ? process.env
            : {}
    );
}

const PROVIDER_ID = "opus";
const PROVIDER_NAME = "Opus";

const DEFAULT_MCP_URL = "https://labs.opus.pro/opus-video-tools/mcp";
const DEFAULT_OAUTH_TOKEN_URL = "https://focused-horizon-38.authkit.app/oauth2/token";
const DEFAULT_OPUS_WORKOS_CLIENT_ID = "client_01K793481887VCB5M0N2B23784";

const MCP_PROTOCOL_VERSION = "2025-03-26";
const CREATE_TIMEOUT_MS = 45_000;
const QUERY_TIMEOUT_MS = 25_000;
const TOOLS_CACHE_TTL_MS = 3 * 60 * 1000;
const COMPLETED_INLINE_CACHE_TTL_MS = 30 * 60 * 1000;
const MAX_REFERENCE_IMAGES = 3;

const CLIENT_ITEM_IDS = new Set([
    "clip-1",
    "video-1",
    "shot-1",
    "item-1",
    "task-1",
    "kf-1",
    "first_frame",
    "last_frame",
    "image1",
    "image2",
    "image3"
]);

const PROJECT_PENDING_JOB_ID = "__project_pending__";

function sleep(ms) {
    const delay = Math.max(0, Number(ms) || 0);
    if (!delay) return Promise.resolve();
    return new Promise(resolve => setTimeout(resolve, delay));
}

/* Cache ringan di memori untuk menekan subrequest berulang di Worker */
let cachedOAuthState = {
    fingerprint: "",
    accessToken: "",
    refreshToken: "",
    expiresAtMs: 0
};

let cachedToolsState = {
    endpoint: "",
    tools: null,
    fetchedAtMs: 0
};

const inlineCompletedResults = new Map();

/* =========================================================
   UTILITIES & SECRET REDACTION
========================================================= */

function makeUuid() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, ch => {
        const r = Math.floor(Math.random() * 16);
        const v = ch === "x" ? r : ((r & 0x3) | 0x8);
        return v.toString(16);
    });
}

function getMcpEndpoint(options = {}) {
    const configured = String(
        options?.mcpUrl ||
        getEnv().OPUS_MCP_URL ||
        DEFAULT_MCP_URL
    ).trim();
    return configured || DEFAULT_MCP_URL;
}

function redactSecrets(text, secrets = []) {
    let output = String(text || "");
    output = output.replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]");
    for (const secret of secrets) {
        const clean = String(secret || "").trim();
        if (clean && clean.length >= 8) {
            output = output.split(clean).join("[REDACTED]");
        }
    }
    return output;
}

function createProviderError({
    message,
    code = "OPUS_PROVIDER_ERROR",
    providerCode = "",
    status = 502,
    raw = null
}) {
    const error = new Error(String(message || "Opus provider gagal memproses permintaan."));
    error.code = code;
    error.provider = PROVIDER_ID;
    error.providerCode = providerCode || code;
    error.status = status;
    if (raw !== null && raw !== undefined) {
        error.providerResponse = raw;
    }
    return error;
}

/* =========================================================
   JWT & WORKOS OAUTH TOKEN RESOLUTION
========================================================= */

function decodeBase64UrlText(input) {
    const normalized = String(input || "").replace(/-/g, "+").replace(/_/g, "/");
    const padLen = (4 - (normalized.length % 4)) % 4;
    const padded = normalized + "=".repeat(padLen);
    if (typeof atob === "function") {
        return atob(padded);
    }
    if (typeof Buffer !== "undefined") {
        return Buffer.from(padded, "base64").toString("utf8");
    }
    return "";
}

function bytesToBase64(bytes) {
    const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
    if (typeof Buffer !== "undefined") {
        return Buffer.from(view).toString("base64");
    }
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < view.length; i += chunkSize) {
        binary += String.fromCharCode(...view.subarray(i, i + chunkSize));
    }
    return btoa(binary);
}

function parseJwtExpiryMs(token) {
    const raw = String(token || "").trim();
    const parts = raw.split(".");
    if (parts.length !== 3) return 0;
    try {
        const payload = JSON.parse(decodeBase64UrlText(parts[1]));
        return typeof payload?.exp === "number" ? payload.exp * 1000 : 0;
    } catch {
        return 0;
    }
}

function looksLikeJwt(token) {
    const raw = String(token || "").trim();
    return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(raw);
}

function isJwtFresh(token, minTtlMs = 90_000) {
    if (!token) return false;
    const expMs = parseJwtExpiryMs(token);
    if (!expMs) return looksLikeJwt(token);
    return expMs - Date.now() > minTtlMs;
}

function parseApiKeyInput(apiKey) {
    const env = getEnv();
    const defaultTokenEndpoint = String(env.OPUS_OAUTH_TOKEN_URL || DEFAULT_OAUTH_TOKEN_URL).trim();
    const raw = String(apiKey || "").trim();

    if (!raw) {
        const envRaw = String(env.OPUS_AUTH_TOKEN || env.OPUS_ACCESS_TOKEN || env.OPUSCLIP_API_KEY || "").trim();
        if (envRaw.startsWith("{") && envRaw.endsWith("}")) {
            return parseApiKeyInput(envRaw);
        }
        const envAccess = envRaw.replace(/^Bearer\s+/i, "").trim();
        const envRefresh = String(env.OPUS_REFRESH_TOKEN || "").trim();
        const envClient = String(env.OPUS_CLIENT_ID || DEFAULT_OPUS_WORKOS_CLIENT_ID).trim();
        if (envAccess || envRefresh) {
            return {
                accessToken: envAccess,
                refreshToken: envRefresh,
                clientId: envClient || DEFAULT_OPUS_WORKOS_CLIENT_ID,
                clientSecret: String(env.OPUS_CLIENT_SECRET || "").trim(),
                resource: String(env.OPUS_RESOURCE_URL || "").trim(),
                scope: "",
                tokenEndpoint: defaultTokenEndpoint
            };
        }
        throw createProviderError({
            message: "Kredensial Opus belum dikonfigurasi. Isi API Key/Token Opus di Admin Panel atau OPUS_AUTH_TOKEN di Worker.",
            code: "MISSING_API_KEY",
            status: 401
        });
    }

    if (raw.startsWith("{") && raw.endsWith("}")) {
        try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === "object") {
                const accessToken = String(
                    parsed.access_token ||
                    parsed.accessToken ||
                    parsed.auth_token ||
                    parsed.authToken ||
                    parsed.token ||
                    ""
                ).replace(/^Bearer\s+/i, "").trim();
                const refreshToken = String(
                    parsed.refresh_token ||
                    parsed.refreshToken ||
                    env.OPUS_REFRESH_TOKEN ||
                    ""
                ).trim();
                const clientId = String(
                    parsed.client_id ||
                    parsed.clientId ||
                    env.OPUS_CLIENT_ID ||
                    DEFAULT_OPUS_WORKOS_CLIENT_ID
                ).trim();
                const clientSecret = String(
                    parsed.client_secret ||
                    parsed.clientSecret ||
                    env.OPUS_CLIENT_SECRET ||
                    ""
                ).trim();
                const resource = String(
                    parsed.resource ||
                    env.OPUS_RESOURCE_URL ||
                    ""
                ).trim();
                const scope = String(parsed.scope || "").trim();
                const tokenEndpoint = String(
                    parsed.token_endpoint ||
                    parsed.tokenEndpoint ||
                    defaultTokenEndpoint
                ).trim();
                if (accessToken || refreshToken) {
                    return {
                        accessToken,
                        refreshToken,
                        clientId: clientId || DEFAULT_OPUS_WORKOS_CLIENT_ID,
                        clientSecret,
                        resource,
                        scope,
                        tokenEndpoint: tokenEndpoint || DEFAULT_OAUTH_TOKEN_URL
                    };
                }
            }
        } catch {
            /* lanjut sebagai token string biasa */
        }
    }

    const stripped = raw.replace(/^Bearer\s+/i, "").trim();
    if (!stripped) {
        throw createProviderError({
            message: "Kredensial Opus kosong.",
            code: "MISSING_API_KEY",
            status: 401
        });
    }

    if (/^refresh:/i.test(stripped)) {
        return {
            accessToken: "",
            refreshToken: stripped.replace(/^refresh:/i, "").trim(),
            clientId: String(env.OPUS_CLIENT_ID || DEFAULT_OPUS_WORKOS_CLIENT_ID).trim(),
            clientSecret: String(env.OPUS_CLIENT_SECRET || "").trim(),
            resource: String(env.OPUS_RESOURCE_URL || "").trim(),
            scope: "",
            tokenEndpoint: defaultTokenEndpoint
        };
    }

    return {
        accessToken: stripped,
        refreshToken: String(env.OPUS_REFRESH_TOKEN || "").trim(),
        clientId: String(env.OPUS_CLIENT_ID || DEFAULT_OPUS_WORKOS_CLIENT_ID).trim(),
        clientSecret: String(env.OPUS_CLIENT_SECRET || "").trim(),
        resource: String(env.OPUS_RESOURCE_URL || "").trim(),
        scope: "",
        tokenEndpoint: defaultTokenEndpoint
    };
}

async function resolveBearerToken(apiKey, { forceRefresh = false } = {}) {
    const parsed = parseApiKeyInput(apiKey);
    const fingerprint = `${parsed.tokenEndpoint}|${parsed.accessToken.slice(0, 18)}|${parsed.refreshToken.slice(-12)}|${parsed.clientId}`;

    if (
        !forceRefresh &&
        cachedOAuthState.fingerprint === fingerprint &&
        cachedOAuthState.accessToken &&
        isJwtFresh(cachedOAuthState.accessToken)
    ) {
        return cachedOAuthState.accessToken;
    }

    if (!forceRefresh && parsed.accessToken) {
        const expMs = parseJwtExpiryMs(parsed.accessToken);
        if (!expMs || expMs - Date.now() > 90_000) {
            cachedOAuthState = {
                fingerprint,
                accessToken: parsed.accessToken,
                refreshToken: parsed.refreshToken,
                expiresAtMs: expMs
            };
            return parsed.accessToken;
        }
    }

    const activeRefreshToken =
        (cachedOAuthState.fingerprint === fingerprint && cachedOAuthState.refreshToken) ||
        parsed.refreshToken;

    if (activeRefreshToken && parsed.clientId) {
        const sendRefresh = async includeResourceAndScope => {
            const form = new URLSearchParams({
                grant_type: "refresh_token",
                refresh_token: activeRefreshToken,
                client_id: parsed.clientId
            });
            if (parsed.clientSecret) {
                form.set("client_secret", parsed.clientSecret);
            }
            if (includeResourceAndScope) {
                if (parsed.resource) form.set("resource", parsed.resource);
                if (parsed.scope) form.set("scope", parsed.scope);
            }
            const res = await fetch(parsed.tokenEndpoint || DEFAULT_OAUTH_TOKEN_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Accept": "application/json"
                },
                body: form.toString()
            });
            const rawText = await res.text();
            let data = null;
            try {
                data = rawText ? JSON.parse(rawText) : null;
            } catch {
                data = null;
            }
            return { response: res, data, rawText };
        };

        let { response, data, rawText } = await sendRefresh(Boolean(parsed.resource || parsed.scope));
        if (
            (!response.ok || !data?.access_token) &&
            (parsed.resource || parsed.scope) &&
            /^(invalid_target|invalid_scope)$/i.test(String(data?.error || ""))
        ) {
            ({ response, data, rawText } = await sendRefresh(false));
        }

        if (response.ok && typeof data?.access_token === "string" && data.access_token.trim()) {
            const nextAccess = data.access_token.replace(/^Bearer\s+/i, "").trim();
            const nextRefresh = typeof data.refresh_token === "string" && data.refresh_token.trim()
                ? data.refresh_token.trim()
                : activeRefreshToken;
            const expiresInSec = Number(data.expires_in) || 3600;
            cachedOAuthState = {
                fingerprint,
                accessToken: nextAccess,
                refreshToken: nextRefresh,
                expiresAtMs: parseJwtExpiryMs(nextAccess) || (Date.now() + expiresInSec * 1000)
            };
            return nextAccess;
        }

        if (!parsed.accessToken || forceRefresh) {
            const detail = redactSecrets(
                data?.error_description || data?.message || data?.error || rawText.slice(0, 180),
                [activeRefreshToken, parsed.accessToken]
            );
            throw createProviderError({
                message: `Sesi OAuth Opus kedaluwarsa dan gagal diperbarui (${response.status})${detail ? `: ${detail}` : "."}`,
                code: "OPUS_AUTH_EXPIRED",
                providerCode: "auth_expired",
                status: 401
            });
        }
    }

    if (parsed.accessToken) {
        return parsed.accessToken;
    }

    throw createProviderError({
        message: "Token autentikasi Opus tidak tersedia.",
        code: "MISSING_API_KEY",
        status: 401
    });
}

/* =========================================================
   TASK ID ENCODING (PROJECT + JOB)
========================================================= */

function encodeOpusTaskId(projectId, jobId) {
    const cleanProject = String(projectId || "").trim();
    const cleanJob = String(jobId || "").trim();
    if (!cleanJob) return "";
    if (!cleanProject) return `opus::${cleanJob}`;
    return `opus:${cleanProject}:${cleanJob}`;
}

function parseOpusTaskId(taskId) {
    const raw = String(taskId || "").trim();
    if (!raw) {
        return { projectId: "", jobId: "", isInlineDone: false, isProjectPending: false };
    }
    if (raw.startsWith("opus-inline:")) {
        return {
            projectId: "",
            jobId: raw,
            isInlineDone: true,
            isProjectPending: false
        };
    }
    if (raw.startsWith("opus:")) {
        const rest = raw.slice(5);
        const sepIndex = rest.indexOf(":");
        if (sepIndex >= 0) {
            const projectId = rest.slice(0, sepIndex).trim();
            const jobId = rest.slice(sepIndex + 1).trim();
            return {
                projectId,
                jobId,
                isInlineDone: false,
                isProjectPending: Boolean(projectId && jobId === PROJECT_PENDING_JOB_ID)
            };
        }
        return {
            projectId: "",
            jobId: rest.trim(),
            isInlineDone: false,
            isProjectPending: false
        };
    }
    return {
        projectId: "",
        jobId: raw,
        isInlineDone: false,
        isProjectPending: false
    };
}

/* =========================================================
   ERROR TRANSLATION (OPUS -> BAHASA INDONESIA)
========================================================= */

const ERROR_MESSAGE_BY_CODE = Object.freeze({
    credit_admission_rejected:
        "Saldo kredit akun Opus Labs tidak mencukupi untuk durasi/resolusi video ini.",
    insufficient_credits:
        "Saldo kredit akun Opus Labs tidak mencukupi.",
    quota_exceeded:
        "Kuota generasi Opus Labs sedang penuh atau telah habis.",
    rate_limited:
        "Batas kecepatan request Opus Labs tercapai. Silakan coba beberapa saat lagi.",
    content_policy:
        "Konten prompt atau gambar referensi ditolak oleh kebijakan keamanan Opus Labs (hindari tokoh publik nyata, merek dagang, atau konten sensitif).",
    safety_rejected:
        "Konten ditolak oleh filter keamanan Opus Labs.",
    moderation_blocked:
        "Konten diblokir oleh moderasi keamanan Opus Labs.",
    model_unavailable:
        "Model video ini sedang tidak tersedia di server Opus Labs. Coba model Opus lain atau ubah resolusi.",
    generation_unavailable:
        "Layanan generasi video Opus Labs sedang gangguan sementara. Silakan coba lagi.",
    invalid_request:
        "Parameter video ditolak oleh server Opus Labs. Periksa durasi, resolusi, rasio, atau gambar referensi.",
    submission_unknown:
        "Status pengiriman job ke Opus Labs belum dapat dipastikan (submission_unknown). Job tidak dikirim ulang otomatis demi mencegah pemotongan kredit ganda."
});

function normalizeErrorToken(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[\s.-]+/g, "_");
}

function translateOpusError(code, fallbackMessage = "") {
    const key = normalizeErrorToken(code);
    if (key && ERROR_MESSAGE_BY_CODE[key]) {
        return ERROR_MESSAGE_BY_CODE[key];
    }
    const lowerMsg = String(fallbackMessage || "").toLowerCase();
    for (const [knownCode, idMessage] of Object.entries(ERROR_MESSAGE_BY_CODE)) {
        if (lowerMsg.includes(knownCode) || lowerMsg.includes(knownCode.replace(/_/g, " "))) {
            return idMessage;
        }
    }
    const cleanFallback = String(fallbackMessage || "").trim();
    if (cleanFallback) {
        return cleanFallback;
    }
    if (code) {
        return `Opus Labs gagal memproses video (kode: ${String(code).trim()}).`;
    }
    return "Opus Labs gagal memproses video.";
}

/* =========================================================
   MCP JSON-RPC STREAMABLE HTTP PARSER & SESSION
========================================================= */

function tryParseJsonFromText(text) {
    if (typeof text !== "string") return null;
    const trimmed = text.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try {
            return JSON.parse(trimmed);
        } catch {
            /* lanjut ekstraksi blok JSON */
        }
    }
    const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
    if (fenced?.[1]) {
        const candidate = fenced[1].trim();
        if (candidate.startsWith("{") || candidate.startsWith("[")) {
            try {
                return JSON.parse(candidate);
            } catch {
                /* lanjut */
            }
        }
    }
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
        try {
            return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
        } catch {
            /* abaikan bila bukan objek JSON utuh */
        }
    }
    const firstBracket = trimmed.indexOf("[");
    const lastBracket = trimmed.lastIndexOf("]");
    if (firstBracket >= 0 && lastBracket > firstBracket) {
        try {
            return JSON.parse(trimmed.slice(firstBracket, lastBracket + 1));
        } catch {
            /* abaikan bila bukan array JSON utuh */
        }
    }
    return null;
}

function parseSseMessages(rawText) {
    const messages = [];
    const normalized = String(rawText || "").replace(/\r\n/g, "\n");
    const blocks = normalized.split(/\n\n+/);
    for (const block of blocks) {
        const dataLines = [];
        for (const line of block.split("\n")) {
            if (line.startsWith("data:")) {
                dataLines.push(line.slice(5).trimStart());
            }
        }
        if (!dataLines.length) continue;
        const joined = dataLines.join("\n").trim();
        if (!joined || joined === "[DONE]") continue;
        try {
            messages.push(JSON.parse(joined));
        } catch {
            /* abaikan event non-JSON */
        }
    }
    return messages;
}

function parseMcpResponseBody(rawText, contentType = "", expectedId = null) {
    const trimmed = String(rawText || "").trim();
    if (!trimmed) return null;

    if (String(contentType).toLowerCase().includes("text/event-stream") || /^event:|^data:/m.test(trimmed)) {
        const messages = parseSseMessages(trimmed);
        if (!messages.length) return null;
        if (expectedId !== null && expectedId !== undefined) {
            const exact = messages.find(msg => msg && msg.id === expectedId);
            if (exact) return exact;
        }
        const withResultOrError = messages.filter(
            msg => msg && (msg.result !== undefined || msg.error !== undefined)
        );
        return withResultOrError[withResultOrError.length - 1] || messages[messages.length - 1];
    }

    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
        if (expectedId !== null && expectedId !== undefined) {
            const exact = parsed.find(msg => msg && msg.id === expectedId);
            if (exact) return exact;
        }
        return parsed[parsed.length - 1] || null;
    }
    return parsed;
}

function unpackMcpToolResult(result) {
    if (!result || typeof result !== "object") {
        return { isError: false, data: result, content: [], text: "" };
    }
    const content = Array.isArray(result.content) ? result.content : [];
    let data = result.structuredContent !== undefined ? result.structuredContent : null;
    if (
        data &&
        typeof data === "object" &&
        !Array.isArray(data) &&
        Object.keys(data).length === 0 &&
        content.length > 0
    ) {
        data = null;
    }
    const textParts = [];
    for (const part of content) {
        if (part?.type === "text" && typeof part.text === "string") {
            const trimmed = part.text.trim();
            textParts.push(trimmed);
            if (!data) {
                const parsed = tryParseJsonFromText(trimmed);
                if (parsed !== null) {
                    data = parsed;
                }
            }
        }
    }
    if (!data && result.structuredContent === undefined && content.length === 0) {
        data = result;
    }
    return {
        isError: result.isError === true,
        data,
        content,
        text: textParts.join("\n").trim()
    };
}

async function fetchWithTimeout(url, init, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, {
            ...init,
            signal: controller.signal
        });
    } catch (error) {
        if (error?.name === "AbortError") {
            throw createProviderError({
                message: `Koneksi ke Opus Labs melewati batas waktu (${Math.round(timeoutMs / 1000)} detik).`,
                code: "TIMEOUT",
                status: 504
            });
        }
        throw createProviderError({
            message: `Gagal menghubungi server Opus Labs: ${error?.message || "network error"}`,
            code: "NETWORK_ERROR",
            status: 502
        });
    } finally {
        clearTimeout(timer);
    }
}

async function callMcpJsonRpc({
    endpoint,
    bearerToken,
    sessionId,
    method,
    params,
    id,
    isNotification = false,
    timeoutMs = CREATE_TIMEOUT_MS
}) {
    const headers = {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
        "MCP-Protocol-Version": MCP_PROTOCOL_VERSION
    };
    if (bearerToken) {
        headers.Authorization = `Bearer ${bearerToken}`;
    }
    if (sessionId) {
        headers["Mcp-Session-Id"] = sessionId;
    }

    const payload = {
        jsonrpc: "2.0",
        method,
        ...(params !== undefined ? { params } : {}),
        ...(!isNotification ? { id } : {})
    };

    const response = await fetchWithTimeout(
        endpoint,
        {
            method: "POST",
            headers,
            body: JSON.stringify(payload)
        },
        timeoutMs
    );

    const nextSessionId =
        response.headers.get("mcp-session-id") ||
        response.headers.get("Mcp-Session-Id") ||
        sessionId ||
        "";

    if (response.status === 401 || response.status === 403) {
        const errBody = await response.text().catch(() => "");
        throw createProviderError({
            message: `Autentikasi Opus Labs ditolak (HTTP ${response.status}). Perbarui token Opus di Admin Panel atau OPUS_REFRESH_TOKEN.`,
            code: "OPUS_AUTH_REJECTED",
            providerCode: "unauthorized",
            status: response.status,
            raw: redactSecrets(errBody.slice(0, 240), [bearerToken])
        });
    }

    const rawText = await response.text();
    if (isNotification) {
        return { sessionId: nextSessionId, message: null };
    }

    if (!response.ok) {
        throw createProviderError({
            message: `Server Opus Labs mengembalikan HTTP ${response.status}${rawText ? `: ${redactSecrets(rawText.slice(0, 200), [bearerToken])}` : "."}`,
            code: "OPUS_HTTP_ERROR",
            status: response.status >= 400 && response.status < 600 ? response.status : 502
        });
    }

    let message = null;
    try {
        message = parseMcpResponseBody(rawText, response.headers.get("content-type") || "", id);
    } catch {
        throw createProviderError({
            message: `Respons MCP Opus Labs tidak valid pada ${method}.`,
            code: "INVALID_MCP_RESPONSE",
            status: 502
        });
    }

    if (message?.error) {
        const rpcCode = message.error.data?.code || message.error.code || "mcp_rpc_error";
        const rpcMsg = message.error.message || JSON.stringify(message.error);
        throw createProviderError({
            message: translateOpusError(rpcCode, rpcMsg),
            code: String(rpcCode),
            providerCode: String(rpcCode),
            status: Number(rpcCode) === -32602 ? 422 : 502,
            raw: message.error
        });
    }

    return {
        sessionId: nextSessionId,
        message
    };
}

async function openMcpSession({
    endpoint,
    apiKey,
    timeoutMs = CREATE_TIMEOUT_MS,
    includeTools = true
}) {
    let bearerToken = await resolveBearerToken(apiKey);
    let sessionId = "";
    let rpcCounter = 1;

    const sendRpc = async (method, params, isNotification = false) => {
        const reqId = isNotification ? undefined : rpcCounter++;
        return await callMcpJsonRpc({
            endpoint,
            bearerToken,
            sessionId,
            method,
            params,
            id: reqId,
            isNotification,
            timeoutMs
        });
    };

    let initRes;
    try {
        initRes = await sendRpc("initialize", {
            protocolVersion: MCP_PROTOCOL_VERSION,
            capabilities: {},
            clientInfo: {
                name: "genz-ai-video-provider",
                version: "1.0.0"
            }
        });
    } catch (err) {
        /* Jika token cached baru saja kedaluwarsa, paksa refresh 1x lalu ulangi initialize */
        if (err?.status === 401 || err?.code === "OPUS_AUTH_REJECTED") {
            bearerToken = await resolveBearerToken(apiKey, { forceRefresh: true });
            initRes = await sendRpc("initialize", {
                protocolVersion: MCP_PROTOCOL_VERSION,
                capabilities: {},
                clientInfo: {
                    name: "genz-ai-video-provider",
                    version: "1.0.0"
                }
            });
        } else {
            throw err;
        }
    }

    if (initRes.sessionId) {
        sessionId = initRes.sessionId;
    }

    await sendRpc("notifications/initialized", {}, true).catch(() => null);

    let tools = [];
    if (includeTools) {
        if (
            !sessionId &&
            cachedToolsState.endpoint === endpoint &&
            Array.isArray(cachedToolsState.tools) &&
            Date.now() - cachedToolsState.fetchedAtMs < TOOLS_CACHE_TTL_MS
        ) {
            tools = cachedToolsState.tools;
        } else {
            const listRes = await sendRpc("tools/list", {});
            tools = Array.isArray(listRes.message?.result?.tools)
                ? listRes.message.result.tools
                : [];
            if (tools.length > 0) {
                cachedToolsState = {
                    endpoint,
                    tools,
                    fetchedAtMs: Date.now()
                };
            }
        }
    }

    async function callTool(name, args = {}) {
        const callRes = await sendRpc("tools/call", {
            name,
            arguments: args
        });
        if (callRes.sessionId) {
            sessionId = callRes.sessionId;
        }
        return unpackMcpToolResult(callRes.message?.result);
    }

    return {
        bearerToken,
        sessionId,
        tools,
        callTool
    };
}

function findMcpTool(tools, baseName) {
    if (!Array.isArray(tools)) return null;
    const exact = tools.find(tool => tool?.name === baseName);
    if (exact) return exact;
    const suffix = `_${baseName}`;
    return tools.find(
        tool =>
            typeof tool?.name === "string" &&
            (tool.name.endsWith(suffix) ||
                tool.name.endsWith(`/${baseName}`) ||
                tool.name.endsWith(`.${baseName}`))
    ) || null;
}

/* =========================================================
   JSON SCHEMA INTROSPECTION HELPERS
========================================================= */

function derefSchema(schema, rootSchema, seen = new Set()) {
    if (!schema || typeof schema !== "object") return null;
    if (typeof schema.$ref === "string" && rootSchema && typeof rootSchema === "object") {
        const ref = schema.$ref;
        if (seen.has(ref)) return schema;
        seen.add(ref);
        const match = /^#\/(\$defs|definitions)\/(.+)$/.exec(ref);
        if (match) {
            const bucket = rootSchema[match[1]];
            const key = match[2].replace(/~1/g, "/").replace(/~0/g, "~");
            if (bucket && typeof bucket[key] === "object") {
                const resolved = derefSchema(bucket[key], rootSchema, seen);
                const { $ref: _ignored, ...rest } = schema;
                return Object.keys(rest).length ? { ...resolved, ...rest } : resolved;
            }
        }
    }
    return schema;
}

function isNullOnlySchema(schema) {
    if (!schema || typeof schema !== "object") return false;
    if (schema.type === "null") return true;
    if (Array.isArray(schema.enum) && schema.enum.length === 1 && schema.enum[0] === null) return true;
    if (schema.const === null) return true;
    return false;
}

function collectSchemaVariants(schema, rootSchema) {
    const node = derefSchema(schema, rootSchema);
    if (!node || typeof node !== "object") return [];
    const list = [];
    for (const combinator of ["anyOf", "oneOf", "allOf"]) {
        if (Array.isArray(node[combinator])) {
            for (const sub of node[combinator]) {
                const resolved = derefSchema(sub, rootSchema);
                if (resolved && !isNullOnlySchema(resolved)) {
                    list.push(...collectSchemaVariants(resolved, rootSchema));
                }
            }
        }
    }
    if (!list.length) {
        list.push(node);
    } else if (node.properties || node.items || node.enum || node.const !== undefined) {
        list.unshift(node);
    }
    return list;
}

function extractAllowedValues(schema, rootSchema) {
    const variants = collectSchemaVariants(schema, rootSchema);
    const values = [];
    const add = val => {
        if (val !== null && val !== undefined && !values.includes(val)) {
            values.push(val);
        }
    };
    for (const variant of variants) {
        if (Array.isArray(variant.enum)) {
            for (const item of variant.enum) add(item);
        }
        if (variant.const !== undefined) {
            add(variant.const);
        }
    }
    return values;
}

function schemaTypeIncludes(schema, rootSchema, targetType) {
    const variants = collectSchemaVariants(schema, rootSchema);
    for (const v of variants) {
        if (!v || typeof v !== "object") continue;
        if (v.type === targetType) return true;
        if (Array.isArray(v.type) && v.type.includes(targetType)) return true;
        if (targetType === "object" && v.properties && typeof v.properties === "object") return true;
        if (targetType === "array" && v.items) return true;
        if (targetType === "string" && Array.isArray(v.enum) && v.enum.some(x => typeof x === "string")) return true;
        if (targetType === "integer" && Array.isArray(v.enum) && v.enum.some(x => Number.isInteger(x))) return true;
        if (targetType === "number" && Array.isArray(v.enum) && v.enum.some(x => typeof x === "number")) return true;
    }
    return false;
}

function resolveObjectSchema(schema, rootSchema, preferBranch = null) {
    const node = derefSchema(schema, rootSchema);
    if (!node || typeof node !== "object") {
        return { properties: null, required: [], raw: null };
    }
    const mergedProps = {};
    const requiredSet = new Set();
    let hasExplicitProps = false;

    const absorb = candidate => {
        const c = derefSchema(candidate, rootSchema);
        if (!c || typeof c !== "object") return;
        if (c.properties && typeof c.properties === "object") {
            hasExplicitProps = true;
            for (const [key, val] of Object.entries(c.properties)) {
                if (!(key in mergedProps)) {
                    mergedProps[key] = derefSchema(val, rootSchema) || val;
                }
            }
        }
        if (Array.isArray(c.required)) {
            for (const reqKey of c.required) {
                if (typeof reqKey === "string") requiredSet.add(reqKey);
            }
        }
    };

    absorb(node);
    if (Array.isArray(node.allOf)) {
        for (const sub of node.allOf) absorb(sub);
    }
    if (!hasExplicitProps) {
        for (const combinator of ["anyOf", "oneOf"]) {
            if (Array.isArray(node[combinator])) {
                const objBranches = node[combinator]
                    .map(sub => derefSchema(sub, rootSchema))
                    .filter(sub => sub && !isNullOnlySchema(sub) && (sub.type === "object" || sub.properties || sub.allOf));
                if (objBranches.length) {
                    const chosen =
                        (typeof preferBranch === "function" && objBranches.find(preferBranch)) ||
                        objBranches[0];
                    const resolvedChosen = resolveObjectSchema(chosen, rootSchema);
                    if (resolvedChosen.properties) {
                        hasExplicitProps = true;
                        Object.assign(mergedProps, resolvedChosen.properties);
                        for (const r of resolvedChosen.required) requiredSet.add(r);
                    }
                    break;
                }
            }
        }
    }

    return {
        properties: hasExplicitProps ? mergedProps : null,
        required: Array.from(requiredSet),
        raw: node
    };
}

function resolveArrayItemSchema(schema, rootSchema) {
    const variants = collectSchemaVariants(schema, rootSchema);
    for (const variant of variants) {
        if (variant && (variant.type === "array" || variant.items)) {
            if (Array.isArray(variant.items)) {
                return derefSchema(variant.items[0], rootSchema);
            }
            if (variant.items && typeof variant.items === "object") {
                return derefSchema(variant.items, rootSchema);
            }
            return { type: "object" };
        }
    }
    return null;
}

function pickSupportedKey(properties, candidates, fallbackKey = "") {
    if (!properties) return fallbackKey;
    for (const key of candidates) {
        if (Object.prototype.hasOwnProperty.call(properties, key)) {
            return key;
        }
    }
    const lowerMap = new Map(Object.keys(properties).map(k => [k.toLowerCase(), k]));
    for (const key of candidates) {
        const hit = lowerMap.get(key.toLowerCase());
        if (hit) return hit;
    }
    return "";
}

function normalizeCompactToken(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "");
}

function matchVideoModelValue(desiredModel, aliases = [], allowedValues = []) {
    const candidates = [
        desiredModel,
        ...(Array.isArray(aliases) ? aliases : [])
    ]
        .map(v => String(v || "").trim())
        .filter(Boolean);

    if (!allowedValues.length) {
        return candidates[0] || "";
    }

    for (const candidate of candidates) {
        const exact = allowedValues.find(v => String(v).toLowerCase() === candidate.toLowerCase());
        if (exact !== undefined) return exact;
    }

    const compactCandidates = candidates.map(normalizeCompactToken).filter(Boolean);
    for (const compact of compactCandidates) {
        const hit = allowedValues.find(v => normalizeCompactToken(v) === compact);
        if (hit !== undefined) return hit;
    }

    for (const compact of compactCandidates) {
        const partial = allowedValues.find(v => {
            const cv = normalizeCompactToken(v);
            return cv.includes(compact) || compact.includes(cv);
        });
        if (partial !== undefined) return partial;
    }

    return null;
}

function matchWorkflowValue(desiredWorkflow, allowedValues = []) {
    const wanted = String(desiredWorkflow || "").trim();
    if (!wanted) return allowedValues[0] ?? "";
    if (!allowedValues.length) return wanted;

    const aliasesByWorkflow = {
        first_last_frame: [
            "first_last_frame",
            "first-last-frame",
            "firstLastFrame",
            "image2video",
            "image_to_video",
            "image-to-video",
            "i2v",
            "keyframe2video",
            "frames"
        ],
        reference2video: [
            "reference2video",
            "reference_to_video",
            "reference-to-video",
            "r2v",
            "text2video",
            "text_to_video",
            "text-to-video",
            "t2v"
        ]
    };

    const candidates = aliasesByWorkflow[wanted] || [wanted];
    for (const candidate of candidates) {
        const exact = allowedValues.find(v => String(v).toLowerCase() === candidate.toLowerCase());
        if (exact !== undefined) return exact;
        const compactHit = allowedValues.find(
            v => normalizeCompactToken(v) === normalizeCompactToken(candidate)
        );
        if (compactHit !== undefined) return compactHit;
    }
    return allowedValues[0];
}

function matchEnumCaseInsensitive(candidates, allowedValues = []) {
    const list = (Array.isArray(candidates) ? candidates : [candidates])
        .map(v => String(v ?? "").trim())
        .filter(Boolean);
    if (!allowedValues.length) return list[0] ?? null;
    for (const candidate of list) {
        const exact = allowedValues.find(v => String(v).toLowerCase() === candidate.toLowerCase());
        if (exact !== undefined) return exact;
    }
    for (const candidate of list) {
        const compact = normalizeCompactToken(candidate);
        const hit = allowedValues.find(v => normalizeCompactToken(v) === compact);
        if (hit !== undefined) return hit;
    }
    return null;
}

/* =========================================================
   PROJECT CREATION & ASSET STAGING (import_assets)
========================================================= */

function unwrapEnvelope(raw) {
    let curr = raw;
    for (let depth = 0; depth < 3; depth += 1) {
        if (!curr || typeof curr !== "object" || Array.isArray(curr)) break;
        const inner = curr.data ?? curr.result ?? curr.output ?? curr.payload ?? curr.response;
        if (inner && typeof inner === "object" && !Array.isArray(inner)) {
            curr = { ...curr, ...inner };
            const subInner = inner.data ?? inner.result ?? inner.output ?? inner.payload ?? inner.response;
            if (!subInner || typeof subInner !== "object" || Array.isArray(subInner)) {
                break;
            }
            continue;
        }
        break;
    }
    return curr;
}

async function ensureProjectId(session) {
    const whoamiTool = findMcpTool(session.tools, "opus_video_tools_whoami") || findMcpTool(session.tools, "whoami");
    if (whoamiTool) {
        await session.callTool(whoamiTool.name, {}).catch(() => null);
    }

    const createProjectTool = findMcpTool(session.tools, "create_project");
    if (!createProjectTool) return "";

    const rootSchema = createProjectTool.inputSchema;
    const objSchema = resolveObjectSchema(rootSchema, rootSchema);
    const props = objSchema.properties;
    const args = {};

    const nameKey = pickSupportedKey(props, ["name", "title", "projectName", "project_name"], props ? "" : "name");
    if (nameKey) {
        args[nameKey] = `genz-video-${new Date().toISOString().slice(0, 10)}`;
    }
    const reqKey = pickSupportedKey(
        props,
        ["requestKey", "idempotencyKey", "request_key", "idempotency_key"],
        props ? "" : "requestKey"
    );
    if (reqKey) {
        args[reqKey] = makeUuid();
    }

    const res = await session.callTool(createProjectTool.name, args);
    if (res.isError) {
        throw createProviderError({
            message: translateOpusError(res.data?.code || res.data?.errorCode, res.text || "Gagal membuat project Opus Labs."),
            code: String(res.data?.code || "CREATE_PROJECT_FAILED"),
            status: 502,
            raw: res.data
        });
    }

    const data = unwrapEnvelope(res.data);
    const projectId = String(
        data?.projectId ||
        data?.project_id ||
        data?.project?.id ||
        data?.project?.projectId ||
        data?.id ||
        ""
    ).trim();

    return projectId;
}

function inferImageMimeFromUrl(url) {
    const clean = String(url || "").split("?")[0].split("#")[0].toLowerCase();
    if (clean.endsWith(".png")) return "image/png";
    if (clean.endsWith(".webp")) return "image/webp";
    return "image/jpeg";
}

function extFromMime(mime) {
    if (mime === "image/png") return "png";
    if (mime === "image/webp") return "webp";
    return "jpg";
}

function extractImportedAssetRecord(raw, clientItemId = "") {
    const data = unwrapEnvelope(raw);
    if (!data || typeof data !== "object") {
        return { assetId: "", status: "", uploadUrl: "", uploadMethod: "PUT", uploadHeaders: null, uri: "" };
    }

    const containers = [
        data.assets,
        data.items,
        data.results,
        data.uploads,
        data.imported,
        data.records
    ].filter(Array.isArray);

    let item = null;
    for (const list of containers) {
        if (!list.length) continue;
        if (clientItemId) {
            item = list.find(
                el =>
                    el &&
                    typeof el === "object" &&
                    [el.clientId, el.client_id, el.itemId, el.id, el.label].includes(clientItemId)
            );
        }
        if (!item) {
            item = list.find(el => el && typeof el === "object") || null;
        }
        if (item) break;
    }

    const source = item ? { ...data, ...item } : data;
    const uploadObj = source.upload && typeof source.upload === "object" ? source.upload : null;

    const assetId = String(
        source.assetId ||
        source.asset_id ||
        source.durableAssetId ||
        source.id ||
        ""
    ).trim();

    const validAssetId = assetId && assetId !== clientItemId ? assetId : "";
    const status = String(source.status || source.state || "").trim().toLowerCase();
    const uploadUrl = String(
        source.uploadUrl ||
        source.upload_url ||
        source.presignedUrl ||
        source.presigned_url ||
        source.putUrl ||
        source.signedUploadUrl ||
        uploadObj?.url ||
        uploadObj?.uploadUrl ||
        ""
    ).trim();

    const uploadMethod = String(
        source.uploadMethod ||
        source.upload_method ||
        uploadObj?.method ||
        "PUT"
    ).trim().toUpperCase();

    const uploadHeaders =
        (source.uploadHeaders && typeof source.uploadHeaders === "object" ? source.uploadHeaders : null) ||
        (uploadObj?.headers && typeof uploadObj.headers === "object" ? uploadObj.headers : null);

    const uri = String(
        source.uri ||
        source.url ||
        source.assetUri ||
        source.assetUrl ||
        source.storageUri ||
        ""
    ).trim();

    return {
        assetId: validAssetId,
        status,
        uploadUrl,
        uploadMethod: uploadMethod || "PUT",
        uploadHeaders,
        uri: /^https?:\/\//i.test(uri) && uri !== uploadUrl ? uri : ""
    };
}

async function downloadSourceImageBytes(imageUrl) {
    const res = await fetchWithTimeout(
        imageUrl,
        { method: "GET" },
        20_000
    );
    if (!res.ok) {
        throw createProviderError({
            message: `Gagal mengunduh gambar referensi untuk diunggah ke Opus Labs (HTTP ${res.status}).`,
            code: "REFERENCE_FETCH_FAILED",
            status: 422
        });
    }
    const contentType = String(res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (!bytes.byteLength) {
        throw createProviderError({
            message: "Gambar referensi kosong (0 byte).",
            code: "REFERENCE_EMPTY",
            status: 422
        });
    }
    return {
        bytes,
        mimeType: contentType.startsWith("image/") ? contentType : inferImageMimeFromUrl(imageUrl)
    };
}

async function stageSingleReferenceImage(session, importTool, projectId, refItem, index) {
    if (!importTool) {
        return {
            assetId: "",
            url: refItem.url,
            role: refItem.role,
            label: refItem.label,
            mimeType: refItem.mimeType
        };
    }

    const rootSchema = importTool.inputSchema;
    const topObj = resolveObjectSchema(rootSchema, rootSchema);
    const topProps = topObj.properties;
    const arrayKey = pickSupportedKey(
        topProps,
        ["assets", "items", "files", "inputs", "sources", "media", "uploads"],
        ""
    );
    const itemObj = arrayKey
        ? resolveObjectSchema(resolveArrayItemSchema(topProps[arrayKey], rootSchema), rootSchema)
        : topObj;
    const itemProps = itemObj.properties;

    const clientItemId = `asset-${index + 1}`;
    const entry = {};

    const idKey = pickSupportedKey(itemProps, ["clientId", "client_id", "itemId", "item_id"], "");
    if (idKey) entry[idKey] = clientItemId;

    const nameKey = pickSupportedKey(itemProps, ["fileName", "filename", "file_name", "name", "label"], "");
    if (nameKey) entry[nameKey] = refItem.fileName;

    const mimeKey = pickSupportedKey(itemProps, ["mimeType", "mime_type", "contentType", "content_type"], "");
    if (mimeKey) entry[mimeKey] = refItem.mimeType;

    const kindKey = pickSupportedKey(itemProps, ["mediaType", "media_type", "assetType", "asset_type", "type", "kind"], "");
    if (kindKey) {
        const allowedKinds = extractAllowedValues(itemProps[kindKey], rootSchema);
        const matchedKind = matchEnumCaseInsensitive(["image", "photo", "reference", "frame"], allowedKinds);
        if (matchedKind !== null) entry[kindKey] = matchedKind;
    }

    const urlKey = pickSupportedKey(
        itemProps,
        ["url", "sourceUrl", "source_url", "uri", "imageUrl", "image_url", "remoteUrl"],
        !itemProps ? "url" : ""
    );
    const dataKey = pickSupportedKey(
        itemProps,
        ["data", "base64", "contentBase64", "content_base64", "bytesBase64", "dataUrl", "data_url"],
        ""
    );

    let cachedDownloaded = null;
    if (urlKey) {
        entry[urlKey] = refItem.url;
    } else if (dataKey) {
        cachedDownloaded = await downloadSourceImageBytes(refItem.url);
        const b64 = bytesToBase64(cachedDownloaded.bytes);
        entry[dataKey] = /url|uri/i.test(dataKey)
            ? `data:${cachedDownloaded.mimeType};base64,${b64}`
            : b64;
    }

    const callArgs = {};
    const projKey = pickSupportedKey(topProps, ["projectId", "project_id"], projectId && !topProps ? "projectId" : "");
    if (projKey && projectId) {
        callArgs[projKey] = projectId;
    }
    const reqKey = pickSupportedKey(topProps, ["requestKey", "idempotencyKey", "request_key"], "");
    if (reqKey) {
        callArgs[reqKey] = makeUuid();
    }

    if (arrayKey) {
        callArgs[arrayKey] = [entry];
    } else {
        Object.assign(callArgs, entry);
    }

    let stepRes = await session.callTool(importTool.name, callArgs);
    if (stepRes.isError && !urlKey && !dataKey) {
        return {
            assetId: "",
            url: refItem.url,
            role: refItem.role,
            label: refItem.label,
            mimeType: refItem.mimeType
        };
    }

    let record = extractImportedAssetRecord(stepRes.data, clientItemId);

    /* Tangani kontrak resmi Opus MCP: status === "awaiting_upload" -> PUT bytes -> finalize import_assets */
    if ((record.status === "awaiting_upload" || record.uploadUrl) && record.uploadUrl) {
        if (!cachedDownloaded) {
            cachedDownloaded = await downloadSourceImageBytes(refItem.url);
        }
        const putHeaders = {
            ...(record.uploadHeaders || {})
        };
        if (!Object.keys(putHeaders).some(k => k.toLowerCase() === "content-type")) {
            putHeaders["Content-Type"] = cachedDownloaded.mimeType;
        }

        const putRes = await fetchWithTimeout(
            record.uploadUrl,
            {
                method: record.uploadMethod || "PUT",
                headers: putHeaders,
                body: cachedDownloaded.bytes
            },
            25_000
        );

        if (!putRes.ok) {
            throw createProviderError({
                message: `Gagal mengunggah gambar referensi ke penyimpanan Opus Labs (HTTP ${putRes.status}).`,
                code: "ASSET_UPLOAD_FAILED",
                status: 502
            });
        }

        if (record.assetId) {
            const finalizeEntry = {};
            const assetIdKey = pickSupportedKey(itemProps, ["assetId", "asset_id", "id"], "assetId");
            finalizeEntry[assetIdKey] = record.assetId;
            const finalizeStatusKey = pickSupportedKey(itemProps, ["status", "action", "phase"], "");
            if (finalizeStatusKey) {
                const allowedStatuses = extractAllowedValues(itemProps[finalizeStatusKey], rootSchema);
                const matched = matchEnumCaseInsensitive(["uploaded", "complete", "finalize", "ready"], allowedStatuses);
                if (matched !== null) finalizeEntry[finalizeStatusKey] = matched;
            }
            const finalizeArgs = {
                ...(projKey && projectId ? { [projKey]: projectId } : {}),
                ...(reqKey ? { [reqKey]: makeUuid() } : {}),
                ...(arrayKey ? { [arrayKey]: [finalizeEntry] } : finalizeEntry)
            };
            const finRes = await session.callTool(importTool.name, finalizeArgs).catch(() => null);
            if (finRes && !finRes.isError) {
                const finRecord = extractImportedAssetRecord(finRes.data, clientItemId);
                if (finRecord.assetId) {
                    record = {
                        ...record,
                        ...finRecord,
                        assetId: finRecord.assetId || record.assetId
                    };
                }
            }
        }
    }

    return {
        assetId: record.assetId || "",
        url: record.uri || refItem.url,
        role: refItem.role,
        label: refItem.label,
        mimeType: cachedDownloaded?.mimeType || refItem.mimeType
    };
}

/* =========================================================
   BUILD generate_video_clips ARGUMENTS FROM LIVE SCHEMA
========================================================= */

function buildFrameFieldValue(propSchema, rootSchema, stagedAsset) {
    if (!stagedAsset) return undefined;
    if (!propSchema) {
        return stagedAsset.assetId || stagedAsset.url;
    }
    const expectsString = schemaTypeIncludes(propSchema, rootSchema, "string");
    const expectsObject = schemaTypeIncludes(propSchema, rootSchema, "object");

    if (expectsString && !expectsObject) {
        return stagedAsset.assetId || stagedAsset.url;
    }

    if (expectsObject) {
        const obj = resolveObjectSchema(propSchema, rootSchema);
        const props = obj.properties;
        if (props) {
            const frameObj = {};
            const idKey = pickSupportedKey(props, ["assetId", "asset_id", "id", "ref", "assetRef"], "");
            if (idKey && stagedAsset.assetId) {
                frameObj[idKey] = stagedAsset.assetId;
            }
            const urlKey = pickSupportedKey(props, ["url", "uri", "imageUrl", "image_url", "sourceUrl"], "");
            if (urlKey && (!idKey || !stagedAsset.assetId || obj.required.includes(urlKey)) && stagedAsset.url) {
                frameObj[urlKey] = stagedAsset.url;
            }
            const mimeKey = pickSupportedKey(props, ["mimeType", "mime_type", "contentType"], "");
            if (mimeKey && obj.required.includes(mimeKey) && stagedAsset.mimeType) {
                frameObj[mimeKey] = stagedAsset.mimeType;
            }
            if (Object.keys(frameObj).length > 0) {
                return frameObj;
            }
        }
        return stagedAsset.assetId
            ? { assetId: stagedAsset.assetId }
            : { url: stagedAsset.url };
    }

    return stagedAsset.assetId || stagedAsset.url;
}

function buildReferenceAssetsValue(propSchema, rootSchema, stagedRefs) {
    const itemSchema = resolveArrayItemSchema(propSchema, rootSchema);
    if (
        itemSchema &&
        schemaTypeIncludes(itemSchema, rootSchema, "string") &&
        !schemaTypeIncludes(itemSchema, rootSchema, "object")
    ) {
        return stagedRefs.map(r => r.assetId || r.url).filter(Boolean);
    }

    const itemObj = resolveObjectSchema(itemSchema, rootSchema);
    const props = itemObj.properties;
    if (props) {
        return stagedRefs.map((ref, idx) => {
            const entry = {};
            const idKey = pickSupportedKey(props, ["assetId", "asset_id", "assetRef", "ref", "id"], "");
            if (idKey && ref.assetId) {
                entry[idKey] = ref.assetId;
            }
            const urlKey = pickSupportedKey(props, ["url", "uri", "imageUrl", "image_url", "sourceUrl"], "");
            if (urlKey && (!idKey || !ref.assetId || itemObj.required.includes(urlKey)) && ref.url) {
                entry[urlKey] = ref.url;
            }
            const labelKey = pickSupportedKey(props, ["label", "tag", "slot", "name", "referenceId"], "");
            if (labelKey && labelKey !== idKey) {
                const allowedLabels = extractAllowedValues(props[labelKey], rootSchema);
                const matched = matchEnumCaseInsensitive(
                    [`image${idx + 1}`, `@image${idx + 1}`, ref.label],
                    allowedLabels
                );
                if (matched !== null) {
                    entry[labelKey] = matched;
                }
            }
            const roleKey = pickSupportedKey(props, ["role", "kind", "type", "usage"], "");
            if (roleKey) {
                const allowedRoles = extractAllowedValues(props[roleKey], rootSchema);
                const matchedRole = matchEnumCaseInsensitive(
                    [ref.role, "reference", "image", "subject", "character"],
                    allowedRoles
                );
                if (matchedRole !== null) {
                    entry[roleKey] = matchedRole;
                }
            }
            return entry;
        });
    }

    return stagedRefs.map((ref, idx) => ({
        ...(ref.assetId ? { assetId: ref.assetId } : { url: ref.url }),
        label: `image${idx + 1}`
    }));
}

function populateClipFields(target, objectSchema, rootSchema, {
    prompt,
    opusModel,
    modelAliases,
    workflow,
    durationSeconds,
    resolution,
    aspectRatio,
    generateAudio,
    stagedFirstFrame,
    stagedLastFrame,
    stagedReferences,
    projectId,
    requestKey,
    isBatchItem = false,
    minimal = false
}) {
    const props = objectSchema?.properties;
    const required = Array.isArray(objectSchema?.required) ? objectSchema.required : [];

    if (isBatchItem) {
        const clipIdKey = pickSupportedKey(
            props,
            ["clipId", "clip_id", "shotId", "shot_id", "videoId", "video_id", "itemId", "item_id", "id"],
            !props ? "clipId" : ""
        );
        if (clipIdKey) {
            target[clipIdKey] = props?.[clipIdKey]?.format === "uuid" ? makeUuid() : "clip-1";
        }
    } else {
        const reqClipId = ["clipId", "clip_id", "shotId", "shot_id", "videoId", "video_id"].find(
            k => props && Object.prototype.hasOwnProperty.call(props, k) && required.includes(k)
        );
        if (reqClipId) {
            target[reqClipId] = props[reqClipId]?.format === "uuid" ? makeUuid() : "clip-1";
        }
    }

    const labelKey = pickSupportedKey(props, ["outputLabel", "output_label", "label", "title", "name"], "");
    if (labelKey && (isBatchItem || required.includes(labelKey) || /outputlabel/i.test(labelKey))) {
        target[labelKey] = "clip-1";
    }

    const projKey = pickSupportedKey(
        props,
        ["projectId", "project_id"],
        !props && !isBatchItem && projectId ? "projectId" : ""
    );
    if (projKey && projectId && target[projKey] === undefined && (!isBatchItem || required.includes(projKey))) {
        target[projKey] = projectId;
    }

    const reqKeyName = pickSupportedKey(
        props,
        ["requestKey", "idempotencyKey", "request_key", "idempotency_key"],
        !props && !isBatchItem ? "requestKey" : ""
    );
    if (reqKeyName && requestKey && target[reqKeyName] === undefined && (!isBatchItem || required.includes(reqKeyName))) {
        target[reqKeyName] = requestKey;
    }

    const promptKey = pickSupportedKey(
        props,
        ["prompt", "description", "instruction", "text"],
        !props ? "prompt" : ""
    );
    if (promptKey) {
        target[promptKey] = prompt;
    }

    if (opusModel) {
        const modelKey = pickSupportedKey(
            props,
            ["model", "videoModel", "video_model", "modelId", "model_id", "providerModel"],
            !props ? "model" : ""
        );
        if (modelKey) {
            const allowedModels = extractAllowedValues(props?.[modelKey], rootSchema);
            const matchedModel = matchVideoModelValue(opusModel, modelAliases, allowedModels);
            if (matchedModel !== null && matchedModel !== "") {
                target[modelKey] = matchedModel;
            } else if (allowedModels.length > 0) {
                throw createProviderError({
                    message: `Model video "${opusModel}" tidak tersedia di akun Opus Labs saat ini (tersedia: ${allowedModels.join(", ")}).`,
                    code: "model_unavailable",
                    providerCode: "model_unavailable",
                    status: 422
                });
            }
        }
    }

    const workflowKey = pickSupportedKey(
        props,
        ["workflow", "mode", "generationMode", "generation_mode", "route"],
        !props && workflow ? "workflow" : ""
    );
    if (workflowKey && (!minimal || required.includes(workflowKey))) {
        const allowedWorkflows = extractAllowedValues(props?.[workflowKey], rootSchema);
        target[workflowKey] = matchWorkflowValue(workflow, allowedWorkflows);
    }

    if (Number.isFinite(durationSeconds) && durationSeconds > 0) {
        const durKey = pickSupportedKey(
            props,
            ["durationSeconds", "duration_seconds", "duration", "lengthSeconds", "seconds"],
            !props ? "durationSeconds" : ""
        );
        if (durKey) {
            const durProp = props?.[durKey];
            const allowedDurs = extractAllowedValues(durProp, rootSchema);
            if (allowedDurs.length > 0) {
                const matchedDur =
                    allowedDurs.find(v => Number(String(v).replace(/s$/i, "")) === durationSeconds) ??
                    matchEnumCaseInsensitive([String(durationSeconds), `${durationSeconds}s`], allowedDurs);
                target[durKey] = matchedDur !== null ? matchedDur : durationSeconds;
            } else if (durProp && schemaTypeIncludes(durProp, rootSchema, "string") && !schemaTypeIncludes(durProp, rootSchema, "number") && !schemaTypeIncludes(durProp, rootSchema, "integer")) {
                target[durKey] = String(durationSeconds);
            } else {
                target[durKey] = Math.round(durationSeconds);
            }
        }
    }

    if (resolution) {
        const resKey = pickSupportedKey(
            props,
            ["resolution", "videoResolution", "video_resolution", "quality"],
            !props ? "resolution" : ""
        );
        if (resKey && (!minimal || required.includes(resKey))) {
            const allowedRes = extractAllowedValues(props?.[resKey], rootSchema);
            const matchedRes = matchEnumCaseInsensitive(
                [resolution, resolution.toLowerCase(), resolution.toUpperCase()],
                allowedRes
            );
            if (matchedRes !== null) {
                target[resKey] = matchedRes;
            } else if (required.includes(resKey) && allowedRes.length) {
                target[resKey] = allowedRes[0];
            }
        }
    }

    /* Sesuai docs Opus: jangan paksa aspectRatio saat memakai firstFrame kecuali diwajibkan oleh schema */
    const shouldSendRatio =
        Boolean(aspectRatio) &&
        (!stagedFirstFrame || required.some(k => /aspect|ratio/i.test(k)));

    if (shouldSendRatio || required.some(k => /aspect|ratio/i.test(k))) {
        const ratioKey = pickSupportedKey(
            props,
            ["aspectRatio", "aspect_ratio", "ratio"],
            !props && shouldSendRatio ? "aspectRatio" : ""
        );
        if (ratioKey) {
            const allowedRatios = extractAllowedValues(props?.[ratioKey], rootSchema);
            const matchedRatio = matchEnumCaseInsensitive([aspectRatio || "9:16"], allowedRatios);
            if (matchedRatio !== null) {
                target[ratioKey] = matchedRatio;
            } else if (required.includes(ratioKey) && allowedRatios.length) {
                target[ratioKey] = allowedRatios[0];
            }
        }
    }

    if (typeof generateAudio === "boolean") {
        const audioKey = pickSupportedKey(
            props,
            ["generateAudio", "generate_audio", "withAudio", "with_audio", "enableAudio", "audio"],
            ""
        );
        if (audioKey && schemaTypeIncludes(props?.[audioKey], rootSchema, "boolean")) {
            target[audioKey] = generateAudio;
        } else if (!props && generateAudio === true) {
            target.generateAudio = true;
        }
    }

    /*
     * Kontrak resmi AO_ADAPTER.md:
     * - workflow "first_last_frame": pakai firstFrame (+ opsional lastFrame), JANGAN campur loose referenceAssets
     * - workflow "reference2video": pakai referenceAssets (atau kosong untuk pure T2V)
     */
    if (stagedFirstFrame) {
        const firstAssetKey = pickSupportedKey(
            props,
            ["firstFrame", "first_frame", "firstFrameAsset", "firstFrameAssetId", "first_frame_asset_id", "startFrame", "start_frame"],
            ""
        );
        const firstUrlKey = pickSupportedKey(
            props,
            ["firstFrameUrl", "first_frame_url", "imageUrl", "image_url"],
            ""
        );
        if (firstAssetKey && (stagedFirstFrame.assetId || !firstUrlKey)) {
            target[firstAssetKey] = buildFrameFieldValue(props[firstAssetKey], rootSchema, stagedFirstFrame);
        } else if (firstUrlKey && stagedFirstFrame.url) {
            target[firstUrlKey] = stagedFirstFrame.url;
        } else if (!props) {
            if (stagedFirstFrame.assetId) target.firstFrame = stagedFirstFrame.assetId;
            else if (stagedFirstFrame.url) target.firstFrameUrl = stagedFirstFrame.url;
        }

        if (stagedLastFrame) {
            const lastAssetKey = pickSupportedKey(
                props,
                ["lastFrame", "last_frame", "lastFrameAsset", "lastFrameAssetId", "last_frame_asset_id", "endFrame", "end_frame"],
                ""
            );
            const lastUrlKey = pickSupportedKey(
                props,
                ["lastFrameUrl", "last_frame_url"],
                ""
            );
            if (lastAssetKey && (stagedLastFrame.assetId || !lastUrlKey)) {
                target[lastAssetKey] = buildFrameFieldValue(props[lastAssetKey], rootSchema, stagedLastFrame);
            } else if (lastUrlKey && stagedLastFrame.url) {
                target[lastUrlKey] = stagedLastFrame.url;
            } else if (!props) {
                if (stagedLastFrame.assetId) target.lastFrame = stagedLastFrame.assetId;
                else if (stagedLastFrame.url) target.lastFrameUrl = stagedLastFrame.url;
            }
        }
    } else if (Array.isArray(stagedReferences) && stagedReferences.length > 0) {
        const refKey = pickSupportedKey(
            props,
            ["referenceAssets", "reference_assets", "references", "assets", "inputAssets", "input_assets"],
            !props ? "referenceAssets" : ""
        );
        const refIdsKey = pickSupportedKey(
            props,
            ["referenceAssetIds", "reference_asset_ids", "assetIds", "asset_ids"],
            ""
        );
        const refUrlsKey = pickSupportedKey(
            props,
            ["referenceImageUrls", "reference_image_urls", "imageUrls", "image_urls"],
            ""
        );

        if (refKey && props?.[refKey]) {
            target[refKey] = buildReferenceAssetsValue(props[refKey], rootSchema, stagedReferences);
        } else if (refIdsKey && stagedReferences.some(r => r.assetId)) {
            target[refIdsKey] = stagedReferences.map(r => r.assetId).filter(Boolean);
        } else if (refUrlsKey) {
            target[refUrlsKey] = stagedReferences.map(r => r.url).filter(Boolean);
        } else if (!props) {
            target.referenceAssets = stagedReferences.map((r, idx) => ({
                ...(r.assetId ? { assetId: r.assetId } : { url: r.url }),
                label: `image${idx + 1}`
            }));
        }
    }
}

function buildGenerateVideoClipVariants(videoTool, params) {
    const rootSchema = videoTool?.inputSchema;
    const topObj = resolveObjectSchema(
        rootSchema,
        rootSchema,
        branch => Boolean(branch?.properties?.clips || branch?.properties?.prompt)
    );
    const topProps = topObj.properties;
    const batchArrayKey = pickSupportedKey(
        topProps,
        ["clips", "videos", "items", "shots", "requests", "tasks", "generations"],
        ""
    );

    const requestKey = makeUuid();
    const variants = [];

    const makeArgs = ({ minimal = false } = {}) => {
        const args = {};
        if (batchArrayKey) {
            const projKey = pickSupportedKey(topProps, ["projectId", "project_id"], "");
            if (projKey && params.projectId) {
                args[projKey] = params.projectId;
            }
            const reqKey = pickSupportedKey(
                topProps,
                ["requestKey", "idempotencyKey", "request_key", "idempotency_key"],
                ""
            );
            if (reqKey) {
                args[reqKey] = requestKey;
            }

            /* Beberapa schema menaruh model / workflow / aspectRatio juga di top-level batch */
            const topModelKey = pickSupportedKey(topProps, ["model", "videoModel", "video_model"], "");
            if (topModelKey && params.opusModel) {
                const allowedTopModels = extractAllowedValues(topProps[topModelKey], rootSchema);
                const matchedTopModel = matchVideoModelValue(params.opusModel, params.modelAliases, allowedTopModels);
                if (matchedTopModel) {
                    args[topModelKey] = matchedTopModel;
                }
            }

            const itemSchema = resolveArrayItemSchema(topProps[batchArrayKey], rootSchema);
            const itemObj = resolveObjectSchema(itemSchema, rootSchema);
            const clipEntry = {};
            populateClipFields(clipEntry, itemObj, rootSchema, {
                ...params,
                requestKey,
                isBatchItem: true,
                minimal
            });
            args[batchArrayKey] = [clipEntry];
        } else {
            populateClipFields(args, topObj, rootSchema, {
                ...params,
                requestKey,
                isBatchItem: false,
                minimal
            });
        }
        return args;
    };

    variants.push(makeArgs({ minimal: false }));
    const minimalVariant = makeArgs({ minimal: true });
    if (JSON.stringify(minimalVariant) !== JSON.stringify(variants[0])) {
        variants.push(minimalVariant);
    }
    return variants;
}

/* =========================================================
   JOB ID, STATUS, AND VIDEO OUTPUT EXTRACTION
========================================================= */

const TERMINAL_FAILED_TOKENS = new Set([
    "failed",
    "failure",
    "error",
    "errored",
    "cancelled",
    "canceled",
    "rejected",
    "aborted",
    "expired",
    "timed_out",
    "timeout",
    "submission_unknown"
]);

const TERMINAL_COMPLETED_TOKENS = new Set([
    "completed",
    "complete",
    "succeeded",
    "success",
    "done",
    "finished",
    "ready"
]);

const ACTIVE_PROCESSING_TOKENS = new Set([
    "queued",
    "queue",
    "pending",
    "waiting",
    "submitted",
    "created",
    "accepted",
    "processing",
    "running",
    "in_progress",
    "in-progress",
    "starting",
    "generating",
    "rendering"
]);

function normalizeStatus(rawStatus) {
    const token = String(rawStatus || "").trim().toLowerCase();
    if (!token) return "PROCESSING";
    if (TERMINAL_COMPLETED_TOKENS.has(token)) return "COMPLETED";
    if (TERMINAL_FAILED_TOKENS.has(token)) return "FAILED";
    if (token === "queued" || token === "queue" || token === "pending" || token === "submitted" || token === "created") {
        return "QUEUED";
    }
    if (ACTIVE_PROCESSING_TOKENS.has(token)) return "PROCESSING";
    return "PROCESSING";
}

function isLikelyVideoOutputUrl(url, keyHint = "", mimeHint = "") {
    const clean = String(url || "").trim();
    if (!/^https?:\/\//i.test(clean)) return false;
    const lowerKey = String(keyHint || "").toLowerCase();
    if (/(?:upload|presign_put|callback|webhook|firstframe|first_frame|lastframe|last_frame|reference|thumbnail|poster|cover|avatar)/i.test(lowerKey)) {
        return false;
    }
    const lowerMime = String(mimeHint || "").toLowerCase();
    if (lowerMime.startsWith("image/") || lowerMime.startsWith("audio/")) {
        return false;
    }
    if (lowerMime.startsWith("video/")) {
        return true;
    }
    const pathPart = clean.split("?")[0].split("#")[0].toLowerCase();
    if (/\.(?:png|jpe?g|webp|gif|svg|mp3|wav|m4a|aac|json)$/.test(pathPart)) {
        return false;
    }
    if (/\.(?:mp4|webm|mov|m4v)$/.test(pathPart)) {
        return true;
    }
    return /(?:video|clip|output|download|render|result|media|signed|asset|url|uri)/i.test(lowerKey);
}

function extractVideoUrls(rootData, seen = new WeakSet()) {
    const urls = [];
    const addUrl = url => {
        const clean = String(url || "").trim();
        if (clean && !urls.includes(clean)) {
            urls.push(clean);
        }
    };

    const visit = (node, keyHint = "", mimeHint = "", depth = 0) => {
        if (!node || depth > 8) return;
        if (typeof node === "string") {
            if (isLikelyVideoOutputUrl(node, keyHint, mimeHint)) {
                addUrl(node);
            }
            return;
        }
        if (Array.isArray(node)) {
            for (const el of node) {
                visit(el, keyHint, mimeHint, depth + 1);
            }
            return;
        }
        if (typeof node === "object") {
            if (seen.has(node)) return;
            seen.add(node);

            const localMime = String(
                node.mimeType ||
                node.mime_type ||
                node.contentType ||
                node.content_type ||
                mimeHint ||
                ""
            );

            /* Prioritaskan field URL video eksplisit terlebih dahulu */
            const priorityKeys = [
                "videoUrl",
                "video_url",
                "downloadUrl",
                "download_url",
                "outputUrl",
                "output_url",
                "resultUrl",
                "result_url",
                "signedUrl",
                "signed_url",
                "presignedUrl",
                "presigned_url",
                "clipUrl",
                "clip_url",
                "mediaUrl",
                "media_url",
                "fileUrl",
                "file_url",
                "cdnUrl",
                "cdn_url",
                "publicUrl",
                "public_url",
                "url",
                "uri"
            ];

            for (const pk of priorityKeys) {
                if (typeof node[pk] === "string" && isLikelyVideoOutputUrl(node[pk], pk, localMime)) {
                    addUrl(node[pk]);
                }
            }

            /* Prioritaskan container hasil generasi */
            const outputContainers = [
                "outputs",
                "clips",
                "videos",
                "results",
                "deliverables",
                "artifacts",
                "downloads",
                "files",
                "items",
                "jobs",
                "assets",
                "data",
                "result"
            ];

            for (const ck of outputContainers) {
                if (node[ck] !== undefined && node[ck] !== null) {
                    visit(node[ck], ck, localMime, depth + 1);
                }
            }

            for (const [k, v] of Object.entries(node)) {
                if (priorityKeys.includes(k) || outputContainers.includes(k)) continue;
                if (/(?:firstFrame|first_frame|lastFrame|last_frame|reference|input|upload|request)/i.test(k)) {
                    continue;
                }
                visit(v, k, localMime, depth + 1);
            }
        }
    };

    visit(rootData, "", "", 0);
    return urls;
}

function extractUsageSeconds(rootData) {
    const data = unwrapEnvelope(rootData);
    if (!data || typeof data !== "object") return null;

    const candidates = [
        data.durationSeconds,
        data.duration_seconds,
        data.duration,
        data.usage?.duration,
        data.usage?.durationSeconds,
        Array.isArray(data.outputs) ? data.outputs[0]?.durationSeconds : null,
        Array.isArray(data.clips) ? data.clips[0]?.durationSeconds : null
    ];

    for (const c of candidates) {
        const num = Number(c);
        if (Number.isFinite(num) && num > 0) {
            return Math.round(num);
        }
    }
    return null;
}

function looksLikeErrorOrStatusToken(val) {
    const s = String(val || "").trim();
    if (!s) return true;
    const lower = s.toLowerCase();
    if (
        TERMINAL_FAILED_TOKENS.has(lower) ||
        TERMINAL_COMPLETED_TOKENS.has(lower) ||
        ACTIVE_PROCESSING_TOKENS.has(lower) ||
        /^(?:ok|true|false|null|undefined|none|concluded|job_queue_timeout|queue_timeout|job_not_found|not_found|unsupported_model|invalid_arguments|invalid_request|credit_admission_rejected|insufficient_credits|content_policy|model_unavailable|generation_unavailable)$/i.test(s)
    ) {
        return true;
    }
    if (
        !/\d/.test(s) &&
        /(?:^|[_.-])(?:timeout|timed_out|error|failed|failure|rejected|invalid|missing|not_found|unauthorized|forbidden|denied|cancelled|canceled|unknown|exceeded|unavailable|expired|exhausted|blocked|limit|pending|queued|status|state|empty|aborted)(?:$|[_.-])/i.test(s)
    ) {
        return true;
    }
    return false;
}

function findJobIdFromResponse(rawData, rawText = "", projectId = "") {
    const excluded = new Set(CLIENT_ITEM_IDS);
    if (projectId) excluded.add(String(projectId).trim());

    const collectExcluded = obj => {
        if (!obj || typeof obj !== "object" || Array.isArray(obj)) return;
        for (const exKey of [
            "projectId",
            "project_id",
            "assetId",
            "asset_id",
            "outputAssetId",
            "output_asset_id",
            "resultAssetId",
            "result_asset_id",
            "requestKey",
            "request_key",
            "idempotencyKey",
            "idempotency_key",
            "organizationId",
            "orgId",
            "clipId",
            "clip_id",
            "shotId",
            "shot_id",
            "model",
            "workflow",
            "code",
            "errorCode",
            "error_code",
            "error",
            "status",
            "state",
            "reason",
            "field"
        ]) {
            if (typeof obj[exKey] === "string" && obj[exKey].trim()) {
                excluded.add(obj[exKey].trim());
            }
        }
    };

    const isUsable = val => {
        const s = typeof val === "string" ? val.trim() : "";
        return Boolean(
            s &&
            !/\s/.test(s) &&
            !excluded.has(s) &&
            !looksLikeErrorOrStatusToken(s) &&
            !/^https?:\/\//i.test(s) &&
            !/^data:/i.test(s) &&
            !/^(?:projects|\/tmp)\//i.test(s)
        );
    };

    const candidateRoots = [];
    if (rawData && typeof rawData === "object") {
        candidateRoots.push(rawData);
    }
    if (rawText) {
        const parsedFromText = tryParseJsonFromText(rawText);
        if (parsedFromText && typeof parsedFromText === "object" && parsedFromText !== rawData) {
            candidateRoots.push(parsedFromText);
        }
    }

    const idKeys = [
        "jobId",
        "job_id",
        "videoJobId",
        "video_job_id",
        "clipJobId",
        "clip_job_id",
        "taskId",
        "task_id",
        "submissionId",
        "submission_id",
        "operationId",
        "operation_id",
        "executionId",
        "execution_id",
        "generationId",
        "generation_id",
        "runId",
        "run_id",
        "asyncJobId",
        "async_job_id",
        "batchJobId",
        "batch_job_id"
    ];

    const arrayIdKeys = [
        "jobIds",
        "job_ids",
        "taskIds",
        "task_ids",
        "submissionIds",
        "submission_ids",
        "operationIds",
        "operation_ids",
        "executionIds",
        "submittedJobIds",
        "queuedJobIds",
        "createdJobIds"
    ];

    const containerKeys = [
        "jobs",
        "clips",
        "videos",
        "items",
        "results",
        "submissions",
        "tasks",
        "outputs",
        "generations",
        "operations",
        "records",
        "entries",
        "batches"
    ];

    for (const root of candidateRoots) {
        const seen = new WeakSet();
        const queue = [{ node: root, depth: 0 }];

        while (queue.length > 0) {
            const { node, depth } = queue.shift();
            if (!node || typeof node !== "object" || seen.has(node)) continue;
            seen.add(node);

            if (!Array.isArray(node)) {
                collectExcluded(node);

                for (const key of idKeys) {
                    if (isUsable(node[key])) return String(node[key]).trim();
                }

                for (const [dynKey, dynVal] of Object.entries(node)) {
                    if (
                        /(?:job|task|submission|operation|execution|generation|run|video|clip)_?id$/i.test(dynKey) &&
                        !/^(?:clipId|clip_id|shotId|shot_id|projectId|project_id|assetId|asset_id|outputAssetId|output_asset_id)$/i.test(dynKey) &&
                        isUsable(dynVal)
                    ) {
                        return String(dynVal).trim();
                    }
                    if (/(?:job|task|submission|operation|execution|generation|run)_?ids$/i.test(dynKey) && Array.isArray(dynVal)) {
                        for (const el of dynVal) {
                            if (isUsable(el)) return String(el).trim();
                        }
                    }
                }

                if (typeof node.job === "string" && isUsable(node.job)) {
                    return node.job.trim();
                }

                for (const arrKey of arrayIdKeys) {
                    if (Array.isArray(node[arrKey])) {
                        for (const el of node[arrKey]) {
                            if (isUsable(el)) return String(el).trim();
                            if (el && typeof el === "object") {
                                collectExcluded(el);
                                const subId = el.jobId || el.job_id || el.taskId || el.submissionId || el.operationId || el.executionId || el.id;
                                if (isUsable(subId)) return String(subId).trim();
                            }
                        }
                    }
                }

                for (const subKey of ["job", "submission", "task", "operation", "execution", "clip", "video", "result", "generation"]) {
                    const sub = node[subKey];
                    if (sub && typeof sub === "object" && !Array.isArray(sub)) {
                        collectExcluded(sub);
                        const subId = sub.jobId || sub.job_id || sub.taskId || sub.submissionId || sub.operationId || sub.executionId || sub.id;
                        if (isUsable(subId)) return String(subId).trim();
                    }
                }

                for (const listKey of containerKeys) {
                    const container = node[listKey];
                    if (Array.isArray(container)) {
                        for (const item of container) {
                            if (isUsable(item)) return String(item).trim();
                            if (item && typeof item === "object") {
                                collectExcluded(item);
                                const candidate =
                                    item.jobId ||
                                    item.job_id ||
                                    item.taskId ||
                                    item.submissionId ||
                                    item.operationId ||
                                    item.executionId ||
                                    item.id;
                                if (isUsable(candidate)) return String(candidate).trim();
                            }
                        }
                    } else if (container && typeof container === "object") {
                        for (const [mapKey, mapVal] of Object.entries(container)) {
                            if (isUsable(mapVal)) return String(mapVal).trim();
                            if (mapVal && typeof mapVal === "object") {
                                collectExcluded(mapVal);
                                const mvId =
                                    mapVal.jobId ||
                                    mapVal.job_id ||
                                    mapVal.taskId ||
                                    mapVal.submissionId ||
                                    mapVal.operationId ||
                                    mapVal.executionId ||
                                    mapVal.id;
                                if (isUsable(mvId)) return String(mvId).trim();
                                if (isUsable(mapKey)) return mapKey.trim();
                            }
                        }
                    }
                }

                /* Objek job langsung yang hanya memakai field `id` (bukan container assets/uploads) */
                const isPureAssetObj =
                    (Array.isArray(node.assets) || Array.isArray(node.uploads)) &&
                    !Array.isArray(node.jobs) &&
                    !Array.isArray(node.clips);
                const hasJobContext = Boolean(
                    node.status !== undefined ||
                    node.state !== undefined ||
                    node.projectId !== undefined ||
                    node.project_id !== undefined ||
                    node.estimatedCredits !== undefined ||
                    node.reservedCredits !== undefined ||
                    node.outputs !== undefined
                );
                if (!isPureAssetObj && hasJobContext && isUsable(node.id)) {
                    return String(node.id).trim();
                }
            }

            if (depth < 6) {
                const children = Array.isArray(node) ? node : Object.values(node);
                for (const child of children) {
                    if (child && typeof child === "object") {
                        queue.push({ node: child, depth: depth + 1 });
                    }
                }
            }
        }
    }

    const cleanText = String(rawText || "").trim();
    if (cleanText) {
        const kvMatch = /\b(?:jobId|job_id|videoJobId|clipJobId|taskId|task_id|submissionId|operationId|executionId)\s*["']?\s*[:=]\s*["']?([A-Za-z0-9][A-Za-z0-9_.:-]{2,})["']?/i.exec(
            cleanText
        );
        if (kvMatch && isUsable(kvMatch[1])) {
            return kvMatch[1].trim();
        }
        const arrayTextMatch = /\b(?:jobIds|job_ids|taskIds|submissionIds)\s*["']?\s*[:=]\s*\[\s*["']([A-Za-z0-9][A-Za-z0-9_.:-]{2,})["']/i.exec(
            cleanText
        );
        if (arrayTextMatch && isUsable(arrayTextMatch[1])) {
            return arrayTextMatch[1].trim();
        }
        const prefixMatch = /\b((?:job|exec|task|op|sub|genjob|vjob|clipjob)[_-](?=[A-Za-z0-9_-]*\d)[A-Za-z0-9_-]{4,})\b/i.exec(
            cleanText
        );
        if (prefixMatch && isUsable(prefixMatch[1])) {
            return prefixMatch[1].trim();
        }
    }
    return "";
}

function inspectJobOutcome(rawData, rawText = "", targetJobId = "") {
    const parsedSource =
        rawData && typeof rawData === "object"
            ? rawData
            : tryParseJsonFromText(rawText);
    const unwrapped = unwrapEnvelope(parsedSource);
    let focus = unwrapped;

    if (unwrapped && typeof unwrapped === "object") {
        const containerKeys = ["jobs", "clips", "videos", "items", "results", "tasks", "submissions", "outputs", "operations"];
        for (const listKey of containerKeys) {
            const container = unwrapped[listKey];
            if (Array.isArray(container) && container.length > 0) {
                const matched = targetJobId
                    ? container.find(
                        el =>
                            el &&
                            typeof el === "object" &&
                            [el.jobId, el.job_id, el.taskId, el.submissionId, el.operationId, el.executionId, el.id].includes(targetJobId)
                    )
                    : null;
                const firstObj = matched || container.find(el => el && typeof el === "object");
                if (firstObj) {
                    focus = { ...unwrapped, ...firstObj };
                    break;
                }
            } else if (container && typeof container === "object") {
                const entries = Object.entries(container);
                if (entries.length > 0) {
                    const matchedEntry = targetJobId
                        ? entries.find(([k, v]) => {
                            if (k === targetJobId || v === targetJobId) return true;
                            if (v && typeof v === "object") {
                                return [v.jobId, v.job_id, v.taskId, v.id].includes(targetJobId);
                            }
                            return false;
                        })
                        : null;
                    const chosen = matchedEntry || entries[0];
                    if (chosen) {
                        const [, val] = chosen;
                        if (val && typeof val === "object") {
                            focus = { ...unwrapped, ...val };
                        }
                        break;
                    }
                }
            }
        }
    }

    const rawState = String(
        focus?.status ||
        focus?.state ||
        focus?.jobStatus ||
        focus?.job_status ||
        ""
    ).trim();

    const errorObj = focus?.error && typeof focus.error === "object" ? focus.error : null;
    const errorCode = String(
        focus?.errorCode ||
        focus?.error_code ||
        errorObj?.code ||
        (typeof focus?.error === "string" && /^[a-z0-9_.-]+$/i.test(focus.error.trim()) ? focus.error.trim() : "") ||
        (TERMINAL_FAILED_TOKENS.has(rawState.toLowerCase()) ? focus?.code || rawState : "") ||
        (focus?.code && /timeout|error|failed|rejected|invalid|unavailable|not_found/i.test(String(focus.code)) ? focus.code : "") ||
        ""
    ).trim();

    const rawErrorMessage = String(
        focus?.errorMessage ||
        focus?.error_message ||
        errorObj?.message ||
        (typeof focus?.error === "string" ? focus.error : "") ||
        (TERMINAL_FAILED_TOKENS.has(rawState.toLowerCase()) || errorCode ? focus?.message || focus?.reason || rawText : "") ||
        ""
    ).trim();

    let status = normalizeStatus(rawState);
    if (
        (focus?.ok === false || focus?.success === false || focus?.rejected === true || errorCode) &&
        status !== "COMPLETED"
    ) {
        status = "FAILED";
    }

    let videoUrls = [];
    if (status !== "FAILED") {
        /*
         * Jika job merujuk outputAssetId di sibling `assets`, prioritaskan aset output tersebut
         * terlebih dahulu agar tidak salah mengambil aset referensi input.
         */
        const targetOutputAssetId = String(
            focus?.outputAssetId ||
            focus?.output_asset_id ||
            focus?.resultAssetId ||
            focus?.result_asset_id ||
            ""
        ).trim();

        if (targetOutputAssetId && Array.isArray(unwrapped?.assets)) {
            const matchedAsset = unwrapped.assets.find(
                a => a && typeof a === "object" && (a.assetId === targetOutputAssetId || a.id === targetOutputAssetId)
            );
            if (matchedAsset) {
                videoUrls = extractVideoUrls(matchedAsset);
            }
        }

        if (videoUrls.length === 0) {
            /* Filter sibling assets agar aset input/reference tidak ikut diekstrak */
            let sanitizedSource = focus || parsedSource;
            if (sanitizedSource && typeof sanitizedSource === "object" && Array.isArray(sanitizedSource.assets)) {
                const filteredAssets = sanitizedSource.assets.filter(a => {
                    if (!a || typeof a !== "object") return true;
                    const role = String(a.role || a.kind || "").toLowerCase();
                    if (/^(?:reference|first_frame|last_frame|input|subject|style)$/.test(role)) {
                        return false;
                    }
                    return true;
                });
                sanitizedSource = { ...sanitizedSource, assets: filteredAssets };
            }
            videoUrls = extractVideoUrls(sanitizedSource);
        }
    }

    if (videoUrls.length > 0 && status !== "FAILED") {
        status = "COMPLETED";
    }

    const usageSeconds = extractUsageSeconds(focus || parsedSource);

    return {
        status,
        rawState: rawState || status.toLowerCase(),
        videoUrls,
        usageSeconds,
        errorCode: status === "FAILED" ? (errorCode || "OPUS_TASK_FAILED") : null,
        errorMessage: status === "FAILED" ? translateOpusError(errorCode, rawErrorMessage) : null
    };
}

function isTransientNotFoundError(code, message = "", rawText = "") {
    return /\b(?:job_not_found|task_not_found|not_found)\b/i.test(
        `${code || ""} ${message || ""} ${rawText || ""}`
    );
}

function isQueueTimeoutError(code, message = "", rawText = "") {
    return /\b(?:job_queue_timeout|queue_timeout)\b/i.test(
        `${code || ""} ${message || ""} ${rawText || ""}`
    );
}

function buildListJobsArgs(listJobsTool, projectId) {
    const rootSchema = listJobsTool?.inputSchema;
    const objSchema = resolveObjectSchema(rootSchema, rootSchema);
    const props = objSchema.properties;
    const args = {};

    const projKey = pickSupportedKey(
        props,
        ["projectId", "project_id", "project"],
        !props ? "projectId" : ""
    );
    if (projKey && projectId) {
        args[projKey] = projectId;
    }

    const limitKey = pickSupportedKey(
        props,
        ["limit", "pageSize", "page_size", "maxResults", "max_results"],
        ""
    );
    if (limitKey) {
        const maxLimit = typeof props?.[limitKey]?.maximum === "number" ? props[limitKey].maximum : 10;
        args[limitKey] = Math.max(1, Math.min(10, maxLimit));
    }

    return args;
}

function buildResolveJobArgs(resolveTool, projectId, jobId) {
    const rootSchema = resolveTool?.inputSchema;
    const objSchema = resolveObjectSchema(rootSchema, rootSchema);
    const props = objSchema.properties;
    const args = {};

    const projKey = pickSupportedKey(
        props,
        ["projectId", "project_id"],
        projectId && !props ? "projectId" : ""
    );
    if (projKey && projectId) {
        args[projKey] = projectId;
    }

    const jobKey = pickSupportedKey(
        props,
        ["jobId", "job_id", "taskId", "id"],
        !props ? "jobId" : ""
    );
    if (jobKey && jobId) {
        args[jobKey] = jobId;
    }

    return args;
}

async function discoverProjectVideoJob(
    session,
    projectId,
    { targetJobId = "", retries = 1, retryDelayMs = 350 } = {}
) {
    if (!projectId) {
        return { jobId: "", outcome: null, projectConfirmedEmpty: false };
    }

    let projectConfirmedEmpty = false;
    const listJobsTool = findMcpTool(session.tools, "list_jobs");

    if (listJobsTool) {
        const maxAttempts = Math.max(1, Number(retries) + 1);
        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
            if (attempt > 0 && retryDelayMs > 0) {
                await sleep(retryDelayMs);
            }
            const listRes = await session
                .callTool(listJobsTool.name, buildListJobsArgs(listJobsTool, projectId))
                .catch(() => null);
            if (!listRes || listRes.isError) {
                break;
            }
            const foundJobId =
                (targetJobId && findJobIdFromResponse(listRes.data, listRes.text, projectId) ? targetJobId : "") ||
                findJobIdFromResponse(listRes.data, listRes.text, projectId);
            const outcome = inspectJobOutcome(listRes.data, listRes.text, targetJobId || foundJobId);

            if (foundJobId || outcome.videoUrls.length > 0 || (outcome.status === "FAILED" && !isTransientNotFoundError(outcome.errorCode, outcome.errorMessage, listRes.text))) {
                return {
                    jobId: foundJobId || targetJobId || "",
                    outcome,
                    projectConfirmedEmpty: false
                };
            }

            const unwrapped = unwrapEnvelope(listRes.data);
            if (
                unwrapped &&
                typeof unwrapped === "object" &&
                (
                    (Array.isArray(unwrapped.jobs) && unwrapped.jobs.length === 0) ||
                    (Array.isArray(unwrapped.items) && unwrapped.items.length === 0) ||
                    (Array.isArray(unwrapped.clips) && unwrapped.clips.length === 0)
                )
            ) {
                projectConfirmedEmpty = true;
            }
        }
    }

    /* Probe get_status berbasis projectId jika skema tidak mewajibkan jobId eksplisit */
    const statusTool =
        findMcpTool(session.tools, "get_status") ||
        findMcpTool(session.tools, "opusclip_get_job") ||
        findMcpTool(session.tools, "get_job");

    if (statusTool) {
        const rootSchema = statusTool.inputSchema;
        const objSchema = resolveObjectSchema(rootSchema, rootSchema);
        const props = objSchema.properties;
        const required = Array.isArray(objSchema.required) ? objSchema.required : [];
        const requiresExplicitJob = required.some(k => /^(?:jobId|job_id|jobIds|job_ids|taskId|taskIds|id|ids)$/i.test(k));
        const projKey = pickSupportedKey(props, ["projectId", "project_id"], !props ? "projectId" : "");

        if (!requiresExplicitJob && projKey) {
            const probeArgs = { [projKey]: projectId };
            const watchKey = pickSupportedKey(props, ["watch", "wait", "block"], "");
            if (watchKey && schemaTypeIncludes(props?.[watchKey], rootSchema, "boolean")) {
                probeArgs[watchKey] = false;
            }
            const probeRes = await session.callTool(statusTool.name, probeArgs).catch(() => null);
            if (probeRes && !probeRes.isError) {
                const probedJobId = findJobIdFromResponse(probeRes.data, probeRes.text, projectId);
                const outcome = inspectJobOutcome(probeRes.data, probeRes.text, targetJobId || probedJobId);
                if (probedJobId || outcome.videoUrls.length > 0) {
                    return {
                        jobId: probedJobId || targetJobId || "",
                        outcome,
                        projectConfirmedEmpty: false
                    };
                }
            }
        }
    }

    return { jobId: "", outcome: null, projectConfirmedEmpty };
}

/* =========================================================
   PUBLIC CLIENT API: createVideoTask & getVideoTask
========================================================= */

async function createVideoTask(payload = {}, apiKey, options = {}) {
    const endpoint = getMcpEndpoint(options);
    const session = await openMcpSession({
        endpoint,
        apiKey,
        timeoutMs: CREATE_TIMEOUT_MS,
        includeTools: true
    });

    const videoTool =
        findMcpTool(session.tools, "generate_video_clips") ||
        findMcpTool(session.tools, "opusclip_create_video_job") ||
        findMcpTool(session.tools, "create_video_job");

    if (!videoTool) {
        throw createProviderError({
            message: "Tool generate_video_clips tidak tersedia pada endpoint MCP Opus Labs ini.",
            code: "TOOL_UNAVAILABLE",
            providerCode: "generation_unavailable",
            status: 502
        });
    }

    const projectId = await ensureProjectId(session);
    const importTool = findMcpTool(session.tools, "import_assets");

    const firstFrameUrl = String(payload.first_frame_url || payload.image_url || "").trim();
    const lastFrameUrl = String(payload.last_frame_url || "").trim();
    const referenceUrls = Array.isArray(payload.reference_image_urls)
        ? payload.reference_image_urls.map(u => String(u || "").trim()).filter(Boolean).slice(0, MAX_REFERENCE_IMAGES)
        : [];

    let stagedFirstFrame = null;
    let stagedLastFrame = null;
    const stagedReferences = [];

    if (firstFrameUrl) {
        const mime = inferImageMimeFromUrl(firstFrameUrl);
        stagedFirstFrame = await stageSingleReferenceImage(
            session,
            importTool,
            projectId,
            {
                url: firstFrameUrl,
                role: "first_frame",
                label: "first_frame",
                mimeType: mime,
                fileName: `first-frame.${extFromMime(mime)}`
            },
            0
        );
        if (lastFrameUrl) {
            const lastMime = inferImageMimeFromUrl(lastFrameUrl);
            stagedLastFrame = await stageSingleReferenceImage(
                session,
                importTool,
                projectId,
                {
                    url: lastFrameUrl,
                    role: "last_frame",
                    label: "last_frame",
                    mimeType: lastMime,
                    fileName: `last-frame.${extFromMime(lastMime)}`
                },
                1
            );
        }
    } else if (referenceUrls.length > 0) {
        for (let i = 0; i < referenceUrls.length; i += 1) {
            const url = referenceUrls[i];
            const mime = inferImageMimeFromUrl(url);
            const staged = await stageSingleReferenceImage(
                session,
                importTool,
                projectId,
                {
                    url,
                    role: "reference",
                    label: `image${i + 1}`,
                    mimeType: mime,
                    fileName: `reference-${i + 1}.${extFromMime(mime)}`
                },
                i
            );
            stagedReferences.push(staged);
        }
    }

    const workflow = stagedFirstFrame
        ? "first_last_frame"
        : (payload.workflow || "reference2video");

    const argVariants = buildGenerateVideoClipVariants(videoTool, {
        prompt: String(payload.prompt || "").trim(),
        opusModel: String(payload.model || "").trim(),
        modelAliases: Array.isArray(payload.model_aliases) ? payload.model_aliases : [],
        workflow,
        durationSeconds: Number(payload.duration),
        resolution: String(payload.resolution || "").trim(),
        aspectRatio: String(payload.aspect_ratio || "").trim(),
        generateAudio: typeof payload.generate_audio === "boolean" ? payload.generate_audio : undefined,
        stagedFirstFrame,
        stagedLastFrame,
        stagedReferences,
        projectId
    });

    let lastCallResult = null;
    let lastError = null;
    let discoveredDuringTimeout = null;

    for (let idx = 0; idx < argVariants.length; idx += 1) {
        let variantAccepted = false;
        for (let sameKeyAttempt = 0; sameKeyAttempt < 2; sameKeyAttempt += 1) {
            try {
                const callRes = await session.callTool(videoTool.name, argVariants[idx]);
                lastCallResult = callRes;

                const tempOutcome = inspectJobOutcome(callRes.data, callRes.text);
                if (
                    isQueueTimeoutError(
                        tempOutcome.errorCode,
                        tempOutcome.errorMessage,
                        callRes.text
                    )
                ) {
                    /*
                     * Pada job_queue_timeout:
                     * 1) Cek list_jobs proyek terlebih dahulu (job bisa saja sudah masuk antrian).
                     * 2) Jika proyek masih kosong, ulangi 1x dengan requestKey UUID yang SAMA PERSIS.
                     */
                    if (projectId) {
                        const checked = await discoverProjectVideoJob(session, projectId, {
                            retries: 0
                        });
                        if (checked.jobId || checked.outcome?.videoUrls?.length > 0) {
                            discoveredDuringTimeout = checked;
                            variantAccepted = true;
                            break;
                        }
                    }
                    if (sameKeyAttempt === 0) {
                        await sleep(400);
                        continue;
                    }
                }

                const isValidationFailure =
                    (callRes.isError || tempOutcome.status === "FAILED") &&
                    /invalid_request|invalid_arguments|unsupported_model|validation|unrecognized|unexpected|additional propert/i.test(
                        `${tempOutcome.errorCode || ""} ${tempOutcome.errorMessage || ""} ${callRes.text || ""}`
                    );

                /* Jangan pernah retry otomatis pada submission_unknown atau credit_admission_rejected */
                if (isValidationFailure && idx + 1 < argVariants.length) {
                    break;
                }
                variantAccepted = true;
                break;
            } catch (err) {
                lastError = err;
                const retryableSchemaErr =
                    (err?.status === 422 || /invalid_request|invalid_arguments|-32602|unrecognized/i.test(String(err?.code || ""))) &&
                    idx + 1 < argVariants.length;
                if (retryableSchemaErr) {
                    break;
                }
                throw err;
            }
        }
        if (variantAccepted) {
            break;
        }
    }

    if (discoveredDuringTimeout) {
        if (discoveredDuringTimeout.outcome?.videoUrls?.length > 0 && !discoveredDuringTimeout.jobId) {
            const inlineTaskId = `opus-inline:${makeUuid()}`;
            inlineCompletedResults.set(inlineTaskId, {
                videoUrls: discoveredDuringTimeout.outcome.videoUrls,
                usageSeconds: discoveredDuringTimeout.outcome.usageSeconds,
                createdAtMs: Date.now()
            });
            return {
                success: true,
                provider: PROVIDER_ID,
                providerName: PROVIDER_NAME,
                taskId: inlineTaskId,
                task_id: inlineTaskId,
                jobId: inlineTaskId,
                projectId,
                status: "COMPLETED",
                outputUrls: discoveredDuringTimeout.outcome.videoUrls
            };
        }
        if (discoveredDuringTimeout.jobId) {
            const compositeTaskId = encodeOpusTaskId(projectId, discoveredDuringTimeout.jobId);
            return {
                success: true,
                provider: PROVIDER_ID,
                providerName: PROVIDER_NAME,
                taskId: compositeTaskId,
                task_id: compositeTaskId,
                jobId: discoveredDuringTimeout.jobId,
                projectId,
                status: discoveredDuringTimeout.outcome?.status === "COMPLETED" ? "COMPLETED" : "QUEUED",
                outputUrls: discoveredDuringTimeout.outcome?.videoUrls || []
            };
        }
    }

    if (!lastCallResult) {
        throw lastError || createProviderError({
            message: "Gagal mengirim permintaan video ke Opus Labs.",
            code: "CREATE_TASK_FAILED",
            status: 502
        });
    }

    let outcome = inspectJobOutcome(lastCallResult.data, lastCallResult.text);
    if (lastCallResult.isError || outcome.status === "FAILED") {
        throw createProviderError({
            message: outcome.errorMessage || translateOpusError(outcome.errorCode, lastCallResult.text),
            code: outcome.errorCode || "OPUS_CREATE_REJECTED",
            providerCode: outcome.errorCode || "create_rejected",
            status: outcome.errorCode === "credit_admission_rejected" ? 402 : 422,
            raw: lastCallResult.data
        });
    }

    let jobId = findJobIdFromResponse(lastCallResult.data, lastCallResult.text, projectId);

    /*
     * Fallback resmi MCP Opus Labs v2:
     * Saat generate_video_clips sukses mengantrekan job di dalam projectId
     * tanpa menyertakan jobId inline (mis. hanya mengembalikan items:[{id:"clip-1", ok:true, status:"queued"}]),
     * ambil jobId aktual melalui list_jobs / get_status proyek.
     */
    if (!jobId && outcome.videoUrls.length === 0 && projectId) {
        const discovered = await discoverProjectVideoJob(session, projectId, {
            retries: 2,
            retryDelayMs: 350
        });
        if (discovered.outcome?.status === "FAILED") {
            throw createProviderError({
                message: discovered.outcome.errorMessage || "Job video Opus Labs gagal saat masuk antrian.",
                code: discovered.outcome.errorCode || "OPUS_CREATE_REJECTED",
                providerCode: discovered.outcome.errorCode || "create_rejected",
                status: 422,
                raw: lastCallResult.data
            });
        }
        if (discovered.jobId) {
            jobId = discovered.jobId;
        }
        if (discovered.outcome?.videoUrls?.length > 0) {
            outcome = discovered.outcome;
        }
    }

    if (jobId) {
        const compositeTaskId = encodeOpusTaskId(projectId, jobId);
        return {
            success: true,
            provider: PROVIDER_ID,
            providerName: PROVIDER_NAME,
            taskId: compositeTaskId,
            task_id: compositeTaskId,
            jobId,
            projectId,
            status: outcome.status === "COMPLETED" ? "COMPLETED" : "QUEUED",
            outputUrls: outcome.videoUrls
        };
    }

    /* Jika server langsung mengembalikan URL video jadi tanpa jobId async */
    if (outcome.videoUrls.length > 0) {
        const inlineTaskId = `opus-inline:${makeUuid()}`;
        inlineCompletedResults.set(inlineTaskId, {
            videoUrls: outcome.videoUrls,
            usageSeconds: outcome.usageSeconds,
            createdAtMs: Date.now()
        });
        return {
            success: true,
            provider: PROVIDER_ID,
            providerName: PROVIDER_NAME,
            taskId: inlineTaskId,
            task_id: inlineTaskId,
            jobId: inlineTaskId,
            projectId,
            status: "COMPLETED",
            outputUrls: outcome.videoUrls
        };
    }

    /*
     * Jika generate_video_clips sudah sukses diterima di bawah projectId unik
     * namun jobId baru muncul beberapa detik kemudian di list_jobs (eventual consistency),
     * kembalikan taskId berbasis proyek agar /api/generate-status terus memantau proyek tersebut
     * alih-alih menggagalkan task padahal video sedang digenerate di web Opus.
     */
    if (projectId) {
        const pendingProjectTaskId = encodeOpusTaskId(projectId, PROJECT_PENDING_JOB_ID);
        return {
            success: true,
            provider: PROVIDER_ID,
            providerName: PROVIDER_NAME,
            taskId: pendingProjectTaskId,
            task_id: pendingProjectTaskId,
            jobId: PROJECT_PENDING_JOB_ID,
            projectId,
            status: "QUEUED",
            outputUrls: []
        };
    }

    throw createProviderError({
        message: "Opus Labs tidak mengembalikan jobId video yang valid.",
        code: "MISSING_TASK_ID",
        status: 502,
        raw: lastCallResult.data
    });
}

async function getVideoTask(taskId, apiKey, options = {}) {
    const parsedId = parseOpusTaskId(taskId);
    if (!parsedId.jobId) {
        throw createProviderError({
            message: "Task ID Opus tidak ditemukan.",
            code: "TASK_ID_MISSING",
            status: 400
        });
    }

    /* Bersihkan cache inline lama & kembalikan hasil bila inline */
    for (const [key, entry] of inlineCompletedResults.entries()) {
        if (Date.now() - entry.createdAtMs > COMPLETED_INLINE_CACHE_TTL_MS) {
            inlineCompletedResults.delete(key);
        }
    }
    if (parsedId.isInlineDone && inlineCompletedResults.has(parsedId.jobId)) {
        const cached = inlineCompletedResults.get(parsedId.jobId);
        return {
            status: "COMPLETED",
            providerState: "completed",
            videoUrls: cached.videoUrls,
            usageSeconds: cached.usageSeconds,
            errorCode: null,
            errorMessage: null,
            projectId: "",
            jobId: parsedId.jobId
        };
    }

    const endpoint = getMcpEndpoint(options);
    const session = await openMcpSession({
        endpoint,
        apiKey,
        timeoutMs: QUERY_TIMEOUT_MS,
        includeTools: true
    });

    let activeJobId = parsedId.jobId;

    /*
     * Jika saat createVideoTask job baru didaftarkan pada projectId dan jobId-nya
     * belum muncul di respons pertama, cari jobId aktual lewat list_jobs / get_status proyek.
     */
    if (parsedId.isProjectPending) {
        const discovered = await discoverProjectVideoJob(session, parsedId.projectId, {
            retries: 0
        });
        if (discovered.outcome?.status === "FAILED") {
            return {
                status: "FAILED",
                providerState: discovered.outcome.rawState || "failed",
                videoUrls: [],
                usageSeconds: null,
                errorCode: discovered.outcome.errorCode || "OPUS_STATUS_FAILED",
                errorMessage: discovered.outcome.errorMessage || "Job video Opus Labs gagal.",
                projectId: parsedId.projectId,
                jobId: discovered.jobId || parsedId.projectId
            };
        }
        if (discovered.outcome?.videoUrls?.length > 0) {
            return {
                status: "COMPLETED",
                providerState: "completed",
                videoUrls: discovered.outcome.videoUrls,
                usageSeconds: discovered.outcome.usageSeconds,
                errorCode: null,
                errorMessage: null,
                projectId: parsedId.projectId,
                jobId: discovered.jobId || parsedId.projectId
            };
        }
        if (!discovered.jobId) {
            return {
                status: "QUEUED",
                providerState: "queued",
                videoUrls: [],
                usageSeconds: null,
                errorCode: null,
                errorMessage: null,
                projectId: parsedId.projectId,
                jobId: parsedId.projectId
            };
        }
        activeJobId = discovered.jobId;
    }

    const statusTool =
        findMcpTool(session.tools, "get_status") ||
        findMcpTool(session.tools, "opusclip_get_job") ||
        findMcpTool(session.tools, "get_job");

    if (!statusTool) {
        throw createProviderError({
            message: "Tool get_status tidak tersedia pada endpoint MCP Opus Labs.",
            code: "STATUS_TOOL_UNAVAILABLE",
            status: 502
        });
    }

    const rootSchema = statusTool.inputSchema;
    const objSchema = resolveObjectSchema(rootSchema, rootSchema);
    const props = objSchema.properties;
    const args = {};

    const jobSingleKey = pickSupportedKey(
        props,
        ["jobId", "job_id", "taskId", "task_id", "submissionId", "id"],
        ""
    );
    const jobArrayKey = pickSupportedKey(
        props,
        ["jobIds", "job_ids", "taskIds", "ids"],
        ""
    );

    if (jobSingleKey) {
        args[jobSingleKey] = activeJobId;
    } else if (jobArrayKey) {
        args[jobArrayKey] = [activeJobId];
    } else if (!props) {
        args.jobId = activeJobId;
    }

    const projKey = pickSupportedKey(
        props,
        ["projectId", "project_id"],
        parsedId.projectId && !props ? "projectId" : ""
    );
    if (projKey && parsedId.projectId) {
        args[projKey] = parsedId.projectId;
    }

    /* Non-blocking status check: watch = false menjaga CPU & durasi HTTP Worker sangat ringan */
    const watchKey = pickSupportedKey(props, ["watch", "wait", "block"], "");
    if (watchKey && schemaTypeIncludes(props?.[watchKey], rootSchema, "boolean")) {
        args[watchKey] = false;
    }

    const statusRes = await session.callTool(statusTool.name, args);
    let outcome = inspectJobOutcome(statusRes.data, statusRes.text, activeJobId);

    /*
     * Toleransi eventual consistency: sesaat setelah submit, get_status kadang
     * mengembalikan job_not_found sebelum indeks proyek sinkron. Cek list_jobs,
     * dan bila belum muncul tetap laporkan QUEUED agar polling tidak putus prematur.
     */
    if (
        (statusRes.isError || outcome.status === "FAILED") &&
        isTransientNotFoundError(outcome.errorCode, outcome.errorMessage, statusRes.text)
    ) {
        if (parsedId.projectId) {
            const listed = await discoverProjectVideoJob(session, parsedId.projectId, {
                targetJobId: activeJobId,
                retries: 0
            });
            if (listed.outcome) {
                outcome = listed.outcome;
                if (listed.jobId) activeJobId = listed.jobId;
            } else {
                return {
                    status: "QUEUED",
                    providerState: "queued",
                    videoUrls: [],
                    usageSeconds: null,
                    errorCode: null,
                    errorMessage: null,
                    projectId: parsedId.projectId,
                    jobId: activeJobId
                };
            }
        }
    } else if (statusRes.isError && outcome.status !== "COMPLETED") {
        if (parsedId.projectId) {
            const listed = await discoverProjectVideoJob(session, parsedId.projectId, {
                targetJobId: activeJobId,
                retries: 0
            });
            if (listed.outcome && listed.outcome.status !== "FAILED") {
                outcome = listed.outcome;
                if (listed.jobId) activeJobId = listed.jobId;
            } else {
                return {
                    status: "FAILED",
                    providerState: outcome.rawState || "failed",
                    videoUrls: [],
                    usageSeconds: null,
                    errorCode: outcome.errorCode || "OPUS_STATUS_FAILED",
                    errorMessage: outcome.errorMessage || translateOpusError(outcome.errorCode, statusRes.text),
                    projectId: parsedId.projectId,
                    jobId: activeJobId
                };
            }
        } else {
            return {
                status: "FAILED",
                providerState: outcome.rawState || "failed",
                videoUrls: [],
                usageSeconds: null,
                errorCode: outcome.errorCode || "OPUS_STATUS_FAILED",
                errorMessage: outcome.errorMessage || translateOpusError(outcome.errorCode, statusRes.text),
                projectId: parsedId.projectId,
                jobId: activeJobId
            };
        }
    }

    /*
     * Jika status job sudah COMPLETED namun URL video belum ada di respons get_status
     * (mis. URL unduhan diekspos lewat resolve_job atau sibling assets di list_jobs),
     * panggil resolve_job lalu list_jobs untuk mengambil URL video finalnya.
     */
    if (outcome.status === "COMPLETED" && outcome.videoUrls.length === 0) {
        const resolveTool = findMcpTool(session.tools, "resolve_job");
        if (resolveTool) {
            const resolvedRes = await session
                .callTool(
                    resolveTool.name,
                    buildResolveJobArgs(resolveTool, parsedId.projectId, activeJobId)
                )
                .catch(() => null);
            if (resolvedRes && !resolvedRes.isError) {
                const resolvedOutcome = inspectJobOutcome(resolvedRes.data, resolvedRes.text, activeJobId);
                if (resolvedOutcome.videoUrls.length > 0) {
                    outcome = {
                        ...outcome,
                        videoUrls: resolvedOutcome.videoUrls,
                        usageSeconds: outcome.usageSeconds || resolvedOutcome.usageSeconds
                    };
                }
            }
        }

        if (outcome.videoUrls.length === 0 && parsedId.projectId) {
            const listed = await discoverProjectVideoJob(session, parsedId.projectId, {
                targetJobId: activeJobId,
                retries: 0
            });
            if (listed.outcome?.videoUrls?.length > 0) {
                outcome = {
                    ...outcome,
                    videoUrls: listed.outcome.videoUrls,
                    usageSeconds: outcome.usageSeconds || listed.outcome.usageSeconds
                };
            }
        }

        /*
         * Jangan laporkan providerState = "completed" dengan videoUrls kosong ke
         * api/generate-status.js (karena normalizeProviderResult akan menandainya selesai tanpa video).
         * Kembalikan PROCESSING ("finalizing") agar siklus polling berikutnya mengambil URL final.
         */
        if (outcome.videoUrls.length === 0) {
            return {
                status: "PROCESSING",
                providerState: "processing",
                videoUrls: [],
                usageSeconds: outcome.usageSeconds,
                errorCode: null,
                errorMessage: null,
                projectId: parsedId.projectId,
                jobId: activeJobId
            };
        }
    }

    const safeProviderState =
        outcome.status === "COMPLETED"
            ? "completed"
            : outcome.status === "FAILED"
                ? (outcome.rawState && TERMINAL_FAILED_TOKENS.has(outcome.rawState.toLowerCase()) ? outcome.rawState : "failed")
                : outcome.status === "QUEUED"
                    ? "queued"
                    : "processing";

    return {
        status: outcome.status,
        providerState: safeProviderState,
        videoUrls: outcome.videoUrls,
        usageSeconds: outcome.usageSeconds,
        errorCode: outcome.errorCode,
        errorMessage: outcome.errorMessage,
        projectId: parsedId.projectId,
        jobId: activeJobId
    };
}

export {
    DEFAULT_MCP_URL,
    DEFAULT_OPUS_WORKOS_CLIENT_ID,
    MAX_REFERENCE_IMAGES,
    PROVIDER_ID,
    PROVIDER_NAME,
    createVideoTask,
    encodeOpusTaskId,
    extractVideoUrls,
    getMcpEndpoint,
    getVideoTask,
    normalizeStatus,
    parseOpusTaskId,
    redactSecrets,
    resolveBearerToken,
    translateOpusError
};

export default {
    PROVIDER_ID,
    PROVIDER_NAME,
    DEFAULT_MCP_URL,
    createVideoTask,
    getVideoTask,
    encodeOpusTaskId,
    parseOpusTaskId,
    normalizeStatus,
    translateOpusError
};
