import { base64ToBytes, bytesToBase64 } from "./utils.js";
import { isQuotaErrorMessage, normalizeQwenCloudImageModel, qwenCloudProtocolFor } from "./quotas.js";
import { cleanQuoteText, pickFallbackQuote } from "./quotes.js";
import { capStoryMp4Duration, STORY_MAX_DURATION_STORY_SEC } from "./story-video.js";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const SOCIAL_IMAGE_MODEL = "gemini-3.1-flash-lite-image";
const SOCIAL_CAPTION_MODEL = "gemini-3.8-flash";
const CLOUDFLARE_SOCIAL_IMAGE_MODEL = "pruna/p-image-try-on";
const CLOUDFLARE_SOCIAL_QUOTE_IMAGE_MODEL = "@cf/black-forest-labs/flux-1-schnell";
const CLOUDFLARE_SOCIAL_QUOTE_IMAGE_FALLBACK_MODEL = "@cf/stabilityai/stable-diffusion-xl-base-1.0";
const CLOUDFLARE_SOCIAL_CAPTION_MODEL = "@cf/meta/llama-3.2-11b-vision-instruct";
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

async function readCloudflareImageResult(result) {
    const output = result?.image ?? result;
    if (typeof output === "string") {
        const base64 = output.replace(/^data:image\/[a-z0-9.+-]+;base64,/i, "");
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

async function generateCloudflareSocialImage({ env, personImageUrl, garmentImageUrls }) {
    if (!env?.AI || typeof env.AI.run !== "function") {
        const error = new Error("Cloudflare Workers AI binding belum dikonfigurasi. Pastikan binding AI tersedia pada Worker.");
        error.status = 503;
        throw error;
    }
    if (!personImageUrl || !Array.isArray(garmentImageUrls) || !garmentImageUrls.length) {
        const error = new Error("Cloudflare P-Image Try-On memerlukan foto karakter dan minimal satu foto outfit/pakaian. Tambahkan outfit pada karakter terlebih dahulu.");
        error.status = 400;
        throw error;
    }
    try {
        const result = await env.AI.run(CLOUDFLARE_SOCIAL_IMAGE_MODEL, {
            person_image: personImageUrl,
            garment_images: garmentImageUrls
        });
        const bytes = await readCloudflareImageResult(result);
        if (!bytes.length) throw new Error("Cloudflare Workers AI mengembalikan gambar kosong.");
        return {
            bytes,
            mimeType: detectImageMimeType(bytes),
            model: CLOUDFLARE_SOCIAL_IMAGE_MODEL
        };
    } catch (rawError) {
        const error = new Error(`Cloudflare image generation gagal: ${String(rawError?.message || "kesalahan provider").slice(0, 500)}`);
        error.status = Number(rawError?.status) || (/rate.?limit|quota|neurons/i.test(error.message) ? 429 : 502);
        throw error;
    }
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
        return await generateCloudflareSocialImage({ env, personImageUrl, garmentImageUrls });
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
        const error = new Error(`Gemini image generation gagal (HTTP ${response.status})${providerMessage ? `: ${providerMessage}` : "."}${quotaGuidance}`);
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

export async function generateSocialContextCaption({ env, imageBytes, imageMimeType, characterName, scene, imageProvider = "gemini" }) {
    const captionPrompt = `Buat satu kalimat caption pendek dan santai dalam bahasa Indonesia untuk foto ini. Awali dengan gaya akrab seperti "Hai guys", sesuaikan dengan konteks yang benar-benar terlihat pada foto, dan jangan mengarang fakta atau menyebut link/hashtag. Nama karakter: ${String(characterName || "").slice(0, 80)}. Konteks adegan yang diminta: ${JSON.stringify(scene || {})}. Maksimal 24 kata. Keluarkan caption saja.`;

    if (imageProvider === "cloudflare") {
        if (!env?.AI || typeof env.AI.run !== "function") {
            const error = new Error("Cloudflare Workers AI binding belum dikonfigurasi untuk membuat caption.");
            error.status = 503;
            throw error;
        }
        try {
            const result = await env.AI.run(CLOUDFLARE_SOCIAL_CAPTION_MODEL, {
                prompt: captionPrompt,
                image: Array.from(imageBytes),
                max_tokens: 80,
                temperature: 0.8
            });
            const caption = String(result?.response || "").trim();
            if (!caption) throw new Error("Cloudflare Workers AI tidak mengembalikan caption.");
            const cleanedCaption = cleanSocialCaption(caption);
            if (!cleanedCaption) throw new Error("Cloudflare Workers AI tidak mengembalikan caption yang dapat digunakan.");
            return cleanedCaption;
        } catch (rawError) {
            if (rawError?.status) throw rawError;
            throw new Error(`Cloudflare caption gagal: ${String(rawError?.message || "kesalahan provider").slice(0, 400)}`);
        }
    }
    if (imageProvider === "qwencloud") {
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
    if (imageProvider !== "gemini") {
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
            quoteCandidate = String(parsed?.quote || parsed?.kata_mutiara || "");
            captionCandidate = String(parsed?.caption || "");
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
    imageProvider = "gemini"
}) {
    const themeLabel = String(quotePlan?.themeLabel || "Refleksi Kehidupan & Kedewasaan").slice(0, 120);
    const themeDirection = String(quotePlan?.themeDirection || "ketenangan batin, rasa syukur, dan semangat bertumbuh").slice(0, 260);
    const visualLabel = String(quotePlan?.visualLabel || "suasana senja yang tenang").slice(0, 140);
    const avoidList = (Array.isArray(recentQuotes) ? recentQuotes : [])
        .map(item => cleanQuoteText(item))
        .filter(Boolean)
        .slice(0, 6);
    const avoidPrompt = avoidList.length
        ? `Jangan mengulang atau menyerupai kutipan berikut: ${avoidList.map(q => `"${q}"`).join("; ")}.`
        : "";

    const quotePrompt = [
        `Buat satu kata-kata mutiara orisinal dalam bahasa Indonesia yang menyentuh hati, puitis namun tetap natural dan membumi (12–28 kata), bertema "${themeLabel}" (${themeDirection}) dan selaras dengan suasana visual "${visualLabel}".`,
        "Lalu buat satu kalimat pengantar caption pendek dan hangat dalam bahasa Indonesia (maksimal 20 kata) tanpa hashtag dan tanpa tautan.",
        avoidPrompt,
        "Keluarkan tepat dua baris dengan format berikut:",
        "QUOTE: <isi kata-kata mutiara tanpa tanda kutip>",
        "CAPTION: <isi satu kalimat pengantar caption>"
    ].filter(Boolean).join("\n");

    if (imageProvider === "cloudflare") {
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
            return parseGeneratedQuoteOutput(result?.response, quotePlan, recentQuotes);
        } catch (rawError) {
            if (rawError?.status) throw rawError;
            throw new Error(`Cloudflare pembuatan kata-kata mutiara gagal: ${String(rawError?.message || "kesalahan provider").slice(0, 400)}`);
        }
    }

    if (imageProvider === "qwencloud") {
        let apiKey;
        try {
            apiKey = qwenCloudApiKey(env);
        } catch (rawError) {
            rawError.status = rawError?.status || 503;
            throw rawError;
        }
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
                        content: [{ text: quotePrompt }]
                    }]
                },
                parameters: { max_tokens: 180, temperature: 0.85 }
            })
        });
        const data = await readApiResponse(response);
        if (!response.ok) {
            const providerMessage = String(data?.message || data?.error?.message || "").slice(0, 400);
            throw new Error(`QwenCloud kata-kata mutiara gagal (HTTP ${response.status})${providerMessage ? `: ${providerMessage}` : "."}`);
        }
        const rawText = readQwenCloudChoiceParts(data)
            .filter(part => typeof part?.text === "string")
            .map(part => part.text)
            .join("\n");
        return parseGeneratedQuoteOutput(rawText, quotePlan, recentQuotes);
    }

    if (imageProvider !== "gemini") {
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
    return parseGeneratedQuoteOutput(rawText, quotePlan, recentQuotes);
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
        const width = ratio === "16:9" ? 1024 : 576;
        const height = ratio === "16:9" ? 576 : 1024;
        let lastError = null;
        for (const model of [CLOUDFLARE_SOCIAL_QUOTE_IMAGE_MODEL, CLOUDFLARE_SOCIAL_QUOTE_IMAGE_FALLBACK_MODEL]) {
            try {
                const payload = model === CLOUDFLARE_SOCIAL_QUOTE_IMAGE_MODEL
                    ? { prompt, num_steps: 4, width, height }
                    : { prompt, width, height };
                const result = await env.AI.run(model, payload);
                const bytes = await readCloudflareImageResult(result);
                if (!bytes.length) throw new Error("Cloudflare Workers AI mengembalikan gambar kosong.");
                return {
                    bytes,
                    mimeType: detectImageMimeType(bytes),
                    model
                };
            } catch (rawError) {
                lastError = rawError;
                if (!/not found|unknown model|unsupported|unavailable/i.test(String(rawError?.message || ""))) {
                    break;
                }
            }
        }
        const error = new Error(`Cloudflare quote image generation gagal: ${String(lastError?.message || "kesalahan provider").slice(0, 500)}`);
        error.status = Number(lastError?.status) || (/rate.?limit|quota|neurons/i.test(error.message) ? 429 : 502);
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
