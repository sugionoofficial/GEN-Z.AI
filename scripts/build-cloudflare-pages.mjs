import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "dist");
const staticDirectories = [
    "admin",
    "admin-control",
    "assets",
    "generate",
    "history",
    "metadata-cleaner",
    "navigation",
    "prompt-studio",
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
    "register.html",
    "reset-password.html",
    "dang1.mp3",
    "ssstik.io_1790719438524 (1).mp3"
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

await writeFile(
    path.join(output, "_routes.json"),
    JSON.stringify({
        version: 1,
        include: ["/api/*"],
        exclude: []
    }, null, 2) + "\n"
);

console.log(`Cloudflare Pages assets built in ${path.relative(root, output)}`);
