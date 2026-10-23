import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import socialPublisherHandler from "../api/social-publisher.js";
import { runSocialPublisherCron } from "../functions/_shared/social-publisher-cron.js";
import { encryptSecret } from "../lib/social-publisher/providers.js";

const env = {
    SUPABASE_URL: "https://project.example",
    SUPABASE_SERVICE_ROLE_KEY: "server-only-test-key",
    SUPABASE_ANON_KEY: "anon-test-key"
};

const migration = readFileSync(
    fileURLToPath(new URL("../supabase/social-autopublish-per-user.sql", import.meta.url)),
    "utf8"
);
const baseMigration = readFileSync(
    fileURLToPath(new URL("../supabase/social-auto-publisher.sql", import.meta.url)),
    "utf8"
);

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

function mockAuthAndFetch(profile, fetchHandler) {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, options = {}) => {
        const url = String(input);
        if (url.endsWith("/auth/v1/user")) return Response.json({ id: profile.id });
        if (url.includes("/rest/v1/profiles?select=id,role,status")) {
            return Response.json([profile]);
        }
        return fetchHandler(url, options);
    };
    return () => {
        globalThis.fetch = originalFetch;
    };
}

function studioAccessActive(userId) {
    return Response.json([{
        user_id: userId,
        is_active: true,
        started_at: new Date(Date.now() - 86400000).toISOString(),
        expires_at: new Date(Date.now() + 30 * 86400000).toISOString()
    }]);
}

test("migration adds a per-user autopublish column and keeps the global master switch", () => {
    assert.match(migration, /alter table public\.social_publisher_user_settings/);
    assert.match(migration, /add column if not exists autopublish_enabled boolean not null default true/);
    assert.match(migration, /create or replace function public\.claim_due_social_post_schedules/);
    assert.match(migration, /select u\.autopublish_enabled\s+from public\.social_publisher_user_settings u/);
    assert.match(migration, /where id = true and global_enabled = true/);
    assert.match(baseMigration, /autopublish_enabled boolean not null default true/);
    assert.match(baseMigration, /select u\.autopublish_enabled/);
});

test("set-autopublish only writes the caller's own settings row", async () => {
    let configTouched = false;
    const restoreFetch = mockAuthAndFetch(
        { id: "user-1", role: "USER", status: "active" },
        async (url, options = {}) => {
            if (url.includes("/rest/v1/studio_medsos_access?")) return studioAccessActive("user-1");
            if (url.includes("/rest/v1/social_publisher_user_settings?on_conflict=owner_id")) {
                assert.equal(options.method, "POST");
                const payload = JSON.parse(options.body);
                assert.equal(payload.owner_id, "user-1");
                assert.equal(payload.autopublish_enabled, false);
                return Response.json([{ owner_id: "user-1", autopublish_enabled: false, updated_at: payload.updated_at }], { status: 201 });
            }
            if (url.includes("/rest/v1/social_publisher_config")) configTouched = true;
            throw new Error(`Unexpected fetch: ${url}`);
        }
    );
    const response = makeResponse();
    try {
        await socialPublisherHandler({
            method: "POST",
            url: "/api/social-publisher?action=set-autopublish",
            query: { action: "set-autopublish" },
            headers: { authorization: "Bearer test-token" },
            body: { enabled: false },
            env
        }, response);

        assert.equal(response.statusCode, 200);
        assert.equal(response.body.autopublishEnabled, false);
        assert.equal(configTouched, false, "switch user tidak boleh menyentuh baris global");
    } finally {
        restoreFetch();
    }
});

test("set-autopublish enabling stops when provider secrets are missing", async () => {
    let wrote = false;
    const restoreFetch = mockAuthAndFetch(
        { id: "user-1", role: "USER", status: "active" },
        async (url, options = {}) => {
            if (url.includes("/rest/v1/studio_medsos_access?")) return studioAccessActive("user-1");
            if (url.includes("/rest/v1/social_publisher_config?select=image_provider")) {
                return Response.json([{ image_provider: "gemini", image_model: "" }]);
            }
            if (options.method === "POST") wrote = true;
            throw new Error(`Unexpected fetch: ${url}`);
        }
    );
    const response = makeResponse();
    try {
        await socialPublisherHandler({
            method: "POST",
            url: "/api/social-publisher?action=set-autopublish",
            query: { action: "set-autopublish" },
            headers: { authorization: "Bearer test-token" },
            body: { enabled: true },
            env
        }, response);

        assert.equal(response.statusCode, 409);
        assert.match(String(response.body.error || ""), /GEMINI_API_KEY/);
        assert.equal(wrote, false);
    } finally {
        restoreFetch();
    }
});

test("set-global-enabled rejects non-admin users and spares the shared config row", async () => {
    let configTouched = false;
    const restoreFetch = mockAuthAndFetch(
        { id: "user-1", role: "USER", status: "active" },
        async (url) => {
            if (url.includes("/rest/v1/studio_medsos_access?")) return studioAccessActive("user-1");
            if (url.includes("/rest/v1/social_publisher_config")) configTouched = true;
            throw new Error(`Unexpected fetch: ${url}`);
        }
    );
    const response = makeResponse();
    try {
        await socialPublisherHandler({
            method: "POST",
            url: "/api/social-publisher?action=set-global-enabled",
            query: { action: "set-global-enabled" },
            headers: { authorization: "Bearer test-token" },
            body: { enabled: false },
            env
        }, response);

        assert.equal(response.statusCode, 403);
        assert.equal(configTouched, false);
    } finally {
        restoreFetch();
    }
});

test("set-global-enabled lets an admin pause every account", async () => {
    const restoreFetch = mockAuthAndFetch(
        { id: "admin-user", role: "ADMIN", status: "active" },
        async (url, options = {}) => {
            if (url.includes("/rest/v1/studio_medsos_access?")) return studioAccessActive("admin-user");
            if (url.includes("/rest/v1/social_publisher_config?on_conflict=id")) {
                const payload = JSON.parse(options.body);
                assert.equal(payload.global_enabled, false);
                return Response.json([{ id: true, global_enabled: false, updated_at: payload.updated_at }], { status: 201 });
            }
            throw new Error(`Unexpected fetch: ${url}`);
        }
    );
    const response = makeResponse();
    try {
        await socialPublisherHandler({
            method: "POST",
            url: "/api/social-publisher?action=set-global-enabled",
            query: { action: "set-global-enabled" },
            headers: { authorization: "Bearer test-token" },
            body: { enabled: false },
            env
        }, response);

        assert.equal(response.statusCode, 200);
        assert.equal(response.body.globalEnabled, false);
    } finally {
        restoreFetch();
    }
});

test("dashboard exposes the caller's own switch separately from the master switch", async () => {
    const restoreFetch = mockAuthAndFetch(
        { id: "user-1", role: "USER", status: "active" },
        async (url) => {
            if (url.includes("/rest/v1/studio_medsos_access?")) return studioAccessActive("user-1");
            if (url.includes("/rest/v1/social_characters?")) return Response.json([]);
            if (url.includes("/rest/v1/social_page_connections?")) return Response.json([]);
            if (url.includes("/rest/v1/social_post_schedules?")) return Response.json([]);
            if (url.includes("/rest/v1/social_post_runs?")) return Response.json([]);
            if (url.includes("/rest/v1/social_publisher_config?")) {
                return Response.json([{ id: true, global_enabled: true, image_provider: "gemini", image_model: "", updated_at: null }]);
            }
            if (url.includes("/rest/v1/social_publisher_user_settings?")) {
                assert.match(url, /autopublish_enabled/);
                return Response.json([{ caption_template: "Halo", external_link: "", autopublish_enabled: false, updated_at: null }]);
            }
            if (url.includes("/rest/v1/social_outfits?")) return Response.json([]);
            if (url.includes("/storage/v1/bucket")) return Response.json([{ id: "social-character-references", public: false }]);
            throw new Error(`Unexpected fetch: ${url}`);
        }
    );
    const response = makeResponse();
    try {
        await socialPublisherHandler({
            method: "GET",
            url: "/api/social-publisher?action=dashboard",
            query: { action: "dashboard" },
            headers: { authorization: "Bearer test-token" },
            env
        }, response);

        assert.equal(response.statusCode, 200);
        assert.equal(response.body.autopublishEnabled, false);
        assert.equal(response.body.globalEnabled, true);
        assert.equal(response.body.canManageGlobalAutopublish, false);
    } finally {
        restoreFetch();
    }
});

test("dashboard treats a missing settings row as autopublish enabled", async () => {
    const restoreFetch = mockAuthAndFetch(
        { id: "admin-user", role: "ADMIN", status: "active" },
        async (url) => {
            if (url.includes("/rest/v1/studio_medsos_access?")) return studioAccessActive("admin-user");
            if (url.includes("/rest/v1/social_characters?")) return Response.json([]);
            if (url.includes("/rest/v1/social_page_connections?")) return Response.json([]);
            if (url.includes("/rest/v1/social_post_schedules?")) return Response.json([]);
            if (url.includes("/rest/v1/social_post_runs?")) return Response.json([]);
            if (url.includes("/rest/v1/social_publisher_config?")) {
                return Response.json([{ id: true, global_enabled: true, image_provider: "gemini", image_model: "", updated_at: null }]);
            }
            if (url.includes("/rest/v1/social_publisher_user_settings?")) return Response.json([]);
            if (url.includes("/rest/v1/social_outfits?")) return Response.json([]);
            if (url.includes("/storage/v1/bucket")) return Response.json([{ id: "social-character-references", public: false }]);
            throw new Error(`Unexpected fetch: ${url}`);
        }
    );
    const response = makeResponse();
    try {
        await socialPublisherHandler({
            method: "GET",
            url: "/api/social-publisher?action=dashboard",
            query: { action: "dashboard" },
            headers: { authorization: "Bearer test-token" },
            env
        }, response);

        assert.equal(response.statusCode, 200);
        assert.equal(response.body.autopublishEnabled, true);
        assert.equal(response.body.canManageGlobalAutopublish, true);
    } finally {
        restoreFetch();
    }
});

test("cron skips a claimed run when that owner disabled autopublish", async () => {
    const originalFetch = globalThis.fetch;
    const encryptionKey = btoa(String.fromCharCode(...new Uint8Array(32).fill(9)));
    const encryptedToken = await encryptSecret("page-token-secret", encryptionKey);
    const patches = [];
    let published = false;
    globalThis.fetch = async (input, options = {}) => {
        const url = String(input);
        if (url.endsWith("/rest/v1/rpc/claim_due_social_post_schedules")) {
            return Response.json([{ run_id: "run-9", schedule_id: "schedule-9" }]);
        }
        if (url.includes("/rest/v1/studio_medsos_access?")) return studioAccessActive("owner-9");
        if (url.includes("/rest/v1/social_post_schedules?") && options.method === "PATCH") {
            patches.push({ url, body: JSON.parse(options.body) });
            return Response.json([]);
        }
        if (url.includes("/rest/v1/social_post_schedules?")) {
            return Response.json([{
                id: "schedule-9",
                owner_id: "owner-9",
                character_id: "character-9",
                page_connection_id: "connection-9",
                enabled: true,
                interval_hours: 24,
                aspect_ratio: "9:16",
                caption_template: "Caption",
                timezone: "Asia/Jakarta"
            }]);
        }
        if (url.includes("/rest/v1/social_characters?")) {
            return Response.json([{
                id: "character-9",
                owner_id: "owner-9",
                display_name: "Alya",
                reference_object_key: "social-reference/owner-9/ref.jpg",
                reference_mime_type: "image/jpeg",
                garment_object_key: "",
                garment_mime_type: "",
                prompt_notes: ""
            }]);
        }
        if (url.includes("/rest/v1/social_page_connections?")) {
            return Response.json([{
                id: "connection-9",
                owner_id: "owner-9",
                page_id: "page-9",
                page_name: "Page 9",
                can_publish: true,
                page_token_ciphertext: encryptedToken.ciphertext,
                page_token_iv: encryptedToken.iv
            }]);
        }
        if (url.includes("/rest/v1/social_post_runs?") && options.method === "PATCH") {
            patches.push({ url, body: JSON.parse(options.body) });
            return Response.json([]);
        }
        if (url.includes("/rest/v1/social_post_runs?")) return Response.json([]);
        if (url.includes("/rest/v1/social_publisher_user_settings?")) {
            assert.match(url, /autopublish_enabled/);
            return Response.json([{ caption_template: "Caption", external_link: "", autopublish_enabled: false }]);
        }
        if (url.includes("/rest/v1/social_publisher_config?")) {
            return Response.json([{ image_provider: "gemini", image_model: "" }]);
        }
        if (url.includes("graph.facebook.com")) {
            published = true;
            return Response.json({ id: "photo-1" });
        }
        throw new Error(`Unexpected fetch: ${url}`);
    };
    try {
        const result = await runSocialPublisherCron({ ...env, SOCIAL_TOKEN_ENCRYPTION_KEY: encryptionKey }, new Date());
        assert.equal(result.claimed, 1);
        assert.equal(published, false, "tidak boleh ada panggilan ke Graph API");
        const runPatch = patches.filter(item => item.url.includes("social_post_runs")).at(-1);
        assert.equal(runPatch?.body?.status, "failed");
        assert.match(String(runPatch?.body?.error_message || ""), /Autopublish dinonaktifkan/);
    } finally {
        globalThis.fetch = originalFetch;
    }
});
