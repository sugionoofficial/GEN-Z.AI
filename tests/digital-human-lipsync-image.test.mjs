import fs from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const modelDirectory = new URL("../models/digital-human-lipsync-image/", import.meta.url);
const parametersSource = await fs.readFile(new URL("parameters.js", modelDirectory), "utf8");
const parametersUrl = `data:text/javascript,${encodeURIComponent(parametersSource)}`;
const adapterSource = await fs.readFile(new URL("parameter-adapter.js", modelDirectory), "utf8");
const adapterUrl = `data:text/javascript,${encodeURIComponent(adapterSource.replace(
    'from "./parameters.js"',
    `from "${parametersUrl}"`
))}`;
const parametersModule = await import(parametersUrl);
const adapterModule = await import(adapterUrl);
const configSource = await fs.readFile(new URL("config.js", modelDirectory), "utf8");
const configUrl = `data:text/javascript,${encodeURIComponent(configSource)}`;
const motiongenClientSource = await fs.readFile(
    new URL("../provider/motiongen-ai/client.js", import.meta.url),
    "utf8"
);
const motiongenClientUrl = `data:text/javascript,${encodeURIComponent(motiongenClientSource)}`;
const createTaskSource = await fs.readFile(new URL("create-task.js", modelDirectory), "utf8");
const createTaskUrl = `data:text/javascript,${encodeURIComponent(createTaskSource
    .replace(
        'from "../../provider/motiongen-ai/client.js"',
        `from "${motiongenClientUrl}"`
    )
    .replace('from "./config.js"', `from "${configUrl}"`)
    .replace('from "./parameters.js"', `from "${parametersUrl}"`)
    .replace('from "./parameter-adapter.js"', `from "${adapterUrl}"`))}`;
const { createTask } = await import(createTaskUrl);

test("builds the documented Motiongen payload with image and audio URLs", () => {
    const payload = adapterModule.buildPayload({
        parameters: {
            image_urls: ["https://cdn.example/face.webp"],
            audio_url: "https://cdn.example/voice.mp3"
        }
    }, "digital-human-lipsync-image-s3");

    assert.deepEqual(payload, {
        model: "digital-human-lipsync-image-s3",
        prompt: "",
        image_urls: ["https://cdn.example/face.webp"],
        audio_url: "https://cdn.example/voice.mp3",
        duration: "10",
        resolution: "576p"
    });
});

test("submits provider slug instead of the internal GEN-Z.AI model ID", async () => {
    const originalFetch = globalThis.fetch;
    let submittedRequest;
    globalThis.fetch = async (url, options) => {
        submittedRequest = { url, options };
        return new Response(JSON.stringify({
            success: true,
            job_id: "motiongen-job-test",
            status: "QUEUED"
        }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
        });
    };

    try {
        const result = await createTask({
            image_urls: ["https://cdn.example/face.jpeg"],
            audio_url: "https://cdn.example/audio.mp3"
        }, "mg_live_test");

        assert.equal(result.job_id, "motiongen-job-test");
        assert.equal(submittedRequest.url, "https://app.motiongenai.pro/api/v1/generate");
        assert.deepEqual(JSON.parse(submittedRequest.options.body), {
            model: "digital-human-lipsync-image-s3",
            prompt: "",
            image_urls: ["https://cdn.example/face.jpeg"],
            audio_url: "https://cdn.example/audio.mp3",
            duration: "10",
            resolution: "576p"
        });
        assert.notEqual(JSON.parse(submittedRequest.options.body).model, "digital-human-lipsync-image");
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("requires image and audio but allows an omitted prompt", () => {
    assert.equal(parametersModule.validate({
        image_urls: ["https://cdn.example/face.jpg"],
        audio_url: "https://cdn.example/voice.wav"
    }).valid, true);

    assert.equal(parametersModule.validate({
        image_urls: ["https://cdn.example/face.jpg"]
    }).valid, false);
    assert.equal(parametersModule.validate({
        audio_url: "https://cdn.example/voice.wav"
    }).valid, false);
});

test("preserves a supported resolution and rejects unsupported resolutions", () => {
    const payload = adapterModule.buildPayload({
        image_urls: ["https://cdn.example/face.jpg"],
        audio_url: "https://cdn.example/voice.mp3",
        resolution: "720p"
    }, "digital-human-lipsync-image-s3");

    assert.equal(payload.resolution, "720p");
    assert.equal(adapterModule.buildPayload({
        image_urls: ["https://cdn.example/face.jpg"],
        audio_url: "https://cdn.example/voice.mp3",
        resolution: "480p"
    }, "digital-human-lipsync-image-s3").resolution, "576p");
    assert.equal(parametersModule.validate({
        image_urls: ["https://cdn.example/face.jpg"],
        audio_url: "https://cdn.example/voice.mp3",
        resolution: "1080p"
    }).valid, false);
});
