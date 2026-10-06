/* =========================================================
   GEN-Z.AI VISION
   ---------------------------------------------------------
   File:
   vision/assets/js/vision-api-models.js

   Fungsi:
   - OpenKey model catalog
   - Capability detection
   - Vision model detection
   - Vision model resolution
   - Single image message
   - Multi image message
   - Reference / Character outfit source
   - Explicit identity / hair source locking
========================================================= */


const OPENKEY_VISION_MODEL_IDS =
    Object.freeze(
        new Set([

            "grok-4.5",

            "grok-4.6",

            "qwen3-vl-max"

        ])
    );


/* =========================================================
   CORE
========================================================= */

function visionCore() {

    return window.GENZVisionCore;

}


/* =========================================================
   STATE
========================================================= */

function visionState() {

    if (
        window.GENZVisionState
    ) {

        return window.GENZVisionState;

    }


    return null;

}


/* =========================================================
   OPENKEY MODEL CATALOG
========================================================= */

async function getOpenKeyModels(
    options = {}
) {

    const response =
        await visionCore().request(

            {

                operation:
                    "openkey_models"

            },

            {

                timeout:
                    options.timeout ||
                    visionCore().CONFIG.timeout

            }

        );


    if (
        !response?.success
    ) {

        throw visionCore().createAPIError(

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

        throw visionCore().createAPIError(

            "OpenKey tidak mengembalikan daftar model.",

            {

                code:
                    "OPENKEY_MODELS_EMPTY",

                data:
                    response

            }

        );

    }


    console.info(
        "[GEN-Z.AI Vision] OpenKey catalog received:",
        models.map(
            model => ({

                id:
                    model?.model_id ||
                    model?.id ||
                    null,

                name:
                    model?.model_name ||
                    model?.name ||
                    null,

                input_modalities:
                    model?.input_modalities ||
                    null,

                output_modalities:
                    model?.output_modalities ||
                    null,

                capabilities:
                    model?.capabilities ||
                    null,

                modality:
                    model?.modality ||
                    null,

                modalities:
                    model?.modalities ||
                    null,

                architecture:
                    model?.architecture ||
                    null,

                raw:
                    model

            })
        )
    );


    return models;

}


/* =========================================================
   COLLECT MODALITY VALUES
========================================================= */

function collectModalityValues(
    value,
    result = []
) {

    if (
        value === null ||
        value === undefined
    ) {

        return result;

    }


    if (
        Array.isArray(value)
    ) {

        value.forEach(
            item => {

                collectModalityValues(
                    item,
                    result
                );

            }
        );


        return result;

    }


    if (
        typeof value === "string"
    ) {

        const normalized =
            value
                .trim()
                .toLowerCase();


        if (
            normalized
        ) {

            result.push(
                normalized
            );

        }


        return result;

    }


    if (
        typeof value === "boolean"
    ) {

        result.push(
            value
                ? "true"
                : "false"
        );


        return result;

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
                        item
                    ]
                ) => {

                    const normalizedKey =
                        String(
                            key
                        )
                            .trim()
                            .toLowerCase();


                    if (
                        normalizedKey
                    ) {

                        result.push(
                            normalizedKey
                        );

                    }


                    if (
                        item === true
                    ) {

                        result.push(
                            normalizedKey
                        );

                    }
                    else {

                        collectModalityValues(
                            item,
                            result
                        );

                    }

                }
            );

    }


    return result;

}


/* =========================================================
   GET MODEL CAPABILITIES
========================================================= */

function getModelCapabilities(
    model
) {

    if (
        !model ||
        typeof model !==
            "object"
    ) {

        return [];

    }


    const values = [];


    collectModalityValues(
        model.input_modalities,
        values
    );


    collectModalityValues(
        model.inputModalities,
        values
    );


    collectModalityValues(
        model.modalities,
        values
    );


    collectModalityValues(
        model.modality,
        values
    );


    collectModalityValues(
        model.capabilities,
        values
    );


    collectModalityValues(
        model.architecture,
        values
    );


    if (
        model.raw &&
        typeof model.raw ===
            "object"
    ) {

        collectModalityValues(
            model.raw.input_modalities,
            values
        );


        collectModalityValues(
            model.raw.inputModalities,
            values
        );


        collectModalityValues(
            model.raw.modalities,
            values
        );


        collectModalityValues(
            model.raw.modality,
            values
        );


        collectModalityValues(
            model.raw.capabilities,
            values
        );


        collectModalityValues(
            model.raw.architecture,
            values
        );

    }


    return [
        ...new Set(
            values
                .map(
                    value =>
                        String(
                            value
                        )
                            .trim()
                            .toLowerCase()
                )
                .filter(Boolean)
        )
    ];

}


/* =========================================================
   DOCUMENTED VISION MODEL
========================================================= */

function isOpenKeyDocumentedVisionModel(
    model
) {

    if (
        !model ||
        typeof model !==
            "object"
    ) {

        return false;

    }


    const id =
        String(
            model.model_id ||
            model.id ||
            ""
        )
            .trim()
            .toLowerCase();


    if (
        !id
    ) {

        return false;

    }


    return OPENKEY_VISION_MODEL_IDS.has(
        id
    );

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


    const explicitInputModalities = [

        ...(
            Array.isArray(
                model.input_modalities
            )
                ? model.input_modalities
                : []
        ),

        ...(
            Array.isArray(
                model.inputModalities
            )
                ? model.inputModalities
                : []
        )

    ]
        .map(
            value =>
                String(
                    value || ""
                )
                    .trim()
                    .toLowerCase()
        )
        .filter(Boolean);


    const outputModalities = [

        ...(
            Array.isArray(
                model.output_modalities
            )
                ? model.output_modalities
                : []
        ),

        ...(
            Array.isArray(
                model.outputModalities
            )
                ? model.outputModalities
                : []
        )

    ]
        .map(
            value =>
                String(
                    value || ""
                )
                    .trim()
                    .toLowerCase()
        )
        .filter(Boolean);


    const capabilities =
        getModelCapabilities(
            model
        );


    const inputModalities = [

        ...new Set([

            ...explicitInputModalities,

            ...capabilities

        ])

    ];


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
            [
                ...new Set(
                    outputModalities
                )
            ],

        capabilities

    };

}


/* =========================================================
   IMAGE INPUT
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
        new Set([

            ...normalized.input_modalities,

            ...normalized.capabilities

        ]);


    const imageIndicators = [

        "image",

        "images",

        "vision",

        "multimodal",

        "multimodal_input",

        "image_url",

        "image-input",

        "image_input",

        "visual",

        "visual_input"

    ];


    if (
        imageIndicators.some(
            indicator =>
                modalities.has(
                    indicator
                )
        )
    ) {

        return true;

    }


    return isOpenKeyDocumentedVisionModel(
        normalized
    );

}


/* =========================================================
   RESOLVE VISION MODEL
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

        throw visionCore().createAPIError(

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
       USER MEMILIH MODEL TERTENTU
    ===================================================== */

    if (
        requested
    ) {

        const requestedId =
            requested.id
                .trim()
                .toLowerCase();


        console.info(
            "[GEN-Z.AI Vision] Resolving requested model:",
            {

                requestedModel:
                    requestedId

            }
        );


        const exact =
            normalizedModels.find(

                model =>

                    model.id
                        .trim()
                        .toLowerCase() ===
                    requestedId

            );


        if (
            !exact
        ) {

            console.error(
                "[GEN-Z.AI Vision] Requested Vision model tidak ditemukan di katalog OpenKey:",
                {

                    requestedModel:
                        requestedId,

                    availableModels:
                        normalizedModels.map(
                            model =>
                                model.id
                        )

                }
            );


            throw visionCore().createAPIError(

                "Model Vision yang dipilih tidak tersedia di OpenKey: " +
                requested.id,

                {

                    code:
                        "OPENKEY_REQUESTED_MODEL_NOT_FOUND",

                    data: {

                        requestedModel:
                            requested,

                        availableModels:
                            normalizedModels.map(
                                model => ({

                                    id:
                                        model.id,

                                    name:
                                        model.name,

                                    input_modalities:
                                        model.input_modalities,

                                    capabilities:
                                        model.capabilities

                                })
                            )

                    }

                }

            );

        }


        if (
            !supportsImageInput(
                exact
            )
        ) {

            console.error(
                "[GEN-Z.AI Vision] Requested model tidak mendukung image input:",
                {

                    requestedModel:
                        exact.id,

                    input_modalities:
                        exact.input_modalities,

                    capabilities:
                        exact.capabilities,

                    documentedVision:
                        isOpenKeyDocumentedVisionModel(
                            exact
                        )

                }
            );


            throw visionCore().createAPIError(

                "Model Vision yang dipilih tidak mendukung input gambar: " +
                exact.id,

                {

                    code:
                        "OPENKEY_REQUESTED_MODEL_NOT_VISION",

                    data: {

                        model:
                            exact

                    }

                }

            );

        }


        console.info(
            "[GEN-Z.AI Vision] Using requested Vision model:",
            {

                id:
                    exact.id,

                name:
                    exact.name,

                input_modalities:
                    exact.input_modalities,

                capabilities:
                    exact.capabilities

            }
        );


        return exact;

    }


    /* =====================================================
       TIDAK ADA REQUESTED MODEL
    ===================================================== */

    const visionModels =
        normalizedModels.filter(
            supportsImageInput
        );


    if (
        visionModels.length ===
        0
    ) {

        throw visionCore().createAPIError(

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
                                    model.input_modalities,

                                capabilities:
                                    model.capabilities,

                                openkey_documented_vision:
                                    isOpenKeyDocumentedVisionModel(
                                        model
                                    )

                            })
                        )

                }

            }

        );

    }


    const selected =
        visionModels[0];


    const state =
        visionCore().getState();


    if (
        typeof state.setModel ===
        "function"
    ) {

        state.setModel(
            selected
        );

    }


    console.info(
        "[GEN-Z.AI Vision] Vision model fallback selected:",
        {

            id:
                selected.id,

            name:
                selected.name,

            input_modalities:
                selected.input_modalities,

            capabilities:
                selected.capabilities

        }
    );


    return selected;

}


/* =========================================================
   NORMALIZE OUTFIT SOURCE
========================================================= */

function normalizeOutfitSource(
    source
) {

    const normalized =
        String(
            source || "reference"
        )
            .trim()
            .toLowerCase();


    if (
        normalized === "character"
    ) {

        return "character";

    }


    return "reference";

}


/* =========================================================
   GET CURRENT OUTFIT SOURCE
========================================================= */

function getCurrentOutfitSource(
    source = null
) {

    if (
        source !== null &&
        source !== undefined
    ) {

        return normalizeOutfitSource(
            source
        );

    }


    const state =
        visionState();


    if (
        state &&
        typeof state.getOutfitSource ===
            "function"
    ) {

        return normalizeOutfitSource(
            state.getOutfitSource()
        );

    }


    return "reference";

}


/* =========================================================
   VALIDATE IMAGE DATA URL
========================================================= */

function isValidImageDataUrl(
    dataUrl
) {

    return (

        typeof dataUrl ===
            "string" &&

        dataUrl.startsWith(
            "data:image/"
        )

    );

}


/* =========================================================
   VALIDATE IMAGE
========================================================= */

function validateVisionImage(
    dataUrl,
    label = "Image"
) {

    if (
        !isValidImageDataUrl(
            dataUrl
        )
    ) {

        throw visionCore().createAPIError(

            label +
            " tidak valid.",

            {

                code:
                    "INVALID_VISION_IMAGE"

            }

        );

    }


    return true;

}


/* =========================================================
   BUILD IMAGE MESSAGE
========================================================= */

function buildImageMessage(
    text,
    dataUrl
) {

    validateVisionImage(
        dataUrl,
        "Reference image"
    );


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
   BUILD MULTI IMAGE MESSAGE
   ---------------------------------------------------------
   SOURCE AUTHORITY LOCK
   ---------------------------------------------------------

   IMAGE 1 = REFERENCE IMAGE

   IMAGE 2 = REPLACEMENT CHARACTER

   Saat outfitSource = character:

   IMAGE 1 AUTHORITY:
   - scene
   - location
   - environment
   - background
   - composition
   - framing
   - pose
   - camera
   - lens
   - lighting
   - shadows
   - spatial relationships
   - product

   IMAGE 2 AUTHORITY:
   - identity
   - face
   - eyes
   - eyebrows
   - nose
   - lips
   - skin
   - hair
   - hair color
   - hair texture
   - hair style
   - hair length
   - braids
   - curls
   - waves
   - bangs
   - hairline
   - physical characteristics
   - clothing
   - outfit
   - character accessories

   PENTING:
   IMAGE 1 TIDAK BOLEH menjadi sumber rambut
   ketika outfitSource = character.
========================================================= */

function buildMultiImageMessage(
    options = {}
) {

    const {

        text = "",

        referenceImage = null,

        characterImage = null,

        outfitSource = null

    } = options;


    const normalizedOutfitSource =
        getCurrentOutfitSource(
            outfitSource
        );


    const hasReference =
        isValidImageDataUrl(
            referenceImage
        );


    const hasCharacter =
        isValidImageDataUrl(
            characterImage
        );


    if (
        !hasReference
    ) {

        throw visionCore().createAPIError(

            "Reference image tidak tersedia atau tidak valid.",

            {

                code:
                    "INVALID_REFERENCE_IMAGE"

            }

        );

    }


    if (
        normalizedOutfitSource ===
            "character" &&
        !hasCharacter
    ) {

        throw visionCore().createAPIError(

            "Replacement Character wajib tersedia ketika Outfit Source menggunakan Replacement Character Outfit.",

            {

                code:
                    "CHARACTER_IMAGE_REQUIRED_FOR_OUTFIT"

            }

        );

    }


    const content = [];


    /* =====================================================
       BASE INSTRUCTION
    ===================================================== */

    const baseText =
        String(
            text ||
            ""
        ).trim();


    if (
        baseText
    ) {

        content.push({

            type:
                "text",

            text:
                baseText

        });

    }


    /* =====================================================
       GLOBAL SOURCE AUTHORITY
    ===================================================== */

    content.push({

        type:
            "text",

        text:
            normalizedOutfitSource ===
                "character"

                ? [

                    "SOURCE AUTHORITY LOCK.",

                    "",

                    "IMAGE 1 = REFERENCE IMAGE.",

                    "IMAGE 2 = REPLACEMENT CHARACTER.",

                    "",

                    "IMAGE 1 adalah satu-satunya sumber untuk scene, lokasi, environment, background, pose, composition, framing, camera, lens, lighting, shadows, spatial relationships, dan product.",

                    "",

                    "IMAGE 2 adalah satu-satunya sumber untuk identitas karakter.",

                    "Identitas karakter mencakup wajah, struktur wajah, mata, alis, hidung, bibir, warna kulit, tekstur kulit, bentuk tubuh yang terlihat, dan seluruh karakteristik fisik.",

                    "",

                    "SANGAT PENTING: RAMBUT HARUS SELALU DIAMBIL DARI IMAGE 2.",

                    "Gunakan IMAGE 2 sebagai satu-satunya authority untuk warna rambut, panjang rambut, tekstur rambut, gaya rambut, bentuk rambut, braids, curls, waves, bangs, hair part, hairline, dan seluruh detail rambut.",

                    "Jangan mengambil rambut dari IMAGE 1.",

                    "Jika rambut IMAGE 1 berbeda dengan rambut IMAGE 2, abaikan rambut IMAGE 1 sepenuhnya dan gunakan rambut IMAGE 2.",

                    "Jangan menggabungkan, mencampur, atau menginterpolasikan rambut dari kedua gambar.",

                    "",

                    "IMAGE 2 juga menjadi sumber outfit/pakaian final karena OUTFIT SOURCE = CHARACTER.",

                    "Jangan mengambil pakaian, warna pakaian, desain pakaian, tekstur pakaian, atau aksesori outfit dari IMAGE 1.",

                    "",

                    "Jangan pernah menggunakan karakteristik identity IMAGE 1 untuk menggantikan identity IMAGE 2."

                ].join("\n")

                : [

                    "SOURCE AUTHORITY LOCK.",

                    "",

                    "IMAGE 1 = REFERENCE IMAGE.",

                    "IMAGE 2 = REPLACEMENT CHARACTER.",

                    "",

                    "IMAGE 1 adalah sumber utama scene, lokasi, environment, background, pose, composition, framing, camera, lens, lighting, shadows, spatial relationships, product, dan outfit/pakaian.",

                    "",

                    "IMAGE 2 hanya menjadi sumber identitas karakter.",

                    "Identitas karakter mencakup wajah, struktur wajah, mata, alis, hidung, bibir, warna kulit, tekstur kulit, bentuk tubuh yang terlihat, dan rambut.",

                    "Rambut harus mengikuti IMAGE 2.",

                    "Jangan mengambil rambut atau outfit dari IMAGE 2 sebagai pengganti sumber reference.",

                    "",

                    "Jangan mencampur outfit kedua gambar."

                ].join("\n")

    });


    /* =====================================================
       REFERENCE IMAGE LABEL
    ===================================================== */

    content.push({

        type:
            "text",

        text:
            normalizedOutfitSource ===
                "reference"

                ? [

                    "REFERENCE IMAGE:",

                    "Gunakan gambar berikut sebagai sumber utama scene dan outfit.",

                    "Pertahankan lokasi, lingkungan, background, pose, composition, framing, camera, lighting, product, pakaian, warna pakaian, tekstur pakaian, dan detail outfit dari gambar ini.",

                    "Jangan gunakan reference image untuk menggantikan identitas karakter IMAGE 2."

                ].join("\n")

                : [

                    "REFERENCE IMAGE:",

                    "Gunakan gambar berikut hanya sebagai sumber scene.",

                    "Pertahankan lokasi, lingkungan, background, pose, composition, framing, camera, lens, lighting, shadows, spatial relationships, dan product.",

                    "JANGAN gunakan wajah, rambut, kulit, tubuh, identitas, atau outfit dari gambar ini sebagai sumber replacement character.",

                    "RAMBUT IMAGE 1 HARUS DIABAIKAN untuk identity replacement character."

                ].join("\n")

    });


    content.push({

        type:
            "image_url",

        image_url: {

            url:
                referenceImage

        }

    });


    /* =====================================================
       CHARACTER IMAGE
    ===================================================== */

    if (
        hasCharacter
    ) {

        content.push({

            type:
                "text",

            text:
                normalizedOutfitSource ===
                    "character"

                    ? [

                        "REPLACEMENT CHARACTER IMAGE:",

                        "Gambar berikut adalah authority utama dan eksklusif untuk identitas karakter.",

                        "Gunakan wajah, struktur wajah, mata, alis, hidung, bibir, warna kulit, tekstur kulit, bentuk tubuh yang terlihat, dan seluruh karakteristik fisik dari gambar ini.",

                        "",

                        "RAMBUT CHARACTER WAJIB DIAMBIL DARI GAMBAR INI.",

                        "Pertahankan warna rambut, panjang rambut, tekstur rambut, bentuk rambut, gaya rambut, braids, curls, waves, bangs, hair part, hairline, dan detail rambut lain persis berdasarkan karakter yang terlihat pada gambar ini.",

                        "Jangan menggunakan rambut REFERENCE IMAGE.",

                        "Jangan mencampur rambut REFERENCE IMAGE dengan rambut CHARACTER IMAGE.",

                        "",

                        "Karena OUTFIT SOURCE = CHARACTER, gunakan juga pakaian dan outfit dari gambar ini sebagai sumber outfit final.",

                        "Jangan mengambil outfit dari REFERENCE IMAGE."

                    ].join("\n")

                    : [

                        "REPLACEMENT CHARACTER IMAGE:",

                        "Gunakan gambar ini sebagai sumber identitas karakter.",

                        "Pertahankan wajah, struktur wajah, mata, alis, hidung, bibir, warna kulit, bentuk tubuh yang terlihat, dan rambut.",

                        "Jangan mengambil outfit atau pakaian dari gambar ini.",

                        "Outfit tetap berasal dari REFERENCE IMAGE."

                    ].join("\n")

        });


        content.push({

            type:
                "image_url",

            image_url: {

                url:
                    characterImage

            }

        });

    }


    /* =====================================================
       FINAL IDENTITY LOCK
    ===================================================== */

    content.push({

        type:
            "text",

        text:
            normalizedOutfitSource ===
                "character"

                ? [

                    "FINAL IDENTITY LOCK:",

                    "IMAGE 2 adalah identity authority.",

                    "Wajah IMAGE 2 harus dipertahankan.",

                    "Rambut IMAGE 2 harus dipertahankan.",

                    "Jangan mengganti rambut IMAGE 2 dengan rambut IMAGE 1.",

                    "Jangan menggunakan warna, panjang, tekstur, atau gaya rambut IMAGE 1.",

                    "Jika terdapat konflik antara IMAGE 1 dan IMAGE 2 mengenai identity atau rambut, IMAGE 2 selalu menang."

                ].join("\n")

                : [

                    "FINAL IDENTITY LOCK:",

                    "IMAGE 2 adalah sumber identity replacement character.",

                    "IMAGE 2 mengontrol wajah dan rambut karakter.",

                    "IMAGE 1 mengontrol scene dan outfit."

                ].join("\n")

    });


    /* =====================================================
       FINAL OUTFIT RULE
    ===================================================== */

    content.push({

        type:
            "text",

        text:
            normalizedOutfitSource ===
                "character"

                ? [

                    "OUTFIT SOURCE FINAL: REPLACEMENT CHARACTER.",

                    "Outfit/pakaian final harus mengikuti IMAGE 2.",

                    "Jangan mencampur pakaian, warna pakaian, desain pakaian, tekstur pakaian, atau aksesori outfit dari IMAGE 1."

                ].join("\n")

                : [

                    "OUTFIT SOURCE FINAL: REFERENCE IMAGE.",

                    "Outfit/pakaian final harus mengikuti IMAGE 1.",

                    "Replacement character tidak boleh menjadi sumber pakaian atau aksesori outfit."

                ].join("\n")

    });


    return content;

}


/* =========================================================
   BUILD VISION IMAGE MESSAGE
========================================================= */

function buildVisionImageMessage(
    text,
    options = {}
) {

    const state =
        visionState();


    /* =====================================================
       REFERENCE IMAGE
    ===================================================== */

    const hasExplicitReferenceImage =
        Object.prototype.hasOwnProperty.call(
            options,
            "referenceImage"
        );


    const referenceImage =
        hasExplicitReferenceImage
            ? options.referenceImage
            : (
                state &&
                typeof state.getReferenceImage ===
                    "function"

                    ? state.getReferenceImage()

                    : null
            );


    /* =====================================================
       CHARACTER IMAGE
    ===================================================== */

    const hasExplicitCharacterImage =
        Object.prototype.hasOwnProperty.call(
            options,
            "characterImage"
        );


    const characterImage =
        hasExplicitCharacterImage
            ? options.characterImage
            : (
                state &&
                typeof state.getCharacterImage ===
                    "function"

                    ? state.getCharacterImage()

                    : null
            );


    /* =====================================================
       OUTFIT SOURCE
    ===================================================== */

    const outfitSource =
        getCurrentOutfitSource(
            options.outfitSource
        );


    /* =====================================================
       DEBUG
    ===================================================== */

    console.info(
        "[GEN-Z.AI Vision] Building Vision image message:",
        {

            outfitSource,

            referenceImageAvailable:
                isValidImageDataUrl(
                    referenceImage
                ),

            characterImageAvailable:
                isValidImageDataUrl(
                    characterImage
                ),

            characterImageExplicit:
                hasExplicitCharacterImage

        }
    );


    /* =====================================================
       SINGLE IMAGE
    ===================================================== */

    if (
        !isValidImageDataUrl(
            characterImage
        )
    ) {

        return buildImageMessage(

            text,

            referenceImage

        );

    }


    /* =====================================================
       MULTI IMAGE
    ===================================================== */

    return buildMultiImageMessage({

        text,

        referenceImage,

        characterImage,

        outfitSource

    });

}


/* =========================================================
   BUILD OUTFIT SOURCE INSTRUCTIONS
========================================================= */

function buildOutfitSourceInstructions(
    source = null
) {

    const outfitSource =
        getCurrentOutfitSource(
            source
        );


    if (
        outfitSource ===
            "character"
    ) {

        return [

            "OUTFIT SOURCE: REPLACEMENT CHARACTER.",

            "Gunakan replacement character sebagai sumber outfit/pakaian final.",

            "Gunakan replacement character juga sebagai satu-satunya sumber identitas karakter.",

            "Identitas mencakup wajah, kulit, bentuk fisik, dan RAMBUT.",

            "RAMBUT wajib mengikuti replacement character.",

            "Jangan mengambil rambut dari reference image.",

            "Jika rambut reference image berbeda dengan replacement character, abaikan rambut reference image.",

            "Jangan mencampur rambut kedua gambar.",

            "Jangan mengambil outfit dari reference image.",

            "Jangan mencampur pakaian, warna, desain, aksesori, tekstur, atau detail outfit dari reference image.",

            "Reference image tetap digunakan untuk komposisi, pose, produk, lingkungan, pencahayaan, kamera, background, dan elemen visual scene lainnya.",

            "Pertahankan identitas replacement character secara konsisten."

        ];

    }


    return [

        "OUTFIT SOURCE: REFERENCE IMAGE.",

        "Gunakan reference image sebagai sumber outfit/pakaian final.",

        "Gunakan replacement character sebagai sumber identitas karakter.",

        "Identitas mencakup wajah, kulit, bentuk fisik, dan RAMBUT.",

        "Rambut harus mengikuti replacement character.",

        "Jangan mengambil outfit dari replacement character.",

        "Jangan mencampur pakaian, warna, desain, aksesori, tekstur, atau detail outfit dari replacement character."

    ];

}


/* =========================================================
   GET SELECTED MODEL
========================================================= */

function getSelectedModel() {

    const stateModule =
        visionState();


    if (
        stateModule &&
        typeof stateModule.getModel ===
            "function"
    ) {

        return stateModule.getModel();

    }


    const core =
        visionCore();


    if (
        core &&
        typeof core.getState ===
            "function"
    ) {

        const state =
            core.getState();


        if (
            state &&
            typeof state.get ===
                "function"
        ) {

            return state.get(
                "model",
                null
            );

        }


        if (
            state &&
            state.model
        ) {

            return state.model;

        }

    }


    return null;

}


/* =========================================================
   DEBUG IMAGE SOURCES
========================================================= */

function getVisionImageSources(
    options = {}
) {

    const state =
        visionState();


    /* =====================================================
       REFERENCE IMAGE
    ===================================================== */

    const hasExplicitReferenceImage =
        Object.prototype.hasOwnProperty.call(
            options,
            "referenceImage"
        );


    const referenceImage =
        hasExplicitReferenceImage
            ? options.referenceImage
            : (
                state &&
                typeof state.getReferenceImage ===
                    "function"

                    ? state.getReferenceImage()

                    : null
            );


    /* =====================================================
       CHARACTER IMAGE
    ===================================================== */

    const hasExplicitCharacterImage =
        Object.prototype.hasOwnProperty.call(
            options,
            "characterImage"
        );


    const characterImage =
        hasExplicitCharacterImage
            ? options.characterImage
            : (
                state &&
                typeof state.getCharacterImage ===
                    "function"

                    ? state.getCharacterImage()

                    : null
            );


    /* =====================================================
       OUTFIT SOURCE
    ===================================================== */

    const outfitSource =
        getCurrentOutfitSource(
            options.outfitSource
        );


    return {

        referenceImageAvailable:
            isValidImageDataUrl(
                referenceImage
            ),

        characterImageAvailable:
            isValidImageDataUrl(
                characterImage
            ),

        outfitSource,

        imageCount:
            Number(
                isValidImageDataUrl(
                    referenceImage
                )
            ) +
            Number(
                isValidImageDataUrl(
                    characterImage
                )
            )

    };

}


/* =========================================================
   GLOBAL MODULE
========================================================= */

window.GENZVisionModels =
    Object.freeze({

        /* -----------------------------------------
           MODEL CATALOG
        ----------------------------------------- */

        getOpenKeyModels,

        collectModalityValues,

        getModelCapabilities,

        isOpenKeyDocumentedVisionModel,

        normalizeVisionModel,

        supportsImageInput,

        resolveVisionModel,


        /* -----------------------------------------
           OUTFIT SOURCE
        ----------------------------------------- */

        normalizeOutfitSource,

        getCurrentOutfitSource,

        buildOutfitSourceInstructions,


        /* -----------------------------------------
           IMAGE VALIDATION
        ----------------------------------------- */

        isValidImageDataUrl,

        validateVisionImage,


        /* -----------------------------------------
           IMAGE MESSAGE
        ----------------------------------------- */

        buildImageMessage,

        buildMultiImageMessage,

        buildVisionImageMessage,

        getVisionImageSources,


        /* -----------------------------------------
           MODEL
        ----------------------------------------- */

        getSelectedModel

    });
