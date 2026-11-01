import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const USER_ID = "c237fcef-6456-451e-ae98-691f2dabb60d";
const PARENT_HISTORY_ID = "b97a5be0-2095-4a1d-b2a2-efd5acf9c1f3";
const UPSCALE_HISTORY_ID = "49b5b280-2249-4a7b-a95a-72cad734bcce";

function readRepoFile(relativePath) {
    return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

function createMockRes() {
    return {
        statusCode: 200,
        headers: {},
        body: "",
        setHeader(name, value) {
            this.headers[name] = value;
        },
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.body = JSON.stringify(payload);
            return this;
        },
        end(body = "") {
            if (body) this.body = body;
            return this;
        }
    };
}

test("Upscale Studio frontend & HTML mendukung durasi video hingga 30 detik", () => {
    const appJs = readRepoFile("upscale/assets/js/upscale-app.js");
    const html = readRepoFile("upscale/index.html");

    assert.match(appJs, /maxVideoDuration:\s*30\b/);
    assert.match(appJs, /maxVideoDurationTolerance:\s*0\.95\b/);
    assert.match(appJs, /Durasi video maksimal 30 detik\./);
    assert.doesNotMatch(appJs, /Durasi video maksimal 15 detik\./);

    assert.match(html, /durasi maks\. 30 detik/i);
    assert.match(html, /Durasi video maksimal 30 detik dan target resolusi maksimal 2K\./);
    assert.doesNotMatch(html, /15 detik/i);
});

test("Workflow upscale.yml mendukung video 30 detik, single-pass filter intermediate, dan fallback supabase-private", () => {
    const yml = readRepoFile(".github/workflows/upscale.yml");

    assert.match(yml, /timeout-minutes:\s*90\b/);
    assert.match(yml, /MAX_DURATION_SECONDS:\s*"30"/);
    assert.match(yml, /MAX_DURATION_TOLERANCE_SECONDS:\s*"0\.95"/);
    assert.doesNotMatch(yml, /MAX_DURATION_SECONDS:\s*"15"/);

    // Filter minterpolate hanya dijalankan satu kali ke filtered.mp4 sebelum 2-pass libx264
    assert.match(yml, /filtered\.mp4/);
    assert.match(yml, /-map 0:v:0/);
    assert.match(yml, /-map 1:a:0\?/);

    // Fallback unduh langsung jika source_url berformat supabase-private://
    assert.match(yml, /supabase-private:\/\/\*/);
});

test("POST /api/generate action=upscale menandatangani result_url supabase-private:// milik video 30 detik sebelum dispatch ke GitHub Actions", async () => {
    const prevUrl = process.env.SUPABASE_URL;
    const prevService = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const prevAnon = process.env.SUPABASE_ANON_KEY;
    const prevPat = process.env.GITHUB_PAT;
    const originalFetch = globalThis.fetch;

    process.env.SUPABASE_URL = "https://project.example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "srv-test-token";
    process.env.SUPABASE_ANON_KEY = "project-anon";
    process.env.GITHUB_PAT = "gh-test-token";

    const privateVideoRef =
        `supabase-private://user-uploads/upscale-videos/outputs/${USER_ID}/staged30-${PARENT_HISTORY_ID}-1793400000.mp4`;
    const signedDownloadUrl =
        `https://project.example.supabase.co/storage/v1/object/sign/user-uploads/upscale-videos/outputs/${USER_ID}/staged30-${PARENT_HISTORY_ID}-1793400000.mp4?token=test-signed`;

    let insertedHistoryPayload = null;
    let dispatchedWorkflowBody = null;

    globalThis.fetch = async (url, options = {}) => {
        const u = String(url);
        const method = String(options.method || "GET").toUpperCase();

        if (u.endsWith("/auth/v1/user")) {
            return Response.json({ id: USER_ID, email: "owner@example.com" });
        }
        if (u.includes("/rest/v1/generation_history?") && u.includes("upscale_of_history_id=")) {
            return Response.json([]);
        }
        if (u.includes("/rest/v1/generation_history?") && u.includes(`id=eq.${PARENT_HISTORY_ID}`)) {
            return Response.json([
                {
                    id: PARENT_HISTORY_ID,
                    user_id: USER_ID,
                    status: "success",
                    duration: 30,
                    ratio: "9:16",
                    prompt: "Video 30 detik bertahap",
                    result_url: privateVideoRef
                }
            ]);
        }
        if (u.includes("/storage/v1/object/sign/user-uploads/") && method === "POST") {
            return Response.json({
                signedURL: `/object/sign/user-uploads/upscale-videos/outputs/${USER_ID}/staged30-${PARENT_HISTORY_ID}-1793400000.mp4?token=test-signed`
            });
        }
        if (u.includes("/rest/v1/feature_credit_settings")) {
            return Response.json([{ feature_id: "upscale_video", credit_cost: 10 }]);
        }
        if (u.includes("/rest/v1/rpc/deduct_generate_credits")) {
            return Response.json(990);
        }
        if (u.includes("/rest/v1/generation_history") && method === "POST") {
            const rows = JSON.parse(options.body);
            insertedHistoryPayload = rows[0];
            return Response.json([{ id: UPSCALE_HISTORY_ID, ...insertedHistoryPayload }]);
        }
        if (u.includes("/actions/workflows/") && u.endsWith("/dispatches") && method === "POST") {
            dispatchedWorkflowBody = JSON.parse(options.body);
            return new Response(null, { status: 204 });
        }

        throw new Error(`Unexpected fetch in upscale 30s test: ${method} ${u}`);
    };

    try {
        const { default: generateHandler } = await import(
            `../api/generate.js?upscale30s=${Date.now()}`
        );

        const res = createMockRes();
        await generateHandler(
            {
                method: "POST",
                url: "/api/generate",
                headers: { authorization: "Bearer test-access-token" },
                body: {
                    action: "upscale",
                    history_id: PARENT_HISTORY_ID,
                    target_resolution: "2k"
                }
            },
            res
        );

        assert.equal(res.statusCode, 200, res.body);
        const body = JSON.parse(res.body);
        assert.equal(body.success, true);

        // Database tetap menyimpan referensi stabil supabase-private:// dan durasi 30 detik
        assert.ok(insertedHistoryPayload);
        assert.equal(insertedHistoryPayload.duration, 30);
        assert.equal(insertedHistoryPayload.upscale_source_url, privateVideoRef);

        // GitHub Actions menerima signed HTTPS URL yang dapat diunduh curl
        assert.ok(dispatchedWorkflowBody);
        assert.equal(dispatchedWorkflowBody.inputs.source_url, signedDownloadUrl);
    } finally {
        globalThis.fetch = originalFetch;
        if (prevUrl === undefined) delete process.env.SUPABASE_URL;
        else process.env.SUPABASE_URL = prevUrl;
        if (prevService === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
        else process.env.SUPABASE_SERVICE_ROLE_KEY = prevService;
        if (prevAnon === undefined) delete process.env.SUPABASE_ANON_KEY;
        else process.env.SUPABASE_ANON_KEY = prevAnon;
        if (prevPat === undefined) delete process.env.GITHUB_PAT;
        else process.env.GITHUB_PAT = prevPat;
    }
});
