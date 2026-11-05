#!/usr/bin/env node
/**
 * =====================================================================
 * GEN-Z.AI — Cek kesiapan migrasi (tanpa menyentuh data apa pun)
 * =====================================================================
 *
 * Skrip ini HANYA membaca dan membandingkan. Tidak ada INSERT/UPDATE/
 * DELETE, tidak ada upload, tidak ada penghapusan.
 *
 * Yang diperiksa:
 *   1. Env yang dibutuhkan sudah lengkap dan formatnya benar.
 *   2. Project sumber masih dibatasi (HTTP 402) atau tidak.
 *   3. Project target benar-benar kosong (tidak ada tabel public).
 *   4. Versi Postgres sumber vs target (pg_dump harus >= versi sumber).
 *   5. Storage sumber bisa diunduh atau tidak (penentu langkah 3 runbook).
 *   6. Kesiapan skrip migrasi storage yang sudah ada di repo.
 *
 * Pemakaian:
 *   node scripts/check-migration-readiness.mjs
 *
 * Variabel yang dibaca (dari environment, bukan file):
 *   MIGRATION_SRC_REF, MIGRATION_SRC_SERVICE_KEY
 *   MIGRATION_DST_REF, MIGRATION_DST_SERVICE_KEY
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SRC_REF = String(process.env.MIGRATION_SRC_REF || "").trim();
const SRC_KEY = String(process.env.MIGRATION_SRC_SERVICE_KEY || "").trim();
const DST_REF = String(process.env.MIGRATION_DST_REF || "").trim();
const DST_KEY = String(process.env.MIGRATION_DST_SERVICE_KEY || "").trim();

const REF_PATTERN = /^[a-z0-9]{20}$/;

const results = [];
const record = (level, label, detail) => results.push({ level, label, detail });
const ok = (label, detail = "") => record("ok", label, detail);
const warn = (label, detail = "") => record("warn", label, detail);
const fail = (label, detail = "") => record("fail", label, detail);
const info = (label, detail = "") => record("info", label, detail);

/* ---------------------------------------------------------------- */
/* 1. Env                                                           */
/* ---------------------------------------------------------------- */

if (!SRC_REF || !SRC_KEY) {
    fail(
        "Env sumber belum lengkap",
        "Set MIGRATION_SRC_REF & MIGRATION_SRC_SERVICE_KEY (project ycovbqmezhrvzobxqnyp)"
    );
} else if (!REF_PATTERN.test(SRC_REF)) {
    fail("MIGRATION_SRC_REF tidak valid", `"${SRC_REF}" bukan project ref 20 karakter`);
} else {
    ok("Env sumber terisi", `${SRC_REF}.supabase.co`);
}

if (!DST_REF || !DST_KEY) {
    fail(
        "Env target belum lengkap",
        "Set MIGRATION_DST_REF & MIGRATION_DST_SERVICE_KEY (project baru ap-southeast-2)"
    );
} else if (!REF_PATTERN.test(DST_REF)) {
    fail("MIGRATION_DST_REF tidak valid", `"${DST_REF}" bukan project ref 20 karakter`);
} else if (DST_REF === SRC_REF) {
    fail("Target sama dengan sumber", "migrasi tidak ada gunanya dan berisiko menimpa data");
} else {
    ok("Env target terisi", `${DST_REF}.supabase.co`);
}

/* Kunci service_role JWT membawa `role`. Kunci publishable akan gagal. */
function describeKey(label, key) {
    if (!key) return;
    if (key.startsWith("sb_secret_")) {
        ok(`${label}: format secret baru (sb_secret_)`);
        return;
    }
    if (key.startsWith("sb_publishable_")) {
        fail(`${label}: ini kunci PUBLISHABLE`, "butuh service_role / sb_secret_ untuk migrasi");
        return;
    }
    if (key.startsWith("eyJ")) {
        try {
            const payload = JSON.parse(
                Buffer.from(key.split(".")[1], "base64url").toString("utf8")
            );
            if (payload.role === "service_role") ok(`${label}: JWT service_role`);
            else fail(`${label}: JWT role "${payload.role}"`, "harus service_role");
        } catch {
            warn(`${label}: JWT tidak bisa dibaca`, "pastikan ini service_role key");
        }
        return;
    }
    warn(`${label}: format kunci tidak dikenali`, "pastikan service_role key");
}

describeKey("Kunci sumber", SRC_KEY);
describeKey("Kunci target", DST_KEY);

/* ---------------------------------------------------------------- */
/* 2. Bantuan HTTP                                                  */
/* ---------------------------------------------------------------- */

async function probe(url, { key, method = "GET", timeoutMs = 12000 } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, {
            method,
            headers: key ? { apikey: key, Authorization: `Bearer ${key}` } : {},
            signal: controller.signal
        });
        return { status: response.status, text: (await response.text()).slice(0, 300) };
    } catch (error) {
        return { status: 0, text: error?.name === "AbortError" ? "timeout" : String(error?.message || error) };
    } finally {
        clearTimeout(timer);
    }
}

const isRestricted = text => /exceed_[a-z_]*quota|restricted due to the following violations/i.test(text);

/* ---------------------------------------------------------------- */
/* 3. Status project sumber                                         */
/* ---------------------------------------------------------------- */

if (SRC_REF && SRC_KEY) {
    const auth = await probe(`https://${SRC_REF}.supabase.co/auth/v1/health`, { key: SRC_KEY });
    if (auth.status === 0) {
        warn("Sumber tidak bisa dijangkau", auth.text);
    } else if (auth.status === 402 || isRestricted(auth.text)) {
        warn(
            "Sumber DIBATASI (402)",
            "pg_dump lewat koneksi DB masih bisa, tetapi unduhan Storage akan gagal"
        );
    } else if (auth.status < 500) {
        ok("Sumber merespons normal", `auth/v1/health → ${auth.status}`);
    } else {
        warn("Sumber membalas error server", `auth/v1/health → ${auth.status} ${auth.text}`);
    }

    /* Uji satu objek Storage. Ini penentu apakah langkah Storage bisa jalan. */
    const storage = await probe(
        `https://${SRC_REF}.supabase.co/storage/v1/bucket`,
        { key: SRC_KEY }
    );
    if (storage.status === 402 || isRestricted(storage.text)) {
        fail(
            "Storage sumber masih 402",
            "langkah 3 (pindah file) TIDAK bisa jalan. Tunggu reset kuota atau upgrade Pro dulu."
        );
    } else if (storage.status === 200) {
        const count = (() => {
            try {
                const parsed = JSON.parse(storage.text);
                return Array.isArray(parsed) ? parsed.length : null;
            } catch {
                return null;
            }
        })();
        ok("Storage sumber bisa diakses", count === null ? "daftar bucket terbaca" : `${count} bucket`);
    } else if (storage.status === 0) {
        warn("Storage sumber tidak bisa dijangkau", storage.text);
    } else {
        warn("Storage sumber membalas status tak terduga", `HTTP ${storage.status}`);
    }
}

/* ---------------------------------------------------------------- */
/* 4. Keadaan project target                                        */
/* ---------------------------------------------------------------- */

if (DST_REF && DST_KEY) {
    const auth = await probe(`https://${DST_REF}.supabase.co/auth/v1/health`, { key: DST_KEY });
    if (auth.status === 0) {
        fail("Target tidak bisa dijangkau", auth.text);
    } else if (auth.status === 402 || isRestricted(auth.text)) {
        fail("Target juga DIBATASI (402)", "project baru tidak boleh kena kuota; cek organisasi/akun");
    } else {
        ok("Target merespons normal", `auth/v1/health → ${auth.status}`);
    }

    /* Project target harus kosong: kalau `public` sudah berisi tabel, restore
       akan bentrok dan berisiko menimpa data. */
    const tables = await probe(
        `https://${DST_REF}.supabase.co/rest/v1/?select=1`,
        { key: DST_KEY }
    );
    if (tables.status === 200) {
        const schema = (() => {
            try {
                return JSON.parse(tables.text)?.definitions || null;
            } catch {
                return null;
            }
        })();
        const publicTables = schema?.public ? Object.keys(schema.public) : null;
        if (publicTables && publicTables.length > 0) {
            warn(
                "Target sudah punya tabel di schema public",
                `${publicTables.length} tabel (mis. ${publicTables.slice(0, 3).join(", ")}). ` +
                "Restore hanya aman bila tabel itu memang sisa percobaan yang boleh ditimpa."
            );
        } else if (publicTables) {
            ok("Schema public target masih kosong", "aman untuk restore");
        } else {
            info("Skema target tidak bisa dibaca dari response", "cek manual di dashboard");
        }
    }

    const buckets = await probe(`https://${DST_REF}.supabase.co/storage/v1/bucket`, { key: DST_KEY });
    if (buckets.status === 200) {
        let count = null;
        try {
            const parsed = JSON.parse(buckets.text);
            count = Array.isArray(parsed) ? parsed.length : null;
        } catch { /* biarkan null */ }
        if (count === 0) ok("Storage target kosong", "8 bucket perlu dibuat");
        else if (count) warn("Storage target sudah punya bucket", `${count} bucket — pastikan tidak bentrok nama`);
    }
}

/* ---------------------------------------------------------------- */
/* 5. Kesiapan tool lokal                                           */
/* ---------------------------------------------------------------- */

const { execFileSync } = await import("node:child_process");

function hasCommand(command, args = ["--version"]) {
    try {
        execFileSync(command, args, { stdio: "pipe" });
        return true;
    } catch {
        return false;
    }
}

const pgDumpOk = hasCommand("pg_dump");
const psqlOk = hasCommand("psql");

if (pgDumpOk && psqlOk) {
    let version = "";
    try {
        version = execFileSync("pg_dump", ["--version"], { encoding: "utf8" }).trim();
    } catch { /* abaikan */ }
    const major = Number((version.match(/(\d+)\.(\d+)/) || [])[1] || 0);
    if (major && major < 17) {
        warn(
            `pg_dump versi ${major} terlalu lama`,
            "project sumber memakai Postgres 17 — wajib pg_dump 17 agar dump tidak ditolak"
        );
    } else {
        ok("pg_dump & psql siap", version || "versi tidak terbaca");
    }
} else {
    fail(
        "pg_dump / psql tidak ditemukan",
        "Install PostgreSQL 17 client dulu (lihat migrasi/MIGRASI-MANUAL.md bagian 0)"
    );
}

for (const [label, relative] of [
    ["Skrip storage", "migrasi/migrate_bulk.mjs"],
    ["Runbook migrasi", "migrasi/MIGRASI-MANUAL.md"]
]) {
    if (existsSync(path.join(root, relative))) ok(`${label} tersedia`, relative);
    else fail(`${label} hilang`, relative);
}

/* ---------------------------------------------------------------- */
/* Laporan                                                          */
/* ---------------------------------------------------------------- */

const ICON = { ok: "OK  ", warn: "WARN", fail: "FAIL", info: "INFO" };
const width = Math.max(...results.map(r => r.label.length), 10);

console.log("");
console.log("Kesiapan migrasi GEN-Z.AI");
console.log("=".repeat(64));
for (const r of results) {
    console.log(`${ICON[r.level]}  ${r.label.padEnd(width)}  ${r.detail}`);
}
console.log("=".repeat(64));

const failures = results.filter(r => r.level === "fail");
const warnings = results.filter(r => r.level === "warn");

console.log(`Ringkasan: ${results.filter(r => r.level === "ok").length} siap, ` +
    `${warnings.length} peringatan, ${failures.length} penghalang.`);

if (failures.length) {
    console.log("");
    console.log("Belum siap migrasi. Bereskan item FAIL di atas dulu.");
    process.exit(1);
}

if (warnings.length) {
    console.log("");
    console.log("Bisa lanjut, tetapi baca item WARN — sebagian menentukan langkah mana yang harus ditunda.");
}

console.log("");
process.exit(0);
