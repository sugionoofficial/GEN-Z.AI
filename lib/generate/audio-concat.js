/* =========================================================
   GEN-Z.AI
   PURE-JS MP3 & WAV SPLICER FOR PODCAST DIALOG
   ---------------------------------------------------------
   File:
     lib/generate/audio-concat.js

   100% kompatibel Cloudflare Workers & Node.js (tanpa FFmpeg / node:*).
   Menggabungkan beberapa rekaman giliran dialog TTS (MP3 atau WAV)
   menjadi 1 file audio utuh lengkap dengan jeda hening natural
   antar pembicara, serta menghapus header ID3v2 / ID3v1 / Xing / Info / VBRI
   agar durasi total terbaca akurat di semua pemutar browser.
========================================================= */

const MPEG_VERSIONS = [2.5, 0, 2, 1];

const BITRATES_MPEG1_L3_KBPS = [
    0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0
];
const BITRATES_MPEG2_L3_KBPS = [
    0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0
];

const SAMPLE_RATES_BY_VER = {
    1: [44100, 48000, 32000, 0],
    2: [22050, 24000, 16000, 0],
    2.5: [11025, 12000, 8000, 0]
};

function toUint8(input) {
    if (input instanceof Uint8Array) return input;
    if (input instanceof ArrayBuffer) return new Uint8Array(input);
    if (ArrayBuffer.isView(input)) {
        return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    }
    throw new TypeError("Input audio buffer tidak valid.");
}

function readAscii(bytes, offset, length) {
    if (offset < 0 || offset + length > bytes.length) return "";
    let out = "";
    for (let i = 0; i < length; i += 1) {
        out += String.fromCharCode(bytes[offset + i]);
    }
    return out;
}

export function detectAudioContainer(inputBytes) {
    const bytes = toUint8(inputBytes);
    if (bytes.length >= 12 && readAscii(bytes, 0, 4) === "RIFF" && readAscii(bytes, 8, 4) === "WAVE") {
        return "wav";
    }
    if (bytes.length >= 3 && readAscii(bytes, 0, 3) === "ID3") {
        return "mp3";
    }
    for (let i = 0; i < Math.min(bytes.length - 4, 4096); i += 1) {
        if (parseMp3FrameHeader(bytes, i)) {
            return "mp3";
        }
    }
    return "unknown";
}

function parseMp3FrameHeader(bytes, offset) {
    if (offset + 4 > bytes.length) return null;
    const b0 = bytes[offset];
    const b1 = bytes[offset + 1];
    const b2 = bytes[offset + 2];
    const b3 = bytes[offset + 3];

    if (b0 !== 0xff || (b1 & 0xe0) !== 0xe0) return null;

    const versionBits = (b1 >> 3) & 0x03;
    const layerBits = (b1 >> 1) & 0x03;
    /* Hanya dukung Layer III (`layerBits === 1`) */
    if (versionBits === 1 || layerBits !== 1) return null;

    const version = MPEG_VERSIONS[versionBits];
    const bitrateIdx = (b2 >> 4) & 0x0f;
    const sampleRateIdx = (b2 >> 2) & 0x03;
    const padding = (b2 >> 1) & 0x01;
    const channelMode = (b3 >> 6) & 0x03;

    if (bitrateIdx === 0 || bitrateIdx === 15 || sampleRateIdx === 3) return null;

    const bitrateKbps =
        version === 1
            ? BITRATES_MPEG1_L3_KBPS[bitrateIdx]
            : BITRATES_MPEG2_L3_KBPS[bitrateIdx];
    const sampleRate = SAMPLE_RATES_BY_VER[version]?.[sampleRateIdx] || 0;
    if (!bitrateKbps || !sampleRate) return null;

    const samplesPerFrame = version === 1 ? 1152 : 576;
    const coeff = version === 1 ? 144000 : 72000;
    const frameLength = Math.floor((coeff * bitrateKbps) / sampleRate) + padding;
    if (frameLength < 24) return null;

    return {
        version,
        versionBits,
        bitrateIdx,
        bitrateKbps,
        sampleRateIdx,
        sampleRate,
        padding,
        channelMode,
        samplesPerFrame,
        frameLength,
        headerBytes: [b0, b1, b2 & 0xfd, b3]
    };
}

function isVbrHeaderFrame(bytes, frameOffset, frameLength) {
    const end = Math.min(bytes.length, frameOffset + frameLength);
    for (let pos = frameOffset + 4; pos + 4 <= end && pos <= frameOffset + 64; pos += 1) {
        const tag = readAscii(bytes, pos, 4);
        if (tag === "Xing" || tag === "Info" || tag === "VBRI") {
            return true;
        }
    }
    return false;
}

function stripMp3MetadataAndExtractFrames(rawBytes) {
    const bytes = toUint8(rawBytes);
    let start = 0;
    let end = bytes.length;

    /* Lewati semua header ID3v2 di awal */
    while (start + 10 <= end && readAscii(bytes, start, 3) === "ID3") {
        const flags = bytes[start + 5];
        const tagSize =
            ((bytes[start + 6] & 0x7f) << 21) |
            ((bytes[start + 7] & 0x7f) << 14) |
            ((bytes[start + 8] & 0x7f) << 7) |
            (bytes[start + 9] & 0x7f);
        const footerSize = (flags & 0x10) !== 0 ? 10 : 0;
        start += 10 + tagSize + footerSize;
    }

    /* Hapus tag ID3v1 di akhir (128 byte terakhir bertanda "TAG") */
    if (end - start >= 128 && readAscii(bytes, end - 128, 3) === "TAG") {
        end -= 128;
    }

    const cleanChunks = [];
    let firstValidHeader = null;
    let cursor = start;
    let checkedFirstFrameForXing = false;

    while (cursor + 4 <= end) {
        const hdr = parseMp3FrameHeader(bytes, cursor);
        if (!hdr || cursor + hdr.frameLength > end) {
            cursor += 1;
            continue;
        }

        if (!checkedFirstFrameForXing) {
            checkedFirstFrameForXing = true;
            if (isVbrHeaderFrame(bytes, cursor, hdr.frameLength)) {
                cursor += hdr.frameLength;
                continue;
            }
        }

        if (!firstValidHeader) {
            firstValidHeader = hdr;
        }

        cleanChunks.push(bytes.subarray(cursor, cursor + hdr.frameLength));
        cursor += hdr.frameLength;
    }

    /* Fallback bila stream MP3 non-standar tanpa frame terdeteksi penuh */
    if (cleanChunks.length === 0 && end > start) {
        cleanChunks.push(bytes.subarray(start, end));
    }

    return {
        chunks: cleanChunks,
        firstHeader: firstValidHeader
    };
}

function buildSilentMp3Frames(referenceHeader, pauseMs = 320) {
    if (!referenceHeader || !(pauseMs > 0)) return [];

    const version = referenceHeader.version || 1;
    const versionBits = referenceHeader.versionBits ?? 3;
    const sampleRateIdx = referenceHeader.sampleRateIdx ?? 0;
    const sampleRate = referenceHeader.sampleRate || 44100;
    const channelMode = referenceHeader.channelMode ?? 3;
    const samplesPerFrame = version === 1 ? 1152 : 576;

    /* Gunakan bitrate standar stabil (128kbps MPEG1 / 64kbps MPEG2) tanpa padding untuk frame hening */
    const silentBitrateIdx = version === 1 ? 9 : 8;
    const silentBitrateKbps = version === 1 ? 128 : 64;
    const coeff = version === 1 ? 144000 : 72000;
    const frameLength = Math.floor((coeff * silentBitrateKbps) / sampleRate);
    if (frameLength < 24) return [];

    const frameDurationMs = (samplesPerFrame / sampleRate) * 1000;
    const frameCount = Math.max(1, Math.round(pauseMs / frameDurationMs));

    const singleSilentFrame = new Uint8Array(frameLength);
    singleSilentFrame[0] = 0xff;
    /* Protection bit = 1 (tanpa CRC), Layer III = 01 */
    singleSilentFrame[1] = 0xe0 | ((versionBits & 0x03) << 3) | (0x01 << 1) | 0x01;
    singleSilentFrame[2] = ((silentBitrateIdx & 0x0f) << 4) | ((sampleRateIdx & 0x03) << 2);
    singleSilentFrame[3] = (channelMode & 0x03) << 6;
    /* Seluruh byte side-info & main-data = 0x00 -> didekode sebagai digital silence murni */

    const frames = [];
    for (let i = 0; i < frameCount; i += 1) {
        frames.push(singleSilentFrame);
    }
    return frames;
}

export function concatMp3Buffers(inputBuffers, options = {}) {
    const pauseMs = Number.isFinite(Number(options.pauseMs)) ? Math.max(0, Number(options.pauseMs)) : 320;
    const parsedClips = inputBuffers.map(stripMp3MetadataAndExtractFrames);
    const referenceHeader = parsedClips.find(item => item.firstHeader)?.firstHeader || null;
    const silenceFrames = buildSilentMp3Frames(referenceHeader, pauseMs);

    const allPieces = [];
    let totalBytes = 0;

    for (let clipIdx = 0; clipIdx < parsedClips.length; clipIdx += 1) {
        const clip = parsedClips[clipIdx];
        for (const piece of clip.chunks) {
            allPieces.push(piece);
            totalBytes += piece.byteLength;
        }
        if (clipIdx + 1 < parsedClips.length && silenceFrames.length > 0) {
            for (const sFrame of silenceFrames) {
                allPieces.push(sFrame);
                totalBytes += sFrame.byteLength;
            }
        }
    }

    const merged = new Uint8Array(totalBytes);
    let offset = 0;
    for (const piece of allPieces) {
        merged.set(piece, offset);
        offset += piece.byteLength;
    }
    return merged;
}

function parseWavClip(rawBytes) {
    const bytes = toUint8(rawBytes);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (bytes.length < 44 || readAscii(bytes, 0, 4) !== "RIFF" || readAscii(bytes, 8, 4) !== "WAVE") {
        throw new Error("File WAV tidak memiliki header RIFF/WAVE yang valid.");
    }

    let fmt = null;
    let pcmData = null;
    let cursor = 12;

    while (cursor + 8 <= bytes.length) {
        const chunkId = readAscii(bytes, cursor, 4);
        const chunkSize = view.getUint32(cursor + 4, true);
        const dataStart = cursor + 8;
        const clampedEnd = Math.min(bytes.length, dataStart + chunkSize);

        if (chunkId === "fmt " && clampedEnd - dataStart >= 16) {
            fmt = {
                audioFormat: view.getUint16(dataStart, true),
                numChannels: view.getUint16(dataStart + 2, true),
                sampleRate: view.getUint32(dataStart + 4, true),
                byteRate: view.getUint32(dataStart + 8, true),
                blockAlign: view.getUint16(dataStart + 12, true),
                bitsPerSample: view.getUint16(dataStart + 14, true)
            };
        } else if (chunkId === "data") {
            pcmData = bytes.subarray(dataStart, clampedEnd);
            break;
        }

        cursor = dataStart + chunkSize + (chunkSize % 2);
    }

    if (!fmt || !pcmData) {
        throw new Error("Chunk fmt atau data pada WAV tidak ditemukan.");
    }

    return { fmt, pcmData };
}

export function concatWavBuffers(inputBuffers, options = {}) {
    const pauseMs = Number.isFinite(Number(options.pauseMs)) ? Math.max(0, Number(options.pauseMs)) : 320;
    const clips = inputBuffers.map(parseWavClip);
    const baseFmt = clips[0].fmt;

    const silenceSamples = Math.max(0, Math.round((baseFmt.sampleRate * pauseMs) / 1000));
    const silenceByteLen = silenceSamples * baseFmt.blockAlign;
    const silenceBlock = new Uint8Array(silenceByteLen);
    if (baseFmt.bitsPerSample === 8) {
        silenceBlock.fill(128);
    }

    let totalDataLen = 0;
    for (let i = 0; i < clips.length; i += 1) {
        totalDataLen += clips[i].pcmData.byteLength;
        if (i + 1 < clips.length) {
            totalDataLen += silenceBlock.byteLength;
        }
    }

    const out = new Uint8Array(44 + totalDataLen);
    const outView = new DataView(out.buffer);
    const writeFourCC = (pos, str) => {
        for (let i = 0; i < 4; i += 1) out[pos + i] = str.charCodeAt(i);
    };

    writeFourCC(0, "RIFF");
    outView.setUint32(4, 36 + totalDataLen, true);
    writeFourCC(8, "WAVE");
    writeFourCC(12, "fmt ");
    outView.setUint32(16, 16, true);
    outView.setUint16(20, baseFmt.audioFormat, true);
    outView.setUint16(22, baseFmt.numChannels, true);
    outView.setUint32(24, baseFmt.sampleRate, true);
    outView.setUint32(28, baseFmt.byteRate, true);
    outView.setUint16(32, baseFmt.blockAlign, true);
    outView.setUint16(34, baseFmt.bitsPerSample, true);
    writeFourCC(36, "data");
    outView.setUint32(40, totalDataLen, true);

    let offset = 44;
    for (let i = 0; i < clips.length; i += 1) {
        out.set(clips[i].pcmData, offset);
        offset += clips[i].pcmData.byteLength;
        if (i + 1 < clips.length && silenceBlock.byteLength > 0) {
            out.set(silenceBlock, offset);
            offset += silenceBlock.byteLength;
        }
    }

    return out;
}

/**
 * Menggabungkan array buffer audio (MP3 atau WAV) secara otomatis.
 */
export function concatAudioClips(inputBuffers, options = {}) {
    if (!Array.isArray(inputBuffers) || inputBuffers.length === 0) {
        throw new Error("Tidak ada klip audio untuk digabungkan.");
    }
    const byteArrays = inputBuffers.map(toUint8);
    if (byteArrays.length === 1) {
        const kind = detectAudioContainer(byteArrays[0]);
        return {
            bytes: byteArrays[0],
            mimeType: kind === "wav" ? "audio/wav" : "audio/mpeg",
            ext: kind === "wav" ? "wav" : "mp3"
        };
    }

    const firstKind = detectAudioContainer(byteArrays[0]);
    if (firstKind === "wav" && byteArrays.every(b => detectAudioContainer(b) === "wav")) {
        return {
            bytes: concatWavBuffers(byteArrays, options),
            mimeType: "audio/wav",
            ext: "wav"
        };
    }

    return {
        bytes: concatMp3Buffers(byteArrays, options),
        mimeType: "audio/mpeg",
        ext: "mp3"
    };
}
