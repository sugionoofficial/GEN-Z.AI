import test from "node:test";
import assert from "node:assert/strict";
import socialPublisherHandler from "../api/social-publisher.js";

const env = {
    SUPABASE_URL: "https://project.example",
    SUPABASE_SERVICE_ROLE_KEY: "server-only-test-key",
    SUPABASE_ANON_KEY: "anon-test-key"
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

function mockAuthAndFetch(profile, fetchHandler) {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, options = {}) => {
        const url = String(input);
        if (url.endsWith("/auth/v1/user")) return Response.json({ id: "admin-user" });
        if (url.includes("/rest/v1/profiles?select=id,role,status")) {
            return Response.json([profile]);
        }
        return fetchHandler(url, options);
    };
    return () => {
        globalThis.fetch = originalFetch;
    };
}

test("Studio Medsos admin user list includes each profile's subscription record", async () => {
    const restoreFetch = mockAuthAndFetch(
        { id: "admin-user", role: "ADMIN", status: "active" },
        async url => {
            if (url.includes("/rest/v1/profiles?select=id,email,name,role,status")) {
                return Response.json([
                    { id: "user-1", email: "user@example.com", role: "USER", status: "active" }
                ]);
            }
            if (url.includes("/rest/v1/studio_medsos_access?select=user_id")) {
                return Response.json([
                    {
                        user_id: "user-1",
                        is_active: true,
                        duration_days: 30,
                        started_at: "2026-10-20T00:00:00.000Z",
                        expires_at: "2026-11-19T00:00:00.000Z"
                    }
                ]);
            }
            throw new Error(`Unexpected fetch: ${url}`);
        }
    );
    const response = makeResponse();
    try {
        await socialPublisherHandler({
            method: "GET",
            url: "/api/social-publisher?action=studio-admin-users",
            query: { action: "studio-admin-users" },
            headers: { authorization: "Bearer test-token" },
            env
        }, response);

        assert.equal(response.statusCode, 200);
        assert.equal(response.body.users[0].studio_access.is_active, true);
        assert.equal(response.body.users[0].email, "user@example.com");
    } finally {
        restoreFetch();
    }
});

test("Studio Medsos admin user list rejects non-admin profiles", async () => {
    let queried = false;
    const restoreFetch = mockAuthAndFetch(
        { id: "admin-user", role: "USER", status: "active" },
        async url => {
            queried = true;
            throw new Error(`Unexpected fetch: ${url}`);
        }
    );
    const response = makeResponse();
    try {
        await socialPublisherHandler({
            method: "GET",
            url: "/api/social-publisher?action=studio-admin-users",
            query: { action: "studio-admin-users" },
            headers: { authorization: "Bearer test-token" },
            env
        }, response);

        assert.equal(response.statusCode, 403);
        assert.equal(queried, false);
    } finally {
        restoreFetch();
    }
});

test("Studio Medsos admin save validates duration before writing", async () => {
    let wrote = false;
    const restoreFetch = mockAuthAndFetch(
        { id: "admin-user", role: "OWNER", status: "active" },
        async url => {
            wrote = true;
            throw new Error(`Unexpected fetch: ${url}`);
        }
    );
    const response = makeResponse();
    try {
        await socialPublisherHandler({
            method: "POST",
            url: "/api/social-publisher?action=studio-admin-save",
            query: { action: "studio-admin-save" },
            headers: { authorization: "Bearer test-token" },
            body: {
                user_id: "123e4567-e89b-42d3-a456-426614174000",
                is_active: true,
                duration_days: 366,
                started_at: "2026-10-20T00:00:00.000Z"
            },
            env
        }, response);

        assert.equal(response.statusCode, 400);
        assert.match(response.body.error, /1 dan 365/);
        assert.equal(wrote, false);
    } finally {
        restoreFetch();
    }
});

test("Studio Medsos admin can save a user's subscription in Supabase", async () => {
    const restoreFetch = mockAuthAndFetch(
        { id: "admin-user", role: "ADMIN", status: "active" },
        async (url, options) => {
            assert.match(url, /\/rest\/v1\/studio_medsos_access\?/);
            assert.equal(options.method, "POST");
            const payload = JSON.parse(options.body);
            assert.equal(payload.user_id, "123e4567-e89b-42d3-a456-426614174000");
            assert.equal(payload.is_active, true);
            assert.equal(payload.duration_days, 2);
            assert.equal(payload.updated_by, "admin-user");
            return Response.json([{
                user_id: payload.user_id,
                is_active: payload.is_active,
                duration_days: payload.duration_days,
                started_at: payload.started_at,
                expires_at: "2026-10-22T00:00:00.000Z"
            }], { status: 201 });
        }
    );
    const response = makeResponse();
    try {
        await socialPublisherHandler({
            method: "POST",
            url: "/api/social-publisher?action=studio-admin-save",
            query: { action: "studio-admin-save" },
            headers: { authorization: "Bearer test-token" },
            body: {
                user_id: "123e4567-e89b-42d3-a456-426614174000",
                is_active: true,
                duration_days: 2,
                started_at: "2026-10-20T00:00:00.000Z"
            },
            env
        }, response);

        assert.equal(response.statusCode, 200);
        assert.equal(response.body.access.duration_days, 2);
    } finally {
        restoreFetch();
    }
});
