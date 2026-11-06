/* =========================================================
   GEN-Z.AI — BLACK BOX: HAPUS JOB OPUS MENGGANTUNG
   ---------------------------------------------------------
   Panel "Job Opus Menggantung / Gagal Terbaru" membaca
   generation_history (provider opus, status processing/queued/
   failed). Tanpa tombol hapus, daftar terus menumpuk.

   Alur yang dijaga:
   - DELETE  -> checkbox per baris -> CONFIRM -> hapus yang ditandai
   - DELETE ALL -> CONFIRM -> hapus semua yang AMAN
   - BATAL -> keluar dari mode tanpa menghapus
   - Job masih jalan & kredit belum kembali TIDAK boleh terhapus
   - Endpoint tetap wajib Owner/Admin

   Catatan: "hapus" di sini benar-benar menghapus baris dari
   generation_history (bukan sekadar disembunyikan), karena
   tujuannya menghentikan penumpukan data di sumbernya.
========================================================= */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import handler, { selectDeletableOpusHistory } from "../api/opus-blackbox.js";

const repoRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    ".."
);

function source(relative) {
    return readFileSync(path.join(repoRoot, relative), "utf8");
}

function row(id, overrides = {}) {
    return {
        id,
        userEmail: "user@example.com",
        modelId: "opus-audio-music",
        modelName: "Opus Music / Lagu AI (Lyria 3.5)",
        status: "failed",
        taskId: "opus:gen_" + id + ":job-" + id,
        projectId: "gen_" + id,
        jobId: "job-" + id,
        keySlot: 0,
        errorMessage: "Egress Gateway 400",
        creditCost: 500,
        creditRefunded: true,
        createdAt: "2026-11-03 05:00:00+00",
        ...overrides
    };
}

/* =========================================================
   1. GUARD PEMILIHAN BARIS (murni, tanpa I/O)
   ========================================================= */

test("hanya ID yang diminta yang masuk daftar hapus", () => {
    const rows = [row("a"), row("b"), row("c")];
    const { deletable, skipped } = selectDeletableOpusHistory(rows, {
        requestedIds: new Set(["a", "c"])
    });

    assert.deepEqual(deletable.map(r => r.id), ["a", "c"]);
    assert.deepEqual(skipped, []);
});

test("tanpa ID dan tanpa deleteAll tidak ada yang dihapus", () => {
    assert.deepEqual(
        selectDeletableOpusHistory([row("a")], {}).deletable,
        []
    );
    assert.deepEqual(
        selectDeletableOpusHistory(null, { deleteAll: true }).deletable,
        []
    );
});

test("job processing / queued dilewati supaya worker tidak rusak", () => {
    const rows = [
        row("a", { status: "processing", creditRefunded: false }),
        row("b", { status: "queued", creditRefunded: false }),
        row("c")
    ];

    const { deletable, skipped } = selectDeletableOpusHistory(rows, {
        deleteAll: true
    });

    assert.deepEqual(deletable.map(r => r.id), ["c"]);
    assert.deepEqual(
        skipped.map(s => s.reason),
        ["masih_berjalan", "masih_berjalan"]
    );
});

test("baris failed dengan kredit belum kembali dilewati", () => {
    const { deletable, skipped } = selectDeletableOpusHistory(
        [row("a", { creditRefunded: false, creditCost: 6000 }), row("b")],
        { deleteAll: true }
    );

    assert.deepEqual(deletable.map(r => r.id), ["b"]);
    assert.deepEqual(skipped[0].reason, "kredit_belum_kembali");
});

test("deleteAll mengabaikan requestedIds dan mengambil semua yang aman", () => {
    const rows = [row("a"), row("b"), row("c")];
    const { deletable } = selectDeletableOpusHistory(rows, {
        requestedIds: new Set(["a"]),
        deleteAll: true
    });

    assert.deepEqual(deletable.map(r => r.id), ["a", "b", "c"]);
});

/* =========================================================
   2. ENDPOINT /api/opus-blackbox action=delete_jobs
   ========================================================= */

function fakeRes() {
    return {
        statusCode: 200,
        headers: {},
        body: null,
        setHeader(key, value) {
            this.headers[key] = value;
        },
        end(payload) {
            this.body = payload;
            return this;
        }
    };
}

function jsonResponse(data, status = 200) {
    return {
        ok: status >= 200 && status < 300,
        status,
        async json() { return data; },
        async text() { return JSON.stringify(data); }
    };
}

function dbRows(ids) {
    return ids.map((id, index) => ({
        id,
        user_email: "user@example.com",
        model_id: "opus-audio-music",
        model_name: "Opus Music / Lagu AI (Lyria 3.5)",
        status: index === ids.length - 1 ? "processing" : "failed",
        task_id: "opus:gen_" + id + ":job-" + id,
        error_message: null,
        credit_cost: "500.00",
        credit_refunded: index === ids.length - 1 ? false : true,
        created_at: "2026-11-03 05:00:00+00"
    }));
}

function withMockFetch(candidates, deletedCount, role, callback) {
    const originalFetch = globalThis.fetch;
    const calls = [];

    globalThis.fetch = async function mockFetch(url, init = {}) {
        const target = String(url);
        const method = init.method || "GET";
        calls.push({ target, method, init });

        if (target.includes("/auth/v1/user")) {
            return jsonResponse({
                id: "admin-1",
                email: "owner@example.com",
                app_metadata: { role }
            });
        }
        if (target.includes("/rest/v1/profiles")) {
            return jsonResponse([{ id: "admin-1", role }]);
        }
        if (target.includes("/rest/v1/provider_credentials")) {
            return jsonResponse([]);
        }
        if (target.includes("/rest/v1/generation_history")) {
            if (method === "DELETE") {
                return jsonResponse(new Array(deletedCount).fill({ id: "gone" }));
            }
            return jsonResponse(candidates);
        }
        return jsonResponse({});
    };

    const req = {
        method: "POST",
        url: "/api/opus-blackbox",
        headers: { authorization: "Bearer test-jwt" },
        body: {},
        env: {
            SUPABASE_URL: "https://example.supabase.co",
            SUPABASE_SERVICE_ROLE_KEY: "service-key",
            SUPABASE_ANON_KEY: "anon-key"
        }
    };

    return Promise.resolve()
        .then(() => callback(req, calls))
        .finally(() => {
            globalThis.fetch = originalFetch;
        });
}

function parseBody(res) {
    return JSON.parse(res.body);
}

test("delete_jobs menghapus ID terpilih dan melewati job yang masih jalan", async () => {
    const candidates = dbRows(["aaa", "bbb", "ccc"]);

    await withMockFetch(candidates, 2, "owner", async (req, calls) => {
        req.body = {
            action: "delete_jobs",
            history_ids: ["aaa", "bbb", "ccc"]
        };

        const res = fakeRes();
        await handler(req, res);
        const payload = parseBody(res);

        assert.equal(res.statusCode, 200);
        assert.equal(payload.success, true);
        assert.equal(payload.deleted, 2);
        assert.equal(payload.skipped, 1);
        assert.equal(payload.skippedReasons[0].reason, "masih_berjalan");

        const del = calls.find(c => c.method === "DELETE");
        assert.ok(del, "harus ada request DELETE");
        assert.ok(del.target.includes("provider_id=eq.opus"));
        assert.ok(del.target.includes("in.%28aaa%2Cbbb%29") || del.target.includes("in.(aaa,bbb)"));
        assert.ok(!del.target.includes("ccc"), "job processing tidak boleh ikut dihapus");
    });
});

test("delete_all menghapus semua kandidat yang aman", async () => {
    await withMockFetch(dbRows(["aaa", "bbb", "ccc"]), 2, "owner", async (req, calls) => {
        req.body = { action: "delete_jobs", delete_all: true };

        const res = fakeRes();
        await handler(req, res);
        const payload = parseBody(res);

        assert.equal(payload.deleted, 2);
        assert.equal(payload.requested, 3);
        assert.equal(payload.skipped, 1);
        assert.ok(calls.some(c => c.method === "DELETE"));
    });
});

test("delete_jobs tanpa pilihan ditolak 400 sebelum menyentuh database", async () => {
    await withMockFetch([], 0, "owner", async (req, calls) => {
        req.body = { action: "delete_jobs", history_ids: [] };

        const res = fakeRes();
        await handler(req, res);
        const payload = parseBody(res);

        assert.equal(res.statusCode, 400);
        assert.equal(payload.success, false);
        assert.ok(!calls.some(c => c.method === "DELETE"));
    });
});

test("delete_jobs tetap menolak peran selain owner/admin", async () => {
    await withMockFetch([], 0, "user", async (req, calls) => {
        req.body = { action: "delete_jobs", delete_all: true };

        const res = fakeRes();
        await handler(req, res);
        const payload = parseBody(res);

        assert.equal(res.statusCode, 403);
        assert.equal(payload.success, false);
        assert.ok(!calls.some(c => c.method === "DELETE"));
    });
});

/* =========================================================
   3. GUARD SUMBER UI / CSS / API
   ========================================================= */

test("toolbar DELETE, DELETE ALL, BATAL dan checkbox ada di panel", () => {
    const html = source("black-box/index.html");

    assert.match(html, /id="bbOpusDeleteBtn"/);
    assert.match(html, /id="bbOpusDeleteAllBtn"/);
    assert.match(html, /id="bbOpusDeleteCancelBtn"/);
    assert.match(html, /id="bbOpusDeleteHint"/);
    assert.match(html, /data-delete-id=/);
    assert.match(html, /setDeleteMode\("select"\)/);
    assert.match(html, /setDeleteMode\("confirmAll"\)/);
    assert.match(html, /textContent = count > 0 \? "CONFIRM \(" \+ count \+ "\)" : "CONFIRM"/);
    assert.match(html, /deleteAllBtn\.textContent = "CONFIRM"/);
    assert.match(html, /action: "delete_jobs"/);
    assert.match(html, /delete_all: true/);

    /* 1-Klik Recovery lama tidak boleh hilang */
    assert.match(html, /data-recover-task=/);
    assert.match(html, /⚡ Pulihkan/);
});

test("pin CSS black-box dibump supaya gaya baru benar-benar termuat", () => {
    const html = source("black-box/index.html");

    assert.match(html, /black-box\.css\?v=openclips-oauth-20261106/);
    assert.doesNotMatch(html, /black-box\.css\?v=mobile-fit-20261102/);
    assert.doesNotMatch(html, /black-box\.css\?v=opus-history-delete-20261103/);
});

test("CSS menyediakan toolbar kanan-atas, checkbox, dan mode HP", () => {
    const css = source("black-box/assets/css/black-box.css");

    assert.match(css, /\.bb-history-head \{/);
    assert.match(css, /justify-content: space-between/);
    assert.match(css, /\.bb-history-check__box/);
    assert.match(css, /\.bb-diag-btn--danger/);
    assert.match(css, /\.bb-diag-row\.is-selected/);
    assert.match(css, /\.bb-diag-row\.is-pending-all/);
    assert.match(css, /\.bb-history-actions \[hidden\]/);
    assert.match(css, /html\[data-genz-theme="light"\] \.bb-history-check/);
    assert.match(css, /@media \(max-width: 720px\)/);
    assert.match(css, /min-height: 44px/);
});

test("endpoint delete_jobs ada sebelum pengecekan kredensial MCP", () => {
    const api = source("api/opus-blackbox.js");
    const marker = api.indexOf('if (action === "delete_jobs")');
    const credentialGate = api.indexOf('if (!opusApiKey)');

    assert.ok(marker > 0, "action delete_jobs harus ada");
    assert.ok(credentialGate > marker, "hapus tidak boleh butuh kredensial Opus Labs");
    assert.match(api, /provider_id", "eq\.opus"/);
    assert.match(api, /status", "in\.\(processing,queued,failed\)"/);
    assert.match(api, /requireAdminOrOwner: true/);
    assert.match(api, /delete_jobs`/);
});

/* =========================================================
   4. UJI ALUR UI (fake DOM, menjalankan script inline asli)
   ========================================================= */

import vm from "node:vm";

function extractInlineScript(html) {
    const blocks = Array.from(
        html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)
    );
    return blocks.map(match => match[1]).join("\n");
}

class FakeElement {
    constructor(id) {
        this.id = id;
        this.hidden = false;
        this.disabled = false;
        this.textContent = "";
        this.innerHTML = "";
        this.value = "";
        this.style = {};
        this.attrs = {};
        this.handlers = Object.create(null);
        this.classList = {
            add() {},
            remove() {},
            toggle() {}
        };
    }

    addEventListener(type, fn) {
        (this.handlers[type] || (this.handlers[type] = [])).push(fn);
    }

    setAttribute(key, value) {
        this.attrs[key] = value;
    }

    getAttribute(key) {
        return Object.prototype.hasOwnProperty.call(this.attrs, key)
            ? this.attrs[key]
            : null;
    }

    removeAttribute(key) {
        delete this.attrs[key];
    }

    closest() {
        return null;
    }

    async fire(type, extra = {}) {
        const list = this.handlers[type] || [];
        for (const fn of list) {
            await fn(Object.assign({
                target: this,
                preventDefault() {}
            }, extra));
        }
    }
}

const OPUS_IDS = [
    "bbPage", "bbLoader", "bbLoaderText", "bbDenied", "bbDeniedRole",
    "bbDeniedCountdown", "bbOpusDiagToggle", "bbOpusDiagCtaText",
    "bbOpusDiagPanel", "bbOpusCloseBtn", "bbOpusRefreshBtn",
    "bbOpusStatusBanner", "bbOpusSlotsContainer", "bbOpusVaultContainer",
    "bbOpusHistoryContainer", "bbOpusTaskInput", "bbOpusProjectInput",
    "bbOpusResolveBtn", "bbOpusListJobsBtn", "bbOpusManualOutput",
    "bbOpusDeleteBtn", "bbOpusDeleteAllBtn", "bbOpusDeleteCancelBtn",
    "bbOpusDeleteHint", "bbOpusCreditContainer", "bbOpusCreditTotal"
];

function buildUiHarness(candidates) {
    const html = source("black-box/index.html");
    const script = extractInlineScript(html);
    const elements = new Map();

    function el(id) {
        if (!elements.has(id)) elements.set(id, new FakeElement(id));
        return elements.get(id);
    }

    for (const id of OPUS_IDS) el(id);
    const body = el("body");

    const wanted = new Set(OPUS_IDS.concat(["body"]));
    const fetchCalls = [];

    const documentStub = {
        readyState: "complete",
        body,
        getElementById(id) {
            return wanted.has(id) ? el(id) : null;
        },
        addEventListener() {},
        querySelectorAll() {
            return [];
        }
    };

    const windowStub = {
        GENZ_NAVIGATION_ROLE: "owner",
        GENZNavigationReady: Promise.resolve(true),
        location: { replace() {} },
        GENZSession: null,
        supabaseClient: null
    };

    const localStorageStub = {
        length: 0,
        key() { return null; },
        getItem() { return null; }
    };

    const fetchMock = async function (url, init = {}) {
        const target = String(url);
        const method = init.method || "GET";
        fetchCalls.push({ target, method, body: init.body || "" });

        let data = {};
        if (method === "POST" && String(init.body).includes("delete_jobs")) {
            data = { success: true, action: "delete_jobs", deleted: 1, skipped: 0 };
        } else {
            data = {
                success: true,
                action: "status",
                checkedAt: new Date().toISOString(),
                mcp: { slots: [], totalSlots: 0 },
                vault: { count: 0, entries: [] },
                recoverableHistory: candidates
            };
        }

        return {
            ok: true,
            status: 200,
            async json() { return data; }
        };
    };

    const context = vm.createContext({
        document: documentStub,
        window: windowStub,
        localStorage: localStorageStub,
        fetch: fetchMock,
        console,
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
        URL,
        URLSearchParams
    });

    vm.runInContext(script, context);

    return { el, fetchCalls };
}

function uiCandidates() {
    return [
        {
            id: "aaa",
            userEmail: "owner@example.com",
            modelName: "Opus Music / Lagu AI (Lyria 3.5)",
            status: "failed",
            taskId: "opus:gen_aaa:job-aaa",
            errorMessage: "Egress Gateway 400"
        },
        {
            id: "bbb",
            userEmail: "owner@example.com",
            modelName: "Nano Banana Pro",
            status: "failed",
            taskId: "opus:gen_bbb:job-bbb",
            errorMessage: "Egress Gateway 400"
        }
    ];
}

async function settleStart() {
    await new Promise(resolve => setTimeout(resolve, 0));
    await new Promise(resolve => setTimeout(resolve, 0));
}

test("UI: klik DELETE memunculkan checkbox dan mengubah tombol jadi CONFIRM", async () => {
    const { el } = buildUiHarness(uiCandidates());
    await settleStart();

    await el("bbOpusRefreshBtn").fire("click");
    await settleStart();
    assert.match(el("bbOpusHistoryContainer").innerHTML, /data-recover-task/);

    await el("bbOpusDeleteBtn").fire("click");

    assert.equal(el("bbOpusDeleteBtn").textContent, "CONFIRM");
    assert.match(el("bbOpusHistoryContainer").innerHTML, /data-delete-id="aaa"/);
    assert.match(el("bbOpusHistoryContainer").innerHTML, /data-delete-id="bbb"/);
    assert.equal(el("bbOpusDeleteCancelBtn").hidden, false);
});

test("UI: CONFIRM mengirim hanya ID yang dicentang lalu kembali ke mode idle", async () => {
    const { el, fetchCalls } = buildUiHarness(uiCandidates());
    await settleStart();
    await el("bbOpusRefreshBtn").fire("click");
    await settleStart();
    await el("bbOpusDeleteBtn").fire("click");

    const checkbox = {
        checked: true,
        getAttribute(key) {
            return key === "data-delete-id" ? "aaa" : null;
        },
        closest(selector) {
            if (selector === "[data-delete-id]") return checkbox;
            if (selector === "[data-history-id]") {
                return { classList: { toggle() {} } };
            }
            return null;
        }
    };

    await el("bbOpusHistoryContainer").fire("change", { target: checkbox });
    assert.equal(el("bbOpusDeleteBtn").textContent, "CONFIRM (1)");

    await el("bbOpusDeleteBtn").fire("click");

    const deleteCall = fetchCalls.find(call =>
        call.method === "POST" && call.body.includes("delete_jobs")
    );
    assert.ok(deleteCall, "CONFIRM harus memanggil action delete_jobs");
    const payload = JSON.parse(deleteCall.body);
    assert.deepEqual(payload.history_ids, ["aaa"]);
    assert.equal(el("bbOpusDeleteBtn").textContent, "DELETE");
    assert.equal(el("bbOpusDeleteCancelBtn").hidden, true);
    assert.match(el("bbOpusDeleteHint").textContent, /1 job dihapus/);
});

test("UI: DELETE ALL berubah CONFIRM dan mengirim delete_all", async () => {
    const { el, fetchCalls } = buildUiHarness(uiCandidates());
    await settleStart();
    await el("bbOpusRefreshBtn").fire("click");
    await settleStart();

    await el("bbOpusDeleteAllBtn").fire("click");
    assert.equal(el("bbOpusDeleteAllBtn").textContent, "CONFIRM");
    assert.match(el("bbOpusHistoryContainer").innerHTML, /is-pending-all/);

    await el("bbOpusDeleteAllBtn").fire("click");

    const deleteCall = fetchCalls.find(call =>
        call.method === "POST" && call.body.includes("delete_jobs")
    );
    assert.ok(deleteCall);
    assert.equal(JSON.parse(deleteCall.body).delete_all, true);
    assert.equal(el("bbOpusDeleteAllBtn").textContent, "DELETE ALL");
});

test("UI: BATAL keluar dari mode pilih tanpa menghapus", async () => {
    const { el, fetchCalls } = buildUiHarness(uiCandidates());
    await settleStart();
    await el("bbOpusRefreshBtn").fire("click");
    await settleStart();
    await el("bbOpusDeleteBtn").fire("click");
    await el("bbOpusDeleteCancelBtn").fire("click");

    assert.equal(el("bbOpusDeleteBtn").textContent, "DELETE");
    assert.equal(el("bbOpusDeleteCancelBtn").hidden, true);
    assert.doesNotMatch(el("bbOpusHistoryContainer").innerHTML, /data-delete-id/);
    assert.ok(!fetchCalls.some(call => call.body.includes("delete_jobs")));
});
