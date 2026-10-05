// vision-api.js?v=2.0
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

   CATATAN:
   Semua module harus dimuat sebelum file ini.
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
   RUN COMPLETE PIPELINE
========================================================= */

async function runVisionPipeline(
    options = {}
) {

    validateVisionAPIModules();


    const analysis =
        await window.GENZVisionAnalysis
            .analyzeImage(
                options
            );


    let normalizedAnalysis;


    try {

        normalizedAnalysis =
            window.GENZVisionResponse
                .parseJSON(
                    analysis.text
                );

    }
    catch {

        normalizedAnalysis =
            null;

    }


    /*
     * Kirim normalized analysis langsung.
     *
     * Jangan kirim wrapper analysis object.
     *
     * Ini mencegah Prompt Engineering membaca
     * object yang salah.
     */

    const prompt =
        await window.GENZVisionPrompt
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
   PUBLIC API
========================================================= */

validateVisionAPIModules();


const GENZVisionAPI =
    Object.freeze({

        CONFIG:
            window.GENZVisionCore
                .CONFIG,

        request:
            window.GENZVisionCore
                .request,

        getAccessToken:
            window.GENZVisionCore
                .getAccessToken,

        getOpenKeyModels:
            window.GENZVisionModels
                .getOpenKeyModels,

        collectModalityValues:
            window.GENZVisionModels
                .collectModalityValues,

        getModelCapabilities:
            window.GENZVisionModels
                .getModelCapabilities,

        isOpenKeyDocumentedVisionModel:
            window.GENZVisionModels
                .isOpenKeyDocumentedVisionModel,

        normalizeVisionModel:
            window.GENZVisionModels
                .normalizeVisionModel,

        supportsImageInput:
            window.GENZVisionModels
                .supportsImageInput,

        resolveVisionModel:
            window.GENZVisionModels
                .resolveVisionModel,

        buildImageMessage:
            window.GENZVisionModels
                .buildImageMessage,

        getSelectedModel:
            window.GENZVisionModels
                .getSelectedModel,

        buildAnalysisSystemPrompt:
            window.GENZVisionAnalysis
                .buildAnalysisSystemPrompt,

        buildAnalysisUserPrompt:
            window.GENZVisionAnalysis
                .buildAnalysisUserPrompt,

        validateAnalysisQuality:
            window.GENZVisionAnalysis
                .validateAnalysisQuality,

        analyzeImage:
            window.GENZVisionAnalysis
                .analyzeImage,

        normalizePromptAnalysisInput:
            window.GENZVisionPrompt
                .normalizePromptAnalysisInput,

        buildDetailedAnalysisFacts:
            window.GENZVisionPrompt
                .buildDetailedAnalysisFacts,

        formatDetailedAnalysisFacts:
            window.GENZVisionPrompt
                .formatDetailedAnalysisFacts,

        formatAnalysisForPrompt:
            window.GENZVisionPrompt
                .formatAnalysisForPrompt,

        buildPromptSystemPrompt:
            window.GENZVisionPrompt
                .buildPromptSystemPrompt,

        buildPromptUserPrompt:
            window.GENZVisionPrompt
                .buildPromptUserPrompt,

        validateGeneratedPrompt:
            window.GENZVisionPrompt
                .validateGeneratedPrompt,

        generatePrompt:
            window.GENZVisionPrompt
                .generatePrompt,

        sanitizeResponseForDebug:
            window.GENZVisionResponse
                .sanitizeResponseForDebug,

        extractTextPart:
            window.GENZVisionResponse
                .extractTextPart,

        extractAssistantText:
            window.GENZVisionResponse
                .extractAssistantText,

        cleanGeneratedPrompt:
            window.GENZVisionResponse
                .cleanGeneratedPrompt,

        parseJSON:
            window.GENZVisionResponse
                .parseJSON,

        runVisionPipeline

    });


/* =========================================================
   GLOBAL EXPORT
========================================================= */

window.GENZVisionAPI =
    GENZVisionAPI;


console.info(
    "[GEN-Z.AI Vision] Vision API modules ready.",
    {

        version:
            "2.0",

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
