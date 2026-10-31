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
     AuthKit `focused-horizon-38.authkit.app/oauth2/token` dengan RFC 8707
     `resource`, `create_project`, `import_assets` dengan `awaiting_upload`
     signed URL PUT + finalisasi, `generate_keyframes`, dan polling `get_status`)
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

import {
    inspectImageContent,
    isBlankImage,
    normalizeReferenceImageBounds,
    prepareReferenceImage,
    readImageDimensions
} from "./reference-image.js";
import { base64ToBytes, bytesToBase64 } from "./utils.js";
import {
    clearOpusMemoryTokenVault,
    resolveOpusOAuthTokenWithVault
} from "../../provider/opus/oauth-vault.js";

export const OPUS_PRODUCT_AD_STUDIO_URL = "https://product-ad-studio.labs.opus.pro/";
export const OPUS_DEFAULT_MCP_URL = "https://labs.opus.pro/opus-video-tools/mcp";
export const OPUS_OAUTH_TOKEN_URL = "https://focused-horizon-38.authkit.app/oauth2/token";
const DEFAULT_OPUS_WORKOS_CLIENT_ID = "client_01K793481887VCB5M0N2B23784";

export const OPUS_IMAGE_MODELS = [
    {
        id: "gpt-image-2.5-flare",
        label: "GPT Image 2.5 Flare",
        note: "Cepat & hemat latensi"
    },
    {
        id: "gpt-image-2.5-sunburst",
        label: "GPT Image 2.5 Sunburst",
        note: "Presisi & detail produk tinggi"
    }
];

export const OPUS_DEFAULT_IMAGE_MODEL = "gpt-image-2.5-flare";
export const OPUS_MAX_REFERENCE_IMAGES = 3;
export const OPUS_DEFAULT_ASPECT_RATIO = "9:16";
export const OPUS_DEFAULT_IMAGE_QUALITY = "low";
export const OPUS_MIN_REFERENCE_DIMENSION = 300;
export const OPUS_MAX_REFERENCE_DIMENSION = 6000;

const MCP_PROTOCOL_VERSION = "2025-03-26";
const DEFAULT_POLL_TIMEOUT_MS = 90_000;
const DEFAULT_POLL_INTERVAL_MS = 3_500;

/* Cache token hasil refresh OAuth di memori Worker agar jadwal beruntun tidak
   menukar refresh_token berulang kali sebelum masa aktifnya habis. */
const refreshedTokenCache = new Map();
const MAX_OPUS_ENV_KEY_SLOTS = 20;
let activeSocialOpusKeyIndex = 0;

export function resetOpusTokenCache() {
    refreshedTokenCache.clear();
    clearOpusMemoryTokenVault();
    activeSocialOpusKeyIndex = 0;
}

function envValue(env, name) {
    if (env && typeof env === "object") {
        const direct = env[name];
        if (direct !== undefined && direct !== null) {
            return String(direct).trim();
        }
    }
    const processValue = typeof process !== "undefined" ? process.env?.[name] : "";
    return String(processValue || "").trim();
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

function unwrapOuterQuotes(raw) {
    let text = String(raw || "").trim();
    if (
        (text.startsWith("\"") && text.endsWith("\""))
        || (text.startsWith("'") && text.endsWith("'"))
    ) {
        try {
            const unquoted = JSON.parse(text);
            if (typeof unquoted === "string") return unquoted.trim();
        } catch {
            return text.slice(1, -1).trim();
        }
    }
    return text;
}

function extractFieldFromWwwAuthenticate(headerValue, fieldName) {
    if (!headerValue) return "";
    const pattern = new RegExp(`${fieldName}=(?:"([^"]+)"|([^\\s,]+))`, "i");
    const match = String(headerValue).match(pattern);
    return (match?.[1] || match?.[2] || "").trim();
}

function parseOpusCredentialConfig(env) {
    const rawToken = unwrapOuterQuotes(
        envValue(env, "OPUS_AUTH_TOKEN")
        || envValue(env, "OPUS_ACCESS_TOKEN")
        || envValue(env, "OPUSCLIP_API_KEY")
    );
    const envRefreshToken = envValue(env, "OPUS_REFRESH_TOKEN");
    const envClientId = envValue(env, "OPUS_CLIENT_ID");
    const envClientSecret = envValue(env, "OPUS_CLIENT_SECRET");
    const envResource = envValue(env, "OPUS_RESOURCE_URL");
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
                        parsed.client_id || parsed.clientId || envClientId || DEFAULT_OPUS_WORKOS_CLIENT_ID
                    ).trim(),
                    clientSecret: String(
                        parsed.client_secret || parsed.clientSecret || envClientSecret || ""
                    ).trim(),
                    resource: String(parsed.resource || envResource || "").trim(),
                    scope: String(parsed.scope || "").trim(),
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
        clientId: envClientId || (envRefreshToken ? DEFAULT_OPUS_WORKOS_CLIENT_ID : ""),
        clientSecret: envClientSecret,
        resource: envResource,
        scope: "",
        expiresAtMs: 0,
        tokenEndpoint
    };
}

function appendExpandedRawEntries(target, rawInput) {
    if (rawInput === null || rawInput === undefined) return;
    if (Array.isArray(rawInput)) {
        for (const item of rawInput) {
            appendExpandedRawEntries(target, item);
        }
        return;
    }
    if (typeof rawInput === "object") {
        if (Array.isArray(rawInput.opus_key_pool)) {
            appendExpandedRawEntries(target, rawInput.opus_key_pool);
            return;
        }
        if (Array.isArray(rawInput.keys)) {
            appendExpandedRawEntries(target, rawInput.keys);
            return;
        }
        const serialized = JSON.stringify(rawInput);
        if (serialized && serialized !== "{}") target.push(serialized);
        return;
    }

    const cleaned = unwrapOuterQuotes(rawInput);
    if (!cleaned) return;

    if (cleaned.startsWith("[") && cleaned.endsWith("]")) {
        try {
            const parsedArr = JSON.parse(cleaned);
            if (Array.isArray(parsedArr)) {
                appendExpandedRawEntries(target, parsedArr);
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
                    appendExpandedRawEntries(target, parsedObj.opus_key_pool);
                    return;
                }
                if (Array.isArray(parsedObj.keys)) {
                    appendExpandedRawEntries(target, parsedObj.keys);
                    return;
                }
                target.push(JSON.stringify(parsedObj));
                return;
            }
        } catch {
            /* Mungkin beberapa JSON per baris (JSONL) */
        }
    }

    if (/[\r\n]/.test(cleaned)) {
        const lines = cleaned
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(line => line && !line.startsWith("#"));
        if (lines.length > 1) {
            for (const line of lines) {
                appendExpandedRawEntries(target, line);
            }
            return;
        }
        if (lines.length === 1) {
            target.push(lines[0]);
            return;
        }
        return;
    }

    if (!cleaned.includes("{") && !cleaned.includes("}") && /[,;]/.test(cleaned)) {
        const parts = cleaned.split(/[,;]/).map(s => s.trim()).filter(Boolean);
        if (parts.length > 1) {
            for (const part of parts) target.push(part);
            return;
        }
    }

    target.push(cleaned);
}

const OPUS_CREDENTIAL_KEY_STEMS = [
    "OPUS_AUTH_TOKEN",
    "OPUS_ACCESS_TOKEN",
    "OPUSCLIP_API_KEY",
    "OPUS_API_KEY",
    "OPUS_TOKEN",
    "OPUS_KEY",
    "OPUS_SECRET"
];

const DYNAMIC_OPUS_SLOT_PATTERN =
    /^opus(?:clip)?[-_]*(?:auth[-_]*token|access[-_]*token|api[-_]*key|account|secret|token|key)[-_]*(\d+)$/i;

function formatSlotCredentialWithRefresh(rawAuth, { refreshToken, clientId, clientSecret, resource, tokenEndpoint }) {
    if (!rawAuth && !refreshToken) {
        return "";
    }
    if (rawAuth && (rawAuth.startsWith("[") || rawAuth.includes("\n") || rawAuth.startsWith("{"))) {
        return rawAuth;
    }
    if (refreshToken) {
        return JSON.stringify({
            ...(rawAuth ? { access_token: stripBearerPrefix(rawAuth) } : {}),
            refresh_token: refreshToken,
            client_id: clientId || DEFAULT_OPUS_WORKOS_CLIENT_ID,
            ...(clientSecret ? { client_secret: clientSecret } : {}),
            ...(resource ? { resource } : {}),
            token_endpoint: tokenEndpoint
        });
    }
    return rawAuth;
}

function collectOpusSlotEntriesFromSuffix(targetList, env, suffix = "") {
    const tokenEndpoint = envValue(env, "OPUS_OAUTH_TOKEN_URL") || OPUS_OAUTH_TOKEN_URL;
    const refreshToken = envValue(env, `OPUS_REFRESH_TOKEN${suffix}`);
    const clientId = envValue(env, `OPUS_CLIENT_ID${suffix}`)
        || envValue(env, "OPUS_CLIENT_ID")
        || DEFAULT_OPUS_WORKOS_CLIENT_ID;
    const clientSecret = envValue(env, `OPUS_CLIENT_SECRET${suffix}`)
        || envValue(env, "OPUS_CLIENT_SECRET");
    const resource = envValue(env, `OPUS_RESOURCE_URL${suffix}`)
        || envValue(env, "OPUS_RESOURCE_URL");

    let refreshAttached = false;
    for (const stem of OPUS_CREDENTIAL_KEY_STEMS) {
        const rawAuth = unwrapOuterQuotes(envValue(env, `${stem}${suffix}`));
        if (!rawAuth) continue;
        const formatted = formatSlotCredentialWithRefresh(rawAuth, {
            refreshToken: !refreshAttached ? refreshToken : "",
            clientId,
            clientSecret,
            resource,
            tokenEndpoint
        });
        refreshAttached = true;
        if (formatted) {
            appendExpandedRawEntries(targetList, formatted);
        }
    }

    if (!refreshAttached && refreshToken) {
        const refreshOnly = formatSlotCredentialWithRefresh("", {
            refreshToken,
            clientId,
            clientSecret,
            resource,
            tokenEndpoint
        });
        if (refreshOnly) {
            appendExpandedRawEntries(targetList, refreshOnly);
        }
    }
}

function credentialDedupeKey(rawEntry) {
    const text = unwrapOuterQuotes(rawEntry);
    if (text.startsWith("{") && text.endsWith("}")) {
        try {
            const parsed = JSON.parse(text);
            if (parsed && typeof parsed === "object") {
                const rt = String(parsed.refresh_token || parsed.refreshToken || "").trim();
                const cid = String(parsed.client_id || parsed.clientId || DEFAULT_OPUS_WORKOS_CLIENT_ID).trim();
                const at = stripBearerPrefix(parsed.access_token || parsed.accessToken || parsed.token || parsed.auth_token || "");
                if (rt) return `rt:${cid}:${rt}`;
                if (at) return `at:${at}`;
            }
        } catch {
            /* lanjut */
        }
    }
    return `at:${stripBearerPrefix(text)}`;
}

export function collectOpusCredentialEntries(env, extraRawInput = "") {
    const rawList = [];
    if (extraRawInput && String(extraRawInput).trim()) {
        appendExpandedRawEntries(rawList, extraRawInput);
    }

    for (const multiKeyName of ["OPUS_AUTH_TOKENS", "OPUS_API_KEYS", "OPUS_TOKENS"]) {
        const multiEnv = unwrapOuterQuotes(envValue(env, multiKeyName));
        if (multiEnv) {
            appendExpandedRawEntries(rawList, multiEnv);
        }
    }

    /* Slot utama tanpa akhiran angka (OPUS_AUTH_TOKEN, OPUS_API_KEY, dst.) */
    collectOpusSlotEntriesFromSuffix(rawList, env, "");

    /* Slot bernomor 1..20 baik dengan underscore (_2) maupun tanpa underscore (2) */
    for (let slot = 1; slot <= MAX_OPUS_ENV_KEY_SLOTS; slot += 1) {
        collectOpusSlotEntriesFromSuffix(rawList, env, `_${slot}`);
        collectOpusSlotEntriesFromSuffix(rawList, env, `${slot}`);
    }

    /* Pemindaian dinamis seluruh key env (case-insensitive & slot > 20) */
    const dynamicCandidates = [];
    const seenEnvSources = [
        env && typeof env === "object" ? env : null,
        typeof process !== "undefined" && process?.env ? process.env : null
    ];
    const visitedPropNames = new Set();
    for (const source of seenEnvSources) {
        if (!source) continue;
        for (const propName of Object.keys(source)) {
            if (visitedPropNames.has(propName)) continue;
            visitedPropNames.add(propName);
            const match = DYNAMIC_OPUS_SLOT_PATTERN.exec(propName);
            if (!match) continue;
            const val = unwrapOuterQuotes(source[propName]);
            if (!val) continue;
            dynamicCandidates.push({
                slot: Number.parseInt(match[1], 10) || 0,
                propName,
                value: val
            });
        }
    }
    dynamicCandidates.sort((a, b) => (a.slot - b.slot) || a.propName.localeCompare(b.propName));
    for (const item of dynamicCandidates) {
        appendExpandedRawEntries(rawList, item.value);
    }

    const deduped = [];
    const seen = new Set();
    for (const item of rawList) {
        const clean = String(item || "").trim();
        if (!clean) continue;
        const key = credentialDedupeKey(clean);
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(clean);
    }
    return deduped;
}

function buildScopedOpusEnvForEntry(env, rawEntry) {
    const base = env && typeof env === "object" ? { ...env } : {};
    base.OPUS_AUTH_TOKEN = rawEntry;
    base.OPUS_ACCESS_TOKEN = "";
    base.OPUSCLIP_API_KEY = "";
    base.OPUS_REFRESH_TOKEN = "";
    return base;
}

export async function resolveOpusApiKeyPoolPayload(env, extraRawInput = "") {
    const entries = collectOpusCredentialEntries(env, extraRawInput);
    if (entries.length === 0) {
        return "";
    }
    if (entries.length === 1) {
        return entries[0];
    }
    return JSON.stringify({
        opus_key_pool: entries
    });
}

export function opusConfigured(env) {
    const entries = collectOpusCredentialEntries(env);
    if (entries.length > 0) return true;
    const creds = parseOpusCredentialConfig(env);
    return Boolean(creds.accessToken || (creds.refreshToken && creds.clientId));
}

function canonicalOpusModelAlias(raw) {
    const cleaned = String(raw || "").trim();
    if (!cleaned) return "";
    const normalized = cleaned.toLowerCase().replace(/[\s_]+/g, "-");
    if (
        normalized === "gpt-image-2.5-flare"
        || normalized === "gpt-image-2-5-flare"
        || normalized === "flare"
    ) {
        return "gpt-image-2.5-flare";
    }
    if (
        normalized === "gpt-image-2.5-sunburst"
        || normalized === "gpt-image-2-5-sunburst"
        || normalized === "sunburst"
    ) {
        return "gpt-image-2.5-sunburst";
    }
    return "";
}

/**
 * Normalisasi pilihan model Opus Product Ad Studio.
 * Mengutamakan dua model resmi (`gpt-image-2.5-flare` & `gpt-image-2.5-sunburst`),
 * mengabaikan sisa nama model provider lain (mis. `qwen-image-3.0-pro`), namun
 * tetap menghormati override eksplisit `OPUS_IMAGE_MODEL` di environment.
 */
export function normalizeOpusImageModel(value, env = null) {
    const directAlias = canonicalOpusModelAlias(value);
    if (directAlias) return directAlias;

    const envRaw = env ? envValue(env, "OPUS_IMAGE_MODEL") : "";
    if (envRaw) {
        return canonicalOpusModelAlias(envRaw) || envRaw;
    }

    return OPUS_DEFAULT_IMAGE_MODEL;
}

export function opusImageModel(env, preferredModel = "") {
    return normalizeOpusImageModel(preferredModel, env);
}

export function opusImageQuality(env, preferredQuality = "") {
    const raw = String(preferredQuality || "").trim().toLowerCase()
        || envValue(env, "OPUS_IMAGE_QUALITY").toLowerCase();
    if (["low", "medium", "high", "xhigh", "max", "auto"].includes(raw)) {
        return raw;
    }
    return OPUS_DEFAULT_IMAGE_QUALITY;
}

export function resolveOpusAspectRatio(env, aspectRatio = OPUS_DEFAULT_ASPECT_RATIO) {
    if (envValue(env, "OPUS_ALLOW_CUSTOM_ASPECT_RATIO") === "1" && String(aspectRatio) === "16:9") {
        return "16:9";
    }
    return OPUS_DEFAULT_ASPECT_RATIO;
}

function opusPixelSizeForAspectRatio(aspectRatio) {
    return aspectRatio === "16:9" ? "1536x1024" : "1024x1536";
}

function bytesToDataUri(bytes, mimeType) {
    const mime = String(mimeType || "image/jpeg").toLowerCase();
    return `data:${mime};base64,${bytesToBase64(bytes)}`;
}

async function computeSha256Hex(bytes) {
    if (!bytes?.byteLength || typeof crypto === "undefined" || !crypto.subtle) return "";
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
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
 * Baca dimensi asli PNG/JPEG/WebP (VP8, VP8L, VP8X) dari header biner.
 * Mengembalikan null bila tidak terbaca supaya ukuran tidak pernah direka-reka.
 */
export function readImageSize(bytes) {
    return readImageDimensions(bytes);
}

function extForOpusMime(mimeType) {
    const mime = String(mimeType || "").toLowerCase();
    if (mime.includes("png")) return "png";
    if (mime.includes("webp")) return "webp";
    return "jpg";
}

function inferMimeFromUrl(url) {
    const cleanPath = String(url || "").split(/[?#]/, 1)[0].toLowerCase();
    if (cleanPath.endsWith(".png")) return "image/png";
    if (cleanPath.endsWith(".webp")) return "image/webp";
    return "image/jpeg";
}

function makeUuid() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, ch => {
        const rand = Math.floor(Math.random() * 16);
        const val = ch === "x" ? rand : ((rand & 0x3) | 0x8);
        return val.toString(16);
    });
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
    const providerMessage = String(message || "").trim().slice(0, 560) || "tanpa pesan";
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

    if (
        normalizedCode === "content_policy"
        || /content[_\s-]*policy|safety[_\s-]*violations|rejected by the safety system|safety|moderation/i.test(providerMessage)
    ) {
        const error = new Error(
            `Permintaan gambar ditolak kebijakan konten Opus (${normalizedCode || "content_policy"})${jobNote}: ${providerMessage}.`
        );
        error.status = 422;
        error.code = "content_policy";
        error.isContentPolicyRejection = true;
        return error;
    }

    if (normalizedCode === "rate_limit_exceeded" || httpStatus === 429 || /rate[_\s-]*limit|daily cap/i.test(providerMessage)) {
        const error = new Error(
            `Batas laju atau batas harian Opus tercapai (${normalizedCode || "HTTP 429"}): ${providerMessage}. Coba lagi beberapa saat kemudian.`
        );
        error.status = 429;
        return error;
    }

    if (normalizedCode === "invalid_frame_dimensions" || /between\s+300px\s+and\s+6000px/i.test(providerMessage)) {
        const error = new Error(
            `Dimensi gambar referensi ditolak Opus Labs (${normalizedCode || "invalid_frame_dimensions"}): ${providerMessage}. `
            + "Opus Labs mensyaratkan kedua sisi gambar referensi berukuran antara 300px hingga 6000px (kredit akun OpusClip tidak terpotong)."
        );
        error.status = httpStatus >= 400 && httpStatus <= 499 ? httpStatus : 422;
        error.code = "invalid_frame_dimensions";
        return error;
    }

    if (normalizedCode === "job_queue_timeout" || normalizedCode === "queue_timeout" || /\bjob_queue_timeout\b|\bqueue_timeout\b/i.test(providerMessage)) {
        const error = new Error(
            `Antrian worker gambar di server Opus Labs sedang padat/timeout (${normalizedCode || "job_queue_timeout"})${jobNote}: ${providerMessage}. `
            + "Silakan coba lagi beberapa saat kemudian."
        );
        error.status = 504;
        error.code = "job_queue_timeout";
        return error;
    }

    const error = new Error(
        `Opus Labs gagal membuat gambar${normalizedCode ? ` (${normalizedCode})` : ""}${jobNote}: ${providerMessage}`
    );
    error.status = httpStatus >= 400 && httpStatus <= 599 ? httpStatus : 502;
    if (normalizedCode) error.code = normalizedCode;
    return error;
}

/**
 * Deteksi apakah kegagalan Opus disebabkan oleh penolakan kebijakan konten /
 * safety system (mis. `content_policy`, `safety_violations=[sexual]`, atau
 * `"Permintaan gambar ditolak kebijakan konten Opus ..."`).
 * Pada kondisi ini server Opus/gateway menolak sebelum job diproses sehingga
 * kredit tidak terpotong dan sistem aman untuk langsung membuat ulang gambar
 * baru tanpa menunggu interval jadwal berikutnya.
 */
export function isOpusContentPolicyError(error) {
    if (!error) return false;
    if (typeof error === "object" && (error.isContentPolicyRejection === true || error.code === "content_policy")) {
        return true;
    }
    const message = typeof error === "string"
        ? error
        : String(error?.message || "");
    if (!message) return false;
    return /Permintaan gambar ditolak kebijakan konten Opus/i.test(message)
        || /\b(?:content[_\s-]*policy|safety[_\s-]*violations)\b|rejected by the safety system/i.test(message);
}

async function refreshOpusAccessToken(creds) {
    const cacheKey = `${creds.tokenEndpoint}|${creds.clientId}|${creds.refreshToken}|${creds.resource || ""}`;
    const buildRefreshForm = ({ includeResourceAndScope }) => {
        const form = new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: creds.refreshToken,
            client_id: creds.clientId
        });
        if (creds.clientSecret) {
            form.set("client_secret", creds.clientSecret);
        }
        if (includeResourceAndScope) {
            if (creds.resource) form.set("resource", creds.resource);
            if (creds.scope) form.set("scope", creds.scope);
        }
        return form;
    };

    const sendRefresh = async form => {
        const res = await fetch(creds.tokenEndpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Accept: "application/json"
            },
            body: form.toString()
        });
        const json = await res.json().catch(() => null);
        return { response: res, payload: json };
    };

    let { response, payload } = await sendRefresh(
        buildRefreshForm({ includeResourceAndScope: Boolean(creds.resource || creds.scope) })
    );
    if (
        (!response.ok || !payload?.access_token)
        && (creds.resource || creds.scope)
        && /^(invalid_target|invalid_scope)$/i.test(String(payload?.error || ""))
    ) {
        ({ response, payload } = await sendRefresh(
            buildRefreshForm({ includeResourceAndScope: false })
        ));
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

export async function resolveOpusBearerToken(env, { forceRefresh = false } = {}) {
    const creds = parseOpusCredentialConfig(env);
    if (!creds.accessToken && !(creds.refreshToken && creds.clientId)) {
        const error = new Error(
            "OPUS_AUTH_TOKEN belum dikonfigurasi. Hubungkan akun OpusClip/Opus Labs (product-ad-studio.labs.opus.pro / labs.opus.pro/opus-video-tools/mcp) lalu simpan Bearer token OAuth sebagai secret Worker OPUS_AUTH_TOKEN (atau pasangan OPUS_REFRESH_TOKEN + OPUS_CLIENT_ID). Catatan: setiap gambar memotong kredit akun OpusClip Anda sendiri, bukan kredit GEN-Z.AI."
        );
        error.status = 503;
        throw error;
    }

    if (creds.refreshToken && creds.clientId) {
        try {
            const resolved = await resolveOpusOAuthTokenWithVault({
                env,
                tokenEndpoint: creds.tokenEndpoint || OPUS_OAUTH_TOKEN_URL,
                clientId: creds.clientId,
                clientSecret: creds.clientSecret,
                resource: creds.resource,
                scope: creds.scope,
                accessToken: creds.accessToken,
                refreshToken: creds.refreshToken,
                expiresAtMs: creds.expiresAtMs,
                forceRefresh
            });
            return {
                token: resolved.accessToken,
                canRefresh: Boolean(resolved.canRefresh),
                creds: {
                    ...creds,
                    refreshToken: resolved.refreshToken || creds.refreshToken
                }
            };
        } catch (err) {
            throw opusError({
                code: err?.oauthErrorCode || "invalid_grant",
                message: err?.oauthDetail || err?.message || `Refresh token OAuth Opus gagal (HTTP ${err?.status || 401}).`,
                status: err?.status === 400 ? 401 : (err?.status || 401)
            });
        }
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

async function extractImageFromValue(value, bearerToken, seen = new WeakSet()) {
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
            const extracted = await extractImageFromValue(item, bearerToken, seen);
            if (extracted) return extracted;
        }
        return null;
    }
    if (typeof value === "object") {
        if (seen.has(value)) return null;
        seen.add(value);
        if (value.type === "image" && typeof value.data === "string" && value.data.trim()) {
            return finalizeVerifiedImage(
                base64ToBytes(value.data.replace(/\s+/g, "")),
                value.mimeType || value.mime_type || "image/png"
            );
        }
        if (value.type === "resource" && value.resource && typeof value.resource === "object") {
            if (typeof value.resource.blob === "string" && value.resource.blob.trim()) {
                return finalizeVerifiedImage(
                    base64ToBytes(value.resource.blob.replace(/\s+/g, "")),
                    value.resource.mimeType || value.resource.mime_type || "image/png"
                );
            }
            if (typeof value.resource.uri === "string" && /^(?:https?:\/\/|data:image\/)/i.test(value.resource.uri.trim())) {
                const extracted = await extractImageFromValue(value.resource.uri.trim(), bearerToken, seen);
                if (extracted) return extracted;
            }
        }
        if (value.type === "text" && typeof value.text === "string" && value.text.trim()) {
            const trimmedText = value.text.trim();
            if (/^data:image\//i.test(trimmedText) || /^https?:\/\/\S+$/i.test(trimmedText)) {
                const extracted = await extractImageFromValue(trimmedText, bearerToken, seen);
                if (extracted) return extracted;
            }
            const parsedTextJson = tryParseJsonFromText(trimmedText);
            if (parsedTextJson && typeof parsedTextJson === "object") {
                const extracted = await extractImageFromValue(parsedTextJson, bearerToken, seen);
                if (extracted) return extracted;
            }
        }
        const directKeys = [
            "downloadUrl",
            "download_url",
            "presignedUrl",
            "presigned_url",
            "signedUrl",
            "signed_url",
            "imageUrl",
            "image_url",
            "fileUrl",
            "file_url",
            "assetUrl",
            "asset_url",
            "cdnUrl",
            "cdn_url",
            "outputUrl",
            "output_url",
            "resultUrl",
            "result_url",
            "renderUrl",
            "render_url",
            "renderedUrl",
            "rendered_url",
            "publicUrl",
            "public_url",
            "sourceUrl",
            "source_url",
            "storageUrl",
            "storage_url",
            "readUrl",
            "read_url",
            "mediaUrl",
            "media_url",
            "keyframeUrl",
            "keyframe_url",
            "artifactUrl",
            "artifact_url",
            "previewUrl",
            "preview_url",
            "thumbnailUrl",
            "thumbnail_url",
            "mediaBase64",
            "media_base64",
            "url",
            "uri",
            "src",
            "href",
            "data_url",
            "dataUrl",
            "b64_json",
            "base64",
            "blob",
            "data"
        ];
        for (const key of directKeys) {
            if (typeof value[key] === "string" && value[key].trim()) {
                const extracted = await extractImageFromValue(value[key], bearerToken, seen);
                if (extracted) return extracted;
            }
        }
        for (const [dynKey, dynVal] of Object.entries(value)) {
            if (
                typeof dynVal === "string"
                && /(?:url|uri|src|href)$/i.test(dynKey)
                && !/(?:upload|put|post|presign_put|callback|webhook|reference|input)/i.test(dynKey)
                && /^(?:https?:\/\/|data:image\/)/i.test(dynVal.trim())
            ) {
                const extracted = await extractImageFromValue(dynVal.trim(), bearerToken, seen);
                if (extracted) return extracted;
            }
        }
        const nestedKeys = [
            "outputs",
            "keyframes",
            "images",
            "frames",
            "jobs",
            "results",
            "files",
            "downloads",
            "deliverables",
            "generatedThumbnailUris",
            "assets",
            "items",
            "artifacts",
            "submissions",
            "operations",
            "tasks",
            "generations",
            "records",
            "entries",
            "batches",
            "media",
            "resolved",
            "result",
            "output",
            "data",
            "payload",
            "response",
            "submission",
            "operation",
            "task",
            "generation",
            "record",
            "entry",
            "batch",
            "resource",
            "content",
            "keyframe",
            "image",
            "asset"
        ];
        for (const key of nestedKeys) {
            if (value[key] !== undefined && value[key] !== null) {
                const extracted = await extractImageFromValue(value[key], bearerToken, seen);
                if (extracted) return extracted;
            }
        }
        const dynamicEntries = Object.values(value);
        if (dynamicEntries.length <= 60) {
            for (const subVal of dynamicEntries) {
                if (subVal && typeof subVal === "object") {
                    const extracted = await extractImageFromValue(subVal, bearerToken, seen);
                    if (extracted) return extracted;
                }
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
            Accept: "application/json, text/event-stream",
            "MCP-Protocol-Version": MCP_PROTOCOL_VERSION
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
            const wwwAuth = response.headers.get("www-authenticate") || response.headers.get("WWW-Authenticate") || "";
            const wwwErrCode = extractFieldFromWwwAuthenticate(wwwAuth, "error");
            const wwwErrDesc = extractFieldFromWwwAuthenticate(wwwAuth, "error_description");
            throw opusError({
                code: errObj?.code || errObj?.error || wwwErrCode || "",
                message: errObj?.message
                    || errObj?.error_description
                    || wwwErrDesc
                    || rawText
                    || `HTTP ${response.status} dari ${this.url}`,
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
            const rpcCode = rpcErr.code === -32602
                ? "invalid_arguments"
                : (rpcErr.data?.errorCode || rpcErr.data?.code || rpcErr.code || "");
            const rpcDetail = formatValidationDetails(rpcErr.data?.issues || rpcErr.data?.details || rpcErr.data);
            const rpcMessage = [rpcErr.message, rpcDetail].filter(Boolean).join(" — ") || JSON.stringify(rpcErr);
            throw opusError({
                code: rpcCode,
                message: rpcMessage,
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

function tryParseJsonFromText(rawText) {
    const trimmed = String(rawText || "").trim();
    if (!trimmed) return null;
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try {
            return JSON.parse(trimmed);
        } catch {
            /* Lanjut coba ekstraksi blok JSON di bawah. */
        }
    }
    const fenceMatch = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
    if (fenceMatch && fenceMatch[1]) {
        const candidate = fenceMatch[1].trim();
        if (candidate.startsWith("{") || candidate.startsWith("[")) {
            try {
                return JSON.parse(candidate);
            } catch {
                /* Abaikan blok kode non-JSON. */
            }
        }
    }
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
        try {
            return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
        } catch {
            /* Abaikan bila bukan objek JSON utuh. */
        }
    }
    const firstBracket = trimmed.indexOf("[");
    const lastBracket = trimmed.lastIndexOf("]");
    if (firstBracket >= 0 && lastBracket > firstBracket) {
        try {
            return JSON.parse(trimmed.slice(firstBracket, lastBracket + 1));
        } catch {
            /* Abaikan bila bukan array JSON utuh. */
        }
    }
    return null;
}

function unpackMcpToolResult(result) {
    if (!result || typeof result !== "object") {
        return { isError: false, data: result, content: [], text: "" };
    }
    const content = Array.isArray(result.content) ? result.content : [];
    let data = result.structuredContent !== undefined ? result.structuredContent : null;
    const isEmptyStructuredObj = Boolean(
        data
        && typeof data === "object"
        && !Array.isArray(data)
        && Object.keys(data).length === 0
    );
    if (isEmptyStructuredObj && content.length > 0) {
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
    if (!data && isEmptyStructuredObj) {
        data = result.structuredContent;
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

/* =========================================================
   JSON SCHEMA INTROSPECTION ENGINE
   Membaca live `tool.inputSchema` dari `tools/list` (termasuk
   `$ref`, `anyOf`, `oneOf`, `allOf`, `enum`, `const`, `items`,
   dan `required`) agar argumen MCP cocok dengan kontrak server.
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
                    const chosen = (typeof preferBranch === "function" && objBranches.find(preferBranch))
                        || objBranches[0];
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

function resolveArrayItemObjectVariants(schema, rootSchema) {
    const itemSchema = resolveArrayItemSchema(schema, rootSchema);
    if (!itemSchema) return [];
    const branches = [];
    for (const combinator of ["oneOf", "anyOf"]) {
        if (Array.isArray(itemSchema[combinator])) {
            for (const sub of itemSchema[combinator]) {
                const resolved = resolveObjectSchema(sub, rootSchema);
                if (resolved.properties) branches.push(resolved);
            }
        }
    }
    if (!branches.length) {
        branches.push(resolveObjectSchema(itemSchema, rootSchema));
    }
    return branches;
}

function schemaTypeIncludes(schema, rootSchema, targetType) {
    const variants = collectSchemaVariants(schema, rootSchema);
    for (const variant of variants) {
        if (variant.type === targetType) return true;
        if (Array.isArray(variant.type) && variant.type.includes(targetType)) return true;
        if (targetType === "array" && variant.items) return true;
        if (targetType === "object" && variant.properties) return true;
    }
    return false;
}

function pickSupportedKey(props, candidates, fallback = "") {
    if (!props) return fallback;
    for (const key of candidates) {
        if (Object.prototype.hasOwnProperty.call(props, key)) return key;
    }
    return "";
}

function normalizeToken(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/^[a-z0-9_-]+\//, "")
        .replace(/[\s_.]+/g, "-");
}

function matchEnumCandidate(candidates, allowedValues) {
    if (!allowedValues || !allowedValues.length) return candidates[0] ?? null;
    for (const candidate of candidates) {
        if (candidate === null || candidate === undefined || candidate === "") continue;
        const exact = allowedValues.find(v => v === candidate);
        if (exact !== undefined) return exact;
        const lower = String(candidate).toLowerCase();
        const caseInsensitive = allowedValues.find(v => String(v).toLowerCase() === lower);
        if (caseInsensitive !== undefined) return caseInsensitive;
        const norm = normalizeToken(candidate);
        const normalizedMatch = allowedValues.find(v => normalizeToken(v) === norm);
        if (normalizedMatch !== undefined) return normalizedMatch;
    }
    return null;
}

function matchModelValue(resolvedModel, allowedValues) {
    if (!resolvedModel) return null;
    if (!allowedValues || !allowedValues.length) return resolvedModel;
    const direct = matchEnumCandidate([resolvedModel], allowedValues);
    if (direct !== null) return direct;

    const lowerModel = resolvedModel.toLowerCase();
    const variantKeywords = [];
    if (lowerModel.includes("flare")) variantKeywords.push("flare");
    if (lowerModel.includes("sunburst")) variantKeywords.push("sunburst");
    variantKeywords.push("gpt-image-2.5", "gpt-image-2-5", "gpt-image");

    for (const kw of variantKeywords) {
        const hit = allowedValues.find(v => String(v).toLowerCase().includes(kw));
        if (hit !== undefined) return hit;
    }
    return null;
}

function matchAspectRatioValue(ratio, allowedValues) {
    const candidates = ratio === "16:9"
        ? ["16:9", "16x9", "16_9", "landscape", "horizontal", "wide", "1536x1024", "1920x1080"]
        : ["9:16", "9x16", "9_16", "portrait", "vertical", "tall", "1024x1536", "1080x1920"];
    return matchEnumCandidate(candidates, allowedValues);
}

function matchQualityValue(quality, allowedValues) {
    const q = String(quality || OPUS_DEFAULT_IMAGE_QUALITY).toLowerCase();
    const candidates = q === "low"
        ? ["low", "standard", "fast", "draft", "1k", "auto", "medium"]
        : [q, "standard", "auto"];
    return matchEnumCandidate(candidates, allowedValues);
}

function matchSizeValue(ratio, allowedValues) {
    const candidates = ratio === "16:9"
        ? ["1536x1024", "1920x1080", "1280x720", "landscape", "16:9"]
        : ["1024x1536", "1080x1920", "720x1280", "portrait", "9:16"];
    return matchEnumCandidate(candidates, allowedValues);
}

function matchRoleValue(role, allowedValues) {
    const isPerson = String(role || "").toLowerCase() === "person";
    const candidates = isPerson
        ? ["person", "character", "subject", "human", "talent", "avatar", "identity", "anchor", "model", "reference", "image", "input"]
        : ["product", "garment", "outfit", "apparel", "item", "object", "brand", "subject", "reference", "image", "input"];
    return matchEnumCandidate(candidates, allowedValues);
}

function fillMissingRequiredFields(targetObj, objectSchema, rootSchema, context = {}) {
    const props = objectSchema?.properties;
    const required = Array.isArray(objectSchema?.required) ? objectSchema.required : [];
    if (!props || !required.length) return targetObj;

    for (const key of required) {
        if (targetObj[key] !== undefined) continue;
        const propSchema = derefSchema(props[key], rootSchema) || {};
        if (propSchema.const !== undefined) {
            targetObj[key] = propSchema.const;
            continue;
        }
        if (propSchema.default !== undefined) {
            targetObj[key] = propSchema.default;
            continue;
        }
        const allowed = extractAllowedValues(propSchema, rootSchema);
        if (allowed.length > 0) {
            const lowerKey = key.toLowerCase();
            if (lowerKey.includes("aspect") || lowerKey.includes("ratio")) {
                targetObj[key] = matchAspectRatioValue(context.ratio || "9:16", allowed) ?? allowed[0];
            } else if (lowerKey.includes("model")) {
                targetObj[key] = matchModelValue(context.model || "", allowed) ?? allowed[0];
            } else if (lowerKey.includes("quality")) {
                targetObj[key] = matchQualityValue(context.quality || "low", allowed) ?? allowed[0];
            } else if (lowerKey.includes("workflow") || lowerKey.includes("mode")) {
                const preferred = matchEnumCandidate(
                    context.hasReferences
                        ? ["reference2image", "image2image", "reference", "keyframe", "image", "default", "text2image"]
                        : ["text2image", "keyframe", "image", "default", "reference2image"],
                    allowed
                );
                targetObj[key] = preferred ?? allowed[0];
            } else {
                targetObj[key] = allowed[0];
            }
            continue;
        }
        if (schemaTypeIncludes(propSchema, rootSchema, "string")) {
            const lowerKey = key.toLowerCase();
            if (propSchema.format === "uri" || propSchema.format === "url" || /(?:^|_)url$|(?:^|_)uri$/i.test(key)) {
                if (context.remoteUrl) {
                    targetObj[key] = context.remoteUrl;
                }
                continue;
            }
            if (propSchema.format === "uuid" || lowerKey.endsWith("requestkey") || lowerKey.endsWith("idempotencykey")) {
                targetObj[key] = makeUuid();
            } else if (lowerKey.includes("prompt") || lowerKey.includes("description") || lowerKey.includes("brief")) {
                targetObj[key] = String(context.prompt || "Product editorial portrait").trim();
            } else if (lowerKey.includes("project") && context.projectId) {
                targetObj[key] = context.projectId;
            } else {
                targetObj[key] = context.defaultLabel || "kf-1";
            }
            continue;
        }
        if (schemaTypeIncludes(propSchema, rootSchema, "integer") || schemaTypeIncludes(propSchema, rootSchema, "number")) {
            const min = typeof propSchema.minimum === "number" ? propSchema.minimum : 1;
            targetObj[key] = min > 0 ? min : 1;
            continue;
        }
        if (schemaTypeIncludes(propSchema, rootSchema, "boolean")) {
            if (!/duplicate|acknowledge|force/i.test(key)) {
                targetObj[key] = false;
            }
            continue;
        }
        if (schemaTypeIncludes(propSchema, rootSchema, "array")) {
            targetObj[key] = [];
        }
    }
    return targetObj;
}

function summarizeToolSchema(tool) {
    const rootSchema = tool?.inputSchema;
    const obj = resolveObjectSchema(rootSchema, rootSchema);
    if (!obj.properties) return "";
    const keys = Object.keys(obj.properties);
    const parts = [`keys=[${keys.join(",")}]`];
    if (obj.required.length) {
        parts.push(`required=[${obj.required.join(",")}]`);
    }
    const describeEnums = (propsMap, prefix = "") => {
        for (const [k, propSchema] of Object.entries(propsMap)) {
            if (/model|aspect|ratio|quality|workflow|mode|role/i.test(k)) {
                const allowed = extractAllowedValues(propSchema, rootSchema);
                if (allowed.length > 0 && allowed.length <= 12) {
                    parts.push(`${prefix}${k}.enum=[${allowed.join("|")}]`);
                }
            }
        }
    };
    describeEnums(obj.properties);
    for (const k of keys) {
        const itemSchema = resolveArrayItemSchema(obj.properties[k], rootSchema);
        if (itemSchema) {
            const itemObj = resolveObjectSchema(itemSchema, rootSchema);
            if (itemObj.properties) {
                parts.push(`${k}[].keys=[${Object.keys(itemObj.properties).join(",")}]`);
                if (itemObj.required.length) {
                    parts.push(`${k}[].required=[${itemObj.required.join(",")}]`);
                }
                describeEnums(itemObj.properties, `${k}[].`);
            }
        }
    }
    return parts.join(" ");
}

function prepareInlineReferenceVariants(bytes, mimeType) {
    const fallbackMime = String(mimeType || "image/jpeg").toLowerCase();
    if (!bytes?.byteLength) {
        return {
            bytes: null,
            inlineBytes: null,
            inlineMime: fallbackMime,
            dataUri: "",
            compactDataUri: "",
            dropRemoteUrl: false
        };
    }

    const detectedMime = detectImageMime(bytes);
    let workingBytes = bytes;
    let workingMime = String(detectedMime || mimeType || "image/jpeg").toLowerCase();
    let dropRemoteUrl = false;

    /*
     * Opus Labs mewajibkan kedua sisi gambar referensi berada di antara 300px dan 6000px.
     * PENTING UNTUK MENCEGAH ERROR 1102 ("Worker exceeded resource limits"):
     * - Bila dimensi gambar asli SUDAH valid di dalam [300, 6000], JANGAN men-decode
     *   atau me-resize piksel sama sekali di depan (0 ms CPU, 0 MB alokasi RGBA).
     * - Normalisasi hanya dijalankan saat dimensi melanggar batas [300, 6000].
     * - String base64/dataUri maupun varian compact hanya dihitung secara LAZY
     *   bila kandidat `import_assets` benar-benar membutuhkan mode inline base64.
     */
    const origSize = readImageSize(bytes);
    if (
        origSize
        && (
            origSize.width < OPUS_MIN_REFERENCE_DIMENSION
            || origSize.height < OPUS_MIN_REFERENCE_DIMENSION
            || origSize.width > OPUS_MAX_REFERENCE_DIMENSION
            || origSize.height > OPUS_MAX_REFERENCE_DIMENSION
        )
    ) {
        const normalized = normalizeReferenceImageBounds(bytes, workingMime, {
            triggerMinSide: OPUS_MIN_REFERENCE_DIMENSION,
            minSide: 512,
            triggerMaxSide: OPUS_MAX_REFERENCE_DIMENSION,
            maxSide: 2048,
            quality: 90
        });
        if (!normalized?.resized || !normalized.bytes?.byteLength) {
            throw opusError({
                code: "invalid_frame_dimensions",
                message: `Ukuran gambar referensi (${origSize.width}x${origSize.height}px) berada di luar batas Opus Labs (300px–6000px di kedua sisi) dan format ${workingMime} tidak dapat disesuaikan otomatis. Unggah ulang gambar PNG/JPEG beresolusi minimal 300x300 piksel.`,
                status: 400
            });
        }
        workingBytes = normalized.bytes;
        workingMime = normalized.mimeType || "image/jpeg";
        dropRemoteUrl = true;
    }

    return {
        bytes: workingBytes,
        inlineBytes: workingBytes,
        inlineMime: workingMime,
        dataUri: "",
        compactDataUri: "",
        dropRemoteUrl
    };
}

function ensureItemDataUri(item, { compact = false } = {}) {
    if (!item) return "";
    if (!compact) {
        if (item.dataUri) return item.dataUri;
        const srcBytes = item.inlineBytes || item.bytes;
        if (!srcBytes?.byteLength) return "";
        item.dataUri = bytesToDataUri(srcBytes, item.mimeType || "image/jpeg");
        return item.dataUri;
    }
    if (item.compactDataUri) return item.compactDataUri;
    const srcBytes = item.inlineBytes || item.bytes;
    if (!srcBytes?.byteLength) return ensureItemDataUri(item, { compact: false });
    if (srcBytes.byteLength > 90_000) {
        const shrunk = normalizeReferenceImageBounds(srcBytes, item.mimeType || "image/jpeg", {
            triggerMinSide: OPUS_MIN_REFERENCE_DIMENSION,
            minSide: 320,
            triggerMaxSide: 640,
            maxSide: 640,
            quality: 82
        });
        if (shrunk?.resized && shrunk.bytes?.byteLength && shrunk.bytes.byteLength < srcBytes.byteLength) {
            item.compactDataUri = bytesToDataUri(shrunk.bytes, shrunk.mimeType || "image/jpeg");
            return item.compactDataUri;
        }
    }
    return ensureItemDataUri(item, { compact: false });
}

function collectReferenceInputs({
    referenceBytes,
    referenceMimeType,
    personImageUrl,
    garmentBytes,
    garmentMimeType,
    garmentImageUrls,
    extraReferenceImages,
    referenceImages
}) {
    const items = [];
    if (referenceBytes?.byteLength) {
        const prepared = prepareInlineReferenceVariants(referenceBytes, referenceMimeType || "image/jpeg");
        const cleanPersonUrl = typeof personImageUrl === "string" ? personImageUrl.trim() : "";
        items.push({
            role: "person",
            label: "character_reference",
            bytes: prepared.bytes,
            inlineBytes: prepared.inlineBytes,
            mimeType: prepared.inlineMime,
            fileName: `character.${extForOpusMime(prepared.inlineMime)}`,
            dataUri: prepared.dataUri,
            compactDataUri: prepared.compactDataUri,
            url: prepared.dropRemoteUrl ? "" : cleanPersonUrl
        });
    } else if (typeof personImageUrl === "string" && personImageUrl.trim()) {
        const cleanPersonUrl = personImageUrl.trim();
        const urlMime = inferMimeFromUrl(cleanPersonUrl);
        items.push({
            role: "person",
            label: "character_reference",
            bytes: null,
            inlineBytes: null,
            mimeType: urlMime,
            fileName: `character.${extForOpusMime(urlMime)}`,
            dataUri: "",
            compactDataUri: "",
            url: cleanPersonUrl
        });
    }

    const cleanGarmentUrls = Array.isArray(garmentImageUrls)
        ? garmentImageUrls.map(u => (typeof u === "string" ? u.trim() : "")).filter(Boolean)
        : [];
    let garmentUrlStartIndex = 0;

    if (garmentBytes?.byteLength) {
        const prepared = prepareInlineReferenceVariants(garmentBytes, garmentMimeType || "image/jpeg");
        const pairedUrl = cleanGarmentUrls[0] || "";
        if (pairedUrl) garmentUrlStartIndex = 1;
        items.push({
            role: "product",
            label: "outfit_reference",
            bytes: prepared.bytes,
            inlineBytes: prepared.inlineBytes,
            mimeType: prepared.inlineMime,
            fileName: `outfit.${extForOpusMime(prepared.inlineMime)}`,
            dataUri: prepared.dataUri,
            compactDataUri: prepared.compactDataUri,
            url: prepared.dropRemoteUrl ? "" : pairedUrl
        });
    }
    for (let i = garmentUrlStartIndex; i < cleanGarmentUrls.length; i += 1) {
        const urlMime = inferMimeFromUrl(cleanGarmentUrls[i]);
        items.push({
            role: "product",
            label: "outfit_reference",
            bytes: null,
            inlineBytes: null,
            mimeType: urlMime,
            fileName: `outfit-${items.length + 1}.${extForOpusMime(urlMime)}`,
            dataUri: "",
            compactDataUri: "",
            url: cleanGarmentUrls[i]
        });
    }

    const extras = [
        ...(Array.isArray(extraReferenceImages) ? extraReferenceImages : []),
        ...(Array.isArray(referenceImages) ? referenceImages : [])
    ];
    for (const extra of extras) {
        if (!extra) continue;
        if (typeof extra === "string" && extra.trim()) {
            const trimmed = extra.trim();
            const dataMatch = /^data:(image\/[a-z0-9.+-]+);base64,([\s\S]+)$/i.exec(trimmed);
            if (dataMatch) {
                const parsedMime = dataMatch[1].toLowerCase();
                const parsedBytes = base64ToBytes(dataMatch[2].replace(/\s+/g, ""));
                const prepared = prepareInlineReferenceVariants(parsedBytes, parsedMime);
                items.push({
                    role: "product",
                    label: "extra_reference",
                    bytes: prepared.bytes,
                    inlineBytes: prepared.inlineBytes,
                    mimeType: prepared.inlineMime,
                    fileName: `reference-${items.length + 1}.${extForOpusMime(prepared.inlineMime)}`,
                    dataUri: prepared.dataUri,
                    compactDataUri: prepared.compactDataUri,
                    url: ""
                });
            } else {
                const urlMime = inferMimeFromUrl(trimmed);
                items.push({
                    role: "product",
                    label: "extra_reference",
                    bytes: null,
                    inlineBytes: null,
                    mimeType: urlMime,
                    fileName: `reference-${items.length + 1}.${extForOpusMime(urlMime)}`,
                    dataUri: "",
                    compactDataUri: "",
                    url: trimmed
                });
            }
            continue;
        }
        if (extra instanceof Uint8Array && extra.byteLength) {
            const prepared = prepareInlineReferenceVariants(extra, detectImageMime(extra) || "image/jpeg");
            items.push({
                role: "product",
                label: "extra_reference",
                bytes: prepared.bytes,
                inlineBytes: prepared.inlineBytes,
                mimeType: prepared.inlineMime,
                fileName: `reference-${items.length + 1}.${extForOpusMime(prepared.inlineMime)}`,
                dataUri: prepared.dataUri,
                compactDataUri: prepared.compactDataUri,
                url: ""
            });
            continue;
        }
        if (typeof extra === "object") {
            const bytes = extra.bytes?.byteLength ? extra.bytes : null;
            const mime = String(extra.mimeType || (bytes ? detectImageMime(bytes) : "") || "image/jpeg").toLowerCase();
            const url = typeof extra.url === "string" ? extra.url.trim() : "";
            if (!bytes && !url) continue;
            const prepared = bytes
                ? prepareInlineReferenceVariants(bytes, mime)
                : { bytes: null, inlineBytes: null, inlineMime: extra.mimeType ? mime : inferMimeFromUrl(url), dataUri: "", compactDataUri: "", dropRemoteUrl: false };
            const resolvedExt = extForOpusMime(prepared.inlineMime);
            const rawFileName = extra.fileName || `reference-${items.length + 1}.${resolvedExt}`;
            const safeFileName = prepared.dropRemoteUrl
                ? rawFileName.replace(/\.[a-z0-9]+$/i, `.${resolvedExt}`)
                : rawFileName;
            items.push({
                role: String(extra.role || "product"),
                label: String(extra.label || `reference_${items.length + 1}`),
                bytes: prepared.bytes,
                inlineBytes: prepared.inlineBytes,
                mimeType: prepared.inlineMime,
                fileName: safeFileName,
                dataUri: prepared.dataUri,
                compactDataUri: prepared.compactDataUri,
                url: prepared.dropRemoteUrl ? "" : url
            });
        }
    }

    /* Product Ad Studio membatasi unggahan gambar referensi maksimal 3 gambar. */
    return items.slice(0, OPUS_MAX_REFERENCE_IMAGES);
}

function formatValidationDetails(details) {
    if (!details) return "";
    if (typeof details === "string") return details.trim();
    if (Array.isArray(details)) {
        const formatted = details
            .map(issue => {
                if (!issue) return "";
                if (typeof issue === "string") return issue;
                if (typeof issue === "object") {
                    const path = Array.isArray(issue.path)
                        ? issue.path.join(".")
                        : String(issue.path || issue.field || issue.param || "").trim();
                    const msg = String(issue.message || issue.reason || issue.code || JSON.stringify(issue)).trim();
                    const extraKeys = Array.isArray(issue.keys) && issue.keys.length
                        ? ` [${issue.keys.join(", ")}]`
                        : "";
                    return path ? `${path}: ${msg}${extraKeys}` : `${msg}${extraKeys}`;
                }
                return String(issue);
            })
            .filter(Boolean);
        return formatted.join("; ");
    }
    if (typeof details === "object") {
        if (Array.isArray(details.issues)) return formatValidationDetails(details.issues);
        if (Array.isArray(details.errors)) return formatValidationDetails(details.errors);
        try {
            const compact = JSON.stringify(details);
            return compact === "{}" ? "" : compact;
        } catch {
            return "";
        }
    }
    return "";
}

function hasMeaningfulErrorValue(val) {
    if (!val) return false;
    if (typeof val === "string") return val.trim().length > 0;
    if (Array.isArray(val)) return val.length > 0;
    if (typeof val === "object") return Object.keys(val).length > 0;
    return Boolean(val);
}

function sanitizeValueForDiagnostics(val, depth = 0) {
    if (val === null || val === undefined) return val;
    if (typeof val === "string") {
        const cleaned = val
            .replace(/Bearer\s+[A-Za-z0-9._~+/-]+/gi, "Bearer ***")
            .replace(/(https?:\/\/[^\s"'?]+)\?[^\s"']+/gi, "$1?...");
        if (cleaned.length > 72) {
            return `${cleaned.slice(0, 48)}…(len=${cleaned.length})`;
        }
        return cleaned;
    }
    if (typeof val !== "object") return val;
    if (depth >= 3) {
        return Array.isArray(val) ? `[Array(${val.length})]` : `{keys:${Object.keys(val).slice(0, 8).join(",")}}`;
    }
    if (Array.isArray(val)) {
        return val.slice(0, 3).map(item => sanitizeValueForDiagnostics(item, depth + 1));
    }
    const out = {};
    for (const key of Object.keys(val).slice(0, 12)) {
        if (/token|secret|password|authorization|cookie/i.test(key)) {
            out[key] = "***";
        } else {
            out[key] = sanitizeValueForDiagnostics(val[key], depth + 1);
        }
    }
    return out;
}

function summarizePayloadForDiagnostics(data, text = "") {
    if (data !== null && data !== undefined) {
        try {
            const serialized = JSON.stringify(sanitizeValueForDiagnostics(data));
            if (serialized && serialized !== "{}") {
                return serialized.slice(0, 260);
            }
        } catch {
            /* Lanjut ke fallback teks di bawah. */
        }
    }
    const cleanText = sanitizeValueForDiagnostics(String(text || "").trim());
    return cleanText ? String(cleanText).slice(0, 260) : "empty";
}

function isFailureCodeString(val) {
    if (typeof val !== "string") return false;
    const s = val.trim();
    if (!s || /\s/.test(s)) return false;
    return /(?:^|[_.-])(?:timeout|timed_out|error|failed|failure|rejected|invalid|missing|not_found|unauthorized|forbidden|denied|cancelled|canceled|exceeded|unavailable|expired|exhausted|aborted)(?:$|[_.-])/i.test(s);
}

function extractToolFailure(toolResult, fallbackCode = "tool_failed") {
    if (!toolResult || typeof toolResult !== "object") return null;
    const rawData = toolResult.data && typeof toolResult.data === "object" ? toolResult.data : null;
    const data = unwrapResultEnvelope(rawData);
    const info = extractJobDescriptor(rawData, toolResult.text);
    const rootHasError = Boolean(
        data
        && (
            hasMeaningfulErrorValue(data.error)
            || Boolean(data.errorCode || data.error_code)
            || isFailureCodeString(data.code)
            || isFailureCodeString(data.reason)
            || (Array.isArray(data.errors) && data.errors.length > 0)
            || (Array.isArray(data.rejected) && data.rejected.length > 0)
            || (Array.isArray(data.failed) && data.failed.length > 0)
            || (Array.isArray(data.failures) && data.failures.length > 0)
        )
        && !info.jobId
        && !isCompletedStatus(info.status)
        && !data.assetId
    );
    const explicitFail = toolResult.isError === true
        || rawData?.ok === false
        || rawData?.success === false
        || rawData?.isError === true
        || data?.ok === false
        || data?.success === false
        || data?.isError === true
        || info.itemFailed === true
        || isTerminalFailureStatus(info.status)
        || rootHasError;

    if (!explicitFail) return null;

    const code = info.errorCode || fallbackCode;
    const parts = [];
    if (info.message) parts.push(info.message);
    if (toolResult.text && toolResult.text !== info.message && !parts.some(p => p.includes(toolResult.text))) {
        parts.push(toolResult.text);
    }
    return {
        code,
        message: parts.filter(Boolean).join(" — ") || "Operasi Opus Labs gagal.",
        jobId: info.jobId
    };
}

function isInvalidArgumentsFailure(failure) {
    if (!failure || failure.jobId) return false;
    const combined = `${failure.code || ""} ${failure.message || ""}`;
    return /\binvalid_arguments\b|\binvalid_params\b|\bvalidation_error\b|\bunrecognized_keys\b|\binvalid_input\b|\binvalid_request\b|\bbad_request\b|\bschema_error\b|\binvalid_model\b|\bunsupported_model\b|\bunknown_model\b|\bmodel_not_found\b|\binvalid_field\b/i.test(combined);
}

function extractUploadSteps(data) {
    if (!data || typeof data !== "object") return [];
    for (const listKey of ["assets", "items", "uploads", "results", "importedAssets", "finalized", "records"]) {
        if (Array.isArray(data[listKey]) && data[listKey].length > 0) {
            return data[listKey];
        }
        if (data[listKey] && typeof data[listKey] === "object" && !Array.isArray(data[listKey])) {
            const vals = Object.values(data[listKey]).filter(v => v && typeof v === "object");
            if (vals.length > 0) return vals;
        }
    }
    for (const singleKey of ["asset", "upload", "item", "result"]) {
        if (data[singleKey] && typeof data[singleKey] === "object" && !Array.isArray(data[singleKey])) {
            return [data[singleKey]];
        }
    }
    return [data];
}

function scoreImportRegisterVariant(variant, hasLocalBytes) {
    const p = variant?.properties || {};
    const req = Array.isArray(variant?.required) ? variant.required : [];
    let score = 0;
    const hasInlineMediaFields = Boolean(
        pickSupportedKey(p, ["dataUrl", "data_url", "dataUri", "data_uri", "mediaBase64", "media_base64", "base64"], "")
    );
    const hasFileFields = Boolean(
        pickSupportedKey(
            p,
            ["fileName", "filename", "file_name", "localPath", "local_path", "filePath", "path", "mimeType", "contentType", "sizeBytes", "size_bytes", "byteLength", "size"],
            ""
        )
    );
    const hasUrlFields = Boolean(pickSupportedKey(p, ["url", "sourceUrl", "source_url", "uri", "remoteUrl"], ""));
    const requiresUrl = req.some(k => /^(url|sourceUrl|source_url|uri|remoteUrl)$/i.test(k));
    const requiresAssetId = req.some(k => /^(assetId|asset_id|finalizeAssetId|finalizeAssetIds)$/i.test(k));

    if (requiresAssetId) score -= 50;
    if (hasLocalBytes) {
        if (hasInlineMediaFields) score += 40;
        if (hasFileFields) score += 30;
        if (p.mimeType || p.contentType || p.mime_type || p.mediaMimeType) score += 10;
        if (p.sizeBytes || p.size_bytes || p.byteLength || p.size) score += 10;
        if (requiresUrl) score -= 40;
    } else {
        if (hasUrlFields) score += 30;
        if (requiresUrl) score += 10;
    }
    return score;
}

function resolveRawBase64ForItem(item, useCompact = false) {
    const chosenUri = ensureItemDataUri(item, { compact: useCompact });
    const idx = chosenUri.indexOf(";base64,");
    if (idx >= 0) {
        return chosenUri.slice(idx + 8).replace(/\s+/g, "");
    }
    const rawBytes = item?.inlineBytes || item?.bytes;
    return rawBytes?.byteLength ? bytesToBase64(rawBytes) : "";
}

async function populateImportFileFields(
    spec,
    itemObj,
    rootSchema,
    item,
    { clientItemId, projectId, minimal = false, deliveryMode = "presigned" }
) {
    const itemProps = itemObj?.properties || {};
    const req = Array.isArray(itemObj?.required) ? itemObj.required : [];
    const effectiveBytes = item.inlineBytes || item.bytes;

    const idKey = pickSupportedKey(itemProps, ["id", "itemId", "item_id", "clientRefId", "client_ref_id", "refId"], "");
    if (idKey && clientItemId) {
        spec[idKey] = itemProps[idKey]?.format === "uuid" ? makeUuid() : clientItemId;
    }

    const labelKey = pickSupportedKey(itemProps, ["label", "outputLabel", "output_label", "title"], "");
    if (labelKey && (!minimal || req.includes(labelKey) || !idKey)) {
        spec[labelKey] = item.label;
    }

    if (deliveryMode === "remote_url" && item.url) {
        const urlKey = pickSupportedKey(itemProps, ["url", "sourceUrl", "source_url", "remoteUrl", "uri"], "");
        if (urlKey) {
            spec[urlKey] = item.url;
        }
        const mimeKey = pickSupportedKey(itemProps, ["contentType", "mimeType", "content_type", "mime_type"], "");
        if (mimeKey && !minimal && item.mimeType) {
            spec[mimeKey] = item.mimeType;
        }
    } else if (
        (deliveryMode === "data_url" || deliveryMode === "compact_data_url")
        && (effectiveBytes?.byteLength || item.dataUri || item.compactDataUri)
    ) {
        const chosenDataUri = ensureItemDataUri(item, { compact: deliveryMode === "compact_data_url" });
        const dataUrlKey = pickSupportedKey(itemProps, ["dataUrl", "data_url", "dataUri", "data_uri"], "");
        if (dataUrlKey && chosenDataUri) {
            spec[dataUrlKey] = chosenDataUri;
        }
        const mimeKey = pickSupportedKey(itemProps, ["contentType", "mimeType", "content_type", "mime_type"], "");
        if (mimeKey && (!minimal || req.includes(mimeKey))) {
            spec[mimeKey] = item.mimeType;
        }
        if (effectiveBytes?.byteLength && deliveryMode === "data_url") {
            const sizeKey = pickSupportedKey(itemProps, ["sizeBytes", "size_bytes", "byteLength", "fileSize", "size"], "");
            if (sizeKey && (!minimal || req.includes(sizeKey))) {
                spec[sizeKey] = effectiveBytes.byteLength;
            }
        }
    } else if (deliveryMode === "media_base64" || deliveryMode === "compact_media_base64") {
        const base64Key = pickSupportedKey(itemProps, ["mediaBase64", "media_base64", "base64", "data"], "");
        const rawBase64 = resolveRawBase64ForItem(item, deliveryMode === "compact_media_base64");
        if (base64Key && rawBase64) {
            spec[base64Key] = rawBase64;
        }
        const mediaMimeKey = pickSupportedKey(itemProps, ["mediaMimeType", "media_mime_type"], "");
        if (mediaMimeKey) {
            spec[mediaMimeKey] = item.mimeType;
        }
        const mimeKey = pickSupportedKey(itemProps, ["contentType", "mimeType", "content_type", "mime_type"], "");
        if (mimeKey && (!mediaMimeKey || !minimal || req.includes(mimeKey))) {
            spec[mimeKey] = item.mimeType;
        }
        if (effectiveBytes?.byteLength && deliveryMode === "media_base64") {
            const sizeKey = pickSupportedKey(itemProps, ["sizeBytes", "size_bytes", "byteLength", "fileSize", "size"], "");
            if (sizeKey && (!minimal || req.includes(sizeKey))) {
                spec[sizeKey] = effectiveBytes.byteLength;
            }
        }
    } else if (deliveryMode === "local_path_upload" && item.bytes?.byteLength) {
        const pathKey = pickSupportedKey(itemProps, ["localPath", "local_path", "filePath", "file_path", "path"], "");
        if (pathKey) {
            spec[pathKey] = `/tmp/${item.fileName}`;
        }
        const mimeKey = pickSupportedKey(itemProps, ["contentType", "mimeType", "content_type", "mime_type"], "");
        if (mimeKey) {
            spec[mimeKey] = item.mimeType;
        }
        const sizeKey = pickSupportedKey(
            itemProps,
            ["sizeBytes", "size_bytes", "byteLength", "byte_length", "fileSize", "file_size", "contentLength", "size"],
            ""
        );
        if (sizeKey) {
            spec[sizeKey] = item.bytes.byteLength;
        }
    } else if (!item.bytes && item.url) {
        const urlKey = pickSupportedKey(itemProps, ["url", "sourceUrl", "source_url", "remoteUrl", "uri"], "");
        if (urlKey) spec[urlKey] = item.url;
    } else {
        const nameKey = pickSupportedKey(
            itemProps,
            ["fileName", "filename", "file_name", "originalFilename", "original_filename", "name"],
            ""
        );
        if (nameKey && (item.bytes || !spec.url)) {
            spec[nameKey] = item.fileName;
        }

        const pathKey = pickSupportedKey(itemProps, ["localPath", "local_path", "filePath", "file_path", "path"], "");
        if (pathKey && item.bytes && req.includes(pathKey)) {
            spec[pathKey] = `/tmp/${item.fileName}`;
        }

        const mimeKey = pickSupportedKey(itemProps, ["mimeType", "contentType", "mime_type", "content_type"], "");
        if (mimeKey && (item.bytes || req.includes(mimeKey))) {
            spec[mimeKey] = item.mimeType;
        }

        if (item.bytes) {
            const sizeKey = pickSupportedKey(
                itemProps,
                ["sizeBytes", "size_bytes", "byteLength", "byte_length", "fileSize", "file_size", "contentLength", "content_length", "size"],
                ""
            );
            if (sizeKey) spec[sizeKey] = item.bytes.byteLength;

            const shaKey = pickSupportedKey(itemProps, ["sha256", "sha_256", "checksum", "contentHash", "content_hash"], "");
            if (shaKey && (!minimal || req.includes(shaKey))) {
                const hex = await computeSha256Hex(item.bytes);
                if (hex) spec[shaKey] = hex;
            }
        }

        for (const subContainerKey of ["upload", "file", "local"]) {
            if (!Object.prototype.hasOwnProperty.call(itemProps, subContainerKey)) continue;
            if (!item.bytes || spec[subContainerKey] !== undefined) continue;
            const subObj = resolveObjectSchema(itemProps[subContainerKey], rootSchema);
            if (subObj.properties) {
                const sub = {};
                await populateImportFileFields(sub, subObj, rootSchema, item, {
                    clientItemId: "",
                    projectId,
                    minimal,
                    deliveryMode: "presigned"
                });
                if (Object.keys(sub).length > 0) spec[subContainerKey] = sub;
            }
        }
    }

    for (const discKey of ["kind", "assetType", "asset_type", "mediaType", "media_type", "type", "source", "sourceType", "source_type", "importMode", "mode", "action"]) {
        if (!Object.prototype.hasOwnProperty.call(itemProps, discKey)) continue;
        if (spec[discKey] !== undefined) continue;
        const propSchema = itemProps[discKey];
        if (schemaTypeIncludes(propSchema, rootSchema, "object") && !schemaTypeIncludes(propSchema, rootSchema, "string")) {
            if (deliveryMode === "presigned") {
                const nestedObj = resolveObjectSchema(propSchema, rootSchema);
                if (nestedObj.properties) {
                    const sub = {};
                    await populateImportFileFields(sub, nestedObj, rootSchema, item, {
                        clientItemId: "",
                        projectId,
                        minimal,
                        deliveryMode: "presigned"
                    });
                    if (Object.keys(sub).length > 0) spec[discKey] = sub;
                }
            }
            continue;
        }
        if (minimal && !req.includes(discKey)) continue;
        const allowed = extractAllowedValues(propSchema, rootSchema);
        if (!allowed.length) continue;
        const candidates = /source|mode|action|type/i.test(discKey) && !/media|asset/i.test(discKey)
            ? (deliveryMode === "remote_url" || (!item.bytes && item.url)
                ? ["url", "remote", "remote_url", "http", "https", "external", "image", "photo", "reference"]
                : ["data_url", "inline", "base64", "upload", "local", "local_upload", "local_file", "file", "presigned", "direct_upload", "bytes", "register", "create", "image", "photo", "reference"])
            : ["image", "photo", "still", "keyframe", "reference", "upload", "local"];
        const matched = matchEnumCandidate(candidates, allowed);
        if (matched !== null) spec[discKey] = matched;
    }

    const roleKey = pickSupportedKey(itemProps, ["role", "usage"], "");
    if (roleKey && (!minimal || req.includes(roleKey))) {
        const allowedRoles = extractAllowedValues(itemProps[roleKey], rootSchema);
        const matchedRole = matchRoleValue(item.role, allowedRoles);
        if (matchedRole !== null) spec[roleKey] = matchedRole;
    }

    fillMissingRequiredFields(spec, itemObj, rootSchema, {
        projectId,
        defaultLabel: clientItemId || item.label,
        remoteUrl: (deliveryMode === "remote_url" || !item.bytes) && item.url ? item.url : ""
    });
}

function getSupportedDeliveryModesForProps(itemProps, item) {
    const hasHttpsUrl = typeof item?.url === "string" && /^https?:\/\//i.test(item.url.trim());
    const effectiveBytes = item?.inlineBytes || item?.bytes;
    const hasInlineSource = Boolean(effectiveBytes?.byteLength || item?.dataUri);
    const canCompactSource = Boolean(
        item?.compactDataUri || (effectiveBytes?.byteLength && effectiveBytes.byteLength > 90_000)
    );
    if (!hasInlineSource) {
        return ["remote_url"];
    }
    if (!itemProps) return ["presigned"];

    const modes = [];
    const hasUrlProp = Boolean(pickSupportedKey(itemProps, ["url", "sourceUrl", "source_url", "remoteUrl", "uri"], ""));
    const hasDataUrlProp = Boolean(pickSupportedKey(itemProps, ["dataUrl", "data_url", "dataUri", "data_uri"], ""));
    const hasBase64Prop = Boolean(pickSupportedKey(itemProps, ["mediaBase64", "media_base64", "base64"], ""));
    const hasFileNameProp = Boolean(
        pickSupportedKey(itemProps, ["fileName", "filename", "file_name", "originalFilename", "original_filename", "name"], "")
    );
    const hasSubUploadProp = Boolean(
        pickSupportedKey(itemProps, ["upload", "file", "local"], "")
        || (itemProps.source && typeof itemProps.source === "object" && (itemProps.source.properties || itemProps.source.$ref))
    );
    const hasPathProp = Boolean(pickSupportedKey(itemProps, ["localPath", "local_path", "filePath", "file_path", "path"], ""));

    /* Jika tersedia URL HTTPS publik/signed (Supabase/CDN), utamakan URL terlebih dahulu
       karena ringan dan bebas batas ukuran JSON-RPC MCP, lalu fallback ke inline/upload. */
    if (hasHttpsUrl && hasUrlProp && !hasFileNameProp) {
        modes.push("remote_url");
    }
    if (hasDataUrlProp && hasInlineSource) {
        modes.push("data_url");
        if (canCompactSource) {
            modes.push("compact_data_url");
        }
    }
    if (hasBase64Prop && hasInlineSource) {
        modes.push("media_base64");
        if (canCompactSource) {
            modes.push("compact_media_base64");
        }
    }
    if (hasFileNameProp || hasSubUploadProp) {
        modes.push("presigned");
    } else if (hasPathProp && item.bytes?.byteLength) {
        modes.push("local_path_upload");
    }
    if (!modes.length && hasHttpsUrl && hasUrlProp) {
        modes.push("remote_url");
    }
    if (!modes.length) {
        modes.push("presigned");
    }
    return modes;
}

async function buildImportRegistrationCandidates(importTool, projectId, item, clientItemId) {
    const rootSchema = importTool?.inputSchema;
    const hasLocalBytes = Boolean(item.bytes?.byteLength || item.dataUri);
    const rootObj = resolveObjectSchema(
        rootSchema,
        rootSchema,
        branch => {
            const p = branch?.properties || {};
            if (hasLocalBytes) {
                return Boolean(p.assets || p.items || p.uploads || p.inputs || p.files || p.dataUrl || p.mediaBase64 || p.fileName || p.filename || p.mimeType);
            }
            return Boolean(p.assets || p.items || p.uploads || p.url || p.sourceUrl);
        }
    );
    const props = rootObj.properties;
    const projectKey = pickSupportedKey(props, ["projectId", "project_id"], projectId ? "projectId" : "");
    const reqKeyName = pickSupportedKey(props, ["requestKey", "idempotencyKey", "request_key"], props ? "" : "requestKey");
    const arrayKey = pickSupportedKey(props, ["assets", "items", "uploads", "inputs", "files"], "");

    const makeTopBase = () => {
        const base = {};
        if (projectKey && projectId) base[projectKey] = projectId;
        if (reqKeyName) base[reqKeyName] = makeUuid();
        return base;
    };

    /*
     * Kembalikan descriptor LAZY `{ mode, reqKeyName, build }` agar mode berat
     * (`data_url`, `compact_data_url`, `media_base64`) tidak pernah dievaluasi
     * bila kandidat ringan (`remote_url` / `presigned`) sudah lebih dulu sukses.
     */
    const candidateEntries = [];

    if (arrayKey) {
        const variants = resolveArrayItemObjectVariants(props[arrayKey], rootSchema)
            .slice()
            .sort((a, b) => scoreImportRegisterVariant(b, hasLocalBytes) - scoreImportRegisterVariant(a, hasLocalBytes));

        const usableVariants = variants.filter(v => v.properties);
        if (usableVariants.length > 0) {
            for (const variant of usableVariants) {
                if (scoreImportRegisterVariant(variant, hasLocalBytes) <= -40 && candidateEntries.length > 0) {
                    continue;
                }
                const modes = getSupportedDeliveryModesForProps(variant.properties, item);
                for (const deliveryMode of modes) {
                    const minimalPasses = (deliveryMode === "compact_data_url" || deliveryMode === "compact_media_base64")
                        ? [true]
                        : [false, true];
                    for (const minimal of minimalPasses) {
                        candidateEntries.push({
                            mode: deliveryMode,
                            reqKeyName,
                            build: async () => {
                                const spec = {};
                                await populateImportFileFields(spec, variant, rootSchema, item, {
                                    clientItemId,
                                    projectId,
                                    minimal,
                                    deliveryMode
                                });
                                const payload = makeTopBase();
                                payload[arrayKey] = [spec];
                                fillMissingRequiredFields(payload, rootObj, rootSchema, { projectId, defaultLabel: clientItemId });
                                return payload;
                            }
                        });
                    }
                }
            }
        } else {
            for (const minimal of [false, true]) {
                candidateEntries.push({
                    mode: "fallback",
                    reqKeyName,
                    build: async () => {
                        const lazyDataUri = !item.fileName && item.bytes?.byteLength ? ensureItemDataUri(item) : item.dataUri;
                        const payload = makeTopBase();
                        payload[arrayKey] = [{
                            ...(lazyDataUri ? { dataUrl: lazyDataUri } : { fileName: item.fileName }),
                            mimeType: item.mimeType,
                            ...(!minimal ? { role: item.role, label: item.label } : {}),
                            ...(item.bytes ? { sizeBytes: item.bytes.byteLength } : {}),
                            ...(!item.bytes && item.url ? { url: item.url } : {})
                        }];
                        fillMissingRequiredFields(payload, rootObj, rootSchema, { projectId, defaultLabel: clientItemId });
                        return payload;
                    }
                });
            }
        }
        return candidateEntries;
    }

    const topModes = getSupportedDeliveryModesForProps(props, item);
    for (const deliveryMode of topModes) {
        const minimalPasses = (deliveryMode === "compact_data_url" || deliveryMode === "compact_media_base64")
            ? [true]
            : [false, true];
        for (const minimal of minimalPasses) {
            candidateEntries.push({
                mode: deliveryMode,
                reqKeyName,
                build: async () => {
                    const args = makeTopBase();
                    const urlKey = item.url ? pickSupportedKey(props, ["url", "sourceUrl", "uri"], "url") : "";
                    if (urlKey && item.url && !item.bytes) {
                        args[urlKey] = item.url;
                    } else if (props) {
                        await populateImportFileFields(args, rootObj, rootSchema, item, {
                            clientItemId: "",
                            projectId,
                            minimal,
                            deliveryMode
                        });
                    } else {
                        args.fileName = item.fileName;
                        args.mimeType = item.mimeType;
                        if (item.bytes) args.sizeBytes = item.bytes.byteLength;
                        if (!minimal) args.role = item.role;
                    }
                    fillMissingRequiredFields(args, rootObj, rootSchema, { projectId, defaultLabel: clientItemId || item.label });
                    return args;
                }
            });
        }
    }
    return candidateEntries;
}

function buildImportFinalizeCandidates(importTool, projectId, assetId, item, clientItemId = "") {
    const rootSchema = importTool?.inputSchema;
    const rootObj = resolveObjectSchema(
        rootSchema,
        rootSchema,
        branch => {
            const p = branch?.properties || {};
            return Boolean(p.finalizeAssetIds || p.assetIds || p.assetId || p.finalize_asset_ids || p.asset_id || p.finalize);
        }
    );
    const props = rootObj.properties;
    const projectKey = pickSupportedKey(props, ["projectId", "project_id"], projectId ? "projectId" : "");
    const reqKeyName = pickSupportedKey(props, ["requestKey", "idempotencyKey", "request_key"], props ? "" : "requestKey");

    const makeBase = () => {
        const base = {};
        if (projectKey && projectId) base[projectKey] = projectId;
        if (reqKeyName) base[reqKeyName] = makeUuid();
        const actionKey = pickSupportedKey(props, ["action", "operation", "mode", "step"], "");
        if (actionKey) {
            const allowedActions = extractAllowedValues(props[actionKey], rootSchema);
            const matched = matchEnumCandidate(["finalize", "complete", "confirm", "uploaded", "commit"], allowedActions);
            if (matched !== null) base[actionKey] = matched;
        }
        return base;
    };

    const candidates = [];
    const seen = new Set();
    const pushCandidate = c => {
        const sig = JSON.stringify({ ...c, ...(reqKeyName ? { [reqKeyName]: undefined } : {}) });
        if (!seen.has(sig)) {
            seen.add(sig);
            candidates.push(c);
        }
    };

    const assetIdsKey = pickSupportedKey(props, ["finalizeAssetIds", "finalize_asset_ids", "completedAssetIds", "assetIds", "asset_ids"], "");
    if (assetIdsKey) {
        const c = makeBase();
        c[assetIdsKey] = [assetId];
        pushCandidate(c);
    }
    const singleIdKey = pickSupportedKey(props, ["finalizeAssetId", "finalize_asset_id", "assetId", "asset_id", "id"], "");
    if (singleIdKey) {
        const c = makeBase();
        c[singleIdKey] = assetId;
        pushCandidate(c);
    }
    const arrayKey = pickSupportedKey(props, ["assets", "items", "uploads", "finalize"], "");
    if (arrayKey) {
        const variants = resolveArrayItemObjectVariants(props[arrayKey], rootSchema);
        const finalizeVariants = variants
            .filter(v => v.properties && pickSupportedKey(v.properties, ["assetId", "asset_id", "id"], ""))
            .sort((a, b) => {
                const aReqFile = (a.required || []).some(k => /file|mime|size|url/i.test(k)) ? 1 : 0;
                const bReqFile = (b.required || []).some(k => /file|mime|size|url/i.test(k)) ? 1 : 0;
                return aReqFile - bReqFile;
            });
        const targetVariants = finalizeVariants.length ? finalizeVariants : (variants[0] ? [variants[0]] : []);

        if (targetVariants.length && targetVariants[0].properties) {
            for (const fv of targetVariants) {
                const itemProps = fv.properties;
                const spec = {};
                const explicitAssetIdKey = pickSupportedKey(itemProps, ["assetId", "asset_id"], "");
                if (explicitAssetIdKey) {
                    spec[explicitAssetIdKey] = assetId;
                    const rowIdKey = pickSupportedKey(itemProps, ["id", "itemId", "item_id"], "");
                    if (rowIdKey && fv.required.includes(rowIdKey) && clientItemId) {
                        spec[rowIdKey] = clientItemId;
                    }
                } else {
                    const fallbackIdKey = pickSupportedKey(itemProps, ["id"], "assetId");
                    spec[fallbackIdKey] = assetId;
                }
                const statusKey = pickSupportedKey(itemProps, ["status", "state", "action", "mode", "type"], "");
                if (statusKey) {
                    const allowedStatuses = extractAllowedValues(itemProps[statusKey], rootSchema);
                    const matchedStatus = matchEnumCandidate(["finalize", "uploaded", "complete", "ready", "completed"], allowedStatuses);
                    if (matchedStatus !== null) spec[statusKey] = matchedStatus;
                }
                fillMissingRequiredFields(spec, fv, rootSchema, {
                    projectId,
                    defaultLabel: clientItemId || item?.fileName || assetId
                });
                const c = makeBase();
                c[arrayKey] = [spec];
                pushCandidate(c);
            }
        } else {
            const c1 = makeBase();
            c1[arrayKey] = [{ assetId, status: "uploaded" }];
            pushCandidate(c1);
            const c2 = makeBase();
            c2[arrayKey] = [{ assetId }];
            pushCandidate(c2);
        }
    }
    if (!candidates.length) {
        const fallback = makeBase();
        fallback.assetId = assetId;
        pushCandidate(fallback);
    }
    return candidates;
}

function extractImportedAssetRecord(data, clientItemId = "") {
    if (!data || typeof data !== "object") {
        return { assetId: "", durableRef: "", remoteUri: "", uploadUrl: "", uploadMethod: "PUT", uploadHeaders: {}, status: "" };
    }
    const candidates = extractUploadSteps(data);
    const entry = candidates[0] || data || {};
    if (entry.ok === false || entry.success === false || isTerminalFailureStatus(entry.status)) {
        return { assetId: "", durableRef: "", remoteUri: "", uploadUrl: "", uploadMethod: "PUT", uploadHeaders: {}, status: String(entry.status || "failed") };
    }
    const nestedAsset = entry.asset && typeof entry.asset === "object" ? entry.asset : null;
    const stringAsset = typeof entry.asset === "string" ? entry.asset.trim() : "";
    const uploadObj = (entry.upload && typeof entry.upload === "object" ? entry.upload : null)
        || (entry.presignedUpload && typeof entry.presignedUpload === "object" ? entry.presignedUpload : null)
        || (entry.uploadTarget && typeof entry.uploadTarget === "object" ? entry.uploadTarget : null);

    const safeNonClientId = val => {
        const s = String(val || "").trim();
        if (!s || s === clientItemId) return "";
        return s;
    };

    const topAssetIds = Array.isArray(data.assetIds)
        ? data.assetIds
        : (Array.isArray(data.asset_ids) ? data.asset_ids : []);

    const assetId = String(
        entry.assetId
        || entry.asset_id
        || entry.importedAssetId
        || entry.sourceAssetId
        || stringAsset
        || nestedAsset?.assetId
        || nestedAsset?.asset_id
        || safeNonClientId(nestedAsset?.id)
        || uploadObj?.assetId
        || uploadObj?.asset_id
        || entry.mediaAssetId
        || entry.fileId
        || data.assetId
        || data.asset_id
        || safeNonClientId(topAssetIds[0])
        || safeNonClientId(entry.id)
        || safeNonClientId(entry.key)
        || safeNonClientId(entry.storageKey)
        || safeNonClientId(entry.objectKey)
        || (entry.ok === true && typeof entry.path === "string" ? safeNonClientId(entry.path) : "")
        || ""
    ).trim();

    const durableRef = String(
        entry.durableRef
        || entry.durable_ref
        || entry.assetRef
        || entry.asset_ref
        || nestedAsset?.durableRef
        || nestedAsset?.assetRef
        || nestedAsset?.ref
        || safeNonClientId(entry.ref)
        || safeNonClientId(entry.reference)
        || safeNonClientId(entry.handle)
        || ""
    ).trim();

    const rawRemoteUri = String(
        entry.uri
        || entry.url
        || entry.cdnUrl
        || entry.cdn_url
        || nestedAsset?.uri
        || nestedAsset?.url
        || nestedAsset?.cdnUrl
        || ""
    ).trim();
    const remoteUri = rawRemoteUri && !rawRemoteUri.startsWith("data:") ? rawRemoteUri : "";

    const uploadUrl = String(
        entry.uploadUrl
        || entry.upload_url
        || entry.signedUrl
        || entry.signed_url
        || entry.presignedUrl
        || entry.presigned_url
        || entry.putUrl
        || entry.put_url
        || (typeof entry.upload === "string" ? entry.upload : "")
        || uploadObj?.url
        || uploadObj?.uploadUrl
        || uploadObj?.signedUrl
        || uploadObj?.presignedUrl
        || uploadObj?.putUrl
        || uploadObj?.href
        || uploadObj?.targetUrl
        || ""
    ).trim();

    const rawHeaders = entry.uploadHeaders || entry.headers || uploadObj?.headers;
    return {
        assetId,
        durableRef,
        remoteUri,
        uploadUrl,
        uploadMethod: String(entry.uploadMethod || uploadObj?.method || "PUT").toUpperCase(),
        uploadHeaders: rawHeaders && typeof rawHeaders === "object" ? rawHeaders : {},
        status: String(entry.status || nestedAsset?.status || data.status || "").trim()
    };
}

function isFatalAccountImportError(failure) {
    const combined = `${failure?.code || ""} ${failure?.message || ""}`;
    return /\b(unauthorized|forbidden|insufficient_credits|payment_required|quota_exceeded|rate_limited)\b/i.test(combined);
}

async function importSingleAssetViaMcp(session, importTool, projectId, item, clientItemId = "ref-1") {
    const regCandidates = await buildImportRegistrationCandidates(importTool, projectId, item, clientItemId);
    let stepResult = null;
    let firstSuccessStep = null;
    let primaryFailure = null;
    const modeErrors = new Map();
    const seenCandidateSignatures = new Set();
    let record = null;

    for (const candidate of regCandidates) {
        const modeName = candidate.mode || "default";
        const candidateArgs = typeof candidate.build === "function"
            ? await candidate.build()
            : (candidate.args || candidate);
        const reqKeyField = candidate.reqKeyName || "";
        const sig = JSON.stringify({
            ...candidateArgs,
            ...(reqKeyField ? { [reqKeyField]: undefined } : {})
        });
        if (seenCandidateSignatures.has(sig)) continue;
        seenCandidateSignatures.add(sig);
        try {
            stepResult = await session.callTool(importTool.name, candidateArgs);
        } catch (rpcThrown) {
            if (!rpcThrown?.jobId && rpcThrown?.code === "invalid_arguments") {
                const f = { code: "invalid_arguments", message: rpcThrown.message, jobId: "" };
                if (!primaryFailure) primaryFailure = f;
                if (!modeErrors.has(modeName)) modeErrors.set(modeName, `${f.code}: ${String(f.message || "").slice(0, 140)}`);
                continue;
            }
            throw rpcThrown;
        }
        const candidateFailure = extractToolFailure(stepResult, "import_failed");
        if (candidateFailure) {
            if (!primaryFailure) primaryFailure = candidateFailure;
            if (!modeErrors.has(modeName)) {
                modeErrors.set(modeName, `${candidateFailure.code}: ${String(candidateFailure.message || "").slice(0, 140)}`);
            }
            if (isFatalAccountImportError(candidateFailure)) {
                primaryFailure = candidateFailure;
                break;
            }
            continue;
        }
        if (!firstSuccessStep) {
            firstSuccessStep = stepResult;
        }
        const extracted = extractImportedAssetRecord(stepResult.data, clientItemId);
        if (extracted.assetId || extracted.uploadUrl || extracted.durableRef || extracted.remoteUri) {
            record = extracted;
            primaryFailure = null;
            break;
        }
    }

    if (!record && firstSuccessStep) {
        stepResult = firstSuccessStep;
        record = extractImportedAssetRecord(firstSuccessStep.data, clientItemId);
    }

    if (!record && primaryFailure) {
        const attemptsSummary = modeErrors.size > 1
            ? ` [attempts: ${Array.from(modeErrors.entries()).map(([m, err]) => `${m}=>${err}`).join(" | ")}]`
            : "";
        const schemaHint = ` [import_schema: ${summarizeToolSchema(importTool)}]`;
        throw opusError({
            code: primaryFailure.code || "import_failed",
            message: `${primaryFailure.message || "Gagal mendaftarkan gambar referensi ke Opus Labs."}${attemptsSummary}${schemaHint}`
        });
    }

    if (!record) {
        record = extractImportedAssetRecord(stepResult?.data, clientItemId);
    }

    if ((record.status === "awaiting_upload" || record.uploadUrl) && record.uploadUrl && item.bytes?.byteLength) {
        const extraHeaders = record.uploadHeaders;
        const hasContentType = Object.keys(extraHeaders).some(k => k.toLowerCase() === "content-type");
        const putResp = await fetch(record.uploadUrl, {
            method: record.uploadMethod,
            headers: {
                ...(hasContentType ? {} : { "Content-Type": item.mimeType }),
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
        const targetFinalizeId = record.assetId || record.durableRef;
        if (targetFinalizeId) {
            const finalizeCandidates = buildImportFinalizeCandidates(importTool, projectId, targetFinalizeId, item, clientItemId);
            let finalizeFailure = null;
            for (const finalizeArgs of finalizeCandidates) {
                try {
                    stepResult = await session.callTool(importTool.name, finalizeArgs);
                } catch (rpcThrown) {
                    if (!rpcThrown?.jobId && rpcThrown?.code === "invalid_arguments") {
                        finalizeFailure = { code: "invalid_arguments", message: rpcThrown.message, jobId: "" };
                        continue;
                    }
                    throw rpcThrown;
                }
                finalizeFailure = extractToolFailure(stepResult, "asset_finalize_failed");
                if (!finalizeFailure) break;
                if (!isInvalidArgumentsFailure(finalizeFailure) && !/\bfield\b/i.test(finalizeFailure.message)) break;
            }
            if (finalizeFailure) {
                throw opusError({
                    code: finalizeFailure.code || "asset_finalize_failed",
                    message: `${finalizeFailure.message || "Gagal memfinalisasi aset referensi di Opus Labs."} [import_schema: ${summarizeToolSchema(importTool)}]`
                });
            }
        }
    }

    const finalRecord = extractImportedAssetRecord(stepResult?.data, clientItemId);
    const resolvedAssetId = finalRecord.assetId || record.assetId || finalRecord.durableRef || record.durableRef;
    const resolvedAltRef = finalRecord.durableRef || record.durableRef || finalRecord.remoteUri || record.remoteUri || (!item.bytes && item.url ? item.url : "");

    if (!resolvedAssetId && !resolvedAltRef) {
        const rawPreview = JSON.stringify(stepResult?.data ?? {}).slice(0, 240);
        throw opusError({
            code: "import_incomplete",
            message: `import_assets tidak mengembalikan assetId referensi yang sah: ${rawPreview} [import_schema: ${summarizeToolSchema(importTool)}]`,
            status: 502
        });
    }

    return {
        assetId: resolvedAssetId,
        altRef: resolvedAltRef && resolvedAltRef !== resolvedAssetId ? resolvedAltRef : "",
        uri: finalRecord.remoteUri || record.remoteUri || (!item.bytes && item.url ? item.url : ""),
        role: item.role,
        label: item.label,
        mimeType: item.mimeType
    };
}

function buildReferenceValueForSchema(propSchema, rootSchema, cappedImportedAssets, { minimal = false, useAltRef = false } = {}) {
    const pickAssetString = asset => {
        if (useAltRef && asset.altRef) return asset.altRef;
        return asset.assetId || asset.altRef || asset.uri;
    };
    const itemSchema = resolveArrayItemSchema(propSchema, rootSchema);
    if (itemSchema && schemaTypeIncludes(itemSchema, rootSchema, "string") && !schemaTypeIncludes(itemSchema, rootSchema, "object")) {
        return cappedImportedAssets.map(pickAssetString).filter(Boolean);
    }
    const itemObj = resolveObjectSchema(itemSchema, rootSchema);
    const itemProps = itemObj.properties;
    if (itemProps) {
        return cappedImportedAssets.map((asset, index) => {
            const refEntry = {};
            const chosenId = pickAssetString(asset);
            const idKey = pickSupportedKey(itemProps, ["assetId", "asset_id", "assetRef", "ref", "id"], "");
            if (idKey && chosenId) {
                refEntry[idKey] = chosenId;
            }
            const urlKey = pickSupportedKey(itemProps, ["url", "uri", "imageUrl", "image_url", "sourceUrl"], "");
            if (urlKey && (!idKey || !chosenId || itemObj.required.includes(urlKey)) && asset.uri) {
                refEntry[urlKey] = asset.uri;
            }
            const roleKey = pickSupportedKey(itemProps, ["role", "kind", "type", "usage"], "");
            if (roleKey && (!minimal || itemObj.required.includes(roleKey))) {
                const allowedRoles = extractAllowedValues(itemProps[roleKey], rootSchema);
                const matchedRole = matchRoleValue(asset.role, allowedRoles);
                if (matchedRole !== null) {
                    refEntry[roleKey] = matchedRole;
                }
            }
            const labelKey = pickSupportedKey(itemProps, ["label", "tag", "slot", "ref", "name"], "");
            if (labelKey && labelKey !== idKey && (!minimal || itemObj.required.includes(labelKey))) {
                const allowedLabels = extractAllowedValues(itemProps[labelKey], rootSchema);
                const preferredLabel = `image${index + 1}`;
                const matchedLabel = matchEnumCandidate([preferredLabel, `@image${index + 1}`, asset.label], allowedLabels);
                if (matchedLabel !== null) {
                    refEntry[labelKey] = matchedLabel;
                }
            }
            const mimeKey = pickSupportedKey(itemProps, ["mimeType", "mime_type", "contentType"], "");
            if (mimeKey && itemObj.required.includes(mimeKey) && asset.mimeType) {
                refEntry[mimeKey] = asset.mimeType;
            }
            fillMissingRequiredFields(refEntry, itemObj, rootSchema, {
                defaultLabel: `image${index + 1}`,
                remoteUrl: asset.uri || ""
            });
            return refEntry;
        });
    }

    return cappedImportedAssets.map(asset => {
        const chosenId = pickAssetString(asset);
        return {
            ...(chosenId ? { assetId: chosenId } : {}),
            ...(asset.uri && !chosenId ? { url: asset.uri } : {}),
            ...(!minimal ? { role: asset.role } : {})
        };
    });
}

function populateKeyframeTargetFields(target, objectSchema, rootSchema, {
    prompt,
    ratio,
    projectId,
    resolvedModel,
    quality,
    cappedImportedAssets,
    cappedRawRefs,
    isBatchItem = false,
    minimal = false,
    omitModel = false,
    useAltRef = false
}) {
    const props = objectSchema?.properties;
    const required = Array.isArray(objectSchema?.required) ? objectSchema.required : [];
    const width = ratio === "16:9" ? 1920 : 1080;
    const height = ratio === "16:9" ? 1080 : 1920;

    if (isBatchItem) {
        const itemIdKey = pickSupportedKey(
            props,
            ["keyframeId", "keyframe_id", "shotId", "shot_id", "frameId", "frame_id", "itemId", "item_id", "id"],
            ""
        );
        if (itemIdKey) {
            const idProp = props?.[itemIdKey];
            target[itemIdKey] = idProp?.format === "uuid" ? makeUuid() : "kf-1";
        }
    } else {
        const requiredIdKey = ["keyframeId", "keyframe_id", "shotId", "shot_id", "frameId", "frame_id"].find(
            k => props && Object.prototype.hasOwnProperty.call(props, k) && required.includes(k)
        );
        if (requiredIdKey) {
            target[requiredIdKey] = props[requiredIdKey]?.format === "uuid" ? makeUuid() : "kf-1";
        }
    }

    const labelKey = pickSupportedKey(props, ["outputLabel", "output_label", "label", "title", "name"], "");
    if (labelKey && (isBatchItem || required.includes(labelKey) || labelKey.toLowerCase().includes("outputlabel"))) {
        if (target[labelKey] === undefined) {
            target[labelKey] = "keyframe-1";
        }
    }

    const promptKey = pickSupportedKey(
        props,
        ["prompt", "description", "instruction", "text", "brief"],
        props ? "" : "prompt"
    );
    if (promptKey) {
        target[promptKey] = String(prompt || "").trim();
    }

    const projectKey = pickSupportedKey(props, ["projectId", "project_id"], !props && projectId ? "projectId" : "");
    if (projectKey && projectId && target[projectKey] === undefined) {
        target[projectKey] = projectId;
    }

    const reqKeyName = pickSupportedKey(
        props,
        ["requestKey", "idempotencyKey", "request_key", "idempotency_key"],
        !props && !isBatchItem ? "requestKey" : ""
    );
    if (reqKeyName && target[reqKeyName] === undefined && (!isBatchItem || required.includes(reqKeyName))) {
        target[reqKeyName] = makeUuid();
    }

    const ratioKey = pickSupportedKey(
        props,
        ["aspectRatio", "aspect_ratio", "aspect", "ratio"],
        props ? "" : "aspectRatio"
    );
    if (ratioKey) {
        const allowedRatios = extractAllowedValues(props?.[ratioKey], rootSchema);
        const matchedRatio = matchAspectRatioValue(ratio, allowedRatios);
        if (matchedRatio !== null) {
            target[ratioKey] = matchedRatio;
        } else if (required.includes(ratioKey) && allowedRatios.length) {
            target[ratioKey] = allowedRatios[0];
        }
    }

    if (props && Object.prototype.hasOwnProperty.call(props, "size") && (!minimal || required.includes("size"))) {
        const allowedSizes = extractAllowedValues(props.size, rootSchema);
        const matchedSize = matchSizeValue(ratio, allowedSizes);
        if (matchedSize !== null) {
            target.size = matchedSize;
        } else if (required.includes("size") && allowedSizes.length) {
            target.size = allowedSizes[0];
        }
    }

    if (
        props
        && Object.prototype.hasOwnProperty.call(props, "width")
        && Object.prototype.hasOwnProperty.call(props, "height")
        && (!minimal || required.includes("width") || required.includes("height"))
    ) {
        const maxW = typeof props.width?.maximum === "number" ? props.width.maximum : Infinity;
        const maxH = typeof props.height?.maximum === "number" ? props.height.maximum : Infinity;
        if (width <= maxW && height <= maxH) {
            target.width = width;
            target.height = height;
        } else {
            target.width = ratio === "16:9" ? Math.min(1024, maxW) : Math.min(720, maxW);
            target.height = ratio === "16:9" ? Math.min(576, maxH) : Math.min(1280, maxH);
        }
    }

    const countKey = pickSupportedKey(props, ["count", "imageCount", "image_count", "numImages", "num_images", "n", "candidateCount"], "");
    if (countKey && (!minimal || required.includes(countKey))) {
        const minCount = typeof props?.[countKey]?.minimum === "number" ? props[countKey].minimum : 1;
        target[countKey] = Math.max(1, minCount);
    }

    if (resolvedModel && !omitModel) {
        const modelKey = pickSupportedKey(
            props,
            ["model", "imageModel", "image_model", "modelId", "model_id", "providerModel"],
            props ? "" : "model"
        );
        if (modelKey) {
            const allowedModels = extractAllowedValues(props?.[modelKey], rootSchema);
            const matchedModel = matchModelValue(resolvedModel, allowedModels);
            if (matchedModel !== null) {
                target[modelKey] = matchedModel;
            } else if (required.includes(modelKey) && allowedModels.length) {
                target[modelKey] = allowedModels[0];
            }
        }
    }

    if (quality && (!minimal || required.some(k => /quality/i.test(k)))) {
        const qualityKey = pickSupportedKey(
            props,
            ["quality", "imageQuality", "image_quality"],
            props ? "" : "quality"
        );
        if (qualityKey) {
            const allowedQuality = extractAllowedValues(props?.[qualityKey], rootSchema);
            const matchedQuality = matchQualityValue(quality, allowedQuality);
            if (matchedQuality !== null) {
                target[qualityKey] = matchedQuality;
            } else if (required.includes(qualityKey) && allowedQuality.length) {
                target[qualityKey] = allowedQuality[0];
            }
        }
    }

    if (cappedImportedAssets.length > 0) {
        const assetObjKey = pickSupportedKey(
            props,
            ["referenceAssets", "reference_assets", "references", "assets", "inputAssets", "input_assets"],
            ""
        );
        const assetIdsKey = pickSupportedKey(
            props,
            ["assetIds", "asset_ids", "referenceAssetIds", "reference_asset_ids"],
            ""
        );
        const imageUrlsKey = pickSupportedKey(
            props,
            ["referenceImages", "reference_images", "imageUrls", "image_urls", "inputImages", "input_images"],
            ""
        );
        if (assetObjKey) {
            target[assetObjKey] = buildReferenceValueForSchema(
                props[assetObjKey],
                rootSchema,
                cappedImportedAssets,
                { minimal, useAltRef }
            );
        } else if (assetIdsKey) {
            target[assetIdsKey] = cappedImportedAssets
                .map(asset => (useAltRef && asset.altRef ? asset.altRef : (asset.assetId || asset.altRef)))
                .filter(Boolean);
        } else if (imageUrlsKey) {
            target[imageUrlsKey] = cappedImportedAssets.map(asset => asset.uri || asset.altRef || asset.assetId).filter(Boolean);
        } else if (!props) {
            target.referenceAssets = cappedImportedAssets.map(asset => ({
                ...(asset.assetId ? { assetId: asset.assetId } : {}),
                ...(!minimal ? { role: asset.role } : {})
            }));
        }
    } else if (cappedRawRefs.length > 0) {
        const directRefKey = pickSupportedKey(
            props,
            ["input_images", "inputImages", "referenceImages", "reference_images", "imageUrls", "references"],
            props ? "" : "input_images"
        );
        if (directRefKey) {
            target[directRefKey] = cappedRawRefs.map(item => item.url || ensureItemDataUri(item)).filter(Boolean);
        }
    }

    fillMissingRequiredFields(target, objectSchema, rootSchema, {
        prompt,
        ratio,
        projectId,
        model: resolvedModel,
        quality,
        hasReferences: cappedImportedAssets.length > 0 || cappedRawRefs.length > 0,
        defaultLabel: "kf-1"
    });
}

function detectBatchArrayKey(rootObj, rootSchema) {
    const props = rootObj?.properties;
    if (!props) return "";
    const candidates = ["keyframes", "items", "shots", "frames", "requests", "images", "generations", "tasks"];
    for (const key of candidates) {
        if (!Object.prototype.hasOwnProperty.call(props, key)) continue;
        const itemSchema = resolveArrayItemSchema(props[key], rootSchema);
        if (!itemSchema) continue;
        const itemObj = resolveObjectSchema(itemSchema, rootSchema);
        /* Pastikan array ini memang container request item (bukan array string URL referensi). */
        if (!itemObj.properties || pickSupportedKey(itemObj.properties, ["prompt", "description", "instruction", "text", "brief"], "")) {
            return key;
        }
    }
    for (const reqKey of rootObj.required || []) {
        if (!Object.prototype.hasOwnProperty.call(props, reqKey)) continue;
        const itemSchema = resolveArrayItemSchema(props[reqKey], rootSchema);
        const itemObj = resolveObjectSchema(itemSchema, rootSchema);
        if (itemObj.properties && pickSupportedKey(itemObj.properties, ["prompt", "description", "instruction", "text", "brief"], "")) {
            return reqKey;
        }
    }
    return "";
}

function buildKeyframesArguments(keyframesTool, {
    prompt,
    aspectRatio,
    projectId,
    resolvedModel,
    quality,
    importedAssets,
    rawReferenceItems,
    minimal = false,
    omitModel = false,
    useAltRef = false
}) {
    const rootSchema = keyframesTool?.inputSchema;
    const hasRefs = importedAssets.length > 0 || rawReferenceItems.length > 0;
    const rootObj = resolveObjectSchema(
        rootSchema,
        rootSchema,
        branch => {
            const p = branch?.properties || {};
            if (hasRefs) {
                return Boolean(p.keyframes || p.items || p.shots || p.referenceAssets || p.references || p.assetIds);
            }
            return Boolean(p.keyframes || p.items || p.shots || p.prompt);
        }
    );
    const props = rootObj.properties;
    const ratio = aspectRatio === "16:9" ? "16:9" : "9:16";
    const cappedImportedAssets = importedAssets.slice(0, OPUS_MAX_REFERENCE_IMAGES);
    const cappedRawRefs = rawReferenceItems.slice(0, OPUS_MAX_REFERENCE_IMAGES);

    const batchArrayKey = detectBatchArrayKey(rootObj, rootSchema);
    if (batchArrayKey && props) {
        const args = {};
        const projectKey = pickSupportedKey(props, ["projectId", "project_id"], "");
        if (projectKey && projectId) args[projectKey] = projectId;
        const reqKeyName = pickSupportedKey(props, ["requestKey", "idempotencyKey", "request_key", "idempotency_key"], "");
        if (reqKeyName) args[reqKeyName] = makeUuid();

        const itemSchema = resolveArrayItemSchema(props[batchArrayKey], rootSchema);
        const itemObj = resolveObjectSchema(itemSchema, rootSchema);
        const singleItem = {};
        populateKeyframeTargetFields(singleItem, itemObj, rootSchema, {
            prompt,
            ratio,
            projectId,
            resolvedModel,
            quality,
            cappedImportedAssets,
            cappedRawRefs,
            isBatchItem: true,
            minimal,
            omitModel,
            useAltRef
        });
        args[batchArrayKey] = [singleItem];

        /* Isi juga atribut level batch bila dideklarasikan di top-level skema. */
        if (resolvedModel && !omitModel) {
            const topModelKey = pickSupportedKey(props, ["model", "imageModel", "image_model", "modelId"], "");
            if (topModelKey) {
                const allowed = extractAllowedValues(props[topModelKey], rootSchema);
                const matched = matchModelValue(resolvedModel, allowed);
                if (matched !== null) args[topModelKey] = matched;
                else if (rootObj.required.includes(topModelKey) && allowed.length) args[topModelKey] = allowed[0];
            }
        }
        const topRatioKey = pickSupportedKey(props, ["aspectRatio", "aspect_ratio", "aspect", "ratio"], "");
        if (topRatioKey) {
            const allowed = extractAllowedValues(props[topRatioKey], rootSchema);
            const matched = matchAspectRatioValue(ratio, allowed);
            if (matched !== null) args[topRatioKey] = matched;
            else if (rootObj.required.includes(topRatioKey) && allowed.length) args[topRatioKey] = allowed[0];
        }
        if (quality && (!minimal || rootObj.required.some(k => /quality/i.test(k)))) {
            const topQualityKey = pickSupportedKey(props, ["quality", "imageQuality", "image_quality"], "");
            if (topQualityKey) {
                const allowed = extractAllowedValues(props[topQualityKey], rootSchema);
                const matched = matchQualityValue(quality, allowed);
                if (matched !== null) args[topQualityKey] = matched;
                else if (rootObj.required.includes(topQualityKey) && allowed.length) args[topQualityKey] = allowed[0];
            }
        }
        if (cappedImportedAssets.length > 0 && singleItem.referenceAssets === undefined && singleItem.references === undefined && singleItem.assetIds === undefined) {
            const topRefKey = pickSupportedKey(props, ["referenceAssets", "reference_assets", "references", "assetIds", "referenceAssetIds"], "");
            if (topRefKey) {
                args[topRefKey] = buildReferenceValueForSchema(props[topRefKey], rootSchema, cappedImportedAssets, { minimal, useAltRef });
            }
        }

        fillMissingRequiredFields(args, rootObj, rootSchema, {
            prompt,
            ratio,
            projectId,
            model: resolvedModel,
            quality,
            hasReferences: cappedImportedAssets.length > 0 || cappedRawRefs.length > 0,
            defaultLabel: "kf-1"
        });
        return args;
    }

    const args = {};
    populateKeyframeTargetFields(args, rootObj, rootSchema, {
        prompt,
        ratio,
        projectId,
        resolvedModel,
        quality,
        cappedImportedAssets,
        cappedRawRefs,
        isBatchItem: false,
        minimal,
        omitModel,
        useAltRef
    });
    return args;
}

const CLIENT_ITEM_IDS = new Set([
    "kf-1",
    "keyframe-1",
    "ref-1",
    "ref-2",
    "ref-3",
    "image1",
    "image2",
    "image3",
    "character_reference",
    "outfit_reference",
    "extra_reference"
]);

function unwrapResultEnvelope(rawData) {
    let curr = rawData;
    for (let depth = 0; depth < 3; depth += 1) {
        if (!curr || typeof curr !== "object" || Array.isArray(curr)) break;
        const hasCoreKeys = Boolean(
            curr.jobId
            || curr.job_id
            || curr.jobIds
            || curr.job_ids
            || curr.jobs
            || curr.keyframes
            || curr.items
            || curr.assets
            || curr.uploads
            || curr.submissions
            || curr.tasks
            || curr.operations
            || curr.status !== undefined
            || curr.ok !== undefined
            || curr.success !== undefined
            || curr.error !== undefined
            || curr.errorCode !== undefined
            || curr.error_code !== undefined
            || curr.errors !== undefined
            || curr.rejected !== undefined
            || curr.assetId !== undefined
        );
        if (hasCoreKeys) break;
        const inner = curr.data ?? curr.result ?? curr.output ?? curr.payload ?? curr.response;
        if (inner && typeof inner === "object" && !Array.isArray(inner)) {
            curr = inner;
            continue;
        }
        break;
    }
    return curr;
}

function looksLikeErrorOrStatusToken(val) {
    const s = String(val || "").trim();
    if (!s) return true;
    if (/^(?:ok|true|false|null|undefined|none|pending|queued|running|processing|in_progress|starting|submitted|completed|succeeded|concluded|done|ready|success|failed|error|cancelled|canceled|rejected|aborted|expired|timeout|timed_out|submission_unknown)$/i.test(s)) {
        return true;
    }
    if (!/\d/.test(s) && /(?:^|[_.-])(?:timeout|timed_out|error|failed|failure|rejected|invalid|missing|not_found|unauthorized|forbidden|denied|cancelled|canceled|unknown|exceeded|unavailable|expired|exhausted|blocked|limit|pending|queued|status|state|empty|aborted)(?:$|[_.-])/i.test(s)) {
        return true;
    }
    return false;
}

function isEntryMarkedFailed(el) {
    if (!el || typeof el !== "object") return false;
    return Boolean(
        el.ok === false
        || el.success === false
        || el.accepted === false
        || el.valid === false
        || el.rejected === true
        || isTerminalFailureStatus(el.status || el.state)
        || (hasMeaningfulErrorValue(el.error) && !isCompletedStatus(el.status || el.state))
        || (Boolean(el.errorCode || el.error_code || el.errorMessage || el.error_message) && !isCompletedStatus(el.status || el.state))
        || ((isFailureCodeString(el.code) || isFailureCodeString(el.reason)) && !isCompletedStatus(el.status || el.state))
    );
}

function findDeepJobId(rootData, rawText = "") {
    const excluded = new Set(CLIENT_ITEM_IDS);
    const collectExcluded = obj => {
        if (!obj || typeof obj !== "object") return;
        for (const k of [
            "projectId",
            "project_id",
            "assetId",
            "asset_id",
            "outputAssetId",
            "output_asset_id",
            "requestKey",
            "request_key",
            "idempotencyKey",
            "organizationId",
            "orgId",
            "code",
            "errorCode",
            "error_code",
            "error",
            "status",
            "state",
            "reason",
            "field",
            "model"
        ]) {
            if (typeof obj[k] === "string" && obj[k].trim()) {
                excluded.add(obj[k].trim());
            }
        }
    };
    const isUsableId = val => {
        const s = typeof val === "string" ? val.trim() : "";
        return Boolean(
            s
            && !/\s/.test(s)
            && !excluded.has(s)
            && !looksLikeErrorOrStatusToken(s)
            && !/^https?:\/\//i.test(s)
            && !/^data:/i.test(s)
            && !/^(?:projects|\/tmp)\//i.test(s)
        );
    };

    if (rootData && typeof rootData === "object") {
        const seen = new WeakSet();
        const queue = [{ node: rootData, depth: 0 }];
        const explicitIdKeys = [
            "jobId",
            "job_id",
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
            "keyframeJobId",
            "keyframe_job_id",
            "asyncJobId",
            "async_job_id",
            "batchJobId",
            "batch_job_id"
        ];
        const explicitArrayKeys = [
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

        while (queue.length > 0) {
            const { node, depth } = queue.shift();
            if (!node || typeof node !== "object" || seen.has(node)) continue;
            seen.add(node);
            if (!Array.isArray(node)) {
                collectExcluded(node);
                for (const key of explicitIdKeys) {
                    if (isUsableId(node[key])) return node[key].trim();
                }
                for (const [dynKey, dynVal] of Object.entries(node)) {
                    if (/(?:job|task|submission|operation|execution|generation|run)_?id$/i.test(dynKey) && isUsableId(dynVal)) {
                        return dynVal.trim();
                    }
                    if (/(?:job|task|submission|operation|execution|generation|run)_?ids$/i.test(dynKey) && Array.isArray(dynVal)) {
                        for (const el of dynVal) {
                            if (isUsableId(el)) return el.trim();
                        }
                    }
                }
                if (typeof node.job === "string" && isUsableId(node.job)) {
                    return node.job.trim();
                }
                for (const arrKey of explicitArrayKeys) {
                    if (Array.isArray(node[arrKey])) {
                        for (const el of node[arrKey]) {
                            if (isUsableId(el)) return el.trim();
                            if (el && typeof el === "object") {
                                collectExcluded(el);
                                const subId = el.jobId || el.job_id || el.taskId || el.operationId || el.executionId || el.id;
                                if (isUsableId(subId)) return String(subId).trim();
                            }
                        }
                    }
                }
                for (const subKey of ["job", "submission", "task", "operation", "execution"]) {
                    const sub = node[subKey];
                    if (sub && typeof sub === "object" && !Array.isArray(sub)) {
                        collectExcluded(sub);
                        const subId = sub.jobId || sub.job_id || sub.taskId || sub.operationId || sub.executionId || sub.id;
                        if (isUsableId(subId)) return String(subId).trim();
                    }
                }
                for (const containerKey of ["jobs", "submissions", "tasks", "operations"]) {
                    const container = node[containerKey];
                    if (Array.isArray(container)) {
                        for (const el of container) {
                            if (isUsableId(el)) return el.trim();
                            if (el && typeof el === "object") {
                                collectExcluded(el);
                                const elId = el.jobId || el.job_id || el.taskId || el.operationId || el.executionId || el.id;
                                if (isUsableId(elId)) return String(elId).trim();
                            }
                        }
                    } else if (container && typeof container === "object") {
                        for (const [mapKey, mapVal] of Object.entries(container)) {
                            if (isUsableId(mapVal)) return mapVal.trim();
                            if (mapVal && typeof mapVal === "object") {
                                collectExcluded(mapVal);
                                const mvId = mapVal.jobId || mapVal.job_id || mapVal.id;
                                if (isUsableId(mvId)) return String(mvId).trim();
                                if (isUsableId(mapKey)) return mapKey.trim();
                            }
                        }
                    }
                }
            }

            if (depth < 5) {
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
        const kvMatch = /\b(?:jobId|job_id|taskId|task_id|submissionId|operationId|executionId)\s*["']?\s*[:=]\s*["']?([A-Za-z0-9][A-Za-z0-9_.:-]{2,})["']?/i.exec(cleanText);
        if (kvMatch && isUsableId(kvMatch[1])) {
            return kvMatch[1].trim();
        }
        /* Hanya pindai teks bebas dengan prefix bila respons bukan JSON terstruktur, dan wajib memuat digit angka. */
        if (!rootData) {
            const prefixMatch = /\b((?:job|exec|task|op|sub)[_-](?=[A-Za-z0-9_-]*\d)[A-Za-z0-9_-]{4,})\b/.exec(cleanText);
            if (prefixMatch && isUsableId(prefixMatch[1])) {
                return prefixMatch[1].trim();
            }
        }
    }
    return "";
}

function extractJobDescriptor(rawData, rawText = "") {
    if (Array.isArray(rawData) && rawData.length > 0) {
        return extractJobDescriptor({ items: rawData }, rawText);
    }
    const data = unwrapResultEnvelope(rawData);
    if (!data || typeof data !== "object") {
        const textJobId = findDeepJobId(null, rawText);
        return { jobId: textJobId, status: "", errorCode: "", message: "", target: null, itemFailed: false };
    }

    let firstItem = null;
    let fromFailureList = false;
    let listErrorText = "";
    let containerMapKeyId = "";

    for (const failKey of ["errors", "failed", "rejected", "failures"]) {
        if (Array.isArray(data[failKey]) && data[failKey].length > 0) {
            const objList = data[failKey].filter(el => el && typeof el === "object");
            const strList = data[failKey].filter(el => typeof el === "string" && el.trim());
            if (objList.length > 0) {
                firstItem = objList[0];
                fromFailureList = true;
                break;
            }
            if (strList.length > 0) {
                listErrorText = strList.join("; ");
                fromFailureList = true;
                break;
            }
        }
    }

    const containerKeys = [
        "jobs",
        "keyframes",
        "items",
        "assets",
        "uploads",
        "results",
        "submissions",
        "tasks",
        "clips",
        "outputs",
        "generations",
        "images",
        "frames",
        "operations",
        "records",
        "entries",
        "batches"
    ];

    if (!firstItem) {
        for (const listKey of containerKeys) {
            if (Array.isArray(data[listKey]) && data[listKey].length > 0) {
                const objList = data[listKey].filter(el => el && typeof el === "object");
                if (objList.length > 0) {
                    const failedEntry = objList.find(isEntryMarkedFailed);
                    firstItem = failedEntry || objList[0];
                    break;
                }
            }
        }
    }

    if (!firstItem) {
        for (const mapName of ["jobs", "keyframes", "items", "results", "submissions", "tasks", "outputs", "operations"]) {
            const mapObj = data[mapName];
            if (mapObj && typeof mapObj === "object" && !Array.isArray(mapObj)) {
                const entries = Object.entries(mapObj).filter(([, v]) => v && typeof v === "object");
                if (entries.length > 0) {
                    const chosen = entries.find(([, v]) => isEntryMarkedFailed(v)) || entries[0];
                    firstItem = chosen[1];
                    if (!CLIENT_ITEM_IDS.has(String(chosen[0] || "").trim())) {
                        containerMapKeyId = String(chosen[0] || "").trim();
                    }
                    break;
                }
            }
        }
    }

    const target = firstItem || data;
    const itemFailed = Boolean(
        fromFailureList
        || isEntryMarkedFailed(target !== data ? target : null)
        || target?.ok === false
        || target?.success === false
        || isTerminalFailureStatus(target?.status || target?.state)
    );

    const rawErrorObj = target.error && typeof target.error === "object" && !Array.isArray(target.error)
        ? target.error
        : (data.error && typeof data.error === "object" && !Array.isArray(data.error) ? data.error : null);
    const rawErrorStr = typeof target.error === "string"
        ? target.error.trim()
        : (typeof data.error === "string" ? data.error.trim() : listErrorText);

    const sanitizeCandidateId = raw => {
        const s = String(raw || "").trim();
        return s && !looksLikeErrorOrStatusToken(s) ? s : "";
    };

    const nestedJob = target.job && typeof target.job === "object" ? target.job : null;
    const isAssetContainer = (Array.isArray(data.assets) || Array.isArray(data.uploads)) && !Array.isArray(data.jobs);
    const candidateTargetId = (
        target !== data
        && !itemFailed
        && !isAssetContainer
        && target.id !== data.projectId
        && target.id !== data.assetId
        && !CLIENT_ITEM_IDS.has(String(target.id || "").trim())
    )
        ? sanitizeCandidateId(target.id)
        : "";

    const directJobId = sanitizeCandidateId(
        target.jobId
        || target.job_id
        || (typeof target.job === "string" ? target.job : "")
        || nestedJob?.jobId
        || nestedJob?.job_id
        || nestedJob?.id
        || (Array.isArray(target.jobIds) ? target.jobIds[0] : "")
        || (Array.isArray(target.job_ids) ? target.job_ids[0] : "")
        || (Array.isArray(data.jobIds) ? data.jobIds[0] : "")
        || (Array.isArray(data.job_ids) ? data.job_ids[0] : "")
        || (data.jobId || data.job_id || "")
        || ""
    );

    const deepJobId = (!directJobId && !itemFailed)
        ? sanitizeCandidateId(findDeepJobId(rawData, rawText))
        : "";

    const jobId = String(
        directJobId
        || deepJobId
        || (!itemFailed ? sanitizeCandidateId(containerMapKeyId) : "")
        || candidateTargetId
        || ""
    ).trim();

    const status = String(
        target.status
        || target.state
        || nestedJob?.status
        || nestedJob?.state
        || data.status
        || data.state
        || ""
    ).trim();
    const errorCode = String(
        target.errorCode
        || target.error_code
        || (itemFailed ? target.code : "")
        || (isFailureCodeString(target.code) ? target.code : "")
        || (isFailureCodeString(target.reason) ? target.reason : "")
        || (isFailureCodeString(status) ? status : "")
        || rawErrorObj?.errorCode
        || rawErrorObj?.code
        || data.errorCode
        || data.error_code
        || (isFailureCodeString(data.code) ? data.code : "")
        || (isFailureCodeString(data.reason) ? data.reason : "")
        || ((data.ok === false || data.success === false || hasMeaningfulErrorValue(data.error)) ? data.code : "")
        || (/^[a-z0-9_.-]+$/i.test(rawErrorStr) ? rawErrorStr : "")
        || ""
    ).trim();

    const fieldSummary = itemFailed && target.field
        ? `${target.field}${target.reason ? `: ${target.reason}` : ""}`
        : "";
    const baseMessage = String(
        target.errorMessage
        || target.error_message
        || target.reason
        || (itemFailed && typeof target.message === "string" ? target.message : "")
        || rawErrorObj?.message
        || data.message
        || rawErrorStr
        || fieldSummary
        || ""
    ).trim();
    const validationDetail = formatValidationDetails(
        rawErrorObj?.issues
        || rawErrorObj?.details
        || rawErrorObj?.detail
        || rawErrorObj?.errors
        || target.issues
        || target.details
        || target.detail
        || target.errors
        || data.issues
        || data.details
        || data.detail
        || data.errors
        || data.validationErrors
        || data.hint
    );
    const message = [baseMessage, validationDetail]
        .filter(Boolean)
        .filter((part, idx, arr) => idx === 0 || !arr[0].includes(part))
        .join(" — ");

    return { jobId, status, errorCode, message, target, itemFailed };
}

function isTerminalFailureStatus(status) {
    return /^(failed|error|cancelled|canceled|rejected|aborted|expired|job_queue_timeout|queue_timeout)$/i.test(String(status || "").trim());
}

function isUnknownSubmissionStatus(status) {
    return /^(submission_unknown|credit_reservation_pending|admission_incomplete)$/i.test(String(status || "").trim());
}

function isCompletedStatus(status) {
    return /^(completed|succeeded|concluded|done|ready|success)$/i.test(String(status || "").trim());
}

function buildListJobsArguments(listJobsTool, projectId) {
    const rootSchema = listJobsTool?.inputSchema;
    const rootObj = resolveObjectSchema(rootSchema, rootSchema);
    const props = rootObj.properties;
    const listArgs = {};
    if (projectId) {
        const projectKey = pickSupportedKey(props, ["projectId", "project_id", "project"], "projectId");
        if (projectKey) listArgs[projectKey] = projectId;
    }
    const limitKey = pickSupportedKey(props, ["limit", "pageSize", "page_size", "maxResults", "max_results"], "");
    if (limitKey) {
        const maxLimit = typeof props?.[limitKey]?.maximum === "number" ? props[limitKey].maximum : 10;
        listArgs[limitKey] = Math.max(1, Math.min(10, maxLimit));
    }
    fillMissingRequiredFields(listArgs, rootObj, rootSchema, {
        projectId,
        defaultLabel: projectId || "kf-1"
    });
    return listArgs;
}

async function discoverProjectJobOrImageViaMcp(session, tools, { projectId, bearerToken }) {
    let projectConfirmedEmpty = false;
    const listJobsTool = findMcpTool(tools, "list_jobs");
    if (listJobsTool && projectId) {
        try {
            const listArgs = buildListJobsArguments(listJobsTool, projectId);
            const listed = await session.callTool(listJobsTool.name, listArgs);
            if (!listed.isError) {
                const listedInfo = extractJobDescriptor(listed.data, listed.text);
                if (isUnknownSubmissionStatus(listedInfo.status) || isUnknownSubmissionStatus(listedInfo.errorCode)) {
                    throw opusError({
                        code: listedInfo.errorCode || listedInfo.status || "submission_unknown",
                        message: listedInfo.message || listed.text || "Status pengiriman job gambar belum pasti.",
                        status: 502,
                        jobId: listedInfo.jobId
                    });
                }
                if (listedInfo.itemFailed || isTerminalFailureStatus(listedInfo.status)) {
                    throw opusError({
                        code: listedInfo.errorCode || "job_failed",
                        message: listedInfo.message || listed.text || `Job gambar Opus berakhir dengan status ${listedInfo.status || "failed"}.`,
                        status: 502,
                        jobId: listedInfo.jobId
                    });
                }
                if (!listedInfo.jobId || isCompletedStatus(listedInfo.status)) {
                    const imgFromContent = await extractImageFromValue(listed.content, bearerToken);
                    if (imgFromContent) return { image: imgFromContent, raw: listed.data, info: listedInfo, projectConfirmedEmpty: false };
                    const imgFromData = await extractImageFromValue(listed.data, bearerToken);
                    if (imgFromData) return { image: imgFromData, raw: listed.data, info: listedInfo, projectConfirmedEmpty: false };
                }
                if (listedInfo.jobId) {
                    return { image: null, raw: listed.data, info: listedInfo, projectConfirmedEmpty: false };
                }
                const unwrappedListed = unwrapResultEnvelope(listed.data);
                if (
                    unwrappedListed
                    && typeof unwrappedListed === "object"
                    && (
                        (Array.isArray(unwrappedListed.jobs) && unwrappedListed.jobs.length === 0)
                        || (Array.isArray(unwrappedListed.items) && unwrappedListed.items.length === 0)
                    )
                ) {
                    projectConfirmedEmpty = true;
                }
            }
        } catch (err) {
            if (err?.code === "submission_unknown" || err?.code === "job_failed" || err?.jobId) {
                throw err;
            }
            /* Abaikan bila server menolak list_jobs opsional; lanjut cek fallback lain. */
        }
    }

    const statusTool = findMcpTool(tools, "get_status");
    if (!projectConfirmedEmpty && statusTool && projectId) {
        const rootSchema = statusTool.inputSchema;
        const rootObj = resolveObjectSchema(rootSchema, rootSchema);
        const props = rootObj.properties;
        const req = Array.isArray(rootObj.required) ? rootObj.required : [];
        const requiresExplicitJobId = req.some(k => /^(?:jobId|job_id|jobIds|job_ids|id)$/i.test(k));
        const projectKey = pickSupportedKey(props, ["projectId", "project_id"], "");
        if (!requiresExplicitJobId && projectKey) {
            try {
                const probeArgs = { [projectKey]: projectId };
                if (props && Object.prototype.hasOwnProperty.call(props, "watch")) {
                    probeArgs.watch = true;
                    const timeoutKey = pickSupportedKey(props, ["timeoutSeconds", "timeout_seconds", "waitSeconds", "wait_seconds"], "");
                    if (timeoutKey) probeArgs[timeoutKey] = 10;
                }
                fillMissingRequiredFields(probeArgs, rootObj, rootSchema, { projectId, defaultLabel: projectId });
                const probed = await session.callTool(statusTool.name, probeArgs);
                if (!probed.isError) {
                    const probedInfo = extractJobDescriptor(probed.data, probed.text);
                    if (isUnknownSubmissionStatus(probedInfo.status) || isUnknownSubmissionStatus(probedInfo.errorCode)) {
                        throw opusError({
                            code: probedInfo.errorCode || probedInfo.status || "submission_unknown",
                            message: probedInfo.message || probed.text || "Status pengiriman job gambar belum pasti.",
                            status: 502,
                            jobId: probedInfo.jobId
                        });
                    }
                    if (!probedInfo.jobId || isCompletedStatus(probedInfo.status)) {
                        const imgFromContent = await extractImageFromValue(probed.content, bearerToken);
                        if (imgFromContent) return { image: imgFromContent, raw: probed.data, info: probedInfo, projectConfirmedEmpty: false };
                        const imgFromData = await extractImageFromValue(probed.data, bearerToken);
                        if (imgFromData) return { image: imgFromData, raw: probed.data, info: probedInfo, projectConfirmedEmpty: false };
                    }
                    if (probedInfo.jobId) {
                        return { image: null, raw: probed.data, info: probedInfo, projectConfirmedEmpty: false };
                    }
                }
            } catch (err) {
                if (err?.code === "submission_unknown" || err?.jobId) {
                    throw err;
                }
                /* Abaikan kegagalan probe get_status tanpa jobId. */
            }
        }
    }

    return { image: null, raw: null, info: null, projectConfirmedEmpty };
}

async function pollMcpJobUntilDone(
    session,
    statusTool,
    { jobId, projectId, bearerToken, timeoutMs, pollIntervalMs, listJobsTool = null }
) {
    if (!statusTool) {
        throw opusError({
            code: "status_tool_missing",
            message: `Job gambar Opus (${jobId}) masih diproses secara asinkron tetapi server MCP tidak menyediakan tool get_status.`,
            status: 502,
            jobId
        });
    }
    const rootSchema = statusTool?.inputSchema;
    const rootObj = resolveObjectSchema(rootSchema, rootSchema);
    const props = rootObj.properties;
    const deadline = Date.now() + timeoutMs;
    let activeJobId = jobId;
    let notFoundRetries = 0;
    let pollAttempt = 0;

    while (Date.now() < deadline) {
        pollAttempt += 1;
        const pollArgs = {};
        const jobIdsKey = pickSupportedKey(props, ["jobIds", "job_ids"], "");
        if (jobIdsKey) {
            pollArgs[jobIdsKey] = [activeJobId];
        } else {
            const jobKey = pickSupportedKey(props, ["jobId", "job_id", "id"], "jobId");
            pollArgs[jobKey] = activeJobId;
        }
        const projectKey = pickSupportedKey(props, ["projectId", "project_id"], "");
        if (projectKey && projectId) pollArgs[projectKey] = projectId;
        if (props && Object.prototype.hasOwnProperty.call(props, "watch")) {
            pollArgs.watch = true;
            const timeoutKey = pickSupportedKey(props, ["timeoutSeconds", "timeout_seconds", "waitSeconds", "wait_seconds"], "");
            if (timeoutKey) {
                const maxAllowedSec = typeof props[timeoutKey]?.maximum === "number" ? props[timeoutKey].maximum : 25;
                const remainingSec = Math.max(1, Math.min(25, maxAllowedSec, Math.floor((deadline - Date.now()) / 1000)));
                pollArgs[timeoutKey] = remainingSec;
            }
        } else {
            const waitKey = pickSupportedKey(props, ["waitSeconds", "wait_seconds", "timeoutSeconds", "timeout_seconds"], "");
            if (waitKey) {
                const maxAllowedSec = typeof props?.[waitKey]?.maximum === "number" ? props[waitKey].maximum : 25;
                const remainingSec = Math.max(1, Math.min(25, maxAllowedSec, Math.floor((deadline - Date.now()) / 1000)));
                pollArgs[waitKey] = remainingSec;
            }
        }
        fillMissingRequiredFields(pollArgs, rootObj, rootSchema, { projectId, defaultLabel: activeJobId });

        const polled = await session.callTool(statusTool.name, pollArgs);
        const info = extractJobDescriptor(polled.data, polled.text);
        if (isUnknownSubmissionStatus(info.status) || isUnknownSubmissionStatus(info.errorCode)) {
            throw opusError({
                code: info.errorCode || info.status || "submission_unknown",
                message: info.message || polled.text || "Status pengiriman job ke provider belum pasti.",
                status: 502,
                jobId: activeJobId
            });
        }
        if (polled.isError || polled.data?.ok === false || info.itemFailed === true || isTerminalFailureStatus(info.status)) {
            const combinedErrorText = `${info.errorCode || ""} ${info.message || ""} ${polled.text || ""}`;
            const isNonTerminalDeadline =
                /\bstill\s+non-?terminal\b/i.test(combinedErrorText) ||
                /\bnon-?terminal\s+after\b.*\bpolling\s+deadline\b/i.test(combinedErrorText) ||
                /\bafter\s+the\s+worker\s+polling\s+deadline\b/i.test(combinedErrorText);
            if (isNonTerminalDeadline) {
                if (listJobsTool && projectId) {
                    try {
                        const listed = await session.callTool(
                            listJobsTool.name,
                            buildListJobsArguments(listJobsTool, projectId)
                        );
                        if (!listed.isError) {
                            const listedImg = (await extractImageFromValue(listed.content, bearerToken))
                                || (await extractImageFromValue(listed.data, bearerToken));
                            if (listedImg) return { image: listedImg, raw: listed.data };
                        }
                    } catch {
                        /* Job Egress masih berjalan di Opus; lanjutkan polling sampai batas timeout kita. */
                    }
                }
                const retryWait = Math.min(6_000, Math.max(25, pollIntervalMs));
                if (Date.now() + retryWait <= deadline) {
                    await sleep(retryWait);
                    continue;
                }
                break;
            }
            const isJobNotFound = /\bjob_not_found\b/i.test(combinedErrorText);
            if (isJobNotFound && notFoundRetries < 2 && Date.now() + 500 < deadline) {
                notFoundRetries += 1;
                if (listJobsTool && projectId) {
                    try {
                        const listed = await session.callTool(
                            listJobsTool.name,
                            buildListJobsArguments(listJobsTool, projectId)
                        );
                        if (!listed.isError) {
                            const listedImg = (await extractImageFromValue(listed.content, bearerToken))
                                || (await extractImageFromValue(listed.data, bearerToken));
                            if (listedImg) return { image: listedImg, raw: listed.data };
                            const listedInfo = extractJobDescriptor(listed.data, listed.text);
                            if (listedInfo.jobId && !listedInfo.itemFailed && !isTerminalFailureStatus(listedInfo.status)) {
                                activeJobId = listedInfo.jobId;
                            }
                        }
                    } catch {
                        /* Lanjut tunggu propagasi status job. */
                    }
                }
                const retryWait = Math.min(1200, Math.max(25, pollIntervalMs));
                if (Date.now() + retryWait < deadline) {
                    await sleep(retryWait);
                    continue;
                }
            }
            throw opusError({
                code: info.errorCode || "job_failed",
                message: info.message || polled.text || `Job gambar Opus berakhir dengan status ${info.status || "failed"}.`,
                status: 502,
                jobId: activeJobId
            });
        }

        if (polled.data?.timedOut !== true && (isCompletedStatus(info.status) || !info.status)) {
            const fromContent = await extractImageFromValue(polled.content, bearerToken);
            if (fromContent) return { image: fromContent, raw: polled.data };
            if (info.target) {
                const fromTarget = await extractImageFromValue(info.target, bearerToken);
                if (fromTarget) return { image: fromTarget, raw: polled.data };
            }
            if (polled.data && info.target !== polled.data) {
                const fromFullData = await extractImageFromValue(polled.data, bearerToken);
                if (fromFullData) return { image: fromFullData, raw: polled.data };
            }
            if (isCompletedStatus(info.status)) {
                if (listJobsTool && projectId) {
                    try {
                        const listed = await session.callTool(
                            listJobsTool.name,
                            buildListJobsArguments(listJobsTool, projectId)
                        );
                        const fromListedContent = await extractImageFromValue(listed.content, bearerToken);
                        if (fromListedContent) return { image: fromListedContent, raw: listed.data };
                        const fromListedData = await extractImageFromValue(listed.data, bearerToken);
                        if (fromListedData) return { image: fromListedData, raw: listed.data };
                    } catch {
                        /* Lanjut ke empty_job_output dengan diagnostik respons get_status. */
                    }
                }
                const diag = summarizePayloadForDiagnostics(polled.data, polled.text);
                throw opusError({
                    code: "empty_job_output",
                    message: `Job gambar Opus (${jobId}) selesai tetapi tidak menyertakan URL/data gambar. [response: ${diag}]`,
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
        const adaptiveIntervalMs = pollIntervalMs >= 1_000
            ? Math.min(6_000, pollIntervalMs + Math.max(0, pollAttempt - 1) * 500)
            : pollIntervalMs;
        const delayMs = suggestedSec > 0
            ? Math.min(8_000, Math.round(suggestedSec * 1000))
            : adaptiveIntervalMs;
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
    resolvedModel,
    quality,
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
        const projRootSchema = createProjectTool.inputSchema;
        const projObj = resolveObjectSchema(projRootSchema, projRootSchema);
        const projProps = projObj.properties;
        const projArgs = {};
        const titleKey = pickSupportedKey(projProps, ["name", "title", "projectName", "project_name"], "name");
        if (titleKey) projArgs[titleKey] = "GEN-Z.AI Studio Medsos";
        const reqKey = pickSupportedKey(projProps, ["requestKey", "idempotencyKey", "request_key"], "");
        if (reqKey) projArgs[reqKey] = makeUuid();
        fillMissingRequiredFields(projArgs, projObj, projRootSchema, {
            ratio: aspectRatio,
            defaultLabel: "GEN-Z.AI Studio Medsos"
        });
        const created = await session.callTool(createProjectTool.name, projArgs);
        const createFailure = extractToolFailure(created, "create_project_failed");
        if (createFailure) {
            throw opusError({
                code: createFailure.code || "create_project_failed",
                message: createFailure.message || "Gagal membuat proyek media di Opus Labs."
            });
        }
        projectId = String(
            created.data?.projectId
            || created.data?.project_id
            || created.data?.project?.id
            || created.data?.project?.projectId
            || created.data?.id
            || ""
        ).trim();
    }

    const cappedReferenceItems = referenceItems.slice(0, OPUS_MAX_REFERENCE_IMAGES);
    const importedAssets = [];
    const importTool = findMcpTool(tools, "import_assets");
    if (cappedReferenceItems.length > 0 && importTool) {
        for (let idx = 0; idx < cappedReferenceItems.length; idx += 1) {
            const item = cappedReferenceItems[idx];
            const imported = await importSingleAssetViaMcp(session, importTool, projectId, item, `ref-${idx + 1}`);
            importedAssets.push(imported);
        }
    }

    let genArgs = null;
    let genResult = null;
    let info = null;
    let genFailure = null;
    let recoveredRemoteDimensions = false;
    let discoveredDuringQueueTimeout = null;

    const runKeyframeAttempts = async () => {
        const hasAltRefs = importedAssets.some(a => Boolean(a.altRef));
        const attemptProfiles = [
            { minimal: false, omitModel: false, useAltRef: false },
            ...(hasAltRefs ? [{ minimal: false, omitModel: false, useAltRef: true }] : []),
            { minimal: true, omitModel: false, useAltRef: false },
            { minimal: true, omitModel: true, useAltRef: false }
        ];
        const seenPayloads = new Set();

        for (const profile of attemptProfiles) {
            const candidateArgs = buildKeyframesArguments(keyframesTool, {
                prompt,
                aspectRatio,
                projectId,
                resolvedModel,
                quality,
                importedAssets,
                rawReferenceItems: cappedReferenceItems,
                minimal: profile.minimal,
                omitModel: profile.omitModel,
                useAltRef: profile.useAltRef
            });
            const signature = JSON.stringify({ ...candidateArgs, requestKey: undefined });
            if (seenPayloads.has(signature)) continue;
            seenPayloads.add(signature);

            let projectConfirmedEmptyAfterTimeout = false;
            for (let sameKeyTry = 0; sameKeyTry < 3; sameKeyTry += 1) {
                genArgs = candidateArgs;
                try {
                    genResult = await session.callTool(keyframesTool.name, genArgs);
                } catch (rpcThrown) {
                    if (!rpcThrown?.jobId && rpcThrown?.code === "invalid_arguments") {
                        genFailure = { code: "invalid_arguments", message: rpcThrown.message, jobId: "" };
                        break;
                    }
                    throw rpcThrown;
                }
                info = extractJobDescriptor(genResult.data, genResult.text);
                if (isUnknownSubmissionStatus(info.status) || isUnknownSubmissionStatus(info.errorCode)) {
                    throw opusError({
                        code: info.errorCode || info.status || "submission_unknown",
                        message: info.message || genResult.text || "Status pengiriman job gambar belum pasti.",
                        status: 502,
                        jobId: info.jobId
                    });
                }
                genFailure = extractToolFailure(genResult, "generation_failed");
                if (!genFailure) break;

                const isQueueTimeout = !genFailure.jobId
                    && /\b(?:job_queue_timeout|queue_timeout)\b/i.test(`${genFailure.code} ${genFailure.message} ${genResult.text || ""}`);
                if (!isQueueTimeout) break;

                /*
                 * Saat job_queue_timeout terjadi:
                 * 1) Cek list_jobs proyek terlebih dahulu — bila job sebenarnya sudah masuk antrian,
                 *    pakai jobId asli tersebut tanpa submit ulang.
                 * 2) Bila belum ada job di proyek, ulangi pengiriman dengan requestKey UUID yang SAMA PERSIS
                 *    (idempotent sesuai kontrak resmi Opus Labs, 0 risiko tagihan ganda).
                 */
                if (projectId) {
                    const checkProject = await discoverProjectJobOrImageViaMcp(session, tools, {
                        projectId,
                        bearerToken: auth.token
                    });
                    if (checkProject.image || checkProject.info?.jobId) {
                        discoveredDuringQueueTimeout = checkProject;
                        genFailure = null;
                        break;
                    }
                    projectConfirmedEmptyAfterTimeout = Boolean(checkProject.projectConfirmedEmpty);
                }
                if (sameKeyTry < 2) {
                    const backoffMs = Math.min(2500, Math.max(30, pollIntervalMs * (sameKeyTry + 1)));
                    await sleep(backoffMs);
                }
            }

            if (!genFailure) break;

            /* Retry kandidat baru HANYA bila terbukti belum ada job dibuat (validasi argumen / proyek terbukti kosong). */
            const isRefValidationFail = !genFailure.jobId && /\binvalid_reference_assets\b/i.test(`${genFailure.code} ${genFailure.message}`);
            if (
                !isInvalidArgumentsFailure(genFailure)
                && !(isRefValidationFail && hasAltRefs && !profile.useAltRef)
                && !projectConfirmedEmptyAfterTimeout
            ) {
                break;
            }
        }
    };

    await runKeyframeAttempts();

    if (discoveredDuringQueueTimeout) {
        if (discoveredDuringQueueTimeout.image) {
            const reportedModel = String(
                discoveredDuringQueueTimeout.raw?.model || genResult?.data?.model || resolvedModel || opusImageModel(env)
            );
            return {
                ...discoveredDuringQueueTimeout.image,
                model: reportedModel,
                images_sent: cappedReferenceItems.length
            };
        }
        if (discoveredDuringQueueTimeout.info?.jobId) {
            info = discoveredDuringQueueTimeout.info;
        }
    }

    /*
     * Pemulihan otomatis untuk referensi URL murni (tanpa bytes awal) bila Opus Labs
     * menolak invalid_frame_dimensions (<300px atau >6000px, 0 kredit terpakai):
     * unduh gambar URL tersebut, upscale/normalisasi di Worker ke >=512px, impor ulang
     * asetnya, lalu kirim ulang generate_keyframes satu kali.
     */
    if (
        genFailure
        && !genFailure.jobId
        && !recoveredRemoteDimensions
        && importTool
        && /\binvalid_frame_dimensions\b|between\s+300px\s+and\s+6000px/i.test(`${genFailure.code} ${genFailure.message}`)
        && cappedReferenceItems.some(item => Boolean(item.url))
    ) {
        recoveredRemoteDimensions = true;
        let anyReimported = false;
        for (let idx = 0; idx < cappedReferenceItems.length; idx += 1) {
            const item = cappedReferenceItems[idx];
            if (!item.url) continue;
            try {
                const resp = await fetch(item.url);
                if (!resp.ok) continue;
                const fetchedBytes = new Uint8Array(await resp.arrayBuffer());
                if (!fetchedBytes.byteLength) continue;
                const fetchedMime = resp.headers.get("content-type") || detectImageMime(fetchedBytes) || "image/jpeg";
                const prepared = prepareInlineReferenceVariants(fetchedBytes, fetchedMime);
                if (!prepared.dropRemoteUrl && !prepared.bytes?.byteLength) continue;
                const ext = extForOpusMime(prepared.inlineMime);
                const updatedItem = {
                    ...item,
                    bytes: prepared.bytes,
                    inlineBytes: prepared.inlineBytes,
                    mimeType: prepared.inlineMime,
                    fileName: (item.fileName || `reference-${idx + 1}.${ext}`).replace(/\.[a-z0-9]+$/i, `.${ext}`),
                    dataUri: prepared.dataUri,
                    compactDataUri: prepared.compactDataUri,
                    url: ""
                };
                cappedReferenceItems[idx] = updatedItem;
                importedAssets[idx] = await importSingleAssetViaMcp(
                    session,
                    importTool,
                    projectId,
                    updatedItem,
                    `ref-norm-${idx + 1}`
                );
                anyReimported = true;
            } catch {
                /* Lanjut cek item lain; bila tidak ada yang berhasil diimpor ulang, laporkan genFailure asli. */
            }
        }
        if (anyReimported) {
            genFailure = null;
            await runKeyframeAttempts();
        }
    }

    if (genFailure) {
        const needsSchemaHint = isInvalidArgumentsFailure(genFailure)
            || /\binvalid_reference_assets\b/i.test(`${genFailure.code} ${genFailure.message}`);
        const schemaHint = needsSchemaHint
            ? ` [schema: ${summarizeToolSchema(keyframesTool)}]`
            : "";
        const rawDiag = genResult?.data
            ? summarizePayloadForDiagnostics(genResult.data, "")
            : "";
        const diagSuffix = (rawDiag && rawDiag !== "empty" && !String(genFailure.message || "").includes("{"))
            ? ` [response: ${rawDiag}]`
            : "";
        throw opusError({
            code: genFailure.code || "generation_failed",
            message: `${genFailure.message || "Pembuatan gambar Opus Labs gagal."}${diagSuffix}${schemaHint}`,
            status: 502,
            jobId: genFailure.jobId
        });
    }

    /* Cek apakah gambar langsung dikembalikan pada respons pertama. */
    const immediateFromContent = await extractImageFromValue(genResult.content, auth.token);
    if (immediateFromContent) {
        const reportedModel = String(
            genResult.data?.model || info.target?.model || resolvedModel || opusImageModel(env)
        );
        return {
            ...immediateFromContent,
            model: reportedModel,
            images_sent: cappedReferenceItems.length
        };
    }
    if (!info.jobId || isCompletedStatus(info.status)) {
        const immediateFromData = await extractImageFromValue(genResult.data, auth.token);
        if (immediateFromData) {
            const reportedModel = String(
                genResult.data?.model || info.target?.model || resolvedModel || opusImageModel(env)
            );
            return {
                ...immediateFromData,
                model: reportedModel,
                images_sent: cappedReferenceItems.length
            };
        }
    }

    /* Fallback resmi MCP: bila generate_keyframes sukses tanpa jobId inline, cek list_jobs / get_status proyek. */
    if (!info.jobId && projectId) {
        const discovered = await discoverProjectJobOrImageViaMcp(session, tools, {
            projectId,
            bearerToken: auth.token
        });
        if (discovered.image) {
            const reportedModel = String(
                discovered.raw?.model || genResult.data?.model || resolvedModel || opusImageModel(env)
            );
            return {
                ...discovered.image,
                model: reportedModel,
                images_sent: cappedReferenceItems.length
            };
        }
        if (discovered.info?.jobId) {
            info = discovered.info;
        }
    }

    if (info.jobId) {
        const statusTool = findMcpTool(tools, "get_status");
        const listJobsTool = findMcpTool(tools, "list_jobs");
        const { image, raw } = await pollMcpJobUntilDone(session, statusTool, {
            jobId: info.jobId,
            projectId,
            bearerToken: auth.token,
            timeoutMs,
            pollIntervalMs,
            listJobsTool
        });
        const reportedModel = String(
            raw?.model || genResult.data?.model || resolvedModel || opusImageModel(env)
        );
        return {
            ...image,
            model: reportedModel,
            images_sent: cappedReferenceItems.length
        };
    }

    const diag = summarizePayloadForDiagnostics(genResult?.data, genResult?.text);
    throw opusError({
        code: "unexpected_response",
        message: `Opus Labs tidak mengembalikan gambar maupun jobId yang dapat dipantau. [response: ${diag}] [schema: ${summarizeToolSchema(keyframesTool)}]`,
        status: 502
    });
}

async function generateViaHttpApi({
    env,
    apiUrl,
    prompt,
    aspectRatio,
    resolvedModel,
    quality,
    referenceItems,
    timeoutMs,
    pollIntervalMs
}) {
    const auth = await resolveOpusBearerToken(env);
    const model = resolvedModel || opusImageModel(env);
    const ratio = aspectRatio === "16:9" ? "16:9" : "9:16";
    const resolvedQuality = quality || opusImageQuality(env);
    const pixelSize = opusPixelSizeForAspectRatio(ratio);
    const cappedRefs = referenceItems.slice(0, OPUS_MAX_REFERENCE_IMAGES);
    const inputImages = cappedRefs.map(item => ensureItemDataUri(item) || item.url).filter(Boolean);

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
            size: pixelSize,
            quality: resolvedQuality,
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
function isSocialOpusCreditExhausted(error) {
    if (!error || typeof error !== "object") return false;
    const msg = String(error.message || "");
    if (/submission_unknown|credit_reservation_pending/i.test(msg)) {
        return false;
    }
    if (Number(error.status) === 402) return true;
    const code = String(error.code || "").trim().toLowerCase();
    if (["credit_admission_rejected", "insufficient_credits", "insufficient_funds", "quotaexceederr", "quota_exceeded"].includes(code)) {
        return true;
    }
    return /credit_admission_rejected|insufficient[_\s-]*credits|not enough credits|kredit akun opusclip anda habis/i.test(msg);
}

export async function generateOpusSocialImage({
    env,
    prompt,
    referenceBytes,
    referenceMimeType,
    personImageUrl,
    garmentBytes,
    garmentMimeType,
    garmentImageUrls,
    extraReferenceImages,
    referenceImages,
    aspectRatio = OPUS_DEFAULT_ASPECT_RATIO,
    imageModel,
    quality
}) {
    const startedAt = Date.now();
    const ratio = resolveOpusAspectRatio(env, aspectRatio);
    const resolvedModel = opusImageModel(env, imageModel);
    const resolvedQuality = opusImageQuality(env, quality);
    const referenceItems = collectReferenceInputs({
        referenceBytes,
        referenceMimeType,
        personImageUrl,
        garmentBytes,
        garmentMimeType,
        garmentImageUrls,
        extraReferenceImages,
        referenceImages
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

    const runWithEnv = async targetEnv => (
        useHttpApi
            ? await generateViaHttpApi({
                env: targetEnv,
                apiUrl: customApiUrl,
                prompt,
                aspectRatio: ratio,
                resolvedModel,
                quality: resolvedQuality,
                referenceItems,
                timeoutMs,
                pollIntervalMs
            })
            : await generateViaOpusMcp({
                env: targetEnv,
                mcpUrl: customApiUrl || mcpUrl,
                prompt,
                aspectRatio: ratio,
                resolvedModel,
                quality: resolvedQuality,
                referenceItems,
                timeoutMs,
                pollIntervalMs
            })
    );

    const credentialEntries = collectOpusCredentialEntries(env);
    let outcome;

    if (credentialEntries.length <= 1) {
        activeSocialOpusKeyIndex = 0;
        const singleTargetEnv = credentialEntries.length === 1
            ? buildScopedOpusEnvForEntry(env, credentialEntries[0])
            : env;
        outcome = await runWithEnv(singleTargetEnv);
    } else {
        const totalKeys = credentialEntries.length;
        const startIndex = ((activeSocialOpusKeyIndex % totalKeys) + totalKeys) % totalKeys;
        let lastCreditErr = null;
        let succeeded = false;

        for (let step = 0; step < totalKeys; step += 1) {
            const slotIndex = (startIndex + step) % totalKeys;
            const slotEnv = buildScopedOpusEnvForEntry(env, credentialEntries[slotIndex]);
            try {
                outcome = await runWithEnv(slotEnv);
                activeSocialOpusKeyIndex = slotIndex;
                succeeded = true;
                break;
            } catch (err) {
                if (isSocialOpusCreditExhausted(err)) {
                    lastCreditErr = err;
                    if (step + 1 < totalKeys) {
                        continue;
                    }
                    activeSocialOpusKeyIndex = 0;
                    throw err;
                }
                if ((err?.status === 401 || err?.status === 403) && step + 1 < totalKeys) {
                    continue;
                }
                throw err;
            }
        }

        if (!succeeded) {
            activeSocialOpusKeyIndex = 0;
            throw lastCreditErr || new Error("Seluruh API key Opus gagal memproses permintaan gambar.");
        }
    }

    return {
        ...outcome,
        aspectRatio: ratio,
        quality: resolvedQuality,
        maxReferenceImages: OPUS_MAX_REFERENCE_IMAGES,
        elapsedMs: Date.now() - startedAt
    };
}
