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

        /* =================================================
           SIGHTENGINE VISUAL DETECTION
           -----------------------------------------------
           Stamp hanya boleh muncul jika hasil Sightengine
           benar-benar menyatakan is_ai_generated === true.
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
   ---------------------------------------------------------
   Stamp visual berada langsung di atas preview media.

   Struktur HTML:

       #metadata-ai-detect-overlay
           .metadata-ai-detect-stamp
               span
                   AI DETECTION

   Ketika Sightengine mendeteksi AI:

       overlay.hidden = false
       aria-hidden = false

   Ketika tidak terdeteksi:

       overlay.hidden = true
       aria-hidden = true

   Model selalu berasal dari:

       sightengine.model

   Tidak ada hardcode model.
========================================================= */

function renderOverlayStamp(
    sightengine
) {

    const overlay =
        elements.aiOverlay;


    /* =====================================================
       OVERLAY TIDAK ADA
    ===================================================== */

    if (
        !overlay
    ) {

        console.warn(
            "[GEN-Z.AI] AI detection overlay element tidak ditemukan."
        );

        return;

    }


    /* =====================================================
       PASTIKAN OVERLAY BENAR-BENAR TERLIHAT
       -----------------------------------------------
       Jangan hanya mengandalkan caller.

       Fungsi ini sendiri bertanggung jawab membuka
       overlay ketika hasil Sightengine positif.
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


    /* =====================================================
       FALLBACK STRUCTURE
       -----------------------------------------------
       Jika markup stamp tidak ada, buat ulang bagian
       stamp di dalam overlay.

       Ini tidak membuat overlay utama baru.
       Hanya menjaga UI tetap berfungsi apabila markup
       stamp hilang atau berubah.
    ===================================================== */

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
       -----------------------------------------------
       Model diambil langsung dari Sightengine.

       Contoh:

       genai
       genai-v2
       some-other-model

       Tidak ada fallback.
    ===================================================== */

    renderOverlayModel(
        stamp,
        sightengine?.model
    );


    /* =====================================================
       FINAL VISIBILITY LOCK
       -----------------------------------------------
       Pastikan browser menerima overlay sebagai element
       yang aktif setelah seluruh DOM selesai diperbarui.
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
   ---------------------------------------------------------
   Model TIDAK di-hardcode.

   Nilai berasal langsung dari:

       sightengine.model
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
       MODEL TIDAK TERSEDIA
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


    modelLabel.textContent =
        `Model ${modelValue}`;


    stamp.appendChild(
        modelLabel

    );

}


/* =========================================================
   CLEAR OVERLAY STAMP
   ---------------------------------------------------------
   Digunakan ketika:

   - file baru dipilih
   - Sightengine tidak mendeteksi AI
   - Sightengine gagal
   - belum ada hasil detection
   - hanya metadata AI yang ditemukan
========================================================= */

function clearOverlayStamp() {

    const overlay =
        elements.aiOverlay;


    if (
        !overlay
    ) {

        return;

    }


    /* =====================================================
       HIDE OVERLAY
    ===================================================== */

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
