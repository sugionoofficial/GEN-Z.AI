/* GET /api/openclips-oauth-login — browser OAuth + PKCE for OpenClips MCP. */

import {
    OPENCLIPS_LOGIN_CALLBACK_PATH,
    OPENCLIPS_MCP_URL,
    buildOpenClipsLoginErrorHtml,
    buildOpenClipsLoginIntroHtml,
    createPkcePair,
    discoverOpenClipsOAuthEndpoints,
    encodeOpenClipsOAuthState,
    normalizeOpenClipsMcpUrl,
    normalizeOpenClipsSlot,
    registerOpenClipsOAuthClient,
    resolvePublicOrigin
} from "../functions/_shared/openclips-oauth-web.js";

const NO_STORE = {
    "Cache-Control": "no-store, no-cache, must-revalidate",
    "X-Robots-Tag": "noindex, nofollow",
    "Referrer-Policy": "no-referrer"
};

function sendHtml(res, status, html) {
    res.statusCode = status;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    for (const [name, value] of Object.entries(NO_STORE)) res.setHeader(name, value);
    return res.end(html);
}

export default async function handler(req, res) {
    if (req.method !== "GET" && req.method !== "HEAD") {
        res.statusCode = 405;
        res.setHeader("Allow", "GET, HEAD");
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        return res.end(JSON.stringify({ success: false, error: "Method tidak diizinkan." }));
    }

    const url = new URL(req.url || "/api/openclips-oauth-login", "https://genzai.local");
    const slot = normalizeOpenClipsSlot(url.searchParams.get("slot"));
    const origin = resolvePublicOrigin(req);
    const mcpUrl = normalizeOpenClipsMcpUrl(req.env?.OPENCLIPS_MCP_URL || OPENCLIPS_MCP_URL);

    if (url.searchParams.get("start") !== "1") {
        return sendHtml(res, 200, buildOpenClipsLoginIntroHtml({ slot, origin, mcpUrl }));
    }

    try {
        const endpoints = await discoverOpenClipsOAuthEndpoints(mcpUrl);
        const pkce = await createPkcePair();
        const redirectUri = `${origin}${OPENCLIPS_LOGIN_CALLBACK_PATH}`;
        const client = await registerOpenClipsOAuthClient(endpoints.registrationEndpoint, redirectUri, {
            scope: endpoints.scope,
            authMethodsSupported: endpoints.authMethodsSupported
        });
        const effectiveScope = endpoints.scope || client.scope || "mcp";
        const state = await encodeOpenClipsOAuthState({
            c: client.clientId,
            cs: client.clientSecret || "",
            v: pkce.codeVerifier,
            r: endpoints.resource || "",
            sc: effectiveScope,
            sl: slot,
            ru: redirectUri,
            te: endpoints.tokenEndpoint,
            mu: endpoints.mcpUrl || mcpUrl
        }, { env: req.env || null });

        const authorizationUrl = new URL(endpoints.authorizationEndpoint);
        authorizationUrl.searchParams.set("response_type", "code");
        authorizationUrl.searchParams.set("client_id", client.clientId);
        authorizationUrl.searchParams.set("redirect_uri", redirectUri);
        authorizationUrl.searchParams.set("code_challenge", pkce.codeChallenge);
        authorizationUrl.searchParams.set("code_challenge_method", "S256");
        authorizationUrl.searchParams.set("state", state);
        if (endpoints.resource) authorizationUrl.searchParams.set("resource", endpoints.resource);
        if (effectiveScope) authorizationUrl.searchParams.set("scope", effectiveScope);

        res.statusCode = 302;
        res.setHeader("Location", authorizationUrl.toString());
        for (const [name, value] of Object.entries(NO_STORE)) res.setHeader(name, value);
        return res.end("");
    } catch (error) {
        console.error("[OpenClips OAuth] Start failed:", error?.message || error);
        return sendHtml(res, 500, buildOpenClipsLoginErrorHtml({
            message: error?.message || "Gagal memulai OAuth OpenClips.",
            slot,
            origin
        }));
    }
}
