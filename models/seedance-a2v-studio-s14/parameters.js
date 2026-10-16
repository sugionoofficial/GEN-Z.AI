const parameters = [
    {
        name: "image_urls",
        type: "image_urls",
        required: true,
        minItems: 1,
        maxItems: 1,
        accept: "image/jpeg,image/png,image/webp",
        description: "Satu URL publik gambar JPG, PNG, atau WEBP."
    },
    {
        name: "audio_url",
        type: "audio_url",
        required: true,
        accept: ".mp3,.wav,audio/mpeg,audio/wav",
        description: "URL publik audio MP3 atau WAV."
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
        enum: ["5", "8", "10", "12", "15", "30"],
        default: "15",
        description: "Durasi video dalam detik."
    },
    {
        name: "resolution",
        type: "string",
        required: false,
        enum: ["480p", "720p", "1080p"],
        default: "720p",
        description: "Resolusi output video."
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
        audio_url: normalizeString(source.audio_url),
        prompt: normalizeString(source.prompt),
        aspect_ratio: normalizeString(source.aspect_ratio) || "9:16",
        duration: normalizeString(source.duration) || "15",
        resolution: normalizeString(source.resolution) || "720p",
        ...(webhookUrl ? { webhook_url: webhookUrl } : {})
    };
}

function sanitizeParameters(body = {}) {
    return getParameters(body);
}

function validate(input = {}) {
    const errors = [];
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        return { valid: false, errors: ["Parameter input harus berupa object."] };
    }

    const images = normalizeUrls(input.image_urls);
    if (images.length !== 1) errors.push("MotionGen membutuhkan tepat 1 gambar referensi.");

    const audioUrl = normalizeString(input.audio_url);
    if (!audioUrl) {
        errors.push("Audio wajib diisi.");
    } else if (!isHttpUrl(audioUrl)) {
        errors.push("Audio harus berupa URL HTTP atau HTTPS yang valid.");
    }

    if (images.length === 1 && !isHttpUrl(images[0])) {
        errors.push("Gambar harus berupa URL HTTP atau HTTPS yang valid.");
    }

    const prompt = normalizeString(input.prompt);
    if (prompt.length > definitions.get("prompt").maxLength) {
        errors.push(`Prompt maksimal ${definitions.get("prompt").maxLength} karakter.`);
    }

    for (const name of ["aspect_ratio", "duration", "resolution"]) {
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
export default parameters;
