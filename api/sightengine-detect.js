//api/sightengine-detect.js?v=2.1
/* =========================================================
   GEN-Z.AI
   SIGHTENGINE AI DETECTION API
   ---------------------------------------------------------
   File:
   api/sightengine-detect.js

   Tanggung jawab:
   - Menerima image dari frontend
   - Menjaga credential Sightengine tetap server-side
   - Mengirim image ke Sightengine
   - Menggunakan model:
       genai
       deepfake
   - Mengembalikan:
       GenAI score
       Face manipulation / deepfake score
       AI generator scores
       Request metadata
       Media metadata
   - Tidak menyimpan file/image

   Sightengine:
   models=genai,deepfake
========================================================= */


/* =========================================================
   CONSTANTS
========================================================= */

const SIGHTENGINE_ENDPOINT =
    "https://api.sightengine.com/1.0/check.json";


const SIGHTENGINE_MODELS =
    "genai,deepfake";


const SIGHTENGINE_GENAI_MODEL =
    "genai";


const SIGHTENGINE_DEEPFAKE_MODEL =
    "deepfake";


const MAX_IMAGE_SIZE =
    15 * 1024 * 1024;


/* =========================================================
   ENVIRONMENT & SECURITY
========================================================= */

function getSightengineConfig(req) {

    const env =
        req?.env ||
        process.env ||
        {};

    const apiUser =
        String(
            env.SIGHTENGINE_API_USER ||
            process.env.SIGHTENGINE_API_USER ||
            ""
        ).trim();


    const apiSecret =
        String(
            env.SIGHTENGINE_API_SECRET ||
            process.env.SIGHTENGINE_API_SECRET ||
            ""
        ).trim();


    if (
        !apiUser ||
        !apiSecret
    ) {

        const error =
            new Error(
                "Sightengine credentials are not configured."
            );

        error.status = 500;
        error.code = "SIGHTENGINE_CREDENTIALS_MISSING";

        throw error;

    }


    return {

        apiUser,

        apiSecret

    };

}


function getSupabaseConfig(req) {

    const env =
        req?.env ||
        process.env ||
        {};

    const url =
        String(
            env.SUPABASE_URL ||
            process.env.SUPABASE_URL ||
            ""
        ).trim().replace(/\/+$/, "");

    const serviceRoleKey =
        String(
            env.SUPABASE_SERVICE_ROLE_KEY ||
            process.env.SUPABASE_SERVICE_ROLE_KEY ||
            ""
        ).trim();

    const anonKey =
        String(
            env.SUPABASE_ANON_KEY ||
            env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
            env.SUPABASE_KEY ||
            process.env.SUPABASE_ANON_KEY ||
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
            process.env.SUPABASE_KEY ||
            serviceRoleKey
        ).trim();

    return {

        url,

        serviceRoleKey,

        anonKey

    };

}


/* =========================================================
   USER AUTHENTICATION
========================================================= */

async function authenticateUser(req) {

    const authHeader =
        String(
            req?.headers?.authorization ||
            req?.headers?.Authorization ||
            ""
        ).trim();

    if (
        !authHeader
    ) {

        const error =
            new Error(
                "Sesi login diperlukan untuk menggunakan deteksi AI Sightengine."
            );

        error.status = 401;
        error.code = "AUTHORIZATION_REQUIRED";

        throw error;

    }

    const match =
        authHeader.match(
            /^Bearer\s+(.+)$/i
        );

    if (
        !match ||
        !match[1].trim()
    ) {

        const error =
            new Error(
                "Format token otentikasi tidak valid."
            );

        error.status = 401;
        error.code = "INVALID_AUTHORIZATION";

        throw error;

    }

    const token =
        match[1].trim();

    const config =
        getSupabaseConfig(
            req
        );

    if (
        !config.url ||
        (
            !config.anonKey &&
            !config.serviceRoleKey
        )
    ) {

        const error =
            new Error(
                "Konfigurasi otentikasi Supabase server belum lengkap."
            );

        error.status = 500;
        error.code = "AUTH_CONFIG_MISSING";

        throw error;

    }

    const fetchImpl =
        req?.fetchImpl ||
        globalThis.fetch;

    const response =
        await fetchImpl(
            `${config.url}/auth/v1/user`,
            {
                method: "GET",
                headers: {
                    apikey:
                        config.anonKey ||
                        config.serviceRoleKey,
                    Authorization:
                        `Bearer ${token}`
                }
            }
        );

    if (
        !response.ok
    ) {

        const error =
            new Error(
                "Sesi login kedaluwarsa atau tidak valid. Silakan login kembali."
            );

        error.status = 401;
        error.code = "INVALID_SESSION";

        throw error;

    }

    const user =
        await response.json().catch(() => null);

    if (
        !user ||
        !user.id
    ) {

        const error =
            new Error(
                "User Supabase tidak ditemukan."
            );

        error.status = 401;
        error.code = "USER_NOT_FOUND";

        throw error;

    }

    return user;

}


/* =========================================================
   RATE LIMITING (PER USER / IP)
========================================================= */

const SIGHTENGINE_RATE_WINDOW_MS =
    60_000;

const SIGHTENGINE_MAX_REQUESTS =
    15;

const rateLimitBuckets =
    new Map();

export function resetSightengineRateLimitsForTests() {

    rateLimitBuckets.clear();

}

function checkSightengineRateLimit(key) {

    const now =
        Date.now();

    if (
        rateLimitBuckets.size > 2000
    ) {

        for (
            const [k, entry] of rateLimitBuckets
        ) {

            if (
                now - entry.startedAt >= SIGHTENGINE_RATE_WINDOW_MS
            ) {

                rateLimitBuckets.delete(k);

            }

        }

    }

    const entry =
        rateLimitBuckets.get(key);

    if (
        !entry ||
        now - entry.startedAt >= SIGHTENGINE_RATE_WINDOW_MS
    ) {

        rateLimitBuckets.set(
            key,
            {
                startedAt: now,
                count: 1
            }
        );

        return true;

    }

    if (
        entry.count >= SIGHTENGINE_MAX_REQUESTS
    ) {

        return false;

    }

    entry.count += 1;

    return true;

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
        .status(
            status
        )
        .json(
            payload
        );

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
                success:
                    false,

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
        req.body ||
        {};


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
        String(
            mimeType ||
            ""
        )
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
        String(
            base64 ||
            ""
        )
            .replace(
                /\s/g,
                ""
            );


    if (
        normalized.length === 0
    ) {

        return 0;

    }


    const padding =
        normalized.endsWith(
            "=="
        )

            ? 2

            : normalized.endsWith(
                "="
            )

                ? 1

                : 0;


    return Math.floor(
        normalized.length * 3 / 4
    ) - padding;

}


/* =========================================================
   SCORE NORMALIZATION
   ---------------------------------------------------------
   Sightengine score:
       0.0 - 1.0
========================================================= */

function normalizeScore(
    value
) {

    const numeric =
        Number(
            value
        );


    if (
        !Number.isFinite(
            numeric
        )
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
   SCORE → PERCENTAGE
========================================================= */

function scoreToPercentage(
    score
) {

    const normalized =
        normalizeScore(
            score
        );


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
   ---------------------------------------------------------
   Sightengine genai response:

   type.ai_generators = {
       "dall_e": 0.02,
       "firefly": 0.01,
       "flux": 0.01,
       ...
   }

   Jangan membuang generator dengan score 0.
   Frontend membutuhkan seluruh hasil yang dikirim
   oleh provider.
========================================================= */

function extractGeneratorScores(
    type
) {

    const generators =
        type?.ai_generators;


    if (
        !generators ||
        typeof generators !== "object" ||
        Array.isArray(
            generators
        )
    ) {

        return [];

    }


    return Object.entries(
        generators
    )
        .map(
            (
                [
                    name,
                    rawScore
                ]
            ) => {

                const normalizedName =
                    normalizeGeneratorName(
                        name
                    );


                if (
                    !normalizedName
                ) {

                    return null;

                }


                const score =
                    normalizeScore(
                        rawScore
                    );


                if (
                    score === null
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
        .filter(
            Boolean
        )
        .sort(
            (
                a,
                b
            ) => {

                return (
                    b.score -
                    a.score
                );

            }
        );

}


/* =========================================================
   DETECTED GENERATOR
   ---------------------------------------------------------
   Generator dianggap terdeteksi apabila score >= 0.5.

   Ini hanya menentukan generator utama untuk field
   detected_generator.

   Semua generator tetap dikembalikan.
========================================================= */

function getDetectedGenerator(
    generators
) {

    if (
        !Array.isArray(
            generators
        ) ||
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
                Number(
                    request.timestamp
                )
            )

                ? Number(
                    request.timestamp
                )

                : null,


        operations:
            Number.isFinite(
                Number(
                    request.operations
                )
            )

                ? Number(
                    request.operations
                )

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
   ---------------------------------------------------------
   Hasil akhir:

   {
       model: "genai",

       ai_generated: 0.99,

       confidence: 99,

       is_ai_generated: true,

       face_manipulation: 0.60,

       face_manipulation_confidence: 60,

       is_face_manipulated: true,

       generators: [],

       detected_generator: null,

       request: {},

       media: {}
   }
========================================================= */

function normalizeDetectionResponse(
    data,
    model
) {

    const type =
        data?.type ||
        {};


    /* =====================================================
       GENAI
    ===================================================== */

    const aiGenerated =
        normalizeScore(
            type.ai_generated
        );


    /* =====================================================
       FACE MANIPULATION / DEEPFAKE
       -----------------------------------------------------
       Sightengine deepfake response:

           type.deepfake

       Contoh:
           0.60

       Ini yang nantinya ditampilkan sebagai:

           Face manipulation 60%
===================================================== */

    const faceManipulation =
        normalizeScore(
            type.deepfake
        );


    /* =====================================================
       GENERATORS
    ===================================================== */

    const generators =
        extractGeneratorScores(
            type
        );


    const detectedGenerator =
        getDetectedGenerator(
            generators
        );


    /* =====================================================
       FINAL
    ===================================================== */

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


        face_manipulation:
            faceManipulation,


        face_manipulation_confidence:
            scoreToPercentage(
                faceManipulation
            ),


        is_face_manipulated:
            faceManipulation !== null &&
            faceManipulation >= 0.5,


        /*
         * Alias untuk kompatibilitas.
         */
        deepfake:
            faceManipulation,


        deepfake_confidence:
            scoreToPercentage(
                faceManipulation
            ),


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
    imageData,
    req
) {

    const config =
        getSightengineConfig(req);


    const parsed =
        parseDataUrl(
            imageData
        );


    /* =====================================================
       MIME
    ===================================================== */

    if (
        !isSupportedImageType(
            parsed.mimeType
        )
    ) {

        throw new Error(
            `Unsupported image type: ${parsed.mimeType}`
        );

    }


    /* =====================================================
       BASE64 SIZE
    ===================================================== */

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
        byteSize >
        MAX_IMAGE_SIZE
    ) {

        throw new Error(
            "Image exceeds the 15 MB Sightengine limit."
        );

    }


    /* =====================================================
       BUFFER
    ===================================================== */

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


    /* =====================================================
       FORM DATA
    ===================================================== */

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


    /*
     * IMPORTANT
     *
     * Dua model sekaligus.
     *
     * Sightengine mendukung comma-separated models.
     */

    formData.append(
        "models",
        SIGHTENGINE_MODELS
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


    /* =====================================================
       REQUEST
    ===================================================== */

    const fetchImpl =
        req?.fetchImpl ||
        globalThis.fetch;

    const response =
        await fetchImpl(
            SIGHTENGINE_ENDPOINT,
            {
                method:
                    "POST",

                body:
                    formData
            }
        );


    let data =
        null;


    try {

        data =
            await response.json();

    } catch {

        throw new Error(
            `Sightengine returned an invalid response (${response.status}).`
        );

    }


    /* =====================================================
       HTTP ERROR
    ===================================================== */

    if (
        !response.ok
    ) {

        const message =
            data?.error?.message ||
            data?.error ||
            `Sightengine request failed (${response.status}).`;


        throw new Error(
            String(
                message
            )
        );

    }


    /* =====================================================
       API STATUS
    ===================================================== */

    if (
        data?.status &&
        data.status !== "success"
    ) {

        const message =
            data?.error?.message ||
            data?.error ||
            "Sightengine detection failed.";


        throw new Error(
            String(
                message
            )
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

    /* =====================================================
       METHOD
    ===================================================== */

    if (
        !ensurePostMethod(
            req,
            res
        )
    ) {

        return;

    }


    try {

        /* =================================================
           AUTHENTICATION & RATE LIMITING
        ================================================= */

        const user =
            await authenticateUser(
                req
            );

        const clientIp =
            String(
                req?.headers?.["cf-connecting-ip"] ||
                req?.headers?.["x-forwarded-for"] ||
                req?.headers?.["x-real-ip"] ||
                user.id ||
                "unknown"
            ).split(",")[0].trim();

        const rateKey =
            `se:${user.id}:${clientIp}`;

        if (
            !checkSightengineRateLimit(
                rateKey
            )
        ) {

            sendJson(
                res,
                429,
                {
                    success:
                        false,

                    error:
                        "Terlalu banyak permintaan deteksi AI. Silakan tunggu 1 menit lalu coba lagi.",

                    code:
                        "RATE_LIMITED"
                }
            );

            return;

        }

        /* =================================================
           IMAGE
        ================================================= */

        const imageData =
            getImageData(
                req
            );


        /* =================================================
           SIGHTENGINE
        ================================================= */

        const sightengineResponse =
            await requestSightengine(
                imageData,
                req
            );


        /* =================================================
           NORMALIZE
        ================================================= */

        const detection =
            normalizeDetectionResponse(
                sightengineResponse,
                SIGHTENGINE_GENAI_MODEL
            );


        /* =================================================
           RESPONSE
        ================================================= */

        sendJson(
            res,
            200,
            {

                success:
                    true,


                provider:
                    "sightengine",


                /*
                 * Primary model tetap genai
                 * agar kompatibel dengan frontend lama.
                 */

                model:
                    SIGHTENGINE_GENAI_MODEL,


                /*
                 * Models yang benar-benar dipanggil.
                 */

                models:
                    [
                        SIGHTENGINE_GENAI_MODEL,

                        SIGHTENGINE_DEEPFAKE_MODEL
                    ],


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

        const statusCode =
            Number(
                error?.status
            ) ||
            (
                error?.message?.includes("Image data is required") ||
                error?.message?.includes("Invalid image data") ||
                error?.message?.includes("Unsupported image type") ||
                error?.message?.includes("exceeds the 15 MB")
                    ? 400
                    : 500
            );

        sendJson(
            res,
            statusCode,
            {

                success:
                    false,


                error:
                    error?.message ||
                    "Sightengine detection failed.",

                code:
                    error?.code ||
                    "SIGHTENGINE_ERROR"

            }
        );

    }

}
