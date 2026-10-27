/* =========================================================
   GEN-Z.AI
   OPUS LABS — PRODUCT AD STUDIO IMAGE PROVIDER (server side)
   ---------------------------------------------------------
   File:
   lib/social-publisher/opus.js

   Tanggung jawab:
   - menghubungkan Studio Medsos dengan ekosistem pembuatan gambar
     Opus Labs / Product Ad Studio (https://product-ad-studio.labs.opus.pro/)
   - jalur utama: Managed Media MCP resmi Opus Labs di
     https://labs.opus.pro/opus-video-tools/mcp (Streamable HTTP JSON-RPC 2.0,
     mendukung JSON maupun SSE, OAuth Bearer token + auto-refresh WorkOS
     AuthKit `focused-horizon-38.authkit.app/oauth2/token`, `create_project`,
     `import_assets` dengan `awaiting_upload` signed URL PUT + finalisasi,
     `generate_keyframes`, dan polling `get_status`)
   - jalur opsional: endpoint HTTP JSON langsung melalui `OPUS_API_URL`
   - memvalidasi byte gambar asli (PNG/JPEG/WebP, dimensi, dan anti-blank)
   - menerjemahkan error Opus secara jujur dalam bahasa Indonesia

   Kontrak biaya & akses (WAJIB disebut jujur di pesan error):
   - memakai saldo KREDIT AKUN OPUSCLIP milik operator sendiri, bukan
     gratis tanpa batas dan bukan kredit GEN-Z.AI
   - kredit habis (`credit_admission_rejected` / `insufficient_credits`) atau
     akun belum memiliki akses beta Opus Labs / API -> generate gagal jujur
     TANPA gambar pengganti
   - status `submission_unknown` TIDAK pernah di-retry otomatis dengan key
     baru agar kredit akun OpusClip tidak terpotong dua kali

   Tidak bertanggung jawab:
   - caption / kata-kata mutiara (tetap provider teks)
   - penyimpanan hasil ke Supabase/Facebook (caller yang mengunggah)
   ========================================================= */

import { inspectImageContent, isBlankImage } from "./reference-image.js";
import { base64ToBytes, bytesToBase64 } from "./utils.js";

export const OPUS_PRODUCT_AD_STUDIO_URL = "https://product-ad-studio.labs.opus.pro/";
export const OPUS_DEFAULT_MCP_URL = "https://labs.opus.pro/opus-video-tools/mcp";
export const OPUS_OAUTH_TOKEN_URL = "https://focused-horizon-38.authkit.app/oauth2/token";
export const OPUS_DEFAULT_IMAGE_MODEL = "seedream-5.0-pro";

const MCP_PROTOCOL_VERSION = "2025-03-26";
const DEFAULT_POLL_TIMEOUT_MS = 90_000;
const DEFAULT_POLL_INTERVAL_MS = 1_500;

/* Cache token hasil refresh OAuth di memori Worker agar jadwal beruntun tidak
   menukar refresh_token berulang kali sebelum masa aktifnya habis. */
const refreshedTokenCache = new Map();

export function resetOpusTokenCache() {
    refreshedTokenCache.clear();
}

function envValue(env, name) {
    const processValue = typeof process !== "undefined" ? process.env?.[name] : "";
    return String(env?.[name] || processValue || "").trim();
}

function stripBearerPrefix(raw) {
    return String(raw || "").trim().replace(/^Bearer\s+/i, "").trim();
}

function parseExpiresAtMs(value) {
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

function parseOpusCredentialConfig(env) {
    const rawToken = envValue(env, "OPUS_AUTH_TOKEN")
        || envValue(env, "OPUS_ACCESS_TOKEN")
        || envValue(env, "OPUSCLIP_API_KEY");
    const envRefreshToken = envValue(env, "OPUS_REFRESH_TOKEN");
    const envClientId = envValue(env, "OPUS_CLIENT_ID");
    const envClientSecret = envValue(env, "OPUS_CLIENT_SECRET");
    const tokenEndpoint = envValue(env, "OPUS_OAUTH_TOKEN_URL") || OPUS_OAUTH_TOKEN_URL;

    if (rawToken.startsWith("{")) {
        try {
            const parsed = JSON.parse(rawToken);
            if (parsed && typeof parsed === "object") {
                return {
                    accessToken: stripBearerPrefix(
                        parsed.access_token || parsed.accessToken || parsed.token || ""
                    ),
                    refreshToken: String(
                        parsed.refresh_token || parsed.refreshToken || envRefreshToken || ""
                    ).trim(),
                    clientId: String(
                        parsed.client_id || parsed.clientId || envClientId || ""
                    ).trim(),
                    clientSecret: String(
                        parsed.client_secret || parsed.clientSecret || envClientSecret || ""
                    ).trim(),
                    expiresAtMs: parseExpiresAtMs(parsed.expires_at ?? parsed.expiresAt),
                    tokenEndpoint: String(parsed.token_endpoint || parsed.tokenEndpoint || tokenEndpoint).trim()
                };
            }
        } catch {
            /* Bila JSON tidak valid, perlakukan sebagai token mentah agar error
               autentikasi dilaporkan apa adanya dari server. */
        }
    }

    return {
        accessToken: stripBearerPrefix(rawToken),
        refreshToken: envRefreshToken,
        clientId: envClientId,
        clientSecret: envClientSecret,
        expiresAtMs: 0,
        tokenEndpoint
    };
}

export function opusConfigured(env) {
    const creds = parseOpusCredentialConfig(env);
    return Boolean(creds.accessToken || (creds.refreshToken && creds.clientId));
}

export function opusImageModel(env) {
    return envValue(env, "OPUS_IMAGE_MODEL") || OPUS_DEFAULT_IMAGE_MODEL;
}

function explicitOpusModel(env, imageModel) {
    return String(imageModel || "").trim() || envValue(env, "OPUS_IMAGE_MODEL");
}

function bytesToDataUri(bytes, mimeType) {
    const mime = String(mimeType || "image/jpeg").toLowerCase();
    return `data:${mime};base64,${bytesToBase64(bytes)}`;
}

function detectImageMime(bytes) {
    if (bytes.length >= 8
        && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
        && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) {
        return "image/png";
    }
    if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
        return "image/jpeg";
    }
    if (bytes.length >= 12
        && String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF"
        && String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP") {
        return "image/webp";
    }
    return "";
}

/**
 * Baca dimensi asli PNG/JPEG/WebP dari header biner. Mengembalikan null bila
 * tidak terbaca supaya ukuran tidak pernah direka-reka.
 */
export function readImageSize(bytes) {
    const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
    const mime = detectImageMime(view);
    if (mime === "image/png" && view.length >= 24) {
        return {
            width: (((view[16] << 24) | (view[17] << 16) | (view[18] << 8) | view[19]) >>> 0),
            height: (((view[20] << 24) | (view[21] << 16) | (view[22] << 8) | view[23]) >>> 0)
        };
    }
    if (mime === "image/jpeg") {
        let offset = 2;
        while (offset + 9 < view.length) {
            if (view[offset] !== 0xff) {
                offset += 1;
                continue;
            }
            const marker = view[offset + 1];
            if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
                return {
                    height: (view[offset + 5] << 8) | view[offset + 6],
                    width: (view[offset + 7] << 8) | view[offset + 8]
                };
            }
            if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
                offset += 2;
                continue;
            }
            const segmentLength = (view[offset + 2] << 8) | view[offset + 3];
            if (segmentLength < 2) return null;
            offset += 2 + segmentLength;
        }
        return null;
    }
    if (mime === "image/webp" && view.length >= 30) {
        const chunk = String.fromCharCode(...view.subarray(12, 16));
        if (chunk === "VP8X") {
            return {
                width: 1 + ((view[24] << 16) | (view[23] << 8) | view[22]),
                height: 1 + ((view[27] << 16) | (view[26] << 8) | view[25])
            };
        }
        if (chunk === "VP8 ") {
            return {
                width: (view[26] | (view[27] << 8)) & 0x3fff,
                height: (view[28] | (view[29] << 8)) & 0x3fff
            };
        }
        return null;
    }
    return null;
}

function makeUuid() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }
    return `opus-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function sleep(ms) {
    const delay = Math.max(0, Number(ms) || 0);
    if (!delay) return Promise.resolve();
    return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Terjemahkan error teknis Opus Labs / OpusClip ke tindakan bahasa Indonesia
 * yang jujur tanpa menyembunyikan kode error aslinya.
 */
function opusError({ code, message, status, jobId }) {
    const normalizedCode = String(code || "").trim().toLowerCase();
    const providerMessage = String(message || "").trim().slice(0, 500) || "tanpa pesan";
    const httpStatus = Number(status) || 0;
    const jobNote = jobId ? ` (jobId: ${jobId})` : "";

    if (
        normalizedCode === "submission_unknown"
        || normalizedCode === "credit_reservation_pending"
        || normalizedCode === "admission_incomplete"
        || /submission_unknown|credit_reservation_pending/i.test(providerMessage)
    ) {
        const error = new Error(
            `Status job gambar Opus belum pasti (${normalizedCode || "submission_unknown"})${jobNote}: ${providerMessage}. `
            + "Permintaan mungkin tetap berjalan dan menahan kredit akun OpusClip Anda — sistem sengaja TIDAK mengirim ulang otomatis agar kredit tidak terpotong dua kali."
        );
        error.status = 502;
        if (jobId) error.jobId = jobId;
        return error;
    }

    if (
        normalizedCode === "invalid_token"
        || normalizedCode === "invalid_grant"
        || normalizedCode === "unauthorized"
        || normalizedCode === "unauthenticated"
        || httpStatus === 401
        || /\binvalid_grant\b|\binvalid_token\b|\bunauthorized\b/i.test(providerMessage)
    ) {
        const error = new Error(
            `Token Opus ditolak (${normalizedCode || `HTTP ${httpStatus || 401}`}): ${providerMessage}. `
            + "Token OAuth salah atau kedaluwarsa — lakukan login ulang ke Opus Labs MCP (labs.opus.pro/opus-video-tools/mcp) lalu perbarui secret Worker OPUS_AUTH_TOKEN (atau pasangan OPUS_REFRESH_TOKEN + OPUS_CLIENT_ID)."
        );
        error.status = 401;
        return error;
    }

    if (
        normalizedCode === "credit_admission_rejected"
        || normalizedCode === "insufficient_credits"
        || normalizedCode === "insufficient_funds"
        || normalizedCode === "quotaexceederr"
        || httpStatus === 402
        || /credit_admission_rejected|insufficient[_\s-]*credits|not enough credits|quotaexceederr/i.test(providerMessage)
    ) {
        const error = new Error(
            `Kredit akun OpusClip Anda habis atau tidak mencukupi (${normalizedCode || "insufficient_credits"})${jobNote}: ${providerMessage}. `
            + "Opus Labs / Product Ad Studio (product-ad-studio.labs.opus.pro) memotong saldo kredit akun OpusClip Anda sendiri, bukan kredit GEN-Z.AI. Isi ulang kredit di opus.pro atau ganti provider gambar di SET Studio Medsos."
        );
        error.status = 402;
        return error;
    }

    if (
        normalizedCode === "forbidden"
        || normalizedCode === "access_denied"
        || httpStatus === 403
        || /api access not enabled|api-enabled opusclip account|has_api_access|not exposed for your account/i.test(providerMessage)
    ) {
        const error = new Error(
            `Akun atau organisasi OpusClip belum memiliki akses Opus Labs / API (${normalizedCode || "HTTP 403"}): ${providerMessage}. `
            + "Pastikan akun OpusClip Anda sudah mendapatkan akses beta Product Ad Studio (product-ad-studio.labs.opus.pro) / paket Pro, Max, atau Business dengan organisasi yang tepat saat otorisasi OAuth."
        );
        error.status = 403;
        return error;
    }

    if (normalizedCode === "content_policy" || /content[_\s-]*policy|safety|moderation/i.test(providerMessage)) {
        const error = new Error(
            `Permintaan gambar ditolak kebijakan konten Opus (${normalizedCode || "content_policy"})${jobNote}: ${providerMessage}.`
        );
        error.status = 422;
        return error;
    }

    if (normalizedCode === "rate_limit_exceeded" || httpStatus === 429 || /rate[_\s-]*limit|daily cap/i.test(providerMessage)) {
        const error = new Error(
            `Batas laju atau batas harian Opus tercapai (${normalizedCode || "HTTP 429"}): ${providerMessage}. Coba lagi beberapa saat kemudian.`
        );
        error.status = 429;
        return error;
    }

    const error = new Error(
        `Opus Labs gagal membuat gambar${normalizedCode ? ` (${normalizedCode})` : ""}${jobNote}: ${providerMessage}`
    );
    error.status = httpStatus >= 400 && httpStatus <= 599 ? httpStatus : 502;
    return error;
}

async function refreshOpusAccessToken(creds) {
    const cacheKey = `${creds.tokenEndpoint}|${creds.clientId}|${creds.refreshToken}`;
    const body = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: creds.refreshToken,
        client_id: creds.clientId
    });
    if (creds.clientSecret) {
        body.set("client_secret", creds.clientSecret);
    }

    const response = await fetch(creds.tokenEndpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json"
        },
        body: body.toString()
    });
    let payload = null;
    try {
        payload = await response.json();
    } catch {
        payload = null;
    }
    if (!response.ok || !payload?.access_token) {
        throw opusError({
            code: payload?.error || "invalid_grant",
            message: payload?.error_description || payload?.message || `Refresh token OAuth Opus gagal (HTTP ${response.status}).`,
            status: response.status === 400 ? 401 : (response.status || 401)
        });
    }
    const accessToken = stripBearerPrefix(payload.access_token);
    const expiresInSec = Number(payload.expires_in) || 3600;
    const nextRefreshToken = String(payload.refresh_token || creds.refreshToken).trim();
    refreshedTokenCache.set(cacheKey, {
        accessToken,
        refreshToken: nextRefreshToken,
        expiresAtMs: Date.now() + expiresInSec * 1000
    });
    return accessToken;
}

async function resolveOpusBearerToken(env, { forceRefresh = false } = {}) {
    const creds = parseOpusCredentialConfig(env);
    if (!creds.accessToken && !(creds.refreshToken && creds.clientId)) {
        const error = new Error(
            "OPUS_AUTH_TOKEN belum dikonfigurasi. Hubungkan akun OpusClip/Opus Labs (product-ad-studio.labs.opus.pro / labs.opus.pro/opus-video-tools/mcp) lalu simpan Bearer token OAuth sebagai secret Worker OPUS_AUTH_TOKEN (atau pasangan OPUS_REFRESH_TOKEN + OPUS_CLIENT_ID). Catatan: setiap gambar memotong kredit akun OpusClip Anda sendiri, bukan kredit GEN-Z.AI."
        );
        error.status = 503;
        throw error;
    }

    if (creds.refreshToken && creds.clientId) {
        const cacheKey = `${creds.tokenEndpoint}|${creds.clientId}|${creds.refreshToken}`;
        const cached = refreshedTokenCache.get(cacheKey);
        if (!forceRefresh && cached && cached.expiresAtMs > Date.now() + 60_000) {
            return { token: cached.accessToken, canRefresh: true, creds: { ...creds, refreshToken: cached.refreshToken } };
        }
        const initialExpired = creds.expiresAtMs > 0 && creds.expiresAtMs <= Date.now() + 60_000;
        if (forceRefresh || !creds.accessToken || initialExpired) {
            const refreshed = await refreshOpusAccessToken(creds);
            return { token: refreshed, canRefresh: false, creds };
        }
        return { token: creds.accessToken, canRefresh: true, creds };
    }

    return { token: creds.accessToken, canRefresh: false, creds };
}

function finalizeVerifiedImage(bytes, fallbackMime = "") {
    const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
    const detectedMime = detectImageMime(view);
    if (!detectedMime) {
        const snippet = new TextDecoder().decode(view.subarray(0, 180)).replace(/\s+/g, " ").trim();
        throw opusError({
            code: "invalid_image_bytes",
            message: `Hasil unduhan Opus bukan berkas gambar PNG/JPEG/WebP yang valid${fallbackMime ? ` (${fallbackMime})` : ""}${snippet ? `: ${snippet}` : "."}`,
            status: 502
        });
    }
    const quality = inspectImageContent(view);
    if (isBlankImage(quality)) {
        throw opusError({
            code: "blank_image",
            message: "Opus mengembalikan gambar kosong/polos sehingga dibatalkan agar tidak terpublikasi.",
            status: 502
        });
    }
    const dimensions = readImageSize(view);
    return {
        bytes: view,
        mimeType: detectedMime,
        width: dimensions?.width || 0,
        height: dimensions?.height || 0
    };
}

async function downloadOpusImageUrl(url, bearerToken) {
    let response = await fetch(url);
    if ((response.status === 401 || response.status === 403) && bearerToken) {
        response = await fetch(url, {
            headers: { Authorization: `Bearer ${bearerToken}` }
        });
    }
    if (!response.ok) {
        throw opusError({
            code: "output_download_failed",
            message: `Gagal mengunduh gambar hasil Opus (HTTP ${response.status}).`,
            status: 502
        });
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    return finalizeVerifiedImage(bytes, response.headers.get("content-type") || "");
}

async function extractImageFromValue(value, bearerToken) {
    if (!value) return null;
    if (value instanceof Uint8Array) {
        return finalizeVerifiedImage(value);
    }
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) return null;
        const dataUriMatch = /^data:(image\/[a-z0-9.+-]+);base64,([\s\S]+)$/i.exec(trimmed);
        if (dataUriMatch) {
            return finalizeVerifiedImage(base64ToBytes(dataUriMatch[2].replace(/\s+/g, "")), dataUriMatch[1]);
        }
        if (/^https?:\/\//i.test(trimmed)) {
            return await downloadOpusImageUrl(trimmed, bearerToken);
        }
        if (trimmed.length >= 64 && /^[A-Za-z0-9+/=\s]+$/.test(trimmed)) {
            const candidate = base64ToBytes(trimmed.replace(/\s+/g, ""));
            if (detectImageMime(candidate)) {
                return finalizeVerifiedImage(candidate);
            }
        }
        return null;
    }
    if (Array.isArray(value)) {
        for (const item of value) {
            const extracted = await extractImageFromValue(item, bearerToken);
            if (extracted) return extracted;
        }
        return null;
    }
    if (typeof value === "object") {
        if (value.type === "image" && typeof value.data === "string" && value.data.trim()) {
            return finalizeVerifiedImage(
                base64ToBytes(value.data.replace(/\s+/g, "")),
                value.mimeType || value.mime_type || "image/png"
            );
        }
        const directKeys = [
            "downloadUrl",
            "download_url",
            "imageUrl",
            "image_url",
            "url",
            "uri",
            "cdnUrl",
            "cdn_url",
            "signedUrl",
            "signed_url",
            "data_url",
            "dataUrl",
            "b64_json",
            "base64",
            "data"
        ];
        for (const key of directKeys) {
            if (typeof value[key] === "string" && value[key].trim()) {
                const extracted = await extractImageFromValue(value[key], bearerToken);
                if (extracted) return extracted;
            }
        }
        const nestedKeys = [
            "outputs",
            "keyframes",
            "images",
            "generatedThumbnailUris",
            "assets",
            "items",
            "artifacts",
            "media",
            "result",
            "output"
        ];
        for (const key of nestedKeys) {
            if (value[key] !== undefined && value[key] !== null) {
                const extracted = await extractImageFromValue(value[key], bearerToken);
                if (extracted) return extracted;
            }
        }
    }
    return null;
}

function parseSseJsonMessages(rawText) {
    const messages = [];
    const lines = String(rawText || "").split(/\r?\n/);
    let dataBuffer = [];
    const flush = () => {
        if (!dataBuffer.length) return;
        const joined = dataBuffer.join("\n").trim();
        dataBuffer = [];
        if (!joined || joined === "[DONE]") return;
        try {
            messages.push(JSON.parse(joined));
        } catch {
            /* Abaikan komentar/keepalive non-JSON. */
        }
    };
    for (const line of lines) {
        if (line.startsWith("data:")) {
            dataBuffer.push(line.slice(5).trimStart());
        } else if (line.trim() === "") {
            flush();
        }
    }
    flush();
    return messages;
}

class OpusMcpSession {
    constructor({ url, token }) {
        this.url = url;
        this.token = token;
        this.sessionId = "";
        this.nextId = 1;
    }

    async send(method, params, { isNotification = false } = {}) {
        const rpcId = isNotification ? undefined : this.nextId++;
        const headers = {
            Authorization: `Bearer ${this.token}`,
            "Content-Type": "application/json",
            Accept: "application/json, text/event-stream"
        };
        if (this.sessionId) {
            headers["Mcp-Session-Id"] = this.sessionId;
        }
        const payload = {
            jsonrpc: "2.0",
            method,
            ...(params !== undefined ? { params } : {}),
            ...(rpcId !== undefined ? { id: rpcId } : {})
        };
        const response = await fetch(this.url, {
            method: "POST",
            headers,
            body: JSON.stringify(payload)
        });
        const responseSessionId = response.headers.get("mcp-session-id") || response.headers.get("Mcp-Session-Id");
        if (responseSessionId) {
            this.sessionId = responseSessionId;
        }
        if (isNotification && (response.status === 200 || response.status === 202 || response.status === 204)) {
            return null;
        }
        const rawText = await response.text();
        if (!response.ok) {
            let parsedErr = null;
            try {
                parsedErr = rawText ? JSON.parse(rawText) : null;
            } catch {
                parsedErr = null;
            }
            const errObj = parsedErr?.error && typeof parsedErr.error === "object"
                ? parsedErr.error
                : parsedErr;
            throw opusError({
                code: errObj?.code || errObj?.error || "",
                message: errObj?.message || errObj?.error_description || rawText || `HTTP ${response.status} dari ${this.url}`,
                status: response.status
            });
        }
        if (isNotification || !rawText.trim()) {
            return null;
        }
        const contentType = String(response.headers.get("content-type") || "").toLowerCase();
        let envelope = null;
        if (contentType.includes("text/event-stream") || rawText.trimStart().startsWith("event:") || rawText.trimStart().startsWith("data:")) {
            const messages = parseSseJsonMessages(rawText);
            envelope = messages.find(item => item && item.id === rpcId)
                || messages.find(item => item && (item.result !== undefined || item.error !== undefined))
                || messages[messages.length - 1]
                || null;
        } else {
            const parsed = JSON.parse(rawText);
            envelope = Array.isArray(parsed)
                ? (parsed.find(item => item && item.id === rpcId) || parsed[0] || null)
                : parsed;
        }
        if (envelope?.error) {
            const rpcErr = envelope.error;
            throw opusError({
                code: rpcErr.data?.errorCode || rpcErr.data?.code || rpcErr.code || "",
                message: rpcErr.message || JSON.stringify(rpcErr),
                status: rpcErr.data?.status || 502,
                jobId: rpcErr.data?.jobId
            });
        }
        return envelope?.result ?? envelope;
    }

    async initialize() {
        const initResult = await this.send("initialize", {
            protocolVersion: MCP_PROTOCOL_VERSION,
            capabilities: {},
            clientInfo: {
                name: "genz-ai-social-publisher",
                version: "1.0.0"
            }
        });
        await this.send("notifications/initialized", {}, { isNotification: true }).catch(() => null);
        return initResult;
    }

    async listTools() {
        const result = await this.send("tools/list", {});
        return Array.isArray(result?.tools) ? result.tools : [];
    }

    async callTool(name, args = {}) {
        const result = await this.send("tools/call", {
            name,
            arguments: args
        });
        return unpackMcpToolResult(result);
    }
}

function unpackMcpToolResult(result) {
    if (!result || typeof result !== "object") {
        return { isError: false, data: result, content: [] };
    }
    const content = Array.isArray(result.content) ? result.content : [];
    let data = result.structuredContent !== undefined ? result.structuredContent : null;
    const textParts = [];
    for (const part of content) {
        if (part?.type === "text" && typeof part.text === "string") {
            const trimmed = part.text.trim();
            textParts.push(trimmed);
            if (!data && (trimmed.startsWith("{") || trimmed.startsWith("["))) {
                try {
                    data = JSON.parse(trimmed);
                } catch {
                    /* Teks biasa — simpan di textParts. */
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

function findMcpTool(tools, baseName) {
    const exact = tools.find(tool => tool?.name === baseName);
    if (exact) return exact;
    const suffix = `_${baseName}`;
    return tools.find(tool => typeof tool?.name === "string" && (
        tool.name.endsWith(suffix) || tool.name.endsWith(`/${baseName}`) || tool.name.endsWith(`.${baseName}`)
    )) || null;
}

function schemaProps(tool) {
    const props = tool?.inputSchema?.properties;
    return props && typeof props === "object" ? props : null;
}

function pickSupportedKey(props, candidates, fallback = "") {
    if (!props) return fallback;
    for (const key of candidates) {
        if (Object.prototype.hasOwnProperty.call(props, key)) return key;
    }
    return "";
}

function collectReferenceInputs({
    referenceBytes,
    referenceMimeType,
    personImageUrl,
    garmentBytes,
    garmentMimeType,
    garmentImageUrls
}) {
    const items = [];
    if (referenceBytes?.byteLength) {
        items.push({
            role: "person",
            label: "character_reference",
            bytes: referenceBytes,
            mimeType: String(referenceMimeType || "image/jpeg").toLowerCase(),
            fileName: `character.${String(referenceMimeType || "").includes("png") ? "png" : "jpg"}`,
            dataUri: bytesToDataUri(referenceBytes, referenceMimeType || "image/jpeg"),
            url: typeof personImageUrl === "string" ? personImageUrl : ""
        });
    } else if (typeof personImageUrl === "string" && personImageUrl.trim()) {
        items.push({
            role: "person",
            label: "character_reference",
            bytes: null,
            mimeType: "image/jpeg",
            fileName: "character.jpg",
            dataUri: "",
            url: personImageUrl.trim()
        });
    }

    if (garmentBytes?.byteLength) {
        items.push({
            role: "product",
            label: "outfit_reference",
            bytes: garmentBytes,
            mimeType: String(garmentMimeType || "image/jpeg").toLowerCase(),
            fileName: `outfit.${String(garmentMimeType || "").includes("png") ? "png" : "jpg"}`,
            dataUri: bytesToDataUri(garmentBytes, garmentMimeType || "image/jpeg"),
            url: ""
        });
    } else if (Array.isArray(garmentImageUrls)) {
        for (const rawUrl of garmentImageUrls) {
            if (typeof rawUrl === "string" && rawUrl.trim()) {
                items.push({
                    role: "product",
                    label: "outfit_reference",
                    bytes: null,
                    mimeType: "image/jpeg",
                    fileName: "outfit.jpg",
                    dataUri: "",
                    url: rawUrl.trim()
                });
            }
        }
    }
    return items;
}

function extractUploadSteps(data) {
    if (!data || typeof data !== "object") return [];
    if (Array.isArray(data.assets)) return data.assets;
    if (Array.isArray(data.items)) return data.items;
    if (Array.isArray(data.uploads)) return data.uploads;
    return [data];
}

async function importSingleAssetViaMcp(session, importTool, projectId, item) {
    const props = schemaProps(importTool);
    const args = {};
    const projectKey = pickSupportedKey(props, ["projectId", "project_id"], projectId ? "projectId" : "");
    if (projectKey && projectId) args[projectKey] = projectId;
    const reqKeyName = pickSupportedKey(props, ["requestKey", "idempotencyKey"], "requestKey");
    if (reqKeyName) args[reqKeyName] = makeUuid();

    if (props && Object.prototype.hasOwnProperty.call(props, "assets")) {
        const assetSpec = {
            fileName: item.fileName,
            mimeType: item.mimeType,
            role: item.role,
            ...(item.bytes ? { sizeBytes: item.bytes.byteLength } : {}),
            ...(item.url ? { url: item.url } : {})
        };
        args.assets = [assetSpec];
    } else {
        const urlKey = item.url ? pickSupportedKey(props, ["url", "sourceUrl", "uri"], "url") : "";
        if (urlKey && item.url && !item.bytes) {
            args[urlKey] = item.url;
        } else {
            const nameKey = pickSupportedKey(props, ["fileName", "filename", "name"], "fileName");
            if (nameKey) args[nameKey] = item.fileName;
            const mimeKey = pickSupportedKey(props, ["mimeType", "contentType", "mime_type"], "mimeType");
            if (mimeKey) args[mimeKey] = item.mimeType;
            if (item.bytes) {
                const sizeKey = pickSupportedKey(props, ["sizeBytes", "byteLength", "size"], "");
                if (sizeKey) args[sizeKey] = item.bytes.byteLength;
                const dataKey = pickSupportedKey(props, ["dataUri", "dataUrl", "base64", "data"], "");
                if (dataKey) {
                    args[dataKey] = dataKey === "base64" || dataKey === "data"
                        ? bytesToBase64(item.bytes)
                        : item.dataUri;
                }
            }
            const roleKey = pickSupportedKey(props, ["role", "kind", "type"], "");
            if (roleKey && !props?.[roleKey]?.enum) args[roleKey] = item.role;
        }
    }

    let stepResult = await session.callTool(importTool.name, args);
    if (stepResult.isError) {
        throw opusError({
            code: stepResult.data?.errorCode || stepResult.data?.code || "import_failed",
            message: stepResult.data?.message || stepResult.text || "Gagal mendaftarkan gambar referensi ke Opus Labs."
        });
    }

    const candidates = extractUploadSteps(stepResult.data);
    const entry = candidates[0] || stepResult.data || {};
    const uploadUrl = entry.uploadUrl || entry.upload_url || entry.signedUrl || entry.signed_url || entry.putUrl || "";
    const assetId = entry.assetId || entry.asset_id || entry.id || "";

    if ((entry.status === "awaiting_upload" || uploadUrl) && uploadUrl && item.bytes?.byteLength) {
        const extraHeaders = entry.uploadHeaders && typeof entry.uploadHeaders === "object"
            ? entry.uploadHeaders
            : {};
        const putResp = await fetch(uploadUrl, {
            method: "PUT",
            headers: {
                "Content-Type": item.mimeType,
                ...extraHeaders
            },
            body: item.bytes
        });
        if (!putResp.ok) {
            throw opusError({
                code: "asset_upload_failed",
                message: `Gagal mengunggah gambar referensi ke penyimpanan Opus Labs (HTTP ${putResp.status}).`,
                status: 502
            });
        }

        /* Finalisasi aset di proyek yang sama sesuai kontrak Opus Labs MCP. */
        const finalizeArgs = {};
        if (projectKey && projectId) finalizeArgs[projectKey] = projectId;
        if (assetId) {
            const assetIdKey = pickSupportedKey(props, ["assetId", "asset_id", "id"], "");
            if (assetIdKey) {
                finalizeArgs[assetIdKey] = assetId;
            } else if (props && Object.prototype.hasOwnProperty.call(props, "assets")) {
                finalizeArgs.assets = [{ assetId, status: "uploaded" }];
            } else {
                finalizeArgs.assetId = assetId;
            }
            if (reqKeyName) finalizeArgs[reqKeyName] = makeUuid();
            stepResult = await session.callTool(importTool.name, finalizeArgs);
            if (stepResult.isError) {
                throw opusError({
                    code: stepResult.data?.errorCode || stepResult.data?.code || "asset_finalize_failed",
                    message: stepResult.data?.message || stepResult.text || "Gagal memfinalisasi aset referensi di Opus Labs."
                });
            }
        }
    }

    const finalEntry = extractUploadSteps(stepResult.data)[0] || stepResult.data || entry;
    return {
        assetId: finalEntry.assetId || finalEntry.asset_id || finalEntry.id || assetId,
        uri: finalEntry.uri || finalEntry.url || finalEntry.cdnUrl || item.url || item.dataUri,
        role: item.role,
        mimeType: item.mimeType
    };
}

function buildKeyframesArguments(keyframesTool, {
    prompt,
    aspectRatio,
    projectId,
    explicitModel,
    importedAssets,
    rawReferenceItems
}) {
    const props = schemaProps(keyframesTool);
    const args = {};
    const ratio = aspectRatio === "16:9" ? "16:9" : "9:16";
    const width = ratio === "16:9" ? 1920 : 1080;
    const height = ratio === "16:9" ? 1080 : 1920;

    const promptKey = pickSupportedKey(props, ["prompt", "description", "instruction"], "prompt");
    if (promptKey) args[promptKey] = String(prompt || "").trim();

    const projectKey = pickSupportedKey(props, ["projectId", "project_id"], projectId ? "projectId" : "");
    if (projectKey && projectId) args[projectKey] = projectId;

    const reqKeyName = pickSupportedKey(props, ["requestKey", "idempotencyKey", "request_key"], "requestKey");
    if (reqKeyName) args[reqKeyName] = makeUuid();

    const ratioKey = pickSupportedKey(props, ["aspectRatio", "aspect_ratio", "ratio"], "aspectRatio");
    if (ratioKey) args[ratioKey] = ratio;

    if (props && Object.prototype.hasOwnProperty.call(props, "width") && Object.prototype.hasOwnProperty.call(props, "height")) {
        args.width = width;
        args.height = height;
    }

    const countKey = pickSupportedKey(props, ["count", "imageCount", "numImages", "n"], "");
    if (countKey) args[countKey] = 1;

    if (explicitModel) {
        const modelKey = pickSupportedKey(props, ["model", "imageModel", "modelId"], "model");
        if (modelKey) args[modelKey] = explicitModel;
    }

    if (importedAssets.length > 0) {
        const assetObjKey = pickSupportedKey(props, ["referenceAssets", "references", "assets"], "");
        const assetIdsKey = pickSupportedKey(props, ["assetIds", "referenceAssetIds", "reference_asset_ids"], "");
        const imageUrlsKey = pickSupportedKey(props, ["referenceImages", "imageUrls", "inputImages", "input_images"], "");
        if (assetObjKey) {
            const itemSchema = props?.[assetObjKey]?.items;
            if (itemSchema?.type === "string") {
                args[assetObjKey] = importedAssets.map(asset => asset.assetId || asset.uri).filter(Boolean);
            } else {
                args[assetObjKey] = importedAssets.map(asset => ({
                    ...(asset.assetId ? { assetId: asset.assetId } : {}),
                    ...(asset.uri && !asset.assetId ? { url: asset.uri } : {}),
                    role: asset.role
                }));
            }
        } else if (assetIdsKey) {
            args[assetIdsKey] = importedAssets.map(asset => asset.assetId).filter(Boolean);
        } else if (imageUrlsKey) {
            args[imageUrlsKey] = importedAssets.map(asset => asset.uri).filter(Boolean);
        } else if (!props) {
            args.referenceAssets = importedAssets.map(asset => ({
                ...(asset.assetId ? { assetId: asset.assetId } : {}),
                role: asset.role
            }));
        }
    } else if (rawReferenceItems.length > 0) {
        const directRefKey = pickSupportedKey(
            props,
            ["input_images", "inputImages", "referenceImages", "imageUrls", "references"],
            "input_images"
        );
        if (directRefKey) {
            args[directRefKey] = rawReferenceItems.map(item => item.url || item.dataUri).filter(Boolean);
        }
    }

    return args;
}

function extractJobDescriptor(data) {
    if (!data || typeof data !== "object") return { jobId: "", status: "", errorCode: "", message: "" };
    const firstJob = Array.isArray(data.jobs) && data.jobs[0] && typeof data.jobs[0] === "object"
        ? data.jobs[0]
        : null;
    const target = firstJob || data;
    const jobId = String(
        target.jobId
        || target.job_id
        || (Array.isArray(data.jobIds) ? data.jobIds[0] : "")
        || target.id
        || ""
    ).trim();
    const status = String(target.status || data.status || "").trim();
    const errorCode = String(target.errorCode || target.error_code || data.errorCode || data.code || "").trim();
    const message = String(
        target.errorMessage
        || target.error_message
        || (typeof target.error === "string" ? target.error : target.error?.message)
        || data.message
        || ""
    ).trim();
    return { jobId, status, errorCode, message, target };
}

function isTerminalFailureStatus(status) {
    return /^(failed|error|cancelled|canceled|rejected)$/i.test(String(status || "").trim());
}

function isUnknownSubmissionStatus(status) {
    return /^(submission_unknown|credit_reservation_pending|admission_incomplete)$/i.test(String(status || "").trim());
}

function isCompletedStatus(status) {
    return /^(completed|succeeded|concluded|done|ready|success)$/i.test(String(status || "").trim());
}

async function pollMcpJobUntilDone(session, statusTool, { jobId, projectId, bearerToken, timeoutMs, pollIntervalMs }) {
    if (!statusTool) {
        throw opusError({
            code: "status_tool_missing",
            message: `Job gambar Opus (${jobId}) masih diproses secara asinkron tetapi server MCP tidak menyediakan tool get_status.`,
            status: 502,
            jobId
        });
    }
    const props = schemaProps(statusTool);
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        const pollArgs = {};
        if (props && Object.prototype.hasOwnProperty.call(props, "jobIds")) {
            pollArgs.jobIds = [jobId];
        } else {
            const jobKey = pickSupportedKey(props, ["jobId", "job_id", "id"], "jobId");
            pollArgs[jobKey] = jobId;
        }
        const projectKey = pickSupportedKey(props, ["projectId", "project_id"], "");
        if (projectKey && projectId) pollArgs[projectKey] = projectId;
        if (props && Object.prototype.hasOwnProperty.call(props, "watch")) {
            pollArgs.watch = true;
            const timeoutKey = pickSupportedKey(props, ["timeoutSeconds", "waitSeconds"], "");
            if (timeoutKey) {
                const remainingSec = Math.max(1, Math.min(15, Math.floor((deadline - Date.now()) / 1000)));
                pollArgs[timeoutKey] = remainingSec;
            }
        } else {
            const waitKey = pickSupportedKey(props, ["waitSeconds", "timeoutSeconds"], "");
            if (waitKey) {
                const remainingSec = Math.max(1, Math.min(15, Math.floor((deadline - Date.now()) / 1000)));
                pollArgs[waitKey] = remainingSec;
            }
        }

        const polled = await session.callTool(statusTool.name, pollArgs);
        const info = extractJobDescriptor(polled.data);
        if (isUnknownSubmissionStatus(info.status) || isUnknownSubmissionStatus(info.errorCode)) {
            throw opusError({
                code: info.errorCode || info.status || "submission_unknown",
                message: info.message || polled.text || "Status pengiriman job ke provider belum pasti.",
                status: 502,
                jobId
            });
        }
        if (polled.isError || isTerminalFailureStatus(info.status)) {
            throw opusError({
                code: info.errorCode || "job_failed",
                message: info.message || polled.text || `Job gambar Opus berakhir dengan status ${info.status || "failed"}.`,
                status: 502,
                jobId
            });
        }

        if (isCompletedStatus(info.status) || !info.status) {
            const fromContent = await extractImageFromValue(polled.content, bearerToken);
            if (fromContent) return { image: fromContent, raw: polled.data };
            const fromData = await extractImageFromValue(info.target || polled.data, bearerToken);
            if (fromData) return { image: fromData, raw: polled.data };
            if (isCompletedStatus(info.status)) {
                throw opusError({
                    code: "empty_job_output",
                    message: `Job gambar Opus (${jobId}) selesai tetapi tidak menyertakan URL/data gambar.`,
                    status: 502,
                    jobId
                });
            }
        }

        const suggestedSec = Number(
            polled.data?.nextPollAfterSeconds
            ?? polled.data?.retryAfterSeconds
            ?? info.target?.retryAfterSeconds
            ?? 0
        );
        const delayMs = suggestedSec > 0
            ? Math.min(5_000, Math.round(suggestedSec * 1000))
            : pollIntervalMs;
        if (Date.now() + delayMs > deadline) break;
        await sleep(delayMs);
    }

    throw opusError({
        code: "poll_timeout",
        message: `Job gambar Opus (${jobId}) masih berjalan melebihi batas tunggu ${Math.round(timeoutMs / 1000)} detik. Sistem tidak mengirim ulang otomatis agar kredit akun OpusClip tidak terpotong ganda.`,
        status: 504,
        jobId
    });
}

async function generateViaOpusMcp({
    env,
    mcpUrl,
    prompt,
    aspectRatio,
    explicitModel,
    referenceItems,
    timeoutMs,
    pollIntervalMs
}) {
    let auth = await resolveOpusBearerToken(env);
    let session = new OpusMcpSession({ url: mcpUrl, token: auth.token });

    try {
        await session.initialize();
    } catch (initError) {
        if (initError?.status === 401 && auth.canRefresh) {
            auth = await resolveOpusBearerToken(env, { forceRefresh: true });
            session = new OpusMcpSession({ url: mcpUrl, token: auth.token });
            await session.initialize();
        } else {
            throw initError;
        }
    }

    const tools = await session.listTools();
    const whoamiTool = findMcpTool(tools, "opus_video_tools_whoami") || findMcpTool(tools, "whoami");
    if (whoamiTool) {
        const whoami = await session.callTool(whoamiTool.name, {});
        if (whoami.isError) {
            throw opusError({
                code: whoami.data?.errorCode || whoami.data?.code || "whoami_failed",
                message: whoami.data?.message || whoami.text || "Verifikasi akun Opus Labs gagal.",
                status: 401
            });
        }
        if (whoami.data && whoami.data.has_api_access === false) {
            throw opusError({
                code: "forbidden",
                message: whoami.data.upgrade || whoami.data.message || "API access not enabled for this org.",
                status: 403
            });
        }
    }

    const keyframesTool = findMcpTool(tools, "generate_keyframes");
    if (!keyframesTool) {
        throw opusError({
            code: "forbidden",
            message: "Server Opus Labs tidak mengekspos tool gambar generate_keyframes untuk akun ini.",
            status: 403
        });
    }

    let projectId = envValue(env, "OPUS_PROJECT_ID");
    const createProjectTool = findMcpTool(tools, "create_project");
    if (!projectId && createProjectTool) {
        const projProps = schemaProps(createProjectTool);
        const projArgs = {};
        const titleKey = pickSupportedKey(projProps, ["name", "title", "projectName"], "name");
        if (titleKey) projArgs[titleKey] = "GEN-Z.AI Studio Medsos";
        const reqKey = pickSupportedKey(projProps, ["requestKey", "idempotencyKey"], "");
        if (reqKey) projArgs[reqKey] = makeUuid();
        const created = await session.callTool(createProjectTool.name, projArgs);
        if (created.isError) {
            throw opusError({
                code: created.data?.errorCode || created.data?.code || "create_project_failed",
                message: created.data?.message || created.text || "Gagal membuat proyek media di Opus Labs."
            });
        }
        projectId = String(
            created.data?.projectId
            || created.data?.project_id
            || created.data?.project?.id
            || created.data?.id
            || ""
        ).trim();
    }

    const importedAssets = [];
    const importTool = findMcpTool(tools, "import_assets");
    if (referenceItems.length > 0 && importTool) {
        for (const item of referenceItems) {
            const imported = await importSingleAssetViaMcp(session, importTool, projectId, item);
            importedAssets.push(imported);
        }
    }

    const genArgs = buildKeyframesArguments(keyframesTool, {
        prompt,
        aspectRatio,
        projectId,
        explicitModel,
        importedAssets,
        rawReferenceItems: referenceItems
    });
    const genResult = await session.callTool(keyframesTool.name, genArgs);
    const info = extractJobDescriptor(genResult.data);

    if (isUnknownSubmissionStatus(info.status) || isUnknownSubmissionStatus(info.errorCode)) {
        throw opusError({
            code: info.errorCode || info.status || "submission_unknown",
            message: info.message || genResult.text || "Status pengiriman job gambar belum pasti.",
            status: 502,
            jobId: info.jobId
        });
    }
    if (genResult.isError || isTerminalFailureStatus(info.status)) {
        throw opusError({
            code: info.errorCode || "generation_failed",
            message: info.message || genResult.text || "Pembuatan gambar Opus Labs gagal.",
            status: 502,
            jobId: info.jobId
        });
    }

    /* Cek apakah gambar langsung dikembalikan pada respons pertama. */
    const immediateFromContent = await extractImageFromValue(genResult.content, auth.token);
    if (immediateFromContent) {
        const reportedModel = String(
            genResult.data?.model || info.target?.model || explicitModel || opusImageModel(env)
        );
        return {
            ...immediateFromContent,
            model: reportedModel,
            images_sent: referenceItems.length
        };
    }
    if (!info.jobId || isCompletedStatus(info.status)) {
        const immediateFromData = await extractImageFromValue(genResult.data, auth.token);
        if (immediateFromData) {
            const reportedModel = String(
                genResult.data?.model || info.target?.model || explicitModel || opusImageModel(env)
            );
            return {
                ...immediateFromData,
                model: reportedModel,
                images_sent: referenceItems.length
            };
        }
    }

    if (info.jobId) {
        const statusTool = findMcpTool(tools, "get_status");
        const { image, raw } = await pollMcpJobUntilDone(session, statusTool, {
            jobId: info.jobId,
            projectId,
            bearerToken: auth.token,
            timeoutMs,
            pollIntervalMs
        });
        const reportedModel = String(
            raw?.model || genResult.data?.model || explicitModel || opusImageModel(env)
        );
        return {
            ...image,
            model: reportedModel,
            images_sent: referenceItems.length
        };
    }

    throw opusError({
        code: "unexpected_response",
        message: "Opus Labs tidak mengembalikan gambar maupun jobId yang dapat dipantau.",
        status: 502
    });
}

async function generateViaHttpApi({
    env,
    apiUrl,
    prompt,
    aspectRatio,
    explicitModel,
    referenceItems,
    timeoutMs,
    pollIntervalMs
}) {
    const auth = await resolveOpusBearerToken(env);
    const model = explicitModel || opusImageModel(env);
    const ratio = aspectRatio === "16:9" ? "16:9" : "9:16";
    const inputImages = referenceItems.map(item => item.dataUri || item.url).filter(Boolean);

    const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${auth.token}`,
            "Content-Type": "application/json",
            Accept: "application/json, image/*"
        },
        body: JSON.stringify({
            prompt: String(prompt || "").trim(),
            model,
            aspect_ratio: ratio,
            aspectRatio: ratio,
            quality: "1K",
            count: 1,
            ...(inputImages.length ? { input_images: inputImages, reference_images: inputImages } : {})
        })
    });

    const buffer = new Uint8Array(await response.arrayBuffer());
    if (response.ok && detectImageMime(buffer)) {
        const image = finalizeVerifiedImage(buffer, response.headers.get("content-type") || "");
        return {
            ...image,
            model,
            images_sent: inputImages.length
        };
    }

    let payload = null;
    try {
        payload = JSON.parse(new TextDecoder().decode(buffer));
    } catch {
        payload = null;
    }

    if (!response.ok) {
        const errBody = payload?.error && typeof payload.error === "object" ? payload.error : payload;
        throw opusError({
            code: errBody?.errorCode || errBody?.code || "",
            message: errBody?.message || `HTTP ${response.status} dari ${apiUrl}`,
            status: response.status,
            jobId: errBody?.jobId
        });
    }

    const unwrapped = payload?.data !== undefined && typeof payload.data === "object" ? payload.data : payload;
    const directImage = await extractImageFromValue(unwrapped, auth.token);
    if (directImage) {
        return {
            ...directImage,
            model: String(unwrapped?.model || model),
            images_sent: inputImages.length
        };
    }

    const info = extractJobDescriptor(unwrapped);
    if (!info.jobId) {
        throw opusError({
            code: "unexpected_response",
            message: "Endpoint HTTP Opus tidak mengembalikan gambar maupun jobId.",
            status: 502
        });
    }

    const basePollUrl = apiUrl.replace(/\/+$/, "");
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        await sleep(pollIntervalMs);
        const pollResp = await fetch(`${basePollUrl}/${encodeURIComponent(info.jobId)}`, {
            headers: {
                Authorization: `Bearer ${auth.token}`,
                Accept: "application/json"
            }
        });
        const pollPayload = await pollResp.json().catch(() => null);
        if (!pollResp.ok) {
            throw opusError({
                code: pollPayload?.code || "",
                message: pollPayload?.message || `Gagal membaca status job Opus ${info.jobId} (HTTP ${pollResp.status}).`,
                status: pollResp.status,
                jobId: info.jobId
            });
        }
        const pollData = pollPayload?.data && typeof pollPayload.data === "object" ? pollPayload.data : pollPayload;
        const pollInfo = extractJobDescriptor(pollData);
        if (isUnknownSubmissionStatus(pollInfo.status) || isUnknownSubmissionStatus(pollInfo.errorCode)) {
            throw opusError({
                code: pollInfo.errorCode || pollInfo.status || "submission_unknown",
                message: pollInfo.message || "Status job Opus belum pasti.",
                status: 502,
                jobId: info.jobId
            });
        }
        if (isTerminalFailureStatus(pollInfo.status)) {
            throw opusError({
                code: pollInfo.errorCode || "job_failed",
                message: pollInfo.message || `Job Opus ${info.jobId} berakhir dengan status ${pollInfo.status}.`,
                status: 502,
                jobId: info.jobId
            });
        }
        if (isCompletedStatus(pollInfo.status)) {
            const image = await extractImageFromValue(pollData, auth.token);
            if (!image) {
                throw opusError({
                    code: "empty_job_output",
                    message: `Job Opus ${info.jobId} selesai tanpa URL gambar hasil.`,
                    status: 502,
                    jobId: info.jobId
                });
            }
            return {
                ...image,
                model: String(pollData?.model || model),
                images_sent: inputImages.length
            };
        }
    }

    throw opusError({
        code: "poll_timeout",
        message: `Job Opus (${info.jobId}) melebihi batas tunggu ${Math.round(timeoutMs / 1000)} detik.`,
        status: 504,
        jobId: info.jobId
    });
}

/**
 * Buat SATU gambar sosial media melalui Opus Labs (Product Ad Studio /
 * `labs.opus.pro/opus-video-tools/mcp` atau `OPUS_API_URL`).
 *
 * Foto karakter (`referenceBytes`) dan foto outfit/produk (`garmentBytes`)
 * didaftarkan sebagai aset referensi proyek sehingga identitas karakter dan
 * produk tetap terjaga.
 *
 * Mengembalikan `{ bytes, mimeType, model, width, height, images_sent,
 * elapsedMs }` atau melempar error dengan status HTTP yang jujur.
 */
export async function generateOpusSocialImage({
    env,
    prompt,
    referenceBytes,
    referenceMimeType,
    personImageUrl,
    garmentBytes,
    garmentMimeType,
    garmentImageUrls,
    aspectRatio = "9:16",
    imageModel
}) {
    const startedAt = Date.now();
    const ratio = String(aspectRatio) === "16:9" ? "16:9" : "9:16";
    const explicitModel = explicitOpusModel(env, imageModel);
    const referenceItems = collectReferenceInputs({
        referenceBytes,
        referenceMimeType,
        personImageUrl,
        garmentBytes,
        garmentMimeType,
        garmentImageUrls
    });

    const configuredPollTimeout = Number(envValue(env, "OPUS_POLL_TIMEOUT_MS"));
    const timeoutMs = Number.isFinite(configuredPollTimeout) && configuredPollTimeout > 0
        ? configuredPollTimeout
        : DEFAULT_POLL_TIMEOUT_MS;
    const configuredPollInterval = Number(envValue(env, "OPUS_POLL_INTERVAL_MS"));
    const pollIntervalMs = Number.isFinite(configuredPollInterval) && configuredPollInterval >= 0
        ? configuredPollInterval
        : DEFAULT_POLL_INTERVAL_MS;

    const customApiUrl = envValue(env, "OPUS_API_URL");
    const mcpUrl = envValue(env, "OPUS_MCP_URL") || OPUS_DEFAULT_MCP_URL;
    const useHttpApi = Boolean(customApiUrl) && !/\/mcp\/?$/i.test(customApiUrl);

    const outcome = useHttpApi
        ? await generateViaHttpApi({
            env,
            apiUrl: customApiUrl,
            prompt,
            aspectRatio: ratio,
            explicitModel,
            referenceItems,
            timeoutMs,
            pollIntervalMs
        })
        : await generateViaOpusMcp({
            env,
            mcpUrl: customApiUrl || mcpUrl,
            prompt,
            aspectRatio: ratio,
            explicitModel,
            referenceItems,
            timeoutMs,
            pollIntervalMs
        });

    return {
        ...outcome,
        elapsedMs: Date.now() - startedAt
    };
}
