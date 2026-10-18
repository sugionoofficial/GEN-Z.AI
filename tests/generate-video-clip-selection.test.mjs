import test from "node:test";
import assert from "node:assert/strict";
import {
    resolveVideoParameterValue
} from "../generate/assets/js/generate-form-media-reader.js";

test("requires an explicit whole-video or clip choice before generation", async () => {
    const videoInput = {
        dataset: { videoMode: "upload" },
        getInputMode: () => "upload",
        _videoSelectionPending: true
    };

    await assert.rejects(
        resolveVideoParameterValue(videoInput),
        /Pilih “Gunakan video utuh” atau potong klip video sebelum generate\./
    );
});

test("does not silently fall back to the original file after a failed upload", async () => {
    const videoInput = {
        dataset: { videoMode: "upload" },
        getInputMode: () => "upload",
        getUploadedUrl: () => "",
        _videoSelectedFile: new File(["video"], "reference.mp4", {
            type: "video/mp4"
        }),
        querySelector: () => ({
            files: [new File(["video"], "reference.mp4", {
                type: "video/mp4"
            })]
        })
    };

    await assert.rejects(
        resolveVideoParameterValue(videoInput),
        /Video pilihan belum berhasil diunggah/
    );
});
