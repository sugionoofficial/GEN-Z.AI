import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const read = relative => readFileSync(path.join(root, relative), "utf8");

const privacy = read("privacy/index.html");
const terms = read("terms/index.html");
const home = read("index.html");
const buildScript = read("scripts/build-cloudflare-pages.mjs");
const manifest = JSON.parse(read("manifest.webmanifest"));

function internalLinks(html) {
    return [...html.matchAll(/href="(\/[^"#?]*)/g)].map(match => match[1]);
}

function resolvesToPage(link) {
    const clean = link.replace(/^\//, "");
    if (!clean) return existsSync(path.join(root, "index.html"));
    const asFile = path.join(root, clean);
    if (existsSync(asFile) && statSync(asFile).isFile()) return true;
    const asDirectory = path.join(root, clean, "index.html");
    return existsSync(asDirectory);
}

function pngSize(relative) {
    const buffer = readFileSync(path.join(root, relative));
    assert.equal(buffer.subarray(1, 4).toString("ascii"), "PNG", `${relative} is not a PNG`);
    return {
        width: buffer.readUInt32BE(16),
        height: buffer.readUInt32BE(20),
        bytes: buffer.length
    };
}

test("privacy and terms pages exist and are self-describing", () => {
    for (const [name, html, title, canonical] of [
        ["privacy", privacy, "Kebijakan Privasi", "https://genzai.genzai-f37.workers.dev/privacy/"],
        ["terms", terms, "Ketentuan Layanan", "https://genzai.genzai-f37.workers.dev/terms/"]
    ]) {
        assert.match(html, /<html lang="id">/, `${name} must declare the Indonesian locale`);
        assert.match(html, /<meta charset="UTF-8">/, `${name} needs a charset`);
        assert.match(html, /name="viewport"/, `${name} needs a viewport`);
        assert.ok(html.includes(`<title>${title} — GEN-Z.AI</title>`), `${name} title mismatch`);
        assert.ok(html.includes(`rel="canonical" href="${canonical}"`), `${name} canonical mismatch`);
        assert.ok(html.includes('href="../assets/css/legal.css"'), `${name} must load the legal stylesheet`);
        assert.ok(html.includes('src="/navigation/navigation.js"'), `${name} must load the shared navigation`);
        assert.ok(existsSync(path.join(root, name, "index.html")), `${name}/index.html missing`);
    }
});

test("privacy policy covers the data Meta and users expect", () => {
    const required = [
        "id=\"data\"",
        "id=\"facebook\"",
        "id=\"pihak-ketiga\"",
        "id=\"hapus\"",
        "id=\"kontak\"",
        "pages_show_list",
        "pages_read_engagement",
        "pages_manage_posts",
        "/api/facebook-data-deletion",
        "/live-chat/",
        "Supabase",
        "Cloudflare",
        "Google",
        "Meta",
        "AES-GCM",
        "Row Level Security",
        "Undang-Undang Perlindungan Data Pribadi",
        "Kebijakan Privasi"
    ];
    for (const needle of required) {
        assert.ok(privacy.includes(needle), `privacy policy is missing: ${needle}`);
    }
    assert.match(privacy, /Berlaku 21 Oktober 2026/);
});

test("terms cover accounts, credits, AI limits, and Facebook publishing duties", () => {
    const required = [
        "id=\"kelayakan\"",
        "id=\"kredit\"",
        "id=\"larangan\"",
        "id=\"publisher\"",
        "id=\"tanggung-jawab\"",
        "CREATE_CONTENT",
        "Meta Platform Terms",
        "18 tahun",
        "tidak dapat dipindahkan",
        "/privacy/",
        "/user/topup.html",
        "/live-chat/"
    ];
    for (const needle of required) {
        assert.ok(terms.includes(needle), `terms page is missing: ${needle}`);
    }
    assert.match(terms, /Berlaku 21 Oktober 2026/);
});

test("legal pages avoid placeholders and broken internal links", () => {
    for (const [name, html] of [["privacy", privacy], ["terms", terms]]) {
        assert.doesNotMatch(html, /TODO|lorem ipsum|example\.com|your-email@/i, `${name} contains placeholders`);
        for (const link of internalLinks(html)) {
            if (link.startsWith("/api/")) continue;
            assert.ok(resolvesToPage(link), `${name} links to a missing page: ${link}`);
        }
    }
});

test("homepage footer exposes both legal pages", () => {
    const footer = home.slice(home.lastIndexOf('<div class="footer-links">'));
    assert.ok(footer.includes('href="/privacy/"'), "homepage footer must link to the privacy policy");
    assert.ok(footer.includes('href="/terms/"'), "homepage footer must link to the terms page");
});

test("build copies both legal directories to dist", () => {
    assert.match(buildScript, /^\s*"privacy",$/m, "privacy must be in staticDirectories");
    assert.match(buildScript, /^\s*"terms",$/m, "terms must be in staticDirectories");
});

test("Meta app icon is a 1024x1024 PNG well under the 5 MB limit", () => {
    const icon = pngSize("assets/genzai-app-icon-1024.png");
    assert.equal(icon.width, 1024);
    assert.equal(icon.height, 1024);
    assert.ok(icon.bytes < 5 * 1024 * 1024, `icon is ${icon.bytes} bytes, above Meta's 5 MB limit`);

    const sizes = manifest.icons.map(entry => entry.sizes);
    assert.ok(sizes.includes("1024x1024"), "manifest should expose the 1024 icon");
});
