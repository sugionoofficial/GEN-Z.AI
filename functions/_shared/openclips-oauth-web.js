/* OpenClips OAuth browser flow. Generic PKCE/discovery primitives are shared
 * with the existing Opus module; state secrets, routes, token bundles and the
 * rotating-token vault are deliberately provider-specific. */

import {
    bytesToBase64Url,
    createPkcePair,
    decodeOAuthState,
    discoverOpusOAuthEndpoints,
    encodeOAuthState,
    exchangeCodeForOpusTokens,
    registerDynamicOAuthClient,
    resolvePublicOrigin,
    verifyOpusMcpToken
} from "./opus-oauth-web.js";

export const OPENCLIPS_MCP_URL = "https://mcp.openclips.ai";
export const OPENCLIPS_LOGIN_INTRO_PATH = "/api/openclips-oauth-login";
export const OPENCLIPS_LOGIN_CALLBACK_PATH = "/api/openclips-oauth-callback";

export { createPkcePair, resolvePublicOrigin };

export function normalizeOpenClipsMcpUrl(value) {
    const raw = String(value || "").trim() || OPENCLIPS_MCP_URL;
    try {
        const parsed = new URL(raw);
        if (parsed.protocol !== "https:" || parsed.hostname !== "mcp.openclips.ai") return OPENCLIPS_MCP_URL;
        const path = parsed.pathname.replace(/\/+$/, "");
        return `${parsed.origin}${path === "/mcp" ? "/mcp" : ""}`;
    } catch {
        return OPENCLIPS_MCP_URL;
    }
}

export async function discoverOpenClipsOAuthEndpoints(mcpUrl = OPENCLIPS_MCP_URL, options = {}) {
    const normalized = normalizeOpenClipsMcpUrl(mcpUrl);
    const endpoints = await discoverOpusOAuthEndpoints(normalized, options);
    /* Never fall back to the unrelated Opus AuthKit server if OpenClips
       discovery is unavailable. OpenClips metadata currently advertises all
       endpoints on mcp.openclips.ai. */
    if (/focused-horizon-38\.authkit\.app/i.test(endpoints.authServerBase || endpoints.tokenEndpoint || "")) {
        throw new Error("Discovery OAuth OpenClips gagal; metadata authorization server tidak dapat dibaca.");
    }
    return {
        ...endpoints,
        resource: String(endpoints.resource || "").replace(/\/+$/, "")
    };
}

export async function registerOpenClipsOAuthClient(registrationEndpoint, redirectUri, options = {}) {
    try {
        return await registerDynamicOAuthClient(registrationEndpoint, redirectUri, {
            ...options,
            clientName: "GEN-Z.AI OpenClips Provider"
        });
    } catch (error) {
        throw new Error(String(error?.message || "Registrasi OAuth client gagal.").replace(/Opus/g, "OpenClips"));
    }
}

export async function exchangeCodeForOpenClipsTokens(options) {
    try {
        return await exchangeCodeForOpusTokens(options);
    } catch (error) {
        throw new Error(String(error?.message || "Penukaran kode OAuth gagal.").replace(/Opus/g, "OpenClips"));
    }
}

export async function verifyOpenClipsMcpToken(mcpUrl, accessToken, options = {}) {
    const result = await verifyOpusMcpToken(normalizeOpenClipsMcpUrl(mcpUrl), accessToken, options);
    if (!result.ok && result.detail) {
        return { ...result, detail: String(result.detail).replace(/Opus/g, "OpenClips") };
    }
    return result;
}

function stateEnv(env) {
    return {
        OPUS_LOGIN_STATE_SECRET: String(
            env?.OPENCLIPS_LOGIN_STATE_SECRET ||
            env?.PROVIDER_CREDENTIAL_ENCRYPTION_KEY ||
            env?.PROVIDER_CREDENTIAL_KEY ||
            env?.SUPABASE_SERVICE_ROLE_KEY ||
            "genzai-openclips-oauth-state-v1"
        )
    };
}

export async function encodeOpenClipsOAuthState(payload, options = {}) {
    return await encodeOAuthState(
        { ...payload, p: "openclips" },
        { ...options, env: stateEnv(options.env) }
    );
}

export async function decodeOpenClipsOAuthState(token, options = {}) {
    const state = await decodeOAuthState(token, { ...options, env: stateEnv(options.env) });
    if (!state || state.p !== "openclips") return null;
    return state;
}

export function normalizeOpenClipsSlot(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 1;
    return Math.min(Number.MAX_SAFE_INTEGER, Math.max(1, Math.floor(number)));
}

export function openClipsSecretNameForSlot(slot) {
    const normalized = normalizeOpenClipsSlot(slot);
    return normalized === 1 ? "OPENCLIPS_AUTH_TOKEN" : `OPENCLIPS_AUTH_TOKEN_${normalized}`;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

const STYLE = `
:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:20px;background:#05070b;color:#edf4ff;font:15px/1.55 system-ui,-apple-system,sans-serif}.box{width:min(560px,100%);padding:28px;border:1px solid #25334a;border-radius:20px;background:#0c1320;box-shadow:0 24px 70px #0008}h1{margin:0 0 12px;font-size:24px;color:#71f6b1}h1.error{color:#ff8095}p{color:#aebdd2}.badge{display:inline-block;margin-bottom:14px;padding:5px 10px;border-radius:999px;background:#102a3a;color:#8fdcff;font:600 12px ui-monospace,monospace}.btn{display:block;width:100%;padding:14px 16px;border:0;border-radius:12px;background:#71f6b1;color:#032113;font-weight:800;text-align:center;text-decoration:none;cursor:pointer}.secondary{display:block;margin-top:12px;padding:11px;border:1px solid #334765;border-radius:12px;color:#b9d9ff;text-align:center;text-decoration:none}textarea{width:100%;min-height:150px;margin-top:14px;padding:12px;border:1px solid #334765;border-radius:12px;background:#050911;color:#d8e8ff;font:12px/1.5 ui-monospace,monospace;word-break:break-all}.steps{margin-top:18px;padding-top:16px;border-top:1px solid #223047;color:#aebdd2;font-size:13px}.muted{font-size:12px;color:#8293aa;overflow-wrap:anywhere}`;

function shell(title, body) {
    return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${escapeHtml(title)}</title><style>${STYLE}</style></head><body><main class="box">${body}</main></body></html>`;
}

export function buildOpenClipsLoginIntroHtml({ slot = 1, origin = "", mcpUrl = OPENCLIPS_MCP_URL } = {}) {
    const selected = normalizeOpenClipsSlot(slot);
    const secretName = openClipsSecretNameForSlot(selected);
    const start = `${origin}${OPENCLIPS_LOGIN_INTRO_PATH}?start=1&slot=${selected}`;
    return shell("Login OpenClips — GEN-Z.AI",
        "<h1>Hubungkan OpenClips</h1>"
        + `<span class="badge">${escapeHtml(secretName)}</span>`
        + "<p>Login memakai OAuth resmi OpenClips dengan PKCE. Hasilnya berupa JSON access token + refresh token yang dapat ditempel sebagai credential provider.</p>"
        + `<a class="btn" href="${escapeHtml(start)}">LANJUT LOGIN KE OPENCLIPS</a>`
        + `<p class="muted">MCP: ${escapeHtml(normalizeOpenClipsMcpUrl(mcpUrl))}</p>`
        + "<div class='steps'>Setelah memilih Allow, salin JSON lalu buka <b>Admin → Providers → OpenClips</b> dan tempel di field API Key/credential. JSON disimpan terenkripsi. Refresh token selanjutnya diputar dan disimpan di vault OpenClips yang terpisah dari Opus.<br><br>Alternatif: field yang sama juga menerima Bearer token/API key mentah atau pool token.</div>"
        + "<a class='secondary' href='/admin-control/providers.html'>Buka Admin Providers</a>"
    );
}

export function buildOpenClipsLoginSuccessHtml({ compactJson = "", slot = 1, status = 0, mcpUrl = OPENCLIPS_MCP_URL } = {}) {
    const secretName = openClipsSecretNameForSlot(slot);
    return shell("OpenClips Terhubung — GEN-Z.AI",
        "<h1>OpenClips berhasil terhubung</h1>"
        + `<span class="badge">${escapeHtml(secretName)} · MCP HTTP ${Number(status) || 200}</span>`
        + "<p>Salin seluruh JSON di bawah, lalu tempel sebagai credential OpenClips di Admin Providers atau secret Worker yang ditandai di atas.</p>"
        + "<button id='copyBtn' class='btn' type='button'>SALIN TOKEN JSON</button>"
        + `<textarea id='tokenBox' readonly onclick='this.select()'>${escapeHtml(compactJson)}</textarea>`
        + "<a class='secondary' href='/admin-control/providers.html'>Buka Admin Providers</a>"
        + `<div class='steps'>Endpoint: ${escapeHtml(normalizeOpenClipsMcpUrl(mcpUrl))}<br>Jangan membagikan JSON ini. Di dalamnya ada access token dan refresh token.</div>`
        + "<script>const b=document.getElementById('copyBtn'),t=document.getElementById('tokenBox');b.addEventListener('click',async()=>{let ok=false;if(navigator.clipboard&&navigator.clipboard.writeText){try{await navigator.clipboard.writeText(t.value);ok=true}catch(e){}}if(!ok){t.focus();t.select();try{ok=document.execCommand('copy')}catch(e){}}b.textContent=ok?'TOKEN TERSALIN':'Pilih lalu salin teks secara manual';});</script>"
    );
}

export function buildOpenClipsLoginErrorHtml({ message = "", slot = 1, origin = "" } = {}) {
    const retry = `${origin}${OPENCLIPS_LOGIN_INTRO_PATH}?slot=${normalizeOpenClipsSlot(slot)}`;
    return shell("Login OpenClips Gagal — GEN-Z.AI",
        "<h1 class='error'>Login OpenClips belum berhasil</h1>"
        + `<p>${escapeHtml(message || "Terjadi kesalahan OAuth.")}</p>`
        + `<a class='secondary' href='${escapeHtml(retry)}'>COBA LAGI</a>`
    );
}

/* Re-exported for small unit tests that need deterministic base64url helpers. */
export { bytesToBase64Url };
