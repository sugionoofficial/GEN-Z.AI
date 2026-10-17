import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await fs.readFile(
    new URL("../vision/assets/js/vision-api-models.js", import.meta.url),
    "utf8"
);
const window = {};
vm.runInNewContext(source, { window, console });

const { supportsImageInput } = window.GENZVisionModels;

test("recognizes common multimodal model families when capability metadata is missing", () => {
    const modelIds = [
        "grok-4.6",
        "google/gemini-2.5-flash",
        "openai/gpt-4o-mini",
        "anthropic/claude-3.7-sonnet",
        "qwen3-vl-235b-a22b-instruct",
        "mistral/pixtral-large"
    ];

    assert.deepEqual(
        modelIds.filter(id => supportsImageInput({ id })),
        modelIds
    );
});

test("explicit text-only input metadata overrides model-name inference", () => {
    assert.equal(
        supportsImageInput({
            id: "google/gemini-2.5-flash",
            input_modalities: ["text"]
        }),
        false
    );
});

test("retains explicit image capability detection for unrecognized model families", () => {
    assert.equal(
        supportsImageInput({
            id: "custom-model",
            input_modalities: ["text", "image"]
        }),
        true
    );
});
