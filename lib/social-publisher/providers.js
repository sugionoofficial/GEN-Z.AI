import { base64ToBytes, bytesToBase64 } from "./utils.js";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const SOCIAL_IMAGE_MODEL = "gemini-3.1-flash-lite-image";
const SOCIAL_CAPTION_MODEL = "gemini-3.8-flash";
const CLOUDFLARE_SOCIAL_IMAGE_MODEL = "pruna/p-image-try-on";
const CLOUDFLARE_SOCIAL_CAPTION_MODEL = "@cf/meta/llama-3.2-11b-vision-instruct";
const QWENCLOUD_SOCIAL_IMAGE_MODEL = "qwen-image-3.0-pro";
const QWENCLOUD_SOCIAL_CAPTION_MODEL = "qwen3-vl-plus";
const QWENCLOUD_DEFAULT_BASE_URL = "https://maas.qwencloudapi.com/api/v1";

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

async function generateQwenCloudSocialImage({
    env,
    prompt,
    referenceBytes,
    referenceMimeType,
    garmentBytes,
    garmentMimeType,
    aspectRatio
}) {
    const apiKey = qwenCloudApiKey(env);
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

    const response = await fetch(`${qwenCloudBaseUrl(env)}/services/aigc/multimodal-generation/generation`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: QWENCLOUD_SOCIAL_IMAGE_MODEL,
            input: { messages: [{ role: "user", content }] },
            parameters: {
                n: 1,
                watermark: false,
                prompt_extend: false,
                size: qwenCloudSizeForRatio(aspectRatio)
            }
        })
    });
    const data = await readApiResponse(response);
    if (!response.ok) {
        const providerMessage = String(data?.message || data?.error?.message || "").slice(0, 500);
        const error = new Error(`QwenCloud image generation gagal (HTTP ${response.status})${providerMessage ? `: ${providerMessage}` : "."}`);
        error.status = response.status === 401 || response.status === 403 ? 401 : response.status === 429 ? 429 : 502;
        throw error;
    }
    const imageUrl = readQwenCloudChoiceParts(data).find(part => typeof part?.image === "string")?.image;
    if (!imageUrl) throw new Error("QwenCloud tidak mengembalikan data gambar.");

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
        model: QWENCLOUD_SOCIAL_IMAGE_MODEL
    };
}

async function generateCloudflareSocialImage({ env, personImageUrl, garmentImageUrls }) {
    if (!env?.AI || typeof env.AI.run !== "function") {
        const error = new Error("Cloudflare Workers AI binding belum dikonfigurasi. Pastikan binding AI tersedia pada Worker.");
        error.status = 503;
        throw error;
    }
    if (!personImageUrl || !Array.isArray(garmentImageUrls) || !garmentImageUrls.length) {
        const error = new Error("Cloudflare P-Image Try-On memerlukan foto karakter dan minimal satu foto pakaian. Unggah foto pakaian pada karakter terlebih dahulu.");
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
    garmentMimeType
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
            aspectRatio: ratio
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

export async function publishFacebookPhoto({ env, pageId, pageAccessToken, caption, imageBytes, imageMimeType }) {
    const graphVersion = String(env?.META_GRAPH_VERSION || "v26.0").trim();
    const form = new FormData();
    const extension = imageMimeType === "image/jpeg" ? "jpg" : imageMimeType === "image/webp" ? "webp" : "png";

    form.set("access_token", pageAccessToken);
    form.set("caption", String(caption || "").slice(0, 2000));
    form.set("published", "true");
    form.set("source", new Blob([imageBytes], { type: imageMimeType }), `genzai-social.${extension}`);

    const response = await fetch(`https://graph.facebook.com/${graphVersion}/${encodeURIComponent(pageId)}/photos`, {
        method: "POST",
        body: form
    });
    const data = await readApiResponse(response);
    if (!response.ok || data?.error) {
        const providerMessage = String(data?.error?.message || data?.message || "").slice(0, 500);
        throw new Error(`Facebook gagal menerbitkan foto (HTTP ${response.status})${providerMessage ? `: ${providerMessage}` : "."}`);
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

export function makeProfileShareUrl(permalinkUrl) {
    if (!permalinkUrl) return "";
    const shareUrl = new URL("https://www.facebook.com/sharer/sharer.php");
    shareUrl.searchParams.set("u", permalinkUrl);
    return shareUrl.toString();
}
