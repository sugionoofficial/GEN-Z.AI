import test from "node:test";
import assert from "node:assert/strict";
import { parseFinalPromptBlocks } from "../live-chat/prompt-blocks.js";

test("extracts clean final video and image prompts separately from the analysis", () => {
    const parsed = parseFinalPromptBlocks([
        "Analisis gerakan: karakter bergerak dari kiri ke kanan.",
        "",
        "<<<VIDEO_PROMPT_FINAL>>>",
        "Cinematic video, slow dolly-in, warm light.",
        "<<</VIDEO_PROMPT_FINAL>>>",
        "",
        "<<<IMAGE_PROMPT_FINAL>>>",
        "A cinematic still, warm light.",
        "<<</IMAGE_PROMPT_FINAL>>>"
    ].join("\n"));

    assert.equal(parsed.displayText, "Analisis gerakan: karakter bergerak dari kiri ke kanan.");
    assert.deepEqual(parsed.prompts, [
        { label: "Prompt Video Final", text: "Cinematic video, slow dolly-in, warm light." },
        { label: "Prompt Gambar Final", text: "A cinematic still, warm light." }
    ]);
});

test("ignores empty prompt markers and leaves normal chat text unchanged", () => {
    assert.deepEqual(
        parseFinalPromptBlocks("Jawaban biasa."),
        { displayText: "Jawaban biasa.", prompts: [] }
    );
    assert.deepEqual(
        parseFinalPromptBlocks("<<<VIDEO_PROMPT_FINAL>>><<</VIDEO_PROMPT_FINAL>>>"),
        { displayText: "", prompts: [] }
    );
});

test("extracts separate prompts when the model repeats each opening marker to close it", () => {
    const parsed = parseFinalPromptBlocks([
        "Analisis terperinci video.",
        "",
        "<<<VIDEO_PROMPT_FINAL>>>Prompt video saja.<<<VIDEO_PROMPT_FINAL>>>",
        "",
        "<<<IMAGE_PROMPT_FINAL>>>Prompt gambar saja.<<<IMAGE_PROMPT_FINAL>>>"
    ].join("\n"));

    assert.equal(parsed.displayText, "Analisis terperinci video.");
    assert.deepEqual(parsed.prompts, [
        { label: "Prompt Video Final", text: "Prompt video saja." },
        { label: "Prompt Gambar Final", text: "Prompt gambar saja." }
    ]);
});

test("extracts prompts when opening and closing markers are concatenated with their content", () => {
    const parsed = parseFinalPromptBlocks(
        "<<<VIDEO_PROMPT_FINAL>>>Video prompt.<<</VIDEO_PROMPT_FINAL>>>\n" +
        "<<<IMAGE_PROMPT_FINAL>>>Image prompt.<<</IMAGE_PROMPT_FINAL>>>"
    );

    assert.equal(parsed.displayText, "");
    assert.deepEqual(parsed.prompts, [
        { label: "Prompt Video Final", text: "Video prompt." },
        { label: "Prompt Gambar Final", text: "Image prompt." }
    ]);
});
