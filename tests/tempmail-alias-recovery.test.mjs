import test from "node:test";
import assert from "node:assert/strict";
import worker from "../functions/worker.mjs";

/* =========================================================
   TEMPMAIL — ALIAS RECOVERY, PROVIDER FALLBACK, NORMALISASI
   ---------------------------------------------------------
   Provider yang dipakai aplikasi adalah Tempmail-MCP:
     POST /api/email?name=<provider>
     GET  /api/email/{email}/messages?token=..&name=..
     GET  /api/email/{email}/message/{id}?token=..&name=..

   Tes ini menjaga perilaku yang dulu membuat fitur TempMail
   terasa rusak:
   1. Reload halaman tidak lagi menghapus alamat email
      (action=alias mengembalikan alias tanpa membuat baru).
   2. Provider utama (gmail) yang sedang down tidak mematikan
      fitur — otomatis fallback ke provider sehat lain.
   3. Email bentrok dengan alias user lain diulang, bukan
      berakhir dengan error 502.
   4. Payload provider dinormalisasi supaya UI tidak menampilkan
      "(tanpa subject)" / tautan pesan kosong.
========================================================= */

const ENV = {
    TEMPMAIL_API_URL: "https://tempmail.test",
    SUPABASE_URL: "https://supabase.test",
    SUPABASE_ANON_KEY: "public-key",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key"
};

function tempmailRequest(userId, action, params = {}) {
    const url = new URL("https://app.test/api/tempmail");
    url.searchParams.set("action", action);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    return new Request(url, {
        method: action === "create" ? "POST" : "GET",
        headers: { Authorization: `Bearer ${userId}` }
    });
}

function jsonRequest(url, options = {}) {
    return new Request(url, options);
}

function makeHarness(options = {}) {
    const aliases = new Map(); // userId -> stored alias
    const created = [];
    const reads = [];
    const insertAttempts = [];
    let aliasInsertFailures = options.aliasInsertFailures || 0;
    let providerCreateCount = 0;

    const originalFetch = globalThis.fetch;

    globalThis.fetch = async (input, fetchOptions = {}) => {
        const url = new URL(input instanceof Request ? input.url : String(input));
        const method = fetchOptions.method || "GET";

        if (url.pathname === "/auth/v1/user") {
            const token = fetchOptions.headers.Authorization.replace(/^Bearer\s+/i, "");
            return Response.json({ id: token, email: `${token}@example.com` });
        }

        if (url.pathname === "/rest/v1/profiles") {
            const userId = url.searchParams.get("id").replace(/^eq\./, "");
            const role = options.roles?.[userId] || (userId === "user-c" ? "user" : "admin");
            return Response.json([{ role }]);
        }

        if (url.pathname === "/rest/v1/tempmail_user_aliases" && method === "GET") {
            const userId = url.searchParams.get("user_id").replace(/^eq\./, "");
            const emailFilter = url.searchParams.get("email");
            const alias = aliases.get(userId);
            return Response.json(
                alias && (!emailFilter || emailFilter === `eq.${alias.email}`) ? [alias] : []
            );
        }

        if (url.pathname === "/rest/v1/tempmail_user_aliases" && method === "POST") {
            const alias = JSON.parse(fetchOptions.body);
            insertAttempts.push(alias);

            if (aliasInsertFailures > 0) {
                aliasInsertFailures -= 1;
                return Response.json(
                    { code: "23505", message: "duplicate key value violates unique constraint" },
                    { status: 409 }
                );
            }

            aliases.set(alias.user_id, alias);
            return Response.json([alias], { status: 201 });
        }

        if (url.pathname === "/api/email" && method === "POST") {
            const providerName = url.searchParams.get("name") || "auto";
            created.push(providerName);
            providerCreateCount += 1;

            if (providerName === "gmail" && options.gmailBroken) {
                return Response.json(
                    { detail: "Provider 'gmail' failed: IMAP login rejected" },
                    { status: 503 }
                );
            }

            if (providerName === "gmail") {
                return Response.json({
                    email: `inbox+tag${providerCreateCount}@gmail.com`,
                    token: `tag${providerCreateCount}`,
                    provider: "gmail"
                });
            }

            return Response.json({
                email: `inbox${providerCreateCount}@mail.tm`,
                token: `tok${providerCreateCount}`,
                provider: "mail.tm"
            });
        }

        if (url.pathname.endsWith("/messages")) {
            reads.push(url);
            return Response.json({
                messages: [
                    {
                        id: "msg-1",
                        from_addr: "GitHub <noreply@github.com>",
                        subject: "Your verification code",
                        body_text: "Kode: 482913",
                        created_at: "1762000000"
                    }
                ]
            });
        }

        if (url.pathname.includes("/message/")) {
            reads.push(url);
            return Response.json({
                message: {
                    id: "msg-1",
                    from_addr: "GitHub <noreply@github.com>",
                    subject: "Your verification code",
                    body_html: "<p>Kode: <b>482913</b></p>",
                    created_at: "1762000000",
                    attachments: [
                        { filename: "kode.txt", content_type: "text/plain", size: 2048, url: null }
                    ]
                }
            });
        }

        throw new Error(`Unexpected fetch: ${method} ${url}`);
    };

    return {
        aliases,
        created,
        reads,
        insertAttempts,
        get providerCreateCount() {
            return providerCreateCount;
        },
        restore() {
            globalThis.fetch = originalFetch;
        }
    };
}

test("action=alias mengembalikan alias tersimpan tanpa membuat email baru", async () => {
    const harness = makeHarness();
    harness.aliases.set("admin-a", {
        user_id: "admin-a",
        email: "inbox+tag1@gmail.com",
        token: "tag1",
        provider: "gmail",
        created_at: "2026-11-01T00:00:00Z"
    });

    try {
        const response = await worker.fetch(tempmailRequest("admin-a", "alias"), ENV);
        const payload = await response.json();

        assert.equal(response.status, 200);
        assert.equal(payload.email, "inbox+tag1@gmail.com");
        assert.equal(payload.provider, "gmail");
        assert.equal(payload.createdAt, "2026-11-01T00:00:00Z");
        assert.equal(harness.providerCreateCount, 0);
    } finally {
        harness.restore();
    }
});

test("action=alias mengembalikan email null bila user belum punya alias", async () => {
    const harness = makeHarness();

    try {
        const response = await worker.fetch(tempmailRequest("admin-a", "alias"), ENV);
        const payload = await response.json();

        assert.equal(response.status, 200);
        assert.equal(payload.email, null);
        assert.equal(harness.providerCreateCount, 0);
    } finally {
        harness.restore();
    }
});

test("create memakai ulang alias yang sudah ada (reused) tanpa memanggil provider", async () => {
    const harness = makeHarness();
    harness.aliases.set("admin-a", {
        user_id: "admin-a",
        email: "inbox+tag1@gmail.com",
        token: "tag1",
        provider: "gmail"
    });

    try {
        const first = await worker.fetch(tempmailRequest("admin-a", "create"), ENV);
        const firstPayload = await first.json();
        const second = await worker.fetch(tempmailRequest("admin-a", "create"), ENV);
        const secondPayload = await second.json();

        assert.equal(first.status, 200);
        assert.equal(second.status, 200);
        assert.equal(firstPayload.email, "inbox+tag1@gmail.com");
        assert.equal(secondPayload.email, firstPayload.email);
        assert.equal(secondPayload.reused, true);
        assert.equal(harness.providerCreateCount, 0);
    } finally {
        harness.restore();
    }
});

test("provider gmail yang down otomatis fallback ke provider sehat lain", async () => {
    const harness = makeHarness({ gmailBroken: true });

    try {
        const created = await worker.fetch(tempmailRequest("admin-a", "create"), ENV);
        const createdPayload = await created.json();

        assert.equal(created.status, 200);
        assert.equal(createdPayload.email, "inbox2@mail.tm");
        assert.equal(createdPayload.provider, "mail.tm");
        assert.deepEqual(harness.created, ["gmail", "auto"]);

        const messages = await worker.fetch(
            tempmailRequest("admin-a", "messages", { email: createdPayload.email }),
            ENV
        );
        const messagesPayload = await messages.json();

        assert.equal(messages.status, 200);
        assert.deepEqual(messagesPayload, [
            {
                id: "msg-1",
                subject: "Your verification code",
                from: "GitHub <noreply@github.com>",
                to: "",
                preview: "Kode: 482913",
                createdAt: "1762000000"
            }
        ]);

        const readUrl = harness.reads[0];
        assert.equal(readUrl.searchParams.get("name"), "mail.tm");
        assert.equal(readUrl.searchParams.get("token"), "tok2");

        const message = await worker.fetch(
            tempmailRequest("admin-a", "message", {
                email: createdPayload.email,
                messageId: "msg-1"
            }),
            ENV
        );
        const messagePayload = await message.json();

        assert.equal(message.status, 200);
        assert.equal(messagePayload.subject, "Your verification code");
        assert.equal(messagePayload.bodyHtml, "<p>Kode: <b>482913</b></p>");
        assert.equal(messagePayload.bodyText, "");
        assert.deepEqual(messagePayload.attachments, [
            { filename: "kode.txt", contentType: "text/plain", size: 2048, url: null }
        ]);
    } finally {
        harness.restore();
    }
});

test("email bentrok dengan alias user lain diulang sampai tersimpan", async () => {
    const harness = makeHarness({ aliasInsertFailures: 1 });

    try {
        const response = await worker.fetch(tempmailRequest("admin-a", "create"), ENV);
        const payload = await response.json();

        assert.equal(response.status, 200);
        assert.equal(harness.providerCreateCount, 2, "provider harus dipanggil dua kali");
        assert.equal(harness.insertAttempts.length, 2);
        assert.notEqual(harness.insertAttempts[0].email, harness.insertAttempts[1].email);
        assert.equal(payload.email, harness.insertAttempts[1].email);
        assert.equal(harness.aliases.get("admin-a").email, payload.email);
    } finally {
        harness.restore();
    }
});

test("TEMPMAIL_API_URL yang belum di-set memberi error konfigurasi yang jelas", async () => {
    const harness = makeHarness();
    const env = { ...ENV, TEMPMAIL_API_URL: "" };

    try {
        const response = await worker.fetch(tempmailRequest("admin-a", "create"), env);
        const payload = await response.json();

        assert.equal(response.status, 500);
        assert.match(payload.error, /TEMPMAIL_API_URL/);
        assert.equal(harness.providerCreateCount, 0);
    } finally {
        harness.restore();
    }
});

test("user biasa tidak bisa membaca alias walau request menebak email admin", async () => {
    const harness = makeHarness();
    harness.aliases.set("admin-a", {
        user_id: "admin-a",
        email: "inbox+tag1@gmail.com",
        token: "tag1",
        provider: "gmail"
    });

    try {
        const aliasResponse = await worker.fetch(tempmailRequest("user-c", "alias"), ENV);
        assert.equal(aliasResponse.status, 403);

        const readResponse = await worker.fetch(
            tempmailRequest("user-c", "messages", { email: "inbox+tag1@gmail.com" }),
            ENV
        );
        assert.equal(readResponse.status, 403);
        assert.equal(harness.reads.length, 0);
    } finally {
        harness.restore();
    }
});

test("respons API TempMail tidak di-cache dan membawa header keamanan worker", async () => {
    const harness = makeHarness();
    harness.aliases.set("admin-a", {
        user_id: "admin-a",
        email: "inbox+tag1@gmail.com",
        token: "tag1",
        provider: "gmail"
    });

    try {
        const response = await worker.fetch(tempmailRequest("admin-a", "alias"), ENV);

        assert.equal(response.status, 200);
        assert.match(String(response.headers.get("cache-control")), /no-store/);
        assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    } finally {
        harness.restore();
    }
});
