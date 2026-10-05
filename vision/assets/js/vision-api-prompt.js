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

            /*
             * Jangan menerima wrapper kosong.
             */

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


    /*
     * Object dan array dianggap memiliki isi jika
     * memiliki minimal satu descendant yang bermakna.
     */

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

                        /*
                         * `present: false` adalah metadata,
                         * bukan fakta visual.
                         */

                        if (
                            key === "present" &&
                            child === false
                        ) {

                            return;

                        }


                        /*
                         * Jangan gunakan
                         * isMeaningfulPromptValue(child)
                         * sebagai gate.
                         *
                         * Kita harus selalu masuk ke nested
                         * object/array agar seluruh leaf facts
                         * tetap ditemukan.
                         */

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

PENTING:

Untuk pakaian/outfit, gunakan REPLACEMENT CHARACTER
sebagai sumber pakaian.

Artinya:

- pakaian replacement character adalah sumber utama
  untuk outfit final;
- pertahankan jenis pakaian replacement character;
- pertahankan warna pakaian replacement character;
- pertahankan material atau tekstur jika terlihat;
- pertahankan pola dan motif jika terlihat;
- pertahankan layering pakaian jika terlihat;
- pertahankan aksesori yang merupakan bagian dari outfit
  jika relevan;
- jangan mengambil pakaian dari reference image utama
  sebagai outfit final.

Reference image utama tetap dapat digunakan untuk:

- komposisi;
- pose;
- framing;
- background;
- environment;
- lighting;
- camera perspective;
- product placement;
- visual style;
- dan fakta visual lain yang memang berasal dari
  reference image.

JANGAN mencampurkan pakaian reference image dengan
pakaian replacement character.

Jika visual analysis yang tersedia berasal dari reference
image utama dan memiliki field clothing, field tersebut
tidak boleh dianggap sebagai sumber outfit final ketika
OUTFIT SOURCE adalah REPLACEMENT CHARACTER.

Untuk outfit final, prioritaskan instruksi sumber
replacement character.
`.trim(),

            userInstruction: `
=========================================================
ATURAN OUTFIT FINAL
=========================================================

SUMBER OUTFIT:
REPLACEMENT CHARACTER

Gunakan pakaian replacement character sebagai outfit final.

JANGAN menyalin pakaian dari reference image utama.

Pertahankan detail outfit replacement character yang
terlihat, termasuk:

- jenis pakaian;
- warna;
- material;
- tekstur;
- pola;
- motif;
- layering;
- potongan;
- bentuk;
- aksesori pakaian;
- detail kecil yang terlihat.

Reference image tetap menjadi sumber untuk elemen lain
yang relevan seperti pose, komposisi, background,
environment, lighting, kamera, dan product placement.

Jika terdapat konflik antara pakaian reference image dan
pakaian replacement character, pakaian replacement
character HARUS diprioritaskan.
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

PENTING:

Untuk pakaian/outfit, gunakan MAIN REFERENCE IMAGE
sebagai sumber pakaian.

Artinya:

- pakaian reference image adalah sumber utama untuk
  outfit final;
- pertahankan jenis pakaian reference image;
- pertahankan warna pakaian reference image;
- pertahankan material atau tekstur jika terlihat;
- pertahankan pola dan motif jika terlihat;
- pertahankan layering pakaian;
- pertahankan aksesori outfit yang terlihat jika relevan.

Jika terdapat REPLACEMENT CHARACTER, replacement character
digunakan sebagai sumber identitas/karakter sesuai konteks,
tetapi BUKAN sebagai sumber pakaian.

JANGAN mengganti outfit reference image dengan outfit
replacement character.

JANGAN mencampurkan detail pakaian dari kedua sumber.

Reference image utama menjadi sumber kebenaran untuk outfit.
`.trim(),

        userInstruction: `
=========================================================
ATURAN OUTFIT FINAL
=========================================================

SUMBER OUTFIT:
MAIN REFERENCE IMAGE

Gunakan pakaian dari main reference image sebagai outfit
final.

Pertahankan secara konkret:

- jenis pakaian;
- warna;
- material;
- tekstur;
- pola;
- motif;
- layering;
- potongan;
- bentuk;
- detail pakaian;
- aksesori yang terlihat sebagai bagian dari outfit.

Jika terdapat replacement character, jangan mengambil
pakaian replacement character.

Replacement character tidak boleh mengubah outfit yang
berasal dari main reference image.

Jika terdapat konflik antara pakaian reference image dan
pakaian replacement character, pakaian reference image
HARUS diprioritaskan.
`.trim()

    };

}


/* =========================================================
   PROMPT SYSTEM
========================================================= */

function buildPromptSystemPrompt(
    outfitSource = "reference"
) {

    const outfitInstructions =
        buildOutfitSourceInstructions(
            outfitSource
        );


    return `
You are the advanced prompt engineering engine of GEN-Z.AI Vision.

Transform the supplied structured visual analysis into ONE
extremely detailed production-ready prompt.

The visual analysis comes from an actual reference image.

The analysis is the SOURCE OF TRUTH.

${outfitInstructions.systemInstruction}

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

Untuk pakaian yang berasal dari sumber outfit yang
ditentukan di atas, pertahankan:

- warna
- bahan jika tersedia
- tekstur
- pola
- motif
- lipatan
- posisi
- cara dikenakan

Jangan mengambil detail outfit dari sumber yang tidak
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
OUTFIT SOURCE CONSISTENCY
=========================================================

${outfitInstructions.userInstruction}

Jangan menghasilkan instruksi outfit yang bertentangan
dengan sumber outfit yang telah ditentukan.

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


    const outfitSource =
        normalizeOutfitSource(
            settings.outfitSource
        );


    const outfitInstructions =
        buildOutfitSourceInstructions(
            outfitSource
        );


    return `
Buat SATU prompt final yang sangat rinci berdasarkan
visual analysis reference image.

Tujuan generasi:
${purpose}

Tingkat detail:
${detail}

Sumber outfit:
${outfitInstructions.label}

Instruksi tambahan:
${instruction || "Tidak ada"}

=========================================================
ATURAN OUTFIT
=========================================================

${outfitInstructions.userInstruction}

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

Untuk bagian pakaian, WAJIB mengikuti sumber outfit:

${outfitInstructions.label}

Jangan mencampurkan outfit dari sumber lain.

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


    /* -----------------------------------------------------
       OUTFIT SOURCE
       -----------------------------------------------------
       Default:
       reference
    ----------------------------------------------------- */

    const outfitSource =
        normalizeOutfitSource(
            settings.outfitSource
        );


    /*
     * Pastikan settings yang diteruskan ke prompt
     * memiliki outfitSource yang sudah dinormalisasi.
     *
     * Ini penting jika state lama tidak memiliki
     * property outfitSource.
     */

    const promptSettings = {

        ...settings,

        outfitSource

    };


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

            outputLanguage:
                "id-ID",

            detailMode:
                "concrete-visual-expansion",

            analysisSource:
                "structured-visual-analysis",

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

        formatAnalysisForPrompt,

        normalizeOutfitSource,

        buildOutfitSourceInstructions,

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
