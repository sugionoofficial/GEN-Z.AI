/* =========================================================
   GEN-Z.AI
   OPUS LABS IMAGE MODELS — SPECIFICATION CATALOG
   ---------------------------------------------------------
   File:
     models/opus-image/specs.js

   Daftar model generate gambar di ekosistem Opus Labs MCP
   (`generate_keyframes`):
   1. GPT Image 2.5 Flare
   2. GPT Image 2.5 Sunburst
   3. Seedream 5.0 Pro
   4. Nano Banana 2
   5. Nano Banana Pro

   Seluruh model mendukung:
   - Sub-mode 1: Generate Biasa (0–8 gambar referensi + prompt)
   - Sub-mode 2: Generate Karakter Sheet (wajib foto karakter +
     opsional foto outfit + master prompt otomatis terkunci +
     catatan tambahan opsional, default rasio 16:9)
   - Tarif default flat 500 kredit (dapat diedit melalui
     admin-control/model-edit.html pada kolom credit_480p)
========================================================= */

export const DEFAULT_OPUS_IMAGE_CREDIT = 500;

export const OPUS_IMAGE_SPECS = Object.freeze([
    {
        id: "opus-gpt-image-2.5-flare",
        name: "GPT Image 2.5 Flare",
        upstreamModel: "gpt-image-2.5-flare",
        modelAliases: [
            "gpt-image-2.5-flare",
            "openai/gpt-image-2.5-flare",
            "gpt-image-2-5-flare",
            "gpt-image-2.5",
            "openai/gpt-image-2.5",
            "gpt-image-1.5",
            "gpt-image-1"
        ],
        logo: "openai.svg",
        description:
            "OpenAI GPT Image 2.5 Flare untuk generate gambar photorealistic detail tinggi, komposisi presisi, serta konsistensi karakter & outfit.",
        supportedRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"],
        defaultCredit: DEFAULT_OPUS_IMAGE_CREDIT
    },
    {
        id: "opus-gpt-image-2.5-sunburst",
        name: "GPT Image 2.5 Sunburst",
        upstreamModel: "gpt-image-2.5-sunburst",
        modelAliases: [
            "gpt-image-2.5-sunburst",
            "openai/gpt-image-2.5-sunburst",
            "gpt-image-2-5-sunburst",
            "gpt-image-2.5-flare",
            "openai/gpt-image-2.5-flare",
            "gpt-image-2.5",
            "openai/gpt-image-2.5"
        ],
        logo: "openai.svg",
        description:
            "OpenAI GPT Image 2.5 Sunburst dengan pencahayaan sinematik dramatis, warna kaya, dan ketajaman tekstur studio.",
        supportedRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"],
        defaultCredit: DEFAULT_OPUS_IMAGE_CREDIT
    },
    {
        id: "opus-seedream-5.0-pro",
        name: "Seedream 5.0 Pro",
        upstreamModel: "seedream-5.0-pro",
        modelAliases: [
            "seedream-5.0-pro",
            "bytedance/seedream-5.0-pro",
            "seedream-5-pro",
            "bytedance/seedream-5-pro",
            "seedream-5.0",
            "bytedance/seedream-5.0",
            "bytedance/seedream-v5.0",
            "seedream-5.0-lite",
            "bytedance/seedream-5.0-lite",
            "seedream-v5.0",
            "seedream-5",
            "seedream-4.5",
            "bytedance/seedream-4.5",
            "seedream-4.0"
        ],
        logo: "seedance.svg",
        description:
            "ByteDance Seedream 5.0 Pro untuk estetika visual premium, multi-reference hingga 8 gambar, dan turnaround karakter ultra-konsisten.",
        supportedRatios: ["1:1", "16:9", "9:16", "4:3", "3:4", "21:9"],
        defaultCredit: DEFAULT_OPUS_IMAGE_CREDIT
    },
    {
        id: "opus-nano-banana-2",
        name: "Nano Banana 2",
        upstreamModel: "nano-banana-2",
        modelAliases: [
            "nano-banana-2",
            "google/nano-banana-2",
            "nano_banana_2",
            "gemini-3.1-flash-image-preview",
            "google/gemini-3.1-flash-image-preview",
            "gemini-3.1-flash-image",
            "gemini-2.5-flash-image",
            "google/gemini-2.5-flash-image"
        ],
        logo: "gemini.svg",
        description:
            "Google Nano Banana 2 (Gemini Flash Image) cepat dan responsif dengan konsistensi subjek kuat hingga 8 gambar referensi.",
        supportedRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"],
        defaultCredit: DEFAULT_OPUS_IMAGE_CREDIT
    },
    {
        id: "opus-nano-banana-pro",
        name: "Nano Banana Pro",
        upstreamModel: "nano-banana-pro",
        modelAliases: [
            "nano-banana-pro",
            "google/nano-banana-pro",
            "nano_banana_pro",
            "gemini-3-pro-image-preview",
            "google/gemini-3-pro-image-preview",
            "gemini-3-pro-image",
            "nano-banana-2",
            "google/nano-banana-2"
        ],
        logo: "gemini.svg",
        description:
            "Google Nano Banana Pro (Gemini Pro Image) kelas studio untuk Character Sheet multi-angle, detail wajah presisi, dan penggabungan outfit.",
        supportedRatios: ["1:1", "16:9", "9:16", "4:3", "3:4", "21:9"],
        defaultCredit: DEFAULT_OPUS_IMAGE_CREDIT
    }
]);

export const OPUS_IMAGE_MODEL_IDS = Object.freeze(
    OPUS_IMAGE_SPECS.map(spec => spec.id)
);

export function isOpusImageModelId(modelId) {
    const clean = String(modelId || "").trim().toLowerCase();
    return OPUS_IMAGE_MODEL_IDS.includes(clean);
}
