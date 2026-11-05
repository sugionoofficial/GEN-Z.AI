import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../admin-control/copilot/assets/css/copilot.css", import.meta.url), "utf8");

/* ---------------------------------------------------------------------
   Uji tata letak tanpa browser.
   Sandbox tidak dapat memasang Chromium, jadi tinggi tiap baris tata
   letak dihitung dari nilai CSS-nya. Tujuannya menangkap kesalahan yang
   paling merusak: halaman ikut menggulir karena satu baris tidak boleh
   menyusut.
   --------------------------------------------------------------------- */

function rule(selector) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = css.match(new RegExp(`(^|\\n)${escaped}\\s*\\{([^}]*)\\}`));
    assert.ok(match, `aturan ${selector} tidak ditemukan`);
    return match[2];
}

function numeric(declarations, property, fallback = 0) {
    const match = declarations.match(new RegExp(`${property}:\\s*(-?[\\d.]+)px`));
    return match ? Number(match[1]) : fallback;
}

function minHeight(declarations, fallback = 0) {
    const match = declarations.match(/min-height:\s*(\d+)px/);
    return match ? Number(match[1]) : fallback;
}

function paddingBlock(declarations) {
    const shorthand = declarations.match(/padding:\s*([^;]+);/);
    if (shorthand) {
        const parts = shorthand[1].trim().split(/\s+/);
        const toPx = value => (value.includes("px") ? parseFloat(value) : 0);
        if (parts.length === 1) return toPx(parts[0]) * 2;
        if (parts.length === 2) return toPx(parts[0]) * 2;
        if (parts.length === 3) return toPx(parts[0]) + toPx(parts[2]);
        return toPx(parts[0]) + toPx(parts[2]);
    }
    return numeric(declarations, "padding-top") + numeric(declarations, "padding-bottom");
}

test("Admin Copilot: baris tetap (chrome) muat di layar pendek 720px tanpa memakan ruang panel", () => {
    /*
     * Chrome = topbar + baris git + footer. Bila totalnya melebihi ~26%
     * tinggi layar 720px, panel jadi tidak lega — persis keluhan
     * "blok turun ke bawah".
     */
    const chrome =
        Math.max(minHeight(rule(".topbar")), 0) +
        Math.max(minHeight(rule(".gitbar")), 0) +
        0;

    assert.ok(chrome <= 180, `chrome terlalu tinggi: ${chrome}px`);
});

test("Admin Copilot: workspace mengambil sisa tinggi, bukan tinggi minimum halaman", () => {
    const workspace = rule(".workspace");
    assert.match(workspace, /min-height:\s*0\b/, "workspace harus boleh menyusut sampai 0");
    assert.match(workspace, /flex:\s*1 1 auto/, "workspace harus mengisi sisa ruang");

    /* Hanya baris tata letak utama yang dilarang punya tinggi minimum besar. */
    for (const selector of [".copilot-shell", ".workspace", ".panel"]) {
        assert.ok(
            !/min-height:\s*(?!0\b)\d+px/.test(rule(selector)),
            `${selector} tidak boleh punya min-height lebih dari 0`,
        );
    }

    const shell = rule(".copilot-shell");
    assert.match(shell, /height:\s*100dvh/);
    assert.match(shell, /flex-direction:\s*column/);
});

test("Admin Copilot: panel memakai flex column agar isi panjang menggulir di dalam", () => {
    const panel = rule(".panel");
    assert.match(panel, /display:\s*flex/);
    assert.match(panel, /flex-direction:\s*column/);
    assert.match(panel, /min-height:\s*0/);
    assert.match(panel, /overflow:\s*hidden/);

    for (const selector of [".file-list", ".chat-messages"]) {
        const block = rule(selector);
        assert.match(block, /flex:\s*1 1 auto/, `${selector} harus mengisi panel`);
        assert.match(block, /min-height:\s*0/, `${selector} harus boleh menyusut`);
        assert.match(block, /overflow-y:\s*auto/, `${selector} harus menggulir sendiri`);
    }
});

test("Admin Copilot: teks panjang tidak boleh melebarkan kolom grid", () => {
    const workspace = rule(".workspace");
    assert.match(workspace, /grid-template-columns:\s*var\(--rail\) minmax\(0, 1fr\) var\(--assist\)/);
    assert.match(rule(".panel"), /min-width:\s*0/);
    assert.match(rule(".path-current"), /text-overflow:\s*ellipsis/);
    assert.match(rule(".gitbar-value"), /text-overflow:\s*ellipsis/);
});

test("Admin Copilot: latar halaman hitam pekat tanpa tint", () => {
    assert.match(rule("body"), /background:\s*#000000/);
    assert.ok(!/--bg-glow/.test(css), "tint latar berwarna sudah dihapus");
});
