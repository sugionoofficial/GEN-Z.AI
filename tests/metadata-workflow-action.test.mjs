import fs from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const sharedButton = {
    disabled: false,
    textContent: "CHECK",
    dataset: {},
    attributes: new Map(),
    listeners: new Map(),
    addEventListener(type, listener) {
        this.listeners.set(type, listener);
    },
    setAttribute(name, value) {
        this.attributes.set(name, String(value));
    },
    getAttribute(name) {
        return this.attributes.get(name) ?? null;
    },
    removeAttribute(name) {
        this.attributes.delete(name);
    }
};
const cleanControl = { disabled: false, addEventListener() {} };
const downloadControl = { disabled: false, addEventListener() {} };
const elements = {
    checkButton: sharedButton,
    cleanButton: cleanControl,
    downloadButton: downloadControl
};
const state = { file: { name: "sample.png" }, checked: false, cleanedBlob: null };

globalThis.window = {
    GENZFeatureCredit: {
        async run(_feature, callback) {
            return callback();
        }
    }
};
globalThis.__metadataWorkflowElements = elements;
globalThis.__metadataWorkflowState = state;
globalThis.__metadataWorkflowStatus = "";

function asModuleUrl(source) {
    return `data:text/javascript,${encodeURIComponent(source)}`;
}

const source = await fs.readFile(
    new URL("../metadata-cleaner/assets/js/metadata-events.js", import.meta.url),
    "utf8"
);
const moduleSource = source
    .replace(
        'from "./metadata-dom.js";',
        `from "${asModuleUrl("export const elements = globalThis.__metadataWorkflowElements;")}";`
    )
    .replace(
        'from "./metadata-state.js";',
        `from "${asModuleUrl("export const state = globalThis.__metadataWorkflowState;")}";`
    )
    .replace(
        'from "./metadata-preview.js";',
        `from "${asModuleUrl("export function setPreviewStatus(message) { globalThis.__metadataWorkflowStatus = message; }")}";`
    );
const { bindMetadataEvents } = await import(asModuleUrl(moduleSource));

function clickSharedButton() {
    sharedButton.listeners.get("click")({
        preventDefault() {},
        stopPropagation() {}
    });
}

test("one CTA advances CHECK to CLEAN to DOWNLOAD after each successful step", async () => {
    bindMetadataEvents({
        checkMetadata: async () => {
            state.checked = true;
            return true;
        },
        cleanMetadata: async () => {
            state.cleanedBlob = { size: 12 };
            return true;
        },
        downloadCleanedFile: async () => true
    });

    clickSharedButton();
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(sharedButton.textContent, "BERSIHKAN METADATA");
    assert.equal(sharedButton.dataset.workflowAction, "clean");

    clickSharedButton();
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(sharedButton.textContent, "DOWNLOAD");
    assert.equal(sharedButton.dataset.workflowAction, "download");

    clickSharedButton();
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(sharedButton.textContent, "DOWNLOAD");
    assert.equal(globalThis.__metadataWorkflowStatus, "UNDUHAN FILE HASIL CLEANING DIMULAI.");
});
