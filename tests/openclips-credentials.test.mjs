import test from "node:test";
import assert from "node:assert/strict";

import {
    clearOpenClipsMemoryTokenVault,
    computeOpenClipsSeedHash,
    decryptOpenClipsVaultRecord,
    encryptOpenClipsVaultRecord
} from "../provider/openclips/oauth-vault.js";
import {
    describeOpenClipsCredential,
    extractOpenClipsCredentialPool,
    resolveOpenClipsAccessToken,
    resolveOpenClipsApiKeyPoolPayload,
    resolveOpenClipsBearerToken
} from "../provider/openclips/credentials.js";

const TEST_ENV = { OPENCLIPS_DISABLE_SUPABASE_VAULT: "1" };

test("credential pool menggabungkan DB, env tunggal, multi, dan slot bernomor dengan dedup", async () => {
    const env = {
        OPENCLIPS_AUTH_TOKEN: "db-token",
        OPENCLIPS_AUTH_TOKEN_2: "second-token",
        OPENCLIPS_API_KEYS: "third-token\nfourth-token",
        OPENCLIPS_API_KEY_10: "tenth-token"
    };
    const entries = extractOpenClipsCredentialPool("db-token", env);
    assert.deepEqual(entries.map(entry => entry.raw), [
        "db-token",
        "third-token",
        "fourth-token",
        "second-token",
        "tenth-token"
    ]);
    assert.equal(entries[3].slot, 3);
    const payload = await resolveOpenClipsApiKeyPoolPayload(env, "db-token");
    const parsed = JSON.parse(payload);
    assert.equal(parsed.openclips_key_pool.length, 5);
});

test("JSON OAuth bundle memetakan access, refresh, client, expiry, resource dan workspace", () => {
    const entry = extractOpenClipsCredentialPool(JSON.stringify({
        access_token: "Bearer access-1",
        refresh_token: "refresh-1",
        client_id: "client-1",
        expires_at: 4_000_000_000,
        token_endpoint: "https://mcp.openclips.ai/token",
        resource: "https://mcp.openclips.ai",
        workspace_id: 42,
        mcp_url: "https://mcp.openclips.ai/mcp"
    }), TEST_ENV)[0];
    const description = describeOpenClipsCredential(entry, TEST_ENV);
    assert.equal(description.accessToken, "access-1");
    assert.equal(description.refreshToken, "refresh-1");
    assert.equal(description.clientId, "client-1");
    assert.equal(description.workspaceId, "42");
    assert.equal(description.mcpUrl, "https://mcp.openclips.ai/mcp");
    assert.equal(description.expiresAtMs, 4_000_000_000_000);
});

test("refresh token rotating memakai refresh token terbaru pada refresh berikutnya", async () => {
    clearOpenClipsMemoryTokenVault();
    const originalFetch = globalThis.fetch;
    const seenRefreshTokens = [];
    globalThis.fetch = async (url, options = {}) => {
        assert.equal(url, "https://mcp.openclips.ai/token");
        const form = new URLSearchParams(options.body);
        seenRefreshTokens.push(form.get("refresh_token"));
        const generation = seenRefreshTokens.length;
        return new Response(JSON.stringify({
            access_token: `new-access-${generation}`,
            refresh_token: `new-refresh-${generation}`,
            expires_in: 3600
        }), { status: 200, headers: { "content-type": "application/json" } });
    };
    try {
        const bundle = JSON.stringify({
            access_token: "expired-access",
            refresh_token: "seed-refresh",
            client_id: "client-test",
            expires_at: 1
        });
        const entry = extractOpenClipsCredentialPool(bundle, TEST_ENV)[0];
        const first = await resolveOpenClipsAccessToken(entry, { env: TEST_ENV });
        assert.equal(first.accessToken, "new-access-1");
        assert.equal(first.refreshToken, "new-refresh-1");
        assert.equal(first.canRefresh, true);

        const second = await resolveOpenClipsAccessToken(entry, { env: TEST_ENV, forceRefresh: true });
        assert.equal(second.accessToken, "new-access-2");
        assert.deepEqual(seenRefreshTokens, ["seed-refresh", "new-refresh-1"]);
    } finally {
        globalThis.fetch = originalFetch;
        clearOpenClipsMemoryTokenVault();
    }
});

test("resolveOpenClipsBearerToken mengembalikan slot dan dapat memakai API key mentah", async () => {
    const result = await resolveOpenClipsBearerToken(TEST_ENV, "plain-api-key");
    assert.equal(result.token, "plain-api-key");
    assert.equal(result.keySlot, 0);
    assert.equal(result.keyPoolSize, 1);
    assert.equal(result.canRefresh, false);
});

test("AES-256-GCM vault roundtrip dan seed hash terpisah per credential", async () => {
    const encrypted = await encryptOpenClipsVaultRecord("unit-secret", {
        access_token: "a",
        refresh_token: "r",
        expires_at_ms: 123
    });
    assert.notEqual(encrypted.ciphertextBase64.includes("access_token"), true);
    const decrypted = await decryptOpenClipsVaultRecord(
        "unit-secret",
        encrypted.ciphertextBase64,
        encrypted.ivBase64
    );
    assert.deepEqual(decrypted, { access_token: "a", refresh_token: "r", expires_at_ms: 123 });

    const hashA = await computeOpenClipsSeedHash({ tokenEndpoint: "https://mcp.openclips.ai/token", clientId: "c", seedRefreshToken: "a" });
    const hashB = await computeOpenClipsSeedHash({ tokenEndpoint: "https://mcp.openclips.ai/token", clientId: "c", seedRefreshToken: "b" });
    assert.match(hashA, /^[a-f0-9]{64}$/);
    assert.notEqual(hashA, hashB);
});
