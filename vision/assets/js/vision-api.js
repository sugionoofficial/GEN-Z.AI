//vision-api.js?v=1.2
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
   - Tidak mengatur DOM
   - Tidak memotong credit
   - Tidak menyimpan history
   - Tidak menyimpan API key di browser
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
        5000

});


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

    } catch {

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

    } catch (error) {

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

    } finally {

        clear();

    }

}


/* =========================================================
   OPENKEY MODEL CATALOG
   ---------------------------------------------------------
   Model tidak boleh ditebak atau di-hardcode.

   Browser meminta katalog melalui endpoint GEN-Z.AI.
   API key OpenKey tetap server-side.
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


    return models;

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


    const inputModalities =
        Array.isArray(
            model.input_modalities
        )
            ? model.input_modalities
                .map(
                    value =>
                        String(
                            value || ""
                        )
                            .trim()
                            .toLowerCase()
                )
                .filter(Boolean)
            : [];


    const outputModalities =
        Array.isArray(
            model.output_modalities
        )
            ? model.output_modalities
                .map(
                    value =>
                        String(
                            value || ""
                        )
                            .trim()
                            .toLowerCase()
                )
                .filter(Boolean)
            : [];


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
            outputModalities

    };

}


/* =========================================================
   IMAGE INPUT DETECTION
   ---------------------------------------------------------
   Hanya menganggap model Vision apabila katalog OpenKey
   secara eksplisit menyatakan dukungan image / vision /
   multimodal.

   Tidak menebak berdasarkan nama model.
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
        normalized.input_modalities;


    return modalities.some(
        modality => [

            "image",

            "vision",

            "multimodal",

            "image_url"

        ].includes(
            modality
        )
    );

}


/* =========================================================
   RESOLVE VISION MODEL
   ---------------------------------------------------------
   Urutan:
   1. Model yang sedang dipilih jika tersedia
      dan mendukung image.
   2. Model Vision pertama dari katalog OpenKey.
   3. Jika tidak ada model image-capable,
      hentikan proses dengan error yang jelas.

   Tidak ada fallback ke:
   gemini-3.1-pro
   atau model ID buatan lain.
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


    /* =====================================================
       REQUESTED MODEL
    ===================================================== */

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


    /* =====================================================
       FIND IMAGE MODEL
    ===================================================== */

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
                                    model.input_modalities

                            })
                        )

                }

            }

        );

    }


    const selected =
        visionModels[0];


    /* =====================================================
       SYNC STATE
    ===================================================== */

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
22. uncertainty

Rules:

- Describe only what is actually visible.
- Do not invent hidden details.
- If something cannot be determined, use null or "unknown".
- Preserve important spatial relationships.
- Identify products and visible branding carefully.
- Do not claim that a person is a specific real person.
- Do not infer private identity.
- Separate visible facts from uncertainty.

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

Analysis detail level:
${detail}

Intended purpose:
${purpose}

Additional user instruction:
${instruction || "None"}

Produce structured visual analysis based strictly on the image.
`.trim();

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

Convert structured visual analysis into one high-quality, ultra-detailed image prompt.

The final prompt must preserve the important visual characteristics of the reference image.

Include, when available:

- subject
- physical appearance
- face and hair
- pose
- clothing
- accessories
- product
- composition
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

The prompt must be practical for an image generation model.

Do not add details that are not supported by the visual analysis unless the user explicitly requested them.

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


    return `
Create the final production-ready prompt from this visual analysis.

Target purpose:
${purpose}

Requested detail:
${detail}

Additional instruction:
${instruction || "None"}

VISUAL ANALYSIS:

${formatAnalysisForPrompt(
    analysis
)}
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

    } catch {

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


    const state =
        getState();


    const requestedModel =
        options.model ||
        getSelectedModel();


    /*
     * Prompt engineering tidak mengirim image,
     * tetapi menggunakan model OpenKey yang sama
     * setelah model Vision berhasil ditentukan.
     *
     * resolveVisionModel() memastikan model masih
     * benar-benar tersedia di katalog OpenKey.
     */

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


    return {

        text:
            cleanGeneratedPrompt(
                text
            ),

        raw:
            response,

        model

    };

}


/* =========================================================
   EXTRACT ASSISTANT TEXT
   ---------------------------------------------------------
   Mendukung:

   1. GEN-Z.AI normalized response
      response.content

   2. normalized message
      response.message.content

   3. OpenAI-compatible response
      response.choices[0].message.content

   4. content array

   5. output_text

   6. text
========================================================= */

function extractAssistantText(
    response
) {

    /* =====================================================
       1. GEN-Z.AI NORMALIZED RESPONSE
    ===================================================== */

    if (
        typeof response?.content ===
        "string"
    ) {

        const content =
            response.content.trim();


        if (
            content
        ) {

            return content;

        }

    }


    /* =====================================================
       2. NORMALIZED MESSAGE
    ===================================================== */

    if (
        typeof response?.message?.content ===
        "string"
    ) {

        const content =
            response.message.content.trim();


        if (
            content
        ) {

            return content;

        }

    }


    /* =====================================================
       3. OPENAI-COMPATIBLE RESPONSE
    ===================================================== */

    const choiceContent =
        response
            ?.choices?.[0]
            ?.message
            ?.content;


    if (
        typeof choiceContent ===
        "string"
    ) {

        const content =
            choiceContent.trim();


        if (
            content
        ) {

            return content;

        }

    }


    /* =====================================================
       4. NORMALIZED MESSAGE CONTENT ARRAY
    ===================================================== */

    if (
        Array.isArray(
            response?.message?.content
        )
    ) {

        const content =
            response.message.content

                .map(
                    part => {

                        if (
                            typeof part ===
                            "string"
                        ) {

                            return part;

                        }


                        if (
                            typeof part?.text ===
                            "string"
                        ) {

                            return part.text;

                        }


                        return "";

                    }
                )

                .join("")

                .trim();


        if (
            content
        ) {

            return content;

        }

    }


    /* =====================================================
       5. OPENAI CHOICES CONTENT ARRAY
    ===================================================== */

    if (
        Array.isArray(
            choiceContent
        )
    ) {

        const content =
            choiceContent

                .map(
                    part => {

                        if (
                            typeof part ===
                            "string"
                        ) {

                            return part;

                        }


                        if (
                            typeof part?.text ===
                            "string"
                        ) {

                            return part.text;

                        }


                        return "";

                    }
                )

                .join("")

                .trim();


        if (
            content
        ) {

            return content;

        }

    }


    /* =====================================================
       6. OUTPUT TEXT
    ===================================================== */

    if (
        typeof response?.output_text ===
        "string"
    ) {

        const content =
            response.output_text.trim();


        if (
            content
        ) {

            return content;

        }

    }


    /* =====================================================
       7. TEXT
    ===================================================== */

    if (
        typeof response?.text ===
        "string"
    ) {

        const content =
            response.text.trim();


        if (
            content
        ) {

            return content;

        }

    }


    /* =====================================================
       8. NO CONTENT
    ===================================================== */

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
        result.startsWith(
            "```"
        ) &&
        result.endsWith(
            "```"
        )
    ) {

        result =
            result
                .replace(
                    /^```[a-zA-Z0-9_-]*\s*/,
                    ""
                )
                .replace(
                    /\s*```$/,
                    ""
                )
                .trim();

    }


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

    } catch {

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

            } catch {

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

    } catch {

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

        normalizeVisionModel,

        supportsImageInput,

        resolveVisionModel,

        buildImageMessage,

        buildAnalysisSystemPrompt,

        buildAnalysisUserPrompt,

        analyzeImage,

        buildPromptSystemPrompt,

        buildPromptUserPrompt,

        generatePrompt,

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
