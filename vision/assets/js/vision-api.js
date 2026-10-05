// vision-api.js?v=2.1
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
   - Tidak melakukan dependency validation di top-level.
   - Tidak membaca dependency API secara eager ketika
     module pertama kali dievaluasi.
   - Dependency divalidasi ketika API benar-benar digunakan.
   - Kegagalan API tidak boleh menghentikan loader Vision.
========================================================= */


/* =========================================================
   DEPENDENCY CHECK
========================================================= */

function validateVisionAPIModules() {

    const required = [

        [
            "GENZVisionCore",
            window.GENZVisionCore
        ],

        [
            "GENZVisionModels",
            window.GENZVisionModels
        ],

        [
            "GENZVisionResponse",
            window.GENZVisionResponse
        ],

        [
            "GENZVisionAnalysis",
            window.GENZVisionAnalysis
        ],

        [
            "GENZVisionPrompt",
            window.GENZVisionPrompt
        ]

    ];


    const missing =
        required
            .filter(
                (
                    [
                        ,
                        module
                    ]
                ) =>
                    !module
            )
            .map(
                (
                    [
                        name
                    ]
                ) =>
                    name
            );


    if (
        missing.length
    ) {

        throw new Error(

            `[GEN-Z.AI Vision] Module API belum dimuat: ${missing.join(", ")}`

        );

    }


    return true;

}


/* =========================================================
   API MODULE ACCESSORS
   ---------------------------------------------------------
   Dependency diambil saat fungsi dipanggil.
   Bukan saat vision-api.js pertama kali dievaluasi.
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
   RUN COMPLETE PIPELINE
========================================================= */

async function runVisionPipeline(
    options = {}
) {

    validateVisionAPIModules();


    const analysisModule =
        getAnalysis();


    const responseModule =
        getResponse();


    const promptModule =
        getPrompt();


    const analysis =
        await analysisModule
            .analyzeImage(
                options
            );


    let normalizedAnalysis;


    try {

        normalizedAnalysis =
            responseModule
                .parseJSON(
                    analysis.text
                );

    }
    catch {

        normalizedAnalysis =
            null;

    }


    /*
     * -----------------------------------------------------
     * PROMPT ENGINEERING INPUT
     * -----------------------------------------------------
     *
     * Jika response Vision merupakan JSON valid,
     * kirim object hasil parse.
     *
     * Jika bukan JSON valid, kirim text mentah.
     *
     * Jangan mengirim wrapper:
     *
     * {
     *     analysis: ...
     * }
     *
     * karena Prompt Engineering membutuhkan
     * isi analysis sebenarnya.
     * -----------------------------------------------------
     */

    const prompt =
        await promptModule
            .generatePrompt(

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
   SAFE API WRAPPERS
   ---------------------------------------------------------
   Semua fungsi mengambil dependency ketika dipanggil.
   Ini mencegah eager dependency access saat module load.
========================================================= */


/* =========================================================
   CORE
========================================================= */

function getConfig() {

    return getCore().CONFIG;

}


async function request(
    options = {}
) {

    return getCore()
        .request(
            options
        );

}


async function getAccessToken() {

    return getCore()
        .getAccessToken();

}


/* =========================================================
   MODELS
========================================================= */

async function getOpenKeyModels() {

    return getModels()
        .getOpenKeyModels();

}


function collectModalityValues(
    model,
    key
) {

    return getModels()
        .collectModalityValues(
            model,
            key
        );

}


function getModelCapabilities(
    model
) {

    return getModels()
        .getModelCapabilities(
            model
        );

}


function isOpenKeyDocumentedVisionModel(
    model
) {

    return getModels()
        .isOpenKeyDocumentedVisionModel(
            model
        );

}


function normalizeVisionModel(
    model
) {

    return getModels()
        .normalizeVisionModel(
            model
        );

}


function supportsImageInput(
    model
) {

    return getModels()
        .supportsImageInput(
            model
        );

}


async function resolveVisionModel(
    modelId
) {

    return getModels()
        .resolveVisionModel(
            modelId
        );

}


function buildImageMessage(
    dataUrl,
    options = {}
) {

    return getModels()
        .buildImageMessage(
            dataUrl,
            options
        );

}


function getSelectedModel() {

    return getModels()
        .getSelectedModel();

}


/* =========================================================
   ANALYSIS
========================================================= */

function buildAnalysisSystemPrompt(
    options = {}
) {

    return getAnalysis()
        .buildAnalysisSystemPrompt(
            options
        );

}


function buildAnalysisUserPrompt(
    options = {}
) {

    return getAnalysis()
        .buildAnalysisUserPrompt(
            options
        );

}


function validateAnalysisQuality(
    text,
    options = {}
) {

    return getAnalysis()
        .validateAnalysisQuality(
            text,
            options
        );

}


async function analyzeImage(
    options = {}
) {

    return getAnalysis()
        .analyzeImage(
            options
        );

}


/* =========================================================
   PROMPT
========================================================= */

function normalizePromptAnalysisInput(
    input
) {

    return getPrompt()
        .normalizePromptAnalysisInput(
            input
        );

}


function buildDetailedAnalysisFacts(
    analysis
) {

    return getPrompt()
        .buildDetailedAnalysisFacts(
            analysis
        );

}


function formatDetailedAnalysisFacts(
    facts
) {

    return getPrompt()
        .formatDetailedAnalysisFacts(
            facts
        );

}


function formatAnalysisForPrompt(
    analysis
) {

    return getPrompt()
        .formatAnalysisForPrompt(
            analysis
        );

}


function buildPromptSystemPrompt(
    options = {}
) {

    return getPrompt()
        .buildPromptSystemPrompt(
            options
        );

}


function buildPromptUserPrompt(
    analysis,
    options = {}
) {

    return getPrompt()
        .buildPromptUserPrompt(
            analysis,
            options
        );

}


function validateGeneratedPrompt(
    text,
    options = {}
) {

    return getPrompt()
        .validateGeneratedPrompt(
            text,
            options
        );

}


async function generatePrompt(
    analysis,
    options = {}
) {

    return getPrompt()
        .generatePrompt(
            analysis,
            options
        );

}


/* =========================================================
   RESPONSE
========================================================= */

function sanitizeResponseForDebug(
    response
) {

    return getResponse()
        .sanitizeResponseForDebug(
            response
        );

}


function extractTextPart(
    part
) {

    return getResponse()
        .extractTextPart(
            part
        );

}


function extractAssistantText(
    response
) {

    return getResponse()
        .extractAssistantText(
            response
        );

}


function cleanGeneratedPrompt(
    text
) {

    return getResponse()
        .cleanGeneratedPrompt(
            text
        );

}


function parseJSON(
    text
) {

    return getResponse()
        .parseJSON(
            text
        );

}


/* =========================================================
   PUBLIC API
   ---------------------------------------------------------
   API object dibuat tanpa mengakses dependency module
   secara eager.
========================================================= */

const GENZVisionAPI =
    Object.freeze({

        /* ---------------------------------------------
           CORE
        --------------------------------------------- */

        get CONFIG() {

            return getConfig();

        },

        request,

        getAccessToken,


        /* ---------------------------------------------
           MODELS
        --------------------------------------------- */

        getOpenKeyModels,

        collectModalityValues,

        getModelCapabilities,

        isOpenKeyDocumentedVisionModel,

        normalizeVisionModel,

        supportsImageInput,

        resolveVisionModel,

        buildImageMessage,

        getSelectedModel,


        /* ---------------------------------------------
           ANALYSIS
        --------------------------------------------- */

        buildAnalysisSystemPrompt,

        buildAnalysisUserPrompt,

        validateAnalysisQuality,

        analyzeImage,


        /* ---------------------------------------------
           PROMPT
        --------------------------------------------- */

        normalizePromptAnalysisInput,

        buildDetailedAnalysisFacts,

        formatDetailedAnalysisFacts,

        formatAnalysisForPrompt,

        buildPromptSystemPrompt,

        buildPromptUserPrompt,

        validateGeneratedPrompt,

        generatePrompt,


        /* ---------------------------------------------
           RESPONSE
        --------------------------------------------- */

        sanitizeResponseForDebug,

        extractTextPart,

        extractAssistantText,

        cleanGeneratedPrompt,

        parseJSON,


        /* ---------------------------------------------
           PIPELINE
        --------------------------------------------- */

        runVisionPipeline

    });


/* =========================================================
   GLOBAL EXPORT
========================================================= */

window.GENZVisionAPI =
    GENZVisionAPI;


/* =========================================================
   GLOBAL VALIDATION HELPER
   ---------------------------------------------------------
   Tidak dijalankan otomatis.
   Hanya tersedia untuk debugging / diagnostics.
========================================================= */

window.GENZVisionAPI.validateModules =
    validateVisionAPIModules;


/* =========================================================
   READY LOG
========================================================= */

console.info(
    "[GEN-Z.AI Vision] Vision API entry point ready.",
    {

        version:
            "2.1",

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
