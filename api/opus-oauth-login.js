// api/opus-oauth-login.js?v=1.0
// ========================================
// GEN-Z.AI
// OPUS OAUTH LOGIN (BROWSER SAJA — TANPA TERMUX)
// File: api/opus-oauth-login.js
// ----------------------------------------
// GET /api/opus-oauth-login            -> halaman pembuka (1 tombol)
// GET /api/opus-oauth-login?start=1    -> daftarkan client PKCE lalu
//                                         redirect ke halaman login Opus
// Query opsional: &slot=1|2|3 (default 1)
// ========================================

import {
    OPUS_LOGIN_CALLBACK_PATH,
    OPUS_MCP_URL,
    buildLoginIntroHtml,
    buildOpusLoginErrorHtml,
    createPkcePair,
    discoverOpusOAuthEndpoints,
    encodeOAuthState,
    normalizeOpusMcpUrl,
    normalizeOpusSlot,
    registerDynamicOAuthClient,
    resolvePublicOrigin
} from "../functions/_shared/opus-oauth-web.js";

const NO_STORE = {
    "Cache-Control": "no-store, no-cache, must-revalidate",
    "X-Robots-Tag": "noindex, nofollow"
};

function sendHtml(res, status, html) {
    res.statusCode = status;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    for (const [name, value] of Object.entries(NO_STORE)) {
        res.setHeader(name, value);
    }
    return res.end(html);
}

function redirect(res, location) {
    res.statusCode = 302;
    res.setHeader("Location", location);
    for (const [name, value] of Object.entries(NO_STORE)) {
        res.setHeader(name, value);
    }
    return res.end("");
}

export default async function handler(req, res) {
    if (req.method !== "GET" && req.method !== "HEAD") {
        res.statusCode = 405;
        res.setHeader("Allow", "GET, HEAD");
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        return res.end(JSON.stringify({ success: false, error: "Method tidak diizinkan." }));
    }

    const url = new URL(req.url || "/api/opus-oauth-login", "https://genzai.local");
    const slot = normalizeOpusSlot(url.searchParams.get("slot"));
    const requestedMcpUrl = normalizeOpusMcpUrl(url.searchParams.get("mcp"));
    const origin = resolvePublicOrigin(req);

    if (url.searchParams.get("start") !== "1") {
        return sendHtml(res, 200, buildLoginIntroHtml({ slot, origin, mcpUrl: requestedMcpUrl }));
    }

    let endpoints;
    let codeChallenge = "";
    let codeVerifier = "";
    let client = null;

    try {
        endpoints = await discoverOpusOAuthEndpoints(requestedMcpUrl);

        const pkce = await createPkcePair();
        codeVerifier = pkce.codeVerifier;
        codeChallenge = pkce.codeChallenge;

        const redirectUri = `${origin}${OPUS_LOGIN_CALLBACK_PATH}`;

        client = await registerDynamicOAuthClient(
            endpoints.registrationEndpoint,
            redirectUri,
            {
                scope: endpoints.scope,
                authMethodsSupported: endpoints.authMethodsSupported
            }
        );

        const effectiveScope = endpoints.scope || client.scope || "";
        const state = await encodeOAuthState(
            {
                c: client.clientId,
                cs: client.clientSecret || "",
                v: codeVerifier,
                r: endpoints.resource || "",
                sc: effectiveScope,
                sl: slot,
                ru: redirectUri,
                te: endpoints.tokenEndpoint,
                mu: endpoints.mcpUrl || OPUS_MCP_URL
            },
            { env: req.env || null }
        );

        const authUrl = new URL(endpoints.authorizationEndpoint);
        authUrl.searchParams.set("response_type", "code");
        authUrl.searchParams.set("client_id", client.clientId);
        authUrl.searchParams.set("redirect_uri", redirectUri);
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

        return redirect(res, authUrl.toString());
    } catch (error) {
        console.error("[Opus OAuth Web] Start failed:", error);
        return sendHtml(
            res,
            500,
            buildOpusLoginErrorHtml({
                message: error?.message || "Gagal memulai login OAuth Opus.",
                slot,
                origin,
                mcpUrl: requestedMcpUrl
            })
        );
    }
}
