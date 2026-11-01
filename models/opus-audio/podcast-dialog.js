/* =========================================================
   GEN-Z.AI
   OPUS AUDIO PODCAST — 2-SPEAKER DIALOG SCRIPT PARSER
   ---------------------------------------------------------
   File:
     models/opus-audio/podcast-dialog.js

   Browser-safe & Cloudflare Worker-safe pure ESM helper
   (TANPA import `node:*` atau `lib/**`).
   Mengurai naskah dialog 2 pembicara (Pembicara A & B) menjadi
   urutan giliran bicara (`turns`) untuk Opus Speech TTS.
========================================================= */

export const MAX_PODCAST_TURNS = 12;
export const MAX_PODCAST_SCRIPT_CHARS = 5000;
export const MIN_PODCAST_TURNS = 2;

const EXPLICIT_SPEAKER_A_ALIASES = new Set([
    "a",
    "1",
    "speaker 1",
    "speaker a",
    "pembicara 1",
    "pembicara a",
    "suara 1",
    "suara a",
    "host",
    "host 1",
    "presenter",
    "anchor"
]);

const EXPLICIT_SPEAKER_B_ALIASES = new Set([
    "b",
    "2",
    "speaker 2",
    "speaker b",
    "pembicara 2",
    "pembicara b",
    "suara 2",
    "suara b",
    "tamu",
    "guest",
    "narasumber",
    "co-host",
    "cohost",
    "host 2"
]);

const LINE_SPEAKER_REGEX = /^\s*(?:\[\s*([^\]\n]{1,32})\s*\]\s*:?\s*|([A-Za-z0-9][A-Za-z0-9 _.-]{0,28})\s*:\s*)(.*)$/;

function normalizeSpeakerTagKey(rawLabel) {
    return String(rawLabel || "")
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase();
}

/**
 * Mengurai teks naskah podcast menjadi daftar giliran dialog A/B.
 *
 * Contoh format yang didukung:
 *   A: Halo semuanya, selamat datang di podcast hari ini!
 *   B: Halo! Senang sekali bisa ngobrol bareng di episode kali ini.
 *
 *   Host: Bagaimana pendapat kamu soal AI video terbaru?
 *   Tamu: Perkembangannya luar biasa cepat tahun ini.
 */
export function parsePodcastDialogScript(rawScript, options = {}) {
    const voiceA = String(options.voiceA || "Aoede").trim() || "Aoede";
    const voiceB = String(options.voiceB || "Orus").trim() || "Orus";
    const styleA = String(options.styleA || "").trim();
    const styleB = String(options.styleB || "").trim();

    const cleanScript = String(rawScript || "")
        .replace(/\r\n/g, "\n")
        .trim();

    if (!cleanScript) {
        return {
            valid: false,
            error: "Naskah dialog podcast wajib diisi (gunakan format A: ... dan B: ...).",
            turns: []
        };
    }

    if (cleanScript.length > MAX_PODCAST_SCRIPT_CHARS) {
        return {
            valid: false,
            error: `Naskah dialog podcast maksimal ${MAX_PODCAST_SCRIPT_CHARS} karakter.`,
            turns: []
        };
    }

    const lines = cleanScript.split("\n");
    const customSpeakerMap = new Map();
    const rawTurns = [];
    let sawExplicitPrefix = false;

    const resolveSpeakerSlot = rawTag => {
        const key = normalizeSpeakerTagKey(rawTag);
        if (!key) return null;
        if (EXPLICIT_SPEAKER_A_ALIASES.has(key)) return "A";
        if (EXPLICIT_SPEAKER_B_ALIASES.has(key)) return "B";

        /* Abaikan tag ekspresi TTS inline seperti [laugh], [sigh], [pause], [whisper] */
        if (
            /^(?:laugh|laughs|sigh|sighs|whisper|whispers|pause|short pause|long pause|clear throat|gasp|chuckle|excited|sad|calm|cheerful|serious)$/i.test(
                key
            )
        ) {
            return null;
        }

        if (customSpeakerMap.has(key)) {
            return customSpeakerMap.get(key);
        }
        if (customSpeakerMap.size === 0) {
            customSpeakerMap.set(key, "A");
            return "A";
        }
        if (customSpeakerMap.size === 1) {
            customSpeakerMap.set(key, "B");
            return "B";
        }
        return null;
    };

    for (const rawLine of lines) {
        const trimmedLine = rawLine.trim();
        if (!trimmedLine) continue;

        const match = LINE_SPEAKER_REGEX.exec(trimmedLine);
        if (match) {
            const candidateLabel = (match[1] || match[2] || "").trim();
            const remainder = String(match[3] || "").trim();
            /* Hindari URL (https:...) dianggap sebagai label pembicara */
            const isUrlScheme = /^(?:https?|supabase-private|data)$/i.test(candidateLabel);
            const slot = !isUrlScheme ? resolveSpeakerSlot(candidateLabel) : null;
            if (slot) {
                sawExplicitPrefix = true;
                if (remainder) {
                    const prev = rawTurns.length > 0 ? rawTurns[rawTurns.length - 1] : null;
                    if (prev && prev.speaker === slot) {
                        prev.text = `${prev.text} ${remainder}`.trim();
                    } else {
                        rawTurns.push({
                            speaker: slot,
                            speakerLabel: candidateLabel,
                            text: remainder
                        });
                    }
                } else {
                    rawTurns.push({
                        speaker: slot,
                        speakerLabel: candidateLabel,
                        text: ""
                    });
                }
                continue;
            }
        }

        if (rawTurns.length > 0) {
            const last = rawTurns[rawTurns.length - 1];
            last.text = last.text ? `${last.text} ${trimmedLine}` : trimmedLine;
        } else {
            rawTurns.push({
                speaker: "A",
                speakerLabel: "A",
                text: trimmedLine
            });
        }
    }

    let normalizedTurns = rawTurns
        .map(item => ({
            speaker: item.speaker === "B" ? "B" : "A",
            speakerLabel: item.speakerLabel || item.speaker,
            text: String(item.text || "").trim()
        }))
        .filter(item => item.text.length > 0);

    /* Fallback ramah pengguna: jika tanpa label A:/B: tapi ada beberapa paragraf terpisah baris kosong */
    if (!sawExplicitPrefix) {
        const paragraphs = cleanScript
            .split(/\n\s*\n+/)
            .map(p => p.replace(/\s+/g, " ").trim())
            .filter(Boolean);
        if (paragraphs.length >= 2) {
            normalizedTurns = paragraphs.map((p, idx) => ({
                speaker: idx % 2 === 0 ? "A" : "B",
                speakerLabel: idx % 2 === 0 ? "A" : "B",
                text: p
            }));
        }
    }

    if (normalizedTurns.length < MIN_PODCAST_TURNS) {
        return {
            valid: false,
            error:
                "Naskah dialog podcast membutuhkan minimal 2 giliran bicara (contoh baris 'A: Halo...' lalu baris 'B: Hai...').",
            turns: []
        };
    }

    if (normalizedTurns.length > MAX_PODCAST_TURNS) {
        return {
            valid: false,
            error: `Maksimal ${MAX_PODCAST_TURNS} giliran dialog per 1x generate podcast agar penggabungan suara tetap cepat & stabil.`,
            turns: []
        };
    }

    const turns = normalizedTurns.map((item, idx) => {
        const isB = item.speaker === "B";
        return {
            index: idx + 1,
            speaker: isB ? "B" : "A",
            speakerLabel: item.speakerLabel || (isB ? "B" : "A"),
            voice: isB ? voiceB : voiceA,
            style: isB ? styleB : styleA,
            text: item.text
        };
    });

    return {
        valid: true,
        error: null,
        turns
    };
}
