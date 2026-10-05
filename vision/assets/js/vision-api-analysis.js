/* =========================================================
   GEN-Z.AI VISION
   ---------------------------------------------------------
   File:
   vision/assets/js/vision-api-analysis.js

   Fungsi:
   - Vision Analysis system prompt
   - Vision Analysis user prompt
   - Reference / Character outfit source
   - Multimodal reference + character analysis
   - JSON extraction
   - Quality validation
   - Analyze image
   - Retry incomplete analysis
========================================================= */


/* =========================================================
   OUTFIT SOURCE
========================================================= */

function normalizeAnalysisOutfitSource(
    value
) {

    const normalized =
        String(
            value ||
            "reference"
        )
            .trim()
            .toLowerCase();


    if (
        normalized ===
        "character"
    ) {

        return "character";

    }


    return "reference";

}


/* =========================================================
   GET OUTFIT SOURCE
========================================================= */

function getAnalysisOutfitSource(
    state,
    settings = {}
) {

    /*
     * State getter menjadi sumber utama.
     */

    if (
        state &&
        typeof state.getOutfitSource ===
            "function"
    ) {

        return normalizeAnalysisOutfitSource(
            state.getOutfitSource()
        );

    }


    /*
     * Fallback ke settings.
     */

    return normalizeAnalysisOutfitSource(
        settings?.outfitSource
    );

}


/* =========================================================
   GET REPLACEMENT CHARACTER
========================================================= */

function getAnalysisCharacterFile(
    state
) {

    if (
        state &&
        typeof state.getReplacementCharacter ===
            "function"
    ) {

        return state.getReplacementCharacter();

    }


    /*
     * Compatibility fallback untuk state
     * yang menyediakan get(key).
     */

    if (
        state &&
        typeof state.get ===
            "function"
    ) {

        return state.get(
            "replacementCharacter",
            null
        );

    }


    return null;

}


/* =========================================================
   BUILD OUTFIT SOURCE RULES
========================================================= */

function buildAnalysisOutfitRules(
    outfitSource
) {

    const normalized =
        normalizeAnalysisOutfitSource(
            outfitSource
        );


    if (
        normalized ===
        "character"
    ) {

        return `
=========================================================
OUTFIT SOURCE: REPLACEMENT CHARACTER
=========================================================

Two images may be attached:

IMAGE 1 = REFERENCE IMAGE
IMAGE 2 = REPLACEMENT CHARACTER

IMAGE 2 is the authoritative source for:

- final clothing
- outfit design
- garment type
- garment colors
- garment materials
- garment patterns
- garment textures
- garment construction
- clothing accessories
- outfit-specific details

IMAGE 1 MUST NOT contribute clothing or outfit details.

Use IMAGE 1 for:

- composition
- pose
- body positioning
- scene structure
- environment
- background
- product placement
- camera perspective
- framing
- lighting
- shadows
- spatial relationships

Use IMAGE 2 for:

- character identity
- face
- hair
- visible body characteristics
- final clothing
- final outfit

IMPORTANT:

Do NOT mix clothing between IMAGE 1 and IMAGE 2.

Do NOT transfer the reference image's:

- shirt
- blouse
- jacket
- dress
- pants
- skirt
- shoes
- clothing colors
- clothing patterns
- clothing textures
- clothing accessories

into the final outfit when IMAGE 2 is the selected outfit source.

If a clothing detail is visible only in IMAGE 1,
do NOT report it as the replacement character's final outfit.

The replacement character's outfit must be derived
from IMAGE 2.

=========================================================
`.trim();

    }


    return `
=========================================================
OUTFIT SOURCE: REFERENCE IMAGE
=========================================================

IMAGE 1 = REFERENCE IMAGE

IMAGE 1 is the authoritative source for:

- final clothing
- outfit design
- garment type
- garment colors
- garment materials
- garment patterns
- garment textures
- garment construction
- clothing accessories
- outfit-specific details

If IMAGE 2 is attached, IMAGE 2 is the
REPLACEMENT CHARACTER image.

IMAGE 2 may be used for:

- character identity
- face
- hair
- visible body characteristics

IMAGE 2 MUST NOT contribute clothing or outfit details.

IMPORTANT:

Do NOT mix clothing between IMAGE 1 and IMAGE 2.

Do NOT transfer the replacement character's:

- shirt
- blouse
- jacket
- dress
- pants
- skirt
- shoes
- clothing colors
- clothing patterns
- clothing textures
- clothing accessories

into the final outfit when IMAGE 1 is the selected outfit source.

The final outfit must be derived from IMAGE 1.

=========================================================
`.trim();

}


/* =========================================================
   ANALYSIS SYSTEM PROMPT
========================================================= */

function buildAnalysisSystemPrompt(
    settings = {}
) {

    const outfitSource =
        normalizeAnalysisOutfitSource(
            settings?.outfitSource
        );


    const outfitRules =
        buildAnalysisOutfitRules(
            outfitSource
        );


    return `
You are the visual analysis engine of GEN-Z.AI Vision.

Your task is to analyze the supplied image source(s) with
extremely high visual accuracy and completeness.

Do NOT generate a creative prompt yet.

Extract observable visual information into structured JSON.

${outfitRules}

IMAGE SOURCE RULES:

- Inspect every attached image carefully.
- IMAGE 1 is always the main reference image.
- If IMAGE 2 is attached, it is the replacement character image.
- Never confuse IMAGE 1 and IMAGE 2.
- Never invent information that is not visibly present.
- Never assume that clothing from one image belongs to another image.
- Follow the selected OUTFIT SOURCE rule exactly.

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

- Inspect the actual attached image source(s).
- The actual image content MUST be used as the visual source.
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

The "clothing" category MUST follow the selected
OUTFIT SOURCE.

When OUTFIT SOURCE is REFERENCE IMAGE:
- clothing must come from IMAGE 1.

When OUTFIT SOURCE is REPLACEMENT CHARACTER:
- clothing must come from IMAGE 2.

Do not merge clothing information from both images.

The returned JSON MUST contain actual observable information.

Do NOT return an empty schema.

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

COMPLETENESS REQUIREMENT:

The JSON MUST be completely finished.

Do NOT stop in the middle of a property name.

Do NOT stop in the middle of a string.

Do NOT stop before all applicable categories are completed.

Do NOT stop before the final closing braces and brackets.

The response is INVALID if the JSON is incomplete.

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


    const outfitSource =
        normalizeAnalysisOutfitSource(
            settings?.outfitSource
        );


    const outfitLabel =
        outfitSource === "character"

            ? "Replacement Character Outfit"

            : "Reference Image Outfit";


    const outfitInstructions =
        outfitSource === "character"

            ? `
OUTFIT SOURCE SELECTED:
Replacement Character Outfit.

IMAGE 2 is the authoritative source for
the final clothing and outfit.

Do NOT use clothing from IMAGE 1.
`

            : `
OUTFIT SOURCE SELECTED:
Reference Image Outfit.

IMAGE 1 is the authoritative source for
the final clothing and outfit.

Do NOT use clothing from IMAGE 2.
`;


    return `
Analyze the supplied image source(s) for GEN-Z.AI Vision.

IMAGE 1 is the main reference image.

If IMAGE 2 is attached, IMAGE 2 is the replacement
character image.

Selected outfit source:
${outfitLabel}

${outfitInstructions}

Analysis detail level:
${detail}

Intended purpose:
${purpose}

Additional user instruction:
${instruction || "None"}

Inspect the actual attached image source(s) carefully
before producing the result.

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

IMPORTANT CLOTHING RULE:

Only describe final outfit details from the selected
OUTFIT SOURCE.

If the selected source is REFERENCE IMAGE:
- clothing comes from IMAGE 1
- IMAGE 2 must not contribute clothing

If the selected source is REPLACEMENT CHARACTER:
- clothing comes from IMAGE 2
- IMAGE 1 must not contribute clothing

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

IMPORTANT:

Complete the ENTIRE JSON object.

All object properties and arrays must be properly closed.

Do not stop in the middle of a property.

Do not stop in the middle of a string.

Do not use Markdown.

Return ONLY valid JSON.

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
       2. CODE FENCE
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
            ) => {

                return total +
                    countAnalysisFacts(
                        item
                    );

            },
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
                    !Array.isArray(value) &&
                    value.present === false
                ) {

                    return total;

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
        Object.keys(
            extraction.parsed
        );


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
   BUILD REQUEST
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
   BUILD RETRY MESSAGES
========================================================= */

function buildRetryMessages(
    settings,
    models,
    file,
    characterFile = null
) {

    const outfitSource =
        normalizeAnalysisOutfitSource(
            settings?.outfitSource
        );


    const retryInstruction = `
=========================================================
RETRY: COMPLETE JSON REQUIRED
=========================================================

The previous Vision Analysis response was incomplete or
could not be parsed as a complete structured JSON object.

Analyze the SAME image source configuration again.

The image source configuration is:

IMAGE 1 = REFERENCE IMAGE
IMAGE 2 = REPLACEMENT CHARACTER when provided

OUTFIT SOURCE =
${outfitSource === "character"
    ? "REPLACEMENT CHARACTER"
    : "REFERENCE IMAGE"}

Prioritize:

1. Complete valid JSON.
2. Concrete visual observations.
3. All applicable analysis categories.
4. Properly closed objects and arrays.
5. Complete strings.
6. Correct outfit-source separation.

NEVER stop in the middle of a property name.

NEVER stop in the middle of a string.

NEVER stop before the final closing braces.

NEVER mix clothing between the selected outfit source
and the non-selected image.

Do not summarize.

Do not explain.

Return ONLY the complete JSON object.
`.trim();


    const retrySettings = {

        ...(settings || {}),

        outfitSource

    };


    return [

        {

            role:
                "system",

            content:
                buildAnalysisSystemPrompt(
                    retrySettings
                )

        },

        {

            role:
                "user",

            content:
                models.buildVisionImageMessage(

                    `${buildAnalysisUserPrompt(
                        retrySettings
                    )}

${retryInstruction}`,

                    {

                        referenceImage:
                            file?.dataUrl ||

                            null,

                        characterImage:
                            characterFile?.dataUrl ||

                            null,

                        outfitSource

                    }

                )

        }

    ];

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


    /* =====================================================
       REPLACEMENT CHARACTER
    ===================================================== */

    const characterFile =
        getAnalysisCharacterFile(
            state
        );


    /* =====================================================
       OUTFIT SOURCE
    ===================================================== */

    const requestedOutfitSource =
        (
            typeof state.getOutfitSource ===
                "function"

                ? state.getOutfitSource()

                : (
                    options?.outfitSource ||

                    options?.settings?.outfitSource ||

                    "reference"
                )
        );


    const normalizedOutfitSource =
        normalizeAnalysisOutfitSource(
            requestedOutfitSource
        );


    /* =====================================================
       CHARACTER REQUIREMENT
    ===================================================== */

    if (
        normalizedOutfitSource ===
            "character" &&
        !characterFile?.dataUrl
    ) {

        throw core.createAPIError(

            "Replacement character diperlukan ketika Outfit Source menggunakan Replacement Character Outfit.",

            {

                code:
                    "REPLACEMENT_CHARACTER_REQUIRED",

                data: {

                    outfitSource:
                        normalizedOutfitSource,

                    hasReferenceImage:
                        Boolean(
                            file?.dataUrl
                        ),

                    hasReplacementCharacter:
                        false

                }

            }

        );

    }


    /* =====================================================
       REQUESTED MODEL
    ===================================================== */

    const requestedModel =
        options.model ||
        models.getSelectedModel();


    const model =
        await models.resolveVisionModel(
            requestedModel,
            options
        );


    /* =====================================================
       SETTINGS
    ===================================================== */

    const settings = {

        ...(
            options.settings ||
            state.get(
                "settings",
                {}
            ) ||
            {}
        ),

        outfitSource:
            normalizedOutfitSource

    };


    /* =====================================================
       IMAGE CONFIGURATION
    ===================================================== */

    const hasReferenceImage =
        Boolean(
            file?.dataUrl
        );


    const hasReplacementCharacter =
        Boolean(
            characterFile?.dataUrl
        );


    const imageCount =
        normalizedOutfitSource ===
            "character"

            ? 2

            : 1;


    /* =====================================================
       INITIAL MULTIMODAL MESSAGE
    ===================================================== */

    const initialMessages = [

        {

            role:
                "system",

            content:
                buildAnalysisSystemPrompt(
                    settings
                )

        },

        {

            role:
                "user",

            content:
                models.buildVisionImageMessage(

                    buildAnalysisUserPrompt(
                        settings
                    ),

                    {

                        referenceImage:
                            file.dataUrl,

                        characterImage:
                            normalizedOutfitSource ===
                                "character"

                                ? characterFile.dataUrl

                                : null,

                        outfitSource:
                            normalizedOutfitSource

                    }

                )

        }

    ];


    /* -----------------------------------------------------
       TOKEN BUDGET
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

            model:
                model.id,

            configuredMaxTokens,

            analysisMaxTokens,

            maxAttempts,

            outfitSource:
                normalizedOutfitSource,

            hasReferenceImage,

            hasReplacementCharacter,

            imageCount

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

        const messages =
            attempt === 1

                ? initialMessages

                : buildRetryMessages(

                    settings,

                    models,

                    file,

                    characterFile

                );


        console.info(
            "[GEN-Z.AI Vision] Starting visual-analysis attempt:",
            {

                attempt,

                maxAttempts,

                model:
                    model.id,

                outfitSource:
                    normalizedOutfitSource,

                imageCount

            }
        );


        console.info(
            "[GEN-Z.AI Vision] Sending visual-analysis request:",
            {

                attempt,

                model:
                    model.id,

                messageCount:
                    messages.length,

                hasReferenceImage,

                referenceMimeType:
                    file?.mimeType ||
                    file?.type ||
                    null,

                referenceDataLength:
                    String(
                        file?.dataUrl ||
                        ""
                    ).length,

                hasReplacementCharacter,

                replacementCharacterMimeType:
                    characterFile?.mimeType ||
                    characterFile?.type ||
                    null,

                replacementCharacterDataLength:
                    String(
                        characterFile?.dataUrl ||
                        ""
                    ).length,

                outfitSource:
                    normalizedOutfitSource,

                imageCount,

                configuredMaxTokens,

                analysisMaxTokens

            }
        );


        try {

            const response =
                await core.request(

                    buildAnalysisRequest(
                        model,
                        messages,
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

                    outfitSource:
                        normalizedOutfitSource,

                    imageCount,

                    error

                }
            );


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

            outfitSource:
                normalizedOutfitSource,

            imageCount,

            hasReferenceImage,

            hasReplacementCharacter,

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
                    lastResponse,

                outfitSource:
                    normalizedOutfitSource,

                hasReferenceImage,

                hasReplacementCharacter,

                imageCount

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
