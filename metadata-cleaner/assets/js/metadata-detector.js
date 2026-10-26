/* =========================================================
   GEN-Z.AI
   AI METADATA CLEANER
   ---------------------------------------------------------
   File:
   metadata-cleaner/assets/js/metadata-detector.js

   Fungsi:
   - Detect AI-related metadata indicators
   - Detect C2PA AI provenance metadata
   - Detect Content Credentials AI disclosure
   - Detect digitalSourceType
   - Detect trainedAlgorithmicMedia
   - Detect trainedAlgorithmicData
   - Detect known AI generators
   - Metadata-only detection
   - Mengurangi false positive
========================================================= */


/* =========================================================
   AI DETECTION
   ---------------------------------------------------------
   Metadata-only detection.

   IMPORTANT:
   ---------------------------------------------------------
   C2PA / Content Credentials dapat memberikan
   machine-readable AI provenance.

   Contoh:

       c2pa.created
       digitalSourceType
       trainedAlgorithmicMedia
       c2pa.ai-disclosure
       softwareAgent

   Jika metadata mengandung:

       trainedAlgorithmicMedia

   maka itu diperlakukan sebagai AI provenance
   karena C2PA mendefinisikannya sebagai media
   yang dibuat menggunakan AI/ML.

   Detection metadata bukan cryptographic verification.
========================================================= */

/* =========================================================
   AIGC MARKING
   ---------------------------------------------------------
   Sebagian platform (terutama video dari pipeline AIGC)
   tidak menulis kalimat "AI generated", tetapi MENYISIPKAN
   kotak penanda konten AI ke metadata container.

   Contoh nyata dari lapangan (ffprobe):

       tags.aigc_info  {"aigc_label_type":0,"source_info":""}
       tags.wxMeta     {"WXVer":671108930}

   Kotak `aigc_info` adalah penanda AIGC (AI-Generated
   Content). Kehadiran kotaknya sendiri sudah sinyal kuat:
   berkas itu melewati pipeline yang mencatat label AIGC.

   Sebelumnya penanda ini LOLOS karena detektor hanya
   mencocokkan kata kunci seperti "ai generated" atau
   "trainedAlgorithmicMedia". Akibatnya status akhir hanya
   mengikuti penilaian visual dan berkata "belum konklusif"
   padahal metadata sudah menyatakan konten AI.

   Catatan kejujuran:
   - Ini bukti METADATA (label dari pembuat/platform),
     bukan verifikasi forensik dan bukan deteksi piksel.
   - Nilai label (mis. aigc_label_type: 0) TIDAK ditafsirkan
     sebagai "pasti AI" atau "pasti bukan AI"; yang dilaporkan
     adalah keberadaan penandanya.
========================================================= */

/** Token `aigc` sebagai bagian nama field: tags.aigc_info, aigc_label, ... */
const AIGC_FIELD_TOKEN =
    /(^|[^a-z0-9])aigc([^a-z0-9]|$)/i;


/**
 * Kunci di dalam nilai metadata yang hanya dipakai skema
 * penandaan AIGC. Dicek pada nilai (bukan nama field) supaya
 * penanda yang tertanam sebagai JSON tetap tertangkap.
 */
const AIGC_VALUE_KEYS = [
    "aigc_label_type",
    "aigc_label",
    "aigc_generated",
    "aigc_info",
    "content_producer",
    "content_propagator",
    "produce_id"
];


/**
 * Deteksi penanda AIGC pada satu item metadata.
 *
 * @returns {Array<{keyword: string, field: string, value: string, source: string, category: string}>}
 */
export function detectAigcMarkers(
    item
) {

    if (
        !item
    ) {

        return [];
    }


    const field =
        String(
            item.field || ""
        );


    const value =
        String(
            item.value || ""
        );


    const source =
        String(
            item.source || ""
        );


    const byField =
        AIGC_FIELD_TOKEN.test(
            field
        );

    const loweredValue =
        value.toLowerCase();


    const byValueKey =
        AIGC_VALUE_KEYS.find(
            key => loweredValue.includes(
                key
            )
        ) || "";


    if (
        !byField &&
        !byValueKey
    ) {

        return [];
    }


    return [
        {

            keyword:
                "aigc",

            field,

            value,

            source,

            /*
             * Dipakai UI untuk menyebut "penandaan AIGC" secara
             * eksplisit, bukan sekadar "indikator metadata".
             */
            category:
                "aigc",

            evidence:
                byField
                    ? "nama field mengandung penanda aigc"
                    : `nilai memuat kunci ${byValueKey}`

        }
    ];

}


/**
 * True bila metadata memuat penandaan AIGC.
 */
export function hasAigcMarking(
    metadata
) {

    return (
        Array.isArray(
            metadata
        )
    ) && metadata.some(
        item => detectAigcMarkers(
            item
        ).length > 0
    );

}


export function detectAIIndicators(
    metadata
) {

    const matches = [];

    const seen =
        new Set();


    /* =====================================================
       STRONG IDENTIFIERS
       -----------------------------------------------------
       Identifier yang secara langsung mengindikasikan
       AI / generative media.
    ===================================================== */

    const strongPatterns = [

        /* -----------------------------------------------
           GENERAL AI
        ----------------------------------------------- */

        /\bartificial intelligence\b/i,

        /\bgenerative ai\b/i,

        /\bgenerated by ai\b/i,

        /\bai generated\b/i,

        /\bai-generated\b/i,

        /\bai generated content\b/i,

        /\bai-generated content\b/i,

        /\bai generated media\b/i,

        /\bai-generated media\b/i,

        /\bai generated image\b/i,

        /\bai-generated image\b/i,

        /\bai generated video\b/i,

        /\bai-generated video\b/i,

        /\bsynthetic media\b/i,

        /\bsynthetic image\b/i,

        /\bsynthetic video\b/i,

        /\bsynthetic content\b/i,


        /* -----------------------------------------------
           AIGC (AI-Generated Content) MARKING
        ----------------------------------------------- */

        /(^|[^a-z0-9])aigc([^a-z0-9]|$)/i,

        /ai\s*生成/i,

        /人工智能生成/,

        /\bai[- ]?generated content\b/i,

        /\bgenerated with ai\b/i,


        /* -----------------------------------------------
           C2PA AI PROVENANCE
        ----------------------------------------------- */

        /\bc2pa\.created\b/i,

        /\bc2pa\.ai-disclosure\b/i,

        /\bc2pa ai disclosure\b/i,

        /\bai-disclosure\b/i,

        /\bdigitalSourceType\b/i,

        /\bdigital source type\b/i,

        /\btrainedAlgorithmicMedia\b/i,

        /\btrained algorithmic media\b/i,

        /\btrainedAlgorithmicData\b/i,

        /\btrained algorithmic data\b/i,

        /\bcompositedWithTrainedAlgorithmicMedia\b/i,

        /\bcomposited with trained algorithmic media\b/i,


        /* -----------------------------------------------
           GENERATIVE AI SYSTEMS
        ----------------------------------------------- */

        /\bmidjourney\b/i,

        /\bstable diffusion\b/i,

        /\bcomfyui\b/i,

        /\bautomatic1111\b/i,

        /\bautomatic 1111\b/i,

        /\bfooocus\b/i,

        /\bleonardo ai\b/i,

        /\badobe firefly\b/i,

        /\bdall-e\b/i,

        /\bdalle\b/i,

        /\bopenai\b/i,

        /\bsora\b/i,

        /\brunwayml\b/i,

        /\brunway ai\b/i,

        /\bpika labs\b/i,

        /\bpika ai\b/i,

        /\bkling ai\b/i,

        /\bhailuo ai\b/i,

        /\bminimax ai\b/i,

        /\bluma ai\b/i,

        /\bdreamina\b/i,

        /\bseedance\b/i,

        /\bseedream\b/i,

        /\bblack forest labs\b/i,

        /\bideogram\b/i,

        /\bcanva ai\b/i,

        /\bgemini ai\b/i,

        /\bimagen\b/i,

        /\bnovelai\b/i,

        /\bpixverse\b/i,

        /\bveo\b/i,

        /\bsynthesia\b/i,

        /\bheygen\b/i,

        /\binvideo ai\b/i,

        /\bcapcut ai\b/i,

        /\btopaz ai\b/i,


        /* -----------------------------------------------
           GENERATIVE OPERATIONS
        ----------------------------------------------- */

        /\bgenerative fill\b/i,

        /\bgenerative expand\b/i,

        /\btext[- ]to[- ]image\b/i,

        /\btext[- ]to[- ]video\b/i,

        /\bimage generation\b/i,

        /\bimage generated\b/i,

        /\bvideo generation\b/i,

        /\bvideo generated\b/i

    ];


    /* =====================================================
       AI GENERATOR NAMES
       -----------------------------------------------------
       Nama provider/model yang dapat muncul tanpa
       kata "AI".
    ===================================================== */

    const generatorPatterns = [

        {
            name:
                "grok imagine",

            pattern:
                /\bgrok\s+imagine\b/i
        },

        {
            name:
                "grok",

            pattern:
                /\bgrok\b/i
        },

        {
            name:
                "sora",

            pattern:
                /\bsora\b/i
        },

        {
            name:
                "midjourney",

            pattern:
                /\bmidjourney\b/i
        },

        {
            name:
                "seedance",

            pattern:
                /\bseedance\b/i
        },

        {
            name:
                "seedream",

            pattern:
                /\bseedream\b/i
        },

        {
            name:
                "veo",

            pattern:
                /\bveo\b/i
        },

        {
            name:
                "kling",

            pattern:
                /\bkling\b/i
        },

        {
            name:
                "runway",

            pattern:
                /\brunway\b/i
        }

    ];


    /* =====================================================
       CONTEXTUAL IDENTIFIERS
       -----------------------------------------------------
       Nama seperti runway / pika / gemini tidak selalu
       berarti AI. Karena itu hanya dipakai jika berada
       di field metadata yang relevan.
    ===================================================== */

    const contextualPatterns = [

        {
            name:
                "firefly",

            pattern:
                /\bfirefly\b/i
        },

        {
            name:
                "runway",

            pattern:
                /\brunway\b/i
        },

        {
            name:
                "pika",

            pattern:
                /\bpika\b/i
        },

        {
            name:
                "kling",

            pattern:
                /\bkling\b/i
        },

        {
            name:
                "hailuo",

            pattern:
                /\bhailuo\b/i
        },

        {
            name:
                "minimax",

            pattern:
                /\bminimax\b/i
        },

        {
            name:
                "luma",

            pattern:
                /\bluma\b/i
        },

        {
            name:
                "gemini",

            pattern:
                /\bgemini\b/i
        },

        {
            name:
                "veo",

            pattern:
                /\bveo\b/i
        }

    ];


    /* =====================================================
       LOOP METADATA
    ===================================================== */

    for (
        const item of metadata || []
    ) {

        if (
            !item
        ) {

            continue;
        }


        const field =
            String(
                item.field || ""
            );


        const normalizedField =
            field
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9]/g, "");


        if (
            [
                "filename",
                "filetype",
                "filesize",
                "lastmodified",
                "containerextension"
            ].includes(
                normalizedField
            )
        ) {

            continue;
        }


        const value =
            String(
                item.value || ""
            );


        const source =
            String(
                item.source || ""
            );


        const combined =
            `${field} ${value} ${source}`;


        /* =================================================
           AIGC MARKING (STRUCTURAL)
           -------------------------------------------------
           Dicek lebih dulu karena penandanya berupa nama
           field / kunci JSON, bukan kalimat.
        ================================================= */

        const aigcMarkers =
            detectAigcMarkers({ field, value, source });


        for (
            const marker of aigcMarkers
        ) {

            const key =
                `aigc::${marker.field}::${marker.value}`;


            if (
                seen.has(
                    key
                )
            ) {

                continue;
            }


            seen.add(
                key
            );


            matches.push(
                marker
            );

        }


        /* =================================================
           STRONG MATCH
        ================================================= */

        for (
            const pattern of strongPatterns
        ) {

            const match =
                combined.match(
                    pattern
                );


            if (
                !match
            ) {

                continue;
            }


            const keyword =
                match[0]
                    .trim()
                    .toLowerCase();


            /*
             * Penanda aigc sudah dicatat rapi oleh
             * detectAigcMarkers(). Jangan hitung dua kali dengan
             * keyword aneh seperti ".aigc_".
             */
            if (
                aigcMarkers.length > 0 &&
                /^[^a-z0-9]*aigc/i.test(
                    keyword
                )
            ) {

                continue;
            }


            const key =
                `strong::${keyword}::${field}::${value}`;


            if (
                seen.has(
                    key
                )
            ) {

                continue;
            }


            seen.add(
                key
            );


            matches.push({

                keyword,

                field,

                value,

                source

            });

        }


        /* =================================================
           GENERATOR MATCH
           -------------------------------------------------
           Generator name seperti Grok Imagine diperlakukan
           sebagai strong AI metadata ketika muncul di
           metadata file.
        ================================================= */

        for (
            const itemPattern of generatorPatterns
        ) {

            const match =
                combined.match(
                    itemPattern.pattern
                );


            if (
                !match
            ) {

                continue;
            }


            const keyword =
                itemPattern.name;


            const key =
                `generator::${keyword}::${field}::${value}`;


            if (
                seen.has(
                    key
                )
            ) {

                continue;
            }


            seen.add(
                key
            );


            matches.push({

                keyword,

                field,

                value,

                source

            });

        }


        /* =================================================
           CONTEXTUAL MATCH
        ================================================= */

        const contextualField =
            (
                /software/i.test(
                    field
                ) ||

                /encoder/i.test(
                    field
                ) ||

                /creator/i.test(
                    field
                ) ||

                /author/i.test(
                    field
                ) ||

                /application/i.test(
                    field
                ) ||

                /producer/i.test(
                    field
                ) ||

                /handler/i.test(
                    field
                ) ||

                /writing/i.test(
                    field
                ) ||

                /generator/i.test(
                    field
                ) ||

                /model/i.test(
                    field
                ) ||

                /tool/i.test(
                    field
                ) ||

                /comment/i.test(
                    field
                ) ||

                /description/i.test(
                    field
                ) ||

                /title/i.test(
                    field
                ) ||

                /vendor/i.test(
                    field
                ) ||

                /provenance/i.test(
                    field
                ) ||

                /credential/i.test(
                    field
                ) ||

                /source/i.test(
                    field
                ) ||

                /creation/i.test(
                    field
                )
            );


        if (
            !contextualField
        ) {

            continue;
        }


        for (
            const itemPattern of contextualPatterns
        ) {

            if (
                !itemPattern.pattern.test(
                    value
                )
            ) {

                continue;
            }


            const keyword =
                itemPattern.name;


            const key =
                `context::${keyword}::${field}::${value}`;


            if (
                seen.has(
                    key
                )
            ) {

                continue;
            }


            seen.add(
                key
            );


            matches.push({

                keyword,

                field,

                value,

                source

            });

        }

    }


    return matches;

}


/* =========================================================
   C2PA AI HELPER
   ---------------------------------------------------------
   Dipakai jika module lain ingin memastikan bahwa
   indikator tertentu memang berasal dari C2PA AI
   provenance.
========================================================= */

export function hasC2PAAIIndicator(
    metadata
) {

    for (
        const item of metadata || []
    ) {

        if (
            !item
        ) {

            continue;
        }


        const combined =
            [
                item.field,
                item.value,
                item.source
            ]
                .map(
                    value =>
                        String(
                            value || ""
                        )
                )
                .join(
                    " "
                );


        if (
            /\btrainedAlgorithmicMedia\b/i.test(
                combined
            )
        ) {

            return true;
        }


        if (
            /\btrainedAlgorithmicData\b/i.test(
                combined
            )
        ) {

            return true;
        }


        if (
            /\bc2pa\.ai-disclosure\b/i.test(
                combined
            )
        ) {

            return true;
        }


        if (
            /\bc2pa\.created\b/i.test(
                combined
            ) &&
            /\bdigitalSourceType\b/i.test(
                combined
            )
        ) {

            return true;
        }

    }


    return false;

}
