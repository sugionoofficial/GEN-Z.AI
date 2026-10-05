// vision-api.js?v=1.6
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

    /*
     * Minimum panjang analysis setelah diekstrak.
     *
     * Ini bukan validasi bahwa JSON harus mempunyai
     * jumlah karakter tertentu secara mutlak.
     *
     * Tujuannya hanya mencegah response kosong,
     * refusal, atau response palsu diteruskan
     * ke Prompt Engineering.
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


    /*
     * Jika UI sudah memilih model tertentu,
     * model tersebut harus dicari kembali di
     * katalog OpenKey.
     */
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

Your task is to analyze the supplied reference image with high visual accuracy.

IMPORTANT:
The user has supplied an actual reference image.
You MUST inspect the image itself before answering.

Do NOT generate a final creative prompt yet.

First extract the observable visual information into structured JSON.

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

- Describe only what is actually visible.
- Do not invent hidden details.
- If something cannot be determined, use null or "unknown".
- Preserve important spatial relationships.
- Identify products and visible branding carefully.
- Do not claim that a person is a specific real person.
- Do not infer private identity.
- Separate visible facts from uncertainty.
- Do not respond that visual details were not provided when an image is attached.
- Do not produce a generic refusal when the image is available.
- The purpose is detailed visual observation, not creative generation.

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

Inspect the attached image carefully.

Describe the visible subject, character appearance,
pose, body position, clothing, accessories,
product, composition, framing, camera perspective,
lighting, environment, background, colors, style,
textures, visible text, branding, and important
spatial relationships.

Produce structured visual analysis based strictly
on what is visible in the image.

Do not answer with a generic statement that visual
details are unavailable.
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


    /*
     * Response refusal yang tidak boleh diteruskan
     * ke Prompt Engineering.
     *
     * Pemeriksaan dibuat case-insensitive.
     */
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


    /*
     * Analysis JSON yang benar biasanya jauh lebih
     * informatif daripada response satu-dua kalimat.
     *
     * Minimum ini hanya sebagai safety net.
     */
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
You are the prompt engineering engine of GEN-Z.AI Vision.

Convert the supplied structured visual analysis into
one high-quality, ultra-detailed image-generation prompt.

The visual analysis was produced from an actual reference
image. Treat it as the source of truth.

The final prompt must preserve the important visual
characteristics of the reference image.

Include, when available:

- subject
- physical appearance
- face and hair
- pose
- body position
- clothing
- accessories
- product
- composition
- spatial relationships
- camera angle
- framing
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
- visible branding or text

The prompt must be practical for an image generation model.

Do not add details that are not supported by the visual
analysis unless the user explicitly requested them.

Do not replace missing visual information with invented
specific details.

Do not say that visual details are unavailable if the
analysis contains usable visual information.

Do not include explanations before or after the prompt.

Return only the final prompt as plain text.
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
Create the final production-ready image-generation
prompt from this visual analysis.

Target purpose:
${purpose}

Requested detail:
${detail}

Additional instruction:
${instruction || "None"}

IMPORTANT:

The VISUAL ANALYSIS below was generated from the actual
reference image.

Preserve the visual structure of the reference.

Do not invent unsupported visual details.

VISUAL ANALYSIS:

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

    /*
     * =====================================================
     * PENTING
     *
     * Jangan melakukan validateAnalysisQuality()
     * di sini.
     *
     * analyzeImage() sudah bertanggung jawab memastikan
     * analysis valid.
     *
     * analysis di sini juga bisa berupa object hasil
     * parseJSON(), sehingga validasi berbasis panjang
     * string mentah dapat salah.
     * =====================================================
     */

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
   ---------------------------------------------------------
   Tidak mengubah response asli.
   Tidak membuang response yang diperlukan pipeline.
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
     * Response wrappers.
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
     * Responses API / provider parts.
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
   ---------------------------------------------------------
   Parser response dibuat lebih toleran.

   Didukung:

   1. response.content
   2. response.message.content
   3. response.choices[].message.content
   4. response.message.content[]
   5. response.choices[].message.content[]
   6. response.output_text
   7. response.text
   8. response.data.*
   9. response.result.*
   10. response.response.*
   11. response.output.*
   12. Responses API output[].content[].text
   13. nested provider wrapper
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


    /*
     * Direct string.
     */

    if (
        typeof response ===
        "string"
    ) {

        return response.trim();

    }


    /*
     * =====================================================
     * 1. GEN-Z.AI NORMALIZED RESPONSE
     * =====================================================
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
     * =====================================================
     * 2. NORMALIZED MESSAGE
     * =====================================================
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
     * =====================================================
     * 3. OPENAI COMPATIBLE CHOICES
     * =====================================================
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
     * =====================================================
     * 4. OUTPUT TEXT
     * =====================================================
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
     * =====================================================
     * 5. DIRECT TEXT
     * =====================================================
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
     * =====================================================
     * 6. DATA WRAPPER
     * =====================================================
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
     * =====================================================
     * 7. RESULT WRAPPER
     * =====================================================
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
     * =====================================================
     * 8. RESPONSE WRAPPER
     * =====================================================
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
     * =====================================================
     * 9. OUTPUT WRAPPER
     * =====================================================
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
     * =====================================================
     * 10. GENERIC FALLBACK
     * =====================================================
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
