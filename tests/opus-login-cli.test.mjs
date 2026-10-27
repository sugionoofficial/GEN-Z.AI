import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
    createPkcePair,
    discoverOpusOAuthEndpoints,
    registerDynamicOAuthClient,
    exchangeCodeForOpusTokens,
    extractLatestMcpAuthBundle,
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

test("OAuth discovery, dynamic client registration, dan token exchange menghasilkan JSON siap-pakai untuk OPUS_AUTH_TOKEN", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, options = {}) => {
        const url = String(input);
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
                registration_endpoint: "https://focused-horizon-38.authkit.app/oauth2/register"
            });
        }
        if (url === "https://focused-horizon-38.authkit.app/oauth2/register") {
            const reqBody = JSON.parse(options.body);
            assert.deepEqual(reqBody.redirect_uris, ["http://127.0.0.1:54321/callback"]);
            return Response.json({ client_id: "client_dyn_opus_01" }, { status: 201 });
        }
        if (url === "https://focused-horizon-38.authkit.app/oauth2/token") {
            const form = new URLSearchParams(options.body);
            assert.equal(form.get("grant_type"), "authorization_code");
            assert.equal(form.get("client_id"), "client_dyn_opus_01");
            assert.equal(form.get("code"), "auth_code_xyz");
            return Response.json({
                access_token: "opus_access_live_1",
                refresh_token: "opus_refresh_live_1",
                expires_in: 3600
            });
        }
        throw new Error(`Unexpected fetch: ${url}`);
    };

    try {
        const endpoints = await discoverOpusOAuthEndpoints();
        assert.equal(endpoints.authorizationEndpoint, "https://focused-horizon-38.authkit.app/oauth2/authorize");
        assert.equal(endpoints.tokenEndpoint, "https://focused-horizon-38.authkit.app/oauth2/token");
        assert.equal(endpoints.registrationEndpoint, "https://focused-horizon-38.authkit.app/oauth2/register");
        assert.deepEqual(endpoints.scopes, ["openid", "offline_access"]);

        const client = await registerDynamicOAuthClient(
            endpoints.registrationEndpoint,
            "http://127.0.0.1:54321/callback"
        );
        assert.equal(client.clientId, "client_dyn_opus_01");

        const bundle = await exchangeCodeForOpusTokens({
            tokenEndpoint: endpoints.tokenEndpoint,
            code: "auth_code_xyz",
            redirectUri: "http://127.0.0.1:54321/callback",
            clientId: client.clientId,
            codeVerifier: "verifier_123"
        });

        assert.equal(bundle.access_token, "opus_access_live_1");
        assert.equal(bundle.refresh_token, "opus_refresh_live_1");
        assert.equal(bundle.client_id, "client_dyn_opus_01");
        assert.equal(bundle.token_endpoint, "https://focused-horizon-38.authkit.app/oauth2/token");
        assert.equal(opusConfigured({ OPUS_AUTH_TOKEN: JSON.stringify(bundle) }), true);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("extractLatestMcpAuthBundle membaca subfolder mcp-remote-v1 dan menggabungkan tokens + client_info", async () => {
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "opus-mcp-auth-"));
    try {
        const subDir = path.join(tmpRoot, "mcp-remote-v1");
        await fs.mkdir(subDir, { recursive: true });
        await fs.writeFile(
            path.join(subDir, "abc123_tokens.json"),
            JSON.stringify({ access_token: "tok_cached", refresh_token: "ref_cached", expires_at: 1890000000 })
        );
        await fs.writeFile(
            path.join(subDir, "abc123_client_info.json"),
            JSON.stringify({ client_id: "cid_cached" })
        );

        const extracted = await extractLatestMcpAuthBundle(tmpRoot);
        assert.ok(extracted);
        assert.equal(extracted.bundle.access_token, "tok_cached");
        assert.equal(extracted.bundle.refresh_token, "ref_cached");
        assert.equal(extracted.bundle.client_id, "cid_cached");
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
