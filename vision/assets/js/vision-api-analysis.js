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
   - IMAGE 1 SCENE PLATE LOCK
   - IMAGE 2 CHARACTER PLATE LOCK
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
VISUAL SOURCE ARCHITECTURE
OUTFIT SOURCE: REPLACEMENT CHARACTER
=========================================================

THERE ARE TWO DIFFERENT VISUAL PLATES.

IMAGE 1 = REFERENCE SCENE PLATE
IMAGE 2 = REPLACEMENT CHARACTER PLATE

THESE IMAGES MUST NEVER BE TREATED AS TWO EQUAL
SCENE REFERENCES.

=========================================================
MANDATORY TWO-STAGE ANALYSIS
=========================================================

STAGE 1:
ANALYZE IMAGE 1 AS A SCENE PLATE.

FREEZE AND PRESERVE:

- location
- environment
- background
- architecture
- surfaces
- objects
- product
- product placement
- composition
- framing
- crop
- subject placement
- pose
- body position in the scene
- hand position
- head position in the scene
- gaze direction in the scene
- camera perspective
- lens characteristics
- depth of field
- focus
- lighting
- shadows
- spatial relationships
- scene color palette
- scene visual style

AFTER THESE FACTS ARE IDENTIFIED,
THE IMAGE 1 SCENE IS LOCKED.

STAGE 2:
ANALYZE IMAGE 2 AS A CHARACTER PLATE.

USE IMAGE 2 ONLY FOR:

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
- head covering
- clothing
- final outfit
- outfit-specific accessories

IMAGE 2 IS NOT A SCENE REFERENCE.

=========================================================
IMAGE 1 SCENE PLATE LOCK
=========================================================

IMAGE 1 IS THE ONLY SOURCE FOR:

SCENE:
- location
- environment
- background
- architecture
- surfaces
- scene objects

COMPOSITION:
- framing
- crop
- orientation
- subject placement
- composition
- negative space

POSE:
- body position
- hand position
- head position in the scene
- gaze direction in the scene
- interaction with objects
- interaction with environment

CAMERA:
- camera perspective
- apparent lens
- depth of field
- focus
- camera distance

LIGHTING:
- light direction
- light quality
- softness
- highlights
- contrast
- ambient illumination
- color temperature

SHADOWS:
- shadow direction
- shadow softness
- shadow placement
- contact shadows

PRODUCT:
- product identity
- product appearance
- product placement
- product orientation
- product relationship to subject

SPATIAL RELATIONSHIPS:
- subject relative to background
- subject relative to product
- subject relative to objects
- foreground/middle/background relationships

IMAGE 2 MUST NOT OVERRIDE ANY OF THESE.

=========================================================
IMAGE 2 CHARACTER PLATE LOCK
=========================================================

IMAGE 2 IS THE ONLY SOURCE FOR CHARACTER IDENTITY.

FACE:
- face shape
- forehead
- cheeks
- cheekbones
- jaw
- chin
- eyes
- eye shape
- eye color
- eyelashes
- eyebrows
- nose
- lips
- mouth

PHYSICAL IDENTITY:
- skin tone
- skin appearance
- visible physical characteristics
- body characteristics that identify the character

HAIR:
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
- volume
- density

HEAD COVERING:
- type
- color
- visible construction

IMAGE 1 MUST NEVER PROVIDE THESE CHARACTER IDENTITY
FIELDS.

=========================================================
ABSOLUTE HAIR SOURCE LOCK
=========================================================

WHEN IMAGE 2 EXISTS:

ALL CHARACTER HAIR INFORMATION MUST COME EXCLUSIVELY
FROM IMAGE 2.

THE FIELD:

"face_hair.hair"

IS AN IMAGE 2 ONLY FIELD.

DO NOT USE IMAGE 1 HAIR.

DO NOT LOOK AT IMAGE 1 HAIR TO COMPLETE IMAGE 2.

DO NOT COMBINE HAIR.

DO NOT BLEND HAIR.

DO NOT AVERAGE HAIR.

DO NOT INFER IMAGE 2 HAIR FROM IMAGE 1.

IF IMAGE 1 SHOWS LONG WAVY HAIR
AND IMAGE 2 SHOWS SHORT BRAIDED HAIR:

THE RESULT MUST BE SHORT BRAIDED HAIR.

NOT:

- long hair
- wavy hair
- long wavy hair
- long wavy braided hair

ONLY THE IMAGE 2 HAIR IS VALID.

IF A HAIR PROPERTY IS NOT CLEARLY VISIBLE
IN IMAGE 2:

USE:

"unknown"

OR:

"not clearly visible in IMAGE 2"

NEVER FALL BACK TO IMAGE 1.

=========================================================
ABSOLUTE SCENE LOCATION LOCK
=========================================================

WHEN TWO IMAGES ARE PRESENT:

"environment"
AND
"background"

MUST DESCRIBE IMAGE 1.

THE LOCATION MUST COME FROM IMAGE 1.

THE ENVIRONMENT MUST COME FROM IMAGE 1.

THE BACKGROUND MUST COME FROM IMAGE 1.

IF IMAGE 1 SHOWS:

- a room
- a studio
- a street
- a beach
- a forest
- an office
- a kitchen
- a bedroom
- a store
- a building
- architecture
- outdoor scenery
- indoor scenery

THAT INFORMATION MUST REMAIN IN THE FINAL ANALYSIS.

DO NOT REPLACE IT WITH THE LOCATION OF IMAGE 2.

IF IMAGE 2 IS OUTDOORS AND IMAGE 1 IS INDOORS:

THE FINAL ENVIRONMENT MUST BE INDOORS.

IF IMAGE 2 IS INDOORS AND IMAGE 1 IS OUTDOORS:

THE FINAL ENVIRONMENT MUST BE OUTDOORS.

IMAGE 2 LOCATION IS NEVER A FALLBACK.

=========================================================
ABSOLUTE COMPOSITION LOCK
=========================================================

"composition"

MUST DESCRIBE IMAGE 1.

IMAGE 2 COMPOSITION MUST BE IGNORED.

If IMAGE 2 is a close-up portrait but IMAGE 1 is
a full-body scene:

THE FINAL COMPOSITION MUST REMAIN THE IMAGE 1
FULL-BODY SCENE.

Do not convert IMAGE 1 into IMAGE 2 framing.

=========================================================
ABSOLUTE POSE LOCK
=========================================================

"pose"

MUST DESCRIBE THE SUBJECT'S POSE IN IMAGE 1.

IMAGE 2 MAY PROVIDE PHYSICAL CHARACTER INFORMATION,
BUT IMAGE 2 POSE MUST NOT replace IMAGE 1 pose.

If IMAGE 2 looks directly at the camera but IMAGE 1
shows the character looking sideways:

THE SCENE GAZE MUST FOLLOW IMAGE 1.

=========================================================
ABSOLUTE CAMERA LOCK
=========================================================

"camera"

MUST DESCRIBE IMAGE 1.

Never derive camera information from IMAGE 2.

If IMAGE 2 is a portrait selfie and IMAGE 1 is
a cinematic wide scene:

THE FINAL CAMERA DESCRIPTION MUST FOLLOW IMAGE 1.

=========================================================
ABSOLUTE LIGHTING LOCK
=========================================================

"lighting"

MUST DESCRIBE IMAGE 1.

"shadows"

MUST DESCRIBE IMAGE 1.

Never transfer lighting or shadows from IMAGE 2.

=========================================================
ABSOLUTE OUTFIT LOCK
=========================================================

OUTFIT SOURCE = IMAGE 2.

FINAL CLOTHING MUST COME FROM IMAGE 2.

Use IMAGE 2 for:

- garment type
- garment colors
- garment materials
- garment patterns
- garment textures
- garment construction
- outfit layers
- outfit-specific accessories

IMAGE 1 CLOTHING MUST BE IGNORED.

DO NOT MERGE OUTFITS.

=========================================================
FINAL TRANSFORMATION
=========================================================

The intended transformation is:

IMAGE 1
=
SCENE PLATE

IMAGE 2
=
CHARACTER PLATE

FINAL:

IMAGE 1 SCENE
+
IMAGE 2 CHARACTER IDENTITY
+
IMAGE 2 OUTFIT

The final result MUST look conceptually like:

"the IMAGE 2 character placed into IMAGE 1 scene
while preserving IMAGE 1 composition, pose, camera,
lighting, environment, background, location and product."

NOT:

"IMAGE 2 character portrait with some elements
from IMAGE 1."

=========================================================
CONFLICT RESOLUTION
=========================================================

SCENE
-> IMAGE 1

LOCATION
-> IMAGE 1

ENVIRONMENT
-> IMAGE 1

BACKGROUND
-> IMAGE 1

ARCHITECTURE
-> IMAGE 1

COMPOSITION
-> IMAGE 1

FRAMING
-> IMAGE 1

CROP
-> IMAGE 1

POSE
-> IMAGE 1

CAMERA
-> IMAGE 1

LIGHTING
-> IMAGE 1

SHADOWS
-> IMAGE 1

PRODUCT
-> IMAGE 1

SPATIAL RELATIONSHIPS
-> IMAGE 1

FACE
-> IMAGE 2

HAIR
-> IMAGE 2

IDENTITY
-> IMAGE 2

SKIN
-> IMAGE 2

PHYSICAL CHARACTERISTICS
-> IMAGE 2

CLOTHING
-> IMAGE 2

OUTFIT ACCESSORIES
-> IMAGE 2

NEVER RESOLVE A CONFLICT BY BLENDING.

=========================================================
`.trim();

    }


    return `
=========================================================
VISUAL SOURCE ARCHITECTURE
OUTFIT SOURCE: REFERENCE IMAGE
=========================================================

IMAGE 1 = REFERENCE SCENE PLATE
IMAGE 2 = REPLACEMENT CHARACTER PLATE

IMAGE 1 controls the scene and final outfit.

IMAGE 2 controls replacement character identity.

=========================================================
TWO-STAGE ANALYSIS
=========================================================

STAGE 1:
Analyze IMAGE 1 as the complete scene plate.

Freeze:

- location
- environment
- background
- composition
- framing
- crop
- pose
- camera
- lighting
- shadows
- product
- spatial relationships
- clothing
- final outfit

STAGE 2:
Analyze IMAGE 2 only as character identity.

Use IMAGE 2 for:

- face
- facial structure
- eyes
- eyebrows
- nose
- lips
- skin
- physical characteristics
- hair
- head covering

IMAGE 2 MUST NOT replace the IMAGE 1 scene.

=========================================================
IMAGE 1 ONLY
=========================================================

IMAGE 1 is the ONLY source for:

- scene
- location
- environment
- background
- composition
- framing
- crop
- pose
- camera
- lighting
- shadows
- product
- spatial relationships
- clothing
- final outfit
- outfit-specific accessories

=========================================================
IMAGE 2 ONLY
=========================================================

When IMAGE 2 exists, IMAGE 2 is the ONLY source for:

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
ABSOLUTE HAIR LOCK
=========================================================

ALL CHARACTER HAIR MUST COME EXCLUSIVELY FROM IMAGE 2.

"face_hair.hair"
=
IMAGE 2 ONLY.

Never use IMAGE 1 hair.

Never blend hair.

Never use IMAGE 1 as a fallback.

=========================================================
SCENE LOCK
=========================================================

IMAGE 1 remains the scene foundation.

IMAGE 2 cannot replace:

- location
- environment
- background
- composition
- framing
- pose
- camera
- lighting
- shadows
- product

=========================================================
CONFLICT RESOLUTION
=========================================================

SCENE
-> IMAGE 1

LOCATION
-> IMAGE 1

ENVIRONMENT
-> IMAGE 1

BACKGROUND
-> IMAGE 1

COMPOSITION
-> IMAGE 1

POSE
-> IMAGE 1

CAMERA
-> IMAGE 1

LIGHTING
-> IMAGE 1

SHADOWS
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

NEVER blend conflicting information.

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

Your task is to perform an extremely accurate,
source-separated analysis of the supplied image source(s).

DO NOT generate a creative prompt yet.

DO NOT describe the two images as equal references.

The images have fixed roles.

${outfitRules}

=========================================================
MASTER SOURCE MATRIX
=========================================================

THIS MATRIX IS ABSOLUTE.

SCENE FIELDS
-> IMAGE 1 ONLY

IDENTITY FIELDS
-> IMAGE 2 ONLY WHEN IMAGE 2 EXISTS

CLOTHING
-> SELECTED OUTFIT SOURCE

=========================================================
SCENE FIELDS = IMAGE 1 ONLY
=========================================================

The following JSON categories MUST be based on IMAGE 1:

"subject"
for scene placement and relationship

"pose"

"product"

"composition"

"camera"

"lighting"

"shadows"

"environment"

"background"

"spatial_relationships"

Scene-related parts of:

"visual_style"

"color_palette"

"text_branding"

IMAGE 2 MUST NOT provide scene information for these.

=========================================================
IDENTITY FIELDS = IMAGE 2 ONLY
=========================================================

When IMAGE 2 exists, the following MUST come exclusively
from IMAGE 2:

"appearance" identity fields

"face_hair"

identity-related physical characteristics

This includes:

- face shape
- forehead
- cheeks
- cheekbones
- jaw
- chin
- eyes
- eyebrows
- nose
- lips
- mouth
- skin tone
- skin appearance
- hair
- hairstyle
- hair color
- hair texture
- hair length
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
- volume
- density
- head covering

IMAGE 1 MUST NOT be used as fallback for any of these.

=========================================================
CLOTHING AUTHORITY
=========================================================

${outfitSource === "character"
    ? `
OUTFIT SOURCE = IMAGE 2.

"clothing" MUST describe IMAGE 2 clothing.

IMAGE 1 clothing MUST NOT be used.

Outfit-specific accessories MUST come from IMAGE 2.
`
    : `
OUTFIT SOURCE = IMAGE 1.

"clothing" MUST describe IMAGE 1 clothing.

IMAGE 2 clothing MUST NOT be used.

Outfit-specific accessories MUST come from IMAGE 1.
`
}

=========================================================
MANDATORY ANALYSIS PROCEDURE
=========================================================

FOLLOW THIS PROCEDURE INTERNALLY BEFORE WRITING JSON.

STEP 1:
Look at IMAGE 1 ONLY.

Identify and lock:

- location
- environment
- background
- architecture
- objects
- product
- composition
- framing
- crop
- subject placement
- pose
- hand position
- body position
- camera
- lens
- depth of field
- focus
- lighting
- shadows
- spatial relationships

DO NOT LOOK TO IMAGE 2 TO COMPLETE THESE FIELDS.

STEP 2:
Look at IMAGE 2 ONLY.

Identify and lock:

- character identity
- face
- facial structure
- eyes
- eyebrows
- nose
- lips
- skin
- hair
- head covering
- physical characteristics

When outfit source is CHARACTER, also identify:

- clothing
- garment type
- colors
- materials
- patterns
- textures
- construction
- outfit layers
- outfit-specific accessories

STEP 3:
Combine the two source plates conceptually.

PLACE:

IMAGE 2 CHARACTER

INTO:

IMAGE 1 SCENE.

DO NOT PLACE IMAGE 1 SCENE INTO IMAGE 2.

STEP 4:
Write each JSON category only from its authoritative source.

STEP 5:
Perform the FINAL SOURCE AUDIT before returning JSON.

=========================================================
IMAGE 1 SCENE PLATE
=========================================================

IMAGE 1 IS THE SCENE PLATE.

The following MUST describe IMAGE 1:

- location
- environment
- background
- architecture
- surfaces
- scene objects
- composition
- framing
- crop
- subject placement
- pose
- hand position
- body position in scene
- head position in scene
- gaze direction in scene
- camera
- lens characteristics
- depth of field
- focus
- lighting
- shadows
- product
- product placement
- spatial relationships

If IMAGE 1 visibly shows a location,
DO NOT return "unknown" merely because IMAGE 2
shows a different location.

If IMAGE 1 is indoors and IMAGE 2 is outdoors:

environment = IMAGE 1 indoor environment.

If IMAGE 1 is outdoors and IMAGE 2 is indoors:

environment = IMAGE 1 outdoor environment.

The location of IMAGE 2 MUST NEVER replace
the location of IMAGE 1.

=========================================================
IMAGE 2 CHARACTER PLATE
=========================================================

IMAGE 2 IS THE CHARACTER PLATE.

The following MUST describe IMAGE 2:

- face
- facial structure
- eyes
- eyebrows
- nose
- lips
- skin appearance
- physical identity
- hair
- hairstyle
- hair color
- hair texture
- hair length
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

=========================================================
HAIR SOURCE LOCK
=========================================================

THIS IS AN EXCLUSIVE FIELD RULE.

When IMAGE 2 exists:

"face_hair.hair"

MUST be derived from IMAGE 2 ONLY.

IMAGE 1 HAIR IS INVALID FOR THIS FIELD.

Never:

- copy IMAGE 1 hair
- merge IMAGE 1 hair
- blend hairstyles
- average hairstyles
- borrow missing attributes
- use IMAGE 1 as fallback

If IMAGE 2 clearly shows braids,
"face_hair.hair" must describe braids.

If IMAGE 2 clearly shows short hair,
"face_hair.hair" must describe short hair.

If IMAGE 2 clearly shows long hair,
"face_hair.hair" must describe long hair.

If IMAGE 2 hair is unclear,
use:

"not clearly visible in IMAGE 2"

Do NOT use IMAGE 1 to fill the gap.

=========================================================
FACE SOURCE LOCK
=========================================================

When IMAGE 2 exists:

"face_hair.face_structure"
-> IMAGE 2 ONLY

"face_hair.eyes"
-> IMAGE 2 ONLY

"face_hair.eyebrows"
-> IMAGE 2 ONLY

"face_hair.nose"
-> IMAGE 2 ONLY

"face_hair.lips"
-> IMAGE 2 ONLY

"face_hair.head_covering"
-> IMAGE 2 ONLY

Never use IMAGE 1 as fallback.

=========================================================
APPEARANCE SOURCE LOCK
=========================================================

When IMAGE 2 exists:

Character identity information in "appearance"
must come from IMAGE 2.

This includes:

- skin tone
- skin appearance
- visible physical characteristics
- body characteristics
- identity-defining details

IMAGE 1 may establish where the character stands,
but cannot determine who the character is.

=========================================================
POSE SOURCE LOCK
=========================================================

"pose" describes the character's placement and action
IN IMAGE 1.

Use IMAGE 1.

Do NOT copy the pose of IMAGE 2.

If IMAGE 2 is standing and IMAGE 1 is sitting:

The final pose must be sitting.

If IMAGE 2 faces the camera and IMAGE 1 faces sideways:

The final scene gaze must follow IMAGE 1.

=========================================================
COMPOSITION SOURCE LOCK
=========================================================

"composition" describes IMAGE 1 ONLY.

Use IMAGE 1 for:

- framing
- crop
- subject placement
- orientation
- negative space
- balance
- foreground
- middle ground
- background
- spatial composition

IMAGE 2 composition MUST NOT be copied.

=========================================================
CAMERA SOURCE LOCK
=========================================================

"camera" describes IMAGE 1 ONLY.

Use IMAGE 1 for:

- perspective
- apparent lens
- camera distance
- depth of field
- focus
- focus placement

Never infer the final camera from IMAGE 2.

=========================================================
LIGHTING SOURCE LOCK
=========================================================

"lighting" describes IMAGE 1 ONLY.

"shadows" describes IMAGE 1 ONLY.

Never import:

- light direction
- light softness
- highlights
- contrast
- ambient illumination
- color temperature
- shadows

from IMAGE 2.

=========================================================
ENVIRONMENT SOURCE LOCK
=========================================================

"environment" describes IMAGE 1 ONLY.

Inspect IMAGE 1 carefully for:

- indoor/outdoor setting
- location type
- architecture
- walls
- floor
- ceiling
- furniture
- vegetation
- street
- landscape
- structures
- surfaces
- environmental objects
- depth

Do NOT use IMAGE 2 environment.

=========================================================
BACKGROUND SOURCE LOCK
=========================================================

"background" describes IMAGE 1 ONLY.

Inspect:

- background structures
- scenery
- objects
- colors
- textures
- depth
- blur
- environmental context

If IMAGE 2 has a completely different background,
IGNORE IT.

=========================================================
PRODUCT SOURCE LOCK
=========================================================

"product" describes IMAGE 1 ONLY.

Never invent a product from IMAGE 2.

Inspect IMAGE 1 for:

- product type
- shape
- material
- color
- branding
- labels
- orientation
- placement
- interaction with subject

=========================================================
ACCESSORIES SOURCE LOCK
=========================================================

Scene-related accessories:
-> IMAGE 1

Product-related accessories:
-> IMAGE 1

Outfit-specific accessories:
-> selected outfit source

When OUTFIT SOURCE = CHARACTER:
-> outfit accessories IMAGE 2

When OUTFIT SOURCE = REFERENCE:
-> outfit accessories IMAGE 1

=========================================================
COLOR SOURCE LOCK
=========================================================

Scene color palette:
-> IMAGE 1

Environment colors:
-> IMAGE 1

Background colors:
-> IMAGE 1

Lighting color:
-> IMAGE 1

Product colors:
-> IMAGE 1

Character skin:
-> IMAGE 2

Character hair:
-> IMAGE 2

Character clothing:
-> selected outfit source

Do not allow IMAGE 2 scene colors to replace
IMAGE 1 scene colors.

=========================================================
VISUAL STYLE SOURCE LOCK
=========================================================

The overall visual style MUST follow IMAGE 1.

Use IMAGE 1 for:

- photographic/cinematic character
- realism
- sharpness
- background separation
- scene aesthetic
- contrast
- image treatment

Do not use IMAGE 2's portrait style
to redefine IMAGE 1.

=========================================================
TEXT AND BRANDING SOURCE LOCK
=========================================================

Visible scene text and branding:
-> IMAGE 1

Product text:
-> IMAGE 1

Do not import unrelated branding from IMAGE 2.

=========================================================
FINAL TRANSFORMATION RULE
=========================================================

The final analysis represents:

IMAGE 1 SCENE
+
IMAGE 2 CHARACTER
+
SELECTED OUTFIT SOURCE

For CHARACTER outfit mode:

IMAGE 1:
scene + location + environment + background
+ composition + pose + camera + lighting
+ shadows + product + spatial relationships

IMAGE 2:
identity + face + hair + physical characteristics
+ clothing + outfit

For REFERENCE outfit mode:

IMAGE 1:
scene + location + environment + background
+ composition + pose + camera + lighting
+ shadows + product + spatial relationships
+ clothing + outfit

IMAGE 2:
identity + face + hair + physical characteristics

=========================================================
FINAL SOURCE AUDIT
=========================================================

BEFORE RETURNING JSON, CHECK EVERY CATEGORY.

CHECK 1:
Does "environment" describe IMAGE 1?

CHECK 2:
Does "background" describe IMAGE 1?

CHECK 3:
Does "composition" describe IMAGE 1?

CHECK 4:
Does "pose" describe IMAGE 1?

CHECK 5:
Does "camera" describe IMAGE 1?

CHECK 6:
Does "lighting" describe IMAGE 1?

CHECK 7:
Does "shadows" describe IMAGE 1?

CHECK 8:
Does "product" describe IMAGE 1?

CHECK 9:
Does "spatial_relationships" describe IMAGE 1?

CHECK 10:
Does "face_hair" describe IMAGE 2?

CHECK 11:
Does "face_hair.hair" describe ONLY IMAGE 2?

CHECK 12:
Does "appearance" identity information describe IMAGE 2?

CHECK 13:
Does "clothing" use the selected outfit source?

CHECK 14:
Did any IMAGE 2 location/background/environment
leak into IMAGE 1 scene fields?

CHECK 15:
Did any IMAGE 1 hair/face/identity leak into
IMAGE 2 character fields?

If any answer is wrong:

CORRECT THE JSON BEFORE RETURNING IT.

=========================================================
CRITICAL FAILURE CONDITIONS
=========================================================

The analysis is INVALID if:

- IMAGE 2 becomes the main scene
- IMAGE 2 background replaces IMAGE 1 background
- IMAGE 2 environment replaces IMAGE 1 environment
- IMAGE 2 location replaces IMAGE 1 location
- IMAGE 2 composition replaces IMAGE 1 composition
- IMAGE 2 pose replaces IMAGE 1 pose
- IMAGE 2 camera replaces IMAGE 1 camera
- IMAGE 2 lighting replaces IMAGE 1 lighting
- IMAGE 1 hair replaces IMAGE 2 hair
- clothing comes from the wrong outfit source
- the two scenes are blended

=========================================================
JSON REQUIREMENTS
=========================================================

Return actual observable visual information.

Do NOT return an empty schema.

Use null or "unknown" only when a detail is genuinely
not visible or cannot be determined from its authoritative
image.

IMPORTANT:

"unknown" does NOT mean:
"use the other image".

If IMAGE 2 hair is unclear:

"not clearly visible in IMAGE 2"

If IMAGE 1 location is unclear:

"not clearly identifiable in IMAGE 1"

Never use the other image as fallback.

The returned JSON MUST be complete.

Do NOT stop in the middle of a property.

Do NOT stop in the middle of a string.

Do NOT stop before closing braces or arrays.

Return valid JSON only.

Do not use Markdown fences.

Do not add explanations.

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
OUTFIT SOURCE:
${outfitLabel}

=========================================================
MANDATORY VISUAL TRANSFORMATION
=========================================================

IMAGE 1 = SCENE PLATE
IMAGE 2 = CHARACTER PLATE

The final visual concept is:

IMAGE 2 CHARACTER
placed inside
IMAGE 1 SCENE.

IMAGE 1 remains the visual foundation.

IMAGE 2 does NOT become the scene.

=========================================================
IMAGE 1 MUST PROVIDE
=========================================================

Use IMAGE 1 ONLY for:

- location
- environment
- background
- architecture
- surfaces
- scene objects
- composition
- framing
- crop
- subject placement
- pose
- body position in scene
- hand position
- head position in scene
- gaze direction in scene
- camera
- lens
- depth of field
- focus
- lighting
- shadows
- product
- product placement
- spatial relationships
- scene visual style

=========================================================
IMAGE 2 MUST PROVIDE
=========================================================

Use IMAGE 2 ONLY for:

- character identity
- face
- facial structure
- eyes
- eyebrows
- nose
- lips
- skin
- physical characteristics
- hair
- hairstyle
- hair color
- hair texture
- hair length
- hair pattern
- braids
- curls
- waves
- twists
- locs
- bangs
- hairline
- head covering

AND:

- clothing
- garment type
- garment colors
- garment materials
- garment patterns
- garment textures
- garment construction
- outfit layers
- outfit-specific accessories

=========================================================
DO NOT COPY IMAGE 2 SCENE
=========================================================

Ignore IMAGE 2:

- location
- environment
- background
- architecture
- room
- outdoor setting
- landscape
- composition
- framing
- crop
- camera
- lens
- lighting
- shadows
- spatial arrangement
- scene style

These MUST come from IMAGE 1.

=========================================================
DO NOT COPY IMAGE 1 CHARACTER IDENTITY
=========================================================

Do not use IMAGE 1 to determine:

- face
- facial structure
- skin identity
- hair
- hairstyle
- hair color
- hair texture
- hair length
- identity-defining physical characteristics

These MUST come from IMAGE 2.

=========================================================
ABSOLUTE HAIR RULE
=========================================================

"face_hair.hair"
=
IMAGE 2 ONLY.

Never use IMAGE 1 hair.

Never combine the two hairstyles.

Never use IMAGE 1 as fallback.

If IMAGE 1 and IMAGE 2 show different hair,
use IMAGE 2.

If IMAGE 2 hair is unclear,
write:

"not clearly visible in IMAGE 2"

=========================================================
ABSOLUTE LOCATION RULE
=========================================================

"environment"
=
IMAGE 1 ONLY.

"background"
=
IMAGE 1 ONLY.

"location"
=
IMAGE 1 ONLY.

If IMAGE 2 has a completely different location,
IGNORE IMAGE 2 location.

The final analysis MUST remain in IMAGE 1 location.

=========================================================
ABSOLUTE COMPOSITION RULE
=========================================================

"composition"
=
IMAGE 1 ONLY.

Do not convert IMAGE 1 composition into IMAGE 2
portrait composition.

=========================================================
ABSOLUTE POSE RULE
=========================================================

"pose"
=
IMAGE 1 ONLY.

Use the actual pose in the reference scene.

Do not use IMAGE 2 pose.

=========================================================
ABSOLUTE CAMERA AND LIGHTING RULE
=========================================================

"camera"
=
IMAGE 1 ONLY.

"lighting"
=
IMAGE 1 ONLY.

"shadows"
=
IMAGE 1 ONLY.

=========================================================
ABSOLUTE OUTFIT RULE
=========================================================

"clothing"
=
IMAGE 2 ONLY.

Do not import clothing from IMAGE 1.

Do not merge clothing.

=========================================================
FINAL CHECK
=========================================================

Before returning JSON, verify:

IMAGE 1:
scene
location
environment
background
composition
pose
camera
lighting
shadows
product
spatial relationships

IMAGE 2:
identity
face
hair
physical characteristics
clothing
outfit

If any scene field describes IMAGE 2,
correct it before returning JSON.
`

            : `
OUTFIT SOURCE:
${outfitLabel}

=========================================================
MANDATORY VISUAL TRANSFORMATION
=========================================================

IMAGE 1 = SCENE + OUTFIT PLATE
IMAGE 2 = CHARACTER IDENTITY PLATE

The final visual concept is:

IMAGE 2 CHARACTER
placed inside
IMAGE 1 SCENE
while keeping
IMAGE 1 OUTFIT.

=========================================================
IMAGE 1 MUST PROVIDE
=========================================================

Use IMAGE 1 ONLY for:

- location
- environment
- background
- architecture
- surfaces
- scene objects
- composition
- framing
- crop
- subject placement
- pose
- body position
- hand position
- head position in scene
- gaze direction in scene
- camera
- lens
- depth of field
- focus
- lighting
- shadows
- product
- spatial relationships
- clothing
- final outfit
- outfit-specific accessories
- scene visual style

=========================================================
IMAGE 2 MUST PROVIDE
=========================================================

Use IMAGE 2 ONLY for:

- character identity
- face
- facial structure
- eyes
- eyebrows
- nose
- lips
- skin
- physical characteristics
- hair
- hairstyle
- hair color
- hair texture
- hair length
- hair pattern
- braids
- curls
- waves
- twists
- locs
- bangs
- hairline
- head covering

=========================================================
DO NOT COPY IMAGE 2 SCENE
=========================================================

Ignore IMAGE 2:

- location
- environment
- background
- composition
- framing
- crop
- pose
- camera
- lighting
- shadows
- clothing

=========================================================
ABSOLUTE HAIR RULE
=========================================================

"face_hair.hair"
=
IMAGE 2 ONLY.

Never use IMAGE 1 hair.

Never merge hairstyles.

Never use IMAGE 1 as fallback.

=========================================================
FINAL CHECK
=========================================================

IMAGE 1:
scene + location + environment + background
+ composition + pose + camera + lighting
+ shadows + product + clothing

IMAGE 2:
identity + face + hair + physical characteristics

Correct any source leakage before returning JSON.
`;


    return `
Analyze the supplied image source(s) for GEN-Z.AI Vision.

=========================================================
IMAGE ROLE ASSIGNMENT
=========================================================

IMAGE 1 = REFERENCE IMAGE / SCENE PLATE

IMAGE 2 = REPLACEMENT CHARACTER / CHARACTER PLATE

IMAGE 1 is NOT interchangeable with IMAGE 2.

IMAGE 2 is NOT a second scene reference.

${outfitInstructions}

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
IMPORTANT:
DO NOT START BY DESCRIBING IMAGE 2 AS THE MAIN IMAGE.
=========================================================

The reference scene is always IMAGE 1.

Internally perform:

1. IMAGE 1 SCENE EXTRACTION.
2. LOCK IMAGE 1 SCENE.
3. IMAGE 2 CHARACTER EXTRACTION.
4. LOCK IMAGE 2 IDENTITY.
5. APPLY SELECTED OUTFIT SOURCE.
6. BUILD ONE COMBINED ANALYSIS.
7. PERFORM SOURCE AUDIT.
8. RETURN JSON.

=========================================================
REFERENCE SCENE EXTRACTION
=========================================================

First inspect IMAGE 1.

Determine:

- exact visible location
- indoor/outdoor status
- environment
- background
- architecture
- surfaces
- scene objects
- product
- product placement
- composition
- framing
- crop
- subject placement
- pose
- body position
- hand position
- head position
- gaze direction
- camera perspective
- lens characteristics
- depth of field
- focus
- lighting
- shadows
- spatial relationships
- scene colors
- visual style

These facts are locked to IMAGE 1.

Do NOT use IMAGE 2 to fill any of these.

=========================================================
CHARACTER EXTRACTION
=========================================================

Then inspect IMAGE 2.

Determine:

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

When character outfit is selected, also determine:

- clothing
- garment type
- colors
- materials
- patterns
- textures
- construction
- outfit layers
- outfit-specific accessories

These character facts are locked to IMAGE 2.

=========================================================
SOURCE MATRIX
=========================================================

SCENE:
IMAGE 1

LOCATION:
IMAGE 1

ENVIRONMENT:
IMAGE 1

BACKGROUND:
IMAGE 1

ARCHITECTURE:
IMAGE 1

COMPOSITION:
IMAGE 1

FRAMING:
IMAGE 1

CROP:
IMAGE 1

POSE:
IMAGE 1

BODY POSITION IN SCENE:
IMAGE 1

HAND POSITION:
IMAGE 1

CAMERA:
IMAGE 1

LENS:
IMAGE 1

DEPTH OF FIELD:
IMAGE 1

FOCUS:
IMAGE 1

LIGHTING:
IMAGE 1

SHADOWS:
IMAGE 1

PRODUCT:
IMAGE 1

PRODUCT PLACEMENT:
IMAGE 1

SPATIAL RELATIONSHIPS:
IMAGE 1

FACE:
IMAGE 2

IDENTITY:
IMAGE 2

SKIN:
IMAGE 2

PHYSICAL CHARACTERISTICS:
IMAGE 2

HAIR:
IMAGE 2

HAIR COLOR:
IMAGE 2

HAIR TEXTURE:
IMAGE 2

HAIR LENGTH:
IMAGE 2

HAIRSTYLE:
IMAGE 2

${outfitSource === "character"
    ? "CLOTHING:\nIMAGE 2"
    : "CLOTHING:\nIMAGE 1"}

=========================================================
HAIR FIELD SOURCE
=========================================================

The JSON field:

"face_hair.hair"

has exactly ONE source.

IMAGE 2.

No exceptions when IMAGE 2 exists.

Never copy:

- IMAGE 1 hair length
- IMAGE 1 hair color
- IMAGE 1 hair texture
- IMAGE 1 hairstyle
- IMAGE 1 waves
- IMAGE 1 curls
- IMAGE 1 braids
- IMAGE 1 twists
- IMAGE 1 locs
- IMAGE 1 bangs
- IMAGE 1 hairline

If IMAGE 2 shows short braided hair,
write short braided hair.

If IMAGE 2 shows long wavy hair,
write long wavy hair.

If IMAGE 2 shows curly hair,
write curly hair.

If IMAGE 2 hair is unclear,
write:

"not clearly visible in IMAGE 2"

Never substitute IMAGE 1.

=========================================================
SCENE FIELD SOURCE
=========================================================

The following MUST describe IMAGE 1:

"environment"

"background"

"composition"

"pose"

"camera"

"lighting"

"shadows"

"product"

"spatial_relationships"

These fields must remain faithful to IMAGE 1
even when IMAGE 2 is visually more detailed.

=========================================================
LOCATION PRESERVATION
=========================================================

The final analysis must preserve the actual location
shown in IMAGE 1.

If IMAGE 1 shows:

- bedroom
- office
- studio
- kitchen
- store
- street
- beach
- forest
- garden
- building
- urban area
- rural area
- indoor environment
- outdoor environment

use that location.

Do NOT replace it with the location visible
in IMAGE 2.

=========================================================
POSE PRESERVATION
=========================================================

The final scene pose comes from IMAGE 1.

IMAGE 2 pose is irrelevant to the scene pose.

If the character in IMAGE 2 has a different pose,
ignore that pose.

=========================================================
COMPOSITION PRESERVATION
=========================================================

The final composition comes from IMAGE 1.

If IMAGE 2 is a portrait:

DO NOT turn IMAGE 1 into a portrait.

If IMAGE 2 is close-up:

DO NOT turn IMAGE 1 into a close-up.

If IMAGE 1 is wide:

KEEP IMAGE 1 wide.

If IMAGE 1 is full-body:

KEEP IMAGE 1 full-body.

=========================================================
CAMERA PRESERVATION
=========================================================

Camera comes from IMAGE 1.

Do not use the apparent camera style
of IMAGE 2.

=========================================================
LIGHTING PRESERVATION
=========================================================

Lighting comes from IMAGE 1.

Do not use IMAGE 2 lighting.

=========================================================
ENVIRONMENT PRESERVATION
=========================================================

Environment comes from IMAGE 1.

Do not use IMAGE 2 environment.

=========================================================
BACKGROUND PRESERVATION
=========================================================

Background comes from IMAGE 1.

Do not use IMAGE 2 background.

=========================================================
PRODUCT PRESERVATION
=========================================================

Product information comes from IMAGE 1.

Never invent or import a product from IMAGE 2.

=========================================================
OUTFIT
=========================================================

${outfitSource === "character"
    ? `
FINAL OUTFIT:
IMAGE 2.

Ignore IMAGE 1 clothing.

Do not merge clothing.
`
    : `
FINAL OUTFIT:
IMAGE 1.

Ignore IMAGE 2 clothing.

Do not merge clothing.
`
}

=========================================================
VISUAL STYLE
=========================================================

Overall scene visual style:
IMAGE 1.

Character identity:
IMAGE 2.

Character clothing:
${outfitSource === "character"
    ? "IMAGE 2"
    : "IMAGE 1"}

=========================================================
FINAL TRANSFORMATION
=========================================================

The final analysis MUST conceptually describe:

IMAGE 1 SCENE
with
IMAGE 2 CHARACTER.

For CHARACTER outfit:

IMAGE 1:
scene + location + environment + background
+ composition + pose + camera + lighting
+ shadows + product + spatial relationships

IMAGE 2:
identity + face + hair + physical characteristics
+ clothing + outfit

For REFERENCE outfit:

IMAGE 1:
scene + location + environment + background
+ composition + pose + camera + lighting
+ shadows + product + spatial relationships
+ clothing + outfit

IMAGE 2:
identity + face + hair + physical characteristics

=========================================================
FINAL SOURCE AUDIT
=========================================================

Before returning the JSON:

VERIFY:

1. environment = IMAGE 1
2. background = IMAGE 1
3. location = IMAGE 1
4. composition = IMAGE 1
5. framing = IMAGE 1
6. crop = IMAGE 1
7. pose = IMAGE 1
8. camera = IMAGE 1
9. lighting = IMAGE 1
10. shadows = IMAGE 1
11. product = IMAGE 1
12. spatial relationships = IMAGE 1
13. face = IMAGE 2
14. identity = IMAGE 2
15. hair = IMAGE 2
16. physical characteristics = IMAGE 2
17. clothing = selected outfit source

If any field violates this matrix,
correct it before returning the JSON.

=========================================================
OUTPUT
=========================================================

Return ONLY the complete JSON object.

Do not return Markdown.

Do not explain.

Do not describe the images outside JSON.

Do not stop before closing all braces and arrays.

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
RETRY SOURCE CONTROL
=========================================================

THE PREVIOUS RESPONSE WAS INVALID OR INCOMPLETE.

REANALYZE THE SAME TWO IMAGE SOURCES.

IMAGE 1 = REFERENCE SCENE PLATE
IMAGE 2 = REPLACEMENT CHARACTER PLATE

DO NOT CHANGE THE IMAGE ROLES.

=========================================================
MANDATORY ORDER
=========================================================

FIRST:
Analyze IMAGE 1 as the scene.

LOCK:

- location
- environment
- background
- architecture
- composition
- framing
- crop
- pose
- body position
- hand position
- camera
- lens
- depth of field
- focus
- lighting
- shadows
- product
- product placement
- spatial relationships

SECOND:
Analyze IMAGE 2 as the character.

LOCK:

- identity
- face
- eyes
- eyebrows
- nose
- lips
- skin
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

${outfitSource === "character"
    ? `
THIRD:
Use IMAGE 2 clothing.

CLOTHING = IMAGE 2 ONLY.
`
    : `
THIRD:
Use IMAGE 1 clothing.

CLOTHING = IMAGE 1 ONLY.
`}

=========================================================
IMAGE 1 SCENE LOCK
=========================================================

The following MUST come from IMAGE 1:

environment
background
location
composition
framing
crop
pose
camera
lighting
shadows
product
spatial relationships

IMAGE 2 MUST NOT provide any of these.

=========================================================
IMAGE 2 IDENTITY LOCK
=========================================================

The following MUST come from IMAGE 2:

face
identity
skin
physical characteristics
hair
face_hair
head covering

IMAGE 1 MUST NOT provide any of these.

=========================================================
ABSOLUTE HAIR LOCK
=========================================================

"face_hair.hair"
=
IMAGE 2 ONLY.

Never use IMAGE 1 hair.

Never merge hair.

Never create hybrid hair.

Never use IMAGE 1 as fallback.

If IMAGE 2 hair is unclear:

"not clearly visible in IMAGE 2"

=========================================================
LOCATION LOCK
=========================================================

"environment"
=
IMAGE 1.

"background"
=
IMAGE 1.

"location"
=
IMAGE 1.

Even if IMAGE 2 shows a more obvious location,
IGNORE IMAGE 2 location.

=========================================================
COMPOSITION LOCK
=========================================================

"composition"
=
IMAGE 1.

If IMAGE 2 is a portrait and IMAGE 1 is wide,
KEEP IMAGE 1 wide.

=========================================================
POSE LOCK
=========================================================

"pose"
=
IMAGE 1.

Ignore IMAGE 2 pose.

=========================================================
CAMERA LOCK
=========================================================

"camera"
=
IMAGE 1.

Ignore IMAGE 2 camera.

=========================================================
LIGHTING LOCK
=========================================================

"lighting"
=
IMAGE 1.

"shadows"
=
IMAGE 1.

Ignore IMAGE 2 lighting.

=========================================================
OUTFIT LOCK
=========================================================

OUTFIT SOURCE =
${outfitSource === "character"
    ? "IMAGE 2"
    : "IMAGE 1"}

Never merge clothing.

=========================================================
FINAL TRANSFORMATION
=========================================================

The final analysis represents:

IMAGE 2 CHARACTER
inside
IMAGE 1 SCENE.

NOT:

IMAGE 2 SCENE
with
IMAGE 1 details.

=========================================================
FINAL SOURCE AUDIT
=========================================================

Before returning JSON, verify:

environment -> IMAGE 1
background -> IMAGE 1
location -> IMAGE 1
composition -> IMAGE 1
pose -> IMAGE 1
camera -> IMAGE 1
lighting -> IMAGE 1
shadows -> IMAGE 1
product -> IMAGE 1
spatial_relationships -> IMAGE 1
face -> IMAGE 2
hair -> IMAGE 2
identity -> IMAGE 2
physical characteristics -> IMAGE 2
clothing -> selected source

Correct every violation before output.

=========================================================
OUTPUT
=========================================================

Return ONLY the complete valid JSON object.

No Markdown.

No explanation.

No summary.
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

            sourceArchitecture:
                "IMAGE 1 SCENE PLATE + IMAGE 2 CHARACTER PLATE",

            sceneAuthority:
                "IMAGE 1",

            characterAuthority:
                hasReplacementCharacter
                    ? "IMAGE 2"
                    : "NONE",

            identityAuthority:
                hasReplacementCharacter
                    ? "IMAGE 2 ONLY"
                    : "IMAGE 1",

            hairAuthority:
                hasReplacementCharacter
                    ? "IMAGE 2 ONLY"
                    : "IMAGE 1",

            clothingAuthority:
                normalizedOutfitSource === "character"
                    ? "IMAGE 2"
                    : "IMAGE 1",

            locationAuthority:
                "IMAGE 1",

            environmentAuthority:
                "IMAGE 1",

            backgroundAuthority:
                "IMAGE 1",

            compositionAuthority:
                "IMAGE 1",

            poseAuthority:
                "IMAGE 1",

            cameraAuthority:
                "IMAGE 1",

            lightingAuthority:
                "IMAGE 1",

            productAuthority:
                "IMAGE 1",

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

                sceneAuthority:
                    "IMAGE 1 ONLY",

                locationAuthority:
                    "IMAGE 1 ONLY",

                environmentAuthority:
                    "IMAGE 1 ONLY",

                backgroundAuthority:
                    "IMAGE 1 ONLY",

                compositionAuthority:
                    "IMAGE 1 ONLY",

                poseAuthority:
                    "IMAGE 1 ONLY",

                cameraAuthority:
                    "IMAGE 1 ONLY",

                lightingAuthority:
                    "IMAGE 1 ONLY",

                identityAuthority:
                    hasReplacementCharacter
                        ? "IMAGE 2 ONLY"
                        : "IMAGE 1",

                hairAuthority:
                    hasReplacementCharacter
                        ? "IMAGE 2 ONLY"
                        : "IMAGE 1",

                clothingAuthority:
                    normalizedOutfitSource === "character"
                        ? "IMAGE 2 ONLY"
                        : "IMAGE 1 ONLY",

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

                sceneAuthority:
                    "IMAGE 1 ONLY",

                characterAuthority:
                    hasReplacementCharacter
                        ? "IMAGE 2 ONLY"
                        : "NONE",

                locationAuthority:
                    "IMAGE 1 ONLY",

                environmentAuthority:
                    "IMAGE 1 ONLY",

                backgroundAuthority:
                    "IMAGE 1 ONLY",

                compositionAuthority:
                    "IMAGE 1 ONLY",

                poseAuthority:
                    "IMAGE 1 ONLY",

                cameraAuthority:
                    "IMAGE 1 ONLY",

                lightingAuthority:
                    "IMAGE 1 ONLY",

                productAuthority:
                    "IMAGE 1 ONLY",

                hairAuthority:
                    hasReplacementCharacter
                        ? "IMAGE 2 ONLY"
                        : "IMAGE 1",

                clothingAuthority:
                    normalizedOutfitSource === "character"
                        ? "IMAGE 2 ONLY"
                        : "IMAGE 1 ONLY",

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


            /*
             * =================================================
             * SOURCE-LOCK DIAGNOSTIC
             * =================================================
             *
             * Tidak mengubah hasil.
             * Hanya membantu memastikan field penting
             * yang dikembalikan model dapat diperiksa
             * langsung dari console.
             */

            if (
                lastQuality?.parsed
            ) {

                const parsedAnalysis =
                    lastQuality.parsed;


                const parsedHair =
                    parsedAnalysis
                        ?.face_hair
                        ?.hair ??
                    null;


                const parsedEnvironment =
                    parsedAnalysis
                        ?.environment ??
                    null;


                const parsedBackground =
                    parsedAnalysis
                        ?.background ??
                    null;


                const parsedComposition =
                    parsedAnalysis
                        ?.composition ??
                    null;


                const parsedPose =
                    parsedAnalysis
                        ?.pose ??
                    null;


                const parsedCamera =
                    parsedAnalysis
                        ?.camera ??
                    null;


                const parsedLighting =
                    parsedAnalysis
                        ?.lighting ??
                    null;


                const parsedClothing =
                    parsedAnalysis
                        ?.clothing ??
                    null;


                console.info(
                    "[GEN-Z.AI Vision] Source-lock diagnostic:",
                    {

                        attempt,

                        outfitSource:
                            normalizedOutfitSource,

                        sceneAuthority:
                            "IMAGE 1 ONLY",

                        characterAuthority:
                            hasReplacementCharacter
                                ? "IMAGE 2 ONLY"
                                : "IMAGE 1",

                        locationAuthority:
                            "IMAGE 1 ONLY",

                        environmentAuthority:
                            "IMAGE 1 ONLY",

                        backgroundAuthority:
                            "IMAGE 1 ONLY",

                        compositionAuthority:
                            "IMAGE 1 ONLY",

                        poseAuthority:
                            "IMAGE 1 ONLY",

                        cameraAuthority:
                            "IMAGE 1 ONLY",

                        lightingAuthority:
                            "IMAGE 1 ONLY",

                        hairAuthority:
                            hasReplacementCharacter
                                ? "IMAGE 2 ONLY"
                                : "IMAGE 1",

                        clothingAuthority:
                            normalizedOutfitSource ===
                                "character"
                                ? "IMAGE 2 ONLY"
                                : "IMAGE 1 ONLY",

                        hair:
                            parsedHair,

                        environment:
                            parsedEnvironment,

                        background:
                            parsedBackground,

                        composition:
                            parsedComposition,

                        pose:
                            parsedPose,

                        camera:
                            parsedCamera,

                        lighting:
                            parsedLighting,

                        clothing:
                            parsedClothing

                    }
                );

            }


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

                    sceneAuthority:
                        "IMAGE 1 ONLY",

                    characterAuthority:
                        hasReplacementCharacter
                            ? "IMAGE 2 ONLY"
                            : "NONE",

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

            sourceArchitecture:
                "IMAGE 1 SCENE PLATE + IMAGE 2 CHARACTER PLATE",

            sceneAuthority:
                "IMAGE 1 ONLY",

            characterAuthority:
                hasReplacementCharacter
                    ? "IMAGE 2 ONLY"
                    : "NONE",

            locationAuthority:
                "IMAGE 1 ONLY",

            environmentAuthority:
                "IMAGE 1 ONLY",

            backgroundAuthority:
                "IMAGE 1 ONLY",

            compositionAuthority:
                "IMAGE 1 ONLY",

            poseAuthority:
                "IMAGE 1 ONLY",

            cameraAuthority:
                "IMAGE 1 ONLY",

            lightingAuthority:
                "IMAGE 1 ONLY",

            productAuthority:
                "IMAGE 1 ONLY",

            hairAuthority:
                hasReplacementCharacter
                    ? "IMAGE 2 ONLY"
                    : "IMAGE 1",

            clothingAuthority:
                normalizedOutfitSource === "character"
                    ? "IMAGE 2 ONLY"
                    : "IMAGE 1 ONLY",

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

                sourceArchitecture:
                    "IMAGE 1 SCENE PLATE + IMAGE 2 CHARACTER PLATE",

                referenceAuthority:
                    "IMAGE 1 ONLY",

                characterAuthority:
                    hasReplacementCharacter
                        ? "IMAGE 2 ONLY"
                        : "NONE",

                locationAuthority:
                    "IMAGE 1 ONLY",

                environmentAuthority:
                    "IMAGE 1 ONLY",

                backgroundAuthority:
                    "IMAGE 1 ONLY",

                compositionAuthority:
                    "IMAGE 1 ONLY",

                poseAuthority:
                    "IMAGE 1 ONLY",

                cameraAuthority:
                    "IMAGE 1 ONLY",

                lightingAuthority:
                    "IMAGE 1 ONLY",

                productAuthority:
                    "IMAGE 1 ONLY",

                hairAuthority:
                    hasReplacementCharacter
                        ? "IMAGE 2 ONLY"
                        : "IMAGE 1",

                clothingAuthority:
                    normalizedOutfitSource === "character"
                        ? "IMAGE 2 ONLY"
                        : "IMAGE 1 ONLY",

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
