/* =========================================================
   GEN-Z.AI
   GENERATE CANCELLATION MODULE
   ---------------------------------------------------------
   File:
   generate/assets/js/generate-cancellation.js

   Tanggung jawab:
   - Mendeteksi status cancelled / canceled
   - Membedakan CANCELLED dari FAILED
   - Menormalisasi hasil cancellation
   - Membantu Generate App menangani cancellation
   - Menyediakan status UI CANCELLED
   - Tidak mengubah model
   - Tidak mengubah credit
   - Tidak mengubah request Generate
   - Tidak mengubah generation_history secara langsung
   - Tidak melakukan request ke provider

   CATATAN:
   Cancellation aktual dilakukan oleh backend/admin.
   Module ini hanya menangani hasil/status cancellation
   yang diterima oleh frontend.
========================================================= */

"use strict";


/* =========================================================
   CONSTANTS
========================================================= */

const GENZ_CANCELLED_STATES = Object.freeze([
    "cancelled",
    "canceled"
]);


/* =========================================================
   INTERNAL HELPERS
========================================================= */

/**
 * Mengambil state dari berbagai bentuk response.
 */
function getCancellationState(value) {

    if (
        !value ||
        typeof value !== "object"
    ) {
        return "";
    }

    const candidates = [

        value.state,

        value.status,

        value.task_status,

        value.taskStatus,

        value.provider_state,

        value.providerStatus,

        value.data?.state,

        value.data?.status,

        value.data?.task_status,

        value.data?.taskStatus,

        value.data?.provider_state,

        value.result?.state,

        value.result?.status

    ];

    for (
        const candidate of candidates
    ) {

        if (
            candidate === null ||
            candidate === undefined
        ) {
            continue;
        }

        const normalized =
            String(candidate)
                .trim()
                .toLowerCase()
                .replace(/\s+/g, "_")
                .replace(/-/g, "_");

        if (
            normalized
        ) {

            return normalized;

        }

    }

    return "";

}


/* =========================================================
   IS CANCELLED STATE
========================================================= */

/**
 * Mengecek apakah state merupakan cancellation.
 */
function isCancelledState(
    state
) {

    if (
        state === null ||
        state === undefined
    ) {

        return false;

    }

    const normalized =
        String(state)
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "_")
            .replace(/-/g, "_");

    return (
        normalized === "cancelled" ||
        normalized === "canceled"
    );

}


/* =========================================================
   IS CANCELLED RESULT
========================================================= */

/**
 * Mengecek seluruh bentuk response cancellation.
 *
 * Cancellation memiliki prioritas lebih tinggi
 * daripada failed.
 */
function isGenerateCancelled(
    value
) {

    if (
        !value ||
        typeof value !== "object"
    ) {

        return false;

    }

    /*
     * Explicit cancellation flags.
     */

    if (
        value.cancelled === true ||
        value.canceled === true ||
        value.cancellation === true
    ) {

        return true;

    }


    /*
     * History cancellation.
     */

    if (
        isCancelledState(
            value.history_status
        )
    ) {

        return true;

    }

    if (
        isCancelledState(
            value.historyStatus
        )
    ) {

        return true;

    }

    if (
        isCancelledState(
            value.database_status
        )
    ) {

        return true;

    }

    if (
        isCancelledState(
            value.databaseStatus
        )
    ) {

        return true;

    }


    /*
     * Main/provider state.
     */

    if (
        isCancelledState(
            getCancellationState(value)
        )
    ) {

        return true;

    }


    /*
     * Nested response.
     */

    if (
        value.data &&
        typeof value.data === "object" &&
        isGenerateCancelled(
            value.data
        )
    ) {

        return true;

    }


    if (
        value.result &&
        typeof value.result === "object" &&
        isGenerateCancelled(
            value.result
        )
    ) {

        return true;

    }


    return false;

}


/* =========================================================
   IS FAILED RESULT
========================================================= */

/**
 * Mengecek failed.
 *
 * IMPORTANT:
 * cancelled TIDAK BOLEH dianggap failed.
 */
function isGenerateFailed(
    value
) {

    /*
     * Cancellation selalu memiliki prioritas.
     */

    if (
        isGenerateCancelled(value)
    ) {

        return false;

    }


    if (
        !value ||
        typeof value !== "object"
    ) {

        return false;

    }


    /*
     * Explicit failed flag.
     */

    if (
        value.failed === true
    ) {

        return true;

    }


    /*
     * Failed states.
     */

    const state =
        getCancellationState(value);

    const failedStates = [

        "fail",
        "failed",
        "failure",
        "error",
        "rejected",
        "terminated",
        "aborted"

    ];

    return failedStates.includes(
        state
    );

}


/* =========================================================
   IS COMPLETED RESULT
========================================================= */

/**
 * Mengecek completed.
 *
 * Cancellation selalu menghasilkan false.
 */
function isGenerateCompleted(
    value
) {

    if (
        isGenerateCancelled(value)
    ) {

        return false;

    }


    if (
        isGenerateFailed(value)
    ) {

        return false;

    }


    if (
        !value ||
        typeof value !== "object"
    ) {

        return false;

    }


    if (
        value.completed === true
    ) {

        return true;

    }


    const state =
        getCancellationState(value);

    const completedStates = [

        "success",
        "succeeded",
        "successful",
        "completed",
        "complete",
        "done",
        "finished",
        "finish",
        "successfully_completed"

    ];

    if (
        completedStates.includes(state)
    ) {

        return true;

    }


    /*
     * Beberapa response backend hanya memiliki
     * result URL tanpa completed flag.
     */

    const resultUrls =
        extractResultUrls(value);

    return (
        resultUrls.length > 0
    );

}


/* =========================================================
   IS PROCESSING RESULT
========================================================= */

/**
 * Mengecek apakah task masih berjalan.
 */
function isGenerateProcessing(
    value
) {

    if (
        isGenerateCancelled(value) ||
        isGenerateFailed(value) ||
        isGenerateCompleted(value)
    ) {

        return false;

    }


    if (
        !value ||
        typeof value !== "object"
    ) {

        return false;

    }


    const state =
        getCancellationState(value);

    const processingStates = [

        "waiting",
        "pending",
        "queued",
        "queue",
        "processing",
        "running",
        "generating",
        "in_progress",
        "created",
        "submitted",
        "starting",
        "started"

    ];

    return processingStates.includes(
        state
    );

}


/* =========================================================
   RESULT URL
========================================================= */

/**
 * Mengambil result URL.
 */
function extractResultUrls(
    value
) {

    if (
        !value ||
        typeof value !== "object"
    ) {

        return [];

    }


    const candidates = [

        value.result_urls,

        value.resultUrls,

        value.output_urls,

        value.outputUrls,

        value.urls,

        value.data?.result_urls,

        value.data?.resultUrls,

        value.data?.output_urls,

        value.data?.outputUrls,

        value.result?.resultUrls,

        value.result?.result_urls,

        value.result?.urls

    ];


    for (
        const candidate of candidates
    ) {

        if (
            Array.isArray(candidate)
        ) {

            return candidate
                .filter(
                    item =>
                        typeof item === "string" &&
                        item.trim()
                )
                .map(
                    item =>
                        item.trim()
                );

        }

    }


    /*
     * Single result URL.
     */

    const singleCandidates = [

        value.result_url,

        value.resultUrl,

        value.output_url,

        value.outputUrl,

        value.url,

        value.data?.result_url,

        value.data?.resultUrl,

        value.data?.output_url,

        value.data?.outputUrl,

        value.data?.url

    ];


    for (
        const candidate of singleCandidates
    ) {

        if (
            typeof candidate === "string" &&
            candidate.trim()
        ) {

            return [
                candidate.trim()
            ];

        }

    }


    return [];

}


/* =========================================================
   CANCELLATION MESSAGE
========================================================= */

/**
 * Menghasilkan pesan cancellation yang aman.
 */
function getCancellationMessage(
    value
) {

    if (
        value &&
        typeof value === "object"
    ) {

        const candidates = [

            value.message,

            value.msg,

            value.cancellation_message,

            value.cancellationMessage,

            value.history_reason,

            value.historyReason,

            value.data?.message,

            value.data?.msg

        ];


        for (
            const candidate of candidates
        ) {

            if (
                typeof candidate === "string" &&
                candidate.trim()
            ) {

                return candidate.trim();

            }

        }

    }


    return "Generate dibatalkan.";

}


/* =========================================================
   NORMALIZE CANCELLATION
========================================================= */

/**
 * Mengubah response cancellation menjadi bentuk
 * yang konsisten untuk Generate App.
 */
function normalizeGenerateCancellation(
    value
) {

    const cancelled =
        isGenerateCancelled(value);


    if (
        !cancelled
    ) {

        return {

            cancelled:
                false,

            cancellation:
                false,

            state:
                getCancellationState(value),

            failed:
                isGenerateFailed(value),

            completed:
                isGenerateCompleted(value),

            processing:
                isGenerateProcessing(value)

        };

    }


    return {

        success:
            true,

        state:
            "cancelled",

        status:
            "cancelled",

        cancelled:
            true,

        canceled:
            true,

        cancellation:
            true,

        processing:
            false,

        completed:
            false,

        failed:
            false,

        message:
            getCancellationMessage(value),

        history_status:
            "cancelled",

        history_reason:
            value?.history_reason ||
            value?.historyReason ||
            "generation_cancelled",

        task_id:
            value?.task_id ||
            value?.taskId ||
            value?.data?.task_id ||
            value?.data?.taskId ||
            null,

        result_urls:
            extractResultUrls(value),

        source:
            value || null

    };

}


/* =========================================================
   STATUS TYPE
========================================================= */

/**
 * Menghasilkan status UI:
 *
 * idle
 * processing
 * success
 * failed
 * cancelled
 */
function getGenerateStatusType(
    value
) {

    if (
        isGenerateCancelled(value)
    ) {

        return "cancelled";

    }


    if (
        isGenerateFailed(value)
    ) {

        return "failed";

    }


    if (
        isGenerateCompleted(value)
    ) {

        return "success";

    }


    if (
        isGenerateProcessing(value)
    ) {

        return "processing";

    }


    return "idle";

}


/* =========================================================
   STATUS MESSAGE
========================================================= */

function getGenerateStatusMessage(
    value
) {

    const type =
        getGenerateStatusType(value);


    if (
        type === "cancelled"
    ) {

        return getCancellationMessage(
            value
        );

    }


    if (
        type === "failed"
    ) {

        return (
            value?.message ||
            value?.msg ||
            value?.error ||
            value?.data?.message ||
            value?.data?.error ||
            "Generate gagal diproses."
        );

    }


    if (
        type === "success"
    ) {

        return (
            value?.message ||
            "Check Hasil Generate di History...!!!"
        );

    }


    if (
        type === "processing"
    ) {

        return (
            value?.message ||
            "Video sedang diproses. Mohon tunggu..."
        );

    }


    return "";

}


/* =========================================================
   SAFE STATUS TEXT
========================================================= */

/**
 * Escape text untuk mencegah response backend
 * masuk sebagai HTML.
 */
function escapeCancellationText(
    value
) {

    return String(
        value ?? ""
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}


/* =========================================================
   STATUS UI
========================================================= */

/**
 * Menampilkan status cancellation pada element.
 *
 * Fungsi ini tidak membuat element baru.
 * Caller tetap menentukan element yang digunakan.
 */
function renderGenerateCancellation(
    element,
    message = "Generate dibatalkan."
) {

    if (
        !element
    ) {

        return false;

    }


    const safeMessage =
        escapeCancellationText(
            message
        );


    element.hidden =
        false;

    element.style.display =
        "flex";

    element.classList.remove(
        "genz-status-processing",
        "genz-status-success",
        "genz-status-failed",
        "genz-status-hidden"
    );

    element.classList.add(
        "genz-status-failed"
    );


    element.innerHTML =
        `
        <div
            class="genz-generate-status-inner"
        >

            <span
                class="genz-generate-status-icon"
                aria-hidden="true"
            >
                <span
                    class="genz-status-failed-icon"
                >
                    ×
                </span>
            </span>

            <div
                class="genz-generate-status-content"
            >

                <div
                    class="genz-generate-status-title failed"
                >
                    CANCELLED
                </div>

                <div
                    class="genz-generate-status-message failed"
                >
                    ${safeMessage}
                </div>

            </div>

        </div>
        `;


    return true;

}


/* =========================================================
   HANDLE POLLING UPDATE
========================================================= */

/**
 * Utility utama untuk Generate App.
 *
 * Return:
 * {
 *   handled: true,
 *   type: "cancelled"
 * }
 *
 * jika update merupakan cancellation.
 */
function handleGenerateCancellation(
    value,
    elements = null
) {

    if (
        !isGenerateCancelled(value)
    ) {

        return {

            handled:
                false,

            type:
                getGenerateStatusType(
                    value
                )

        };

    }


    const normalized =
        normalizeGenerateCancellation(
            value
        );


    /*
     * Update UI jika element tersedia.
     */

    if (
        elements &&
        typeof elements === "object"
    ) {

        if (
            elements.generateStatus
        ) {

            renderGenerateCancellation(
                elements.generateStatus,
                normalized.message
            );

        }


        if (
            elements.status
        ) {

            elements.status.hidden =
                false;

            elements.status.textContent =
                normalized.message;

        }


        if (
            elements.loading
        ) {

            /*
             * Jangan mengubah sistem loading secara
             * agresif. Caller dapat menangani loading.
             */

        }

    }


    return {

        handled:
            true,

        type:
            "cancelled",

        value:
            normalized

    };

}


/* =========================================================
   CREATE CANCELLED RESULT
========================================================= */

/**
 * Digunakan apabila caller menerima signal cancellation
 * dari event / backend dan membutuhkan object standar.
 */
function createCancelledResult(
    details = {}
) {

    const source =
        details &&
        typeof details === "object"
            ? details
            : {};


    return {

        success:
            true,

        state:
            "cancelled",

        status:
            "cancelled",

        cancelled:
            true,

        canceled:
            true,

        cancellation:
            true,

        processing:
            false,

        completed:
            false,

        failed:
            false,

        message:
            source.message ||
            source.msg ||
            "Generate dibatalkan.",

        history_status:
            "cancelled",

        history_reason:
            source.history_reason ||
            source.historyReason ||
            "generation_cancelled",

        task_id:
            source.task_id ||
            source.taskId ||
            null,

        taskId:
            source.taskId ||
            source.task_id ||
            null

    };

}


/* =========================================================
   GLOBAL API
========================================================= */

const GENZGenerateCancellation =
    Object.freeze({

        states:
            GENZ_CANCELLED_STATES,

        getState:
            getCancellationState,

        isCancelledState,

        isGenerateCancelled,

        isGenerateFailed,

        isGenerateCompleted,

        isGenerateProcessing,

        extractResultUrls,

        getCancellationMessage,

        normalizeGenerateCancellation,

        getGenerateStatusType,

        getGenerateStatusMessage,

        escapeCancellationText,

        renderGenerateCancellation,

        handleGenerateCancellation,

        createCancelledResult

    });


/* =========================================================
   GLOBAL EXPORT
========================================================= */

window.GENZGenerateCancellation =
    GENZGenerateCancellation;
