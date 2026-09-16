/**
 * GEN-Z.AI
 * KIE.AI MODEL ADAPTER
 *
 * File:
 * provider/kie/grok-imagine-image-to-video.js
 *
 * Model:
 * grok-imagine/image-to-video
 *
 * API key TIDAK disimpan di file ini.
 */

const MODEL_ID = "grok-imagine/image-to-video";

const PROVIDER_ID = "kie_ai";

const API_ENDPOINT = "/api/generate";


function normalizeString(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value).trim();
}


function buildPayload(options = {}) {

    const prompt =
        normalizeString(options.prompt);

    const ratio =
        normalizeString(
            options.ratio || "9:16"
        );

    const duration =
        normalizeString(
            options.duration || "8"
        );

    const resolution =
        normalizeString(
            options.resolution || "720p"
        );

    return {
        provider: PROVIDER_ID,
        model: MODEL_ID,
        prompt,
        ratio,
        duration,
        resolution
    };
}


function validate(options = {}) {

    const prompt =
        normalizeString(options.prompt);

    if (!prompt) {

        return {
            valid: false,
            error: "Prompt belum diisi."
        };

    }

    return {
        valid: true
    };
}


async function generate(options = {}) {

    const validation =
        validate(options);

    if (!validation.valid) {

        throw new Error(
            validation.error
        );

    }

    const payload =
        buildPayload(options);

    const response =
        await fetch(
            API_ENDPOINT,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body:
                    JSON.stringify(payload)
            }
        );

    const contentType =
        response.headers.get(
            "content-type"
        ) || "";

    let data;

    if (
        contentType.includes(
            "application/json"
        )
    ) {

        data =
            await response.json();

    } else {

        const text =
            await response.text();

        data = {
            success: response.ok,
            response: text
        };

    }


    if (!response.ok) {

        throw new Error(
            data?.error ||
            data?.message ||
            "KIE.AI gagal memproses request."
        );

    }


    return data;

}


export {
    MODEL_ID,
    PROVIDER_ID,
    buildPayload,
    validate,
    generate
};


export default {
    MODEL_ID,
    PROVIDER_ID,
    buildPayload,
    validate,
    generate
};
