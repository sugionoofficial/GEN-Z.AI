import fs from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const downloadButton = {
    disabled: false,
    textContent: "DOWNLOAD",
    listeners: new Map(),
    addEventListener(type, listener) {
        this.listeners.set(type, listener);
    }
};
const elements = { downloadButton };
globalThis.window = {};
globalThis.__metadataDownloadStatus = "";

function asModuleUrl(source) {
    return `data:text/javascript,${encodeURIComponent(source)}`;
}

const eventsSource = await fs.readFile(
    new URL("../metadata-cleaner/assets/js/metadata-events.js", import.meta.url),
    "utf8"
);
const eventsModuleSource = eventsSource
    .replace(
        'from "./metadata-dom.js";',
        `from "${asModuleUrl("export const elements = globalThis.__metadataDownloadElements;")}";`
    )
    .replace(
        'from "./metadata-state.js";',
        `from "${asModuleUrl("export const state = {};")}";`
    )
    .replace(
        'from "./metadata-preview.js";',
        `from "${asModuleUrl("export function setPreviewStatus(message) { globalThis.__metadataDownloadStatus = message; }")}";`
    );

globalThis.__metadataDownloadElements = elements;
const { bindMetadataEvents } = await import(
    asModuleUrl(eventsModuleSource)
);

test("download click invokes cleaner callback and reports completion", async () => {
    let downloadCalled = false;
    bindMetadataEvents({
        downloadCleanedFile: async () => {
            downloadCalled = true;
            return true;
        }
    });

    downloadButton.listeners.get("click")({
        preventDefault() {},
        stopPropagation() {}
    });
    await new Promise(resolve => setTimeout(resolve, 0));

    assert.equal(downloadCalled, true);
    assert.equal(downloadButton.disabled, false);
    assert.equal(downloadButton.textContent, "DOWNLOAD");
    assert.match(globalThis.__metadataDownloadStatus, /UNDUHAN FILE HASIL CLEANING DIMULAI/);
});
