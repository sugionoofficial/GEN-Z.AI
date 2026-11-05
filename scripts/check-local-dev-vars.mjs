#!/usr/bin/env node
/**
 * Pemeriksaan konfigurasi lokal sebelum `npm run dev`.
 *
 * Latar belakang: Worker lokal (`wrangler dev`) membaca secret dari `.dev.vars`.
 * Bila file itu belum ada, situs statis tetap terbuka dan tampak "jalan",
 * tetapi setiap panggilan API gagal dengan pesan yang mudah disalahpahami:
 *
 *   GET /api/announcements   500  {"error":"Konfigurasi Supabase server belum lengkap."}
 *   GET /api/feature-credits 500  {"error":"SUPABASE_URL belum dikonfigurasi di server."}
 *   POST /api/generate       500  {"error":"Server configuration is incomplete"}
 *
 * Skrip ini menampilkan variabel mana yang belum diisi SEBELUM Worker menyala,
 * supaya penyebabnya jelas. Skrip ini tidak pernah menghentikan dev server:
 * halaman statis masih bisa dibuka walau API belum siap.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const devVarsPath = path.join(root, ".dev.vars");

const REQUIRED = [
    { name: "SUPABASE_URL", hint: "https://<project-ref>.supabase.co" },
    { name: "SUPABASE_SERVICE_ROLE_KEY", hint: "Settings → API Keys (server-only, JANGAN di-commit)" }
];

const RECOMMENDED = [
    { name: "SUPABASE_ANON_KEY", hint: "publishable/anon key dari project yang SAMA dengan SUPABASE_URL" },
    { name: "PROVIDER_CREDENTIAL_ENCRYPTION_KEY", hint: "wajib untuk membuka credential provider yang tersimpan" }
];

const TEMPLATE = `# .dev.vars — secret lokal untuk \`npm run dev\` (JANGAN di-commit)
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
SUPABASE_ANON_KEY=<publishable-atau-anon-key>
PROVIDER_CREDENTIAL_ENCRYPTION_KEY=<32-byte-secret>

# Opsional
# SIGHTENGINE_API_USER=<user>
# SIGHTENGINE_API_SECRET=<secret>
# OPENKEY_API_KEY=<key>
# GITHUB_PAT=<token-untuk-upscale-dan-admin-copilot>
`;

function parseDevVars(text) {
    const values = new Map();
    for (const rawLine of String(text).split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;
        const separator = line.indexOf("=");
        if (separator === -1) continue;
        const key = line.slice(0, separator).trim();
        let value = line.slice(separator + 1).trim();
        if (
            (value.startsWith("\"") && value.endsWith("\"")) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }
        if (key) values.set(key, value);
    }
    return values;
}

function readDevVars() {
    try {
        return { exists: true, values: parseDevVars(readFileSync(devVarsPath, "utf8")) };
    } catch {
        return { exists: false, values: new Map() };
    }
}

const { exists, values } = readDevVars();

if (!exists) {
    console.warn("");
    console.warn("⚠  .dev.vars belum ada — API lokal (login, generate, credit) akan gagal.");
    console.warn("   Halaman statis tetap bisa dibuka, tetapi setiap panggilan /api/*");
    console.warn("   membalas 500 karena Worker tidak punya kredensial Supabase.");
    console.warn("");
    console.warn("   Buat file .dev.vars di root repo dengan isi:");
    console.warn("");
    for (const line of TEMPLATE.split("\n")) {
        console.warn(`   ${line}`);
    }
    console.warn("");
    console.warn("   File ini sudah masuk .gitignore; jangan pernah commit nilainya.");
    console.warn("");
    process.exit(0);
}

const missingRequired = REQUIRED.filter(item => !values.get(item.name));
const missingRecommended = RECOMMENDED.filter(item => !values.get(item.name));

if (missingRequired.length) {
    console.warn("");
    console.warn("⚠  .dev.vars ditemukan, tetapi variabel wajib ini masih kosong:");
    for (const item of missingRequired) {
        console.warn(`   - ${item.name}   (${item.hint})`);
    }
    console.warn("   Tanpa variabel di atas, /api/* akan membalas 500.");
    console.warn("");
} else {
    console.log("Konfigurasi lokal siap (.dev.vars terbaca).");
}

if (missingRecommended.length) {
    console.warn("   Variabel yang disarankan belum diisi:");
    for (const item of missingRecommended) {
        console.warn(`   - ${item.name}   (${item.hint})`);
    }
    console.warn("");
}
