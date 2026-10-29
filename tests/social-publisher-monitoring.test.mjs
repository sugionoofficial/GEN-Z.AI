import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT = process.cwd();
const sql = fs.readFileSync(
    path.join(ROOT, "supabase", "social-publisher-monitoring.sql"),
    "utf8",
);

test("health check Social Publisher hanya boleh dipanggil admin atau server", () => {
    assert.match(sql, /create or replace function public\.social_publisher_health\(\)/i);
    assert.match(sql, /security definer/i);

    // current_user TIDAK boleh dipakai di dalam body: di definer nilainya jadi owner.
    const bodyStart = sql.indexOf("as $$", sql.indexOf("create or replace function public.social_publisher_health()"));
    const bodyEnd = sql.indexOf("$$;", bodyStart);
    const body = sql.slice(bodyStart, bodyEnd);
    assert.doesNotMatch(body, /current_user/i);

    assert.match(sql, /current_setting\('role', true\)/);
    assert.match(sql, /if v_role in \('anon', 'authenticated'\) then/i);
    assert.match(sql, /raise exception 'ADMIN_ONLY'[\s\S]{0,80}errcode = '42501'/i);

    assert.match(sql, /revoke all on function public\.social_publisher_health\(\) from public, anon/i);
    assert.match(
        sql,
        /grant execute on function public\.social_publisher_health\(\) to authenticated, service_role/i,
    );
});

test("health check melaporkan penyebab autopost berhenti (bukan hanya jumlah)", () => {
    // langganan
    assert.match(sql, /studio_medsos_access/);
    assert.match(sql, /SUBSCRIPTION_EXPIRING/);
    assert.match(sql, /SCHEDULE_WITHOUT_SUBSCRIPTION/);

    // run menggantung & gagal
    assert.match(sql, /interval '30 minutes'/);
    assert.match(sql, /STALE_RUNS/);
    assert.match(sql, /ALL_FAILING/);

    // penyebab spesifik
    assert.match(sql, /invalid_grant/i);
    assert.match(sql, /OPUS_RELOGIN_REQUIRED/);
    assert.match(sql, /code 368/i);
    assert.match(sql, /FACEBOOK_ACTION_REJECTED/);
    assert.match(sql, /CONTENT_POLICY_REJECTED/);
    assert.match(sql, /SONG_TITLE_NOT_CAPTION_SAFE/);
    assert.match(sql, /from public\.social_facebook_songs/);

    // token Opus (nearest_expiry hanya yang masih berlaku)
    assert.match(sql, /from public\.opus_oauth_tokens/);
    assert.match(sql, /min\(expires_at\) filter \(where expires_at > now\(\)\)/);
});

test("status sukses Social Publisher adalah 'posted', bukan 'success'", () => {
    // Regresi: sempat dihitung hanya 'success' sehingga success_24h selalu 0
    // padahal ada 50 run 'posted' berhasil.
    assert.match(
        sql,
        /in \('posted', 'success', 'published', 'completed', 'done'\)/,
    );
    assert.doesNotMatch(
        sql,
        /lower\(coalesce\(status, ''\)\) = 'success'\s+and coalesce\(finished_at, created_at\) > now\(\) - interval '24 hours'/,
    );
});

test("health check mengembalikan ringkasan jsonb yang bisa dipantau", () => {
    for (const key of [
        "'ok',",
        "'alerts',",
        "'schedules',",
        "'subscriptions',",
        "'runs',",
        "'songs',",
        "'opus_tokens',",
        "'generated_at',",
    ]) {
        assert.ok(sql.includes(key), `output harus memuat ${key}`);
    }
});

test("riwayat gagal lama yang sudah pulih tidak menyalakan alarm merah palsu", () => {
    /* Variabel lagu wajib terdeklarasi di DECLARE agar migrasi valid. */
    assert.match(sql, /v_songs_total\s+int\s*:=\s*0/i);
    assert.match(sql, /v_songs_active\s+int\s*:=\s*0/i);
    assert.match(sql, /v_songs_unusable\s+int\s*:=\s*0/i);

    /* OPUS_RELOGIN_REQUIRED hanya bila invalid_grant terjadi SETELAH post sukses terakhir. */
    assert.match(sql, /if v_opus_relogin_unresolved > 0 then[\s\S]{0,160}OPUS_RELOGIN_REQUIRED/);

    /* Code 368 tidak boleh disebut blokir/pembatasan Page. */
    assert.doesNotMatch(sql, /run gagal karena Page dibatasi Facebook/i);
    assert.match(sql, /Bukan blokir Page/i);

    /* Catatan level 'info' tidak boleh membuat status `ok` jadi false. */
    assert.match(sql, /where item ->> 'level' in \('error', 'warning'\)/);
    assert.match(sql, /'ok',\s*not v_has_problem/);
});
