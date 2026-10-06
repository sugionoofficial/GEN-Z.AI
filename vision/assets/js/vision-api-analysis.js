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
   - FIELD-LEVEL SOURCE AUTHORITY
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

    if (
        state &&
        typeof state.getOutfitSource ===
            "function"
    ) {

        return normalizeAnalysisOutfitSource(
            state.getOutfitSource()
        );

    }


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


    if (
        state &&
        state.outfitSource
    ) {

        return normalizeAnalysisOutfitSource(
            state.outfitSource
        );

    }


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

IMAGE 1 is authoritative for the REFERENCE SCENE.

IMAGE 2 is authoritative for REPLACEMENT CHARACTER
IDENTITY and FINAL OUTFIT.

=========================================================
FIELD-LEVEL SOURCE AUTHORITY
=========================================================

THIS IS A FIELD-LEVEL RULE.

DO NOT decide source authority globally.

Each visual field has its own authoritative image.

---------------------------------------------------------
IMAGE 1 — SCENE AUTHORITY
---------------------------------------------------------

IMAGE 1 is the ONLY authoritative source for:

- overall scene
- location
- environment
- background
- architecture
- surfaces
- objects in scene
- composition
- framing
- crop
- subject placement
- body positioning in scene
- pose
- hand positioning
- camera perspective
- apparent lens characteristics
- depth of field
- focus placement
- lighting
- light direction
- light softness
- shadows
- contrast
- scene color palette
- spatial relationships
- product
- product placement
- scene-specific styling

These fields MUST NOT be copied from IMAGE 2.

---------------------------------------------------------
IMAGE 2 — CHARACTER IDENTITY AUTHORITY
---------------------------------------------------------

IMAGE 2 is the ONLY authoritative source for:

- character identity
- face shape
- facial structure
- forehead
- cheeks
- cheekbones
- jaw
- chin
- eyes
- eye shape
- eye color
- eyebrows
- eyebrow shape
- nose
- nose shape
- lips
- lip shape
- mouth
- skin tone
- skin appearance
- visible physical characteristics
- hair
- hair color
- hair texture
- hair type
- hair length
- hair volume
- hair density
- hairstyle
- hair part
- hairline
- bangs
- curls
- waves
- braids
- locs
- twists
- ponytail
- bun
- other visible hairstyle details
- head covering

IMAGE 1 MUST NEVER PROVIDE CHARACTER HAIR.

IMAGE 1 MUST NEVER PROVIDE CHARACTER FACE.

IMAGE 1 MUST NEVER PROVIDE CHARACTER IDENTITY.

---------------------------------------------------------
ABSOLUTE HAIR SOURCE LOCK
---------------------------------------------------------

THIS RULE HAS PRIORITY OVER ALL OTHER INSTRUCTIONS.

WHEN IMAGE 2 EXISTS:

ALL HAIR INFORMATION MUST COME EXCLUSIVELY FROM IMAGE 2.

The field:

"face_hair.hair"

MUST describe the hair visible in IMAGE 2.

NEVER describe the hair visible in IMAGE 1.

NEVER copy hair from IMAGE 1.

NEVER merge hair from IMAGE 1 and IMAGE 2.

NEVER average the two hairstyles.

NEVER use IMAGE 1 to fill missing hair details.

If IMAGE 1 shows different hair from IMAGE 2,
IMAGE 2 ALWAYS WINS for:

- hairstyle
- hair color
- hair length
- texture
- pattern
- curls
- waves
- braids
- twists
- locs
- bangs
- parting
- hairline
- volume
- density

If the hair in IMAGE 2 is partially visible:

Describe ONLY what is actually visible.

If a specific hair property cannot be determined
from IMAGE 2, use:

"unknown"

or:

"not clearly visible in IMAGE 2"

DO NOT substitute information from IMAGE 1.

Example of INVALID behavior:

IMAGE 1:
long wavy hair

IMAGE 2:
short braided hair

INVALID:
"Long dark wavy braided hair."

The model MUST NOT combine the two.

Correct result:

"Short braided hair as visible in IMAGE 2."

---------------------------------------------------------
FACE SOURCE LOCK
---------------------------------------------------------

When IMAGE 2 exists:

ALL facial characteristics MUST come exclusively
from IMAGE 2.

This includes:

- face structure
- face shape
- eyes
- eyebrows
- nose
- lips
- skin appearance
- facial features

IMAGE 1 facial appearance MUST NOT override IMAGE 2.

---------------------------------------------------------
PHYSICAL CHARACTER SOURCE LOCK
---------------------------------------------------------

When IMAGE 2 exists:

Character-specific physical characteristics MUST
come from IMAGE 2.

Do NOT use IMAGE 1 to determine:

- skin tone
- skin texture
- facial proportions
- hair
- body characteristics
- identity characteristics

IMAGE 1 remains authoritative only for the character's
POSITION and RELATIONSHIP to the reference scene.

---------------------------------------------------------
OUTFIT SOURCE LOCK
---------------------------------------------------------

Because REPLACEMENT CHARACTER is selected:

FINAL CLOTHING = IMAGE 2.

Use IMAGE 2 for:

- clothing
- garment type
- garment colors
- garment materials
- garment patterns
- garment textures
- garment construction
- outfit layers
- outfit-specific accessories

IMAGE 1 MUST NOT contribute clothing.

If clothing is visible in IMAGE 1 but differs from IMAGE 2,
ignore IMAGE 1 clothing.

Do NOT merge the outfits.

Do NOT describe IMAGE 1 clothing as final clothing.

---------------------------------------------------------
POSE SOURCE LOCK
---------------------------------------------------------

Pose belongs to IMAGE 1.

Use IMAGE 1 for:

- pose
- body position
- hand position
- head position
- gaze direction in the scene
- interaction with objects
- interaction with environment

Do NOT replace IMAGE 1 pose with IMAGE 2 pose.

IMAGE 2 may describe physical identity,
but NOT the reference scene pose.

---------------------------------------------------------
FINAL TRANSFORMATION LOGIC
---------------------------------------------------------

Think of the final result as:

IMAGE 1
=
SCENE + POSE + COMPOSITION + CAMERA + LIGHTING
+ BACKGROUND + ENVIRONMENT + PRODUCT

PLUS

IMAGE 2
=
CHARACTER IDENTITY + FACE + HAIR + PHYSICAL FEATURES
+ FINAL OUTFIT

Therefore:

IMAGE 1 SCENE
+
IMAGE 2 CHARACTER
=
FINAL VISUAL DESCRIPTION

Preserve IMAGE 1 as the visual foundation.

Replace the character identity with IMAGE 2.

Use IMAGE 2 hair.

Use IMAGE 2 face.

Use IMAGE 2 physical characteristics.

Use IMAGE 2 outfit.

Do NOT create a new scene from IMAGE 2.

Do NOT blend scene information from IMAGE 2.

=========================================================
CONFLICT RESOLUTION
=========================================================

If IMAGE 1 and IMAGE 2 conflict:

SCENE CONFLICT
-> IMAGE 1 wins.

POSE CONFLICT
-> IMAGE 1 wins.

COMPOSITION CONFLICT
-> IMAGE 1 wins.

CAMERA CONFLICT
-> IMAGE 1 wins.

LIGHTING CONFLICT
-> IMAGE 1 wins.

BACKGROUND CONFLICT
-> IMAGE 1 wins.

ENVIRONMENT CONFLICT
-> IMAGE 1 wins.

PRODUCT CONFLICT
-> IMAGE 1 wins.

FACE CONFLICT
-> IMAGE 2 wins.

HAIR CONFLICT
-> IMAGE 2 wins.

IDENTITY CONFLICT
-> IMAGE 2 wins.

SKIN / PHYSICAL CHARACTER CONFLICT
-> IMAGE 2 wins.

CLOTHING CONFLICT
-> IMAGE 2 wins.

OUTFIT ACCESSORY CONFLICT
-> IMAGE 2 wins.

NEVER resolve conflicts by blending both images.

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

IMAGE 1 is authoritative for the REFERENCE SCENE
and FINAL OUTFIT.

IMAGE 2 is authoritative only for CHARACTER IDENTITY.

=========================================================
FIELD-LEVEL SOURCE AUTHORITY
=========================================================

IMAGE 1 is authoritative for:

- scene
- location
- environment
- background
- composition
- framing
- crop
- pose
- body positioning
- camera
- lighting
- shadows
- product
- spatial relationships
- clothing
- final outfit
- outfit-specific accessories

IMAGE 2 is authoritative ONLY for:

- character identity
- face
- facial structure
- eyes
- eyebrows
- nose
- lips
- skin appearance
- physical characteristics
- hair
- head covering

=========================================================
ABSOLUTE HAIR SOURCE LOCK
=========================================================

WHEN IMAGE 2 EXISTS:

ALL CHARACTER HAIR INFORMATION MUST COME
EXCLUSIVELY FROM IMAGE 2.

The field:

"face_hair.hair"

MUST describe IMAGE 2 hair.

NEVER use IMAGE 1 hair.

NEVER merge IMAGE 1 hair with IMAGE 2 hair.

If IMAGE 2 hair is unclear, report:

"unknown"

or:

"not clearly visible in IMAGE 2"

Do NOT fill missing hair information from IMAGE 1.

If IMAGE 1 and IMAGE 2 show different hairstyles,
IMAGE 2 ALWAYS WINS for the replacement character.

=========================================================
FACE SOURCE LOCK
=========================================================

When IMAGE 2 exists:

ALL facial identity information comes exclusively
from IMAGE 2.

IMAGE 1 MUST NOT override:

- face shape
- eyes
- eyebrows
- nose
- lips
- skin
- facial characteristics

=========================================================
OUTFIT RULE
=========================================================

Because REFERENCE IMAGE is selected:

FINAL CLOTHING = IMAGE 1.

Use IMAGE 1 for:

- garment type
- colors
- materials
- patterns
- textures
- construction
- accessories
- final outfit

IMAGE 2 MUST NOT contribute clothing.

=========================================================
SCENE RULE
=========================================================

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

IMAGE 2 MUST NOT replace these elements.

=========================================================
CONFLICT RESOLUTION
=========================================================

SCENE
-> IMAGE 1

POSE
-> IMAGE 1

COMPOSITION
-> IMAGE 1

CAMERA
-> IMAGE 1

LIGHTING
-> IMAGE 1

BACKGROUND
-> IMAGE 1

ENVIRONMENT
-> IMAGE 1

PRODUCT
-> IMAGE 1

CLOTHING
-> IMAGE 1

FACE
-> IMAGE 2

HAIR
-> IMAGE 2

IDENTITY
-> IMAGE 2

PHYSICAL CHARACTERISTICS
-> IMAGE 2

NEVER blend conflicting details.

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

When TWO images are supplied:

IMAGE 1 = REFERENCE IMAGE
IMAGE 2 = REPLACEMENT CHARACTER

They are NOT equal references.

IMAGE 1 controls the reference SCENE.

IMAGE 2 controls the replacement CHARACTER IDENTITY.

The selected outfit source controls CLOTHING.

=========================================================
FIELD-LEVEL AUTHORITY MATRIX
=========================================================

The following rules are absolute.

---------------------------------------------------------
IMAGE 1 ONLY
---------------------------------------------------------

The following MUST come from IMAGE 1:

- scene
- location
- environment
- background
- architecture
- surfaces
- composition
- framing
- crop
- subject placement
- pose
- body positioning in scene
- hand positioning
- camera
- lens characteristics
- depth of field
- focus
- lighting
- shadows
- product
- product placement
- spatial relationships
- scene visual style

---------------------------------------------------------
IMAGE 2 ONLY
---------------------------------------------------------

When IMAGE 2 exists, the following MUST come
exclusively from IMAGE 2:

- character identity
- face
- facial structure
- face shape
- eyes
- eyebrows
- nose
- lips
- skin appearance
- visible physical characteristics
- hair
- hair color
- hair texture
- hair length
- hairstyle
- hair pattern
- hair part
- hairline
- bangs
- curls
- waves
- braids
- twists
- locs
- ponytail
- bun
- head covering

---------------------------------------------------------
CLOTHING
---------------------------------------------------------

When OUTFIT SOURCE = REFERENCE:

CLOTHING = IMAGE 1.

When OUTFIT SOURCE = CHARACTER:

CLOTHING = IMAGE 2.

No exceptions.

=========================================================
ABSOLUTE HAIR RULE
=========================================================

THIS RULE OVERRIDES GENERIC IMAGE DESCRIPTION.

When IMAGE 2 exists:

"face_hair.hair"
MUST be derived exclusively from IMAGE 2.

Do NOT derive this field from IMAGE 1.

Do NOT compare the hairstyles and combine them.

Do NOT write a hybrid hairstyle.

Do NOT use IMAGE 1 to complete missing IMAGE 2 details.

If IMAGE 2 clearly shows braided hair,
the output MUST describe braided hair.

If IMAGE 2 clearly shows short hair,
the output MUST NOT describe long hair from IMAGE 1.

If IMAGE 2 clearly shows straight hair,
the output MUST NOT describe wavy hair from IMAGE 1.

If IMAGE 2 clearly shows curly hair,
the output MUST NOT describe straight or wavy hair
from IMAGE 1.

If IMAGE 2 hair is partially visible,
describe only the visible portion.

If IMAGE 2 hair cannot be determined,
write:

"not clearly visible in IMAGE 2"

Do NOT fall back to IMAGE 1.

=========================================================
ABSOLUTE FACE RULE
=========================================================

When IMAGE 2 exists:

The following fields MUST be derived exclusively
from IMAGE 2:

- face_structure
- eyes
- eyebrows
- nose
- lips
- hair
- head_covering

If a field is not visible in IMAGE 2:

use:

"unknown"

or:

"not clearly visible in IMAGE 2"

Do NOT use IMAGE 1 as fallback.

=========================================================
ABSOLUTE PHYSICAL IDENTITY RULE
=========================================================

When IMAGE 2 exists:

Character-specific physical characteristics
must be derived from IMAGE 2.

This includes:

- skin tone
- skin appearance
- visible facial characteristics
- visible body characteristics
- hair
- identity-defining physical features

IMAGE 1 can establish where the character is,
but cannot redefine who the character is.

=========================================================
SCENE PRESERVATION RULE
=========================================================

IMAGE 1 is the visual foundation.

Do NOT describe IMAGE 2 as though it were the
main scene.

Do NOT transfer IMAGE 2:

- background
- environment
- room
- architecture
- composition
- framing
- camera
- lighting
- shadows
- spatial arrangement

into IMAGE 1.

The character from IMAGE 2 is inserted into
the scene of IMAGE 1.

=========================================================
CONFLICT RESOLUTION
=========================================================

If two images contain conflicting information,
DO NOT blend the information.

Apply this exact priority:

SCENE
IMAGE 1

LOCATION
IMAGE 1

BACKGROUND
IMAGE 1

ENVIRONMENT
IMAGE 1

COMPOSITION
IMAGE 1

POSE
IMAGE 1

CAMERA
IMAGE 1

LIGHTING
IMAGE 1

SHADOWS
IMAGE 1

PRODUCT
IMAGE 1

SPATIAL RELATIONSHIPS
IMAGE 1

CLOTHING
selected outfit source

FACE
IMAGE 2

HAIR
IMAGE 2

IDENTITY
IMAGE 2

PHYSICAL CHARACTERISTICS
IMAGE 2

If the lower-priority image contains conflicting
information, IGNORE that information.

=========================================================
=========================================================

IMAGE SOURCE RULES:

- Inspect every attached image carefully.
- IMAGE 1 is always the main reference image.
- IMAGE 2 is always the replacement character.
- Never confuse IMAGE 1 and IMAGE 2.
- Never invent information.
- Never assume clothing from one image belongs to another.
- Follow field-level authority exactly.
- Do not use one image as fallback for another image's
  authoritative field.

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

THE "subject" CATEGORY:

Use IMAGE 1 to establish:

- subject role
- subject placement
- subject relationship to scene

Use IMAGE 2 only for replacement character identity.

---------------------------------------------------------
THE "appearance" CATEGORY
---------------------------------------------------------

When IMAGE 2 exists:

Character appearance MUST come from IMAGE 2.

This includes:

- skin
- face
- hair
- physical characteristics

Do NOT copy character appearance from IMAGE 1.

---------------------------------------------------------
THE "face_hair" CATEGORY
---------------------------------------------------------

When IMAGE 2 exists:

ALL identity fields MUST come from IMAGE 2.

Specifically:

"face_structure"
-> IMAGE 2 ONLY

"eyes"
-> IMAGE 2 ONLY

"eyebrows"
-> IMAGE 2 ONLY

"nose"
-> IMAGE 2 ONLY

"lips"
-> IMAGE 2 ONLY

"hair"
-> IMAGE 2 ONLY

"head_covering"
-> IMAGE 2 ONLY

The "hair" field is NEVER allowed to use IMAGE 1.

---------------------------------------------------------
THE "pose" CATEGORY
---------------------------------------------------------

ALWAYS comes from IMAGE 1.

---------------------------------------------------------
THE "clothing" CATEGORY
---------------------------------------------------------

OUTFIT SOURCE = REFERENCE:
-> IMAGE 1 ONLY

OUTFIT SOURCE = CHARACTER:
-> IMAGE 2 ONLY

Never merge clothing.

---------------------------------------------------------
THE "accessories" CATEGORY
---------------------------------------------------------

Scene/product-related accessories:
-> IMAGE 1

Outfit-specific accessories:
-> selected outfit source

---------------------------------------------------------
THE "product" CATEGORY
---------------------------------------------------------

ALWAYS IMAGE 1.

---------------------------------------------------------
THE "composition" CATEGORY
---------------------------------------------------------

ALWAYS IMAGE 1.

---------------------------------------------------------
THE "camera" CATEGORY
---------------------------------------------------------

ALWAYS IMAGE 1.

---------------------------------------------------------
THE "lighting" CATEGORY
---------------------------------------------------------

ALWAYS IMAGE 1.

---------------------------------------------------------
THE "shadows" CATEGORY
---------------------------------------------------------

ALWAYS IMAGE 1.

---------------------------------------------------------
THE "environment" CATEGORY
---------------------------------------------------------

ALWAYS IMAGE 1.

---------------------------------------------------------
THE "background" CATEGORY
---------------------------------------------------------

ALWAYS IMAGE 1.

---------------------------------------------------------
THE "color_palette" CATEGORY
---------------------------------------------------------

Overall scene palette:
-> IMAGE 1

Clothing palette:
-> selected outfit source

Character hair color:
-> IMAGE 2

Character skin appearance:
-> IMAGE 2

Do not allow scene palette to overwrite character
identity attributes.

---------------------------------------------------------
THE "visual_style" CATEGORY
---------------------------------------------------------

ALWAYS prioritize IMAGE 1.

---------------------------------------------------------
THE "text_branding" CATEGORY
---------------------------------------------------------

Prioritize IMAGE 1.

Do not import branding from IMAGE 2.

---------------------------------------------------------
THE "spatial_relationships" CATEGORY
---------------------------------------------------------

ALWAYS IMAGE 1.

=========================================================
FINAL ANALYSIS PRINCIPLE
=========================================================

When two images are supplied, do NOT simply describe
both images independently.

Instead determine:

1. What belongs to IMAGE 1 scene.
2. What belongs to IMAGE 2 character identity.
3. What belongs to the selected outfit source.

Then produce ONE structured analysis representing
the intended final transformation.

The analysis must preserve:

IMAGE 1
=
SCENE AUTHORITY

IMAGE 2
=
CHARACTER IDENTITY AUTHORITY

SELECTED OUTFIT SOURCE
=
CLOTHING AUTHORITY

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

=========================================================
SOURCE AUTHORITY
=========================================================

IMAGE 1 controls ONLY the scene:

- location
- environment
- background
- architecture
- composition
- pose
- framing
- camera
- lighting
- shadows
- product
- spatial relationships

IMAGE 2 controls CHARACTER IDENTITY:

- face
- facial structure
- eyes
- eyebrows
- nose
- lips
- skin appearance
- visible physical characteristics
- hair
- hairstyle
- hair color
- hair texture
- hair length
- braids
- curls
- waves
- twists
- locs
- bangs
- hairline
- head covering

IMAGE 2 also controls FINAL CLOTHING:

- clothing
- garment type
- colors
- materials
- patterns
- textures
- construction
- outfit-specific accessories

=========================================================
HAIR LOCK
=========================================================

The replacement character hair MUST come exclusively
from IMAGE 2.

Do NOT use IMAGE 1 hair.

Do NOT combine IMAGE 1 hair with IMAGE 2 hair.

If IMAGE 1 shows a different hairstyle,
IGNORE IMAGE 1 hairstyle completely.

If IMAGE 2 hair is unclear,
write "not clearly visible in IMAGE 2".

NEVER use IMAGE 1 as a fallback for hair.

=========================================================
FACE LOCK
=========================================================

The replacement character face MUST come exclusively
from IMAGE 2.

Do NOT copy facial characteristics from IMAGE 1.

=========================================================
SCENE LOCK
=========================================================

Do NOT use IMAGE 2 as the scene reference.

Do NOT transfer IMAGE 2:

- background
- environment
- composition
- camera
- lighting
- shadows
- location
- spatial arrangement

The final scene MUST remain based on IMAGE 1.

=========================================================
OUTFIT LOCK
=========================================================

Do NOT use clothing from IMAGE 1.

The final outfit MUST come from IMAGE 2.

Do NOT merge clothing from the two images.
`

            : `
OUTFIT SOURCE SELECTED:
Reference Image Outfit.

IMAGE 1 = PRIMARY VISUAL REFERENCE.

=========================================================
SOURCE AUTHORITY
=========================================================

IMAGE 1 controls:

- scene
- location
- environment
- background
- composition
- pose
- framing
- camera
- lighting
- shadows
- product
- spatial relationships
- clothing
- final outfit
- outfit-specific accessories

IMAGE 2 = REPLACEMENT CHARACTER.

IMAGE 2 controls ONLY:

- character identity
- face
- facial structure
- eyes
- eyebrows
- nose
- lips
- skin appearance
- visible physical characteristics
- hair
- hairstyle
- hair color
- hair texture
- hair length
- braids
- curls
- waves
- twists
- locs
- bangs
- hairline
- head covering

=========================================================
HAIR LOCK
=========================================================

The replacement character hair MUST come exclusively
from IMAGE 2.

Do NOT use IMAGE 1 hair.

Do NOT merge IMAGE 1 hair with IMAGE 2 hair.

If IMAGE 1 shows a different hairstyle,
IGNORE IMAGE 1 hairstyle for character identity.

If IMAGE 2 hair is unclear,
write "not clearly visible in IMAGE 2".

NEVER use IMAGE 1 as a fallback for hair.

=========================================================
OUTFIT LOCK
=========================================================

The final clothing MUST come from IMAGE 1.

Do NOT import clothing from IMAGE 2.
`;


    return `
Analyze the supplied image source(s) for GEN-Z.AI Vision.

=========================================================
IMAGE ROLE ASSIGNMENT
=========================================================

IMAGE 1 = REFERENCE IMAGE
IMAGE 2 = REPLACEMENT CHARACTER

IMAGE 1 is the PRIMARY VISUAL REFERENCE.

IMAGE 2 is NOT a second scene reference.

IMAGE 2 exists to provide the replacement character.

${outfitInstructions}

=========================================================
FIELD-LEVEL SOURCE MATRIX
=========================================================

Before writing the JSON, internally assign every
visual fact to its correct source.

SCENE:
IMAGE 1

LOCATION:
IMAGE 1

ENVIRONMENT:
IMAGE 1

BACKGROUND:
IMAGE 1

COMPOSITION:
IMAGE 1

POSE:
IMAGE 1

CAMERA:
IMAGE 1

LIGHTING:
IMAGE 1

SHADOWS:
IMAGE 1

PRODUCT:
IMAGE 1

SPATIAL RELATIONSHIPS:
IMAGE 1

FACE:
IMAGE 2

HAIR:
IMAGE 2

IDENTITY:
IMAGE 2

PHYSICAL CHARACTERISTICS:
IMAGE 2

CLOTHING:
${outfitSource === "character"
    ? "IMAGE 2"
    : "IMAGE 1"}

=========================================================
CRITICAL HAIR INSTRUCTION
=========================================================

The "face_hair.hair" JSON field has ONE source only.

SOURCE:
IMAGE 2.

This is mandatory whenever IMAGE 2 exists.

The value of "face_hair.hair" MUST describe
the replacement character hair visible in IMAGE 2.

Do NOT describe the hair of IMAGE 1.

Do NOT use IMAGE 1 hair as contextual information.

Do NOT combine hairstyles.

Do NOT produce a hybrid description.

Do NOT use IMAGE 1 to fill missing hair attributes.

If IMAGE 1 has:

"long dark wavy hair"

and IMAGE 2 has:

"short dark braids"

the correct analysis is based on:

"short dark braids"

and NOT:

"long dark wavy braided hair".

This applies to:

- hair length
- hair color
- hair texture
- hairstyle
- braids
- curls
- waves
- twists
- locs
- bangs
- hairline
- part
- volume
- density
- ponytail
- bun

If any of these cannot be determined from IMAGE 2,
mark that property unknown.

Never transfer information from IMAGE 1.

=========================================================
CRITICAL FACE INSTRUCTION
=========================================================

The following fields must come from IMAGE 2:

- face_structure
- eyes
- eyebrows
- nose
- lips
- hair
- head_covering

If IMAGE 2 exists, IMAGE 1 is NOT an authority
for these fields.

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

When IMAGE 2 exists, use it for replacement character:

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

For IMAGE 1 reference scene, inspect:

- subject placement
- body position
- pose
- hands
- head angle
- gaze
- expression
- interaction with objects
- interaction with environment

For IMAGE 2 replacement character, inspect:

- facial structure
- eyes
- eyebrows
- nose
- lips
- skin appearance
- hair
- hairstyle
- hair color
- hair texture
- hair length
- head covering
- visible physical characteristics

Remember:

IMAGE 2 character identity MUST NOT inherit
hair or facial details from IMAGE 1.

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

The final analysis must represent:

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
follow the authority matrix.

For character identity conflicts:

IMAGE 2 wins.

For hair conflicts:

IMAGE 2 wins.

For scene conflicts:

IMAGE 1 wins.

For clothing conflicts:

selected outfit source wins.

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

        index < source.length;

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

        index < source.length;

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

=========================================================
FIELD-LEVEL SOURCE AUTHORITY
=========================================================

IMAGE 1 ONLY:
- scene
- location
- background
- environment
- composition
- pose
- framing
- camera
- lighting
- shadows
- product
- spatial relationships

IMAGE 2 ONLY:
- identity
- face
- facial structure
- eyes
- eyebrows
- nose
- lips
- skin appearance
- physical characteristics
- hair
- hairstyle
- hair color
- hair texture
- hair length
- braids
- curls
- waves
- twists
- locs
- bangs
- hairline
- head covering

CLOTHING:
${outfitSource === "character"
    ? "IMAGE 2 ONLY"
    : "IMAGE 1 ONLY"}

=========================================================
ABSOLUTE HAIR RULE
=========================================================

When IMAGE 2 exists:

The field:

"face_hair.hair"

MUST be derived ONLY from IMAGE 2.

NEVER use IMAGE 1 hair.

NEVER combine IMAGE 1 and IMAGE 2 hair.

NEVER create a hybrid hairstyle.

NEVER use IMAGE 1 as a fallback.

If IMAGE 2 hair is unclear:

"not clearly visible in IMAGE 2"

If IMAGE 1 and IMAGE 2 show different hair:

IMAGE 2 ALWAYS WINS.

=========================================================
ABSOLUTE FACE RULE
=========================================================

When IMAGE 2 exists:

These MUST come from IMAGE 2:

- face_structure
- eyes
- eyebrows
- nose
- lips
- hair
- head_covering

=========================================================
SCENE RULE
=========================================================

IMAGE 1 ALWAYS remains the scene foundation.

Do NOT transfer IMAGE 2:

- background
- environment
- location
- composition
- camera
- lighting
- shadows
- spatial arrangement

=========================================================
OUTFIT RULE
=========================================================

OUTFIT SOURCE =
${outfitSource === "character"
    ? "REPLACEMENT CHARACTER / IMAGE 2"
    : "REFERENCE IMAGE / IMAGE 1"}

Never merge clothing.

=========================================================
CONFLICT RESOLUTION
=========================================================

Scene:
IMAGE 1

Pose:
IMAGE 1

Composition:
IMAGE 1

Camera:
IMAGE 1

Lighting:
IMAGE 1

Background:
IMAGE 1

Environment:
IMAGE 1

Product:
IMAGE 1

Face:
IMAGE 2

Hair:
IMAGE 2

Identity:
IMAGE 2

Physical characteristics:
IMAGE 2

Clothing:
selected outfit source

NEVER blend conflicting information.

=========================================================
COMPLETION PRIORITY
=========================================================

Prioritize:

1. Complete valid JSON.
2. Correct source separation.
3. Correct IMAGE 1 scene preservation.
4. Correct IMAGE 2 identity preservation.
5. Correct IMAGE 2 hair.
6. Correct selected outfit source.
7. Concrete visual observations.
8. All applicable analysis categories.
9. Properly closed objects and arrays.
10. Complete strings.

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
