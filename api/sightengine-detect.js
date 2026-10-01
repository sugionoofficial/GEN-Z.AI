// ========================================
// GEN-Z.AI
// SIGHTENGINE AI IMAGE DETECTION API
// File: api/sightengine-detect.js
// ========================================
//
// Fungsi:
// - Menerima image dari Metadata Cleaner
// - Mengirim image ke Sightengine
// - Mengambil hasil AI-generated detection
// - Mengembalikan hasil ter-normalisasi ke frontend
//
// SECURITY:
// - SIGHTENGINE_API_USER hanya di server
// - SIGHTENGINE_API_SECRET hanya di server
// - Jangan pernah memasukkan credential ke frontend
//
// Request:
// POST /api/sightengine-detect
//
// JSON:
// {
//     "image_base64": "...",
//     "mime_type": "image/jpeg"
// }
//
// Response:
// {
//     "success": true,
//     "detection": {
//         "ai_generated": 0.98,
//         "is_ai_generated": true,
//         "confidence": 98,
//         "generators": []
//     }
// }
// ========================================


// ========================================
// CONFIG
// ========================================

const SIGHTENGINE_ENDPOINT =
    "https://api.sightengine.com/1.0/check.json";


// Maximum raw binary image size.
// 15 MB cukup untuk detector image dan mencegah
// payload frontend menjadi terlalu besar.
const MAX_IMAGE_BYTES =
    15 * 1024 * 1024;


// ========================================
// JSON RESPONSE
// ========================================

const json = (
    res,
    status,
    data
) => {

    return res
        .status(status)
        .json(data);

};


// ========================================
// HEADER
// ========================================

const getHeader = (
    req,
    name
) => {

    const headers =
        req.headers || {};

    return (
        headers[name] ||
        headers[name.toLowerCase()] ||
        ""
    );

};


// ========================================
// PARSE BODY
// ========================================

const parseBody = (
    req
) => {

    if (
        req.body &&
        typeof req.body === "object" &&
        !Buffer.isBuffer(req.body)
    ) {

        return req.body;

    }


    if (
        typeof req.body === "string"
    ) {

        try {

            return JSON.parse(
                req.body
            );

        } catch {

            return {};

        }

    }


    return {};

};


// ========================================
// NORMALIZE MIME
// ========================================

const normalizeMimeType = (
    value
) => {

    return String(
        value || ""
    )
        .trim()
        .toLowerCase()
        .split(";")[0];

};


// ========================================
// SUPPORTED IMAGE TYPES
// ========================================

const SUPPORTED_IMAGE_TYPES =
    new Set([

        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "image/bmp",
        "image/tiff",
        "image/avif"

    ]);


// ========================================
// VALIDATE IMAGE MIME
// ========================================

const isSupportedImageType = (
    mimeType
) => {

    return SUPPORTED_IMAGE_TYPES.has(
        normalizeMimeType(
            mimeType
        )
    );

};


// ========================================
// BASE64 CLEANER
// ========================================

const normalizeBase64 = (
    value
) => {

    if (
        typeof value !== "string"
    ) {

        return "";

    }


    let base64 =
        value.trim();


    // Support both:
    //
    // data:image/jpeg;base64,AAAA...
    //
    // and:
    //
    // AAAA...
    //

    if (
        base64.startsWith(
            "data:"
        )
    ) {

        const comma =
            base64.indexOf(",");

        if (
            comma === -1
        ) {

            return "";

        }

        base64 =
            base64.slice(
                comma + 1
            );

    }


    // Remove accidental whitespace
    // or line breaks.

    base64 =
        base64.replace(
            /\s+/g,
            ""
        );


    return base64;

};


// ========================================
// BASE64 VALIDATION
// ========================================

const isValidBase64 = (
    value
) => {

    if (
        typeof value !== "string" ||
        !value
    ) {

        return false;

    }


    // Base64 must have a valid length.

    if (
        value.length % 4 !== 0
    ) {

        return false;

    }


    return /^[A-Za-z0-9+/]*={0,2}$/
        .test(
            value
        );

};


// ========================================
// ESTIMATE DECODED SIZE
// ========================================

const estimateBase64Bytes = (
    base64
) => {

    if (
        !base64
    ) {

        return 0;

    }


    const padding =
        base64.endsWith("==")
            ? 2
            : base64.endsWith("=")
                ? 1
                : 0;


    return Math.floor(
        (base64.length * 3) / 4
    ) - padding;

};


// ========================================
// READ ENVIRONMENT
// ========================================

const getSightengineConfig = () => {

    const apiUser =
        String(
            process.env.SIGHTENGINE_API_USER ||
            ""
        ).trim();


    const apiSecret =
        String(
            process.env.SIGHTENGINE_API_SECRET ||
            ""
        ).trim();


    return {

        apiUser,

        apiSecret

    };

};


// ========================================
// ERROR MESSAGE
// ========================================

const getRemoteErrorMessage = (
    data,
    fallback
) => {

    if (
        data &&
        typeof data === "object"
    ) {

        const candidates = [

            data.error?.message,

            data.error?.type,

            data.message,

            data.error

        ];


        for (
            const candidate
            of candidates
        ) {

            if (
                typeof candidate === "string" &&
                candidate.trim()
            ) {

                return candidate.trim();

            }

        }

    }


    return fallback;

};


// ========================================
// NORMALIZE SCORE
// ========================================

const normalizeScore = (
    value
) => {

    const number =
        Number(value);


    if (
        !Number.isFinite(
            number
        )
    ) {

        return null;

    }


    return Math.max(
        0,
        Math.min(
            1,
            number
        )
    );

};


// ========================================
// PERCENTAGE
// ========================================

const scoreToPercentage = (
    score
) => {

    if (
        score === null
    ) {

        return null;

    }


    return Math.round(
        score * 100
    );

};


// ========================================
// GENERATOR SCORES
// ========================================

const extractGeneratorScores = (
    type
) => {

    if (
        !type ||
        typeof type !== "object"
    ) {

        return [];

    }


    const generators = [];


    // Sightengine can return multiple
    // generator-specific scores.
    //
    // We intentionally ignore:
    // - ai_generated
    // because that is the global score.
    //
    // Every remaining numeric field
    // is treated as a generator score.

    for (
        const [
            name,
            rawScore
        ]
        of Object.entries(
            type
        )
    ) {

        if (
            name === "ai_generated"
        ) {

            continue;

        }


        const score =
            normalizeScore(
                rawScore
            );


        if (
            score === null
        ) {

            continue;

        }


        generators.push({

            name,

            score,

            confidence:
                scoreToPercentage(
                    score
                )

        });

    }


    generators.sort(
        (
            a,
            b
        ) =>
            b.score -
            a.score
    );


    return generators;

};


// ========================================
// DETERMINE GENERATOR
// ========================================

const getDetectedGenerator = (
    generators
) => {

    if (
        !Array.isArray(
            generators
        ) ||
        generators.length === 0
    ) {

        return null;

    }


    const top =
        generators[0];


    // Do not claim a generator when
    // its score is extremely weak.

    if (
        !top ||
        top.score < 0.5
    ) {

        return null;

    }


    return {

        name:
            top.name,

        score:
            top.score,

        confidence:
            top.confidence

    };

};


// ========================================
// SIGHTENGINE REQUEST
// ========================================

const detectWithSightengine = async (
    buffer,
    mimeType,
    config
) => {

    // ------------------------------------
    // BROWSER/VERCEL NODE SUPPORT
    // ------------------------------------

    if (
        typeof FormData === "undefined"
    ) {

        throw new Error(
            "FormData tidak tersedia pada runtime server."
        );

    }


    if (
        typeof Blob === "undefined"
    ) {

        throw new Error(
            "Blob tidak tersedia pada runtime server."
        );

    }


    // ------------------------------------
    // BUILD MULTIPART FORM
    // ------------------------------------

    const form =
        new FormData();


    form.append(
        "api_user",
        config.apiUser
    );


    form.append(
        "api_secret",
        config.apiSecret
    );


    form.append(
        "models",
        "genai"
    );


    const extension =
        getExtensionFromMime(
            mimeType
        );


    const blob =
        new Blob(
            [
                buffer
            ],
            {
                type:
                    mimeType
            }
        );


    form.append(
        "media",
        blob,
        `genz-ai-image.${extension}`
    );


    // ------------------------------------
    // REQUEST
    // ------------------------------------

    const response =
        await fetch(
            SIGHTENGINE_ENDPOINT,
            {

                method:
                    "POST",

                body:
                    form

            }
        );


    const responseText =
        await response.text();


    let data =
        null;


    if (
        responseText
    ) {

        try {

            data =
                JSON.parse(
                    responseText
                );

        } catch {

            data = {

                raw:
                    responseText

            };

        }

    }


    if (
        !response.ok
    ) {

        throw new Error(
            getRemoteErrorMessage(
                data,
                `Sightengine HTTP ${response.status}`
            )
        );

    }


    if (
        !data ||
        typeof data !== "object"
    ) {

        throw new Error(
            "Response Sightengine tidak valid."
        );

    }


    if (
        data.status &&
        String(
            data.status
        ).toLowerCase() === "failure"
    ) {

        throw new Error(
            getRemoteErrorMessage(
                data,
                "Sightengine gagal melakukan analisis."
            )
        );

    }


    return data;

};


// ========================================
// MIME EXTENSION
// ========================================

const getExtensionFromMime = (
    mimeType
) => {

    switch (
        normalizeMimeType(
            mimeType
        )
    ) {

        case "image/png":
            return "png";

        case "image/webp":
            return "webp";

        case "image/gif":
            return "gif";

        case "image/bmp":
            return "bmp";

        case "image/tiff":
            return "tiff";

        case "image/avif":
            return "avif";

        case "image/jpeg":
        default:
            return "jpg";

    }

};


// ========================================
// NORMALIZE RESPONSE
// ========================================

const normalizeDetectionResponse = (
    data
) => {

    const type =
        data?.type &&
        typeof data.type === "object"
            ? data.type
            : {};


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

        ai_generated:
            aiGenerated,

        confidence:
            scoreToPercentage(
                aiGenerated
            ),

        // General threshold.
        //
        // Sightengine scores are probabilities/
        // confidence scores, not absolute proof.
        //
        // 0.5 is used as the detection boundary
        // while preserving the raw score for the UI.

        is_ai_generated:
            aiGenerated !== null &&
            aiGenerated >= 0.5,

        generators,

        detected_generator:
            detectedGenerator

    };

};


// ========================================
// MAIN HANDLER
// ========================================

export default async function handler(
    req,
    res
) {

    // ====================================
    // CORS
    // ====================================

    res.setHeader(
        "Access-Control-Allow-Origin",
        "*"
    );

    res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization"
    );

    res.setHeader(
        "Access-Control-Allow-Methods",
        "POST, OPTIONS"
    );


    // ====================================
    // OPTIONS
    // ====================================

    if (
        req.method === "OPTIONS"
    ) {

        return res
            .status(204)
            .end();

    }


    // ====================================
    // METHOD
    // ====================================

    if (
        req.method !== "POST"
    ) {

        return json(
            res,
            405,
            {

                success: false,

                error:
                    "Method tidak diizinkan."

            }
        );

    }


    // ====================================
    // CONFIG
    // ====================================

    const config =
        getSightengineConfig();


    if (
        !config.apiUser ||
        !config.apiSecret
    ) {

        return json(
            res,
            500,
            {

                success: false,

                error:
                    "Sightengine belum dikonfigurasi di server. Pastikan SIGHTENGINE_API_USER dan SIGHTENGINE_API_SECRET tersedia."

            }
        );

    }


    // ====================================
    // BODY
    // ====================================

    const body =
        parseBody(
            req
        );


    const rawBase64 =
        body.image_base64;


    const mimeType =
        normalizeMimeType(
            body.mime_type
        );


    // ====================================
    // VALIDATE IMAGE
    // ====================================

    if (
        typeof rawBase64 !== "string" ||
        !rawBase64.trim()
    ) {

        return json(
            res,
            400,
            {

                success: false,

                error:
                    "image_base64 wajib dikirim."

            }
        );

    }


    // ====================================
    // VALIDATE MIME
    // ====================================

    if (
        !isSupportedImageType(
            mimeType
        )
    ) {

        return json(
            res,
            400,
            {

                success: false,

                error:
                    "Tipe file tidak didukung. Sightengine endpoint ini hanya menerima image."

            }
        );

    }


    // ====================================
    // NORMALIZE BASE64
    // ====================================

    const base64 =
        normalizeBase64(
            rawBase64
        );


    if (
        !isValidBase64(
            base64
        )
    ) {

        return json(
            res,
            400,
            {

                success: false,

                error:
                    "image_base64 tidak valid."

            }
        );

    }


    // ====================================
    // SIZE CHECK
    // ====================================

    const estimatedBytes =
        estimateBase64Bytes(
            base64
        );


    if (
        estimatedBytes <= 0
    ) {

        return json(
            res,
            400,
            {

                success: false,

                error:
                    "File image kosong atau tidak valid."

            }
        );

    }


    if (
        estimatedBytes >
        MAX_IMAGE_BYTES
    ) {

        return json(
            res,
            413,
            {

                success: false,

                error:
                    "Ukuran image terlalu besar untuk AI Detection. Maksimum 15 MB."

            }
        );

    }


    // ====================================
    // DECODE
    // ====================================

    let buffer;

    try {

        buffer =
            Buffer.from(
                base64,
                "base64"
            );

    } catch (error) {

        console.error(
            "[GEN-Z.AI] Base64 decode error:",
            error
        );

        return json(
            res,
            400,
            {

                success: false,

                error:
                    "Gagal membaca image."

            }
        );

    }


    if (
        !buffer ||
        !buffer.length
    ) {

        return json(
            res,
            400,
            {

                success: false,

                error:
                    "Image hasil decode kosong."

            }
        );

    }


    if (
        buffer.length >
        MAX_IMAGE_BYTES
    ) {

        return json(
            res,
            413,
            {

                success: false,

                error:
                    "Ukuran image melebihi batas 15 MB."

            }
        );

    }


    // ====================================
    // DETECT
    // ====================================

    try {

        const sightengineResult =
            await detectWithSightengine(
                buffer,
                mimeType,
                config
            );


        const detection =
            normalizeDetectionResponse(
                sightengineResult
            );


        return json(
            res,
            200,
            {

                success: true,

                provider:
                    "sightengine",

                model:
                    "genai",

                detection

            }
        );

    } catch (error) {

        console.error(
            "[GEN-Z.AI] Sightengine detection error:",
            error
        );


        return json(
            res,
            502,
            {

                success: false,

                provider:
                    "sightengine",

                error:
                    error?.message ||
                    "Sightengine gagal melakukan AI detection."

            }
        );

    }

}
