import { SOCIAL_AUTO_NEGATIVE_PROMPT, cleanSongTitleForCaption } from "./utils.js";

export const SOCIAL_POST_MODES = Object.freeze(["character", "quote"]);
export const QUOTE_PUBLISH_TARGETS = Object.freeze(["feed", "reels", "story", "feed_story"]);

export function normalizeSocialPostMode(value, fallback = "character") {
    if (value === undefined || value === null || String(value).trim() === "") {
        return fallback;
    }
    const normalized = String(value).trim().toLowerCase();
    return SOCIAL_POST_MODES.includes(normalized) ? normalized : null;
}

export function normalizeQuotePublishTarget(value, fallback = "feed") {
    if (value === undefined || value === null || String(value).trim() === "") {
        return fallback;
    }
    const normalized = String(value).trim().toLowerCase();
    return QUOTE_PUBLISH_TARGETS.includes(normalized) ? normalized : fallback;
}

const QUOTE_THEME_LIBRARY = [
    {
        id: "motivasi",
        label: "Motivasi & Semangat Hidup",
        direction: "bangkit dari lelah, percaya pada proses kecil setiap hari, disiplin, dan keberanian melangkah meski belum sempurna"
    },
    {
        id: "kehidupan",
        label: "Refleksi Kehidupan & Kedewasaan",
        direction: "ketenangan batin, berdamai dengan masa lalu, menerima hal di luar kendali, dan bertumbuh menjadi pribadi yang lebih bijak"
    },
    {
        id: "rezeki",
        label: "Rezeki, Doa & Kerja Keras",
        direction: "rasa syukur atas kecukupan hari ini, ikhtiar yang jujur, kesabaran menjemput rezeki, dan keyakinan bahwa usaha tidak mengkhianati waktu"
    },
    {
        id: "cinta",
        label: "Cinta, Ketulusan & Hubungan",
        direction: "ketulusan menjaga hati, cinta yang menenangkan bukan merumitkan, saling menghargai dalam hal-hal sederhana"
    },
    {
        id: "islami",
        label: "Hikmah, Syukur & Pengingat Kebaikan",
        direction: "prasangka baik pada ketetapan Tuhan, kekuatan doa dalam diam, kesabaran menghadapi ujian, dan hati yang lapang"
    },
    {
        id: "senja",
        label: "Tenang, Senja & Penyembuhan Diri",
        direction: "memberi jeda untuk diri sendiri, melepaskan beban pikiran di penghujung hari, dan pulih perlahan tanpa terburu-buru"
    },
    {
        id: "sukses",
        label: "Mindset Bertumbuh & Fokus Tujuan",
        direction: "konsistensi mengalahkan keraguan, fokus pada kemajuan diri sendiri tanpa membandingkan hidup dengan orang lain"
    },
    {
        id: "persahabatan",
        label: "Keluarga & Orang-Orang Tulus",
        direction: "kehangatan rumah, menghargai hadirnya keluarga dan sahabat sejati yang tetap tinggal di musim sulit maupun bahagia"
    }
];

const QUOTE_VISUAL_LIBRARY = [
    {
        label: "Senja keemasan di tepi pantai tenang",
        prompt: "a serene golden-hour sunset over calm ocean waves with warm amber reflections on wet sand, wide tranquil horizon, poetic minimalist landscape photography"
    },
    {
        label: "Secangkir kopi hangat di jendela saat hujan",
        prompt: "a warm ceramic cup of coffee resting on a wooden sill beside a rain-streaked glass window with soft golden city bokeh outside, cozy moody still-life photography"
    },
    {
        label: "Kabut pagi di perbukitan dan pegunungan hijau",
        prompt: "misty mountain ridges at dawn with soft pastel sunrise light filtering through pine trees, peaceful atmospheric landscape photography"
    },
    {
        label: "Jalan kota tenang selepas hujan malam",
        prompt: "a quiet rain-washed cobblestone street at night with warm amber streetlights reflecting softly on wet pavement, cinematic shallow depth of field, empty peaceful scene"
    },
    {
        label: "Padang bunga liar di bawah cahaya sore",
        prompt: "a gentle wildflower meadow swaying under warm late-afternoon sunlight with creamy natural bokeh and soft golden haze, editorial nature photography"
    },
    {
        label: "Meja kayu minimalis dengan buku terbuka & cahaya pagi",
        prompt: "a minimalist warm oak desk with an open linen journal, dried baby's breath flowers, and soft morning window sunlight casting delicate shadows"
    },
    {
        label: "Langit malam berbintang di atas danau hening",
        prompt: "a tranquil starry night sky reflected on a crystal-still mountain lake in deep twilight blue and silver tones, calm contemplative nature photography"
    },
    {
        label: "Taman teduh dengan dedaunan musim gugur",
        prompt: "a quiet garden pathway covered with warm autumn leaves and soft morning mist, diffused natural light, serene poetic composition"
    },
    {
        label: "Lautan awan lembut saat fajar menyingsing",
        prompt: "an airy sea of soft clouds at daybreak in gentle peach, ivory, and muted lavender tones, minimalist atmospheric sky photography"
    },
    {
        label: "Dinding minimalis estetik dengan bayangan dedaunan",
        prompt: "a clean textured warm-beige minimalist wall illuminated by golden afternoon sunlight casting organic leaf shadows, calm editorial aesthetic"
    }
];

export const QUOTE_PRESETS = Object.freeze({
    themes: Object.freeze(QUOTE_THEME_LIBRARY.map(item => Object.freeze({
        value: item.id,
        label: item.label
    }))),
    visualStyles: Object.freeze(QUOTE_VISUAL_LIBRARY.map(item => Object.freeze({
        value: item.prompt,
        label: item.label
    })))
});

/* Negative prompt untuk opsi latar + foto karakter. Teks tetap dilarang,
   tetapi larangan "person/people/human face" DIBUANG supaya model tidak
   menghapus karakter yang memang diminta pengguna. */
export const SOCIAL_QUOTE_CHARACTER_NEGATIVE_PROMPT = [
    SOCIAL_AUTO_NEGATIVE_PROMPT,
    "text",
    "words",
    "letters",
    "alphabet",
    "typography",
    "quote text",
    "caption",
    "subtitle",
    "numbers",
    "cluttered layout",
    "crowded background",
    "neon cyber colors"
].join(", ");

export const SOCIAL_QUOTE_NEGATIVE_PROMPT = [
    SOCIAL_AUTO_NEGATIVE_PROMPT,
    "text",
    "words",
    "letters",
    "alphabet",
    "typography",
    "quote text",
    "caption",
    "subtitle",
    "numbers",
    "logo",
    "watermark",
    "signature",
    "person",
    "people",
    "human face",
    "portrait",
    "man",
    "woman",
    "crowd",
    "silhouette of person",
    "hands",
    "cluttered layout",
    "neon cyber colors"
].join(", ");

export const FALLBACK_QUOTES = Object.freeze([
    { theme: "motivasi", text: "Pelan tidak apa-apa, asal langkahmu hari ini tetap lebih jujur dan lebih maju dari kemarin." },
    { theme: "motivasi", text: "Tidak semua proses harus terlihat hebat hari ini; akar yang kuat selalu tumbuh dalam diam." },
    { theme: "motivasi", text: "Saat lelah datang, istirahatlah sejenak, bukan menyerah pada mimpi yang sudah sejauh ini kau perjuangkan." },
    { theme: "motivasi", text: "Keberanian paling tenang adalah tetap mencoba lagi esok pagi meski kemarin sempat ragu." },
    { theme: "kehidupan", text: "Hidup terasa lebih ringan ketika kita berhenti memaksa semua hal berjalan persis seperti rencana kita." },
    { theme: "kehidupan", text: "Kedewasaan bukan tentang tidak pernah kecewa, melainkan tahu cara menenangkan hati sendiri setelahnya." },
    { theme: "kehidupan", text: "Ada hal-hal yang memang tidak ditakdirkan untuk tinggal, hanya singgah agar kita belajar menghargai diri." },
    { theme: "kehidupan", text: "Tidak perlu buru-buru membuktikan apa pun kepada dunia; ketenanganmu jauh lebih berharga daripada tepuk tangan sesaat." },
    { theme: "rezeki", text: "Rezeki yang paling menenangkan bukan yang paling cepat datang, melainkan yang hadir bersama hati yang tahu bersyukur." },
    { theme: "rezeki", text: "Apa yang sudah menjadi bagianmu tidak akan salah alamat; tugasmu hari ini hanyalah menjaga ikhtiar tetap bersih." },
    { theme: "rezeki", text: "Kerja keras yang ditemani doa tidak pernah sia-sia; ia sedang menyiapkan waktu terbaik untuk berbuah." },
    { theme: "rezeki", text: "Cukupkan hatimu dengan syukur, maka hal sederhana hari ini pun terasa begitu lapang." },
    { theme: "cinta", text: "Cinta yang dewasa tidak membuatmu menebak-nebak setiap hari; ia hadir sebagai tempat paling tenang untuk pulang." },
    { theme: "cinta", text: "Ketulusan tidak pernah berisik, ia tampak dari cara seseorang tetap menjaga hatimu bahkan dari hal kecil." },
    { theme: "cinta", text: "Pilihlah hati yang mau diajak bertumbuh bersama, bukan hanya yang manis di awal cerita." },
    { theme: "cinta", text: "Menghargai seseorang saat semuanya biasa saja adalah bentuk kasih sayang yang paling jujur." },
    { theme: "islami", text: "Ketika doamu belum dijawab seperti keinginanmu, percayalah Tuhan sedang menyiapkan yang lebih baik bagi hatimu." },
    { theme: "islami", text: "Hati yang berprasangka baik pada takdir tidak pernah benar-benar kehilangan arah, meski jalan terasa mendaki." },
    { theme: "islami", text: "Sabar bukan berarti diam tanpa usaha, melainkan menjaga hati tetap teduh sambil terus memperbaiki ikhtiar." },
    { theme: "islami", text: "Perbanyak syukur dalam hal kecil, sebab dari sanalah ketenangan besar perlahan ditumbuhkan." },
    { theme: "senja", text: "Seperti senja yang menutup hari dengan lembut, lepaskanlah beban yang tidak perlu kau bawa hingga esok." },
    { theme: "senja", text: "Beri dirimu izin untuk bernapas pelan sore ini; tidak semua hal harus selesai dalam satu hari." },
    { theme: "senja", text: "Pulih tidak harus sekaligus; mampu melewati hari ini dengan hati yang utuh pun sudah sebuah kemenangan." },
    { theme: "senja", text: "Di antara sibuknya dunia, sempatkan duduk tenang dan berterima kasih pada dirimu yang tetap bertahan." },
    { theme: "sukses", text: "Konsistensi kecil yang kau jaga setiap hari akan mengalahkan niat besar yang terus ditunda." },
    { theme: "sukses", text: "Fokuslah menumbuhkan kebunmu sendiri; bunga setiap orang punya musim mekarnya masing-masing." },
    { theme: "sukses", text: "Disiplin adalah jembatan sunyi antara harapan yang kau tulis dan kenyataan yang kelak kau syukuri." },
    { theme: "sukses", text: "Jangan takut memulai dari kecil, karena setiap pencapaian besar pernah menjadi langkah pertama yang sederhana." },
    { theme: "persahabatan", text: "Orang-orang yang tulus tidak datang untuk menghakimi badai hidupmu, mereka duduk menemani sampai langit kembali reda." },
    { theme: "persahabatan", text: "Kekayaan paling hangat dalam hidup adalah memiliki keluarga dan sahabat yang mendoakanmu tanpa diminta." },
    { theme: "persahabatan", text: "Jaga baik-baik mereka yang tetap lembut kepadamu bahkan saat kau sedang tidak punya apa-apa untuk dibanggakan." },
    { theme: "persahabatan", text: "Kebersamaan sederhana dengan orang yang tepat selalu sanggup menyembuhkan lelah yang panjang." }
]);

/**
 * Katalog musik instrumental bawaan siap putar (AAC .m4a 15 detik) untuk
 * Cerita (Video Story) Facebook sehingga langsung auto-play tanpa perlu link.
 * User juga dapat mengunggah lagu sendiri (.mp3 / .m4a / .aac / video .mp4 FB).
 */
export const BUILTIN_STORY_SONGS = Object.freeze([
    Object.freeze({
        id: "default-fb-song-1",
        builtin_slug: "senja-akustik",
        title: "Senja Akustik Hangat",
        artist: "Studio Instrumental",
        mood: "Tenang & Senja",
        audio_object_key: "builtin:senja-akustik",
        audio_mime_type: "audio/mp4",
        asset_path: "/assets/audio/story-music/senja-akustik.m4a",
        duration_seconds: 15,
        facebook_url: ""
    }),
    Object.freeze({
        id: "default-fb-song-2",
        builtin_slug: "piano-refleksi",
        title: "Piano Refleksi Malam",
        artist: "Studio Instrumental",
        mood: "Refleksi & Syukur",
        audio_object_key: "builtin:piano-refleksi",
        audio_mime_type: "audio/mp4",
        asset_path: "/assets/audio/story-music/piano-refleksi.m4a",
        duration_seconds: 15,
        facebook_url: ""
    }),
    Object.freeze({
        id: "default-fb-song-3",
        builtin_slug: "pagi-harapan",
        title: "Cahaya Pagi & Harapan",
        artist: "Studio Instrumental",
        mood: "Motivasi & Semangat",
        audio_object_key: "builtin:pagi-harapan",
        audio_mime_type: "audio/mp4",
        asset_path: "/assets/audio/story-music/pagi-harapan.m4a",
        duration_seconds: 15,
        facebook_url: ""
    }),
    Object.freeze({
        id: "default-fb-song-4",
        builtin_slug: "hujan-kopi",
        title: "Rintik Hujan & Kopi",
        artist: "Studio Instrumental",
        mood: "Teduh & Santai",
        audio_object_key: "builtin:hujan-kopi",
        audio_mime_type: "audio/mp4",
        asset_path: "/assets/audio/story-music/hujan-kopi.m4a",
        duration_seconds: 15,
        facebook_url: ""
    }),
    Object.freeze({
        id: "default-fb-song-5",
        builtin_slug: "langkah-tenang",
        title: "Langkah Tenang",
        artist: "Studio Instrumental",
        mood: "Penyembuhan Diri",
        audio_object_key: "builtin:langkah-tenang",
        audio_mime_type: "audio/mp4",
        asset_path: "/assets/audio/story-music/langkah-tenang.m4a",
        duration_seconds: 15,
        facebook_url: ""
    }),
    Object.freeze({
        id: "default-fb-song-6",
        builtin_slug: "doa-hening",
        title: "Doa dalam Hening",
        artist: "Studio Instrumental",
        mood: "Doa & Keikhlasan",
        audio_object_key: "builtin:doa-hening",
        audio_mime_type: "audio/mp4",
        asset_path: "/assets/audio/story-music/doa-hening.m4a",
        duration_seconds: 15,
        facebook_url: ""
    }),
    Object.freeze({
        id: "default-fb-song-7",
        builtin_slug: "semangat-baru",
        title: "Semangat Melangkah",
        artist: "Studio Instrumental",
        mood: "Fokus & Perjuangan",
        audio_object_key: "builtin:semangat-baru",
        audio_mime_type: "audio/mp4",
        asset_path: "/assets/audio/story-music/semangat-baru.m4a",
        duration_seconds: 15,
        facebook_url: ""
    }),
    Object.freeze({
        id: "default-fb-song-8",
        builtin_slug: "pulang-sore",
        title: "Pulang di Ujung Sore",
        artist: "Studio Instrumental",
        mood: "Hangat & Keluarga",
        audio_object_key: "builtin:pulang-sore",
        audio_mime_type: "audio/mp4",
        asset_path: "/assets/audio/story-music/pulang-sore.m4a",
        duration_seconds: 15,
        facebook_url: ""
    })
]);

export const DEFAULT_FACEBOOK_SONGS = BUILTIN_STORY_SONGS;

export function findBuiltinStorySong(keyOrSlug) {
    const clean = String(keyOrSlug || "").trim().replace(/^builtin:/i, "");
    if (!clean) return null;
    return BUILTIN_STORY_SONGS.find(
        item => item.builtin_slug === clean || item.id === clean
    ) || null;
}

const ALLOWED_FACEBOOK_HOSTS = new Set([
    "facebook.com",
    "www.facebook.com",
    "m.facebook.com",
    "web.facebook.com",
    "business.facebook.com",
    "fb.watch",
    "fb.com",
    "www.fb.com"
]);

function choose(values, random = Math.random) {
    const roll = Number(random());
    const normalized = Number.isFinite(roll) ? Math.min(0.999999, Math.max(0, roll)) : 0;
    return values[Math.floor(normalized * values.length)] || values[0];
}

export function sanitizeFacebookSongUrl(value) {
    const text = String(value || "").trim();
    if (!text) return "";
    try {
        const url = new URL(text);
        if (url.protocol !== "https:") return "";
        const host = url.hostname.toLowerCase();
        if (!ALLOWED_FACEBOOK_HOSTS.has(host)) return "";
        return url.toString().slice(0, 500);
    } catch {
        return "";
    }
}

export function songIdentityKey(song = {}) {
    const title = String(song?.title || song?.song_title || "").trim().toLowerCase();
    const artist = String(song?.artist || song?.song_artist || "").trim().toLowerCase();
    if (!title && !artist) return "";
    return `${title}|${artist}`;
}

export const SOCIAL_SONG_MODES = Object.freeze(["off", "fixed", "random"]);

/**
 * Mode lagu untuk satu jadwal:
 *   off    = tanpa lagu sama sekali,
 *   fixed  = selalu lagu pilihan pengguna (song_id),
 *   random = acak, tanpa mengulang lagu terakhir bila masih ada opsi lain.
 *
 * Kompatibilitas: jadwal lama hanya punya `use_random_song` (boolean).
 */
export function normalizeSongMode(value, fallback = "off") {
    if (value === undefined || value === null || String(value).trim() === "") return fallback;
    const clean = String(value).trim().toLowerCase();
    return SOCIAL_SONG_MODES.includes(clean) ? clean : fallback;
}

export function resolveScheduleSongMode(schedule = {}, postMode = "character") {
    /* Lagu hanya dipakai untuk Kata-kata Mutiara. Foto karakter AI & outfit
       tidak memakai lagu sama sekali, walau data lama masih menyimpan
       use_random_song = true. */
    if (postMode !== "quote") return "off";
    const mode = normalizeSongMode(schedule?.song_mode, "");
    if (mode) return mode;
    if (schedule?.use_random_song === undefined) return "random";
    return schedule.use_random_song === false ? "off" : "random";
}

/** Apakah lagu boleh dipakai untuk mode post ini (hanya Kata-kata Mutiara). */
export function isSongAllowedForPostMode(postMode) {
    return normalizeSocialPostMode(postMode) === "quote";
}

/**
 * Memilih satu lagu Facebook: lagu tetap (bila `preferredSongId` diisi dan
 * masih aktif) atau acak.
 * Prioritas: koleksi lagu aktif milik user di database; jika kosong dan
 * `fallbackToDefaults` aktif, memakai katalog lagu populer Facebook bawaan.
 * Lagu yang baru saja dipakai pada run sebelumnya dilewati selama ada opsi lain.
 */
export function pickRandomFacebookSong(
    songs = [],
    recentRunsOrKeys = [],
    random = Math.random,
    { fallbackToDefaults = true, requirePlayableAudio = false, preferredSongId = null } = {}
) {
    const activeCustom = (Array.isArray(songs) ? songs : [])
        .filter(song => {
            if (!song || !String(song.title || "").trim() || song.is_active === false) return false;
            if (requirePlayableAudio && !String(song.audio_object_key || "").trim()) return false;
            return true;
        });
    const basePool = activeCustom.length
        ? activeCustom
        : (fallbackToDefaults ? BUILTIN_STORY_SONGS : []);
    if (!basePool.length) return null;

    const recentIds = new Set();
    const recentIdentities = new Set();
    for (const entry of Array.isArray(recentRunsOrKeys) ? recentRunsOrKeys : []) {
        if (!entry) continue;
        if (typeof entry === "string") {
            recentIds.add(entry);
            recentIdentities.add(entry.toLowerCase());
            continue;
        }
        if (entry.song_id) recentIds.add(String(entry.song_id));
        if (entry.id) recentIds.add(String(entry.id));
        const key = songIdentityKey(entry);
        if (key) recentIdentities.add(key);
    }

    /* Lagu tetap: pakai apa pun riwayatnya, selama masih aktif & layak. */
    const preferred = preferredSongId
        ? basePool.find(song => String(song.id || "") === String(preferredSongId))
        : null;

    const fresh = basePool.filter(song => {
        const id = song.id ? String(song.id) : "";
        const identity = songIdentityKey(song);
        if (id && recentIds.has(id)) return false;
        if (identity && recentIdentities.has(identity)) return false;
        return true;
    });
    const pool = fresh.length ? fresh : basePool;
    const picked = preferred || choose(pool, random);
    if (!picked) return null;

    const isDefault = String(picked.id || "").startsWith("default-fb-song-");
    const audioKey = String(picked.audio_object_key || "").trim();
    const builtin = audioKey.startsWith("builtin:") ? findBuiltinStorySong(audioKey) : null;
    return {
        id: isDefault ? null : (picked.id || null),
        title: String(picked.title || "").trim().slice(0, 140),
        artist: String(picked.artist || "").trim().slice(0, 120),
        mood: String(picked.mood || "").trim().slice(0, 80),
        audio_object_key: audioKey || (builtin ? builtin.audio_object_key : ""),
        audio_mime_type: String(picked.audio_mime_type || builtin?.audio_mime_type || "").trim(),
        asset_path: String(picked.asset_path || builtin?.asset_path || "").trim(),
        duration_seconds: Number(picked.duration_seconds) > 0 ? Number(picked.duration_seconds) : 15,
        facebook_url: sanitizeFacebookSongUrl(picked.facebook_url),
        source: activeCustom.length ? "custom" : "default"
    };
}

export function formatFacebookSongCaption(song = {}) {
    if (!song || typeof song !== "object") return "";
    /* Judul dari nama berkas unduhan dibersihkan agar caption tidak terbaca spam. */
    const title = cleanSongTitleForCaption(song.title || song.song_title || "");
    const artist = cleanSongTitleForCaption(song.artist || song.song_artist || "").slice(0, 120);
    const url = sanitizeFacebookSongUrl(song.facebook_url || song.song_facebook_url);
    if (!title && !url) return "";

    const label = title
        ? `🎵 Lagu Facebook: ${title}${artist && artist !== title ? ` — ${artist}` : ""}`
        : "";
    const linkLine = url ? `🎧 Musik di Facebook: ${url}` : "";
    return [label, linkLine].filter(Boolean).join("\n");
}

function findTheme(themeValue) {
    const clean = String(themeValue || "").trim().toLowerCase();
    if (!clean) return null;
    return QUOTE_THEME_LIBRARY.find(
        item => item.id === clean || item.label.toLowerCase() === clean
    ) || null;
}

function findVisualStyle(visualValue) {
    const clean = String(visualValue || "").trim();
    if (!clean) return null;
    const found = QUOTE_VISUAL_LIBRARY.find(
        item => item.prompt === clean || item.label.toLowerCase() === clean.toLowerCase()
    );
    if (found) return found;
    return { label: clean.slice(0, 120), prompt: clean.slice(0, 260) };
}

function quotePlanKey(plan) {
    return [plan.themeId, plan.visualPrompt, plan.details || ""].join("|");
}

export function quoteOverridesFromSchedule(schedule = {}) {
    return {
        theme: schedule.quote_theme,
        visualStyle: schedule.quote_visual_style,
        details: schedule.scene_details
    };
}

export function createQuotePlan(recentKeys = [], random = Math.random, overrides = {}) {
    const recent = new Set(Array.isArray(recentKeys) ? recentKeys : []);
    const fixedTheme = findTheme(overrides?.theme);
    const fixedVisual = findVisualStyle(overrides?.visualStyle);
    const details = String(overrides?.details || "").trim().slice(0, 400);

    let fallback = null;
    for (let attempt = 0; attempt < 24; attempt += 1) {
        const theme = fixedTheme || choose(QUOTE_THEME_LIBRARY, random);
        const visual = fixedVisual || choose(QUOTE_VISUAL_LIBRARY, random);
        const plan = {
            mode: "quote",
            themeId: theme.id,
            themeLabel: theme.label,
            themeDirection: theme.direction,
            visualLabel: visual.label,
            visualPrompt: visual.prompt,
            location: visual.label,
            atmosphere: theme.label,
            details
        };
        plan.key = quotePlanKey(plan);
        fallback = plan;
        if (!recent.has(plan.key)) return plan;
    }
    return fallback;
}

export function cleanQuoteText(raw) {
    const cleaned = String(raw || "")
        .replace(/```[\s\S]*?```/g, " ")
        .replace(/^\s*(?:kata[-\s]?kata\s+mutiara|kutipan|quote)\s*[:\-–]\s*/i, "")
        .replace(/^[\s"“”'‘’«»*-]+|[\s"“”'‘’«»*-]+$/g, "")
        .replace(/#[\p{L}\p{N}_]+/gu, "")
        .replace(/\bhttps?:\/\/\S+|\bwww\.\S+/gi, "")
        .replace(/\s+/g, " ")
        .trim();
    if (!cleaned) return "";
    return cleaned.slice(0, 240).trim();
}

export function pickFallbackQuote(themeId = "", recentQuotes = [], random = Math.random) {
    const normalizedTheme = String(themeId || "").trim().toLowerCase();
    const recent = new Set(
        (Array.isArray(recentQuotes) ? recentQuotes : [])
            .map(item => cleanQuoteText(item).toLowerCase())
            .filter(Boolean)
    );
    const themed = normalizedTheme
        ? FALLBACK_QUOTES.filter(entry => entry.theme === normalizedTheme)
        : FALLBACK_QUOTES;
    const basePool = themed.length ? themed : FALLBACK_QUOTES;
    const fresh = basePool.filter(entry => !recent.has(entry.text.toLowerCase()));
    const picked = choose(fresh.length ? fresh : basePool, random);
    return picked?.text || FALLBACK_QUOTES[0].text;
}

/**
 * Kamus makna kalimat mutiara -> arahan visual (bahasa Inggris, bebas teks).
 *
 * Kalimat aslinya SENGAJA tidak pernah disisipkan ke prompt gambar: model T2I
 * cenderung menuliskan kata yang dikutip ke dalam gambar, padahal kartu mutiara
 * sudah merender teksnya sendiri di tengah kanvas. Karena itu "latar sesuai
 * kalimat" diwujudkan dengan memetakan kata kunci kalimat ke unsur visual
 * (jalan pulang, senja, hujan, cahaya, dll.), lalu menggabungkannya dengan
 * gaya latar & tema dari quotePlan.
 */
export const QUOTE_VISUAL_KEYWORDS = Object.freeze([
    { test: /\b(pulang|rumah|kembali|rindu|kampung)/i, direction: "a quiet path leading home with one warm light glowing in a distant window" },
    { test: /\b(langkah\w*|melangkah\w*|berjalan\w*|jalan\w*|perjalanan\w*|proses\w*)/i, direction: "a lone winding path with soft footprints fading into the distance" },
    { test: /\b(senja|sore|mentari|matahari terbenam|petang)/i, direction: "a warm golden-hour horizon with long gentle shadows" },
    { test: /\b(pagi|fajar|esok|hari baru|bangkit)/i, direction: "first light of morning spilling softly over an open landscape" },
    { test: /\b(hujan|gerimis|mendung|awan|badai)/i, direction: "soft rain on a window with misty blue-grey clouds and diffused light" },
    { test: /\b(laut|ombak|pantai|samudra|pasir)/i, direction: "a calm shoreline with slow gentle waves and a wide empty horizon" },
    { test: /\b(gunung|bukit|perbukitan|lembah|kabut)/i, direction: "layered mountain ridges under a soft veil of morning mist" },
    { test: /\b(hati|tenang|damai|diam|jeda|napas|lelah|istirahat)/i, direction: "still water, uncluttered negative space and a hushed contemplative atmosphere" },
    { test: /\b(mimpi|harap|harapan|cita|bintang|langit|tujuan)/i, direction: "faint starlight above a wide open sky, subtle and hopeful" },
    { test: /\b(syukur|rezeki|doa|berkah|cukup|lapang)/i, direction: "warm sunlight resting on a simple wooden table and a single humble object" },
    { test: /\b(tumbuh|akar|benih|biji|daun|bunga|musim)/i, direction: "a small green shoot and delicate leaves growing in soft natural light" },
    { test: /\b(cahaya|terang|sinar|lilin|lampu|gelap|malam)/i, direction: "one gentle source of warm light against a deep, calm shadow" },
    { test: /\b(sabar|sabarnya|ujian|bertahan|kuat|tegar|gagal|jatuh)/i, direction: "a weathered stone and still water, quiet resilient mood with muted earthy tones" },
    { test: /\b(cinta|tulus|sahabat|keluarga|bersama|menjaga)/i, direction: "two empty chairs close together in warm afternoon light, tender and understated" },
    { test: /\b(waktu|kemarin|nanti|usia|umur|abad)/i, direction: "soft drifting light and long shadows suggesting the slow passage of time" },
    { test: /\b(buku|catatan|tulis|jurnal|belajar|ilmu)/i, direction: "an open linen journal on a warm oak desk in quiet morning window light" },
    { test: /\b(kopi|teh|cangkir|meja|jendela)/i, direction: "a warm ceramic cup beside a rain-streaked window with cozy golden bokeh" },
    { test: /\b(takdir|ketetapan|percaya|pasrah|keyakinan)/i, direction: "a wide cloudless horizon with one steady distant star, serene and assured" }
]);

/**
 * Ubah isi kalimat mutiara menjadi arahan visual yang tidak mengandung
 * satu pun kata dari kalimat itu. Dipakai baik oleh posting manual maupun
 * autopost supaya latar AI benar-benar mengikuti makna kalimatnya.
 */
export function quoteVisualDirection(quoteText = "", quotePlan = {}) {
    const text = cleanQuoteText(quoteText).toLowerCase();
    const directions = [];
    if (text) {
        for (const entry of QUOTE_VISUAL_KEYWORDS) {
            if (entry.test.test(text)) directions.push(entry.direction);
            if (directions.length === 3) break;
        }
    }
    const themeLabel = String(quotePlan?.themeLabel || "").trim();
    const themeDirection = String(quotePlan?.themeDirection || "").trim().slice(0, 200);
    if (!directions.length) {
        return [
            "a calm, uncluttered, contemplative scene with gentle natural light",
            themeDirection ? `that visually suggests ${themeDirection}` : "",
            themeLabel ? `in the mood of ${themeLabel}` : ""
        ].filter(Boolean).join(" ");
    }
    return [
        directions.join("; "),
        themeDirection ? `; keep the mood consistent with ${themeDirection}` : "",
        themeLabel ? `; overall tone: ${themeLabel}` : ""
    ].filter(Boolean).join("");
}

export function buildQuoteImagePrompt({
    quotePlan,
    quoteText = "",
    visualDirection = "",
    aspectRatio = "9:16",
    negativePrompt = "",
    withCharacter = false,
    hasOutfitReference = false,
    outfitName = ""
}) {
    const visualPrompt = String(quotePlan?.visualPrompt || QUOTE_VISUAL_LIBRARY[0].prompt).trim();
    const themeLabel = String(quotePlan?.themeLabel || "Refleksi Kehidupan").trim();
    const details = String(quotePlan?.details || "").trim().slice(0, 400);
    const ratio = ["9:16", "16:9"].includes(aspectRatio) ? aspectRatio : "9:16";
    const direction = quoteVisualDirection(quoteText, quotePlan);
    /* Adegan hasil pembacaan kalimat oleh LLM penulis mutiara. Opsional:
       bila model lama hanya mengirim baris QUOTE, pemetaan kata kunci
       di atas tetap dipakai. */
    const sentenceScene = String(visualDirection || "").trim().slice(0, 240);
    const wardrobe = String(outfitName || "").trim().slice(0, 80);
    const negative = [
        withCharacter ? SOCIAL_QUOTE_CHARACTER_NEGATIVE_PROMPT : SOCIAL_QUOTE_NEGATIVE_PROMPT,
        String(negativePrompt || "").trim().slice(0, 400)
    ].filter(Boolean).join(", ");

    const subjectRule = withCharacter
        ? [
            "The image MUST include exactly ONE person: preserve the same face, hair, skin tone, and identity as the supplied character reference photo.",
            hasOutfitReference
                ? `Dress this person in the exact garment shown in the supplied outfit reference image${wardrobe ? ` (random wardrobe pick: "${wardrobe}")` : ""}; reproduce its fabric, color, cut, and pattern, and do not redesign it.`
                : "Dress this person in the exact outfit already worn in the character reference photo; do not invent a different wardrobe.",
            "Place the subject off-center (lower third or one side) with no close-up face crop, and leave a clean, uncluttered central area open for a text overlay."
        ].join(" ")
        : "Strictly NO people, NO characters, NO human faces, NO hands, and NO silhouettes of people anywhere in the frame.";

    return [
        withCharacter
            ? "Create one atmospheric photograph suitable as a calm background canvas for a quote card, featuring the supplied character."
            : "Create one pure, clean, atmospheric scenic photograph suitable as a calm background canvas.",
        `Scene: ${visualPrompt}.`,
        `Quote meaning to visualize (interpret the meaning of the sentence, NEVER render its words): ${direction}.`,
        sentenceScene ? `Sentence-derived scene from the quote writer (still no words or letters): ${sentenceScene}.` : "",
        `Mood & lighting: ${themeLabel}; peaceful, soulful, cinematic film color grading with soft balanced tones in the center area.`,
        "CRITICAL RULE — NO TEXT AT ALL: Do NOT render any text, letters, words, quotes, numbers, signs, logos, watermarks, or typography anywhere in the image. The image must contain zero written characters because the quote text is added separately by the card renderer.",
        subjectRule,
        details ? `Additional visual direction: ${details}.` : "",
        `Negative prompt: ${negative}`,
        ratio === "9:16"
            ? "Compose as a clean vertical 9:16 photograph with open, uncluttered breathing space in the middle."
            : "Compose as a clean horizontal 16:9 photograph with open, uncluttered breathing space in the middle."
    ].filter(Boolean).join("\n\n");
}

export function renderQuoteCaption(template, quotePlan = {}, quoteText = "", song = null) {
    const source = String(template || "Renungan hari ini ✨ #KataMutiara #GENZAI").slice(0, 1000);
    const fields = {
        name: "GEN-Z.AI",
        location: String(quotePlan.visualLabel || quotePlan.location || "suasana tenang"),
        outfit: "",
        situation: String(quotePlan.themeLabel || "renungan hari ini"),
        lighting: "cahaya alami yang hangat",
        angle: "visual estetik",
        atmosphere: String(quotePlan.themeLabel || "tenang dan bermakna"),
        condition: String(quotePlan.visualLabel || "teduh"),
        quote: cleanQuoteText(quoteText),
        theme: String(quotePlan.themeLabel || ""),
        visual: String(quotePlan.visualLabel || ""),
        song: String(song?.title || ""),
        artist: String(song?.artist || "")
    };

    return source
        .replace(/\{(name|location|outfit|situation|lighting|angle|atmosphere|condition|quote|theme|visual|song|artist)\}/gi, (match, key) => {
            return fields[key.toLowerCase()] ?? match;
        })
        .replace(/\s{2,}/g, " ")
        .trim();
}
