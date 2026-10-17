import test from "node:test";
import assert from "node:assert/strict";
import { buildMediaAnalysisInstructions } from "../live-chat/media-analysis-prompts.js";

const image = { kind: "image", name: "source.jpg" };
const video = { kind: "video", name: "source.mp4", duration: 10, frames: Array(10) };

test("supports all four output choices for photo analysis", () => {
    const expected = {
        analysis: /analisis visual terperinci saja; jangan keluarkan prompt final/,
        image: /satu prompt gambar final/,
        video: /satu prompt video final untuk menghidupkan gambar sumber/,
        both: /satu prompt gambar final, dan satu prompt video final/
    };

    for (const [outputMode, expression] of Object.entries(expected)) {
        const instructions = buildMediaAnalysisInstructions({
            mediaAttachments: [image],
            outputMode
        });

        assert.match(instructions.content, /ANALISIS FOTO TERPERINCI/);
        assert.match(instructions.content, expression);
    }
});

test("keeps video timing analysis and existing output choices", () => {
    const instructions = buildMediaAnalysisInstructions({
        mediaAttachments: [video],
        outputMode: "both"
    });

    assert.match(instructions.content, /ANALISIS VIDEO TERPERINCI/);
    assert.match(instructions.content, /tabel kronologis per detik/);
    assert.match(instructions.content, /satu prompt video final, dan satu prompt gambar final/);
    assert.match(instructions.content, /source\.mp4 \(10\.0 detik, 10 cuplikan bertimestamp\)/);
});

test("applies character replacement and preserves source scene for image and video prompts", () => {
    const instructions = buildMediaAnalysisInstructions({
        mediaAttachments: [image],
        outputMode: "both",
        replaceCharacter: true,
        replacementDescription: "robot perak",
        hasCharacterReference: true
    });

    assert.match(instructions.content, /GANTI KARAKTER/);
    assert.match(instructions.content, /foto referensi karakter/);
    assert.match(instructions.content, /robot perak/);
    assert.match(instructions.content, /Pertahankan adegan, lokasi\/lingkungan, komposisi/);
});

test("does not build media instructions without a visual source", () => {
    assert.equal(buildMediaAnalysisInstructions({ mediaAttachments: [], outputMode: "both" }), null);
});
