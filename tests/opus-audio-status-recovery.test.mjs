/* =========================================================
   GEN-Z.AI — REGRESI STATUS AUDIO OPUS YANG MENGGANTUNG
   ---------------------------------------------------------
   Kasus nyata (2026-11-03 06:47 UTC):
   generation_history `opus-audio-music` dengan task_id `opus-k1:...`
   tetap `processing` padahal job sudah selesai di Opus Web.

   Akar: getAudioTaskForSingleKey() mengembalikan QUEUED untuk
   `job_not_found` dan memaksa PROCESSING untuk `COMPLETED` tanpa
   URL. runGetWithKeyPool() lalu langsung return hasil dari slot
   kunci pertama, sehingga slot lain tidak pernah dicoba.

   Tes ini menjaga:
   1. Status retryable mencoba semua slot kunci sebelum menyerah.
   2. "COMPLETED tanpa URL" membawa alasan yang bisa dibaca API.
   3. Pencarian job lepas (targetJobId kosong) tetap ada.
   4. Alasan diteruskan adapter -> /api/generate-status.
   5. Ada batas waktu terminal + refund, bukan PROCESSING abadi.
   6. Tombol Refresh manual benar-benar mereset failure tracker.
========================================================= */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { getAudioTask } from "../provider/opus/client.js";
import { opusAudioModelMap } from "../models/opus-audio/index.js";
import { shouldFinalizeUnresolvedOpusAudio } from "../api/generate-status.js";

const repoRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    ".."
);

function source(relative) {
    return readFileSync(path.join(repoRoot, relative), "utf8");
}

const TASK_ID =
    "opus-k1:gen_c9ab2acae4b51bb92f147b977389c9ca1d09e6c82da91b2a78507e29c7f174e1" +
    ":71b846e1-addb-4e98-b40e-f13d9c376269";

const AUDIO_URL = "https://cdn.opus.test/audio/recovered.mp3";
const KEY_POOL = ["sk-slot-0", "sk-slot-1"];

function statusSchema() {
    return {
        type: "object",
        properties: {
            jobId: { type: "string" },
            projectId: { type: "string" }
        }
    };
}

function fakeSession({ responder, tools = ["get_status"] }) {
    const calls = [];
    const toolList = tools.map(name => ({
        name,
        inputSchema: statusSchema()
    }));

    return {
        calls,
        session: {
            tools: toolList,
            async callTool(name, args) {
                calls.push({ name, args });
                const answer = await responder(name, args, calls.length);
                return {
                    isError: Boolean(answer.isError),
                    data: answer.data,
                    content: answer.content || [],
                    text: answer.text || JSON.stringify(answer.data)
                };
            }
        }
    };
}

function completedWithUrl() {
    return {
        isError: false,
        data: { status: "COMPLETED", audioUrl: AUDIO_URL },
        content: [],
        text: JSON.stringify({ status: "COMPLETED", audioUrl: AUDIO_URL })
    };
}

function completedWithoutUrl() {
    return {
        isError: false,
        data: { status: "COMPLETED", outputs: [] },
        content: [],
        text: JSON.stringify({ status: "COMPLETED", outputs: [] })
    };
}

function jobNotFound() {
    return {
        isError: true,
        data: { error: { code: "job_not_found", message: "job_not_found" } },
        content: [],
        text: JSON.stringify({ error: { code: "job_not_found" } })
    };
}

/* =========================================================
   1. FUNGSIONAL — job_not_found TIDAK BOLEH MENGUNCI SLOT 1
   ========================================================= */

test("job_not_found di slot preferred mencoba slot kunci lain sampai ketemu hasil", async () => {
    const { session, calls } = fakeSession({
        responder: async (_name, _args, index) =>
            index === 1 ? jobNotFound() : completedWithUrl()
    });

    const result = await getAudioTask(TASK_ID, KEY_POOL, {
        existingSession: session,
        env: {}
    });

    assert.equal(calls.length, 2, "dua slot kunci harus dicoba");
    assert.equal(result.status, "COMPLETED");
    assert.deepEqual(result.audioUrls, [AUDIO_URL]);
    assert.equal(result.keySlot, 0, "hasil ditemukan di slot fallback");
    assert.equal(result.keyPoolSize, 2);
});

test("semua slot job_not_found tetap QUEUED, bukan error 502", async () => {
    const { session, calls } = fakeSession({
        responder: async () => jobNotFound()
    });

    const result = await getAudioTask(TASK_ID, KEY_POOL, {
        existingSession: session,
        env: {}
    });

    assert.equal(calls.length, 2, "semua slot tetap dicoba");
    assert.equal(result.status, "QUEUED");
    assert.equal(result.statusReason, "OPUS_JOB_NOT_FOUND");
    assert.equal(result.keyPoolSize, 2);
});

/* =========================================================
   2. FUNGSIONAL — COMPLETED TANPA URL HARUS TERDIAGNOSA
   ========================================================= */

test("COMPLETED tanpa URL di semua slot membawa statusReason, tidak throw", async () => {
    const { session, calls } = fakeSession({
        responder: async () => completedWithoutUrl()
    });

    const result = await getAudioTask(TASK_ID, KEY_POOL, {
        existingSession: session,
        env: {}
    });

    assert.equal(calls.length, 2);
    assert.equal(result.status, "PROCESSING");
    assert.equal(result.statusReason, "OPUS_COMPLETED_WITHOUT_OUTPUT");
    assert.equal(result.retryableKeySlot, true);
    assert.deepEqual(result.audioUrls, []);
    assert.equal(result.keyPoolSize, 2);
});

test("list_jobs project memulihkan URL walau get_status tidak mengirim URL", async () => {
    const listed = {
        jobs: [
            {
                jobId: "internal-job-xyz",
                status: "COMPLETED",
                audioUrl: AUDIO_URL
            }
        ]
    };

    const { session } = fakeSession({
        tools: ["get_status", "list_jobs", "resolve_job"],
        responder: async name => {
            if (name === "list_jobs") {
                return {
                    isError: false,
                    data: listed,
                    content: [],
                    text: JSON.stringify(listed)
                };
            }
            if (name === "resolve_job") return completedWithoutUrl();
            return completedWithoutUrl();
        }
    });

    const result = await getAudioTask(TASK_ID, KEY_POOL, {
        existingSession: session,
        env: {}
    });

    assert.equal(result.status, "COMPLETED");
    assert.deepEqual(result.audioUrls, [AUDIO_URL]);
});

/* =========================================================
   3. ADAPTER — statusReason TERUSKAN KE /api/generate-status
   ========================================================= */

test("factory opus-audio meneruskan statusReason ke response dan raw", async () => {
    const { session } = fakeSession({
        responder: async () => completedWithoutUrl()
    });

    const model = opusAudioModelMap["opus-audio-music"];
    assert.ok(model, "model opus-audio-music harus terdaftar");

    const result = await model.queryTask(TASK_ID, KEY_POOL, {
        existingSession: session,
        env: {}
    });

    assert.equal(result.status, "PROCESSING");
    assert.equal(result.statusReason, "OPUS_COMPLETED_WITHOUT_OUTPUT");
    assert.equal(result.raw.status_reason, "OPUS_COMPLETED_WITHOUT_OUTPUT");
    assert.equal(result.completed, false);
    assert.deepEqual(result.outputUrls, []);
});

/* =========================================================
   4. BATAS WAKTU TERMINAL (keputusan murni, tanpa I/O)
   ========================================================= */

const HOUR = 60 * 60 * 1000;

test("audio unresolved baru tidak langsung ditandai gagal", () => {
    assert.equal(
        shouldFinalizeUnresolvedOpusAudio(
            {
                statusReason: "OPUS_COMPLETED_WITHOUT_OUTPUT",
                createdAtMs: 10_000 * HOUR
            },
            10_000 * HOUR + 5 * 60 * 1000
        ),
        false
    );
});

test("audio unresolved lebih dari 60 menit ditandai terminal", () => {
    assert.equal(
        shouldFinalizeUnresolvedOpusAudio(
            {
                statusReason: "OPUS_JOB_NOT_FOUND",
                createdAtMs: 10_000 * HOUR
            },
            10_000 * HOUR + HOUR + 1
        ),
        true
    );
});

test("dua alasan unresolved sama-sama terkena batas waktu", () => {
    for (const reason of [
        "OPUS_JOB_NOT_FOUND",
        "OPUS_COMPLETED_WITHOUT_OUTPUT"
    ]) {
        assert.equal(
            shouldFinalizeUnresolvedOpusAudio(
                { statusReason: reason, createdAtMs: 0 },
                2 * HOUR
            ),
            true
        );
    }
});

test("status terminal provider atau usia task tidak valid tidak di-finalisasi", () => {
    assert.equal(
        shouldFinalizeUnresolvedOpusAudio(
            {
                statusReason: "OPUS_JOB_NOT_FOUND",
                completed: true,
                createdAtMs: 0
            },
            2 * HOUR
        ),
        false
    );
    assert.equal(
        shouldFinalizeUnresolvedOpusAudio(
            {
                statusReason: "OPUS_JOB_NOT_FOUND",
                failed: true,
                createdAtMs: 0
            },
            2 * HOUR
        ),
        false
    );
    assert.equal(
        shouldFinalizeUnresolvedOpusAudio(
            { statusReason: "OPUS_JOB_NOT_FOUND", createdAtMs: NaN },
            2 * HOUR
        ),
        false
    );
    assert.equal(
        shouldFinalizeUnresolvedOpusAudio({ createdAtMs: 0 }, 2 * HOUR),
        false
    );
});

/* =========================================================
   5. GUARD SUMBER — TIDAK BOLEH KEMBALI KE PERILAKU LAMA
   ========================================================= */

test("audio-tools menandai dua pintu non-terminal sebagai retryable", () => {
    const text = source("provider/opus/audio-tools.js");

    assert.match(text, /statusReason:\s*"OPUS_JOB_NOT_FOUND"/);
    assert.match(text, /statusReason:\s*"OPUS_COMPLETED_WITHOUT_OUTPUT"/);

    const retryableCount = (text.match(/retryableKeySlot:\s*true/g) || []).length;
    assert.equal(
        retryableCount,
        2,
        "QUEUED job_not_found dan PROCESSING tanpa URL keduanya retryable"
    );

    assert.match(
        text,
        /result\?\.retryableKeySlot === true && c \+ 1 < candidateSlots\.length/
    );
    assert.match(text, /if \(lastRetryableResult\)/);
    assert.match(text, /targetJobId:\s*""/);
});

test("history manual refresh mereset failure tracker", () => {
    const text = source("history/assets/js/history-status-sync.js");

    assert.match(text, /failedSyncTracker\.clear\(\)/);
    assert.match(text, /probedNonTerminalTasks\.clear\(\)/);

    const marker = text.indexOf("async function refreshActiveGenerationStatus()");
    assert.ok(marker > 0, "fungsi refresh manual harus ada");
    const body = text.slice(marker, marker + 900);
    assert.match(body, /failedSyncTracker\.clear\(\)/);
    assert.match(body, /await syncActiveGenerations\(\)/);
});

test("pin cache history-status-sync dibump agar browser tidak pakai JS lama", () => {
    const html = source("history/index.html");

    assert.match(
        html,
        /history-status-sync\.js\?v=20261103-audio-status-recovery/
    );
    assert.doesNotMatch(html, /history-status-sync\.js\?v=20261031-opus-24h/);
});

test("generate-status punya batas terminal + refund untuk audio tanpa hasil", () => {
    const text = source("api/generate-status.js");

    assert.match(text, /const OPUS_AUDIO_NO_OUTPUT_DEADLINE_MS =\s*\n\s*60 \* 60 \* 1000/);
    assert.match(text, /OPUS_AUDIO_NO_OUTPUT_REASON/);
    assert.match(text, /OPUS_AUDIO_JOB_NOT_FOUND_REASON/);
    assert.match(text, /OPUS_AUDIO_UNRESOLVED_REASONS/);
    assert.match(text, /"OPUS_COMPLETED_WITHOUT_OUTPUT"/);
    assert.match(text, /"OPUS_JOB_NOT_FOUND"/);
    assert.match(text, /OPUS_AUDIO_NO_OUTPUT_CODE/);
    assert.match(text, /Kredit telah dikembalikan/);
    assert.match(text, /Black Box → Resolve Job/);
    assert.match(text, /isOpusAudioModelId\(modelId\)/);
    assert.match(text, /opus_status_reason:/);
    assert.match(text, /cleanString\(providerRaw\?\.statusReason\)/);
    assert.match(text, /statusReason:\s*providerRaw\.statusReason/);
    assert.match(text, /shouldFinalizeUnresolvedOpusAudio\(\{/);
});

test("konstanta baru tidak mengubah deadline video 24 jam", () => {
    const text = source("api/generate-status.js");

    assert.match(
        text,
        /OPUS_NON_TERMINAL_DEADLINE_MAX_AGE_MS =\s*\n\s*24 \* 60 \* 60 \* 1000/
    );
});

test("factory dan generate-status konsisten memakai nama field statusReason", () => {
    const factory = source("models/opus-audio/factory.js");

    assert.match(factory, /statusReason:\s*result\.statusReason \|\| null/);
    assert.match(factory, /status_reason:\s*result\.statusReason/);
});
