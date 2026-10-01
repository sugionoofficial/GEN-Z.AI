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

    AI DETECTION:
    1. Local metadata detector
    2. Sightengine visual AI detector

    Catatan:
    - Metadata detection dan visual detection
      merupakan dua sumber berbeda.
    - Tidak ada detector yang dapat menjamin
      asal media secara 100%.
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
       -----------------------------------------------------
       Salah satu detector mendeteksi indikasi AI.
    ===================================================== */

    if (
        metadataDetected ||
        sightengineDetected
    ) {

        showElement(
            elements.aiOverlay
        );


        /*
           Update isi stamp yang SUDAH ada
           di index.html.

           Tidak membuat struktur DOM baru.
        */

        renderOverlayStamp(
            sightengine,
            sightengineDetected,
            metadataDetected
        );


        /* =================================================
           METADATA + SIGHTENGINE
        ================================================= */

        if (
            metadataDetected &&
            sightengineDetected
        ) {

            setStatus(
                "DETECTED",
                "AI DETECT",
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
                "AI DETECT",
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
       -----------------------------------------------------
       Tidak terdeteksi sebagai AI.

       Ini berbeda dengan:
       - detector belum dijalankan
       - request gagal
       - video
    ===================================================== */

    if (
        sightengineAvailable &&
        sightengine.ai_generated !== null &&
        sightengine.ai_generated !== undefined
    ) {

        hideElement(
            elements.aiOverlay
        );


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
       -----------------------------------------------------
       Video atau Sightengine tidak tersedia/gagal.
    ===================================================== */

    hideElement(
        elements.aiOverlay
    );


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
    sightengine,
    sightengineDetected,
    metadataDetected
) {

    const overlay =
        elements.aiOverlay;


    if (
        !overlay
    ) {

        return;

    }


    /*
       Ambil stamp yang SUDAH ada
       dari HTML.

       Tidak membuat element baru.
    */

    const stamp =
        overlay.querySelector(
            ".metadata-ai-detect-stamp"
        );


    if (
        !stamp
    ) {

        return;

    }


    const label =
        stamp.querySelector(
            "span"
        );


    if (
        !label
    ) {

        return;

    }


    /*
       Default stamp.
    */

    let text =
        "AI DETECT";


    /* =====================================================
       SIGHTENGINE DETECTION
    ===================================================== */

    if (
        sightengineDetected
    ) {

        const confidence =
            formatConfidence(
                sightengine.ai_generated,
                sightengine.confidence
            );


        if (
            confidence
        ) {

            text =
                `AI DETECT ${confidence}`;

        }

    }


    /*
       Metadata-only tetap menggunakan
       stamp standar agar tidak terlalu penuh.
    */

    label.textContent =
        text;


    /*
       aria-hidden tetap dipertahankan
       sesuai struktur HTML asli.
    */

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


    const label =
        overlay.querySelector(
            ".metadata-ai-detect-stamp span"
        );


    if (
        label
    ) {

        label.textContent =
            "AI DETECT";

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
   ---------------------------------------------------------
   Mendukung dua bentuk:

   1. ai_generated = 0.98
      → 98%

   2. confidence = 98
      → 98%

   Raw score Sightengine tetap menjadi sumber
   utama jika tersedia.
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


    const score =
        Number(
            generator.score
        );


    if (
        Number.isFinite(
            score
        )
    ) {

        return `${name} (${Math.round(
            Math.max(
                0,
                Math.min(
                    1,
                    score
                )
            ) * 100
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


        if (
            elements.metadataCount
        ) {

            elements.metadataCount.textContent =
                "0";

        }


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


    if (
        elements.metadataCount
    ) {

        elements.metadataCount.textContent =
            String(
                state.metadata.length
            );

    }

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
