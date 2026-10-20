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

test("Studio Medsos pricing is available to an authenticated user without an active subscription", async () => {
    const restoreFetch = mockAuthAndFetch(
        { id: "admin-user", role: "USER", status: "active" },
        async url => {
            assert.match(url, /\/rest\/v1\/studio_medsos_pricing\?/);
            return Response.json([{ price_idr: 50000, updated_at: "2026-10-20T00:00:00.000Z" }]);
        }
    );
    const response = makeResponse();
    try {
        await socialPublisherHandler({
            method: "GET",
            url: "/api/social-publisher?action=studio-pricing",
            query: { action: "studio-pricing" },
            headers: { authorization: "Bearer test-token" },
            env
        }, response);

        assert.equal(response.statusCode, 200);
        assert.equal(response.body.pricing.price_idr, 50000);
    } finally {
        restoreFetch();
    }
});

test("Studio Medsos admin can save the public subscription price", async () => {
    const restoreFetch = mockAuthAndFetch(
        { id: "admin-user", role: "ADMIN", status: "active" },
        async (url, options) => {
            assert.match(url, /\/rest\/v1\/studio_medsos_pricing\?/);
            assert.equal(options.method, "POST");
            const payload = JSON.parse(options.body);
            assert.equal(payload.id, true);
            assert.equal(payload.price_idr, 50000);
            assert.equal(payload.updated_by, "admin-user");
            return Response.json([{ price_idr: payload.price_idr, updated_at: payload.updated_at }], { status: 201 });
        }
    );
    const response = makeResponse();
    try {
        await socialPublisherHandler({
            method: "POST",
            url: "/api/social-publisher?action=studio-admin-save-price",
            query: { action: "studio-admin-save-price" },
            headers: { authorization: "Bearer test-token" },
            body: { price_idr: 50000 },
            env
        }, response);

        assert.equal(response.statusCode, 200);
        assert.equal(response.body.pricing.price_idr, 50000);
    } finally {
        restoreFetch();
    }
});

test("Studio Medsos admin price save rejects negative amounts before writing", async () => {
    let wrote = false;
    const restoreFetch = mockAuthAndFetch(
        { id: "admin-user", role: "OWNER", status: "active" },
        async () => {
            wrote = true;
            throw new Error("Unexpected pricing write");
        }
    );
    const response = makeResponse();
    try {
        await socialPublisherHandler({
            method: "POST",
            url: "/api/social-publisher?action=studio-admin-save-price",
            query: { action: "studio-admin-save-price" },
            headers: { authorization: "Bearer test-token" },
            body: { price_idr: -1 },
            env
        }, response);

        assert.equal(response.statusCode, 400);
        assert.match(response.body.error, /bilangan bulat Rupiah/);
        assert.equal(wrote, false);
    } finally {
        restoreFetch();
    }
});

test("Studio Medsos price save rejects non-admin users", async () => {
    let wrote = false;
    const restoreFetch = mockAuthAndFetch(
        { id: "user-id", role: "USER", status: "active" },
        async () => {
            wrote = true;
            throw new Error("Unexpected pricing write");
        }
    );
    const response = makeResponse();
    try {
        await socialPublisherHandler({
            method: "POST",
            url: "/api/social-publisher?action=studio-admin-save-price",
            query: { action: "studio-admin-save-price" },
            headers: { authorization: "Bearer test-token" },
            body: { price_idr: 50000 },
            env
        }, response);

        assert.equal(response.statusCode, 403);
        assert.equal(wrote, false);
    } finally {
        restoreFetch();
    }
});

test("Studio Medsos status endpoint returns the current user's active subscription", async () => {
    const startedAt = new Date(Date.now() - 60_000).toISOString();
    const expiresAt = new Date(Date.now() + 86_400_000).toISOString();
    const restoreFetch = mockAuthAndFetch(
        { id: "admin-user", role: "OWNER", status: "active" },
        async url => {
            assert.match(url, /\/rest\/v1\/studio_medsos_access\?/);
            assert.match(url, /user_id=eq\.admin-user/);
            return Response.json([{
                user_id: "admin-user",
                is_active: true,
                duration_days: 30,
                started_at: startedAt,
                expires_at: expiresAt
            }]);
        }
    );
    const response = makeResponse();
    try {
        await socialPublisherHandler({
            method: "GET",
            url: "/api/social-publisher?action=studio-access-status",
            query: { action: "studio-access-status" },
            headers: { authorization: "Bearer test-token" },
            env
        }, response);

        assert.equal(response.statusCode, 200);
        assert.equal(response.body.access.active, true);
        assert.equal(response.body.access.user_id, "admin-user");
        assert.equal(response.body.access.expires_at, expiresAt);
    } finally {
        restoreFetch();
    }
});

test("Studio Medsos status endpoint does not activate a future subscription early", async () => {
    const startedAt = new Date(Date.now() + 60_000).toISOString();
    const expiresAt = new Date(Date.now() + 86_400_000).toISOString();
    const restoreFetch = mockAuthAndFetch(
        { id: "admin-user", role: "OWNER", status: "active" },
        async () => Response.json([{
            user_id: "admin-user",
            is_active: true,
            duration_days: 1,
            started_at: startedAt,
            expires_at: expiresAt
        }])
    );
    const response = makeResponse();
    try {
        await socialPublisherHandler({
            method: "GET",
            url: "/api/social-publisher?action=studio-access-status",
            query: { action: "studio-access-status" },
            headers: { authorization: "Bearer test-token" },
            env
        }, response);

        assert.equal(response.statusCode, 200);
        assert.equal(response.body.access.active, false);
        assert.equal(response.body.access.pending, true);
    } finally {
        restoreFetch();
    }
});
