import fs from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

globalThis.window = {};

const stateSource = await fs.readFile(
    new URL("../metadata-cleaner/assets/js/metadata-state.js", import.meta.url),
    "utf8"
);
const stateModule = await import(
    `data:text/javascript,${encodeURIComponent(stateSource)}`
);

const downloadSource = await fs.readFile(
    new URL("../metadata-cleaner/assets/js/metadata-download.js", import.meta.url),
    "utf8"
);
const downloadModuleSource = downloadSource.replace(
    'from "./metadata-state.js";',
    `from "${`data:text/javascript,${encodeURIComponent(stateSource)}`}";`
);
const downloadModule = await import(
    `data:text/javascript,${encodeURIComponent(downloadModuleSource)}`
);

const { state } = stateModule;

test("downloads the cleaned Blob even when the preview URL is absent", async () => {
    const blob = new Blob(["cleaned content"], { type: "video/mp4" });
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const originalSetTimeout = globalThis.setTimeout;
    const originalDocument = globalThis.document;
    const originalFile = state.file;
    const originalCleanedBlob = state.cleanedBlob;
    const originalCleanedURL = state.cleanedURL;
    const originalCleanedFile = state.cleanedFile;
    let createdBlob;
    let clicked = false;
    let removed = false;
    let scheduledCleanup;

    URL.createObjectURL = value => {
        createdBlob = value;
        return "blob:download-result";
    };
    URL.revokeObjectURL = () => {};
    globalThis.setTimeout = callback => {
        scheduledCleanup = callback;
        return 1;
    };
    globalThis.document = {
        createElement: () => ({
            style: {},
            click() {
                clicked = true;
            },
            remove() {
                removed = true;
            }
        }),
        body: {
            appendChild(anchor) {
                this.anchor = anchor;
            }
        }
    };
    state.file = { name: "clip.mp4" };
    state.cleanedBlob = blob;
    state.cleanedURL = null;
    state.cleanedFile = null;

    try {
        assert.equal(await downloadModule.downloadCleanedFile(), true);
        assert.equal(createdBlob, blob);
        assert.equal(document.body.anchor.href, "blob:download-result");
        assert.equal(document.body.anchor.download, "clip_cleaned.mp4");
        assert.equal(clicked, true);
        assert.equal(removed, true);
        assert.equal(typeof scheduledCleanup, "function");
    } finally {
        URL.createObjectURL = originalCreateObjectURL;
        URL.revokeObjectURL = originalRevokeObjectURL;
        globalThis.setTimeout = originalSetTimeout;
        globalThis.document = originalDocument;
        state.file = originalFile;
        state.cleanedBlob = originalCleanedBlob;
        state.cleanedURL = originalCleanedURL;
        state.cleanedFile = originalCleanedFile;
    }
});

test("reports when the cleaned Blob is unavailable", async () => {
    const originalCleanedBlob = state.cleanedBlob;
    const originalConsoleError = console.error;
    state.cleanedBlob = null;
    console.error = () => {};

    try {
        assert.equal(await downloadModule.downloadCleanedFile(), false);
    } finally {
        state.cleanedBlob = originalCleanedBlob;
        console.error = originalConsoleError;
    }
});

test("sends cleaned Blob data to the Android download manager", async () => {
    const blob = new Blob(["native cleaned content"], { type: "image/jpeg" });
    const originalBridge = window.GENZAndroidDownloads;
    const originalMobileDownload = window.GENZMobileDownload;
    const originalFile = state.file;
    const originalCleanedBlob = state.cleanedBlob;
    const originalCleanedFile = state.cleanedFile;
    let savedBlob;
    let savedFileName;

    window.GENZAndroidDownloads = {};
    window.GENZMobileDownload = async (value, fileName) => {
        savedBlob = value;
        savedFileName = fileName;
        return true;
    };
    state.file = { name: "photo.jpg" };
    state.cleanedBlob = blob;
    state.cleanedFile = null;

    try {
        assert.equal(await downloadModule.downloadCleanedFile(), true);
        assert.equal(savedBlob, blob);
        assert.equal(savedFileName, "photo_cleaned.jpg");
    } finally {
        window.GENZAndroidDownloads = originalBridge;
        window.GENZMobileDownload = originalMobileDownload;
        state.file = originalFile;
        state.cleanedBlob = originalCleanedBlob;
        state.cleanedFile = originalCleanedFile;
    }
});
