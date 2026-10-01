/* =========================================================
   GEN-Z.AI
   SIGHTENGINE DETECTION MODULE
   ---------------------------------------------------------
   File:
   metadata-cleaner/assets/js/metadata-sightengine.js

   Tanggung jawab:
   - Mengirim image ke backend Sightengine
   - Tidak menyimpan credential Sightengine
   - Menormalisasi response backend
   - Mempertahankan generator scores
   - Mempertahankan request metadata
   - Mempertahankan media metadata
   - Menghasilkan object detection siap digunakan UI
   - Menyediakan API yang digunakan metadata-app.js

   Backend:
   POST /api/sightengine-detect

   Model:
   genai

   Catatan:
   - Sightengine hanya digunakan untuk IMAGE.
   - Credential tidak pernah berada di browser.
   - Image dikirim ke backend dalam bentuk Data URL.
   - Batas image: 15 MB.
========================================================= */


/* =========================================================
   CONSTANTS
========================================================= */

const SIGHTENGINE_ENDPOINT =
    "/api/sightengine-detect";


const SIGHTENGINE_PROVIDER =
    "sightengine";


const SIGHTENGINE_MAX_IMAGE_SIZE =
    15 * 1024 * 1024;


/* =========================================================
   BASIC HELPERS
========================================================= */

function isObject(
    value
) {

    return (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value)
    );

}


/* =========================================================
   SCORE NORMALIZATION
   ---------------------------------------------------------
   Sightengine:
       0.0 - 1.0
========================================================= */

function normalizeScore(
    value
) {

    const number =
        Number(
            value
        );


    if (
        !Number.isFinite(
            number
        )
    ) {

        return null;

    }


    if (
        number < 0
    ) {

        return 0;

    }


    if (
        number > 1
    ) {

        return 1;

    }


    return number;

}


/* =========================================================
   PERCENTAGE NORMALIZATION
   ---------------------------------------------------------
   Frontend confidence:
       0 - 100
========================================================= */

function normalizePercentage(
    value
) {

    const number =
        Number(
            value
        );


    if (
        !Number.isFinite(
            number
        )
    ) {

        return null;

    }


    if (
        number < 0
    ) {

        return 0;

    }


    if (
        number > 100
    ) {

        return 100;

    }


    return number;

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
   ERROR MESSAGE
========================================================= */

function getErrorMessage(
    data
) {

    if (
        typeof data?.error === "string" &&
        data.error.trim()
    ) {

        return data.error.trim();

    }


    if (
        isObject(
            data?.error
        ) &&
        typeof data.error.message === "string"
    ) {

        return data.error.message.trim();

    }


    if (
        typeof data?.message === "string" &&
        data.message.trim()
    ) {

        return data.message.trim();

    }


    return (
        "Sightengine detection failed."
    );

}


/* =========================================================
   IMAGE VALIDATION
========================================================= */

function validateImage(
    file
) {

    if (
        !file
    ) {

        throw new Error(
            "Image tidak ditemukan."
        );

    }


    if (
        typeof File !== "undefined" &&
        !(file instanceof File)
    ) {

        throw new Error(
            "File image tidak valid."
        );

    }


    if (
        !file.type ||
        !file.type.startsWith(
            "image/"
        )
    ) {

        throw new Error(
            "File yang dipilih bukan image."
        );

    }


    if (
        file.size >
        SIGHTENGINE_MAX_IMAGE_SIZE
    ) {

        throw new Error(
            "Ukuran image melebihi batas 15 MB."
        );

    }


    return true;

}


/* =========================================================
   CAN USE SIGHTENGINE
   ---------------------------------------------------------
   Digunakan langsung oleh metadata-app.js.

   Hanya IMAGE yang boleh dikirim ke Sightengine.
========================================================= */

export function canUseSightengine(
    file
) {

    if (
        !file
    ) {

        return false;

    }


    if (
        typeof file.type !== "string"
    ) {

        return false;

    }


    if (
        !file.type.startsWith(
            "image/"
        )
    ) {

        return false;

    }


    if (
        Number(file.size) >
        SIGHTENGINE_MAX_IMAGE_SIZE
    ) {

        return false;

    }


    return true;

}


/* =========================================================
   FILE → DATA URL
========================================================= */

function fileToDataUrl(
    file
) {

    return new Promise(
        (
            resolve,
            reject
        ) => {

            const reader =
                new FileReader();


            reader.onload =
                () => {

                    if (
                        typeof reader.result !==
                        "string"
                    ) {

                        reject(
                            new Error(
                                "Gagal membaca image."
                            )
                        );


                        return;

                    }


                    resolve(
                        reader.result
                    );

                };


            reader.onerror =
                () => {

                    reject(
                        new Error(
                            "Gagal membaca image."
                        )
                    );

                };


            reader.readAsDataURL(
                file
            );

        }
    );

}


/* =========================================================
   GENERATOR NAME
========================================================= */

function normalizeGeneratorName(
    value
) {

    if (
        typeof value !== "string"
    ) {

        return "";

    }


    return value.trim();

}


/* =========================================================
   GENERATOR NORMALIZATION
========================================================= */

function normalizeGenerators(
    generators
) {

    if (
        !Array.isArray(
            generators
        )
    ) {

        return [];

    }


    return generators
        .map(
            (
                generator
            ) => {

                if (
                    !isObject(
                        generator
                    )
                ) {

                    return null;

                }


                const name =
                    normalizeGeneratorName(
                        generator.name
                    );


                if (
                    !name
                ) {

                    return null;

                }


                const score =
                    normalizeScore(
                        generator.score
                    );


                let confidence =
                    normalizePercentage(
                        generator.confidence
                    );


                /*
                 * Jika backend tidak mengirim
                 * confidence tetapi score tersedia,
                 * hitung dari score.
                 */

                if (
                    confidence === null &&
                    score !== null
                ) {

                    confidence =
                        scoreToPercentage(
                            score
                        );

                }


                return {

                    name,

                    score,

                    confidence

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

                const scoreA =
                    Number.isFinite(
                        a.score
                    )
                        ? a.score
                        : -1;


                const scoreB =
                    Number.isFinite(
                        b.score
                    )
                        ? b.score
                        : -1;


                return (
                    scoreB -
                    scoreA
                );

            }
        );

}


/* =========================================================
   DETECTED GENERATOR
========================================================= */

function normalizeDetectedGenerator(
    generator
) {

    if (
        !isObject(
            generator
        )
    ) {

        return null;

    }


    const name =
        normalizeGeneratorName(
            generator.name
        );


    if (
        !name
    ) {

        return null;

    }


    const score =
        normalizeScore(
            generator.score
        );


    let confidence =
        normalizePercentage(
            generator.confidence
        );


    if (
        confidence === null &&
        score !== null
    ) {

        confidence =
            scoreToPercentage(
                score
            );

    }


    return {

        name,

        score,

        confidence

    };

}


/* =========================================================
   REQUEST METADATA
   ---------------------------------------------------------
   Contoh Sightengine:

   {
       id: "...",
       timestamp: 1491402308.4762,
       operations: 5
   }
========================================================= */

function normalizeRequestMetadata(
    request
) {

    if (
        !isObject(
            request
        )
    ) {

        return null;

    }


    let timestamp =
        Number(
            request.timestamp
        );


    if (
        !Number.isFinite(
            timestamp
        )
    ) {

        timestamp =
            null;

    }


    let operations =
        Number(
            request.operations
        );


    if (
        !Number.isFinite(
            operations
        )
    ) {

        operations =
            null;

    }


    return {

        id:
            typeof request.id === "string" &&
            request.id.trim()
                ? request.id.trim()
                : null,

        timestamp,

        operations

    };

}


/* =========================================================
   MEDIA METADATA
   ---------------------------------------------------------
   Contoh:

   {
       id: "...",
       uri: "..."
   }
========================================================= */

function normalizeMediaMetadata(
    media
) {

    if (
        !isObject(
            media
        )
    ) {

        return null;

    }


    return {

        id:
            typeof media.id === "string" &&
            media.id.trim()
                ? media.id.trim()
                : null,

        uri:
            typeof media.uri === "string" &&
            media.uri.trim()
                ? media.uri.trim()
                : null

    };

}


/* =========================================================
   DETECTION NORMALIZATION
========================================================= */

function normalizeDetection(
    data
) {

    const backendDetection =
        isObject(
            data?.detection
        )
            ? data.detection
            : {};


    /*
       Model:
       Prioritas:
       1. response.model
       2. detection.model
       3. null

       Tidak mengarang model.
    */

    const model =
        typeof data?.model === "string"
            ? data.model
            : typeof backendDetection.model === "string"
                ? backendDetection.model
                : null;


    /* =====================================================
       AI SCORE
    ===================================================== */

    const aiGenerated =
        normalizeScore(
            backendDetection.ai_generated
        );


    /* =====================================================
       CONFIDENCE
    ===================================================== */

    let confidence =
        normalizePercentage(
            backendDetection.confidence
        );


    if (
        confidence === null &&
        aiGenerated !== null
    ) {

        confidence =
            scoreToPercentage(
                aiGenerated
            );

    }


    /* =====================================================
       GENERATORS
    ===================================================== */

    const generators =
        normalizeGenerators(
            backendDetection.generators
        );


    /* =====================================================
       DETECTED GENERATOR
    ===================================================== */

    const detectedGenerator =
        normalizeDetectedGenerator(
            backendDetection.detected_generator
        );


    /* =====================================================
       REQUEST
    ===================================================== */

    const request =
        normalizeRequestMetadata(
            backendDetection.request
        );


    /* =====================================================
       MEDIA
    ===================================================== */

    const media =
        normalizeMediaMetadata(
            backendDetection.media
        );


    /* =====================================================
       FINAL OBJECT
    ===================================================== */

    return {

        provider:
            typeof data?.provider === "string"
                ? data.provider
                : SIGHTENGINE_PROVIDER,

        model,

        ai_generated:
            aiGenerated,

        confidence,

        is_ai_generated:
            typeof backendDetection.is_ai_generated ===
            "boolean"
                ? backendDetection.is_ai_generated
                : aiGenerated !== null &&
                  aiGenerated >= 0.5,

        generators,

        detected_generator:
            detectedGenerator,

        request,

        media

    };

}


/* =========================================================
   EMPTY DETECTION
========================================================= */

function createEmptyDetection() {

    return {

        provider:
            SIGHTENGINE_PROVIDER,

        model:
            null,

        ai_generated:
            null,

        confidence:
            null,

        is_ai_generated:
            false,

        generators:
            [],

        detected_generator:
            null,

        request:
            null,

        media:
            null

    };

}


/* =========================================================
   BACKEND REQUEST
========================================================= */

async function requestSightengine(
    image
) {

    const response =
        await fetch(
            SIGHTENGINE_ENDPOINT,
            {
                method:
                    "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body:
                    JSON.stringify({
                        image
                    })
            }
        );


    let data;


    try {

        data =
            await response.json();

    } catch {

        throw new Error(
            `Sightengine backend returned invalid JSON (${response.status}).`
        );

    }


    if (
        !response.ok
    ) {

        throw new Error(
            getErrorMessage(
                data
            )
        );

    }


    if (
        data?.success !== true
    ) {

        throw new Error(
            getErrorMessage(
                data
            )
        );

    }


    return data;

}


/* =========================================================
   DETECT IMAGE
   ---------------------------------------------------------
   Ini nama yang digunakan metadata-app.js.
========================================================= */

export async function detectSightengine(
    file
) {

    validateImage(
        file
    );


    const dataUrl =
        await fileToDataUrl(
            file
        );


    const response =
        await requestSightengine(
            dataUrl
        );


    return normalizeDetection(
        response
    );

}


/* =========================================================
   BACKWARD COMPATIBILITY
   ---------------------------------------------------------
   Nama lama tetap dipertahankan agar module lain
   yang mungkin masih menggunakan detectWithSightengine()
   tidak rusak.
========================================================= */

export async function detectWithSightengine(
    file
) {

    return detectSightengine(
        file
    );

}


/* =========================================================
   PUBLIC NORMALIZER
========================================================= */

export function normalizeSightengineDetection(
    data
) {

    if (
        !isObject(
            data
        )
    ) {

        return createEmptyDetection();

    }


    return normalizeDetection(
        data
    );

}


/* =========================================================
   PUBLIC GENERATOR FORMATTER
========================================================= */

export function formatSightengineGenerator(
    generator
) {

    if (
        !isObject(
            generator
        )
    ) {

        return "";

    }


    const name =
        normalizeGeneratorName(
            generator.name
        );


    if (
        !name
    ) {

        return "";

    }


    const confidence =
        normalizePercentage(
            generator.confidence
        );


    if (
        confidence !== null
    ) {

        return (
            `${name} ` +
            `(${confidence}%)`
        );

    }


    const score =
        normalizeScore(
            generator.score
        );


    if (
        score !== null
    ) {

        return (
            `${name} ` +
            `(${score * 100}%)`
        );

    }


    return name;

}


/* =========================================================
   PUBLIC CONSTANTS
========================================================= */

export {

    SIGHTENGINE_ENDPOINT,

    SIGHTENGINE_PROVIDER,

    SIGHTENGINE_MAX_IMAGE_SIZE,

    normalizeScore,

    normalizePercentage,

    scoreToPercentage,

    normalizeGenerators,

    normalizeDetectedGenerator,

    normalizeRequestMetadata,

    normalizeMediaMetadata

};
