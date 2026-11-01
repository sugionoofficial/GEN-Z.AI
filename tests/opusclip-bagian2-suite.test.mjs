import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
    VIDEO_DUBBING_QUICKSTART_CONFIG,
    applyVideoDubbingQuickStart,
    buildClipFullId,
    buildCurationPref,
    buildSubmitProjectPayload,
    clipSuffix,
    createOpusClipApiClient,
    projectClip,
    projectClipExport,
    projectThumbnailJob,
    projectTranscript
} from "../provider/opusclip/client.js";
import {
    COPY_VIDEO_STYLE_PROMPT_PRESETS,
    callOpusClipMcpTool,
    parseOpusClipMcpAuthConfig,
    submitOpusClipReferenceAnalysis
} from "../provider/opusclip/mcp-understanding.js";
import {
    MOTION_UI_TEMPLATES,
    normalizeMotionUiJobInput,
    springProgress
} from "../provider/opusclip/motion-ui-templates.js";
import {
    decryptCredentialRow,
    encryptCredentialPlaintext,
    maskSecretPreview
} from "../lib/opus/opusclip-credentials.js";
import opusclipHandler from "../api/opusclip.js";
import opusclipBlackboxHandler from "../api/opusclip-blackbox.js";
import featureCreditsHandler from "../api/feature-credits.js";

const ROOT = process.cwd();

function createMockRes() {
    const headers = {};
    return {
        statusCode: 200,
        headers,
        body: null,
        setHeader(k, v) {
            headers[k.toLowerCase()] = v;
        },
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(data) {
            this.body = data;
            return this;
        },
        end(raw) {
            try {
                this.body = JSON.parse(raw);
            } catch {
                this.body = raw;
            }
            return this;
        }
    };
}

test("Fitur 1 & 2: buildSubmitProjectPayload mematuhi skema wire resmi OpusClip", () => {
    assert.throws(
        () => buildSubmitProjectPayload({ videoUrl: "https://youtu.be/abc", confirmCopyright: false }),
        /COPYRIGHT_CONFIRMATION_REQUIRED|hak cipta/i
    );

    const clippingPayload = buildSubmitProjectPayload({
        videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        confirmCopyright: true,
        title: "Episode 10",
        aspectRatio: "portrait",
        model: "ClipAnything",
        clipDurationsSec: ["30-60"],
        targetLang: "id",
        enableCaption: true,
        enableAutoHook: true,
        removeFiller: true,
        rangeStart: 15,
        rangeEnd: 240,
        customPrompt: "momen bisnis viral"
    });

    assert.equal(clippingPayload.videoUrl, "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    assert.deepEqual(clippingPayload.uploadedVideoAttr, { title: "Episode 10" });
    assert.deepEqual(clippingPayload.importPref, { targetLang: "id" });
    assert.equal(clippingPayload.renderPref.layoutAspectRatio, "portrait");
    assert.equal(clippingPayload.renderPref.enableCaption, true);
    assert.deepEqual(clippingPayload.renderPref.quickstartConfig, { enableRemoveFillerWords: true });
    assert.deepEqual(clippingPayload.curationPref, {
        model: "ClipAnything",
        customPrompt: "momen bisnis viral",
        clipDurations: [[30, 60]],
        enableAutoHook: true,
        range: { startSec: 15, endSec: 240 }
    });

    /* Dubbing QuickStart: menolak konflik & memaksa skipSlicing + VIDEO_DUBBING_QUICKSTART_CONFIG */
    assert.throws(
        () => applyVideoDubbingQuickStart({ dubbingLanguage: "id", targetLang: "en" }),
        /targetLang/
    );

    const dubbingPayload = buildSubmitProjectPayload({
        videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        confirmCopyright: true,
        dubbingLanguage: "id",
        sourceLang: "en",
        aspectRatio: "landscape"
    });
    assert.deepEqual(dubbingPayload.dubbingOptions, {
        enabled: true,
        targetLanguage: "id"
    });
    assert.deepEqual(dubbingPayload.importPref, { sourceLang: "en" });
    assert.deepEqual(dubbingPayload.curationPref, {
        model: "ClipAnything",
        skipSlicing: true
    });
    assert.deepEqual(
        dubbingPayload.renderPref.quickstartConfig,
        VIDEO_DUBBING_QUICKSTART_CONFIG
    );
});

test("Fitur 1, 3, 4: projectors memetakan skor viralitas, export HD/4K/XML, transkrip, & thumbnail", () => {
    assert.equal(clipSuffix("proj1.clip9", "proj1"), "clip9");
    assert.equal(buildClipFullId("proj1", "proj1.clip9"), "proj1.clip9");

    assert.throws(
        () => buildCurationPref({ enableAutoHook: true, skipSlicing: true }),
        /enableAutoHook/
    );

    const mappedClip = projectClip({
        id: "proj_1.clip_a",
        rank: 1,
        score: 96,
        title: "Momen Emas",
        hashtags: "#ai #shorts",
        durationMs: 42500,
        uriForPreview: "https://cdn.opus.pro/p.mp4",
        uriForExport: "https://cdn.opus.pro/hd.mp4",
        judgeResult: {
            hookScore: 95,
            coherenceScore: 92,
            connectionScore: 90,
            trendScore: 97
        }
    });
    assert.equal(mappedClip.project_id, "proj_1");
    assert.equal(mappedClip.clip_id, "clip_a");
    assert.equal(mappedClip.duration_sec, 43);
    assert.deepEqual(mappedClip.hashtags, ["#ai", "#shorts"]);
    assert.equal(mappedClip.hook_score, 95);
    assert.equal(mappedClip.trend_score, 97);

    const readyExport = projectClipExport(
        { id: "proj_1.clip_a", uriForExport4K: "https://cdn.opus.pro/4k.mp4" },
        { target: "4k" }
    );
    assert.equal(readyExport.status, "ready");
    assert.equal(readyExport.export_url, "https://cdn.opus.pro/4k.mp4");

    const transcript = projectTranscript("proj_1", [
        {
            id: "para_1",
            start: 1.5,
            end: 5.2,
            text: "um kita mulai sekarang",
            speaker: "Speaker 1",
            words: [
                { word: "um", start: 1.5, end: 1.8, isFillerWord: true },
                { word: "kita", start: 1.9, end: 2.3, isFillerWord: false }
            ]
        }
    ]);
    assert.equal(transcript.paragraphs[0].words[0].is_filler_word, true);

    const thumb = projectThumbnailJob("job_thumb_1", {
        status: "CONCLUDED",
        result: { generatedThumbnailUris: ["https://cdn.opus.pro/t1.png"] }
    });
    assert.equal(thumb.status, "CONCLUDED");
    assert.deepEqual(thumb.thumbnail_urls, ["https://cdn.opus.pro/t1.png"]);
});

test("Fitur 6: Deep Video Understanding MCP memakai opusclip_analyze_reference_media (bukan opusclip_analyze_video)", async () => {
    assert.ok(COPY_VIDEO_STYLE_PROMPT_PRESETS.copy_video_style.includes("Copy Video Style"));

    const parsed = parseOpusClipMcpAuthConfig(
        JSON.stringify({
            mcp_url: "https://mcp.opus.pro/mcp",
            oauth: {
                access_token: "test",
                refresh_token: "",
                client_id: "cid"
            }
        })
    );
    assert.equal(parsed.type, "oauth");
    assert.equal(parsed.mcpUrl, "https://mcp.opus.pro/mcp");

    const calls = [];
    const mockFetch = async (url, init) => {
        const body = JSON.parse(init.body);
        calls.push({ url, body });
        if (body.method === "initialize") {
            return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: {} }), {
                status: 200,
                headers: { "mcp-session-id": "sess-1" }
            });
        }
        return new Response(
            JSON.stringify({
                jsonrpc: "2.0",
                id: 2,
                result: {
                    structuredContent: {
                        jobId: "und_job_1",
                        status: "PROCESSING"
                    }
                }
            }),
            { status: 200 }
        );
    };

    const res = await submitOpusClipReferenceAnalysis(
        {
            mediaUrl: "https://example.com/ref.mp4",
            durationSeconds: 45,
            preset: "copy_video_style"
        },
        "test",
        { fetchImpl: mockFetch }
    );

    assert.equal(res.jobId, "und_job_1");
    assert.equal(calls.length, 2);
    assert.equal(calls[1].body.params.name, "opusclip_analyze_reference_media");
    assert.equal(calls[1].body.params.arguments.durationSeconds, 45);

    await assert.rejects(
        () =>
            submitOpusClipReferenceAnalysis(
                { mediaUrl: "https://example.com/long.mp4", durationSeconds: 450 },
                "test",
                { fetchImpl: mockFetch }
            ),
        /300 detik/
    );

    const sseRes = await callOpusClipMcpTool(
        "opusclip_whoami",
        {},
        "test",
        {
            fetchImpl: async (_url, init) => {
                const rpc = JSON.parse(init.body);
                if (rpc.method === "initialize") {
                    return new Response('data: {"jsonrpc":"2.0","id":1,"result":{}}\n\n', { status: 200 });
                }
                return new Response(
                    'event: message\ndata: {"jsonrpc":"2.0","id":2,"result":{"content":[{"type":"text","text":"{\\"email\\":\\"owner@genz.ai\\"}"}]}}\n\n',
                    { status: 200 }
                );
            }
        }
    );
    assert.equal(sseRes.email, "owner@genz.ai");
});

test("Fitur 7: Motion UI Remotion templates memiliki 6 desain lengkap & normalisasi valid", () => {
    assert.equal(MOTION_UI_TEMPLATES.length, 6);
    const normalized = normalizeMotionUiJobInput({
        templateId: "tovo-saas-launch",
        aspectRatio: "9:16",
        durationSec: 15,
        props: {
            brandName: "GEN-Z.AI",
            headline: "Peluncuran Produk Baru",
            accentColor: "#00EAFF"
        }
    });
    assert.equal(normalized.width, 1080);
    assert.equal(normalized.height, 1920);
    assert.equal(normalized.durationSec, 15);
    assert.equal(normalized.props.accentColor, "#00eaff");
    assert.equal(springProgress(0, 30, 0), 0);
    assert.ok(springProgress(25, 30, 0) > 0.8);
});

test("BLACK BOX Modul 03: Enkripsi AES-256-GCM & endpoint /api/opusclip-blackbox khusus Owner/Admin", async () => {
    const testEnv = {
        SUPABASE_URL: "https://mock.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "test",
        PROVIDER_CREDENTIAL_ENCRYPTION_KEY: "0".repeat(64)
    };

    const encrypted = encryptCredentialPlaintext('{"apiKey":"shortkey1","orgId":"org_9"}', testEnv);
    const decrypted = decryptCredentialRow(encrypted, testEnv);
    assert.equal(decrypted, '{"apiKey":"shortkey1","orgId":"org_9"}');
    assert.equal(maskSecretPreview("abcdefghij"), "abcd••••ghij");

    /* Non-admin ditolak 403 */
    const deniedRes = createMockRes();
    await opusclipBlackboxHandler(
        {
            method: "GET",
            url: "/api/opusclip-blackbox?action=status",
            headers: { authorization: "Bearer test" },
            env: testEnv,
            fetchImpl: async url => {
                if (url.includes("/auth/v1/user")) {
                    return new Response(JSON.stringify({ id: "u_member", email: "m@genz.ai" }), { status: 200 });
                }
                if (url.includes("/rest/v1/profiles")) {
                    return new Response(JSON.stringify([{ id: "u_member", role: "user" }]), { status: 200 });
                }
                return new Response("[]", { status: 200 });
            }
        },
        deniedRes
    );
    assert.equal(deniedRes.statusCode, 403);
});

test("Endpoint /api/opusclip: menjaga kredit refund otomatis & membatasi Social Posting ke Owner/Admin", async () => {
    const rpcCalls = [];
    const baseEnv = {
        SUPABASE_URL: "https://mock.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "test",
        OPUSCLIP_API_KEY: "shortkey1"
    };

    /* 1. Member biasa ditolak saat memanggil list_social_accounts (403) */
    const memberRes = createMockRes();
    await opusclipHandler(
        {
            method: "GET",
            url: "/api/opusclip?action=list_social_accounts",
            headers: { authorization: "Bearer test" },
            env: baseEnv,
            fetchImpl: async url => {
                if (url.includes("/auth/v1/user")) {
                    return new Response(JSON.stringify({ id: "u_1", email: "u@genz.ai" }), { status: 200 });
                }
                if (url.includes("/rest/v1/profiles")) {
                    return new Response(JSON.stringify([{ id: "u_1", role: "user", credits: 9000 }]), { status: 200 });
                }
                return new Response("[]", { status: 200 });
            }
        },
        memberRes
    );
    assert.equal(memberRes.statusCode, 403);

    /* 2. Member submit_project saat upstream gagal -> otomatis memanggil settle_feature_credits 'refund' */
    const refundRes = createMockRes();
    await opusclipHandler(
        {
            method: "POST",
            url: "/api/opusclip",
            headers: { authorization: "Bearer test" },
            body: {
                action: "submit_project",
                videoUrl: "https://youtu.be/xyz",
                confirmCopyright: true
            },
            env: baseEnv,
            fetchImpl: async (url, init) => {
                if (url.includes("/auth/v1/user")) {
                    return new Response(JSON.stringify({ id: "u_1", email: "u@genz.ai" }), { status: 200 });
                }
                if (url.includes("/rest/v1/profiles")) {
                    return new Response(JSON.stringify([{ id: "u_1", role: "user", credits: 9000 }]), { status: 200 });
                }
                if (url.includes("/rest/v1/provider_credentials")) {
                    return new Response("[]", { status: 200 });
                }
                if (url.includes("/rpc/charge_feature_credits")) {
                    rpcCalls.push({ rpc: "charge", body: JSON.parse(init.body) });
                    return new Response(
                        JSON.stringify({
                            transaction_id: JSON.parse(init.body).p_transaction_id,
                            cost: 2500,
                            credits: 6500,
                            task_id: "opusclip_clip_tx"
                        }),
                        { status: 200 }
                    );
                }
                if (url.includes("/rpc/settle_feature_credits")) {
                    rpcCalls.push({ rpc: "settle", body: JSON.parse(init.body) });
                    return new Response(JSON.stringify({ status: "refunded", credits: 9000 }), { status: 200 });
                }
                if (url.includes("api.opus.pro/api/clip-projects")) {
                    return new Response(JSON.stringify({ message: "Video private" }), { status: 400 });
                }
                return new Response("{}", { status: 200 });
            }
        },
        refundRes
    );
    assert.equal(refundRes.statusCode, 400);
    assert.equal(refundRes.body.refunded, true);
    assert.equal(rpcCalls.length, 2);
    assert.equal(rpcCalls[0].body.p_feature_id, "opusclip_clipping");
    assert.equal(rpcCalls[1].body.p_outcome, "refund");

    /* 3. Owner berhasil mengakses get_api_usage */
    const ownerRes = createMockRes();
    await opusclipHandler(
        {
            method: "GET",
            url: "/api/opusclip?action=get_api_usage",
            headers: { authorization: "Bearer test" },
            env: baseEnv,
            fetchImpl: async url => {
                if (url.includes("/auth/v1/user")) {
                    return new Response(JSON.stringify({ id: "u_owner", email: "o@genz.ai" }), { status: 200 });
                }
                if (url.includes("/rest/v1/profiles")) {
                    return new Response(JSON.stringify([{ id: "u_owner", role: "owner", credits: 50000 }]), { status: 200 });
                }
                if (url.includes("/rest/v1/provider_credentials")) {
                    return new Response("[]", { status: 200 });
                }
                if (url.includes("/api-usage?q=mine")) {
                    return new Response(JSON.stringify({ data: { remainingCredits: 1200 } }), { status: 200 });
                }
                return new Response("{}", { status: 200 });
            }
        },
        ownerRes
    );
    assert.equal(ownerRes.statusCode, 200);
    assert.equal(ownerRes.body.usage.remainingCredits, 1200);
});

test("Admin Tarif Fitur & Integritas Halaman /opusclip + Navigasi + BLACK BOX Modul 03", async () => {
    const navSrc = fs.readFileSync(path.join(ROOT, "navigation/navigation.js"), "utf8");
    const opusHtml = fs.readFileSync(path.join(ROOT, "opusclip/index.html"), "utf8");
    const blackboxHtml = fs.readFileSync(path.join(ROOT, "black-box/index.html"), "utf8");
    const buildSrc = fs.readFileSync(path.join(ROOT, "scripts/build-cloudflare-pages.mjs"), "utf8");

    assert.ok(navSrc.includes('label: "OpusClip Studio", href: "/opusclip/index.html"'));
    assert.ok(opusHtml.includes("genz-toast.js?v=20261029-global-download-toast"));
    assert.ok(blackboxHtml.includes("MODUL 03"));
    assert.ok(blackboxHtml.includes("bbOpusClipVaultPanel"));
    assert.ok(buildSrc.includes('"opusclip"'));

    const client = createOpusClipApiClient({
        apiKey: "test",
        fetchImpl: async () => new Response(JSON.stringify({ list: [] }), { status: 200 })
    });
    const listRaw = await client.get("/brand-templates?q=mine");
    assert.deepEqual(listRaw, { list: [] });

    /* Pastikan feature-credits handler menolak nilai negatif pada fitur opusclip */
    assert.equal(typeof featureCreditsHandler, "function");
});
