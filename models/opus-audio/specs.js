/* =========================================================
   GEN-Z.AI
   OPUS LABS AUDIO MODELS — SPECIFICATION CATALOG
   ---------------------------------------------------------
   File:
     models/opus-audio/specs.js

   Daftar model generate audio di ekosistem Opus Labs MCP
   (`generate_audio`):
   1. Opus Voiceover & TTS (`opus-audio-speech`) — 30 karakter
      suara prebuilt resmi Opus (Gemini 3.8 Flash TTS) + arahan
      gaya bicara (`style`), auto-detect bahasa (ID/EN/multi),
      mendukung tag ekspresi `<laugh>`, `<sigh>`, `<short pause>`.
   2. Opus Music / Lagu AI (`opus-audio-music`) — Lyria 3.5
      untuk musik instrumental maupun lagu bervokal dengan lirik.
   3. Opus Sound Effects / SFX (`opus-audio-sfx`) — Efek suara
      sinematik, transisi, foley, dan ambience berdurasi kustom.

   Tarif default flat 500 kredit (dapat diedit melalui
   admin-control/model-edit.html pada kolom credit_480p).
========================================================= */

export const DEFAULT_OPUS_AUDIO_CREDIT = 500;
export const DEFAULT_OPUS_PODCAST_CREDIT = 1000;
export const MAX_SPEECH_WEIGHTED_LENGTH = 6000;
export const MAX_SPEECH_STYLE_LENGTH = 500;
export const MAX_MUSIC_PROMPT_LENGTH = 4000;
export const MAX_MUSIC_LYRICS_LENGTH = 3000;
export const MAX_SFX_PROMPT_LENGTH = 1500;

export const OPUS_SPEECH_VOICES = Object.freeze([
    { value: "Sulafat", label: "Sulafat — Hangat, Jernih & Ramah (Narator Rekomendasi)" },
    { value: "Achird", label: "Achird — Bersahabat, Ceria & Komunikatif" },
    { value: "Aoede", label: "Aoede — Santai, Natural & Percakapan" },
    { value: "Autonoe", label: "Autonoe — Cerah, Ekspresif & Energik" },
    { value: "Callirrhoe", label: "Callirrhoe — Tenang, Rileks & Mengalir" },
    { value: "Charon", label: "Charon — Informatif, Wibawa & Dokumenter" },
    { value: "Despina", label: "Despina — Halus, Elegan & Komersial / Iklan" },
    { value: "Enceladus", label: "Enceladus — Lembut, Intim & Sinematik" },
    { value: "Erinome", label: "Erinome — Artikulasi Tajam & Profesional" },
    { value: "Fenrir", label: "Fenrir — Dinamis, Antusias & Berani" },
    { value: "Gacrux", label: "Gacrux — Dewasa, Mantap & Stabil" },
    { value: "Iapetus", label: "Iapetus — Suara Dalam, Jelas & Percaya Diri" },
    { value: "Kore", label: "Kore — Tegas, Lugas & Meyakinkan" },
    { value: "Laomedeia", label: "Laomedeia — Semangat, Hidup & Menyenangkan" },
    { value: "Leda", label: "Leda — Muda, Segar & Modern" },
    { value: "Orus", label: "Orus — Kuat, Beresonansi & Tegas" },
    { value: "Puck", label: "Puck — Playful, Gesit & Penuh Energi" },
    { value: "Pulcherrima", label: "Pulcherrima — Fokus, Menarik & Jelas" },
    { value: "Rasalgethi", label: "Rasalgethi — Edukatif, Teduh & Terstruktur" },
    { value: "Sadachbia", label: "Sadachbia — Ekspresif, Hidup & Bercerita" },
    { value: "Sadaltager", label: "Sadaltager — Berwibawa, Tenang & Terpercaya" },
    { value: "Schedar", label: "Schedar — Seimbang, Netral & Berita" },
    { value: "Umbriel", label: "Umbriel — Hangat, Akrab & Podcast" },
    { value: "Vindemiatrix", label: "Vindemiatrix — Lembut, Menenangkan & Storytelling" },
    { value: "Zephyr", label: "Zephyr — Ringan, Cerah & Kontemporer" },
    { value: "Zubenelgenubi", label: "Zubenelgenubi — Kasual, Alami & Sehari-hari" },
    { value: "Achernar", label: "Achernar — Halus, Hangat & Empatik" },
    { value: "Algenib", label: "Algenib — Bertekstur Serak & Sinematik" },
    { value: "Algieba", label: "Algieba — Velvety, Mewah & Berkelas" },
    { value: "Alnilam", label: "Alnilam — Kokoh, Konsisten & Broadcast" }
]);

export const OPUS_SPEECH_VOICE_IDS = Object.freeze(
    OPUS_SPEECH_VOICES.map(item => item.value)
);

export const OPUS_MUSIC_VOCAL_MODES = Object.freeze([
    { value: "instrumental", label: "Instrumental Saja (Tanpa Vokal)" },
    { value: "vocal", label: "Dengan Vokal / Lirik Lagu" }
]);

export const OPUS_MUSIC_DURATIONS = Object.freeze([
    { value: "15", label: "15 Detik (Intro / Bumper)" },
    { value: "30", label: "30 Detik (Shorts / Reels / TikTok)" },
    { value: "60", label: "60 Detik (1 Menit)" },
    { value: "120", label: "120 Detik (2 Menit Lagu Penuh)" }
]);

export const OPUS_SFX_DURATIONS = Object.freeze([
    { value: "2", label: "2 Detik (UI / Transisi Singkat)" },
    { value: "5", label: "5 Detik (Standar Sound Effect)" },
    { value: "10", label: "10 Detik (Foley / Ambience Pendek)" },
    { value: "15", label: "15 Detik (Ambience Panjang)" }
]);

/**
 * Menghitung panjang berbobot naskah TTS sesuai aturan Opus Speech:
 * karakter CJK dihitung 3x, karakter lainnya 1x (maks 6.000).
 */
export function computeSpeechWeightedLength(text) {
    const clean = String(text || "");
    if (!clean) return 0;
    let total = 0;
    for (const ch of clean) {
        const code = ch.codePointAt(0) || 0;
        const isCjk =
            (code >= 0x3040 && code <= 0x30ff) ||
            (code >= 0x3400 && code <= 0x4dbf) ||
            (code >= 0x4e00 && code <= 0x9fff) ||
            (code >= 0xac00 && code <= 0xd7af) ||
            (code >= 0xf900 && code <= 0xfaff);
        total += isCjk ? 3 : 1;
    }
    return total;
}

export const OPUS_AUDIO_SPECS = Object.freeze([
    {
        id: "opus-audio-speech",
        name: "Opus Voiceover & TTS",
        audioKind: "speech",
        upstreamModel: "gemini-3.8-flash-tts",
        modelAliases: [
            "gemini-3.8-flash-tts",
            "google/gemini-3.8-flash-tts",
            "seed-audio-1.0",
            "gemini-2.5-flash-preview-tts",
            "gemini-tts",
            "speech"
        ],
        logo: "gemini.svg",
        description:
            "Text-to-Speech & Voiceover studio dengan 30 karakter suara ekspresif, deteksi bahasa otomatis (Indonesia, Inggris, dll.), arahan gaya bicara, serta tag ekspresi (<laugh>, <sigh>, <short pause>).",
        defaultCredit: DEFAULT_OPUS_AUDIO_CREDIT
    },
    {
        id: "opus-audio-music",
        name: "Opus Music / Lagu AI (Lyria 3.5)",
        audioKind: "music",
        upstreamModel: "lyria-3.5",
        modelAliases: [
            "lyria-3.5",
            "lyria-3-pro-preview",
            "lyria-3-pro",
            "lyria-3-clip-preview",
            "lyria-3",
            "google/lyria-3.5",
            "google/lyria-3-pro-preview",
            "elevenlabs-music",
            "minimax-music",
            "music",
            "lyria-2"
        ],
        logo: "gemini.svg",
        description:
            "Generator musik & lagu orisinal berbasis Google Lyria 3.5 untuk BGM instrumental sinematik maupun lagu penuh dengan vokal dan lirik kustom.",
        defaultCredit: DEFAULT_OPUS_AUDIO_CREDIT
    },
    {
        id: "opus-audio-sfx",
        name: "Opus Sound Effects (SFX)",
        audioKind: "sfx",
        upstreamModel: "opus-sfx",
        modelAliases: [
            "opus-sfx",
            "sfx",
            "sound-effects",
            "sound_effect"
        ],
        logo: "gemini.svg",
        description:
            "Generator efek suara (Sound Effects / Foley / Ambience) presisi tinggi untuk kebutuhan editing video, transisi sinematik, game, dan podcast.",
        defaultCredit: DEFAULT_OPUS_AUDIO_CREDIT
    },
    {
        id: "opus-audio-podcast",
        name: "Opus Podcast / Dialog 2 Suara",
        audioKind: "podcast",
        upstreamModel: "gemini-3.8-flash-tts",
        modelAliases: [
            "gemini-3.8-flash-tts",
            "google/gemini-3.8-flash-tts",
            "podcast",
            "speech"
        ],
        logo: "gemini.svg",
        description:
            "Studio podcast & dialog percakapan 2 karakter suara berbeda (Pembicara A & Pembicara B) yang otomatis digabungkan menjadi 1 file audio utuh siap tayang.",
        defaultCredit: DEFAULT_OPUS_PODCAST_CREDIT
    }
]);

export const OPUS_AUDIO_MODEL_IDS = Object.freeze(
    OPUS_AUDIO_SPECS.map(spec => spec.id)
);

export function isOpusAudioModelId(modelId) {
    const clean = String(modelId || "").trim().toLowerCase();
    return OPUS_AUDIO_MODEL_IDS.includes(clean);
}
