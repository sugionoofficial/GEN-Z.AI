const SCENES = {
    locations: [
        "a warm, design-forward coffee shop in Jakarta",
        "a rain-washed old-town street with colonial-era architecture",
        "a sunlit rooftop garden overlooking the city skyline",
        "a quiet seaside promenade at golden hour",
        "a modern art gallery with soft neutral walls",
        "a leafy botanical garden after light rain",
        "a weekend market with colorful stalls in the background",
        "a minimalist studio with natural window light",
        "a calm bookshop with tall shelves and warm lamps",
        "a city crosswalk at blue hour with softly blurred traffic"
    ],
    angles: [
        "eye-level medium portrait with a natural 50mm lens perspective",
        "slightly elevated three-quarter portrait with a natural 35mm lens perspective",
        "low-angle environmental portrait with the location visible around the subject",
        "over-the-shoulder candid frame with the subject turning naturally toward camera",
        "wide environmental portrait with generous negative space",
        "tight head-and-shoulders portrait with gentle background compression"
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
        "pausing to enjoy a drink and looking thoughtfully out of the window",
        "walking naturally through the location while carrying a small bag",
        "reading a book at a quiet table, captured between moments",
        "greeting a friend just outside the frame with a relaxed smile",
        "checking a camera and then looking up toward the photographer",
        "standing comfortably and taking in the surrounding view",
        "holding a takeaway cup while crossing the street",
        "browsing a display and noticing something interesting"
    ],
    lighting: [
        "soft overcast daylight with gentle, realistic shadows",
        "warm late-afternoon golden-hour light with natural skin tones",
        "diffused window light from one side and subtle fill from the room",
        "soft blue-hour ambient light balanced with warm practical lights",
        "bright but soft morning daylight with clean highlights",
        "cinematic evening light with restrained contrast and no artificial glow"
    ]
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
        scene.lighting
    ].join("|");
}

export function createScenePlan(recentKeys = [], random = Math.random) {
    const recent = new Set(Array.isArray(recentKeys) ? recentKeys : []);
    let fallback = null;

    for (let attempt = 0; attempt < 24; attempt += 1) {
        const scene = {
            location: choose(SCENES.locations, random),
            angle: choose(SCENES.angles, random),
            outfit: choose(SCENES.outfits, random),
            situation: choose(SCENES.situations, random),
            lighting: choose(SCENES.lighting, random)
        };
        scene.key = sceneKey(scene);
        fallback = scene;
        if (!recent.has(scene.key)) return scene;
    }

    return fallback;
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
    hasOutfitReference = false
}) {
    const name = String(characterName || "the reference subject").trim().slice(0, 80);
    const notes = String(characterNotes || "").trim().slice(0, 1200);
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
            : scene.outfit;

    return [
        `Create one highly realistic, natural-looking lifestyle photograph of the same adult character shown in the supplied reference image. Treat that image as the identity reference. Keep the same recognizable face, facial proportions, skin tone, hair, and defining features; do not substitute a different person. The character is called ${name}.`,
        notes ? `Character-specific direction: ${notes}` : "",
        `Scene: ${scene.situation} at ${scene.location}.`,
        `Wardrobe: ${wardrobe}.`,
        `Camera: ${scene.angle}.`,
        `Lighting: ${scene.lighting}.`,
        "Make the pose, clothing folds, reflections, shadows, and background physically plausible. Keep the subject's age and identity consistent with the reference. Use a tasteful, non-explicit editorial style, realistic anatomy, lifelike skin texture, and a naturally imperfect photographic composition.",
        "Avoid text, logos, watermarks, beauty-filter skin, plastic-looking faces, extra fingers, distorted hands, duplicate people, and exaggerated proportions. Do not add another foreground person.",
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
        angle: scene.angle
    };

    return source.replace(/\{(name|location|outfit|situation|lighting|angle)\}/gi, (match, key) => {
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
    OWNER: Object.freeze({ minHours: 1, maxHours: 168 }),
    ADMIN: Object.freeze({ minHours: 1, maxHours: 168 }),
    USER: Object.freeze({ minHours: 1, maxHours: 168 })
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
        maxIntervalHours: policy.maxHours
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

