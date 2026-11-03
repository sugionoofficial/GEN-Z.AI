/* =========================================================
   GEN-Z.AI
   GOOGLE LYRIA 3.5 — PROMPT REFUSAL HANDLING
   ---------------------------------------------------------
   File:
     provider/opus/lyria-prompt-safety.js

   100% browser-safe ES module (tanpa node:*) karena diimpor
   juga oleh provider/opus/audio-tools.js yang dipakai di browser.

   Latar belakang:
   Google Lyria 3.5 (via Opus Egress Gateway) menolak prompt
   dengan HTTP 400 `The prompt could not be processed` /
   `prohibited_content` bila deskripsi atau lirik memuat nama
   artis/figur publik, judul lagu atau lirik lagu terkenal,
   merek, nama tokoh, atau kata yang tertangkap safety filter.
   Gateway menolak SEBELUM request mencapai provider, sehingga
   tidak ada biaya upstream dan refund kredit aman dilakukan.

   Modul ini menyediakan:
   - deteksi error penolakan prompt Lyria
   - pesan Indonesia yang actionable untuk pengguna
   - sanitasi konservatif untuk satu kali retry otomatis
   ========================================================= */

export const LYRIA_PROMPT_REFUSED_CODE = "LYRIA_PROMPT_REFUSED";

export const LYRIA_PROMPT_REFUSED_MESSAGE =
    "Prompt lagu ditolak filter konten Google Lyria 3.5 sebelum diproses (tidak ada biaya provider). " +
    "Hindari nama artis/penyanyi, judul atau lirik lagu terkenal, merek, nama tokoh/figur publik, " +
    "serta kata yang dianggap sensitif. Tulis ulang sebagai deskripsi suara: genre, instrumen, " +
    "tempo/BPM, suasana, dan karakter vokal. Sistem sudah mencoba satu kali dengan prompt yang " +
    "dibersihkan; silakan ubah deskripsi atau lirik lalu generate lagi.";

export const LYRIA_SAFE_FALLBACK_PROMPT =
    "Musik instrumental orisinal dengan melodi jernih, aransemen rapi, dan kualitas studio.";

const CONTROL_CHARS_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const URL_RE = /(?:https?:\/\/|www\.)\S+/gi;
const CONTACT_RE = /(?:\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b|(?<!\w)@[\w._-]{3,})/gi;

/* Frasa eksplisit yang meminta peniruan artis / lagu / tokoh tertentu.
   Bagian rujukan sengaja ditangkap longgar lalu divalidasi di JS agar
   kalimat biasa seperti "seperti pagi hari" tidak ikut terhapus. */
const ARTIST_REFERENCE_RE =
    /\b(?:mirip|seperti|ala|gaya|menyerupai|terinspirasi(?:\s+(?:dari|oleh))?|cover(?:\s+lagu)?|sound\s+like|sounds?\s+like|in\s+the\s+style\s+of|inspired\s+by|similar\s+to|recreate|remake|artis|penyanyi|band|grup|musisi|vokalis|lagu\s+karya|by)\s*:?\s*([^\n,.;!?]{2,60})/gi;

const SONG_TITLE_RE =
    /\b(?:lagu|song|track|single|album|judul)\s*(["“”'«»][^"“”'«»\n]{1,80}["“”'«»])/gi;

const QUOTED_REFERENCE_RE = /^["“”'«»]/;
const PROPER_NAME_RE = /^\p{Lu}/u;

function looksLikeProtectedReference(reference) {
    const clean = String(reference || "").trim();
    if (!clean) return false;
    if (QUOTED_REFERENCE_RE.test(clean)) return true;
    return PROPER_NAME_RE.test(clean);
}

/**
 * Bersihkan teks musik dari pemicu umum filter konten Lyria.
 *
 * - Selalu: karakter kontrol, URL, email, handle, spasi berlebih.
 * - `stripArtistReferences` (default true, untuk deskripsi gaya):
 *   netralisasi frasa "mirip/seperti/ala <NamaArtis>" dan judul lagu
 *   dalam tanda kutip. Rujukan lowercase biasa dipertahankan.
 * - Untuk LIRIK, pakai `stripArtistReferences: false` agar baris
 *   puitis tidak ikut terpotong; struktur [Verse]/[Chorus] dijaga.
 */
export function sanitizeLyriaMusicText(rawText, { stripArtistReferences = true } = {}) {
    let text = String(rawText || "")
        .replace(/\r\n?/g, "\n")
        .replace(CONTROL_CHARS_RE, " ")
        .replace(/\u00A0/g, " ");

    if (!text.trim()) return "";

    text = text
        .replace(URL_RE, " ")
        .replace(CONTACT_RE, " ");

    if (stripArtistReferences) {
        text = text.replace(ARTIST_REFERENCE_RE, (match, reference) =>
            looksLikeProtectedReference(reference)
                ? " dengan warna musik orisinal "
                : match
        );
        text = text.replace(SONG_TITLE_RE, (_match, quotedTitle) =>
            looksLikeProtectedReference(quotedTitle) ? " lagu orisinal " : _match
        );
    }

    return text
        .split("\n")
        .map(line => line.replace(/[ \t]{2,}/g, " ").trimEnd())
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

/** Deteksi penolakan prompt Lyria dari error provider / gateway Opus. */
export function isLyriaPromptRefusedError(error) {
    if (!error) return false;
    if (typeof error === "object" && error?.code === LYRIA_PROMPT_REFUSED_CODE) return true;

    const message = typeof error === "string"
        ? error
        : String(error?.message || error?.error || error?.errorMessage || "");
    if (!message) return false;

    return /lyria\s+interaction\s+error/i.test(message)
        || /prompt\s+could\s+not\s+be\s+processed/i.test(message)
        || /prompt\s+could\s+not\s+be\s+submitted/i.test(message)
        || /prohibited_content/i.test(message)
        || /contains\s+sensitive\s+words/i.test(message)
        || /rejected\s+by\s+the\s+safety\s+system/i.test(message)
        || (/rephras(?:e|ing)\s+the\s+prompt/i.test(message) && /lyria|music|prompt/i.test(message));
}
