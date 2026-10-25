import fs from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const appSource = await fs.readFile(
    new URL("../metadata-cleaner/assets/js/metadata-app.js", import.meta.url),
    "utf8"
);
const cleanerLoaderSource = await fs.readFile(
    new URL("../metadata-cleaner/assets/js/metadata-clean-loader.js", import.meta.url),
    "utf8"
);

test("CHECK and CLEAN loaders do not add a minimum wait", () => {
    assert.doesNotMatch(appSource, /waitForMinimumLoaderDuration|CHECKING_DURATION/);

    const progressTracker = cleanerLoaderSource.match(
        /async function runPremiumCleaningTimer\([\s\S]*?\n}\n/
    )?.[0];
    assert.ok(progressTracker, "cleaner process progress tracker exists");
    assert.match(progressTracker, /return await processPromise/);
    assert.doesNotMatch(progressTracker, /await\s+wait\s*\(/);
});

test("CHECK progress advances continuously and the mobile AI logo spins", async () => {
    assert.match(appSource, /CHECK_PROGRESS_ESTIMATE/);
    assert.match(appSource, /Math\.max\(0, elapsed\) \/ CHECK_PROGRESS_ESTIMATE/);
    assert.match(appSource, /CLEANING_TICK = 50/);
    assert.match(appSource, /genzCleanLogoSpin 1\.8s linear infinite/);
});
