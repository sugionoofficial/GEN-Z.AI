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

    if (
        state.aiIndicators.length
    ) {

        showElement(
            elements.aiOverlay
        );


        setStatus(
            "DETECTED",
            "AI DETECT",
            `${state.aiIndicators.length} indikator yang berkaitan dengan AI ditemukan pada metadata.`
        );


        return;
    }


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
