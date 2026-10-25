/* ---------------------------------------------------------
   GEN-Z.AI
   TENCENT CLOUD HY IMAGE PROVIDER
   ---------------------------------------------------------
   File: lib/social-publisher/tencent.js

   Dua protokol TokenHub internasional:

   1. `hy-image-v3` (Hy-Image-3.0) — POST /v1/wand/hunyuan-image/v3-generation
      body { model, prompt, images[0..3], size }, jawaban `data[0].url`.
      Batas: sisi [512, 2048], luas ≤ 1.048.576 → 576×1024 / 1024×576.

   2. `hy-image-v3.5-preview` (Hy-Image-3.5) — POST /v1/wand/hunyuan-image/v35-generation
      protokol Chat/Messages: { model, size, messages:[{role:"user", content:[text, image_url...]}] }.
      Jawaban berupa frame `image.chat.completion.chunk`; URL final ada di
      `choices[0].delta.image.url` (bisa datang sebagai satu JSON atau deretan
      baris `data:` ala SSE). Batas: sisi [256, 8192], luas ≤ 16.777.216 →
      1080×1920 / 1920×1080.

   Keduanya menerima gambar referensi, jadi wajah karakter tetap menjadi acuan
   (bukan text-to-image murni). URL hasil hanya berlaku 12 jam dan kadang
   menolak akses anonim, jadi diunduh lewat Worker.
   --------------------------------------------------------- */

import { inspectImageContent, isBlankImage } from "./reference-image.js";

const TENCENT_IMAGE_ENDPOINT = "https://tokenhub-intl.tencentcloudmaas.com/v1/wand/hunyuan-image/v3-generation";
const TENCENT_V35_ENDPOINT = "https://tokenhub-intl.tencentcloudmaas.com/v1/wand/hunyuan-image/v35-generation";
/* Default mengikuti katalog yang benar-benar tersedia di console pengguna
   (Vision Models hanya menampilkan hy-image-v3.5-preview). `hy-image-v3` tetap
   didukung lewat TENCENT_IMAGE_MODEL. */
const TENCENT_IMAGE_MODEL = "hy-image-v3.5-preview";
const TENCENT_MAX_REFERENCE_IMAGES = 3;
const TENCENT_V35_MAX_REFERENCE_IMAGES = 20;

function envText(env, key) {
    const processValue = typeof process !== "undefined" ? process.env?.[key] : "";
    return String(env?.[key] || processValue || "").trim();
}

export function isTencentV35Model(model) {
    return /^hy-image-v3\.5/i.test(String(model || "").trim());
}

/**
 * Ukuran keluaran per rasio. v3.5 boleh jauh lebih besar (4K), v3 dibatasi
 * area 1024×1024 sehingga 9:16 harus 576×1024.
 */
export function tencentImageSizeForRatio(ratio, model = TENCENT_IMAGE_MODEL) {
    if (isTencentV35Model(model)) {
        return ratio === "16:9"
            ? { width: 1920, height: 1080 }
            : { width: 1080, height: 1920 };
    }
    return ratio === "16:9"
        ? { width: 1024, height: 576 }
        : { width: 576, height: 1024 };
}

function toDataUrl(bytes, mimeType) {
    let binary = "";
    for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
    return `data:${mimeType || "image/jpeg"};base64,${btoa(binary)}`;
}

function describeTencentError(status, message, requestId, model) {
    const detail = String(message || "").slice(0, 400);
    const hint = status === 401
        ? " Periksa TENCENT_TOKENHUB_KEY: nilainya harus API key TokenHub (bukan SecretId/SecretKey), dikirim sebagai Bearer."
        : status === 422
            ? " Permintaan diblokir moderasi konten Tencent; ubah prompt atau foto referensinya."
            : status === 429
                ? " Batas konkurensi TokenHub tercapai; coba lagi beberapa saat lagi."
                : status === 400
                    ? ` Format permintaan ditolak (cek nama model ${model}, ukuran/rasio, dan panjang prompt).`
                    : status === 402 || status === 403
                        ? " Model gambar Tencent berbayar: aktifkan postpaid untuk model vision ini di Console → Online Inference, dan pastikan saldo/kredit mencukupi (klaim trial atau postpaid membekukan $10)."
                        : status >= 500
                            ? " Server Tencent sedang bermasalah; coba lagi."
                            : "";
    const id = requestId ? ` (request_id: ${requestId})` : "";
    return `Tencent Hy Image gagal (HTTP ${status})${detail ? `: ${detail}` : "."}${hint}${id}`;
}

/**
 * Ambil URL gambar dari jawaban v3.5 yang bisa berupa satu objek JSON atau
 * deretan baris SSE (`data: {...}`). URL final ada di
 * `choices[0].delta.image.url`; frame error membawa `error.message`.
 */
function readV35Payload(text) {
    const candidates = [];
    const trimmed = String(text || "").trim();
    if (!trimmed) return { url: "", error: "", requestId: "" };
    try {
        candidates.push(JSON.parse(trimmed));
    } catch {
        for (const line of trimmed.split(/\r?\n/)) {
            const payload = line.startsWith("data:") ? line.slice(5).trim() : "";
            if (!payload || payload === "[DONE]") continue;
            try {
                candidates.push(JSON.parse(payload));
            } catch {
                /* baris kosong / fragment yang tidak bisa di-parse: abaikan */
            }
        }
    }
    let url = "";
    let error = "";
    let requestId = "";
    for (const candidate of candidates) {
        if (!candidate || typeof candidate !== "object") continue;
        if (candidate.request_id) requestId = String(candidate.request_id);
        const frameError = candidate.error;
        if (frameError?.message) error = String(frameError.message).slice(0, 400);
        const frameUrl = candidate?.choices?.[0]?.delta?.image?.url;
        if (frameUrl) url = String(frameUrl);
    }
    return { url, error, requestId };
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
    const selectedModel = String(model || envText(env, "TENCENT_IMAGE_MODEL") || TENCENT_IMAGE_MODEL).trim();
    const v35 = isTencentV35Model(selectedModel);
    const { width, height } = tencentImageSizeForRatio(ratio, selectedModel);
    const endpoint = envText(env, "TENCENT_IMAGE_ENDPOINT") || (v35 ? TENCENT_V35_ENDPOINT : TENCENT_IMAGE_ENDPOINT);

    const images = [toDataUrl(referenceBytes, referenceMimeType)];
    if (garmentBytes?.byteLength) images.push(toDataUrl(garmentBytes, garmentMimeType));
    const maxImages = v35 ? TENCENT_V35_MAX_REFERENCE_IMAGES : TENCENT_MAX_REFERENCE_IMAGES;
    const sentImages = images.slice(0, maxImages);
    const promptText = String(prompt || "").slice(0, v35 ? 20000 : 8000);

    const body = v35
        ? {
            model: selectedModel,
            size: `${width}x${height}`,
            messages: [{
                role: "user",
                content: [
                    { type: "text", text: promptText },
                    ...sentImages.map(url => ({ type: "image_url", image_url: { url } }))
                ]
            }]
        }
        : {
            model: selectedModel,
            prompt: promptText,
            images: sentImages,
            size: `${width}x${height}`,
            revise: false
        };

    const startedAt = Date.now();
    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });

    const text = await response.text();
    let data = {};
    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        data = {};
    }
    const headerRequestId = String(response.headers.get("x-request-id") || "");
    if (!response.ok) {
        const message = data?.error?.message || data?.message || text.slice(0, 200);
        const error = new Error(
            describeTencentError(response.status, message, data?.request_id || headerRequestId, selectedModel)
        );
        error.status = response.status;
        throw error;
    }

    let url = "";
    let requestId = String(data?.request_id || headerRequestId);
    if (v35) {
        const parsed = readV35Payload(text);
        url = parsed.url;
        requestId = parsed.requestId || requestId;
        if (!url && parsed.error) {
            const error = new Error(`Tencent Hy Image menolak permintaan: ${parsed.error}${requestId ? ` (request_id: ${requestId})` : ""}`);
            error.status = 422;
            throw error;
        }
    } else {
        url = String(data?.data?.[0]?.url || "").trim();
    }
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
        images_sent: sentImages.length,
        ...(quality?.width ? { width: quality.width, height: quality.height } : {})
    };
}

export { TENCENT_IMAGE_ENDPOINT, TENCENT_IMAGE_MODEL, TENCENT_V35_ENDPOINT };
