import test from "node:test";
import assert from "node:assert/strict";

process.env.SUPABASE_URL = "https://project.example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "server-service-role";
process.env.SUPABASE_ANON_KEY = "project-anon";

const { default: handler } = await import(
    `../api/feature-credits.js?upscale-video-credit-test=${Date.now()}`
);

function createResponse() {
    return {
        statusCode: 200,
        headers: {},
        body: "",
        setHeader(name, value) {
            this.headers[name] = value;
        },
        end(body) {
            this.body = body;
        }
    };
}

test("admin can save the separate video upscale credit rate", async () => {
    const originalFetch = globalThis.fetch;
    const requests = [];
    globalThis.fetch = async (url, options = {}) => {
        requests.push({ url: String(url), options });

        if (String(url).endsWith("/auth/v1/user")) {
            assert.equal(options.headers.apikey, "project-anon");
            assert.equal(options.headers.Authorization, "Bearer test-access-token");
            return Response.json({ id: "admin-user", email: "admin@example.com" });
        }

        if (String(url).includes("/rest/v1/profiles?")) {
            return Response.json([{ role: "OWNER" }]);
        }

        if (String(url).includes("/rest/v1/feature_credit_settings?")) {
            return Response.json(JSON.parse(options.body));
        }

        throw new Error(`Unexpected Supabase request: ${url}`);
    };

    const settings = {
        vision: 1,
        vision_video: 2,
        upscale: 3,
        upscale_video: 7,
        prompt_studio: 1,
        metadata_cleaner: 1
    };
    const response = createResponse();

    try {
        await handler({
            method: "POST",
            url: "/api/feature-credits",
            headers: { authorization: "Bearer test-access-token" },
            body: { action: "save_settings", settings }
        }, response);

        assert.equal(response.statusCode, 200);
        assert.equal(JSON.parse(response.body).success, true);
        assert.equal(
            JSON.parse(response.body).settings.find(
                item => item.feature_id === "upscale_video"
            ).credit_cost,
            7
        );
        assert.equal(
            requests.some(request =>
                request.url.includes("/rest/v1/feature_credit_settings?on_conflict=")
            ),
            true
        );
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("admin must include the separate video upscale credit rate", async () => {
    const originalFetch = globalThis.fetch;
    const originalConsoleError = console.error;
    console.error = () => {};
    globalThis.fetch = async url => {
        if (String(url).endsWith("/auth/v1/user")) {
            return Response.json({ id: "admin-user" });
        }
        if (String(url).includes("/rest/v1/profiles?")) {
            return Response.json([{ role: "ADMIN" }]);
        }
        throw new Error(`Unexpected Supabase request: ${url}`);
    };

    const response = createResponse();

    try {
        await handler({
            method: "POST",
            url: "/api/feature-credits",
            headers: { authorization: "Bearer test-access-token" },
            body: {
                action: "save_settings",
                settings: {
                    vision: 1,
                    vision_video: 1,
                    upscale: 1,
                    prompt_studio: 1,
                    metadata_cleaner: 1
                }
            }
        }, response);

        assert.equal(response.statusCode, 400);
        assert.match(JSON.parse(response.body).error, /semua fitur/i);
    } finally {
        globalThis.fetch = originalFetch;
        console.error = originalConsoleError;
    }
});
