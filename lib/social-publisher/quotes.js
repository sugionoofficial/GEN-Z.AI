import { SOCIAL_AUTO_NEGATIVE_PROMPT } from "./utils.js";

export const SOCIAL_POST_MODES = Object.freeze(["character", "quote"]);

export function normalizeSocialPostMode(value, fallback = "character") {
    if (value === undefined || value === null || String(value).trim() === "") {
        return fallback;
    }
    const normalized = String(value).trim().toLowerCase();
    return SOCIAL_POST_MODES.includes(normalized) ? normalized : null;
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

export const SOCIAL_QUOTE_NEGATIVE_PROMPT = [
    SOCIAL_AUTO_NEGATIVE_PROMPT,
    "person",
    "people",
    "human face",
    "portrait",
    "man",
    "woman",
    "crowd",
    "silhouette of person",
    "hands",
    "misspelled text",
    "garbled letters",
    "gibberish typography",
    "cut-off text",
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
 * Daftar lagu populer yang tersedia di ekosistem Facebook (Reels / Music / Sound)
 * sebagai katalog acak bawaan apabila user belum menambahkan daftar lagu sendiri,
 * sekaligus dapat di-seed ke koleksi lagu akun dengan satu klik.
 */
export const DEFAULT_FACEBOOK_SONGS = Object.freeze([
    Object.freeze({
        id: "default-fb-song-1",
        title: "Untungnya, Bumi Masih Berputar",
        artist: "Bernadya",
        mood: "Refleksi & Syukur",
        facebook_url: "https://www.facebook.com/search/top/?q=Bernadya%20Untungnya%20Bumi%20Masih%20Berputar"
    }),
    Object.freeze({
        id: "default-fb-song-2",
        title: "Komang",
        artist: "Raim Laode",
        mood: "Hangat & Ketulusan",
        facebook_url: "https://www.facebook.com/search/top/?q=Raim%20Laode%20Komang"
    }),
    Object.freeze({
        id: "default-fb-song-3",
        title: "Penjaga Hati",
        artist: "Nadhif Basalamah",
        mood: "Cinta & Tenang",
        facebook_url: "https://www.facebook.com/search/top/?q=Nadhif%20Basalamah%20Penjaga%20Hati"
    }),
    Object.freeze({
        id: "default-fb-song-4",
        title: "Gala Bunga Matahari",
        artist: "Sal Priadi",
        mood: "Rindu & Senja",
        facebook_url: "https://www.facebook.com/search/top/?q=Sal%20Priadi%20Gala%20Bunga%20Matahari"
    }),
    Object.freeze({
        id: "default-fb-song-5",
        title: "Diri",
        artist: "Tulus",
        mood: "Penyembuhan Diri",
        facebook_url: "https://www.facebook.com/search/top/?q=Tulus%20Diri"
    }),
    Object.freeze({
        id: "default-fb-song-6",
        title: "Rehat",
        artist: "Kunto Aji",
        mood: "Tenang & Motivasi",
        facebook_url: "https://www.facebook.com/search/top/?q=Kunto%20Aji%20Rehat"
    }),
    Object.freeze({
        id: "default-fb-song-7",
        title: "Tutur Batin",
        artist: "Yura Yunita",
        mood: "Semangat Hidup",
        facebook_url: "https://www.facebook.com/search/top/?q=Yura%20Yunita%20Tutur%20Batin"
    }),
    Object.freeze({
        id: "default-fb-song-8",
        title: "Hati-Hati di Jalan",
        artist: "Tulus",
        mood: "Perjalanan Hidup",
        facebook_url: "https://www.facebook.com/search/top/?q=Tulus%20Hati-Hati%20di%20Jalan"
    }),
    Object.freeze({
        id: "default-fb-song-9",
        title: "Secukupnya",
        artist: "Hindia",
        mood: "Refleksi & Realita",
        facebook_url: "https://www.facebook.com/search/top/?q=Hindia%20Secukupnya"
    }),
    Object.freeze({
        id: "default-fb-song-10",
        title: "Zona Nyaman",
        artist: "Fourtwnty",
        mood: "Pagi & Semangat",
        facebook_url: "https://www.facebook.com/search/top/?q=Fourtwnty%20Zona%20Nyaman"
    }),
    Object.freeze({
        id: "default-fb-song-11",
        title: "Usik",
        artist: "Feby Putri",
        mood: "Doa & Ketabahan",
        facebook_url: "https://www.facebook.com/search/top/?q=Feby%20Putri%20Usik"
    }),
    Object.freeze({
        id: "default-fb-song-12",
        title: "Satu-Satu",
        artist: "Idgitaf",
        mood: "Bangkit & Bertumbuh",
        facebook_url: "https://www.facebook.com/search/top/?q=Idgitaf%20Satu-Satu"
    }),
    Object.freeze({
        id: "default-fb-song-13",
        title: "Sampai Jadi Debu",
        artist: "Banda Neira",
        mood: "Kesetiaan & Senja",
        facebook_url: "https://www.facebook.com/search/top/?q=Banda%20Neira%20Sampai%20Jadi%20Debu"
    }),
    Object.freeze({
        id: "default-fb-song-14",
        title: "Mesin Waktu",
        artist: "Budi Doremi",
        mood: "Kenangan & Ikhlas",
        facebook_url: "https://www.facebook.com/search/top/?q=Budi%20Doremi%20Mesin%20Waktu"
    }),
    Object.freeze({
        id: "default-fb-song-15",
        title: "Akad",
        artist: "Payung Teduh",
        mood: "Cinta & Keluarga",
        facebook_url: "https://www.facebook.com/search/top/?q=Payung%20Teduh%20Akad"
    })
]);

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

/**
 * Memilih satu lagu Facebook secara acak.
 * Prioritas: koleksi lagu aktif milik user di database; jika kosong dan
 * `fallbackToDefaults` aktif, memakai katalog lagu populer Facebook bawaan.
 * Lagu yang baru saja dipakai pada run sebelumnya dilewati selama ada opsi lain.
 */
export function pickRandomFacebookSong(
    songs = [],
    recentRunsOrKeys = [],
    random = Math.random,
    { fallbackToDefaults = true } = {}
) {
    const activeCustom = (Array.isArray(songs) ? songs : [])
        .filter(song => song && String(song.title || "").trim() && song.is_active !== false);
    const basePool = activeCustom.length
        ? activeCustom
        : (fallbackToDefaults ? DEFAULT_FACEBOOK_SONGS : []);
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

    const fresh = basePool.filter(song => {
        const id = song.id ? String(song.id) : "";
        const identity = songIdentityKey(song);
        if (id && recentIds.has(id)) return false;
        if (identity && recentIdentities.has(identity)) return false;
        return true;
    });
    const pool = fresh.length ? fresh : basePool;
    const picked = choose(pool, random);
    if (!picked) return null;

    const isDefault = String(picked.id || "").startsWith("default-fb-song-");
    return {
        id: isDefault ? null : (picked.id || null),
        title: String(picked.title || "").trim().slice(0, 140),
        artist: String(picked.artist || "").trim().slice(0, 120),
        mood: String(picked.mood || "").trim().slice(0, 80),
        facebook_url: sanitizeFacebookSongUrl(picked.facebook_url),
        source: activeCustom.length ? "custom" : "default"
    };
}

export function formatFacebookSongCaption(song = {}) {
    if (!song || typeof song !== "object") return "";
    const title = String(song.title || song.song_title || "").trim().slice(0, 140);
    const artist = String(song.artist || song.song_artist || "").trim().slice(0, 120);
    const url = sanitizeFacebookSongUrl(song.facebook_url || song.song_facebook_url);
    if (!title && !url) return "";

    const label = title
        ? `🎵 Lagu Facebook: ${title}${artist ? ` — ${artist}` : ""}`
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

export function buildQuoteImagePrompt({
    quoteText,
    quotePlan,
    aspectRatio = "9:16",
    negativePrompt = ""
}) {
    const safeQuote = cleanQuoteText(quoteText) || pickFallbackQuote(quotePlan?.themeId);
    const visualPrompt = String(quotePlan?.visualPrompt || QUOTE_VISUAL_LIBRARY[0].prompt).trim();
    const themeLabel = String(quotePlan?.themeLabel || "Refleksi Kehidupan").trim();
    const details = String(quotePlan?.details || "").trim().slice(0, 400);
    const ratio = ["9:16", "16:9"].includes(aspectRatio) ? aspectRatio : "9:16";
    const negative = [SOCIAL_QUOTE_NEGATIVE_PROMPT, String(negativePrompt || "").trim().slice(0, 400)]
        .filter(Boolean)
        .join(", ");

    return [
        "Create one refined, high-aesthetic editorial quote poster photograph with clean Indonesian typography.",
        `Background scene: ${visualPrompt}.`,
        `Mood & theme: ${themeLabel}; peaceful, soulful, atmospheric, natural film color grading with a gentle dark-warm vignette in the middle so text is effortlessly legible.`,
        "Strictly NO people, NO characters, NO human faces, NO hands, and NO silhouettes of people anywhere in the frame. Focus purely on the aesthetic environment and still-life atmosphere.",
        `Render the exact Indonesian quote centered cleanly in the frame using tasteful, crisp, balanced serif and modern editorial typography in warm off-white ink, with generous margins and 100% accurate spelling:\n"${safeQuote}"`,
        "Do not add any author name, username, logo, watermark, website URL, or extra English words outside the exact Indonesian quote above.",
        details ? `Additional visual direction: ${details}.` : "",
        `Negative prompt: ${negative}`,
        ratio === "9:16"
            ? "Compose as a vertical 9:16 social-media quote card with generous breathing room above and below the centered quote."
            : "Compose as a horizontal 16:9 social-media quote card with generous breathing room around the centered quote."
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
