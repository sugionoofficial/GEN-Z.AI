import test from "node:test";
import assert from "node:assert/strict";

import {
    QWENCLOUD_BILLING_BLOCK_SECONDS,
    QWENCLOUD_MAX_DURATION_FACTOR,
    isQwenCloudModel,
    resolveBillableCredit,
    resolveDurationFactor,
    resolveDurationSeconds,
    roundCredit
} from "../lib/generate/qwencloud-credit.js";

test("detects QwenCloud models from config or model id", () => {
    assert.equal(
        isQwenCloudModel({ providerId: "qwencloud" }, "apa-saja"),
        true
    );
    assert.equal(
        isQwenCloudModel({ providerId: "QWENCLOUD" }, ""),
        true
    );
    assert.equal(
        isQwenCloudModel(null, "qwen-wan2.6-t2v"),
        true
    );
    assert.equal(
        isQwenCloudModel({ providerId: "motiongen" }, "wan-30-ref-s6"),
        false
    );
    assert.equal(
        isQwenCloudModel(null, "seedance-25-studio-s14"),
        false
    );
});

test("reads duration from parameters in any numeric form", () => {
    assert.equal(resolveDurationSeconds({ duration: "10" }), 10);
    assert.equal(resolveDurationSeconds({ duration: 5 }), 5);
    assert.equal(resolveDurationSeconds({ duration: " 15 " }), 15);
    assert.equal(resolveDurationSeconds({ duration: "" }), null);
    assert.equal(resolveDurationSeconds({ duration: null }), null);
    assert.equal(resolveDurationSeconds({ duration: "abc" }), null);
    assert.equal(resolveDurationSeconds({ duration: 0 }), null);
    assert.equal(resolveDurationSeconds({ duration: -5 }), null);
    assert.equal(resolveDurationSeconds({}), null);
});

test("bills one credit block per 5 seconds", () => {
    assert.equal(QWENCLOUD_BILLING_BLOCK_SECONDS, 5);

    assert.equal(resolveDurationFactor({ duration: "5" }), 1);
    assert.equal(resolveDurationFactor({ duration: "10" }), 2);
    assert.equal(resolveDurationFactor({ duration: "15" }), 3);

    // pembulatan ke atas: 6 detik tetap dihitung 2 blok
    assert.equal(resolveDurationFactor({ duration: "6" }), 2);
    assert.equal(resolveDurationFactor({ duration: "1" }), 1);
});

test("falls back to a single block when duration is absent", () => {
    assert.equal(resolveDurationFactor({}), 1);
    assert.equal(resolveDurationFactor({ duration: "abc" }), 1);
});

test("caps the duration factor", () => {
    assert.equal(
        resolveDurationFactor({ duration: "9999" }),
        QWENCLOUD_MAX_DURATION_FACTOR
    );
});

test("multiplies credit only for QwenCloud models", () => {
    const qwen = resolveBillableCredit(
        20,
        { duration: "10" },
        { providerId: "qwencloud" },
        "qwen-wan2.6-t2v"
    );

    assert.equal(qwen.durationSeconds, 10);
    assert.equal(qwen.durationFactor, 2);
    assert.equal(qwen.creditUnit, 20);
    assert.equal(qwen.billableCredit, 40);

    const other = resolveBillableCredit(
        20,
        { duration: "10" },
        { providerId: "motiongen" },
        "wan-30-ref-s6"
    );

    assert.equal(other.durationFactor, 1);
    assert.equal(other.billableCredit, 20);
});

test("keeps animate models at a single block", () => {
    const animate = resolveBillableCredit(
        35,
        {},
        { providerId: "qwencloud" },
        "qwen-wan2.2-animate-move"
    );

    assert.equal(animate.durationSeconds, null);
    assert.equal(animate.durationFactor, 1);
    assert.equal(animate.billableCredit, 35);
});

test("rounds credit to two decimals", () => {
    assert.equal(roundCredit(10.005), 10.01);
    assert.equal(roundCredit(10.004), 10);
    assert.equal(roundCredit("7.5"), 7.5);
    assert.equal(roundCredit(null), 0);
    assert.equal(roundCredit(undefined), 0);
});

test("duration billing never returns NaN or negative credit", () => {
    const result = resolveBillableCredit(
        "8.5",
        { duration: "15" },
        { providerId: "qwencloud" },
        "qwen-wan2.6-t2v"
    );

    assert.equal(result.billableCredit, 25.5);
    assert.ok(Number.isFinite(result.billableCredit));
    assert.ok(result.billableCredit >= 0);
});

test("HappyHorse charges per 5-second block across its 3–15 second range", () => {
    const config = { providerId: "qwencloud", payloadStyle: "happyhorse" };
    const id = "qwen-happyhorse-1.1-t2v";

    const short = resolveBillableCredit(30, { duration: "3" }, config, id);
    assert.equal(short.durationSeconds, 3);
    assert.equal(short.durationFactor, 1);
    assert.equal(short.billableCredit, 30);

    const mid = resolveBillableCredit(30, { duration: "8" }, config, id);
    assert.equal(mid.durationFactor, 2);
    assert.equal(mid.billableCredit, 60);

    const long = resolveBillableCredit(30, { duration: "15" }, config, id);
    assert.equal(long.durationFactor, 3);
    assert.equal(long.billableCredit, 90);
});

test("HappyHorse video edit has no duration so it bills once", () => {
    const result = resolveBillableCredit(
        40,
        { video_url: "https://cdn.test/in.mp4" },
        { providerId: "qwencloud" },
        "qwen-happyhorse-1.0-video-edit"
    );

    assert.equal(result.durationSeconds, null);
    assert.equal(result.durationFactor, 1);
    assert.equal(result.billableCredit, 40);
});
