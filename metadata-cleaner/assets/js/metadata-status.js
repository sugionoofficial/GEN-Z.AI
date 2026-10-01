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
   - Model pada AI DETECTION stamp selalu berasal
     langsung dari result Sightengine.
   - Stamp visual hanya ditampilkan jika
     Sightengine benar-benar mendeteksi AI.
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

        /*
           IMPORTANT:

           Stamp visual hanya milik
           Sightengine visual detection.

           Metadata lokal saja tidak boleh
           membuat stamp seolah-olah berasal
           dari Sightengine.
        */

        if (
            sightengineDetected
        ) {

            showElement(
                elements.aiOverlay
            );


            renderOverlayStamp(
                sightengine,
                true
            );

        } else {

            hideElement(
                elements.aiOverlay
            );


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
   ---------------------------------------------------------
   Struktur stamp menggunakan element yang sudah ada
   di index.html.

   Tampilan:

       AI DETECTION
       Model <hasil model Sightengine>

   Contoh jika API:

       model: "genai"

   maka:

       AI DETECTION
       Model genai

   Jika API mengembalikan:

       model: "genai-v2"

   maka:

       AI DETECTION
       Model genai-v2

   Tidak ada fallback model.

   Stamp hanya dipanggil ketika:
       sightengineDetected === true
========================================================= */

function renderOverlayStamp(
    sightengine,
    sightengineDetected
) {

    const overlay =
        elements.aiOverlay;


    if (
        !overlay
    ) {

        return;

    }


    /*
       Jika bukan hasil deteksi Sightengine,
       jangan tampilkan stamp.
    */

    if (
        sightengineDetected !== true
    ) {

        clearOverlayStamp();


        hideElement(
            overlay
        );


        return;

    }


    /*
       Gunakan stamp yang SUDAH ada
       di index.html.

       Tidak membuat struktur overlay utama baru.
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


    /* =====================================================
       LABEL UTAMA
    ===================================================== */

    label.textContent =
        "AI DETECTION";


    /* =====================================================
       MODEL RESULT
       -----------------------------------------------------
       Hanya tampil jika Sightengine benar-benar
       mendeteksi AI.

       Nilai model diambil langsung dari:

           sightengine.model
    ===================================================== */

    renderOverlayModel(
        stamp,
        sightengine?.model
    );

}


/* =========================================================
   OVERLAY MODEL LABEL
   ---------------------------------------------------------
   MODEL TIDAK DI-HARDCODE.

   Nilai yang tampil berasal langsung dari:

       sightengine.model

   Tidak ada:
       fallback "genai"

   Tidak ada:
       pemilihan model berdasarkan generator

   Tidak ada:
       tebakan model.
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


    /* =====================================================
       HAPUS MODEL LAMA
       -----------------------------------------------------
       Penting ketika user mengganti image.
    ===================================================== */

    const existing =
        stamp.querySelector(
            ".metadata-ai-detect-model"
        );


    if (
        existing
    ) {

        existing.remove();

    }


    /* =====================================================
       MODEL HARUS BERASAL DARI RESULT
    ===================================================== */

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


    /*
       Jangan tampilkan baris model jika
       Sightengine tidak memberikan nilai model.
    */

    if (
        !modelValue
    ) {

        return;

    }


    /* =====================================================
       CREATE MODEL LABEL
    ===================================================== */

    const modelLabel =
        document.createElement(
            "span"
        );


    modelLabel.className =
        "metadata-ai-detect-model";


    /*
       Pertahankan nilai model dari API.

       Contoh:

       model = "genai"
       -> Model genai

       model = "genai-v2"
       -> Model genai-v2

       model = "some-other-model"
       -> Model some-other-model
    */

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


    const label =
        overlay.querySelector(
            ".metadata-ai-detect-stamp span"
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
