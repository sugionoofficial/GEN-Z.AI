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
   - Menjalankan polling task
   - Menjalankan reset
   - Sinkronisasi model -> form -> request -> polling -> result

   Tidak bertanggung jawab:
   - Query Supabase langsung
   - Menyimpan API key
   - Menentukan provider
   - Menentukan harga/model capability
   - Menulis CSS
   - Query provider secara langsung
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

    polling:
        false,

    eventsBound:
        false,

    currentTaskId:
        null,

    pollingStartedAt:
        null
};


/* =========================================================
   POLLING CONFIG
========================================================= */

/*
 * Polling minimal 3 detik.
 *
 * Jangan terlalu agresif.
 * Provider tetap butuh waktu memproses video.
 */

const POLLING_INTERVAL =
    3000;


/*
 * Maksimal 10 menit.
 *
 * Nilai ini hanya timeout frontend.
 * Provider tetap menentukan status task.
 */

const POLLING_TIMEOUT =
    10 * 60 * 1000;


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

    /*
     * Selama submit/polling berjalan,
     * tombol Generate tetap dikunci.
     */

    if (
        appState.submitting ||
        appState.polling
    ) {

        disableGeneration();

        return;
    }


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


        /*
         * Model yang diterima dari selectModel()
         * adalah konfigurasi model sebenarnya.
         */

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
   EXTRACT TASK ID
   ---------------------------------------------------------
   Backend generate dapat mengembalikan task ID dalam
   beberapa bentuk. Normalisasi dilakukan di satu tempat.
========================================================= */

function extractTaskId(
    data
) {

    if (!data) {

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


        if (value) {

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
   HANDLE POLLING UPDATE
========================================================= */

function handlePollingUpdate(
    result
) {

    /*
     * Jangan render hasil final di sini.
     *
     * Callback ini hanya untuk status progress.
     */

    const message =
        getPollingStatusMessage(
            result
        );


    showStatus(
        message,
        "info"
    );


    /*
     * Simpan task ID terbaru jika backend
     * mengembalikan ID lagi.
     */

    const taskId =
        extractTaskId(
            result
        );


    if (taskId) {

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


    if (!normalizedTaskId) {

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


        /*
         * Polling selesai.
         */

        appState.polling =
            false;


        /*
         * Task ID tetap disimpan agar result UI
         * dapat menampilkannya.
         */

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

        appState.polling =
            false;


        throw error;


    } finally {

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
        appState.submitting
    ) {

        return;
    }


    if (
        appState.polling
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


    appState.currentTaskId =
        null;


    appState.pollingStartedAt =
        null;


    try {

        hidePageError();


        /*
         * Ambil parameter hanya dari form module.
         */

        const parameters =
            collectParameters();


        /*
         * Client validation.
         */

        if (
            !validateBeforeSubmit(
                parameters
            )
        ) {

            return;
        }


        /*
         * Request membuat task.
         */

        showBusy(
            "Mengirim permintaan generate..."
        );


        const data =
            await generateVideo(
                parameters
            );


        /*
         * Task ID wajib tersedia.
         *
         * Tanpa task ID kita tidak memiliki referensi
         * untuk menanyakan status ke backend.
         */

        const taskId =
            extractTaskId(
                data
            );


        if (!taskId) {

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


        /*
         * Simpan task ID.
         */

        appState.currentTaskId =
            taskId;


        /*
         * Polling dimulai.
         */

        const finalResult =
            await waitForTask(
                taskId
            );


        /*
         * Render hasil FINAL.
         *
         * Bukan response awal /createTask.
         */

        renderResult(
            finalResult
        );


        showStatus(
            "Video berhasil dibuat.",
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


        hidePageError();


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

function resetForm() {

    /*
     * Jangan reset ketika task sedang berjalan.
     */

    if (
        appState.submitting ||
        appState.polling
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


    /*
     * Bersihkan task state.
     */

    appState.currentTaskId =
        null;


    appState.pollingStartedAt =
        null;


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
     * Hak akses endpoint tetap ditentukan
     * oleh backend.
     */

    getCurrentRole();
}


/* =========================================================
   MODEL INITIALIZATION
========================================================= */

async function initializeModel() {

    /*
     * resolveInitialModel() mengembalikan:
     *
     * {
     *     model,
     *     models,
     *     executable,
     *     selectedModelId
     * }
     */

    const resolved =
        await resolveInitialModel();


    const model =
        resolved?.model ||
        null;


    if (!model) {

        throw new Error(
            "Tidak ada model executable yang tersedia."
        );
    }


    /*
     * Render model sebenarnya.
     */

    renderModelHeader(
        model
    );


    /*
     * Render parameter dari model sebenarnya.
     */

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
   Hanya expose API app.
   Tidak pernah expose API key/provider credential.
========================================================= */

window.GENZGenerateApp =
    generateApp;
