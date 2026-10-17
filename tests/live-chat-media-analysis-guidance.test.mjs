import test from "node:test";
import assert from "node:assert/strict";
import { buildMediaAnalysisGuidance } from "../lib/media-analysis-guidance.js";

test("guides neutral analysis of benign visual media without overriding safety requirements", () => {
    const guidance = buildMediaAnalysisGuidance();

    assert.equal(guidance.role, "system");
    assert.match(guidance.content, /Describe visual content neutrally, factually/);
    assert.match(guidance.content, /ordinary clothing, swimwear, dance, exercise/);
    assert.match(guidance.content, /without a generic refusal or moralizing/);
    assert.match(guidance.content, /Follow applicable safety requirements/);
});
