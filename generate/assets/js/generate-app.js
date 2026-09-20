 /* =========================================================
    GEN-Z.AI
    GENERATE APP MODULE
    ---------------------------------------------------------
    File:
    generate/assets/js/generate-app.js

    Tanggung jawab:
    - Bootstrap halaman Generate
    - Inisialisasi modul
    - Menghubungkan event UI
    - Menjalankan flow generate
    - Menjalankan reset
    - Sinkronisasi model -> form -> request -> result

    Tidak bertanggung jawab:
    - Query Supabase langsung
    - Menyimpan API key
    - Menentukan provider
    - Menentukan harga/model capability
    - Menulis CSS
 ========================================================= */

import {
    initializeGenerateElements,
    validateGenerateElements,
    getGenerateElements,
    getCurrentModel,
    isModelReady
} from "./generate-state.js";

import {
    loadSupabase,
    loadCurrentUser,
    loadProfile,
    getCurrentRole
} from "./generate-auth.js";

import {
    resolveInitialModel,
    selectModel
} from "./generate-model.js";

import {
    renderDynamicFields,
    getFormParameters,
    resetDynamicFields
} from "./generate-form.js";

import {
    validateClientParameters
} from "./generate-validation.js";

import {
    generateVideo,
    GenerateRequestError
} from "./generate-request.js";

import {
    renderModelHeader,
    renderAuthBadges,
    showStatus,
    hideStatus,
    showPageError,
    hidePageError,
    showError,
    showReady,
    showBusy,
    finishRequest,
    renderResult,
    resetUI,
    enableGeneration,
    disableGeneration,
    focusFirstInvalidField,
    scrollToError
} from "./generate-ui.js";


/* =========================================================
   APP STATE
 ========================================================= */

const appState = {
    initialized:
        false,

    submitting:
        false,

    eventsBound:
        false
};


/* =========================================================
   ELEMENTS
 ========================================================= */

function getElements() {

    return getGenerateElements();
}


/* =========================================================
   MODEL READY
 ========================================================= */

function refreshGenerateAvailability() {

    if (
        isModelReady()
    ) {

        enableGeneration();

    } else {

        disableGeneration();
    }
}


/* =========================================================
   SELECT MODEL
 ========================================================= */

async function handleModelChange(
    event
) {

    const modelId =
        String(
            event?.target?.value ||
            ""
        ).trim();

    if (!modelId) {

        disableGeneration();

        return;
    }

    try {

        hidePageError();

        showStatus(
            "Memuat konfigurasi model...",
            "info"
        );

        disableGeneration();

        const model =
            await selectModel(
                modelId
            );

        if (!model) {

            throw new Error(
                "Konfigurasi model tidak ditemukan."
            );
        }

        renderModelHeader(
            model
        );

        renderDynamicFields(
            model
        );

        showReady(
            "Model siap digunakan."
        );

    } catch (
        error
    ) {

        disableGeneration();

        showError(
            error,
            "Gagal memuat konfigurasi model."
        );

        showPageError(
            error?.message ||
            "Gagal memuat konfigurasi model."
        );
    }
}


/* =========================================================
   COLLECT PARAMETERS
 ========================================================= */

function collectParameters() {

    return getFormParameters();
}


/* =========================================================
   VALIDATE FORM
 ========================================================= */

function validateBeforeSubmit(
    parameters
) {

    const errors =
        validateClientParameters(
            parameters
        );

    if (
        errors.length === 0
    ) {

        return true;
    }

    showError(
        errors.join(
            "\n"
        ),
        "Parameter belum valid."
    );

    focusFirstInvalidField();

    scrollToError();

    return false;
}


/* =========================================================
   GENERATE SUBMIT
 ========================================================= */

async function handleGenerateSubmit(
    event
) {

    event.preventDefault();

    if (
        appState.submitting
    ) {
        return;
    }

    if (
        !isModelReady()
    ) {

        showError(
            "Model belum siap digunakan."
        );

        return;
    }

    appState.submitting =
        true;

    try {

        hidePageError();

        /*
         * Ambil parameter hanya dari form module.
         */
        const parameters =
            collectParameters();

        /*
         * Client validation.
         *
         * Backend tetap menjadi validator
         * terakhir.
         */
        if (
            !validateBeforeSubmit(
                parameters
            )
        ) {

            return;
        }

        /*
         * Request mulai.
         */
        showBusy(
            "Mengirim permintaan generate..."
        );

        /*
         * Tetap gunakan endpoint dan payload
         * yang sudah ditentukan oleh request module.
         */
        const data =
            await generateVideo(
                parameters
            );

        /*
         * Render hasil.
         */
        renderResult(
            data
        );

        showStatus(
            "Permintaan generate berhasil dikirim.",
            "success"
        );

    } catch (
        error
    ) {

        /*
         * Error request ditampilkan apa adanya
         * selama tersedia message.
         */
        if (
            error instanceof
                GenerateRequestError
        ) {

            showError(
                error,
                "Generate gagal."
            );

        } else {

            showError(
                error,
                "Terjadi kesalahan saat generate."
            );
        }

        /*
         * Jangan menganggap error sebagai
         * perubahan status model.
         */
        hidePageError();

    } finally {

        appState.submitting =
            false;

        finishRequest();
    }
}


/* =========================================================
   RESET FORM
 ========================================================= */

function resetForm() {

    if (
        appState.submitting
    ) {
        return;
    }

    const {
        generateForm
    } = getElements();

    if (
        generateForm
    ) {

        generateForm.reset();
    }

    /*
     * Parameter dinamis kembali ke nilai
     * default dari konfigurasi model.
     */
    resetDynamicFields();

    resetUI();

    /*
     * Jangan menghilangkan model yang sedang dipilih.
     */
    if (
        isModelReady()
    ) {

        const model =
            getCurrentModel();

        renderModelHeader(
            model
        );

        showReady(
            "Form berhasil direset."
        );
    }
}


/* =========================================================
   INPUT HANDLER
 ========================================================= */

function handleInput(
    event
) {

    const target =
        event?.target;

    if (!target) {
        return;
    }

    /*
     * Hilangkan status error ketika user
     * mulai memperbaiki input.
     */
    if (
        target.matches(
            "input, textarea, select"
        )
    ) {

        const {
            statusEl
        } = getElements();

        if (
            statusEl &&
            statusEl.classList.contains(
                "is-error"
            )
        ) {

            hideStatus();
        }
    }
}


/* =========================================================
   CHANGE HANDLER
 ========================================================= */

function handleChange(
    event
) {

    const target =
        event?.target;

    if (!target) {
        return;
    }

    /*
     * Model selector punya handler khusus.
     */
    const {
        modelSelectEl
    } = getElements();

    if (
        target ===
        modelSelectEl
    ) {

        return;
    }

    /*
     * Input lain cukup menghapus error visual.
     */
    const {
        statusEl
    } = getElements();

    if (
        statusEl &&
        statusEl.classList.contains(
            "is-error"
        )
    ) {

        hideStatus();
    }
}


/* =========================================================
   BIND EVENTS
 ========================================================= */

function bindEvents() {

    if (
        appState.eventsBound
    ) {
        return;
    }

    const {
        modelSelectEl,
        generateForm,
        resetButton
    } = getElements();

    /*
     * Model selector.
     */
    if (
        modelSelectEl
    ) {

        modelSelectEl.addEventListener(
            "change",
            handleModelChange
        );
    }

    /*
     * Form submit.
     */
    if (
        generateForm
    ) {

        generateForm.addEventListener(
            "submit",
            handleGenerateSubmit
        );
    }

    /*
     * Reset.
     */
    if (
        resetButton
    ) {

        resetButton.addEventListener(
            "click",
            resetForm
        );
    }

    /*
     * Input.
     */
    document.addEventListener(
        "input",
        handleInput
    );

    /*
     * Change.
     */
    document.addEventListener(
        "change",
        handleChange
    );

    appState.eventsBound =
        true;
}


/* =========================================================
   AUTH INITIALIZATION
 ========================================================= */

async function initializeAuth() {

    /*
     * Pastikan Supabase client tersedia.
     */
    await loadSupabase();

    /*
     * User berasal dari session Supabase.
     */
    await loadCurrentUser();

    /*
     * Profile harus berasal dari profiles
     * berdasarkan auth user ID.
     */
    const profile =
        await loadProfile();

    renderAuthBadges(
        profile
    );

    /*
     * Role tidak digunakan untuk redirect.
     *
     * USER:
     * tetap di Generate.
     *
     * ADMIN / OWNER:
     * tetap di Generate.
     *
     * Hak akses endpoint tetap ditentukan
     * oleh backend.
     */
    getCurrentRole();
}


/* =========================================================
   MODEL INITIALIZATION
 ========================================================= */

async function initializeModel() {

    const model =
        await resolveInitialModel();

    if (!model) {

        throw new Error(
            "Tidak ada model yang tersedia."
        );
    }

    renderModelHeader(
        model
    );

    renderDynamicFields(
        model
    );

    refreshGenerateAvailability();

    return model;
}


/* =========================================================
   APP INITIALIZATION
 ========================================================= */

export async function initializeGenerateApp() {

    if (
        appState.initialized
    ) {
        return;
    }

    try {

        /*
         * Ambil semua elemen DOM.
         */
        initializeGenerateElements();

        /*
         * Validasi struktur HTML.
         */
        validateGenerateElements();

        /*
         * Bind event sebelum proses async.
         * Dengan begitu UI sudah siap menerima event.
         */
        bindEvents();

        /*
         * Auth.
         */
        showStatus(
            "Memeriksa sesi...",
            "info"
        );

        await initializeAuth();

        /*
         * Model.
         */
        showStatus(
            "Memuat model...",
            "info"
        );

        await initializeModel();

        /*
         * Semua siap.
         */
        hidePageError();

        showReady(
            "Model siap digunakan."
        );

        appState.initialized =
            true;

    } catch (
        error
    ) {

        appState.initialized =
            false;

        disableGeneration();

        const message =
            error?.message ||
            "Halaman Generate gagal diinisialisasi.";

        showPageError(
            message
        );

        showError(
            error,
            message
        );
    }
}


/* =========================================================
   PUBLIC APP API
 ========================================================= */

export const generateApp =
    Object.freeze({

        initialize:
            initializeGenerateApp,

        reset:
            resetForm,

        collectParameters,

        validate:
            validateBeforeSubmit,

        isInitialized:
            () =>
                appState.initialized,

        isSubmitting:
            () =>
                appState.submitting

    });


/* =========================================================
   AUTO BOOTSTRAP
 ========================================================= */

if (
    document.readyState ===
        "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        () => {
            initializeGenerateApp();
        },
        {
            once:
                true
        }
    );

} else {

    initializeGenerateApp();
}


/* =========================================================
   GLOBAL COMPATIBILITY
   ---------------------------------------------------------
   Hanya expose API app, bukan API key atau provider.
 ========================================================= */

window.GENZGenerateApp =
    generateApp;
