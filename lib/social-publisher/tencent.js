/* ---------------------------------------------------------
   GEN-Z.AI
   TENCENT CLOUD HY IMAGE PROVIDER
   ---------------------------------------------------------
   File: lib/social-publisher/tencent.js

   Hy-Image-3.0 (`hy-image-v3`) lewat TokenHub internasional:
   POST /v1/wand/hunyuan-image/v3-generation dengan Bearer API key.
   Menerima 0–3 gambar referensi (URL atau base64) dan mengembalikan URL
   gambar sementara (12 jam). Karena menerima gambar referensi, wajah karakter
   tetap menjadi acuan — bukan text-to-image murni.

   Catatan batas API: lebar & tinggi masing-masing [512, 2048] dan
   luas maksimum 1.048.576 piksel (1024×1024). Jadi 9:16 dipetakan ke
   576×1024 dan 16:9 ke 1024×576.
   --------------------------------------------------------- */

import { inspectImageContent, isBlankImage } from "./reference-image.js";

const TENCENT_IMAGE_ENDPOINT = "https://tokenhub-intl.tencentcloudmaas.com/v1/wand/hunyuan-image/v3-generation";
const TENCENT_IMAGE_MODEL = "hy-image-v3";
const TENCENT_MAX_REFERENCE_IMAGES = 3;

function envText(env, key) {
    const processValue = typeof process !== "undefined" ? process.env?.[key] : "";
    return String(env?.[key] || processValue || "").trim();
}

export function tencentImageSizeForRatio(ratio) {
    return ratio === "16:9"
        ? { width: 1024, height: 576 }
        : { width: 576, height: 1024 };
}

function toDataUrl(bytes, mimeType) {
    let binary = "";
    for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
    return `data:${mimeType || "image/jpeg"};base64,${btoa(binary)}`;
}

function describeTencentError(status, message, requestId) {
    const detail = String(message || "").slice(0, 400);
    const hint = status === 401
        ? " Periksa TENCENT_TOKENHUB_KEY: nilainya harus API key TokenHub (bukan SecretId/SecretKey), dikirim sebagai Bearer."
        : status === 422
            ? " Permintaan diblokir moderasi konten Tencent; ubah prompt atau foto referensinya."
            : status === 429
                ? " Batas konkurensi TokenHub tercapai; coba lagi beberapa saat lagi."
                : status === 400
                    ? " Format permintaan ditolak (cek ukuran/rasio dan panjang prompt)."
                    : status >= 500
                        ? " Server Tencent sedang bermasalah; coba lagi."
                        : "";
    const id = requestId ? ` (request_id: ${requestId})` : "";
    return `Tencent Hy Image gagal (HTTP ${status})${detail ? `: ${detail}` : "."}${hint}${id}`;
}

/**
 * Buat gambar karakter memakai Tencent Hy Image.
 * @returns {Promise<{bytes: Uint8Array, mimeType: string, model: string, elapsedMs: number, images_sent: number}>}
 */
export async function generateTencentSocialImage({
    env,
    prompt,
    referenceBytes,
    referenceMimeType,
    garmentBytes,
    garmentMimeType,
    aspectRatio = "9:16",
    model
}) {
    const apiKey = envText(env, "TENCENT_TOKENHUB_KEY") || envText(env, "TENCENT_API_KEY");
    if (!apiKey) {
        const error = new Error(
            "TENCENT_TOKENHUB_KEY belum dikonfigurasi. Buat API key di console TokenHub Tencent Cloud, "
            + "lalu simpan sebagai secret Worker: npx wrangler@4 secret put TENCENT_TOKENHUB_KEY"
        );
        error.status = 503;
        throw error;
    }
    if (!referenceBytes?.byteLength) {
        const error = new Error("Foto referensi karakter wajib ada agar wajah konsisten.");
        error.status = 400;
        throw error;
    }

    const ratio = ["9:16", "16:9"].includes(aspectRatio) ? aspectRatio : "9:16";
    const { width, height } = tencentImageSizeForRatio(ratio);
    const endpoint = envText(env, "TENCENT_IMAGE_ENDPOINT") || TENCENT_IMAGE_ENDPOINT;
    const selectedModel = String(model || envText(env, "TENCENT_IMAGE_MODEL") || TENCENT_IMAGE_MODEL).trim();

    const images = [toDataUrl(referenceBytes, referenceMimeType)];
    if (garmentBytes?.byteLength) images.push(toDataUrl(garmentBytes, garmentMimeType));

    const startedAt = Date.now();
    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: selectedModel,
            prompt: String(prompt || "").slice(0, 8000),
            images: images.slice(0, TENCENT_MAX_REFERENCE_IMAGES),
            size: `${width}x${height}`,
            revise: false
        })
    });

    const text = await response.text();
    let data = {};
    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        data = {};
    }
    const requestId = String(data?.request_id || response.headers.get("x-request-id") || "");
    if (!response.ok) {
        const message = data?.error?.message || data?.message || text.slice(0, 200);
        const error = new Error(describeTencentError(response.status, message, requestId));
        error.status = response.status;
        throw error;
    }

    const url = String(data?.data?.[0]?.url || "").trim();
    if (!url) {
        const error = new Error(
            `Tencent tidak mengembalikan URL gambar${requestId ? ` (request_id: ${requestId})` : ""}.`
        );
        error.status = 502;
        throw error;
    }

    /* URL hasil bersifat sementara dan bisa menolak akses anonim; coba tanpa
       header dulu, lalu ulangi dengan Bearer bila ditolak. */
    let imageResponse = await fetch(url);
    if (imageResponse.status === 401 || imageResponse.status === 403) {
        imageResponse = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
    }
    if (!imageResponse.ok) {
        const error = new Error(`Gagal mengunduh gambar hasil Tencent (HTTP ${imageResponse.status}).`);
        error.status = 502;
        throw error;
    }
    const bytes = new Uint8Array(await imageResponse.arrayBuffer());
    if (!bytes.length) {
        const error = new Error("Tencent mengembalikan gambar kosong.");
        error.status = 502;
        throw error;
    }
    const quality = inspectImageContent(bytes);
    if (isBlankImage(quality)) {
        const error = new Error(
            `Tencent mengembalikan gambar nyaris kosong (${Math.max(1, Math.round(bytes.length / 1024))} KB untuk `
            + `${quality.width}x${quality.height}).`
        );
        error.status = 502;
        throw error;
    }

    const mimeType = String(imageResponse.headers.get("content-type") || "").split(";")[0].trim().toLowerCase()
        || "image/png";
    return {
        bytes,
        mimeType: /^image\/(png|jpeg|webp)$/.test(mimeType) ? mimeType : "image/png",
        model: selectedModel,
        elapsedMs: Date.now() - startedAt,
        images_sent: images.length,
        ...(quality?.width ? { width: quality.width, height: quality.height } : {})
    };
}

export { TENCENT_IMAGE_ENDPOINT, TENCENT_IMAGE_MODEL };
