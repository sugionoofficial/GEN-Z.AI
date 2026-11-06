import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mountOpenClipsOAuth } from "../black-box/assets/js/openclips-oauth.js";

function element() {
    return {
        children: [], handlers: {}, disabled: false,
        replaceChildren() { this.children = []; },
        appendChild(child) { this.children.push(child); },
        addEventListener(name, handler) { this.handlers[name] = handler; },
        focus() { this.focused = true; }
    };
}
test("OpenClips Black Box adds and removes login slots without removing slot one", () => {
    const ids = Object.fromEntries(["bbOpenClipsAccounts", "bbOpenClipsAdd", "bbOpenClipsRemove", "bbOpenClipsCount"].map(id => [id, element()]));
    mountOpenClipsOAuth({ getElementById: id => ids[id], createElement: element });
    const { bbOpenClipsAccounts: accounts, bbOpenClipsAdd: add, bbOpenClipsRemove: remove, bbOpenClipsCount: count } = ids;
    assert.equal(remove.disabled, true);
    add.handlers.click();
    add.handlers.click();
    assert.equal(count.textContent, "3 slot akun");
    assert.deepEqual(accounts.children.map(link => link.href), [1, 2, 3].map(slot => `/api/openclips-oauth-login?slot=${slot}`));
    for (const link of accounts.children) {
        assert.equal(link.target, "_blank");
        assert.equal(link.rel, "noopener noreferrer");
    }
    remove.handlers.click();
    remove.handlers.click();
    remove.handlers.click();
    assert.equal(accounts.children.length, 1);
    assert.equal(remove.disabled, true);
    assert.equal(add.focused, true);
    add.handlers.click();
    assert.equal(accounts.children[1].href, "/api/openclips-oauth-login?slot=2");
});
test("OpenClips control safely skips pages without the tile", () => {
    assert.doesNotThrow(() => mountOpenClipsOAuth({ getElementById: () => null }));
});
test("Black Box exposes an accessible OpenClips OAuth tile and fallback login", () => {
    const html = readFileSync(new URL("../black-box/index.html", import.meta.url), "utf8");
    assert.match(html, /AUTH OPENCLIPS LOGIN/);
    assert.match(html, /href="\/api\/openclips-oauth-login\?slot=1"/);
    assert.match(html, /aria-label="Tambah slot akun OpenClips"/);
    assert.match(html, /aria-label="Kurangi slot akun OpenClips"/);
    assert.match(html, /type="module" src="\.\/assets\/js\/openclips-oauth.js\?v=/);
    assert.match(html, /04 \/ 09/);
});
