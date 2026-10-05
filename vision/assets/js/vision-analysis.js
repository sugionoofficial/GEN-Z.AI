// vision-analysis.js?v=1.3
/* =========================================================
   GEN-Z.AI VISION
   ---------------------------------------------------------
   File:
   vision/assets/js/vision-analysis.js

   Fungsi:
   - Normalisasi hasil Vision Analysis
   - Parsing JSON analysis
   - Menangani response wrapper dari API
   - Menjaga struktur analysis tetap konsisten
   - Menyediakan fallback jika model mengembalikan text
   - Membuat ringkasan analysis
   - Menyimpan hasil analysis ke state
   - Tidak melakukan API request
   - Tidak melakukan credit
   - Tidak melakukan history
   - Tidak mengatur DOM secara langsung

   PENTING:
   - Tidak menimpa API dari vision-api-analysis.js.
   - API request seperti analyzeImage() dipertahankan.
========================================================= */


/* =========================================================
   DEFAULT ANALYSIS
========================================================= */

const DEFAULT_VISION_ANALYSIS =
    Object.freeze({

        subject:
            {},

        appearance:
            {},

        face_hair:
            {},

        pose:
            {},

        clothing:
            {},

        accessories:
            [],

        product:
            {},

        composition:
            {},

        camera:
            {},

        lighting:
            {},

        environment:
            {},

        color_palette:
            [],

        visual_style:
            {},

        text_branding:
            [],

        image_quality:
            {},

        important_details:
            [],

        uncertainties:
            []

    });


/* =========================================================
   HELPERS
========================================================= */

function getState() {

    if (
        !window.GENZVisionState
    ) {

        throw new Error(
            "GENZVisionState belum tersedia."
        );

    }


    return window.GENZVisionState;

}


/* =========================================================
   EMPTY VALUE
========================================================= */

function isEmptyValue(
    value
) {

    if (
        value ===
        null ||
        value ===
        undefined
    ) {

        return true;

    }


    if (
        typeof value ===
        "string"
    ) {

        return (
            value.trim()
                .length === 0
        );

    }


    if (
        Array.isArray(
            value
        )
    ) {

        return (
            value.length ===
            0
        );

    }


    if (
        typeof value ===
        "object"
    ) {

        return (
            Object.keys(
                value
            ).length ===
            0
        );

    }


    return false;

}


/* =========================================================
   SAFE STRING
========================================================= */

function safeString(
    value,
    fallback = ""
) {

    if (
        value ===
        null ||
        value ===
        undefined
    ) {

        return fallback;

    }


    if (
        typeof value ===
        "string"
    ) {

        return value.trim();

    }


    if (
        typeof value ===
        "number" ||
        typeof value ===
        "boolean"
    ) {

        return String(
            value
        );

    }


    return fallback;

}


/* =========================================================
   SAFE ARRAY
========================================================= */

function safeArray(
    value
) {

    if (
        Array.isArray(
            value
        )
    ) {

        return value
            .filter(
                item =>
                    !isEmptyValue(
                        item
                    )
            );

    }


    if (
        typeof value ===
        "string"
    ) {

        const text =
            value.trim();


        if (
            !text
        ) {

            return [];

        }


        return [

            text

        ];

    }


    return [];

}


/* =========================================================
   SAFE OBJECT
========================================================= */

function safeObject(
    value
) {

    if (
        !value ||
        typeof value !==
            "object" ||
        Array.isArray(
            value
        )
    ) {

        return {};

    }


    return {

        ...value

    };

}


/* =========================================================
   DEEP CLONE
========================================================= */

function clone(
    value
) {

    if (
        value ===
        undefined
    ) {

        return undefined;

    }


    try {

        return JSON.parse(
            JSON.stringify(
                value
            )
        );

    } catch {

        return value;

    }

}


/* =========================================================
   NORMALIZE FIELD OBJECT
========================================================= */

function normalizeFieldObject(
    value
) {

    if (
        typeof value ===
        "string"
    ) {

        return {

            description:
                value.trim()

        };

    }


    if (
        typeof value ===
        "number" ||
        typeof value ===
        "boolean"
    ) {

        return {

            value

        };

    }


    return safeObject(
        value
    );

}


/* =========================================================
   NORMALIZE ACCESSORIES
========================================================= */

function normalizeAccessories(
    value
) {

    return safeArray(
        value
    )
        .map(
            item => {

                if (
                    typeof item ===
                    "string"
                ) {

                    return item.trim();

                }


                if (
                    item &&
                    typeof item ===
                        "object"
                ) {

                    return {

                        ...item

                    };

                }


                return String(
                    item
                );

            }
        )
        .filter(
            Boolean
        );

}


/* =========================================================
   NORMALIZE SIMPLE ARRAY
========================================================= */

function normalizeStringArray(
    value
) {

    return safeArray(
        value
    )
        .map(
            item => {

                if (
                    typeof item ===
                    "string"
                ) {

                    return item.trim();

                }


                if (
                    typeof item ===
                    "object"
                ) {

                    try {

                        return JSON.stringify(
                            item
                        );

                    } catch {

                        return "";

                    }

                }


                return String(
                    item
                );

            }
        )
        .filter(
            Boolean
        );

}


/* =========================================================
   NORMALIZE ANALYSIS
========================================================= */

function normalizeAnalysis(
    analysis
) {

    const source =
        safeObject(
            analysis
        );


    const normalized = {

        subject:
            normalizeFieldObject(
                source.subject
            ),

        appearance:
            normalizeFieldObject(
                source.appearance
            ),

        face_hair:
            normalizeFieldObject(
                source.face_hair ||
                source.faceHair
            ),

        pose:
            normalizeFieldObject(
                source.pose
            ),

        clothing:
            normalizeFieldObject(
                source.clothing
            ),

        accessories:
            normalizeAccessories(
                source.accessories
            ),

        product:
            normalizeFieldObject(
                source.product
            ),

        composition:
            normalizeFieldObject(
                source.composition
            ),

        camera:
            normalizeFieldObject(
                source.camera
            ),

        lighting:
            normalizeFieldObject(
                source.lighting
            ),

        environment:
            normalizeFieldObject(
                source.environment
            ),

        color_palette:
            normalizeStringArray(
                source.color_palette ||
                source.colorPalette
            ),

        visual_style:
            normalizeFieldObject(
                source.visual_style ||
                source.visualStyle
            ),

        text_branding:
            normalizeStringArray(
                source.text_branding ||
                source.textBranding
            ),

        image_quality:
            normalizeFieldObject(
                source.image_quality ||
                source.imageQuality
            ),

        important_details:
            normalizeStringArray(
                source.important_details ||
                source.importantDetails
            ),

        uncertainties:
            normalizeStringArray(
                source.uncertainties
            )

    };


    return normalized;

}


/* =========================================================
   PARSE ANALYSIS TEXT
========================================================= */

function parseAnalysisText(
    text
) {

    if (
        typeof text !==
        "string"
    ) {

        return null;

    }


    const source =
        text.trim();


    if (
        !source
    ) {

        return null;

    }


    /*
     * Hilangkan markdown fence.
     */

    const cleaned =
        source
            .replace(
                /^```json\s*/i,
                ""
            )
            .replace(
                /^```\s*/i,
                ""
            )
            .replace(
                /\s*```$/i,
                ""
            )
            .trim();


    try {

        const parsed =
            JSON.parse(
                cleaned
            );


        if (
            parsed &&
            typeof parsed ===
                "object" &&
            !Array.isArray(
                parsed
            )
        ) {

            return parsed;

        }

    } catch {

        /*
         * Lanjutkan ke fallback
         * object extraction.
         */

    }


    /*
     * Fallback:
     * cari object JSON pertama
     * yang lengkap.
     */

    const firstBrace =
        cleaned.indexOf(
            "{"
        );


    const lastBrace =
        cleaned.lastIndexOf(
            "}"
        );


    if (
        firstBrace ===
            -1 ||
        lastBrace <=
            firstBrace
    ) {

        return null;

    }


    const candidate =
        cleaned.slice(
            firstBrace,
            lastBrace + 1
        );


    try {

        const parsed =
            JSON.parse(
                candidate
            );


        if (
            parsed &&
            typeof parsed ===
                "object" &&
            !Array.isArray(
                parsed
            )
        ) {

            return parsed;

        }


    } catch {

        return null;

    }


    return null;

}


/* =========================================================
   FIND ANALYSIS PAYLOAD
   ---------------------------------------------------------
   API response OpenKey dapat berbentuk:

   1. Direct analysis object
   2. { content: "```json ... ```" }
   3. { message: { content: "..." } }
   4. { data: { content: "..." } }
   5. { analysis: "..." }
   6. { result: "..." }
   7. Nested wrapper beberapa tingkat

   Fungsi ini hanya mencari payload.
   Tidak melakukan request atau side effect.
========================================================= */

function extractAnalysisPayload(
    value
) {

    if (
        value ===
        null ||
        value ===
        undefined
    ) {

        return null;

    }


    /*
     * String kemungkinan besar
     * adalah JSON analysis langsung.
     */

    if (
        typeof value ===
        "string"
    ) {

        const parsed =
            parseAnalysisText(
                value
            );


        if (
            parsed
        ) {

            return parsed;

        }


        return null;

    }


    if (
        typeof value !==
            "object" ||
        Array.isArray(
            value
        )
    ) {

        return null;

    }


    /*
     * Jika object sudah mempunyai
     * field analysis utama, gunakan
     * object tersebut langsung.
     */

    const analysisKeys = [

        "subject",
        "appearance",
        "face_hair",
        "faceHair",
        "pose",
        "clothing",
        "accessories",
        "product",
        "composition",
        "camera",
        "lighting",
        "environment",
        "color_palette",
        "colorPalette",
        "visual_style",
        "visualStyle",
        "text_branding",
        "textBranding",
        "image_quality",
        "imageQuality",
        "important_details",
        "importantDetails",
        "uncertainties"

    ];


    const hasAnalysisField =
        analysisKeys.some(
            key =>
                Object.prototype.hasOwnProperty.call(
                    value,
                    key
                )
        );


    if (
        hasAnalysisField
    ) {

        return value;

    }


    /*
     * OpenKey chat response:
     *
     * {
     *   success: true,
     *   content: "```json..."
     * }
     */

    const directCandidates = [

        value.content,

        value.analysis,

        value.result,

        value.output,

        value.text

    ];


    for (
        const candidate
        of directCandidates
    ) {

        if (
            candidate ===
            null ||
            candidate ===
            undefined
        ) {

            continue;

        }


        const extracted =
            extractAnalysisPayload(
                candidate
            );


        if (
            extracted
        ) {

            return extracted;

        }

    }


    /*
     * OpenAI-compatible response:
     *
     * {
     *   choices: [
     *     {
     *       message: {
     *         content: "..."
     *       }
     *     }
     *   ]
     * }
     */

    if (
        Array.isArray(
            value.choices
        )
    ) {

        for (
            const choice
            of value.choices
        ) {

            const extracted =
                extractAnalysisPayload(
                    choice
                );


            if (
                extracted
            ) {

                return extracted;

            }

        }

    }


    /*
     * Message wrapper.
     */

    if (
        value.message
    ) {

        const extracted =
            extractAnalysisPayload(
                value.message
            );


        if (
            extracted
        ) {

            return extracted;

        }

    }


    /*
     * Data wrapper.
     */

    if (
        value.data
    ) {

        const extracted =
            extractAnalysisPayload(
                value.data
            );


        if (
            extracted
        ) {

            return extracted;

        }

    }


    /*
     * Raw wrapper.
     */

    if (
        value.raw
    ) {

        const extracted =
            extractAnalysisPayload(
                value.raw
            );


        if (
            extracted
        ) {

            return extracted;

        }

    }


    return null;

}


/* =========================================================
   ANALYSIS OBJECT CHECK
========================================================= */

function isAnalysisObject(
    value
) {

    if (
        !value ||
        typeof value !==
            "object" ||
        Array.isArray(
            value
        )
    ) {

        return false;

    }


    const analysisKeys = [

        "subject",
        "appearance",
        "face_hair",
        "faceHair",
        "pose",
        "clothing",
        "accessories",
        "product",
        "composition",
        "camera",
        "lighting",
        "environment",
        "color_palette",
        "colorPalette",
        "visual_style",
        "visualStyle",
        "text_branding",
        "textBranding",
        "image_quality",
        "imageQuality",
        "important_details",
        "importantDetails",
        "uncertainties"

    ];


    return analysisKeys.some(
        key =>
            Object.prototype.hasOwnProperty.call(
                value,
                key
            )
    );

}


/* =========================================================
   PARSE ANALYSIS
========================================================= */

function parseAnalysis(
    value
) {

    if (
        value ===
        null ||
        value ===
        undefined ||
        value ===
        ""
    ) {

        return {

            normalized:
                clone(
                    DEFAULT_VISION_ANALYSIS
                ),

            raw:
                "",

            parsed:
                false

        };

    }


    /*
     * =====================================================
     * STRING
     * =====================================================
     *
     * JSON analysis dari model biasanya
     * berada di dalam markdown code fence.
     */

    if (
        typeof value ===
        "string"
    ) {

        const parsed =
            parseAnalysisText(
                value
            );


        if (
            parsed
        ) {

            return {

                normalized:
                    normalizeAnalysis(
                        parsed
                    ),

                raw:
                    value,

                parsed:
                    true

            };

        }


        /*
         * Model mengembalikan plain text.
         * Tetap simpan sebagai fallback.
         */

        return {

            normalized:
                normalizeAnalysis(
                    {

                        important_details:
                            [

                                value.trim()

                            ]

                    }
                ),

            raw:
                value,

            parsed:
                false

        };

    }


    /*
     * =====================================================
     * OBJECT
     * =====================================================
     *
     * PENTING:
     * Jangan langsung normalize object.
     *
     * Response OpenKey dapat berupa wrapper:
     *
     * {
     *   success: true,
     *   content: "```json ...```",
     *   message: {
     *      content: "```json ...```"
     *   }
     * }
     *
     * Kita harus mengambil analysis payload
     * terlebih dahulu.
     */

    if (
        typeof value ===
            "object" &&
        !Array.isArray(
            value
        )
    ) {

        /*
         * Direct analysis object.
         */

        if (
            isAnalysisObject(
                value
            )
        ) {

            return {

                normalized:
                    normalizeAnalysis(
                        value
                    ),

                raw:
                    clone(
                        value
                    ),

                parsed:
                    true

            };

        }


        /*
         * Wrapper response.
         */

        const extracted =
            extractAnalysisPayload(
                value
            );


        if (
            extracted
        ) {

            return {

                normalized:
                    normalizeAnalysis(
                        extracted
                    ),

                raw:
                    clone(
                        value
                    ),

                parsed:
                    true

            };

        }


        /*
         * Tidak ditemukan payload analysis.
         */

        return {

            normalized:
                clone(
                    DEFAULT_VISION_ANALYSIS
                ),

            raw:
                clone(
                    value
                ),

            parsed:
                false

        };

    }


    /*
     * =====================================================
     * FALLBACK
     * =====================================================
     */

    return {

        normalized:
            clone(
                DEFAULT_VISION_ANALYSIS
            ),

        raw:
            value,

        parsed:
            false

    };

}


/* =========================================================
   STORE ANALYSIS
========================================================= */

function storeAnalysis(
    value
) {

    const state =
        getState();


    const result =
        parseAnalysis(
            value
        );


    state.setAnalysis(

        result.raw,

        result.normalized,

        typeof result.raw ===
            "string"
            ? result.raw
            : JSON.stringify(
                result.normalized,
                null,
                2
            )

    );


    return result;

}


/* =========================================================
   GET STORED ANALYSIS
========================================================= */

function getStoredAnalysis() {

    const state =
        getState();


    return {

        raw:
            state.get(
                "analysis.raw",
                null
            ),

        normalized:
            state.get(
                "analysis.normalized",
                null
            ),

        text:
            state.get(
                "analysis.text",
                ""
            ),

        completed:
            Boolean(
                state.get(
                    "analysis.completed",
                    false
                )
            )

    };

}


/* =========================================================
   ANALYSIS SUMMARY
========================================================= */

function getAnalysisSummary(
    analysis
) {

    const parsed =
        normalizeAnalysis(
            analysis
        );


    const summary = [];


    const subject =
        safeString(
            parsed.subject?.description ||
            parsed.subject?.type ||
            parsed.subject?.value
        );


    if (
        subject
    ) {

        summary.push(
            `Subject: ${subject}`
        );

    }


    const appearance =
        safeString(
            parsed.appearance?.description ||
            parsed.appearance?.value
        );


    if (
        appearance
    ) {

        summary.push(
            `Appearance: ${appearance}`
        );

    }


    const pose =
        safeString(
            parsed.pose?.description ||
            parsed.pose?.value
        );


    if (
        pose
    ) {

        summary.push(
            `Pose: ${pose}`
        );

    }


    const clothing =
        safeString(
            parsed.clothing?.description ||
            parsed.clothing?.value
        );


    if (
        clothing
    ) {

        summary.push(
            `Clothing: ${clothing}`
        );

    }


    const product =
        safeString(
            parsed.product?.description ||
            parsed.product?.name ||
            parsed.product?.value
        );


    if (
        product
    ) {

        summary.push(
            `Product: ${product}`
        );

    }


    const environment =
        safeString(
            parsed.environment?.description ||
            parsed.environment?.value
        );


    if (
        environment
    ) {

        summary.push(
            `Environment: ${environment}`
        );

    }


    const style =
        safeString(
            parsed.visual_style?.description ||
            parsed.visual_style?.style ||
            parsed.visual_style?.value
        );


    if (
        style
    ) {

        summary.push(
            `Style: ${style}`
        );

    }


    return summary.join(
        "\n"
    );

}


/* =========================================================
   HAS USEFUL ANALYSIS
========================================================= */

function hasUsefulAnalysis(
    analysis
) {

    if (
        !analysis
    ) {

        return false;

    }


    /*
     * Parse wrapper terlebih dahulu.
     *
     * Ini penting jika fungsi dipanggil
     * langsung dengan response OpenKey.
     */

    const parsed =
        parseAnalysis(
            analysis
        );


    const normalized =
        parsed.normalized;


    const fields = [

        normalized.subject,

        normalized.appearance,

        normalized.face_hair,

        normalized.pose,

        normalized.clothing,

        normalized.accessories,

        normalized.product,

        normalized.composition,

        normalized.camera,

        normalized.lighting,

        normalized.environment,

        normalized.color_palette,

        normalized.visual_style,

        normalized.text_branding,

        normalized.image_quality,

        normalized.important_details

    ];


    return fields.some(
        field =>
            !isEmptyValue(
                field
            )
    );

}


/* =========================================================
   FORMAT FOR DISPLAY
========================================================= */

function formatAnalysisForDisplay(
    analysis
) {

    if (
        typeof analysis ===
        "string"
    ) {

        const parsed =
            parseAnalysisText(
                analysis
            );


        if (
            parsed
        ) {

            try {

                return JSON.stringify(
                    normalizeAnalysis(
                        parsed
                    ),
                    null,
                    2
                );

            } catch {

                return analysis;

            }

        }


        return analysis;

    }


    const parsed =
        parseAnalysis(
            analysis
        );


    const normalized =
        parsed.normalized;


    try {

        return JSON.stringify(
            normalized,
            null,
            2
        );

    } catch {

        return String(
            analysis ||
            ""
        );

    }

}


/* =========================================================
   FORMAT FOR PROMPT
========================================================= */

function formatAnalysisForPrompt(
    analysis
) {

    /*
     * Penting:
     * formatAnalysisForPrompt juga harus mampu
     * menerima wrapper API maupun direct object.
     */

    const parsed =
        parseAnalysis(
            analysis
        );


    const normalized =
        parsed.normalized;


    try {

        return JSON.stringify(
            normalized,
            null,
            2
        );

    } catch {

        return String(
            analysis ||
            ""
        );

    }

}


/* =========================================================
   CLEAR ANALYSIS
========================================================= */

function clearAnalysis() {

    const state =
        getState();


    state.clearAnalysis();


    return true;

}


/* =========================================================
   PUBLIC API
   ---------------------------------------------------------
   PENTING:
   vision-api-analysis.js dan vision-analysis.js sama-sama
   menggunakan window.GENZVisionAnalysis.

   vision-api-analysis.js menyediakan:
   - buildAnalysisSystemPrompt
   - buildAnalysisUserPrompt
   - validateAnalysisQuality
   - analyzeImage

   vision-analysis.js menyediakan:
   - parsing
   - normalization
   - storage
   - formatting

   Jangan membuang API yang sudah dibuat oleh module lain.
========================================================= */


/*
 * Simpan module API request yang mungkin sudah dibuat
 * oleh vision-api-analysis.js.
 *
 * Karena loader mengimpor vision-api-analysis.js sebelum
 * vision-analysis.js, object ini normalnya sudah tersedia.
 */

const existingVisionAnalysis =
    window.GENZVisionAnalysis;


/* =========================================================
   ANALYSIS PROCESSING API
========================================================= */

const analysisProcessingAPI = {

    DEFAULT:
        DEFAULT_VISION_ANALYSIS,

    isEmptyValue,

    safeString,

    safeArray,

    safeObject,

    normalizeAnalysis,

    parseAnalysisText,

    extractAnalysisPayload,

    isAnalysisObject,

    parseAnalysis,

    storeAnalysis,

    getStoredAnalysis,

    getAnalysisSummary,

    hasUsefulAnalysis,

    formatAnalysisForDisplay,

    formatAnalysisForPrompt,

    clearAnalysis

};


/* =========================================================
   MERGE API
========================================================= */

if (
    existingVisionAnalysis &&
    typeof existingVisionAnalysis ===
        "object"
) {

    /*
     * Pertahankan semua API dari
     * vision-api-analysis.js.
     *
     * Kemudian tambahkan fungsi processing
     * dari module ini.
     */

    window.GENZVisionAnalysis =
        Object.freeze({

            ...existingVisionAnalysis,

            ...analysisProcessingAPI

        });

} else {

    /*
     * Fallback jika module processing
     * dimuat lebih dahulu.
     */

    window.GENZVisionAnalysis =
        Object.freeze(
            analysisProcessingAPI
        );

}


/* =========================================================
   DIAGNOSTIC
========================================================= */

console.info(

    "[GEN-Z.AI Vision] Analysis processing module ready.",

    {

        hasAnalyzeImage:
            typeof window.GENZVisionAnalysis?.analyzeImage ===
            "function",

        hasBuildAnalysisSystemPrompt:
            typeof window.GENZVisionAnalysis?.buildAnalysisSystemPrompt ===
            "function",

        hasBuildAnalysisUserPrompt:
            typeof window.GENZVisionAnalysis?.buildAnalysisUserPrompt ===
            "function",

        hasValidateAnalysisQuality:
            typeof window.GENZVisionAnalysis?.validateAnalysisQuality ===
            "function",

        hasNormalizeAnalysis:
            typeof window.GENZVisionAnalysis?.normalizeAnalysis ===
            "function",

        hasParseAnalysis:
            typeof window.GENZVisionAnalysis?.parseAnalysis ===
            "function",

        hasStoreAnalysis:
            typeof window.GENZVisionAnalysis?.storeAnalysis ===
            "function"

    }

);
