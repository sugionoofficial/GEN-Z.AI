import test from "node:test";
import assert from "node:assert/strict";
import openKeyClient from "../provider/openkey/client.js";

test("aborts a hung OpenKey request at its configured timeout", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (_url, { signal }) => new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    });

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
        globalThis.fetch = originalFetch;
    }
});
