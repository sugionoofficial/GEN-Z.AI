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
 * Batas decode untuk potret wajah. Foto 4 MP (~16 MB RGBA) sudah jauh lebih
 * tajam untuk wajah, sementara decode lebih besar berisiko memicu Error 1102.
 * Foto di atas batas ini dipotong dari salinan 512 px (lebih kecil, tapi
 * tetap berfungsi) supaya pembuatan karakter tidak pernah gagal.
 */
const CROP_FACE_MAX_SOURCE_MEGAPIXELS = 4;
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

/* ---------------------------------------------------------
   PENCARIAN KEPALA (DETEKSI WARNA KULIT)
   ---------------------------------------------------------
   Potongan atas-tengah adalah tebakan buta: pada foto berdiri yang
   orangnya agak ke samping, atau foto duduk, hasil potongan bisa
   tidak memuat wajah sama sekali — model lalu meniru latar/dada dan
   menghasilkan orang lain.

   Di sini kepala dicari dulu memakai deteksi warna kulit sederhana
   pada grid kasar. Hasilnya kotak kepala yang mengikuti posisi orang,
   lalu dipotong dengan margin. Kalau tidak ada area kulit yang cukup
   (foto hitam-putih, backsound, dsb.), dipakai tebakan geometris
   seperti sebelumnya supaya perilaku lama tidak hilang.
--------------------------------------------------------- */

const SKIN_GRID_COLUMNS = 64;
const SKIN_MIN_RATIO = 0.10;

/*
 * Wajah orang yang berdiri jauh hanya menempati sebagian kecil jendela.
 * Ambang mutlak saja akan menolaknya, padahal justru foto seperti itu yang
 * paling perlu dipotong. Karena itu area diterima bila kepadatannya jelas
 * menonjol dibanding rata-rata foto.
 */
const SKIN_MIN_RATIO_WEAK = 0.03;
const SKIN_CONTRAST_FACTOR = 2.5;

function isSkinPixel(red, green, blue) {
    /* Aturan RGB. */
    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    const rgbMatch = red > 60
        && green > 30
        && blue > 15
        && max - min > 10
        && red >= green
        && red - green > 5
        && green - blue > -10;

    /* Aturan YCbCr: menangkap nada kulit yang lebih gelap/terang. */
    const cb = 128 - 0.168736 * red - 0.331264 * green + 0.5 * blue;
    const cr = 128 + 0.5 * red - 0.418688 * green - 0.081312 * blue;
    const yccMatch = cr >= 132 && cr <= 182 && cb >= 74 && cb <= 132;

    return rgbMatch || yccMatch;
}

/**
 * Mencari kotak kepala pada citra RGBA.
 *
 * @returns {null | {x,y,width,height,ratio}} kotak dalam piksel citra
 */
export function locateHeadBox(decoded) {
    const { width, height, data } = decoded;
    if (!width || !height || !data) return null;

    const columns = Math.min(SKIN_GRID_COLUMNS, width);
    const rows = Math.max(1, Math.min(160, Math.round(columns * (height / width))));
    const cellWidth = width / columns;
    const cellHeight = height / rows;

    const mask = new Uint8Array(columns * rows);
    let skinTotal = 0;

    for (let row = 0; row < rows; row += 1) {
        const sourceY = Math.min(height - 1, Math.floor((row + 0.5) * cellHeight));
        for (let column = 0; column < columns; column += 1) {
            const sourceX = Math.min(width - 1, Math.floor((column + 0.5) * cellWidth));
            const index = (sourceY * width + sourceX) * 4;
            const alpha = data[index + 3];
            if (alpha < 32) continue;
            if (isSkinPixel(data[index], data[index + 1], data[index + 2])) {
                mask[row * columns + column] = 1;
                skinTotal += 1;
            }
        }
    }

    /* Foto tanpa area kulit yang memadai: jangan menebak. */
    if (skinTotal === 0) return null;

    /* Integral image agar penjumlahan jendela O(1). */
    const integral = new Uint32Array((columns + 1) * (rows + 1));
    for (let row = 1; row <= rows; row += 1) {
        let rowSum = 0;
        for (let column = 1; column <= columns; column += 1) {
            rowSum += mask[(row - 1) * columns + (column - 1)];
            integral[row * (columns + 1) + column] = integral[(row - 1) * (columns + 1) + column] + rowSum;
        }
    }

    const sumBox = (left, top, boxWidth, boxHeight) => {
        const x1 = left;
        const y1 = top;
        const x2 = left + boxWidth;
        const y2 = top + boxHeight;
        return integral[y2 * (columns + 1) + x2]
            - integral[y1 * (columns + 1) + x2]
            - integral[y2 * (columns + 1) + x1]
            + integral[y1 * (columns + 1) + x1];
    };

    /*
     * Kepala kira-kira menempati seperempat lebar foto. Jendela yang
     * dipindai sedikit lebih longgar supaya wajah tidak terpotong.
     */
    const windowColumns = Math.max(4, Math.round(columns * 0.30));
    const windowRows = Math.max(4, Math.round(rows * 0.24));
    const maxTop = Math.max(0, Math.round(rows * 0.62) - windowRows);

    let best = null;
    for (let top = 0; top <= maxTop; top += 1) {
        for (let left = 0; left + windowColumns <= columns; left += 1) {
            const count = sumBox(left, top, windowColumns, windowRows);
            if (count <= 0) continue;
            const ratio = count / (windowColumns * windowRows);
            if (!best || ratio > best.ratio + 1e-6) {
                best = { left, top, ratio };
            }
        }
    }

    if (!best) return null;

    const globalRatio = skinTotal / (columns * rows);
    const acceptsByContrast = best.ratio >= SKIN_MIN_RATIO_WEAK
        && best.ratio >= globalRatio * SKIN_CONTRAST_FACTOR;

    if (best.ratio < SKIN_MIN_RATIO && !acceptsByContrast) return null;

    /* Rapatkan kotak ke sebaran kulit di dalam jendela terbaik. */
    let minColumn = columns;
    let maxColumn = 0;
    let minRow = rows;
    let maxRow = 0;
    for (let row = best.top; row < best.top + windowRows; row += 1) {
        for (let column = best.left; column < best.left + windowColumns; column += 1) {
            if (!mask[row * columns + column]) continue;
            if (column < minColumn) minColumn = column;
            if (column > maxColumn) maxColumn = column;
            if (row < minRow) minRow = row;
            if (row > maxRow) maxRow = row;
        }
    }
    if (maxColumn < minColumn || maxRow < minRow) return null;

    const boxLeft = minColumn * cellWidth;
    const boxTop = minRow * cellHeight;
    const boxWidth = (maxColumn + 1) * cellWidth - boxLeft;
    const boxHeight = (maxRow + 1) * cellHeight - boxTop;

    /*
     * Margin: potret kepala–bahu, bukan potongan rapat. Terlalu rapat
     * membuat model kehilangan bentuk rahang/alis; terlalu longgar
     * mengembalikan masalah awal (wajah kecil).
     */
    const marginScale = 1.55;
    let cropWidth = Math.min(width, Math.round(boxWidth * marginScale));
    let cropHeight = Math.min(height, Math.round(boxHeight * marginScale));

    /* Jaga rasio potret mendekati 0,8–1,25 supaya wajah tidak melar. */
    const aspect = cropWidth / Math.max(1, cropHeight);
    if (aspect > 1.25) {
        cropHeight = Math.min(height, Math.round(cropWidth / 1.25));
    } else if (aspect < 0.8) {
        cropWidth = Math.min(width, Math.round(cropHeight * 0.8));
    }

    const centerX = boxLeft + boxWidth / 2;
    const centerY = boxTop + boxHeight / 2;
    const offsetX = Math.max(0, Math.min(width - cropWidth, Math.round(centerX - cropWidth / 2)));
    const offsetY = Math.max(0, Math.min(height - cropHeight, Math.round(centerY - cropHeight / 2 - cropHeight * 0.06)));

    return {
        x: offsetX,
        y: offsetY,
        width: cropWidth,
        height: cropHeight,
        /* Lebar kepala sebelum margin: dipakai untuk menilai kualitas acuan. */
        headWidth: boxWidth,
        ratio: skinTotal / (columns * rows)
    };
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
export function cropFaceRegion(bytes, mimeType, {
    widthRatio = 0.62,
    heightRatio = 0.42,
    minAspect = 1.25,
    /*
     * Bila diisi, hasil potongan diperkecil ke maksimal `maxSide` px. Dipakai
     * agar potret wajah bisa diambil dari FOTO ASLI (resolusi penuh) lalu
     * diperkecil sendiri, bukan dipotong dari salinan 512 px.
     */
    maxSide = 0,
    maxSourceMegapixels = CROP_FACE_MAX_SOURCE_MEGAPIXELS
} = {}) {
    const kind = detectImageKind(bytes);
    const size = readImageDimensions(bytes);
    if (!kind || !size) return null;
    /* Hanya untuk foto "jangkung" yang berarti badan penuh. */
    const tall = size.height / size.width >= minAspect;
    if (size.width * size.height > REFERENCE_DECODE_MAX_MEGAPIXELS * 1_000_000) return null;
    /* Sumber raksasa dilewati supaya decode tidak memicu batas memori Worker. */
    if (size.width * size.height > maxSourceMegapixels * 1_000_000) return null;

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

    /*
     * Utamakan kotak kepala hasil deteksi warna kulit. Ini yang membuat
     * potret tetap kena pada orang yang posisinya tidak di tengah, foto
     * duduk, atau foto yang tidak terlalu jangkung.
     */
    const located = locateHeadBox(decoded);

    /*
     * Potong hanya bila memang perlu.
     *
     * Foto yang sudah dekat (kepala menempati >= 35% lebar foto) tidak
     * dipotong: wajahnya sudah besar di dalam acuan, dan memotong lagi
     * justru berisiko memenggal dagu/alis. Foto persegi dengan subjek
     * kecil (mis. orang duduk) tetap dipotong.
     */
    const headCoverage = located ? located.width / decoded.width : 0;
    const headAlreadyLarge = headCoverage >= 0.35;

    if (headAlreadyLarge && !tall) return null;

    if (!located && !tall) return null;

    const cropWidth = located
        ? located.width
        : Math.max(1, Math.min(decoded.width, Math.round(decoded.width * widthRatio)));
    const cropHeight = located
        ? located.height
        : Math.max(1, Math.min(decoded.height, Math.round(decoded.height * heightRatio)));
    const offsetX = located
        ? located.x
        : Math.max(0, Math.round((decoded.width - cropWidth) / 2));
    const offsetY = located
        ? located.y
        : 0;
    const output = new Uint8Array(cropWidth * cropHeight * 4);
    for (let y = 0; y < cropHeight; y += 1) {
        const sourceStart = ((offsetY + y) * decoded.width + offsetX) * 4;
        output.set(decoded.data.subarray(sourceStart, sourceStart + cropWidth * 4), y * cropWidth * 4);
    }

    let finalWidth = cropWidth;
    let finalHeight = cropHeight;
    let finalData = output;
    if (maxSide > 0 && (cropWidth > maxSide || cropHeight > maxSide)) {
        const scaled = downscaleRgba({ data: output, width: cropWidth, height: cropHeight }, maxSide);
        finalData = scaled.data;
        finalWidth = scaled.width;
        finalHeight = scaled.height;
    }
    const encoded = jpeg.encode({ data: finalData, width: finalWidth, height: finalHeight }, 92);
    /*
     * Perkiraan lebar wajah di dalam potret final. Dipakai pemanggil untuk
     * memberi tahu user bila foto referensinya terlalu jauh: wajah 60 px tidak
     * bisa menghasilkan kemiripan, sebesar apa pun resolusi keluarannya.
     */
    const scale = cropWidth > 0 ? finalWidth / cropWidth : 1;
    const headWidth = located
        ? Math.max(1, Math.round(located.headWidth * scale))
        : Math.max(1, Math.round(finalWidth * 0.55));

    return {
        bytes: new Uint8Array(encoded.data),
        mimeType: "image/jpeg",
        width: finalWidth,
        height: finalHeight,
        method: located ? "skin" : "geometry",
        headWidth,
        skinRatio: located ? Number(located.ratio.toFixed(3)) : 0,
        box: located
            ? {
                x: located.x,
                y: located.y,
                width: located.width,
                height: located.height
            }
            : null,
        source: {
            width: size.width,
            height: size.height
        }
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
