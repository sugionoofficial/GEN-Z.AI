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
   - Render Content Provenance / C2PA
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
   2. C2PA / Content Credentials provenance
   3. Sightengine visual AI detector

   CONTENT PROVENANCE:
   1. C2PA
   2. Content Credentials
   3. Verification status
   4. Digital Source Type
   5. AI Disclosure
   6. Provenance findings

   Catatan:
   - Metadata detection dan visual detection
     merupakan dua sumber berbeda.
   - Provenance detection merupakan sumber informasi
     provenance yang dapat menjadi signal AI apabila
     C2PA / Content Credentials menyatakan informasi
     terkait AI.
   - Provenance DETECTED tidak sama dengan VERIFIED.
   - Verification tetap dipisahkan dari detection.
   - Tidak ada detector yang dapat menjamin
     asal media secara 100%.
   - Model pada AI DETECTION stamp berasal
     langsung dari result Sightengine jika
     Sightengine menjadi sumber detection.
   - Jika hanya provenance yang terdeteksi,
     stamp menggunakan sumber:
       C2PA
       Content Credentials
       Content Provenance
     tanpa mengarang nama model AI.
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

const PROVENANCE_SECTION_TITLE =
    "CONTENT PROVENANCE";


const PROVENANCE_C2PA_TITLE =
    "C2PA";


const PROVENANCE_CREDENTIALS_TITLE =
    "CONTENT CREDENTIALS";


const PROVENANCE_FINDINGS_TITLE =
    "PROVENANCE FINDINGS";


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

        imagen:
            "Imagen",

        kling:
            "Kling",

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
   GENERIC OBJECT DISPLAY
========================================================= */

function formatStructuredValue(
    value
) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return "N/A";

    }


    if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
    ) {

        return escapeHtml(
            value
        );

    }


    if (
        Array.isArray(
            value
        )
    ) {

        if (
            value.length === 0
        ) {

            return "N/A";

        }


        return escapeHtml(
            value
                .map(
                    item => {

                        if (
                            item === null ||
                            item === undefined
                        ) {

                            return "";

                        }


                        if (
                            typeof item === "object"
                        ) {

                            try {

                                return JSON.stringify(
                                    item
                                );

                            } catch (
                                error
                            ) {

                                return String(
                                    item
                                );

                            }

                        }


                        return String(
                            item
                        );

                    }
                )
                .filter(
                    Boolean
                )
                .join(
                    ", "
                )
        );

    }


    if (
        typeof value === "object"
    ) {

        try {

            return escapeHtml(
                JSON.stringify(
                    value
                )
            );

        } catch (
            error
        ) {

            return escapeHtml(
                String(
                    value
                )
            );

        }

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
   STRUCTURED METADATA ROW
========================================================= */

function createStructuredMetadataRow(
    label,
    value
) {

    return `
        <tr>
            <td class="metadata-key">
                ${escapeHtml(label)}
            </td>
            <td class="metadata-value">
                ${formatStructuredValue(value)}
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
   PROVENANCE RESULT AVAILABILITY
========================================================= */

function hasProvenanceResult(
    provenance
) {

    if (
        !isObject(
            provenance
        )
    ) {

        return false;

    }


    return (
        provenance.checked === true
    );

}


/* =========================================================
   PROVENANCE DETECTED
   ---------------------------------------------------------
   Provenance dianggap terdeteksi apabila:
   - root detected === true
   - C2PA detected === true
   - Content Credentials detected === true
========================================================= */

function isProvenanceDetected(
    provenance
) {

    if (
        !hasProvenanceResult(
            provenance
        )
    ) {

        return false;

    }


    return (
        provenance.detected === true ||
        provenance.c2pa?.detected === true ||
        provenance.contentCredentials?.detected === true
    );

}


/* =========================================================
   AI PROVENANCE SIGNAL
   ---------------------------------------------------------
   C2PA / Content Credentials dapat memberikan signal
   AI melalui:
   - digitalSourceType
   - aiDisclosure
   - C2PA detected
   - Content Credentials detected

   Untuk UI GEN-Z.AI, keberadaan C2PA / CC yang telah
   terdeteksi dianggap sebagai detection signal.

   IMPORTANT:
   DETECTED != VERIFIED
========================================================= */

function hasAIProvenanceSignal(
    provenance
) {

    if (
        !isProvenanceDetected(
            provenance
        )
    ) {

        return false;

    }


    if (
        provenance.digitalSourceType !== null &&
        provenance.digitalSourceType !== undefined &&
        provenance.digitalSourceType !== ""
    ) {

        return true;

    }


    if (
        provenance.aiDisclosure !== null &&
        provenance.aiDisclosure !== undefined &&
        provenance.aiDisclosure !== ""
    ) {

        return true;

    }


    if (
        provenance.c2pa?.detected === true
    ) {

        return true;

    }


    if (
        provenance.contentCredentials?.detected === true
    ) {

        return true;

    }


    return false;

}


/* =========================================================
   PROVENANCE STATUS
========================================================= */

function formatProvenanceStatus(
    provenance
) {

    if (
        !isObject(
            provenance
        )
    ) {

        return "N/A";

    }


    if (
        provenance.verified === true
    ) {

        return "VERIFIED";

    }


    if (
        provenance.detected === true
    ) {

        return "DETECTED";

    }


    if (
        provenance.c2pa?.detected === true
    ) {

        return "DETECTED";

    }


    if (
        provenance.contentCredentials?.detected === true
    ) {

        return "DETECTED";

    }


    if (
        provenance.status
    ) {

        return String(
            provenance.status
        );

    }


    return "NOT_DETECTED";

}


/* =========================================================
   PROVENANCE VERIFICATION STATUS
========================================================= */

function formatProvenanceVerificationStatus(
    provenance
) {

    if (
        !isObject(
            provenance
        )
    ) {

        return "N/A";

    }


    if (
        provenance.verified === true
    ) {

        return "VERIFIED";

    }


    if (
        provenance.verificationStatus
    ) {

        return String(
            provenance.verificationStatus
        );

    }


    return "NOT_VERIFIED";

}


/* =========================================================
   PROVENANCE C2PA
========================================================= */

function renderProvenanceC2PA(
    provenance
) {

    if (
        !hasProvenanceResult(
            provenance
        )
    ) {

        return "";

    }


    const c2pa =
        isObject(
            provenance.c2pa
        )
            ? provenance.c2pa
            : null;


    if (
        !c2pa
    ) {

        return "";

    }


    const detected =
        c2pa.detected === true;


    const verified =
        c2pa.verified === true;


    const manifestCount =
        Number.isFinite(
            Number(
                c2pa.manifestCount
            )
        )
            ? Math.max(
                0,
                Number(
                    c2pa.manifestCount
                )
            )
            : 0;


    let html =
        "";


    html +=
        createSectionRow(
            PROVENANCE_C2PA_TITLE
        );


    html +=
        createMetadataRow(
            "Status",
            detected
                ? "DETECTED"
                : "NOT DETECTED"
        );


    html +=
        createMetadataRow(
            "Verification",
            verified
                ? "VERIFIED"
                : "NOT VERIFIED"
        );


    html +=
        createMetadataRow(
            "Manifest Count",
            manifestCount
        );


    return html;

}


/* =========================================================
   PROVENANCE CONTENT CREDENTIALS
========================================================= */

function renderProvenanceContentCredentials(
    provenance
) {

    if (
        !hasProvenanceResult(
            provenance
        )
    ) {

        return "";

    }


    const credentials =
        isObject(
            provenance.contentCredentials
        )
            ? provenance.contentCredentials
            : null;


    if (
        !credentials
    ) {

        return "";

    }


    const detected =
        credentials.detected === true;


    const verified =
        credentials.verified === true;


    let html =
        "";


    html +=
        createSectionRow(
            PROVENANCE_CREDENTIALS_TITLE
        );


    html +=
        createMetadataRow(
            "Status",
            detected
                ? "DETECTED"
                : "NOT DETECTED"
        );


    html +=
        createMetadataRow(
            "Verification",
            verified
                ? "VERIFIED"
                : "NOT VERIFIED"
        );


    return html;

}


/* =========================================================
   PROVENANCE FINDINGS
========================================================= */

function renderProvenanceFindings(
    provenance
) {

    if (
        !hasProvenanceResult(
            provenance
        )
    ) {

        return "";

    }


    const findings =
        Array.isArray(
            provenance.findings
        )
            ? provenance.findings
            : [];


    if (
        findings.length === 0
    ) {

        return "";

    }


    let html =
        "";


    html +=
        createSectionRow(
            PROVENANCE_FINDINGS_TITLE
        );


    for (
        const finding of findings
    ) {

        if (
            isObject(
                finding
            )
        ) {

            const label =
                finding.label ??
                finding.type ??
                finding.name ??
                "Finding";


            const value =
                finding.value ??
                finding.message ??
                finding.description ??
                "";


            html +=
                createStructuredMetadataRow(
                    label,
                    value
                );


            continue;

        }


        html +=
            createMetadataRow(
                "Finding",
                finding
            );

    }


    return html;

}


/* =========================================================
   PROVENANCE METADATA
========================================================= */

function renderProvenanceMetadata(
    provenance
) {

    if (
        !hasProvenanceResult(
            provenance
        )
    ) {

        return "";

    }


    let html =
        "";


    html +=
        createSectionRow(
            PROVENANCE_SECTION_TITLE
        );


    html +=
        createMetadataRow(
            "Status",
            formatProvenanceStatus(
                provenance
            )
        );


    html +=
        createMetadataRow(
            "Format",
            provenance.format ??
                "unknown"
        );


    html +=
        createMetadataRow(
            "Verification",
            formatProvenanceVerificationStatus(
                provenance
            )
        );


    html +=
        renderProvenanceC2PA(
            provenance
        );


    html +=
        renderProvenanceContentCredentials(
            provenance
        );


    if (
        provenance.digitalSourceType !== null &&
        provenance.digitalSourceType !== undefined &&
        provenance.digitalSourceType !== ""
    ) {

        html +=
            createStructuredMetadataRow(
                "Digital Source Type",
                provenance.digitalSourceType
            );

    }


    if (
        provenance.aiDisclosure !== null &&
        provenance.aiDisclosure !== undefined &&
        provenance.aiDisclosure !== ""
    ) {

        html +=
            createStructuredMetadataRow(
                "AI Disclosure",
                provenance.aiDisclosure
            );

    }


    html +=
        renderProvenanceFindings(
            provenance
        );


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
        faceManipulation !== null
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

        const generatorKey =
            normalizeGeneratorKey(
                generator.name
            );


        if (
            generatorKey === "deepfake"
        ) {

            continue;

        }


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
   COMBINED PROVENANCE + SIGHTENGINE METADATA
========================================================= */

function renderAnalysisMetadata() {

    let html =
        "";


    html +=
        renderProvenanceMetadata(
            state.provenance
        );


    html +=
        renderSightengineMetadata(
            state.sightengineDetection
        );


    return html;

}


/* =========================================================
   PROVENANCE OVERLAY STAMP
   ---------------------------------------------------------
   Dipakai jika C2PA / Content Credentials menjadi
   sumber AI detection tetapi Sightengine belum
   memberikan visual detection.

   Tidak mengarang nama model.
========================================================= */

function renderProvenanceOverlayStamp(
    provenance
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


    renderProvenanceOverlayModel(
        stamp,
        provenance
    );


    overlay.hidden =
        false;


    overlay.style.visibility =
        "visible";


    overlay.style.opacity =
        "1";

}


/* =========================================================
   PROVENANCE OVERLAY MODEL / SOURCE
========================================================= */

function renderProvenanceOverlayModel(
    stamp,
    provenance
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


    let source =
        "";


    const c2paDetected =
        provenance?.c2pa?.detected === true;


    const credentialsDetected =
        provenance?.contentCredentials?.detected === true;


    if (
        c2paDetected &&
        credentialsDetected
    ) {

        source =
            "Source C2PA / Content Credentials";

    } else if (
        c2paDetected
    ) {

        source =
            "Source C2PA";

    } else if (
        credentialsDetected
    ) {

        source =
            "Source Content Credentials";

    } else {

        source =
            "Source Content Provenance";

    }


    const modelLabel =
        document.createElement(
            "span"
        );


    modelLabel.className =
        "metadata-ai-detect-model";


    modelLabel.textContent =
        source;


    stamp.appendChild(
        modelLabel
    );

}


/* =========================================================
   PROVENANCE DETECTION DESCRIPTION
========================================================= */

function buildProvenanceDetectionDescription(
    provenance
) {

    const parts = [];


    if (
        provenance?.c2pa?.detected === true
    ) {

        const manifestCount =
            Number.isFinite(
                Number(
                    provenance.c2pa.manifestCount
                )
            )
                ? Number(
                    provenance.c2pa.manifestCount
                )
                : 0;


        parts.push(
            `C2PA terdeteksi dengan ${manifestCount} manifest.`
        );

    }


    if (
        provenance?.contentCredentials?.detected === true
    ) {

        parts.push(
            "Content Credentials terdeteksi."
        );

    }


    if (
        provenance?.digitalSourceType !== null &&
        provenance?.digitalSourceType !== undefined &&
        provenance?.digitalSourceType !== ""
    ) {

        parts.push(
            `Digital Source Type: ${formatStructuredValue(
                provenance.digitalSourceType
            ).replace(
                /&quot;/g,
                '"'
            )}.`
        );

    }


    if (
        provenance?.aiDisclosure !== null &&
        provenance?.aiDisclosure !== undefined &&
        provenance?.aiDisclosure !== ""
    ) {

        parts.push(
            "AI Disclosure tersedia pada Content Credentials."
        );

    }


    if (
        provenance?.verificationStatus
    ) {

        parts.push(
            `Verification: ${String(
                provenance.verificationStatus
            )}.`
        );

    } else {

        parts.push(
            "Verification: NOT VERIFIED."
        );

    }


    if (
        Array.isArray(
            provenance?.findings
        ) &&
        provenance.findings.length > 0
    ) {

        parts.push(
            `${provenance.findings.length} provenance finding ditemukan.`
        );

    }


    if (
        parts.length === 0
    ) {

        return (
            "Content provenance terdeteksi pada file."
        );

    }


    return parts.join(
        " "
    );

}


/* =========================================================
   METADATA + PROVENANCE DESCRIPTION
========================================================= */

function buildMetadataProvenanceDescription(
    metadataCount,
    provenance
) {

    const provenanceText =
        buildProvenanceDetectionDescription(
            provenance
        );


    return (
        `${metadataCount} indikator AI ditemukan pada metadata. ` +
        `${provenanceText}`
    );

}


/* =========================================================
   PROVENANCE + SIGHTENGINE DESCRIPTION
========================================================= */

function buildProvenanceSightengineDescription(
    provenance,
    sightengine
) {

    const provenanceText =
        buildProvenanceDetectionDescription(
            provenance
        );


    const sightengineText =
        buildSightengineDescription(
            sightengine
        );


    return (
        `${provenanceText} ` +
        `${sightengineText}`
    );

}


/* =========================================================
   DETECTION RESULT
   ---------------------------------------------------------
   AI DETECTION menggunakan tiga sumber:

   1. Local metadata detector
   2. C2PA / Content Credentials
   3. Sightengine visual AI detector

   Prioritas overlay:

   1. Sightengine visual detection
   2. C2PA / Content Credentials provenance

   Penting:
   - C2PA DETECTED tetap NOT VERIFIED jika belum
     dilakukan cryptographic verification.
   - C2PA detection tidak mengubah score Sightengine.
   - C2PA detection tidak membuat score palsu.
   - Jika hanya C2PA yang ditemukan, AI DETECTION
     tetap muncul karena file memiliki AI/provenance
     signal yang terdeteksi.
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


    const provenance =
        isObject(
            state.provenance
        )
            ? state.provenance
            : null;


    const provenanceDetected =
        isProvenanceDetected(
            provenance
        );


    const aiProvenanceDetected =
        hasAIProvenanceSignal(
            provenance
        );


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
       -----------------------------------------------------
       C2PA / Content Credentials sekarang ikut menjadi
       detection signal apabila provenance benar-benar
       terdeteksi.
    ===================================================== */

    const aiDetected =
        metadataDetected ||
        sightengineDetected ||
        aiProvenanceDetected;


    /* =====================================================
       AI DETECTED
    ===================================================== */

    if (
        aiDetected
    ) {

        /* =================================================
           PRIORITY 1:
           SIGHTENGINE VISUAL DETECTION
        ================================================= */

        if (
            sightengineDetected
        ) {

            renderOverlayStamp(
                sightengine
            );

        }


        /* =================================================
           PRIORITY 2:
           C2PA / CONTENT CREDENTIALS

           Hanya dipakai apabila Sightengine tidak
           memberikan visual detection.
        ================================================= */

        else if (
            aiProvenanceDetected
        ) {

            renderProvenanceOverlayStamp(
                provenance
            );

        }


        else {

            clearOverlayStamp();

        }


        /* =================================================
           METADATA + SIGHTENGINE + PROVENANCE
        ================================================= */

        if (
            metadataDetected &&
            sightengineDetected &&
            aiProvenanceDetected
        ) {

            setStatus(
                "DETECTED",
                "AI DETECTION",
                buildCombinedProvenanceDetectionDescription(
                    metadataIndicators.length,
                    provenance,
                    sightengine
                )
            );


            return;

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
           PROVENANCE + SIGHTENGINE
        ================================================= */

        if (
            aiProvenanceDetected &&
            sightengineDetected
        ) {

            setStatus(
                "DETECTED",
                "AI DETECTION",
                buildProvenanceSightengineDescription(
                    provenance,
                    sightengine
                )
            );


            return;

        }


        /* =================================================
           METADATA + PROVENANCE
        ================================================= */

        if (
            metadataDetected &&
            aiProvenanceDetected
        ) {

            setStatus(
                "DETECTED",
                "AI DETECTION",
                buildMetadataProvenanceDescription(
                    metadataIndicators.length,
                    provenance
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
           PROVENANCE ONLY
        ================================================= */

        if (
            aiProvenanceDetected
        ) {

            setStatus(
                "DETECTED",
                "AI DETECTION",
                buildProvenanceDetectionDescription(
                    provenance
                )
            );


            return;

        }


        /* =================================================
   METADATA ONLY
   -------------------------------------------------
   Metadata AI terdeteksi sehingga overlay tetap
   ditampilkan pada preview meskipun tidak ada
   hasil visual Sightengine.
================================================= */

renderOverlayStamp(
    null
);


setStatus(
    "DETECTED",
    "AI DETECTION",
    `${metadataIndicators.length} indikator yang berkaitan dengan AI ditemukan pada metadata.`
);


return;


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

        if (
    metadataDetected
) {

    renderOverlayStamp(
        null
    );


    setStatus(
        "DETECTED",
        "AI DETECTION",
        `${metadataIndicators.length} indikator yang berkaitan dengan AI ditemukan pada metadata. AI visual detection dari Sightengine tidak tersedia.`
    );

}

        else if (
            aiProvenanceDetected
        ) {

            renderProvenanceOverlayStamp(
                provenance
            );


            setStatus(
                "DETECTED",
                "AI DETECTION",
                buildProvenanceDetectionDescription(
                    provenance
                )
            );

        }

        else {

            clearOverlayStamp();


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

    if (
        aiProvenanceDetected
    ) {

        renderProvenanceOverlayStamp(
            provenance
        );


        setStatus(
            "DETECTED",
            "AI DETECTION",
            buildProvenanceDetectionDescription(
                provenance
            )
        );


        return;

    }


    clearOverlayStamp();


    setStatus(
        metadataDetected
            ? "DETECTED"
            : "CLEAR",

        metadataDetected
            ? "AI DETECTION"
            : "TIDAK TERDETEKSI DARI METADATA",

        metadataDetected
            ? `${metadataIndicators.length} indikator yang berkaitan dengan AI ditemukan pada metadata.`

            : "Tidak ditemukan indikator AI yang dikenali pada metadata yang berhasil dibaca. Ini bukan bukti bahwa media bukan hasil AI."
    );

}


/* =========================================================
   COMBINED PROVENANCE DETECTION DESCRIPTION
========================================================= */

function buildCombinedProvenanceDetectionDescription(
    metadataCount,
    provenance,
    sightengine
) {

    const provenanceText =
        buildProvenanceDetectionDescription(
            provenance
        );


    const sightengineText =
        buildSightengineDescription(
            sightengine
        );


    return (
        `${metadataCount} indikator AI ditemukan pada metadata. ` +
        `${provenanceText} ` +
        `${sightengineText}`
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
       CONTENT PROVENANCE
    ===================================================== */

    html +=
        renderProvenanceMetadata(
            state.provenance
        );


    /* =====================================================
       SIGHTENGINE
    ===================================================== */

    html +=
        renderSightengineMetadata(
            state.sightengineDetection
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

       Section Content Provenance dan Sightengine
       tidak dianggap sebagai metadata file sehingga
       angka count tetap konsisten dengan fungsi lama.
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

    renderProvenanceMetadata,

    renderSightengineMetadata,

    renderSightengineDetection,

    renderSightengineGenerators,

    renderSightengineRequest,

    renderSightengineMedia

};
