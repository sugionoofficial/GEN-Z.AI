import test from "node:test";
import assert from "node:assert/strict";
import socialPublisherHandler from "../api/social-publisher.js";
import { encryptSecret } from "../lib/social-publisher/providers.js";

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
            return Response.json([{
                price_daily_idr: 5000,
                price_weekly_idr: 25000,
                price_monthly_idr: 50000,
                price_yearly_idr: 500000,
                updated_at: "2026-10-20T00:00:00.000Z"
            }]);
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
        assert.deepEqual(
            [
                response.body.pricing.price_daily_idr,
                response.body.pricing.price_weekly_idr,
                response.body.pricing.price_monthly_idr,
                response.body.pricing.price_yearly_idr
            ],
            [5000, 25000, 50000, 500000]
        );
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
            assert.equal(payload.price_daily_idr, 5000);
            assert.equal(payload.price_weekly_idr, 25000);
            assert.equal(payload.price_monthly_idr, 50000);
            assert.equal(payload.price_yearly_idr, 500000);
            assert.equal(payload.price_idr, 50000);
            assert.equal(payload.updated_by, "admin-user");
            return Response.json([{
                price_daily_idr: payload.price_daily_idr,
                price_weekly_idr: payload.price_weekly_idr,
                price_monthly_idr: payload.price_monthly_idr,
                price_yearly_idr: payload.price_yearly_idr,
                updated_at: payload.updated_at
            }], { status: 201 });
        }
    );
    const response = makeResponse();
    try {
        await socialPublisherHandler({
            method: "POST",
            url: "/api/social-publisher?action=studio-admin-save-price",
            query: { action: "studio-admin-save-price" },
            headers: { authorization: "Bearer test-token" },
            body: {
                price_daily_idr: 5000,
                price_weekly_idr: 25000,
                price_monthly_idr: 50000,
                price_yearly_idr: 500000
            },
            env
        }, response);

        assert.equal(response.statusCode, 200);
        assert.equal(response.body.pricing.price_monthly_idr, 50000);
        assert.equal(response.body.pricing.price_yearly_idr, 500000);
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
            body: {
                price_daily_idr: -1,
                price_weekly_idr: null,
                price_monthly_idr: null,
                price_yearly_idr: null
            },
            env
        }, response);

        assert.equal(response.statusCode, 400);
        assert.match(response.body.error, /bilangan bulat Rupiah/);
        assert.equal(wrote, false);
    } finally {
        restoreFetch();
    }
});

test("Studio Medsos admin can leave individual subscription periods unset", async () => {
    const restoreFetch = mockAuthAndFetch(
        { id: "admin-user", role: "ADMIN", status: "active" },
        async (url, options) => {
            assert.match(url, /\/rest\/v1\/studio_medsos_pricing\?/);
            const payload = JSON.parse(options.body);
            assert.equal(payload.price_daily_idr, null);
            assert.equal(payload.price_weekly_idr, null);
            assert.equal(payload.price_monthly_idr, 50000);
            assert.equal(payload.price_yearly_idr, null);
            return Response.json([{
                price_daily_idr: null,
                price_weekly_idr: null,
                price_monthly_idr: 50000,
                price_yearly_idr: null,
                updated_at: payload.updated_at
            }], { status: 201 });
        }
    );
    const response = makeResponse();
    try {
        await socialPublisherHandler({
            method: "POST",
            url: "/api/social-publisher?action=studio-admin-save-price",
            query: { action: "studio-admin-save-price" },
            headers: { authorization: "Bearer test-token" },
            body: {
                price_daily_idr: null,
                price_weekly_idr: null,
                price_monthly_idr: 50000,
                price_yearly_idr: null
            },
            env
        }, response);

        assert.equal(response.statusCode, 200);
        assert.equal(response.body.pricing.price_daily_idr, null);
        assert.equal(response.body.pricing.price_monthly_idr, 50000);
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
            body: {
                price_daily_idr: 5000,
                price_weekly_idr: 25000,
                price_monthly_idr: 50000,
                price_yearly_idr: 500000
            },
            env
        }, response);

        assert.equal(response.statusCode, 403);
        assert.equal(wrote, false);
    } finally {
        restoreFetch();
    }
});

test("Studio Medsos admin can select Cloudflare image generation", async () => {
    const restoreFetch = mockAuthAndFetch(
        { id: "admin-user", role: "ADMIN", status: "active" },
        async (url, options = {}) => {
            assert.match(url, /\/rest\/v1\/social_publisher_config\?on_conflict=id/);
            assert.equal(options.method, "POST");
            const payload = JSON.parse(options.body);
            assert.equal(payload.image_provider, "cloudflare");
            assert.equal(payload.updated_by, "admin-user");
            assert.equal(Object.hasOwn(payload, "global_enabled"), false);
            return Response.json([{
                id: true,
                image_provider: payload.image_provider,
                updated_at: payload.updated_at
            }], { status: 201 });
        }
    );
    const response = makeResponse();
    try {
        await socialPublisherHandler({
            method: "POST",
            url: "/api/social-publisher?action=studio-admin-image-provider",
            query: { action: "studio-admin-image-provider" },
            headers: { authorization: "Bearer test-token" },
            body: { image_provider: "cloudflare" },
            env: {
                ...env,
                GEMINI_API_KEY: "caption-api-key",
                AI: { run: async () => new Uint8Array([1]) }
            }
        }, response);
        assert.equal(response.statusCode, 200);
        assert.equal(response.body.settings.image_provider, "cloudflare");
        assert.equal(response.body.settings.cloudflare_configured, true);
    } finally {
        restoreFetch();
    }
});

test("Studio Medsos image provider settings reject non-admin users", async () => {
    let requested = false;
    const restoreFetch = mockAuthAndFetch(
        { id: "user-id", role: "USER", status: "active" },
        async () => {
            requested = true;
            throw new Error("Image provider settings must not be queried for non-admins.");
        }
    );
    const response = makeResponse();
    try {
        await socialPublisherHandler({
            method: "GET",
            url: "/api/social-publisher?action=studio-admin-image-provider",
            query: { action: "studio-admin-image-provider" },
            headers: { authorization: "Bearer test-token" },
            env
        }, response);
        assert.equal(response.statusCode, 403);
        assert.equal(requested, false);
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

test("Legacy manual immediate-publish action is not exposed", async () => {
    const encryptionKey = btoa(String.fromCharCode(...new Uint8Array(32).fill(7)));
    const encryptedToken = await encryptSecret("page-token-secret", encryptionKey);
    const originalFetch = globalThis.fetch;
    const calls = [];
    const startedAt = new Date(Date.now() - 60_000).toISOString();
    const expiresAt = new Date(Date.now() + 86_400_000).toISOString();
    globalThis.fetch = async (input, options = {}) => {
        const url = String(input);
        calls.push({ url, options });
        if (url.endsWith("/auth/v1/user")) return Response.json({ id: "admin-user" });
        if (url.includes("/rest/v1/profiles?select=id,role,status")) {
            return Response.json([{ id: "admin-user", role: "USER", status: "active" }]);
        }
        if (url.includes("/rest/v1/studio_medsos_access?")) {
            return Response.json([{
                user_id: "admin-user",
                is_active: true,
                duration_days: 30,
                started_at: startedAt,
                expires_at: expiresAt
            }]);
        }
        if (url.endsWith("/storage/v1/bucket/social-character-references")) {
            return Response.json({ id: "social-character-references", public: false });
        }
        if (url.includes("/rest/v1/social_characters?")) {
            return Response.json([{
                id: "character-1",
                owner_id: "admin-user",
                display_name: "Alya",
                reference_object_key: "social-reference/admin-user/reference.jpg",
                reference_mime_type: "image/jpeg",
                prompt_notes: "Rambut bob"
            }]);
        }
        if (url.includes("/rest/v1/social_page_connections?")) {
            return Response.json([{
                id: "connection-1",
                owner_id: "admin-user",
                page_id: "page-123",
                page_name: "GEN-Z Page",
                can_publish: true,
                page_token_ciphertext: encryptedToken.ciphertext,
                page_token_iv: encryptedToken.iv
            }]);
        }
        if (url.includes("/rest/v1/social_post_runs?") && options.method === "POST") {
            const run = JSON.parse(options.body);
            assert.equal(run.schedule_id, null);
            assert.equal(run.status, "generating");
            return Response.json([{ id: "manual-run-1", ...run }], { status: 201 });
        }
        if (url.includes("/storage/v1/object/authenticated/social-character-references/")) {
            return new Response(new Uint8Array([255, 216, 255, 0]), { status: 200 });
        }
        if (url.includes("generativelanguage.googleapis.com/v1beta/interactions")) {
            assert.equal(options.method, "POST");
            return Response.json({
                steps: [{
                    type: "model_output",
                    content: [{ type: "image", mime_type: "image/png", data: btoa(String.fromCharCode(137, 80, 78, 71)) }]
                }]
            });
        }
        if (url.endsWith("/page-123/photos")) {
            assert.equal(options.method, "POST");
            assert.equal(options.body.get("access_token"), "page-token-secret");
            return Response.json({ id: "photo-1", post_id: "page-123_post-1" });
        }
        if (url.includes("/page-123_post-1?fields=permalink_url")) {
            return Response.json({ permalink_url: "https://www.facebook.com/page-123/posts/post-1" });
        }
        if (url.includes("/rest/v1/social_post_runs?id=eq.manual-run-1")) {
            assert.equal(options.method, "PATCH");
            const update = JSON.parse(options.body);
            assert.equal(update.status, "posted");
            assert.equal(update.caption, "Alya di");
            return new Response(null, { status: 204 });
        }
        throw new Error(`Unexpected fetch: ${url}`);
    };

    const response = makeResponse();
    try {
        await socialPublisherHandler({
            method: "POST",
            url: "/api/social-publisher?action=manual-post",
            query: { action: "manual-post" },
            headers: { authorization: "Bearer test-token" },
            body: {
                character_id: "character-1",
                page_connection_id: "connection-1",
                caption_template: "{name} di"
            },
            env: {
                ...env,
                GEMINI_API_KEY: "gemini-test-key",
                SOCIAL_TOKEN_ENCRYPTION_KEY: encryptionKey
            }
        }, response);

        assert.equal(response.statusCode, 404);
        assert.match(response.body.error, /Action tidak dikenal/);
        assert.equal(calls.filter(call => call.url.endsWith("/page-123/photos")).length, 0);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("Manual Social Publisher uses the selected Cloudflare provider and returns a preview", async () => {
    const originalFetch = globalThis.fetch;
    const pngBytes = new Uint8Array([
        137, 80, 78, 71, 13, 10, 26, 10,
        0, 0, 0, 0, 73, 72, 68, 82, 0, 0, 0, 0,
        0, 0, 0, 0, 73, 69, 78, 68, 0, 0, 0, 0
    ]);
    const now = Date.now();
    let imageRequests = 0;
    let publishRequests = 0;
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
                started_at: new Date(now - 60_000).toISOString(),
                expires_at: new Date(now + 86_400_000).toISOString()
            }]);
        }
        if (url.endsWith("/storage/v1/bucket/social-character-references")) {
            return Response.json({ id: "social-character-references", public: false });
        }
        if (url.includes("/rest/v1/social_characters?")) {
            return Response.json([{
                id: "character-1",
                display_name: "Alya",
                reference_object_key: "social-reference/admin-user/reference.jpg",
                reference_mime_type: "image/jpeg",
                prompt_notes: "Rambut bob"
            }]);
        }
        if (url.includes("/rest/v1/social_page_connections?")) {
            return Response.json([{ id: "connection-1", page_name: "GEN-Z Page", can_publish: true }]);
        }
        if (url.includes("/rest/v1/social_publisher_config?select=image_provider")) {
            return Response.json([{ image_provider: "cloudflare" }]);
        }
        if (url.includes("/rest/v1/social_publisher_user_settings?")) {
            return Response.json([{ caption_template: "Cerita hari ini #GENZAI", external_link: "https://example.com" }]);
        }
        if (url.includes("/rest/v1/social_post_runs?select=id&status=eq.generating")) return Response.json([]);
        if (url.includes("/rest/v1/social_post_runs?") && options.method === "POST") {
            return Response.json([{ id: "manual-run-1" }], { status: 201 });
        }
        if (url.includes("/storage/v1/object/authenticated/social-character-references/")) {
            return new Response(new Uint8Array([255, 216, 255, 0]), { status: 200 });
        }
        if (url.includes("generativelanguage.googleapis.com/v1beta/interactions")) {
            assert.fail("Image generation should use the selected Cloudflare provider.");
        }
        if (url.includes("gemini-2.5-flash:generateContent")) {
            imageRequests += 1;
            return Response.json({
                candidates: [{ content: { parts: [{ text: "Hai guys, lagi menikmati suasana sore." }] } }]
            });
        }
        if (url.includes("/rest/v1/social_post_runs?id=eq.manual-run-1")) {
            const update = JSON.parse(options.body);
            assert.equal(update.status, "generating");
            assert.match(update.caption, /Hai guys/);
            assert.match(update.caption, /https:\/\/example\.com/);
            assert.match(update.caption, /#GENZAI/);
            return new Response(null, { status: 204 });
        }
        if (url.includes("/page-123/photos")) publishRequests += 1;
        throw new Error(`Unexpected fetch: ${url}`);
    };

    const response = makeResponse();
    try {
        await socialPublisherHandler({
            method: "POST",
            url: "/api/social-publisher?action=manual-generate",
            query: { action: "manual-generate" },
            headers: { authorization: "Bearer test-token" },
            body: {
                character_id: "character-1",
                page_connection_id: "connection-1",
                aspect_ratio: "16:9"
            },
            env: {
                ...env,
                GEMINI_API_KEY: "gemini-test-key",
                SOCIAL_TOKEN_ENCRYPTION_KEY: btoa(String.fromCharCode(...new Uint8Array(32).fill(7))),
                AI: {
                    async run(model, input) {
                        assert.equal(model, "@cf/black-forest-labs/flux-2-klein-4b");
                        assert.match(input.multipart.contentType, /^multipart\/form-data;\s*boundary=.+$/);
                        return { image: pngBytes };
                    }
                }
            }
        }, response);

        assert.equal(response.statusCode, 200, JSON.stringify(response.body));
        assert.equal(response.body.preview.status, "preview");
        assert.equal(response.body.preview.aspect_ratio, "16:9");
        assert.equal(response.body.preview.page_name, "GEN-Z Page");
        assert.match(response.body.preview.caption, /Hai guys/);
        assert.equal(imageRequests, 1);
        assert.equal(publishRequests, 0);
    } finally {
        globalThis.fetch = originalFetch;
    }
});
