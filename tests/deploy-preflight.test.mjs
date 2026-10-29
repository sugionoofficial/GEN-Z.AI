import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const ROOT = process.cwd();
const SCRIPT = path.join(ROOT, "scripts", "check-dependencies.mjs");

/* Regresi: `npx wrangler deploy` di clone tanpa `npm install` gagal dengan
   pesan membingungkan "Could not resolve \"jpeg-js\"". Preflight ini harus
   menghentikan deploy lebih awal dengan instruksi yang jelas. */

test("paket yang dibutuhkan worker tercatat di package.json", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
    for (const name of ["jpeg-js", "pngjs", "@stacksjs/ts-webp"]) {
        assert.ok(pkg.dependencies?.[name], `${name} harus ada di dependencies`);
        assert.ok(fs.existsSync(SCRIPT), "scripts/check-dependencies.mjs harus ada");
    }
    assert.match(pkg.scripts.deploy, /check-dependencies\.mjs/);
    assert.match(pkg.scripts.deploy, /wrangler deploy/);
    assert.match(pkg.scripts.prebuild, /check-dependencies\.mjs/);
});

test("preflight berhenti dengan pesan jelas saat dependensi belum terpasang", () => {
    /* Salin skrip ke folder kosong: resolusi paket mengikuti lokasi skrip,
       jadi di sana ketiga paket pasti tidak ditemukan. */
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "genz-deps-"));
    const copied = path.join(tmp, "check-dependencies.mjs");
    fs.copyFileSync(SCRIPT, copied);

    let status = 0;
    let stderr = "";
    try {
        execFileSync(process.execPath, [copied], { cwd: tmp, stdio: "pipe" });
    } catch (error) {
        status = error.status ?? 1;
        stderr = String(error.stderr || "");
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }

    assert.equal(status, 1, "harus keluar dengan exit code 1 agar deploy berhenti");
    assert.match(stderr, /Dependensi belum terpasang/);
    assert.match(stderr, /npm install/);
    assert.match(stderr, /jpeg-js/);
});

test("preflight lulus di repo yang sudah di-install", () => {
    let status = 0;
    try {
        execFileSync(process.execPath, [SCRIPT], { cwd: ROOT, stdio: "pipe" });
    } catch (error) {
        status = error.status ?? 1;
    }
    assert.equal(status, 0, "setelah npm install, preflight harus lulus");
});
