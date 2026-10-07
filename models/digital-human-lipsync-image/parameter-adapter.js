/**
 * =========================================================
 * GEN-Z.AI
 * DIGITAL HUMAN - LIPSYNC IMAGE
 * ---------------------------------------------------------
 * File:
 * models/digital-human-lipsync-image/parameter-adapter.js
 *
 * Fungsi:
 * - Mengambil source parameters
 * - Normalisasi input
 * - Menjaga parameter wajib
 * - Menghapus parameter yang tidak didukung Motiongen
 *
 * IMPORTANT:
 * - audio_url WAJIB
 * - image_urls WAJIB
 * - resolution TIDAK dikirim ke Motiongen
 * - duration berasal dari parameters.js
 * - aspect_ratio berasal dari parameters.js
 * - nsfw_checker TIDAK digunakan
 * - tidak ada KIE fallback
 * =========================================================
 */


/**
 * =========================================================
 * GET SOURCE
 * =========================================================
 *
 * Generate engine dapat mengirim:
 *
 * {
 *     parameters: {...}
 * }
 *
 * atau langsung:
 *
 * {
 *     prompt: "...",
 *     image_urls: [...]
 * }
 *
 * Keduanya didukung.
 * =========================================================
 */

function getSource(body = {}) {

    if (
        body &&
        typeof body.parameters === "object" &&
        !Array.isArray(body.parameters)
    ) {

        return body.parameters;

    }

    return body;

}


/**
 * =========================================================
 * NORMALIZE IMAGE URLS
 * =========================================================
 */

function normalizeImageUrls(
    value
) {

    if (
        Array.isArray(value)
    ) {

        return value
            .map(
                item =>
                    typeof item === "string"
                        ? item.trim()
                        : ""
            )
            .filter(Boolean);

    }


    if (
        typeof value === "string" &&
        value.trim()
    ) {

        return [
            value.trim()
        ];

    }


    return [];

}


/**
 * =========================================================
 * NORMALIZE STRING
 * =========================================================
 */

function normalizeString(
    value
) {

    if (
        typeof value !== "string"
    ) {

        return "";

    }

    return value.trim();

}


/**
 * =========================================================
 * NORMALIZE DURATION
 * =========================================================
 */

function normalizeDuration(
    value
) {

    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {

        return undefined;

    }

    const duration =
        Number(value);

    if (
        !Number.isFinite(duration)
    ) {

        return undefined;

    }

    return duration;

}


/**
 * =========================================================
 * GET PARAMETERS
 * =========================================================
 *
 * Hanya parameter yang benar-benar dimiliki model.
 *
 * Resolution sengaja TIDAK termasuk.
 *
 * =========================================================
 */

function getParameters(
    body = {}
) {

    const source =
        getSource(body);


    const result = {};


    /**
     * =====================================================
     * PROMPT
     * =====================================================
     */

    if (
        source.prompt !== undefined
    ) {

        result.prompt =
            normalizeString(
                source.prompt
            );

    }


    /**
     * =====================================================
     * IMAGE
     * =====================================================
     */

    if (
        source.image_urls !== undefined
    ) {

        result.image_urls =
            normalizeImageUrls(
                source.image_urls
            );

    }


    /**
     * =====================================================
     * AUDIO
     * =====================================================
     */

    if (
        source.audio_url !== undefined
    ) {

        result.audio_url =
            normalizeString(
                source.audio_url
            );

    }


    /**
     * =====================================================
     * ASPECT RATIO
     * =====================================================
     */

    if (
        source.aspect_ratio !== undefined
    ) {

        result.aspect_ratio =
            normalizeString(
                source.aspect_ratio
            );

    }


    /**
     * =====================================================
     * DURATION
     * =====================================================
     */

    if (
        source.duration !== undefined
    ) {

        result.duration =
            normalizeDuration(
                source.duration
            );

    }


    /**
     * =====================================================
     * WEBHOOK
     * =====================================================
     */

    if (
        source.webhook_url !== undefined
    ) {

        result.webhook_url =
            normalizeString(
                source.webhook_url
            );

    } else if (
        source.webhook !== undefined
    ) {

        /**
         * Motiongen API documentation allows
         * webhook as an alias.
         *
         * GEN-Z.AI canonical form remains:
         *
         * webhook_url
         */

        result.webhook_url =
            normalizeString(
                source.webhook
            );

    }


    return result;

}


/**
 * =========================================================
 * SANITIZE PARAMETERS
 * =========================================================
 *
 * Digunakan sebelum request dibuat.
 *
 * Jangan pernah memasukkan:
 *
 * - resolution
 * - credit
 * - credit_final
 * - nsfw_checker
 * - provider
 * - provider_id
 * - model_name
 *
 * ke payload Motiongen.
 * =========================================================
 */

function sanitizeParameters(
    body = {}
) {

    const parameters =
        getParameters(body);


    const result = {};


    /**
     * =====================================================
     * PROMPT
     * =====================================================
     */

    if (
        parameters.prompt !== undefined
    ) {

        result.prompt =
            parameters.prompt;

    }


    /**
     * =====================================================
     * IMAGE
     * =====================================================
     */

    if (
        parameters.image_urls !== undefined
    ) {

        result.image_urls =
            parameters.image_urls;

    }


    /**
     * =====================================================
     * AUDIO
     * =====================================================
     *
     * WAJIB dipertahankan.
     *
     * Jangan pernah menghapus audio_url hanya karena
     * nilainya berasal dari upload atau URL.
     * =====================================================
     */

    if (
        parameters.audio_url !== undefined
    ) {

        result.audio_url =
            parameters.audio_url;

    }


    /**
     * =====================================================
     * ASPECT RATIO
     * =====================================================
     */

    if (
        parameters.aspect_ratio !== undefined
    ) {

        result.aspect_ratio =
            parameters.aspect_ratio;

    }


    /**
     * =====================================================
     * DURATION
     * =====================================================
     */

    if (
        parameters.duration !== undefined
    ) {

        result.duration =
            parameters.duration;

    }


    /**
     * =====================================================
     * WEBHOOK
     * =====================================================
     */

    if (
        parameters.webhook_url !== undefined &&
        parameters.webhook_url !== ""
    ) {

        result.webhook_url =
            parameters.webhook_url;

    }


    return result;

}


/**
 * =========================================================
 * BUILD MOTIONGEN PAYLOAD
 * =========================================================
 *
 * Motiongen API menggunakan payload flat:
 *
 * {
 *     model,
 *     prompt,
 *     image_urls,
 *     audio_url,
 *     aspect_ratio,
 *     duration,
 *     webhook_url
 * }
 *
 * =========================================================
 */

function buildPayload(
    body = {},
    modelId = "digital-human-lipsync-image"
) {

    const parameters =
        sanitizeParameters(
            body
        );


    const payload = {

        model:
            modelId,

        ...parameters

    };


    return payload;

}


/**
 * =========================================================
 * EXPORT
 * =========================================================
 */

export {

    getSource,

    getParameters,

    sanitizeParameters,

    buildPayload

};

export default {

    getSource,

    getParameters,

    sanitizeParameters,

    buildPayload

};
