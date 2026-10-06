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
   - Outfit Source Control
   - Reference / Character Source Priority
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
   STATE ACCESS COMPATIBILITY
========================================================= */

function getPromptSettings(
    core,
    options = {}
) {

    /*
     * Explicit options selalu menjadi prioritas.
     */

    if (
        options &&
        options.settings &&
        typeof options.settings === "object"
    ) {

        return options.settings;

    }


    /*
     * GENZVisionState API.
     */

    const visionState =
        window.GENZVisionState;


    if (
        visionState &&
        typeof visionState.get === "function"
    ) {

        try {

            const settings =
                visionState.get(
                    "settings",
                    null
                );


            if (
                settings &&
                typeof settings === "object"
            ) {

                return settings;

            }

        }
        catch (error) {

            console.debug(
                "[GEN-Z.AI Vision] GENZVisionState.get(settings) fallback:",
                error
            );

        }

    }


    /*
     * Core state.
     */

    if (
        core &&
        typeof core.getState === "function"
    ) {

        try {

            const state =
                core.getState();


            /*
             * Legacy state API.
             */

            if (
                state &&
                typeof state.get === "function"
            ) {

                const settings =
                    state.get(
                        "settings",
                        null
                    );


                if (
                    settings &&
                    typeof settings === "object"
                ) {

                    return settings;

                }

            }


            /*
             * Current plain state object.
             */

            if (
                state &&
                state.settings &&
                typeof state.settings === "object"
            ) {

                return state.settings;

            }

        }
        catch (error) {

            console.debug(
                "[GEN-Z.AI Vision] core.getState() settings fallback:",
                error
            );

        }

    }


    /*
     * GENZVisionState.getState() fallback.
     */

    if (
        visionState &&
        typeof visionState.getState === "function"
    ) {

        try {

            const state =
                visionState.getState();


            if (
                state &&
                state.settings &&
                typeof state.settings === "object"
            ) {

                return state.settings;

            }

        }
        catch (error) {

            console.debug(
                "[GEN-Z.AI Vision] GENZVisionState.getState() fallback:",
                error
            );

        }

    }


    return {};

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
   SOURCE AUTHORITY CATEGORIES
   ---------------------------------------------------------
   Reference image:
   - scene
   - pose
   - composition
   - framing
   - camera
   - lighting
   - shadows
   - environment
   - background
   - product
   - spatial relationships
   - visual style
   - image quality

   Character image:
   - identity
   - face
   - hair
   - physical appearance

   Outfit source:
   - clothing
   - outfit accessories
========================================================= */

const PROMPT_REFERENCE_AUTHORITY_KEYS =
    Object.freeze([

        "subject",
        "appearance",
        "pose",
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
        "spatialRelationships"

    ]);


const PROMPT_CHARACTER_AUTHORITY_KEYS =
    Object.freeze([

        "face_hair",
        "faceHair"

    ]);


/* =========================================================
   JSON / TEXT EXTRACTION HELPERS
========================================================= */

function stripPromptAnalysisCodeFence(
    text
) {

    let value =
        String(
            text ||
            ""
        )
            .trim();


    if (
        !value
    ) {

        return "";

    }


    value =
        value.replace(
            /^```(?:json|JSON|javascript|JavaScript)?\s*/i,
            ""
        );


    value =
        value.replace(
            /\s*```\s*$/i,
            ""
        );


    return value.trim();

}


/* =========================================================
   EXTRACT BALANCED OBJECT
========================================================= */

function extractBalancedPromptObject(
    text
) {

    const source =
        stripPromptAnalysisCodeFence(
            text
        );


    const start =
        source.indexOf(
            "{"
        );


    if (
        start === -1
    ) {

        return null;

    }


    let depth = 0;

    let inString = false;

    let escaped = false;


    for (
        let index = start;

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

                escaped = false;

                continue;

            }


            if (
                char === "\\"
            ) {

                escaped = true;

                continue;

            }


            if (
                char === '"'
            ) {

                inString = false;

            }


            continue;

        }


        if (
            char === '"'
        ) {

            inString = true;

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
                    start,
                    index + 1
                );

            }

        }

    }


    return null;

}


/* =========================================================
   EXTRACT BALANCED ARRAY
========================================================= */

function extractBalancedPromptArray(
    text
) {

    const source =
        stripPromptAnalysisCodeFence(
            text
        );


    const start =
        source.indexOf(
            "["
        );


    if (
        start === -1
    ) {

        return null;

    }


    let depth = 0;

    let inString = false;

    let escaped = false;


    for (
        let index = start;

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

                escaped = false;

                continue;

            }


            if (
                char === "\\"
            ) {

                escaped = true;

                continue;

            }


            if (
                char === '"'
            ) {

                inString = false;

            }


            continue;

        }


        if (
            char === '"'
        ) {

            inString = true;

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
                    start,
                    index + 1
                );

            }

        }

    }


    return null;

}


/* =========================================================
   EXTRACT EMBEDDED JSON
========================================================= */

function extractEmbeddedPromptAnalysisJSON(
    text
) {

    const source =
        stripPromptAnalysisCodeFence(
            text
        );


    if (
        !source
    ) {

        return null;

    }


    /*
     * Direct JSON.
     */

    try {

        return JSON.parse(
            source
        );

    }
    catch {

        /* Continue */

    }


    /*
     * Balanced object.
     */

    const objectText =
        extractBalancedPromptObject(
            source
        );


    if (
        objectText
    ) {

        try {

            return JSON.parse(
                objectText
            );

        }
        catch {

            /* Continue */

        }

    }


    /*
     * Balanced array.
     */

    const arrayText =
        extractBalancedPromptArray(
            source
        );


    if (
        arrayText
    ) {

        try {

            return JSON.parse(
                arrayText
            );

        }
        catch {

            /* Continue */

        }

    }


    return null;

}


/* =========================================================
   FIND ANALYSIS WRAPPER
========================================================= */

function findPromptAnalysisWrapper(
    input
) {

    if (
        !input ||
        typeof input !== "object" ||
        Array.isArray(input)
    ) {

        return null;

    }


    const wrappers = [

        "normalized",
        "analysis",
        "visualAnalysis",
        "visual_analysis",
        "visual",
        "visualData",
        "visual_data",
        "analysisResult",
        "analysis_result",
        "data",
        "result",
        "output",
        "response"

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


        return {

            key,

            value:
                input[key]

        };

    }


    return null;

}


/* =========================================================
   HAS DIRECT ANALYSIS STRUCTURE
========================================================= */

function hasPromptAnalysisStructure(
    input
) {

    if (
        !input ||
        typeof input !== "object" ||
        Array.isArray(input)
    ) {

        return false;

    }


    return PROMPT_ANALYSIS_KEYS.some(
        key =>
            Object.prototype.hasOwnProperty.call(
                input,
                key
            )
    );

}


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


    /* -----------------------------------------------------
       STRING
    ----------------------------------------------------- */

    if (
        typeof input === "string"
    ) {

        const text =
            input.trim();


        if (
            !text
        ) {

            return null;

        }


        /*
         * Direct JSON.
         */

        try {

            const parsed =
                JSON.parse(
                    text
                );


            return normalizePromptAnalysisInput(
                parsed
            );

        }
        catch {

            /* Continue */

        }


        /*
         * Embedded JSON.
         */

        const extracted =
            extractEmbeddedPromptAnalysisJSON(
                text
            );


        if (
            extracted !== null
        ) {

            return normalizePromptAnalysisInput(
                extracted
            );

        }


        /*
         * Raw text fallback.
         */

        return {

            raw_text:
                text

        };

    }


    /* -----------------------------------------------------
       ARRAY
    ----------------------------------------------------- */

    if (
        Array.isArray(input)
    ) {

        return input;

    }


    /* -----------------------------------------------------
       NON OBJECT
    ----------------------------------------------------- */

    if (
        typeof input !== "object"
    ) {

        return null;

    }


    /* -----------------------------------------------------
       DIRECT ANALYSIS OBJECT
    ----------------------------------------------------- */

    if (
        hasPromptAnalysisStructure(
            input
        )
    ) {

        return input;

    }


    /* -----------------------------------------------------
       WRAPPED ANALYSIS
    ----------------------------------------------------- */

    const wrapper =
        findPromptAnalysisWrapper(
            input
        );


    if (
        wrapper
    ) {

        const nested =
            normalizePromptAnalysisInput(
                wrapper.value
            );


        if (
            nested !== null
        ) {

            if (
                Array.isArray(nested)
            ) {

                if (
                    nested.length > 0
                ) {

                    return nested;

                }

            }
            else if (
                typeof nested === "object"
            ) {

                if (
                    Object.keys(
                        nested
                    ).length > 0
                ) {

                    return nested;

                }

            }
            else {

                return nested;

            }

        }

    }


    /* -----------------------------------------------------
       TEXT / CONTENT / MESSAGE / ANSWER
    ----------------------------------------------------- */

    const textKeys = [

        "text",
        "content",
        "message",
        "answer"

    ];


    for (
        const key of textKeys
    ) {

        if (
            typeof input[key] !== "string"
        ) {

            continue;

        }


        const nested =
            normalizePromptAnalysisInput(
                input[key]
            );


        if (
            nested === null
        ) {

            continue;

        }


        if (
            Array.isArray(nested)
        ) {

            if (
                nested.length > 0
            ) {

                return nested;

            }

            continue;

        }


        if (
            typeof nested === "object"
        ) {

            if (
                Object.keys(
                    nested
                ).length > 0
            ) {

                return nested;

            }

            continue;

        }


        return nested;

    }


    /* -----------------------------------------------------
       CHOICES FALLBACK
    ----------------------------------------------------- */

    if (
        Array.isArray(
            input.choices
        )
    ) {

        for (
            const choice of input.choices
        ) {

            const nested =
                normalizePromptAnalysisInput(
                    choice
                );


            if (
                nested === null
            ) {

                continue;

            }


            if (
                Array.isArray(nested)
            ) {

                if (
                    nested.length > 0
                ) {

                    return nested;

                }

                continue;

            }


            if (
                typeof nested === "object"
            ) {

                if (
                    Object.keys(
                        nested
                    ).length > 0
                ) {

                    return nested;

                }

                continue;

            }


            return nested;

        }

    }


    /* -----------------------------------------------------
       MESSAGE OBJECT FALLBACK
    ----------------------------------------------------- */

    if (
        input.message &&
        typeof input.message === "object"
    ) {

        const nested =
            normalizePromptAnalysisInput(
                input.message
            );


        if (
            nested !== null
        ) {

            if (
                Array.isArray(nested)
            ) {

                if (
                    nested.length > 0
                ) {

                    return nested;

                }

            }
            else if (
                typeof nested === "object"
            ) {

                if (
                    Object.keys(
                        nested
                    ).length > 0
                ) {

                    return nested;

                }

            }

        }

    }


    /* -----------------------------------------------------
       FINAL OBJECT
    ----------------------------------------------------- */

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
            value
                .trim()
                .toLowerCase();


        if (
            !normalized
        ) {

            return false;

        }


        return ![

            "unknown",
            "null",
            "n/a",
            "none",
            "tidak diketahui",
            "tidak ada",
            "tidak terlihat",
            "not visible",
            "not applicable"

        ].includes(
            normalized
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
            item =>
                isMeaningfulPromptValue(
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
                ([key, child]) => {

                    if (
                        key === "present" &&
                        child === false
                    ) {

                        return false;

                    }


                    return isMeaningfulPromptValue(
                        child
                    );

                }
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

        faceHair:
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

        colorPalette:
            "Palet warna",

        visual_style:
            "Gaya visual",

        visualStyle:
            "Gaya visual",

        text_branding:
            "Teks dan branding",

        textBranding:
            "Teks dan branding",

        image_quality:
            "Kualitas gambar",

        imageQuality:
            "Kualitas gambar",

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
   BUILD DETAILED ANALYSIS FACTS
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


        /* -------------------------------------------------
           STRING
        ------------------------------------------------- */

        if (
            typeof value === "string"
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
                    value.trim()

            });


            return;

        }


        /* -------------------------------------------------
           NUMBER / BOOLEAN
        ------------------------------------------------- */

        if (
            typeof value === "number" ||
            typeof value === "boolean"
        ) {

            facts.push({

                path:
                    path.join("."),

                value:
                    String(
                        value
                    )

            });


            return;

        }


        /* -------------------------------------------------
           ARRAY
        ------------------------------------------------- */

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


        /* -------------------------------------------------
           OBJECT
        ------------------------------------------------- */

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
                            key === "present" &&
                            child === false
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
   FACT CATEGORY
========================================================= */

function getPromptFactRoot(
    fact
) {

    if (
        !fact ||
        typeof fact !== "object"
    ) {

        return "";

    }


    const path =
        String(
            fact.path ||
            ""
        );


    const first =
        path
            .split(".")
            .filter(
                Boolean
            )[0] ||
        "";


    return first;

}


/* =========================================================
   CLASSIFY FACT AUTHORITY
========================================================= */

function classifyPromptFactAuthority(
    fact,
    outfitSource = "reference"
) {

    const root =
        getPromptFactRoot(
            fact
        );


    const normalizedOutfitSource =
        normalizeOutfitSource(
            outfitSource
        );


    /*
     * Face / hair selalu character authority
     * ketika replacement character tersedia.
     *
     * Pada tahap prompt engineering kita tidak tahu
     * secara eksplisit apakah IMAGE 2 ada atau tidak.
     * Karena itu aturan ini digunakan sebagai source-role
     * contract, bukan sebagai pengganti fakta.
     */

    if (
        PROMPT_CHARACTER_AUTHORITY_KEYS.includes(
            root
        )
    ) {

        return "character";

    }


    /*
     * Clothing dan outfit accessories mengikuti
     * outfitSource.
     */

    if (
        root === "clothing" ||
        root === "accessories"
    ) {

        return normalizedOutfitSource === "character"
            ? "character-outfit"
            : "reference-outfit";

    }


    /*
     * Semua elemen scene tetap berasal dari
     * main reference image.
     */

    if (
        PROMPT_REFERENCE_AUTHORITY_KEYS.includes(
            root
        )
    ) {

        return "reference";

    }


    /*
     * Unknown category.
     *
     * Jangan memberi authority palsu.
     */

    return "reference";

}


/* =========================================================
   FORMAT FACTS WITH SOURCE AUTHORITY
========================================================= */

function formatDetailedAnalysisFactsWithAuthority(
    facts,
    outfitSource = "reference"
) {

    if (
        !Array.isArray(facts) ||
        facts.length === 0
    ) {

        return "";

    }


    const normalizedOutfitSource =
        normalizeOutfitSource(
            outfitSource
        );


    const referenceFacts = [];

    const characterFacts = [];

    const outfitFacts = [];

    const uncertainFacts = [];


    facts.forEach(
        fact => {

            const authority =
                classifyPromptFactAuthority(
                    fact,
                    normalizedOutfitSource
                );


            if (
                authority === "character"
            ) {

                characterFacts.push(
                    fact
                );

                return;

            }


            if (
                authority === "character-outfit" ||
                authority === "reference-outfit"
            ) {

                outfitFacts.push({

                    ...fact,

                    authority

                });

                return;

            }


            referenceFacts.push(
                fact
            );

        }
    );


    function formatGroup(
        group,
        label
    ) {

        if (
            group.length === 0
        ) {

            return "";

        }


        const lines =
            group.map(
                (
                    fact,
                    index
                ) => {

                    const rawPath =
                        String(
                            fact.path ||
                            ""
                        );


                    const pathParts =
                        rawPath
                            .split(".")
                            .filter(
                                Boolean
                            );


                    const path =
                        pathParts
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


                    return `${index + 1}. ${path || "Detail visual"}: ${fact.value}`;

                }
            )
            .join("\n");


        return `
${label}
---------------------------------------------------------
${lines}
`.trim();

    }


    const sections = [];


    /*
     * Reference first.
     *
     * Ini sengaja diletakkan paling atas agar model
     * menerima scene authority sebelum identity authority.
     */

    const referenceSection =
        formatGroup(
            referenceFacts,
            "REFERENCE IMAGE FACTS - SCENE AUTHORITY"
        );


    if (
        referenceSection
    ) {

        sections.push(
            referenceSection
        );

    }


    /*
     * Outfit section.
     */

    const outfitLabel =
        normalizedOutfitSource === "character"
            ? "OUTFIT FACTS - CHARACTER OUTFIT AUTHORITY"
            : "OUTFIT FACTS - REFERENCE OUTFIT AUTHORITY";


    const outfitSection =
        formatGroup(
            outfitFacts,
            outfitLabel
        );


    if (
        outfitSection
    ) {

        sections.push(
            outfitSection
        );

    }


    /*
     * Character identity terakhir.
     *
     * Bukan karena kurang penting, tetapi supaya model
     * tidak membaca identity image sebagai scene reference.
     */

    const characterSection =
        formatGroup(
            characterFacts,
            "CHARACTER IMAGE FACTS - IDENTITY AUTHORITY ONLY"
        );


    if (
        characterSection
    ) {

        sections.push(
            characterSection
        );

    }


    /*
     * Ketidakpastian tetap dipertahankan.
     */

    const uncertaintyFacts =
        facts.filter(
            fact =>
                getPromptFactRoot(
                    fact
                ) === "uncertainties"
        );


    const uncertaintySection =
        formatGroup(
            uncertaintyFacts,
            "UNCERTAINTIES - DO NOT TURN INTO CERTAINTY"
        );


    if (
        uncertaintySection
    ) {

        sections.push(
            uncertaintySection
        );

    }


    return sections.join(
        "\n\n"
    );

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

                const rawPath =
                    String(
                        fact.path ||
                        ""
                    );


                const pathParts =
                    rawPath
                        .split(".")
                        .filter(
                            Boolean
                        );


                const path =
                    pathParts
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


                return `${index + 1}. ${path || "Detail visual"}: ${fact.value}`;

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
        typeof analysis === "string"
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
   OUTFIT SOURCE NORMALIZER
========================================================= */

function normalizeOutfitSource(
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
   BUILD OUTFIT SOURCE INSTRUCTIONS
========================================================= */

function buildOutfitSourceInstructions(
    outfitSource
) {

    const source =
        normalizeOutfitSource(
            outfitSource
        );


    if (
        source ===
        "character"
    ) {

        return {

            source,

            label:
                "OUTFIT DARI REPLACEMENT CHARACTER",

            systemInstruction: `
=========================================================
OUTFIT SOURCE: REPLACEMENT CHARACTER
=========================================================

ATURAN ABSOLUT:

Replacement character adalah sumber pakaian/outfit.

MAIN REFERENCE IMAGE tetap menjadi sumber utama untuk:

- scene;
- pose;
- komposisi;
- framing;
- camera perspective;
- kamera;
- pencahayaan;
- bayangan;
- background;
- environment;
- produk;
- spatial relationships;
- visual style.

REPLACEMENT CHARACTER hanya memberikan:

- identitas;
- wajah;
- rambut atau hijab;
- physical appearance;
- pakaian/outfit karena OUTFIT SOURCE sedang diset
  ke CHARACTER.

JANGAN memindahkan:

- background character;
- lighting character;
- camera character;
- framing character;
- composition character;
- environment character;
- pose character;

ke final prompt.

Hanya outfit dan identity yang boleh berasal dari
replacement character.

Jika terdapat konflik outfit:

REPLACEMENT CHARACTER MENANG.

Jika terdapat konflik scene:

MAIN REFERENCE IMAGE MENANG.
`.trim(),

            userInstruction: `
=========================================================
FINAL SOURCE PRIORITY
=========================================================

IMAGE 1 = MAIN REFERENCE IMAGE

IMAGE 2 = REPLACEMENT CHARACTER

OUTFIT SOURCE = CHARACTER

Gunakan IMAGE 1 untuk:

- scene;
- pose;
- komposisi;
- framing;
- kamera;
- perspektif;
- lighting;
- shadows;
- background;
- environment;
- product;
- spatial relationships;
- visual style.

Gunakan IMAGE 2 untuk:

- identitas;
- wajah;
- rambut atau hijab;
- physical appearance;
- pakaian/outfit.

JANGAN mengambil background, pose, lighting, kamera,
komposisi atau environment IMAGE 2.

Jika kedua image bertentangan:

SCENE IMAGE 1 MENANG.
IDENTITY IMAGE 2 MENANG.
OUTFIT IMAGE 2 MENANG.
`.trim()

        };

    }


    return {

        source:
            "reference",

        label:
            "OUTFIT DARI IMAGE REFERENCE",

        systemInstruction: `
=========================================================
OUTFIT SOURCE: MAIN REFERENCE IMAGE
=========================================================

ATURAN ABSOLUT:

MAIN REFERENCE IMAGE adalah sumber utama untuk:

- scene;
- pose;
- komposisi;
- framing;
- kamera;
- perspektif;
- lighting;
- shadows;
- background;
- environment;
- product;
- spatial relationships;
- visual style;
- pakaian/outfit.

REPLACEMENT CHARACTER hanya memberikan:

- identitas;
- wajah;
- rambut atau hijab;
- physical appearance.

REPLACEMENT CHARACTER BUKAN scene reference.

JANGAN mengambil dari replacement character:

- background;
- environment;
- pose;
- composition;
- framing;
- camera;
- lighting;
- shadows;
- spatial relationships;
- outfit.

Jika terdapat konflik outfit:

MAIN REFERENCE IMAGE MENANG.

Jika terdapat konflik scene:

MAIN REFERENCE IMAGE MENANG.

Jika terdapat konflik identity:

REPLACEMENT CHARACTER MENANG.
`.trim(),

        userInstruction: `
=========================================================
FINAL SOURCE PRIORITY
=========================================================

IMAGE 1 = MAIN REFERENCE IMAGE

IMAGE 2 = REPLACEMENT CHARACTER

OUTFIT SOURCE = REFERENCE

Gunakan IMAGE 1 sebagai sumber kebenaran utama untuk:

- scene;
- pose;
- komposisi;
- framing;
- kamera;
- perspektif;
- lighting;
- shadows;
- background;
- environment;
- product;
- spatial relationships;
- visual style;
- pakaian/outfit.

Gunakan IMAGE 2 HANYA untuk:

- identitas;
- wajah;
- rambut atau hijab;
- physical appearance.

JANGAN mengambil outfit IMAGE 2.

JANGAN mengambil background IMAGE 2.

JANGAN mengambil pose IMAGE 2.

JANGAN mengambil lighting IMAGE 2.

JANGAN mengambil kamera IMAGE 2.

JANGAN mengambil composition IMAGE 2.

Jika kedua image bertentangan:

SCENE IMAGE 1 MENANG.
OUTFIT IMAGE 1 MENANG.
IDENTITY IMAGE 2 MENANG.
`.trim()

    };

}


/* =========================================================
   SOURCE AUTHORITY CONTRACT
========================================================= */

function buildSourceAuthorityContract(
    outfitSource = "reference"
) {

    const source =
        normalizeOutfitSource(
            outfitSource
        );


    if (
        source === "character"
    ) {

        return `
=========================================================
ABSOLUTE IMAGE SOURCE AUTHORITY CONTRACT
=========================================================

ADA DUA SUMBER VISUAL:

IMAGE 1 = MAIN REFERENCE IMAGE
IMAGE 2 = REPLACEMENT CHARACTER

PRIORITAS FINAL:

1. SCENE / COMPOSITION / POSE / CAMERA / LIGHTING /
   BACKGROUND / ENVIRONMENT / PRODUCT
   -> IMAGE 1

2. IDENTITY / FACE / HAIR / PHYSICAL APPEARANCE
   -> IMAGE 2

3. OUTFIT / CLOTHING
   -> IMAGE 2

=========================================================
IMAGE 1 IS THE SCENE MASTER
=========================================================

Final prompt harus mempertahankan scene IMAGE 1.

Jangan mengganti:

- lokasi visual;
- background;
- environment;
- komposisi;
- framing;
- pose;
- camera perspective;
- lighting;
- shadows;
- spatial relationship;
- product placement.

dengan detail dari IMAGE 2.

=========================================================
IMAGE 2 IS NOT A SCENE REFERENCE
=========================================================

IMAGE 2 TIDAK BOLEH digunakan untuk:

- background;
- environment;
- scene;
- composition;
- framing;
- camera;
- lighting;
- shadows;
- spatial relationship;
- pose.

IMAGE 2 hanya menyediakan:

- identity;
- face;
- hair;
- physical appearance;
- outfit.

=========================================================
CONFLICT RULE
=========================================================

Jika IMAGE 1 dan IMAGE 2 berbeda:

SCENE -> IMAGE 1
POSE -> IMAGE 1
COMPOSITION -> IMAGE 1
CAMERA -> IMAGE 1
LIGHTING -> IMAGE 1
BACKGROUND -> IMAGE 1
ENVIRONMENT -> IMAGE 1
PRODUCT -> IMAGE 1
IDENTITY -> IMAGE 2
FACE -> IMAGE 2
HAIR -> IMAGE 2
OUTFIT -> IMAGE 2

Jangan melakukan visual blending terhadap scene.

=========================================================
FINAL MENTAL MODEL
=========================================================

IMAGE 1 = TEMPAT DAN ADEGAN

IMAGE 2 = SIAPA YANG DITEMPATKAN KE DALAM ADEGAN

OUTFIT = IMAGE 2

Jangan membalik hubungan tersebut.
`.trim();

    }


    return `
=========================================================
ABSOLUTE IMAGE SOURCE AUTHORITY CONTRACT
=========================================================

ADA DUA SUMBER VISUAL:

IMAGE 1 = MAIN REFERENCE IMAGE
IMAGE 2 = REPLACEMENT CHARACTER

PRIORITAS FINAL:

1. SCENE / COMPOSITION / POSE / CAMERA / LIGHTING /
   BACKGROUND / ENVIRONMENT / PRODUCT / OUTFIT
   -> IMAGE 1

2. IDENTITY / FACE / HAIR / PHYSICAL APPEARANCE
   -> IMAGE 2

=========================================================
IMAGE 1 IS THE MASTER REFERENCE
=========================================================

Final prompt harus mengikuti IMAGE 1 sebagai sumber
kebenaran visual utama.

Pertahankan:

- scene;
- pose;
- composition;
- framing;
- camera perspective;
- lighting;
- shadows;
- background;
- environment;
- product;
- spatial relationships;
- outfit;
- visual style.

=========================================================
IMAGE 2 IS IDENTITY ONLY
=========================================================

IMAGE 2 hanya digunakan untuk:

- identity;
- face;
- hair;
- physical appearance.

IMAGE 2 TIDAK BOLEH mengubah:

- scene;
- pose;
- composition;
- framing;
- camera;
- lighting;
- shadows;
- background;
- environment;
- product;
- outfit.

=========================================================
CONFLICT RULE
=========================================================

Jika IMAGE 1 dan IMAGE 2 berbeda:

SCENE -> IMAGE 1
POSE -> IMAGE 1
COMPOSITION -> IMAGE 1
CAMERA -> IMAGE 1
LIGHTING -> IMAGE 1
BACKGROUND -> IMAGE 1
ENVIRONMENT -> IMAGE 1
PRODUCT -> IMAGE 1
OUTFIT -> IMAGE 1
IDENTITY -> IMAGE 2
FACE -> IMAGE 2
HAIR -> IMAGE 2

Jangan melakukan visual blending terhadap scene.

=========================================================
FINAL MENTAL MODEL
=========================================================

IMAGE 1 = ADEGAN YANG HARUS DIPERTAHANKAN

IMAGE 2 = ORANG YANG HARUS DIMASUKKAN KE ADEGAN

IMAGE 2 BUKAN TEMPLATE SCENE.

Jangan membalik hubungan tersebut.
`.trim();

}


/* =========================================================
   PROMPT SYSTEM
========================================================= */

function buildPromptSystemPrompt(
    outfitSource = "reference"
) {

    const normalizedOutfitSource =
        normalizeOutfitSource(
            outfitSource
        );


    const outfitInstructions =
        buildOutfitSourceInstructions(
            normalizedOutfitSource
        );


    const sourceAuthority =
        buildSourceAuthorityContract(
            normalizedOutfitSource
        );


    return `
You are the advanced prompt engineering engine of GEN-Z.AI Vision.

Transform the supplied structured visual analysis into ONE
extremely detailed production-ready prompt.

The visual analysis comes from actual image references.

The analysis is the SOURCE OF TRUTH.

${sourceAuthority}

${outfitInstructions.systemInstruction}

=========================================================
ABSOLUTE RULE: DO NOT FLATTEN IMAGE ROLES
=========================================================

The supplied analysis may contain visual facts that belong
to different source roles.

Do NOT treat every fact as if it came from the same image.

The final prompt must obey the SOURCE AUTHORITY CONTRACT.

In particular:

- scene facts come from IMAGE 1;
- identity facts come from IMAGE 2;
- outfit follows OUTFIT SOURCE;
- IMAGE 2 must never become the scene template.

If a character image describes a different background,
lighting, camera, composition, environment or pose, those
details MUST NOT replace IMAGE 1.

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
final prompt when it belongs to the applicable authority.

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
SCENE FIDELITY
=========================================================

IMAGE 1 adalah scene master.

Final prompt harus terlebih dahulu membangun ulang
adegan IMAGE 1 secara konkret.

Prioritaskan:

- subject placement;
- pose;
- body orientation;
- composition;
- framing;
- camera perspective;
- product placement;
- background;
- environment;
- lighting;
- shadows;
- spatial relationships;
- visual style.

Jangan membiarkan detail IMAGE 2 mengganti elemen-elemen
tersebut.

=========================================================
IDENTITY FIDELITY
=========================================================

Jika replacement character tersedia, gunakan IMAGE 2 untuk
identitas karakter.

Pertahankan jika tersedia:

- warna kulit;
- kondisi kulit;
- bentuk wajah;
- mata;
- bentuk mata;
- warna mata;
- alis;
- hidung;
- bibir;
- bentuk bibir;
- makeup;
- rambut;
- warna rambut;
- hijab;
- karakteristik fisik;
- ekspresi jika memang bagian dari identity;
- arah pandangan jika memang terkait identity.

Namun jangan mengambil scene dari IMAGE 2.

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

Untuk pakaian yang berasal dari OUTFIT SOURCE:

- warna
- bahan jika tersedia
- tekstur
- pola
- motif
- lipatan
- posisi
- cara dikenakan
- layering
- bentuk
- potongan

harus dipertahankan.

Jangan mengambil outfit dari sumber yang tidak
ditetapkan sebagai OUTFIT SOURCE.

=========================================================
WAJIB DETAIL AKSESORI
=========================================================

Sebutkan:

- jenis
- warna
- bentuk
- posisi
- material jika terlihat

Tetapi jangan menciptakan aksesori yang tidak terlihat.

=========================================================
WAJIB DETAIL BACKGROUND
=========================================================

Background harus mengikuti IMAGE 1.

Jangan hanya mengatakan "background".

Jika terdapat dinding bata, jelaskan:

- dinding bata;
- warna;
- tekstur;
- mortar;
- posisi relatif terhadap subjek.

Gunakan fakta aktual yang tersedia dari IMAGE 1.

Jangan mengambil background dari IMAGE 2.

=========================================================
KAMERA
=========================================================

Gunakan perspektif yang tersedia dari IMAGE 1.

Jangan mengarang kamera atau focal length yang tidak ada.

Jangan mengambil kamera dari IMAGE 2.

=========================================================
LIGHTING
=========================================================

Gunakan arah, kualitas, softness, shadow dan fill light
yang tersedia dari IMAGE 1.

Jangan mengganti detail tersebut dengan sekadar
"cinematic lighting".

Jangan mengambil lighting dari IMAGE 2.

=========================================================
VIDEO
=========================================================

Jika tujuan adalah video:

Pertama-tama jelaskan ulang frame sumber secara rinci.

Frame sumber harus mengikuti IMAGE 1 sebagai scene master
dan IMAGE 2 hanya sebagai identity/outfit source sesuai
OUTFIT SOURCE.

Setelah itu tambahkan gerakan natural yang sesuai.

Contoh:

- kedipan alami;
- pernapasan halus;
- micro-expression;
- gerakan kepala sangat kecil;
- gerakan kain;
- gerakan hijab atau scarf;
- push-in kamera perlahan.

Jangan mengubah:

- identitas;
- pakaian;
- warna;
- pola;
- background;
- environment;
- composition;
- product placement.

Jangan menciptakan aksi besar yang tidak diminta.

=========================================================
ANTI-INVENTION
=========================================================

Jangan mengarang:

- lokasi;
- aksesori tersembunyi;
- pakaian tersembunyi;
- produk;
- branding;
- teks;
- kamera;
- focal length;
- identitas seseorang;
- detail fisik yang tidak terlihat.

Jika analysis menyatakan uncertainty, jangan mengubahnya
menjadi fakta pasti.

=========================================================
SOURCE CONFLICT RESOLUTION
=========================================================

Jika sebuah fakta dari CHARACTER IMAGE tampak seperti
scene information, abaikan fakta scene tersebut.

Contoh:

CHARACTER IMAGE memiliki:
- dinding;
- sofa;
- ruangan;
- lighting;
- kamera;
- pose;

tetapi MAIN REFERENCE IMAGE memiliki scene berbeda.

Maka final prompt HARUS menggunakan scene MAIN REFERENCE.

Karakter IMAGE 2 hanya ditempatkan ke dalam scene IMAGE 1.

=========================================================
OUTFIT SOURCE CONSISTENCY
=========================================================

${outfitInstructions.userInstruction}

Jangan menghasilkan instruksi outfit yang bertentangan
dengan sumber outfit.

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


    const outfitSource =
        normalizeOutfitSource(
            settings.outfitSource
        );


    const formattedFacts =
        formatDetailedAnalysisFactsWithAuthority(
            facts,
            outfitSource
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


    const outfitInstructions =
        buildOutfitSourceInstructions(
            outfitSource
        );


    const sourceAuthority =
        buildSourceAuthorityContract(
            outfitSource
        );


    return `
Buat SATU prompt final yang sangat rinci berdasarkan
visual analysis dari image reference.

Tujuan generasi:
${purpose}

Tingkat detail:
${detail}

${sourceAuthority}

=========================================================
INSTRUKSI TAMBAHAN
=========================================================

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
SOURCE-AWARE MANDATORY VISUAL FACTS harus digunakan
sesuai authority-nya.

Jangan menghilangkan detail hanya karena detail tersebut
terdapat di nested JSON.

=========================================================
SOURCE-AWARE MANDATORY VISUAL FACTS
=========================================================

${formattedFacts || "TIDAK ADA FAKTA YANG TERBACA"}

=========================================================
CARA MEMBACA FAKTA
=========================================================

Bagian:

REFERENCE IMAGE FACTS - SCENE AUTHORITY

adalah fakta untuk membangun ADEGAN utama.

Bagian:

OUTFIT FACTS

adalah fakta pakaian sesuai OUTFIT SOURCE.

Bagian:

CHARACTER IMAGE FACTS - IDENTITY AUTHORITY ONLY

adalah fakta identitas karakter.

JANGAN memindahkan fakta character identity menjadi
background, scene, camera, lighting, composition,
environment atau pose.

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

=========================================================
FINAL SOURCE RULE
=========================================================

SCENE:
MAIN REFERENCE IMAGE.

IDENTITY:
REPLACEMENT CHARACTER jika tersedia.

OUTFIT:
${outfitInstructions.label}

Jangan mencampurkan scene dari replacement character
ke dalam main reference.

Jangan menggunakan background replacement character.

Jangan menggunakan lighting replacement character.

Jangan menggunakan camera replacement character.

Jangan menggunakan composition replacement character.

Jangan menggunakan pose replacement character jika
berbeda dari main reference.

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


    if (
        !core
    ) {

        throw new Error(
            "GENZVisionCore tidak tersedia."
        );

    }


    if (
        !models
    ) {

        throw new Error(
            "GENZVisionModels tidak tersedia."
        );

    }


    if (
        !responseAPI
    ) {

        throw new Error(
            "GENZVisionResponse tidak tersedia."
        );

    }


    /* -----------------------------------------------------
       NORMALISASI
    ----------------------------------------------------- */

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


    /*
     * ----------------------------------------------------
     * MODEL
     * ----------------------------------------------------
     */

    const requestedModel =
        options.model ||
        models.getSelectedModel();


    const model =
        await models.resolveVisionModel(
            requestedModel,
            options
        );


    /*
     * ----------------------------------------------------
     * SETTINGS
     * ----------------------------------------------------
     */

    const settings =
        getPromptSettings(
            core,
            options
        );


    /*
     * ----------------------------------------------------
     * OUTFIT SOURCE
     * ----------------------------------------------------
     */

    const outfitSource =
        normalizeOutfitSource(
            settings.outfitSource
        );


    const promptSettings = {

        ...settings,

        outfitSource

    };


    /*
     * ----------------------------------------------------
     * SOURCE-AWARE FACTS
     * ----------------------------------------------------
     */

    const sourceAwareFacts =
        formatDetailedAnalysisFactsWithAuthority(
            facts,
            outfitSource
        );


    console.info(
        "[GEN-Z.AI Vision] Prompt Engineering analysis normalized:",
        {

            analysisType:
                "structured-visual-analysis",

            analysisLength:
                analysisText.length,

            topLevelKeys:
                normalizedAnalysis &&
                typeof normalizedAnalysis === "object" &&
                !Array.isArray(normalizedAnalysis)
                    ? Object.keys(
                        normalizedAnalysis
                    )
                    : [],

            factCount:
                facts.length,

            sourceAwareFactsLength:
                sourceAwareFacts.length,

            firstFacts:
                facts.slice(
                    0,
                    12
                )

        }
    );


    console.debug(
        "[GEN-Z.AI Vision] Prompt Engineering normalized analysis:",
        normalizedAnalysis
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


    const messages = [

        {

            role:
                "system",

            content:
                buildPromptSystemPrompt(
                    outfitSource
                )

        },

        {

            role:
                "user",

            content:
                buildPromptUserPrompt(
                    normalizedAnalysis,
                    promptSettings
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

            sourceAwareFactsLength:
                sourceAwareFacts.length,

            outputLanguage:
                "id-ID",

            detailMode:
                "source-aware-concrete-visual-expansion",

            analysisSource:
                "structured-visual-analysis",

            referenceAuthority:
                "scene-master",

            characterAuthority:
                "identity-only",

            outfitSource

        }
    );


    const configuredPromptTokens =
        Number(
            core.CONFIG
                .maxPromptTokens
        ) || 0;


    const promptMaxTokens =
        Math.max(
            configuredPromptTokens,
            4096
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
                    promptMaxTokens,

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
                facts.length,

            referenceAuthority:
                "IMAGE 1",

            characterAuthority:
                "IMAGE 2 identity",

            outfitSource

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
                        facts.length,

                    outfitSource

                }

            }

        );

    }


    /*
     * ----------------------------------------------------
     * SUCCESS
     * ----------------------------------------------------
     *
     * Jangan menulis ke state di sini.
     */

    console.info(
        "[GEN-Z.AI Vision] Prompt Engineering completed successfully:",
        {

            model:
                model.id,

            promptLength:
                cleaned.length,

            factCount:
                facts.length,

            referenceAuthority:
                "IMAGE 1",

            characterAuthority:
                "IMAGE 2 identity",

            outfitSource

        }
    );


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

const GENZVisionPromptAPI =
    Object.freeze({

        normalizePromptAnalysisInput,

        isMeaningfulPromptValue,

        formatFactKey,

        buildDetailedAnalysisFacts,

        formatDetailedAnalysisFacts,

        formatDetailedAnalysisFactsWithAuthority,

        classifyPromptFactAuthority,

        formatAnalysisForPrompt,

        normalizeOutfitSource,

        buildOutfitSourceInstructions,

        buildSourceAuthorityContract,

        buildPromptSystemPrompt,

        buildPromptUserPrompt,

        validateGeneratedPrompt,

        generatePrompt

    });


const existingVisionPrompt =
    window.GENZVisionPrompt;


if (
    existingVisionPrompt &&
    typeof existingVisionPrompt === "object"
) {

    window.GENZVisionPrompt =
        Object.freeze({

            ...existingVisionPrompt,

            ...GENZVisionPromptAPI

        });

}
else {

    window.GENZVisionPrompt =
        GENZVisionPromptAPI;

}
