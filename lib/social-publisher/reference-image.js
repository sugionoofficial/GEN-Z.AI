/* ---------------------------------------------------------
   GEN-Z.AI
   CLOUDFLARE REFERENCE IMAGE PREPARATION
   ---------------------------------------------------------
   File: lib/social-publisher/reference-image.js

   Model FLUX.2 [klein] di Workers AI menerima foto referensi
   lewat multipart `input_image_0..3`, dan dokumentasi Cloudflare
   mensyaratkan setiap gambar input < 512x512. Foto karakter yang
   diunggah user bisa jauh lebih besar (sampai 8 MB, JPEG/PNG/WebP),
   jadi berkas diperkecil dulu di Worker sebelum dikirim ke model.
   --------------------------------------------------------- */

import jpeg from "jpeg-js";
import { PNG } from "pngjs";

const CLOUDFLARE_REFERENCE_MAX_SIDE = 512;
const CLOUDFLARE_REFERENCE_QUALITY = 88;
/*
 * Batas decode di Worker. Foto 4–12 MP butuh puluhan MB (RGBA + buffer
 * komponen) dan dua gambar sekaligus (referensi + outfit) pernah menembus
 * batas 128 MB sehingga request mati dengan "Error 1102: Worker exceeded
 * resource limits". Batas ini membuat kegagalan decode terjadi lebih awal dan
 * bisa dilaporkan, bukan mematikan isolate.
 */
const REFERENCE_DECODE_MAX_MEGAPIXELS = 24;
const REFERENCE_DECODE_MAX_MEMORY_MB = 64;

function startsWith(bytes, signature, offset = 0) {
    if (bytes.length < offset + signature.length) return false;
    for (let index = 0; index < signature.length; index += 1) {
        if (bytes[offset + index] !== signature[index]) return false;
    }
    return true;
}

export function detectImageKind(bytes) {
    if (!bytes || bytes.length < 12) return "";
    if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
    if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
    if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) {
        return "webp";
    }
    return "";
}

function readPngSize(bytes) {
    if (bytes.length < 24) return null;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return {
        width: view.getUint32(16),
        height: view.getUint32(20)
    };
}

function readJpegSize(bytes) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
        if (bytes[offset] !== 0xff) {
            offset += 1;
            continue;
        }
        const marker = bytes[offset + 1];
        if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
            offset += 2;
            continue;
        }
        const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
        const isStartOfFrame = marker >= 0xc0 && marker <= 0xcf
            && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
        if (isStartOfFrame) {
            return {
                height: (bytes[offset + 5] << 8) | bytes[offset + 6],
                width: (bytes[offset + 7] << 8) | bytes[offset + 8]
            };
        }
        if (length < 2) break;
        offset += 2 + length;
    }
    return null;
}

function readWebpSize(bytes) {
    if (bytes.length < 30) return null;
    const chunk = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
    if (chunk === "VP8X") {
        const width = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
        const height = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));
        return { width, height };
    }
    if (chunk === "VP8 ") {
        return {
            width: ((bytes[27] << 8) | bytes[26]) & 0x3fff,
            height: ((bytes[29] << 8) | bytes[28]) & 0x3fff
        };
    }
    if (chunk === "VP8L") {
        const bits = bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24);
        return {
            width: (bits & 0x3fff) + 1,
            height: ((bits >> 14) & 0x3fff) + 1
        };
    }
    return null;
}

export function readImageDimensions(bytes) {
    const kind = detectImageKind(bytes);
    if (kind === "jpeg") return readJpegSize(bytes);
    if (kind === "png") return readPngSize(bytes);
    if (kind === "webp") return readWebpSize(bytes);
    return null;
}

/**
 * Penskalaan box-filter sederhana (RGBA) tanpa Canvas, karena Worker tidak
 * menyediakan Canvas/ImageDecoder di semua runtime.
 */
export function downscaleRgba(image, maxSide) {
    const { width, height, data } = image;
    const scale = Math.min(1, maxSide / Math.max(width, height));
    if (scale >= 1) {
        return { width, height, data };
    }
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));
    const output = new Uint8Array(targetWidth * targetHeight * 4);
    const xRatio = width / targetWidth;
    const yRatio = height / targetHeight;

    for (let y = 0; y < targetHeight; y += 1) {
        const sourceYStart = Math.floor(y * yRatio);
        const sourceYEnd = Math.min(height, Math.max(sourceYStart + 1, Math.floor((y + 1) * yRatio)));
        for (let x = 0; x < targetWidth; x += 1) {
            const sourceXStart = Math.floor(x * xRatio);
            const sourceXEnd = Math.min(width, Math.max(sourceXStart + 1, Math.floor((x + 1) * xRatio)));
            let red = 0;
            let green = 0;
            let blue = 0;
            let alpha = 0;
            let count = 0;
            for (let sourceY = sourceYStart; sourceY < sourceYEnd; sourceY += 1) {
                for (let sourceX = sourceXStart; sourceX < sourceXEnd; sourceX += 1) {
                    const index = (sourceY * width + sourceX) * 4;
                    red += data[index];
                    green += data[index + 1];
                    blue += data[index + 2];
                    alpha += data[index + 3];
                    count += 1;
                }
            }
            const targetIndex = (y * targetWidth + x) * 4;
            output[targetIndex] = Math.round(red / count);
            output[targetIndex + 1] = Math.round(green / count);
            output[targetIndex + 2] = Math.round(blue / count);
            output[targetIndex + 3] = Math.round(alpha / count);
        }
    }
    return { width: targetWidth, height: targetHeight, data: output };
}

function encodeJpeg(image, quality = CLOUDFLARE_REFERENCE_QUALITY) {
    const encoded = jpeg.encode({ data: image.data, width: image.width, height: image.height }, quality);
    return new Uint8Array(encoded.data);
}

/**
 * Siapkan foto referensi untuk FLUX.2 klein.
 * - JPEG/PNG diperkecil ke maksimal 512 px sisi terpanjang lalu diubah ke JPEG.
 * - WebP (tidak bisa di-decode di Worker) atau berkas yang gagal di-decode
 *   dikembalikan apa adanya; model akan menolak bila terlalu besar, dan
 *   pemanggil dapat jatuh ke model lain.
 */
export function prepareReferenceImage(bytes, mimeType, { maxSide = CLOUDFLARE_REFERENCE_MAX_SIDE } = {}) {
    const kind = detectImageKind(bytes);
    const fallback = {
        bytes,
        mimeType: String(mimeType || (kind === "png" ? "image/png" : kind === "webp" ? "image/webp" : "image/jpeg")),
        ...(readImageDimensions(bytes) || {}),
        resized: false,
        note: ""
    };
    if (!bytes?.length || !kind) {
        return { ...fallback, mimeType: "image/jpeg", note: "Format foto referensi tidak dikenali." };
    }
    const size = readImageDimensions(bytes);
    if (size && size.width <= maxSide && size.height <= maxSide) {
        return fallback;
    }

    const megapixels = size ? (size.width * size.height) / 1_000_000 : 0;
    if (kind === "png" && megapixels > REFERENCE_DECODE_MAX_MEGAPIXELS) {
        return {
            ...fallback,
            note: `Foto PNG ${size.width}x${size.height} terlalu besar untuk diperkecil di Worker; unggah ulang sebagai JPEG atau foto yang lebih kecil.`
        };
    }

    try {
        const decoded = kind === "jpeg"
            ? jpeg.decode(bytes, {
                useTArray: true,
                formatAsRGBA: true,
                maxResolutionInMP: REFERENCE_DECODE_MAX_MEGAPIXELS,
                maxMemoryUsageInMB: REFERENCE_DECODE_MAX_MEMORY_MB
            })
            : kind === "png"
                ? PNG.sync.read(Buffer.from(bytes))
                : null;
        if (!decoded) {
            return {
                ...fallback,
                note: `Foto ${kind.toUpperCase()} berukuran ${size?.width || "?"}x${size?.height || "?"} tidak dapat diperkecil di Worker; FLUX.2 klein meminta input < ${maxSide}x${maxSide}.`
            };
        }
        const scaled = downscaleRgba(decoded, maxSide);
        return {
            bytes: encodeJpeg(scaled),
            mimeType: "image/jpeg",
            width: scaled.width,
            height: scaled.height,
            resized: true,
            note: ""
        };
    } catch (error) {
        return {
            ...fallback,
            note: `Foto referensi gagal diperkecil: ${String(error?.message || "kesalahan decode").slice(0, 160)}`
        };
    }
}

/**
 * Potong bagian wajah dari foto referensi supaya model punya acuan wajah yang
 * cukup besar.
 *
 * Foto karakter sering berupa foto badan penuh. Setelah diperkecil ke 512 px,
 * wajah di dalamnya hanya tersisa ~40 px sehingga model identitas kehilangan
 * detail dan menghasilkan orang yang berbeda. Potongan area atas-tengah
 * (perkiraan lokasi kepala pada foto berdiri) dipakai sebagai gambar acuan
 * tambahan dengan resolusi efektif jauh lebih besar.
 *
 * Foto yang sudah dekat (tidak terlalu jangkung) tidak dipotong karena wajahnya
 * sudah besar.
 */
export function cropFaceRegion(bytes, mimeType, { widthRatio = 0.62, heightRatio = 0.42, minAspect = 1.25 } = {}) {
    const kind = detectImageKind(bytes);
    const size = readImageDimensions(bytes);
    if (!kind || !size) return null;
    /* Hanya untuk foto "jangkung" yang berarti badan penuh. */
    if (size.height / size.width < minAspect) return null;
    if (size.width * size.height > REFERENCE_DECODE_MAX_MEGAPIXELS * 1_000_000) return null;

    let decoded;
    try {
        decoded = kind === "jpeg"
            ? jpeg.decode(bytes, {
                useTArray: true,
                formatAsRGBA: true,
                maxResolutionInMP: REFERENCE_DECODE_MAX_MEGAPIXELS,
                maxMemoryUsageInMB: REFERENCE_DECODE_MAX_MEMORY_MB
            })
            : kind === "png"
                ? PNG.sync.read(Buffer.from(bytes))
                : null;
    } catch {
        return null;
    }
    if (!decoded?.width || !decoded?.height) return null;

    const cropWidth = Math.max(1, Math.min(decoded.width, Math.round(decoded.width * widthRatio)));
    const cropHeight = Math.max(1, Math.min(decoded.height, Math.round(decoded.height * heightRatio)));
    const offsetX = Math.max(0, Math.round((decoded.width - cropWidth) / 2));
    const offsetY = 0;
    const output = new Uint8Array(cropWidth * cropHeight * 4);
    for (let y = 0; y < cropHeight; y += 1) {
        const sourceStart = ((offsetY + y) * decoded.width + offsetX) * 4;
        output.set(decoded.data.subarray(sourceStart, sourceStart + cropWidth * 4), y * cropWidth * 4);
    }

    const encoded = jpeg.encode({ data: output, width: cropWidth, height: cropHeight }, 92);
    return {
        bytes: new Uint8Array(encoded.data),
        mimeType: "image/jpeg",
        width: cropWidth,
        height: cropHeight
    };
}

export { CLOUDFLARE_REFERENCE_MAX_SIDE };

/**
 * Periksa apakah gambar hasil model benar-benar berisi sesuatu.
 *
 * Model beta di Workers AI kadang mengembalikan PNG/JPEG yang valid secara
 * format tetapi nyaris kosong (mis. 2 KB untuk 576x1024, praktis satu warna).
 * Tanpa pemeriksaan ini kondisi tersebut dilaporkan "OK" dan menghasilkan
 * gambar kosong di feed.
 *
 * Standar deviasi luminansi dipakai sebagai ukuran: foto/ilustrasi nyata punya
 * variasi jauh di atas 1,5 (skala 0-255), sedangkan gambar satu warna mendekati 0.
 */
const INSPECT_MAX_PIXELS = 12_000_000;
const INSPECT_SAMPLE_TARGET = 20_000;
/*
 * Gambar nyata berukuran 576x1024 memakai ratusan KB (>= 0,3 byte/piksel).
 * PNG/JPEG yang nyaris kosong hanya beberapa KB (< 0,05 byte/piksel). Karena
 * itu decode hanya dilakukan bila rasio byte/piksel mencurigakan, supaya jalur
 * normal tidak membuang CPU di Worker.
 */
const INSPECT_SUSPICIOUS_BYTES_PER_PIXEL = 0.08;

export function inspectImageContent(bytes) {
    const kind = detectImageKind(bytes);
    const size = readImageDimensions(bytes);
    if (!kind || !size) return null;
    const pixels = size.width * size.height;
    const bytesPerPixel = pixels ? Math.round((bytes.length / pixels) * 10000) / 10000 : 0;
    const base = { width: size.width, height: size.height, sampled: false, bytes_per_pixel: bytesPerPixel };
    if (!pixels || pixels > INSPECT_MAX_PIXELS) return base;
    if (bytesPerPixel >= INSPECT_SUSPICIOUS_BYTES_PER_PIXEL) return base;

    let decoded;
    try {
        if (kind === "png") {
            decoded = PNG.sync.read(Buffer.from(bytes));
        } else if (kind === "jpeg") {
            decoded = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true });
        } else {
            return base;
        }
    } catch {
        /* WebP atau berkas yang tidak bisa di-decode: cukup laporkan ukurannya. */
        return base;
    }

    const { width, height, data } = decoded;
    const total = width * height;
    if (!total) return base;
    const step = Math.max(1, Math.floor(total / INSPECT_SAMPLE_TARGET));
    let sum = 0;
    let sumSquares = 0;
    let count = 0;
    for (let index = 0; index < total; index += step) {
        const offset = index * 4;
        const luminance = 0.299 * data[offset] + 0.587 * data[offset + 1] + 0.114 * data[offset + 2];
        sum += luminance;
        sumSquares += luminance * luminance;
        count += 1;
    }
    const mean = sum / count;
    const variance = Math.max(0, sumSquares / count - mean * mean);
    return {
        width,
        height,
        sampled: true,
        mean: Math.round(mean),
        stddev: Math.round(Math.sqrt(variance) * 100) / 100,
        bytes_per_pixel: bytesPerPixel
    };
}

/** Ambang "gambar nyaris kosong". Foto nyata selalu jauh di atas nilai ini. */
export const BLANK_IMAGE_STDDEV = 1.5;

export function isBlankImage(quality) {
    return Boolean(quality?.sampled) && quality.stddev < BLANK_IMAGE_STDDEV;
}
