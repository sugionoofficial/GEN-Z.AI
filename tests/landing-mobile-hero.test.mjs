import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const home = readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("Hero tidak tertutup navbar fixed — padding atas cukup di semua breakpoint", () => {
    const heroPaddings = [...home.matchAll(/\.hero\s*\{[^}]*?padding:\s*(\d+)px/g)]
        .map((match) => Number(match[1]));
    assert.ok(heroPaddings.length >= 3, `Minimal 3 aturan padding hero (base + 2 mobile), ditemukan ${heroPaddings.length}`);
    for (const padding of heroPaddings) {
        assert.ok(padding >= 80, `Padding atas hero ${padding}px terlalu kecil untuk navbar fixed`);
    }
    assert.ok(
        heroPaddings.some((padding) => padding >= 118),
        "Mode HP butuh padding atas hero >= 118px (navbar 2 baris ±107px + sisa)"
    );
    assert.doesNotMatch(home, /\.hero\s*\{[^}]*?padding:\s*92px/, "Padding hero 92px lama (menutupi eyebrow) tidak boleh kembali");
});

test("Teks AI CREATIVE PLATFORM tetap ada di puncak hero", () => {
    assert.match(home, /<div class="eyebrow">\s*AI CREATIVE PLATFORM\s*<\/div>/, "Eyebrow AI CREATIVE PLATFORM harus tetap di hero-copy");
    const heroIndex = home.indexOf('<section class="hero">');
    const eyebrowIndex = home.indexOf('<div class="eyebrow">');
    assert.ok(heroIndex !== -1 && eyebrowIndex > heroIndex, "Eyebrow harus berada di dalam section hero");
});
