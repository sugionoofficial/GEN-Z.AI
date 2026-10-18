const parameters = [
    {
        name: "image_urls",
        type: "image_urls",
        required: true,
        minItems: 1,
        maxItems: 6,
        accept: "image/jpeg,image/png,image/webp",
        description: "1–6 URL publik gambar JPG, PNG, atau WEBP."
    },
    {
        name: "video_urls",
        type: "video_urls",
        required: false,
        maxItems: 1,
        accept: "video/mp4,video/webm",
        description: "Maksimal 1 URL publik video MP4 atau WebM sebagai referensi."
    },
    {
        name: "prompt",
        type: "string",
        required: false,
        maxLength: 30000,
        description: "Deskripsi adegan opsional."
    },
    {
        name: "aspect_ratio",
        type: "string",
        required: false,
        enum: ["9:16", "16:9"],
        default: "9:16",
        description: "Rasio aspek video."
    },
    {
        name: "duration",
        type: "string",
        required: false,
        enum: ["15"],
        default: "15",
        description: "Durasi video: 15 detik."
    },
    {
        name: "webhook_url",
        type: "string",
        required: false,
        description: "URL callback; alias webhook juga didukung."
    }
];

const definitions = new Map(parameters.map(parameter => [parameter.name, parameter]));
const normalizeString = value => value == null ? "" : String(value).trim();

function normalizeUrls(value) {
    const values = Array.isArray(value)
        ? value
        : typeof value === "string" && value.trim()
            ? [value]
            : [];

    return values.map(normalizeString).filter(Boolean);
}

function getSource(body = {}) {
    if (body?.parameters && typeof body.parameters === "object" && !Array.isArray(body.parameters)) {
        return body.parameters;
    }
    return body && typeof body === "object" && !Array.isArray(body) ? body : {};
}

function getParameters(body = {}) {
    const source = getSource(body);
    const webhookUrl = normalizeString(source.webhook_url || source.webhook);

    return {
        image_urls: normalizeUrls(source.image_urls),
        video_urls: normalizeUrls(source.video_urls),
        prompt: normalizeString(source.prompt),
        aspect_ratio: normalizeString(source.aspect_ratio) || "9:16",
        duration: normalizeString(source.duration) || "15",
        ...(webhookUrl ? { webhook_url: webhookUrl } : {})
    };
}

function validate(input = {}) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        return { valid: false, errors: ["Parameter input harus berupa object."] };
    }

    const errors = [];
    const imageUrls = normalizeUrls(input.image_urls);
    const videoUrls = normalizeUrls(input.video_urls);

    if (imageUrls.length < 1 || imageUrls.length > 6) {
        errors.push("Motiongen membutuhkan 1 sampai 6 gambar referensi.");
    }
    if (videoUrls.length > 1) {
        errors.push("Maksimal 1 video referensi.");
    }
    for (const url of [...imageUrls, ...videoUrls]) {
        if (!isHttpUrl(url)) {
            errors.push("Gambar dan video harus berupa URL HTTP atau HTTPS yang valid.");
            break;
        }
    }

    const prompt = normalizeString(input.prompt);
    if (prompt.length > definitions.get("prompt").maxLength) {
        errors.push(`Prompt maksimal ${definitions.get("prompt").maxLength} karakter.`);
    }

    for (const name of ["aspect_ratio", "duration"]) {
        const definition = definitions.get(name);
        const value = input[name] == null || input[name] === ""
            ? definition.default
            : String(input[name]).trim();
        if (!definition.enum.includes(value)) {
            errors.push(`${name} tidak valid. Pilihan: ${definition.enum.join(", ")}.`);
        }
    }

    const webhook = normalizeString(input.webhook_url || input.webhook);
    if (webhook && !isHttpUrl(webhook)) {
        errors.push("Webhook harus berupa URL HTTP atau HTTPS yang valid.");
    }

    return { valid: errors.length === 0, errors };
}

function isHttpUrl(value) {
    try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch {
        return false;
    }
}

export { getParameters, getSource, sanitizeParameters, validate };

function sanitizeParameters(body = {}) {
    return getParameters(body);
}

export default parameters;
