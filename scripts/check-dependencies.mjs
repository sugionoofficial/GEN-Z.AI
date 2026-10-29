#!/usr/bin/env node
/**
 * Pemeriksaan dependensi sebelum build/deploy.
 *
 * Latar belakang: `npx wrangler deploy` di clone yang belum pernah
 * `npm install` gagal dengan pesan membingungkan:
 *
 *   ✘ [ERROR] Could not resolve "jpeg-js"
 *
 * Padahal paketnya sudah tercatat di package.json — yang kurang hanya folder
 * node_modules. Skrip ini memeriksa lebih dulu dan memberi instruksi yang jelas.
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const REQUIRED = [
    { name: "jpeg-js", usedIn: "lib/social-publisher/providers.js, story-video.js, reference-image.js" },
    { name: "pngjs", usedIn: "lib/social-publisher/reference-image.js" },
    { name: "@stacksjs/ts-webp", usedIn: "lib/social-publisher/reference-image.js" }
];

function isResolvable(packageName) {
    /* `import.meta.resolve` mengikuti field "exports" (banyak paket modern,
       termasuk yang ESM-only, menolak subpath package.json). */
    if (typeof import.meta.resolve === "function") {
        try {
            import.meta.resolve(packageName);
            return true;
        } catch {
            /* lanjut ke cara lama */
        }
    }
    try {
        require.resolve(packageName);
        return true;
    } catch {
        return false;
    }
}

const missing = REQUIRED.filter(pkg => !isResolvable(pkg.name));

if (!missing.length) {
    console.log(`Dependensi siap (${REQUIRED.length} paket terpasang).`);
    process.exit(0);
}

console.error("");
console.error("✘ Dependensi belum terpasang — build/deploy akan gagal.");
console.error("");
for (const pkg of missing) {
    console.error(`   - ${pkg.name}  (dipakai di ${pkg.usedIn})`);
}
console.error("");
console.error("Jalankan dulu salah satu perintah berikut, lalu ulangi deploy:");
console.error("");
console.error("   npm install          # atau: npm ci");
console.error("   npm run deploy       # cek dependensi + build + wrangler deploy");
console.error("");
console.error("Catatan: jangan jalankan `npx wrangler deploy` langsung dari clone yang");
console.error("belum di-install, karena bundler tidak menemukan paket di atas.");
console.error("");
process.exit(1);
