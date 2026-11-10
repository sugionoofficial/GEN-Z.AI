'use strict';

const IMAGE_MODELS = new Set(['nano-banana-2.1', 'nano-banana-pro', 'nano-banana-2-lite']);
const VIDEO_MODELS = new Set([
    'Veo 3.1 Lite',
    'Veo 3.1 Fast',
    'Veo 3.1 Quality',
    'Omni 1.2 Flash',
    'Omni 1.1 Flash'
]);
const IMAGE_RATIOS = new Set(['9:16', '16:9', '1:1', '4:3', '3:4']);
const VIDEO_RATIOS = new Set(['9:16', '16:9']);

function validateTask(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        throw new TypeError('Task harus berupa objek.');
    }

    const mediaType = input.mediaType;
    if (mediaType !== 'image' && mediaType !== 'video') {
        throw new TypeError('Jenis task tidak valid.');
    }

    const prompt = String(input.prompt || '').trim();
    if (!prompt || prompt.length > 5000) {
        throw new TypeError('Prompt wajib diisi dan maksimal 5.000 karakter.');
    }

    const model = String(input.model || '');
    const allowedModels = mediaType === 'image' ? IMAGE_MODELS : VIDEO_MODELS;
    if (!allowedModels.has(model)) throw new TypeError('Model tidak didukung.');

    const ratio = String(input.ratio || '');
    const allowedRatios = mediaType === 'image' ? IMAGE_RATIOS : VIDEO_RATIOS;
    if (!allowedRatios.has(ratio)) throw new TypeError('Rasio tidak didukung.');

    const outputCount = Number(input.outputCount);
    if (!Number.isInteger(outputCount) || outputCount < 1 || outputCount > 4) {
        throw new TypeError('Jumlah output harus antara 1 dan 4.');
    }

    const referenceCount = Number(input.referenceCount || 0);
    if (!Number.isInteger(referenceCount) || referenceCount < 0 || referenceCount > 8) {
        throw new TypeError('Jumlah referensi tidak valid.');
    }

    const result = {
        mediaType,
        prompt,
        model,
        ratio,
        outputCount,
        referenceCount
    };

    if (mediaType === 'video') {
        const duration = Number(input.duration);
        if (![8, 10].includes(duration)) throw new TypeError('Durasi video tidak didukung.');
        const inputMode = input.inputMode;
        if (!['ingredients', 'frames'].includes(inputMode)) throw new TypeError('Mode video tidak didukung.');
        result.duration = duration;
        result.inputMode = inputMode;
    }

    return Object.freeze(result);
}

module.exports = { validateTask };
