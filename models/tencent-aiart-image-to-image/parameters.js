/* =========================================================
   GEN-Z.AI
   TENCENT AI ART
   IMAGE TO IMAGE (FOTO → GAMBAR ANIME)
   ---------------------------------------------------------
   File:
     models/tencent-aiart-image-to-image/parameters.js

   Parameter yang ditampilkan di form Generate:

   - image_urls     (wajib, 1 foto)
   - prompt         (opsional, maks 256 karakter)
   - negative_prompt(opsional, maks 256 karakter)
   - gaya           (opsional, default "Anime")
   - kemiripan      (opsional, default "Seimbang")

   CATATAN GAYA
   Nilai yang dipilih user adalah kata yang enak dibaca di
   HP; kode Tencent disimpan di STYLE_PRESETS dan dipetakan
   oleh parameter-adapter.js.

   Kode gaya mengikuti daftar resmi Tencent AI Art:
     000 = tanpa gaya tetap
     101 = lukisan tinta (水墨画)
     116 = 3D
     201 = anime Jepang (日系动漫) — default Tencent
     203 = guofeng / klasik Tiongkok (唯美古风)
     204 = anime retro (复古动漫)
     301 = kartun game hand-drawn (游戏卡通手绘)
     401 = realis (通用写实)

   CATATAN KEMIRIPAN
   Nilai `kemiripan` dipetakan ke parameter Strength
   (0 < Strength <= 1). Makin kecil makin mirip foto asli.
   Tencent menyarankan 0.6 – 0.8 untuk hasil seimbang.
========================================================= */


const STYLE_PRESETS =
    Object.freeze([

        Object.freeze({
            value: "Anime",
            code: "201"
        }),

        Object.freeze({
            value: "Kartun",
            code: "301"
        }),

        Object.freeze({
            value: "Anime klasik",
            code: "204"
        }),

        Object.freeze({
            value: "Guofeng",
            code: "203"
        }),

        Object.freeze({
            value: "Lukisan tinta",
            code: "101"
        }),

        Object.freeze({
            value: "3D",
            code: "116"
        }),

        Object.freeze({
            value: "Realistis",
            code: "401"
        }),

        Object.freeze({
            value: "Bebas",
            code: "000"
        })

    ]);


const SIMILARITY_PRESETS =
    Object.freeze([

        Object.freeze({
            value: "Sangat mirip",
            strength: 0.45
        }),

        Object.freeze({
            value: "Seimbang",
            strength: 0.65
        }),

        Object.freeze({
            value: "Banyak diubah",
            strength: 0.85
        })

    ]);


const parameters = [

    /* =====================================================
       FOTO SUMBER
    ===================================================== */

    {
        name:
            "image_urls",

        type:
            "array",

        required:
            true,

        minItems:
            1,

        maxItems:
            1,

        description:
            "Satu foto asli (JPG/PNG/WebP). Sisi terpendek minimal 50 px dan sisi terpanjang maksimal 5000 px."
    },


    /* =====================================================
       PROMPT
    ===================================================== */

    {
        name:
            "prompt",

        type:
            "string",

        required:
            false,

        maxLength:
            256,

        description:
            "Arahan tambahan, misalnya \"gadis tersenyum memakai jaket denim, latar kafe\". Maksimal 256 karakter. Tencent menyarankan bahasa Mandarin; teks Indonesia/Inggris tetap diproses."
    },


    /* =====================================================
       NEGATIVE PROMPT
    ===================================================== */

    {
        name:
            "negative_prompt",

        type:
            "string",

        required:
            false,

        maxLength:
            256,

        description:
            "Hal yang tidak diinginkan, misalnya \"blur, tangan cacat, latar ramai\". Maksimal 256 karakter."
    },


    /* =====================================================
       GAYA
    ===================================================== */

    {
        name:
            "gaya",

        type:
            "string",

        required:
            false,

        enum:
            STYLE_PRESETS.map(
                preset =>
                    preset.value
            ),

        default:
            "Anime",

        label:
            "Gaya Gambar",

        description:
            "Anime = gaya default Tencent (201). Kartun, Anime klasik, Guofeng, Lukisan tinta, 3D, Realistis, dan Bebas memakai kode gaya resmi Tencent lain."
    },


    /* =====================================================
       KEMIRIPAN
    ===================================================== */

    {
        name:
            "kemiripan",

        type:
            "string",

        required:
            false,

        enum:
            SIMILARITY_PRESETS.map(
                preset =>
                    preset.value
            ),

        default:
            "Seimbang",

        label:
            "Seberapa Mirip Foto Asli",

        description:
            "Sangat mirip = wajah & pose dipertahankan (Strength 0.45). Seimbang = 0.65. Banyak diubah = 0.85, lebih bebas tapi wajah bisa berubah."
    }

];


/* =========================================================
   PARAMETER LOOKUP
========================================================= */

function getParameter(
    name
) {

    return parameters.find(
        parameter =>
            parameter &&
            parameter.name === name
    ) || null;

}


/* =========================================================
   NORMALIZE HELPERS
========================================================= */

function normalizeString(
    value
) {

    if (
        typeof value !==
        "string"
    ) {

        return "";

    }

    return value.trim();

}


function normalizeUrlArray(
    value
) {

    const list =
        Array.isArray(
            value
        )
            ? value
            : (
                typeof value ===
                    "string" &&
                value.trim()
                    ? [
                        value
                    ]
                    : []
            );


    return list
        .map(
            item =>
                normalizeString(
                    String(
                        item ??
                        ""
                    )
                )
        )
        .filter(
            Boolean
        )
        .slice(
            0,
            1
        );

}


function findPreset(
    presets,
    value
) {

    const target =
        normalizeString(
            String(
                value ??
                ""
            )
        )
            .toLowerCase();


    if (
        !target
    ) {

        return null;

    }


    return presets.find(
        preset =>
            preset.value
                .toLowerCase() ===
            target
    ) || null;

}


/* =========================================================
   VALIDATE
========================================================= */

function validate(
    input = {}
) {

    const errors = [];


    if (
        !input ||
        typeof input !==
            "object" ||
        Array.isArray(
            input
        )
    ) {

        return {
            valid:
                false,

            errors: [
                "Parameter input harus berupa object."
            ]
        };

    }


    /* =====================================================
       FOTO
    ===================================================== */

    const imageUrls =
        normalizeUrlArray(
            input.image_urls
        );


    if (
        imageUrls.length ===
            0
    ) {

        errors.push(
            "Satu foto asli wajib diunggah."
        );

    }


    /* =====================================================
       PROMPT
    ===================================================== */

    const prompt =
        normalizeString(
            input.prompt
        );


    if (
        prompt.length >
            256
    ) {

        errors.push(
            "Prompt maksimal 256 karakter (Tencent AI Art)."
        );

    }


    const negativePrompt =
        normalizeString(
            input.negative_prompt
        );


    if (
        negativePrompt.length >
            256
    ) {

        errors.push(
            "Negative prompt maksimal 256 karakter (Tencent AI Art)."
        );

    }


    /* =====================================================
       GAYA
    ===================================================== */

    const gaya =
        normalizeString(
            input.gaya
        );


    if (
        gaya &&
        !findPreset(
            STYLE_PRESETS,
            gaya
        )
    ) {

        errors.push(
            `Gaya tidak dikenal. Pilih salah satu: ${STYLE_PRESETS.map(preset => preset.value).join(", ")}.`
        );

    }


    /* =====================================================
       KEMIRIPAN
    ===================================================== */

    const kemiripan =
        normalizeString(
            input.kemiripan
        );


    if (
        kemiripan &&
        !findPreset(
            SIMILARITY_PRESETS,
            kemiripan
        )
    ) {

        errors.push(
            `Kemiripan tidak dikenal. Pilih salah satu: ${SIMILARITY_PRESETS.map(preset => preset.value).join(", ")}.`
        );

    }


    /* =====================================================
       RESULT
    ===================================================== */

    return {
        valid:
            errors.length === 0,
        errors
    };

}


/* =========================================================
   EXPORTS
========================================================= */

export {
    parameters,
    STYLE_PRESETS,
    SIMILARITY_PRESETS,
    getParameter,
    validate,
    normalizeString,
    normalizeUrlArray,
    findPreset
};


export default parameters;
