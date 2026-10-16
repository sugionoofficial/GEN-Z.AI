import fs from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

globalThis.window = {};

const provenanceSource = await fs.readFile(
    new URL("../metadata-cleaner/assets/js/metadata-provenance.js", import.meta.url),
    "utf8"
);
const provenanceModule = await import(
    `data:text/javascript,${encodeURIComponent(provenanceSource)}`
);

function createMp4(text) {
    const payload = new TextEncoder().encode(text);
    const bytes = new Uint8Array(12 + payload.length);
    bytes.set([0, 0, 0, 12, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
    bytes.set(payload, 12);
    return new File([bytes], "sample.mp4", { type: "video/mp4" });
}

test("does not report generator names in media bytes as SoftwareAgent", async () => {
    const result = await provenanceModule.inspectProvenance(
        createMp4("VEO ve0 kling")
    );

    assert.equal(result.softwareAgent, null);
    assert.deepEqual(
        result.findings.filter(finding => finding.startsWith("softwareAgent:")),
        []
    );
});

test("preserves an explicitly labeled SoftwareAgent finding", async () => {
    const result = await provenanceModule.inspectProvenance(
        createMp4("SoftwareAgent: Google Veo")
    );

    assert.match(result.softwareAgent, /SoftwareAgent: Google Veo/);
    assert.ok(
        result.findings.some(finding => finding.startsWith("softwareAgent:"))
    );
});
