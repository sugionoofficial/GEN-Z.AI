/* =========================================================
   GEN-Z.AI
   SIGHTENGINE AI IMAGE DETECTION MODULE
   ---------------------------------------------------------
   File:
   metadata-cleaner/assets/js/metadata-sightengine.js

   Fungsi:
   - Mengirim image ke backend Sightengine
   - Tidak menyimpan image
   - Tidak menyimpan API credential
   - Tidak mengubah metadata lokal
   - Tidak mengubah proses cleaning
   - Mengembalikan hasil visual AI detection

   Flow:

   File
      ↓
   ArrayBuffer
      ↓
   Base64
      ↓
   /api/sightengine-detect
      ↓
   Sightengine
      ↓
   normalized detection result

   Catatan:
   - API credential TIDAK pernah berada di browser.
   - Backend GEN-Z.AI yang berkomunikasi dengan Sightengine.
   - Module ini khusus IMAGE.
   - Video tetap menggunakan sistem metadata lokal.
========================================================= */


/* =========================================================
   CONFIG
========================================================= */

const API_ENDPOINT =
    "/api/sightengine-detect";


/*
   Batas frontend dibuat sama dengan backend.

   Backend tetap menjadi pengaman utama.
   Batas di sini hanya mencegah browser mengirim
   payload yang jelas terlalu besar.
*/

const MAX_IMAGE_BYTES =
    15 * 1024 * 1024;


/* =========================================================
   PUBLIC
   DETECT IMAGE
========================================================= */

export async function detectSightengine(
    file
) {

    /*
       Pastikan file tersedia.
    */

    if (
        !file
    ) {

        throw new Error(
            "File image tidak tersedia."
        );

    }


    /*
       Sightengine module hanya untuk image.
    */

    if (
        !String(
            file.type || ""
        )
            .toLowerCase()
            .startsWith(
                "image/"
            )
    ) {

        throw new Error(
            "Sightengine AI Detection hanya digunakan untuk image."
        );

    }


    /*
       Validasi ukuran sebelum membaca
       seluruh file ke memory.
    */

    if (
        Number(file.size || 0) <= 0
    ) {

        throw new Error(
            "File image kosong."
        );

    }


    if (
        Number(file.size || 0) >
        MAX_IMAGE_BYTES
    ) {

        throw new Error(
            "Ukuran image terlalu besar untuk AI Detection. Maksimum 15 MB."
        );

    }


    /*
       Convert File → Base64.
    */

    const imageBase64 =
        await fileToBase64(
            file
        );


    if (
        !imageBase64
    ) {

        throw new Error(
            "Gagal membaca image untuk AI Detection."
        );

    }


    /*
       Kirim ke backend GEN-Z.AI.

       API credential tidak ikut dikirim
       dari browser.
    */

    const response =
        await fetch(
            API_ENDPOINT,
            {

                method:
                    "POST",

                headers: {

                    "Content-Type":
                        "application/json"

                },

                body:
                    JSON.stringify({

                        image_base64:
                            imageBase64,

                        mime_type:
                            normalizeMimeType(
                                file.type
                            )

                    })

            }
        );


    /*
       Baca response sebagai text terlebih dahulu.

       Ini membuat error backend yang bukan JSON
       tetap dapat ditangani dengan aman.
    */

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

            data = null;

        }

    }


    /*
       HTTP error.
    */

    if (
        !response.ok
    ) {

        throw new Error(
            getResponseError(
                data,
                `Sightengine Detection gagal (${response.status}).`
            )
        );

    }


    /*
       Backend harus mengembalikan success=true.
    */

    if (
        !data ||
        data.success !== true
    ) {

        throw new Error(
            getResponseError(
                data,
                "Sightengine Detection gagal."
            )
        );

    }


    /*
       Pastikan object detection tersedia.
    */

    if (
        !data.detection ||
        typeof data.detection !== "object"
    ) {

        throw new Error(
            "Response Sightengine tidak memiliki hasil detection."
        );

    }


    /*
       Normalisasi hasil sebelum diberikan
       ke coordinator.

       Dengan begitu metadata-app.js tidak perlu
       mengetahui struktur mentah response backend.
    */

    return normalizeDetection(
        data.detection
    );

}


/* =========================================================
   FILE → BASE64
========================================================= */

async function fileToBase64(
    file
) {

    /*
       ArrayBuffer adalah cara paling sederhana
       dan konsisten untuk file browser.
    */

    const buffer =
        await file.arrayBuffer();


    if (
        !buffer ||
        !buffer.byteLength
    ) {

        return "";

    }


    /*
       Convert byte array menjadi binary string.

       Jangan menggunakan String.fromCharCode(...)
       langsung pada seluruh array karena file besar
       dapat menyebabkan stack overflow.
    */

    const bytes =
        new Uint8Array(
            buffer
        );


    const CHUNK_SIZE =
        0x8000;


    let binary =
        "";


    for (
        let index = 0;
        index < bytes.length;
        index += CHUNK_SIZE
    ) {

        const chunk =
            bytes.subarray(
                index,
                Math.min(
                    index +
                    CHUNK_SIZE,
                    bytes.length
                )
            );


        binary +=
            String.fromCharCode(
                ...chunk
            );

    }


    return btoa(
        binary
    );

}


/* =========================================================
   MIME
========================================================= */

function normalizeMimeType(
    value
) {

    return String(
        value || ""
    )
        .trim()
        .toLowerCase()
        .split(";")[0];

}


/* =========================================================
   RESPONSE ERROR
========================================================= */

function getResponseError(
    data,
    fallback
) {

    if (
        !data ||
        typeof data !== "object"
    ) {

        return fallback;

    }


    const candidates = [

        data.error,

        data.message,

        data.detection?.error

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


    return fallback;

}


/* =========================================================
   NORMALIZE DETECTION
========================================================= */

function normalizeDetection(
    detection
) {

    const aiGenerated =
        normalizeScore(
            detection.ai_generated
        );


    const confidence =
        normalizeConfidence(
            detection.confidence,
            aiGenerated
        );


    const generators =
        normalizeGenerators(
            detection.generators
        );


    const detectedGenerator =
        normalizeDetectedGenerator(
            detection.detected_generator
        );


    const isAIGenerated =
        typeof detection.is_ai_generated ===
        "boolean"

            ? detection.is_ai_generated

            : (
                aiGenerated !== null &&
                aiGenerated >= 0.5
            );


    return {

        provider:
            "sightengine",

        model:
            "genai",

        ai_generated:
            aiGenerated,

        confidence,

        is_ai_generated:
            isAIGenerated,

        generators,

        detected_generator:
            detectedGenerator

    };

}


/* =========================================================
   SCORE
========================================================= */

function normalizeScore(
    value
) {

    const number =
        Number(value);


    if (
        !Number.isFinite(
            number
        )
    ) {

        return null;

    }


    /*
       Sightengine AI-generated score
       menggunakan rentang 0 → 1.
    */

    return Math.max(
        0,
        Math.min(
            1,
            number
        )
    );

}


/* =========================================================
   CONFIDENCE
========================================================= */

function normalizeConfidence(
    confidence,
    score
) {

    const explicit =
        Number(
            confidence
        );


    if (
        Number.isFinite(
            explicit
        )
    ) {

        /*
           Backend mengembalikan confidence
           dalam persen 0 → 100.
        */

        return Math.max(
            0,
            Math.min(
                100,
                Math.round(
                    explicit
                )
            )
        );

    }


    if (
        score !== null
    ) {

        return Math.round(
            score * 100
        );

    }


    return null;

}


/* =========================================================
   GENERATORS
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
        .filter(
            item =>
                item &&
                typeof item === "object"
        )
        .map(
            item => {

                const score =
                    normalizeScore(
                        item.score
                    );


                let confidence =
                    Number(
                        item.confidence
                    );


                if (
                    !Number.isFinite(
                        confidence
                    ) &&
                    score !== null
                ) {

                    confidence =
                        Math.round(
                            score * 100
                        );

                }


                return {

                    name:
                        String(
                            item.name || ""
                        )
                            .trim(),

                    score,

                    confidence:
                        Number.isFinite(
                            confidence
                        )
                            ? Math.max(
                                0,
                                Math.min(
                                    100,
                                    Math.round(
                                        confidence
                                    )
                                )
                            )
                            : null

                };

            }
        )
        .filter(
            item =>
                item.name
        )
        .sort(
            (
                a,
                b
            ) =>
                (
                    b.score || 0
                ) -
                (
                    a.score || 0
                )
        );

}


/* =========================================================
   DETECTED GENERATOR
========================================================= */

function normalizeDetectedGenerator(
    generator
) {

    if (
        !generator ||
        typeof generator !== "object"
    ) {

        return null;

    }


    const name =
        String(
            generator.name || ""
        )
            .trim();


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
        Number(
            generator.confidence
        );


    if (
        !Number.isFinite(
            confidence
        ) &&
        score !== null
    ) {

        confidence =
            Math.round(
                score * 100
            );

    }


    return {

        name,

        score,

        confidence:
            Number.isFinite(
                confidence
            )
                ? Math.max(
                    0,
                    Math.min(
                        100,
                        Math.round(
                            confidence
                        )
                    )
                )
                : null

    };

}


/* =========================================================
   PUBLIC HELPERS
========================================================= */

/*
   Helper untuk mengetahui apakah file
   bisa dikirim ke Sightengine.

   Tidak melakukan request.
*/

export function canUseSightengine(
    file
) {

    if (
        !file
    ) {

        return false;

    }


    const mimeType =
        normalizeMimeType(
            file.type
        );


    if (
        !mimeType.startsWith(
            "image/"
        )
    ) {

        return false;

    }


    if (
        Number(file.size || 0) <= 0
    ) {

        return false;

    }


    if (
        Number(file.size || 0) >
        MAX_IMAGE_BYTES
    ) {

        return false;

    }


    return true;

}


/* =========================================================
   FORMAT SCORE
========================================================= */

export function formatSightengineScore(
    score
) {

    const normalized =
        normalizeScore(
            score
        );


    if (
        normalized === null
    ) {

        return "N/A";

    }


    return `${Math.round(
        normalized * 100
    )}%`;

}


/* =========================================================
   FORMAT GENERATOR
========================================================= */

export function formatSightengineGenerator(
    generator
) {

    if (
        !generator
    ) {

        return "";

    }


    const name =
        String(
            generator.name || ""
        ).trim();


    if (
        !name
    ) {

        return "";

    }


    const confidence =
        Number(
            generator.confidence
        );


    if (
        Number.isFinite(
            confidence
        )
    ) {

        return `${name} (${Math.round(
            confidence
        )}%)`;

    }


    return name;

}
