import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

import {
    buildLoginIntroHtml,
    buildOpusLoginSuccessHtml,
    createPkcePair,
    decodeOAuthState,
    discoverOpusOAuthEndpoints,
    encodeOAuthState,
    exchangeCodeForOpusTokens,
    normalizeOpusSlot,
    opusSecretNameForSlot,
    registerDynamicOAuthClient,
    resolvePublicOrigin
} from "../functions/_shared/opus-oauth-web.js";

import opusOAuthLogin from "../api/opus-oauth-login.js";
import opusOAuthCallback from "../api/opus-oauth-callback.js";

/* =========================================================
   HELPERS
   ========================================================= */

function createMockRes() {
    const headers = {};
    return {
        statusCode: 200,
        headers,
        body: "",
        setHeader(name, value) {
            headers[String(name).toLowerCase()] = value;
            return this;
        },
        end(raw) {
            this.body = raw === undefined ? "" : String(raw);
            return this;
        }
    };
}

function createMockReq(url, { env = {}, host = "genzai.genzai-f37.workers.dev", proto = "https" } = {}) {
    return {
        method: "GET",
        url,
        env,
        headers: {
            host,
            "x-forwarded-host": host,
            "x-forwarded-proto": proto
        }
    };
}

function withFetch(handler, run) {
    const original = globalThis.fetch;
    globalThis.fetch = async (input, options = {}) => handler(String(input), options);
    return Promise.resolve()
        .then(run)
        .finally(() => {
            globalThis.fetch = original;
        });
}

const DISCOVERY_FETCH = (url) => {
    if (url.startsWith("https://labs.opus.pro/.well-known/oauth-protected-resource")) {
        return json({ resource: "https://labs.opus.pro/opus-video-tools/mcp", authorization_servers: ["https://focused-horizon-38.authkit.app"] });
    }
    if (url === "https://focused-horizon-38.authkit.app/.well-known/oauth-authorization-server") {
        return json({
            authorization_endpoint: "https://focused-horizon-38.authkit.app/oauth2/authorize",
            token_endpoint: "https://focused-horizon-38.authkit.app/oauth2/token",
            registration_endpoint: "https://focused-horizon-38.authkit.app/oauth2/register",
            scopes_supported: ["openid", "offline_access"],
            token_endpoint_auth_methods_supported: ["none"]
        });
    }
    return new Response("not found", { status: 404 });
};

function json(payload, status = 200) {
    return new Response(JSON.stringify(payload), {
        status,
        headers: { "content-type": "application/json" }
    });
}

/* =========================================================
   PKCE & STATE
   ========================================================= */

test("createPkcePair (WebCrypto) menghasilkan S256 challenge sesuai RFC 7636", async () => {
    const { codeVerifier, codeChallenge } = await createPkcePair();
    assert.ok(codeVerifier.length >= 43);
    const expected = crypto
        .createHash("sha256")
        .update(codeVerifier)
        .digest("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
    assert.equal(codeChallenge, expected);
});

test("state OAuth ditandatangani, bisa dibaca ulang, dan menolak manipulasi/kedaluwarsa", async () => {
    const env = { OPUS_LOGIN_STATE_SECRET: "unit-test-state-secret" };
    const token = await encodeOAuthState({ c: "client_123", v: "verifier_abc", sl: 2 }, { env });
    const decoded = await decodeOAuthState(token, { env });
    assert.equal(decoded.c, "client_123");
    assert.equal(decoded.v, "verifier_abc");
    assert.equal(decoded.sl, 2);

    const tampered = `${token.slice(0, -2)}xx`;
    assert.equal(await decodeOAuthState(tampered, { env }), null);

    const otherSecret = await decodeOAuthState(token, { env: { OPUS_LOGIN_STATE_SECRET: "beda" } });
    assert.equal(otherSecret, null);

    const expired = await decodeOAuthState(token, { env, now: Date.now() + 60 * 60 * 1000 });
    assert.equal(expired, null);
});

test("normalizeOpusSlot & opusSecretNameForSlot memetakan slot ke nama secret Cloudflare", () => {
    assert.equal(opusSecretNameForSlot(1), "OPUS_AUTH_TOKEN");
    assert.equal(opusSecretNameForSlot(2), "OPUS_AUTH_TOKEN_2");
    assert.equal(opusSecretNameForSlot(3), "OPUS_AUTH_TOKEN_3");
    assert.equal(opusSecretNameForSlot(0), "OPUS_AUTH_TOKEN");
    assert.equal(normalizeOpusSlot("3"), 3);
});

test("resolvePublicOrigin memakai x-forwarded-host/proto dan fallback aman", () => {
    assert.equal(
        resolvePublicOrigin(createMockReq("/api/opus-oauth-login")),
        "https://genzai.genzai-f37.workers.dev"
    );
    assert.equal(
        resolvePublicOrigin({ headers: { host: "example.workers.dev", "cf-visitor": JSON.stringify({ scheme: "https" }) } }),
        "https://example.workers.dev"
    );
    assert.equal(resolvePublicOrigin({ headers: {} }), "https://genzai.genzai-f37.workers.dev");
});

/* =========================================================
   DISCOVERY / DCR / TOKEN
   ========================================================= */

test("discoverOpusOAuthEndpoints memakai metadata RFC 9728 + RFC 8414", async () => {
    await withFetch(
        (url) => DISCOVERY_FETCH(url),
        async () => {
            const endpoints = await discoverOpusOAuthEndpoints("https://labs.opus.pro/opus-video-tools/mcp", { probeServer: false });
            assert.equal(endpoints.resource, "https://labs.opus.pro/opus-video-tools/mcp");
            assert.equal(endpoints.authorizationEndpoint, "https://focused-horizon-38.authkit.app/oauth2/authorize");
            assert.equal(endpoints.tokenEndpoint, "https://focused-horizon-38.authkit.app/oauth2/token");
            assert.equal(endpoints.registrationEndpoint, "https://focused-horizon-38.authkit.app/oauth2/register");
            assert.ok(endpoints.scope.includes("offline_access"));
        }
    );
});

test("registerDynamicOAuthClient mendaftarkan redirect_uri callback worker", async () => {
    let seenBody = null;
    await withFetch(
        (url, options) => {
            if (url.endsWith("/oauth2/register")) {
                seenBody = JSON.parse(options.body);
                return json({ client_id: "client_web_1", client_secret: "", scope: seenBody.scope });
            }
            return DISCOVERY_FETCH(url);
        },
        async () => {
            const client = await registerDynamicOAuthClient(
                "https://focused-horizon-38.authkit.app/oauth2/register",
                "https://genzai.genzai-f37.workers.dev/api/opus-oauth-callback",
                { scope: "openid offline_access", authMethodsSupported: ["none"] }
            );
            assert.equal(client.clientId, "client_web_1");
            assert.deepEqual(seenBody.redirect_uris, ["https://genzai.genzai-f37.workers.dev/api/opus-oauth-callback"]);
            assert.equal(seenBody.token_endpoint_auth_method, "none");
        }
    );
});

test("exchangeCodeForOpusTokens mengirim PKCE verifier dan menghasilkan bundle siap tempel", async () => {
    let posted = null;
    await withFetch(
        (url, options) => {
            posted = new URLSearchParams(String(options.body));
            return json({
                access_token: "access-abc",
                refresh_token: "refresh-abc",
                expires_in: 3600,
                scope: "openid offline_access"
            });
        },
        async () => {
            const bundle = await exchangeCodeForOpusTokens({
                tokenEndpoint: "https://focused-horizon-38.authkit.app/oauth2/token",
                code: "code-1",
                redirectUri: "https://genzai.genzai-f37.workers.dev/api/opus-oauth-callback",
                clientId: "client_web_1",
                codeVerifier: "verifier-1",
                resource: "https://labs.opus.pro/opus-video-tools/mcp"
            });
            assert.equal(posted.get("code_verifier"), "verifier-1");
            assert.equal(posted.get("grant_type"), "authorization_code");
            assert.equal(bundle.access_token, "access-abc");
            assert.equal(bundle.refresh_token, "refresh-abc");
            assert.equal(bundle.client_id, "client_web_1");
            assert.ok(bundle.expires_at > Math.floor(Date.now() / 1000));
        }
    );
});

/* =========================================================
   ENDPOINT HANDLERS
   ========================================================= */

test("GET /api/opus-oauth-login menampilkan halaman pembuka tanpa memanggil jaringan", async () => {
    const res = createMockRes();
    await opusOAuthLogin(createMockReq("/api/opus-oauth-login?slot=2"), res);
    assert.equal(res.statusCode, 200);
    assert.match(String(res.headers["content-type"]), /text\/html/);
    assert.match(res.body, /LANJUT LOGIN KE OPUS/);
    assert.match(res.body, /OPUS_AUTH_TOKEN_2/);
});

test("GET /api/opus-oauth-login?start=1 melakukan DCR lalu redirect 302 ke Opus dengan PKCE", async () => {
    await withFetch(
        (url, options) => {
            if (url.endsWith("/oauth2/register")) {
                return json({ client_id: "client_web_1", scope: "openid offline_access" });
            }
            return DISCOVERY_FETCH(url);
        },
        async () => {
            const res = createMockRes();
            await opusOAuthLogin(createMockReq("/api/opus-oauth-login?start=1&slot=1"), res);

            assert.equal(res.statusCode, 302);
            const location = new URL(res.headers.location);
            assert.equal(location.origin + location.pathname, "https://focused-horizon-38.authkit.app/oauth2/authorize");
            assert.equal(location.searchParams.get("response_type"), "code");
            assert.equal(location.searchParams.get("client_id"), "client_web_1");
            assert.equal(location.searchParams.get("code_challenge_method"), "S256");
            assert.equal(
                location.searchParams.get("redirect_uri"),
                "https://genzai.genzai-f37.workers.dev/api/opus-oauth-callback"
            );
            assert.equal(location.searchParams.get("resource"), "https://labs.opus.pro/opus-video-tools/mcp");
            assert.ok(location.searchParams.get("state").includes("."));
        }
    );
});

test("GET /api/opus-oauth-callback menukar code dan menampilkan tombol salin token", async () => {
    const env = { OPUS_LOGIN_STATE_SECRET: "callback-secret" };
    const state = await encodeOAuthState(
        {
            c: "client_web_1",
            v: "verifier-1",
            r: "https://labs.opus.pro/opus-video-tools/mcp",
            sc: "openid offline_access",
            sl: 1,
            ru: "https://genzai.genzai-f37.workers.dev/api/opus-oauth-callback",
            te: "https://focused-horizon-38.authkit.app/oauth2/token",
            mu: "https://labs.opus.pro/opus-video-tools/mcp"
        },
        { env }
    );

    await withFetch(
        (url) => {
            if (url.endsWith("/oauth2/token")) {
                return json({ access_token: "access-xyz", refresh_token: "refresh-xyz", expires_in: 3600 });
            }
            if (url === "https://labs.opus.pro/opus-video-tools/mcp") {
                return json({ jsonrpc: "2.0", id: 1, result: {} });
            }
            return new Response("not found", { status: 404 });
        },
        async () => {
            const res = createMockRes();
            await opusOAuthCallback(
                createMockReq(`/api/opus-oauth-callback?code=code-1&state=${encodeURIComponent(state)}`, { env }),
                res
            );
            assert.equal(res.statusCode, 200);
            assert.match(res.body, /SALIN TOKEN JSON KE CLIPBOARD/);
            assert.match(res.body, /OPUS_AUTH_TOKEN</);
            assert.match(res.body, /refresh-xyz/);
        }
    );
});

test("GET /api/opus-oauth-callback menolak state tidak valid dan error dari provider", async () => {
    const resInvalid = createMockRes();
    await opusOAuthCallback(createMockReq("/api/opus-oauth-callback?code=code-1&state=palsu"), resInvalid);
    assert.equal(resInvalid.statusCode, 400);
    assert.match(resInvalid.body, /COBA LAGI/);

    const resDenied = createMockRes();
    await opusOAuthCallback(
        createMockReq("/api/opus-oauth-callback?error=access_denied&error_description=Ditolak"),
        resDenied
    );
    assert.equal(resDenied.statusCode, 400);
    assert.match(resDenied.body, /access_denied/);
});

test("halaman sukses & pembuka memakai latar #000000 dan tanpa dependensi eksternal", () => {
    const success = buildOpusLoginSuccessHtml({ compactJson: "{\"a\":1}", slot: 3, status: 200 });
    assert.match(success, /#000000/);
    assert.match(success, /OPUS_AUTH_TOKEN_3/);
    assert.match(success, /navigator\.clipboard/);
    assert.doesNotMatch(success, /https:\/\/fonts\./);

    const intro = buildLoginIntroHtml({ slot: 1, origin: "https://genzai.genzai-f37.workers.dev" });
    assert.match(intro, /start=1&amp;slot=1/);
});

test("MODUL 03 (?mcp=https://mcp.opus.pro/mcp) mempertahankan target mcp.opus.pro dan mengarahkan kembali ke BLACK BOX tanpa Cloudflare", async () => {
    const resIntro = createMockRes();
    await opusOAuthLogin(
        createMockReq("/api/opus-oauth-login?mcp=https%3A%2F%2Fmcp.opus.pro%2Fmcp"),
        resIntro
    );
    assert.equal(resIntro.statusCode, 200);
    assert.match(resIntro.body, /MODUL 03/);
    assert.match(resIntro.body, /mcp=https%3A%2F%2Fmcp\.opus\.pro%2Fmcp/);

    const env = { OPUS_LOGIN_STATE_SECRET: "mod3-state" };
    const state = await encodeOAuthState(
        {
            c: "client_mod3",
            v: "verifier-mod3",
            r: "https://mcp.opus.pro/mcp",
            sc: "openid offline_access",
            sl: 1,
            ru: "https://genzai.genzai-f37.workers.dev/api/opus-oauth-callback",
            te: "https://focused-horizon-38.authkit.app/oauth2/token",
            mu: "https://mcp.opus.pro/mcp"
        },
        { env }
    );

    await withFetch(
        (url) => {
            if (url.endsWith("/oauth2/token")) {
                return json({ access_token: "ok", refresh_token: "ref", expires_in: 3600 });
            }
            if (url === "https://mcp.opus.pro/mcp") {
                return json({ jsonrpc: "2.0", id: 1, result: {} });
            }
            return new Response("not found", { status: 404 });
        },
        async () => {
            const resCb = createMockRes();
            await opusOAuthCallback(
                createMockReq(`/api/opus-oauth-callback?code=c1&state=${encodeURIComponent(state)}`, { env }),
                resCb
            );
            assert.equal(resCb.statusCode, 200);
            assert.match(resCb.body, /BLACK BOX &rarr; MODUL 03/);
            assert.match(resCb.body, /href='\/black-box\/'/);
            assert.match(resCb.body, /mcp\.opus\.pro\/mcp/);
            assert.doesNotMatch(resCb.body, /dash\.cloudflare\.com/);
        }
    );
});

