import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import openClipsModels, {
    OPENCLIPS_MODEL_SPECS,
    getOpenClipsModel,
    isOpenClipsModelId
} from "../models/openclips/index.js";

test("registry OpenClips berisi empat kontrak awal dengan provider terpisah", () => {
    assert.equal(openClipsModels.length, 4);
    assert.equal(openClipsModels.length, OPENCLIPS_MODEL_SPECS.length);
    assert.deepEqual(openClipsModels.map(model => model.config.id), [
        "openclips-seedance-2.5",
        "openclips-seedance-2.0",
        "openclips-seedream-5.0-pro",
        "openclips-seedream-5.0-flash"
    ]);
    for (const model of openClipsModels) {
        assert.equal(model.config.providerId, "openclips");
        assert.equal(model.config.providerName, "OpenClips");
        assert.equal(typeof model.createTask, "function");
        assert.equal(typeof model.queryTask, "function");
        assert.equal(isOpenClipsModelId(model.config.id), true);
    }
    assert.equal(getOpenClipsModel("openclips-seedance-2.5").config.upstreamModel, "seedance-2.5");
});

test("Seedance payload memakai model discriminator dan params camelCase OpenClips", () => {
    const model = getOpenClipsModel("openclips-seedance-2.5");
    const payload = model.buildPayload({
        prompt: "A phone on a table",
        aspect_ratio: "9:16",
        duration: "12",
        resolution: "1080p",
        generate_audio: false,
        output_format: "mov",
        image_role: "reference",
        image_urls: ["https://cdn.example.com/phone.png"]
    });
    assert.deepEqual(payload, {
        model: "seedance-2.5",
        prompt: "A phone on a table",
        images: ["https://cdn.example.com/phone.png"],
        params: {
            aspectRatio: "9:16",
            duration: 12,
            resolution: "1080p",
            generateAudio: false,
            outputFormat: "mov",
            imageRole: "reference"
        }
    });
    assert.equal("model_aliases" in payload, false);
    assert.equal("workflow" in payload, false);
    assert.equal("reference_image_urls" in payload, false);
});

test("Seedream payload memakai size/outputFormat dan bukan field video", () => {
    const model = getOpenClipsModel("openclips-seedream-5.0-pro");
    const payload = model.buildPayload({
        prompt: "Premium studio product photo",
        aspect_ratio: "1:1",
        size: "2K",
        output_format: "jpeg"
    });
    assert.deepEqual(payload, {
        model: "seedream-5.0-pro",
        prompt: "Premium studio product photo",
        params: {
            aspectRatio: "1:1",
            size: "2K",
            outputFormat: "jpeg"
        }
    });
    assert.equal(model.config.mediaType, "image");
    assert.equal(model.config.adminDefaults.credit_480p, 500);
});

test("validasi menolak prompt kosong, URL non-HTTP dan durasi di luar kontrak", () => {
    const model = getOpenClipsModel("openclips-seedance-2.5");
    assert.equal(model.validate({ prompt: "" }).valid, false);
    assert.equal(model.validate({ prompt: "test", image_urls: ["file:///etc/passwd"] }).valid, false);
    assert.equal(model.validate({ prompt: "test", duration: "4" }).valid, true);
    assert.equal(model.validate({ prompt: "test", duration: "6" }).valid, true);
    assert.equal(model.validate({ prompt: "test", duration: "31" }).valid, false);
    assert.equal(model.validate({ prompt: "test", generate_audio: "perhaps" }).valid, false);
    assert.equal(model.validate({ prompt: "test", generate_audio: 0 }).valid, true);
});

test("semua API registry dan admin registry mendaftarkan OpenClips", async () => {
    for (const path of [
        "api/generate.js",
        "api/generate-status.js",
        "api/model-config.js",
        "admin-control/models/models-data.js"
    ]) {
        const source = await readFile(new URL(`../${path}`, import.meta.url), "utf8");
        assert.match(source, /openClipsModels/, `${path} harus import/register openClipsModels`);
        assert.match(source, /\.\.\/models\/openclips\/index\.js|\.\.\/\.\.\/models\/openclips\/index\.js/);
    }
    const worker = await readFile(new URL("../functions/worker.mjs", import.meta.url), "utf8");
    assert.match(worker, /\/api\/openclips-oauth-login/);
    assert.match(worker, /\/api\/openclips-oauth-callback/);
});
