import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";

import featureCreditsHandler from "../api/feature-credits.js";

const ROOT = process.cwd();

function readRepoFile(relativePath) {
    return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function createMockRes() {
    return {
        statusCode: 200,
        headers: {},
        payload: null,
        setHeader(key, value) {
            this.headers[key] = value;
        },
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(data) {
            this.payload = data;
            return this;
        },
        end(raw) {
            if (typeof raw === "string" && raw) {
                this.payload = JSON.parse(raw);
            }
            return this;
        }
    };
}

test("SQL migrations sinkronkan semua transaksi feature credits & refund ke generation_history", () => {
    const settingsSql = readRepoFile("supabase/feature-credit-settings.sql");
    const historySql = readRepoFile("supabase/feature-credit-history.sql");

    assert.match(
        settingsSql,
        /drop function if exists public\.charge_feature_credits\(uuid,\s*text,\s*uuid\);/i
    );
    assert.match(
        settingsSql,
        /drop function if exists public\.settle_feature_credits\(uuid,\s*uuid,\s*text\);/i
    );
    assert.match(settingsSql, /insert into public\.generation_history/i);
    assert.match(settingsSql, /update public\.generation_history/i);
    assert.match(settingsSql, /feature:metadata_cleaner:/);
    assert.match(settingsSql, /feature:prompt_studio:/);
    assert.match(settingsSql, /vision-video-/);

    assert.match(
        historySql,
        /create or replace function public\.refund_generate_credits/i
    );
    assert.match(historySql, /set credit_refunded = true/i);
});

test("POST /api/feature-credits meneruskan metadata history saat charge & settle", async () => {
    const originalFetch = global.fetch;
    const rpcCalls = [];
    const txId = "11111111-2222-4333-8444-555555555555";

    global.fetch = async (input, init = {}) => {
        const url = String(input);
        if (url === "https://supabase.example.co/auth/v1/user") {
            return new Response(
                JSON.stringify({ id: "user-fc-1", email: "user@genz.ai" }),
                { status: 200, headers: { "Content-Type": "application/json" } }
            );
        }
        if (url.endsWith("/rest/v1/rpc/charge_feature_credits")) {
            const body = JSON.parse(init.body);
            rpcCalls.push({ rpc: "charge", body });
            return new Response(
                JSON.stringify({
                    transaction_id: txId,
                    feature_id: body.p_feature_id,
                    cost: 500,
                    credits: 9500,
                    status: "charged",
                    history_id: "hist-1",
                    task_id: `feature:${body.p_feature_id}:${txId}`
                }),
                { status: 200, headers: { "Content-Type": "application/json" } }
            );
        }
        if (url.endsWith("/rest/v1/rpc/settle_feature_credits")) {
            const body = JSON.parse(init.body);
            rpcCalls.push({ rpc: "settle", body });
            return new Response(
                JSON.stringify({
                    transaction_id: txId,
                    feature_id: "metadata_cleaner",
                    cost: 500,
                    credits: 10000,
                    status: "refunded",
                    history_id: "hist-1"
                }),
                { status: 200, headers: { "Content-Type": "application/json" } }
            );
        }
        throw new Error(`Unexpected fetch URL: ${url}`);
    };

    try {
        const env = {
            SUPABASE_URL: "https://supabase.example.co",
            SUPABASE_SERVICE_ROLE_KEY: "srv-test-token",
            SUPABASE_ANON_KEY: "anon-test-token"
        };

        const chargeRes = createMockRes();
        await featureCreditsHandler(
            {
                method: "POST",
                url: "/api/feature-credits",
                headers: { authorization: "Bearer token-123" },
                env,
                body: {
                    action: "charge",
                    feature_id: "metadata_cleaner",
                    transaction_id: txId,
                    prompt: "Clean Metadata — sample.jpg",
                    model_id: "metadata-cleaner",
                    model_name: "AI Metadata Cleaner"
                }
            },
            chargeRes
        );

        assert.equal(chargeRes.statusCode, 200);
        assert.equal(chargeRes.payload?.cost, 500);
        assert.equal(rpcCalls[0].body.p_prompt, "Clean Metadata — sample.jpg");
        assert.equal(rpcCalls[0].body.p_model_id, "metadata-cleaner");
        assert.equal(rpcCalls[0].body.p_model_name, "AI Metadata Cleaner");

        const settleRes = createMockRes();
        await featureCreditsHandler(
            {
                method: "POST",
                url: "/api/feature-credits",
                headers: { authorization: "Bearer token-123" },
                env,
                body: {
                    action: "settle",
                    transaction_id: txId,
                    outcome: "refund",
                    error_message: "Gagal membaca EXIF"
                }
            },
            settleRes
        );

        assert.equal(settleRes.statusCode, 200);
        assert.equal(settleRes.payload?.status, "refunded");
        assert.equal(rpcCalls[1].body.p_outcome, "refund");
        assert.equal(rpcCalls[1].body.p_error_message, "Gagal membaca EXIF");
    } finally {
        global.fetch = originalFetch;
    }
});

test("saveVisionHistory di /api/openkey-chat meng-update baris transaksi yang sudah dibuat charge_feature_credits tanpa duplikasi", async () => {
    const originalFetch = global.fetch;
    const originalUrl = process.env.SUPABASE_URL;
    const originalServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const txId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    const calls = [];

    process.env.SUPABASE_URL = "https://supabase.example.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "srv-test-token";

    const { default: openkeyChatHandler } = await import(
        `../api/openkey-chat.js?fc-test=${Date.now()}`
    );

    global.fetch = async (input, init = {}) => {
        const url = String(input);
        calls.push({ url, method: init.method || "GET", body: init.body ? JSON.parse(init.body) : null });

        if (url === "https://supabase.example.co/auth/v1/user") {
            return new Response(
                JSON.stringify({ id: "user-vision-1", email: "vision@genz.ai" }),
                { status: 200, headers: { "Content-Type": "application/json" } }
            );
        }
        if (url.includes("/rest/v1/generation_history?") && init.method === "PATCH") {
            return new Response(
                JSON.stringify([
                    {
                        id: "hist-vision-1",
                        task_id: `vision-video-${txId}`,
                        credit_cost: 500,
                        status: "success"
                    }
                ]),
                { status: 200, headers: { "Content-Type": "application/json" } }
            );
        }
        throw new Error(`Unexpected fetch URL: ${url}`);
    };

    try {
        const res = createMockRes();
        await openkeyChatHandler(
            {
                method: "POST",
                url: "/api/openkey-chat",
                headers: { authorization: "Bearer vision-token" },
                body: {
                    operation: "vision_history_save",
                    record: {
                        feature_id: "vision_video",
                        transaction_id: txId,
                        task_id: `vision-video-${txId}`,
                        model_id: "gemini-2.5-pro",
                        model_name: "gemini-2.5-pro",
                        prompt: "Cinematic drone tracking shot",
                        duration: 5.7,
                        resolution: "1920x1080",
                        status: "success",
                        credit_cost: 500
                    }
                }
            },
            res
        );

        assert.equal(res.statusCode, 200);
        const patchCall = calls.find(entry => entry.method === "PATCH");
        assert.ok(patchCall, "harus melakukan PATCH ke baris generation_history milik transaksi");
        assert.match(patchCall.url, new RegExp(`task_id=eq\\.vision-video-${txId}`));
        assert.equal(patchCall.body.provider_name, "GEN-Z.AI");
        assert.equal(patchCall.body.model_name, "Vision Video — gemini-2.5-pro");
        assert.equal(patchCall.body.duration, 6);
        assert.equal(
            calls.some(entry => entry.method === "POST" && entry.url.includes("/rest/v1/generation_history")),
            false,
            "tidak boleh membuat baris duplikat lewat POST"
        );
    } finally {
        global.fetch = originalFetch;
        process.env.SUPABASE_URL = originalUrl;
        process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceKey;
    }
});

test("upscale dari modal History memakai tarif upscale_video, menyimpan model_id upscale-video, dan menandai credit_refunded saat gagal dispatch", async () => {
    const originalFetch = global.fetch;
    const originalUrl = process.env.SUPABASE_URL;
    const originalServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const originalAnonKey = process.env.SUPABASE_ANON_KEY;
    const originalGhToken = process.env.GITHUB_PAT;

    process.env.SUPABASE_URL = "https://supabase.example.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "srv-test-token";
    process.env.SUPABASE_ANON_KEY = "anon-test-token";
    process.env.GITHUB_PAT = "gh-test-token";

    const { default: generateHandler } = await import(
        `../api/generate.js?fc-test=${Date.now()}`
    );

    const featureLookups = [];
    let insertedPayload = null;
    const patchBodies = [];
    let refundedAmount = 0;

    global.fetch = async (input, init = {}) => {
        const url = String(input);
        if (url === "https://supabase.example.co/auth/v1/user") {
            return new Response(
                JSON.stringify({ id: "user-up-1", email: "user@genz.ai" }),
                { status: 200, headers: { "Content-Type": "application/json" } }
            );
        }
        if (url.includes("/rest/v1/generation_history?select=*&id=eq.parent-hist-1")) {
            return new Response(
                JSON.stringify([
                    {
                        id: "parent-hist-1",
                        user_id: "user-up-1",
                        provider_id: "opus",
                        provider_name: "GEN-Z.AI",
                        model_id: "opus-seedance-2.5-t2v",
                        model_name: "Opus Seedance 2.5",
                        prompt: "Cyberpunk street rain",
                        status: "success",
                        result_url: "https://cdn.example.com/out.mp4"
                    }
                ]),
                { status: 200, headers: { "Content-Type": "application/json" } }
            );
        }
        if (url.includes("upscale_of_history_id=eq.parent-hist-1")) {
            return new Response(JSON.stringify([]), {
                status: 200,
                headers: { "Content-Type": "application/json" }
            });
        }
        if (url.includes("/rest/v1/feature_credit_settings?")) {
            featureLookups.push(url);
            const cost = url.includes("feature_id=eq.upscale_video") ? 1000 : 250;
            return new Response(JSON.stringify([{ credit_cost: cost }]), {
                status: 200,
                headers: { "Content-Type": "application/json" }
            });
        }
        if (url.endsWith("/rest/v1/rpc/deduct_generate_credits")) {
            return new Response(JSON.stringify(9000), {
                status: 200,
                headers: { "Content-Type": "application/json" }
            });
        }
        if (url.endsWith("/rest/v1/generation_history?select=*") && init.method === "POST") {
            insertedPayload = JSON.parse(init.body)[0];
            return new Response(
                JSON.stringify([{ id: "upscale-hist-1", ...insertedPayload }]),
                { status: 201, headers: { "Content-Type": "application/json" } }
            );
        }
        if (url.includes("api.github.com/repos/") && url.endsWith("/dispatches")) {
            return new Response("workflow unavailable", { status: 502 });
        }
        if (url.includes("/rest/v1/generation_history?id=eq.upscale-hist-1") && init.method === "PATCH") {
            const parsed = JSON.parse(init.body);
            patchBodies.push(parsed);
            return new Response(JSON.stringify([{ id: "upscale-hist-1", ...parsed }]), {
                status: 200,
                headers: { "Content-Type": "application/json" }
            });
        }
        if (url.endsWith("/rest/v1/rpc/refund_generate_credits")) {
            refundedAmount = JSON.parse(init.body).p_amount;
            return new Response(JSON.stringify(10000), {
                status: 200,
                headers: { "Content-Type": "application/json" }
            });
        }
        throw new Error(`Unexpected fetch URL: ${url}`);
    };

    try {
        const res = createMockRes();
        await generateHandler(
            {
                method: "POST",
                headers: { authorization: "Bearer user-token" },
                body: {
                    action: "upscale",
                    history_id: "parent-hist-1",
                    target_resolution: "2k"
                }
            },
            res
        );

        assert.equal(res.statusCode, 502);
        assert.ok(
            featureLookups.some(u => u.includes("feature_id=eq.upscale_video")),
            "harus membaca tarif upscale_video, bukan upscale foto"
        );
        assert.equal(insertedPayload?.model_id, "upscale-video");
        assert.equal(insertedPayload?.model_name, "Upscale Video");
        assert.equal(insertedPayload?.credit_cost, 1000);
        assert.equal(refundedAmount, 1000);
        assert.ok(
            patchBodies.some(body => body.credit_refunded === true),
            "harus menandai credit_refunded = true setelah refund berhasil"
        );
    } finally {
        global.fetch = originalFetch;
        process.env.SUPABASE_URL = originalUrl;
        process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceKey;
        process.env.SUPABASE_ANON_KEY = originalAnonKey;
        process.env.GITHUB_PAT = originalGhToken;
    }
});

test("History render & status-sync menangani semua baris fitur non-generate dengan benar", () => {
    const regenerateSource = readRepoFile("assets/js/generation-regenerate.js");
    const renderSource = readRepoFile("history/assets/js/history-render.js");
    const syncSource = readRepoFile("history/assets/js/history-status-sync.js");

    const context = vm.createContext({
        window: { GENZHistory: { state: {}, elements: {} } },
        document: {
            addEventListener() {},
            getElementById() {
                return null;
            },
            querySelectorAll() {
                return [];
            }
        },
        sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        URL,
        console
    });
    context.window.window = context.window;
    context.window.document = context.document;
    context.window.sessionStorage = context.sessionStorage;

    vm.runInContext(regenerateSource, context);
    vm.runInContext(renderSource, context);
    vm.runInContext(syncSource, context);

    const App = context.window.GENZHistory;

    const featureItems = [
        {
            id: "1",
            provider_id: "genzai-internal",
            model_id: "metadata-cleaner",
            model_name: "AI Metadata Cleaner",
            task_id: "feature:metadata_cleaner:11111111-1111-4111-8111-111111111111",
            status: "processing",
            credit_cost: 500
        },
        {
            id: "2",
            provider_id: "genzai-internal",
            model_id: "prompt-studio",
            model_name: "Studio Prompt",
            task_id: "feature:prompt_studio:22222222-2222-4222-8222-222222222222",
            status: "processing",
            credit_cost: 500
        },
        {
            id: "3",
            provider_id: "openkey",
            model_id: "gemini-2.5-pro",
            model_name: "Vision Image — Gemini 2.5 Pro",
            task_id: "vision-33333333-3333-4333-8333-333333333333",
            status: "processing",
            credit_cost: 500
        },
        {
            id: "4",
            provider_id: "openkey",
            model_id: "gemini-2.5-pro",
            model_name: "Vision Video — gemini-2.5-pro",
            task_id: "vision-video-44444444-4444-4444-8444-444444444444",
            status: "processing",
            credit_cost: 500
        },
        {
            id: "5",
            provider_id: "genzai-internal",
            model_id: "upscale-photo",
            model_name: "Upscale Photo",
            task_id: "upscale-photo_12345",
            status: "processing",
            credit_cost: 1000
        },
        {
            id: "6",
            provider_id: "genzai-internal",
            model_id: "upscale-video",
            model_name: "Upscale Video",
            task_id: "upscale_12345",
            status: "processing",
            credit_cost: 1000
        }
    ];

    const regularGenerateItem = {
        id: "7",
        provider_id: "opus",
        provider_name: "GEN-Z.AI",
        model_id: "opus-seedance-2.5-t2v",
        model_name: "Opus Seedance 2.5",
        task_id: "opus:task-999",
        status: "processing",
        credit_cost: 5000
    };

    App.state.historyData = [...featureItems, regularGenerateItem];

    for (const item of featureItems) {
        assert.equal(
            App.isNonRegenerableHistoryItem(item),
            true,
            `${item.model_id} tidak boleh menampilkan tombol Regenerate`
        );
    }
    assert.equal(App.isNonRegenerableHistoryItem(regularGenerateItem), false);

    const active = App.getActiveHistoryItems();
    assert.equal(active.length, 1);
    assert.equal(active[0].id, "7");
});
