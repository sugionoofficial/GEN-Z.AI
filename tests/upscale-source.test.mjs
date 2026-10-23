import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
    LEGACY_PUBLIC_BUCKET,
    UPLOAD_BUCKET,
    resolveUploadedUpscalePhotoSource,
    resolveUploadedUpscaleVideoSource
} from "../lib/generate/upscale-source.js";

/*
 * Upload user dipindah ke bucket privat `user-uploads`.
 * Validator ini memastikan hanya signed URL milik akun sendiri
 * (atau path publik lama) yang boleh diproses upscale.
 */

const SUPABASE_URL = "https://project.supabase.co";
const USER_ID = "c237fcef-6456-451e-ae98-691f2dabb60d";
const OTHER_ID = "11111111-2222-3333-4444-555555555555";

function resolve(sourceUrl, userId = USER_ID) {
    return resolveUploadedUpscaleVideoSource({
        sourceUrl,
        userId,
        supabaseUrl: SUPABASE_URL
    });
}

const signedUrl =
    `${SUPABASE_URL}/storage/v1/object/sign/${UPLOAD_BUCKET}/upscale-videos/inputs/${USER_ID}/1792000000000-abc12345.mp4?token=eyJhbGciOi.payload.sig`;

test("menerima signed URL dari bucket privat milik user", () => {
    const result = resolve(signedUrl);

    assert.equal(result.bucket, UPLOAD_BUCKET);
    assert.equal(result.signed, true);
    assert.equal(
        result.objectPath,
        `upscale-videos/inputs/${USER_ID}/1792000000000-abc12345.mp4`
    );
});

test("menerima path publik lama (bucket dashboard-videos)", () => {
    const legacy =
        `${SUPABASE_URL}/storage/v1/object/public/${LEGACY_PUBLIC_BUCKET}/upscale-videos/inputs/${USER_ID}/1792000000000-abc12345.mp4`;

    const result = resolve(legacy);

    assert.equal(result.bucket, LEGACY_PUBLIC_BUCKET);
    assert.equal(result.signed, false);
});

test("menolak signed URL tanpa token", () => {
    const url = signedUrl.split("?")[0];
    assert.throws(() => resolve(url), /tidak diizinkan/);
});

test("menolak query liar selain token", () => {
    const url = `${signedUrl}&redirect=http://evil.example`;
    assert.throws(() => resolve(url), /tidak diizinkan/);
});

test("menolak origin / protokol lain", () => {
    assert.throws(
        () => resolve(`https://evil.example/storage/v1/object/sign/${UPLOAD_BUCKET}/upscale-videos/inputs/${USER_ID}/1792000000000-abc12345.mp4?token=x`),
        /tidak diizinkan/
    );
    assert.throws(
        () => resolve(`http://project.supabase.co/storage/v1/object/sign/${UPLOAD_BUCKET}/upscale-videos/inputs/${USER_ID}/1792000000000-abc12345.mp4?token=x`),
        /tidak diizinkan/
    );
});

test("menolak file milik akun lain", () => {
    const url =
        `${SUPABASE_URL}/storage/v1/object/sign/${UPLOAD_BUCKET}/upscale-videos/inputs/${OTHER_ID}/1792000000000-abc12345.mp4?token=x`;

    assert.throws(() => resolve(url), /tidak cocok dengan akun/);
});

test("menolak path traversal dan ekstensi asing", () => {
    const traversal =
        `${SUPABASE_URL}/storage/v1/object/sign/${UPLOAD_BUCKET}/upscale-videos/inputs/${USER_ID}/../../videos/a.mp4?token=x`;
    assert.throws(() => resolve(traversal), /tidak cocok dengan akun/);

    const exe =
        `${SUPABASE_URL}/storage/v1/object/sign/${UPLOAD_BUCKET}/upscale-videos/inputs/${USER_ID}/1792000000000-abc12345.exe?token=x`;
    assert.throws(() => resolve(exe), /tidak cocok dengan akun/);
});

test("menolak URL yang bukan dari storage kita", () => {
    assert.throws(
        () => resolve("https://cdn.example/video.mp4"),
        /tidak diizinkan|Upscale Studio/
    );
});

/* =========================================================
   FOTO (upscale-photo)
========================================================= */

function resolvePhoto(sourceUrl, userId = USER_ID) {
    return resolveUploadedUpscalePhotoSource({
        sourceUrl,
        userId,
        supabaseUrl: SUPABASE_URL
    });
}

const signedPhotoUrl =
    `${SUPABASE_URL}/storage/v1/object/sign/${UPLOAD_BUCKET}/upscale-photos/inputs/${USER_ID}/1792000000000-abc12345.jpg?token=eyJhbGciOi.payload.sig`;

test("menerima signed URL foto milik user sendiri", () => {
    const result = resolvePhoto(signedPhotoUrl);

    assert.equal(result.bucket, UPLOAD_BUCKET);
    assert.equal(result.signed, true);
    assert.equal(
        result.objectPath,
        `upscale-photos/inputs/${USER_ID}/1792000000000-abc12345.jpg`
    );
});

test("menerima foto legacy dari bucket dashboard-videos", () => {
    const legacy =
        `${SUPABASE_URL}/storage/v1/object/public/${LEGACY_PUBLIC_BUCKET}/upscale-photos/inputs/${USER_ID}/1792000000000-abc12345.png`;

    const result = resolvePhoto(legacy);

    assert.equal(result.bucket, LEGACY_PUBLIC_BUCKET);
    assert.equal(result.signed, false);
});

test("menolak foto milik akun lain / ekstensi asing", () => {
    const otherUser =
        `${SUPABASE_URL}/storage/v1/object/sign/${UPLOAD_BUCKET}/upscale-photos/inputs/${OTHER_ID}/1792000000000-abc12345.jpg?token=x`;
    assert.throws(() => resolvePhoto(otherUser), /tidak cocok dengan akun/);

    const exe =
        `${SUPABASE_URL}/storage/v1/object/sign/${UPLOAD_BUCKET}/upscale-photos/inputs/${USER_ID}/1792000000000-abc12345.exe?token=x`;
    assert.throws(() => resolvePhoto(exe), /tidak cocok dengan akun/);
});

test("video dan foto tidak bisa saling tertukar", () => {
    assert.throws(
        () => resolvePhoto(`https://project.supabase.co/storage/v1/object/sign/${UPLOAD_BUCKET}/upscale-videos/inputs/${USER_ID}/1792000000000-abc12345.mp4?token=x`),
        /tidak cocok dengan akun/
    );
    assert.throws(() => resolve(signedPhotoUrl), /tidak cocok dengan akun/);
});

test("handler foto memvalidasi sumber sebelum potong kredit", () => {
    const source = readFileSync(new URL("../api/generate.js", import.meta.url), "utf8");
    const start = source.indexOf("async function handleUpscalePhotoAction");
    assert.ok(start > 0, "handleUpscalePhotoAction harus ada");

    const bodyEnd = source.indexOf("async function handleUpscaleVideoUploadAction", start);
    const handler = source.slice(start, bodyEnd > start ? bodyEnd : undefined);

    const validateAt = handler.indexOf("resolveUploadedUpscalePhotoSource(");
    const deductAt = handler.indexOf("deductGenerateCredits(");

    assert.ok(validateAt > 0, "handler harus memanggil resolveUploadedUpscalePhotoSource");
    assert.ok(deductAt > 0, "handler harus memotong kredit");
    assert.ok(
        validateAt < deductAt,
        "validasi sumber harus jalan sebelum kredit dipotong"
    );
});
