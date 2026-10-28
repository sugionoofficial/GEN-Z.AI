// api/opus-oauth-callback.js?v=1.0
// ========================================
// GEN-Z.AI
// OPUS OAUTH CALLBACK (BROWSER SAJA — TANPA TERMUX)
// File: api/opus-oauth-callback.js
// ----------------------------------------
// GET /api/opus-oauth-callback?code=...&state=...
// Menukar authorization code menjadi token JSON (PKCE),
// memverifikasi token ke server MCP Opus, lalu menampilkan
// halaman 1-ketuk [SALIN TOKEN JSON KE CLIPBOARD].
// ========================================

import {
    OPUS_MCP_URL,
    buildOpusLoginErrorHtml,
    buildOpusLoginSuccessHtml,
    decodeOAuthState,
    exchangeCodeForOpusTokens,
    normalizeOpusSlot,
    resolvePublicOrigin,
    verifyOpusMcpToken
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

export default async function handler(req, res) {
    if (req.method !== "GET" && req.method !== "HEAD") {
        res.statusCode = 405;
        res.setHeader("Allow", "GET, HEAD");
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        return res.end(JSON.stringify({ success: false, error: "Method tidak diizinkan." }));
    }

    const url = new URL(req.url || "/api/opus-oauth-callback", "https://genzai.local");
    const origin = resolvePublicOrigin(req);
    const slotFromQuery = normalizeOpusSlot(url.searchParams.get("slot"));

    const providerError = url.searchParams.get("error");
    if (providerError) {
        const description = url.searchParams.get("error_description") || "";
        return sendHtml(
            res,
            400,
            buildOpusLoginErrorHtml({
                message: `Otorisasi Opus ditolak (${providerError})${description ? `: ${description}` : ""}`,
                slot: slotFromQuery,
                origin
            })
        );
    }

    const code = String(url.searchParams.get("code") || "").trim();
    const rawState = String(url.searchParams.get("state") || "").trim();

    if (!code) {
        return sendHtml(
            res,
            400,
            buildOpusLoginErrorHtml({
                message: "Parameter code OAuth tidak ditemukan pada URL callback.",
                slot: slotFromQuery,
                origin
            })
        );
    }

    const state = await decodeOAuthState(rawState, { env: req.env || null });
    if (!state) {
        return sendHtml(
            res,
            400,
            buildOpusLoginErrorHtml({
                message: "Sesi login OAuth kedaluwarsa atau tidak valid. Silakan ulangi login dari awal.",
                slot: slotFromQuery,
                origin
            })
        );
    }

    const slot = normalizeOpusSlot(state.sl || slotFromQuery);

    try {
        const bundle = await exchangeCodeForOpusTokens({
            tokenEndpoint: state.te || "",
            code,
            redirectUri: state.ru || `${origin}/api/opus-oauth-callback`,
            clientId: state.c,
            clientSecret: state.cs || "",
            codeVerifier: state.v,
            resource: state.r || "",
            scope: state.sc || ""
        });

        const cleanBundle = { ...bundle };
        const candidateIdToken = cleanBundle._id_token || "";
        delete cleanBundle._id_token;

        const mcpUrl = state.mu || OPUS_MCP_URL;
        let check = await verifyOpusMcpToken(mcpUrl, cleanBundle.access_token);
        if (!check.ok && check.status === 401 && candidateIdToken) {
            const idCheck = await verifyOpusMcpToken(mcpUrl, candidateIdToken);
            if (idCheck.ok) {
                cleanBundle.access_token = candidateIdToken;
                check = idCheck;
            }
        }

        if (!check.ok) {
            throw new Error(
                `Token diterima dari server OAuth, tetapi masih ditolak oleh ${mcpUrl} `
                + `(${check.detail || `HTTP ${check.status}`}). Pastikan Anda login dengan akun OpusClip yang aktif.`
            );
        }

        return sendHtml(
            res,
            200,
            buildOpusLoginSuccessHtml({
                compactJson: JSON.stringify(cleanBundle),
                slot,
                status: check.status
            })
        );
    } catch (error) {
        console.error("[Opus OAuth Web] Callback failed:", error);
        return sendHtml(
            res,
            500,
            buildOpusLoginErrorHtml({
                message: error?.message || "Gagal menukar kode OAuth Opus menjadi token.",
                slot,
                origin
            })
        );
    }
}
