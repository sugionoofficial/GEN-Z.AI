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
    { name: "PROVIDER_CREDENTIAL_ENCRYPTION_KEY", hint: "wajib untuk vault kredensial dan Mode C Hubungkan Gmail" }
];

/* Fitur opsional yang punya halaman sendiri di navigasi. Kalau variabel ini
   kosong, halaman tetap terbuka tetapi API-nya gagal — lebih baik diperingatkan
   sejak awal daripada admin melihat error generik di browser. */
const FEATURE_FLAGS = [
    { name: "TEMPMAIL_API_URL", hint: "Mode B lama untuk @gmail.com: URL Tempmail-MCP persisten (bukan Codespaces). Tidak wajib bila Mode C aktif; tanpa ini, built-in mail.tm hanya aktif lewat TEMPMAIL_PROVIDER=mailtm" },
    { name: "GMAIL_CLIENT_ID", hint: "Mode C: OAuth client 'Web application' dari Google Cloud" },
    { name: "GMAIL_CLIENT_SECRET", hint: "Mode C: client secret OAuth Google Cloud (server-only)" }
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
# Mode C: Hubungkan Gmail langsung di /email.html (lihat TEMPMAIL-GMAIL-CONNECT.md)
# GMAIL_CLIENT_ID=<oauth-web-client-id>
# GMAIL_CLIENT_SECRET=<oauth-web-client-secret>
# GMAIL_OAUTH_REDIRECT_URI=http://127.0.0.1:8787/api/tempmail-gmail-callback
# TEMPMAIL_API_URL=<https://host-tempmail-mcp>   # Mode B lama; tidak wajib bila Mode C aktif
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

const missingFeatures = FEATURE_FLAGS.filter(item => !values.get(item.name));
if (missingFeatures.length) {
    console.warn("   Variabel berikut belum diisi (perlu dicek sesuai mode provider):");
    for (const item of missingFeatures) {
        console.warn(`   - ${item.name}   (${item.hint})`);
    }
    console.warn("");
}
