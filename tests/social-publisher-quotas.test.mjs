import test from "node:test";
import assert from "node:assert/strict";
import {
    getModelQuotas,
    isQuotaErrorMessage,
    normalizeQwenCloudImageModel,
    QWENCLOUD_IMAGE_MODELS,
    quotaPercentAvailable,
    recordModelUsage,
    resetModelQuota,
    setModelQuotaLimit
} from "../lib/social-publisher/quotas.js";

const config = { url: "https://project.example", serviceRoleKey: "server-only-test-key" };

function captureFetch(handler) {
    const calls = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, options = {}) => {
        const url = String(input);
        calls.push({ url, options });
        return handler(url, options);
    };
    return { calls, restore: () => { globalThis.fetch = originalFetch; } };
}

test("normalizeQwenCloudImageModel falls back to the default model", () => {
    assert.equal(normalizeQwenCloudImageModel("qwen-image-edit-max"), "qwen-image-edit-max");
    assert.equal(normalizeQwenCloudImageModel("tidak-ada"), "qwen-image-3.0-pro");
    assert.equal(normalizeQwenCloudImageModel(""), "qwen-image-3.0-pro");
    assert.ok(QWENCLOUD_IMAGE_MODELS.length >= 3);
});

test("isQuotaErrorMessage recognizes QwenCloud quota failures", () => {
    assert.equal(isQuotaErrorMessage("AllocationQuota.FreeTierOnly"), true);
    assert.equal(isQuotaErrorMessage("Allocated quota exceeded"), true);
    assert.equal(isQuotaErrorMessage("You exceeded your current quota"), true);
    assert.equal(isQuotaErrorMessage("Invalid API key provided."), false);
});

test("quotaPercentAvailable computes remaining tier percentage", () => {
    assert.equal(quotaPercentAvailable({ exhausted: false, requests_used: 20, quota_limit: 100 }), 80);
    assert.equal(quotaPercentAvailable({ exhausted: false, requests_used: 120, quota_limit: 100 }), 0);
    assert.equal(quotaPercentAvailable({ exhausted: true, requests_used: 1, quota_limit: 100 }), 0);
    assert.equal(quotaPercentAvailable({ exhausted: false, requests_used: 5, quota_limit: 0 }), null);
    assert.equal(quotaPercentAvailable(null), null);
});

test("recordModelUsage creates then increments the ledger and flags quota errors", async () => {
    let row = null;
    const { calls, restore } = captureFetch((url, options) => {
        if (options.method === "POST") {
            row = JSON.parse(options.body);
            return Response.json([]);
        }
        if (options.method === "PATCH") {
            row = { ...row, ...JSON.parse(options.body) };
            return Response.json([]);
        }
        return Response.json(row ? [row] : []);
    });
    try {
        await recordModelUsage(config, "qwen-image-3.0-pro");
        assert.match(calls[0].url, /social_publisher_model_quotas\?select=model,requests_used,exhausted&model=eq.qwen-image-3\.0-pro/);
        assert.equal(calls[1].options.method, "POST");
        assert.equal(row.requests_used, 1);
        assert.equal(row.exhausted, false);

        await recordModelUsage(config, "qwen-image-3.0-pro");
        assert.equal(calls[3].options.method, "PATCH");
        assert.equal(row.requests_used, 2);

        await recordModelUsage(config, "qwen-image-3.0-pro", { quotaError: true, message: "AllocationQuota.FreeTierOnly" });
        assert.equal(row.exhausted, true);
        assert.equal(row.requests_used, 2);
        assert.match(row.last_status, /FreeTierOnly/);

        await recordModelUsage(config, "qwen-image-3.0-pro");
        assert.equal(row.exhausted, false);
        assert.equal(row.requests_used, 3);
    } finally {
        restore();
    }
});

test("setModelQuotaLimit validates and upserts the tier limit", async () => {
    const { calls, restore } = captureFetch(() => Response.json([{ model: "qwen-image-edit-max" }]));
    try {
        await assert.rejects(
            setModelQuotaLimit(config, "qwen-image-edit-max", -5),
            /Batas tier harus berupa bilangan bulat/
        );
        await setModelQuotaLimit(config, "qwen-image-edit-max", 500);
        const upsert = calls.find(call => call.options.method === "POST");
        assert.match(upsert.url, /on_conflict=model/);
        assert.match(upsert.options.headers.Prefer, /merge-duplicates/);
        assert.equal(JSON.parse(upsert.options.body).quota_limit, 500);
    } finally {
        restore();
    }
});

test("resetModelQuota patches counters back to zero", async () => {
    const { calls, restore } = captureFetch(() => Response.json([{ model: "qwen-image-3.0" }]));
    try {
        await resetModelQuota(config, "qwen-image-3.0");
        const patch = calls.find(call => call.options.method === "PATCH");
        const body = JSON.parse(patch.options.body);
        assert.equal(body.requests_used, 0);
        assert.equal(body.exhausted, false);
    } finally {
        restore();
    }
});

test("getModelQuotas returns a map keyed by model", async () => {
    const { restore } = captureFetch(() => Response.json([
        { model: "qwen-image-3.0-pro", requests_used: 4, quota_limit: 10, exhausted: false, last_status: "ok" }
    ]));
    try {
        const quotas = await getModelQuotas(config);
        assert.equal(quotas.get("qwen-image-3.0-pro").requests_used, 4);
        assert.equal(quotaPercentAvailable(quotas.get("qwen-image-3.0-pro")), 60);
    } finally {
        restore();
    }
});
