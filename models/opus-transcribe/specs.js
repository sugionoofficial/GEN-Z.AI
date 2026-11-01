/* =========================================================
   GEN-Z.AI
   OPUS LABS TRANSCRIBE MODELS — SPECIFICATION CATALOG
   ---------------------------------------------------------
   File:
     models/opus-transcribe/specs.js

   Model Speech-to-Text & Subtitle otomatis di ekosistem
   Opus Labs MCP (`import_assets` + `transcribe_audio`):
   - Menerima upload file Audio (MP3, WAV, M4A, AAC, OGG, FLAC)
     maupun file Video (MP4, MOV, WEBM).
   - Menghasilkan teks transkrip penuh + segmen bertanda waktu
     (timestamp) + ekspor langsung ke `.TXT` dan `.SRT`.
   - Tarif default flat 500 kredit (dapat diedit melalui
     admin-control/model-edit.html pada kolom credit_480p).
========================================================= */

export const DEFAULT_OPUS_TRANSCRIBE_CREDIT = 500;

export const OPUS_TRANSCRIBE_LANGUAGES = Object.freeze([
    { value: "auto", label: "Deteksi Otomatis (Auto-Detect)" },
    { value: "id", label: "Bahasa Indonesia (id)" },
    { value: "en", label: "English (en)" },
    { value: "ja", label: "Japanese / 日本語 (ja)" },
    { value: "ko", label: "Korean / 한국어 (ko)" },
    { value: "zh", label: "Chinese / 中文 (zh)" },
    { value: "ar", label: "Arabic / العربية (ar)" },
    { value: "es", label: "Spanish / Español (es)" },
    { value: "fr", label: "French / Français (fr)" },
    { value: "de", label: "German / Deutsch (de)" },
    { value: "pt", label: "Portuguese / Português (pt)" },
    { value: "hi", label: "Hindi / हिन्दी (hi)" },
    { value: "ms", label: "Bahasa Melayu (ms)" },
    { value: "th", label: "Thai / ไทย (th)" },
    { value: "vi", label: "Vietnamese / Tiếng Việt (vi)" }
]);

export const OPUS_TRANSCRIBE_LANGUAGE_CODES = Object.freeze(
    OPUS_TRANSCRIBE_LANGUAGES.map(item => item.value)
);

export const OPUS_TRANSCRIBE_SPECS = Object.freeze([
    {
        id: "opus-transcribe-audio",
        name: "Opus Transcribe Audio & Subtitle",
        upstreamModel: "opus-transcribe",
        logo: "gemini.svg",
        description:
            "Transkripsi otomatis Audio (MP3/WAV/M4A/AAC/OGG/FLAC) & Video (MP4/MOV/WEBM) menjadi teks akurat lengkap dengan timestamp per kalimat, tombol Salin Teks, serta unduh file .TXT dan subtitle .SRT.",
        defaultCredit: DEFAULT_OPUS_TRANSCRIBE_CREDIT
    }
]);

export const OPUS_TRANSCRIBE_MODEL_IDS = Object.freeze(
    OPUS_TRANSCRIBE_SPECS.map(spec => spec.id)
);

export function isOpusTranscribeModelId(modelId) {
    const clean = String(modelId || "").trim().toLowerCase();
    return OPUS_TRANSCRIBE_MODEL_IDS.includes(clean);
}
