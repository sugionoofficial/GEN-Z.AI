import { base64ToBytes, bytesToBase64 } from "./utils.js";
import {
    isQuotaErrorMessage,
    normalizeQwenCloudImageModel,
    normalizeQwenCloudLlmModel,
    qwenCloudLlmProtocolFor,
    qwenCloudProtocolFor
} from "./quotas.js";
import { cleanQuoteText, pickFallbackQuote } from "./quotes.js";
import {
    prepareReferenceImage,
    cropFaceRegion,
    inspectImageContent,
    isBlankImage,
    CLOUDFLARE_REFERENCE_MAX_SIDE
} from "./reference-image.js";
import { generateTencentSocialImage } from "./tencent.js";
import {
    generateTencentCaption,
    generateTencentQuoteText,
    tencentTextKey
} from "./tencent-text.js";
import jpeg from "jpeg-js";
import { capStoryMp4Duration, STORY_MAX_DURATION_STORY_SEC } from "./story-video.js";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const SOCIAL_IMAGE_MODEL = "gemini-3.1-flash-lite-image";
const SOCIAL_CAPTION_MODEL = "gemini-3.8-flash";
/*
 * Try-on Pruna adalah model PIHAK KETIGA (`pruna/...`, bukan `@cf/...`).
 * Model pihak ketiga ditagih lewat Unified Billing / AI Gateway dengan kredit
 * prabayar, jadi TIDAK tercakup kuota gratis 10.000 Neuron/hari dan akan gagal
 * di akun Workers Free. Karena itu try-on hanya dipakai bila tersedia, dan
 * selalu ada jalur gratis `@cf/...` sebagai fallback.
 */
const CLOUDFLARE_SOCIAL_IMAGE_MODEL = "pruna/p-image-try-on";
/*
 * FLUX.2 [klein] 4B menerima foto referensi lewat multipart `input_image_0..3`
 * (maks 4 gambar, tiap gambar < 512x512) dan ditagih dalam Neuron, sehingga
 * menjadi jalur UTAMA untuk karakter yang konsisten di kuota gratis.
 * Model multipart tidak bisa lewat AI Gateway, jadi tetap kena kuota Neuron.
 */
const CLOUDFLARE_SOCIAL_IDENTITY_MODEL = "@cf/black-forest-labs/flux-2-klein-4b";
/*
 * Cadangan identitas. SDXL base TIDAK bisa dipakai sebagai cadangan: model itu
 * menolak input gambar dengan error 3030 "input tensor `image` is not present
 * in the model". FLUX.2 klein 9B memakai protokol multipart yang sama dengan
 * 4B dan mendukung multi-reference, jadi ini pengganti yang benar.
 */
const CLOUDFLARE_SOCIAL_IDENTITY_FALLBACK_MODEL = "@cf/black-forest-labs/flux-2-klein-9b";
const CLOUDFLARE_SOCIAL_T2I_MODEL = "@cf/black-forest-labs/flux-1-schnell";
const CLOUDFLARE_SOCIAL_T2I_FALLBACK_MODEL = "@cf/stabilityai/stable-diffusion-xl-base-1.0";
const CLOUDFLARE_SOCIAL_QUOTE_IMAGE_MODEL = CLOUDFLARE_SOCIAL_T2I_MODEL;
const CLOUDFLARE_SOCIAL_QUOTE_IMAGE_FALLBACK_MODEL = CLOUDFLARE_SOCIAL_T2I_FALLBACK_MODEL;
const CLOUDFLARE_SOCIAL_CAPTION_MODEL = "@cf/meta/llama-3.2-11b-vision-instruct";
const CLOUDFLARE_SOCIAL_CAPTION_TEXT_MODEL = "@cf/meta/llama-3.1-8b-instruct-fp8";
/*
 * Foto contoh publik dari Cloudflare, dipakai hanya oleh tes provider di panel
 * admin supaya tes try-on tidak perlu URL privat Supabase.
 */
const CLOUDFLARE_TRYON_SAMPLE_PERSON =
    "https://huggingface.co/spaces/yisol/IDM-VTON/resolve/main/example/human/00121_00.jpg";
const CLOUDFLARE_TRYON_SAMPLE_GARMENT =
    "https://huggingface.co/spaces/yisol/IDM-VTON/resolve/main/example/cloth/04469_00.jpg";
const QWENCLOUD_SOCIAL_CAPTION_MODEL = "qwen3-vl-plus";
const QWENCLOUD_DEFAULT_BASE_URL = "https://maas.qwencloudapi.com/api/v1";
const QWENCLOUD_I2I_ONLY_MODELS = new Set([
    "qwen-mt-image-2.0",
    "wan2.7-image-pro",
    "wan2.7-image",
    "wan2.6-image",
    "wan2.5-i2i-preview",
    "vidu/vidu-image_reference2image"
]);
const QWENCLOUD_DEFAULT_T2I_MODEL = "wan2.6-t2i";

function required(value, message) {
    const result = String(value || "").trim();
    if (!result) throw new Error(message);
    return result;
}

function getCryptoKey(rawSecret) {
    const bytes = base64ToBytes(rawSecret);
    if (bytes.length !== 32) {
        throw new Error("SOCIAL_TOKEN_ENCRYPTION_KEY harus berupa Base64 dari 32 byte acak.");
    }
    return crypto.subtle.importKey("raw", bytes, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptSecret(secret, encryptionKey) {
    const key = await getCryptoKey(encryptionKey);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        encoder.encode(String(secret))
    );
    return {
        ciphertext: bytesToBase64(new Uint8Array(encrypted)),
        iv: bytesToBase64(iv)
    };
}

export async function decryptSecret(ciphertext, iv, encryptionKey) {
    const key = await getCryptoKey(encryptionKey);
    const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: base64ToBytes(iv) },
        key,
        base64ToBytes(ciphertext)
    );
    return decoder.decode(decrypted);
}

async function readApiResponse(response) {
    const text = await response.text();
    let data = null;
    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            data = { message: text };
        }
    }
    return data;
}

/**
 * Sebagian model Workers AI membungkus output (mis. `{ result: { image } }`
 * untuk model pihak ketiga), sebagian mengembalikan `{ image }` langsung.
 * `image` sendiri bisa berupa base64/stream/@cf maupun URL presigned.
 */
function unwrapCloudflareOutput(result) {
    let current = result;
    for (let depth = 0; depth < 5 && current && typeof current === "object"; depth += 1) {
        if (current.image !== undefined && current.image !== null) return current.image;
        if (ArrayBuffer.isView(current) || current instanceof ArrayBuffer) return current;
        if (typeof current.getReader === "function") return current;
        if (current.result !== undefined) {
            current = current.result;
            continue;
        }
        if (current.output !== undefined) {
            current = current.output;
            continue;
        }
        break;
    }
    return current ?? result;
}

async function downloadCloudflareImageUrl(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Gambar hasil Cloudflare tidak dapat diunduh (HTTP ${response.status}).`);
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.length) throw new Error("Cloudflare mengembalikan gambar kosong.");
    return bytes;
}

async function readCloudflareImageResult(result) {
    const output = unwrapCloudflareOutput(result);
    if (typeof output === "string") {
        const value = output.trim();
        /*
         * Bug lama: semua string dianggap base64. Model pihak ketiga (Pruna)
         * justru mengembalikan URL presigned, sehingga gambar rusak dan
         * berakhir dengan error "format gambar tidak didukung".
         */
        if (/^https?:\/\//i.test(value)) {
            return await downloadCloudflareImageUrl(value);
        }
        const base64 = value.replace(/^data:image\/[a-z0-9.+-]+;base64,/i, "");
        return base64ToBytes(base64);
    }
    if (output instanceof Uint8Array) return output;
    if (output instanceof ArrayBuffer) return new Uint8Array(output);
    if (ArrayBuffer.isView(output)) {
        return new Uint8Array(output.buffer, output.byteOffset, output.byteLength);
    }
    if (output instanceof Blob) return new Uint8Array(await output.arrayBuffer());
    if (output && typeof output.getReader === "function") {
        const reader = output.getReader();
        const chunks = [];
        let totalLength = 0;
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
            chunks.push(chunk);
            totalLength += chunk.byteLength;
        }
        const bytes = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
            bytes.set(chunk, offset);
            offset += chunk.byteLength;
        }
        return bytes;
    }
    throw new Error("Cloudflare Workers AI tidak mengembalikan data gambar yang didukung.");
}

function detectImageMimeType(bytes) {
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
    throw new Error("Cloudflare Workers AI mengembalikan format gambar yang tidak didukung.");
}

function qwenCloudBaseUrl(env) {
    const processBase = typeof process !== "undefined" ? process.env?.QWENCLOUD_BASE_URL : "";
    const custom = String(env?.QWENCLOUD_BASE_URL || processBase || "").trim();
    return (custom || QWENCLOUD_DEFAULT_BASE_URL).replace(/\/+$/, "");
}

function qwenCloudApiKey(env) {
    const processKey = typeof process !== "undefined" ? process.env?.QWENCLOUD_API_KEY : "";
    return required(
        env?.QWENCLOUD_API_KEY || processKey,
        "QWENCLOUD_API_KEY belum dikonfigurasi di Cloudflare."
    );
}

function imageDataUrl(bytes, mimeType) {
    return `data:${String(mimeType || "image/jpeg")};base64,${bytesToBase64(bytes)}`;
}

function qwenCloudSizeForRatio(aspectRatio) {
    return aspectRatio === "16:9" ? "2048*1152" : "1152*2048";
}

function cleanSocialCaption(caption) {
    return String(caption || "")
        .replace(/^["“”']+|["“”']+$/g, "")
        .replace(/#[\p{L}\p{N}_]+/gu, "")
        .replace(/\bhttps?:\/\/\S+|\bwww\.\S+/gi, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 280);
}

function readQwenCloudChoiceParts(data) {
    const choices = Array.isArray(data?.output?.choices) ? data.output.choices : [];
    return choices.flatMap(choice => Array.isArray(choice?.message?.content) ? choice.message.content : []);
}

function readQwenCloudResultImageUrl(data) {
    const fromChoices = readQwenCloudChoiceParts(data).find(part => typeof part?.image === "string")?.image;
    if (fromChoices) return fromChoices;
    const fromResults = Array.isArray(data?.output?.results)
        ? data.output.results.find(result => typeof result?.url === "string")?.url
        : "";
    if (fromResults) return fromResults;
    return typeof data?.output?.image_url === "string" ? data.output.image_url : "";
}

function isQwenCloudEndpointMismatch(status, data) {
    const message = String(data?.message || data?.code || "");
    return status === 400 && /url error|InvalidParameter|model.?endpoint|endpoint.?model/i.test(message);
}

function mapQwenCloudImageError(status, data) {
    const providerMessage = String(data?.message || data?.error?.message || "").slice(0, 500);
    const quotaExhausted = status === 429 || isQuotaErrorMessage(providerMessage);
    const quotaGuidance = quotaExhausted
        ? " Kuota tier model ini habis atau terlampaui; pilih model lain pada SET Studio Medsos atau lengkapi pembayaran QwenCloud."
        : "";
    const endpointGuidance = isQwenCloudEndpointMismatch(status, data)
        ? " Model ini mungkin tidak tersedia untuk protokol gambar QwenCloud akun Anda; coba model lain pada SET Studio Medsos."
        : "";
    const error = new Error(`QwenCloud image generation gagal (HTTP ${status})${providerMessage ? `: ${providerMessage}` : "."}${quotaGuidance}${endpointGuidance}`);
    error.status = status === 401 || status === 403 ? 401 : quotaExhausted ? 429 : status === 400 ? 400 : 502;
    error.quotaExhausted = quotaExhausted;
    return error;
}

async function qwenCloudSyncImage(env, apiKey, body) {
    const response = await fetch(`${qwenCloudBaseUrl(env)}/services/aigc/multimodal-generation/generation`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body
    });
    const data = await readApiResponse(response);
    if (!response.ok) return { error: { status: response.status, data } };
    const imageUrl = readQwenCloudResultImageUrl(data);
    if (!imageUrl) return { error: { status: 502, data: { message: "QwenCloud tidak mengembalikan data gambar." } } };
    return { imageUrl };
}

async function qwenCloudAsyncImage(env, apiKey, body) {
    const created = await fetch(`${qwenCloudBaseUrl(env)}/services/aigc/image-generation/generation`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "X-DashScope-Async": "enable"
        },
        body
    });
    const createdData = await readApiResponse(created);
    if (!created.ok) return { error: { status: created.status, data: createdData } };
    const taskId = String(createdData?.output?.task_id || "");
    if (!taskId) return { error: { status: 502, data: { message: "QwenCloud tidak mengembalikan task_id." } } };

    const deadline = Date.now() + 180000;
    while (Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const poll = await fetch(`${qwenCloudBaseUrl(env)}/tasks/${encodeURIComponent(taskId)}`, {
            headers: { Authorization: `Bearer ${apiKey}` }
        });
        const pollData = await readApiResponse(poll);
        if (!poll.ok) return { error: { status: poll.status, data: pollData } };
        const taskStatus = String(pollData?.output?.task_status || "");
        if (taskStatus === "SUCCEEDED") {
            const imageUrl = readQwenCloudResultImageUrl(pollData);
            if (!imageUrl) return { error: { status: 502, data: { message: "QwenCloud tidak mengembalikan data gambar." } } };
            return { imageUrl };
        }
        if (["FAILED", "CANCELED", "UNKNOWN"].includes(taskStatus)) {
            return {
                error: {
                    status: 502,
                    data: { message: String(pollData?.output?.message || pollData?.output?.code || `Task QwenCloud berakhir ${taskStatus}.`) }
                }
            };
        }
    }
    return { error: { status: 504, data: { message: "Task QwenCloud melebihi batas waktu pemrosesan." } } };
}

async function runQwenCloudImageRequest(env, apiKey, model, body) {
    const order = qwenCloudProtocolFor(model) === "async" ? ["async", "sync"] : ["sync", "async"];
    let lastError = null;
    for (const protocol of order) {
        const result = protocol === "sync"
            ? await qwenCloudSyncImage(env, apiKey, body)
            : await qwenCloudAsyncImage(env, apiKey, body);
        if (result.imageUrl) return result.imageUrl;
        lastError = result.error;
        if (!isQwenCloudEndpointMismatch(result.error.status, result.error.data)) break;
    }
    throw mapQwenCloudImageError(lastError.status, lastError.data);
}

async function generateQwenCloudSocialImage({
    env,
    prompt,
    referenceBytes,
    referenceMimeType,
    garmentBytes,
    garmentMimeType,
    aspectRatio,
    imageModel
}) {
    const apiKey = qwenCloudApiKey(env);
    const model = normalizeQwenCloudImageModel(imageModel);
    if (!referenceBytes?.byteLength) {
        const error = new Error("QwenCloud memerlukan foto referensi karakter untuk pembuatan gambar.");
        error.status = 400;
        throw error;
    }
    const content = [{ image: imageDataUrl(referenceBytes, referenceMimeType) }];
    if (garmentBytes?.byteLength) {
        content.push({ image: imageDataUrl(garmentBytes, garmentMimeType) });
    }
    content.push({ text: prompt });

    const body = JSON.stringify({
        model,
        input: { messages: [{ role: "user", content }] },
        parameters: {
            n: 1,
            watermark: false,
            prompt_extend: false,
            size: qwenCloudSizeForRatio(aspectRatio)
        }
    });
    const imageUrl = await runQwenCloudImageRequest(env, apiKey, model, body);

    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
        const error = new Error(`Gambar hasil QwenCloud tidak dapat diunduh (HTTP ${imageResponse.status}).`);
        error.status = 502;
        throw error;
    }
    const bytes = new Uint8Array(await imageResponse.arrayBuffer());
    if (!bytes.length) throw new Error("QwenCloud mengembalikan gambar kosong.");
    return {
        bytes,
        mimeType: detectImageMimeType(bytes),
        model
    };
}

/**
 * Ukuran keluaran gambar karakter.
 *
 * `high` (default) memberi wajah sekitar dua kali lipat piksel dibanding 576x1024,
 * yang membuat tekstur kulit dan mata tidak lagi terlihat seperti render halus.
 * `lite` tetap disediakan untuk menghemat kuota Neuron (10.000/hari): 576x1024
 * memakai ~670 Neuron per gambar, 768x1344 sekitar ~1.100.
 */
function cloudflareImageSizeForRatio(ratio, { resolution = "high" } = {}) {
    const wide = ratio === "16:9";
    if (resolution === "lite") {
        return wide ? { width: 1024, height: 576 } : { width: 576, height: 1024 };
    }
    return wide ? { width: 1344, height: 768 } : { width: 768, height: 1344 };
}

/**
 * Ukuran keluaran identitas bisa dinaikkan lewat Worker variable
 * `CLOUDFLARE_IDENTITY_SIZE` (contoh: `768x1344`) tanpa mengubah kode. Default
 * tetap 576x1024 karena itu ukuran yang sudah terbukti diterima model. Nilai
 * yang tidak masuk akal diabaikan, dan bila model menolak ukuran besar
 * permintaan diulang pada ukuran default sehingga tidak pernah menggagalkan
 * pembuatan karakter.
 */
function parseIdentitySizeOverride(raw) {
    const match = /^\s*(\d{3,4})\s*[x×]\s*(\d{3,4})\s*$/i.exec(String(raw ?? ""));
    if (!match) return null;
    const width = Number(match[1]);
    const height = Number(match[2]);
    if (width < 256 || height < 256 || width > 2048 || height > 2048) return null;
    return { width, height };
}

function describeCloudflareError(rawError) {
    const message = String(rawError?.message || rawError || "kesalahan provider").slice(0, 400);
    if (/paid plan|upgrade|billing|payment|credit|insufficient|402|unified/i.test(message)) {
        return `${message} (model pihak ketiga/pruna memakai Unified Billing AI Gateway, bukan kuota gratis Neuron)`;
    }
    if (/input tensor|input is not valid|input_image|image is not present/i.test(message)) {
        return `${message} (model ini tidak menerima input gambar, jadi tidak bisa menjaga identitas)`;
    }
    if (/not found|unknown model|no such model|unsupported|unavailable/i.test(message)) {
        return `${message} (model tidak tersedia untuk akun ini)`;
    }
    if (/3043|internal server error|5006|50[0-9]\b/i.test(message)) {
        return `${message} (gangguan sementara di sisi Cloudflare, bukan kesalahan konfigurasi Anda)`;
    }
    if (/rate.?limit|quota|neurons|429|3040/i.test(message)) {
        return `${message} (kuota Neuron harian habis atau sedang dibatasi)`;
    }
    return message;
}

/**
 * Error yang layak dicoba ulang / dilewati sementara: kapasitas penuh dan
 * gangguan internal. Bukan kesalahan konfigurasi, jadi tidak perlu mengubah
 * setting apa pun.
 */
/**
 * Apakah error ini benar-benar soal UKURAN keluaran?
 *
 * Cadangan ke ukuran yang lebih kecil hanya boleh terjadi untuk penolakan
 * ukuran. Kalau semua error non-transien diulang pada ukuran lain, satu error
 * konfigurasi (mis. input tensor tidak ada) akan memanggil model dua kali dan
 * membuang kuota Neuron tanpa hasil.
 */
function isImageSizeRejection(rawError) {
    const message = String(rawError?.message || rawError || "");
    if (!/(width|height|dimension|resolution|\bsize\b|pixel)/i.test(message)) return false;
    return /(not valid|invalid|not supported|unsupported|out of range|too large|exceed|must be)/i.test(message);
}

function isTransientCloudflareError(rawError) {
    const message = String(rawError?.message || rawError || "");
    return /3040|3043|internal server error|out of capacity|overloaded|timeout|timed out|5\d\d\b/i.test(message);
}

/*
 * Circuit breaker try-on Pruna.
 *
 * Model pihak ketiga ini butuh kredit AI Gateway. Tanpa kredit, setiap
 * percobaan gagal (HTTP 2021 "Insufficient AI Gateway credits") dan hanya
 * membuang waktu sebelum fallback. Status "tidak tersedia" diingat di memori
 * isolate selama 6 jam supaya pembuatan berikutnya langsung memakai model
 * gratis. Tombol "Tes Cloudflare AI" tetap selalu mencoba, jadi setelah kredit
 * diisi hasilnya langsung terlihat dan status tidak-tersedia dipulihkan.
 */
const TRYON_UNAVAILABLE_TTL_MS = 6 * 60 * 60 * 1000;
let tryOnUnavailableUntil = 0;
let tryOnUnavailableReason = "";

function isBillingBlockedError(rawError) {
    const message = String(rawError?.message || rawError || "");
    return /insufficient ai gateway credit|ai gateway credit|unified billing|paid plan|billing|payment|402|2021/i.test(message);
}

function markTryOnUnavailable(rawError) {
    tryOnUnavailableUntil = Date.now() + TRYON_UNAVAILABLE_TTL_MS;
    tryOnUnavailableReason = describeCloudflareError(rawError);
}

function clearTryOnUnavailable() {
    tryOnUnavailableUntil = 0;
    tryOnUnavailableReason = "";
}

function tryOnAvailability() {
    if (Date.now() < tryOnUnavailableUntil) {
        return {
            available: false,
            reason: tryOnUnavailableReason,
            retryAfterMinutes: Math.max(1, Math.ceil((tryOnUnavailableUntil - Date.now()) / 60000))
        };
    }
    return { available: true, reason: "", retryAfterMinutes: 0 };
}

/*
 * Circuit breaker cadangan identitas (FLUX.2 klein 9B).
 *
 * Saat diuji di akun free, 9B menolak dengan "3043: Internal server error".
 * Status itu bukan kesalahan konfigurasi, jadi percobaan berulang tidak akan
 * menolong; cadangan dilewati 30 menit supaya tiap kegagalan 4B tidak
 * menambah latensi. Pemulihan otomatis begitu 9B berhasil lagi.
 */
const IDENTITY_FALLBACK_COOLDOWN_MS = 30 * 60 * 1000;
let identityFallbackUnavailableUntil = 0;
let identityFallbackReason = "";

function markIdentityFallbackUnavailable(rawError) {
    identityFallbackUnavailableUntil = Date.now() + IDENTITY_FALLBACK_COOLDOWN_MS;
    identityFallbackReason = describeCloudflareError(rawError);
}

function clearIdentityFallbackUnavailable() {
    identityFallbackUnavailableUntil = 0;
    identityFallbackReason = "";
}

function identityFallbackAvailability() {
    if (Date.now() < identityFallbackUnavailableUntil) {
        return {
            available: false,
            reason: identityFallbackReason,
            retryAfterMinutes: Math.max(1, Math.ceil((identityFallbackUnavailableUntil - Date.now()) / 60000))
        };
    }
    return { available: true, reason: "", retryAfterMinutes: 0 };
}

/**
 * Validasi hasil model: byte gambar harus ada dan isinya tidak boleh nyaris
 * kosong. Dipakai SEMUA jalur (termasuk jalur identitas yang membangun request
 * multipart sendiri) supaya PNG 2 KB tidak lagi lolos sebagai "OK".
 */
function finalizeCloudflareImage(bytes, model, startedAt) {
    if (!bytes?.length) throw new Error(`${model} mengembalikan gambar kosong.`);
    const quality = inspectImageContent(bytes);
    if (isBlankImage(quality)) {
        const error = new Error(
            `${model} mengembalikan gambar nyaris kosong (${Math.max(1, Math.round(bytes.length / 1024))} KB untuk `
            + `${quality.width}x${quality.height}, standar deviasi ${quality.stddev}). Model ini tidak menghasilkan `
            + "gambar yang bisa dipakai."
        );
        error.status = 502;
        error.quality = quality;
        throw error;
    }
    return {
        bytes,
        mimeType: detectImageMimeType(bytes),
        model,
        elapsedMs: Date.now() - startedAt,
        ...(quality?.sampled ? { quality } : {})
    };
}

async function runCloudflareImageModel(env, model, payload) {
    const startedAt = Date.now();
    const result = await env.AI.run(model, payload);
    const bytes = await readCloudflareImageResult(result);
    return finalizeCloudflareImage(bytes, model, startedAt);
}

/**
 * Gambar untuk "Foto Karakter AI" dengan provider Cloudflare.
 *
 * Karakter WAJIB konsisten dengan foto referensi, jadi tidak ada lagi fallback
 * text-to-image yang mengarang wajah baru. Urutan strategi:
 *
 * 1. `@cf/black-forest-labs/flux-2-klein-4b` (gratis, kena kuota Neuron):
 *    foto referensi dikirim sebagai `input_image_0` (dan outfit sebagai
 *    `input_image_1`) lewat multipart, prompt meminta identitas dipertahankan.
 * 2. `pruna/p-image-try-on` (pihak ketiga, butuh kredit Unified Billing):
 *    dipakai bila langkah 1 gagal dan foto pakaian tersedia.
 * 3. `@cf/stabilityai/stable-diffusion-xl-base-1.0` img2img (gratis) dari foto
 *    referensi sebagai upaya terakhir mempertahankan komposisi/wajah.
 *
 * Bila ketiganya gagal, permintaan GAGAL dengan pesan yang jelas — bukan
 * menghasilkan gambar orang lain.
 */
async function generateCloudflareSocialImage({
    env,
    prompt,
    aspectRatio = "9:16",
    personImageUrl,
    garmentImageUrls,
    referenceBytes,
    referenceMimeType,
    garmentBytes,
    garmentMimeType
}) {
    if (!env?.AI || typeof env.AI.run !== "function") {
        const error = new Error("Cloudflare Workers AI binding belum dikonfigurasi. Pastikan binding AI tersedia pada Worker.");
        error.status = 503;
        throw error;
    }
    if (!referenceBytes?.byteLength) {
        const error = new Error("Foto referensi karakter wajib tersedia agar wajah karakter konsisten. Unggah ulang foto referensi karakter.");
        error.status = 400;
        throw error;
    }

    const ratio = ["9:16", "16:9"].includes(aspectRatio) ? aspectRatio : "9:16";
    const resolution = String(env?.CLOUDFLARE_IDENTITY_RES || "").trim().toLowerCase() === "lite"
        ? "lite"
        : "high";
    const liteSize = cloudflareImageSizeForRatio(ratio, { resolution: "lite" });
    const { width, height } = cloudflareImageSizeForRatio(ratio, { resolution });
    const scenePrompt = String(prompt || "").trim()
        || "Potret realistis dengan pencahayaan natural, gaya kamera ponsel, latar kota tropis.";
    const warnings = [];
    const tryOnEnabled = String(env?.CLOUDFLARE_DISABLE_TRYON || "").trim() !== "1";
    const tryOnFirst = String(env?.CLOUDFLARE_TRYON_FIRST || "").trim() === "1";
    const hasTryOnInputs = Boolean(personImageUrl)
        && Array.isArray(garmentImageUrls)
        && garmentImageUrls.length > 0;

    /**
     * Jalur identitas: FLUX.2 klein 4B (murah) lalu 9B (cadangan, protokol
     * multipart sama). Keduanya menerima foto referensi sebagai `input_image_0`
     * sehingga wajah karakter dipertahankan. SDXL base tidak dipakai karena
     * menolak input gambar (error 3030).
     */
    const identitySizeOverride = parseIdentitySizeOverride(env?.CLOUDFLARE_IDENTITY_SIZE);
    /*
     * Resolusi tinggi dipakai lebih dulu, dengan cadangan otomatis ke ukuran
     * `lite` bila model menolak ukuran tersebut. Dengan begitu kualitas naik
     * tanpa membuat pembuatan karakter bisa gagal gara-gara ukuran.
     */
    const preferredSize = identitySizeOverride || { width, height };
    const runIdentityEdit = async (model = CLOUDFLARE_SOCIAL_IDENTITY_MODEL, size = preferredSize) => {
        const reference = prepareReferenceImage(referenceBytes, referenceMimeType);
        if (reference.note) warnings.push(`${model}: ${reference.note}`);
        const outfit = garmentBytes?.byteLength
            ? prepareReferenceImage(garmentBytes, garmentMimeType)
            : null;
        /*
         * Wajah di foto badan penuh hanya tersisa ~40 px setelah foto diperkecil
         * ke 512 px, dan itu membuat model identitas menghasilkan orang lain.
         * Potongan area wajah dikirim sebagai gambar acuan tambahan.
         */
        const faceCropEnabled = String(env?.CLOUDFLARE_IDENTITY_FACE_CROP ?? "1").trim() !== "0";
        /*
         * Potret wajah diambil dari FOTO ASLI lebih dulu. Memotong salinan 512 px
         * hanya menyisakan wajah ~40–60 px, dan itu penyebab utama wajah hasil
         * generasi tidak mirip sekaligus terlihat "halus seperti render".
         * Bila foto aslinya terlalu besar/corrupt, potongan diambil dari salinan
         * 512 px seperti sebelumnya (lebih kecil, tapi tetap berfungsi).
         */
        let faceImage = null;
        let faceCropSource = "";
        if (faceCropEnabled) {
            faceImage = cropFaceRegion(referenceBytes, referenceMimeType, {
                maxSide: CLOUDFLARE_REFERENCE_MAX_SIDE
            });
            faceCropSource = faceImage ? "original" : "";
            if (!faceImage) {
                faceImage = cropFaceRegion(reference.bytes, reference.mimeType);
                faceCropSource = faceImage ? "downscaled" : "";
            }
        }
        const outfitIndex = 2;
        const faceIndex = outfit ? 3 : 2;
        /*
         * Model difusi menanggapi istilah fotografi jauh lebih patuh daripada
         * kata "realistis" saja. Tanpa detail lensa/kulit/cahaya, keluaran
         * klein 4B cenderung tampak seperti render 3D halus (kulit plastik).
         */
        const identityPrompt = [
            "Foto jurnalistik asli, bukan ilustrasi, render 3D, CGI, kartun, atau lukisan, tanpa teks atau watermark.",
            "gambar 1 adalah FOTO ORANG yang harus dipertahankan: wajah, warna kulit, bentuk mata, hidung, bibir, dan rambut harus SAMA PERSIS dengan gambar 1.",
            faceImage
                ? `gambar ${faceIndex} adalah potret dekat wajah orang yang sama; pakai sebagai acuan utama bentuk wajah, jarak mata, dan proporsi hidung.`
                : "",
            `Terapkan adegan berikut: ${scenePrompt}`,
            /*
             * Model difusi menanggapi istilah fotografi jauh lebih patuh daripada
             * kata "realistis". Bagian ini sengaja menyebut jenis kamera, lensa,
             * sumber cahaya, dan ketidaksempurnaan kulit: tanpa itu klein 4B
             * cenderung menghasilkan kulit plastik dan mata tanpa kilau.
             */
            "Kamera DSLR lensa 50mm f/1.8, fokus tajam pada wajah, detail kulit natural dengan pori dan tekstur halus, pencahayaan lembut dari jendela, kedalaman bidang dangkal.",
            "Warna kulit asli dengan variasi nada, sedikit ketidaksempurnaan alami (pori, bulu halus, tekstur), kilau kecil di mata (catchlight), bayangan lembut di bawah hidung dan dagu.",
            "Foto ponsel flagship apa adanya, sedikit noise sensor halus, tanpa filter kecantikan dan tanpa airbrush.",
            "Hindari kulit plastik, wajah mulus berlebihan, mata kaca, jari tambahan, anatomi tangan rusak, dan proporsi wajah yang melar.",
            outfit
                ? `Pakaian mengikuti gambar ${outfitIndex} (potongan, warna, dan bahan). JANGAN meniru wajah, kulit, atau bentuk tubuh orang pada gambar ${outfitIndex} — wajah hanya boleh berasal dari gambar 1${faceImage ? ` dan gambar ${faceIndex}` : ""}.`
                : "Pakaian tetap seperti pada gambar 1 kecuali diminta lain.",
            `Rasio ${ratio}.`
        ].filter(Boolean).join(" ");

        const form = new FormData();
        form.append("prompt", identityPrompt);
        form.append("width", String(size.width));
        form.append("height", String(size.height));
        form.append("input_image_0", new Blob([reference.bytes], { type: reference.mimeType }), "reference.jpg");
        if (outfit) {
            form.append("input_image_1", new Blob([outfit.bytes], { type: outfit.mimeType }), "outfit.jpg");
        }
        if (faceImage) {
            form.append(
                outfit ? "input_image_2" : "input_image_1",
                new Blob([faceImage.bytes], { type: faceImage.mimeType }),
                "face.jpg"
            );
        }
        /*
         * FormData tidak membuka body/boundary hasil serialisasi. Membungkusnya
         * ke Response membuat runtime menulis multipart lengkap dengan boundary,
         * yang wajib untuk model FLUX.2.
         */
        const serialized = new Response(form);
        const contentType = serialized.headers.get("content-type") || "multipart/form-data";
        const startedAt = Date.now();
        const result = await env.AI.run(model, {
            multipart: { body: serialized.body, contentType }
        });
        const bytes = await readCloudflareImageResult(result);
        const final = finalizeCloudflareImage(bytes, model, startedAt);
        /* Diagnostik, bukan peringatan: tes provider menampilkannya per model. */
        return faceImage
            ? {
                ...final,
                face_crop: {
                    width: faceImage.width,
                    height: faceImage.height,
                    reference: `${reference.width || "?"}x${reference.height || "?"}`,
                    source: faceCropSource,
                    source_size: faceImage.source
                        ? `${faceImage.source.width}x${faceImage.source.height}`
                        : ""
                }
            }
            : final;
    };

    const runTryOn = async () => {
        if (!hasTryOnInputs) throw new Error("foto pakaian tidak tersedia");
        return await runCloudflareImageModel(env, CLOUDFLARE_SOCIAL_IMAGE_MODEL, {
            person_image: personImageUrl,
            garment_images: garmentImageUrls.slice(0, 6),
            output_format: "jpg",
            turbo: garmentImageUrls.length <= 4
        });
    };

    const availability = tryOnAvailability();
    const tryOnUsable = tryOnEnabled && hasTryOnInputs && availability.available;
    if (tryOnEnabled && hasTryOnInputs && !availability.available) {
        warnings.push(
            `Try-on Pruna dilewati sementara (${availability.retryAfterMinutes} menit lagi): ${availability.reason}`
        );
    }

    /*
     * Model identitas utama dicoba ulang SEKALI bila gagal karena kapasitas/
     * gangguan sementara (3040 out of capacity, 3043, 5xx). Ini kesalahan yang
     * paling sering hilang dengan sendirinya, dan tanpa model utama pembuatan
     * karakter akan gagal total karena 9B belum tentu tersedia.
     */
    /** Ukuran besar yang ditolak model tidak boleh menggagalkan pembuatan. */
    const runIdentityWithSizeFallback = async (model = CLOUDFLARE_SOCIAL_IDENTITY_MODEL) => {
        if (preferredSize.width === liteSize.width && preferredSize.height === liteSize.height) {
            return runIdentityEdit(model, preferredSize);
        }
        try {
            return await runIdentityEdit(model, preferredSize);
        } catch (rawError) {
            /* Hanya penolakan ukuran yang diulang pada ukuran lebih kecil. */
            if (!isImageSizeRejection(rawError)) throw rawError;
            warnings.push(
                `Ukuran ${preferredSize.width}x${preferredSize.height} ditolak ${model} `
                + `(${describeCloudflareError(rawError)}), kembali ke ${liteSize.width}x${liteSize.height}.`
            );
            return runIdentityEdit(model, liteSize);
        }
    };

    const runIdentityPrimaryWithRetry = async () => {
        try {
            return await runIdentityWithSizeFallback(CLOUDFLARE_SOCIAL_IDENTITY_MODEL);
        } catch (rawError) {
            if (!isTransientCloudflareError(rawError)) throw rawError;
            warnings.push(
                `FLUX.2 klein 4B gagal sementara (${describeCloudflareError(rawError)}), mencoba sekali lagi.`
            );
            await new Promise(resolve => setTimeout(resolve, 700));
            return await runIdentityWithSizeFallback(CLOUDFLARE_SOCIAL_IDENTITY_MODEL);
        }
    };
    const fallbackAvailability = identityFallbackAvailability();
    if (!fallbackAvailability.available) {
        warnings.push(
            `Cadangan identitas FLUX.2 klein 9B dilewati sementara (${fallbackAvailability.retryAfterMinutes} menit lagi): ${fallbackAvailability.reason}`
        );
    }

    const identitySteps = [
        {
            label: "FLUX.2 klein 4B",
            key: "identity",
            run: runIdentityPrimaryWithRetry
        },
        ...(fallbackAvailability.available
            ? [{
                label: "FLUX.2 klein 9B",
                key: "identity9b",
                run: () => runIdentityWithSizeFallback(CLOUDFLARE_SOCIAL_IDENTITY_FALLBACK_MODEL)
            }]
            : [])
    ];
    const steps = tryOnFirst && tryOnUsable
        ? [{ label: "Try-on Pruna", key: "tryon", run: runTryOn }, ...identitySteps]
        : [
            ...identitySteps,
            ...(tryOnUsable ? [{ label: "Try-on Pruna", key: "tryon", run: runTryOn }] : [])
        ];

    for (const step of steps) {
        try {
            const generated = await step.run();
            if (step.key === "tryon") clearTryOnUnavailable();
            if (step.key === "identity9b") clearIdentityFallbackUnavailable();
            return { ...generated, warnings };
        } catch (rawError) {
            if (step.key === "tryon" && isBillingBlockedError(rawError)) {
                markTryOnUnavailable(rawError);
                warnings.push(
                    "Try-on Pruna dinonaktifkan 6 jam ke depan karena butuh kredit AI Gateway (Unified Billing)."
                );
            }
            if (step.key === "identity9b" && isTransientCloudflareError(rawError)) {
                markIdentityFallbackUnavailable(rawError);
                warnings.push(
                    "Cadangan identitas 9B dilewati 30 menit ke depan karena gangguan sementara di Cloudflare."
                );
            }
            warnings.push(`${step.label} gagal: ${describeCloudflareError(rawError)}`);
        }
    }

    const error = new Error(
        `Karakter konsisten tidak dapat dibuat karena semua model ber-referensi gagal. ${warnings.join(" ")}`.slice(0, 900)
    );
    error.status = /rate.?limit|quota|neurons/i.test(warnings.join(" ")) ? 429 : 502;
    error.warnings = warnings;
    throw error;
}

/* Foto uji sintetis 640x640 untuk memeriksa jalur referensi karakter. */
function createTestReferenceImage() {
    const size = 640;
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
            const index = (y * size + x) * 4;
            data[index] = (x * 255) / size;
            data[index + 1] = (y * 255) / size;
            data[index + 2] = 128;
            data[index + 3] = 255;
        }
    }
    return new Uint8Array(jpeg.encode({ data, width: size, height: size }, 80).data);
}

/**
 * Foto uji untuk jalur identitas.
 *
 * Memakai foto contoh publik dari dokumentasi Cloudflare (orang sungguhan)
 * supaya tes benar-benar menguji wajah, bukan gradien sintetis. Bila unduhan
 * gagal (mis. jaringan keluar diblokir di CI), tes tetap berjalan dengan gambar
 * sintetis dan melaporkan sumbernya agar hasil "OK" tidak ditafsirkan berlebihan.
 */
async function loadCloudflareTestReference() {
    try {
        const response = await fetch(CLOUDFLARE_TRYON_SAMPLE_PERSON);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (!bytes.length) throw new Error("gambar kosong");
        return { bytes, mimeType: "image/jpeg", source: "sample-photo" };
    } catch {
        return { bytes: createTestReferenceImage(), mimeType: "image/jpeg", source: "synthetic" };
    }
}

/**
 * Tes kering provider Cloudflare untuk panel admin: memanggil model satu per
 * satu dan mengembalikan error asli tiap model, supaya penyebab kegagalan
 * (binding, kuota/plan, model tidak tersedia) terlihat tanpa menebak.
 */
export async function testCloudflareImageProvider({ env, includeTryOn = false }) {
    if (!env?.AI || typeof env.AI.run !== "function") {
        const error = new Error("Binding Cloudflare Workers AI (AI) belum tersedia pada Worker.");
        error.status = 503;
        throw error;
    }
    const checks = [];
    const pushCheck = async (id, model, runner) => {
        const startedAt = Date.now();
        try {
            const result = await runner();
            checks.push({
                id,
                model,
                ok: true,
                bytes: result.bytes.length,
                mime_type: result.mimeType,
                elapsed_ms: result.elapsedMs ?? (Date.now() - startedAt),
                ...(result.input ? { input: result.input } : {}),
                ...(result.quality?.sampled ? { image_stddev: result.quality.stddev } : {}),
                ...(result.face_crop ? { face_crop: result.face_crop } : {})
            });
        } catch (rawError) {
            checks.push({
                id,
                model,
                ok: false,
                error: describeCloudflareError(rawError),
                elapsed_ms: Date.now() - startedAt
            });
        }
    };
    const checkResult = id => checks.find(check => check.id === id)?.ok ?? null;
    const testReference = await loadCloudflareTestReference();
    const identityRunner = model => async () => {
        const reference = prepareReferenceImage(testReference.bytes, testReference.mimeType);
        const form = new FormData();
        form.append("prompt", "Ubah latar belakang menjadi taman bunga, pertahankan subjek pada gambar 1.");
        form.append("width", "576");
        form.append("height", "1024");
        form.append("input_image_0", new Blob([reference.bytes], { type: reference.mimeType }), "reference.jpg");
        const serialized = new Response(form);
        const result = await runCloudflareImageModel(env, model, {
            multipart: {
                body: serialized.body,
                contentType: serialized.headers.get("content-type") || "multipart/form-data"
            }
        });
        return { ...result, input: testReference.source };
    };

    /* Jalur utama karakter + cadangannya: keduanya wajib menerima input gambar. */
    await pushCheck("identity", CLOUDFLARE_SOCIAL_IDENTITY_MODEL, identityRunner(CLOUDFLARE_SOCIAL_IDENTITY_MODEL));
    await pushCheck(
        "identity9b",
        CLOUDFLARE_SOCIAL_IDENTITY_FALLBACK_MODEL,
        async () => {
            const result = await identityRunner(CLOUDFLARE_SOCIAL_IDENTITY_FALLBACK_MODEL)();
            clearIdentityFallbackUnavailable();
            return result;
        }
    );
    const identity9bCheck = checks.find(check => check.id === "identity9b");
    if (identity9bCheck && !identity9bCheck.ok && isTransientCloudflareError(new Error(identity9bCheck.error))) {
        markIdentityFallbackUnavailable(new Error(identity9bCheck.error));
    }
    /* Latar Kata-kata Mutiara (tanpa karakter): FLUX.1 schnell + SDXL text-to-image. */
    await pushCheck("t2i", CLOUDFLARE_SOCIAL_T2I_MODEL, () => runCloudflareImageModel(
        env,
        CLOUDFLARE_SOCIAL_T2I_MODEL,
        { prompt: "Potret singkat seekor kucing oranye di jendela, foto tajam", steps: 4 }
    ));
    await pushCheck("sdxl", CLOUDFLARE_SOCIAL_T2I_FALLBACK_MODEL, () => runCloudflareImageModel(
        env,
        CLOUDFLARE_SOCIAL_T2I_FALLBACK_MODEL,
        { prompt: "Potret singkat seekor kucing oranye di jendela, foto tajam", num_steps: 2, width: 576, height: 1024 }
    ));
    if (includeTryOn) {
        await pushCheck("tryon", CLOUDFLARE_SOCIAL_IMAGE_MODEL, async () => {
            const result = await runCloudflareImageModel(env, CLOUDFLARE_SOCIAL_IMAGE_MODEL, {
                person_image: CLOUDFLARE_TRYON_SAMPLE_PERSON,
                garment_images: [CLOUDFLARE_TRYON_SAMPLE_GARMENT],
                output_format: "jpg"
            });
            clearTryOnUnavailable();
            return result;
        });
        const tryOnCheck = checks.find(check => check.id === "tryon");
        if (tryOnCheck && !tryOnCheck.ok && isBillingBlockedError(new Error(tryOnCheck.error))) {
            markTryOnUnavailable(new Error(tryOnCheck.error));
        }
    }
    const cooldown = tryOnAvailability();
    const fallbackCooldown = identityFallbackAvailability();
    return {
        binding_ready: true,
        free_tier_ready: checks.some(check => check.ok),
        identity_ready: checkResult("identity"),
        identity_fallback_ready: checkResult("identity9b"),
        identity_chain_ready: checkResult("identity") === true || checkResult("identity9b") === true,
        /* true = karakter bisa dibuat, tetapi tanpa cadangan bila model utama gagal. */
        identity_single_point: checkResult("identity") === true && checkResult("identity9b") !== true,
        test_reference_source: testReference.source,
        t2i_ready: checkResult("t2i"),
        sdxl_ready: checkResult("sdxl"),
        try_on_ready: checkResult("tryon"),
        try_on_cooldown_minutes: cooldown.available ? 0 : cooldown.retryAfterMinutes,
        identity_fallback_cooldown_minutes: fallbackCooldown.available ? 0 : fallbackCooldown.retryAfterMinutes,
        checks
    };
}

/**
 * Tes provider Tencent Hy Image dari panel admin.
 *
 * Memakai foto contoh publik (wajah sungguhan) sebagai gambar referensi supaya
 * jalur "gambar referensi" benar-benar diuji, dan mengembalikan error asli
 * Tencent (401 key salah, 403 postpaid belum aktif, kredit habis, moderasi)
 * apa adanya. Tombol ini memakai satu gambar berbayar per klik.
 */
export async function testTencentImageProvider({ env }) {
    const startedAt = Date.now();
    const reference = await loadCloudflareTestReference();
    try {
        const result = await generateTencentSocialImage({
            env,
            prompt: "Potret orang pada gambar referensi di taman bunga, pertahankan wajah, warna kulit, dan rambut.",
            referenceBytes: reference.bytes,
            referenceMimeType: reference.mimeType,
            aspectRatio: "9:16"
        });
        return {
            ok: true,
            model: result.model,
            bytes: result.bytes.length,
            mime_type: result.mimeType,
            width: result.width,
            height: result.height,
            images_sent: result.images_sent,
            elapsed_ms: result.elapsedMs ?? (Date.now() - startedAt),
            test_reference_source: reference.source
        };
    } catch (rawError) {
        return {
            ok: false,
            model: String(env?.TENCENT_IMAGE_MODEL || "hy-image-v3"),
            error: String(rawError?.message || "kesalahan provider").slice(0, 600),
            status: rawError?.status || 0,
            elapsed_ms: Date.now() - startedAt,
            test_reference_source: reference.source
        };
    }
}

/** Dipakai panel admin/tes untuk memaksa percobaan try-on berikutnya. */
export function resetCloudflareTryOnCooldown() {
    clearTryOnUnavailable();
}

/** Dipakai tes untuk memaksa percobaan cadangan identitas berikutnya. */
export function resetCloudflareIdentityFallbackCooldown() {
    clearIdentityFallbackUnavailable();
}

export async function generateSocialImage({
    env,
    prompt,
    referenceBytes,
    referenceMimeType,
    aspectRatio = "9:16",
    imageProvider = "gemini",
    personImageUrl,
    garmentImageUrls,
    garmentBytes,
    garmentMimeType,
    imageModel
}) {
    const ratio = ["9:16", "16:9"].includes(aspectRatio) ? aspectRatio : "9:16";
    if (imageProvider === "cloudflare") {
        return await generateCloudflareSocialImage({
            env,
            prompt,
            aspectRatio: ratio,
            personImageUrl,
            garmentImageUrls,
            referenceBytes,
            referenceMimeType,
            garmentBytes,
            garmentMimeType
        });
    }
    if (imageProvider === "qwencloud") {
        return await generateQwenCloudSocialImage({
            env,
            prompt,
            referenceBytes,
            referenceMimeType,
            garmentBytes,
            garmentMimeType,
            aspectRatio: ratio,
            imageModel
        });
    }
    if (imageProvider === "tencent") {
        return await generateTencentSocialImage({
            env,
            prompt,
            referenceBytes,
            referenceMimeType,
            garmentBytes,
            garmentMimeType,
            aspectRatio: ratio,
            model: imageModel
        });
    }
    if (imageProvider !== "gemini") {
        const error = new Error("Penyedia gambar Social Publisher tidak valid.");
        error.status = 400;
        throw error;
    }
    const processApiKey = typeof process !== "undefined" ? process.env?.GEMINI_API_KEY : "";
    const apiKey = required(
        env?.GEMINI_API_KEY || processApiKey,
        "GEMINI_API_KEY belum dikonfigurasi di Cloudflare."
    );
    const mimeType = String(referenceMimeType || "image/jpeg");
    const input = [];

    if (referenceBytes?.byteLength) {
        input.push({
            type: "image",
            mime_type: mimeType,
            data: bytesToBase64(referenceBytes)
        });
    }
    if (garmentBytes?.byteLength) {
        input.push({
            type: "text",
            text: "The next image is the outfit reference that must be worn by the character. Reproduce that exact garment (fabric, color, cut, and pattern) and do not redesign it."
        });
        input.push({
            type: "image",
            mime_type: String(garmentMimeType || "image/jpeg"),
            data: bytesToBase64(garmentBytes)
        });
    }
    input.push({ type: "text", text: prompt });

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
        method: "POST",
        headers: {
            "x-goog-api-key": apiKey,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: SOCIAL_IMAGE_MODEL,
            input,
            response_format: {
                type: "image",
                mime_type: "image/jpeg",
                aspect_ratio: ratio
            }
        })
    });
    const data = await readApiResponse(response);

    if (!response.ok) {
        const providerMessage = String(data?.error?.message || data?.message || "").slice(0, 500);
        const quotaGuidance = response.status === 429 && /limit:\s*0\b|quota.*(?:zero|0)|0\s+(?:requests?|tokens?)\s+per\s+(?:day|minute)/i.test(providerMessage)
            ? " Kuota model untuk tier API key ini saat ini nol; upgrade tier atau gunakan API key dengan kuota aktif."
            : "";
        /*
         * Model gambar Gemini (Nano Banana) tidak punya kuota gratis: project
         * tanpa billing, atau saldo prepaid habis, ditolak dengan 402/403.
         * Tanpa penjelasan ini pesannya hanya "Payment Required" dan pengguna
         * mengira API key-nya salah.
         */
        /* Kuota 429 sudah punya penjelasan sendiri; jangan ditimpa pesan billing. */
        const billingGuidance = quotaGuidance
            ? ""
            : response.status === 402
                || /billing|payment required|prepaid|insufficient (?:funds|balance)/i.test(providerMessage)
                ? " Model gambar Gemini (Nano Banana) tidak tersedia di tier gratis: project harus punya billing aktif dan saldo prepaid. Aktifkan billing di Google AI Studio/Cloud Console lalu coba lagi."
                : response.status === 403
                    ? " API key ini tidak diizinkan memakai model tersebut: pastikan Generative Language API aktif dan key berasal dari project yang sama dengan billing."
                    : "";
        const guidance = billingGuidance || quotaGuidance;
        const error = new Error(`Gemini image generation gagal (HTTP ${response.status})${providerMessage ? `: ${providerMessage}` : "."}${guidance}`);
        error.status = response.status;
        throw error;
    }

    const candidates = [];
    if (data?.output_image?.data) candidates.push(data.output_image);
    for (const step of Array.isArray(data?.steps) ? data.steps : []) {
        for (const content of Array.isArray(step?.content) ? step.content : []) {
            if (content?.type === "image" && content?.data) candidates.push(content);
        }
    }

    const output = candidates.find(candidate => candidate?.data);
    if (!output) {
        const message = (Array.isArray(data?.steps) ? data.steps : [])
            .flatMap(step => Array.isArray(step?.content) ? step.content : [])
            .filter(content => content?.type === "text")
            .map(content => String(content.text || ""))
            .join(" ")
            .slice(0, 300);
        throw new Error(message || "Gemini tidak mengembalikan data gambar.");
    }

    const mime = String(output.mime_type || output.mimeType || "image/png").toLowerCase();
    if (!/^image\/(png|jpeg|webp)$/.test(mime)) {
        throw new Error("Gemini mengembalikan format gambar yang tidak didukung.");
    }

    return {
        bytes: base64ToBytes(output.data),
        mimeType: mime,
        model: SOCIAL_IMAGE_MODEL
    };
}

export const TEXT_PROVIDERS = ["auto", "tencent", "cloudflare", "gemini", "qwencloud"];

export function normalizeTextProvider(value) {
    const clean = String(value || "").trim().toLowerCase();
    return TEXT_PROVIDERS.includes(clean) ? clean : "auto";
}

/**
 * Tentukan siapa yang menulis teks (caption & kata-kata mutiara), terpisah dari
 * siapa yang membuat gambar.
 *
 * `auto` (default): pakai Tencent TokenHub bila API key tersedia, karena kuota
 * trial model bahasa gratis (1 juta token) dan modelnya lebih baik daripada
 * llama 3.2 di Cloudflare. Bila key tidak ada, ikut provider gambar supaya
 * perilaku lama tetap sama.
 */
export function resolveTextProvider({ env, textProvider, imageProvider = "gemini" }) {
    const selected = normalizeTextProvider(textProvider);
    if (selected !== "auto") return selected;
    if (tencentTextKey(env)) return "tencent";
    if (["cloudflare", "gemini", "qwencloud"].includes(imageProvider)) return imageProvider;
    /*
     * Provider gambar yang tidak bisa menulis teks (Tencent) tanpa API key:
     * kembalikan "tencent" supaya jalur teksnya memberi hasil yang jujur —
     * caption dikosongkan, mode kata-kata mutiara memberi error yang menyebut
     * secret yang harus diisi (bukan error GEMINI_API_KEY yang menyesatkan).
     */
    return "tencent";
}

/**
 * Provider teks yang benar-benar bisa dipakai. Tencent hanya bisa jadi penulis
 * teks; bila gagal dan binding Workers AI ada, caption/mutiara ditulis
 * Cloudflare agar satu kuota habis tidak mematikan seluruh fitur.
 */
function textProviderFallback(env, attempted) {
    if (attempted === "tencent") {
        return typeof env?.AI?.run === "function" ? "cloudflare" : "";
    }
    return attempted;
}

export async function generateSocialContextCaption({
    env,
    imageBytes,
    imageMimeType,
    characterName,
    scene,
    imageProvider = "gemini",
    textProvider = "auto"
}) {
    const writer = resolveTextProvider({ env, textProvider, imageProvider });
    /*
     * Tencent Hy Image berbayar, tetapi model bahasa TokenHub punya kuota
     * New User Free Trial (1 juta token per model). Caption karena itu dibuat
     * model vision Tencent (`deepseek-v4.1-flash`) yang benar-benar melihat
     * gambar. Bila kuota habis/gagal, caption turun ke model Cloudflare, dan
     * bila itu juga tidak ada caption dibiarkan kosong — posting tetap jalan.
     */
    if (writer === "tencent") {
        if (tencentTextKey(env)) {
            try {
                const result = await generateTencentCaption({
                    env,
                    imageBytes,
                    imageMimeType,
                    characterName,
                    scene
                });
                const caption = cleanSocialCaption(result?.text);
                if (caption) return caption;
            } catch (rawError) {
                console.warn(`[Tencent caption] ${String(rawError?.message || "gagal").slice(0, 300)}`);
            }
        }
        const fallback = textProviderFallback(env, "tencent");
        if (!fallback) return "";
        return await generateSocialContextCaption({
            env,
            imageBytes,
            imageMimeType,
            characterName,
            scene,
            imageProvider: fallback,
            textProvider: fallback
        });
    }
    const captionPrompt = `Buat satu kalimat caption pendek dan santai dalam bahasa Indonesia untuk foto ini. Awali dengan gaya akrab seperti "Hai guys", sesuaikan dengan konteks yang benar-benar terlihat pada foto, dan jangan mengarang fakta atau menyebut link/hashtag. Nama karakter: ${String(characterName || "").slice(0, 80)}. Konteks adegan yang diminta: ${JSON.stringify(scene || {})}. Maksimal 24 kata. Keluarkan caption saja.`;

    if (writer === "cloudflare") {
        if (!env?.AI || typeof env.AI.run !== "function") {
            const error = new Error("Cloudflare Workers AI binding belum dikonfigurasi untuk membuat caption.");
            error.status = 503;
            throw error;
        }
        /*
         * Caption tidak boleh mematikan seluruh unggahan. Model vision dicoba
         * dulu, lalu model teks tanpa gambar, dan bila dua-duanya gagal caption
         * kontekstual dilewati (caption dari template tetap digunakan).
         */
        const attempts = [
            {
                model: CLOUDFLARE_SOCIAL_CAPTION_MODEL,
                payload: {
                    prompt: captionPrompt,
                    image: Array.from(imageBytes),
                    max_tokens: 80,
                    temperature: 0.8
                }
            },
            {
                model: CLOUDFLARE_SOCIAL_CAPTION_TEXT_MODEL,
                payload: {
                    prompt: captionPrompt,
                    max_tokens: 80,
                    temperature: 0.8
                }
            }
        ];
        for (const attempt of attempts) {
            try {
                const result = await env.AI.run(attempt.model, attempt.payload);
                const cleanedCaption = cleanSocialCaption(result?.response);
                if (cleanedCaption) return cleanedCaption;
            } catch (rawError) {
                console.warn(
                    `[Cloudflare caption] ${attempt.model} gagal: ${describeCloudflareError(rawError)}`
                );
            }
        }
        return "";
    }
    if (writer === "qwencloud") {
        let apiKey;
        try {
            apiKey = qwenCloudApiKey(env);
        } catch (rawError) {
            rawError.status = rawError?.status || 503;
            throw rawError;
        }
        try {
            const response = await fetch(`${qwenCloudBaseUrl(env)}/services/aigc/multimodal-generation/generation`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: QWENCLOUD_SOCIAL_CAPTION_MODEL,
                    input: {
                        messages: [{
                            role: "user",
                            content: [
                                { image: imageDataUrl(imageBytes, imageMimeType) },
                                { text: captionPrompt }
                            ]
                        }]
                    },
                    parameters: { max_tokens: 80, temperature: 0.8 }
                })
            });
            const data = await readApiResponse(response);
            if (!response.ok) {
                const providerMessage = String(data?.message || data?.error?.message || "").slice(0, 400);
                throw new Error(`QwenCloud caption gagal (HTTP ${response.status})${providerMessage ? `: ${providerMessage}` : "."}`);
            }
            const captionText = readQwenCloudChoiceParts(data)
                .filter(part => typeof part?.text === "string")
                .map(part => part.text)
                .join(" ");
            const caption = cleanSocialCaption(captionText);
            if (!caption) throw new Error("QwenCloud tidak mengembalikan caption konteks foto.");
            return caption;
        } catch (rawError) {
            if (rawError?.status) throw rawError;
            throw new Error(`QwenCloud caption gagal: ${String(rawError?.message || "kesalahan provider").slice(0, 400)}`);
        }
    }
    if (writer !== "gemini") {
        const error = new Error("Penyedia caption Social Publisher tidak valid.");
        error.status = 400;
        throw error;
    }
    const processApiKey = typeof process !== "undefined" ? process.env?.GEMINI_API_KEY : "";
    const apiKey = required(
        env?.GEMINI_API_KEY || processApiKey,
        "GEMINI_API_KEY belum dikonfigurasi di Cloudflare."
    );
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
        method: "POST",
        headers: {
            "x-goog-api-key": apiKey,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: SOCIAL_CAPTION_MODEL,
            input: [
                {
                    type: "image",
                    mime_type: imageMimeType,
                    data: bytesToBase64(imageBytes)
                },
                {
                    type: "text",
                    text: captionPrompt
                }
            ],
            generation_config: {
                temperature: 0.8,
                max_output_tokens: 80
            }
        })
    });
    const data = await readApiResponse(response);
    if (!response.ok) {
        const providerMessage = String(data?.error?.message || data?.message || "").slice(0, 400);
        throw new Error(`Gemini caption gagal (HTTP ${response.status})${providerMessage ? `: ${providerMessage}` : "."}`);
    }
    const captionText = typeof data?.output_text === "string"
        ? data.output_text
        : (Array.isArray(data?.steps) ? data.steps : [])
            .filter(step => step?.type === "model_output")
            .flatMap(step => Array.isArray(step?.content) ? step.content : [])
            .map(content => typeof content?.text === "string" ? content.text : "")
            .join(" ");
    const caption = cleanSocialCaption(captionText);
    if (!caption) throw new Error("Gemini tidak mengembalikan caption konteks foto.");
    return caption;
}

function parseGeneratedQuoteOutput(rawText, quotePlan, recentQuotes = []) {
    const text = String(rawText || "").trim();
    let quoteCandidate = "";
    let captionCandidate = "";

    const quoteMatch = text.match(/(?:^|\n)\s*QUOTE\s*:\s*(.+)/i);
    const captionMatch = text.match(/(?:^|\n)\s*CAPTION\s*:\s*(.+)/i);
    if (quoteMatch) quoteCandidate = quoteMatch[1];
    if (captionMatch) captionCandidate = captionMatch[1];

    if (!quoteCandidate && text.startsWith("{")) {
        try {
            const parsed = JSON.parse(text);
            quoteCandidate = String(parsed?.quote || parsed?.quoteText || parsed?.quote_text || parsed?.kata_mutiara || "");
            captionCandidate = String(parsed?.caption || parsed?.contextualCaption || parsed?.contextual_caption || "");
        } catch {
            // Fallback ke pembacaan baris biasa.
        }
    }

    if (!quoteCandidate) {
        const lines = text
            .split(/\r?\n+/)
            .map(line => line.trim())
            .filter(Boolean);
        quoteCandidate = lines[0] || "";
        if (!captionCandidate && lines[1]) captionCandidate = lines[1];
    }

    const quoteText = cleanQuoteText(quoteCandidate)
        || pickFallbackQuote(quotePlan?.themeId, recentQuotes);
    const contextualCaption = cleanSocialCaption(captionCandidate)
        || "Semoga pengingat kecil hari ini memberi ketenangan untuk langkahmu.";

    return { quoteText, contextualCaption };
}

export async function generateSocialQuote({
    env,
    quotePlan = {},
    recentQuotes = [],
    imageProvider = "gemini",
    textProvider = "auto",
    llmModel = ""
}) {
    const themeLabel = String(quotePlan?.themeLabel || "Refleksi Kehidupan & Kedewasaan").slice(0, 120);
    const themeDirection = String(quotePlan?.themeDirection || "ketenangan batin, rasa syukur, dan semangat bertumbuh").slice(0, 260);
    const avoidList = (Array.isArray(recentQuotes) ? recentQuotes : [])
        .map(item => cleanQuoteText(item))
        .filter(Boolean)
        .slice(0, 6);
    const avoidPrompt = avoidList.length
        ? `Jangan mengulang atau menyerupai kutipan berikut: ${avoidList.map(q => `"${q}"`).join("; ")}.`
        : "";

    const quotePrompt = [
        `Buat satu kata-kata mutiara atau motivasi orisinal dalam bahasa Indonesia yang menyentuh hati, puitis namun tetap natural dan membumi (12–28 kata), bertema "${themeLabel}" (${themeDirection}).`,
        avoidPrompt,
        "Keluarkan tepat satu baris dengan format berikut:",
        "QUOTE: <isi kata-kata mutiara tanpa tanda kutip>"
    ].filter(Boolean).join("\n");

    const writer = resolveTextProvider({ env, textProvider, imageProvider });

    if (writer === "tencent") {
        /*
         * Kata-kata mutiara memakai model bahasa TokenHub (kuota trial gratis).
         * Bila kuota habis/gagal, turun ke model teks Cloudflare supaya mode
         * Kata-kata Mutiara tidak mati hanya karena satu provider.
         */
        let tencentError = null;
        if (tencentTextKey(env)) {
            try {
                const result = await generateTencentQuoteText({ env, prompt: quotePrompt });
                return {
                    ...parseGeneratedQuoteOutput(result.text, quotePlan, recentQuotes),
                    model: result.model
                };
            } catch (rawError) {
                tencentError = rawError;
                console.warn(`[Tencent quote] ${String(rawError?.message || "gagal").slice(0, 300)}`);
            }
        } else {
            tencentError = new Error(
                "TENCENT_TOKENHUB_KEY belum dikonfigurasi, padahal provider teks Tencent yang dipilih."
            );
            tencentError.status = 503;
        }
        const fallback = textProviderFallback(env, "tencent");
        if (!fallback) {
            const error = new Error(
                `${String(tencentError?.message || "Model teks Tencent gagal.")} `
                + "Tencent Hy Image sendiri hanya membuat gambar, jadi kata-kata mutiara butuh model teks "
                + "(TENCENT_TOKENHUB_KEY) atau binding Workers AI."
            );
            error.status = tencentError?.status || 503;
            throw error;
        }
        return await generateSocialQuote({
            env,
            quotePlan,
            recentQuotes,
            imageProvider: fallback,
            textProvider: fallback,
            llmModel
        });
    }

    if (writer === "cloudflare") {
        if (!env?.AI || typeof env.AI.run !== "function") {
            const error = new Error("Cloudflare Workers AI binding belum dikonfigurasi untuk membuat kata-kata mutiara.");
            error.status = 503;
            throw error;
        }
        try {
            const result = await env.AI.run(CLOUDFLARE_SOCIAL_CAPTION_MODEL, {
                prompt: quotePrompt,
                max_tokens: 180,
                temperature: 0.85
            });
            return {
                ...parseGeneratedQuoteOutput(result?.response, quotePlan, recentQuotes),
                model: CLOUDFLARE_SOCIAL_CAPTION_MODEL
            };
        } catch (rawError) {
            if (rawError?.status) throw rawError;
            throw new Error(`Cloudflare pembuatan kata-kata mutiara gagal: ${String(rawError?.message || "kesalahan provider").slice(0, 400)}`);
        }
    }

    if (writer === "qwencloud") {
        let apiKey;
        try {
            apiKey = qwenCloudApiKey(env);
        } catch (rawError) {
            rawError.status = rawError?.status || 503;
            throw rawError;
        }
        const selectedLlmModel = normalizeQwenCloudLlmModel(llmModel);
        const rawText = await runQwenCloudLlmTextRequest(env, apiKey, selectedLlmModel, quotePrompt);
        return {
            ...parseGeneratedQuoteOutput(rawText, quotePlan, recentQuotes),
            model: selectedLlmModel
        };
    }

    if (writer !== "gemini") {
        const error = new Error("Penyedia AI kata-kata mutiara Social Publisher tidak valid.");
        error.status = 400;
        throw error;
    }

    const processApiKey = typeof process !== "undefined" ? process.env?.GEMINI_API_KEY : "";
    const apiKey = required(
        env?.GEMINI_API_KEY || processApiKey,
        "GEMINI_API_KEY belum dikonfigurasi di Cloudflare."
    );
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
        method: "POST",
        headers: {
            "x-goog-api-key": apiKey,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: SOCIAL_CAPTION_MODEL,
            input: [{ type: "text", text: quotePrompt }],
            generation_config: {
                temperature: 0.85,
                max_output_tokens: 180
            }
        })
    });
    const data = await readApiResponse(response);
    if (!response.ok) {
        const providerMessage = String(data?.error?.message || data?.message || "").slice(0, 400);
        throw new Error(`Gemini kata-kata mutiara gagal (HTTP ${response.status})${providerMessage ? `: ${providerMessage}` : "."}`);
    }
    const rawText = typeof data?.output_text === "string"
        ? data.output_text
        : Array.isArray(data?.outputs)
            ? data.outputs
                .map(output => typeof output?.text === "string" ? output.text : "")
                .filter(Boolean)
                .join("\n")
            : (Array.isArray(data?.steps) ? data.steps : [])
                .filter(step => step?.type === "model_output")
                .flatMap(step => Array.isArray(step?.content) ? step.content : [])
                .map(content => typeof content?.text === "string" ? content.text : "")
                .join("\n");
    return {
        ...parseGeneratedQuoteOutput(rawText, quotePlan, recentQuotes),
        model: SOCIAL_CAPTION_MODEL
    };
}

function stripThinkingBlocks(raw) {
    return String(raw || "").replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

function readQwenCloudTextResult(data) {
    // 1. OpenAI-compatible /compatible-mode/v1/chat/completions
    const openAiChoice = Array.isArray(data?.choices) ? data.choices[0]?.message?.content : null;
    if (typeof openAiChoice === "string" && openAiChoice.trim()) {
        return stripThinkingBlocks(openAiChoice);
    }
    if (Array.isArray(openAiChoice)) {
        const joined = openAiChoice.filter(p => typeof p?.text === "string").map(p => p.text).join("\n");
        if (joined.trim()) return stripThinkingBlocks(joined);
    }

    // 2. DashScope /services/aigc/text-generation/generation (result_format: "message")
    const dashChoice = Array.isArray(data?.output?.choices) ? data.output.choices[0]?.message?.content : null;
    if (typeof dashChoice === "string" && dashChoice.trim()) {
        return stripThinkingBlocks(dashChoice);
    }
    if (Array.isArray(dashChoice)) {
        const joined = dashChoice.filter(p => typeof p?.text === "string").map(p => p.text).join("\n");
        if (joined.trim()) return stripThinkingBlocks(joined);
    }

    // 3. DashScope legacy output.text
    if (typeof data?.output?.text === "string" && data.output.text.trim()) {
        return stripThinkingBlocks(data.output.text);
    }

    // 4. Multimodal parts fallback
    const parts = readQwenCloudChoiceParts(data)
        .filter(part => typeof part?.text === "string")
        .map(part => part.text)
        .join("\n");
    return stripThinkingBlocks(parts);
}

function mapQwenCloudLlmError(status, data, model) {
    const providerMessage = String(data?.message || data?.error?.message || "").slice(0, 500);
    const quotaExhausted = status === 429 || isQuotaErrorMessage(providerMessage);
    const quotaGuidance = quotaExhausted
        ? ` Kuota tier model LLM (${model}) habis atau terlampaui; pilih model LLM QwenCloud lain pada SET Studio Medsos atau lengkapi pembayaran QwenCloud.`
        : "";
    const endpointGuidance = isQwenCloudEndpointMismatch(status, data)
        ? ` Model LLM (${model}) mungkin tidak tersedia untuk akun QwenCloud Anda; coba model LLM lain pada SET Studio Medsos.`
        : "";
    const error = new Error(`QwenCloud kata-kata mutiara gagal (HTTP ${status})${providerMessage ? `: ${providerMessage}` : "."}${quotaGuidance}${endpointGuidance}`);
    error.status = status === 401 || status === 403 ? 401 : quotaExhausted ? 429 : status === 400 ? 400 : 502;
    error.quotaExhausted = quotaExhausted;
    error.llmModel = model;
    return error;
}

async function runQwenCloudLlmTextRequest(env, apiKey, model, prompt) {
    const baseUrl = qwenCloudBaseUrl(env);
    const isReasoningOnly = /^qwq/i.test(model);
    const maxTokens = isReasoningOnly ? 600 : 200;

    async function callDashScopeText(disableThinking) {
        const parameters = {
            result_format: "message",
            max_tokens: maxTokens,
            temperature: 0.85,
            ...(disableThinking && !isReasoningOnly ? { enable_thinking: false } : {})
        };
        const response = await fetch(`${baseUrl}/services/aigc/text-generation/generation`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model,
                input: { messages: [{ role: "user", content: prompt }] },
                parameters
            })
        });
        const data = await readApiResponse(response);
        if (!response.ok) {
            if (disableThinking && response.status === 400 && /enable_thinking/i.test(String(data?.message || ""))) {
                return await callDashScopeText(false);
            }
            return { error: { status: response.status, data } };
        }
        const text = readQwenCloudTextResult(data);
        if (!text) return { error: { status: 502, data: { message: "QwenCloud LLM tidak mengembalikan teks kata-kata mutiara." } } };
        return { text };
    }

    async function callDashScopeMultimodal() {
        const response = await fetch(`${baseUrl}/services/aigc/multimodal-generation/generation`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model,
                input: {
                    messages: [{ role: "user", content: [{ text: prompt }] }]
                },
                parameters: { max_tokens: maxTokens, temperature: 0.85 }
            })
        });
        const data = await readApiResponse(response);
        if (!response.ok) return { error: { status: response.status, data } };
        const text = readQwenCloudTextResult(data);
        if (!text) return { error: { status: 502, data: { message: "QwenCloud VL tidak mengembalikan teks kata-kata mutiara." } } };
        return { text };
    }

    async function callCompatibleChat() {
        const compatBase = /\/api\/v1$/i.test(baseUrl)
            ? baseUrl.replace(/\/api\/v1$/i, "/compatible-mode/v1")
            : `${baseUrl}/compatible-mode/v1`;
        const response = await fetch(`${compatBase}/chat/completions`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model,
                messages: [{ role: "user", content: prompt }],
                max_tokens: maxTokens,
                temperature: 0.85,
                ...(!isReasoningOnly ? { enable_thinking: false } : {})
            })
        });
        const data = await readApiResponse(response);
        if (!response.ok) return { error: { status: response.status, data } };
        const text = readQwenCloudTextResult(data);
        if (!text) return { error: { status: 502, data: { message: "QwenCloud chat/completions tidak mengembalikan teks kata-kata mutiara." } } };
        return { text };
    }

    const preferredProtocol = qwenCloudLlmProtocolFor(model);
    const order = preferredProtocol === "multimodal"
        ? ["multimodal", "text", "compat"]
        : preferredProtocol === "compat"
            ? ["compat", "text", "multimodal"]
            : ["text", "compat", "multimodal"];

    let lastError = null;
    for (const protocol of order) {
        const result = protocol === "multimodal"
            ? await callDashScopeMultimodal()
            : protocol === "compat"
                ? await callCompatibleChat()
                : await callDashScopeText(true);
        if (result.text) return result.text;
        lastError = result.error;
        if (!isQwenCloudEndpointMismatch(lastError.status, lastError.data)) {
            break;
        }
    }
    throw mapQwenCloudLlmError(lastError.status, lastError.data, model);
}

export async function generateSocialQuoteImage({
    env,
    prompt,
    aspectRatio = "9:16",
    imageProvider = "gemini",
    imageModel = ""
}) {
    const ratio = ["9:16", "16:9"].includes(aspectRatio) ? aspectRatio : "9:16";

    if (imageProvider === "cloudflare") {
        if (!env?.AI || typeof env.AI.run !== "function") {
            const error = new Error("Cloudflare Workers AI binding belum dikonfigurasi. Pastikan binding AI tersedia pada Worker.");
            error.status = 503;
            throw error;
        }
        const { width, height } = cloudflareImageSizeForRatio(ratio);
        const warnings = [];
        let lastError = null;
        for (const model of [CLOUDFLARE_SOCIAL_QUOTE_IMAGE_MODEL, CLOUDFLARE_SOCIAL_QUOTE_IMAGE_FALLBACK_MODEL]) {
            try {
                /*
                 * FLUX schnell hanya mendukung `prompt` + `steps`; ukuran dan
                 * guidance hanya berlaku untuk SDXL. Dulu `num_steps` dikirim ke
                 * FLUX sehingga parameter tersebut diabaikan.
                 */
                const payload = model === CLOUDFLARE_SOCIAL_QUOTE_IMAGE_MODEL
                    ? { prompt, steps: 4 }
                    : { prompt, num_steps: 8, guidance: 7.5, width, height };
                const generated = await runCloudflareImageModel(env, model, payload);
                return { ...generated, warnings };
            } catch (rawError) {
                lastError = rawError;
                warnings.push(`${model} gagal: ${describeCloudflareError(rawError)}`);
            }
        }
        const error = new Error(`Cloudflare quote image generation gagal. ${describeCloudflareError(lastError)}`);
        error.status = Number(lastError?.status) || (/rate.?limit|quota|neurons/i.test(error.message) ? 429 : 502);
        error.warnings = warnings;
        throw error;
    }

    if (imageProvider === "qwencloud") {
        const apiKey = qwenCloudApiKey(env);
        const normalized = normalizeQwenCloudImageModel(imageModel);
        const model = QWENCLOUD_I2I_ONLY_MODELS.has(normalized)
            ? QWENCLOUD_DEFAULT_T2I_MODEL
            : normalized;
        const body = JSON.stringify({
            model,
            input: {
                prompt,
                messages: [{ role: "user", content: [{ text: prompt }] }]
            },
            parameters: {
                n: 1,
                watermark: false,
                prompt_extend: false,
                size: qwenCloudSizeForRatio(ratio)
            }
        });
        const imageUrl = await runQwenCloudImageRequest(env, apiKey, model, body);
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) {
            const error = new Error(`Gambar hasil QwenCloud tidak dapat diunduh (HTTP ${imageResponse.status}).`);
            error.status = 502;
            throw error;
        }
        const bytes = new Uint8Array(await imageResponse.arrayBuffer());
        if (!bytes.length) throw new Error("QwenCloud mengembalikan gambar kosong.");
        return {
            bytes,
            mimeType: detectImageMimeType(bytes),
            model
        };
    }

    return await generateSocialImage({
        env,
        prompt,
        aspectRatio: ratio,
        imageProvider
    });
}

function facebookGraphVersion(env) {
    return String(env?.META_GRAPH_VERSION || "v26.0").trim() || "v26.0";
}

function facebookValue(env, name) {
    const processValue = typeof process !== "undefined" ? process.env?.[name] : "";
    return String(env?.[name] || processValue || "").trim();
}

/**
 * Error returned by the Facebook Graph API, enriched with an actionable
 * diagnosis so the admin panel can tell the operator what to fix and whether
 * retrying can create a duplicate post.
 */
export class FacebookGraphError extends Error {
    constructor(message, {
        code = "facebook_error",
        status = 502,
        graphCode = 0,
        graphSubcode = 0,
        httpStatus = 0,
        needsReconnect = false,
        retrySafe = true
    } = {}) {
        super(message);
        this.name = "FacebookGraphError";
        this.code = code;
        this.status = status;
        this.graphCode = graphCode;
        this.graphSubcode = graphSubcode;
        this.httpStatus = httpStatus;
        this.needsReconnect = needsReconnect;
        this.retrySafe = retrySafe;
    }
}

function graphErrorDetails(status, data) {
    const graphError = data?.error && typeof data.error === "object" ? data.error : {};
    return {
        httpStatus: Number(status) || 0,
        graphCode: Number(graphError.code) || 0,
        graphSubcode: Number(graphError.error_subcode) || 0,
        providerMessage: String(graphError.message || data?.message || "").trim().slice(0, 500)
    };
}

const FACEBOOK_PERMISSION_GUIDANCE = "Pastikan aplikasi Meta memakai use case \"Manage everything on your Page\" dengan izin pages_show_list, pages_read_engagement, dan pages_manage_posts, akun yang menghubungkan punya tugas CREATE_CONTENT pada Page ini, lalu hubungkan ulang Page lewat \"Hubungkan Facebook\".";

function facebookGraphFailure(status, data, { context = "publish" } = {}) {
    const { graphCode, graphSubcode, providerMessage, httpStatus } = graphErrorDetails(status, data);
    const suffix = providerMessage ? ` Pesan Facebook: ${providerMessage}` : "";
    const details = { graphCode, graphSubcode, httpStatus };

    if (graphCode === 190) {
        return new FacebookGraphError(
            `Token akses Facebook Page sudah tidak valid atau kedaluwarsa (code 190). Hubungkan ulang Page lewat "Hubungkan Facebook".${suffix}`,
            { code: "token_invalid", status: 403, needsReconnect: true, retrySafe: true, ...details }
        );
    }
    if (graphCode === 200 || ([3, 10].includes(graphCode) && /permission|izin|access/i.test(providerMessage))) {
        return new FacebookGraphError(
            `Facebook menolak ${context === "publish" ? "penerbitan foto" : "pemeriksaan Page"} karena izin aplikasi belum lengkap (permission error #${graphCode || 200}). ${FACEBOOK_PERMISSION_GUIDANCE}${suffix}`,
            { code: "permission_denied", status: 403, needsReconnect: true, retrySafe: true, ...details }
        );
    }
    if (graphCode === 10) {
        return new FacebookGraphError(
            `Aplikasi Meta tidak memiliki izin untuk mengelola Page ini (code 10). ${FACEBOOK_PERMISSION_GUIDANCE}${suffix}`,
            { code: "permission_denied", status: 403, needsReconnect: true, retrySafe: true, ...details }
        );
    }
    if ([4, 17, 32, 613].includes(graphCode)) {
        return new FacebookGraphError(
            `Facebook membatasi jumlah permintaan (rate limit, code ${graphCode}). Tunggu beberapa menit lalu coba lagi; foto belum diterbitkan.${suffix}`,
            { code: "rate_limited", status: 429, retrySafe: true, ...details }
        );
    }
    if (graphCode === 368) {
        return new FacebookGraphError(
            `Page ini sedang dibatasi sementara oleh Facebook (code 368). Periksa Page di Facebook sebelum mencoba lagi.${suffix}`,
            { code: "page_restricted", status: 403, retrySafe: true, ...details }
        );
    }
    if (graphCode === 100) {
        return new FacebookGraphError(
            `Facebook menolak parameter unggahan (code 100). Periksa ukuran/format gambar atau caption lalu coba lagi.${suffix}`,
            { code: "invalid_parameter", status: 400, retrySafe: true, ...details }
        );
    }
    if (httpStatus >= 500) {
        return new FacebookGraphError(
            `Facebook sedang bermasalah (HTTP ${httpStatus}). Posting mungkin sudah diterima — periksa Page sebelum mencoba lagi agar tidak terjadi post ganda.${suffix}`,
            { code: "facebook_unavailable", status: 502, retrySafe: false, ...details }
        );
    }
    return new FacebookGraphError(
        `Facebook gagal ${context === "publish" ? "menerbitkan foto" : "memeriksa Page"} (HTTP ${httpStatus || 0}${graphCode ? `, code ${graphCode}` : ""}).${suffix}`,
        { code: "facebook_error", status: 502, retrySafe: false, ...details }
    );
}

async function facebookGraphRequest(env, path, searchParams = {}) {
    const url = new URL(`https://graph.facebook.com/${facebookGraphVersion(env)}/${path}`);
    for (const [key, entryValue] of Object.entries(searchParams)) {
        if (entryValue !== undefined && entryValue !== null && entryValue !== "") {
            url.searchParams.set(key, String(entryValue));
        }
    }
    let response;
    try {
        response = await fetch(url.toString(), { headers: { Accept: "application/json" } });
    } catch (cause) {
        throw new FacebookGraphError(
            "Tidak dapat menghubungi Facebook untuk memeriksa koneksi Page. Periksa koneksi jaringan lalu coba lagi; foto belum diterbitkan.",
            { code: "facebook_unreachable", status: 502, retrySafe: true }
        );
    }
    const data = await readApiResponse(response);
    if (!response.ok || data?.error) throw facebookGraphFailure(response.status, data);
    return data;
}

/**
 * Reads the Page a stored token belongs to, along with the Page tasks of the
 * authorizing account. A missing CREATE_CONTENT task is the most common cause
 * of "(#200) Permissions error" when posting photos.
 */
export async function checkFacebookPageAccess({ env, pageId, pageAccessToken }) {
    const safePageId = String(pageId || "").trim();
    const token = String(pageAccessToken || "").trim();
    if (!safePageId || !token) {
        throw new FacebookGraphError(
            "Koneksi Facebook Page belum lengkap. Hubungkan ulang Page sebelum menerbitkan.",
            { code: "missing_page_token", status: 403, needsReconnect: true, retrySafe: true }
        );
    }

    let data;
    try {
        data = await facebookGraphRequest(env, encodeURIComponent(safePageId), {
            fields: "id,name,tasks",
            access_token: token
        });
    } catch (error) {
        // Reading `tasks` can be refused in two ways: the app lacks a Page
        // metadata permission (#200), or Graph rejects the field itself for
        // this token type (#100 "Tried accessing nonexisting field (tasks)").
        // Neither should block a working Page token from publishing, so retry
        // with a minimal read — only if that fails too is the error surfaced.
        const graphClientError = error instanceof FacebookGraphError
            && Number(error.httpStatus) >= 400
            && Number(error.httpStatus) < 500;
        if (error?.code === "permission_denied" || graphClientError) {
            const fallback = await facebookGraphRequest(env, encodeURIComponent(safePageId), {
                fields: "id,name",
                access_token: token
            }).catch(() => null);
            if (fallback) {
                return {
                    pageId: String(fallback?.id || safePageId),
                    pageName: String(fallback?.name || ""),
                    tasks: [],
                    tasksRead: false,
                    canPublish: true,
                    warning: "Daftar tugas Page tidak dapat dibaca untuk token Page, sehingga peran CREATE_CONTENT belum dapat dipastikan.",
                    checkedAt: new Date().toISOString()
                };
            }
        }
        if (error instanceof FacebookGraphError
            && error.code === "facebook_error"
            && error.httpStatus >= 400
            && error.httpStatus < 500) {
            throw new FacebookGraphError(
                `${error.message} Periksa izin aplikasi Meta dan hubungkan ulang Page bila masalah berlanjut.`,
                {
                    code: "permission_denied",
                    status: 403,
                    graphCode: error.graphCode,
                    graphSubcode: error.graphSubcode,
                    httpStatus: error.httpStatus,
                    needsReconnect: true,
                    retrySafe: true
                }
            );
        }
        throw error;
    }

    const tasks = Array.isArray(data?.tasks)
        ? data.tasks.filter(task => typeof task === "string" && task.trim()).map(task => task.trim())
        : [];
    return {
        pageId: String(data?.id || safePageId),
        pageName: String(data?.name || ""),
        tasks,
        tasksRead: true,
        canPublish: tasks.includes("CREATE_CONTENT"),
        checkedAt: new Date().toISOString()
    };
}
/**
 * Optional diagnostics for the stored Page token. Never throws: a failed
 * inspection only means the panel cannot show expiry/scope details.
 */
export async function inspectFacebookPageToken({ env, pageId, pageAccessToken }) {
    const appId = facebookValue(env, "META_APP_ID");
    const appSecret = facebookValue(env, "META_APP_SECRET");
    if (!appId || !appSecret) return null;
    try {
        const data = await facebookGraphRequest(env, "debug_token", {
            input_token: String(pageAccessToken || ""),
            access_token: `${appId}|${appSecret}`
        });
        const token = data?.data && typeof data.data === "object" ? data.data : {};
        const expiresAt = Number(token.expires_at) || 0;
        return {
            valid: token.is_valid === true,
            type: String(token.type || ""),
            appId: String(token.app_id || ""),
            profileId: String(token.profile_id || ""),
            pageId: String(pageId || ""),
            expiresAt: expiresAt > 0 ? new Date(expiresAt * 1000).toISOString() : null,
            dataAccessExpiresAt: Number(token.data_access_expires_at) > 0
                ? new Date(Number(token.data_access_expires_at) * 1000).toISOString()
                : null,
            scopes: Array.isArray(token.scopes) ? token.scopes.map(String) : []
        };
    } catch {
        return null;
    }
}

export async function publishFacebookPhoto({ env, pageId, pageAccessToken, caption, imageBytes, imageMimeType, skipAccessCheck = false }) {
    const graphVersion = facebookGraphVersion(env);
    const access = skipAccessCheck
        ? null
        : await checkFacebookPageAccess({ env, pageId, pageAccessToken });
    if (access && !access.canPublish) {
        throw new FacebookGraphError(
            `Akun Facebook yang terhubung belum memiliki tugas CREATE_CONTENT pada Page "${access.pageName || pageId}", sehingga foto tidak diterbitkan. ${FACEBOOK_PERMISSION_GUIDANCE}`,
            { code: "missing_page_role", status: 403, needsReconnect: true, retrySafe: true }
        );
    }

    const form = new FormData();
    const extension = imageMimeType === "image/jpeg" ? "jpg" : imageMimeType === "image/webp" ? "webp" : "png";

    form.set("access_token", pageAccessToken);
    form.set("caption", String(caption || "").slice(0, 2000));
    form.set("published", "true");
    form.set("source", new Blob([imageBytes], { type: imageMimeType }), `genzai-social.${extension}`);

    const response = await fetch(`https://graph.facebook.com/${graphVersion}/${encodeURIComponent(pageId)}/photos`, {
        method: "POST",
        body: form
    }).catch(() => {
        throw new FacebookGraphError(
            "Koneksi ke Facebook terputus saat mengunggah foto. Foto mungkin sudah diterima — periksa Page sebelum mencoba ulang agar tidak terjadi post ganda.",
            { code: "facebook_unreachable", status: 502, retrySafe: false }
        );
    });
    const data = await readApiResponse(response);
    if (!response.ok || data?.error) {
        throw facebookGraphFailure(response.status, data, { context: "publish" });
    }

    const photoId = String(data?.id || "");
    const postId = String(data?.post_id || data?.id || "");
    let permalinkUrl = "";

    if (postId) {
        const permalink = new URL(`https://graph.facebook.com/${graphVersion}/${encodeURIComponent(postId)}`);
        permalink.searchParams.set("fields", "permalink_url");
        permalink.searchParams.set("access_token", pageAccessToken);
        const permalinkResponse = await fetch(permalink.toString());
        const permalinkData = await readApiResponse(permalinkResponse);
        if (permalinkResponse.ok && typeof permalinkData?.permalink_url === "string") {
            permalinkUrl = permalinkData.permalink_url;
        }
    }

    return { photoId, postId, permalinkUrl };
}

export async function publishFacebookVideoStory({
    env,
    pageId,
    pageAccessToken,
    videoBytes,
    skipAccessCheck = false
}) {
    if (!(videoBytes instanceof Uint8Array) || videoBytes.byteLength < 256) {
        const error = new Error("Data Video Story MP4 kosong atau tidak valid.");
        error.status = 400;
        throw error;
    }

    const graphVersion = facebookGraphVersion(env);
    const access = skipAccessCheck
        ? null
        : await checkFacebookPageAccess({ env, pageId, pageAccessToken });
    if (access && !access.canPublish) {
        throw new FacebookGraphError(
            `Akun Facebook yang terhubung belum memiliki tugas CREATE_CONTENT pada Page "${access.pageName || pageId}", sehingga Cerita (Story) tidak diterbitkan. ${FACEBOOK_PERMISSION_GUIDANCE}`,
            { code: "missing_page_role", status: 403, needsReconnect: true, retrySafe: true }
        );
    }

    const storiesEndpoint = `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(pageId)}/video_stories`;

    // Phase 1: Start Video Story upload session
    const startParams = new URLSearchParams();
    startParams.set("upload_phase", "start");
    startParams.set("access_token", pageAccessToken);
    const startResponse = await fetch(storiesEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: startParams.toString()
    }).catch(() => {
        throw new FacebookGraphError(
            "Koneksi ke Facebook terputus saat memulai sesi Cerita (Video Story). Aman untuk mencoba ulang.",
            { code: "facebook_unreachable", status: 502, retrySafe: true }
        );
    });
    const startData = await readApiResponse(startResponse);
    if (!startResponse.ok || startData?.error) {
        throw facebookGraphFailure(startResponse.status, startData, { context: "publish" });
    }

    const videoId = String(startData?.video_id || "").trim();
    const uploadUrl = String(startData?.upload_url || "").trim();
    if (!videoId || !uploadUrl) {
        throw new FacebookGraphError(
            "Facebook tidak mengembalikan video_id atau upload_url untuk Cerita (Video Story).",
            { code: "facebook_story_init_invalid", status: 502, retrySafe: true }
        );
    }

    // Phase 2: Upload raw MP4 binary to rupload.facebook.com
    const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: {
            Authorization: `OAuth ${pageAccessToken}`,
            offset: "0",
            file_size: String(videoBytes.byteLength),
            "Content-Type": "application/octet-stream"
        },
        body: videoBytes
    }).catch(() => {
        throw new FacebookGraphError(
            "Koneksi ke Facebook terputus saat mengunggah file Video Story. Aman untuk mencoba ulang.",
            { code: "facebook_unreachable", status: 502, retrySafe: true }
        );
    });
    const uploadData = await readApiResponse(uploadResponse);
    if (!uploadResponse.ok || uploadData?.error || uploadData?.success === false) {
        throw facebookGraphFailure(uploadResponse.status, uploadData, { context: "publish" });
    }

    // Phase 3: Finish & publish directly to Facebook Page Stories (Cerita)
    const finishParams = new URLSearchParams();
    finishParams.set("upload_phase", "finish");
    finishParams.set("video_id", videoId);
    finishParams.set("access_token", pageAccessToken);
    const finishResponse = await fetch(storiesEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: finishParams.toString()
    }).catch(() => {
        throw new FacebookGraphError(
            "Koneksi ke Facebook terputus saat menyelesaikan penerbitan Cerita (Story). Periksa Cerita Page sebelum mencoba ulang agar tidak terbit ganda.",
            { code: "facebook_unreachable", status: 502, retrySafe: false }
        );
    });
    const finishData = await readApiResponse(finishResponse);
    if (!finishResponse.ok || finishData?.error || finishData?.success === false) {
        throw facebookGraphFailure(finishResponse.status, finishData, { context: "publish" });
    }

    const postId = String(finishData?.post_id || videoId);
    let permalinkUrl = `https://www.facebook.com/${encodeURIComponent(pageId)}`;
    const lookupId = String(finishData?.post_id || videoId);
    if (lookupId) {
        try {
            const permalink = new URL(`https://graph.facebook.com/${graphVersion}/${encodeURIComponent(lookupId)}`);
            permalink.searchParams.set("fields", "permalink_url");
            permalink.searchParams.set("access_token", pageAccessToken);
            const permalinkResponse = await fetch(permalink.toString());
            const permalinkData = await readApiResponse(permalinkResponse);
            if (permalinkResponse.ok && typeof permalinkData?.permalink_url === "string" && permalinkData.permalink_url) {
                permalinkUrl = permalinkData.permalink_url;
            }
        } catch {
            // Keep Page URL fallback for Story posts.
        }
    }

    return {
        videoId,
        postId,
        permalinkUrl: normalizeFacebookPermalink(permalinkUrl, `https://www.facebook.com/${encodeURIComponent(pageId)}`),
        isStory: true,
        target: "story"
    };
}

function normalizeFacebookPermalink(rawUrl, fallback = "") {
    const clean = String(rawUrl || "").trim();
    if (!clean) return fallback;
    if (/^https?:\/\//i.test(clean)) return clean;
    if (clean.startsWith("/")) return `https://www.facebook.com${clean}`;
    return fallback;
}

export async function publishFacebookFeedVideo({
    env,
    pageId,
    pageAccessToken,
    videoBytes,
    description = "",
    skipAccessCheck = false
}) {
    if (!(videoBytes instanceof Uint8Array) || videoBytes.byteLength < 256) {
        const error = new Error("Data Video MP4 kosong atau tidak valid.");
        error.status = 400;
        throw error;
    }

    const graphVersion = facebookGraphVersion(env);
    const access = skipAccessCheck
        ? null
        : await checkFacebookPageAccess({ env, pageId, pageAccessToken });
    if (access && !access.canPublish) {
        throw new FacebookGraphError(
            `Akun Facebook yang terhubung belum memiliki tugas CREATE_CONTENT pada Page "${access.pageName || pageId}", sehingga postingan video tidak diterbitkan. ${FACEBOOK_PERMISSION_GUIDANCE}`,
            { code: "missing_page_role", status: 403, needsReconnect: true, retrySafe: true }
        );
    }

    const form = new FormData();
    form.set("access_token", pageAccessToken);
    form.set("published", "true");
    const cleanDesc = String(description || "").trim().slice(0, 2000);
    if (cleanDesc) {
        form.set("description", cleanDesc);
    }
    form.set("source", new Blob([videoBytes], { type: "video/mp4" }), "genzai-quote.mp4");

    const response = await fetch(`https://graph-video.facebook.com/${graphVersion}/${encodeURIComponent(pageId)}/videos`, {
        method: "POST",
        body: form
    }).catch(() => {
        throw new FacebookGraphError(
            "Koneksi ke Facebook terputus saat mengunggah postingan video ke Beranda Page. Periksa Page sebelum mencoba ulang agar tidak terjadi post ganda.",
            { code: "facebook_unreachable", status: 502, retrySafe: false }
        );
    });
    const data = await readApiResponse(response);
    if (!response.ok || data?.error) {
        throw facebookGraphFailure(response.status, data, { context: "publish" });
    }

    const videoId = String(data?.id || "").trim();
    let postId = String(data?.post_id || videoId);
    const fallbackUrl = videoId
        ? `https://www.facebook.com/${encodeURIComponent(pageId)}/videos/${encodeURIComponent(videoId)}/`
        : `https://www.facebook.com/${encodeURIComponent(pageId)}`;
    let permalinkUrl = fallbackUrl;

    if (videoId) {
        try {
            const permalink = new URL(`https://graph.facebook.com/${graphVersion}/${encodeURIComponent(videoId)}`);
            permalink.searchParams.set("fields", "permalink_url");
            permalink.searchParams.set("access_token", pageAccessToken);
            const permalinkResponse = await fetch(permalink.toString());
            const permalinkData = await readApiResponse(permalinkResponse);
            if (permalinkResponse.ok && typeof permalinkData?.permalink_url === "string" && permalinkData.permalink_url) {
                permalinkUrl = normalizeFacebookPermalink(permalinkData.permalink_url, fallbackUrl);
            }
        } catch {
            // Keep Page video URL fallback.
        }
    }

    return {
        videoId,
        postId,
        permalinkUrl,
        isStory: false,
        target: "feed"
    };
}

export async function publishFacebookVideoReel({
    env,
    pageId,
    pageAccessToken,
    videoBytes,
    description = "",
    skipAccessCheck = false
}) {
    if (!(videoBytes instanceof Uint8Array) || videoBytes.byteLength < 256) {
        const error = new Error("Data Video Reels MP4 kosong atau tidak valid.");
        error.status = 400;
        throw error;
    }

    const graphVersion = facebookGraphVersion(env);
    const access = skipAccessCheck
        ? null
        : await checkFacebookPageAccess({ env, pageId, pageAccessToken });
    if (access && !access.canPublish) {
        throw new FacebookGraphError(
            `Akun Facebook yang terhubung belum memiliki tugas CREATE_CONTENT pada Page "${access.pageName || pageId}", sehingga Reels tidak diterbitkan. ${FACEBOOK_PERMISSION_GUIDANCE}`,
            { code: "missing_page_role", status: 403, needsReconnect: true, retrySafe: true }
        );
    }

    const reelsEndpoint = `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(pageId)}/video_reels`;

    // Phase 1: Start Reels upload session
    const startParams = new URLSearchParams();
    startParams.set("upload_phase", "start");
    startParams.set("access_token", pageAccessToken);
    const startResponse = await fetch(reelsEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: startParams.toString()
    }).catch(() => {
        throw new FacebookGraphError(
            "Koneksi ke Facebook terputus saat memulai sesi unggah Reels. Aman untuk mencoba ulang.",
            { code: "facebook_unreachable", status: 502, retrySafe: true }
        );
    });
    const startData = await readApiResponse(startResponse);
    if (!startResponse.ok || startData?.error) {
        throw facebookGraphFailure(startResponse.status, startData, { context: "publish" });
    }

    const videoId = String(startData?.video_id || "").trim();
    const uploadUrl = String(startData?.upload_url || "").trim();
    if (!videoId || !uploadUrl) {
        throw new FacebookGraphError(
            "Facebook tidak mengembalikan video_id atau upload_url untuk Reels.",
            { code: "facebook_reels_init_invalid", status: 502, retrySafe: true }
        );
    }

    // Phase 2: Upload raw MP4 binary to rupload.facebook.com
    const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: {
            Authorization: `OAuth ${pageAccessToken}`,
            offset: "0",
            file_size: String(videoBytes.byteLength),
            "Content-Type": "application/octet-stream"
        },
        body: videoBytes
    }).catch(() => {
        throw new FacebookGraphError(
            "Koneksi ke Facebook terputus saat mengunggah file Reels. Aman untuk mencoba ulang.",
            { code: "facebook_unreachable", status: 502, retrySafe: true }
        );
    });
    const uploadData = await readApiResponse(uploadResponse);
    if (!uploadResponse.ok || uploadData?.error || uploadData?.success === false) {
        throw facebookGraphFailure(uploadResponse.status, uploadData, { context: "publish" });
    }

    // Phase 3: Finish & publish Reels
    const finishParams = new URLSearchParams();
    finishParams.set("upload_phase", "finish");
    finishParams.set("video_id", videoId);
    finishParams.set("video_state", "PUBLISHED");
    const cleanDesc = String(description || "").trim().slice(0, 2000);
    if (cleanDesc) finishParams.set("description", cleanDesc);
    finishParams.set("access_token", pageAccessToken);
    const finishResponse = await fetch(reelsEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: finishParams.toString()
    }).catch(() => {
        throw new FacebookGraphError(
            "Koneksi ke Facebook terputus saat menyelesaikan penerbitan Reels. Periksa Page sebelum mencoba ulang agar tidak terbit ganda.",
            { code: "facebook_unreachable", status: 502, retrySafe: false }
        );
    });
    const finishData = await readApiResponse(finishResponse);
    if (!finishResponse.ok || finishData?.error || finishData?.success === false) {
        throw facebookGraphFailure(finishResponse.status, finishData, { context: "publish" });
    }

    const postId = String(finishData?.post_id || videoId);
    const fallbackUrl = `https://www.facebook.com/reel/${encodeURIComponent(videoId)}`;
    let permalinkUrl = fallbackUrl;
    try {
        const permalink = new URL(`https://graph.facebook.com/${graphVersion}/${encodeURIComponent(videoId)}`);
        permalink.searchParams.set("fields", "permalink_url");
        permalink.searchParams.set("access_token", pageAccessToken);
        const permalinkResponse = await fetch(permalink.toString());
        const permalinkData = await readApiResponse(permalinkResponse);
        if (permalinkResponse.ok && typeof permalinkData?.permalink_url === "string" && permalinkData.permalink_url) {
            permalinkUrl = normalizeFacebookPermalink(permalinkData.permalink_url, fallbackUrl);
        }
    } catch {
        // Keep Reel URL fallback.
    }

    return {
        videoId,
        postId,
        permalinkUrl,
        isStory: false,
        target: "reels"
    };
}

export async function publishFacebookQuoteVideo({
    env,
    pageId,
    pageAccessToken,
    videoBytes,
    target = "feed",
    skipAccessCheck = false
}) {
    const cleanTarget = ["feed", "reels", "story", "feed_story"].includes(target) ? target : "feed";
    if (cleanTarget === "story") {
        const storyBytes = capStoryMp4Duration(videoBytes, STORY_MAX_DURATION_STORY_SEC);
        return await publishFacebookVideoStory({ env, pageId, pageAccessToken, videoBytes: storyBytes, skipAccessCheck });
    }
    if (cleanTarget === "reels") {
        return await publishFacebookVideoReel({ env, pageId, pageAccessToken, videoBytes, description: "", skipAccessCheck });
    }
    if (cleanTarget === "feed_story") {
        const feedResult = await publishFacebookFeedVideo({
            env,
            pageId,
            pageAccessToken,
            videoBytes,
            description: "",
            skipAccessCheck
        });
        const storyBytes = capStoryMp4Duration(videoBytes, STORY_MAX_DURATION_STORY_SEC);
        const storyResult = await publishFacebookVideoStory({
            env,
            pageId,
            pageAccessToken,
            videoBytes: storyBytes,
            skipAccessCheck: true
        });
        return {
            videoId: feedResult.videoId || storyResult.videoId,
            storyVideoId: storyResult.videoId,
            postId: feedResult.postId || storyResult.postId,
            storyPostId: storyResult.postId,
            permalinkUrl: feedResult.permalinkUrl || storyResult.permalinkUrl,
            isStory: false,
            target: "feed_story"
        };
    }
    return await publishFacebookFeedVideo({
        env,
        pageId,
        pageAccessToken,
        videoBytes,
        description: "",
        skipAccessCheck
    });
}

export function makeProfileShareUrl(permalinkUrl) {
    if (!permalinkUrl) return "";
    const shareUrl = new URL("https://www.facebook.com/sharer/sharer.php");
    shareUrl.searchParams.set("u", permalinkUrl);
    return shareUrl.toString();
}
