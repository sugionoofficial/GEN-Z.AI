import test from "node:test";
import assert from "node:assert/strict";
import openKeyClient from "../provider/openkey/client.js";

test("aborts a hung OpenKey request at its configured timeout", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (_url, { signal }) => new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    });

    /*
     * Client memakai AbortSignal.timeout(), dan timer internal Node
     * untuk AbortSignal.timeout() sengaja dibuat unref'd.
     *
     * Akibatnya, saat seluruh suite hampir selesai dan event loop
     * mengering, timer abort belum sempat fire: promise fetch menggantung
     * dan Node membatalkan test dengan "cancelledByParent"
     * ("Promise resolution is still pending but the event loop has already
     * resolved").
     *
     * Interval di bawah menahan event loop tetap hidup sampai abort
     * benar-benar terjadi, sehingga timeout ikut tervalidasi.
     */
    const keepAlive = setInterval(() => {}, 10);

    try {
        await assert.rejects(
            openKeyClient.request("/models", {
                apiKey: "test-api-key",
                timeoutMs: 5
            }),
            error => error.code === "OPENKEY_TIMEOUT_ERROR" &&
                error.message === "Waktu tunggu permintaan OpenKey habis."
        );
    } finally {
        clearInterval(keepAlive);
        globalThis.fetch = originalFetch;
    }
});
