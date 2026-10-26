import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const register = readFileSync(new URL("../register.html", import.meta.url), "utf8");
const reset = readFileSync(new URL("../reset-password.html", import.meta.url), "utf8");

const REQUIRED = [
    /class="brand-logo-img"\s+src="\/assets\/brand\/genz-ai-logo\.png/,
    /class="brand-logo-img"[\s\S]{0,200}?alt="GEN-Z\.AI"/,
    /width="720"\s+height="293"/,
];

test("Daftar & reset password memakai logo banner GEN-Z.AI", () => {
    assert.ok(
        existsSync(new URL("../assets/brand/genz-ai-logo.png", import.meta.url)),
        "File assets/brand/genz-ai-logo.png harus ada di repo"
    );
    for (const [name, page] of [["register.html", register], ["reset-password.html", reset]]) {
        for (const pattern of REQUIRED) {
            assert.match(page, pattern, `${name} harus memakai logo banner + alt + dimensi`);
        }
    }
    for (const gone of ["logo-gen", "logo-dash", "logo-zai", "brand-gen", "brand-dash", "brand-zai", "brand-name"]) {
        assert.ok(!register.includes(gone), `register.html: kelas teks lama "${gone}" harus sudah dihapus`);
        assert.ok(!reset.includes(gone), `reset-password.html: kelas teks lama "${gone}" harus sudah dihapus`);
    }
});

test("Skala logo 180px → 155px di HP, posisi aman untuk kedua mode", () => {
    for (const [name, page] of [["register.html", register], ["reset-password.html", reset]]) {
        const widths = [...page.matchAll(/\.brand-logo-img\s*\{[^}]*?width:\s*min\((\d+)px/g)].map((m) => Number(m[1]));
        assert.deepEqual([...widths].sort((a, b) => b - a), [180, 155], `${name}: skala logo harus 180px lalu 155px`);
    }
    // register: logo di panel visual yang tetap gelap di mode terang (dark island)
    const visualIndex = register.indexOf('class="visual"');
    const regLogoIndex = register.indexOf('class="brand-logo-img"');
    assert.ok(visualIndex !== -1 && regLogoIndex > visualIndex, "register.html: logo harus di dalam .visual (pulau gelap)");
    // reset-password: kartunya bisa putih di mode terang → logo wajib diberi plat gelap
    assert.match(
        reset,
        /html\[data-genz-theme="light"\]\s\.brand-logo-img\s*\{[^}]*background:\s*#10151f/,
        "reset-password.html: mode terang harus memberi plat gelap agar teks putih logo terbaca"
    );
});
