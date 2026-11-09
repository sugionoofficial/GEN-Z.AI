import assert from "node:assert/strict";
import test from "node:test";
import worker from "../functions/worker.mjs";

/* =========================================================
   TEMPMAIL — PROVIDER BAWAAN mail.tm (TANPA CODESPACE)
   ---------------------------------------------------------
   Yang dijaga:
   1. TEMPMAIL_API_URL kosong => Worker memakai api.mail.tm,
      bukan Tempmail-MCP / port-forward Codespaces.
   2. create/alias/messages/message tetap lewat gate role +
      isolasi user_id di Supabase.
   3. Kredensial mail.tm tidak bocor ke respons browser.
   4. Token 401 diperbarui lewat password yang tersimpan.
   5. Diagnostik memeriksa `builtin_mailtm`, bukan probe lama.
========================================================= */

function baseEnv(overrides = {}) {
    return {
        TEMPMAIL_API_URL: "",
        TEMPMAIL_PROVIDER: "mailtm",
        SUPABASE_URL: "https://supabase.test",
        SUPABASE_ANON_KEY: "public-key",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
        ...overrides
    };
}

function makeRequest(action, params = {}, { method, userId = "admin-a" } = {}) {
    const url = new URL("https://app.test/api/tempmail");
    url.searchParams.set("action", action);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    return new Request(url, {
        method: method || (action === "create" ? "POST" : "GET"),
        headers: { Authorization: `Bearer ${userId}` }
    });
}

const sampleMessage = {
    id: "msg-1",
    from: "sender@example.com",
    fromName: "Sender",
    subject: "Kode verifikasi",
    intro: "Kode Anda 123456",
    text: "Kode verifikasi Anda adalah 123456.",
    html: ["<p>Kode verifikasi Anda adalah <b>123456</b>.</p>"],
    createdAt: "2026-11-09T02:00:00.000Z",
    attachments: [{
        filename: "lampiran.txt",
        contentType: "text/plain",
        size: 12,
        downloadUrl: "https://api.mail.tm/attachments/lampiran.txt"
    }]
};

function makeHarness(options = {}) {
    const state = {
        aliases: new Map(),
        accounts: new Map(),
        messages: new Map(),
        tokenToAddress: new Map(),
        validTokens: new Set(),
        tokenCounter: 0,
        calls: []
    };

    const fetchImpl = async (input, init = {}) => {
        const url = new URL(input instanceof Request ? input.url : String(input));
        const method = init.method || "GET";
        const path = url.pathname;
        state.calls.push({ url: url.toString(), method, host: url.host });

        if (url.host === "supabase.test") {
            if (path === "/auth/v1/user") {
                const token = String(init.headers?.Authorization || "").replace(/^Bearer\s+/i, "");
                return Response.json({ id: token || "admin-a", email: "admin@example.com" });
            }
            if (path === "/rest/v1/profiles") {
                return Response.json([{ role: options.role || "admin" }]);
            }
            if (path === "/rest/v1/tempmail_user_aliases") {
                if (method === "GET") {
                    const userId = String(url.searchParams.get("user_id") || "eq.admin-a").slice(3);
                    const emailFilter = url.searchParams.get("email");
                    const alias = state.aliases.get(userId);
                    return Response.json(
                        alias && (!emailFilter || emailFilter === `eq.${alias.email}`)
                            ? [alias]
                            : []
                    );
                }
                if (method === "POST") {
                    const alias = JSON.parse(init.body);
                    if (state.aliases.has(alias.user_id)) return new Response(null, { status: 409 });
                    const saved = { ...alias, created_at: "2026-11-09T02:00:00.000Z" };
                    state.aliases.set(alias.user_id, saved);
                    return Response.json([saved], { status: 201 });
                }
                if (method === "PATCH") {
                    const email = String(url.searchParams.get("email") || "").replace(/^eq\./, "");
                    const patch = JSON.parse(init.body);
                    for (const [userId, alias] of state.aliases) {
                        if (alias.email === email) {
                            state.aliases.set(userId, { ...alias, token: patch.token });
                        }
                    }
                    return new Response(null, { status: 204 });
                }
            }
        }

        if (url.host === "api.mail.tm") {
            if (path === "/domains") {
                return Response.json({
                    "hydra:member": [{
                        domain: "mailtm.test",
                        isActive: true,
                        isPrivate: false
                    }]
                });
            }
            if (path === "/accounts" && method === "POST") {
                const { address, password } = JSON.parse(init.body);
                if (state.accounts.has(address)) {
                    return Response.json({ detail: "address already used" }, { status: 422 });
                }
                state.accounts.set(address, { password });
                return Response.json({ id: "acct-1", address }, { status: 201 });
            }
            if (path === "/token" && method === "POST") {
                const { address, password } = JSON.parse(init.body);
                const account = state.accounts.get(address);
                if (!account || account.password !== password) {
                    return Response.json({ detail: "bad credentials" }, { status: 401 });
                }
                state.tokenCounter += 1;
                const token = `tok-${state.tokenCounter}`;
                state.validTokens.add(token);
                state.tokenToAddress.set(token, address);
                return Response.json({ token });
            }
            if (path === "/messages" && method === "GET") {
                const token = String(init.headers?.Authorization || "").replace(/^Bearer\s+/i, "");
                if (!state.validTokens.has(token)) {
                    return Response.json({ detail: "expired token" }, { status: 401 });
                }
                const address = state.tokenToAddress.get(token);
                const messages = state.messages.get(address) || [];
                return Response.json({
                    "hydra:member": messages.map(item => ({
                        id: item.id,
                        from: { name: item.fromName, address: item.from },
                        to: [{ address }],
                        subject: item.subject,
                        intro: item.intro,
                        createdAt: item.createdAt
                    }))
                });
            }
            if (path.startsWith("/messages/") && method === "GET") {
                const token = String(init.headers?.Authorization || "").replace(/^Bearer\s+/i, "");
                if (!state.validTokens.has(token)) {
                    return Response.json({ detail: "expired token" }, { status: 401 });
                }
                const id = decodeURIComponent(path.slice("/messages/".length));
                const address = state.tokenToAddress.get(token);
                const item = (state.messages.get(address) || []).find(entry => entry.id === id);
                if (!item) return Response.json({ detail: "not found" }, { status: 404 });
                return Response.json({
                    id,
                    from: { name: item.fromName, address: item.from },
                    to: [{ address }],
                    subject: item.subject,
                    text: item.text,
                    html: item.html,
                    createdAt: item.createdAt,
                    attachments: item.attachments
                });
            }
        }

        throw new Error(`Unexpected fetch: ${method} ${url}`);
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchImpl;
    return { state, restore: () => { globalThis.fetch = originalFetch; } };
}

async function createAlias(env = baseEnv()) {
    return worker.fetch(makeRequest("create"), env);
}

test("diagnostik tanpa TEMPMAIL_API_URL memakai builtin_mailtm dan lulus", async () => {
    const h = makeHarness();
    try {
        const res = await worker.fetch(makeRequest("diagnostics"), baseEnv());
        const data = await res.json();

        assert.equal(res.status, 200);
        assert.equal(data.ok, true);
        assert.equal(data.config.tempmail_api_url, false);
        assert.equal(data.config.builtin_mailtm, true);
        assert.deepEqual(
            data.checks.map(check => check.name),
            ["supabase_profiles", "supabase_aliases_table", "builtin_mailtm"]
        );
        assert.ok(data.checks.every(check => check.ok));
        assert.match(data.checks[2].detail, /mailtm\.test/);
        assert.equal(stateCallsToExternal(h.state).length, 0);
    } finally {
        h.restore();
    }
});

function stateCallsToExternal(state) {
    return state.calls.filter(call =>
        call.host !== "api.mail.tm" && call.host !== "supabase.test" && call.host !== "app.test"
    );
}

test("create tanpa secret menghasilkan alias mail.tm; kredensial tidak bocor", async () => {
    const h = makeHarness();
    try {
        const res = await createAlias();
        const data = await res.json();

        assert.equal(res.status, 200);
        assert.equal(data.reused, false);
        assert.equal(data.provider, "mailtm");
        assert.match(data.email, /^[a-z0-9]{10}@mailtm\.test$/);
        assert.equal("token" in data, false);
        assert.equal("password" in data, false);
        assert.doesNotMatch(JSON.stringify(data), /tok-1|password/);

        const saved = h.state.aliases.get("admin-a");
        assert.ok(saved);
        const credentials = JSON.parse(saved.token);
        assert.equal(credentials.token, "tok-1");
        assert.equal(credentials.password.length, 20);

        const aliasRes = await worker.fetch(makeRequest("alias"), baseEnv());
        const aliasData = await aliasRes.json();
        assert.equal(aliasData.email, data.email);
        assert.equal(aliasData.provider, "mailtm");
    } finally {
        h.restore();
    }
});

test("messages dan message dibaca langsung dari api.mail.tm", async () => {
    const h = makeHarness();
    try {
        const created = await (await createAlias()).json();
        h.state.messages.set(created.email, [sampleMessage]);

        const listRes = await worker.fetch(
            makeRequest("messages", { email: created.email }),
            baseEnv()
        );
        const list = await listRes.json();

        assert.equal(listRes.status, 200);
        assert.equal(list.length, 1);
        assert.equal(list[0].id, "msg-1");
        assert.equal(list[0].subject, "Kode verifikasi");
        assert.equal(list[0].from, "Sender <sender@example.com>");
        assert.equal(list[0].preview, "Kode Anda 123456");

        const detailRes = await worker.fetch(
            makeRequest("message", { email: created.email, messageId: "msg-1" }),
            baseEnv()
        );
        const detail = await detailRes.json();

        assert.equal(detailRes.status, 200);
        assert.equal(detail.bodyText, "Kode verifikasi Anda adalah 123456.");
        assert.match(detail.bodyHtml, /<b>123456<\/b>/);
        assert.equal(detail.attachments[0].filename, "lampiran.txt");
        assert.equal(detail.attachments[0].url, "https://api.mail.tm/attachments/lampiran.txt");
    } finally {
        h.restore();
    }
});

test("token mail.tm 401 diperbarui otomatis lewat password tersimpan", async () => {
    const h = makeHarness();
    try {
        const created = await (await createAlias()).json();
        h.state.messages.set(created.email, [sampleMessage]);
        h.state.validTokens.delete("tok-1");

        const res = await worker.fetch(
            makeRequest("messages", { email: created.email }),
            baseEnv()
        );
        const list = await res.json();

        assert.equal(res.status, 200);
        assert.equal(list.length, 1);
        assert.ok(h.state.calls.some(call => call.method === "PATCH"));
        const refreshed = JSON.parse(h.state.aliases.get("admin-a").token);
        assert.equal(refreshed.token, "tok-2");
        assert.equal(refreshed.password.length, 20);
    } finally {
        h.restore();
    }
});

test("gate role admin/owner tetap aktif pada mode bawaan", async () => {
    const h = makeHarness({ role: "user" });
    try {
        const res = await worker.fetch(makeRequest("create"), baseEnv());
        const data = await res.json();

        assert.equal(res.status, 403);
        assert.match(data.error, /hanya tersedia untuk role admin atau owner/);
    } finally {
        h.restore();
    }
});

test("user lain tidak bisa membaca alias milik user A", async () => {
    const h = makeHarness();
    try {
        const created = await (await createAlias()).json();
        const res = await worker.fetch(
            makeRequest("messages", { email: created.email }, { userId: "user-b" }),
            baseEnv()
        );
        const data = await res.json();

        assert.equal(res.status, 404);
        assert.match(data.error, /Email tidak ditemukan untuk akun ini/);
    } finally {
        h.restore();
    }
});

test("tanpa secret dan tanpa flag mailtm, kebutuhan @gmail.com tetap dijaga", async () => {
    const h = makeHarness();
    const env = baseEnv();
    delete env.TEMPMAIL_PROVIDER;
    try {
        const diag = await (await worker.fetch(makeRequest("diagnostics"), env)).json();
        assert.equal(diag.ok, false);
        assert.equal(diag.config.builtin_mailtm, false);
        assert.deepEqual(
            diag.checks.map(check => check.name),
            ["supabase_profiles", "supabase_aliases_table", "tempmail_provider"]
        );
        assert.match(diag.checks[2].hint, /@gmail\.com/);
        assert.match(diag.checks[2].hint, /persisten/);

        const res = await worker.fetch(makeRequest("create"), env);
        const payload = await res.json();
        assert.equal(res.status, 500);
        assert.match(payload.error, /TEMPMAIL_API_URL/);
        assert.match(payload.error, /@gmail\.com/);
        assert.equal(h.state.aliases.size, 0);
    } finally {
        h.restore();
    }
});

test("TEMPMAIL_PROVIDER=mailtm memaksa mode bawaan walaupun secret ada", async () => {
    const h = makeHarness();
    try {
        const res = await worker.fetch(
            makeRequest("diagnostics"),
            baseEnv({
                TEMPMAIL_API_URL: "https://legacy.example.com",
                TEMPMAIL_PROVIDER: "mailtm"
            })
        );
        const data = await res.json();

        assert.equal(data.config.builtin_mailtm, true);
        assert.deepEqual(
            data.checks.map(check => check.name),
            ["supabase_profiles", "supabase_aliases_table", "builtin_mailtm"]
        );
        assert.equal(data.ok, true);
    } finally {
        h.restore();
    }
});
