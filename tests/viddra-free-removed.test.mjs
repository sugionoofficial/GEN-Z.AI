import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/* =========================================================
   GUARD: FITUR VIDDRA FREE SUDAH DIHAPUS
   ---------------------------------------------------------
   Menjaga agar halaman, endpoint, library, menu navigasi,
   CSS, daftar build, dokumentasi, dan kebijakan privasi
   tidak memuat lagi referensi ke fitur yang sudah dihapus.
   ========================================================= */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = rel => fs.readFileSync(path.join(root, rel), "utf8");
const featureName = "viddra";

const EXCLUDED_DIRS = new Set([
    ".git",
    "node_modules",
    "dist",
    "build",
    "coverage",
    ".cache",
    "tests"
]);
const SCANNABLE_DOT_DIRS = new Set([".github"]);
const TEXT_EXTENSIONS = new Set([
    ".js", ".mjs", ".cjs", ".html", ".css", ".md", ".json",
    ".toml", ".yml", ".yaml", ".sql", ".txt", ".svg"
]);

function collectSourceFiles(dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (EXCLUDED_DIRS.has(entry.name)) continue;
        if (entry.name.startsWith(".") && !SCANNABLE_DOT_DIRS.has(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            collectSourceFiles(full, out);
            continue;
        }
        if (TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
            out.push(full);
        }
    }
    return out;
}

test("direktori fitur Viddra Free sudah tidak ada", () => {
    for (const dir of ["viddra", "api/viddra", "lib/viddra"]) {
        assert.equal(
            fs.existsSync(path.join(root, dir)),
            false,
            `${dir} masih ada`
        );
    }
});

test("tidak ada lagi referensi Viddra di seluruh source project", () => {
    const offenders = collectSourceFiles(root)
        .filter(file => read(path.relative(root, file)).toLowerCase().includes(featureName))
        .map(file => path.relative(root, file));

    assert.deepEqual(offenders, [], `masih ada referensi: ${offenders.join(", ")}`);
});

test("Worker tidak lagi mendaftarkan endpoint /api/viddra/*", () => {
    const worker = read("functions/worker.mjs");
    assert.doesNotMatch(worker, /api\/viddra/);
    assert.doesNotMatch(worker, /viddraAccount|viddraGenerate/);
    // Peta handler tetap valid & diakhiri with array literal yang benar.
    assert.match(worker, /\["\/api\/data-deletion", facebookDataDeletion\]\s*\]\);/);
});

test("daftar direktori statis build tidak lagi menyalin folder viddra", () => {
    const buildScript = read("scripts/build-cloudflare-pages.mjs");
    assert.doesNotMatch(buildScript, /"viddra"/);
    assert.match(buildScript, /"user",\s*"vision"/);
});

test("menu navigasi tidak lagi menampilkan entri VidDra FREE", () => {
    const nav = read("navigation/navigation.js");
    assert.doesNotMatch(nav, /\/viddra\//);
    assert.doesNotMatch(nav, /ICONS\.viddra|viddra:\s*`/);
    assert.doesNotMatch(nav, /VidDra FREE/);
    assert.match(nav, /\{ label: "Upscale Studio"/);
    assert.match(nav, /\{ label: "History"/);
});

test("CSS, privacy policy, dan README bersih dari referensi Viddra", () => {
    for (const rel of [
        "assets/css/genz-compact-desktop.css",
        "assets/css/genz-premium.css",
        "privacy/index.html",
        "README.md"
    ]) {
        assert.doesNotMatch(
            read(rel).toLowerCase(),
            new RegExp(featureName),
            `${rel} masih menyebut fitur yang dihapus`
        );
    }
    assert.doesNotMatch(read("README.md"), /VIDDRA_API_KEY|VIDDRA_SESSION_SECRET/);
});

test("tes toast global tidak lagi bergantung pada halaman Viddra", () => {
    const toastTest = read("tests/download-toast-global.test.mjs");
    assert.doesNotMatch(toastTest, /viddraHtml|VidDra|viddra\/generate/);
    // Guard untuk halaman lain tetap utuh.
    assert.match(toastTest, /Metadata Cleaner memberi toast/);
    assert.match(toastTest, /genz-toast\.js dimuat semua halaman/);
});
