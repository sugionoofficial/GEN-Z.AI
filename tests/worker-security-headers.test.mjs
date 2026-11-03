import test from "node:test";
import assert from "node:assert/strict";
import worker from "../functions/worker.mjs";

const TEST_ENV = {
    SUPABASE_URL: "https://mockproject.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "mock-service-role-key",
    SUPABASE_ANON_KEY: "mock-anon-key"
};

test("worker.fetch: menerapkan header keamanan standar pada respons API", async () => {
    const req = new Request("https://gen-z.ai/api/model-config?model_id=unknown-model", {
        method: "GET"
    });
    const res = await worker.fetch(req, TEST_ENV);

    assert.equal(res.headers.get("x-content-type-options"), "nosniff");
    assert.equal(res.headers.get("x-frame-options"), "SAMEORIGIN");
    assert.equal(res.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
    assert.match(res.headers.get("permissions-policy") || "", /camera=\(\)/);
    assert.match(res.headers.get("cache-control") || "", /no-store/);
});

test("worker.fetch: menerapkan header keamanan pada rute 404 API", async () => {
    const req = new Request("https://gen-z.ai/api/non-existent-endpoint", {
        method: "GET"
    });
    const res = await worker.fetch(req, TEST_ENV);

    assert.equal(res.status, 404);
    assert.equal(res.headers.get("x-content-type-options"), "nosniff");
    assert.equal(res.headers.get("x-frame-options"), "SAMEORIGIN");
});

test("worker.fetch: menerapkan rate limit edge jika IP membanjiri API", async () => {
    let lastRes;
    const floodIp = "203.0.113.199";

    for (let i = 0; i < 305; i++) {
        const req = new Request("https://gen-z.ai/api/model-config?model_id=test-flood", {
            method: "GET",
            headers: {
                "cf-connecting-ip": floodIp
            }
        });
        lastRes = await worker.fetch(req, TEST_ENV);
    }

    assert.equal(lastRes.status, 429);
    const data = await lastRes.json();
    assert.match(data.error, /Too many requests/i);
    assert.equal(lastRes.headers.get("retry-after"), "60");
    assert.equal(lastRes.headers.get("x-content-type-options"), "nosniff");
});
