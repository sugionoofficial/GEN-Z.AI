/* =========================================================
   GEN-Z.AI
   GENERATE UI MODULE
   ---------------------------------------------------------
   File:
   generate/assets/js/generate-ui.js

   Tanggung jawab:
   - Render status
   - Render model header
   - Render MODEL CREDIT
   - Render ACCOUNT ROLE
   - Render ACCOUNT CREDIT
   - Loading state
   - Error state
   - Generate button state
   - Reset UI

   CREDIT POLICY
   ---------------------------------------------------------
   MODEL CREDIT SELALU berdasarkan resolusi aktif:

       480p  -> credit_480p
       720p  -> credit_720p
       1080p -> credit_1080p

   lalu:

       credit_final =
           credit_base -
           (credit_base * discount_percent / 100)

   SUMBER KREDIT FINAL:
       credit per resolusi + discount_percent

   DILARANG menggunakan sebagai sumber:
       credit_cost
       credit_final global
       credit_final_480p
       credit_final_720p
       credit_final_1080p
       credit legacy
       hardcoded 50

   ACCOUNT CREDIT:
       profile.credits

   MODEL CREDIT dan ACCOUNT CREDIT adalah dua data
   yang berbeda.
========================================================= */


/* =========================================================
   STATE
========================================================= */

import {
    getGenerateElements,
    getCurrentModel,
    getCurrentProfile,
    isModelReady
} from "./generate-state.js";


/*
 * Tetap dipertahankan untuk kompatibilitas arsitektur.
 *
 * File ini TIDAK menggunakan credit_final_* dari helper
 * sebagai sumber utama.
 */
import {
    getModelCreditForSelectedResolution
} from "./generate-model.js";


/* =========================================================
   ELEMENTS
========================================================= */

function elements() {

    return getGenerateElements();

}


/* =========================================================
   SAFE STRING
========================================================= */

function safeString(
    value,
    fallback = ""
) {

    if (
        value === null ||
        value === undefined
    ) {

        return fallback;

    }


    const result =
        String(
            value
        ).trim();


    return result ||
        fallback;

}


/* =========================================================
   NUMBER FORMAT
========================================================= */

function formatNumber(
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

        return String(
            value ?? ""
        );

    }


    return new Intl.NumberFormat(
        "id-ID",
        {
            maximumFractionDigits:
                2
        }
    ).format(
        number
    );

}


/* =========================================================
   NORMALIZE ACCOUNT CREDIT
========================================================= */

function normalizeAccountCredit(
    profile
) {

    if (
        !profile ||
        typeof profile !==
            "object"
    ) {

        return null;

    }


    const raw =
        profile.credits;


    if (
        raw === null ||
        raw === undefined ||
        raw === ""
    ) {

        return null;

    }


    const numeric =
        Number(
            raw
        );


    if (
        Number.isFinite(
            numeric
        )
    ) {

        return numeric;

    }


    const text =
        String(
            raw
        ).trim();


    return text ||
        null;

}


/* =========================================================
   NORMALIZE RESOLUTION
========================================================= */

function normalizeResolution(
    value
) {

    const normalized =
        String(
            value ?? ""
        )
            .trim()
            .toLowerCase()
            .replace(
                /\s+/g,
                ""
            );


    if (
        normalized === "480p" ||
        normalized === "480"
    ) {

        return "480p";

    }


    if (
        normalized === "720p" ||
        normalized === "720"
    ) {

        return "720p";

    }


    if (
        normalized === "1080p" ||
        normalized === "1080"
    ) {

        return "1080p";

    }


    return "";

}


/* =========================================================
   RESOLUTION CONTROL DETECTION
========================================================= */

function isResolutionElement(
    element
) {

    if (
        !element
    ) {

        return false;

    }


    const name =
        String(
            element.name || ""
        )
            .trim()
            .toLowerCase();


    const id =
        String(
            element.id || ""
        )
            .trim()
            .toLowerCase();


    const parameter =
        String(
            element.dataset?.parameter || ""
        )
            .trim()
            .toLowerCase();


    const key =
        String(
            element.dataset?.key || ""
        )
            .trim()
            .toLowerCase();


    const type =
        String(
            element.type || ""
        )
            .trim()
            .toLowerCase();


    return (

        name === "resolution" ||

        id === "resolution" ||

        parameter === "resolution" ||

        key === "resolution" ||

        name.includes("resolution") ||

        id.includes("resolution") ||

        parameter.includes("resolution") ||

        key.includes("resolution") ||

        (
            (
                type === "radio" ||
                type === "checkbox"
            ) &&
            (
                name.includes("resolution") ||
                id.includes("resolution")
            )
        )

    );

}


/* =========================================================
   READ CONTROL VALUE
========================================================= */

function readResolutionFromElement(
    element
) {

    if (
        !element
    ) {

        return "";

    }


    const tagName =
        String(
            element.tagName || ""
        )
            .trim()
            .toLowerCase();


    const type =
        String(
            element.type || ""
        )
            .trim()
            .toLowerCase();


    /*
     * -----------------------------------------------------
     * RADIO / CHECKBOX
     *
     * Jangan pernah membaca value dari radio yang belum
     * dipilih.
     * -----------------------------------------------------
     */

    if (
        type === "radio" ||
        type === "checkbox"
    ) {

        if (
            !element.checked
        ) {

            return "";

        }

    }


    /*
     * -----------------------------------------------------
     * SELECT
     * -----------------------------------------------------
 */

    if (
        tagName === "select"
    ) {

        const selectedOption =
            element.options?.[
                element.selectedIndex
            ];


        const selectedValue =
            normalizeResolution(
                selectedOption?.value
            );


        if (
            selectedValue
        ) {

            return selectedValue;

        }


        const selectedText =
            normalizeResolution(
                selectedOption?.textContent
            );


        if (
            selectedText
        ) {

            return selectedText;

        }

    }


    /*
     * -----------------------------------------------------
     * DIRECT VALUE
     * -----------------------------------------------------
 */

    const directValue =
        normalizeResolution(
            element.value
        );


    if (
        directValue
    ) {

        return directValue;

    }


    /*
     * -----------------------------------------------------
     * DATA VALUE
     * -----------------------------------------------------
 */

    const dataValue =
        normalizeResolution(
            element.dataset?.value
        );


    if (
        dataValue
    ) {

        return dataValue;

    }


    /*
     * -----------------------------------------------------
     * DATA RESOLUTION
     * -----------------------------------------------------
 */

    const attributeValue =
        normalizeResolution(
            element.getAttribute(
                "data-resolution"
            )
        );


    if (
        attributeValue
    ) {

        return attributeValue;

    }


    const dataResolution =
        normalizeResolution(
            element.dataset?.resolution
        );


    if (
        dataResolution
    ) {

        return dataResolution;

    }


    /*
     * -----------------------------------------------------
     * TEXT
     * -----------------------------------------------------
 */

    const textValue =
        normalizeResolution(
            element.textContent
        );


    if (
        textValue
    ) {

        return textValue;

    }


    return "";

}


/* =========================================================
   GET SELECTED RESOLUTION
========================================================= */

export function getSelectedResolution() {

    const {
        generateForm
    } = elements();


    if (
        !generateForm
    ) {

        return "";

    }


    /*
     * -----------------------------------------------------
     * PRIORITAS 1
     * SELECT resolution
     * -----------------------------------------------------
 */

    const selectCandidates =
        generateForm.querySelectorAll(
            'select[name="resolution"], select#resolution, select[data-parameter="resolution"], select[data-key="resolution"]'
        );


    for (
        const control
        of selectCandidates
    ) {

        const resolution =
            readResolutionFromElement(
                control
            );


        if (
            resolution
        ) {

            return resolution;

        }

    }


    /*
     * -----------------------------------------------------
     * PRIORITAS 2
     * CHECKED RADIO / CHECKBOX
     * -----------------------------------------------------
 */

    const checkedCandidates =
        generateForm.querySelectorAll(
            'input[type="radio"]:checked, input[type="checkbox"]:checked, [role="radio"][aria-checked="true"], [role="option"][aria-selected="true"], [data-selected="true"]'
        );


    for (
        const control
        of checkedCandidates
    ) {

        if (
            !isResolutionElement(
                control
            )
        ) {

            continue;

        }


        const resolution =
            readResolutionFromElement(
                control
            );


        if (
            resolution
        ) {

            return resolution;

        }

    }


    /*
     * -----------------------------------------------------
     * PRIORITAS 3
     * DIRECT SINGLE VALUE CONTROL
     * -----------------------------------------------------
 */

    const directCandidates = [

        generateForm.querySelector(
            'select[name="resolution"]'
        ),

        generateForm.querySelector(
            '#resolution'
        ),

        generateForm.querySelector(
            '[data-parameter="resolution"]'
        ),

        generateForm.querySelector(
            '[data-key="resolution"]'
        )

    ];


    for (
        const control
        of directCandidates
    ) {

        if (
            !control
        ) {

            continue;

        }


        /*
         * Jangan mengambil radio pertama yang belum
         * dipilih.
         */

        const type =
            String(
                control.type || ""
            )
                .trim()
                .toLowerCase();


        if (
            type === "radio" ||
            type === "checkbox"
        ) {

            if (
                !control.checked
            ) {

                continue;

            }

        }


        const resolution =
            readResolutionFromElement(
                control
            );


        if (
            resolution
        ) {

            return resolution;

        }

    }


    /*
     * -----------------------------------------------------
     * PRIORITAS 4
     * SEMUA CONTROL RESOLUTION
     * -----------------------------------------------------
 */

    const allControls =
        generateForm.querySelectorAll(
            "input, select, textarea, button, [role='option'], [role='radio'], [data-resolution], [data-parameter], [data-key]"
        );


    for (
        const control
        of allControls
    ) {

        if (
            !isResolutionElement(
                control
            )
        ) {

            continue;

        }


        const resolution =
            readResolutionFromElement(
                control
            );


        if (
            resolution
        ) {

            return resolution;

        }

    }


    return "";

}


/* =========================================================
   NORMALIZE CREDIT VALUE
========================================================= */

function normalizeCreditValue(
    value
) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return null;

    }


    const numeric =
        Number(
            value
        );


    if (
        !Number.isFinite(
            numeric
        ) ||
        numeric < 0
    ) {

        return null;

    }


    return numeric;

}


/* =========================================================
   NORMALIZE DISCOUNT
========================================================= */

function normalizeDiscountPercent(
    value
) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return 0;

    }


    const numeric =
        Number(
            value
        );


    if (
        !Number.isFinite(
            numeric
        )
    ) {

        return 0;

    }


    return Math.min(
        100,
        Math.max(
            0,
            numeric
        )
    );

}


/* =========================================================
   GET MODEL SOURCE OBJECTS
========================================================= */

function getModelSourceObjects(
    model
) {

    if (
        !model ||
        typeof model !==
            "object"
    ) {

        return [];

    }


    const objects = [

        model,

        model.pricing,

        model.credit,

        model.config,

        model.config?.pricing,

        model.model,

        model.model?.pricing,

        model.repository,

        model.repository?.pricing

    ];


    return objects.filter(
        object =>
            object &&
            typeof object ===
                "object"
    );

}


/* =========================================================
   READ MODEL RESOLUTION BASE CREDIT
========================================================= */

function getModelResolutionBaseCredit(
    model,
    resolution
) {

    const normalizedResolution =
        normalizeResolution(
            resolution
        );


    if (
        !normalizedResolution
    ) {

        return null;

    }


    const objects =
        getModelSourceObjects(
            model
        );


    let propertyNames = [];


    switch (
        normalizedResolution
    ) {

        case "480p":

            propertyNames = [

                "credit_480p",

                "credit480p",

                "credit_base_480p",

                "creditBase480p"

            ];

            break;


        case "720p":

            propertyNames = [

                "credit_720p",

                "credit720p",

                "credit_base_720p",

                "creditBase720p"

            ];

            break;


        case "1080p":

            propertyNames = [

                "credit_1080p",

                "credit1080p",

                "credit_base_1080p",

                "creditBase1080p"

            ];

            break;


        default:

            return null;

    }


    for (
        const object
        of objects
    ) {

        for (
            const property
            of propertyNames
        ) {

            const numeric =
                normalizeCreditValue(
                    object[property]
                );


            if (
                numeric !== null
            ) {

                return numeric;

            }

        }

    }


    return null;

}


/* =========================================================
   GET MODEL DISCOUNT
========================================================= */

function getModelDiscountPercent(
    model
) {

    const objects =
        getModelSourceObjects(
            model
        );


    for (
        const object
        of objects
    ) {

        const candidates = [

            object.discount_percent,

            object.discountPercent

        ];


        for (
            const candidate
            of candidates
        ) {

            if (
                candidate === null ||
                candidate === undefined ||
                candidate === ""
            ) {

                continue;

            }


            return normalizeDiscountPercent(
                candidate
            );

        }

    }


    return 0;

}


/* =========================================================
   CALCULATE FINAL CREDIT
========================================================= */

function calculateFinalCredit(
    baseCredit,
    discountPercent
) {

    const base =
        normalizeCreditValue(
            baseCredit
        );


    if (
        base === null
    ) {

        return null;

    }


    const discount =
        normalizeDiscountPercent(
            discountPercent
        );


    const finalCredit =
        base -
        (
            base *
            discount /
            100
        );


    return Math.max(
        0,
        finalCredit
    );

}


/* =========================================================
   RESOLVE MODEL CREDIT LOCALLY
========================================================= */

function resolveModelCreditLocally(
    model,
    resolution
) {

    const normalizedResolution =
        normalizeResolution(
            resolution
        );


    if (
        !model ||
        !normalizedResolution
    ) {

        return null;

    }


    const baseCredit =
        getModelResolutionBaseCredit(
            model,
            normalizedResolution
        );


    if (
        baseCredit === null
    ) {

        return null;

    }


    const discountPercent =
        getModelDiscountPercent(
            model
        );


    const finalCredit =
        calculateFinalCredit(
            baseCredit,
            discountPercent
        );


    if (
        finalCredit === null
    ) {

        return null;

    }


    return {

        resolution:
            normalizedResolution,

        credit_base:
            baseCredit,

        discount_percent:
            discountPercent,

        credit_final:
            finalCredit

    };

}


/* =========================================================
   RESOLVE MODEL CREDIT
========================================================= */

export function resolveModelCredit(
    model = getCurrentModel(),
    resolution = getSelectedResolution()
) {

    if (
        !model ||
        typeof model !==
            "object"
    ) {

        return null;

    }


    const normalizedResolution =
        normalizeResolution(
            resolution
        );


    if (
        !normalizedResolution
    ) {

        return null;

    }


    /*
     * -----------------------------------------------------
     * SUMBER UTAMA
     * -----------------------------------------------------
     */

    const localResult =
        resolveModelCreditLocally(
            model,
            normalizedResolution
        );


    if (
        localResult
    ) {

        return localResult;

    }


    /*
     * -----------------------------------------------------
     * KOMPATIBILITAS LAMA
     *
     * Tidak mempercayai credit_final dari helper.
     * Hanya mengambil base credit + discount jika tersedia.
     * -----------------------------------------------------
     */

    try {

        if (
            typeof getModelCreditForSelectedResolution ===
            "function"
        ) {

            const result =
                getModelCreditForSelectedResolution(
                    model,
                    normalizedResolution
                );


            if (
                result &&
                typeof result ===
                    "object"
            ) {

                const helperBase =
                    normalizeCreditValue(
                        result.credit_base ??
                        result.creditBase
                    );


                const helperDiscount =
                    normalizeDiscountPercent(
                        result.discount_percent ??
                        result.discountPercent ??
                        getModelDiscountPercent(
                            model
                        )
                    );


                if (
                    helperBase !== null
                ) {

                    const recalculated =
                        calculateFinalCredit(
                            helperBase,
                            helperDiscount
                        );


                    if (
                        recalculated !== null
                    ) {

                        return {

                            resolution:
                                normalizedResolution,

                            credit_base:
                                helperBase,

                            discount_percent:
                                helperDiscount,

                            credit_final:
                                recalculated

                        };

                    }

                }

            }

        }

    } catch {

        /*
         * Helper lama gagal.
         *
         * Tidak boleh menggagalkan halaman Generate.
         */

    }


    return null;

}


/* =========================================================
   GET MODEL CREDIT COST
========================================================= */

export function getModelCreditCost(
    model = getCurrentModel()
) {

    const resolution =
        getSelectedResolution();


    if (
        !resolution
    ) {

        return null;

    }


    const pricing =
        resolveModelCredit(
            model,
            resolution
        );


    if (
        !pricing
    ) {

        return null;

    }


    return pricing.credit_final;

}


/* =========================================================
   FORCE VISIBLE
========================================================= */

function forceVisible(
    element,
    displayValue = ""
) {

    if (
        !element
    ) {

        return;

    }


    element.hidden =
        false;


    element.removeAttribute(
        "hidden"
    );


    element.style.visibility =
        "visible";


    element.style.opacity =
        "1";


    if (
        displayValue
    ) {

        element.style.display =
            displayValue;

    } else {

        element.style.removeProperty(
            "display"
        );

    }

}


/* =========================================================
   CLEAR BUTTON CREDIT
========================================================= */

function clearLegacyButtonCredit(
    generateButton
) {

    if (
        !generateButton
    ) {

        return;

    }


    delete generateButton.dataset.modelCredit;

    delete generateButton.dataset.creditResolution;

}


/* =========================================================
   RESOLVE CREDIT CONTAINER
========================================================= */

function getCreditContainer(
    generateButton,
    generateCreditCost
) {

    if (
        generateCreditCost
    ) {

        return generateCreditCost;

    }


    if (
        !generateButton
    ) {

        return null;

    }


    return (

        generateButton.querySelector(
            "#generateCreditCost"
        ) ||

        generateButton.querySelector(
            ".generate-button-credit"
        ) ||

        generateButton.querySelector(
            "[data-credit-container]"
        )

    ) || null;

}


/* =========================================================
   GET BUTTON CREDIT VALUE ELEMENT
========================================================= */

function getButtonCreditValueElement(
    generateButton,
    generateCreditValue = null
) {

    /*
     * Gunakan element dari state jika memang valid.
     */

    if (
        generateCreditValue &&
        generateCreditValue.nodeType ===
            1
    ) {

        return generateCreditValue;

    }


    if (
        !generateButton
    ) {

        return null;

    }


    /*
     * -----------------------------------------------------
     * PRIORITAS 1
     * Exact ID.
     * -----------------------------------------------------
     */

    const direct =
        generateButton.querySelector(
            "#generateCreditValue"
        );


    if (
        direct
    ) {

        return direct;

    }


    /*
     * -----------------------------------------------------
     * PRIORITAS 2
     * Known credit value selectors.
     * -----------------------------------------------------
 */

    const candidates =
        generateButton.querySelectorAll(
            "[data-generate-credit], [data-credit-display], .generate-button-credit-value, .credit-value"
        );


    for (
        const candidate
        of candidates
    ) {

        if (
            !candidate
        ) {

            continue;

        }


        if (
            candidate.id ===
                "generateCreditCost"
        ) {

            continue;

        }


        if (
            candidate.classList?.contains(
                "generate-button-credit"
            )
        ) {

            continue;

        }


        return candidate;

    }


    /*
     * -----------------------------------------------------
     * PRIORITAS 3
     * Cari child element yang bukan icon.
     * -----------------------------------------------------
 */

    const container =
        generateButton.querySelector(
            "#generateCreditCost"
        ) ||
        generateButton.querySelector(
            ".generate-button-credit"
        );


    if (
        container
    ) {

        const child =
            container.querySelector(
                "span:not(.icon):not(.btn-icon), small, b, strong"
            );


        if (
            child
        ) {

            return child;

        }

    }


    /*
     * -----------------------------------------------------
     * PRIORITAS 4
     * Buat element credit value bila container ada.
     *
     * Ini penting supaya UI tetap bisa menampilkan credit
     * walaupun generate-state.js belum mendaftarkan
     * #generateCreditValue.
     * -----------------------------------------------------
 */

    if (
        container
    ) {

        const created =
            document.createElement(
                "span"
            );


        created.id =
            "generateCreditValue";


        created.className =
            "generate-button-credit-value";


        created.setAttribute(
            "data-generate-credit",
            "true"
        );


        created.setAttribute(
            "aria-live",
            "polite"
        );


        container.appendChild(
            created
        );


        return created;

    }


    return null;

}


/* =========================================================
   UPDATE GENERATE BUTTON CREDIT
========================================================= */

function syncGenerateButtonCredit(
    generateButton,
    credit,
    resolution,
    generateCreditValue = null
) {

    if (
        !generateButton
    ) {

        return;

    }


    const creditContainer =
        getCreditContainer(
            generateButton,
            null
        );


    const creditValueElement =
        getButtonCreditValueElement(
            generateButton,
            generateCreditValue
        );


    if (
        creditContainer
    ) {

        forceVisible(
            creditContainer,
            "inline-flex"
        );

    }


    if (
        !creditValueElement
    ) {

        return;

    }


    if (
        credit === null ||
        credit === undefined ||
        !Number.isFinite(
            Number(
                credit
            )
        ) ||
        !resolution
    ) {

        clearLegacyButtonCredit(
            generateButton
        );


        creditValueElement.textContent =
            "-- Credit";


        creditValueElement.dataset.credit =
            "";


        creditValueElement.dataset.resolution =
            "";


        forceVisible(
            creditValueElement
        );


        return;

    }


    const numericCredit =
        Number(
            credit
        );


    generateButton.dataset.modelCredit =
        String(
            numericCredit
        );


    generateButton.dataset.creditResolution =
        resolution;


    const formatted =
        formatNumber(
            numericCredit
        );


    creditValueElement.textContent =
        `${formatted} Credit`;


    creditValueElement.dataset.credit =
        String(
            numericCredit
        );


    creditValueElement.dataset.resolution =
        resolution;


    forceVisible(
        creditValueElement
    );

}


/* =========================================================
   RENDER MODEL CREDIT
========================================================= */

export function renderModelCredit(
    model = getCurrentModel()
) {

    const {
        generateCreditCost,
        generateCreditValue,
        generateButton
    } = elements();


    /*
     * -----------------------------------------------------
     * RESOLVE REAL DOM ELEMENT
     *
     * Jangan bergantung 100% kepada cache state.
     * -----------------------------------------------------
     */

    const creditContainer =
        getCreditContainer(
            generateButton,
            generateCreditCost
        );


    const realCreditValue =
        getButtonCreditValueElement(
            generateButton,
            generateCreditValue
        );


    /*
     * Jika state tidak punya generateCreditValue tetapi
     * tombol punya child credit value, gunakan element itu.
     */

    const creditValueElement =
        realCreditValue ||
        generateCreditValue ||
        null;


    const resolution =
        getSelectedResolution();


    /*
     * -----------------------------------------------------
     * VALIDASI ELEMENT
     * -----------------------------------------------------
 */

    if (
        !creditValueElement
    ) {

        return null;

    }


    if (
        creditContainer
    ) {

        forceVisible(
            creditContainer,
            "inline-flex"
        );

    }


    /*
     * -----------------------------------------------------
     * NO RESOLUTION
     * -----------------------------------------------------
 */

    if (
        !resolution
    ) {

        creditValueElement.textContent =
            "-- Credit";


        creditValueElement.dataset.credit =
            "";


        creditValueElement.dataset.resolution =
            "";


        clearLegacyButtonCredit(
            generateButton
        );


        return null;

    }


    /*
     * -----------------------------------------------------
     * RESOLVE PRICING
     * -----------------------------------------------------
 */

    const pricing =
        resolveModelCredit(
            model,
            resolution
        );


    /*
     * -----------------------------------------------------
     * CREDIT TIDAK TERSEDIA
     * -----------------------------------------------------
 */

    if (
        !pricing
    ) {

        creditValueElement.textContent =
            "-- Credit";


        creditValueElement.dataset.credit =
            "";


        creditValueElement.dataset.resolution =
            resolution;


        syncGenerateButtonCredit(
            generateButton,
            null,
            resolution,
            creditValueElement
        );


        return null;

    }


    /*
     * -----------------------------------------------------
     * BASE CREDIT
     * -----------------------------------------------------
 */

    const baseCredit =
        normalizeCreditValue(
            pricing.credit_base
        );


    /*
     * -----------------------------------------------------
     * DISCOUNT
     * -----------------------------------------------------
 */

    const discountPercent =
        normalizeDiscountPercent(
            pricing.discount_percent
        );


    /*
     * -----------------------------------------------------
     * HITUNG ULANG FINAL
     *
     * TIDAK mengambil pricing.credit_final sebagai
     * source of truth.
     * -----------------------------------------------------
 */

    const credit =
        calculateFinalCredit(
            baseCredit,
            discountPercent
        );


    /*
     * -----------------------------------------------------
     * VALIDATE FINAL CREDIT
     * -----------------------------------------------------
 */

    if (
        credit === null ||
        !Number.isFinite(
            credit
        ) ||
        credit < 0
    ) {

        creditValueElement.textContent =
            "-- Credit";


        creditValueElement.dataset.credit =
            "";


        creditValueElement.dataset.resolution =
            resolution;


        syncGenerateButtonCredit(
            generateButton,
            null,
            resolution,
            creditValueElement
        );


        return null;

    }


    /*
     * -----------------------------------------------------
     * FORMAT
     * -----------------------------------------------------
 */

    const formatted =
        formatNumber(
            credit
        );


    /*
     * -----------------------------------------------------
     * RENDER
     * -----------------------------------------------------
 */

    creditValueElement.textContent =
        `${formatted} Credit`;


    creditValueElement.dataset.credit =
        String(
            credit
        );


    creditValueElement.dataset.resolution =
        resolution;


    creditValueElement.dataset.baseCredit =
        String(
            baseCredit
        );


    creditValueElement.dataset.discountPercent =
        String(
            discountPercent
        );


    /*
     * -----------------------------------------------------
     * FORCE DISPLAY
     * -----------------------------------------------------
 */

    forceVisible(
        creditValueElement
    );


    if (
        creditContainer
    ) {

        forceVisible(
            creditContainer,
            "inline-flex"
        );

    }


    /*
     * -----------------------------------------------------
     * SYNC BUTTON DATA
     * -----------------------------------------------------
 */

    syncGenerateButtonCredit(
        generateButton,
        credit,
        resolution,
        creditValueElement
    );


    return credit;

}


/* =========================================================
   BIND RESOLUTION CREDIT SYNC
========================================================= */

function bindResolutionCreditSync() {

    const {
        generateForm
    } = elements();


    if (
        !generateForm
    ) {

        return;

    }


    if (
        generateForm.dataset.creditSyncBound ===
        "true"
    ) {

        return;

    }


    generateForm.dataset.creditSyncBound =
        "true";


    generateForm.addEventListener(
        "change",
        event => {

            const target =
                event.target;


            if (
                !target ||
                !isResolutionElement(
                    target
                )
            ) {

                return;

            }


            renderModelCredit(
                getCurrentModel()
            );

        }
    );


    generateForm.addEventListener(
        "input",
        event => {

            const target =
                event.target;


            if (
                !target ||
                !isResolutionElement(
                    target
                )
            ) {

                return;

            }


            renderModelCredit(
                getCurrentModel()
            );

        }
    );


    generateForm.addEventListener(
        "click",
        event => {

            const target =
                event.target;


            if (
                !target
            ) {

                return;

            }


            const resolutionElement =
                target.closest(
                    "[data-resolution], [data-parameter='resolution'], [data-key='resolution'], [role='option'], [role='radio'], input[name='resolution'], select[name='resolution']"
                );


            if (
                !resolutionElement
            ) {

                return;

            }


            if (
                typeof requestAnimationFrame ===
                "function"
            ) {

                requestAnimationFrame(
                    () => {

                        renderModelCredit(
                            getCurrentModel()
                        );

                    }
                );

            } else {

                renderModelCredit(
                    getCurrentModel()
                );

            }

        }
    );

}


/* =========================================================
   INITIALIZE RESOLUTION CREDIT SYNC
========================================================= */

function scheduleResolutionCreditSync() {

    const bind =
        () => {

            bindResolutionCreditSync();


            if (
                typeof requestAnimationFrame ===
                "function"
            ) {

                requestAnimationFrame(
                    () => {

                        bindResolutionCreditSync();

                        renderModelCredit(
                            getCurrentModel()
                        );

                    }
                );

            } else {

                renderModelCredit(
                    getCurrentModel()
                );

            }

        };


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            bind,
            {
                once:
                    true
            }
        );

    } else {

        bind();

    }

}


/* =========================================================
   RENDER ACCOUNT CREDIT
========================================================= */

export function renderCreditBadge(
    profile = getCurrentProfile()
) {

    const {
        creditBadge
    } = elements();


    if (
        !creditBadge
    ) {

        return null;

    }


    const credits =
        normalizeAccountCredit(
            profile
        );


    if (
        credits === null
    ) {

        creditBadge.textContent =
            "Credit: -";


        forceVisible(
            creditBadge
        );


        delete creditBadge.dataset.credit;


        return null;

    }


    if (
        typeof credits ===
            "number"
    ) {

        creditBadge.textContent =
            `Credit: ${formatNumber(
                credits
            )}`;


        creditBadge.dataset.credit =
            String(
                credits
            );

    } else {

        creditBadge.textContent =
            `Credit: ${safeString(
                credits
            )}`;


        creditBadge.dataset.credit =
            String(
                credits
            );

    }


    forceVisible(
        creditBadge
    );


    return credits;

}


/* =========================================================
   ROLE BADGE
========================================================= */

export function renderRoleBadge(
    profile = getCurrentProfile()
) {

    const {
        roleBadge
    } = elements();


    if (
        !roleBadge
    ) {

        return null;

    }


    const role =
        safeString(
            profile?.role
        ).toUpperCase();


    if (
        !role
    ) {

        roleBadge.textContent =
            "-";


        forceVisible(
            roleBadge
        );


        delete roleBadge.dataset.role;


        return null;

    }


    roleBadge.textContent =
        role;


    forceVisible(
        roleBadge
    );


    roleBadge.dataset.role =
        role.toLowerCase();


    return role;

}


/* =========================================================
   AUTH BADGES
========================================================= */

export function renderAuthBadges(
    profile = getCurrentProfile()
) {

    if (
        !profile ||
        typeof profile !==
            "object"
    ) {

        renderRoleBadge(
            null
        );


        renderCreditBadge(
            null
        );


        return null;

    }


    renderRoleBadge(
        profile
    );


    renderCreditBadge(
        profile
    );


    return profile;

}


/* =========================================================
   STATUS
========================================================= */

export function showStatus(
    message,
    type = "info"
) {

    const {
        status
    } = elements();


    if (
        !status
    ) {

        return;

    }


    status.textContent =
        safeString(
            message
        );


    status.dataset.type =
        safeString(
            type,
            "info"
        );


    status.hidden =
        false;


    status.style.display =
        "";


    status.style.visibility =
        "visible";

}


export function hideStatus() {

    const {
        status
    } = elements();


    if (
        !status
    ) {

        return;

    }


    status.hidden =
        true;


    status.textContent =
        "";

}


/* =========================================================
   PAGE ERROR
========================================================= */

export function showPageError(
    message
) {

    const {
        pageError,
        pageErrorMessage
    } = elements();


    if (
        pageErrorMessage
    ) {

        pageErrorMessage.textContent =
            safeString(
                message,
                "Terjadi kesalahan."
            );

    }


    if (
        pageError
    ) {

        pageError.hidden =
            false;


        pageError.style.display =
            "";

    }

}


export function hidePageError() {

    const {
        pageError,
        pageErrorMessage
    } = elements();


    if (
        pageError
    ) {

        pageError.hidden =
            true;

    }


    if (
        pageErrorMessage
    ) {

        pageErrorMessage.textContent =
            "";

    }

}


/* =========================================================
   ERROR
========================================================= */

export function showError(
    error,
    fallbackMessage =
        "Terjadi kesalahan."
) {

    const message =
        error instanceof Error
            ? error.message
            : safeString(
                error,
                fallbackMessage
            );


    showPageError(
        message
    );


    showStatus(
        message,
        "error"
    );

}


/* =========================================================
   LOADING
========================================================= */

export function setLoading(
    active,
    message =
        "Memproses..."
) {

    const {
        generateButton,
        loading,
        modelSelect,
        resetButton
    } = elements();


    const isActive =
        Boolean(
            active
        );


    if (
        loading
    ) {

        loading.hidden =
            !isActive;


        loading.style.display =
            isActive
                ? "inline-flex"
                : "none";


        loading.style.visibility =
            isActive
                ? "visible"
                : "hidden";


        loading.style.opacity =
            isActive
                ? "1"
                : "0";


        loading.setAttribute(
            "aria-hidden",
            String(
                !isActive
            )
        );


        if (
            isActive
        ) {

            const textElement =
                loading.querySelector(
                    "span:not(.spinner)"
                );


            if (
                textElement
            ) {

                textElement.textContent =
                    safeString(
                        message,
                        "Memproses..."
                    );

            }

        }

    }


    if (
        generateButton
    ) {

        generateButton.setAttribute(
            "aria-busy",
            String(
                isActive
            )
        );


        const labelCandidates = [

            generateButton.querySelector(
                ".generate-button-label"
            ),

            generateButton.querySelector(
                ".btn-label"
            ),

            generateButton.querySelector(
                ".btn-icon + span:not(.generate-button-credit)"
            )

        ];


        const label =
            labelCandidates.find(
                element =>
                    Boolean(
                        element
                    )
            );


        if (
            label
        ) {

            if (
                !label.dataset.originalText
            ) {

                label.dataset.originalText =
                    label.textContent;

            }


            label.textContent =
                isActive
                    ? safeString(
                        message,
                        "Memproses..."
                    )
                    : (
                        label.dataset.originalText ||
                        "Generate Video"
                    );

        }


        renderModelCredit(
            getCurrentModel()
        );

    }


    if (
        modelSelect
    ) {

        modelSelect.disabled =
            isActive;

    }


    if (
        resetButton
    ) {

        resetButton.disabled =
            isActive;

    }


    renderAuthBadges(
        getCurrentProfile()
    );

}


/* =========================================================
   ENABLE GENERATION
========================================================= */

export function enableGeneration() {

    const {
        generateButton
    } = elements();


    if (
        !generateButton
    ) {

        return;

    }


    const ready =
        isModelReady();


    generateButton.disabled =
        !ready;


    generateButton.removeAttribute(
        "aria-busy"
    );


    renderModelCredit(
        getCurrentModel()
    );


    renderAuthBadges(
        getCurrentProfile()
    );

}


/* =========================================================
   DISABLE GENERATION
========================================================= */

export function disableGeneration() {

    const {
        generateButton
    } = elements();


    if (
        !generateButton
    ) {

        return;

    }


    generateButton.disabled =
        true;


    generateButton.removeAttribute(
        "aria-busy"
    );


    renderModelCredit(
        getCurrentModel()
    );


    renderAuthBadges(
        getCurrentProfile()
    );

}


/* =========================================================
   FORM DISABLED
========================================================= */

export function setFormDisabled(
    disabled
) {

    const {
        generateForm
    } = elements();


    if (
        !generateForm
    ) {

        return;

    }


    const controls =
        generateForm.querySelectorAll(
            "input, textarea, select, button"
        );


    controls.forEach(
        control => {

            control.disabled =
                Boolean(
                    disabled
                );

        }
    );


    renderModelCredit(
        getCurrentModel()
    );


    renderAuthBadges(
        getCurrentProfile()
    );

}


/* =========================================================
   MODEL HEADER
========================================================= */

export function renderModelHeader(
    model = getCurrentModel()
) {

    const {
        modelName,
        modelDescription,
        providerName,
        modelMeta
    } = elements();


    if (
        !model
    ) {

        if (
            modelName
        ) {

            modelName.textContent =
                "Model belum dipilih";

        }


        if (
            modelDescription
        ) {

            modelDescription.textContent =
                "";

        }


        if (
            providerName
        ) {

            providerName.textContent =
                "";

        }


        if (
            modelMeta
        ) {

            modelMeta.textContent =
                "";

        }


        renderModelCredit(
            null
        );


        renderAuthBadges(
            getCurrentProfile()
        );


        return null;

    }


    const name =
        safeString(

            model.model_name ||

            model.name ||

            model.config?.model_name ||

            model.config?.name ||

            model.repository?.model_name ||

            model.model_id ||

            model.config?.id,

            "Model"

        );


    const description =
        safeString(

            model.description ||

            model.config?.description ||

            model.repository?.description,

            ""

        );


    const provider =
        safeString(

            model.provider_name ||

            model.providerName ||

            model.provider?.provider_name ||

            model.provider?.providerName ||

            model.provider?.name ||

            model.repository?.provider_name ||

            model.config?.providerName ||

            model.provider_id,

            "-"

        );


    const modelId =
        safeString(

            model.model_id ||

            model.config?.id ||

            model.id,

            ""

        );


    if (
        modelName
    ) {

        modelName.textContent =
            name;

    }


    if (
        modelDescription
    ) {

        modelDescription.textContent =
            description;

    }


    if (
        providerName
    ) {

        providerName.textContent =
            provider;

    }


    if (
        modelMeta
    ) {

        modelMeta.textContent =
            modelId
                ? `Model ID: ${modelId}`
                : "";

    }


    const credit =
        renderModelCredit(
            model
        );


    renderAuthBadges(
        getCurrentProfile()
    );


    return {

        modelName:
            name,

        description,

        provider,

        modelId,

        credit

    };

}


/* =========================================================
   RESULT
========================================================= */

export function hideResult() {

    const {
        resultCard
    } = elements();


    if (
        resultCard
    ) {

        resultCard.hidden =
            true;

    }

}


export function showResult() {

    hideResult();

}


export function renderResult(
    data = {}
) {

    const model =
        getCurrentModel();


    const modelName =
        safeString(

            data.model_name ||

            data.model_id ||

            data.model ||

            model?.model_name ||

            model?.name ||

            model?.model_id,

            "-"

        );


    const provider =
        safeString(

            data.provider ||

            data.provider_name ||

            data.provider_id ||

            model?.provider_name ||

            model?.provider?.provider_name ||

            model?.provider_id,

            "-"

        );


    const taskId =
        safeString(

            data.taskId ||

            data.task_id ||

            data.jobId ||

            data.job_id ||

            data.task?.taskId ||

            data.task?.task_id,

            "-"

        );


    hideResult();


    return {

        model:
            modelName,

        provider,

        taskId,

        resultUrls:
            []

    };

}


/* =========================================================
   GENERATE CARD
========================================================= */

export function showGenerateCard() {

    const {
        generateCard
    } = elements();


    if (
        generateCard
    ) {

        generateCard.hidden =
            false;

    }


    renderAuthBadges(
        getCurrentProfile()
    );


    renderModelCredit(
        getCurrentModel()
    );

}


export function hideGenerateCard() {

    const {
        generateCard
    } = elements();


    if (
        generateCard
    ) {

        generateCard.hidden =
            true;

    }


    renderAuthBadges(
        getCurrentProfile()
    );

}


/* =========================================================
   MODEL SELECTOR
========================================================= */

export function showModelSelector() {

    const {
        modelSelector
    } = elements();


    if (
        modelSelector
    ) {

        modelSelector.hidden =
            false;

    }

}


export function hideModelSelector() {

    const {
        modelSelector
    } = elements();


    if (
        modelSelector
    ) {

        modelSelector.hidden =
            true;

    }

}


/* =========================================================
   RESET RESULT
========================================================= */

export function resetResultUI() {

    hideResult();


    const {
        resultModel,
        resultProvider,
        resultTaskId
    } = elements();


    if (
        resultModel
    ) {

        resultModel.textContent =
            "";

    }


    if (
        resultProvider
    ) {

        resultProvider.textContent =
            "";

    }


    if (
        resultTaskId
    ) {

        resultTaskId.textContent =
            "";

    }


    const resultMedia =
        document.getElementById(
            "resultMedia"
        );


    if (
        resultMedia
    ) {

        resultMedia.innerHTML =
            "";

    }


    renderAuthBadges(
        getCurrentProfile()
    );


    renderModelCredit(
        getCurrentModel()
    );

}


/* =========================================================
   RESET STATUS
========================================================= */

export function resetStatusUI() {

    hideStatus();

    hidePageError();

}


/* =========================================================
   RESET UI
========================================================= */

export function resetUI() {

    resetResultUI();

    resetStatusUI();


    setLoading(
        false
    );


    renderAuthBadges(
        getCurrentProfile()
    );


    renderModelHeader(
        getCurrentModel()
    );


    if (
        isModelReady()
    ) {

        enableGeneration();

    } else {

        disableGeneration();

    }


    renderAuthBadges(
        getCurrentProfile()
    );


    renderModelCredit(
        getCurrentModel()
    );

}


/* =========================================================
   FOCUS INVALID
========================================================= */

export function focusFirstInvalidField() {

    const {
        generateForm
    } = elements();


    if (
        !generateForm
    ) {

        return false;

    }


    const invalid =
        generateForm.querySelector(
            ":invalid"
        );


    if (
        !invalid
    ) {

        return false;

    }


    try {

        invalid.focus();

    } catch {

        /* Ignore focus failure. */

    }


    return true;

}


/* =========================================================
   SCROLL ERROR
========================================================= */

export function scrollToError() {

    const {
        pageError,
        status
    } = elements();


    const target =

        pageError &&
        !pageError.hidden

            ? pageError

            : status &&
              !status.hidden

                ? status

                : null;


    if (
        !target
    ) {

        return;

    }


    try {

        target.scrollIntoView({

            behavior:
                "smooth",

            block:
                "center"

        });

    } catch {

        target.scrollIntoView();

    }

}


/* =========================================================
   SUCCESS
========================================================= */

export function showSuccess(
    message =
        "Generate berhasil diproses."
) {

    showStatus(
        message,
        "success"
    );


    renderAuthBadges(
        getCurrentProfile()
    );


    renderModelCredit(
        getCurrentModel()
    );

}


/* =========================================================
   READY
========================================================= */

export function showReady(
    message =
        "Model siap digunakan."
) {

    hidePageError();


    showStatus(
        message,
        "success"
    );


    renderAuthBadges(
        getCurrentProfile()
    );


    renderModelCredit(
        getCurrentModel()
    );


    if (
        isModelReady()
    ) {

        enableGeneration();

    } else {

        disableGeneration();

    }

}


/* =========================================================
   BUSY
========================================================= */

export function showBusy(
    message =
        "Sedang memproses..."
) {

    hidePageError();


    showStatus(
        message,
        "info"
    );


    renderAuthBadges(
        getCurrentProfile()
    );


    renderModelCredit(
        getCurrentModel()
    );


    setLoading(
        true,
        message
    );

}


/* =========================================================
   FINISH REQUEST
========================================================= */

export function finishRequest() {

    setLoading(
        false
    );


    renderAuthBadges(
        getCurrentProfile()
    );


    renderModelCredit(
        getCurrentModel()
    );


    if (
        isModelReady()
    ) {

        enableGeneration();

    } else {

        disableGeneration();

    }

}


/* =========================================================
   INITIAL LOADING STATE
========================================================= */

function initializeLoadingState() {

    const {
        loading
    } = elements();


    if (
        !loading
    ) {

        return;

    }


    loading.hidden =
        true;


    loading.style.display =
        "none";


    loading.style.visibility =
        "hidden";


    loading.style.opacity =
        "0";


    loading.setAttribute(
        "aria-hidden",
        "true"
    );

}


/* =========================================================
   INITIALIZE LOADING STATE
========================================================= */

function scheduleInitialLoadingState() {

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            initializeLoadingState,
            {
                once:
                    true
            }
        );

    } else {

        initializeLoadingState();

    }

}


/* =========================================================
   START INITIAL STATES
========================================================= */

scheduleInitialLoadingState();

scheduleResolutionCreditSync();


/* =========================================================
   PUBLIC API
========================================================= */

export const generateUI =
    Object.freeze({

        showStatus,

        hideStatus,

        showPageError,

        hidePageError,

        showError,

        renderModelCredit,

        getModelCreditCost,

        getSelectedResolution,

        resolveModelCredit,

        renderRoleBadge,

        renderCreditBadge,

        renderAuthBadges,

        setLoading,

        enableGeneration,

        disableGeneration,

        setFormDisabled,

        renderModelHeader,

        hideResult,

        showResult,

        renderResult,

        showGenerateCard,

        hideGenerateCard,

        showModelSelector,

        hideModelSelector,

        resetResultUI,

        resetStatusUI,

        resetUI,

        focusFirstInvalidField,

        scrollToError,

        showSuccess,

        showReady,

        showBusy,

        finishRequest

    });


export default generateUI;
