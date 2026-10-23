import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
    PRIVATE_MEDIA_SCHEME,
    buildPrivateMediaRef,
    createPrivateMediaSigner,
    isPrivateMediaRef,
    parsePrivateMediaRef,
    isRefOwnedByUser,
    signPrivateMediaRef,
    signUserMediaRefsInPayload,
    toPrivateMediaRef
} from "../lib/generate/private-media.js";

/*
 * Output upscale disimpan di bucket privat `user-uploads`.
 * DB menyimpan referensi `supabase-private://…` (tidak kedaluwarsa),
 * lalu ditukar menjadi signed URL saat dibaca.
 */

const SUPABASE_URL = "https://project.supabase.co";
const SERVICE_KEY = "service-role-key";
const USER_ID = "c237fcef-6456-451e-ae98-691f2dabb60d";

const PHOTO_REF = buildPrivateMediaRef({
    bucket: "user-uploads",
    objectPath: `upscale-photos/outputs/${USER_ID}/1792000000000-abc12345.jpg`
});

function fakeFetch({ ok = true, signedURL = "/object/sign/user-uploads/a.jpg?token=t", status = 200 } = {}) {
    const calls = [];

    const impl = async (url, options) => {
        calls.push({ url, options });
        return {
            ok,
            status,
            json: async () => (ok ? { signedURL } : null),
            text: async () => "error detail"
        };
    };

    impl.calls = calls;
    return impl;
}

function read(path) {
    return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("build + parse referensi privat", () => {
    assert.equal(PRIVATE_MEDIA_SCHEME, "supabase-private");
    assert.equal(isPrivateMediaRef(PHOTO_REF), true);

    const parsed = parsePrivateMediaRef(PHOTO_REF);

    assert.deepEqual(parsed, {
        bucket: "user-uploads",
        objectPath: `upscale-photos/outputs/${USER_ID}/1792000000000-abc12345.jpg`
    });
});

test("menolak referensi aneh / traversal / URL publik lama", () => {
    assert.equal(parsePrivateMediaRef(""), null);
    assert.equal(parsePrivateMediaRef("https://project.supabase.co/x.jpg"), null);
    assert.equal(parsePrivateMediaRef("supabase-private://user-uploads"), null);
    assert.equal(parsePrivateMediaRef("supabase-private:///a.jpg"), null);
    assert.equal(
        parsePrivateMediaRef("supabase-private://user-uploads/../../secret.jpg"),
        null
    );
    assert.equal(isPrivateMediaRef("https://project.supabase.co/storage/v1/object/public/dashboard-upscales/outputs/a.mp4"), false);
});

test("signPrivateMediaRef memanggil Storage API dan mengembalikan URL absolut", async () => {
    const fetchImpl = fakeFetch({
        signedURL: "/object/sign/user-uploads/upscale-photos/outputs/x.jpg?token=abc"
    });

    const url = await signPrivateMediaRef({
        ref: PHOTO_REF,
        supabaseUrl: SUPABASE_URL,
        serviceKey: SERVICE_KEY,
        fetchImpl
    });

    assert.equal(
        url,
        `${SUPABASE_URL}/storage/v1/object/sign/user-uploads/upscale-photos/outputs/x.jpg?token=abc`
    );

    assert.equal(fetchImpl.calls.length, 1);
    assert.match(fetchImpl.calls[0].url, /\/storage\/v1\/object\/sign\/user-uploads\/upscale-photos\/outputs\//);
    assert.match(fetchImpl.calls[0].options.headers.Authorization, /^Bearer /);
    assert.deepEqual(JSON.parse(fetchImpl.calls[0].options.body), { expiresIn: 1800 });
});

test("URL publik lama dibiarkan apa adanya", async () => {
    const fetchImpl = fakeFetch();
    const legacy = "https://project.supabase.co/storage/v1/object/public/dashboard-upscales/outputs/a.mp4";

    const url = await signPrivateMediaRef({
        ref: legacy,
        supabaseUrl: SUPABASE_URL,
        serviceKey: SERVICE_KEY,
        fetchImpl
    });

    assert.equal(url, legacy);
    assert.equal(fetchImpl.calls.length, 0);
});

test("signer deep-walk + cache + fallback saat gagal", async () => {
    const fetchImpl = fakeFetch({ signedURL: "/object/sign/user-uploads/a.jpg?token=t" });
    const warnings = [];

    const signer = createPrivateMediaSigner({
        supabaseUrl: SUPABASE_URL,
        serviceKey: SERVICE_KEY,
        fetchImpl,
        logger: { warn: (...args) => warnings.push(args.join(" ")) }
    });

    const payload = {
        rows: [
            { id: 1, result_url: PHOTO_REF, model_name: "upscale-photo" },
            { id: 2, result_url: PHOTO_REF }
        ],
        meta: { nested: PHOTO_REF, other: "plain" },
        legacy: "https://project.supabase.co/storage/v1/object/public/dashboard-videos/videos/a.mp4"
    };

    const signed = await signer.signDeep(payload);

    assert.match(signed.rows[0].result_url, /^https:\/\/project\.supabase\.co\/storage\/v1\/object\/sign\//);
    assert.equal(signed.meta.other, "plain");
    assert.equal(signed.legacy, payload.legacy);

    // Referensi yang sama hanya ditandatangani sekali (cache).
    assert.equal(fetchImpl.calls.length, 1);

    const failing = createPrivateMediaSigner({
        supabaseUrl: SUPABASE_URL,
        serviceKey: SERVICE_KEY,
        fetchImpl: fakeFetch({ ok: false, status: 400 }),
        logger: { warn: (...args) => warnings.push(args.join(" ")) }
    });

    const result = await failing.signDeep({ url: PHOTO_REF });

    // Gagal sign: referensi dibiarkan, bukan diganti URL publik.
    assert.equal(result.url, PHOTO_REF);
    assert.equal(warnings.length, 1);
});

test("API menandatangani media privat di json()", () => {
    for (const file of ["api/generate.js", "api/generate-status.js"]) {
        const source = read(file);

        assert.match(source, /createPrivateMediaSigner/);
        assert.match(source, /await privateMediaSigner\s*\.signDeep\(data\)/);
        assert.match(source, /JSON\.stringify\(\s*payload\s*\)/);
    }
});

test("workflow upscale mengunggah output ke bucket privat per user", () => {
    const photo = read(".github/workflows/upscale-photo.yml");
    const video = read(".github/workflows/upscale.yml");

    assert.match(photo, /BUCKET="user-uploads"/);
    assert.match(photo, /KEY="upscale-photos\/outputs\/\$\{USER_ID\}\/\$\{FILENAME\}"/);
    assert.match(photo, /RESULT_REF="supabase-private:\/\/\$\{BUCKET\}\/\$\{KEY\}"/);
    assert.match(photo, /\\"result_url\\": \\"\$\{RESULT_REF\}\\"/);

    assert.match(video, /BUCKET="user-uploads"/);
    assert.match(video, /KEY="upscale-videos\/outputs\/\$\{USER_ID\}\/\$\{FILENAME\}"/);
    assert.match(video, /RESULT_REF="supabase-private:\/\/\$\{BUCKET\}\/\$\{KEY\}"/);
    assert.match(video, /\\"result_url\\": \\"\$\{RESULT_REF\}\\"/);

    // Tidak boleh ada lagi URL publik untuk output.
    assert.equal(/object\/public\/\$\{BUCKET\}/.test(photo), false);
    assert.equal(/object\/public\/\$\{BUCKET\}/.test(video), false);
});

test("halaman riwayat menukar referensi privat jadi signed URL", () => {
    const source = read("history/assets/js/history-data.js");

    assert.match(source, /PRIVATE_MEDIA_SCHEME\s*=\s*\n?\s*"supabase-private"/);
    assert.match(source, /createSignedUrl\(/);
    assert.match(source, /await resolvePrivateMediaRefs\(\s*state\.historyData\s*\)/);

    const html = read("history/index.html");
    assert.match(html, /history-data\.js\?v=20261023-media-refresh/);
});

test("policy storage mengizinkan user membaca output miliknya", () => {
    const sql = read("supabase/user-media-bucket.sql");

    assert.match(sql, /upscale-photos\/outputs/);
    assert.match(sql, /upscale-videos\/outputs/);
    assert.match(sql, /create or replace function public\.user_owns_media_path/);
    assert.match(sql, /create or replace function public\.user_owns_media_input_path/);
    assert.match(sql, /create policy "Users read own media uploads"/);
    assert.match(sql, /create policy "Admins read all media uploads"/);
    assert.match(sql, /create or replace function public\.is_media_admin/);
});

test("toPrivateMediaRef mengubah URL storage menjadi referensi stabil", () => {
    const signed =
        `${SUPABASE_URL}/storage/v1/object/sign/user-uploads/generate-input/${USER_ID}/a.jpg?token=x`;
    const authenticated =
        `${SUPABASE_URL}/storage/v1/object/authenticated/user-uploads/upscale-photos/outputs/${USER_ID}/b.jpg`;

    assert.equal(
        toPrivateMediaRef(signed, { supabaseUrl: SUPABASE_URL }),
        `supabase-private://user-uploads/generate-input/${USER_ID}/a.jpg`
    );

    assert.equal(
        toPrivateMediaRef(authenticated, { supabaseUrl: SUPABASE_URL }),
        `supabase-private://user-uploads/upscale-photos/outputs/${USER_ID}/b.jpg`
    );

    // Referensi yang sudah privat dinormalisasi ulang.
    assert.equal(
        toPrivateMediaRef(PHOTO_REF, { supabaseUrl: SUPABASE_URL }),
        PHOTO_REF
    );
});

test("toPrivateMediaRef menolak URL asing / bucket lain / traversal", () => {
    const legacy =
        `${SUPABASE_URL}/storage/v1/object/public/dashboard-videos/videos/a.mp4`;
    const foreign =
        `https://evil.example/storage/v1/object/sign/user-uploads/a.jpg?token=x`;
    const traversal =
        `${SUPABASE_URL}/storage/v1/object/sign/user-uploads/../../secret.jpg?token=x`;
    const plain = "https://cdn.example/video.mp4";

    assert.equal(toPrivateMediaRef(legacy, { supabaseUrl: SUPABASE_URL }), null);
    assert.equal(toPrivateMediaRef(foreign, { supabaseUrl: SUPABASE_URL }), null);
    assert.equal(toPrivateMediaRef(traversal, { supabaseUrl: SUPABASE_URL }), null);
    assert.equal(toPrivateMediaRef(plain, { supabaseUrl: SUPABASE_URL }), null);
    assert.equal(toPrivateMediaRef("", { supabaseUrl: SUPABASE_URL }), null);
});

test("history menyimpan referensi stabil untuk input generate & upscale", () => {
    const source = read("api/generate.js");

    assert.match(source, /toPrivateMediaRef\(imageReference, \{ supabaseUrl: SUPABASE_URL \}\)/);
    assert.match(source, /toPrivateMediaRef\(videoReference, \{ supabaseUrl: SUPABASE_URL \}\)/);
    assert.match(source, /toPrivateMediaRef\(sourceUrl, \{ supabaseUrl: SUPABASE_URL \}\)/);

    const historyData = read("history/assets/js/history-data.js");
    assert.match(historyData, /PRIVATE_MEDIA_FIELDS\s*=\s*\[/);
    assert.match(historyData, /"image_reference_url"/);
    assert.match(historyData, /"video_reference_url"/);
});

test("baris riwayat ditandai kedaluwarsa saat signed URL gagal", () => {
    const data = read("history/assets/js/history-data.js");
    const render = read("history/assets/js/history-render.js");

    assert.match(data, /item\.media_expired\s*=\s*\n?\s*true/);
    assert.match(render, /item\?\.media_expired === true/);
    assert.match(render, /"\/storage\/v1\/object\/sign\/user-uploads\/"/);
    assert.match(render, /"\/storage\/v1\/object\/authenticated\/user-uploads\/"/);

    const html = read("history/index.html");
    assert.match(html, /history-render\.js\?v=20261023-private-media/);

    // Unduhan dari signed URL tetap memakai nama file yang rapi.
    const modal = read("history/assets/js/history-modal.js");
    assert.match(modal, /\/storage\/v1\/object\/sign\//);
});

test("isRefOwnedByUser hanya mengizinkan folder user sendiri", () => {
    const own = `supabase-private://user-uploads/generate-input/${USER_ID}/1792000000000-a.jpg`;
    const other = `supabase-private://user-uploads/generate-input/11111111-2222-3333-4444-555555555555/a.jpg`;
    const output = `supabase-private://user-uploads/upscale-videos/outputs/${USER_ID}/1792000000000-b.mp4`;
    const foreignBucket = `supabase-private://dashboard-upscales/outputs/${USER_ID}/a.mp4`;

    assert.equal(isRefOwnedByUser(own, USER_ID), true);
    assert.equal(isRefOwnedByUser(output, USER_ID), true);
    assert.equal(isRefOwnedByUser(other, USER_ID), false);
    assert.equal(isRefOwnedByUser(foreignBucket, USER_ID), false);
    assert.equal(
        isRefOwnedByUser(`supabase-private://user-uploads/generate-input/${USER_ID}/../../secret.jpg`, USER_ID),
        false
    );
    assert.equal(isRefOwnedByUser(own, ""), false);
});

test("referensi di request hanya ditandatangani kalau milik user", async () => {
    const fetchImpl = fakeFetch({
        signedURL: "/object/sign/user-uploads/generate-input/x.jpg?token=abc"
    });

    const body = {
        action: "generate",
        parameters: {
            image_urls: [
                `supabase-private://user-uploads/generate-input/${USER_ID}/1792000000000-a.jpg`
            ],
            video_urls: [
                "supabase-private://user-uploads/generate-input/11111111-2222-3333-4444-555555555555/b.mp4"
            ]
        },
        prompt: "tetap sama"
    };

    const signed = await signUserMediaRefsInPayload(body, {
        userId: USER_ID,
        supabaseUrl: SUPABASE_URL,
        serviceKey: SERVICE_KEY,
        fetchImpl,
        logger: { warn: () => {} }
    });

    assert.match(signed.parameters.image_urls[0], /^https:\/\/project\.supabase\.co\/storage\/v1\/object\/sign\//);
    // File user lain dibiarkan (tidak ditandatangani) → tidak ada kebocoran.
    assert.equal(signed.parameters.video_urls[0], body.parameters.video_urls[0]);
    assert.equal(signed.prompt, "tetap sama");
    assert.equal(fetchImpl.calls.length, 1);
});

test("payload tanpa referensi privat tidak menyentuh Storage API", async () => {
    const fetchImpl = fakeFetch();

    const body = {
        action: "generate",
        parameters: { image_urls: ["https://cdn.example/a.jpg"] }
    };

    const result = await signUserMediaRefsInPayload(body, {
        userId: USER_ID,
        supabaseUrl: SUPABASE_URL,
        serviceKey: SERVICE_KEY,
        fetchImpl
    });

    assert.equal(result, body);
    assert.equal(fetchImpl.calls.length, 0);
});

test("signed URL diperbarui otomatis sebelum kedaluwarsa", () => {
    const data = read("history/assets/js/history-data.js");

    assert.match(data, /PRIVATE_MEDIA_REFRESH_MS\s*=\s*\n?\s*5 \* 60 \* 1000/);
    assert.match(data, /async function refreshPrivateMediaRefs\(\)/);
    assert.match(data, /item\.__privateMediaRefs\s*=\s*\n?\s*item\.__privateMediaRefs \|\| \{\}/);
    assert.match(data, /function ensurePrivateMediaWatch\(\)/);
    assert.match(data, /window\.setInterval\(/);
    assert.match(data, /App\.refreshPrivateMediaRefs\s*=/);

    // Setelah token diperbarui, tabel dirender ulang.
    assert.match(data, /typeof App\.renderHistory ===\s*\n?\s*"function"/);

    const html = read("history/index.html");
    assert.match(html, /history-data\.js\?v=20261023-media-refresh/);
});
