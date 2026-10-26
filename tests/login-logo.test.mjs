import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const login = readFileSync(new URL("../login.html", import.meta.url), "utf8");

test("Halaman login memakai logo banner GEN-Z.AI, bukan tulisan besar span", () => {
    assert.match(
        login,
        /class="brand-logo-img"\s+src="\/assets\/brand\/genz-ai-logo\.png/,
        "Logo login harus memakai /assets/brand/genz-ai-logo.png"
    );
    assert.match(login, /class="brand-logo-img"[\s\S]{0,200}?alt="GEN-Z\.AI"/, "Logo harus punya alt GEN-Z.AI");
    assert.match(login, /width="720"\s+height="293"/, "Dimensi asli logo harus dicatat (cegah layout shift)");
    assert.ok(
        existsSync(new URL("../assets/brand/genz-ai-logo.png", import.meta.url)),
        "File assets/brand/genz-ai-logo.png harus ada di repo"
    );
    for (const gone of ["logo-gen", "logo-dash", "logo-zai", "class=\"brand-logo\""]) {
        assert.ok(!login.includes(gone), `Kelas logo teks lama "${gone}" harus sudah dihapus total`);
    }
});

test("Logo login berada di brand-panel gelap + skala desktop/HP diatur", () => {
    const panelIndex = login.indexOf('class="brand-panel"');
    const logoIndex = login.indexOf('class="brand-logo-img"');
    assert.ok(panelIndex !== -1 && logoIndex > panelIndex, "Logo harus di dalam brand-panel (pulau gelap) agar terbaca di mode terang & gelap");
    const widths = [...login.matchAll(/\.brand-logo-img\s*\{[^}]*?width:\s*min\((\d+)px/g)].map((m) => Number(m[1]));
    assert.deepEqual(
        [...widths].sort((a, b) => b - a),
        [420, 320, 215, 215],
        "Skala logo harus 420px desktop → 320px tablet → 215px di HP (lebih ringkas) "
    );
});
