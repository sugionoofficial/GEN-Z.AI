/* GET /api/openclips-oauth-callback — exchange PKCE code and show a
 * pasteable credential bundle. No token is logged or stored by this route. */

import {
    OPENCLIPS_LOGIN_CALLBACK_PATH,
    OPENCLIPS_MCP_URL,
    buildOpenClipsLoginErrorHtml,
    buildOpenClipsLoginSuccessHtml,
    decodeOpenClipsOAuthState,
    exchangeCodeForOpenClipsTokens,
    normalizeOpenClipsMcpUrl,
    normalizeOpenClipsSlot,
    resolvePublicOrigin,
    verifyOpenClipsMcpToken
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

    const url = new URL(req.url || "/api/openclips-oauth-callback", "https://genzai.local");
    const origin = resolvePublicOrigin(req);
    const providerError = url.searchParams.get("error");
    if (providerError) {
        return sendHtml(res, 400, buildOpenClipsLoginErrorHtml({
            message: `Otorisasi OpenClips ditolak (${providerError})${url.searchParams.get("error_description") ? `: ${url.searchParams.get("error_description")}` : ""}`,
            origin
        }));
    }

    const code = String(url.searchParams.get("code") || "").trim();
    const state = await decodeOpenClipsOAuthState(url.searchParams.get("state"), { env: req.env || null });
    if (!code || !state) {
        return sendHtml(res, 400, buildOpenClipsLoginErrorHtml({
            message: "Code/state OAuth tidak valid atau sesi login sudah kedaluwarsa. Ulangi dari awal.",
            origin
        }));
    }

    const expectedRedirect = `${origin}${OPENCLIPS_LOGIN_CALLBACK_PATH}`;
    if (state.ru !== expectedRedirect) {
        return sendHtml(res, 400, buildOpenClipsLoginErrorHtml({
            message: "Redirect URI OAuth tidak cocok dengan sesi login.",
            origin
        }));
    }

    const slot = normalizeOpenClipsSlot(state.sl);
    const mcpUrl = normalizeOpenClipsMcpUrl(state.mu || OPENCLIPS_MCP_URL);
    try {
        const bundle = await exchangeCodeForOpenClipsTokens({
            tokenEndpoint: state.te,
            code,
            redirectUri: state.ru,
            clientId: state.c,
            clientSecret: state.cs || "",
            codeVerifier: state.v,
            resource: state.r || "",
            scope: state.sc || "mcp"
        });
        delete bundle._id_token;
        bundle.mcp_url = mcpUrl;

        const check = await verifyOpenClipsMcpToken(mcpUrl, bundle.access_token);
        if (!check.ok) {
            throw new Error(`Token diterima tetapi ditolak server MCP (${check.detail || `HTTP ${check.status}`}).`);
        }

        return sendHtml(res, 200, buildOpenClipsLoginSuccessHtml({
            compactJson: JSON.stringify(bundle),
            slot,
            status: check.status,
            mcpUrl
        }));
    } catch (error) {
        /* Do not log the bundle, authorization code, tokens or state. */
        console.error("[OpenClips OAuth] Callback failed:", error?.message || error);
        return sendHtml(res, 500, buildOpenClipsLoginErrorHtml({
            message: error?.message || "Gagal menukar authorization code OpenClips.",
            slot,
            origin
        }));
    }
}
