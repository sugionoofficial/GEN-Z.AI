/* =========================================================
   GEN-Z.AI
   MUSIC / LAGU AI — KATALOG PILIHAN SISTEM (CHECKBOX)
   ---------------------------------------------------------
   File:
     models/opus-audio/music-presets.js

   100% browser-safe ES module (tanpa node:*) karena dipakai
   oleh adapter model yang dimuat di browser maupun Worker.

   Tujuan:
   - Menggantikan textarea bebas "Deskripsi Musik / Lagu AI"
     dengan pilihan centang yang disusun sistem.
   - Memperluas cakupan deskripsi: genre, mood, instrumen,
     tempo, vokal, struktur, produksi, dan tema lirik.
   - Semua `text` adalah deskripsi MUSIKAL netral berbahasa
     Inggris (istilah yang dikenal Lyria 3.5), tanpa nama
     artis, judul lagu, merek, tokoh, atau kata bermuatan
     politik/kekerasan. Ini menurunkan risiko penolakan
     filter konten `prohibited_content` Google.

   Label ditampilkan dalam Bahasa Indonesia; yang dikirim ke
   provider adalah `text` yang aman.
   ========================================================= */

import { sanitizeLyriaMusicText } from "../../provider/opus/lyria-prompt-safety.js";

export const MUSIC_PRESET_GROUPS = Object.freeze([
    Object.freeze({
        id: "genre",
        label: "Genre & Gaya Musik",
        options: Object.freeze([
            { value: "pop", label: "Pop", text: "Contemporary pop" },
            { value: "pop_balada", label: "Pop Balada", text: "Emotional pop ballad" },
            { value: "indie_folk", label: "Indie Folk", text: "Indie folk acoustic" },
            { value: "rock_balada", label: "Rock Balada", text: "Soft rock ballad" },
            { value: "dangdut", label: "Dangdut", text: "Dangdut with kendang groove" },
            { value: "koplo", label: "Koplo", text: "Upbeat koplo rhythm" },
            { value: "keroncong", label: "Keroncong", text: "Keroncong-inspired acoustic" },
            { value: "rnb_soul", label: "R&B / Soul", text: "Warm R&B and soul" },
            { value: "jazz", label: "Jazz", text: "Smooth jazz" },
            { value: "lofi", label: "Lo-Fi Hip Hop", text: "Lo-fi chill hip hop" },
            { value: "edm", label: "EDM / Dance Pop", text: "Upbeat dance-pop" },
            { value: "hiphop", label: "Hip-Hop", text: "Boom-bap hip hop" },
            { value: "orkestra", label: "Orkestra Sinematik", text: "Cinematic orchestral score" },
            { value: "ambient", label: "Ambient", text: "Ambient cinematic pads" },
            { value: "reggae", label: "Reggae", text: "Laid-back reggae groove" },
            { value: "gospel_choir", label: "Gospel / Koir", text: "Gospel-inspired choir pop" }
        ])
    }),
    Object.freeze({
        id: "mood",
        label: "Suasana / Mood",
        options: Object.freeze([
            { value: "hangat", label: "Hangat", text: "warm and intimate mood" },
            { value: "ceria", label: "Ceria", text: "bright and cheerful mood" },
            { value: "reflektif", label: "Reflektif", text: "reflective and contemplative mood" },
            { value: "sendu", label: "Sendu", text: "gentle melancholic mood" },
            { value: "semangat", label: "Semangat", text: "uplifting and energetic mood" },
            { value: "tenang", label: "Tenang", text: "calm and peaceful mood" },
            { value: "epik", label: "Epik", text: "epic and triumphant mood" },
            { value: "nostalgik", label: "Nostalgik", text: "nostalgic mood" },
            { value: "romantis", label: "Romantis", text: "romantic and tender mood" },
            { value: "tegas", label: "Tegas & Berani", text: "confident and determined mood" },
            { value: "syahdu", label: "Syahdu", text: "serene and soulful mood" },
            { value: "groovy", label: "Groovy", text: "groovy and playful mood" },
            { value: "misterius", label: "Misterius", text: "mysterious atmosphere" },
            { value: "optimis", label: "Optimis", text: "hopeful and optimistic mood" }
        ])
    }),
    Object.freeze({
        id: "instrumen",
        label: "Instrumen & Tekstur",
        options: Object.freeze([
            { value: "gitar_akustik", label: "Gitar Akustik", text: "fingerstyle acoustic guitar" },
            { value: "gitar_elektrik", label: "Gitar Elektrik", text: "clean electric guitar" },
            { value: "piano", label: "Piano", text: "soft piano" },
            { value: "rhodes", label: "Rhodes Piano", text: "warm Rhodes piano" },
            { value: "strings", label: "String / Dawai", text: "string ensemble" },
            { value: "drum_akustik", label: "Drum Akustik", text: "acoustic drum kit" },
            { value: "bass", label: "Bass", text: "warm electric bass" },
            { value: "synth_pad", label: "Synth Pad", text: "analog synth pads" },
            { value: "kendang", label: "Kendang", text: "kendang percussion" },
            { value: "gamelan", label: "Gamelan", text: "gamelan-inspired metallophone" },
            { value: "suling", label: "Suling", text: "bamboo flute" },
            { value: "brass", label: "Brass", text: "brass section" },
            { value: "handclaps", label: "Tepuk Tangan", text: "handclaps" },
            { value: "choir", label: "Backing Choir", text: "backing choir" },
            { value: "vinyl", label: "Vinyl Crackle", text: "subtle vinyl crackle" },
            { value: "808", label: "808 Sub Bass", text: "808 sub bass" }
        ])
    }),
    Object.freeze({
        id: "tempo",
        label: "Tempo & Ritme",
        options: Object.freeze([
            { value: "lambat_60", label: "Lambat ±65 BPM", text: "slow tempo around 65 BPM" },
            { value: "lambat_75", label: "Lambat ±75 BPM", text: "slow tempo around 75 BPM" },
            { value: "sedang_88", label: "Sedang ±88 BPM", text: "mid-tempo around 88 BPM" },
            { value: "sedang_100", label: "Sedang ±100 BPM", text: "mid-tempo around 100 BPM" },
            { value: "cepat_120", label: "Cepat ±120 BPM", text: "upbeat tempo around 120 BPM" },
            { value: "cepat_128", label: "Cepat ±128 BPM", text: "driving tempo around 128 BPM" },
            { value: "sangat_cepat_140", label: "Sangat Cepat ±140 BPM", text: "fast tempo around 140 BPM" },
            { value: "ballad_free", label: "Rubato Balada", text: "rubato ballad feel" }
        ])
    }),
    Object.freeze({
        id: "vokal",
        label: "Karakter Vokal",
        options: Object.freeze([
            { value: "bariton", label: "Pria Bariton", text: "warm male baritone lead vocal" },
            { value: "tenor", label: "Pria Tenor", text: "bright male tenor lead vocal" },
            { value: "alto", label: "Wanita Alto", text: "warm female alto lead vocal" },
            { value: "sopran", label: "Wanita Sopran", text: "clear female soprano lead vocal" },
            { value: "lembut", label: "Lembut / Breathy", text: "soft breathy vocal delivery" },
            { value: "serak", label: "Bertekstur Serak", text: "gritty textured vocal" },
            { value: "energik", label: "Ekspresif & Energik", text: "energetic expressive vocal" },
            { value: "harmoni", label: "Harmoni Berlapis", text: "layered vocal harmonies" },
            { value: "duet", label: "Duet Pria–Wanita", text: "male-female duet vocals" },
            { value: "falseto", label: "Falseto", text: "gentle falsetto hooks" },
            { value: "rap", label: "Rap / Spoken Verse", text: "spoken rap verse" },
            { value: "a_cappella", label: "A Cappella", text: "a cappella passage" }
        ])
    }),
    Object.freeze({
        id: "struktur",
        label: "Struktur & Aransemen",
        options: Object.freeze([
            { value: "intro_pelan", label: "Intro Pelan", text: "quiet intro" },
            { value: "verse_chorus", label: "Verse–Chorus Jelas", text: "clear verse and chorus structure" },
            { value: "pre_chorus", label: "Pre-Chorus Menaik", text: "building pre-chorus" },
            { value: "bridge", label: "Bridge Kontras", text: "contrasting bridge" },
            { value: "outro_fade", label: "Outro Fade-Out", text: "gentle fade-out outro" },
            { value: "build_up", label: "Crescendo Bertahap", text: "gradual crescendo" },
            { value: "drop", label: "Chorus Full Band", text: "chorus lift with full band" },
            { value: "gitar_solo", label: "Solo Gitar Singkat", text: "short guitar solo" },
            { value: "reverb", label: "Reverb Luas", text: "spacious reverb" },
            { value: "minimalis", label: "Aransemen Minimalis", text: "sparse minimal arrangement" },
            { value: "full_band", label: "Full Band", text: "full band arrangement" },
            { value: "akustik_unplugged", label: "Unplugged", text: "unplugged acoustic arrangement" },
            { value: "crescendo_final", label: "Chorus Akhir Berlapis", text: "final chorus with added layers" },
            { value: "instrumental_break", label: "Jeda Instrumental", text: "short instrumental break" }
        ])
    }),
    Object.freeze({
        id: "produksi",
        label: "Produksi & Era",
        options: Object.freeze([
            { value: "studio_bersih", label: "Studio Modern Bersih", text: "clean modern studio production" },
            { value: "vintage_70s", label: "Analog 1970-an", text: "1970s analog warmth" },
            { value: "retro_80s", label: "Retro 1980-an", text: "1980s retro textures" },
            { value: "modern", label: "Mix Kontemporer", text: "contemporary polished mix" },
            { value: "lofi_tape", label: "Lo-Fi Tape", text: "lo-fi tape saturation" },
            { value: "live", label: "Nuansa Live Room", text: "live room feel" },
            { value: "sinematik", label: "Soundstage Sinematik", text: "wide cinematic soundstage" },
            { value: "radio", label: "Radio-Ready", text: "radio-ready mix" },
            { value: "intim", label: "Close-Mic Intim", text: "intimate dry close-mic sound" },
            { value: "wide_stereo", label: "Stereo Lebar", text: "wide stereo imaging" }
        ])
    }),
    Object.freeze({
        id: "tema",
        label: "Bahasa & Tema Lirik (Aman)",
        options: Object.freeze([
            { value: "id", label: "Lirik Bahasa Indonesia", text: "lyrics in Indonesian" },
            { value: "en", label: "Lirik Bahasa Inggris", text: "lyrics in English" },
            { value: "tema_alam", label: "Alam & Pagi", text: "lyrics about nature and morning light" },
            { value: "tema_perjalanan", label: "Perjalanan", text: "lyrics about a journey" },
            { value: "tema_persahabatan", label: "Persahabatan", text: "lyrics about friendship" },
            { value: "tema_harapan", label: "Harapan & Awal Baru", text: "lyrics about hope and new beginnings" },
            { value: "tema_keluarga", label: "Keluarga", text: "lyrics about family" },
            { value: "tema_kota", label: "Kehidupan Kota", text: "lyrics about city life" },
            { value: "tema_cinta", label: "Cinta", text: "lyrics about love" },
            { value: "tema_semangat", label: "Semangat & Tekun", text: "lyrics about perseverance" },
            { value: "tema_refleksi", label: "Renungan Tenang", text: "lyrics about quiet reflection" },
            { value: "tema_liburan", label: "Hari yang Santai", text: "lyrics about a carefree day" }
        ])
    })
]);

/** Peta value -> teks musikal aman (whitelist untuk API non-browser). */
export const MUSIC_PRESET_TEXT_BY_VALUE = Object.freeze(
    Object.fromEntries(
        MUSIC_PRESET_GROUPS.flatMap(group =>
            group.options.map(option => [option.value, option.text])
        )
    )
);

/** Pilihan bawaan yang aman, langsung tercentang saat form dibuka. */
export const MUSIC_PRESET_DEFAULT_VALUES = Object.freeze([
    "pop_balada",
    "hangat",
    "gitar_akustik",
    "piano",
    "sedang_88",
    "bariton",
    "verse_chorus",
    "studio_bersih",
    "id"
]);

export const MUSIC_PRESET_FALLBACK_TEXT =
    "Warm original pop ballad with fingerstyle acoustic guitar, soft piano, " +
    "mid-tempo around 88 BPM, clear lead vocal, clean studio production.";

/**
 * Susun deskripsi musik final dari pilihan centang.
 *
 * - `string`  : dipertahankan (kompatibel dengan klien API lama).
 * - `array`   : daftar `value` preset atau objek `{ value | text }`;
 *               nilai di luar whitelist DIABAIKAN (anti injeksi teks bebas).
 * - `object`  : `{ values: [...], note: "..." }` — catatan tambahan
 *               dibersihkan dari referensi artis/URL/karakter kontrol.
 */
export function composeMusicDescription(input, { fallback = MUSIC_PRESET_FALLBACK_TEXT } = {}) {
    let values = [];
    let note = "";

    if (typeof input === "string") {
        return input.trim();
    }

    if (Array.isArray(input)) {
        values = input;
    } else if (input && typeof input === "object") {
        values = Array.isArray(input.values) ? input.values : [];
        note = typeof input.note === "string" ? input.note : "";
    }

    const seen = new Set();
    const parts = [];

    for (const entry of values) {
        let text = "";
        if (typeof entry === "string") {
            text = MUSIC_PRESET_TEXT_BY_VALUE[entry] || "";
        } else if (entry && typeof entry === "object") {
            const value = String(entry.value || "").trim();
            text = MUSIC_PRESET_TEXT_BY_VALUE[value] || "";
        }
        const clean = String(text).trim();
        if (!clean || seen.has(clean)) continue;
        seen.add(clean);
        parts.push(clean);
    }

    const cleanNote = sanitizeLyriaMusicText(note, { stripArtistReferences: true })
        .replace(/\s*\n\s*/g, " ")
        .slice(0, 240)
        .trim();
    if (cleanNote) parts.push(cleanNote);

    return parts.length > 0 ? parts.join(", ") : String(fallback || "").trim();
}
