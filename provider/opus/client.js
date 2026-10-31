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

import {
    inspectReferenceMediaUrl,
    isNonMediaHttpPayload
} from "../../assets/js/media-url-guard.js";
import {
    clearOpusMemoryTokenVault,
    resolveOpusOAuthTokenWithVault
} from "./oauth-vault.js";

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
const MAX_IMAGE_REFERENCE_IMAGES = 8;
const MAX_REFERENCE_VIDEOS = 3;
const MAX_REFERENCE_AUDIOS = 3;

const CLIENT_ITEM_IDS = new Set([
    "clip-1",
    "video-1",
    "shot-1",
    "item-1",
    "task-1",
    "kf-1",
    "first_frame",
    "last_frame",
    "character",
    "outfit",
    "image1",
    "image2",
    "image3",
    "image4",
    "image5",
    "image6",
    "image7",
    "image8",
    "video1",
    "video2",
    "video3",
    "audio1",
    "audio2",
    "audio3"
]);

const PROJECT_PENDING_JOB_ID = "__project_pending__";

function sleep(ms) {
    const delay = Math.max(0, Number(ms) || 0);
    if (!delay) return Promise.resolve();
    return new Promise(resolve => setTimeout(resolve, delay));
}

/* Cache ringan di memori untuk menekan subrequest berulang di Worker */
const oauthStateByFingerprint = new Map();
const MAX_OPUS_ENV_KEY_SLOTS = 20;

let activeOpusKeyIndex = 0;

let cachedToolsState = {
    endpoint: "",
    tools: null,
    fetchedAtMs: 0
};

const inlineCompletedResults = new Map();

function getActiveOpusKeyIndex() {
    return activeOpusKeyIndex;
}

function resetOpusKeyRotation() {
    activeOpusKeyIndex = 0;
    oauthStateByFingerprint.clear();
    clearOpusMemoryTokenVault();
}

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

function unwrapOuterQuotesText(raw) {
    const text = String(raw || "").trim();
    if (
        (text.startsWith("\"") && text.endsWith("\"")) ||
        (text.startsWith("'") && text.endsWith("'"))
    ) {
        try {
            const parsed = JSON.parse(text);
            if (typeof parsed === "string") return parsed.trim();
        } catch {
            return text.slice(1, -1).trim();
        }
    }
    return text;
}

const OPUS_ENV_KEY_STEMS = [
    "OPUS_AUTH_TOKEN",
    "OPUS_ACCESS_TOKEN",
    "OPUSCLIP_API_KEY",
    "OPUS_API_KEY",
    "OPUS_TOKEN",
    "OPUS_KEY",
    "OPUS_SECRET"
];

const DYNAMIC_OPUS_ENV_SLOT_PATTERN =
    /^opus(?:clip)?[-_]*(?:auth[-_]*token|access[-_]*token|api[-_]*key|account|secret|token|key)[-_]*(\d+)$/i;

function parseExpiresAtTimestampMs(value) {
    if (value === null || value === undefined || value === "") return 0;
    if (typeof value === "number" && Number.isFinite(value)) {
        return value > 1e12 ? value : value * 1000;
    }
    const text = String(value).trim();
    if (/^\d+(\.\d+)?$/.test(text)) {
        const numeric = Number(text);
        return numeric > 1e12 ? numeric : numeric * 1000;
    }
    const parsed = Date.parse(text);
    return Number.isFinite(parsed) ? parsed : 0;
}

function collectEnvCredentialsBySuffix(targetList, envObj, suffix = "") {
    const env = envObj && typeof envObj === "object" ? envObj : {};
    const defaultTokenEndpoint = String(env.OPUS_OAUTH_TOKEN_URL || DEFAULT_OAUTH_TOKEN_URL).trim();
    const slotRefresh = String(env[`OPUS_REFRESH_TOKEN${suffix}`] || "").trim();
    const slotClientId = String(
        env[`OPUS_CLIENT_ID${suffix}`] ||
        env.OPUS_CLIENT_ID ||
        DEFAULT_OPUS_WORKOS_CLIENT_ID
    ).trim();
    const slotClientSecret = String(
        env[`OPUS_CLIENT_SECRET${suffix}`] ||
        env.OPUS_CLIENT_SECRET ||
        ""
    ).trim();
    const slotResource = String(
        env[`OPUS_RESOURCE_URL${suffix}`] ||
        env.OPUS_RESOURCE_URL ||
        ""
    ).trim();

    const formatWithRefresh = (rawAuth, attachRefresh) => {
        if (!rawAuth && !attachRefresh) return "";
        if (rawAuth && (rawAuth.startsWith("[") || rawAuth.includes("\n") || rawAuth.startsWith("{"))) {
            return rawAuth;
        }
        if (attachRefresh && slotRefresh) {
            return JSON.stringify({
                ...(rawAuth ? { access_token: rawAuth.replace(/^Bearer\s+/i, "").trim() } : {}),
                refresh_token: slotRefresh,
                client_id: slotClientId || DEFAULT_OPUS_WORKOS_CLIENT_ID,
                ...(slotClientSecret ? { client_secret: slotClientSecret } : {}),
                ...(slotResource ? { resource: slotResource } : {}),
                token_endpoint: defaultTokenEndpoint
            });
        }
        return rawAuth;
    };

    let refreshUsed = false;
    for (const stem of OPUS_ENV_KEY_STEMS) {
        const rawAuth = unwrapOuterQuotesText(env[`${stem}${suffix}`] || "");
        if (!rawAuth) continue;
        const formatted = formatWithRefresh(rawAuth, !refreshUsed);
        refreshUsed = true;
        if (formatted) {
            appendExpandedKeyEntries(targetList, formatted);
        }
    }

    if (!refreshUsed && slotRefresh) {
        const refreshOnly = formatWithRefresh("", true);
        if (refreshOnly) {
            appendExpandedKeyEntries(targetList, refreshOnly);
        }
    }
}

function appendExpandedKeyEntries(targetList, rawCandidate) {
    if (rawCandidate === null || rawCandidate === undefined) return;

    if (Array.isArray(rawCandidate)) {
        for (const item of rawCandidate) {
            appendExpandedKeyEntries(targetList, item);
        }
        return;
    }

    if (typeof rawCandidate === "object") {
        if (Array.isArray(rawCandidate.opus_key_pool)) {
            appendExpandedKeyEntries(targetList, rawCandidate.opus_key_pool);
            return;
        }
        if (Array.isArray(rawCandidate.keys)) {
            appendExpandedKeyEntries(targetList, rawCandidate.keys);
            return;
        }
        const serialized = JSON.stringify(rawCandidate);
        if (serialized && serialized !== "{}") {
            targetList.push(serialized);
        }
        return;
    }

    const cleaned = unwrapOuterQuotesText(rawCandidate);
    if (!cleaned) return;

    if (cleaned.startsWith("[") && cleaned.endsWith("]")) {
        try {
            const parsedArr = JSON.parse(cleaned);
            if (Array.isArray(parsedArr)) {
                appendExpandedKeyEntries(targetList, parsedArr);
                return;
            }
        } catch {
            /* lanjut evaluasi baris */
        }
    }

    if (cleaned.startsWith("{") && cleaned.endsWith("}")) {
        try {
            const parsedObj = JSON.parse(cleaned);
            if (parsedObj && typeof parsedObj === "object") {
                if (Array.isArray(parsedObj.opus_key_pool)) {
                    appendExpandedKeyEntries(targetList, parsedObj.opus_key_pool);
                    return;
                }
                if (Array.isArray(parsedObj.keys)) {
                    appendExpandedKeyEntries(targetList, parsedObj.keys);
                    return;
                }
                targetList.push(JSON.stringify(parsedObj));
                return;
            }
        } catch {
            /* Bukan 1 objek JSON tunggal — bisa berupa beberapa JSON per baris (JSONL) */
        }
    }

    if (/[\r\n]/.test(cleaned)) {
        const lines = cleaned
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(line => line && !line.startsWith("#"));
        if (lines.length > 1) {
            for (const line of lines) {
                appendExpandedKeyEntries(targetList, line);
            }
            return;
        }
        if (lines.length === 1) {
            targetList.push(lines[0]);
            return;
        }
        return;
    }

    /* Dukung daftar Bearer token sederhana dipisahkan koma/titik-koma jika bukan JSON */
    if (!cleaned.includes("{") && !cleaned.includes("}") && /[,;]/.test(cleaned)) {
        const parts = cleaned
            .split(/[,;]/)
            .map(part => part.trim())
            .filter(Boolean);
        if (parts.length > 1) {
            for (const part of parts) {
                targetList.push(part);
            }
            return;
        }
    }

    targetList.push(cleaned);
}

function computeCredentialIdentity(rawKey, envObj = null) {
    try {
        const parsed = parseApiKeyInput(rawKey, envObj, { isolateFromDefaultRefresh: true });
        if (parsed.refreshToken) {
            return `rt:${parsed.clientId}:${parsed.refreshToken}`;
        }
        if (parsed.accessToken) {
            return `at:${parsed.accessToken}`;
        }
    } catch {
        /* abaikan entry tidak valid saat deduplikasi */
    }
    return `raw:${String(rawKey || "").trim()}`;
}

function extractOpusApiKeyPool(apiKeyInput, envOverride = null) {
    const env = envOverride && typeof envOverride === "object" ? envOverride : getEnv();
    const rawCandidates = [];

    const hasExplicitInput =
        Array.isArray(apiKeyInput)
            ? apiKeyInput.length > 0
            : apiKeyInput && typeof apiKeyInput === "object"
                ? Object.keys(apiKeyInput).length > 0
                : Boolean(String(apiKeyInput || "").trim());

    if (hasExplicitInput) {
        appendExpandedKeyEntries(rawCandidates, apiKeyInput);
    } else {
        for (const multiKeyName of ["OPUS_AUTH_TOKENS", "OPUS_API_KEYS", "OPUS_TOKENS"]) {
            const multiEnvRaw = unwrapOuterQuotesText(env[multiKeyName] || "");
            if (multiEnvRaw) {
                appendExpandedKeyEntries(rawCandidates, multiEnvRaw);
            }
        }
        collectEnvCredentialsBySuffix(rawCandidates, env, "");
        for (let slot = 1; slot <= MAX_OPUS_ENV_KEY_SLOTS; slot += 1) {
            collectEnvCredentialsBySuffix(rawCandidates, env, `_${slot}`);
            collectEnvCredentialsBySuffix(rawCandidates, env, `${slot}`);
        }
        if (env && typeof env === "object") {
            const dynamicItems = [];
            for (const propName of Object.keys(env)) {
                const match = DYNAMIC_OPUS_ENV_SLOT_PATTERN.exec(propName);
                if (!match) continue;
                const val = unwrapOuterQuotesText(env[propName]);
                if (!val) continue;
                dynamicItems.push({
                    slot: Number.parseInt(match[1], 10) || 0,
                    propName,
                    value: val
                });
            }
            dynamicItems.sort((a, b) => (a.slot - b.slot) || a.propName.localeCompare(b.propName));
            for (const item of dynamicItems) {
                appendExpandedKeyEntries(rawCandidates, item.value);
            }
        }
    }

    const deduped = [];
    const seen = new Set();
    for (const entry of rawCandidates) {
        const clean = String(entry || "").trim();
        if (!clean) continue;
        const identity = computeCredentialIdentity(clean, env);
        if (seen.has(identity)) continue;
        seen.add(identity);
        deduped.push(clean);
    }
    return deduped;
}

function parseApiKeyInput(apiKey, envOverride = null, { isolateFromDefaultRefresh = false } = {}) {
    const env = envOverride && typeof envOverride === "object" ? envOverride : getEnv();
    const defaultTokenEndpoint = String(env.OPUS_OAUTH_TOKEN_URL || DEFAULT_OAUTH_TOKEN_URL).trim();
    const raw = unwrapOuterQuotesText(apiKey);

    if (!raw) {
        const pool = extractOpusApiKeyPool("", env);
        if (pool.length > 0) {
            return parseApiKeyInput(pool[0], env, { isolateFromDefaultRefresh });
        }
        throw createProviderError({
            message: "Kredensial Opus belum dikonfigurasi. Isi API Key/Token Opus di Admin Panel atau OPUS_AUTH_TOKEN di Worker.",
            code: "MISSING_API_KEY",
            status: 401
        });
    }

    if (raw.startsWith("[") || (raw.startsWith("{") && raw.includes("\"opus_key_pool\""))) {
        const pool = extractOpusApiKeyPool(raw, env);
        if (pool.length > 0 && pool[0] !== raw) {
            return parseApiKeyInput(pool[0], env, { isolateFromDefaultRefresh });
        }
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
                    (isolateFromDefaultRefresh ? "" : env.OPUS_REFRESH_TOKEN) ||
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
                        expiresAtMs: parseExpiresAtTimestampMs(parsed.expires_at ?? parsed.expiresAt),
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
        refreshToken: isolateFromDefaultRefresh ? "" : String(env.OPUS_REFRESH_TOKEN || "").trim(),
        clientId: String(env.OPUS_CLIENT_ID || DEFAULT_OPUS_WORKOS_CLIENT_ID).trim(),
        clientSecret: String(env.OPUS_CLIENT_SECRET || "").trim(),
        resource: String(env.OPUS_RESOURCE_URL || "").trim(),
        scope: "",
        tokenEndpoint: defaultTokenEndpoint
    };
}

async function resolveBearerToken(
    apiKey,
    {
        forceRefresh = false,
        isolateFromDefaultRefresh = false,
        env = null
    } = {}
) {
    const parsed = parseApiKeyInput(apiKey, env, { isolateFromDefaultRefresh });

    if (parsed.refreshToken && parsed.clientId) {
        try {
            const resolved = await resolveOpusOAuthTokenWithVault({
                env,
                tokenEndpoint: parsed.tokenEndpoint || DEFAULT_OAUTH_TOKEN_URL,
                clientId: parsed.clientId,
                clientSecret: parsed.clientSecret,
                resource: parsed.resource,
                scope: parsed.scope,
                accessToken: parsed.accessToken,
                refreshToken: parsed.refreshToken,
                expiresAtMs: parsed.expiresAtMs,
                forceRefresh
            });
            if (resolved?.accessToken) {
                return resolved.accessToken;
            }
        } catch (err) {
            const status = Number(err?.status) || 401;
            const detail = redactSecrets(
                err?.oauthDetail || err?.message || "",
                [parsed.refreshToken, parsed.accessToken]
            );
            throw createProviderError({
                message: `Sesi OAuth Opus kedaluwarsa dan gagal diperbarui (${status})${detail ? `: ${detail}` : "."}`,
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
   TASK ID ENCODING (PROJECT + JOB + MULTI-KEY SLOT)
========================================================= */

function encodeOpusTaskId(projectId, jobId, keySlot = 0) {
    const cleanProject = String(projectId || "").trim();
    const cleanJob = String(jobId || "").trim();
    if (!cleanJob) return "";
    const slot = Number.isInteger(keySlot) && keySlot > 0 ? keySlot : 0;
    const prefix = slot > 0 ? `opus-k${slot}` : "opus";
    if (!cleanProject) return `${prefix}::${cleanJob}`;
    return `${prefix}:${cleanProject}:${cleanJob}`;
}

function parseOpusTaskId(taskId) {
    const raw = String(taskId || "").trim();
    if (!raw) {
        return {
            projectId: "",
            jobId: "",
            keySlot: 0,
            hasExplicitSlot: false,
            isInlineDone: false,
            isProjectPending: false
        };
    }
    if (raw.startsWith("opus-inline:")) {
        return {
            projectId: "",
            jobId: raw,
            keySlot: 0,
            hasExplicitSlot: false,
            isInlineDone: true,
            isProjectPending: false
        };
    }
    const slottedMatch = /^opus-k(\d+):(.*)$/.exec(raw);
    if (slottedMatch) {
        const keySlot = Math.max(0, Number.parseInt(slottedMatch[1], 10) || 0);
        const rest = slottedMatch[2];
        const sepIndex = rest.indexOf(":");
        if (sepIndex >= 0) {
            const projectId = rest.slice(0, sepIndex).trim();
            const jobId = rest.slice(sepIndex + 1).trim();
            return {
                projectId,
                jobId,
                keySlot,
                hasExplicitSlot: true,
                isInlineDone: false,
                isProjectPending: Boolean(projectId && jobId === PROJECT_PENDING_JOB_ID)
            };
        }
        return {
            projectId: "",
            jobId: rest.trim(),
            keySlot,
            hasExplicitSlot: true,
            isInlineDone: false,
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
                keySlot: 0,
                hasExplicitSlot: false,
                isInlineDone: false,
                isProjectPending: Boolean(projectId && jobId === PROJECT_PENDING_JOB_ID)
            };
        }
        return {
            projectId: "",
            jobId: rest.trim(),
            keySlot: 0,
            hasExplicitSlot: false,
            isInlineDone: false,
            isProjectPending: false
        };
    }
    return {
        projectId: "",
        jobId: raw,
        keySlot: 0,
        hasExplicitSlot: false,
        isInlineDone: false,
        isProjectPending: false
    };
}

function isOpusCreditExhaustedError(error) {
    if (!error || typeof error !== "object") return false;
    const rawCode = normalizeErrorToken(
        error.providerCode || error.code || error.error_code || ""
    );
    const message = String(error.message || "");
    if (
        rawCode === "submission_unknown" ||
        rawCode === "credit_reservation_pending" ||
        rawCode === "admission_incomplete" ||
        /submission_unknown|credit_reservation_pending/i.test(message)
    ) {
        return false;
    }
    if (
        Number(error.status) === 402 ||
        rawCode === "credit_admission_rejected" ||
        rawCode === "insufficient_credits" ||
        rawCode === "insufficient_funds" ||
        rawCode === "payment_required" ||
        rawCode === "quota_exceeded" ||
        rawCode === "quotaexceederr" ||
        rawCode === "opus_upstream_queue_busy"
    ) {
        return true;
    }
    return /credit_admission_rejected|insufficient[\s_-]*credits|not enough credits|no provider request was made|saldo kredit akun opus|kredit akun opusclip|kuota generasi opus labs sedang penuh atau telah habis/i.test(
        message
    );
}

/* =========================================================
   ERROR TRANSLATION (OPUS -> BAHASA INDONESIA)
========================================================= */

const ERROR_MESSAGE_BY_CODE = Object.freeze({
    credit_admission_rejected:
        "Saldo kredit akun Opus Labs (upstream OpusClip) tidak mencukupi untuk durasi/resolusi video ini.",
    insufficient_credits:
        "Saldo kredit akun Opus Labs (upstream OpusClip) tidak mencukupi untuk durasi/resolusi video ini.",
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

function appendSafeProviderDetail(baseMessage, code, fallbackMessage) {
    const cleanFallback = redactSecrets(String(fallbackMessage || "").trim());
    if (!cleanFallback || cleanFallback.length > 220) {
        return baseMessage;
    }
    const normFallback = normalizeErrorToken(cleanFallback);
    const normCode = normalizeErrorToken(code);
    if (
        !normFallback ||
        normFallback === normCode ||
        normFallback === "failed" ||
        normFallback === "error" ||
        cleanFallback.startsWith("{") ||
        cleanFallback.startsWith("[") ||
        baseMessage.toLowerCase().includes(cleanFallback.toLowerCase())
    ) {
        return baseMessage;
    }
    return `${baseMessage} (Detail Opus: ${cleanFallback})`;
}

export const OPUS_AUDIO_COPYRIGHT_ERROR_MESSAGE =
    "audio pada video/lagu yang anda upload terkena copyright, silahkan gunakan video/lagu yang lain, atau generate tanpa audio";

export function isOpusAudioCopyrightError(code, message = "") {
    const combined = `${code || ""} ${message || ""}`;
    if (!combined.trim()) {
        return false;
    }
    return (
        /\b(?:Output|Input)?AudioSensitiveContentDetected\b/i.test(combined) ||
        /\baudio[\s_-]*copyright\b/i.test(combined) ||
        /\b(?:output|input)?\s*audio\s+may\s+be\s+related\s+to\s+copyright\b/i.test(combined) ||
        (/\baudio\b/i.test(combined) && /\bcopyright\s+restrictions?\b/i.test(combined))
    );
}

function translateOpusError(code, fallbackMessage = "") {
    if (isOpusAudioCopyrightError(code, fallbackMessage)) {
        return OPUS_AUDIO_COPYRIGHT_ERROR_MESSAGE;
    }
    const key = normalizeErrorToken(code);
    if (key && ERROR_MESSAGE_BY_CODE[key]) {
        return appendSafeProviderDetail(ERROR_MESSAGE_BY_CODE[key], key, fallbackMessage);
    }
    const lowerMsg = String(fallbackMessage || "").toLowerCase();
    for (const [knownCode, idMessage] of Object.entries(ERROR_MESSAGE_BY_CODE)) {
        if (lowerMsg.includes(knownCode) || lowerMsg.includes(knownCode.replace(/_/g, " "))) {
            return appendSafeProviderDetail(idMessage, knownCode, fallbackMessage);
        }
    }
    const cleanFallback = redactSecrets(String(fallbackMessage || "").trim());
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
    includeTools = true,
    isolateFromDefaultRefresh = false,
    env = null
}) {
    let bearerToken = await resolveBearerToken(apiKey, {
        isolateFromDefaultRefresh,
        env
    });
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
            bearerToken = await resolveBearerToken(apiKey, {
                forceRefresh: true,
                isolateFromDefaultRefresh,
                env
            });
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
        if (ref.startsWith("#/")) {
            const segments = ref
                .slice(2)
                .split("/")
                .map(seg => seg.replace(/~1/g, "/").replace(/~0/g, "~"));
            let cursor = rootSchema;
            for (const seg of segments) {
                if (cursor && typeof cursor === "object" && Object.prototype.hasOwnProperty.call(cursor, seg)) {
                    cursor = cursor[seg];
                } else {
                    cursor = null;
                    break;
                }
            }
            if (cursor && typeof cursor === "object") {
                const resolved = derefSchema(cursor, rootSchema, seen);
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

    const absorbResolved = resolvedObj => {
        if (!resolvedObj) return;
        if (resolvedObj.properties && typeof resolvedObj.properties === "object") {
            hasExplicitProps = true;
            for (const [key, val] of Object.entries(resolvedObj.properties)) {
                if (!(key in mergedProps)) {
                    mergedProps[key] = derefSchema(val, rootSchema) || val;
                }
            }
        }
        if (Array.isArray(resolvedObj.required)) {
            for (const reqKey of resolvedObj.required) {
                if (typeof reqKey === "string") requiredSet.add(reqKey);
            }
        }
    };

    const absorbDirect = candidate => {
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

    absorbDirect(node);

    /*
     * PENTING: Resolusi rekursif penuh pada `allOf` + `anyOf`/`oneOf`!
     * Zod discriminatedUnion/intersection sering menghasilkan:
     *   `allOf: [ { properties: { id, prompt } }, { anyOf: [ BranchA, BranchB ] } ]`
     *   atau `{ properties: { id, prompt }, oneOf: [ BranchA, BranchB ] }`.
     * Kita WAJIB tetap mengekstrak cabang `anyOf`/`oneOf` walaupun `properties` dasar sudah ada,
     * agar field seperti `durationSeconds`/`durationSec`, `model`, `workflow`, `firstFrame`, dll. tidak hilang.
     */
    if (Array.isArray(node.allOf)) {
        for (const sub of node.allOf) {
            const subResolved = resolveObjectSchema(sub, rootSchema, preferBranch);
            absorbResolved(subResolved);
        }
    }

    for (const combinator of ["anyOf", "oneOf"]) {
        if (Array.isArray(node[combinator])) {
            const objBranches = node[combinator]
                .map(sub => derefSchema(sub, rootSchema))
                .filter(
                    sub =>
                        sub &&
                        !isNullOnlySchema(sub) &&
                        (sub.type === "object" || sub.properties || sub.allOf || sub.anyOf || sub.oneOf)
                );
            if (objBranches.length) {
                let chosen = null;
                if (typeof preferBranch === "function") {
                    let bestScore = -Infinity;
                    for (const branch of objBranches) {
                        const resolvedBranch = resolveObjectSchema(branch, rootSchema, preferBranch);
                        const rawVal = preferBranch(branch, resolvedBranch);
                        if (typeof rawVal === "boolean") {
                            if (rawVal) {
                                chosen = resolvedBranch;
                                break;
                            }
                        } else if (typeof rawVal === "number" && rawVal > bestScore) {
                            bestScore = rawVal;
                            chosen = resolvedBranch;
                        }
                    }
                }
                if (!chosen) {
                    chosen = resolveObjectSchema(objBranches[0], rootSchema, preferBranch);
                }
                absorbResolved(chosen);
                break;
            }
        }
    }

    return {
        properties: hasExplicitProps ? mergedProps : null,
        required: Array.from(requiredSet),
        raw: node
    };
}

function expandObjectBranches(schema, rootSchema, depth = 0) {
    const node = derefSchema(schema, rootSchema);
    if (!node || typeof node !== "object" || depth > 5) return [];

    const mergeTwo = (a, b) => ({
        properties: {
            ...(a.properties || {}),
            ...(b.properties || {})
        },
        required: Array.from(new Set([...(a.required || []), ...(b.required || [])])),
        raw: b.raw || a.raw || node
    });

    let current = [
        {
            properties:
                node.properties && typeof node.properties === "object"
                    ? Object.fromEntries(
                          Object.entries(node.properties).map(([k, v]) => [k, derefSchema(v, rootSchema) || v])
                      )
                    : {},
            required: Array.isArray(node.required) ? node.required.filter(k => typeof k === "string") : [],
            hasProps: Boolean(node.properties && typeof node.properties === "object"),
            raw: node
        }
    ];

    if (Array.isArray(node.allOf)) {
        for (const sub of node.allOf) {
            const subBranches = expandObjectBranches(sub, rootSchema, depth + 1);
            if (!subBranches.length) continue;
            const next = [];
            for (const base of current) {
                for (const sb of subBranches) {
                    const merged = mergeTwo(base, sb);
                    next.push({
                        ...merged,
                        hasProps: base.hasProps || sb.hasProps || Object.keys(merged.properties).length > 0
                    });
                }
            }
            if (next.length) current = next.slice(0, 16);
        }
    }

    for (const combinator of ["oneOf", "anyOf"]) {
        if (Array.isArray(node[combinator])) {
            const unionBranches = [];
            for (const sub of node[combinator]) {
                const resolvedSub = derefSchema(sub, rootSchema);
                if (!resolvedSub || isNullOnlySchema(resolvedSub)) continue;
                unionBranches.push(...expandObjectBranches(resolvedSub, rootSchema, depth + 1));
            }
            if (unionBranches.length) {
                const next = [];
                for (const base of current) {
                    for (const ub of unionBranches) {
                        const merged = mergeTwo(base, ub);
                        next.push({
                            ...merged,
                            hasProps: base.hasProps || ub.hasProps || Object.keys(merged.properties).length > 0
                        });
                    }
                }
                if (next.length) current = next.slice(0, 16);
                break;
            }
        }
    }

    return current
        .filter(item => item.hasProps || Object.keys(item.properties).length > 0)
        .map(item => ({
            properties: item.properties,
            required: item.required,
            raw: item.raw
        }));
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

function stripModelVendorPrefix(value) {
    const clean = String(value || "").trim();
    const slashIdx = clean.lastIndexOf("/");
    return slashIdx >= 0 ? clean.slice(slashIdx + 1) : clean;
}

function extractModelVersionTag(value) {
    const s = stripModelVendorPrefix(value).toLowerCase();
    const decimalMatch = /(?:^|[^0-9])(\d+)[._-](\d+)(?:[^0-9]|$)/.exec(s);
    if (decimalMatch) {
        return `${decimalMatch[1]}.${decimalMatch[2]}`;
    }
    const majorMatch = /(?:seedance|hailuo|h)[._-\s]*(\d+)(?:[^0-9]|$)/i.exec(s);
    if (majorMatch) {
        return `${majorMatch[1]}`;
    }
    return "";
}

function hasConflictingVersionTag(desiredVersion, candidateValue) {
    if (!desiredVersion) return false;
    const candVersion = extractModelVersionTag(candidateValue);
    if (!candVersion) {
        /* Jika kita minta versi spesifik seperti "2.5", jangan jatuh ke model generik tanpa versi ("seedance") bila ada pilihan lain */
        return true;
    }
    if (desiredVersion === candVersion) return false;
    if (!desiredVersion.includes(".") && candVersion.startsWith(`${desiredVersion}.0`)) {
        return false;
    }
    if (desiredVersion.endsWith(".0") && candVersion === desiredVersion.slice(0, -2)) {
        return false;
    }
    return true;
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

    /* 1. Exact case-insensitive match penuh */
    for (const candidate of candidates) {
        const exact = allowedValues.find(v => String(v).toLowerCase() === candidate.toLowerCase());
        if (exact !== undefined) return exact;
    }

    /* 2. Exact match setelah menghapus prefix vendor (mis. "bytedance/seedance-2.5" -> "seedance-2.5") */
    for (const candidate of candidates) {
        const bareCand = stripModelVendorPrefix(candidate).toLowerCase();
        const hit = allowedValues.find(v => stripModelVendorPrefix(v).toLowerCase() === bareCand);
        if (hit !== undefined) return hit;
    }

    /* 3. Compact alphanumeric exact match penuh & tanpa prefix vendor */
    const compactCandidates = candidates.map(normalizeCompactToken).filter(Boolean);
    for (const compact of compactCandidates) {
        const hit = allowedValues.find(v => normalizeCompactToken(v) === compact);
        if (hit !== undefined) return hit;
    }
    for (const candidate of candidates) {
        const bareCompact = normalizeCompactToken(stripModelVendorPrefix(candidate));
        if (!bareCompact) continue;
        const hit = allowedValues.find(
            v => normalizeCompactToken(stripModelVendorPrefix(v)) === bareCompact
        );
        if (hit !== undefined) return hit;
    }

    /* 4. Partial match dengan penjaga versi ketat (cegah "seedance-2.5" salah memilih "seedance" atau "seedance-2") */
    const desiredVersion = extractModelVersionTag(desiredModel);
    for (const compact of compactCandidates) {
        const hit = allowedValues.find(v => {
            if (hasConflictingVersionTag(desiredVersion, v)) return false;
            const cv = normalizeCompactToken(v);
            return cv.includes(compact);
        });
        if (hit !== undefined) return hit;
    }

    for (const compact of compactCandidates) {
        const hit = allowedValues.find(v => {
            if (hasConflictingVersionTag(desiredVersion, v)) return false;
            const cv = normalizeCompactToken(stripModelVendorPrefix(v));
            return cv.length >= 6 && compact.includes(cv);
        });
        if (hit !== undefined) return hit;
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

function inferVideoMimeFromUrl(url) {
    const clean = String(url || "").split("?")[0].split("#")[0].toLowerCase();
    if (clean.endsWith(".mov") || clean.endsWith(".qt")) return "video/quicktime";
    if (clean.endsWith(".webm")) return "video/webm";
    if (clean.endsWith(".m4v")) return "video/x-m4v";
    return "video/mp4";
}

function inferAudioMimeFromUrl(url) {
    const clean = String(url || "").split("?")[0].split("#")[0].toLowerCase();
    if (clean.endsWith(".wav") || clean.endsWith(".wave")) return "audio/wav";
    if (clean.endsWith(".m4a")) return "audio/mp4";
    if (clean.endsWith(".aac")) return "audio/aac";
    if (clean.endsWith(".ogg") || clean.endsWith(".oga")) return "audio/ogg";
    return "audio/mpeg";
}

function extFromMime(mime) {
    if (mime === "image/png") return "png";
    if (mime === "image/webp") return "webp";
    if (mime === "video/quicktime") return "mov";
    if (mime === "video/webm") return "webm";
    if (mime === "video/x-m4v") return "m4v";
    if (mime === "video/mp4") return "mp4";
    if (mime === "audio/wav" || mime === "audio/x-wav" || mime === "audio/wave" || mime === "audio/x-pn-wav") return "wav";
    if (mime === "audio/mp4" || mime === "audio/x-m4a" || mime === "audio/m4a") return "m4a";
    if (mime === "audio/aac") return "aac";
    if (mime === "audio/ogg") return "ogg";
    if (mime === "audio/mpeg" || mime === "audio/mp3") return "mp3";
    return "jpg";
}

function extractImportedAssetRecord(raw, clientItemId = "") {
    const data = unwrapEnvelope(raw);
    if (!data || typeof data !== "object") {
        return {
            assetId: "",
            status: "",
            itemFailed: false,
            uploadUrl: "",
            uploadMethod: "PUT",
            uploadHeaders: null,
            uri: ""
        };
    }

    const containers = [
        data.assets,
        data.items,
        data.results,
        data.uploads,
        data.imported,
        data.records
    ].filter(Array.isArray);

    if (
        !containers.length &&
        data.assets &&
        typeof data.assets === "object" &&
        !Array.isArray(data.assets)
    ) {
        const dictVals = Object.values(data.assets).filter(el => el && typeof el === "object");
        if (dictVals.length) containers.push(dictVals);
    }

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

    const nestedAsset =
        item && item.asset && typeof item.asset === "object"
            ? item.asset
            : data.asset && typeof data.asset === "object"
              ? data.asset
              : null;

    const source = item
        ? { ...data, ...(nestedAsset || {}), ...item }
        : { ...data, ...(nestedAsset || {}) };

    const uploadObj = source.upload && typeof source.upload === "object" ? source.upload : null;
    const arrayAssetId =
        Array.isArray(data.assetIds) && typeof data.assetIds[0] === "string"
            ? data.assetIds[0]
            : Array.isArray(data.asset_ids) && typeof data.asset_ids[0] === "string"
              ? data.asset_ids[0]
              : "";

    const assetId = String(
        source.assetId ||
        source.asset_id ||
        source.durableAssetId ||
        source.durableRef ||
        source.assetRef ||
        nestedAsset?.assetId ||
        nestedAsset?.id ||
        arrayAssetId ||
        source.id ||
        ""
    ).trim();

    const validAssetId = assetId && assetId !== clientItemId ? assetId : "";
    const status = String(source.status || source.state || "").trim().toLowerCase();
    const itemFailed = Boolean(
        source.ok === false ||
        source.error ||
        source.errorCode ||
        status === "failed" ||
        status === "error" ||
        status === "rejected"
    );

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
        itemFailed,
        uploadUrl,
        uploadMethod: uploadMethod || "PUT",
        uploadHeaders,
        uri: /^https?:\/\//i.test(uri) && uri !== uploadUrl ? uri : ""
    };
}

async function downloadSourceImageBytes(mediaUrl, mediaType = "image", mediaCache = null) {
    const urlCheck = inspectReferenceMediaUrl(mediaUrl);
    if (!urlCheck.valid) {
        throw createProviderError({
            message: urlCheck.message,
            code: urlCheck.code || "NON_DIRECT_MEDIA_URL",
            status: 422
        });
    }
    const cacheKey = `${mediaType}:${mediaUrl}`;
    if (mediaCache instanceof Map && mediaCache.has(cacheKey)) {
        return mediaCache.get(cacheKey);
    }
    const isVideo = mediaType === "video";
    const isAudio = mediaType === "audio";
    const mediaLabel = isVideo
        ? "video referensi"
        : isAudio
            ? "audio referensi"
            : "gambar referensi";
    const res = await fetchWithTimeout(
        mediaUrl,
        { method: "GET" },
        isVideo ? 35_000 : isAudio ? 25_000 : 20_000
    );
    if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
            throw createProviderError({
                message: `Link ${mediaLabel} ditolak oleh server asal (HTTP ${res.status} — link terproteksi atau kedaluwarsa, misalnya dari CDN Facebook/TikTok). Silakan simpan file ke perangkat lalu gunakan menu Upload.`,
                code: "REFERENCE_FETCH_FORBIDDEN",
                status: 422
            });
        }
        throw createProviderError({
            message: `Gagal mengunduh ${mediaLabel} untuk diunggah ke Opus Labs (HTTP ${res.status}).`,
            code: "REFERENCE_FETCH_FAILED",
            status: 422
        });
    }
    const contentType = String(res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (!bytes.byteLength) {
        throw createProviderError({
            message: `${isVideo ? "Video referensi" : isAudio ? "Audio referensi" : "Gambar referensi"} kosong (0 byte).`,
            code: "REFERENCE_EMPTY",
            status: 422
        });
    }
    if (isNonMediaHttpPayload(contentType, bytes)) {
        throw createProviderError({
            message: `URL referensi mengarah ke halaman web (HTML), bukan file ${mediaLabel} langsung. Silakan gunakan direct link file (.jpg/.png/.mp4/.mp3) atau unduh medianya lalu gunakan menu Upload.`,
            code: "NON_DIRECT_MEDIA_URL",
            status: 422
        });
    }
    const resolvedMime = isVideo
        ? (contentType.startsWith("video/") ? contentType : inferVideoMimeFromUrl(mediaUrl))
        : isAudio
            ? (contentType.startsWith("audio/") ? contentType : inferAudioMimeFromUrl(mediaUrl))
            : (contentType.startsWith("image/") ? contentType : inferImageMimeFromUrl(mediaUrl));
    const downloaded = {
        bytes,
        mimeType: resolvedMime
    };
    if (mediaCache instanceof Map) {
        mediaCache.set(cacheKey, downloaded);
    }
    return downloaded;
}

async function stageSingleReferenceImage(session, importTool, projectId, refItem, index) {
    const itemMediaType =
        refItem.mediaType === "video"
            ? "video"
            : refItem.mediaType === "audio"
                ? "audio"
                : "image";
    const urlCheck = inspectReferenceMediaUrl(refItem.url);
    if (!urlCheck.valid) {
        throw createProviderError({
            message: urlCheck.message,
            code: urlCheck.code || "NON_DIRECT_MEDIA_URL",
            status: 422
        });
    }
    if (!importTool) {
        return {
            assetId: "",
            url: refItem.url,
            role: refItem.role,
            label: refItem.label,
            mimeType: refItem.mimeType,
            mediaType: itemMediaType
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
    const itemSchema = arrayKey ? resolveArrayItemSchema(topProps[arrayKey], rootSchema) : rootSchema;
    const itemBranches = expandObjectBranches(itemSchema, rootSchema);
    const itemObj = arrayKey
        ? resolveObjectSchema(itemSchema, rootSchema, branch => {
              const p = branch?.properties || {};
              return Boolean(p.url || p.sourceUrl || p.dataUrl || p.data || p.fileName || p.filename);
          })
        : topObj;

    const mergedItemProps = itemBranches.length > 1
        ? Object.assign({}, ...itemBranches.map(b => b.properties || {}))
        : itemObj.properties;
    const itemProps = mergedItemProps || itemObj.properties;

    const clientItemId = `asset-${index + 1}`;
    const buildBaseEntry = () => {
        const entry = {};
        const idKey = pickSupportedKey(itemProps, ["clientId", "client_id", "itemId", "item_id", "id"], "");
        if (idKey && idKey !== "assetId") entry[idKey] = clientItemId;

        const nameKey = pickSupportedKey(itemProps, ["fileName", "filename", "file_name", "name", "label"], "");
        if (nameKey) entry[nameKey] = refItem.fileName;

        const mimeKey = pickSupportedKey(itemProps, ["mimeType", "mime_type", "contentType", "content_type"], "");
        if (mimeKey) entry[mimeKey] = refItem.mimeType;

        const kindKey = pickSupportedKey(itemProps, ["mediaType", "media_type", "assetType", "asset_type", "type", "kind"], "");
        if (kindKey) {
            const allowedKinds = extractAllowedValues(itemProps[kindKey], rootSchema);
            const kindCandidates = itemMediaType === "video"
                ? ["video", "clip", "footage", "reference_video", "reference"]
                : itemMediaType === "audio"
                    ? ["audio", "sound", "music", "voice", "voiceover", "reference_audio", "reference"]
                    : ["image", "photo", "reference", "frame"];
            const matchedKind = matchEnumCaseInsensitive(kindCandidates, allowedKinds);
            if (matchedKind !== null) entry[kindKey] = matchedKind;
        }
        return entry;
    };

    const urlCandidates = itemMediaType === "video"
        ? ["url", "sourceUrl", "source_url", "uri", "videoUrl", "video_url", "remoteUrl"]
        : itemMediaType === "audio"
            ? ["url", "sourceUrl", "source_url", "uri", "audioUrl", "audio_url", "remoteUrl"]
            : ["url", "sourceUrl", "source_url", "uri", "imageUrl", "image_url", "remoteUrl"];
    const urlKey = pickSupportedKey(
        itemProps,
        urlCandidates,
        !itemProps ? "url" : ""
    );
    const dataKey = pickSupportedKey(
        itemProps,
        ["dataUrl", "data_url", "mediaBase64", "media_base64", "data", "base64", "contentBase64", "content_base64", "bytesBase64"],
        ""
    );
    const sizeKey = pickSupportedKey(
        itemProps,
        ["sizeBytes", "size_bytes", "fileSize", "file_size", "contentLength", "size"],
        ""
    );

    const projKey = pickSupportedKey(topProps, ["projectId", "project_id"], projectId && !topProps ? "projectId" : "");
    const reqKey = pickSupportedKey(topProps, ["requestKey", "idempotencyKey", "request_key"], "");

    const wrapCallArgs = entryObj => ({
        ...(projKey && projectId ? { [projKey]: projectId } : {}),
        ...(reqKey ? { [reqKey]: makeUuid() } : {}),
        ...(arrayKey ? { [arrayKey]: [entryObj] } : entryObj)
    });

    let cachedDownloaded = null;
    const entry = buildBaseEntry();
    if (urlKey) {
        entry[urlKey] = refItem.url;
    } else if (dataKey) {
        cachedDownloaded = await downloadSourceImageBytes(refItem.url, itemMediaType);
        const b64 = bytesToBase64(cachedDownloaded.bytes);
        entry[dataKey] = /url|uri/i.test(dataKey)
            ? `data:${cachedDownloaded.mimeType};base64,${b64}`
            : b64;
        if (sizeKey) entry[sizeKey] = cachedDownloaded.bytes.byteLength;
    }

    let stepRes;
    let record;
    try {
        stepRes = await session.callTool(importTool.name, wrapCallArgs(entry));
        record = extractImportedAssetRecord(stepRes.data, clientItemId);
    } catch (rpcError) {
        stepRes = { isError: true, error: rpcError };
        record = {
            assetId: "",
            status: "failed",
            itemFailed: true,
            uploadUrl: "",
            uploadMethod: "PUT",
            uploadHeaders: null,
            uri: ""
        };
    }

    /*
     * Jika import_assets via remote URL gagal (mis. signed URL storage privat atau CDN pihak ketiga ditolak oleh fetcher Opus)
     * atau tidak mengembalikan assetId maupun uploadUrl, fallback ke upload langsung via dataUrl/base64/presigned upload.
     */
    if (
        (stepRes.isError || record.itemFailed || (!record.assetId && !record.uploadUrl)) &&
        urlKey &&
        (dataKey || sizeKey || pickSupportedKey(itemProps, ["fileName", "filename", "file_name"], ""))
    ) {
        try {
            if (!cachedDownloaded) {
                cachedDownloaded = await downloadSourceImageBytes(
                    refItem.url,
                    itemMediaType,
                    refItem.mediaCache || null
                );
            }
            const fallbackEntry = buildBaseEntry();
            const mimeKey = pickSupportedKey(itemProps, ["mimeType", "mime_type", "contentType", "content_type"], "");
            if (mimeKey) fallbackEntry[mimeKey] = cachedDownloaded.mimeType;
            if (sizeKey) fallbackEntry[sizeKey] = cachedDownloaded.bytes.byteLength;
            if (dataKey) {
                const b64 = bytesToBase64(cachedDownloaded.bytes);
                fallbackEntry[dataKey] = /url|uri/i.test(dataKey)
                    ? `data:${cachedDownloaded.mimeType};base64,${b64}`
                    : b64;
            }
            const retryRes = await session.callTool(importTool.name, wrapCallArgs(fallbackEntry));
            if (!retryRes.isError) {
                const retryRecord = extractImportedAssetRecord(retryRes.data, clientItemId);
                if (retryRecord.assetId || retryRecord.uploadUrl) {
                    stepRes = retryRes;
                    record = retryRecord;
                }
            }
        } catch (fallbackErr) {
            if (
                fallbackErr?.code === "NON_DIRECT_MEDIA_URL" ||
                fallbackErr?.code === "REFERENCE_FETCH_FORBIDDEN" ||
                fallbackErr?.code === "REFERENCE_FETCH_FAILED" ||
                fallbackErr?.code === "REFERENCE_EMPTY" ||
                fallbackErr?.code === "INVALID_MEDIA_URL"
            ) {
                throw fallbackErr;
            }
            /* Biarkan lanjut menggunakan fallback URL bila retry MCP gagal karena alasan skema */
        }
    }

    if (stepRes.isError && !record.assetId && !record.uploadUrl) {
        return {
            assetId: "",
            url: refItem.url,
            role: refItem.role,
            label: refItem.label,
            mimeType: refItem.mimeType,
            mediaType: itemMediaType
        };
    }

    /* Tangani kontrak resmi Opus MCP: status === "awaiting_upload" -> PUT bytes -> finalize import_assets */
    if ((record.status === "awaiting_upload" || record.uploadUrl) && record.uploadUrl) {
        if (!cachedDownloaded) {
            cachedDownloaded = await downloadSourceImageBytes(
                refItem.url,
                itemMediaType,
                refItem.mediaCache || null
            );
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
            itemMediaType === "video" ? 40_000 : itemMediaType === "audio" ? 30_000 : 25_000
        );

        if (!putRes.ok) {
            const putMediaLabel =
                itemMediaType === "video"
                    ? "video referensi"
                    : itemMediaType === "audio"
                        ? "audio referensi"
                        : "gambar referensi";
            throw createProviderError({
                message: `Gagal mengunggah ${putMediaLabel} ke penyimpanan Opus Labs (HTTP ${putRes.status}).`,
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
        mimeType: cachedDownloaded?.mimeType || refItem.mimeType,
        mediaType: itemMediaType
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
            const isVideo = ref.mediaType === "video";
            const isAudio = ref.mediaType === "audio";
            const defaultLabel =
                ref.label ||
                (isVideo
                    ? `video${idx + 1}`
                    : isAudio
                        ? `audio${idx + 1}`
                        : `image${idx + 1}`);
            const entry = {};
            const idKey = pickSupportedKey(props, ["assetId", "asset_id", "assetRef", "ref", "id"], "");
            if (idKey && ref.assetId) {
                entry[idKey] = ref.assetId;
            }
            const urlKey = pickSupportedKey(
                props,
                isVideo
                    ? ["url", "uri", "videoUrl", "video_url", "sourceUrl"]
                    : isAudio
                        ? ["url", "uri", "audioUrl", "audio_url", "sourceUrl"]
                        : ["url", "uri", "imageUrl", "image_url", "sourceUrl"],
                ""
            );
            if (urlKey && (!idKey || !ref.assetId || itemObj.required.includes(urlKey)) && ref.url) {
                entry[urlKey] = ref.url;
            }
            const labelKey = pickSupportedKey(props, ["label", "tag", "slot", "name", "referenceId"], "");
            if (labelKey && labelKey !== idKey) {
                const allowedLabels = extractAllowedValues(props[labelKey], rootSchema);
                const matched = matchEnumCaseInsensitive(
                    [defaultLabel, `@${defaultLabel}`],
                    allowedLabels
                );
                if (matched !== null) {
                    entry[labelKey] = matched;
                }
            }
            const roleKey = pickSupportedKey(props, ["role", "kind", "type", "usage", "mediaType", "media_type"], "");
            if (roleKey) {
                const allowedRoles = extractAllowedValues(props[roleKey], rootSchema);
                const roleCandidates = isVideo
                    ? [ref.role, "reference", "video", "motion", "style", "clip"]
                    : isAudio
                        ? [ref.role, "audio", "reference", "sound", "music", "voice", "soundtrack", "voiceover"]
                        : [ref.role, "outfit", "character", "reference", "image", "subject", "style"];
                const matchedRole = matchEnumCaseInsensitive(roleCandidates, allowedRoles);
                if (matchedRole !== null) {
                    entry[roleKey] = matchedRole;
                }
            }
            const mimeKey = pickSupportedKey(props, ["mimeType", "mime_type", "contentType", "content_type"], "");
            if (mimeKey && itemObj.required.includes(mimeKey) && ref.mimeType) {
                entry[mimeKey] = ref.mimeType;
            }
            return entry;
        });
    }

    return stagedRefs.map((ref, idx) => {
        const isVideo = ref.mediaType === "video";
        const isAudio = ref.mediaType === "audio";
        const defaultLabel =
            ref.label ||
            (isVideo
                ? `video${idx + 1}`
                : isAudio
                    ? `audio${idx + 1}`
                    : `image${idx + 1}`);
        return {
            ...(ref.assetId ? { assetId: ref.assetId } : { url: ref.url }),
            label: defaultLabel,
            ...(isVideo ? { mediaType: "video" } : isAudio ? { mediaType: "audio" } : {})
        };
    });
}

const DURATION_KEY_CANDIDATES = [
    "durationSeconds",
    "duration_seconds",
    "durationSec",
    "duration_sec",
    "durationSecs",
    "duration_secs",
    "duration",
    "clipDurationSeconds",
    "clip_duration_seconds",
    "clipDurationSec",
    "clip_duration_sec",
    "clipDuration",
    "clip_duration",
    "targetDurationSeconds",
    "target_duration_seconds",
    "targetDurationSec",
    "target_duration_sec",
    "targetDuration",
    "target_duration",
    "videoDurationSeconds",
    "video_duration_seconds",
    "videoDurationSec",
    "video_duration_sec",
    "videoDuration",
    "video_duration",
    "plannedDurationSeconds",
    "planned_duration_seconds",
    "requestedDurationSeconds",
    "requested_duration_seconds",
    "lengthSeconds",
    "length_seconds",
    "lengthSec",
    "length_sec",
    "videoLength",
    "video_length",
    "seconds",
    "length",
    "durationMs",
    "duration_ms"
];

function findSupportedDurationKeys(props, required = [], fallbackWhenSchemaless = "") {
    if (!props) {
        return fallbackWhenSchemaless ? [fallbackWhenSchemaless] : [];
    }
    const found = [];
    const primary = pickSupportedKey(props, DURATION_KEY_CANDIDATES, "");
    if (primary) {
        found.push(primary);
    }

    /* Tambahkan key durasi lain bila secara eksplisit diwajibkan oleh schema */
    for (const reqKey of required) {
        if (found.includes(reqKey) || !Object.prototype.hasOwnProperty.call(props, reqKey)) continue;
        if (
            /(duration|length)/i.test(reqKey) &&
            !/^(min|max|auto)|mode|type|unit|timeout|expire|cache|poll|retry|audio|music|voice|fade|transition/i.test(reqKey)
        ) {
            found.push(reqKey);
        }
    }

    /* Fallback dinamis jika server memakai penamaan custom (mis. outputDuration / shotDuration) */
    if (!found.length) {
        for (const key of Object.keys(props)) {
            if (
                /(duration|length)/i.test(key) &&
                !/^(min|max|auto)|mode|type|unit|timeout|expire|cache|poll|retry|audio|music|voice|fade|transition/i.test(key)
            ) {
                const p = props[key];
                if (
                    schemaTypeIncludes(p, null, "integer") ||
                    schemaTypeIncludes(p, null, "number") ||
                    schemaTypeIncludes(p, null, "string")
                ) {
                    found.push(key);
                    break;
                }
            }
        }
    }

    return found;
}

function formatDurationValueForSchema(durKey, durProp, rootSchema, durationSeconds) {
    const isMillis = /(?:ms|millis|millisecond)$/i.test(String(durKey || ""));
    const numericTarget = isMillis
        ? Math.round(durationSeconds * 1000)
        : Math.round(durationSeconds);

    if (!durProp) {
        return numericTarget;
    }

    const variants = collectSchemaVariants(durProp, rootSchema);
    const allowedDurs = extractAllowedValues(durProp, rootSchema);

    if (allowedDurs.length > 0) {
        const exactNumericMatch = allowedDurs.find(v => {
            if (typeof v === "number") return v === numericTarget;
            const cleaned = String(v).trim().replace(/(?:ms|s|sec|secs|seconds)$/i, "");
            const parsed = Number(cleaned);
            return Number.isFinite(parsed) && parsed > 0 && parsed === numericTarget;
        });
        if (exactNumericMatch !== undefined) {
            return exactNumericMatch;
        }
        const enumStrMatch = matchEnumCaseInsensitive(
            isMillis
                ? [String(numericTarget), `${numericTarget}ms`, `${Math.round(durationSeconds)}s`]
                : [String(numericTarget), `${numericTarget}s`, `${numericTarget}sec`],
            allowedDurs
        );
        if (enumStrMatch !== null) {
            return enumStrMatch;
        }
    }

    const hasFreeNumericBranch = variants.some(
        v =>
            v &&
            (v.type === "integer" ||
                v.type === "number" ||
                (Array.isArray(v.type) && (v.type.includes("integer") || v.type.includes("number")))) &&
            !Array.isArray(v.enum) &&
            v.const === undefined
    );

    if (hasFreeNumericBranch) {
        return numericTarget;
    }

    const allowsNumeric =
        schemaTypeIncludes(durProp, rootSchema, "integer") ||
        schemaTypeIncludes(durProp, rootSchema, "number");
    const allowsString = schemaTypeIncludes(durProp, rootSchema, "string");

    if (allowsString && !allowsNumeric) {
        const wantsSecondsSuffix = variants.some(
            v =>
                (typeof v?.pattern === "string" && /s\$?$/i.test(v.pattern)) ||
                (typeof v?.default === "string" && /^\d+s$/i.test(v.default))
        );
        if (wantsSecondsSuffix && !isMillis) {
            return `${Math.round(durationSeconds)}s`;
        }
        return String(numericTarget);
    }

    return numericTarget;
}

function applyDurationControls(target, props, required, rootSchema, durationSeconds, fallbackKey = "") {
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return false;

    const durKeys = findSupportedDurationKeys(props, required, fallbackKey);
    let wroteDuration = false;

    for (const durKey of durKeys) {
        target[durKey] = formatDurationValueForSchema(durKey, props?.[durKey], rootSchema, durationSeconds);
        wroteDuration = true;
    }

    if (props) {
        const autoDurKey = pickSupportedKey(
            props,
            ["autoDuration", "auto_duration", "isAutoDuration", "useAutoDuration"],
            ""
        );
        if (autoDurKey && schemaTypeIncludes(props[autoDurKey], rootSchema, "boolean")) {
            target[autoDurKey] = false;
        }

        const durModeKey = pickSupportedKey(
            props,
            ["durationMode", "duration_mode", "lengthMode", "length_mode"],
            ""
        );
        if (durModeKey) {
            const allowedModes = extractAllowedValues(props[durModeKey], rootSchema);
            const matchedMode = matchEnumCaseInsensitive(
                ["fixed", "custom", "manual", "explicit", "exact", "specified"],
                allowedModes
            );
            if (matchedMode !== null) {
                target[durModeKey] = matchedMode;
            }
        }

        const startSecKey = pickSupportedKey(props, ["startSeconds", "start_seconds", "startSec", "start_sec"], "");
        const endSecKey = pickSupportedKey(props, ["endSeconds", "end_seconds", "endSec", "end_sec"], "");
        if (startSecKey && endSecKey && (required.includes(startSecKey) || required.includes(endSecKey))) {
            if (target[startSecKey] === undefined) target[startSecKey] = 0;
            if (target[endSecKey] === undefined) target[endSecKey] = Math.round(durationSeconds);
            wroteDuration = true;
        }
    }

    return wroteDuration;
}

function branchSupportsDuration(durProp, rootSchema, durationSeconds) {
    if (!durProp || !Number.isFinite(durationSeconds) || durationSeconds <= 0) return 0;
    const variants = collectSchemaVariants(durProp, rootSchema);
    let maxSeen = null;
    let minSeen = null;
    for (const v of variants) {
        if (typeof v?.maximum === "number") {
            maxSeen = maxSeen === null ? v.maximum : Math.max(maxSeen, v.maximum);
        }
        if (typeof v?.minimum === "number") {
            minSeen = minSeen === null ? v.minimum : Math.min(minSeen, v.minimum);
        }
    }
    if (maxSeen !== null && durationSeconds > maxSeen) return -45;
    if (minSeen !== null && durationSeconds < minSeen) return -25;

    const allowed = extractAllowedValues(durProp, rootSchema);
    const positiveAllowed = allowed
        .map(v => Number(String(v).trim().replace(/(?:ms|s|sec|secs|seconds)$/i, "")))
        .filter(n => Number.isFinite(n) && n > 0);

    const hasOpenNumeric = variants.some(
        v =>
            (v?.type === "integer" || v?.type === "number") &&
            !Array.isArray(v?.enum) &&
            v?.const === undefined
    );

    if (positiveAllowed.length > 0 && !hasOpenNumeric) {
        const hit = positiveAllowed.some(
            n => n === Math.round(durationSeconds) || n === Math.round(durationSeconds * 1000)
        );
        return hit ? 35 : -40;
    }

    return 25;
}

function scoreClipSchemaBranch(branchObj, rootSchema, params) {
    const props = branchObj?.properties;
    if (!props || typeof props !== "object") return 0;
    let score = 0;

    const wfKey = pickSupportedKey(props, ["workflow", "mode", "generationMode", "generation_mode", "route"], "");
    if (wfKey && params.workflow) {
        const allowedWf = extractAllowedValues(props[wfKey], rootSchema);
        if (allowedWf.length > 0) {
            const aliases =
                params.workflow === "first_last_frame"
                    ? ["first_last_frame", "first-last-frame", "firstlastframe", "image2video", "image_to_video", "i2v", "keyframe2video", "frames"]
                    : ["reference2video", "reference_to_video", "r2v", "text2video", "text_to_video", "t2v"];
            const matched = allowedWf.some(v => aliases.includes(String(v).toLowerCase()));
            score += matched ? 55 : -55;
        }
    }

    const modelKey = pickSupportedKey(
        props,
        ["model", "videoModel", "video_model", "modelId", "model_id", "providerModel", "modelName", "model_name"],
        ""
    );
    if (modelKey && params.opusModel) {
        const allowedModels = extractAllowedValues(props[modelKey], rootSchema);
        if (allowedModels.length > 0) {
            const matchedModel = matchVideoModelValue(params.opusModel, params.modelAliases, allowedModels);
            score += matchedModel ? 65 : -65;
        }
    }

    const durKeys = findSupportedDurationKeys(props, branchObj.required || [], "");
    if (durKeys.length > 0) {
        score += 15 + branchSupportsDuration(props[durKeys[0]], rootSchema, params.durationSeconds);
    }

    if (params.stagedFirstFrame) {
        const hasFirstFrameProp = Boolean(
            pickSupportedKey(
                props,
                ["firstFrame", "first_frame", "firstFrameAsset", "firstFrameAssetId", "startFrame", "firstFrameUrl", "imageUrl"],
                ""
            )
        );
        score += hasFirstFrameProp ? 35 : -20;
    } else if (Array.isArray(params.stagedReferences) && params.stagedReferences.length > 0) {
        const hasRefProp = Boolean(
            pickSupportedKey(
                props,
                [
                    "referenceAssets",
                    "reference_assets",
                    "references",
                    "assets",
                    "referenceAssetIds",
                    "referenceImageUrls",
                    "referenceVideoUrls",
                    "reference_video_urls",
                    "videoUrls",
                    "video_urls",
                    "referenceAudioAssets",
                    "reference_audio_assets",
                    "audioAssets",
                    "audio_assets",
                    "referenceAudioUrls",
                    "reference_audio_urls",
                    "audioUrls",
                    "audio_urls",
                    "audioAsset",
                    "audio_asset",
                    "audioAssetId",
                    "audio_asset_id",
                    "audioUrl",
                    "audio_url"
                ],
                ""
            )
        );
        score += hasRefProp ? 35 : -20;
    }

    return score;
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
    if (
        labelKey &&
        (required.includes(labelKey) ||
            /outputlabel|output_label/i.test(labelKey) ||
            (isBatchItem && !minimal))
    ) {
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

    let wroteModel = false;
    if (opusModel) {
        const modelKey = pickSupportedKey(
            props,
            [
                "model",
                "videoModel",
                "video_model",
                "modelId",
                "model_id",
                "providerModel",
                "provider_model",
                "modelName",
                "model_name",
                "modelSlug",
                "model_slug",
                "engine"
            ],
            !props ? "model" : ""
        );
        if (modelKey) {
            const allowedModels = extractAllowedValues(props?.[modelKey], rootSchema);
            const matchedModel = matchVideoModelValue(opusModel, modelAliases, allowedModels);
            if (matchedModel !== null && matchedModel !== "") {
                target[modelKey] = matchedModel;
                wroteModel = true;
            } else if (allowedModels.length > 0) {
                throw createProviderError({
                    message: `Model video "${opusModel}" tidak tersedia di akun Opus Labs saat ini (tersedia: ${allowedModels.join(", ")}).`,
                    code: "model_unavailable",
                    providerCode: "model_unavailable",
                    status: 422
                });
            }
        }

        const versionKey = pickSupportedKey(props, ["modelVersion", "model_version", "version"], "");
        if (versionKey) {
            const wantedVer = extractModelVersionTag(opusModel);
            if (wantedVer) {
                const allowedVers = extractAllowedValues(props[versionKey], rootSchema);
                const matchedVer = matchEnumCaseInsensitive([wantedVer, `v${wantedVer}`], allowedVers);
                if (matchedVer !== null) {
                    target[versionKey] = matchedVer;
                }
            }
        }
    }

    const workflowKey = pickSupportedKey(
        props,
        ["workflow", "mode", "generationMode", "generation_mode", "route", "taskType", "task_type"],
        !props && workflow ? "workflow" : ""
    );
    if (workflowKey && workflow) {
        const allowedWorkflows = extractAllowedValues(props?.[workflowKey], rootSchema);
        target[workflowKey] = matchWorkflowValue(workflow, allowedWorkflows);
    }

    let wroteDuration = applyDurationControls(
        target,
        props,
        required,
        rootSchema,
        durationSeconds,
        !props ? "durationSeconds" : ""
    );

    let wroteResolution = false;
    if (resolution) {
        const resKey = pickSupportedKey(
            props,
            ["resolution", "videoResolution", "video_resolution", "outputResolution", "output_resolution", "quality"],
            !props ? "resolution" : ""
        );
        if (resKey) {
            const allowedRes = extractAllowedValues(props?.[resKey], rootSchema);
            const matchedRes = matchEnumCaseInsensitive(
                [resolution, resolution.toLowerCase(), resolution.toUpperCase()],
                allowedRes
            );
            if (matchedRes !== null) {
                target[resKey] = matchedRes;
                wroteResolution = true;
            } else if (required.includes(resKey) && allowedRes.length) {
                target[resKey] = allowedRes[0];
                wroteResolution = true;
            }
        }
    }

    /*
     * Sesuai docs Opus & BytePlus Seedance 2.5:
     * Jangan paksa aspectRatio konkrit saat memakai firstFrame kecuali diwajibkan oleh schema.
     * Jika schema mewajibkan aspect/aspectRatio pada firstFrame, utamakan "adaptive" / "auto" bila tersedia.
     */
    const ratioRequired = required.some(k => /^(aspectRatio|aspect_ratio|aspect|ratio)$/i.test(k));
    const shouldSendRatio =
        (Boolean(aspectRatio) && !stagedFirstFrame) || ratioRequired;

    let wroteRatio = false;
    if (shouldSendRatio) {
        const ratioKey = pickSupportedKey(
            props,
            ["aspectRatio", "aspect_ratio", "aspect", "ratio"],
            !props && Boolean(aspectRatio) && !stagedFirstFrame ? "aspectRatio" : ""
        );
        if (ratioKey) {
            const allowedRatios = extractAllowedValues(props?.[ratioKey], rootSchema);
            const ratioCandidates = stagedFirstFrame && !aspectRatio
                ? ["adaptive", "auto", "match_input", "source", "9:16", "16:9"]
                : [aspectRatio || "9:16"];
            const matchedRatio = matchEnumCaseInsensitive(ratioCandidates, allowedRatios);
            if (matchedRatio !== null) {
                target[ratioKey] = matchedRatio;
                wroteRatio = true;
            } else if (required.includes(ratioKey) && allowedRatios.length) {
                target[ratioKey] = allowedRatios[0];
                wroteRatio = true;
            }
        }
    }

    let wroteAudio = false;
    if (typeof generateAudio === "boolean") {
        const audioKey = pickSupportedKey(
            props,
            ["generateAudio", "generate_audio", "withAudio", "with_audio", "enableAudio", "enable_audio", "includeAudio", "include_audio", "audio"],
            ""
        );
        if (audioKey && schemaTypeIncludes(props?.[audioKey], rootSchema, "boolean")) {
            target[audioKey] = generateAudio;
            wroteAudio = true;
        } else if (!props && generateAudio === true) {
            target.generateAudio = true;
            wroteAudio = true;
        }
    }

    /*
     * Jika schema menaruh duration / resolution / model / audio di dalam sub-objek konfigurasi
     * (mis. `settings`, `options`, `config`, `video`, `generation`, `params`, `parameters`, `spec`),
     * isi sub-objek tersebut secara otomatis.
     */
    if (props) {
        const nestedKeys = [
            "settings",
            "options",
            "config",
            "videoConfig",
            "video_config",
            "clipConfig",
            "clip_config",
            "generationConfig",
            "generation_config",
            "video",
            "generation",
            "params",
            "parameters",
            "spec"
        ];
        for (const nk of nestedKeys) {
            if (!Object.prototype.hasOwnProperty.call(props, nk)) continue;
            if (!schemaTypeIncludes(props[nk], rootSchema, "object")) continue;
            const nestedObj = resolveObjectSchema(props[nk], rootSchema);
            if (!nestedObj.properties) continue;
            const nProps = nestedObj.properties;
            const nReq = nestedObj.required || [];
            const sub = {};

            if (!wroteDuration) {
                wroteDuration = applyDurationControls(sub, nProps, nReq, rootSchema, durationSeconds, "") || wroteDuration;
            }
            if (!wroteModel && opusModel) {
                const nModelKey = pickSupportedKey(
                    nProps,
                    ["model", "videoModel", "video_model", "modelId", "model_id", "providerModel", "modelName"],
                    ""
                );
                if (nModelKey) {
                    const allowedM = extractAllowedValues(nProps[nModelKey], rootSchema);
                    const matchedM = matchVideoModelValue(opusModel, modelAliases, allowedM);
                    if (matchedM) {
                        sub[nModelKey] = matchedM;
                        wroteModel = true;
                    }
                }
            }
            if (!wroteResolution && resolution) {
                const nResKey = pickSupportedKey(nProps, ["resolution", "videoResolution", "quality"], "");
                if (nResKey) {
                    const allowedR = extractAllowedValues(nProps[nResKey], rootSchema);
                    const matchedR = matchEnumCaseInsensitive([resolution, resolution.toLowerCase(), resolution.toUpperCase()], allowedR);
                    if (matchedR !== null) {
                        sub[nResKey] = matchedR;
                        wroteResolution = true;
                    }
                }
            }
            if (!wroteRatio && shouldSendRatio) {
                const nRatioKey = pickSupportedKey(nProps, ["aspectRatio", "aspect_ratio", "aspect", "ratio"], "");
                if (nRatioKey) {
                    const allowedRatios = extractAllowedValues(nProps[nRatioKey], rootSchema);
                    const matchedRatio = matchEnumCaseInsensitive([aspectRatio || "adaptive", "9:16"], allowedRatios);
                    if (matchedRatio !== null) {
                        sub[nRatioKey] = matchedRatio;
                        wroteRatio = true;
                    }
                }
            }
            if (!wroteAudio && typeof generateAudio === "boolean") {
                const nAudioKey = pickSupportedKey(
                    nProps,
                    ["generateAudio", "generate_audio", "withAudio", "with_audio", "enableAudio", "audio"],
                    ""
                );
                if (nAudioKey && schemaTypeIncludes(nProps[nAudioKey], rootSchema, "boolean")) {
                    sub[nAudioKey] = generateAudio;
                    wroteAudio = true;
                }
            }

            if (Object.keys(sub).length > 0 || required.includes(nk)) {
                target[nk] = sub;
            }
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
        const imageRefs = stagedReferences.filter(r => r.mediaType === "image" || (!r.mediaType && r.mediaType !== "video" && r.mediaType !== "audio"));
        const videoRefs = stagedReferences.filter(r => r.mediaType === "video");
        const audioRefs = stagedReferences.filter(r => r.mediaType === "audio");

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
        const refImageUrlsKey = pickSupportedKey(
            props,
            ["referenceImageUrls", "reference_image_urls", "imageUrls", "image_urls"],
            ""
        );
        const refVideoUrlsKey = pickSupportedKey(
            props,
            ["referenceVideoUrls", "reference_video_urls", "videoUrls", "video_urls", "referenceVideos", "reference_videos"],
            ""
        );
        const refAudioArrayKey = pickSupportedKey(
            props,
            [
                "referenceAudioAssets",
                "reference_audio_assets",
                "audioAssets",
                "audio_assets",
                "referenceAudioUrls",
                "reference_audio_urls",
                "audioUrls",
                "audio_urls",
                "referenceAudios",
                "reference_audios"
            ],
            ""
        );
        const refAudioSingleKey = pickSupportedKey(
            props,
            [
                "audioAsset",
                "audio_asset",
                "audioAssetId",
                "audio_asset_id",
                "referenceAudioUrl",
                "reference_audio_url",
                "audioUrl",
                "audio_url",
                "soundtrackAssetId",
                "voiceoverAssetId"
            ],
            ""
        );

        let audioHandledSeparately = false;
        if (audioRefs.length > 0) {
            if (refAudioArrayKey && props?.[refAudioArrayKey]) {
                target[refAudioArrayKey] = buildReferenceAssetsValue(props[refAudioArrayKey], rootSchema, audioRefs);
                audioHandledSeparately = true;
            } else if (refAudioSingleKey && props?.[refAudioSingleKey]) {
                target[refAudioSingleKey] = buildFrameFieldValue(props[refAudioSingleKey], rootSchema, audioRefs[0]);
                audioHandledSeparately = true;
            }
        }

        const refsForSharedArray = (() => {
            if (!audioRefs.length) return stagedReferences;
            if (!refKey || !props?.[refKey]) return stagedReferences;
            const refItemObj = resolveObjectSchema(resolveArrayItemSchema(props[refKey], rootSchema), rootSchema);
            const refItemProps = refItemObj.properties;
            const roleKey = pickSupportedKey(refItemProps, ["role", "kind", "type", "usage", "mediaType", "media_type"], "");
            if (roleKey && refItemObj.required.includes(roleKey)) {
                const allowedRoles = extractAllowedValues(refItemProps[roleKey], rootSchema);
                const audioRoleAllowed = matchEnumCaseInsensitive(
                    ["audio", "reference", "sound", "music", "voice", "soundtrack", "voiceover", "media", "asset"],
                    allowedRoles
                );
                if (allowedRoles.length > 0 && audioRoleAllowed === null && audioHandledSeparately) {
                    return stagedReferences.filter(r => r.mediaType !== "audio");
                }
            }
            return audioHandledSeparately
                ? stagedReferences.filter(r => r.mediaType !== "audio")
                : stagedReferences;
        })();

        if (refKey && props?.[refKey] && refsForSharedArray.length > 0) {
            target[refKey] = buildReferenceAssetsValue(props[refKey], rootSchema, refsForSharedArray);
        } else if (refIdsKey && refsForSharedArray.some(r => r.assetId)) {
            target[refIdsKey] = refsForSharedArray.map(r => r.assetId).filter(Boolean);
        } else if (refImageUrlsKey || refVideoUrlsKey) {
            if (refImageUrlsKey && imageRefs.length > 0) {
                target[refImageUrlsKey] = imageRefs.map(r => r.url).filter(Boolean);
            }
            if (refVideoUrlsKey && videoRefs.length > 0) {
                target[refVideoUrlsKey] = buildReferenceAssetsValue(props[refVideoUrlsKey], rootSchema, videoRefs);
            }
        } else if (!props) {
            target.referenceAssets = stagedReferences.map((r, idx) => {
                const isVideo = r.mediaType === "video";
                const isAudio = r.mediaType === "audio";
                const defaultLabel =
                    r.label ||
                    (isVideo
                        ? `video${idx + 1}`
                        : isAudio
                            ? `audio${idx + 1}`
                            : `image${idx + 1}`);
                return {
                    ...(r.assetId ? { assetId: r.assetId } : { url: r.url }),
                    label: defaultLabel,
                    ...(isVideo ? { mediaType: "video" } : isAudio ? { mediaType: "audio" } : {})
                };
            });
        }
    }
}

function populateTopBatchSharedFields(args, topObj, rootSchema, params) {
    const topProps = topObj?.properties;
    const topReq = Array.isArray(topObj?.required) ? topObj.required : [];
    if (!topProps) return;

    const topModelKey = pickSupportedKey(
        topProps,
        ["model", "videoModel", "video_model", "modelId", "model_id", "providerModel", "modelName"],
        ""
    );
    if (topModelKey && params.opusModel) {
        const allowedTopModels = extractAllowedValues(topProps[topModelKey], rootSchema);
        const matchedTopModel = matchVideoModelValue(params.opusModel, params.modelAliases, allowedTopModels);
        if (matchedTopModel) {
            args[topModelKey] = matchedTopModel;
        }
    }

    const topWorkflowKey = pickSupportedKey(
        topProps,
        ["workflow", "mode", "generationMode", "generation_mode", "route"],
        ""
    );
    if (topWorkflowKey && params.workflow) {
        const allowedWf = extractAllowedValues(topProps[topWorkflowKey], rootSchema);
        args[topWorkflowKey] = matchWorkflowValue(params.workflow, allowedWf);
    }

    applyDurationControls(args, topProps, topReq, rootSchema, params.durationSeconds, "");

    if (params.resolution) {
        const topResKey = pickSupportedKey(
            topProps,
            ["resolution", "videoResolution", "video_resolution", "outputResolution", "quality"],
            ""
        );
        if (topResKey) {
            const allowedRes = extractAllowedValues(topProps[topResKey], rootSchema);
            const matchedRes = matchEnumCaseInsensitive(
                [params.resolution, params.resolution.toLowerCase(), params.resolution.toUpperCase()],
                allowedRes
            );
            if (matchedRes !== null) {
                args[topResKey] = matchedRes;
            }
        }
    }

    const topRatioRequired = topReq.some(k => /^(aspectRatio|aspect_ratio|aspect|ratio)$/i.test(k));
    if ((params.aspectRatio && !params.stagedFirstFrame) || topRatioRequired) {
        const topRatioKey = pickSupportedKey(topProps, ["aspectRatio", "aspect_ratio", "aspect", "ratio"], "");
        if (topRatioKey) {
            const allowedRatios = extractAllowedValues(topProps[topRatioKey], rootSchema);
            const candidates = params.stagedFirstFrame && !params.aspectRatio
                ? ["adaptive", "auto", "9:16", "16:9"]
                : [params.aspectRatio || "9:16"];
            const matchedRatio = matchEnumCaseInsensitive(candidates, allowedRatios);
            if (matchedRatio !== null) {
                args[topRatioKey] = matchedRatio;
            }
        }
    }

    if (typeof params.generateAudio === "boolean") {
        const topAudioKey = pickSupportedKey(
            topProps,
            ["generateAudio", "generate_audio", "withAudio", "with_audio", "enableAudio", "audio"],
            ""
        );
        if (topAudioKey && schemaTypeIncludes(topProps[topAudioKey], rootSchema, "boolean")) {
            args[topAudioKey] = params.generateAudio;
        }
    }
}

function summarizeBuiltVideoArgs(toolName, args, topObj, itemObj) {
    if (!args || typeof args !== "object") return null;
    const batchKey = ["clips", "videos", "items", "shots", "requests", "tasks", "generations"].find(
        k => Array.isArray(args[k]) && args[k].length > 0
    );
    const clip = batchKey ? args[batchKey][0] : args;
    const durEntry = clip && typeof clip === "object"
        ? Object.entries(clip).find(([k]) => /(duration|length|seconds)/i.test(k))
        : null;
    const nestedDurEntry =
        !durEntry && clip && typeof clip === "object"
            ? Object.values(clip)
                  .filter(v => v && typeof v === "object" && !Array.isArray(v))
                  .flatMap(v => Object.entries(v))
                  .find(([k]) => /(duration|length|seconds)/i.test(k))
            : null;
    const chosenDur = durEntry || nestedDurEntry;

    return {
        tool: toolName || "",
        batchKey: batchKey || null,
        topKeys: Object.keys(args),
        clipKeys: clip && typeof clip === "object" ? Object.keys(clip) : [],
        durationKey: chosenDur ? chosenDur[0] : null,
        durationValue: chosenDur ? chosenDur[1] : null,
        model: clip?.model ?? clip?.videoModel ?? args?.model ?? null,
        workflow: clip?.workflow ?? clip?.mode ?? args?.workflow ?? null,
        resolution: clip?.resolution ?? clip?.quality ?? args?.resolution ?? null,
        generateAudio: clip?.generateAudio ?? clip?.generate_audio ?? args?.generateAudio ?? null,
        hasFirstFrame: Boolean(
            clip?.firstFrame || clip?.first_frame || clip?.firstFrameAssetId || clip?.firstFrameUrl
        ),
        hasReferenceAssets: Boolean(
            (Array.isArray(clip?.referenceAssets) && clip.referenceAssets.length > 0) ||
            (Array.isArray(clip?.reference_assets) && clip.reference_assets.length > 0)
        ),
        schemaTopKeys: topObj?.properties ? Object.keys(topObj.properties) : [],
        schemaClipKeys: itemObj?.properties ? Object.keys(itemObj.properties) : []
    };
}

function stripRequestKeysForComparison(obj) {
    if (!obj || typeof obj !== "object") return obj;
    if (Array.isArray(obj)) return obj.map(stripRequestKeysForComparison);
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
        if (/^(requestKey|idempotencyKey|request_key|idempotency_key)$/i.test(k)) continue;
        out[k] = stripRequestKeysForComparison(v);
    }
    return out;
}

function buildGenerateVideoClipVariants(videoTool, params) {
    const rootSchema = videoTool?.inputSchema;
    const topObj = resolveObjectSchema(
        rootSchema,
        rootSchema,
        (_raw, resolved) => {
            const p = resolved?.properties || {};
            if (p.clips || p.videos || p.items || p.shots) return 50 + scoreClipSchemaBranch(resolved, rootSchema, params);
            if (p.prompt || p.description) return 20 + scoreClipSchemaBranch(resolved, rootSchema, params);
            return scoreClipSchemaBranch(resolved, rootSchema, params);
        }
    );
    const topProps = topObj.properties;
    const batchArrayKey = pickSupportedKey(
        topProps,
        ["clips", "videos", "items", "shots", "requests", "tasks", "generations"],
        ""
    );

    const variants = [];
    const seenShapes = new Set();

    const pushUniqueVariant = (args, itemObjForSummary = null) => {
        const fingerprint = JSON.stringify(stripRequestKeysForComparison(args));
        if (seenShapes.has(fingerprint)) return;
        seenShapes.add(fingerprint);
        Object.defineProperty(args, "__mcpSummary", {
            value: summarizeBuiltVideoArgs(videoTool?.name, args, topObj, itemObjForSummary || topObj),
            enumerable: false,
            configurable: true
        });
        variants.push(args);
    };

    if (batchArrayKey) {
        const itemSchema = resolveArrayItemSchema(topProps[batchArrayKey], rootSchema);
        const expandedBranches = expandObjectBranches(itemSchema, rootSchema);

        let rankedItemSchemas = [];
        if (expandedBranches.length > 1) {
            rankedItemSchemas = expandedBranches
                .map((b, idx) => ({
                    branch: b,
                    score: scoreClipSchemaBranch(b, rootSchema, params),
                    idx
                }))
                .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.idx - b.idx))
                .map(entry => entry.branch);
        } else {
            const resolvedItem = resolveObjectSchema(
                itemSchema,
                rootSchema,
                (_raw, resolved) => scoreClipSchemaBranch(resolved, rootSchema, params)
            );
            rankedItemSchemas = [resolvedItem];
        }

        const makeBatchArgs = (chosenItemObj, { minimal = false } = {}) => {
            const variantRequestKey = makeUuid();
            const args = {};
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
                args[reqKey] = variantRequestKey;
            }

            populateTopBatchSharedFields(args, topObj, rootSchema, params);

            const clipEntry = {};
            populateClipFields(clipEntry, chosenItemObj, rootSchema, {
                ...params,
                requestKey: variantRequestKey,
                isBatchItem: true,
                minimal
            });
            args[batchArrayKey] = [clipEntry];
            return args;
        };

        const bestBranch = rankedItemSchemas[0];
        pushUniqueVariant(makeBatchArgs(bestBranch, { minimal: false }), bestBranch);

        /* Jika ada cabang union kedua yang juga valid (mis. variasi model/workflow berbeda), siapkan sebagai kandidat ke-2 */
        if (rankedItemSchemas.length > 1) {
            const secondScore = scoreClipSchemaBranch(rankedItemSchemas[1], rootSchema, params);
            if (secondScore >= 0) {
                try {
                    pushUniqueVariant(makeBatchArgs(rankedItemSchemas[1], { minimal: false }), rankedItemSchemas[1]);
                } catch {
                    /* Abaikan cabang alternatif yang menolak model */
                }
            }
        }

        pushUniqueVariant(makeBatchArgs(bestBranch, { minimal: true }), bestBranch);
    } else {
        const makeFlatArgs = ({ minimal = false } = {}) => {
            const variantRequestKey = makeUuid();
            const args = {};
            populateClipFields(args, topObj, rootSchema, {
                ...params,
                requestKey: variantRequestKey,
                isBatchItem: false,
                minimal
            });
            return args;
        };
        pushUniqueVariant(makeFlatArgs({ minimal: false }), topObj);
        pushUniqueVariant(makeFlatArgs({ minimal: true }), topObj);
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
    if (/(?:upload|presign_put|callback|webhook|firstframe|first_frame|lastframe|last_frame|reference|inputvideo|input_video|sourcevideo|source_video|inputasset|input_asset|thumbnail|poster|cover|avatar)/i.test(lowerKey)) {
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

function isLikelyImageOutputUrl(url, keyHint = "", mimeHint = "") {
    const clean = String(url || "").trim();
    if (!clean) return false;
    const lowerKey = String(keyHint || "").toLowerCase();
    if (/(?:upload|presign_put|callback|webhook|firstframe|first_frame|lastframe|last_frame|reference|inputimage|input_image|sourceimage|source_image|inputasset|input_asset|characterimage|character_image|outfitimage|outfit_image|avatar)/i.test(lowerKey)) {
        return false;
    }
    if (/^data:image\/(?:png|jpe?g|webp|avif|gif);base64,[A-Za-z0-9+/=\s]+$/i.test(clean)) {
        return true;
    }
    if (!/^https?:\/\//i.test(clean)) return false;
    const lowerMime = String(mimeHint || "").toLowerCase();
    if (lowerMime.startsWith("video/") || lowerMime.startsWith("audio/")) {
        return false;
    }
    if (lowerMime.startsWith("image/")) {
        return true;
    }
    const pathPart = clean.split("?")[0].split("#")[0].toLowerCase();
    if (/\.(?:mp4|webm|mov|m4v|mp3|wav|m4a|aac|ogg|json|xml|txt|html)$/i.test(pathPart)) {
        return false;
    }
    if (/\.(?:png|jpe?g|webp|avif)$/i.test(pathPart)) {
        return true;
    }
    return /(?:image|keyframe|photo|picture|output|download|render|result|media|signed|asset|cdn|public|file|url|uri)/i.test(lowerKey);
}

function extractImageUrls(rootData, seen = new WeakSet()) {
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
            if (isLikelyImageOutputUrl(node, keyHint, mimeHint)) {
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
            ).trim();

            for (const b64Key of ["b64_json", "base64", "imageBase64", "image_base64", "dataBase64"]) {
                if (typeof node[b64Key] === "string" && node[b64Key].trim().length > 64) {
                    const rawB64 = node[b64Key].trim();
                    if (/^data:image\//i.test(rawB64)) {
                        addUrl(rawB64);
                    } else if (/^[A-Za-z0-9+/=\s]+$/.test(rawB64)) {
                        const safeMime = localMime.startsWith("image/") ? localMime : "image/png";
                        addUrl(`data:${safeMime};base64,${rawB64.replace(/\s+/g, "")}`);
                    }
                }
            }

            const priorityKeys = [
                "imageUrl",
                "image_url",
                "keyframeUrl",
                "keyframe_url",
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
                "mediaUrl",
                "media_url",
                "fileUrl",
                "file_url",
                "cdnUrl",
                "cdn_url",
                "publicUrl",
                "public_url",
                "dataUrl",
                "data_url",
                "url",
                "uri"
            ];

            for (const pk of priorityKeys) {
                if (typeof node[pk] === "string" && isLikelyImageOutputUrl(node[pk], pk, localMime)) {
                    addUrl(node[pk]);
                }
            }

            const outputContainers = [
                "keyframes",
                "images",
                "outputs",
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
                if (/(?:firstFrame|first_frame|lastFrame|last_frame|reference|input|upload|request|character_image|outfit_image)/i.test(k)) {
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

    const nonTerminalDeadline = isOpusNonTerminalWorkerDeadline(
        errorCode,
        rawErrorMessage,
        rawText
    );
    const egressJobId = nonTerminalDeadline
        ? extractOpusEgressJobId(rawErrorMessage, rawText)
        : "";

    let status = normalizeStatus(rawState);
    if (nonTerminalDeadline && status !== "COMPLETED") {
        /*
         * Worker internal MCP Opus menghentikan polling setelah ~12 menit
         * ("Egress video job <uuid> is still non-terminal after the worker polling deadline"),
         * sementara job Egress di Opus Web masih berjalan dan tetap menghasilkan klip
         * saat render selesai. Jangan tandai FAILED; tetap ekstrak videoUrls bila
         * aset sudah muncul, atau laporkan PROCESSING untuk rekonsiliasi resolve_job/list_jobs.
         */
        status = "PROCESSING";
    } else if (
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
            /* Filter sibling assets agar aset input/reference (@image1, @video1, @audio1, dll.) tidak ikut diekstrak */
            let sanitizedSource = focus || parsedSource;
            if (sanitizedSource && typeof sanitizedSource === "object" && Array.isArray(sanitizedSource.assets)) {
                const filteredAssets = sanitizedSource.assets.filter(a => {
                    if (!a || typeof a !== "object") return true;
                    const role = String(a.role || a.source || a.origin || "").toLowerCase();
                    const kind = String(a.kind || a.mediaType || "").toLowerCase();
                    const label = String(a.label || a.name || "").toLowerCase();
                    if (/^(?:reference|first_frame|last_frame|input|subject|style|import|imported|upload|uploaded)$/.test(role)) {
                        return false;
                    }
                    if (/^(?:reference|first_frame|last_frame|input|subject|style|audio)$/.test(kind)) {
                        return false;
                    }
                    if (/^(?:image\d+|video\d+|audio\d+|first_frame|last_frame|ref_\d+|reference_\d+)$/.test(label)) {
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
    const activeNonTerminalDeadline = nonTerminalDeadline && status !== "COMPLETED";

    return {
        status,
        rawState: activeNonTerminalDeadline ? "processing" : (rawState || status.toLowerCase()),
        videoUrls,
        usageSeconds,
        errorCode: status === "FAILED" ? (errorCode || "OPUS_TASK_FAILED") : null,
        errorMessage: status === "FAILED" ? translateOpusError(errorCode, rawErrorMessage) : null,
        nonTerminalDeadline: activeNonTerminalDeadline,
        deadlineErrorCode: activeNonTerminalDeadline ? (errorCode || "OPUS_WORKER_POLLING_DEADLINE") : null,
        deadlineErrorMessage: activeNonTerminalDeadline
            ? (rawErrorMessage || translateOpusError(errorCode, rawText))
            : null,
        egressJobId: egressJobId || null
    };
}

export function isOpusNonTerminalWorkerDeadline(code, message = "", rawText = "") {
    const normalizedCode = String(code || "").trim().toLowerCase();
    if (
        normalizedCode === "worker_polling_deadline" ||
        normalizedCode === "egress_still_running" ||
        normalizedCode === "egress_non_terminal"
    ) {
        return true;
    }
    const combined = `${code || ""} ${message || ""} ${rawText || ""}`;
    return (
        /\bstill\s+non-?terminal\b/i.test(combined) ||
        /\bnon-?terminal\s+after\b.*\bpolling\s+deadline\b/i.test(combined) ||
        /\bafter\s+the\s+worker\s+polling\s+deadline\b/i.test(combined)
    );
}

export function extractOpusEgressJobId(message = "", rawText = "") {
    const combined = `${message || ""} ${rawText || ""}`;
    const match = combined.match(
        /\begress\s+(?:[a-z0-9_-]+\s+)?job\s+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[a-z0-9_-]{8,})\b/i
    );
    return match ? String(match[1]).trim() : "";
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

    /* Probe get_project / list_assets bila tersedia di MCP untuk membaca aset hasil yang baru terbit */
    const projectAssetTool =
        findMcpTool(session.tools, "get_project") ||
        findMcpTool(session.tools, "list_assets") ||
        findMcpTool(session.tools, "get_project_state");

    if (projectAssetTool) {
        const rootSchema = projectAssetTool.inputSchema;
        const objSchema = resolveObjectSchema(rootSchema, rootSchema);
        const props = objSchema.properties;
        const required = Array.isArray(objSchema.required) ? objSchema.required : [];
        const projKey = pickSupportedKey(props, ["projectId", "project_id", "id"], !props ? "projectId" : "");
        const hasOtherRequired = required.some(k => k !== projKey);

        if (projKey && !hasOtherRequired) {
            const projRes = await session.callTool(projectAssetTool.name, { [projKey]: projectId }).catch(() => null);
            if (projRes && !projRes.isError) {
                const projOutcome = inspectJobOutcome(projRes.data, projRes.text, targetJobId);
                if (projOutcome.videoUrls.length > 0) {
                    return {
                        jobId: targetJobId || "",
                        outcome: projOutcome,
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

async function createVideoTaskForSingleKey(payload = {}, apiKey, options = {}) {
    const endpoint = getMcpEndpoint(options);
    const keySlot = Number.isInteger(options?.keySlot) && options.keySlot > 0 ? options.keySlot : 0;
    const mediaCache = options?.mediaCache instanceof Map ? options.mediaCache : null;
    const isolateFromDefaultRefresh = Boolean(options?.isolateFromDefaultRefresh);
    const session = await openMcpSession({
        endpoint,
        apiKey,
        timeoutMs: CREATE_TIMEOUT_MS,
        includeTools: true,
        isolateFromDefaultRefresh,
        env: options?.env || null
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
    const referenceVideoUrls = Array.isArray(payload.reference_video_urls)
        ? payload.reference_video_urls.map(u => String(u || "").trim()).filter(Boolean).slice(0, MAX_REFERENCE_VIDEOS)
        : Array.isArray(payload.video_urls)
            ? payload.video_urls.map(u => String(u || "").trim()).filter(Boolean).slice(0, MAX_REFERENCE_VIDEOS)
            : [];
    const referenceAudioUrls = Array.isArray(payload.reference_audio_urls)
        ? payload.reference_audio_urls.map(u => String(u || "").trim()).filter(Boolean).slice(0, MAX_REFERENCE_AUDIOS)
        : Array.isArray(payload.audio_urls)
            ? payload.audio_urls.map(u => String(u || "").trim()).filter(Boolean).slice(0, MAX_REFERENCE_AUDIOS)
            : String(payload.audio_url || payload.reference_audio_url || "").trim()
                ? [String(payload.audio_url || payload.reference_audio_url || "").trim()]
                : [];
    const referenceVideoUrlSet = new Set([...referenceVideoUrls, ...referenceAudioUrls]);

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
                mediaType: "image",
                fileName: `first-frame.${extFromMime(mime)}`,
                mediaCache
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
                    mediaType: "image",
                    fileName: `last-frame.${extFromMime(lastMime)}`,
                    mediaCache
                },
                1
            );
        }
    } else if (referenceUrls.length > 0 || referenceVideoUrls.length > 0 || referenceAudioUrls.length > 0) {
        let assetOffset = 0;
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
                    mediaType: "image",
                    fileName: `reference-${i + 1}.${extFromMime(mime)}`,
                    mediaCache
                },
                assetOffset
            );
            stagedReferences.push(staged);
            assetOffset += 1;
        }
        for (let j = 0; j < referenceVideoUrls.length; j += 1) {
            const url = referenceVideoUrls[j];
            const mime = inferVideoMimeFromUrl(url);
            const staged = await stageSingleReferenceImage(
                session,
                importTool,
                projectId,
                {
                    url,
                    role: "reference",
                    label: `video${j + 1}`,
                    mimeType: mime,
                    mediaType: "video",
                    fileName: `reference-video-${j + 1}.${extFromMime(mime)}`,
                    mediaCache
                },
                assetOffset
            );
            stagedReferences.push(staged);
            assetOffset += 1;
        }
        for (let k = 0; k < referenceAudioUrls.length; k += 1) {
            const url = referenceAudioUrls[k];
            const mime = inferAudioMimeFromUrl(url);
            const staged = await stageSingleReferenceImage(
                session,
                importTool,
                projectId,
                {
                    url,
                    role: "reference",
                    label: `audio${k + 1}`,
                    mimeType: mime,
                    mediaType: "audio",
                    fileName: `reference-audio-${k + 1}.${extFromMime(mime)}`,
                    mediaCache
                },
                assetOffset
            );
            stagedReferences.push(staged);
            assetOffset += 1;
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
    let acceptedVariant = argVariants[0] || null;

    for (let idx = 0; idx < argVariants.length; idx += 1) {
        let variantAccepted = false;
        for (let sameKeyAttempt = 0; sameKeyAttempt < 2; sameKeyAttempt += 1) {
            try {
                acceptedVariant = argVariants[idx];
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

    const mcpRequestSummary = acceptedVariant?.__mcpSummary || null;

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
                outputUrls: discoveredDuringTimeout.outcome.videoUrls,
                mcpRequestSummary
            };
        }
        if (discoveredDuringTimeout.jobId) {
            const compositeTaskId = encodeOpusTaskId(projectId, discoveredDuringTimeout.jobId, keySlot);
            return {
                success: true,
                provider: PROVIDER_ID,
                providerName: PROVIDER_NAME,
                taskId: compositeTaskId,
                task_id: compositeTaskId,
                jobId: discoveredDuringTimeout.jobId,
                projectId,
                keySlot,
                status: discoveredDuringTimeout.outcome?.status === "COMPLETED" ? "COMPLETED" : "QUEUED",
                outputUrls: discoveredDuringTimeout.outcome?.videoUrls || [],
                mcpRequestSummary
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
    if (referenceVideoUrlSet.size > 0 && Array.isArray(outcome.videoUrls) && outcome.videoUrls.length > 0) {
        outcome = {
            ...outcome,
            videoUrls: outcome.videoUrls.filter(url => !referenceVideoUrlSet.has(url))
        };
    }
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
        const compositeTaskId = encodeOpusTaskId(projectId, jobId, keySlot);
        return {
            success: true,
            provider: PROVIDER_ID,
            providerName: PROVIDER_NAME,
            taskId: compositeTaskId,
            task_id: compositeTaskId,
            jobId,
            projectId,
            keySlot,
            status: outcome.status === "COMPLETED" ? "COMPLETED" : "QUEUED",
            outputUrls: outcome.videoUrls,
            mcpRequestSummary
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
            keySlot,
            status: "COMPLETED",
            outputUrls: outcome.videoUrls,
            mcpRequestSummary
        };
    }

    /*
     * Jika generate_video_clips sudah sukses diterima di bawah projectId unik
     * namun jobId baru muncul beberapa detik kemudian di list_jobs (eventual consistency),
     * kembalikan taskId berbasis proyek agar /api/generate-status terus memantau proyek tersebut
     * alih-alih menggagalkan task padahal video sedang digenerate di web Opus.
     */
    if (projectId) {
        const pendingProjectTaskId = encodeOpusTaskId(projectId, PROJECT_PENDING_JOB_ID, keySlot);
        return {
            success: true,
            provider: PROVIDER_ID,
            providerName: PROVIDER_NAME,
            taskId: pendingProjectTaskId,
            task_id: pendingProjectTaskId,
            jobId: PROJECT_PENDING_JOB_ID,
            projectId,
            keySlot,
            status: "QUEUED",
            outputUrls: [],
            mcpRequestSummary
        };
    }

    throw createProviderError({
        message: "Opus Labs tidak mengembalikan jobId video yang valid.",
        code: "MISSING_TASK_ID",
        status: 502,
        raw: lastCallResult.data
    });
}

function normalizeExcludedSlotSet(rawList, totalKeys) {
    const set = new Set();
    if (!Array.isArray(rawList) || totalKeys <= 1) {
        return set;
    }
    for (const item of rawList) {
        const parsed = Number(item);
        if (Number.isInteger(parsed) && parsed >= 0 && parsed < totalKeys) {
            set.add(parsed);
        }
    }
    return set;
}

async function createVideoTask(payload = {}, apiKey, options = {}) {
    const keyPool = extractOpusApiKeyPool(apiKey, options?.env);
    if (keyPool.length === 0) {
        /* Memicu error MISSING_API_KEY standar bila tidak ada kredensial sama sekali */
        parseApiKeyInput("", options?.env);
    }

    const totalKeys = keyPool.length;
    const mediaCache = new Map();

    if (totalKeys <= 1) {
        activeOpusKeyIndex = 0;
        try {
            const singleRes = await createVideoTaskForSingleKey(payload, keyPool[0] || apiKey, {
                ...options,
                keySlot: 0,
                mediaCache,
                isolateFromDefaultRefresh: false
            });
            return {
                ...singleRes,
                keySlot: 0,
                keyPoolSize: 1
            };
        } catch (err) {
            if (isOpusCreditExhaustedError(err)) {
                err.opusFailedKeySlot = 0;
                err.opusKeyPoolSize = 1;
                err.exhaustedKeyCount = 1;
                err.rotatedFullCycle = true;
            }
            throw err;
        }
    }

    const excludedSet = normalizeExcludedSlotSet(
        options?.excludeKeySlots ?? payload?.opus_exclude_key_slots,
        totalKeys
    );
    const startIndex = ((activeOpusKeyIndex % totalKeys) + totalKeys) % totalKeys;
    const candidateSlots = [];
    for (let step = 0; step < totalKeys; step += 1) {
        const slotIndex = (startIndex + step) % totalKeys;
        if (!excludedSet.has(slotIndex)) {
            candidateSlots.push(slotIndex);
        }
    }
    /* Jika semua slot masuk daftar exclude (siklus baru), putar penuh dari awal */
    if (candidateSlots.length === 0) {
        for (let step = 0; step < totalKeys; step += 1) {
            candidateSlots.push((startIndex + step) % totalKeys);
        }
    }

    let lastExhaustedError = null;
    let lastExhaustedSlot = candidateSlots[0] ?? 0;
    let lastAuthError = null;

    for (let idx = 0; idx < candidateSlots.length; idx += 1) {
        const slotIndex = candidateSlots[idx];
        const candidateKey = keyPool[slotIndex];

        try {
            const result = await createVideoTaskForSingleKey(payload, candidateKey, {
                ...options,
                keySlot: slotIndex,
                mediaCache,
                isolateFromDefaultRefresh: slotIndex > 0 || totalKeys > 1
            });
            activeOpusKeyIndex = slotIndex;
            return {
                ...result,
                keySlot: slotIndex,
                keyPoolSize: totalKeys
            };
        } catch (err) {
            if (isOpusCreditExhaustedError(err)) {
                lastExhaustedError = err;
                lastExhaustedSlot = slotIndex;
                if (idx + 1 < candidateSlots.length) {
                    continue;
                }
                /* Seluruh kandidat API key pada putaran ini sudah dicoba berurutan */
                activeOpusKeyIndex = 0;
                err.opusFailedKeySlot = slotIndex;
                err.opusKeyPoolSize = totalKeys;
                err.exhaustedKeyCount = totalKeys;
                err.rotatedFullCycle = true;
                throw err;
            }

            const isAuthFailure =
                err?.status === 401 ||
                err?.status === 403 ||
                err?.code === "OPUS_AUTH_EXPIRED" ||
                err?.code === "OPUS_AUTH_REJECTED";

            if (isAuthFailure && idx + 1 < candidateSlots.length) {
                lastAuthError = err;
                continue;
            }

            if (isAuthFailure && lastExhaustedError) {
                activeOpusKeyIndex = 0;
                lastExhaustedError.opusFailedKeySlot = lastExhaustedSlot;
                lastExhaustedError.opusKeyPoolSize = totalKeys;
                lastExhaustedError.exhaustedKeyCount = totalKeys;
                lastExhaustedError.rotatedFullCycle = true;
                throw lastExhaustedError;
            }

            throw err;
        }
    }

    activeOpusKeyIndex = 0;
    throw lastExhaustedError || lastAuthError || createProviderError({
        message: "Semua API key Opus gagal memproses permintaan.",
        code: "OPUS_CREATE_REJECTED",
        status: 503
    });
}

async function getVideoTaskForSingleKey(parsedId, apiKey, options = {}) {

    const endpoint = getMcpEndpoint(options);
    const session = await openMcpSession({
        endpoint,
        apiKey,
        timeoutMs: QUERY_TIMEOUT_MS,
        includeTools: true,
        isolateFromDefaultRefresh: Boolean(options?.isolateFromDefaultRefresh),
        env: options?.env || null
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
    } else if (statusRes.isError && outcome.status !== "COMPLETED" && !outcome.nonTerminalDeadline) {
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
     * Rekonsiliasi khusus saat worker internal MCP Opus melewati polling deadline (~12 menit):
     * "Egress video job <egressId> is still non-terminal after the worker polling deadline"
     * Job Egress di Opus Web masih berjalan atau sudah menyelesaikan aset di proyek.
     * Panggil resolve_job + list_jobs untuk mengambil hasil begitu selesai tanpa memutus ke FAILED.
     */
    if (outcome.nonTerminalDeadline && outcome.videoUrls.length === 0) {
        const resolveTool = findMcpTool(session.tools, "resolve_job");
        if (resolveTool) {
            const candidateJobIds = [activeJobId];
            if (outcome.egressJobId && outcome.egressJobId !== activeJobId) {
                candidateJobIds.push(outcome.egressJobId);
            }
            for (const candidateJobId of candidateJobIds) {
                const resolvedRes = await session
                    .callTool(
                        resolveTool.name,
                        buildResolveJobArgs(resolveTool, parsedId.projectId, candidateJobId)
                    )
                    .catch(() => null);
                if (!resolvedRes || resolvedRes.isError) {
                    continue;
                }
                const resolvedOutcome = inspectJobOutcome(
                    resolvedRes.data,
                    resolvedRes.text,
                    candidateJobId
                );
                if (resolvedOutcome.videoUrls.length > 0) {
                    outcome = {
                        ...resolvedOutcome,
                        status: "COMPLETED",
                        nonTerminalDeadline: false,
                        deadlineErrorCode: null,
                        deadlineErrorMessage: null
                    };
                    break;
                }
                if (resolvedOutcome.status === "COMPLETED") {
                    outcome = {
                        ...resolvedOutcome,
                        nonTerminalDeadline: false,
                        deadlineErrorCode: null,
                        deadlineErrorMessage: null
                    };
                    break;
                }
                if (
                    candidateJobId === activeJobId &&
                    resolvedOutcome.status === "FAILED" &&
                    !resolvedOutcome.nonTerminalDeadline &&
                    !isTransientNotFoundError(
                        resolvedOutcome.errorCode,
                        resolvedOutcome.errorMessage,
                        resolvedRes.text
                    )
                ) {
                    outcome = resolvedOutcome;
                    break;
                }
            }
        }

        if (outcome.videoUrls.length === 0 && outcome.status !== "FAILED" && parsedId.projectId) {
            const listed = await discoverProjectVideoJob(session, parsedId.projectId, {
                targetJobId: activeJobId,
                retries: 0
            });
            if (listed.outcome?.videoUrls?.length > 0) {
                outcome = {
                    ...listed.outcome,
                    status: "COMPLETED",
                    nonTerminalDeadline: false,
                    deadlineErrorCode: null,
                    deadlineErrorMessage: null
                };
            } else if (
                listed.outcome?.status === "FAILED" &&
                !listed.outcome.nonTerminalDeadline &&
                !isTransientNotFoundError(
                    listed.outcome.errorCode,
                    listed.outcome.errorMessage,
                    ""
                )
            ) {
                outcome = listed.outcome;
            }
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
                nonTerminalDeadline: false,
                deadlineErrorCode: null,
                deadlineErrorMessage: null,
                egressJobId: outcome.egressJobId || null,
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
        nonTerminalDeadline: Boolean(outcome.nonTerminalDeadline),
        deadlineErrorCode: outcome.deadlineErrorCode || null,
        deadlineErrorMessage: outcome.deadlineErrorMessage || null,
        egressJobId: outcome.egressJobId || null,
        projectId: parsedId.projectId,
        jobId: activeJobId
    };
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

    const keyPool = extractOpusApiKeyPool(apiKey, options?.env);
    if (keyPool.length <= 1) {
        const singleStatus = await getVideoTaskForSingleKey(parsedId, keyPool[0] || apiKey, {
            ...options,
            isolateFromDefaultRefresh: false
        });
        return {
            ...singleStatus,
            keySlot: 0,
            keyPoolSize: Math.max(1, keyPool.length)
        };
    }

    const totalKeys = keyPool.length;
    const preferredSlot = parsedId.keySlot >= 0 && parsedId.keySlot < totalKeys
        ? parsedId.keySlot
        : 0;
    const candidateSlots = [preferredSlot];
    for (let idx = 0; idx < totalKeys; idx += 1) {
        if (idx !== preferredSlot) {
            candidateSlots.push(idx);
        }
    }

    let lastError = null;
    for (let c = 0; c < candidateSlots.length; c += 1) {
        const slotIndex = candidateSlots[c];
        try {
            const result = await getVideoTaskForSingleKey(parsedId, keyPool[slotIndex], {
                ...options,
                isolateFromDefaultRefresh: true
            });
            if (
                result.status === "FAILED" &&
                isOpusCreditExhaustedError({
                    code: result.errorCode,
                    message: result.errorMessage
                })
            ) {
                activeOpusKeyIndex = (slotIndex + 1) % totalKeys;
            }
            return {
                ...result,
                keySlot: slotIndex,
                keyPoolSize: totalKeys
            };
        } catch (err) {
            lastError = err;
            const retryableOnOtherSlot =
                err?.status === 401 ||
                err?.status === 403 ||
                err?.code === "OPUS_AUTH_EXPIRED" ||
                err?.code === "OPUS_AUTH_REJECTED";
            if (retryableOnOtherSlot && c + 1 < candidateSlots.length) {
                continue;
            }
            throw err;
        }
    }

    throw lastError || createProviderError({
        message: "Gagal memeriksa status job video Opus Labs.",
        code: "OPUS_STATUS_FAILED",
        status: 502
    });
}

/* =========================================================
   PUBLIC CLIENT API: createImageTask & getImageTask
========================================================= */

function matchImageModelValue(wantedModel, modelAliases = [], allowedValues = []) {
    const cleanWanted = String(wantedModel || "").trim();
    const candidates = [
        cleanWanted,
        ...(Array.isArray(modelAliases) ? modelAliases : [])
    ]
        .map(v => String(v || "").trim())
        .filter(Boolean);

    if (!allowedValues.length) {
        return candidates[0] || "";
    }

    const exactHit = matchEnumCaseInsensitive(candidates, allowedValues);
    if (exactHit !== null) {
        return exactHit;
    }

    for (const candidate of candidates) {
        const bare = candidate.includes("/") ? candidate.split("/").pop() : candidate;
        const compactBare = normalizeCompactToken(bare);
        if (!compactBare) continue;
        const suffixHit = allowedValues.find(v => {
            const str = String(v || "");
            const vBare = str.includes("/") ? str.split("/").pop() : str;
            return normalizeCompactToken(vBare) === compactBare;
        });
        if (suffixHit !== undefined) {
            return suffixHit;
        }
    }

    /* Pencocokan keluarga model terdekat bila nama varian minor berbeda di live MCP enum */
    for (const candidate of candidates) {
        const lower = candidate.toLowerCase();
        if (lower.includes("flare")) {
            const flareHit = allowedValues.find(v => /flare/i.test(String(v)));
            if (flareHit !== undefined) return flareHit;
        }
        if (lower.includes("sunburst")) {
            const sunburstHit = allowedValues.find(v => /sunburst/i.test(String(v)));
            if (sunburstHit !== undefined) return sunburstHit;
        }
        if (lower.includes("gpt-image")) {
            const gptHit = allowedValues.find(v => /gpt[-_]?image/i.test(String(v)));
            if (gptHit !== undefined) return gptHit;
        }
        if (lower.includes("seedream")) {
            const seedreamHit = allowedValues.find(v => /seedream/i.test(String(v)));
            if (seedreamHit !== undefined) return seedreamHit;
        }
        if (lower.includes("nano-banana-pro")) {
            const nbProHit = allowedValues.find(v => /nano[-_]?banana[-_]?pro|gemini[-_]?3[-_]?pro[-_]?image/i.test(String(v)));
            if (nbProHit !== undefined) return nbProHit;
        }
        if (lower.includes("nano-banana")) {
            const nbHit = allowedValues.find(v => /nano[-_]?banana|gemini.*image/i.test(String(v)));
            if (nbHit !== undefined) return nbHit;
        }
    }

    return null;
}

function populateKeyframeFields(target, objectSchema, rootSchema, {
    prompt,
    opusModel,
    modelAliases,
    aspectRatio,
    stagedReferences,
    projectId,
    requestKey,
    isBatchItem = false,
    minimal = false
}) {
    const props = objectSchema?.properties;
    const required = Array.isArray(objectSchema?.required) ? objectSchema.required : [];

    if (isBatchItem) {
        const kfIdKey = pickSupportedKey(
            props,
            ["keyframeId", "keyframe_id", "imageId", "image_id", "itemId", "item_id", "id"],
            !props ? "id" : ""
        );
        if (kfIdKey) {
            target[kfIdKey] = props?.[kfIdKey]?.format === "uuid" ? makeUuid() : "kf-1";
        }
    } else {
        const reqKfId = ["keyframeId", "keyframe_id", "imageId", "image_id", "itemId", "item_id", "id"].find(
            k => props && Object.prototype.hasOwnProperty.call(props, k) && required.includes(k)
        );
        if (reqKfId) {
            target[reqKfId] = props[reqKfId]?.format === "uuid" ? makeUuid() : "kf-1";
        }
    }

    const labelKey = pickSupportedKey(props, ["outputLabel", "output_label", "label", "title", "name"], "");
    if (
        labelKey &&
        target[labelKey] === undefined &&
        (required.includes(labelKey) ||
            /outputlabel|output_label/i.test(labelKey) ||
            (isBatchItem && !minimal))
    ) {
        target[labelKey] = "kf-1";
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
            [
                "model",
                "imageModel",
                "image_model",
                "keyframeModel",
                "keyframe_model",
                "modelId",
                "model_id",
                "providerModel",
                "provider_model",
                "modelName",
                "model_name",
                "engine"
            ],
            !props ? "model" : ""
        );
        if (modelKey) {
            const allowedModels = extractAllowedValues(props?.[modelKey], rootSchema);
            const matchedModel = matchImageModelValue(opusModel, modelAliases, allowedModels);
            if (matchedModel !== null && matchedModel !== "") {
                target[modelKey] = matchedModel;
            } else if (allowedModels.length > 0) {
                throw createProviderError({
                    message: `Model gambar "${opusModel}" tidak tersedia di akun Opus Labs saat ini (tersedia: ${allowedModels.join(", ")}).`,
                    code: "model_unavailable",
                    providerCode: "model_unavailable",
                    status: 422
                });
            }
        }
    }

    if (aspectRatio) {
        const ratioKey = pickSupportedKey(
            props,
            ["aspectRatio", "aspect_ratio", "ratio", "format", "dimensions"],
            !props ? "aspectRatio" : ""
        );
        if (ratioKey && (!minimal || required.includes(ratioKey) || !props)) {
            const allowedRatios = extractAllowedValues(props?.[ratioKey], rootSchema);
            const matchedRatio = matchEnumCaseInsensitive([aspectRatio], allowedRatios);
            if (matchedRatio !== null) {
                target[ratioKey] = matchedRatio;
            } else if (!allowedRatios.length) {
                target[ratioKey] = aspectRatio;
            }
        }
    }

    const wfKey = pickSupportedKey(
        props,
        ["workflow", "mode", "generationMode", "generation_mode", "type"],
        ""
    );
    if (wfKey && required.includes(wfKey)) {
        const allowedWf = extractAllowedValues(props[wfKey], rootSchema);
        const hasRefs = Array.isArray(stagedReferences) && stagedReferences.length > 0;
        const wfCandidates = hasRefs
            ? ["image2image", "image_to_image", "i2i", "reference2image", "reference_to_image", "keyframe", "text2image", "text_to_image", "t2i"]
            : ["text2image", "text_to_image", "t2i", "keyframe", "image"];
        const matchedWf = matchEnumCaseInsensitive(wfCandidates, allowedWf);
        if (matchedWf !== null) {
            target[wfKey] = matchedWf;
        }
    }

    if (Array.isArray(stagedReferences) && stagedReferences.length > 0) {
        const refKey = pickSupportedKey(
            props,
            [
                "referenceAssets",
                "reference_assets",
                "references",
                "assets",
                "inputAssets",
                "input_assets",
                "referenceImages",
                "reference_images"
            ],
            !props ? "referenceAssets" : ""
        );
        const refIdsKey = pickSupportedKey(
            props,
            ["referenceAssetIds", "reference_asset_ids", "assetIds", "asset_ids", "inputAssetIds"],
            ""
        );
        const refImageUrlsKey = pickSupportedKey(
            props,
            ["referenceImageUrls", "reference_image_urls", "imageUrls", "image_urls", "images"],
            ""
        );
        const singleImageKey = stagedReferences.length === 1
            ? pickSupportedKey(props, ["imageAsset", "image_asset", "imageAssetId", "image_asset_id", "imageUrl", "image_url"], "")
            : "";

        if (refKey && props?.[refKey]) {
            target[refKey] = buildReferenceAssetsValue(props[refKey], rootSchema, stagedReferences);
        } else if (refIdsKey && stagedReferences.some(r => r.assetId)) {
            target[refIdsKey] = stagedReferences.map(r => r.assetId).filter(Boolean);
        } else if (refImageUrlsKey) {
            target[refImageUrlsKey] = stagedReferences.map(r => r.url).filter(Boolean);
        } else if (singleImageKey && props?.[singleImageKey]) {
            target[singleImageKey] = buildFrameFieldValue(props[singleImageKey], rootSchema, stagedReferences[0]);
        } else if (!props) {
            target.referenceAssets = stagedReferences.map((r, idx) => ({
                ...(r.assetId ? { assetId: r.assetId } : { url: r.url }),
                label: r.label || `image${idx + 1}`,
                role: r.role || "reference"
            }));
        }
    }
}

function buildGenerateKeyframeVariants(keyframeTool, params) {
    const rootSchema = keyframeTool?.inputSchema;
    const topObj = resolveObjectSchema(
        rootSchema,
        rootSchema,
        (_raw, resolved) => {
            const p = resolved?.properties || {};
            if (p.keyframes || p.images || p.items) return 50;
            if (p.prompt || p.description) return 20;
            return 0;
        }
    );
    const topProps = topObj.properties;
    const batchArrayKey = pickSupportedKey(
        topProps,
        ["keyframes", "images", "items", "requests", "tasks", "generations"],
        !topProps ? "keyframes" : ""
    );

    const variants = [];
    const seenShapes = new Set();

    const pushUniqueVariant = args => {
        const fingerprint = JSON.stringify(stripRequestKeysForComparison(args));
        if (seenShapes.has(fingerprint)) return;
        seenShapes.add(fingerprint);
        variants.push(args);
    };

    if (batchArrayKey) {
        const itemSchema = topProps?.[batchArrayKey]
            ? resolveArrayItemSchema(topProps[batchArrayKey], rootSchema)
            : null;
        const expandedBranches = itemSchema ? expandObjectBranches(itemSchema, rootSchema) : [];
        const candidateItemObjs = expandedBranches.length > 0
            ? expandedBranches
            : [itemSchema ? resolveObjectSchema(itemSchema, rootSchema) : { properties: null, required: [], raw: null }];

        for (const minimal of [false, true]) {
            for (const itemObj of candidateItemObjs) {
                const args = {};
                const projKey = pickSupportedKey(
                    topProps,
                    ["projectId", "project_id"],
                    !topProps && params.projectId ? "projectId" : ""
                );
                if (projKey && params.projectId) {
                    args[projKey] = params.projectId;
                }
                const reqKey = pickSupportedKey(
                    topProps,
                    ["requestKey", "idempotencyKey", "request_key", "idempotency_key"],
                    !topProps ? "requestKey" : ""
                );
                if (reqKey) {
                    args[reqKey] = makeUuid();
                }

                if (topProps) {
                    const topModelKey = pickSupportedKey(
                        topProps,
                        ["model", "imageModel", "image_model", "keyframeModel", "modelId", "model_id"],
                        ""
                    );
                    if (topModelKey && params.opusModel) {
                        const allowedTopModels = extractAllowedValues(topProps[topModelKey], rootSchema);
                        const matchedTop = matchImageModelValue(params.opusModel, params.modelAliases, allowedTopModels);
                        if (matchedTop) {
                            args[topModelKey] = matchedTop;
                        }
                    }
                    const topRatioKey = pickSupportedKey(
                        topProps,
                        ["aspectRatio", "aspect_ratio", "ratio"],
                        ""
                    );
                    if (topRatioKey && params.aspectRatio && (!minimal || (topObj.required || []).includes(topRatioKey))) {
                        const allowedTopRatios = extractAllowedValues(topProps[topRatioKey], rootSchema);
                        const matchedRatio = matchEnumCaseInsensitive([params.aspectRatio], allowedTopRatios);
                        if (matchedRatio !== null) {
                            args[topRatioKey] = matchedRatio;
                        }
                    }
                }

                const item = {};
                populateKeyframeFields(item, itemObj, rootSchema, {
                    ...params,
                    requestKey: makeUuid(),
                    isBatchItem: true,
                    minimal
                });
                args[batchArrayKey] = [item];
                pushUniqueVariant(args);
            }
        }
    }

    /* Juga sediakan fallback flat object bila tool menerima argumen top-level langsung */
    if (!batchArrayKey || !topProps || topProps.prompt || topProps.description) {
        for (const minimal of [false, true]) {
            const flatArgs = {};
            populateKeyframeFields(flatArgs, topObj, rootSchema, {
                ...params,
                requestKey: makeUuid(),
                isBatchItem: false,
                minimal
            });
            pushUniqueVariant(flatArgs);
        }
    }

    return variants;
}

function inspectImageJobOutcome(
    rawData,
    rawText = "",
    targetJobId = "",
    {
        excludedAssetIds = null,
        excludedUrls = null
    } = {}
) {
    const parsedSource =
        rawData && typeof rawData === "object"
            ? rawData
            : tryParseJsonFromText(rawText);
    const unwrapped = unwrapEnvelope(parsedSource);
    let focus = unwrapped;

    if (unwrapped && typeof unwrapped === "object") {
        const containerKeys = ["jobs", "keyframes", "images", "items", "results", "tasks", "submissions", "outputs", "operations"];
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

    const nonTerminalDeadline = isOpusNonTerminalWorkerDeadline(
        errorCode,
        rawErrorMessage,
        rawText
    );
    const egressJobId = nonTerminalDeadline
        ? extractOpusEgressJobId(rawErrorMessage, rawText)
        : "";

    let status = normalizeStatus(rawState);
    if (nonTerminalDeadline && status !== "COMPLETED") {
        status = "PROCESSING";
    } else if (
        (focus?.ok === false || focus?.success === false || focus?.rejected === true || errorCode) &&
        status !== "COMPLETED"
    ) {
        status = "FAILED";
    }

    let imageUrls = [];
    if (status !== "FAILED") {
        const targetOutputAssetId = String(
            focus?.outputAssetId ||
            focus?.output_asset_id ||
            focus?.resultAssetId ||
            focus?.result_asset_id ||
            focus?.keyframeAssetId ||
            focus?.keyframe_asset_id ||
            ""
        ).trim();

        if (targetOutputAssetId && Array.isArray(unwrapped?.assets)) {
            const matchedAsset = unwrapped.assets.find(
                a => a && typeof a === "object" && (a.assetId === targetOutputAssetId || a.id === targetOutputAssetId)
            );
            if (matchedAsset) {
                imageUrls = extractImageUrls(matchedAsset);
            }
        }

        if (imageUrls.length === 0) {
            let sanitizedSource = focus || parsedSource;
            if (sanitizedSource && typeof sanitizedSource === "object" && Array.isArray(sanitizedSource.assets)) {
                const filteredAssets = sanitizedSource.assets.filter(a => {
                    if (!a || typeof a !== "object") return true;
                    const assetId = String(a.assetId || a.asset_id || a.id || "").trim();
                    if (assetId && excludedAssetIds instanceof Set && excludedAssetIds.has(assetId)) {
                        return false;
                    }
                    const role = String(a.role || a.source || a.origin || "").toLowerCase();
                    const kind = String(a.kind || a.mediaType || "").toLowerCase();
                    const label = String(a.label || a.name || "").toLowerCase();
                    if (/^(?:reference|character|outfit|first_frame|last_frame|input|subject|style|import|imported|upload|uploaded)$/.test(role)) {
                        return false;
                    }
                    if (/^(?:reference|character|outfit|first_frame|last_frame|input|subject|style|video|audio)$/.test(kind)) {
                        return false;
                    }
                    if (/^(?:image\d+|character|outfit|video\d+|audio\d+|first_frame|last_frame|ref_\d+|reference_\d+)$/.test(label)) {
                        return false;
                    }
                    return true;
                });
                sanitizedSource = { ...sanitizedSource, assets: filteredAssets };
            }
            imageUrls = extractImageUrls(sanitizedSource);
        }

        if (excludedUrls instanceof Set && excludedUrls.size > 0 && imageUrls.length > 0) {
            imageUrls = imageUrls.filter(url => !excludedUrls.has(url));
        }
    }

    if (imageUrls.length > 0 && status !== "FAILED") {
        status = "COMPLETED";
    }

    const activeNonTerminalDeadline = nonTerminalDeadline && status !== "COMPLETED";

    return {
        status,
        rawState: activeNonTerminalDeadline ? "processing" : (rawState || status.toLowerCase()),
        imageUrls,
        videoUrls: imageUrls,
        errorCode: status === "FAILED" ? (errorCode || "OPUS_TASK_FAILED") : null,
        errorMessage: status === "FAILED" ? translateOpusError(errorCode, rawErrorMessage) : null,
        nonTerminalDeadline: activeNonTerminalDeadline,
        deadlineErrorCode: activeNonTerminalDeadline ? (errorCode || "OPUS_WORKER_POLLING_DEADLINE") : null,
        deadlineErrorMessage: activeNonTerminalDeadline
            ? (rawErrorMessage || translateOpusError(errorCode, rawText))
            : null,
        egressJobId: egressJobId || null
    };
}

async function discoverProjectImageJob(session, projectId, {
    targetJobId = "",
    retries = 1,
    retryDelayMs = 350,
    excludedAssetIds = null,
    excludedUrls = null
} = {}) {
    if (!projectId) {
        return { jobId: "", outcome: null };
    }

    const listJobsTool =
        findMcpTool(session.tools, "list_jobs") ||
        findMcpTool(session.tools, "opusclip_list_jobs") ||
        findMcpTool(session.tools, "get_project_jobs");

    for (let attempt = 0; attempt <= retries; attempt += 1) {
        if (attempt > 0) {
            await sleep(retryDelayMs);
        }

        if (listJobsTool) {
            const listRes = await session
                .callTool(listJobsTool.name, buildListJobsArgs(listJobsTool, projectId))
                .catch(() => null);
            if (listRes && !listRes.isError) {
                const foundId = targetJobId || findJobIdFromResponse(listRes.data, listRes.text, projectId);
                const outcome = inspectImageJobOutcome(listRes.data, listRes.text, foundId, {
                    excludedAssetIds,
                    excludedUrls
                });
                if (foundId || outcome.imageUrls.length > 0) {
                    return {
                        jobId: foundId || targetJobId || "",
                        outcome
                    };
                }
            }
        }

        const projectAssetTool =
            findMcpTool(session.tools, "get_project") ||
            findMcpTool(session.tools, "list_assets") ||
            findMcpTool(session.tools, "get_project_state");

        if (projectAssetTool) {
            const rootSchema = projectAssetTool.inputSchema;
            const objSchema = resolveObjectSchema(rootSchema, rootSchema);
            const props = objSchema.properties;
            const required = Array.isArray(objSchema.required) ? objSchema.required : [];
            const projKey = pickSupportedKey(props, ["projectId", "project_id", "id"], !props ? "projectId" : "");
            const hasOtherRequired = required.some(k => k !== projKey);
            if (projKey && !hasOtherRequired) {
                const projRes = await session.callTool(projectAssetTool.name, { [projKey]: projectId }).catch(() => null);
                if (projRes && !projRes.isError) {
                    const projOutcome = inspectImageJobOutcome(projRes.data, projRes.text, targetJobId, {
                        excludedAssetIds,
                        excludedUrls
                    });
                    if (projOutcome.imageUrls.length > 0) {
                        return {
                            jobId: targetJobId || "",
                            outcome: projOutcome
                        };
                    }
                }
            }
        }
    }

    return { jobId: "", outcome: null };
}

function normalizeImageReferenceItems(payload = {}) {
    const out = [];
    const seenUrls = new Set();

    if (Array.isArray(payload.reference_image_items)) {
        for (const item of payload.reference_image_items) {
            if (!item || typeof item !== "object") continue;
            const url = String(item.url || "").trim();
            if (!url || seenUrls.has(url)) continue;
            seenUrls.add(url);
            out.push({
                url,
                role: String(item.role || "reference").trim() || "reference",
                label: String(item.label || `image${out.length + 1}`).trim() || `image${out.length + 1}`
            });
            if (out.length >= MAX_IMAGE_REFERENCE_IMAGES) {
                return out;
            }
        }
    }

    const rawUrls = Array.isArray(payload.reference_image_urls)
        ? payload.reference_image_urls
        : Array.isArray(payload.image_urls)
            ? payload.image_urls
            : payload.image_url
                ? [payload.image_url]
                : [];

    for (const rawUrl of rawUrls) {
        const url = String(rawUrl || "").trim();
        if (!url || seenUrls.has(url)) continue;
        seenUrls.add(url);
        out.push({
            url,
            role: "reference",
            label: `image${out.length + 1}`
        });
        if (out.length >= MAX_IMAGE_REFERENCE_IMAGES) {
            break;
        }
    }

    return out;
}

async function createImageTaskForSingleKey(payload = {}, apiKey, options = {}) {
    const endpoint = getMcpEndpoint(options);
    const keySlot = Number.isInteger(options?.keySlot) && options.keySlot > 0 ? options.keySlot : 0;
    const mediaCache = options?.mediaCache instanceof Map ? options.mediaCache : null;
    const isolateFromDefaultRefresh = Boolean(options?.isolateFromDefaultRefresh);
    const session = await openMcpSession({
        endpoint,
        apiKey,
        timeoutMs: CREATE_TIMEOUT_MS,
        includeTools: true,
        isolateFromDefaultRefresh,
        env: options?.env || null
    });

    const keyframeTool =
        findMcpTool(session.tools, "generate_keyframes") ||
        findMcpTool(session.tools, "opusclip_generate_keyframes") ||
        findMcpTool(session.tools, "generate_images") ||
        findMcpTool(session.tools, "create_image_job");

    if (!keyframeTool) {
        throw createProviderError({
            message: "Tool generate_keyframes tidak tersedia pada endpoint MCP Opus Labs ini.",
            code: "TOOL_UNAVAILABLE",
            providerCode: "generation_unavailable",
            status: 502
        });
    }

    const projectId = await ensureProjectId(session);
    const importTool = findMcpTool(session.tools, "import_assets");

    const refItems = normalizeImageReferenceItems(payload);
    const excludedUrls = new Set(refItems.map(item => item.url));
    const excludedAssetIds = new Set();
    const stagedReferences = [];

    for (let i = 0; i < refItems.length; i += 1) {
        const refItem = refItems[i];
        const mime = inferImageMimeFromUrl(refItem.url);
        const staged = await stageSingleReferenceImage(
            session,
            importTool,
            projectId,
            {
                url: refItem.url,
                role: refItem.role || "reference",
                label: refItem.label || `image${i + 1}`,
                mimeType: mime,
                mediaType: "image",
                fileName: `${(refItem.label || `reference-${i + 1}`).replace(/[^A-Za-z0-9_-]/g, "-")}.${extFromMime(mime)}`,
                mediaCache
            },
            i
        );
        if (staged?.assetId) {
            excludedAssetIds.add(String(staged.assetId).trim());
        }
        if (staged?.url) {
            excludedUrls.add(String(staged.url).trim());
        }
        stagedReferences.push(staged);
    }

    const prompt = String(payload.prompt || "").trim();
    const opusModel = String(payload.opus_model || payload.model || "").trim();
    const modelAliases = Array.isArray(payload.model_aliases) ? payload.model_aliases : [];
    const aspectRatio = String(payload.aspect_ratio || "1:1").trim();

    const candidateVariants = buildGenerateKeyframeVariants(keyframeTool, {
        prompt,
        opusModel,
        modelAliases,
        aspectRatio,
        stagedReferences,
        projectId
    });

    let lastCallResult = null;
    let lastError = null;
    let discoveredDuringTimeout = null;

    for (let vIdx = 0; vIdx < candidateVariants.length; vIdx += 1) {
        const variantArgs = candidateVariants[vIdx];
        try {
            const res = await session.callTool(keyframeTool.name, variantArgs);
            lastCallResult = res;

            if (!res.isError) {
                break;
            }

            const errCode = String(res.data?.code || res.data?.errorCode || "").trim();
            const errText = String(res.data?.message || res.text || "").trim();
            const isSchemaMismatch =
                vIdx + 1 < candidateVariants.length &&
                /invalid_arguments|validation_error|schema|unexpected\s+property|unrecognized\s+key|missing\s+required|must\s+be\s+(?:object|array|string)/i.test(
                    `${errCode} ${errText}`
                );
            if (isSchemaMismatch) {
                continue;
            }
            break;
        } catch (err) {
            lastError = err;
            const isTimeout = err?.code === "UPSTREAM_TIMEOUT" || /timeout/i.test(String(err?.message || ""));
            if (isTimeout && projectId) {
                const probed = await discoverProjectImageJob(session, projectId, {
                    retries: 1,
                    retryDelayMs: 400,
                    excludedAssetIds,
                    excludedUrls
                });
                if (probed.jobId || probed.outcome?.imageUrls?.length > 0) {
                    discoveredDuringTimeout = probed;
                    break;
                }
            }
            throw err;
        }
    }

    if (discoveredDuringTimeout) {
        if (discoveredDuringTimeout.outcome?.imageUrls?.length > 0 && !discoveredDuringTimeout.jobId) {
            const inlineTaskId = `opus-inline:${makeUuid()}`;
            inlineCompletedResults.set(inlineTaskId, {
                videoUrls: discoveredDuringTimeout.outcome.imageUrls,
                imageUrls: discoveredDuringTimeout.outcome.imageUrls,
                usageSeconds: null,
                createdAtMs: Date.now()
            });
            return {
                success: true,
                provider: PROVIDER_ID,
                providerName: PROVIDER_NAME,
                mediaType: "image",
                taskId: inlineTaskId,
                task_id: inlineTaskId,
                jobId: inlineTaskId,
                projectId,
                keySlot,
                status: "COMPLETED",
                outputUrls: discoveredDuringTimeout.outcome.imageUrls,
                imageUrls: discoveredDuringTimeout.outcome.imageUrls
            };
        }
        if (discoveredDuringTimeout.jobId) {
            const compositeTaskId = encodeOpusTaskId(projectId, discoveredDuringTimeout.jobId, keySlot);
            const urls = discoveredDuringTimeout.outcome?.imageUrls || [];
            return {
                success: true,
                provider: PROVIDER_ID,
                providerName: PROVIDER_NAME,
                mediaType: "image",
                taskId: compositeTaskId,
                task_id: compositeTaskId,
                jobId: discoveredDuringTimeout.jobId,
                projectId,
                keySlot,
                status: discoveredDuringTimeout.outcome?.status === "COMPLETED" ? "COMPLETED" : "QUEUED",
                outputUrls: urls,
                imageUrls: urls
            };
        }
    }

    if (!lastCallResult) {
        throw lastError || createProviderError({
            message: "Gagal mengirim permintaan gambar ke Opus Labs.",
            code: "CREATE_TASK_FAILED",
            status: 502
        });
    }

    let outcome = inspectImageJobOutcome(lastCallResult.data, lastCallResult.text, "", {
        excludedAssetIds,
        excludedUrls
    });
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

    if (!jobId && outcome.imageUrls.length === 0 && projectId) {
        const discovered = await discoverProjectImageJob(session, projectId, {
            retries: 2,
            retryDelayMs: 350,
            excludedAssetIds,
            excludedUrls
        });
        if (discovered.outcome?.status === "FAILED") {
            throw createProviderError({
                message: discovered.outcome.errorMessage || "Job gambar Opus Labs gagal saat masuk antrian.",
                code: discovered.outcome.errorCode || "OPUS_CREATE_REJECTED",
                providerCode: discovered.outcome.errorCode || "create_rejected",
                status: 422,
                raw: lastCallResult.data
            });
        }
        if (discovered.jobId) {
            jobId = discovered.jobId;
        }
        if (discovered.outcome?.imageUrls?.length > 0) {
            outcome = discovered.outcome;
        }
    }

    if (jobId) {
        const compositeTaskId = encodeOpusTaskId(projectId, jobId, keySlot);
        return {
            success: true,
            provider: PROVIDER_ID,
            providerName: PROVIDER_NAME,
            mediaType: "image",
            taskId: compositeTaskId,
            task_id: compositeTaskId,
            jobId,
            projectId,
            keySlot,
            status: outcome.status === "COMPLETED" ? "COMPLETED" : "QUEUED",
            outputUrls: outcome.imageUrls,
            imageUrls: outcome.imageUrls
        };
    }

    if (outcome.imageUrls.length > 0) {
        const inlineTaskId = `opus-inline:${makeUuid()}`;
        inlineCompletedResults.set(inlineTaskId, {
            videoUrls: outcome.imageUrls,
            imageUrls: outcome.imageUrls,
            usageSeconds: null,
            createdAtMs: Date.now()
        });
        return {
            success: true,
            provider: PROVIDER_ID,
            providerName: PROVIDER_NAME,
            mediaType: "image",
            taskId: inlineTaskId,
            task_id: inlineTaskId,
            jobId: inlineTaskId,
            projectId,
            keySlot,
            status: "COMPLETED",
            outputUrls: outcome.imageUrls,
            imageUrls: outcome.imageUrls
        };
    }

    if (projectId) {
        const pendingProjectTaskId = encodeOpusTaskId(projectId, PROJECT_PENDING_JOB_ID, keySlot);
        return {
            success: true,
            provider: PROVIDER_ID,
            providerName: PROVIDER_NAME,
            mediaType: "image",
            taskId: pendingProjectTaskId,
            task_id: pendingProjectTaskId,
            jobId: PROJECT_PENDING_JOB_ID,
            projectId,
            keySlot,
            status: "QUEUED",
            outputUrls: [],
            imageUrls: []
        };
    }

    throw createProviderError({
        message: "Opus Labs tidak mengembalikan jobId gambar yang valid.",
        code: "MISSING_TASK_ID",
        status: 502,
        raw: lastCallResult.data
    });
}

async function createImageTask(payload = {}, apiKey, options = {}) {
    const keyPool = extractOpusApiKeyPool(apiKey, options?.env);
    if (keyPool.length === 0) {
        parseApiKeyInput("", options?.env);
    }

    const totalKeys = keyPool.length;
    const mediaCache = new Map();

    if (totalKeys <= 1) {
        activeOpusKeyIndex = 0;
        try {
            const singleRes = await createImageTaskForSingleKey(payload, keyPool[0] || apiKey, {
                ...options,
                keySlot: 0,
                mediaCache,
                isolateFromDefaultRefresh: false
            });
            return {
                ...singleRes,
                keySlot: 0,
                keyPoolSize: 1
            };
        } catch (err) {
            if (isOpusCreditExhaustedError(err)) {
                err.opusFailedKeySlot = 0;
                err.opusKeyPoolSize = 1;
                err.exhaustedKeyCount = 1;
                err.rotatedFullCycle = true;
            }
            throw err;
        }
    }

    const excludedSet = normalizeExcludedSlotSet(
        options?.excludeKeySlots ?? payload?.opus_exclude_key_slots,
        totalKeys
    );
    const startIndex = ((activeOpusKeyIndex % totalKeys) + totalKeys) % totalKeys;
    const candidateSlots = [];
    for (let step = 0; step < totalKeys; step += 1) {
        const slotIndex = (startIndex + step) % totalKeys;
        if (!excludedSet.has(slotIndex)) {
            candidateSlots.push(slotIndex);
        }
    }
    if (candidateSlots.length === 0) {
        for (let step = 0; step < totalKeys; step += 1) {
            candidateSlots.push((startIndex + step) % totalKeys);
        }
    }

    let lastExhaustedError = null;
    let lastAuthError = null;

    for (let idx = 0; idx < candidateSlots.length; idx += 1) {
        const slotIndex = candidateSlots[idx];
        const candidateKey = keyPool[slotIndex];

        try {
            const result = await createImageTaskForSingleKey(payload, candidateKey, {
                ...options,
                keySlot: slotIndex,
                mediaCache,
                isolateFromDefaultRefresh: slotIndex > 0 || totalKeys > 1
            });
            activeOpusKeyIndex = slotIndex;
            return {
                ...result,
                keySlot: slotIndex,
                keyPoolSize: totalKeys
            };
        } catch (err) {
            if (isOpusCreditExhaustedError(err)) {
                lastExhaustedError = err;
                if (idx + 1 < candidateSlots.length) {
                    continue;
                }
                activeOpusKeyIndex = 0;
                err.opusFailedKeySlot = slotIndex;
                err.opusKeyPoolSize = totalKeys;
                err.exhaustedKeyCount = totalKeys;
                err.rotatedFullCycle = true;
                throw err;
            }

            const isAuthFailure =
                err?.status === 401 ||
                err?.status === 403 ||
                err?.code === "OPUS_AUTH_EXPIRED" ||
                err?.code === "OPUS_AUTH_REJECTED";
            if (isAuthFailure) {
                lastAuthError = err;
                if (idx + 1 < candidateSlots.length) {
                    continue;
                }
                throw lastExhaustedError || lastAuthError;
            }

            throw err;
        }
    }

    if (lastExhaustedError) throw lastExhaustedError;
    if (lastAuthError) throw lastAuthError;
    throw createProviderError({
        message: "Semua API key Opus gagal memproses permintaan gambar.",
        code: "OPUS_CREATE_REJECTED",
        status: 503
    });
}

async function getImageTaskForSingleKey(parsedId, apiKey, options = {}) {
    const endpoint = getMcpEndpoint(options);
    const session = await openMcpSession({
        endpoint,
        apiKey,
        timeoutMs: QUERY_TIMEOUT_MS,
        includeTools: true,
        isolateFromDefaultRefresh: Boolean(options?.isolateFromDefaultRefresh),
        env: options?.env || null
    });

    let activeJobId = parsedId.jobId;

    if (parsedId.isProjectPending) {
        const discovered = await discoverProjectImageJob(session, parsedId.projectId, {
            retries: 0
        });
        if (discovered.outcome?.status === "FAILED") {
            return {
                status: "FAILED",
                providerState: discovered.outcome.rawState || "failed",
                mediaType: "image",
                imageUrls: [],
                videoUrls: [],
                outputUrls: [],
                errorCode: discovered.outcome.errorCode || "OPUS_STATUS_FAILED",
                errorMessage: discovered.outcome.errorMessage || "Job gambar Opus Labs gagal.",
                projectId: parsedId.projectId,
                jobId: discovered.jobId || parsedId.projectId
            };
        }
        if (discovered.outcome?.imageUrls?.length > 0) {
            return {
                status: "COMPLETED",
                providerState: "completed",
                mediaType: "image",
                imageUrls: discovered.outcome.imageUrls,
                videoUrls: discovered.outcome.imageUrls,
                outputUrls: discovered.outcome.imageUrls,
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
                mediaType: "image",
                imageUrls: [],
                videoUrls: [],
                outputUrls: [],
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

    const watchKey = pickSupportedKey(props, ["watch", "wait", "block"], "");
    if (watchKey && schemaTypeIncludes(props?.[watchKey], rootSchema, "boolean")) {
        args[watchKey] = false;
    }

    const statusRes = await session.callTool(statusTool.name, args);
    let outcome = inspectImageJobOutcome(statusRes.data, statusRes.text, activeJobId);

    if (
        (statusRes.isError || outcome.status === "FAILED") &&
        isTransientNotFoundError(outcome.errorCode, outcome.errorMessage, statusRes.text)
    ) {
        if (parsedId.projectId) {
            const listed = await discoverProjectImageJob(session, parsedId.projectId, {
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
                    mediaType: "image",
                    imageUrls: [],
                    videoUrls: [],
                    outputUrls: [],
                    errorCode: null,
                    errorMessage: null,
                    projectId: parsedId.projectId,
                    jobId: activeJobId
                };
            }
        }
    } else if (statusRes.isError && outcome.status !== "COMPLETED" && !outcome.nonTerminalDeadline) {
        if (parsedId.projectId) {
            const listed = await discoverProjectImageJob(session, parsedId.projectId, {
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
                    mediaType: "image",
                    imageUrls: [],
                    videoUrls: [],
                    outputUrls: [],
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
                mediaType: "image",
                imageUrls: [],
                videoUrls: [],
                outputUrls: [],
                errorCode: outcome.errorCode || "OPUS_STATUS_FAILED",
                errorMessage: outcome.errorMessage || translateOpusError(outcome.errorCode, statusRes.text),
                projectId: parsedId.projectId,
                jobId: activeJobId
            };
        }
    }

    if ((outcome.nonTerminalDeadline || outcome.status === "COMPLETED") && outcome.imageUrls.length === 0) {
        const resolveTool = findMcpTool(session.tools, "resolve_job");
        if (resolveTool) {
            const candidateJobIds = [activeJobId];
            if (outcome.egressJobId && outcome.egressJobId !== activeJobId) {
                candidateJobIds.push(outcome.egressJobId);
            }
            for (const candidateJobId of candidateJobIds) {
                const resolvedRes = await session
                    .callTool(
                        resolveTool.name,
                        buildResolveJobArgs(resolveTool, parsedId.projectId, candidateJobId)
                    )
                    .catch(() => null);
                if (!resolvedRes || resolvedRes.isError) continue;
                const resolvedOutcome = inspectImageJobOutcome(
                    resolvedRes.data,
                    resolvedRes.text,
                    candidateJobId
                );
                if (resolvedOutcome.imageUrls.length > 0) {
                    outcome = {
                        ...resolvedOutcome,
                        status: "COMPLETED",
                        nonTerminalDeadline: false,
                        deadlineErrorCode: null,
                        deadlineErrorMessage: null
                    };
                    break;
                }
            }
        }

        if (outcome.imageUrls.length === 0 && parsedId.projectId) {
            const listed = await discoverProjectImageJob(session, parsedId.projectId, {
                targetJobId: activeJobId,
                retries: 0
            });
            if (listed.outcome?.imageUrls?.length > 0) {
                outcome = {
                    ...listed.outcome,
                    status: "COMPLETED",
                    nonTerminalDeadline: false,
                    deadlineErrorCode: null,
                    deadlineErrorMessage: null
                };
            }
        }

        if (outcome.status === "COMPLETED" && outcome.imageUrls.length === 0) {
            return {
                status: "PROCESSING",
                providerState: "processing",
                mediaType: "image",
                imageUrls: [],
                videoUrls: [],
                outputUrls: [],
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
        mediaType: "image",
        imageUrls: outcome.imageUrls,
        videoUrls: outcome.imageUrls,
        outputUrls: outcome.imageUrls,
        errorCode: outcome.errorCode,
        errorMessage: outcome.errorMessage,
        nonTerminalDeadline: Boolean(outcome.nonTerminalDeadline),
        projectId: parsedId.projectId,
        jobId: activeJobId
    };
}

async function getImageTask(taskId, apiKey, options = {}) {
    const parsedId = parseOpusTaskId(taskId);
    if (!parsedId.jobId) {
        throw createProviderError({
            message: "Task ID gambar Opus tidak ditemukan.",
            code: "TASK_ID_MISSING",
            status: 400
        });
    }

    for (const [key, entry] of inlineCompletedResults.entries()) {
        if (Date.now() - entry.createdAtMs > COMPLETED_INLINE_CACHE_TTL_MS) {
            inlineCompletedResults.delete(key);
        }
    }
    if (parsedId.isInlineDone && inlineCompletedResults.has(parsedId.jobId)) {
        const cached = inlineCompletedResults.get(parsedId.jobId);
        const urls = cached.imageUrls || cached.videoUrls || [];
        return {
            status: "COMPLETED",
            providerState: "completed",
            mediaType: "image",
            imageUrls: urls,
            videoUrls: urls,
            outputUrls: urls,
            errorCode: null,
            errorMessage: null,
            projectId: "",
            jobId: parsedId.jobId
        };
    }

    const keyPool = extractOpusApiKeyPool(apiKey, options?.env);
    if (keyPool.length <= 1) {
        const singleStatus = await getImageTaskForSingleKey(parsedId, keyPool[0] || apiKey, {
            ...options,
            isolateFromDefaultRefresh: false
        });
        return {
            ...singleStatus,
            keySlot: 0,
            keyPoolSize: Math.max(1, keyPool.length)
        };
    }

    const totalKeys = keyPool.length;
    const preferredSlot = parsedId.keySlot >= 0 && parsedId.keySlot < totalKeys
        ? parsedId.keySlot
        : 0;
    const candidateSlots = [preferredSlot];
    for (let idx = 0; idx < totalKeys; idx += 1) {
        if (idx !== preferredSlot) {
            candidateSlots.push(idx);
        }
    }

    let lastError = null;
    for (let c = 0; c < candidateSlots.length; c += 1) {
        const slotIndex = candidateSlots[c];
        try {
            const result = await getImageTaskForSingleKey(parsedId, keyPool[slotIndex], {
                ...options,
                isolateFromDefaultRefresh: true
            });
            if (
                result.status === "FAILED" &&
                isOpusCreditExhaustedError({
                    code: result.errorCode,
                    message: result.errorMessage
                })
            ) {
                activeOpusKeyIndex = (slotIndex + 1) % totalKeys;
            }
            return {
                ...result,
                keySlot: slotIndex,
                keyPoolSize: totalKeys
            };
        } catch (err) {
            lastError = err;
            const retryableOnOtherSlot =
                err?.status === 401 ||
                err?.status === 403 ||
                err?.code === "OPUS_AUTH_EXPIRED" ||
                err?.code === "OPUS_AUTH_REJECTED";
            if (retryableOnOtherSlot && c + 1 < candidateSlots.length) {
                continue;
            }
            throw err;
        }
    }

    throw lastError || createProviderError({
        message: "Gagal memeriksa status job gambar Opus Labs.",
        code: "OPUS_STATUS_FAILED",
        status: 502
    });
}

export {
    DEFAULT_MCP_URL,
    DEFAULT_OPUS_WORKOS_CLIENT_ID,
    MAX_IMAGE_REFERENCE_IMAGES,
    MAX_REFERENCE_AUDIOS,
    MAX_REFERENCE_IMAGES,
    MAX_REFERENCE_VIDEOS,
    PROVIDER_ID,
    PROVIDER_NAME,
    createImageTask,
    createVideoTask,
    encodeOpusTaskId,
    extractImageUrls,
    extractOpusApiKeyPool,
    extractVideoUrls,
    getActiveOpusKeyIndex,
    getImageTask,
    getMcpEndpoint,
    getVideoTask,
    isOpusCreditExhaustedError,
    normalizeStatus,
    parseOpusTaskId,
    redactSecrets,
    resetOpusKeyRotation,
    resolveBearerToken,
    translateOpusError
};

export default {
    PROVIDER_ID,
    PROVIDER_NAME,
    DEFAULT_MCP_URL,
    MAX_IMAGE_REFERENCE_IMAGES,
    createImageTask,
    createVideoTask,
    getImageTask,
    getVideoTask,
    encodeOpusTaskId,
    extractImageUrls,
    extractOpusApiKeyPool,
    extractOpusEgressJobId,
    getActiveOpusKeyIndex,
    isOpusCreditExhaustedError,
    isOpusNonTerminalWorkerDeadline,
    parseOpusTaskId,
    resetOpusKeyRotation,
    normalizeStatus,
    translateOpusError
};
