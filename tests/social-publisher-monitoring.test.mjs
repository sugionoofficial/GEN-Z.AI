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
    assert.match(sql, /FACEBOOK_PAGE_RESTRICTED/);
    assert.match(sql, /CONTENT_POLICY_REJECTED/);

    // token Opus
    assert.match(sql, /from public\.opus_oauth_tokens/);
});

test("health check mengembalikan ringkasan jsonb yang bisa dipantau", () => {
    for (const key of [
        "'ok',",
        "'alerts',",
        "'schedules',",
        "'subscriptions',",
        "'runs',",
        "'opus_tokens',",
        "'generated_at',",
    ]) {
        assert.ok(sql.includes(key), `output harus memuat ${key}`);
    }
});
