import test from "node:test";
import assert from "node:assert/strict";

process.env.SUPABASE_URL = "https://project.example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "server-service-role";
process.env.SUPABASE_ANON_KEY = "project-anon";

const { default: handler } = await import(
    `../api/generate.js?anon-auth-test=${Date.now()}`
);

test("validates the user access token with the project anon API key", async () => {
    const originalFetch = globalThis.fetch;
    let authRequest;
    globalThis.fetch = async (url, options = {}) => {
        authRequest = { url: String(url), options };
        return Response.json({
            id: "test-user",
            email: "user@example.com"
        });
    };

    const response = {
        statusCode: 200,
        body: "",
        setHeader() {},
        end(body) {
            this.body = body;
        }
    };

    try {
        await handler({
            method: "POST",
            headers: { authorization: "Bearer user-access-token" },
            body: {}
        }, response);

        assert.equal(
            authRequest.url,
            "https://project.example.supabase.co/auth/v1/user"
        );
        assert.equal(authRequest.options.headers.apikey, "project-anon");
        assert.equal(
            authRequest.options.headers.Authorization,
            "Bearer user-access-token"
        );
        assert.equal(response.statusCode, 400);
        assert.match(JSON.parse(response.body).error, /model_id is required/);
    } finally {
        globalThis.fetch = originalFetch;
    }
});
