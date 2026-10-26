/* =========================================================
   GEN-Z.AI
   PUTER.JS IMAGE PROVIDER (server side)
   ---------------------------------------------------------
   File:
   lib/social-publisher/puter.js

   Tanggung jawab:
   - memanggil driver `puter-image-generation` milik Puter
     dari Cloudflare Worker lewat `POST /drivers/call`
   - mengubah hasil (data-URI / URL / blob) menjadi bytes
   - melaporkan error Puter apa adanya dengan bahasa jujur

   Kontrak biaya (WAJIB disebut di pesan error):
   - model User-Pays: yang membayar adalah AKUN PUTER milik
     operator (secret PUTER_AUTH_TOKEN), bukan kredit GEN-Z.AI
   - jatah akun Puter habis -> `insufficient_funds` -> generate
     gagal TANPA gambar pengganti

   Tidak bertanggung jawab:
   - caption / kata-kata mutiara (tetap provider teks)
   - penyimpanan hasil (caller yang mengunggah)
   ========================================================= */

import { base64ToBytes, bytesToBase64 } from "./utils.js";

const PUTER_DRIVERS_CALL_URL = "https://api.puter.com/drivers/call";

/* Default mengikuti provider Gemini Puter: `input_images` (referensi
   karakter + outfit) dan `ratio` 9:16/16:9 didukung, kualitas bisa 1K. */
export const PUTER_DEFAULT_IMAGE_MODEL = "gemini-3.1-flash-image";

function envValue(env, name) {
    const processValue = typeof process !== "undefined" ? process.env?.[name] : "";
    return String(env?.[name] || processValue || "").trim();
}

export function puterAuthToken(env) {
    return envValue(env, "PUTER_AUTH_TOKEN");
}

export function puterImageModel(env) {
    return envValue(env, "PUTER_IMAGE_MODEL") || PUTER_DEFAULT_IMAGE_MODEL;
}

function bytesToDataUri(bytes, mimeType) {
    const mime = String(mimeType || "image/jpeg").toLowerCase();
    return `data:${mime};base64,${bytesToBase64(bytes)}`;
}

function detectImageMime(bytes) {
    if (bytes.length >= 8
        && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
        && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) {
        return "image/png";
    }
    if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
        return "image/jpeg";
    }
    if (bytes.length >= 12
        && String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF"
        && String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP") {
        return "image/webp";
    }
    return "";
}

/**
 * Baca dimensi asli PNG/JPEG/WebP dari header-nya. Mengembalikan null bila
 * tidak terbaca — dipakai untuk pelaporan jujur (bukan klaim ukuran rekaan).
 */
export function readImageSize(bytes) {
    const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
    if (detectImageMime(view) === "image/png" && view.length >= 24) {
        return {
            width: (view[16] << 24) | (view[17] << 16) | (view[18] << 8) | view[19],
            height: (view[20] << 24) | (view[21] << 16) | (view[22] << 8) | view[23]
        };
    }
    if (detectImageMime(view) === "image/jpeg") {
        let offset = 2;
        while (offset + 9 < view.length) {
            if (view[offset] !== 0xff) {
                offset += 1;
                continue;
            }
            const marker = view[offset + 1];
            /* SOF0..SOF15 kecuali DHT/JPG/DAC membawa dimensi. */
            if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
                return {
                    height: (view[offset + 5] << 8) | view[offset + 6],
                    width: (view[offset + 7] << 8) | view[offset + 8]
                };
            }
            if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
                offset += 2;
                continue;
            }
            const segmentLength = (view[offset + 2] << 8) | view[offset + 3];
            if (segmentLength < 2) return null;
            offset += 2 + segmentLength;
        }
        return null;
    }
    if (detectImageMime(view) === "image/webp" && view.length >= 30) {
        const chunk = String.fromCharCode(...view.subarray(12, 16));
        if (chunk === "VP8X") {
            return {
                width: 1 + ((view[24] << 16) | (view[23] << 8) | view[22]),
                height: 1 + ((view[27] << 16) | (view[26] << 8) | view[25])
            };
        }
        if (chunk === "VP8 ") {
            return {
                width: (view[26] | (view[27] << 8)) & 0x3fff,
                height: (view[28] | (view[29] << 8)) & 0x3fff
            };
        }
        return null;
    }
    return null;
}

/**
 * Error Puter selalu berbahasa Inggris dan seringkali hanya kode
 * (`insufficient_funds`, `token_auth_failed`, `bad_request`). Terjemahkan
 * penyebabnya menjadi tindakan yang jelas; jangan pernah mengubah artinya.
 */
function puterError({ code, message, status }) {
    const normalized = String(code || "").trim().toLowerCase();
    const providerMessage = String(message || "").slice(0, 500) || "tanpa pesan";
    const httpStatus = Number(status) || 0;
    if (normalized === "token_auth_failed" || httpStatus === 401) {
        const error = new Error(
            `Token Puter ditolak: ${providerMessage}. Token salah atau kedaluwarsa — buat token baru di puter.com/dashboard#account (Create token) lalu perbarui secret Worker PUTER_AUTH_TOKEN.`
        );
        error.status = 401;
        return error;
    }
    if (normalized === "insufficient_funds" || httpStatus === 402) {
        const error = new Error(
            `Jatah akun Puter habis (insufficient_funds): ${providerMessage}. Provider Puter memakai kuota/biaya AKUN PUTER ANDA sendiri (User-Pays), bukan kredit GEN-Z.AI — isi ulang atau upgrade di akun Puter, atau pilih provider gambar lain.`
        );
        error.status = 402;
        return error;
    }
    const error = new Error(
        `Puter image generation gagal${normalized ? ` (${normalized})` : ""}: ${providerMessage}`
    );
    error.status = httpStatus || 502;
    return error;
}

function looksLikeJsonPayload(bytes, contentType) {
    if (/json/i.test(contentType)) return true;
    if (!/text\/plain/i.test(contentType)) return false;
    for (const byte of bytes) {
        if (byte === 0x20 || byte === 0x09 || byte === 0x0a || byte === 0x0d) continue;
        return byte === 0x7b || byte === 0x5b;
    }
    return false;
}

async function fetchPuterImage(url) {
    const response = await fetch(url);
    if (!response.ok) {
        const error = new Error(`Gambar hasil Puter tidak dapat diunduh (HTTP ${response.status}).`);
        error.status = 502;
        throw error;
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.length) throw new Error("Gambar hasil Puter kosong.");
    return bytes;
}

/**
 * Hasil driver `puter-image-generation` bisa berupa:
 * - string data-URI / URL hosted
 * - objek `{ data, mime_type }` (base64)
 * - objek `{ url }` / `{ asset_url }` / `{ href }` / `{ src }`
 * - bytes biner langsung (Content-Type bukan JSON)
 * Semua dinormalkan ke `{ bytes, mimeType }`.
 */
async function puterResultToImage(result) {
    if (result instanceof Uint8Array || result instanceof ArrayBuffer) {
        const bytes = result instanceof Uint8Array ? result : new Uint8Array(result);
        const mimeType = detectImageMime(bytes);
        if (!mimeType) throw new Error("Puter mengembalikan biner yang bukan gambar (PNG/JPEG/WebP).");
        return { bytes, mimeType };
    }
    if (typeof result === "string" && result) {
        if (/^data:image\//i.test(result)) {
            const comma = result.indexOf(",");
            const header = result.slice(0, comma);
            const bytes = base64ToBytes(result.slice(comma + 1));
            const mimeType = detectImageMime(bytes) || (header.match(/data:([^;]+)/)?.[1] || "").toLowerCase();
            if (!mimeType) throw new Error("Puter mengembalikan data-URI yang bukan gambar.");
            return { bytes, mimeType };
        }
        if (/^https?:\/\//i.test(result)) {
            const bytes = await fetchPuterImage(result);
            return { bytes, mimeType: detectImageMime(bytes) || "image/png" };
        }
        throw new Error("Puter mengembalikan string yang bukan gambar.");
    }
    if (result && typeof result === "object") {
        const rawBase64 = result.data || result.base64 || result.image_base64;
        if (typeof rawBase64 === "string" && rawBase64) {
            const bytes = base64ToBytes(String(rawBase64).replace(/^data:[^,]*,/, ""));
            const mimeType = detectImageMime(bytes)
                || String(result.mime_type || result.mimeType || result.content_type || "").toLowerCase();
            if (!mimeType) throw new Error("Puter mengembalikan base64 tanpa jenis gambar yang dikenal.");
            return { bytes, mimeType };
        }
        for (const key of ["asset_url", "url", "href", "src"]) {
            const value = result[key];
            if (typeof value === "string" && value) return await puterResultToImage(value);
        }
    }
    throw new Error("Puter mengembalikan format gambar yang tidak dikenal.");
}

/**
 * Buat SATU gambar lewat Puter dari Cloudflare Worker.
 *
 * `referenceBytes` (foto karakter) dan `garmentBytes` (foto outfit) dikirim
 * sebagai `input_images` — model yang mendukung image-to-image memakainya
 * sebagai acuan wajah/pakaian. Tanpa keduanya (mode latar Kata-kata Mutiara)
 * gambar dibuat dari prompt saja.
 *
 * Mengembalikan `{ bytes, mimeType, model, width, height, images_sent,
 * elapsedMs }` atau melempar error dengan status HTTP yang jujur.
 */
export async function generatePuterSocialImage({
    env,
    prompt,
    referenceBytes,
    referenceMimeType,
    personImageUrl,
    garmentBytes,
    garmentMimeType,
    garmentImageUrls,
    aspectRatio = "9:16",
    imageModel
}) {
    const token = puterAuthToken(env);
    if (!token) {
        const error = new Error(
            "PUTER_AUTH_TOKEN belum dikonfigurasi. Buka puter.com/dashboard#account, klik \"Create token\", lalu simpan token sebagai secret Worker PUTER_AUTH_TOKEN. Catatan: setiap gambar memotong kuota/biaya akun Puter Anda sendiri (User-Pays), bukan kredit GEN-Z.AI."
        );
        error.status = 503;
        throw error;
    }
    const model = String(imageModel || "").trim() || puterImageModel(env);
    const ratio = String(aspectRatio) === "16:9" ? { w: 16, h: 9 } : { w: 9, h: 16 };
    const inputImages = [];
    if (referenceBytes?.byteLength) {
        inputImages.push(bytesToDataUri(referenceBytes, referenceMimeType || "image/jpeg"));
    } else if (typeof personImageUrl === "string" && personImageUrl) {
        inputImages.push(personImageUrl);
    }
    if (garmentBytes?.byteLength) {
        inputImages.push(bytesToDataUri(garmentBytes, garmentMimeType || "image/jpeg"));
    } else if (Array.isArray(garmentImageUrls)) {
        for (const url of garmentImageUrls) {
            if (typeof url === "string" && url) inputImages.push(url);
        }
    }

    const args = {
        prompt: String(prompt || "").trim(),
        model,
        ratio
    };
    if (inputImages.length) {
        args.input_images = inputImages;
    }
    /* Kualitas hanya untuk model gambar Gemini (default-nya '512' — terlalu
       kecil). Model lain punya skema kualitas sendiri; jangan dikirimi '1K'. */
    if (/^gemini/i.test(model)) {
        args.quality = "1K";
    }

    const startedAt = Date.now();
    const response = await fetch(PUTER_DRIVERS_CALL_URL, {
        method: "POST",
        headers: {
            "Content-Type": "text/plain;actually=json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
            interface: "puter-image-generation",
            driver: "ai-image",
            method: "generate",
            args,
            test_mode: false,
            auth_token: token
        })
    });
    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    const buffer = new Uint8Array(await response.arrayBuffer());

    let payload = null;
    if (looksLikeJsonPayload(buffer, contentType)) {
        try {
            payload = JSON.parse(new TextDecoder().decode(buffer));
        } catch {
            payload = null;
        }
    }
    if (payload && typeof payload === "object") {
        const driverError = payload.error && typeof payload.error === "object"
            ? payload.error
            : (payload.success === false || (payload.result === undefined && payload.code && payload.message)
                ? payload
                : null);
        if (driverError) {
            throw puterError({
                code: driverError.code ?? payload.code,
                message: driverError.message ?? payload.message,
                status: driverError.status ?? payload.status ?? response.status
            });
        }
        if (!response.ok) {
            throw puterError({ code: payload.code, message: payload.message, status: response.status });
        }
        const result = payload.result !== undefined ? payload.result : payload;
        const image = await puterResultToImage(result);
        return {
            ...image,
            model,
            width: readImageSize(image.bytes)?.width || 0,
            height: readImageSize(image.bytes)?.height || 0,
            images_sent: inputImages.length,
            elapsedMs: Date.now() - startedAt
        };
    }
    if (!response.ok) {
        throw puterError({
            code: "",
            message: `HTTP ${response.status} dari api.puter.com.`,
            status: response.status
        });
    }
    const image = await puterResultToImage(buffer);
    return {
        ...image,
        model,
        width: readImageSize(image.bytes)?.width || 0,
        height: readImageSize(image.bytes)?.height || 0,
        images_sent: inputImages.length,
        elapsedMs: Date.now() - startedAt
    };
}
