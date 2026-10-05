// vision-api.js?v=1.9
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
   - Mengirim fakta visual konkret ke Prompt Engineering
   - Mencegah analisis terpotong oleh normalisasi
   - Validasi kualitas Prompt Engineering
   - Corrective retry jika prompt terlalu generik
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

    /*
     * Prompt Engineering harus deterministik.
     * Kita tidak membutuhkan kreativitas tinggi di tahap ini.
     * Yang dibutuhkan adalah ekspansi fakta visual.
     */

    promptTemperature:
        0.2,

    correctivePromptTemperature:
        0.15,

    maxAnalysisTokens:
        5000,

    maxPromptTokens:
        5000,

    minAnalysisCharacters:
        500,

    /*
     * Prompt final harus cukup panjang untuk benar-benar
     * mengandung fakta visual.
     *
     * Ini bukan syarat mutlak untuk semua jenis analisis,
     * tetapi menjadi quality gate agar model tidak mengembalikan
     * satu kalimat generik.
     */

    minPromptCharacters:
        900,

    preferredPromptCharacters:
        1200,

    maxPromptFacts:
        120

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

Your most important responsibility is:

TURN CONCRETE VISUAL FACTS INTO CONCRETE SENTENCES.

Do NOT compress the visual analysis into generic language.

Do NOT summarize.

Do NOT replace facts with category names.

Do NOT write a generic "preserve everything" prompt.

=========================================================
BAHASA OUTPUT WAJIB
=========================================================

The FINAL PROMPT MUST BE WRITTEN IN BAHASA INDONESIA.

- Entire final prompt must be natural Bahasa Indonesia.
- Do not write English sentences.
- Do not output an English translation.
- Preserve proper nouns, brand names, product names and
  model names when appropriate.
- Technical terms may remain when necessary for precision.

=========================================================
ATURAN PALING PENTING
=========================================================

The section named:

MANDATORY VISUAL FACTS

contains concrete observations extracted from the reference
analysis.

EVERY USEFUL CONCRETE FACT IN THAT SECTION MUST BE
REFLECTED IN THE FINAL PROMPT.

This means:

If the facts say:

"subject > description: A young woman wearing a hijab"

the prompt must explicitly describe:

"seorang wanita muda mengenakan hijab"

If the facts say:

"eyes > color: Dark brown"

the prompt must explicitly describe:

"mata berwarna cokelat gelap"

If the facts say:

"eyes > shape: Almond-shaped"

the prompt must explicitly describe:

"mata berbentuk almond"

If the facts say:

"headwear > color: Light pink"

the prompt must explicitly describe:

"hijab berwarna merah muda"

If the facts say:

"background > description: A brick wall with a
reddish-orange hue"

the prompt must explicitly describe:

"dinding bata berwarna merah-oranye dengan tekstur
yang terlihat"

Do not merely write:

"pertahankan wajah."

Do not merely write:

"pertahankan pakaian."

Do not merely write:

"pertahankan latar."

Do not merely write:

"pertahankan semua elemen."

Concrete facts are mandatory.

=========================================================
BAD OUTPUT
=========================================================

"Buat video sinematik realistis dari gambar referensi.
Pertahankan subjek, pakaian, wajah, aksesori, komposisi,
pencahayaan, warna dan latar belakang."

This is NOT acceptable.

It contains almost no actual visual information.

=========================================================
GOOD OUTPUT PRINCIPLE
=========================================================

The final prompt must read as if another generative model
has NOT seen the original image and must reconstruct the
visible scene from your text alone.

Therefore explicitly describe:

- siapa / apa subjeknya
- karakter visual subjek
- wajah
- mata
- alis
- hidung jika tersedia
- bibir
- makeup
- rambut atau hijab
- pakaian
- warna
- pola
- tekstur
- aksesori
- produk
- pose
- ekspresi
- framing
- komposisi
- kamera
- depth of field
- lighting
- shadow
- environment
- background
- warna latar
- important details
- spatial relationships
- visual style

=========================================================
DETAIL SUBJEK
=========================================================

Use concrete available information.

Do not invent details.

If age, gender or physical characteristics are provided,
include them.

If facial characteristics are provided individually,
include them individually.

Example:

Do not write:

"wanita cantik."

Write the actual observed details, such as:

"seorang wanita muda dengan kulit cerah, alis tebal dan
terdefinisi, mata cokelat gelap berbentuk almond dengan
eyeliner dan maskara, serta bibir penuh berwarna merah muda."

=========================================================
DETAIL PAKAIAN
=========================================================

Describe each visible clothing component.

Include actual:

- color
- pattern
- texture
- material when supported
- placement
- folds
- relationship to body

If a scarf contains multiple colors and patterns, mention
them explicitly.

Never compress:

"floral dan paisley, pink, putih, biru, cokelat"

into:

"scarf bermotif".

=========================================================
AKSESORI
=========================================================

Every meaningful visible accessory must be included.

Mention:

- type
- appearance
- approximate size when supported
- color
- material when supported
- position

=========================================================
PRODUK
=========================================================

If product is non-null, describe it concretely.

If product is null or empty, DO NOT invent a product.

=========================================================
POSE DAN EKSPRESI
=========================================================

Explicitly describe:

- body orientation
- head orientation
- head tilt
- gaze
- expression
- visible body position
- hand position when available

=========================================================
KOMPOSISI
=========================================================

Explicitly describe:

- close-up / medium / full body
- subject placement
- crop
- framing
- orientation
- visual balance
- foreground/background relationship

=========================================================
KAMERA
=========================================================

Use actual analysis.

Mention:

- perspective
- eye-level / high-angle / low-angle
- lens character
- apparent wide-angle effect
- focus
- depth of field
- background blur
- camera distance when supported

Never invent exact camera hardware.

Never invent an exact focal length.

=========================================================
LIGHTING
=========================================================

Use concrete lighting observations.

Mention:

- direction
- softness
- shadows
- fill
- highlights
- contrast
- color temperature when supported

Do not reduce detailed lighting into:

"pencahayaan sinematik."

=========================================================
BACKGROUND
=========================================================

Describe the actual background.

For example, if analysis contains:

"brick wall"

then say:

"dinding bata"

and include its visible color and texture when provided.

Do not simply say:

"background yang sesuai."

=========================================================
WARNA
=========================================================

Preserve meaningful colors individually.

If the analysis identifies:

- pink
- reddish-orange
- white
- blue
- brown
- yellow

then the final prompt should identify those colors and
where they appear when that relationship is available.

=========================================================
TEXTURE
=========================================================

Preserve meaningful textures.

Examples:

- kain halus
- ribbed band
- tekstur bata kasar
- permukaan porous
- kain berpola

Only use textures supported by analysis.

=========================================================
IMPORTANT DETAILS
=========================================================

Every meaningful item in "important_details" is HIGH PRIORITY.

Do not ignore this field.

=========================================================
SPATIAL RELATIONSHIPS
=========================================================

Every meaningful spatial relationship should be converted
into natural language.

Example:

"The hijab frames the face."

becomes:

"hijab membingkai wajah."

"The scarf drapes around the neck and shoulders."

becomes:

"scarf terurai mengelilingi leher dan jatuh di atas
bahu."

"The brick wall is behind the subject."

becomes:

"dinding bata berada di belakang subjek."

=========================================================
UNCERTAINTIES
=========================================================

Never turn uncertainty into fact.

If something is uncertain, preserve that uncertainty.

Never invent:

- exact location
- exact lens
- exact camera
- hidden clothing
- unseen accessories
- unseen product
- unseen branding
- personal identity

=========================================================
VIDEO MODE
=========================================================

If intended purpose is video generation:

FIRST reconstruct the static source image faithfully.

THEN add controlled, realistic motion.

Motion may include:

- subtle breathing
- natural blinking
- very small head movement
- subtle facial micro-expression
- gentle fabric movement
- slight scarf or hijab movement
- subtle camera push-in
- slow dolly-in
- gentle stabilized camera movement

Do not introduce unrelated actions.

Do not radically change the pose.

Do not alter identity.

Do not change clothing.

Do not change background.

Do not add new objects.

Do not replace the visual design of the source image.

=========================================================
PROMPT DEPTH
=========================================================

The final prompt must normally be at least several coherent
paragraphs and should contain substantial concrete detail.

For a rich visual analysis, target approximately
1200-2000+ characters.

Do not artificially repeat facts.

Do not pad with meaningless adjectives.

Use information density rather than empty verbosity.

=========================================================
FINAL OUTPUT
=========================================================

Return ONLY the final generation prompt.

Do NOT output:

- JSON
- analysis
- explanation
- reasoning
- notes
- disclaimer
- markdown
- code fence
- bullet list
- "Prompt:"
- "Final Prompt:"
- "Berikut prompt:"

The final answer must be a single natural,
detailed, production-ready prompt in Bahasa Indonesia.
`.trim();

}


/* =========================================================
   ANALYSIS FACT LABEL
========================================================= */

function humanizeAnalysisKey(
    key
) {

    const labels = {

        subject:
            "Subjek",

        description:
            "Deskripsi",

        appearance:
            "Penampilan",

        skin_tone:
            "Warna kulit",

        skinTone:
            "Warna kulit",

        features:
            "Ciri fisik",

        face_hair:
            "Wajah dan rambut",

        faceHair:
            "Wajah dan rambut",

        eyes:
            "Mata",

        color:
            "Warna",

        shape:
            "Bentuk",

        makeup:
            "Riasan",

        eyebrows:
            "Alis",

        lips:
            "Bibir",

        nose:
            "Hidung",

        hair:
            "Rambut",

        pose:
            "Pose",

        body_position:
            "Posisi tubuh",

        bodyPosition:
            "Posisi tubuh",

        head_position:
            "Posisi kepala",

        headPosition:
            "Posisi kepala",

        gaze:
            "Arah pandangan",

        expression:
            "Ekspresi",

        clothing:
            "Pakaian",

        headwear:
            "Penutup kepala",

        type:
            "Jenis",

        texture:
            "Tekstur",

        scarf:
            "Scarf",

        pattern:
            "Pola / motif",

        placement:
            "Posisi",

        accessories:
            "Aksesori",

        product:
            "Produk",

        composition:
            "Komposisi",

        layout:
            "Tata letak",

        focus:
            "Fokus",

        framing:
            "Framing",

        camera:
            "Kamera",

        perspective:
            "Perspektif",

        lens_characteristics:
            "Karakter lensa",

        lensCharacteristics:
            "Karakter lensa",

        depth_of_field:
            "Depth of field",

        depthOfField:
            "Depth of field",

        lighting:
            "Pencahayaan",

        direction:
            "Arah",

        quality:
            "Kualitas",

        shadows:
            "Bayangan",

        environment:
            "Lingkungan",

        setting:
            "Setting",

        background:
            "Latar belakang",

        background_details:
            "Detail latar belakang",

        backgroundDetails:
            "Detail latar belakang",

        color_palette:
            "Palet warna",

        colorPalette:
            "Palet warna",

        visual_style:
            "Gaya visual",

        genre:
            "Genre",

        mood:
            "Mood",

        aesthetics:
            "Estetika",

        text_branding:
            "Teks dan branding",

        image_quality:
            "Kualitas gambar",

        resolution:
            "Resolusi",

        sharpness:
            "Ketajaman",

        noise:
            "Noise",

        important_details:
            "Detail penting",

        importantDetails:
            "Detail penting",

        spatial_relationships:
            "Hubungan spasial",

        spatialRelationships:
            "Hubungan spasial",

        uncertainties:
            "Ketidakpastian"

    };


    if (
        labels[key]
    ) {

        return labels[key];

    }


    return String(
        key ||
        ""
    )
        .replace(
            /([a-z])([A-Z])/g,
            "$1 $2"
        )
        .replace(
            /[_-]+/g,
            " "
        )
        .replace(
            /\s+/g,
            " "
        )
        .trim();

}


/* =========================================================
   ANALYSIS FACT EXTRACTION
   ---------------------------------------------------------
   Tujuan:
   Jangan hanya mengirim JSON dan berharap model mau
   membaca semuanya. Kita ekstrak setiap leaf value menjadi
   fakta eksplisit yang wajib digunakan.
========================================================= */

function buildAnalysisFactList(
    analysis
) {

    const facts = [];


    function isMeaningfulValue(
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
                value.trim();


            if (
                !normalized
            ) {

                return false;

            }


            if (
                normalized.toLowerCase() ===
                "unknown"
            ) {

                return false;

            }


            if (
                normalized.toLowerCase() ===
                "null"
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


        return false;

    }


    function walk(
        value,
        path = []
    ) {

        if (
            facts.length >=
            VISION_API_CONFIG.maxPromptFacts
        ) {

            return;

        }


        if (
            isMeaningfulValue(
                value
            )
        ) {

            const labels =
                path.map(
                    humanizeAnalysisKey
                );


            facts.push({

                path:
                    labels.join(
                        " > "
                    ),

                value:
                    String(
                        value
                    ).trim()

            });


            return;

        }


        if (
            Array.isArray(
                value
            )
        ) {

            value.forEach(
                (
                    item,
                    index
                ) => {

                    if (
                        facts.length >=
                        VISION_API_CONFIG.maxPromptFacts
                    ) {

                        return;

                    }


                    /*
                     * Array item object:
                     *
                     * accessories[0] > type
                     *
                     * Array item primitive:
                     *
                     * color_palette > pink
                     */

                    if (
                        item &&
                        typeof item ===
                            "object"
                    ) {

                        walk(
                            item,
                            path
                        );

                    }
                    else if (
                        isMeaningfulValue(
                            item
                        )
                    ) {

                        const labels =
                            path.map(
                                humanizeAnalysisKey
                            );


                        facts.push({

                            path:
                                labels.join(
                                    " > "
                                ) ||
                                `Item ${index + 1}`,

                            value:
                                String(
                                    item
                                ).trim()

                        });

                    }

                }
            );


            return;

        }


        if (
            value &&
            typeof value ===
                "object"
        ) {

            Object.entries(
                value
            )
                .forEach(
                    (
                        [
                            key,
                            child
                        ]
                    ) => {

                        if (
                            facts.length >=
                            VISION_API_CONFIG.maxPromptFacts
                        ) {

                            return;

                        }


                        walk(
                            child,
                            [
                                ...path,
                                key
                            ]
                        );

                    }
                );

        }

    }


    walk(
        analysis
    );


    return facts;

}


/* =========================================================
   FORMAT ANALYSIS FACTS
========================================================= */

function formatAnalysisFacts(
    analysis
) {

    const facts =
        buildAnalysisFactList(
            analysis
        );


    if (
        facts.length ===
        0
    ) {

        return "";

    }


    return facts
        .map(
            (
                fact,
                index
            ) =>
                `${index + 1}. ${fact.path}: ${fact.value}`
        )
        .join(
            "\n"
        );

}


/* =========================================================
   GET ANALYSIS FACT COUNT
========================================================= */

function getAnalysisFactCount(
    analysis
) {

    return buildAnalysisFactList(
        analysis
    ).length;

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


    /*
     * PENTING:
     *
     * Jangan gunakan hasil ringkasan / normalisasi sebagai
     * satu-satunya sumber.
     *
     * Kita tetap mengirim JSON, tetapi sekarang juga membuat
     * daftar fakta eksplisit agar model tidak menganggap
     * JSON sebagai konteks yang boleh diringkas.
     */

    const formattedAnalysis =
        formatAnalysisForPrompt(
            analysis
        );


    const mandatoryFacts =
        formatAnalysisFacts(
            analysis
        );


    const factCount =
        getAnalysisFactCount(
            analysis
        );


    const isVideo =
        /video|image-to-video|image2video|motion|animat/i
            .test(
                String(
                    purpose
                )
            );


    return `
Buat SATU prompt final yang sangat rinci dan siap produksi
berdasarkan seluruh fakta visual di bawah ini.

Tujuan generasi:
${purpose}

Mode:
${isVideo ? "VIDEO / IMAGE-TO-VIDEO" : "IMAGE / VISUAL GENERATION"}

Tingkat detail:
${detail}

Instruksi tambahan pengguna:
${instruction || "Tidak ada"}

=========================================================
ATURAN KERAS
=========================================================

Jumlah fakta visual konkret yang berhasil diekstrak:
${factCount}

JANGAN menganggap analisis ini kosong.

JANGAN membuat prompt generik.

JANGAN hanya menulis:

"pertahankan semua elemen visual."

Kalimat tersebut TIDAK cukup.

Prompt final harus menyebut fakta konkret satu per satu
dalam Bahasa Indonesia.

Jika sebuah fakta berisi warna, sebutkan warna tersebut.

Jika sebuah fakta berisi bentuk, sebutkan bentuk tersebut.

Jika sebuah fakta berisi tekstur, sebutkan tekstur tersebut.

Jika sebuah fakta berisi pakaian, sebutkan pakaian tersebut.

Jika sebuah fakta berisi fitur wajah, sebutkan fitur
wajah tersebut.

Jika sebuah fakta berisi aksesori, sebutkan aksesori dan
posisinya.

Jika sebuah fakta berisi komposisi, sebutkan komposisinya.

Jika sebuah fakta berisi kamera, sebutkan perspektif dan
karakter kameranya.

Jika sebuah fakta berisi lighting, sebutkan arah dan
kualitas pencahayaannya.

Jika sebuah fakta berisi background, sebutkan background
secara konkret.

Jika sebuah fakta berisi important detail, masukkan detail
tersebut.

Jika sebuah fakta berisi spatial relationship, jelaskan
hubungan ruang tersebut.

Jangan menghilangkan fakta hanya karena nilainya terlihat
kecil.

=========================================================
MANDATORY VISUAL FACTS
=========================================================

Daftar di bawah ini adalah FAKTA VISUAL WAJIB.

Setiap fakta yang relevan harus tercermin dalam prompt final.

${mandatoryFacts || "Tidak ada fakta visual konkret yang berhasil diekstrak."}

=========================================================
SOURCE VISUAL ANALYSIS JSON
=========================================================

Gunakan JSON ini sebagai sumber konteks lengkap.

Jangan meringkasnya secara agresif.

Jangan membuang field yang berisi detail.

${formattedAnalysis}

=========================================================
BAHASA
=========================================================

Output final WAJIB Bahasa Indonesia.

Jangan menghasilkan paragraf bahasa Inggris.

Istilah teknis seperti depth of field, bokeh, close-up,
push-in, dolly-in atau framing boleh dipertahankan jika
membantu presisi.

=========================================================
KETEPATAN VISUAL
=========================================================

Jangan mengarang.

Jangan mengubah uncertainty menjadi fakta.

Jangan menambahkan:

- objek baru
- pakaian baru
- aksesori baru
- produk baru
- branding baru
- lokasi spesifik yang tidak diketahui
- kamera spesifik yang tidak diketahui
- focal length spesifik yang tidak diketahui
- identitas pribadi

Jangan mengubah warna, pola, tekstur, pose, wajah,
pakaian, aksesori, produk, komposisi, kamera, lighting,
atau background tanpa dasar dari analisis.

=========================================================
VIDEO
=========================================================

${
    isVideo
        ? `
Karena tujuan adalah video:

1. Rekonstruksi gambar awal secara sangat setia.
2. Pertahankan seluruh fakta visual.
3. Setelah itu tambahkan gerakan natural yang sangat
   terkendali.
4. Jangan mengubah identitas visual.
5. Jangan mengubah pakaian.
6. Jangan mengganti background.
7. Jangan menambahkan objek baru.

Gerakan yang boleh digunakan jika sesuai:

- kedipan mata natural
- pernapasan halus
- micro-expression kecil
- gerakan kepala sangat ringan
- gerakan tubuh alami
- gerakan kain lembut
- gerakan scarf atau hijab yang realistis
- camera push-in sangat halus
- dolly-in perlahan
- kamera stabil dengan sedikit pergerakan natural

Gerakan bukan alasan untuk mengubah tampilan subjek.
`
        : `
Karena tujuan bukan video, jangan menambahkan gerakan
atau aksi video yang tidak relevan.
`
}

=========================================================
STRUKTUR ISI YANG DIHARAPKAN
=========================================================

Tulis sebagai prompt natural yang koheren, bukan daftar.

Secara konseptual prompt harus mencakup:

1. subjek
2. penampilan
3. wajah
4. pose
5. pakaian
6. aksesori
7. produk jika ada
8. komposisi
9. kamera
10. lighting
11. lingkungan
12. background
13. warna
14. tekstur
15. visual style
16. spatial relationship
17. motion jika video
18. fidelity / negative constraints

Jangan menampilkan nomor tersebut dalam output.

=========================================================
OUTPUT
=========================================================

Keluarkan HANYA prompt final.

Jangan tampilkan:

- JSON
- analisis
- penjelasan
- reasoning
- catatan
- disclaimer
- markdown
- bullet list
- label "Prompt:"
- label "Final Prompt:"
- kalimat pembuka

Hasil harus berupa satu prompt produksi yang sangat rinci
dalam Bahasa Indonesia.
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
   PROMPT QUALITY VALIDATION
========================================================= */

function validateGeneratedPromptQuality(
    text,
    analysis
) {

    const normalized =
        String(
            text ||
            ""
        )
            .trim();


    const factCount =
        getAnalysisFactCount(
            analysis
        );


    if (
        !normalized
    ) {

        return {

            valid:
                false,

            code:
                "EMPTY_GENERATED_PROMPT",

            reason:
                "Prompt hasil generasi kosong.",

            length:
                0,

            factCount

        };

    }


    /*
     * Untuk analisis yang kaya, prompt yang terlalu pendek
     * hampir pasti berarti model kembali ke mode generic.
     */

    if (
        factCount >= 8 &&
        normalized.length <
            VISION_API_CONFIG.minPromptCharacters
    ) {

        return {

            valid:
                false,

            code:
                "PROMPT_TOO_SHORT",

            reason:
                "Prompt terlalu pendek dibandingkan jumlah fakta visual yang tersedia.",

            length:
                normalized.length,

            factCount

        };

    }


    const genericPatterns = [

        /pertahankan semua elemen visual/i,

        /pertahankan seluruh elemen visual/i,

        /buat video sinematik dari gambar referensi/i,

        /buat video sinematik yang realistis/i,

        /subjek, pakaian, aksesori, komposisi, pencahayaan/i,

        /semua elemen visual asli/i

    ];


    const genericMatches =
        genericPatterns.filter(
            pattern =>
                pattern.test(
                    normalized
                )
        );


    /*
     * Jika prompt pendek dan sekaligus menggunakan banyak
     * kalimat generic, tandai sebagai gagal.
     */

    if (
        genericMatches.length >= 2 &&
        normalized.length <
            VISION_API_CONFIG.preferredPromptCharacters
    ) {

        return {

            valid:
                false,

            code:
                "PROMPT_TOO_GENERIC",

            reason:
                "Prompt masih terlalu generik dan belum mengembangkan fakta visual.",

            length:
                normalized.length,

            factCount,

            genericMatches:
                genericMatches.length

        };

    }


    return {

        valid:
            true,

        code:
            null,

        reason:
            "",

        length:
            normalized.length,

        factCount,

        genericMatches:
            genericMatches.length

    };

}


/* =========================================================
   BUILD CORRECTIVE PROMPT
========================================================= */

function buildCorrectivePromptUserPrompt(
    analysis,
    firstPrompt,
    settings = {}
) {

    const purpose =
        settings.purpose ||
        "image-generation";


    const facts =
        formatAnalysisFacts(
            analysis
        );


    const formattedAnalysis =
        formatAnalysisForPrompt(
            analysis
        );


    return `
PROMPT SEBELUMNYA GAGAL QUALITY CHECK.

Prompt sebelumnya terlalu generik atau terlalu pendek.

Jangan mempertahankan struktur prompt sebelumnya.

Tulis ulang prompt dari awal menggunakan FAKTA VISUAL
WAJIB di bawah ini.

Tujuan:
${purpose}

=========================================================
FAKTA VISUAL WAJIB
=========================================================

${facts || "Tidak ada fakta konkret."}

=========================================================
ATURAN
=========================================================

Setiap fakta visual konkret harus diterjemahkan menjadi
kalimat konkret dalam prompt final.

Jangan mengganti fakta dengan:

"pertahankan semua elemen."

Jangan membuat prompt generik.

Jangan mengarang fakta baru.

Jangan menghilangkan detail.

Gunakan Bahasa Indonesia.

Jika ini video, jelaskan gambar awal terlebih dahulu,
kemudian gerakan yang sangat natural dan konsisten.

Prompt harus cukup panjang untuk merekonstruksi visual
referensi tanpa melihat gambar asli.

=========================================================
ANALISIS JSON
=========================================================

${formattedAnalysis}

=========================================================
PROMPT SEBELUMNYA
=========================================================

${firstPrompt}

=========================================================
OUTPUT
=========================================================

Keluarkan hanya prompt final.

Tanpa JSON.
Tanpa penjelasan.
Tanpa markdown.
Tanpa label.
`.trim();

}


/* =========================================================
   REQUEST PROMPT ENGINEERING
========================================================= */

async function requestPromptEngineering(
    model,
    analysis,
    settings,
    options = {},
    retry = false,
    previousPrompt = ""
) {

    const systemPrompt =
        buildPromptSystemPrompt();


    const userPrompt =
        retry
            ? buildCorrectivePromptUserPrompt(
                analysis,
                previousPrompt,
                settings
            )
            : buildPromptUserPrompt(
                analysis,
                settings
            );


    const response =
        await request(

            {

                model:
                    model.id,

                messages: [

                    {

                        role:
                            "system",

                        content:
                            systemPrompt

                    },

                    {

                        role:
                            "user",

                        content:
                            userPrompt

                    }

                ],

                temperature:
                    retry
                        ? VISION_API_CONFIG
                            .correctivePromptTemperature
                        : VISION_API_CONFIG
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


    return response;

}


/* =========================================================
   RUN PROMPT ENGINEERING
========================================================= */

async function generatePrompt(
    analysis,
    options = {}
) {

    /*
     * IMPORTANT:
     *
     * Jangan lagi menerima analisis kosong/pendek tanpa
     * memberi informasi diagnostik.
     *
     * analysis dapat berupa:
     *
     * 1. object hasil parse JSON
     * 2. string JSON
     */

    let sourceAnalysis =
        analysis;


    /*
     * Jika yang masuk adalah JSON string, parse terlebih
     * dahulu agar fact extractor dapat membaca seluruh
     * nested structure.
     */

    if (
        typeof sourceAnalysis ===
        "string"
    ) {

        const raw =
            sourceAnalysis.trim();


        if (
            !raw
        ) {

            throw createAPIError(

                "Visual analysis belum tersedia.",

                {

                    code:
                        "ANALYSIS_REQUIRED"

                }

            );

        }


        try {

            sourceAnalysis =
                parseJSON(
                    raw
                );

        }
        catch {

            /*
             * Jangan langsung gagal bila string ternyata
             * bukan JSON. Kita tetap bisa mengirim string
             * ke model, tetapi log harus jelas.
             */

            sourceAnalysis =
                raw;

        }

    }


    const analysisText =
        formatAnalysisForPrompt(
            sourceAnalysis
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


    const factCount =
        getAnalysisFactCount(
            sourceAnalysis
        );


    const factList =
        formatAnalysisFacts(
            sourceAnalysis
        );


    if (
        !factList ||
        factCount === 0
    ) {

        console.warn(
            "[GEN-Z.AI Vision] Prompt Engineering menerima analysis tanpa fakta leaf yang dapat diekstrak:",
            {

                analysisLength:
                    analysisText.length,

                analysisType:
                    typeof sourceAnalysis

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


    console.info(
        "[GEN-Z.AI Vision] Prompt-engineering source:",
        {

            analysisType:
                typeof sourceAnalysis,

            analysisLength:
                analysisText.length,

            factCount,

            factListLength:
                factList.length,

            model:
                model.id

        }
    );


    /*
     * =====================================================
     * FIRST REQUEST
     * =====================================================
     */

    const response =
        await requestPromptEngineering(

            model,

            sourceAnalysis,

            settings,

            options,

            false

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


    const quality =
        validateGeneratedPromptQuality(
            cleaned,
            sourceAnalysis
        );


    console.info(
        "[GEN-Z.AI Vision] Prompt-engineering quality:",
        quality
    );


    /*
     * =====================================================
     * CORRECTIVE RETRY
     * =====================================================
     *
     * Jika model kembali membuat prompt generik, jangan
     * langsung meneruskannya ke UI.
     *
     * Kita beri satu kesempatan untuk memperbaiki output
     * dengan daftar fakta yang sama.
     */

    if (
        !quality.valid
    ) {

        console.warn(
            "[GEN-Z.AI Vision] Prompt-engineering quality gate failed. Running corrective retry:",
            quality
        );


        const retryResponse =
            await requestPromptEngineering(

                model,

                sourceAnalysis,

                settings,

                options,

                true,

                cleaned

            );


        console.info(
            "[GEN-Z.AI Vision] Prompt-engineering corrective response:",
            sanitizeResponseForDebug(
                retryResponse
            )
        );


        const retryText =
            extractAssistantText(
                retryResponse
            );


        if (
            retryText
        ) {

            const retryCleaned =
                cleanGeneratedPrompt(
                    retryText
                );


            if (
                retryCleaned
            ) {

                const retryQuality =
                    validateGeneratedPromptQuality(
                        retryCleaned,
                        sourceAnalysis
                    );


                console.info(
                    "[GEN-Z.AI Vision] Prompt-engineering corrective quality:",
                    retryQuality
                );


                if (
                    retryQuality.valid
                ) {

                    return {

                        text:
                            retryCleaned,

                        raw:
                            retryResponse,

                        model

                    };

                }


                /*
                 * Bila retry masih tidak lolos, kita tidak
                 * diam-diam menganggapnya berhasil.
                 */

                throw createAPIError(

                    "Prompt Engineering menghasilkan prompt yang masih terlalu generik setelah corrective retry.",

                    {

                        code:
                            retryQuality.code ||
                            "PROMPT_QUALITY_FAILED",

                        data: {

                            firstPrompt:
                                cleaned,

                            retryPrompt:
                                retryCleaned,

                            firstQuality:
                                quality,

                            retryQuality,

                            analysisLength:
                                analysisText.length,

                            factCount

                        }

                    }

                );

            }

        }


        throw createAPIError(

            "Prompt Engineering gagal menghasilkan prompt yang valid setelah corrective retry.",

            {

                code:
                    "PROMPT_CORRECTIVE_RETRY_FAILED",

                data: {

                    firstPrompt:
                        cleaned,

                    quality,

                    analysisLength:
                        analysisText.length,

                    factCount

                }

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


    const messageContent =
        extractTextPart(
            response?.message
        );


    if (
        messageContent
    ) {

        return messageContent;

    }


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


    let parsedAnalysis;


    try {

        parsedAnalysis =
            parseJSON(
                analysis.text
            );

    }
    catch {

        parsedAnalysis =
            null;

    }


    /*
     * =====================================================
     * IMPORTANT FIX
     * =====================================================
     *
     * Jangan gunakan hasil normalize/summary sebagai sumber
     * Prompt Engineering di sini.
     *
     * Gunakan JSON Vision Analysis ASLI.
     *
     * Normalisasi tetap dikembalikan kepada caller untuk UI,
     * tetapi tidak dijadikan sumber fakta utama.
     */

    const promptSource =
        parsedAnalysis ||
        analysis.text;


    const sourceText =
        formatAnalysisForPrompt(
            promptSource
        );


    const sourceFacts =
        getAnalysisFactCount(
            promptSource
        );


    console.info(
        "[GEN-Z.AI Vision] Prompt source prepared:",
        {

            sourceType:
                typeof promptSource,

            sourceLength:
                sourceText.length,

            factCount:
                sourceFacts,

            usingParsedVisionAnalysis:
                Boolean(
                    parsedAnalysis
                )

        }
    );


    const prompt =
        await generatePrompt(

            promptSource,

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
                parsedAnalysis,

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

        buildAnalysisFactList,

        formatAnalysisFacts,

        getAnalysisFactCount,

        validateGeneratedPromptQuality,

        buildCorrectivePromptUserPrompt,

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
