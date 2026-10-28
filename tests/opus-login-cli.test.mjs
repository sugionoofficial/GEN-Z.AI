import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
    buildCallbackSuccessHtml,
    createPkcePair,
    discoverOpusOAuthEndpoints,
    extractOAuthCallbackCode,
    isTermuxEnvironment,
    openBrowserUrl,
    registerDynamicOAuthClient,
    exchangeCodeForOpusTokens,
    extractLatestMcpAuthBundle,
    verifyOpusMcpToken,
    DEFAULT_OUTPUT_FILE
} from "../scripts/opus-login.mjs";
import { opusConfigured } from "../lib/social-publisher/opus.js";

test("createPkcePair menghasilkan pasangan verifier & S256 challenge yang valid", () => {
    const { codeVerifier, codeChallenge } = createPkcePair();
    assert.ok(codeVerifier.length >= 43, "codeVerifier minimal 43 karakter sesuai RFC 7636");
    const expected = crypto
        .createHash("sha256")
        .update(codeVerifier)
        .digest("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
    assert.equal(codeChallenge, expected);
});

test("OAuth discovery (WWW-Authenticate + RFC 9728 + RFC 8707 resource), dynamic client registration, dan token exchange menghasilkan JSON siap-pakai", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, options = {}) => {
        const url = String(input);
        if (url === "https://labs.opus.pro/opus-video-tools/mcp") {
            const authHeader = options.headers?.Authorization || "";
            if (!authHeader) {
                return new Response("", {
                    status: 401,
                    headers: {
                        "WWW-Authenticate": 'Bearer resource_metadata="https://labs.opus.pro/opus-video-tools/.well-known/oauth-protected-resource"'
                    }
                });
            }
            if (authHeader === "Bearer opus_access_live_1") {
                return Response.json(
                    { jsonrpc: "2.0", id: 1, result: { protocolVersion: "2025-03-26" } },
                    { status: 200, headers: { "mcp-session-id": "sess-ok-1" } }
                );
            }
            return new Response("", {
                status: 401,
                headers: {
                    "WWW-Authenticate": 'Bearer error="invalid_token", error_description="Audience mismatch"'
                }
            });
        }
        if (url === "https://labs.opus.pro/opus-video-tools/.well-known/oauth-protected-resource") {
            return Response.json({
                resource: "https://labs.opus.pro/opus-video-tools/mcp",
                authorization_servers: ["https://focused-horizon-38.authkit.app"],
                scopes_supported: ["openid", "offline_access"]
            });
        }
        if (url === "https://focused-horizon-38.authkit.app/.well-known/oauth-authorization-server") {
            return Response.json({
                authorization_endpoint: "https://focused-horizon-38.authkit.app/oauth2/authorize",
                token_endpoint: "https://focused-horizon-38.authkit.app/oauth2/token",
                registration_endpoint: "https://focused-horizon-38.authkit.app/oauth2/register",
                scopes_supported: ["openid", "profile", "email", "offline_access"],
                token_endpoint_auth_methods_supported: ["none", "client_secret_post"]
            });
        }
        if (url === "https://focused-horizon-38.authkit.app/oauth2/register") {
            const reqBody = JSON.parse(options.body);
            assert.deepEqual(reqBody.redirect_uris, ["http://127.0.0.1:54321/callback"]);
            assert.equal(reqBody.application_type, "native");
            assert.equal(reqBody.token_endpoint_auth_method, "none");
            return Response.json({ client_id: "client_dyn_opus_01" }, { status: 201 });
        }
        if (url === "https://focused-horizon-38.authkit.app/oauth2/token") {
            const form = new URLSearchParams(options.body);
            assert.equal(form.get("grant_type"), "authorization_code");
            assert.equal(form.get("client_id"), "client_dyn_opus_01");
            assert.equal(form.get("code"), "auth_code_xyz");
            assert.equal(
                form.get("resource"),
                "https://labs.opus.pro/opus-video-tools/mcp",
                "RFC 8707 resource wajib dikirim ke token_endpoint agar audience JWT cocok"
            );
            return Response.json({
                access_token: "opus_access_live_1",
                refresh_token: "opus_refresh_live_1",
                scope: "openid offline_access",
                expires_in: 3600
            });
        }
        throw new Error(`Unexpected fetch: ${url}`);
    };

    try {
        const endpoints = await discoverOpusOAuthEndpoints();
        assert.equal(endpoints.resource, "https://labs.opus.pro/opus-video-tools/mcp");
        assert.equal(endpoints.authorizationEndpoint, "https://focused-horizon-38.authkit.app/oauth2/authorize");
        assert.equal(endpoints.tokenEndpoint, "https://focused-horizon-38.authkit.app/oauth2/token");
        assert.equal(endpoints.registrationEndpoint, "https://focused-horizon-38.authkit.app/oauth2/register");
        assert.deepEqual(endpoints.scopes, ["openid", "offline_access"]);

        const client = await registerDynamicOAuthClient(
            endpoints.registrationEndpoint,
            "http://127.0.0.1:54321/callback",
            {
                scope: endpoints.scope,
                authMethodsSupported: endpoints.authMethodsSupported
            }
        );
        assert.equal(client.clientId, "client_dyn_opus_01");

        const bundle = await exchangeCodeForOpusTokens({
            tokenEndpoint: endpoints.tokenEndpoint,
            code: "auth_code_xyz",
            redirectUri: "http://127.0.0.1:54321/callback",
            clientId: client.clientId,
            codeVerifier: "verifier_123",
            resource: endpoints.resource,
            scope: endpoints.scope
        });

        assert.equal(bundle.access_token, "opus_access_live_1");
        assert.equal(bundle.refresh_token, "opus_refresh_live_1");
        assert.equal(bundle.client_id, "client_dyn_opus_01");
        assert.equal(bundle.resource, "https://labs.opus.pro/opus-video-tools/mcp");
        assert.equal(bundle.scope, "openid offline_access");
        assert.equal(bundle.token_endpoint, "https://focused-horizon-38.authkit.app/oauth2/token");
        assert.equal(opusConfigured({ OPUS_AUTH_TOKEN: JSON.stringify(bundle) }), true);

        const okVerify = await verifyOpusMcpToken("https://labs.opus.pro/opus-video-tools/mcp", bundle.access_token);
        assert.equal(okVerify.ok, true);

        const badVerify = await verifyOpusMcpToken("https://labs.opus.pro/opus-video-tools/mcp", "wrong_aud_token");
        assert.equal(badVerify.ok, false);
        assert.match(badVerify.detail, /Audience mismatch/);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("extractLatestMcpAuthBundle membaca subfolder mcp-remote-v1 dan menyertakan resource dari discovery_state", async () => {
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "opus-mcp-auth-"));
    try {
        const subDir = path.join(tmpRoot, "mcp-remote-v1");
        await fs.mkdir(subDir, { recursive: true });
        await fs.writeFile(
            path.join(subDir, "abc123_tokens.json"),
            JSON.stringify({
                access_token: "tok_cached",
                refresh_token: "ref_cached",
                scope: "openid offline_access",
                expires_at: 1890000000
            })
        );
        await fs.writeFile(
            path.join(subDir, "abc123_client_info.json"),
            JSON.stringify({ client_id: "cid_cached" })
        );
        await fs.writeFile(
            path.join(subDir, "abc123_discovery_state.json"),
            JSON.stringify({
                resourceMetadata: { resource: "https://labs.opus.pro/opus-video-tools/mcp" },
                authorizationServerMetadata: { token_endpoint: "https://focused-horizon-38.authkit.app/oauth2/token" }
            })
        );

        const extracted = await extractLatestMcpAuthBundle(tmpRoot);
        assert.ok(extracted);
        assert.equal(extracted.bundle.access_token, "tok_cached");
        assert.equal(extracted.bundle.refresh_token, "ref_cached");
        assert.equal(extracted.bundle.client_id, "cid_cached");
        assert.equal(extracted.bundle.resource, "https://labs.opus.pro/opus-video-tools/mcp");
        assert.equal(extracted.bundle.scope, "openid offline_access");
    } finally {
        await fs.rm(tmpRoot, { recursive: true, force: true });
    }
});

test("package.json menyediakan npm run opus:login dan .gitignore melindungi file token lokal", () => {
    const pkg = JSON.parse(
        readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8")
    );
    const gitignore = readFileSync(
        fileURLToPath(new URL("../.gitignore", import.meta.url)),
        "utf8"
    );
    assert.equal(pkg.scripts["opus:login"], "node scripts/opus-login.mjs");
    assert.ok(gitignore.includes(DEFAULT_OUTPUT_FILE), ".opus-auth-token.json wajib ada di .gitignore");
});

test("Dukungan HP Android / Termux: deteksi env, fallback opener aman bebas ENOENT, ekstraksi callback URL manual, dan halaman tombol Salin Token", async () => {
    assert.equal(isTermuxEnvironment({ TERMUX_VERSION: "0.118.1" }, "linux"), true);
    assert.equal(isTermuxEnvironment({ PREFIX: "/data/data/com.termux/files/usr" }, "linux"), true);
    assert.equal(isTermuxEnvironment({}, "android"), true);
    assert.equal(isTermuxEnvironment({}, "linux"), false);

    /* Bila termux-open-url tidak ada, otomatis jatuh ke Android Activity Manager (am start) */
    const triedCommands = [];
    const openedViaAm = await openBrowserUrl("https://focused-horizon-38.authkit.app/oauth2/authorize?client_id=test", {
        env: { TERMUX_VERSION: "0.118.1" },
        platform: "linux",
        spawnFn: async (cmd, args) => {
            triedCommands.push([cmd, args]);
            return cmd === "am";
        }
    });
    assert.equal(openedViaAm, true);
    assert.equal(triedCommands[0][0], "termux-open-url");
    assert.equal(triedCommands[1][0], "am");

    /* Bila dijalankan nyata di environment minimal yang tidak punya binary opener palsu, tidak boleh melempar unhandled ENOENT */
    const safeFalse = await openBrowserUrl("https://example.com", {
        env: {},
        platform: "linux",
        spawnFn: undefined
    });
    assert.equal(typeof safeFalse, "boolean");

    /* Ekstraksi callback manual dari address bar Chrome HP */
    const parsedCode = extractOAuthCallbackCode(
        "http://127.0.0.1:43125/callback?code=auth_mobile_999&state=st_abc",
        "st_abc"
    );
    assert.equal(parsedCode, "auth_mobile_999");

    assert.throws(
        () => extractOAuthCallbackCode("http://127.0.0.1:43125/callback?code=abc&state=wrong", "st_abc"),
        /state OAuth tidak cocok/i
    );

    const sampleJson = JSON.stringify({ access_token: "at_hp", refresh_token: "rt_hp", client_id: "cid_hp" });
    const html = buildCallbackSuccessHtml(sampleJson);
    assert.ok(html.includes("SALIN TOKEN JSON KE CLIPBOARD"));
    assert.ok(html.includes("https://dash.cloudflare.com/"));
    assert.ok(html.includes("&quot;refresh_token&quot;:&quot;rt_hp&quot;"));
});

