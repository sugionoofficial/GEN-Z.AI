import test from "node:test";
import assert from "node:assert/strict";
import {
    buildPayload,
    validateParameters
} from "../models/wan-30-ref-s6/parameter-adapter.js";
import config from "../models/wan-30-ref-s6/config.js";
import parameters from "../models/wan-30-ref-s6/parameters.js";

test("registers Wan 3.0 Reference Video under Motiongen", () => {
    assert.equal(config.id, "wan-30-ref-s6");
    assert.equal(config.motiongenModelId, "wan-30-ref-s6");
    assert.equal(config.providerId, "motiongen");
    assert.equal(config.type, "image-to-video");
    assert.equal(parameters.find(parameter => parameter.name === "image_urls").minItems, 1);
    assert.equal(parameters.find(parameter => parameter.name === "image_urls").maxItems, 6);
    assert.equal(parameters.find(parameter => parameter.name === "video_urls").maxItems, 1);
    assert.deepEqual(
        parameters.find(parameter => parameter.name === "aspect_ratio").enum,
        ["9:16", "16:9"]
    );
    assert.deepEqual(parameters.find(parameter => parameter.name === "duration").enum, ["15"]);
});

test("builds the provider payload with defaults and optional video reference", () => {
    assert.deepEqual(buildPayload({
        image_urls: [" https://example.com/a.webp ", "https://example.com/b.png"],
        video_urls: ["https://example.com/reference.mp4"],
        prompt: "A cinematic scene",
        webhook: "https://example.com/callback",
        ignored: "not forwarded"
    }), {
        model: "wan-30-ref-s6",
        image_urls: ["https://example.com/a.webp", "https://example.com/b.png"],
        video_urls: ["https://example.com/reference.mp4"],
        prompt: "A cinematic scene",
        aspect_ratio: "9:16",
        duration: "15",
        webhook_url: "https://example.com/callback"
    });
});

test("accepts numeric duration and nested parameters", () => {
    assert.deepEqual(buildPayload({
        parameters: {
            image_urls: ["https://example.com/reference.jpg"],
            duration: 15,
            aspect_ratio: "16:9"
        }
    }), {
        model: "wan-30-ref-s6",
        image_urls: ["https://example.com/reference.jpg"],
        aspect_ratio: "16:9",
        duration: "15"
    });
});

test("rejects missing or excessive media and invalid options or URLs", () => {
    assert.equal(validateParameters({}).valid, false);
    assert.equal(validateParameters({
        image_urls: Array.from({ length: 7 }, (_, index) => `https://example.com/${index}.jpg`)
    }).valid, false);
    assert.equal(validateParameters({
        image_urls: ["https://example.com/reference.jpg"],
        video_urls: ["https://example.com/a.mp4", "https://example.com/b.mp4"]
    }).valid, false);
    assert.equal(validateParameters({
        image_urls: ["file:///reference.jpg"],
        duration: 10
    }).valid, false);
    assert.equal(validateParameters({
        image_urls: ["https://example.com/reference.jpg"],
        aspect_ratio: "1:1"
    }).valid, false);
});
