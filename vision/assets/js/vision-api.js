//vision-api.js?v=1.6
/* =========================================================
   GEN-Z.AI VISION
   ---------------------------------------------------------
   File:
   vision/assets/js/vision-api.js

   Fungsi:
   - Komunikasi dengan /api/openkey-chat
   - Mengambil katalog model OpenKey
   - Memilih model Vision yang benar-benar tersedia
   - Mengirim multimodal image + text
   - Menjalankan Vision Analysis
   - Menjalankan Prompt Engineering
   - Menormalisasi response API
   - Mendukung berbagai bentuk response OpenKey
   - Tidak mengatur DOM
   - Tidak memotong credit
   - Tidak menyimpan history
   - Tidak menyimpan API key di browser

   PERBAIKAN v1.6:
   - Vision analysis dibuat lebih detail
   - Tidak membiarkan analysis terlalu pendek
   - Analysis tetap terstruktur JSON
   - Parser JSON lebih toleran
   - Response OpenKey lebih fleksibel
   - Prompt engineering menerima analysis lengkap
   - Debug analysis diperjelas
   - Tidak mengubah credit / history / DOM / event
========================================================= */


/* =========================================================
   CONFIGURATION
========================================================= */

const VISION_API_CONFIG = Object.freeze({

    endpoint:
        "/api/openkey-chat",

    timeout:
        120000,

    analysisTemperature:
        0.2,

    promptTemperature:
        0.35,

    maxAnalysisTokens:
        5000,

    maxPromptTokens:
        5000,

    /*
     * Analysis yang hanya beberapa ratus karakter
     * tidak cukup untuk membangun prompt visual.
     *
     * Nilai ini bukan target panjang wajib.
     * Ini hanya safety guard agar response yang jelas
     * terlalu pendek tidak diteruskan ke Prompt Engineering.
     */

    minAnalysisCharacters:
        500

});


/* =========================================================
   OPENKEY VISION CAPABILITY POLICY
========================================================= */

const OPENKEY_VISION_MODEL_IDS =
    Object.freeze(
        new Set([

            "grok-4.5",

            "grok-4.6",

            "qwen3-vl-max"

        ])
    );


/* =========================================================
   INTERNAL HELPERS
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
   SESSION
========================================================= */

async function getAccessToken() {

    if (
        !window.supabaseClient
    ) {

        throw new Error(
            "Supabase client belum tersedia."
        );

    }


    const result =
        await window.supabaseClient.auth.getSession();


    if (
        result?.error
    ) {

        throw result.error;

    }


    const session =
        result?.data?.session ||
        null;


    if (
        !session?.access_token
    ) {

        const error =
            new Error(
                "Session pengguna tidak tersedia."
            );


        error.code =
            "AUTH_REQUIRED";


        throw error;

    }


    return session.access_token;

}


/* =========================================================
   ABORT / TIMEOUT
========================================================= */

function createTimeoutController(
    timeout
) {

    const controller =
        new AbortController();


    const timer =
        setTimeout(
            () => {

                controller.abort();

            },
            timeout
        );


    return {

        controller,

        clear:
            () => clearTimeout(
                timer
            )

    };

}


/* =========================================================
   REQUEST ERROR
========================================================= */

function createAPIError(
    message,
    options = {}
) {

    const error =
        new Error(
            message
        );


    error.name =
        "VisionAPIError";


    if (
        options.code
    ) {

        error.code =
            options.code;

    }


    if (
        options.status
    ) {

        error.status =
            options.status;

    }


    if (
        options.data
    ) {

        error.data =
            options.data;

    }


    return error;

}


/* =========================================================
   PARSE RESPONSE
========================================================= */

async function parseResponse(
    response
) {

    const text =
        await response.text();


    if (
        !text
    ) {

        return {};

    }


    try {

        return JSON.parse(
            text
        );

    }
    catch {

        return {

            raw:
                text

        };

    }

}


/* =========================================================
   API REQUEST
========================================================= */

async function request(
    body,
    options = {}
) {

    const token =
        await getAccessToken();


    const timeout =
        Number(
            options.timeout ||
            VISION_API_CONFIG.timeout
        );


    const {
        controller,
        clear
    } =
        createTimeoutController(
            timeout
        );


    try {

        const response =
            await fetch(
                VISION_API_CONFIG.endpoint,
                {

                    method:
                        "POST",

                    headers: {

                        "Content-Type":
                            "application/json",

                        Authorization:
                            `Bearer ${token}`

                    },

                    body:
                        JSON.stringify(
                            body
                        ),

                    signal:
                        controller.signal

                }
            );


        const data =
            await parseResponse(
                response
            );


        if (
            !response.ok
        ) {

            throw createAPIError(

                data?.error ||
                data?.message ||
                `Vision API request gagal (${response.status}).`,

                {

                    code:
                        data?.code ||
                        "VISION_API_REQUEST_FAILED",

                    status:
                        response.status,

                    data

                }

            );

        }


        if (
            data?.success === false
        ) {

            throw createAPIError(

                data.error ||
                data.message ||
                "Vision API mengembalikan error.",

                {

                    code:
                        data.code ||
                        "VISION_API_FAILED",

                    status:
                        response.status,

                    data

                }

            );

        }


        return data;

    }
    catch (error) {

        if (
            error?.name ===
            "AbortError"
        ) {

            throw createAPIError(

                "Vision API timeout. Proses membutuhkan waktu terlalu lama.",

                {

                    code:
                        "VISION_API_TIMEOUT"

                }

            );

        }


        throw error;

    }
    finally {

        clear();

    }

}


/* =========================================================
   OPENKEY MODEL CATALOG
========================================================= */

async function getOpenKeyModels(
    options = {}
) {

    const response =
        await request(

            {

                operation:
                    "openkey_models"

            },

            {

                timeout:
                    options.timeout ||
                    VISION_API_CONFIG.timeout

            }

        );


    if (
        !response?.success
    ) {

        throw createAPIError(

            response?.error ||
            "Katalog model OpenKey tidak tersedia.",

            {

                code:
                    response?.code ||
                    "OPENKEY_MODELS_UNAVAILABLE",

                status:
                    response?.status ||
                    null,

                data:
                    response

            }

        );

    }


    const models =
        Array.isArray(
            response.models
        )
            ? response.models
            : [];


    if (
        models.length === 0
    ) {

        throw createAPIError(

            "OpenKey tidak mengembalikan daftar model.",

            {

                code:
                    "OPENKEY_MODELS_EMPTY",

                data:
                    response

            }

        );

    }


    console.info(
        "[GEN-Z.AI Vision] OpenKey catalog received:",
        models.map(
            model => ({

                id:
                    model?.model_id ||
                    model?.id ||
                    null,

                name:
                    model?.model_name ||
                    model?.name ||
                    null,

                input_modalities:
                    model?.input_modalities ||
                    null,

                output_modalities:
                    model?.output_modalities ||
                    null,

                capabilities:
                    model?.capabilities ||
                    null,

                modality:
                    model?.modality ||
                    null,

                modalities:
                    model?.modalities ||
                    null,

                architecture:
                    model?.architecture ||
                    null,

                raw:
                    model

            })
        )
    );


    return models;

}


/* =========================================================
   VALUE TO MODALITY LIST
========================================================= */

function collectModalityValues(
    value,
    result = []
) {

    if (
        value === null ||
        value === undefined
    ) {

        return result;

    }


    if (
        Array.isArray(value)
    ) {

        value.forEach(
            item => {

                collectModalityValues(
                    item,
                    result
                );

            }
        );


        return result;

    }


    if (
        typeof value === "string"
    ) {

        const normalized =
            value
                .trim()
                .toLowerCase();


        if (
            normalized
        ) {

            result.push(
                normalized
            );

        }


        return result;

    }


    if (
        typeof value === "boolean"
    ) {

        result.push(
            value
                ? "true"
                : "false"
        );


        return result;

    }


    if (
        typeof value === "object"
    ) {

        Object.entries(
            value
        )
            .forEach(
                (
                    [
                        key,
                        item
                    ]
                ) => {

                    const normalizedKey =
                        String(
                            key
                        )
                            .trim()
                            .toLowerCase();


                    if (
                        normalizedKey
                    ) {

                        result.push(
                            normalizedKey
                        );

                    }


                    if (
                        item === true
                    ) {

                        result.push(
                            normalizedKey
                        );

                    }
                    else {

                        collectModalityValues(
                            item,
                            result
                        );

                    }

                }
            );

    }


    return result;

}


/* =========================================================
   GET MODEL CAPABILITIES
========================================================= */

function getModelCapabilities(
    model
) {

    if (
        !model ||
        typeof model !==
            "object"
    ) {

        return [];

    }


    const values = [];


    collectModalityValues(
        model.input_modalities,
        values
    );


    collectModalityValues(
        model.inputModalities,
        values
    );


    collectModalityValues(
        model.modalities,
        values
    );


    collectModalityValues(
        model.modality,
        values
    );


    collectModalityValues(
        model.capabilities,
        values
    );


    collectModalityValues(
        model.architecture,
        values
    );


    if (
        model.raw &&
        typeof model.raw ===
            "object"
    ) {

        collectModalityValues(
            model.raw.input_modalities,
            values
        );


        collectModalityValues(
            model.raw.inputModalities,
            values
        );


        collectModalityValues(
            model.raw.modalities,
            values
        );


        collectModalityValues(
            model.raw.modality,
            values
        );


        collectModalityValues(
            model.raw.capabilities,
            values
        );


        collectModalityValues(
            model.raw.architecture,
            values
        );

    }


    return [
        ...new Set(
            values
                .map(
                    value =>
                        String(
                            value
                        )
                            .trim()
                            .toLowerCase()
                )
                .filter(Boolean)
        )
    ];

}


/* =========================================================
   OPENKEY DOCUMENTED VISION CHECK
========================================================= */

function isOpenKeyDocumentedVisionModel(
    model
) {

    if (
        !model ||
        typeof model !==
            "object"
    ) {

        return false;

    }


    const id =
        String(
            model.model_id ||
            model.id ||
            ""
        )
            .trim()
            .toLowerCase();


    if (
        !id
    ) {

        return false;

    }


    return OPENKEY_VISION_MODEL_IDS.has(
        id
    );

}


/* =========================================================
   NORMALIZE MODEL
========================================================= */

function normalizeVisionModel(
    model
) {

    if (
        !model ||
        typeof model !==
            "object"
    ) {

        return null;

    }


    const id =
        String(
            model.model_id ||
            model.id ||
            ""
        ).trim();


    if (
        !id
    ) {

        return null;

    }


    const name =
        String(
            model.model_name ||
            model.name ||
            id
        ).trim();


    const explicitInputModalities = [

        ...(
            Array.isArray(
                model.input_modalities
            )
                ? model.input_modalities
                : []
        ),

        ...(
            Array.isArray(
                model.inputModalities
            )
                ? model.inputModalities
                : []
        )

    ]
        .map(
            value =>
                String(
                    value || ""
                )
                    .trim()
                    .toLowerCase()
        )
        .filter(Boolean);


    const outputModalities = [

        ...(
            Array.isArray(
                model.output_modalities
            )
                ? model.output_modalities
                : []
        ),

        ...(
            Array.isArray(
                model.outputModalities
            )
                ? model.outputModalities
                : []
        )

    ]
        .map(
            value =>
                String(
                    value || ""
                )
                    .trim()
                    .toLowerCase()
        )
        .filter(Boolean);


    const capabilities =
        getModelCapabilities(
            model
        );


    const inputModalities = [

        ...new Set([

            ...explicitInputModalities,

            ...capabilities

        ])

    ];


    return {

        ...model,

        id,

        model_id:
            id,

        name,

        model_name:
            name,

        input_modalities:
            inputModalities,

        output_modalities:
            [
                ...new Set(
                    outputModalities
                )
            ],

        capabilities

    };

}


/* =========================================================
   IMAGE INPUT DETECTION
========================================================= */

function supportsImageInput(
    model
) {

    const normalized =
        normalizeVisionModel(
            model
        );


    if (
        !normalized
    ) {

        return false;

    }


    const modalities =
        new Set([

            ...normalized.input_modalities,

            ...normalized.capabilities

        ]);


    const imageIndicators = [

        "image",

        "images",

        "vision",

        "multimodal",

        "multimodal_input",

        "image_url",

        "image-input",

        "image_input",

        "visual",

        "visual_input"

    ];


    if (
        imageIndicators.some(
            indicator =>
                modalities.has(
                    indicator
                )
        )
    ) {

        return true;

    }


    if (
        isOpenKeyDocumentedVisionModel(
            normalized
        )
    ) {

        return true;

    }


    return false;

}


/* =========================================================
   RESOLVE VISION MODEL
========================================================= */

async function resolveVisionModel(
    requestedModel = null,
    options = {}
) {

    const models =
        await getOpenKeyModels(
            options
        );


    const normalizedModels =
        models
            .map(
                normalizeVisionModel
            )
            .filter(
                Boolean
            );


    console.info(
        "[GEN-Z.AI Vision] Normalized OpenKey models:",
        normalizedModels.map(
            model => ({

                id:
                    model.id,

                name:
                    model.name,

                input_modalities:
                    model.input_modalities,

                capabilities:
                    model.capabilities,

                supports_image:
                    supportsImageInput(
                        model
                    ),

                openkey_documented_vision:
                    isOpenKeyDocumentedVisionModel(
                        model
                    )

            })
        )
    );


    if (
        normalizedModels.length ===
        0
    ) {

        throw createAPIError(

            "Tidak ada model valid yang dikembalikan OpenKey.",

            {

                code:
                    "OPENKEY_NO_VALID_MODELS",

                data:
                    models

            }

        );

    }


    const requested =
        normalizeVisionModel(
            requestedModel
        );


    if (
        requested &&
        supportsImageInput(
            requested
        )
    ) {

        const exact =
            normalizedModels.find(

                model =>

                    model.id.toLowerCase() ===
                    requested.id.toLowerCase()

            );


        if (
            exact
        ) {

            return exact;

        }

    }


    const visionModels =
        normalizedModels.filter(
            supportsImageInput
        );


    if (
        visionModels.length ===
        0
    ) {

        throw createAPIError(

            "OpenKey tidak menyediakan model dengan dukungan input gambar.",

            {

                code:
                    "OPENKEY_NO_VISION_MODEL",

                data: {

                    models:
                        normalizedModels.map(
                            model => ({

                                id:
                                    model.id,

                                name:
                                    model.name,

                                input_modalities:
                                    model.input_modalities,

                                capabilities:
                                    model.capabilities,

                                openkey_documented_vision:
                                    isOpenKeyDocumentedVisionModel(
                                        model
                                    ),

                                raw:
                                    model.raw ||
                                    null

                            })
                        )

                }

            }

        );

    }


    const selected =
        visionModels[0];


    const state =
        getState();


    if (
        typeof state.setModel ===
        "function"
    ) {

        state.setModel(
            selected
        );

    }


    console.info(
        "[GEN-Z.AI Vision] Vision model selected:",
        {

            id:
                selected.id,

            name:
                selected.name,

            input_modalities:
                selected.input_modalities,

            capabilities:
                selected.capabilities,

            openkey_documented_vision:
                isOpenKeyDocumentedVisionModel(
                    selected
                )

        }
    );


    return selected;

}


/* =========================================================
   BUILD IMAGE MESSAGE
========================================================= */

function buildImageMessage(
    text,
    dataUrl
) {

    if (
        typeof dataUrl !==
            "string" ||
        !dataUrl.startsWith(
            "data:image/"
        )
    ) {

        throw createAPIError(

            "Reference image tidak valid.",

            {

                code:
                    "INVALID_REFERENCE_IMAGE"

            }

        );

    }


    return [

        {

            type:
                "text",

            text:
                String(
                    text ||
                    ""
                )

        },

        {

            type:
                "image_url",

            image_url: {

                url:
                    dataUrl

            }

        }

    ];

}


/* =========================================================
   MODEL INFORMATION
========================================================= */

function getSelectedModel() {

    const state =
        getState();


    return state.get(
        "model",
        null
    );

}


/* =========================================================
   ANALYSIS SYSTEM PROMPT
   ---------------------------------------------------------
   IMPORTANT:
   Jangan membuat instruksi analysis terlalu pendek.

   Model Vision harus terlebih dahulu melakukan pekerjaan
   visual secara lengkap sebelum hasilnya dikirim ke
   Prompt Engineering.
========================================================= */

function buildAnalysisSystemPrompt() {

    return `
You are the visual analysis engine of GEN-Z.AI Vision.

You are looking at an actual reference image supplied together with this request.

Your job is to inspect the image itself and extract detailed, observable visual information.

Do NOT generate the final image-generation prompt yet.

Do NOT refuse simply because some information is unavailable.

Do NOT say that visual details were not provided unless the image itself is genuinely unavailable.

The image is the primary source of truth.

Analyze the image carefully before producing your response.

Your analysis must contain enough concrete visual information for another AI system to reconstruct the same scene.

Analyze the following categories in detail.

1. SUBJECT
- number of visible subjects
- subject type
- approximate apparent age range when visually reasonable
- apparent gender presentation when visually apparent
- body position
- subject placement
- orientation relative to camera

2. PHYSICAL APPEARANCE
- skin tone when visible
- body build when visually apparent
- visible facial structure
- visible distinguishing physical characteristics
- proportions when visually apparent

3. FACE AND HAIR
- face shape
- hairstyle
- hair length
- hair color
- hair texture
- hair direction
- bangs or other visible styling
- eyes
- eyebrows
- nose
- lips
- visible makeup
- facial expression
- gaze direction

4. POSE
- standing / sitting / walking / leaning / other
- head position
- torso orientation
- shoulder position
- arm position
- elbow position
- hand position
- finger position when visible
- leg position
- foot position
- interaction with objects
- body orientation toward or away from camera

5. CLOTHING
Describe every clearly visible garment.

Include:
- garment type
- color
- material
- texture
- pattern
- fit
- sleeve length
- neckline
- collar
- buttons
- seams
- visible logos
- visible prints
- lower-body clothing
- footwear
- visible layering

6. ACCESSORIES
Identify visible:
- jewelry
- glasses
- watches
- hats
- bags
- belts
- hair accessories
- other wearable accessories

7. PRODUCT OR MAIN OBJECT
If the image contains a product or important object:
- identify what is visibly present
- shape
- color
- material
- size relative to subject
- orientation
- position
- visible branding
- visible text
- interaction with subject

Never invent a product model if it cannot be identified.

8. ENVIRONMENT
Describe:
- indoor / outdoor
- location type
- architecture
- furniture
- surfaces
- walls
- floor
- ceiling
- windows
- doors
- plants
- props
- background objects
- foreground objects
- environmental context

9. COMPOSITION
Describe:
- subject position in frame
- left / center / right placement
- foreground / middle ground / background
- negative space
- symmetry or asymmetry
- major visual balance
- relationship between subject and environment

10. FRAMING
Describe:
- close-up
- medium shot
- medium-full shot
- full-body
- wide shot
- other appropriate framing
- amount of visible body
- crop boundaries

11. CAMERA
Describe only visually supported characteristics:
- camera height
- camera angle
- front / side / rear / three-quarter view
- eye-level / low-angle / high-angle
- perspective
- apparent lens character
- apparent focal-length feel
- distortion if visible

Do not invent an exact focal length when it cannot be determined.

12. DEPTH OF FIELD
Describe:
- foreground focus
- subject focus
- background focus
- background blur
- bokeh
- apparent depth separation

13. LIGHTING
Describe:
- primary light direction
- light source when visible
- natural / artificial
- soft / hard
- warm / cool
- highlights
- shadows
- shadow direction
- rim light if visible
- reflections
- exposure
- contrast

14. COLOR
Describe:
- dominant colors
- secondary colors
- background colors
- clothing colors
- object colors
- overall palette
- warm / cool character
- contrast
- saturation

15. VISUAL STYLE
Describe what is actually visible:
- photorealistic
- cinematic
- commercial
- editorial
- lifestyle
- studio
- documentary
- illustrative
- other observable characteristics

Do not invent a style that is not visually supported.

16. TEXT AND BRANDING
Transcribe clearly visible text when readable.

If text cannot be read:
- say "text present but unreadable"

Identify visible logos or branding only when actually visible.

17. IMAGE QUALITY
Describe:
- sharpness
- focus quality
- visible noise
- compression
- resolution appearance
- detail level
- photographic characteristics

18. IMPORTANT VISUAL RELATIONSHIPS
Explain spatial relationships between:
- subject and product
- subject and background
- hands and objects
- body and camera
- foreground and background
- light and subject

19. UNCERTAINTY
List details that genuinely cannot be determined.

IMPORTANT RULES:

- The reference image itself is the source of truth.
- Describe visible information, not assumptions.
- Do not invent hidden information.
- Do not invent exact camera settings.
- Do not invent exact product specifications.
- Do not identify a real person.
- Do not infer private identity.
- Do not replace missing information with generic filler.
- Preserve spatial relationships.
- Preserve pose.
- Preserve composition.
- Preserve lighting.
- Preserve environment.
- Preserve clothing.
- Preserve visible product details.
- Preserve visible branding and text.
- Be detailed.

Return valid JSON only.

Use this structure:

{
  "subject": {
    "count": null,
    "type": "",
    "age_range": "",
    "gender_presentation": "",
    "position": "",
    "orientation": ""
  },
  "appearance": {
    "skin_tone": "",
    "body_build": "",
    "visible_features": []
  },
  "face_hair": {
    "face_shape": "",
    "hair_style": "",
    "hair_length": "",
    "hair_color": "",
    "hair_texture": "",
    "eyes": "",
    "eyebrows": "",
    "nose": "",
    "lips": "",
    "makeup": "",
    "expression": "",
    "gaze": ""
  },
  "pose": {
    "overall": "",
    "head": "",
    "torso": "",
    "shoulders": "",
    "arms": "",
    "hands": "",
    "legs": "",
    "feet": "",
    "interaction": ""
  },
  "clothing": {
    "upper_body": "",
    "lower_body": "",
    "outerwear": "",
    "footwear": "",
    "materials": [],
    "colors": [],
    "patterns": [],
    "visible_details": []
  },
  "accessories": [],
  "product": {
    "present": false,
    "description": "",
    "position": "",
    "orientation": "",
    "visible_branding": "",
    "visible_text": ""
  },
  "composition": {
    "subject_placement": "",
    "foreground": "",
    "middle_ground": "",
    "background": "",
    "negative_space": "",
    "visual_balance": ""
  },
  "framing": {
    "shot_type": "",
    "crop": "",
    "body_visibility": ""
  },
  "camera": {
    "angle": "",
    "height": "",
    "viewpoint": "",
    "perspective": "",
    "lens_feel": ""
  },
  "depth_of_field": {
    "focus": "",
    "background_blur": "",
    "separation": ""
  },
  "lighting": {
    "direction": "",
    "source": "",
    "quality": "",
    "temperature": "",
    "highlights": "",
    "shadows": "",
    "contrast": ""
  },
  "environment": {
    "location_type": "",
    "indoor_outdoor": "",
    "architecture": "",
    "furniture": [],
    "objects": [],
    "surfaces": "",
    "background_details": []
  },
  "color_palette": [],
  "visual_style": {
    "style": "",
    "mood": "",
    "realism": "",
    "texture": ""
  },
  "text_branding": [],
  "image_quality": {
    "sharpness": "",
    "focus_quality": "",
    "noise": "",
    "compression": "",
    "detail": ""
  },
  "important_details": [],
  "spatial_relationships": [],
  "uncertainties": []
}

Return the JSON only.
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
Analyze the attached reference image directly.

This is the actual REFERENCE IMAGE for GEN-Z.AI Vision.

The image has been attached as an image input in this request.

Inspect the visual content before answering.

Analysis detail level:
${detail}

Intended purpose:
${purpose}

Additional user instruction:
${instruction || "None"}

IMPORTANT:

Do not respond with a generic statement such as:
"No visual details were provided."

The visual details are contained in the attached reference image.

If a particular detail is not visible, mark that specific field as unknown or null, but continue analyzing every other visible part of the image.

Provide a detailed structured visual analysis according to the system schema.

Return valid JSON only.
`.trim();

}


/* =========================================================
   VALIDATE ANALYSIS QUALITY
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

            length:
                0,

            reason:
                "Vision model mengembalikan analysis kosong."

        };

    }


    const lower =
        normalized
            .toLowerCase();


    /*
     * Beberapa refusal generik yang menandakan
     * model tidak melakukan visual analysis.
     */

    const refusalPatterns = [

        "no visual details were provided",

        "no visual information was provided",

        "cannot analyze the image",

        "cannot see the image",

        "image was not provided",

        "image is not provided",

        "visual details were not provided",

        "visual information was not provided"

    ];


    const looksLikeRefusal =
        refusalPatterns.some(
            phrase =>
                lower.includes(
                    phrase
                )
        );


    if (
        looksLikeRefusal
    ) {

        return {

            valid:
                false,

            length:
                normalized.length,

            reason:
                "Vision model tidak melakukan analisis terhadap reference image."

        };

    }


    const minimum =
        VISION_API_CONFIG
            .minAnalysisCharacters;


    if (
        normalized.length <
        minimum
    ) {

        return {

            valid:
                false,

            length:
                normalized.length,

            reason:
                `Analysis terlalu pendek (${normalized.length} karakter). Minimum ${minimum} karakter.`

        };

    }


    return {

        valid:
            true,

        length:
            normalized.length,

        reason:
            null

    };

}


/* =========================================================
   RUN VISION ANALYSIS
========================================================= */

async function analyzeImage(
    options = {}
) {

    const state =
        getState();


    const file =
        state.get(
            "file",
            null
        );


    if (
        !file?.dataUrl
    ) {

        throw createAPIError(

            "Reference image belum tersedia.",

            {

                code:
                    "REFERENCE_IMAGE_REQUIRED"

            }

        );

    }


    const requestedModel =
        options.model ||
        getSelectedModel();


    const model =
        await resolveVisionModel(
            requestedModel,
            options
        );


    const settings =
        options.settings ||
        state.get(
            "settings",
            {}
        );


    const analysisSystemPrompt =
        buildAnalysisSystemPrompt();


    const analysisUserPrompt =
        buildAnalysisUserPrompt(
            settings
        );


    const imageMessage =
        buildImageMessage(

            analysisUserPrompt,

            file.dataUrl

        );


    /*
     * Pastikan multimodal message benar-benar
     * memiliki text + image.
     */

    console.info(
        "[GEN-Z.AI Vision] Sending vision-analysis request:",
        {

            model:
                model.id,

            messageCount:
                2,

            contentParts:
                imageMessage.length,

            hasText:
                imageMessage.some(
                    part =>
                        part?.type ===
                        "text"
                ),

            hasImage:
                imageMessage.some(
                    part =>
                        part?.type ===
                        "image_url"
                ),

            imageMime:
                typeof file.dataUrl ===
                "string"
                    ? file.dataUrl
                        .split(";")[0]
                    : null,

            imageDataLength:
                typeof file.dataUrl ===
                "string"
                    ? file.dataUrl.length
                    : 0

        }
    );


    const messages = [

        {

            role:
                "system",

            content:
                analysisSystemPrompt

        },

        {

            role:
                "user",

            content:
                imageMessage

        }

    ];


    const response =
        await request(

            {

                model:
                    model.id,

                messages,

                temperature:
                    VISION_API_CONFIG
                        .analysisTemperature,

                max_tokens:
                    VISION_API_CONFIG
                        .maxAnalysisTokens,

                stream:
                    false

            },

            {

                timeout:
                    options.timeout ||
                    VISION_API_CONFIG.timeout

            }

        );


    /*
     * Debug response analysis.
     */

    console.info(
        "[GEN-Z.AI Vision] Vision-analysis response:",
        sanitizeResponseForDebug(
            response
        )
    );


    const text =
        extractAssistantText(
            response
        );


    const quality =
        validateAnalysisQuality(
            text
        );


    console.info(
        "[GEN-Z.AI Vision] Vision-analysis result:",
        {

            length:
                quality.length,

            valid:
                quality.valid,

            reason:
                quality.reason

        }
    );


    if (
        !quality.valid
    ) {

        throw createAPIError(

            quality.reason ||
            "Vision model tidak mengembalikan hasil analisis yang cukup.",

            {

                code:
                    quality.length === 0
                        ? "EMPTY_ANALYSIS_RESPONSE"
                        : "INSUFFICIENT_ANALYSIS_RESPONSE",

                data:
                    response

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
   PROMPT ENGINEERING SYSTEM PROMPT
========================================================= */

function buildPromptSystemPrompt() {

    return `
You are the prompt engineering engine of GEN-Z.AI Vision.

Convert the supplied structured visual analysis into ONE high-quality, ultra-detailed production-ready image-generation prompt.

The visual analysis was created from an actual reference image.

Your job is to preserve the visual characteristics of that reference image as accurately as possible.

The final prompt must preserve, when available:

- number of subjects
- subject placement
- physical appearance
- face and hair
- pose
- body position
- facial expression
- gaze
- clothing
- accessories
- product
- object relationships
- composition
- framing
- camera angle
- viewpoint
- perspective
- lens feel
- depth of field
- lighting
- shadows
- environment
- background
- color palette
- visual style
- realism
- texture
- image quality
- visible text
- visible branding

IMPORTANT:

- Do not invent unsupported visual details.
- Do not replace known visual details with generic descriptions.
- Do not omit important details simply to make the prompt shorter.
- Preserve spatial relationships.
- Preserve pose.
- Preserve composition.
- Preserve lighting.
- Preserve environment.
- Preserve clothing.
- Preserve visible product details.
- Preserve visible branding and text.
- If the analysis marks a detail as unknown, do not fabricate it.
- The final result must be usable directly by an image-generation model.

Return ONLY the final image-generation prompt.

Do not add:
- explanations
- analysis
- headings
- notes
- disclaimers
- quotation marks
- markdown code fences
- "Final Prompt:"
- "Prompt:"

Return only the production-ready prompt as plain text.
`.trim();

}


/* =========================================================
   PROMPT ENGINEERING USER PROMPT
========================================================= */

function buildPromptUserPrompt(
    analysis,
    settings = {}
) {

    const purpose =
        settings.purpose ||
        "image-generation";


    const detail =
        settings.detail ||
        "ultra";


    const instruction =
        settings.instruction ||
        "";


    return `
Create the final production-ready image-generation prompt from the visual analysis below.

Target purpose:
${purpose}

Requested detail:
${detail}

Additional user instruction:
${instruction || "None"}

The visual analysis below comes from the actual reference image.

Preserve all important visible characteristics.

Do not invent unsupported details.

VISUAL ANALYSIS:

${formatAnalysisForPrompt(
    analysis
)}

Now return ONLY the final production-ready image prompt.
`.trim();

}


/* =========================================================
   FORMAT ANALYSIS
========================================================= */

function formatAnalysisForPrompt(
    analysis
) {

    if (
        typeof analysis ===
        "string"
    ) {

        return analysis;

    }


    try {

        return JSON.stringify(
            analysis,
            null,
            2
        );

    }
    catch {

        return String(
            analysis ||
            ""
        );

    }

}


/* =========================================================
   RUN PROMPT ENGINEERING
========================================================= */

async function generatePrompt(
    analysis,
    options = {}
) {

    if (
        !analysis
    ) {

        throw createAPIError(

            "Visual analysis belum tersedia.",

            {

                code:
                    "ANALYSIS_REQUIRED"

            }

        );

    }


    /*
     * Jangan meneruskan analysis kosong atau
     * sangat pendek ke Prompt Engineering.
     */

    const analysisText =
        formatAnalysisForPrompt(
            analysis
        );


    const analysisQuality =
        validateAnalysisQuality(
            analysisText
        );


    if (
        !analysisQuality.valid
    ) {

        throw createAPIError(

            "Visual analysis belum cukup untuk membuat prompt.",

            {

                code:
                    "ANALYSIS_INSUFFICIENT_FOR_PROMPT",

                data: {

                    length:
                        analysisQuality.length,

                    reason:
                        analysisQuality.reason

                }

            }

        );

    }


    const state =
        getState();


    const requestedModel =
        options.model ||
        getSelectedModel();


    const model =
        await resolveVisionModel(
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
                buildPromptSystemPrompt()

        },

        {

            role:
                "user",

            content:
                buildPromptUserPrompt(
                    analysis,
                    settings
                )

        }

    ];


    console.info(
        "[GEN-Z.AI Vision] Sending prompt-engineering request:",
        {

            model:
                model.id,

            messageCount:
                messages.length,

            analysisLength:
                analysisText.length

        }
    );


    const response =
        await request(

            {

                model:
                    model.id,

                messages,

                temperature:
                    VISION_API_CONFIG
                        .promptTemperature,

                max_tokens:
                    VISION_API_CONFIG
                        .maxPromptTokens,

                stream:
                    false

            },

            {

                timeout:
                    options.timeout ||
                    VISION_API_CONFIG.timeout

            }

        );


    /*
     * DEBUG RESPONSE
     *
     * Tidak menampilkan token/API key.
     * Hanya untuk mengetahui bentuk response
     * yang benar-benar dikembalikan endpoint.
     */

    console.info(
        "[GEN-Z.AI Vision] Prompt-engineering response:",
        sanitizeResponseForDebug(
            response
        )
    );


    const text =
        extractAssistantText(
            response
        );


    if (
        !text
    ) {

        throw createAPIError(

            "Vision model tidak mengembalikan prompt.",

            {

                code:
                    "EMPTY_PROMPT_RESPONSE",

                data:
                    response

            }

        );

    }


    const cleaned =
        cleanGeneratedPrompt(
            text
        );


    if (
        !cleaned
    ) {

        throw createAPIError(

            "Vision model mengembalikan response kosong setelah normalisasi prompt.",

            {

                code:
                    "EMPTY_CLEANED_PROMPT_RESPONSE",

                data:
                    response

            }

        );

    }


    return {

        text:
            cleaned,

        raw:
            response,

        model

    };

}


/* =========================================================
   SANITIZE RESPONSE FOR DEBUG
========================================================= */

function sanitizeResponseForDebug(
    response
) {

    if (
        response ===
        null ||
        response ===
        undefined
    ) {

        return response;

    }


    try {

        const cloned =
            JSON.parse(
                JSON.stringify(
                    response
                )
            );


        const sensitiveKeys = [

            "api_key",

            "apiKey",

            "authorization",

            "Authorization",

            "token",

            "access_token",

            "refresh_token"

        ];


        function redact(
            value,
            depth = 0
        ) {

            if (
                depth > 8
            ) {

                return "[MAX_DEPTH]";

            }


            if (
                Array.isArray(
                    value
                )
            ) {

                return value.map(
                    item =>
                        redact(
                            item,
                            depth + 1
                        )
                );

            }


            if (
                value &&
                typeof value ===
                    "object"
            ) {

                const result = {};


                Object.entries(
                    value
                )
                    .forEach(
                        (
                            [
                                key,
                                item
                            ]
                        ) => {

                            if (
                                sensitiveKeys.includes(
                                    key
                                )
                            ) {

                                result[key] =
                                    "[REDACTED]";

                            }
                            else {

                                result[key] =
                                    redact(
                                        item,
                                        depth + 1
                                    );

                            }

                        }
                    );


                return result;

            }


            return value;

        }


        return redact(
            cloned
        );

    }
    catch {

        return {

            type:
                typeof response,

            value:
                String(
                    response
                )

        };

    }

}


/* =========================================================
   EXTRACT TEXT PART
   ---------------------------------------------------------
   Menangani:

   - string
   - { text: "..." }
   - { content: "..." }
   - { type: "text", text: "..." }
   - nested content
   - OpenAI choices
   - Responses API output
   - provider wrapper
========================================================= */

function extractTextPart(
    value,
    depth = 0
) {

    if (
        value ===
        null ||
        value ===
        undefined
    ) {

        return "";

    }


    if (
        depth > 12
    ) {

        return "";

    }


    if (
        typeof value ===
        "string"
    ) {

        return value.trim();

    }


    if (
        Array.isArray(
            value
        )
    ) {

        const parts = [];


        for (
            const item
            of value
        ) {

            const part =
                extractTextPart(
                    item,
                    depth + 1
                );


            if (
                part
            ) {

                parts.push(
                    part
                );

            }

        }


        return parts
            .join("\n")
            .trim();

    }


    if (
        typeof value !==
        "object"
    ) {

        return "";

    }


    /*
     * Direct text fields.
     */

    const directTextKeys = [

        "text",

        "output_text",

        "generated_text",

        "generatedText"

    ];


    for (
        const key
        of directTextKeys
    ) {

        if (
            typeof value[key] ===
            "string"
        ) {

            const text =
                value[key].trim();


            if (
                text
            ) {

                return text;

            }

        }

    }


    /*
     * OpenAI / provider content.
     */

    if (
        value.content !==
        undefined
    ) {

        const content =
            extractTextPart(
                value.content,
                depth + 1
            );


        if (
            content
        ) {

            return content;

        }

    }


    /*
     * Message object.
     */

    if (
        value.message !==
        undefined
    ) {

        const message =
            extractTextPart(
                value.message,
                depth + 1
            );


        if (
            message
        ) {

            return message;

        }

    }


    /*
     * Choice object.
     */

    if (
        value.choices !==
        undefined
    ) {

        const choices =
            extractTextPart(
                value.choices,
                depth + 1
            );


        if (
            choices
        ) {

            return choices;

        }

    }


    /*
     * Wrapper umum.
     */

    const wrapperKeys = [

        "data",

        "result",

        "response",

        "output",

        "completion",

        "result_data",

        "resultData"

    ];


    for (
        const key
        of wrapperKeys
    ) {

        if (
            value[key] ===
            undefined
        ) {

            continue;

        }


        const nested =
            extractTextPart(
                value[key],
                depth + 1
            );


        if (
            nested
        ) {

            return nested;

        }

    }


    /*
     * Provider yang menggunakan parts.
     */

    if (
        value.parts !==
        undefined
    ) {

        const parts =
            extractTextPart(
                value.parts,
                depth + 1
            );


        if (
            parts
        ) {

            return parts;

        }

    }


    return "";

}


/* =========================================================
   EXTRACT ASSISTANT TEXT
========================================================= */

function extractAssistantText(
    response
) {

    if (
        response ===
        null ||
        response ===
        undefined
    ) {

        return "";

    }


    if (
        typeof response ===
        "string"
    ) {

        return response.trim();

    }


    /*
     * 1. GEN-Z.AI normalized response.
     */

    const directContent =
        extractTextPart(
            response?.content
        );


    if (
        directContent
    ) {

        return directContent;

    }


    /*
     * 2. Message.
     */

    const messageContent =
        extractTextPart(
            response?.message
        );


    if (
        messageContent
    ) {

        return messageContent;

    }


    /*
     * 3. OpenAI choices.
     */

    const choicesContent =
        extractTextPart(
            response?.choices
        );


    if (
        choicesContent
    ) {

        return choicesContent;

    }


    /*
     * 4. output_text.
     */

    const outputText =
        extractTextPart(
            response?.output_text
        );


    if (
        outputText
    ) {

        return outputText;

    }


    /*
     * 5. Direct text.
     */

    const directText =
        extractTextPart(
            response?.text
        );


    if (
        directText
    ) {

        return directText;

    }


    /*
     * 6. data.
     */

    const dataText =
        extractTextPart(
            response?.data
        );


    if (
        dataText
    ) {

        return dataText;

    }


    /*
     * 7. result.
     */

    const resultText =
        extractTextPart(
            response?.result
        );


    if (
        resultText
    ) {

        return resultText;

    }


    /*
     * 8. nested response.
     */

    const nestedResponseText =
        extractTextPart(
            response?.response
        );


    if (
        nestedResponseText
    ) {

        return nestedResponseText;

    }


    /*
     * 9. output.
     */

    const outputTextNested =
        extractTextPart(
            response?.output
        );


    if (
        outputTextNested
    ) {

        return outputTextNested;

    }


    /*
     * 10. Generic fallback.
     */

    const generic =
        extractTextPart(
            response
        );


    if (
        generic
    ) {

        return generic;

    }


    return "";

}


/* =========================================================
   CLEAN GENERATED PROMPT
========================================================= */

function cleanGeneratedPrompt(
    text
) {

    let result =
        String(
            text ||
            ""
        )
            .trim();


    if (
        !result
    ) {

        return "";

    }


    /*
     * Remove markdown code fence.
     */

    result =
        result
            .replace(
                /^```(?:text|markdown|md|prompt)?\s*/i,
                ""
            )
            .replace(
                /\s*```$/i,
                ""
            )
            .trim();


    /*
     * Remove common prompt labels.
     */

    result =
        result
            .replace(
                /^(?:final\s+)?prompt\s*:\s*/i,
                ""
            )
            .replace(
                /^generated\s+prompt\s*:\s*/i,
                ""
            )
            .trim();


    return result;

}


/* =========================================================
   PARSE JSON
========================================================= */

function parseJSON(
    text
) {

    if (
        typeof text !==
        "string"
    ) {

        if (
            text &&
            typeof text ===
                "object"
        ) {

            return text;

        }


        throw createAPIError(

            "Response analysis bukan JSON yang valid.",

            {

                code:
                    "INVALID_ANALYSIS_JSON"

            }

        );

    }


    const normalized =
        text
            .trim()
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

        return JSON.parse(
            normalized
        );

    }
    catch {

        /*
         * Cari object JSON pertama.
         */

        const firstBrace =
            normalized.indexOf(
                "{"
            );


        const lastBrace =
            normalized.lastIndexOf(
                "}"
            );


        if (
            firstBrace !== -1 &&
            lastBrace > firstBrace
        ) {

            const candidate =
                normalized.slice(
                    firstBrace,
                    lastBrace + 1
                );


            try {

                return JSON.parse(
                    candidate
                );

            }
            catch {

                /* lanjut */

            }

        }


        throw createAPIError(

            "Hasil visual analysis tidak dapat diparse sebagai JSON.",

            {

                code:
                    "INVALID_ANALYSIS_JSON",

                data:
                    text

            }

        );

    }

}


/* =========================================================
   RUN COMPLETE PIPELINE
========================================================= */

async function runVisionPipeline(
    options = {}
) {

    /*
     * Tahap 1:
     * Vision Analysis.
     */

    const analysis =
        await analyzeImage(
            options
        );


    /*
     * Tahap 2:
     * Parse analysis JSON.
     */

    let normalizedAnalysis;


    try {

        normalizedAnalysis =
            parseJSON(
                analysis.text
            );

    }
    catch {

        normalizedAnalysis =
            null;

    }


    /*
     * Jangan pernah mengirim analysis kosong.
     */

    const analysisForPrompt =
        normalizedAnalysis ||
        analysis.text;


    /*
     * Tahap 3:
     * Prompt Engineering.
     */

    const prompt =
        await generatePrompt(

            analysisForPrompt,

            {

                ...options,

                model:
                    analysis.model

            }

        );


    return {

        analysis: {

            text:
                analysis.text,

            normalized:
                normalizedAnalysis,

            raw:
                analysis.raw

        },

        prompt: {

            text:
                prompt.text,

            raw:
                prompt.raw

        },

        model:
            analysis.model

    };

}


/* =========================================================
   PUBLIC API
========================================================= */

const GENZVisionAPI =
    Object.freeze({

        CONFIG:
            VISION_API_CONFIG,

        request,

        getAccessToken,

        getOpenKeyModels,

        collectModalityValues,

        getModelCapabilities,

        normalizeVisionModel,

        supportsImageInput,

        resolveVisionModel,

        buildImageMessage,

        buildAnalysisSystemPrompt,

        buildAnalysisUserPrompt,

        analyzeImage,

        validateAnalysisQuality,

        buildPromptSystemPrompt,

        buildPromptUserPrompt,

        generatePrompt,

        extractTextPart,

        extractAssistantText,

        cleanGeneratedPrompt,

        parseJSON,

        runVisionPipeline

    });


/* =========================================================
   GLOBAL EXPORT
========================================================= */

window.GENZVisionAPI =
    GENZVisionAPI;
