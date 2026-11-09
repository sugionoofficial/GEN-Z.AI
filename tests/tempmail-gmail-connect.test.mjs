import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import worker from "../functions/worker.mjs";
import { buildGmailAuthUrl } from "../functions/_shared/gmail-provider.js";

/* =========================================================
   TEMPMAIL — MODE C "HUBUNGKAN GMAIL"
   ---------------------------------------------------------
   Regresi untuk permintaan: koneksikan akun Gmail di /email.html,
   admin cukup generate akhiran +tag, inbox @gmail.com muncul di
   halaman yang sama. Tidak boleh ada Docker/Codespace/host eksternal,
   refresh token tidak boleh bocor ke browser, dan pesan mailbox lain
   tidak boleh terbaca lewat messageId yang ditebak.
========================================================= */

const ROOT = process.cwd();
const CLIENT_ID = "client-id.apps.googleusercontent.com";
const CLIENT_SECRET = "client-secret-rahasia";
const ENCRYPTION_KEY = "a".repeat(64);
const CALLBACK = "https://app.test/api/tempmail-gmail-callback";
const ACCOUNT = "sugionoofficial88@gmail.com";
const ALIAS = "sugionoofficial88+1@gmail.com";
const OTHER_ALIAS = "sugionoofficial88+other@gmail.com";
const REFRESH_TOKEN = "refresh-token-plaintext-jangan-bocor";

function gmailEnv(overrides = {}) {
    return {
        SUPABASE_URL: "https://supabase.test",
        SUPABASE_ANON_KEY: "public-key",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
        GMAIL_CLIENT_ID: CLIENT_ID,
        GMAIL_CLIENT_SECRET: CLIENT_SECRET,
        PROVIDER_CREDENTIAL_ENCRYPTION_KEY: ENCRYPTION_KEY,
        GMAIL_OAUTH_REDIRECT_URI: CALLBACK,
        ...overrides
    };
}

function b64url(text) {
    return Buffer.from(String(text), "utf8").toString("base64url");
}

function request(url, { method = "GET", userId = "admin-a" } = {}) {
    return new Request(url, {
        method,
        headers: { Authorization: `Bearer ${userId}` }
    });
}

function metadataMessage(id, subject, recipient) {
    return {
        id,
        snippet: subject + " untuk " + recipient,
        headers: [
            { name: "From", value: "sender@example.com" },
            { name: "To", value: recipient },
            { name: "Delivered-To", value: recipient },
            { name: "Subject", value: subject },
            { name: "Date", value: "Sat, 08 Nov 2026 10:00:00 +0000" }
        ]
    };
}

function fullMessage(id, recipient, text) {
    return {
        id,
        headers: [
            { name: "From", value: "sender@example.com" },
            { name: "To", value: recipient },
            { name: "Delivered-To", value: recipient },
            { name: "Subject", value: "Kode verifikasi" },
            { name: "Date", value: "Sat, 08 Nov 2026 10:00:00 +0000" }
        ],
        payload: {
            mimeType: "text/plain",
            headers: [],
            body: { data: b64url(text), size: text.length }
        }
    };
}

function makeHarness(options = {}) {
    const state = {
        connections: new Map(),
        aliases: new Map(),
        calls: [],
        gmailQueries: []
    };

    const fetchImpl = async (input, fetchOptions = {}) => {
        const url = new URL(input instanceof Request ? input.url : String(input));
        const method = fetchOptions.method || "GET";
        const headers = fetchOptions.headers || {};
        state.calls.push({ url: url.toString(), method, body: fetchOptions.body || "" });

        if (url.pathname === "/auth/v1/user") {
            const token = String(headers.Authorization || "").replace(/^Bearer\s+/i, "");
            return Response.json({ id: token || "admin-a", email: "admin@example.com" });
        }

        if (url.pathname === "/rest/v1/profiles") {
            return Response.json([{ role: options.role || "admin" }]);
        }

        if (url.pathname === "/rest/v1/tempmail_user_aliases") {
            if (method === "GET") {
                if (!url.searchParams.has("user_id")) return Response.json([]);
                const userId = String(url.searchParams.get("user_id") || "").replace(/^eq\./, "");
                const emailFilter = url.searchParams.get("email");
                const alias = state.aliases.get(userId);
                return Response.json(
                    alias && (!emailFilter || emailFilter === `eq.${alias.email}`) ? [alias] : []
                );
            }
            if (method === "POST") {
                const alias = JSON.parse(fetchOptions.body);
                const prefer = String(headers.Prefer || "");
                if (prefer.includes("merge-duplicates") || !state.aliases.has(alias.user_id)) {
                    state.aliases.set(alias.user_id, { ...alias, created_at: "2026-11-08T10:00:00Z" });
                }
                return Response.json([state.aliases.get(alias.user_id)], { status: 201 });
            }
            if (method === "DELETE") {
                const userId = String(url.searchParams.get("user_id") || "").replace(/^eq\./, "");
                state.aliases.delete(userId);
                return new Response(null, { status: 204 });
            }
        }

        if (url.pathname === "/rest/v1/tempmail_gmail_connections") {
            if (method === "GET") {
                if (!url.searchParams.has("user_id")) return Response.json([]);
                const userId = String(url.searchParams.get("user_id") || "").replace(/^eq\./, "");
                const connection = state.connections.get(userId);
                return Response.json(connection ? [connection] : []);
            }
            if (method === "POST") {
                const row = JSON.parse(fetchOptions.body);
                state.connections.set(row.user_id, {
                    user_id: row.user_id,
                    email: row.email,
                    refresh_token_ciphertext: row.refresh_token_ciphertext,
                    refresh_token_iv: row.refresh_token_iv
                });
                return new Response(null, { status: 204 });
            }
            if (method === "DELETE") {
                const userId = String(url.searchParams.get("user_id") || "").replace(/^eq\./, "");
                state.connections.delete(userId);
                return new Response(null, { status: 204 });
            }
        }

        if (url.host === "oauth2.googleapis.com" && url.pathname === "/token") {
            const body = new URLSearchParams(String(fetchOptions.body || ""));
            if (body.get("grant_type") === "authorization_code") {
                assert.equal(body.get("client_id"), CLIENT_ID);
                assert.equal(body.get("client_secret"), CLIENT_SECRET);
                assert.equal(body.get("redirect_uri"), CALLBACK);
                return Response.json({
                    access_token: "oauth-access-token",
                    refresh_token: REFRESH_TOKEN
                });
            }
            assert.equal(body.get("grant_type"), "refresh_token");
            assert.equal(body.get("refresh_token"), REFRESH_TOKEN);
            return Response.json({ access_token: "gmail-access-token" });
        }

        if (url.host === "gmail.googleapis.com") {
            if (url.pathname.endsWith("/users/me/profile")) {
                return Response.json({ emailAddress: ACCOUNT });
            }
            if (url.pathname.endsWith("/users/me/messages")) {
                state.gmailQueries.push(url.searchParams.get("q") || "");
                return Response.json({
                    messages: [{ id: "m-ok" }, { id: "m-other" }]
                });
            }
            const messageId = decodeURIComponent(url.pathname.split("/").pop());
            if (url.searchParams.get("format") === "metadata") {
                return Response.json(
                    messageId === "m-ok"
                        ? metadataMessage("m-ok", "Kode verifikasi", ALIAS)
                        : metadataMessage("m-other", "Pesan orang lain", OTHER_ALIAS)
                );
            }
            return Response.json(
                messageId === "m-ok"
                    ? fullMessage("m-ok", ALIAS, "Kode OTP: 123456")
                    : fullMessage("m-other", OTHER_ALIAS, "Jangan tampilkan")
            );
        }

        throw new Error(`Unexpected fetch: ${method} ${url}`);
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchImpl;
    return { state, restore: () => { globalThis.fetch = originalFetch; } };
}

function oauthCookieValue(setCookieHeader) {
    return String(setCookieHeader || "").split(";")[0].trim();
}

async function connectGmail(h, env = gmailEnv(), userId = "admin-a") {
    const { authUrl, cookie } = await buildGmailAuthUrl(
        env,
        userId,
        "https://app.test/api/tempmail?action=gmail-connect"
    );
    const state = new URL(authUrl).searchParams.get("state");
    const callbackUrl = `${CALLBACK}?code=auth-code&state=${encodeURIComponent(state)}`;
    const res = await worker.fetch(new Request(callbackUrl, {
        headers: { Cookie: oauthCookieValue(cookie) }
    }), env);
    return { res, state, authUrl, cookie };
}

test("gmail-connect mengembalikan URL Google OAuth tanpa membocorkan secret", async () => {
    const h = makeHarness();
    try {
        const env = gmailEnv();
        const res = await worker.fetch(
            request("https://app.test/api/tempmail?action=gmail-connect"),
            env
        );
        const data = await res.json();
        const authUrl = new URL(String(data.authUrl || ""));

        assert.equal(res.status, 200);
        assert.equal(authUrl.hostname, "accounts.google.com");
        const setCookie = res.headers.get("Set-Cookie");
        assert.match(setCookie, /genzai_gmail_oauth=/);
        assert.match(setCookie, /HttpOnly/);
        assert.match(setCookie, /SameSite=Lax/);
        assert.match(setCookie, /Secure/);
        assert.equal(authUrl.searchParams.get("client_id"), CLIENT_ID);
        assert.equal(authUrl.searchParams.get("redirect_uri"), CALLBACK);
        assert.equal(authUrl.searchParams.get("response_type"), "code");
        assert.equal(authUrl.searchParams.get("scope"), "https://www.googleapis.com/auth/gmail.readonly");
        assert.equal(authUrl.searchParams.get("access_type"), "offline");
        assert.equal(authUrl.searchParams.get("prompt"), "consent");
        assert.ok(authUrl.searchParams.get("state"));
        assert.doesNotMatch(JSON.stringify(data), /client-secret-rahasia|PROVIDER_CREDENTIAL_ENCRYPTION_KEY|refresh-token/);
    } finally {
        h.restore();
    }
});

test("callback Google menyimpan refresh token terenkripsi dan status tidak membocorkannya", async () => {
    const h = makeHarness();
    try {
        const env = gmailEnv();
        const { res } = await connectGmail(h, env);

        assert.equal(res.status, 302);
        assert.equal(res.headers.get("Location"), "https://app.test/email.html?gmail=connected");
        assert.match(res.headers.get("Set-Cookie"), /genzai_gmail_oauth=.*Max-Age=0/);
        const stored = h.state.connections.get("admin-a");
        assert.ok(stored, "koneksi harus tersimpan");
        assert.equal(stored.email, ACCOUNT);
        assert.match(stored.refresh_token_ciphertext, /^[A-Za-z0-9_-]+$/);
        assert.match(stored.refresh_token_iv, /^[A-Za-z0-9_-]+$/);
        assert.notEqual(stored.refresh_token_ciphertext, REFRESH_TOKEN);
        assert.doesNotMatch(JSON.stringify(stored), /refresh-token-plaintext/);
        assert.equal(
            h.state.calls.every(call => !String(call.body).includes(REFRESH_TOKEN) ||
                call.url.startsWith("https://oauth2.googleapis.com/token")),
            true,
            "refresh token plaintext hanya boleh dikirim ke endpoint token Google, bukan Supabase"
        );

        const statusRes = await worker.fetch(
            request("https://app.test/api/tempmail?action=gmail-status"),
            env
        );
        const status = await statusRes.json();
        assert.equal(statusRes.status, 200);
        assert.deepEqual(status, { configured: true, connected: true, email: ACCOUNT });
        assert.doesNotMatch(JSON.stringify(status), /ciphertext|refresh_token|client-secret/);
    } finally {
        h.restore();
    }
});

test("callback menolak state OAuth yang tidak punya cookie browser yang sama", async () => {
    const h = makeHarness();
    try {
        const env = gmailEnv();
        const { authUrl } = await buildGmailAuthUrl(
            env,
            "admin-a",
            "https://app.test/api/tempmail?action=gmail-connect"
        );
        const state = new URL(authUrl).searchParams.get("state");
        const res = await worker.fetch(
            new Request(`${CALLBACK}?code=auth-code&state=${encodeURIComponent(state)}`),
            env
        );
        assert.equal(res.status, 302);
        assert.match(res.headers.get("Location"), /gmail=error/);
        assert.match(res.headers.get("Location"), /Sesi%20OAuth%20tidak%20cocok/);
        assert.equal(h.state.connections.has("admin-a"), false);
    } finally {
        h.restore();
    }
});

test("rotate membuat sugionoofficial88+1@gmail.com tanpa TEMPMAIL_API_URL atau host eksternal", async () => {
    const h = makeHarness();
    try {
        const env = gmailEnv();
        await connectGmail(h, env);

        const res = await worker.fetch(
            request("https://app.test/api/tempmail?action=rotate&tag=1", { method: "POST" }),
            env
        );
        const data = await res.json();

        assert.equal(res.status, 200);
        assert.equal(data.email, ALIAS);
        assert.equal(data.provider, "gmailapi");
        assert.equal(data.reused, false);
        assert.equal(h.state.aliases.get("admin-a").token, "");
        assert.match(data.email, /@gmail\.com$/);
        assert.doesNotMatch(data.email, /gamil\.com|mail\.tm/);
        assert.equal(
            h.state.calls.some(call => call.url.includes("tempmail.test") ||
                call.url.includes("api.mail.tm") || call.url.includes("app.github.dev")),
            false,
            "Mode C tidak boleh memanggil Tempmail-MCP, mail.tm, atau Codespace"
        );

        const reused = await worker.fetch(
            request("https://app.test/api/tempmail?action=create", { method: "POST" }),
            env
        );
        assert.equal((await reused.json()).reused, true);

        const invalid = await worker.fetch(
            request("https://app.test/api/tempmail?action=rotate&tag=nama%40gamil.com", { method: "POST" }),
            env
        );
        assert.equal(invalid.status, 400);
        assert.match((await invalid.json()).error, /Akhiran hanya boleh/);
    } finally {
        h.restore();
    }
});

test("inbox Gmail hanya menampilkan pesan untuk +tag milik alias aktif", async () => {
    const h = makeHarness();
    try {
        const env = gmailEnv();
        await connectGmail(h, env);
        await worker.fetch(
            request("https://app.test/api/tempmail?action=rotate&tag=1", { method: "POST" }),
            env
        );

        const listRes = await worker.fetch(
            request(`https://app.test/api/tempmail?action=messages&email=${encodeURIComponent(ALIAS)}`),
            env
        );
        const list = await listRes.json();

        assert.equal(listRes.status, 200);
        assert.equal(list.length, 1);
        assert.equal(list[0].id, "m-ok");
        assert.equal(list[0].to, ALIAS);
        assert.ok(h.state.gmailQueries.some(q => q === `to:${ALIAS}`));

        const detailRes = await worker.fetch(
            request(`https://app.test/api/tempmail?action=message&email=${encodeURIComponent(ALIAS)}&messageId=m-ok`),
            env
        );
        const detail = await detailRes.json();
        assert.equal(detailRes.status, 200);
        assert.equal(detail.bodyText, "Kode OTP: 123456");
        assert.equal(detail.to, ALIAS);

        const forbidden = await worker.fetch(
            request(`https://app.test/api/tempmail?action=message&email=${encodeURIComponent(ALIAS)}&messageId=m-other`),
            env
        );
        assert.equal(forbidden.status, 404);
        assert.match((await forbidden.json()).error, /Pesan tidak ditemukan/);
    } finally {
        h.restore();
    }
});

test("diagnostik Mode C lulus tanpa TEMPMAIL_API_URL dan tanpa probe host lama", async () => {
    const h = makeHarness();
    try {
        const env = gmailEnv();
        await connectGmail(h, env);
        const res = await worker.fetch(
            request("https://app.test/api/tempmail?action=diagnostics"),
            env
        );
        const data = await res.json();

        assert.equal(res.status, 200);
        assert.equal(data.ok, true);
        assert.equal(data.config.gmail_api_configured, true);
        assert.equal(data.config.active_provider, "gmailapi");
        assert.equal(data.config.tempmail_api_url, false);
        assert.deepEqual(
            data.checks.map(check => check.name),
            [
                "supabase_profiles",
                "supabase_aliases_table",
                "supabase_gmail_connections_table",
                "gmail_provider"
            ]
        );
        assert.ok(data.checks.every(check => check.ok));
        assert.equal(
            h.state.calls.some(call => call.url.includes("/api/health") ||
                call.url.includes("/api/providers") || call.url.includes("/openapi.json")),
            false
        );
    } finally {
        h.restore();
    }
});

test("gmail-disconnect menghapus koneksi dan alias; gate role tetap berlaku", async () => {
    const h = makeHarness();
    try {
        const env = gmailEnv();
        await connectGmail(h, env);
        await worker.fetch(
            request("https://app.test/api/tempmail?action=rotate&tag=1", { method: "POST" }),
            env
        );

        const disconnect = await worker.fetch(
            request("https://app.test/api/tempmail?action=gmail-disconnect", { method: "POST" }),
            env
        );
        assert.equal(disconnect.status, 200);
        assert.equal((await disconnect.json()).disconnected, true);
        assert.equal(h.state.connections.has("admin-a"), false);
        assert.equal(h.state.aliases.has("admin-a"), false);

        const status = await worker.fetch(
            request("https://app.test/api/tempmail?action=gmail-status"),
            env
        );
        assert.deepEqual(await status.json(), { configured: true, connected: false, email: null });

        const create = await worker.fetch(
            request("https://app.test/api/tempmail?action=create", { method: "POST" }),
            env
        );
        assert.equal(create.status, 400);
        assert.match((await create.json()).hint, /Hubungkan Gmail/);
    } finally {
        h.restore();
    }
});

test("Mode C hanya untuk admin/owner", async () => {
    const h = makeHarness({ role: "user" });
    try {
        const env = gmailEnv();
        const res = await worker.fetch(
            request("https://app.test/api/tempmail?action=gmail-connect"),
            env
        );
        assert.equal(res.status, 403);
        assert.match((await res.json()).error, /admin atau owner/);
    } finally {
        h.restore();
    }
});

test("UI, callback Worker, SQL, secret contoh, dan dokumentasi Mode C terpasang", () => {
    const page = fs.readFileSync(path.join(ROOT, "email.html"), "utf8");
    assert.match(page, /id="gmail-connect-box"/);
    assert.match(page, /id="btn-gmail-connect"/);
    assert.match(page, /id="btn-gmail-disconnect"/);
    assert.match(page, /id="gmail-tag-input"/);
    assert.match(page, /id="btn-gmail-rotate"/);
    assert.match(page, /action=gmail-status/);
    assert.match(page, /action=gmail-connect/);
    assert.match(page, /action=gmail-disconnect/);
    assert.match(page, /action=rotate/);
    assert.match(page, /params\.get\("gmail"\)/);
    assert.match(page, /result === "connected"/);
    assert.match(page, /accounts\.google\.com/);
    assert.match(page, /nama\+1@gmail\.com/);
    assert.doesNotMatch(page, /GMAIL_CLIENT_SECRET|refresh_token_ciphertext|gamil\.com/);
    assert.doesNotMatch(page, /list\.innerHTML/);

    const workerSource = fs.readFileSync(path.join(ROOT, "functions/worker.mjs"), "utf8");
    assert.match(workerSource, /\/api\/tempmail-gmail-callback/);
    assert.match(workerSource, /handleGmailOAuthCallback/);

    const handler = fs.readFileSync(path.join(ROOT, "functions/_shared/tempmail-handler.js"), "utf8");
    const provider = fs.readFileSync(path.join(ROOT, "functions/_shared/gmail-provider.js"), "utf8");
    assert.match(handler, /headers\.append\("Set-Cookie", cookie\)/);
    assert.match(provider, /verifyOAuthCookie/);
    assert.match(provider, /HttpOnly/);

    const sql = fs.readFileSync(path.join(ROOT, "supabase/tempmail-gmail-connections.sql"), "utf8");
    assert.match(sql, /create table if not exists public\.tempmail_gmail_connections/);
    assert.match(sql, /enable row level security/);
    assert.match(sql, /revoke all .* from public, anon, authenticated/);
    assert.match(sql, /grant all .* to service_role/);
    assert.match(sql, /pg_notify\('pgrst', 'reload schema'\)/);

    const example = fs.readFileSync(path.join(ROOT, ".dev.vars.example"), "utf8");
    assert.match(example, /GMAIL_CLIENT_ID/);
    assert.match(example, /GMAIL_CLIENT_SECRET/);
    assert.match(example, /GMAIL_OAUTH_REDIRECT_URI/);
    assert.match(example, /TEMPMAIL-GMAIL-CONNECT\.md/);

    const checker = fs.readFileSync(path.join(ROOT, "scripts/check-local-dev-vars.mjs"), "utf8");
    assert.match(checker, /GMAIL_CLIENT_ID/);
    assert.match(checker, /GMAIL_CLIENT_SECRET/);

    const guide = fs.readFileSync(path.join(ROOT, "TEMPMAIL-GMAIL-CONNECT.md"), "utf8");
    assert.match(guide, /Web application/);
    assert.match(guide, /gmail\.readonly/);
    assert.match(guide, /api\/tempmail-gmail-callback/);
    assert.match(guide, /PROVIDER_CREDENTIAL_ENCRYPTION_KEY/);
    assert.match(guide, /sugionoofficial88\+1@gmail\.com/);
    assert.match(guide, /Tanpa Docker/);
    assert.match(guide, /HttpOnly/);

    const setup = fs.readFileSync(path.join(ROOT, "TEMPMAIL-SETUP.md"), "utf8");
    assert.match(setup, /TEMPMAIL-GMAIL-CONNECT\.md/);
    assert.match(setup, /Mode C/);

    const docs = fs.readFileSync(path.join(ROOT, "docs/tempmail-setup.md"), "utf8");
    assert.match(docs, /Mode C/);
    assert.match(docs, /gmail_provider/);
    assert.doesNotMatch(docs, /belum diimplementasikan di sini/);

    const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
    assert.match(readme, /TEMPMAIL-GMAIL-CONNECT\.md/);
    assert.match(readme, /GMAIL_CLIENT_ID/);
});
