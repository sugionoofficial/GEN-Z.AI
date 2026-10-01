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

   AI DETECTION LAYERS:
   1. Local metadata detector
   2. Sightengine visual AI detector

   Catatan:
   - Metadata detection dan visual detection
     adalah dua sumber yang berbeda.
   - Tidak ada detector yang memberikan jaminan
     100% bahwa sebuah image dibuat oleh AI.
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


    const metadataDetected =
        metadataIndicators.length > 0;


    /* =====================================================
       AI DETECTED
       -----------------------------------------------------
       Salah satu layer mendeteksi AI.
    ===================================================== */

    if (
        metadataDetected ||
        sightengineDetected
    ) {

        showElement(
            elements.aiOverlay
        );


        /*
           -----------------------------------------------
           BOTH
           -----------------------------------------------
           Metadata + Sightengine sama-sama mendeteksi.
        */

        if (
            metadataDetected &&
            sightengineDetected
        ) {

            const description =
                buildCombinedDetectionDescription(
                    metadataIndicators.length,
                    sightengine
                );


            setStatus(
                "DETECTED",
                "AI DETECT",
                description
            );


            return;

        }


        /*
           -----------------------------------------------
           SIGHTENGINE ONLY
           -----------------------------------------------
        */

        if (
            sightengineDetected
        ) {

            const description =
                buildSightengineDescription(
                    sightengine
                );


            setStatus(
                "DETECTED",
                "AI DETECT",
                description
            );


            return;

        }


        /*
           -----------------------------------------------
           METADATA ONLY
           -----------------------------------------------
        */

        setStatus(
            "DETECTED",
            "AI DETECT",
            `${metadataIndicators.length} indikator yang berkaitan dengan AI ditemukan pada metadata.`
        );


        return;

    }


    /* =====================================================
       SIGHTENGINE ANALYSIS AVAILABLE
       -----------------------------------------------------
       Image sudah dianalisis tetapi skor berada
       di bawah threshold deteksi.
    ===================================================== */

    if (
        sightengineAvailable &&
        sightengine.ai_generated !== null &&
        sightengine.ai_generated !== undefined
    ) {

        const description =
            buildSightengineClearDescription(
                sightengine
            );


        hideElement(
            elements.aiOverlay
        );


        setStatus(
            "CLEAR",
            "TIDAK TERDETEKSI SEBAGAI AI",
            description
        );


        return;

    }


    /* =====================================================
       METADATA ONLY
       -----------------------------------------------------
       Tidak ada hasil Sightengine.
       Bisa terjadi pada:
       - video
       - provider gagal
       - image tidak dapat dikirim
    ===================================================== */

    hideElement(
        elements.aiOverlay
    );


    setStatus(
        "CLEAR",
        "TIDAK TERDETEKSI DARI METADATA",
        "Tidak ditemukan indikator AI yang dikenali pada metadata yang berhasil dibaca. Ini bukan bukti bahwa media bukan hasil AI."
    );

}


/* =========================================================
   COMBINED DESCRIPTION
========================================================= */

function buildCombinedDetectionDescription(
    metadataCount,
    sightengine
) {

    const score =
        formatConfidence(
            sightengine?.confidence
        );


    const generator =
        formatGenerator(
            sightengine?.detected_generator
        );


    const parts = [

        `${metadataCount} indikator AI ditemukan pada metadata.`,

        score
            ? `Sightengine mendeteksi indikasi AI dengan confidence ${score}.`
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

    const score =
        formatConfidence(
            sightengine?.confidence
        );


    const generator =
        formatGenerator(
            sightengine?.detected_generator
        );


    const parts = [

        "Sightengine mendeteksi indikasi bahwa image dibuat atau dimodifikasi menggunakan AI.",

        score
            ? `Confidence: ${score}.`
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

    const score =
        formatConfidence(
            sightengine?.confidence
        );


    if (
        score
    ) {

        return `Sightengine tidak mendeteksi image sebagai AI pada threshold yang digunakan. Confidence AI: ${score}. Hasil ini bukan jaminan bahwa image pasti dibuat oleh manusia.`;

    }


    return "Sightengine tidak mendeteksi image sebagai AI pada threshold yang digunakan. Hasil ini bukan jaminan bahwa image pasti dibuat oleh manusia.";

}


/* =========================================================
   CONFIDENCE FORMAT
========================================================= */

function formatConfidence(
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

        return "";

    }


    return `${Math.max(
        0,
        Math.min(
            100,
            Math.round(
                number
            )
        )
    )}%`;

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

        return `${name} (${Math.round(
            Math.max(
                0,
                Math.min(
                    100,
                    confidence
                )
            )
        )}%)`;

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

    elements.statusTitle.textContent =
        title;


    elements.statusDescription.textContent =
        description;


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


    elements.metadataTableBody.innerHTML =
        "";


    if (
        !state.metadata.length
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


        elements.metadataCount.textContent =
            "0";


        return;
    }


    for (
        const item of state.metadata
    ) {

        const row =
            document.createElement(
                "tr"
            );


        const field =
            document.createElement(
                "td"
            );


        const value =
            document.createElement(
                "td"
            );


        field.textContent =
            item.field;


        value.textContent =
            item.value;


        row.appendChild(
            field
        );


        row.appendChild(
            value
        );


        elements.metadataTableBody.appendChild(
            row
        );

    }


    elements.metadataCount.textContent =
        String(
            state.metadata.length
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
