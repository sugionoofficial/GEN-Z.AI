/* =========================================================
   GEN-Z.AI VISION
   ---------------------------------------------------------
   File:
   vision/assets/js/vision-api-analysis.js

   Fungsi:
   - Vision Analysis system prompt
   - Vision Analysis user prompt
   - Reference / Character outfit source
   - Reference scene authority
   - Character identity authority
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
     * State getter menjadi sumber utama
     * apabila tersedia.
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
     * Compatibility fallback:
     * state.get("outfitSource")
     */

    if (
        state &&
        typeof state.get ===
            "function"
    ) {

        try {

            return normalizeAnalysisOutfitSource(
                state.get(
                    "outfitSource",
                    settings?.outfitSource ||
                    "reference"
                )
            );

        }
        catch {

            /* Continue */

        }

    }


    /*
     * Snapshot state:
     * state.outfitSource
     */

    if (
        state &&
        state.outfitSource
    ) {

        return normalizeAnalysisOutfitSource(
            state.outfitSource
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
   GET REFERENCE FILE
========================================================= */

function getAnalysisReferenceFile(
    state
) {

    if (
        state &&
        typeof state.getReferenceImage ===
            "function"
    ) {

        return state.getReferenceImage();

    }


    if (
        state &&
        typeof state.getFile ===
            "function"
    ) {

        return state.getFile();

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

        try {

            const file =
                state.get(
                    "file",
                    null
                );


            if (
                file
            ) {

                return file;

            }

        }
        catch {

            /* Continue */

        }

    }


    /*
     * Snapshot state.
     */

    if (
        state &&
        state.file
    ) {

        return state.file;

    }


    if (
        state &&
        state.referenceImage
    ) {

        return state.referenceImage;

    }


    return null;

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

        try {

            return state.get(
                "replacementCharacter",
                null
            );

        }
        catch {

            /* Continue */

        }

    }


    /*
     * Snapshot state.
     */

    if (
        state &&
        state.replacementCharacter
    ) {

        return state.replacementCharacter;

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
VISUAL SOURCE HIERARCHY
OUTFIT SOURCE: REPLACEMENT CHARACTER
=========================================================

TWO IMAGE ROLES ARE STRICTLY SEPARATE.

IMAGE 1 = REFERENCE IMAGE
IMAGE 2 = REPLACEMENT CHARACTER

IMAGE 1 is the authoritative source for the SCENE.

IMAGE 2 is the authoritative source only for the
CHARACTER IDENTITY and FINAL OUTFIT.

---------------------------------------------------------
IMAGE 1 — REFERENCE SCENE AUTHORITY
---------------------------------------------------------

Use IMAGE 1 as the authoritative source for:

- overall scene
- composition
- pose
- body positioning
- hand positioning
- subject placement
- framing
- crop
- camera perspective
- apparent lens characteristics
- depth of field
- focus placement
- background
- environment
- architecture
- surfaces
- objects
- product placement
- spatial relationships
- lighting
- light direction
- light softness
- shadows
- contrast
- color palette
- visual atmosphere
- scene-specific styling

The visual structure of the final prompt MUST remain
based on IMAGE 1.

---------------------------------------------------------
IMAGE 2 — CHARACTER AUTHORITY
---------------------------------------------------------

Use IMAGE 2 as the authoritative source for:

- character identity
- facial structure
- eyes
- eyebrows
- nose
- lips
- skin appearance
- hair
- head covering
- visible physical characteristics
- final clothing
- final outfit
- outfit-specific accessories

IMAGE 2 MUST NOT replace the scene of IMAGE 1.

Do NOT import from IMAGE 2:

- its background
- its environment
- its composition
- its framing
- its camera angle
- its lighting
- its shadows
- its scene
- its spatial arrangement
- its pose unless explicitly needed as character identity
  information

---------------------------------------------------------
OUTFIT RULE
---------------------------------------------------------

Because REPLACEMENT CHARACTER is selected:

The final clothing must come from IMAGE 2.

Do NOT merge clothing from IMAGE 1.

If a clothing detail is visible only in IMAGE 1,
do NOT report it as the final clothing.

The final outfit must be derived from IMAGE 2.

---------------------------------------------------------
FINAL TRANSFORMATION LOGIC
---------------------------------------------------------

Think of the operation as:

IMAGE 1 SCENE
+
IMAGE 2 CHARACTER
=
FINAL VISUAL DESCRIPTION

Preserve the scene of IMAGE 1.

Replace the person in IMAGE 1 with the character identity
from IMAGE 2.

Use the clothing from IMAGE 2.

Do NOT create a new scene based on IMAGE 2.

Do NOT blend the two scenes.

=========================================================
`.trim();

    }


    return `
=========================================================
VISUAL SOURCE HIERARCHY
OUTFIT SOURCE: REFERENCE IMAGE
=========================================================

TWO IMAGE ROLES ARE STRICTLY SEPARATE.

IMAGE 1 = REFERENCE IMAGE
IMAGE 2 = REPLACEMENT CHARACTER

IMAGE 1 is the authoritative source for the SCENE
AND FINAL OUTFIT.

IMAGE 2 is the authoritative source only for the
CHARACTER IDENTITY.

---------------------------------------------------------
IMAGE 1 — PRIMARY VISUAL AUTHORITY
---------------------------------------------------------

IMAGE 1 MUST CONTROL THE FINAL VISUAL DESCRIPTION.

Use IMAGE 1 as the authoritative source for:

- overall scene
- composition
- pose
- body positioning
- hand positioning
- subject placement
- framing
- crop
- camera perspective
- apparent lens characteristics
- depth of field
- focus placement
- clothing
- outfit design
- garment type
- garment colors
- garment materials
- garment patterns
- garment textures
- garment construction
- clothing accessories
- outfit-specific details
- background
- environment
- architecture
- surfaces
- objects
- product placement
- spatial relationships
- lighting
- light direction
- light softness
- shadows
- contrast
- color palette
- visual atmosphere
- scene-specific styling

The final prompt MUST follow the visual scene of IMAGE 1.

---------------------------------------------------------
IMAGE 2 — CHARACTER IDENTITY ONLY
---------------------------------------------------------

If IMAGE 2 is attached, use it ONLY to identify
the replacement character.

Use IMAGE 2 for:

- character identity
- facial structure
- eyes
- eyebrows
- nose
- lips
- skin appearance
- hair
- head covering
- visible physical characteristics

IMAGE 2 MUST NOT contribute scene information.

Do NOT import from IMAGE 2:

- clothing
- outfit
- background
- environment
- composition
- pose
- framing
- camera angle
- lighting
- shadows
- color palette
- spatial arrangement

---------------------------------------------------------
OUTFIT RULE
---------------------------------------------------------

Because REFERENCE IMAGE is selected:

The final clothing MUST come from IMAGE 1.

Do NOT merge clothing from IMAGE 2.

If a clothing detail is visible only in IMAGE 2,
do NOT report it as the final clothing.

The final outfit must be derived from IMAGE 1.

---------------------------------------------------------
FINAL TRANSFORMATION LOGIC
---------------------------------------------------------

Think of the operation as:

IMAGE 1 SCENE + OUTFIT
+
IMAGE 2 CHARACTER IDENTITY
=
FINAL VISUAL DESCRIPTION

Preserve IMAGE 1 as the visual foundation.

Replace only the character identity with the identity
from IMAGE 2.

Do NOT replace the scene.

Do NOT replace the composition.

Do NOT replace the outfit.

Do NOT create a new scene based on IMAGE 2.

Do NOT blend the two scenes.

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

=========================================================
CRITICAL IMAGE PRIORITY
=========================================================

When TWO images are supplied, they have DIFFERENT ROLES.

IMAGE 1 is ALWAYS the REFERENCE IMAGE.

IMAGE 2 is ALWAYS the REPLACEMENT CHARACTER.

Never treat the two images as equal visual references.

The selected source hierarchy MUST be preserved in
every category of the analysis.

When OUTFIT SOURCE = REFERENCE:

IMAGE 1 controls:
- scene
- pose
- composition
- framing
- camera
- lighting
- background
- environment
- clothing
- product
- spatial relationships
- visual style

IMAGE 2 controls ONLY:
- character identity
- face
- hair
- head covering
- visible physical characteristics

When OUTFIT SOURCE = CHARACTER:

IMAGE 1 controls:
- scene
- pose
- composition
- framing
- camera
- lighting
- background
- environment
- product
- spatial relationships
- scene visual style

IMAGE 2 controls:
- character identity
- face
- hair
- head covering
- visible physical characteristics
- clothing
- final outfit

NEVER let IMAGE 2 replace the scene of IMAGE 1.

NEVER let IMAGE 1 provide clothing when
OUTFIT SOURCE = CHARACTER.

NEVER let IMAGE 2 provide clothing when
OUTFIT SOURCE = REFERENCE.

=========================================================
SCENE PRESERVATION RULE
=========================================================

The final analysis must describe IMAGE 1 as the
visual foundation whenever IMAGE 1 is present.

Do NOT describe IMAGE 2 as though it were the main scene.

Do NOT transfer IMAGE 2's:

- background
- room
- environment
- composition
- camera
- lighting
- framing
- pose

into the reference scene.

IMAGE 2 exists to identify the replacement character,
not to redefine the reference scene.

=========================================================
=========================================================

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

=========================================================
CATEGORY SOURCE CONTROL
=========================================================

The "subject" category:

- Use IMAGE 1 to establish the subject's role and placement
  in the reference scene.
- Use IMAGE 2 only to describe replacement identity when
  a character image exists.

The "appearance" category:

- Character physical appearance may come from IMAGE 2.
- Scene-related appearance must remain based on IMAGE 1.

The "face_hair" category:

- When IMAGE 2 exists, use IMAGE 2 as the primary source
  for replacement character facial and hair characteristics.
- Do NOT allow IMAGE 2 to introduce a different scene.

The "pose" category:

- ALWAYS prioritize IMAGE 1.
- Do NOT replace the reference pose with the pose of IMAGE 2.

The "clothing" category:

When OUTFIT SOURCE = REFERENCE:
- clothing MUST come from IMAGE 1.
- IMAGE 2 MUST NOT contribute clothing.

When OUTFIT SOURCE = CHARACTER:
- clothing MUST come from IMAGE 2.
- IMAGE 1 MUST NOT contribute clothing.

The "accessories" category:

- Scene accessories and product-related accessories follow
  IMAGE 1.
- Outfit-specific accessories follow the selected outfit source.

The "product" category:

- ALWAYS prioritize IMAGE 1.
- Never invent a product from IMAGE 2.

The "composition" category:

- ALWAYS comes from IMAGE 1.

The "camera" category:

- ALWAYS comes from IMAGE 1.

The "lighting" category:

- ALWAYS comes from IMAGE 1.

The "shadows" category:

- ALWAYS comes from IMAGE 1.

The "environment" category:

- ALWAYS comes from IMAGE 1.

The "background" category:

- ALWAYS comes from IMAGE 1.

The "color_palette" category:

- Prioritize the overall scene palette of IMAGE 1.
- Clothing colors follow the selected outfit source.

The "visual_style" category:

- ALWAYS prioritize the visual style of IMAGE 1.

The "text_branding" category:

- Prioritize visible text and branding from IMAGE 1.
- Do not import branding from IMAGE 2.

The "spatial_relationships" category:

- ALWAYS comes from IMAGE 1.

=========================================================
FINAL ANALYSIS PRINCIPLE
=========================================================

When two images are supplied, do NOT write an analysis that
simply describes both images independently.

Instead, determine:

1. What belongs to the REFERENCE SCENE.
2. What belongs to the REPLACEMENT CHARACTER.
3. What belongs to the selected OUTFIT SOURCE.

The final structured analysis must preserve this hierarchy.

The reference image is the scene authority.

The character image is the identity authority.

Only the selected outfit source controls clothing.

=========================================================
JSON REQUIREMENTS
=========================================================

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

IMAGE 1 = REFERENCE SCENE.
IMAGE 2 = REPLACEMENT CHARACTER.

IMAGE 1 controls the scene:
- composition
- pose
- framing
- camera
- lighting
- background
- environment
- spatial relationships
- product

IMAGE 2 controls:
- character identity
- face
- hair
- visible physical characteristics
- final clothing
- final outfit

IMPORTANT:
Do NOT use IMAGE 2 as the scene reference.
Do NOT transfer IMAGE 2's background, composition,
camera, lighting, or environment.

Do NOT use clothing from IMAGE 1.
`
            
            : `
OUTFIT SOURCE SELECTED:
Reference Image Outfit.

IMAGE 1 = PRIMARY VISUAL REFERENCE.

IMAGE 1 controls:
- scene
- composition
- pose
- framing
- camera
- lighting
- background
- environment
- product
- spatial relationships
- clothing
- final outfit

IMAGE 2 = REPLACEMENT CHARACTER.

IMAGE 2 controls ONLY:
- character identity
- face
- hair
- visible physical characteristics

IMPORTANT:
Do NOT use IMAGE 2 as the scene reference.
Do NOT transfer IMAGE 2's background, composition,
camera, lighting, environment, pose, or clothing.

The final scene MUST follow IMAGE 1.
`;


    return `
Analyze the supplied image source(s) for GEN-Z.AI Vision.

=========================================================
IMAGE ROLE ASSIGNMENT
=========================================================

IMAGE 1 = REFERENCE IMAGE
IMAGE 2 = REPLACEMENT CHARACTER

IMAGE 1 is the PRIMARY VISUAL REFERENCE.

If IMAGE 2 exists, it is NOT a second scene reference.
It is only the replacement character source.

${outfitInstructions}

=========================================================
REFERENCE IMAGE PRIORITY
=========================================================

The analysis MUST preserve IMAGE 1 as the foundation
of the final visual result.

Follow IMAGE 1 for:

- composition
- pose
- body positioning
- subject placement
- framing
- crop
- camera perspective
- lens character
- focus
- depth of field
- lighting
- shadows
- environment
- background
- product
- spatial relationships
- overall scene
- overall visual style

Do NOT let IMAGE 2 redefine these elements.

=========================================================
CHARACTER IMAGE PRIORITY
=========================================================

When IMAGE 2 exists, use it only for:

- face
- facial structure
- eyes
- eyebrows
- nose
- lips
- skin appearance
- hair
- head covering
- visible physical characteristics

The character must be inserted into the scene of IMAGE 1.

Do NOT rebuild the scene around IMAGE 2.

=========================================================
OUTFIT SOURCE
=========================================================

${outfitSource === "character"
    ? `
OUTFIT SOURCE = IMAGE 2.

Use IMAGE 2 for:
- clothing
- garment type
- colors
- materials
- patterns
- textures
- construction
- outfit-specific accessories

Do NOT import clothing from IMAGE 1.
`
    : `
OUTFIT SOURCE = IMAGE 1.

Use IMAGE 1 for:
- clothing
- garment type
- colors
- materials
- patterns
- textures
- construction
- outfit-specific accessories

Do NOT import clothing from IMAGE 2.
`
}

=========================================================
ANALYSIS DETAIL
=========================================================

Analysis detail level:
${detail}

Intended purpose:
${purpose}

Additional user instruction:
${instruction || "None"}

=========================================================
PERSON ANALYSIS
=========================================================

For the reference scene, inspect:

- subject placement
- body position
- pose
- hands
- head angle
- gaze
- expression
- interaction with objects
- interaction with environment

For the replacement character, when IMAGE 2 exists,
inspect:

- facial structure
- eyes
- eyebrows
- nose
- lips
- skin appearance
- hair
- head covering
- visible physical characteristics

=========================================================
PRODUCT ANALYSIS
=========================================================

For products visible in IMAGE 1, inspect:

- type
- shape
- material
- color
- surface
- branding
- labels
- placement
- orientation
- relationship to subject

Never create a product from IMAGE 2.

=========================================================
COMPOSITION ANALYSIS
=========================================================

Use IMAGE 1 as the ONLY composition reference.

Inspect:

- framing
- crop
- subject placement
- orientation
- camera perspective
- apparent lens character
- focus
- depth of field
- foreground
- middle ground
- background
- spatial relationships

=========================================================
LIGHTING ANALYSIS
=========================================================

Use IMAGE 1 as the ONLY lighting reference.

Inspect:

- light direction
- softness
- highlights
- shadows
- contrast
- ambient illumination
- color temperature when observable

Do NOT transfer lighting from IMAGE 2.

=========================================================
ENVIRONMENT AND BACKGROUND
=========================================================

Use IMAGE 1 as the ONLY environment and background source.

Inspect:

- architecture
- walls
- surfaces
- textures
- objects
- colors
- depth
- spatial relationships
- environmental details

Do NOT import environment details from IMAGE 2.

=========================================================
VISUAL STYLE
=========================================================

Use IMAGE 1 as the primary visual-style source.

Inspect:

- photographic or cinematic characteristics
- realism
- sharpness
- background separation
- color treatment
- contrast
- aesthetic
- image quality

=========================================================
STRICT SOURCE SEPARATION
=========================================================

Never merge visual facts from both images without
determining their source role.

The final analysis must conceptually represent:

REFERENCE IMAGE
=
scene authority

CHARACTER IMAGE
=
identity authority

SELECTED OUTFIT SOURCE
=
clothing authority

If a detail conflicts between the images,
follow the authority defined above.

Do not invent information.

Every visibly applicable category should contain
specific observations.

Do NOT return an empty JSON schema.

=========================================================
OUTPUT
=========================================================

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

IMAGE 1 = REFERENCE IMAGE
IMAGE 2 = REPLACEMENT CHARACTER when provided

CRITICAL:

IMAGE 1 is the scene authority.

IMAGE 2 is the character identity authority.

Only the selected outfit source controls clothing.

OUTFIT SOURCE =
${outfitSource === "character"
    ? "REPLACEMENT CHARACTER"
    : "REFERENCE IMAGE"}

When OUTFIT SOURCE = REFERENCE IMAGE:

- clothing comes from IMAGE 1
- scene comes from IMAGE 1
- pose comes from IMAGE 1
- composition comes from IMAGE 1
- camera comes from IMAGE 1
- lighting comes from IMAGE 1
- background comes from IMAGE 1
- environment comes from IMAGE 1
- IMAGE 2 provides identity only

When OUTFIT SOURCE = REPLACEMENT CHARACTER:

- scene comes from IMAGE 1
- pose comes from IMAGE 1
- composition comes from IMAGE 1
- camera comes from IMAGE 1
- lighting comes from IMAGE 1
- background comes from IMAGE 1
- environment comes from IMAGE 1
- clothing comes from IMAGE 2
- identity comes from IMAGE 2

NEVER use IMAGE 2 as the scene reference.

NEVER import IMAGE 2 background.

NEVER import IMAGE 2 composition.

NEVER import IMAGE 2 camera.

NEVER import IMAGE 2 lighting.

NEVER import IMAGE 2 environment.

NEVER mix clothing between the selected outfit source
and the non-selected image.

Prioritize:

1. Complete valid JSON.
2. Concrete visual observations.
3. All applicable analysis categories.
4. Correct source separation.
5. Correct reference-scene preservation.
6. Properly closed objects and arrays.
7. Complete strings.

NEVER stop in the middle of a property name.

NEVER stop in the middle of a string.

NEVER stop before the final closing braces.

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


    /*
     * IMPORTANT:
     * getState() dapat mengembalikan snapshot object.
     * Jangan menganggap selalu memiliki state.get().
     */

    const file =
        getAnalysisReferenceFile(
            state
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
        getAnalysisOutfitSource(
            state,
            {

                ...(options.settings || {}),

                outfitSource:
                    options?.outfitSource ||
                    options?.settings?.outfitSource ||
                    undefined

            }
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

    let stateSettings = {};


    if (
        state &&
        typeof state.get ===
            "function"
    ) {

        try {

            stateSettings =
                state.get(
                    "settings",
                    {}
                ) || {};

        }
        catch {

            stateSettings =
                {};

        }

    }
    else if (
        state &&
        state.settings &&
        typeof state.settings ===
            "object"
    ) {

        stateSettings =
            state.settings;

    }


    const settings = {

        ...stateSettings,

        ...(options.settings || {}),

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


    /*
     * imageCount describes actual visual sources
     * being sent, not the selected outfit mode.
     */

    const imageCount =
        hasReplacementCharacter
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
                            hasReplacementCharacter
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

            referenceAuthority:
                "IMAGE 1",

            characterAuthority:
                hasReplacementCharacter
                    ? "IMAGE 2"
                    : "NONE",

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

                referenceAuthority:
                    "IMAGE 1",

                characterAuthority:
                    hasReplacementCharacter
                        ? "IMAGE 2"
                        : "NONE",

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

                referenceAuthority:
                    "IMAGE 1",

                characterAuthority:
                    hasReplacementCharacter
                        ? "IMAGE 2"
                        : "NONE",

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

            referenceAuthority:
                "IMAGE 1",

            characterAuthority:
                hasReplacementCharacter
                    ? "IMAGE 2"
                    : "NONE",

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

                referenceAuthority:
                    "IMAGE 1",

                characterAuthority:
                    hasReplacementCharacter
                        ? "IMAGE 2"
                        : "NONE",

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

        normalizeAnalysisOutfitSource,

        getAnalysisOutfitSource,

        getAnalysisReferenceFile,

        getAnalysisCharacterFile,

        buildAnalysisOutfitRules,

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
