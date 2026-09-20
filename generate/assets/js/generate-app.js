/* =========================================================
   GEN-Z.AI
   GENERATE APP MODULE
   ---------------------------------------------------------
   File:
   generate/assets/js/generate-app.js

   Tanggung jawab:
   - Bootstrap halaman Generate
   - Inisialisasi DOM
   - Inisialisasi authentication
   - Menampilkan OWNER + CREDIT
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
   - Result final tidak dirender di halaman Generate.
   - Result akan digunakan untuk History.
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
     * 1. Auth tersedia
     * 2. Model siap
     * 3. Tidak sedang submit
     * 4. Tidak sedang polling
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
   ---------------------------------------------------------
   Jika profile berhasil dimuat:
       gunakan profile terbaru.

   Jika profile gagal tetapi cache navigation
   tersedia:
       gunakan cache tersebut hanya sebagai
       tampilan sementara.

   Source of truth tetap loadProfile().
========================================================= */

function renderAuthFallback() {

    try {

        const profile =
            getCurrentProfile();


        if (
            profile
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
            cachedProfile
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


    return null;

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

        refreshGenerateAvailability();

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


        renderModelHeader(
            model
        );


        renderDynamicFields(
            model
        );


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

            return "Task sedang menunggu diproses...";


        case "processing":

        case "running":

        case "generating":

        case "in_progress":

        case "in-progress":

            return "Video sedang dibuat oleh provider...";


        case "success":

        case "succeeded":

        case "completed":

        case "complete":

        case "done":

        case "finished":

            return "Video selesai dibuat.";


        case "fail":

        case "failed":

        case "error":

        case "cancelled":

        case "canceled":

            return "Generate gagal.";


        default:

            return "Memeriksa status video...";

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


    } catch (
        error
    ) {

        throw error;

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


        const parameters =
            collectParameters();


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
         * Tunggu provider menyelesaikan task.
         */

        const finalResult =
            await waitForTask(
                taskId
            );


        /*
         * =====================================================
         * PENTING
         *
         * Hasil final TIDAK dirender di halaman Generate.
         *
         * History menjadi tempat hasil generation.
         *
         * Backend/History integration akan menyimpan:
         * - task_id
         * - model_id
         * - provider
         * - result URL
         * - status
         * - parameter
         *
         * Generate hanya memberi status sukses.
         * =====================================================
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


        /*
         * Jangan menyembunyikan pageError di sini.
         *
         * Sebelumnya:
         * hidePageError();
         *
         * Ini membuat error yang sudah dirender
         * langsung hilang lagi.
         */

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


    const {
        generateForm
    } =
        getElements();


    if (
        generateForm
    ) {

        generateForm.reset();

    }


    /*
     * Reset parameter dinamis.
     *
     * Fungsi ini async karena upload gambar
     * dapat membutuhkan penghapusan Storage.
     */

    await resetDynamicFields();


    appState.currentTaskId =
        null;


    appState.pollingStartedAt =
        null;


    resetUI();


    if (
        isModelReady()
    ) {

        const model =
            getCurrentModel();


        renderModelHeader(
            model
        );


        appState.modelReady =
            true;


        refreshGenerateAvailability();


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

        const {
            statusEl
        } =
            getElements();


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


    const {
        modelSelectEl,
        statusEl
    } =
        getElements();


    if (
        target ===
        modelSelectEl
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


    const {
        modelSelectEl,
        generateForm,
        resetButton
    } =
        getElements();


    if (
        modelSelectEl
    ) {

        modelSelectEl.addEventListener(
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
   ---------------------------------------------------------
   Auth dan Model sengaja dipisahkan.
   Error badge tidak boleh langsung mematikan model.
========================================================= */

async function initializeAuth() {

    /*
     * Supabase client wajib tersedia.
     */

    await loadSupabase();


    /*
     * Pastikan user Auth tersedia.
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


    /*
     * Profile adalah source of truth untuk:
     * - role
     * - credits
     */

    try {

        const profile =
            await loadProfile();


        renderAuthBadges(
            profile
        );


    } catch (
        profileError
    ) {

        /*
         * Profile error tidak langsung
         * menghancurkan halaman Generate.
         *
         * Coba tampilkan cache profile
         * yang sudah ada.
         */

        console.warn(
            "[GEN-Z.AI][Generate] Profile gagal dimuat:",
            profileError
        );


        const fallback =
            renderAuthFallback();


        if (
            !fallback
        ) {

            /*
             * Badge tetap diberi status jelas.
             * Jangan dibiarkan "..." selamanya.
             */

            const {
                roleBadge,
                creditBadge
            } =
                getElements();


            if (
                roleBadge
            ) {

                roleBadge.textContent =
                    "OWNER";

            }


            if (
                creditBadge
            ) {

                creditBadge.textContent =
                    "Credit: -";

            }

        }

    }


    /*
     * Role tidak digunakan untuk redirect.
     *
     * Hak akses endpoint tetap di backend.
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


    appState.authReady =
        true;


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


    renderModelHeader(
        model
    );


    renderDynamicFields(
        model
    );


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

        /*
         * =====================================================
         * STEP 1
         * DOM
         * =====================================================
         */

        initializeGenerateElements();


        /*
         * =====================================================
         * STEP 2
         * VALIDATE DOM
         * =====================================================
         */

        validateGenerateElements();


        /*
         * =====================================================
         * STEP 3
         * EVENT
         * =====================================================
         */

        bindEvents();


        /*
         * =====================================================
         * STEP 4
         * AUTH
         * =====================================================
         */

        showStatus(
            "Memeriksa sesi...",
            "info"
        );


        try {

            await initializeAuth();

        } catch (
            authError
        ) {

            /*
             * Auth utama gagal.
             *
             * Jangan berpura-pura user siap.
             * Tetapi tetap tampilkan error yang jelas.
             */

            appState.authReady =
                false;


            renderAuthFallback();


            throw authError;

        }


        /*
         * =====================================================
         * STEP 5
         * MODEL
         * =====================================================
         */

        await initializeModel();


        /*
         * =====================================================
         * STEP 6
         * READY
         * =====================================================
         */

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
         * Jangan hapus OWNER/Credit
         * hanya karena model gagal.
         */

        renderAuthFallback();


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
            once:
                true
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
