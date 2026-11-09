import test from "node:test";
import assert from "node:assert/strict";
import { createOpenClipsMarketplaceTask, getOpenClipsMarketplaceTask } from "../provider/openclips/client.js";
import { OpenClipsRestClient } from "../provider/openclips/rest-client.js";

const payload = { model: "seedance-2.0", params: { prompt: "A mountain", duration: 4, resolution: "480p" } };
const json = (data, status = 200) => new Response(JSON.stringify(data), { status });
function server({ preview = { sufficient: true, tokenCost: 4 }, workspaceStatus = 200, generationStatus = 202 } = {}) {
    const calls = [];
    return { calls, fetchImpl: async function (url, options) {
        assert.equal(this, globalThis);
        assert.ok(url.startsWith("https://api.openclips.ai/api/"));
        assert.equal(options.headers.Authorization, undefined);
        assert.equal(options.redirect, "manual");
        calls.push({ url, ...options });
        if (url.endsWith("/api/workspaces/")) return json([{ id: 10, name: "Main" }], workspaceStatus);
        if (url.endsWith("/preview_cost/")) return json(preview);
        if (options.method === "POST") return json({ id: 55, actionStatus: "queued" }, generationStatus);
        return json({ id: 55, actionStatus: "success", videoUrl: "https://cdn.example/result.mp4" });
    } };
}

test("raw API key uses REST X-Auth-Token, identical preview/generate bodies, and v2 REST polling", async () => {
    const fake = server();
    const options = { env: {}, fetchImpl: fake.fetchImpl, mediaType: "video" };
    const created = await createOpenClipsMarketplaceTask(payload, "test-api-key", options);
    assert.equal(created.taskId, "openclips:v2:10:55:0");
    assert.equal(fake.calls.length, 3);
    assert.equal(fake.calls[0].headers["X-Auth-Token"], "test-api-key");
    assert.equal(fake.calls[1].body, fake.calls[2].body);
    assert.deepEqual(JSON.parse(fake.calls[2].body), payload);
    assert.equal(fake.calls[2].url, "https://api.openclips.ai/api/workspaces/10/generated_creatives/generate/marketplace_proxy/");
    const result = await getOpenClipsMarketplaceTask(created.taskId, "test-api-key", options);
    assert.equal(fake.calls[3].url, "https://api.openclips.ai/api/workspaces/10/generated_creatives/55/");
    assert.equal(result.status, "COMPLETED");
    assert.equal(result.outputUrl, "https://cdn.example/result.mp4");
});

test("insufficient REST preview prevents generation", async () => {
    const fake = server({ preview: { sufficient: false } });
    await assert.rejects(createOpenClipsMarketplaceTask(payload, "key", { env: {}, fetchImpl: fake.fetchImpl }), error => error.status === 402);
    assert.equal(fake.calls.length, 2);
});

test("REST 401 rotates to the next API key; polling remains on the successful slot", async () => {
    const fake = server();
    const fetchImpl = async function (url, options) {
        if (options.headers["X-Auth-Token"] === "bad") return json({}, 401);
        assert.equal(options.headers["X-Auth-Token"], "good");
        return fake.fetchImpl.call(this, url, options);
    };
    const options = { env: {}, fetchImpl, mediaType: "video" };
    const created = await createOpenClipsMarketplaceTask(payload, '["bad","good"]', options);
    assert.equal(created.taskId, "openclips:v2:10:55:1");
    assert.equal((await getOpenClipsMarketplaceTask(created.taskId, '["bad","good"]', options)).status, "COMPLETED");
});

test("REST 5xx on generation is not retried on another key", async () => {
    const fake = server({ generationStatus: 503 });
    await assert.rejects(createOpenClipsMarketplaceTask(payload, '["key1","key2"]', { env: {}, fetchImpl: fake.fetchImpl }), error => error.status === 503);
    assert.equal(fake.calls.length, 3);
});

test("REST rejects multiple workspaces without selection before preview", async () => {
    let calls = 0;
    await assert.rejects(createOpenClipsMarketplaceTask(payload, "key", { env: {}, fetchImpl: async () => {
        calls++;
        return json([{ id: 10 }, { id: 11 }]);
    } }), error => error.code === "OPENCLIPS_WORKSPACE_REQUIRED");
    assert.equal(calls, 1);
});

test("REST errors do not echo secrets and transport disallows external paths", async () => {
    const client = new OpenClipsRestClient({ accessToken: "secret", fetchImpl: async () => json({ detail: "secret" }, 401) });
    await assert.rejects(client.request("GET", "/api/workspaces/"), error => error.status === 401 && !error.message.includes("secret"));
    await assert.rejects(client.request("GET", "https://other.example/api/"), /Path REST/);
});

test("v1 tasks continue polling with MCP rather than reinterpret their API key", async () => {
    const methods = [];
    const result = await getOpenClipsMarketplaceTask("openclips:v1:10:55:0", "legacy-key", {
        env: {}, mediaType: "video", fetchImpl: async (url, options) => {
            assert.equal(url, "https://mcp.openclips.ai");
            assert.equal(options.headers.Authorization, "Bearer legacy-key");
            const message = JSON.parse(options.body);
            methods.push(message.method);
            if (!message.id) return new Response(null, { status: 202 });
            const result = message.method === "tools/list"
                ? { tools: [{ name: "get_creative", inputSchema: {} }] }
                : message.method === "tools/call"
                    ? { structuredContent: { actionStatus: "success", videoUrl: "https://cdn.example/old.mp4" } } : {};
            return json({ jsonrpc: "2.0", id: message.id, result });
        }
    });
    assert.equal(result.status, "COMPLETED");
    assert.ok(methods.includes("tools/call"));
});

test("malformed REST cost preview never starts a paid generation", async () => {
    const fake = server({ preview: { tokenCost: 4 } });
    await assert.rejects(createOpenClipsMarketplaceTask(payload, "key", { env: {}, fetchImpl: fake.fetchImpl }), error => error.code === "OPENCLIPS_PREVIEW_INVALID");
    assert.equal(fake.calls.length, 2);
});

test("API-key JSON bundle selects its configured workspace and stays on REST", async () => {
    const fake = server();
    const created = await createOpenClipsMarketplaceTask(payload, '{"api_key":"key","workspace_id":10}', { env: {}, fetchImpl: fake.fetchImpl });
    assert.equal(created.taskId, "openclips:v2:10:55:0");
});


for (const status of [301, 302, 303, 307, 308]) {
    test(`REST rejects HTTP ${status} without following or reading redirect content`, async () => {
        let calls = 0;
        const client = new OpenClipsRestClient({
            accessToken: "test-secret",
            fetchImpl: async function (url, options) {
                calls++;
                assert.equal(this, globalThis);
                assert.equal(url, "https://api.openclips.ai/api/workspaces/");
                assert.equal(options.redirect, "manual");
                return {
                    status,
                    get headers() { throw new Error("must not read redirect headers"); },
                    text() { throw new Error("must not read redirect body"); }
                };
            }
        });
        await assert.rejects(client.request("GET", "/api/workspaces/"), error =>
            error.status === status && error.code === "OPENCLIPS_REDIRECT_REJECTED" && !error.message.includes("test-secret"));
        assert.equal(calls, 1);
    });
}

test("redirect during REST preview stops dispatch without retrying another account", async () => {
    const calls = [];
    await assert.rejects(createOpenClipsMarketplaceTask(payload, '["key1","key2"]', {
        env: {}, fetchImpl: async (url, options) => {
            assert.equal(options.redirect, "manual");
            calls.push(url);
            if (url.endsWith("/api/workspaces/")) return json([{ id: 10 }]);
            assert.ok(url.endsWith("/preview_cost/"));
            return new Response(null, { status: 307, headers: { Location: "https://other.example/" } });
        }
    }), error => error.code === "OPENCLIPS_REDIRECT_REJECTED");
    assert.equal(calls.length, 2);
});

for (const [path, method, stage] of [
    ["/api/workspaces/", "GET", "workspace"],
    ["/api/workspaces/10/generated_creatives/generate/marketplace_proxy/preview_cost/", "POST", "preview"],
    ["/api/workspaces/10/generated_creatives/generate/marketplace_proxy/", "POST", "generation"],
    ["/api/workspaces/10/generated_creatives/55/", "GET", "polling"]
]) {
    test(`REST 403 identifies ${stage} without exposing upstream text or token`, async () => {
        const client = new OpenClipsRestClient({ accessToken: "private-token", fetchImpl: async () =>
            json({ detail: "private-token", code: "private-token" }, 403) });
        await assert.rejects(client.request(method, path), error =>
            error.status === 403 && error.code === "OPENCLIPS_FORBIDDEN" && error.stage === stage
            && error.message.includes(`[${stage}]`) && !error.message.includes("private-token"));
    });
}

test("REST 403 challenge is distinguished from an unconfirmed HTML gateway denial", async () => {
    for (const challenge of [true, false]) {
        const client = new OpenClipsRestClient({ accessToken: "secret", fetchImpl: async () =>
            new Response("<html>secret</html>", { status: 403, headers: {
                "content-type": "text/html", ...(challenge ? { "cf-mitigated": "challenge" } : {})
            } }) });
        await assert.rejects(client.request("GET", "/api/workspaces/"), error =>
            error.message.includes(challenge ? "challenge keamanan Cloudflare terdeteksi" : "kemungkinan halaman blokir/gateway")
            && !error.message.includes("secret"));
    }
});

test("workspace 403 stops before preview/generation and does not rotate accounts", async () => {
    const fake = server({ workspaceStatus: 403 });
    await assert.rejects(createOpenClipsMarketplaceTask(payload, '["key1","key2"]', { env: {}, fetchImpl: fake.fetchImpl }),
        error => error.code === "OPENCLIPS_FORBIDDEN" && error.stage === "workspace");
    assert.equal(fake.calls.length, 1);
});
