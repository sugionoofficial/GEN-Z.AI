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

   MODEL:
       model.pricing.credit_final
       model.credit_final
       model.pricing.credit_cost
       model.credit_cost

   PENTING:
   ---------------------------------------------------------
   ACCOUNT CREDIT dan MODEL CREDIT adalah dua data
   yang berbeda.

   Account Credit:
       #creditBadge

   Model Credit:
       #generateCreditValue

   Tidak melakukan kalkulasi discount di frontend.
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
       model.credit_final
       model.credit_cost
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
   GET MODEL CREDIT
   ---------------------------------------------------------
   PRIORITAS:

   1. model.pricing.credit_final
   2. model.credit_final
   3. model.pricing.credit_cost
   4. model.credit_cost

   Tidak menghitung discount di frontend.
========================================================= */

export function getModelCreditCost(
    model = getCurrentModel()
) {

    if (
        !model ||
        typeof model !==
            "object"
    ) {

        return null;

    }


    const candidates = [

        model?.pricing?.credit_final,

        model?.credit_final,

        model?.pricing?.credit_cost,

        model?.credit_cost

    ];


    for (
        const candidate
        of candidates
    ) {

        /*
         * 0 adalah nilai valid.
         */
        if (
            candidate === null ||
            candidate === undefined ||
            candidate === ""
        ) {

            continue;

        }


        const numeric =
            Number(
                candidate
            );


        if (
            Number.isFinite(
                numeric
            )
        ) {

            return numeric;

        }

    }


    return null;

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
       ◆ 20 Credit

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

            pricing:
                model?.pricing,

            creditFinal:
                model?.credit_final,

            creditCost:
                model?.credit_cost
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

    const credit =
        getModelCreditCost(
            model
        );


    /*
     * -----------------------------------------------------
     * CREDIT BELUM TERSEDIA
     * -----------------------------------------------------
     */

    if (
        credit === null
    ) {

        generateCreditValue.textContent =
            "-- Credit";

        generateCreditValue.dataset.credit =
            "";


        if (
            generateButton
        ) {

            delete generateButton.dataset.modelCredit;

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


    if (
        generateButton
    ) {

        generateButton.dataset.modelCredit =
            String(
                credit
            );

    }


    return credit;

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

        /*
         * Attribute hidden.
         */
        loading.hidden =
            !isActive;


        /*
         * Defensive display state.
         *
         * CSS .loading tidak boleh mengalahkan
         * kondisi inactive.
         */
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


        /*
         * Update text hanya ketika loading aktif.
         */
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


        /*
         * Cari label utama tombol.
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

    /*
     * Loading tidak boleh menghapus:
     *
     * - role
     * - account credit
     */

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


    /*
     * Hanya model yang menentukan kesiapan
     * tombol dari sisi UI module.
     *
     * generate-app.js tetap bertanggung jawab
     * memastikan auth/profile juga READY.
     */
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


    /*
     * Auth badge tidak boleh ikut berubah.
     */
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


    /*
     * Credit model tetap boleh ditampilkan
     * walaupun tombol disabled.
     */
    renderModelCredit(
        getCurrentModel()
    );


    /*
     * Role + account credit tetap.
     */
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


    /*
     * Setelah semua control disabled/enabled,
     * pastikan generate credit tetap terlihat.
     */
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


        /*
         * Auth badge tetap.
         */
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


    /*
     * Auth badge tidak boleh tertimpa
     * ketika model header dirender.
     */
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


    /*
     * Jangan menghapus badge.
     */
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


    /*
     * Model credit + account credit
     * tetap dipulihkan setelah reset.
     */
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


    /*
     * Account:
     */
    renderAuthBadges(
        getCurrentProfile()
    );


    /*
     * Model:
     */
    renderModelHeader(
        getCurrentModel()
    );


    /*
     * Generate:
     */
    if (
        isModelReady()
    ) {

        enableGeneration();

    } else {

        disableGeneration();

    }


    /*
     * Final defensive render.
     */
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


    /*
     * Account credit tetap tampil.
     */
    renderAuthBadges(
        getCurrentProfile()
    );


    /*
     * Model credit tetap tampil.
     */
    renderModelCredit(
        getCurrentModel()
    );

}


/* =========================================================
   READY
   ---------------------------------------------------------
   PENTING:
   Jangan selalu enable button hanya karena
   fungsi ini dipanggil.

   generate-app.js adalah pemilik keputusan
   apakah AUTH + PROFILE + MODEL sudah siap.
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


    /*
     * Badge account.
     */
    renderAuthBadges(
        getCurrentProfile()
    );


    /*
     * Model credit.
     */
    renderModelCredit(
        getCurrentModel()
    );


    /*
     * Hanya enable jika model benar-benar ready.
     *
     * Auth/profile tetap dikontrol
     * oleh app module.
     */
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


    /*
     * Account badge sebelum loading.
     */
    renderAuthBadges(
        getCurrentProfile()
    );


    /*
     * Model credit sebelum loading.
     */
    renderModelCredit(
        getCurrentModel()
    );


    setLoading(
        true,
        message
    );


    /*
     * Defensive render setelah setLoading.
     */
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


    /*
     * Account credit:
     * tetap dari profile.
     */
    renderAuthBadges(
        getCurrentProfile()
    );


    /*
     * Model credit:
     * dari model.
     */
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


    /*
     * Final DOM sync.
     */
    renderAuthBadges(
        getCurrentProfile()
    );


    renderModelCredit(
        getCurrentModel()
    );

}


/* =========================================================
   INITIAL LOADING STATE
   ---------------------------------------------------------
   PENTING:

   Ketika modul UI pertama kali dimuat,
   indikator processing HARUS mati.

   Ini hanya mengatur #loading.
   Tidak menyentuh:
       - Owner
       - Account Credit
       - Model Credit
       - Dynamic Parameters
       - Model
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
   ---------------------------------------------------------
   DOM harus sudah tersedia sebelum mengambil element.
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


scheduleInitialLoadingState();


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
