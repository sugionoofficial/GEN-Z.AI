import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT = process.cwd();
const sql = fs.readFileSync(
    path.join(ROOT, "supabase", "credit-audit-log.sql"),
    "utf8",
);

test("Tabel audit kredit hanya bisa dibaca admin / service_role", () => {
    assert.match(sql, /create table if not exists public\.credit_change_audit/i);
    assert.match(sql, /alter table public\.credit_change_audit enable row level security/i);
    assert.match(
        sql,
        /revoke all on table public\.credit_change_audit from public, anon, authenticated/i,
    );
    assert.match(sql, /grant select on table public\.credit_change_audit to service_role/i);
    assert.match(sql, /using \(public\.is_admin_or_owner\(\)\)/i);
});

test("Guard credits memakai SECURITY INVOKER (kalau DEFINER, current_user jadi owner)", () => {
    const start = sql.indexOf("create or replace function public.guard_profile_credits()");
    assert.ok(start !== -1, "guard_profile_credits harus ada");

    const body = sql.slice(start, start + 900);

    assert.match(body, /security invoker/i);
    assert.doesNotMatch(body, /security definer/i);
    assert.match(body, /v_caller text := current_user/i);
    assert.match(body, /v_caller in \('anon', 'authenticated'\)/i);
    assert.match(body, /raise exception 'CREDITS_READ_ONLY'/i);
});

test("Trigger audit mencatat role pemanggil, bukan role owner fungsi", () => {
    assert.match(sql, /create or replace function public\.log_credit_changes\(\)/i);
    assert.match(sql, /security definer/i);
    assert.match(sql, /current_setting\('genz\.credit_writer', true\)/i);
    assert.match(sql, /set_config\('genz\.credit_writer', v_caller, true\)/i);

    // Kedua trigger harus terpasang pada public.profiles
    assert.match(
        sql,
        /create trigger guard_profile_credits_trg\s+before update on public\.profiles/i,
    );
    assert.match(
        sql,
        /create trigger log_credit_changes_trg\s+after update on public\.profiles/i,
    );
});

test("Audit menyimpan delta + auth.uid() dari klaim JWT", () => {
    assert.match(sql, /request\.jwt\.claims/i);
    assert.match(sql, /coalesce\(p_new, 0\) - coalesce\(p_old, 0\)/i);
    assert.match(sql, /auth_uid/i);
});
