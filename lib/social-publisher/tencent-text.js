/* ---------------------------------------------------------
   GEN-Z.AI
   TENCENT TOKENHUB — MODEL TEKS
   ---------------------------------------------------------
   File: lib/social-publisher/tencent-text.js

   Tencent Hy Image berbayar, TAPI model bahasa TokenHub punya kuota
   New User Free Trial 1 juta token per model. Modul ini memakai kuota itu
   untuk hal yang memang gratis: caption kontekstual dan kata-kata mutiara.

   Endpoint-nya OpenAI-compatible:
     POST https://tokenhub-intl.tencentcloudmaas.com/v1/chat/completions
     Authorization: Bearer <TENCENT_TOKENHUB_KEY>

   Model default:
   - caption  : `deepseek-v4.1-flash` (punya Image Understanding, jadi bisa
                benar-benar melihat gambar hasil, bukan mengarang)
   - quote    : `hy3` (Hunyuan Hy3, bahasa Indonesia paling natural dari
                keluarga Hunyuan)

   Semua bisa diganti lewat Worker variable TENCENT_CAPTION_MODEL /
   TENCENT_QUOTE_MODEL tanpa mengubah kode.
   --------------------------------------------------------- */

import { bytesToBase64 } from "./utils.js";

const TENCENT_TEXT_ENDPOINT = "https://tokenhub-intl.tencentcloudmaas.com/v1/chat/completions";
const TENCENT_CAPTION_MODEL = "deepseek-v4.1-flash";
const TENCENT_QUOTE_MODEL = "hy3";
const TENCENT_TEXT_TIMEOUT_MS = 25000;

function envText(env, key) {
    const processValue = typeof process !== "undefined" ? process.env?.[key] : "";
    return String(env?.[key] || processValue || "").trim();
}

/** API key TokenHub yang sama dipakai untuk gambar dan teks. */
export function tencentTextKey(env) {
    return envText(env, "TENCENT_TOKENHUB_KEY") || envText(env, "TENCENT_API_KEY");
}

export function tencentTextModelFor(kind, env) {
    const override = kind === "caption"
        ? envText(env, "TENCENT_CAPTION_MODEL")
        : envText(env, "TENCENT_QUOTE_MODEL");
    if (override) return override;
    return kind === "caption" ? TENCENT_CAPTION_MODEL : TENCENT_QUOTE_MODEL;
}

function describeTencentTextError(status, message, requestId, model) {
    const detail = String(message || "").slice(0, 300);
    const hint = status === 401
        ? " Periksa TENCENT_TOKENHUB_KEY (API key TokenHub, bukan SecretId/SecretKey)."
        : status === 402 || status === 403
            ? " Kuota trial model teks habis atau model belum diaktifkan; klaim New User Free Trial di TokenHub Model Gallery atau aktifkan postpaid."
            : status === 404
                ? ` Model \`${model}\` tidak tersedia untuk API key ini; klaim trialnya di TokenHub Model Gallery, atau ganti model lewat Worker variable TENCENT_CAPTION_MODEL / TENCENT_QUOTE_MODEL.`
                : status === 429
                    ? " Batas laju TokenHub tercapai; coba lagi beberapa saat lagi."
                    : status >= 500
                        ? " Server Tencent sedang bermasalah; coba lagi."
                        : "";
    const id = requestId ? ` (request_id: ${requestId})` : "";
    return `Tencent ${model} gagal (HTTP ${status})${detail ? `: ${detail}` : "."}${hint}${id}`;
}

function toDataUrl(bytes, mimeType) {
    return `data:${mimeType || "image/jpeg"};base64,${bytesToBase64(bytes)}`;
}

/**
 * Satu panggilan chat completion ke TokenHub.
 * @returns {Promise<{text: string, model: string, elapsedMs: number}>}
 */
export async function runTencentChat({ env, model, messages, maxTokens = 120, temperature = 0.8 }) {
    const apiKey = tencentTextKey(env);
    if (!apiKey) {
        const error = new Error(
            "TENCENT_TOKENHUB_KEY belum dikonfigurasi, jadi model teks Tencent tidak bisa dipakai."
        );
        error.status = 503;
        throw error;
    }
    const selectedModel = String(model || TENCENT_QUOTE_MODEL).trim();
    const endpoint = envText(env, "TENCENT_TEXT_ENDPOINT") || TENCENT_TEXT_ENDPOINT;
    const startedAt = Date.now();

    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), TENCENT_TEXT_TIMEOUT_MS) : null;
    let response;
    try {
        response = await fetch(endpoint, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: selectedModel,
                messages,
                max_tokens: maxTokens,
                temperature,
                stream: false
            }),
            ...(controller ? { signal: controller.signal } : {})
        });
    } catch (rawError) {
        const aborted = rawError?.name === "AbortError";
        const error = new Error(
            aborted
                ? `Tencent ${selectedModel} tidak menjawab dalam ${Math.round(TENCENT_TEXT_TIMEOUT_MS / 1000)} detik.`
                : `Tencent ${selectedModel} gagal dihubungi: ${String(rawError?.message || "kesalahan jaringan").slice(0, 200)}`
        );
        error.status = 504;
        throw error;
    } finally {
        if (timer) clearTimeout(timer);
    }

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
        const error = new Error(describeTencentTextError(response.status, message, requestId, selectedModel));
        error.status = response.status;
        throw error;
    }

    const content = data?.choices?.[0]?.message?.content;
    const answer = Array.isArray(content)
        ? content.map(part => (typeof part === "string" ? part : part?.text || "")).join(" ").trim()
        : String(content || "").trim();
    if (!answer) {
        const error = new Error(
            `Tencent ${selectedModel} tidak mengembalikan teks${requestId ? ` (request_id: ${requestId})` : ""}.`
        );
        error.status = 502;
        throw error;
    }
    return { text: answer, model: selectedModel, elapsedMs: Date.now() - startedAt };
}

/**
 * Caption kontekstual dari gambar yang baru dibuat.
 *
 * Model yang dipakai harus punya Image Understanding; kalau tidak, caption
 * hanya akan mengarang. Prompt sengaja meminta satu kalimat pendek tanpa
 * hashtag/link karena caption template tetap dipakai bila ini gagal.
 */
export async function generateTencentCaption({
    env,
    imageBytes,
    imageMimeType,
    characterName,
    scene,
    model
}) {
    if (!imageBytes?.byteLength) {
        const error = new Error("Caption Tencent butuh gambar hasil untuk dilihat.");
        error.status = 400;
        throw error;
    }
    const prompt = [
        "Lihat foto ini dan tulis SATU kalimat caption media sosial dalam bahasa Indonesia yang santai dan akrab.",
        "Awali dengan sapaan seperti \"Hai guys\" atau \"Sore, guys\".",
        "Sebut hal yang benar-benar terlihat: pakaian, tempat, cahaya, atau aktivitas. Jangan mengarang tempat atau kejadian yang tidak tampak.",
        "Jangan pakai hashtag, link, tanda kutip, atau emoji berlebihan. Maksimal 24 kata.",
        `Nama karakter: ${String(characterName || "karakter").slice(0, 60)}.`,
        scene ? `Konteks adegan yang diminta: ${JSON.stringify(scene).slice(0, 400)}.` : "",
        "Keluarkan caption saja."
    ].filter(Boolean).join(" ");

    const result = await runTencentChat({
        env,
        model: model || tencentTextModelFor("caption", env),
        maxTokens: 120,
        temperature: 0.8,
        messages: [{
            role: "user",
            content: [
                { type: "text", text: prompt },
                {
                    type: "image_url",
                    image_url: { url: toDataUrl(imageBytes, imageMimeType || "image/jpeg") }
                }
            ]
        }]
    });
    return result;
}

/** Kata-kata mutiara: model teks saja, tanpa gambar. */
export async function generateTencentQuoteText({ env, prompt, model }) {
    const result = await runTencentChat({
        env,
        model: model || tencentTextModelFor("quote", env),
        maxTokens: 200,
        temperature: 0.9,
        messages: [
            {
                role: "system",
                content: "Kamu penulis kata-kata mutiara bahasa Indonesia yang puitis, natural, dan membumi. Patuhi format keluaran yang diminta."
            },
            { role: "user", content: String(prompt || "") }
        ]
    });
    return result;
}

export { TENCENT_TEXT_ENDPOINT, TENCENT_CAPTION_MODEL, TENCENT_QUOTE_MODEL };
