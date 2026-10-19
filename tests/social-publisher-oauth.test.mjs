import test from "node:test";
import assert from "node:assert/strict";
import socialPublisherHandler from "../api/social-publisher.js";

test("Facebook OAuth invokes the configured Business Login flow without runtime scopes", async () => {
    const originalFetch = globalThis.fetch;
    const config = {
        SUPABASE_URL: "https://project.example",
        SUPABASE_SERVICE_ROLE_KEY: "server-only-test-key",
        SUPABASE_ANON_KEY: "anon-test-key",
        META_APP_ID: "meta-app-id",
        META_APP_SECRET: "meta-app-secret",
        META_REDIRECT_URI: "https://genzai.genzai-f37.workers.dev/api/facebook-oauth-callback",
        META_LOGIN_CONFIG_ID: "business-login-config-id",
        SOCIAL_TOKEN_ENCRYPTION_KEY: btoa(String.fromCharCode(...new Uint8Array(32).fill(9)))
    };

    globalThis.fetch = async (input, options = {}) => {
        const url = String(input);
        if (url.endsWith("/auth/v1/user")) {
            return Response.json({ id: "admin-user" });
        }
        if (url.includes("/rest/v1/profiles?")) {
            return Response.json([{ id: "admin-user", role: "ADMIN", status: "active" }]);
        }
        if (url.includes("/rest/v1/facebook_oauth_states")) {
            assert.equal(options.method, "POST");
            return new Response(null, { status: 201 });
        }
        throw new Error(`Unexpected fetch in test: ${url}`);
    };

    const response = {
        statusCode: 0,
        headers: {},
        body: null,
        setHeader(name, value) { this.headers[name] = value; },
        status(code) { this.statusCode = code; return this; },
        json(value) { this.body = value; return this; },
        end(value) { this.body = value; return this; }
    };

    try {
        await socialPublisherHandler({
            method: "GET",
            url: "/api/social-publisher?action=oauth-start",
            query: { action: "oauth-start" },
            headers: { authorization: "Bearer user-session" },
            env: config
        }, response);

        assert.equal(response.statusCode, 200);
        const authorizationUrl = new URL(response.body.authorization_url);
        assert.equal(authorizationUrl.searchParams.get("config_id"), "business-login-config-id");
        assert.equal(authorizationUrl.searchParams.get("response_type"), "code");
        assert.equal(authorizationUrl.searchParams.get("scope"), null);
    } finally {
        globalThis.fetch = originalFetch;
    }
});
