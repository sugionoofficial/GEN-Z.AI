import {
    getSource,
    sanitizeParameters,
    validate
} from "./parameters.js";
import config from "./config.js";

const ALLOWED_FIELDS = new Set([
    "model",
    "image_urls",
    "video_urls",
    "prompt",
    "aspect_ratio",
    "duration",
    "webhook_url"
]);

function buildPayload(body = {}) {
    const payload = {
        model: config.motiongenModelId,
        ...sanitizeParameters(getSource(body))
    };

    return Object.fromEntries(
        Object.entries(payload).filter(([key, value]) =>
            ALLOWED_FIELDS.has(key) &&
            value !== "" &&
            !(Array.isArray(value) && value.length === 0)
        )
    );
}

function validateParameters(body = {}) {
    return validate(sanitizeParameters(getSource(body)));
}

export { buildPayload, validateParameters };
