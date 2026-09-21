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

   SUMBER DATA:
   ---------------------------------------------------------
   ACCOUNT:
       profile.credits

   ROLE:
       profile.role

   MODEL CREDIT:
       credit berdasarkan RESOLUSI YANG DIPILIH

       480p  -> credit_480p
       720p  -> credit_720p
       1080p -> credit_1080p

       kemudian:
       credit_final =
           credit_base -
           (credit_base * discount_percent / 100)

   PENTING:
   ---------------------------------------------------------
   ACCOUNT CREDIT dan MODEL CREDIT adalah dua data
   yang berbeda.

   Account Credit:
       #creditBadge

   Model Credit:
       #generateCreditValue

   Model Credit TIDAK menggunakan:
       - credit_cost legacy
       - credit_final global yang tidak terkait resolusi

   Credit yang tampil harus sesuai dengan resolusi aktif.
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
   ---------------------------------------------------------
   SOURCE OF TRUTH:
       profiles.credits

   0 adalah nilai VALID.

   null / undefined / empty:
       credit belum tersedia.

   Tidak pernah mengambil:
       model credit
       localStorage
       navigation credit
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
   ---------------------------------------------------------
   Nilai yang diperbolehkan:

       480p
       720p
       1080p
========================================================= */

function normalizeResolution(
    value
) {

    const normalized =
        String(
            value ?? ""
        )
            .trim()
            .toLowerCase();


    if (
        normalized === "480p"
    ) {

        return "480p";

    }


    if (
        normalized === "720p"
    ) {

        return "720p";

    }


    if (
        normalized === "1080p"
    ) {

        return "1080p";

    }


    return "";

}


/* =========================================================
   GET SELECTED RESOLUTION
   ---------------------------------------------------------
   Mencari control resolution tanpa mengasumsikan satu
   struktur HTML tertentu.

   Didukung:
       name="resolution"
       id="resolution"
       data-parameter="resolution"
       id/name yang mengandung "resolution"
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


    const candidates = [

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
            'select[id*="resolution" i]'
        ),

        generateForm.querySelector(
            'select[name*="resolution" i]'
        ),

        generateForm.querySelector(
            'input[id*="resolution" i]'
        ),

        generateForm.querySelector(
            'input[name*="resolution" i]'
        )

    ];


    const control =
        candidates.find(
            element =>
                Boolean(
                    element
                )
        );


    if (
        !control
    ) {

        return "";

    }


    return normalizeResolution(
        control.value
    );

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
   Mendukung struktur model yang sudah ada maupun nested
   pricing object.

   Contoh:

       model.credit_480p

   atau:

       model.pricing.credit_480p

   atau:

       model.pricing.credit480p
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


    switch (
        resolution
    ) {

        case "480p":

            return normalizeCreditValue(

                model?.credit_480p ??

                model?.credit480p ??

                model?.pricing?.credit_480p ??

                model?.pricing?.credit480p ??

                model?.config?.credit_480p ??

                model?.config?.pricing?.credit_480p

            );


        case "720p":

            return normalizeCreditValue(

                model?.credit_720p ??

                model?.credit720p ??

                model?.pricing?.credit_720p ??

                model?.pricing?.credit720p ??

                model?.config?.credit_720p ??

                model?.config?.pricing?.credit_720p

            );


        case "1080p":

            return normalizeCreditValue(

                model?.credit_1080p ??

                model?.credit1080p ??

                model?.pricing?.credit_1080p ??

                model?.pricing?.credit1080p ??

                model?.config?.credit_1080p ??

                model?.config?.pricing?.credit_1080p

            );


        default:

            return null;

    }

}


/* =========================================================
   READ EXPLICIT FINAL CREDIT
   ---------------------------------------------------------
   Jika backend / models-data sudah mengirim Credit Final
   khusus per resolusi, gunakan nilai tersebut langsung.

   Didukung beberapa nama agar kompatibel dengan struktur
   data yang mungkin sudah digunakan modul lain.

   PRIORITAS:

       credit_final_480p
       credit_final_720p
       credit_final_1080p

   kemudian:

       credit480pFinal
       credit720pFinal
       credit1080pFinal

   kemudian nested pricing/config.
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


    let candidates = [];


    switch (
        resolution
    ) {

        case "480p":

            candidates = [

                model?.credit_final_480p,

                model?.creditFinal480p,

                model?.credit480pFinal,

                model?.pricing?.credit_final_480p,

                model?.pricing?.creditFinal480p,

                model?.pricing?.credit480pFinal,

                model?.config?.credit_final_480p,

                model?.config?.creditFinal480p

            ];

            break;


        case "720p":

            candidates = [

                model?.credit_final_720p,

                model?.creditFinal720p,

                model?.credit720pFinal,

                model?.pricing?.credit_final_720p,

                model?.pricing?.creditFinal720p,

                model?.pricing?.credit720pFinal,

                model?.config?.credit_final_720p,

                model?.config?.creditFinal720p

            ];

            break;


        case "1080p":

            candidates = [

                model?.credit_final_1080p,

                model?.creditFinal1080p,

                model?.credit1080pFinal,

                model?.pricing?.credit_final_1080p,

                model?.pricing?.creditFinal1080p,

                model?.pricing?.credit1080pFinal,

                model?.config?.credit_final_1080p,

                model?.config?.creditFinal1080p

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


    return normalizeDiscountPercent(

        model?.discount_percent ??

        model?.discountPercent ??

        model?.pricing?.discount_percent ??

        model?.pricing?.discountPercent ??

        model?.config?.discount_percent ??

        model?.config?.pricing?.discount_percent ??

        0

    );

}


/* =========================================================
   RESOLVE MODEL CREDIT
   ---------------------------------------------------------
   SUMBER KEBIJAKAN:

       Credit awal:
           credit_480p
           credit_720p
           credit_1080p

       Diskon:
           discount_percent

       Credit Final:
           credit awal - diskon

   Jika Credit Final per-resolusi sudah tersedia dari
   backend/model data, nilai tersebut diprioritaskan.

   TIDAK menggunakan:
       credit_cost legacy
       credit_final global

   Return:

       {
           resolution,
           credit_base,
           discount_percent,
           credit_final
       }
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
     * Tidak boleh menggunakan credit global sebagai
     * fallback karena setiap resolusi mempunyai harga
     * sendiri.
     */

    if (
        creditBase === null
    ) {

        /*
         * Backend mungkin sudah mengirim Credit Final
         * per resolusi tanpa credit base.
         */
        const explicitFinal =
            getExplicitResolutionFinalCredit(
                model,
                normalizedResolution
            );


        if (
            explicitFinal === null
        ) {

            return null;

        }


        return {

            resolution:
                normalizedResolution,

            credit_base:
                null,

            discount_percent:
                getModelDiscountPercent(
                    model
                ),

            credit_final:
                explicitFinal

        };

    }


    /*
     * -----------------------------------------------------
     * EXPLICIT FINAL
     * -----------------------------------------------------
     *
     * Jika model data sudah memiliki final per resolusi,
     * gunakan itu agar UI mengikuti hasil perhitungan
     * sumber data yang sama.
     */

    const explicitFinal =
        getExplicitResolutionFinalCredit(
            model,
            normalizedResolution
        );


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
   GET MODEL CREDIT
   ---------------------------------------------------------
   Credit yang dipakai oleh tombol Generate.

   PENTING:
   ---------------------------------------------------------
   Nilai ini SELALU bergantung pada resolusi aktif.

   Tidak ada fallback ke:

       model.credit_final
       model.credit_cost
       model.pricing.credit_cost

   karena semua itu dapat menyebabkan satu harga
   digunakan untuk seluruh resolusi.
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
   FORCE ELEMENT VISIBLE
   ---------------------------------------------------------
   Dipakai untuk badge/credit agar tidak kalah oleh
   hidden attribute atau inline style lama.
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
   RENDER MODEL CREDIT
   ---------------------------------------------------------
   Target:
       #generateCreditCost
       #generateCreditValue

   Contoh:
       ◆ 8,1 Credit

   Credit akan mengikuti resolusi yang sedang dipilih.

   Tidak menyentuh:
       #creditBadge
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
            hasContainer:
                Boolean(
                    generateCreditCost
                ),

            hasValue:
                Boolean(
                    generateCreditValue
                ),

            modelId:
                model?.model_id,

            modelName:
                model?.model_name,

            resolution,

            pricing:
                model?.pricing,

            credit480p:
                model?.credit_480p,

            credit720p:
                model?.credit_720p,

            credit1080p:
                model?.credit_1080p,

            discountPercent:
                model?.discount_percent

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
     * GET CREDIT
     * -----------------------------------------------------
     */

    const pricing =
        resolveModelCredit(
            model,
            resolution
        );


    /*
     * -----------------------------------------------------
     * CREDIT BELUM TERSEDIA
     * -----------------------------------------------------
     */

    if (
        !pricing
    ) {

        generateCreditValue.textContent =
            resolution
                ? "-- Credit"
                : "-- Credit";


        generateCreditValue.dataset.credit =
            "";


        generateCreditValue.dataset.resolution =
            resolution;


        if (
            generateButton
        ) {

            delete generateButton.dataset.modelCredit;

            delete generateButton.dataset.creditResolution;

        }


        return null;

    }


    const credit =
        pricing.credit_final;


    /*
     * -----------------------------------------------------
     * VALIDATE FINAL CREDIT
     * -----------------------------------------------------
     */

    if (
        credit === null ||
        credit === undefined ||
        !Number.isFinite(
            Number(
                credit
            )
        )
    ) {

        generateCreditValue.textContent =
            "-- Credit";

        generateCreditValue.dataset.credit =
            "";

        if (
            generateButton
        ) {

            delete generateButton.dataset.modelCredit;

            delete generateButton.dataset.creditResolution;

        }


        return null;

    }


    /*
     * -----------------------------------------------------
     * CREDIT TERSEDIA
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


    if (
        generateButton
    ) {

        generateButton.dataset.modelCredit =
            String(
                credit
            );

        generateButton.dataset.creditResolution =
            pricing.resolution;

    }


    return credit;

}


/* =========================================================
   BIND RESOLUTION CREDIT SYNC
   ---------------------------------------------------------
   Ketika user mengganti resolusi, Credit Final pada tombol
   Generate langsung diperbarui.

   Tidak membuat listener ganda.
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
                !target
            ) {

                return;

            }


            const name =
                String(
                    target.name || ""
                )
                    .trim()
                    .toLowerCase();


            const id =
                String(
                    target.id || ""
                )
                    .trim()
                    .toLowerCase();


            const parameter =
                String(
                    target.dataset?.parameter || ""
                )
                    .trim()
                    .toLowerCase();


            const isResolutionControl =
                name === "resolution" ||

                id === "resolution" ||

                parameter === "resolution" ||

                name.includes(
                    "resolution"
                ) ||

                id.includes(
                    "resolution"
                );


            if (
                !isResolutionControl
            ) {

                return;

            }


            renderModelCredit(
                getCurrentModel()
            );

        }
    );


    /*
     * Beberapa UI menggunakan custom event ketika
     * parameter berubah tanpa native change event.
     */

    generateForm.addEventListener(
        "input",
        event => {

            const target =
                event.target;


            if (
                !target
            ) {

                return;

            }


            const name =
                String(
                    target.name || ""
                )
                    .trim()
                    .toLowerCase();


            const id =
                String(
                    target.id || ""
                )
                    .trim()
                    .toLowerCase();


            if (
                !name.includes(
                    "resolution"
                ) &&
                !id.includes(
                    "resolution"
                )
            ) {

                return;

            }


            renderModelCredit(
                getCurrentModel()
            );

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

            /*
             * Model/parameter form dapat dirender
             * setelah module pertama kali dimuat.
             * Coba bind sekali lagi pada frame berikutnya.
             */
            if (
                typeof requestAnimationFrame ===
                "function"
            ) {

                requestAnimationFrame(
                    () => {

                        bindResolutionCreditSync();

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
   ---------------------------------------------------------
   Target:
       #creditBadge

   SOURCE:
       profiles.credits

   TIDAK membaca current model.
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


    /*
     * Profile/credit belum tersedia.
     */
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


    /*
     * Numeric credit.
     *
     * 0 tetap tampil.
     */
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


    /*
     * Role belum tersedia.
     */
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
   ---------------------------------------------------------
   Satu pintu untuk:

   - Role
   - Account Credit

   Tidak mengambil:
   - model credit
   - localStorage
   - navigation credit
========================================================= */

export function renderAuthBadges(
    profile = getCurrentProfile()
) {

    /*
     * Jangan gunakan data model sebagai fallback.
     */
    if (
        !profile ||
        typeof profile !==
            "object"
    ) {

        console.warn(
            "[GEN-Z.AI][Generate UI] Profile tidak tersedia untuk auth badge."
        );


        /*
         * Jangan mengarang role.
         */
        renderRoleBadge(
            null
        );


        /*
         * Jangan mengarang credit.
         */
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


    console.debug(
        "[GEN-Z.AI][Generate UI] Auth badges rendered:",
        {
            role:
                profile.role,

            credits:
                profile.credits
        }
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
   ---------------------------------------------------------
   INACTIVE:
       #loading hidden
       display:none
       visibility:hidden
       opacity:0

   ACTIVE:
       #loading visible
       display:inline-flex
       visibility:visible
       opacity:1

   Tujuan:
   Indikator "Memproses..." TIDAK BOLEH muncul
   sebelum tombol Generate diproses.
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


    /* =====================================================
       LOADING INDICATOR
    ====================================================== */

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


    /* =====================================================
       GENERATE BUTTON
    ====================================================== */

    if (
        generateButton
    ) {

        generateButton.setAttribute(
            "aria-busy",
            String(
                isActive
            )
        );


        /*
         * JANGAN:
         *
         * generateButton.textContent = ...
         *
         * karena akan menghapus:
         *
         * #generateCreditValue
         */

        const labelCandidates = [

            generateButton.querySelector(
                ".btn-icon + span:not(.generate-button-credit)"
            ),

            generateButton.querySelector(
                ".generate-button-label"
            ),

            generateButton.querySelector(
                ".btn-label"
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
         * Model credit tetap dirender.
         */
        renderModelCredit(
            getCurrentModel()
        );

    }


    /* =====================================================
       MODEL SELECT
    ====================================================== */

    if (
        modelSelect
    ) {

        modelSelect.disabled =
            isActive;

    }


    /* =====================================================
       RESET BUTTON
    ====================================================== */

    if (
        resetButton
    ) {

        resetButton.disabled =
            isActive;

    }


    /* =====================================================
       ACCOUNT BADGE
    ====================================================== */

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


    /*
     * -----------------------------------------------------
     * NO MODEL
     * -----------------------------------------------------
     */

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


    /*
     * -----------------------------------------------------
     * MODEL NAME
     * -----------------------------------------------------
     */

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


    /*
     * -----------------------------------------------------
     * DESCRIPTION
     * -----------------------------------------------------
     */

    const description =
        safeString(

            model.description ||

            model.config?.description ||

            model.repository?.description,

            ""

        );


    /*
     * -----------------------------------------------------
     * PROVIDER
     * -----------------------------------------------------
 */

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


    /*
     * -----------------------------------------------------
     * MODEL ID
     * -----------------------------------------------------
     */

    const modelId =
        safeString(

            model.model_id ||

            model.config?.id ||

            model.id,

            ""

        );


    /*
     * -----------------------------------------------------
     * RENDER HEADER
     * -----------------------------------------------------
     */

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


    /*
     * -----------------------------------------------------
     * MODEL CREDIT
     * -----------------------------------------------------
     */

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


    renderAuthBadges(
        getCurrentProfile()
    );


    renderModelCredit(
        getCurrentModel()
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


    renderAuthBadges(
        getCurrentProfile()
    );


    renderModelCredit(
        getCurrentModel()
    );

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
