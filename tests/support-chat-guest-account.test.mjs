import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

import {
    GUEST_GRACE_MS,
    GUEST_IDLE_MS,
    createGuestCleanupApi,
    isGuestAuthUser,
    runGuestCleanup,
    selectStaleGuestAccounts,
    shouldRunGuestCleanup
} from "../lib/support-chat/guest-cleanup.js";
import { runSupportGuestCleanupCron } from "../functions/_shared/support-guest-cleanup-cron.js";

/*
 * AKUN TAMU LIVE CHAT
 * ---------------------------------------------------------
 * Bug yang dijaga tes ini:
 *
 *   Pengunjung yang belum mendaftar membuka live chat, lalu
 *   sistem otomatis membuat akun Supabase tanpa profil. Akun
 *   kosong itu ikut muncul di daftar user admin.
 *
 * Aturan yang harus tetap berlaku:
 *   1. Membuka panel chat TIDAK membuat akun.
 *   2. Akun tamu hanya dibuat saat pengunjung menekan "Mulai chat".
 *   3. Akun tamu tidak muncul di daftar user admin.
 *   4. Akun tamu yang tidak berguna dibersihkan cron, tanpa pernah
 *      menyentuh akun pendaftar asli.
 */

const root = new URL("../", import.meta.url);
const read = relative => fs.readFile(new URL(relative, root), "utf8");

const chatSource = await read("assets/js/support-chat.js");
const adminUsersSource = await read("api/admin-users.js");
const workerSource = await read("functions/worker.mjs");
const readme = await read("README.md");

const HOUR = 60 * 60 * 1000;
const NOW = new Date("2026-10-26T12:00:00.000Z");

function isoAgo(ms) {
    return new Date(NOW.getTime() - ms).toISOString();
}

function guest(id, createdAt) {
    return { id, is_anonymous: true, created_at: createdAt };
}

function member(id) {
    return { id, is_anonymous: false, created_at: isoAgo(30 * 24 * HOUR) };
}

test("membuka panel chat tidak membuat akun tamu", () => {
    const openChatStart = chatSource.indexOf("async function openChat(");
    assert.ok(openChatStart > 0, "openChat harus ada");
    const openChatBody = chatSource.slice(
        openChatStart,
        chatSource.indexOf("function closeChat(", openChatStart)
    );

    assert.doesNotMatch(
        openChatBody,
        /signInAnonymously/,
        "openChat tidak boleh membuat akun tamu secara langsung"
    );
    assert.match(
        openChatBody,
        /ensureVisitorSession\(\{[\s\S]{0,120}createIfMissing: createGuest/,
        "pembuatan sesi tamu harus lewat flag createGuest"
    );
    assert.match(openChatBody, /const createGuest = options\.createGuest === true;/);
    assert.match(
        openChatBody,
        /if \(!hasSession\) \{[\s\S]{0,120}renderVisitorWelcome\(\);/,
        "tanpa sesi, panel chat hanya menampilkan layar awal"
    );
});

test("akun tamu hanya dibuat setelah tombol Mulai chat ditekan", () => {
    assert.match(chatSource, /function renderVisitorWelcome\(\)/);
    assert.match(chatSource, /text: "Mulai chat"/);
    assert.match(
        chatSource,
        /startButton\.addEventListener\("click", \(\) =>\s*openChat\(\{ createGuest: true \}\)/,
        "tombol Mulai chat harus meminta pembuatan sesi tamu"
    );

    /* Ikon chat tidak boleh meminta pembuatan akun. */
    assert.match(chatSource, /launcher\.addEventListener\("click", \(\) => openChat\(\)\);/);
    assert.doesNotMatch(chatSource, /launcher\.addEventListener\("click", openChat\)/);

    const ensureStart = chatSource.indexOf("async function ensureVisitorSession(");
    const ensureBody = chatSource.slice(
        ensureStart,
        chatSource.indexOf("async function detectSupportAgent(", ensureStart)
    );
    const anonymousIndex = ensureBody.indexOf("signInAnonymously");
    const guardIndex = ensureBody.indexOf("if (!createIfMissing)");
    assert.ok(anonymousIndex > 0, "signInAnonymously hanya boleh ada di ensureVisitorSession");
    assert.ok(
        guardIndex > 0 && guardIndex < anonymousIndex,
        "signInAnonymously harus berada setelah penjagaan createIfMissing"
    );
    assert.match(ensureBody, /createIfMissing = false/);
});

test("hanya ada satu titik pembuatan akun tamu di halaman chat", () => {
    const occurrences = chatSource.match(/signInAnonymously\s*\(/g) || [];
    assert.equal(occurrences.length, 1);
});

test("akun tamu tidak muncul di daftar user admin", () => {
    const mergeStart = adminUsersSource.indexOf("const mergeUsers = (");
    const mergeBody = adminUsersSource.slice(
        mergeStart,
        adminUsersSource.indexOf("const upsertProfile =", mergeStart)
    );

    assert.match(
        mergeBody,
        /filter\(\s*authUser => authUser\.is_anonymous !== true\s*\)/,
        "akun anonymous harus dibuang dari daftar user admin"
    );
});

test("pemilihan akun tamu menghormati masa tenggang dan percakapan aktif", () => {
    const plan = selectStaleGuestAccounts({
        now: NOW,
        guests: [
            guest("baru", isoAgo(2 * HOUR)),
            guest("tanpa-percakapan", isoAgo(10 * 24 * HOUR)),
            guest("masih-aktif", isoAgo(20 * 24 * HOUR)),
            guest("menganggur", isoAgo(40 * 24 * HOUR)),
            guest("percakapan-terbuka", isoAgo(60 * 24 * HOUR)),
            member("pendaftar")
        ],
        conversations: [
            { user_id: "masih-aktif", status: "closed", last_message_at: isoAgo(2 * 24 * HOUR) },
            { user_id: "menganggur", status: "closed", last_message_at: isoAgo(30 * 24 * HOUR) },
            { user_id: "percakapan-terbuka", status: "open", last_message_at: isoAgo(40 * 24 * HOUR) }
        ]
    });

    assert.deepEqual(
        [...plan.deleteIds].sort(),
        ["menganggur", "tanpa-percakapan"],
        "hanya akun tamu tanpa percakapan / sudah lama menganggur yang dihapus"
    );

    const reasons = Object.fromEntries(plan.kept.map(entry => [entry.id, entry.reason]));
    assert.equal(reasons.baru, "grace_period");
    assert.equal(reasons["masih-aktif"], "recent_activity");
    assert.equal(reasons["percakapan-terbuka"], "open_conversation");
    assert.equal(reasons.pendaftar, "not_guest");

    const deletedReasons = Object.fromEntries(plan.deleted.map(entry => [entry.id, entry.reason]));
    assert.equal(deletedReasons["tanpa-percakapan"], "no_conversation");
    assert.equal(deletedReasons.menganggur, "idle");
});

test("akun dengan created_at tidak valid tidak pernah dihapus", () => {
    const plan = selectStaleGuestAccounts({
        now: NOW,
        guests: [guest("tanpa-tanggal", null), guest("tanggal-rusak", "bukan tanggal")]
    });
    assert.deepEqual(plan.deleteIds, []);
    assert.equal(plan.kept.every(entry => entry.reason === "unknown_created_at"), true);
});

test("masa tenggang dan batas idle mengikuti konstanta", () => {
    assert.equal(GUEST_GRACE_MS, 24 * HOUR);
    assert.equal(GUEST_IDLE_MS, 7 * 24 * HOUR);
    assert.equal(isGuestAuthUser(guest("x", isoAgo(0))), true);
    assert.equal(isGuestAuthUser(member("y")), false);
    assert.equal(isGuestAuthUser(null), false);
});

test("pembersihan tidak pernah menghapus akun pendaftar asli", async () => {
    const deleted = [];
    const api = {
        async listGuestUsers() {
            return [guest("tamu-lama", isoAgo(30 * 24 * HOUR))];
        },
        async listConversations() {
            return [];
        },
        async deleteUser(id) {
            deleted.push(id);
        }
    };

    const summary = await runGuestCleanup(api, { now: NOW });
    assert.deepEqual(deleted, ["tamu-lama"]);
    assert.equal(summary.deleted, 1);
    assert.equal(summary.ok, true);
});

test("dry run melaporkan rencana tanpa menghapus apa pun", async () => {
    const deleted = [];
    const api = {
        async listGuestUsers() {
            return [guest("tanpa-percakapan", isoAgo(10 * 24 * HOUR))];
        },
        async listConversations() {
            return [];
        },
        async deleteUser(id) {
            deleted.push(id);
        }
    };

    const summary = await runGuestCleanup(api, { now: NOW, dryRun: true });
    assert.deepEqual(deleted, []);
    assert.equal(summary.planned, 1);
    assert.equal(summary.dryRun, true);
});

test("kegagalan satu akun tidak menghentikan pembersihan akun lain", async () => {
    const api = {
        async listGuestUsers() {
            return [
                guest("gagal", isoAgo(10 * 24 * HOUR)),
                guest("berhasil", isoAgo(10 * 24 * HOUR))
            ];
        },
        async listConversations() {
            return [];
        },
        async deleteUser(id) {
            if (id === "gagal") throw new Error("HTTP 500");
        }
    };

    const summary = await runGuestCleanup(api, { now: NOW });
    assert.equal(summary.deleted, 1);
    assert.equal(summary.failed.length, 1);
    assert.equal(summary.ok, false);
});

test("cron hanya bekerja sekali per jam", () => {
    assert.equal(shouldRunGuestCleanup(new Date("2026-10-26T12:00:00.000Z")), true);
    assert.equal(shouldRunGuestCleanup(new Date("2026-10-26T12:05:00.000Z")), false);
    assert.equal(shouldRunGuestCleanup(new Date("2026-10-26T12:59:00.000Z")), false);
});

test("cron melewati pekerjaan bila kredensial server belum ada", async () => {
    const summary = await runSupportGuestCleanupCron({}, NOW, { force: true });
    assert.equal(summary.skipped, true);
    assert.equal(summary.reason, "missing_credentials");
});

test("cron menghapus akun tamu lewat API Supabase", async () => {
    const calls = [];
    const users = [
        guest("tamu-idle", isoAgo(30 * 24 * HOUR)),
        guest("tamu-baru", isoAgo(HOUR)),
        member("pendaftar")
    ];

    const fetchImpl = async (url, init = {}) => {
        calls.push({ url, method: init.method || "GET" });

        if (url.includes("/auth/v1/admin/users?")) {
            return { ok: true, status: 200, json: async () => ({ users }), text: async () => "" };
        }
        if (url.includes("/rest/v1/support_conversations")) {
            return { ok: true, status: 200, json: async () => [], text: async () => "" };
        }
        return { ok: true, status: 200, json: async () => ({}), text: async () => "" };
    };

    const summary = await runSupportGuestCleanupCron(
        { SUPABASE_URL: "https://contoh.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "kunci-server-uji" },
        new Date("2026-10-26T12:00:00.000Z"),
        { fetchImpl, force: true }
    );

    assert.equal(summary.deleted, 1);
    const deletions = calls.filter(call => call.method === "DELETE");
    assert.equal(deletions.length, 1);
    assert.match(deletions[0].url, /\/auth\/v1\/admin\/users\/tamu-idle$/);
    assert.equal(
        deletions.some(call => call.url.includes("pendaftar")),
        false,
        "akun pendaftar asli tidak boleh dihapus"
    );
});

test("API pembersihan menolak konfigurasi kosong", () => {
    assert.throws(() => createGuestCleanupApi({}), /belum lengkap/);
});

test("worker menjalankan cron pembersihan akun tamu", () => {
    assert.match(
        workerSource,
        /import \{ runSupportGuestCleanupCron \} from "\.\/_shared\/support-guest-cleanup-cron\.js";/
    );
    assert.match(workerSource, /runSupportGuestCleanupCron\(env, scheduledAt\)/);
});

test("README menjelaskan akun tamu tidak lagi dibuat saat membuka chat", () => {
    assert.match(readme, /Mulai chat/);
    assert.match(readme, /akun tamu/i);
});
