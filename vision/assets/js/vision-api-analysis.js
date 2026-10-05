/* =========================================================
   GEN-Z.AI VISION
   ---------------------------------------------------------
   File:
   vision/assets/js/vision-api-analysis.js

   Fungsi:
   - Vision Analysis system prompt
   - Vision Analysis user prompt
   - Parse structured visual analysis
   - Quality validation
   - Analyze image
========================================================= */


/* =========================================================
   ANALYSIS STRUCTURE KEYS
========================================================= */

const VISION_ANALYSIS_KEYS =
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
   ANALYSIS SYSTEM PROMPT
========================================================= */

function buildAnalysisSystemPrompt() {

    return `
You are the visual analysis engine of GEN-Z.AI Vision.

Your task is to analyze the supplied reference image with
extremely high visual accuracy, specificity and completeness.

The attached image is the PRIMARY SOURCE OF TRUTH.

DO NOT generate a creative prompt yet.

Your ONLY task is to inspect the actual image and extract
CONCRETE, OBSERVABLE visual facts into structured JSON.

=========================================================
CRITICAL REQUIREMENT
=========================================================

THE IMAGE CONTAINS VISUAL INFORMATION.

You MUST inspect the attached image before producing JSON.

Do NOT return an empty analysis.

Do NOT return:

{
  "subject": {},
  "appearance": {},
  "face_hair": {},
  ...
}

Empty objects and empty arrays are NOT acceptable when the
corresponding visual information is visible in the image.

Every visible subject, object, color, texture, position,
relationship, clothing item, facial characteristic and
environmental element must be described concretely.

=========================================================
NO GENERIC PLACEHOLDERS
=========================================================

DO NOT use vague descriptions such as:

"person"

"clothing"

"beautiful face"

"some accessories"

"background"

"indoor environment"

"cinematic lighting"

"realistic image"

when the image allows a more specific description.

Instead describe what is actually visible.

For example:

BAD:
"subject": {
  "type": "person"
}

GOOD:
"subject": {
  "type": "woman",
  "apparent_age_range": "dewasa muda",
  "position": "berada di tengah frame",
  "orientation": "menghadap kamera"
}

BAD:
"clothing": {}

GOOD:
"clothing": {
  "head_cover": {
    "type": "hijab",
    "color": "merah muda",
    "texture": "ribbed"
  },
  "top": {
    "type": "long-sleeve top",
    "color": "..."
  }
}

=========================================================
MANDATORY VISUAL INSPECTION
=========================================================

Analyze all applicable categories:

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
11. apparent lens characteristics
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

=========================================================
PERSON ANALYSIS
=========================================================

If a person is visible, inspect every observable feature.

Analyze individually:

- apparent age range
- apparent gender presentation when visually relevant
- skin tone
- visible skin condition
- face shape
- eyes
- eye shape
- eye color
- eyebrows
- nose
- lips
- lip shape
- makeup
- eyelashes
- eyeliner
- facial expression
- gaze direction
- head angle
- hair
- hair color
- hair texture
- hairstyle
- hijab or head covering
- hijab color
- hijab material
- hijab texture
- scarf
- scarf pattern
- scarf colors
- visible neck or shoulders
- body orientation
- hand position
- arm position
- leg position
- posture

ONLY describe details that are actually visible.

Do not infer identity.

Do not identify the person.

=========================================================
CLOTHING ANALYSIS
=========================================================

Describe every visible clothing item individually.

For each item inspect:

- type
- color
- secondary colors
- material when visually observable
- texture
- pattern
- print
- motif
- folds
- seams
- shape
- fit
- position
- how it is worn

Do not collapse multiple visible garments into "pakaian".

=========================================================
ACCESSORIES
=========================================================

Describe each visible accessory individually.

Inspect:

- type
- shape
- color
- material when observable
- size
- position
- relationship to the subject

Do not invent accessories that are hidden.

=========================================================
PRODUCT ANALYSIS
=========================================================

If a product is visible, inspect:

- product category
- apparent model/type when visually identifiable
- shape
- dimensions/proportions
- color
- surface
- material
- texture
- buttons
- controls
- labels
- logo
- branding
- visible text
- orientation
- position
- relationship to hands or body

If no product is visible, use:

"product": {
  "present": false
}

Do NOT invent a product.

=========================================================
COMPOSITION
=========================================================

Describe:

- image orientation
- aspect ratio appearance
- framing
- shot type
- subject placement
- subject scale
- foreground
- middle ground
- background
- negative space
- symmetry/asymmetry
- camera-to-subject relationship
- visual hierarchy

Use concrete spatial descriptions.

=========================================================
CAMERA
=========================================================

Analyze only visually inferable characteristics.

Describe:

- camera perspective
- viewpoint height
- angle
- frontal/side/three-quarter view
- apparent focal perspective
- apparent lens character
- depth of field
- focus plane
- background separation
- distortion if visible

Do NOT invent an exact camera model.

Do NOT invent an exact focal length.

If an exact value cannot be determined, describe the
observable characteristic instead.

=========================================================
LIGHTING
=========================================================

Analyze:

- light direction
- primary light source when observable
- softness
- hardness
- highlights
- shadow direction
- shadow density
- fill light
- contrast
- color temperature
- reflections
- specular highlights

Do NOT simply write "cinematic lighting" when actual
lighting characteristics can be described.

=========================================================
BACKGROUND AND ENVIRONMENT
=========================================================

Describe the actual visible environment.

Inspect:

- walls
- floor
- ceiling when visible
- furniture
- architecture
- doors
- windows
- shelves
- plants
- objects
- surfaces
- textures
- materials
- colors
- patterns
- spatial depth

If a wall is visible, describe its actual appearance.

For example:

- brick
- painted wall
- concrete
- wood
- tile
- patterned surface

Do not invent an environment that is not visible.

=========================================================
COLOR
=========================================================

Extract dominant and secondary visible colors.

Describe:

- dominant colors
- secondary colors
- accent colors
- approximate hue
- relative prominence
- color relationships

Do not use meaningless color names when a more precise
description is visually possible.

=========================================================
VISUAL STYLE
=========================================================

Describe observable visual characteristics such as:

- photographic appearance
- studio appearance
- editorial appearance
- naturalistic appearance
- realism
- sharpness
- contrast
- saturation
- tonal range
- color treatment
- background separation
- texture rendering
- image aesthetic

Do not invent a named photography style unless supported
by the image.

=========================================================
TEXT AND BRANDING
=========================================================

Inspect all visible text.

If text is readable:

- transcribe it accurately
- identify its location
- describe typography appearance when observable
- identify visible branding

If text is not readable but text-like elements are visible,
describe them as unreadable text rather than inventing words.

If no text is visible:

"text_branding": {
  "present": false
}

=========================================================
SPATIAL RELATIONSHIPS
=========================================================

Explicitly describe relationships such as:

- subject in front of background
- object held by subject
- product positioned beside subject
- hand touching object
- object on table
- subject centered relative to frame
- scarf crossing shoulder
- shadow falling behind subject

These relationships are extremely important for image
reconstruction.

=========================================================
IMPORTANT DETAILS
=========================================================

Record small but visually important details.

Examples:

- distinctive pattern
- unusual texture
- specific accessory
- visible stitching
- product detail
- hand placement
- shadow shape
- background object
- color accent
- fabric fold
- visible reflection

=========================================================
UNCERTAINTY
=========================================================

Separate uncertain observations from concrete observations.

If something cannot be determined:

- use "unknown"
- use null
- or record the uncertainty explicitly

Do NOT turn an uncertain observation into a definite fact.

=========================================================
ANTI-INVENTION
=========================================================

NEVER invent:

- identity
- exact age
- exact location
- hidden clothing
- hidden accessories
- unseen product details
- unreadable text
- exact camera model
- exact focal length
- unseen environment
- unseen objects

Only describe what is visible or visually inferable.

=========================================================
OUTPUT REQUIREMENT
=========================================================

Return VALID JSON ONLY.

No markdown.

No code fence.

No explanation.

No prose before JSON.

No prose after JSON.

The JSON MUST contain concrete populated values.

Do NOT leave applicable categories as empty objects.

Do NOT leave applicable categories as empty arrays.

If a category genuinely does not apply, explicitly state
that it is not present rather than silently returning an
empty structure.

For example:

"accessories": {
  "present": false,
  "items": []
}

or:

"product": {
  "present": false
}

=========================================================
REQUIRED JSON STRUCTURE
=========================================================

{
  "subject": {
    "type": "...",
    "position": "...",
    "orientation": "...",
    "apparent_age_range": "..."
  },

  "appearance": {
    "skin": "...",
    "overall_appearance": "..."
  },

  "face_hair": {
    "face": "...",
    "eyes": "...",
    "eyebrows": "...",
    "nose": "...",
    "lips": "...",
    "makeup": "...",
    "hair_or_head_covering": "..."
  },

  "pose": {
    "body_position": "...",
    "head_position": "...",
    "arms": "...",
    "hands": "...",
    "gaze": "...",
    "expression": "..."
  },

  "clothing": {
    "items": [
      {
        "type": "...",
        "color": "...",
        "material": "...",
        "texture": "...",
        "pattern": "...",
        "position": "..."
      }
    ]
  },

  "accessories": {
    "present": true,
    "items": []
  },

  "product": {
    "present": false
  },

  "composition": {
    "framing": "...",
    "subject_placement": "...",
    "foreground": "...",
    "middle_ground": "...",
    "background": "...",
    "negative_space": "..."
  },

  "camera": {
    "perspective": "...",
    "viewpoint": "...",
    "apparent_lens_character": "...",
    "depth_of_field": "...",
    "focus": "..."
  },

  "lighting": {
    "direction": "...",
    "quality": "...",
    "highlights": "...",
    "contrast": "..."
  },

  "shadows": {
    "direction": "...",
    "density": "...",
    "shape": "..."
  },

  "environment": {
    "setting": "...",
    "surfaces": "...",
    "objects": "..."
  },

  "background": {
    "description": "...",
    "color": "...",
    "texture": "...",
    "spatial_position": "..."
  },

  "color_palette": [
    "..."
  ],

  "visual_style": {
    "appearance": "...",
    "realism": "...",
    "color_treatment": "...",
    "sharpness": "..."
  },

  "text_branding": {
    "present": false
  },

  "image_quality": {
    "resolution_character": "...",
    "sharpness": "...",
    "noise": "...",
    "compression": "..."
  },

  "important_details": [
    "..."
  ],

  "spatial_relationships": [
    "..."
  ],

  "uncertainties": [
    "..."
  ]
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
Analyze the attached reference image now.

IMPORTANT:
The image is attached to this request.

You MUST visually inspect the image itself.

Do not answer from the text instructions alone.

Do not return an empty schema.

Populate the JSON with concrete observations from the
actual image.

Analysis detail level:
${detail}

Intended purpose:
${purpose}

Additional user instruction:
${instruction || "None"}

=========================================================
REQUIRED PROCESS
=========================================================

1. Inspect the entire image.
2. Identify every major visible subject.
3. Inspect the face and hair/head covering if present.
4. Inspect clothing item by item.
5. Inspect accessories individually.
6. Inspect products individually.
7. Inspect composition and framing.
8. Inspect camera perspective.
9. Inspect lighting and shadows.
10. Inspect environment and background.
11. Inspect colors and textures.
12. Inspect text and branding.
13. Inspect small important visual details.
14. Record spatial relationships.
15. Record uncertainty separately.

Do not summarize aggressively.

Do not replace concrete observations with category names.

Do not invent hidden information.

=========================================================
MINIMUM DETAIL STANDARD
=========================================================

For every visible person, provide multiple concrete facts.

For every visible clothing item, provide color and visible
texture/pattern whenever available.

For every visible background element, provide its actual
appearance and spatial position.

For every visible product, provide its actual visible
characteristics.

For composition, provide concrete framing and placement.

For lighting, provide observable direction and quality.

For camera, provide visually inferable perspective.

The result must contain real visual facts, not an empty
template.

=========================================================
OUTPUT
=========================================================

Return VALID JSON ONLY.

Do not use markdown code fences.

Do not explain the analysis.

Do not write anything outside the JSON.

The JSON must be populated from the attached image.
`.trim();

}


/* =========================================================
   EXTRACT JSON FROM MODEL TEXT
========================================================= */

function extractAnalysisJSON(
    text
) {

    const source =
        String(
            text ||
            ""
        )
            .trim();


    if (
        !source
    ) {

        return null;

    }


    /*
     * -----------------------------------------------------
     * DIRECT JSON
     * -----------------------------------------------------
     */

    try {

        return JSON.parse(
            source
        );

    }
    catch {
        /*
         * Continue.
         */

    }


    /*
     * -----------------------------------------------------
     * REMOVE MARKDOWN FENCE
     * -----------------------------------------------------
     */

    let cleaned =
        source
            .replace(
                /^```(?:json)?\s*/i,
                ""
            )
            .replace(
                /\s*```\s*$/i,
                ""
            )
            .trim();


    try {

        return JSON.parse(
            cleaned
        );

    }
    catch {
        /*
         * Continue.
         */

    }


    /*
     * -----------------------------------------------------
     * EXTRACT OBJECT
     * -----------------------------------------------------
     */

    const objectStart =
        cleaned.indexOf(
            "{"
        );


    const objectEnd =
        cleaned.lastIndexOf(
            "}"
        );


    if (
        objectStart !== -1 &&
        objectEnd > objectStart
    ) {

        const candidate =
            cleaned.slice(
                objectStart,
                objectEnd + 1
            )
                .trim();


        try {

            return JSON.parse(
                candidate
            );

        }
        catch {
            /*
             * Invalid JSON.
             */

        }

    }


    return null;

}


/* =========================================================
   ANALYSIS VALUE INSPECTION
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


        return Boolean(
            normalized &&
            normalized !== "unknown" &&
            normalized !== "null" &&
            normalized !== "n/a" &&
            normalized !== "none" &&
            normalized !== "tidak diketahui" &&
            normalized !== "tidak ada" &&
            normalized !== "tidak terlihat" &&
            normalized !== "tidak dapat ditentukan"
        );

    }


    if (
        typeof value === "number" ||
        typeof value === "boolean"
    ) {

        return true;

    }


    if (
        Array.isArray(value)
    ) {

        return value.some(
            hasConcreteAnalysisValue
        );

    }


    if (
        typeof value === "object"
    ) {

        return Object.values(
            value
        )
            .some(
                hasConcreteAnalysisValue
            );

    }


    return false;

}


/* =========================================================
   COUNT CONCRETE ANALYSIS FACTS
========================================================= */

function countAnalysisFacts(
    analysis
) {

    let count = 0;


    function walk(
        value
    ) {

        if (
            value === null ||
            value === undefined
        ) {

            return;

        }


        if (
            typeof value === "string"
        ) {

            if (
                hasConcreteAnalysisValue(
                    value
                )
            ) {

                count++;

            }


            return;

        }


        if (
            typeof value === "number" ||
            typeof value === "boolean"
        ) {

            count++;

            return;

        }


        if (
            Array.isArray(value)
        ) {

            value.forEach(
                walk
            );

            return;

        }


        if (
            typeof value === "object"
        ) {

            Object.values(
                value
            )
                .forEach(
                    walk
                );

        }

    }


    walk(
        analysis
    );


    return count;

}


/* =========================================================
   ANALYSIS QUALITY
========================================================= */

function validateAnalysisQuality(
    text
) {

    const normalized =
        String(
            text ||
            ""
        )
            .trim();


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
                0

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
                0

        };

    }


    if (
        normalized.length <
        window.GENZVisionCore.CONFIG
            .minAnalysisCharacters
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
                0

        };

    }


    /*
     * -----------------------------------------------------
     * PARSE STRUCTURED ANALYSIS
     * -----------------------------------------------------
     */

    const parsed =
        extractAnalysisJSON(
            normalized
        );


    if (
        !parsed ||
        typeof parsed !== "object" ||
        Array.isArray(parsed)
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
                0

        };

    }


    /*
     * -----------------------------------------------------
     * COUNT REAL VISUAL FACTS
     * -----------------------------------------------------
     */

    const factCount =
        countAnalysisFacts(
            parsed
        );


    console.info(
        "[GEN-Z.AI Vision] Visual-analysis concrete fact count:",
        factCount
    );


    /*
     * -----------------------------------------------------
     * EMPTY ANALYSIS DETECTION
     * -----------------------------------------------------
     */

    if (
        factCount === 0
    ) {

        return {

            valid:
                false,

            reason:
                "Vision model mengembalikan struktur analysis tetapi tidak mengisi fakta visual konkret.",

            code:
                "ANALYSIS_EMPTY_FACTS",

            length:
                normalized.length,

            factCount:
                0,

            parsed

        };

    }


    /*
     * Untuk visual analysis yang sangat pendek, jumlah
     * fakta harus tetap masuk akal.
     */

    if (
        factCount < 5
    ) {

        return {

            valid:
                false,

            reason:
                "Visual analysis hanya mengandung sedikit fakta visual dan belum cukup lengkap.",

            code:
                "ANALYSIS_INSUFFICIENT_FACTS",

            length:
                normalized.length,

            factCount,

            parsed

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

        parsed

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


    console.info(
        "[GEN-Z.AI Vision] Sending visual-analysis request:",
        {

            model:
                model.id,

            messageCount:
                messages.length,

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
                ).length

        }
    );


    const response =
        await core.request(

            {

                model:
                    model.id,

                messages,

                temperature:
                    core.CONFIG
                        .analysisTemperature,

                max_tokens:
                    core.CONFIG
                        .maxAnalysisTokens,

                stream:
                    false

            },

            {

                timeout:
                    options.timeout ||
                    core.CONFIG.timeout

            }

        );


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


    if (
        !text
    ) {

        throw core.createAPIError(

            "Vision model tidak mengembalikan hasil analisis.",

            {

                code:
                    "EMPTY_ANALYSIS_RESPONSE",

                data:
                    response

            }

        );

    }


    console.info(
        "[GEN-Z.AI Vision] Visual-analysis raw text:",
        text
    );


    const quality =
        validateAnalysisQuality(
            text
        );


    console.info(
        "[GEN-Z.AI Vision] Visual-analysis quality:",
        {

            ...quality,

            parsed:
                undefined

        }
    );


    if (
        !quality.valid
    ) {

        throw core.createAPIError(

            quality.reason ||
            "Visual analysis belum cukup untuk membuat prompt.",

            {

                code:
                    quality.code ||
                    "INVALID_ANALYSIS",

                data: {

                    analysis:
                        text,

                    quality

                }

            }

        );

    }


    /*
     * -----------------------------------------------------
     * RETURN STRUCTURED ANALYSIS
     * -----------------------------------------------------
     *
     * Sebelumnya pipeline mengembalikan raw text.
     * Sekarang hasil JSON yang sudah divalidasi dikembalikan
     * sebagai object agar Prompt Engineering menerima data
     * yang benar-benar terstruktur.
     * -----------------------------------------------------
     */

    const parsedAnalysis =
        quality.parsed ||
        extractAnalysisJSON(
            text
        );


    return {

        text,

        analysis:
            parsedAnalysis,

        raw:
            response,

        model

    };

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

        validateAnalysisQuality,

        analyzeImage

    });


/* =========================================================
   MERGE GLOBAL NAMESPACE
========================================================= */

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
