import fs from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const pollingSource = await fs.readFile(
    new URL("../generate/assets/js/generate-polling.js", import.meta.url),
    "utf8"
);
const authStubUrl = `data:text/javascript,${encodeURIComponent(
    "export async function getAccessToken() { return 'test-access-token'; }"
)}`;
const fastPollingSource = pollingSource.replace(
    /const RETRY_BASE_DELAY_MS =\s+1000;/,
    "const RETRY_BASE_DELAY_MS = 1;"
);
const pollingUrl = `data:text/javascript,${encodeURIComponent(fastPollingSource.replace(
    'from "./generate-auth.js"',
    `from "${authStubUrl}"`
))}`;
const { pollTask } = await import(pollingUrl);

test("waits for any model's terminal result across time and temporary status errors", async () => {
    const originalFetch = globalThis.fetch;
    const originalDateNow = Date.now;
    const originalWindow = globalThis.window;
    let now = originalDateNow();
    let requestCount = 0;
    globalThis.window = { GENZ_DEBUG: false };
    Date.now = () => now;
    globalThis.fetch = async () => {
        requestCount += 1;
        if (requestCount <= 5) {
            return new Response(JSON.stringify({
                success: false,
                error: "Provider status temporarily unavailable"
            }), {
                status: requestCount % 2 === 0 ? 400 : 503,
                headers: { "Content-Type": "application/json" }
            });
        }

        if (requestCount === 6) {
            now += 16 * 60 * 1000;
            return new Response(JSON.stringify({
                success: true,
                task_id: "motiongen-job-test",
                model_id: "seedance-25-studio-s14",
                state: "processing",
                provider_state: "PROCESSING",
                processing: true
            }), {
                status: 200,
                headers: { "Content-Type": "application/json" }
            });
        }

        return new Response(JSON.stringify({
            success: true,
            task_id: "motiongen-job-test",
            model_id: "seedance-25-studio-s14",
            state: "completed",
            provider_state: "COMPLETED",
            completed: true,
            history_updated: true,
            history_status: "success",
            result_urls: ["https://cdn.example/result.mp4"]
        }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
        });
    };

    try {
        const result = await pollTask("motiongen-job-test", {
            modelId: "seedance-25-studio-s14",
            interval: 1000,
            retryUntilTerminal: true
        });

        assert.equal(requestCount, 7);
        assert.equal(result.completed, true);
        assert.deepEqual(result.result_urls, ["https://cdn.example/result.mp4"]);
    } finally {
        globalThis.fetch = originalFetch;
        Date.now = originalDateNow;
        if (originalWindow === undefined) {
            delete globalThis.window;
        } else {
            globalThis.window = originalWindow;
        }
    }
});

test("pollTask mengekstrak pesan error spesifik dari error_message atau history_update_payload saat task failed", async () => {
    const originalFetch = globalThis.fetch;
    const originalWindow = globalThis.window;
    globalThis.window = { GENZ_DEBUG: false };

    globalThis.fetch = async () =>
        new Response(
            JSON.stringify({
                success: true,
                task_id: "opus:gen_test:job_failed_1",
                model_id: "opus-seedance-2.5-i2v",
                state: "failed",
                provider_state: "FAILED",
                processing: false,
                completed: false,
                failed: true,
                credit_refunded: true,
                refunded_credit: 5000,
                history_update_payload: {
                    status: "failed",
                    error_message: "Saldo kredit akun Opus Labs (upstream OpusClip) tidak mencukupi untuk durasi/resolusi video ini."
                }
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );

    try {
        await assert.rejects(
            () =>
                pollTask("opus:gen_test:job_failed_1", {
                    modelId: "opus-seedance-2.5-i2v",
                    interval: 10
                }),
            err => {
                assert.match(err.message, /Saldo kredit akun Opus Labs/i);
                assert.equal(err.details?.credit_refunded, true);
                assert.equal(err.details?.refunded_credit, 5000);
                return true;
            }
        );
    } finally {
        globalThis.fetch = originalFetch;
        if (originalWindow === undefined) {
            delete globalThis.window;
        } else {
            globalThis.window = originalWindow;
        }
    }
});

