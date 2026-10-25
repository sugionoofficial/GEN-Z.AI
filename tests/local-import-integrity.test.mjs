import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/*
 * =========================================================
 * GUARD: INTEGRITAS IMPORT MODUL LOKAL
 * ---------------------------------------------------------
 * Bug nyata yang pernah lolos ke produksi:
 *
 *   api/social-publisher.js memakai `testCloudflareImageProvider`
 *   tetapi namanya tidak ada di daftar import dari
 *   lib/social-publisher/providers.js.
 *
 * `node --check`, bundling Wrangler, dan seluruh tes unit tetap
 * lulus karena itu bukan error sintaks maupun build — hanya
 * ReferenceError saat aksi tersebut benar-benar dipanggil.
 *
 * Tes ini memeriksa dua arah untuk setiap import relatif:
 * 1. setiap nama yang DIPAKAI di kode (bukan string/komentar) dan
 *    diekspor modul tujuan harus ada di daftar import;
 * 2. setiap nama yang diimpor harus benar-benar diekspor modul tujuan.
 *
 * String literal, template literal, komentar, nama properti
 * (`obj.nama`), dan nama yang dideklarasikan lokal (termasuk
 * destructuring) diabaikan agar tidak menghasilkan alarm palsu.
 * =========================================================
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scanRoots = ["api", "functions", "lib", "provider", "models", "metadata-cleaner", "admin-control", "assets"];
const sourceCache = new Map();

function listModuleFiles(directory) {
    const absolute = path.join(root, directory);
    const files = [];
    let entries;
    try {
        entries = readdirSync(absolute);
    } catch {
        return files;
    }
    for (const entry of entries) {
        const relative = path.join(directory, entry);
        if (statSync(path.join(root, relative)).isDirectory()) {
            files.push(...listModuleFiles(relative));
        } else if (/\.(js|mjs)$/.test(entry)) {
            files.push(relative);
        }
    }
    return files;
}

function readSource(relative) {
    if (!sourceCache.has(relative)) {
        sourceCache.set(relative, readFileSync(path.join(root, relative), "utf8"));
    }
    return sourceCache.get(relative);
}

function stripComments(source) {
    return source
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/(^|[^:\\])\/\/[^\n]*/g, "$1 ");
}

function stripStrings(source) {
    return source
        .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
        .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
        .replace(/`(?:[^`\\]|\\.)*`/g, "``");
}

const IMPORT_STATEMENT_PATTERN = /import\s+([\s\S]*?)\s*from\s*["'](\.[^"']+)["']\s*;?/g;
const SIDE_EFFECT_IMPORT_PATTERN = /import\s*["'](\.[^"']+)["']\s*;?/g;

/** Nama yang diekspor modul sumber (regex cukup untuk gaya kode repo ini). */
function exportedNamesOf(relative) {
    const source = stripComments(readSource(relative));
    const names = new Set();
    for (const match of source.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z0-9_$]+)/g)) {
        names.add(match[1]);
    }
    for (const match of source.matchAll(/export\s+(?:const|let|var|class)\s+([A-Za-z0-9_$]+)/g)) {
        names.add(match[1]);
    }
    for (const match of source.matchAll(/export\s*\{([^}]*)\}/g)) {
        for (const part of match[1].split(",")) {
            const trimmed = part.trim();
            if (!trimmed) continue;
            const alias = trimmed.split(/\s+as\s+/);
            names.add((alias[1] || alias[0]).trim());
        }
    }
    return names;
}

function hasReExport(relative) {
    return /export\s+\*\s+from/.test(stripComments(readSource(relative)));
}

function resolveLocal(fromFile, rawSpecifier) {
    /* Browser module kadang memakai cache-busting: ./file.js?v=20261025 */
    const specifier = String(rawSpecifier).split("?")[0].split("#")[0];
    const base = path.normalize(path.join(path.dirname(fromFile), specifier));
    if (/\.(js|mjs)$/.test(base)) return base;
    for (const candidate of [`${base}.js`, `${base}.mjs`, path.join(base, "index.js")]) {
        try {
            statSync(path.join(root, candidate));
            return candidate;
        } catch {
            // lanjut ke kandidat berikutnya
        }
    }
    return null;
}

/** Nama yang dideklarasikan lokal, termasuk destructuring objek/array. */
function localDeclarations(body) {
    const declared = new Set();
    for (const match of body.matchAll(/\b(?:function|const|let|var|class)\s+([A-Za-z0-9_$]+)/g)) {
        declared.add(match[1]);
    }
    for (const match of body.matchAll(/\b(?:const|let|var)\s*\{([^{}]*)\}\s*=/g)) {
        for (const part of match[1].split(",")) {
            const name = part.split(":").pop().trim().split(/[=\s]/)[0];
            if (/^[A-Za-z_$][\w$]*$/.test(name)) declared.add(name);
        }
    }
    for (const match of body.matchAll(/\b(?:const|let|var)\s*\[([^[\]]*)\]\s*=/g)) {
        for (const part of match[1].split(",")) {
            const name = part.trim().split(/[=\s]/)[0];
            if (/^[A-Za-z_$][\w$]*$/.test(name)) declared.add(name);
        }
    }
    for (const match of body.matchAll(/\(([^()]*)\)\s*=>/g)) {
        for (const part of match[1].split(",")) {
            const name = part.trim().split(/[:=\s]/)[0];
            if (/^[A-Za-z_$][\w$]*$/.test(name)) declared.add(name);
        }
    }
    for (const match of body.matchAll(/\bcatch\s*\(\s*([A-Za-z0-9_$]+)/g)) {
        declared.add(match[1]);
    }
    return declared;
}

function parseImportClause(clause) {
    const result = { named: [], namespace: false, defaultName: "" };
    const trimmed = clause.trim();
    if (!trimmed) return result;
    if (trimmed.includes("*")) {
        result.namespace = true;
        return result;
    }
    const braceMatch = trimmed.match(/\{([\s\S]*)\}/);
    if (braceMatch) {
        result.named = braceMatch[1]
            .split(",")
            .map(part => part.trim())
            .filter(Boolean)
            .map(part => part.split(/\s+as\s+/)[0].trim())
            .filter(Boolean);
        const beforeBrace = trimmed.slice(0, braceMatch.index).replace(/,/g, "").trim();
        if (/^[A-Za-z_$][\w$]*$/.test(beforeBrace)) result.defaultName = beforeBrace;
        return result;
    }
    if (/^[A-Za-z_$][\w$]*$/.test(trimmed)) result.defaultName = trimmed;
    return result;
}

const moduleFiles = scanRoots.flatMap(directory => listModuleFiles(directory));

test("scan menemukan berkas modul yang diperiksa", () => {
    assert.ok(moduleFiles.length > 40, `hanya ${moduleFiles.length} berkas ditemukan`);
    assert.ok(moduleFiles.includes("api/social-publisher.js"));
});

test("setiap ekspor modul lokal yang dipakai sudah diimpor, dan setiap import benar-benar ada", () => {
    const problems = [];

    for (const file of moduleFiles) {
        const source = stripComments(readSource(file));
        /* Buang import dan pernyataan re-export `export { a, b } from "./x.js"`
           agar nama di dalamnya tidak dihitung sebagai pemakaian. */
        const identifierOnly = stripStrings(
            source
                .replace(IMPORT_STATEMENT_PATTERN, " ")
                .replace(/export\s*\{[^}]*\}\s*(?:from\s*["'][^"']+["'])?\s*;?/g, " ")
        );
        const importedByModule = new Map();
        /* Nama yang diimpor dari modul mana pun di berkas ini. Dipakai untuk
           menghindari alarm palsu ketika beberapa modul mengekspor nama sama
           (mis. `getParameters` di parameters.js dan parameter-adapter.js). */
        const importedAnywhere = new Set();

        for (const match of source.matchAll(IMPORT_STATEMENT_PATTERN)) {
            const target = resolveLocal(file, match[2]);
            if (!target) {
                problems.push(`${file}: import relatif tidak ditemukan -> ${match[2]}`);
                continue;
            }
            const clause = parseImportClause(match[1]);
            const imported = importedByModule.get(target) || new Set();
            if (clause.namespace) {
                imported.add("*namespace*");
                importedAnywhere.add("*namespace*");
            }
            if (clause.defaultName) {
                imported.add(clause.defaultName);
                importedAnywhere.add(clause.defaultName);
            }
            for (const name of clause.named) {
                imported.add(name);
                importedAnywhere.add(name);
            }
            importedByModule.set(target, imported);

            const exported = exportedNamesOf(target);
            if (hasReExport(target)) continue;
            /* Default import tidak bisa diverifikasi lewat regex ekspor. */
            for (const name of clause.named) {
                if (!exported.has(name)) {
                    problems.push(`${file}: mengimpor "${name}" yang tidak diekspor ${target}`);
                }
            }
        }
        for (const match of source.matchAll(SIDE_EFFECT_IMPORT_PATTERN)) {
            const target = resolveLocal(file, match[1]);
            if (!target) problems.push(`${file}: import relatif tidak ditemukan -> ${match[1]}`);
        }

        const declared = localDeclarations(identifierOnly);
        for (const match of source.matchAll(IMPORT_STATEMENT_PATTERN)) {
            const target = resolveLocal(file, match[2]);
            if (!target || hasReExport(target)) continue;
            const imported = importedByModule.get(target) || new Set();
            if (imported.has("*namespace*") || importedAnywhere.has("*namespace*")) continue;
            for (const name of exportedNamesOf(target)) {
                if (importedAnywhere.has(name) || declared.has(name)) continue;
                /* `nama:` dilewati karena itu kunci objek/label, bukan pemakaian nilai. */
                const used = new RegExp(
                    `(?<![\\w$.])${name.replace(/\$/g, "\\$")}(?![\\w$])(?!\\s*:)`
                ).test(identifierOnly);
                if (used) {
                    problems.push(`${file}: memakai "${name}" dari ${target} tanpa mengimpornya`);
                }
            }
        }
    }

    assert.deepEqual(problems, [], `Masalah import lokal:\n${problems.join("\n")}`);
});
