import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
    SOCIAL_POST_MODES,
    QUOTE_PUBLISH_TARGETS,
    QUOTE_PRESETS,
    BUILTIN_STORY_SONGS,
    DEFAULT_FACEBOOK_SONGS,
    normalizeSocialPostMode,
    normalizeQuotePublishTarget,
    sanitizeFacebookSongUrl,
    pickRandomFacebookSong,
    createQuotePlan,
    quoteOverridesFromSchedule,
    cleanQuoteText,
    pickFallbackQuote,
    buildQuoteImagePrompt
} from "../lib/social-publisher/quotes.js";
import {
    encodeStoryMp4,
    extractAudioForStoryMp4,
    renderQuoteStoryCard
} from "../lib/social-publisher/story-video.js";
import {
    encryptSecret,
    generateSocialQuote,
    generateSocialQuoteImage,
    publishFacebookQuoteVideo
} from "../lib/social-publisher/providers.js";
import socialPublisherHandler from "../api/social-publisher.js";
import { runSocialPublisherCron } from "../functions/_shared/social-publisher-cron.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const TINY_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z0ioAAAAASUVORK5CYII=";
const TEST_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
const SAMPLE_M4A_BYTES = new Uint8Array(
    fs.readFileSync(path.join(repoRoot, "assets/audio/story-music/senja-akustik.m4a"))
);

function makeRes() {
    return {
        statusCode: 200,
        headers: {},
        body: null,
        rawBytes: null,
        setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.body = payload; return this; },
        end(payload) { this.rawBytes = payload; return this; }
    };
}

test("quotes module normalizes post modes, ships 8 playable built-in Story tracks without search URLs, and rotates playable songs", () => {
    assert.deepEqual(SOCIAL_POST_MODES, ["character", "quote"]);
    assert.equal(normalizeSocialPostMode("quote"), "quote");
    assert.equal(normalizeSocialPostMode("QUOTE"), "quote");
    assert.equal(normalizeSocialPostMode("character"), "character");
    assert.equal(normalizeSocialPostMode(""), "character");
    assert.equal(normalizeSocialPostMode("anything-else"), null);

    assert.equal(BUILTIN_STORY_SONGS.length, 8);
    assert.equal(DEFAULT_FACEBOOK_SONGS.length, 8);
    for (const track of BUILTIN_STORY_SONGS) {
        assert.match(track.audio_object_key, /^builtin:/);
        assert.equal(track.facebook_url, "");
        const assetFile = path.join(repoRoot, track.asset_path.replace(/^\/+/, ""));
        assert.equal(fs.existsSync(assetFile), true, `Missing built-in Story track: ${assetFile}`);
    }

    assert.equal(sanitizeFacebookSongUrl(""), "");
    assert.equal(
        sanitizeFacebookSongUrl("https://www.facebook.com/reel/1234567890"),
        "https://www.facebook.com/reel/1234567890"
    );
    assert.equal(sanitizeFacebookSongUrl("https://open.spotify.com/track/123"), "");

    const customSongs = [
        { id: "song-link-only", title: "Link Saja", artist: "Test", audio_object_key: "", is_active: true },
        { id: "song-1", title: "Lagu Upload 1", artist: "Kreator A", audio_object_key: "story-audio/u1/s1.m4a", duration_seconds: 15, is_active: true },
        { id: "song-2", title: "Lagu Upload 2", artist: "Kreator B", audio_object_key: "story-audio/u1/s2.mp3", duration_seconds: 18, is_active: true }
    ];

    // requirePlayableAudio skips rows without audio_object_key and avoids recently used song-1.
    const picked = pickRandomFacebookSong(customSongs, ["song-1"], () => 0, { requirePlayableAudio: true });
    assert.equal(picked.id, "song-2");
    assert.equal(picked.title, "Lagu Upload 2");
    assert.equal(picked.audio_object_key, "story-audio/u1/s2.mp3");

    // Empty playable custom list falls back automatically to built-in playable Story tracks.
    const fallbackPicked = pickRandomFacebookSong(
        [{ id: "song-link-only", title: "Link Saja", audio_object_key: "", is_active: true }],
        [{ song_title: BUILTIN_STORY_SONGS[0].title, song_artist: BUILTIN_STORY_SONGS[0].artist }],
        () => 0,
        { requirePlayableAudio: true }
    );
    assert.ok(fallbackPicked?.title);
    assert.match(fallbackPicked.audio_object_key, /^builtin:/);
    assert.notEqual(fallbackPicked.title, BUILTIN_STORY_SONGS[0].title);
});

test("buildQuoteImagePrompt enforces strictly text-free scenic background and story-video renders crisp 540x960 H.264+AAC MP4", async () => {
    const plan = createQuotePlan([], () => 0, quoteOverridesFromSchedule({
        quote_theme: "senja",
        quote_visual_style: QUOTE_PRESETS.visualStyles[0].value,
        scene_details: "cahaya hangat di tepi danau"
    }));
    const cleanedQuote = cleanQuoteText('"Pelan tidak apa-apa, asal langkahmu tetap menuju pulang."');
    assert.equal(cleanedQuote, "Pelan tidak apa-apa, asal langkahmu tetap menuju pulang.");
    assert.ok(pickFallbackQuote("senja", [cleanedQuote], () => 0).length > 10);

    const prompt = buildQuoteImagePrompt({
        quotePlan: plan,
        aspectRatio: "9:16",
        negativePrompt: "mobil, gedung"
    });
    assert.match(prompt, /NO TEXT AT ALL/i);
    assert.match(prompt, /NO people, NO characters, NO human faces/i);
    assert.doesNotMatch(prompt, /Pelan tidak apa-apa/, "AI background prompt must NEVER contain quote text");

    const card = await renderQuoteStoryCard({
        backgroundBytes: Buffer.from(TINY_PNG_BASE64, "base64"),
        quoteText: cleanedQuote,
        seed: 2
    });
    assert.equal(card.width, 540);
    assert.equal(card.height, 960);
    assert.ok(card.pngBytes.byteLength > 5_000);

    const encoded = encodeStoryMp4({
        rgba: card.rgba,
        width: card.width,
        height: card.height,
        audioBytes: SAMPLE_M4A_BYTES
    });
    assert.equal(encoded.hasAudio, true);
    assert.equal(Math.round(encoded.durationSec), 15);
    assert.equal(Buffer.from(encoded.mp4Bytes.subarray(4, 8)).toString("ascii"), "ftyp");
    assert.equal(Buffer.from(encoded.mp4Bytes).includes(Buffer.from("avc1")), true);
    assert.equal(Buffer.from(encoded.mp4Bytes).includes(Buffer.from("mp4a")), true);

    // Extracting audio from a full .mp4 video (e.g. downloaded from Facebook Reels/Stories) also succeeds.
    const extractedFromVideo = extractAudioForStoryMp4(encoded.mp4Bytes);
    assert.ok(extractedFromVideo);
    assert.equal(extractedFromVideo.codec, "aac");
    assert.ok(extractedFromVideo.frames.length > 100);
});

test("generateSocialQuote and generateSocialQuoteImage support Gemini and Cloudflare without character references", async () => {
    const plan = createQuotePlan([], () => 0, { theme: "motivasi" });

    const originalFetch = globalThis.fetch;
    try {
        globalThis.fetch = async (input, init = {}) => {
            const url = String(input);
            if (url.includes("/v1beta/interactions")) {
                const payload = JSON.parse(init.body || "{}");
                if (String(payload.model || "").includes("image")) {
                    return Response.json({
                        output_image: {
                            mime_type: "image/png",
                            data: TINY_PNG_BASE64
                        }
                    });
                }
                return Response.json({
                    outputs: [{
                        type: "text",
                        text: "QUOTE: Langkah kecil hari ini tetap lebih jauh daripada diam di tempat kemarin.\nCAPTION: Teruslah melangkah meski pelan."
                    }]
                });
            }
            throw new Error(`Unexpected fetch URL: ${url}`);
        };

        const geminiQuote = await generateSocialQuote({
            env: { GEMINI_API_KEY: "test-gemini-key" },
            quotePlan: plan,
            recentQuotes: [],
            imageProvider: "gemini"
        });
        assert.equal(
            geminiQuote.quoteText,
            "Langkah kecil hari ini tetap lebih jauh daripada diam di tempat kemarin."
        );

        const geminiImage = await generateSocialQuoteImage({
            env: { GEMINI_API_KEY: "test-gemini-key" },
            prompt: buildQuoteImagePrompt({ quotePlan: plan }),
            aspectRatio: "9:16",
            imageProvider: "gemini"
        });
        assert.equal(geminiImage.mimeType, "image/png");
        assert.ok(geminiImage.bytes.byteLength > 0);

        const cfEnv = {
            AI: {
                async run(model) {
                    if (model.includes("llama")) {
                        return {
                            response: "QUOTE: Tenang bukan berarti menyerah, melainkan memberi ruang agar hati kembali utuh."
                        };
                    }
                    if (model.includes("flux")) {
                        return { image: TINY_PNG_BASE64 };
                    }
                    throw new Error(`Unexpected CF model: ${model}`);
                }
            }
        };
        const cfQuote = await generateSocialQuote({
            env: cfEnv,
            quotePlan: plan,
            recentQuotes: [],
            imageProvider: "cloudflare"
        });
        assert.match(cfQuote.quoteText, /Tenang bukan berarti menyerah/);
        const cfImage = await generateSocialQuoteImage({
            env: cfEnv,
            prompt: "Latar senja polos tanpa teks",
            aspectRatio: "9:16",
            imageProvider: "cloudflare"
        });
        assert.equal(cfImage.mimeType, "image/png");
        assert.ok(cfImage.bytes.byteLength > 0);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("API social-publisher defaults Quote + Auto-Play Music to permanent Page Feed post (videos) and supports Reels, Story, and Feed+Story targets", async () => {
    const encryptedPageToken = await encryptSecret("fb-page-secret-token", TEST_ENCRYPTION_KEY);
    const songsStore = [];
    const runsStore = [];
    const schedulesStore = [];
    const audioBucketStore = new Map();
    const storyPhases = [];
    const reelPhases = [];
    let feedPhotoCalls = 0;
    let feedVideoCalls = 0;
    let lastFeedVideoDescription = null;

    const env = {
        SUPABASE_URL: "https://supabase.example.co",
        SUPABASE_ANON_KEY: "anon-key",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
        GEMINI_API_KEY: "gemini-key",
        META_APP_ID: "meta-app",
        META_APP_SECRET: "meta-secret",
        META_LOGIN_CONFIG_ID: "login-cfg",
        SOCIAL_TOKEN_ENCRYPTION_KEY: TEST_ENCRYPTION_KEY
    };

    const originalFetch = globalThis.fetch;
    try {
        globalThis.fetch = async (input, init = {}) => {
            const url = String(input);
            const method = (init.method || "GET").toUpperCase();

            if (url.endsWith("/auth/v1/user")) {
                return Response.json({ id: "user-quote-1", email: "creator@example.com" });
            }
            if (url.includes("/rest/v1/profiles?")) {
                return Response.json([{ id: "user-quote-1", role: "ADMIN", status: "active" }]);
            }
            if (url.includes("/rest/v1/studio_medsos_access?")) {
                return Response.json([{
                    user_id: "user-quote-1",
                    is_active: true,
                    duration_days: 30,
                    started_at: new Date(Date.now() - 86400000).toISOString(),
                    expires_at: new Date(Date.now() + 29 * 86400000).toISOString()
                }]);
            }
            if (url.includes("/rest/v1/social_publisher_config?") || url.includes("/rest/v1/social_publisher_settings?")) {
                return Response.json([{
                    id: true,
                    global_enabled: true,
                    autopublish_enabled: true,
                    image_provider: "gemini",
                    image_model: "gemini-3.1-flash-lite-image"
                }]);
            }
            if (url.includes("/rest/v1/social_publisher_user_settings?")) {
                return Response.json([{
                    owner_id: "user-quote-1",
                    autopublish_enabled: true,
                    caption_template: "Cerita hari ini...!!! #foryou #outfit #fashion",
                    external_link: "https://spam-link.example.com"
                }]);
            }
            if (url.includes("/rest/v1/social_page_connections?")) {
                return Response.json([{
                    id: "page-conn-1",
                    owner_id: "user-quote-1",
                    page_id: "99887766",
                    page_name: "Ruang Teduh Page",
                    page_token_ciphertext: encryptedPageToken.ciphertext,
                    page_token_iv: encryptedPageToken.iv,
                    can_publish: true
                }]);
            }
            if (url.includes("/storage/v1/object/authenticated/social-story-audio/")) {
                const key = decodeURIComponent(url.split("/social-story-audio/")[1]);
                const bytes = audioBucketStore.get(key);
                if (!bytes) return new Response("Not found", { status: 404 });
                return new Response(bytes, { status: 200, headers: { "Content-Type": "audio/mp4" } });
            }
            if (url.includes("/storage/v1/object/social-story-audio") && method === "DELETE") {
                const payload = JSON.parse(init.body || "{}");
                for (const p of payload.prefixes || []) audioBucketStore.delete(p);
                return Response.json({ message: "Deleted" });
            }
            if (url.includes("/storage/v1/object/social-story-audio/")) {
                const key = decodeURIComponent(url.split("/social-story-audio/")[1]);
                audioBucketStore.set(key, new Uint8Array(init.body));
                return Response.json({ Key: key });
            }
            if (url.includes("/rest/v1/social_facebook_songs")) {
                if (method === "GET") {
                    const parsed = new URL(url);
                    const idFilter = parsed.searchParams.get("id")?.replace(/^eq\./, "");
                    if (idFilter) {
                        return Response.json(songsStore.filter(s => s.id === idFilter));
                    }
                    return Response.json([...songsStore]);
                }
                if (method === "POST") {
                    const payload = JSON.parse(init.body);
                    const items = Array.isArray(payload) ? payload : [payload];
                    const inserted = items.map((item, idx) => {
                        const row = {
                            id: item.id || `song-${songsStore.length + idx + 1}`,
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString(),
                            ...item
                        };
                        songsStore.push(row);
                        return row;
                    });
                    return Response.json(inserted, { status: 201 });
                }
                if (method === "PATCH") {
                    const payload = JSON.parse(init.body);
                    const parsed = new URL(url);
                    const idFilter = parsed.searchParams.get("id")?.replace(/^eq\./, "");
                    const idx = songsStore.findIndex(s => s.id === idFilter);
                    if (idx >= 0) songsStore[idx] = { ...songsStore[idx], ...payload };
                    return Response.json(idx >= 0 ? [songsStore[idx]] : []);
                }
                if (method === "DELETE") {
                    const parsed = new URL(url);
                    const idFilter = parsed.searchParams.get("id")?.replace(/^eq\./, "");
                    const idx = songsStore.findIndex(s => s.id === idFilter);
                    if (idx >= 0) songsStore.splice(idx, 1);
                    return new Response(null, { status: 204 });
                }
            }
            if (url.includes("/rest/v1/social_post_runs")) {
                if (method === "GET") {
                    const parsed = new URL(url);
                    const idFilter = parsed.searchParams.get("id")?.replace(/^eq\./, "");
                    if (idFilter) {
                        return Response.json(runsStore.filter(r => r.id === idFilter));
                    }
                    return Response.json([...runsStore]);
                }
                if (method === "POST") {
                    const payload = JSON.parse(init.body);
                    const row = {
                        id: `run-${runsStore.length + 1}`,
                        created_at: new Date().toISOString(),
                        ...payload
                    };
                    runsStore.unshift(row);
                    return Response.json([row], { status: 201 });
                }
                if (method === "PATCH") {
                    const payload = JSON.parse(init.body);
                    const parsed = new URL(url);
                    const idFilter = parsed.searchParams.get("id")?.replace(/^eq\./, "");
                    const idx = runsStore.findIndex(r => r.id === idFilter);
                    if (idx >= 0) runsStore[idx] = { ...runsStore[idx], ...payload };
                    return Response.json(idx >= 0 ? [runsStore[idx]] : []);
                }
            }
            if (url.includes("/rest/v1/social_post_schedules")) {
                if (method === "GET") {
                    if (init.headers?.Prefer?.includes("count=exact")) {
                        return new Response(JSON.stringify(schedulesStore), {
                            status: 200,
                            headers: {
                                "Content-Type": "application/json",
                                "Content-Range": `0-${Math.max(0, schedulesStore.length - 1)}/${schedulesStore.length}`
                            }
                        });
                    }
                    return Response.json([...schedulesStore]);
                }
                if (method === "POST") {
                    const payload = JSON.parse(init.body);
                    const row = {
                        id: `sched-${schedulesStore.length + 1}`,
                        created_at: new Date().toISOString(),
                        ...payload
                    };
                    schedulesStore.push(row);
                    return Response.json([row], { status: 201 });
                }
            }
            if (url.includes("/v1beta/interactions")) {
                const payload = JSON.parse(init.body || "{}");
                if (String(payload.model || "").includes("image")) {
                    return Response.json({
                        output_image: {
                            mime_type: "image/png",
                            data: TINY_PNG_BASE64
                        }
                    });
                }
                return Response.json({
                    outputs: [{
                        type: "text",
                        text: "QUOTE: Setiap senja mengajarkan bahwa yang indah pun tahu cara berpamitan dengan tenang."
                    }]
                });
            }
            if (url.includes("graph.facebook.com") && url.includes("/99887766?fields=")) {
                return Response.json({ id: "99887766", name: "Ruang Teduh Page", tasks: ["CREATE_CONTENT", "MANAGE"] });
            }
            if (url.includes("graph.facebook.com") && url.endsWith("/99887766/photos")) {
                feedPhotoCalls += 1;
                return Response.json({ id: "photo-1", post_id: "99887766_555111" });
            }
            if (url.includes("graph-video.facebook.com") && url.endsWith("/99887766/videos")) {
                feedVideoCalls += 1;
                const form = init.body;
                lastFeedVideoDescription = form instanceof FormData ? form.get("description") : "unexpected";
                assert.equal(form.get("published"), "true");
                const fileBlob = form.get("source");
                assert.ok(fileBlob instanceof Blob && fileBlob.size > 10_000);
                return Response.json({ id: "feed-vid-505", post_id: "99887766_505" });
            }
            if (url.includes("graph.facebook.com") && url.includes("/feed-vid-505?")) {
                return Response.json({ permalink_url: "/99887766/videos/505/" });
            }
            if (url.includes("graph.facebook.com") && url.endsWith("/99887766/video_reels")) {
                const params = new URLSearchParams(String(init.body || ""));
                const phase = params.get("upload_phase");
                reelPhases.push(phase);
                if (phase === "start") {
                    return Response.json({
                        video_id: "reel-vid-202",
                        upload_url: "https://rupload.facebook.com/video-upload/v26.0/reel-vid-202"
                    });
                }
                if (phase === "finish") {
                    assert.equal(params.get("video_id"), "reel-vid-202");
                    assert.equal(params.get("video_state"), "PUBLISHED");
                    assert.equal(params.get("description"), null);
                    return Response.json({ success: true, post_id: "99887766_reel_202" });
                }
            }
            if (url.includes("graph.facebook.com") && url.includes("/reel-vid-202?")) {
                return Response.json({ permalink_url: "/reel/202" });
            }
            if (url.includes("graph.facebook.com") && url.endsWith("/99887766/video_stories")) {
                const params = new URLSearchParams(String(init.body || ""));
                const phase = params.get("upload_phase");
                storyPhases.push(phase);
                if (phase === "start") {
                    return Response.json({
                        video_id: "story-vid-101",
                        upload_url: "https://rupload.facebook.com/video-upload/v26.0/story-vid-101"
                    });
                }
                if (phase === "finish") {
                    assert.equal(params.get("video_id"), "story-vid-101");
                    return Response.json({ success: true, post_id: "99887766_story_9001" });
                }
            }
            if (url.startsWith("https://rupload.facebook.com/video-upload/")) {
                if (url.includes("reel-vid-202")) reelPhases.push("binary-upload");
                else storyPhases.push("binary-upload");
                assert.equal(init.headers?.offset, "0");
                assert.ok(Number(init.headers?.file_size) > 10_000);
                return Response.json({ success: true });
            }
            if (url.includes("graph.facebook.com") && url.includes("99887766_story_9001")) {
                return Response.json({ permalink_url: "https://www.facebook.com/stories/99887766/9001" });
            }
            return Response.json([]);
        };

        // 1. Upload custom song (.m4a) into private bucket social-story-audio
        const uploadSongRes = makeRes();
        await socialPublisherHandler({
            method: "POST",
            url: "/api/social-publisher?action=upload-song",
            headers: {
                authorization: "Bearer valid-token",
                "content-type": "audio/mp4",
                "x-file-name": encodeURIComponent("lagu-favorit-senja.m4a"),
                "x-song-title": encodeURIComponent("Gitar Senja Favorit"),
                "x-song-artist": encodeURIComponent("Akustik Nusantara"),
                "x-song-mood": encodeURIComponent("Tenang & Syukur")
            },
            body: SAMPLE_M4A_BYTES,
            env
        }, uploadSongRes);
        assert.equal(uploadSongRes.statusCode, 201);
        assert.equal(uploadSongRes.body.song.title, "Gitar Senja Favorit");
        assert.match(uploadSongRes.body.song.audio_object_key, /^story-audio\/user-quote-1\//);
        assert.equal(uploadSongRes.body.song.duration_seconds, 15);
        assert.equal(audioBucketStore.size, 1);

        // 2. Stream uploaded song audio back for Studio Medsos preview player
        const streamRes = makeRes();
        await socialPublisherHandler({
            method: "GET",
            url: `/api/social-publisher?action=song-audio&id=${encodeURIComponent(uploadSongRes.body.song.id)}`,
            headers: { authorization: "Bearer valid-token" },
            env
        }, streamRes);
        assert.equal(streamRes.statusCode, 200);
        assert.equal(streamRes.rawBytes.byteLength, SAMPLE_M4A_BYTES.byteLength);

        // 3. Manual quote preview generation defaults to permanent Page Feed post ("feed")
        assert.deepEqual(QUOTE_PUBLISH_TARGETS, ["feed", "reels", "story", "feed_story"]);
        assert.equal(normalizeQuotePublishTarget(undefined), "feed");
        assert.equal(normalizeQuotePublishTarget("reels"), "reels");
        assert.equal(normalizeQuotePublishTarget("unknown"), "feed");

        const previewRes = makeRes();
        await socialPublisherHandler({
            method: "POST",
            url: "/api/social-publisher?action=manual-generate",
            headers: { authorization: "Bearer valid-token" },
            body: {
                post_mode: "quote",
                page_connection_id: "page-conn-1",
                aspect_ratio: "9:16",
                quote_theme: "senja",
                quote_visual_style: QUOTE_PRESETS.visualStyles[0].value,
                use_random_song: true
            },
            env
        }, previewRes);
        assert.equal(previewRes.statusCode, 200);
        assert.equal(previewRes.body.preview.post_mode, "quote");
        assert.equal(previewRes.body.preview.quote_publish_target, "feed");
        assert.equal(previewRes.body.preview.is_story, false);
        assert.equal(previewRes.body.preview.video_mime_type, "video/mp4");
        assert.ok(previewRes.body.preview.video_base64.length > 10_000);
        assert.equal(previewRes.body.preview.song.title, "Gitar Senja Favorit");
        // Strictly clean quote text ONLY — no "Cerita hari ini", no song URLs, no hashtags!
        assert.equal(
            previewRes.body.preview.caption,
            "Setiap senja mengajarkan bahwa yang indah pun tahu cara berpamitan dengan tenang."
        );
        assert.doesNotMatch(previewRes.body.preview.caption, /Cerita hari ini|Lagu Facebook|facebook\.com|#foryou|#outfit/i);

        // 4. Default manual publish posts permanent video to Page Feed (graph-video.facebook.com/.../videos) with ZERO caption description
        const mp4Bytes = Buffer.from(previewRes.body.preview.video_base64, "base64");
        const publishRes = makeRes();
        await socialPublisherHandler({
            method: "POST",
            url: "/api/social-publisher?action=manual-publish",
            headers: {
                authorization: "Bearer valid-token",
                "content-type": "video/mp4",
                "x-manual-run-id": previewRes.body.preview.run_id
            },
            body: mp4Bytes,
            env
        }, publishRes);
        assert.equal(publishRes.statusCode, 200);
        assert.equal(publishRes.body.post.target, "feed");
        assert.equal(publishRes.body.post.is_story, false);
        assert.equal(publishRes.body.post.permalink_url, "https://www.facebook.com/99887766/videos/505/");
        assert.equal(feedPhotoCalls, 0, "Quote mode must never publish static feed photos");
        assert.equal(feedVideoCalls, 1, "Default quote target must publish permanent video post to Page Feed");
        assert.equal(lastFeedVideoDescription, null, "Feed video post must omit description so zero extra caption/link/hashtag appears");

        // 4b. Verify Reels, Story, and Feed+Story targets via publishFacebookQuoteVideo
        const reelPub = await publishFacebookQuoteVideo({
            env,
            pageId: "99887766",
            pageAccessToken: "fb-page-secret-token",
            videoBytes: new Uint8Array(mp4Bytes),
            target: "reels"
        });
        assert.equal(reelPub.target, "reels");
        assert.equal(reelPub.permalinkUrl, "https://www.facebook.com/reel/202");
        assert.deepEqual(reelPhases, ["start", "binary-upload", "finish"]);

        const bothPub = await publishFacebookQuoteVideo({
            env,
            pageId: "99887766",
            pageAccessToken: "fb-page-secret-token",
            videoBytes: new Uint8Array(mp4Bytes),
            target: "feed_story"
        });
        assert.equal(bothPub.target, "feed_story");
        assert.equal(feedVideoCalls, 2);
        assert.deepEqual(storyPhases, ["start", "binary-upload", "finish"]);

        // 5. Save quote schedule without character_id (defaults to quote_publish_target = "feed")
        const saveSchedRes = makeRes();
        await socialPublisherHandler({
            method: "POST",
            url: "/api/social-publisher?action=save-schedule",
            headers: { authorization: "Bearer valid-token" },
            body: {
                post_mode: "quote",
                character_id: null,
                page_connection_id: "page-conn-1",
                interval_minutes: 120,
                next_run_at: new Date(Date.now() + 3600_000).toISOString(),
                aspect_ratio: "9:16",
                quote_theme: "senja",
                quote_visual_style: QUOTE_PRESETS.visualStyles[1].value,
                use_random_song: true,
                autopublish_enabled: true,
                enabled: true
            },
            env
        }, saveSchedRes);
        assert.equal(saveSchedRes.statusCode, 200);
        assert.equal(saveSchedRes.body.schedule.post_mode, "quote");
        assert.equal(saveSchedRes.body.schedule.quote_publish_target, "feed");
        assert.equal(saveSchedRes.body.schedule.character_id, null);

        // 6. Seed 8 built-in Story tracks & delete custom uploaded song (removes storage object too)
        const seedRes = makeRes();
        await socialPublisherHandler({
            method: "POST",
            url: "/api/social-publisher?action=seed-default-songs",
            headers: { authorization: "Bearer valid-token" },
            body: {},
            env
        }, seedRes);
        assert.equal(seedRes.statusCode, 200);
        assert.equal(seedRes.body.added, 8);

        const delRes = makeRes();
        await socialPublisherHandler({
            method: "POST",
            url: "/api/social-publisher?action=delete-song",
            headers: { authorization: "Bearer valid-token" },
            body: { id: uploadSongRes.body.song.id },
            env
        }, delRes);
        assert.equal(delRes.statusCode, 200);
        assert.equal(audioBucketStore.size, 0, "Deleting custom song also deletes private audio object");
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("cron runSocialPublisherCron auto-generates 9:16 Video Story with embedded audio and publishes to /{page-id}/video_stories", async () => {
    const encryptedPageToken = await encryptSecret("fb-cron-token", TEST_ENCRYPTION_KEY);
    const updatedRuns = [];
    const cronStoryPhases = [];
    let uploadedMp4Size = 0;

    const env = {
        SUPABASE_URL: "https://supabase.example.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
        GEMINI_API_KEY: "gemini-key",
        SOCIAL_TOKEN_ENCRYPTION_KEY: TEST_ENCRYPTION_KEY
    };

    const originalFetch = globalThis.fetch;
    try {
        globalThis.fetch = async (input, init = {}) => {
            const url = String(input);
            const method = (init.method || "GET").toUpperCase();

            if (url.includes("/rest/v1/social_publisher_config?") || url.includes("/rest/v1/social_publisher_settings?")) {
                return Response.json([{
                    id: true,
                    global_enabled: true,
                    autopublish_enabled: true,
                    image_provider: "gemini",
                    image_model: "gemini-3.1-flash-lite-image"
                }]);
            }
            if (url.includes("/rest/v1/studio_medsos_access?")) {
                return Response.json([{
                    user_id: "user-cron-1",
                    is_active: true,
                    started_at: new Date(Date.now() - 86400_000).toISOString(),
                    expires_at: new Date(Date.now() + 29 * 86400_000).toISOString()
                }]);
            }
            if (url.includes("/rpc/claim_due_social_post_schedules")) {
                return Response.json([{
                    run_id: "run-cron-quote-1",
                    schedule_id: "sched-quote-cron-1",
                    owner_id: "user-cron-1"
                }]);
            }
            if (url.includes("/rpc/claim_stuck_social_post_runs")) {
                return Response.json([]);
            }
            if (url.includes("/rest/v1/social_post_schedules?")) {
                return Response.json([{
                    id: "sched-quote-cron-1",
                    owner_id: "user-cron-1",
                    character_id: null,
                    page_connection_id: "page-cron-1",
                    aspect_ratio: "9:16",
                    caption_template: "Cerita hari ini...!!! #foryou #outfit #fashion",
                    autopublish_enabled: true,
                    enabled: true,
                    post_mode: "quote",
                    quote_theme: "islami",
                    quote_visual_style: QUOTE_PRESETS.visualStyles[2].value,
                    use_random_song: true,
                    scene_details: "",
                    negative_prompt: ""
                }]);
            }
            if (url.includes("/rest/v1/social_page_connections?")) {
                return Response.json([{
                    id: "page-cron-1",
                    owner_id: "user-cron-1",
                    page_id: "11223344",
                    page_name: "Malam Tenang Page",
                    page_token_ciphertext: encryptedPageToken.ciphertext,
                    page_token_iv: encryptedPageToken.iv,
                    can_publish: true
                }]);
            }
            if (url.includes("/rest/v1/social_publisher_user_settings?")) {
                return Response.json([{
                    owner_id: "user-cron-1",
                    autopublish_enabled: true,
                    caption_template: "Cerita hari ini...!!! #foryou #outfit #fashion",
                    external_link: "https://genzai.id"
                }]);
            }
            if (url.includes("/rest/v1/social_facebook_songs?")) {
                return Response.json([
                    {
                        id: "song-used",
                        title: "Senja Akustik Hangat",
                        artist: "Studio Instrumental",
                        audio_object_key: "builtin:senja-akustik",
                        audio_mime_type: "audio/mp4",
                        duration_seconds: 15,
                        is_active: true
                    },
                    {
                        id: "song-fresh",
                        title: "Doa dalam Hening",
                        artist: "Studio Instrumental",
                        audio_object_key: "builtin:doa-hening",
                        audio_mime_type: "audio/mp4",
                        duration_seconds: 15,
                        is_active: true
                    }
                ]);
            }
            if (url.includes("/rest/v1/social_publisher_model_quotas")) {
                return Response.json([]);
            }
            if (url.includes("/rest/v1/social_post_runs")) {
                if (method === "GET") {
                    return Response.json([{
                        song_id: "song-used",
                        song_title: "Senja Akustik Hangat",
                        quote_text: "Kutipan sebelumnya.",
                        scene_plan: { song_id: "song-used", song_title: "Senja Akustik Hangat" }
                    }]);
                }
                if (method === "POST") {
                    const payload = JSON.parse(init.body);
                    return Response.json([{ id: "run-cron-quote-1", ...payload }], { status: 201 });
                }
                if (method === "PATCH") {
                    const payload = JSON.parse(init.body);
                    updatedRuns.push(payload);
                    return Response.json([payload]);
                }
            }
            if (url.includes("/v1beta/interactions")) {
                const payload = JSON.parse(init.body || "{}");
                if (String(payload.model || "").includes("image")) {
                    return Response.json({
                        output_image: {
                            mime_type: "image/png",
                            data: TINY_PNG_BASE64
                        }
                    });
                }
                return Response.json({
                    outputs: [{
                        type: "text",
                        text: "QUOTE: Doa yang dipanjatkan diam-diam tetap terdengar paling jelas oleh langit."
                    }]
                });
            }
            if (url.includes("graph.facebook.com") && url.includes("/11223344?fields=")) {
                return Response.json({ id: "11223344", name: "Malam Tenang Page", tasks: ["CREATE_CONTENT", "MANAGE"] });
            }
            if (url.includes("graph-video.facebook.com") && url.endsWith("/11223344/videos")) {
                const form = init.body;
                assert.equal(form.get("published"), "true");
                assert.equal(form.get("description"), null);
                const source = form.get("source");
                uploadedMp4Size = source ? source.size : 0;
                cronStoryPhases.push("feed-video-upload");
                return Response.json({ id: "cron-feed-vid-777", post_id: "11223344_777" });
            }
            if (url.includes("graph.facebook.com") && url.includes("cron-feed-vid-777")) {
                return Response.json({ permalink_url: "/11223344/videos/777/" });
            }
            throw new Error(`Unexpected cron fetch URL: ${url}`);
        };

        const result = await runSocialPublisherCron(env);
        assert.equal(result.claimed, 1);
        assert.equal(result.skipped, false);
        assert.deepEqual(cronStoryPhases, ["feed-video-upload"]);
        assert.ok(uploadedMp4Size > 100_000, "Cron Quote MP4 must contain full video + embedded AAC audio");

        const finalPatch = updatedRuns.at(-1);
        assert.equal(finalPatch.status, "posted");
        assert.equal(finalPatch.post_mode, "quote");
        assert.equal(finalPatch.quote_publish_target, "feed");
        assert.equal(finalPatch.permalink_url, "https://www.facebook.com/11223344/videos/777/");
        assert.equal(finalPatch.song_id, "song-fresh");
        assert.equal(finalPatch.song_title, "Doa dalam Hening");
        assert.equal(finalPatch.song_facebook_url, "");
        assert.equal(
            finalPatch.caption,
            "Doa yang dipanjatkan diam-diam tetap terdengar paling jelas oleh langit."
        );
        assert.doesNotMatch(finalPatch.caption, /Cerita hari ini|Lagu Facebook|facebook\.com|#foryou|#outfit/i);
        assert.doesNotMatch(finalPatch.generated_prompt, /Doa yang dipanjatkan/, "AI background prompt must not ask AI to draw quote text");
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("Studio Medsos HTML, JS, Light CSS, and SQL migration include Cerita Kata-kata Mutiara + Musik Auto-Play controls", () => {
    const html = fs.readFileSync(path.join(repoRoot, "admin-control/social-publisher.html"), "utf8");
    const js = fs.readFileSync(path.join(repoRoot, "admin-control/social-publisher.js"), "utf8");
    const lightCss = fs.readFileSync(path.join(repoRoot, "admin-control/assets/css/social-publisher-light.css"), "utf8");
    const sql = fs.readFileSync(path.join(repoRoot, "supabase/social-quote-music.sql"), "utf8");

    assert.equal(QUOTE_PRESETS.themes.length >= 8, true);
    assert.equal(QUOTE_PRESETS.visualStyles.length >= 8, true);

    assert.match(html, /id="songs-card"/);
    assert.match(html, /id="song-form"/);
    assert.match(html, /id="song-audio-file"/);
    assert.match(html, /id="manual-generated-video"/);
    assert.match(html, /id="seed-default-songs"/);
    assert.match(html, /id="manual-post-mode"/);
    assert.match(html, /id="manual-quote-fields"/);
    assert.match(html, /id="manual-quote-target"/);
    assert.match(html, /id="manual-song-line"/);
    assert.match(html, /id="schedule-post-mode"/);
    assert.match(html, /id="schedule-quote-fields"/);
    assert.match(html, /id="schedule-quote-target"/);
    assert.match(html, /id="schedule-random-song"/);

    assert.match(js, /function setManualPostMode\(/);
    assert.match(js, /function setSchedulePostMode\(/);
    assert.match(js, /function quoteTargetLabel\(/);
    assert.match(js, /async function loadFacebookSongs\(/);
    assert.match(js, /async function submitSong\(/);
    assert.match(js, /async function seedDefaultSongs\(/);
    assert.doesNotMatch(js, /from\s+["']\.\.\/lib\//, "Browser JS must not import ../lib/ outside dist/");

    assert.match(lightCss, /\.song-card/);
    assert.match(lightCss, /\.mode-tabs/);
    assert.match(lightCss, /\.badge\.quote-mode/);

    assert.match(sql, /create table if not exists public\.social_facebook_songs/i);
    assert.match(sql, /add column if not exists audio_object_key/i);
    assert.match(sql, /add column if not exists quote_publish_target/i);
    assert.match(sql, /social-story-audio/i);
    assert.match(sql, /alter column character_id drop not null/i);
    assert.match(sql, /add column if not exists post_mode/i);
});
