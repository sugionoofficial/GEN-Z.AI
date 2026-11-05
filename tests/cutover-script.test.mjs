import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const ROOT = process.cwd();
const SCRIPT = path.join(ROOT, "scripts", "cutover-supabase-project.mjs");

/* Cutover ke project Supabase baru pernah tertinggal separuh: `config.js`
   tetap menunjuk project lama sementara dokumentasi menyatakan sudah pindah.
   Akibatnya browser memakai JWT project lama dan seluruh API ditolak.
   Alat ini mengubah semua referensi sekaligus; test di bawah mengunci
   perilaku berbahayanya (menulis tanpa diminta, menerima service_role key). */

function run(args, { cwd = ROOT } = {}) {
    return spawnSync(process.execPath, [SCRIPT, ...args], { cwd, encoding: "utf8" });
}

test("script cutover tersedia dan terdaftar di package.json", () => {
    assert.ok(fs.existsSync(SCRIPT), "scripts/cutover-supabase-project.mjs harus ada");

    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
    assert.match(String(pkg.scripts?.["cutover"] || ""), /cutover-supabase-project\.mjs/);
});

test("menolak tanpa --ref", () => {
    const result = run([]);
    assert.equal(result.status, 1);
    assert.match(`${result.stdout}${result.stderr}`, /--ref wajib/);
});

test("menolak project ref yang tidak valid", () => {
    for (const bad of ["short", "UPPERCASE12345678901", "ada-tanda-strip-20k", "21"] ) {
        const result = run(["--ref", bad]);
        assert.equal(result.status, 1, `"${bad}" seharusnya ditolak`);
        assert.match(`${result.stdout}${result.stderr}`, /tidak valid|sama dengan project/);
    }
});

test("menolak ref yang sama dengan project sekarang", () => {
    const configSource = fs.readFileSync(path.join(ROOT, "assets/js/config.js"), "utf8");
    const currentRef = new URL(
        configSource.match(/SUPABASE_URL\s*:\s*\n\s*"([^"]+)"/)[1]
    ).hostname.split(".")[0];

    const result = run(["--ref", currentRef]);
    assert.equal(result.status, 1);
    assert.match(`${result.stdout}${result.stderr}`, /sama dengan project/);
});

test("menolak service_role key sebagai --publishable", () => {
    for (const bad of ["sb_secret_abcdef", "eyJhbGciOiJIUzI1NiJ9.payload.sig"]) {
        const result = run(["--ref", "rvgioyenjgkprnssfpfr", "--publishable", bad]);
        assert.equal(result.status, 1, "service_role key tidak boleh masuk config.js");
        assert.match(`${result.stdout}${result.stderr}`, /sb_publishable|service_role/i);
    }
});

test("dry-run tidak mengubah satu byte pun", () => {
    const targets = ["assets/js/config.js", ".dev.vars.example"];
    const before = targets.map(file => fs.readFileSync(path.join(ROOT, file), "utf8"));

    const result = run(["--ref", "rvgioyenjgkprnssfpfr", "--dry-run"]);
    assert.equal(result.status, 0, result.stderr);

    const after = targets.map(file => fs.readFileSync(path.join(ROOT, file), "utf8"));
    assert.deepEqual(after, before, "dry-run tidak boleh menulis file");
    assert.match(result.stdout, /dry-run/i);
});

test("dry-run jujur bahwa config.js belum ditulis", () => {
    const result = run(["--ref", "rvgioyenjgkprnssfpfr", "--dry-run"]);
    assert.equal(result.status, 0, "dry-run tidak boleh gagal hanya karena belum menulis");

    /* Alat harus jujur: jangan terlihat sukses padahal belum menulis apa pun. */
    assert.match(result.stdout, /belum ditulis/);
    assert.doesNotMatch(result.stdout, /Tidak ada referensi project lama tersisa/);
});

test("cutover menulis perubahan di salinan bersih lalu bisa dibalik", () => {
    /* Dijalankan di salinan supaya repo nyata tidak tersentuh. */
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "genz-cutover-"));
    const copy = path.join(tmp, "repo");

    try {
        fs.cpSync(ROOT, copy, {
            recursive: true,
            filter: source => {
                const rel = path.relative(ROOT, source);
                return !/^(node_modules|\.git|dist|\.wrangler)(\/|$)/.test(rel);
            }
        });

        const result = spawnSync(
            process.execPath,
            [path.join(copy, "scripts", "cutover-supabase-project.mjs"),
                "--ref", "rvgioyenjgkprnssfpfr",
                "--publishable", "sb_publishable_TESTKEY0000000000000000"],
            { cwd: copy, encoding: "utf8" }
        );

        assert.equal(result.status, 0, result.stderr);
        assert.match(result.stdout, /Tidak ada referensi project lama tersisa/);

        const config = fs.readFileSync(path.join(copy, "assets/js/config.js"), "utf8");
        assert.match(config, /SUPABASE_URL:\s*\n\s*"https:\/\/rvgioyenjgkprnssfpfr\.supabase\.co"/);
        assert.match(config, /SUPABASE_KEY:\s*\n\s*"sb_publishable_TESTKEY0000000000000000"/);

        const testFile = fs.readFileSync(
            path.join(copy, "tests/supabase-project-config.test.mjs"),
            "utf8"
        );
        assert.match(testFile, /const PROJECT_REF = "rvgioyenjgkprnssfpfr";/);

        /* Nama project lama muncul di komentar sejarah — itu dibiarkan. */
        assert.match(config, /migrasi\/STATUS\.md/);
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
});
