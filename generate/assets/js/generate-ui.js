/* =========================================================
   GEN-Z.AI
   GENERATE UI MODULE
   ---------------------------------------------------------
   File:
   generate/assets/js/generate-ui.js

   Tanggung jawab:
   - Status message
   - Loading state
   - Button state
   - Page error
   - Model header
   - Role / account credit badge
   - Model credit cost
   - Generate card
   - Model selector
   - Reset UI

   Tidak bertanggung jawab:
   - Supabase auth
   - Query database
   - Model API request
   - Provider API
   - Parameter validation
   - Credit calculation
   - Polling
   - Menampilkan hasil video di halaman Generate

   SOURCE OF TRUTH:
   - Account credit : profile.credits
   - Model cost     : model.pricing.credit_final
   - Model identity : repository model registry
   - Admin config   : Supabase models
========================================================= */

import {
    getGenerateElements,
    getCurrentModel,
    getCurrentProfile,
    isModelReady
} from "./generate-state.js";


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
        String(value).trim();

    return result || fallback;
}


/* =========================================================
   FORMAT NUMBER
========================================================= */

function formatNumber(
    value
) {

    const numeric =
        Number(value);

    if (
        !Number.isFinite(numeric)
    ) {
        return String(value ?? "");
    }

    return new Intl.NumberFormat(
        "id-ID"
    ).format(numeric);
}


/* =========================================================
   DOM
========================================================= */

function elements() {

    return getGenerateElements();
}


/* =========================================================
   STATUS
========================================================= */

export function showStatus(
    message,
    type = "info"
) {

    const {
        statusEl
    } = elements();

    if (!statusEl) {
        return;
    }

    const text =
        safeString(message);

    statusEl.textContent =
        text;

    statusEl.className =
        "generate-status";

    if (type) {

        statusEl.classList.add(
            `is-${type}`
        );
    }

    statusEl.hidden =
        !text;
}


/* =========================================================
   HIDE STATUS
========================================================= */

export function hideStatus() {

    const {
        statusEl
    } = elements();

    if (!statusEl) {
        return;
    }

    statusEl.textContent =
        "";

    statusEl.hidden =
        true;

    statusEl.className =
        "generate-status";
}


/* =========================================================
   PAGE ERROR
========================================================= */

export function showPageError(
    message
) {

    const {
        pageErrorEl,
        pageErrorMessageEl
    } = elements();

    const text =
        safeString(
            message,
            "Terjadi kesalahan."
        );

    if (pageErrorMessageEl) {

        pageErrorMessageEl.textContent =
            text;
    }

    if (pageErrorEl) {

        pageErrorEl.hidden =
            false;
    }
}


/* =========================================================
   HIDE PAGE ERROR
========================================================= */

export function hidePageError() {

    const {
        pageErrorEl,
        pageErrorMessageEl
    } = elements();

    if (pageErrorMessageEl) {

        pageErrorMessageEl.textContent =
            "";
    }

    if (pageErrorEl) {

        pageErrorEl.hidden =
            true;
    }
}


/* =========================================================
   ERROR HANDLING
========================================================= */

export function showError(
    error,
    fallback =
        "Terjadi kesalahan saat memproses permintaan."
) {

    let message =
        fallback;

    if (
        typeof error ===
        "string"
    ) {

        message =
            error;

    } else if (
        error &&
        typeof error.message ===
        "string"
    ) {

        message =
            error.message;
    }

    message =
        String(message || fallback)
            .split("\n")
            .map(
                item =>
                    item.trim()
            )
            .filter(
                Boolean
            )
            .join("\n");

    showStatus(
        message,
        "error"
    );

    return message;
}


/* =========================================================
   MODEL CREDIT COST
   ---------------------------------------------------------
   SOURCE OF TRUTH:
       model.pricing.credit_final

   Fallback:
       model.pricing.credit_cost

   Tidak membuat angka credit sendiri.

   Jika kedua field tidak tersedia:
       tampilkan "-- Credit"
========================================================= */

export function renderModelCredit(
    model =
        getCurrentModel()
) {

    const {
        generateCreditCost,
        generateCreditValue
    } = elements();


    /*
     * HTML saat ini memakai:
     *
     * #generateCreditCost
     * #generateCreditValue
     *
     * Jika elemen tidak ada, jangan membuat DOM baru.
     */

    if (
        !generateCreditValue
    ) {

        return null;
    }


    /*
     * Ambil pricing dari model.
     */

    const pricing =
        model?.pricing;


    /*
     * FINAL CREDIT adalah harga yang digunakan
     * setelah discount.
     */

    let creditFinal =
        pricing?.credit_final;


    /*
     * Compatibility fallback:
     * jika credit_final tidak tersedia,
     * gunakan credit_cost.
     *
     * Tidak melakukan kalkulasi discount di frontend.
     */

    if (
        creditFinal === null ||
        creditFinal === undefined ||
        creditFinal === ""
    ) {

        creditFinal =
            pricing?.credit_cost;
    }


    /*
     * Tidak ada pricing.
     */

    if (
        creditFinal === null ||
        creditFinal === undefined ||
        creditFinal === ""
    ) {

        generateCreditValue.textContent =
            "-- Credit";


        generateCreditValue.dataset.credit =
            "";


        if (generateCreditCost) {

            generateCreditCost.hidden =
                false;
        }


        return null;
    }


    const numericCredit =
        Number(
            creditFinal
        );


    /*
     * Credit harus berupa angka.
     */

    if (
        !Number.isFinite(
            numericCredit
        )
    ) {

        generateCreditValue.textContent =
            "-- Credit";


        generateCreditValue.dataset.credit =
            "";


        if (generateCreditCost) {

            generateCreditCost.hidden =
                false;
        }


        return null;
    }


    /*
     * Render harga model.
     */

    const formatted =
        formatNumber(
            numericCredit
        );


    generateCreditValue.textContent =
        `${formatted} Credit`;


    generateCreditValue.dataset.credit =
        String(
            numericCredit
        );


    if (generateCreditCost) {

        generateCreditCost.hidden =
            false;
    }


    return numericCredit;
}


/* =========================================================
   GET MODEL CREDIT COST
========================================================= */

export function getModelCreditCost(
    model =
        getCurrentModel()
) {

    const pricing =
        model?.pricing;


    if (!pricing) {
        return null;
    }


    let value =
        pricing.credit_final;


    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        value =
            pricing.credit_cost;
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

        return null;
    }


    return numeric;
}


/* =========================================================
   LOADING
   ---------------------------------------------------------
   Jangan mengganti seluruh inner text button.

   Alasannya:
   #generateCreditValue berada DI DALAM button.

   Kita hanya mengganti label generate.
========================================================= */

export function setLoading(
    loading,
    message =
        "Sedang memproses..."
) {

    const {
        loadingEl,
        generateButton,
        resetButton,
        modelSelectEl
    } = elements();

    const active =
        Boolean(loading);


    /* -----------------------------------------------------
       LOADING INDICATOR
    ----------------------------------------------------- */

    if (loadingEl) {

        loadingEl.hidden =
            !active;

        if (active) {

            loadingEl.textContent =
                safeString(
                    message,
                    "Sedang memproses..."
                );
        }
    }


    /* -----------------------------------------------------
       GENERATE BUTTON
    ----------------------------------------------------- */

    if (generateButton) {

        if (active) {

            generateButton.disabled =
                true;

            generateButton.setAttribute(
                "aria-busy",
                "true"
            );


            /*
             * Jangan gunakan:
             *
             * generateButton.textContent =
             *     "Memproses...";
             *
             * Karena itu akan menghapus:
             *
             * #generateCreditCost
             * #generateCreditValue
             *
             * Kita hanya ubah elemen label.
             */

            const label =
                generateButton.querySelector(
                    ".btn-icon + span"
                );


            if (label) {

                /*
                 * Simpan teks asli sekali.
                 */

                if (
                    !label.dataset.originalText
                ) {

                    label.dataset.originalText =
                        label.textContent;
                }


                label.textContent =
                    "Memproses...";
            }


        } else {

            generateButton.disabled =
                !isModelReady();

            generateButton.removeAttribute(
                "aria-busy"
            );


            /*
             * Restore label tanpa mengganggu
             * credit cost.
             */

            const label =
                generateButton.querySelector(
                    ".btn-icon + span"
                );


            if (label) {

                const original =
                    label.dataset.originalText;


                if (original) {

                    label.textContent =
                        original;


                    delete label.dataset
                        .originalText;
                }
            }


            /*
             * Pastikan credit model tetap
             * tampil setelah loading selesai.
             */

            renderModelCredit(
                getCurrentModel()
            );
        }
    }


    /* -----------------------------------------------------
       MODEL SELECTOR
    ----------------------------------------------------- */

    if (modelSelectEl) {

        modelSelectEl.disabled =
            active;
    }


    /* -----------------------------------------------------
       RESET BUTTON
    ----------------------------------------------------- */

    if (resetButton) {

        resetButton.disabled =
            active;
    }
}


/* =========================================================
   GENERATE BUTTON
========================================================= */

export function enableGeneration() {

    const {
        generateButton
    } = elements();

    if (!generateButton) {
        return;
    }

    const ready =
        isModelReady();

    generateButton.disabled =
        !ready;

    generateButton.removeAttribute(
        "aria-busy"
    );


    /*
     * Credit model harus selalu sinkron
     * dengan model yang aktif.
     */

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

    if (!generateButton) {
        return;
    }

    generateButton.disabled =
        true;

    generateButton.removeAttribute(
        "aria-busy"
    );


    /*
     * Tetap tampilkan harga model.
     */

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

    if (!generateForm) {
        return;
    }

    const controls =
        generateForm.querySelectorAll(
            "input, textarea, select, button"
        );

    controls.forEach(
        control => {

            control.disabled =
                Boolean(disabled);
        }
    );
}


/* =========================================================
   MODEL HEADER
   ---------------------------------------------------------
   Source:
   - Repository model registry
   - Optional admin model configuration
========================================================= */

export function renderModelHeader(
    model =
        getCurrentModel()
) {

    const {
        modelNameEl,
        modelDescriptionEl,
        providerNameEl,
        modelMetaEl
    } = elements();


    /* -----------------------------------------------------
       NO MODEL
    ----------------------------------------------------- */

    if (!model) {

        if (modelNameEl) {

            modelNameEl.textContent =
                "Model belum dipilih";
        }

        if (modelDescriptionEl) {

            modelDescriptionEl.textContent =
                "";
        }

        if (providerNameEl) {

            providerNameEl.textContent =
                "";
        }

        if (modelMetaEl) {

            modelMetaEl.textContent =
                "";
        }


        /*
         * Tidak ada model berarti tidak ada
         * harga model untuk ditampilkan.
         */

        renderModelCredit(
            null
        );

        return null;
    }


    /* -----------------------------------------------------
       MODEL NAME
    ----------------------------------------------------- */

    const modelName =
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


    /* -----------------------------------------------------
       DESCRIPTION
    ----------------------------------------------------- */

    const description =
        safeString(
            model.description ||
            model.config?.description ||
            model.repository?.description,
            ""
        );


    /* -----------------------------------------------------
       PROVIDER
    ----------------------------------------------------- */

    const provider =
        safeString(
            model.provider_name ||
            model.providerName ||
            model.provider?.provider_name ||
            model.provider?.providerName ||
            model.provider?.name ||
            model.repository?.provider_name ||
            model.config?.providerName ||
            model.provider_id ||
            model.config?.providerId,
            "-"
        );


    /* -----------------------------------------------------
       MODEL ID
    ----------------------------------------------------- */

    const modelId =
        safeString(
            model.model_id ||
            model.config?.id ||
            model.id,
            ""
        );


    /* -----------------------------------------------------
       RENDER
    ----------------------------------------------------- */

    if (modelNameEl) {

        modelNameEl.textContent =
            modelName;
    }

    if (modelDescriptionEl) {

        modelDescriptionEl.textContent =
            description;
    }

    if (providerNameEl) {

        providerNameEl.textContent =
            provider;
    }

    if (modelMetaEl) {

        modelMetaEl.textContent =
            modelId
                ? `Model ID: ${modelId}`
                : "";
    }


    /*
     * =====================================================
     * MODEL CREDIT
     * =====================================================
     *
     * Ini adalah bagian yang sebelumnya hilang.
     */

    renderModelCredit(
        model
    );


    return {
        modelName,
        description,
        provider,
        modelId,
        credit:
            getModelCreditCost(
                model
            )
    };
}


/* =========================================================
   LEGACY RESULT API
   ---------------------------------------------------------
   Generate page sekarang TIDAK menampilkan hasil video.
========================================================= */

export function hideResult() {

    const {
        resultCard
    } = elements();

    if (!resultCard) {
        return;
    }

    resultCard.hidden =
        true;
}


/* =========================================================
   SHOW RESULT
   ---------------------------------------------------------
   Compatibility only.
========================================================= */

export function showResult() {

    const {
        resultCard
    } = elements();

    if (resultCard) {

        resultCard.hidden =
            true;
    }
}


/* =========================================================
   LEGACY RENDER RESULT
========================================================= */

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

        resultUrls: []
    };
}


/* =========================================================
   PROFILE NORMALIZATION
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
        String(
            profile.role ??
            ""
        )
            .trim()
            .toUpperCase();


    const rawCredits =
        profile.credits;

    let credits =
        null;


    if (
        rawCredits !== null &&
        rawCredits !== undefined &&
        rawCredits !== ""
    ) {

        const numeric =
            Number(
                rawCredits
            );

        if (
            Number.isFinite(
                numeric
            )
        ) {

            credits =
                numeric;

        } else {

            credits =
                rawCredits;
        }
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
        roleBadgeEl
    } = elements();

    if (!roleBadgeEl) {
        return;
    }


    const sourceProfile =
        profile ||
        getCurrentProfile();


    const normalized =
        normalizeProfile(
            sourceProfile
        );


    const role =
        normalized?.role ||
        "";


    roleBadgeEl.textContent =
        role;


    roleBadgeEl.hidden =
        !role;


    if (role) {

        roleBadgeEl.dataset.role =
            role.toLowerCase();

    } else {

        delete roleBadgeEl.dataset.role;
    }
}


/* =========================================================
   CREDIT BADGE
   ---------------------------------------------------------
   Source:
   Supabase profiles.credits
========================================================= */

export function renderCreditBadge(
    profile
) {

    const {
        creditBadgeEl
    } = elements();

    if (!creditBadgeEl) {
        return;
    }


    const sourceProfile =
        profile ||
        getCurrentProfile();


    const normalized =
        normalizeProfile(
            sourceProfile
        );


    const credits =
        normalized?.credits;


    if (
        credits === null ||
        credits === undefined ||
        credits === ""
    ) {

        creditBadgeEl.textContent =
            "";

        creditBadgeEl.hidden =
            true;

        return;
    }


    if (
        typeof credits ===
        "number"
    ) {

        creditBadgeEl.textContent =
            `Credit: ${formatNumber(
                credits
            )}`;

    } else {

        creditBadgeEl.textContent =
            `Credit: ${safeString(
                credits
            )}`;
    }


    creditBadgeEl.hidden =
        false;
}


/* =========================================================
   AUTH BADGES
========================================================= */

export function renderAuthBadges(
    profile
) {

    const sourceProfile =
        profile ||
        getCurrentProfile();


    renderRoleBadge(
        sourceProfile
    );


    renderCreditBadge(
        sourceProfile
    );


    return sourceProfile || null;
}


/* =========================================================
   GENERATE CARD
========================================================= */

export function showGenerateCard() {

    const {
        generateCard
    } = elements();

    if (generateCard) {

        generateCard.hidden =
            false;
    }
}


/* =========================================================
   HIDE GENERATE CARD
========================================================= */

export function hideGenerateCard() {

    const {
        generateCard
    } = elements();

    if (generateCard) {

        generateCard.hidden =
            true;
    }
}


/* =========================================================
   MODEL SELECTOR
========================================================= */

export function showModelSelector() {

    const {
        modelSelectorEl
    } = elements();

    if (modelSelectorEl) {

        modelSelectorEl.hidden =
            false;
    }
}


/* =========================================================
   HIDE MODEL SELECTOR
========================================================= */

export function hideModelSelector() {

    const {
        modelSelectorEl
    } = elements();

    if (modelSelectorEl) {

        modelSelectorEl.hidden =
            true;
    }
}


/* =========================================================
   RESET RESULT UI
========================================================= */

export function resetResultUI() {

    hideResult();


    const {
        resultModel,
        resultProvider,
        resultTaskId
    } = elements();


    if (resultModel) {

        resultModel.textContent =
            "";
    }


    if (resultProvider) {

        resultProvider.textContent =
            "";
    }


    if (resultTaskId) {

        resultTaskId.textContent =
            "";
    }


    const resultMedia =
        document.getElementById(
            "resultMedia"
        );


    if (resultMedia) {

        resultMedia.innerHTML =
            "";
    }
}


/* =========================================================
   RESET STATUS UI
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
     * Account OWNER + account credit.
     */

    renderAuthBadges(
        getCurrentProfile()
    );


    /*
     * Model identity + provider +
     * model credit cost.
     */

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
   FOCUS FIRST INVALID FIELD
========================================================= */

export function focusFirstInvalidField() {

    const {
        generateForm
    } = elements();

    if (!generateForm) {
        return false;
    }


    const invalid =
        generateForm.querySelector(
            ":invalid"
        );


    if (!invalid) {
        return false;
    }


    try {

        invalid.focus();

    } catch {

        /* Browser tertentu dapat menolak focus. */
    }


    return true;
}


/* =========================================================
   SCROLL TO ERROR
========================================================= */

export function scrollToError() {

    const {
        pageErrorEl,
        statusEl
    } = elements();


    const target =
        pageErrorEl &&
        !pageErrorEl.hidden
            ? pageErrorEl
            : statusEl &&
              !statusEl.hidden
                ? statusEl
                : null;


    if (!target) {
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
   SUCCESS STATE
========================================================= */

export function showSuccess(
    message =
        "Generate berhasil diproses."
) {

    showStatus(
        message,
        "success"
    );
}


/* =========================================================
   READY STATE
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
     * Pastikan model credit tampil
     * ketika model sudah siap.
     */

    renderModelCredit(
        getCurrentModel()
    );


    enableGeneration();
}


/* =========================================================
   BUSY STATE
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
   FINISH REQUEST STATE
========================================================= */

export function finishRequest() {

    setLoading(
        false
    );


    /*
     * Refresh model credit setelah request.
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
