/* =========================================================
   GEN-Z.AI VISION
   ---------------------------------------------------------
   File:
   vision/assets/js/vision-api-analysis.js

   Fungsi:
   - Vision Analysis system prompt
   - Vision Analysis user prompt
   - Quality validation
   - Analyze image
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
- Describe visible details specifically.
- Extract concrete colors, shapes, textures, patterns,
  positions and relationships.
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
- Do not claim a real person's identity.
- Separate visible facts from uncertainty.
- Never respond that the image has no visual details when
  an image is attached.

Return valid JSON only.

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

Inspect the image carefully.

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

Return structured visual analysis based strictly on the
actual visible image.

Do not respond that visual details are unavailable when
the image is attached.
`.trim();

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
                normalized.length

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
                normalized.length

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
            normalized.length

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
                null

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


    const quality =
        validateAnalysisQuality(
            text
        );


    console.info(
        "[GEN-Z.AI Vision] Visual-analysis quality:",
        quality
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


    return {

        text,

        raw:
            response,

        model

    };

}


/* =========================================================
   GLOBAL MODULE
========================================================= */

window.GENZVisionAnalysis =
    Object.freeze({

        buildAnalysisSystemPrompt,

        buildAnalysisUserPrompt,

        validateAnalysisQuality,

        analyzeImage

    });
