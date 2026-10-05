// vision-api.js?v=1.8
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
   - Validasi kualitas Vision Analysis
   - Prompt Engineering menghasilkan Bahasa Indonesia
   - Prompt Engineering mempertahankan detail visual secara rinci
   - Tidak mengatur DOM
   - Tidak memotong credit
   - Tidak menyimpan history
   - Tidak menyimpan API key di browser

   CATATAN OPENKEY:
   Endpoint /models OpenKey tidak selalu mengirim
   metadata input_modalities / capabilities.

   Karena itu deteksi Vision menggunakan dua lapisan:

   1. Capability metadata yang benar-benar diberikan
      oleh katalog API.
   2. Capability policy OpenKey untuk model yang secara
      eksplisit ditandai sebagai model Vision.

   Policy ini BUKAN registry model.
   Model tetap wajib berasal dari response /models.
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
        requested
    ) {

        const exact =
            normalizedModels.find(

                model =>

                    model.id.toLowerCase() ===
                    requested.id.toLowerCase()

            );


        if (
            exact &&
            supportsImageInput(
                exact
            )
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
========================================================= */

function buildAnalysisSystemPrompt() {

    return `
You are the visual analysis engine of GEN-Z.AI Vision.

Your task is to analyze the supplied reference image with
extremely high visual accuracy and completeness.

IMPORTANT:
The user has supplied an actual reference image.
You MUST inspect the image itself before answering.

Do NOT generate a final creative prompt yet.

First extract the observable visual information into
structured JSON.

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

- Describe visible details specifically, not generically.
- Extract concrete colors, shapes, textures, patterns,
  positions, relationships, and visual characteristics.
- Describe important facial characteristics individually
  whenever they are visible.
- Describe clothing pieces individually.
- Describe patterns and textures when visible.
- Describe background details instead of only saying
  "background".
- Describe lighting direction and quality when observable.
- Describe camera perspective and depth of field when
  visually inferable.
- Describe composition and subject placement precisely.
- Describe accessories individually.
- Identify products and visible branding carefully.
- Do not invent hidden details.
- If something cannot be determined, use null or "unknown".
- Preserve important spatial relationships.
- Do not claim that a person is a specific real person.
- Do not infer private identity.
- Separate visible facts from uncertainty.
- Do not respond that visual details were not provided when
  an image is attached.
- Do not produce a generic refusal when the image is available.
- The purpose is detailed visual observation, not creative
  generation.

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

Inspect the attached image carefully and extract as many
useful concrete visual details as the image actually supports.

Do not summarize the image too aggressively.

For a person, inspect visible facial structure, eyes,
eyebrows, nose, lips, makeup, skin appearance, hair or
head covering, expression, gaze, head angle, body position,
clothing pieces, colors, fabrics, patterns, folds and
accessories.

For products, inspect visible product type, shape,
material, color, surface details, branding, labels and
placement.

For composition, inspect framing, subject placement,
orientation, camera perspective, apparent lens character,
focus and depth of field.

For lighting, inspect direction, softness, highlights,
shadows, contrast and color temperature when observable.

For environment and background, inspect architecture,
walls, surfaces, textures, objects, colors and spatial
relationships.

For visual style, inspect photographic or cinematic
characteristics, realism, sharpness, background separation,
color treatment and overall aesthetic.

Produce structured visual analysis based strictly on what
is visible in the image.

Do not answer with a generic statement that visual details
are unavailable.
`.trim();

}


/* =========================================================
   ANALYSIS QUALITY VALIDATION
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


    const refusalMatch =
        refusalPatterns.some(
            pattern =>
                pattern.test(
                    normalized
                )
        );


    if (
        refusalMatch
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
        VISION_API_CONFIG.minAnalysisCharacters
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
                buildImageMessage(

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
                    file?.dataUrl
                ),

            referenceMimeType:
                file?.mimeType ||
                file?.type ||
                null

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


    console.info(
        "[GEN-Z.AI Vision] Visual-analysis response:",
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
        {

            valid:
                quality.valid,

            length:
                quality.length,

            code:
                quality.code,

            reason:
                quality.reason

        }
    );


    if (
        !quality.valid
    ) {

        throw createAPIError(

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
   PROMPT ENGINEERING SYSTEM PROMPT
   ---------------------------------------------------------
   OUTPUT:
   - Bahasa Indonesia
   - Sangat detail
   - Berbasis fakta visual
   - Tidak generik
========================================================= */

function buildPromptSystemPrompt() {

    return `
You are the advanced prompt engineering engine of GEN-Z.AI Vision.

Your task is to transform the supplied structured visual
analysis into ONE extremely detailed, production-ready,
high-fidelity prompt for generative media.

The visual analysis was produced from an actual reference
image.

The visual analysis is the SOURCE OF TRUTH.

Your job is NOT to summarize the analysis.

Your job is to convert the concrete visual observations
into a rich natural-language generation prompt.

=========================================================
BAHASA OUTPUT WAJIB
=========================================================

The FINAL PROMPT MUST BE WRITTEN IN BAHASA INDONESIA.

This is mandatory.

- Write the entire final prompt in natural Bahasa Indonesia.
- Do not write English sentences.
- Do not output an English translation.
- Preserve proper nouns, brand names, product names and
  model names when they should remain unchanged.
- International technical terms may remain when necessary
  for precision, such as depth of field, bokeh, dolly-in,
  push-in, close-up, or framing.
- The surrounding description must remain Indonesian.

=========================================================
PRINSIP UTAMA: JANGAN GENERIK
=========================================================

NEVER replace concrete visual details with generic phrases.

BAD:

"Pertahankan subjek, pakaian, aksesori, lingkungan,
dan warna seperti gambar referensi."

GOOD:

"Pertahankan wanita muda dengan kulit cerah, alis tebal
dan terdefinisi, mata cokelat gelap berbentuk almond dengan
eyeliner dan maskara, bibir penuh berwarna merah muda,
serta hijab merah muda dengan scarf bermotif floral dan
paisley berwarna merah muda, putih, biru, dan cokelat."

The second form is required.

Do NOT simply say:

- "pertahankan wajah"
- "pertahankan pakaian"
- "pertahankan aksesori"
- "pertahankan latar"
- "pertahankan warna"
- "pertahankan komposisi"

when the analysis contains concrete details.

Instead, state the concrete details.

=========================================================
WAJIB MENGGUNAKAN DATA ANALYSIS
=========================================================

Use every useful category present in the analysis.

At minimum, inspect and incorporate:

- subject
- appearance
- face_hair
- pose
- clothing
- accessories
- product
- composition
- camera
- lighting
- environment
- color_palette
- visual_style
- text_branding
- image_quality
- important_details
- spatial_relationships

Do not silently discard populated fields.

If a field contains useful information, incorporate it
into the final prompt.

=========================================================
DETAIL SUBJEK
=========================================================

If available, explicitly describe:

- jenis subjek
- gender jika terlihat
- kelompok usia jika dapat diperkirakan
- karakter fisik
- warna kulit
- kondisi kulit
- bentuk mata
- warna mata
- bentuk alis
- hidung
- bentuk bibir
- warna bibir
- makeup
- rambut
- warna rambut
- gaya rambut
- hijab atau penutup kepala
- ekspresi
- arah pandangan
- posisi kepala
- posisi tubuh

Do not collapse these into a generic phrase such as
"wajah yang cantik".

Use the actual observations.

=========================================================
DETAIL PAKAIAN
=========================================================

Describe clothing pieces individually when available.

Include:

- jenis pakaian
- warna
- material jika terlihat
- tekstur
- pola
- motif
- bordir
- lipatan
- cara pakaian dikenakan
- posisi pakaian pada tubuh

For patterned fabrics, explicitly preserve the pattern
and color combination.

Do not reduce:

"floral dan paisley berwarna pink, putih, biru dan cokelat"

into:

"scarf bermotif".

=========================================================
DETAIL AKSESORI
=========================================================

Every visible accessory that matters should be described.

Include:

- jenis
- bentuk
- ukuran relatif
- warna
- material jika terlihat
- posisi pada tubuh
- hubungan dengan bagian tubuh lainnya

=========================================================
DETAIL PRODUK
=========================================================

If product information exists:

- describe the product explicitly
- preserve visible shape
- preserve visible color
- preserve material
- preserve surface
- preserve branding
- preserve labels
- preserve placement
- preserve relationship to the subject

Never invent a product when product is empty or null.

=========================================================
KOMPOSISI DAN FRAMING
=========================================================

Do not merely say "komposisi tetap sama".

Explicitly describe:

- portrait / landscape
- close-up / medium shot / full body
- subject placement
- center / left / right
- headroom
- foreground
- background relationship
- visual balance
- framing
- crop
- orientation

=========================================================
KAMERA
=========================================================

If available, explicitly include:

- camera perspective
- eye-level / high-angle / low-angle
- apparent lens character
- wide-angle characteristics
- depth of field
- focus
- background blur
- camera distance
- cinematic camera movement when appropriate

Never invent an exact camera model or exact focal length
unless the analysis explicitly provides it.

=========================================================
LIGHTING
=========================================================

Explicitly describe available lighting information:

- direction
- softness
- intensity if observable
- quality
- highlights
- shadows
- fill light
- contrast
- color temperature if supported

Do not replace detailed lighting information with
"pencahayaan sinematik".

=========================================================
LINGKUNGAN DAN LATAR
=========================================================

Describe the actual visible environment.

Include:

- setting
- background
- wall
- floor
- architecture
- objects
- texture
- color
- material
- visible imperfections
- spatial position

If the analysis says brick wall with reddish-orange color,
describe that instead of simply saying "background".

=========================================================
WARNA DAN TEKSTUR
=========================================================

Preserve meaningful colors individually.

Do not reduce:

"pink, reddish-orange, white, blue, brown, yellow"

into:

"palet warna hangat".

Mention the important colors and where they appear.

Preserve important textures such as:

- kain halus
- ribbed fabric
- brick texture
- rough surface
- glossy surface
- matte surface

only when supported by analysis.

=========================================================
IMPORTANT DETAILS
=========================================================

The field "important_details" is HIGH PRIORITY.

Every meaningful item in "important_details" must be
represented in the final prompt.

Do not ignore it.

=========================================================
SPATIAL RELATIONSHIPS
=========================================================

The field "spatial_relationships" is HIGH PRIORITY.

Use it to explain where objects and body parts are
positioned relative to each other.

For example:

- hijab frames the face
- scarf drapes over shoulders
- brick wall is behind subject
- product is held near torso

Do not omit these relationships.

=========================================================
UNCERTAINTIES
=========================================================

Do not convert uncertainty into fact.

If analysis says:

"exact material unknown"

do not state an exact material.

If analysis says:

"possibly standard lens"

do not state:

"menggunakan lensa 50mm".

Use careful wording such as:

"tampak seperti..."

when appropriate.

=========================================================
VIDEO MOTION
=========================================================

When the intended purpose is video generation, create
natural motion based on the static visual evidence.

Add motion that respects the reference image.

Possible motion includes:

- subtle breathing
- natural blinking
- tiny head movement
- subtle facial micro-expression
- gentle body movement
- natural fabric movement
- slight movement of scarf or hijab
- subtle camera push-in
- slow dolly movement
- gentle camera stabilization

But motion MUST NOT alter the identity or design of
visible elements.

Do not invent dramatic movement unless explicitly requested.

Do not make the subject perform actions that are not
supported by the intended purpose.

=========================================================
REFERENCE FIDELITY
=========================================================

The generated result must preserve:

- identity of visible subject characteristics
- face structure
- skin appearance
- clothing
- colors
- patterns
- accessories
- product
- composition
- camera perspective
- lighting
- shadows
- environment
- background
- texture
- visual style

Do not introduce unrelated elements.

=========================================================
ANTI-INVENTION
=========================================================

NEVER invent:

- hidden clothing
- hidden body parts
- unseen accessories
- unseen products
- unseen text
- unseen branding
- exact camera model
- exact focal length
- exact location
- exact lighting equipment
- personal identity
- unsupported physical characteristics

The final prompt must be grounded in the supplied analysis.

=========================================================
PROMPT DEPTH
=========================================================

The final prompt must be substantially more detailed than
the source analysis summary.

Do not shorten the analysis into a generic instruction.

Do not produce a short template.

Do not produce:

"buat video sinematik yang realistis dan pertahankan
semua elemen gambar."

That is insufficient.

The final prompt should explain the actual visual content
in concrete language.

Use multiple coherent paragraphs if necessary.

The final prompt should normally contain:

1. detailed subject description
2. facial and appearance details
3. pose and expression
4. clothing and accessories
5. product details if present
6. composition and framing
7. camera characteristics
8. lighting and shadows
9. environment and background
10. colors and textures
11. visual style
12. motion instructions when the purpose is video
13. fidelity and negative constraints

=========================================================
OUTPUT RULE
=========================================================

Return ONLY the final generation prompt.

Do NOT output:

- analysis
- JSON
- explanation
- reasoning
- notes
- disclaimer
- markdown
- code fence
- "Prompt:"
- "Final Prompt:"
- "Berikut prompt:"
- bullet list

The result must be a single natural, detailed,
production-ready prompt in Bahasa Indonesia.

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


    const formattedAnalysis =
        formatAnalysisForPrompt(
            analysis
        );


    return `
Buat SATU prompt final yang sangat rinci dan siap produksi
berdasarkan visual analysis di bawah ini.

Tujuan generasi:
${purpose}

Tingkat detail:
${detail}

Instruksi tambahan pengguna:
${instruction || "Tidak ada"}

=========================================================
TUGAS UTAMA
=========================================================

Gunakan visual analysis sebagai sumber fakta.

JANGAN membuat prompt generik.

Ekstrak dan gunakan detail konkret yang tersedia.

Jika analysis berisi:

- warna, sebutkan warnanya;
- pola, sebutkan polanya;
- tekstur, sebutkan teksturnya;
- fitur wajah, sebutkan fiturnya;
- pakaian, sebutkan setiap bagian yang terlihat;
- aksesori, sebutkan aksesori dan posisinya;
- produk, jelaskan produk yang terlihat;
- komposisi, jelaskan framing dan posisi;
- kamera, jelaskan perspektif dan karakter lensanya;
- lighting, jelaskan arah dan kualitas cahaya;
- background, jelaskan objek dan teksturnya;
- important_details, masukkan semuanya;
- spatial_relationships, masukkan hubungan ruangnya.

Jangan mengganti semua informasi tersebut dengan kalimat
umum seperti:

"pertahankan semua elemen visual."

Kalimat umum boleh digunakan sebagai tambahan, tetapi
TIDAK boleh menggantikan detail konkret.

=========================================================
BAHASA
=========================================================

Output akhir WAJIB Bahasa Indonesia.

Jangan menghasilkan paragraf bahasa Inggris.

Nama brand, produk, model, atau istilah teknis yang memang
harus dipertahankan boleh tetap menggunakan bentuk aslinya.

=========================================================
KETEPATAN VISUAL
=========================================================

Jangan mengarang.

Jangan mengubah uncertainty menjadi fakta.

Jangan menambahkan elemen yang tidak terdapat dalam analysis.

Jangan menghapus detail visual yang tersedia.

Jangan mengubah warna, pola, tekstur, pose, wajah, pakaian,
aksesori, produk, komposisi, kamera, lighting, atau
background tanpa dasar dari instruksi pengguna.

=========================================================
UNTUK VIDEO
=========================================================

Jika tujuan adalah video, gunakan detail gambar sebagai
fondasi gerakan.

Tambahkan gerakan natural yang sesuai seperti:

- kedipan mata
- pernapasan halus
- micro-expression
- gerakan kepala yang sangat kecil
- gerakan tubuh alami
- gerakan kain yang lembut
- pergerakan scarf atau hijab yang realistis
- camera push-in atau dolly-in yang sangat halus

Gerakan tidak boleh mengubah desain visual asli.

=========================================================
OUTPUT
=========================================================

Hasil akhir harus:

- sangat detail
- konkret
- natural
- koheren
- siap digunakan model generatif
- Bahasa Indonesia
- berbasis reference analysis

Jangan tampilkan JSON.

Jangan tampilkan analisis.

Jangan tampilkan penjelasan.

Jangan gunakan label "Prompt:".

Keluarkan hanya prompt final.

=========================================================
VISUAL ANALYSIS
=========================================================

${formattedAnalysis}
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

        return analysis.trim();

    }


    if (
        analysis ===
        null ||
        analysis ===
        undefined
    ) {

        return "";

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

    const analysisText =
        formatAnalysisForPrompt(
            analysis
        );


    if (
        !analysisText ||
        !analysisText.trim()
    ) {

        throw createAPIError(

            "Visual analysis belum tersedia.",

            {

                code:
                    "ANALYSIS_REQUIRED"

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
                analysisText.length,

            outputLanguage:
                "id-ID",

            detailMode:
                "concrete-visual-expansion",

            analysisSource:
                "structured-visual-analysis"

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

        const text =
            value.trim();


        return text;

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
            .join("")
            .trim();

    }


    if (
        typeof value !==
        "object"
    ) {

        return "";

    }


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
     * OpenKey / GEN-Z.AI normalized response.
     *
     * response.content HARUS diprioritaskan karena
     * endpoint /api/openkey-chat mengembalikan hasil
     * generasi utama pada field ini.
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
     * Fallback message.
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
     * OpenAI-compatible choices.
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


    const outputText =
        extractTextPart(
            response?.output_text
        );


    if (
        outputText
    ) {

        return outputText;

    }


    const directText =
        extractTextPart(
            response?.text
        );


    if (
        directText
    ) {

        return directText;

    }


    const dataText =
        extractTextPart(
            response?.data
        );


    if (
        dataText
    ) {

        return dataText;

    }


    const resultText =
        extractTextPart(
            response?.result
        );


    if (
        resultText
    ) {

        return resultText;

    }


    const nestedResponseText =
        extractTextPart(
            response?.response
        );


    if (
        nestedResponseText
    ) {

        return nestedResponseText;

    }


    const outputTextNested =
        extractTextPart(
            response?.output
        );


    if (
        outputTextNested
    ) {

        return outputTextNested;

    }


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

                /* lanjut ke error asli */

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

    const analysis =
        await analyzeImage(
            options
        );


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


    const prompt =
        await generatePrompt(

            normalizedAnalysis ||
            analysis.text,

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

        validateAnalysisQuality,

        analyzeImage,

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
