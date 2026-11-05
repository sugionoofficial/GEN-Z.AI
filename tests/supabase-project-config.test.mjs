import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT = process.cwd();
const CONFIG_PATH = path.join(ROOT, "assets/js/config.js");
const configSource = fs.readFileSync(CONFIG_PATH, "utf8");

/* Regresi: proyek Supabase aplikasi dipindahkan dari `boeamhglmvkatnycluaa`
   (lama, Storage terblokir 402) ke `ycovbqmezhrvzobxqnyp` (baru). Lihat
   migrasi/STATUS.md. `config.js` sempat tertinggal di proyek lama, sehingga
   browser memakai JWT proyek lama sementara Worker memakai proyek baru dan
   seluruh panggilan API ditolak. */

const PROJECT_REF = "ycovbqmezhrvzobxqnyp";
const LEGACY_PROJECT_REF = "boeamhglmvkatnycluaa";

const supabaseUrl = configSource.match(
    /SUPABASE_URL\s*:\s*[\"'`]([^\"'`]+)/
)?.[1];
const supabaseKey = configSource.match(
    /SUPABASE_KEY\s*:\s*[\"'`]([^\"'`]+)/
)?.[1];

test("config.js menunjuk proyek Supabase aktif", () => {
    assert.ok(supabaseUrl, "SUPABASE_URL harus ada di config.js");
    assert.equal(new URL(supabaseUrl).hostname, `${PROJECT_REF}.supabase.co`);
});

test("config.js tidak lagi memakai proyek lama", () => {
    const codeOnly = configSource
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^[ \t]*\/\/.*$/gm, "");

    assert.ok(
        !codeOnly.includes(LEGACY_PROJECT_REF),
        "referensi proyek lama hanya boleh tersisa di komentar"
    );
});

test("SUPABASE_KEY adalah kunci publishable proyek baru, bukan service role", () => {
    assert.ok(supabaseKey, "SUPABASE_KEY harus ada di config.js");
    assert.match(supabaseKey, /^sb_publishable_/);
    assert.ok(!supabaseKey.startsWith("sb_secret_"), "service role key tidak boleh di client");
});

test("key frontend tidak ikut tercampur dengan project di .dev.vars.example", () => {
    const example = fs.readFileSync(path.join(ROOT, ".dev.vars.example"), "utf8");
    const exampleUrl = example.match(/^SUPABASE_URL=(.+)$/m)?.[1]?.trim();

    assert.equal(exampleUrl, supabaseUrl, "SUPABASE_URL dev harus sama dengan config.js");
    assert.match(example, /^SUPABASE_ANON_KEY=sb_publishable_/m);
});

test("tidak ada SUPABASE_URL proyek lama yang tersisa di halaman/aset frontend", () => {
    const scanRoots = ["assets", "admin", "admin-control", "user", "generate", "history", "live-chat"];
    const offenders = [];

    const walk = dir => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(full);
                continue;
            }
            if (!/\.(js|mjs|html|webmanifest)$/.test(entry.name)) continue;
            const text = fs.readFileSync(full, "utf8");
            if (text.includes(LEGACY_PROJECT_REF)) {
                offenders.push(path.relative(ROOT, full));
            }
        }
    };

    for (const root of scanRoots) {
        const dir = path.join(ROOT, root);
        if (fs.existsSync(dir)) walk(dir);
    }

    assert.deepEqual(offenders, [], `masih mereferensikan proyek lama: ${offenders.join(", ")}`);
});
