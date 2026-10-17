import fs from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

let randomValue = 1234567890;
globalThis.window = {
    location: { href: "https://genzai.example/history/" },
    crypto: {
        getRandomValues(values) {
            values[0] = randomValue;
            randomValue += 1;
            return values;
        }
    }
};

const source = await fs.readFile(
    new URL("../assets/js/generated-file-name.js", import.meta.url),
    "utf8"
);
await import(`data:text/javascript,${encodeURIComponent(source)}`);

const createFileName = window.GENZGeneratedFileName.create;

test("uses a random GEN-Z.AI prefix and keeps generated media extensions", () => {
    assert.equal(
        createFileName("https://cdn.example/model-video.webm?token=secret"),
        "GEN-Z.AI-1234567890.webm"
    );
    assert.equal(
        createFileName("https://cdn.example/model-photo.png"),
        "GEN-Z.AI-1234567891.png"
    );
});

test("uses the media fallback extension when the result URL has no extension", () => {
    assert.equal(
        createFileName("https://cdn.example/result", "jpg"),
        "GEN-Z.AI-1234567892.jpg"
    );
});

test("rejects non-media extensions and never includes model names", () => {
    const fileName = createFileName(
        "https://cdn.example/model-private-name.json",
        "mp4"
    );

    assert.equal(fileName, "GEN-Z.AI-1234567893.mp4");
    assert.doesNotMatch(fileName, /model|private/i);
});
