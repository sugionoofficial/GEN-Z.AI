/* =========================================================
   GEN-Z.AI VISION
   ---------------------------------------------------------
   File:
   vision/assets/js/vision-api.js

   Fungsi:
   - Entry point Vision API
   - Menyatukan seluruh module API
   - Menjalankan pipeline Analysis -> Prompt
   - Public API tetap window.GENZVisionAPI

   MODULE:
   - vision-api-core.js
   - vision-api-models.js
   - vision-api-response.js
   - vision-api-analysis.js
   - vision-api-prompt.js

   PENTING:
   - Tidak melakukan dependency validation di top-level
     sebelum module lain siap.
   - Tidak membaca dependency API secara eager ketika
     module pertama kali dievaluasi.
   - Dependency divalidasi ketika API benar-benar digunakan.
   - Kegagalan API tidak boleh menghentikan loader Vision.
   - validateModules menjadi bagian dari object sebelum
     Object.freeze().
========================================================= */


/* =========================================================
   DEPENDENCY VALIDATION
========================================================= */

function validateVisionAPIModules() {

    const required = [
        ["GENZVisionCore", window.GENZVisionCore],
        ["GENZVisionModels", window.GENZVisionModels],
        ["GENZVisionResponse", window.GENZVisionResponse],
        ["GENZVisionAnalysis", window.GENZVisionAnalysis],
        ["GENZVisionPrompt", window.GENZVisionPrompt]
    ];

    const missing = required
        .filter(([ , module ]) => !module)
        .map(([name]) => name);

    if (missing.length) {

        throw new Error(
            `[GEN-Z.AI Vision] Module API belum dimuat: ${missing.join(", ")}`
        );

    }

    return true;
}


/* =========================================================
   LAZY DEPENDENCY ACCESS
   ---------------------------------------------------------
   Jangan mengambil dependency saat module pertama kali
   dievaluasi. Ambil hanya ketika fungsi benar-benar dipakai.
========================================================= */

function getCore() {

    validateVisionAPIModules();

    return window.GENZVisionCore;
}


function getModels() {

    validateVisionAPIModules();

    return window.GENZVisionModels;
}


function getResponse() {

    validateVisionAPIModules();

    return window.GENZVisionResponse;
}


function getAnalysis() {

    validateVisionAPIModules();

    return window.GENZVisionAnalysis;
}


function getPrompt() {

    validateVisionAPIModules();

    return window.GENZVisionPrompt;
}


/* =========================================================
   VISION PIPELINE
   ---------------------------------------------------------
   Analysis
      ↓
   Normalize Analysis
      ↓
   Prompt Engineering
========================================================= */

async function runVisionPipeline(options = {}) {

    validateVisionAPIModules();

    const analysisModule = getAnalysis();
    const responseModule = getResponse();
    const promptModule = getPrompt();


    /* -----------------------------------------------------
       STEP 1
       IMAGE ANALYSIS
    ----------------------------------------------------- */

    const analysis =
        await analysisModule.analyzeImage(options);


    /* -----------------------------------------------------
       STEP 2
       NORMALIZE ANALYSIS
    ----------------------------------------------------- */

    let normalizedAnalysis = null;

    try {

        normalizedAnalysis =
            responseModule.parseJSON(
                analysis.text
            );

    } catch {

        normalizedAnalysis = null;

    }


    /* -----------------------------------------------------
       STEP 3
       PROMPT ENGINEERING
    ----------------------------------------------------- */

    const prompt =
        await promptModule.generatePrompt(
            normalizedAnalysis || analysis.text,
            {
                ...options,
                model: analysis.model
            }
        );


    /* -----------------------------------------------------
       RESULT
    ----------------------------------------------------- */

    return {

        analysis: {

            text: analysis.text,

            normalized: normalizedAnalysis,

            raw: analysis.raw

        },

        prompt: {

            text: prompt.text,

            raw: prompt.raw

        },

        model: analysis.model

    };

}


/* =========================================================
   CORE API
========================================================= */

function getConfig() {

    return getCore().CONFIG;

}


async function request(options = {}) {

    return getCore().request(options);

}


async function getAccessToken() {

    return getCore().getAccessToken();

}


/* =========================================================
   MODEL API
========================================================= */

async function getOpenKeyModels() {

    return getModels().getOpenKeyModels();

}


function collectModalityValues(model, key) {

    return getModels().collectModalityValues(
        model,
        key
    );

}


function getModelCapabilities(model) {

    return getModels().getModelCapabilities(
        model
    );

}


function isOpenKeyDocumentedVisionModel(model) {

    return getModels().isOpenKeyDocumentedVisionModel(
        model
    );

}


function normalizeVisionModel(model) {

    return getModels().normalizeVisionModel(
        model
    );

}


function supportsImageInput(model) {

    return getModels().supportsImageInput(
        model
    );

}


async function resolveVisionModel(modelId) {

    return getModels().resolveVisionModel(
        modelId
    );

}


function buildImageMessage(
    dataUrl,
    options = {}
) {

    return getModels().buildImageMessage(
        dataUrl,
        options
    );

}


function getSelectedModel() {

    return getModels().getSelectedModel();

}


/* =========================================================
   ANALYSIS API
========================================================= */

function buildAnalysisSystemPrompt(
    options = {}
) {

    return getAnalysis().buildAnalysisSystemPrompt(
        options
    );

}


function buildAnalysisUserPrompt(
    options = {}
) {

    return getAnalysis().buildAnalysisUserPrompt(
        options
    );

}


function validateAnalysisQuality(
    text,
    options = {}
) {

    return getAnalysis().validateAnalysisQuality(
        text,
        options
    );

}


async function analyzeImage(
    options = {}
) {

    return getAnalysis().analyzeImage(
        options
    );

}


/* =========================================================
   PROMPT ENGINEERING API
========================================================= */

function normalizePromptAnalysisInput(input) {

    return getPrompt().normalizePromptAnalysisInput(
        input
    );

}


function buildDetailedAnalysisFacts(analysis) {

    return getPrompt().buildDetailedAnalysisFacts(
        analysis
    );

}


function formatDetailedAnalysisFacts(facts) {

    return getPrompt().formatDetailedAnalysisFacts(
        facts
    );

}


function formatAnalysisForPrompt(analysis) {

    return getPrompt().formatAnalysisForPrompt(
        analysis
    );

}


function buildPromptSystemPrompt(
    options = {}
) {

    return getPrompt().buildPromptSystemPrompt(
        options
    );

}


function buildPromptUserPrompt(
    analysis,
    options = {}
) {

    return getPrompt().buildPromptUserPrompt(
        analysis,
        options
    );

}


function validateGeneratedPrompt(
    text,
    options = {}
) {

    return getPrompt().validateGeneratedPrompt(
        text,
        options
    );

}


async function generatePrompt(
    analysis,
    options = {}
) {

    return getPrompt().generatePrompt(
        analysis,
        options
    );

}


/* =========================================================
   RESPONSE API
========================================================= */

function sanitizeResponseForDebug(response) {

    return getResponse().sanitizeResponseForDebug(
        response
    );

}


function extractTextPart(part) {

    return getResponse().extractTextPart(
        part
    );

}


function extractAssistantText(response) {

    return getResponse().extractAssistantText(
        response
    );

}


function cleanGeneratedPrompt(text) {

    return getResponse().cleanGeneratedPrompt(
        text
    );

}


function parseJSON(text) {

    return getResponse().parseJSON(
        text
    );

}


/* =========================================================
   PUBLIC API
   ---------------------------------------------------------
   Semua dependency dibungkus function lazy.
   Tidak ada dereference seperti:

       window.GENZVisionCore.request

   pada saat module pertama kali dimuat.
========================================================= */

const GENZVisionAPI = Object.freeze({

    /* -----------------------------------------------------
       CORE
    ----------------------------------------------------- */

    get CONFIG() {

        return getConfig();

    },

    request,

    getAccessToken,


    /* -----------------------------------------------------
       MODELS
    ----------------------------------------------------- */

    getOpenKeyModels,

    collectModalityValues,

    getModelCapabilities,

    isOpenKeyDocumentedVisionModel,

    normalizeVisionModel,

    supportsImageInput,

    resolveVisionModel,

    buildImageMessage,

    getSelectedModel,


    /* -----------------------------------------------------
       ANALYSIS
    ----------------------------------------------------- */

    buildAnalysisSystemPrompt,

    buildAnalysisUserPrompt,

    validateAnalysisQuality,

    analyzeImage,


    /* -----------------------------------------------------
       PROMPT ENGINEERING
    ----------------------------------------------------- */

    normalizePromptAnalysisInput,

    buildDetailedAnalysisFacts,

    formatDetailedAnalysisFacts,

    formatAnalysisForPrompt,

    buildPromptSystemPrompt,

    buildPromptUserPrompt,

    validateGeneratedPrompt,

    generatePrompt,


    /* -----------------------------------------------------
       RESPONSE
    ----------------------------------------------------- */

    sanitizeResponseForDebug,

    extractTextPart,

    extractAssistantText,

    cleanGeneratedPrompt,

    parseJSON,


    /* -----------------------------------------------------
       PIPELINE
    ----------------------------------------------------- */

    runVisionPipeline,


    /* -----------------------------------------------------
       DIAGNOSTIC
       -----------------------------------------------------
       Dimasukkan SEBELUM Object.freeze(), sehingga tidak
       terjadi lagi:

       Cannot add property validateModules,
       object is not extensible
    ----------------------------------------------------- */

    validateModules: validateVisionAPIModules

});


/* =========================================================
   GLOBAL EXPORT
========================================================= */

window.GENZVisionAPI = GENZVisionAPI;


/* =========================================================
   READY LOG
========================================================= */

console.info(
    "[GEN-Z.AI Vision] Vision API entry point ready.",
    {
        version: "2.1.1",

        modules: [
            "core",
            "models",
            "response",
            "analysis",
            "prompt",
            "entry"
        ]
    }
);
