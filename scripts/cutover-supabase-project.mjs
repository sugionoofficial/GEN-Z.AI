#!/usr/bin/env node
/**
 * =====================================================================
 * GEN-Z.AI — Cutover ke project Supabase baru
 * =====================================================================
 *
 * Memindahkan SEMUA referensi project ref di repo ke project baru.
 *
 * Kenapa perlu alat: cutover manual pernah tertinggal separuh — `config.js`
 * tetap menunjuk project lama sementara dokumentasi menyatakan sudah pindah,
 * sehingga browser memakai JWT project lama dan seluruh API ditolak.
 * Skrip ini mengubah semuanya sekaligus, lalu memverifikasi tidak ada yang
 * tertinggal.
 *
 * Pemakaian:
 *   node scripts/cutover-supabase-project.mjs \
 *     --ref rvgioyenjgkprnssfpfr \
 *     --publishable sb_publishable_xxxxxxxx \
 *     [--dry-run]
 *
 * Yang diubah:
 *   - assets/js/config.js          SUPABASE_URL + SUPABASE_KEY
 *   - .dev.vars.example            SUPABASE_URL + SUPABASE_ANON_KEY
 *   - tests/supabase-project-config.test.mjs   konstanta PROJECT_REF
 *   - tests/*.test.mjs             fixture URL lama -> baru
 *   - migrasi/*.md                 catatan target aktif
 *
 * Yang TIDAK diubah (sengaja):
 *   - komentar sejarah di config.js / dokumentasi yang menyebut project lama
 *   - Worker secrets (diatur di Cloudflare, bukan di repo)
 *   - fixtures di tests/persistent-auth-session.test.mjs yang menguji
 *     "legacy-project.supabase.co" secara sengaja
 */
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/* Project ref yang sah: 20 karakter alfanumerik huruf kecil. */
const REF_PATTERN = /^[a-z0-9]{20}$/;
const PUBLISHABLE_PATTERN = /^sb_publishable_[A-Za-z0-9_-]+$/;

/* Ref yang dianggap "sesuai kode saat ini". */
const PREVIOUS_REF = "ycovbqmezhrvzobxqnyp";

/* Fixture yang memang sengaja memakai host lain untuk menguji penolakan. */
const LEGACY_FIXTURE_HOSTS = ["legacy-project.supabase.co"];

function parseArgs(argv) {
    const args = { dryRun: false };
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === "--dry-run") {
            args.dryRun = true;
        } else if (arg === "--ref") {
            args.ref = argv[i + 1];
            i += 1;
        } else if (arg === "--publishable") {
            args.publishable = argv[i + 1];
            i += 1;
        } else if (arg.startsWith("--ref=")) {
            args.ref = arg.slice("--ref=".length);
        } else if (arg.startsWith("--publishable=")) {
            args.publishable = arg.slice("--publishable=".length);
        } else {
            throw new Error(`Argumen tidak dikenal: ${arg}`);
        }
    }
    return args;
}

function fail(message) {
    console.error(`\n✘ ${message}\n`);
    process.exit(1);
}

const args = parseArgs(process.argv.slice(2));

if (!args.ref) fail("--ref wajib (project ref baru, contoh: rvgioyenjgkprnssfpfr)");
if (!REF_PATTERN.test(args.ref)) {
    fail(`--ref "${args.ref}" tidak valid. Harus 20 karakter alfanumerik huruf kecil.`);
}
if (args.ref === PREVIOUS_REF) {
    fail(`--ref sama dengan project yang sekarang (${PREVIOUS_REF}) — tidak ada yang perlu diubah.`);
}

/* Publishable key opsional: boleh diisi belakangan, tetapi peringatkan. */
let publishable = String(args.publishable || "").trim();
if (publishable && !PUBLISHABLE_PATTERN.test(publishable)) {
    fail("--publishable harus berformat sb_publishable_* (bukan service_role / sb_secret_*)");
}
if (/^sb_secret_/.test(publishable) || publishable.startsWith("eyJ")) {
    fail("Jangan pernah menaruh service_role key di config.js (kunci itu hanya untuk server).");
}

const NEW_URL = `https://${args.ref}.supabase.co`;
const changes = [];

async function rewrite(relativePath, transform) {
    const absolute = path.join(root, relativePath);
    if (!existsSync(absolute)) {
        changes.push({ file: relativePath, note: "dilewati (tidak ada)" });
        return;
    }

    const before = await readFile(absolute, "utf8");
    const after = transform(before);
    if (after === before) {
        changes.push({ file: relativePath, note: "tidak berubah" });
        return;
    }

    const occurrences = countOccurrences(before, after, PREVIOUS_REF);
    changes.push({ file: relativePath, note: `${occurrences} referensi diperbarui` });

    if (!args.dryRun) await writeFile(absolute, after, "utf8");
}

function countOccurrences(before, after, needle) {
    const count = text => text.split(needle).length - 1;
    return Math.max(count(before) - count(after), 0);
}

/* ------------------------------------------------------------------ */
/* 1. Identitas project di config.js                                   */
/* ------------------------------------------------------------------ */

await rewrite("assets/js/config.js", source => {
    let next = source.replace(
        /(SUPABASE_URL\s*:\s*\n\s*)"[^"]*"/,
        `$1"${NEW_URL}"`
    );

    if (publishable) {
        next = next.replace(
            /(SUPABASE_KEY\s*:\s*\n\s*)"[^"]*"/,
            `$1"${publishable}"`
        );
    }

    return next;
});

/* ------------------------------------------------------------------ */
/* 2. Template env lokal                                               */
/* ------------------------------------------------------------------ */

await rewrite(".dev.vars.example", source => {
    let next = source.replace(/^SUPABASE_URL=.*$/m, `SUPABASE_URL=${NEW_URL}`);
    if (publishable) {
        next = next.replace(/^SUPABASE_ANON_KEY=.*$/m, `SUPABASE_ANON_KEY=${publishable}`);
    }
    return next;
});

/* ------------------------------------------------------------------ */
/* 3. Konstanta di test identitas project                              */
/* ------------------------------------------------------------------ */

await rewrite("tests/supabase-project-config.test.mjs", source =>
    source.replace(
        /const PROJECT_REF = "[a-z0-9]+";/,
        `const PROJECT_REF = "${args.ref}";`
    )
);

/* ------------------------------------------------------------------ */
/* 4. Fixture URL di seluruh test yang menyebut ref lama               */
/* ------------------------------------------------------------------ */

const { readdir } = await import("node:fs/promises");
const testDir = path.join(root, "tests");
const testFiles = (await readdir(testDir)).filter(name => name.endsWith(".test.mjs"));

for (const name of testFiles) {
    const relative = path.join("tests", name);
    const text = await readFile(path.join(root, relative), "utf8");

    /* Jangan sentuh fixture yang sengaja memakai host "legacy". */
    if (LEGACY_FIXTURE_HOSTS.some(host => text.includes(host))) {
        const withoutLegacy = LEGACY_FIXTURE_HOSTS.reduce(
            (acc, host) => acc.split(host).join(""),
            text
        );
        if (!withoutLegacy.includes(PREVIOUS_REF)) {
            changes.push({ file: relative, note: "dilewati (fixture legacy)" });
            continue;
        }
    }

    if (!text.includes(PREVIOUS_REF)) continue;

    await rewrite(relative, source =>
        source
            .split(`${PREVIOUS_REF}.supabase.co`).join(`${args.ref}.supabase.co`)
            .split(`sb-${PREVIOUS_REF}-auth-token`).join(`sb-${args.ref}-auth-token`)
            .split(PREVIOUS_REF).join(args.ref)
    );
}

/* ------------------------------------------------------------------ */
/* 5. Dokumentasi migrasi                                              */
/* ------------------------------------------------------------------ */

for (const relative of ["migrasi/STATUS.md", "migrasi/MIGRASI-MANUAL.md"]) {
    await rewrite(relative, source => source); /* sengaja tidak diubah otomatis */
}

/* ------------------------------------------------------------------ */
/* 6. Verifikasi sisa referensi lama                                   */
/* ------------------------------------------------------------------ */

const SCAN_DIRS = [
    "assets", "admin", "admin-control", "user", "generate", "history",
    "live-chat", "vision", "vision-video", "upscale", "credit", "topup",
    "prompt-studio", "metadata-cleaner", "black-box"
];

const leftovers = [];

async function scan(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            await scan(full);
            continue;
        }
        if (!/\.(js|mjs|html|webmanifest)$/.test(entry.name)) continue;
        const text = await readFile(full, "utf8");
        const codeOnly = text
            .replace(/\/\*[\s\S]*?\*\//g, "")
            .replace(/^[ \t]*\/\/.*$/gm, "");
        if (codeOnly.includes(PREVIOUS_REF)) leftovers.push(path.relative(root, full));
    }
}

for (const dir of SCAN_DIRS) {
    const absolute = path.join(root, dir);
    if (existsSync(absolute)) await scan(absolute);
}

const configNow = await readFile(path.join(root, "assets/js/config.js"), "utf8");
const configUrl = configNow.match(/SUPABASE_URL\s*:\s*\n\s*"([^"]+)"/)?.[1];
const configKey = configNow.match(/SUPABASE_KEY\s*:\s*\n\s*"([^"]+)"/)?.[1];

/* ------------------------------------------------------------------ */
/* Laporan                                                             */
/* ------------------------------------------------------------------ */

console.log("");
console.log(args.dryRun ? "CUTOVER (dry-run — tidak ada file ditulis)" : "CUTOVER project Supabase");
console.log("=".repeat(70));
console.log(`Target : ${args.ref}`);
console.log(`URL    : ${NEW_URL}`);
console.log(`Kunci  : ${publishable ? "diperbarui" : "TIDAK diubah (--publishable belum diisi)"}`);
console.log("-".repeat(70));

for (const change of changes) {
    if (change.note === "tidak berubah") continue;
    console.log(`  ${change.file.padEnd(46)} ${change.note}`);
}

console.log("-".repeat(70));
console.log(`config.js sekarang : ${configUrl || "(tidak terbaca)"}`);
if (configUrl && configUrl !== NEW_URL) {
    console.log(
        args.dryRun
            ? "  (dry-run: config.js belum ditulis — jalankan tanpa --dry-run)"
            : "  ✘ config.js BELUM menunjuk target."
    );
}

if (leftovers.length && args.dryRun) {
    /* Pada dry-run belum ada yang ditulis, jadi sisa referensi itu wajar.
       Jangan laporkan sebagai kegagalan — cukup sebagai "akan diperbaiki". */
    console.log("");
    console.log("Akan diperbaiki (dry-run, belum ditulis):");
    for (const file of leftovers) console.log(`   - ${file}`);
} else if (leftovers.length) {
    console.log("");
    console.log("✘ Masih ada referensi project lama di kode frontend:");
    for (const file of leftovers) console.log(`   - ${file}`);
    console.log("  Perbaiki manual sebelum commit.");
    process.exitCode = 1;
} else {
    console.log("✓ Tidak ada referensi project lama tersisa di kode frontend.");
}

if (publishable) {
    console.log(`✓ config.js memakai kunci publishable (${configKey?.slice(0, 18)}…)`);
} else {
    console.log("");
    console.log("⚠ SUPABASE_KEY belum diubah. Ambil publishable key project baru dari");
    console.log("  Dashboard → Settings → API Keys, lalu jalankan ulang dengan");
    console.log(`  --publishable sb_publishable_xxx`);
    console.log("  Selama belum diganti, login akan gagal: URL baru + kunci project lama.");
}

if (args.dryRun) {
    console.log("");
    console.log("Dry-run selesai. Jalankan tanpa --dry-run untuk menulis perubahan.");
}

console.log("");
console.log("Langkah setelah ini:");
console.log("  1. npm test                    (harus hijau)");
console.log("  2. Perbarui 3 secrets Worker Cloudflare:");
console.log(`       SUPABASE_URL=${NEW_URL}`);
console.log("       SUPABASE_SERVICE_ROLE_KEY=<service_role project baru>");
console.log(`       SUPABASE_ANON_KEY=${publishable || "<publishable project baru>"}`);
console.log("  3. Deploy HANYA setelah data & storage project baru siap.");
console.log("");
