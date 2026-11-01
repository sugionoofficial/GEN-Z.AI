import {
    cp,
    mkdir,
    readFile,
    readdir,
    rm,
    stat
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "dist");
const staticDirectories = [
    "admin",
    "admin-control",
    "assets",
    "black-box",
    "credit",
    "generate",
    "history",
    "live-chat",
    "metadata-cleaner",
    "models",
    "navigation",
    "opusclip",
    "privacy",
    "prompt-studio",

    /*
     * Adapter model di models/** meng-import provider/**
     * (mis. models/qwencloud-video/factory.js), jadi folder
     * ini WAJIB ikut di-copy ke dist. Tanpa ini browser
     * gagal memuat models-data.js karena 404 pada
     * provider/qwencloud/client.js.
     */

    "provider",

    "terms",
    "topup",
    "upscale",
    "user",
    "viddra",
    "vision",
    "vision-video"
];
const staticFiles = [
    "favicon.ico",
    "index.html",
    "login.html",
    "manifest.webmanifest",
    "register.html",
    "reset-password.html",
    "service-worker.js",
    "email.html",
    "tiktokRA1pfqteEbk7mpBgD70IGSxDBNEdACO7.txt"
];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const directory of staticDirectories) {
    await cp(path.join(root, directory), path.join(output, directory), {
        recursive: true
    });
}

for (const file of staticFiles) {
    await cp(path.join(root, file), path.join(output, file));
}

/* =========================================================
   VERIFIKASI RELATIVE IMPORT
   ---------------------------------------------------------
   Browser memuat module apa adanya (tanpa bundler), jadi
   satu file yang tidak ikut ter-copy membuat dynamic import
   gagal di production dengan pesan:
   "Failed to fetch dynamically imported module".

   Contoh kasus nyata: models/qwencloud-video/factory.js
   meng-import ../../provider/qwencloud/client.js, dan folder
   provider/ dulu tidak ada di daftar staticDirectories.
========================================================= */

const importPattern =
    /(?:import|export)[\s\S]*?from\s*["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;

async function collectScripts(
    directory
) {
    const entries =
        await readdir(directory, { withFileTypes: true });

    const result = [];

    for (const entry of entries) {
        const full = path.join(directory, entry.name);

        if (entry.isDirectory()) {
            result.push(...await collectScripts(full));
            continue;
        }

        if (entry.name.endsWith(".js")) {
            result.push(full);
        }
    }

    return result;
}

async function fileExists(
    target
) {
    try {
        return (await stat(target)).isFile();
    } catch {
        return false;
    }
}

async function assertImportsResolve() {
    const scripts = await collectScripts(output);
    const missing = [];

    for (const script of scripts) {
        const source = await readFile(script, "utf8");

        for (const match of source.matchAll(importPattern)) {
            const specifier = (match[1] || match[2] || "").split("?")[0];

            if (!specifier.startsWith(".")) {
                continue;
            }

            const base = path.resolve(path.dirname(script), specifier);
            const candidates = [
                base,
                `${base}.js`,
                `${base}.mjs`,
                path.join(base, "index.js")
            ];

            let found = false;

            for (const candidate of candidates) {
                if (await fileExists(candidate)) {
                    found = true;
                    break;
                }
            }

            if (!found) {
                missing.push(
                    `${path.relative(output, script)} → ${specifier}`
                );
            }
        }
    }

    if (missing.length) {
        throw new Error(
            "Relative import tidak ditemukan di dist (module akan gagal dimuat di browser):\n" +
            missing.map(item => `  - ${item}`).join("\n") +
            "\nTambahkan folder sumbernya ke staticDirectories di scripts/build-cloudflare-pages.mjs."
        );
    }

    console.log(
        `Verified ${scripts.length} browser module (semua relative import ditemukan).`
    );
}

await assertImportsResolve();

console.log(`Cloudflare Worker assets built in ${path.relative(root, output)}`);
