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
   - Result card
   - Model header
   - Role / credit badge
   - Reset UI
   - Error display

   Tidak bertanggung jawab:
   - Supabase auth
   - Query database
   - Model API request
   - Provider API
   - Parameter validation
   - Credit calculation

   PENTING:
   - Role dan credit hanya berasal dari profile
   - Tidak menggunakan nilai hardcoded
   - Tidak mempertahankan USER / 0 dari HTML
   - Tidak menggunakan generate-utils.js
========================================================= */

import {
    getGenerateElements,
    getCurrentModel,
    getCurrentProfile,
    isModelReady
} from "./generate-state.js";


/* =========================================================
   LOCAL HELPERS
   ---------------------------------------------------------
   generate-utils.js tidak tersedia di repository.
   Fungsi yang diperlukan dibuat lokal.
========================================================= */


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
   FORMAT NUMBER
========================================================= */

function formatNumber(
    value
) {

    const numeric =
        Number(
            value
        );


    if (
        !Number.isFinite(
            numeric
        )
    ) {

        return String(
            value ?? ""
        );

    }


    return new Intl.NumberFormat(
        "id-ID"
    ).format(
        numeric
    );

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


    statusEl.textContent =
        String(
            message || ""
        );


    statusEl.className =
        "generate-status";


    if (type) {

        statusEl.classList.add(
            `is-${type}`
        );

    }


    statusEl.hidden =
        !message;

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
        String(
            message ||
            "Terjadi kesalahan."
        );


    if (
        pageErrorMessageEl
    ) {

        pageErrorMessageEl.textContent =
            text;

    }


    if (
        pageErrorEl
    ) {

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


    if (
        pageErrorMessageEl
    ) {

        pageErrorMessageEl.textContent =
            "";

    }


    if (
        pageErrorEl
    ) {

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
        message
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
   LOADING
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
        Boolean(
            loading
        );


    if (
        loadingEl
    ) {

        loadingEl.hidden =
            !active;


        if (active) {

            loadingEl.textContent =
                message;

        }

    }


    if (
        generateButton
    ) {

        generateButton.disabled =
            active;


        generateButton.setAttribute(
            "aria-busy",
            String(
                active
            )
        );


        if (active) {

            /*
             * Simpan teks asli sekali saja.
             */

            if (
                !generateButton.dataset
                    .originalText
            ) {

                generateButton.dataset
                    .originalText =
                    generateButton.textContent;

            }


            generateButton.textContent =
                "Memproses...";

        } else {

            const original =
                generateButton
                    .dataset
                    .originalText;


            if (original) {

                generateButton.textContent =
                    original;


                delete generateButton
                    .dataset
                    .originalText;

            }

        }

    }


    if (
        modelSelectEl
    ) {

        modelSelectEl.disabled =
            active;

    }


    if (
        resetButton
    ) {

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


    if (
        !generateButton
    ) {
        return;
    }


    generateButton.disabled =
        !isModelReady();


    generateButton.removeAttribute(
        "aria-busy"
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
    model =
        getCurrentModel()
) {

    const {
        modelNameEl,
        modelDescriptionEl,
        providerNameEl,
        modelMetaEl
    } = elements();


    if (!model) {

        if (
            modelNameEl
        ) {

            modelNameEl.textContent =
                "Model belum dipilih";

        }


        if (
            modelDescriptionEl
        ) {

            modelDescriptionEl.textContent =
                "";

        }


        if (
            providerNameEl
        ) {

            providerNameEl.textContent =
                "";

        }


        if (
            modelMetaEl
        ) {

            modelMetaEl.textContent =
                "";

        }


        return;

    }


    const modelName =
        safeString(
            model.model_name ||
            model.name ||
            model.model_id,
            "Model"
        );


    const description =
        safeString(
            model.description,
            ""
        );


    const provider =
        safeString(
            model.provider?.provider_name ||
            model.provider_name ||
            model.provider?.name ||
            model.provider_id,
            "-"
        );


    const modelId =
        safeString(
            model.model_id,
            ""
        );


    if (
        modelNameEl
    ) {

        modelNameEl.textContent =
            modelName;

    }


    if (
        modelDescriptionEl
    ) {

        modelDescriptionEl.textContent =
            description;

    }


    if (
        providerNameEl
    ) {

        providerNameEl.textContent =
            provider;

    }


    if (
        modelMetaEl
    ) {

        modelMetaEl.textContent =
            modelId
                ? `Model ID: ${modelId}`
                : "";

    }

}


/* =========================================================
   RESULT
========================================================= */

export function hideResult() {

    const {
        resultCard
    } = elements();


    if (
        !resultCard
    ) {
        return;
    }


    resultCard.hidden =
        true;

}


/* =========================================================
   SHOW RESULT
========================================================= */

export function showResult() {

    const {
        resultCard
    } = elements();


    if (
        !resultCard
    ) {
        return;
    }


    resultCard.hidden =
        false;

}


/* =========================================================
   RENDER RESULT
========================================================= */

export function renderResult(
    data = {}
) {

    const {
        resultModel,
        resultProvider,
        resultTaskId
    } = elements();


    const model =
        getCurrentModel();


    const modelName =
        data.model_name ||
        data.model_id ||
        data.model ||
        model?.model_name ||
        model?.model_id ||
        "-";


    const provider =
        data.provider ||
        data.provider_id ||
        model?.provider?.provider_name ||
        model?.provider_name ||
        "-";


    const taskId =
        data.taskId ||
        data.task_id ||
        data.jobId ||
        data.job_id ||
        "-";


    if (
        resultModel
    ) {

        resultModel.textContent =
            String(
                modelName
            );

    }


    if (
        resultProvider
    ) {

        resultProvider.textContent =
            String(
                provider
            );

    }


    if (
        resultTaskId
    ) {

        resultTaskId.textContent =
            String(
                taskId
            );

    }


    showResult();


    return {
        model:
            modelName,

        provider,

        taskId
    };

}


/* =========================================================
   NORMALIZE PROFILE
   ---------------------------------------------------------
   Badge hanya membutuhkan:
   - role
   - credits
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


    if (
        !roleBadgeEl
    ) {
        return;
    }


    /*
     * Jika caller tidak memberikan profile,
     * gunakan profile state terbaru.
     */

    const sourceProfile =
        profile ||
        getCurrentProfile();


    const normalized =
        normalizeProfile(
            sourceProfile
        );


    /*
     * Jangan fallback ke USER.
     *
     * USER hanya boleh muncul jika Supabase
     * memang memberikan role USER.
     */

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
========================================================= */

export function renderCreditBadge(
    profile
) {

    const {
        creditBadgeEl
    } = elements();


    if (
        !creditBadgeEl
    ) {
        return;
    }


    const sourceProfile =
        profile ||
        getCurrentProfile();


    const normalized =
        normalizeProfile(
            sourceProfile
        );


    /*
     * Jangan fallback ke 0.
     *
     * 0 hanya sah jika profiles.credits
     * memang bernilai 0.
     */

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
            `${formatNumber(
                credits
            )} credits`;

    } else {

        creditBadgeEl.textContent =
            String(
                credits
            );

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


    if (
        sourceProfile &&
        typeof sourceProfile ===
        "object"
    ) {

        renderRoleBadge(
            sourceProfile
        );


        renderCreditBadge(
            sourceProfile
        );


        return sourceProfile;

    }


    /*
     * Tidak ada profile.
     *
     * Jangan menampilkan USER / 0 palsu.
     */

    renderRoleBadge(
        null
    );


    renderCreditBadge(
        null
    );


    return null;

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


/* =========================================================
   HIDE GENERATE CARD
========================================================= */

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
        modelSelectorEl
    } = elements();


    if (
        modelSelectorEl
    ) {

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


    if (
        modelSelectorEl
    ) {

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
     * Authentication badge TIDAK disentuh.
     *
     * Reset form bukan reset account.
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
   FOCUS FIRST ERROR
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


    if (!invalid) {
        return false;
    }


    try {

        invalid.focus();

    } catch {
        /*
         * Browser tertentu dapat menolak focus.
         */
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


    if (
        isModelReady()
    ) {

        enableGeneration();

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
