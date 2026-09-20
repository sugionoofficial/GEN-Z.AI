/* =========================================================
   GEN-Z.AI
   GENERATE APP MODULE
   ---------------------------------------------------------
   File:
   generate/assets/js/generate-app.js

   Tanggung jawab:
   - Bootstrap halaman Generate
   - Inisialisasi DOM
   - Authentication
   - Menampilkan role + credit dari profile
   - Memuat model
   - Menghubungkan model -> form -> request
   - Menjalankan polling task
   - Reset form

   Tidak bertanggung jawab:
   - Query Supabase langsung
   - Menentukan provider
   - Menentukan harga/model capability
   - Menyimpan API key
   - Menulis CSS
   - Query provider langsung
   - Menampilkan hasil video final

   CATATAN:
   - Result final tidak dirender di Generate.
   - Result akan digunakan History.
   - Role/Credit tidak dibuat secara hardcode.
========================================================= */


import {
    initializeGenerateElements,
    validateGenerateElements,
    getGenerateElements,
    getCurrentModel,
    isModelReady,
    getCurrentProfile
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
    renderGenerateForm,
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
    pollTask,
    GeneratePollingError
} from "./generate-polling.js";


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

    polling:
        false,

    eventsBound:
        false,

    authReady:
        false,

    profileReady:
        false,

    modelReady:
        false,

    currentTaskId:
        null,

    pollingStartedAt:
        null

};


/* =========================================================
   POLLING CONFIG
========================================================= */

const POLLING_INTERVAL =
    3000;

const POLLING_TIMEOUT =
    10 * 60 * 1000;


/* =========================================================
   ELEMENTS
========================================================= */

function getElements() {

    return getGenerateElements();

}


/* =========================================================
   REFRESH GENERATION AVAILABILITY
========================================================= */

function refreshGenerateAvailability() {

    /*
     * Generate hanya aktif jika:
     *
     * 1. Auth siap
     * 2. Model siap
     * 3. Tidak submit
     * 4. Tidak polling
     */

    if (
        appState.submitting ||
        appState.polling
    ) {

        disableGeneration();

        return;

    }


    if (
        appState.authReady &&
        appState.modelReady &&
        isModelReady()
    ) {

        enableGeneration();

        return;

    }


    disableGeneration();

}


/* =========================================================
   AUTH BADGE FALLBACK
========================================================= */

function renderAuthFallback() {

    try {

        const profile =
            getCurrentProfile();


        if (
            profile &&
            typeof profile ===
                "object"
        ) {

            renderAuthBadges(
                profile
            );

            return profile;

        }


        const cachedProfile =
            window.GENZ_CURRENT_PROFILE ||
            window.GENZ_NAVIGATION_PROFILE ||
            null;


        if (
            cachedProfile &&
            typeof cachedProfile ===
                "object"
        ) {

            renderAuthBadges(
                cachedProfile
            );

            return cachedProfile;

        }

    } catch (
        error
    ) {

        console.warn(
            "[GEN-Z.AI][Generate] Auth badge fallback gagal:",
            error
        );

    }


    /*
     * Tidak ada fallback palsu.
     */

    try {

        const elements =
            getElements();


        const roleBadge =
            elements?.roleBadgeEl ||
            elements?.roleBadge ||
            null;

        const creditBadge =
            elements?.creditBadgeEl ||
            elements?.creditBadge ||
            null;


        if (
            roleBadge
        ) {

            roleBadge.textContent =
                "";

            roleBadge.hidden =
                true;

            delete roleBadge.dataset.role;

        }


        if (
            creditBadge
        ) {

            creditBadge.textContent =
                "";

            creditBadge.hidden =
                true;

        }

    } catch (
        error
    ) {

        console.warn(
            "[GEN-Z.AI][Generate] Gagal membersihkan auth badge:",
            error
        );

    }


    return null;

}


/* =========================================================
   RENDER CURRENT MODEL FORM
   ---------------------------------------------------------
   generate-form.js mengambil model langsung
   dari generate-state.js.

   Tidak perlu mengirim model sebagai argumen.
========================================================= */

function renderCurrentModelForm() {

    try {

        renderGenerateForm();

        return true;

    } catch (
        error
    ) {

        console.error(
            "[GEN-Z.AI][Generate] Render form gagal:",
            error
        );

        throw error;

    }

}


/* =========================================================
   MODEL CHANGE
========================================================= */

async function handleModelChange(
    event
) {

    const modelId =
        String(
            event?.target?.value ||
            ""
        ).trim();


    if (
        !modelId
    ) {

        appState.modelReady =
            false;

        disableGeneration();

        renderModelHeader(
            null
        );

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


        if (
            !model
        ) {

            throw new Error(
                "Konfigurasi model tidak ditemukan."
            );

        }


        /*
         * selectModel sudah menyimpan
         * model ke generate-state.
         */

        renderModelHeader(
            model
        );


        renderCurrentModelForm();


        appState.modelReady =
            true;


        refreshGenerateAvailability();


        showReady(
            "Model siap digunakan."
        );


    } catch (
        error
    ) {

        appState.modelReady =
            false;

        disableGeneration();

        renderModelHeader(
            null
        );


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
   EXTRACT TASK ID
========================================================= */

function extractTaskId(
    data
) {

    if (
        !data
    ) {

        return "";

    }


    const candidates = [

        data.task_id,

        data.taskId,

        data.job_id,

        data.jobId,

        data.task?.task_id,

        data.task?.taskId,

        data.task?.job_id,

        data.task?.jobId,

        data.data?.task_id,

        data.data?.taskId,

        data.data?.job_id,

        data.data?.jobId

    ];


    for (
        const candidate
        of candidates
    ) {

        const value =
            String(
                candidate ||
                ""
            ).trim();


        if (
            value
        ) {

            return value;

        }

    }


    return "";

}


/* =========================================================
   POLLING STATUS MESSAGE
========================================================= */

function getPollingStatusMessage(
    result
) {

    const state =
        String(
            result?.state ||
            ""
        ).trim().toLowerCase();


    switch (
        state
    ) {

        case "waiting":

        case "pending":

        case "queued":

        case "queue":

            return (
                "Task sedang menunggu diproses..."
            );


        case "processing":

        case "running":

        case "generating":

        case "in_progress":

        case "in-progress":

            return (
                "Video sedang dibuat oleh provider..."
            );


        case "success":

        case "succeeded":

        case "completed":

        case "complete":

        case "done":

        case "finished":

            return (
                "Video selesai dibuat."
            );


        case "fail":

        case "failed":

        case "error":

        case "cancelled":

        case "canceled":

            return (
                "Generate gagal."
            );


        default:

            return (
                "Memeriksa status video..."
            );

    }

}


/* =========================================================
   POLLING UPDATE
========================================================= */

function handlePollingUpdate(
    result
) {

    showStatus(
        getPollingStatusMessage(
            result
        ),
        "info"
    );


    const taskId =
        extractTaskId(
            result
        );


    if (
        taskId
    ) {

        appState.currentTaskId =
            taskId;

    }

}


/* =========================================================
   WAIT FOR TASK
========================================================= */

async function waitForTask(
    taskId
) {

    const normalizedTaskId =
        String(
            taskId ||
            ""
        ).trim();


    if (
        !normalizedTaskId
    ) {

        throw new GeneratePollingError(
            "Task ID tidak ditemukan dari response generate.",
            {
                code:
                    "TASK_ID_MISSING"
            }
        );

    }


    appState.polling =
        true;

    appState.currentTaskId =
        normalizedTaskId;

    appState.pollingStartedAt =
        Date.now();


    refreshGenerateAvailability();


    try {

        showStatus(
            "Task berhasil dibuat. Menunggu hasil video...",
            "info"
        );


        const result =
            await pollTask(
                normalizedTaskId,
                {

                    interval:
                        POLLING_INTERVAL,

                    timeout:
                        POLLING_TIMEOUT,

                    onUpdate:
                        handlePollingUpdate

                }
            );


        const finalTaskId =
            extractTaskId(
                result
            );


        if (
            finalTaskId
        ) {

            appState.currentTaskId =
                finalTaskId;

        }


        return result;


    } finally {

        appState.polling =
            false;

        refreshGenerateAvailability();

    }

}


/* =========================================================
   GENERATE SUBMIT
========================================================= */

async function handleGenerateSubmit(
    event
) {

    event.preventDefault();


    if (
        appState.submitting ||
        appState.polling
    ) {

        return;

    }


    if (
        !appState.authReady
    ) {

        showError(
            "Sesi pengguna belum siap."
        );

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

    appState.currentTaskId =
        null;

    appState.pollingStartedAt =
        null;


    try {

        hidePageError();


        /*
         * Ambil parameter TERBARU
         * dari form.
         */

        const parameters =
            collectParameters();


        /*
         * Validasi sebelum request.
         */

        if (
            !validateBeforeSubmit(
                parameters
            )
        ) {

            return;

        }


        showBusy(
            "Mengirim permintaan generate..."
        );


        /*
         * Request backend.
         *
         * API key/provider tidak pernah
         * berada di frontend.
         */

        const data =
            await generateVideo(
                parameters
            );


        const taskId =
            extractTaskId(
                data
            );


        if (
            !taskId
        ) {

            throw new GenerateRequestError(
                "Task berhasil dikirim tetapi Task ID tidak ditemukan.",
                {

                    code:
                        "TASK_ID_MISSING",

                    details:
                        data

                }
            );

        }


        appState.currentTaskId =
            taskId;


        /*
         * Poll provider sampai selesai.
         */

        const finalResult =
            await waitForTask(
                taskId
            );


        /*
         * =================================================
         * RESULT TIDAK DIRender DI GENERATE
         * =================================================
         *
         * Hasil final akan menjadi data History.
         *
         * Backend History nanti menyimpan:
         * - task_id
         * - model_id
         * - provider
         * - parameter
         * - result URL
         * - status
         */

        const completedTaskId =
            extractTaskId(
                finalResult
            ) ||
            appState.currentTaskId ||
            taskId;


        appState.currentTaskId =
            completedTaskId;


        showStatus(
            "Video berhasil dibuat. Hasil tersedia di History.",
            "success"
        );


    } catch (
        error
    ) {

        if (
            error instanceof
                GeneratePollingError
        ) {

            showError(
                error,
                "Proses generate gagal."
            );

        } else if (
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

    } finally {

        appState.submitting =
            false;

        appState.polling =
            false;


        refreshGenerateAvailability();

        finishRequest();

    }

}


/* =========================================================
   RESET FORM
========================================================= */

async function resetForm() {

    if (
        appState.submitting ||
        appState.polling
    ) {

        return;

    }


    const elements =
        getElements();


    const generateForm =
        elements?.generateForm ||
        elements?.generateFormEl ||
        null;


    if (
        generateForm
    ) {

        generateForm.reset();

    }


    try {

        await resetDynamicFields();

    } catch (
        error
    ) {

        console.warn(
            "[GEN-Z.AI][Generate] Reset dynamic fields gagal:",
            error
        );

    }


    appState.currentTaskId =
        null;

    appState.pollingStartedAt =
        null;


    resetUI();


    /*
     * Badge authentication tetap dipertahankan.
     */

    const profile =
        getCurrentProfile();


    if (
        profile &&
        typeof profile ===
            "object"
    ) {

        renderAuthBadges(
            profile
        );

    } else {

        renderAuthFallback();

    }


    /*
     * Model tetap dipertahankan.
     */

    const model =
        getCurrentModel();


    if (
        model &&
        isModelReady()
    ) {

        renderModelHeader(
            model
        );


        /*
         * Setelah reset, form harus
         * dibuat kembali dari model.
         */

        renderCurrentModelForm();


        appState.modelReady =
            true;


        refreshGenerateAvailability();


        showReady(
            "Form berhasil direset."
        );

    } else {

        appState.modelReady =
            false;

        disableGeneration();

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


    if (
        !target
    ) {

        return;

    }


    if (
        target.matches(
            "input, textarea, select"
        )
    ) {

        const elements =
            getElements();


        const statusEl =
            elements?.statusEl ||
            elements?.status ||
            null;


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


    if (
        !target
    ) {

        return;

    }


    const elements =
        getElements();


    const modelSelect =
        elements?.modelSelectEl ||
        elements?.modelSelect ||
        null;

    const statusEl =
        elements?.statusEl ||
        elements?.status ||
        null;


    if (
        target ===
        modelSelect
    ) {

        return;

    }


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


    const elements =
        getElements();


    const modelSelect =
        elements?.modelSelectEl ||
        elements?.modelSelect ||
        null;

    const generateForm =
        elements?.generateForm ||
        elements?.generateFormEl ||
        null;

    const resetButton =
        elements?.resetButton ||
        elements?.resetButtonEl ||
        null;


    if (
        modelSelect
    ) {

        modelSelect.addEventListener(
            "change",
            handleModelChange
        );

    }


    if (
        generateForm
    ) {

        generateForm.addEventListener(
            "submit",
            handleGenerateSubmit
        );

    }


    if (
        resetButton
    ) {

        resetButton.addEventListener(
            "click",
            resetForm
        );

    }


    document.addEventListener(
        "input",
        handleInput
    );


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
     * Supabase client.
     */

    await loadSupabase();


    /*
     * User Auth.
     */

    const user =
        await loadCurrentUser();


    if (
        !user?.id
    ) {

        throw new Error(
            "User belum terautentikasi."
        );

    }


    appState.authReady =
        true;


    /*
     * Profile source of truth:
     * - role
     * - credits
     */

    try {

        const profile =
            await loadProfile();


        if (
            profile &&
            typeof profile ===
                "object"
        ) {

            appState.profileReady =
                true;


            renderAuthBadges(
                profile
            );

        } else {

            appState.profileReady =
                false;

            renderAuthFallback();

        }

    } catch (
        profileError
    ) {

        appState.profileReady =
            false;


        console.warn(
            "[GEN-Z.AI][Generate] Profile gagal dimuat:",
            profileError
        );


        renderAuthFallback();

    }


    /*
     * Role hanya dibaca.
     * Backend tetap menentukan hak akses.
     */

    try {

        getCurrentRole();

    } catch (
        error
    ) {

        console.warn(
            "[GEN-Z.AI][Generate] Role check gagal:",
            error
        );

    }


    return true;

}


/* =========================================================
   MODEL INITIALIZATION
========================================================= */

async function initializeModel() {

    showStatus(
        "Memuat model...",
        "info"
    );


    const resolved =
        await resolveInitialModel();


    const model =
        resolved?.model ||
        null;


    if (
        !model
    ) {

        throw new Error(
            "Tidak ada model executable yang tersedia."
        );

    }


    /*
     * resolveInitialModel sudah
     * menentukan model aktif.
     */

    renderModelHeader(
        model
    );


    /*
     * Form membaca model dari state.
     */

    renderCurrentModelForm();


    appState.modelReady =
        true;


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

        /* ================================================
           STEP 1
           DOM
        ================================================ */

        initializeGenerateElements();


        /* ================================================
           STEP 2
           VALIDATE DOM
        ================================================ */

        validateGenerateElements();


        /* ================================================
           STEP 3
           EVENTS
        ================================================ */

        bindEvents();


        /* ================================================
           STEP 4
           AUTH
        ================================================ */

        showStatus(
            "Memeriksa sesi...",
            "info"
        );


        try {

            await initializeAuth();

        } catch (
            authError
        ) {

            appState.authReady =
                false;

            appState.profileReady =
                false;


            renderAuthFallback();


            throw authError;

        }


        /* ================================================
           STEP 5
           MODEL
        ================================================ */

        try {

            await initializeModel();

        } catch (
            modelError
        ) {

            appState.modelReady =
                false;


            throw modelError;

        }


        /* ================================================
           STEP 6
           READY
        ================================================ */

        hidePageError();


        showReady(
            "Model siap digunakan."
        );


        refreshGenerateAvailability();


        appState.initialized =
            true;


    } catch (
        error
    ) {

        appState.initialized =
            false;


        appState.modelReady =
            false;


        disableGeneration();


        const message =
            error?.message ||
            "Halaman Generate gagal diinisialisasi.";


        /*
         * Jangan menghapus badge yang
         * sudah berhasil dimuat.
         */

        if (
            !appState.profileReady
        ) {

            renderAuthFallback();

        }


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

        getCurrentTaskId:
            () =>
                appState.currentTaskId,

        isPolling:
            () =>
                appState.polling,

        isInitialized:
            () =>
                appState.initialized,

        isSubmitting:
            () =>
                appState.submitting,

        isAuthReady:
            () =>
                appState.authReady,

        isProfileReady:
            () =>
                appState.profileReady,

        isModelReady:
            () =>
                appState.modelReady

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
            once: true
        }
    );

} else {

    initializeGenerateApp();

}


/* =========================================================
   GLOBAL COMPATIBILITY
========================================================= */

window.GENZGenerateApp =
    generateApp;
