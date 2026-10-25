import test from "node:test";
import assert from "node:assert/strict";
import jpeg from "jpeg-js";

import {
    downloadDownscaledReference,
    downloadModelReference
} from "../lib/social-publisher/storage.js";
import { prepareReferenceImage } from "../lib/social-publisher/reference-image.js";

const config = { url: "https://project.example", serviceRoleKey: "service-key" };

function tinyJpeg() {
    const data = new Uint8Array(16 * 16 * 4).fill(140);
    return new Uint8Array(jpeg.encode({ data, width: 16, height: 16 }, 80).data);
}

function mockFetch(handler) {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, options = {}) => handler(String(input), options);
    return () => { globalThis.fetch = originalFetch; };
}

function signHandler(onDownload) {
    return async (url, options = {}) => {
        if (url.includes("/storage/v1/object/sign/")) {
            assert.equal(options.method, "POST");
            return Response.json({ signedURL: "/object/sign/social-character-references/social-reference/user-1/ref.jpg?token=abc" });
        }
        return onDownload(url, options);
    };
}

test("referensi diambil lewat transformasi Supabase agar Worker tidak men-decode foto besar", async () => {
    const restore = mockFetch(signHandler(async (url) => {
        const parsed = new URL(url);
        assert.match(parsed.pathname, /^\/storage\/v1\/render\/image\/sign\//);
        assert.equal(parsed.searchParams.get("token"), "abc", "token tanda tangan harus dipertahankan");
        assert.equal(parsed.searchParams.get("width"), "512");
        assert.equal(parsed.searchParams.get("height"), "512");
        assert.equal(parsed.searchParams.get("resize"), "contain");
        return new Response(tinyJpeg(), { headers: { "content-type": "image/jpeg" } });
    }));
    try {
        const result = await downloadModelReference(config, "social-reference/user-1/ref.jpg");
        assert.equal(result.source, "supabase-transform");
        assert.equal(result.mimeType, "image/jpeg");
        assert.ok(result.bytes.length > 0);
    } finally {
        restore();
    }
});

test("bila transformasi ditolak, referensi asli tetap diunduh", async () => {
    const restore = mockFetch(signHandler(async (url) => {
        if (url.includes("/render/image/sign/")) return new Response("transformations disabled", { status: 400 });
        if (url.includes("/storage/v1/object/authenticated/")) return new Response(tinyJpeg(), { headers: { "content-type": "image/jpeg" } });
        throw new Error(`Unexpected fetch: ${url}`);
    }));
    try {
        const result = await downloadModelReference(config, "social-reference/user-1/ref.jpg");
        assert.equal(result.source, "original");
        assert.ok(result.bytes.length > 0);
    } finally {
        restore();
    }
});

test("bila URL tanda tangan gagal dibuat, unduhan biasa tetap dipakai", async () => {
    const restore = mockFetch(async (url) => {
        if (url.includes("/storage/v1/object/sign/")) return new Response("nope", { status: 500 });
        if (url.includes("/storage/v1/object/authenticated/")) {
            return new Response(tinyJpeg(), { headers: { "content-type": "image/jpeg" } });
        }
        throw new Error(`Unexpected fetch: ${url}`);
    });
    try {
        await assert.rejects(() => downloadDownscaledReference(config, "social-reference/user-1/ref.jpg"));
        const result = await downloadModelReference(config, "social-reference/user-1/ref.jpg");
        assert.equal(result.source, "original");
        assert.ok(result.bytes.length > 0);
    } finally {
        restore();
    }
});

test("PNG raksasa ditolak sebelum decode agar Worker tidak kehabisan memori", () => {
    /* Header PNG 6000x6000 (36 MP) tanpa data piksel: cukup untuk memastikan
       guard dimensi berjalan sebelum pngjs membaca apa pun. */
    const bytes = new Uint8Array(64);
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    new DataView(bytes.buffer).setUint32(8, 13);
    bytes.set([0x49, 0x48, 0x44, 0x52], 12);
    new DataView(bytes.buffer).setUint32(16, 6000);
    new DataView(bytes.buffer).setUint32(20, 6000);

    const prepared = prepareReferenceImage(bytes, "image/png");
    assert.equal(prepared.resized, false);
    assert.match(prepared.note, /terlalu besar untuk diperkecil/);
    assert.match(prepared.note, /6000x6000/);
});

test("foto referensi yang sudah kecil tidak di-decode sama sekali", () => {
    const bytes = tinyJpeg();
    const prepared = prepareReferenceImage(bytes, "image/jpeg");
    assert.equal(prepared.resized, false);
    assert.equal(prepared.note, "");
    assert.equal(prepared.bytes, bytes, "byte asli dipakai apa adanya tanpa decode/encode");
});
