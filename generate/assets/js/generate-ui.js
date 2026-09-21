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

   DILARANG menggunakan:

       credit_cost
       credit_final global
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


    return (

        name === "resolution" ||

        id === "resolution" ||

        parameter === "resolution" ||

        key === "resolution" ||

        name.includes("resolution") ||

        id.includes("resolution") ||

        parameter.includes("resolution") ||

        key.includes("resolution")

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


    /*
     * Native select/input.
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
     * Custom component yang menyimpan value
     * di data-value.
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
     * Custom component yang menyimpan selected
     * value di attribute.
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


    /*
     * Radio / checkbox.
     */
    if (
        element.checked
    ) {

        const checkedValue =
            normalizeResolution(
                element.value ||
                element.dataset?.resolution ||
                element.dataset?.value
            );


        if (
            checkedValue
        ) {

            return checkedValue;

        }

    }


    return "";

}


/* =========================================================
   GET SELECTED RESOLUTION
   ---------------------------------------------------------
   Tidak mengasumsikan struktur HTML tertentu.
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
     * Native/custom control langsung.
     * -----------------------------------------------------
     */

    const directCandidates = [

        generateForm.querySelector(
            '[name="resolution"]'
        ),

        generateForm.querySelector(
            '#resolution'
        ),

        generateForm.querySelector(
            '[data-parameter="resolution"]'
        ),

        generateForm.querySelector(
            '[data-key="resolution"]'
        ),

        generateForm.querySelector(
            '[data-resolution]'
        )

    ];


    for (
        const control
        of directCandidates
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
     * Semua control yang namanya berkaitan
     * dengan resolution.
     * -----------------------------------------------------
     */

    const allControls =
        generateForm.querySelectorAll(
            "input, select, textarea, button, [role='option'], [role='radio']"
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


    /*
     * -----------------------------------------------------
     * PRIORITAS 3
     * Radio / option yang sedang selected.
     * -----------------------------------------------------
     */

    const selectedControls =
        generateForm.querySelectorAll(
            "input:checked, option:checked, [aria-selected='true'], [data-selected='true']"
        );


    for (
        const control
        of selectedControls
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


        const textResolution =
            normalizeResolution(
                control.textContent
            );


        if (
            textResolution
        ) {

            return textResolution;

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
   READ MODEL RESOLUTION CREDIT
   ---------------------------------------------------------
   TIDAK membaca credit_cost.
   TIDAK membaca credit_final global.
========================================================= */

function getModelResolutionBaseCredit(
    model,
    resolution
) {

    if (
        !model ||
        typeof model !==
            "object"
    ) {

        return null;

    }


    const pricing =
        model.pricing &&
        typeof model.pricing === "object"

            ? model.pricing

            : null;


    const config =
        model.config &&
        typeof model.config === "object"

            ? model.config

            : null;


    const configPricing =
        config?.pricing &&
        typeof config.pricing === "object"

            ? config.pricing

            : null;


    let candidates = [];


    switch (
        resolution
    ) {

        case "480p":

            candidates = [

                model.credit_480p,

                model.credit480p,

                model.credit?.credit_480p,

                model.credit?.credit480p,

                pricing?.credit_480p,

                pricing?.credit480p,

                config?.credit_480p,

                config?.credit480p,

                configPricing?.credit_480p,

                configPricing?.credit480p

            ];

            break;


        case "720p":

            candidates = [

                model.credit_720p,

                model.credit720p,

                model.credit?.credit_720p,

                model.credit?.credit720p,

                pricing?.credit_720p,

                pricing?.credit720p,

                config?.credit_720p,

                config?.credit720p,

                configPricing?.credit_720p,

                configPricing?.credit720p

            ];

            break;


        case "1080p":

            candidates = [

                model.credit_1080p,

                model.credit1080p,

                model.credit?.credit_1080p,

                model.credit?.credit1080p,

                pricing?.credit_1080p,

                pricing?.credit1080p,

                config?.credit_1080p,

                config?.credit1080p,

                configPricing?.credit_1080p,

                configPricing?.credit1080p

            ];

            break;


        default:

            return null;

    }


    for (
        const candidate
        of candidates
    ) {

        const numeric =
            normalizeCreditValue(
                candidate
            );


        if (
            numeric !== null
        ) {

            return numeric;

        }

    }


    return null;

}


/* =========================================================
   READ EXPLICIT FINAL CREDIT
   ---------------------------------------------------------
   Hanya menerima FINAL CREDIT PER RESOLUSI.

   Tidak menerima:
       credit_final
       credit_cost
========================================================= */

function getExplicitResolutionFinalCredit(
    model,
    resolution
) {

    if (
        !model ||
        typeof model !==
            "object"
    ) {

        return null;

    }


    const pricing =
        model.pricing &&
        typeof model.pricing === "object"

            ? model.pricing

            : null;


    const config =
        model.config &&
        typeof model.config === "object"

            ? model.config

            : null;


    const configPricing =
        config?.pricing &&
        typeof config.pricing === "object"

            ? config.pricing

            : null;


    let candidates = [];


    switch (
        resolution
    ) {

        case "480p":

            candidates = [

                model.credit_final_480p,

                model.creditFinal480p,

                model.credit480pFinal,

                pricing?.credit_final_480p,

                pricing?.creditFinal480p,

                pricing?.credit480pFinal,

                config?.credit_final_480p,

                config?.creditFinal480p,

                configPricing?.credit_final_480p,

                configPricing?.creditFinal480p

            ];

            break;


        case "720p":

            candidates = [

                model.credit_final_720p,

                model.creditFinal720p,

                model.credit720pFinal,

                pricing?.credit_final_720p,

                pricing?.creditFinal720p,

                pricing?.credit720pFinal,

                config?.credit_final_720p,

                config?.creditFinal720p,

                configPricing?.credit_final_720p,

                configPricing?.creditFinal720p

            ];

            break;


        case "1080p":

            candidates = [

                model.credit_final_1080p,

                model.creditFinal1080p,

                model.credit1080pFinal,

                pricing?.credit_final_1080p,

                pricing?.creditFinal1080p,

                pricing?.credit1080pFinal,

                config?.credit_final_1080p,

                config?.creditFinal1080p,

                configPricing?.credit_final_1080p,

                configPricing?.creditFinal1080p

            ];

            break;


        default:

            return null;

    }


    for (
        const candidate
        of candidates
    ) {

        const numeric =
            normalizeCreditValue(
                candidate
            );


        if (
            numeric !== null
        ) {

            return numeric;

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

    if (
        !model ||
        typeof model !==
            "object"
    ) {

        return 0;

    }


    const pricing =
        model.pricing &&
        typeof model.pricing === "object"

            ? model.pricing

            : null;


    const config =
        model.config &&
        typeof model.config === "object"

            ? model.config

            : null;


    const configPricing =
        config?.pricing &&
        typeof config.pricing === "object"

            ? config.pricing

            : null;


    return normalizeDiscountPercent(

        model.discount_percent ??

        model.discountPercent ??

        pricing?.discount_percent ??

        pricing?.discountPercent ??

        config?.discount_percent ??

        config?.discountPercent ??

        configPricing?.discount_percent ??

        configPricing?.discountPercent ??

        0

    );

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
     * CREDIT BASE
     * -----------------------------------------------------
     */

    const creditBase =
        getModelResolutionBaseCredit(
            model,
            normalizedResolution
        );


    /*
     * -----------------------------------------------------
     * EXPLICIT FINAL PER RESOLUTION
     * -----------------------------------------------------
     */

    const explicitFinal =
        getExplicitResolutionFinalCredit(
            model,
            normalizedResolution
        );


    /*
     * Jika final per-resolution tersedia,
     * gunakan nilai tersebut.
     */

    if (
        explicitFinal !== null
    ) {

        return {

            resolution:
                normalizedResolution,

            credit_base:
                creditBase,

            discount_percent:
                getModelDiscountPercent(
                    model
                ),

            credit_final:
                explicitFinal

        };

    }


    /*
     * Tidak ada base credit.
     *
     * JANGAN mengambil:
     *
     * model.credit_cost
     * model.credit_final
     *
     * dan JANGAN membuat default 50.
     */

    if (
        creditBase === null
    ) {

        return null;

    }


    /*
     * -----------------------------------------------------
     * DISCOUNT
     * -----------------------------------------------------
     */

    const discountPercent =
        getModelDiscountPercent(
            model
        );


    /*
     * -----------------------------------------------------
     * CREDIT FINAL
     * -----------------------------------------------------
     */

    const creditFinal =
        creditBase -
        (
            creditBase *
            discountPercent /
            100
        );


    return {

        resolution:
            normalizedResolution,

        credit_base:
            creditBase,

        discount_percent:
            discountPercent,

        credit_final:
            Math.max(
                0,
                creditFinal
            )

    };

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
    element
) {

    if (
        !element
    ) {

        return;

    }


    element.hidden =
        false;

    element.style.display =
        "";

    element.style.visibility =
        "visible";

    element.style.opacity =
        "1";

}


/* =========================================================
   CLEAR LEGACY CREDIT DATA
   ---------------------------------------------------------
   Membersihkan nilai lama pada tombol sehingga angka
   hardcoded seperti "50" tidak menjadi sumber tampilan.

   TIDAK mengubah API generate.
   TIDAK mengubah account credit.
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
   UPDATE GENERATE BUTTON CREDIT
   ---------------------------------------------------------
   Target utama:
       #generateCreditValue

   Jika button mempunyai elemen credit terpisah,
   elemen tersebut juga disinkronkan.

   Angka 50 tidak pernah dijadikan fallback.
========================================================= */

function syncGenerateButtonCredit(
    generateButton,
    credit,
    resolution
) {

    if (
        !generateButton
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


        /*
         * Jangan menghapus struktur tombol.
         * Hanya bersihkan elemen credit jika memang
         * merupakan elemen khusus credit.
         */

        const creditElements =
            generateButton.querySelectorAll(
                ".generate-button-credit, [data-generate-credit], [data-credit-display]"
            );


        creditElements.forEach(
            element => {

                element.textContent =
                    "-- Credit";

            }
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


    const creditElements =
        generateButton.querySelectorAll(
            ".generate-button-credit, [data-generate-credit], [data-credit-display]"
        );


    creditElements.forEach(
        element => {

            element.textContent =
                `${formatted} Credit`;

        }
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


    const resolution =
        getSelectedResolution();


    console.debug(
        "[GEN-Z.AI][Generate UI] renderModelCredit()",
        {
            modelId:
                model?.model_id,

            resolution,

            credit480p:
                model?.credit_480p,

            credit720p:
                model?.credit_720p,

            credit1080p:
                model?.credit_1080p,

            discountPercent:
                model?.discount_percent,

            hasCreditValue:
                Boolean(
                    generateCreditValue
                )
        }
    );


    /*
     * -----------------------------------------------------
     * ELEMENT VALIDATION
     * -----------------------------------------------------
     */

    if (
        !generateCreditValue
    ) {

        console.error(
            "[GEN-Z.AI][Generate UI] #generateCreditValue tidak ditemukan."
        );

        return null;

    }


    /*
     * -----------------------------------------------------
     * CONTAINER
     * -----------------------------------------------------
     */

    if (
        generateCreditCost
    ) {

        forceVisible(
            generateCreditCost
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

        generateCreditValue.textContent =
            "-- Credit";


        generateCreditValue.dataset.credit =
            "";


        generateCreditValue.dataset.resolution =
            "";


        clearLegacyButtonCredit(
            generateButton
        );


        syncGenerateButtonCredit(
            generateButton,
            null,
            ""
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
     * CREDIT NOT AVAILABLE
     * -----------------------------------------------------
     */

    if (
        !pricing
    ) {

        generateCreditValue.textContent =
            "-- Credit";


        generateCreditValue.dataset.credit =
            "";


        generateCreditValue.dataset.resolution =
            resolution;


        syncGenerateButtonCredit(
            generateButton,
            null,
            resolution
        );


        return null;

    }


    const credit =
        Number(
            pricing.credit_final
        );


    /*
     * -----------------------------------------------------
     * VALIDATE
     * -----------------------------------------------------
     */

    if (
        !Number.isFinite(
            credit
        ) ||
        credit < 0
    ) {

        generateCreditValue.textContent =
            "-- Credit";


        generateCreditValue.dataset.credit =
            "";


        generateCreditValue.dataset.resolution =
            resolution;


        syncGenerateButtonCredit(
            generateButton,
            null,
            resolution
        );


        return null;

    }


    /*
     * -----------------------------------------------------
     * RENDER MODEL CREDIT
     * -----------------------------------------------------
     */

    const formatted =
        formatNumber(
            credit
        );


    generateCreditValue.textContent =
        `${formatted} Credit`;


    generateCreditValue.dataset.credit =
        String(
            credit
        );


    generateCreditValue.dataset.resolution =
        pricing.resolution;


    /*
     * -----------------------------------------------------
     * SYNC BUTTON
     * -----------------------------------------------------
     */

    syncGenerateButtonCredit(
        generateButton,
        credit,
        pricing.resolution
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


    /*
     * -----------------------------------------------------
     * CHANGE
     * -----------------------------------------------------
     */

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


    /*
     * -----------------------------------------------------
     * INPUT
     * -----------------------------------------------------
     */

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


    /*
     * -----------------------------------------------------
     * CLICK
     * -----------------------------------------------------
     *
     * Custom resolution selector kadang tidak
     * mengeluarkan change/input.
     */

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
                    "[data-resolution], [data-parameter='resolution'], [data-key='resolution'], [role='option'], [role='radio']"
                );


            if (
                !resolutionElement
            ) {

                return;

            }


            /*
             * Tunggu custom UI menyelesaikan perubahan
             * selected state terlebih dahulu.
             */

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

        console.error(
            "[GEN-Z.AI][Generate UI] #creditBadge tidak ditemukan."
        );

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

        console.error(
            "[GEN-Z.AI][Generate UI] #roleBadge tidak ditemukan."
        );

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


        /*
         * Credit tetap mengikuti resolusi.
         */
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
