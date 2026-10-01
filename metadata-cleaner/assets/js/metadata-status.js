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
   - Render AI generator scores
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
   - Stamp visual hanya ditampilkan jika
     Sightengine menyatakan is_ai_generated === true.
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

const SIGHTENGINE_REQUEST_TITLE =
    "SIGHTENGINE REQUEST";

const SIGHTENGINE_MEDIA_TITLE =
    "SIGHTENGINE MEDIA";


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
        name
            .trim()
            .toLowerCase();


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

        higgsfield:
            "Higgsfield",

        ideogram:
            "Ideogram",

        kling:
            "Kling",

        imagen:
            "Imagen",

        midjourney:
            "Midjourney",

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

        wan:
            "Wan",

        z_image:
            "Z Image",

        other:
            "Other"

    };


    return (
        names[normalized] ||
        name
    );

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
   ---------------------------------------------------------
   Mendukung format lama:
       {
           field: "...",
           value: "..."
       }

   Juga mendukung:
       {
           key: "...",
           value: "..."
       }

   Agar module normalizer lama maupun baru
   tetap kompatibel.
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
   ---------------------------------------------------------
   Penting:

   Object kosong dari metadata-state.js bukan berarti
   Sightengine berhasil.

   sightengineChecked adalah sumber kebenaran.
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


    const isAiGenerated =
        detection.is_ai_generated === true;


    const detectedGenerator =
        isObject(
            detection.detected_generator
        )
            ? detection.detected_generator
            : null;


    let detectionStatus =
        "TIDAK TERSEDIA";


    if (
        isAiGenerated
    ) {

        detectionStatus =
            "TERDETEKSI";

    } else if (
        aiGenerated !== null
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
            "AI Generated",
            aiGenerated !== null
                ? formatPercentage(
                    aiGenerated
                )
                : "N/A"
        );


    html +=
        createMetadataRow(
            "Confidence",
            confidence !== null
                ? formatPercentageFromPercent(
                    confidence
                )
                : "N/A"
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


    /*
       generators: [] adalah hasil valid.

       Tidak menampilkan section kosong karena
       tidak ada generator individual yang diberikan
       oleh provider.
    */

    if (
        generators.length === 0
    ) {

        return "";

    }


    let html =
        "";


    html +=
        createSectionRow(
            SIGHTENGINE_GENERATORS_TITLE
        );


    for (
        const generator of generators
    ) {

        if (
            !isObject(
                generator
            )
        ) {

            continue;

        }


        const name =
            formatGeneratorName(
                generator.name
            );


        const value =
            formatGeneratorDisplay(
                generator
            );


        html +=
            createMetadataRow(
                name,
                value
            );

    }


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


    const sightengineDetected =
        sightengineAvailable &&
        sightengine.is_ai_generated === true;


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
       Sightengine berhasil dijalankan dan memberikan
       score yang dapat digunakan.
    ===================================================== */

    if (
        sightengineAvailable &&
        sightengine.ai_generated !== null &&
        sightengine.ai_generated !== undefined
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
       -----------------------------------------------------
       Provider gagal, sehingga jangan menyebut image
       "tidak terdeteksi AI" berdasarkan Sightengine.
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
       -----------------------------------------------------
       Untuk video atau kondisi ketika Sightengine
       memang tidak dijalankan.
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


    /* =====================================================
       PASTIKAN TERLIHAT
    ===================================================== */

    overlay.classList.remove(
        "hidden"
    );


    overlay.setAttribute(
        "aria-hidden",
        "false"
    );


    /* =====================================================
       FIND / CREATE STAMP
    ===================================================== */

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


    /* =====================================================
       LABEL
    ===================================================== */

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


    /* =====================================================
       MODEL
       -----------------------------------------------------
       Tidak hardcode.
       Diambil langsung dari Sightengine.
    ===================================================== */

    renderOverlayModel(
        stamp,
        sightengine?.model
    );


    /* =====================================================
       FINAL VISIBILITY
    ===================================================== */

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


    const generator =
        formatGenerator(
            sightengine?.detected_generator
        );


    const parts = [

        `${metadataCount} indikator AI ditemukan pada metadata.`,

        confidence
            ? `Sightengine juga mendeteksi indikasi image AI dengan confidence ${confidence}.`
            : "Sightengine juga mendeteksi indikasi image AI.",

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


    const generator =
        formatGenerator(
            sightengine?.detected_generator
        );


    const parts = [

        "Sightengine mendeteksi indikasi bahwa image dibuat atau dimodifikasi menggunakan AI.",

        confidence
            ? `Confidence: ${confidence}.`
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


    if (
        confidence
    ) {

        return (
            "Sightengine tidak mendeteksi image sebagai AI " +
            "pada threshold yang digunakan. " +
            `Confidence AI: ${confidence}. ` +
            "Hasil ini bukan jaminan bahwa image pasti " +
            "dibuat oleh manusia."
        );

    }


    return (
        "Sightengine tidak mendeteksi image sebagai AI " +
        "pada threshold yang digunakan. " +
        "Hasil ini bukan jaminan bahwa image pasti " +
        "dibuat oleh manusia."
    );

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
   ---------------------------------------------------------
   Metadata lokal tetap dihitung sebagai metadata file.

   Section Sightengine hanya muncul jika:
       state.sightengineChecked === true

   Dengan demikian kegagalan provider tidak menghasilkan
   section palsu berisi N/A.
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

    renderSightengineMetadata,

    renderSightengineDetection,

    renderSightengineGenerators,

    renderSightengineRequest,

    renderSightengineMedia

};
