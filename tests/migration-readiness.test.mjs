import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT = process.cwd();
const SCRIPT = path.join(ROOT, "scripts", "check-migration-readiness.mjs");

/* Migrasi ke project Supabase baru di akun berbeda dijalankan manual oleh
   pemilik akun. Skrip kesiapan ini satu-satunya jaring pengaman: ia harus
   menolak jalan bila env belum lengkap, kunci salah jenis, atau tool tidak ada.
   Pengujian ini tidak menyentuh jaringan sama sekali. */

test("script kesiapan migrasi ada dan terdaftar di package.json", () => {
    assert.ok(fs.existsSync(SCRIPT), "scripts/check-migration-readiness.mjs harus ada");

    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
    assert.match(String(pkg.scripts?.["check:migration"] || ""), /check-migration-readiness\.mjs/);
});

test("menolak jalan tanpa env migrasi", () => {
    const result = spawnSync(process.execPath, [SCRIPT], {
        cwd: ROOT,
        encoding: "utf8",
        env: { ...process.env, MIGRATION_SRC_REF: "", MIGRATION_SRC_SERVICE_KEY: "", MIGRATION_DST_REF: "", MIGRATION_DST_SERVICE_KEY: "" }
    });

    assert.equal(result.status, 1, "harus keluar 1 agar migrasi tidak lanjut");

    const output = `${result.stdout}${result.stderr}`;
    assert.match(output, /Env sumber belum lengkap/);
    assert.match(output, /Env target belum lengkap/);
});

test("menolak kunci publishable dan JWT non-service_role", () => {
    const payload = Buffer.from(JSON.stringify({ role: "anon" })).toString("base64url");
    const anonJwt = `eyJhbGciOiJIUzI1NiJ9.${payload}.signature`;

    const result = spawnSync(process.execPath, [SCRIPT], {
        cwd: ROOT,
        encoding: "utf8",
        env: {
            ...process.env,
            MIGRATION_SRC_REF: "ycovbqmezhrvzobxqnyp",
            MIGRATION_SRC_SERVICE_KEY: "sb_publishable_aaaaaaaaaaaaaaaaaaaaaaaa",
            MIGRATION_DST_REF: "abcdefghijabcdefghij",
            MIGRATION_DST_SERVICE_KEY: anonJwt
        }
    });

    const output = `${result.stdout}${result.stderr}`;
    assert.match(output, /kunci PUBLISHABLE/i);
    assert.match(output, /role "anon"/);
    assert.equal(result.status, 1);
});

test("menolak target yang sama dengan sumber", () => {
    const result = spawnSync(process.execPath, [SCRIPT], {
        cwd: ROOT,
        encoding: "utf8",
        env: {
            ...process.env,
            MIGRATION_SRC_REF: "ycovbqmezhrvzobxqnyp",
            MIGRATION_SRC_SERVICE_KEY: "sb_secret_aaaaaaaaaaaaaaaaaaaaaaaa",
            MIGRATION_DST_REF: "ycovbqmezhrvzobxqnyp",
            MIGRATION_DST_SERVICE_KEY: "sb_secret_bbbbbbbbbbbbbbbbbbbbbbbb"
        }
    });

    assert.match(`${result.stdout}${result.stderr}`, /Target sama dengan sumber/);
    assert.equal(result.status, 1);
});

test("runbook memakai host pooler sesuai region target yang aktif", () => {
    const runbook = fs.readFileSync(path.join(ROOT, "migrasi", "MIGRASI-MANUAL.md"), "utf8");
    const cutover = fs.readFileSync(
        path.join(ROOT, "migrasi", "CUTOVER-rvgioyenjgkprnssfpfr.md"),
        "utf8"
    );

    /* Target aktif: rvgioyenjgkprnssfpfr di ap-southeast-1 (Singapore). */
    assert.match(runbook, /DST=.*rvgioyenjgkprnssfpfr.*ap-southeast-1\.pooler/, "target harus di Singapore");
    assert.doesNotMatch(runbook, /DST=.*ap-southeast-2\.pooler/, "target tidak boleh memakai host Sydney");

    assert.match(cutover, /rvgioyenjgkprnssfpfr\.supabase\.co/);
    assert.match(cutover, /ap-southeast-1\.pooler\.supabase\.com/);
    assert.match(cutover, /check-migration-readiness\.mjs|check:migration/);
    /* Peringatan wajib: deploy config.js sebelum data siap = situs kosong. */
    assert.match(cutover, /situs tampil kosong/i);
});

test("migrate_bulk menyalin cacheControl sumber, bukan max-age=3600", () => {
    const script = fs.readFileSync(path.join(ROOT, "migrasi", "migrate_bulk.mjs"), "utf8");

    assert.doesNotMatch(
        script,
        /'Cache-Control':\s*o\.cacheControl\s*\|\|\s*'max-age=3600'/,
        "default max-age=3600 membuat objek hasil migrasi memicu egress"
    );
    assert.match(script, /'Cache-Control':\s*o\.cacheControl\s*\|\|\s*'31536000, immutable'/);
});
