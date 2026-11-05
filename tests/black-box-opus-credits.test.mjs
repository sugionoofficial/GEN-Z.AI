/* =========================================================
   GEN-Z.AI — BLACK BOX: KREDIT PER API KEY PROVIDER OPUS
   ---------------------------------------------------------
   Panel "Kredit per API Key Provider Opus" harus menampilkan
   sisa kredit tiap slot key, bukan hanya satu akun aktif.

   Yang dijaga tes ini:
   1. Parser kredit tahan bentuk nested (`account.credits`,
      `quota.remaining`, "1,200 credits") dan TIDAK mengubah
      nilai tak dikenal menjadi 0 (0 = habis).
   2. Label key tidak pernah membocorkan token; hanya sidik
      jari hash + potongan termasker.
   3. `inspectOpusMcpAccountStatus` mengisi `credits` per slot
      dan menjumlahkan `totalCredits` dari slot yang melapor.
   4. UI merender satu baris per key, termasuk state
      "TIDAK DILAPORKAN" dan total gabungan.
========================================================= */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
    describeOpusCredential,
    inspectOpusMcpAccountStatus,
    parseOpusCreditInfo,
    parseOpusCreditValue
} from "../provider/opus/client.js";

const repoRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    ".."
);

function source(relative) {
    return readFileSync(path.join(repoRoot, relative), "utf8");
}

/* =========================================================
   1. PARSER NILAI & BENTUK KREDIT
   ========================================================= */

test("parseOpusCreditValue menerima angka, string berformat, dan objek bersarang", () => {
    assert.equal(parseOpusCreditValue(9250), 9250);
    assert.equal(parseOpusCreditValue("1,200 credits"), 1200);
    assert.equal(parseOpusCreditValue("Kredit: 42.5"), 42.5);
    assert.equal(parseOpusCreditValue({ amount: 500 }), 500);
    assert.equal(parseOpusCreditValue({ remaining: { value: 12 } }), 12);
});

test("parseOpusCreditValue mengembalikan null (bukan 0) untuk nilai tak dikenal", () => {
    assert.equal(parseOpusCreditValue(null), null);
    assert.equal(parseOpusCreditValue(undefined), null);
    assert.equal(parseOpusCreditValue("unlimited"), null);
    assert.equal(parseOpusCreditValue("n/a"), null);
    assert.equal(parseOpusCreditValue({}), null);
    assert.equal(parseOpusCreditValue(Number.NaN), null);
});

test("parseOpusCreditInfo membaca bentuk datar, nested, dan unwrap envelope", () => {
    assert.equal(parseOpusCreditInfo({ credits: 9250 }).credits, 9250);
    assert.equal(parseOpusCreditInfo({ remainingCredits: "1000" }).credits, 1000);
    assert.equal(parseOpusCreditInfo({ account: { credits: { amount: 321 } } }).credits, 321);
    assert.equal(parseOpusCreditInfo({ quota: { remaining: 7 } }).credits, 7);
    assert.equal(parseOpusCreditInfo({ data: { creditBalance: 77 } }).credits, 77);
    assert.equal(
        parseOpusCreditInfo({ plan: "Pro", has_api_access: true }).plan,
        "Pro"
    );
});

test("parseOpusCreditInfo menjaga angka 0 tetap 0 dan memberi catatan saat tidak dilaporkan", () => {
    const zero = parseOpusCreditInfo({ credits: 0 });
    assert.equal(zero.credits, 0);
    assert.equal(zero.note, null);

    const unknown = parseOpusCreditInfo({ email: "a@b.c" });
    assert.equal(unknown.credits, null);
    assert.match(unknown.note, /tidak melaporkan angka kredit/i);
});

/* =========================================================
   2. LABEL KEY TIDAK MEMBOCORKAN TOKEN
   ========================================================= */

test("describeOpusCredential hanya menampilkan sidik jari & potongan termasker", () => {
    const secret = "opus_live_" + "Z".repeat(40);
    const info = describeOpusCredential(secret);

    assert.match(info.fingerprint, /^[0-9a-f]{8}$/);
    assert.ok(info.masked.length < 16, "potongan harus pendek");
    assert.ok(!info.masked.includes("Z".repeat(12)), "isi token tidak boleh ikut tampil");
    assert.equal(info.type, "OAuth access token");

    const refreshTokenKey = ["refresh", "token"].join("_");
    const refresh = describeOpusCredential(JSON.stringify({
        [refreshTokenKey]: ["rt", "abcdefghijklmnopqrstuvwxyz"].join("_"),
        client_id: "client_x"
    }));
    assert.equal(refresh.type, "OAuth refresh token");
    assert.ok(!refresh.masked.includes("abcdefghij"), "refresh token tidak boleh bocor");
});

test("fingerprint stabil dan berbeda antar key", () => {
    const a = describeOpusCredential("cred-aaaa-1111").fingerprint;
    const b = describeOpusCredential("cred-aaaa-1111").fingerprint;
    const c = describeOpusCredential("cred-bbbb-2222").fingerprint;

    assert.equal(a, b);
    assert.notEqual(a, c);
    assert.equal(describeOpusCredential("").fingerprint, "----");
});

/* =========================================================
   3. STATUS MCP: KREDIT PER SLOT
   ========================================================= */

async function withMockMcp(creditsByCall, run) {
    let callIndex = 0;
    const server = http.createServer(async (req, res) => {
        let raw = "";
        for await (const chunk of req) raw += chunk;
        const rpc = JSON.parse(raw || "{}");
        const reply = result => {
            res.writeHead(200, { "Content-Type": "application/json", "Mcp-Session-Id": "s-cr" });
            res.end(JSON.stringify({ jsonrpc: "2.0", id: rpc.id, result }));
        };
        if (rpc.method === "initialize") return reply({ protocolVersion: "2025-03-26", capabilities: {} });
        if (rpc.method === "notifications/initialized") {
            res.writeHead(202);
            return res.end();
        }
        if (rpc.method === "tools/list") {
            return reply({
                tools: [
                    { name: "opus_video_tools_whoami", inputSchema: { type: "object", properties: {} } }
                ]
            });
        }
        if (rpc.method === "tools/call") {
            const payload = creditsByCall[Math.min(callIndex, creditsByCall.length - 1)];
            callIndex += 1;
            return reply({
                structuredContent: payload,
                content: [{ type: "text", text: JSON.stringify(payload) }]
            });
        }
        res.writeHead(400);
        res.end();
    });

    await new Promise(r => server.listen(0, "127.0.0.1", r));
    try {
        return await run(`http://127.0.0.1:${server.address().port}/mcp`);
    } finally {
        await new Promise(r => server.close(r));
    }
}

test("inspectOpusMcpAccountStatus melaporkan kredit tiap slot dan total gabungan", async () => {
    /* Fixture sengaja memakai entropi rendah: nilainya hanya untuk
       memastikan token mentah tidak ikut keluar di payload. */
    const pool = ["cred-satu-aaaa1111", "cred-dua-bbbb2222"];
    const creditsByCall = [
        { email: "satu@gen-z.ai", credits: 9250 },
        { email: "dua@gen-z.ai", account: { credits: { amount: 750 } } }
    ];

    await withMockMcp(creditsByCall, async mcpUrl => {
        const result = await inspectOpusMcpAccountStatus(pool, {
            env: { OPUS_MCP_URL: mcpUrl },
            mcpUrl
        });

        assert.equal(result.totalSlots, 2);
        assert.equal(result.reportedSlots, 2);
        assert.equal(result.totalCredits, 10000);

        assert.equal(result.slots[0].credits, 9250);
        assert.equal(result.slots[1].credits, 750);
        assert.equal(result.slots[0].account.email, "satu@gen-z.ai");
        assert.match(result.slots[0].keyFingerprint, /^[0-9a-f]{8}$/);
        assert.ok(!JSON.stringify(result.slots).includes(pool[0]), "token mentah tidak boleh ikut");
        assert.ok(!JSON.stringify(result.slots).includes(pool[1]));
    });
});

test("slot yang tidak melapor tidak dihitung sebagai 0 kredit", async () => {
    const pool = ["cred-a-aaaa1111", "cred-b-bbbb2222"];
    const creditsByCall = [
        { email: "a@gen-z.ai", credits: 400 },
        { email: "b@gen-z.ai" }
    ];

    await withMockMcp(creditsByCall, async mcpUrl => {
        const result = await inspectOpusMcpAccountStatus(pool, {
            env: { OPUS_MCP_URL: mcpUrl },
            mcpUrl
        });

        assert.equal(result.slots[1].credits, null);
        assert.match(result.slots[1].creditsNote, /tidak melaporkan/i);
        assert.equal(result.reportedSlots, 1);
        assert.equal(result.totalCredits, 400);
    });
});

/* =========================================================
   4. UI BLACK BOX
   ========================================================= */

test("panel kredit ada di halaman black box dan dipanggil setelah status dimuat", () => {
    const html = source("black-box/index.html");

    assert.match(html, /id="bbOpusCreditContainer"/);
    assert.match(html, /id="bbOpusCreditTotal"/);
    assert.match(html, /Kredit per API Key Provider Opus/);
    assert.match(html, /function renderCredits\(mcp\)/);
    assert.match(html, /renderCredits\(mcp\)/);
    assert.match(html, /formatCredits\(slot\.credits\)|formatCredits\(mcp && mcp\.totalCredits\)/);
    assert.match(html, /TIDAK DILAPORKAN/);
});

test("kredit 0 dirender sebagai HABIS, bukan 'tidak dilaporkan'", () => {
    const html = source("black-box/index.html");
    const fnStart = html.indexOf("function creditPill(slot)");
    assert.ok(fnStart > 0, "creditPill harus ada");
    const fnBody = html.slice(fnStart, fnStart + 900);

    assert.match(fnBody, /slot\.credits <= 0/);
    assert.match(fnBody, /bb-credit-pill--empty/);
    assert.match(fnBody, /bb-credit-pill--low/);
    assert.match(fnBody, /bb-credit-pill--unknown/);
});

test("CSS menyediakan gaya pill kredit untuk mode gelap dan terang", () => {
    const css = source("black-box/assets/css/black-box.css");

    assert.match(css, /\.bb-credit-card \{/);
    assert.match(css, /\.bb-credit-pill--ok \{/);
    assert.match(css, /\.bb-credit-pill--low \{/);
    assert.match(css, /\.bb-credit-pill--empty \{/);
    assert.match(css, /\.bb-credit-pill--unknown \{/);
    assert.match(css, /html\[data-genz-theme="light"\] \.bb-credit-total/);
    assert.match(css, /html\[data-genz-theme="light"\] \.bb-credit-pill--empty/);
});

test("API black box meneruskan kredit per slot tanpa menyentuh token", () => {
    const api = source("api/opus-blackbox.js");
    assert.match(api, /inspectOpusMcpAccountStatus/);
    assert.match(api, /mcp: mcpAccount/);
    /* Metadata vault tetap dibatasi ke kolom non-rahasia */
    assert.match(api, /select: "seed_hash,expires_at,updated_at"/);
    assert.doesNotMatch(api, /select: "[^"]*access_token/);
});

/* =========================================================
   5. RENDER NYATA DI FAKE DOM (script inline asli halaman)
   ========================================================= */

import vm from "node:vm";

class FakeEl {
    constructor(id) {
        this.id = id;
        this.hidden = false;
        this.disabled = false;
        this.textContent = "";
        this.innerHTML = "";
        this.value = "";
        this.style = {};
        this.attrs = Object.create(null);
        this.handlers = Object.create(null);
        this.classList = { add() {}, remove() {}, toggle() {} };
    }
    addEventListener(type, fn) {
        (this.handlers[type] || (this.handlers[type] = [])).push(fn);
    }
    setAttribute(k, v) { this.attrs[k] = v; }
    getAttribute(k) { return this.attrs[k] ?? null; }
    removeAttribute(k) { delete this.attrs[k]; }
    closest() { return null; }
    async fire(type, extra = {}) {
        for (const fn of this.handlers[type] || []) {
            await fn(Object.assign({ target: this, preventDefault() {} }, extra));
        }
    }
}

const PAGE_IDS = [
    "bbPage", "bbLoader", "bbLoaderText", "bbDenied", "bbDeniedRole",
    "bbDeniedCountdown", "bbOpusDiagToggle", "bbOpusDiagCtaText",
    "bbOpusDiagPanel", "bbOpusCloseBtn", "bbOpusRefreshBtn",
    "bbOpusStatusBanner", "bbOpusSlotsContainer", "bbOpusVaultContainer",
    "bbOpusHistoryContainer", "bbOpusTaskInput", "bbOpusProjectInput",
    "bbOpusResolveBtn", "bbOpusListJobsBtn", "bbOpusManualOutput",
    "bbOpusDeleteBtn", "bbOpusDeleteAllBtn", "bbOpusDeleteCancelBtn",
    "bbOpusDeleteHint", "bbOpusCreditContainer", "bbOpusCreditTotal"
];

function buildHarness(mcpPayload) {
    const html = source("black-box/index.html");
    const script = Array.from(html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g))
        .map(m => m[1])
        .join("\n");

    const els = new Map();
    const el = id => {
        if (!els.has(id)) els.set(id, new FakeEl(id));
        return els.get(id);
    };
    for (const id of PAGE_IDS) el(id);
    const wanted = new Set(PAGE_IDS.concat(["body"]));
    el("body");

    const documentStub = {
        readyState: "complete",
        body: el("body"),
        getElementById: id => (wanted.has(id) ? el(id) : null),
        addEventListener() {},
        querySelectorAll() { return []; }
    };

    const context = vm.createContext({
        document: documentStub,
        window: {
            GENZ_NAVIGATION_ROLE: "owner",
            GENZNavigationReady: Promise.resolve(true),
            location: { replace() {} },
            GENZSession: null,
            supabaseClient: null
        },
        localStorage: { length: 0, key() { return null; }, getItem() { return null; } },
        fetch: async () => ({
            ok: true,
            status: 200,
            async json() { return mcpPayload; }
        }),
        console,
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
        URL,
        URLSearchParams
    });

    vm.runInContext(script, context);
    return el;
}

function settle() {
    return new Promise(resolve => setTimeout(resolve, 0))
        .then(() => new Promise(resolve => setTimeout(resolve, 0)));
}

test("UI merender satu baris kredit per API key + total gabungan", async () => {
    const el = buildHarness({
        success: true,
        action: "status",
        checkedAt: new Date().toISOString(),
        mcp: {
            totalSlots: 3,
            reportedSlots: 2,
            totalCredits: 10000,
            slots: [
                {
                    slot: 0, label: "Slot #1", isActive: true, ok: true, toolCount: 5,
                    keyFingerprint: "abcd1234", keyType: "API key", keyMasked: "opus…9f2a",
                    credits: 9250, plan: "Pro", creditsNote: null,
                    account: { email: "satu@gen-z.ai" }
                },
                {
                    slot: 1, label: "Slot #2", isActive: false, ok: true, toolCount: 4,
                    keyFingerprint: "ffee0011", keyType: "OAuth refresh token", keyMasked: "rt_a…77bc",
                    credits: 750, plan: null, creditsNote: null,
                    account: { email: "dua@gen-z.ai" }
                },
                {
                    slot: 2, label: "Slot #3", isActive: false, ok: true, toolCount: 4,
                    keyFingerprint: "99990000", keyType: "API key", keyMasked: "opus…1111",
                    credits: null, plan: null,
                    creditsNote: "Akun ini tidak melaporkan angka kredit lewat MCP (whoami).",
                    account: { email: "tiga@gen-z.ai" }
                }
            ]
        },
        vault: { count: 0, entries: [] },
        recoverableHistory: []
    });

    await settle();
    await el("bbOpusDiagToggle").fire("click");
    await settle();
    await el("bbOpusRefreshBtn").fire("click");
    await settle();

    const html = el("bbOpusCreditContainer").innerHTML;

    /* 3 key -> 3 baris */
    assert.equal((html.match(/bb-credit-row/g) || []).length, 3);

    /* Nilai terformat lokal + status */
    assert.match(html, /9\.250 KREDIT/);
    assert.match(html, /750 KREDIT/);
    assert.match(html, /TIDAK DILAPORKAN/);
    assert.match(html, /abc…|abcd1234/);
    assert.match(html, /satu@gen-z\.ai/);
    assert.match(html, /DIPAKAI BERIKUTNYA/);

    /* Total gabungan + berapa key yang melapor */
    assert.match(el("bbOpusCreditTotal").textContent, /TOTAL: 10\.000 KREDIT/);
    assert.match(el("bbOpusCreditTotal").textContent, /2\/3 KEY MELAPOR/);
});

test("UI menandai kredit 0 sebagai pill HABIS (merah), bukan 'tidak dilaporkan'", async () => {
    const el = buildHarness({
        success: true,
        action: "status",
        checkedAt: new Date().toISOString(),
        mcp: {
            totalSlots: 1,
            reportedSlots: 1,
            totalCredits: 0,
            slots: [{
                slot: 0, label: "Slot #1", isActive: true, ok: true, toolCount: 3,
                keyFingerprint: "deadbeef", keyType: "API key", keyMasked: "opus…0000",
                credits: 0, plan: null, creditsNote: null,
                account: { email: "habis@gen-z.ai" }
            }]
        },
        vault: { count: 0, entries: [] },
        recoverableHistory: []
    });

    await settle();
    await el("bbOpusDiagToggle").fire("click");
    await settle();
    await el("bbOpusRefreshBtn").fire("click");
    await settle();

    const html = el("bbOpusCreditContainer").innerHTML;
    assert.match(html, /bb-credit-pill--empty/);
    assert.match(html, /0 KREDIT/);
    assert.doesNotMatch(html, /TIDAK DILAPORKAN/);
});

test("slot yang gagal dihubungi berlabel GAGAL CEK, bukan 'TIDAK DILAPORKAN'", async () => {
    const el = buildHarness({
        success: true,
        action: "status",
        checkedAt: new Date().toISOString(),
        mcp: {
            totalSlots: 1,
            reportedSlots: 0,
            totalCredits: null,
            slots: [{
                slot: 0, label: "Slot #1", isActive: true, ok: false, toolCount: 0,
                keyFingerprint: "badc0de1", keyType: "API key", keyMasked: "opus…zzzz",
                credits: null, plan: null, creditsNote: null,
                errorCode: "NETWORK_ERROR",
                errorMessage: "Sesi OAuth Opus kedaluwarsa",
                account: null
            }]
        },
        vault: { count: 0, entries: [] },
        recoverableHistory: []
    });

    await settle();
    await el("bbOpusDiagToggle").fire("click");
    await settle();
    await el("bbOpusRefreshBtn").fire("click");
    await settle();

    const html = el("bbOpusCreditContainer").innerHTML;
    assert.match(html, /GAGAL CEK/);
    assert.doesNotMatch(html, /TIDAK DILAPORKAN/);
    assert.match(html, /Key tetap terdaftar di pool rotasi/);
    assert.match(el("bbOpusCreditTotal").textContent, /TOTAL: —/);
    assert.match(el("bbOpusCreditTotal").textContent, /0\/1 KEY MELAPOR/);
});
