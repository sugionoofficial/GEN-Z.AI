#!/usr/bin/env node
/* =========================================================
   GEN-Z.AI — Pembantu Login OAuth Opus Labs (PC & HP Termux)
   ---------------------------------------------------------
   Menjalankan alur OAuth 2.0 PKCE + Dynamic Client Registration
   + RFC 8707 Resource Indicators (sesuai standar MCP OAuth SDK)
   langsung ke server resmi Opus Labs MCP:
     https://labs.opus.pro/opus-video-tools/mcp

   Mendukung penuh:
   - PC (Windows PowerShell / macOS / Linux Desktop)
   - HP Android lewat Termux (tanpa perlu git clone / npm install!):
     * Auto-open Chrome Android lewat `termux-open-url` / `am start`
     * Bebas crash ENOENT meskipun `xdg-open` / `termux-api` belum ada
     * Halaman callback di Chrome HP langsung menukar token & menampilkan
       tombol besar [ SALIN TOKEN JSON ] 1-ketuk ke clipboard HP
     * Fallback paste URL callback manual di terminal bila diperlukan

   Pemakaian di PC:
     npm run opus:login

   Pemakaian cepat di Termux HP Android:
     pkg install -y nodejs-lts
     curl -fsSL https://raw.githubusercontent.com/sugionoofficial/GEN-Z.AI/main/scripts/opus-login.mjs -o opus-login.mjs
     node opus-login.mjs
   ========================================================= */

import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

export const DEFAULT_OPUS_MCP_URL = "https://labs.opus.pro/opus-video-tools/mcp";
export const DEFAULT_OPUS_AUTH_SERVER = "https://focused-horizon-38.authkit.app";
export const DEFAULT_OUTPUT_FILE = ".opus-auth-token.json";
const MCP_PROTOCOL_VERSION = "2025-03-26";

export function isTermuxEnvironment(env = process.env, platform = process.platform) {
    if (platform === "android") return true;
    const prefix = String(env?.PREFIX || "");
    return Boolean(env?.TERMUX_VERSION || prefix.includes("com.termux"));
}

function escapeHtml(text) {
    return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function base64UrlEncode(buffer) {
    return Buffer.from(buffer)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
}

export function createPkcePair() {
    const codeVerifier = base64UrlEncode(crypto.randomBytes(32));
    const challengeDigest = crypto.createHash("sha256").update(codeVerifier).digest();
    const codeChallenge = base64UrlEncode(challengeDigest);
    return { codeVerifier, codeChallenge };
}

export function extractWwwAuthParam(headerValue, fieldName) {
    if (!headerValue) return "";
    const pattern = new RegExp(`${fieldName}=(?:"([^"]+)"|([^\\s,]+))`, "i");
    const match = String(headerValue).match(pattern);
    return (match?.[1] || match?.[2] || "").trim();
}

/**
 * Mengekstrak authorization `code` dari URL callback penuh (`http://127.0.0.1:xxxx/callback?code=...&state=...`)
 * maupun query string mentah apabila pengguna di HP menempelkan URL secara manual di Termux.
 */
export function extractOAuthCallbackCode(rawInput, expectedState = "") {
    const trimmed = String(rawInput || "").trim();
    if (!trimmed) return null;

    let params = null;
    if (/^https?:\/\//i.test(trimmed)) {
        try {
            params = new URL(trimmed).searchParams;
        } catch {
            params = null;
        }
    } else if (trimmed.includes("code=")) {
        const qIndex = trimmed.indexOf("?");
        const queryPart = qIndex >= 0 ? trimmed.slice(qIndex + 1) : trimmed;
        params = new URLSearchParams(queryPart);
    }

    if (!params) {
        return null;
    }

    const oauthError = params.get("error");
    if (oauthError) {
        const desc = params.get("error_description") || "";
        throw new Error(`Otorisasi Opus ditolak (${oauthError})${desc ? `: ${desc}` : ""}`);
    }

    const code = String(params.get("code") || "").trim();
    const state = String(params.get("state") || "").trim();
    if (!code) return null;
    if (expectedState && state && state !== expectedState) {
        throw new Error("Parameter state OAuth tidak cocok dengan sesi login saat ini. Jalankan ulang script.");
    }
    return code;
}

async function probeMcpWwwAuthenticate(mcpUrl) {
    try {
        const res = await fetch(mcpUrl, {
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
                    clientInfo: { name: "genz-ai-opus-discovery", version: "1.0.0" }
                }
            })
        });
        const wwwAuth = res.headers.get("www-authenticate") || res.headers.get("WWW-Authenticate") || "";
        await res.text().catch(() => "");
        return {
            resourceMetadataUrl: extractWwwAuthParam(wwwAuth, "resource_metadata"),
            scope: extractWwwAuthParam(wwwAuth, "scope")
        };
    } catch {
        return { resourceMetadataUrl: "", scope: "" };
    }
}

async function fetchJsonSafe(url, options = {}) {
    try {
        const res = await fetch(url, {
            ...options,
            headers: {
                Accept: "application/json",
                "MCP-Protocol-Version": MCP_PROTOCOL_VERSION,
                ...(options.headers || {})
            }
        });
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

export async function discoverOpusOAuthEndpoints(mcpUrl = DEFAULT_OPUS_MCP_URL, { probeServer = true } = {}) {
    const parsed = new URL(mcpUrl);
    const origin = parsed.origin;
    const pathTrimmed = parsed.pathname.replace(/\/+$/, "");
    const parentPath = pathTrimmed.includes("/")
        ? pathTrimmed.slice(0, pathTrimmed.lastIndexOf("/"))
        : "";

    const wwwAuth = probeServer
        ? await probeMcpWwwAuthenticate(mcpUrl)
        : { resourceMetadataUrl: "", scope: "" };

    const candidateResourceMetaUrls = [
        ...(wwwAuth.resourceMetadataUrl ? [wwwAuth.resourceMetadataUrl] : []),
        `${origin}/.well-known/oauth-protected-resource${pathTrimmed}`,
        ...(parentPath ? [`${origin}${parentPath}/.well-known/oauth-protected-resource`] : []),
        `${origin}${pathTrimmed}/.well-known/oauth-protected-resource`,
        ...(parentPath ? [`${origin}/.well-known/oauth-protected-resource${parentPath}`] : []),
        `${origin}/.well-known/oauth-protected-resource`
    ];

    const seenUrls = new Set();
    let protectedMeta = null;
    for (const metaUrl of candidateResourceMetaUrls) {
        if (!metaUrl || seenUrls.has(metaUrl)) continue;
        seenUrls.add(metaUrl);
        protectedMeta = await fetchJsonSafe(metaUrl);
        if (protectedMeta && typeof protectedMeta === "object") break;
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
        || DEFAULT_OPUS_AUTH_SERVER
    ).replace(/\/+$/, "");

    const authMeta = await fetchJsonSafe(`${authServerBase}/.well-known/oauth-authorization-server`)
        || await fetchJsonSafe(`${authServerBase}/.well-known/openid-configuration`)
        || {};

    /* Penentuan scope mengikuti urutan resmi MCP SDK (WWW-Authenticate ->
       Protected Resource Metadata -> Auth Server Metadata + offline_access). */
    let effectiveScope = "";
    if (wwwAuth.scope) {
        effectiveScope = wwwAuth.scope;
    } else if (Array.isArray(protectedMeta?.scopes_supported)) {
        effectiveScope = protectedMeta.scopes_supported.join(" ").trim();
    } else if (Array.isArray(authMeta?.scopes_supported)) {
        effectiveScope = authMeta.scopes_supported.join(" ").trim();
    }
    if (
        effectiveScope
        && Array.isArray(authMeta?.scopes_supported)
        && authMeta.scopes_supported.includes("offline_access")
        && !effectiveScope.split(/\s+/).includes("offline_access")
    ) {
        effectiveScope = `${effectiveScope} offline_access`;
    }

    const scopesList = effectiveScope ? effectiveScope.split(/\s+/).filter(Boolean) : [];
    const authMethodsSupported = Array.isArray(authMeta?.token_endpoint_auth_methods_supported)
        ? authMeta.token_endpoint_auth_methods_supported
        : [];

    return {
        mcpUrl,
        resource: resourceUrl,
        authServerBase,
        authorizationEndpoint: String(authMeta.authorization_endpoint || `${authServerBase}/oauth2/authorize`),
        tokenEndpoint: String(authMeta.token_endpoint || `${authServerBase}/oauth2/token`),
        registrationEndpoint: String(authMeta.registration_endpoint || `${authServerBase}/oauth2/register`),
        scope: effectiveScope,
        scopes: scopesList,
        authMethodsSupported
    };
}

export async function registerDynamicOAuthClient(
    registrationEndpoint,
    redirectUri,
    { scope = "", authMethodsSupported = [] } = {}
) {
    let tokenEndpointAuthMethod = "none";
    if (Array.isArray(authMethodsSupported) && authMethodsSupported.length > 0 && !authMethodsSupported.includes("none")) {
        if (authMethodsSupported.includes("client_secret_post")) {
            tokenEndpointAuthMethod = "client_secret_post";
        } else if (authMethodsSupported.includes("client_secret_basic")) {
            tokenEndpointAuthMethod = "client_secret_basic";
        }
    }

    const res = await fetch(registrationEndpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json"
        },
        body: JSON.stringify({
            client_name: "GEN-Z.AI Studio Medsos",
            application_type: "native",
            redirect_uris: [redirectUri],
            grant_types: ["authorization_code", "refresh_token"],
            response_types: ["code"],
            token_endpoint_auth_method: tokenEndpointAuthMethod,
            ...(scope ? { scope } : {})
        })
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.client_id) {
        const detail = data?.error_description || data?.error || data?.message || `HTTP ${res.status}`;
        throw new Error(`Gagal mendaftarkan OAuth client ke Opus (${registrationEndpoint}): ${detail}`);
    }

    return {
        clientId: String(data.client_id),
        clientSecret: data.client_secret ? String(data.client_secret) : "",
        scope: data.scope ? String(data.scope) : scope
    };
}

export async function exchangeCodeForOpusTokens({
    tokenEndpoint,
    code,
    redirectUri,
    clientId,
    clientSecret = "",
    codeVerifier,
    resource = "",
    scope = ""
}) {
    const body = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier
    });
    if (clientSecret) {
        body.set("client_secret", clientSecret);
    }
    if (resource) {
        body.set("resource", resource);
    }

    const res = await fetch(tokenEndpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json"
        },
        body: body.toString()
    });

    const payload = await res.json().catch(() => null);
    if (!res.ok || !payload?.access_token) {
        const detail = payload?.error_description || payload?.error || payload?.message || `HTTP ${res.status}`;
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

export async function extractLatestMcpAuthBundle(baseDir = path.join(os.homedir(), ".mcp-auth")) {
    let entries;
    try {
        entries = await fs.readdir(baseDir, { withFileTypes: true });
    } catch {
        return null;
    }

    const candidateDirs = [
        baseDir,
        ...entries.filter(item => item.isDirectory()).map(item => path.join(baseDir, item.name))
    ];

    let newestMatch = null;
    for (const dir of candidateDirs) {
        let files = [];
        try {
            files = await fs.readdir(dir);
        } catch {
            continue;
        }
        const tokenFiles = files.filter(name => name.endsWith("_tokens.json") || name === "tokens.json");
        for (const tokenFile of tokenFiles) {
            const fullTokenPath = path.join(dir, tokenFile);
            let stat;
            let tokenJson;
            try {
                stat = await fs.stat(fullTokenPath);
                tokenJson = JSON.parse(await fs.readFile(fullTokenPath, "utf8"));
            } catch {
                continue;
            }
            if (!tokenJson?.access_token) continue;

            const prefix = tokenFile.endsWith("_tokens.json")
                ? tokenFile.slice(0, -"_tokens.json".length)
                : "";
            const clientFile = prefix ? `${prefix}_client_info.json` : "client_info.json";
            const discoveryFile = prefix ? `${prefix}_discovery_state.json` : "discovery_state.json";
            let clientJson = null;
            let discoveryJson = null;
            try {
                clientJson = JSON.parse(await fs.readFile(path.join(dir, clientFile), "utf8"));
            } catch {
                clientJson = null;
            }
            try {
                discoveryJson = JSON.parse(await fs.readFile(path.join(dir, discoveryFile), "utf8"));
            } catch {
                discoveryJson = null;
            }

            const discoveredResource = String(
                discoveryJson?.resourceMetadata?.resource || ""
            ).trim();
            const discoveredTokenEndpoint = String(
                discoveryJson?.authorizationServerMetadata?.token_endpoint
                || `${DEFAULT_OPUS_AUTH_SERVER}/oauth2/token`
            ).trim();

            if (!newestMatch || stat.mtimeMs > newestMatch.mtimeMs) {
                newestMatch = {
                    mtimeMs: stat.mtimeMs,
                    sourcePath: fullTokenPath,
                    bundle: {
                        access_token: String(tokenJson.access_token),
                        ...(tokenJson.refresh_token ? { refresh_token: String(tokenJson.refresh_token) } : {}),
                        ...(clientJson?.client_id ? { client_id: String(clientJson.client_id) } : {}),
                        ...(clientJson?.client_secret ? { client_secret: String(clientJson.client_secret) } : {}),
                        ...(discoveredResource ? { resource: discoveredResource } : {}),
                        ...(tokenJson.scope ? { scope: String(tokenJson.scope) } : {}),
                        ...(tokenJson.expires_at ? { expires_at: tokenJson.expires_at } : {}),
                        token_endpoint: discoveredTokenEndpoint
                    }
                };
            }
        }
    }

    return newestMatch;
}

export async function verifyOpusMcpToken(mcpUrl, bearerToken) {
    try {
        const initRes = await fetch(mcpUrl, {
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
                    clientInfo: { name: "genz-ai-opus-login", version: "1.0.0" }
                }
            })
        });
        const wwwAuth = initRes.headers.get("www-authenticate") || initRes.headers.get("WWW-Authenticate") || "";
        const sessionId = initRes.headers.get("mcp-session-id") || initRes.headers.get("Mcp-Session-Id") || "";
        const bodyText = await initRes.text().catch(() => "");

        if (!initRes.ok) {
            const errCode = extractWwwAuthParam(wwwAuth, "error");
            const errDesc = extractWwwAuthParam(wwwAuth, "error_description");
            return {
                ok: false,
                status: initRes.status,
                detail: [errCode, errDesc, bodyText.slice(0, 200)].filter(Boolean).join(" — ") || `HTTP ${initRes.status}`
            };
        }

        let accountNote = "";
        try {
            const baseHeaders = {
                Authorization: `Bearer ${bearerToken}`,
                "Content-Type": "application/json",
                Accept: "application/json, text/event-stream",
                "MCP-Protocol-Version": MCP_PROTOCOL_VERSION,
                ...(sessionId ? { "Mcp-Session-Id": sessionId } : {})
            };
            await fetch(mcpUrl, {
                method: "POST",
                headers: baseHeaders,
                body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized", params: {} })
            }).catch(() => null);

            const whoRes = await fetch(mcpUrl, {
                method: "POST",
                headers: baseHeaders,
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    id: 2,
                    method: "tools/call",
                    params: { name: "opus_video_tools_whoami", arguments: {} }
                })
            });
            if (whoRes.ok) {
                const whoRaw = await whoRes.text();
                const snippet = whoRaw.replace(/\s+/g, " ").slice(0, 180);
                if (snippet) accountNote = snippet;
            }
        } catch {
            /* whoami bersifat opsional setelah initialize HTTP 200. */
        }

        return { ok: true, status: initRes.status, accountNote };
    } catch (err) {
        return { ok: false, status: 0, detail: err?.message || "network error" };
    }
}

function spawnDetachedSafe(command, args, options = {}) {
    return new Promise(resolve => {
        try {
            const child = spawn(command, args, {
                stdio: "ignore",
                detached: true,
                ...options
            });
            let settled = false;
            child.once("error", () => {
                if (!settled) {
                    settled = true;
                    resolve(false);
                }
            });
            child.once("spawn", () => {
                child.unref();
                if (!settled) {
                    settled = true;
                    resolve(true);
                }
            });
        } catch {
            resolve(false);
        }
    });
}

export async function openBrowserUrl(targetUrl, { env = process.env, platform = process.platform, spawnFn = spawnDetachedSafe } = {}) {
    if (platform === "win32") {
        return await spawnFn(
            "powershell.exe",
            ["-NoProfile", "-NonInteractive", "-Command", "Start-Process $env:OPUS_AUTH_URL"],
            { env: { ...env, OPUS_AUTH_URL: targetUrl } }
        );
    }

    if (isTermuxEnvironment(env, platform)) {
        if (await spawnFn("termux-open-url", [targetUrl])) {
            return true;
        }
        if (await spawnFn("am", ["start", "--user", "0", "-a", "android.intent.action.VIEW", "-d", targetUrl])) {
            return true;
        }
        return await spawnFn("xdg-open", [targetUrl]);
    }

    const opener = platform === "darwin" ? "open" : "xdg-open";
    return await spawnFn(opener, [targetUrl]);
}

function runTermuxWakeCommand(cmdName) {
    if (!isTermuxEnvironment()) return;
    try {
        const child = spawn(cmdName, [], { stdio: "ignore", detached: true });
        child.on("error", () => {});
        child.unref();
    } catch {
        /* opsional bila termux-wake-lock tidak tersedia */
    }
}

function tryPipeToCommand(command, args, text) {
    return new Promise(resolve => {
        try {
            const proc = spawn(command, args, { stdio: ["pipe", "ignore", "ignore"] });
            let done = false;
            const finish = ok => {
                if (!done) {
                    done = true;
                    resolve(ok);
                }
            };
            proc.on("error", () => finish(false));
            proc.on("close", code => finish(code === 0));
            proc.stdin.on("error", () => {});
            proc.stdin.end(text, "utf8");
        } catch {
            resolve(false);
        }
    });
}

async function copyTextToClipboard(text) {
    if (process.platform === "win32") {
        return await tryPipeToCommand("clip.exe", [], text);
    }
    if (process.platform === "darwin") {
        return await tryPipeToCommand("pbcopy", [], text);
    }
    if (isTermuxEnvironment()) {
        return await tryPipeToCommand("termux-clipboard-set", [], text);
    }
    if (await tryPipeToCommand("wl-copy", [], text)) {
        return true;
    }
    return await tryPipeToCommand("xclip", ["-selection", "clipboard"], text);
}

export function buildCallbackSuccessHtml(compactJson = "") {
    const hasToken = Boolean(compactJson);
    const escapedJson = escapeHtml(compactJson);

    return (
        "<!doctype html><html lang='id'><head><meta charset='utf-8'>"
        + "<meta name='viewport' content='width=device-width,initial-scale=1'>"
        + "<title>Opus Terhubung — GEN-Z.AI</title>"
        + "<style>"
        + "body{background:#000000;color:#e8f0fe;font-family:system-ui,-apple-system,sans-serif;display:grid;place-items:center;min-height:92vh;margin:0;padding:16px;box-sizing:border-box}"
        + ".box{border:1px solid #26354d;border-radius:18px;padding:24px 20px;max-width:520px;width:100%;background:#0b1320;box-sizing:border-box}"
        + "h1{color:#39ff71;font-size:20px;margin:0 0 8px;text-align:center}"
        + "p{color:#a8b8d0;font-size:14px;line-height:1.55;margin:0 0 14px;text-align:center}"
        + ".btn{display:block;width:100%;border:none;border-radius:12px;padding:15px 16px;font-size:16px;font-weight:700;cursor:pointer;background:#39ff71;color:#021407;margin:0 0 12px;box-sizing:border-box}"
        + ".btn:active{transform:scale(0.99)}"
        + ".linkbtn{display:block;width:100%;text-align:center;text-decoration:none;border:1px solid #2f466b;border-radius:12px;padding:12px 16px;font-size:14px;font-weight:600;color:#9ec5ff;background:#101c30;margin:10px 0 0;box-sizing:border-box}"
        + "textarea{width:100%;height:96px;background:#050911;color:#cfe2ff;border:1px solid #26354d;border-radius:10px;padding:10px;font-family:ui-monospace,monospace;font-size:12px;box-sizing:border-box;word-break:break-all}"
        + ".steps{margin-top:14px;padding-top:12px;border-top:1px solid #1d2b40;color:#9fb0ca;font-size:13px;line-height:1.55}"
        + "</style></head><body><div class='box'>"
        + "<h1>Login Opus Labs Berhasil!</h1>"
        + (hasToken
            ? "<p>Token OAuth sudah <b>diverifikasi (HTTP 200 OK)</b>. Ketuk tombol hijau di bawah untuk menyalin JSON Token ke clipboard HP/PC Anda:</p>"
              + "<button id='copyBtn' type='button' class='btn'>SALIN TOKEN JSON KE CLIPBOARD</button>"
              + `<textarea id='tokenBox' readonly onclick='this.select()'>${escapedJson}</textarea>`
              + "<a class='linkbtn' href='https://dash.cloudflare.com/' target='_blank' rel='noopener'>Buka Cloudflare Dashboard &rarr;</a>"
              + "<div class='steps'>"
              + "<b>Langkah tempel di Cloudflare:</b><br>"
              + "1. Buka <b>Workers &amp; Pages &rarr; genzai &rarr; Settings &rarr; Variables and Secrets</b>.<br>"
              + "2. Tempel (Paste) ke <b>OPUS_AUTH_TOKEN</b> (akun #1), <b>OPUS_AUTH_TOKEN_2</b> (akun #2), <b>OPUS_AUTH_TOKEN_3</b> (akun #3), dst., lalu klik <b>Save / Deploy</b>."
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
            : "<p>Token OAuth sedang diverifikasi &amp; disimpan di terminal. Anda boleh kembali ke jendela terminal / Termux.</p>")
        + "</div></body></html>"
    );
}

async function verifyAndPersistBundle(rawBundle, outputPath, mcpUrl) {
    const candidateIdToken = rawBundle._id_token || "";
    const cleanBundle = { ...rawBundle };
    delete cleanBundle._id_token;

    let check = await verifyOpusMcpToken(mcpUrl, cleanBundle.access_token);
    if (!check.ok && check.status === 401 && candidateIdToken && candidateIdToken !== cleanBundle.access_token) {
        const idCheck = await verifyOpusMcpToken(mcpUrl, candidateIdToken);
        if (idCheck.ok) {
            cleanBundle.access_token = candidateIdToken;
            check = idCheck;
        }
    }

    if (!check.ok) {
        throw new Error(
            `Token diterima dari OAuth server tetapi masih ditolak oleh ${mcpUrl} (${check.detail || `HTTP ${check.status}`}). `
            + "Pastikan Anda login dengan akun OpusClip yang aktif."
        );
    }

    const compactJson = JSON.stringify(cleanBundle);
    await fs.writeFile(outputPath, `${compactJson}\n`, { encoding: "utf8", mode: 0o600 });
    const copied = await copyTextToClipboard(compactJson);

    return {
        cleanBundle,
        compactJson,
        copied,
        status: check.status
    };
}

function printFinishBanner({ outputPath, cleanBundle, compactJson, copied, status }) {
    console.log("\n=========================================================");
    console.log("BERHASIL! Token OAuth Opus TERVERIFIKASI (HTTP 200 OK).");
    console.log("=========================================================");
    console.log(`File tersimpan : ${outputPath}`);
    console.log(`Resource OAuth : ${cleanBundle.resource || "(default)"}`);
    console.log(`Refresh token  : ${cleanBundle.refresh_token ? "Tersedia (auto-refresh permanen aktif)" : "Tidak disertakan server"}`);
    console.log(`Tes koneksi MCP: OK (HTTP ${status})`);
    console.log(`Clipboard      : ${copied ? "SUDAH TERSALIN OTOMATIS" : "Gunakan tombol SALIN di halaman browser atau salin JSON di bawah"}`);

    if (isTermuxEnvironment() || !copied) {
        console.log("\n--- JSON 1 BARIS (SIAP TEMPEL KE CLOUDFLARE SECRET) ---");
        console.log(compactJson);
        console.log("-------------------------------------------------------");
    }

    console.log("\nLangkah terakhir di Cloudflare:");
    console.log("1. Buka Cloudflare Dashboard -> Workers & Pages -> genzai -> Settings -> Variables and Secrets");
    console.log("2. Untuk Akun Utama (#1): Edit/Buat Secret bernama OPUS_AUTH_TOKEN");
    console.log("   Untuk Akun Cadangan berikutnya: OPUS_AUTH_TOKEN_2, OPUS_AUTH_TOKEN_3, dst.");
    console.log("3. Tempel (Paste) JSON di kolom Value, lalu klik Save/Deploy.");
    console.log("=========================================================\n");
}

function startLocalCallbackServer({ expectedState, onExchangeCode, timeoutMs = 300_000 }) {
    return new Promise((resolveServer, rejectServer) => {
        let settled = false;
        let settleResult;
        let rejectResult;
        const resultPromise = new Promise((res, rej) => {
            settleResult = res;
            rejectResult = rej;
        });

        const safeCloseServer = () => {
            try {
                server.close();
            } catch {
                /* ignore */
            }
        };

        const timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            safeCloseServer();
            rejectResult(new Error("Waktu tunggu login browser habis (5 menit). Jalankan ulang script ini."));
        }, timeoutMs);

        const server = http.createServer(async (req, res) => {
            const reqUrl = new URL(req.url || "/", "http://127.0.0.1");
            if (reqUrl.pathname !== "/callback") {
                res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
                res.end("Not Found");
                return;
            }
            const oauthError = reqUrl.searchParams.get("error");
            const oauthErrorDesc = reqUrl.searchParams.get("error_description") || "";
            const code = reqUrl.searchParams.get("code") || "";
            const state = reqUrl.searchParams.get("state") || "";

            if (oauthError) {
                res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
                res.end("<h2>Otorisasi Opus dibatalkan atau ditolak.</h2><p>Silakan kembali ke terminal / Termux.</p>");
                if (!settled) {
                    settled = true;
                    clearTimeout(timer);
                    safeCloseServer();
                    rejectResult(new Error(`Otorisasi Opus ditolak (${oauthError}): ${oauthErrorDesc}`));
                }
                return;
            }
            if (!code || state !== expectedState) {
                res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
                res.end("<h2>Parameter callback OAuth tidak cocok.</h2><p>Silakan jalankan ulang script login.</p>");
                return;
            }

            if (settled) {
                res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
                res.end(buildCallbackSuccessHtml(""));
                return;
            }
            settled = true;
            clearTimeout(timer);

            try {
                const exchanged = typeof onExchangeCode === "function"
                    ? await onExchangeCode(code)
                    : { code, compactJson: "" };
                res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
                res.end(buildCallbackSuccessHtml(exchanged?.compactJson || ""));
                setTimeout(safeCloseServer, 400);
                settleResult(exchanged);
            } catch (err) {
                res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
                res.end(
                    `<h2>Gagal memverifikasi token Opus</h2><p>${escapeHtml(err?.message || String(err))}</p>`
                );
                safeCloseServer();
                rejectResult(err);
            }
        });

        server.on("error", err => {
            clearTimeout(timer);
            rejectServer(err);
        });

        server.listen(0, "127.0.0.1", () => {
            const addr = server.address();
            const port = typeof addr === "object" && addr ? addr.port : 0;
            resolveServer({
                port,
                redirectUri: `http://127.0.0.1:${port}/callback`,
                waitForResult: () => resultPromise,
                submitManualCallbackInput: async rawLine => {
                    if (settled) return false;
                    const manualCode = extractOAuthCallbackCode(rawLine, expectedState);
                    if (!manualCode) return false;
                    settled = true;
                    clearTimeout(timer);
                    safeCloseServer();
                    try {
                        const exchanged = typeof onExchangeCode === "function"
                            ? await onExchangeCode(manualCode)
                            : { code: manualCode, compactJson: "" };
                        settleResult(exchanged);
                        return true;
                    } catch (err) {
                        rejectResult(err);
                        return true;
                    }
                },
                close: () => {
                    clearTimeout(timer);
                    safeCloseServer();
                }
            });
        });
    });
}

async function main() {
    const args = process.argv.slice(2);
    const scriptDir = path.dirname(fileURLToPath(import.meta.url));
    const repoRoot = path.basename(scriptDir).toLowerCase() === "scripts"
        ? path.resolve(scriptDir, "..")
        : scriptDir;
    const outputPath = path.join(repoRoot, DEFAULT_OUTPUT_FILE);
    const mcpUrl = process.env.OPUS_MCP_URL || DEFAULT_OPUS_MCP_URL;

    if (args.includes("--from-mcp-auth")) {
        const cached = await extractLatestMcpAuthBundle();
        if (!cached) {
            console.error("Tidak ditemukan token di folder ~/.mcp-auth. Jalankan tanpa argumen untuk login langsung lewat browser.");
            process.exit(1);
        }
        console.log(`Mengimpor token terbaru dari: ${cached.sourcePath}`);
        const finished = await verifyAndPersistBundle(cached.bundle, outputPath, mcpUrl);
        printFinishBanner({ outputPath, ...finished });
        return;
    }

    runTermuxWakeCommand("termux-wake-lock");
    console.log("Menyiapkan koneksi OAuth Opus Labs (Product Ad Studio & Video Tools)...");
    const endpoints = await discoverOpusOAuthEndpoints(mcpUrl);
    console.log(`Server OAuth   : ${endpoints.authServerBase}`);
    console.log(`Target Resource: ${endpoints.resource || mcpUrl}`);

    const state = crypto.randomBytes(16).toString("hex");
    const { codeVerifier, codeChallenge } = createPkcePair();

    let registeredClient = null;
    let redirectUriForExchange = "";
    let effectiveScope = "";
    let rl = null;

    const callbackServer = await startLocalCallbackServer({
        expectedState: state,
        onExchangeCode: async code => {
            console.log("\nMenukar kode otorisasi menjadi token OAuth & memverifikasi ke server MCP...");
            const bundle = await exchangeCodeForOpusTokens({
                tokenEndpoint: endpoints.tokenEndpoint,
                code,
                redirectUri: redirectUriForExchange,
                clientId: registeredClient.clientId,
                clientSecret: registeredClient.clientSecret,
                codeVerifier,
                resource: endpoints.resource,
                scope: effectiveScope
            });
            return await verifyAndPersistBundle(bundle, outputPath, mcpUrl);
        }
    });

    redirectUriForExchange = callbackServer.redirectUri;

    try {
        registeredClient = await registerDynamicOAuthClient(
            endpoints.registrationEndpoint,
            callbackServer.redirectUri,
            {
                scope: endpoints.scope,
                authMethodsSupported: endpoints.authMethodsSupported
            }
        );

        effectiveScope = endpoints.scope || registeredClient.scope || "";
        const authUrl = new URL(endpoints.authorizationEndpoint);
        authUrl.searchParams.set("response_type", "code");
        authUrl.searchParams.set("client_id", registeredClient.clientId);
        authUrl.searchParams.set("redirect_uri", callbackServer.redirectUri);
        authUrl.searchParams.set("code_challenge", codeChallenge);
        authUrl.searchParams.set("code_challenge_method", "S256");
        authUrl.searchParams.set("state", state);
        if (endpoints.resource) {
            authUrl.searchParams.set("resource", endpoints.resource);
        }
        if (effectiveScope) {
            authUrl.searchParams.set("scope", effectiveScope);
            if (effectiveScope.split(/\s+/).includes("offline_access")) {
                authUrl.searchParams.set("prompt", "consent");
            }
        }

        console.log("\nMembuka browser untuk login ke akun OpusClip / Opus Labs Anda...");
        console.log("Jika browser tidak terbuka otomatis, tahan & buka link ini:\n");
        console.log(`  ${authUrl.toString()}\n`);
        await openBrowserUrl(authUrl.toString());

        console.log("Menunggu Anda klik Allow / Authorize di browser...");
        if (isTermuxEnvironment()) {
            console.log("(Tips HP/Termux: Begitu klik Allow, halaman browser akan langsung menampilkan tombol");
            console.log(" [SALIN TOKEN JSON KE CLIPBOARD]. Jika halaman 127.0.0.1 tidak termuat, tempel saja");
            console.log(" URL callback dari address bar browser ke sini lalu tekan Enter.)");
        }

        if (process.stdin.isTTY) {
            rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout,
                terminal: false
            });
            rl.on("line", line => {
                callbackServer.submitManualCallbackInput(line).catch(err => {
                    console.error(`\n[PERINGATAN INPUT] ${err?.message || err}`);
                });
            });
        }

        const finished = await callbackServer.waitForResult();
        printFinishBanner({ outputPath, ...finished });
    } catch (error) {
        callbackServer.close();
        console.error(`\n[GAGAL] ${error?.message || error}`);
        process.exit(1);
    } finally {
        if (rl) {
            try {
                rl.close();
            } catch {
                /* ignore */
            }
        }
        runTermuxWakeCommand("termux-wake-unlock");
    }
}

const isDirectCli = process.argv[1]
    && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectCli) {
    main();
}
