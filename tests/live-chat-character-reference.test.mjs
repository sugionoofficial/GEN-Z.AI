import test from "node:test";
import assert from "node:assert/strict";
import {
    buildCharacterReferenceParts,
    buildCharacterReplacementInstruction
} from "../live-chat/character-reference.js";

test("adds the character reference photo to multimodal user content with a clear label", () => {
    const parts = buildCharacterReferenceParts({
        dataUrl: "data:image/jpeg;base64,reference"
    });

    assert.equal(parts.length, 2);
    assert.match(parts[0].text, /REFERENSI KARAKTER BARU/);
    assert.match(parts[0].text, /bukan foto sumber atau frame video/);
    assert.deepEqual(parts[1], {
        type: "image_url",
        image_url: { url: "data:image/jpeg;base64,reference" }
    });
    assert.deepEqual(buildCharacterReferenceParts(null), []);
});

test("instructs the model to preserve the source scene and apply reference identity", () => {
    const instruction = buildCharacterReplacementInstruction({
        description: "rambut merah dan mantel hijau",
        hasReferenceImage: true
    });

    assert.match(instruction, /analisis foto referensi karakter/);
    assert.match(instruction, /rambut merah dan mantel hijau/);
    assert.match(instruction, /prioritaskan ciri visual foto/);
    assert.match(instruction, /pertahankan lokasi\/lingkungan, aksi dan timing, blocking, kamera/);
});

test("retains description-only and default character replacement behavior", () => {
    assert.match(
        buildCharacterReplacementInstruction({ description: "robot perak" }),
        /gunakan juga deskripsi karakter ini: "robot perak"/
    );
    assert.match(
        buildCharacterReplacementInstruction(),
        /rancang karakter baru yang sesuai dengan suasana dan aksi adegan/
    );
});
