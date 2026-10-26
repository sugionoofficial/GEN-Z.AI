import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const home = readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("Landing page memakai logo banner GEN-Z.AI (bukan kotak G + tulisan)", () => {
    assert.match(
        home,
        /class="brand-logo-img"\s+src="\/assets\/brand\/genz-ai-logo\.png/,
        "Header landing harus memakai gambar /assets/brand/genz-ai-logo.png"
    );
    assert.match(home, /class="brand-logo-img"[\s\S]{0,200}?alt="GEN-Z\.AI"/, "Logo harus punya alt GEN-Z.AI");
    assert.match(home, /width="720"\s+height="293"/, "Dimensi asli logo harus dicatat (cegah layout shift)");
    assert.ok(
        existsSync(new URL("../assets/brand/genz-ai-logo.png", import.meta.url)),
        "File assets/brand/genz-ai-logo.png harus ada di repo"
    );
    assert.doesNotMatch(home, /brand-mark/, "Logo G lama (brand-mark) harus sudah dihapus total");
});

test("Logo landing aman untuk tema gelap dan terang", () => {
    assert.match(home, /\.brand-logo-img\s*\{[^}]*height:\s*42px/, "Tinggi logo desktop harus diatur CSS");
    assert.match(
        home,
        /html\[data-genz-theme="light"\]\s\.brand-logo-img\s*\{[^}]*background:\s*#10151f/,
        "Tema terang harus memberi plat gelap agar teks putih logo tetap terbaca"
    );
});
