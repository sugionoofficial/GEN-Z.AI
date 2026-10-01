/* =========================================================
   GEN-Z.AI
   METADATA STATUS MODULE
   ---------------------------------------------------------
   File:
   metadata-cleaner/assets/js/metadata-status.js

   Tanggung jawab:
   - Render detection result
   - Render status
   - Render metadata table
   - Render Sightengine AI Detection
   - Render Face Manipulation
   - Render AI generator scores
   - Group generator:
       Diffusion
       GAN
       Other
   - Render Deepfake
   - Render Sightengine request metadata
   - Render Sightengine media metadata
   - Mengatur AI DETECTION overlay

   AI DETECTION:
   1. Local metadata detector
   2. Sightengine visual AI detector

   Catatan:
   - Metadata detection dan visual detection
     merupakan dua sumber berbeda.
   - Tidak ada detector yang dapat menjamin
     asal media secara 100%.
   - Model pada AI DETECTION stamp berasal
     langsung dari result Sightengine.
   - Stamp visual ditampilkan jika Sightengine
     menyatakan salah satu detector visual
     terdeteksi:
       is_ai_generated === true
       is_face_manipulated === true
       is_deepfake === true
   - sightengineChecked menjadi sumber kebenaran
     apakah hasil Sightengine benar-benar tersedia.
========================================================= */


/* =========================================================
   STATE
========================================================= */

import {
    state
} from "./metadata-state.js";


/* =========================================================
   DOM
========================================================= */

import {
    elements
} from "./metadata-dom.js";


/* =========================================================
   CONSTANTS
========================================================= */

const SIGHTENGINE_SECTION_TITLE =
    "SIGHTENGINE AI DETECTION";


const SIGHTENGINE_GENERATORS_TITLE =
    "AI GENERATORS";


const SIGHTENGINE_DIFFUSION_TITLE =
    "DIFFUSION";


const SIGHTENGINE_GAN_TITLE =
    "GAN";


const SIGHTENGINE_OTHER_TITLE =
    "OTHER";


const SIGHTENGINE_REQUEST_TITLE =
    "SIGHTENGINE REQUEST";


const SIGHTENGINE_MEDIA_TITLE =
    "SIGHTENGINE MEDIA";


/* =========================================================
   GENERATOR GROUPS
   ---------------------------------------------------------
   Mengikuti kategori generator yang digunakan oleh
   Sightengine.

   Penting:
   - Hanya generator yang benar-benar dikirim backend
     yang ditampilkan.
   - Score 0% tetap ditampilkan.
   - Tidak membuat score palsu untuk generator yang
     tidak dikirim provider.
========================================================= */


/* =========================================================
   DIFFUSION GENERATORS
========================================================= */

const DIFFUSION_GENERATORS =
    new Set(
        [
            "dalle",
            "dall_e",
            "firefly",
            "flux",
            "gpt",
            "gpt_image",
            "gpt_image_generation",
            "grok",
            "higgsfield",
            "ideogram",
            "imagen",
            "kling",
            "midjourney",
            "nano_banana",
            "nanobanana",
            "qwen",
            "recraft",
            "reve",
            "seedream",
            "stable_diffusion",
            "wan",
            "z_image"
        ]
    );


/* =========================================================
   GAN GENERATORS
========================================================= */

const GAN_GENERATORS =
    new Set(
        [
            "gan",
            "stylegan"
        ]
    );


/* =========================================================
   OTHER GENERATORS
========================================================= */

const OTHER_GENERATORS =
    new Set(
        [
            "other",
            "deepfake"
        ]
    );


/* =========================================================
   BASIC HELPERS
========================================================= */

function isObject(
    value
) {

    return (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value)
    );

}


function escapeHtml(
    value
) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";

    }


    return String(
        value
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}


/* =========================================================
   NUMBER HELPERS
========================================================= */

function normalizeScore(
    value
) {

    const number =
        Number(
            value
        );


    if (
        !Number.isFinite(
            number
        )
    ) {

        return null;

    }


    return Math.max(
        0,
        Math.min(
            1,
            number
        )
    );

}


function normalizePercent(
    value
) {

    const number =
        Number(
            value
        );


    if (
        !Number.isFinite(
            number
        )
    ) {

        return null;

    }


    return Math.max(
        0,
        Math.min(
            100,
            number
        )
    );

}


/* =========================================================
   PERCENTAGE FORMAT
========================================================= */

function formatPercentage(
    score
) {

    const normalized =
        normalizeScore(
            score
        );


    if (
        normalized === null
    ) {

        return "N/A";

    }


    const percentage =
        normalized * 100;


    if (
        percentage === 0
    ) {

        return "0%";

    }


    if (
        percentage < 1
    ) {

        return `${percentage.toFixed(2)}%`;

    }


    if (
        Number.isInteger(
            percentage
        )
    ) {

        return `${percentage}%`;

    }


    return `${percentage.toFixed(1)}%`;

}


/* =========================================================
   PERCENT FROM PERCENT VALUE
========================================================= */

function formatPercentageFromPercent(
    value
) {

    const percentage =
        normalizePercent(
            value
        );


    if (
        percentage === null
    ) {

        return "N/A";

    }


    if (
        percentage === 0
    ) {

        return "0%";

    }


    if (
        percentage < 1
    ) {

        return `${percentage.toFixed(2)}%`;

    }


    if (
        Number.isInteger(
            percentage
        )
    ) {

        return `${percentage}%`;

    }


    return `${percentage.toFixed(1)}%`;

}


/* =========================================================
   GENERATOR NORMALIZED KEY
========================================================= */

function normalizeGeneratorKey(
    name
) {

    if (
        typeof name !== "string"
    ) {

        return "";

    }


    return name
        .trim()
        .toLowerCase()
        .replace(
            /[\s-]+/g,
            "_"
        );

}


/* =========================================================
   GENERATOR NAME FORMAT
========================================================= */

function formatGeneratorName(
    name
) {

    if (
        typeof name !== "string"
    ) {

        return "Unknown";

    }


    const normalized =
        normalizeGeneratorKey(
            name
        );


    const names = {

        dalle:
            "DALL·E",

        dall_e:
            "DALL·E",

        firefly:
            "Firefly",

        flux:
            "FLUX",

        gan:
            "GAN",

        gpt:
            "GPT",

        gpt_image:
            "GPT",

        gpt_image_generation:
            "GPT",

        grok:
            "Grok",

        higgsfield:
            "Higgsfield",

        ideogram:
            "Ideogram",

        kling:
            "Kling",

        imagen:
            "Imagen",

        midjourney:
            "MidJourney",

        nano_banana:
            "Nano Banana",

        nanobanana:
            "Nano Banana",

        qwen:
            "Qwen",

        recraft:
            "Recraft",

        reve:
            "Reve",

        seedream:
            "Seedream",

        stable_diffusion:
            "Stable Diffusion",

        stylegan:
            "StyleGAN",

        wan:
            "Wan",

        z_image:
            "Z-Image",

        other:
            "Other",

        deepfake:
            "Deepfake"

    };


    return (
        names[normalized] ||
        name
    );

}


/* =========================================================
   GENERATOR GROUP
   ---------------------------------------------------------
   Return:
       diffusion
       gan
       other

   Generator yang tidak dikenal tidak dibuang.
   Ia masuk OTHER agar hasil provider tidak hilang.
========================================================= */

function getGeneratorGroup(
    generator
) {

    if (
        !isObject(
            generator
        )
    ) {

        return "other";

    }


    const key =
        normalizeGeneratorKey(
            generator.name
        );


    if (
        DIFFUSION_GENERATORS.has(
            key
        )
    ) {

        return "diffusion";

    }


    if (
        GAN_GENERATORS.has(
            key
        )
    ) {

        return "gan";

    }


    if (
        OTHER_GENERATORS.has(
            key
        )
    ) {

        return "other";

    }


    return "other";

}


/* =========================================================
   GENERATOR FORMAT
   ---------------------------------------------------------
   IMPORTANT:
   - score adalah nilai utama dari Sightengine.
   - confidence hanya fallback.
   - score 0 adalah nilai valid.
========================================================= */

function formatGenerator(
    generator
) {

    if (
        !isObject(
            generator
        )
    ) {

        return "";

    }


    const name =
        formatGeneratorName(
            generator.name
        );


    if (
        !name
    ) {

        return "";

    }


    const score =
        normalizeScore(
            generator.score
        );


    if (
        score !== null
    ) {

        return (
            `${name} ` +
            `(${formatPercentage(score)})`
        );

    }


    const confidence =
        normalizePercent(
            generator.confidence
        );


    if (
        confidence !== null
    ) {

        return (
            `${name} ` +
            `(${formatPercentageFromPercent(confidence)})`
        );

    }


    return name;

}


/* =========================================================
   GENERATOR DISPLAY VALUE
========================================================= */

function formatGeneratorDisplay(
    generator
) {

    return (
        formatGenerator(
            generator
        ) ||
        "Tidak terdeteksi"
    );

}


/* =========================================================
   SAFE VALUE
========================================================= */

function formatValue(
    value
) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return "N/A";

    }


    return escapeHtml(
        value
    );

}


/* =========================================================
   METADATA ROW
========================================================= */

function createMetadataRow(
    label,
    value
) {

    return `
        <tr>
            <td class="metadata-key">
                ${escapeHtml(label)}
            </td>
            <td class="metadata-value">
                ${formatValue(value)}
            </td>
        </tr>
    `;

}


/* =========================================================
   SECTION ROW
========================================================= */

function createSectionRow(
    title
) {

    return `
        <tr class="metadata-section-row">
            <td colspan="2">
                ${escapeHtml(title)}
            </td>
        </tr>
    `;

}


/* =========================================================
   LOCAL METADATA
========================================================= */

function renderLocalMetadata(
    metadata
) {

    if (
        !Array.isArray(
            metadata
        )
    ) {

        return "";

    }


    if (
        metadata.length === 0
    ) {

        return "";

    }


    let html =
        "";


    for (
        const item of metadata
    ) {

        if (
            !isObject(
                item
            )
        ) {

            continue;

        }


        const field =
            item.field ??
            item.key ??
            item.name ??
            "";


        const value =
            item.value ??
            "";


        if (
            !field
        ) {

            continue;

        }


        html +=
            createMetadataRow(
                field,
                value
            );

    }


    return html;

}


/* =========================================================
   SIGHTENGINE RESULT AVAILABILITY
========================================================= */

function hasSightengineResult(
    detection
) {

    if (
        state.sightengineChecked !== true
    ) {

        return false;

    }


    return (
        isObject(
            detection
        )
    );

}


/* =========================================================
   SIGHTENGINE DETECTION
   ---------------------------------------------------------
   Tampilan utama:

       SIGHTENGINE AI DETECTION

       GenAI              99%
       Face manipulation  60%
       Deepfake           60%

   Detection Model dan informasi teknis tetap
   dipertahankan untuk kompatibilitas.
========================================================= */

function renderSightengineDetection(
    detection
) {

    if (
        !hasSightengineResult(
            detection
        )
    ) {

        return "";

    }


    const provider =
        detection.provider ||
        "sightengine";


    const model =
        detection.model ||
        "N/A";


    const aiGenerated =
        normalizeScore(
            detection.ai_generated
        );


    const confidence =
        normalizePercent(
            detection.confidence
        );


    const faceManipulation =
        normalizeScore(
            detection.face_manipulation
        );


    const faceManipulationConfidence =
        normalizePercent(
            detection.face_manipulation_confidence
        );


    const deepfake =
        normalizeScore(
            detection.deepfake
        );


    const deepfakeConfidence =
        normalizePercent(
            detection.deepfake_confidence
        );


    const isAiGenerated =
        detection.is_ai_generated === true;


    const isFaceManipulated =
        detection.is_face_manipulated === true;


    const isDeepfake =
        detection.is_deepfake === true;


    const detectedGenerator =
        isObject(
            detection.detected_generator
        )
            ? detection.detected_generator
            : null;


    let detectionStatus =
        "TIDAK TERSEDIA";


    if (
        isAiGenerated ||
        isFaceManipulated ||
        isDeepfake
    ) {

        detectionStatus =
            "TERDETEKSI";

    } else if (
        aiGenerated !== null ||
        faceManipulation !== null ||
        deepfake !== null
    ) {

        detectionStatus =
            "TIDAK TERDETEKSI";

    }


    const detectedGeneratorText =
        detectedGenerator
            ? formatGeneratorDisplay(
                detectedGenerator
            )
            : "Tidak terdeteksi";


    let html =
        "";


    html +=
        createSectionRow(
            SIGHTENGINE_SECTION_TITLE
        );


    /* =====================================================
       GenAI score
       -----------------------------------------------------
       Score menjadi sumber utama.
       Confidence hanya fallback.
    ===================================================== */

    html +=
        createMetadataRow(
            "GenAI",
            aiGenerated !== null
                ? formatPercentage(
                    aiGenerated
                )
                : confidence !== null
                    ? formatPercentageFromPercent(
                        confidence
                    )
                    : "N/A"
        );


    /* =====================================================
       Face manipulation score
    ===================================================== */

    html +=
        createMetadataRow(
            "Face manipulation",
            faceManipulation !== null
                ? formatPercentage(
                    faceManipulation
                )
                : faceManipulationConfidence !== null
                    ? formatPercentageFromPercent(
                        faceManipulationConfidence
                    )
                    : "N/A"
        );


    /* =====================================================
       Deepfake score
       -----------------------------------------------------
       Deepfake adalah hasil detector visual tersendiri.
       Generator Deepfake tetap juga ditampilkan pada
       grup OTHER apabila score/confidence tersedia.
    ===================================================== */

    html +=
        createMetadataRow(
            "Deepfake",
            deepfake !== null
                ? formatPercentage(
                    deepfake
                )
                : deepfakeConfidence !== null
                    ? formatPercentageFromPercent(
                        deepfakeConfidence
                    )
                    : "N/A"
        );


    /* =====================================================
       Informasi teknis
    ===================================================== */

    html +=
        createMetadataRow(
            "Provider",
            provider
        );


    html +=
        createMetadataRow(
            "Detection Model",
            model
        );


    html +=
        createMetadataRow(
            "Detection Status",
            detectionStatus
        );


    html +=
        createMetadataRow(
            "Detected Generator",
            detectedGeneratorText
        );


    return html;

}


/* =========================================================
   GENERATOR ROW
   ---------------------------------------------------------
   Score menjadi sumber utama.
   Confidence hanya fallback.
   Score 0 tetap valid.
========================================================= */

function renderGeneratorRow(
    generator
) {

    if (
        !isObject(
            generator
        )
    ) {

        return "";

    }


    const name =
        formatGeneratorName(
            generator.name
        );


    if (
        !name
    ) {

        return "";

    }


    let value =
        "";


    const score =
        normalizeScore(
            generator.score
        );


    const confidence =
        normalizePercent(
            generator.confidence
        );


    if (
        score !== null
    ) {

        value =
            formatPercentage(
                score
            );

    } else if (
        confidence !== null
    ) {

        value =
            formatPercentageFromPercent(
                confidence
            );

    } else {

        value =
            "N/A";

    }


    return createMetadataRow(
        name,
        value
    );

}


/* =========================================================
   GENERATOR GROUP RENDER
========================================================= */

function renderGeneratorGroup(
    title,
    generators
) {

    if (
        !Array.isArray(
            generators
        ) ||
        generators.length === 0
    ) {

        return "";

    }


    let html =
        "";


    html +=
        createSectionRow(
            title
        );


    for (
        const generator of generators
    ) {

        html +=
            renderGeneratorRow(
                generator
            );

    }


    return html;

}


/* =========================================================
   SORT GENERATORS
   ---------------------------------------------------------
   Provider order tetap dihormati berdasarkan score.

   Score 0 tetap masuk.
========================================================= */

function sortGenerators(
    generators
) {

    if (
        !Array.isArray(
            generators
        )
    ) {

        return [];

    }


    return [
        ...generators
    ]
        .filter(
            generator =>
                isObject(
                    generator
                )
        )
        .sort(
            (
                a,
                b
            ) => {

                const scoreA =
                    normalizeScore(
                        a.score
                    );


                const scoreB =
                    normalizeScore(
                        b.score
                    );


                const safeA =
                    scoreA === null
                        ? -1
                        : scoreA;


                const safeB =
                    scoreB === null
                        ? -1
                        : scoreB;


                return (
                    safeB -
                    safeA
                );

            }
        );

}


/* =========================================================
   AI GENERATORS
   ---------------------------------------------------------
   Struktur:

       AI GENERATORS

       DIFFUSION
       Imagen              76%
       Nano Banana         76%
       Wan                  8%
       ...

       GAN
       StyleGAN             1%

       OTHER
       Other                9%
       Deepfake            60%

   Deepfake ditambahkan pada OTHER dari field
   face/deepfake backend.

   Tidak ada generator yang dibuang hanya karena
   score = 0.
========================================================= */

function renderSightengineGenerators(
    detection
) {

    if (
        !hasSightengineResult(
            detection
        )
    ) {

        return "";

    }


    const generators =
        Array.isArray(
            detection.generators
        )
            ? detection.generators
            : [];


    /*
     * Tidak ada generator individual.
     *
     * Jangan membuat daftar generator palsu.
     *
     * Deepfake tetap dapat tampil meskipun
     * endpoint genai tidak mengembalikan
     * generators array.
     */

    if (
        generators.length === 0
    ) {

        const deepfakeScore =
            normalizeScore(
                detection.deepfake
            );


        const deepfakeConfidence =
            normalizePercent(
                detection.deepfake_confidence
            );


        if (
            deepfakeScore === null &&
            deepfakeConfidence === null
        ) {

            return "";

        }

    }


    const sortedGenerators =
        sortGenerators(
            generators
        );


    const diffusion = [];


    const gan = [];


    const other = [];


    for (
        const generator of sortedGenerators
    ) {

        const group =
            getGeneratorGroup(
                generator
            );


        if (
            group === "diffusion"
        ) {

            diffusion.push(
                generator
            );

        } else if (
            group === "gan"
        ) {

            gan.push(
                generator
            );

        } else {

            other.push(
                generator
            );

        }

    }


    /* =====================================================
       Deepfake
       -----------------------------------------------------
       Deepfake berasal dari detector deepfake,
       bukan ai_generators.
    ===================================================== */

    const deepfakeScore =
        normalizeScore(
            detection.deepfake
        );


    const deepfakeConfidence =
        normalizePercent(
            detection.deepfake_confidence
        );


    if (
        deepfakeScore !== null ||
        deepfakeConfidence !== null
    ) {

        other.push({

            name:
                "deepfake",

            score:
                deepfakeScore,

            confidence:
                deepfakeConfidence

        });

    }


    /*
     * Jangan render section utama kosong.
     */

    if (
        diffusion.length === 0 &&
        gan.length === 0 &&
        other.length === 0
    ) {

        return "";

    }


    let html =
        "";


    html +=
        createSectionRow(
            SIGHTENGINE_GENERATORS_TITLE
        );


    html +=
        renderGeneratorGroup(
            SIGHTENGINE_DIFFUSION_TITLE,
            diffusion
        );


    html +=
        renderGeneratorGroup(
            SIGHTENGINE_GAN_TITLE,
            gan
        );


    html +=
        renderGeneratorGroup(
            SIGHTENGINE_OTHER_TITLE,
            other
        );


    return html;

}


/* =========================================================
   SIGHTENGINE REQUEST
========================================================= */

function renderSightengineRequest(
    detection
) {

    if (
        !hasSightengineResult(
            detection
        )
    ) {

        return "";

    }


    const request =
        isObject(
            detection.request
        )
            ? detection.request
            : null;


    if (
        !request
    ) {

        return "";

    }


    const hasData =
        (
            request.id !== null &&
            request.id !== undefined
        ) ||
        (
            request.timestamp !== null &&
            request.timestamp !== undefined
        ) ||
        (
            request.operations !== null &&
            request.operations !== undefined
        );


    if (
        !hasData
    ) {

        return "";

    }


    let html =
        "";


    html +=
        createSectionRow(
            SIGHTENGINE_REQUEST_TITLE
        );


    html +=
        createMetadataRow(
            "Request ID",
            request.id
        );


    html +=
        createMetadataRow(
            "Timestamp",
            request.timestamp
        );


    html +=
        createMetadataRow(
            "Operations",
            request.operations
        );


    return html;

}


/* =========================================================
   SIGHTENGINE MEDIA
========================================================= */

function renderSightengineMedia(
    detection
) {

    if (
        !hasSightengineResult(
            detection
        )
    ) {

        return "";

    }


    const media =
        isObject(
            detection.media
        )
            ? detection.media
            : null;


    if (
        !media
    ) {

        return "";

    }


    const hasData =
        (
            typeof media.id === "string" &&
            media.id.trim()
        ) ||
        (
            typeof media.uri === "string" &&
            media.uri.trim()
        );


    if (
        !hasData
    ) {

        return "";

    }


    let html =
        "";


    html +=
        createSectionRow(
            SIGHTENGINE_MEDIA_TITLE
        );


    html +=
        createMetadataRow(
            "Media ID",
            media.id
        );


    html +=
        createMetadataRow(
            "Media URI",
            media.uri
        );


    return html;

}


/* =========================================================
   COMBINED SIGHTENGINE METADATA
========================================================= */

function renderSightengineMetadata(
    detection
) {

    if (
        !hasSightengineResult(
            detection
        )
    ) {

        return "";

    }


    let html =
        "";


    html +=
        renderSightengineDetection(
            detection
        );


    html +=
        renderSightengineGenerators(
            detection
        );


    html +=
        renderSightengineRequest(
            detection
        );


    html +=
        renderSightengineMedia(
            detection
        );


    return html;

}


/* =========================================================
   DETECTION RESULT
   ---------------------------------------------------------
   Sightengine dianggap terdeteksi jika salah satu:
   - is_ai_generated
   - is_face_manipulated
   - is_deepfake

   SIGHTENGINE CHECKED dianggap valid jika salah satu
   score detector tersedia.
========================================================= */

export function renderDetectionResult() {

    const metadataIndicators =
        Array.isArray(
            state.aiIndicators
        )
            ? state.aiIndicators
            : [];


    const metadataDetected =
        metadataIndicators.length > 0;


    const sightengine =
        state.sightengineDetection;


    const sightengineAvailable =
        hasSightengineResult(
            sightengine
        );


    /* =====================================================
       SIGHTENGINE DETECTED
    ===================================================== */

    const sightengineDetected =
        sightengineAvailable &&
        (
            sightengine.is_ai_generated === true ||
            sightengine.is_face_manipulated === true ||
            sightengine.is_deepfake === true
        );


    /* =====================================================
       AI DETECTED
    ===================================================== */

    if (
        metadataDetected ||
        sightengineDetected
    ) {

        /* =================================================
           SIGHTENGINE VISUAL DETECTION
        ================================================= */

        if (
            sightengineDetected
        ) {

            renderOverlayStamp(
                sightengine
            );

        } else {

            clearOverlayStamp();

        }


        /* =================================================
           METADATA + SIGHTENGINE
        ================================================= */

        if (
            metadataDetected &&
            sightengineDetected
        ) {

            setStatus(
                "DETECTED",
                "AI DETECTION",
                buildCombinedDetectionDescription(
                    metadataIndicators.length,
                    sightengine
                )
            );


            return;

        }


        /* =================================================
           SIGHTENGINE ONLY
        ================================================= */

        if (
            sightengineDetected
        ) {

            setStatus(
                "DETECTED",
                "AI DETECTION",
                buildSightengineDescription(
                    sightengine
                )
            );


            return;

        }


        /* =================================================
           METADATA ONLY
        ================================================= */

        setStatus(
            "DETECTED",
            "AI DETECT",
            `${metadataIndicators.length} indikator yang berkaitan dengan AI ditemukan pada metadata.`
        );


        return;

    }


    /* =====================================================
       SIGHTENGINE CHECKED
       -----------------------------------------------------
       Hasil Sightengine dianggap valid jika salah satu
       detector memiliki score.
    ===================================================== */

    const sightengineHasScore =
        sightengineAvailable &&
        (
            (
                sightengine.ai_generated !== null &&
                sightengine.ai_generated !== undefined
            ) ||
            (
                sightengine.face_manipulation !== null &&
                sightengine.face_manipulation !== undefined
            ) ||
            (
                sightengine.deepfake !== null &&
                sightengine.deepfake !== undefined
            )
        );


    if (
        sightengineHasScore
    ) {

        clearOverlayStamp();


        setStatus(
            "CLEAR",
            "TIDAK TERDETEKSI SEBAGAI AI",
            buildSightengineClearDescription(
                sightengine
            )
        );


        return;

    }


    /* =====================================================
       SIGHTENGINE ERROR
    ===================================================== */

    if (
        state.sightengineError
    ) {

        clearOverlayStamp();


        if (
            metadataDetected
        ) {

            setStatus(
                "DETECTED",
                "AI DETECT",
                `${metadataIndicators.length} indikator yang berkaitan dengan AI ditemukan pada metadata. AI visual detection dari Sightengine tidak tersedia.`
            );

        } else {

            setStatus(
                "UNKNOWN",
                "AI VISUAL DETECTION TIDAK TERSEDIA",
                "Metadata lokal berhasil diperiksa, tetapi Sightengine tidak dapat memberikan hasil visual AI detection."
            );

        }


        return;

    }


    /* =====================================================
       NO SIGHTENGINE RESULT
    ===================================================== */

    clearOverlayStamp();


    setStatus(
        metadataDetected
            ? "DETECTED"
            : "CLEAR",
        metadataDetected
            ? "AI DETECT"
            : "TIDAK TERDETEKSI DARI METADATA",
        metadataDetected
            ? `${metadataIndicators.length} indikator yang berkaitan dengan AI ditemukan pada metadata.`
            : "Tidak ditemukan indikator AI yang dikenali pada metadata yang berhasil dibaca. Ini bukan bukti bahwa media bukan hasil AI."
    );

}


/* =========================================================
   OVERLAY STAMP
========================================================= */

function renderOverlayStamp(
    sightengine
) {

    const overlay =
        elements.aiOverlay;


    if (
        !overlay
    ) {

        console.warn(
            "[GEN-Z.AI] AI detection overlay element tidak ditemukan."
        );


        return;

    }


    overlay.classList.remove(
        "hidden"
    );


    overlay.setAttribute(
        "aria-hidden",
        "false"
    );


    let stamp =
        overlay.querySelector(
            ".metadata-ai-detect-stamp"
        );


    if (
        !stamp
    ) {

        stamp =
            document.createElement(
                "div"
            );


        stamp.className =
            "metadata-ai-detect-stamp";


        overlay.appendChild(
            stamp
        );

    }


    let label =
        stamp.querySelector(
            ":scope > span:first-child"
        );


    if (
        !label
    ) {

        label =
            document.createElement(
                "span"
            );


        stamp.insertBefore(
            label,
            stamp.firstChild
        );

    }


    label.textContent =
        "AI DETECTION";


    renderOverlayModel(
        stamp,
        sightengine?.model
    );


    overlay.hidden =
        false;


    overlay.style.visibility =
        "visible";


    overlay.style.opacity =
        "1";

}


/* =========================================================
   OVERLAY MODEL
========================================================= */

function renderOverlayModel(
    stamp,
    model
) {

    if (
        !stamp
    ) {

        return;

    }


    const existing =
        stamp.querySelector(
            ".metadata-ai-detect-model"
        );


    if (
        existing
    ) {

        existing.remove();

    }


    if (
        model === null ||
        model === undefined
    ) {

        return;

    }


    const modelValue =
        String(
            model
        ).trim();


    if (
        !modelValue
    ) {

        return;

    }


    const modelLabel =
        document.createElement(
            "span"
        );


    modelLabel.className =
        "metadata-ai-detect-model";


    modelLabel.textContent =
        `Model ${modelValue}`;


    stamp.appendChild(
        modelLabel
    );

}


/* =========================================================
   CLEAR OVERLAY
========================================================= */

function clearOverlayStamp() {

    const overlay =
        elements.aiOverlay;


    if (
        !overlay
    ) {

        return;

    }


    overlay.classList.add(
        "hidden"
    );


    overlay.setAttribute(
        "aria-hidden",
        "true"
    );


    overlay.hidden =
        true;


    overlay.style.visibility =
        "hidden";


    overlay.style.opacity =
        "0";


    const label =
        overlay.querySelector(
            ".metadata-ai-detect-stamp > span:first-child"
        );


    if (
        label
    ) {

        label.textContent =
            "AI DETECTION";

    }


    const model =
        overlay.querySelector(
            ".metadata-ai-detect-model"
        );


    if (
        model
    ) {

        model.remove();

    }

}


/* =========================================================
   COMBINED DESCRIPTION
========================================================= */

function buildCombinedDetectionDescription(
    metadataCount,
    sightengine
) {

    const confidence =
        formatConfidence(
            sightengine?.ai_generated,
            sightengine?.confidence
        );


    const faceManipulation =
        formatFaceManipulationConfidence(
            sightengine
        );


    const deepfakeScore =
        normalizeScore(
            sightengine?.deepfake
        );


    const deepfakeConfidence =
        normalizePercent(
            sightengine?.deepfake_confidence
        );


    const deepfake =
        deepfakeScore !== null
            ? formatPercentage(
                deepfakeScore
            )
            : deepfakeConfidence !== null
                ? formatPercentageFromPercent(
                    deepfakeConfidence
                )
                : "";


    const generator =
        formatGenerator(
            sightengine?.detected_generator
        );


    const parts = [

        `${metadataCount} indikator AI ditemukan pada metadata.`,

        confidence
            ? `Sightengine mendeteksi indikasi GenAI dengan confidence ${confidence}.`
            : "",

        faceManipulation
            ? `Face manipulation: ${faceManipulation}.`
            : "",

        deepfake
            ? `Deepfake: ${deepfake}.`
            : "",

        generator
            ? `Generator teratas: ${generator}.`
            : ""

    ];


    return parts
        .filter(
            Boolean
        )
        .join(" ");

}


/* =========================================================
   SIGHTENGINE DESCRIPTION
========================================================= */

function buildSightengineDescription(
    sightengine
) {

    const confidence =
        formatConfidence(
            sightengine?.ai_generated,
            sightengine?.confidence
        );


    const faceManipulation =
        formatFaceManipulationConfidence(
            sightengine
        );


    const deepfakeScore =
        normalizeScore(
            sightengine?.deepfake
        );


    const deepfakeConfidence =
        normalizePercent(
            sightengine?.deepfake_confidence
        );


    const deepfake =
        deepfakeScore !== null
            ? formatPercentage(
                deepfakeScore
            )
            : deepfakeConfidence !== null
                ? formatPercentageFromPercent(
                    deepfakeConfidence
                )
                : "";


    const generator =
        formatGenerator(
            sightengine?.detected_generator
        );


    const parts = [

        "Sightengine mendeteksi indikasi bahwa image dibuat atau dimodifikasi menggunakan AI.",

        confidence
            ? `GenAI confidence: ${confidence}.`
            : "",

        faceManipulation
            ? `Face manipulation: ${faceManipulation}.`
            : "",

        deepfake
            ? `Deepfake: ${deepfake}.`
            : "",

        generator
            ? `Generator teratas: ${generator}.`
            : ""

    ];


    return parts
        .filter(
            Boolean
        )
        .join(" ");

}


/* =========================================================
   SIGHTENGINE CLEAR DESCRIPTION
========================================================= */

function buildSightengineClearDescription(
    sightengine
) {

    const confidence =
        formatConfidence(
            sightengine?.ai_generated,
            sightengine?.confidence
        );


    const faceManipulation =
        formatFaceManipulationConfidence(
            sightengine
        );


    const deepfakeScore =
        normalizeScore(
            sightengine?.deepfake
        );


    const deepfakeConfidence =
        normalizePercent(
            sightengine?.deepfake_confidence
        );


    const deepfake =
        deepfakeScore !== null
            ? formatPercentage(
                deepfakeScore
            )
            : deepfakeConfidence !== null
                ? formatPercentageFromPercent(
                    deepfakeConfidence
                )
                : "";


    const parts = [

        "Sightengine tidak mendeteksi image sebagai AI pada threshold yang digunakan.",

        confidence
            ? `Confidence AI: ${confidence}.`
            : "",

        faceManipulation
            ? `Face manipulation: ${faceManipulation}.`
            : "",

        deepfake
            ? `Deepfake: ${deepfake}.`
            : "",

        "Hasil ini bukan jaminan bahwa image pasti dibuat oleh manusia."

    ];


    return parts
        .filter(
            Boolean
        )
        .join(" ");

}


/* =========================================================
   CONFIDENCE FORMAT
========================================================= */

function formatConfidence(
    aiGenerated,
    confidence
) {

    const aiScore =
        Number(
            aiGenerated
        );


    if (
        Number.isFinite(
            aiScore
        )
    ) {

        const normalized =
            Math.max(
                0,
                Math.min(
                    1,
                    aiScore
                )
            );


        return `${Math.round(
            normalized * 100
        )}%`;

    }


    const explicitConfidence =
        Number(
            confidence
        );


    if (
        Number.isFinite(
            explicitConfidence
        )
    ) {

        return `${Math.round(
            Math.max(
                0,
                Math.min(
                    100,
                    explicitConfidence
                )
            )
        )}%`;

    }


    return "";

}


/* =========================================================
   FACE MANIPULATION CONFIDENCE
========================================================= */

function formatFaceManipulationConfidence(
    detection
) {

    if (
        !isObject(
            detection
        )
    ) {

        return "";

    }


    const score =
        normalizeScore(
            detection.face_manipulation
        );


    if (
        score !== null
    ) {

        return formatPercentage(
            score
        );

    }


    const confidence =
        normalizePercent(
            detection.face_manipulation_confidence
        );


    if (
        confidence !== null
    ) {

        return formatPercentageFromPercent(
            confidence
        );

    }


    return "";

}


/* =========================================================
   STATUS
========================================================= */

export function setStatus(
    type,
    title,
    description
) {

    if (
        elements.statusTitle
    ) {

        elements.statusTitle.textContent =
            title;

    }


    if (
        elements.statusDescription
    ) {

        elements.statusDescription.textContent =
            description;

    }


    if (
        !elements.statusIndicator
    ) {

        return;

    }


    elements.statusIndicator.classList.remove(
        "is-detected",
        "is-clear",
        "is-unknown"
    );


    if (
        type === "DETECTED"
    ) {

        elements.statusIndicator.classList.add(
            "is-detected"
        );

    } else if (
        type === "CLEAR"
    ) {

        elements.statusIndicator.classList.add(
            "is-clear"
        );

    } else {

        elements.statusIndicator.classList.add(
            "is-unknown"
        );

    }

}


/* =========================================================
   METADATA RENDER
========================================================= */

export function renderMetadata() {

    if (
        !elements.metadataTableBody
    ) {

        return;

    }


    const metadata =
        Array.isArray(
            state.metadata
        )
            ? state.metadata
            : [];


    const sightengine =
        state.sightengineDetection;


    let html =
        "";


    /* =====================================================
       LOCAL METADATA
    ===================================================== */

    html +=
        renderLocalMetadata(
            metadata
        );


    /* =====================================================
       SIGHTENGINE
    ===================================================== */

    html +=
        renderSightengineMetadata(
            sightengine
        );


    /* =====================================================
       EMPTY STATE
    ===================================================== */

    if (
        !html
    ) {

        elements.metadataTableBody.innerHTML = `
            <tr>
                <td
                    colspan="2"
                    class="metadata-empty-cell"
                >
                    Tidak ada metadata yang berhasil dibaca.
                </td>
            </tr>
        `;


        if (
            elements.metadataCount
        ) {

            elements.metadataCount.textContent =
                "0";

        }


        return;

    }


    /* =====================================================
       INSERT
    ===================================================== */

    elements.metadataTableBody.innerHTML =
        html;


    /* =====================================================
       COUNT
       -----------------------------------------------------
       Hanya metadata lokal yang dihitung.

       Section Sightengine tidak dianggap sebagai
       metadata file sehingga angka count tetap konsisten
       dengan fungsi lama.
    ===================================================== */

    if (
        elements.metadataCount
    ) {

        elements.metadataCount.textContent =
            String(
                metadata.length
            );

    }

}


/* =========================================================
   PUBLIC FORMATTERS
========================================================= */

export {

    formatPercentage,

    formatPercentageFromPercent,

    formatGeneratorName,

    formatGenerator,

    getGeneratorGroup,

    renderSightengineMetadata,

    renderSightengineDetection,

    renderSightengineGenerators,

    renderSightengineRequest,

    renderSightengineMedia

};
