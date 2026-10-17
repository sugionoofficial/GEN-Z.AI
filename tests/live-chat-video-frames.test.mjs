import test from "node:test";
import assert from "node:assert/strict";
import {
    getVideoFrameTimestamps,
    MAX_VIDEO_DURATION_SECONDS
} from "../live-chat/video-frames.js";

test("samples one frame at the center of each second", () => {
    assert.deepEqual(getVideoFrameTimestamps(3), [0.5, 1.5, 2.5]);
    const fractional = getVideoFrameTimestamps(2.2);
    assert.deepEqual(fractional.slice(0, 2), [0.5, 1.5]);
    assert.ok(Math.abs(fractional[2] - 2.15) < 1e-9);
});

test("samples a short clip without seeking beyond its duration", () => {
    assert.ok(Math.abs(getVideoFrameTimestamps(0.2)[0] - 0.15) < 1e-9);
    assert.deepEqual(getVideoFrameTimestamps(0.01), [0]);
});

test("rejects unsupported durations instead of claiming a per-second analysis", () => {
    assert.equal(MAX_VIDEO_DURATION_SECONDS, 30);
    assert.throws(() => getVideoFrameTimestamps(30.1), /melebihi batas 30 detik.*Potong video/);
    assert.throws(() => getVideoFrameTimestamps(0), /Durasi video tidak valid/);
});
