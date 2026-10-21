import test from "node:test";
import assert from "node:assert/strict";
import socialPublisherHandler from "../api/social-publisher.js";
import { encryptSecret } from "../lib/social-publisher/providers.js";

const encryptionKey = btoa(String.fromCharCode(...new Uint8Array(32).fill(5)));

const env = {
    SUPABASE_URL: "https://project.example",
    SUPABASE_SERVICE_ROLE_KEY: "server-only-test-key",
    SUPABASE_ANON_KEY: "anon-test-key",
    SOCIAL_TOKEN_ENCRYPTION_KEY: encryptionKey,
    META_APP_ID: "meta-app-id",
    META_APP_SECRET: "meta-app-secret"
};

function makeResponse() {
    return {
        statusCode: 0,
        headers: {},
        body: null,
        setHeader(name, value) { this.headers[name] = value; },
        status(code) { this.statusCode = code; return this; },
        json(value) { this.body = value; return this; },
        end(value) { this.body = value; return this; }
    };
}

async function runCheckPage(graphHandler) {
    const originalFetch = globalThis.fetch;
    const patches = [];
    const encrypted = await encryptSecret("page-token-secret", encryptionKey);
    globalThis.fetch = async (input, options = {}) => {
        const url = String(input);
        if (url.endsWith("/auth/v1/user")) return Response.json({ id: "admin-user" });
        if (url.includes("/rest/v1/profiles?select=id,role,status")) {
            return Response.json([{ id: "admin-user", role: "USER", status: "active" }]);
        }
        if (url.includes("/rest/v1/studio_medsos_access?")) {
            return Response.json([{
                user_id: "admin-user",
                is_active: true,
                duration_days: 30,
                started_at: new Date(Date.now() - 60_000).toISOString(),
                expires_at: new Date(Date.now() + 86_400_000).toISOString()
            }]);
        }
        if (url.includes("/rest/v1/social_page_connections?") && options.method !== "PATCH") {
            return Response.json([{
                id: "connection-1",
                page_id: "page-123",
                page_name: "GEN-Z Page",
                can_publish: true,
                page_tasks: ["CREATE_CONTENT"],
                token_checked_at: null,
                page_token_ciphertext: encrypted.ciphertext,
                page_token_iv: encrypted.iv
            }]);
        }
        if (url.includes("/rest/v1/social_page_connections?") && options.method === "PATCH") {
            patches.push(JSON.parse(options.body));
            return new Response(null, { status: 204 });
        }
        if (url.includes("graph.facebook.com")) return graphHandler(url);
        throw new Error(`Unexpected fetch: ${url}`);
    };

    const response = makeResponse();
    try {
        await socialPublisherHandler({
            method: "POST",
            url: "/api/social-publisher?action=check-page",
            query: { action: "check-page" },
            headers: { authorization: "Bearer test-token" },
            body: { id: "connection-1" },
            env
        }, response);
    } finally {
        globalThis.fetch = originalFetch;
    }
    return { response, patches };
}

test("check-page refreshes stored Page permissions from Facebook", async () => {
    const graphCalls = [];
    const { response, patches } = await runCheckPage(async (url) => {
        graphCalls.push(url);
        if (url.includes("/debug_token?")) {
            return Response.json({
                data: {
                    is_valid: true,
                    type: "PAGE",
                    app_id: "meta-app-id",
                    expires_at: 0,
                    scopes: ["pages_manage_posts", "pages_read_engagement"]
                }
            });
        }
        return Response.json({ id: "page-123", name: "GEN-Z Page", tasks: ["CREATE_CONTENT", "MODERATE"] });
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.can_publish, true);
    assert.deepEqual(response.body.connection.page_tasks, ["CREATE_CONTENT", "MODERATE"]);
    assert.equal(response.body.token.valid, true);
    assert.match(response.body.message, /siap/);
    assert.equal(patches.length, 1);
    assert.equal(patches[0].can_publish, true);
    assert.ok(patches[0].token_checked_at);
    assert.match(graphCalls[0], /page-123\?fields=id%2Cname%2Ctasks/);
});

test("check-page reports a Page that is missing CREATE_CONTENT without calling the photos endpoint", async () => {
    const { response, patches } = await runCheckPage(async (url) => {
        if (url.includes("/debug_token?")) return Response.json({ data: { is_valid: true, type: "PAGE" } });
        return Response.json({ id: "page-123", name: "GEN-Z Page", tasks: ["MODERATE"] });
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.can_publish, false);
    assert.match(response.body.message, /CREATE_CONTENT/);
    assert.equal(patches[0].can_publish, false);
});

test("check-page surfaces a #200 permission error with reconnect guidance", async () => {
    const { response, patches } = await runCheckPage(async () => Response.json(
        { error: { message: "(#200) Permissions error", type: "OAuthException", code: 200 } },
        { status: 403 }
    ));

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.can_publish, false);
    assert.equal(response.body.code, "permission_denied");
    assert.equal(response.body.needs_reconnect, true);
    assert.match(response.body.message, /pages_manage_posts/);
    assert.equal(patches[0].can_publish, false);
});

test("check-page keeps publishing enabled when Graph refuses the tasks field itself (#100)", async () => {
    const graphCalls = [];
    const { response, patches } = await runCheckPage(async (url) => {
        graphCalls.push(url);
        if (url.includes("/debug_token?")) return Response.json({ data: { is_valid: true, type: "PAGE" } });
        if (url.includes("tasks")) {
            return Response.json(
                {
                    error: {
                        message: "(#100) Tried accessing nonexisting field (tasks) on node type (Page)",
                        type: "OAuthException",
                        code: 100
                    }
                },
                { status: 400 }
            );
        }
        return Response.json({ id: "page-123", name: "GEN-Z Page" });
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.can_publish, true);
    assert.equal(response.body.tasks_read, false);
    assert.match(response.body.message, /belum dapat dipastikan/);
    assert.equal(graphCalls.some(url => url.includes("fields=id%2Cname&") || url.includes("fields=id,name&")), true);
    assert.equal(patches[0].can_publish, true);
});

test("check-page does not overwrite stored permissions when Facebook is unreachable", async () => {
    const originalFetch = globalThis.fetch;
    const encrypted = await encryptSecret("page-token-secret", encryptionKey);
    let patched = false;
    globalThis.fetch = async (input, options = {}) => {
        const url = String(input);
        if (url.endsWith("/auth/v1/user")) return Response.json({ id: "admin-user" });
        if (url.includes("/rest/v1/profiles?select=id,role,status")) {
            return Response.json([{ id: "admin-user", role: "USER", status: "active" }]);
        }
        if (url.includes("/rest/v1/studio_medsos_access?")) {
            return Response.json([{
                user_id: "admin-user",
                is_active: true,
                duration_days: 30,
                started_at: new Date(Date.now() - 60_000).toISOString(),
                expires_at: new Date(Date.now() + 86_400_000).toISOString()
            }]);
        }
        if (url.includes("/rest/v1/social_page_connections?")) {
            if (options.method === "PATCH") patched = true;
            return Response.json([{
                id: "connection-1",
                page_id: "page-123",
                page_name: "GEN-Z Page",
                can_publish: true,
                page_tasks: ["CREATE_CONTENT"],
                page_token_ciphertext: encrypted.ciphertext,
                page_token_iv: encrypted.iv
            }]);
        }
        throw new Error("network down");
    };

    const response = makeResponse();
    try {
        await socialPublisherHandler({
            method: "POST",
            url: "/api/social-publisher?action=check-page",
            query: { action: "check-page" },
            headers: { authorization: "Bearer test-token" },
            body: { id: "connection-1" },
            env
        }, response);
    } finally {
        globalThis.fetch = originalFetch;
    }

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.code, "facebook_unreachable");
    assert.equal(response.body.can_publish, false);
    assert.equal(patched, false, "a transient network failure must not clear stored permissions");
});

test("check-page keeps publishing enabled when Facebook refuses to expose Page tasks", async () => {
    const { response, patches } = await runCheckPage(async (url) => {
        if (url.includes("/debug_token?")) return Response.json({ data: { is_valid: true, type: "PAGE" } });
        if (url.includes("tasks")) {
            return Response.json(
                { error: { message: "(#200) Permissions error", type: "OAuthException", code: 200 } },
                { status: 403 }
            );
        }
        return Response.json({ id: "page-123", name: "GEN-Z Page" });
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.can_publish, true);
    assert.equal(response.body.tasks_read, false);
    assert.match(response.body.message, /belum dapat dipastikan/);
    assert.deepEqual(response.body.connection.page_tasks, ["CREATE_CONTENT"]);
    assert.equal(patches[0].can_publish, true);
});
