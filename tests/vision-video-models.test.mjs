import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await fs.readFile(
    new URL("../vision-video/assets/js/vision-video-models.js", import.meta.url),
    "utf8"
);
const window = {};
vm.runInNewContext(source, { window, console });

const { filterVisionModels } = window.GENZVisionVideoModels;

test("accepts known multimodal model families when the catalog omits capability metadata", () => {
    const models = filterVisionModels([
        { id: "qwen3-vl-235b-a22b-instruct" },
        { id: "google/gemini-2.5-flash" },
        { id: "openai/gpt-4o-mini" },
        { id: "anthropic/claude-3.7-sonnet" },
        { id: "text-model" }
    ]);

    assert.deepEqual(
        models.map(model => model.id),
        [
            "qwen3-vl-235b-a22b-instruct",
            "google/gemini-2.5-flash",
            "openai/gpt-4o-mini",
            "anthropic/claude-3.7-sonnet"
        ]
    );
});

test("does not override explicit text-only input metadata using a model name", () => {
    const models = filterVisionModels([
        {
            id: "qwen3-vl-235b",
            input_modalities: ["text"]
        },
        {
            id: "text-model",
            input_modalities: ["text", "image"]
        }
    ]);

    assert.deepEqual(models.map(model => model.id), ["text-model"]);
});
