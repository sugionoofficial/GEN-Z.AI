import test from "node:test";
import assert from "node:assert/strict";
import handler, { resetSightengineRateLimitsForTests } from "../api/sightengine-detect.js";

function createMockRes() {
    return {
        statusCode: 200,
        headers: {},
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(data) {
            this.body = data;
            return this;
        },
        setHeader(name, value) {
            this.headers[name] = value;
            return this;
        }
    };
}

const TEST_ENV = {
    SUPABASE_URL: "https://mockproject.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "mock-service-role-key",
    SUPABASE_ANON_KEY: "mock-anon-key",
    SIGHTENGINE_API_USER: "test_api_user",
    SIGHTENGINE_API_SECRET: "test_api_secret"
};

const SAMPLE_BASE64_JPEG =
    "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";

test("POST /api/sightengine-detect: menolak method selain POST dengan 405", async () => {
    const res = createMockRes();
    await handler({ method: "GET" }, res);
    assert.equal(res.statusCode, 405);
    assert.equal(res.body.success, false);
});

test("POST /api/sightengine-detect: menolak request tanpa token autentikasi dengan 401", async () => {
    const res = createMockRes();
    await handler(
        {
            method: "POST",
            headers: {},
            body: { image: SAMPLE_BASE64_JPEG },
            env: TEST_ENV
        },
        res
    );
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.success, false);
    assert.match(res.body.error, /Sesi login diperlukan/i);
});

test("POST /api/sightengine-detect: menolak request dengan token invalid/expired dengan 401", async () => {
    const res = createMockRes();
    await handler(
        {
            method: "POST",
            headers: {
                authorization: "Bearer invalid_expired_jwt"
            },
            body: { image: SAMPLE_BASE64_JPEG },
            env: TEST_ENV,
            fetchImpl: async (url) => {
                if (url.includes("/auth/v1/user")) {
                    return new Response(JSON.stringify({ error: "invalid token" }), { status: 401 });
                }
                throw new Error(`Unexpected url: ${url}`);
            }
        },
        res
    );
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.success, false);
    assert.match(res.body.error, /kedaluwarsa atau tidak valid/i);
});

test("POST /api/sightengine-detect: menolak image kosong atau tipe data tidak valid dengan 400", async () => {
    const res = createMockRes();
    await handler(
        {
            method: "POST",
            headers: {
                authorization: "Bearer valid_jwt"
            },
            body: { image: "" },
            env: TEST_ENV,
            fetchImpl: async (url) => {
                if (url.includes("/auth/v1/user")) {
                    return new Response(JSON.stringify({ id: "user-123", email: "test@example.com" }), { status: 200 });
                }
                throw new Error(`Unexpected url: ${url}`);
            }
        },
        res
    );
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.error, /Image data is required/i);
});

test("POST /api/sightengine-detect: menolak tipe media selain image dengan 400", async () => {
    const res = createMockRes();
    await handler(
        {
            method: "POST",
            headers: {
                authorization: "Bearer valid_jwt"
            },
            body: { image: "data:application/pdf;base64,JVBERi0xLjQK" },
            env: TEST_ENV,
            fetchImpl: async (url) => {
                if (url.includes("/auth/v1/user")) {
                    return new Response(JSON.stringify({ id: "user-123", email: "test@example.com" }), { status: 200 });
                }
                throw new Error(`Unexpected url: ${url}`);
            }
        },
        res
    );
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.error, /Unsupported image type/i);
});

test("POST /api/sightengine-detect: membatasi laju request (rate limit 15 req/min) dengan 429", async () => {
    resetSightengineRateLimitsForTests();
    const mockAuthFetch = async (url) => {
        if (url.includes("/auth/v1/user")) {
            return new Response(JSON.stringify({ id: "flooding-user", email: "flooder@example.com" }), { status: 200 });
        }
        if (url.includes("sightengine.com")) {
            return new Response(
                JSON.stringify({
                    status: "success",
                    type: { genai: 0.1 },
                    face: { manipulation: 0.05 }
                }),
                { status: 200 }
            );
        }
        throw new Error(`Unexpected url: ${url}`);
    };

    let lastRes;
    for (let i = 0; i < 16; i++) {
        lastRes = createMockRes();
        await handler(
            {
                method: "POST",
                headers: {
                    authorization: "Bearer valid_jwt",
                    "cf-connecting-ip": "1.2.3.4"
                },
                body: { image: SAMPLE_BASE64_JPEG },
                env: TEST_ENV,
                fetchImpl: mockAuthFetch
            },
            lastRes
        );
    }

    assert.equal(lastRes.statusCode, 429);
    assert.equal(lastRes.body.success, false);
    assert.equal(lastRes.body.code, "RATE_LIMITED");
});

test("POST /api/sightengine-detect: memproses deteksi AI dengan benar untuk user terotentikasi", async () => {
    resetSightengineRateLimitsForTests();
    const res = createMockRes();
    let sightengineCalled = false;

    await handler(
        {
            method: "POST",
            headers: {
                authorization: "Bearer valid_jwt",
                "cf-connecting-ip": "103.20.30.40"
            },
            body: { image: SAMPLE_BASE64_JPEG },
            env: TEST_ENV,
            fetchImpl: async (url, options = {}) => {
                if (url.includes("/auth/v1/user")) {
                    return new Response(JSON.stringify({ id: "valid-user-99", email: "kreator@example.com" }), { status: 200 });
                }
                if (url.includes("sightengine.com")) {
                    sightengineCalled = true;
                    return new Response(
                        JSON.stringify({
                            status: "success",
                            request: { id: "req_123", timestamp: 123456789 },
                            media: { id: "med_123", uri: "upload" },
                            type: {
                                ai_generated: 0.85,
                                genai_details: { midjourney: 0.8, dall_e: 0.05 }
                            },
                            face: {},
                            type_details: {},
                            deepfake: 0.12
                        }),
                        { status: 200 }
                    );
                }
                throw new Error(`Unexpected url: ${url}`);
            }
        },
        res
    );

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(sightengineCalled, true);
    assert.equal(res.body.provider, "sightengine");
    assert.equal(res.body.detection.is_ai_generated, true);
    assert.equal(res.body.detection.ai_generated, 0.85);
});
