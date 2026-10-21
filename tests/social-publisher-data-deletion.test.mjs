import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import dataDeletionHandler from "../api/facebook-data-deletion.js";
import worker from "../functions/worker.mjs";
import {
    createSignedRequest,
    parseSignedRequest,
    SignedRequestError
} from "../lib/social-publisher/signed-request.js";
import {
    buildDeletionResponse,
    escapeHtml,
    FACEBOOK_DATA_DELETION_STEPS,
    generateConfirmationCode,
    renderStatusPage,
    resolvePublicOrigin
} from "../lib/social-publisher/data-deletion.js";

const env = {
    SUPABASE_URL: "https://project.example",
    SUPABASE_SERVICE_ROLE_KEY: "server-only-test-key",
    META_APP_SECRET: "meta-app-secret",
    META_REDIRECT_URI: "https://genzai.genzai-f37.workers.dev/api/facebook-oauth-callback"
};

const WORKER_SOURCE = readFileSync(
    fileURLToPath(new URL("../functions/worker.mjs", import.meta.url)),
    "utf8"
);
const MIGRATION = readFileSync(
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

function metaPayload(overrides = {}) {
    return {
        algorithm: "HMAC-SHA256",
        issued_at: Math.floor(Date.now() / 1000),
        user_id: "1234567890",
        ...overrides
    };
}

test("data deletion endpoint is routed on the Worker", () => {
    assert.match(WORKER_SOURCE, /\["\/api\/facebook-data-deletion", facebookDataDeletion\]/);
    assert.match(WORKER_SOURCE, /\["\/api\/data-deletion", facebookDataDeletion\]/);
    assert.match(WORKER_SOURCE, /import facebookDataDeletion from "\.\.\/api\/facebook-data-deletion\.js"/);
});

test("migration creates the identity mapping and deletion audit tables", () => {
    assert.match(MIGRATION, /create table if not exists public\.social_facebook_identities/);
    assert.match(MIGRATION, /create table if not exists public\.social_data_deletion_requests/);
    assert.match(MIGRATION, /confirmation_code text not null unique/);
    assert.match(MIGRATION, /deleted_counts jsonb not null default '\{\}'::jsonb/);
    assert.match(MIGRATION, /grant select, insert, update, delete on table public\.social_data_deletion_requests to service_role/);
    assert.match(MIGRATION, /alter table public\.social_data_deletion_requests enable row level security/);
});

test("confirmation codes are readable, unique-ish, and match the accepted pattern", () => {
    const first = generateConfirmationCode();
    const second = generateConfirmationCode();
    assert.equal(first.length, 16);
    assert.match(first, /^[A-Z0-9]{6,32}$/);
    assert.notEqual(first, second);
    // Deterministic bytes keep the test stable.
    assert.equal(generateConfirmationCode(new Uint8Array(16).fill(0)), "AAAAAAAAAAAAAAAA");
});

test("status URL is built from the public origin and the code", () => {
    assert.deepEqual(
        buildDeletionResponse("https://genzai.genzai-f37.workers.dev/", "ABCD2345EFGH6789"),
        {
            url: "https://genzai.genzai-f37.workers.dev/api/facebook-data-deletion?code=ABCD2345EFGH6789",
            confirmation_code: "ABCD2345EFGH6789"
        }
    );
});

test("public origin prefers the request host and falls back to configuration", () => {
    assert.equal(
        resolvePublicOrigin({ headers: { host: "genzai.genzai-f37.workers.dev" } }, {}),
        "https://genzai.genzai-f37.workers.dev"
    );
    assert.equal(
        resolvePublicOrigin({ headers: { host: "localhost:8787", "x-forwarded-proto": "http" } }, {}),
        "http://localhost:8787"
    );
    assert.equal(
        resolvePublicOrigin({ headers: {} }, { PUBLIC_SITE_URL: "https://genz.example" }),
        "https://genz.example"
    );
    assert.equal(
        resolvePublicOrigin({ headers: {} }, { META_REDIRECT_URI: "https://genzai.genzai-f37.workers.dev/api/facebook-oauth-callback" }),
        "https://genzai.genzai-f37.workers.dev"
    );
});

test("signed_request verification accepts a genuine Meta signature", async () => {
    const signed = await createSignedRequest(metaPayload(), env.META_APP_SECRET);
    const payload = await parseSignedRequest(signed, env.META_APP_SECRET);
    assert.equal(payload.user_id, "1234567890");
    assert.equal(payload.algorithm, "HMAC-SHA256");
});

test("signed_request verification rejects tampering, wrong secrets, and junk", async () => {
    const signed = await createSignedRequest(metaPayload(), env.META_APP_SECRET);
    const [signature, payload] = signed.split(".");
    const otherPayload = await createSignedRequest(metaPayload({ user_id: "999999999" }), env.META_APP_SECRET);

    await assert.rejects(
        parseSignedRequest(`${signature}.${otherPayload.split(".")[1]}`, env.META_APP_SECRET),
        error => error instanceof SignedRequestError && /tidak cocok/.test(error.message)
    );
    await assert.rejects(
        parseSignedRequest(payload ? signed : signed, "wrong-secret"),
        error => error instanceof SignedRequestError
    );
    await assert.rejects(parseSignedRequest("not-a-signed-request", env.META_APP_SECRET), SignedRequestError);
    await assert.rejects(parseSignedRequest("", env.META_APP_SECRET), SignedRequestError);
    await assert.rejects(
        parseSignedRequest(signed, ""),
        error => error.status === 503
    );
});

test("POST deletes Facebook data in FK-safe order and returns url + confirmation_code", async () => {
    const signed = await createSignedRequest(metaPayload(), env.META_APP_SECRET);
    const originalFetch = globalThis.fetch;
    const deletions = [];
    let created = null;
    let finished = null;

    globalThis.fetch = async (input, options = {}) => {
        const url = String(input);
        if (url.includes("/rest/v1/social_facebook_identities?select=owner_id")) {
            return Response.json([{ owner_id: "owner-1" }]);
        }
        if (url.endsWith("/rest/v1/social_data_deletion_requests?select=id,confirmation_code,status,requested_at")) {
            created = JSON.parse(options.body);
            assert.equal(created.status, "pending");
            assert.equal(created.fb_user_id, "1234567890");
            return Response.json([{
                id: "request-1",
                confirmation_code: created.confirmation_code,
                status: "pending",
                requested_at: "2026-10-21T14:30:00.000Z"
            }], { status: 201 });
        }
        if (url.includes("/rest/v1/social_post_runs?owner_id=eq.owner-1") && options.method === "DELETE") {
            deletions.push("social_post_runs");
            return Response.json([{ id: "run-1" }, { id: "run-2" }]);
        }
        if (url.includes("/rest/v1/social_post_schedules?owner_id=eq.owner-1") && options.method === "DELETE") {
            deletions.push("social_post_schedules");
            return Response.json([{ id: "schedule-1" }]);
        }
        if (url.includes("/rest/v1/social_page_connections?owner_id=eq.owner-1") && options.method === "DELETE") {
            deletions.push("social_page_connections");
            return Response.json([{ id: "connection-1" }]);
        }
        if (url.includes("/rest/v1/facebook_oauth_states?user_id=eq.owner-1") && options.method === "DELETE") {
            deletions.push("facebook_oauth_states");
            return Response.json([]);
        }
        if (url.includes("/rest/v1/social_facebook_identities?owner_id=eq.owner-1") && options.method === "DELETE") {
            deletions.push("social_facebook_identities");
            return Response.json([{ id: "owner-1" }]);
        }
        if (url.includes("/rest/v1/social_data_deletion_requests?id=eq.request-1") && options.method === "PATCH") {
            finished = JSON.parse(options.body);
            return new Response(null, { status: 204 });
        }
        throw new Error(`Unexpected fetch: ${url}`);
    };

    try {
        const response = makeResponse();
        await dataDeletionHandler({
            method: "POST",
            url: "/api/facebook-data-deletion",
            headers: { host: "genzai.genzai-f37.workers.dev", "content-type": "application/x-www-form-urlencoded" },
            body: new TextEncoder().encode(`signed_request=${encodeURIComponent(signed)}`),
            env
        }, response);

        assert.equal(response.statusCode, 200, JSON.stringify(response.body));
        assert.equal(response.body.confirmation_code, created.confirmation_code);
        assert.equal(
            response.body.url,
            `https://genzai.genzai-f37.workers.dev/api/facebook-data-deletion?code=${created.confirmation_code}`
        );
        assert.deepEqual(deletions, FACEBOOK_DATA_DELETION_STEPS.map(step => step.table));
        assert.equal(finished.status, "completed");
        assert.deepEqual(finished.matched_user_ids, ["owner-1"]);
        assert.equal(finished.deleted_counts.social_post_runs, 2);
        assert.equal(finished.deleted_counts.social_post_schedules, 1);
        assert.equal(finished.deleted_counts.social_facebook_identities, 1);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("POST rejects an invalid signature with 400 and deletes nothing", async () => {
    const originalFetch = globalThis.fetch;
    let requested = false;
    globalThis.fetch = async () => {
        requested = true;
        throw new Error("must not reach Supabase");
    };
    try {
        const response = makeResponse();
        await dataDeletionHandler({
            method: "POST",
            url: "/api/facebook-data-deletion",
            headers: { host: "genzai.genzai-f37.workers.dev" },
            body: "signed_request=ZmFrZS5wYXlsb2Fk",
            env
        }, response);

        assert.equal(response.statusCode, 400);
        assert.match(response.body.error, /tanda tangan|tidak valid/i);
        assert.equal(requested, false);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("POST requires signed_request and a configured app secret", async () => {
    const missingSignature = makeResponse();
    await dataDeletionHandler({
        method: "POST",
        url: "/api/facebook-data-deletion",
        headers: { host: "genzai.genzai-f37.workers.dev" },
        body: {},
        env
    }, missingSignature);
    assert.equal(missingSignature.statusCode, 400);
    assert.match(missingSignature.body.error, /signed_request wajib diisi/);

    const missingSecret = makeResponse();
    await dataDeletionHandler({
        method: "POST",
        url: "/api/facebook-data-deletion",
        headers: { host: "genzai.genzai-f37.workers.dev" },
        body: { signed_request: "a.b" },
        env: { SUPABASE_URL: env.SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY }
    }, missingSecret);
    assert.equal(missingSecret.statusCode, 503);
    assert.match(missingSecret.body.error, /META_APP_SECRET/);
});

test("GET renders the public instructions page with the callback URL", async () => {
    const response = makeResponse();
    await dataDeletionHandler({
        method: "GET",
        url: "/api/facebook-data-deletion",
        headers: { host: "genzai.genzai-f37.workers.dev", accept: "text/html" },
        env
    }, response);

    assert.equal(response.statusCode, 200);
    assert.match(response.headers["Content-Type"], /text\/html/);
    assert.match(response.body, /Penghapusan data pengguna/);
    assert.match(response.body, /https:\/\/genzai\.genzai-f37\.workers\.dev\/api\/facebook-data-deletion/);
    assert.match(response.body, /confirmation_code/);
});

test("GET ?code= renders the request status for the person", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input) => {
        const url = String(input);
        if (url.includes("/rest/v1/social_data_deletion_requests?select=")) {
            return Response.json([{
                confirmation_code: "ABCD2345EFGH6789",
                status: "completed",
                matched_user_ids: ["owner-1"],
                deleted_counts: { social_page_connections: 1, social_post_schedules: 1 },
                requested_at: "2026-10-21T14:30:00.000Z",
                completed_at: "2026-10-21T14:30:05.000Z"
            }]);
        }
        throw new Error(`Unexpected fetch: ${url}`);
    };
    try {
        const response = makeResponse();
        await dataDeletionHandler({
            method: "GET",
            url: "/api/facebook-data-deletion?code=abcd2345efgh6789",
            query: { code: "abcd2345efgh6789" },
            headers: { host: "genzai.genzai-f37.workers.dev", accept: "text/html" },
            env
        }, response);

        assert.equal(response.statusCode, 200);
        assert.match(response.body, /Selesai/);
        assert.match(response.body, /ABCD2345EFGH6789/);
        assert.match(response.body, /1<\/strong> baris/);
        assert.match(response.body, /Koneksi Facebook Page/);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("GET ?code= returns 404 for an unknown confirmation code", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => Response.json([]);
    try {
        const response = makeResponse();
        await dataDeletionHandler({
            method: "GET",
            url: "/api/facebook-data-deletion?code=ZZZZ2345EFGH6789",
            query: { code: "ZZZZ2345EFGH6789" },
            headers: { host: "genzai.genzai-f37.workers.dev", accept: "text/html" },
            env
        }, response);

        assert.equal(response.statusCode, 404);
        assert.match(response.body, /tidak ditemukan/i);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("only GET and POST are accepted", async () => {
    const response = makeResponse();
    await dataDeletionHandler({
        method: "PUT",
        url: "/api/facebook-data-deletion",
        headers: {},
        env
    }, response);
    assert.equal(response.statusCode, 405);
});

test("status page escapes attacker-controlled error text", () => {
    const page = renderStatusPage({
        request: {
            confirmation_code: "ABCD2345EFGH6789",
            status: "failed",
            matched_user_ids: ["owner-1"],
            deleted_counts: {},
            error_message: '<script>alert("xss")</script>',
            requested_at: "2026-10-21T14:30:00.000Z"
        },
        contact: { type: "chat", value: "/live-chat/" }
    });
    assert.doesNotMatch(page, /<script>alert/);
    assert.match(page, /&lt;script&gt;/);
    assert.equal(escapeHtml(`<a href="x">'&`), "&lt;a href=&quot;x&quot;&gt;&#39;&amp;");
});

test("the Worker serves the deletion pages over the real fetch handler", async () => {
    const instructions = await worker.fetch(
        new Request("https://genzai.genzai-f37.workers.dev/api/facebook-data-deletion", {
            headers: { accept: "text/html" }
        }),
        { META_APP_SECRET: "meta-app-secret" },
        {}
    );
    assert.equal(instructions.status, 200);
    assert.match(instructions.headers.get("content-type"), /text\/html/);
    assert.match(await instructions.text(), /facebook-data-deletion/);

    const alias = await worker.fetch(
        new Request("https://genzai.genzai-f37.workers.dev/api/data-deletion", {
            headers: { accept: "text/html" }
        }),
        { META_APP_SECRET: "meta-app-secret" },
        {}
    );
    assert.equal(alias.status, 200);

    const rejected = await worker.fetch(
        new Request("https://genzai.genzai-f37.workers.dev/api/facebook-data-deletion", {
            method: "POST",
            headers: { "content-type": "application/x-www-form-urlencoded" },
            body: "signed_request=ZmFrZS5wYXlsb2Fk"
        }),
        { META_APP_SECRET: "meta-app-secret" },
        {}
    );
    assert.equal(rejected.status, 400);
    assert.match((await rejected.json()).error, /tidak valid/i);
});
