'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateTask } = require('../task-validator.cjs');

const imageTask = {
    mediaType: 'image',
    prompt: 'Portrait editorial at golden hour',
    model: 'nano-banana-2.1',
    ratio: '9:16',
    outputCount: 2,
    referenceCount: 5
};

test('valid image task is reduced to the small allowed handoff schema', () => {
    const task = validateTask({ ...imageTask, arbitrary: 'discard me' });
    assert.deepEqual(task, imageTask);
    assert.equal(Object.hasOwn(task, 'arbitrary'), false);
});

test('valid video task requires a supported model, aspect, duration, and input mode', () => {
    const task = validateTask({
        mediaType: 'video', prompt: 'Slow dolly shot', model: 'Veo 3.1 Fast',
        ratio: '16:9', outputCount: 1, referenceCount: 2, duration: 8, inputMode: 'ingredients'
    });
    assert.equal(task.mediaType, 'video');
    assert.equal(task.duration, 8);
    assert.equal(task.inputMode, 'ingredients');
});

test('rejects blank/oversized prompts and unsupported models or ratios', () => {
    assert.throws(() => validateTask({ ...imageTask, prompt: '   ' }), /Prompt wajib/);
    assert.throws(() => validateTask({ ...imageTask, prompt: 'x'.repeat(5001) }), /Prompt wajib/);
    assert.throws(() => validateTask({ ...imageTask, model: 'private-endpoint-model' }), /Model tidak didukung/);
    assert.throws(() => validateTask({ ...imageTask, ratio: '2:1' }), /Rasio tidak didukung/);
});

test('rejects invalid output counts, reference counts, and video modes', () => {
    assert.throws(() => validateTask({ ...imageTask, outputCount: 5 }), /Jumlah output/);
    assert.throws(() => validateTask({ ...imageTask, referenceCount: 9 }), /Jumlah referensi/);
    assert.throws(() => validateTask({
        mediaType: 'video', prompt: 'x', model: 'Omni 1.1 Flash', ratio: '9:16',
        outputCount: 1, referenceCount: 0, duration: 10, inputMode: 'arbitrary'
    }), /Mode video/);
});
