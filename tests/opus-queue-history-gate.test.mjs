import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
    OPUS_QUEUE_MAX_ATTEMPTS,
    OPUS_QUEUE_MAX_WAIT_RETRIES,
    buildOpusQueueAttemptFields,
    resolveOpusQueueAttemptState,
    shouldRecordOpusFailureHistory,
    shouldSuppressOpusBusyFailureHistory
} from "../generate/assets/js/opus-queue-retry.js";

import {
    buildGeneratePayload
} from "../generate/assets/js/generate-request.js";

import {
    setCurrentModel
} from "../generate/assets/js/generate-state.js";

/* =========================================================
   GUARD: HISTORY SAAT ROTASI API KEY OPUS
   ---------------------------------------------------------
   Aturan yang dijaga tes ini:

   1. Selama proses masih berpindah API key (atau menunggu jeda
      5 menit), History TIDAK boleh menampilkan "generate gagal".
   2. "Generate gagal" baru muncul saat sistem benar-benar STOP:
      seluruh API key sudah dicoba 1 putaran penuh, kembali ke
      key pertama, lalu 3 kali mencoba lagi masing-masing jeda
      5 menit (5 menit key 1, 5 menit key 2, 5 menit key 3).
   ========================================================= */

const repoRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    ".."
);

function source(relative) {
    return readFileSync(path.join(repoRoot, relative), "utf8");
}

/* =========================================================
   1. HELPER STATUS PERCOBAAN
   ========================================================= */

test("resolveOpusQueueAttemptState: tanpa metadata dianggap percobaan final (perilaku lama aman)", () => {
    const state = resolveOpusQueueAttemptState({});

    assert.equal(state.attempt, 1);
    assert.equal(state.maxAttempts, 1);
    assert.equal(state.isFinalAttempt, true);
    assert.equal(state.suppressFailureHistory, false);
    assert.equal(state.remainingAttempts, 0);

    assert.deepEqual(
        resolveOpusQueueAttemptState(null),
        resolveOpusQueueAttemptState()
    );
});

test("resolveOpusQueueAttemptState: 1 + 3 kali jeda 5 menit => percobaan 1..3 menahan history, percobaan 4 final", () => {
    assert.equal(OPUS_QUEUE_MAX_WAIT_RETRIES, 3);
    assert.equal(OPUS_QUEUE_MAX_ATTEMPTS, 4);

    const perAttempt = [];
    for (let attempt = 1; attempt <= OPUS_QUEUE_MAX_ATTEMPTS; attempt += 1) {
        const state = resolveOpusQueueAttemptState({
            opus_queue_attempt: attempt,
            opus_queue_max_attempts: OPUS_QUEUE_MAX_ATTEMPTS
        });
        perAttempt.push(state);
    }

    assert.deepEqual(
        perAttempt.map(state => state.suppressFailureHistory),
        [true, true, true, false],
        "percobaan 1-3 tidak boleh menulis GAGAL, percobaan 4 boleh"
    );

    assert.deepEqual(
        perAttempt.map(state => state.isFinalAttempt),
        [false, false, false, true]
    );

    assert.deepEqual(
        perAttempt.map(state => state.remainingAttempts),
        [3, 2, 1, 0]
    );
});

test("resolveOpusQueueAttemptState: input rusak / melewati batas tetap aman", () => {
    const corrupted = resolveOpusQueueAttemptState({
        opus_queue_attempt: "abc",
        opus_queue_max_attempts: -5
    });
    assert.equal(corrupted.attempt, 1);
    assert.equal(corrupted.maxAttempts, 1);
    assert.equal(corrupted.isFinalAttempt, true);

    const beyond = resolveOpusQueueAttemptState({
        opus_queue_attempt: 9,
        opus_queue_max_attempts: 4
    });
    assert.equal(beyond.isFinalAttempt, true);
    assert.equal(beyond.suppressFailureHistory, false);
});

test("buildOpusQueueAttemptFields hanya mengirim metadata bila memang ada beberapa percobaan", () => {
    assert.deepEqual(
        buildOpusQueueAttemptFields({ attempt: 2, maxAttempts: 4 }),
        { opus_queue_attempt: 2, opus_queue_max_attempts: 4 }
    );

    assert.deepEqual(
        buildOpusQueueAttemptFields({ attempt: 1, maxAttempts: 1 }),
        {}
    );

    assert.deepEqual(
        buildOpusQueueAttemptFields({}),
        {}
    );
});

/* =========================================================
   2. GATE PENULISAN HISTORY
   ========================================================= */

test("shouldRecordOpusFailureHistory: kredit upstream habis HANYA ditulis pada percobaan terakhir", () => {
    const intermediate = resolveOpusQueueAttemptState({
        opus_queue_attempt: 2,
        opus_queue_max_attempts: 4
    });
    const final = resolveOpusQueueAttemptState({
        opus_queue_attempt: 4,
        opus_queue_max_attempts: 4
    });

    assert.equal(
        shouldRecordOpusFailureHistory({
            opusQueueBusy: true,
            creditDeducted: false,
            attemptState: intermediate
        }),
        false,
        "pindah API key / masih jeda 5 menit -> jangan tampilkan GAGAL"
    );

    assert.equal(
        shouldRecordOpusFailureHistory({
            opusQueueBusy: true,
            creditDeducted: false,
            attemptState: final
        }),
        true,
        "percobaan terakhir -> tulis satu baris GAGAL"
    );
});

test("shouldRecordOpusFailureHistory: error non-antrian tetap dicatat seperti sebelumnya", () => {
    const intermediate = resolveOpusQueueAttemptState({
        opus_queue_attempt: 1,
        opus_queue_max_attempts: 4
    });

    assert.equal(
        shouldRecordOpusFailureHistory({
            opusQueueBusy: false,
            creditDeducted: false,
            attemptState: intermediate
        }),
        true,
        "konten ditolak / parameter salah tetap muncul di History"
    );

    assert.equal(
        shouldRecordOpusFailureHistory({
            opusQueueBusy: false,
            creditDeducted: true,
            attemptState: intermediate
        }),
        false,
        "kredit belum berhasil dikembalikan -> jangan catat gagal"
    );
});

test("shouldSuppressOpusBusyFailureHistory: baris History percobaan antara ditahan", () => {
    const intermediate = resolveOpusQueueAttemptState({
        opus_queue_attempt: 3,
        opus_queue_max_attempts: 4
    });
    const final = resolveOpusQueueAttemptState({
        opus_queue_attempt: 4,
        opus_queue_max_attempts: 4
    });

    assert.equal(
        shouldSuppressOpusBusyFailureHistory({
            opusUpstreamBusyFailure: true,
            failed: true,
            attemptState: intermediate
        }),
        true
    );

    assert.equal(
        shouldSuppressOpusBusyFailureHistory({
            opusUpstreamBusyFailure: true,
            failed: true,
            attemptState: final
        }),
        false,
        "percobaan terakhir wajib menulis GAGAL"
    );

    assert.equal(
        shouldSuppressOpusBusyFailureHistory({
            opusUpstreamBusyFailure: false,
            failed: true,
            attemptState: intermediate
        }),
        false
    );

    assert.equal(
        shouldSuppressOpusBusyFailureHistory({
            opusUpstreamBusyFailure: true,
            failed: false,
            attemptState: intermediate
        }),
        false,
        "task yang masih berjalan jangan ditahan"
    );
});

/* =========================================================
   3. PAYLOAD KLIEN
   ========================================================= */

test("buildGeneratePayload meneruskan opus_queue_attempt / opus_queue_max_attempts", () => {
    setCurrentModel({
        model_id: "opus-seedance-2.5-i2v",
        name: "Seedance 2.5 I2V",
        provider_id: "opus"
    });

    const withAttempt = buildGeneratePayload(
        { prompt: "Ombak pantai saat senja" },
        {
            opusQueueAttempt: 2,
            opusQueueMaxAttempts: 4,
            opusExcludeKeySlots: [0]
        }
    );

    assert.equal(withAttempt.opus_queue_attempt, 2);
    assert.equal(withAttempt.opus_queue_max_attempts, 4);
    assert.deepEqual(withAttempt.opus_exclude_key_slots, [0]);

    const withoutAttempt = buildGeneratePayload(
        { prompt: "Ombak pantai saat senja" },
        {}
    );

    assert.equal("opus_queue_attempt" in withoutAttempt, false);
    assert.equal("opus_queue_max_attempts" in withoutAttempt, false);
});

test("halaman generate meneruskan nomor percobaan ke /api/generate dan /api/generate-status", () => {
    const submit = source("generate/assets/js/generate-submit.js");
    const polling = source("generate/assets/js/generate-polling.js");

    assert.match(submit, /opusQueueAttempt:\s*queueAttempt/);
    assert.match(submit, /opusQueueMaxAttempts:\s*queueMaxAttempts/);
    assert.match(
        submit,
        /const queueAttempt =\s*Number\(retryContext\?\.attempt\) \|\| 1;/
    );
    assert.match(submit, /OPUS_QUEUE_MAX_ATTEMPTS/);

    assert.match(
        polling,
        /opusQueueAttempt:\s*normalizeNumber\(\s*options\.opusQueueAttempt/s
    );
    assert.match(
        polling,
        /\.\.\.buildOpusQueueAttemptFields\(\{[\s\S]*?opusQueueAttempt[\s\S]*?\}\)/
    );
});

/* =========================================================
   4. BACKEND
   ========================================================= */

test("api/generate.js memakai gate history dan menulis GAGAL dengan notif merah final", () => {
    const generate = source("api/generate.js");

    assert.match(generate, /resolveOpusQueueAttemptState\(body\)/);
    assert.match(generate, /shouldRecordOpusFailureHistory\(\{/);
    assert.match(generate, /suppressOpusBusyFailureHistory/);

    // Baris GAGAL pada percobaan terakhir memakai pesan notif merah yang sama.
    assert.match(
        generate,
        /errorMessage:\s*opusQueueBusy\s*\?\s*OPUS_QUEUE_FINAL_ERROR_MESSAGE\s*:\s*resolvedCreateErrorMessage/
    );

    // History tetap ditulis untuk error non-antrian (regresi lama terjaga).
    assert.match(generate, /shouldWriteFailureHistory/);
});

test("api/generate-status.js membuang baris percobaan antara: refund dulu, lalu hapus baris", () => {
    const status = source("api/generate-status.js");

    assert.match(status, /shouldSuppressOpusBusyFailureHistory\(\{/);
    assert.match(status, /discardIntermediateOpusAttemptHistory/);

    const helperIndex = status.indexOf("async function discardIntermediateOpusAttemptHistory");
    assert.ok(helperIndex > -1, "helper pembuang baris percobaan antara wajib ada");

    const helperBody = status.slice(helperIndex, helperIndex + 4000);

    const patchIndex = helperBody.indexOf('status: "failed"');
    const refundIndex = helperBody.indexOf("refundFailedGenerationCredits(");
    const deleteIndex = helperBody.indexOf('method: "DELETE"');

    assert.ok(patchIndex > -1 && refundIndex > patchIndex);
    assert.ok(
        deleteIndex > refundIndex,
        "urutan wajib: tandai failed -> refund -> hapus baris"
    );

    // Refund tetap berjalan walau baris dihapus.
    assert.match(helperBody, /let refund = null;/);
    assert.match(helperBody, /history_removed: removed/);
});

test("api/generate-status.js hanya menahan percobaan antara, percobaan terakhir tetap failed", () => {
    const status = source("api/generate-status.js");

    assert.match(
        status,
        /const history = suppressOpusBusyFailureHistory[\s\S]{0,120}discardIntermediateOpusAttemptHistory/
    );
    assert.match(
        status,
        /if \(\s*normalized\.failed &&\s*!suppressOpusBusyFailureHistory\s*\)/
    );
    assert.match(status, /failure_history_suppressed:\s*suppressOpusBusyFailureHistory/);
});

/* =========================================================
   5. SIMULASI PENUH: 3 API KEY x 4 PERCOBAAN
   ---------------------------------------------------------
   Meniru alur nyata halaman generate:
   - tiap percobaan memutar seluruh pool API key (3 key)
   - percobaan 1..3 berakhir dengan "masih ada percobaan berikutnya"
   - percobaan 4 = STOP
   Hasil yang diharapkan: TEPAT SATU baris GAGAL di History,
   yaitu pada percobaan terakhir, dengan notif merah final.
   ========================================================= */

test("simulasi 3 API key: 12 submit key, jeda 5 menit x3, dan hanya 1 baris GAGAL di History", async () => {
    const {
        OPUS_QUEUE_FINAL_ERROR_MESSAGE,
        OPUS_SYSTEM_BUSY_FINAL_CODE,
        runOpusQueueRetryLoop
    } = await import("../generate/assets/js/opus-queue-retry.js");

    const KEY_POOL_SIZE = 3;
    const keySubmissions = [];
    const pauseDurations = [];
    const historyWrites = [];

    const fakeBackendAttempt = async (attempt, maxAttempts) => {
        const attemptState = resolveOpusQueueAttemptState({
            opus_queue_attempt: attempt,
            opus_queue_max_attempts: maxAttempts
        });

        /* Semua API key dicoba berurutan pada percobaan ini. */
        for (let slot = 0; slot < KEY_POOL_SIZE; slot += 1) {
            keySubmissions.push({ attempt, slot });
        }

        const busyError = new Error("Saldo kredit akun Opus Labs (upstream OpusClip) tidak mencukupi.");
        busyError.code = "credit_admission_rejected";
        busyError.opus_key_slot = KEY_POOL_SIZE - 1;
        busyError.opus_key_pool_size = KEY_POOL_SIZE;
        busyError.rotatedFullCycle = true;

        /* Backend: tulis baris GAGAL hanya kalau gate membolehkan. */
        if (
            shouldRecordOpusFailureHistory({
                opusQueueBusy: true,
                creditDeducted: false,
                attemptState
            })
        ) {
            historyWrites.push({
                attempt,
                message: OPUS_QUEUE_FINAL_ERROR_MESSAGE
            });
        }

        throw busyError;
    };

    await assert.rejects(
        async () => {
            await runOpusQueueRetryLoop({
                sleepFn: async ms => {
                    pauseDurations.push(ms);
                },
                tickMs: 5 * 60 * 1000,
                executeAttempt: async (attempt, maxAttempts) => {
                    return await fakeBackendAttempt(attempt, maxAttempts);
                }
            });
        },
        err => {
            assert.equal(err.code, OPUS_SYSTEM_BUSY_FINAL_CODE);
            assert.equal(err.message, "SISTEM SEDANG SIBUK, SILAHKAN COBA LAGI");
            return true;
        }
    );

    assert.equal(keySubmissions.length, KEY_POOL_SIZE * 4);
    assert.deepEqual(
        keySubmissions.filter(item => item.attempt === 1).map(item => item.slot),
        [0, 1, 2],
        "percobaan awal memutar key 1 -> 2 -> 3"
    );
    assert.deepEqual(pauseDurations, [300000, 300000, 300000]);

    assert.equal(
        historyWrites.length,
        1,
        "selama rotasi API key tidak ada baris GAGAL; hanya sekali saat STOP"
    );
    assert.equal(historyWrites[0].attempt, 4);
    assert.equal(historyWrites[0].message, "SISTEM SEDANG SIBUK, SILAHKAN COBA LAGI");
});
