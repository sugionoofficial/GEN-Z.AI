import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
    downloadResolvedFacebookMedia,
    isFacebookMediaUrl,
    isSafeResolvedMediaUrl,
    normalizeFacebookUrl,
    parseGetMyFbHtml,
    resolveFacebookMediaViaGetMyFb
} from "../lib/fb-media/getmyfb.js";

import worker from "../functions/worker.mjs";

import {
    resolveAudioParameterValue,
    resolveImageParameterValue,
    resolveVideoParameterValue
} from "../generate/assets/js/generate-form-media-reader.js";

const SAMPLE_GETMYFB_VIDEO_HTML = `
<section class="results">
  <div class="container">
    <div class="results-item">
      <div class="results-item-image-wrapper">
        <img class="results-item-image" src="https://scontent-sin6-1.xx.fbcdn.net/v/t15.5256-10/cover_photo.jpg?stp=dst-jpg&amp;oe=67A1B2C3" alt="preview">
      </div>
      <div class="results-item-text">Contoh Reel Facebook Publik</div>
    </div>
    <ul class="results-list">
      <li class="results-list-item">
        360p (SD)
        <a href="https://ssscdn.io/getmyfb/sd-stream-token?exp=123&amp;sig=abc" download="getmyfb_sd.mp4">Download</a>
      </li>
      <li class="results-list-item">
        1080p (Full HD)
        <a href="https://ssscdn.io/getmyfb/hd-stream-token?exp=123&amp;sig=xyz" download="getmyfb_hd.mp4">Download</a>
      </li>
    </ul>
  </div>
</section>
`;

test("normalizeFacebookUrl & isFacebookMediaUrl mengenali berbagai format URL FB dan menolak domain asing / SSRF", () => {
    assert.equal(
        normalizeFacebookUrl("https://www.facebook.com/share/v/1AbCdEfGh/"),
        "https://www.facebook.com/share/v/1AbCdEfGh/"
    );
    assert.equal(
        normalizeFacebookUrl("http://fb.watch/xYz123/#fragment"),
        "https://fb.watch/xYz123/"
    );
    assert.equal(
        normalizeFacebookUrl("m.facebook.com/reel/9876543210"),
        "https://m.facebook.com/reel/9876543210"
    );
    assert.equal(
        normalizeFacebookUrl("https://l.facebook.com/l.php?u=https%3A%2F%2Fwww.facebook.com%2Freel%2F112233"),
        "https://www.facebook.com/reel/112233"
    );

    assert.equal(isFacebookMediaUrl("https://www.facebook.com/photo/?fbid=12345"), true);
    assert.equal(isFacebookMediaUrl("https://cdn.example.com/video.mp4"), false);
    assert.equal(isFacebookMediaUrl("http://127.0.0.1/facebook.com"), false);
    assert.equal(isFacebookMediaUrl("https://169.254.169.254/latest/meta-data"), false);
    assert.equal(isSafeResolvedMediaUrl("https://ssscdn.io/getmyfb/abc"), true);
    assert.equal(isSafeResolvedMediaUrl("https://video-sin6-2.xx.fbcdn.net/v/test.mp4"), true);
    assert.equal(isSafeResolvedMediaUrl("https://evil.example.com/test.mp4"), false);
    assert.equal(isSafeResolvedMediaUrl("http://ssscdn.io/insecure.mp4"), false);
});

test("parseGetMyFbHtml & resolveFacebookMediaViaGetMyFb memprioritaskan HD untuk video, MP4->ekstrak untuk audio, dan thumbnail/foto untuk image", async () => {
    const parsed = parseGetMyFbHtml(SAMPLE_GETMYFB_VIDEO_HTML);
    assert.equal(parsed.title, "Contoh Reel Facebook Publik");
    assert.match(parsed.imageUrl, /^https:\/\/scontent-sin6-1\.xx\.fbcdn\.net\//);
    assert.equal(parsed.downloads.length, 2);

    const calls = [];
    const mockFetch = async (url, init = {}) => {
        calls.push({ url: String(url), method: init.method || "GET", headers: init.headers, body: init.body });
        if (String(url) === "https://getmyfb.com/process") {
            return new Response(SAMPLE_GETMYFB_VIDEO_HTML, { status: 200 });
        }
        throw new Error(`Unexpected fetch: ${url}`);
    };

    const videoRes = await resolveFacebookMediaViaGetMyFb(
        "https://www.facebook.com/reel/5566778899",
        { kind: "video", fetchImpl: mockFetch }
    );
    assert.equal(calls[0].url, "https://getmyfb.com/process");
    assert.equal(calls[0].method, "POST");
    assert.equal(calls[0].headers["HX-Request"], "true");
    assert.match(calls[0].body, /id=https%3A%2F%2Fwww\.facebook\.com%2Freel%2F5566778899/);
    assert.equal(videoRes.candidates[0].url, "https://ssscdn.io/getmyfb/hd-stream-token?exp=123&sig=xyz");
    assert.equal(videoRes.candidates[0].needsClientAudioExtract, false);

    const audioRes = await resolveFacebookMediaViaGetMyFb(
        "https://www.facebook.com/reel/5566778899",
        { kind: "audio", fetchImpl: mockFetch }
    );
    /* Saat GetMyFB mengembalikan MP4 tanpa link MP3 terpisah, kandidat ditandai untuk ekstraksi audio di browser */
    assert.equal(audioRes.candidates[0].url, "https://ssscdn.io/getmyfb/sd-stream-token?exp=123&sig=abc");
    assert.equal(audioRes.candidates[0].needsClientAudioExtract, true);

    const imageRes = await resolveFacebookMediaViaGetMyFb(
        "https://www.facebook.com/reel/5566778899",
        { kind: "image", fetchImpl: mockFetch }
    );
    assert.match(imageRes.candidates[0].url, /^https:\/\/scontent-sin6-1\.xx\.fbcdn\.net\//);
});

test("downloadResolvedFacebookMedia otomatis turun ke kandidat SD bila kandidat HD melebihi batas ukuran dan memblokir redirect ke host asing", async () => {
    const candidates = [
        {
            url: "https://ssscdn.io/getmyfb/too-huge-hd",
            quality: "1080p",
            score: 1080,
            type: "video",
            source: "getmyfb.com",
            needsClientAudioExtract: false
        },
        {
            url: "https://ssscdn.io/getmyfb/valid-sd",
            quality: "720p",
            score: 720,
            type: "video",
            source: "getmyfb.com",
            needsClientAudioExtract: false
        }
    ];

    const fakeMp4Bytes = new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]);
    const mockFetch = async url => {
        if (String(url).includes("too-huge-hd")) {
            return new Response("too big", {
                status: 200,
                headers: {
                    "Content-Type": "video/mp4",
                    "Content-Length": String(250 * 1024 * 1024)
                }
            });
        }
        if (String(url).includes("valid-sd")) {
            return new Response(fakeMp4Bytes, {
                status: 200,
                headers: {
                    "Content-Type": "video/mp4",
                    "Content-Length": String(fakeMp4Bytes.byteLength)
                }
            });
        }
        throw new Error(`Unexpected url: ${url}`);
    };

    const downloaded = await downloadResolvedFacebookMedia(candidates, {
        kind: "video",
        fetchImpl: mockFetch
    });
    assert.equal(downloaded.contentType, "video/mp4");
    assert.equal(downloaded.quality, "720p");
    assert.match(downloaded.filename, /^fb-video-\d+\.mp4$/);

    await assert.rejects(
        downloadResolvedFacebookMedia(
            [{ url: "https://ssscdn.io/getmyfb/ssrf-redirect", quality: "HD", type: "video", source: "getmyfb.com" }],
            {
                kind: "video",
                fetchImpl: async () => new Response(null, {
                    status: 302,
                    headers: { Location: "http://127.0.0.1:8080/internal" }
                })
            }
        ),
        /Host unduhan media tidak diizinkan/
    );
});

test("endpoint Worker POST /api/fb-media-download memverifikasi login dan meneruskan biner hasil GetMyFB", async () => {
    const env = {
        SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_ANON_KEY: "anon-key"
    };

    /* Tanpa token -> 401 */
    const unauthRes = await worker.fetch(
        new Request("https://gen-z.ai/api/fb-media-download", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: "https://www.facebook.com/reel/123", kind: "video" })
        }),
        env,
        null
    );
    assert.equal(unauthRes.status, 401);

    /* Dengan token valid -> memproses lewat GetMyFB dan mengalirkan MP4 */
    const origFetch = globalThis.fetch;
    const sampleMp4 = new Uint8Array([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
    globalThis.fetch = async (url, init = {}) => {
        const u = String(url);
        if (u === "https://project.supabase.co/auth/v1/user") {
            return Response.json({ id: "user-owner-1", email: "owner@example.com" });
        }
        if (u === "https://getmyfb.com/process") {
            return new Response(SAMPLE_GETMYFB_VIDEO_HTML, { status: 200 });
        }
        if (u.startsWith("https://ssscdn.io/getmyfb/hd-stream-token")) {
            return new Response(sampleMp4, {
                status: 200,
                headers: {
                    "Content-Type": "video/mp4",
                    "Content-Length": String(sampleMp4.byteLength)
                }
            });
        }
        throw new Error(`Unexpected global fetch: ${u}`);
    };

    try {
        const okRes = await worker.fetch(
            new Request("https://gen-z.ai/api/fb-media-download", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer valid-jwt"
                },
                body: JSON.stringify({
                    url: "https://www.facebook.com/share/v/1TestLink/",
                    kind: "video"
                })
            }),
            env,
            null
        );

        assert.equal(okRes.status, 200);
        assert.equal(okRes.headers.get("content-type"), "video/mp4");
        assert.equal(okRes.headers.get("x-fb-media-source"), "getmyfb.com");
        assert.equal(okRes.headers.get("x-fb-media-needs-audio-extract"), "0");
        const bytes = new Uint8Array(await okRes.arrayBuffer());
        assert.deepEqual(bytes, sampleMp4);
    } finally {
        globalThis.fetch = origFetch;
    }
});

test("MediaReader mewajibkan klik Proses untuk URL FB dan memakai URL hasil akhir potongan video (cut clip) untuk Video Referensi", async () => {
    const fbLink = "https://www.facebook.com/reel/9988776655";

    /* 1. Belum klik Proses -> ditolak dengan pesan jelas */
    const unprocessedVideoInput = {
        dataset: { videoMode: "url" },
        getInputMode: () => "url",
        getUrlInput: () => ({ value: fbLink }),
        getUploadedUrl: () => ""
    };

    await assert.rejects(
        resolveVideoParameterValue(unprocessedVideoInput),
        /Klik tombol “Proses” terlebih dahulu/
    );

    /* 2. Sudah klik Proses -> memakai video hasil unduhan yang disimpan */
    const fullSavedUrl = "https://project.supabase.co/storage/v1/object/sign/user-uploads/generate-input/u1/video-full.mp4?token=full";
    const processedVideoInput = {
        dataset: {
            videoMode: "url",
            fbProcessedForUrl: fbLink,
            uploadedUrl: fullSavedUrl
        },
        getInputMode: () => "url",
        getUrlInput: () => ({ value: fbLink }),
        getUploadedUrl: () => processedVideoInput.dataset.uploadedUrl
    };

    assert.deepEqual(
        await resolveVideoParameterValue(processedVideoInput),
        [fullSavedUrl]
    );

    /* 3. Pengguna memotong video lewat VIDEO EDITOR (Potong & gunakan klip) ->
          uploadedUrl diperbarui ke klip hasil akhir, dan itulah yang dipakai untuk Video Referensi */
    const cutClipSavedUrl = "https://project.supabase.co/storage/v1/object/sign/user-uploads/generate-input/u1/video-clip.mp4?token=clip";
    processedVideoInput.dataset.uploadedUrl = cutClipSavedUrl;

    assert.deepEqual(
        await resolveVideoParameterValue(processedVideoInput),
        [cutClipSavedUrl]
    );

    /* 4. Image & Audio FB URL yang sudah diproses juga memakai URL tersimpan */
    const savedPhotoUrl = "https://project.supabase.co/storage/v1/object/sign/user-uploads/generate-input/u1/photo.jpg?token=img";
    const imageInput = {
        dataset: {
            imageMode: "url",
            fbProcessedForUrl: "https://www.facebook.com/share/p/1Photo/",
            uploadedUrl: savedPhotoUrl
        },
        getInputMode: () => "url",
        getUrlInput: () => ({ value: "https://www.facebook.com/share/p/1Photo/" }),
        getUploadedUrl: () => savedPhotoUrl
    };
    assert.deepEqual(await resolveImageParameterValue(imageInput), [savedPhotoUrl]);

    const savedAudioUrl = "https://project.supabase.co/storage/v1/object/sign/user-uploads/generate-input/u1/audio-1.wav?token=aud";
    const audioInput = {
        dataset: {
            audioMode: "url",
            fbProcessedForUrl: fbLink,
            uploadedUrl: savedAudioUrl
        },
        getInputMode: () => "url",
        getUrlInput: () => ({ value: fbLink }),
        getUploadedUrl: () => savedAudioUrl
    };
    assert.equal(await resolveAudioParameterValue(audioInput), savedAudioUrl);
});

test("UI generate-form-media.js menyediakan tombol Proses URL FB dan tetap membuka panel cut video setelah unduhan", () => {
    const mediaJs = readFileSync(new URL("../generate/assets/js/generate-form-media.js", import.meta.url), "utf8");
    const mediaCss = readFileSync(new URL("../generate/assets/css/generate-media-blocks.css", import.meta.url), "utf8");

    assert.match(mediaJs, /\/api\/fb-media-download/);
    assert.match(mediaJs, /processButton\.className = "generate-fb-process-btn"/);
    assert.match(mediaJs, /processButton\.textContent = "Proses"/);
    assert.match(mediaJs, /trimPanel\.hidden = false/);
    assert.match(mediaJs, /potong klip video di bawah/i);
    assert.match(mediaCss, /\.generate-fb-process-btn\s*\{/);
    assert.match(mediaCss, /html\[data-genz-theme="light"\]\[data-genz-theme="light"\] body #dynamicFields \.generate-fb-process-btn/);
});
