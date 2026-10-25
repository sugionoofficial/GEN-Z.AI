import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import socialPublisherHandler from "../api/social-publisher.js";
import { runSocialPublisherCron } from "../functions/_shared/social-publisher-cron.js";

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

function mockFetch(handler) {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, options = {}) => handler(String(input), options);
    return () => { globalThis.fetch = originalFetch; };
}

test("cron menandai run autopost dan pratinjau manual yang menggantung sebagai gagal", async () => {
    const patches = [];
    const restore = mockFetch(async (url, options = {}) => {
        if (url.includes("/rpc/claim_due_social_post_schedules")) return Response.json([]);
        if (url.includes("/rpc/claim_stuck_social_post_runs")) return Response.json([]);
        if (url.includes("/rest/v1/social_post_runs?") && options.method === "PATCH") {
            patches.push({ url, body: JSON.parse(options.body || "{}") });
            return Response.json([{ id: `swept-${patches.length}` }]);
        }
        throw new Error(`Unexpected fetch: ${url}`);
    });

    const now = new Date("2026-10-26T02:00:00.000Z");
    try {
        const result = await runSocialPublisherCron(env, now);
        assert.deepEqual(result.swept, { auto: 2, manual: 1 });

        const autoGenerating = patches.find(item => item.url.includes("status=eq.generating&schedule_id=not.is.null"));
        const autoQueued = patches.find(item => item.url.includes("status=eq.queued&schedule_id=not.is.null"));
        const manual = patches.find(item => item.url.includes("schedule_id=is.null"));

        assert.ok(autoGenerating, "run autopost generating harus disapu");
        assert.ok(autoQueued, "run autopost queued yang telat harus disapu");
        assert.ok(manual, "pratinjau manual yatim harus disapu");

        /* Autopost memakai started_at (diperbarui saat run dilanjutkan) supaya
           run yang baru dilanjutkan tidak ikut tersapu di tengah proses. */
        assert.match(decodeURIComponent(autoGenerating.url), /started_at=lt\.2026-10-26T01:30:00\.000Z/);
        assert.match(decodeURIComponent(manual.url), /created_at=lt\.2026-10-25T20:00:00\.000Z/);

        for (const patch of patches) {
            assert.equal(patch.body.status, "failed");
            assert.ok(String(patch.body.error_message || "").length > 20, "pesan gagal harus menjelaskan");
            assert.equal(patch.body.finished_at, "2026-10-26T02:00:00.000Z");
        }
        assert.match(manual.body.error_message, /Pratinjau manual kedaluwarsa/);
        assert.match(autoGenerating.body.error_message, /tidak dapat dilanjutkan/);
    } finally {
        restore();
    }
});

test("sapuan cron tidak menggagalkan seluruh tick ketika patch ditolak", async () => {
    const restore = mockFetch(async (url, options = {}) => {
        if (url.includes("/rpc/claim_due_social_post_schedules")) return Response.json([]);
        if (url.includes("/rpc/claim_stuck_social_post_runs")) return Response.json([]);
        if (url.includes("/rest/v1/social_post_runs?") && options.method === "PATCH") {
            return Response.json({ message: "relation does not exist" }, { status: 404 });
        }
        throw new Error(`Unexpected fetch: ${url}`);
    });
    try {
        const result = await runSocialPublisherCron(env, new Date());
        assert.deepEqual(result.swept, { auto: 0, manual: 0 });
        assert.equal(result.skipped, false);
    } finally {
        restore();
    }
});

function mockAuth(profile, handler) {
    return mockFetch(async (url, options = {}) => {
        if (url.endsWith("/auth/v1/user")) return Response.json({ id: profile.id });
        if (url.includes("/rest/v1/profiles?select=id,role,status")) return Response.json([profile]);
        return handler(url, options);
    });
}

function studioAccessActive(userId) {
    return Response.json([{
        user_id: userId,
        is_active: true,
        started_at: new Date(Date.now() - 86400000).toISOString(),
        expires_at: new Date(Date.now() + 30 * 86400000).toISOString()
    }]);
}

test("cancel-run hanya menutup run milik sendiri yang masih generating", async () => {
    let patch = null;
    const restore = mockAuth({ id: "user-1", role: "USER", status: "active" }, async (url, options = {}) => {
        if (url.includes("/rest/v1/studio_medsos_access?")) return studioAccessActive("user-1");
        if (url.includes("/rest/v1/social_post_runs?")) {
            assert.equal(options.method, "PATCH");
            patch = { url, body: JSON.parse(options.body) };
            return Response.json([{ id: "run-1", schedule_id: null }]);
        }
        throw new Error(`Unexpected fetch: ${url}`);
    });

    const response = makeResponse();
    try {
        await socialPublisherHandler({
            method: "POST",
            url: "/api/social-publisher?action=cancel-run",
            query: { action: "cancel-run" },
            headers: { authorization: "Bearer test-token" },
            body: { run_id: "run-1" },
            env
        }, response);

        assert.equal(response.statusCode, 200);
        assert.equal(response.body.cancelled.status, "cancelled");
        assert.match(patch.url, /owner_id=eq\.user-1/);
        assert.match(patch.url, /status=eq\.generating/, "hanya run yang masih generating boleh dibatalkan");
        assert.equal(patch.body.status, "failed");
        assert.match(patch.body.error_message, /Dibatalkan dari riwayat/);
        assert.ok(patch.body.finished_at);
    } finally {
        restore();
    }
});

test("cancel-run menolak run yang sudah selesai atau bukan milik akun ini", async () => {
    const restore = mockAuth({ id: "user-1", role: "USER", status: "active" }, async (url, options = {}) => {
        if (url.includes("/rest/v1/studio_medsos_access?")) return studioAccessActive("user-1");
        if (url.includes("/rest/v1/social_post_runs?")) return Response.json([]);
        throw new Error(`Unexpected fetch: ${url}`);
    });
    const response = makeResponse();
    try {
        await socialPublisherHandler({
            method: "POST",
            url: "/api/social-publisher?action=cancel-run",
            query: { action: "cancel-run" },
            headers: { authorization: "Bearer test-token" },
            body: { run_id: "run-2" },
            env
        }, response);
        assert.equal(response.statusCode, 409);
        assert.match(response.body.error, /tidak ditemukan/i);
        assert.ok(response.body.error.length > 10, "pesan error tidak boleh kosong");
    } finally {
        restore();
    }
});

test("riwayat menyediakan tombol Batalkan dan label pratinjau yang jujur", () => {
    const source = readFileSync(new URL("../admin-control/social-publisher.js", import.meta.url), "utf8");
    assert.match(source, /cancel\.textContent = "Batalkan"/);
    assert.match(source, /api\("cancel-run", \{ method: "POST", body: \{ run_id: run\.id \} \}\)/);
    assert.match(source, /const awaitingPublish = run\.status === "generating" && !run\.schedule_id && Boolean\(run\.caption\)/);
    assert.match(source, /label\.textContent = awaitingPublish \? "pratinjau siap"/);
    assert.match(source, /noticeOrphanPreview/);
    assert.match(source, /halaman di-refresh sehingga gambarnya hilang/);
});
