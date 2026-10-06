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
   - FIELD-LEVEL SOURCE AUTHORITY
   - Character appearance / hair isolation
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


    const visionState =
        window.GENZVisionState;


    /*
     * GENZVisionState API.
     */

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
   STATE OUTFIT SOURCE
========================================================= */

function getPromptStateOutfitSource() {

    const visionState =
        window.GENZVisionState;


    if (
        !visionState
    ) {

        return "";

    }


    /*
     * Preferred API.
     */

    if (
        typeof visionState.getOutfitSource ===
        "function"
    ) {

        try {

            const value =
                visionState.getOutfitSource();


            if (
                value !== null &&
                value !== undefined &&
                String(value).trim()
            ) {

                return String(
                    value
                ).trim();

            }

        }
        catch (error) {

            console.debug(
                "[GEN-Z.AI Vision] getOutfitSource() fallback:",
                error
            );

        }

    }


    /*
     * Generic state getter.
     */

    if (
        typeof visionState.get === "function"
    ) {

        try {

            const value =
                visionState.get(
                    "outfitSource",
                    ""
                );


            if (
                value !== null &&
                value !== undefined &&
                String(value).trim()
            ) {

                return String(
                    value
                ).trim();

            }

        }
        catch (error) {

            console.debug(
                "[GEN-Z.AI Vision] state.get(outfitSource) fallback:",
                error
            );

        }

    }


    /*
     * Plain state object.
     */

    if (
        visionState.outfitSource
    ) {

        return String(
            visionState.outfitSource
        ).trim();

    }


    /*
     * getState() fallback.
     */

    if (
        typeof visionState.getState ===
        "function"
    ) {

        try {

            const state =
                visionState.getState();


            if (
                state &&
                state.outfitSource
            ) {

                return String(
                    state.outfitSource
                ).trim();

            }


            if (
                state &&
                state.settings &&
                state.settings.outfitSource
            ) {

                return String(
                    state.settings.outfitSource
                ).trim();

            }

        }
        catch (error) {

            console.debug(
                "[GEN-Z.AI Vision] state.getState() outfitSource fallback:",
                error
            );

        }

    }


    return "";

}


/* =========================================================
   STATE CHARACTER AVAILABILITY
========================================================= */

function hasPromptReplacementCharacter() {

    const visionState =
        window.GENZVisionState;


    if (
        !visionState
    ) {

        return false;

    }


    /*
     * Preferred API.
     */

    if (
        typeof visionState.getReplacementCharacter ===
        "function"
    ) {

        try {

            const character =
                visionState.getReplacementCharacter();


            if (
                character
            ) {

                return true;

            }

        }
        catch (error) {

            console.debug(
                "[GEN-Z.AI Vision] getReplacementCharacter() fallback:",
                error
            );

        }

    }


    /*
     * Generic state getter.
     */

    if (
        typeof visionState.get === "function"
    ) {

        try {

            const character =
                visionState.get(
                    "replacementCharacter",
                    null
                );


            if (
                character
            ) {

                return true;

            }

        }
        catch (error) {

            console.debug(
                "[GEN-Z.AI Vision] state.get(replacementCharacter) fallback:",
                error
            );

        }

    }


    /*
     * Plain state.
     */

    if (
        visionState.replacementCharacter
    ) {

        return true;

    }


    /*
     * getState() fallback.
     */

    if (
        typeof visionState.getState ===
        "function"
    ) {

        try {

            const state =
                visionState.getState();


            if (
                state &&
                state.replacementCharacter
            ) {

                return true;

            }


            if (
                state &&
                state.file &&
                state.file.replacementCharacter
            ) {

                return true;

            }

        }
        catch (error) {

            console.debug(
                "[GEN-Z.AI Vision] state.getState() character fallback:",
                error
            );

        }

    }


    return false;

}


/* =========================================================
   RESOLVE OUTFIT SOURCE
========================================================= */

function resolvePromptOutfitSource(
    settings = {}
) {

    /*
     * Explicit settings selalu memiliki prioritas.
     */

    if (
        settings &&
        settings.outfitSource !== undefined &&
        settings.outfitSource !== null &&
        String(
            settings.outfitSource
        ).trim()
    ) {

        return normalizeOutfitSource(
            settings.outfitSource
        );

    }


    /*
     * Jika settings tidak membawa outfitSource,
     * baca state langsung.
     */

    const stateValue =
        getPromptStateOutfitSource();


    if (
        stateValue
    ) {

        return normalizeOutfitSource(
            stateValue
        );

    }


    return "reference";

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
========================================================= */

const PROMPT_REFERENCE_AUTHORITY_KEYS =
    Object.freeze([

        "subject",
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


/*
 * Identity authority.
 *
 * PENTING:
 *
 * "appearance" sengaja dipindahkan ke sini.
 *
 * Alasan:
 * appearance dapat berisi:
 * - skin
 * - body
 * - physical characteristics
 * - hair-related physical description
 *
 * Ketika replacement character tersedia, data ini
 * harus mengikuti IMAGE 2.
 */

const PROMPT_CHARACTER_AUTHORITY_KEYS =
    Object.freeze([

        "appearance",
        "face_hair",
        "faceHair"

    ]);


/* =========================================================
   IDENTITY SUB-FIELD LOCKS
========================================================= */

const PROMPT_IDENTITY_FIELD_NAMES =
    Object.freeze([

        "hair",
        "hair_color",
        "hairColor",
        "hair_style",
        "hairStyle",
        "hair_length",
        "hairLength",
        "hair_texture",
        "hairTexture",
        "braids",
        "braid",
        "curls",
        "waves",
        "wavy",
        "bangs",
        "fringe",
        "hairline",
        "hair_part",
        "hairPart",
        "eyebrows",
        "eyes",
        "eye_color",
        "eyeColor",
        "nose",
        "lips",
        "skin",
        "skin_tone",
        "skinTone",
        "face",
        "face_shape",
        "faceShape",
        "facial_structure",
        "facialStructure",
        "physical_characteristics",
        "visible_physical_characteristics"

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


    try {

        return JSON.parse(
            source
        );

    }
    catch {

        /* Continue */

    }


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


        return {

            raw_text:
                text

        };

    }


    if (
        Array.isArray(input)
    ) {

        return input;

    }


    if (
        typeof input !== "object"
    ) {

        return null;

    }


    if (
        hasPromptAnalysisStructure(
            input
        )
    ) {

        return input;

    }


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
   FACT FIELD
========================================================= */

function getPromptFactLeaf(
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


    const parts =
        path
            .split(".")
            .filter(
                Boolean
            );


    if (
        parts.length === 0
    ) {

        return "";

    }


    const last =
        parts[
            parts.length - 1
        ];


    return String(
        last
    )
        .replace(
            /^\[/,
            ""
        )
        .replace(
            /\]$/,
            ""
        );

}


/* =========================================================
   CLASSIFY FACT AUTHORITY
========================================================= */

function classifyPromptFactAuthority(
    fact,
    outfitSource = "reference",
    hasCharacter = false
) {

    const root =
        getPromptFactRoot(
            fact
        );


    const leaf =
        getPromptFactLeaf(
            fact
        );


    const normalizedOutfitSource =
        normalizeOutfitSource(
            outfitSource
        );


    /*
     * =====================================================
     * CHARACTER IDENTITY
     * =====================================================
     *
     * Ketika replacement character tersedia:
     *
     * appearance + face_hair
     *
     * sepenuhnya menjadi IMAGE 2 authority.
     */

    if (
        hasCharacter &&
        PROMPT_CHARACTER_AUTHORITY_KEYS.includes(
            root
        )
    ) {

        return "character";

    }


    /*
     * Jika tidak ada replacement character,
     * appearance tetap berasal dari reference.
     */

    if (
        !hasCharacter &&
        root === "appearance"
    ) {

        return "reference";

    }


    /*
     * face_hair tanpa character tidak boleh
     * diberi authority palsu.
     *
     * Dalam kondisi ini fakta tetap dipertahankan
     * sebagai reference.
     */

    if (
        root === "face_hair" ||
        root === "faceHair"
    ) {

        return hasCharacter
            ? "character"
            : "reference";

    }


    /*
     * Extra protection untuk field rambut.
     *
     * Jika model analysis meletakkan hair detail
     * pada category lain yang bukan scene, dan
     * replacement character tersedia, field tersebut
     * tetap harus diperlakukan sebagai identity.
     */

    if (
        hasCharacter &&
        PROMPT_IDENTITY_FIELD_NAMES.includes(
            leaf
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
     * Semua elemen scene tetap IMAGE 1.
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
     * Jangan memberikan character authority
     * tanpa dasar.
     */

    return "reference";

}


/* =========================================================
   FORMAT FACTS WITH SOURCE AUTHORITY
========================================================= */

function formatDetailedAnalysisFactsWithAuthority(
    facts,
    outfitSource = "reference",
    hasCharacter = false
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
                    normalizedOutfitSource,
                    hasCharacter
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


            if (
                getPromptFactRoot(
                    fact
                ) === "uncertainties"
            ) {

                uncertainFacts.push(
                    fact
                );

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
     * REFERENCE FIRST.
     *
     * Hanya scene authority.
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
     * OUTFIT.
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
     * CHARACTER IDENTITY.
     *
     * Appearance sekarang berada di sini jika
     * replacement character tersedia.
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
     * UNCERTAINTIES.
     */

    const uncertaintySection =
        formatGroup(
            uncertainFacts,
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
- lokasi;
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

REPLACEMENT CHARACTER memberikan:

- identitas;
- wajah;
- rambut atau hijab;
- physical appearance;
- pakaian/outfit;
- aksesori yang melekat pada outfit jika terlihat.

=========================================================
HAIR SOURCE LOCK
=========================================================

RAMBUT REPLACEMENT CHARACTER HANYA BOLEH DIAMBIL
DARI IMAGE 2.

JANGAN mengambil rambut IMAGE 1.

JANGAN menggabungkan rambut IMAGE 1 dan IMAGE 2.

JANGAN melakukan averaging.

JANGAN melakukan blending.

JANGAN menggunakan IMAGE 1 sebagai fallback apabila
rambut IMAGE 2 berbeda.

Jika rambut IMAGE 2 tidak cukup terlihat:

gunakan hanya fakta yang benar-benar terlihat dari
IMAGE 2.

Jangan mengisi kekosongan tersebut dengan rambut IMAGE 1.

=========================================================
IDENTITY LOCK
=========================================================

IDENTITAS FISIK CHARACTER HANYA IMAGE 2.

Termasuk:

- bentuk wajah;
- mata;
- alis;
- hidung;
- bibir;
- warna kulit;
- kondisi kulit;
- rambut;
- warna rambut;
- tekstur rambut;
- panjang rambut;
- gaya rambut;
- braids;
- curls;
- waves;
- bangs;
- hairline;
- physical characteristics.

=========================================================
SCENE LOCK
=========================================================

IMAGE 2 TIDAK BOLEH mengganti:

- background;
- environment;
- scene;
- pose;
- composition;
- framing;
- camera;
- lighting;
- shadows;
- spatial relationships.

Jika IMAGE 2 mempunyai ruangan atau background yang berbeda,
abaikan seluruh informasi scene tersebut.

=========================================================
CONFLICT RULE
=========================================================

Jika terdapat konflik:

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
`.trim(),

            userInstruction: `
=========================================================
FINAL SOURCE PRIORITY
=========================================================

IMAGE 1 = MAIN REFERENCE IMAGE

IMAGE 2 = REPLACEMENT CHARACTER

OUTFIT SOURCE = CHARACTER

IMAGE 1 mengontrol:

- scene;
- lokasi;
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

IMAGE 2 mengontrol:

- identitas;
- wajah;
- rambut;
- hijab;
- physical appearance;
- pakaian;
- outfit;
- aksesori outfit.

=========================================================
ABSOLUTE HAIR RULE
=========================================================

Rambut final WAJIB berasal dari IMAGE 2.

Jika rambut IMAGE 1 berbeda dengan rambut IMAGE 2,
BUANG rambut IMAGE 1.

Jangan:

- mencampur rambut;
- menggabungkan gaya;
- menggunakan panjang rambut IMAGE 1;
- menggunakan tekstur rambut IMAGE 1;
- menggunakan warna rambut IMAGE 1;
- menggunakan bentuk rambut IMAGE 1;
- menggunakan braids IMAGE 1;
- menggunakan waves IMAGE 1;
- menggunakan curls IMAGE 1.

Jika IMAGE 2 menunjukkan braids, final harus menggunakan
braids tersebut.

Jika IMAGE 2 menunjukkan rambut pendek, final harus
menggunakan rambut pendek tersebut.

Jika IMAGE 2 menunjukkan rambut panjang, final harus
menggunakan rambut panjang tersebut.

IMAGE 1 TIDAK PERNAH MENJADI SUMBER RAMBUT.

=========================================================
FINAL CONFLICT RULE
=========================================================

SCENE IMAGE 1 MENANG.
POSE IMAGE 1 MENANG.
COMPOSITION IMAGE 1 MENANG.
CAMERA IMAGE 1 MENANG.
LIGHTING IMAGE 1 MENANG.
BACKGROUND IMAGE 1 MENANG.
ENVIRONMENT IMAGE 1 MENANG.
PRODUCT IMAGE 1 MENANG.

IDENTITY IMAGE 2 MENANG.
FACE IMAGE 2 MENANG.
HAIR IMAGE 2 MENANG.
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
- lokasi;
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

=========================================================
HAIR SOURCE LOCK
=========================================================

Jika replacement character tersedia:

RAMBUT FINAL HANYA BOLEH DIAMBIL DARI IMAGE 2.

JANGAN mengambil rambut IMAGE 1 untuk identitas karakter.

JANGAN mencampur rambut IMAGE 1 dengan IMAGE 2.

=========================================================
IDENTITY LOCK
=========================================================

IMAGE 2 mengontrol:

- wajah;
- bentuk wajah;
- mata;
- alis;
- hidung;
- bibir;
- warna kulit;
- physical appearance;
- rambut;
- warna rambut;
- tekstur rambut;
- panjang rambut;
- gaya rambut;
- hijab jika merupakan bagian dari identitas.

=========================================================
SCENE LOCK
=========================================================

IMAGE 2 TIDAK BOLEH mengubah:

- scene;
- background;
- environment;
- pose;
- composition;
- framing;
- camera;
- lighting;
- shadows;
- spatial relationships;
- product;
- outfit.

Jika terdapat konflik:

SCENE -> IMAGE 1
OUTFIT -> IMAGE 1
IDENTITY -> IMAGE 2
FACE -> IMAGE 2
HAIR -> IMAGE 2
`.trim(),

        userInstruction: `
=========================================================
FINAL SOURCE PRIORITY
=========================================================

IMAGE 1 = MAIN REFERENCE IMAGE

IMAGE 2 = REPLACEMENT CHARACTER

OUTFIT SOURCE = REFERENCE

IMAGE 1 mengontrol:

- scene;
- lokasi;
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

IMAGE 2 HANYA mengontrol:

- identitas;
- wajah;
- rambut;
- hijab;
- physical appearance.

=========================================================
ABSOLUTE HAIR RULE
=========================================================

Rambut karakter final harus berasal dari IMAGE 2.

Jangan mengambil rambut IMAGE 1.

Jangan menggunakan rambut IMAGE 1 sebagai fallback.

Jangan mencampur rambut kedua image.

IMAGE 1 hanya mengontrol scene dan outfit.

IMAGE 2 mengontrol identity dan hair.

=========================================================
FINAL CONFLICT RULE
=========================================================

SCENE IMAGE 1 MENANG.
OUTFIT IMAGE 1 MENANG.
IDENTITY IMAGE 2 MENANG.
FACE IMAGE 2 MENANG.
HAIR IMAGE 2 MENANG.
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

=========================================================
FIELD-LEVEL AUTHORITY
=========================================================

SCENE FIELDS
-> IMAGE 1

IDENTITY FIELDS
-> IMAGE 2

HAIR
-> IMAGE 2

OUTFIT
-> IMAGE 2

=========================================================
IMAGE 1 = SCENE MASTER
=========================================================

IMAGE 1 mengontrol:

- scene;
- lokasi;
- environment;
- background;
- composition;
- framing;
- subject placement;
- pose;
- body positioning;
- hand positioning;
- camera;
- perspective;
- lens jika terlihat;
- depth of field;
- focus;
- lighting;
- shadows;
- product;
- product placement;
- spatial relationships;
- visual style.

=========================================================
IMAGE 2 = CHARACTER MASTER
=========================================================

IMAGE 2 mengontrol:

- identity;
- face;
- facial structure;
- eyes;
- eyebrows;
- nose;
- lips;
- skin;
- physical appearance;
- hair;
- hair color;
- hair texture;
- hair length;
- hair style;
- braids;
- curls;
- waves;
- bangs;
- hairline;
- hijab;
- outfit;
- clothing;
- outfit accessories.

=========================================================
ABSOLUTE HAIR LOCK
=========================================================

HAIR = IMAGE 2 ONLY.

Tidak ada pengecualian.

Jika IMAGE 1 menunjukkan rambut berbeda,
rambut IMAGE 1 harus diabaikan.

Jangan:

- copy hair IMAGE 1;
- merge hair;
- blend hair;
- average hair;
- infer hair from scene;
- fallback ke IMAGE 1.

Jika IMAGE 2 tidak memperlihatkan rambut dengan jelas,
gunakan hanya fakta yang benar-benar terlihat.

Jangan mengambil informasi rambut IMAGE 1
untuk mengisi kekosongan.

=========================================================
APPEARANCE LOCK
=========================================================

APPEARANCE = IMAGE 2 ONLY ketika replacement character
tersedia.

Termasuk physical characteristics.

Jangan memasukkan physical identity IMAGE 2
ke dalam scene authority IMAGE 1.

=========================================================
CONFLICT RULE
=========================================================

SCENE -> IMAGE 1
LOCATION -> IMAGE 1
BACKGROUND -> IMAGE 1
ENVIRONMENT -> IMAGE 1
POSE -> IMAGE 1
COMPOSITION -> IMAGE 1
CAMERA -> IMAGE 1
LIGHTING -> IMAGE 1
PRODUCT -> IMAGE 1
SPATIAL RELATIONSHIP -> IMAGE 1

IDENTITY -> IMAGE 2
FACE -> IMAGE 2
HAIR -> IMAGE 2
PHYSICAL APPEARANCE -> IMAGE 2
OUTFIT -> IMAGE 2

=========================================================
FINAL MENTAL MODEL
=========================================================

IMAGE 1 = TEMPAT + ADEGAN + POSISI

IMAGE 2 = SIAPA KARAKTERNYA + RAMBUT + PAKAIAN

Gabungkan hanya field yang memang diperbolehkan.
`.trim();

    }


    return `
=========================================================
ABSOLUTE IMAGE SOURCE AUTHORITY CONTRACT
=========================================================

IMAGE 1 = MAIN REFERENCE IMAGE
IMAGE 2 = REPLACEMENT CHARACTER

IMAGE 1 mengontrol:

- scene;
- lokasi;
- pose;
- composition;
- framing;
- camera;
- lighting;
- shadows;
- background;
- environment;
- product;
- spatial relationships;
- visual style;
- outfit.

IMAGE 2 mengontrol:

- identity;
- face;
- hair;
- physical appearance.

=========================================================
ABSOLUTE HAIR LOCK
=========================================================

Jika IMAGE 2 tersedia:

HAIR = IMAGE 2 ONLY.

Jangan mengambil rambut IMAGE 1.

Jangan menggabungkan rambut IMAGE 1 dan IMAGE 2.

Jika IMAGE 2 tidak jelas, jangan mengarang dan jangan
mengambil rambut IMAGE 1 sebagai fallback.

=========================================================
CONFLICT RULE
=========================================================

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
PHYSICAL APPEARANCE -> IMAGE 2
`.trim();

}


/* =========================================================
   PROMPT SYSTEM
========================================================= */

function buildPromptSystemPrompt(
    outfitSource = "reference",
    hasCharacter = false
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


    const characterAvailabilityInstruction =
        hasCharacter
            ? `
=========================================================
REPLACEMENT CHARACTER AVAILABLE
=========================================================

IMAGE 2 tersedia.

Karena IMAGE 2 tersedia:

- appearance -> IMAGE 2
- face_hair -> IMAGE 2
- hair -> IMAGE 2
- physical characteristics -> IMAGE 2

JANGAN memasukkan fakta identity IMAGE 2 ke dalam
REFERENCE IMAGE FACTS sebagai scene information.
`.trim()
            : `
=========================================================
NO REPLACEMENT CHARACTER
=========================================================

Tidak ada IMAGE 2.

Semua identity/appearance yang tersedia berasal
dari IMAGE 1.
`.trim();


    return `
You are the advanced prompt engineering engine of GEN-Z.AI Vision.

Transform the supplied structured visual analysis into ONE
extremely detailed production-ready prompt.

The visual analysis comes from actual image references.

The analysis is the SOURCE OF TRUTH.

${sourceAuthority}

${characterAvailabilityInstruction}

${outfitInstructions.systemInstruction}

=========================================================
ABSOLUTE RULE: FIELD-LEVEL SOURCE SEPARATION
=========================================================

JANGAN menganggap semua fakta analysis berasal
dari satu gambar.

Setiap fakta harus mengikuti authority field-nya.

Jika replacement character tersedia:

IMAGE 1:
- scene;
- location;
- pose;
- composition;
- framing;
- camera;
- lighting;
- shadows;
- background;
- environment;
- product;
- spatial relationships;
- visual style.

IMAGE 2:
- identity;
- face;
- appearance;
- hair;
- physical characteristics.

OUTFIT:
${normalizedOutfitSource === "character"
    ? "IMAGE 2"
    : "IMAGE 1"}

=========================================================
ABSOLUTE HAIR RULE
=========================================================

INI ADALAH FIELD PALING KETAT.

Jika replacement character tersedia:

face_hair.hair
appearance hair
physical hair description

HARUS berasal dari IMAGE 2.

JANGAN mengambil rambut IMAGE 1.

JANGAN menggunakan rambut IMAGE 1 sebagai fallback.

JANGAN menggabungkan rambut.

JANGAN membuat hybrid hair.

JANGAN melakukan averaging.

JANGAN mengambil panjang, tekstur, warna, bentuk,
braids, curls, waves, bangs atau hairline dari IMAGE 1.

Jika IMAGE 1 memiliki rambut panjang bergelombang
sedangkan IMAGE 2 memiliki braids:

FINAL = BRAIDS IMAGE 2.

Bukan rambut panjang bergelombang.

Jika IMAGE 2 tidak cukup jelas:

gunakan hanya fakta rambut yang benar-benar terlihat
dari IMAGE 2.

Jangan mengisi kekosongan menggunakan IMAGE 1.

=========================================================
APPEARANCE RULE
=========================================================

Jika replacement character tersedia:

appearance = IMAGE 2 identity authority.

Termasuk:

- skin;
- body;
- physical characteristics;
- hair;
- face-related characteristics.

Jangan memperlakukan appearance IMAGE 2 sebagai
scene information.

=========================================================
CONSISTENCY RULE
=========================================================

Jika:

appearance.visible_physical_characteristics

dan:

face_hair.hair

berisi detail identity yang berhubungan dengan rambut,
keduanya harus konsisten dengan IMAGE 2.

Contoh:

Jika appearance menyebut:

"rambut dikepang"

maka face_hair.hair tidak boleh menjadi:

"rambut panjang bergelombang"

Jika terdapat konflik internal:

PRIORITASKAN FAKTA RAMBUT YANG KONSISTEN DENGAN
IMAGE 2.

Jangan mengambil solusi kompromi dari IMAGE 1.

=========================================================
ABSOLUTE RULE: CONCRETE FACTS
=========================================================

NEVER write only:

"pertahankan semua elemen visual"

"pertahankan wajah dan pakaian"

"buat video sinematik yang realistis"

Semua fakta konkret harus digunakan sesuai authority.

=========================================================
BAHASA
=========================================================

FINAL PROMPT WAJIB Bahasa Indonesia.

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

Jangan membiarkan IMAGE 2 mengganti elemen scene.

=========================================================
IDENTITY FIDELITY
=========================================================

Jika replacement character tersedia:

Gunakan IMAGE 2 untuk:

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
- tekstur rambut;
- panjang rambut;
- gaya rambut;
- braids;
- curls;
- waves;
- bangs;
- hairline;
- physical characteristics.

Jangan mengambil detail tersebut dari IMAGE 1.

=========================================================
WAJIB DETAIL WAJAH
=========================================================

Jika tersedia, sebutkan secara eksplisit:

- warna kulit;
- kondisi kulit;
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
- tekstur rambut;
- panjang rambut;
- gaya rambut;
- hijab;
- ekspresi;
- arah pandangan;
- posisi kepala.

Jangan menggantinya dengan "wajah cantik".

=========================================================
WAJIB DETAIL PAKAIAN
=========================================================

Sebutkan setiap pakaian yang terlihat.

Untuk pakaian dari OUTFIT SOURCE:

- warna;
- bahan jika tersedia;
- tekstur;
- pola;
- motif;
- lipatan;
- posisi;
- cara dikenakan;
- layering;
- bentuk;
- potongan.

Jangan mengambil outfit dari sumber lain.

=========================================================
WAJIB DETAIL AKSESORI
=========================================================

Sebutkan:

- jenis;
- warna;
- bentuk;
- posisi;
- material jika terlihat.

Jangan menciptakan aksesori yang tidak terlihat.

=========================================================
BACKGROUND
=========================================================

Background HARUS IMAGE 1.

Jelaskan berdasarkan fakta aktual:

- struktur;
- warna;
- tekstur;
- posisi;
- hubungan dengan subjek.

Jangan mengambil background IMAGE 2.

=========================================================
KAMERA
=========================================================

Gunakan kamera/perspektif IMAGE 1.

Jangan mengarang focal length yang tidak tersedia.

Jangan mengambil kamera IMAGE 2.

=========================================================
LIGHTING
=========================================================

Gunakan:

- arah cahaya;
- kualitas;
- softness;
- shadow;
- fill;

dari IMAGE 1.

Jangan mengambil lighting IMAGE 2.

=========================================================
VIDEO
=========================================================

Jika tujuan adalah video:

Pertama-tama jelaskan ulang frame sumber secara rinci.

Frame sumber mengikuti IMAGE 1 sebagai scene master.

IMAGE 2 hanya menyediakan identity dan outfit sesuai
OUTFIT SOURCE.

Setelah itu tambahkan motion natural:

- kedipan;
- pernapasan;
- micro-expression;
- gerakan kepala kecil;
- gerakan kain;
- gerakan rambut;
- gerakan hijab;
- push-in kamera perlahan.

Jangan mengubah:

- identity;
- hair;
- outfit;
- background;
- environment;
- composition;
- product placement.

=========================================================
ANTI-INVENTION
=========================================================

Jangan mengarang:

- lokasi;
- aksesori;
- pakaian tersembunyi;
- produk;
- branding;
- teks;
- kamera;
- focal length;
- identitas;
- detail fisik.

Jika analysis menyatakan uncertainty,
jangan mengubahnya menjadi kepastian.

=========================================================
SOURCE CONFLICT RESOLUTION
=========================================================

Jika CHARACTER IMAGE memiliki:

- dinding;
- sofa;
- ruangan;
- lighting;
- kamera;
- pose;

tetapi MAIN REFERENCE IMAGE berbeda:

IMAGE 1 MENANG untuk seluruh scene.

Namun:

IMAGE 2 MENANG untuk:

- identity;
- face;
- hair;
- physical appearance;
- outfit jika OUTFIT SOURCE = CHARACTER.

=========================================================
OUTFIT SOURCE CONSISTENCY
=========================================================

${outfitInstructions.userInstruction}

=========================================================
FINAL VALIDATION BEFORE OUTPUT
=========================================================

Sebelum menghasilkan prompt final, periksa:

[1] Scene = IMAGE 1.

[2] Pose = IMAGE 1.

[3] Composition = IMAGE 1.

[4] Camera = IMAGE 1.

[5] Lighting = IMAGE 1.

[6] Background = IMAGE 1.

[7] Environment = IMAGE 1.

[8] Product = IMAGE 1.

[9] Identity = IMAGE 2 jika tersedia.

[10] Face = IMAGE 2 jika tersedia.

[11] Appearance = IMAGE 2 jika tersedia.

[12] Hair = IMAGE 2 jika tersedia.

[13] Outfit = OUTFIT SOURCE.

[14] Tidak ada field yang mengambil fakta dari
     sumber yang salah.

[15] Tidak ada rambut IMAGE 1 yang masuk ke identity.

[16] Tidak ada scene IMAGE 2 yang masuk ke final prompt.

=========================================================
OUTPUT
=========================================================

Return ONLY the final generation prompt.

Jangan:

- JSON;
- markdown;
- bullet;
- reasoning;
- explanation;
- disclaimer;
- label "Prompt:";
- label "Final Prompt:".

Hasil harus berupa prompt natural Bahasa Indonesia yang
panjang, konkret, rinci dan siap digunakan model generatif.
`.trim();

}


/* =========================================================
   PROMPT USER
========================================================= */

function buildPromptUserPrompt(
    analysis,
    settings = {},
    hasCharacter = false
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
        resolvePromptOutfitSource(
            settings
        );


    const formattedFacts =
        formatDetailedAnalysisFactsWithAuthority(
            facts,
            outfitSource,
            hasCharacter
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

Semua fakta konkret pada bagian
SOURCE-AWARE MANDATORY VISUAL FACTS harus digunakan
sesuai authority.

=========================================================
SOURCE-AWARE MANDATORY VISUAL FACTS
=========================================================

${formattedFacts || "TIDAK ADA FAKTA YANG TERBACA"}

=========================================================
FIELD AUTHORITY
=========================================================

Jika replacement character tersedia:

REFERENCE IMAGE FACTS
= scene authority IMAGE 1.

CHARACTER IMAGE FACTS
= identity authority IMAGE 2.

OUTFIT FACTS
= ${outfitSource === "character"
    ? "IMAGE 2"
    : "IMAGE 1"}.

=========================================================
ABSOLUTE HAIR RULE
=========================================================

Jika IMAGE 2 tersedia:

RAMBUT FINAL = RAMBUT IMAGE 2.

Jangan menggunakan rambut IMAGE 1.

Jangan mencampur rambut.

Jangan membuat hybrid.

Jangan menggunakan rambut IMAGE 1 sebagai fallback.

Jika IMAGE 2 memperlihatkan:

- braids -> gunakan braids;
- curls -> gunakan curls;
- waves -> gunakan waves;
- rambut pendek -> gunakan rambut pendek;
- rambut panjang -> gunakan rambut panjang;
- bangs -> pertahankan bangs;
- hairline tertentu -> pertahankan hairline.

Jangan mengganti fakta tersebut berdasarkan rambut
yang terlihat di IMAGE 1.

=========================================================
APPEARANCE LOCK
=========================================================

Jika replacement character tersedia:

APPEARANCE = IMAGE 2.

Termasuk:

- physical characteristics;
- skin;
- body;
- hair;
- face-related appearance.

Jangan mengambil physical identity dari IMAGE 1.

=========================================================
HAIR CONSISTENCY CHECK
=========================================================

Sebelum output:

Bandingkan fakta:

appearance

dengan:

face_hair

Jika keduanya membahas rambut tetapi bertentangan,
pilih deskripsi yang konsisten dengan IMAGE 2.

Jangan mengambil deskripsi alternatif dari IMAGE 1.

=========================================================
SCENE LOCK
=========================================================

Scene final HARUS IMAGE 1.

Pertahankan secara konkret:

1. subjek dan placement;
2. pose;
3. body orientation;
4. composition;
5. framing;
6. camera;
7. perspective;
8. product placement;
9. background;
10. environment;
11. lighting;
12. shadows;
13. spatial relationships;
14. visual style.

IMAGE 2 tidak boleh mengganti elemen tersebut.

=========================================================
IDENTITY LOCK
=========================================================

Jika IMAGE 2 tersedia:

Gunakan IMAGE 2 untuk:

- wajah;
- mata;
- alis;
- hidung;
- bibir;
- kulit;
- physical appearance;
- rambut;
- rambut/hijab;
- identitas karakter.

=========================================================
OUTFIT LOCK
=========================================================

OUTFIT SOURCE:

${outfitInstructions.label}

Jangan menggunakan outfit dari sumber lain.

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
IMAGE 1.

IDENTITY:
${hasCharacter
    ? "IMAGE 2."
    : "IMAGE 1."}

HAIR:
${hasCharacter
    ? "IMAGE 2 ONLY."
    : "IMAGE 1."}

OUTFIT:
${outfitInstructions.label}.

Jangan mencampurkan scene IMAGE 2 ke IMAGE 1.

Jangan menggunakan background IMAGE 2.

Jangan menggunakan lighting IMAGE 2.

Jangan menggunakan camera IMAGE 2.

Jangan menggunakan composition IMAGE 2.

Jangan menggunakan pose IMAGE 2 jika berbeda dari IMAGE 1.

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
   SOURCE FACT DIAGNOSTIC
========================================================= */

function buildPromptSourceDiagnostic(
    facts,
    outfitSource,
    hasCharacter
) {

    if (
        !Array.isArray(facts)
    ) {

        return {

            appearanceAuthority:
                hasCharacter
                    ? "IMAGE 2"
                    : "IMAGE 1",

            hairAuthority:
                hasCharacter
                    ? "IMAGE 2"
                    : "IMAGE 1",

            outfitAuthority:
                normalizeOutfitSource(
                    outfitSource
                ) === "character"
                    ? "IMAGE 2"
                    : "IMAGE 1"

        };

    }


    const appearanceFacts =
        facts.filter(
            fact =>
                getPromptFactRoot(
                    fact
                ) === "appearance"
        );


    const hairFacts =
        facts.filter(
            fact => {

                const root =
                    getPromptFactRoot(
                        fact
                    );


                const leaf =
                    getPromptFactLeaf(
                        fact
                    );


                return (
                    root === "face_hair" ||
                    root === "faceHair" ||
                    PROMPT_IDENTITY_FIELD_NAMES.includes(
                        leaf
                    )
                );

            }
        );


    return {

        appearanceAuthority:
            hasCharacter
                ? "IMAGE 2"
                : "IMAGE 1",

        hairAuthority:
            hasCharacter
                ? "IMAGE 2"
                : "IMAGE 1",

        outfitAuthority:
            normalizeOutfitSource(
                outfitSource
            ) === "character"
                ? "IMAGE 2"
                : "IMAGE 1",

        appearanceFactCount:
            appearanceFacts.length,

        hairRelatedFactCount:
            hairFacts.length

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

    const baseSettings =
        getPromptSettings(
            core,
            options
        );


    /*
     * ----------------------------------------------------
     * CHARACTER AVAILABILITY
     * ----------------------------------------------------
     */

    const hasCharacter =
        hasPromptReplacementCharacter();


    /*
     * ----------------------------------------------------
     * OUTFIT SOURCE
     * ----------------------------------------------------
     *
     * Penting:
     *
     * Jangan hanya membaca settings.outfitSource.
     *
     * vision-events.js juga menyimpan outfitSource
     * melalui state.setOutfitSource().
     */

    const outfitSource =
        resolvePromptOutfitSource(
            baseSettings
        );


    const promptSettings = {

        ...baseSettings,

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
            outfitSource,
            hasCharacter
        );


    const sourceDiagnostic =
        buildPromptSourceDiagnostic(
            facts,
            outfitSource,
            hasCharacter
        );


    console.info(
        "[GEN-Z.AI Vision] Prompt source authority:",
        sourceDiagnostic
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

            replacementCharacter:
                hasCharacter,

            outfitSource,

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


    /*
     * ----------------------------------------------------
     * HARD SOURCE CHECK
     * ----------------------------------------------------
     */

    if (
        hasCharacter &&
        sourceDiagnostic.appearanceAuthority !==
            "IMAGE 2"
    ) {

        throw core.createAPIError(

            "Source authority appearance tidak valid.",

            {

                code:
                    "INVALID_CHARACTER_APPEARANCE_AUTHORITY"

            }

        );

    }


    if (
        hasCharacter &&
        sourceDiagnostic.hairAuthority !==
            "IMAGE 2"
    ) {

        throw core.createAPIError(

            "Source authority rambut tidak valid.",

            {

                code:
                    "INVALID_CHARACTER_HAIR_AUTHORITY"

            }

        );

    }


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
                    outfitSource,
                    hasCharacter
                )

        },

        {

            role:
                "user",

            content:
                buildPromptUserPrompt(
                    normalizedAnalysis,
                    promptSettings,
                    hasCharacter
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
                "source-aware-field-level-identity-lock",

            analysisSource:
                "structured-visual-analysis",

            referenceAuthority:
                "IMAGE 1 scene",

            characterAuthority:
                hasCharacter
                    ? "IMAGE 2 identity"
                    : "IMAGE 1 identity",

            hairAuthority:
                hasCharacter
                    ? "IMAGE 2 ONLY"
                    : "IMAGE 1",

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
                "IMAGE 1 scene",

            characterAuthority:
                hasCharacter
                    ? "IMAGE 2 identity"
                    : "IMAGE 1 identity",

            hairAuthority:
                hasCharacter
                    ? "IMAGE 2 ONLY"
                    : "IMAGE 1",

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

                    outfitSource,

                    hasCharacter

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
                "IMAGE 1 scene",

            characterAuthority:
                hasCharacter
                    ? "IMAGE 2 identity"
                    : "IMAGE 1 identity",

            hairAuthority:
                hasCharacter
                    ? "IMAGE 2 ONLY"
                    : "IMAGE 1",

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
