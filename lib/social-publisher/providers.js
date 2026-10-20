import { base64ToBytes, bytesToBase64 } from "./utils.js";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const SOCIAL_IMAGE_MODEL = "gemini-3.1-flash-lite-image";
const CLOUDFLARE_SOCIAL_IMAGE_MODEL = "@cf/black-forest-labs/flux-2-klein-4b";

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

async function generateCloudflareSocialImage({ env, prompt, referenceBytes, referenceMimeType, aspectRatio }) {
    if (!env?.AI || typeof env.AI.run !== "function") {
        const error = new Error("Cloudflare Workers AI binding belum dikonfigurasi. Pastikan binding AI tersedia pada Worker.");
        error.status = 503;
        throw error;
    }
    if (!referenceBytes?.byteLength) {
        const error = new Error("Cloudflare image-to-image memerlukan foto referensi karakter.");
        error.status = 400;
        throw error;
    }
    const portrait = aspectRatio === "9:16";
    try {
        const formData = new FormData();
        formData.set(
            "prompt",
            `${prompt}\nCompose as a ${portrait ? "vertical portrait (9:16)" : "horizontal landscape (16:9)"} image.`
        );
        formData.set("width", portrait ? "768" : "1365");
        formData.set("height", portrait ? "1365" : "768");
        formData.set(
            "input_image_0",
            new Blob([referenceBytes], { type: referenceMimeType || "image/jpeg" }),
            "character-reference"
        );
        const multipartResponse = new Response(formData);
        const result = await env.AI.run(CLOUDFLARE_SOCIAL_IMAGE_MODEL, {
            multipart: {
                body: multipartResponse.body,
                contentType: multipartResponse.headers.get("content-type")
            }
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

export async function generateSocialImage({ env, prompt, referenceBytes, referenceMimeType, aspectRatio = "9:16", imageProvider = "gemini" }) {
    const ratio = ["9:16", "16:9"].includes(aspectRatio) ? aspectRatio : "9:16";
    if (imageProvider === "cloudflare") {
        return await generateCloudflareSocialImage({ env, prompt, referenceBytes, referenceMimeType, aspectRatio: ratio });
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

export async function generateSocialContextCaption({ env, imageBytes, imageMimeType, characterName, scene }) {
    const processApiKey = typeof process !== "undefined" ? process.env?.GEMINI_API_KEY : "";
    const apiKey = required(
        env?.GEMINI_API_KEY || processApiKey,
        "GEMINI_API_KEY belum dikonfigurasi di Cloudflare."
    );
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", {
        method: "POST",
        headers: {
            "x-goog-api-key": apiKey,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            contents: [{
                role: "user",
                parts: [
                    {
                        inline_data: {
                            mime_type: imageMimeType,
                            data: bytesToBase64(imageBytes)
                        }
                    },
                    {
                        text: `Buat satu kalimat caption pendek dan santai dalam bahasa Indonesia untuk foto ini. Awali dengan gaya akrab seperti "Hai guys", sesuaikan dengan konteks yang benar-benar terlihat pada foto, dan jangan mengarang fakta atau menyebut link/hashtag. Nama karakter: ${String(characterName || "").slice(0, 80)}. Konteks adegan yang diminta: ${JSON.stringify(scene || {})}. Maksimal 24 kata. Keluarkan caption saja.`
                    }
                ]
            }],
            generationConfig: {
                temperature: 0.8,
                maxOutputTokens: 80
            }
        })
    });
    const data = await readApiResponse(response);
    if (!response.ok) {
        const providerMessage = String(data?.error?.message || data?.message || "").slice(0, 400);
        throw new Error(`Gemini caption gagal (HTTP ${response.status})${providerMessage ? `: ${providerMessage}` : "."}`);
    }
    const caption = (data?.candidates?.[0]?.content?.parts || [])
        .map(part => typeof part?.text === "string" ? part.text : "")
        .join(" ")
        .replace(/^["“”']+|["“”']+$/g, "")
        .replace(/#[\p{L}\p{N}_]+/gu, "")
        .replace(/\bhttps?:\/\/\S+|\bwww\.\S+/gi, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 280);
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
