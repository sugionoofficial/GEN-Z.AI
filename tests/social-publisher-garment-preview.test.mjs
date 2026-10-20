import test from "node:test";
import assert from "node:assert/strict";
import socialPublisherHandler from "../api/social-publisher.js";

const env = {
    SUPABASE_URL: "https://project.example",
    SUPABASE_SERVICE_ROLE_KEY: "server-only-test-key",
    SUPABASE_ANON_KEY: "anon-test-key"
};

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

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

function mockAuthAndFetch(fetchHandler) {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, options = {}) => {
        const url = String(input);
        if (url.endsWith("/auth/v1/user")) return Response.json({ id: "owner-1" });
        if (url.includes("/rest/v1/profiles?select=id,role,status")) {
            return Response.json([{ id: "owner-1", role: "OWNER", status: "active" }]);
        }
        return fetchHandler(url, options);
    };
    return () => {
        globalThis.fetch = originalFetch;
    };
}

function activeAccessRow() {
    return Response.json([{
        user_id: "owner-1",
        is_active: true,
        duration_days: 30,
        started_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
        expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString()
    }]);
}

function garmentFetchHandler(characterRow) {
    return async url => {
        if (url.includes("/rest/v1/studio_medsos_access?")) return activeAccessRow();
        if (url.includes("/rest/v1/social_characters?select=garment_object_key,garment_mime_type")) {
            return Response.json(characterRow);
        }
        if (url.includes("/storage/v1/bucket/social-character-references")) {
            return Response.json({ id: "social-character-references", public: false });
        }
        if (url.includes("/storage/v1/object/authenticated/social-character-references/social-garment/owner-1/garment.png")) {
            return new Response(PNG_BYTES);
        }
        throw new Error(`Unexpected fetch: ${url}`);
    };
}

test("garment action streams the private garment object to the owner", async () => {
    const restoreFetch = mockAuthAndFetch(garmentFetchHandler([
        { garment_object_key: "social-garment/owner-1/garment.png", garment_mime_type: "image/png" }
    ]));
    const response = makeResponse();
    try {
        await socialPublisherHandler({
            method: "GET",
            url: "/api/social-publisher?action=garment&character_id=char-1",
            query: { action: "garment", character_id: "char-1" },
            headers: { authorization: "Bearer test-token" },
            env
        }, response);

        assert.equal(response.statusCode, 200);
        assert.equal(response.headers["Content-Type"], "image/png");
        assert.equal(response.headers["Cache-Control"], "private, no-store");
        assert.deepEqual(new Uint8Array(response.body), PNG_BYTES);
    } finally {
        restoreFetch();
    }
});

test("garment action returns 404 when the character has no garment yet", async () => {
    const restoreFetch = mockAuthAndFetch(garmentFetchHandler([
        { garment_object_key: null, garment_mime_type: null }
    ]));
    const response = makeResponse();
    try {
        await socialPublisherHandler({
            method: "GET",
            url: "/api/social-publisher?action=garment&character_id=char-1",
            query: { action: "garment", character_id: "char-1" },
            headers: { authorization: "Bearer test-token" },
            env
        }, response);

        assert.equal(response.statusCode, 404);
        assert.match(response.body.error, /belum memiliki foto pakaian/);
    } finally {
        restoreFetch();
    }
});

test("garment action requires a character id", async () => {
    const restoreFetch = mockAuthAndFetch(async url => {
        if (url.includes("/rest/v1/studio_medsos_access?")) return activeAccessRow();
        throw new Error(`Unexpected fetch: ${url}`);
    });
    const response = makeResponse();
    try {
        await socialPublisherHandler({
            method: "GET",
            url: "/api/social-publisher?action=garment",
            query: { action: "garment" },
            headers: { authorization: "Bearer test-token" },
            env
        }, response);

        assert.equal(response.statusCode, 400);
        assert.match(response.body.error, /ID karakter wajib diisi/);
    } finally {
        restoreFetch();
    }
});
