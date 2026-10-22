import test from "node:test";
import assert from "node:assert/strict";

import {
    QWENCLOUD_DEFAULT_QUOTA_SECONDS,
    clampPercent,
    formatQuotaDate,
    formatQuotaLabel,
    formatQuotaSeconds,
    formatQuotaStatusLabel,
    resolveDefaultQuotaSeconds,
    resolveQuotaLevel,
    resolveQuotaState
} from "../lib/generate/model-quota.js";


test("uses the real free tier defaults per QwenCloud family", () => {
    assert.equal(
        QWENCLOUD_DEFAULT_QUOTA_SECONDS.wan,
        50
    );
    assert.equal(
        QWENCLOUD_DEFAULT_QUOTA_SECONDS.happyhorse,
        10
    );

    assert.equal(
        resolveDefaultQuotaSeconds("qwen-wan2.6-t2v"),
        50
    );
    assert.equal(
        resolveDefaultQuotaSeconds("qwen-happyhorse-1.1-t2v"),
        10
    );
    assert.equal(
        resolveDefaultQuotaSeconds("qwen-HAPPYHORSE-1.0-video-edit"),
        10
    );
    assert.equal(resolveDefaultQuotaSeconds(""), 50);
    assert.equal(resolveDefaultQuotaSeconds(null), 50);
});


test("normalizes a quota row into seconds and percent", () => {
    const state = resolveQuotaState({
        total_seconds: 50,
        used_seconds: 18,
        remaining_seconds: 32,
        remaining_percent: 64,
        expires_at: "2027-01-19"
    });

    assert.equal(state.tracked, true);
    assert.equal(state.totalSeconds, 50);
    assert.equal(state.usedSeconds, 18);
    assert.equal(state.remainingSeconds, 32);
    assert.equal(state.percent, 64);
    assert.equal(state.level, "safe");
    assert.equal(state.exhausted, false);
    assert.equal(state.autoDisabled, false);
});


test("computes percent when the view omits it", () => {
    const state = resolveQuotaState({
        total_seconds: 50,
        used_seconds: 40
    });

    assert.equal(state.remainingSeconds, 10);
    assert.equal(state.percent, 20);
    assert.equal(state.level, "critical");
});


test("marks quota as exhausted when nothing is left", () => {
    const state = resolveQuotaState({
        total_seconds: 10,
        used_seconds: 10,
        remaining_seconds: 0,
        remaining_percent: 0,
        auto_disabled_at: "2026-10-22T09:00:00Z"
    });

    assert.equal(state.exhausted, true);
    assert.equal(state.autoDisabled, true);
    assert.equal(state.level, "empty");
    assert.equal(
        formatQuotaStatusLabel(state),
        "Dinonaktifkan otomatis karena kuota habis"
    );
});


test("treats an expired quota as exhausted", () => {
    const state = resolveQuotaState({
        total_seconds: 50,
        used_seconds: 5,
        remaining_seconds: 45,
        remaining_percent: 90,
        expires_at: "2020-01-01"
    });

    assert.equal(state.expired, true);
    assert.equal(state.exhausted, true);
    assert.match(
        formatQuotaLabel(state),
        /Kuota kedaluwarsa/
    );
});


test("quota total 0 means tracking is disabled", () => {
    const state = resolveQuotaState({
        total_seconds: 0,
        used_seconds: 0
    });

    assert.equal(state.tracked, false);
    assert.equal(state.exhausted, false);
    assert.equal(state.level, "unknown");
    assert.equal(
        formatQuotaLabel(state),
        "Kuota tidak dilacak (total 0 detik)"
    );
});


test("maps percent to warning levels", () => {
    assert.equal(resolveQuotaLevel(100, 50, 50), "safe");
    assert.equal(resolveQuotaLevel(51, 26, 50), "safe");
    assert.equal(resolveQuotaLevel(50, 25, 50), "warning");
    assert.equal(resolveQuotaLevel(21, 11, 50), "warning");
    assert.equal(resolveQuotaLevel(20, 10, 50), "critical");
    assert.equal(resolveQuotaLevel(0, 1, 50), "critical");
    assert.equal(resolveQuotaLevel(0, 0, 50), "empty");
    assert.equal(resolveQuotaLevel(0, 0, 0), "unknown");
});


test("formats Indonesian quota labels", () => {
    const state = resolveQuotaState({
        total_seconds: 50,
        used_seconds: 34,
        remaining_seconds: 16,
        remaining_percent: 32,
        expires_at: "2027-01-19"
    });

    assert.equal(
        formatQuotaLabel(state),
        "Sisa 32% · 16 detik dari 50 detik · kedaluwarsa 19 Jan 2027"
    );
    assert.equal(
        formatQuotaStatusLabel(state),
        "Kuota menipis"
    );
});


test("format helpers never return NaN", () => {
    assert.equal(formatQuotaSeconds(null), "0 detik");
    assert.equal(formatQuotaSeconds(undefined), "0 detik");
    assert.equal(formatQuotaSeconds(-5), "0 detik");
    assert.equal(formatQuotaSeconds("12.6"), "13 detik");
    assert.equal(formatQuotaDate(null), "-");
    assert.equal(formatQuotaDate("bukan-tanggal"), "bukan-tanggal");
    assert.equal(clampPercent(-1), 0);
    assert.equal(clampPercent(140), 100);
    assert.equal(clampPercent("abc"), 0);
});
