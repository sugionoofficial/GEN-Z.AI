import test from "node:test";
import assert from "node:assert/strict";

import {
    buildOpenClipsLoginIntroHtml,
    buildOpenClipsLoginSuccessHtml,
    decodeOpenClipsOAuthState,
    encodeOpenClipsOAuthState,
    openClipsSecretNameForSlot
} from "../functions/_shared/openclips-oauth-web.js";
import openClipsLogin from "../api/openclips-oauth-login.js";
import openClipsCallback from "../api/openclips-oauth-callback.js";

function json(payload, status = 200, headers = {}) {
    return new Response(JSON.stringify(payload), {
        status,
        headers: { "content-type": "application/json", ...headers }
    });
}

function createMockRes() {
    return {
        statusCode: 200,
        headers: {},
        body: "",
        setHeader(name, value) {
            this.headers[String(name).toLowerCase()] = value;
            return this;
        },
        end(value) {
            this.body = value === undefined ? "" : String(value);
            return this;
        }
    };
}

function createMockReq(url, env = {}) {
    const host = "genzai.genzai-f37.workers.dev";
    return {
        method: "GET",
        url,
        env,
        headers: { host, "x-forwarded-host": host, "x-forwarded-proto": "https" }
    };
}

async function withFetch(handler, run) {
    const original = globalThis.fetch;
    globalThis.fetch = async (input, options = {}) => handler(String(input), options);
    try {
        await run();
    } finally {
        globalThis.fetch = original;
    }
}

function discoveryFetch(url, options = {}) {
    if (url === "https://mcp.openclips.ai/.well-known/oauth-protected-resource") {
        return json({
            resource: "https://mcp.openclips.ai",
            authorization_servers: ["https://mcp.openclips.ai"],
            scopes_supported: ["mcp"]
        });
    }
    if (url === "https://mcp.openclips.ai/.well-known/oauth-authorization-server") {
        return json({
            authorization_endpoint: "https://mcp.openclips.ai/authorize",
            token_endpoint: "https://mcp.openclips.ai/token",
            registration_endpoint: "https://mcp.openclips.ai/register",
            scopes_supported: ["mcp"],
            token_endpoint_auth_methods_supported: ["none", "client_secret_post"]
        });
    }
    if (url === "https://mcp.openclips.ai" && options.method === "POST") {
        return json({ error: "invalid_token" }, 401, {
            "www-authenticate": 'Bearer resource_metadata="https://mcp.openclips.ai/.well-known/oauth-protected-resource", scope="mcp"'
        });
    }
    if (url === "https://mcp.openclips.ai/register") {
        const body = JSON.parse(options.body);
        assert.equal(body.token_endpoint_auth_method, "none");
        assert.deepEqual(body.grant_types, ["authorization_code", "refresh_token"]);
        return json({ client_id: "openclips-client-1", scope: body.scope });
    }
    return new Response("not found", { status: 404 });
}

test("state OpenClips ditandatangani dan tidak menerima state provider lain", async () => {
    const env = { OPENCLIPS_LOGIN_STATE_SECRET: "openclips-test-secret" };
    const state = await encodeOpenClipsOAuthState({ c: "client", v: "verifier" }, { env });
    const decoded = await decodeOpenClipsOAuthState(state, { env });
    assert.equal(decoded.c, "client");
    assert.equal(decoded.p, "openclips");
    assert.equal(await decodeOpenClipsOAuthState(`${state.slice(0, -2)}xx`, { env }), null);
    assert.equal(await decodeOpenClipsOAuthState(state, { env: { OPENCLIPS_LOGIN_STATE_SECRET: "wrong" } }), null);
});

test("login start melakukan discovery + DCR lalu redirect OAuth PKCE resmi", async () => {
    await withFetch(discoveryFetch, async () => {
        const res = createMockRes();
        await openClipsLogin(createMockReq("/api/openclips-oauth-login?start=1&slot=2", {
            OPENCLIPS_LOGIN_STATE_SECRET: "login-secret"
        }), res);
        assert.equal(res.statusCode, 302);
        const location = new URL(res.headers.location);
        assert.equal(location.origin + location.pathname, "https://mcp.openclips.ai/authorize");
        assert.equal(location.searchParams.get("client_id"), "openclips-client-1");
        assert.equal(location.searchParams.get("code_challenge_method"), "S256");
        assert.equal(location.searchParams.get("resource"), "https://mcp.openclips.ai");
        assert.equal(location.searchParams.get("scope"), "mcp");
        assert.equal(location.searchParams.get("redirect_uri"), "https://genzai.genzai-f37.workers.dev/api/openclips-oauth-callback");
        assert.ok(location.searchParams.get("state").includes("."));
    });
});

test("callback menukar code, memverifikasi MCP, dan menampilkan bundle refresh tanpa log token", async () => {
    const env = { OPENCLIPS_LOGIN_STATE_SECRET: "callback-secret" };
    const redirectUri = "https://genzai.genzai-f37.workers.dev/api/openclips-oauth-callback";
    const state = await encodeOpenClipsOAuthState({
        c: "openclips-client-1",
        v: "verifier-1",
        r: "https://mcp.openclips.ai",
        sc: "mcp",
        sl: 2,
        ru: redirectUri,
        te: "https://mcp.openclips.ai/token",
        mu: "https://mcp.openclips.ai"
    }, { env });

    await withFetch((url, options = {}) => {
        if (url === "https://mcp.openclips.ai/token") {
            const form = new URLSearchParams(options.body);
            assert.equal(form.get("grant_type"), "authorization_code");
            assert.equal(form.get("code_verifier"), "verifier-1");
            assert.equal(form.get("client_id"), "openclips-client-1");
            return json({ access_token: "access-xyz", refresh_token: "refresh-xyz", expires_in: 3600, scope: "mcp" });
        }
        if (url === "https://mcp.openclips.ai") {
            assert.match(options.headers.Authorization, /^Bearer access-xyz$/);
            return json({ jsonrpc: "2.0", id: 1, result: { protocolVersion: "2025-03-26" } });
        }
        return new Response("not found", { status: 404 });
    }, async () => {
        const res = createMockRes();
        await openClipsCallback(createMockReq(`/api/openclips-oauth-callback?code=code-1&state=${encodeURIComponent(state)}`, env), res);
        assert.equal(res.statusCode, 200);
        assert.match(res.body, /OpenClips berhasil terhubung/);
        assert.match(res.body, /refresh-xyz/);
        assert.match(res.body, /OPENCLIPS_AUTH_TOKEN_2/);
        assert.match(res.body, /mcp_url/);
        assert.match(res.headers["cache-control"], /no-store/);
    });
});

test("halaman intro/success menjelaskan credential dan slot tanpa dependensi eksternal", () => {
    const intro = buildOpenClipsLoginIntroHtml({ slot: 1, origin: "https://example.com" });
    assert.match(intro, /start=1&amp;slot=1|start=1&slot=1/);
    assert.match(intro, /LANJUT LOGIN KE OPENCLIPS/);
    const success = buildOpenClipsLoginSuccessHtml({ compactJson: "{\"access_token\":\"a\"}", slot: 3, status: 200 });
    assert.match(success, /OPENCLIPS_AUTH_TOKEN_3/);
    assert.match(success, /navigator\.clipboard/);
    assert.doesNotMatch(success, /https:\/\/fonts\./);
    assert.equal(openClipsSecretNameForSlot(1), "OPENCLIPS_AUTH_TOKEN");
    assert.equal(openClipsSecretNameForSlot(4), "OPENCLIPS_AUTH_TOKEN_4");
});
