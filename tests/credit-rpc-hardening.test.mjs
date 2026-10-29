import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT = process.cwd();

function readRepoFile(relativePath) {
    return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

test("Fungsi kredit tidak boleh bisa dipanggil langsung dari client (anon/authenticated)", () => {
    const sql = readRepoFile("supabase/credit-rpc-hardening.sql");

    for (const fn of [
        "refund_generate_credits",
        "deduct_generate_credits",
        "refund_failed_generation_credits",
        "charge_feature_credits",
        "settle_feature_credits",
    ]) {
        assert.ok(sql.includes(`'${fn}'`), `migration harus menyebut ${fn}`);
    }

    assert.match(sql, /revoke all on function %s from public/i);
    assert.match(sql, /revoke all on function %s from anon, authenticated/i);
    assert.match(sql, /grant execute on function %s to service_role/i);
});

test("Semua pemanggil RPC kredit di server memakai service role (bukan token user)", () => {
    const generate = readRepoFile("api/generate.js");
    const featureCredits = readRepoFile("api/feature-credits.js");

    // generate.js: fungsi RPC dipanggil lewat supabaseRequest yang memakai service role.
    assert.match(generate, /\/rest\/v1\/rpc\/deduct_generate_credits/);
    assert.match(generate, /\/rest\/v1\/rpc\/refund_generate_credits/);
    assert.match(generate, /`Bearer \$\{SUPABASE_SERVICE_ROLE_KEY\}`/);

    // feature-credits.js: identitas user selalu dari JWT yang diverifikasi, bukan body.
    assert.match(featureCredits, /\/auth\/v1\/user/);
    assert.match(featureCredits, /p_user_id:\s*user\.id/);
    assert.doesNotMatch(featureCredits, /p_user_id:\s*(body|payload|req\.body)/);
});
