/* =========================================================
   GEN-Z.AI VISION
   ---------------------------------------------------------
   File:
   vision/assets/js/vision-api-prompt.js

   Fungsi:
   - Normalize visual analysis input
   - Extract concrete visual facts
   - Prompt Engineering
   - Validasi prompt
   - Retry jika output masih generik
========================================================= */


/* =========================================================
   CORE REFERENCES
========================================================= */

function promptCore() {

    return window.GENZVisionCore;

}


function promptModels() {

    return window.GENZVisionModels;

}


function promptResponse() {

    return window.GENZVisionResponse;

}


/* =========================================================
   ANALYSIS STRUCTURE KEYS
========================================================= */

const PROMPT_ANALYSIS_KEYS =
    Object.freeze([

        "subject",

        "appearance",

        "face_hair",

        "faceHair",

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

        "colorPalette",

        "visual_style",

        "visualStyle",

        "text_branding",

        "textBranding",

        "image_quality",

        "imageQuality",

        "important_details",

        "importantDetails",

        "spatial_relationships",

        "spatialRelationships",

        "uncertainties"

    ]);


/* =========================================================
   NORMALIZE PROMPT ANALYSIS INPUT
========================================================= */

function normalizePromptAnalysisInput(
    input
) {

    if (
        input === null ||
        input === undefined
    ) {

        return null;

    }


    if (
        typeof input ===
        "string"
    ) {

        const text =
            input.trim();


        if (
            !text
        ) {

            return null;

        }


        try {

            return normalizePromptAnalysisInput(
                JSON.parse(
                    text
                )
            );

        }
        catch {

            return {

                raw_text:
                    text

            };

        }

    }


    if (
        typeof input !==
        "object"
    ) {

        return null;

    }


    const hasAnalysisStructure =
        PROMPT_ANALYSIS_KEYS.some(
            key =>
                Object.prototype.hasOwnProperty.call(
                    input,
                    key
                )
        );


    if (
        hasAnalysisStructure
    ) {

        return input;

    }


    const wrappers = [

        "normalized",

        "analysis",

        "visualAnalysis",

        "visual_analysis",

        "data",

        "result"

    ];


    for (
        const key of wrappers
    ) {

        if (
            input[key] === null ||
            input[key] === undefined
        ) {

            continue;

        }


        const nested =
            normalizePromptAnalysisInput(
                input[key]
            );


        if (
            nested &&
            (
                Object.keys(
                    nested
                ).length > 0
            )
        ) {

            return nested;

        }

    }


    const textKeys = [

        "text",

        "content"

    ];


    for (
        const key of textKeys
    ) {

        if (
            typeof input[key] !==
            "string"
        ) {

            continue;

        }


        const nested =
            normalizePromptAnalysisInput(
                input[key]
            );


        if (
            nested &&
            Object.keys(
                nested
            ).length > 0
        ) {

            return nested;

        }

    }


    return input;

}


/* =========================================================
   EMPTY VALUE CHECK
========================================================= */

function isMeaningfulPromptValue(
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
            value.trim().toLowerCase();


        return Boolean(
            normalized &&
            normalized !== "unknown" &&
            normalized !== "null" &&
            normalized !== "n/a" &&
            normalized !== "none"
        );

    }


    if (
        typeof value === "number" ||
        typeof value === "boolean"
    ) {

        return true;

    }


    if (
        Array.isArray(value)
    ) {

        return value.some(
            isMeaningfulPromptValue
        );

    }


    if (
        typeof value === "object"
    ) {

        return Object.values(
            value
        )
            .some(
                isMeaningfulPromptValue
            );

    }


    return false;

}


/* =========================================================
   LABEL FORMATTER
========================================================= */

function formatFactKey(
    key
) {

    const labels = {

        subject:
            "Subjek",

        appearance:
            "Penampilan",

        face_hair:
            "Wajah dan rambut",

        pose:
            "Pose",

        clothing:
            "Pakaian",

        accessories:
            "Aksesori",

        product:
            "Produk",

        composition:
            "Komposisi",

        camera:
            "Kamera",

        lighting:
            "Pencahayaan",

        shadows:
            "Bayangan",

        environment:
            "Lingkungan",

        background:
            "Latar belakang",

        color_palette:
            "Palet warna",

        visual_style:
            "Gaya visual",

        text_branding:
            "Teks dan branding",

        image_quality:
            "Kualitas gambar",

        important_details:
            "Detail penting",

        spatial_relationships:
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
        key
    )
        .replace(
            /([a-z])([A-Z])/g,
            "$1 $2"
        )
        .replace(
            /[_-]+/g,
            " "
        )
        .trim();

}


/* =========================================================
   BUILD LEAF FACTS
========================================================= */

function buildDetailedAnalysisFacts(
    analysis
) {

    const facts = [];


    function walk(
        value,
        path = []
    ) {

        if (
            value === null ||
            value === undefined
        ) {

            return;

        }


        if (
            typeof value === "string" ||
            typeof value === "number" ||
            typeof value === "boolean"
        ) {

            if (
                !isMeaningfulPromptValue(
                    value
                )
            ) {

                return;

            }


            facts.push({

                path:
                    path.join("."),

                value:
                    String(
                        value
                    ).trim()

            });


            return;

        }


        if (
            Array.isArray(value)
        ) {

            value.forEach(
                (
                    item,
                    index
                ) => {

                    walk(
                        item,
                        [
                            ...path,
                            `[${index}]`
                        ]
                    );

                }
            );


            return;

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
                            child
                        ]
                    ) => {

                        if (
                            !isMeaningfulPromptValue(
                                child
                            )
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
   FORMAT FACTS
========================================================= */

function formatDetailedAnalysisFacts(
    facts
) {

    if (
        !Array.isArray(facts) ||
        facts.length === 0
    ) {

        return "";

    }


    return facts
        .map(
            (
                fact,
                index
            ) => {

                const path =
                    fact.path
                        .split(".")
                        .map(
                            part =>
                                part
                                    .replace(
                                        /^\[/,
                                        ""
                                    )
                                    .replace(
                                        /\]$/,
                                        ""
                                    )
                        )
                        .map(
                            formatFactKey
                        )
                        .join(" > ");


                return `${index + 1}. ${path}: ${fact.value}`;

            }
        )
        .join("\n");

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
        analysis === null ||
        analysis === undefined
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
   PROMPT SYSTEM
========================================================= */

function buildPromptSystemPrompt() {

    return `
You are the advanced prompt engineering engine of GEN-Z.AI Vision.

Transform the supplied structured visual analysis into ONE
extremely detailed production-ready prompt.

The visual analysis comes from an actual reference image.

The analysis is the SOURCE OF TRUTH.

=========================================================
ABSOLUTE RULE: CONCRETE FACTS
=========================================================

The biggest failure mode is producing a generic prompt.

NEVER write only:

"pertahankan semua elemen visual"

"pertahankan wajah dan pakaian"

"buat video sinematik yang realistis"

Those phrases are NOT sufficient.

Every concrete visual fact supplied in the
MANDATORY VISUAL FACTS section must be reflected in the
final prompt.

Do not replace facts with category names.

For example:

BAD:
"Pertahankan wanita dan pakaiannya."

GOOD:
"Pertahankan wanita muda dengan kulit cerah, mata cokelat
gelap berbentuk almond, alis tebal dan terdefinisi,
eyeliner dan maskara yang terlihat, bibir penuh berwarna
merah muda, hijab merah muda berbahan halus dengan band
bertekstur ribbed di dahi, serta scarf bermotif floral dan
paisley berwarna merah muda, putih, biru, dan cokelat."

The GOOD form is required.

=========================================================
BAHASA
=========================================================

FINAL PROMPT WAJIB Bahasa Indonesia.

Jangan menghasilkan paragraf bahasa Inggris.

Istilah teknis seperti:

depth of field
bokeh
close-up
dolly-in
push-in
framing

boleh digunakan jika membantu presisi.

=========================================================
WAJIB MENGGUNAKAN FAKTA
=========================================================

Gunakan:

- subjek
- penampilan
- wajah
- rambut atau hijab
- pose
- pakaian
- aksesori
- produk
- komposisi
- kamera
- pencahayaan
- bayangan
- lingkungan
- background
- warna
- tekstur
- gaya visual
- kualitas gambar
- important_details
- spatial_relationships

Jangan menghapus informasi yang tersedia.

=========================================================
WAJIB DETAIL WAJAH
=========================================================

Jika tersedia, sebutkan secara eksplisit:

- warna kulit
- kondisi kulit
- mata
- bentuk mata
- warna mata
- alis
- hidung
- bibir
- bentuk bibir
- makeup
- rambut
- warna rambut
- hijab
- ekspresi
- arah pandangan
- posisi kepala

Jangan menggantinya dengan "wajah cantik".

=========================================================
WAJIB DETAIL PAKAIAN
=========================================================

Sebutkan setiap pakaian yang terlihat.

Pertahankan:

- warna
- bahan jika tersedia
- tekstur
- pola
- motif
- lipatan
- posisi
- cara dikenakan

=========================================================
WAJIB DETAIL AKSESORI
=========================================================

Sebutkan:

- jenis
- warna
- bentuk
- posisi
- material jika terlihat

=========================================================
WAJIB DETAIL BACKGROUND
=========================================================

Jangan hanya mengatakan "background".

Jika terdapat dinding bata, jelaskan:

- dinding bata
- warna
- tekstur
- mortar
- posisi relatif terhadap subjek

Gunakan fakta aktual yang tersedia.

=========================================================
KAMERA
=========================================================

Gunakan perspektif yang tersedia.

Jangan mengarang kamera atau focal length yang tidak ada.

=========================================================
LIGHTING
=========================================================

Gunakan arah, kualitas, softness, shadow dan fill light
yang tersedia.

Jangan mengganti detail tersebut dengan sekadar
"cinematic lighting".

=========================================================
VIDEO
=========================================================

Jika tujuan adalah video:

Pertama-tama jelaskan ulang frame sumber secara rinci.

Setelah itu tambahkan gerakan natural yang sesuai.

Contoh:

- kedipan alami
- pernapasan halus
- micro-expression
- gerakan kepala sangat kecil
- gerakan kain
- gerakan hijab atau scarf
- push-in kamera perlahan

Jangan mengubah identitas, pakaian, warna, pola,
background atau komposisi dasar.

Jangan menciptakan aksi besar yang tidak diminta.

=========================================================
ANTI-INVENTION
=========================================================

Jangan mengarang:

- lokasi
- aksesori tersembunyi
- pakaian tersembunyi
- produk
- branding
- teks
- kamera
- focal length
- identitas seseorang
- detail fisik yang tidak terlihat

Jika analysis menyatakan uncertainty, jangan mengubahnya
menjadi fakta pasti.

=========================================================
OUTPUT
=========================================================

Return ONLY the final generation prompt.

Jangan:

- JSON
- markdown
- bullet
- reasoning
- explanation
- disclaimer
- label "Prompt:"
- label "Final Prompt:"

Hasil harus berupa prompt natural Bahasa Indonesia yang
panjang, konkret, rinci dan siap digunakan model generatif.

`.trim();

}


/* =========================================================
   PROMPT USER
========================================================= */

function buildPromptUserPrompt(
    analysis,
    settings = {}
) {

    const normalizedAnalysis =
        normalizePromptAnalysisInput(
            analysis
        );


    const facts =
        buildDetailedAnalysisFacts(
            normalizedAnalysis
        );


    const formattedAnalysis =
        formatAnalysisForPrompt(
            normalizedAnalysis
        );


    const formattedFacts =
        formatDetailedAnalysisFacts(
            facts
        );


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
Buat SATU prompt final yang sangat rinci berdasarkan
visual analysis reference image.

Tujuan generasi:
${purpose}

Tingkat detail:
${detail}

Instruksi tambahan:
${instruction || "Tidak ada"}

=========================================================
ATURAN PALING PENTING
=========================================================

JANGAN menghasilkan prompt generik.

JANGAN hanya mengatakan:

"pertahankan semua elemen visual"

"pertahankan subjek"

"buat video sinematik"

Semua fakta konkret pada bagian
MANDATORY VISUAL FACTS wajib digunakan.

Setiap fakta harus diubah menjadi deskripsi visual
natural dalam Bahasa Indonesia.

Jangan menghilangkan detail hanya karena detail tersebut
terdapat di nested JSON.

=========================================================
MANDATORY VISUAL FACTS
=========================================================

${formattedFacts || "TIDAK ADA FAKTA YANG TERBACA"}

=========================================================
STRUCTURED VISUAL ANALYSIS
=========================================================

${formattedAnalysis}

=========================================================
FINAL REQUIREMENT
=========================================================

Final prompt harus menjelaskan secara konkret:

1. subjek
2. penampilan
3. wajah
4. rambut atau hijab
5. pose
6. pakaian
7. aksesori
8. produk jika ada
9. komposisi
10. framing
11. kamera
12. depth of field
13. lighting
14. bayangan
15. lingkungan
16. background
17. warna
18. tekstur
19. visual style
20. important details
21. spatial relationships
22. motion jika tujuan adalah video
23. fidelity constraints

Output hanya prompt final Bahasa Indonesia.

Jangan tampilkan analisis.
Jangan tampilkan JSON.
Jangan tampilkan penjelasan.
Jangan gunakan label "Prompt:".

`.trim();

}


/* =========================================================
   PROMPT QUALITY
========================================================= */

function validateGeneratedPrompt(
    text,
    facts
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

            code:
                "EMPTY_PROMPT_RESPONSE",

            reason:
                "Prompt kosong."

        };

    }


    /*
     * Prompt generik biasanya pendek dan hanya
     * berisi instruksi preserve.
     */

    if (
        normalized.length < 900 &&
        facts.length >= 8
    ) {

        return {

            valid:
                false,

            code:
                "PROMPT_TOO_GENERIC",

            reason:
                "Prompt terlalu pendek dibanding jumlah fakta visual."

        };

    }


    const genericOnlyPatterns = [

        /pertahankan semua elemen visual/i,

        /buat video sinematik yang realistis/i,

        /pertahankan subjek.*pakaian.*aksesori/i,

        /sesuai dengan gambar referensi/i

    ];


    const genericMatches =
        genericOnlyPatterns.filter(
            pattern =>
                pattern.test(
                    normalized
                )
        ).length;


    if (
        genericMatches >= 2 &&
        normalized.length < 1400
    ) {

        return {

            valid:
                false,

            code:
                "PROMPT_GENERIC_OUTPUT",

            reason:
                "Model masih menghasilkan prompt generik."

        };

    }


    return {

        valid:
            true,

        code:
            null,

        reason:
            ""

    };

}


/* =========================================================
   GENERATE PROMPT
========================================================= */

async function generatePrompt(
    analysis,
    options = {}
) {

    const core =
        promptCore();


    const models =
        promptModels();


    const responseAPI =
        promptResponse();


    /*
     * -----------------------------------------------------
     * NORMALISASI WAJIB
     * -----------------------------------------------------
     */

    const normalizedAnalysis =
        normalizePromptAnalysisInput(
            analysis
        );


    if (
        !normalizedAnalysis
    ) {

        throw core.createAPIError(

            "Visual analysis belum tersedia atau format analysis tidak dikenali.",

            {

                code:
                    "ANALYSIS_REQUIRED"

            }

        );

    }


    const analysisText =
        formatAnalysisForPrompt(
            normalizedAnalysis
        );


    if (
        !analysisText ||
        !analysisText.trim()
    ) {

        throw core.createAPIError(

            "Visual analysis kosong setelah normalisasi.",

            {

                code:
                    "ANALYSIS_EMPTY_AFTER_NORMALIZATION"

            }

        );

    }


    const facts =
        buildDetailedAnalysisFacts(
            normalizedAnalysis
        );


    console.info(
        "[GEN-Z.AI Vision] Prompt Engineering analysis normalized:",
        {

            analysisType:
                "structured-visual-analysis",

            analysisLength:
                analysisText.length,

            factCount:
                facts.length,

            firstFacts:
                facts.slice(
                    0,
                    12
                )

        }
    );


    if (
        facts.length === 0
    ) {

        throw core.createAPIError(

            "Visual analysis tidak mengandung fakta visual yang dapat digunakan untuk Prompt Engineering.",

            {

                code:
                    "ANALYSIS_NO_LEAF_FACTS",

                data: {

                    analysis:
                        normalizedAnalysis

                }

            }

        );

    }


    const state =
        core.getState();


    const requestedModel =
        options.model ||
        models.getSelectedModel();


    const model =
        await models.resolveVisionModel(
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
                    normalizedAnalysis,
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

            factCount:
                facts.length,

            outputLanguage:
                "id-ID",

            detailMode:
                "concrete-visual-expansion",

            analysisSource:
                "structured-visual-analysis"

        }
    );


    const response =
        await core.request(

            {

                model:
                    model.id,

                messages,

                temperature:
                    core.CONFIG
                        .promptTemperature,

                max_tokens:
                    core.CONFIG
                        .maxPromptTokens,

                stream:
                    false

            },

            {

                timeout:
                    options.timeout ||
                    core.CONFIG.timeout

            }

        );


    console.info(
        "[GEN-Z.AI Vision] Prompt-engineering response:",
        responseAPI.sanitizeResponseForDebug(
            response
        )
    );


    const text =
        responseAPI.extractAssistantText(
            response
        );


    if (
        !text
    ) {

        throw core.createAPIError(

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
        responseAPI.cleanGeneratedPrompt(
            text
        );


    const quality =
        validateGeneratedPrompt(
            cleaned,
            facts
        );


    console.info(
        "[GEN-Z.AI Vision] Prompt Engineering quality:",
        {

            valid:
                quality.valid,

            code:
                quality.code,

            reason:
                quality.reason,

            length:
                cleaned.length,

            factCount:
                facts.length

        }
    );


    if (
        !quality.valid
    ) {

        throw core.createAPIError(

            quality.reason ||
            "Prompt Engineering menghasilkan prompt yang belum cukup detail.",

            {

                code:
                    quality.code ||
                    "INVALID_GENERATED_PROMPT",

                data: {

                    prompt:
                        cleaned,

                    quality,

                    factCount:
                        facts.length

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
   GLOBAL MODULE
========================================================= */

window.GENZVisionPrompt =
    Object.freeze({

        normalizePromptAnalysisInput,

        isMeaningfulPromptValue,

        formatFactKey,

        buildDetailedAnalysisFacts,

        formatDetailedAnalysisFacts,

        formatAnalysisForPrompt,

        buildPromptSystemPrompt,

        buildPromptUserPrompt,

        validateGeneratedPrompt,

        generatePrompt

    });
