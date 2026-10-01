/* =========================================================
   GEN-Z.AI
   AI METADATA CLEANER
   ---------------------------------------------------------
   File:
   metadata-cleaner/assets/js/metadata-status.js

   Fungsi:
   - Render detection result
   - Render status
   - Render metadata table
   - Render hasil Sightengine pada blok Metadata

   AI DETECTION:
   1. Local metadata detector
   2. Sightengine visual AI detector

   Catatan:
   - Metadata detection dan visual detection
     merupakan dua sumber berbeda.
   - Tidak ada detector yang dapat menjamin
     asal media secara 100%.
   - Model pada AI DETECTION stamp selalu berasal
     langsung dari result Sightengine.
   - Stamp visual hanya ditampilkan jika
     Sightengine benar-benar mendeteksi AI.
   - Detail hasil Sightengine juga ditampilkan
     pada tabel Metadata.
========================================================= */


import {
    state
} from "./metadata-state.js";


import {
    elements
} from "./metadata-dom.js";


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
        Boolean(
            sightengine &&
            typeof sightengine === "object"
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
       SIGHTENGINE SUDAH BERJALAN
       -----------------------------------------------
       Tidak terdeteksi sebagai AI.
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
       NO VISUAL RESULT
    ===================================================== */

    clearOverlayStamp();


    setStatus(
        "CLEAR",
        "TIDAK TERDETEKSI DARI METADATA",
        "Tidak ditemukan indikator AI yang dikenali pada metadata yang berhasil dibaca. Ini bukan bukti bahwa media bukan hasil AI."
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
       PASTIKAN OVERLAY TERLIHAT
    ===================================================== */

    overlay.classList.remove(
        "hidden"
    );


    overlay.setAttribute(
        "aria-hidden",
        "false"
    );


    /* =====================================================
       CARI STAMP
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
       LABEL UTAMA
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
       MODEL RESULT
    ===================================================== */

    renderOverlayModel(
        stamp,
        sightengine?.model
    );


    /* =====================================================
       FINAL VISIBILITY LOCK
    ===================================================== */

    overlay.hidden =
        false;


    overlay.style.visibility =
        "visible";


    overlay.style.opacity =
        "1";

}


/* =========================================================
   OVERLAY MODEL LABEL
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
   CLEAR OVERLAY STAMP
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


    /* =====================================================
       RESET MAIN LABEL
    ===================================================== */

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


    /* =====================================================
       REMOVE MODEL LABEL
    ===================================================== */

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

        return `Sightengine tidak mendeteksi image sebagai AI pada threshold yang digunakan. Confidence AI: ${confidence}. Hasil ini bukan jaminan bahwa image pasti dibuat oleh manusia.`;

    }


    return "Sightengine tidak mendeteksi image sebagai AI pada threshold yang digunakan. Hasil ini bukan jaminan bahwa image pasti dibuat oleh manusia.";

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


        return formatPercentage(
            normalized
        );

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
   GENERATOR FORMAT
========================================================= */

function formatGenerator(
    generator
) {

    if (
        !generator ||
        typeof generator !== "object"
    ) {

        return "";

    }


    const name =
        String(
            generator.name || ""
        )
            .trim();


    if (
        !name
    ) {

        return "";

    }


    const confidence =
        Number(
            generator.confidence
        );


    if (
        Number.isFinite(
            confidence
        )
    ) {

        return `${formatPercentageFromPercent(
            confidence
        )}`;

    }


    const score =
        Number(
            generator.score
        );


    if (
        Number.isFinite(
            score
        )
    ) {

        return `${name} (${formatPercentage(
            score
        )})`;

    }


    return name;

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
   Render metadata lokal terlebih dahulu.

   Kemudian hasil Sightengine ditambahkan
   sebagai bagian khusus pada tabel yang sama.

   Struktur:

       Metadata lokal
            ↓
       Sightengine summary
            ↓
       AI generators
========================================================= */

export function renderMetadata() {

    if (
        !elements.metadataTableBody
    ) {

        return;

    }


    elements.metadataTableBody.innerHTML =
        "";


    /* =====================================================
       LOCAL METADATA
    ===================================================== */

    if (
        Array.isArray(state.metadata) &&
        state.metadata.length
    ) {

        for (
            const item of state.metadata
        ) {

            appendMetadataRow(
                item?.field,
                item?.value
            );

        }

    } else {

        appendMetadataRow(
            "Metadata",
            "Tidak ada metadata yang berhasil dibaca."
        );

    }


    /* =====================================================
       SIGHTENGINE RESULT
       -----------------------------------------------------
       Hanya image yang memiliki hasil Sightengine.
    ===================================================== */

    renderSightengineMetadata();

}


/* =========================================================
   APPEND METADATA ROW
========================================================= */

function appendMetadataRow(
    field,
    value
) {

    if (
        !elements.metadataTableBody
    ) {

        return;

    }


    const row =
        document.createElement(
            "tr"
        );


    const fieldCell =
        document.createElement(
            "td"
        );


    const valueCell =
        document.createElement(
            "td"
        );


    fieldCell.textContent =
        field === null ||
        field === undefined ||
        String(field).trim() === ""
            ? "-"
            : String(field);


    valueCell.textContent =
        value === null ||
        value === undefined ||
        String(value).trim() === ""
            ? "-"
            : String(value);


    row.appendChild(
        fieldCell
    );


    row.appendChild(
        valueCell
    );


    elements.metadataTableBody.appendChild(
        row
    );

}


/* =========================================================
   SIGHTENGINE METADATA
   ---------------------------------------------------------
   Menampilkan hasil visual AI detection
   pada blok Metadata.

   Data berasal dari:

       state.sightengineDetection

   Tidak ada nilai detector yang di-hardcode.
========================================================= */

function renderSightengineMetadata() {

    const sightengine =
        state.sightengineDetection;


    if (
        !sightengine ||
        typeof sightengine !== "object"
    ) {

        updateMetadataCount();

        return;

    }


    /* =====================================================
       SECTION HEADER
    ===================================================== */

    appendMetadataSectionRow(
        "SIGHTENGINE AI DETECTION"
    );


    /* =====================================================
       PROVIDER
    ===================================================== */

    if (
        sightengine.provider
    ) {

        appendMetadataRow(
            "Provider",
            sightengine.provider
        );

    }


    /* =====================================================
       MODEL
    ===================================================== */

    if (
        sightengine.model
    ) {

        appendMetadataRow(
            "Detection Model",
            sightengine.model
        );

    }


    /* =====================================================
       AI GENERATED SCORE
    ===================================================== */

    if (
        sightengine.ai_generated !== null &&
        sightengine.ai_generated !== undefined
    ) {

        const score =
            Number(
                sightengine.ai_generated
            );


        if (
            Number.isFinite(
                score
            )
        ) {

            appendMetadataRow(
                "AI Generated",
                formatPercentage(
                    score
                )
            );

        }

    }


    /* =====================================================
       CONFIDENCE
    ===================================================== */

    if (
        sightengine.confidence !== null &&
        sightengine.confidence !== undefined
    ) {

        const confidence =
            Number(
                sightengine.confidence
            );


        if (
            Number.isFinite(
                confidence
            )
        ) {

            appendMetadataRow(
                "Confidence",
                `${Math.round(
                    Math.max(
                        0,
                        Math.min(
                            100,
                            confidence
                        )
                    )
                )}%`
            );

        }

    }


    /* =====================================================
       DETECTION STATUS
    ===================================================== */

    if (
        typeof sightengine.is_ai_generated ===
        "boolean"
    ) {

        appendMetadataRow(
            "Detection Status",
            sightengine.is_ai_generated
                ? "AI TERDETEKSI"
                : "TIDAK TERDETEKSI"
        );

    }


    /* =====================================================
       DETECTED GENERATOR
    ===================================================== */

    if (
        sightengine.detected_generator &&
        typeof sightengine.detected_generator === "object"
    ) {

        const generator =
            sightengine.detected_generator;


        const generatorName =
            String(
                generator.name || ""
            ).trim();


        if (
            generatorName
        ) {

            const generatorScore =
                Number(
                    generator.score
                );


            const generatorConfidence =
                Number(
                    generator.confidence
                );


            let generatorValue =
                generatorName;


            if (
                Number.isFinite(
                    generatorConfidence
                )
            ) {

                generatorValue +=
                    ` (${formatPercentageFromPercent(
                        generatorConfidence
                    )})`;

            } else if (
                Number.isFinite(
                    generatorScore
                )
            ) {

                generatorValue +=
                    ` (${formatPercentage(
                        generatorScore
                    )})`;

            }


            appendMetadataRow(
                "Detected Generator",
                generatorValue
            );

        }

    }


    /* =====================================================
       GENERATOR SCORES
       -----------------------------------------------------
       Contoh response:

       ai_generators: {
           dalle: 0.001,
           firefly: 0.001,
           flux: 0.001
       }

       Backend sudah mengubahnya menjadi:

       generators: [
           {
               name: "dalle",
               score: 0.001,
               confidence: 0
           }
       ]

       Namun kita tetap menggunakan score jika tersedia
       agar 0.001 dapat ditampilkan sebagai 0.1%.
    ===================================================== */

    const generators =
        Array.isArray(
            sightengine.generators
        )
            ? sightengine.generators
            : [];


    if (
        generators.length
    ) {

        appendMetadataSectionRow(
            "AI GENERATORS"
        );


        for (
            const generator
            of generators
        ) {

            if (
                !generator ||
                typeof generator !== "object"
            ) {

                continue;

            }


            const name =
                String(
                    generator.name || ""
                ).trim();


            if (
                !name
            ) {

                continue;

            }


            const score =
                Number(
                    generator.score
                );


            const confidence =
                Number(
                    generator.confidence
                );


            let value =
                "";


            /*
               Prioritas score.

               Sightengine score:
               0.001 = 0.1%

               Jangan menggunakan confidence 0
               jika score asli masih tersedia.
            */

            if (
                Number.isFinite(
                    score
                )
            ) {

                value =
                    formatPercentage(
                        score
                    );

            } else if (
                Number.isFinite(
                    confidence
                )
            ) {

                value =
                    formatPercentageFromPercent(
                        confidence
                    );

            } else {

                value =
                    "N/A";

            }


            appendMetadataRow(
                formatGeneratorName(
                    name
                ),
                value
            );

        }

    }


    updateMetadataCount();

}


/* =========================================================
   METADATA SECTION ROW
   ---------------------------------------------------------
   Header visual untuk memisahkan:
   - metadata lokal
   - Sightengine
   - AI generators
========================================================= */

function appendMetadataSectionRow(
    title
) {

    if (
        !elements.metadataTableBody
    ) {

        return;

    }


    const row =
        document.createElement(
            "tr"
        );


    row.className =
        "metadata-section-row";


    const cell =
        document.createElement(
            "td"
        );


    cell.colSpan =
        2;


    cell.textContent =
        String(
            title || ""
        );


    row.appendChild(
        cell
    );


    elements.metadataTableBody.appendChild(
        row
    );

}


/* =========================================================
   GENERATOR NAME FORMAT
========================================================= */

function formatGeneratorName(
    name
) {

    const normalized =
        String(
            name || ""
        )
            .trim();


    if (
        !normalized
    ) {

        return "-";
    }


    const names = {

        dalle:
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
            "WAN",

        z_image:
            "Z Image",

        other:
            "Other"

    };


    return names[
        normalized.toLowerCase()
    ] ||
        normalized;

}


/* =========================================================
   PERCENTAGE FORMAT
   ---------------------------------------------------------
   Input:
       0.001

   Output:
       0.1%

   Input:
       0.99

   Output:
       99%

   Tidak menggunakan Math.round(score * 100)
   karena itu akan menghilangkan score kecil
   seperti 0.001.
========================================================= */

function formatPercentage(
    score
) {

    const number =
        Number(
            score
        );


    if (
        !Number.isFinite(
            number
        )
    ) {

        return "N/A";

    }


    const normalized =
        Math.max(
            0,
            Math.min(
                1,
                number
            )
        );


    const percentage =
        normalized * 100;


    if (
        percentage === 0 ||
        percentage === 100
    ) {

        return `${percentage}%`;

    }


    if (
        percentage < 1
    ) {

        return `${percentage.toFixed(1)}%`;

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
   PERCENTAGE FROM PERCENT
   ---------------------------------------------------------
   Input:
       99

   Output:
       99%

   Input:
       0

   Output:
       0%
========================================================= */

function formatPercentageFromPercent(
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

        return "N/A";

    }


    const normalized =
        Math.max(
            0,
            Math.min(
                100,
                number
            )
        );


    if (
        Number.isInteger(
            normalized
        )
    ) {

        return `${normalized}%`;

    }


    return `${normalized.toFixed(1)}%`;

}


/* =========================================================
   UPDATE METADATA COUNT
   ---------------------------------------------------------
   Count sekarang mencakup:

   - metadata lokal
   - Sightengine summary
   - AI generators
   - section headers

   Section headers TIDAK dihitung sebagai data.
========================================================= */

function updateMetadataCount() {

    if (
        !elements.metadataCount ||
        !elements.metadataTableBody
    ) {

        return;

    }


    const rows =
        Array.from(
            elements.metadataTableBody.querySelectorAll(
                "tr"
            )
        );


    const dataRows =
        rows.filter(
            row =>
                !row.classList.contains(
                    "metadata-section-row"
                )
        );


    elements.metadataCount.textContent =
        String(
            dataRows.length
        );

}


/* =========================================================
   LOCAL DOM HELPERS
========================================================= */

function showElement(
    element
) {

    if (
        !element
    ) {

        return;

    }


    element.classList.remove(
        "hidden"
    );

}


function hideElement(
    element
) {

    if (
        !element
    ) {

        return;

    }


    element.classList.add(
        "hidden"
    );

}
