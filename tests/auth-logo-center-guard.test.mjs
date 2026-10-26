import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const register = readFileSync(new URL("../register.html", import.meta.url), "utf8");
const reset = readFileSync(new URL("../reset-password.html", import.meta.url), "utf8");

function baseLogoRule(page, name) {
    const match = page.match(/\.brand-logo-img\s*\{[^}]*\}/);
    assert.ok(match, `${name}: aturan .brand-logo-img harus ada`);
    return match[0];
}

test("Logo daftar ter-center horizontal di panel visual (margin auto kiri-kanan)", () => {
    const rule = baseLogoRule(register, "register.html");
    assert.match(rule, /margin-left:\s*auto/, "register.html: logo harus margin-left:auto (center)");
    assert.match(rule, /margin-right:\s*auto/, "register.html: logo harus margin-right:auto (center)");
});

test("Logo daftar & reset password tidak bisa di-drag / di-download", () => {
    for (const [name, page] of [["register.html", register], ["reset-password.html", reset]]) {
        assert.match(
            page,
            /class="brand-logo-img"[\s\S]{0,320}?draggable="false"/,
            `${name}: <img> wajib punya draggable="false"`
        );
        const rule = baseLogoRule(page, name);
        assert.match(rule, /pointer-events:\s*none/, `${name}: CSS wajib pointer-events:none`);
        assert.match(rule, /-webkit-user-drag:\s*none/, `${name}: CSS wajib -webkit-user-drag:none`);
    }
});
