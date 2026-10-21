import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "dist");
const staticDirectories = [
    "admin",
    "admin-control",
    "assets",
    "credit",
    "generate",
    "history",
    "live-chat",
    "metadata-cleaner",
    "models",
    "navigation",
    "privacy",
    "prompt-studio",
    "terms",
    "topup",
    "upscale",
    "user",
    "viddra",
    "vision",
    "vision-video"
];
const staticFiles = [
    "index.html",
    "login.html",
    "manifest.webmanifest",
    "register.html",
    "reset-password.html",
    "service-worker.js",
    "email.html"
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

console.log(`Cloudflare Worker assets built in ${path.relative(root, output)}`);
