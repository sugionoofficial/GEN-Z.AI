/* =========================================================
   GEN-Z.AI VISION
   ---------------------------------------------------------
   File:
   vision/assets/js/vision-api-analysis.js

   Fungsi:
   - Vision Analysis system prompt
   - Vision Analysis user prompt
   - JSON extraction
   - Quality validation
   - Analyze image
   - Retry jika output terpotong / tidak lengkap
========================================================= */


/* =========================================================
   ANALYSIS SYSTEM PROMPT
========================================================= */

function buildAnalysisSystemPrompt() {

    return `
You are the visual analysis engine of GEN-Z.AI Vision.

Your task is to analyze the supplied reference image with
extremely high visual accuracy and completeness.

The attached image is the primary source of truth.

Do NOT generate a creative prompt yet.

Extract observable visual information into structured JSON.

Analyze:

1. subject
2. appearance
3. face and hair
4. pose and body position
5. clothing
6. accessories
7. product
8. composition
9. framing
10. camera perspective
11. lens characteristics
12. depth of field
13. lighting
14. shadows
15. environment
16. background
17. color palette
18. visual style
19. text and branding
20. image quality
21. important visual details
22. spatial relationships
23. uncertainty

Rules:

- Inspect the actual attached image.
- The attached image MUST be used as the visual source.
- Describe observable details specifically.
- Extract concrete colors, shapes, textures, patterns,
  positions and spatial relationships.
- Describe facial characteristics individually when visible.
- Describe clothing pieces individually.
- Describe patterns and textures when visible.
- Describe background details specifically.
- Describe lighting direction and quality when observable.
- Describe camera perspective when visually inferable.
- Describe composition and subject placement precisely.
- Describe accessories individually.
- Identify products and visible branding carefully.
- Never invent hidden details.
- Use null or "unknown" when something cannot be determined.
- Preserve spatial relationships.
- Separate visible facts from uncertainty.
- Never claim a person's real-world identity.

IMPORTANT:

The returned JSON MUST contain actual observable information.

Do NOT return an empty schema.

Do NOT return:

{
  "subject": {},
  "appearance": {},
  "face_hair": {},
  "pose": {},
  "clothing": {},
  "product": {},
  "composition": {},
  "camera": {},
  "lighting": {},
  "environment": {},
  "background": {},
  "visual_style": {},
  "image_quality": {}
}

with all fields empty.

If a category is genuinely not applicable, use:

{
  "present": false
}

or:

{
  "value": null
}

But all categories that are visibly applicable MUST contain
concrete observations.

IMPORTANT OUTPUT COMPLETENESS RULE:

The JSON object MUST be completely closed before you finish.

Do NOT stop in the middle of a property name.

Do NOT stop in the middle of a string.

Do NOT stop before the final closing braces and brackets.

The following fields MUST appear in the final JSON:

subject
appearance
face_hair
pose
clothing
accessories
product
composition
camera
lighting
shadows
environment
background
color_palette
visual_style
text_branding
image_quality
important_details
spatial_relationships
uncertainties

Return valid JSON only.

Do not use Markdown fences.

Do not add explanations before or after the JSON.

Use this structure:

{
  "subject": {},
  "appearance": {},
  "face_hair": {},
  "pose": {},
  "clothing": {},
  "accessories": [],
  "product": {},
  "composition": {},
  "camera": {},
  "lighting": {},
  "shadows": {},
  "environment": {},
  "background": {},
  "color_palette": [],
  "visual_style": {},
  "text_branding": [],
  "image_quality": {},
  "important_details": [],
  "spatial_relationships": [],
  "uncertainties": []
}
`.trim();

}


/* =========================================================
   ANALYSIS USER PROMPT
========================================================= */

function buildAnalysisUserPrompt(
    settings = {}
) {

    const detail =
        settings.detail ||
        "ultra";


    const purpose =
        settings.purpose ||
        "image-generation";


    const instruction =
        settings.instruction ||
        "";


    return `
Analyze this reference image for GEN-Z.AI Vision.

The attached image is the primary source of truth.

Analysis detail level:
${detail}

Intended purpose:
${purpose}

Additional user instruction:
${instruction || "None"}

Inspect the actual attached image carefully before producing
the result.

For a person, inspect:

- visible facial structure
- eyes
- eyebrows
- nose
- lips
- makeup
- skin appearance
- hair or head covering
- expression
- gaze
- head angle
- body position
- clothing
- colors
- fabrics
- patterns
- folds
- accessories

For products, inspect:

- type
- shape
- material
- color
- surface
- branding
- labels
- placement

For composition, inspect:

- framing
- subject placement
- orientation
- camera perspective
- apparent lens character
- focus
- depth of field

For lighting, inspect:

- direction
- softness
- highlights
- shadows
- contrast
- color temperature when observable

For environment and background, inspect:

- architecture
- walls
- surfaces
- textures
- objects
- colors
- spatial relationships

For visual style, inspect:

- photographic or cinematic characteristics
- realism
- sharpness
- background separation
- color treatment
- aesthetic

Do not summarize too aggressively.

Do not invent information.

Every visibly applicable category should contain
specific observations.

Do NOT return an empty JSON schema.

CRITICAL:

Complete the ENTIRE JSON object.

Do not stop before all required categories are present.

Do not truncate a property name or string.

The response is invalid if the JSON is incomplete.

Return ONLY valid JSON.

Do not use Markdown code fences.

Do not write any explanation outside the JSON.
`.trim();

}


/* =========================================================
   JSON CLEANER
========================================================= */

function cleanJSONString(
    value
) {

    return String(
        value ||
        ""
    )
        .replace(
            /^\uFEFF/,
            ""
        )
        .trim();

}


/* =========================================================
   EXTRACT JSON FROM CODE FENCE
========================================================= */

function extractJSONFromCodeFence(
    text
) {

    const source =
        cleanJSONString(
            text
        );


    const match =
        source.match(
            /```(?:json|JSON)?\s*([\s\S]*?)\s*```/
        );


    if (
        !match ||
        !match[1]
    ) {

        return null;

    }


    return cleanJSONString(
        match[1]
    );

}


/* =========================================================
   EXTRACT BALANCED JSON OBJECT
========================================================= */

function extractBalancedJSONObject(
    text
) {

    const source =
        cleanJSONString(
            text
        );


    const firstBrace =
        source.indexOf(
            "{"
        );


    if (
        firstBrace === -1
    ) {

        return null;

    }


    let depth = 0;

    let inString = false;

    let escaped = false;


    for (
        let index =
            firstBrace;

        index <
            source.length;

        index++
    ) {

        const char =
            source[index];


        if (
            inString
        ) {

            if (
                escaped
            ) {

                escaped =
                    false;

                continue;

            }


            if (
                char === "\\"
            ) {

                escaped =
                    true;

                continue;

            }


            if (
                char === '"'
            ) {

                inString =
                    false;

            }


            continue;

        }


        if (
            char === '"'
        ) {

            inString =
                true;

            continue;

        }


        if (
            char === "{"
        ) {

            depth++;

            continue;

        }


        if (
            char === "}"
        ) {

            depth--;


            if (
                depth === 0
            ) {

                return source.slice(
                    firstBrace,
                    index + 1
                );

            }

        }

    }


    return null;

}


/* =========================================================
   EXTRACT BALANCED JSON ARRAY
========================================================= */

function extractBalancedJSONArray(
    text
) {

    const source =
        cleanJSONString(
            text
        );


    const firstBracket =
        source.indexOf(
            "["
        );


    if (
        firstBracket === -1
    ) {

        return null;

    }


    let depth = 0;

    let inString = false;

    let escaped = false;


    for (
        let index =
            firstBracket;

        index <
            source.length;

        index++
    ) {

        const char =
            source[index];


        if (
            inString
        ) {

            if (
                escaped
            ) {

                escaped =
                    false;

                continue;

            }


            if (
                char === "\\"
            ) {

                escaped =
                    true;

                continue;

            }


            if (
                char === '"'
            ) {

                inString =
                    false;

            }


            continue;

        }


        if (
            char === '"'
        ) {

            inString =
                true;

            continue;

        }


        if (
            char === "["
        ) {

            depth++;

            continue;

        }


        if (
            char === "]"
        ) {

            depth--;


            if (
                depth === 0
            ) {

                return source.slice(
                    firstBracket,
                    index + 1
                );

            }

        }

    }


    return null;

}


/* =========================================================
   EXTRACT ANALYSIS JSON
========================================================= */

function extractAnalysisJSON(
    text
) {

    const source =
        cleanJSONString(
            text
        );


    if (
        !source
    ) {

        return {

            parsed:
                null,

            jsonText:
                null,

            method:
                "empty"

        };

    }


    /* -----------------------------------------------------
       1. DIRECT JSON
    ----------------------------------------------------- */

    try {

        const direct =
            JSON.parse(
                source
            );


        if (
            direct &&
            typeof direct === "object"
        ) {

            return {

                parsed:
                    direct,

                jsonText:
                    source,

                method:
                    "direct"

            };

        }

    }
    catch {

        /* Continue */

    }


    /* -----------------------------------------------------
       2. MARKDOWN CODE FENCE
    ----------------------------------------------------- */

    const fenced =
        extractJSONFromCodeFence(
            source
        );


    if (
        fenced
    ) {

        try {

            const parsed =
                JSON.parse(
                    fenced
                );


            if (
                parsed &&
                typeof parsed === "object"
            ) {

                return {

                    parsed,

                    jsonText:
                        fenced,

                    method:
                        "code-fence"

                };

            }

        }
        catch {

            /* Continue */

        }

    }


    /* -----------------------------------------------------
       3. BALANCED OBJECT
    ----------------------------------------------------- */

    const objectText =
        extractBalancedJSONObject(
            source
        );


    if (
        objectText
    ) {

        try {

            const parsed =
                JSON.parse(
                    objectText
                );


            if (
                parsed &&
                typeof parsed === "object"
            ) {

                return {

                    parsed,

                    jsonText:
                        objectText,

                    method:
                        "balanced-object"

                };

            }

        }
        catch {

            /* Continue */

        }

    }


    /* -----------------------------------------------------
       4. BALANCED ARRAY
    ----------------------------------------------------- */

    const arrayText =
        extractBalancedJSONArray(
            source
        );


    if (
        arrayText
    ) {

        try {

            const parsed =
                JSON.parse(
                    arrayText
                );


            if (
                parsed &&
                typeof parsed === "object"
            ) {

                return {

                    parsed,

                    jsonText:
                        arrayText,

                    method:
                        "balanced-array"

                };

            }

        }
        catch {

            /* Continue */

        }

    }


    return {

        parsed:
            null,

        jsonText:
            null,

        method:
            "failed"

    };

}


/* =========================================================
   CONCRETE VALUE CHECK
========================================================= */

function hasConcreteAnalysisValue(
    value
) {

    if (
        value === null ||
        value === undefined
    ) {

        return false;

    }


    if (
        typeof value === "string"
    ) {

        const normalized =
            value
                .trim()
                .toLowerCase();


        if (
            !normalized
        ) {

            return false;

        }


        if (
            normalized === "unknown" ||
            normalized === "n/a" ||
            normalized === "na" ||
            normalized === "null" ||
            normalized === "none" ||
            normalized === "not visible" ||
            normalized === "not applicable"
        ) {

            return false;

        }


        return true;

    }


    if (
        typeof value === "number" ||
        typeof value === "boolean"
    ) {

        return true;

    }


    if (
        Array.isArray(
            value
        )
    ) {

        return value.some(
            item =>
                hasConcreteAnalysisValue(
                    item
                )
        );

    }


    if (
        typeof value === "object"
    ) {

        return Object.entries(
            value
        )
            .some(
                ([key, item]) => {

                    if (
                        key === "present" &&
                        item === false
                    ) {

                        return false;

                    }


                    return hasConcreteAnalysisValue(
                        item
                    );

                }
            );

    }


    return false;

}


/* =========================================================
   COUNT ANALYSIS FACTS
========================================================= */

function countAnalysisFacts(
    value
) {

    if (
        value === null ||
        value === undefined
    ) {

        return 0;

    }


    if (
        typeof value === "string"
    ) {

        const normalized =
            value
                .trim()
                .toLowerCase();


        if (
            !normalized ||
            normalized === "unknown" ||
            normalized === "n/a" ||
            normalized === "na" ||
            normalized === "null" ||
            normalized === "none" ||
            normalized === "not visible" ||
            normalized === "not applicable"
        ) {

            return 0;

        }


        return 1;

    }


    if (
        typeof value === "number" ||
        typeof value === "boolean"
    ) {

        return 1;

    }


    if (
        Array.isArray(
            value
        )
    ) {

        return value.reduce(
            (
                total,
                item
            ) =>
                total +
                countAnalysisFacts(
                    item
                ),
            0
        );

    }


    if (
        typeof value === "object"
    ) {

        return Object.entries(
            value
        )
            .reduce(
                (
                    total,
                    [key, item]
                ) => {

                    if (
                        key === "present" &&
                        item === false
                    ) {

                        return total;

                    }


                    return total +
                        countAnalysisFacts(
                            item
                        );

                },
                0
            );

    }


    return 0;

}


/* =========================================================
   REQUIRED ANALYSIS CATEGORIES
========================================================= */

const REQUIRED_ANALYSIS_CATEGORIES =
    Object.freeze([

        "subject",
        "appearance",
        "face_hair",
        "pose",
        "clothing",
        "accessories",
        "product",
        "composition",
        "camera",
        "lighting",
        "shadows",
        "environment",
        "background",
        "color_palette",
        "visual_style",
        "text_branding",
        "image_quality",
        "important_details",
        "spatial_relationships",
        "uncertainties"

    ]);


/* =========================================================
   COUNT POPULATED CATEGORIES
========================================================= */

function countPopulatedAnalysisCategories(
    analysis
) {

    if (
        !analysis ||
        typeof analysis !== "object" ||
        Array.isArray(analysis)
    ) {

        return 0;

    }


    return REQUIRED_ANALYSIS_CATEGORIES
        .reduce(
            (
                total,
                key
            ) => {

                if (
                    !Object.prototype.hasOwnProperty.call(
                        analysis,
                        key
                    )
                ) {

                    return total;

                }


                const value =
                    analysis[key];


                if (
                    value === null ||
                    value === undefined
                ) {

                    return total;

                }


                if (
                    typeof value === "object" &&
                    !Array.isArray(value)
                ) {

                    if (
                        value.present === false
                    ) {

                        return total;

                    }

                }


                if (
                    hasConcreteAnalysisValue(
                        value
                    )
                ) {

                    return total + 1;

                }


                return total;

            },
            0
        );

}


/* =========================================================
   ANALYSIS QUALITY
========================================================= */

function validateAnalysisQuality(
    text
) {

    const normalized =
        cleanJSONString(
            text
        );


    if (
        !normalized
    ) {

        return {

            valid:
                false,

            reason:
                "Visual analysis kosong.",

            code:
                "EMPTY_ANALYSIS_RESPONSE",

            length:
                0,

            factCount:
                0,

            populatedCategories:
                0,

            parsed:
                null

        };

    }


    const refusalPatterns = [

        /no visual details were provided/i,

        /visual details were not provided/i,

        /cannot generate.*without.*visual/i,

        /cannot.*analy[sz]e.*image/i,

        /unable to.*analy[sz]e.*image/i,

        /image.*not.*provided/i,

        /no image.*provided/i,

        /cannot.*see.*image/i,

        /unable to.*see.*image/i

    ];


    if (
        refusalPatterns.some(
            pattern =>
                pattern.test(
                    normalized
                )
        )
    ) {

        return {

            valid:
                false,

            reason:
                "Model tidak melakukan visual analysis terhadap reference image.",

            code:
                "ANALYSIS_REFUSAL",

            length:
                normalized.length,

            factCount:
                0,

            populatedCategories:
                0,

            parsed:
                null

        };

    }


    const minimumCharacters =
        Number(
            window.GENZVisionCore
                ?.CONFIG
                ?.minAnalysisCharacters
        ) || 0;


    if (
        minimumCharacters > 0 &&
        normalized.length <
            minimumCharacters
    ) {

        return {

            valid:
                false,

            reason:
                "Visual analysis terlalu pendek untuk membuat prompt.",

            code:
                "ANALYSIS_TOO_SHORT",

            length:
                normalized.length,

            factCount:
                0,

            populatedCategories:
                0,

            parsed:
                null

        };

    }


    const extraction =
        extractAnalysisJSON(
            normalized
        );


    if (
        !extraction.parsed
    ) {

        return {

            valid:
                false,

            reason:
                "Visual analysis tidak menghasilkan JSON terstruktur yang valid.",

            code:
                "ANALYSIS_INVALID_JSON",

            length:
                normalized.length,

            factCount:
                0,

            populatedCategories:
                0,

            parsed:
                null,

            extractionMethod:
                extraction.method

        };

    }


    const factCount =
        countAnalysisFacts(
            extraction.parsed
        );


    const populatedCategories =
        countPopulatedAnalysisCategories(
            extraction.parsed
        );


    const topLevelKeys =
        extraction.parsed &&
        typeof extraction.parsed === "object" &&
        !Array.isArray(extraction.parsed)
            ? Object.keys(
                extraction.parsed
            )
            : [];


    console.debug(
        "[GEN-Z.AI Vision] Analysis structure diagnostic:",
        {

            extractionMethod:
                extraction.method,

            topLevelKeyCount:
                topLevelKeys.length,

            topLevelKeys,

            populatedCategories,

            factCount

        }
    );


    if (
        factCount === 0
    ) {

        return {

            valid:
                false,

            reason:
                "Visual analysis tidak mengandung fakta visual yang dapat digunakan untuk Prompt Engineering.",

            code:
                "ANALYSIS_EMPTY_FACTS",

            length:
                normalized.length,

            factCount:
                0,

            populatedCategories,

            parsed:
                extraction.parsed,

            extractionMethod:
                extraction.method

        };

    }


    if (
        factCount < 5
    ) {

        return {

            valid:
                false,

            reason:
                "Visual analysis mengandung terlalu sedikit fakta visual.",

            code:
                "ANALYSIS_INSUFFICIENT_FACTS",

            length:
                normalized.length,

            factCount,

            populatedCategories,

            parsed:
                extraction.parsed,

            extractionMethod:
                extraction.method

        };

    }


    /*
     * Untuk analysis dengan struktur lengkap,
     * minimal beberapa kategori harus benar-benar terisi.
     *
     * Jangan mensyaratkan seluruh 20 kategori karena
     * beberapa memang dapat legitimately berisi present:false.
     */

    if (
        populatedCategories < 5
    ) {

        return {

            valid:
                false,

            reason:
                "Visual analysis belum memiliki cukup kategori visual yang terisi.",

            code:
                "ANALYSIS_INSUFFICIENT_CATEGORIES",

            length:
                normalized.length,

            factCount,

            populatedCategories,

            parsed:
                extraction.parsed,

            extractionMethod:
                extraction.method

        };

    }


    return {

        valid:
            true,

        reason:
            "",

        code:
            null,

        length:
            normalized.length,

        factCount,

        populatedCategories,

        parsed:
            extraction.parsed,

        extractionMethod:
            extraction.method

    };

}


/* =========================================================
   BUILD ANALYSIS REQUEST
========================================================= */

function buildAnalysisRequest(
    model,
    messages,
    maxTokens,
    core
) {

    return {

        model:
            model.id,

        messages,

        temperature:
            core.CONFIG
                .analysisTemperature,

        max_tokens:
            maxTokens,

        stream:
            false

    };

}


/* =========================================================
   ANALYZE IMAGE
========================================================= */

async function analyzeImage(
    options = {}
) {

    const core =
        window.GENZVisionCore;


    const models =
        window.GENZVisionModels;


    const responseAPI =
        window.GENZVisionResponse;


    const state =
        core.getState();


    const file =
        state.get(
            "file",
            null
        );


    if (
        !file?.dataUrl
    ) {

        throw core.createAPIError(

            "Reference image belum tersedia.",

            {

                code:
                    "REFERENCE_IMAGE_REQUIRED"

            }

        );

    }


    const requestedModel =
        options.model ||
        models.getSelectedModel();


    const model =
        await models.resolveVisionModel(
            requestedModel,
            options
        );


    const settings =
        options.settings ||
        state.get(
            "settings",
            {}
        );


    const messages = [

        {

            role:
                "system",

            content:
                buildAnalysisSystemPrompt()

        },

        {

            role:
                "user",

            content:
                models.buildImageMessage(

                    buildAnalysisUserPrompt(
                        settings
                    ),

                    file.dataUrl

                )

        }

    ];


    /* -----------------------------------------------------
       TOKEN BUDGET
       -----------------------------------------------------
       Vision JSON cukup besar. Gunakan minimum 8192.
    ----------------------------------------------------- */

    const configuredMaxTokens =
        Number(
            core.CONFIG
                .maxAnalysisTokens
        ) || 0;


    const analysisMaxTokens =
        Math.max(
            configuredMaxTokens,
            8192
        );


    const maxAttempts =
        Number(
            options.analysisAttempts
        ) > 0
            ? Math.min(
                Number(
                    options.analysisAttempts
                ),
                3
            )
            : 2;


    console.info(
        "[GEN-Z.AI Vision] Vision Analysis configuration:",
        {

            configuredMaxTokens,

            analysisMaxTokens,

            maxAttempts,

            model:
                model.id

        }
    );


    let lastResponse =
        null;


    let lastText =
        "";


    let lastQuality =
        null;


    for (
        let attempt = 1;

        attempt <= maxAttempts;

        attempt++
    ) {

        console.info(
            "[GEN-Z.AI Vision] Starting visual-analysis attempt:",
            {

                attempt,

                maxAttempts,

                model:
                    model.id

            }
        );


        let requestMessages =
            messages;


        /*
         * Pada retry, berikan instruksi khusus agar model
         * menyelesaikan JSON sampai penutup terakhir.
         */

        if (
            attempt > 1
        ) {

            requestMessages = [

                {

                    role:
                        "system",

                    content:
                        buildAnalysisSystemPrompt()

                },

                {

                    role:
                        "user",

                    content:
                        `${buildAnalysisUserPrompt(
                            settings
                        )}

=========================================================
RETRY COMPLETENESS REQUIREMENT
=========================================================

Percobaan sebelumnya menghasilkan output yang tidak dapat
digunakan sebagai JSON lengkap.

Ulangi analisis dari reference image.

Kali ini prioritaskan:

1. JSON VALID
2. SEMUA KATEGORI TERISI SESUAI VISIBILITAS
3. SEMUA STRING HARUS SELESAI
4. OBJECT DAN ARRAY HARUS DITUTUP
5. JSON HARUS BERAKHIR DENGAN PENUTUP YANG VALID

Jangan berhenti di tengah property.

Jangan berhenti di tengah kalimat.

Jangan menghasilkan Markdown.

Return ONLY the complete JSON object.
`.trim(),

                    content:
                        models.buildImageMessage(

                            `${buildAnalysisUserPrompt(
                                settings
                            )}

=========================================================
RETRY COMPLETENESS REQUIREMENT
=========================================================

Percobaan sebelumnya menghasilkan output yang tidak dapat
digunakan sebagai JSON lengkap.

Ulangi analisis dari reference image.

Prioritaskan JSON VALID dan LENGKAP.

Semua object dan array harus ditutup.

Jangan berhenti di tengah property atau string.

Return ONLY the complete JSON object.
`.trim(),

                    image:
                        undefined

                }

            ];

            /*
             * Jangan menggunakan struktur retry di atas.
             * Rebuild message dengan format yang sama seperti
             * provider image-message sebelumnya.
             */

            requestMessages = [

                {

                    role:
                        "system",

                    content:
                        buildAnalysisSystemPrompt()

                },

                {

                    role:
                        "user",

                    content:
                        models.buildImageMessage(

                            `${buildAnalysisUserPrompt(
                                settings
                            )}

=========================================================
RETRY COMPLETENESS REQUIREMENT
=========================================================

Percobaan sebelumnya menghasilkan output yang tidak dapat
digunakan sebagai JSON lengkap.

Ulangi analisis dari reference image.

Prioritaskan JSON VALID dan LENGKAP.

Semua object dan array harus ditutup.

Jangan berhenti di tengah property atau string.

Return ONLY the complete JSON object.
`.trim(),

                            file.dataUrl

                        )

                }

            ];

        }


        console.info(
            "[GEN-Z.AI Vision] Sending visual-analysis request:",
            {

                attempt,

                model:
                    model.id,

                messageCount:
                    requestMessages.length,

                hasReferenceImage:
                    Boolean(
                        file.dataUrl
                    ),

                referenceMimeType:
                    file?.mimeType ||
                    file?.type ||
                    null,

                referenceDataLength:
                    String(
                        file.dataUrl ||
                        ""
                    ).length,

                configuredMaxTokens,

                analysisMaxTokens

            }
        );


        try {

            const response =
                await core.request(

                    buildAnalysisRequest(
                        model,
                        requestMessages,
                        analysisMaxTokens,
                        core
                    ),

                    {

                        timeout:
                            options.timeout ||
                            core.CONFIG.timeout

                    }

                );


            lastResponse =
                response;


            console.info(
                "[GEN-Z.AI Vision] Visual-analysis response:",
                responseAPI.sanitizeResponseForDebug(
                    response
                )
            );


            const text =
                responseAPI.extractAssistantText(
                    response
                );


            lastText =
                text ||
                "";


            console.info(
                "[GEN-Z.AI Vision] Visual-analysis raw text:",
                lastText
            );


            if (
                !lastText
            ) {

                lastQuality = {

                    valid:
                        false,

                    reason:
                        "Vision model tidak mengembalikan hasil analisis.",

                    code:
                        "EMPTY_ANALYSIS_RESPONSE",

                    length:
                        0,

                    factCount:
                        0,

                    populatedCategories:
                        0,

                    parsed:
                        null

                };

            }
            else {

                lastQuality =
                    validateAnalysisQuality(
                        lastText
                    );

            }


            console.info(
                "[GEN-Z.AI Vision] Visual-analysis quality:",
                {

                    attempt,

                    valid:
                        lastQuality.valid,

                    reason:
                        lastQuality.reason,

                    code:
                        lastQuality.code,

                    length:
                        lastQuality.length,

                    factCount:
                        lastQuality.factCount,

                    populatedCategories:
                        lastQuality.populatedCategories,

                    extractionMethod:
                        lastQuality.extractionMethod

                }
            );


            if (
                lastQuality.valid
            ) {

                console.info(
                    "[GEN-Z.AI Vision] Visual-analysis concrete fact count:",
                    lastQuality.factCount
                );


                console.info(
                    "[GEN-Z.AI Vision] Visual-analysis populated categories:",
                    lastQuality.populatedCategories
                );


                return {

                    text:
                        lastText,

                    analysis:
                        lastQuality.parsed,

                    raw:
                        lastResponse,

                    model

                };

            }

        }
        catch (
            error
        ) {

            console.error(
                "[GEN-Z.AI Vision] Visual-analysis attempt failed:",
                {

                    attempt,

                    error

                }
            );


            /*
             * Simpan error terakhir agar dapat dilempar
             * setelah seluruh retry selesai.
             */

            lastQuality = {

                valid:
                    false,

                reason:
                    error?.message ||
                    "Vision analysis request failed.",

                code:
                    error?.code ||
                    "ANALYSIS_REQUEST_FAILED",

                length:
                    lastText.length,

                factCount:
                    0,

                populatedCategories:
                    0,

                parsed:
                    null

            };

        }

    }


    /* =====================================================
       ALL ATTEMPTS FAILED
    ===================================================== */

    console.error(
        "[GEN-Z.AI Vision] Visual analysis failed after all attempts:",
        {

            attempts:
                maxAttempts,

            lastQuality,

            lastTextLength:
                lastText.length

        }
    );


    throw core.createAPIError(

        lastQuality?.reason ||
        "Visual analysis belum cukup untuk membuat prompt.",

        {

            code:
                lastQuality?.code ||
                "INVALID_ANALYSIS",

            data: {

                analysis:
                    lastText,

                quality:
                    lastQuality,

                attempts:
                    maxAttempts,

                response:
                    lastResponse

            }

        }

    );

}


/* =========================================================
   GLOBAL MODULE
========================================================= */

const GENZVisionAnalysisAPI =
    Object.freeze({

        buildAnalysisSystemPrompt,

        buildAnalysisUserPrompt,

        extractAnalysisJSON,

        hasConcreteAnalysisValue,

        countAnalysisFacts,

        countPopulatedAnalysisCategories,

        validateAnalysisQuality,

        analyzeImage

    });


const existingVisionAnalysis =
    window.GENZVisionAnalysis;


if (
    existingVisionAnalysis &&
    typeof existingVisionAnalysis === "object"
) {

    window.GENZVisionAnalysis =
        Object.freeze({

            ...existingVisionAnalysis,

            ...GENZVisionAnalysisAPI

        });

}
else {

    window.GENZVisionAnalysis =
        GENZVisionAnalysisAPI;

}
