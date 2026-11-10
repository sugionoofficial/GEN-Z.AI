'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildFillTaskScript, labelForModel } = require('../flow-ui-automation.cjs');

test('maps supported image model ids to the visible Flow labels', () => {
    assert.equal(labelForModel('image', 'nano-banana-2.1'), 'Nano Banana 2.1');
    assert.equal(labelForModel('image', 'nano-banana-pro'), 'Nano Banana Pro');
    assert.throws(() => labelForModel('image', 'unknown-model'), /tidak didukung/);
});

test('Flow task script uses visible DOM controls and dispatches normal input events', () => {
    const script = buildFillTaskScript({
        mediaType: 'video', prompt: 'A slow camera move', model: 'Veo 3.1 Fast',
        ratio: '16:9', outputCount: 2, duration: 8, inputMode: 'ingredients'
    });
    assert.match(script, /textarea/);
    assert.match(script, /contenteditable/);
    assert.match(script, /dispatchEvent\(new InputEvent/);
    assert.match(script, /Veo 3\.1 Fast/);
    assert.match(script, /Ingredients/);
    assert.doesNotMatch(script, /fetch\(|XMLHttpRequest|WebSocket|cookie/i);
});
