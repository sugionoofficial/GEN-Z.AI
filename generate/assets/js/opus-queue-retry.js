/* =========================================================
   GEN-Z.AI
   OPUS UPSTREAM QUEUE & CREDIT RETRY CONTROLLER
   ---------------------------------------------------------
   File:
     generate/assets/js/opus-queue-retry.js

   Menangani kondisi ketika akun upstream Opus Labs (OpusClip)
   menolak pembuatan/eksekusi job karena kredit upstream sedang
   penuh/tertahan atau tidak mencukupi setelah seluruh pool API key
   Opus dicoba secara berurutan sampai kembali ke key pertama:
   - Menampilkan notifikasi antrian:
       "mohon tunggu antrian, sistem sedang padat"
   - Menjalankan runtime jeda 5 menit berstatus putih "MENCOBA"
     sebanyak maksimal 3 kali jeda 5 menit mencoba ulang.
   - Jika setelah 3 kali jeda 5 menit mencoba kredit masih habis,
     sistem berhenti otomatis dan mengeluarkan notifikasi error merah:
       "SISTEM SEDANG SIBUK, SILAHKAN COBA LAGI"

   CATATAN BUNDLE:
   Modul murni ES (tanpa node:* atau server-only import) agar aman
   diimpor baik oleh browser (/generate) maupun Cloudflare Worker.
========================================================= */

export const OPUS_UPSTREAM_QUEUE_BUSY_CODE =
    "OPUS_UPSTREAM_QUEUE_BUSY";

export const OPUS_SYSTEM_BUSY_FINAL_CODE =
    "OPUS_SYSTEM_BUSY_FINAL";

export const OPUS_QUEUE_WAIT_MESSAGE =
    "mohon tunggu antrian, sistem sedang padat";

export const OPUS_QUEUE_FINAL_ERROR_MESSAGE =
    "SISTEM SEDANG SIBUK, SILAHKAN COBA LAGI";

export const OPUS_QUEUE_RETRY_STATUS_LABEL =
    "MENCOBA";

export const OPUS_QUEUE_RUNTIME_MS =
    5 * 60 * 1000;

export const OPUS_QUEUE_MAX_WAIT_RETRIES =
    3;

export const OPUS_QUEUE_MAX_ATTEMPTS =
    OPUS_QUEUE_MAX_WAIT_RETRIES + 1;

function normalizeToken(value) {
    return String(value ?? "")
        .trim()
        .toLowerCase()
        .replace(/[\s.-]+/g, "_");
}

export function formatQueueCountdown(remainingMs) {
    const safeMs = Math.max(0, Number(remainingMs) || 0);
    const totalSeconds = Math.ceil(safeMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const mm = minutes < 10 ? `0${minutes}` : String(minutes);
    const ss = seconds < 10 ? `0${seconds}` : String(seconds);
    return `${mm}:${ss}`;
}

export function isOpusUpstreamCreditBusy(input = {}) {
    if (!input || typeof input !== "object") {
        return false;
    }

    const details =
        input.details && typeof input.details === "object"
            ? input.details
            : {};

    const rawCode = String(
        input.code ??
        input.error_code ??
        input.errorCode ??
        details.error_code ??
        details.errorCode ??
        details.code ??
        ""
    ).trim();

    const normCode = normalizeToken(rawCode);

    if (
        normCode === "opus_upstream_queue_busy" ||
        normCode === "credit_admission_rejected"
    ) {
        return true;
    }

    const combinedMessage = [
        input.message,
        input.error,
        input.error_message,
        details.error_message,
        details.error,
        details.message,
        details.history_update_payload?.error_message
    ]
        .filter(Boolean)
        .map(v => String(v))
        .join(" ");

    if (
        /saldo kredit akun opus labs/i.test(combinedMessage) ||
        /upstream opusclip/i.test(combinedMessage) ||
        /no provider request was made/i.test(combinedMessage) ||
        /credit_admission_rejected/i.test(combinedMessage)
    ) {
        return true;
    }

    const providerHint = String(
        input.providerCode ??
        input.provider_id ??
        input.provider ??
        details.provider_id ??
        details.provider ??
        ""
    )
        .trim()
        .toLowerCase();

    const modelHint = String(
        input.modelId ??
        input.model_id ??
        details.model_id ??
        ""
    )
        .trim()
        .toLowerCase();

    const isOpusContext =
        providerHint === "opus" ||
        providerHint.includes("opus") ||
        modelHint.startsWith("opus-");

    if (!isOpusContext) {
        return false;
    }

    const status = Number(
        input.status ??
        details.status ??
        0
    );

    const creditRefunded = Boolean(
        input.creditRefunded ??
        input.credit_refunded ??
        details.credit_refunded
    );

    const hasProviderField = Boolean(
        details.provider ||
        details.provider_id ||
        details.provider_status ||
        input.providerCode
    );

    /*
     * Jangan tertukar dengan HTTP 402 INSUFFICIENT_CREDITS milik saldo
     * user GEN-Z.AI sendiri sebelum provider dipanggil.
     */
    const isUserOwnBalanceShortage =
        status === 402 &&
        rawCode === "INSUFFICIENT_CREDITS" &&
        !creditRefunded &&
        !hasProviderField;

    if (isUserOwnBalanceShortage) {
        return false;
    }

    if (
        normCode === "insufficient_credits" ||
        normCode === "quota_exceeded"
    ) {
        return true;
    }

    if (
        /insufficient[\s_-]*credits/i.test(combinedMessage) &&
        (creditRefunded || hasProviderField)
    ) {
        return true;
    }

    return false;
}

function defaultSleep(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}

export async function waitWithQueueCountdown({
    runtimeMs = OPUS_QUEUE_RUNTIME_MS,
    tickMs = 1000,
    sleepFn = defaultSleep,
    shouldAbort = null,
    onTick = null
} = {}) {
    const totalMs = Math.max(0, Number(runtimeMs) || 0);
    const stepMs = Math.max(10, Number(tickMs) || 1000);
    let elapsedMs = 0;

    if (typeof onTick === "function") {
        onTick({
            remainingMs: totalMs,
            elapsedMs: 0,
            totalMs,
            formattedRemaining: formatQueueCountdown(totalMs)
        });
    }

    while (elapsedMs < totalMs) {
        if (typeof shouldAbort === "function" && shouldAbort()) {
            const abortErr = new Error("Generate dibatalkan.");
            abortErr.cancelled = true;
            throw abortErr;
        }

        const waitSlice = Math.min(stepMs, totalMs - elapsedMs);
        await sleepFn(waitSlice);
        elapsedMs += waitSlice;

        if (typeof shouldAbort === "function" && shouldAbort()) {
            const abortErr = new Error("Generate dibatalkan.");
            abortErr.cancelled = true;
            throw abortErr;
        }

        const remainingMs = Math.max(0, totalMs - elapsedMs);
        if (typeof onTick === "function") {
            onTick({
                remainingMs,
                elapsedMs,
                totalMs,
                formattedRemaining: formatQueueCountdown(remainingMs)
            });
        }
    }
}

function extractOpusPoolMetadata(error) {
    const details =
        error?.details && typeof error.details === "object"
            ? error.details
            : {};

    const rawPoolSize =
        error?.opus_key_pool_size ??
        error?.opusKeyPoolSize ??
        details.opus_key_pool_size ??
        details.opusKeyPoolSize ??
        0;
    const poolSize = Number(rawPoolSize);

    const rawSlot =
        error?.opus_key_slot ??
        error?.opusKeySlot ??
        error?.opusFailedKeySlot ??
        details.opus_key_slot ??
        details.opusKeySlot ??
        details.opusFailedKeySlot;
    const parsedSlot =
        rawSlot !== null &&
        rawSlot !== undefined &&
        rawSlot !== "" &&
        Number.isInteger(Number(rawSlot)) &&
        Number(rawSlot) >= 0
            ? Number(rawSlot)
            : null;

    const rotatedFullCycle = Boolean(
        error?.opus_rotated_full_cycle ??
        error?.rotatedFullCycle ??
        details.opus_rotated_full_cycle ??
        details.rotatedFullCycle
    );

    return {
        poolSize: Number.isFinite(poolSize) && poolSize > 0 ? Math.floor(poolSize) : 0,
        failedSlot: parsedSlot,
        rotatedFullCycle
    };
}

export async function runOpusQueueRetryLoop({
    executeAttempt,
    maxAttempts = OPUS_QUEUE_MAX_ATTEMPTS,
    runtimeMs = OPUS_QUEUE_RUNTIME_MS,
    tickMs = 1000,
    sleepFn = defaultSleep,
    isOpusError = isOpusUpstreamCreditBusy,
    isCancelledError = null,
    shouldAbort = null,
    onQueueWaitStart = null,
    onQueueWaitTick = null,
    onRetryAttemptStart = null,
    onKeySwitch = null
} = {}) {
    const safeMaxAttempts = Math.max(1, Math.floor(Number(maxAttempts) || OPUS_QUEUE_MAX_ATTEMPTS));
    const maxWaitRetries = Math.max(0, safeMaxAttempts - 1);
    const exhaustedKeySlots = new Set();

    for (let attempt = 1; attempt <= safeMaxAttempts; attempt += 1) {
        if (attempt > 1 && typeof onRetryAttemptStart === "function") {
            onRetryAttemptStart({
                attempt,
                maxAttempts: safeMaxAttempts,
                waitRetryIndex: attempt - 1,
                maxWaitRetries,
                statusLabel: OPUS_QUEUE_RETRY_STATUS_LABEL
            });
        }

        let cycleExhaustedError = null;

        while (true) {
            try {
                return await executeAttempt(attempt, safeMaxAttempts, {
                    attempt,
                    maxAttempts: safeMaxAttempts,
                    excludedOpusKeySlots: Array.from(exhaustedKeySlots)
                });
            } catch (error) {
                if (typeof isCancelledError === "function" && isCancelledError(error)) {
                    throw error;
                }

                if (!isOpusError(error)) {
                    throw error;
                }

                const { poolSize, failedSlot, rotatedFullCycle } = extractOpusPoolMetadata(error);

                /*
                 * Jika ada lebih dari 1 API key Opus di Cloudflare dan kegagalan
                 * terjadi asinkron pada 1 slot (mis. pada /api/generate-status
                 * setelah job sempat masuk status queued), LANGSUNG beralih ke
                 * API key berikutnya tanpa menunggu jeda 5 menit sampai seluruh
                 * pool key benar-benar sudah dicoba 1 putaran penuh.
                 */
                if (
                    !rotatedFullCycle &&
                    poolSize > 1 &&
                    failedSlot !== null &&
                    !exhaustedKeySlots.has(failedSlot)
                ) {
                    exhaustedKeySlots.add(failedSlot);
                    if (exhaustedKeySlots.size < poolSize) {
                        if (typeof onKeySwitch === "function") {
                            onKeySwitch({
                                attempt,
                                maxAttempts: safeMaxAttempts,
                                failedKeySlot: failedSlot,
                                exhaustedKeySlots: Array.from(exhaustedKeySlots),
                                keyPoolSize: poolSize
                            });
                        }
                        continue;
                    }
                }

                exhaustedKeySlots.clear();
                cycleExhaustedError = error;
                break;
            }
        }

        const error = cycleExhaustedError;

        if (attempt >= safeMaxAttempts) {
            const finalBusyError = new Error(OPUS_QUEUE_FINAL_ERROR_MESSAGE);
            finalBusyError.code = OPUS_SYSTEM_BUSY_FINAL_CODE;
            finalBusyError.attempts = attempt;
            finalBusyError.waitRetries = maxWaitRetries;
            finalBusyError.isRedErrorNotification = true;
            finalBusyError.suppressRefundSuffix = true;
            finalBusyError.details = error?.details || null;
            throw finalBusyError;
        }

        const initialFormatted = formatQueueCountdown(runtimeMs);
        const waitRetryIndex = attempt;

        if (typeof onQueueWaitStart === "function") {
            onQueueWaitStart({
                attempt,
                nextAttempt: attempt + 1,
                maxAttempts: safeMaxAttempts,
                waitRetryIndex,
                maxWaitRetries,
                runtimeMs,
                formattedRemaining: initialFormatted,
                message: OPUS_QUEUE_WAIT_MESSAGE,
                statusLabel: OPUS_QUEUE_RETRY_STATUS_LABEL,
                lastError: error
            });
        }

        await waitWithQueueCountdown({
            runtimeMs,
            tickMs,
            sleepFn,
            shouldAbort,
            onTick: tickInfo => {
                if (typeof onQueueWaitTick === "function") {
                    onQueueWaitTick({
                        attempt,
                        nextAttempt: attempt + 1,
                        maxAttempts: safeMaxAttempts,
                        waitRetryIndex,
                        maxWaitRetries,
                        message: OPUS_QUEUE_WAIT_MESSAGE,
                        statusLabel: OPUS_QUEUE_RETRY_STATUS_LABEL,
                        ...tickInfo
                    });
                }
            }
        });
    }

    const fallbackError = new Error(OPUS_QUEUE_FINAL_ERROR_MESSAGE);
    fallbackError.code = OPUS_SYSTEM_BUSY_FINAL_CODE;
    fallbackError.suppressRefundSuffix = true;
    throw fallbackError;
}
