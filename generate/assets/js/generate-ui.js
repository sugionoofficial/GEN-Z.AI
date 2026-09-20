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
   - Render account OWNER
   - Render account CREDIT
   - Loading state
   - Error state
   - Generate button state
   - Reset UI

   CATATAN PENTING:
   ---------------------------------------------------------
   ACCOUNT CREDIT:
       profile.credits

   MODEL CREDIT:
       model.pricing.credit_final
       fallback:
       model.credit_final
       model.credit_cost

   Model credit TIDAK dihitung dari frontend.
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
            maximumFractionDigits: 2
        }
    ).format(
        number
    );

}


/* =========================================================
   GET MODEL CREDIT
   ---------------------------------------------------------
   PRIORITY:

   1. model.pricing.credit_final
   2. model.credit_final
   3. model.pricing.credit_cost
   4. model.credit_cost

   Tidak melakukan kalkulasi discount.
   Backend adalah source of truth.
========================================================= */

export function getModelCreditCost(
    model = getCurrentModel()
) {

    if (
        !model ||
        typeof model !== "object"
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
   RENDER MODEL CREDIT
========================================================= */

export function renderModelCredit(
    model = getCurrentModel()
) {

    const {
        generateCreditCost,
        generateCreditValue
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
     * ELEMENT TIDAK ADA
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
     * AMBIL CREDIT
     * -----------------------------------------------------
     */

    const credit =
        getModelCreditCost(
            model
        );


    /*
     * -----------------------------------------------------
     * CONTAINER SELALU DITAMPILKAN
     * -----------------------------------------------------
     */

    if (
        generateCreditCost
    ) {

        generateCreditCost.hidden =
            false;

        generateCreditCost.style.display =
            "inline-flex";

    }


    /*
     * -----------------------------------------------------
     * CREDIT TIDAK TERSEDIA
     * -----------------------------------------------------
     */

    if (
        credit === null
    ) {

        generateCreditValue.textContent =
            "-- Credit";

        generateCreditValue.dataset.credit =
            "";


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


    /*
     * Simpan juga pada button agar
     * mudah diperiksa dari browser.
     */

    const {
        generateButton
    } = elements();


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
   STATUS
========================================================= */

export function showStatus(
    message,
    type = "info"
) {

    const {
        status
    } = elements();


    if (!status) {

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

}


export function hideStatus() {

    const {
        status
    } = elements();


    if (!status) {

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
    error
) {

    const message =
        error instanceof Error
            ? error.message
            : safeString(
                error,
                "Terjadi kesalahan."
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
    message = "Memproses..."
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


    /*
     * -----------------------------------------------------
     * LOADING INDICATOR
     * -----------------------------------------------------
     */

    if (
        loading
    ) {

        loading.hidden =
            !isActive;

        if (
            isActive
        ) {

            loading.setAttribute(
                "aria-live",
                "polite"
            );

        }

    }


    /*
     * -----------------------------------------------------
     * GENERATE BUTTON
     * -----------------------------------------------------
     */

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
         * Jangan menggunakan:
         *
         * generateButton.textContent = ...
         *
         * karena itu akan menghapus
         * #generateCreditValue.
         */

        const label =
            generateButton.querySelector(
                ".btn-icon + span"
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
         * Credit model tetap render.
         */

        renderModelCredit(
            getCurrentModel()
        );

    }


    /*
     * -----------------------------------------------------
     * MODEL SELECT
     * -----------------------------------------------------
     */

    if (
        modelSelect
    ) {

        modelSelect.disabled =
            isActive;

    }


    /*
     * -----------------------------------------------------
     * RESET
     * -----------------------------------------------------
     */

    if (
        resetButton
    ) {

        resetButton.disabled =
            isActive;

    }

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
   ---------------------------------------------------------
   Generate page tidak menampilkan video.
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
   PROFILE NORMALIZER
========================================================= */

function normalizeProfile(
    profile
) {

    if (
        !profile ||
        typeof profile !==
            "object"
    ) {

        return null;

    }


    const role =
        safeString(
            profile.role
        ).toUpperCase();


    let credits =
        null;


    if (
        profile.credits !== null &&
        profile.credits !== undefined &&
        profile.credits !== ""
    ) {

        const numeric =
            Number(
                profile.credits
            );


        credits =
            Number.isFinite(
                numeric
            )
                ? numeric
                : profile.credits;

    }


    return {

        role,

        credits

    };

}


/* =========================================================
   ROLE BADGE
========================================================= */

export function renderRoleBadge(
    profile
) {

    const {
        roleBadge
    } = elements();


    if (
        !roleBadge
    ) {

        return;

    }


    const source =
        profile ||
        getCurrentProfile();


    const normalized =
        normalizeProfile(
            source
        );


    const role =
        normalized?.role ||
        "";


    roleBadge.textContent =
        role;


    roleBadge.hidden =
        !role;


    if (
        role
    ) {

        roleBadge.dataset.role =
            role.toLowerCase();

    } else {

        delete roleBadge.dataset.role;

    }

}


/* =========================================================
   ACCOUNT CREDIT BADGE
========================================================= */

export function renderCreditBadge(
    profile
) {

    const {
        creditBadge
    } = elements();


    if (
        !creditBadge
    ) {

        return;

    }


    const source =
        profile ||
        getCurrentProfile();


    const normalized =
        normalizeProfile(
            source
        );


    const credits =
        normalized?.credits;


    if (
        credits === null ||
        credits === undefined ||
        credits === ""
    ) {

        creditBadge.textContent =
            "";

        creditBadge.hidden =
            true;

        return;

    }


    creditBadge.textContent =
        typeof credits === "number"

            ? `Credit: ${formatNumber(credits)}`

            : `Credit: ${safeString(credits)}`;


    creditBadge.hidden =
        false;

}


/* =========================================================
   AUTH BADGES
========================================================= */

export function renderAuthBadges(
    profile
) {

    const source =
        profile ||
        getCurrentProfile();


    renderRoleBadge(
        source
    );


    renderCreditBadge(
        source
    );


    return source || null;

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


    renderModelCredit(
        getCurrentModel()
    );


    enableGeneration();

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

        setLoading,

        enableGeneration,

        disableGeneration,

        setFormDisabled,

        renderModelHeader,

        hideResult,

        showResult,

        renderResult,

        renderRoleBadge,

        renderCreditBadge,

        renderAuthBadges,

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
