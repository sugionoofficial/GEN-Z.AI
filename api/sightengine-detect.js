/* =========================================================
   GEN-Z.AI
   SIGHTENGINE AI DETECTION API
   ---------------------------------------------------------
   File:
   api/sightengine-detect.js

   Tanggung jawab:
   - Menerima image dari frontend
   - Menjaga Sightengine credentials tetap server-side
   - Mengirim image ke Sightengine
   - Menggunakan model genai
   - Menormalisasi hasil AI detection
   - Mengembalikan generator scores
   - Mengembalikan request metadata
   - Mengembalikan media metadata
   - Tidak menyimpan file/image
========================================================= */

const SIGHTENGINE_ENDPOINT =
    "https://api.sightengine.com/1.0/check.json";

const SIGHTENGINE_MODEL =
    "genai";

const MAX_IMAGE_SIZE =
    15 * 1024 * 1024;


/* =========================================================
   ENVIRONMENT
========================================================= */

function getSightengineConfig() {

    const apiUser =
        process.env.SIGHTENGINE_API_USER;

    const apiSecret =
        process.env.SIGHTENGINE_API_SECRET;

    if (
        !apiUser ||
        !apiSecret
    ) {

        throw new Error(
            "Sightengine credentials are not configured."
        );

    }

    return {
        apiUser,
        apiSecret
    };

}


/* =========================================================
   RESPONSE HELPERS
========================================================= */

function sendJson(
    res,
    status,
    payload
) {

    res
        .status(status)
        .json(payload);

}


/* =========================================================
   METHOD VALIDATION
========================================================= */

function ensurePostMethod(
    req,
    res
) {

    if (
        req.method !== "POST"
    ) {

        sendJson(
            res,
            405,
            {
                success: false,
                error:
                    "Method not allowed."
            }
        );

        return false;

    }

    return true;

}


/* =========================================================
   BODY VALIDATION
========================================================= */

function getImageData(
    req
) {

    const body =
        req.body || {};

    const image =
        body.image;

    if (
        typeof image !== "string" ||
        image.trim() === ""
    ) {

        throw new Error(
            "Image data is required."
        );

    }

    return image.trim();

}


/* =========================================================
   DATA URL PARSER
========================================================= */

function parseDataUrl(
    dataUrl
) {

    const match =
        dataUrl.match(
            /^data:([^;,]+)?(?:;[^,]*)?,(.*)$/s
        );

    if (
        !match
    ) {

        throw new Error(
            "Invalid image data."
        );

    }

    const mimeType =
        match[1] ||
        "application/octet-stream";

    const encodedData =
        match[2];

    if (
        !encodedData
    ) {

        throw new Error(
            "Image data is empty."
        );

    }

    return {
        mimeType,
        encodedData
    };

}


/* =========================================================
   MIME VALIDATION
========================================================= */

function isSupportedImageType(
    mimeType
) {

    const supportedTypes =
        new Set([
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif",
            "image/bmp",
            "image/tiff"
        ]);

    return supportedTypes.has(
        String(mimeType || "")
            .toLowerCase()
    );

}


/* =========================================================
   BASE64 SIZE
========================================================= */

function getBase64ByteSize(
    base64
) {

    const normalized =
        String(base64 || "")
            .replace(/\s/g, "");

    if (
        normalized.length === 0
    ) {

        return 0;

    }

    const padding =
        normalized.endsWith("==")
            ? 2
            : normalized.endsWith("=")
                ? 1
                : 0;

    return Math.floor(
        normalized.length * 3 / 4
    ) - padding;

}


/* =========================================================
   SCORE NORMALIZATION
========================================================= */

function normalizeScore(
    value
) {

    const numeric =
        Number(value);

    if (
        !Number.isFinite(numeric)
    ) {

        return null;

    }

    if (
        numeric < 0
    ) {

        return 0;

    }

    if (
        numeric > 1
    ) {

        return 1;

    }

    return numeric;

}


/* =========================================================
   PERCENTAGE
========================================================= */

function scoreToPercentage(
    score
) {

    const normalized =
        normalizeScore(score);

    if (
        normalized === null
    ) {

        return null;

    }

    return Math.round(
        normalized * 100
    );

}


/* =========================================================
   GENERATOR NAME
========================================================= */

function normalizeGeneratorName(
    name
) {

    if (
        typeof name !== "string"
    ) {

        return "";

    }

    return name.trim();

}


/* =========================================================
   GENERATOR SCORES
========================================================= */

function extractGeneratorScores(
    type
) {

    const generators =
        type?.ai_generators;

    if (
        !generators ||
        typeof generators !== "object" ||
        Array.isArray(generators)
    ) {

        return [];

    }

    return Object.entries(
        generators
    )
        .map(
            ([name, rawScore]) => {

                const score =
                    normalizeScore(
                        rawScore
                    );

                if (
                    score === null
                ) {

                    return null;

                }

                const normalizedName =
                    normalizeGeneratorName(
                        name
                    );

                if (
                    !normalizedName
                ) {

                    return null;

                }

                return {
                    name:
                        normalizedName,

                    score,

                    confidence:
                        scoreToPercentage(
                            score
                        )
                };

            }
        )
        .filter(Boolean)
        .sort(
            (a, b) =>
                b.score -
                a.score
        );

}


/* =========================================================
   DETECTED GENERATOR
   ---------------------------------------------------------
   Generator dianggap terdeteksi hanya jika score >= 0.5.
========================================================= */

function getDetectedGenerator(
    generators
) {

    if (
        !Array.isArray(generators) ||
        generators.length === 0
    ) {

        return null;

    }

    const topGenerator =
        generators[0];

    if (
        !topGenerator
    ) {

        return null;

    }

    if (
        !Number.isFinite(
            topGenerator.score
        )
    ) {

        return null;

    }

    if (
        topGenerator.score < 0.5
    ) {

        return null;

    }

    return {
        name:
            topGenerator.name,

        score:
            topGenerator.score,

        confidence:
            topGenerator.confidence
    };

}


/* =========================================================
   REQUEST METADATA
========================================================= */

function normalizeRequestMetadata(
    request
) {

    if (
        !request ||
        typeof request !== "object"
    ) {

        return null;

    }

    return {
        id:
            typeof request.id === "string"
                ? request.id
                : null,

        timestamp:
            Number.isFinite(
                Number(request.timestamp)
            )
                ? Number(request.timestamp)
                : null,

        operations:
            Number.isFinite(
                Number(request.operations)
            )
                ? Number(request.operations)
                : null
    };

}


/* =========================================================
   MEDIA METADATA
========================================================= */

function normalizeMediaMetadata(
    media
) {

    if (
        !media ||
        typeof media !== "object"
    ) {

        return null;

    }

    return {
        id:
            typeof media.id === "string"
                ? media.id
                : null,

        uri:
            typeof media.uri === "string"
                ? media.uri
                : null
    };

}


/* =========================================================
   DETECTION NORMALIZATION
========================================================= */

function normalizeDetectionResponse(
    data,
    model
) {

    const type =
        data?.type || {};

    const aiGenerated =
        normalizeScore(
            type.ai_generated
        );

    const generators =
        extractGeneratorScores(
            type
        );

    const detectedGenerator =
        getDetectedGenerator(
            generators
        );

    return {

        model:
            model ||
            null,

        ai_generated:
            aiGenerated,

        confidence:
            scoreToPercentage(
                aiGenerated
            ),

        is_ai_generated:
            aiGenerated !== null &&
            aiGenerated >= 0.5,

        generators,

        detected_generator:
            detectedGenerator,

        request:
            normalizeRequestMetadata(
                data?.request
            ),

        media:
            normalizeMediaMetadata(
                data?.media
            )

    };

}


/* =========================================================
   SIGHTENGINE REQUEST
========================================================= */

async function requestSightengine(
    imageData
) {

    const config =
        getSightengineConfig();

    const parsed =
        parseDataUrl(
            imageData
        );

    if (
        !isSupportedImageType(
            parsed.mimeType
        )
    ) {

        throw new Error(
            `Unsupported image type: ${parsed.mimeType}`
        );

    }

    const byteSize =
        getBase64ByteSize(
            parsed.encodedData
        );

    if (
        byteSize <= 0
    ) {

        throw new Error(
            "Image data is empty."
        );

    }

    if (
        byteSize > MAX_IMAGE_SIZE
    ) {

        throw new Error(
            "Image exceeds the 15 MB Sightengine limit."
        );

    }

    const imageBuffer =
        Buffer.from(
            parsed.encodedData,
            "base64"
        );

    if (
        !imageBuffer ||
        imageBuffer.length === 0
    ) {

        throw new Error(
            "Unable to decode image."
        );

    }

    if (
        imageBuffer.length >
        MAX_IMAGE_SIZE
    ) {

        throw new Error(
            "Image exceeds the 15 MB Sightengine limit."
        );

    }

    const formData =
        new FormData();

    formData.append(
        "api_user",
        config.apiUser
    );

    formData.append(
        "api_secret",
        config.apiSecret
    );

    formData.append(
        "models",
        SIGHTENGINE_MODEL
    );

    const blob =
        new Blob(
            [
                imageBuffer
            ],
            {
                type:
                    parsed.mimeType
            }
        );

    formData.append(
        "media",
        blob,
        "upload"
    );

    const response =
        await fetch(
            SIGHTENGINE_ENDPOINT,
            {
                method:
                    "POST",

                body:
                    formData
            }
        );

    let data = null;

    try {

        data =
            await response.json();

    } catch {

        throw new Error(
            `Sightengine returned an invalid response (${response.status}).`
        );

    }

    if (
        !response.ok
    ) {

        const message =
            data?.error?.message ||
            data?.error ||
            `Sightengine request failed (${response.status}).`;

        throw new Error(
            String(message)
        );

    }

    if (
        data?.status &&
        data.status !== "success"
    ) {

        const message =
            data?.error?.message ||
            data?.error ||
            "Sightengine detection failed.";

        throw new Error(
            String(message)
        );

    }

    return data;

}


/* =========================================================
   MAIN HANDLER
========================================================= */

export default async function handler(
    req,
    res
) {

    if (
        !ensurePostMethod(
            req,
            res
        )
    ) {

        return;

    }

    try {

        const imageData =
            getImageData(
                req
            );

        const sightengineResponse =
            await requestSightengine(
                imageData
            );

        const detection =
            normalizeDetectionResponse(
                sightengineResponse,
                SIGHTENGINE_MODEL
            );

        sendJson(
            res,
            200,
            {
                success:
                    true,

                provider:
                    "sightengine",

                model:
                    SIGHTENGINE_MODEL,

                detection
            }
        );

    } catch (
        error
    ) {

        console.error(
            "[Sightengine]",
            error
        );

        sendJson(
            res,
            500,
            {
                success:
                    false,

                error:
                    error?.message ||
                    "Sightengine detection failed."
            }
        );

    }

}
