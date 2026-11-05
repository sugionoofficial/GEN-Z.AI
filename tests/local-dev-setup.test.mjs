import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const ROOT = process.cwd();

/* Regresi: `npm run dev` tidak ada sebelumnya, sehingga satu-satunya cara lokal
   adalah `npx wrangler@4 dev` yang tidak menandai variabel server yang hilang.
   Akibatnya halaman terbuka, tetapi setiap /api/* membalas 500 dengan pesan
   "SUPABASE_URL belum dikonfigurasi di server". */

test("npm run dev tersedia dan memeriksa konfigurasi lokal lebih dulu", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));

    assert.ok(pkg.scripts?.["check:dev"], "harus ada script check:dev");
    assert.match(pkg.scripts["check:dev"], /check-local-dev-vars\.mjs/);

    const dev = String(pkg.scripts?.dev || "");
    assert.match(dev, /check-local-dev-vars\.mjs/, "npm run dev harus memeriksa .dev.vars lebih dulu");
    assert.match(dev, /build-cloudflare-pages\.mjs/, "npm run dev harus membangun dist lebih dulu");
    assert.match(dev, /wrangler@4 dev/, "npm run dev harus menjalankan wrangler dev");
    /* Binding AI di wrangler.toml (env.AI) membuat wrangler 4 mencoba remote
       proxy. Di mesin tanpa CLOUDFLARE_API_TOKEN itu menghentikan dev server:
       "In a non-interactive environment ... set a CLOUDFLARE_API_TOKEN". */
    assert.match(dev, /--local\b/, "npm run dev harus memaksa --local agar binding AI tidak memicu remote proxy");
    assert.match(dev, /--ip 0\.0\.0\.0/, "harus listen di 0.0.0.0 agar bisa dibuka dari preview/browser eksternal");
    assert.match(dev, /--port 8787/);
});

test("script preview tidak memakai `wrangler preview` yang butuh login Cloudflare", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
    const preview = String(pkg.scripts?.preview || "");

    assert.doesNotMatch(preview, /wrangler preview(?!\s*$)/, "wrangler preview mengunggah Preview deployment dan gagal tanpa kredensial");
    assert.match(preview, /npm run dev/);
});

test(".dev.vars di-ignore supaya service role key tidak ter-commit", () => {
    const result = spawnSync("git", ["check-ignore", "-q", ".dev.vars"], { cwd: ROOT });

    assert.equal(
        result.status,
        0,
        ".dev.vars wajib masuk .gitignore — berisi SUPABASE_SERVICE_ROLE_KEY"
    );
});

test("check-local-dev-vars memberi instruksi jelas tanpa menghentikan dev server", () => {
    const script = path.join(ROOT, "scripts", "check-local-dev-vars.mjs");
    assert.ok(fs.existsSync(script), "scripts/check-local-dev-vars.mjs harus ada");

    /* Skrip mencari .dev.vars relatif terhadap lokasinya sendiri, jadi salin ke
       folder sementara: hasilnya deterministik walau developer sudah punya
       .dev.vars di repo. */
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "genz-devvars-"));
    const tmpScripts = path.join(tmp, "scripts");
    fs.mkdirSync(tmpScripts, { recursive: true });
    const copied = path.join(tmpScripts, "check-local-dev-vars.mjs");
    fs.copyFileSync(script, copied);

    try {
        const result = spawnSync(process.execPath, [copied], { encoding: "utf8" });

        /* Tanpa .dev.vars skrip tetap harus lulus (exit 0) agar halaman statis
           masih bisa dibuka; hanya memberi peringatan. */
        assert.equal(result.status, 0, "skrip tidak boleh memblokir dev server");

        const output = `${result.stdout}${result.stderr}`;
        assert.match(output, /SUPABASE_URL/);
        assert.match(output, /dev\.vars/);
        assert.match(output, /500/, "harus menjelaskan dampaknya pada /api/*");
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
});

test("check-local-dev-vars melaporkan variabel wajib yang kosong", () => {
    const script = path.join(ROOT, "scripts", "check-local-dev-vars.mjs");
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "genz-devvars-"));
    const tmpScripts = path.join(tmp, "scripts");
    fs.mkdirSync(tmpScripts, { recursive: true });
    fs.copyFileSync(script, path.join(tmpScripts, "check-local-dev-vars.mjs"));
    fs.writeFileSync(
        path.join(tmp, ".dev.vars"),
        "SUPABASE_URL=https://example.supabase.co\n",
        "utf8"
    );

    try {
        const result = spawnSync(
            process.execPath,
            [path.join(tmpScripts, "check-local-dev-vars.mjs")],
            { encoding: "utf8" }
        );

        assert.equal(result.status, 0);
        const output = `${result.stdout}${result.stderr}`;
        assert.match(output, /SUPABASE_SERVICE_ROLE_KEY/);
        assert.match(output, /masih kosong/);
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
});
