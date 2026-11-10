'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { removeExpiredStagingDirectories, stageReferences } = require('../reference-stager.cjs');

const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);

async function tempRoot() {
    return fs.mkdtemp(path.join(os.tmpdir(), 'genz-flow-stage-test-'));
}

test('stages supported image bytes with generated safe names, not user filenames', async t => {
    const root = await tempRoot();
    t.after(() => fs.rm(root, { recursive: true, force: true }));
    const staged = await stageReferences([
        { bucket: 'character', mimeType: 'image/png', name: '../../secret.png', bytes: png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength) },
        { bucket: 'scene', mimeType: 'image/png', name: 'scene.png', bytes: png }
    ], root);
    assert.equal(staged.count, 2);
    assert.deepEqual((await fs.readdir(staged.directory)).sort(), ['character-01.png', 'scene-01.png']);
    assert.deepEqual(await fs.readFile(path.join(staged.directory, 'character-01.png')), png);
});

test('rejects invalid MIME, file signatures, bucket names, and more than eight files', async t => {
    const root = await tempRoot();
    t.after(() => fs.rm(root, { recursive: true, force: true }));
    await assert.rejects(stageReferences([{ bucket: 'character', mimeType: 'text/plain', bytes: png }], root), /JPG, PNG/);
    await assert.rejects(stageReferences([{ bucket: '../../', mimeType: 'image/png', bytes: png }], root), /Kategori/);
    await assert.rejects(stageReferences([{ bucket: 'character', mimeType: 'image/png', bytes: Buffer.from('not an image') }], root), /tidak sesuai/);
    await assert.rejects(stageReferences(Array.from({ length: 9 }, () => ({ bucket: 'character', mimeType: 'image/png', bytes: png })), root), /satu dan delapan/);
    assert.deepEqual(await fs.readdir(root), []);
});

test('removes only expired staging folders', async t => {
    const root = await tempRoot();
    t.after(() => fs.rm(root, { recursive: true, force: true }));
    const oldDir = path.join(root, 'old');
    const newDir = path.join(root, 'new');
    await fs.mkdir(oldDir);
    await fs.mkdir(newDir);
    const now = Date.now();
    await fs.utimes(oldDir, new Date(now - 48 * 60 * 60 * 1000), new Date(now - 48 * 60 * 60 * 1000));
    await fs.utimes(newDir, new Date(now - 10_000), new Date(now - 10_000));
    assert.equal(await removeExpiredStagingDirectories(root, 24 * 60 * 60 * 1000, now), 1);
    assert.deepEqual(await fs.readdir(root), ['new']);
});
