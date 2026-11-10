import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function setup() {
    const html = fs.readFileSync('admin-control/opus-credentials.html', 'utf8');
    const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
    class Element {
        constructor() { this.children = []; this.value = ''; this.textContent = ''; this.disabled = false; }
        append(...nodes) { this.children.push(...nodes); }
        replaceChildren(...nodes) { this.children = nodes; this.textContent = ''; }
        setAttribute(name, value) { this[name] = value; }
        focus() { this.focused = true; }
    }
    const ids = ['status','credential-form','credential','slot-title','slot-state','previous-slot','next-slot','save','saved-slots','last-slot','slot-number'];
    const elements = Object.fromEntries(ids.map(id => [id, new Element()]));
    const document = {getElementById: id => elements[id], createElement: () => new Element()};
    let rows = [
        {slot: 1, id: 'one', credit_status: 'exhausted', credit_status_updated_at: '2026-11-01T12:00:00Z'},
        {slot: 2, id: 'two', credit_status: 'available', credit_status_updated_at: '2026-11-02T12:00:00Z'}
    ], post;
    let confirmResult = true;
    const fetch = async (_url, options) => {
        if (options.method === 'GET') return {ok: true, json: async () => ({credentials: rows})};
        if (options.method === 'POST') {
            post = JSON.parse(options.body);
            if (!rows.some(row => row.slot === post.slot)) rows = [...rows, {slot: post.slot, id: 'new'}];
            return {ok: true, json: async () => ({success: true})};
        }
        const body = JSON.parse(options.body); rows = rows.filter(row => row.id !== body.id);
        return {ok: true, json: async () => ({success: true})};
    };
    vm.runInNewContext(script, {document, fetch, window: {GENZSession: {ensureFreshSession: async () => ({access_token:'jwt'})}}, confirm: () => confirmResult, Number});
    return {elements, getPost: () => post, setConfirm: value => {confirmResult = value;}};
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('one input selects slots, explicitly edits existing tokens and saves the selected slot', async () => {
    const {elements: el, getPost, setConfirm} = setup(); await tick();
    assert.equal(el['slot-title'].textContent, 'OPUS_AUTH_TOKEN_1');
    assert.equal(el['saved-slots'].children[0].children[0].children[1].textContent, 'Credit habis');
    assert.equal(el['saved-slots'].children[0].children[0].children[1].className, 'credit-indicator exhausted');
    assert.equal(el['saved-slots'].children[1].children[0].children[1].textContent, 'Credit tersedia');
    assert.equal(el['saved-slots'].children[1].children[0].children[1].className, 'credit-indicator available');
    assert.equal(el.credential.disabled, true);
    el['next-slot'].onclick();
    assert.equal(el['slot-title'].textContent, 'OPUS_AUTH_TOKEN_2');
    assert.equal(el.credential.disabled, true);
    el['next-slot'].onclick();
    assert.equal(el['slot-title'].textContent, 'OPUS_AUTH_TOKEN_3');
    assert.equal(el.credential.disabled, false);
    el.credential.value = 'unsaved'; setConfirm(false); el['previous-slot'].onclick();
    assert.equal(el['slot-title'].textContent, 'OPUS_AUTH_TOKEN_3'); assert.equal(el.credential.value, 'unsaved');
    setConfirm(true); el['saved-slots'].children[0].children[1].children[0].onclick();
    assert.equal(el['slot-title'].textContent, 'OPUS_AUTH_TOKEN_1');
    assert.equal(el.credential.value, ''); assert.equal(el.credential.disabled, false);
    el.credential.value = 'new-json';
    await el['credential-form'].onsubmit({preventDefault() {}});
    assert.equal(getPost().slot, 1); assert.equal(getPost().credential, 'new-json');
    assert.equal(el.credential.value, ''); assert.equal(el.credential.disabled, true);
    assert.match(el.status.textContent, /berhasil disimpan/);
});

test('minus only changes selection; deleting a saved slot requires confirmation', async () => {
    const {elements: el, setConfirm} = setup(); await tick();
    el['next-slot'].onclick(); el['previous-slot'].onclick();
    assert.equal(el['saved-slots'].children.length, 2);
    setConfirm(false); await el['saved-slots'].children[0].children[1].children[1].onclick();
    assert.equal(el['saved-slots'].children.length, 2);
    setConfirm(true); await el['saved-slots'].children[0].children[1].children[1].onclick();
    assert.equal(el['saved-slots'].children.length, 1);
    assert.equal(el.credential.disabled, false);
});


test('highest saved slot is shown and numeric entry selects the matching slot safely', async () => {
    const {elements: el, getPost, setConfirm} = setup(); await tick();
    assert.equal(el['last-slot'].textContent, 'Terakhir: _2');
    el['slot-number'].value = '7'; el['slot-number'].oninput();
    assert.equal(el['slot-title'].textContent, 'OPUS_AUTH_TOKEN_7');
    assert.equal(el.credential.disabled, false);
    el.credential.value = 'secret';
    el['slot-number'].value = 'abc'; el['slot-number'].oninput();
    assert.equal(el.save.disabled, true);
    await el['credential-form'].onsubmit({preventDefault() {}});
    assert.equal(getPost(), undefined);
    setConfirm(false); el['slot-number'].value = '8'; el['slot-number'].oninput();
    assert.equal(el['slot-number'].value, '7'); assert.equal(el.credential.value, 'secret');
    await el['credential-form'].onsubmit({preventDefault() {}});
    assert.equal(getPost().slot, 7); assert.equal(el['last-slot'].textContent, 'Terakhir: _7');
    el['slot-number'].value = '2'; el['slot-number'].oninput();
    assert.equal(el.credential.disabled, true); // Existing slots still require explicit Edit.
    setConfirm(true); el['saved-slots'].children[2].children[1].children[1].onclick();
    await tick();
    assert.equal(el['last-slot'].textContent, 'Terakhir: _2');
});
