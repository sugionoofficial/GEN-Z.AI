/* =========================================================
   GEN-Z.AI
   METADATA STATUS MODULE
   ---------------------------------------------------------
   File:
   metadata-cleaner/assets/js/metadata-status.js

   Tanggung jawab:
   - Render metadata lokal
   - Render Sightengine AI Detection
   - Render AI generator scores
   - Render Sightengine request metadata
   - Render Sightengine media metadata
   - Mengatur status detection
   - Mengatur AI DETECTION overlay
   - Tidak melakukan API request
========================================================= */


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
        Number(value);

    if (
        !Number.isFinite(
            number
        )
    ) {

        return null;

    }

    if (
        number < 0
    ) {

        return 0;

    }

    if (
        number > 1
    ) {

        return 1;

    }

    return number;

}


function normalizePercent(
    value
) {

    const number =
        Number(value);

    if (
        !Number.isFinite(
            number
        )
    ) {

        return null;

    }

    if (
        number < 0
    ) {

        return 0;

    }

    if (
        number > 100
    ) {

        return 100;

    }

    return number;

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

        return "Unknown";

    }

    const name =
        formatGeneratorName(
            generator.name
        );

    const confidence =
        normalizePercent(
            generator.confidence
        );

    if (
        confidence !== null
    ) {

        /*
         * IMPORTANT:
         * Jangan menghilangkan nama generator.
         */

        return `${name} (${formatPercentageFromPercent(confidence)})`;

    }

    const score =
        normalizeScore(
            generator.score
        );

    if (
        score !== null
    ) {

        return `${name} (${formatPercentage(score)})`;

    }

    return name;

}


/* =========================================================
   VALUE FORMAT
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
    value,
    options = {}
) {

    const {

        className = "",

        raw = false

    } = options;

    const safeLabel =
        escapeHtml(
            label
        );

    const safeValue =
        raw
            ? String(
                value ?? ""
            )
            : formatValue(
                value
            );

    return `
        <tr class="${escapeHtml(className)}">
            <td class="metadata-key">
                ${safeLabel}
            </td>
            <td class="metadata-value">
                ${safeValue}
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

    return metadata
        .map(
            item => {

                if (
                    !isObject(
                        item
                    )
                ) {

                    return "";

                }

                const key =
                    item.key ??
                    item.name ??
                    "";

                const value =
                    item.value ??
                    "";

                if (
                    !key
                ) {

                    return "";

                }

                return createMetadataRow(
                    key,
                    value
                );

            }
        )
        .filter(Boolean)
        .join("");

}


/* =========================================================
   SIGHTENGINE AI DETECTION
========================================================= */

function renderSightengineDetection(
    detection
) {

    if (
        !isObject(
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
        "TIDAK TERDETEKSI";

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

    } else {

        detectionStatus =
            "TIDAK TERSEDIA";

    }

    const detectedGeneratorText =
        detectedGenerator
            ? formatGenerator(
                detectedGenerator
            )
            : "Tidak terdeteksi";

    let html = "";

    html += createSectionRow(
        SIGHTENGINE_SECTION_TITLE
    );

    html += createMetadataRow(
        "Provider",
        provider
    );

    html += createMetadataRow(
        "Detection Model",
        model
    );

    /*
     * AI Generated menggunakan score asli.
     *
     * Contoh:
     * 0.001 → 0.10%
     * 0.99  → 99%
     */

    html += createMetadataRow(
        "AI Generated",
        aiGenerated !== null
            ? formatPercentage(
                aiGenerated
            )
            : "N/A"
    );

    html += createMetadataRow(
        "Confidence",
        confidence !== null
            ? formatPercentageFromPercent(
                confidence
            )
            : "N/A"
    );

    html += createMetadataRow(
        "Detection Status",
        detectionStatus
    );

    html += createMetadataRow(
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
        !isObject(
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

        return "";

    }

    let html = "";

    html += createSectionRow(
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

        const score =
            normalizeScore(
                generator.score
            );

        const confidence =
            normalizePercent(
                generator.confidence
            );

        let value =
            name;

        if (
            confidence !== null
        ) {

            value =
                `${name} (${formatPercentageFromPercent(confidence)})`;

        } else if (
            score !== null
        ) {

            value =
                `${name} (${formatPercentage(score)})`;

        }

        html += createMetadataRow(
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
        !isObject(
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
        request.id !== null &&
        request.id !== undefined ||
        request.timestamp !== null &&
        request.timestamp !== undefined ||
        request.operations !== null &&
        request.operations !== undefined;

    if (
        !hasData
    ) {

        return "";

    }

    let html = "";

    html += createSectionRow(
        SIGHTENGINE_REQUEST_TITLE
    );

    html += createMetadataRow(
        "Request ID",
        request.id
    );

    html += createMetadataRow(
        "Timestamp",
        request.timestamp
    );

    html += createMetadataRow(
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
        !isObject(
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

    let html = "";

    html += createSectionRow(
        SIGHTENGINE_MEDIA_TITLE
    );

    html += createMetadataRow(
        "Media ID",
        media.id
    );

    /*
     * URI ditampilkan sebagai teks yang di-escape.
     * Tidak dibuat menjadi HTML link agar response
     * eksternal tidak dapat menyuntikkan markup.
     */

    html += createMetadataRow(
        "Media URI",
        media.uri
    );

    return html;

}


/* =========================================================
   COMBINED SIGHTENGINE RENDER
========================================================= */

function renderSightengineMetadata(
    detection
) {

    if (
        !isObject(
            detection
        )
    ) {

        return "";

    }

    let html = "";

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
   METADATA COUNT
========================================================= */

function updateMetadataCount(
    tbody,
    countElement
) {

    if (
        !tbody
    ) {

        return;

    }

    const rows =
        Array.from(
            tbody.querySelectorAll(
                "tr"
            )
        )
        .filter(
            row =>
                !row.classList.contains(
                    "metadata-section-row"
                )
        );

    if (
        countElement
    ) {

        countElement.textContent =
            String(
                rows.length
            );

    }

}


/* =========================================================
   TABLE RENDER
========================================================= */

export function renderMetadataStatus(
    {
        metadata = [],
        sightengineDetection = null,
        elements = {}
    } = {}
) {

    const tbody =
        elements.metadataTableBody ||
        document.getElementById(
            "metadata-table-body"
        );

    const countElement =
        elements.metadataCount ||
        document.getElementById(
            "metadata-count"
        );

    if (
        !tbody
    ) {

        return;

    }

    let html = "";

    html +=
        renderLocalMetadata(
            metadata
        );

    html +=
        renderSightengineMetadata(
            sightengineDetection
        );

    tbody.innerHTML =
        html;

    updateMetadataCount(
        tbody,
        countElement
    );

}


/* =========================================================
   STATUS DESCRIPTION
========================================================= */

export function getDetectionStatusDescription(
    detection
) {

    if (
        !isObject(
            detection
        )
    ) {

        return "";

    }

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

    const provider =
        detection.provider ||
        "Sightengine";

    if (
        isAiGenerated
    ) {

        const confidenceText =
            confidence !== null
                ? ` Confidence: ${formatPercentageFromPercent(confidence)}.`
                : "";

        return (
            `${provider} mendeteksi indikasi bahwa image ` +
            `dibuat atau dimodifikasi menggunakan AI.` +
            confidenceText
        );

    }

    if (
        aiGenerated !== null
    ) {

        return (
            `${provider} tidak mendeteksi indikasi kuat ` +
            `bahwa image dibuat menggunakan AI. ` +
            `AI Generated: ${formatPercentage(aiGenerated)}.`
        );

    }

    return (
        `${provider} tidak memberikan hasil AI detection ` +
        `yang dapat digunakan.`
    );

}


/* =========================================================
   OVERLAY HELPERS
========================================================= */

function getPreviewStage() {

    return (
        document.querySelector(
            ".metadata-preview-stage"
        ) ||
        document.getElementById(
            "metadata-preview-stage"
        )
    );

}


function getOverlay() {

    const stage =
        getPreviewStage();

    if (
        !stage
    ) {

        return null;

    }

    let overlay =
        stage.querySelector(
            ".metadata-ai-detect-stamp"
        );

    if (
        !overlay
    ) {

        overlay =
            document.createElement(
                "div"
            );

        overlay.className =
            "metadata-ai-detect-stamp";

        overlay.setAttribute(
            "aria-hidden",
            "true"
        );

        overlay.hidden =
            true;

        stage.appendChild(
            overlay
        );

    }

    return overlay;

}


/* =========================================================
   OVERLAY CLEAR
========================================================= */

export function clearOverlayStamp() {

    const overlay =
        getOverlay();

    if (
        !overlay
    ) {

        return;

    }

    overlay.classList.remove(
        "is-ai"
    );

    overlay.classList.remove(
        "is-clean"
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
            ".metadata-ai-detect-label"
        );

    if (
        label
    ) {

        label.textContent =
            "";

    }

    const model =
        overlay.querySelector(
            ".metadata-ai-detect-model"
        );

    if (
        model
    ) {

        model.textContent =
            "";

    }

}


/* =========================================================
   OVERLAY RENDER
========================================================= */

export function renderOverlayStamp(
    detection
) {

    const overlay =
        getOverlay();

    if (
        !overlay
    ) {

        return;

    }

    if (
        !isObject(
            detection
        )
    ) {

        clearOverlayStamp();

        return;

    }

    const isAiGenerated =
        detection.is_ai_generated === true;

    const provider =
        detection.provider ||
        "sightengine";

    const model =
        detection.model ||
        "";

    let label =
        overlay.querySelector(
            ".metadata-ai-detect-label"
        );

    if (
        !label
    ) {

        label =
            document.createElement(
                "div"
            );

        label.className =
            "metadata-ai-detect-label";

        overlay.appendChild(
            label
        );

    }

    let modelElement =
        overlay.querySelector(
            ".metadata-ai-detect-model"
        );

    if (
        !modelElement
    ) {

        modelElement =
            document.createElement(
                "div"
            );

        modelElement.className =
            "metadata-ai-detect-model";

        overlay.appendChild(
            modelElement
        );

    }

    overlay.classList.remove(
        "is-ai"
    );

    overlay.classList.remove(
        "is-clean"
    );

    if (
        isAiGenerated
    ) {

        overlay.classList.add(
            "is-ai"
        );

        label.textContent =
            "AI DETECTION";

    } else {

        overlay.classList.add(
            "is-clean"
        );

        label.textContent =
            "AI DETECTION";

    }

    modelElement.textContent =
        model
            ? `${provider} • ${model}`
            : provider;

    overlay.hidden =
        false;

    overlay.setAttribute(
        "aria-hidden",
        "false"
    );

    overlay.style.visibility =
        "visible";

    overlay.style.opacity =
        "1";

}


/* =========================================================
   COMBINED STATUS
========================================================= */

export function renderDetectionStatus(
    {
        metadata = [],
        sightengineDetection = null,
        elements = {}
    } = {}
) {

    renderMetadataStatus({
        metadata,
        sightengineDetection,
        elements
    });

    if (
        sightengineDetection
    ) {

        renderOverlayStamp(
            sightengineDetection
        );

    } else {

        clearOverlayStamp();

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
