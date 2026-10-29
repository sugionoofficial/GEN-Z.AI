import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT = process.cwd();

function readRepoFile(relativePath) {
    return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

const sql = readRepoFile("supabase/credit-rpc-hardening.sql");

test("Fungsi kredit & mutasi wajib hanya bisa dipanggil service_role", () => {
    // Fungsi yang memutasi saldo / kuota tanpa guard pemanggil di dalam body.
    const serviceRoleOnly = [
        "refund_generate_credits(uuid,numeric)",
        "deduct_generate_credits(uuid,numeric)",
        "refund_failed_generation_credits(uuid,text)",
        "deduct_credit(uuid,integer,text,uuid)",
        "refund_credit(uuid,integer,text,uuid)",
        "admin_cancel_generation(uuid,text)",
        "admin_set_model_quota(uuid,integer,date,boolean)",
        "qwencloud_quota_reconcile_all()",
        "qwencloud_quota_reconcile(uuid)",
        "qwencloud_quota_recheck(uuid)",
    ];

    for (const fn of serviceRoleOnly) {
        assert.ok(sql.includes(`'${fn}'`), `migration harus mengunci ${fn}`);
    }

    assert.match(sql, /revoke all on function public\.%s from public/i);
    assert.match(sql, /revoke all on function public\.%s from anon, authenticated/i);
    assert.match(sql, /grant execute on function public\.%s to service_role/i);
});

test("Fungsi ber-guard admin tetap untuk authenticated tapi anon dicabut", () => {
    const adminGuarded = [
        "add_credit(uuid,integer,text,text)",
        "admin_remove_credit(uuid,integer,text)",
        "approve_topup(uuid)",
        "approve_topup_and_add_credits(uuid)",
        "admin_create_provider(text,text,text,text,boolean)",
        "admin_update_provider(uuid,text,text,text,text,boolean)",
        "admin_delete_provider(uuid)",
    ];

    for (const fn of adminGuarded) {
        assert.ok(sql.includes(`'${fn}'`), `migration harus mencabut anon untuk ${fn}`);
    }

    assert.match(sql, /revoke all on function public\.%s from anon', v_sig\)/i);
});

test("Statistik kredit/user dijaga is_admin_or_owner()", () => {
    for (const fn of [
        "sum_profile_credits",
        "count_profiles",
        "count_active_profiles",
        "count_generation_history",
        "get_active_user_ids",
    ]) {
        const start = sql.indexOf(`function public.${fn}(`);
        assert.ok(start !== -1, `migration harus mendefinisikan ulang ${fn}`);

        const body = sql.slice(start, start + 900);
        assert.match(
            body,
            /is_admin_or_owner/,
            `${fn} harus memakai guard is_admin_or_owner`,
        );
        assert.match(
            body,
            /raise exception 'ADMIN_ONLY' using errcode = '42501'/,
            `${fn} harus melempar ADMIN_ONLY`,
        );
    }

    assert.match(sql, /revoke all on function public\.sum_profile_credits\(\) from public, anon/i);
    assert.match(sql, /revoke all on function public\.get_active_user_ids\(\) from public, anon/i);
});

test("profiles.credits dilindungi trigger dari tulisan client", () => {
    assert.match(sql, /create or replace function public\.guard_profile_credits\(\)/i);
    assert.match(sql, /current_user in \('anon', 'authenticated'\)/i);
    assert.match(sql, /create trigger guard_profile_credits_trg[\s\S]{0,120}before update on public\.profiles/i);
    assert.match(sql, /notify pgrst, 'reload schema'/i);
});

test("Semua pemanggil RPC kredit di server memakai service role (bukan token user)", () => {
    const generate = readRepoFile("api/generate.js");
    const featureCredits = readRepoFile("api/feature-credits.js");

    assert.match(generate, /\/rest\/v1\/rpc\/deduct_generate_credits/);
    assert.match(generate, /\/rest\/v1\/rpc\/refund_generate_credits/);
    assert.match(generate, /`Bearer \$\{SUPABASE_SERVICE_ROLE_KEY\}`/);

    assert.match(featureCredits, /\/auth\/v1\/user/);
    assert.match(featureCredits, /p_user_id:\s*user\.id/);
    assert.doesNotMatch(featureCredits, /p_user_id:\s*(body|payload|req\.body)/);
});
