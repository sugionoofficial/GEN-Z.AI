'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const MAX_FILE_BYTES = 12 * 1024 * 1024;
const ALLOWED = {
    'image/jpeg': { ext: 'jpg', signature: bytes => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
    'image/png': { ext: 'png', signature: bytes => bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) },
    'image/webp': { ext: 'webp', signature: bytes => bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP' }
};
const ALLOWED_BUCKETS = new Set(['character', 'outfit', 'scene', 'videoRef']);

function toBuffer(value) {
    if (Buffer.isBuffer(value)) return value;
    if (value instanceof ArrayBuffer) return Buffer.from(value);
    if (ArrayBuffer.isView(value)) return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
    throw new TypeError('Isi file referensi tidak valid.');
}

async function stageReferences(references, rootDirectory) {
    if (!Array.isArray(references) || references.length < 1 || references.length > 8) {
        throw new TypeError('Pilih antara satu dan delapan gambar referensi.');
    }

    const directory = path.join(rootDirectory, crypto.randomUUID());
    await fs.mkdir(directory, { recursive: true });
    const bucketCounts = new Map();

    try {
        for (const reference of references) {
            const bucket = String(reference?.bucket || '');
            if (!ALLOWED_BUCKETS.has(bucket)) throw new TypeError('Kategori referensi tidak valid.');
            const mimeType = String(reference?.mimeType || '');
            const format = ALLOWED[mimeType];
            if (!format) throw new TypeError('Hanya JPG, PNG, dan WEBP yang dapat disiapkan.');

            const bytes = toBuffer(reference.bytes);
            if (bytes.length < 1 || bytes.length > MAX_FILE_BYTES) {
                throw new TypeError('Setiap referensi harus berukuran maksimal 12 MB.');
            }
            if (!format.signature(bytes)) throw new TypeError('Isi file tidak sesuai dengan tipe gambar.');

            const number = (bucketCounts.get(bucket) || 0) + 1;
            bucketCounts.set(bucket, number);
            const filename = `${bucket}-${String(number).padStart(2, '0')}.${format.ext}`;
            await fs.writeFile(path.join(directory, filename), bytes, { flag: 'wx', mode: 0o600 });
        }
        return { directory, count: references.length };
    } catch (error) {
        await fs.rm(directory, { recursive: true, force: true });
        throw error;
    }
}

async function removeExpiredStagingDirectories(rootDirectory, maxAgeMs = 24 * 60 * 60 * 1000, now = Date.now()) {
    let entries;
    try { entries = await fs.readdir(rootDirectory, { withFileTypes: true }); }
    catch (error) {
        if (error?.code === 'ENOENT') return 0;
        throw error;
    }

    let removed = 0;
    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const target = path.join(rootDirectory, entry.name);
        const details = await fs.stat(target);
        if (now - details.mtimeMs <= maxAgeMs) continue;
        await fs.rm(target, { recursive: true, force: true });
        removed += 1;
    }
    return removed;
}

module.exports = { MAX_FILE_BYTES, stageReferences, removeExpiredStagingDirectories };
