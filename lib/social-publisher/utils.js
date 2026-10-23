/**
 * Library opsi scene untuk parameter generate gambar.
 * `prompt` dipakai di prompt berbahasa Inggris, `label` tampil di UI.
 * Urutan pertama pada setiap daftar bukan default; default diatur di
 * createScenePlan (lokasi/suasana/kondisi/pencahayaan acak, angle medium shot).
 */
const SCENE_LIBRARY = {
    locations: [
        { label: "Coffee shop hangat di Jakarta", prompt: "a warm, design-forward coffee shop in Jakarta" },
        { label: "Jalan kota tua setelah hujan", prompt: "a rain-washed old-town street with colonial-era architecture" },
        { label: "Rooftop garden dengan skyline kota", prompt: "a sunlit rooftop garden overlooking the city skyline" },
        { label: "Promenade tepi laut saat golden hour", prompt: "a quiet seaside promenade at golden hour" },
        { label: "Galeri seni modern", prompt: "a modern art gallery with soft neutral walls" },
        { label: "Kebun botani setelah hujan", prompt: "a leafy botanical garden after light rain" },
        { label: "Pasar akhir pekan", prompt: "a weekend market with colorful stalls in the background" },
        { label: "Studio minimalis dengan cahaya jendela", prompt: "a minimalist studio with natural window light" },
        { label: "Toko buku dengan lampu hangat", prompt: "a calm bookshop with tall shelves and warm lamps" },
        { label: "Perempatan kota saat blue hour", prompt: "a city crosswalk at blue hour with softly blurred traffic" },
        { label: "Kafe pinggir pantai Bali", prompt: "an open-air beachfront cafe in Bali with woven furniture" },
        { label: "Koridor gedung bergaya industrial", prompt: "an industrial-style building corridor with concrete and glass" }
    ],
    angles: [
        { label: "Medium shot (default)", prompt: "medium shot, waist-up framing with a natural 50mm lens perspective" },
        { label: "Close-up potret", prompt: "close-up portrait with gentle background compression and detailed skin texture" },
        { label: "Full body shot", prompt: "full-body shot with the whole outfit visible and the location readable" },
        { label: "Wide environmental shot", prompt: "wide environmental shot with generous negative space around the subject" },
        { label: "Low angle", prompt: "low-angle shot looking slightly up at the subject" },
        { label: "High angle", prompt: "high-angle shot looking slightly down at the subject" },
        { label: "Eye level", prompt: "eye-level shot with a straight-on, natural perspective" },
        { label: "Over the shoulder", prompt: "over-the-shoulder candid frame with the subject turning naturally toward camera" },
        { label: "Three-quarter", prompt: "three-quarter angle shot with a natural 35mm lens perspective" }
    ],
    outfits: [
        "a refined neutral linen outfit with simple accessories",
        "a relaxed smart-casual jacket over a plain top",
        "a tasteful modern streetwear look in muted colors",
        "a soft knit sweater with dark tailored trousers",
        "a light summer outfit with a clean, elegant silhouette",
        "a contemporary monochrome outfit with subtle texture",
        "a casual denim layer over a solid-color shirt",
        "a simple long-sleeved outfit in warm earth tones"
    ],
    situations: [
        { label: "Menikmati minuman sambil melihat keluar jendela", prompt: "pausing to enjoy a drink and looking thoughtfully out of the window" },
        { label: "Berjalan santai membawa tas kecil", prompt: "walking naturally through the location while carrying a small bag" },
        { label: "Membaca buku di meja yang tenang", prompt: "reading a book at a quiet table, captured between moments" },
        { label: "Menyapa teman di luar frame", prompt: "greeting a friend just outside the frame with a relaxed smile" },
        { label: "Memeriksa kamera lalu menatap lensa", prompt: "checking a camera and then looking up toward the photographer" },
        { label: "Berdiri menikmati pemandangan", prompt: "standing comfortably and taking in the surrounding view" },
        { label: "Membawa gelas takeaway sambil menyeberang", prompt: "holding a takeaway cup while crossing the street" },
        { label: "Melihat etalase toko", prompt: "browsing a display and noticing something interesting" }
    ],
    lighting: [
        { label: "Siang mendung lembut", prompt: "soft overcast daylight with gentle, realistic shadows" },
        { label: "Golden hour hangat", prompt: "warm late-afternoon golden-hour light with natural skin tones" },
        { label: "Cahaya jendela menyebar", prompt: "diffused window light from one side and subtle fill from the room" },
        { label: "Blue hour dengan lampu praktis", prompt: "soft blue-hour ambient light balanced with warm practical lights" },
        { label: "Pagi terang dan lembut", prompt: "bright but soft morning daylight with clean highlights" },
        { label: "Malam sinematik", prompt: "cinematic evening light with restrained contrast and no artificial glow" }
    ],
    atmospheres: [
        { label: "Tenang dan intim", prompt: "a calm, intimate atmosphere with a quiet everyday mood" },
        { label: "Hangat dan ramah", prompt: "a warm, welcoming atmosphere with soft social energy" },
        { label: "Ceria dan santai", prompt: "a cheerful, relaxed atmosphere with light positive energy" },
        { label: "Bersemangat dan dinamis", prompt: "an energetic, dynamic atmosphere with a sense of movement" },
        { label: "Elegan dan dewasa", prompt: "an elegant, understated atmosphere with a mature editorial mood" },
        { label: "Melankolis lembut", prompt: "a gently melancholic atmosphere with reflective, quiet tones" },
        { label: "Bersih dan minimalis", prompt: "a clean, minimalist atmosphere with uncluttered surroundings" },
        { label: "Festival dan ramai", prompt: "a lively festival atmosphere with soft background activity" }
    ],
    conditions: [
        { label: "Cerah", prompt: "clear sunny weather" },
        { label: "Mendung", prompt: "soft overcast weather" },
        { label: "Gerimis setelah hujan", prompt: "light drizzle just after rain with damp surfaces" },
        { label: "Pagi hari", prompt: "early morning conditions with fresh light" },
        { label: "Sore hari", prompt: "late afternoon conditions as the day cools down" },
        { label: "Malam hari", prompt: "evening conditions with city lights in the background" },
        { label: "Berangin lembut", prompt: "a light breeze moving hair and fabric naturally" },
        { label: "Panas terik", prompt: "bright midday heat with crisp, hard-edged shadows" }
    ]
};

const toPromptList = items => items.map(item => item.prompt || item);
const toPresets = items => items.map(item => ({ value: item.prompt || item, label: item.label || item.prompt || item }));

/** Opsi dropdown parameter gambar, sekaligus sumber label Bahasa Indonesia. */
export const SCENE_PRESETS = Object.freeze({
    locations: Object.freeze(toPresets(SCENE_LIBRARY.locations)),
    angles: Object.freeze(toPresets(SCENE_LIBRARY.angles)),
    situations: Object.freeze(toPresets(SCENE_LIBRARY.situations)),
    lighting: Object.freeze(toPresets(SCENE_LIBRARY.lighting)),
    atmospheres: Object.freeze(toPresets(SCENE_LIBRARY.atmospheres)),
    conditions: Object.freeze(toPresets(SCENE_LIBRARY.conditions))
});

/** Angle kamera dipakai ketika jadwal tidak memilih angle apa pun. */
export const SOCIAL_DEFAULT_CAMERA_ANGLE = "medium shot";

/**
 * Negative prompt otomatis. Selalu dikirim ke provider gambar supaya hasilnya
 * tidak jatuh ke artefak umum (teks, watermark, anatomi rusak, plastik).
 * User hanya perlu menambah catatan negatif tambahan bila perlu.
 */
export const SOCIAL_AUTO_NEGATIVE_PROMPT = [
    "blurry",
    "low resolution",
    "pixelated",
    "compression artifacts",
    "distorted anatomy",
    "extra fingers",
    "missing fingers",
    "deformed hands",
    "extra limbs",
    "duplicate person",
    "asymmetric eyes",
    "plastic or waxy skin",
    "over-smoothed beauty filter",
    "heavy HDR halo",
    "oversaturated colors",
    "watermark",
    "logo",
    "brand text",
    "caption text",
    "signature",
    "frame border",
    "cartoon",
    "anime",
    "3D render",
    "doll-like face",
    "different person",
    "child appearance",
    "explicit or revealing clothing"
].join(", ");

const SCENES = {
    locations: toPromptList(SCENE_LIBRARY.locations),
    angles: toPromptList(SCENE_LIBRARY.angles),
    outfits: SCENE_LIBRARY.outfits,
    situations: toPromptList(SCENE_LIBRARY.situations),
    lighting: toPromptList(SCENE_LIBRARY.lighting),
    atmospheres: toPromptList(SCENE_LIBRARY.atmospheres),
    conditions: toPromptList(SCENE_LIBRARY.conditions)
};

function choose(values, random = Math.random) {
    return values[Math.min(values.length - 1, Math.floor(random() * values.length))];
}

function sceneKey(scene) {
    return [
        scene.location,
        scene.angle,
        scene.outfit,
        scene.situation,
        scene.lighting,
        scene.atmosphere,
        scene.condition,
        scene.details
    ].join("|");
}

function overrideValue(overrides, key) {
    return String(overrides?.[key] || "").trim();
}

/**
 * Menyusun rencana scene untuk satu post.
 *
 * `overrides` berasal dari parameter gambar pada blok jadwal:
 *  - location / situation / lighting / atmosphere / condition / details
 *    dipakai apa adanya bila diisi, selain itu diacak.
 *  - angle kosong selalu jatuh ke medium shot (SOCIAL_DEFAULT_CAMERA_ANGLE).
 */
export function createScenePlan(recentKeys = [], random = Math.random, overrides = {}) {
    const recent = new Set(Array.isArray(recentKeys) ? recentKeys : []);
    const fixed = {
        location: overrideValue(overrides, "location"),
        angle: overrideValue(overrides, "angle"),
        situation: overrideValue(overrides, "situation"),
        lighting: overrideValue(overrides, "lighting"),
        atmosphere: overrideValue(overrides, "atmosphere"),
        condition: overrideValue(overrides, "condition"),
        details: overrideValue(overrides, "details")
    };
    let fallback = null;

    for (let attempt = 0; attempt < 24; attempt += 1) {
        const scene = {
            location: fixed.location || choose(SCENES.locations, random),
            angle: fixed.angle || SOCIAL_DEFAULT_CAMERA_ANGLE,
            outfit: choose(SCENES.outfits, random),
            situation: fixed.situation || choose(SCENES.situations, random),
            lighting: fixed.lighting || choose(SCENES.lighting, random),
            atmosphere: fixed.atmosphere || choose(SCENES.atmospheres, random),
            condition: fixed.condition || choose(SCENES.conditions, random),
            details: fixed.details
        };
        scene.key = sceneKey(scene);
        fallback = scene;
        if (!recent.has(scene.key)) return scene;
    }

    return fallback;
}

/**
 * Memetakan satu baris social_post_schedules ke bentuk override untuk
 * createScenePlan. Kolom kosong berarti "otomatis".
 */
export function sceneOverridesFromSchedule(schedule = {}) {
    return {
        location: schedule.scene_location,
        angle: schedule.camera_angle,
        situation: schedule.scene_situation,
        lighting: schedule.scene_lighting,
        atmosphere: schedule.scene_atmosphere,
        condition: schedule.scene_condition,
        details: schedule.scene_details
    };
}

/**
 * Picks one outfit at random. Outfits used by the most recent posts are skipped
 * when another option exists, so back-to-back posts do not repeat the wardrobe
 * while the choice stays unpredictable.
 */
export function pickRandomOutfit(outfits = [], recentOutfitIds = [], random = Math.random) {
    const active = (Array.isArray(outfits) ? outfits : [])
        .filter(outfit => outfit && outfit.id && outfit.is_active !== false);
    if (!active.length) return null;

    const recent = new Set(
        (Array.isArray(recentOutfitIds) ? recentOutfitIds : [])
            .filter(Boolean)
            .map(id => String(id))
    );
    const fresh = active.filter(outfit => !recent.has(String(outfit.id)));
    const pool = fresh.length ? fresh : active;

    const roll = Number(random());
    const normalized = Number.isFinite(roll) ? Math.min(0.999999, Math.max(0, roll)) : 0;
    return pool[Math.floor(normalized * pool.length)] || pool[0];
}

/** Writes the chosen outfit into the scene so prompts and {outfit} captions agree. */
export function applyOutfitToScene(scene = {}, outfit = null) {
    const name = String(outfit?.name || "").trim().slice(0, 80);
    if (!name) return { ...scene };
    const next = { ...scene, outfit: name };
    next.key = sceneKey(next);
    return next;
}

export function sanitizeHttpsUrl(value) {
    const text = String(value || "").trim();
    if (!text) return "";
    try {
        const url = new URL(text);
        return url.protocol === "https:" ? url.toString() : "";
    } catch {
        return "";
    }
}

/**
 * Public caption block for the randomly selected outfit. The order link is the
 * call to action, so it sits above the generic external link and hashtags.
 */
export function formatOutfitCaption(outfit = {}) {
    const name = String(outfit?.name || "").trim().slice(0, 80);
    const orderUrl = sanitizeHttpsUrl(outfit?.order_url);
    if (!name && !orderUrl) return "";

    return [
        name ? `✨ Outfit: ${name}` : "",
        orderUrl ? `🛍️ Order di sini: ${orderUrl}` : ""
    ].filter(Boolean).join("\n");
}

export function buildImagePrompt({
    characterName,
    characterNotes,
    scene,
    aspectRatio = "9:16",
    outfitName = "",
    outfitNotes = "",
    hasOutfitReference = false,
    useReferenceOutfit = false,
    negativePrompt = ""
}) {
    const name = String(characterName || "the reference subject").trim().slice(0, 80);
    const notes = String(characterNotes || "").trim().slice(0, 1200);
    const camera = String(scene?.angle || "").trim() || SOCIAL_DEFAULT_CAMERA_ANGLE;
    const atmosphere = String(scene?.atmosphere || "").trim().slice(0, 300);
    const condition = String(scene?.condition || "").trim().slice(0, 300);
    const details = String(scene?.details || "").trim().slice(0, 400);
    const negative = [SOCIAL_AUTO_NEGATIVE_PROMPT, String(negativePrompt || "").trim().slice(0, 400)]
        .filter(Boolean)
        .join(", ");
    const ratio = ["9:16", "16:9"].includes(aspectRatio) ? aspectRatio : "9:16";
    const wardrobeName = String(outfitName || "").trim().slice(0, 120);
    const wardrobeNotes = String(outfitNotes || "").trim().slice(0, 400);
    const wardrobe = hasOutfitReference
        ? [
            `dress the subject in exactly the garment shown in the supplied outfit reference image${wardrobeName ? ` ("${wardrobeName}")` : ""}`,
            wardrobeNotes,
            "preserve the fabric, color, cut, and pattern of that garment; do not redesign it"
        ].filter(Boolean).join("; ")
        : wardrobeName
            ? `${wardrobeName}${wardrobeNotes ? ` — ${wardrobeNotes}` : ""}`
            : useReferenceOutfit
                /* Tanpa outfit, pakaian mengikuti foto referensi karakter. */
                ? "keep the exact outfit the subject is already wearing in the reference image; preserve its fabric, color, cut, and pattern, and do not invent a different wardrobe"
                : scene.outfit;

    return [
        `Create one highly realistic, natural-looking lifestyle photograph of the same adult character shown in the supplied reference image. Treat that image as the identity reference. Keep the same recognizable face, facial proportions, skin tone, hair, and defining features; do not substitute a different person. The character is called ${name}.`,
        notes ? `Character-specific direction: ${notes}` : "",
        `Scene: ${scene.situation} at ${scene.location}.`,
        atmosphere ? `Atmosphere: ${atmosphere}.` : "",
        condition ? `Conditions: ${condition}.` : "",
        `Wardrobe: ${wardrobe}.`,
        `Camera: ${camera}.`,
        `Lighting: ${scene.lighting}.`,
        details ? `Additional direction: ${details}` : "",
        "Make the pose, clothing folds, reflections, shadows, and background physically plausible. Keep the subject's age and identity consistent with the reference. Use a tasteful, non-explicit editorial style, realistic anatomy, lifelike skin texture, and a naturally imperfect photographic composition.",
        "Keep exactly one foreground person: the reference subject.",
        `Negative prompt: ${negative}`,
        ratio === "9:16"
            ? "Compose as a vertical 9:16 social-media image, with the subject clearly visible and enough background to communicate the location."
            : "Compose as a horizontal 16:9 social-media image, with the subject clearly visible and enough background to communicate the location."
    ].filter(Boolean).join("\n\n");
}

export function normalizeSocialAspectRatio(value) {
    return ["9:16", "16:9"].includes(value) ? value : null;
}

export function renderCaption(template, scene, characterName = "") {
    const source = String(template || "Cerita hari ini dari {location} ✨").slice(0, 1000);
    const fields = {
        name: String(characterName || "").slice(0, 80),
        location: scene.location,
        outfit: scene.outfit,
        situation: scene.situation,
        lighting: scene.lighting,
        angle: scene.angle,
        atmosphere: scene.atmosphere,
        condition: scene.condition
    };

    return source.replace(/\{(name|location|outfit|situation|lighting|angle|atmosphere|condition)\}/gi, (match, key) => {
        return fields[key.toLowerCase()] ?? match;
    }).trim();
}

export function composeSocialCaption({ baseCaption, contextualCaption, externalLink, outfit }) {
    const base = String(baseCaption || "").slice(0, 1000).trim();
    const context = String(contextualCaption || "").slice(0, 280).trim();
    const safeLink = sanitizeHttpsUrl(externalLink);
    const outfitBlock = formatOutfitCaption(outfit);

    const hashtags = [];
    const captionWithoutHashtags = base.replace(/#[\p{L}\p{N}_]+/gu, tag => {
        hashtags.push(tag);
        return "";
    }).replace(/\s{2,}/g, " ").trim();

    return [
        captionWithoutHashtags,
        context,
        outfitBlock,
        // The outfit order URL is already part of the caption in that case.
        outfitBlock && safeLink && outfitBlock.includes(safeLink) ? "" : safeLink,
        [...new Set(hashtags)].join(" ")
    ].filter(Boolean).join("\n\n").slice(0, 2000);
}

/**
 * Autopost interval limits per account role. OWNER, ADMIN, and USER may not
 * schedule anything faster than once per hour; the shape stays per-role so a
 * different minimum can be granted later without touching the API or UI.
 */
export const SOCIAL_SCHEDULE_INTERVAL_POLICY = Object.freeze({
    /* maxSchedules: null berarti tanpa batas jumlah blok jadwal. */
    OWNER: Object.freeze({ minHours: 1, maxHours: 168, maxSchedules: null }),
    ADMIN: Object.freeze({ minHours: 1, maxHours: 168, maxSchedules: null }),
    USER: Object.freeze({ minHours: 1, maxHours: 168, maxSchedules: 2 })
});

export const SOCIAL_SCHEDULE_DEFAULT_MIN_HOURS = 1;
export const SOCIAL_SCHEDULE_DEFAULT_MAX_HOURS = 168;

export function normalizeSocialRole(value) {
    const role = String(value || "").trim().toUpperCase();
    return Object.prototype.hasOwnProperty.call(SOCIAL_SCHEDULE_INTERVAL_POLICY, role) ? role : "";
}

/**
 * Returns the interval limits that apply to a profile role, or null when the
 * role is not allowed to create autopost schedules.
 */
export function getScheduleIntervalPolicy(roleValue) {
    const role = normalizeSocialRole(roleValue);
    if (!role) return null;
    const policy = SOCIAL_SCHEDULE_INTERVAL_POLICY[role];
    return {
        role,
        minIntervalHours: policy.minHours,
        maxIntervalHours: policy.maxHours,
        maxSchedules: policy.maxSchedules
    };
}

export function clampIntervalHours(
    value,
    minHours = SOCIAL_SCHEDULE_DEFAULT_MIN_HOURS,
    maxHours = SOCIAL_SCHEDULE_DEFAULT_MAX_HOURS
) {
    const hours = Number(value);
    if (!Number.isInteger(hours) || hours < minHours || hours > maxHours) return null;
    return hours;
}

export function normalizeMimeType(value) {
    const mime = String(value || "").toLowerCase().split(";")[0].trim();
    return ["image/jpeg", "image/png", "image/webp"].includes(mime) ? mime : null;
}

export function extensionForMime(mime) {
    return ({
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp"
    })[mime] || "bin";
}

export function bytesToBase64(value) {
    const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
    const chunkSize = 0x8000;
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    return btoa(binary);
}

export function base64ToBytes(value) {
    const binary = atob(String(value || ""));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
}

export function getLocalDateTimeInputValue(date = new Date(), timeZone = "Asia/Jakarta") {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23"
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}

export function localDateTimeToUtc(value, timeZone = "Asia/Jakarta") {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
    if (!match) return null;

    const [, year, month, day, hour, minute] = match.map(Number);
    const desiredUtcLike = Date.UTC(year, month - 1, day, hour, minute);
    let guess = desiredUtcLike;

    for (let attempt = 0; attempt < 3; attempt += 1) {
        const parts = new Intl.DateTimeFormat("en-CA", {
            timeZone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23"
        }).formatToParts(new Date(guess));
        const values = Object.fromEntries(parts.map(part => [part.type, Number(part.value)]));
        const observedUtcLike = Date.UTC(
            values.year,
            values.month - 1,
            values.day,
            values.hour,
            values.minute
        );
        const delta = desiredUtcLike - observedUtcLike;
        guess += delta;
        if (delta === 0) break;
    }

    return new Date(guess).toISOString();
}

export const SOCIAL_SCENE_CATALOG = SCENES;

export const SOCIAL_RUNS_PER_PAGE_OPTIONS = Object.freeze([10, 20, 50, 100]);
export const DEFAULT_SOCIAL_RUNS_PER_PAGE = 10;

export function normalizeRunsPerPage(value, fallback = DEFAULT_SOCIAL_RUNS_PER_PAGE) {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && SOCIAL_RUNS_PER_PAGE_OPTIONS.includes(parsed)) {
        return parsed;
    }
    return fallback;
}

export function normalizeRunsPage(value) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) return 1;
    return Math.min(parsed, 100000);
}

export function parseContentRangeTotal(headerValue) {
    const match = String(headerValue || "").trim().match(/\/(\d+)\s*$/);
    if (!match) return null;
    const total = Number(match[1]);
    return Number.isSafeInteger(total) && total >= 0 ? total : null;
}

export function buildRunsPageSequence(currentPage, totalPages) {
    const total = Math.max(1, Math.floor(Number(totalPages) || 1));
    const current = Math.min(total, Math.max(1, Math.floor(Number(currentPage) || 1)));

    if (total <= 7) {
        return Array.from({ length: total }, (_, index) => index + 1);
    }
    if (current <= 4) {
        return [1, 2, 3, 4, 5, "…", total];
    }
    if (current >= total - 3) {
        return [1, "…", total - 4, total - 3, total - 2, total - 1, total];
    }
    return [1, "…", current - 1, current, current + 1, "…", total];
}

