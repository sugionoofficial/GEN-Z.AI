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

export function buildImagePrompt({ characterName, characterNotes, scene, aspectRatio = "9:16" }) {
    const name = String(characterName || "the reference subject").trim().slice(0, 80);
    const notes = String(characterNotes || "").trim().slice(0, 1200);
    const ratio = ["9:16", "16:9"].includes(aspectRatio) ? aspectRatio : "9:16";

    return [
        `Create one highly realistic, natural-looking lifestyle photograph of the same adult character shown in the supplied reference image. Treat that image as the identity reference. Keep the same recognizable face, facial proportions, skin tone, hair, and defining features; do not substitute a different person. The character is called ${name}.`,
        notes ? `Character-specific direction: ${notes}` : "",
        `Scene: ${scene.situation} at ${scene.location}.`,
        `Wardrobe: ${scene.outfit}.`,
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

export function composeSocialCaption({ baseCaption, contextualCaption, externalLink }) {
    const base = String(baseCaption || "").slice(0, 1000).trim();
    const context = String(contextualCaption || "").slice(0, 280).trim();
    const linkValue = String(externalLink || "").trim();
    let safeLink = "";
    if (linkValue) {
        try {
            const url = new URL(linkValue);
            if (url.protocol === "https:") safeLink = url.toString();
        } catch {
            safeLink = "";
        }
    }

    const hashtags = [];
    const captionWithoutHashtags = base.replace(/#[\p{L}\p{N}_]+/gu, tag => {
        hashtags.push(tag);
        return "";
    }).replace(/\s{2,}/g, " ").trim();

    return [
        captionWithoutHashtags,
        context,
        safeLink,
        [...new Set(hashtags)].join(" ")
    ].filter(Boolean).join("\n\n").slice(0, 2000);
}

export function clampIntervalHours(value) {
    const hours = Number(value);
    if (!Number.isInteger(hours) || hours < 1 || hours > 168) return null;
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
