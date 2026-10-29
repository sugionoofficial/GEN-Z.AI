import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runSocialPublisherCron } from "../functions/_shared/social-publisher-cron.js";

/*
 * Penjagaan anti-tumpang-tindih pada klaim jadwal autopost.
 *
 * Sebelumnya `claim_due_social_post_schedules` hanya melihat next_run_at,
 * sehingga run yang menggantung lebih lama dari interval membuat run kedua
 * berjalan paralel untuk jadwal yang sama. Sekarang klaim dilewati dan
 * next_run_at digeser satu interval.
 */

const migration = readFileSync(
    fileURLToPath(new URL("../supabase/social-schedule-no-overlap.sql", import.meta.url)),
    "utf8"
);

function skipBranch() {
    const start = migration.indexOf("if exists (");
    const end = migration.indexOf("end if;", start);
    assert.ok(start > 0 && end > start, "cabang penjagaan harus ada di migrasi");
    return migration.slice(start, end);
}

test("migrasi mendefinisikan ulang fungsi klaim dengan penjagaan run aktif", () => {
    assert.match(
        migration,
        /create or replace function public\.claim_due_social_post_schedules\(p_now timestamp with time zone default now\(\), p_limit integer default 2\)/
    );
    assert.match(migration, /returns table\(run_id uuid, schedule_id uuid, scheduled_for timestamp with time zone\)/);
    assert.match(migration, /security definer/);
    assert.match(migration, /set search_path to ''/);

    const branch = skipBranch();
    assert.match(branch, /from public\.social_post_runs r/);
    assert.match(branch, /r\.schedule_id = v_schedule\.id/);
    assert.match(branch, /r\.status in \('queued', 'generating'\)/);
});

test("penjagaan menunda satu interval tanpa mencatat last_run_at", () => {
    const branch = skipBranch();
    assert.match(branch, /next_run_at = p_now \+ make_interval\(mins => v_schedule\.interval_minutes\)/);
    assert.match(branch, /continue;/);
    assert.doesNotMatch(branch, /last_run_at/, "tidak ada run yang dimulai, jadi last_run_at tidak boleh berubah");
});

test("penjagaan diperiksa sebelum run baru dibuat", () => {
    const guardAt = migration.indexOf("if exists (");
    const insertAt = migration.indexOf("insert into public.social_post_runs");
    assert.ok(guardAt > 0 && insertAt > guardAt, "guard harus dievaluasi sebelum insert run");

    /* Sapuan run yatim 30 menit tetap lebih dulu, supaya run yang benar-benar
       mati tidak memblokir jadwal selamanya. */
    const sweepAt = migration.indexOf("created_at < p_now - interval '30 minutes'");
    assert.ok(sweepAt > 0 && sweepAt < guardAt, "sapuan 30 menit harus berjalan sebelum loop klaim");
});

test("cron aman saat klaim dilewati (tidak ada job yang diklaim)", async () => {
    const originalFetch = globalThis.fetch;
    const calls = [];
    globalThis.fetch = async (input, options = {}) => {
        calls.push(String(input));
        return Response.json([]);
    };
    try {
        const result = await runSocialPublisherCron(
            { SUPABASE_URL: "https://project.example", SUPABASE_SERVICE_ROLE_KEY: "server-only-test-key" },
            new Date("2026-10-29T07:20:00.000Z")
        );
        assert.deepEqual(result, { claimed: 0, resumed: 0, swept: { auto: 0, manual: 0 }, skipped: false });
        assert.ok(
            calls.some(url => url.endsWith("/rpc/claim_due_social_post_schedules")),
            "cron tetap memanggil RPC klaim; yang menentukan skip adalah hasil RPC"
        );
    } finally {
        globalThis.fetch = originalFetch;
    }
});
