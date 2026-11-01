/*
 * =========================================================
 * GEN-Z.AI
 * OPUS OAUTH — LOGIN LEWAT BROWSER (TANPA TERMUX / NODE.JS)
 * ---------------------------------------------------------
 * File: functions/_shared/opus-oauth-web.js
 * ---------------------------------------------------------
 *
 * Modul ini menjalankan alur OAuth 2.0 PKCE + Dynamic Client
 * Registration + Resource Indicators (RFC 8707) untuk MCP Opus
 * Labs sepenuhnya di Cloudflare Worker (WebCrypto + fetch),
 * sehingga admin bisa login hanya dengan membuka satu URL di
 * browser HP / tablet / PC tanpa install Node.js, tanpa Termux,
 * dan tanpa `pkg update`.
 *
 * Hilirnya sama dengan `scripts/opus-login.mjs`: menghasilkan
 * JSON token 1 baris yang siap ditempel ke Cloudflare Secret
 * OPUS_AUTH_TOKEN / OPUS_AUTH_TOKEN_2 / OPUS_AUTH_TOKEN_3.
 * =========================================================
 */

export const OPUS_MCP_URL = "https://labs.opus.pro/opus-video-tools/mcp";
export const OPUS_UNDERSTANDING_MCP_URL = "https://mcp.opus.pro/mcp";
export const OPUS_AUTH_SERVER = "https://focused-horizon-38.authkit.app";
export const OPUS_LOGIN_INTRO_PATH = "/api/opus-oauth-login";
export const OPUS_LOGIN_CALLBACK_PATH = "/api/opus-oauth-callback";

export function normalizeOpusMcpUrl(rawValue) {
    const cleaned = String(rawValue || "").trim().replace(/\/+$/, "");
    if (cleaned === OPUS_UNDERSTANDING_MCP_URL) {
        return OPUS_UNDERSTANDING_MCP_URL;
    }
    return OPUS_MCP_URL;
}

const MCP_PROTOCOL_VERSION = "2025-03-26";
const STATE_TTL_MS = 15 * 60 * 1000;
const FALLBACK_STATE_SECRET = "genzai-opus-oauth-state-v1";
const encoder = new TextEncoder();
const decoder = new TextDecoder();

/* =========================================================
   BASE64URL HELPERS
   ========================================================= */

export function bytesToBase64Url(bytes) {
    let binary = "";
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

export function base64UrlToBytes(value) {
    const normalized = String(value || "")
        .replace(/-/g, "+")
        .replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
}

export function base64UrlEncodeText(text) {
    return bytesToBase64Url(encoder.encode(String(text || "")));
}

export function base64UrlDecodeText(value) {
    return decoder.decode(base64UrlToBytes(value));
}

/* =========================================================
   PKCE
   ========================================================= */

export async function createPkcePair() {
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    const codeVerifier = bytesToBase64Url(randomBytes);
    const digest = await crypto.subtle.digest("SHA-256", encoder.encode(codeVerifier));
    return {
        codeVerifier,
        codeChallenge: bytesToBase64Url(new Uint8Array(digest))
    };
}

/* =========================================================
   DISCOVERY (RFC 9728 + RFC 8414)
   ========================================================= */

function extractWwwAuthParam(headerValue, fieldName) {
    if (!headerValue) return "";
    const pattern = new RegExp(`${fieldName}=(?:"([^"]+)"|([^\\s,]+))`, "i");
    const match = String(headerValue).match(pattern);
    return String(match?.[1] || match?.[2] || "").trim();
}

async function fetchJsonSafe(url, fetchImpl) {
    try {
        const response = await fetchImpl(url, {
            headers: { Accept: "application/json" }
        });
        if (!response?.ok) return null;
        const data = await response.json();
        return data && typeof data === "object" ? data : null;
    } catch {
        return null;
    }
}

async function probeMcpWwwAuthenticate(mcpUrl, fetchImpl) {
    try {
        const response = await fetchImpl(mcpUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json, text/event-stream",
                "MCP-Protocol-Version": MCP_PROTOCOL_VERSION
            },
            body: JSON.stringify({
                jsonrpc: "2.0",
                id: 1,
                method: "initialize",
                params: {
                    protocolVersion: MCP_PROTOCOL_VERSION,
                    capabilities: {},
                    clientInfo: { name: "genz-ai-opus-web-login", version: "1.0.0" }
                }
            })
        });
        const wwwAuth = response?.headers?.get?.("www-authenticate") || "";
        await response?.text?.().catch?.(() => "");
        return {
            resourceMetadataUrl: extractWwwAuthParam(wwwAuth, "resource_metadata"),
            scope: extractWwwAuthParam(wwwAuth, "scope")
        };
    } catch {
        return { resourceMetadataUrl: "", scope: "" };
    }
}

export async function discoverOpusOAuthEndpoints(
    mcpUrl = OPUS_MCP_URL,
    { fetchImpl = globalThis.fetch, probeServer = true } = {}
) {
    const parsed = new URL(mcpUrl);
    const origin = parsed.origin;
    const pathTrimmed = parsed.pathname.replace(/\/+$/, "");
    const parentPath = pathTrimmed.includes("/")
        ? pathTrimmed.slice(0, pathTrimmed.lastIndexOf("/"))
        : "";

    const wwwAuth = probeServer
        ? await probeMcpWwwAuthenticate(mcpUrl, fetchImpl)
        : { resourceMetadataUrl: "", scope: "" };

    const candidateResourceMetaUrls = [
        ...(wwwAuth.resourceMetadataUrl ? [wwwAuth.resourceMetadataUrl] : []),
        `${origin}/.well-known/oauth-protected-resource${pathTrimmed}`,
        ...(parentPath ? [`${origin}${parentPath}/.well-known/oauth-protected-resource`] : []),
        `${origin}${pathTrimmed}/.well-known/oauth-protected-resource`,
        ...(parentPath ? [`${origin}/.well-known/oauth-protected-resource${parentPath}`] : []),
        `${origin}/.well-known/oauth-protected-resource`
    ];

    let protectedMeta = null;
    const seen = new Set();
    for (const metaUrl of candidateResourceMetaUrls) {
        if (!metaUrl || seen.has(metaUrl)) continue;
        seen.add(metaUrl);
        protectedMeta = await fetchJsonSafe(metaUrl, fetchImpl);
        if (protectedMeta) break;
    }

    let resourceUrl = "";
    if (protectedMeta?.resource) {
        try {
            resourceUrl = new URL(String(protectedMeta.resource)).href;
        } catch {
            resourceUrl = String(protectedMeta.resource).trim();
        }
    }

    const authServerBase = String(
        (Array.isArray(protectedMeta?.authorization_servers) && protectedMeta.authorization_servers[0])
        || OPUS_AUTH_SERVER
    ).replace(/\/+$/, "");

    const authMeta =
        (await fetchJsonSafe(`${authServerBase}/.well-known/oauth-authorization-server`, fetchImpl))
        || (await fetchJsonSafe(`${authServerBase}/.well-known/openid-configuration`, fetchImpl))
        || {};

    let scope = "";
    if (wwwAuth.scope) {
        scope = wwwAuth.scope;
    } else if (Array.isArray(protectedMeta?.scopes_supported)) {
        scope = protectedMeta.scopes_supported.join(" ").trim();
    } else if (Array.isArray(authMeta?.scopes_supported)) {
        scope = authMeta.scopes_supported.join(" ").trim();
    }
    if (
        scope
        && Array.isArray(authMeta?.scopes_supported)
        && authMeta.scopes_supported.includes("offline_access")
        && !scope.split(/\s+/).includes("offline_access")
    ) {
        scope = `${scope} offline_access`;
    }

    return {
        mcpUrl,
        resource: resourceUrl,
        authServerBase,
        authorizationEndpoint: String(authMeta.authorization_endpoint || `${authServerBase}/oauth2/authorize`),
        tokenEndpoint: String(authMeta.token_endpoint || `${authServerBase}/oauth2/token`),
        registrationEndpoint: String(authMeta.registration_endpoint || `${authServerBase}/oauth2/register`),
        scope,
        authMethodsSupported: Array.isArray(authMeta?.token_endpoint_auth_methods_supported)
            ? authMeta.token_endpoint_auth_methods_supported
            : []
    };
}

/* =========================================================
   DYNAMIC CLIENT REGISTRATION
   ========================================================= */

export async function registerDynamicOAuthClient(
    registrationEndpoint,
    redirectUri,
    { scope = "", authMethodsSupported = [], fetchImpl = globalThis.fetch, clientName = "GEN-Z.AI Studio Medsos" } = {}
) {
    let tokenEndpointAuthMethod = "none";
    if (
        Array.isArray(authMethodsSupported)
        && authMethodsSupported.length > 0
        && !authMethodsSupported.includes("none")
    ) {
        if (authMethodsSupported.includes("client_secret_post")) {
            tokenEndpointAuthMethod = "client_secret_post";
        } else if (authMethodsSupported.includes("client_secret_basic")) {
            tokenEndpointAuthMethod = "client_secret_basic";
        }
    }

    const response = await fetchImpl(registrationEndpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json"
        },
        body: JSON.stringify({
            client_name: clientName,
            application_type: "native",
            redirect_uris: [redirectUri],
            grant_types: ["authorization_code", "refresh_token"],
            response_types: ["code"],
            token_endpoint_auth_method: tokenEndpointAuthMethod,
            ...(scope ? { scope } : {})
        })
    });

    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.client_id) {
        const detail = data?.error_description || data?.error || data?.message || `HTTP ${response.status}`;
        throw new Error(`Gagal mendaftarkan OAuth client ke Opus: ${detail}`);
    }

    return {
        clientId: String(data.client_id),
        clientSecret: data.client_secret ? String(data.client_secret) : "",
        scope: data.scope ? String(data.scope) : scope
    };
}

/* =========================================================
   TOKEN EXCHANGE & VERIFIKASI
   ========================================================= */

export async function exchangeCodeForOpusTokens({
    tokenEndpoint,
    code,
    redirectUri,
    clientId,
    clientSecret = "",
    codeVerifier,
    resource = "",
    scope = "",
    fetchImpl = globalThis.fetch
}) {
    const body = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier
    });
    if (clientSecret) body.set("client_secret", clientSecret);
    if (resource) body.set("resource", resource);

    const response = await fetchImpl(tokenEndpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json"
        },
        body: body.toString()
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.access_token) {
        const detail = payload?.error_description || payload?.error || payload?.message || `HTTP ${response.status}`;
        throw new Error(`Gagal menukar kode OAuth Opus menjadi token: ${detail}`);
    }

    const expiresInSec = Number(payload.expires_in) || 3600;
    const expiresAtSec = Math.floor(Date.now() / 1000) + expiresInSec;
    const grantedScope = String(payload.scope || scope || "").trim();

    return {
        access_token: String(payload.access_token),
        ...(payload.id_token ? { _id_token: String(payload.id_token) } : {}),
        ...(payload.refresh_token ? { refresh_token: String(payload.refresh_token) } : {}),
        client_id: clientId,
        ...(clientSecret ? { client_secret: clientSecret } : {}),
        ...(resource ? { resource } : {}),
        ...(grantedScope ? { scope: grantedScope } : {}),
        expires_at: expiresAtSec,
        token_endpoint: tokenEndpoint
    };
}

export async function verifyOpusMcpToken(mcpUrl, bearerToken, { fetchImpl = globalThis.fetch } = {}) {
    try {
        const response = await fetchImpl(mcpUrl, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${bearerToken}`,
                "Content-Type": "application/json",
                Accept: "application/json, text/event-stream",
                "MCP-Protocol-Version": MCP_PROTOCOL_VERSION
            },
            body: JSON.stringify({
                jsonrpc: "2.0",
                id: 1,
                method: "initialize",
                params: {
                    protocolVersion: MCP_PROTOCOL_VERSION,
                    capabilities: {},
                    clientInfo: { name: "genz-ai-opus-web-login", version: "1.0.0" }
                }
            })
        });
        const wwwAuth = response?.headers?.get?.("www-authenticate") || "";
        const bodyText = await response?.text?.().catch?.(() => "");
        if (!response.ok) {
            const code = extractWwwAuthParam(wwwAuth, "error");
            const description = extractWwwAuthParam(wwwAuth, "error_description");
            return {
                ok: false,
                status: response.status,
                detail: [code, description, String(bodyText || "").slice(0, 200)]
                    .filter(Boolean)
                    .join(" — ") || `HTTP ${response.status}`
            };
        }
        return { ok: true, status: response.status, detail: "" };
    } catch (error) {
        return { ok: false, status: 0, detail: error?.message || "Gagal menghubungi server MCP Opus." };
    }
}

/* =========================================================
   STATE TOKEN (berisi PKCE verifier + client id, ditandatangani)
   ========================================================= */

function resolveStateSecret(env) {
    const candidates = [
        env?.OPUS_LOGIN_STATE_SECRET,
        env?.PROVIDER_CREDENTIAL_ENCRYPTION_KEY,
        env?.PROVIDER_CREDENTIAL_KEY,
        env?.SUPABASE_SERVICE_ROLE_KEY
    ];
    for (const candidate of candidates) {
        const value = String(candidate || "").trim();
        if (value) return value;
    }
    return FALLBACK_STATE_SECRET;
}

async function getStateHmacKey(env) {
    return await crypto.subtle.importKey(
        "raw",
        encoder.encode(`genz-opus-oauth-state:${resolveStateSecret(env)}`),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign", "verify"]
    );
}

export async function encodeOAuthState(payload, { env = null, now = Date.now() } = {}) {
    const body = base64UrlEncodeText(JSON.stringify({ ...payload, t: Number(now) }));
    const key = await getStateHmacKey(env);
    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
    return `${body}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

export async function decodeOAuthState(token, { env = null, now = Date.now() } = {}) {
    const raw = String(token || "").trim();
    const separator = raw.lastIndexOf(".");
    if (separator <= 0) return null;

    const body = raw.slice(0, separator);
    const signature = raw.slice(separator + 1);
    if (!body || !signature) return null;

    try {
        const key = await getStateHmacKey(env);
        const valid = await crypto.subtle.verify(
            "HMAC",
            key,
            base64UrlToBytes(signature),
            encoder.encode(body)
        );
        if (!valid) return null;
        const payload = JSON.parse(base64UrlDecodeText(body));
        if (!payload || typeof payload !== "object") return null;
        const issuedAt = Number(payload.t) || 0;
        if (!issuedAt || Math.abs(Number(now) - issuedAt) > STATE_TTL_MS) return null;
        if (!payload.c || !payload.v) return null;
        return payload;
    } catch {
        return null;
    }
}

/* =========================================================
   SLOT SECRET & ORIGIN
   ========================================================= */

export function normalizeOpusSlot(value) {
    const slot = Number(value) || 1;
    if (slot < 1) return 1;
    if (slot > 9) return 9;
    return Math.floor(slot);
}

export function opusSecretNameForSlot(slot) {
    const normalized = normalizeOpusSlot(slot);
    return normalized <= 1 ? "OPUS_AUTH_TOKEN" : `OPUS_AUTH_TOKEN_${normalized}`;
}

export function resolvePublicOrigin(req) {
    const headers = req?.headers || {};
    const host =
        String(headers["x-forwarded-host"] || headers.host || "").split(",")[0].trim();
    if (!host) return "https://genzai.genzai-f37.workers.dev";
    const forwardedProto = String(headers["x-forwarded-proto"] || "").split(",")[0].trim();
    let proto = forwardedProto || "";
    if (!proto) {
        try {
            const visitor = JSON.parse(String(headers["cf-visitor"] || "{}"));
            proto = String(visitor?.scheme || "");
        } catch {
            proto = "";
        }
    }
    if (!proto) proto = "https";
    return `${proto}://${host}`;
}

/* =========================================================
   HTML
   ========================================================= */

function escapeHtml(text) {
    return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

const BASE_STYLE = (
    "body{background:#000000;color:#e8f0fe;font-family:system-ui,-apple-system,sans-serif;display:grid;place-items:center;min-height:92vh;margin:0;padding:16px;box-sizing:border-box}"
    + ".box{border:1px solid #26354d;border-radius:18px;padding:24px 20px;max-width:520px;width:100%;background:#0b1320;box-sizing:border-box}"
    + "h1{color:#39ff71;font-size:20px;margin:0 0 8px;text-align:center}"
    + "h1.err{color:#ff5575}"
    + "p{color:#a8b8d0;font-size:14px;line-height:1.55;margin:0 0 14px;text-align:center}"
    + ".btn{display:block;width:100%;border:none;border-radius:12px;padding:15px 16px;font-size:16px;font-weight:700;cursor:pointer;background:#39ff71;color:#021407;margin:0 0 12px;box-sizing:border-box;text-align:center;text-decoration:none}"
    + ".btn:active{transform:scale(0.99)}"
    + ".linkbtn{display:block;width:100%;text-align:center;text-decoration:none;border:1px solid #2f466b;border-radius:12px;padding:12px 16px;font-size:14px;font-weight:600;color:#9ec5ff;background:#101c30;margin:10px 0 0;box-sizing:border-box}"
    + "textarea{width:100%;height:110px;background:#050911;color:#cfe2ff;border:1px solid #26354d;border-radius:10px;padding:10px;font-family:ui-monospace,monospace;font-size:12px;box-sizing:border-box;word-break:break-all}"
    + ".steps{margin-top:14px;padding-top:12px;border-top:1px solid #1d2b40;color:#9fb0ca;font-size:13px;line-height:1.55}"
    + ".badge{display:inline-block;padding:4px 10px;border-radius:999px;background:#10243a;color:#7fd3ff;font-size:12px;font-weight:700;margin:0 auto 12px;text-align:center}"
);

function htmlShell({ title, body }) {
    return (
        "<!doctype html><html lang='id'><head><meta charset='utf-8'>"
        + "<meta name='viewport' content='width=device-width,initial-scale=1'>"
        + `<title>${escapeHtml(title)}</title>`
        + `<style>${BASE_STYLE}</style></head><body><div class='box'>${body}</div></body></html>`
    );
}

export function buildLoginIntroHtml({ slot = 1, origin = "", mcpUrl = OPUS_MCP_URL } = {}) {
    const normalized = normalizeOpusSlot(slot);
    const resolvedMcp = normalizeOpusMcpUrl(mcpUrl);
    const isUnderstandingMcp = resolvedMcp === OPUS_UNDERSTANDING_MCP_URL;
    const secretName = opusSecretNameForSlot(normalized);
    const startUrl = isUnderstandingMcp
        ? `${origin}${OPUS_LOGIN_INTRO_PATH}?start=1&slot=${normalized}&mcp=${encodeURIComponent(OPUS_UNDERSTANDING_MCP_URL)}`
        : `${origin}${OPUS_LOGIN_INTRO_PATH}?start=1&slot=${normalized}`;

    if (isUnderstandingMcp) {
        return htmlShell({
            title: "Login OpusClip MCP (MODUL 03) — GEN-Z.AI",
            body:
                "<h1>Login Video Understanding MCP</h1>"
                + "<span class='badge'>MODUL 03 &middot; mcp.opus.pro</span>"
                + "<p>Halaman ini menghubungkan akun OpusClip Anda ke <b>mcp.opus.pro</b> langsung dari browser HP — <b>tanpa perlu buka Cloudflare Dashboard</b>.</p>"
                + `<a class='btn' href='${escapeHtml(startUrl)}'>LANJUT LOGIN KE OPUSCLIP</a>`
                + "<div class='steps'>"
                + "1. Ketuk tombol hijau di atas, login ke akun OpusClip, lalu ketuk <b>Allow</b>.<br>"
                + "2. Ketuk <b>SALIN TOKEN JSON KE CLIPBOARD</b>.<br>"
                + "3. Kembali ke <b>BLACK BOX &rarr; MODUL 03</b>, tempel di kotak nomor 2, lalu ketuk <b>Simpan Token OAuth ke Vault</b> (tersimpan terenkripsi di server database, bukan di browser)."
                + "</div>"
        });
    }

    return htmlShell({
        title: "Login Opus — GEN-Z.AI",
        body:
            "<h1>Login Opus Labs</h1>"
            + `<span class='badge'>Slot: ${escapeHtml(secretName)}</span>`
            + "<p>Halaman ini menghubungkan akun OpusClip / Opus Labs Anda <b>langsung dari browser HP</b>. Tidak perlu Termux, tidak perlu Node.js, tidak perlu install apa pun.</p>"
            + `<a class='btn' href='${escapeHtml(startUrl)}'>LANJUT LOGIN KE OPUS</a>`
            + "<div class='steps'>"
            + "Setelah menekan tombol di atas: login ke Opus, ketuk <b>Allow</b>, lalu halaman hasil akan menampilkan token JSON yang bisa disalin 1 ketukan.<br><br>"
            + "Untuk akun ke-2 / ke-3, ganti angka pada URL: <b>?slot=2</b> atau <b>?slot=3</b> (secret <b>OPUS_AUTH_TOKEN_2</b> / <b>OPUS_AUTH_TOKEN_3</b>)."
            + "</div>"
    });
}

export function buildOpusLoginSuccessHtml({ compactJson = "", slot = 1, status = 0, mcpUrl = OPUS_MCP_URL } = {}) {
    const resolvedMcp = normalizeOpusMcpUrl(mcpUrl);
    const isUnderstandingMcp = resolvedMcp === OPUS_UNDERSTANDING_MCP_URL;
    const secretName = opusSecretNameForSlot(slot);

    if (isUnderstandingMcp) {
        return htmlShell({
            title: "OpusClip MCP Terhubung — GEN-Z.AI",
            body:
                "<h1>Login mcp.opus.pro Berhasil!</h1>"
                + "<span class='badge'>Tempel ke: BLACK BOX &rarr; MODUL 03</span>"
                + `<p>Token OAuth sudah <b>diverifikasi${status ? ` (HTTP ${status} OK)` : ""}</b> di <b>mcp.opus.pro</b>. Ketuk tombol hijau untuk menyalin JSON token:</p>`
                + "<button id='copyBtn' type='button' class='btn'>SALIN TOKEN JSON KE CLIPBOARD</button>"
                + `<textarea id='tokenBox' readonly onclick='this.select()'>${escapeHtml(compactJson)}</textarea>`
                + "<a class='linkbtn' href='/black-box/'>&larr; Kembali ke BLACK BOX (MODUL 03)</a>"
                + "<div class='steps'>"
                + "<b>Langkah simpan permanen (tanpa Cloudflare):</b><br>"
                + "1. Buka <b>BLACK BOX &rarr; MODUL 03</b>.<br>"
                + "2. Tempel (Paste) di kolom <b>2. Video Understanding MCP (mcp.opus.pro)</b>.<br>"
                + "3. Ketuk <b>Simpan Token OAuth ke Vault</b>. Token dienkripsi AES-256-GCM di server Supabase Vault &amp; auto-refresh otomatis."
                + "</div>"
                + "<script>"
                + "const btn=document.getElementById('copyBtn');const box=document.getElementById('tokenBox');"
                + "btn.addEventListener('click',async()=>{"
                + "let ok=false;"
                + "if(navigator.clipboard&&navigator.clipboard.writeText){try{await navigator.clipboard.writeText(box.value);ok=true;}catch(e){}}"
                + "if(!ok){box.focus();box.select();try{ok=document.execCommand('copy');}catch(e){}}"
                + "btn.textContent=ok?'TERSALIN! Sekarang tempel di BLACK BOX MODUL 03':'Silakan tahan & Salin teks di kotak bawah';"
                + "});"
                + "</script>"
        });
    }

    return htmlShell({
        title: "Opus Terhubung — GEN-Z.AI",
        body:
            "<h1>Login Opus Labs Berhasil!</h1>"
            + `<span class='badge'>Tempel ke: ${escapeHtml(secretName)}</span>`
            + `<p>Token OAuth sudah <b>diverifikasi${status ? ` (HTTP ${status} OK)` : ""}</b>. Ketuk tombol hijau untuk menyalin JSON token ke clipboard:</p>`
            + "<button id='copyBtn' type='button' class='btn'>SALIN TOKEN JSON KE CLIPBOARD</button>"
            + `<textarea id='tokenBox' readonly onclick='this.select()'>${escapeHtml(compactJson)}</textarea>`
            + "<a class='linkbtn' href='https://dash.cloudflare.com/' target='_blank' rel='noopener'>Buka Cloudflare Dashboard &rarr;</a>"
            + "<div class='steps'>"
            + "<b>Langkah tempel di Cloudflare:</b><br>"
            + "1. Buka <b>Workers &amp; Pages &rarr; genzai &rarr; Settings &rarr; Variables and Secrets</b>.<br>"
            + `2. Tempel (Paste) ke <b>${escapeHtml(secretName)}</b>.<br>`
            + "3. Klik <b>Save / Deploy</b>. Selesai — refresh token tersimpan permanen otomatis."
            + "</div>"
            + "<script>"
            + "const btn=document.getElementById('copyBtn');const box=document.getElementById('tokenBox');"
            + "btn.addEventListener('click',async()=>{"
            + "let ok=false;"
            + "if(navigator.clipboard&&navigator.clipboard.writeText){try{await navigator.clipboard.writeText(box.value);ok=true;}catch(e){}}"
            + "if(!ok){box.focus();box.select();try{ok=document.execCommand('copy');}catch(e){}}"
            + "btn.textContent=ok?'TERSALIN KE CLIPBOARD! Tinggal Paste di Cloudflare':'Silakan tahan & Salin teks di kotak bawah';"
            + "});"
            + "</script>"
    });
}

export function buildOpusLoginErrorHtml({ message = "", slot = 1, origin = "", mcpUrl = OPUS_MCP_URL } = {}) {
    const resolvedMcp = normalizeOpusMcpUrl(mcpUrl);
    const retryUrl = resolvedMcp === OPUS_UNDERSTANDING_MCP_URL
        ? `${origin}${OPUS_LOGIN_INTRO_PATH}?slot=${normalizeOpusSlot(slot)}&mcp=${encodeURIComponent(OPUS_UNDERSTANDING_MCP_URL)}`
        : `${origin}${OPUS_LOGIN_INTRO_PATH}?slot=${normalizeOpusSlot(slot)}`;
    return htmlShell({
        title: "Login Opus Gagal — GEN-Z.AI",
        body:
            "<h1 class='err'>Login Opus Belum Berhasil</h1>"
            + `<p>${escapeHtml(message || "Terjadi kesalahan saat memproses OAuth Opus.")}</p>`
            + `<a class='linkbtn' href='${escapeHtml(retryUrl)}'>COBA LAGI</a>`
    });
}
