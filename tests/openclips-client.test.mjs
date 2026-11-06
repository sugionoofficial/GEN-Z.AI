import test from "node:test";
import assert from "node:assert/strict";

import {
    createOpenClipsMarketplaceTask,
    getOpenClipsMarketplaceTask,
    parseOpenClipsTaskId,
    normalizeOpenClipsStatus
} from "../provider/openclips/client.js";
import { parseOpenClipsMcpResponse } from "../provider/openclips/mcp-client.js";

function rpcResponse(id, result) {
    return new Response(JSON.stringify({ jsonrpc: "2.0", id, result }), {
        status: 200,
        headers: { "content-type": "application/json" }
    });
}

function textTool(value, isError = false) {
    return {
        content: [{ type: "text", text: JSON.stringify(value) }],
        ...(isError ? { isError: true } : {})
    };
}

function createFakeOpenClips({ insufficient = false, unauthorized = false } = {}) {
    const calls = [];
    let generateCount = 0;
    let previewBody = null;
    let generationArgs = null;
    const tools = [
        { name: "list_my_workspaces", inputSchema: { type: "object", properties: {} } },
        {
            name: "marketplace_models",
            inputSchema: { type: "object", properties: { model: { type: "string" }, kind: { type: "string" } } }
        },
        {
            name: "call_api",
            inputSchema: {
                type: "object",
                properties: {
                    method: { type: "string" },
                    path: { type: "string" },
                    body: { type: "object" }
                },
                required: ["method", "path"]
            }
        },
        {
            name: "generate_marketplace_proxy",
            inputSchema: {
                type: "object",
                properties: {
                    workspaceId: { type: "integer" },
                    request: {
                        type: "object",
                        properties: {
                            model: { const: "seedance-2.5" },
                            prompt: { type: "string" },
                            images: { type: "array" },
                            params: { type: "object" }
                        },
                        required: ["model", "prompt"]
                    }
                },
                required: ["workspaceId", "request"]
            }
        },
        {
            name: "get_creative",
            inputSchema: {
                type: "object",
                properties: {
                    workspaceId: { type: "integer" },
                    creativeId: { type: "integer" }
                },
                required: ["workspaceId", "creativeId"]
            }
        }
    ];

    const fetchImpl = async (url, options = {}) => {
        const message = JSON.parse(options.body);
        calls.push({ url, message, headers: options.headers });
        assert.equal(url, "https://mcp.openclips.ai");
        assert.equal(options.headers.Authorization, "Bearer test-key");

        if (message.method === "initialize") {
            return rpcResponse(message.id, {
                protocolVersion: "2025-03-26",
                serverInfo: { name: "openclips" },
                capabilities: { tools: {} }
            });
        }
        if (message.method === "notifications/initialized") {
            return new Response("", { status: 202 });
        }
        if (message.method === "tools/list") {
            return rpcResponse(message.id, { tools });
        }
        if (message.method !== "tools/call") {
            throw new Error(`Unexpected method ${message.method}`);
        }

        const { name, arguments: args } = message.params;
        if (name === "list_my_workspaces") {
            if (unauthorized) {
                return rpcResponse(message.id, textTool({ error: "HTTP 401 Unauthorized: invalid_token" }, true));
            }
            return rpcResponse(message.id, textTool({ workspaces: [{ id: 42, name: "Main" }] }));
        }
        if (name === "marketplace_models") {
            assert.equal(args.model, "seedance-2.5");
            assert.equal(args.kind, "video");
            return rpcResponse(message.id, textTool({ model: "seedance-2.5", durations: [4, 30] }));
        }
        if (name === "call_api") {
            assert.match(args.path, /preview_cost\/$/);
            previewBody = args.body;
            return rpcResponse(message.id, textTool(
                insufficient
                    ? { tokenCost: 200, tokenBalance: 10, sufficient: false }
                    : { tokenCost: 12, tokenBalance: 100, sufficient: true }
            ));
        }
        if (name === "generate_marketplace_proxy") {
            generateCount += 1;
            generationArgs = args;
            return rpcResponse(message.id, textTool({
                id: 99,
                workspaceId: 42,
                actionStatus: "processing",
                videoUrl: null
            }));
        }
        if (name === "get_creative") {
            assert.deepEqual(args, { workspaceId: 42, creativeId: 99 });
            return rpcResponse(message.id, textTool({
                id: 99,
                workspaceId: 42,
                actionStatus: "success",
                videoUrl: "https://cdn.openclips.ai/result.mp4"
            }));
        }
        throw new Error(`Unexpected tool ${name}`);
    };

    return {
        fetchImpl,
        calls,
        get previewBody() { return previewBody; },
        get generationArgs() { return generationArgs; },
        get generateCount() { return generateCount; }
    };
}

const ENV = {
    OPENCLIPS_WORKSPACE_ID: "42",
    OPENCLIPS_DISABLE_SUPABASE_VAULT: "1"
};
const PAYLOAD = {
    model: "seedance-2.5",
    prompt: "A cinematic product shot",
    images: ["https://cdn.example.com/product.png"],
    params: {
        aspectRatio: "9:16",
        duration: 5,
        resolution: "720p",
        generateAudio: true,
        outputFormat: "mp4",
        imageRole: "first-frame"
    }
};

test("create menjalankan workspace → contract → preview → generate dengan body identik", async () => {
    const fake = createFakeOpenClips();
    const created = await createOpenClipsMarketplaceTask(PAYLOAD, "test-key", {
        env: ENV,
        fetchImpl: fake.fetchImpl,
        mediaType: "video"
    });

    assert.equal(fake.generateCount, 1);
    assert.deepEqual(fake.previewBody, PAYLOAD);
    assert.deepEqual(fake.generationArgs, { workspaceId: 42, request: PAYLOAD });
    assert.equal(created.status, "PROCESSING");
    assert.equal(created.creativeId, "99");
    assert.equal(created.workspaceId, "42");
    assert.equal(created.modelContractLoaded, true);
    assert.deepEqual(created.outputUrls, []);
    assert.deepEqual(parseOpenClipsTaskId(created.taskId), {
        workspaceId: "42",
        creativeId: "99",
        keySlot: 0
    });
    assert.equal(fake.calls.some(call => String(call.url).includes("api.openclips.ai")), false);
});

test("query get_creative menormalisasi success dan hanya mengeluarkan URL saat selesai", async () => {
    const fake = createFakeOpenClips();
    const created = await createOpenClipsMarketplaceTask(PAYLOAD, "test-key", {
        env: ENV,
        fetchImpl: fake.fetchImpl,
        mediaType: "video"
    });
    const result = await getOpenClipsMarketplaceTask(created.taskId, "test-key", {
        env: ENV,
        fetchImpl: fake.fetchImpl,
        mediaType: "video"
    });
    assert.equal(result.status, "COMPLETED");
    assert.equal(result.completed, true);
    assert.deepEqual(result.outputUrls, ["https://cdn.openclips.ai/result.mp4"]);
    assert.deepEqual(result.raw.video_urls, result.outputUrls);
});

test("preview insufficient menghentikan dispatch sebelum generation", async () => {
    const fake = createFakeOpenClips({ insufficient: true });
    await assert.rejects(
        createOpenClipsMarketplaceTask(PAYLOAD, "test-key", {
            env: ENV,
            fetchImpl: fake.fetchImpl,
            mediaType: "video"
        }),
        error => {
            assert.equal(error.status, 402);
            assert.equal(error.code, "OPENCLIPS_INSUFFICIENT_BALANCE");
            return true;
        }
    );
    assert.equal(fake.generateCount, 0);
});

test("401 di dalam MCP tool error tetap dikenali sebagai kegagalan autentikasi", async () => {
    const fake = createFakeOpenClips({ unauthorized: true });
    await assert.rejects(
        createOpenClipsMarketplaceTask(PAYLOAD, "test-key", {
            env: ENV,
            fetchImpl: fake.fetchImpl,
            mediaType: "video"
        }),
        error => {
            assert.equal(error.status, 401);
            assert.equal(error.code, "OPENCLIPS_AUTH_FAILED");
            return true;
        }
    );
    assert.equal(fake.generateCount, 0);
});

test("status processing tidak membocorkan URL sebagai hasil terminal", () => {
    const normalized = normalizeOpenClipsStatus({
        id: 1,
        actionStatus: "processing",
        videoUrl: "https://cdn.example.com/not-yet-terminal.mp4"
    }, "video");
    assert.equal(normalized.status, "PROCESSING");
    assert.deepEqual(normalized.outputUrls, []);
});

test("success tanpa URL tetap processing sampai media benar-benar tersedia", () => {
    const normalized = normalizeOpenClipsStatus({
        id: 1,
        actionStatus: "success",
        videoUrl: null
    }, "video");
    assert.equal(normalized.status, "PROCESSING");
    assert.deepEqual(normalized.outputUrls, []);
});

test("SSE JSON-RPC parser membaca event data", () => {
    const parsed = parseOpenClipsMcpResponse(
        "event: message\ndata: {\"jsonrpc\":\"2.0\",\"id\":1,\"result\":{\"ok\":true}}\n\n",
        "text/event-stream"
    );
    assert.deepEqual(parsed, { jsonrpc: "2.0", id: 1, result: { ok: true } });
});
