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
   - Memuat profile Supabase
   - Menampilkan role + credit
   - Memuat model
   - Menghubungkan model -> form -> request
   - Menjalankan polling task
   - Reset form

   SOURCE OF TRUTH:
   - Auth        -> Supabase Auth
   - Role        -> profiles.role
   - Credit      -> profiles.credits
   - Model       -> repository model registry

   Tidak bertanggung jawab:
   - Query Supabase langsung selain melalui generate-auth
   - Menentukan provider
   - Menentukan harga/model capability
   - Menyimpan API key
   - Menulis CSS
   - Query provider langsung
   - Menampilkan hasil video final
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
     * Generate hanya boleh aktif jika:
     *
     * 1. Auth valid
     * 2. Profile berhasil dimuat
     * 3. Model berhasil dimuat
     * 4. Model benar-benar ready
     * 5. Tidak sedang submit
     * 6. Tidak sedang polling
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
        appState.profileReady &&
        appState.modelReady &&
        isModelReady()
    ) {

        enableGeneration();

        return;

    }


    disableGeneration();

}


/* =========================================================
   GET ACTUAL PROFILE
   ---------------------------------------------------------
   Prioritas:
   1. generate-state
   2. global current profile
   3. navigation profile
========================================================= */

function getActualProfile() {

    try {

        const stateProfile =
            getCurrentProfile();


        if (
            stateProfile &&
            typeof stateProfile ===
                "object"
        ) {

            return stateProfile;

        }

    } catch (
        error
    ) {

        console.warn(
            "[GEN-Z.AI][Generate] Gagal membaca state profile:",
            error
        );

    }


    try {

        const currentProfile =
            window.GENZ_CURRENT_PROFILE;


        if (
            currentProfile &&
            typeof currentProfile ===
                "object"
        ) {

            return currentProfile;

        }

    } catch (
        error
    ) {

        console.warn(
            "[GEN-Z.AI][Generate] Gagal membaca current profile:",
            error
        );

    }


    try {

        const navigationProfile =
            window.GENZ_NAVIGATION_PROFILE;


        if (
            navigationProfile &&
            typeof navigationProfile ===
                "object"
        ) {

            return navigationProfile;

        }

    } catch (
        error
    ) {

        console.warn(
            "[GEN-Z.AI][Generate] Gagal membaca navigation profile:",
            error
        );

    }


    return null;

}


/* =========================================================
   CLEAR AUTH BADGES
========================================================= */

function clearAuthBadges() {

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

            roleBadge.style.display =
                "none";

            delete roleBadge.dataset.role;

        }


        if (
            creditBadge
        ) {

            creditBadge.textContent =
                "";

            creditBadge.hidden =
                true;

            creditBadge.style.display =
                "none";

        }

    } catch (
        error
    ) {

        console.warn(
            "[GEN-Z.AI][Generate] Gagal membersihkan auth badge:",
            error
        );

    }

}


/* =========================================================
   FORCE AUTH BADGES
   ---------------------------------------------------------
   Fungsi ini memastikan badge:
   - menerima profile aktual
   - tidak memakai OWNER hardcode
   - tidak memakai credit hardcode
   - tidak menyembunyikan credit = 0
========================================================= */

function renderActualAuthBadges(
    profile
) {

    if (
        !profile ||
        typeof profile !==
            "object"
    ) {

        clearAuthBadges();

        return false;

    }


    try {

        renderAuthBadges(
            profile
        );

    } catch (
        error
    ) {

        console.error(
            "[GEN-Z.AI][Generate] renderAuthBadges gagal:",
            error
        );

    }


    /*
     * Pastikan badge tidak tertinggal hidden
     * setelah renderAuthBadges().
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


        /* =============================================
           ROLE
        ============================================= */

        if (
            roleBadge
        ) {

            const role =
                String(
                    profile.role ||
                    ""
                )
                    .trim()
                    .toUpperCase();


            if (
                role
            ) {

                roleBadge.textContent =
                    role;

                roleBadge.hidden =
                    false;

                roleBadge.style.display =
                    "";

                roleBadge.dataset.role =
                    role;

            } else {

                roleBadge.textContent =
                    "";

                roleBadge.hidden =
                    true;

                roleBadge.style.display =
                    "none";

            }

        }


        /* =============================================
           CREDIT
        ============================================= */

        if (
            creditBadge
        ) {

            const rawCredits =
                profile.credits;


            /*
             * NULL / undefined / empty:
             * data memang tidak tersedia.
             */

            if (
                rawCredits === null ||
                rawCredits === undefined ||
                rawCredits === ""
            ) {

                creditBadge.textContent =
                    "Credit: -";

                creditBadge.hidden =
                    false;

                creditBadge.style.display =
                    "";

            } else {

                const numericCredits =
                    Number(
                        rawCredits
                    );


                /*
                 * 0 adalah nilai VALID.
                 */

                if (
                    Number.isFinite(
                        numericCredits
                    )
                ) {

                    creditBadge.textContent =
                        `Credit: ${new Intl.NumberFormat(
                            "id-ID"
                        ).format(
                            numericCredits
                        )}`;

                } else {

                    creditBadge.textContent =
                        `Credit: ${String(
                            rawCredits
                        )}`;

                }


                creditBadge.hidden =
                    false;

                creditBadge.style.display =
                    "";

            }

        }

    } catch (
        error
    ) {

        console.warn(
            "[GEN-Z.AI][Generate] Finalisasi auth badge gagal:",
            error
        );

    }


    return true;

}


/* =========================================================
   AUTH BADGE FALLBACK
   ---------------------------------------------------------
   Fallback hanya menggunakan profile aktual yang sudah
   tersedia di state/global.

   TIDAK ADA:
   - OWNER hardcode
   - Credit hardcode
========================================================= */

function renderAuthFallback() {

    const profile =
        getActualProfile();


    if (
        profile
    ) {

        return renderActualAuthBadges(
            profile
        );

    }


    clearAuthBadges();

    return false;

}


/* =========================================================
   RENDER CURRENT MODEL FORM
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


    /*
     * Auth wajib siap.
     */

    if (
        !appState.authReady
    ) {

        showError(
            "Sesi pengguna belum siap."
        );

        return;

    }


    /*
     * Profile wajib siap.
     *
     * Ini penting supaya Generate tidak berjalan
     * tanpa mengetahui credit account aktual.
     */

    if (
        !appState.profileReady
    ) {

        showError(
            "Profile akun belum siap. Credit tidak dapat diverifikasi."
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
         * Pastikan badge masih menggunakan
         * profile aktual sebelum generate.
         */

        const profile =
            getActualProfile();


        if (
            profile
        ) {

            renderActualAuthBadges(
                profile
            );

        }


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
         *
         * Credit juga WAJIB diverifikasi
         * oleh backend sebelum provider dipanggil.
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
         * History akan menjadi tempat hasil final.
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


        /*
         * Refresh badge setelah generate.
         *
         * Backend nantinya dapat mengurangi credit.
         * Kita ambil profile terbaru supaya angka
         * di UI tidak menjadi fosil digital.
         */

        try {

            const refreshedProfile =
                await loadProfile();


            if (
                refreshedProfile &&
                typeof refreshedProfile ===
                    "object"
            ) {

                appState.profileReady =
                    true;


                renderActualAuthBadges(
                    refreshedProfile
                );

            }

        } catch (
            refreshError
        ) {

            console.warn(
                "[GEN-Z.AI][Generate] Refresh credit setelah generate gagal:",
                refreshError
            );

        }


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
     * Badge authentication tetap dipertahankan
     * dari profile aktual.
     */

    const profile =
        getActualProfile();


    if (
        profile
    ) {

        renderActualAuthBadges(
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
         * Setelah reset, form dibuat kembali
         * berdasarkan model registry.
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
   ---------------------------------------------------------
   URUTAN WAJIB:
   1. Supabase
   2. Auth user
   3. Profile
   4. Role + credit badge
   5. Auth ready
========================================================= */

async function initializeAuth() {

    /*
     * ================================================
     * STEP 1
     * Supabase client
     * ================================================
     */

    await loadSupabase();


    /*
     * ================================================
     * STEP 2
     * User Auth
     * ================================================
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
     * Auth session sudah valid.
     */

    appState.authReady =
        true;


    /*
     * ================================================
     * STEP 3
     * Profile Supabase
     * ================================================
     *
     * Role + credit WAJIB berasal dari sini.
     */

    let profile;


    try {

        profile =
            await loadProfile();

    } catch (
        profileError
    ) {

        appState.profileReady =
            false;


        /*
         * Jangan diam-diam melanjutkan Generate
         * tanpa profile.
         */

        clearAuthBadges();


        throw new Error(
            profileError?.message ||
            "Profile akun gagal dimuat dari Supabase."
        );

    }


    /*
     * ================================================
     * STEP 4
     * Validasi profile
     * ================================================
     */

    if (
        !profile ||
        typeof profile !==
            "object"
    ) {

        appState.profileReady =
            false;


        clearAuthBadges();


        throw new Error(
            "Profile akun tidak tersedia."
        );

    }


    /*
     * ID profile harus sama dengan Auth user.
     */

    if (
        String(
            profile.id ||
            ""
        ) !==
        String(
            user.id
        )
    ) {

        appState.profileReady =
            false;


        clearAuthBadges();


        throw new Error(
            "Profile akun tidak sesuai dengan user Auth."
        );

    }


    /*
     * Role harus tersedia.
     */

    const role =
        String(
            profile.role ||
            ""
        )
            .trim()
            .toUpperCase();


    if (
        !role
    ) {

        appState.profileReady =
            false;


        clearAuthBadges();


        throw new Error(
            "Role akun tidak tersedia pada profile."
        );

    }


    /*
     * ================================================
     * STEP 5
     * Simpan/render profile
     * ================================================
     */

    appState.profileReady =
        true;


    /*
     * Ini sumber badge yang benar.
     */

    renderActualAuthBadges(
        profile
    );


    /*
     * Pastikan global profile juga sinkron.
     */

    window.GENZ_CURRENT_PROFILE =
        profile;

    window.GENZ_NAVIGATION_PROFILE =
        profile;


    /*
     * ================================================
     * STEP 6
     * Role check
     * ================================================
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


    /*
     * Debug aman.
     *
     * Tidak menampilkan token/API key.
     */

    console.log(
        "[GEN-Z.AI][Generate] Profile loaded:",
        {
            id:
                profile.id,

            role:
                profile.role,

            credits:
                profile.credits
        }
    );


    return profile;

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


    /*
     * Support dua kemungkinan API:
     *
     * 1. { model: {...} }
     * 2. model langsung
     */

    const model =
        resolved?.model ||
        (
            resolved &&
            resolved.model_id
                ? resolved
                : null
        );


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
           AUTH + PROFILE
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


            /*
             * Jangan tampilkan badge palsu.
             */

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
           FINAL AUTH BADGE SYNC
        ================================================ */

        /*
         * Setelah seluruh UI selesai dirender,
         * render badge sekali lagi dari profile
         * aktual untuk menghindari masalah urutan DOM.
         */

        const finalProfile =
            getActualProfile();


        if (
            finalProfile
        ) {

            renderActualAuthBadges(
                finalProfile
            );

        }


        /* ================================================
           STEP 7
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
         * Jangan menghapus badge yang sudah
         * berhasil dimuat.
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
