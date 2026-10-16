import fs from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const values = new Map();
globalThis.window = {
    sessionStorage: {
        getItem(key) {
            return values.get(key) ?? null;
        },
        setItem(key, value) {
            values.set(key, value);
        },
        removeItem(key) {
            values.delete(key);
        }
    }
};

const source = await fs.readFile(
    new URL("../assets/js/generation-regenerate.js", import.meta.url),
    "utf8"
);
await import(`data:text/javascript,${encodeURIComponent(source)}`);

const regenerate = window.GENZRegenerate;

test("stores and reads a one-time regeneration payload", () => {
    const payload = {
        modelId: "video-model",
        parameters: {
            prompt: "A test prompt",
            duration: 8
        }
    };

    assert.equal(regenerate.save(payload), true);
    assert.deepEqual(regenerate.read(), {
        version: 1,
        ...payload
    });
    assert.equal(regenerate.clear(), true);
    assert.equal(regenerate.read(), null);
});

test("rejects Vision tasks from regeneration", () => {
    assert.equal(
        regenerate.isVisionTask({
            task_id: "vision-123",
            provider_id: "openkey"
        }),
        true
    );
    assert.equal(
        regenerate.isVisionTask({
            task_id: "provider-task-123",
            provider_id: "openkey",
            provider_name: "Vision"
        }),
        true
    );
    assert.equal(
        regenerate.isVisionTask({
            task_id: "provider-task-123",
            provider_name: "MotionGen"
        }),
        false
    );
});

test("normalizes stored media references", () => {
    assert.equal(
        regenerate.normalizeReference('["https://cdn.example/image.png"]'),
        "https://cdn.example/image.png"
    );
    assert.equal(
        regenerate.normalizeReference([
            "",
            "https://cdn.example/video.mp4"
        ]),
        "https://cdn.example/video.mp4"
    );
});
