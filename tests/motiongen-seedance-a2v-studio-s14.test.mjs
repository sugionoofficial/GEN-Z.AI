import test from "node:test";
import assert from "node:assert/strict";
import {
    buildPayload,
    validateParameters
} from "../models/seedance-a2v-studio-s14/parameter-adapter.js";
import config from "../models/seedance-a2v-studio-s14/config.js";
import parameters from "../models/seedance-a2v-studio-s14/parameters.js";

test("registers the Seedance A2V model under Motiongen", () => {
    assert.equal(config.id, "seedance-a2v-studio-s14");
    assert.equal(config.motiongenModelId, "seedance-a2v-studio-s14");
    assert.equal(config.providerId, "motiongen");
    assert.deepEqual(
        parameters.find(parameter => parameter.name === "duration").enum,
        ["5", "8", "10", "12", "15", "30"]
    );
    assert.deepEqual(
        parameters.find(parameter => parameter.name === "aspect_ratio").enum,
        ["9:16", "16:9"]
    );
    assert.deepEqual(
        parameters.find(parameter => parameter.name === "resolution").enum,
        ["480p", "720p", "1080p"]
    );
    assert.deepEqual(config.adminEditor.resolutionOptions, [
        { value: "480p", label: "480p" },
        { value: "720p", label: "720p" },
        { value: "1080p", label: "1080p" }
    ]);
});

test("builds the Motiongen request with the specified defaults and allowed fields", () => {
    assert.deepEqual(buildPayload({
        image_urls: [" https://example.com/reference.webp "],
        audio_url: "https://example.com/audio.mp3",
        ignored: "not forwarded"
    }), {
        model: "seedance-a2v-studio-s14",
        image_urls: ["https://example.com/reference.webp"],
        audio_url: "https://example.com/audio.mp3",
        aspect_ratio: "9:16",
        duration: "15",
        resolution: "720p"
    });
});

test("accepts numeric duration and the webhook alias in the API request", () => {
    assert.deepEqual(buildPayload({
        image_urls: ["https://example.com/reference.jpg"],
        audio_url: "https://example.com/audio.wav",
        duration: 30,
        aspect_ratio: "16:9",
        resolution: "1080p",
        webhook: "https://example.com/callback"
    }), {
        model: "seedance-a2v-studio-s14",
        image_urls: ["https://example.com/reference.jpg"],
        audio_url: "https://example.com/audio.wav",
        aspect_ratio: "16:9",
        duration: "30",
        resolution: "1080p",
        webhook_url: "https://example.com/callback"
    });
});

test("rejects missing media, multiple images, invalid options, and non-public URL formats", () => {
    assert.equal(validateParameters({}).valid, false);
    assert.equal(validateParameters({
        image_urls: [
            "https://example.com/a.jpg",
            "https://example.com/b.jpg"
        ],
        audio_url: "https://example.com/audio.mp3"
    }).valid, false);
    assert.equal(validateParameters({
        image_urls: ["file:///reference.jpg"],
        audio_url: "https://example.com/audio.mp3",
        duration: "20"
    }).valid, false);
});
